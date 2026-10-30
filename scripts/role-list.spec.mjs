/**
 * The role list rules, tested over synthetic markdown rather than over the real
 * skill.
 *
 * **A check that only ever runs over one file is a check nobody can disprove.**
 * `check-role-list.mjs` reads `.claude/skills/setup/SKILL.md` and reports what it
 * finds there; if the rules were wrong, that one file would simply be parsed
 * wrongly and every run would agree with itself. So the rules are exercised here
 * against documents written to break them and documents written to look like
 * they do.
 *
 * **Every role name below is invented, and that is the point.** The rules name
 * no role, so nothing here needs a real one — and a spec written with the real
 * list would quietly become a third copy of it, which is the failure the module
 * exists to prevent.
 */
import { describe, expect, it } from 'vitest';
import {
  derivedRoles,
  findingsIn,
  roleBulletRegion,
  scopeFailure,
  scopeOf,
  unionSlugs,
} from './role-list.mjs';

/** A whole skill file, in the shape the real one has: a bullet, then a fenced shape. */
const skill = (bullet, union) =>
  [
    '### Block 1 — who you are, and how you work',
    '',
    bullet,
    '',
    '- **Do you write code here, or compose only?** A different question.',
    '',
    '```json',
    '{',
    '  "version": 1,',
    `  "role": "${union}",`,
    '  "writesCode": true',
    '}',
    '```',
    '',
    'Some closing prose about something else.',
  ].join('\n');

const BULLET = ['- **Role.** Widget maker, gadget lead, or something else they should', '  name themselves.'].join('\n');
const UNION = 'widget-maker | gadget-lead | other';

describe('deriving the offered list from the question', () => {
  it('turns the prose into slugs', () => {
    expect(derivedRoles(skill(BULLET, UNION))).toEqual(['widget-maker', 'gadget-lead']);
  });

  /**
   * The reason this collapses the region instead of scanning lines.
   *
   * Markdown reflow puts one role's words on two source lines, so a
   * line-oriented scanner sees neither half as a role and reports a shorter list
   * with no error at all.
   */
  it('sees a role whose words markdown reflowed across two lines', () => {
    const wrapped = [
      '- **Role.** Widget maker, gadget lead, sprocket',
      '  systems lead, or something else they should name themselves.',
    ].join('\n');
    expect(derivedRoles(skill(wrapped, UNION))).toEqual([
      'widget-maker',
      'gadget-lead',
      'sprocket-systems-lead',
    ]);
  });

  it('drops a quoted attribution sitting inside the bullet', () => {
    const cited = [BULLET, '', '  > SOURCE: Somebody, 2026-01-01 — "gadget lead, widget maker".'].join('\n');
    expect(derivedRoles(skill(cited, UNION))).toEqual(['widget-maker', 'gadget-lead']);
  });

  it('stops at the first blank line rather than swallowing the next bullet', () => {
    expect(roleBulletRegion(skill(BULLET, UNION))).not.toContain('Do you write code');
  });

  it('ignores whatever follows the escape phrase, so that sentence can be reworded', () => {
    const chatty = [BULLET, '  The two of them run teams rather than compose anything at all.'].join('\n');
    expect(derivedRoles(skill(chatty, UNION))).toEqual(['widget-maker', 'gadget-lead']);
  });
});

describe('reading the stored list from the shape', () => {
  it('splits the union and keeps its order', () => {
    expect(unionSlugs(skill(BULLET, UNION))).toEqual(['widget-maker', 'gadget-lead', 'other']);
  });

  it('refuses to guess when the field appears twice', () => {
    const doubled = `${skill(BULLET, UNION)}\n\nAnother example: "role": "widget-maker | other",`;
    expect(unionSlugs(doubled)).toEqual([]);
  });
});

