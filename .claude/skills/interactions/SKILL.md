---
name: interactions
description: A Figma page's Interactions sections - building one from its route's code, or auditing their states and arrows.
---

# interactions

**An Interactions section shows, beside a copy of the page, every piece of it
in its other state: an instance of the real component, an Interaction note
saying what moves it, and an arrow from the piece to it.** It is read by
somebody who never runs the code, so every state comes from the code and none
from memory. The worked example is a previous client's devices page, whose
`Interactions · xl` section the rules below were measured on.

Two scripts carry the rules, and their constants are the single source of
truth for them: [arrow.js](figma/arrow.js) draws an arrow,
[audit.js](figma/audit.js) checks a section. Each runs as the code of one
`use_figma` call with the constants at its top filled in — the client file's
accent variable, its Interaction annotation category and its app shell's set
name among them; load `figma-use` before it.

## Building a section

1. **Census, from the route's code.** For each piece the page draws, find what
   moves it and what it becomes: a menu that opens, a tooltip on hover or
   focus, a control that redraws something elsewhere, a variant reached by
   picking another range or device. Write one row per state: trigger, the
   other state, the component and its variant in Figma (featured before
   primitive). Two kinds take a note and no state: a link that navigates
   (its note goes on the piece's state, or on the piece in the copy), and
   what the camera does (zoom, locate, a fade with zoom) — its note goes on
   the copy's own layer, with no arrow. **Show the census to the person and
   wait: they strike what is extra.** Done when every state in it is approved.
2. **The section.** A SECTION filled `#444` literal, Dark, with the band's
   Breakpoint mode, named `Interactions · <band>` (on a page of several ideas,
   `<N> · <idea> · Interactions · <band>`). Its first child is the page copy,
   an instance of the client's app shell set cloned from the band's frame, with the annotations
   the clone carries from the frame cleared: they stay on the frame, and the
   audit counts any outside Interaction. Place it where the
   page says: under the bands at x 0, or in the idea's row.
3. **The states.** Each an instance of the component in its other state,
   named `<Piece> · <state>`, set by its properties, never detached. A state
   the component has no variant for gets the variant on the component first.
   Lay them round the copy so that each arrow runs straight to its piece
   without passing another state or another arrow.
4. **The notes.** One annotation in the file's Interaction category on each
   state instance, in English: what the person does, then what changes — "The range
   pill opens its menu. The picked range redraws the list and the device's
   activity." Set the plain `label`. Run **voice-audit** over them.
5. **The arrows.** [arrow.js](figma/arrow.js) with one `ARROWS` row per
   state, from the piece's layer in the copy (or in another state, for a
   chain) to the state. It throws, persisting nothing, where an arrow would
   cross something: move the state, or set that row's side.
6. **Audit.** [audit.js](figma/audit.js) with `SECTIONS` set to the new
   section, and `get_screenshot` of it. Done when `findings` is 0 and
   `unchecked` is empty.

## Auditing sections

[audit.js](figma/audit.js) with `SECTIONS = []` reads every section in the
file whose name has "Interactions" and prints, per section, one finding per
broken rule: a state with no note or not an instance, a broken arrow recipe,
an end off its gap, a crossing, a state no arrow reaches. Its header says
what it cannot see. A repair is work of its own: report the findings and
take the fix through a brief.
