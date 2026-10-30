#!/usr/bin/env node
/**
 * The receipt `pnpm gate` leaves behind, and the only thing that reads it.
 *
 * WHY A FILE AND NOT A FLAG. `git-guard.cjs` has to answer, at the moment a
 * push is typed, whether the gate has measured THIS tree. That is a fact about
 * a past run in a different process, so it has to have been written down. It is
 * keyed on the commit SHA because a commit is what a push actually sends — a
 * receipt from a different HEAD measured a different publish.
 *
 * WHY CJS, IN A DIRECTORY OF `.mjs` SCRIPTS. `git-guard.cjs` is a `PreToolUse`
 * hook and CommonJS; `gate.mjs` is ESM and imports this as a default export,
 * which Node does for any CommonJS module without depending on how the named
 * exports are spelled. One definition of the path and the shape, read by both.
 *
 * MACHINE-LOCAL, and gitignored. It is evidence about one checkout and is never
 * shared — a fresh clone or a new worktree starts with none, which is the
 * correct starting state rather than a missing one.
 */
'use strict';

const { execFileSync } = require('node:child_process');
const { existsSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

/** Sits at the top of the working tree, beside `package.json`. */
const RECEIPT = '.gate-receipt.json';

/**
 * Run git in `cwd` and return its stdout trimmed, or `null`.
 *
 * Shared by every reader below so they fail the same way: a git that does not
 * answer produces `null` rather than a throw, and the caller decides what an
 * unanswered question means.
 */
function git(cwd, args) {
  try {
    return execFileSync('git', args, {
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
 * Where the receipt lives for this checkout, or `null`.
 *
 * `--show-toplevel` rather than `cwd` because a command can be typed from a
 * subdirectory, and in a worktree it answers with the worktree root — so each
 * checkout carries its own receipt, which is what "measured this tree" means.
 */
function receiptPath(cwd) {
  const top = git(cwd, ['rev-parse', '--show-toplevel']);
  return top ? join(top, RECEIPT) : null;
}

/** The commit `ref` names — HEAD unless a push sends another — or `null`. */
function head(cwd, ref = 'HEAD') {
  return git(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
}

/**
 * Whether the tree carries nothing uncommitted, or `null`.
 *
 * `-uall` for the same reason `briefState` needs it next door: without it an
 * untracked directory collapses into one entry, and here that would let a tree
 * full of unversioned work report as clean.
 */
function clean(cwd) {
  const status = git(cwd, ['status', '--porcelain', '-uall']);
  return status === null ? null : status === '';
}

/**
 * The receipt as it was written, or `null` when there is none or it is not
 * readable.
 *
 * A corrupt receipt reads as no receipt. The two mean the same thing to the
 * guard — nothing has proven this tree — and distinguishing them would only
 * add a branch nobody can act on differently.
 */
function read(cwd) {
  const path = receiptPath(cwd);
  if (!path || !existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return parsed && typeof parsed.head === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Record that `checks` passed over the tree `head`/`clean` describe.
 *
 * The caller passes what it measured BEFORE running, not after: `pnpm build`
 * and `pnpm build:storybook` both leave output behind, so a tree read at the
 * end is dirty for reasons that have nothing to do with what was measured.
 */
function write(cwd, { head: sha, clean: wasClean, checks }) {
  const path = receiptPath(cwd);
  if (!path || !sha) return null;
  const receipt = { head: sha, clean: wasClean === true, at: new Date().toISOString(), checks };
  writeFileSync(path, JSON.stringify(receipt, null, 2) + '\n');
  return path;
}

/**
 * Delete the receipt, and say whether one was there.
 *
 * A failing gate calls this. Leaving the previous run's receipt in place is the
 * one outcome that would be worse than having none: the guard would read a
 * green verdict over a tree that had just failed, and the push it let through
 * is exactly the one this is here to stop.
 */
function remove(cwd) {
  const path = receiptPath(cwd);
  if (!path || !existsSync(path)) return false;
  rmSync(path, { force: true });
  return true;
}

module.exports = { RECEIPT, receiptPath, head, clean, read, write, remove };
