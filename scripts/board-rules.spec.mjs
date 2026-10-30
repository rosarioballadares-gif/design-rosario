/**
 * Holds `board-rules.mjs` to what it claims.
 *
 * The column is the board's whole verdict, so each column is reached here from
 * the registry and review files that produce it — and a registry whose form is
 * wrong is checked for the problem it reports, since a board that quietly
 * drops a run reads exactly like a machine with no runs.
 */
import { describe, expect, it } from 'vitest';
import {
  COLUMNS,
  LENSES,
  backlogOf,
  byNewest,
  columnOf,
  isBacklogFile,
  parseFrontmatter,
  parseRegistry,
  roundProblems,
  roundsOf,
  tasksOf,
  verdictOf,
} from './board-rules.mjs';

const registry = ({ header = 'brief: briefs/2026-10-08-x.md\nbranch: feat/x\nbase: 88e58f3', steps = '- [ ] 1. Do it', waiting = '' } = {}) =>
  `---\n${header}\n---\n\n# The x run\n\n## Steps\n\n${steps}\n\n## Waiting\n\n${waiting}\n\n## Assumptions\n\nNone.\n`;

const pass = (n) => Object.fromEntries(LENSES.map((l) => [`round-${n}/review-${l}.md`, 'VERDICT: PASS']));

describe('parseFrontmatter', () => {
  it('reads the keys of a file that opens on ---', () => {
    expect(parseFrontmatter('---\nbrief: briefs/a.md\nbranch: feat/a\n---\n# A')).toEqual({ brief: 'briefs/a.md', branch: 'feat/a' });
  });

  it('reads CRLF and a byte order mark', () => {
    expect(parseFrontmatter('﻿---\r\nbranch: feat/a\r\n---\r\n')).toEqual({ branch: 'feat/a' });
  });

  it('is null for a file that does not open on ---, such as a document quoting the form', () => {
    expect(parseFrontmatter('# Autopilot\n\n```\n---\nbrief: briefs/a.md\n---\n```')).toBeNull();
  });
});

describe('tasksOf', () => {
  it('reads done, partial, waiting and pending, and folds an indented line into its item', () => {
    const items = tasksOf([
      '- [x] 1. Rules — ecb6a70',
      '- [ ] 2. Server — partial',
      '- [ ] 3. Page — waiting',
      '- [ ] 4. Docs',
      '  with a second line',
      'Prose that is not an item.',
    ]);
    expect(items.map((i) => i.state)).toEqual(['done', 'partial', 'waiting', 'pending']);
    expect(items[3].text).toBe('4. Docs with a second line');
  });
});

describe('parseRegistry', () => {
  it('reads the title, the steps and the questions', () => {
    const run = parseRegistry(registry({ steps: '- [x] 1. A\n- [ ] 2. B', waiting: '- [x] Which port? — 4380' }));
    expect(run.title).toBe('The x run');
    expect(run.steps).toHaveLength(2);
    expect(run.questions[0].done).toBe(true);
    expect(run.problems).toEqual([]);
  });

  it('reports a missing base, Steps or Waiting instead of dropping the run', () => {
    const text = '---\nbrief: briefs/a.md\nbranch: feat/a\n---\n\n# A\n\nProse only.\n';
    expect(parseRegistry(text).problems).toEqual([
      'No `base:` in the frontmatter',
      'No `## Steps` section',
      'No `## Waiting` section',
    ]);
  });

  it('is null for a file that is not a registry, a PDR frontmatter or a brief with no branch among them', () => {
    expect(parseRegistry('# Notes\n')).toBeNull();
    expect(parseRegistry('---\nid: PDR-0010\ndate: 2026-10-07\n---\n')).toBeNull();
    expect(parseRegistry('---\nbrief: briefs/a.md\n---\n')).toBeNull();
  });
});

describe('verdictOf', () => {
  it('takes exactly the two verdicts, and nothing near them', () => {
    expect(verdictOf('VERDICT: PASS')).toBe('PASS');
    expect(verdictOf('VERDICT: CHANGES\r')).toBe('CHANGES');
    expect(verdictOf('Verdict: pass')).toBeNull();
    expect(verdictOf('VERDICT: PASS, with notes')).toBeNull();
    expect(verdictOf(undefined)).toBeNull();
  });
});

describe('roundsOf', () => {
  it('orders rounds, fills a lens with no file as null and marks a bad first line invalid', () => {
    const rounds = roundsOf({
      'round-2/review-code.md': 'VERDICT: PASS',
      'round-1/review-code.md': 'VERDICT: CHANGES',
      'round-1/review-copy.md': 'VERDICT: PASS',
      'round-1/review-ui.md': '## Findings',
      'round-1/notes.md': 'not a review file',
    });
    expect(rounds.map((r) => r.n)).toEqual([1, 2]);
    expect(rounds[0].verdicts).toEqual({ code: 'CHANGES', copy: 'PASS', ui: 'invalid' });
    expect(rounds[1].verdicts).toEqual({ code: 'PASS', copy: null, ui: null });
  });

  it('shows a lens beyond the three after them', () => {
    const [round] = roundsOf({ ...pass(1), 'round-1/review-security.md': 'VERDICT: PASS' });
    expect(Object.keys(round.verdicts)).toEqual([...LENSES, 'security']);
  });
});

