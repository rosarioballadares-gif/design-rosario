# Brief: the Product Ops welcome page, in Hakuna's identity

## Objective

The "Bienvenida a Product Ops" page reads as Hakuna's: whoever opens it
recognises the studio rather than a generic template.

> SOURCE: Ian Rueff, 2026-10-09 — "el artifact de bienvenida de prod ops con
> el adn de hakuna. tomalo de joinhakuna.ai"

## Differentiator

Today the page wears a neutral design-file look: light grey, blue accent,
Bricolage and Instrument Sans, red redline marks. Its twelve blocks and their
content were approved in
[the onboarding brief](2026-10-08-onboarding-page.md); this changes the skin
and leaves the content alone.

> SOURCE: the agent, 2026-10-09, reading the published page

## Context and rules

- Same page, updated in place: https://claude.ai/artifact/7wgEwtMxX6EBYhkfmTct3G.
  Every line is read before it is republished.
- The identity is read from the HTML of https://joinhakuna.ai: near-black
  `#0C0C0C`, white text, neon green `#35FD2E`, red-orange `#F9452D`; Bebas Neue
  uppercase for display, Inter with negative tracking for body, Fragment Mono
  for labels; square corners and pill buttons; the green smiley mark.
- Fonts from Google Fonts; the mark drawn inline as SVG, nothing hot-linked
  from Framer.
- Dark first, as the site is. A light variant stays, where green is only ever
  a fill and never text: on white it does not read.
- Copy stays Spanish and unchanged, save at most one nod to the site's
  voice ("Design for AI") in the opener.

> SOURCE: the agent, 2026-10-09, reading joinhakuna.ai and the artifact

## Dependencies

None.

> SOURCE: the agent, 2026-10-09

## Scope

In: colour, type, mark and component shape across the twelve blocks.

Out: content changes, a design system, Figma, anything under `src/`. And
recording Hakuna as the client: this repository is the template
([GUIDE.md](../GUIDE.md) §1), so a client written into
[workspace-wiring.md](../docs/foundation/workspace-wiring.md) here would be
inherited by every client's copy. Its "no client has been recorded" is the
template's correct state.

> SOURCE: Ian Rueff, 2026-10-09, client intake — "solo la ui no necesitamos
> crear un ds para este caso"

## Tasks

1. Read the whole page; swap tokens and fonts.
2. Redo what leaned on the old look: redline marks in green and orange,
   square corners, Bebas Neue headings.
3. Look at 390 and 1280 px, light and dark; publish to the same URL; commit
   this brief; merge and push on Ian's confirmation.

> SOURCE: the agent, 2026-10-09

## Autonomy

Checkpoints. Rung `default`, effort `high`.

> SOURCE: Ian Rueff, 2026-10-09, question UI — Go + worktree

## Validation

- Captures at 390 and 1280 px, light and dark: nothing clipped, no sideways
  scroll.
- Text contrast judged with `contrast-audit`.
- `pnpm check:briefs` OK.

> SOURCE: the agent, 2026-10-09
