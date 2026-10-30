/**
 * What `pnpm board` knows about an autopilot run, as pure functions over text.
 *
 * A run is its registry: one markdown file whose frontmatter names its brief,
 * its branch and its base, with `## Steps` and `## Waiting` as `- [ ]` lists
 * (docs/foundation/autopilot.md § The registry's form). Beside it sit
 * `<registry without .md>/round-<N>/review-<lens>.md`, each opening on its
 * verdict (docs/foundation/review-panel.md § The file).
 *
 * THE COLUMN IS DERIVED, NEVER WRITTEN. The director keeps the registry and
 * nothing else; a column it had to remember to move would be stale the first
 * time it forgot, as `peers.mjs` says of its own board.
 *
 * The backlog's section reads its items with `parseBacklog`, the same reading
 * `pnpm backlog` trusts. The page imports this file, so the server serves
 * `backlog-rules.mjs` beside it.
 */
import { NO_OWNER, STATUSES, parseBacklog, scopeFailure } from './backlog-rules.mjs';

/** The lenses review-panel.md names, in its order. A lens found beyond these is shown after them. */
export const LENSES = ['code', 'copy', 'ui'];

/** The board's columns, in order. */
export const COLUMNS = [
  { key: 'steps', label: 'Steps', who: 'one worker at a time' },
  { key: 'review', label: 'Review', who: 'code · copy · ui' },
  { key: 'waiting', label: 'Waiting on you', who: 'question UI' },
  { key: 'final', label: 'Final stop', who: 'merge, gate, push' },
  { key: 'merged', label: 'Merged', who: 'main' },
];

/** How many merged runs the board shows; the rest are counted, never dropped silently. */
export const MERGED_SHOWN = 8;

const LINES = /\r?\n/;
const stripBom = (text) => String(text).replace(/^﻿/, '');

/** The frontmatter as `{ key: value }`, or null when the file does not open on `---`. */
export function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(stripBom(text));
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split(LINES)) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*?)\s*$/.exec(line);
    if (kv) fields[kv[1]] = kv[2];
  }
  return fields;
}

