/**
 * ask-guard's decision, over transcripts built line by line in the shape the
 * runtime writes: one entry per block, a tool result as a user entry.
 *
 * What this cannot see: whether the runtime has flushed the closing text by
 * the time Stop fires. The replay over real transcripts is the brief's.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { QUESTION, BRIEF, turnFrom, judge, respond } = require('./ask-guard.cjs');

const prompt = (text) => JSON.stringify({ type: 'user', message: { role: 'user', content: text } });
const meta = (text) => JSON.stringify({ type: 'user', isMeta: true, message: { content: [{ type: 'text', text }] } });
const said = (text) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } });
const called = (name) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input: {} }] } });
const result = () => JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', content: 'ok' }] } });

const decide = (...lines) => judge(turnFrom(lines));
const stop = (lines, extra = {}) =>
  respond({ hook_event_name: 'Stop', transcript_path: 't.jsonl', ...extra }, () => lines.join('\n'));

describe('a closing question in prose', () => {
  it('is sent back, in Spanish or in English', () => {
    expect(decide(prompt('push it'), called('Bash'), result(), said('Pushed.\n\n¿Preparo el borrador del brief?'))).toBe(QUESTION);
    expect(decide(prompt('go'), said('Done. Shall I deploy too?'))).toBe(QUESTION);
  });

  it('passes when the question went through the UI, and not when a new one follows it', () => {
    expect(decide(prompt('go'), said('Two options.'), called('AskUserQuestion'), result(), said('Going with A.'))).toBeNull();
    expect(decide(prompt('go'), called('AskUserQuestion'), result(), said('Pushed.\n\n¿Preparo el borrador?'))).toBe(QUESTION);
  });

  it('reads only what follows the last tool call, and only its last paragraph', () => {
    expect(decide(prompt('go'), said('Which file was it?'), called('Grep'), result(), said('Found it in route.ts.'))).toBeNull();
    expect(decide(prompt('go'), said('Why did it fail? The cache.\n\nFixed and committed.'))).toBeNull();
  });

  it('ignores a ? inside code, a link or a quote', () => {
    expect(decide(prompt('go'), said('Run `pnpm x --help?` then.'))).toBeNull();
    expect(decide(prompt('go'), said('It is at https://example.com/a?b=c'))).toBeNull();
    expect(decide(prompt('go'), said('Done.\n\n```\nconst a = b ? c : d;\n```'))).toBeNull();
    expect(decide(prompt('go'), said('He said:\n\n> why does it not trigger?'))).toBeNull();
  });
});

describe('a brief shown in the closing text', () => {
  it('is sent back to the intake gate, headings or bold', () => {
    const brief = ['## Objective', 'x', '## Scope', 'y', '## Tasks', 'z', '## Validation', 'w'].join('\n');
    expect(decide(prompt('plan it'), said(brief))).toBe(BRIEF);
    expect(decide(prompt('plan it'), said('> **Objective**: a\n>\n> **Context and rules**: b\n> **Tasks**: c\n> **Autonomy**: d'))).toBe(BRIEF);
  });

  it('passes with three field names, or with the brief asked about', () => {
    expect(decide(prompt('go'), said('Objective met.\nScope held.\nTasks done.'))).toBeNull();
    const brief = ['## Objective', '## Scope', '## Tasks', '## Validation'].join('\n');
    expect(decide(prompt('plan it'), said(brief), called('AskUserQuestion'), result(), said('Approved.'))).toBeNull();
  });
});

describe('the turn', () => {
  it('starts at the last prompt: a skill load and a tool result do not end it', () => {
    expect(decide(prompt('go'), called('AskUserQuestion'), result(), prompt('next'), said('Which one?'))).toBe(QUESTION);
    expect(decide(prompt('go'), called('Skill'), meta('Base directory for this skill'), said('Which one?'))).toBe(QUESTION);
  });
});

describe('the hook', () => {
  it('prints a block on a Stop, and nothing once it is already continuing', () => {
    const lines = [prompt('go'), said('Which one?')];
    expect(JSON.parse(stop(lines))).toEqual({ decision: 'block', reason: QUESTION });
    expect(stop(lines, { stop_hook_active: true })).toBe('');
    expect(respond({ hook_event_name: 'SubagentStop', transcript_path: 't' }, () => lines.join('\n'))).toBe('');
  });

  it('skips a line it cannot parse, and fails open on a transcript it cannot read', () => {
    expect(stop(['{not json', '', said('Which one?')])).not.toBe('');
    expect(stop(['{not json'])).toBe('');
    expect(
      respond({ hook_event_name: 'Stop', transcript_path: 'missing' }, () => {
        throw new Error('ENOENT');
      }),
    ).toBe('');
  });
});
