# Brief: an empty backlog

## Objective

A fresh copy starts with an empty backlog and names no previous client anywhere,
`docs/template-history/` included; what depends on the client, `/setup` writes.

> SOURCE: Ian Rueff, 2026-10-09 — "la idea es q este repo este virgen, con todo
> lo q se pueda presetear preseteado y el resto dentro de setup"

## Differentiator

A copy inherits 11 backlog items today: one `/setup` already covers, one landed,
three limits of the template, and five maintainer items, one of them landed.
None is work for a copy.

> SOURCE: the agent, 2026-10-09 — `grep '^### ' backlog/*.md`, shown to Ian

## Context and rules

- `backlog/README.md` stays: it explains the format.
- Briefs stay in the template; `/setup` still moves them to
  `docs/template-history/` in a copy, so the 19 files citing one keep a reason.
- The four open maintainer items become GitHub issues on this repository.
- No new features.

> SOURCE: Ian Rueff, 2026-10-09, question UI — issues; set aside and anonymise

## Dependencies

`gh` writing issues to `studiohakuna/product-ops-base`.

> SOURCE: the agent, 2026-10-09 — `gh auth status`, scope `repo`

## Scope

In: `backlog/01-wiring.md`, `02-skills.md`, `90-template.md`, `README.md`;
`.claude/skills/setup/CLIENT.md`; the links in `stack`, `parity` and
`docs/foundation/pipeline.md`; the four briefs naming that client; the title in
`scripts/env-checks.spec.mjs:77`.

Out: the wrap in `90-template.md`, moot once the file goes.

> SOURCE: Ian Rueff, 2026-10-09, question UI

## Tasks

1. Backlog out: the three files go, four issues open, `check:backlog` and
   `pnpm board` pass empty, README adjusted.
2. `/setup` owns the gaps: CLIENT.md writes the blocked item, with its text,
   for a code package, another stack or another design tool; its move of
   `90-template.md` goes; links repointed.
3. "a previous client" in the four briefs; the test title.

> SOURCE: the agent, 2026-10-09

## Autonomy

Rung `default`, effort `high`: three tasks, in the session.

> SOURCE: Ian Rueff, 2026-10-09, question UI — Go in this worktree

## Validation

- A case-insensitive grep for that client's name over the repository returns nothing.
- `check:backlog`, `check:briefs`, `check:links`, `test:run` (38 files) green.
- The four issue links.
- Gate, merge, push on Ian's yes.

> SOURCE: the agent, 2026-10-09
