#!/usr/bin/env node
/**
 * Refuse what CLAUDE.md forbids at a `git` call, at the moment it is typed.
 *
 * Five rules: `git add` over the whole tree, a commit on a branch that is not
 * a working surface, a commit that carries work with no brief behind it, a
 * push that would update `main` over a tree `pnpm gate` has not measured, and
 * a `git worktree remove` while processes still run out of that worktree.
 *
 * WHY A HOOK AND NOT A SENTENCE. The first two were already written down, and one
 * of them was broken anyway: measured 2026-09-07, with six agent sessions
 * against one checkout, a `git add -A` in a commit about the chart library
 * swept up another session's unfinished `docs/foundation/form-patterns.md` and
 * carried it to `main` under a message about something else. Nothing failed and
 * nothing was lost, which is exactly why prose could not catch it — there was
 * no symptom to notice. This repo's own criterion for whether a rule may live
 * as prose is whether anything catches the agent who forgets it, and for these
 * two the answer was nothing.
 *
 * WHY THE THIRD RULE IS HERE AND NOT IN ITS OWN HOOK. `check-brief-present.mjs`
 * already decides whether a branch's work brought a brief, and its own head
 * records the failure it was written for: a branch that rewrites `src/` with no
 * brief passes `check:briefs` green, and did. But it runs on a person's machine
 * on demand and nowhere else. The decision is mirrored rather than moved — that
 * file stays the check, this stays the guard — and it lands in `judge()` because
 * a second hook would parse `git commit` out of the same string a second time.
 *
 * WHY THE REASONS ARE SHORT, unlike `skill-router.cjs` next door. That one
 * fires ONCE per session and spends a long paragraph deliberately. This one
 * fires every time the form appears, and a `permissionDecisionReason` enters
 * the conversation and is re-read on every later call of the session. A guard
 * that talks is a guard that costs. Say the rule, name the repair, stop.
 *
 * WHY THE FOURTH RULE EXISTS, when this file argued against it until now. The
 * old argument was that a hook cannot tell an approved publish from an
 * unapproved one, so it would deny both — true, and about APPROVAL. Whether
 * `pnpm gate` has measured this exact tree is a different question with a
 * mechanical answer, and since 2026-09-12 the gate writes that answer down.
 * The rule refuses the unproven publish and is silent on the proven one.
 *
 * WHAT IT STILL DELIBERATELY DOES NOT DO. It does not ask for approval.
 * Pushing `main` is the one action here with an audience and
 * CLAUDE.md asks for a confirmation, which stays a conversation. Somebody who
 * runs the gate and publishes something nobody agreed to is not stopped here.
 *
 * WHY THE FIFTH is in `worktree-processes.cjs`. It refuses the bare form only
 * while that path has processes, so a worktree with nothing running is
 * removed exactly as before.
 */
'use strict';

const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join, resolve } = require('node:path');
const receipt = require('./gate-receipt.cjs');
const worktreeProcesses = require('./worktree-processes.cjs');

/**
 * The global options git accepts BETWEEN the program and its subcommand.
 *
 * Every pattern below used to require the subcommand immediately after `git`,
 * which made `git -C <path> commit` match none of them — the whole guard, all
 * four rules, blind to a spelling that is one option long and does exactly
 * what the guarded forms do. Found 2026-09-14 while repairing `effectiveCwd`,
 * which would otherwise have resolved a directory for commands no rule reads.
 *
 * Only the value-taking options are spelled out. The rest are consumed as
 * whole words, because a global option this does not know is still not a
 * subcommand, and stopping at one would restore the blindness for that word.
 */
const VALUE = String.raw`(?:"[^"]*"|'[^']*'|\S+)`;
const GIT_OPTIONS = String.raw`(?:\s+(?:-[cC]\s+${VALUE}|--(?:git-dir|work-tree|namespace|exec-path)(?:=|\s+)${VALUE}|--[\w-]+|-[Pp]))*`;

/**
 * `git`, through its global options to its subcommand.
 *
 * Anchored to a command boundary — start of input, a newline, `;`, `&&`, `||`,
 * a pipe or an opening `(`, then optional space and an optional `env` — so a
 * path that merely contains the letters cannot match, while the compound forms
 * this repo actually writes still do.
 */
const GIT = String.raw`(?:^|[;&|\n(])\s*(?:env\s+)?git${GIT_OPTIONS}\s+`;

