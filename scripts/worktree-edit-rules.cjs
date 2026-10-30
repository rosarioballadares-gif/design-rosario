'use strict';
/*
 * Whether an edit made from inside a worktree lands outside it.
 *
 * A session in `.claude/worktrees/<name>` that edits the main checkout, or a
 * sibling worktree, writes into somebody else's work while its own branch
 * looks clean — the collision "Go + worktree" exists to remove. The rule:
 * from a worktree, a target under the repository root but outside that
 * worktree is refused. The worktree's own files pass, and so does anything
 * outside the repository (the memory directory, a scratchpad, the temp dir).
 * Outside a worktree the rule is inert.
 *
 * Kept apart from `worktree-edit-guard.cjs` so the decision has a spec and
 * the hook stays a reader of stdin.
 *
 * Ported from Ian Rueff's user-level `guard-worktree-edits.cjs`, which every
 * session of his carried and nobody who cloned this repository did.
 *
 * Brief: briefs/2026-10-08-user-hooks.md
 */
const path = require('node:path');

const MARKER = '/.claude/worktrees/';

/**
 * A path as the rule compares it: absolute, forward slashes, lower case, no
 * trailing slash. Done with `path.posix` on slashes the rule converts itself,
 * never with the platform's `path`: on Linux `node:path` takes `C:\\repo` for
 * a relative name, which failed CI on 2026-10-08 while every run on Windows
 * passed.
 */
function normalise(p, cwd) {
  const slashed = (s) => String(s).replace(/\\/g, '/');
  const isAbsolute = (s) => s.startsWith('/') || /^[a-z]:\//i.test(s);
  const target = slashed(p);
  const abs = isAbsolute(target) ? target : `${slashed(cwd)}/${target}`;
  return path.posix.normalize(abs).replace(/\/+$/, '').toLowerCase();
}

/**
 * Null when the edit may go ahead, or the reason it may not.
 *
 * `cwd` is the session's working directory from the hook payload, `target`
 * the file the tool would write.
 */
function refusal(cwd, target) {
  if (!cwd || !target) return null;
  const cwdN = normalise(cwd, cwd);
  const at = cwdN.indexOf(MARKER);
  if (at === -1) return null;

  const mainRoot = cwdN.slice(0, at);
  const name = cwdN.slice(at + MARKER.length).split('/')[0];
  const own = mainRoot + MARKER + name;
  const t = normalise(target, cwd);
  const under = (p, root) => p === root || p.startsWith(root + '/');

  if (under(t, own) || !under(t, mainRoot)) return null;
  return (
    `Refused by scripts/worktree-edit-guard.cjs: ${target} is outside the worktree "${name}" ` +
    `this session works in, in the main checkout or another worktree. Edit within ` +
    `${own}, or make that change from a session in ${mainRoot}.`
  );
}

module.exports = { refusal };
