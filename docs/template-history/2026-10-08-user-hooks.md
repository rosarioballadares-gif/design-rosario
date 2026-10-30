# Brief: the method's user-level hooks and the base's inherited gaps, closed

## Objective

Whoever clones the base gets the worktree guard and the plugins Ian works
with, and the nine points raised at the 2026-10-08 close are done or decided.

> SOURCE: Ian Rueff, 2026-10-08, question UI

## Differentiator

Today those hooks and plugins ride in Ian's own `~/.claude/settings.json`, so
a workshop designer gets "Go + worktree" without the guard that makes it safe.
The inherited gaps cost every rehearsal stage 2 to 8 brief trims, and CRLF
noise on every git command.

> SOURCE: the rehearsal of 2026-10-08, its stage reports

## Context and rules

The guard's source is `~/.claude/scripts/guard-worktree-edits.cjs`, ported
without nx. Plugins: `superpowers`, `frontend-design`, from
`claude-plugins-official`. Byte budgets: [brief-fields.mjs](../scripts/brief-fields.mjs),
a table is added with a date, never lowered in place. `session-cost.mjs:77`
imports `eval-cost.mjs`, which never existed, in that client's history either.
`shot.mjs:217` captures the viewport only. Blobs are LF already; only the
working tree is CRLF.

> GAP: how much context `superpowers` adds per session; its SessionStart hook
> injects a whole skill, and `check:floor` does not see plugins.

## Dependencies

None outside this repository. `main` is published at `5c5fea0`.

> SOURCE: `git status -sb`, 2026-10-08

## Scope

In: the guard with its spec; `enabledPlugins`; the sounds as an optional
block in WIRING.md; `.gitattributes` LF; a budget table from 2026-10-09;
`pnpm lint` with scope and verdict; `shot.mjs --full`; `pnpm cost` running;
how an effort above the session's is applied.

Out: `guard-nx-worktree`, that client's map redirect, the effort in settings.

> SOURCE: Ian Rueff, 2026-10-08, question UI

## Tasks

1. Guard: rules module, spec, PreToolUse on Edit, Write, NotebookEdit,
   MultiEdit.
2. Plugins; sounds in WIRING.md.
3. `.gitattributes`, working tree refreshed.
4. Budgets from 2026-10-09: Scope 700, Tasks 800, Autonomy 350,
   Validation 900.
5. `scripts/lint.mjs`.
6. `shot.mjs --full`.
7. `pnpm cost`: the eval section goes.
8. `model-and-effort`: a higher rung runs in a subagent with `effort`.
9. checks.md, GUIDE.md, backlog.

> SOURCE: the nine points Ian chose, 2026-10-08

## Autonomy

Checkpoints. Rung `default`, effort `high`. Not `decision`: each point is
reversible and closes off no other shape. No fan-out.

> SOURCE: Ian Rueff, 2026-10-08, "Go + worktree"

## Validation

- Guard spec green; a live edit from a worktree into main denied.
- `pnpm cost` exit 0; `pnpm lint` prints its verdict last.
- No CRLF warning on a commit.
- `shot.mjs --full` captures a long story whole.
- `check:briefs` ok; `test:run` at least 33 files; `build`; `gate`.

> SOURCE: the agent, 2026-10-08
