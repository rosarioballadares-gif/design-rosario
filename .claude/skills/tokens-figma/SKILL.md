---
name: tokens-figma
description: Design tokens into Figma - mirroring a set as variables, bound styles and a docs page, or carrying a change across.
---

# tokens-figma

**The rule everything else follows from: the token JSON is the only source, and
Figma is its mirror.** Every variable is a token that exists in the repo, with
the same name, the same value in each mode and the same aliases. A value that is
changed in Figma first is drift. It goes back to the repo through **tokens** and
comes forward again from there.

This skill starts from a set built by **tokens**: three tiers, a usage rule
for each semantic token, and the modes and bands named in
[`config.json`](../../../src/ds/tokens/config.json). The client's library file
is the one `## The design tool` in
[workspace-wiring](../../../docs/foundation/workspace-wiring.md) names; when it
names none, the first mirror creates it, in the team the person picks. The
worked example is a previous client's Foundations file, built from its
tokens set and extended by a type scale.

## Before the first call

- **Load `figma-use`.** It is mandatory before any `use_figma` call.
- **On a first mirror, run `whoami` and read the plan of the team that will own
  the file.** Two modes need a Pro team, and a Starter team allows one; a previous
  client's file lives in a Pro team for exactly that. The person picks the team and
  whether the file is new.
- **Probe before writing.**
  - A read-only call returns the file's pages and collections, and whether the
    product's fonts load.
  - On a first mirror, a second call tests each variable type you need on a
    throwaway collection, then deletes it.

## The shape in Figma

**One collection per tier, and one for the bands.** The aliases point the same
way they do in the JSON.

| Collection | Modes | Values | Scopes |
| --- | --- | --- | --- |
| Primitives | one, named `Value` | raw values | `[]`, and `hiddenFromPublishing` — primitives never reach a screen, so they stay out of every picker and out of the library |
| Theme, the semantic tier | one per entry of `modes`, named as there with a capital; a token from `base` holds the same value in every mode | aliases to primitives | per family |
| Component, only in a set with the tier ([PDR-0015](../../../docs/decisions/0015-component-tier-optional.md)) | one | aliases to semantic tokens | `[]`, and `hiddenFromPublishing` — a product designer picks from Theme and Breakpoint only, so a component variable stays out of every picker, in the file and in the library; it is bound through the Plugin API |
| Breakpoint | one per entry of `bands`, widest first, named `<band> · <device> (<min width>)`, as `xl · desktop (1440)` | aliases to primitives | spacing `GAP`, `minWidth` `WIDTH_HEIGHT` |

**The library publishes Theme and Breakpoint.** Those are the two a product
designer picks from; Primitives and Component stay hidden from publishing.

- **Names:** the path with `/` instead of `.`, so `bgColor.panel` becomes
  `bgColor/panel`. Inside descriptions, replace only strings that are real
  token names.
- **Descriptions.**
  - A semantic one is its usage rule, flattened: the description, then
    `Use it for:` and `Don't:` as bullet lists, then
    `Rather than <rival>: <phrase>.` The `source` stays in the repo.
  - Primitive and component ones are written at this step, in the same loop
    that sets the values.
- **Scopes, per family, as a previous client set them** — a starting point, not a rule:

  | Family | Scopes |
  | --- | --- |
  | `bgColor` | frame and shape fill |
  | `fgColor` | text and shape fill, stroke |
  | `borderColor` | stroke |
  | `font` | font family |
  | `text` | font size |
  | `radius` | corner radius |
  | `space` | gap |
  | `size` | width and height |
  | `backdrop` | effect float |
  | `motion` | Figma's default |
  | map colours | all fills and stroke |

**Types:**

| DTCG | Figma |
| --- | --- |
| color, hex or rgba | COLOR, channels on 0–1 |
| dimension, number, fontWeight | FLOAT (`16px` becomes 16; a unitless line height stays 1.4) |
| duration in ms | TIMING in seconds. It takes no scopes: `Cannot set scopes on this variable type` |
| fontFamily | STRING, first entry of the list |
| a dash array or number list | STRING joined with `, `, and the description says so |
| typography, shadow, gradient | a style, below |

A STRING takes no `OPACITY` scope either. Set scopes per type, not per family
alone.

**Composites become styles whose parts bind to variables:**

- **Text styles.** Set `fontName` first, mapping weight 400/500/600/700 to
  Regular/Medium/SemiBold/Bold. Then bind family, size and weight with
  `setBoundVariable`.
  - Line height and letter spacing stay literal, in PERCENT
    (`round(lh * 100)`), because a variable would bind them in pixels.
  - Order styles within their folder. `moveLocalTextStyleAfter` refuses across
    folders.
- **Effect styles.** `setBoundVariableForEffect(effect, 'color', v)` binds the
  colour only; offset, blur and spread stay numbers. A shadow whose colour
  changes by mode needs a helper variable in Theme (`elevation/*/color`).
  A background blur's radius is twice CSS's `blur()`, so `card/surface` sets
  12 for 6px and `scrim/backdrop` 16 for 8px: a bound 6 would draw half.
