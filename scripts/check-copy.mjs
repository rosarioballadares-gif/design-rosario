/**
 * Walks `src/` for the four characters the voice guide forbids without
 * exception, and fails on a new one.
 *
 * The rules and what counts as copy live in `copy-rules.mjs`, which has its own
 * spec; this file is the walk, the baseline and the exit code.
 *
 * **Baseline-gated.** What is
 * already there is recorded and reported, and a NEW one exits 1. That is the
 * only shape that makes a check useful the day it is written rather than after
 * a cleanup project — and the six entries in the baseline are worth reading
 * rather than skipping past: three of them are real violations in product copy
 * that nobody had caught, and they are recorded rather than repaired because
 * repairing somebody's screen copy is their decision, not this check's.
 *
 * `--write-baseline` rewrites the record. Run it to REPORT what moved, never to
 * make the check green.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findingsIn, keyOf } from './copy-rules.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SRC = join(ROOT, 'src');
const BASELINE = join(HERE, 'copy.baseline.json');

const RECORDED = 'RECORDED — not yet triaged.';

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const repoPath = (file) => relative(ROOT, file).split(sep).join('/');

const files = walk(SRC);
const findings = files.flatMap((file) =>
  findingsIn(repoPath(file), readFileSync(file, 'utf8')),
);

const write = process.argv.includes('--write-baseline');

if (write) {
  const known = {};
  try {
    Object.assign(known, JSON.parse(readFileSync(BASELINE, 'utf8')).known ?? {});
  } catch {
    /* first run */
  }
  writeFileSync(
    BASELINE,
    `${JSON.stringify(
      {
        measured: new Date().toISOString().slice(0, 10),
        why: 'What already breaks a character rule. Rewrite this to REPORT what moved, never to make the check green.',
        expect: { files: files.length },
        known: Object.fromEntries(findings.map((f) => [keyOf(f), known[keyOf(f)] ?? RECORDED])),
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Wrote ${findings.length} findings over ${files.length} files.`);
  console.log('A baseline reports what moved. It never makes a check green.');
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
const known = new Set(Object.keys(baseline.known ?? {}));

/**
 * The scope gate, checked BEFORE the findings.
 *
 * A run whose walk stopped resolving would find nothing, report zero new and
 * exit 0 having measured nothing at all — which reads exactly like a pass. The
 * floor is a file count, and it is a floor rather than an equality so that
 * adding a module passes. Deliberately removing one is what legitimately lowers
 * it, and rewriting the baseline is how that gets recorded.
 */
if (files.length < baseline.expect.files) {
  console.error(
    `Walked ${files.length} files against a floor of ${baseline.expect.files}. ` +
      `Something stopped resolving, so the count below is an artefact rather than a result.`,
  );
  process.exit(1);
}

const fresh = findings.filter((f) => !known.has(keyOf(f)));
const gone = [...known].filter((k) => !findings.some((f) => keyOf(f) === k));

console.log(`Read ${files.length} files. ${findings.length} findings, ${fresh.length} new.`);
console.log('  Four characters, over string literals in src/ — never JSX text nodes.');

if (gone.length) {
  console.log(`\n${gone.length} recorded finding(s) no longer there — rewrite the baseline:`);
  for (const k of gone) console.log(`  ${k}`);
}

if (!fresh.length) {
  console.log(`\nOK — ${known.size} recorded, 0 new.`);
  console.log('  This is not a voice pass. What a regular expression cannot see stays');
  console.log('  with the voice-audit skill, the only thing that reads it.');
  process.exit(0);
}

console.error(`\n${fresh.length} new:\n`);
for (const f of fresh) {
  console.error(`  ${f.rule}  ${f.path}:${f.line}`);
  console.error(`      ${f.text.length > 120 ? `${f.text.slice(0, 120)}…` : f.text}`);
  console.error(`      ${f.repair}\n`);
}
console.error('These four characters have no exception in the voice guide.');
console.error('docs/foundation/voice-content-guide.md\n');
process.exit(1);
