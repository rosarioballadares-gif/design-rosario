# The backlog

What is missing on purpose, what is blocked, and what somebody decided against.
One file per area; every item is a `###` heading carrying two lines.

```
### The thing that is missing

> STATUS: open
> OWNER: nobody

What was measured, and what it would take.
```

## The two lines

**`> STATUS:`** — one of five. `pnpm check:backlog` refuses an item without one,
because a state nobody typed is not a state.

| | |
| --- | --- |
| `open` | nobody has done it and nothing stops somebody starting |
| `blocked` | it cannot start until something else lands; the blocker is named |
| `landed` | it is done here, with the evidence beside it |
| `dropped` | somebody looked and decided not to, with the reason beside it |
| `upstream` | not this repository's to fix; it belongs to whoever owns the package |

`dropped` and `blocked` must carry their reason **on the same line**. Each closes
something off, and a closed door with no note on it gets opened again by the next
person.

**`> OWNER:`** — a name from [docs/foundation/people.md](../docs/foundation/people.md),
or the literal `nobody`. It has to be typed: an item with no owner line is
indistinguishable from one nobody has got to yet, and `nobody` is somebody
stating that this has no owner. A misspelled name is an owner no filter will ever
find while the item still looks assigned, which is why the check holds it to the
roster.

## Reading it

```
pnpm backlog                  everything except dropped
pnpm backlog --mine           yours, from your profile
pnpm backlog --status open    one state
pnpm backlog --unowned        what nobody has claimed
pnpm board                    open and blocked, beside the autopilot runs, as merged into main
pnpm check:backlog            every item has a state and an owner, or it fails
```

`--mine` is a **view**, never a second file. One copy of each item, filtered by
its owner — a file per person would put the same item in two places with nothing
keeping them in agreement.

## Where it starts

**Empty.** A repository made from this template opens with this file and no
item. `/setup` writes the first ones to `00-client.md`: the client's wiring,
and a blocked item when the client has no design system, or a design system,
stack or design tool the template has no method for. What only the template's
maintainer fixes is an issue on the template's repository, never an item here.
`pnpm check:backlog` passes an empty backlog only while this README is read.

> SOURCE: Ian Rueff, 2026-10-09 — "la idea es q este repo este virgen, con
> todo lo q se pueda presetear preseteado y el resto dentro de setup";
> [the brief](../briefs/2026-10-09-empty-backlog.md).