describe('the two statements agreeing, and the ways they stop', () => {
  it('reports nothing when they match', () => {
    expect(findingsIn(skill(BULLET, UNION))).toEqual([]);
  });

  it('catches a value deleted from the shape alone', () => {
    const findings = findingsIn(skill(BULLET, 'widget-maker | other'));
    expect(findings.map((f) => f.rule)).toContain('escape-slot');
  });

  it('catches an item reworded in the question alone', () => {
    const reworded = ['- **Role.** Widget maker, gadget captain, or something else they should', '  name themselves.'].join('\n');
    const findings = findingsIn(skill(reworded, UNION));
    expect(findings.map((f) => f.rule)).toContain('disagree');
    expect(findings[0].detail).toContain('gadget-captain');
    expect(findings[0].detail).toContain('gadget-lead');
  });

  it('catches a reorder, which a membership test would pass', () => {
    const findings = findingsIn(skill(BULLET, 'gadget-lead | widget-maker | other'));
    expect(findings.map((f) => f.rule)).toContain('disagree');
  });

  /**
   * The floor is a floor and not today's count, on purpose.
   *
   * Pinning the number would fail the most ordinary correct edit there is, which
   * is how a check becomes something people learn to silence.
   */
  it('passes a role added correctly to both places', () => {
    const grown = [
      '- **Role.** Widget maker, gadget lead, sprocket lead, or something else they',
      '  should name themselves.',
    ].join('\n');
    const text = skill(grown, 'widget-maker | gadget-lead | sprocket-lead | other');
    expect(scopeFailure(text)).toBeNull();
    expect(findingsIn(text)).toEqual([]);
  });
});

describe('the scope floor, which runs before any comparison', () => {
  /**
   * The whole reason the floor exists.
   *
   * Two empty lists compare equal, so a document this cannot parse would report
   * no disagreement and exit 0 — a green over a measurement that never happened.
   *
   * Measured on the first run of this spec: the comparison ALSO notices the
   * missing escape slot, so there are two lines of defence rather than one. The
   * floor is still the one relied on, because it is the one that holds when the
   * two halves fail together.
   */
  it('two lists that failed to parse must not read as agreement', () => {
    const broken = 'A document with no bullet and no shape in it at all.';
    expect(scopeFailure(broken)).not.toBeNull();
    expect(findingsIn(broken)).not.toEqual([]);
  });

  it('names a renamed anchor as a parse failure rather than a naming problem', () => {
    const renamed = skill('- **Your role.** Widget maker, or something else.', UNION);
    expect(scopeFailure(renamed)).toContain('parse failure');
  });

  it('fails when the anchor appears twice', () => {
    const twice = `${skill(BULLET, UNION)}\n${BULLET}`;
    expect(scopeFailure(twice)).toContain('rather than once');
  });

  it('fails when the escape phrase is gone, because the list has no end', () => {
    const noEscape = '- **Role.** Widget maker, gadget lead.';
    expect(scopeFailure(skill(noEscape, UNION))).toContain('stopped resolving');
  });

  it('reports what it actually read', () => {
    expect(scopeOf(skill(BULLET, UNION))).toMatchObject({
      anchors: 1,
      unionFields: 1,
      proseItems: 2,
      unionItems: 3,
    });
  });
});

/**
 * The known false positive, stated as a test rather than as a caveat so it
 * cannot be forgotten by somebody reading a green run.
 *
 * Comparing two lists costs this, and a substring test would not pay it — but a
 * substring test also passes prose that DENIES the roles, which is worse. The
 * mitigation is that the runner prints both parsed lists on every failure, so a
 * punctuation cause is legible in one line instead of reading as a role problem.
 */
describe('what it gets wrong', () => {
  it('reds when the final delimiter is reworded, even though nothing is missing', () => {
    const dashed = ['- **Role.** Widget maker, gadget lead — or something else they should', '  name themselves.'].join('\n');
    expect(findingsIn(skill(dashed, UNION)).length).toBeGreaterThan(0);
  });
});
