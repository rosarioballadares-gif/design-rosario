/**
 * The backlog, filtered.
 *
 * **It is a VIEW, never a second copy.** A file per person would put the same
 * item in two places with nothing keeping them in agreement, which is the
 * duplication this repository forbids everywhere else. So `> OWNER:` lives on
 * the item and this derives the rest.
 *
 *   pnpm backlog                     everything, grouped by state
 *   pnpm backlog --mine              yours, from .claude/profile.local.json
 *   pnpm backlog --owner "Name"      one person's
 *   pnpm backlog --status open       one state
 *   pnpm backlog --unowned           what nobody has claimed
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NO_OWNER, STATUSES, parseBacklog, scopeFailure, tally } from './backlog-rules.mjs';
import { backlogFiles, backlogReadme } from './check-backlog.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const after = (flag) => {
  const at = args.indexOf(flag);
  return at === -1 ? null : args[at + 1] ?? null;
};

let owner = after('--owner');
if (args.includes('--mine')) {
  try {
    owner = JSON.parse(readFileSync(join(ROOT, '.claude', 'profile.local.json'), 'utf8')).name;
  } catch {
    console.error('FAIL — --mine needs .claude/profile.local.json, which is written by /setup.');
    console.error('  Run /setup, or pass --owner "Your Name".');
    process.exit(1);
  }
}
const status = after('--status');
const unowned = args.includes('--unowned');

const files = backlogFiles();
const items = files.flatMap((rel) =>
  parseBacklog(readFileSync(join(ROOT, rel), 'utf8')).map((i) => ({ ...i, file: rel })),
);

const failed = scopeFailure({ files: files.length, items: items.length, readme: backlogReadme() });
if (failed) {
  console.error(`FAIL — ${failed}`);
  process.exit(1);
}

let shown = items;
if (owner) shown = shown.filter((i) => i.owner === owner);
if (unowned) shown = shown.filter((i) => i.owner === NO_OWNER || !i.owner);
if (status) shown = shown.filter((i) => i.status === status);
/* `dropped` is never shown unless asked for by name. It is kept so nobody
 * rediscovers a finding somebody already decided against — not so everybody
 * reads it every time. */
else if (!status) shown = shown.filter((i) => i.status !== 'dropped');

const counts = tally(items);
const label = [owner && `owner "${owner}"`, unowned && 'unowned', status && `status ${status}`]
  .filter(Boolean)
  .join(', ');
console.log(
  `${shown.length} of ${counts.total} item(s)${label ? ` — ${label}` : ' — everything except dropped'}.`,
);
console.log('');

if (!shown.length) {
  console.log('  Nothing matches.');
  if (owner) console.log(`  Nobody is named "${owner}" on any item. pnpm check:backlog lists the roster.`);
  console.log('');
  process.exit(0);
}

for (const state of [...STATUSES, null]) {
  const group = shown.filter((i) => (state ? i.status === state : !i.status));
  if (!group.length) continue;
  console.log(`${(state ?? 'NO STATE').toUpperCase()} — ${group.length}`);
  for (const i of group) {
    console.log(`  ${i.title}`);
    console.log(`      ${i.file}${i.section ? ` · ${i.section}` : ''} · ${i.owner ?? 'no owner'}`);
    if (i.statusReason) console.log(`      ${i.statusReason}`);
  }
  console.log('');
}
