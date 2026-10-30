# Brief: the design system pipeline is opt-in at /setup

## Objective

Setting a client up no longer queues the design system pipeline on its own;
`/setup` offers it, "Not yet" first and default, and it stays available to ask
for later.

> SOURCE: Ian, 2026-10-22, question UI

## Differentiator

Today a client with no design system, or a design file only, gets the eight
stages in its spec and backlog without being asked: too much at once for a new
user. The operation (briefs, hooks, skills) stays as it is.

> SOURCE: Ian, 2026-10-22, Hakuna workshop alignment meeting (Granola) and the workshop doc ("Modificar template: Opt in ds pipeline")
> SOURCE: Ian, 2026-10-22, question UI, scope "/setup asks"

## Context and rules

- [CLIENT.md](../.claude/skills/setup/CLIENT.md) step 3 puts the eight stages
  in the spec's Tasks, step 4 one backlog item each, when the design system is
  "none" or "a design file only". The question is asked only then.
- Call 2 holds four questions, its cap, so the new one goes in a further call.
- Options, recommended first: "Not yet" (no stages in spec or backlog; one
  line says how to ask for it later) and "Yes, now" (today's behaviour).
- CLAUDE.md's pipeline line changes inside `pnpm check:floor`'s budget.
- [pipeline.md](../docs/foundation/pipeline.md)'s entry says opt-in, and how
  a person starts it later: by asking, through the normal gate.
- English; surgical; orphans cleaned.

> SOURCE: Ian, 2026-10-22, question UI

## Dependencies

None.

> SOURCE: Claude, 2026-10-22

## Scope

In: CLIENT.md; the pipeline line in CLAUDE.md; pipeline.md's entry; any doc
sentence that would now be false (backlog/README.md's "Where it starts", the
other files `grep -c pipeline` names); any spec pinning that text.
Out: the design system skills themselves, hubble-product-ops, the stale
worktree `.claude/worktrees/still-open-queue`.

> SOURCE: Ian, 2026-10-22, question UI, scope "/setup asks"

## Tasks

1. The question and the "Not yet" branch in CLIENT.md; CLAUDE.md, pipeline.md
   and the backlog README adjusted. One commit.
2. Validation at the end over the whole diff, then the merge to main.

> SOURCE: Ian, 2026-10-22, question UI, "Go"

## Autonomy

Checkpoints, as director: one subagent per task. Rung `default`, effort high.
Not `census`: where the question sits and what each sentence now says is
judgment, not a sweep.

> SOURCE: Ian, 2026-10-22, question UI, "Go"

## Validation

- `pnpm lint` exit 0.
- `pnpm test:run` green, not below 38 files (830 passed, 20 skipped).
- `pnpm check:briefs` lists this brief `ok`.
- `pnpm check:floor` ok, CLAUDE.md within 4250.
- `pnpm check:copy` ok.
- diff-review over the whole diff.

[PDR-0007](../docs/decisions/0007-verify-at-the-end.md)
