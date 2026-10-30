# Brief: a subagent may finish only what it already wrote

## Objective

A subagent at its first budget notice finishes only closing work it already
wrote — build, validate, commit — and stops anything still to edit at a clean
point; the repeat notice (+100 calls or +100k tokens) stops it with no exception.

> SOURCE: Ian Rueff, 2026-10-29, question UI: "Go + worktree (Recommended)"

## Differentiator

A 1:1 port of hubble-product-ops' merge bad97483, no redesign. Today the
template says "finish the step at a clean point", which leaves the worker to
judge how much is left.

> SOURCE: Ian Rueff, 2026-10-24, in hubble-product-ops' brief
> `briefs/2026-10-24-budget-notice-finish-rule.md`: "vamos si"

## Context and rules

- `scripts/call-budget-notice.cjs` already has the per-subagent store and the
  `Still open` sentence; its `sweepOnce` from `hook-store-sweep.cjs` and its own
  "WHY IT NAMES pnpm handoff" wording stay as they are.
- `due()` speaks again at +100 calls or +100k tokens and `spoken` says whether
  it spoke before, so the caller can tell a repeat.
- The spec caps every notice under 400 characters; the main session's text does
  not change.

> SOURCE: `git -C C:/hubble-product-ops diff dc1e1e3c bad97483`, read 2026-10-29

## Dependencies

None.

> GAP: none known

## Scope

In: the subagent branch of `notice()` with a trailing `repeat` flag, its call
site, a dated WHY paragraph, the spec's tests, the Budget bullet of
`docs/foundation/autopilot.md`.

Out: the thresholds, the main session's notice, `checks.md`, `ask-guard`.

> SOURCE: Ian Rueff, 2026-10-29, question UI: "Go + worktree (Recommended)"

## Tasks

1. `notice()`, its caller, the WHY paragraph, the spec and the Budget bullet,
   in one worker.

> SOURCE: Ian Rueff, 2026-10-29, approved at the gate

## Autonomy

Checkpoints. Rung `default`, effort high: the floor. Not `decision`: the rule
was chosen in hubble-product-ops, nothing left to design.

> SOURCE: Ian Rueff, 2026-10-29, question UI: "Go + worktree (Recommended)"

## Validation

- `pnpm vitest run scripts/call-budget-notice.spec.mjs`: all pass; both
  subagent variants under 400 characters.
- `pnpm test:run`: the file count equals main's (38 files).
- `pnpm lint`, `pnpm check:copy`, `pnpm check:briefs`: exit 0.

> SOURCE: Ian Rueff, 2026-10-29, declared at intake
