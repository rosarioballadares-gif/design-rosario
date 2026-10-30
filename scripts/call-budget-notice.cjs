#!/usr/bin/env node
'use strict';
/*
 * PostToolUse notice on every tool: counts the calls of a session and says, at
 * 200 and every 100 after it, that a new session is now cheaper than this one.
 *
 * WHY A HOOK AND NOT A SENTENCE IN CLAUDE.md. The recommendation existed and
 * fired nowhere, which is the same failure `edit-round-notice.cjs` was written
 * for: a rule that depends on the model noticing the moment is a rule that does
 * not fire. Nothing in a conversation knows how long it has been running.
 *
 * WHY 200. Measured 2026-09-10 across three projects: cost is quadratic in
 * session length and compaction does NOT rescue it, firing around 650.000 to
 * 833.000 tokens of context after the whole curve has been paid. Splitting one
 * 9.935-call session at 250 would have read 61 per cent less. The mean session
 * in this repository is 352 calls.
 *
 * WHY IT REPEATS EVERY 100 AND THE TEXT IS SHORT. `additionalContext` enters
 * the conversation and is re-read on every later call, so this notice is itself
 * the thing it warns about. One short line at 200, 300, 400 costs less than one
 * long line that scrolls out of mind at 200 and never returns.
 *
 * WHY IT ASKS FOR A PROMPT TO COPY, since 2026-09-19. From 2026-09-14 it named
 * `.claude/skills/handoff/SKILL.md`, a skill the person does not use — what
 * the person does every time this fires is ask for a prompt to paste into the
 * next session, so the notice now names that (Ian Rueff, 2026-09-19). The skill
 * went with this change. Still a REPLACEMENT and not an addition: the paragraph
 * above is a rule about length, and a notice that grows every time somebody has
 * a good idea is the thing it warns about.
 *
 * WHY A SUBAGENT COUNTS ITS OWN, since 2026-09-28. Inside a subagent this hook
 * gets the session's `session_id` and `transcript_path`, so it counted the
 * subagent's calls into the session's store and read the session's context.
 * Measured that day: 34 of 124 subagent transcripts in this repository carried
 * the notice; one with 82 calls of its own read "Call 200 of this session",
 * another with 171 read "Call 1130 ... 367k", the main session's numbers. The
 * input there also carries `agent_id`, which the main session's never does, so
 * a subagent keeps its own store, reads its own transcript and is told to
 * return at a clean point: nobody is there to /clear it. The main session, in
 * turn, now counts only its own calls.
 *
 * WHY A WORKTREE CHANGES THE LAST SENTENCE, since 2026-09-29. A session inside
 * `.claude/worktrees/` holds that worktree's lock until its process ends. That
 * day a session there wrote its prompt and said to go on in a new conversation;
 * the new one got `locked` from EnterWorktree, and the old process, with no
 * visible tab, had to be killed by PID. The first fix, "/clear in this same
 * tab", sat outside the pasted block and did not travel with it: on 2026-09-30 a
 * third session was killed for the lock. So since then the session runs
 * ExitWorktree keep, measured to release the lock, BEFORE it writes the prompt,
 * and the prompt says the worktree is free. It replaces the general sentence.
 *
 * WHY IT NAMES pnpm handoff AND SAYS STOP, since 2026-10-08. That day a session
 * ran to 600k tokens: this fired at 200k and every 100k after, each time asking
 * for a prompt written by hand, and none was ever written. One command costs one
 * call, and "stop" leaves nothing to weigh (Ian Rueff, 2026-10-08). In a
 * worktree it runs BEFORE ExitWorktree keep, which moves the session to the
 * main checkout, where the script would read main instead of the branch.
 *
 * WHY A SUBAGENT NAMES Still open, since 2026-10-16. In checkpoints a partial
 * worker's leftover lived only in its one-line report, so it now goes into the
 * `## Still open` of its stage's doc, committed, where the next worker starts
 * (Ian Rueff, question UI in hubble-product-ops, 2026-10-16: "Still open en
 * el doc").
 *
 * WHY A SUBAGENT FINISHES ONLY WHAT IT WROTE, since 2026-10-24. "Finish the step
 * at a clean point" left the worker to judge how much was left, and the worker
 * that has been at it always thinks it is little. So the first notice allows
 * closing work already written (build, validate, commit) and sends anything
 * still to edit to a fresh subagent; the repeat notice stops it with no
 * exception, which catches a wrong guess (Ian Rueff, in hubble-product-ops,
 * 2026-10-24: "vamos si").
 *
 * Fails OPEN on anything unexpected. A bug here must never block a tool call;
 * the worst it may do is stay quiet.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { sweepOnce } = require('./hook-store-sweep.cjs');

const THRESHOLD = 200;
const STEP = 100;
const TOKEN_THRESHOLD = 200_000;
const TOKEN_STEP = 100_000;

/* How much of the transcript's tail to read. The file reaches megabytes and
 * this runs on EVERY tool call, so reading it whole would make the budget
 * notice one of the things costing the budget. The last turn's usage is within
 * a few KB of the end; 256 is slack for a long tool result. */
