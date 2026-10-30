/**
 * Reads this machine's session transcripts and says what the work cost.
 *
 * **It exists because nothing here could answer the question that started it.**
 * On 2026-09-10 a colleague reported burning 39 per cent of a quota in two days
 * against this repository, and every proposal about it — trim the prompt, drop
 * the product context layer, move to the design tool — was a guess, because none
 * could say what a session spent or on what. The transcripts had the answer the
 * whole time: every assistant entry carries a `usage` block.
 *
 * The rules and the arithmetic live in `cost-rates.mjs`, which has its own spec.
 * This file is the read, the scope floor and the exit code.
 *
 * **It reports; it does not gate.** Like `check:env`, the only thing that exits
 * non-zero is a run that could not measure. A busy day is not a failure and a
 * quiet one is not a pass — the number is for comparison, and the comparison is
 * a person's to make.
 *
 * Usage:
 *   pnpm cost                 this project's sessions
 *   pnpm cost --all           every project on this machine
 *   pnpm cost --days 7        only the last 7 calendar days that have data
 *   pnpm cost --sessions 20   how many session rows to print (default 10)
 *   pnpm cost --prefix        how the FIRST call of a session has moved, which
 *                             is the floor every later call carries
 *   pnpm cost --window 8      sessions per comparison window for --prefix
 *   pnpm cost --prefix --list the sessions behind that verdict, one row each
 *   pnpm cost --tools         what each TOOL put into the conversation, and what
 *                             carrying it for the rest of the session cost
 *   pnpm cost --agents        one row per subagent run: what it cost, and the
 *                             task it was handed. --agents 10 for the top ten
 *   pnpm cost --json          the same figures as machine-readable JSON, for
 *                             `pnpm snapshot` to keep past the window
 *
 * **`--json` prints no table and carries no prose.** It exists because the
 * window this reads erases itself: measured 2026-09-12, six days retained
 * anything and the ten busiest days in this repository's history retained
 * nothing. It also drops the one field a snapshot must not keep — the task an
 * agent was handed, which is prompt text.
 *
 * **`--tools` is where the money is, and it is not a file.** Measured
 * 2026-09-10: tool results are 52 per cent of the spend and `Bash` alone is 24,
 * against 6,6 for the whole always-loaded prompt. A result injected at call k of
 * a session of N is re-read N-k times, so the same output costs nothing at the
 * end of a session and a great deal at the start.
 *
 * It replaces the PostToolUse hook this was nearly built as. A hook would
 * measure the same thing, charge every one of the 28.712 tool calls for the
 * privilege, and only ever see forward. The transcripts already hold it.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { belongsToRepo, mainCheckout, projectSlug } from './skill-routing-rules.mjs';
import {
  CANNOT_SEE,
  RATES_SOURCE,
  addCall,
  contextTokens,
  emptyTotals,
  meanContext,
  isFreeModel,
  normalizeModel,
  rateFor,
  repriceAt,
  BYTES_PER_TOKEN,
  scopeFailure,
  carriedTokens,
  textLength,
  tokensFrom,
} from './cost-rates.mjs';
import { DEFAULT_WINDOW, prefixWindows, rangeOf, windowRows } from './prefix-window.mjs';
import { transcriptsUnder } from './transcript-walk.mjs';

const args = process.argv.slice(2);
const wantsAll = args.includes('--all');
const numberAfter = (flag, fallback) => {
  const at = args.indexOf(flag);
  if (at === -1) return fallback;
  const value = Number(args[at + 1]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
};
const dayLimit = numberAfter('--days', 0);
const sessionRows = numberAfter('--sessions', 10);
const wantsTools = args.includes('--tools');
/* `--agents` with no number prints every run, the way `--days` with no number
 * prints every day. The count is the point of the table: 49 rows against 49
 * transcripts is what says nothing was dropped on the way. */
const wantsAgents = args.includes('--agents');
const agentRows = numberAfter('--agents', 0);
const wantsPrefix = args.includes('--prefix');
const prefixWindow = numberAfter('--window', DEFAULT_WINDOW);
/* The rows behind the verdict. Off by default because the verdict is what a
 * reader wants most days — and on, because the day it says UNSETTLED the median
 * is the one thing that cannot show whether the window straddles a step or the
 * sessions genuinely disagree. */
const wantsPrefixList = wantsPrefix && args.includes('--list');
const wantsJson = args.includes('--json');

const PROJECTS = join(homedir(), '.claude', 'projects');

