# Brief: a client-neutral base, with a client intake and a from-zero design-system pipeline

## Objective

`studiohakuna/product-ops-base`, a GitHub template carrying one client's method and
none of its product, whose `/setup` interviews a new client and writes the spec
of what to wire — and, when the client has no design system, chains one skill
per stage to build one the way that client's was built.

> SOURCE: Ian Rueff, 2026-10-08, question UI

## Differentiator

The existing base, `studiohakuna/pilot-product-ops`, is three weeks and ~1450
commits of that client behind, and its `/setup` asks nothing about a client. That
client's design system was built by hand across briefs and PDR-0002 to 0005; the next
client from zero would repeat that from memory. The base also goes to the
product designers at a workshop, so it is what they will learn the method from.

> SOURCE: Ian Rueff, 2026-10-08 — "armar un repo vanilla, el cual pasaré a todos
> mis designers para que jueguen durante el workshop"

## Context and rules

Copied from that client's tracked tree at commit
`ba154e6`,
history dropped. Each stage's precedent:
[PDR-0002 tokens](../docs/decisions/0011-tokens-three-tiers.md),
[0003 headless](../docs/decisions/0012-headless-ark-ui.md),
[0004 primitive and featured](../docs/decisions/0013-primitive-and-featured.md),
[0005 spacing and bands](../docs/decisions/0014-spacing-breakpoint-scale.md).
That client stays a worked example, never a default. Everything versioned is English.

## Dependencies

> SOURCE: Ian Rueff, 2026-10-08, question UI, at the close — the product
> designers hold access to the `studiohakuna` org on GitHub.

## Scope

In: the template; `/setup` in two layers, client then person; the spec as a
brief, its blocked tasks in the backlog; `people.md` with client contacts; the
hook launching `/setup`; skills `stack`, `look-and-feel`, `headless`,
`breakpoints`, `app-shell`, `sandbox`, and `tokens`, `component`, the Figma
parity skills made neutral; `GUIDE.md`; one rehearsal from zero.

Out: a stack other than React, a design tool other than Figma, a skill for a
client that already has a design system, the workshop deck.

> SOURCE: Ian Rueff, 2026-10-08, question UI

## Tasks

1. Census of product against method, by a subagent.
2. Strip the product; scrub the names.
3. Token build and specs read prefix, modes and bands from a config, green on an
   empty set.
4. The pipeline skills, in stage order.
5. `/setup`, `WIRING.md`, the hook, `people.md`.
6. `GUIDE.md` and the README.
7. Rehearse: a clone, a fictitious client from zero; fix what breaks.
8. Checks green, the repo pushed, marked a template, this brief in that client's repository.

## Autonomy

Checkpoints. Rung `decision`, effort `xhigh`: the cut and the chaining close
off other shapes. Not `audit`: one census answers the surface. Fan-out: the
census subagent.

> SOURCE: Ian Rueff, 2026-10-08, "Go + worktree"

## Validation

- `pnpm install`, `lint`, `build`, `test:run`, `gate` — exit 0.
- `check:briefs`, `check:backlog`, `check:skills-table`, `check:links` — ok.
- `git grep -i` for that client's name — only worked-example lines.
- A clone with no profile: the hook names `/setup`.
- Rehearsal: an intake "no design system, React, Figma" writes a spec with the
  stages in order, and its tasks show in `pnpm board`; each stage skill runs
  once to its `Done when`, findings fixed.

> SOURCE: Ian Rueff, 2026-10-08, question UI — "Todo en esta tarea", the
> rehearsal included.