const TAIL_BYTES = 256 * 1024;

/**
 * Context carried by the most recent turn, or null when it cannot be read.
 *
 * `input_tokens + cache_creation + cache_read` is what the request actually
 * carried — the cache columns are most of it, and leaving them out reports a
 * 285.000-token session as 2.
 */
function contextFrom(transcriptPath) {
  let fd;
  try {
    fd = fs.openSync(transcriptPath, 'r');
    const size = fs.fstatSync(fd).size;
    const length = Math.min(size, TAIL_BYTES);
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, size - length);
    const lines = buffer.toString('utf8').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      let entry;
      try {
        entry = JSON.parse(lines[i]);
      } catch {
        continue; /* the first line of a tail read is usually half a record */
      }
      const usage = entry && entry.message && entry.message.usage;
      if (!usage) continue;
      return (
        (usage.input_tokens || 0) +
        (usage.cache_creation_input_tokens || 0) +
        (usage.cache_read_input_tokens || 0)
      );
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        /* nothing to do, and nothing worth failing a tool call over */
      }
    }
  }
}

/**
 * Which budget, if either, is due — the FIRST to cross wins.
 *
 * Calls were the only measure until 2026-09-11 and they measure the wrong
 * thing: cost grows with CONTEXT, and context does not grow at the rate calls
 * do. One call reading a large file is worth twenty. Measured in the session
 * that changed this: 200.000 tokens were crossed at call 121, so the old notice
 * spoke 79 calls late, with ~280.000 tokens already carried.
 *
 * `spoken` holds what was true the last time it spoke, so a session crosses
 * each budget once and then every step after it.
 */
function due(calls, context, spoken = {}) {
  const lastCalls = Number(spoken.calls) || 0;
  const lastContext = Number(spoken.context) || 0;

  const byContext =
    Number.isFinite(context) &&
    context >= TOKEN_THRESHOLD &&
    context >= (lastContext ? lastContext + TOKEN_STEP : TOKEN_THRESHOLD);

  const byCalls =
    Number.isInteger(calls) &&
    calls >= THRESHOLD &&
    calls >= (lastCalls ? lastCalls + STEP : THRESHOLD);

  if (!byContext && !byCalls) return null;
  return byContext ? 'context' : 'calls';
}

/** Kept for the spec and for anything still asking the old question. */
function shouldNotice(n, threshold = THRESHOLD, step = STEP) {
  if (!Number.isInteger(n) || n < threshold) return false;
  return (n - threshold) % step === 0;
}

/** The store's file name. The main session keeps the one it had, so a session
 * running across this change keeps its count. */
function storeName(session, agent) {
  return agent
    ? `claude-call-budget-${session}-${agent}.json`
    : `claude-call-budget-${session}.json`;
}

