/**
 * Holds `subagent-shape-rules.mjs` to what the report built on it claims.
 *
 * The report's headline is a SHARE — census-shaped work was 7,4 per cent of
 * subagent spend — and a share is only as readable as the boundary that drew
 * it. So what is asserted here is the boundary, not the arithmetic: that
 * `decision` beats `census` when a prompt carries both, that the census words
 * are the ones the ladder actually names, and that the opening prompt is the
 * brief a subagent was handed rather than the first thing it said back.
 *
 * Running these over the real transcripts could assert none of it. It would
 * agree with whatever the rule did, which is the failure `transcript-walk.mjs`
 * was written to close.
 */
import { describe, expect, it } from 'vitest';

import { SHAPE_KEYS, SHAPES, openingPrompt, shapeOf } from './subagent-shape-rules.mjs';

describe('shapeOf', () => {
  it('sends plain counting work to census', () => {
    expect(shapeOf('Count every file under src/ and report the total')).toBe('census');
    expect(shapeOf('grep the repo for every use of the Card component')).toBe('census');
    expect(shapeOf('Take a screenshot of the dashboard route')).toBe('census');
  });

  it('gives a prompt that BOTH counts and decides to decision, not census', () => {
    // This is the whole reason the order exists. A census that ends in a
    // judgement is not the row the ladder sends to the cheap model.
    expect(shapeOf('Count every file and decide which ones to keep')).toBe('decision');
    expect(shapeOf('Enumerate the components and recommend which to retire')).toBe('decision');
  });

  it('keeps census a FLOOR and never a ceiling', () => {
    // Stated so the number is read correctly: a prompt carrying both words is
    // never counted as a census, so the reported share understates rather than
    // overstates. Measured 2026-09-11: 7 of 976 decision prompts say "count".
    const both = 'Count the rows, then judge which are stale';
    expect(shapeOf(both)).toBe('decision');
    expect(SHAPES.findIndex((s) => s.key === 'decision')).toBeLessThan(
      SHAPES.findIndex((s) => s.key === 'census'),
    );
  });

  it('returns unclassified rather than guessing', () => {
    expect(shapeOf('')).toBe('unclassified');
    expect(shapeOf('Hola, todo bien por acá')).toBe('unclassified');
  });

  it('only ever returns a key the report has a row for', () => {
    const samples = ['count the files', 'decide the winner', 'write the module', 'read the log', 'zzz'];
    for (const s of samples) expect(SHAPE_KEYS).toContain(shapeOf(s));
  });
});

describe('openingPrompt', () => {
  it('takes the first user entry, as a bare string', () => {
    const entries = [
      { type: 'system' },
      { type: 'user', message: { content: 'Census the chart directory' } },
      { type: 'assistant', message: { content: 'ok' } },
    ];
    expect(openingPrompt(entries)).toBe('Census the chart directory');
  });

  it('takes the text blocks when the content is an array', () => {
    const entries = [
      { type: 'user', message: { content: [{ type: 'text', text: 'Count' }, { type: 'text', text: 'the rows' }] } },
    ];
    expect(openingPrompt(entries)).toBe('Count the rows');
  });

  it('skips a tool result, which is output and not a brief', () => {
    // Without this the classifier reads the agent's own findings as its
    // instructions, and every long agent looks like whatever it happened to
    // find first.
    const entries = [
      { type: 'user', message: { content: [{ type: 'tool_result', content: 'decide this' }] } },
      { type: 'user', message: { content: 'Grep for the token' } },
    ];
    expect(openingPrompt(entries)).toBe('Grep for the token');
  });

  it('skips an entry that mixes a tool result with text', () => {
    const entries = [
      {
        type: 'user',
        message: { content: [{ type: 'tool_result', content: 'x' }, { type: 'text', text: 'judge it' }] },
      },
      { type: 'user', message: { content: 'List every icon' } },
    ];
    expect(openingPrompt(entries)).toBe('List every icon');
  });

  it('returns empty rather than inventing one, so the runner can report the hole', () => {
    expect(openingPrompt([])).toBe('');
    expect(openingPrompt([{ type: 'assistant', message: { content: 'hello' } }])).toBe('');
  });
});
