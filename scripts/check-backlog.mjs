/**
 * Holds every backlog item to having a state and an owner.
 *
 * The rules live in `backlog-rules.mjs`, which has its own spec. This file is
 * the read, the scope floor and the exit code.
 *
 * **NO BASELINE, and that is the decision.** The subject is files in this
 * repository, every failure is repairable in the commit that caused it, and a
 * silencer with no legitimate use is one that will only ever be used
 * illegitimately — the same reasoning `check-role-list.mjs` carries.
 */
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { argv } from 'node:process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CANNOT_SEE,
  STATUSES,
  STATUS_MEANING,
  findingsFor,
  parseBacklog,
  scopeFailure,
  tally,
} from './backlog-rules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROSTER = join(ROOT, 'docs', 'foundation', 'people.md');

/** Every backlog surface: the single file today, one file per section after the split. */
export function backlogFiles() {
  const found = [];
  for (const rel of ['BACKLOG.md']) {
    try {
      readFileSync(join(ROOT, rel), 'utf8');
      found.push(rel);
    } catch {
      /* absent is not an error here; the scope gate below decides */
    }
  }
  try {
    for (const name of readdirSync(join(ROOT, 'backlog'))) {
      if (name.endsWith('.md') && name !== 'README.md') found.push(join('backlog', name));
    }
  } catch {
    /* the directory does not exist until the split lands */
  }
  return found;
}

/** Whether `backlog/README.md` exists — what makes zero files an empty backlog rather than a missed one. */
export const backlogReadme = () => existsSync(join(ROOT, 'backlog', 'README.md'));

/** The roster, read from the one place `setup` writes it. Absent means owner names are unchecked. */
function roster() {
  try {
    const text = readFileSync(ROSTER, 'utf8');
    const names = [...text.matchAll(/^\|\s*([A-Z][^|]*?)\s*\|/gm)].map((m) => m[1].trim());
    return names.filter((n) => n && n !== 'Name');
  } catch {
    return null;
  }
}

/**
 * Everything below runs ONLY when this file is the entry point.
 *
 * `backlog.mjs` imports `backlogFiles` from here, and without this guard that
 * import runs the whole check and then kills the importing process — the trap
 * this repository hit once already, importing a check for its exports. Node 22 has
 * no `import.meta.main`, so it is an argv comparison through `realpathSync`.
 *
 * **Get it wrong in the other direction and the check does nothing and exits 0**,
 * which reads exactly like a pass. So it is verified by running the check and
 * reading its scope line, never by reading this diff.
 */
function isEntryPoint() {
  try {
    return realpathSync(argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) main();

function main() {
const files = backlogFiles();
  const items = [];
  for (const rel of files) {
  const text = readFileSync(join(ROOT, rel), 'utf8');
  for (const item of parseBacklog(text)) items.push({ ...item, file: rel });
}

  const failed = scopeFailure({ files: files.length, items: items.length, readme: backlogReadme() });
  if (failed) {
  console.error('FAIL — nothing could be checked.');
  console.error(`  ${failed}`);
  console.error('  A check that could not run is not a check that passed.');
  process.exit(1);
}

  const known = roster();
  const counts = tally(items);
  const findings = items.flatMap((item) => findingsFor(item, known).map((f) => ({ ...f, file: item.file })));

  console.log(
  `Read ${files.length} file(s), ${counts.total} item(s). ` +
    STATUSES.map((s) => `${s} ${counts[s]}`).join(', ') +
    `, no state ${counts.total - STATUSES.reduce((n, s) => n + counts[s], 0)}.`,
);
  console.log(
  `  owned ${counts.owned}, explicitly unowned ${counts.unowned}` +
    (known ? `, roster of ${known.length}` : ', NO roster — owner names are unchecked'),
);
  console.log('');

  if (!findings.length) {
  console.log(
    files.length
      ? 'OK — every item carries a state and an owner.'
      : 'OK — the backlog is empty: backlog/README.md was read and no file in backlog/ holds an item.',
  );
  for (const s of STATUSES) console.log(`  ${s.padEnd(9)} ${STATUS_MEANING[s]}`);
  console.log('');
  for (const line of CANNOT_SEE) console.log(`  ${line}`);
  console.log('');
  process.exit(0);
}

  console.error(`${findings.length} item(s) cannot be filtered:\n`);
  for (const f of findings.slice(0, 40)) console.error(`  [${f.code}] ${f.file} — ${f.detail}`);
  if (findings.length > 40) console.error(`  … and ${findings.length - 40} more.`);
  console.error('');
  console.error('An item with no state is one nobody can decide about without reading it,');
  console.error('which is how this file reached 366 KB of things nobody was going to do.');
  console.error('');
  process.exit(1);
}
