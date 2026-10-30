/**
 * Holds the two places `.claude/skills/setup/SKILL.md` names its roles to each
 * other, and fails when one was edited alone.
 *
 * The rules live in `role-list.mjs`, which has its own spec and names no role;
 * this file is the read, the scope floor and the exit code.
 *
 * **NO BASELINE, and that is a decision rather than an omission.** The four
 * checks here that carry one guard an external mutable subject — a design file, a
 * rendered browser, a published package — where something is already broken on
 * the day the check is written and repairing it is somebody else's call. This
 * subject is two paragraphs of one file in this repository, the findings set is
 * empty today, and every failure is repairable in the same commit that caused
 * it. A `--write-baseline` here would be a silencer with no legitimate use, so
 * there is not one.
 *
 * **WHAT IT CANNOT SEE, printed on every run rather than filed in this header.**
 * Whether these are the teams the organization actually has. No script here can
 * read an org chart, so a green says the file agrees with itself and says
 * nothing at all about whether it is current. The repair for that is a person
 * reading the list aloud, and nobody has yet decided who or how often.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { derivedRoles, findingsIn, scopeFailure, scopeOf, unionSlugs } from './role-list.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = join(ROOT, '.claude', 'skills', 'setup', 'SKILL.md');
const SKILL_PATH = '.claude/skills/setup/SKILL.md';

const CANNOT_SEE =
  'It cannot see whether these are the teams the organization actually has.\n' +
  '  No script here reads an org chart, so this green means the file agrees with\n' +
  '  itself and nothing more. Read the list to the person in front of you.';

const NO_BASELINE =
  'It carries no baseline and no --write-baseline, on purpose. Its subject is\n' +
  '  two paragraphs of one file here, so every failure is repairable at the\n' +
  '  moment it is read. There is nothing external to record.';

/**
 * Any read error at all exits 1.
 *
 * A rename, a sparse checkout or a permission error all mean this could not read
 * what it was asked to read, and reporting green over that is the failure a
 * sibling check has a paragraph about.
 */
let text;
try {
  text = readFileSync(SKILL, 'utf8');
} catch (error) {
  console.error(`FAIL — could not read ${SKILL_PATH}.`);
  console.error(`  ${error.message}`);
  console.error('  A check that could not run is not a check that passed.');
  process.exit(1);
}

const scope = scopeOf(text);
const prose = derivedRoles(text);
const union = unionSlugs(text);

/** Both lists, printed whether this passes or fails, so a punctuation cause is legible in one line. */
const listing = () => {
  console.log(`  the question offers  [${prose.join(', ')}]`);
  console.log(`  the shape stores     [${union.join(', ')}]`);
};

/* The scope gate, evaluated BEFORE any comparison. Two empty lists compare
 * equal, so a run that parsed nothing would report no disagreement and exit 0. */
const failedScope = scopeFailure(text);

if (failedScope) {
  console.error(`FAIL — ${SKILL_PATH} did not resolve.`);
  console.error(`  ${failedScope}`);
  console.error('');
  listing();
  process.exit(1);
}

const findings = findingsIn(text);

console.log(
  `Read ${SKILL_PATH}. ${scope.proseItems} offered over ${scope.regionChars} characters, ${scope.unionItems} stored.`,
);
listing();
console.log('');

if (!findings.length) {
  console.log(`OK — the two statements agree, position by position.`);
  console.log(`  ${CANNOT_SEE}`);
  console.log(`  ${NO_BASELINE}`);
  console.log('');
  process.exit(0);
}

console.error(`${findings.length} disagreement(s) between two statements in one file:\n`);
for (const f of findings) {
  console.error(`  ${f.rule}`);
  console.error(`      ${f.detail}`);
  console.error(`      ${f.repair}\n`);
}
console.error(`Both statements are in ${SKILL_PATH}. Open it and make them match.`);
console.error('');
process.exit(1);
