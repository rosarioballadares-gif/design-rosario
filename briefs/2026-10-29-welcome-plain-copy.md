# Brief: the welcome page in plainer words, both languages

## Objective

The welcome page reads faster and in plain words, in Spanish and in English,
with the same sections, facts and figures it has today.

> SOURCE: Ian Rueff, 2026-10-29, "too much text; content is fine, but the copy should read for humans: more direct, less complicated, in BOTH the es and en copies"

## Differentiator

Today each language runs about 2,500 visible words: one fact is told in several
sections (the plan and the yes, the 200k notice three times in Sessions) and
jargon (gate, worktree, director) goes unexplained in plain terms.

> SOURCE: the agent, 2026-10-29, word count over version 1793283003-cbe4: es 2463, en 2577

## Context and rules

- The page: https://claude.ai/artifact/7wgEwtMxX6EBYhkfmTct3G, edited in place
  from version 1793283003-cbe4; its source lives only there.
- The `[data-lang="es"]` and `[data-lang="en"]` copies say the same thing.
- Text only: structure, ids, CSS and SVG shapes stay; a figure changes only its labels.
- Comment thread 1237681e asks to remove "la versión de diez segundos" /
  "the ten-second version"; its auto-reply already promised it.

> SOURCE: Ian Rueff, 2026-10-29, artifact comment "saca esto"

## Dependencies

None.

> GAP: none known

## Scope

In: visible text, `aria-label`s and SVG text in both copies, cut about 23%
(es at most 1,930 words, en at most 1,995); the ten-second line in both.
Terminal blocks, code and the sample brief stay verbatim.

Out: new or removed content, any design change, and bringing back the
design-system skills that left with the pipeline block.

> SOURCE: Ian Rueff, 2026-10-29, question UI: "Go", "−30% (Recommended)", then "Aceptar −23% (Recommended)"

## Tasks

1. Rewrite the Spanish copy to its target.
2. Mirror the new Spanish in the English copy.
3. voice-audit both copies and apply its fixes.
4. Publish to the same URL; reply on and resolve thread 1237681e.
5. Capture ES and EN, light and dark, at 390 and 1280 px.

> SOURCE: Ian Rueff, 2026-10-29, approved at the gate

## Autonomy

Checkpoints, as director: one worker per Task. Rung `default`, effort high.
Not `decision`: a republish is reversible from the artifact's versions.

> SOURCE: Ian Rueff, 2026-10-29, question UI: "Go"

## Validation

- The session's word count script: es at most 1,930, en at most 1,995.
- The same 11 sections, `h2`s and index entries in each language; each index link lands.
- Neither copy contains "diez segundos" or "ten-second".
- voice-audit: 0 findings in either language.
- Captures at 390 and 1280 px, ES and EN, both themes: no horizontal scroll.
- `pnpm check:briefs` exit 0 over this file.

> GAP: no automated check reads an artifact; the count and the captures are the judge
