/**
 * Holds `snapshot-rules.mjs` to what it claims.
 *
 * The case this file exists for is the third one: a snapshot taken while a
 * session is still open reads FEWER calls than the same session read tomorrow,
 * and a merge that took the newer reading on faith would shrink a row that
 * holds real spend. Asserting that a merge runs would not catch it. Asserting
 * that a lighter row loses does.
 *
 * The second case it exists for is the one nothing else here can see: a row the
 * new reading never saw has to survive. That is the whole purpose of the store
 * — the reading can only ever see the days still on disk, and on 2026-09-12
 * that was six of twenty-three.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  daysSinceNewest,
  keyBy,
  mergeStore,
  recountStore,
  serialize,
  sortedByKey,
  weighCalls,
  weighRouting,
} from './snapshot-rules.mjs';

describe('recountStore', () => {
  /* The case it exists for: a corrected row weighs LESS than the row it
   * corrects, so `mergeStore` keeps the defect. `typedIn` counted a file an
   * agent read as somebody typing, and the inflated row is the heavier one. */
  it('replaces a row that a fresh reading made lighter', () => {
    const stored = { s1: { calls: 4, typed: { setup: 24 } } };
    const { store, replaced, added } = recountStore(stored, { s1: { calls: 4, typed: { setup: 1 } } });
    expect(store.s1.typed).toEqual({ setup: 1 });
    expect(replaced).toEqual(['s1']);
    expect(added).toEqual([]);
  });

  it('mergeStore would have kept that same defect', () => {
    const stored = { s1: { calls: 4, typed: { setup: 24 } } };
    const { store } = mergeStore(stored, { s1: { calls: 4, typed: { setup: 1 } } }, (row) =>
      Object.values(row.typed).reduce((a, b) => a + b, 0),
    );
    expect(store.s1.typed).toEqual({ setup: 24 });
  });

  it('keeps a row whose transcript has rolled off, and names it unreachable', () => {
    const stored = { gone: { calls: 7 }, here: { calls: 2 } };
    const { store, unreachable, replaced } = recountStore(stored, { here: { calls: 2 } });
    expect(store.gone).toEqual({ calls: 7 });
    expect(unreachable).toEqual(['gone']);
    expect(replaced).toEqual(['here']);
  });

  it('adds a row the store had never seen', () => {
    const { store, added, replaced } = recountStore({}, { fresh: { calls: 1 } });
    expect(store.fresh).toEqual({ calls: 1 });
    expect(added).toEqual(['fresh']);
    expect(replaced).toEqual([]);
  });
});

describe('mergeStore', () => {
  it('adds a row the store did not have', () => {
    const { store, added, updated } = mergeStore({}, { a: { calls: 3 } });
    expect(store).toEqual({ a: { calls: 3 } });
    expect(added).toEqual(['a']);
    expect(updated).toEqual([]);
  });

  it('replaces a row with a heavier one — the session kept running', () => {
    const { store, updated } = mergeStore({ a: { calls: 3, usd: 1 } }, { a: { calls: 9, usd: 4 } });
    expect(store.a).toEqual({ calls: 9, usd: 4 });
    expect(updated).toEqual(['a']);
  });

  it('REFUSES a lighter row — a snapshot taken mid-session must not shrink one', () => {
    const { store, added, updated } = mergeStore({ a: { calls: 9, usd: 4 } }, { a: { calls: 3, usd: 1 } });
    expect(store.a).toEqual({ calls: 9, usd: 4 });
    expect(added).toEqual([]);
    expect(updated).toEqual([]);
  });

  it('keeps the existing row on a tie, so an unchanged day writes no diff', () => {
    const existing = { a: { calls: 9, note: 'first reading' } };
    const { store, updated } = mergeStore(existing, { a: { calls: 9, note: 'second reading' } });
    expect(store.a.note).toBe('first reading');
    expect(updated).toEqual([]);
  });

  it('keeps a row the new reading never saw — the day fell out of the window', () => {
    const { store, kept } = mergeStore({ old: { calls: 100 } }, { fresh: { calls: 1 } });
    expect(Object.keys(store).sort()).toEqual(['fresh', 'old']);
    expect(store.old.calls).toBe(100);
    expect(kept).toBe(2);
  });

  it('is idempotent: merging the same reading twice changes nothing the second time', () => {
    const incoming = { a: { calls: 4 }, b: { calls: 7 } };
    const once = mergeStore({ z: { calls: 1 } }, incoming);
    const twice = mergeStore(once.store, incoming);
    expect(twice.store).toEqual(once.store);
    expect(twice.added).toEqual([]);
    expect(twice.updated).toEqual([]);
  });

  it('sorts keys, so a diff shows what changed and never what moved', () => {
    const { store } = mergeStore({ c: { calls: 1 } }, { a: { calls: 1 }, b: { calls: 1 } });
    expect(Object.keys(store)).toEqual(['a', 'b', 'c']);
  });

  it('treats a missing or malformed store as empty rather than throwing', () => {
    expect(mergeStore(null, { a: { calls: 1 } }).store).toEqual({ a: { calls: 1 } });
    expect(mergeStore({ a: { calls: 1 } }, null).store).toEqual({ a: { calls: 1 } });
    expect(mergeStore({ a: { calls: 1 } }, undefined).added).toEqual([]);
  });

  it('weighs a row with no calls as 0 instead of dropping it', () => {
    expect(weighCalls({})).toBe(0);
    expect(weighCalls({ calls: 'many' })).toBe(0);
    expect(weighCalls(null)).toBe(0);
    const { store } = mergeStore({ a: { calls: 5 } }, { a: {} });
    expect(store.a.calls).toBe(5);
  });
});

