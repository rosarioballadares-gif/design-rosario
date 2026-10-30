/**
 * What `scripts/git-guard.cjs` refuses, and — the half that matters more —
 * what it must not.
 *
 * A guard on `Bash` sits in front of every command this workspace runs, so a
 * false positive is not a cosmetic defect: it stops ordinary work and the
 * person cannot route around it. The allow cases below outnumber the deny
 * cases on purpose.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

/** What the branch is carrying, as `briefState` reports it. */
type Carried = { work: number; briefs: number; inProgress: boolean } | null;

/** What the gate has proven about this tree, as `gateProof` reports it. */
type Proof = { head: string; receipt: { head: string; clean: boolean } | null } | null;

const { judge, briefState } = require('./git-guard.cjs') as {
  judge: (
    command: string,
    cwd?: string,
    branchOf?: (cwd?: string) => string | null,
    stateOf?: (cwd?: string) => Carried,
    proofOf?: (cwd?: string, ref?: string) => Proof,
    livingOf?: (path: string) => number,
  ) => string | null;
  briefState: (cwd?: string) => Carried;
};

/** A checkout that is NOT a worktree, which is where the add rule applies. */
const SHARED = 'C:\\design-ops';
const WORKTREE = 'C:\\design-ops\\.claude\\worktrees\\rules-that-catch';

/** Injected so no case depends on what the shared checkout has checked out. */
const on =
  (branch: string | null) =>
  (): string | null =>
    branch;

/** Injected for the same reason: a verdict must not depend on this branch. */
const carrying =
  (state: Carried) =>
  (): Carried =>
    state;

/** A branch whose work came with a brief, which is the ordinary case. */
const WITH_BRIEF = { work: 4, briefs: 1, inProgress: false };

/** Injected for the third time, and for the third time so the verdict does not
 * depend on whether THIS checkout happens to have run the gate. */
const proving =
  (proof: Proof) =>
  (): Proof =>
    proof;

const HEAD = 'abc1234def567890';
const OTHER = '99f0011aabbccdde';

/** The gate ran green over this exact commit, which is the allow case. */
const PROVEN = proving({ head: HEAD, receipt: { head: HEAD, clean: true } });
/** A readable HEAD with no receipt beside it — the evidence the rule wants. */
const UNPROVEN = proving({ head: HEAD, receipt: null });
/** A receipt from before the merge that moved HEAD. */
const STALE = proving({ head: HEAD, receipt: { head: OTHER, clean: true } });
/** Green, over a tree carrying things that were never committed. */
const DIRTY = proving({ head: HEAD, receipt: { head: HEAD, clean: false } });
/** git did not answer for HEAD, so there is no question to ask. */
const UNMEASURED = proving(null);

describe('git add over the whole tree', () => {
  it.each([
    'git add -A',
    'git add --all',
    'git add .',
    'git add -A -- src',
    'git add -u',
    'git add :/',
    'git add *',
    'git add -- .',
    'git add ./',
    'git stage -A',
  ])(
    'refuses %s',
    (command) => {
      expect(judge(command, SHARED, on('feat/x'))).toMatch(/name the files you commit/);
    },
  );

  it('refuses it in a compound command, which is how it is actually written', () => {
    expect(judge('pnpm lint && git add -A', SHARED, on('feat/x'))).not.toBeNull();
  });

  /*
   * The exemption that makes the rule survivable. Inside a worktree the
   * harness refuses the compound `test … && git commit` idiom, so `git add -A`
   * is the prescribed form — and git itself pins a worktree to its branch,
   * which is the guarantee the rule was standing in for.
   */
  it('allows it inside a worktree, where it is the correct form', () => {
    expect(judge('git add -A', WORKTREE, on('feat/x'))).toBeNull();
  });
});

describe('what the add rule must not catch', () => {
  it.each([
    'git add briefs/2026-09-11-rules-that-catch.md',
    'git add -p',
    'git add ./src/App.tsx',
    'git add src/a.ts src/b.ts',
  ])('allows %s', (command) => {
    expect(judge(command, SHARED, on('feat/x'))).toBeNull();
  });

  /*
   * The forbidden string inside a quoted argument is not the forbidden
   * command. Both of these are ordinary and both would be maddening to have
   * refused, which is why the pattern anchors to a command boundary rather
   * than searching the line.
   */
  it('allows the string when it is quoted argument text, not a command', () => {
    expect(judge('echo "git add -A"', SHARED, on('feat/x'))).toBeNull();
    expect(
      judge('git commit -m "stop using git add -A"', SHARED, on('feat/x'), carrying(WITH_BRIEF)),
    ).toBeNull();
  });
});

