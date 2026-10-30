#!/usr/bin/env node
/**
 * Run, locally, what a push to `main` is proven against.
 *
 * WHY IT EXISTS. CI and the deploy both run after the push, so a red check is
 * discovered once `main` already carries it: the live site stays on the last
 * green build, but everybody who pulls gets the defect. Branch protection,
 * which would turn a red run into a blocked merge, is not offered on a private
 * repository outside a paid plan. This closes the distance the cheap way: run
 * them before promoting rather than after.
 *
 * WHAT IT STOPS. An all-green run writes `.gate-receipt.json` naming the HEAD
 * it measured, and `git-guard.cjs` refuses a push that would update `main`
 * unless a receipt matches. A failing run writes nothing and deletes a stale
 * one. This script still only exits non-zero — the refusal happens at the push,
 * in the hook, and the human confirmation `CLAUDE.md` asks for is unchanged.
 *
 * WHAT IT PROVES AND WHAT IT DOES NOT. The receipt is about the TREE: which
 * HEAD was measured green, and when. It is not approval, and it is not evidence
 * that a screen renders — nothing here mounts a component.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import receipt from './gate-receipt.cjs';

/**
 * What the deploy runs, in the order it runs them, so the first failure here is
 * the first failure there too.
 *
 * Read from `vercel.json`'s `buildCommand`, which is what the deploy runs, so
 * the two cannot drift. A step that is not `pnpm <script>` stops the gate
 * rather than being skipped: a list that drops a step in silence is the drift
 * this replaced.
 *
 * > SOURCE: the agent, 2026-10-09 — `vercel deploy --target preview` ran these
 *   five in this order, and with lint red on purpose it stopped at `lint` and
 *   published nothing. briefs/2026-10-09-vercel-deploy.md
 */
const PUBLISH = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  .buildCommand.split('&&')
  .map((step) => {
    const script = /^pnpm ([\w:-]+)$/.exec(step.trim());
    if (!script) throw new Error(`gate: "${step.trim()}" in vercel.json's buildCommand is not \`pnpm <script>\`.`);
    return script[1];
  });

/**
 * The checks CI runs and a deploy does not, run in a second block.
 *
 * They are cheap — every one imports only node builtins and reads files — and a
 * publish is the moment worth paying for a second opinion, because CI is one
 * surface and a surface can be down.
 *
 * A failure here is NOT a failure of the deploy: it would publish this tree
 * green. It is a defect the publish would ship, which is a different sentence
 * and gets a different message below.
 */
const LOCAL = [
  'check:floor',
  'check:links',
  'check:skills-table',
  'check:role-list',
  'check:backlog',
  'check:feedback',
  'check:copy',
];

/**
 * The blocks, in the order they run. One flat list would lose which block a
 * failure came from, and that is the whole difference between "the deploy would
 * go red" and "the deploy would go green over a defect".
 */
const PLAN = [
  { block: 'publish', checks: PUBLISH },
  { block: 'local', checks: LOCAL },
];
const ALL = PLAN.flatMap((p) => p.checks);

/**
 * `shell: true` on Windows, and it is not optional.
 *
 * Node refuses to spawn a `.cmd` without a shell — the mitigation for
 * CVE-2024-27980 — and it refuses with `EINVAL`, which arrives looking like a
 * broken argument rather than a policy.
 *
 * What makes the shell safe here is that both lists above are literals in this
 * file. No part of the command line comes from a caller, so there is nothing to
 * inject through.
 *
 * The command is composed into ONE string rather than passed as an argument
 * array, which is the form that avoids `DEP0190` — Node warns that arguments
 * given alongside `shell: true` are concatenated rather than escaped, and the
 * honest response to a warning about concatenation is to do the concatenating
 * where it can be read.
 */
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

/*
 * The tree is read BEFORE the run, not after. `build` and `build:storybook`
 * both leave output behind, so a tree read at the end is dirty for reasons that
 * have nothing to do with what was measured.
 */
const measured = { head: receipt.head(), clean: receipt.clean(), checks: ALL };

console.log(`Running the ${PUBLISH.length} checks a push to main is proven against, in order,`);
console.log(`then the ${LOCAL.length} the deploy does not run.`);
for (const { block, checks } of PLAN) for (const name of checks) console.log(`  ${block.padEnd(8)} ${name}`);
console.log('');

const results = [];
let failed = false;
for (const { block, checks } of PLAN) {
  for (const name of checks) {
    process.stdout.write(`── ${name} `.padEnd(72, '─') + '\n');
    const started = Date.now();
    const run = spawnSync(`${pnpm} ${name}`, { stdio: 'inherit', shell: true });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    /*
     * A spawn that never ran is recorded as its own outcome rather than as a
     * failure of the check. `status` is null when the process could not start
     * or was killed by a signal, and reporting that as "lint failed" sends
     * whoever reads it to the wrong file.
     */
    const outcome = run.error || run.status === null ? 'did not run' : run.status === 0 ? 'ok' : 'FAIL';
    results.push({ name, block, outcome, seconds, detail: run.error?.message });
    if (outcome !== 'ok') {
      failed = true;
      break;
    }
  }
  if (failed) break;
}

console.log('\n' + '─'.repeat(72));
for (const { name, outcome, seconds, detail } of results) {
  console.log(`  ${outcome.padEnd(11)} ${name.padEnd(20)} ${seconds}s${detail ? ` — ${detail}` : ''}`);
}

const ran = results.length;
const skipped = ALL.length - ran;
if (skipped > 0) console.log(`  ${String('not reached').padEnd(11)} ${skipped} check(s) after the failure`);

const bad = results.find((r) => r.outcome !== 'ok');
if (bad) {
  console.error(`\nFAIL — ${bad.name} ${bad.outcome}.`);
  if (bad.block === 'publish') {
    console.error('  This is what the publish would have found. The deploy stops at the same');
    console.error('  place, with main already rebuilt from whatever landed.');
  } else {
    console.error('  The deploy does not run this one, so it would go GREEN. This is a defect');
    console.error('  the publish would ship, and the receipt is what would have said so.');
  }
  if (receipt.remove()) console.error(`  Removed ${receipt.RECEIPT}, which measured an earlier tree.`);
  process.exit(1);
}

console.log(`\nOK — all ${ran} passed: the ${PUBLISH.length} a publish is proven against, and the`);
console.log(`  ${LOCAL.length} the deploy never runs. That is still not a rendered screen —`);
console.log('  nothing here mounts a component. See docs/foundation/checks.md.');

const written = receipt.write(undefined, measured);
if (written) {
  console.log(`\n  ${receipt.RECEIPT} ${measured.head.slice(0, 7)}${measured.clean ? '' : ' (dirty tree)'}`);
  console.log('  A push to main is refused until a receipt matches HEAD. Committing');
  console.log('  anything — a merge included — makes this one stale.');
} else {
  console.log(`\n  No ${receipt.RECEIPT}: git did not answer for HEAD, so nothing was measured.`);
}
