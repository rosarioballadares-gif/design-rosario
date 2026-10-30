/**
 * Holds `backlog-rules.mjs` to what it claims.
 *
 * The two behaviours that stop a silent pass — the scope gate and the
 * fence guard — are checked by asserting they FIRE, not by asserting a clean
 * run, because both of them fail in the direction that looks like success.
 */
import { describe, expect, it } from 'vitest';
import {
  CANNOT_SEE,
  NO_OWNER,
  STATUSES,
  STATUS_MEANING,
  findingsFor,
  parseBacklog,
  scopeFailure,
  tally,
} from './backlog-rules.mjs';

const doc = (body) => `# Backlog\n\n## 1 · A section\n\n${body}\n`;
const item = (title, lines) => `### ${title}\n\nSome prose about it.\n\n${lines}\n`;

describe('parseBacklog', () => {
  it('reads an item, its section, its state and its owner', () => {
    const [parsed] = parseBacklog(
      doc(item('A finding', '> STATUS: open\n> OWNER: Christine Moreau')),
    );
    expect(parsed.title).toBe('A finding');
    expect(parsed.section).toBe('1 · A section');
    expect(parsed.status).toBe('open');
    expect(parsed.owner).toBe('Christine Moreau');
  });

  it('keeps the reason that follows the state on the same line', () => {
    const [parsed] = parseBacklog(
      doc(item('X', '> STATUS: dropped the chart library replaced it\n> OWNER: nobody')),
    );
    expect(parsed.status).toBe('dropped');
    expect(parsed.statusReason).toBe('the chart library replaced it');
  });

  it('does NOT read a marker inside a fenced block', () => {
    // This file and the rules module both contain documented examples of a
    // marker. Without the fence guard every example would parse as a real
    // state, which is the exact failure brief-fields.mjs has a guard for.
    const [parsed] = parseBacklog(
      doc(item('X', '```\n> STATUS: landed\n> OWNER: Nobody Real\n```')),
    );
    expect(parsed.status).toBeNull();
    expect(parsed.owner).toBeNull();
  });

  it('closes a fence only on the marker that opened it', () => {
    const [parsed] = parseBacklog(doc(item('X', '```\n~~~\n> STATUS: landed\n```\n> STATUS: open\n> OWNER: nobody')));
    expect(parsed.status).toBe('open');
  });

  it('separates two items and does not leak one body into the other', () => {
    const parsed = parseBacklog(
      doc(`${item('First', '> STATUS: open\n> OWNER: Ian Rueff')}\n${item('Second', '> OWNER: nobody')}`),
    );
    expect(parsed).toHaveLength(2);
    expect(parsed[0].status).toBe('open');
    expect(parsed[1].status).toBeNull();
    expect(parsed[1].owner).toBe(NO_OWNER);
  });

  it('survives an empty document without throwing', () => {
    expect(parseBacklog('')).toEqual([]);
    expect(parseBacklog(undefined)).toEqual([]);
  });
});

