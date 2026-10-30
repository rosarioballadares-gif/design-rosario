/**
 * Holds `prefix-window.mjs` to the reason it exists.
 *
 * The comparator cannot be checked by running the real report: over this
 * machine's transcripts it would produce one number, and that number would agree
 * with itself whatever the rule. So the case that produced the rule is
 * reconstructed here as data — a prefix that GREW over time, then fell — and the
 * assertion is that the recent-window comparison and the all-time comparison
 * disagree in SIGN. That disagreement is the whole finding; a test that only
 * checked the arithmetic would pass over a function that compared against the
 * all-time median and told the opposite story.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WINDOW,
  MIN_SESSIONS_PER_WINDOW,
  SPREAD_LIMIT,
  median,
  prefixWindows,
  rangeOf,
  usableSessions,
  windowRows,
} from './prefix-window.mjs';

const DAY = 86_400_000;
const t = (n) => Date.parse('2026-08-01T00:00:00Z') + n * DAY;

/** Sessions whose first-call context climbs, then drops — the measured shape. */
const climbingThenFalling = () => {
  const small = Array.from({ length: 10 }, (_, i) => ({ start: t(i), firstContext: 40_000 }));
  const grown = Array.from({ length: 8 }, (_, i) => ({ start: t(10 + i), firstContext: 85_000 }));
  const cut = Array.from({ length: 8 }, (_, i) => ({ start: t(18 + i), firstContext: 66_000 }));
  return [...small, ...grown, ...cut];
};

describe('median', () => {
  it('returns null for nothing rather than 0', () => {
    // A median of 0 over an empty set is the silent-zero failure this repo keeps
    // finding: it prints like a measurement and was computed from no data.
    expect(median([])).toBeNull();
  });

  it('averages the middle pair on an even count', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe('usableSessions', () => {
  it('drops a session with no first call instead of scoring it 0', () => {
    const out = usableSessions([
      { start: t(1), firstContext: 50_000 },
      { start: t(2), firstContext: null },
      { start: t(3), firstContext: 0 },
      { start: null, firstContext: 70_000 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].firstContext).toBe(50_000);
  });

  it('sorts by start, so a directory listing order cannot decide the windows', () => {
    const out = usableSessions([
      { start: t(3), firstContext: 3 },
      { start: t(1), firstContext: 1 },
      { start: t(2), firstContext: 2 },
    ]);
    expect(out.map((s) => s.firstContext)).toEqual([1, 2, 3]);
  });
});

describe('prefixWindows', () => {
  it('refuses to answer rather than compute a median over too few sessions', () => {
    const result = prefixWindows(
      Array.from({ length: MIN_SESSIONS_PER_WINDOW * 2 - 1 }, (_, i) => ({
        start: t(i),
        firstContext: 50_000,
      })),
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/two windows need at least/);
  });

  it('compares the recent window against the one before it, not against all time', () => {
    const result = prefixWindows(climbingThenFalling(), DEFAULT_WINDOW);
    expect(result.ok).toBe(true);
    expect(result.recentMedian).toBe(66_000);
    expect(result.priorMedian).toBe(85_000);
    expect(result.delta).toBe(-19_000);
    expect(result.pct).toBeCloseTo(-22.35, 1);
  });

  it('reports that the all-time median would have told the opposite story', () => {
    // This is the finding the module is for. The all-time median here is 66.000
    // — the recent window matches it exactly or sits above it — while the real
    // comparison is a 19.000-token fall. Without this flag the report would be
    // arithmetically right and read as "no change".
    const result = prefixWindows(climbingThenFalling(), DEFAULT_WINDOW);
    expect(result.delta).toBeLessThan(0);
    expect(result.recentMedian - result.allTimeMedian).toBeGreaterThanOrEqual(0);
    expect(result.allTimeWouldMislead).toBe(true);
  });

  it('calls a window unsettled when it straddles the change it is measuring', () => {
    // The measured case: one session after a prefix cut, inside a window of
    // eight. The median lands among the sessions that PRECEDE the cut and reads
    // as "no change" — the failure that looks most like a result.
    const straddling = [
      ...Array.from({ length: 15 }, (_, i) => ({ start: t(i), firstContext: 85_000 })),
      { start: t(15), firstContext: 66_000 },
    ];
    const result = prefixWindows(straddling, 8);
    expect(result.ok).toBe(true);
    expect(result.recentMedian).toBe(85_000); // the one cut session is averaged away
    expect(result.recentSpread).toBeGreaterThan(SPREAD_LIMIT);
    expect(result.windowUnsettled).toBe(true);
  });

  it('leaves a settled window unflagged, so the warning keeps meaning something', () => {
    const result = prefixWindows(climbingThenFalling(), DEFAULT_WINDOW);
    expect(result.recentSpread).toBe(0);
    expect(result.windowUnsettled).toBe(false);
  });

  it('shrinks both windows to fit rather than overlapping them', () => {
    // An overlapping split puts the same session on both sides, which damps
    // every delta toward zero and can only ever understate a real change.
    const sessions = Array.from({ length: 9 }, (_, i) => ({
      start: t(i),
      firstContext: i < 4 ? 90_000 : 60_000,
    }));
    const result = prefixWindows(sessions, 8);
    expect(result.ok).toBe(true);
    expect(result.window).toBe(4);
    expect(result.recent).toHaveLength(4);
    expect(result.prior).toHaveLength(4);
    const overlap = result.recent.filter((s) => result.prior.includes(s));
    expect(overlap).toHaveLength(0);
  });
});

describe('rangeOf', () => {
  it('names the dates, because an unnamed comparator is the defect', () => {
    expect(rangeOf([{ start: t(0) }, { start: t(2) }])).toBe('2026-08-01 → 2026-08-03');
  });

  it('says so when a window is empty instead of printing a bare arrow', () => {
    expect(rangeOf([])).toBe('(empty)');
  });
});

describe('windowRows', () => {
  /** Two windows of three, with the step between them that the median hides. */
  const stepped = () =>
    prefixWindows(
      [
        ...Array.from({ length: 3 }, (_, i) => ({
          start: t(i),
          firstContext: 85_000,
          file: `old${i}-abcdefgh.jsonl`,
          totals: { calls: 100 + i },
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          start: t(3 + i),
          firstContext: 66_000,
          file: `new${i}-abcdefgh.jsonl`,
          totals: { calls: 200 + i },
        })),
      ],
      3,
    );

  it('returns one row per session in both windows', () => {
    expect(windowRows(stepped())).toHaveLength(6);
  });

  it('labels which window each row belongs to', () => {
    const rows = windowRows(stepped());
    expect(rows.slice(0, 3).every((row) => row.startsWith('prior'))).toBe(true);
    expect(rows.slice(3).every((row) => row.startsWith('recent'))).toBe(true);
  });

  it('shows the step the median cannot, as the values themselves', () => {
    const rows = windowRows(stepped());
    expect(rows[0]).toContain('85000');
    expect(rows[5]).toContain('66000');
  });

  it('carries the session id and the call count, so a row can be found again', () => {
    const rows = windowRows(stepped());
    expect(rows[0]).toContain('old0-abc');
    expect(rows[0]).toContain('100');
  });

  it('formats numbers with whatever the caller uses, so the module has no opinion', () => {
    const rows = windowRows(stepped(), (n) => `<${n}>`);
    expect(rows[0]).toContain('<85000>');
  });

  it('returns nothing when the windows could not be filled, rather than throwing', () => {
    expect(windowRows({ ok: false, reason: 'not enough sessions' })).toEqual([]);
  });
});
