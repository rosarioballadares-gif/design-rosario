/**
 * The after-figures for the two brief rules that were argued from a before.
 *
 * On 2026-09-14 three changes landed on the strength of measurements over 64
 * and 66 enforced briefs: the field caps went to the p75 of that corpus, and
 * `## Autonomy` was asked for the row it did not take, written at the time in
 * 3 per cent of briefs. Each was argued from a number and not one had been
 * re-measured under the rule it produced.
 *
 * WHY THIS ABSTAINS INSTEAD OF ANSWERING. Run the day it was written, the
 * corpus under the tightened caps was ONE brief — the handoff that asked for
 * this. A mean over one file is not a small measurement, it is a different
 * claim in the same units, and it would have gone into a module comment beside
 * figures taken over 64. So the deliverable here is not a number: it is the
 * instrument, plus `AFTER_FIGURE_FLOOR` and the refusal to print below it.
 * The corpus grows on its own; this is what will be run when it has.
 *
 * WHY IT IS ON DEMAND AND GATES NOTHING. There is no failure for it to
 * report. A corpus too small is not a defect in anybody's work, and a check
 * that goes red because not enough days have passed is a check people learn to
 * ignore. It answers a question somebody asked; it does not stand guard.
 *
 * `--floor <n>` lowers the bar for one run, which is how the abstention itself
 * gets demonstrated. It prints what it did, because a figure quoted out of a
 * lowered run is the exact mistake this file exists to prevent.
 *
 * TEMPLATE HISTORY. The rules it measures were argued in the repository this
 * template was harvested from; it stays as that repository left it.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AFTER_FIGURE_FLOOR,
  BRIEF_FIELDS,
  BUDGET_TIGHTENED_FROM,
  REJECTED_RUNG,
  REJECTED_RUNG_ASKED_FROM,
  TIGHTENED_FIELD_BUDGET,
  sectionFor,
  splitSections,
} from './brief-fields.mjs';

const BRIEFS = join(dirname(fileURLToPath(import.meta.url)), '..', 'briefs');

/** `YYYY-MM-DD` at the start of a brief's filename, which is what dates it. */
const DATED = /^(\d{4}-\d{2}-\d{2})-/;

/**
 * The before-figures, as the module comment in `brief-fields.mjs` recorded
 * them. Quoted rather than recomputed: they were taken over a corpus that has
 * since grown, so re-deriving them today would move the baseline the after is
 * being compared against.
 */
const BEFORE_P75 = {
  Objective: 347,
  Differentiator: 593,
  'Context and rules': 1005,
  Dependencies: 273,
  Scope: 542,
  Tasks: 597,
  Autonomy: 172,
  Validation: 685,
};

/** The share of briefs naming a rejected rung, over the 66 enforced on 2026-09-14. */
const BEFORE_REJECTED_RUNG = 3;

const floorArg = process.argv.indexOf('--floor');
const floor = floorArg === -1 ? AFTER_FIGURE_FLOOR : Number(process.argv[floorArg + 1]);
if (!Number.isInteger(floor) || floor < 1) {
  console.error('brief-after: --floor takes a whole number of briefs, 1 or more.');
  process.exit(2);
}

/** Every dated brief, newest last, with its sections already split. */
const corpus = readdirSync(BRIEFS)
  .filter((name) => DATED.test(name))
  .sort()
  .map((name) => ({
    name,
    date: DATED.exec(name)[1],
    sections: splitSections(readFileSync(join(BRIEFS, name), 'utf8')),
  }));

const from = (date) => corpus.filter((brief) => brief.date >= date);

const bodyOf = (brief, field) => {
  const section = sectionFor(brief.sections, field);
  return section ? section.body : null;
};

/** The value at a percentile of an ascending list, by nearest rank. */
const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

const signed = (n) => (n > 0 ? `+${n}` : String(n));

console.log(`brief-after: the after-figures for two rules argued from a before.`);
console.log(`Scope: ${corpus.length} dated briefs in briefs/. Floor ${floor}${
  floorArg === -1 ? '' : ' — LOWERED for this run with --floor'
}.`);
console.log(`It reads sizes and one convention. It cannot tell whether a field is any good.\n`);

