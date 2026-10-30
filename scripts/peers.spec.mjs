/**
 * `pnpm peers`, held to its reading of git's porcelain and of Claude Code's
 * session registry, and the short board to the rule that keeps it out of a
 * session start with no peer: every session pays for what that hook prints.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { describeWait, labelOf, parseWorktrees, placeSessions, readSessions, shortBoard, treeOf, waitsOn } from './peers.mjs';

const PORCELAIN = [
  'worktree C:/product-ops-base',
  'HEAD bd69959d3553ed5563767c2514b01a2f075ca8f3',
  'branch refs/heads/main',
  '',
  'worktree C:/product-ops-base/.claude/worktrees/appshell-bands',
  'HEAD f13e2890c4a99fc72a3dd65c57ee3a2f8729af03',
  'branch refs/heads/feat/appshell-bands',
  'locked claude session appshell-bands (pid 4688)',
  '',
  'worktree C:/product-ops-base/.claude/worktrees/scratch',
  'HEAD b2d2f1fe8e72b00436360693bb34c814bfce92d0',
  'detached',
  'locked',
  '',
].join('\n');

describe('the porcelain', () => {
  it('reads each tree with its branch, its head and its lock, the main checkout first', () => {
    expect(parseWorktrees(PORCELAIN)).toEqual([
      { path: 'C:/product-ops-base', head: 'bd69959d3553ed5563767c2514b01a2f075ca8f3', branch: 'main', locked: null },
      {
        path: 'C:/product-ops-base/.claude/worktrees/appshell-bands',
        head: 'f13e2890c4a99fc72a3dd65c57ee3a2f8729af03',
        branch: 'feat/appshell-bands',
        locked: 'claude session appshell-bands (pid 4688)',
      },
      { path: 'C:/product-ops-base/.claude/worktrees/scratch', head: 'b2d2f1fe8e72b00436360693bb34c814bfce92d0', branch: null, locked: '' },
    ]);
  });

  it('reads CRLF output the same', () => {
    expect(parseWorktrees(PORCELAIN.replace(/\n/g, '\r\n'))).toEqual(parseWorktrees(PORCELAIN));
  });
});

describe('the session registry', () => {
  let dir = '';
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sessions-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const entry = (pid, name) => ({
    pid,
    sessionId: `id-${pid}`,
    cwd: 'C:\\repo',
    name,
    status: 'busy',
    updatedAt: 1000 + pid,
    formerNames: [{ name: 'Old name', until: 1, sessionId: 'id-old' }],
    messagingSocketPath: '\\\\.\\pipe\\never-printed',
    bridgeSessionId: 'never-printed',
  });

  it("reads a live pid's file for its pid, id, cwd, name, status and updatedAt, and nothing else", () => {
    writeFileSync(join(dir, '11.json'), JSON.stringify(entry(11, 'Map')));
    expect(readSessions(dir, () => true)).toEqual({
      files: 1,
      sessions: [{ pid: 11, id: 'id-11', cwd: 'C:\\repo', name: 'Map', status: 'busy', updatedAt: 1011 }],
    });
  });

  it('ignores a dead pid and a half-written file, and never opens a .key', () => {
    writeFileSync(join(dir, '11.json'), JSON.stringify(entry(11, 'Map')));
    writeFileSync(join(dir, '22.json'), JSON.stringify(entry(22, 'Closed')));
    writeFileSync(join(dir, '33.json'), '{"pid":33,"cwd":"C:\\\\re');
    writeFileSync(join(dir, '44.0a1b2c.key'), JSON.stringify(entry(44, 'Key')));
    const asked = [];
    const isAlive = (pid) => {
      asked.push(pid);
      return pid !== 22;
    };
    const read = readSessions(dir, isAlive);
    expect(read.files).toBe(3);
    expect(read.sessions.map((s) => s.name)).toEqual(['Map']);
    expect(asked.sort((a, b) => a - b)).toEqual([11, 22, 33]);
  });

  it('reads a missing registry as null, never as no sessions', () => {
    expect(readSessions(join(dir, 'never-made'))).toBe(null);
  });
});

describe('sessions', () => {
  it('places a session in the tree its cwd falls in; in a worktree that is gone it is stray, in another repository not shown', () => {
    const trees = [{ path: 'C:/repo' }, { path: 'C:/repo/.claude/worktrees/bands' }];
    const [inMain, inBands, inGone, elsewhere] = ['c:\\repo\\src', 'C:\\repo\\.claude\\worktrees\\bands', 'C:/repo/.claude/worktrees/closed', 'C:/other'].map((cwd) => ({ cwd }));
    const { placed, stray } = placeSessions([inMain, inBands, inGone, elsewhere], trees);
    expect([...placed]).toEqual([
      [trees[0], [inMain]],
      [trees[1], [inBands]],
    ]);
    expect(stray).toEqual([inGone]);
  });

  it('places a path in the longest tree it sits under, and nowhere on a shared prefix', () => {
    const trees = [{ path: 'C:/repo' }, { path: 'C:/repo/.claude/worktrees/bands' }];
    expect(treeOf('c:\\repo\\.claude\\worktrees\\bands\\src', trees)).toBe(trees[1]);
    expect(treeOf('C:\\repo', trees)).toBe(trees[0]);
    expect(treeOf('C:/repo/.claude/worktrees/bands-2', trees)).toBe(trees[0]);
    expect(treeOf('C:/other', trees)).toBe(null);
  });
});

describe('waits', () => {
  const now = Date.parse('2026-09-28T21:30:00.000Z');
  const tree = { path: 'C:/repo/.claude/worktrees/bands', branch: 'feat/bands' };
  const onBranch = { pid: 11, as: 'Map', conditions: { gone: ['feat/bands'], clean: null, port: null, main: null }, since: '2026-09-28T21:18:00.000Z' };
  const onTree = { pid: 12, as: null, conditions: { gone: [], clean: 'c:\\repo\\.claude\\worktrees\\bands', port: null, main: null }, since: 'garbled' };
  const elsewhere = { pid: 13, as: 'Free', conditions: { gone: ['feat/other'], clean: null, port: 5173, main: 'a97f6ee' }, since: '2026-09-28T21:00:00.000Z' };

  it('finds the waits on a tree by its branch going or by the tree coming clean', () => {
    expect(waitsOn(tree, [onBranch, onTree, elsewhere])).toEqual([onBranch, onTree]);
  });

  it('says who waits, on what, for how long', () => {
    expect(describeWait(onBranch, now)).toBe('Map (--gone feat/bands, 12 min)');
    expect(describeWait(onTree, now)).toBe('pid 12 (--clean bands, since ?)');
    expect(describeWait(elsewhere, now)).toBe('Free (--gone feat/other --port 5173 --main, 30 min)');
  });
});

describe('the short board', () => {
  const now = 10 * 60000;
  const FIRST = 'Peers on this machine — `pnpm peers` before touching a shared file or picking up a handoff; waiting on or messaging one is in docs/foundation/peers.md:';
  const session = (pid, id, name, minutesAgo, status = 'busy') => ({ pid, id, name, status, cwd: 'C:/repo', updatedAt: now - minutesAgo * 60000 });
  const registry = { files: 3, live: 3, here: 3 };
  const main = (sessions) => ({ path: 'C:/repo', branch: 'main', main: true, dirty: 0, sessions, waits: [] });
  const bands = { path: 'C:/repo/.claude/worktrees/bands', branch: 'feat/bands', main: false, dirty: 2, sessions: [session(2, 'm1', 'Map', 1)], waits: [{ pid: 7, as: 'Free' }] };

  it('prints nothing when the only tree is the main checkout and the only session is this one, known by its id', () => {
    const board = { now, registry, trees: [main([session(1, 'self', 'Free', 0)])] };
    expect(shortBoard(board, { id: 'self', pid: 999, cwd: 'C:/repo' })).toEqual([]);
  });

  it('knows itself by its pid too, when the registry still holds the id it had before a /clear', () => {
    const board = { now, registry, trees: [main([session(1, 'before-clear', 'Free', 0)])] };
    expect(shortBoard(board, { id: 'after-clear', pid: 1, cwd: 'C:/repo' })).toEqual([]);
  });

  it('prints nothing inside a worktree when no other tree and no other session exist', () => {
    const alone = { ...bands, sessions: [session(2, 'self', 'Map', 0)], waits: [] };
    const board = { now, registry, trees: [main([]), alone] };
    expect(shortBoard(board, { id: 'self', pid: 2, cwd: 'C:/repo/.claude/worktrees/bands' })).toEqual([]);
  });

  it('prints one line per tree beside another tree, with its dirty count, its sessions and who waits on it', () => {
    const board = { now, registry, trees: [main([session(1, 'self', 'Free', 0), session(3, 'b', 'Button size', 120, 'idle')]), bands] };
    expect(shortBoard(board, { id: 'self', pid: 1, cwd: 'C:/repo' })).toEqual([
      FIRST,
      '  main checkout (here): main — Button size (idle, 120 min)',
      '  bands: feat/bands, 2 dirty — Map (busy, 1 min); waited on by Free',
    ]);
  });

  it('prints beside another session in the same tree, with no other tree', () => {
    const board = { now, registry, trees: [main([session(1, 'self', 'Free', 0), session(3, 'other', 'Map', 3)])] };
    expect(shortBoard(board, { id: 'self', pid: 1, cwd: 'C:/repo' })).toEqual([FIRST, '  main checkout (here): main — Map (busy, 3 min)']);
  });

  it('shows its trees without sessions, and says so in one line, when the registry is unread', () => {
    const board = { now, registry: null, trees: [main([]), { ...bands, sessions: [] }] };
    expect(shortBoard(board, { id: 'self', pid: 1, cwd: 'C:/repo' })).toEqual([
      FIRST,
      '  main checkout (here): main',
      '  bands: feat/bands, 2 dirty; waited on by Free',
      '  sessions unread — the registry, ~/.claude/sessions, is missing or unreadable.',
    ]);
  });
});

describe('what serves', () => {
  it('names a server by the package its command runs, else by its process', () => {
    expect(labelOf('node C:\\r\\node_modules\\.bin\\..\\vite\\bin\\vite.js --port 5174', 'node.exe')).toBe('vite');
    expect(labelOf('node C:\\r\\node_modules\\storybook\\bin\\index.cjs dev -p 6006', 'node.exe')).toBe('storybook');
    expect(labelOf('node C:\\r\\node_modules\\vitest\\vitest.mjs --ui', 'node.exe')).toBe('node');
    expect(labelOf('"C:\\chrome.exe" --headless', 'chrome.exe')).toBe('chrome');
  });
});
