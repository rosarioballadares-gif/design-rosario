/**
 * Tests for the feedback checker.
 *
 * The negative cases come first and they are the point. This checker's whole
 * risk is that it resembles `brief-fields.mjs` closely enough to be assumed
 * identical, and the two deliberately disagree in three places: an observation
 * needs no citation here, a `SOURCE:` without a date fails here, and only the
 * proposal is held to the three-state rule. Each of those is pinned below, so a
 * later edit that quietly aligns the two fails a test rather than silently
 * teaching people to invent citations for their own experience.
 */

import { describe, expect, it } from 'vitest';
import {
  CLAIM_FIELDS,
  FEEDBACK_FIELDS,
  REQUIRED_FEEDBACK_FIELDS,
  checkFeedback,
  checkFeedbackName,
  fieldForFeedback,
} from './feedback-fields.mjs';

/** A record that passes, so a test can change exactly one thing and see it fail. */
const record = (overrides = {}) => {
  const sections = {
    'What happened': 'I ran the setup skill and it stopped at the token step.',
    Where: 'In `pnpm check:env`, at the registry row.',
    'What it cost': 'About forty minutes, and I gave up and asked Ian.',
    ...overrides,
  };
  const body = Object.entries(sections)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `## ${k}\n\n${v}`)
    .join('\n\n');
  const attribution =
    overrides.__attribution === undefined
      ? '\n\n> SOURCE: Sarah Johnston, 2026-09-01\n'
      : overrides.__attribution;
  return `# Feedback: the token step\n${attribution}\n${body}\n`;
};

describe('what a record must carry', () => {
  it('passes a record with an observation, a place, a cost and a dated reporter', () => {
    const result = checkFeedback(record());
    expect(result.findings).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.stats.reporters).toBe(1);
  });

  it('fails a record that names nobody', () => {
    const result = checkFeedback(record({ __attribution: '' }));
    expect(result.ok).toBe(false);
    expect(result.findings.map((f) => f.code)).toContain('unattributed');
  });

  it('fails a reporter with a name and no date, which the brief checker accepts', () => {
    const result = checkFeedback(record({ __attribution: '\n\n> SOURCE: Sarah Johnston\n' }));
    expect(result.ok).toBe(false);
    const finding = result.findings.find((f) => f.code === 'undated-reporter');
    expect(finding).toBeDefined();
    expect(finding.detail).toMatch(/already repaired/);
  });

  it.each(REQUIRED_FEEDBACK_FIELDS)('fails a record with no "%s" section', (field) => {
    const result = checkFeedback(record({ [field]: null }));
    expect(result.ok).toBe(false);
    expect(result.findings).toContainEqual(
      expect.objectContaining({ field, code: 'missing' }),
    );
  });

  it('fails an empty cost section, which is how a mention differs from a report', () => {
    const result = checkFeedback(record({ 'What it cost': '' }));
    expect(result.ok).toBe(false);
    expect(result.findings).toContainEqual(
      expect.objectContaining({ field: 'What it cost', code: 'empty' }),
    );
  });

  // The first version of this message named the cost section whichever section
  // was actually empty, so emptying the observation reported "a blank cost
  // section" over a cost section that was filled in. Found by running the four
  // mutations rather than by reading the diff.
  it.each(REQUIRED_FEEDBACK_FIELDS)('names the section it found empty, for "%s"', (field) => {
    const finding = checkFeedback(record({ [field]: '' })).findings.find(
      (f) => f.code === 'empty',
    );
    expect(finding.detail).toContain(`"## ${field}"`);
    const others = REQUIRED_FEEDBACK_FIELDS.filter((f) => f !== field);
    for (const other of others) expect(finding.detail).not.toContain(other);
  });

  it('fails two headings that resolve to one section, because one goes unread', () => {
    const text = record() + '\n## The cost\n\nAnother forty minutes.\n';
    const result = checkFeedback(text);
    expect(result.findings).toContainEqual(
      expect.objectContaining({ field: 'What it cost', code: 'duplicate' }),
    );
  });
});

describe('what an observation is NOT held to', () => {
  it('accepts an observation with no citation of any kind', () => {
    const result = checkFeedback(
      record({ 'What happened': 'Nothing worked and I could not tell why.' }),
    );
    expect(result.findings.filter((f) => f.field === 'What happened')).toEqual([]);
  });

  it('accepts a cost stated as a plain sentence about a person', () => {
    const result = checkFeedback(record({ 'What it cost': 'Most of a morning.' }));
    expect(result.findings.filter((f) => f.field === 'What it cost')).toEqual([]);
  });

  it('accepts an extra section with no citation, because the document is signed', () => {
    const text = record() + '\n## Background\n\nI had cloned it the day before.\n';
    const result = checkFeedback(text);
    expect(result.ok).toBe(true);
  });
});

