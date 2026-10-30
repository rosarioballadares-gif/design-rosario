# Brief: the worktree guard reads paths the same on every platform

## Objective

`worktree-edit-rules.cjs` decides the same on Linux, macOS and Windows, and CI
on `main` is green again.

> SOURCE: CI run 37871315610 on studiohakuna/product-ops-base, 2026-10-08

## Differentiator

The guard landed under [the user-hooks brief](2026-10-08-user-hooks.md), whose
Validation asked for `test:run` green. It was green on Windows only: on the
Linux runner `node:path` read `C:\repo` as a relative name, and four tests
failed.

> SOURCE: the agent, 2026-10-08, the run's failed log

## Context and rules

[worktree-edit-rules.cjs](../scripts/worktree-edit-rules.cjs) normalised with
the platform's `path`. The repair converts both separators itself and uses
`path.posix`, recognising a drive letter as absolute.

> SOURCE: the agent, 2026-10-08

## Dependencies

None.

> SOURCE: the agent, 2026-10-08

## Scope

In: the rule's normalisation and a POSIX case in its spec. Out: everything
else in the guard.

> SOURCE: the agent, 2026-10-08, within the approved user-hooks scope

## Tasks

1. Normalise without the platform's `path`.
2. A spec case with POSIX paths.
3. Merge, gate, push on Ian's confirmation.

> SOURCE: the agent, 2026-10-08

## Autonomy

Checkpoints. Rung `repair`, effort `medium`. Not `default`: one function,
its failure measured.

> SOURCE: the agent, 2026-10-08

## Validation

- The guard spec green here, and the CI run after the push green on Linux.

> SOURCE: the agent, 2026-10-08