/** `git add` (or `git stage`) over the whole tree, in the spellings git accepts. */
const ADD_ALL = new RegExp(
  `${GIT}(?:add|stage)\\s+(?:--\\s+)?(?:-A\\b|--all\\b|-u\\b|--update\\b|(?::\\/|\\*|\\.\\/?)(?=\\s|$|[;&|)]))`,
);

/** `git commit`, in any of its forms, including a compound one. */
const COMMIT = new RegExp(`${GIT}commit\\b`);

/**
 * `git push`, capturing its arguments up to the next command boundary.
 *
 * The capture is what decides whether `main` is the destination, so it must
 * stop where the push does: `git push origin feat/x && echo main` pushes
 * `feat/x`, and a tail read to end of line would find the word anyway.
 */
const PUSH = new RegExp(`${GIT}push\\b([^;&|\\n)]*)`);

/** `git worktree remove`, capturing its arguments up to the command boundary. */
const WORKTREE_REMOVE = new RegExp(`${GIT}worktree\\s+remove\\b([^;&|\\n)]*)`);

/**
 * The global options of one `git` command, isolated from its arguments.
 *
 * `effectiveCwd` reads `-C` out of this and NEVER out of the whole segment:
 * `git commit -m "we stopped using -C /tmp"` carries the option's spelling in
 * a message, and resolving it would send the branch reader somewhere that does
 * not exist — where it fails open, and a commit onto `main` goes through. The
 * guard would have been weakened by the change meant to repair it.
 */
const GIT_PREFIX = new RegExp(`^git(${GIT_OPTIONS})\\s`);

/** The branch that is not a working surface. */
const PROTECTED = new Set(['main']);

/**
 * The base a feature branch is born from, and so the base its work is measured
 * against. Since 2026-09-24 this checkout integrates and publishes on one
 * branch — `dev` was renamed to `main` on GitHub — so the base a branch is
 * measured against and the ref a publish moves are the same name, which is why
 * the constant above holds it too. Same reasoning, same constant, as
 * `check-brief-present.mjs`.
 */
const BASE = 'main';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  try {
    const data = raw ? JSON.parse(raw) : {};
    if (data.hook_event_name !== 'PreToolUse') return quiet();
    if (data.tool_name !== 'Bash' && data.tool_name !== 'PowerShell') return quiet();
    const command = String(data.tool_input?.command ?? '');
    if (!governs(effectiveCwd(command, data.cwd))) return quiet();
    const verdict = judge(command, data.cwd);
    return verdict ? deny(verdict) : quiet();
  } catch {
    quiet();
  }
});

/**
 * The whole decision, as a pure function of the command and the directory.
 *
 * Exported so `git-guard.spec.ts` can put a command in and read a verdict out,
 * rather than spawning a process and parsing its stdout. Returns the refusal
 * reason, or `null` to allow.
 *
 * `branchOf` is injected for the same reason. Reading the real branch would
 * make the commit cases depend on whatever `C:\design-ops` happens to have
 * checked out — a test that passes or fails on another session's state, which
 * is the failure `vite.config.ts` already excludes `.claude/` to avoid.
 */