/**
 * The transcript directory is the working directory with its separators mangled,
 * and BOTH case variants exist on this machine — `c--design-ops` and
 * `C--design-ops` were both on disk on 2026-09-10, written by different runs.
 * Matching case-sensitively would read half the history and report a confident
 * number over it, so the match is folded and every hit is read.
 */
function projectDirs() {
  let entries;
  try {
    entries = readdirSync(PROJECTS, { withFileTypes: true });
  } catch (error) {
    console.error(`FAIL — could not read ${PROJECTS}.`);
    console.error(`  ${error.message}`);
    console.error('  A check that could not run is not a check that passed.');
    process.exit(1);
  }
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => join(PROJECTS, e.name));
  if (wantsAll) return dirs;

  /* The slug rule and the worktree rule both live in `skill-routing-rules.mjs`,
   * which has a spec, rather than being written a second time here. `pnpm
   * routing` and `pnpm cost` read the same directories and disagreeing about
   * which ones is a defect neither could report.
   *
   * The match is a PREFIX because a worktree is this repository: three of them
   * held 8 sessions on this machine on 2026-09-12 and an exact match read none
   * of them, so every figure `pnpm cost` printed was a floor. Run from inside
   * one, the same line failed outright. */
  const slug = projectSlug(mainCheckout(process.cwd()));
  const mine = dirs.filter((d) => belongsToRepo(basename(d), slug));
  if (mine.length) return mine;

  /* No silent widening. Reading every project when this one did not resolve is
   * how a scope error becomes a number nobody questions. */
  console.error(`FAIL — no transcript directory matches this working directory.`);
  console.error(`  cwd    ${process.cwd()}`);
  console.error(`  looked for  ${slug}, and any worktree directory under it`);
  console.error(`  under  ${PROJECTS}`);
  console.error('');
  console.error(`  ${dirs.length} project director(ies) are there. Pass --all to read all of them,`);
  console.error('  which measures every client on this machine and not this repository.');
  console.error('');
  process.exit(1);
}

const dirs = projectDirs();
const files = transcriptsUnder(dirs);

const overall = emptyTotals();
const byDay = new Map();
const byModel = new Map();
const bySession = [];
const unknownModels = new Map();
let pricedCalls = 0;
let freeCalls = 0;
const byTool = new Map();
const byCommand = new Map();
const byFile = new Map();

const toolBucket = (map, key) => {
  if (!map.has(key)) map.set(key, { calls: 0, chars: 0, carried: 0, position: 0 });
  return map.get(key);
};
let sidechainEntries = 0;
let skillInvocations = 0;

/* Subagent spend is kept APART from every total above rather than folded in.
 *
 * The reason is not caution, it is that the figures already published have
 * dates on them: CLAUDE.md and docs/ cite 57.346 priced calls, 15.967 tool
 * calls, tool output at 52 per cent. Folding sidechain into the same
 * denominators would leave every one of those sentences describing something
 * else, with nothing to announce it. The combined line below is the one place
 * the two are added up.
 *
 * > SOURCE: Ian Rueff, 2026-09-11, asked which of the three shapes to build.
 */
const sidechain = emptyTotals();
const sidechainByModel = new Map();
const sidechainFiles = { total: 0, withSpend: 0 };
const sidechainUnknownModels = new Map();

/* One row per subagent RUN, which is one transcript file.
 *
 * The total and the by-model breakdown above answer how much fan-out cost and
 * on what. Neither can answer which agent, and on 2026-08-31 that was the
 * question: 1.979 subagent calls, 202,81 USD, 70 per cent of the whole retained
 * record, and no way to point at one of them. CLAUDE.md's rule that a fan-out
 * has to be argued for every time cites exactly this absence.
 *
 * A run that spent nothing is kept, for the same reason `withSpend` is counted
 * from the accumulation rather than from a flag: an agent that was spawned and
 * did nothing is a finding, and a table it vanishes from cannot report it. */
const byAgent = [];

/** Sidechain files that are not runs, named in the table's footer rather than
 * silently dropped: they are the difference between a transcript count and a
 * run count, and an unexplained difference is what sends somebody reading. */
const nonRunFiles = [];

const bucket = (map, key) => {
  if (!map.has(key)) map.set(key, emptyTotals());
  return map.get(key);
};

/** How much of an agent's prompt a row shows. One line, or the table stops
 * being a table. */
const TASK_CHARS = 60;

/** How much of it is KEPT, which is a different number and has to be much
 * larger. The 48 runs of 2026-08-31 share 2.529 characters of preamble before
 * one word differs, so a label cut at 60 would print the same string 48 times
 * and identify nothing. What the table shows is what is left after the shared
 * head is removed, and removing it needs the head. */
