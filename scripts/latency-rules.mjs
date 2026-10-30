/**
 * The pure rules behind `pnpm latency`, kept apart from the read.
 *
 * `latency.mjs` walks the transcripts and prints. This file decides what a gap
 * between two entries MEANS, and `latency-rules.spec.mjs` is what holds it to
 * that. The split is the one `context-rules.mjs` already uses here, for the
 * same reason: the classifier is where the defects are, and a classifier with
 * no spec reports its own bugs as findings.
 *
 * **What these numbers are.** `message.diagnostics` is `null` in every entry
 * read on 2026-09-11, so there is no server-side timing anywhere in a
 * transcript. Every figure here is derived from `timestamp`, which the CLIENT
 * writes when it persists an entry. So this measures WALL CLOCK with the
 * client's own overhead inside it, and in a session that was not running in
 * bypass mode it also contains however long a human took to approve a
 * permission prompt. It is an honest proxy for what a person waits through. It
 * is not server latency and must never be reported as one.
 */

/** A gap below this is not a measurement. Zero, so only a backwards clock goes. */
const FLOOR_MS = 0;

/**
 * A gap longer than this is not latency, it is a session left open.
 *
 * Twenty minutes. The choice is arbitrary in the way every threshold is, so it
 * is an ARGUMENT everywhere below and this constant is only the default the
 * runner passes. What is not arbitrary is that these gaps are reported as their
 * own bucket rather than averaged in: one lunch break inside a `wait` sample
 * moves a mean by more than a week of real work does, which is the whole reason
 * this file reports percentiles.
 */
export const IDLE_MS = 20 * 60 * 1000;

/**
 * Tools whose result is a PERSON answering, not a machine working.
 *
 * Measured 2026-09-11 on the first full run: `AskUserQuestion` came out the
 * slowest tool on the board at 20,8 hours of wall clock, p50 39,3 s, p90 205,2
 * s. Every second of that is somebody reading four options and deciding. Timed
 * as a tool it makes the instrument say the agent is slow whenever it asks a
 * good question — precisely backwards, since asking is what the task intake
 * gate requires.
 *
 * `ExitPlanMode` is here for the same reason: it blocks on an approval.
 */
export const HUMAN_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode']);

/**
 * Entries that carry a clock, in file order, with the noise dropped.
 *
 * A transcript holds bookkeeping lines — `custom-title`, `mode`,
 * `file-history-snapshot` — with no `timestamp` at all, and they are not events
 * in time. `isMeta` entries and hook attachments DO carry one, but they are
 * written by the client rather than waited on by anyone, so counting them as
 * the start of a wait would credit the model with the client's own bookkeeping.
 */
export function timedEntries(entries) {
  return entries
    .filter((e) => e && typeof e.timestamp === 'string')
    .filter((e) => e.type === 'user' || e.type === 'assistant')
    .filter((e) => !e.isMeta)
    .map((e) => ({ ...e, at: Date.parse(e.timestamp) }))
    .filter((e) => Number.isFinite(e.at));
}

/** Does this `user` entry carry tool results rather than something a person typed? */
export function isToolResult(entry) {
  const content = entry?.message?.content;
  if (!Array.isArray(content)) return false;
  return content.some((b) => b?.type === 'tool_result');
}

/** A person actually typed this one. */
export function isHumanPrompt(entry) {
  return entry?.type === 'user' && !isToolResult(entry);
}

/**
 * Every `tool_use` block in an assistant entry, as `{ id, name, input }`.
 *
 * `input` is carried because `isAnEdit` has to read a `Bash` command to know
 * whether it wrote a file. `classify` reads only `id` and `name` and is
 * unaffected.
 */
export function toolUsesIn(entry) {
  const content = entry?.message?.content;
  if (!Array.isArray(content)) return [];
  return content
    .filter((b) => b?.type === 'tool_use' && typeof b.id === 'string')
    .map((b) => ({
      id: b.id,
      name: typeof b.name === 'string' ? b.name : 'unknown',
      input: b.input ?? null,
    }));
}

/** Every `tool_use_id` a user entry answers. */
export function toolResultIdsIn(entry) {
  const content = entry?.message?.content;
  if (!Array.isArray(content)) return [];
  return content
    .filter((b) => b?.type === 'tool_result' && typeof b.tool_use_id === 'string')
    .map((b) => b.tool_use_id);
}

