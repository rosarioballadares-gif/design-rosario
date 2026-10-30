# The guide — every part of this workspace, in the order you meet it

This is the long way round: what each part is, why it is there and where its
rules live. [README.md](README.md) is the short way — three commands and the
table of the rest. The rules the agent works by are in [CLAUDE.md](CLAUDE.md).
This file explains them to a person and never restates them.

Written for product designers first, and for the product managers and design
managers who work beside them.

## 1. The template

`studiohakuna/product-ops-base` is a GitHub template: a repository you copy,
not one you work in. It carries a method — how work is asked for, approved,
built, checked and shared — and no product. Each client gets its own copy,
made from the template, so one client's work never sits beside another's.

The method was built on one client between September and October 2026.
That client shows up in this repository only as a **worked example**: a link
to what it decided, cited where a skill of the method makes the same kind of
decision for the next client.

## 2. Making a copy and cloning it

On GitHub, **Use this template**, in the client's organisation, private. Or
from a terminal:

```sh
gh repo create <org>/<client>-product-ops --template studiohakuna/product-ops-base --private --clone
cd <client>-product-ops
```

## 3. The first hour

```sh
corepack enable
pnpm install
pnpm dev
```

On Windows without admin rights `corepack enable` fails; run
`npm i -g pnpm@10.23.0` instead, the version `packageManager` in
[`package.json`](package.json) pins.

