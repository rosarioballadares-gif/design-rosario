#!/usr/bin/env node
'use strict';
/*
 * PreToolUse guard (Edit|Write|NotebookEdit|MultiEdit): from inside a
 * worktree, refuses an edit whose target is the main checkout or another
 * worktree. The rule is `worktree-edit-rules.cjs`.
 *
 * It lives in the tracked `.claude/settings.json`, so a worktree carries it in
 * its own checkout and it fires there — the one place it is for.
 *
 * Fails OPEN on anything unexpected: a bug here must never be able to block
 * an edit; the worst it may do is stay quiet.
 *
 * Brief: briefs/2026-10-08-user-hooks.md
 */
const { refusal } = require('./worktree-edit-rules.cjs');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  try {
    const data = raw ? JSON.parse(raw) : {};
    const input = data.tool_input || {};
    const reason = refusal(data.cwd || process.cwd(), input.file_path || input.notebook_path || input.path);
    if (reason) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
        }),
      );
    }
  } catch {
    /* fail open */
  }
  process.exit(0);
});
