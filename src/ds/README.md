# `src/ds` — the design system seam

Every design system import in this repository comes from this folder. Nothing
under `src/` outside it may name a vendor package.
[`seam.spec.ts`](seam.spec.ts) fails `pnpm test:run` when something does.

It holds primitives only. A component tied to one product place is featured,
lives in `src/features/<area>/` and composes these. The `component` skill
draws the line; a worked example is
[PDR-0013](../../docs/decisions/0013-primitive-and-featured.md).

## Why it is a folder and not a convention

The alternative is importing the vendor wherever a component is needed, which
works until the day the design system changes — and then the change is a search
across every file that ever rendered a button. A repository that imports the
vendor from 37 places has chosen its design system permanently without anybody
deciding to.

> SOURCE: Ian Rueff, 2026-09-08, recorded as one of three deliberate
> improvements `revolear-product-ops` made over `design-ops` and worth carrying
> forward.

## Wiring one in

1. Install the vendor package and its peer dependencies.
2. Import its stylesheet and wrap its provider in
   [`provider.tsx`](provider.tsx). That file is the only place a vendor name
   is allowed to appear.
3. Re-export from [`index.ts`](index.ts) whatever the application uses. Prefer
   re-exporting a named component over re-exporting a namespace: a namespace
   export defeats tree shaking and it also hides which components are actually
   in use.
4. If the vendor themes through an attribute, set it in
   [`index.html`](../../index.html) rather than from the provider. A provider
   that reads an attribute on mount and discards it is a real shape, and
   debugging it as a provider problem costs an afternoon.

## Tokens

The set lives in [`tokens/`](tokens/), in three tiers, once the `tokens` skill
has built one. Until then [`config.json`](tokens/config.json) carries
`"prefix": null` and `pnpm tokens` writes every file under `tokens/build/`
empty, so the provider, the breakpoint hook and the specs already run. Why the
set is shaped the way it is goes in the client's own PDR, which the skill
writes; a worked example is
[PDR-0011](../../docs/decisions/0011-tokens-three-tiers.md).

| File | Tier | Mode |
| --- | --- | --- |
| `primitive.json` | primitive: hue and step, never used by a screen | none |
| `semantic/base.json` | semantic: type, radius, space, motion | none |
| `semantic/<mode>.json` | semantic: colour, elevation | one per mode in `config.json` |
| `semantic/breakpoint/<band>.json` | semantic: what changes with the viewport | one per band, widest first |
| `semantic/usage.json` | the rule for every semantic token | none |
| `component.json` | component: what one primitive alone reads | none |

- **In code**, import `tokensFor(mode)` from `src/ds`. It returns a
  mode-resolved tree of semantic and component tokens. Primitives are
  deliberately absent from it.
- **In CSS**, use `var(--<prefix>-<path>)` from `tokens/build/tokens.css`,
  which [`provider.tsx`](provider.tsx) imports.
- **To choose a token**, read `tokens/build/usage.json`. It lists every
  semantic token with its values in every mode, its CSS variable, and its
  rule:
  - `description`
  - `useWhen`
  - `dont`
  - `insteadOf`, which names a rival and the phrase that separates the two
  - `source`

  This is the file an agent reads.
- **After editing any token JSON**, run `pnpm tokens`. `tokens.spec.ts` fails
  when `build/` has drifted from the JSON, when a tier points the wrong way,
  when two modes disagree on their keys, and when a semantic token has no
  rule.

## What is not decided

> GAP: which design system this client uses, and whether one exists. `/setup`
> asks, and records the answer in
> [`docs/foundation/workspace-wiring.md`](../../docs/foundation/workspace-wiring.md).
> Until then this seam is a passthrough.
