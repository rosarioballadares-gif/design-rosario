/**
 * Close a worktree: stop what runs out of it, then remove it and its branch.
 *
 *   pnpm worktree:close <name | path>
 *
 * WHY THE ORDER. Processes first, folder second. A folder removed under a
 * running vite takes nothing with it, and the server keeps its port and its
 * memory with no path left to find it by — which is how 82 of them piled up on
 * one machine by 2026-09-25. The why of the matching is in
 * `worktree-processes.cjs`.
 *
 * WHAT IT REFUSES. A worktree that still has processes after they were
 * stopped, and a run from INSIDE the worktree — Windows will not delete the
 * directory a process is standing in, and the run would fail halfway, after
 * the servers were stopped and before anything was removed. The same for any
 * other process standing in it, the agent session included: nothing here can
 * stop it, so a rename probe looks for it before git is asked to remove a thing.
 *
 * WHAT IT LEAVES TO GIT. A dirty tree: `git worktree remove` refuses it without
 * `--force`, and this never passes `--force`. An unmerged branch: `git branch
 * -d` keeps it, and this says so rather than reaching for `-D`.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

import { describeWait, waitsOn } from './peers.mjs';
import { readWaits, waitsDir } from './wait.mjs';

const require = createRequire(import.meta.url);
const processes = require('./worktree-processes.cjs');

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const arg = process.argv[2];
console.log('worktree:close — stops the node process trees that name a worktree, then removes it and its branch.');
console.log('  never passes --force and never deletes an unmerged branch.\n');

if (!arg) {
  console.log('FAIL — name the worktree: pnpm worktree:close <name | path>');
  process.exit(1);
}

const root = dirname(resolve(git('rev-parse', '--path-format=absolute', '--git-common-dir')));
const path = arg.includes('/') || arg.includes('\\') ? resolve(arg) : join(root, '.claude', 'worktrees', arg);

const entries = git('-C', root, 'worktree', 'list', '--porcelain').split(/\n\n+/);
const entry = entries.find((e) => {
  const line = e.split('\n').find((l) => l.startsWith('worktree '));
  return line && resolve(line.slice('worktree '.length)).toLowerCase() === path.toLowerCase();
});
if (!entry) {
  console.log(`FAIL — ${path} is not a worktree of ${root}.`);
  process.exit(1);
}
if (resolve(path).toLowerCase() === resolve(root).toLowerCase()) {
  console.log('FAIL — that is the main checkout, not a worktree.');
  process.exit(1);
}
const inside = relative(path, process.cwd());
if (!inside.startsWith('..') && !isAbsolute(inside)) {
  console.log(`FAIL — this runs from inside ${path}, which cannot be removed while it is the working directory. Run it from ${root}.`);
  process.exit(1);
}
const branch = (entry.split('\n').find((l) => l.startsWith('branch ')) ?? '').replace(/^branch refs\/heads\//, '') || null;

/* Who waits on this branch going or this tree coming clean. Their `pnpm wait`
 * fires on its own, so the closer messages them only what it cannot see. */
const waiters = waitsOn({ path, branch }, readWaits(waitsDir(root)));
console.log(
  waiters.length
    ? `waits: ${waiters.map((w) => describeWait(w)).join('; ')} — each fires on its own; message them only what it cannot see: what landed, what changed.`
    : 'waits: nobody waits on this tree or its branch.',
);

const pids = processes.pidsToStop(processes.list(), path);
const stopped = processes.stop(pids);
console.log(`processes: ${stopped.length} stopped of ${pids.length} found.`);

let left = [];
for (let tries = 0; tries < 5; tries++) {
  left = processes.pidsToStop(processes.list(), path);
  if (left.length === 0) break;
  processes.stop(left);
  await new Promise((r) => setTimeout(r, 400));
}
if (left.length) {
  console.log(`FAIL — ${left.length} process(es) still name ${path}: ${left.join(', ')}. Nothing was removed.`);
  process.exit(1);
}

let busy;
try {
  busy = processes.held(path);
} catch (e) {
  console.log(`FAIL — ${e.message}. Nothing was removed.`);
  process.exit(1);
}
if (busy) {
  /* Measured 2026-10-09: EBUSY for a working directory inside the tree, EPERM
   * for the editor's TypeScript server watching its node_modules. */
  const who =
    busy === 'EPERM'
      ? 'an editor or language server with files open inside it: close its tabs or restart its TypeScript server'
      : 'an agent session or shell whose working directory it is: ExitWorktree or cd out of it';
  console.log(`FAIL — something that is not a node process holds ${path} (${busy}), most often ${who}, then rerun. Nothing was removed.`);
  process.exit(1);
}

try {
  git('-C', root, 'worktree', 'unlock', path);
} catch {
  /* not locked */
}
/* `core.longpaths` on the call, not in a config: without it git for Windows
 * fails on any path past 260 characters, which `node_modules/.pnpm` always
 * holds, with "Filename too long" and the folder left half deleted. Measured
 * 2026-10-01 on git 2.54: a 513-character path, refused without it, removed
 * with it. A config is per machine and untracked; this travels with the repo. */
try {
  git('-c', 'core.longpaths=true', '-C', root, 'worktree', 'remove', path);
  console.log(`worktree: removed ${path}`);
} catch (e) {
  console.log(`FAIL — git refused to remove ${path}:\n${String(e.stderr ?? e.message).trim()}`);
  process.exit(1);
}

/* On Windows git leaves `node_modules/.pnpm` behind as directories and pnpm's
 * junctions — measured 2026-09-25, 554 links and not one file. Deleted only
 * when no regular file is left; `rmSync` unlinks a junction, never follows it
 * into the store. */
const hasFile = (dir) =>
  readdirSync(dir, { withFileTypes: true }).some((d) => d.isFile() || (d.isDirectory() && hasFile(join(dir, d.name))));
let kept = null;
try {
  if (existsSync(path) && !hasFile(path)) {
    rmSync(path, { recursive: true, force: true });
    console.log('worktree: deleted the empty folder git left behind');
  }
} catch (e) {
  kept = e.code ?? String(e);
  console.log(`worktree: KEPT ${path} (${kept}) — delete it by hand once nothing stands in it.`);
}

/* A merge made inside the tree leaves it on main, which `-d` counts as merged
 * once pushed: deleted that way on 2026-09-30. */
if (branch === 'main') {
  console.log('branch: KEPT main — the integration branch is never deleted here.');
} else if (branch) {
  try {
    git('-C', root, 'branch', '-d', branch);
    console.log(`branch: deleted ${branch}`);
  } catch {
    console.log(`branch: KEPT ${branch} — not merged. Delete it by hand if the work is abandoned.`);
  }
}

if (kept) {
  console.log(`\nFAIL — ${arg} closed except its folder, kept above.`);
  process.exit(1);
}
console.log(`\nok — ${arg} closed, no process left naming it.`);
