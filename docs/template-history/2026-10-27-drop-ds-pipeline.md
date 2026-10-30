# Brief: the design system pipeline leaves the template

## Objective

The template no longer offers or carries a from-zero design system pipeline;
building one becomes a separate repository, later.

> SOURCE: Ian, 2026-10-27, chat: "es un overkill, en tal caso en el futuro agrego un repo distinto para ese fin"

## Differentiator

Today `/setup` asks question 9 and the docs present eight stages, five of
them skills nothing else uses; doing nothing keeps that weight in every new
client's repository. The pipeline as it stands is kept in a local copy,
`C:\product-ops-ds-pipeline`, cloned at f7d181b with no remote.

> SOURCE: Ian, 2026-10-27, chat: "dejalo en un repo duplicado pero no subido a git q si tenga el pipeline"

## Context and rules

- [pipeline.md](../docs/foundation/pipeline.md) lists the stages; `stack`,
  `look-and-feel`, `headless`, `breakpoints` and `app-shell` exist only for it.
- [CLIENT.md](../.claude/skills/setup/CLIENT.md) asks question 9 in call 3 and
  queues the stages in "What it writes" steps 3 and 4.
- `git grep -il pipeline` names every other file that mentions it.
- Historical briefs are records and stay. Surgical; orphans cleaned; English.

> SOURCE: Ian, 2026-10-27, question UI, scope "Pipeline + 5 skills propios"

## Dependencies

None: main clean at f7d181b, in step with origin.

> SOURCE: Claude, 2026-10-27, git status

## Scope

In: pipeline.md and the five skills deleted; question 9 and the stage queue
out of /setup, "no design system" a blocked item like the other three; every
other mention the grep names reworded, stage lines in surviving skills
included; PDRs 0011-0014 keep their decision, only their stage line changes.
Out: `tokens`, `tokens-figma`, `component`, `component-props`, `sandbox`,
`parity`; the empty `src/ds/` and the token build; historical briefs; the
future repository; hubble-product-ops.

> SOURCE: Ian, 2026-10-27, question UI, scope "Pipeline + 5 skills propios"

## Tasks

1. pipeline.md and the five skills deleted; CLAUDE.md's rows and line.
2. /setup: question 9 and the stage queue out.
3. The other docs, skills, PDRs and code comments reworded.
4. Validation at the end over the whole diff, then the merge to main.

> SOURCE: Ian, 2026-10-27, question UI, "Go + worktree"

## Autonomy

Checkpoints, as director: one subagent per task. Rung `default`, effort high.
Not `census`: what each remaining sentence should say once the pipeline is
gone is judgment, not a sweep.

> SOURCE: Ian, 2026-10-27, question UI, "Go + worktree"

## Validation

- `git grep -il pipeline` names only briefs, bash-round-rules.cjs,
  brief-fields.mjs and context-floor.json.
- `pnpm check:links`, `check:skills-table`, `check:backlog` exit 0.
- `pnpm check:briefs` lists this brief `ok`; `check:floor` ok.
- `pnpm lint` exit 0; `pnpm test:run` green, not below 38 files.
- `pnpm check:copy` ok; diff-review over the whole diff.

[PDR-0007](../docs/decisions/0007-verify-at-the-end.md)
