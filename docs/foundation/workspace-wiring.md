# workspace wiring — the facts that are true for everybody

What this workspace is connected to, for every person who works in it. The
client intake in [`/setup`](../../.claude/skills/setup/SKILL.md) writes it;
anything about one person goes in their untracked profile instead. Every fact
carries a `> SOURCE: who, when`, and every unknown stays a `> GAP:` with the
name of who would know.

## The client

There is no external client: this is a personal project of Rosario.

> SOURCE: Rosario, 2026-10-30, question UI

> GAP: the product's name, its URL, and the product key, the PascalCase id the
> code and `docs/product/<ProductId>/` use. Rosario would know.

## The design system

None yet.

> SOURCE: Rosario, 2026-10-30, question UI — "Todavia no"

## The stack

> GAP: what the project ships on, and whether the prototypes here keep the
> template's stack. Rosario answered "I do not know" on 2026-10-30 and would
> decide.

## Where the work happens

This repository is https://github.com/rosarioballadares-gif/design-rosario.

> SOURCE: Rosario, 2026-10-30, chat

> GAP: whether code goes anywhere else, and where prototypes are published.
> Rosario would know.

## The design tool

Figma, reached through the Figma MCP server under the handle Studio Hakuna.

> SOURCE: Rosario, 2026-10-30, question UI; `whoami` run by Claude, 2026-10-30

> GAP: which Figma team this project belongs to, and its library file. Rosario
> would know.

**More than one Figma server can be connected, and they answer as different
accounts.** Record which server answered `whoami`, not that one did: composing
through the wrong one gets a 404 on the library, which looks exactly like a
missing seat.

## The documentation

None outside this repository.

> SOURCE: Rosario, 2026-10-30, question UI

## The tracker

None. Work is tracked in [`backlog/`](../../backlog/README.md).

> SOURCE: Rosario, 2026-10-30, question UI

## Communication

> GAP: the channel the project is coordinated in. Rosario answered "something
> else" on 2026-10-30 without naming it, and would know.

## The package registry

Nothing installs from a private scope: there is no `.npmrc`.

> SOURCE: `pnpm check:env`, run by Claude, 2026-10-30