describe('where it happened has to be somewhere a reader can go', () => {
  it('fails a place named only in prose', () => {
    const result = checkFeedback(record({ Where: 'In the setup skill, near the end.' }));
    expect(result.ok).toBe(false);
    expect(result.findings).toContainEqual(
      expect.objectContaining({ field: 'Where', code: 'unlocated' }),
    );
  });

  it('accepts a repo path', () => {
    const result = checkFeedback(record({ Where: 'In `.claude/skills/setup/SKILL.md`.' }));
    expect(result.findings.filter((f) => f.field === 'Where')).toEqual([]);
  });

  it('accepts a markdown link', () => {
    const result = checkFeedback(record({ Where: 'In [the readme](../README.md).' }));
    expect(result.findings.filter((f) => f.field === 'Where')).toEqual([]);
  });

  it('accepts a command, which the brief checker does not count as a citation', () => {
    const result = checkFeedback(record({ Where: 'Running `pnpm check:env`.' }));
    expect(result.findings.filter((f) => f.field === 'Where')).toEqual([]);
  });

  it('accepts a stated gap when the person could not tell where they were', () => {
    const result = checkFeedback(record({ Where: '> GAP: I could not tell what produced it.' }));
    expect(result.findings.filter((f) => f.field === 'Where')).toEqual([]);
  });

  it('rejects an arbitrary backticked phrase as a location', () => {
    const result = checkFeedback(record({ Where: 'Somewhere in `the wiring`.' }));
    expect(result.findings).toContainEqual(
      expect.objectContaining({ field: 'Where', code: 'unlocated' }),
    );
  });
});

describe('a proposal is a claim and carries the three states', () => {
  it('fails a proposal with nothing behind it', () => {
    const result = checkFeedback(record({ 'What would fix it': 'Rewrite the whole skill.' }));
    expect(result.ok).toBe(false);
    const finding = result.findings.find((f) => f.code === 'unsupported-proposal');
    expect(finding).toBeDefined();
    expect(finding.detail).toMatch(/observation above it\s+needs none of those/);
  });

  it('accepts a proposal that cites', () => {
    const result = checkFeedback(
      record({ 'What would fix it': 'Add the row to [the readme](../README.md).' }),
    );
    expect(result.ok).toBe(true);
  });

  it('accepts a proposal that states a gap', () => {
    const result = checkFeedback(
      record({ 'What would fix it': '> GAP: I do not know what the repair is.' }),
    );
    expect(result.ok).toBe(true);
  });

  it('is the only field held to that bar', () => {
    expect(CLAIM_FIELDS).toEqual(['What would fix it']);
  });

  it('is optional, because the person who hits friction may not know the repair', () => {
    expect(FEEDBACK_FIELDS).toContain('What would fix it');
    expect(REQUIRED_FEEDBACK_FIELDS).not.toContain('What would fix it');
    expect(checkFeedback(record()).ok).toBe(true);
  });
});

describe('the filename', () => {
  it('accepts a dated slug', () => {
    expect(checkFeedbackName('2026-09-09-setup-token-step.md')).toEqual([]);
  });

  it.each([
    'draft.md',
    'setup-token-step.md',
    '2026-9-9-setup.md',
    '2026-09-09-Setup-Token.md',
    '2026-09-09-.md',
  ])('rejects "%s"', (name) => {
    const findings = checkFeedbackName(name);
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe('unnamed');
  });
});

describe('heading resolution', () => {
  it.each([
    ['What happened', 'What happened'],
    ['What happened (the short version)', 'What happened'],
    ['what went wrong', 'What happened'],
    ['The problem', 'What happened'],
    ['Where', 'Where'],
    ['Surface', 'Where'],
    ['Cost', 'What it cost'],
    ['Impact', 'What it cost'],
    ['The fix', 'What would fix it'],
    ['Proposal', 'What would fix it'],
  ])('reads "%s" as "%s"', (heading, field) => {
    expect(fieldForFeedback(heading)).toBe(field);
  });

  it('refuses to guess between the three fields that start with "What"', () => {
    expect(fieldForFeedback('What')).toBe(null);
  });

  it('resolves an unambiguous expansion', () => {
    expect(fieldForFeedback('What would')).toBe('What would fix it');
  });

  it('returns null for a heading that means none of them', () => {
    expect(fieldForFeedback('Background')).toBe(null);
  });
});

describe('fenced examples are not answers', () => {
  it('does not read a fenced SOURCE line as an attribution', () => {
    const text = [
      '# Feedback',
      '',
      '```',
      '> SOURCE: Somebody, 2026-01-01',
      '```',
      '',
      '## What happened',
      '',
      'It broke.',
      '',
      '## Where',
      '',
      'In `pnpm build`.',
      '',
      '## What it cost',
      '',
      'An hour.',
    ].join('\n');
    const result = checkFeedback(text);
    expect(result.stats.reporters).toBe(0);
    expect(result.findings.map((f) => f.code)).toContain('unattributed');
  });

  it('does not read a fenced heading as a section', () => {
    const text = record() + '\n```\n## What would fix it\n\nNothing behind this.\n```\n';
    const result = checkFeedback(text);
    expect(result.ok).toBe(true);
  });
});