const TASK_SCAN = 6000;

/** The head every one of these strings begins with. Empty when they differ at
 * the first character, which is the ordinary case and costs one comparison. */
const commonPrefix = (texts) => {
  let prefix = texts[0];
  for (const text of texts.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < text.length && prefix[i] === text[i]) i += 1;
    prefix = prefix.slice(0, i);
    if (prefix === '') break;
  }
  return prefix;
};

/**
 * The task an agent was handed, read from its first message.
 *
 * It has to come from the prompt because nothing else names the run: every
 * sidechain line under this project carries the same `attributionAgent`,
 * `"workflow-subagent"`, which says what kind of thing ran and never which one.
 *
 * A `<system-reminder>` is dropped rather than truncated into the row: it is
 * injected, it is the same text on every agent, and a table whose rows all
 * begin with it identifies nothing.
 */
const taskFrom = (message) => {
  const content = message && message.content;
  const raw =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content
            .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
            .map((b) => b.text)
            .join(' ')
        : '';
  const clean = raw
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean === '' ? null : clean.slice(0, TASK_SCAN);
};

for (const { path: file, sidechain: isSidechainFile, agent: agentOf } of files) {
  if (isSidechainFile) sidechainFiles.total += 1;
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const session = emptyTotals();
  let sidechainLines = 0;
  /* Per-RUN accumulation, alive only for a sidechain file. Kept beside the
   * session's rather than inside it so a future change to one cannot silently
   * move the other. */
  const agentTotals = isSidechainFile ? emptyTotals() : null;
  const agentModels = new Map();
  let agentEffort = null;
  let agentTask = null;
  let firstDay = null;
  let lastDay = null;
  /* --prefix needs the session's START, not its day, because two sessions on one
   * day sit on opposite sides of a change made at midday. */
  let firstTs = null;
  let firstContext = null;
  const openTools = new Map();

  const lines = text.split('\n');

  /* The carry multiplier needs the session's total call count BEFORE the walk,
   * because a result's cost is how many calls come after it. Counted in its own
   * pass rather than inferred, and only when --tools asks for it: the pass
   * doubles the parse time and every other view here is exact without it. */
  let sessionCalls = 0;
  /* The tool tables stay over MAIN sessions only, for the same reason the
   * totals do: the shares they print - tool output at 52 per cent, Bash at 24 -
   * are cited with dates on them. */
  if (wantsTools && !isSidechainFile) {
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      try {
        if ((JSON.parse(t).message || {}).usage) sessionCalls += 1;
      } catch {
        /* same tolerance as the walk below */
      }
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let entry;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      /* A truncated final line is normal on a session still running. Skipping it
       * loses one call; refusing the file would lose the session. */
      continue;
    }
    if (entry.isSidechain) sidechainEntries += 1;

    const message = entry.message;
    if (message && Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block && block.type === 'tool_use' && block.name === 'Skill') skillInvocations += 1;
      }
    }

    if (wantsTools && !isSidechainFile) {
      for (const block of Array.isArray(message && message.content) ? message.content : []) {
        if (!block || typeof block !== 'object') continue;
        if (block.type === 'tool_use') openTools.set(block.id, { name: block.name, input: block.input || {}, at: session.calls });
        else if (block.type === 'tool_result') {
          const opened = openTools.get(block.tool_use_id);
          if (!opened) continue;
          openTools.delete(block.tool_use_id);
          const chars = textLength(block.content);
          const carried = carriedTokens(chars, sessionCalls - opened.at);
          const row = toolBucket(byTool, opened.name || '(unnamed)');
          row.calls += 1;
          row.chars += chars;
          row.carried += carried;
          row.position += sessionCalls ? opened.at / sessionCalls : 0;
          if (opened.name === 'Bash' || opened.name === 'PowerShell') {
            /* The first word of the command, with any path stripped. Most
             * commands here open with `cd <repo> && …`, so a naive head reads
             * `cd` for 6.431 of them and says nothing — the `&&` split is what
             * makes this column mean anything. */
            const parts = String(opened.input.command || '')
              .split('&&')
              .map((p) => p.trim().replace(/^[("']+/, ''))
              .filter((p) => p && !p.startsWith('cd '));
            const first = (parts[0] || String(opened.input.command || '')).trim();
            const head = (first.split(/[\s|;&]/)[0] || '').split(/[/\\]/).pop().slice(0, 18) || '(empty)';
            const c = toolBucket(byCommand, head);
            c.calls += 1;
            c.chars += chars;
            c.carried += carried;
          } else if (opened.name === 'Read') {
            let path = String(opened.input.file_path || '(none)').split('\\').join('/');
            const repo = `/${basename(mainCheckout(process.cwd()))}/`;
            if (path.includes(repo)) path = path.split(repo).pop();
            const c = toolBucket(byFile, path.slice(-58));
            c.calls += 1;
            c.chars += chars;
            c.carried += carried;
          }
        }
      }
    }

    const day = typeof entry.timestamp === 'string' ? entry.timestamp.slice(0, 10) : null;
    if (day) {
      if (firstDay === null) firstDay = day;
      lastDay = day;
    }
    if (firstTs === null && typeof entry.timestamp === 'string') {
      const parsed = Date.parse(entry.timestamp);
      if (Number.isFinite(parsed)) firstTs = parsed;
    }

    /* Read BEFORE the usage gate: the prompt an agent was handed is a `user`
     * entry, and a `user` entry carries no usage block. Gating on usage first
     * is how this reads as working and labels every row null. */
    if (isSidechainFile) {
      if (agentTask === null && entry.type === 'user') agentTask = taskFrom(message);
      if (agentEffort === null && typeof entry.effort === 'string') agentEffort = entry.effort;
    }

    const usage = message && message.usage;
    if (!usage) continue;

    const model = normalizeModel(message.model);
    const tokens = tokensFrom(usage);
    /* The first PRICED call. A synthetic entry carries no context, and taking it
     * would report a prefix of zero for the session that had one. */
    if (firstContext === null) {
      const ctx = tokens.input + tokens.cacheRead + tokens.cacheWrite;
      if (ctx > 0) firstContext = ctx;
    }
    /* A free pseudo-model is neither priced nor unknown: it is known to cost
     * nothing. Counting it as priced would hold the scope gate open over a month
     * with no real rates at all. */
    if (isSidechainFile) {
      /* An unknown model is a FINDING here for the same reason it is above: a
       * model with no rate contributes nothing and the total still prints. */
      if (!isFreeModel(model) && !rateFor(model)) {
        sidechainUnknownModels.set(
          model ?? '(none)',
          (sidechainUnknownModels.get(model ?? '(none)') ?? 0) + 1,
        );
      }
      addCall(sidechain, tokens, model);
      addCall(bucket(sidechainByModel, model ?? '(none)'), tokens, model);
      addCall(agentTotals, tokens, model);
      agentModels.set(model ?? '(none)', (agentModels.get(model ?? '(none)') ?? 0) + 1);
      sidechainLines += 1;
      continue;
    }

    if (isFreeModel(model)) freeCalls += 1;
    else if (rateFor(model)) pricedCalls += 1;
    else unknownModels.set(model ?? '(none)', (unknownModels.get(model ?? '(none)') ?? 0) + 1);

    addCall(overall, tokens, model);
    addCall(session, tokens, model);
    addCall(bucket(byModel, model ?? '(none)'), tokens, model);
    if (day) addCall(bucket(byDay, day), tokens, model);
  }

  if (isSidechainFile) {
    /* Counted from the file's own accumulation rather than from a flag, so a
     * subagent transcript that exists and spent nothing is visible as exactly
     * that instead of vanishing. */
    if (sidechainLines > 0) sidechainFiles.withSpend += 1;
    /* A sidechain file with no agent id is not a run — a workflow's journal is
     * the case on disk — and a table of runs is the wrong place to print it. */
    if (!agentOf || agentOf.agentId === null) {
      nonRunFiles.push(basename(file));
      continue;
    }
    byAgent.push({
      id: agentOf.agentId,
      workflow: agentOf.workflowId,
      session: agentOf.sessionId,
      day: lastDay ?? firstDay ?? '(undated)',
      totals: agentTotals,
      /* The model that priced most of the run, not the first seen: a run that
       * fell back once should not be reported as the model it fell back to. */
      model: [...agentModels.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '(none)',
      effort: agentEffort,
      task: agentTask,
    });
    continue;
  }

  if (session.calls > 0) {
    bySession.push({
      file: basename(file),
      day: lastDay ?? firstDay ?? '(undated)',
      totals: session,
      start: firstTs,
      firstContext,
    });
  }
}

/* The scope gate, evaluated BEFORE a single figure is printed. Each of its three
 * conditions produces a total of zero dollars, and zero dollars over a busy month
 * is indistinguishable from a quiet one. */
const failedScope = scopeFailure({ files: files.length, calls: overall.calls, priced: pricedCalls });
if (failedScope) {
  console.error('FAIL — nothing could be measured.');
  console.error(`  ${failedScope}`);
  console.error('');
  console.error(`  Looked in ${dirs.length} project directory/directories under`);
  console.error(`  ${PROJECTS}`);
  console.error('  Pass --all to read every project on this machine.');
  console.error('');
  process.exit(1);
}

/* The machine-readable form, emitted instead of the tables and only after the
 * scope gate above — a snapshot of a run that measured nothing would write
 * zeroes over rows that hold real spend.
 *
 * Dollars are rounded to six places on the way out. The arithmetic is
 * deterministic given the same transcripts and the same rates, so an unrounded
 * float would still be stable — but the store is versioned, and a diff that
 * moves in the fifteenth decimal is a diff somebody has to read. */
if (wantsJson) {
  const round = (n) => Math.round(n * 1e6) / 1e6;
  const totalsOut = (t) => ({ ...t, usd: round(t.usd) });
  process.stdout.write(
    `${JSON.stringify({
      tool: 'cost',
      generatedAt: new Date().toISOString(),
      projects: dirs.map((d) => basename(d)),
      files: files.length,
      pricedCalls,
      freeCalls,
      /* Kept rather than derived from the session rows below: a session's totals
       * are filed under its LAST day, while these are bucketed per call, so a
       * session that ran through midnight lands on one day in one view and is
       * split across two in the other. Deriving either from the other would
       * report a number nothing measured. */
      days: Object.fromEntries([...byDay].map(([day, t]) => [day, totalsOut(t)])),
      sessions: bySession.map((s) => ({
        id: basename(s.file, '.jsonl'),
        day: s.day,
        start: Number.isFinite(s.start) ? new Date(s.start).toISOString() : null,
        firstContext: s.firstContext,
        ...totalsOut(s.totals),
      })),
      /* `task` is deliberately absent. It is the first message an agent was
       * handed — prompt text, which does not go into a versioned file. */
      agents: byAgent.map((a) => ({
        id: a.id,
        workflow: a.workflow,
        session: a.session,
        day: a.day,
        model: a.model,
        effort: a.effort,
        ...totalsOut(a.totals),
      })),
      sidechain: totalsOut(sidechain),
      /* Absent unless --tools ran, rather than an empty object: a reader has to
       * be able to tell "measured nothing" from "did not measure". */
      ...(wantsTools
        ? {
            tools: Object.fromEntries(
              [...byTool].map(([name, row]) => [
                name,
                { calls: row.calls, chars: row.chars, carried: Math.round(row.carried) },
              ]),
            ),
          }
        : {}),
    })}\n`,
  );
  process.exit(0);
}

const usd = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(n < 10 ? 2 : 0));
const M = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : `${(n / 1e6).toFixed(1)}M`);
const pct = (part, whole) => (whole === 0 ? '0.0' : ((part / whole) * 100).toFixed(1));
const int = (n) => Math.round(n).toLocaleString('en-US');

const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
const shown = dayLimit ? days.slice(-dayLimit) : days;

console.log(
  `Read ${files.length} transcript(s) across ${dirs.length} project(s): ${int(pricedCalls)} priced call(s)` +
    `${freeCalls ? `, ${int(freeCalls)} at a zero rate` : ''} over ${days.length} day(s).`,
);
for (const dir of dirs) console.log(`  ${basename(dir)}`);
console.log(`  ${RATES_SOURCE}`);
console.log('');

/* The split is summed PER MODEL at that model's own rates rather than at one
 * model's, because a mixed month priced at a single rate would report a split
 * that is arithmetically clean and about nothing. */
const split = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
for (const [model, totals] of byModel) {
  const rate = rateFor(model);
  if (!rate) continue;
  for (const key of Object.keys(split)) split[key] += (totals[key] * rate[key]) / 1e6;
}

console.log('TOTAL');
console.log(`  spend .................. ${usd(overall.usd)} USD (a proxy for quota, not a bill)`);
console.log(`  calls .................. ${int(overall.calls)}`);
console.log(`  mean context per call .. ${int(meanContext(overall))} tokens`);
console.log(`  context read ........... ${M(contextTokens(overall))} tokens`);
console.log(`  output written ......... ${M(overall.output)} tokens`);
console.log(
  `  where it goes .......... cache read ${pct(split.cacheRead, overall.usd)}%, cache write ${pct(split.cacheWrite, overall.usd)}%, output ${pct(split.output, overall.usd)}%, uncached input ${pct(split.input, overall.usd)}%`,
);
if (overall.unpriced > 0) {
  console.log(
    `  UNPRICED ............... ${int(overall.unpriced)} call(s) on a model with no rate — the total above is a floor`,
  );
  for (const [model, count] of [...unknownModels.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`      ${model} — ${int(count)} call(s). Add it to RATES in scripts/cost-rates.mjs.`);
  }
}
console.log('');

console.log('BY MODEL');
for (const [model, totals] of [...byModel.entries()].sort((a, b) => b[1].usd - a[1].usd)) {
  console.log(
    `  ${model.padEnd(22)} ${int(totals.calls).padStart(8)} calls  ${usd(totals.usd).padStart(8)} USD  ${pct(totals.calls, overall.calls).padStart(5)}% of calls`,
  );
}
console.log('');

/* The lever, stated as a ceiling rather than as a forecast. A cheaper model may
 * need more turns for the same task, which this cannot see. */
const asSonnet = repriceAt(overall, 'claude-sonnet-5');
if (asSonnet !== null && overall.usd > 0) {
  const saved = overall.usd - asSonnet;
  console.log('THE MODEL LEVER');
  console.log(
    `  the same tokens on claude-sonnet-5 .. ${usd(asSonnet)} USD, ${pct(saved, overall.usd)}% less`,
  );
  console.log(
    '  This is a CEILING on the saving, not a forecast: a cheaper model may need',
  );
  console.log('  more turns for the same task, and this cannot see that. Prove it on a task.');
  console.log('');
}

/* SUBAGENT SPEND, kept out of every total above and added up only on the last
 * line here. What it is for is the model lever: a census handed to `sonnet`
 * under the `census` rung was invisible to this script until 2026-09-11, so the
 * one row of the ladder that names a model could never be shown to have been
 * obeyed. Now it can. */
console.log('SUBAGENT SPEND — not counted in anything above');
const spenders = [...byAgent].sort((a, b) => b.totals.usd - a.totals.usd);
if (sidechainFiles.total === 0) {
  console.log('  No subagent transcripts under the project directory/directories read.');
  console.log('  That is an absence of fan-out, not an absence of measurement.');
} else {
  console.log(
    `  transcripts ............ ${int(sidechainFiles.total)}, of which ${int(sidechainFiles.withSpend)} carried priced calls`,
  );
  console.log(`  calls .................. ${int(sidechain.calls)}`);
  console.log(`  cost ................... ${usd(sidechain.usd)} USD`);
  console.log(`  context read ........... ${M(contextTokens(sidechain))} tokens`);
  console.log(`  output written ......... ${M(sidechain.output)} tokens`);
  if (sidechain.unpriced > 0) {
    console.log(
      `  UNPRICED ............... ${int(sidechain.unpriced)} call(s) on a model with no rate — the figure above is a floor`,
    );
    for (const [model, count] of [...sidechainUnknownModels.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`      ${model} — ${int(count)} call(s). Add it to RATES in scripts/cost-rates.mjs.`);
    }
  }
  if (sidechainByModel.size > 0) {
    console.log('  by model:');
    for (const [model, totals] of [...sidechainByModel.entries()].sort((a, b) => b[1].usd - a[1].usd)) {
      console.log(
        `      ${model.padEnd(22)} ${int(totals.calls).padStart(8)} calls  ${usd(totals.usd).padStart(8)} USD  ${pct(totals.calls, sidechain.calls).padStart(5)}% of subagent calls`,
      );
    }
  }
  /* The one line that is not a total. Without it the breakdown exists and
   * nobody knows it does, which is the state this report was already in. */
  if (spenders.length > 0 && spenders[0].totals.usd > 0) {
    const worst = spenders[0];
    const pointer = wantsAgents ? '' : `. --agents for all ${int(byAgent.length)}`;
    console.log(
      `  most expensive run ..... ${worst.id} — ${usd(worst.totals.usd)} USD, ${pct(worst.totals.usd, sidechain.usd)}% of subagent spend${pointer}`,
    );
  }
  console.log(
    `  MAIN + SUBAGENT ........ ${usd(overall.usd + sidechain.usd)} USD, of which subagents are ${pct(sidechain.usd, overall.usd + sidechain.usd)}%`,
  );
  console.log('  Every other figure in this report excludes this one, including --tools.');
}
console.log('');

/* ONE ROW PER RUN. Behind a flag because most days the total is the answer, and
 * this table is 48 lines on the one day it was not. */
if (wantsAgents && byAgent.length > 0) {
  const rows = agentRows > 0 ? spenders.slice(0, agentRows) : spenders;

  /* A row shows what is left of its prompt after the part its group shares.
   *
   * Without this the column is decoration: the 48 runs measured on 2026-08-31
   * are identical for 2.529 characters, so every row printed the same sentence
   * and the table could not say which agent did what. The shared head is also
   * a finding of its own — it is a preamble the fan-out paid for 48 times — so
   * its length is printed rather than quietly removed. */
  const groups = new Map();
  for (const r of byAgent) {
    const key = r.workflow ?? '(no workflow)';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const shared = new Map();
  for (const [key, group] of groups) {
    const tasks = group.map((r) => r.task).filter((t) => t !== null);
    shared.set(key, tasks.length > 1 ? commonPrefix(tasks).length : 0);
  }

  const cut = (text, width) =>
    text.length > width ? `${text.slice(0, width - 1)}…` : text.padEnd(width);
  const label = (r) => {
    if (r.task === null) return '(no prompt in the transcript)';
    const head = shared.get(r.workflow ?? '(no workflow)') ?? 0;
    /* A prompt that IS the shared head keeps its head, because a blank column
     * would read as a run with no task rather than one with no difference. */
    const rest = r.task.slice(head).replace(/^[\s=·:,—-]+/, '');
    const text = rest === '' ? r.task : rest;
    return text.length > TASK_CHARS ? `${text.slice(0, TASK_CHARS - 1)}…` : text;
  };

  console.log(`BY AGENT — ${rows.length} of ${int(byAgent.length)} run(s), most expensive first`);
  console.log('  day         agent         model          effort   calls      USD  share  task');
  for (const r of rows) {
    console.log(
      `  ${r.day}  ${cut(r.id, 12)}  ${cut(r.model, 13)}  ${cut(r.effort ?? '—', 6)}  ${int(r.totals.calls).padStart(6)}  ${usd(r.totals.usd).padStart(7)}  ${pct(r.totals.usd, sidechain.usd).padStart(5)}%  ${label(r)}`,
    );
  }
  for (const [key, group] of groups) {
    const head = shared.get(key) ?? 0;
    if (head === 0) continue;
    console.log(
      `  ${int(group.length)} run(s) under ${key} share the first ${int(head)} characters of their prompt, sent once each.`,
    );
  }
  const silent = byAgent.filter((r) => r.totals.calls === 0).length;
  if (silent > 0) {
    console.log(`  ${int(silent)} run(s) priced nothing at all — spawned, and no call reached a model.`);
  }
  if (nonRunFiles.length > 0) {
    const said = nonRunFiles.length === 1 ? 'file, which is not a run' : 'files, which are not runs';
    console.log(
      `  ${int(nonRunFiles.length)} more sidechain ${said}: ${nonRunFiles.join(', ')}.`,
    );
    console.log('  That is the difference between the transcript count above and this one.');
  }
  console.log('');
}

console.log(`BY DAY${dayLimit ? ` (last ${shown.length})` : ''}`);
console.log('  day           calls      USD    mean context     output');
for (const [day, totals] of shown) {
  console.log(
    `  ${day}  ${int(totals.calls).padStart(7)}  ${usd(totals.usd).padStart(7)}  ${int(meanContext(totals)).padStart(14)}  ${M(totals.output).padStart(9)}`,
  );
}
console.log('');

if (wantsPrefix) {
  console.log('PREFIX — the first call of a session, the floor every later call carries');
  const p = prefixWindows(bySession, prefixWindow);
  if (!p.ok) {
    /* Refusing is the point. A median over three transcripts prints exactly like
     * a measurement and is not one. */
    console.log(`  cannot answer — ${p.reason}`);
  } else {
    console.log(`  window ... ${p.window} session(s) each, of ${p.usable} that carry a first call`);
    console.log(`  prior .... ${rangeOf(p.prior).padEnd(23)} median ${int(p.priorMedian)}`);
    console.log(`  recent ... ${rangeOf(p.recent).padEnd(23)} median ${int(p.recentMedian)}`);
    const sign = p.delta > 0 ? '+' : '';
    console.log(
      `  change ... ${sign}${int(p.delta)} tokens` +
        (p.pct === null ? '' : `, ${sign}${p.pct.toFixed(1)}%`),
    );
    console.log(`  all-time median over ${p.usable} sessions is ${int(p.allTimeMedian)}.`);
    console.log(
      p.allTimeWouldMislead
        ? '  It is NOT the comparator, and here it would have told the opposite story.'
        : '  It is NOT the comparator; the windows above are.',
    );
    if (p.windowUnsettled) {
      /* The failure this catches is the one that reads as a result: a window
       * spanning the change averages it away and prints a settled median. */
      console.log(
        `  UNSETTLED — the recent window's own sessions differ by ` +
          `${(p.recentSpread * 100).toFixed(0)}%, so its median straddles a boundary.`,
      );
      console.log('  The repair is more sessions, not a different --window.');
      if (!wantsPrefixList) console.log('  Add --list to see the sessions it was computed from.');
    }
    if (wantsPrefixList) {
      console.log('');
      console.log('  window   started           session   first call   calls');
      for (const line of windowRows(p, int)) console.log(`  ${line}`);
    }
  }
  console.log('');
}

const top = [...bySession].sort((a, b) => b.totals.usd - a.totals.usd).slice(0, sessionRows);
const topSpend = top.reduce((sum, s) => sum + s.totals.usd, 0);
console.log(`TOP ${top.length} SESSIONS of ${bySession.length} — ${pct(topSpend, overall.usd)}% of all spend`);
console.log('  day           calls      USD    mean context   session');
for (const { file, day, totals } of top) {
  console.log(
    `  ${day}  ${int(totals.calls).padStart(7)}  ${usd(totals.usd).padStart(7)}  ${int(meanContext(totals)).padStart(14)}   ${file.slice(0, 8)}`,
  );
}
console.log('');

if (wantsTools) {
  const usdPerKb = (row) => {
    const kb = (row.chars || 0) / 1024;
    return kb === 0 ? 0 : (row.carried * 0.5) / 1e6 / kb;
  };
  const carriedTotal = [...byTool.values()].reduce((sum, r) => sum + r.carried, 0);

  console.log('BY TOOL — what each one put into the conversation, and what carrying it cost');
  console.log(
    '  A result injected at call k of a session of N is re-read N-k times. The multiplier',
  );
  console.log('  is that carry, measured. Position 0.00 is the start of a session and 1.00 the end.');
  console.log('');
  console.log('  tool                    calls   tok/call   multip   pos      USD   USD/KB      %');
  const tools = [...byTool.entries()].sort((a, b) => b[1].carried - a[1].carried);
  for (const [name, row] of tools.slice(0, 16)) {
    const perCall = row.calls ? row.chars / BYTES_PER_TOKEN / row.calls : 0;
    const mult = row.chars ? row.carried / (row.chars / BYTES_PER_TOKEN) : 0;
    console.log(
      `  ${name.slice(0, 22).padEnd(22)} ${int(row.calls).padStart(7)} ${int(perCall).padStart(10)} ${int(mult).padStart(8)} ${(row.position / Math.max(1, row.calls)).toFixed(2).padStart(5)} ${usd((row.carried * 0.5) / 1e6).padStart(8)} ${usdPerKb(row).toFixed(3).padStart(8)} ${pct(row.carried, carriedTotal).padStart(6)}`,
    );
  }
  console.log(
    `  ${'ALL TOOLS'.padEnd(22)} ${int([...byTool.values()].reduce((s, r) => s + r.calls, 0)).padStart(7)} ${''.padStart(10)} ${''.padStart(8)} ${''.padStart(5)} ${usd((carriedTotal * 0.5) / 1e6).padStart(8)}`,
  );
  console.log('');

  const table = (title, map, rows) => {
    console.log(title);
    for (const [key, row] of [...map.entries()].sort((a, b) => b[1].carried - a[1].carried).slice(0, rows)) {
      console.log(
        `  ${key.slice(0, 58).padEnd(58)} ${int(row.calls).padStart(6)} ${usd((row.carried * 0.5) / 1e6).padStart(8)} USD`,
      );
    }
    console.log('');
  };
  table('BY SHELL COMMAND — the first word, with any leading `cd` skipped', byCommand, 12);
  console.log('  A compound command has ONE result, so all of it lands on the first word after');
  console.log('  the `cd`. Read this as "commands that open this way", not as attribution.');
  console.log('');
  table('BY FILE READ', byFile, 12);

  console.log('  The token counts above are chars / 3.7 and inherit that approximation.');
  console.log('  Everything priced off a usage block — the totals, the days, the model lever —');
  console.log('  is exact. These are not.');
  console.log('');
}

console.log('WHAT THIS CANNOT SEE');
for (const line of CANNOT_SEE) console.log(`  ${line}`);
console.log(
  `  Measured on this run: ${int(sidechainEntries)} entr(ies) carry an isSidechain marker and`,
);
console.log(
  `  ${int(sidechain.calls)} subagent call(s) were priced, against ${int(overall.calls)} in main sessions.`,
);
console.log(`  ${int(skillInvocations)} Skill invocation(s).`);
console.log('');
