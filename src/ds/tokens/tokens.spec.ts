/**
 * The token tiers' rules, as checks. What each tier may point at, that every
 * mode carries the same tokens, that every semantic token has a usage rule an
 * agent can read, and that `build/` is what the JSON makes.
 *
 * What this cannot see: whether a rule is TRUE, or whether a colour is right.
 * A rule that says the wrong thing in the right shape passes. Contrast is the
 * `contrast-audit` skill's, and a render is a capture's.
 *
 * The modes and bands come from `config.json`. With no prefix there, there is
 * no set, and only the first block runs: it holds that nothing pretends to be
 * one. Architecture: .claude/skills/tokens/SKILL.md.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { BANDS, MODES, PREFIX, buildTokens, readConfig } from '../../../scripts/build-tokens.mjs';

const DIR = __dirname;
const ROOT = join(DIR, '../../..');
/** A tier file the set does not have yet reads as an empty tree. */
const read = (file: string) => (existsSync(join(DIR, file)) ? JSON.parse(readFileSync(join(DIR, file), 'utf8')) : {});
const config = readConfig(ROOT);
const hasSet = PREFIX !== null;

type Leaf = { path: string; $type: string; $value: unknown };
function leaves(tree: Record<string, unknown>, prefix: string[] = []): Leaf[] {
  return Object.entries(tree).flatMap(([key, node]) => {
    if (key.startsWith('$') || !node || typeof node !== 'object') return [];
    const n = node as Record<string, unknown>;
    const path = [...prefix, key];
    return '$value' in n ? [{ path: path.join('.'), $type: n.$type as string, $value: n.$value }] : leaves(n, path);
  });
}

const primitive = leaves(read('primitive.json'));
const semanticBase = leaves(read('semantic/base.json'));
const semanticMode: Record<string, Leaf[]> = Object.fromEntries(MODES.map((m: string) => [m, leaves(read(`semantic/${m}.json`))]));
const semanticBand: Record<string, Leaf[]> = Object.fromEntries(BANDS.map((b: string) => [b, leaves(read(`semantic/breakpoint/${b}.json`))]));
const firstMode = semanticMode[config.defaultMode ?? ''] ?? [];
const firstBand = semanticBand[config.defaultBand ?? ''] ?? [];
const allModes = Object.values(semanticMode).flat();
const semantic = [...semanticBase, ...firstMode, ...firstBand];
const component = leaves(read('component.json'));
const usage: Record<string, Record<string, unknown>> = read('semantic/usage.json');

const primitivePaths = new Set(primitive.map((t) => t.path));
const semanticPaths = new Set(semantic.map((t) => t.path));

