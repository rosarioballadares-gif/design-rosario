---
name: component
description: New component - one kind, classified primitive or featured, then its wrapper, story, record and Figma set.
---

# component

**One component kind becomes a `<Prefix>` component twice: a
wrapper on the headless framework in `src/ds/components/`, and a set in the
client's library file, bound to the client's variables.** `<Prefix>` is the
token set's prefix in [`config.json`](../../../src/ds/tokens/config.json),
capitalised; the headless framework is the one installed behind `src/ds/`.
**Ask for one kind at a time** — a prompt that names the library has no finish
line.

Run `parity` at intake: this skill is its component row. The worked example
is a previous client's pilot, a switch, and the component skill it grew into,
with a table of 27 kinds: every step below produces the same file it did.

## The line, and the first run's record

**Primitive or featured** — a previous client's
[PDR-0013](../../../docs/decisions/0013-primitive-and-featured.md):

- **Primitive**: lives in `src/ds/components/<Prefix><Name>.tsx`, every variant
  names a screen that draws it, and nothing in its props, JSDoc, story or
  Figma sample is defined by one screen.
- **Featured**: tied to one place in the product; lives in
  `src/features/<area>/`, takes no prefix, and composes primitives.
- The test: **could a second screen use it unchanged?**

**The first run writes the client's PDR** from
[the template](../../../docs/decisions/TEMPLATE.md), adopting or changing that
line, the record's fields below and the JSDoc's clauses. Every later run cites
it.

## The kind

The kinds and where each comes from are a table the client keeps. Add to a
row, as a previous client's table did, what the run in front of you settles: the export
(`<Prefix><Name>`), the layer (primitive or featured), the headless part, the
set it is copied from in the reference file when one exists, and the Figma
page (`CONTROLS`, `OVERLAYS`, `NAVIGATION`, `DATA DISPLAY`, `LAYOUT`,
`FEATURED`). A column that would read the same on every row adds nothing.

**The look of each kind** comes from the screens that draw it — the design
file or the prototypes — measured per
part and state as a token. **A reference file gives structure only**: layer
names and property names, never the look.

## Steps

Each ends on its criterion. The capture, `test:run` and voice-audit of steps 3
to 5 are met once, at the end, over the whole diff
([PDR-0007](../../../docs/decisions/0007-verify-at-the-end.md)); until then,
each commit builds. Code first: steps 1 to 5 are committed before that end, and
Figma's steps 6 to 8 mirror the branch after it; step 9 commits the files they
touch.

0. **Classify**, with the line above. List every screen that draws the kind,
   and what each one draws. A variant, anatomy, fixed copy or data shape that
   comes from a single screen is a *place*.
   - **Primitive:** steps 1-9. The variants are the ones the screens draw,
     each naming its screen.
   - **Featured:** first the primitives it composes. A variant a primitive
     lacks goes through steps 1-9 on that primitive. Then the component goes
     in `src/features/<area>/`, and its set on the library's `FEATURED` page
     built from primitive instances. It gets steps 3, 5, 7 and 9, and no
     tokens or record of its own.
   *Done when* every variant about to be built names a screen that draws it,
   and nothing in the primitive's props, JSDoc, story args or Figma sample is
   defined by one screen.
1. **Tokens.** Only in a set with the component tier ([PDR-0015](../../../docs/decisions/0015-component-tier-optional.md));
   without it, the CSS reads the semantic variables directly and this step
   only adds the semantic tokens the screens lack. Add `<name>.*` to
   `src/ds/tokens/component.json`, one token per
   part and state the screens draw, each pointing at a semantic token. **A
   part's text style is not a component token**: the build reads typography
   only from `text.*` and throws on one in `component.json`, so the CSS reads
   the semantic `var(--<prefix>-text-…)` directly. A measure with no semantic
   role points at a primitive; add the primitive when
   it is missing. **A colour never points at a primitive**: when no semantic
   token means it, add one to every mode file with its rule in
   `semantic/usage.json`, then its Theme variable in Figma. A gradient is a
   semantic token too; `vars.mjs` skips it, so in Figma it becomes Theme
   `…/from` and `…/to` variables and a paint style. The first component
   token also opens the `Foundations/Component` story (the `tokens` skill,
   step 9). Run `pnpm tokens`.
   *Done when* `pnpm check:tokens` is green and every value the screens draw
   has a token.
