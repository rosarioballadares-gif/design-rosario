#!/usr/bin/env node
'use strict';
/*
 * PreToolUse guard (Edit|Write): refuses a write that grows an agent's memory
 * index past its ceiling.
 *
 * WHY. The index, `~/.claude/projects/<project>/memory/MEMORY.md`, is injected
 * whole on every call, like CLAUDE.md, and nothing measured it; what it
 * reached is in the `why` beside its ceiling. It grows one line at a time, and
 * the line that grows it carries the memory's content instead of the moment to
 * read it.
 *
 * WHY A HOOK AND NOT check:floor. The file lives outside the repository, per
 * person and per machine, so CI never sees it and a gate that failed on it
 * would stop a publish over something no commit changed. The growth happens at
 * the write, so the write is where it is refused.
 *
 * WHAT IT REFUSES. A result over the token ceiling that is bigger than the file
 * it replaces, and a line over the character cap that the file did not already
 * hold. A write that shrinks an index already over its ceiling passes, or the
 * only repair would be refused too.
 *
 * The ceilings are `memoryIndex` in `context-floor.json`, raised the same way
 * as the others there: a number, a date, a sentence.
 *
 * Fails OPEN on anything unexpected. A bug here must never be able to block an
 * edit; the worst it may do is stay quiet.
 */
const fs = require('node:fs');
const path = require('node:path');

/** Must equal CHARS_PER_TOKEN in context-floor.mjs; the spec holds them together. */
const CHARS_PER_TOKEN = 3.7;

const INDEX_PATH = /[\\/]\.claude[\\/]projects[\\/][^\\/]+[\\/]memory[\\/]MEMORY\.md$/i;

function isIndex(filePath) {
  return INDEX_PATH.test(String(filePath || ''));
}

function tokens(text) {
  return Math.round(Buffer.byteLength(text, 'utf8') / CHARS_PER_TOKEN);
}

/**
 * The content the call leaves on disk, or `null` when it cannot be known — an
 * Edit whose old_string is absent fails on its own and is not this guard's.
 */
function resultOf(toolName, input, current) {
  if (toolName === 'Write') return typeof input.content === 'string' ? input.content : null;
  if (toolName !== 'Edit') return null;
  const from = input.old_string;
  const to = input.new_string;
  if (typeof from !== 'string' || typeof to !== 'string' || !from) return null;
  if (!current.includes(from)) return null;
  return input.replace_all ? current.split(from).join(to) : current.replace(from, () => to);
}

/**
 * The whole decision. Returns the refusal reason, or `null` to allow.
 * `current` is the file as it is now, '' when it does not exist yet.
 */
function judge(toolName, input, current, budget) {
  const after = resultOf(toolName, input, current);
  if (after === null) return null;
  const problems = [];

  const was = tokens(current);
  const now = tokens(after);
  if (now > budget.ceiling && now > was) {
    problems.push(`it would weigh ≈ ${now} tokens (was ${was}) against a ceiling of ${budget.ceiling}`);
  }

  const held = new Set(current.split(/\r?\n/));
  const long = after
    .split(/\r?\n/)
    .map((line, i) => ({ line, n: i + 1, chars: [...line].length }))
    .filter((l) => l.chars > budget.lineCap && !held.has(l.line));
  if (long.length) {
    const where = long.slice(0, 3).map((l) => `line ${l.n}: ${l.chars}`).join(', ');
    problems.push(`${long.length} new line(s) over ${budget.lineCap} characters (${where})`);
  }

  if (!problems.length) return null;
  return (
    `The memory index is paid on every call, and this write is refused:${problems.join('; ')}. ` +
    `A line is the title and when to read it; what the memory says goes in its own file. ` +
    `Shorten the line, merge memories, or raise memoryIndex in scripts/context-floor.json ` +
    `with the date and a sentence — the person decides that one.`
  );
}

function readBudget() {
  const json = JSON.parse(fs.readFileSync(path.join(__dirname, 'context-floor.json'), 'utf8'));
  const m = json.memoryIndex;
  if (!m || !(m.ceiling > 0) || !(m.lineCap > 0)) return null;
  return { ceiling: m.ceiling, lineCap: m.lineCap };
}

module.exports = { CHARS_PER_TOKEN, isIndex, tokens, resultOf, judge };

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    try {
      const data = raw ? JSON.parse(raw) : {};
      if (data.hook_event_name !== 'PreToolUse') return;
      const input = data.tool_input || {};
      if (!isIndex(input.file_path)) return;
      const budget = readBudget();
      if (!budget) return;
      const current = fs.existsSync(input.file_path) ? fs.readFileSync(input.file_path, 'utf8') : '';
      const reason = judge(data.tool_name, input, current, budget);
      if (!reason) return;
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: reason,
          },
        }),
      );
    } catch {
      // fail open
    }
  });
}