- **Paint styles.** Gradient stops bind with
  `boundVariables: { color: { type: 'VARIABLE_ALIAS', id } }`. Count the bound
  stops that come back, rather than assuming they bound.
  - A stop *position* that differs by mode cannot live in one style. That
    gradient becomes one style per mode.

**A helper variable exists only because Figma needs it.** It gets its own group
("Figma-only helpers", as a previous client named it) and a description that says so. It is the
only thing in the file that has no token behind it.

## Mirroring a set

Each step ends on its criterion.

1. **A generator, local, from the JSON.** A script that turns each tier into the
   payload a `use_figma` call pastes in. A previous client's generator and verify script
   lived in a session scratchpad and are not in the repo, so write them.
   - Match references with `\{([a-zA-Z][\w.-]*)\}`. A looser `\{([^}]+)\}`
     swallowed the brace of a stringified object twice.
   - Mark "same in both modes" with `null`, never `0`, because `0` is a real
     value.

   Done when the payload for every tier prints, and a spot check against the
   JSON holds.
2. **Collections, in tier order:** Primitives, then Theme, then Component if the set has it, then
   Breakpoint once the set has bands. An alias needs its target
   to exist first.
   - One call per collection. The `code` field caps at 50,000 characters, and
     a previous client's largest call, 75 semantic variables, used about half.
   - A failed call is atomic, so a rerun is safe. A successful one is not
     idempotent: build name → variable maps from `getLocalVariablesAsync()`
     before creating anything, and throw on a name that should exist and
     does not.

   Done when every token has a variable.
3. **Styles**, in one call. Done when every composite is a style with its
   bindable parts bound.
4. **The documentation page**, one call per group, with a `get_screenshot` after
   each. Details below. Done when every group reads correctly in both modes on
   screen.
5. **Validation**, below. Done when it reports no gaps.

## The documentation page

A page named `FOUNDATIONS`, as a previous client's is. It has two sections side by side:

- **Primitives**, with a group per family: colour as a row of wrapped swatches
  per hue, then type, space, size, radius, border, blur, motion.
- **Semantic + Component**, with a group per family, then the helpers, then
  component samples.

Each semantic group is a table: `Token`, a cell per mode, `Value` (each mode's,
separated by `·`), `What it is for`.

- **A mode's cell is a frame with
  `setExplicitVariableModeForCollection(semantic, mode)`.** The sample then
  resolves through the variable, not through a copied hex.
- **Component samples are built only from component variables**, on one stage
  per mode.
- **Canvas text goes through one helper:** load the font, `createText`, apply
  the text style, set `characters`, bind the fill, fix the width and let the
  height grow.
- **Descriptions come back HTML-escaped.** Writing `Don't` reads back as
  `Don&#39;t`. The variables panel shows it right; only text copied onto the
  canvas is wrong. Unescape before `characters`.
- **Frames do not follow their content:**
  - a section does not grow with its content, so resize it after filling, with
    the bottom margin kept;
  - a sample frame clips a shadow, so set `clipsContent = false`.

When the bands land, a third section, **Breakpoint**, is a table of each band
token with a cell per band.

## Validation

It runs in two places, because the generator is what could be wrong.

- **In Figma**, one call checks:
  - variables per collection equal the JSON's tokens in that tier, plus the
    helpers in Theme;
  - styles equal the composites, plus one for each gradient split by mode;
  - the mode names are the JSON's modes;
  - broken aliases, empty descriptions, and text styles with family, size or
    weight unbound are each 0.
- **Outside Figma**, a verify script that resolves the JSON on its own, without
  the generator's code. It compares every token's value in each mode with what
  the variable resolves to, and lists what exists only in Figma. That list must
  be exactly the helpers.

**Float drift is expected, and it is named rather than hidden.** Alpha 0.9 is
stored as 0.89999998, so it reads back as hex `e5` instead of `e6`. A line
height of 1.4 reads back as 1.399…. Round for display, and name any drift that
survives rounding in the report.

## Carrying a change across

**Carry a change once its code side is green.** Figma has one version and the
repo has branches, so a branch that is dropped after its Figma pass leaves
drift to undo by hand.

- **Build the name maps first.** Every step below finds variables and styles by
  name.
- **A new token** is created in its collection after its alias target exists,
  with a sibling's scopes, or `[]` and hidden from publishing if it is a
  primitive or a component variable, and its rule as the description.
- **Rename in place:** a variable or a style keeps its ID, so everything bound
  to it follows.
- **Removing and recreating breaks every binding.** Before you do it, check what
  is bound to the old variable.
- **Redraw the rows the change touched.**
  - Clone a sibling row, so the page keeps one layout.
  - Rebind every sample in the clone to the new variable. A clone keeps the
    sibling's bindings and paints the sibling's colour.
  - Set the clone's text.
  - Resize the section.
- **Validate.** Run the in-Figma checks, and compare every touched token's
  resolved value in each mode with the JSON.

## Not done yet

- Code syntax per variable. It reads back as `{}`.

It is open, not decided against.
