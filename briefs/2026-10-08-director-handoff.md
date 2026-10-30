# Brief: director mode in checkpoints, and pnpm handoff

## Objective

A checkpoints session with a long brief stays small, its Tasks run in fresh
subagents, and the budget notice names one command that writes the relay
prompt, so stopping costs one call.

> SOURCE: Ian Rueff, 2026-10-08, two picks in the question UI

## Differentiator

Only autopilot directs today
([PDR-0006](../docs/decisions/0006-continuous-autopilot.md)); a checkpoints
session does every Task inline. The previous session reached 600k tokens that
way: the notice fired at 200k, 300k, 400k, 500k and 600k, each time asking for
a hand-written prompt that never got written.

> SOURCE: Ian Rueff's handoff, 2026-10-08

## Context and rules

- The director contract exists in
  [autopilot.md](../docs/foundation/autopilot.md): one worker at a time, a
  one-line report, the director edits nothing. Checkpoints reuses it without
  the registry or the waiting questions: the person is there, so a question
  goes to the question UI at once.
- [CLAUDE.md](../CLAUDE.md) has 27 tokens to spare under `check:floor`; the
  rule needs about 40, so the ceiling in
  [context-floor.json](../scripts/context-floor.json) rises with a date and a
  sentence.
- The notice stays one short line
  ([call-budget-notice.cjs](../scripts/call-budget-notice.cjs)): `pnpm handoff`
  replaces the hand-written prompt, it does not add to it.
- `pnpm handoff` derives everything from git and the brief; only "what is left"
  comes from the session, as an argument.

> SOURCE: the agent, 2026-10-08, reading those files

## Dependencies

None outside this repository.

> SOURCE: the agent, 2026-10-08

## Scope

In: the CLAUDE.md rule and its floor ceiling; an "in checkpoints" section in
autopilot.md; `scripts/handoff.mjs`, its spec and `pnpm handoff`; the notice's
main-session text and its spec; autopilot.md's Budget line, where the director
runs `pnpm handoff` and does not stop.

Out: a hook enforcing the rule; a new PDR; the `worktree-close.mjs` crash, its
own brief next.

> SOURCE: Ian Rueff, 2026-10-08, question UI

## Tasks

Run as director, the rule's first case:

1. Worker: the rule — CLAUDE.md, floor ceiling, autopilot.md.
2. Worker: `pnpm handoff` — script, spec, package.json.
3. Worker: the notice names it — text, WHY paragraph, spec, Budget line.
4. Director: the end checks over the whole diff; a fix worker if red.
5. Merge, `lint` and `build` on main, `gate`, push on Ian's confirmation.

> SOURCE: the agent, 2026-10-08

## Autonomy

Checkpoints, as director, in a worktree. Rung `default`, effort `high`. Not
`decision`: both changes revert in one commit. One worker at a time.

> SOURCE: Ian Rueff, 2026-10-08, Go + worktree

## Validation

- `pnpm test:run` green, file count not below the 34 measured before.
- `pnpm check:floor` OK.
- `pnpm check:briefs`, `pnpm lint`, `pnpm check:copy` OK.
- `pnpm handoff "x"` on the branch prints this brief, the branch, the commits
  since main and "x".
- The notice spec: the main-session line names `pnpm handoff` and says stop.
- diff-review over the whole diff.

> SOURCE: the agent, 2026-10-08