/** The lines under `## <name>`, decoration after the name tolerated; null when there is no such heading. */
export function sectionOf(text, name) {
  const lines = stripBom(text).split(LINES);
  const start = lines.findIndex((l) => new RegExp(`^##\\s+${name}\\b`, 'i').test(l));
  if (start === -1) return null;
  const end = lines.findIndex((l, i) => i > start && /^#{1,2}\s/.test(l));
  return lines.slice(start + 1, end === -1 ? undefined : end);
}

/**
 * The `- [ ]` items of a section as `[{ done, text, state }]`. An unchecked
 * item ending in `— partial` or `— waiting` carries that state; any other
 * unchecked item is `pending`. Indented lines continue the item above.
 */
export function tasksOf(lines) {
  const items = [];
  for (const line of lines ?? []) {
    const task = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(line);
    if (task) {
      items.push({ done: task[1] !== ' ', text: task[2].trim() });
      continue;
    }
    if (items.length && /^\s{2,}\S/.test(line)) items.at(-1).text += ` ${line.trim()}`;
  }
  return items.map((item) => {
    const marker = /\s[—–-]\s*(partial|waiting)\s*$/i.exec(item.text);
    const state = item.done ? 'done' : marker ? marker[1].toLowerCase() : 'pending';
    return { ...item, state };
  });
}

/** A registry's header, title, steps, questions and what is wrong with its form. Null when it is not a registry. */
export function parseRegistry(text) {
  const header = parseFrontmatter(text);
  if (!header?.brief || !header?.branch) return null;
  const problems = [];
  if (!header.base) problems.push('No `base:` in the frontmatter');
  const steps = sectionOf(text, 'Steps');
  if (steps === null) problems.push('No `## Steps` section');
  const waiting = sectionOf(text, 'Waiting');
  if (waiting === null) problems.push('No `## Waiting` section');
  const title = /^#\s+(.+?)\s*$/m.exec(stripBom(text).replace(/^---[\s\S]*?\r?\n---/, ''))?.[1] ?? null;
  return { header, title, steps: tasksOf(steps), questions: tasksOf(waiting), problems };
}

/** `PASS`, `CHANGES`, or null when the first line is not exactly a verdict. */
export function verdictOf(firstLine) {
  const match = /^VERDICT: (PASS|CHANGES)$/.exec(stripBom(firstLine ?? '').trim());
  return match ? match[1] : null;
}

/** `round-2/review-ui.md` as `{ round: 2, lens: 'ui' }`, or null for any other path. */
export function reviewFileOf(path) {
  const match = /(?:^|\/)round-(\d+)\/review-([\w-]+)\.md$/.exec(path.replace(/\\/g, '/'));
  return match ? { round: Number(match[1]), lens: match[2] } : null;
}

/**
 * The rounds from the review files' first lines, `{ 'round-1/review-code.md': 'VERDICT: PASS' }`,
 * as `[{ n, verdicts: { code: 'PASS' | 'CHANGES' | 'invalid' | null } }]`. A lens with no
 * file is null: not written yet in the last round, missed in an earlier one.
 */
export function roundsOf(firstLines) {
  const byRound = new Map();
  const found = new Set();
  for (const [path, first] of Object.entries(firstLines)) {
    const file = reviewFileOf(path);
    if (!file) continue;
    found.add(file.lens);
    if (!byRound.has(file.round)) byRound.set(file.round, {});
    byRound.get(file.round)[file.lens] = verdictOf(first) ?? 'invalid';
  }
  const lenses = [...LENSES, ...[...found].filter((l) => !LENSES.includes(l)).sort()];
  return [...byRound.keys()]
    .sort((a, b) => a - b)
    .map((n) => ({ n, verdicts: Object.fromEntries(lenses.map((l) => [l, byRound.get(n)[l] ?? null])) }));
}

/** True when every lens of the round wrote PASS. */
export const allPass = (round) => Object.values(round.verdicts).every((v) => v === 'PASS');

/**
 * The column a run sits in. In `main` it is merged, whatever else it says. An
 * open question puts it in front of the person, since nothing that depends on
 * it runs. Otherwise the last round decides: none yet, the steps are running;
 * all PASS, the final stop; anything else, the panel and its fix loop.
 */
export function columnOf({ merged = false, questions = [], rounds = [] }) {
  if (merged) return 'merged';
  if (questions.some((q) => !q.done)) return 'waiting';
  const last = rounds.at(-1);
  if (!last) return 'steps';
  return allPass(last) ? 'final' : 'review';
}

/** What is wrong with the review files: a first line that is not a verdict, a lens missing from a closed round. */
export function roundProblems(rounds) {
  const problems = [];
  rounds.forEach((round, i) => {
    for (const [lens, verdict] of Object.entries(round.verdicts)) {
      if (verdict === 'invalid') problems.push(`round-${round.n}/review-${lens}.md does not open on a verdict`);
      else if (verdict === null && i < rounds.length - 1) problems.push(`round-${round.n} has no review-${lens}.md`);
    }
  });
  return problems;
}

/** Newest first, by the brief's `YYYY-MM-DD-` prefix, then by branch. */
export function byNewest(a, b) {
  const date = (run) => /(\d{4}-\d{2}-\d{2})/.exec(run.brief ?? '')?.[1] ?? '';
  return date(b).localeCompare(date(a)) || String(a.branch).localeCompare(String(b.branch));
}

/** The backlog's columns: the states still to do. Every other state is counted, never drawn. */
export const BACKLOG_COLUMNS = [
  { key: 'open', label: 'Open' },
  { key: 'blocked', label: 'Blocked' },
];

/** The files `check-backlog.mjs` reads, as paths in a commit: `BACKLOG.md`, and `backlog/*.md` but its README. */
export const isBacklogFile = (path) =>
  path === 'BACKLOG.md' || (/^backlog\/[^/]+\.md$/.test(path) && path !== 'backlog/README.md');

/**
 * The backlog as the board shows it, from `[{ path, text }]` in file order.
 * Open and blocked items become cards grouped by their file's `# ` title; every
 * other state, and an item with none, is counted in `rest`. `failure` is
 * `scopeFailure`'s, since a backlog that resolved nothing must not read as empty;
 * `readme` says `backlog/README.md` is in the tree, which is what makes it empty.
 */
export function backlogOf(files, { readme = false } = {}) {
  const items = [];
  const counts = {};
  let parsed = 0;
  for (const { path, text } of files) {
    const group = /^#\s+(.+?)\s*$/m.exec(text)?.[1] ?? path;
    for (const item of parseBacklog(text)) {
      parsed += 1;
      if (!BACKLOG_COLUMNS.some((c) => c.key === item.status)) {
        const key = item.status ?? 'none';
        counts[key] = (counts[key] ?? 0) + 1;
        continue;
      }
      items.push({
        id: `${path}#${item.title}`,
        path,
        group,
        title: item.title,
        status: item.status,
        reason: item.statusReason.replace(/^[—–-]\s*/, ''),
        owner: item.owner === NO_OWNER ? null : item.owner,
        body: item.body,
      });
    }
  }
  const order = (key) => (STATUSES.includes(key) ? STATUSES.indexOf(key) : STATUSES.length);
  const rest = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => order(a) - order(b)));
  return { items, rest, failure: scopeFailure({ files: files.length, items: parsed, readme }) };
}
