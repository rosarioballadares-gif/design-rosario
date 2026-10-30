/**
 * `pnpm wait`, held to the one reading it must never get wrong: a branch
 * deleted without landing must not read as landed. The scratch watch it
 * replaces did exactly that, so the landing is judged here against a real
 * repository rather than a stub of git's answer.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { dirtyOf, exitLine, isLanded, look, parseArgs, parseListening, readWaits, verdict } from './wait.mjs';

describe('the flags', () => {
  it('takes --gone more than once and every other flag once', () => {
    expect(parseArgs(['--gone', 'feat/a', '--gone', 'feat/b', '--as', 'Map']).gone).toEqual(['feat/a', 'feat/b']);
    expect(parseArgs(['--port', '5173', '--port', '6006']).error).toMatch(/twice/);
  });

  it('waits every 30 seconds unless told otherwise', () => {
    expect(parseArgs(['--main']).every).toBe(30);
    expect(parseArgs(['--main', '--every', '5']).every).toBe(5);
  });

  it('refuses a wait with no condition, a port that is not one, and a flag with no value', () => {
    expect(parseArgs(['--as', 'Map']).error).toMatch(/no condition/);
    expect(parseArgs(['--port', '70000']).error).toMatch(/not a port/);
    expect(parseArgs(['--gone']).error).toMatch(/needs a value/);
    expect(parseArgs(['--gone', '--main']).error).toMatch(/needs a value/);
  });
});

describe('what listens', () => {
  it('reads netstat by the remote end, which Windows does not translate', () => {
    const netstat = [
      'Conexiones activas',
      '  Proto  Dirección local          Dirección remota        Estado           PID',
      '  TCP    0.0.0.0:5173           0.0.0.0:0              LISTENING       19824',
      '  TCP    [::]:6006              [::]:0                 LISTENING       10840',
      '  TCP    0.0.0.0:6031           0.0.0.0:0              ABHÖREN         50888',
      '  TCP    127.0.0.1:5173         127.0.0.1:50212        ESTABLISHED     19824',
      '  TCP    127.0.0.1:50212        127.0.0.1:5173         TIME_WAIT       0',
      '  UDP    0.0.0.0:5353           *:*                                    2988',
    ].join('\r\n');
    expect(parseListening(netstat)).toEqual([
      { port: 5173, pid: 19824 },
      { port: 6006, pid: 10840 },
      { port: 6031, pid: 50888 },
    ]);
  });

  it('reads lsof the same way', () => {
    const lsof = [
      'COMMAND   PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME',
      'node    41236  ian   23u  IPv6 0x9f3c2b1a2d4e5f60      0t0  TCP [::1]:5173 (LISTEN)',
      'node    41240  ian   24u  IPv4 0x9f3c2b1a2d4e5f61      0t0  TCP *:6006 (LISTEN)',
    ].join('\n');
    expect(parseListening(lsof)).toEqual([
      { port: 5173, pid: 41236 },
      { port: 6006, pid: 41240 },
    ]);
  });
});

describe('a branch gone, landed or not', () => {
  let dir = '';
  const run = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const commit = (file) => {
    writeFileSync(join(dir, file), `${file}\n`);
    run('add', file);
    run('commit', '-m', file);
    return run('rev-parse', 'HEAD');
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'wait-'));
    run('init', '-b', 'main');
    run('config', 'user.email', 'spec@example.com');
    run('config', 'user.name', 'spec');
    commit('one.txt');
    commit('two.txt');
    run('update-ref', 'refs/remotes/origin/main', 'HEAD');
    run('branch', 'feat/landed', 'HEAD~1');
    run('switch', '-c', 'feat/own');
    commit('three.txt');
    run('switch', 'main');
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const opts = (branch) => ({ gone: [branch], clean: null, port: null, main: false });

  it('reads a deleted branch whose tip is in origin/main as landed', () => {
    const tips = new Map();
    expect(verdict(look(dir, opts('feat/landed'), tips, null))).toBe('waiting');
    run('branch', '-D', 'feat/landed');
    const after = look(dir, opts('feat/landed'), tips, null);
    expect(verdict(after)).toBe('held');
    expect(after[0].text).toMatch(/^feat\/landed landed in origin\/main [0-9a-f]{7}$/);
  });

  it('reads a deleted branch with a commit of its own as gone WITHOUT landing', () => {
    const tips = new Map();
    look(dir, opts('feat/own'), tips, null);
    const tip = tips.get('feat/own');
    run('branch', '-D', 'feat/own');
    const after = look(dir, opts('feat/own'), tips, null);
    expect(verdict(after)).toBe('unlanded');
    expect(after[0].text).toBe(`feat/own gone WITHOUT landing, tip ${tip.slice(0, 7)}`);
    expect(exitLine('unlanded', after, 3)).not.toMatch(/landed in/);
  });

  it('never reads a tip git cannot judge as landed', () => {
    expect(isLanded(dir, '0000000000000000000000000000000000000000')).toBe(false);
    expect(isLanded(dir, 'not-a-sha')).toBe(false);
  });

  it('counts a tree dirty, and reads a folder that is not its own checkout as gone', () => {
    expect(dirtyOf(dir)).toBe(0);
    writeFileSync(join(dir, 'loose.txt'), 'x\n');
    expect(dirtyOf(dir)).toBe(1);
    mkdirSync(join(dir, 'inner'));
    expect(dirtyOf(join(dir, 'inner'))).toBe(null);
    expect(dirtyOf(join(dir, 'missing'))).toBe(null);
  });
});

describe('the registry', () => {
  let dir = '';
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'waits-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('reads a live wait and ignores a dead pid, a half-written file and a stranger', () => {
    const wait = { as: 'Map', conditions: { gone: ['feat/x'], clean: null, port: null, main: null }, since: '2026-09-28T21:00:00.000Z', cwd: 'C:/repo' };
    writeFileSync(join(dir, '111.json'), JSON.stringify(wait));
    writeFileSync(join(dir, '222.json'), JSON.stringify({ ...wait, as: 'Gone' }));
    writeFileSync(join(dir, '333.json'), '{"as": "Hal');
    writeFileSync(join(dir, 'notes.json'), JSON.stringify(wait));
    const isAlive = (pid) => pid !== 222;
    expect(readWaits(dir, isAlive)).toEqual([{ ...wait, pid: 111 }]);
  });

  it('reads no directory as no waits', () => {
    expect(readWaits(join(dir, 'never-made'))).toEqual([]);
  });
});
