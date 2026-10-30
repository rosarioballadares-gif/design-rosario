/**
 * Every component record, checked against the component's own JSDoc: the
 * component is born in code and the design file mirrors it. Until the
 * `component` skill writes the first record, only the list-wide tests run.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PREFIX } from '../../../scripts/build-tokens.mjs';
import { GROUPS, RECORDS } from './index';
import { zGroup, zRecord } from './schema';

/** The set's prefix as a component's: `ac` names `AcButton`. */
const COMPONENT_PREFIX = PREFIX ? PREFIX[0].toUpperCase() + PREFIX.slice(1) : null;

/** Past these a rule is a manual, not a rule. */
const CAPS = { useWhen: 7, do: 5, dont: 4 } as const;

/** The JSDoc directly above `export function <Name>`. */
const descriptionOf = (source: string, name: string) => {
  const match = new RegExp(`/\\*\\*([\\s\\S]*?)\\*/\\s*export function ${name}\\b`).exec(source);
  return match ? match[1].replace(/^\s*\* ?/gm, '').trim() : null;
};

describe('usage records', () => {
  it.each(RECORDS.map((r) => [r.exportName, r] as const))('%s parses', (_, r) => {
    expect(() => zRecord.parse(r)).not.toThrow();
  });

  it.each(RECORDS.map((r) => [r.exportName, r] as const))('%s carries the set’s prefix', (_, r) => {
    expect(COMPONENT_PREFIX, 'a component needs a token set, and the set names the prefix').not.toBeNull();
    expect(r.exportName.startsWith(COMPONENT_PREFIX!)).toBe(true);
  });

  it.each(RECORDS.map((r) => [r.exportName, r] as const))('%s stays inside the caps', (_, r) => {
    for (const [field, cap] of Object.entries(CAPS)) {
      expect(r.guidance[field as keyof typeof CAPS].length, field).toBeLessThanOrEqual(cap);
    }
  });

  it.each(RECORDS.map((r) => [r.exportName, r] as const))('%s points at a file that exports it', (_, r) => {
    expect(existsSync(r.sourcePath), r.sourcePath).toBe(true);
    expect(readFileSync(r.sourcePath, 'utf8')).toMatch(new RegExp(`export function ${r.exportName}\\b`));
  });

  it.each(RECORDS.map((r) => [r.exportName, r] as const))(
    '%s carries a description in the shape Figma mirrors',
    (_, r) => {
      const description = descriptionOf(readFileSync(r.sourcePath, 'utf8'), r.exportName);
      expect(description, 'a JSDoc above the export').not.toBeNull();
      for (const clause of ['Goes in: ', 'Does not go in: ', 'Particularity: ']) {
        expect(description, clause).toContain(clause);
      }
    },
  );

  it('names only rivals that have a record', () => {
    const names = new Set(RECORDS.map((r) => r.exportName));
    for (const r of RECORDS) for (const rival of r.competesWith) expect(names, `${r.exportName} → ${rival}`).toContain(rival);
  });

  it('has one record per name', () => {
    const names = RECORDS.map((r) => r.exportName);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('confusion groups', () => {
  // One test over the list, not `it.each`: there are no groups until a second
  // member lands, and an empty `it.each` fails the file for having no tests.
  it('parse, and every member competes with every other', () => {
    for (const g of GROUPS) {
      expect(() => zGroup.parse(g), g.id).not.toThrow();
      for (const name of g.members) {
        const r = RECORDS.find((x) => x.exportName === name);
        expect(r, name).toBeDefined();
        expect(r!.group).toBe(g.id);
        for (const other of g.members) if (other !== name) expect(r!.competesWith, `${name} → ${other}`).toContain(other);
      }
    }
  });
});
