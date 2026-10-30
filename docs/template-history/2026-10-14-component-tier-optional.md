# Brief: the component token tier is optional, for multi-brand

## Objective

The pipeline says tokens are three tiers and that the third, component, is
optional: it enters for multi-brand and cases like it, not by default.

> SOURCE: Ian Rueff, 2026-10-14

## Differentiator

Today the `tokens` skill opens the tier as soon as a component repeats a
combination, and the `component` skill writes `component.json` for every
primitive — optional in the code, mandatory in practice.
[tokens step 6](../.claude/skills/tokens/SKILL.md),
[component step 1](../.claude/skills/component/SKILL.md)

## Context and rules

The code already treats the tier as optional: the build reads only the source
files that exist, and `tokens.spec` reads a missing file as empty — see
`sources` in [build-tokens.mjs](../scripts/build-tokens.mjs) and `read` in
[tokens.spec.ts](../src/ds/tokens/tokens.spec.ts). PDR-0011 is a previous
client's decision cited as a worked example and stays as it is.

> GAP: what "cases like it" covers. Proposed: an axis the semantic tier does
> not carry — several brands, white label, a product family sharing components.

## Dependencies

None. The decision is the person's, given in the conversation.

> SOURCE: Ian Rueff, 2026-10-14

## Scope

In: the `tokens`, `tokens-figma` and `component` skills, `src/ds/GetStarted.mdx`,
a new PDR-0015 and its line in the decisions index. Out: code and checks,
PDR-0011, and `studiohakuna/pilot-product-ops`, which gets the change separately.

> SOURCE: Ian Rueff, 2026-10-14

## Tasks

1. PDR-0015 and its index line.
2. `tokens`: the shape table, step 6, step 9's Component story, the climb.
3. `tokens-figma`: the Component collection only when the tier exists.
4. `component`: step 1 and step 6 conditional on the tier.
5. `GetStarted.mdx`'s tier table.
6. Validation over the whole diff, merge, gate, push on confirmation.

> SOURCE: Ian Rueff, 2026-10-14

## Autonomy

Checkpoints. Rung `default`, effort `high`: a skill edit with a real diff. Not
`decision`: the person already took it, and this records it.

> SOURCE: Ian Rueff, 2026-10-14

## Validation

- `grep -n "component.json" .claude/skills` — every instruction to write it is
  conditional on the tier.
- `pnpm lint`, `pnpm build` — green.
- `pnpm test:run` — green, file count no lower than on `main`.
- `pnpm check:briefs`, `check:skills-table`, `check:floor` — ok.

> SOURCE: Ian Rueff, 2026-10-14
