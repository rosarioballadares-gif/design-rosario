# Autopilot

The fourth option of the [task intake gate](../../CLAUDE.md). This file holds its
contract; the gate names it and links here rather than carrying it, because the
contract only matters once somebody has chosen it, and every session that does
not choose it paid for the text anyway.

Why this shape and not another is [PDR-0006](../decisions/0006-continuous-autopilot.md).

## What it is for

Work you will not be watching: several phases, a long spec, a queue of tasks.

It does not remove the questions — it **moves them to the front**. The moment you
choose it, and before the first edit, the agent brings every question at once,
plus a checklist of pre-authorizations for the actions that would normally be
confirmed in the moment.

**What is checked holds for the whole run. What is not checked stops the work
that depends on it, and only that.**

## Who does what

- **The director** is the main session. It edits no code and no Figma. For each
  step it writes the step's handoff, launches one worker in the background,
  reads its report and launches the next; between steps it talks with you. It
  does itself only what a subagent cannot: the question UI, and reading
  figma-use's references, which are MCP resources, to hand them on.
- **A step** is one of the brief's Tasks, cut to fit one worker.
- **A worker** is a subagent with a fresh context, one at a time: two at once
  collide in `component.json` and in Figma, as the components run learned. It
  does its step, builds it and commits on the branch; the rest of the evidence
  is the last step, once, over the whole diff
  ([PDR-0007](../decisions/0007-verify-at-the-end.md)). It never asks, merges
  or pushes.
- **The end** is [the review panel](review-panel.md): three read-only lenses at
  once, the one exception to one at a time, since each writes only its own
  file. A CHANGES gets a fix worker at most twice, then waits as a question
  ([PDR-0010](../decisions/0010-review-panel.md)).
- **The report** is one line: `done`, `partial` or `waiting`, and the commit.
  The detail goes into the registry, so the director grows by about one call
  per step.
- **The registry** is one versioned file on the branch: the steps and their
  state, the waiting questions with their answers, the assumption log. It is
  what you read before merging and what another session needs to take over.
  The brief's `## Autonomy` names its path — a product's run sits beside its
  research, as a previous client's components run did. The director writes it only between steps, so an answer you give while
  a worker runs never collides with the worker's writes.

## In checkpoints

A checkpoints brief of more than three Tasks runs with the same director and
workers. The director edits no code and no Figma; one worker at a time, with a
fresh context, does one Task, builds it, commits it on the branch and reports
one line. The end checks run once, over the whole diff
([PDR-0007](../decisions/0007-verify-at-the-end.md)), with a fix worker if
something is red.

What differs is that you are watching. There is no checklist of
pre-authorizations and no registry: the brief's Tasks and the branch's commits
are the record. A worker that meets a question returns `waiting` with it, and
the director asks it through the question UI at once instead of parking it.
Merge and push are confirmed as always.

A worker that returns `partial` writes what is left into a `## Still open`
section of the doc its stage produces, and commits it on the branch. The next
worker is launched to start from that section; the director copies nothing
from the report into its prompt beyond the doc's path.

> SOURCE: Ian, question UI in hubble-product-ops, 2026-10-16

A stage that produces no doc keeps its Still open in a `## Still open` section
of its brief, with a `> SOURCE:` line, since `check:briefs` fails any section
with no citation, `> SOURCE:` or `> GAP:`.

> SOURCE: Claude, declared, 2026-10-16

