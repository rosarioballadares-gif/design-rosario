/**
 * The comparator for `pnpm cost --prefix`.
 *
 * **It exists because the obvious comparator is the wrong one, and it is wrong
 * in the direction that hides a real result.** Measured 2026-09-10 over 83
 * transcripts: the first-call context of the 82 sessions preceding a prefix cut
 * had an all-time median of 64.020 tokens, while the eight most recent of them
 * sat between 84.256 and 87.456. The prefix had been GROWING. So a session
 * measured at 65.883 after the cut reads as a 2,9 per cent regression against
 * the all-time median and a 22,9 per cent improvement against the sessions it
 * actually followed — same data, opposite conclusion, and the all-time figure is
 * the one a reasonable person reaches for first.
 *
 * So the rule here is mechanical: **compare a window against the window before
 * it, and print both date ranges.** A comparison whose comparator is unnamed is
 * the defect, not the number.
 *
 * The other half is refusing to answer. Two windows need enough sessions to
 * fill them; with fewer, this returns a stated reason rather than a median over
 * three transcripts, because a confident figure computed from nothing is worse
 * than no figure — it is the same failure as a baseline of zero that can never
 * fail.
 */

/** Sessions per window. Eight is two working days here, which is short enough to
 * sit inside one change and long enough that a single outlier does not carry it. */
export const DEFAULT_WINDOW = 8;

/** The smallest number of sessions that can fill two windows and mean anything. */
export const MIN_SESSIONS_PER_WINDOW = 3;

/**
 * How far a window's own values may disagree before the window is suspect.
 *
 * **A window that straddles the change averages the change away, and the median
 * it prints looks exactly like a settled one.** Measured 2026-09-10 with a
 * single session after a prefix cut: window 1 reported −24,7 per cent, window 2
 * −11,4, window 4 +1,9. Same data, three conclusions, and the default window is
 * the one that says the cut did nothing. No choice of width fixes that — only
 * more sessions do — so the report says the window is unsettled rather than
 * picking a width that flatters.
 */
export const SPREAD_LIMIT = 0.15;

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * A session counts only if it has BOTH a start and a first-call context.
 *
 * Dropping the rest is not tidiness. A transcript with no usage entry yields no
 * first call, and treating that as 0 would drag a median toward zero while
 * reporting the same shape as a real measurement.
 */
export function usableSessions(sessions) {
  return sessions
    .filter(
      (s) =>
        typeof s.start === 'number' &&
        Number.isFinite(s.start) &&
        typeof s.firstContext === 'number' &&
        Number.isFinite(s.firstContext) &&
        s.firstContext > 0,
    )
    .sort((a, b) => a.start - b.start);
}

/**
 * Split the sessions into the most recent window and the one before it.
 *
 * Returns `{ ok: false, reason }` when the windows cannot be filled.
 */
export function prefixWindows(sessions, window = DEFAULT_WINDOW) {
  const usable = usableSessions(sessions);
  const size = Math.max(1, Math.floor(window));

  if (usable.length < MIN_SESSIONS_PER_WINDOW * 2) {
    return {
      ok: false,
      reason:
        `${usable.length} session(s) carry a first-call context; ` +
        `two windows need at least ${MIN_SESSIONS_PER_WINDOW * 2}.`,
      usable: usable.length,
    };
  }

  /* Windows shrink to fit rather than overlapping. An overlapping split would
   * put the same session on both sides and quietly damp every delta toward zero. */
  const per = Math.min(size, Math.floor(usable.length / 2));
  const recent = usable.slice(-per);
  const prior = usable.slice(-per * 2, -per);

  const recentMedian = median(recent.map((s) => s.firstContext));
  const priorMedian = median(prior.map((s) => s.firstContext));
  const allTimeMedian = median(usable.map((s) => s.firstContext));

  const delta = recentMedian - priorMedian;
  const pct = priorMedian === 0 ? null : (delta / priorMedian) * 100;
  const allTimeDelta = recentMedian - allTimeMedian;

  const spreadOf = (w) => {
    const values = w.map((s) => s.firstContext);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    return lo === 0 ? null : (hi - lo) / lo;
  };
  const recentSpread = spreadOf(recent);

  return {
    ok: true,
    window: per,
    recent,
    prior,
    recentMedian,
    priorMedian,
    allTimeMedian,
    delta,
    pct,
    recentSpread,
    /* See SPREAD_LIMIT. */
    windowUnsettled: recentSpread !== null && recentSpread > SPREAD_LIMIT,
    /* True when the all-time median would have told the opposite story. This is
     * the condition that produced the rule, so the report says it out loud
     * rather than leaving the reader to notice. */
    allTimeWouldMislead:
      allTimeMedian !== null && Math.sign(delta) !== Math.sign(allTimeDelta) && delta !== 0,
    usable: usable.length,
  };
}

/**
 * One row per session in both windows, oldest first, prior then recent.
 *
 * **It formats rows and draws no conclusion, which is the point.** A median
 * cannot distinguish a window straddling a step from a window whose sessions
 * genuinely disagree, and those two call for opposite responses — wait for more
 * sessions, or go and find what moved. Measured 2026-09-10: the report said
 * UNSETTLED at 39 per cent spread while its own sessions held a clean step, 12
 * at 81.887-87.456 against 4 at 62.796-66.707 with nothing in between. Reading
 * that took a script written from scratch outside this repository.
 *
 * `formatNumber` is passed in rather than imported so this module keeps no
 * opinion about thousands separators, and so the rows can be asserted against
 * plain digits in a spec.
 */
export function windowRows(windows, formatNumber = String) {
  if (!windows.ok) return [];
  const row = (label, session) => {
    const when = new Date(session.start).toISOString().replace('T', ' ').slice(0, 16);
    const id = String(session.file ?? '').slice(0, 8);
    const first = formatNumber(session.firstContext).padStart(10);
    const calls = formatNumber(session.totals?.calls ?? 0).padStart(6);
    return `${label.padEnd(8)} ${when}  ${id}  ${first}  ${calls}`;
  };
  return [
    ...windows.prior.map((session) => row('prior', session)),
    ...windows.recent.map((session) => row('recent', session)),
  ];
}

/** `2026-09-08 → 2026-09-10` for a window, so the comparator is never unnamed. */
export function rangeOf(window) {
  if (!window.length) return '(empty)';
  const iso = (s) => new Date(s.start).toISOString().slice(0, 10);
  return `${iso(window[0])} → ${iso(window[window.length - 1])}`;
}
