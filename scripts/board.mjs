/**
 * `pnpm board` — every autopilot run on this machine, on one page.
 *
 *   pnpm board                 http://127.0.0.1:4380
 *   pnpm board --port 4390     another port; never 5173 or 6006
 *   pnpm board --main <ref>    where merged runs are read from, default main
 *
 * A run is a registry with the header in docs/foundation/autopilot.md § The
 * registry's form. It is found two ways:
 *
 * - **In a worktree**, by `git grep --untracked` for the header, and only when
 *   the header's `branch:` is the branch that tree has checked out. A tree born
 *   from `main` carries every merged registry too; those are copies, not runs.
 * - **In `main`'s tree**, read with `git show`, as merged. Local `main`, not
 *   `origin/main`: a queue merges each task there before anything is pushed.
 *
 * DERIVED ON EVERY REQUEST, NEVER WRITTEN, like `peers.mjs`. The page polls
 * `/runs.json` every 2 s and this answers from git and the disk each time.
 * `main`'s side is cached by its commit, since it only moves on a merge.
 *
 * It binds to 127.0.0.1 and serves only the files of a run it found: the
 * brief, the registry and the review files. Its shape — stage columns, the
 * verdict chips per round, a drawer of markdown — is zazencodes' software
 * factory dashboard's; that repository has no licence, so none of its code is
 * here.
 *
 * Below the runs, the backlog's open and blocked items, from `MAIN`'s tree as
 * the merged runs are, so the page does not follow whatever branch the main
 * checkout holds.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MERGED_SHOWN,
  backlogOf,
  byNewest,
  columnOf,
  isBacklogFile,
  parseRegistry,
  reviewFileOf,
  roundProblems,
  roundsOf,
} from './board-rules.mjs';
import { parseWorktrees } from './peers.mjs';
import { git } from './wait.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = join(ROOT, 'scripts', 'board.html');
const TOKENS = join(ROOT, 'scripts', 'board-tokens.css');
const RULES = join(ROOT, 'scripts', 'board-rules.mjs');
const BACKLOG_RULES = join(ROOT, 'scripts', 'backlog-rules.mjs');
const HEADER_LINE = '^brief: ';
const SCOPE = ['--', '*.md', ':!briefs/'];

const args = process.argv.slice(2);
const after = (flag, fallback) => {
  const at = args.indexOf(flag);
  return at === -1 ? fallback : args[at + 1] ?? fallback;
};
const PORT = Number(after('--port', 4380));
const MAIN = after('--main', 'main');

const firstLine = (text) => String(text).split(/\r?\n/, 1)[0];

/** `git grep -l` that reads exit 1 as "no match" rather than a failure. */
function grepFiles(cwd, ...grepArgs) {
  try {
    return git(cwd, 'grep', '-l', ...grepArgs).split(/\r?\n/).filter(Boolean);
  } catch (err) {
    if (err.status === 1) return [];
    throw err;
  }
}

/** The review files beside a registry in a worktree, as `{ 'round-1/review-code.md': firstLine }`. */
function reviewsOnDisk(dir) {
  const firstLines = {};
  if (!existsSync(dir)) return firstLines;
  for (const round of readdirSync(dir).filter((d) => /^round-\d+$/.test(d))) {
    for (const file of readdirSync(join(dir, round)).filter((f) => /^review-[\w-]+\.md$/.test(f))) {
      firstLines[`${round}/${file}`] = firstLine(readFileSync(join(dir, round, file), 'utf8'));
    }
  }
  return firstLines;
}

/** One run's card data from its parsed registry and review files. */
function runOf({ parsed, path, source, tree, firstLines }) {
  const rounds = roundsOf(firstLines);
  const merged = source === 'main';
  const base = path.replace(/\.md$/, '');
  const reviews = Object.keys(firstLines)
    .filter((f) => reviewFileOf(f))
    .sort((a, b) => reviewFileOf(a).round - reviewFileOf(b).round || a.localeCompare(b));
  return {
    id: `${source}:${parsed.header.branch}:${path}`,
    column: columnOf({ merged, questions: parsed.questions, rounds }),
    source,
    tree,
    path,
    title: parsed.title,
    brief: parsed.header.brief,
    branch: parsed.header.branch,
    base: parsed.header.base ?? null,
    steps: parsed.steps,
    questions: parsed.questions,
    rounds,
    files: [
      { path: parsed.header.brief, group: 'Brief' },
      { path, group: 'Registry' },
      ...reviews.map((f) => ({ path: `${base}/${f}`, group: `Round ${reviewFileOf(f).round}`, first: firstLines[f] })),
    ],
    problems: [...parsed.problems, ...roundProblems(rounds)],
  };
}

/** The runs in the worktrees: a registry whose `branch:` is the branch its tree has out. */
function treeRuns(trees) {
  const runs = [];
  for (const tree of trees.filter((t) => t.branch && existsSync(t.path))) {
    for (const path of grepFiles(tree.path, '--untracked', '-e', HEADER_LINE, ...SCOPE)) {
      const parsed = parseRegistry(readFileSync(join(tree.path, path), 'utf8'));
      if (!parsed || parsed.header.branch !== tree.branch) continue;
      const firstLines = reviewsOnDisk(join(tree.path, path.replace(/\.md$/, '')));
      runs.push(runOf({ parsed, path, source: 'tree', tree: tree.path, firstLines }));
    }
  }
  return runs;
}

let mainCache = { sha: null, runs: [] };

