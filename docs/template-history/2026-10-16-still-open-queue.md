# Brief: Still open and the checkpoints queue, back from hubble-product-ops

## Objective

product-ops-base's director keeps a partial worker's leftover work in a file
and runs a multi-stage queue in checkpoints, as hubble-product-ops now does.

> SOURCE: Ian, 2026-10-16: "actualiza el prod ops tmb con ese arreglo, es mejor q el q tiene y pushea alla"

## Differentiator

Here a partial worker in checkpoints leaves what is left only in its one-line
report, the queue runs only in autopilot, and `pnpm handoff` pastes full
commit subjects. hubble-product-ops fixed all three at 61e3de9.

Hubble's brief: hubble-product-ops at 61e3de9, `briefs/2026-10-16-director-checkpoints.md`

## Context and rules

- Source: hubble-product-ops at 61e3de9: autopilot.md's In checkpoints, Budget
  and Queue; CLAUDE.md's director rule; handoff.mjs's 100-character cut; the
  notice's subagent line; their specs.
- Ported generic: hubble's own examples (Claim and Transfer) stay out.
- CLAUDE.md is under check:floor.

> SOURCE: Claude, 2026-10-16, diffing both repos

## Dependencies

hubble-product-ops at 61e3de9, pushed.

> SOURCE: git log, 2026-10-16

## Scope

In: autopilot.md (Still open and its brief fallback, the queue in checkpoints
and where it lives, Budget's director bullet split); CLAUDE.md's "edits no code
and no Figma"; handoff.mjs's cut and spec; the notice's subagent line and spec.
Out: anything else differing between the two repos.

> SOURCE: Ian, question UI, 2026-10-16: "Go + worktree (Recommended)"

## Tasks

1. Worker: port the four pieces in a worktree, one commit.
2. Director: the end checks over the diff; a fix worker if red.
3. Merge, lint and build on main, gate, push.

> SOURCE: Claude, 2026-10-16

## Autonomy

Checkpoints, push pre-authorized by Ian. Rung `default`, effort high. Not
`census`: stripping hubble's specifics is judgment.

> SOURCE: Ian, 2026-10-16: "pushea alla asi queda en git en main"

## Validation

- `pnpm test:run` green, file count not below the run before.
- `pnpm check:floor`, `check:briefs`, `lint`, `check:copy` ok.
- `pnpm handoff "x"` cuts each commit at 100 characters.
- diff-review over the diff.

[PDR-0007](../docs/decisions/0007-verify-at-the-end.md)
