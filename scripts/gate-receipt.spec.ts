/**
 * What `scripts/gate-receipt.cjs` writes, and what it reads back.
 *
 * WHY THIS FILE EXISTS. `git-guard.spec.ts` injects `proofOf`, so every push
 * case there is decided from a literal — which is correct for testing the rule
 * and leaves the module that answers it untouched by the suite. The failure
 * that matters is silent and total: if `receiptPath` or `read` stops answering,
 * `gateProof` returns null, the guard fails OPEN by design, and every push to
 * `main` is allowed with no output at all. Two mechanisms here have already
 * gone quiet that way in the repository this came from: a hook after an MCP
 * prefix change, and a check exiting at module load for nine days.
 *
 * The fixture is a real repository in a temp directory, the shape
 * `git-guard.spec.ts` uses for `briefState`, because every reader here shells
 * out to git and a mocked one would prove nothing about the answers git gives.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

type Receipt = { head: string; clean: boolean; at: string; checks: string[] } | null;

const receipt = require('./gate-receipt.cjs') as {
  RECEIPT: string;
  receiptPath: (cwd?: string) => string | null;
  head: (cwd?: string) => string | null;
  clean: (cwd?: string) => boolean | null;
  read: (cwd?: string) => Receipt;
  write: (cwd: string | undefined, measured: { head: string | null; clean: boolean | null; checks: string[] }) => string | null;
  remove: (cwd?: string) => boolean;
};

// The publish block of `gate.mjs`, as a literal. A fixture, not a second
// source: this spec proves the receipt records what it was handed.
const FIVE = ['lint', 'build', 'build:storybook', 'check:briefs', 'test:run'];

describe('the receipt over a real repository', () => {
  let dir = '';
  let run: (...args: string[]) => string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gate-receipt-'));
    run = (...args) =>
      execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    run('init', '-b', 'main');
    run('config', 'user.email', 'spec@example.com');
    run('config', 'user.name', 'spec');
    /*
     * The same line the real `.gitignore` carries, and it is load-bearing
     * rather than scenery — see the second measurement case below.
     */
    writeFileSync(join(dir, '.gitignore'), `${receipt.RECEIPT}\n`);
    writeFileSync(join(dir, 'seed.txt'), 'seed\n');
    run('add', '.gitignore', 'seed.txt');
    run('commit', '-m', 'seed');
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  /** What `gate.mjs` measures before it runs the five. */
  const measure = () => ({ head: receipt.head(dir), clean: receipt.clean(dir), checks: FIVE });

  it('records the commit a push would send, with what ran', () => {
    receipt.write(dir, measure());
    expect(receipt.read(dir)).toMatchObject({ head: run('rev-parse', 'HEAD').trim(), clean: true, checks: FIVE });
  });

  /*
   * The path is asserted by its NAME and not by its prefix. `--show-toplevel`
   * resolves symlinks and `mkdtempSync` does not, so on macOS the fixture's
   * `/var/...` comes back as `/private/var/...`. Nothing in production notices,
   * because `gate.mjs` and `git-guard.cjs` both go through `receiptPath` and so
   * land on the same file — but a test that pins the prefix fails on one
   * platform for a reason that has nothing to do with the receipt.
   */
  it('writes it at the top of the tree, under the name the guard looks for', () => {
    const path = receipt.write(dir, measure()) as string;
    expect(path.endsWith(receipt.RECEIPT)).toBe(true);
    expect(path).toBe(receipt.receiptPath(dir));
    expect(JSON.parse(readFileSync(path, 'utf8')).at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('reads a tree carrying uncommitted work as dirty', () => {
    writeFileSync(join(dir, 'unfinished.ts'), 'export const a = 1;\n');
    receipt.write(dir, measure());
    expect(receipt.read(dir)?.clean).toBe(false);
  });

  /*
   * The case that only appears on the SECOND run, and the one the `.gitignore`
   * line exists for. Without it the receipt from run one is untracked work in
   * run two, so the tree reads dirty, the new receipt records `clean: false`,
   * and the guard refuses every push from then on with nothing to explain it.
   */
  it('does not dirty the tree it measured, so a second run still reads clean', () => {
    receipt.write(dir, measure());
    expect(receipt.clean(dir)).toBe(true);
    receipt.write(dir, measure());
    expect(receipt.read(dir)?.clean).toBe(true);
  });

  it('goes stale by HEAD rather than by time, which is what the guard compares', () => {
    receipt.write(dir, measure());
    const before = receipt.read(dir)?.head;
    run('commit', '--allow-empty', '-m', 'later');
    expect(receipt.head(dir)).not.toBe(before);
    expect(receipt.read(dir)?.head).toBe(before);
  });

  it('resolves to the same file from a subdirectory', () => {
    mkdirSync(join(dir, 'src', 'deep'), { recursive: true });
    expect(receipt.receiptPath(join(dir, 'src', 'deep'))).toBe(receipt.receiptPath(dir));
  });

  it('deletes the receipt and says whether there was one', () => {
    receipt.write(dir, measure());
    expect(receipt.remove(dir)).toBe(true);
    expect(receipt.remove(dir)).toBe(false);
    expect(receipt.read(dir)).toBeNull();
  });
});

/**
 * Every one of these reads as "nothing has proven this tree", which is the
 * answer that makes the guard REFUSE. They are grouped because getting any of
 * them wrong in the other direction — returning something truthy — is what
 * would let an unproven publish through.
 */
describe('what counts as no receipt', () => {
  let dir = '';

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gate-receipt-none-'));
    execFileSync('git', ['init', '-b', 'main'], { cwd: dir, stdio: 'ignore' });
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('is null when nothing was ever written', () => {
    expect(receipt.read(dir)).toBeNull();
  });

  it('is null when the file is not JSON', () => {
    writeFileSync(join(dir, receipt.RECEIPT), 'half a write\n');
    expect(receipt.read(dir)).toBeNull();
  });

  it('is null when the JSON parses but names no head', () => {
    writeFileSync(join(dir, receipt.RECEIPT), JSON.stringify({ clean: true }));
    expect(receipt.read(dir)).toBeNull();
  });
});

/**
 * Outside a repository every reader answers null, which `gateProof` turns into
 * the one fail-open case in the guard: with no HEAD there is no question to
 * ask. This is the half that must NOT be tightened into a refusal.
 */
describe('outside a repository', () => {
  let dir = '';

  beforeEach(() => (dir = mkdtempSync(join(tmpdir(), 'gate-receipt-bare-'))));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('answers null for the path, the head and the tree', () => {
    expect(receipt.receiptPath(dir)).toBeNull();
    expect(receipt.head(dir)).toBeNull();
    expect(receipt.clean(dir)).toBeNull();
    expect(receipt.read(dir)).toBeNull();
  });

  it('writes nothing and removes nothing', () => {
    expect(receipt.write(dir, { head: null, clean: null, checks: FIVE })).toBeNull();
    expect(receipt.remove(dir)).toBe(false);
  });
});