describe('committing on a branch that is not a working surface', () => {
  it('refuses a commit on main', () => {
    expect(judge('git commit -m x', SHARED, on('main'))).toMatch(/not a working surface/);
  });

  /* Spellings that used to slip past the command boundary, found 2026-10-09. */
  it.each([' git commit -m x', 'echo a\ngit commit -m x', '(git commit -m x)', 'env git commit -m x'])(
    'refuses %j on main',
    (command) => {
      expect(judge(command, SHARED, on('main'))).toMatch(/not a working surface/);
    },
  );

  it('allows a commit on a feature branch', () => {
    expect(
      judge('git commit -m x', SHARED, on('feat/rules-that-catch'), carrying(WITH_BRIEF)),
    ).toBeNull();
  });

  /*
   * Fails open, and this is the deliberate half. With no branch there is no
   * evidence of a violation, and a hook that BLOCKS on an unanswered question
   * stops real work over a git that did not reply.
   */
  it('allows a commit when the branch cannot be read', () => {
    expect(judge('git commit -m x', SHARED, on(null), carrying(WITH_BRIEF))).toBeNull();
  });
});

describe('a push that would update main', () => {
  /*
   * The premise this replaces said the guard does not touch `git push`, and it
   * was true until the gate started writing down which tree it measured. The
   * old case was deleted rather than edited around: it pinned
   * the premise of an override, which is what those cases are for.
   */
  it('refuses it when nothing has measured this tree', () => {
    expect(judge('git push origin main', SHARED, on('main'), carrying(WITH_BRIEF), UNPROVEN)).toMatch(
      /nothing has measured this tree/,
    );
  });

  it('refuses it when the receipt measured a different commit, naming both', () => {
    const verdict = judge('git push origin main', SHARED, on('main'), carrying(WITH_BRIEF), STALE);
    expect(verdict).toMatch(/99f0011/);
    expect(verdict).toMatch(/abc1234/);
  });

  it('refuses it when the receipt was taken over a dirty tree', () => {
    expect(judge('git push origin main', SHARED, on('main'), carrying(WITH_BRIEF), DIRTY)).toMatch(
      /dirty tree/,
    );
  });

  it('allows it once the gate has measured this exact commit', () => {
    expect(judge('git push origin main', SHARED, on('main'), carrying(WITH_BRIEF), PROVEN)).toBeNull();
  });

  it.each([
    'git push origin feat/x:main',
    'git push --force origin main',
    'git push origin HEAD:refs/heads/main',
    'git push --all origin',
  ])('reads %s as updating main', (command) => {
    expect(judge(command, SHARED, on('feat/x'), carrying(WITH_BRIEF), UNPROVEN)).toMatch(/Refused/);
  });

  it('refuses a bare push while main is checked out', () => {
    expect(judge('git push', SHARED, on('main'), carrying(WITH_BRIEF), UNPROVEN)).toMatch(/Refused/);
  });

  it.each(['git push origin HEAD', 'git push origin @'])('reads %s on main as updating main', (command) => {
    expect(judge(command, SHARED, on('main'), carrying(WITH_BRIEF), UNPROVEN)).toMatch(/Refused/);
  });

  it('names the gate and checks.md as the repair, and nothing that does not exist here', () => {
    const verdict = judge('git push origin main', SHARED, on('main'), carrying(WITH_BRIEF), UNPROVEN);
    expect(verdict).toMatch(/pnpm gate/);
    expect(verdict).toMatch(/docs\/foundation\/checks\.md/);
    expect(verdict).not.toMatch(/Amplify|WDR/);
  });

  /*
   * The receipt names a commit, and the commit that matters is the one the
   * push sends — not HEAD. From a feature branch whose own commit was
   * measured, `git push origin main` sends local `main`, which was not.
   */
  describe('against the commit the push sends, not HEAD', () => {
    const A = 'aaaaaaa1111111';
    const B = 'bbbbbbb2222222';
    /** A proof reader that answers per ref, and records which ref it was asked. */
    const byRef =
      (heads: Record<string, string>, measured: string, seen: string[] = []) =>
      (_cwd?: string, ref?: string): Proof => {
        seen.push(String(ref));
        const head = heads[String(ref)];
        return head ? { head, receipt: { head: measured, clean: true } } : null;
      };
    const onFeature = { HEAD: A, 'feat/x': A, main: B };

    it.each(['git push origin main', 'git push --all origin', 'git push --mirror origin'])(
      'refuses %s from a branch whose own commit was measured',
      (command) => {
        expect(judge(command, SHARED, on('feat/x'), carrying(WITH_BRIEF), byRef(onFeature, A))).toMatch(
          /Refused/,
        );
      },
    );

    it('allows src:main when src is the measured commit', () => {
      expect(
        judge('git push origin feat/x:main', SHARED, on('feat/x'), carrying(WITH_BRIEF), byRef(onFeature, A)),
      ).toBeNull();
    });

    it.each([
      ['git push origin main', 'main'],
      ['git push origin feat/x:main', 'feat/x'],
      ['git push', 'HEAD'],
      ['git push origin', 'HEAD'],
      ['git push origin HEAD', 'HEAD'],
    ])('asks for the source of %s, which is %s', (command, ref) => {
      const seen: string[] = [];
      judge(command, SHARED, on('main'), carrying(WITH_BRIEF), byRef({ HEAD: B, main: B }, B, seen));
      expect(seen).toEqual([ref]);
    });
  });
});