/**
 * Consecutive `assistant` entries sharing one `requestId`, in order.
 *
 * Grouping is by ADJACENCY, not by a map keyed on the id. A resumed session can
 * reuse an id much later in the file, and a map would then fuse two runs
 * minutes apart into one "request" whose generation time is the gap between
 * them. Adjacency cannot do that: the moment another entry intervenes, the run
 * is closed.
 */
export function requestRuns(timed) {
  const runs = [];
  let current = null;
  for (const entry of timed) {
    if (entry.type !== 'assistant') {
      current = null;
      continue;
    }
    const id = entry.requestId ?? null;
    if (current && current.requestId === id && id !== null) {
      current.blocks.push(entry);
      continue;
    }
    current = { requestId: id, blocks: [entry] };
    runs.push(current);
  }
  return runs;
}

/**
 * The usage figures a run's latency is read against.
 *
 * Taken from the LAST block. Every block of one request repeats the same usage
 * object in the entries read on 2026-09-11, but the last one is the only block
 * guaranteed to have seen the whole response, so a future harness that fills
 * usage in progressively answers correctly rather than answering early.
 */
export function usageOf(run) {
  const last = run.blocks[run.blocks.length - 1];
  const u = last?.message?.usage ?? {};
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const cacheWrite = u.cache_creation_input_tokens ?? 0;
  const input = u.input_tokens ?? 0;
  return {
    context: cacheRead + cacheWrite + input,
    output: u.output_tokens ?? 0,
    thinking: u.output_tokens_details?.thinking_tokens ?? 0,
    speed: u.speed ?? 'unknown',
    tier: u.service_tier ?? 'unknown',
    effort: last?.effort ?? 'unknown',
    model: last?.message?.model ?? 'unknown',
    at: last?.at,
  };
}

/**
 * Classify one transcript into gaps.
 *
 * Four measurements come out of this, and the distinction between the first two
 * is the point of the whole instrument:
 *
 * - `wait` — the previous entry to the FIRST block of a request. Time to first
 *   token plus queueing plus the client's own dispatch. This is the figure that
 *   should grow with context, and the one a lean session buys down.
 * - `gen`  — first to last block of the same request. Streaming the answer,
 *   thinking included.
 * - `tool` — a `tool_use` to the entry answering it. Not the model at all.
 * - `human` — the last assistant entry to the next typed prompt, and any call
 *   to a `HUMAN_TOOLS` name. **Never latency**, and returned rather than
 *   dropped so the total reconciles.
 *
 * A gap over `idleMs` is relabelled `idle` whatever it was, and the original
 * kind is kept in `was` so the report can say which measurement lost samples.
 */
export function classify(entries, { idleMs = IDLE_MS } = {}) {
  const timed = timedEntries(entries);
  const runs = requestRuns(timed);
  const index = new Map(timed.map((e, i) => [e, i]));

  /* Which tool a result answers, and when it was asked for. An unanswered
   * `tool_use` — the session was killed mid-call — leaves an entry here that
   * nothing consumes, and it is counted rather than dropped. */
  const pending = new Map();
  const gaps = [];
  let unmatchedResults = 0;

  const push = (kind, from, to, extra = {}) => {
    const ms = to - from;
    if (!Number.isFinite(ms) || ms < FLOOR_MS) return;
    gaps.push(ms > idleMs ? { kind: 'idle', was: kind, ms, ...extra } : { kind, ms, ...extra });
  };

  for (const run of runs) {
    const first = run.blocks[0];
    const i = index.get(first);
    const previous = i > 0 ? timed[i - 1] : null;
    if (previous) push('wait', previous.at, first.at, { run });
    const last = run.blocks[run.blocks.length - 1];
    if (last !== first) push('gen', first.at, last.at, { run });
  }

  for (const entry of timed) {
    if (entry.type === 'assistant') {
      for (const use of toolUsesIn(entry)) pending.set(use.id, { at: entry.at, name: use.name });
      continue;
    }
    for (const id of toolResultIdsIn(entry)) {
      const asked = pending.get(id);
      if (!asked) {
        unmatchedResults += 1;
        continue;
      }
      pending.delete(id);
      const kind = HUMAN_TOOLS.has(asked.name) ? 'human' : 'tool';
      push(kind, asked.at, entry.at, { tool: asked.name });
    }
  }

  for (let i = 1; i < timed.length; i += 1) {
    if (!isHumanPrompt(timed[i])) continue;
    if (timed[i - 1].type !== 'assistant') continue;
    push('human', timed[i - 1].at, timed[i].at);
  }

  return { gaps, runs, unansweredCalls: pending.size, unmatchedResults };
}

