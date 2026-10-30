# Brief: a visual onboarding page for new designers

## Objective

A new designer or PM understands what this workspace does, how to ask it for
work and what happens next, in about ten minutes of looking rather than
reading.

> SOURCE: Ian Rueff, 2026-10-08 — "simple y súper gráfico... cuanto más
> descriptivo y llano más eficiente"

## Differentiator

Today the way in is [GUIDE.md](../GUIDE.md): 11 KB in 15 sections of dense
prose, written for somebody already inside. The page tells the same story with
diagrams and illustrated examples; GUIDE.md stays the reference.

> SOURCE: the agent, 2026-10-08, measuring GUIDE.md

## Context and rules

- A published page on claude.ai, private until Ian shares it, in Spanish. It
  lives outside the repository, so this brief is the only file the repo gets.
- Every claim comes from [GUIDE.md](../GUIDE.md), [CLAUDE.md](../CLAUDE.md) or
  [pipeline.md](../docs/foundation/pipeline.md); nothing invented to fill a box.
- "Example images" are illustrations drawn in the page itself — the question
  UI, an execution prompt, the terminal, the branch flow. The template has no
  screen worth capturing.
- Plain words; each term of art gets one line in a glossary.

> SOURCE: Ian Rueff, 2026-10-08, question UI — visual page, Spanish, Go

## Dependencies

None outside this repository.

> SOURCE: the agent, 2026-10-08

## Scope

In: one page, twelve blocks — what it is, what you need, the first hour and
`/setup`, how you ask (the gate), Go / worktree / autopilot, what a brief is,
the design-system pipeline, the skills as cards, branches and closing, when to
cut a session (`pnpm handoff`), glossary, where to ask.

Out: a rewrite of GUIDE.md, video, real screenshots.

> SOURCE: the agent, 2026-10-08

## Tasks

Run as director:

1. Worker: a plain-language outline of the twelve blocks, each fact cited.
2. Worker: the page, in HTML, from the outline.
3. Worker: one look at phone and desktop width, light and dark; one fix pass.
4. Director: publish, then merge and push on Ian's confirmation.

> SOURCE: the agent, 2026-10-08

## Autonomy

Checkpoints, as director. Rung `default`, effort `high`. Not `decision`: a
page is republished in one call.

> SOURCE: the agent, 2026-10-08

## Validation

- Captures at 390 and 1280 px, light and dark: nothing clipped, no sideways
  scroll.
- Every block traces to a cited line in the outline.
- `pnpm check:briefs` OK.

> SOURCE: the agent, 2026-10-08
