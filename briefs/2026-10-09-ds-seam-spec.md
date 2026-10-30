# Brief: a spec holds the src/ds/ seam

## Objective

A vendor package imported anywhere under `src/` outside `src/ds/` fails
`pnpm test:run`, so the seam holds by a check rather than by prose.

> SOURCE: Ian Rueff, 2026-10-09, question UI

## Differentiator

Today the rule is two sentences — [CLAUDE.md](../CLAUDE.md) and
[src/ds/README.md](../src/ds/README.md) — and nothing fires. The backlog entry
says writing it before the first vendor import is what stops the second.

> SOURCE: [backlog/01-wiring.md](../backlog/01-wiring.md), "Nothing checks
> that a vendor import stays inside `src/ds/`"

## Context and rules

- No vendor exists yet, so a denylist would have nothing to name: the spec is
  an allowlist. Outside `src/ds/`, only `react`, `react-dom` (and subpaths),
  `vitest` and `node:*` — everything `src/` imports there today.
- Any other package fails until it moves behind `src/ds/`, or joins the list
  in the same diff with its reason.
- The spec tests its own matcher on a sample vendor import, so a broken regex
  cannot report green.
- Forms read: `import … from`, `import '…'`, `export … from`, `import()`; in
  `.ts`, `.tsx`, `.mdx`.

> SOURCE: the agent, 2026-10-09 — every import under `src/` outside `src/ds/`,
> listed

## Dependencies

None outside this repository.

> SOURCE: the agent, 2026-10-09

## Scope

In: `src/ds/seam.spec.ts`; one line in `src/ds/README.md` naming it; the
backlog entry `landed`. Out: `CLAUDE.md`, for the floor; an oxlint rule, since
whether oxlint takes an allowlist is unmeasured here.

> SOURCE: Ian Rueff, 2026-10-09, question UI — Go + worktree

## Tasks

1. The spec and its self-test.
2. The README line and the backlog entry.
3. End checks, merge, gate, push on Ian's confirmation.

> SOURCE: the agent, 2026-10-09

## Autonomy

Checkpoints. Rung `default`, effort `high`: a new check with a real diff.

> SOURCE: the agent, 2026-10-09, the model-and-effort ladder

## Validation

- `test:run` green at 36 files, one more than today's 35.
- A temporary vendor import in `src/Root.tsx` makes it fail naming the file
  and the package; reverted, captured.
- `check:backlog`, `check:briefs`, gate.

> SOURCE: the agent, 2026-10-09
