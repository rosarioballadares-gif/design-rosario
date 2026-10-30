/**
 * The worktree edit guard, held to both of its failures: refusing an edit in
 * the worktree's own files would stop every session that chose "Go +
 * worktree", and letting one into the main checkout is the collision the
 * option exists to remove. Both are silent until somebody's work is lost.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { refusal } from './worktree-edit-rules.cjs';

const HOOK = fileURLToPath(new URL('./worktree-edit-guard.cjs', import.meta.url));
const WT = 'C:\\repo\\.claude\\worktrees\\tokens';

describe('refusal', () => {
  it('lets a worktree edit its own files, by absolute or relative path', () => {
    expect(refusal(WT, 'C:\\repo\\.claude\\worktrees\\tokens\\src\\ds\\index.ts')).toBeNull();
    expect(refusal(WT, 'src/ds/index.ts')).toBeNull();
  });

  it('refuses the main checkout from a worktree', () => {
    expect(refusal(WT, 'C:\\repo\\src\\ds\\index.ts')).toMatch(/outside the worktree "tokens"/);
  });

  it('refuses a sibling worktree, and a relative path that climbs into main', () => {
    expect(refusal(WT, 'C:\\repo\\.claude\\worktrees\\shell\\x.ts')).not.toBeNull();
    expect(refusal(WT, '..\\..\\..\\CLAUDE.md')).not.toBeNull();
  });

  it('refuses a sibling whose name starts with this one', () => {
    expect(refusal(WT, 'C:\\repo\\.claude\\worktrees\\tokens-2\\x.ts')).not.toBeNull();
  });

  it('lets a worktree write outside the repository', () => {
    expect(refusal(WT, 'C:\\Users\\me\\.claude\\projects\\c--repo\\memory\\MEMORY.md')).toBeNull();
    expect(refusal(WT, 'C:\\Users\\me\\AppData\\Local\\Temp\\scratch\\a.txt')).toBeNull();
  });

  it('is inert outside a worktree, and on a payload with nothing to judge', () => {
    expect(refusal('C:\\repo', 'C:\\repo\\.claude\\worktrees\\tokens\\x.ts')).toBeNull();
    expect(refusal(WT, undefined)).toBeNull();
  });

  it('reads POSIX paths the same way, on any platform', () => {
    const wt = '/home/me/repo/.claude/worktrees/tokens';
    expect(refusal(wt, 'src/ds/index.ts')).toBeNull();
    expect(refusal(wt, '/home/me/repo/CLAUDE.md')).not.toBeNull();
    expect(refusal(wt, '/tmp/scratch/a.txt')).toBeNull();
  });

  it('compares without regard to case or slash direction', () => {
    expect(refusal('c:/REPO/.claude/worktrees/Tokens', 'C:\\repo\\.claude\\worktrees\\tokens\\a.ts')).toBeNull();
  });
});

/** The hook process's stdout for one payload. */
function run(payload) {
  return execFileSync('node', [HOOK], { input: JSON.stringify(payload), encoding: 'utf8' });
}

describe('the hook', () => {
  it('prints a deny for an edit into main from a worktree', () => {
    const out = JSON.parse(run({ cwd: WT, tool_name: 'Edit', tool_input: { file_path: 'C:\\repo\\CLAUDE.md' } }));
    expect(out.hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('prints nothing for an allowed edit, a notebook path included', () => {
    expect(run({ cwd: WT, tool_name: 'NotebookEdit', tool_input: { notebook_path: 'a.ipynb' } })).toBe('');
  });

  it('fails open on a payload it cannot parse', () => {
    expect(execFileSync('node', [HOOK], { input: '{not json', encoding: 'utf8' })).toBe('');
  });
});
