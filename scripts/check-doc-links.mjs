/**
 * Reads every markdown link in `CLAUDE.md` and in `docs/`, and fails on one whose
 * file is gone.
 *
 * The rules live in `doc-links.mjs`, which has its own spec and touches no
 * filesystem; this file is the read, the scope floor and the exit code.
 *
 * **WHAT IT CANNOT SEE, printed on every run.** Whether the destination says
 * what the pointer promises. A link to the right file about the wrong thing
 * passes, and so does one whose relevant paragraph was deleted. Anchors are
 * stripped and not verified, so a renamed heading survives this.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { danglingLinks, resolveAgainst, targets } from './doc-links.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_DOC = 'CLAUDE.md';
const TREE = 'docs';

/* Discovered rather than listed. A list is a second place to remember, and the
 * document that goes unchecked is always the one somebody forgot to add. */
function documents() {
  let inTree = [];
  try {
    inTree = readdirSync(join(ROOT, TREE), { recursive: true })
      .map((entry) => `${TREE}/${String(entry).split('\\').join('/')}`)
      .filter((path) => path.endsWith('.md') && !path.startsWith(`${TREE}/template-history/`))
      .sort();
  } catch (error) {
    console.error(`FAIL — could not read ${TREE}/.`);
    console.error(`  ${error.message}`);
    process.exit(1);
  }
  return [ROOT_DOC, ...inTree];
}

const docs = documents();
console.log(`Read every markdown link in ${ROOT_DOC} and ${TREE}/, and looked for the file each names.`);
console.log(`  Skips ${TREE}/template-history/: the template's briefs, moved there by /setup with their links unchanged.`);

const findings = [];
let checked = 0;
let rootDocLinks = 0;

for (const doc of docs) {
  let text;
  try {
    text = readFileSync(join(ROOT, doc), 'utf8');
  } catch (error) {
    console.error(`FAIL — could not read ${doc}.`);
    console.error(`  ${error.message}`);
    process.exit(1);
  }

  const here = targets(text).length;
  checked += here;
  if (doc === ROOT_DOC) rootDocLinks = here;

  const exists = (path) => existsSync(join(ROOT, resolveAgainst(doc, path)));
  for (const line of danglingLinks(text, exists)) findings.push(`${doc}: ${line}`);
}

console.log(`  ${docs.length} document(s), ${checked} repository-relative link(s).`);
console.log('  URLs and bare anchors are not checked.');

/* The scope floor before the findings. `CLAUDE.md` has carried links since its
 * first revision, so zero of them means the parse stopped matching rather than
 * that somebody removed them all — and zero links is under every threshold,
 * which reads exactly like a pass. A document in `docs/` gets no such floor: one
 * with only URLs in it is ordinary. */
if (rootDocLinks === 0) {
  console.error(`\nFAIL — no links were found in ${ROOT_DOC}, so it was not checked.`);
  console.error('  This is a parse failure rather than a clean document. The pattern is');
  console.error('  exported as LINK from scripts/doc-links.mjs.');
  process.exit(1);
}

if (findings.length) {
  console.error(`\nFAIL — ${findings.length} link(s) point at a file that is not there.`);
  for (const line of findings) console.error(`  ${line}`);
  console.error('\n  A pointer left behind by a cut is how the evidence for a rule goes');
  console.error('  missing without the rule looking any different. Write the destination,');
  console.error('  or take the pointer out.');
  process.exit(1);
}

console.log(`\nOK — every link in ${ROOT_DOC} and ${TREE}/ names a file that exists.`);
console.log('  It cannot see whether the destination says what the pointer promises,');
console.log('  and it does not verify anchors: a renamed heading survives this check.');
