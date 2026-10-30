/**
 * Who works where on this machine: each worktree's branch, its briefs, its
 * dirty files, its dev servers and their ports, the session in it and who
 * waits on it.
 *
 *   pnpm peers            one block per tree
 *   pnpm peers --short    the lines a session start prints
 *
 * DERIVED ON EVERY RUN, NEVER WRITTEN. A board that sessions keep is stale the
 * moment one of them forgets it; git, the process table and the session
 * registry are not.
 *
 * THE SESSION IN A TREE comes from Claude Code's live-session registry,
 * `~/.claude/sessions/<pid>.json`, one file per running session, whose format
 * is its own and liable to change, so it is read softly: `<pid>.json` only,
 * never the `.key` files beside them, and of each only its pid, sessionId, cwd,
 * name, status and updatedAt. A file whose pid no longer runs is a closed
 * session and is ignored. Its name is the one ListAgents prints, never the ones
 * it had before a /clear; its place is the tree its cwd falls in.
 *
 * WHAT IT CANNOT SEE. A crashed session whose pid another process took reads
 * as live. Other machines. A registry it cannot read shows the trees without
 * sessions, and says so.
 */
import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { basename, join, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';
import { alive, git, listening, readWaits, samePath, waitsDir } from './wait.mjs';

const require = createRequire(import.meta.url);
const processes = require('./worktree-processes.cjs');

const MAIN_REF = 'refs/remotes/origin/main';

const lines = (text) => text.split(/\r?\n/).filter((l) => l.trim());
const norm = (path) => String(path).replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase();

/**
 * `git worktree list --porcelain` as `[{ path, head, branch, locked }]`, the main
 * checkout first. `branch` is null on a detached HEAD; `locked` is the reason,
 * '' for a lock with none, null when unlocked.
 */
export function parseWorktrees(text) {
  return text
    .split(/\r?\n\r?\n/)
    .map((block) => {
      const tree = { path: null, head: null, branch: null, locked: null };
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('worktree ')) tree.path = line.slice('worktree '.length);
        else if (line.startsWith('HEAD ')) tree.head = line.slice('HEAD '.length);
        else if (line.startsWith('branch ')) tree.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '');
        else if (line === 'locked' || line.startsWith('locked ')) tree.locked = line.slice('locked '.length);
      }
      return tree;
    })
    .filter((t) => t.path);
}

/** The tree a path is in: the longest tree path it is, or sits under. */
export function treeOf(path, trees) {
  const p = norm(path);
  let best = null;
  for (const t of trees) {
    const at = norm(t.path);
    if ((p === at || p.startsWith(`${at}/`)) && (!best || at.length > norm(best.path).length)) best = t;
  }
  return best;
}

/**
 * Each session in the tree its cwd falls in, the main checkout first in
 * `trees`. One under the main checkout's `.claude/worktrees/` in no current
 * worktree is in a tree that is gone, and stray; one in none of these trees is
 * another repository's, and not shown.
 */
export function placeSessions(sessions, trees) {
  const worktrees = { path: join(trees[0].path, '.claude', 'worktrees') };
  const placed = new Map();
  const stray = [];
  for (const s of sessions) {
    const tree = treeOf(s.cwd, trees);
    if (!tree) continue;
    if (tree === trees[0] && treeOf(s.cwd, [worktrees])) stray.push(s);
    else placed.set(tree, [...(placed.get(tree) ?? []), s]);
  }
  return { placed, stray };
}

/** The waits on a tree: its branch going (`--gone`), or the tree coming clean (`--clean`). */
export const waitsOn = (tree, waits) =>
  waits.filter(
    (w) =>
      (tree.branch && (w.conditions?.gone ?? []).includes(tree.branch)) ||
      (w.conditions?.clean && samePath(w.conditions.clean, tree.path)),
  );

/** A wait as one phrase: who, on what, for how long. */
export function describeWait(w, now = Date.now()) {
  const c = w.conditions ?? {};
  const on = [
    ...(c.gone ?? []).map((b) => `--gone ${b}`),
    c.clean && `--clean ${win32.basename(c.clean)}`,
    c.port && `--port ${c.port}`,
    c.main && '--main',
  ].filter(Boolean);
  const minutes = Math.round((now - Date.parse(w.since)) / 60000);
  return `${w.as ?? `pid ${w.pid}`} (${on.join(' ')}, ${Number.isFinite(minutes) ? `${minutes} min` : 'since ?'})`;
}

/** A session as its name, busy or idle, and the minutes since its registry entry last changed; its pid when it has no name. */
function describeSession(s, now) {
  const state = [s.status, s.updatedAt === null ? null : `${Math.round((now - s.updatedAt) / 60000)} min`].filter(Boolean).join(', ');
  return `${s.name ?? `pid ${s.pid}`}${state ? ` (${state})` : ''}`;
}