[The queue](#the-queue) runs in checkpoints too, one worktree and `feat/`
branch per stage. The director closes each with `pnpm worktree:close <name>`,
adds the next from local `main` with `git worktree add` and enters it with
`EnterWorktree` by path. Each stage's brief is drafted and approved at that
stage's start, not at queue setup, because a later brief depends on what the
earlier stage produced. The queue lives in the doc that set the stages' order,
not in a registry.

> SOURCE: Ian, 2026-10-16; Claude, declared, 2026-10-16, on where the queue
> lives

A checkpoints session that did every Task inline reached 600k tokens, the
budget notice firing at every 100k, and a fresh worker per Task is what
autopilot already chose to keep the director small
([PDR-0006](../decisions/0006-continuous-autopilot.md)).

> SOURCE: Ian Rueff, 2026-10-08, on the 600k session

## The registry's form

A registry opens on a frontmatter and keeps its steps and its questions as
checklists, so [`pnpm board`](../../scripts/board.mjs) can read every run on
the machine without anybody opening one:

```markdown
---
brief: briefs/2026-10-07-route-planner.md
branch: feat/route-planner
base: 88e58f3
---

# Route planner keeps its stops across reloads

## Steps

- [x] 1. Stops in the URL — 2a2b2c2
- [ ] 2. Restore on load — partial

## Waiting

- [ ] Keep stops older than a month? Recommended: no. Blocks step 3.
```

- **`brief` and `branch` make a file a registry**; `base` is the commit the
  branch was born from. A registry without `base`, `## Steps` or `## Waiting`
  still shows, with what is missing written on it.
- **A step not checked is pending**, unless it ends in `— partial` or
  `— waiting`.
- **A question answered is checked**, with its answer after it.
- **The review files sit beside it**, as [review-panel.md](review-panel.md)
  § The file fixes.

The column is derived on every read, never written. The first row that holds
decides it:

| The registry | Column |
| --- | --- |
| is in `main`'s tree | Merged |
| has a question not checked | Waiting on you |
| has a last round not all PASS | Review |
| has a last round all PASS | Final stop |
| anything else | Steps |

`pnpm board` serves it on `127.0.0.1:4380`. `--port` takes another, never 5173
or 6006; `--main <ref>` reads merged runs from a ref other than local `main`.
Registries written before this form are not migrated, and the board does not
see them.

## Budget

- **A worker** starts fresh on every step. A step that does not fit stops at a
  clean point: it commits what is validated, writes what is left into the
  registry — in checkpoints, into the `## Still open` of its stage's doc — and
  returns `partial`, and the director launches another worker for the rest.
  [The budget notice](../../scripts/call-budget-notice.cjs) counts a subagent's
  own calls and tells it exactly that. At the first notice a worker may finish
  only closing work it already wrote — build, validate, commit — and anything
  still to edit stops at a clean point. The repeat notice, 100 calls or 100k
  tokens later, stops it with no exception, which catches a worker that guessed
  wrong that little was left.

  > SOURCE: Ian, 2026-10-24, in hubble-product-ops, on letting a worker finish
  > only what it already wrote
- **The director** reaches the budget notice mostly by talking with you.
  - In autopilot it runs `pnpm handoff`, adds the registry's path, sends a
    notification and keeps going: the notice's "stop" is for a session somebody
    is watching. You do the relay when you are back.
  - In checkpoints it runs `pnpm handoff "<what is left>"`, gives you the
    output and stops, as the notice says.

## Questions that arise mid-run

- **Cheap, and reversible if wrong:** the worker takes the default it would
  recommend and logs it.
- **Expensive, irreversible or not pre-authorized:** the worker does not act. It
  writes the question into the registry, with its options, the recommended one
  first, and what depends on it, and returns `waiting`.

A waiting question costs one `PushNotification` naming what is blocked — on the
desktop, and on the phone only with Remote Control on — and the director moves
to the next step that does not depend on it. When you write, it first asks the
waiting questions in the question UI, up to four per call, writes the answers
into the registry and relaunches what waited. If everything left depends on an
answer, it launches nothing and waits.

The question UI holds the session until it is answered, which is why a question
waits in the registry instead of opening at once. A notification goes out for a
question and for the final stop, never for a step.

## The queue

An ordered list of tasks, each with its brief, its worktree and its `feat/`
branch, set up with the director before the run starts and, in autopilot, kept
in the registry; [in checkpoints](#in-checkpoints) it differs as said there.

- **In autopilot, every brief is drafted when the queue is set up, and approved
  together.** An earlier task that leaves a later brief stale turns that brief
  into a waiting question.
- **Each task runs as above**, to its own final stop. The director then closes
  its worktree and starts the next.
- **With the local merge pre-authorized,** the director merges each finished
  task into local `main` — lint, build and gate green, as
  [CLAUDE.md](../../CLAUDE.md) closes a task — and the next branch is born from
  there. `EnterWorktree` starts at `origin/main`, so the next worktree is added
  from local `main` with `git worktree add`.
- **At the end of the queue** the director runs the gate and asks about the
  push in the question UI.

## What it never suppresses

- The final stop: implemented, validated with evidence, committed, with the diff
  already through the review panel.
- A question whose wrong answer would be irreversible, or would invalidate
  finished work. It waits, and nothing that depends on it runs.
- Anything that was not pre-authorized.
- The push to `main`.

## What it returns

A status table, the review findings, the questions still open, and an
**assumption log** — every default it took on its own, with its reason.

An autonomous run that comes back without saying what it decided alone is not
autonomy, it is a black box.