function judge(
  command,
  cwd,
  branchOf = currentBranch,
  stateOf = briefState,
  proofOf = gateProof,
  livingOf = livingProcesses,
) {
  const dir = effectiveCwd(command, cwd);

  if (ADD_ALL.test(command) && !inWorktree(dir)) {
    return (
      'Refused by scripts/git-guard.cjs: name the files you commit, ' +
      '`git add <path>`. This checkout is shared with other sessions and a ' +
      'whole-tree add takes their unfinished work with yours — measured ' +
      '2026-09-07, and it reached main under an unrelated message.'
    );
  }

  if (COMMIT.test(command)) {
    const branch = branchOf(dir);
    if (branch && PROTECTED.has(branch)) {
      return (
        `Refused by scripts/git-guard.cjs: this commit would land on ` +
        `\`${branch}\`, which is not a working surface. Isolate first — ` +
        `\`git switch -c feat/<topic>\` — then commit. Merging INTO ${branch} ` +
        `is a different action and is not blocked.`
      );
    }

    /*
     * The brief rule, third and last, and it runs only once the branch has
     * survived the rule above — a commit on `main` is already refused for a
     * different reason and never reaches here.
     */
    const state = stateOf(dir);
    if (state && !state.inProgress && state.work > 0 && state.briefs === 0) {
      return (
        `Refused by scripts/git-guard.cjs: ${state.work} work file(s) on this ` +
        `branch and no brief. Write the approved execution prompt to ` +
        `briefs/YYYY-MM-DD-<slug>.md, from briefs/TEMPLATE.md, then commit. ` +
        `A brief left in the chat is lost to the next session.`
      );
    }
  }

  /*
   * The push rule runs last so a commit problem, which comes earlier in time,
   * is the one reported when a compound command carries both.
   */
  const push = PUSH.exec(command);
  const source = push ? mainSource(push[1], branchOf(dir)) : null;
  const proof = source ? proofOf(dir, source) : null;
  if (proof) {
    const short = (sha) => String(sha).slice(0, 7);

    if (!proof.receipt) {
      return (
        'Refused by scripts/git-guard.cjs: this push updates `main` and ' +
        'nothing has measured this tree. Run `pnpm gate`, then push; see ' +
        'docs/foundation/checks.md.'
      );
    }
    if (proof.receipt.head !== proof.head) {
      return (
        `Refused by scripts/git-guard.cjs: the gate receipt measured ` +
        `${short(proof.receipt.head)}, and the push sends ${source} at ${short(proof.head)}. A ` +
        `merge moves HEAD, so the gate runs after it and before the push. ` +
        `Run \`pnpm gate\` again.`
      );
    }
    if (!proof.receipt.clean) {
      return (
        'Refused by scripts/git-guard.cjs: the gate receipt was taken over a ' +
        'dirty tree, so it measured something that was never committed. ' +
        'Commit or set the changes aside, run `pnpm gate`, then push.'
      );
    }
  }

  const remove = WORKTREE_REMOVE.exec(command);
  const target = remove && worktreeTarget(remove[1], dir);
  const living = target ? livingOf(target) : 0;
  if (living > 0) {
    const name = target.split(/[\\/]/).filter(Boolean).pop();
    return (
      `Refused by scripts/git-guard.cjs: ${living} process(es) still run out ` +
      `of ${name}, and removing the folder leaves them running — 82 orphaned ` +
      `node processes on 2026-09-25. Run \`pnpm worktree:close ${name}\` from ` +
      `the main checkout; it stops them first.`
    );
  }

  return null;
}

/**
 * The path a `git worktree remove` names, resolved against the directory the
 * command runs in. `null` when there is no positional argument to read.
 */