Then open the folder in Claude Code — the terminal, the desktop app or the
VS Code extension. Turn on bypass permissions:
[`.claude/settings.json`](.claude/settings.json) is the guardrail that
survives it, and the per-file prompt otherwise interrupts every few seconds.
The setup recipe for each piece is in
[the setup skill's WIRING.md](.claude/skills/setup/WIRING.md).

## 4. The hook that starts it

You do not need to know `/setup` exists. Every session begins with a hook,
[`session-brief.mjs`](scripts/session-brief.mjs), that reads two things: whether
this copy knows its client yet and whether it knows you. When either is
missing, it tells the agent to start `/setup` on your first message. When both
are known, it prints who you are, what you can reach and which other sessions
are open on this machine.

## 5. The client intake, and the spec it writes

The first time anybody opens a copy, `/setup` interviews them about the client,
in at most two rounds of questions: who the client is, whether they have a
design system, where their code lives and on what stack, which design tool they
use, where their documentation and tickets live, how they are reached and who
decides.
"I do not know" is always an answer, and it is recorded as a gap with
a name beside it rather than guessed.

What it writes:

- [`docs/foundation/workspace-wiring.md`](docs/foundation/workspace-wiring.md) —
  the client's facts, true for everybody.
- the client's people, in [`docs/foundation/people.md`](docs/foundation/people.md).
- **the spec**, `briefs/<date>-client-setup.md` — the plan for wiring this
  client: each tool to connect, with its command.
- one item per task of that spec in `backlog/00-client.md`, each with a state
  and an owner, so `pnpm board` shows what is left and who it waits on.

Then it asks you three questions — your role, whether you write code here, and
whether you design in Figma — and writes your profile,
`.claude/profile.local.json`, which never leaves your machine. The second
person on a copy answers only those three.

## 6. Every task goes through the gate

Before any change that is not trivial, the agent fills in an **execution
prompt** — eight fields: objective, differentiator, context and rules,
dependencies, scope, tasks, autonomy, validation — and shows it to you.
Nothing is edited until you answer. That minute is the method.

Every field carries one of three things, and no fourth:

- a **citation** — a file, a link.
- a **`> SOURCE: who, when`** — somebody said it, and when.
- a **`> GAP: what nobody knows`** — the honest answer when nobody knows.

Once you approve, the prompt is saved as a brief in [`briefs/`](briefs/), from
[the template](briefs/TEMPLATE.md). A brief is the answer that would otherwise
die with the conversation, and `pnpm check:briefs` holds every one to the
three-ways rule. When you pick up work somebody else started, read its brief
first.

## 7. Go, Go + worktree, or autopilot

The gate asks how to run the approved work:

- **Reformulate** — rework the prompt before anything is touched.
- **Go** — a new `feat/<topic>` branch in this checkout. Right for a quick
  change when nobody else is working here.
- **Go + worktree** — the same work in its own folder under
  `.claude/worktrees/`, so two sessions never edit the same files. The
  recommended option whenever more than one session may be open.
- **Go autopilot** — a worktree, run unattended to a review stop. Every
  question is asked up front, and three read-only reviewers judge the end.
  Its contract is [autopilot.md](docs/foundation/autopilot.md).

## 8. Skills

A skill is a written method the agent loads when its moment comes:
`voice-audit` before copy ships, `contrast-audit` when a
colour is judged, `parity` when a design-system change has to land in both
code and Figma, `grilling` when you want a plan attacked. The full table, and
when each fires, is in [CLAUDE.md](CLAUDE.md) under Skills, and each skill's file
is under [`.claude/skills/`](.claude/skills/).

## 9. Hooks

Small scripts the harness runs around the agent's actions, wired in
[`.claude/settings.json`](.claude/settings.json):

| When | Script | What it does |
| --- | --- | --- |
| a session starts | `session-brief.mjs` | who you are, what is owed, which sessions are open |
| you send a message | `skill-router.cjs` | points the agent at a skill whose moment your words name |
| before a shell command | `git-guard.cjs` | refuses a commit on `main`, an unnamed `git add`, a commit with no brief, a push with no gate receipt, a `git worktree remove` with processes still running |
| before an edit, inside a worktree | `worktree-edit-guard.cjs` | refuses an edit into the main checkout or another worktree |
| after an edit or a command | the round notices | a nudge when a session is going in circles |
| after a design-system write | `skill-router.cjs` | asks which side — code, Figma or both — the change belongs on |

What each one paid for is in [checks.md](docs/foundation/checks.md), The hooks.

## 10. Checks, and the gate

Every check prints its scope on the first lines and its verdict on the last,
so a run explains itself. The ones you will meet:

| Command | What it proves |
| --- | --- |
| `pnpm lint` | the code's lint rules |
| `pnpm build` | the typecheck and the build — nothing else typechecks |
| `pnpm test:run` | the models and the checkers, never a mounted screen |
| `pnpm check:briefs` | every brief cites, attributes or admits a gap |
| `pnpm check:copy` | four characters the voice guide forbids in screen copy |
| `pnpm check:env` | what this machine can reach |
| `pnpm gate` | everything a push to `main` is proven against, with a receipt |

A green test run never proves a screen: that takes a capture,
`node scripts/shot.mjs`, with `--full 1` for a page taller than the window.
Which check runs where and what each cannot see is
[checks.md](docs/foundation/checks.md).

## 11. The board, the backlog and feedback

- **`pnpm board`** — one page, on your machine: every autopilot run and every
  open or blocked backlog item.
- **[`backlog/`](backlog/README.md)** — what is missing on purpose, one item
  per thing, each with a state (`open`, `blocked`, `landed`, `dropped`,
  `upstream`) and an owner. `pnpm backlog --mine` is yours.
- **[`feedback/`](feedback/)** — when this workspace cost you time, the
  `feedback` skill writes it down: who, where and what it cost. That record is
  how the method gets better.

## 12. Where documents live, and decisions

[docs/README.md](docs/README.md) is the map: the client's facts and the method
in `docs/foundation/`, research about a product in `docs/product/<Product>/`.

A **decision record** (PDR, in [docs/decisions/](docs/decisions/README.md)) is a
choice that closes off other choices: the token tiers, the headless library,
the bands. A brief is the plan for one task. Most tasks need only the brief.

## 13. Branches, and closing a task

Work happens on `feat/<topic>`, born from `main`, and merges back into `main`.
`main` is the only branch that is pushed, so every push is a publish — the
agent asks before it. Before the push, `pnpm gate` runs over the merged tree.

A task closes with a status table: the branch, whether it was pushed and one
row per surface it touched with its link — the Figma frame with its
`?node-id=`, the route on the dev server, the deployed URL. Closing is when
work gets shared. Work that leaves the repository — a deck, a Figma file, a
deployed page — is a surface too, and gets its row and its link.

A worktree closes with `pnpm worktree:close <name>`, run from the main
checkout: it stops the dev servers running out of the folder before removing
it, and deleting the folder by hand leaves them running.

## 14. What a session costs

| Command | What it shows |
| --- | --- |
| `pnpm check:floor` | what every call pays before your task is read — CLAUDE.md and the skill listing |
| `pnpm latency` | where a session's time went |
| `pnpm shapes` | what subagents were asked for |
| `pnpm snapshot` | keeps the cost window beyond the days on disk |
| `pnpm cost` | by tool and by model |

Two plugins come declared in [`.claude/settings.json`](.claude/settings.json),
`superpowers` and `frontend-design`, and they cost about 1,550 tokens a
session that `check:floor` cannot see: about 980 from the skill `superpowers`
injects at session start, and about 570 from their sixteen skills' lines in
the listing, measured on 2026-10-08.

A long session costs more per call than a short one, because everything said
earlier is read again on every call. When the agent suggests starting fresh, a
new session with the brief's path is cheaper than carrying on.
