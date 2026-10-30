# Brief: no inherited names left outside history

## Objective

A fresh copy names no previous client, no studio-internal team, and no decision
record it does not contain.

> SOURCE: Ian Rueff, 2026-10-09 — "vamos con lo q no tocaste", on the four
> leftovers reported when feat/template-hardening closed

## Differentiator

The four leftovers reported at the close of 9389225, outside that diff, so its
validation did not reach them.

> SOURCE: the agent, 2026-10-09 — final diff-review of
> [the template-hardening brief](2026-10-09-template-hardening.md)

## Context and rules

- The rule of Task 3 in [template-hardening](2026-10-09-template-hardening.md):
  a reference to something not in the repo becomes one line saying what it
  showed, or goes.
- Each comment keeps its reasoning; only the name leaves.
- The stale `.claude/worktrees/ci-deploy` is not touched.

> SOURCE: Ian Rueff, 2026-10-09, question UI — Go + worktree

## Dependencies

None: every file is in this repository.

> SOURCE: the agent, 2026-10-09

## Scope

In:
- WDR-0021/0022/0025 in `scripts/browser.mjs:7`, `scripts/gate-receipt.cjs:9`,
  `scripts/git-guard.cjs:45`, `scripts/git-guard.spec.ts:168`,
  `scripts/skill-router.spec.mjs:72`.
- `mcp__figma-hakuna__` to `mcp__figma-example__` in the five cases of
  `scripts/skill-router.spec.mjs`; the test reads "under any server name".
- The Thryv guide citation in `docs/foundation/voice-content-guide.md:16`.
- "Design Projects" in `.claude/skills/tokens-figma/SKILL.md:28`.

Out: the stale test title in `env-checks.spec.mjs`, the wrap in
`backlog/90-template.md`, dates of the old repository's history.

> SOURCE: Ian Rueff, 2026-10-09, question UI

## Tasks

1. Drop the WDR references.
2. A neutral server name in the spec.
3. Thryv and Design Projects.

> SOURCE: the agent, 2026-10-09

## Autonomy

Rung `repair`, effort `medium`: three tasks, run in the session, no director.

> SOURCE: Ian Rueff, 2026-10-09, question UI — Go + worktree

## Validation

- `grep` for WDR-00, figma-hakuna, Thryv and "Design Projects" outside
  `briefs/` and `docs/template-history/` returns nothing.
- `pnpm test:run` at 38 spec files; `pnpm lint` and `pnpm check:links` green.
- Merge, `pnpm gate`, push on Ian's yes.

> SOURCE: the agent, 2026-10-09
