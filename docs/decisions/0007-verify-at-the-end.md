---
id: PDR-0007
date: 2026-09-29
status: accepted
---

# PDR-0007 — A task builds each commit and verifies once, at its end, over the whole diff

## Context

On 2026-09-28, in stage 2 of a devices run in the repository this method was
built in, each commit took 11 to 26
minutes and 100 to 160 steps, most of them spent proving that one commit: 10 to
22 states captured in two modes, pixel diffs, and re-captures chasing the
run-to-run noise of two map-heavy screens.

The repository named no moment for any of it, except in three places that said
the opposite:

- [diff-review](../../.claude/skills/diff-review/SKILL.md) was routed "Before
  any commit", and its first step read `git diff`, which is empty once the work
  is committed.
- An [autopilot](../foundation/autopilot.md) worker validated its step "with
  evidence — a build, a capture".
- [The component skill](../../.claude/skills/component/SKILL.md)'s steps 3 to 5
  each end on a capture, `test:run` or voice-audit before the next one starts.

> SOURCE: the stage's run, measured 2026-09-28. Ian Rueff, 2026-09-28: «q lo
> haga todo al final», «haces todo al final después de todo», «debería ser este
> el default, dejémoslo donde deba».

## Decision

The rule lives in [CLAUDE.md](../../CLAUDE.md) § Validation; this is what it
closes off.

1. **Each commit builds.** `pnpm build` is green on every commit, with
   `pnpm tokens` and `pnpm check:tokens` when tokens move, and its message
   claims no measure it did not take.
2. **The rest runs once, at the end of the task or stage, over its whole
   diff:** the captures against the befores, which are still taken before the
   first edit; lint; `test:run`; `check:copy`; voice-audit; and diff-review.
3. **What they find goes into one fix commit**, and the afters are taken after
   it, so they measure the final code.
4. **In the component skill, Figma mirrors the branch after the end.** Its code
   is committed before the end, and its Figma steps start once the end is done.

## Rationale

- **The afters prove the same pieces again.** They capture every state the
  stage moved, and the capture's probe keys each measure to its piece, so a
  difference still names the piece that moved.
- **The end was measured.** On 2026-09-29 it ran over the stage's 11 commits:
  about 15 minutes of checks by two read-only agents in parallel, about 11 for
  the fix commit — 8 fixes, none visual — and about 30 for the afters, which
  found no regression.
- **Ruled out: verifying each commit**, the status quo. It pays for each proof
  twice, once in its commit and again in the afters.
- **Ruled out: Figma beside the code, on a branch that only builds.** The
  component skill's step 7 compares the set against the story's capture, which
  the end takes, and a fix at the end would touch what Figma already mirrors.

> SOURCE: that devices run, stage 2, measured 2026-09-28 and 2026-09-29,
> pushed as 0a4ae24; the status quo ruled out by Ian Rueff, 2026-09-28; Figma
> after the end chosen by Ian Rueff, question UI, 2026-09-29, over leaving the
> Figma steps where they were.

## Consequences

- **A defect surfaces at the end and costs a fix commit.** The commit that
  brought it stays in the history uncorrected, though it builds.
- **The afters name the piece, not the commit** that moved it.
- **Figma waits for the end**, and what its steps write back is committed after
  it, outside its review.
- **Nothing enforces the moment.** `pnpm gate` still runs lint, `test:run` and
  `check:copy` before a push; the captures, voice-audit and diff-review rest on
  this rule alone.

## Related

- Brief: 2026-09-29-verify-at-the-end, in a previous client's repository.
- The run it generalises: the devices run, phase 2, in the same repository,
  stage 2.
- Where it is carried: [CLAUDE.md](../../CLAUDE.md) § Validation,
  [diff-review](../../.claude/skills/diff-review/SKILL.md),
  [autopilot.md](../foundation/autopilot.md), whose
  [PDR-0006](0006-continuous-autopilot.md) stands unchanged, and
  [the component skill](../../.claude/skills/component/SKILL.md).
