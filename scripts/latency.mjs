/**
 * `pnpm latency` — where the wall clock goes, and what it is not.
 *
 *   pnpm latency                 this project
 *   pnpm latency --all           every project on this machine
 *   pnpm latency --days 7        the last 7 calendar days that have data
 *   pnpm latency --idle 20       what counts as a session left open, in minutes
 *
 * The companion of `pnpm cost`, and deliberately not part of it: cost is priced
 * from `usage` and is exact, latency is derived from client timestamps and is a
 * proxy. Mixing an exact figure and a proxy in one table is how the proxy gets
 * quoted as if it were measured.
 *
 * **Read the caveat before the numbers.** `message.diagnostics` is null in every
 * entry, so no transcript holds server timing. Everything here comes from
 * `timestamp`, written by the client when it persists an entry. It therefore
 * contains the client's own overhead, and in any session that was not running
 * in bypass mode it also contains the time a human spent looking at a
 * permission prompt. That is why `--idle` exists and why nothing here is a mean.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { readdirSync } from 'node:fs';
import { classify, percentiles, rankCorrelation, sessionOpening, usageOf } from './latency-rules.mjs';
import { transcriptsUnder } from './transcript-walk.mjs';

const args = process.argv.slice(2);
const wantsAll = args.includes('--all');
const numberAfter = (flag, fallback) => {
  const i = args.indexOf(flag);
  if (i === -1) return fallback;
  const n = Number(args[i + 1]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const dayLimit = numberAfter('--days', 0);
const idleMs = numberAfter('--idle', 20) * 60 * 1000;

const PROJECTS = join(homedir(), '.claude', 'projects');

/**
 * The transcript directory for a working directory.
 *
 * The mangling rule and the folded match are `session-cost.mjs`'s, copied
 * rather than re-derived — including the reason the character class carries no
 * `+`: `C:\design-ops` mangles to `c--design-ops` because the colon and the
 * separator EACH become a dash, and collapsing them yields `c-design-ops`,
 * which matches nothing and falls through to reading every client on the
 * machine. Both case variants exist on this disk, so the match is folded.
 */
const slugFor = (dir) => dir.replace(/[^A-Za-z0-9]/g, '-').toLowerCase();

function ownDirs(all) {
  let entries;
  try {
    entries = readdirSync(PROJECTS, { withFileTypes: true });
  } catch (error) {
    console.error(`FAIL — could not read ${PROJECTS}.`);
    console.error(`  ${error.message}`);
    console.error('  A check that could not run is not a check that passed.');
    process.exit(1);
  }
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => join(PROJECTS, e.name));
  if (all) return dirs;

  const cwd = process.cwd();
  const match = (dir) => dirs.filter((d) => basename(d).toLowerCase() === slugFor(dir));

  /* A worktree gets its own path, so the CLI files the transcripts written
   * after `EnterWorktree` under a SECOND directory — and that one holds only
   * the tail of one session. Measured 2026-09-11: the first version of this
   * function matched it exactly, read 1 file of 1.824, and printed a confident
   * table over 36 requests. Both directories are read, and both are named. */
  const worktree = cwd.match(/^(.*?)[\\/]\.claude[\\/]worktrees[\\/]/);
  const both = [...new Set([...(worktree ? match(worktree[1]) : []), ...match(cwd)])];
  if (both.length) return both;

  /* No silent widening. Reading every project when this one did not resolve is
   * how a scope error becomes a number nobody questions. */
  console.error('FAIL — no transcript directory matches this working directory.');
  console.error(`  cwd         ${cwd}`);
  console.error(`  looked for  ${slugFor(cwd)}`);
  console.error(`  under       ${PROJECTS}`);
  console.error('');
  console.error(`  ${dirs.length} project director(ies) are there. Pass --all to read all of them,`);
  console.error('  which measures every client on this machine and not this repository.');
  process.exit(1);
}

const dirs = ownDirs(wantsAll);

const files = transcriptsUnder(dirs);
const cutoff = dayLimit ? Date.now() - dayLimit * 24 * 60 * 60 * 1000 : 0;

/** Every gap, and every request, with the segment labels the report cuts by. */
const gaps = [];
const requests = [];
/** One entry per main-session transcript: what ran before its first edit. */
const openings = [];
let parsed = 0;
let unreadable = 0;
let unanswered = 0;
let orphanResults = 0;

