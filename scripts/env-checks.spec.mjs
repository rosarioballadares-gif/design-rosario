/**
 * Tests for the environment rules.
 *
 * The checker that uses them needs a network and a credential, so this is the
 * half that can be proven anywhere. It is also the only place two of the four
 * registry answers can be produced at all: a `403` needs a token that is
 * deliberately not SSO-authorized and nobody has one to spare, and a `404`
 * needs a broken scope mapping in a file the repository refuses to break.
 *
 * The `401` fixture is real. It was produced on 2026-08-18 by running
 * `npm view @scope/package version --userconfig <empty file>` on a
 * machine whose token works, which is the only honest way to reach that state.
 * The others are transcribed from npm's documented shape.
 */

import { describe, expect, it } from 'vitest';
import {
  BLOCKING,
  NODE_RANGES,
  PNPM_MINIMUM,
  UNNAMED_ROLE,
  checkNode,
  checkPnpm,
  classifyBrowser,
  classifyRegistry,
  classifyRole,
  findTokenInRepoNpmrc,
  formatReport,
  parseVersion,
  summarise,
} from './env-checks.mjs';

const REAL_401 = `npm error code E401
npm error 401 Unauthorized - GET https://npm.pkg.github.com/@scope%2fpackage - authentication token not provided`;

const SSO_403 = `npm error code E403
npm error 403 Forbidden - GET https://npm.pkg.github.com/@scope%2fpackage - Permission permission_denied: read_package`;

describe('parseVersion', () => {
  it('reads the v prefix node prints', () => {
    expect(parseVersion('v24.13.1')).toEqual({ major: 24, minor: 13, patch: 1 });
  });

  it('reads the bare form pnpm prints', () => {
    expect(parseVersion('10.33.0')).toEqual({ major: 10, minor: 33, patch: 0 });
  });

  it('defaults a missing patch rather than failing', () => {
    expect(parseVersion('22.12')).toEqual({ major: 22, minor: 12, patch: 0 });
  });

  it('returns null when the binary printed nothing — absent is not old', () => {
    expect(parseVersion('')).toBeNull();
    expect(parseVersion(undefined)).toBeNull();
  });
});

describe('checkNode', () => {
  it('accepts what this repository was measured on', () => {
    expect(checkNode('v24.13.1').state).toBe('ok');
  });

  it('accepts each range floor exactly', () => {
    for (const r of NODE_RANGES) {
      expect(checkNode(`v${r.major}.${r.minor}.0`).state).toBe('ok');
    }
  });

  it('rejects 20.x, which Vite takes and style-dictionary does not', () => {
    expect(checkNode('v20.19.0').state).toBe('too-old');
  });

  it('rejects one minor below the 22 floor', () => {
    expect(checkNode('v22.11.0').state).toBe('too-old');
  });

  it('rejects 21.x, below the 22.12 floor', () => {
    const result = checkNode('v21.7.3');
    expect(result.state).toBe('too-old');
    expect(result.detail).toContain('below 22.12');
  });

  it('accepts a major above the floor', () => {
    expect(checkNode('v23.0.0').state).toBe('ok');
  });

  it('reports an absent binary as missing, not as too old', () => {
    expect(checkNode('').state).toBe('missing');
  });
});

describe('checkPnpm', () => {
  it('accepts the measured version', () => {
    expect(checkPnpm('10.33.0').state).toBe('ok');
  });

  it('accepts the floor exactly', () => {
    expect(checkPnpm(`${PNPM_MINIMUM.major}.0.0`).state).toBe('ok');
  });

  it('rejects the major below it', () => {
    expect(checkPnpm('9.15.0').state).toBe('too-old');
  });

  it('points an absent pnpm at corepack', () => {
    expect(checkPnpm('').detail).toContain('corepack');
  });
});

