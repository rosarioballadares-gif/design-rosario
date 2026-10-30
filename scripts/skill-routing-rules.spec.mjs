/**
 * Holds `skill-routing-rules.mjs` to what it claims.
 *
 * The case this file exists for is the first one: a transcript carries the
 * `Skill` tool DEFINITION in every request, so the cheap reading of "how often
 * did a skill fire" — search for the name — overcounts by the number of calls
 * in the session times the number of times the tool list was sent. Asserting a
 * clean parse would not catch it. Asserting that a definition counts ZERO does.
 */
import { describe, expect, it } from 'vitest';
import {
  belongsToRepo,
  invocationsIn,
  mainCheckout,
  parseSince,
  projectSlug,
  routesOnDescription,
  sessionStart,
  skillState,
  startedAfter,
  typedIn,
} from './skill-routing-rules.mjs';

const assistant = (blocks) => JSON.stringify({ message: { content: blocks } });
const typed = (content) => JSON.stringify({ type: 'user', message: { content } });

describe('invocationsIn', () => {
  it('does not count the tool definition as a call', () => {
    const definition = JSON.stringify({
      message: { content: [] },
      request: { tools: [{ name: 'Skill', description: 'Invoke a skill.' }] },
    });
    expect(invocationsIn(definition)).toEqual([]);
  });

  it('counts a tool_use block, with its caller', () => {
    const line = assistant([
      { type: 'tool_use', name: 'Skill', input: { skill: 'setup' }, caller: { type: 'direct' } },
    ]);
    expect(invocationsIn(line)).toEqual([{ skill: 'setup', caller: 'direct' }]);
  });

  it('reads a directory-scoped name as the same skill', () => {
    const line = assistant([
      {
        type: 'tool_use',
        name: 'Skill',
        input: { skill: '.claude/worktrees/feat+x:diff-review' },
      },
    ]);
    expect(invocationsIn(line)).toEqual([{ skill: 'diff-review', caller: 'unknown' }]);
  });

  it('ignores a tool_use for anything else', () => {
    const line = assistant([{ type: 'tool_use', name: 'Bash', input: { command: 'ls' } }]);
    expect(invocationsIn(line)).toEqual([]);
  });

  it('skips a line that is not JSON rather than throwing', () => {
    expect(invocationsIn('{ half a line')).toEqual([]);
  });
});

describe('typedIn', () => {
  it('reads a slash command a person typed', () => {
    expect(typedIn(typed('<command-name>/setup</command-name>'))).toEqual(['setup']);
  });

  it('reads one typed without the slash', () => {
    expect(typedIn(typed('<command-name>workflow-authoring'))).toEqual(['workflow-authoring']);
  });

  it('does not read the words inside the Skill tool description', () => {
    expect(typedIn(typed('If a `<command-name>` block is already present this turn'))).toEqual([]);
  });

  /* The case this counter exists to get right, and the one it got wrong until
   * 2026-09-14: a transcript carries the text of every file that was read, and
   * the fixtures above live in a file that sessions read. 24 of 29 counted
   * `/setup`s were this. */
  it('does not count a file it read that quotes a typed command', () => {
    const line = JSON.stringify({
      type: 'user',
      message: {
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_x',
            content: "expect(typedIn('<command-name>/setup</command-name>'))",
          },
        ],
      },
    });
    expect(typedIn(line)).toEqual([]);
  });

  it('does not count an assistant turn that names a command', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'run <command-name>/setup</command-name>' }] },
    });
    expect(typedIn(line)).toEqual([]);
  });

  it('does not count an attachment that carries one', () => {
    const line = JSON.stringify({
      type: 'attachment',
      message: { content: '<command-name>/setup</command-name>' },
    });
    expect(typedIn(line)).toEqual([]);
  });

  it('reads a turn assembled out of text blocks', () => {
    expect(typedIn(typed([{ type: 'text', text: '<command-name>/handoff</command-name>' }]))).toEqual(
      ['handoff'],
    );
  });

  it('skips a line that is not JSON rather than throwing', () => {
    expect(typedIn('{ half a line')).toEqual([]);
  });
});

