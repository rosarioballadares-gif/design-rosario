/**
 * What were the subagents actually ASKED for, and on which model did it run?
 *
 * `pnpm cost` answers what subagents SPENT — 83.036 calls and 6.8k USD measured
 * 2026-09-11, `7c15bb5`, with 82.353 of those calls on `claude-opus-5` against
 * 530 on `claude-sonnet-5`. It cannot say what any of them were for, so it
 * cannot say whether the `census` rung of
 * `.claude/skills/model-and-effort/SKILL.md` was disobeyed on work that row
 * covers, or merely never applied.
 *
 * This reads the opening prompt of each sidechain transcript and buckets it.
 * **The bucketing is a word match and nothing more.** It is reported beside an
 * `unclassified` bucket and a full TSV on disk precisely so a person can read
 * what the words missed — a classifier that reported only its own hits would be
 * measuring itself, which is the defect `transcript-walk.mjs` was written to
 * close.
 *
 * Scope is printed on the first lines and the verdict on the last, so a
 * `tail -20` still says what was measured.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, basename } from 'node:path';

import { transcriptsUnder } from './transcript-walk.mjs';
import {
  RATES_SOURCE,
  addCall,
  emptyTotals,
  isFreeModel,
  normalizeModel,
  scopeFailure,
  tokensFrom,
} from './cost-rates.mjs';
import { SHAPE_KEYS, openingPrompt, shapeOf } from './subagent-shape-rules.mjs';
import { mainCheckout, projectSlug } from './skill-routing-rules.mjs';

const PROJECTS = join(homedir(), '.claude', 'projects');

const args = process.argv.slice(2);
const flagAfter = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const wantsAll = args.includes('--all');
const project = flagAfter('--project', projectSlug(mainCheckout(process.cwd())));
const outPath = flagAfter('--out', '');

function projectDirs() {
  let entries;
  try {
    entries = readdirSync(PROJECTS, { withFileTypes: true });
  } catch (error) {
    console.error(`FAIL - could not read ${PROJECTS}.`);
    console.error(`  ${error.message}`);
    console.error('  A check that could not run is not a check that passed.');
    process.exit(1);
  }
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => join(PROJECTS, e.name));
  if (wantsAll) return dirs;

  /* Derived from the MAIN checkout, never from `process.cwd()` alone: this
   * runs from a worktree, whose cwd slugs to a directory that has never held a
   * transcript. `--project` still names another. */
  const mine = dirs.filter((d) => basename(d).toLowerCase() === project.toLowerCase());
  if (mine.length) return mine;

  console.error(`FAIL - no transcript directory named ${project} under ${PROJECTS}.`);
  console.error(`  ${dirs.length} are there. Pass --project <slug> or --all.`);
  process.exit(1);
}

const dirs = projectDirs();
const files = transcriptsUnder(dirs).filter((f) => f.sidechain);

const perShape = new Map(SHAPE_KEYS.map((k) => [k, { transcripts: 0, ...emptyTotals() }]));
const perShapeModel = new Map(SHAPE_KEYS.map((k) => [k, new Map()]));
const rows = [];
const byDay = new Map();
const byDayCalls = new Map();
let promptless = 0;
let calls = 0;
let priced = 0;

for (const file of files) {
  let entries;
  try {
    entries = readFileSync(file.path, 'utf8')
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
    continue; /* a transcript that vanished mid-walk */
  }

  const prompt = openingPrompt(entries);
  if (!prompt) promptless += 1;
  const shape = prompt ? shapeOf(prompt) : 'unclassified';

  const totals = emptyTotals();
  const models = new Map();
  for (const entry of entries) {
    const usage = entry?.message?.usage;
    if (!usage) continue;
    const model = normalizeModel(entry?.message?.model);
    const tokens = tokensFrom(usage);
    addCall(totals, tokens, model);
    calls += 1;
    if (!isFreeModel(model)) priced += 1;
    models.set(model, (models.get(model) ?? 0) + 1);
  }

  const bucket = perShape.get(shape);
  bucket.transcripts += 1;
  bucket.calls += totals.calls;
  bucket.usd += totals.usd;
  const modelBucket = perShapeModel.get(shape);
  for (const [m, n] of models) modelBucket.set(m, (modelBucket.get(m) ?? 0) + n);

  const dominant = [...models.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '(none)';
  /* The day the subagent ran, from the first entry that carries a timestamp.
   * Without it the shape table cannot say whether a pattern is current or was
   * already switched off — `ultracode` went to `false` on 2026-09-10, so a
   * verdict that ignores the date would price a fan-out nobody can launch now. */
  const day = entries.find((e) => e?.timestamp)?.timestamp?.slice(0, 10) ?? '(undated)';
  byDay.set(day, (byDay.get(day) ?? 0) + totals.usd);
  byDayCalls.set(day, (byDayCalls.get(day) ?? 0) + totals.calls);
  rows.push({
    shape,
    day,
    model: dominant,
    calls: totals.calls,
    usd: totals.usd,
    prompt: prompt.replace(/\s+/g, ' ').slice(0, 300),
    path: file.path,
  });
}

const failedScope = scopeFailure({ files: files.length, calls, priced });

const usd = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(n < 10 ? 2 : 0));
const int = (n) => Math.round(n).toLocaleString('en-US');
const pct = (part, whole) => (whole === 0 ? '0.0' : ((part / whole) * 100).toFixed(1));