describe('classifyRegistry', () => {
  it('reads the version out of a successful run', () => {
    const result = classifyRegistry({ exitCode: 0, stdout: '1.11.0\n' });
    expect(result.state).toBe('ok');
    expect(result.detail).toContain('1.11.0');
  });

  it('names the token step from the real 401 — the fixture measured on this machine', () => {
    const result = classifyRegistry({ exitCode: 1, stderr: REAL_401 });
    expect(result.state).toBe('blocked');
    expect(result.step).toBe('token');
  });

  it('names the SSO step from a 403, and names membership beside it', () => {
    const result = classifyRegistry({ exitCode: 1, stderr: SSO_403 });
    expect(result.step).toBe('sso');
    expect(result.detail).toContain('organization');
    expect(result.detail).toContain('SSO');
  });

  it('separates the two codes, which is the whole point of this function', () => {
    expect(classifyRegistry({ exitCode: 1, stderr: REAL_401 }).step).not.toBe(
      classifyRegistry({ exitCode: 1, stderr: SSO_403 }).step,
    );
  });

  it('reads a 404 as a scope mapping rather than a missing package', () => {
    const result = classifyRegistry({ exitCode: 1, stderr: 'npm error code E404\nnpm error 404 Not Found' });
    expect(result.step).toBe('scope');
  });

  it('falls back to the bare status when npm printed no code', () => {
    expect(classifyRegistry({ exitCode: 1, stderr: '401 Unauthorized' }).step).toBe('token');
  });

  it('calls an unreachable registry unknown rather than blaming the token', () => {
    const result = classifyRegistry({ exitCode: 1, stderr: 'getaddrinfo ENOTFOUND npm.pkg.github.com' });
    expect(result.state).toBe('unknown');
    expect(result.step).toBe('network');
  });

  it('reports an unrecognised failure without inventing a step', () => {
    const result = classifyRegistry({ exitCode: 7, stderr: 'npm error something new' });
    expect(result.state).toBe('unknown');
    expect(result.step).toBeNull();
    expect(result.detail).toBe('something new');
  });
});

describe('findTokenInRepoNpmrc', () => {
  it('passes the file this repository actually ships', () => {
    expect(findTokenInRepoNpmrc('@scope:registry=https://npm.pkg.github.com\n')).toBeNull();
  });

  it('catches the token somebody pasted in to fix their 401', () => {
    const text = `@scope:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=ghp_realLookingSecret`;
    expect(findTokenInRepoNpmrc(text)?.state).toBe('leak');
  });

  it('ignores a commented-out line, which is documentation and not a credential', () => {
    expect(findTokenInRepoNpmrc('# //npm.pkg.github.com/:_authToken=ghp_x')).toBeNull();
  });

  it('ignores an empty assignment', () => {
    expect(findTokenInRepoNpmrc('//npm.pkg.github.com/:_authToken=')).toBeNull();
  });
});

describe('summarise', () => {
  const ok = { label: 'node', state: 'ok' };
  const blocked = { label: 'registry', state: 'blocked' };
  const leak = { label: 'repo .npmrc', state: 'leak' };
  const todo = { label: 'your profile', state: 'todo' };

  it('exits 0 while somebody is mid-setup, because that is the state it is written for', () => {
    expect(summarise([ok, blocked]).exitCode).toBe(0);
  });

  it('exits 1 on a leaked token even mid-setup', () => {
    expect(summarise([ok, leak]).exitCode).toBe(1);
  });

  it('exits 1 on a blocked row under strict, which is how CI reads it', () => {
    expect(summarise([ok, blocked], { strict: true }).exitCode).toBe(1);
  });

  it('names which rows blocked, so the caller repeats nothing', () => {
    expect(summarise([ok, blocked]).blocked).toEqual(['registry']);
  });

  it('keeps a next step out of blocked — an unwritten profile is not a broken machine', () => {
    const result = summarise([ok, todo]);
    expect(result.blocked).toEqual([]);
    expect(result.next).toEqual(['your profile']);
  });

  it('does not fail CI on a next step either, which is why strict names only blocking states', () => {
    expect(summarise([ok, todo], { strict: true }).exitCode).toBe(0);
  });

  it('leaves BLOCKING as the single list both callers read', () => {
    expect(BLOCKING.has('todo')).toBe(false);
    expect(BLOCKING.has('blocked')).toBe(true);
  });
});

