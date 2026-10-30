/**
 * The Bash round-trip notice, held to the two things that can go wrong with it.
 *
 * A notice that fires on a map-then-read is worse than no notice at all: three
 * calls over one file are one question being answered, and a hook that calls
 * that waste teaches the session to stop reading hooks. A notice that fires
 * never is the sentence in `CLAUDE.md` this hook exists to replace — the same
 * file whose "instead of / write" table was ignored for weeks. Both failures are
 * silent, so both are pinned here rather than left to a reading of the files.
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ROUND, isBatched, isReadShaped, notice, pathsIn, shouldNotice, start, step } from './bash-round-rules.cjs';

const HOOK = fileURLToPath(new URL('./bash-round-notice.cjs', import.meta.url));

/** Run a whole session of commands through the rule, and return the streaks. */
function streaks(commands) {
  let state = start();
  return commands.map((command) => {
    state = step(state, command);
    return state.n;
  });
}

/** Feed one command to the hook process as a PostToolUse payload. */
function fire(session, command) {
  const payload = JSON.stringify({
    tool_name: 'Bash',
    session_id: session,
    tool_input: { command },
  });
  return execFileSync(process.execPath, [HOOK], { input: payload, encoding: 'utf8' });
}

describe('when the notice speaks', () => {
  it('says nothing on two independent reads, because two is ordinary work', () => {
    expect(streaks(['cat src/a.ts', 'cat src/b.ts'])).toEqual([1, 2]);
    expect(shouldNotice({ n: 2, paths: [] })).toBe(false);
  });

  it('speaks on the third, which is the threshold edit-round-notice already chose', () => {
    const seen = streaks(['cat src/a.ts', 'grep -n x src/b.ts', 'wc -l src/c.ts']);
    expect(seen).toEqual([1, 2, 3]);
    expect(ROUND).toBe(3);
    expect(shouldNotice({ n: ROUND, paths: [] })).toBe(true);
  });

  it('speaks on exactly one call of the run, never on the one after it', () => {
    expect(shouldNotice({ n: ROUND + 1, paths: [] })).toBe(false);
  });

  it('refuses a state that is not a whole count, because the store can be corrupt', () => {
    expect(shouldNotice(null)).toBe(false);
    expect(shouldNotice({ n: '3' })).toBe(false);
    expect(shouldNotice({ n: Number.NaN })).toBe(false);
  });
});

describe('what must stay silent', () => {
  it('never reaches the threshold on three calls over the SAME path — a map, then a read', () => {
    const seen = streaks([
      "grep -n '^## ' docs/README.md",
      "sed -n '1,40p' docs/README.md",
      "tail -5 docs/README.md",
    ]);
    expect(seen).toEqual([1, 1, 1]);
    expect(seen.some((n) => n >= ROUND)).toBe(false);
  });

  it('restarts rather than freezes, so the dependent call can still open its own run', () => {
    // a.ts, a.ts, b.ts, c.ts: the shared pair restarts the count at the second
    // call, so the run that follows it is three long and DOES speak.
    expect(streaks(['cat src/a.ts', 'wc -l src/a.ts', 'cat src/b.ts', 'cat src/c.ts'])).toEqual([
      1, 1, 2, 3,
    ]);
  });

  it('stays quiet on a command that names no path, because it decides nothing', () => {
    // 38,4 per cent of the measured pairs name no path at all.
    expect(streaks(['cat src/a.ts', 'git log --oneline -10', 'cat src/b.ts'])).toEqual([1, 0, 1]);
  });

  it('stays quiet on anything that is not a read — a build owns its turn', () => {
    expect(isReadShaped('pnpm build')).toBe(false);
    expect(isReadShaped('git commit -F msg.txt')).toBe(false);
    expect(isReadShaped('node scripts/latency.mjs')).toBe(false);
    expect(isReadShaped('git diff --stat')).toBe(true);
    expect(isReadShaped('grep -c "" scripts/a.mjs')).toBe(true);
  });

  it('treats an already-batched command as the behaviour it is asking for', () => {
    expect(isBatched('cat a.ts; cat b.ts')).toBe(true);
    expect(isBatched('cd src && cat a.ts')).toBe(false);
    expect(isBatched('grep -n x a.ts | head -5')).toBe(false);
    expect(streaks(['cat src/a.ts', 'cat src/b.ts', 'cat src/c.ts; cat src/d.ts'])).toEqual([
      1, 2, 0,
    ]);
  });
});

describe('the paths a command names', () => {
  it('reads a path by its separator or its extension, and ignores flags', () => {
    expect(pathsIn('grep -n export scripts/latency-rules.mjs')).toEqual([
      'scripts/latency-rules.mjs',
    ]);
    expect(pathsIn('wc -l package.json')).toEqual(['package.json']);
  });

  it('does not mistake a quoted PATTERN for a path', () => {
    // The one that would fire on innocent work: `a/b` is the search term.
    expect(pathsIn("grep -rn 'a/b' src/charts")).toEqual(['src/charts']);
  });

  it('ignores a glob, which names a set rather than a file', () => {
    expect(pathsIn('ls scripts/*.spec.mjs')).toEqual([]);
  });

  it('compares two spellings of one file as one file', () => {
    const [windows] = pathsIn('cat Scripts\\Latency.mjs');
    const [posix] = pathsIn('cat scripts/latency.mjs');
    expect(windows).toBe(posix);
  });
});

describe('the hook process itself', () => {
  it('says nothing on the first two calls and speaks on the third', () => {
    const session = randomUUID();
    expect(fire(session, 'cat src/a.ts')).toBe('');
    expect(fire(session, 'cat src/b.ts')).toBe('');
    const third = JSON.parse(fire(session, 'cat src/c.ts'));
    expect(third.hookSpecificOutput.additionalContext).toContain('Three Bash calls');
  });

  it('says nothing at all across a run of three over one file', () => {
    const session = randomUUID();
    expect(fire(session, "grep -n '^## ' docs/README.md")).toBe('');
    expect(fire(session, "sed -n '1,40p' docs/README.md")).toBe('');
    expect(fire(session, 'tail -5 docs/README.md')).toBe('');
  });

  it('speaks once per session and then stays quiet, which is what stops accretion', () => {
    const session = randomUUID();
    fire(session, 'cat src/a.ts');
    fire(session, 'cat src/b.ts');
    expect(fire(session, 'cat src/c.ts')).not.toBe('');
    expect(fire(session, 'cat src/d.ts')).toBe('');
    expect(fire(session, 'cat src/e.ts')).toBe('');
    expect(fire(session, 'cat src/f.ts')).toBe('');
  });

  it('stays quiet, rather than failing, on a payload it cannot read', () => {
    expect(execFileSync(process.execPath, [HOOK], { input: 'not json', encoding: 'utf8' })).toBe('');
    expect(fire(randomUUID(), '')).toBe('');
  });
});

describe('what the notice says', () => {
  it('names the action rather than only the problem', () => {
    expect(notice()).toContain('ONE message');
  });

  it('stays short, because it is re-read on every call after it lands', () => {
    expect(notice().length).toBeLessThan(400);
  });
});
