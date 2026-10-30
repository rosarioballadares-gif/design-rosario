/**
 * The processes that run out of a worktree, and stopping them.
 *
 * WHY. Removing a worktree deletes its folder and leaves its dev servers
 * running, because nothing that removes a folder knows what was started from
 * it. Measured 2026-09-25: 104 node processes on one machine, 82 of them in 32
 * trees whose worktree or session was already gone, and a `pnpm gate` that
 * died in `test:run` with node exit 0xC0000409 while they held the memory.
 *
 * WHY A WHOLE TREE, AND WHY IT CLIMBS. The process that names the worktree is
 * rarely the one that was started: `pnpm dev` runs as a node wrapper whose
 * command line carries no path, and only its child — `<worktree>/node_modules/
 * .bin/../vite/bin/vite.js` — does. Stopping the child alone leaves the
 * wrapper to restart or to hang. So a match climbs through the launch — node
 * wrappers and their `cmd /c` shims — to the outermost one and takes
 * everything under it.
 *
 * WHY IT DOES NOT CLIMB PAST THE LAUNCH. Above it sits a shell, and above
 * that possibly a live session. "Descends from a live session" cannot mark a
 * process as owned either: a Claude background task is detached from the
 * session that started it, which made every orphan and every owned server look
 * the same on 2026-09-25.
 *
 * `pidsToStop` is pure so the spec can hand it a process table; `list`,
 * `stop` and `held` are the three places that touch the machine.
 */
'use strict';

const { execFileSync } = require('node:child_process');
const { renameSync } = require('node:fs');

/** Slashes one way and one case, so `C:\a\b` and `c:/a/b` are the same path. */
function normalize(path) {
  return String(path ?? '').replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase();
}

/**
 * Whether a command line names this path — the path itself, not a longer one
 * that starts with it: `worktrees/a` must not match `worktrees/ab`.
 */
function mentions(command, path) {
  const cmd = normalize(command);
  const target = normalize(path);
  if (!target) return false;
  for (let at = cmd.indexOf(target); at !== -1; at = cmd.indexOf(target, at + 1)) {
    const next = cmd[at + target.length];
    if (next === undefined || /[/"'\s]/.test(next)) return true;
  }
  return false;
}

/**
 * Whether a parent belongs to the launch and not to whoever launched it: a node
 * wrapper, or the one-shot `cmd.exe /c` shim pnpm puts between two of them on
 * Windows — measured 2026-09-25 as `sh → node → cmd /c → node → cmd /c → vite`.
 * An interactive `cmd.exe` has no `/c` and is somebody's terminal window.
 */
const isLaunch = (p) =>
  /^node(\.exe)?$/i.test(String(p?.name ?? '')) ||
  (/^cmd\.exe$/i.test(String(p?.name ?? '')) && /\s\/c\s/i.test(String(p?.command ?? '')));

/**
 * The pids to stop for a worktree, given a process table of
 * `{ pid, ppid, name, command }`.
 *
 * `self` is the pid of whoever asks, and neither it nor any of its ancestors is
 * ever returned: the script that closes a worktree may itself be named with the
 * worktree's path, and a closer that stops its own shell reports nothing.
 */
function pidsToStop(processes, path, self = process.pid) {
  const byPid = new Map(processes.map((p) => [p.pid, p]));
  const children = new Map();
  for (const p of processes) {
    if (p.ppid === p.pid) continue;
    if (!children.has(p.ppid)) children.set(p.ppid, []);
    children.get(p.ppid).push(p);
  }

  const spared = new Set();
  for (let p = byPid.get(self); p && !spared.has(p.pid); p = byPid.get(p.ppid)) spared.add(p.pid);

  const roots = new Set();
  for (const hit of processes.filter((p) => mentions(p.command, path))) {
    let top = hit;
    const seen = new Set([top.pid]);
    for (let parent = byPid.get(top.ppid); parent && isLaunch(parent) && !seen.has(parent.pid); parent = byPid.get(top.ppid)) {
      seen.add(parent.pid);
      top = parent;
    }
    roots.add(top.pid);
  }

  const out = new Set();
  const take = (pid) => {
    if (out.has(pid) || spared.has(pid)) return;
    out.add(pid);
    for (const child of children.get(pid) ?? []) take(child.pid);
  };
  for (const pid of roots) take(pid);
  return [...out];
}

/** Every process on this machine, as `{ pid, ppid, name, command }`. */
function list() {
  if (process.platform === 'win32') {
    const json = execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress',
      ],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const rows = JSON.parse(json || '[]');
    return (Array.isArray(rows) ? rows : [rows]).map((r) => ({
      pid: r.ProcessId,
      ppid: r.ParentProcessId,
      name: r.Name ?? '',
      command: r.CommandLine ?? '',
    }));
  }
  const out = execFileSync('ps', ['-axo', 'pid=,ppid=,args='], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out
    .split('\n')
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/))
    .filter(Boolean)
    .map(([, pid, ppid, command]) => ({
      pid: Number(pid),
      ppid: Number(ppid),
      name: (command.split(/\s+/)[0] ?? '').split('/').pop(),
      command,
    }));
}

/** Stops each pid, and returns the ones that were still there to stop. */
function stop(pids) {
  return pids.filter((pid) => {
    try {
      process.kill(pid, 'SIGKILL');
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Whether something still stands in a folder: the code a rename of it is
 * refused with, or null when nothing does.
 *
 * WHY A RENAME. A process whose working directory is inside a folder holds it
 * on Windows, and `list` cannot see that: Win32_Process carries no working
 * directory, and what held `user-hooks` on 2026-10-08 was the agent session
 * itself, not a node process. Measured 2026-10-09: refused with EBUSY while a
 * shell stood in the folder, renamed once it left. Linux renames a busy folder,
 * so there this answers null.
 */
function held(path) {
  const probe = `${path}.probe`;
  try {
    renameSync(path, probe);
  } catch (e) {
    return e.code ?? String(e);
  }
  try {
    renameSync(probe, path);
  } catch (e) {
    throw new Error(`${path} was renamed to ${probe} and could not be renamed back (${e.code}) — rename it back by hand`);
  }
  return null;
}

module.exports = { mentions, pidsToStop, list, stop, held };
