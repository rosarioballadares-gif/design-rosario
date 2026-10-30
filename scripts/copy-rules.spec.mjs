/**
 * The copy character rules, tested over strings rather than over the tree.
 *
 * **A check that only ever runs over this repository is a check nobody can
 * disprove.** `check-copy.mjs` reads `src/` and reports what it finds there; if
 * the rules were wrong, the baseline would simply record the wrong thing and
 * every run would agree with it. So the rules are exercised here against
 * strings written to break them and strings written to look like they do —
 * which is the half that matters, because a rule's cost is its false positives.
 */
import { describe, expect, it } from 'vitest';
import {
  RULES,
  findingsIn,
  isRecordModule,
  keyOf,
  looksLikeCopy,
  stringsIn,
  stripComments,
} from './copy-rules.mjs';

const fire = (id, s) => RULES.find((r) => r.id === id).test(s);

describe('the four characters, and what must not trip them', () => {
  it('catches a semicolon', () => {
    expect(fire('semicolon', 'Save your work; we will publish it tonight.')).toBe(true);
    expect(fire('semicolon', 'Save your work. We will publish it tonight.')).toBe(false);
  });

  it('catches an ellipsis character but not three full stops', () => {
    expect(fire('ellipsis', 'Loading…')).toBe(true);
    // Three periods are a different defect and a different repair, and folding
    // them in here would make the message wrong for both.
    expect(fire('ellipsis', 'Loading...')).toBe(false);
  });

  /**
   * The ampersand rule is SPACED, and this is the test that says why.
   *
   * An unspaced ampersand is almost never the word "and" — it is a name, an
   * abbreviation or an entity. Matching bare `&` would report `Q&A` and
   * `AT&T` as voice violations, which is the shape of false positive that
   * teaches people to stop reading a check.
   */
  it('catches an ampersand standing in for "and", and leaves a name alone', () => {
    expect(fire('ampersand', 'Hours, location & phone number')).toBe(true);
    expect(fire('ampersand', 'Hours, location and phone number')).toBe(false);
    expect(fire('ampersand', 'Read the Q&A before you start')).toBe(false);
    expect(fire('ampersand', 'Your AT&T line is connected')).toBe(false);
    expect(fire('ampersand', 'See ?utm_source=x&utm_medium=y for the rest')).toBe(false);
  });

  it('catches an emoji and leaves ordinary punctuation alone', () => {
    expect(fire('emoji', 'Your listing is live 🎉')).toBe(true);
    expect(fire('emoji', 'Your listing is live.')).toBe(false);
    expect(fire('emoji', 'Prices run from £10 — €12 in the EU')).toBe(false);
  });

  it('gives every rule a repair rather than only a complaint', () => {
    for (const rule of RULES) {
      expect(rule.repair.length, rule.id).toBeGreaterThan(10);
    }
  });
});

describe('what counts as copy', () => {
  it('takes a sentence and leaves an identifier', () => {
    expect(looksLikeCopy('Add your hours and location')).toBe(true);
    expect(looksLikeCopy('ops-chart__ink--1')).toBe(false);
    expect(looksLikeCopy('src/charts/palette.ts')).toBe(false);
    expect(looksLikeCopy('--color-data-blue-200')).toBe(false);
    expect(looksLikeCopy('12')).toBe(false);
  });

  /** Stated as a test rather than as a caveat, so the hole cannot be forgotten. */
  it('leaves a stylesheet rule alone, and still reads copy with a brace in it', () => {
    expect(looksLikeCopy('.mg-card>.mg-section{border-top:1px solid #d7d0ff;margin:0 -14px}')).toBe(false);
    expect(looksLikeCopy('.mg-card{border-top:1px solid ${LINE};margin:0}')).toBe(false);
    expect(looksLikeCopy('Hello {name}: your route is ready; go')).toBe(true);
  });

  it('does NOT see a two-word string, which is a known hole', () => {
    expect(looksLikeCopy('Save;')).toBe(false);
  });
});

describe('comments are not copy', () => {
  it('blanks a block comment and keeps the line count', () => {
    const text = "const a = 1;\n/* a semicolon; in prose */\nconst b = 'Add your hours and location';";
    const stripped = stripComments(text);
    expect(stripped.split('\n')).toHaveLength(3);
    expect(stripped).not.toContain('in prose');
    expect(stripped).toContain('Add your hours and location');
  });

  it('blanks a line comment without eating a URL', () => {
    const text = "const u = 'https://example.com/a; b and c'; // a note; with a semicolon";
    const stripped = stripComments(text);
    expect(stripped).not.toContain('a note');
    expect(stripped).toContain('https://example.com/a; b and c');
  });
});

describe('reading the strings out of a file', () => {
  it('reads single quotes, double quotes and templates, with their lines', () => {
    const text = ["const a = 'first one here';", 'const b = "second one here";', 'const c = `third one here`;'].join(
      '\n',
    );
    expect(stringsIn(text)).toEqual([
      { line: 1, value: 'first one here' },
      { line: 2, value: 'second one here' },
      { line: 3, value: 'third one here' },
    ]);
  });
});

describe('the record modules', () => {
  it('excludes specs', () => {
    expect(isRecordModule('src/charts/charts.spec.ts')).toBe(true);
    expect(isRecordModule('src/ds/tokens/tokens.spec.tsx')).toBe(true);
  });

  it('does not exclude an ordinary component or fixture', () => {
    expect(isRecordModule('src/charts/ChartState.tsx')).toBe(false);
    expect(isRecordModule('src/settings/fixtures.ts')).toBe(false);
  });

  it('finds nothing at all in a record module, whatever is in it', () => {
    const text = "export const NOTE = 'A finding; with a semicolon in it, recorded.';";
    expect(findingsIn('src/charts/charts.spec.ts', text)).toEqual([]);
    expect(findingsIn('src/settings/fixtures.ts', text)).toHaveLength(1);
  });
});

describe('a finding', () => {
  const text = "export const BANNER = 'You can edit while paused; changes apply on resume.';";

  it('names the file, the line, the rule and the repair', () => {
    const [found] = findingsIn('src/settings/fixtures.ts', text);
    expect(found.path).toBe('src/settings/fixtures.ts');
    expect(found.line).toBe(1);
    expect(found.rule).toBe('semicolon');
    expect(found.repair).toMatch(/semicolon/i);
  });

  /**
   * The key carries no line number, deliberately: a line moves whenever
   * somebody edits above it, and a baseline keyed on one would report an
   * unrelated change as a new finding and leave the fixed one behind as a stale
   * entry.
   */
  it('is identified without its line number', () => {
    const [found] = findingsIn('src/settings/fixtures.ts', text);
    const moved = findingsIn('src/settings/fixtures.ts', `\n\n${text}`)[0];
    expect(moved.line).toBe(3);
    expect(keyOf(moved)).toBe(keyOf(found));
  });
});
