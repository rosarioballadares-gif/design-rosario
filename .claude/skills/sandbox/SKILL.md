---
name: sandbox
description: Prototyping a screen - its file in src/sandbox, its registry entry and a variant per state, captured.
---

# sandbox

**The rule: a screen is designed in all its states, and each state has a
route.** A prototype that only exists full, with plausible data in every slot,
has been illustrated rather than designed. Empty, loading, error, one item,
too many: each is a variant with its own hash, so it can be captured, reviewed
and noticed when it regresses.

The mechanism is already in this repository:
[`src/sandbox/registry.ts`](../../../src/sandbox/registry.ts) is the single
source the index and the router read, and
[`src/route.ts`](../../../src/route.ts) resolves `#/<id>/<variant>` against
it. A previous client's registry held eleven prototypes this way.

## Steps

1. **Name the states.** What the screen shows when it has nothing, when it is
   waiting, when it failed, when it has one item, the usual amount and too
   much — whichever of those it can reach. One kebab-case variant name per
   state.
   *Done when* the person has accepted the list, and each state names what
   the screen shows in it.
2. **The prototype.** `src/sandbox/<id>/<Name>.tsx`, a component taking
   `{ variant?: string }`, placed in the app shell when the shell exists. Its
   data sits in a file beside it, one fixture per variant, never behind a
   network call. It imports components from `src/ds` only — a vendor package
   named here breaks the seam. Its markup takes only `var(--<prefix>-*)`.
   *Done when* `pnpm build` is green,
   `grep -nE '#[0-9a-fA-F]{3}|[0-9]+px|@media' src/sandbox/<id>/*.css` prints
   nothing, and `git grep -l "<headless package>" -- src ':!src/ds'` prints
   nothing.
3. **The entry.** One object in `PROTOTYPES` in `registry.ts`: `id` (stable —
   somebody will save the link), `title`, `summary` (what it shows, not how
   it was built), `variants`, `site: true` when the index should list it, and
   `render`. Set `data-shot-ready="true"` on the prototype's root once what it
   draws has settled — a map or a chart after its first frame — or capture
   it with `--ready <selector>`.
   *Done when* the index lists it and `#/<id>/<variant>` opens each variant.
4. **Capture every variant.**
   `node scripts/shot.mjs --shot "http://localhost:<port>/#/<id>/<variant>=docs/product/<ProductId>/research/<date>-<id>/<variant>-<width>.png"`
   per variant, at the bands the screen is designed for, and read each
   capture. `<port>` is the one `pnpm dev` printed: Vite takes the next free
   one after 5173, and another checkout may hold 5173. `shot.mjs` prints its
   default base, 5175, even when every `--shot` carries its own URL; the URL
   wins.
   *Done when* every variant has a capture you have read, and each shows the
   state step 1 named.
5. **voice-audit** over the screen's copy.
   *Done when* it reports no finding, or each finding has the person's
   answer.

When the design tool is Figma and reachable, the screen's frame is built from
the library's instances, and **interactions** documents what moves on it — a
task of its own with its own brief, so this skill closes on its code half.
When nobody can reach the file, that task is the blocked Figma item `parity`
describes.