describe('formatReport', () => {
  it('aligns the labels into a column', () => {
    const lines = formatReport([
      { label: 'node', state: 'ok', detail: '24.13.1' },
      { label: 'the registry', state: 'blocked', detail: '401' },
    ]);
    expect(lines[0].indexOf('24.13.1')).toBe(lines[1].indexOf('401'));
  });

  it('stays aligned when a state word is longer than the rest — the defect a fixed width shipped', () => {
    const lines = formatReport([
      { label: 'node', state: 'ok', detail: 'a' },
      { label: 'MCP servers', state: 'skipped', detail: 'b' },
    ]);
    expect(lines[0].indexOf('a')).toBe(lines[1].indexOf('b'));
  });

  it('prints a state word rather than a symbol, so the output survives a pipe', () => {
    expect(formatReport([{ label: 'x', state: 'blocked', detail: '' }])[0]).toContain('BLOCKED');
  });
});

/**
 * The role a profile records, against the list the setup skill offers.
 *
 * The first test is the whole reason this function was split out of
 * `check-env.mjs`. `other` is a member of the offered union, so the membership
 * test that used to decide this returned `ok` for it, and the population that
 * value describes — every manager who answered before the skill named the three
 * manager roles — got a green from the only row that could have told them.
 */
describe('classifyRole', () => {
  const OFFERED = [
    'product-manager',
    'product-designer',
    'research-manager',
    'design-experience-manager',
    'design-system-manager',
    'other',
  ];

  it('does not report ok on "other", even though "other" is offered', () => {
    const row = classifyRole('other', OFFERED);
    expect(OFFERED).toContain('other');
    expect(row.state).toBe('todo');
  });

  it('tells somebody stored as "other" how many named roles there are now', () => {
    const row = classifyRole('other', OFFERED);
    expect(row.detail).toContain('names 5 now');
    expect(row.detail).toContain('rerun /setup');
  });

  it('says "other" can be the right answer, so the row is not read as an error', () => {
    expect(classifyRole('other', OFFERED).detail).toContain('legitimate if none does');
  });

  it('reports ok on a role the skill lists', () => {
    const row = classifyRole('design-system-manager', OFFERED);
    expect(row.state).toBe('ok');
    expect(row.detail).toContain('one of the 6');
  });

  it('reports todo on a slug the skill does not list, and hedges the same way', () => {
    const row = classifyRole('brand-designer', OFFERED);
    expect(row.state).toBe('todo');
    expect(row.detail).toContain('Legitimate if you named it yourself');
  });

  it.each([undefined, null, ''])('reports todo when the profile records %p', (role) => {
    const row = classifyRole(role, OFFERED);
    expect(row.state).toBe('todo');
    expect(row.detail).toContain('records no role');
  });

  // Pins the two branches apart. Merging them back is a one-line edit that
  // reads as a simplification and restores the exact defect above.
  it('gives "other" a different sentence from a listed role', () => {
    expect(classifyRole('other', OFFERED).detail).not.toBe(
      classifyRole('product-manager', OFFERED).detail,
    );
    expect(UNNAMED_ROLE).toBe('other');
  });

  // The count is derived rather than written down, so a sixth named role does
  // not need this rule edited -- the failure the role-list check exists to stop.
  it('counts the named roles rather than carrying a number', () => {
    expect(classifyRole('other', [...OFFERED, 'content-designer']).detail).toContain('names 6 now');
  });

  it('never reports a blocking state, because a role cannot stop the repo running', () => {
    for (const role of ['other', 'product-manager', 'brand-designer', null]) {
      expect(BLOCKING.has(classifyRole(role, OFFERED).state)).toBe(false);
    }
  });
});

describe('classifyBrowser', () => {
  it('names the binary it resolved, so a wrong one is visible', () => {
    const row = classifyBrowser('/tmp/chromium-1243/chrome');
    expect(row.state).toBe('ok');
    expect(row.detail).toContain('/tmp/chromium-1243/chrome');
  });

  it('is todo and not blocking, because not everybody renders a chart', () => {
    const row = classifyBrowser(null);
    expect(row.state).toBe('todo');
    expect(BLOCKING.has(row.state)).toBe(false);
  });

  it('names the command that repairs it', () => {
    expect(classifyBrowser(null).detail).toContain('npx playwright install chromium');
  });
});
