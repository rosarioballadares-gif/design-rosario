# Brief: worktree:close refuses a folder something still stands in

## Objective

`pnpm worktree:close` never dies halfway: when something it cannot stop still
stands in the worktree folder, it refuses before removing anything and says
what to do.

> SOURCE: Ian Rueff, 2026-10-08 — handoff: "the worktree-close.mjs crash gets
> its own brief"

## Differentiator

Today the run crashes with an uncaught `EPERM` at `rmSync`
([worktree-close.mjs](../scripts/worktree-close.mjs), line 118) after git has
already unregistered the tree: folder and branch are left for hand cleanup, as
with `user-hooks` on 2026-10-08. Doing nothing keeps that for every session
that closes the tree it stands in.

> SOURCE: the agent, 2026-10-09 — reproduced, stack-trace tail identical to
> 2026-10-08; a no-holder control passed

## Context and rules

- Root cause, measured: a process that is not node has its working directory
  inside the tree — on 2026-10-08 the Claude Code session itself, whose primary
  working directory was the worktree. `processes.list()` matches node
  processes by command line and Win32_Process exposes no working directory, so
  the stop step cannot see it.
- A rename probe sees it: `renameSync` on the held folder fails with `EBUSY`,
  and succeeds once free.
- The script already refuses a run from inside the tree for this reason (its
  header, "WHAT IT REFUSES"); this extends that refusal to any other process.
- Still never `--force`, never `-D`.
- At this brief's own close, a second holder: the editor's TypeScript server
  watching the tree's `node_modules` — `EPERM`, freed once it stopped. The
  FAIL line names both cases.

> SOURCE: the agent, 2026-10-09, repro in a throwaway worktree, cleaned up

## Dependencies

None outside this repository.

> SOURCE: the agent, 2026-10-09

## Scope

In: a `held(path)` probe in `scripts/worktree-processes.cjs` with its spec
case; in `worktree-close.mjs`, the refusal before `git worktree remove`, and
the late `rmSync` caught so a failure there reports the kept folder and still
runs the branch step; one sentence in the header.

Out: the guard seeing `ExitWorktree`; finding WHICH process holds the folder;
any change to how node processes are matched.

> SOURCE: Ian Rueff, 2026-10-09, question UI — Go + worktree

## Tasks

1. `held(path)`: rename to `<path>.probe` and back; returns the error code or
   null. A failed rename back is printed with both paths, never swallowed.
   Spec: a child with its working directory in a temp dir reads held, and free
   once it exits. Windows only (`skipIf`) — Linux renames a busy folder; CI is
   ubuntu and skips it.
2. `worktree-close.mjs`: after the stop loop, `held(path)` → `FAIL — something
   that is not a node process stands in <path> … Nothing was removed.`, exit 1.
   The leftover-folder `rmSync` wrapped: on error `KEPT <path>`, the branch
   step still runs, exit 1.
3. Validation, end checks, merge.

> SOURCE: the agent, 2026-10-09

## Autonomy

Checkpoints. Rung `repair`, effort `medium`: a known repair with its root cause
measured, two scripts and one spec.

> SOURCE: the agent, 2026-10-09, the model-and-effort ladder

## Validation

- The 2026-10-09 repro rerun on the fix: junction-only `node_modules` and a
  powershell holder in the tree → `FAIL … Nothing was removed`, exit 1, tree
  and branch kept; holder stopped, rerun → `ok`.
- The no-holder control → `ok`, exit 0.
- `pnpm test:run` with a file count not lower than before; lint, build,
  `check:briefs`, gate.

> SOURCE: the agent, 2026-10-09
