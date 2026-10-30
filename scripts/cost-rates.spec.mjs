/**
 * Holds `cost-rates.mjs` to what it claims.
 *
 * A cost script that only ever runs over one machine's transcripts cannot be
 * disproved by running it: it would report the wrong number and every run would
 * agree. So the arithmetic is checked against figures worked by hand here, and
 * the two behaviours that stop a silent zero — the unknown-model finding and the
 * scope gate — are checked by asserting they FIRE, not by asserting a green run.
 */
import { describe, expect, it } from 'vitest';
import {
  CANNOT_SEE,
  FREE_MODELS,
  RATES,
  RATES_SOURCE,
  addCall,
  contextTokens,
  costOf,
  emptyTotals,
  isFreeModel,
  meanContext,
  normalizeModel,
  rateFor,
  repriceAt,
  scopeFailure,
  tokensFrom,
} from './cost-rates.mjs';

const usage = (over = {}) => ({
  input_tokens: 0,
  output_tokens: 0,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
  ...over,
});

describe('the rate table', () => {
  it('prices every model this workspace has actually run', () => {
    // Measured 2026-09-10 across the 82 transcripts: one real model id, plus the
    // harness pseudo-model. If a session ever runs on something else, the runner
    // reports it as unpriced rather than as free — see the finding test below.
    expect(rateFor('claude-opus-5')).toEqual({
      input: 5,
      output: 25,
      cacheRead: 0.5,
      cacheWrite: 6.25,
    });
    expect(rateFor('<synthetic>')).toEqual({
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    });
  });

  it('keeps cache read at a tenth of input and cache write at 1.25x, or says why not', () => {
    for (const [id, rate] of Object.entries(RATES)) {
      const publishesItsOwnRead = id.startsWith('claude-fable-5-1') || id.startsWith('claude-mythos') || id === 'claude-opus-5-5';
      if (!publishesItsOwnRead) {
        expect(rate.cacheRead, `${id} cache read`).toBeCloseTo(rate.input * 0.1, 10);
      }
      expect(rate.cacheWrite, `${id} cache write`).toBeCloseTo(rate.input * 1.25, 10);
    }
  });

  it('states where the numbers came from and when', () => {
    // A rate table with no provenance is the exact artefact this repo has a
    // whole skill about: a number nobody can date is a number nobody can refute.
    expect(RATES_SOURCE).toMatch(/2026-09-10/);
    expect(RATES_SOURCE).toMatch(/claude-api/);
  });

  it('prices Sonnet 5 at 2 and 10, which is the whole reason the comparison exists', () => {
    expect(RATES['claude-sonnet-5']).toEqual({
      input: 2,
      output: 10,
      cacheRead: 0.2,
      cacheWrite: 2.5,
    });
  });
});

describe('normalizeModel', () => {
  it('strips the context-window suffix the harness appends', () => {
    // The session prompt names the exact id as `claude-opus-5[1m]` while the
    // transcript writes `claude-opus-5`. Without this, half the calls of a
    // future harness version would price at nothing.
    expect(normalizeModel('claude-opus-5[1m]')).toBe('claude-opus-5');
    expect(normalizeModel('claude-opus-5')).toBe('claude-opus-5');
  });

  it('strips the release date a model family carries in its id', () => {
    // The rate was never missing; the lookup did not reach it, and 1.819 calls
    // across this machine priced at zero until 2026-09-11.
    expect(normalizeModel('claude-haiku-4-5-20251001')).toBe('claude-haiku-4-5');
    expect(rateFor('claude-haiku-4-5-20251001')).not.toBeNull();
    expect(normalizeModel('claude-haiku-4-5-20251001[1m]')).toBe('claude-haiku-4-5');
  });

  it('leaves a version number that is not a date alone', () => {
    // `-4-6` is a version. Eight digits is the anchor that keeps them apart.
    expect(normalizeModel('claude-sonnet-4-6')).toBe('claude-sonnet-4-6');
    expect(rateFor('claude-sonnet-4-6')).not.toBeNull();
  });

  it('returns null for anything that is not a usable id', () => {
    expect(normalizeModel(undefined)).toBeNull();
    expect(normalizeModel('')).toBeNull();
    expect(normalizeModel('   ')).toBeNull();
    expect(normalizeModel(42)).toBeNull();
  });

  it('leaves the free pseudo-model recognisable', () => {
    expect(FREE_MODELS.has(normalizeModel('<synthetic>'))).toBe(true);
  });
});

describe('tokensFrom', () => {
  it('reads the four counts', () => {
    expect(
      tokensFrom(
        usage({
          input_tokens: 11,
          output_tokens: 22,
          cache_read_input_tokens: 33,
          cache_creation_input_tokens: 44,
        }),
      ),
    ).toEqual({ input: 11, output: 22, cacheRead: 33, cacheWrite: 44 });
  });

  it('treats a missing field as zero rather than dropping the call', () => {
    // An older transcript is incomplete, not malformed. Discarding the whole
    // call to be strict about a schema loses real spend.
    expect(tokensFrom({ output_tokens: 7 })).toEqual({
      input: 0,
      output: 7,
      cacheRead: 0,
      cacheWrite: 0,
    });
    expect(tokensFrom(null)).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
    expect(tokensFrom({ input_tokens: 'lots' })).toEqual({
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    });
  });
});