/** The runs merged into `MAIN`, re-read only when it moves. */
function mainRuns() {
  const sha = git(ROOT, 'rev-parse', MAIN);
  if (sha === mainCache.sha) return mainCache.runs;
  const runs = [];
  for (const hit of grepFiles(ROOT, '-e', HEADER_LINE, sha, ...SCOPE)) {
    const path = hit.slice(sha.length + 1);
    const parsed = parseRegistry(git(ROOT, 'show', `${sha}:${path}`));
    if (!parsed) continue;
    const base = path.replace(/\.md$/, '');
    const firstLines = {};
    for (const file of git(ROOT, 'ls-tree', '-r', '--name-only', sha, '--', `${base}/`).split(/\r?\n/).filter(Boolean)) {
      if (reviewFileOf(file)) firstLines[file.slice(base.length + 1)] = firstLine(git(ROOT, 'show', `${sha}:${file}`));
    }
    runs.push(runOf({ parsed, path, source: 'main', tree: null, firstLines }));
  }
  mainCache = { sha, runs };
  return runs;
}

let last = { runs: [] };

/** Everything the page shows. A run in both a tree and `MAIN`, same branch and path, is merged. */
function scan() {
  const problems = [];
  const trees = parseWorktrees(git(ROOT, 'worktree', 'list', '--porcelain'));
  let merged = [];
  try {
    merged = mainRuns();
  } catch (err) {
    problems.push(`Could not read ${MAIN}: ${err.message.split(/\r?\n/)[0]}`);
  }
  let live = [];
  try {
    live = treeRuns(trees);
  } catch (err) {
    problems.push(`Could not read the worktrees: ${err.message.split(/\r?\n/)[0]}`);
  }
  const inMain = new Set(merged.map((r) => `${r.branch}\n${r.path}`));
  live = live.filter((r) => !inMain.has(`${r.branch}\n${r.path}`));
  const shown = [...merged].sort(byNewest).slice(0, MERGED_SHOWN);
  last = {
    main: MAIN,
    mainSha: mainCache.sha?.slice(0, 7) ?? null,
    trees: trees.length,
    runs: [...live.sort(byNewest), ...shown],
    mergedHidden: merged.length - shown.length,
    problems,
  };
  return last;
}

let backlogCache = { sha: null, body: null };

/** The backlog in `MAIN`'s tree, read through `backlogOf`, re-read only when `MAIN` moves. */
function backlog() {
  try {
    const sha = git(ROOT, 'rev-parse', MAIN);
    if (sha !== backlogCache.sha) {
      const tree = git(ROOT, 'ls-tree', '--name-only', sha, '--', 'BACKLOG.md', 'backlog/').split(/\r?\n/);
      const paths = tree.filter(isBacklogFile);
      const { items, rest, failure } = backlogOf(
        paths.map((path) => ({ path, text: git(ROOT, 'show', `${sha}:${path}`) })),
        { readme: tree.includes('backlog/README.md') },
      );
      backlogCache = { sha, body: { main: MAIN, items, rest, problems: failure ? [`The backlog in ${MAIN}: ${failure}`] : [] } };
    }
    return backlogCache.body;
  } catch (err) {
    return { main: MAIN, items: [], rest: {}, problems: [`Could not read the backlog in ${MAIN}: ${err.message.split(/\r?\n/)[0]}`] };
  }
}

/** A run's file, only when the run lists it: from its tree's disk, or from `MAIN`. */
function fileOf(id, path) {
  const run = last.runs.find((r) => r.id === id);
  if (!run || !run.files.some((f) => f.path === path)) return null;
  if (run.source === 'tree') {
    const full = join(run.tree, path);
    return existsSync(full) ? readFileSync(full, 'utf8') : null;
  }
  try {
    return git(ROOT, 'show', `${mainCache.sha}:${path}`);
  } catch {
    return null;
  }
}

function send(res, status, type, body) {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/') return send(res, 200, 'text/html; charset=utf-8', readFileSync(PAGE));
    if (url.pathname === '/board-tokens.css') return send(res, 200, 'text/css; charset=utf-8', readFileSync(TOKENS));
    if (url.pathname === '/board-rules.mjs') return send(res, 200, 'text/javascript; charset=utf-8', readFileSync(RULES));
    if (url.pathname === '/backlog-rules.mjs') return send(res, 200, 'text/javascript; charset=utf-8', readFileSync(BACKLOG_RULES));
    if (url.pathname === '/runs.json') return send(res, 200, 'application/json; charset=utf-8', JSON.stringify(scan()));
    if (url.pathname === '/backlog.json') return send(res, 200, 'application/json; charset=utf-8', JSON.stringify(backlog()));
    if (url.pathname === '/file') {
      const text = fileOf(url.searchParams.get('run'), url.searchParams.get('path'));
      return text === null
        ? send(res, 404, 'text/plain; charset=utf-8', 'Not a file of this run, or not written yet.')
        : send(res, 200, 'text/markdown; charset=utf-8', text);
    }
    send(res, 404, 'text/plain; charset=utf-8', 'Not found.');
  } catch (err) {
    send(res, 500, 'text/plain; charset=utf-8', err.message);
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`FAIL — port ${PORT} is taken. Pass --port <a free port>, never 5173 or 6006.`);
  else console.error(`FAIL — ${err.message}`);
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(
    `board — reads git worktree list, each tree's registries by their header (git grep --untracked, briefs/ excluded) ` +
      `and their round-N/review-<lens>.md, and ${MAIN}'s tree for the merged ones and the backlog. Derived on every request, never written.`,
  );
  console.log(`  http://127.0.0.1:${PORT}  — Ctrl+C stops it.`);
});
