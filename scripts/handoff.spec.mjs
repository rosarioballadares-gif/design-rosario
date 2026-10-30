/**
 * `pnpm handoff`, held to the facts it may not get wrong: which brief it names,
 * whether it sends the next session into a worktree, and a "what is left" it
 * never invents. A wrong one is pasted into a fresh session that has no other
 * way to know.
 */
import { describe, expect, it } from 'vitest';

import { CAP, capped, changedBriefs, clipped, pickBrief, relayPrompt, SUBJECT, titleOf, worktreeOf } from './handoff.mjs';

describe('pickBrief', () => {
  it('takes the newest date prefix, whatever the order it arrives in', () => {
    expect(pickBrief(['briefs/2026-10-08-b.md', 'briefs/2026-10-09-a.md', 'briefs/2026-09-30-z.md'])).toBe('briefs/2026-10-09-a.md');
  });

  it('breaks a tie on the date in name order, the last winning', () => {
    expect(pickBrief(['briefs/2026-10-08-zeta.md', 'briefs/2026-10-08-alpha.md'])).toBe('briefs/2026-10-08-zeta.md');
  });

  it('is null for none', () => {
    expect(pickBrief([])).toBeNull();
  });
});

describe('changedBriefs', () => {
  it('reads the committed diff and the porcelain, untracked files included', () => {
    const committed = 'briefs/2026-10-01-old.md\n';
    const porcelain = ' M briefs/2026-10-02-edited.md\n?? briefs/2026-10-03-new.md\n';
    expect(changedBriefs(committed, porcelain)).toEqual(['briefs/2026-10-01-old.md', 'briefs/2026-10-02-edited.md', 'briefs/2026-10-03-new.md']);
  });

  it('ignores the template, the README, a deletion and anything outside briefs/', () => {
    const committed = 'briefs/TEMPLATE.md\nbriefs/README.md\nscripts/handoff.mjs\nbriefs/archive/2026-10-09-x.md\n';
    const porcelain = ' D briefs/2026-10-09-gone.md\nD  briefs/2026-10-09-staged-gone.md\n';
    expect(changedBriefs(committed, porcelain)).toEqual([]);
  });

  it('takes the new name of a rename, once even when both sources carry it', () => {
    expect(changedBriefs('briefs/2026-10-04-b.md', 'R  briefs/2026-10-04-a.md -> briefs/2026-10-04-b.md')).toEqual(['briefs/2026-10-04-b.md']);
  });
});

describe('worktreeOf', () => {
  it('finds the worktree in a Windows path, with either separator', () => {
    expect(worktreeOf('C:\\repo\\.claude\\worktrees\\tokens')).toEqual({ root: 'C:\\repo', path: 'C:\\repo\\.claude\\worktrees\\tokens', name: 'tokens' });
    expect(worktreeOf('C:/repo/.claude/worktrees/tokens')).toEqual({ root: 'C:/repo', path: 'C:/repo/.claude/worktrees/tokens', name: 'tokens' });
  });

  it('finds it in a POSIX path, and stops at its name', () => {
    expect(worktreeOf('/home/ci/repo/.claude/worktrees/tokens/src')).toEqual({ root: '/home/ci/repo', path: '/home/ci/repo/.claude/worktrees/tokens', name: 'tokens' });
  });

  it('is null in a main checkout', () => {
    expect(worktreeOf('C:\\repo')).toBeNull();
    expect(worktreeOf('/home/ci/repo')).toBeNull();
  });
});

describe('titleOf', () => {
  it('reads the `# Brief:` line, and null without one', () => {
    expect(titleOf('# Brief: director mode\n\n## Objective\n')).toBe('director mode');
    expect(titleOf('# Something else\n')).toBeNull();
  });
});

describe('relayPrompt', () => {
  const FACTS = {
    repo: 'C:/repo',
    branch: 'feat/x',
    worktree: null,
    base: 'main',
    brief: 'briefs/2026-10-08-x.md',
    title: 'the x brief',
    commits: ['a4d1248 docs: two', '0ab942c docs: one'],
    dirty: [' M scripts/x.mjs'],
    left: 'Task 3, the notice',
  };

  it('opens with what to do, then the facts, and ends on what is left', () => {
    const text = relayPrompt(FACTS).split('\n');
    expect(text[0]).toMatch(/^Relay prompt — \/clear, then paste/);
    expect(text[2]).toBe('Continue the work in C:/repo on feat/x. Read briefs/2026-10-08-x.md first.');
    expect(text).toContain('Brief: the x brief');
    expect(text).toContain('Commits since main (2):');
    expect(text).toContain('  a4d1248 docs: two');
    expect(text).toContain('   M scripts/x.mjs');
    expect(text.at(-1)).toBe('Left: Task 3, the notice');
    expect(text.join('\n').includes('\u001b')).toBe(false);
  });

  it('says there is a gap, and invents nothing, with no argument', () => {
    const text = relayPrompt({ ...FACTS, left: null });
    expect(text).not.toMatch(/^Left:/m);
    expect(text.split('\n').at(-1)).toMatch(/^GAP: .*did not say what is left.*brief's Tasks against the commits/);
  });

  it('says no brief is on the branch', () => {
    const text = relayPrompt({ ...FACTS, brief: null, title: null });
    expect(text).toMatch(/on feat\/x\. No brief is on this branch\.$/m);
    expect(text).not.toMatch(/^Brief:/m);
  });

  it('sends the next session into the worktree, and the old one out of it first', () => {
    const tree = worktreeOf('C:/repo/.claude/worktrees/x');
    const text = relayPrompt({ ...FACTS, repo: tree.path, worktree: tree });
    expect(text.split('\n')[0]).toMatch(/ExitWorktree keep/);
    expect(text).toMatch(/^Continue the work in C:\/repo on feat\/x\./m);
    expect(text).toMatch(/^Before editing, enter the worktree with EnterWorktree, path C:\/repo\/\.claude\/worktrees\/x\.$/m);
  });

  it('caps the commits and the uncommitted files, saying how many more', () => {
    const many = Array.from({ length: CAP + 3 }, (_, i) => `${String(i).padStart(7, '0')} commit ${i}`);
    const text = relayPrompt({ ...FACTS, commits: many, dirty: many });
    expect(text).toMatch(new RegExp(`^Commits since main \\(${CAP + 3}\\):$`, 'm'));
    expect(text.match(/^ {2}\+3 more$/gm)).toHaveLength(2);
    expect(text).not.toMatch(new RegExp(`commit ${CAP}$`, 'm'));
    expect(capped(['a', 'b'], 2)).toEqual(['a', 'b']);
  });

  it('cuts a long commit line at SUBJECT characters, and leaves a short one whole', () => {
    const long = `62d4297 feat(scripts): ${'x'.repeat(900)}`;
    const text = relayPrompt({ ...FACTS, commits: [long, '0ab942c docs: one'] }).split('\n');
    const cut = text.find((l) => l.startsWith('  62d4297'));
    expect(cut).toHaveLength(2 + SUBJECT);
    expect(cut.endsWith('…')).toBe(true);
    expect(text).toContain('  0ab942c docs: one');
    expect(clipped('a'.repeat(SUBJECT))).toBe('a'.repeat(SUBJECT));
  });

  it('says none, and says when no main resolves rather than guessing', () => {
    const text = relayPrompt({ ...FACTS, base: null, commits: null, dirty: [], brief: null, title: null });
    expect(text).toMatch(/^Commits since main: unknown, neither main nor origin\/main resolves here\.$/m);
    expect(text).toMatch(/only uncommitted files were read/);
    expect(text).toMatch(/^Uncommitted: none$/m);
  });
});