2. **The wrapper.** `src/ds/components/<Prefix><Name>.tsx` and `.css`,
   exported from `src/ds/index.ts`.
   - Props are the ones step 0 found across the screens, named for the person
     placing it. A string that is really an enum is typed as the union.
   - CSS selects the framework's `[data-part]` and `[data-state]` and reads
     `var(--<prefix>-*)` only. A literal number or colour in it is a token
     that is missing.
   - **A native kind — a button, a link — has no part from the framework.**
     Style its states with pseudo-classes and ARIA attributes (`:hover`,
     `:focus-visible`, `:disabled`, `[aria-pressed]`), and select a
     `data-hover` and a `data-focus-visible` beside them, so the story can
     pin each state for its capture.
   - **An overlay renders inside the nearest `data-theme`.** A framework that
     portals to the body puts the overlay outside every theme but the root's,
     so an overlay opened in a light region paints dark: carry the theme onto
     the portal, as a previous client's `ThemedPortal` did.
   - A trigger passed with `asChild` has to take the ref: a plain element, or
     a component that forwards it. Without it the overlay opens at the page's
     top-left corner.
   - The JSDoc above `export function` is one sentence, then `Goes in:`,
     `Does not go in:`, `Particularity:`, then one line per variant.
     `guidance.spec.ts` reads it.
   *Done when* `pnpm build` is green.
3. **The story**, `<Page title>/<Prefix><Name>` beside the component, with
   `Controls`, `Overlays`, `Navigation`, `Data display` or `Layout` as the page
   title: a `Matrix` of every variant in every mode, the modes stacked one
   above the other so the capture's width holds a whole row, and a
   `Playground`. An overlay's `Matrix` renders it open.
   *Done when* `node scripts/shot.mjs --ready .<prefix>-<name> --ax 1 --shot "http://localhost:<port>/iframe.html?id=<story-id>&viewMode=story=<png>"`
   writes a capture you have read, in every mode, and the `ax` lines name
   every control **with the role its ARIA pattern requires** — `switch`,
   `tab`, `combobox`. A build and a capture both pass over a wrong role:
   Ark's Switch exposes its hidden input as `checkbox` until the wrapper
   sets `role="switch"`, measured in the rehearsal of 2026-10-08. Read the port off Storybook's own output: it takes the next
   free one when 6006 is busy, and 6006 may be serving another checkout.
4. **The record**, `src/ds/guidance/records/<Prefix><Name>.ts`, registered in
   `index.ts`: `exportName`, `sourcePath`, `figmaNode`, `group`,
   `competesWith`, `insteadOf`, `guidance` (`summary`, `useWhen`, `do`,
   `dont`) and `source`. A kind with no rival has `group: null`. Every member
   of a group names every other in `competesWith`, with one `insteadOf` line
   each, so a new member edits every earlier record of its group as well as
   the `GROUPS` entry. The group test fails until it does.
   *Done when* `pnpm test:run` is green with no fewer files than before.
5. **`voice-audit`** over the JSDoc, the record and the story's copy.
6. **Figma variables.** `node .claude/skills/component/figma/vars.mjs <name>`
   prints the payload; write each entry's `d` (one sentence: what part it
   paints) and paste it into [vars.js](figma/vars.js).
   *Done when* every component token is a variable, aliased as in the JSON;
   without the tier, there is nothing to paste.