describe('weighRouting', () => {
  it('counts invocations and typed commands together', () => {
    expect(weighRouting({ invoked: { 'diff-review': { count: 2 } }, typed: { setup: 3 } })).toBe(5);
  });

  it('weighs a silent session as 0, which is a measurement and not an absence', () => {
    expect(weighRouting({ invoked: {}, typed: {} })).toBe(0);
    const { store, updated } = mergeStore(
      { s: { day: '2026-09-01', invoked: {}, typed: {} } },
      { s: { day: '2026-09-01', invoked: {}, typed: {} } },
      weighRouting,
    );
    expect(updated).toEqual([]);
    expect(store.s.day).toBe('2026-09-01');
  });

  it('lets a session that invoked more replace one that invoked less', () => {
    const { store } = mergeStore(
      { s: { invoked: { a: { count: 1 } }, typed: {} } },
      { s: { invoked: { a: { count: 1 }, b: { count: 2 } }, typed: {} } },
      weighRouting,
    );
    expect(Object.keys(store.s.invoked).sort()).toEqual(['a', 'b']);
  });
});

describe('keyBy', () => {
  it('lifts the key out of the row so it is not stored twice', () => {
    expect(keyBy([{ id: 'a', calls: 1 }], 'id')).toEqual({ a: { calls: 1 } });
  });

  it('drops a row with no usable key rather than inventing one', () => {
    expect(keyBy([{ calls: 1 }, { id: '', calls: 2 }, { id: 7, calls: 3 }], 'id')).toEqual({});
    expect(keyBy(null, 'id')).toEqual({});
  });
});

describe('daysSinceNewest', () => {
  it('measures from the newest dated row', () => {
    expect(daysSinceNewest(['2026-09-01', '2026-09-10', '2026-09-04'], '2026-09-12')).toBe(2);
  });

  it('is 0 on the day of the newest row', () => {
    expect(daysSinceNewest(['2026-09-12'], '2026-09-12')).toBe(0);
  });

  it('returns null for an empty store, which is not the same as a stale one', () => {
    expect(daysSinceNewest([], '2026-09-12')).toBe(null);
    expect(daysSinceNewest(['not-a-day'], '2026-09-12')).toBe(null);
    expect(daysSinceNewest(null, '2026-09-12')).toBe(null);
  });
});

describe('serialize and sortedByKey', () => {
  it('writes two-space JSON with a closing newline', () => {
    expect(serialize({ b: 1, a: 2 })).toBe('{\n  "b": 1,\n  "a": 2\n}\n');
  });

  it('sorts without mutating its argument', () => {
    const input = { b: 1, a: 2 };
    expect(Object.keys(sortedByKey(input))).toEqual(['a', 'b']);
    expect(Object.keys(input)).toEqual(['b', 'a']);
  });
});

/**
 * The one rule about `--recount` that cannot live in `snapshot-rules.mjs`: which
 * stores it is WIRED to. `recountStore` takes whatever it is handed, so the
 * decision is in `snapshot.mjs` and nowhere else, and the tests above would all
 * stay green the day somebody points it at a cost store.
 *
 * Why that day would be a defect rather than a correction: a recount lets a
 * LIGHTER reading win. For routing that is the point — an inflated row counted
 * a file an agent read as somebody typing. For cost it is the opposite, because
 * a lighter cost row means the transcript rolled off disk. The reading did not
 * find less spend; it found less evidence, and the store is the only copy.
 *
 * These read the source rather than run it, which is the whole reason they can
 * see a wiring change at all.
 */
describe('--recount is wired to routing and to nothing else', () => {
  const source = readFileSync(new URL('./snapshot.mjs', import.meta.url), 'utf8');
  const COST_STORES = ['cost-sessions.json', 'cost-days.json', 'cost-agents.json'];

  it('guards its every branch on the routing store, by name', () => {
    const guards = [...source.matchAll(/recount\s*&&\s*([^)]*)\)/g)].map((m) => m[1].trim());
    expect(guards).toEqual(["name === 'routing-sessions.json'"]);
  });

  it('calls recountStore exactly once', () => {
    expect(source.match(/\brecountStore\(/g)).toHaveLength(1);
  });

  it('names no cost store inside the recount branch', () => {
    const start = source.indexOf('if (recount');
    expect(start).toBeGreaterThan(-1);
    const branch = source.slice(start, source.indexOf('\n  }', start));
    for (const store of COST_STORES) expect(branch).not.toContain(store);
  });

  it('mentions each cost store exactly once, which is the additive list', () => {
    for (const store of COST_STORES) {
      expect(source.split(store)).toHaveLength(2);
    }
  });
});
