---
name: tokens
description: Design tokens in code - building a set from what renders or from the look, or adding, renaming or wiring a token.
---

# tokens

**The rule everything else follows from: a set transcribes a look that was
already decided.** When the product renders, the look is what renders today,
and when the first build lands every screen that reads it looks exactly as it
did the day before. When nothing renders yet, the look is what the client
has decided and written down, and the set transcribes those decisions. Either way,
a token that "fixes" a colour on the way in is two changes — a tokenisation
and a redesign — and the redesign hides inside the first, where nobody
reviews it. A value that arrives later is the other kind of change, a
decision, and it enters as one: see [Changing a set](#changing-a-set).

[`src/ds/README.md`](../../../src/ds/README.md) is how a set is read, and
[`scripts/build-tokens.mjs`](../../../scripts/build-tokens.mjs) and
[`tokens.spec.ts`](../../../src/ds/tokens/tokens.spec.ts) are the build and the
checks — both already run on an empty set, and both read the set's shape from
[`config.json`](../../../src/ds/tokens/config.json). The worked example is
a previous client's [PDR-0011](../../../docs/decisions/0011-tokens-three-tiers.md),
later extended by a type scale, a light mode, a surface base and a 4-point
grid. Read it as
one product's answer: the method below carries to another product, and the
prefix, the modes and the values are that product's.

## The shape

**Three tiers, one file per tier, so a file's tier is its path** and a check can
hold the direction instead of leaving it to convention.

| Tier | Holds | Points at | Mode |
| --- | --- | --- | --- |
| primitive | a value: a hue and a step, a size on a scale | nothing | none |
| semantic | a meaning: `bgColor.panel`, `fgColor.muted`, `text.heading.2` | primitives | by family: colour and elevation in one file per mode, even where the modes agree; type, space, radius, motion and geometry in `base` |
| component, optional | a part of one component: `card.bgColor` | semantic | none — the mode resolves in the semantic tier |

**The component tier is optional** ([PDR-0015](../../../docs/decisions/0015-component-tier-optional.md)).
It enters for multi-brand and cases like it — several brands, a white label, a
product family sharing components — where one component must look different on
an axis the semantic tier does not carry. Ask at intake. Without it there is no
`component.json`, and a component's CSS reads the semantic variables directly.

- **Primitives never reach a screen.** The output the app imports carries
  semantic and component tokens only, so a screen binds to a meaning and never
  to a hue.
- **Colour families are `bgColor`, `fgColor` and `borderColor`**, as a previous
  client named them and as `tokens-figma` scopes them. **`text.*` is the type
  ladder only**: the build reads every typography composite from `text.*` and
  throws on one elsewhere, so a text colour is `fgColor.*`, never `text.*`.
- **A raw value in the semantic tier is allowed only where no scale exists** —
  A previous client's was map geometry: widths, opacities, dashes. Everything else points
  down.
- **A component token may point at a primitive only for a measure with no
  semantic role, never for a colour.**
- **One prefix for tokens and for the components the product writes itself** —
  `--<prefix>-<path>` in CSS, `<Prefix>Card` as a component; a previous client's
  was two letters. The person picks it; ask. It goes in `config.json` as `prefix`,
  beside `modes` (the mode files' names, such as `light` and `dark`) and
  `defaultMode` (the one `:root` falls back to).

**Every semantic token carries one usage rule**, written once, not per mode, in
`semantic/usage.json`, beside the semantic tier. The
build's `usage.json` is generated from it and is never edited.

- `description` — what it is.
- `useWhen` — the cases, as a list.
- `dont` — the misuse the token invites, and what to take instead.
- `insteadOf` — when a rival exists: the rival token, with the phrase that
  separates the two. This is the field that earns the rule: an agent choosing
  between `bgColor.page` and `bgColor.panel` reads the phrase, not the hex.
- `source` — where the value came from: the file and constant it replaced, or
  who decided it and when.

The rules are structured rather than prose so a tool can lay one rival beside
another. They cover the semantic tier and nothing else — a primitive has no use
to rule on, and a component token's use is its component.

## Building a set

Each step ends on its criterion; the next one starts only after it holds. Step
1 has two paths, by what the client has.

1. **Inventory the look.**
   - **From what renders**, when the product or its prototypes exist: every
     colour, size, radius, shadow, duration and font they set, with the file
     and line it came from. Done when every value in the files that will read
     the tokens is either on the list or named as out of scope, with the
     reason.
   - **From inspiration**, when nothing renders: every decision in
     the look the client has written down, expanded into the values it implies —
     a brand hue into a ramp of steps, a base unit into a spacing scale, a type
     family and its largest step into a type ladder, the modes into one column
     each. A ramp or a scale you generate is a proposal: show it with the
     decision it came from, and the person accepts it before it is a value.
     Done when every decision maps to values the person accepted, and every
     GAP in the file is still a GAP here, never a value you filled.
2. **Read the precedents.** Another token repo nearby has usually solved the
   structure or the ladder. A previous client took one repo's DTCG and Style Dictionary
   layout, another's structured rules and band names, and a third's type steps — structure
   from each, the look always its own. Done when each borrowed piece is named,
   with the part not taken and why.
3. **Primitives**, from the inventory: one per distinct value, on a scale where
   one exists. Done when every inventoried value resolves to a primitive or is a
   named exception.
4. **Semantic tokens**, per mode, then `base`, split by family as in the table
   above. The mode files carry the same keys with the same types. Done when
   every screen use of the inventory has a meaning to bind to.
5. **Usage rules** for every semantic token. Done when every semantic token has
   one, every `insteadOf` names a token that exists, and every `source` points
   at something readable.
6. **Component tokens**, only when intake opened the tier, and only for
   components that exist. Done when each points at semantic tokens that exist.
7. **The build.** Write `prefix`, `modes` and `defaultMode` into
   `config.json`, then `pnpm tokens`. The build is already here and writes,
   into `src/ds/tokens/build/`:
   - `tokens.css`, the variables per mode, which `src/ds/provider.tsx`
     imports;
   - `modes.ts`, a typed module per mode for any consumer that cannot read
     `var(--…)` — a map library's paint takes values;
   - `usage.json`, joining each semantic token to its values in every mode,
     its variable and its rule. That file is what an agent reads to choose.

   Done when `pnpm tokens` prints the prefix and the modes, and
   `pnpm check:tokens` is green.
8. **The checks.** `tokens.spec.ts` runs its full suite once `config.json` has
   a prefix: tier direction, mode parity, a rule for every semantic token and
   for nothing else, rivals that exist, build drift. Done when `pnpm test:run`
   is green with no fewer files than before, and each check has been seen red
   once — break a reference, delete a rule — and green again.
9. **Foundations stories.** `src/ds/foundations/`, one story per tier that
   has tokens, none restating a value:
   - `Foundations/Primitives` reads `primitive.json` itself, since the build
     keeps primitives out of the TS on purpose: colour as a row of swatches
     per hue, then type, space, radius and the rest, each with its value.
   - `Foundations/Semantic` reads `usage.json`: each family a table of token,
     a cell per mode (an element with `data-theme` set, so the sample paints
     through the variable), the values, and the rule.
   - `Foundations/Component` joins with the first component token, in the
     `component` skill; until then there is no story for an empty tier.

   Each sample is drawn by the token's type: a colour as a swatch, a
   dimension as a bar of that length, a duration or a number as its value in
   text — a duration drawn as a bar is a line one pixel wide.

   A previous client's `src/ds/foundations/`, one story per tier drawn this
   way, was the worked example: take its shape, never its names. Set the page
   ground in [`.storybook/preview.tsx`](../../../.storybook/preview.tsx) to
   three semantic tokens — the page's background, its text colour and its
   body text style — since a dark mode with only a background paints black
   text on black. Done when `pnpm build:storybook` is green and a capture of
   each story, in every mode, shows every token of its tier — `shot.mjs
   --full 1` takes a story taller than the window in one file. Read the port
   off Storybook's own banner before capturing: it takes the next free one
   when 6006 is busy, and 6006 may be another checkout's.
10. **Wire the consumers**, one file at a time, when the product renders, and
    prove nothing moved: snapshot each consumer's exported values in every
    mode before, compare after — only formatting may differ — and capture each
    screen in every mode, before and after. Done when the snapshot diff is
    empty and the captures match. From inspiration there is nothing to wire
    yet.
11. **The decision record.** A PDR from
    [the template](../../../docs/decisions/TEMPLATE.md): tiers, direction,
    prefix, modes, the rule fields, which path the look came from, and
    everything left out with nothing decided. Done when each open value is a
    named gap, never a guessed token.

Then offer **tokens-figma**, as a question: the set is the source it mirrors.

## Changing a set

**A new value is a decision.** Its `source` is the person who asked, and the
date. Its value in each mode is theirs to give, so ask for both. First search
the code for the hue: it often already renders without a token. The new token
then replaces those values, or they are named as out of scope.

It enters at the bottom and climbs:

1. A primitive, in an existing ramp when it belongs to one.
2. A semantic token with its rule, in an existing family beside its nearest
   sibling — a warning beside `danger`, with its `on*` pair.
3. A component token, only in a set with the component tier.

Then:

- the build, with the spec green;
- a new colour through **contrast-audit**, on every surface it will sit on,
  because the spec leaves contrast to it;
- every screen that reads it, captured in every mode. A token no screen reads
  yet is captured when its first reader lands.

A rename moves the path and keeps the value; every reader moves in the same
change. Done when the spec is green, the contrast is measured, and every
reader is captured.

When the set has a Figma mirror, the change is not finished until
**tokens-figma** has carried it there. Offer it.

## Gotchas measured on a previous client

- **Style Dictionary's CSS font shorthand drops `letterSpacing`.** Tracking
  stays inside the style's composite, and the build emits
  `textStyle.display.2` as `{ font, letterSpacing }` for a reader to spread.
- **A type scale is one ladder in groups** — display, heading, content.
- **A value two sources disagree on is a gap, not a token.** A previous client had
  two brand indigos and no brand token until somebody picked one. A scale that does
  not exist (z-index) stays out rather than being invented to fill the table.
- **Screens that render in one mode only** stay out of the first pass, named;
  tokenising them invents their other mode.
