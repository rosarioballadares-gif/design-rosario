# Brief: wire this workspace to Rosario's personal project

## Objective

This workspace knows its project: what is decided is recorded, and what is not
waits in the backlog under a name.

> SOURCE: Rosario, 2026-10-30, chat: "quiero hacer el set up"

## Differentiator

Doing nothing leaves the template's blank wiring, where the agent guesses the
same way for everybody and every answer ends with the conversation.

> SOURCE: [the setup skill](../.claude/skills/setup/SKILL.md)

## Context and rules

The answers are in [workspace-wiring](../docs/foundation/workspace-wiring.md).
This machine is what `pnpm check:env` reports; the Figma account is what
`whoami` returns.

> SOURCE: Rosario, 2026-10-30, question UI

## Dependencies

Every open item waits on an answer from Rosario, listed in
[the backlog](../backlog/00-client.md).

> SOURCE: Rosario, 2026-10-30, question UI

## Scope

In: the wiring, the roster, this spec, its backlog, the template's briefs moved
to `docs/template-history/`.
Out: building a design system, choosing a stack, any product screen. The Figma
server already answers, so it needs no wiring task.

> SOURCE: Rosario, 2026-10-30, question UI

## Tasks

1. "No design system": blocked, no method in this template.
2. "Where the code lives and on what stack": waits on Rosario.
3. "The Figma team and library file": waits on Rosario.
4. "The channel": waits on Rosario.

> SOURCE: [CLIENT.md](../.claude/skills/setup/CLIENT.md)

## Autonomy

Checkpoints. Rung `default`, effort high. Not `census`: the answers need
judgment about what is a fact and what is a gap, not a sweep.

> SOURCE: [CLIENT.md](../.claude/skills/setup/CLIENT.md), which sets both

## Validation

- `pnpm check:briefs` lists this brief `ok`.
- `pnpm check:backlog` exits 0 with Rosario in its roster.
- `pnpm check:links` exits 0 after the move.
- `pnpm board --main feat/client-setup` shows all four tasks.

> SOURCE: [CLIENT.md](../.claude/skills/setup/CLIENT.md)
