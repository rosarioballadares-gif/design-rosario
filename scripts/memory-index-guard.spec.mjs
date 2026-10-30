/**
 * Tests for the memory-index guard.
 *
 * The assertions that matter are the refusals and the one pass that keeps a
 * repair possible: an index already over its ceiling must still take a write
 * that shrinks it. Every fixture is invented, and the budget here is small on
 * purpose so the day `context-floor.json` moves says nothing to these tests.
 */

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { CHARS_PER_TOKEN as FLOOR_RATIO } from './context-floor.mjs';

const require = createRequire(import.meta.url);
const { CHARS_PER_TOKEN, isIndex, tokens, resultOf, judge } = require('./memory-index-guard.cjs');

const budget = { ceiling: 50, lineCap: 40 };
const line = (n) => `- [Memory ${n}](m${n}.md) — when to read it.`;
const lines = (count) => Array.from({ length: count }, (_, i) => line(i)).join('\n') + '\n';

describe('which file it guards', () => {
  it('takes the index of any project, either slash', () => {
    expect(isIndex('C:\\Users\\a\\.claude\\projects\\c--x\\memory\\MEMORY.md')).toBe(true);
    expect(isIndex('/home/a/.claude/projects/-x/memory/MEMORY.md')).toBe(true);
  });

  it('leaves a memory file, a repo file and a missing path alone', () => {
    expect(isIndex('C:\\Users\\a\\.claude\\projects\\c--x\\memory\\one.md')).toBe(false);
    expect(isIndex('C:\\repo\\memory\\MEMORY.md')).toBe(false);
    expect(isIndex(undefined)).toBe(false);
  });
});

describe('what a call leaves on disk', () => {
  it('reads an Edit as the replacement, once or everywhere', () => {
    expect(resultOf('Edit', { old_string: 'a', new_string: 'b' }, 'a a')).toBe('b a');
    expect(resultOf('Edit', { old_string: 'a', new_string: 'b', replace_all: true }, 'a a')).toBe('b b');
  });

  it('keeps a $ in the new text literal', () => {
    expect(resultOf('Edit', { old_string: 'a', new_string: "$'" }, 'a')).toBe("$'");
  });

  it('knows nothing when the Edit cannot apply', () => {
    expect(resultOf('Edit', { old_string: 'z', new_string: 'b' }, 'a')).toBeNull();
    expect(resultOf('Read', {}, 'a')).toBeNull();
  });
});

describe('the decision', () => {
  it('lets an index inside both limits through', () => {
    expect(judge('Write', { content: lines(2) }, '', budget)).toBeNull();
  });

  it('refuses a write that carries the index over its ceiling', () => {
    const reason = judge('Write', { content: lines(10) }, lines(2), budget);
    expect(reason).toMatch(/against a ceiling of 50/);
  });

  it('lets a write shrink an index already over its ceiling', () => {
    expect(tokens(lines(8))).toBeGreaterThan(budget.ceiling);
    expect(judge('Write', { content: lines(8) }, lines(10), budget)).toBeNull();
  });

  it('refuses a new line over the cap, and names it', () => {
    const long = `- [Memory](m.md) — ${'x'.repeat(40)}`;
    const reason = judge('Edit', { old_string: line(0), new_string: long }, line(0), budget);
    expect(reason).toMatch(/1 new line\(s\) over 40 characters \(line 1: /);
  });

  it('does not refuse a long line the file already held', () => {
    const long = `- [Memory](m.md) — ${'x'.repeat(40)}`;
    const current = `${long}\n${line(1)}\n`;
    expect(judge('Edit', { old_string: line(1), new_string: line(2) }, current, budget)).toBeNull();
  });
});

describe('the ratio', () => {
  it('is the one check:floor measures with', () => {
    expect(CHARS_PER_TOKEN).toBe(FLOOR_RATIO);
  });
});