describe('what the push rule must not catch', () => {
  it.each([
    'git push origin feat/other',
    'git push',
    'git push -u origin feat/x',
    'git push --tags',
    'git push origin HEAD',
  ])(
    'allows %s from a feature branch with nothing measured',
    (command) => {
      expect(judge(command, SHARED, on('feat/x'), carrying(WITH_BRIEF), UNPROVEN)).toBeNull();
    },
  );

  it('allows a push of main ONTO something else, which does not move main', () => {
    expect(judge('git push origin main:scratch', SHARED, on('main'), carrying(WITH_BRIEF), UNPROVEN)).toBeNull();
  });

  it('stops the tail at the command boundary, so a later word is not a refspec', () => {
    expect(
      judge('git push origin feat/x && echo main', SHARED, on('feat/x'), carrying(WITH_BRIEF), UNPROVEN),
    ).toBeNull();
  });

  /*
   * Fails open, like every other reader in this file. No HEAD is not evidence
   * that an unproven publish is happening — it is no measurement at all.
   */
  it('allows the push when git did not answer for HEAD', () => {
    expect(judge('git push origin main', SHARED, on('main'), carrying(WITH_BRIEF), UNMEASURED)).toBeNull();
  });

  it('allows a bare push when the branch cannot be read', () => {
    expect(judge('git push', SHARED, on(null), carrying(WITH_BRIEF), UNPROVEN)).toBeNull();
  });
});

describe('a commit that brings no brief', () => {
  const NO_BRIEF = { work: 3, briefs: 0, inProgress: false };

  it('refuses it, and names the repair rather than restating the rule', () => {
    const verdict = judge('git commit -m x', SHARED, on('feat/x'), carrying(NO_BRIEF));
    expect(verdict).toMatch(/3 work file/);
    expect(verdict).toMatch(/briefs\/YYYY-MM-DD-<slug>\.md/);
  });

  /*
   * The four allow cases, and they are the reason this rule can exist at all.
   * Each is a state a person is legitimately in, and refusing any one of them
   * would stop work that broke no rule — with no way around it, because a hook
   * that denies is not a hook you can argue with.
   */
  it('allows it once a brief is there', () => {
    expect(judge('git commit -m x', SHARED, on('feat/x'), carrying(WITH_BRIEF))).toBeNull();
  });

  it('allows a branch that changed no work files, which owes no brief', () => {
    expect(
      judge('git commit -m x', SHARED, on('feat/x'), carrying({ work: 0, briefs: 0, inProgress: false })),
    ).toBeNull();
  });

  it('allows it mid-merge, where the conflicted files are not this branch work', () => {
    expect(
      judge('git commit -m x', SHARED, on('feat/x'), carrying({ ...NO_BRIEF, inProgress: true })),
    ).toBeNull();
  });

  it('allows it when the state could not be measured at all', () => {
    expect(judge('git commit -m x', SHARED, on('feat/x'), carrying(null))).toBeNull();
  });

  /*
   * Precedence, stated as a test because the two refusals would otherwise be
   * indistinguishable to whoever reads the denial: on `main` the answer is
   * still that `main` is not a working surface, which is the repair that helps.
   */
  it('keeps the main refusal saying what it always said', () => {
    expect(judge('git commit -m x', SHARED, on('main'), carrying(NO_BRIEF))).toMatch(
      /not a working surface/,
    );
  });
});

