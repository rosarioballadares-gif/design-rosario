---
id: PDR-0011
date: 2026-09-25
status: accepted
---

# PDR-0011 — A previous client's tokens are three tiers under one prefix, a screen binds to semantic, and every semantic token carries a usage rule

## Context

Before this, the client's palette lived as 17 dark-mode ternaries in one map
grammar file and as constants in a dashboard file, with about 59 more hex
values scattered across 15 files. Nothing named a colour's purpose in a form a
person or an agent could look up.

Two precedents were read. One design system keeps DTCG JSON built by Style
Dictionary, one file per mode, with semantic and component tokens mixed in the
same mode file and no check on which tier points at which. Another gives every
token a prose `$description`. Its structured rules (`useWhen`, `do`, `dont`,
`insteadOf`) exist only for components, and those are what its agent reads to
choose between rivals.

> SOURCE: Ian Rueff, 2026-09-25 — take the first precedent's structure as the
> base, read how the second does it, and give tokens and components one prefix.

## Decision

- **Three tiers, in separate files** under `src/ds/tokens/`:
  - `primitive.json`, with no mode;
  - `semantic/base.json`, `semantic/dark.json` and `semantic/light.json`;
  - `component.json`, with no mode, because it only points at semantics and
    the mode resolves there.
- **Direction.** A primitive holds a value. A semantic token points at
  primitives. A component token points at semantics.
  - The one exception on the semantic side: map geometry (widths, opacities,
    dashes) stays a raw number, because it has no scale to belong to.
  - A component may point at a primitive only for a measure that has no
    semantic role, never for a colour.
- **Primitives never reach a screen.** The TS the app imports holds semantic and
  component tokens only.
- **One prefix.** Tokens are `--<prefix>-<path>` in CSS and
  `tokensFor(mode).<path>` in code. Components the client writes itself take
  `<Prefix>` as a name prefix (`<Prefix>Card`), and their tokens sit under the
  component's name (`card.*`).
- **Every semantic token has one rule** in `semantic/usage.json`, with:
  - `description`
  - `useWhen`
  - `dont`
  - `insteadOf` (a rival token and the phrase that separates the two)
  - `source`

  The rule does not depend on the mode, so it is written once and not per mode
  file.
- **The build** is Style Dictionary v5 (`pnpm tokens`), which emits CSS for both
  modes, TS per mode and `build/usage.json`. The output is committed, and
  `tokens.spec.ts` fails when it drifts from the JSON.

## Rationale

The tiers go in separate files, unlike the first precedent, so that a file's
tier is its path, and a check can hold the direction that precedent leaves to
convention. The TS output exists because Mapbox paint takes values rather than
`var(--…)`, and the map is most of what the product draws. The rules are
structured rather than prose, unlike the second precedent's tokens, so that an
agent can put one rival beside another the way it already does with that
precedent's components.

## Consequences

- A new colour enters as a primitive, gains a meaning as a semantic token with
  its rule, and only then reaches a screen.
- The map grammar and the dashboard now read the tokens. The other screens'
  inline values do not yet: migrating them is its own task.
- The CSS output is generated but no screen imports it yet. The first
  component built on the headless framework is what wires it, together with a
  `data-theme` attribute on the root.
- Out, with nothing decided:
  - a brand colour, because two different indigos both appear;
  - z-index, because no scale exists;
  - a mono family, because three are in use;
  - three dark-only screens;
  - Figma variables.

## Related

- Copied anonymised on 2026-10-09 from a previous client's log, where it was
  PDR-0002, as the worked example of the `tokens` skill. The brief it was
  executed under stays in that client's repository.
- [src/ds/README.md](../../src/ds/README.md)
