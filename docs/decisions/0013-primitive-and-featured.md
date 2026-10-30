---
id: PDR-0013
date: 2026-09-27
status: accepted
---

# PDR-0013 — `src/ds/` holds primitives only; a component tied to one product place is featured, lives in `src/features/<area>/` and composes primitives

## Context

The [`component`](../../.claude/skills/component/SKILL.md) skill made 26
`<Prefix>` components for a previous client on 2026-09-26 from a table of kinds
that lists the side nav, the phone app bar, the panel beside the nav, the app
shell and the overlay at a map point beside the switch and the button. It took
props from "the prototypes", which in practice meant the one prototype the kind
was drawn from.

A survey on 2026-09-27 read all 32 files and 30 Figma sets against the nine
sandbox screens. It found 5 components shaped by one place and 4 feature
components sitting in the DS:

- **Shaped by one place:** Card (the dashboard), Meter (a quality bar), Panel
  (the shell's list column), TextField (a rename field) and ToggleButton (a
  legend's tile). Drawer is shaped in Figma only.
- **Feature components in the DS:** AppShell, SideNav, AppBar and MapOverlay.

The card's `tinted` ground, for example, is defined as "floats over the map, as
the dashboard's figures do", and its story and Figma sample are the dashboard's
total-devices card. The table, file by file, stays in that client's research.

> SOURCE: Ian Rueff, 2026-09-27 — primitives are the generic ones, such as the
> button; featured ones are tied directly to the product. The components were
> built before this line existed, and that is where the drift came from.

## Decision

- **Two layers.** A **primitive** is generic and serves any screen. A
  **featured** component belongs to one part of the product and is built out of
  primitives.
- **A primitive lives in `src/ds/components/` as `<Prefix><Name>`**:
  - Its variants are the ones the product's screens draw, and each variant
    names at least one screen that draws it.
  - Its definition names no product place. That covers its props, variant
    descriptions, fixed copy, story args and Figma sample. A screen may appear
    as an example ("such as Devices"). A variant defined by where it sits in
    one screen has been shaped by that place.
- **The test, run before anything is built:** could a second screen use it
  unchanged? If its variants, anatomy, fixed copy or data shape come from one
  screen, it is either featured, or a primitive plus a featured component on
  top of it.
- **A featured component lives in `src/features/<area>/`**:
  - `<area>` is the part of the product it belongs to, such as `dashboard`,
    `devices` or `nav`.
  - It has no `<Prefix>` prefix. It imports primitives from `src/ds` and never a
    vendor ([PDR-0012](0012-headless-ark-ui.md)).
  - It styles layout and composition only. A look it needs that no primitive
    has is a variant missing from that primitive, and it is added there.
- **A featured component is optional.** A page can place primitives directly;
  a featured component earns its place when the same composition repeats, or
  when it carries product copy and data.
- **In Figma, a featured set lives on a FEATURED page** in the client's
  Foundations file. It is built from instances of the primitive sets. A frame
  drawn by hand where a primitive set exists is the same drift.

## Rationale

The drift came from primitives being drawn from one screen. A card whose
grounds are defined by the dashboard cannot serve a devices tile or an explorer
panel without a second card beside it, and that is how a design system turns
into a copy of its first screen. Requiring every variant to cite the screen
that draws it makes the primitive the union of the product. Keeping featured
components out of `src/ds/` makes the layer visible in the path itself.

Ruled out:

- **`src/ds/featured/`**: featured components would sit within reach, but the
  seam would mix the two layers again, and `src/ds/` is what gets reused or
  swapped.
- **A separate Figma file for featured sets**: it keeps them further apart, but
  every primitive change would have to be published to a library before a
  featured set sees it. A page in the same file reads the primitives directly.
- **Leaving the nine as they are**: every new screen would grow the first
  screen's variants, or add a sibling component.

> SOURCE: Ian Rueff chose `src/features/<area>/` and a FEATURED page at the
> gate, 2026-09-27.

## Consequences

- **Until they are separated, nine components contradict this record.**
  Separating them waited for a branch then moving the devices screen and its
  frame onto the shell, side nav and panel primitives. That work moves a second
  time.
- **The `component` skill classifies first.** A kind it would have made whole
  now splits into a primitive and, when one is wanted, a featured component.
- **Nothing mechanical enforces this.** No check can tell a variant defined by
  one screen from a generic one. It is held by the skill's classify step and by
  review.
- **Featured components have no guidance records.** `guidance.spec.ts` reads
  `src/ds/` only.

  > GAP: whether featured components get records, and where.

## Related

- Copied anonymised on 2026-10-09 from a previous client's log, where it was
  PDR-0004, as the worked example of the `component` skill. Its brief and its
  survey stay in that client's repository.
- Descends from [PDR-0012](0012-headless-ark-ui.md), whose `<Prefix><Name>`
  wrapper is the primitive here.
