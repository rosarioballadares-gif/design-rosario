import { describe, expect, it } from 'vitest';

import { hashFor, parseRoute } from './route';
import { PROTOTYPES, prototype } from './sandbox/registry';

describe('parseRoute', () => {
  it('reads the index from an empty hash, and from every shape of one', () => {
    for (const hash of ['', '#', '#/', '#//']) {
      expect(parseRoute(hash).prototype).toBeNull();
    }
  });

  it('falls back to the index for a segment no prototype declares', () => {
    expect(parseRoute('#/nothing-here').prototype).toBeNull();
  });

  it('resolves every registered prototype from its own hash', () => {
    // Generated from the registry rather than listed, so a prototype added
    // without a working route fails here instead of when somebody clicks.
    for (const p of PROTOTYPES) {
      expect(parseRoute(hashFor(p.id)).prototype).toBe(p);
    }
  });

  it('resolves every old id to the prototype that took its place, variant included', () => {
    // A renamed route keeps its saved links.
    for (const p of PROTOTYPES) {
      for (const alias of p.aliases ?? []) {
        expect(parseRoute(hashFor(alias)).prototype).toBe(p);
        for (const variant of p.variants ?? []) {
          expect(parseRoute(hashFor(alias, variant))).toEqual({ prototype: p, variant });
        }
      }
    }
  });

  it('accepts a declared variant and drops one that is not declared', () => {
    for (const p of PROTOTYPES) {
      for (const variant of p.variants ?? []) {
        expect(parseRoute(hashFor(p.id, variant)).variant).toBe(variant);
      }
      expect(parseRoute(hashFor(p.id, 'not-a-variant')).variant).toBeUndefined();
    }
  });
});

describe('the registry', () => {
  it('declares no id twice, since the second one would be unreachable', () => {
    const ids = PROTOTYPES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives no old id to two prototypes, nor one an id still answers to', () => {
    const names = PROTOTYPES.flatMap((p) => [p.id, ...(p.aliases ?? [])]);
    expect(new Set(names).size).toBe(names.length);
  });

  it('answers `undefined` rather than throwing for an unknown id', () => {
    expect(prototype('nothing-here')).toBeUndefined();
  });
});
