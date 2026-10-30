/**
 * The pricing table and the arithmetic behind `pnpm cost`, kept apart from the
 * read so both halves can be argued with.
 *
 * `session-cost.mjs` is the read, the scope floor and the exit code. This file
 * is what it means, and `cost-rates.spec.mjs` is what holds it to that — because
 * a script that only ever runs over one machine's transcripts is one nobody can
 * disprove: it would report the wrong number and every run would agree.
 *
 * **The dollars are a proxy for quota, not a bill.** Nobody here pays per token;
 * work runs against a subscription. What the figure is for is comparison — one
 * session against another, one model against another, one day against the day a
 * colleague burned 39 per cent of a quota in two days and nothing could say why.
 *
 * **An unknown model id is a FINDING, never a zero.** The failure this exists to
 * prevent is the one that has already been paid for twice in this repository: a
 * measurement that resolves nothing, reports a confident number, and exits 0. A
 * model that is not in the table below contributes no cost at all, so without
 * this its calls would silently read as free and the total would be an
 * understatement wearing the costume of a measurement.
 */

/**
 * Per million tokens, in USD, from the model table in the bundled `claude-api`
 * skill (`Current Models`, cached 2026-06-24), read 2026-09-10.
 *
 * `cacheRead` and `cacheWrite` are DERIVED from `input` at the published
 * multipliers — 0.1x for a read, 1.25x for a write — except where a model states
 * its own rate, which is why they are written out rather than computed at the
 * call site. A derived number with no place to record an exception is a number
 * that will be wrong the first time one ships.
 */
export const RATES = {
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.5 },
  'claude-mythos-5-1': { input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.5 },
  'claude-fable-5': { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-opus-4-7': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-opus-4-6': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-sonnet-4-6': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

export const RATES_SOURCE =
  'Claude API list rates, read 2026-09-10 from the bundled claude-api skill. ' +
  'Cache read is 0.1x input and cache write 1.25x, except Fable 5.1 and Mythos 5.1, ' +
  'which publish a 0.25 read. Opus 5.5 read 2026-10-08 from ' +
  'platform.claude.com/docs/en/about-claude/pricing: 4 in, 20 out, 0.20 cache read, ' +
  '5 for a five-minute cache write.';

/**
 * The harness writes `<synthetic>` on entries it generated itself — an interrupt
 * notice, a tool-result envelope. They carry a usage block and cost nothing, so
 * they are priced at zero DELIBERATELY and named here, rather than falling
 * through to the unknown-model finding and making every run report a problem
 * that is not one.
 */
export const FREE_MODELS = new Set(['<synthetic>']);

/**
 * Strips the two suffixes an id arrives with: the context window the harness
 * appends — `claude-opus-5[1m]` — and the release date some families carry,
 * `claude-haiku-4-5-20251001`. **No id in `RATES` ends in eight digits**, which
 * is what makes the date strip safe; check that before adding one that does.
 *
 * The dated form went unpriced until 2026-09-11 over a rate that was in `RATES`
 * the whole time — 1.819 calls across this machine, printed as zero.
 *
 * **What this does NOT model, said out loud because a silent approximation is
 * how a measurement becomes a claim:** if a long-context window is billed at a
 * premium above some input threshold, that premium is not in `RATES` and is not
 * applied here. A run over 1M-context sessions is therefore a FLOOR on the true
 * figure, not an estimate of it.
 */
export function normalizeModel(id) {
  if (typeof id !== 'string') return null;
  const trimmed = id.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\[[^\]]*\]$/, '').replace(/-\d{8}$/, '');
}

/**
 * Whether an id is one of the zero-cost pseudo-models.
 *
 * It exists because the scope gate below MUST NOT count these. Measured
 * 2026-09-10 by breaking the rate table on purpose: with every real model
 * removed, the 41 `<synthetic>` entries were still "priced", the gate passed on
 * them, and the run printed `0.00 USD` over a month of work and exited 0 — the
 * exact silent zero the gate is for, reintroduced by the exemption above it.
 */
export function isFreeModel(id) {
  const key = normalizeModel(id);
  return key !== null && FREE_MODELS.has(key);
}

export function rateFor(id) {
  const key = normalizeModel(id);
  if (key === null) return null;
  if (FREE_MODELS.has(key)) return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  return RATES[key] ?? null;
}

/** The four token classes an API response reports, named once so nothing spells one wrong twice. */
export const TOKEN_FIELDS = [
  ['input', 'input_tokens'],
  ['output', 'output_tokens'],
  ['cacheRead', 'cache_read_input_tokens'],
  ['cacheWrite', 'cache_creation_input_tokens'],
];

/**
 * Reads the four counts off a raw `usage` object, coercing anything absent or
 * non-numeric to 0 — a transcript written by an older harness version is missing
 * fields rather than malformed, and dropping the whole call would lose real
 * spend to be tidy about a schema.
 */
export function tokensFrom(usage) {
  const out = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  if (!usage || typeof usage !== 'object') return out;
  for (const [key, wire] of TOKEN_FIELDS) {
    const value = usage[wire];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) out[key] = value;
  }
  return out;
}

