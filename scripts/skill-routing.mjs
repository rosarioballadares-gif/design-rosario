/**
 * Which skills have actually been invoked, over the transcripts still on disk.
 *
 * **The question nothing else here can answer.** `check:skills-table` compares
 * names in both directions and `check:floor` prices the listing, so between
 * them this repository knows what its skills cost and nothing about whether any
 * of them ever ran. A description is the whole routing mechanism for a skill
 * the agent can see, and until this ran, no measurement existed either way.
 *
 * **It reports rather than gates**, and it exits 1 only when it read nothing —
 * the rule `session-cost.mjs` states: a run that measured nothing must not
 * print a zero, because a zero is indistinguishable from a finding.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  belongsToRepo,
  invocationsIn,
  mainCheckout,
  parseSince,
  projectSlug,
  routesOnDescription,
  sessionStart,
  skillState,
  startedAfter,
  typedIn,
} from './skill-routing-rules.mjs';

const PROJECTS = join(homedir(), '.claude', 'projects');
const SKILLS = join(process.cwd(), '.claude/skills');
const wantsAll = process.argv.includes('--all');
/* `--json` prints the same measurement as machine-readable rows for
 * `pnpm snapshot`, one per transcript READ — including the ones that invoked
 * nothing, which are the denominator of every silence reported below. */
const wantsJson = process.argv.includes('--json');
/* A flag with nothing after it reads as `''` rather than as an absent flag, so
 * `--since` typed alone is refused instead of quietly measuring everything. */
const sinceFlag = process.argv.indexOf('--since');
const sinceArg = parseSince(sinceFlag === -1 ? undefined : (process.argv[sinceFlag + 1] ?? ''));
if (sinceArg.error) {
  console.error(`\nFAIL - ${sinceArg.error}.`);
  console.error('  Nothing was measured, so there is no number to print.\n');
  process.exit(1);
}

/** The transcript directories of this checkout and its worktrees. */
function projectDirs() {
  let entries;
  try {
    entries = readdirSync(PROJECTS, { withFileTypes: true });
  } catch (error) {
    console.error(`\nFAIL - could not read ${PROJECTS}.`);
    console.error(`  ${error.message}`);
    console.error('  A check that could not run is not a check that passed.\n');
    process.exit(1);
  }
  const slug = projectSlug(mainCheckout(process.cwd()));
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => wantsAll || belongsToRepo(name, slug));
  if (dirs.length === 0) {
    console.error(`\nFAIL - no transcript directory under ${PROJECTS} matches ${slug}.`);
    console.error('  Pass --all to read every project on this machine, which measures');
    console.error('  other repositories and not this one.\n');
    process.exit(1);
  }
  return dirs.map((name) => join(PROJECTS, name));
}

/** Every transcript under a directory. The walk is recursive because most of
 * them are not at the top level: subagent and workflow runs nest. */
