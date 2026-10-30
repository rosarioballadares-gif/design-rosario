---
name: component-props
description: A Figma set's properties or docs - their order, a 👁️ that is a variant, a missing description, a library sweep.
---

# component-props

**A set's properties read like the component: variants first, then slots, then
every `👁️`, `✏️` and `🔃` in layer order, each layer's `👁️` before its `✏️`
before its `🔃`. The set and each of its variants carry a description.** The
worked example is a previous client's header set, whose order was approved at a
checkpoint and then swept across that library.

> SOURCE: Ian, 2026-09-30: "las props de estados y variantes van primero luego
> las de mostrar ocultar o escribir", "agregar documentacion al componente y
> sus variantes"; the header's order approved at the checkpoint, question UI.

What each emoji means, and when a `👁️` may be a variant, is the **Figma prop
names** table in [GetStarted.mdx](../../../src/ds/GetStarted.mdx).

## How the order is written

No Plugin API call reorders properties. A property added last lists last, so
[prop-order.js](figma/prop-order.js) renames each `BOOLEAN`, `TEXT` and
`INSTANCE_SWAP` property, adds it again under its name, moves every layer's
reference onto the new one and deletes the old, in order, so they land in it.
The order is every variant's layer order merged: `A` before `B` in any variant
keeps `A` first, ties by first appearance. Then it reapplies each instance's
values and compares.

- **Slots and variants are never recreated.** A recreated slot empties the
  content of every instance. Slots therefore sit ahead of the `👁️`s; somebody
  who wants them last drags them by hand. Variants list first in the panel
  whatever order the API returns.
- **`setProperties` on a `TEXT` value writes plain text.** A range styled in the
  override, such as a card's `· Success` or a place card's `N active`, goes flat
  while the characters stay equal. The script snapshots every text with more
  than one fill segment, compares the segments and puts them back with
  `setRangeFills`.
- **A hidden subtree is not compared**, nor the layers of an instance under a
  hidden ancestor or inside a slot's content (its parents reach no page), only
  its properties: Figma lists their children stale or not at all, then in full
  after the write.
- **Every property key changes** (`Name#id`), on every instance in the file. A
  peer whose script names a key breaks; a peer resolving by name does not.

## Per set

1. **Census.** [census.js](figma/census.js) prints every set: its description,
   how many variants are described, `ok` or `REORDER`, and any `👁️` variant.
2. **Peers.** Name the `REORDER` sets to any peer writing in the file, and
   hold the ones whose instances it is overriding: a value set between the
   script's read and its reapply is lost.
3. **Dry run**, the first time the script runs in a session:
   [prop-order.js](figma/prop-order.js) with `SET` set and `DRY = true` ends in
   a throw and persists nothing. `ORDER = null` takes the merged order; a list
   of property ids overrides it. `pages` says where the instances live.
4. **Write.** The same with `DRY = false`. It throws, and persists nothing, on
   any diff, dangling reference, changed variant or export hash that moved: of
   every variant and of up to three instances with a toned range. Several sets
   fit one call as a function per set; a throw rolls back the whole call.
5. **`👁️` variant.** Show the person what the variant changes beyond visibility
   and ask whether it stays. A variant that only hides a layer becomes a
   boolean in a brief of its own: a previous client's header took a migration of 237
   instances.
6. **Descriptions.** The set's description is the JSDoc of its component in
   `src/ds/`; compare the two by a hash of the decoded JSDoc text. A set with
   no code counterpart gets one sentence on what it is for. A variant's description is one sentence on what it draws
   differently from its siblings, as a switch's `On`: "The track fills with
   ink and the thumb takes the page colour." Run **voice-audit** over them.

## Done when

`census.js` prints `ok` on every set, `variants/described` equal on every row,
a description length above 0 on every set, and every `👁️` variant left is one
the person kept.
