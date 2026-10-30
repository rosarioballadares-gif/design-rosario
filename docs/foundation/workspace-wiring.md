# workspace wiring — the facts that are true for everybody

What this workspace is connected to, for every person who works in it. The
client intake in [`/setup`](../../.claude/skills/setup/SKILL.md) writes it;
anything about one person goes in their untracked profile instead. Every fact
carries a `> SOURCE: who, when`, and every unknown stays a `> GAP:` with the
name of who would know.

> GAP: no client has been recorded. This is the base, before `/setup` ran.

## The client

> GAP: who the client is, the product, its URL, and the engagement — and the
> product key, the PascalCase id the code and `docs/product/<ProductId>/` use.

## The design system

> GAP: whether one exists, and where it lives — a package, a design file, a
> Storybook, or nowhere yet.

## The stack

> GAP: what the client ships on, and whether the prototypes here keep the
> template's stack.

## Where the work happens

> GAP: whose repository the code goes to, and where prototypes are published.

## The design tool

> GAP: Figma or another tool, the library file, and which account reaches it.

**More than one Figma server can be connected, and they answer as different
accounts.** Record which server answered `whoami`, not that one did: composing
through the wrong one gets a 404 on the library, which looks exactly like a
missing seat.

## The documentation

> GAP: where the client keeps its documentation — a wiki, a drive, a tracker.

## The tracker

> GAP: Jira, Linear or none, and who files tickets.

## Communication

> GAP: the channel the client is reached in.

## The package registry

> GAP: whether anything installs from a private scope. `pnpm check:env`
> reports it.