7. **The set.** With a reference file: [read-reference.js](figma/read-reference.js)
   on it with `KEEP` holding the variants the screens draw; then
   [build.js](figma/build.js) on the client's library with that output, `DROP`
   for the reference's properties the client lacks, `COLOR` for the reference
   variables that survive, and `RULES` for the screens' measurements. Without
   one, write `DATA` by hand in the layer naming a reference would use.
   `use_figma` takes code, not a path, so paste each file whole with its
   constants — the file keys among them — replaced.
   - Rename the reference's variants in `DATA` to the client's axes, and
     `skip` the parts the screens never draw, such as a tooltip arrow.
   - Property names follow the **Figma prop names** table in
     [GetStarted.mdx](../../../src/ds/GetStarted.mdx), emoji first.
   - A shadow token is not a variable: bind the effect style of the same name
     with `effect`.
   - A padded frame with a border turns on "Include strokes in layout"
     (`strokesIncludedInLayout`) to match CSS's border box.
   - A kind that is a group of options, such as a segmented control, a radio
     group or tabs, is one set for the whole group, with a `✅ Selected` variant
     per option. A tree is a set of rows, with `☑️ Selected` on or off.
   - Match the set's width to the story's content width. An inline `width`
     with `padding` in a story is content-box, so add the padding.
   - `build.js` draws no glyph, round cap, paint style, weight, minimum
     height or line clamp, so a row always needs a second call:
     `createNodeFromSvg` for a glyph, `setFillStyleIdAsync` for a gradient,
     `setRangeBoundVariable` for a styled text's weight or size
     (`setBoundVariable` is ignored there).
   - A slot is a native `SLOT` property. `build.js` draws it as a plain frame,
     so a second call converts that frame, named as the property, in every
     variant: `key = set.addComponentProperty(<name>, 'SLOT', '')` once on the
     set, then `frame.componentPropertyReferences = { visible: <its 👁️ key>,
     slotContentId: key }`, which replaces the whole object. The frame keeps
     its auto layout, its children become the default content, and
     `resetSlot()` brings them back on an instance. A hidden slot is missing
     from `instance.children`. A mask fades a slot, or a frame that clips
     (`createFrame()`'s default), only through a wrapper with
     `clipsContent = false`. A throwaway instance proves the set: `remove()`
     each slot's children, `appendChild` other content, screenshot, delete.
   - A layer inside a slot takes no property reference: converting the frame
     drops its children's `✏️` and `👁️` references for good, and an instance
     that set one falls back to the default. Before converting, list every
     instance of the variant on every page (`getMainComponentAsync`) with its
     value and visible text. After, write each value into the text in its
     slot, and say in the doc that the property no longer drives that variant.
   - An outer instance edits a nested instance's slot: it adds, removes and
     resizes children there, frames inside it included. So a featured set
     fills its primitives' slots and keeps them instances.
   - A set composed of other sets, such as the app shell, places their
     instances in a hand-written call: `build.js` cannot place instances.
     An image goes in through `upload_assets` with the node ids, because
     `figma.createImage` stores one that never renders.
   - Cloning a variant inside a set drops its property references. Rebuild
     them on the clone.
   *Done when* `unmapped` comes back empty and a `get_screenshot` of the set
   matches the story's capture part for part.
8. **The Section**, [doc.js](figma/doc.js) with the JSDoc's copy and the
   record's lists, and the record's `figmaNode` set to the set's id. `STAGES`
   sets every text property per instance: a text property's default shows on
   every variant. The Don't list drops the record's leading `Do not`, because
   its heading already says it. **The first component has no documentation
   frame to clone**: draw that one by hand in the shape `doc.js` fills —
   header, variants with one stage per mode, where it goes, usage — and its
   ids become `MODEL_SECTION` and `MODEL_DOC` for every later run.
   *Done when* a `get_screenshot` of the Section reads in every mode, with
   nothing cropped and the Section wrapping its content.
9. **Commit** the component's files by name, one commit per component.

## Gotchas

- **A reference file that is not a library of the client's file** answers
  `importComponentSetByKeyAsync` with "not found", so the copy is
  `read-reference.js` then `build.js`.
- **Two files can name a variable alike and mean different things** — a previous
  client's file and its reference file both had a `control/bgColor`. A reference colour is
  carried only through `COLOR`, never by its name.
- **`findOne` skips the hidden children of an instance.** Read `children`.
- **Figma bindings that do not behave like CSS:**
  - an opacity variable is in per cent (`opacity/70` holds 70);
  - binding a text's size, weight or line height unlinks its text style, and a
    unitless line height binds as pixels, so keep the style and leave line
    height literal;
  - a paint's own opacity cannot bind: put the fill on a layer behind;
  - a gradient stop bound to a variable takes the variable's alpha, so a stop
    that fades out stays a literal colour at alpha 0;
  - a text cannot bind a minimum width: wrap it in a frame that does.
- **A kind whose value is a length:** a bar stretches with its track, sized
  after its text and minimum widths are bound; a thumb (slider) gets a
  position variant built from spacer layers, because an instance's inner layer
  cannot be moved.
- **A reference's text properties often live on nested instances**, which the
  copy flattens. Declare the `✏️` properties in `DATA.props` yourself, and
  remove a layer's `ref` when you keep the layer but drop its property.
- **Captures:**
  - story ids are kebab-case: `NoMatch` is `--no-match`;
  - a headless framework renders a closed overlay's content hidden, so wait on
    `--ready ".<prefix>-<name>[data-state='open']"`, not the bare class;
  - give the output as `C:/…`: Node writes a `/c/…` path under `C:\c\`;
  - two focus-taking overlays open in one story fight over focus, and a
    highlighted row is held by a keydown sent through `--eval`.
- **Overlays, measured on Ark UI in a previous client:**
  - mount with `lazyMount` and `unmountOnExit`: a CSS `display` on the
    content overrides the framework's `[hidden]`;
  - a non-modal drawer takes the focus unless `initialFocusEl` is set;
  - passing any `onOpenChange` turns off a drawer's snap-back;
  - start transitions only after the framework has measured the drawer;
  - synthetic pointer events do not drive a drag. Prove a drag with CDP
    input, not a dispatched event.
- **A page-covering overlay**, a dialog or a modal drawer, gets one story per
  variant, captured once per mode with `&globals=theme:<mode>`, instead of a
  side-by-side `Matrix`, inside a fixed full-window wrapper that covers the
  preview's 32px padding.
- **A component token cannot point at another component's token**
  (`tokens.spec`). Where two components share a drawing, as a menu and a
  combobox list do, the second reads the first's variables in CSS and Figma.
- **Storybook reads `src/ds/` and `src/features/`** (`stories` in
  `.storybook/main.ts`), nothing else.
- **A Section does not grow with its content.** `doc.js` resizes it; redo that
  after any later edit.
- **The worktree's bash guard refuses a command that mixes git with anything
  else**, a heredoc that names it included. Run git on its own line, and edit
  files with the editor or a script file.