for (const { path, sidechain } of files) {
  let entries;
  try {
    entries = readFileSync(path, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    unreadable += 1;
    continue;
  }
  parsed += 1;

  const out = classify(entries, { idleMs });
  unanswered += out.unansweredCalls;
  orphanResults += out.unmatchedResults;

  for (const gap of out.gaps) {
    const when = gap.run ? usageOf(gap.run).at : null;
    if (cutoff && when && when < cutoff) continue;
    gaps.push({ ...gap, sidechain, session: basename(path, '.jsonl') });
  }
  for (const run of out.runs) {
    const u = usageOf(run);
    if (cutoff && u.at && u.at < cutoff) continue;
    requests.push({ ...u, sidechain, blocks: run.blocks.length });
  }

  /* Main sessions only. A subagent has no opening in this sense — nobody typed
   * into it, and its first turn is a prompt this session already wrote. */
  if (sidechain) continue;
  const opening = sessionOpening(entries, { idleMs });
  if (!opening) continue;
  if (cutoff && opening.at < cutoff) continue;
  openings.push(opening);
}

/* The scope gate. A run that classified nothing must fail rather than print a
 * table of zeros — the same rule every check here follows, and the reason
 * `pnpm cost` exits 1 instead of printing a zero it did not measure. */
if (!gaps.length) {
  console.error('FAIL — read the transcripts and classified no gap at all.');
  console.error(`  ${files.length} transcript file(s) under ${dirs.length} director(ies).`);
  console.error('  Either the window is empty, or the entry shape changed.');
  process.exit(1);
}

const main = gaps.filter((g) => !g.sidechain);
const side = gaps.filter((g) => g.sidechain);
const mainRequests = requests.filter((r) => !r.sidechain);

const ms = (v) => (v === null ? '—' : v >= 10_000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`);
const pick = (list, kind) => list.filter((g) => g.kind === kind).map((g) => g.ms);
const sum = (values) => values.reduce((s, v) => s + v, 0);
const hours = (values) => (sum(values) / 3_600_000).toFixed(1);

const idle = main.filter((g) => g.kind === 'idle');
const human = main.filter((g) => g.kind === 'human');
const measured = main.filter((g) => g.kind !== 'idle' && g.kind !== 'human');

console.log('pnpm latency — wall clock from client timestamps, NOT server latency.');
console.log(
  `  scope: ${parsed} transcript(s) read of ${files.length} found` +
    `${dayLimit ? `, last ${dayLimit} day(s)` : ''}.`,
);
/* Named, not counted. A directory count cannot tell a reader that the run
 * measured the wrong one, and that is the failure this line was added for. */
for (const dir of dirs) console.log(`    ${basename(dir)}`);
/* Counted so the run can be reconciled against `pnpm cost`, which prices
 * assistant BLOCKS and reports subagents apart. A request is several blocks, so
 * requests and priced calls differ by construction; main-session blocks are the
 * figure that lines up, and the split is printed for that reason alone. */
const blocksIn = (list) => list.reduce((n, r) => n + r.blocks, 0);
console.log(
  `  ${mainRequests.length} main-session request(s) over ${blocksIn(mainRequests)} assistant block(s)` +
    ` — that block count is what \`pnpm cost\` prices as calls.`,
);
console.log(
  `  ${requests.length - mainRequests.length} subagent request(s) over` +
    ` ${blocksIn(requests.filter((r) => r.sidechain))} block(s), reported apart throughout.`,
);
console.log(
  `  classified ${measured.length} gap(s); excluded ${idle.length} idle ` +
    `(over ${idleMs / 60000} min, ${hours(idle.map((g) => g.ms))} h) ` +
    `and ${human.length} human (${hours(human.map((g) => g.ms))} h).`,
);
if (unreadable) console.log(`  ${unreadable} file(s) could not be read.`);
console.log(
  `  ${unanswered} tool call(s) nothing answered, ${orphanResults} result(s) with no call here.`,
);
console.log('');

console.log('Main sessions, by kind');
console.log('  kind      n        p50       p90       p99     total');
for (const kind of ['wait', 'gen', 'tool']) {
  const values = pick(main, kind);
  const p = percentiles(values);
  const label = kind.padEnd(8);
  console.log(
    `  ${label}${String(values.length).padStart(6)}  ${ms(p[50]).padStart(9)}` +
      ` ${ms(p[90]).padStart(9)} ${ms(p[99]).padStart(9)}` +
      ` ${hours(values).padStart(7)} h`,
  );
}
const lost = main.filter((g) => g.kind === 'idle' && g.was);
if (lost.length) {
  const byWas = {};
  for (const g of lost) byWas[g.was] = (byWas[g.was] ?? 0) + 1;
  console.log(
    `  samples lost to the idle threshold: ${Object.entries(byWas)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}`,
  );
}
console.log('');

/* The question the whole instrument was built for: does a fuller session wait
 * longer? If it does, session hygiene is the speed lever too, and that
 * mechanism already exists. If it does not, the perceived slowness is
 * elsewhere and the next brief goes elsewhere. */
const waits = main.filter((g) => g.kind === 'wait' && g.run);
const pairs = waits.map((g) => [usageOf(g.run).context, g.ms]);
const rho = rankCorrelation(pairs);
console.log('Does waiting grow with context?');
console.log(
  `  Spearman rho over ${pairs.length} request(s): ` +
    (rho === null ? 'not enough data (under 30)' : rho.toFixed(3)),
);
const buckets = [0, 50_000, 100_000, 200_000, 400_000, 800_000];
console.log('  context           n        p50       p90');
for (let i = 0; i < buckets.length; i += 1) {
  const lo = buckets[i];
  const hi = buckets[i + 1] ?? Infinity;
  const inBucket = pairs.filter(([c]) => c >= lo && c < hi).map(([, v]) => v);
  if (!inBucket.length) continue;
  const p = percentiles(inBucket);
  const label = `${(lo / 1000).toFixed(0)}k–${hi === Infinity ? '∞' : `${(hi / 1000).toFixed(0)}k`}`;
  console.log(
    `  ${label.padEnd(16)}${String(inBucket.length).padStart(6)}` +
      `  ${ms(p[50]).padStart(9)} ${ms(p[90]).padStart(9)}`,
  );
}
console.log('');

console.log('Generating, against what was generated');
const gens = main.filter((g) => g.kind === 'gen' && g.run);
const think = gens.map((g) => [usageOf(g.run).thinking, g.ms]);
const outs = gens.map((g) => [usageOf(g.run).output, g.ms]);
console.log(`  rho against thinking tokens: ${fmtRho(rankCorrelation(think))}`);
console.log(`  rho against output tokens:   ${fmtRho(rankCorrelation(outs))}`);
console.log('');

console.log('Slowest tools, by total wall clock');
const byTool = new Map();
for (const g of main) {
  if (g.kind !== 'tool') continue;
  if (!byTool.has(g.tool)) byTool.set(g.tool, []);
  byTool.get(g.tool).push(g.ms);
}
const tools = [...byTool.entries()].sort((a, b) => sum(b[1]) - sum(a[1])).slice(0, 12);
console.log('  tool                        n        p50       p90     total');
for (const [name, values] of tools) {
  const p = percentiles(values);
  console.log(
    `  ${name.slice(0, 26).padEnd(26)}${String(values.length).padStart(6)}` +
      `  ${ms(p[50]).padStart(9)} ${ms(p[90]).padStart(9)}` +
      ` ${hours(values).padStart(7)} h`,
  );
}
console.log('');

console.log('By effort, and by day');
effortTable(waits, gens);
console.log('');

const byDay = new Map();
for (const g of measured) {
  const when = g.run ? usageOf(g.run).at : null;
  if (!when) continue;
  const day = new Date(when).toISOString().slice(0, 10);
  if (!byDay.has(day)) byDay.set(day, { wait: [], gen: [] });
  if (g.kind === 'wait' || g.kind === 'gen') byDay.get(day)[g.kind].push(g.ms);
}
const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-14);
console.log('  day               n   wait p50   wait p90    gen p50');
for (const [day, v] of days) {
  console.log(
    `  ${day}  ${String(v.wait.length).padStart(6)}` +
      `  ${ms(percentiles(v.wait)[50]).padStart(9)} ${ms(percentiles(v.wait)[90]).padStart(9)}` +
      ` ${ms(percentiles(v.gen)[50]).padStart(9)}`,
  );
}
console.log('');

