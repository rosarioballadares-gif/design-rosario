# product-ops-base

A workspace for product managers, product designers and design managers to
build screens with AI — in code, against the client's design system, and in
the design tool beside it. It is a template: each client gets its own copy,
and the copy learns its client the first time somebody opens it.

**New here? Read [GUIDE.md](GUIDE.md)** — every part of this workspace in the
order you meet it. The standing rules the agent works by are in
[CLAUDE.md](CLAUDE.md). This file is how to run the thing.

## The first hour

```sh
corepack enable
pnpm install
pnpm dev
```

On Windows without admin rights `corepack enable` fails; run
`npm i -g pnpm@10.23.0` instead, the version `packageManager` in
[`package.json`](package.json) pins.

Then open the folder in Claude Code. You do not need to type anything special:
the first session notices it does not know the client or you yet, and starts
`/setup`. It asks about the client once per copy and about you once per
machine, writes what it learns and leaves a spec of what is left to wire.

**Turn on bypass permissions.** Claude Code otherwise asks before every file it
touches, which on a session of this shape is a prompt every few seconds.
[`.claude/settings.json`](.claude/settings.json) is the guardrail that survives
it — the model and effort floor, the hooks, and which skills are listed — and
bypassing the per-action prompt does not bypass that file.

**Leave the model settings alone.** The repository ships `ultracode: false`,
`effortLevel: high` and `workflowSizeGuideline: small`, and those are the floor
for everybody who clones. Do not turn ultracode on for ordinary work: it is
slow, it fans out agents, and most of what happens here does not need it.

> SOURCE: Valentina and Wadi through Ian Rueff, 2026-09-15, in a repository
> this method was built in — *"switch from Ultra Code to Extra Effort for
> tasks that don't need deep reasoning"*. The setting they were reaching for is
> already the default; what they had done was raise it by hand.

## The mistake that costs the most: asking for everything at once

**Ask for ONE component. Not the set, not the screen, not "the library".**

> SOURCE: the same session, 2026-09-15 — *"Claude tried to create everything
> from scratch instead of one component"*, and the recommendation that
> followed: *"start with a single isolated component / much cheaper and faster
> than passing the full context"*.

A prompt that names a file and a component has a finish line. A prompt that
names a design system does not.

## What gets asked of you before anything is edited

Work here is spec-driven. Before a non-trivial change, the agent fills in an
execution prompt — what changes, in which files, what closes it, what is out of
scope — and shows it to you with four options: reformulate, go, go in a
worktree, or autopilot. Nothing is edited until you answer. That minute is the
whole mechanism.

## The commands

| | |
| --- | --- |
| `pnpm dev` | the prototype index, at the route each prototype declares |
| `pnpm storybook` | the design system, port 6006 |
| `pnpm build` | `tsc -b && vite build` — this is also the typecheck |
| `pnpm test:run` | the models and the checkers. **Nothing here mounts a component** |
| `pnpm tokens` | the token build, from `src/ds/tokens/` |
| `pnpm board` | autopilot runs and the open and blocked backlog, on one page |
| `pnpm gate` | everything a publish is proven against, plus what the deploy does not run |
| `pnpm check:env` | what this machine can reach, and which step you are missing |
| `pnpm check:floor` | what every call pays before a word of the task is read |

Every check prints its own scope on the first lines and its verdict on the
last, so read the run rather than this table.

## What is not wired

Stated rather than left to be discovered:

> GAP: no client. `/setup` records one, and until then
> [`docs/foundation/workspace-wiring.md`](docs/foundation/workspace-wiring.md)
> says so.

> GAP: no design system. [`src/ds/`](src/ds/README.md) is a passthrough, and
> it is the only place a vendor package may be named.

> GAP: no deploy in a copy. The template publishes through the `deploy` job in
> `.github/workflows/ci.yml`; a copy skips it until somebody runs `vercel link`
> and sets `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` as
> repository secrets. The token may be scoped to the team or to the project;
> on a CLI pinned below 56.3.1, a project-scoped one fails with "Could not
> retrieve Project Settings".

> GAP: no MCP server declared. `.github/workflows/ci.yml` gates the deploy and
> never the merge, which is deliberate and explained in its own comments.

## Where this came from

Cut on 2026-10-08 from a previous client's repository — its method, with
none of its product — under
[the founding brief](docs/template-history/2026-10-08-product-ops-base.md). That client stays
in this repository only as a worked example: four of its PDRs, anonymised in
[docs/decisions/](docs/decisions/README.md), cited where a skill of the method
makes the same kind of decision for the next client.
