/**
 * Tests for the standing-floor rules.
 *
 * The subject is a check whose whole value is that it fails, so the assertions
 * that matter are the negative ones: a part over its ceiling, a part the budget
 * forgot, a run that read nothing. A floor check that silently passes over a
 * document that doubled is worse than no check at all — it converts "nobody
 * looked" into "somebody looked and it was fine", which is exactly what the 27
 * days of growth in CLAUDE.md felt like from the inside.
 *
 * **Every fixture here is invented.** None carries a real skill name or a real
 * budget number, so the day the ceilings move these tests say nothing about it
 * — the same separation `skills-table.mjs` keeps from the skills it compares.
 */

import { describe, expect, it } from 'vitest';
import {
  CHARS_PER_TOKEN,
  DESCRIPTION_CAP,
  ceilingTotal,
  findings,
  floorFailures,
  listingLine,
  listingText,
  measure,
  tokens,
} from './context-floor.mjs';

const BUDGET = { budget: { 'CLAUDE.md': 100, 'skill listing': 50 } };

/** A document of an exact token size, so the assertions can be arithmetic. */
const documentOf = (wanted) => 'x'.repeat(Math.round(wanted * CHARS_PER_TOKEN));

describe('tokens', () => {
  it('converts bytes at the ratio the audit published', () => {
    expect(tokens(43553)).toBe(11771);
    expect(tokens(1944)).toBe(525);
  });
});

describe('listingLine', () => {
  it('costs nothing for a hidden skill', () => {
    expect(listingLine({ name: 'a-skill', description: 'a long sentence', hidden: true })).toBeNull();
  });

  it('costs only the name for a name-only skill, description or not', () => {
    expect(listingLine({ name: 'a-skill', description: 'ignored', nameOnly: true })).toBe('- a-skill\n');
  });

  it('costs only the name when the skill has no description at all', () => {
    expect(listingLine({ name: 'a-skill' })).toBe('- a-skill\n');
  });

  it('carries a short description whole', () => {
    expect(listingLine({ name: 'a-skill', description: 'Use when short.' })).toBe(
      '- a-skill: Use when short.\n',
    );
  });

  it('truncates a long description to the cap the harness applies', () => {
    const line = listingLine({ name: 'a-skill', description: 'y'.repeat(400) });
    expect(line).toBe(`- a-skill: ${'y'.repeat(DESCRIPTION_CAP - 1)}…\n`);
  });

  it('does not truncate a description sitting exactly on the cap', () => {
    const exact = 'z'.repeat(DESCRIPTION_CAP);
    expect(listingLine({ name: 'a-skill', description: exact })).toBe(`- a-skill: ${exact}\n`);
  });
});

describe('listingText', () => {
  it('carries only the skills that reach the listing', () => {
    const text = listingText([
      { name: 'seen', description: 'a description' },
      { name: 'named', nameOnly: true },
      { name: 'gone', description: 'a description', hidden: true },
    ]);
    expect(text).toBe('- seen: a description\n- named\n');
    expect(text).not.toContain('gone');
  });
});

describe('measure', () => {
  it('reports the parts, the total and how many skills produced it', () => {
    const measured = measure({
      claudeText: documentOf(90),
      skills: [
        { name: 'seen', description: 'a description' },
        { name: 'gone', description: 'a description', hidden: true },
      ],
    });
    expect(measured.parts['CLAUDE.md']).toBe(90);
    expect(measured.total).toBe(measured.parts['CLAUDE.md'] + measured.parts['skill listing']);
    expect(measured).toMatchObject({ listed: 1, onDisk: 2 });
  });

  it('measures a CRLF checkout of CLAUDE.md as the LF file it is', () => {
    const lf = 'line one\nline two\n'.repeat(200);
    const crlf = lf.replace(/\n/g, '\r\n');
    expect(measure({ claudeText: crlf, skills: [] }).parts['CLAUDE.md']).toBe(measure({ claudeText: lf, skills: [] }).parts['CLAUDE.md']);
  });
});

describe('floorFailures', () => {
  const skills = [{ name: 'seen', description: 'a description' }];

  it('finds nothing when a real document and a real budget were read', () => {
    expect(floorFailures(measure({ claudeText: documentOf(10), skills }), BUDGET)).toEqual([]);
  });

  it('refuses to call an unread document a measurement of zero', () => {
    const found = floorFailures(measure({ claudeText: '', skills }), BUDGET);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/CLAUDE\.md measured 0/);
  });

  it('refuses an empty skills directory', () => {
    const found = floorFailures(measure({ claudeText: documentOf(10), skills: [] }), BUDGET);
    expect(found.join(' ')).toMatch(/No skill directories/);
  });

  it('refuses a budget that names no ceiling for a part', () => {
    const found = floorFailures(measure({ claudeText: documentOf(10), skills }), {
      budget: { 'CLAUDE.md': 100 },
    });
    expect(found.join(' ')).toMatch(/no ceiling for "skill listing"/);
  });
});

describe('findings', () => {
  const skills = [{ name: 'seen', description: 'a description' }];

  it('finds nothing while every part is inside its ceiling', () => {
    expect(findings(measure({ claudeText: documentOf(90), skills }), BUDGET)).toEqual([]);
  });

  it('finds nothing on a part sitting exactly on its ceiling', () => {
    expect(findings(measure({ claudeText: documentOf(100), skills }), BUDGET)).toEqual([]);
  });

  it('fails the part that crossed, and says by how much', () => {
    const found = findings(measure({ claudeText: documentOf(140), skills }), BUDGET);
    expect(found).toHaveLength(1);
    expect(found[0]).toBe('CLAUDE.md: 140 tokens against a ceiling of 100, over by 40.');
  });

  it('names each part that crossed rather than only the first', () => {
    const wordy = Array.from({ length: 40 }, (_, index) => ({
      name: `skill-${index}`,
      description: 'a description long enough to cost something',
    }));
    const found = findings(measure({ claudeText: documentOf(140), skills: wordy }), BUDGET);
    expect(found).toHaveLength(2);
    expect(found.join(' ')).toMatch(/skill listing: \d+ tokens against a ceiling of 50/);
  });

  /* The failure that lets a floor grow again: a third thing paid on every call,
   * added to the measurement, silently skipped because nobody gave it a
   * ceiling. A check that decides not to inspect something still reports green. */
  it('fails a part the budget forgot rather than skipping it', () => {
    const found = findings({ parts: { 'a new thing': 10 } }, BUDGET);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/the budget names no ceiling for it/);
  });
});

describe('ceilingTotal', () => {
  it('adds the ceilings the budget names', () => {
    expect(ceilingTotal(BUDGET)).toBe(150);
  });

  it('treats a missing ceiling as nothing rather than throwing', () => {
    expect(ceilingTotal({})).toBe(0);
  });
});