describe('costOf', () => {
  it('works one call by hand', () => {
    // 1M cache read at 0.50 + 1M output at 25.00 = 25.50 on Opus 5.
    const tokens = tokensFrom(usage({ cache_read_input_tokens: 1e6, output_tokens: 1e6 }));
    expect(costOf(tokens, 'claude-opus-5')).toBeCloseTo(25.5, 6);
  });

  it('returns null for a model it cannot price, and NEVER zero', () => {
    // This is the whole safety property. A model absent from the table that
    // priced at 0 would make its calls read as free, and the total would be an
    // understatement that looks exactly like a measurement.
    const tokens = tokensFrom(usage({ output_tokens: 1e6 }));
    expect(costOf(tokens, 'claude-something-6')).toBeNull();
    expect(costOf(tokens, undefined)).toBeNull();
  });
});

describe('accumulation', () => {
  it('adds priced calls and counts unpriced ones separately', () => {
    const totals = emptyTotals();
    addCall(totals, tokensFrom(usage({ output_tokens: 1e6 })), 'claude-opus-5');
    addCall(totals, tokensFrom(usage({ output_tokens: 1e6 })), 'claude-from-the-future');
    expect(totals.calls).toBe(2);
    expect(totals.output).toBe(2e6);
    expect(totals.usd).toBeCloseTo(25, 6);
    expect(totals.unpriced).toBe(1);
  });

  it('counts context as everything read and not what was written', () => {
    const totals = emptyTotals();
    addCall(
      totals,
      tokensFrom(
        usage({
          input_tokens: 1,
          cache_read_input_tokens: 10,
          cache_creation_input_tokens: 100,
          output_tokens: 1000,
        }),
      ),
      'claude-opus-5',
    );
    expect(contextTokens(totals)).toBe(111);
    expect(meanContext(totals)).toBe(111);
  });

  it('reports a mean of zero rather than dividing by no calls', () => {
    expect(meanContext(emptyTotals())).toBe(0);
  });
});

describe('repriceAt', () => {
  it('is exactly 2.5x cheaper from Opus 5 to Sonnet 5, on every token class', () => {
    // The 60 per cent figure in the 2026-09-10 brief is this ratio and nothing
    // else. If a published rate moves, this test is what says so.
    const totals = emptyTotals();
    addCall(
      totals,
      tokensFrom(
        usage({
          input_tokens: 1e6,
          output_tokens: 1e6,
          cache_read_input_tokens: 1e6,
          cache_creation_input_tokens: 1e6,
        }),
      ),
      'claude-opus-5',
    );
    const opus = repriceAt(totals, 'claude-opus-5');
    const sonnet = repriceAt(totals, 'claude-sonnet-5');
    expect(opus / sonnet).toBeCloseTo(2.5, 10);
  });

  it('returns null rather than a number for a model it cannot price', () => {
    expect(repriceAt(emptyTotals(), 'claude-not-a-model')).toBeNull();
  });
});

describe('the scope gate', () => {
  it('fires when nothing was read, so a total of zero can never print', () => {
    expect(scopeFailure({ files: 0, calls: 0, priced: 0 })).toMatch(/no transcript files/);
  });

  it('fires when files resolved but carried no usage block', () => {
    expect(scopeFailure({ files: 12, calls: 0, priced: 0 })).toMatch(/not one carried a usage block/);
  });

  it('fires when calls were read but no model could be priced', () => {
    // The stale-rates case: the ids changed shape, every call is unpriced, and
    // the run would otherwise print 0.00 USD over a busy month.
    expect(scopeFailure({ files: 12, calls: 900, priced: 0 })).toMatch(/model this table can price/);
  });

  it('passes when all three resolved', () => {
    expect(scopeFailure({ files: 12, calls: 900, priced: 900 })).toBeNull();
  });

  it('fires on an empty argument, because a caller that forgot to pass scope has measured nothing', () => {
    expect(scopeFailure()).not.toBeNull();
  });

  it('is not held open by the zero-cost pseudo-models', () => {
    // MEASURED 2026-09-10 by breaking the rate table on purpose: every real
    // model removed, and the run printed `0.00 USD` over a month of work and
    // exited 0, because the 41 `<synthetic>` entries counted as priced and the
    // gate passed on them. `isFreeModel` is what the runner uses to keep them
    // out of the count, and this is the assertion that says so.
    expect(isFreeModel('<synthetic>')).toBe(true);
    expect(isFreeModel('claude-opus-5')).toBe(false);
    expect(isFreeModel(undefined)).toBe(false);
    // The runner counts free calls separately, so a month with nothing but them
    // reaches the gate with priced = 0 and fails.
    expect(scopeFailure({ files: 82, calls: 54_346, priced: 0 })).toMatch(/model this table can price/);
  });
});

describe('what it cannot see', () => {
  /* This test used to assert that the list names subagent spend as invisible,
     dated 2026-09-10, with every total a floor. That premise stopped holding on
     2026-09-11, when the walk started reading nested transcripts — so the
     repair was to change the rule, and this test moved with it. What it pins
     now is the narrower absence that remains. */
  it('names the absence that is left, not the one that was repaired', () => {
    const text = CANNOT_SEE.join(' ');
    expect(text).toMatch(/2026-09-11/);
    expect(text).toMatch(/per agent/);
    expect(text).not.toMatch(/NOT in any/);
  });

  it('keeps the correction visible rather than quietly deleting the old claim', () => {
    /* A list of blind spots that silently drops one teaches nobody why it was
       there. The false claim and its cause stay, dated. */
    expect(CANNOT_SEE.join(' ')).toMatch(/one directory level/);
  });
});