console.log('');
console.log('SUBAGENT SHAPES - what the sidechain transcripts were asked for');
console.log(`  projects   ${dirs.map((d) => basename(d)).join(', ')}`);
console.log(`  sidechain  ${int(files.length)} transcript(s), ${int(calls)} call(s), ${int(priced)} priced`);
console.log(`  promptless ${int(promptless)} transcript(s) had no readable opening prompt`);
console.log(`  rates      ${RATES_SOURCE}`);
console.log('');

if (failedScope) {
  console.error(failedScope);
  process.exit(1);
}

const totalUsd = [...perShape.values()].reduce((s, b) => s + b.usd, 0);
const totalCalls = [...perShape.values()].reduce((s, b) => s + b.calls, 0);

console.log('  shape          transcripts        calls         USD    share   dominant model');
for (const key of SHAPE_KEYS) {
  const b = perShape.get(key);
  if (!b.transcripts) continue;
  const top = [...perShapeModel.get(key).entries()].sort((x, y) => y[1] - x[1])[0];
  const label = top ? `${top[0]} ${pct(top[1], b.calls)}%` : '(none)';
  console.log(
    `  ${key.padEnd(14)} ${int(b.transcripts).padStart(11)} ${int(b.calls).padStart(12)} ` +
      `${usd(b.usd).padStart(11)} ${(pct(b.usd, totalUsd) + '%').padStart(7)}   ${label}`,
  );
}
console.log(`  ${'TOTAL'.padEnd(14)} ${int(files.length).padStart(11)} ${int(totalCalls).padStart(12)} ${usd(totalUsd).padStart(11)}`);
console.log('');

const census = perShape.get('census');
const censusModels = [...perShapeModel.get('census').entries()].sort((a, b) => b[1] - a[1]);
const onSonnet = censusModels.find(([m]) => m.includes('sonnet'))?.[1] ?? 0;
console.log('CENSUS-SHAPED WORK, which the ladder sends to `sonnet` at effort `low`');
for (const [m, n] of censusModels) console.log(`  ${m.padEnd(28)} ${int(n).padStart(10)} call(s)  ${pct(n, census.calls)}%`);
console.log(`  obeyed  ${pct(onSonnet, census.calls)}% of census-shaped calls ran on a sonnet model`);
console.log(`  at stake  ${usd(census.usd)} USD, ${pct(census.usd, totalUsd)}% of subagent spend`);
console.log('');

console.log('SUBAGENT SPEND BY DAY - is this pattern current, or already switched off?');
for (const [day, spend] of [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
  if (spend < 1) continue;
  console.log(`  ${day}  ${usd(spend).padStart(8)} USD  ${int(byDayCalls.get(day)).padStart(8)} call(s)`);
}
console.log('');

if (outPath) {
  const tsv = ['shape\tday\tmodel\tcalls\tusd\tprompt\tpath']
    .concat(rows.map((r) => [r.shape, r.day, r.model, r.calls, r.usd.toFixed(4), r.prompt, r.path].join('\t')))
    .join('\n');
  writeFileSync(outPath, tsv, 'utf8');
  console.log(`  TSV  ${rows.length} row(s) written to ${outPath}`);
}

console.log('  The bucketing is a WORD MATCH over the opening prompt, first match wins in');
console.log('  ladder order. It says what was asked for, never whether the answer was right,');
console.log('  and the `unclassified` row plus the TSV are what a person reads to see what');
console.log('  the words missed.');
