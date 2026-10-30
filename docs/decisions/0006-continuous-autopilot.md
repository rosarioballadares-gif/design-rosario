---
id: PDR-0006
date: 2026-09-28
status: accepted
---

# PDR-0006 — Autopilot runs with nobody watching: the main session directs, one fresh subagent works each step, and a question waits instead of stopping the run

## Context

Four things stopped an autopilot run that nobody was watching: the context
budget, a main session too busy working to talk, the end of one task, and a
question nobody had foreseen.

- [autopilot.md](../foundation/autopilot.md) said nothing about the context
  budget, and [the budget notice](../../scripts/call-budget-notice.cjs) asked
  for a `/clear` whether or not anybody was there to type it.
- The components run of 2026-09-26 improvised a relay to fresh subagents
  (its assumption log, item 9, in a previous client's repository),
  and two runs on 2026-09-28 repeated it from a memory rule.
- Inside a subagent the notice counted into the session's store and read the
  session's transcript. Measured 2026-09-28: 34 of 124 subagent transcripts in
  this repository carried it, one with 82 calls of its own reading "Call 200 of
  this session".
- The question UI holds the session until it is answered, so a question opened
  mid-run stops everything behind it.

> SOURCE: Ian Rueff, 2026-09-28, question UI — all four brakes come off, and
> "Go autopilot" keeps its name.

## Decision

The contract is [autopilot.md](../foundation/autopilot.md); this is what it
closes off.

1. **The main session directs and does not work.** One worker at a time, a
   subagent with a fresh context, does each step, commits it and reports one
   line. The detail goes into a versioned registry on the branch.
2. **The budget cuts a worker, never the run.** A worker that does not fit
   returns `partial` at a clean point, and the notice now counts a subagent's
   own calls and tells it so. The director that reaches its own notice writes
   the relay prompt, sends a notification and keeps going.
3. **A question waits instead of stopping the run.** A worker writes it into
   the registry and returns; the director sends a notification and runs what
   does not depend on it. Only that part of the work stops.
4. **A queue runs back to back.** Its briefs are approved together up front,
   and a finished task merges into local `main` when that was pre-authorized.
   The push stays the person's, asked at the end of the queue.

## Rationale

Three shapes were ruled out, each with its variants.

- **A Workflow as the director.** Its rules need the person's own words to run
  one each time, and a gate option does not count; a question cannot reach a
  running workflow; and [`.claude/settings.json`](../../.claude/settings.json)
  sets `workflowSizeGuideline: small`.
- **A director that also works, or stops at its threshold.** Ian rejected both.
  A step done by the director lands its tool output in the one context that
  has to last the whole run, and a director that stops at its threshold puts
  back the first brake this record removes. Several workers at once were not
  argued for: the components run learned that two collide in `component.json`
  and in Figma.
- **A queue on anything but approved briefs and local `main`.** Approving each
  brief when its turn comes stops the queue at every task. One brief for the
  whole queue does not fit: `check:briefs` caps each field, and a queue of pages
  is past every cap. Stacked branches break born-from-`main`, and a task
  rejected at review drags every task stacked on it. A queue of independent
  tasks only would leave out the queues that are worth running, where one task
  builds on the last.

> SOURCE: Ian Rueff, 2026-09-28, question UI — every rejection above but the
> Workflow, which was declared and not contested.

## Consequences

- **The main session's notice now counts only its own calls.** A session that
  launches subagents hears it later than it used to, and each subagent hears
  its own, told to return rather than to ask for a `/clear`.
- **A run can come back partly blocked.** The registry is what says which part
  and why, so it is read before the merge, not after.
- **`## Autonomy` carries one more thing** — the registry's path — under the
  same 250-byte cap, its `> SOURCE:` line included. The first autopilot brief
  shows whether that fits.
- **Local `main` runs ahead of `origin/main` for a whole queue.** `EnterWorktree`
  and every peer see none of it until the push.
- **A notification reaches the phone only with Remote Control on.** Without
  it, a waiting question is seen at the desk.
- **One worker at a time is slower than a fan-out.** That is the price of no
  collisions.

> GAP: the director's behaviour is proven on its first real run, not here.

## Related

- Brief: 2026-09-28-continuous-autopilot, in a previous client's repository.
- The run it generalises: the components assumption log, in the same repository.
