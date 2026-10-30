# people — who uses this workspace

The only place in the repository that knows who exists. `.claude/profile.local.json`
is per-machine and untracked, so a person without a row here is invisible to
everybody else.

[`check-backlog.mjs`](../../scripts/check-backlog.mjs) reads the **first column**
and fails a `> OWNER:` that is not in it — a misspelled owner is an owner no
filter will ever find while the item still looks assigned.

**Add a row when you run `/setup`. Never rewrite one that is already there**, and
never fill in somebody else's role: only they can close a `> GAP:` under this
table.

| Name | Role | Registered | How it is known |
| --- | --- | --- | --- |
| Ian Rueff | product-designer, writes code | 2026-09-19 | The author of this template, carried in every copy made from it so a backlog item can name him. Answered `/setup` on 2026-09-19 in the repository the template was cut from, not in this copy. |

## The client's people

Written by the client layer of `/setup` from the intake, and added to by
whoever learns a name later. A name here is a roster entry too: the first
column is what `check-backlog.mjs` reads, so a client contact can own a
blocked backlog item.

| Name | Role at the client | Decides or knows | How to reach | How it is known |
| --- | --- | --- | --- | --- |

> GAP: no client has been recorded, so nobody at the client is named yet.

## Who is not on this roster

> GAP: this roster is one row old. Every `> SOURCE:` line in
> [CLAUDE.md](../../CLAUDE.md) and in
> [the setup skill](../../.claude/skills/setup/SKILL.md) cites conversations with
> people who are not on this table — Valentina and Wadi among them — because they
> used the repository this one was harvested from, not this one. They get a row
> when they run `/setup` here, and nobody else can write it for them.
