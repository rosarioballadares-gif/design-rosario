/**
 * The hooks' temp-store cleanup, held to what it may and may not remove: only
 * its own prefix, only past seven days, only on a session's first write.
 */
import { mkdirSync, mkdtempSync, existsSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { MAX_AGE_MS, sweepOnce } = require('./hook-store-sweep.cjs');

const dirs = [];
const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), 'hook-store-sweep-'));
  dirs.push(dir);
  return dir;
};
const file = (dir, name, ageMs) => {
  const path = join(dir, name);
  writeFileSync(path, '{}');
  const when = (Date.now() - ageMs) / 1000;
  utimesSync(path, when, when);
  return path;
};

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('sweepOnce', () => {
  it('removes its own prefix past seven days and keeps the rest', () => {
    const dir = scratch();
    const old = file(dir, 'claude-edit-rounds-a.json', MAX_AGE_MS + 60_000);
    const recent = file(dir, 'claude-edit-rounds-b.json', 60_000);
    const other = file(dir, 'claude-bash-rounds-c.json', MAX_AGE_MS + 60_000);
    const foreign = file(dir, 'claude-edit-rounds-d.txt', MAX_AGE_MS + 60_000);

    sweepOnce(join(dir, 'claude-edit-rounds-new.json'), 'claude-edit-rounds-');

    expect(existsSync(old)).toBe(false);
    expect(existsSync(recent)).toBe(true);
    expect(existsSync(other)).toBe(true);
    expect(existsSync(foreign)).toBe(true);
  });

  it('does nothing once the session already has its store', () => {
    const dir = scratch();
    const store = file(dir, 'claude-edit-rounds-mine.json', 0);
    const old = file(dir, 'claude-edit-rounds-a.json', MAX_AGE_MS + 60_000);

    sweepOnce(store, 'claude-edit-rounds-');

    expect(existsSync(old)).toBe(true);
  });

  it('never throws over a directory it cannot read', () => {
    const dir = scratch();
    mkdirSync(join(dir, 'claude-edit-rounds-x.json'));
    expect(() => sweepOnce(join(dir, 'missing', 'store.json'), 'claude-edit-rounds-')).not.toThrow();
    expect(() => sweepOnce(join(dir, 'store.json'), 'claude-edit-rounds-')).not.toThrow();
  });
});