/*
 * The directory the command runs in, which is not the one the hook is told.
 *
 * Every case above injects a branch and so cannot see this: the payload's
 * `cwd` is the SESSION's directory, and a session that reaches a worktree with
 * `cd <path> && git commit` was judged against the branch it left behind. On
 * `main` — the branch a session sits on between tasks — that refused a commit
 * that was correct, with a message naming a repair the person had already
 * done. The readers below take a directory, so these cases inject readers that
 * ANSWER FROM IT rather than ignoring it.
 */
describe('a command that changes directory before it runs git', () => {
  /** Built for the running platform: these are the first paths here that are
   * resolved rather than compared, so a Windows literal would not survive. */
  const ROOT = resolvePath('/design-ops');
  const WT = join(ROOT, '.claude', 'worktrees', 'guard-and-after-figure');

  /** A branch reader that answers from the directory, which is the whole point. */
  const byDir =
    (branches: Record<string, string>) =>
    (cwd?: string): string | null =>
      branches[String(cwd)] ?? null;

  const branches = byDir({ [ROOT]: 'main', [WT]: 'feat/guard-cwd' });

  it('allows the commit the guard used to refuse, reached by an absolute cd', () => {
    expect(judge(`cd ${WT} && git commit -m x`, ROOT, branches, carrying(WITH_BRIEF))).toBeNull();
  });

  it('allows it when the cd is relative, which resolves against the session', () => {
    expect(
      judge(
        'cd .claude/worktrees/guard-and-after-figure && git commit -m x',
        ROOT,
        branches,
        carrying(WITH_BRIEF),
      ),
    ).toBeNull();
  });

  it('allows git add -A once the cd has reached the worktree', () => {
    expect(judge(`cd ${WT} && git add -A`, ROOT, branches)).toBeNull();
  });

  /*
   * The other direction, and the one that proves the rule was not simply
   * switched off: a `cd` INTO the shared checkout is judged there.
   */
  it('still refuses a commit the cd lands on main', () => {
    expect(judge(`cd ${ROOT} && git commit -m x`, WT, branches, carrying(WITH_BRIEF))).toMatch(
      /not a working surface/,
    );
  });

  it('still refuses git add -A when the cd lands outside a worktree', () => {
    expect(judge(`cd ${ROOT} && git add -A`, WT, branches)).toMatch(/name the files you commit/);
  });

  /*
   * A `cd` written after the git call runs after it, so it must not be read as
   * the directory the git call ran in. Without the break this case reports the
   * worktree and lets a commit onto `main` through.
   */
  it('ignores a cd that comes after the git command', () => {
    expect(judge(`git commit -m x && cd ${WT}`, ROOT, branches, carrying(WITH_BRIEF))).toMatch(
      /not a working surface/,
    );
  });

  /*
   * An unresolvable target leaves the guard as strict as it was rather than
   * quieter — the opposite of how `currentBranch` fails, and deliberate: here
   * there IS a measurement, it is just not the one the command will use.
   */
  it.each(['cd -', 'cd ~/design-ops', 'cd $WORKTREE'])(
    'falls back to the session directory on %s',
    (prefix) => {
      expect(judge(`${prefix} && git commit -m x`, ROOT, branches, carrying(WITH_BRIEF))).toMatch(
        /not a working surface/,
      );
    },
  );

  it('reads a cd on its own line, before git on the next', () => {
    expect(judge(`cd ${ROOT}\ngit commit -m x`, WT, branches, carrying(WITH_BRIEF))).toMatch(
      /not a working surface/,
    );
  });

  /* Git Bash spells C:\x as /c/x, and Node on Windows resolved it to C:\c\x —
   * a directory with no repository, where every reader fails open. */
  it.runIf(process.platform === 'win32')('reads a Git Bash drive path as the drive', () => {
    const posix = ROOT.replace(/^([A-Za-z]):\\/, (_, d: string) => `/${d.toLowerCase()}/`).replace(/\\/g, '/');
    expect(judge(`cd ${posix} && git commit -m x`, WT, branches, carrying(WITH_BRIEF))).toMatch(
      /not a working surface/,
    );
    expect(judge(`git -C ${posix} commit -m x`, WT, branches, carrying(WITH_BRIEF))).toMatch(
      /not a working surface/,
    );
  });

  it('reads past a command that is neither cd nor git', () => {
    expect(
      judge(`export PATH=/x; cd ${WT} && git commit -m x`, ROOT, branches, carrying(WITH_BRIEF)),
    ).toBeNull();
  });

  /*
   * `git -C <path>` moves the command without moving the shell, and until
   * 2026-09-14 it moved it clean past the guard: every pattern required the
   * subcommand immediately after `git`, so all four rules matched nothing.
   * These are the cases that would have been refused had they been seen.
   */
  describe('the same command spelled with git -C, which nothing used to catch', () => {
    it.each([
      ['git -C /elsewhere add -A', /name the files you commit/],
      ['git -c user.email=x add --all', /name the files you commit/],
    ])('refuses %s', (command, reason) => {
      expect(judge(command, ROOT, branches)).toMatch(reason);
    });

    it('refuses a commit that -C lands on main', () => {
      expect(judge(`git -C ${ROOT} commit -m x`, WT, branches, carrying(WITH_BRIEF))).toMatch(
        /not a working surface/,
      );
    });

    it('allows the commit that -C lands in a worktree', () => {
      expect(judge(`git -C ${WT} commit -m x`, ROOT, branches, carrying(WITH_BRIEF))).toBeNull();
    });

    it('reads -C past an option that carries its own value', () => {
      expect(
        judge(`git -c user.email=x -C ${WT} commit -m y`, ROOT, branches, carrying(WITH_BRIEF)),
      ).toBeNull();
    });

    /*
     * The hole the repair could have opened. `-C` inside a message is text,
     * and resolving it would send the branch reader to a directory that does
     * not exist — where it fails open, letting a commit onto `main` through.
     * Read only out of the option region, never out of the segment.
     */
    it('does not read -C out of a commit message', () => {
      expect(
        judge('git commit -m "we stopped using -C /tmp"', ROOT, branches, carrying(WITH_BRIEF)),
      ).toMatch(/not a working surface/);
    });

    it('reads a quoted -C value that carries a space', () => {
      const spaced = join(ROOT, 'a b');
      const withSpace = byDir({ [spaced]: 'main', [WT]: 'feat/guard-cwd' });
      expect(judge(`git -C "${spaced}" commit -m x`, WT, withSpace, carrying(WITH_BRIEF))).toMatch(
        /not a working surface/,
      );
      expect(judge(`git -C "${spaced}" add -A`, WT, withSpace)).toMatch(/name the files you commit/);
    });

    it('leaves a subcommand that merely follows an option alone', () => {
      expect(judge('git config --global alias.ci commit', ROOT, branches)).toBeNull();
    });
  });
});

