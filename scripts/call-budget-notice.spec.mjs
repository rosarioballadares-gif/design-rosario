/**
 * The call-budget notice, held to the two things that can go wrong with it.
 *
 * A notice that fires on every call past the threshold would be accretion - the
 * subject it warns about, committed by the warning. A notice that fires never is
 * the sentence in a document this hook exists to replace. Both are silent
 * failures, so both are pinned here rather than left to a reading of the file.
 */
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  STEP,
  THRESHOLD,
  TOKEN_STEP,
  TOKEN_THRESHOLD,
  contextFrom,
  due,
  notice,
  shouldNotice,
  storeName,
  transcriptFor,
} from './call-budget-notice.cjs';

const WORKTREE = 'C:\\product-ops-base\\.claude\\worktrees\\dashboard-page-figma';

describe('when the notice speaks', () => {
  it('says nothing before the threshold', () => {
    expect(shouldNotice(THRESHOLD - 1)).toBe(false);
    expect(shouldNotice(1)).toBe(false);
    expect(shouldNotice(0)).toBe(false);
  });

  it('speaks once at the threshold and not on the call after it', () => {
    expect(shouldNotice(THRESHOLD)).toBe(true);
    expect(shouldNotice(THRESHOLD + 1)).toBe(false);
  });

  it('speaks again a step later, and only there', () => {
    expect(shouldNotice(THRESHOLD + STEP)).toBe(true);
    expect(shouldNotice(THRESHOLD + STEP - 1)).toBe(false);
    expect(shouldNotice(THRESHOLD + STEP + 1)).toBe(false);
    expect(shouldNotice(THRESHOLD + STEP * 2)).toBe(true);
  });

  it('speaks on exactly one call in any window of STEP, which is what stops accretion', () => {
    const window = [];
    for (let n = THRESHOLD; n < THRESHOLD + STEP; n += 1) if (shouldNotice(n)) window.push(n);
    expect(window).toEqual([THRESHOLD]);
  });

  it('refuses anything that is not a whole count, because the store can be corrupt', () => {
    expect(shouldNotice(Number.NaN)).toBe(false);
    expect(shouldNotice(200.5)).toBe(false);
    expect(shouldNotice('200')).toBe(false);
    expect(shouldNotice(-200)).toBe(false);
  });
});

describe('what the notice says', () => {
  it('carries the real count, so a later notice is not read as the first', () => {
    expect(notice(200)).toContain('Call 200');
    expect(notice(400)).toContain('Call 400');
  });

  it('names the action rather than only the problem', () => {
    expect(notice(200)).toContain('/clear');
  });

  // The step it names, since 2026-10-08. From 2026-09-19 it asked for a prompt
  // written by hand, and a session that ran to 600k tokens never wrote one; one
  // command and "stop" replace it (Ian Rueff, 2026-10-08). Asserted on the
  // command and the word rather than the sentence, because the sentence is
  // edited for length and the step is the half that has to survive that.
  it('names pnpm handoff and says stop, in and out of a worktree', () => {
    for (const text of [notice(200), notice(200, null, 'calls', '', WORKTREE)]) {
      expect(text).toContain('pnpm handoff');
      expect(text).toMatch(/\bstop\b/);
    }
  });

  // Measured over the LONGEST variant, not the shortest. `notice(200)` with no
  // context reads 273 and the context lead is eleven longer, so a cap checked
  // only against the short form passes at 399 while the real line is over. That
  // hole did not matter until 2026-09-14 spent the headroom down to nine bytes.
  it('stays short, because it is re-read on every call after it lands', () => {
    expect(notice(200).length).toBeLessThan(400);
    expect(notice(400, 500_000, 'context').length).toBeLessThan(400);
    expect(notice(400, 500_000, 'context', '', WORKTREE).length).toBeLessThan(400);
  });

  // ExitWorktree moves the session to the main checkout, where `pnpm handoff`
  // would read main instead of the branch, so the order is the assertion.
  it('inside a worktree, runs pnpm handoff before ExitWorktree frees the lock', () => {
    expect(notice(200, null, 'calls', '', WORKTREE)).toMatch(/pnpm handoff.*ExitWorktree keep.*frees the lock/);
    expect(notice(200, null, 'calls', '', 'C:\\product-ops-base')).not.toMatch(/ExitWorktree|lock/);
    expect(notice(200, null, 'calls', 'a1b2', WORKTREE)).not.toMatch(/ExitWorktree|lock/);
  });
});

