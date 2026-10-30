'use strict';
/*
 * The pure rule behind `bash-round-notice.cjs`: given the Bash commands a
 * session has just run, one after another, do they look like INDEPENDENT calls
 * that were serialized — three turns spent where one would have done.
 *
 * WHY THIS IS THE LEVER. Measured 2026-09-11 over 18.522 Bash calls in 135 main
 * transcripts: the harness takes several tool calls per turn and this repository
 * issued more than one in exactly 2 turns of 18.520. Of 18.417 consecutive
 * pairs, 6.416 (34,8 per cent) name DIFFERENT paths and had no reason to be two
 * turns; 4.926 (26,7 per cent) share a path and are a genuine map-then-read.
 * So batching is the lever, and collapsing a `grep` and a `sed` into one command
 * is the smaller half — which is why this rule counts TURNS and not commands.
 *
 * WHY IT IS A MODULE, AND WHY `.cjs` RATHER THAN `.mjs`. The rule sits apart
 * from the hook the way `latency-rules.mjs` sits apart from `latency.mjs`, so
 * the spec holds a rule and not a process. CommonJS because a hook is `.cjs` and
 * cannot `require` an ESM module; the spec imports it exactly as
 * `call-budget-notice.spec.mjs` imports its own.
 *
 * IT IS BUILT TO STAY QUIET WHEN IT IS NOT SURE. Every ambiguity resets the
 * streak rather than advancing it: a command naming no path, a command whose
 * paths are hidden inside quotes, anything that is not a read. A hook that cries
 * on legitimate work gets ignored, and then it is worse than nothing.
 */

/** Three, copied from `edit-round-notice.cjs` rather than re-derived. */
const ROUND = 3;

/*
 * Reads only. A build, a commit, a `pnpm test:run` takes as long as it takes and
 * has every reason to own its turn; there is nothing to batch and nagging about
 * it would train the notice out of being read. These are the shapes whose whole
 * cost IS the round trip.
 */
const READ_SHAPED = new Set([
  'cat', 'head', 'tail', 'sed', 'awk', 'grep', 'rg', 'ls', 'wc', 'find', 'stat',
  'nl', 'cut', 'sort', 'uniq', 'diff', 'tree', 'basename', 'dirname', 'realpath',
]);

/** `git` is read-shaped only in these subcommands. `git commit` is not a read. */
const READ_SHAPED_GIT = new Set([
  'log', 'diff', 'show', 'status', 'blame', 'ls-files', 'rev-list', 'rev-parse',
  'branch', 'cat-file', 'describe', 'shortlog',
]);

/**
 * Quoted text is a PATTERN far more often than a path, and `grep -rn 'a/b' src`
 * would otherwise be read as naming two files. Dropping it loses a path that was
 * quoted for a space in it, which costs silence and never a false alarm.
 */
function withoutQuotes(command) {
  return String(command).replace(/'[^']*'|"[^"]*"/g, ' ');
}

/**
 * The segments a command really runs, with `cd` prefixes dropped — measured
 * 2026-09-11, `cd` prefixes 38,3 per cent of all Bash calls here. A pipeline is
 * ONE segment: `grep | head` is a single decision, not two round trips.
 */
function segments(command) {
  return withoutQuotes(command)
    .split(/(?:&&|\|\||;|\n)+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !/^cd\b/.test(s));
}

/** The first word of a segment that is not an environment assignment. */
function head(segment) {
  const words = segment.split(/\s+/).filter((w) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w));
  return (words[0] || '').replace(/^.*[/\\]/, '');
}

/**
 * A command that already carries two or more segments is the behaviour this
 * notice asks for. It ends the streak instead of extending it.
 */
function isBatched(command) {
  return segments(command).length > 1;
}

function isReadShaped(command) {
  const parts = segments(command);
  if (parts.length !== 1) return false;
  const name = head(parts[0]);
  if (name === 'git') {
    const sub = parts[0].split(/\s+/).filter((w) => !w.startsWith('-'))[1] || '';
    return READ_SHAPED_GIT.has(sub);
  }
  return READ_SHAPED.has(name);
}

/**
 * The path-like tokens a command names, normalised for comparison.
 *
 * A heuristic on purpose: a token with a separator in it, or an extension on the
 * end. A glob is excluded because it names a set rather than a file, so two
 * globs that overlap would read as different paths.
 */
function pathsIn(command) {
  const found = new Set();
  for (const token of withoutQuotes(command).split(/[\s|;&()<>]+/)) {
    if (!token || token.startsWith('-')) continue;
    if (/[*?]/.test(token)) continue;
    if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(token)) continue;
    if (!/[/\\]/.test(token) && !/\.[A-Za-z0-9]{1,6}$/.test(token)) continue;
    const normal = token
      .replace(/\\/g, '/')
      .replace(/^\.\//, '')
      .replace(/[,:.]+$/, '')
      .toLowerCase();
    if (normal) found.add(normal);
  }
  return [...found];
}

function shares(a, b) {
  return a.some((p) => b.includes(p));
}

/** The empty state, and what a reset returns to. */
function start() {
  return { n: 0, paths: [] };
}

/**
 * Advance the streak by one Bash command.
 *
 * A pair that SHARES a path is the map-then-read the census measured at 26,7 per
 * cent — genuinely dependent, and the case this rule must stay silent on. It
 * does not merely fail to advance: it restarts the count at the new command,
 * because that command may still open an independent run of its own.
 */
function step(state, command) {
  const previous = state && Number.isInteger(state.n) ? state : start();
  if (isBatched(command) || !isReadShaped(command)) return start();
  const paths = pathsIn(command);
  if (paths.length === 0) return start();
  if (previous.n > 0 && shares(previous.paths, paths)) return { n: 1, paths };
  return { n: previous.n + 1, paths };
}

/**
 * Speaks on exactly the ROUNDth, never after it: the hook resets the streak when
 * it fires, and caps the whole session at one notice.
 */
function shouldNotice(state) {
  return Boolean(state) && state.n === ROUND;
}

/**
 * Short on purpose. `additionalContext` enters the conversation and is re-read on
 * every later call, so a notice about waste that is itself long is the thing it
 * warns about.
 */
function notice() {
  return (
    `Three Bash calls in a row, one per turn, each naming different paths — nothing made ` +
    `them three turns. Measured here 2026-09-11: of 18.520 turns exactly 2 carried more ` +
    `than one call, and 34,8 per cent of consecutive pairs were independent. Waiting is ` +
    `half this workspace's clock. Send independent calls in ONE message from now on.`
  );
}

module.exports = {
  ROUND,
  isBatched,
  isReadShaped,
  notice,
  pathsIn,
  segments,
  shouldNotice,
  start,
  step,
};
