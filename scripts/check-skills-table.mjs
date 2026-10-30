/**
 * Holds the skills table in `CLAUDE.md` against `.claude/skills/`, and fails
 * when one was edited alone.
 *
 * The rules live in `skills-table.mjs`, which has its own spec and names no
 * skill; this file is the read, the scope floor and the exit code.
 *
 * **NO BASELINE, and that is a decision.** The checks here that carry one guard
 * an external mutable subject — a design file, a rendered browser, a published
 * package — where something is already broken on the day the check is written
 * and repairing it is somebody else's call. This subject is one table and one
 * directory in this repository, the findings set is empty today, and every
 * failure is repairable in the commit that caused it. A `--write-baseline` here
 * would be a silencer with no legitimate use.
 *
 * **WHAT IT CANNOT SEE, printed on every run rather than filed in this header.**
 * Whether a description beside a skill is accurate, and whether the set is the
 * one this workspace should have. It compares names.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  descriptionFailures,
  disagreements,
  floorFailures,
  scopeOf,
  unreachableHidden,
  NEEDS_A_REACHER,
} from './skills-table.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLAUDE_PATH = 'CLAUDE.md';
const SKILLS_PATH = '.claude/skills';
const ROUTER_PATH = 'scripts/skill-router.cjs';

const CANNOT_SEE =
  'It compares names, and of a hidden skill it asks only whether SOMETHING\n' +
  '  names it, never whether that trigger fires. It cannot see whether a\n' +
  '  description beside a skill is\n' +
  '  accurate, whether the skill works, or whether this is the set this workspace\n' +
  '  should have. Read the table to somebody before trusting it.';

/**
 * Any read error at all exits 1.
 *
 * A rename, a sparse checkout or a permission error all mean this could not read
 * what it was asked to read, and reporting green over that is the failure a
 * sibling check has a paragraph about.
 */
function read(relative, reader) {
  try {
    return reader(join(ROOT, relative));
  } catch (error) {
    console.error(`FAIL — could not read ${relative}.`);
    console.error(`  ${error.message}`);
    process.exit(1);
  }
}

const text = read(CLAUDE_PATH, (p) => readFileSync(p, 'utf8'));

/** Directories only. A stray file in there is not a skill and must not read as one. */
const onDisk = read(SKILLS_PATH, (p) =>
  readdirSync(p, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
);

const scope = scopeOf(text, onDisk);
console.log(`Read the skills table in ${CLAUDE_PATH} against ${SKILLS_PATH}/.`);
console.log(`  ${scope.tabled} listed in the table, ${scope.onDisk} directories on disk.`);

/**
 * The floor first, because two empty lists compare equal.
 *
 * A run whose parse resolved nothing would find no disagreement and exit 0,
 * having measured nothing at all — and that reads exactly like a pass.
 */
const floor = floorFailures(text, onDisk);
if (floor.length) {
  console.error('\nFAIL — the parse did not resolve, so nothing was compared.');
  for (const line of floor) console.error(`  ${line}`);
  console.error('\n  This is a parse failure rather than a disagreement. Either the table');
  console.error('  header moved or the directory is not where it was. The header is');
  console.error('  exported as ANCHOR from scripts/skills-table.mjs.');
  process.exit(1);
}

/* Read every skill's description off disk, so the colon guard runs over what the
 * harness will actually parse rather than over the table. */
const descriptions = {};
const flagged = new Set();
for (const skill of onDisk) {
  try {
    const body = readFileSync(join(ROOT, SKILLS_PATH, skill, "SKILL.md"), "utf8");
    const line = /^description:\s*(.*)$/m.exec(body);
    if (line) descriptions[skill] = line[1];
    if (/^disable-model-invocation:\s*true\s*$/m.test(body)) flagged.add(skill);
  } catch {
    /* a skill directory with no SKILL.md is the disagreement check's business */
  }
}

/* Two mechanisms hide a skill and neither can be read from the other's file, so
 * both are read here and merged into one state per skill. Reading only the
 * frontmatter is not a smaller check, it is a check that reports on the wrong
 * set: moving seven skills to `name-only` took this from nine subjects to two
 * and stayed green. */
const OVERRIDES = (() => {
  try {
    return JSON.parse(readFileSync(join(ROOT, '.claude/settings.json'), 'utf8')).skillOverrides ?? {};
  } catch {
    return {};
  }
})();

const states = {};
for (const skill of onDisk) {
  if (flagged.has(skill)) states[skill] = 'frontmatter-flag';
  else if (OVERRIDES[skill]) states[skill] = OVERRIDES[skill];
}
const needing = Object.values(states).filter((s) => NEEDS_A_REACHER.has(s)).length;
console.log(
  `  ${Object.keys(states).length} not plainly listed, of which ${needing} need a way to be reached.`,
);

/* A missing router is a finding for every hidden skill rather than a silent
 * pass: the file being gone is exactly when nothing hands over a path. */
let router = '';
try {
  router = readFileSync(join(ROOT, ROUTER_PATH), 'utf8');
} catch {
  console.log(`  ${ROUTER_PATH} could not be read, so no skill counts as routed.`);
}

const found = [
  ...disagreements(text, onDisk),
  ...descriptionFailures(descriptions),
  ...unreachableHidden(states, router, text),
];
if (found.length) {
  console.error(`\nFAIL — ${found.length} finding(s) across the table, the directory and the hidden set.`);
  for (const line of found) console.error(`  ${line}`);
  console.error('\n  The directory is what exists. A skill that is real and unlisted is');
  console.error('  invisible to the agent reading CLAUDE.md, which is how this table sat');
  console.error('  at twelve of seventeen for weeks. Add the row in the same commit.');
  process.exit(1);
}

console.log('\nOK — the table lists exactly the skills that exist.');
console.log(`  ${CANNOT_SEE}`);
console.log(`  Order is not compared: ${SKILLS_PATH}/ arrives alphabetical and the table is`);
console.log('  ordered by when a person needs each one, which is an editorial sequence.');