function transcriptsUnder(dirs) {
  const files = [];
  for (const dir of dirs) {
    let entries = [];
    try {
      entries = readdirSync(dir, { recursive: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const file = join(dir, String(entry));
      if (file.endsWith('.jsonl') && statSync(file).isFile()) files.push(file);
    }
  }
  return files;
}

/** Every skill on disk, with what an agent can see of it. */
function skillsOnDisk() {
  let overrides = {};
  try {
    overrides = JSON.parse(readFileSync(join(process.cwd(), '.claude/settings.json'), 'utf8'))
      .skillOverrides ?? {};
  } catch {
    /* no settings file, or no overrides in it: every skill is on its frontmatter */
  }
  const states = new Map();
  for (const name of readdirSync(SKILLS)) {
    let text = '';
    try {
      text = readFileSync(join(SKILLS, name, 'SKILL.md'), 'utf8');
    } catch {
      continue;
    }
    states.set(name, skillState(text, overrides[name]));
  }
  return states;
}

const dirs = projectDirs();
const files = transcriptsUnder(dirs);
if (files.length === 0) {
  console.error(`\nFAIL - ${dirs.length} director(ies) matched and not one transcript in them.`);
  console.error('  Nothing was measured, so there is no number to print.\n');
  process.exit(1);
}

const invoked = new Map();
const typed = new Map();
const days = new Set();
let first = null;
let last = null;

let read = 0;
let undated = 0;
let filtered = 0;

/* One row per transcript read, kept only for `--json`. The totals above are
 * what the tables print; these are what survives the window, and they have to
 * be per session because a snapshot taken while a session is still open reads
 * fewer calls than the same session read tomorrow. A store keyed on the
 * session is merged by replacing that row; one keyed on the totals could only
 * be added up, and adding two overlapping windows counts the overlap twice. */
const bySession = [];

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const start = sessionStart(text);
  if (start === null) undated += 1;
  if (!startedAfter(start, sinceArg.since)) {
    filtered += 1;
    continue;
  }
  read += 1;
  const day = (start ?? statSync(file).mtime.toISOString()).slice(0, 10);
  days.add(day);
  if (first === null || day < first) first = day;
  if (last === null || day > last) last = day;
  const sessionInvoked = new Map();
  const sessionTyped = new Map();
  for (const line of text.split('\n')) {
    if (line === '') continue;
    for (const call of invocationsIn(line)) {
      const seen = invoked.get(call.skill) ?? { count: 0, callers: new Set() };
      seen.count += 1;
      seen.callers.add(call.caller);
      invoked.set(call.skill, seen);
      const here = sessionInvoked.get(call.skill) ?? { count: 0, callers: new Set() };
      here.count += 1;
      here.callers.add(call.caller);
      sessionInvoked.set(call.skill, here);
    }
    for (const name of typedIn(line)) {
      typed.set(name, (typed.get(name) ?? 0) + 1);
      sessionTyped.set(name, (sessionTyped.get(name) ?? 0) + 1);
    }
  }
  if (wantsJson) {
    bySession.push({
      id: file.split(/[\\/]/).pop().replace(/\.jsonl$/, ''),
      day,
      /* `null` when the transcript carried no timestamp and the day came off
       * mtime — the one case the window above footnotes rather than hides. */
      start: start === null ? null : new Date(start).toISOString(),
      invoked: Object.fromEntries(
        [...sessionInvoked].map(([skill, seen]) => [
          skill,
          { count: seen.count, callers: [...seen.callers].sort() },
        ]),
      ),
      typed: Object.fromEntries(sessionTyped),
    });
  }
}

const states = skillsOnDisk();
const described = [...states].filter(([, state]) => routesOnDescription(state)).map(([n]) => n);
const silent = [...states].filter(([, state]) => !routesOnDescription(state)).map(([n]) => n);

if (read === 0) {
  console.error(`\nFAIL - ${files.length} transcript(s) matched and --since left none of them.`);
  console.error('  Nothing was measured, so there is no number to print.\n');
  process.exit(1);
}

const span = (new Date(last) - new Date(first)) / 86_400_000 + 1;
const empty = span - days.size;

/* The machine-readable form, after both gates above for the reason
 * `session-cost.mjs` states: a run that measured nothing must not write zeroes
 * over rows that hold real invocations.
 *
 * `skills` carries the STATE of each skill at the moment of the snapshot, not
 * just the names. Whether a skill routed on a description is what the silences
 * below mean, and it changes — 12 descriptions were rewritten on 2026-09-12 —
 * so a row read back in a month without it cannot say which text was silent. */
if (wantsJson) {
  process.stdout.write(
    `${JSON.stringify({
      tool: 'routing',
      generatedAt: new Date().toISOString(),
      projects: dirs.map((d) => d.split(/[\\/]/).pop()),
      files: files.length,
      read,
      filtered,
      undated,
      since: sinceArg.since === null ? null : new Date(sinceArg.since).toISOString(),
      window: { first, last, span, retained: [...days].sort(), empty },
      skills: Object.fromEntries(
        [...states].map(([name, state]) => [name, { state, routesOnDescription: routesOnDescription(state) }]),
      ),
      sessions: bySession,
    })}\n`,
  );
  process.exit(0);
}

console.log('\nSKILL ROUTING - which skills were actually invoked, and by which route.');
console.log(`  ${files.length} transcript(s) in ${dirs.length} project director(ies) under ${PROJECTS}`);
if (sinceArg.since !== null) {
  console.log(
    `  --since ${new Date(sinceArg.since).toISOString()} left ${read}, filtering ${filtered} out` +
      (undated ? `, ${undated} of them for carrying no readable start` : ''),
  );
}
console.log(`  window ${first} to ${last}, ${span} day(s), of which ${empty} retained nothing`);
console.log(
  `  a day is the session's own first timestamp` +
    (undated && sinceArg.since === null
      ? `, except for ${undated} transcript(s) carrying none, read off mtime`
      : ''),
);
console.log(`  ${states.size} skill(s) in .claude/skills/, ${described.length} routing on a description`);

const rows = [...invoked].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]));
console.log('\n  invoked through the Skill tool');
if (rows.length === 0) console.log('    nothing. No skill was ever invoked in what was read.');
for (const [name, seen] of rows) {
  const where = states.has(name) ? '' : '   (not in .claude/skills/)';
  console.log(`    ${name.padEnd(24)} ${String(seen.count).padStart(3)}  ${[...seen.callers].join(', ')}${where}`);
}

const typedRows = [...typed]
  .filter(([name]) => states.has(name))
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
console.log('\n  typed by a person as a slash command');
if (typedRows.length === 0) console.log('    nothing.');
for (const [name, count] of typedRows) {
  console.log(`    ${name.padEnd(24)} ${String(count).padStart(3)}`);
}

const never = described.filter((name) => !invoked.has(name) && !typed.has(name)).sort();
console.log(`\n  never reached, of the ${described.length} that route on a description`);
console.log(`    ${never.length}: ${never.join(', ') || 'none'}`);
console.log(`\n  hidden or name-only, where silence is expected rather than a finding`);
console.log(`    ${silent.length}: ${silent.sort().join(', ') || 'none'}`);

const total = rows.reduce((sum, [, seen]) => sum + seen.count, 0);
console.log(`\nOK - ${total} invocation(s) read across ${read} transcript(s).`);
console.log('  What it cannot see: a session whose transcript was pruned, and the window');
console.log('  above names the days that kept nothing rather than filling them. A skill');
console.log('  whose instructions reached an agent some other way leaves no call here.');
console.log('  And whether a description WOULD fire if its condition arose, which is a');
console.log('  prospective test - this reads what happened, not what would.');
console.log('  --since moves the boundary and never the axis: it says when a session');
console.log('  OPENED, never which version of a description that session was shown.\n');
