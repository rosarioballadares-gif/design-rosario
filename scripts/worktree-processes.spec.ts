/**
 * Which processes `scripts/worktree-processes.cjs` stops for a worktree, and
 * which it must not.
 *
 * The tables are shaped like the one measured on 2026-09-25: a shell starts a
 * `pnpm` wrapper whose command line carries no path, and only the vite under
 * it names the worktree.
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

type Proc = { pid: number; ppid: number; name: string; command: string };

const { mentions, pidsToStop, held } = require('./worktree-processes.cjs') as {
  mentions: (command: string, path: string) => boolean;
  pidsToStop: (processes: Proc[], path: string, self?: number) => number[];
  held: (path: string) => string | null;
};

const WT = 'C:\\product-ops-base\\.claude\\worktrees\\name-field';

/** A dev server started from a Claude background task, as it was measured. */
const TABLE: Proc[] = [
  { pid: 1, ppid: 0, name: 'claude.exe', command: 'claude.exe --resume abc' },
  { pid: 10, ppid: 1, name: 'bash.exe', command: 'bash.exe -c "pnpm exec vite --port 5238"' },
  { pid: 11, ppid: 10, name: 'node.exe', command: 'node pnpm.cjs exec vite --port 5238 --strictPort' },
  {
    pid: 12,
    ppid: 11,
    name: 'node.exe',
    command: `node "${WT}\\node_modules\\.bin\\..\\vite\\bin\\vite.js" --port 5238`,
  },
  { pid: 13, ppid: 12, name: 'esbuild.exe', command: 'esbuild.exe --service=0.28.2 --ping' },
  /* another worktree whose name starts with this one's */
  { pid: 20, ppid: 1, name: 'node.exe', command: `node "${WT}-2\\node_modules\\vite\\bin\\vite.js"` },
  /* the main checkout's own server */
  { pid: 30, ppid: 1, name: 'node.exe', command: 'node "C:\\product-ops-base\\node_modules\\vite\\bin\\vite.js"' },
];

const sorted = (pids: number[]) => [...pids].sort((a, b) => a - b);

describe('mentions', () => {
  it('matches the path in either slash direction and any case', () => {
    expect(mentions('node c:/PRODUCT-ops-base/.claude/worktrees/name-field/x.js', WT)).toBe(true);
  });

  it('does not match a longer path that starts with it', () => {
    expect(mentions(`node ${WT}-2\\x.js`, WT)).toBe(false);
  });

  it('matches the path at the end of the line and before a quote', () => {
    expect(mentions(`cd ${WT}`, WT)).toBe(true);
    expect(mentions(`node "${WT}"`, WT)).toBe(true);
  });
});

describe('pidsToStop', () => {
  it('climbs from the vite that names the worktree to its pnpm wrapper, and takes the tree', () => {
    expect(sorted(pidsToStop(TABLE, WT, 999))).toEqual([11, 12, 13]);
  });

  it('climbs through the cmd /c shims pnpm puts between node wrappers on Windows', () => {
    /* The chain measured 2026-09-25, where the first version stopped at pid 63
     * and left both pnpm wrappers running. */
    const table: Proc[] = [
      { pid: 60, ppid: 1, name: 'sh.exe', command: 'sh.exe /c/npm/pnpm exec vite --port 5290' },
      { pid: 61, ppid: 60, name: 'node.exe', command: 'node.exe pnpm.cjs exec vite --port 5290' },
      { pid: 62, ppid: 61, name: 'cmd.exe', command: 'cmd.exe /d /s /c "pnpm ^"exec^" ^"vite^""' },
      { pid: 63, ppid: 62, name: 'node.exe', command: 'node pnpm.cjs "exec" "vite" "--port" "5290"' },
      { pid: 64, ppid: 63, name: 'cmd.exe', command: 'cmd.exe /q /d /s /c "vite ^^^"--port^^^""' },
      { pid: 65, ppid: 64, name: 'node.exe', command: `node "${WT}\\node_modules\\.bin\\..\\vite\\bin\\vite.js"` },
    ];
    expect(sorted(pidsToStop(table, WT, 999))).toEqual([61, 62, 63, 64, 65]);
  });

  it('does not climb into an interactive cmd, which is somebody’s terminal window', () => {
    const table: Proc[] = [
      { pid: 70, ppid: 1, name: 'cmd.exe', command: '"C:\\Windows\\system32\\cmd.exe"' },
      { pid: 71, ppid: 70, name: 'node.exe', command: `node "${WT}\\node_modules\\vite\\bin\\vite.js"` },
    ];
    expect(pidsToStop(table, WT, 999)).toEqual([71]);
  });

  it('does not climb past the launch into the shell or the session', () => {
    const stopped = pidsToStop(TABLE, WT, 999);
    expect(stopped).not.toContain(10);
    expect(stopped).not.toContain(1);
  });

  it('leaves other worktrees and the main checkout alone', () => {
    const stopped = pidsToStop(TABLE, WT, 999);
    expect(stopped).not.toContain(20);
    expect(stopped).not.toContain(30);
  });

  it('never returns whoever asked, nor its ancestors, even when they name the path', () => {
    const table: Proc[] = [
      ...TABLE,
      { pid: 40, ppid: 1, name: 'node.exe', command: `node pnpm.cjs worktree:close ${WT}` },
      { pid: 41, ppid: 40, name: 'node.exe', command: `node scripts/worktree-close.mjs ${WT}` },
    ];
    const stopped = pidsToStop(table, WT, 41);
    expect(stopped).not.toContain(40);
    expect(stopped).not.toContain(41);
    expect(sorted(stopped)).toEqual([11, 12, 13]);
  });

  it('survives a parent loop, which pid reuse can produce', () => {
    const table: Proc[] = [
      { pid: 50, ppid: 51, name: 'node.exe', command: `node ${WT}\\a.js` },
      { pid: 51, ppid: 50, name: 'node.exe', command: 'node wrapper' },
    ];
    expect(sorted(pidsToStop(table, WT, 999))).toEqual([50, 51]);
  });

  it('returns nothing for a worktree nothing names', () => {
    expect(pidsToStop(TABLE, 'C:\\elsewhere', 999)).toEqual([]);
  });
});

describe('held', () => {
  it('answers null for a folder nothing stands in, and leaves it where it was', () => {
    const dir = mkdtempSync(join(tmpdir(), 'held-'));
    try {
      expect(held(dir)).toBeNull();
      expect(existsSync(dir)).toBe(true);
      expect(existsSync(`${dir}.probe`)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  /* Windows only: Linux renames a folder a process stands in. The child says
   * when it runs because `spawn` returns before it has opened its working
   * directory — 2 runs in 10 read the folder free without the wait. */
  it.skipIf(process.platform !== 'win32')('sees a process standing in the folder, and lets go once it leaves', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'held-'));
    const child = spawn(process.execPath, ['-e', "process.stdout.write('up'); setTimeout(() => {}, 30000)"], {
      cwd: dir,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    try {
      await once(child.stdout, 'data');
      expect(held(dir)).toBe('EBUSY');
      child.kill();
      await once(child, 'exit');
      expect(held(dir)).toBeNull();
      expect(existsSync(dir)).toBe(true);
    } finally {
      child.kill();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
