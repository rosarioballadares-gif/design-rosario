# Brief: the template, safe to copy

## Objective

A fresh copy, used by client people too, works on any machine and inherits
nothing of Hakuna, a previous client or the template's own history.

> SOURCE: Ian Rueff, 2026-10-09 — "este vanilla repo tiene q funcionar perfecto
> porq sea duplicado muchas veces… nada de sobreingenieria"; copies hold client
> people too (question UI, same day).

## Differentiator

A four-agent review on 2026-10-09 found flows that stop halfway (`feedback`,
`/setup`), a guard that skips PowerShell and five ways around it, and a previous client's and
studio content reaching every client. Every check passes today: none looks at
these.

> SOURCE: the agent, 2026-10-09 — fresh-clone run, inheritance, scripts/hooks/CI
> and skills/docs reviews, reported to Ian in conversation

## Context and rules

- Only what the review found. No new features.
- `CLAUDE.md` must not grow: `pnpm check:floor` leaves about 20 tokens. New
  procedure goes to [GUIDE.md](../GUIDE.md) or `docs/`.
- The template knows itself by its `origin`
  (`studiohakuna/product-ops-base`). In a copy, `/setup`'s client layer moves
  the inherited briefs and `backlog/90-template.md` to
  `docs/template-history/` in its spec commit, so the template keeps working
  normally and every copy starts clean.
- `share-deck` leaves the repo for Ian's user skills (`~/.claude/skills/`).
- The four cited PDRs of that client (0002-0005) are copied anonymised ("a previous
  client") into `docs/decisions/`. Every other link to its repository
  becomes one line saying what it showed, or goes.

> SOURCE: Ian Rueff, 2026-10-09, question UI — all four blocks; client people
> in copies; Go + worktree

## Dependencies

Read access to that client's repository through `gh`, confirmed by the
review.

> SOURCE: the agent, 2026-10-09, `gh repo view`

## Scope

In: the review's four blocks — what breaks in a copy, the guard's holes,
inheritance, and the small fixes.

Out: the `superpowers` plugin (user-level, not in the repo), rewriting docs for
style, a new CI.

> SOURCE: Ian Rueff, 2026-10-09, question UI

## Tasks

As director, one fresh worker per Task, in order, on this branch:

1. Guard: PowerShell; push to `HEAD`, receipt vs pushed commit, spellings,
   `add -u`/`:/`, other repos; exempt `feedback/`, `people.md`; specs.
2. Copy breaks: `/setup` lands on `main`, person-layer branch, template
   self-detection, `feedback`'s workflow, `corepack`, Node, dates, ignores.
3. Inheritance: `share-deck`, that client's examples, `/setup` moving the
   template's history, `backlog/90-template.md`.
4. Small: worktree close recipe and external deliverables in GUIDE.md, broken
   references, `build:storybook` in CI, `check:tokens` realpath, temp-file
   cleanup.
5. Director: final validation, diff-review, merge and push on Ian's yes.

> SOURCE: the agent, 2026-10-09

## Autonomy

Checkpoints, as director. Rung `default`, effort `high`.

> SOURCE: Ian Rueff, 2026-10-09, question UI — Go + worktree

## Validation

- `pnpm test:run`: spec file count not below 36.
- `pnpm gate` and `pnpm check:floor` green.
- The five guard holes as specs, red before the fix and green after.
- A clean clone: `session-brief.mjs` asks for no client under the template's
  origin and does under another.

> SOURCE: the agent, 2026-10-09