describe('findingsFor', () => {
  const parsed = (lines) => parseBacklog(doc(item('X', lines)))[0];

  it('passes an item with a state and an owner', () => {
    expect(findingsFor(parsed('> STATUS: open\n> OWNER: Ian Rueff'))).toEqual([]);
  });

  it('fires on a missing state, because a state nobody typed is not a state', () => {
    expect(findingsFor(parsed('> OWNER: Ian Rueff')).map((f) => f.code)).toEqual(['no-status']);
  });

  it('fires on a state that is not one of the five', () => {
    expect(findingsFor(parsed('> STATUS: maybe\n> OWNER: Ian Rueff')).map((f) => f.code)).toEqual([
      'bad-status',
    ]);
  });

  it('demands a reason for dropped and for blocked, and only for those two', () => {
    // Both are decisions that close something off, and a closed door with no
    // note on it gets opened again by the next person.
    expect(findingsFor(parsed('> STATUS: dropped\n> OWNER: nobody')).map((f) => f.code)).toEqual([
      'no-reason',
    ]);
    expect(findingsFor(parsed('> STATUS: blocked\n> OWNER: nobody')).map((f) => f.code)).toEqual([
      'no-reason',
    ]);
    expect(findingsFor(parsed('> STATUS: landed\n> OWNER: nobody'))).toEqual([]);
    expect(findingsFor(parsed('> STATUS: open\n> OWNER: nobody'))).toEqual([]);
  });

  it('treats a blank owner as a finding and "nobody" as an answer', () => {
    expect(findingsFor(parsed('> STATUS: open')).map((f) => f.code)).toEqual(['no-owner']);
    expect(findingsFor(parsed('> STATUS: open\n> OWNER: nobody'))).toEqual([]);
  });

  it('catches an owner who is not in the roster', () => {
    // A misspelled name is an owner no filter will ever find, which makes the
    // item invisible to the person it belongs to while looking assigned.
    const roster = ['Ian Rueff', 'Christine Moreau'];
    expect(findingsFor(parsed('> STATUS: open\n> OWNER: Ian Ruef'), roster).map((f) => f.code)).toEqual([
      'unknown-owner',
    ]);
    expect(findingsFor(parsed('> STATUS: open\n> OWNER: Ian Rueff'), roster)).toEqual([]);
    expect(findingsFor(parsed('> STATUS: open\n> OWNER: nobody'), roster)).toEqual([]);
  });

  it('does not check the roster when there is none', () => {
    expect(findingsFor(parsed('> STATUS: open\n> OWNER: Anybody At All'), null)).toEqual([]);
  });
});

describe('the scope gate', () => {
  it('fires when no file was read', () => {
    expect(scopeFailure({ files: 0, items: 0 })).toMatch(/no backlog files/);
  });

  it('fires when files resolved but nothing parsed as an item', () => {
    // Zero items produces zero findings, and zero findings prints as a pass.
    expect(scopeFailure({ files: 3, items: 0 })).toMatch(/not one "### " item/);
  });

  it('passes when both resolved', () => {
    expect(scopeFailure({ files: 3, items: 84 })).toBeNull();
  });

  it('passes an empty backlog whose README was read', () => {
    expect(scopeFailure({ files: 0, items: 0, readme: true })).toBeNull();
  });

  it('fires on an empty argument', () => {
    expect(scopeFailure()).not.toBeNull();
  });
});

describe('the states', () => {
  it('gives every state a meaning, so none is left to be guessed', () => {
    expect(Object.keys(STATUS_MEANING).sort()).toEqual([...STATUSES].sort());
    for (const s of STATUSES) expect(STATUS_MEANING[s].length).toBeGreaterThan(20);
  });

  it('keeps dropped, which is the one that earns its place', () => {
    // Deleting an item nobody will do loses the fact that somebody decided.
    expect(STATUSES).toContain('dropped');
    expect(STATUS_MEANING.dropped).toMatch(/decided/);
  });
});

describe('tally', () => {
  it('counts by state and separates owned from explicitly unowned', () => {
    const items = parseBacklog(
      doc(
        [
          item('a', '> STATUS: open\n> OWNER: Ian Rueff'),
          item('b', '> STATUS: open\n> OWNER: nobody'),
          item('c', '> STATUS: dropped superseded\n> OWNER: nobody'),
        ].join('\n'),
      ),
    );
    const t = tally(items);
    expect(t.total).toBe(3);
    expect(t.open).toBe(2);
    expect(t.dropped).toBe(1);
    expect(t.owned).toBe(1);
    expect(t.unowned).toBe(2);
  });
});

describe('what it cannot see', () => {
  it('says that a parsed state is not a true one', () => {
    const text = CANNOT_SEE.join(' ');
    expect(text).toMatch(/does not say either one is current/);
  });
});
