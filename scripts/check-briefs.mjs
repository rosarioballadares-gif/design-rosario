/**
 * Checks every brief in `briefs/`.
 *
 * Why briefs are files at all: a rehearsal of the product-manager-to-designer
 * handoff on 2026-08-13 found that nothing survived the conversation. The
 * manager answered the questions the context loader asked, the execution prompt
 * was filled in and approved, and then the designer opened a fresh session and
 * received the repository and nothing else. The facts the manager supplied had
 * exactly one prescribed destination — BACKLOG.md — and a brief for one screen
 * is not backlog material, so they went into a code comment.
 *
 * A file is the smallest thing that fixes that. The check is what stops it from
 * becoming a file nobody trusts.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BRIEF_FIELDS,
  BUDGET_TIGHTENED_FROM,
  BUDGET_RAISED_FROM,
  RAISED_FIELD_BUDGET,
  RUNGS,
  RUNG_REQUIRED_FROM,
  FIELD_BUDGET,
  LENGTH_CAPPED_FROM,
  TIGHTENED_FIELD_BUDGET,
  UPSTREAM_FIELDS,
  UPSTREAM_REQUIRED_FROM,
  budgetForBrief,
  rungAppliesTo,
  checkBrief,
  requiredFieldsForBrief,
} from './brief-fields.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIEFS = join(HERE, '..', 'briefs');

// The template is the one file that is SUPPOSED to be unfilled. It is checked
// in the opposite direction instead: it must FAIL, because a template that
// passes is a template somebody can copy, commit and ship empty.
const TEMPLATE = 'TEMPLATE.md';

let files;
try {
  files = readdirSync(BRIEFS).filter((f) => f.endsWith('.md'));
} catch (err) {
  // Only "there is no briefs directory" is a pass. Anything else — a rename, a
  // sparse checkout, a permission error — means the check could not read what
  // it was asked to read, and reporting green over that is the failure its
  // sibling check has a paragraph about. A bare catch here made the two checks
  // in the same change resolve the same question in opposite directions.
  if (err.code === 'ENOENT') {
    console.log('No briefs/ directory yet. Nothing to check.');
    process.exit(0);
  }
  console.error(`check:briefs could not read ${BRIEFS}`);
  console.error(`  ${err.code ?? 'error'}: ${err.message}`);
  process.exit(1);
}

let failed = 0;
let exempt = 0;

// The scope, printed before the verdict. These rules used to sit in CLAUDE.md,
// where every session paid for them and only the ones writing a brief could use
// them. They arrive here instead, at the moment they apply.
console.log(
  'check:briefs - every section needs a citation, a `> SOURCE: who, when`, or a `> GAP:`. No fourth state.',
);
console.log(`  ${BRIEF_FIELDS.length} fields: ${BRIEF_FIELDS.join(', ')}.`);
// Both tables, because a brief is held to the one its DATE picks and a run that
// printed only the current caps would explain half its own findings.
const budgetLine = (table) => BRIEF_FIELDS.map((f) => `${f} ${table[f] ?? '-'}`).join(', ');
console.log(`  byte budgets from ${LENGTH_CAPPED_FROM}: ${budgetLine(FIELD_BUDGET)}`);
console.log(`  byte budgets from ${BUDGET_TIGHTENED_FROM}: ${budgetLine(TIGHTENED_FIELD_BUDGET)}`);
console.log(`  byte budgets from ${BUDGET_RAISED_FROM}: ${budgetLine(RAISED_FIELD_BUDGET)}`);
// Singular since 2026-09-14, when the cut of `Key screen` left one upstream
// field. A hardcoded plural read as a bug in the count rather than in the line.
const n = UPSTREAM_FIELDS.length;
console.log(
  `  the ${n} upstream ${n === 1 ? 'field' : 'fields'} (${UPSTREAM_FIELDS.join(', ')}) ` +
    `${n === 1 ? 'is' : 'are'} asked of briefs dated from ${UPSTREAM_REQUIRED_FROM}.`,
);
// The ladder, printed rather than linked. Measured 2026-09-14: 40 of the 66
// enforced briefs pasted the same link into `## Autonomy` at 57 bytes each,
// 24 per cent of the field, so every author carried navigation that the run
// can hand them once. Built from RUNGS, so the ladder printed here cannot
// drift from the ladder `autonomyFailures` checks against.
console.log(
  `  from ${RUNG_REQUIRED_FROM}, "## Autonomy" names its rung and that rung's effort: ` +
    Object.entries(RUNGS)
      .map(([rung, effort]) => `${rung} ${effort}`)
      .join(', ') +
    '.',
);
console.log(
  '  the ladder is .claude/skills/model-and-effort/SKILL.md. Name the row you did NOT take, too.',
);
console.log('');

for (const file of files.sort()) {
  const text = readFileSync(join(BRIEFS, file), 'utf8');

  // Which fields this file has to carry depends on its date. The rule is in
  // brief-fields.mjs; reading the name is this script's job, because this is
  // the only place a filename exists.
  const required = requiredFieldsForBrief(file);
  const result = checkBrief(text, { required, budget: budgetForBrief(file), rung: rungAppliesTo(file) });

  if (file === TEMPLATE) {
    if (result.ok) {
      console.error(`FAIL ${file}`);
      console.error(
        '  The template passes its own check, which means an unfilled copy of it would too.',
      );
      console.error(
        '  Every prompt in it belongs inside a fenced block, so it reads as an example rather than an answer.',
      );
      failed++;
    } else {
      console.log(`ok   ${file} (fails on purpose: an unfilled brief must not pass)`);
    }
    continue;
  }

  if (result.ok) {
    const { cited, sourced, gaps } = result.stats;

    // Say when a green covered less than the full set. CLAUDE.md's rule about
    // a passing run whose scope goes unstated applies to this check as much as
    // to any other: without the note, fifty files would report the same "ok" as
    // a brief that answered all ten, and the exemption would be invisible in
    // the one output anybody reads.
    const short = BRIEF_FIELDS.length - required.length;
    if (short) exempt++;
    const scope = short ? ` — ${required.length}/${BRIEF_FIELDS.length} fields, predates ${UPSTREAM_REQUIRED_FROM}` : '';
    console.log(`ok   ${file}  ${cited} cited, ${sourced} attributed, ${gaps} stated gaps${scope}`);
  } else {
    console.error(`FAIL ${file}`);
    for (const f of result.findings) console.error(`  [${f.code}] ${f.detail}`);
    failed++;
  }
}

if (failed) {
  console.error('');
  console.error(`${failed} brief${failed === 1 ? '' : 's'} did not pass.`);
  console.error('A claim is cited, attributed to a person, or named as a gap. There is no fourth state.');
  process.exit(1);
}

console.log('');
console.log(`${files.length} file${files.length === 1 ? '' : 's'} checked.`);
if (exempt) {
  console.log(
    `${exempt} of them predate ${UPSTREAM_REQUIRED_FROM} and were not asked for ` +
      `${UPSTREAM_FIELDS.join(', ')}. Their green is over ${BRIEF_FIELDS.length - UPSTREAM_FIELDS.length} fields, not ${BRIEF_FIELDS.length}.`,
  );
}
