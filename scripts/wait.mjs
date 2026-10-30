/**
 * Wait on a peer without spending tokens: exit once every condition holds.
 *
 *   pnpm wait [--gone <branch>]... [--clean <tree>] [--port <n>] [--main]
 *             [--as "<session name>"] [--every <seconds>]
 *
 * RUN IT WITH THE BASH TOOL'S `run_in_background`. The harness wakes the
 * session when the process exits; the Monitor tool does not wake an idle one,
 * and a session that looks by hand pays for every look.
 *
 * WHAT IT READS. git, in the repository it runs in, with no fetch: a peer's
 * push moves refs/remotes/origin/main for every worktree at once, and both
 * close routes delete the branch after pushing. For `--port`, the listening
 * sockets — `netstat -ano` on Windows, `lsof` elsewhere.
 *
 * LANDED IS PROVEN, NEVER ASSUMED. `--gone` keeps the branch's tip from every
 * look; once the branch is gone it asks git whether that tip is in
 * origin/main. A branch deleted unmerged reads `gone WITHOUT landing` and ends
 * the wait at once, exit 3 — the scratch watch this replaces read every
 * deletion as a landing. A close that deletes the branch before its push reads
 * the same way, which is the side to err on.
 *
 * REGISTERED WHILE IT RUNS, in `<git common dir>/peers/waits/<pid>.json` — one
 * directory for every worktree, never versioned — so `pnpm peers` and
 * `pnpm worktree:close` can name who waits. Deleted on every exit this process
 * sees; a process killed outright leaves a file whose pid is dead, which
 * readers ignore and the next wait deletes.
 *
 * Exit 0 every condition holds, 3 a branch went without landing, 2 a flag or a
 * name it cannot use, 1 git failed or a signal stopped it.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAIN_REF = 'refs/remotes/origin/main';
const USAGE = 'pnpm wait [--gone <branch>]... [--clean <tree>] [--port <n>] [--main] [--as "<session name>"] [--every <seconds>]';

/** `git` in `cwd`; throws on a non-zero exit, with `status` on the error. */
export const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).trim();

const lines = (text) => text.split(/\r?\n/).filter((l) => l.trim());
const short = (sha) => (sha ? sha.slice(0, 7) : '?');

/** One path, whichever way its slashes lean and whatever its case. */
export const samePath = (a, b) =>
  String(a).replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase() ===
  String(b).replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase();

/** The flags as `{ gone, clean, port, main, as, every }`, or `{ error }` naming the first it cannot use. */
export function parseArgs(argv) {
  const out = { gone: [], clean: null, port: null, main: false, as: null, every: 30 };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--main') {
      out.main = true;
      continue;
    }
    if (!['--gone', '--clean', '--port', '--as', '--every'].includes(flag)) return { error: `unknown argument ${flag}` };
    const value = argv[++i];
    if (value === undefined || value.startsWith('--')) return { error: `${flag} needs a value` };
    if (flag === '--gone') {
      out.gone.push(value);
      continue;
    }
    if (seen.has(flag)) return { error: `${flag} given twice` };
    seen.add(flag);
    if (flag === '--port') {
      out.port = Number(value);
      if (!Number.isInteger(out.port) || out.port < 1 || out.port > 65535) return { error: `--port ${value} is not a port` };
    } else if (flag === '--every') {
      out.every = Number(value);
      if (!(out.every > 0)) return { error: `--every ${value} is not a number of seconds` };
    } else out[flag.slice(2)] = value;
  }
  if (!out.gone.length && out.clean === null && out.port === null && !out.main) {
    return { error: 'no condition — give --gone, --clean, --port or --main' };
  }
  return out;
}

/**
 * The listening TCP sockets in `netstat -ano` or `lsof -nP -iTCP -sTCP:LISTEN`
 * output, as `[{ port, pid }]`.
 *
 * A netstat row listens when its remote end is the any-address at port 0: the
 * state column is translated with Windows (`ABHÖREN` in German), the address
 * is not.
 */
