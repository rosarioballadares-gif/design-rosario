/**
 * `pnpm handoff "<what is left>"`: the prompt a session hands the person when
 * it stops, written from what git and the brief already hold.
 *
 * WHY A COMMAND. The budget notice asked for a hand-written relay prompt at
 * 200k tokens, and again at 300k, 400k, 500k and 600k; it never got written,
 * because writing it costs the session the attention it has run out of. One
 * call that gathers the facts makes stopping cheaper than going on.
 *
 * ONLY "WHAT IS LEFT" COMES FROM THE SESSION, as the argument: it is the one
 * fact git cannot know. Without it the prompt says so in a GAP line and points
 * the next session at the brief's Tasks, rather than guessing.
 *
 * IT STAYS SHORT. The person reads it once; the next session carries it in its
 * context on every call after. So the lists are capped.
 *
 * IN A WORKTREE, RUN IT BEFORE ExitWorktree keep: that call moves the session
 * back to the main checkout, and from there this reads main. The worktree is
 * found in the path string with either separator, never with `node:path`,
 * which on a POSIX runner reads `C:\repo` as a relative name
 * (briefs/2026-10-08-guard-posix.md).
 *
 * Exits 1, with the reason on stderr, outside a git repository or when a git
 * call fails: a relay prompt with a wrong fact in it is worse than none.
 *
 * Brief: briefs/2026-10-08-director-handoff.md
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** How many commits or uncommitted files the prompt lists before it says how many more. */
export const CAP = 15;

/**
 * How long a listed commit line runs before it is cut. This repository's
 * subjects are one long line each, a median of 161 characters and up to 431
 * over the last 40 (measured on main, 2026-10-16), so fifteen whole ones would
 * bury the rest of the prompt. The cut comes from hubble-product-ops's
 * diff-review, 2026-10-16.
 */
export const SUBJECT = 100;

const lines = (text) => text.split(/\r?\n/).filter((l) => l.trim());

/** A brief file directly under `briefs/`, the template and the README excepted. */
const BRIEF = /^briefs\/(?!TEMPLATE\.md$|README\.md$)[^/]+\.md$/;

/** `<root>/.claude/worktrees/<name>` in a path, with either separator; null outside one. */
export function worktreeOf(path) {
  const m = /^(.*?)[\\/]\.claude[\\/]worktrees[\\/]([^\\/]+)/.exec(String(path ?? ''));
  return m ? { root: m[1], path: m[0], name: m[2] } : null;
}

/**
 * The briefs this branch adds or changes: `git diff --name-only` against main
 * plus `git status --porcelain`, untracked included, deletions not.
 */
export function changedBriefs(committed, porcelain) {
  const loose = lines(porcelain)
    .filter((l) => !l.slice(0, 2).includes('D'))
    .map((l) => l.slice(3).split(' -> ').pop());
  const all = [...lines(committed), ...loose].map((f) => f.trim());
  return [...new Set(all)].filter((f) => BRIEF.test(f));
}

/** The newest brief by its `YYYY-MM-DD-` prefix, a tie going to the last in name order; null for none. */
export function pickBrief(files) {
  const date = (f) => /^briefs\/(\d{4}-\d{2}-\d{2})-/.exec(f)?.[1] ?? '';
  const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return [...files].sort((a, b) => byName(date(a), date(b)) || byName(a, b)).at(-1) ?? null;
}

/** A brief's title, from its `# Brief:` line. */
export const titleOf = (text) => /^#\s*Brief:\s*(.+)$/m.exec(text)?.[1].trim() ?? null;

/** A list cut at `max`, its last line saying how many were cut. */
export const capped = (items, max = CAP) => (items.length > max ? [...items.slice(0, max), `+${items.length - max} more`] : items);

/** A line cut at `max` characters, an ellipsis saying it was cut. */
export const clipped = (line, max = SUBJECT) => (line.length > max ? `${line.slice(0, max - 1)}…` : line);