/*
 * The reader, against a real repository rather than an injected object.
 *
 * This is where the costliest false denial would live, and the judge above
 * cannot see it: a brief written and not yet staged has to count, because the
 * moment a guard on `git commit` asks the question is the moment before the
 * first commit.
 */
describe('what the branch is carrying', () => {
  let dir = '';
  let run: (...args: string[]) => string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'git-guard-'));
    run = (...args) =>
      execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    run('init', '-b', 'main');
    run('config', 'user.email', 'spec@example.com');
    run('config', 'user.name', 'spec');
    writeFileSync(join(dir, 'seed.txt'), 'seed\n');
    run('add', 'seed.txt');
    run('commit', '-m', 'seed');
    run('switch', '-c', 'feat/x');
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  /** A work file, committed on the feature branch. */
  const work = () => {
    writeFileSync(join(dir, 'app.ts'), 'export const a = 1;\n');
    run('add', 'app.ts');
    run('commit', '-m', 'work');
  };

  /** A brief, written and deliberately left unstaged. */
  const brief = () => {
    mkdirSync(join(dir, 'briefs'), { recursive: true });
    writeFileSync(join(dir, 'briefs', '2026-09-12-x.md'), '# Brief\n');
  };

  it('reports work that came with no brief', () => {
    work();
    expect(briefState(dir)).toEqual({ work: 1, briefs: 0, inProgress: false });
  });

  it('counts a brief that is only in the working tree, never staged', () => {
    work();
    brief();
    expect(briefState(dir)).toEqual({ work: 1, briefs: 1, inProgress: false });
  });

  it('counts a brief that is committed', () => {
    work();
    brief();
    run('add', 'briefs/2026-09-12-x.md');
    run('commit', '-m', 'brief');
    expect(briefState(dir)).toEqual({ work: 1, briefs: 1, inProgress: false });
  });

  it('sees a merge in progress by its marker in the git directory', () => {
    work();
    writeFileSync(join(dir, '.git', 'MERGE_HEAD'), `${run('rev-parse', 'HEAD').trim()}\n`);
    expect(briefState(dir)?.inProgress).toBe(true);
  });

  /* The feedback and setup skills commit these without a brief by design. */
  it.each([
    'feedback/2026-10-09-x.md',
    'docs/foundation/people.md',
    'docs/foundation/workspace-wiring.md',
  ])('owes no brief for %s alone', (path) => {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), 'x\n');
    run('add', path);
    run('commit', '-m', 'exempt');
    expect(briefState(dir)).toEqual({ work: 0, briefs: 0, inProgress: false });
  });

  it('still counts work committed beside an exempt path', () => {
    work();
    mkdirSync(join(dir, 'feedback'), { recursive: true });
    writeFileSync(join(dir, 'feedback', 'x.md'), 'x\n');
    expect(briefState(dir)).toEqual({ work: 1, briefs: 0, inProgress: false });
  });

  it('fails open where there is no repository to measure', () => {
    expect(briefState(join(dir, 'nowhere'))).toBeNull();
  });
});

