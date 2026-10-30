#!/usr/bin/env node
'use strict';
/*
 * PostToolUse notice (Edit|Write): fires once per file, on the third edit of it
 * in a session, and says that the review now owes a removal.
 *
 * WHY A HOOK AND NOT A SKILL. `diff-review` carries the procedure, and nothing
 * calls it. Measured 2026-09-10 across 82 sessions: skills are 0,6 per cent of
 * tool calls, and one skill was invoked ZERO times while 3.303
 * calls were made into the surface it covered. A rule that depends on the model
 * is a rule that does not fire. This is deterministic.
 *
 * WHY THE THIRD EDIT. The accretion is measured and it does not converge: 90,5
 * per cent of edits lengthen a file by an average of 731 characters, removals
 * average 135, and the twelfth pass over a file adds as much as the first. The
 * first two edits of a file are ordinary work. By the third, a pass is revising
 * something already revised, which is where the growth compounds unnoticed.
 *
 * WHY ONCE PER FILE. `additionalContext` enters the conversation and is then
 * re-read on every later call of the session, so a notice that fired on every
 * edit past the third would itself be accretion — this file's own subject,
 * committed by the thing meant to stop it.
 *
 * Fails OPEN on anything unexpected. A bug here must never be able to block an
 * edit; the worst it may do is stay quiet.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { sweepOnce } = require('./hook-store-sweep.cjs');

const ROUND = 3;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  try {
    const data = raw ? JSON.parse(raw) : {};
    const input = data.tool_input || {};
    const target = input.file_path || input.notebook_path;
    if (!target || typeof target !== 'string') return quiet();

    const session = String(data.session_id || 'no-session').replace(/[^A-Za-z0-9_-]/g, '');
    const key = path.resolve(target).replace(/\\/g, '/').toLowerCase();
    const store = path.join(os.tmpdir(), `claude-edit-rounds-${session}.json`);

    let counts = {};
    try {
      counts = JSON.parse(fs.readFileSync(store, 'utf8'));
    } catch {
      /* first edit of the session, or a store we cannot read: start clean */
    }

    counts[key] = (counts[key] || 0) + 1;
    const n = counts[key];
    try {
      sweepOnce(store, 'claude-edit-rounds-');
      fs.writeFileSync(store, JSON.stringify(counts));
    } catch {
      /* if the store cannot be written the notice simply never fires */
    }

    if (n !== ROUND) return quiet();

    const name = path.basename(target);
    say(
      `This is edit ${ROUND} of ${name} in this session, so you are revising something ` +
        `already revised. Measured in this repository across 3.765 edits: 90,5 per cent ` +
        `lengthen the file by an average of 731 characters, removals average 135, and the ` +
        `twelfth pass adds as much as the first — the review never starts taking things out ` +
        `because "what is missing?" can only be answered by adding. From this pass on, name ` +
        `something that comes OUT of ${name}, or write the sentence saying you looked and ` +
        `found none. The procedure is the diff-review skill.`,
    );
  } catch {
    quiet();
  }
});

function say(text) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text },
      suppressOutput: true,
    }),
  );
}

function quiet() {
  process.stdout.write('');
}
