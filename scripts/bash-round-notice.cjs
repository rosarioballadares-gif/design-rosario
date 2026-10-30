#!/usr/bin/env node
'use strict';
/*
 * PostToolUse notice (Bash): fires once in a session, on the third consecutive
 * read that names a different path from the one before it, and says that those
 * turns did not have to be three.
 *
 * WHY A HOOK AND NOT A SENTENCE IN CLAUDE.md. That file already carries an
 * "instead of / write" table telling this repository how to spend Bash, and the
 * cleanest evidence a written rule does not hold is in the same census that
 * produced this hook: `cd` prefixes 38,3 per cent of all Bash calls, which that
 * table forbids in as many words. A rule that depends on the model noticing the
 * moment is a rule that does not fire. This is deterministic.
 *
 * WHY THREE. Copied from `edit-round-notice.cjs` rather than re-derived, chosen
 * by Ian Rueff on 2026-09-11. Two consecutive independent reads are ordinary —
 * a question came up and was answered. By the third the session is working in a
 * rhythm, and the rhythm is the thing worth interrupting.
 *
 * WHY ONCE PER SESSION. `additionalContext` enters the conversation and is then
 * re-read on every later call, so a notice that spoke on every run of three
 * would itself become the waste it describes — `edit-round-notice.cjs` reasons
 * the same way about firing once per file. The lesson does not change on the
 * second telling; if it did not land the first time, a copy of it will not help.
 *
 * WHAT IT DOES NOT SEE. Only Bash reaches it, so a tool call of another kind
 * between two Bash calls leaves the streak intact — which is correct, because
 * those were still two Bash turns.
 *
 * Fails OPEN on anything unexpected. A bug here must never be able to block a
 * tool call; the worst it may do is stay quiet.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { notice, shouldNotice, start, step } = require('./bash-round-rules.cjs');
const { sweepOnce } = require('./hook-store-sweep.cjs');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  try {
    const data = raw ? JSON.parse(raw) : {};
    if (data.tool_name && data.tool_name !== 'Bash') return quiet();

    const command = (data.tool_input || {}).command;
    if (typeof command !== 'string') return quiet();

    const session = String(data.session_id || '').replace(/[^A-Za-z0-9_-]/g, '');
    if (!session) return quiet();
    const store = path.join(os.tmpdir(), `claude-bash-rounds-${session}.json`);

    let state = start();
    let spoken = false;
    try {
      const saved = JSON.parse(fs.readFileSync(store, 'utf8'));
      spoken = Boolean(saved.spoken);
      state = { n: Number(saved.n) || 0, paths: Array.isArray(saved.paths) ? saved.paths : [] };
    } catch {
      /* first Bash call of the session, or a store we cannot read: start clean */
    }

    const next = step(state, command);
    const speaking = !spoken && shouldNotice(next);

    try {
      /* Firing resets the streak as well as latching `spoken`, so nothing is
       * left half-counted if the cap is ever lifted. */
      sweepOnce(store, 'claude-bash-rounds-');
      fs.writeFileSync(
        store,
        JSON.stringify(speaking ? { ...start(), spoken: true } : { ...next, spoken }),
      );
    } catch {
      /* if the store cannot be written the notice simply never fires */
    }

    if (!speaking) return quiet();
    say(notice());
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
