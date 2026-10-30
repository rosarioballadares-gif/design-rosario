/**
 * Keeps what `pnpm cost` and `pnpm routing` measured, past the window that
 * erases it.
 *
 * **The window erases itself and it is small.** Measured 2026-09-12: `pnpm
 * cost` read 2.616 priced calls over SIX days — 08-22, 08-29, 08-30, 08-31,
 * 09-12, 09-13 — while `git log` counts 58, 46, 45, 4, 11, 51, 30, 69, 92 and
 * 70 commits on 09-01 through 09-11. Every one of those days is unreadable.
 * `CLAUDE.md`'s "Measured 2026-09-10: 15.967 calls at 354 tokens each" cannot
 * be re-derived on this machine today, and nothing announced that.
 *
 * **It runs on a person's own machine, on demand, and nothing schedules it.**
 * A day nobody ran it on is lost exactly as before — the session-start notice
 * is a nudge, not a guarantee. Automating it would mean a launchd job that no
 * clone of this repository has, which is a different promise from the one the
 * store makes.
 *
 * **It does not pass `--all`.** That flag reaches every project on this
 * machine, and there is a second one under `~/.claude/projects` that has
 * nothing to do with this repository. A store that quietly absorbed it would
 * report another project's spend as this one's.
 *
 * Usage:
 *   pnpm snapshot          read both tools and merge into metrics/
 *   pnpm snapshot --dry    read both and print what WOULD change, writing nothing
 *   pnpm snapshot --recount  rewrite routing-sessions.json from a fresh reading,
 *                            for the day a counting RULE changed and the stored
 *                            rows are wrong rather than merely lighter
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  daysSinceNewest,
  keyBy,
  mergeStore,
  recountStore,
  serialize,
  weighCalls,
  weighRouting,
} from './snapshot-rules.mjs';

const dry = process.argv.includes('--dry');
/* Only routing is recountable: a lighter COST row means a transcript rolled off
 * disk, which is lost evidence, never a correction. See `recountStore`. */
const recount = process.argv.includes('--recount');
const STORE = join(process.cwd(), 'metrics');

/* A transcript's day comes from an ISO timestamp sliced at ten characters, so
 * it is UTC. The snapshot's own key is taken the same way rather than from the
 * local date, because a store where one column is UTC and another is -03 puts
 * a late-evening run under the wrong day in whichever column the reader trusts. */
const today = new Date().toISOString().slice(0, 10);

/** One tool, read as JSON. A tool that fails takes the whole run with it. */
function read(script, args) {
  try {
    const out = execFileSync(process.execPath, [join('scripts', script), '--json', ...args], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    return JSON.parse(out);
  } catch (error) {
    console.error(`\nFAIL - scripts/${script} did not produce a reading.`);
    /* Its own stderr, which already says WHY: the scope gate, an empty window,
     * a directory that matched nothing. Repeating that reasoning here would be
     * a second copy with nothing keeping the two in agreement. */
    const said = (error.stderr || '').toString().trim();
    console.error(said === '' ? `  ${error.message}` : said);
    console.error('\n  Nothing was written. A half-snapshot is worse than none:');
    console.error('  it looks like a measurement and names a window nobody took.\n');
    process.exit(1);
  }
}

const cost = read('session-cost.mjs', ['--tools']);
const routing = read('skill-routing.mjs', []);

console.log('\nSNAPSHOT - what the window still holds, kept where it cannot be erased.');
console.log(`  cost     ${cost.files} transcript(s), ${cost.pricedCalls} priced call(s) over ${Object.keys(cost.days).length} day(s)`);
console.log(`  routing  ${routing.read} transcript(s), window ${routing.window.first} to ${routing.window.last}, ${routing.window.empty} day(s) retained nothing`);
console.log(`  project  ${[...new Set([...cost.projects, ...routing.projects])].join(', ')}`);

/* The four additive stores, each keyed by an atom that a later reading can only
 * confirm or extend — and the one window store, which is keyed by the DATE OF
 * THE SNAPSHOT because what it holds is a measurement over a moving window
 * rather than a fact about one session. Summing two of its rows double-counts
 * every session both windows saw; that is why it lives in its own file with its
 * own name rather than beside the four. */
const additive = [
  ['cost-sessions.json', keyBy(cost.sessions, 'id'), weighCalls],
  ['cost-days.json', cost.days, weighCalls],
  ['cost-agents.json', keyBy(cost.agents, 'id'), weighCalls],
  ['routing-sessions.json', keyBy(routing.sessions, 'id'), weighRouting],
];

const load = (name) => {
  const path = join(STORE, name);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    console.error(`\nFAIL - metrics/${name} is on disk and is not readable JSON.`);
    console.error('  Refusing to overwrite it: a corrupt store still holds the only copy\n');
    process.exit(1);
  }
};

if (!dry && !existsSync(STORE)) mkdirSync(STORE, { recursive: true });

let touched = 0;
console.log('');
for (const [name, incoming, weigh] of additive) {
  if (recount && name === 'routing-sessions.json') {
    const { store, replaced, added, unreachable, kept } = recountStore(load(name), incoming);
    if (replaced.length || added.length) touched += 1;
    if (!dry) writeFileSync(join(STORE, name), serialize(store));
    console.log(
      `  ${name.padEnd(22)} ${String(kept).padStart(5)} row(s)  +${added.length} new, ${replaced.length} RECOUNTED, ${unreachable.length} unreachable`,
    );
    continue;
  }
  const { store, added, updated, kept } = mergeStore(load(name), incoming, weigh);
  if (added.length || updated.length) touched += 1;
  if (!dry) writeFileSync(join(STORE, name), serialize(store));
  console.log(
    `  ${name.padEnd(22)} ${String(kept).padStart(5)} row(s)  +${added.length} new, ${updated.length} grown`,
  );
}

/* Last run of the day wins, and this is the one store where that is right: a
 * window measured at 09:00 and again at 23:00 are two readings of the same
 * moving thing, not two things to add. */
const windows = load('windows.json');
windows[today] = {
  at: cost.generatedAt,
  cost: {
    files: cost.files,
    pricedCalls: cost.pricedCalls,
    freeCalls: cost.freeCalls,
    days: Object.keys(cost.days).sort(),
    sidechain: cost.sidechain,
  },
  routing: {
    files: routing.files,
    read: routing.read,
    window: routing.window,
  },
  /* Which skills routed on a description ON THIS DAY. The descriptions get
   * rewritten — 12 of them on 2026-09-12 — so a silence read back in a month
   * cannot be attributed to a sentence without this column. */
  skills: routing.skills,
  tools: cost.tools ?? null,
};
if (!dry) writeFileSync(join(STORE, 'windows.json'), serialize(windows));
console.log(`  ${'windows.json'.padEnd(22)} ${String(Object.keys(windows).length).padStart(5)} row(s)  ${today} written`);

const gap = daysSinceNewest(Object.keys(windows), today);
console.log('');
console.log(dry ? 'OK - nothing written (--dry).' : `OK - metrics/ holds ${Object.keys(windows).length} snapshot day(s).`);
console.log(`  ${touched === 0 ? 'No additive store moved: every row was already held.' : `${touched} additive store(s) moved.`}`);
if (gap !== null && gap > 0) console.log(`  The newest snapshot before this one was ${gap} day(s) old.`);
console.log('  What it cannot say: whether the store is COMPLETE. A day nobody ran');
console.log('  this on is gone exactly as before, and no check can find that out.');
console.log('');
