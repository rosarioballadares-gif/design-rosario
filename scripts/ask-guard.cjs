#!/usr/bin/env node
'use strict';
/*
 * Stop guard: sends a turn that ends on a question in prose, or on a brief,
 * back to ask through the question UI.
 *
 * WHY. CLAUDE.md says a real fork goes through the structured question UI and
 * that the intake gate asks there, and prose does not fire: a session on
 * 2026-10-09 closed two turns on prose questions with that rule in context.
 *
 * WHY A HOOK, AND WHY Stop. The rule breaks at the moment a turn ends, and
 * Stop is the one event there. `{"decision":"block"}` makes the agent carry
 * on with the reason as its instruction.
 *
 * WHAT IT BLOCKS. A turn whose closing text — what follows its last tool call
 * — either carries four or more of the brief's field names at the start of a
 * line, or ends on a paragraph with `?` or `¿` outside code, links and quotes.
 * An `AskUserQuestion` earlier in the turn does not excuse it: the turn that
 * closed on "¿Preparo el borrador del brief?" had asked one before the push.
 *
 * ONCE. `stop_hook_active` is set when the agent is already continuing
 * because of a Stop hook, and then this passes, so it nudges and never loops.
 *
 * What this cannot see: an ask with no question mark ("tell me which"), a
 * brief shown translated, and whether the question was a real fork — a
 * default the agent would recommend anyway is declared, and that judgement
 * stays the agent's.
 *
 * Fails OPEN on anything unexpected. A bug here must never be able to hold a
 * session; the worst it may do is stay quiet.
 *
 * Brief: briefs/2026-10-09-ask-guard.md
 */
const fs = require('node:fs');

const FIELDS = ['Objective', 'Differentiator', 'Context', 'Dependencies', 'Scope', 'Tasks', 'Autonomy', 'Validation'];
const FIELD_AT_LINE_START = new RegExp(`^[\\s>#*_-]*(${FIELDS.join('|')})\\b`, 'gm');

const QUESTION =
  'This turn ends on a question in prose, after its last tool call. A real fork goes through the ' +
  "structured question UI, recommended option first (CLAUDE.md, 'How to ask'): ask it there now. If it is " +
  'a default you would recommend anyway, declare it instead and end without the question.';
const BRIEF =
  'This turn ends on a brief, after its last tool call. The intake gate asks Reformulate, Go, ' +
  "Go + worktree or Go autopilot through the question UI, and nothing is edited before the answer (CLAUDE.md, 'Task intake gate'): ask it now.";

/** A person's message, or a notification the agent answers: where a turn starts. */
function isPrompt(entry) {
  if (entry.type !== 'user' || entry.isMeta || !entry.message) return false;
  const content = entry.message.content;
  if (typeof content === 'string') return true;
  return Array.isArray(content) && content.some((b) => b.type === 'text') && !content.some((b) => b.type === 'tool_result');
}

/** The entries of the last turn, read backwards from the end of the transcript's lines. */
function turnFrom(lines) {
  const turn = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    let entry;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (!entry || entry.isSidechain) continue;
    if (isPrompt(entry)) break;
    turn.unshift(entry);
  }
  return turn;
}

/** What a person reads as the text: code, links and quotes taken out. */
function prose(text) {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .split('\n')
    .filter((line) => !/^\s*>/.test(line))
    .join('\n');
}

function endsOnQuestion(text) {
  const paragraphs = prose(text)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return /[?¿]/.test(paragraphs[paragraphs.length - 1] ?? '');
}

function isBrief(text) {
  const found = new Set([...text.replace(/```[\s\S]*?```/g, '').matchAll(FIELD_AT_LINE_START)].map((m) => m[1]));
  return found.size >= 4;
}

/** The whole decision over one turn. Returns the block reason, or `null` to let it stop. */
function judge(turn) {
  const blocks = turn
    .filter((e) => e.type === 'assistant' && e.message && Array.isArray(e.message.content))
    .flatMap((e) => e.message.content);
  const lastCall = blocks.map((b) => b.type).lastIndexOf('tool_use');
  const closing = blocks
    .slice(lastCall + 1)
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n\n');
  if (isBrief(closing)) return BRIEF;
  if (endsOnQuestion(closing)) return QUESTION;
  return null;
}

/** The hook from its input to what it prints: '' lets the stop through. */
function respond(data, read) {
  try {
    if (!data || data.hook_event_name !== 'Stop' || data.stop_hook_active) return '';
    const reason = judge(turnFrom(read(data.transcript_path).split('\n')));
    return reason ? JSON.stringify({ decision: 'block', reason }) : '';
  } catch {
    return '';
  }
}

module.exports = { QUESTION, BRIEF, turnFrom, judge, respond };

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    try {
      process.stdout.write(respond(raw ? JSON.parse(raw) : {}, (p) => fs.readFileSync(p, 'utf8')));
    } catch {
      // fail open
    }
  });
}