/** The transcript to read context from. A subagent's sits beside the session's,
 * at `<transcript_path without .jsonl>/subagents/agent-<agent_id>.jsonl`. */
function transcriptFor(transcriptPath, agent) {
  if (!agent || !transcriptPath) return transcriptPath;
  return path.join(transcriptPath.replace(/\.jsonl$/, ''), 'subagents', `agent-${agent}.jsonl`);
}

/** The line itself, naming which budget spoke and both numbers, so a later one
 * is not mistaken for the first and nobody has to guess what tripped. */
function notice(calls, context, reason, agent, cwd, repeat = false) {
  const carried = Number.isFinite(context)
    ? `${Math.round(context / 1000)}k tokens of context`
    : 'context unread';
  const self = agent ? 'subagent' : 'session';
  const lead =
    reason === 'context'
      ? `This ${self} is carrying ${carried}, at call ${calls}.`
      : `Call ${calls} of this ${self}, carrying ${carried}.`;
  if (agent) {
    const stillOpen = `In checkpoints, first commit what is left to \`## Still open\` in your stage's doc.`;
    if (repeat) {
      return (
        `${lead} Cost is quadratic in length, so a fresh subagent is now cheaper ` +
        `than this one. Stop now, no exception: return what is done, what is ` +
        `validated and what is left. ${stillOpen}`
      );
    }
    return (
      `${lead} Cost is quadratic in length, so a fresh subagent is now cheaper ` +
      `than this one. Finish only closing work you already wrote: build, validate, ` +
      `commit. Anything still to edit: stop at a clean point and return what is ` +
      `done, validated and left. ${stillOpen}`
    );
  }
  const handoff = /[\\/]\.claude[\\/]worktrees[\\/]/.test(String(cwd || ''))
    ? `Run \`pnpm handoff "<what is left>"\` here, then ExitWorktree keep, which ` +
      `frees the lock; give the person its output and stop.`
    : `Run \`pnpm handoff "<what is left>"\`, give the person its output, and stop: ` +
      `they /clear and paste it.`;
  return (
    `${lead} Cost is quadratic in session length and compaction ` +
    `fires too late to help, so a new session is now cheaper than this one. ${handoff}`
  );
}

module.exports = {
  THRESHOLD,
  STEP,
  TOKEN_THRESHOLD,
  TOKEN_STEP,
  shouldNotice,
  due,
  contextFrom,
  storeName,
  transcriptFor,
  notice,
};

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    try {
      const data = raw ? JSON.parse(raw) : {};
      const session = String(data.session_id || '').replace(/[^A-Za-z0-9_-]/g, '');
      if (!session) return quiet();
      const agent = String(data.agent_id || '').replace(/[^A-Za-z0-9_-]/g, '');

      const store = path.join(os.tmpdir(), storeName(session, agent));
      let state = {};
      try {
        state = JSON.parse(fs.readFileSync(store, 'utf8'));
      } catch {
        /* first call of the session, or a store we cannot read: start clean */
      }

      const n = (Number(state.calls) || 0) + 1;
      const spoken = state.spoken || {};

      /* Read the transcript only when a budget could plausibly be due, so the
       * common call pays nothing. Calls are free to count; context is a file
       * read, and this runs on every tool. */
      const worthReading = n >= 20;
      const transcript = transcriptFor(data.transcript_path, agent);
      const context = worthReading && transcript ? contextFrom(transcript) : null;

      const reason = due(n, context, spoken);
      const next = { calls: n, spoken: reason ? { calls: n, context: context ?? 0 } : spoken };
      try {
        sweepOnce(store, 'claude-call-budget-');
        fs.writeFileSync(store, JSON.stringify(next));
      } catch {
        /* if the store cannot be written the notice simply never fires */
      }

      if (!reason) return quiet();
      say(notice(n, context, reason, agent, data.cwd, Boolean(Number(spoken.calls))));
    } catch {
      quiet();
    }
  });
}

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