/** What serves out of a tree, by the package its command line runs. */
export const labelOf = (command, name) =>
  /storybook/i.test(command) ? 'storybook' : /\bvite\b/i.test(command) ? 'vite' : String(name).replace(/\.exe$/i, '');

/**
 * The live sessions in Claude Code's registry, newest first, each as `{ pid,
 * id, cwd, name, status, updatedAt }` and nothing else from its file, beside
 * how many `<pid>.json` files it holds; null when the registry is missing or
 * unreadable. A file is opened only when its pid runs; one that does not parse
 * or names no cwd is skipped.
 */
export function readSessions(dir, isAlive = alive) {
  let files;
  try {
    files = readdirSync(dir).filter((name) => /^\d+\.json$/.test(name));
  } catch {
    return null;
  }
  const text = (value) => (typeof value === 'string' && value ? value : null);
  const sessions = [];
  for (const file of files) {
    const pid = Number(file.slice(0, -'.json'.length));
    if (!pid || !isAlive(pid)) continue;
    try {
      const entry = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      if (!text(entry.cwd)) continue;
      const updatedAt = Number.isFinite(entry.updatedAt) ? entry.updatedAt : null;
      sessions.push({ pid, id: text(entry.sessionId), cwd: entry.cwd, name: text(entry.name), status: text(entry.status), updatedAt });
    } catch {
      /* half-written, or not a session's */
    }
  }
  return { files: files.length, sessions: sessions.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)) };
}

/** A brief's title, from its `# Brief:` line. */
function titleOf(file) {
  try {
    return /^#\s*Brief:\s*(.+)$/m.exec(readFileSync(file, 'utf8'))?.[1].trim() ?? null;
  } catch {
    return null;
  }
}

/** The briefs a tree carries that origin/main does not: committed or staged, and untracked. */
function briefsOf(path) {
  const carried = lines(git(path, 'diff', '--name-only', '--diff-filter=A', MAIN_REF, '--', 'briefs/')).map((file) => ({ file, untracked: false }));
  const loose = lines(git(path, 'ls-files', '--others', '--exclude-standard', '--', 'briefs/')).map((file) => ({ file, untracked: true }));
  return [...carried, ...loose].map((b) => ({ ...b, title: titleOf(join(path, b.file)) }));
}

/**
 * The listening servers per tree path. Each process goes to the most specific
 * tree that names it: the main checkout's path starts every worktree's under
 * `.claude/worktrees/`, so worktrees claim theirs first.
 */
function serversByTree(trees) {
  const table = processes.list();
  const byPid = new Map(table.map((p) => [p.pid, p]));
  const owner = new Map();
  for (const tree of [...trees].sort((a, b) => b.path.length - a.path.length)) {
    for (const pid of processes.pidsToStop(table, tree.path)) if (!owner.has(pid)) owner.set(pid, tree.path);
  }
  const out = new Map(trees.map((t) => [t.path, []]));
  const seen = new Set();
  for (const { port, pid } of listening()) {
    const path = owner.get(pid);
    if (!path || seen.has(`${port}:${pid}`)) continue;
    seen.add(`${port}:${pid}`);
    const p = byPid.get(pid);
    out.get(path).push({ port, pid, label: labelOf(p?.command ?? '', p?.name ?? '') });
  }
  return out;
}

/**
 * The board: every tree with its facts, the sessions whose tree is gone, and
 * what the registry held — null when it could not be read. `full` adds what
 * costs more than git and the registry — briefs, the process table and the
 * ports — which the session start leaves out to stay inside the hook's timeout.
 */
export function collect({ cwd = process.cwd(), full = true, sessionsDir = join(homedir(), '.claude', 'sessions'), now = Date.now() } = {}) {
  const trees = parseWorktrees(git(cwd, 'worktree', 'list', '--porcelain'));
  const read = readSessions(sessionsDir);
  const waits = readWaits(waitsDir(cwd));
  let servers = null;
  let serversError = null;
  try {
    if (full) servers = serversByTree(trees);
  } catch (e) {
    serversError = String(e.message).split('\n')[0];
  }
  const { placed, stray } = placeSessions(read?.sessions ?? [], trees);
  return {
    now,
    registry: read && { files: read.files, live: read.sessions.length, here: [...placed.values()].flat().length + stray.length },
    stray,
    serversError,
    trees: trees.map((t, i) => {
      let dirty = null;
      let briefs = null;
      try {
        dirty = lines(git(t.path, 'status', '--porcelain')).length;
        if (full) briefs = briefsOf(t.path);
      } catch {
        /* a tree git cannot read shows as missing */
      }
      return { ...t, main: i === 0, dirty, briefs, servers: servers?.get(t.path) ?? null, sessions: placed.get(t) ?? [], waits: waitsOn(t, waits) };
    }),
  };
}