/**
 * Tools that change a file directly.
 *
 * The obvious half of the answer, and on its own it is the WRONG half here.
 * This repository runs in bypass mode, where the standing instruction is to
 * read and edit through `Bash` — `sed`, a heredoc, a redirect — and to fall back
 * to `Edit`/`Write` only when Bash cannot do the job. Counting these four names
 * alone therefore classifies most of this workspace's own sessions as having
 * never edited anything, which is an artefact of the instruction rather than a
 * fact about the sessions. `writesAFile` is the other half.
 */
export const EDIT_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);

/**
 * A redirect target that is not an edit to anything anybody keeps.
 *
 * Each alternative is a path this repository actually writes. `/dev/null` is a
 * discard. The scratchpad is where CLAUDE.md's own idiom for running a check
 * sends its log — `pnpm check:x 2>&1 > "$SCRATCH/x.log"` — so without this the
 * measurement would fire on the FIRST check any session ran and report an
 * opening of one call for everybody.
 *
 * The match is anchored to WHOLE path segments, which is the difference between
 * excluding `$SCRATCH/x.log` and excluding `src/templates/card.ts`. A substring
 * test discards the second, and would do it silently.
 */
const DISCARDED_TARGET = /(?:^|[\\/$"'])(?:dev[\\/]null|scratch\w*|temp|tmp)(?:[\\/]|$)/i;

/**
 * Does this `Bash` command write to a file somebody would keep?
 *
 * Deliberately narrow. Descriptor plumbing — `2>&1`, `>&2` — is stripped BEFORE
 * a redirect is looked for, or every check that redirects stderr would read as
 * an edit. What remains is content reaching a path: a redirect, an in-place
 * stream edit, `tee`, and the two patch appliers.
 *
 * It is a heuristic and it is wrong in both directions at the edges: a `>` inside
 * a quoted string reads as a redirect, and a writing command nobody here has
 * written yet reads as none. That is why the report prints how many sessions
 * were decided this way rather than folding them in silently.
 */
export function writesAFile(command) {
  if (typeof command !== 'string' || !command) return false;
  const stripped = command.replace(/\d?>&\d/g, ' ');
  for (const match of stripped.matchAll(/>>?\s*(["']?)([^\s"'|;&)]+)\1/g)) {
    if (!DISCARDED_TARGET.test(match[2])) return true;
  }
  if (/(?:^|[\s;&|(])(?:sed|perl)\s+(?:-[a-zA-Z]*\s+)*-[a-zA-Z]*i/.test(stripped)) return true;
  if (/(?:^|[\s;&|(])tee\b/.test(stripped)) return true;
  if (/(?:^|[\s;&|(])patch\b/.test(stripped)) return true;
  if (/(?:^|[\s;&|(])git\s+apply\b/.test(stripped)) return true;
  return false;
}

/** Is this `tool_use` block an edit — by either mechanism? */
export function isAnEdit(use) {
  if (EDIT_TOOLS.has(use.name)) return true;
  if (use.name !== 'Bash') return false;
  return writesAFile(use.input?.command);
}

/**
 * What one session spent before it first changed a file.
 *
 * The slowness a person feels first is not `wait` p50 — it is the stretch
 * between typing a request and seeing anything happen: the profile read, the
 * intake gate, `product-context`, the trawl through `briefs/`. Nobody had a
 * number for it, which is the whole reason this exists.
 *
 * The clock starts at the FIRST TYPED PROMPT, never at the first entry in the
 * file. Everything before it is the client's own bookkeeping and hook output,
 * and crediting the session with it would measure the CLI starting up rather
 * than the work starting.
 *
 * Three populations come back, and keeping them apart is the point:
 *
 * - `straight` — the edit landed inside the first turn. This is the opening
 *   proper, and the only population whose figures answer the question.
 * - `deferred` — an edit happened, but a person typed again first. That is a
 *   conversation, a reformulation or a rejected plan, and averaging it in would
 *   bill the agent for the time somebody spent thinking.
 * - `never` — no edit at all: a census, a review, a question answered. Counted
 *   rather than dropped, because a population excluded in silence is how a
 *   measurement ends up describing a third of what it claims to.
 *
 * `ms` is wall clock and so contains two things that are not overhead. Both come
 * back BESIDE it rather than subtracted, because which one a reader should
 * remove depends on the question: `humanMs` is time inside a `HUMAN_TOOLS` call,
 * and the intake gate is supposed to cost that; `idledMs` is whatever sat over
 * the idle threshold, which is a session left open.
 */
export function sessionOpening(entries, { idleMs = IDLE_MS } = {}) {
  const timed = timedEntries(entries);
  const tools = [];
  const waitingOnPerson = new Map();
  let start = null;
  let previousAt = null;
  let prompts = 0;
  let calls = 0;
  let humanMs = 0;
  let idledMs = 0;

  for (const entry of timed) {
    const typed = isHumanPrompt(entry);

    if (start === null) {
      if (!typed) continue;
      start = entry.at;
      previousAt = entry.at;
      prompts = 1;
      continue;
    }

    const gap = entry.at - previousAt;
    if (gap > idleMs) idledMs += gap;
    previousAt = entry.at;

    if (typed) {
      prompts += 1;
      continue;
    }

    if (entry.type === 'assistant') {
      for (const use of toolUsesIn(entry)) {
        if (isAnEdit(use)) {
          return {
            kind: prompts === 1 ? 'straight' : 'deferred',
            by: EDIT_TOOLS.has(use.name) ? 'tool' : 'bash',
            calls,
            prompts,
            tools,
            at: start,
            ms: entry.at - start,
            humanMs,
            idledMs,
          };
        }
        calls += 1;
        tools.push(use.name);
        if (HUMAN_TOOLS.has(use.name)) waitingOnPerson.set(use.id, entry.at);
      }
      continue;
    }

    for (const id of toolResultIdsIn(entry)) {
      const askedAt = waitingOnPerson.get(id);
      if (askedAt === undefined) continue;
      waitingOnPerson.delete(id);
      humanMs += entry.at - askedAt;
    }
  }

  /* No typed prompt at all is not a session with a long opening, it is a file
   * with nothing to measure. Null rather than a zero that would average in. */
  if (start === null) return null;
  return { kind: 'never', by: null, calls, prompts, tools, at: start, ms: null, humanMs, idledMs };
}

/**
 * Percentiles, nearest-rank, on a copy.
 *
 * Nearest-rank rather than interpolated so every number printed is a gap that
 * actually happened. An interpolated p90 is a duration nobody waited.
 */
export function percentiles(values, ps = [50, 90, 99]) {
  if (!values.length) return Object.fromEntries(ps.map((p) => [p, null]));
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
  return Object.fromEntries(ps.map((p) => [p, pick(p)]));
}

/**
 * Does `wait` grow with context? Spearman's rank correlation.
 *
 * Rank rather than Pearson because neither variable is normal and the question
 * is monotonic — *does a fuller session wait longer*, not *how many ms per
 * thousand tokens*. Ties take their average rank, which is what makes a column
 * of identical context sizes return 0 instead of an artefact.
 *
 * It answers `null` under 30 pairs. A correlation over a handful of points is
 * the kind of number that gets quoted for a year.
 */
export function rankCorrelation(pairs, { minimum = 30 } = {}) {
  const clean = pairs.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (clean.length < minimum) return null;
  const rank = (values) => {
    const order = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const ranks = new Array(values.length);
    for (let i = 0; i < order.length; ) {
      let j = i;
      while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j += 1;
      const shared = (i + j) / 2 + 1;
      for (let k = i; k <= j; k += 1) ranks[order[k][1]] = shared;
      i = j + 1;
    }
    return ranks;
  };
  const rx = rank(clean.map((p) => p[0]));
  const ry = rank(clean.map((p) => p[1]));
  const n = clean.length;
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  if (dx === 0 || dy === 0) return 0;
  return num / Math.sqrt(dx * dy);
}
