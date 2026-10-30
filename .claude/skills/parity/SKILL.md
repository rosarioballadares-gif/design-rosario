---
name: parity
description: Design-system change - a token, a style or a component - asked Figma, code or both at intake, then carried to each.
---

# parity

**The rule: a design-system change lands on every surface it lives on, and
which surfaces is the person's answer, asked before anything is built.**
A design system here lives twice — in code (`src/ds/`, browsable in
Storybook) and in the client's library file, the one `## The design tool` in
[workspace-wiring](../../../docs/foundation/workspace-wiring.md) names. A
change on one side only is drift, and drift found later is a redo on the other
side plus an argument about which one is right.

> SOURCE: Ian, 2026-09-25: "así mantenemos paridad entre ellos siempre";
> chose to be asked at the start of the task.

**It applies** to adding, changing or removing a token, a text, effect or paint
style, a component or a variant — on whichever side it was asked for. A screen
that only *uses* the system is out of scope for this skill.

## 1. Ask inside the gate's call

Put one question in the same `AskUserQuestion` call that carries the intake
gate (`CLAUDE.md`, step 2), so it costs no extra turn:

- **Code + Figma** — recommended, first.
- **Code only**
- **Figma only**

Offer a side as reachable only once this session has reached it: Figma through
the Figma MCP's `whoami`, code through a green build. A side that cannot be
reached stays in the question, named as such.

## 2. Write the answer into the brief

`## Scope` names each surface and where it lives — for code the files and the
story, for Figma the file and page. A one-sided answer carries its reason as a
`> SOURCE:`, so the other side reads as a decision rather than a lapse.

## 3. Carry it

| Change | Code | Figma |
| --- | --- | --- |
| token or style | **tokens** | **tokens-figma**, once the code side is green |
| component | **component**: `src/ds/` behind the seam, and a story beside it | **component**'s Figma steps, in the client's library, bound to the token variables |

**Code first, then Figma**, as a previous client settled it: the code side is green
before the Figma side mirrors it
([PDR-0007](../../../docs/decisions/0007-verify-at-the-end.md)). A client
that designs in Figma first is a different answer, recorded in the brief.

When the design tool is not Figma, the Figma column is a `> GAP:` in the
brief, and `/setup` wrote the blocked item ([CLIENT.md](../setup/CLIENT.md)).

**When Figma is the tool but nobody here can reach the file** — no seat, an
account that belongs to another organisation — the Figma half is a `> GAP:`
naming who grants access, and a backlog item "Figma half of <change>",
blocked on that access, keeps the change from reading as done on both
sides.

## Done when

Every surface in `## Scope` carries the change, each proven the way its own
skill says, and the closing status table has one row per surface with its link:
the Figma node with `?node-id=`, and the story's URL — the deployed
Storybook when one exists, or the local route `pnpm storybook` serves.
