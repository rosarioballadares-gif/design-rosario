---
id: PDR-0012
date: 2026-09-25
status: accepted
---

# PDR-0012 — A previous client's components are built on Ark UI, wrapped in `src/ds/` and styled only through its prefixed tokens

## Context

The nine prototypes draw every control by hand: no UI library is installed,
`src/ds` is a passthrough, and [PDR-0011](0011-tokens-three-tiers.md) left the
token CSS waiting on "the first component built on the headless framework".

A census of the ten `.tsx` files under `src/sandbox/`, checked line by line
against the source on 2026-09-25, found 22 kinds of component with behaviour,
weighted towards floating layers and toggles. None of the 39 floating layers
manages focus, `Switch` is written five times, seven drawers and sheets are
drawn by hand, and four overlays are placed at a map point by hand. Matched
against those 22 kinds, Ark UI covers 21, Base UI 20, React Aria Components 18
and one in part, and Radix 15. The census and the matrix stay in that client's
research.

> SOURCE: Ian Rueff, 2026-09-25 — the headless framework is chosen before the
> tokens are wired to anything; chose Ark UI over Base UI and React Aria
> Components.

## Decision

- **Ark UI (`@ark-ui/react`) is the headless framework.** A component with
  behaviour starts from its Ark primitive. One that Ark does not have is built
  by hand on its ARIA pattern.
- **It is imported only inside `src/ds/`.** A screen imports `<Prefix><Name>`
  from `src/ds`, never `@ark-ui/react`.
- **Each wrapper is `<Prefix><Name>`**, PDR-0011's prefix: the Ark parts
  composed in `src/ds/components/<Prefix><Name>.tsx`, and `<Prefix><Name>.css`
  styling Ark's `data-part` and `data-state` attributes. Every colour, space,
  radius, type and motion value in it is a `var(--<prefix>-*)` from the semantic
  or component tier.
- **The package is installed, never copied or patched.**
- **An overlay at a map point** takes its rectangle from `map.project` through
  `positioning.getAnchorRect`, and calls `reposition()` when the map moves.
  Mapbox `Marker`s stay Mapbox's.

## Rationale

Ark UI is the only candidate that covers, at once, the two needs this product
has and most applications do not — an overlay pinned to a point on a moving map
and a sheet with snap points — and the tree and list the signed-in explorer's
panels are drawn as. Its catalog is the widest of the three with a drawer, 51
components against Base UI's 37, and that is what the component skill that
follows spends: every primitive it finds is one it does not build. Its MCP
server and `llms-react.txt` let that skill read a component's parts from the
source rather than from memory.

Ruled out:

- **Base UI**, the close second: the same drawer and anchoring and a more
  direct styling API, but no tree and no list, so the explorer's tree and list
  panels would be built by hand.
- **React Aria Components**: the strongest on tables, dates, drag and drop and
  accessibility, but no drawer and no virtual anchor on its tooltip.
- **Radix**: nothing released since 2026-07-24, and seven of the 22 kinds
  missing.
- **Headless UI and Ariakit**, on catalog: the first has no tooltip, slider or
  toast; the second is before 1.0, with no switch, slider or toast.
- **shadcn/ui**, before the matrix: it copies component source into the
  repository, which `CLAUDE.md` forbids.

## Consequences

- A selector names a part and a state (`[data-part="control"][data-state="checked"]`),
  and `className` takes a string, not a function of state.
- There is no Meter: a quality bar and a share bar become a `Progress` or stay
  hand-built.
- Ark released 13 stable versions in the six months to 2026-09-25, so upgrading
  is a recurring task rather than an event.
- The first wrapper to land wires the token CSS into the app and sets
  `data-theme` on the root, as PDR-0011 anticipated.
- The prototypes keep their hand-built controls until each one is migrated;
  migrating them is its own task.
- Next, and not decided here: the component skill, and a usage rule per
  component, which inherits an earlier design system's record with its anchor
  moved from a Figma component to the export in `src/ds/`.
- Out, with nothing decided: a passes table, a day-by-hour grid, drag to
  reorder, and a Figma library for these components.

> GAP: which library the client's production front end is built on. If it is
> one of the candidates, this record is worth reopening.

## Related

- Copied anonymised on 2026-10-09 from a previous client's log, where it was
  PDR-0003, as a worked example of choosing the headless library. Its brief
  and its fit research stay in that client's repository.
- [PDR-0011](0011-tokens-three-tiers.md)