let abstained = 0;

/* ---- The caps ---------------------------------------------------------- */

const capped = from(BUDGET_TIGHTENED_FROM);
console.log(`FIELD CAPS — briefs dated from ${BUDGET_TIGHTENED_FROM}, held to TIGHTENED_FIELD_BUDGET`);
console.log(`  corpus: ${capped.length} brief(s)`);

if (capped.length < floor) {
  abstained += 1;
  console.log(`  ABSTAINS: ${floor - capped.length} short of the floor of ${floor}.`);
  console.log(`  The before-figures were taken over 64 briefs. Nothing is printed here`);
  console.log(`  because a figure over ${capped.length} would be quoted beside them as if it were one.\n`);
} else {
  console.log(`  field                 n    p50    p75    max    cap   over   p75 was   moved`);
  for (const field of BRIEF_FIELDS) {
    const cap = TIGHTENED_FIELD_BUDGET[field];
    if (cap === undefined) continue;
    const sizes = capped
      .map((brief) => bodyOf(brief, field))
      .filter((body) => body !== null)
      .map((body) => Buffer.byteLength(body, 'utf8'))
      .sort((a, b) => a - b);
    if (sizes.length === 0) {
      console.log(`  ${field.padEnd(20)} ${String(0).padStart(3)}      —      —      —  ${String(cap).padStart(5)}      —`);
      continue;
    }
    const p75 = percentile(sizes, 75);
    const over = sizes.filter((n) => n > cap).length;
    console.log(
      `  ${field.padEnd(20)} ${String(sizes.length).padStart(3)} ` +
        `${String(percentile(sizes, 50)).padStart(6)} ${String(p75).padStart(6)} ` +
        `${String(sizes[sizes.length - 1]).padStart(6)} ${String(cap).padStart(6)} ` +
        `${String(over).padStart(6)} ${String(BEFORE_P75[field]).padStart(9)} ` +
        `${signed(p75 - BEFORE_P75[field]).padStart(7)}`,
    );
  }
  console.log(
    `  A cap nothing reaches has stopped checking — read the "over" column against that,\n` +
      `  not as a score. Zero everywhere means the ceiling is above the work again.\n`,
  );
}

/* ---- The rejected rung ------------------------------------------------- */

const asked = from(REJECTED_RUNG_ASKED_FROM);
console.log(`REJECTED RUNG — briefs dated from ${REJECTED_RUNG_ASKED_FROM}, asked for the row not taken`);
console.log(`  corpus: ${asked.length} brief(s)`);

if (asked.length < floor) {
  abstained += 1;
  console.log(`  ABSTAINS: ${floor - asked.length} short of the floor of ${floor}.`);
  console.log(`  Before: ${BEFORE_REJECTED_RUNG} per cent of 66. Nothing is printed here for the same reason.\n`);
} else {
  const named = asked.filter((brief) => {
    const body = bodyOf(brief, 'Autonomy');
    /* A fresh lastIndex every time: the shared regex is global, and a sticky
     * one silently skips every other brief. */
    REJECTED_RUNG.lastIndex = 0;
    return body ? REJECTED_RUNG.test(body) : false;
  });
  const share = Math.round((100 * named.length) / asked.length);
  console.log(`  names a rejected rung: ${named.length} of ${asked.length} — ${share} per cent`);
  console.log(`  before: ${BEFORE_REJECTED_RUNG} per cent of 66 — moved ${signed(share - BEFORE_REJECTED_RUNG)} points`);
  console.log(
    `  This counts the FORM, never the judgement. A rejected rung typed to satisfy the\n` +
      `  template counts here exactly like one that was weighed.\n`,
  );
}

/* ---- Verdict ----------------------------------------------------------- */

if (abstained === 0) {
  console.log(`brief-after: both figures measured, over a corpus at or above the floor of ${floor}.`);
} else {
  console.log(
    `brief-after: ${abstained} of 2 figures ABSTAINED — the corpus is too small, which is not a\n` +
      `failure of anybody's work. Re-run when it has grown; nothing needs repairing today.`,
  );
}