describe('the two budgets', () => {
  it('stays quiet below both', () => {
    expect(due(199, 190_000)).toBe(null);
  });

  it('speaks on context before the call count gets there', () => {
    // The whole point: measured 2026-09-11, 200k was crossed at call 121, so
    // counting calls alone spoke 79 calls late.
    expect(due(121, TOKEN_THRESHOLD)).toBe('context');
  });

  it('still speaks on calls when context stays small', () => {
    expect(due(THRESHOLD, 50_000)).toBe('calls');
  });

  it('speaks once per budget, then every step after it', () => {
    const spoken = { calls: 121, context: TOKEN_THRESHOLD };
    expect(due(122, TOKEN_THRESHOLD + 1, spoken)).toBe(null);
    expect(due(140, TOKEN_THRESHOLD + TOKEN_STEP, spoken)).toBe('context');
    expect(due(THRESHOLD + 21, 210_000, spoken)).toBe('calls');
  });

  it('falls back to counting calls when the context cannot be read', () => {
    // A transcript that is missing, locked or unparseable must not disable the
    // notice — it must leave it behaving the way it did before 2026-09-11.
    expect(due(THRESHOLD, null)).toBe('calls');
    expect(due(199, null)).toBe(null);
  });

  it('returns null from contextFrom rather than throwing, for a path that is not there', () => {
    expect(contextFrom('C:/nowhere/no-such-transcript.jsonl')).toBe(null);
  });

  it('names the budget that spoke, and carries both numbers', () => {
    expect(notice(121, 200_000, 'context')).toMatch(/carrying 200k tokens of context, at call 121/);
    expect(notice(200, 50_000, 'calls')).toMatch(/Call 200 of this session, carrying 50k/);
    expect(notice(200, null, 'calls')).toMatch(/context unread/);
  });
});

describe('inside a subagent', () => {
  it('keeps a store of its own, and the main session keeps the name it had', () => {
    expect(storeName('s1')).toBe('claude-call-budget-s1.json');
    expect(storeName('s1', 'a1')).toBe('claude-call-budget-s1-a1.json');
  });

  it('reads its own transcript, which sits beside the session one', () => {
    expect(transcriptFor('/p/s1.jsonl')).toBe('/p/s1.jsonl');
    expect(transcriptFor('/p/s1.jsonl', 'a1')).toBe(
      path.join('/p/s1', 'subagents', 'agent-a1.jsonl'),
    );
  });

  it('is told to finish at a clean point and return, since nobody is there to /clear', () => {
    const text = notice(200, 50_000, 'calls', 'a1');
    expect(text).toMatch(/Call 200 of this subagent, carrying 50k/);
    expect(text).toContain('clean point');
    expect(text).toContain('fresh subagent');
    expect(text).not.toContain('/clear');
  });

  // Since 2026-10-16: in checkpoints a partial worker's leftover lived only in
  // its one-line report (Ian Rueff, question UI in hubble-product-ops:
  // "Still open en el doc").
  it('in checkpoints, leaves what is left in the Still open of its stage doc', () => {
    expect(notice(200, 50_000, 'calls', 'a1')).toContain('Still open');
  });

  it('stays short on its longest variant as well', () => {
    expect(notice(400, 500_000, 'context', 'a1').length).toBeLessThan(400);
    expect(notice(400, 500_000, 'context', 'a1', WORKTREE, false).length).toBeLessThan(400);
    expect(notice(400, 500_000, 'context', 'a1', WORKTREE, true).length).toBeLessThan(400);
  });

  // Since 2026-10-24: the worker that has been at it always thinks little is
  // left, so the first notice allows only closing what it already wrote and the
  // repeat one allows nothing (Ian Rueff, in hubble-product-ops, 2026-10-24:
  // "vamos si").
  it('at its first notice, may finish only closing work it already wrote', () => {
    const text = notice(200, 50_000, 'calls', 'a1', '', false);
    expect(text).toMatch(/only closing work you already wrote: build, validate, commit/);
    expect(text).toContain('clean point');
    expect(text).toContain('fresh subagent');
    expect(text).toContain('Still open');
  });

  it('at its repeat notice, stops with no exception and offers none', () => {
    const text = notice(300, 50_000, 'calls', 'a1', '', true);
    expect(text).toMatch(/Stop now, no exception/);
    expect(text).toContain('Still open');
    expect(text).not.toMatch(/closing work|build, validate, commit|clean point/);
  });

  it('leaves the main session text as it was, repeat or not', () => {
    expect(notice(200, 50_000, 'calls', '')).toBe(notice(200, 50_000, 'calls'));
    expect(notice(300, 50_000, 'calls', '', WORKTREE, true)).toBe(
      notice(300, 50_000, 'calls', '', WORKTREE, false),
    );
  });
});