describe('removing a worktree that still has processes', () => {
  /** Injected so no verdict depends on what happens to run on this machine. */
  const running =
    (count: number, seen: string[] = []) =>
    (path: string): number => {
      seen.push(path);
      return count;
    };
  const judgeRemove = (command: string, living: (path: string) => number) =>
    judge(command, SHARED, on('main'), carrying(WITH_BRIEF), UNMEASURED, living);

  it('refuses it while the worktree has processes, and names the script', () => {
    const verdict = judgeRemove('git worktree remove .claude/worktrees/rules-that-catch', running(3));
    expect(verdict).toMatch(/3 process\(es\)/);
    expect(verdict).toMatch(/pnpm worktree:close rules-that-catch/);
  });

  it('resolves the path against the directory the command runs in', () => {
    const seen: string[] = [];
    judgeRemove('git worktree remove --force .claude/worktrees/rules-that-catch', running(0, seen));
    expect(seen).toEqual([resolvePath(SHARED, '.claude/worktrees/rules-that-catch')]);
  });

  it('allows it once nothing runs out of it, which is the ordinary case', () => {
    expect(judgeRemove('git worktree remove .claude/worktrees/rules-that-catch', running(0))).toBeNull();
  });

  it.each(['git worktree list', 'git worktree prune', 'git worktree add ../x', 'echo "git worktree remove x"'])(
    'does not look at processes for %s',
    (command) => {
      const seen: string[] = [];
      expect(judgeRemove(command, running(5, seen))).toBeNull();
      expect(seen).toEqual([]);
    },
  );
});

/*
 * The hook as the harness calls it: a process, a payload on stdin, a verdict
 * on stdout. The cases above cannot see which tools reach `judge`, or which
 * repositories it speaks in.
 */
describe('the hook, as the harness calls it', () => {
  let dir = '';
  const hook = (payload: object) =>
    execFileSync('node', [require.resolve('./git-guard.cjs')], {
      input: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: dir, ...payload }),
      encoding: 'utf8',
    });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'git-guard-hook-'));
    execFileSync('git', ['init', '-b', 'feat/x'], { cwd: dir, stdio: 'ignore' });
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  /** This repository, recognised by the guard it carries. */
  const governed = () => {
    mkdirSync(join(dir, 'scripts'), { recursive: true });
    writeFileSync(join(dir, 'scripts', 'git-guard.cjs'), '\n');
  };

  it.each(['Bash', 'PowerShell'])('refuses a whole-tree add from %s', (tool) => {
    governed();
    expect(hook({ tool_name: tool, tool_input: { command: 'git add -A' } })).toMatch(/"deny"/);
  });

  it('stays quiet in a repository that does not carry this guard', () => {
    expect(hook({ tool_name: 'Bash', tool_input: { command: 'git add -A' } })).toBe('');
  });
});
