#!/usr/bin/env node
/**
 * Whether the work on this branch brought a brief with it.
 *
 * WHAT THIS IS NOT. `check-briefs.mjs` reads `briefs/` and validates the shape
 * of every file it finds. It never asks whether a CHANGE has one — so a branch
 * that rewrites `src/` with no brief at all passes it green, and did. The one
 * rule this repository says it is built on was the only rule here with nothing
 * behind it.
 *
 * WHAT IT CANNOT SEE, said plainly because a green run is otherwise read as
 * more than it is: that the brief was written BEFORE the work rather than
 * after, that it describes this change rather than another, and that a person
 * approved it. It sees a file. The gate is still a conversation; this is the
 * part of it that leaves evidence.
 *
 * WHY IT COMPARES AGAINST `main`. Feature branches are born from `main` and
 * merge back into it. Since 2026-09-24 nothing sits between the two — `dev`
 * was renamed to `main` on GitHub — so the base a branch is measured against
 * and the branch a publish leaves from are the same one.
 */
import { execFileSync } from 'node:child_process';

/** The branch that is not a working surface, so nothing is expected of it. */
const NOT_A_WORKING_SURFACE = new Set(['main']);

/** The base every feature branch is born from. */
const BASE = 'main';

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

let branch;
try {
  branch = git('rev-parse', '--abbrev-ref', 'HEAD');
} catch (error) {
  console.error('FAIL — git could not say which branch this is, so nothing was compared.');
  console.error(`  ${error.message}`);
  process.exit(1);
}

if (NOT_A_WORKING_SURFACE.has(branch)) {
  console.log(`Read the branch: ${branch}.`);
  console.log(`  ${branch} is an integration branch, not a working surface, so this`);
  console.log('  check expects nothing of it. Run it on a feat/<topic> branch.');
  console.log('\nOK — nothing to check here.');
  process.exit(0);
}

/*
 * The scope is established and PRINTED before any finding, because the failure
 * this check is most likely to have is measuring nothing: a merge base that
 * does not resolve returns an empty file list, and an empty file list looks
 * exactly like a branch that changed nothing.
 */
let changed;
try {
  const committed = git('diff', '--name-only', `${BASE}...HEAD`).split('\n').filter(Boolean);
  /*
   * Uncommitted work counts too, and leaving it out was this check's first
   * defect: run before the first commit — which is when a person would most
   * want to run it — a branch full of unstaged edits reported "0 files
   * changed" and exited 0. The reassuring answer was the wrong one.
   *
   * `--porcelain` is the stable form, and the path is everything past the
   * two status columns and their space. A rename prints `old -> new`; the
   * new name is the one that matters, so the arrow is split on.
   *
   * `-uall` because git otherwise collapses an untracked DIRECTORY into one
   * entry: a brief written into a `briefs/` the branch itself created prints
   * as `?? briefs/`, which does not end in `.md`, so it counts as work and the
   * answer becomes "no brief came with them" ABOUT the brief. Latent here,
   * where `briefs/` is always tracked — caught 2026-09-12 by the fixture for
   * the same decision in `git-guard.cjs`, where it was not latent.
   */
  const working = git('status', '--porcelain', '-uall')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).split(' -> ').pop().replace(/^"|"$/g, ''));
  changed = [...new Set([...committed, ...working])];
} catch (error) {
  console.error(`FAIL — could not diff against ${BASE}, so nothing was compared.`);
  console.error(`  ${error.message}`);
  console.error(`\n  This is a measurement failure rather than a finding. A branch whose`);
  console.error(`  base does not resolve reports an empty diff, which reads identically`);
  console.error(`  to a branch that changed nothing.`);
  process.exit(1);
}

const briefs = changed.filter((f) => f.startsWith('briefs/') && f.endsWith('.md'));
/* The `feedback` and `setup` skills commit these without a brief by design.
 * Mirrored in `git-guard.cjs` (`briefState`) so the two agree. */
const exempt = (f) =>
  f.startsWith('feedback/') || f === 'docs/foundation/people.md' || f === 'docs/foundation/workspace-wiring.md';
const work = changed.filter((f) => !f.startsWith('briefs/') && !exempt(f));

console.log(`Read ${branch} against ${BASE}.`);
console.log(`  ${changed.length} file(s) changed: ${work.length} of work, ${briefs.length} of brief.`);

if (work.length === 0) {
  console.log('\nOK — this branch changes no work files, so no brief is owed.');
  process.exit(0);
}

if (briefs.length > 0) {
  for (const b of briefs) console.log(`  brief: ${b}`);
  console.log('\nOK — the work on this branch came with a brief.');
  process.exit(0);
}

console.error(`\nFAIL — ${work.length} work file(s) changed and no brief came with them.`);
for (const f of work.slice(0, 10)) console.error(`  ${f}`);
if (work.length > 10) console.error(`  … and ${work.length - 10} more`);
console.error('\n  Write the approved execution prompt to briefs/YYYY-MM-DD-<slug>.md,');
console.error('  from briefs/TEMPLATE.md. It is not paperwork: a brief left in the chat');
console.error('  is lost to the next session, which is the rehearsal that produced this');
console.error('  rule. See CLAUDE.md, "Task intake gate", step 4.');
process.exit(1);
