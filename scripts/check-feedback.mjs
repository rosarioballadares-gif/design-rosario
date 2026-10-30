/**
 * Checks every record in `feedback/`.
 *
 * Why feedback is a file at all. On 2026-08-31 and 2026-09-01 Sarah Johnston
 * became the first person who did not write this repository to run its setup
 * skill and compose against it. Three commits survive. What it cost her does
 * not, because nothing asked and there was nowhere to put the answer. In the
 * same stretch Christine Moreau's observation about the theme picker reached
 * CLAUDE.md attributed to somebody else, for the same reason: the only place a
 * finding could land was a document written by the person who heard it.
 *
 * A file is the smallest thing that fixes that. This check is what stops the
 * directory from filling with notes nobody can act on.
 *
 * The scope line comes FIRST, before any finding. A run that resolved no files
 * would otherwise print nothing, find nothing and exit 0, which reads exactly
 * like a directory of clean records.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REQUIRED_FEEDBACK_FIELDS,
  checkFeedback,
  checkFeedbackName,
} from './feedback-fields.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FEEDBACK = join(HERE, '..', 'feedback');

// Checked in the opposite direction, like the briefs template: it must FAIL,
// because a template that passes is a template somebody can copy, commit and
// ship empty.
const TEMPLATE = 'TEMPLATE.md';

let files;
try {
  files = readdirSync(FEEDBACK).filter((f) => f.endsWith('.md'));
} catch (err) {
  if (err.code === 'ENOENT') {
    console.log('No feedback/ directory yet. Nothing to check, and nothing measured.');
    process.exit(0);
  }
  console.error(`check:feedback could not read ${FEEDBACK}`);
  console.error(`  ${err.code ?? 'error'}: ${err.message}`);
  process.exit(1);
}

const records = files.filter((f) => f !== TEMPLATE);

console.log(
  `feedback/ — ${files.length} file${files.length === 1 ? '' : 's'}, ` +
    `${records.length} record${records.length === 1 ? '' : 's'}, ` +
    `${files.includes(TEMPLATE) ? '1 template' : 'no template'}.`,
);
console.log(
  `Judged: the ${REQUIRED_FEEDBACK_FIELDS.length} required sections, a dated reporter, ` +
    `a locator under "Where", and the three states under "What would fix it".`,
);
console.log('Not judged: whether the friction is real, and whether the name is the person who hit it.');
console.log('');

let failed = 0;

// The template is checked before the empty-directory exit, not inside the loop
// below it. Ordering it the other way meant the one state this directory spends
// most of its life in — a template and no records yet — was the state in which
// the template went uninspected, so a template that had quietly started passing
// would report green until somebody filed the first record.
if (files.includes(TEMPLATE)) {
  const result = checkFeedback(readFileSync(join(FEEDBACK, TEMPLATE), 'utf8'));
  if (result.ok) {
    console.error(`FAIL ${TEMPLATE}`);
    console.error(
      '  The template passes its own check, which means an unfilled copy of it would too.',
    );
    console.error(
      '  Every prompt in it belongs inside a fenced block, so it reads as an example rather than an answer.',
    );
    failed++;
  } else {
    console.log(`ok   ${TEMPLATE} (fails on purpose: an unfilled record must not pass)`);
  }
}

if (!records.length) {
  console.log('');
  console.log('No records yet. This check measured nothing beyond the template.');
  process.exit(failed ? 1 : 0);
}

for (const file of records.sort()) {
  const text = readFileSync(join(FEEDBACK, file), 'utf8');
  const result = checkFeedback(text);
  const findings = [...checkFeedbackName(file), ...result.findings];

  if (!findings.length) {
    const { reporters, cited, gaps } = result.stats;
    console.log(
      `ok   ${file}  ${reporters} reporter${reporters === 1 ? '' : 's'}, ` +
        `${cited} located, ${gaps} stated gaps`,
    );
  } else {
    console.error(`FAIL ${file}`);
    for (const f of findings) console.error(`  [${f.code}] ${f.detail}`);
    failed++;
  }
}

if (failed) {
  console.error('');
  console.error(`${failed} record${failed === 1 ? '' : 's'} did not pass.`);
  console.error(
    'An observation needs no citation here. A name, a date, a place and a cost are what it needs.',
  );
  process.exit(1);
}

console.log('');
console.log(`${records.length} record${records.length === 1 ? '' : 's'} checked.`);
console.log('  A record here is testimony, not a brief. The three-state rule applies to');
console.log('  exactly one section of it, "What would fix it".');