describe('columnOf — one case per column', () => {
  it('has the five columns, in board order', () => {
    expect(COLUMNS.map((c) => c.key)).toEqual(['steps', 'review', 'waiting', 'final', 'merged']);
  });

  it('steps: no round yet', () => {
    expect(columnOf(parseRegistry(registry()))).toBe('steps');
  });

  it('review: a lens still writing in the last round', () => {
    expect(columnOf({ rounds: roundsOf({ 'round-1/review-code.md': 'VERDICT: PASS' }) })).toBe('review');
  });

  it('review: a CHANGES in the last round, even after an earlier one passed some lenses', () => {
    expect(columnOf({ rounds: roundsOf({ ...pass(1), 'round-2/review-ui.md': 'VERDICT: CHANGES' }) })).toBe('review');
  });

  it('waiting: an open question, whatever the rounds say', () => {
    const run = parseRegistry(registry({ waiting: '- [ ] Merge into local main? (blocks step 4)' }));
    expect(columnOf({ ...run, rounds: roundsOf(pass(1)) })).toBe('waiting');
  });

  it('final: the last round all PASS, an earlier CHANGES behind it', () => {
    const rounds = roundsOf({ ...pass(2), 'round-1/review-code.md': 'VERDICT: CHANGES' });
    expect(columnOf({ questions: [{ done: true }], rounds })).toBe('final');
  });

  it('merged: in main, even with a question it never closed', () => {
    expect(columnOf({ merged: true, questions: [{ done: false }] })).toBe('merged');
  });
});

describe('roundProblems', () => {
  it('names a bad first line anywhere, and a missing file only in a closed round', () => {
    const rounds = roundsOf({
      'round-1/review-code.md': 'VERDICT: CHANGES',
      'round-1/review-copy.md': 'nope',
      'round-2/review-code.md': 'VERDICT: PASS',
    });
    expect(roundProblems(rounds)).toEqual([
      'round-1/review-copy.md does not open on a verdict',
      'round-1 has no review-ui.md',
    ]);
  });
});

describe('byNewest', () => {
  it('sorts by the brief date, newest first', () => {
    const runs = [{ brief: 'briefs/2026-10-01-a.md' }, { brief: 'briefs/2026-10-08-b.md' }];
    expect(runs.sort(byNewest).map((r) => r.brief)).toEqual(['briefs/2026-10-08-b.md', 'briefs/2026-10-01-a.md']);
  });
});

describe('isBacklogFile', () => {
  it('takes the files check-backlog reads, in a commit', () => {
    expect(['BACKLOG.md', 'backlog/01-wiring.md', 'backlog/README.md', 'backlog/old/x.md', 'docs/x.md'].filter(isBacklogFile)).toEqual([
      'BACKLOG.md',
      'backlog/01-wiring.md',
    ]);
  });
});

describe('backlogOf', () => {
  const file = (path, title, items) => ({ path, text: `# ${title}\n\nWhat this file holds.\n\n${items}` });
  const item = (title, status, owner = 'Ian Rueff') => `### ${title}\n\n> STATUS: ${status}\n> OWNER: ${owner}\n\nThe body.\n\n`;

  it('draws open and blocked in file order, grouped by the file title, and counts the rest', () => {
    const { items, rest, failure } = backlogOf([
      file('backlog/01-wiring.md', 'Wiring', item('A', 'landed') + item('B', 'open') + item('C', 'blocked — waits on B')),
      file('backlog/02-skills.md', 'Skills', item('D', 'dropped — nobody needs it') + item('E', 'open', 'nobody')),
    ]);
    expect(items.map((i) => [i.group, i.title, i.status])).toEqual([
      ['Wiring', 'B', 'open'],
      ['Wiring', 'C', 'blocked'],
      ['Skills', 'E', 'open'],
    ]);
    expect(rest).toEqual({ landed: 1, dropped: 1 });
    expect(failure).toBeNull();
  });

  it('gives a blocked item its reason without the dash, and nobody as no owner', () => {
    const [blocked, open] = backlogOf([file('backlog/01-wiring.md', 'Wiring', item('C', 'blocked — waits on B') + item('E', 'open', 'nobody'))]).items;
    expect(blocked).toMatchObject({ id: 'backlog/01-wiring.md#C', reason: 'waits on B', owner: 'Ian Rueff' });
    expect(blocked.body).toContain('The body.');
    expect(open).toMatchObject({ reason: '', owner: null });
  });

  it('counts an item with no state, and orders the rest as STATUSES does', () => {
    const { rest } = backlogOf([file('backlog/01-wiring.md', 'Wiring', `### F\n\nNo marker.\n\n${item('G', 'upstream')}${item('H', 'landed')}`)]);
    expect(Object.keys(rest)).toEqual(['landed', 'upstream', 'none']);
  });

  it('falls back to the path for a file with no title', () => {
    expect(backlogOf([{ path: 'BACKLOG.md', text: item('A', 'open') }]).items[0].group).toBe('BACKLOG.md');
  });

  it('fails a backlog that resolved nothing rather than reading it as empty', () => {
    expect(backlogOf([]).failure).toMatch(/^no backlog files were found/);
    expect(backlogOf([file('backlog/01-wiring.md', 'Wiring', 'No items.')]).failure).toMatch(/not one "### " item/);
  });

  it('reads a backlog with its README and no item files as empty', () => {
    expect(backlogOf([], { readme: true })).toEqual({ items: [], rest: {}, failure: null });
  });
});