describe('scope', () => {
  it('resolves a worktree to its main checkout', () => {
    expect(mainCheckout('/Users/x/design-ops/.claude/worktrees/feat+y')).toBe('/Users/x/design-ops');
  });

  it('leaves a plain checkout alone', () => {
    expect(mainCheckout('/Users/x/design-ops')).toBe('/Users/x/design-ops');
  });

  it('matches the checkout and its worktrees, and nothing else', () => {
    const slug = projectSlug('/Users/x/design-ops');
    expect(belongsToRepo('-Users-x-design-ops', slug)).toBe(true);
    expect(belongsToRepo('-Users-x-design-ops--claude-worktrees-feat-y', slug)).toBe(true);
    expect(belongsToRepo('-Users-x-other-project', slug)).toBe(false);
  });

  it('refuses a sibling checkout whose name merely starts the same', () => {
    const slug = projectSlug('/Users/x/design-ops');
    expect(belongsToRepo('-Users-x-design-ops-2', slug)).toBe(false);
    expect(belongsToRepo('-Users-x-design-opsx', slug)).toBe(false);
  });
});

describe('skillState', () => {
  it('reads the frontmatter flag over any override', () => {
    expect(skillState('disable-model-invocation: true\n', 'on')).toBe('user-invocable-only');
  });

  it('reads an override when the frontmatter carries no flag', () => {
    expect(skillState('name: voice-audit\n', 'name-only')).toBe('name-only');
  });

  it('defaults to on, which is the state that pays for a description', () => {
    expect(skillState('name: setup\n', undefined)).toBe('on');
    expect(routesOnDescription('on')).toBe(true);
    expect(routesOnDescription('name-only')).toBe(false);
    expect(routesOnDescription('user-invocable-only')).toBe(false);
  });
});

const entry = (fields) => JSON.stringify(fields);

describe('sessionStart', () => {
  it('reads the timestamp of the first entry', () => {
    const text = [
      entry({ type: 'user', timestamp: '2026-09-12T23:35:46.679Z' }),
      entry({ type: 'assistant', timestamp: '2026-09-13T00:10:00.000Z' }),
    ].join('\n');
    expect(sessionStart(text)).toBe('2026-09-12T23:35:46.679Z');
  });

  it('scans past opening records that carry none', () => {
    const text = [
      entry({ type: 'summary', summary: 'a resumed session' }),
      entry({ type: 'file-history-snapshot', messageId: 'x' }),
      '',
      entry({ type: 'user', timestamp: '2026-09-13T00:03:21.333Z' }),
    ].join('\n');
    expect(sessionStart(text)).toBe('2026-09-13T00:03:21.333Z');
  });

  it('returns null rather than guessing when the opening lines carry none', () => {
    expect(sessionStart(entry({ type: 'summary' }))).toBe(null);
    expect(sessionStart('')).toBe(null);
  });

  it('skips a line that is not JSON rather than throwing', () => {
    const text = ['not json at all', entry({ timestamp: '2026-09-01T00:00:00.000Z' })].join('\n');
    expect(sessionStart(text)).toBe('2026-09-01T00:00:00.000Z');
  });

  it('ignores a timestamp that is not a date', () => {
    const text = [entry({ timestamp: 'whenever' }), entry({ timestamp: '2026-09-01T00:00:00.000Z' })].join('\n');
    expect(sessionStart(text)).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('parseSince', () => {
  it('reads an absent flag as no boundary', () => {
    expect(parseSince(undefined)).toEqual({ since: null });
  });

  it('reads an ISO timestamp', () => {
    expect(parseSince('2026-09-12T23:29:52Z').since).toBe(Date.parse('2026-09-12T23:29:52Z'));
  });

  it('refuses a value it cannot read instead of filtering nothing', () => {
    expect(parseSince('yesterday').error).toMatch(/not a date/);
  });

  it('refuses the next flag as its value', () => {
    expect(parseSince('--all').error).toMatch(/none followed/);
    expect(parseSince('').error).toMatch(/none followed/);
  });
});

describe('startedAfter', () => {
  const boundary = Date.parse('2026-09-12T23:29:52Z');

  it('keeps every session when there is no boundary', () => {
    expect(startedAfter('2026-08-29T00:00:00.000Z', null)).toBe(true);
    expect(startedAfter(null, null)).toBe(true);
  });

  it('splits on the boundary', () => {
    expect(startedAfter('2026-09-12T23:35:46.679Z', boundary)).toBe(true);
    expect(startedAfter('2026-09-12T23:08:59.092Z', boundary)).toBe(false);
  });

  it('excludes a session whose start could not be read', () => {
    expect(startedAfter(null, boundary)).toBe(false);
  });
});