export function parseListening(text) {
  const out = [];
  for (const line of lines(text)) {
    const netstat = /^\s*TCP\s+(\S+)\s+(\S+)\s+.*?(\d+)\s*$/i.exec(line);
    if (netstat && /^(0\.0\.0\.0|\[::\]):0$/.test(netstat[2])) {
      const port = /:(\d+)$/.exec(netstat[1]);
      if (port) out.push({ port: Number(port[1]), pid: Number(netstat[3]) });
      continue;
    }
    const lsof = /^\S+\s+(\d+)\s.*\sTCP\s+\S*:(\d+)\s+\(LISTEN\)\s*$/.exec(line);
    if (lsof) out.push({ port: Number(lsof[2]), pid: Number(lsof[1]) });
  }
  return out;
}

/** What listens on this machine now. */
export function listening() {
  if (process.platform === 'win32') {
    return parseListening(execFileSync('netstat', ['-ano'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }));
  }
  try {
    return parseListening(execFileSync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch (e) {
    if (e.status === 1 && !e.stdout) return []; // lsof exits 1 when nothing listens
    throw e;
  }
}

/** A branch's tip, or null once git no longer has the branch. */
export function tipOf(cwd, branch) {
  try {
    return git(cwd, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`);
  } catch (e) {
    if (e.status === 1) return null;
    throw e;
  }
}

/**
 * Whether a tip is in origin/main. Only `--is-ancestor`'s exit 0 reads as
 * landed: 1 is "not in it", and anything else — a tip git has lost, a ref
 * that is not there — is not a landing either.
 */
export function isLanded(cwd, tip) {
  try {
    git(cwd, 'merge-base', '--is-ancestor', tip, MAIN_REF);
    return true;
  } catch {
    return false;
  }
}

/**
 * A tree's dirty count, or null when it is no longer a checkout of its own. A
 * folder a close left behind sits inside another checkout, whose status git
 * would report instead, so the top level has to be the tree itself.
 */
export function dirtyOf(path) {
  let top;
  try {
    top = git(path, 'rev-parse', '--show-toplevel');
  } catch {
    return null;
  }
  return samePath(top, path) ? lines(git(path, 'status', '--porcelain')).length : null;
}

/** Where waits register: the git common dir, which every worktree shares and nothing versions. */
export const waitsDir = (cwd) => join(git(cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir'), 'peers', 'waits');

/** Whether a pid runs. EPERM is a process that runs as somebody else. */
export function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

/**
 * The waits registered in `dir` whose process still runs, each as
 * `{ pid, as, conditions, since, cwd }`. A dead pid's file is ignored, and so is
 * one that does not parse — half-written, or not a wait's.
 */
export function readWaits(dir, isAlive = alive) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    const pid = Number(/^(\d+)\.json$/.exec(name)?.[1]);
    if (!pid || !isAlive(pid)) continue;
    try {
      out.push({ ...JSON.parse(readFileSync(join(dir, name), 'utf8')), pid });
    } catch {
      /* not a wait */
    }
  }
  return out;
}

/**
 * One look at every condition, as `[{ kind, held, text }]`. `tips` carries each
 * branch's last tip between looks: once git has forgotten the branch, it is the
 * only thing left to judge it by.
 */
export function look(cwd, opts, tips, mainAtStart) {
  const out = [];
  for (const branch of opts.gone) {
    const tip = tipOf(cwd, branch);
    if (tip) {
      tips.set(branch, tip);
      out.push({ kind: 'gone', held: false, text: `${branch} at ${short(tip)}` });
      continue;
    }
    const last = tips.get(branch);
    const landed = last ? isLanded(cwd, last) : false;
    out.push({
      kind: 'gone',
      held: true,
      landed,
      text: landed ? `${branch} landed in origin/main ${short(git(cwd, 'rev-parse', MAIN_REF))}` : `${branch} gone WITHOUT landing, tip ${short(last)}`,
    });
  }
  if (opts.clean) {
    const dirty = dirtyOf(opts.clean);
    const name = opts.clean.split(/[\\/]/).pop();
    out.push({ kind: 'clean', held: !dirty, text: dirty === null ? `${name} removed` : dirty ? `${name} has ${dirty} dirty` : `${name} clean` });
  }
  if (opts.port) {
    const holders = listening().filter((l) => l.port === opts.port);
    const pids = [...new Set(holders.map((h) => h.pid))].join(', ');
    out.push({ kind: 'port', held: !holders.length, text: holders.length ? `:${opts.port} LISTENING (pid ${pids})` : `:${opts.port} free` });
  }
  if (opts.main) {
    const now = git(cwd, 'rev-parse', MAIN_REF);
    out.push({ kind: 'main', held: now !== mainAtStart, text: now === mainAtStart ? `origin/main at ${short(now)}` : `origin/main moved from ${short(mainAtStart)} to ${short(now)}` });
  }
  return out;
}

/** 'unlanded' when a branch went without landing, 'held' when every condition holds, else 'waiting'. */
export function verdict(conditions) {
  if (conditions.some((c) => c.kind === 'gone' && c.held && !c.landed)) return 'unlanded';
  return conditions.every((c) => c.held) ? 'held' : 'waiting';
}

/** The start line: what it waits for, and each condition as it stands. */
export function startLine(opts, conditions) {
  const until = [
    ...opts.gone.map((b) => `${b} is gone`),
    opts.clean && `${opts.clean.split(/[\\/]/).pop()} is clean`,
    opts.port && `:${opts.port} is free`,
    opts.main && 'origin/main moves',
  ].filter(Boolean);
  const who = opts.as ? `, as ${opts.as}` : '';
  return `wait — until ${until.join(', ')}; now ${conditions.map((c) => c.text).join(', ')}. Every ${opts.every} s${who}, pid ${process.pid}.`;
}

/** The exit line: the state that ended the wait. */
export function exitLine(result, conditions, minutes) {
  const head = result === 'held' ? `done in ${minutes} min` : `stopped in ${minutes} min`;
  const shown = result === 'unlanded' ? conditions.filter((c) => c.kind === 'gone' && c.held && !c.landed) : conditions;
  return `wait — ${head}: ${shown.map((c) => c.text).join('; ')}.`;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const began = Date.now();
  const minutes = () => Math.round((Date.now() - began) / 60000);
  const fail = (code, why) => {
    console.log(`wait — FAIL: ${why}`);
    process.exit(code);
  };
  if (opts.error) fail(2, `${opts.error}. Usage: ${USAGE}`);

  const tips = new Map();
  let mainAtStart = null;
  let dir;
  try {
    for (const branch of opts.gone) {
      if (!tipOf(cwd, branch)) fail(2, `no branch ${branch} — gone before the wait began, so whether it landed is unknown. \`git branch --list\` names the branches.`);
    }
    if (opts.gone.length || opts.main) {
      try {
        mainAtStart = git(cwd, 'rev-parse', '--verify', MAIN_REF);
      } catch {
        fail(2, `no ${MAIN_REF} in this repository, and landing and --main are both read against it.`);
      }
    }
    if (opts.clean) {
      const common = git(cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir');
      opts.clean = /[\\/]/.test(opts.clean) ? resolve(opts.clean) : join(dirname(common), '.claude', 'worktrees', opts.clean);
      if (dirtyOf(opts.clean) === null) fail(2, `${opts.clean} is not a worktree of this repository.`);
    }
    dir = waitsDir(cwd);
  } catch (e) {
    fail(1, `git failed: ${String(e.stderr || e.message).trim().split('\n')[0]}`);
  }

  let conditions = look(cwd, opts, tips, mainAtStart);
  console.log(startLine(opts, conditions));

  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir)) {
    const pid = Number(/^(\d+)\.json$/.exec(name)?.[1]);
    if (pid && !alive(pid)) rmSync(join(dir, name), { force: true });
  }
  const file = join(dir, `${process.pid}.json`);
  const { gone, clean, port, main: onMain } = opts;
  writeFileSync(file, `${JSON.stringify({ as: opts.as, conditions: { gone, clean, port, main: onMain ? mainAtStart : null }, since: new Date(began).toISOString(), cwd }, null, 2)}\n`);
  process.on('exit', () => rmSync(file, { force: true }));
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {
      console.log(`wait — stopped by ${signal} after ${minutes()} min.`);
      process.exit(1);
    });
  }

  const poll = () => {
    const result = verdict(conditions);
    if (result !== 'waiting') {
      console.log(exitLine(result, conditions, minutes()));
      process.exit(result === 'held' ? 0 : 3);
    }
    setTimeout(() => {
      try {
        conditions = look(cwd, opts, tips, mainAtStart);
      } catch (e) {
        console.log(`wait — stopped in ${minutes()} min: git failed: ${String(e.stderr || e.message).trim().split('\n')[0]}`);
        process.exit(1);
      }
      poll();
    }, opts.every * 1000);
  };
  poll();
}

/** Only as the entry point: `peers.mjs` and `worktree-close.mjs` import from here. */
function isEntryPoint() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) main();
