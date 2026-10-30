/**
 * The skills table rules, tested over synthetic markdown rather than over
 * `CLAUDE.md`.
 *
 * **A check that only ever runs over one file is a check nobody can disprove.**
 * `check-skills-table.mjs` reads the real table and reports what it finds; if
 * the rules were wrong, that one table would simply be parsed wrongly and every
 * run would agree with itself. So the rules are exercised here against documents
 * written to break them and documents written to look like they do.
 *
 * **Every skill name below is invented, and that is the point.** The rules name
 * no skill, so nothing here needs a real one — and a spec written with the real
 * set would quietly become a third copy of it, which is the failure the module
 * exists to prevent.
 */
import { describe, expect, it } from 'vitest';
import {
  ANCHOR,
  anchorCount,
  disagreements,
  floorFailures,
  scopeOf,
  tabledSkills,
  descriptionFailures,
  unreachableHidden,
  NEEDS_A_REACHER,
} from './skills-table.mjs';

/** A document in the shape CLAUDE.md has: prose, the table, then prose that also names skills. */
const doc = (names, { trailing = true } = {}) => `
## Skills

${ANCHOR}
| --- | --- |
${names.map((n) => `| \`${n}\` | Use it when something happens |`).join('\n')}

${trailing ? 'The last two carry a flag, so `alpha-skill` never appears in the listing.' : ''}
`;

describe('reading the table', () => {
  it('reads the names in the order the table lists them', () => {
    expect(tabledSkills(doc(['gamma', 'alpha', 'beta']))).toEqual(['gamma', 'alpha', 'beta']);
  });

  it('stops at the end of the table, so prose beneath it cannot contribute', () => {
    expect(tabledSkills(doc(['gamma']))).toEqual(['gamma']);
  });

  it('ignores the separator row rather than reading it as a skill', () => {
    expect(tabledSkills(doc(['gamma']))).not.toContain('---');
  });

  it('returns nothing when the header is absent', () => {
    expect(tabledSkills('| Something | Else |\n| --- | --- |\n| `alpha` | x |')).toEqual([]);
  });

  it('skips a row whose first cell is not a backticked slug', () => {
    const odd = doc(['gamma']).replace('| `gamma` |', '| **gamma** |');
    expect(tabledSkills(odd)).toEqual([]);
  });

  it('counts the header, so a second table is visible', () => {
    expect(anchorCount(doc(['gamma']))).toBe(1);
    expect(anchorCount(doc(['gamma']) + doc(['delta']))).toBe(2);
  });
});

describe('the floor, checked before any comparison', () => {
  it('passes when both sides resolved', () => {
    expect(floorFailures(doc(['gamma', 'delta']), ['gamma', 'delta'])).toEqual([]);
  });

  it('fails when the table parse returned nothing, rather than reporting agreement', () => {
    expect(floorFailures('# nothing here', ['gamma']).join(' ')).toContain('table');
  });

  it('fails when the directory is empty, rather than reporting agreement', () => {
    expect(floorFailures(doc(['gamma']), []).join(' ')).toContain('directory');
  });

  it('two empty sides would otherwise compare equal, which is the whole reason for this', () => {
    expect(disagreements('nothing', [])).toEqual([]);
    expect(floorFailures('nothing', []).length).toBeGreaterThan(0);
  });

  it('fails when the header appears twice, because the region read would be arbitrary', () => {
    const doubled = doc(['gamma']) + doc(['delta']);
    expect(floorFailures(doubled, ['gamma', 'delta']).join(' ')).toContain('found 2 times');
  });

  it('does not pin a count, so adding a skill to both sides stays green', () => {
    expect(floorFailures(doc(['gamma']), ['gamma'])).toEqual([]);
    expect(floorFailures(doc(['gamma', 'delta', 'epsilon']), ['gamma', 'delta', 'epsilon'])).toEqual([]);
  });
});

describe('comparing the two', () => {
  it('is silent when they agree', () => {
    expect(disagreements(doc(['gamma', 'delta']), ['gamma', 'delta'])).toEqual([]);
  });

  it('names a skill that exists and is not listed, which is the failure this repairs', () => {
    const out = disagreements(doc(['gamma']), ['gamma', 'delta']);
    expect(out.length).toBe(1);
    expect(out[0]).toContain('delta');
    expect(out[0]).toContain('does not list it');
  });

  it('names a row pointing at no directory', () => {
    const out = disagreements(doc(['gamma', 'ghost']), ['gamma']);
    expect(out.join(' ')).toContain('ghost');
    expect(out.join(' ')).toContain('no such directory');
  });

  it('ignores order, because the directory is sorted and the table is edited', () => {
    expect(disagreements(doc(['delta', 'gamma']), ['gamma', 'delta'])).toEqual([]);
  });

  it('catches a row written twice, which both membership loops would pass', () => {
    const out = disagreements(doc(['gamma', 'gamma', 'delta']), ['gamma', 'delta']);
    expect(out.length).toBe(1);
    expect(out[0]).toContain('more than once');
  });

  it('reports every disagreement rather than stopping at the first', () => {
    expect(disagreements(doc(['gamma', 'ghost']), ['gamma', 'delta']).length).toBe(2);
  });
});

describe('the scope line', () => {
  it('reports what each side resolved, so a run says what it measured', () => {
    expect(scopeOf(doc(['gamma', 'delta']), ['gamma', 'delta', 'epsilon'])).toEqual({
      anchors: 1,
      tabled: 2,
      onDisk: 3,
    });
  });
});

describe('the acceptance test', () => {
  it('names no skill, which is what stops it becoming a third copy of the set', async () => {
    const { readFile, readdir } = await import('node:fs/promises');
    const rules = await readFile(new URL('./skills-table.mjs', import.meta.url), 'utf8');
    const dirents = await readdir(new URL('../.claude/skills', import.meta.url), {
      withFileTypes: true,
    });
    const names = dirents.filter((e) => e.isDirectory()).map((e) => e.name);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(rules).not.toContain(name);
  });
});

describe('a colon in a description', () => {
  it('is reported, because it silently makes the skill unroutable', () => {
    // Measured 2026-09-10: two of eleven shortened descriptions gained a `: `,
    // and both skills were then listed under their H1 title instead of their
    // trigger. The file is complete; nothing routes to it.
    const found = descriptionFailures({
      good: 'Use when a thing happens — the symptom is another thing.',
      bad: 'Use when a thing happens: the symptom is another thing.',
    });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/^bad has a colon/);
    expect(found[0]).toMatch(/unroutable/);
    // A string, like every other finding the runner prints. A finding shaped
    // differently from its siblings prints as [object Object] — measured.
    expect(typeof found[0]).toBe('string');
  });

  it('accepts a colon with no space after it, which YAML does not break on', () => {
    expect(descriptionFailures({ x: 'A ratio of 3:1 is fine.' })).toEqual([]);
  });

  it('says nothing about an empty or absent set', () => {
    expect(descriptionFailures({})).toEqual([]);
    expect(descriptionFailures(undefined)).toEqual([]);
  });
});

describe('a skill the agent cannot see', () => {
  const TABLE = ['| `alpha` | |', '| `bravo` | Only a person starts this one |'].join('\n');
  const ROUTED = "'a thing happens → read .claude/skills/alpha/SKILL.md'";

  it('asks nothing of name-only, which lists the name and keeps the tool working', () => {
    // The state that costs almost nothing AND stays reachable. If this ever
    // starts demanding a reacher, the check is punishing the right answer.
    expect(unreachableHidden({ alpha: 'name-only' }, '', TABLE)).toEqual([]);
    expect(NEEDS_A_REACHER.has('name-only')).toBe(false);
  });

  it('asks nothing of a skill under no override at all', () => {
    expect(unreachableHidden({ alpha: 'on' }, '', TABLE)).toEqual([]);
  });

  it('fails the frontmatter flag with no reacher', () => {
    const found = unreachableHidden({ alpha: 'frontmatter-flag' }, '', TABLE);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/^alpha is frontmatter-flag/);
    expect(typeof found[0]).toBe('string');
  });

  it('fails user-invocable-only and off the same way', () => {
    expect(unreachableHidden({ alpha: 'user-invocable-only' }, '', TABLE)).toHaveLength(1);
    expect(unreachableHidden({ alpha: 'off' }, '', TABLE)).toHaveLength(1);
  });

  it('accepts either reacher: the router, or a sentence in the table', () => {
    expect(unreachableHidden({ alpha: 'off' }, ROUTED, TABLE)).toEqual([]);
    expect(unreachableHidden({ bravo: 'frontmatter-flag' }, '', TABLE)).toEqual([]);
  });

  it('fails every unreachable state when the router is gone, rather than passing quietly', () => {
    expect(unreachableHidden({ alpha: 'off' }, undefined, TABLE)).toHaveLength(1);
  });

  it('offers name-only in the finding, since it is usually the right repair', () => {
    expect(unreachableHidden({ alpha: 'off' }, '', TABLE)[0]).toMatch(/name-only/);
  });

  it('says nothing about an empty or absent set', () => {
    expect(unreachableHidden({}, '', TABLE)).toEqual([]);
    expect(unreachableHidden(undefined, '', TABLE)).toEqual([]);
  });
});