/* The slowness a person meets first. Everything above measures a turn; this
 * measures the stretch between typing a request and seeing a file change, which
 * is the part nobody had a number for. The three populations are printed apart
 * because only the first answers the question — see `sessionOpening`. */
console.log('The session opening — what runs before the first edit');
const straight = openings.filter((o) => o.kind === 'straight');
const deferred = openings.filter((o) => o.kind === 'deferred');
const never = openings.filter((o) => o.kind === 'never');
console.log(
  `  ${openings.length} main session(s) with a typed prompt: ${straight.length} straight,` +
    ` ${deferred.length} deferred to a later turn, ${never.length} that never edited.`,
);
if (!straight.length) {
  console.log('  No session edited inside its first turn in this window — nothing to report.');
} else {
  const callsP = percentiles(straight.map((o) => o.calls));
  const msP = percentiles(straight.map((o) => o.ms));
  console.log('  straight openings      n        p50       p90       p99');
  console.log(
    `  tool calls        ${String(straight.length).padStart(6)}` +
      `  ${String(callsP[50]).padStart(9)} ${String(callsP[90]).padStart(9)}` +
      ` ${String(callsP[99]).padStart(9)}`,
  );
  console.log(
    `  wall clock        ${String(straight.length).padStart(6)}` +
      `  ${ms(msP[50]).padStart(9)} ${ms(msP[90]).padStart(9)} ${ms(msP[99]).padStart(9)}`,
  );
  /* Both are inside the wall clock above and neither is agent overhead. The gate
   * is SUPPOSED to cost the first; the second is a session left open. */
  console.log(
    `  of that total, ${hours(straight.map((o) => o.humanMs))} h was a person answering a question` +
      ` and ${hours(straight.map((o) => o.idledMs))} h sat over the idle threshold.`,
  );
  /* Which mechanism decided it. `bash` runs through the `writesAFile` heuristic,
   * so this line is how much weight that heuristic is carrying. */
  const byBash = straight.filter((o) => o.by === 'bash').length;
  console.log(
    `  decided by a dedicated edit tool ${straight.length - byBash}, by a Bash write ${byBash}` +
      ' — the second is a heuristic, see `writesAFile`.',
  );
  const beforeEdit = new Map();
  for (const o of straight) {
    for (const name of o.tools) beforeEdit.set(name, (beforeEdit.get(name) ?? 0) + 1);
  }
  const top = [...beforeEdit.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(`  what those calls were: ${top.map(([n, c]) => `${n} ${c}`).join(', ')}`);
}
console.log('');

/* Reported apart, never summed in. A subagent runs concurrently with its
 * parent, so its wall clock overlaps the parent's; adding the two would count
 * the same minute twice. This is the rule `pnpm cost` already follows for
 * subagent spend, for the same reason. */
if (side.length) {
  const sw = pick(side, 'wait');
  const sg = pick(side, 'gen');
  console.log('Subagents, reported apart — their wall clock OVERLAPS the parent session');
  console.log(
    `  ${sw.length} wait, p50 ${ms(percentiles(sw)[50])}, p90 ${ms(percentiles(sw)[90])};` +
      ` ${sg.length} gen, p50 ${ms(percentiles(sg)[50])}`,
  );
  /* The only matched effort comparison available from one session. A subagent
   * takes its effort from its own definition file, so two definitions differing
   * in that one line, handed the same constant prompt, are an A/B — see
   * `scripts/effort-probe-prompt.txt` and `effortTable` for what invalidates it. */
  const cut = effortTable(
    side.filter((g) => g.kind === 'wait' && g.run),
    side.filter((g) => g.kind === 'gen' && g.run),
  );
  if (cut.size < 2) {
    console.log('  One effort only — nothing is being compared here, whatever the row says.');
  }
  console.log('');
}

console.log('These are client timestamps. They include the CLI\'s own overhead, and');
console.log('in any session not running in bypass mode they include the time a person');
console.log('spent looking at a permission prompt. No transcript holds server timing.');

function fmtRho(value) {
  return value === null ? 'not enough data (under 30)' : value.toFixed(3);
}

/**
 * Wait and gen p50 cut by the effort each request ran at.
 *
 * Printed for main sessions and, separately, for subagents. The second is what
 * an A/B needs: a session cannot change its own effort, but `.claude/agents/*.md`
 * takes an `effort` key, so two agent definitions differing in that one line are
 * the only matched comparison available here.
 *
 * **The key fails SILENTLY when misspelled** — it falls back to the session
 * default with no warning. So the arms are read back from the transcripts rather
 * than assumed: if both come out under one effort name, the lever did not engage
 * and there is no experiment, however different the two numbers look.
 */
function effortTable(waitGaps, genGaps) {
  const byEffort = new Map();
  const bucket = (e) => {
    if (!byEffort.has(e)) byEffort.set(e, { wait: [], gen: [] });
    return byEffort.get(e);
  };
  for (const g of waitGaps) bucket(usageOf(g.run).effort).wait.push(g.ms);
  for (const g of genGaps) bucket(usageOf(g.run).effort).gen.push(g.ms);
  console.log('  effort          n   wait p50    gen p50');
  for (const [name, v] of [...byEffort.entries()].sort((a, b) => b[1].wait.length - a[1].wait.length)) {
    console.log(
      `  ${name.padEnd(12)}${String(v.wait.length).padStart(6)}` +
        `  ${ms(percentiles(v.wait)[50]).padStart(9)} ${ms(percentiles(v.gen)[50]).padStart(9)}`,
    );
  }
  return byEffort;
}