const nameOf = (tree) => (tree.main ? 'main checkout' : basename(tree.path));

/** The full board, one block per tree. */
export function fullBoard(board) {
  const out = [
    board.registry
      ? `sessions: ${board.registry.files} in the registry, ${board.registry.live} live, ${board.registry.here} in these trees`
      : 'sessions: unread — the registry, ~/.claude/sessions, is missing or unreadable, so no tree shows one',
  ];
  const row = (label, value) => out.push(`  ${label.padEnd(9)} ${value}`);
  for (const t of board.trees) {
    out.push('', `${nameOf(t)} — ${t.branch ?? 'detached'} at ${t.head?.slice(0, 7) ?? '?'}${t.locked === null ? '' : `, locked${t.locked ? `: ${t.locked}` : ''}`}`);
    row('path', t.path);
    if (board.registry) row('sessions', t.sessions.map((s) => describeSession(s, board.now)).join(', ') || 'none');
    row('dirty', t.dirty === null ? 'MISSING — git cannot read this tree' : String(t.dirty));
    if (t.briefs) row('briefs', t.briefs.map((b) => `${b.file}${b.untracked ? ' (untracked)' : ''}${b.title ? ` — ${b.title}` : ''}`).join('; ') || 'none beyond origin/main');
    if (t.servers) row('servers', t.servers.map((s) => `:${s.port} ${s.label} pid ${s.pid}`).join(', ') || 'none listening');
    else if (board.serversError) row('servers', `unread — ${board.serversError}`);
    row('waits', t.waits.map((w) => describeWait(w, board.now)).join('; ') || 'none');
  }
  if (board.stray.length) {
    out.push('', 'no current tree — their cwd is a worktree that is gone');
    for (const s of board.stray) row('session', `${describeSession(s, board.now)} (${s.cwd})`);
  }
  return out;
}

/**
 * What the session start prints: one line per tree, or nothing when no tree
 * but the main checkout and its own exists and no other session runs. `self`
 * is the starting session — its id, its pid and its cwd — left out by its id or
 * its pid, since right after a /clear the registry may still hold the id it had
 * before.
 */
export function shortBoard(board, self = {}) {
  const isSelf = (s) => (self.id && s.id === self.id) || (self.pid && s.pid === self.pid);
  const others = (sessions) => sessions.filter((s) => !isSelf(s));
  const here = self.cwd ? treeOf(self.cwd, board.trees) : null;
  const anotherTree = board.trees.some((t) => !t.main && t !== here);
  const anotherSession = board.trees.some((t) => others(t.sessions).length);
  if (!anotherTree && !anotherSession) return [];
  return [
    'Peers on this machine — `pnpm peers` before touching a shared file or picking up a handoff; waiting on or messaging one is in docs/foundation/peers.md:',
    ...board.trees.map((t) => {
      const sessions = board.registry ? ` — ${others(t.sessions).map((s) => describeSession(s, board.now)).join(', ') || 'no other session'}` : '';
      const waits = t.waits.length ? `; waited on by ${t.waits.map((w) => w.as ?? `pid ${w.pid}`).join(', ')}` : '';
      const dirty = t.dirty ? `, ${t.dirty} dirty` : '';
      return `  ${nameOf(t)}${t === here ? ' (here)' : ''}: ${t.branch ?? 'detached'}${dirty}${sessions}${waits}`;
    }),
    ...(board.registry ? [] : ['  sessions unread — the registry, ~/.claude/sessions, is missing or unreadable.']),
  ];
}

/**
 * The starting session, from a hook's input: its id, its cwd, and its pid,
 * which is the hook's parent. Claude Code spawns a hook written as `command`
 * and `args` with no shell between: every such hook of this repository ran as
 * a child of its session's registry pid, in four sessions, measured 2026-09-28.
 */
export const selfOf = (input, ppid = process.ppid) => ({ id: input.session_id ?? null, pid: ppid, cwd: input.cwd ?? process.cwd() });

function main() {
  const short = process.argv.includes('--short');
  const board = collect({ full: !short });
  if (short) {
    const text = shortBoard(board, { cwd: process.cwd() });
    console.log(text.length ? text.join('\n') : 'No other tree and no other live session.');
    return;
  }
  console.log(
    'peers — read git worktree list, each tree\'s status and its briefs against origin/main, the process table, netstat -ano, ' +
      'the waits in the git common dir, and Claude Code\'s live-session registry, ~/.claude/sessions/<pid>.json (its own format, read softly).',
  );
  console.log(fullBoard(board).join('\n'));
}

/** Only as the entry point: `session-brief.mjs` and `worktree-close.mjs` import from here. */
function isEntryPoint() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) main();
