# Brief: the welcome page in English, by a toggle

## Objective

The Product Ops welcome page reads whole in English through an ES/EN toggle
beside the theme toggle; Spanish stays the default and the choice is remembered.

> SOURCE: Ian Rueff, 2026-10-29, "agreguemos un toggle para cambiar a ingles"

## Differentiator

Today the page is Spanish only, and an English reader's alternative is the
browser's translator, which garbles the terminal blocks, code and SVG labels.

> SOURCE: the agent, 2026-10-29, reading the artifact at version 1792681265-b91c

## Context and rules

- The page: https://claude.ai/artifact/7wgEwtMxX6EBYhkfmTct3G, edited in place
  from version 1792681265-b91c; no copy of its source lives in this repo.
- Its theme toggle and `localStorage` key are the pattern the language toggle follows.
- English wording comes from [GUIDE.md](../GUIDE.md) and [CLAUDE.md](../CLAUDE.md);
  the brief sample shows [the original brief](2026-10-08-onboarding-page.md) verbatim.
- The optional "build a design system" block goes: the pipeline left this
  template on 2026-10-27, [its brief](2026-10-27-drop-ds-pipeline.md).

> SOURCE: Ian Rueff, 2026-10-29, question UI: "Quitarlo en los dos idiomas"

## Dependencies

None.

> GAP: none known

## Scope

In: the toggle; every visible string, `aria-label`, SVG text and the title in
English; the pipeline block removed in both languages with its index entry,
its footer source and the CSS only it used.

Out: any other content or design change. The design-system skills that lived
only in that block (tokens, component and others) leave the page with it.

> SOURCE: Ian Rueff, 2026-10-29, question UI: "Go"

## Tasks

1. Remove the pipeline block, its index entry, footer mention and orphan CSS.
2. Add the English hero and main with their own ids, one shared bar with
   brand, theme and language; the script sets `lang`, the title and the saved choice.
3. Publish to the same URL.
4. Capture ES and EN, light and dark, at 390 and 1280 px.

> SOURCE: Ian Rueff, 2026-10-29, approved at the gate

## Autonomy

Checkpoints, as director: one worker per Task. Rung `default`, effort high.
Not `decision`: a republish is reversible.

> SOURCE: Ian Rueff, 2026-10-29, question UI: "Go"

## Validation

- Captures at 390 and 1280 px, ES and EN, both themes: no horizontal scroll.
- The EN view's visible text holds no Spanish string; each EN index link lands
  on its section.
- `pnpm check:briefs` exit 0 over this file.

> GAP: no automated check reads an artifact; the captures are the judge