/** USD for one call. Returns `null` for a model with no rate, so the caller must decide rather than add zero. */
export function costOf(tokens, modelId) {
  const rate = rateFor(modelId);
  if (!rate) return null;
  return (
    (tokens.input * rate.input +
      tokens.output * rate.output +
      tokens.cacheRead * rate.cacheRead +
      tokens.cacheWrite * rate.cacheWrite) /
    1e6
  );
}

export function emptyTotals() {
  return { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, usd: 0, unpriced: 0 };
}

export function addCall(totals, tokens, modelId) {
  totals.calls += 1;
  for (const [key] of TOKEN_FIELDS) totals[key] += tokens[key];
  const usd = costOf(tokens, modelId);
  if (usd === null) totals.unpriced += 1;
  else totals.usd += usd;
  return totals;
}

/** Context carried into one call: everything the model read, cached or not. Output is what it wrote back. */
export function contextTokens(totals) {
  return totals.input + totals.cacheRead + totals.cacheWrite;
}

export function meanContext(totals) {
  return totals.calls === 0 ? 0 : contextTokens(totals) / totals.calls;
}

/**
 * What the same token volume would have cost on another model.
 *
 * It is deliberately a straight re-pricing and NOT a prediction. A cheaper model
 * may need more turns to finish the same task, which this cannot see and which
 * would eat into the difference — so the number is the ceiling on the saving,
 * and the run says so rather than leaving the reader to assume otherwise.
 */
export function repriceAt(totals, modelId) {
  const rate = rateFor(modelId);
  if (!rate) return null;
  return (
    (totals.input * rate.input +
      totals.output * rate.output +
      totals.cacheRead * rate.cacheRead +
      totals.cacheWrite * rate.cacheWrite) /
    1e6
  );
}

/**
 * The scope gate, and it runs BEFORE any figure is printed.
 *
 * Every one of these conditions produces a total of zero dollars, and zero
 * dollars is indistinguishable from a quiet month. `check:role-list`
 * has the same gate for the same reason: two empty lists compare equal, and a
 * run that read nothing agrees with everything.
 *
 * `priced` means calls on a model with a REAL rate. Counting the zero-cost
 * pseudo-models here would let a handful of them hold the gate open over a
 * completely unpriced month — measured, see `isFreeModel`.
 */
export function scopeFailure({ files = 0, calls = 0, priced = 0 } = {}) {
  if (files === 0)
    return 'no transcript files were found. Nothing was measured, so a total here would be an artefact.';
  if (calls === 0)
    return `${files} transcript file(s) resolved but not one carried a usage block. Either the format changed or the wrong directory was read.`;
  if (priced === 0)
    return `${calls} call(s) were read and not one carried a model this table can price. The rates are stale or the model ids changed shape.`;
  return null;
}

/**
 * The text an assistant or tool-result block puts into the conversation.
 *
 * It is a rule rather than plumbing because the shape is load-bearing: a
 * tool_result's `content` is a string on some tools and a list of blocks on
 * others, and reading only the string form undercounts every MCP tool at once —
 * which is the class of tool with the largest output per call measured here.
 */
export function textLength(content) {
  if (typeof content === 'string') return content.length;
  if (!Array.isArray(content)) return 0;
  let n = 0;
  for (const block of content) {
    if (typeof block === 'string') {
      n += block.length;
      continue;
    }
    if (!block || typeof block !== 'object') continue;
    for (const key of ['text', 'content']) {
      const value = block[key];
      if (typeof value === 'string') n += value.length;
      else if (Array.isArray(value)) n += textLength(value);
    }
  }
  return n;
}

/**
 * Bytes per token, for turning a character count into a token count.
 *
 * **It is an approximation and every figure derived from it inherits that.**
 * The honest way is `messages.count_tokens`, which needs a credential this
 * machine does not have. 3.7 is the ratio for technical English; prose runs
 * lower and minified code higher, so a run over one is wrong in a known
 * direction. Anything priced off `usage` blocks — the totals, the day table,
 * the model lever — does NOT use this and is exact.
 */
export const BYTES_PER_TOKEN = 3.7;

/**
 * What one injected token costs over the rest of a session: it is re-read on
 * every later call. This is the whole reason a tool's output matters more than
 * its file size, and why the same result costs nothing at the end of a session
 * and a great deal at the start.
 */
export function carriedTokens(chars, callsAfter) {
  return (chars / BYTES_PER_TOKEN) * Math.max(0, callsAfter);
}

/** What a green run of this cannot tell you, printed every time rather than filed in a header. */
export const CANNOT_SEE = [
  'WHICH subagent a cost belongs to. Since 2026-09-11 subagent spend is read and',
  'reported, but only in total and by model — not per agent, per task, or against',
  'the main session that spawned it. So "this fan-out cost that much" is still',
  'not a question this answers.',
  '',
  'The claim this list carried until 2026-09-11 was that no entry carries an',
  'isSidechain marker. That was false and it was measured on a walk that read one',
  'directory level and stopped. Every entry in a subagent transcript carries the',
  'marker; the script was not looking where they live. A number that measures the',
  'instrument reads exactly like one that measures the work.',
];