/** A heading and its capped lines, or one line when there are none. */
function listed(heading, items) {
  if (!items.length) return [`${heading}: none`];
  return [`${heading} (${items.length}):`, ...capped(items).map((l) => `  ${l}`)];
}

/**
 * What `pnpm handoff` prints: one line for whoever reads the terminal, then
 * the block to paste.
 *
 * `base` is the ref the branch was read against, null when neither main nor
 * origin/main resolves; `commits` and `dirty` are git's lines, each commit
 * cut at `SUBJECT`, `left` the session's argument or null.
 */
export function relayPrompt({ repo, branch, worktree, base, brief, title, commits, dirty, left }) {
  const read = brief
    ? `Read ${brief} first.`
    : `No brief is on this branch${base ? '' : ' (with no main to compare against, only uncommitted files were read)'}.`;
  return [
    worktree
      ? 'Relay prompt — run ExitWorktree keep, /clear, then paste the block below into the new session.'
      : 'Relay prompt — /clear, then paste the block below into the new session.',
    '',
    `Continue the work in ${worktree ? worktree.root : repo} on ${branch}. ${read}`,
    ...(worktree ? [`Before editing, enter the worktree with EnterWorktree, path ${worktree.path}.`] : []),
    ...(title ? [`Brief: ${title}`] : []),
    ...(base ? listed(`Commits since ${base}`, commits.map((l) => clipped(l))) : ['Commits since main: unknown, neither main nor origin/main resolves here.']),
    ...listed('Uncommitted', dirty),
    left
      ? `Left: ${left}`
      : "GAP: the session that wrote this did not say what is left. Read the brief's Tasks against the commits above.",
  ].join('\n');
}

/** `git` in `cwd`, its output with the leading spaces porcelain needs; throws with git's reason. */
function git(cwd, ...args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).trimEnd();
  } catch (error) {
    const why = String(error.stderr || error.message).trim().split(/\r?\n/)[0];
    throw new Error(`git ${args.join(' ')} failed: ${why}`);
  }
}

function resolves(cwd, ref) {
  try {
    git(cwd, 'rev-parse', '--verify', '--quiet', `${ref}^{commit}`);
    return true;
  } catch {
    return false;
  }
}

/** The facts, each from git, read at the top of the tree `cwd` sits in. */
function collect(cwd = process.cwd()) {
  const repo = git(cwd, 'rev-parse', '--show-toplevel');
  const branch = git(repo, 'branch', '--show-current') || `a detached HEAD at ${git(repo, 'rev-parse', '--short', 'HEAD')}`;
  const base = ['main', 'origin/main'].find((ref) => resolves(repo, ref)) ?? null;
  const committed = base ? git(repo, 'diff', '--name-only', '--diff-filter=AMR', `${base}...HEAD`, '--', 'briefs') : '';
  const brief = pickBrief(changedBriefs(committed, git(repo, 'status', '--porcelain', '--untracked-files=all', '--', 'briefs')));
  let title = null;
  try {
    title = brief && titleOf(readFileSync(join(repo, brief), 'utf8'));
  } catch {
    // An unreadable brief still has its path, which is what the next session needs.
  }
  return {
    repo,
    branch,
    worktree: worktreeOf(repo),
    base,
    brief,
    title,
    commits: base ? lines(git(repo, 'log', '--oneline', `${base}..HEAD`)) : null,
    dirty: lines(git(repo, 'status', '--porcelain')),
  };
}

function main() {
  const left = process.argv.slice(2).join(' ').trim() || null;
  try {
    console.log(relayPrompt({ ...collect(), left }));
  } catch (error) {
    console.error(`handoff: ${error.message}`);
    console.error('No relay prompt was written: run it inside the repository, on the branch being handed over.');
    process.exit(1);
  }
}

/** Only as the entry point: the spec imports from here. */
function isEntryPoint() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) main();