const REF = /^\{([^}]+)\}$/;
/** Every `{…}` inside a value, however deep. */
const refsIn = (value: unknown): string[] => [...JSON.stringify(value).matchAll(/\{([^}"]+)\}/g)].map((m) => m[1]);
/** Every colour inside a value: the leaf itself, a shadow's, a gradient's stops. */
function coloursIn(t: Leaf): unknown[] {
  if (t.$type === 'color') return [t.$value];
  if (t.$type === 'shadow' && typeof t.$value === 'object') return [(t.$value as { color: unknown }).color];
  if (t.$type === 'gradient' && Array.isArray(t.$value)) return t.$value.map((s: { color: unknown }) => s.color);
  return [];
}
/** Values with no scale to belong to, such as a map line's width in pixels or a dash in widths. */
const RAW_ALLOWED = new Set(['number', 'numberList', 'dashArray']);

describe.runIf(!hasSet)('no set yet', () => {
  it('has no tier files, because a set nobody configured is a set nobody can build', () => {
    const files = ['primitive.json', 'component.json', 'semantic/base.json', 'semantic/usage.json'].filter((f) => existsSync(join(DIR, f)));
    expect(files).toEqual([]);
  });

  it('declares no modes and no bands without a prefix', () => {
    expect([MODES.length, BANDS.length]).toEqual([0, 0]);
  });
});

describe.runIf(hasSet)('config', () => {
  it('names at least one mode, and defaults to one it names', () => {
    expect(MODES.length).toBeGreaterThan(0);
    expect(MODES).toContain(config.defaultMode);
  });

  it('defaults to a band it names, when it names bands', () => {
    if (BANDS.length) expect(BANDS).toContain(config.defaultBand);
  });
});

describe.runIf(hasSet)('primitive', () => {
  it('holds values, never references', () => {
    expect(primitive.filter((t) => refsIn(t.$value).length).map((t) => t.path)).toEqual([]);
  });
});

describe.runIf(hasSet)('semantic', () => {
  /* Or a band token, which the band spec holds to a primitive: a page heading whose size steps with the band. */
  it('references primitives only, or a band token', () => {
    const bandPaths = new Set(firstBand.map((t) => t.path));
    const bad = [...semanticBase, ...allModes].flatMap((t) => refsIn(t.$value).filter((r) => !primitivePaths.has(r) && !bandPaths.has(r)).map((r) => `${t.path} → ${r}`));
    expect(bad).toEqual([]);
  });

  it('carries no raw colour, not even inside a shadow or a gradient', () => {
    for (const mode of MODES) {
      const bad = [...semanticBase, ...semanticMode[mode]].filter((t) => coloursIn(t).some((c) => typeof c !== 'string' || !REF.test(c)));
      expect(bad.map((t) => `${mode}: ${t.path}`)).toEqual([]);
    }
  });

  it('carries no raw value except values with no scale and a shadow’s offsets', () => {
    const bad = semantic.filter((t) => !RAW_ALLOWED.has(t.$type) && !['shadow', 'gradient', 'typography'].includes(t.$type) && !(typeof t.$value === 'string' && REF.test(t.$value)));
    expect(bad.map((t) => t.path)).toEqual([]);
  });

  it('builds every text style from primitives only', () => {
    const bad = semantic.filter((t) => t.$type === 'typography' && Object.values(t.$value as object).some((v) => typeof v !== 'string' || !REF.test(v)));
    expect(bad.map((t) => t.path)).toEqual([]);
  });

  it('has the same tokens, with the same types, in every mode', () => {
    const shape = (ls: Leaf[]) => ls.map((t) => `${t.path}:${t.$type}`).sort();
    for (const mode of MODES) expect(shape(semanticMode[mode]), mode).toEqual(shape(firstMode));
  });

  it('keeps what does not change with the mode out of the mode files', () => {
    const modePaths = new Set(firstMode.map((t) => t.path));
    expect(semanticBase.filter((t) => modePaths.has(t.path)).map((t) => t.path)).toEqual([]);
  });

  it('never shares a root with a primitive, so the tiers never merge into one group', () => {
    const roots = (ls: Leaf[]) => new Set(ls.map((t) => t.path.split('.')[0]));
    const p = roots(primitive);
    expect([...roots(semantic)].filter((r) => p.has(r))).toEqual([]);
    /* Band tokens are exempt against the component tier alone: a band's `panel.contentGap` may sit
       beside a panel component's `panel.*`, and bands are emitted in a tree of their own. */
    expect([...roots(component)].filter((r) => p.has(r) || roots([...semanticBase, ...firstMode]).has(r))).toEqual([]);
  });
});

describe.runIf(hasSet)('band', () => {
  it('has the same tokens, with the same types, in every band', () => {
    const shape = (ls: Leaf[]) => ls.map((t) => `${t.path}:${t.$type}`).sort();
    for (const band of BANDS) expect(shape(semanticBand[band]), band).toEqual(shape(firstBand));
  });

  it('references a primitive, or a token of its own band that does', () => {
    const bad = BANDS.flatMap((band: string) => {
      const own = new Map(semanticBand[band].map((t) => [t.path, t]));
      const landsOnPrimitive = (r: string) => primitivePaths.has(r) || (own.has(r) && refsIn(own.get(r)!.$value).every((p) => primitivePaths.has(p)));
      return semanticBand[band].flatMap((t) => refsIn(t.$value).filter((r) => !landsOnPrimitive(r)).map((r) => `${band}: ${t.path} → ${r}`));
    });
    expect(bad).toEqual([]);
  });

  it('carries no raw value', () => {
    const bad = BANDS.flatMap((band: string) => semanticBand[band].filter((t) => typeof t.$value !== 'string' || !REF.test(t.$value)).map((t) => `${band}: ${t.path}`));
    expect(bad).toEqual([]);
  });

  it('keeps what changes with the band out of the base and mode files', () => {
    const bandPaths = new Set(firstBand.map((t) => t.path));
    expect([...semanticBase, ...allModes].filter((t) => bandPaths.has(t.path)).map((t) => t.path)).toEqual([]);
  });
});

describe.runIf(hasSet)('component', () => {
  it('is references only, never a raw value', () => {
    expect(component.filter((t) => typeof t.$value !== 'string' || !REF.test(t.$value)).map((t) => t.path)).toEqual([]);
  });

  it('takes its colours from semantic tokens, never from a primitive', () => {
    const bad = component.filter((t) => ['color', 'shadow', 'gradient'].includes(t.$type) && !semanticPaths.has((t.$value as string).slice(1, -1)));
    expect(bad.map((t) => t.path)).toEqual([]);
  });

  it('points at tokens that exist', () => {
    const bad = component.filter((t) => { const r = (t.$value as string).slice(1, -1); return !semanticPaths.has(r) && !primitivePaths.has(r); });
    expect(bad.map((t) => t.path)).toEqual([]);
  });
});

describe.runIf(hasSet)('usage rules', () => {
  const FIELDS = new Set(['description', 'useWhen', 'dont', 'insteadOf', 'source']);

  it('exist for every semantic token, and for nothing else', () => {
    expect([...semanticPaths].filter((p) => !usage[p]).sort()).toEqual([]);
    expect(Object.keys(usage).filter((p) => !semanticPaths.has(p))).toEqual([]);
  });

  it('say what the token is, when to use it, and where that came from', () => {
    const bad = Object.entries(usage).filter(([, r]) =>
      typeof r.description !== 'string' || !r.description ||
      !Array.isArray(r.useWhen) || !r.useWhen.length ||
      typeof r.source !== 'string' || !r.source ||
      Object.keys(r).some((k) => !FIELDS.has(k)));
    expect(bad.map(([p]) => p)).toEqual([]);
  });

  it('name as rivals only semantic tokens that exist', () => {
    const bad = Object.entries(usage).flatMap(([p, r]) => Object.keys((r.insteadOf as object) ?? {}).filter((k) => !semanticPaths.has(k) || k === p).map((k) => `${p} → ${k}`));
    expect(bad).toEqual([]);
  });
});

describe('build', () => {
  it('is what the JSON makes — run `pnpm tokens` after editing a token', async () => {
    const files = await buildTokens();
    // Git may check the file out as CRLF; the bytes that matter are the lines.
    const stale = [...files].filter(([path, content]) => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/g, '\n') !== content).map(([path]) => path);
    expect(stale).toEqual([]);
  });
});
