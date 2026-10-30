---
id: PDR-0015
date: 2026-10-14
status: accepted
---

# PDR-0015 — The component token tier is optional, and enters only when a component must vary on an axis the semantic tier does not carry

## Context

[PDR-0011](0011-tokens-three-tiers.md), a previous client's, set three tiers:
primitive, semantic, component. The template carried them into the `tokens`
skill, which opened the component tier as soon as a component repeated a
combination, and into the `component` skill, which wrote `component.json` for
every primitive. The build and `tokens.spec` already read the file only when
it exists, so the tier was optional in the code and mandatory in the method.

## Decision

Tokens are three tiers, and the third is optional.

- **Primitive and semantic are always there.** A component's CSS reads the
  semantic variables directly.
- **The component tier enters for multi-brand and cases like it**: several
  brands, a white label, a product family sharing components — an axis on
  which one component must look different and the semantic tier does not carry.
- **The `tokens` skill decides it**, at intake, and a product that grows that
  axis later opens the tier then.

## Rationale

A component token that only re-points at one semantic token is a second name
for a meaning that already has one: it doubles the files, the Figma
collection and the variables to keep in step, and buys nothing until something
needs to vary per component. Multi-brand is where it pays, because a brand can
change one component's part without changing the meaning everywhere else.

Ruled out: keeping the tier for every component that repeats a combination, as
the template did. Repetition is already served by the semantic token it points
at.

## Consequences

- A product without the axis has no `component.json`, no Component collection
  in Figma and no `Foundations/Component` story.
- Opening the tier later means adding a component token per part and pointing
  each component's CSS at it — a migration, not an edit.
- The worked example's `component.json` is one product's answer, not the
  default.

## Related

- [PDR-0011](0011-tokens-three-tiers.md), which this narrows for new clients.
- [The brief](../../briefs/2026-10-14-component-tier-optional.md).

> SOURCE: Ian Rueff, 2026-10-14
