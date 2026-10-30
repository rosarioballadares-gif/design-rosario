---
id: PDR-0014
date: 2026-09-27
status: accepted
---

# PDR-0014 — A previous client's layout spacing is a set of per-band tokens named as a reference system names them, valued as the product renders, and holding only what the product measures

## Context

The product had one breakpoint, 640, and two semantic spacing tokens,
`space.edge` and `space.barEdge`; `component.json` named a spacing primitive
directly 110 times. So a new component picked a raw step, and nothing said
which distance is the page's and which is a card's.

A reference design system has the structure: five bands and the layout groups
that vary across them, mirrored in its Figma library as one collection with a
mode per band. The measured map of the product's values onto it stays in that
client's research. It found no spacing that differs between 640 and 1440, no
design at 768 or 1024, and twelve of the reference's leaves with no component
of the product behind them.

## Decision

**Five bands**, as the reference's: base 375, sm 640, md 768, lg 1024, xl 1440,
each a lower bound.

**The reference's names, the product's values.** A token takes the reference's
path (`shell.pageGutter.m`) and the value the product renders today:

| token | base | sm · md · lg · xl |
| --- | --- | --- |
| `breakpoint.minWidth` | 375 | 640 · 768 · 1024 · 1440 |
| `shell.pageGutter.m` | 12 | 16 |
| `panelGroup.gap.m` | alias of `shell.pageGutter.m` | |
| `layout.gap.m` | 12 | 16 |
| `shell.navVariant` | overlay | expanded |
| `surface.padding.s` / `.m` / `.l` | 12 / 14 / 16 | 12 / 14 / 16 |
| `panel.contentGap.m` | 24 | 24 |
| `cluster.gap.m` / `.l` | 8 / 10 | 8 / 10 |
| `copy.gap.m` | 4 | 4 |

**768 and 1024 take the desktop value** until the product designs those widths.

**Only what the product measures enters.** A step it does not use and a group
with no component of its own stay out; each enters when one of its designs
needs it, with the value measured there.

**In Figma, a new collection `Breakpoint`** in Foundations, beside Primitives,
Theme and Component: one mode per band, named and ordered as the reference's —
`xl · desktop (1440)`, `lg · laptop (1024)`, `md · tablet (768)`,
`sm · mobile L (640)`, `base · mobile (375)` — and the tokens above as variables
by slash path, each aliasing a Primitives step. Spacing takes scope `GAP`,
`minWidth` takes `WIDTH_HEIGHT`.

## Rationale

The reference's names already say which distance is which — a gutter, a gap
between panels, a card's padding — and taking them keeps the product readable
next to it. Its values would not: the reference pads a card 12 to 16 and gaps a
cluster's loose step at 12, where the product renders 14 and 10.

Ruled out: **the reference's values at 768 and 1024.** They would be the only
numbers in the set the product never drew. Ruled out: **all 39 leaves**, as the
reference carries them. Twelve would hold its values for components the
product does not have, and the empty steps would hold guesses. Ruled out:
**deriving the missing `s` and `l` steps** one rung around `m`. A derived step
reads exactly like a measured one.

## Consequences

- Four of the five bands hold the same spacing until someone designs a tablet
  or a laptop width. The collection shows five modes, and the table shows why
  three of them are copies.
- The product's scale is not the reference's: 14 and 10 are steps the reference
  lacks, so a value copied from a reference component is wrong until it is
  checked here.
- The wiring is its own brief, after the devices work merges, since it touches
  `component.json`, the primitives and the app shell. It adds the viewport
  primitives 375, 768, 1024 and 1440, creates the Figma collection, and decides
  what becomes of `space.edge`, `space.barEdge` and `breakpoint.narrow`.
- A group left out is not forbidden. It needs a design of the product that uses
  it and a measure.

## Related

- Copied anonymised on 2026-10-09 from a previous client's log, where it was
  PDR-0005, as a worked example of choosing the bands. Its brief and its
  map stay in that client's repository.
- Descends from [PDR-0011](0011-tokens-three-tiers.md): these are semantic
  tokens, aliasing primitives.