function worktreeTarget(tail, dir) {
  const positional = String(tail ?? '')
    .trim()
    .split(/\s+/)
    .filter((t) => t && !t.startsWith('-'));
  if (positional.length === 0) return null;
  return resolve(dir, positional[0].replace(/^(['"])(.*)\1$/, '$2'));
}

/**
 * How many processes a worktree still has, by `worktree-processes.cjs`.
 *
 * FAILS OPEN, like every other reader here: a process table that could not be
 * read is not evidence that something is running, and refusing on it would
 * stop every removal on a machine where the listing breaks.
 */
function livingProcesses(path) {
  try {
    return worktreeProcesses.pidsToStop(worktreeProcesses.list(), path).length;
  } catch {
    return 0;
  }
}

/**
 * The local ref whose commit this push would put on `main`, or `null` when the
 * push does not move `main`.
 *
 * Reads the destination of each refspec — the half after the colon, which is
 * the ref that moves — so `feat/x:main` moves `main` and `main:scratch` does
 * not. With no refspec at all the pushed ref is the checked-out branch, which
 * is why the branch is consulted for a bare `git push`; `HEAD` and `@` name
 * that same branch. The SOURCE is what the receipt is compared to, not HEAD:
 * from a feature branch, `git push origin main` sends local `main`, and a
 * receipt for the feature branch's commit proves nothing about it. `--all`
 * and `--mirror` send local `main` too.
 *
 * A `+` or a leading `:` is stripped rather than read: a force-push to `main`
 * and a DELETE of `main` both move it, and neither is a publish anybody should
 * reach by typing past this guard. A delete has no source, so HEAD stands in.
 *
 * FAILS OPEN on an unreadable branch, like every other reader in this file. A
 * bare `git push` with no branch answer is not evidence that `main` is the
 * destination, and refusing on an unanswered question stops ordinary work.
 */
function mainSource(tail, branch) {
  const tokens = String(tail ?? '').trim().split(/\s+/).filter(Boolean);
  if (tokens.some((t) => t === '--all' || t === '--mirror')) return 'main';

  const positional = tokens.filter((t) => !t.startsWith('-'));
  const refspecs = positional.slice(1);
  if (refspecs.length === 0) return branch === 'main' ? 'HEAD' : null;

  for (const spec of refspecs) {
    const bare = spec.replace(/^\+/, '');
    const colon = bare.indexOf(':');
    const src = colon === -1 ? bare : bare.slice(0, colon);
    const dst = colon === -1 ? bare : bare.slice(colon + 1);
    const moved = dst === 'HEAD' || dst === '@' ? branch : dst.replace(/^refs\/heads\//, '');
    if (moved === 'main') return src || 'HEAD';
  }
  return null;
}

/**
 * What the gate has proven about the commit a push would send: that commit,
 * read from `ref`, and the receipt that measured it. `null` when git did not
 * answer for the ref.
 *
 * That `null` is the fail-open case and the only one here — with no commit
 * there is no question to ask. A readable commit with no receipt beside it is
 * the opposite: it is exactly the evidence the rule is looking for, and it
 * refuses.
 */
function gateProof(cwd, ref = 'HEAD') {
  const head = receipt.head(cwd, ref);
  return head ? { head, receipt: receipt.read(cwd) } : null;
}

/**
 * Whether the repository at `cwd` is one whose rules this guard enforces —
 * recognised by carrying `scripts/git-guard.cjs` at its top level.
 *
 * The hook is registered per project, but the shell it watches is not: a
 * session here that runs git in a scratch repository was held to this
 * repository's brief rule there. Outside, and where git does not answer, the
 * guard stays quiet.
 */
function governs(cwd) {
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: cwd || process.cwd(),
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return existsSync(join(top, 'scripts', 'git-guard.cjs'));
  } catch {
    return false;
  }
}

/**
 * The directory the git command will actually run in.
 *
 * The hook payload's `cwd` is the SESSION's directory and not the shell's, so
 * a session that reached a worktree with `cd <path> && git commit` was judged
 * against the branch it left behind — on `main`, a refusal of a commit that was
 * correct, and `git add -A` refused in the one place it is the right form.
 * Both readers below take a directory, so resolving it once here is the whole
 * repair.
 *
 * Segments are walked in order and `cd` accumulates, stopping at the first
 * `git` command — whose own `-C` is read there, since that moves the command
 * without moving the shell. A `cd` written after the git call runs after it
 * and cannot move it. A relative target resolves against what the earlier
 * segments left, which is what a shell does.
 *
 * A target this cannot resolve — `cd` with no argument, `cd -`, a `~` or a
 * variable — returns the directory reached so far, which is what this file did
 * before. That is not failing open in the sense `currentBranch` means it: an
 * unresolved `cd` leaves the guard exactly as strict as it was, never quieter.
 */
function effectiveCwd(command, cwd) {
  let dir = cwd || process.cwd();
  for (const segment of String(command ?? '').split(/&&|\|\||[;|\n]/)) {
    const part = segment.trim().replace(/^\(\s*/, '').replace(/^env\s+/, '');
    if (/^git\b/.test(part)) {
      /* `-C` moves this one command and git applies several left to right, so
       * they accumulate here the same way the `cd`s above do. */
      const options = GIT_PREFIX.exec(part);
      for (const [, target] of (options ? options[1] : '').matchAll(/(?:^|\s)-C\s+("[^"]*"|'[^']*'|\S+)/g)) {
        const path = target.replace(/^(['"])(.*)\1$/, '$2');
        if (/^[~$]/.test(path)) return dir;
        dir = resolve(dir, drivePath(path));
      }
      break;
    }
    const cd = /^cd\s+(.+)$/.exec(part);
    if (!cd) continue;
    const target = cd[1].trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!target || target === '-' || /^[~$]/.test(target)) return dir;
    dir = resolve(dir, drivePath(target));
  }
  return dir;
}

/**
 * Git Bash's spelling of a Windows drive, `/c/x`, as the drive, `C:/x`. Node
 * on Windows resolves `/c/x` to `C:\c\x`, where there is no repository and
 * every reader fails open — so `cd /c/... && git commit` went unjudged.
 */
function drivePath(path) {
  if (process.platform !== 'win32') return path;
  return path.replace(/^\/([a-zA-Z])\//, (_, d) => `${d.toUpperCase()}:/`);
}

/**
 * Whether this session is isolated in a worktree.
 *
 * `git add -A` is the CORRECT form there and must not be refused. Inside a
 * worktree the harness rejects the compound `test … && git commit` idiom
 * CLAUDE.md prescribes, so the commit is written as three plain commands — and
 * the risk the rule exists to prevent is already closed by git itself, which
 * pins a worktree to its branch and refuses to check that branch out anywhere
 * else. The guard is not being relaxed here; the guarantee has another source.
 */
function inWorktree(cwd) {
  return /[\\/]\.claude[\\/]worktrees[\\/]/i.test(String(cwd ?? ''));
}

/**
 * The checked-out branch, or `null` when it cannot be read.
 *
 * FAILS OPEN, which is the opposite of what this repo asks of a check, and the
 * difference is that a check reports while a hook BLOCKS. With no branch there
 * is no evidence of a violation, and refusing on an unanswered question would
 * stop ordinary work over a git that did not reply. The case is narrow: inside
 * a repository git answers this.
 */
function currentBranch(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: cwd || process.cwd(),
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * What this branch is carrying: how many work files, how many briefs, and
 * whether git is mid-operation. `null` when it could not be measured.
 *
 * The definition of "carrying" is `check-brief-present.mjs`'s, and both halves
 * are load-bearing: the committed diff against the base, UNION the working
 * tree. Leaving the working tree out was that check's first defect — run before
 * the first commit, which is exactly when a guard on `git commit` asks, a
 * branch full of unstaged edits reports nothing changed. Here it would mean the
 * brief you just wrote and have not staged does not count.
 *
 * `inProgress` is why a merge is not an accusation. A conflicted merge fills
 * the working tree with files that look exactly like uncommitted work, so
 * `git commit` completing that merge would be refused for carrying work it did
 * not write — and CLAUDE.md asks for merges into a branch, not against them.
 * The markers are files in the git directory, which is the reliable test: a
 * rebase is a DIRECTORY (`rebase-merge` or `rebase-apply`) and leaves no ref
 * of its own in every state.
 *
 * FAILS OPEN, like `currentBranch` above and for the same reason — a check
 * reports, a hook blocks. No measurement is not evidence of a violation.
 */
function briefState(cwd) {
  const run = (...args) =>
    execFileSync('git', args, {
      cwd: cwd || process.cwd(),
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });

  try {
    const gitDir = run('rev-parse', '--absolute-git-dir').trim();
    const inProgress = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply'].some(
      (marker) => existsSync(join(gitDir, marker)),
    );

    const committed = run('diff', '--name-only', `${BASE}...HEAD`).split('\n').filter(Boolean);
    /*
     * `--porcelain` is the stable form: the path is everything past the two
     * status columns and their space, and a rename prints `old -> new`, where
     * the new name is the one that matters.
     *
     * `-uall` is not a refinement. Without it git collapses an untracked
     * DIRECTORY into one entry — a brief written into a `briefs/` that this
     * branch created prints as `?? briefs/`, which does not end in `.md`, so it
     * counts as work and the guard refuses the commit FOR the file that was
     * supposed to allow it. Caught by the fixture below rather than by reading.
     */
    const working = run('status', '--porcelain', '-uall')
      .split('\n')
      .filter(Boolean)
      .map((line) => line.slice(3).split(' -> ').pop().replace(/^"|"$/g, ''));

    /*
     * Owes no brief, by design: the `feedback` and `setup` skills commit these
     * on their own. Mirrored in `check-brief-present.mjs` so the two agree.
     */
    const exempt = (f) =>
      f.startsWith('feedback/') || f === 'docs/foundation/people.md' || f === 'docs/foundation/workspace-wiring.md';
    const changed = [...new Set([...committed, ...working])].filter((f) => !exempt(f));
    const briefs = changed.filter((f) => f.startsWith('briefs/') && f.endsWith('.md'));
    return { work: changed.length - briefs.length, briefs: briefs.length, inProgress };
  } catch {
    return null;
  }
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  );
}

function quiet() {
  process.stdout.write('');
}

module.exports = { judge, briefState };
