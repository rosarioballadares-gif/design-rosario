/**
 * Tests for how a browser is found.
 *
 * The two checks that need one — `check:chart-render` and
 * `check:chart-capture` — run in CI and in `pnpm gate`, and on 2026-09-12 CI
 * stopped starting jobs over an account billing block. So the resolver is the
 * thing standing between two checks and running nowhere at all, and it is
 * worth a test that does not need a browser to run.
 *
 * Fixtures are directories, because that is what the resolver reads. Nothing
 * here launches anything.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { playwrightCache, playwrightChromes } from './browser.mjs';

const MAC_ARM =
  'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const LINUX = 'chrome-linux/chrome';

const roots = [];

/** A cache directory holding one browser per `chromium-<build>` asked for. */
function cacheWith(builds, rel = MAC_ARM) {
  const root = mkdtempSync(join(tmpdir(), 'ms-playwright-fixture-'));
  roots.push(root);
  for (const build of builds) {
    const parts = rel.split('/');
    const dir = join(root, `chromium-${build}`, ...parts.slice(0, -1));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, parts.at(-1)), '');
  }
  return root;
}

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

describe('playwrightChromes', () => {
  it('finds the binary Playwright actually installs on this platform', () => {
    expect(playwrightChromes(cacheWith(['1243']))).toHaveLength(1);
  });

  it('sorts the build NUMERICALLY, so 1243 beats 987', () => {
    /* The defect this pins: sorted as strings, "987" wins and an old browser
     * answers for a new one with nothing able to see it. */
    const [first] = playwrightChromes(cacheWith(['987', '1243']));
    expect(first).toContain('chromium-1243');
  });

  it('reads the linux layout too', () => {
    expect(playwrightChromes(cacheWith(['1243'], LINUX))).toHaveLength(1);
  });

  it('ignores the headless shell, which does not take --headless=new', () => {
    const root = cacheWith(['1243']);
    const shell = join(root, 'chromium_headless_shell-1243', 'chrome-headless-shell-mac-arm64');
    mkdirSync(shell, { recursive: true });
    writeFileSync(join(shell, 'chrome-headless-shell'), '');
    expect(playwrightChromes(root).every((p) => !p.includes('headless'))).toBe(true);
  });

  it('returns nothing for a cache that holds no browser', () => {
    expect(playwrightChromes(cacheWith([]))).toEqual([]);
  });

  it('returns nothing rather than throwing when the cache is absent', () => {
    expect(playwrightChromes(join(tmpdir(), 'ms-playwright-does-not-exist'))).toEqual([]);
  });

  it('returns nothing rather than throwing when there is no cache path at all', () => {
    expect(playwrightChromes(null)).toEqual([]);
  });
});

describe('playwrightCache', () => {
  it('names a platform-appropriate directory', () => {
    const expected = { darwin: 'Library/Caches/ms-playwright', win32: 'ms-playwright' };
    expect(playwrightCache()).toContain(expected[process.platform] ?? '.cache/ms-playwright');
  });
});
