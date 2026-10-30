# The client layer — once per repository

Read by [`SKILL.md`](SKILL.md) when
[`workspace-wiring.md`](../../../docs/foundation/workspace-wiring.md) still
carries **"no client has been recorded"**. It runs once, by whoever opens a
repository made from this template first, and it ends with the person layer in
the same session.

**What it leaves behind is a spec, not a configured machine.** The intake
answers become `docs/foundation/workspace-wiring.md`, the client's people in
`docs/foundation/people.md`, a brief that is the plan for wiring this client,
and one backlog item per task of that plan — so `pnpm board` and
`pnpm backlog` show what is left, and who it waits on.

## Before you ask

Read what retires a question: the person's own first message, the git remote
(`git remote -v`), the repository's name, and the email domain of the git
identity. A client name or a product URL that one of those already gives is
offered as the first option, never asked blank.

## The questions — at most two calls of at most four

**Call 1**, always:

1. **The client and the product** — the client's name, the product, its URL.
   Offer what you read above; "Other" carries the typed answer.
2. **Their design system** — **None** · **A code
   package** (which, in the notes) · **A design file only** (its URL, in the
   notes) · I do not know.
3. **Where the code lives, and on what stack** — **Nowhere yet: prototype
   here on React** (the template's stack, recommended when nothing exists) ·
   **Their own repository, React** · **Their own repository, another stack** ·
   I do not know.
4. **Their design tool** — **Figma** · **Another tool** (which) · **None** ·
   I do not know.

**Call 2**, only what call 1 and the reads above left open, up to four:

5. **Where their documentation lives** — Notion · Confluence · Google Drive ·
   none.
6. **Their tracker** — Jira · Linear · none · I do not know.
7. **How they are reached** — Slack · Teams · email.
8. **Who is who** — who at the client decides on the design system, and who
   knows the product: **I do, for now** · **Somebody else** (name, role, how to
   reach them, in the notes) · I do not know yet.

**It branches on the answers, never on a guess.** No design system, one that
already exists — a code package or a design file only — another stack and
another design tool each mean there is no method to run here yet: each is a
blocked item this run writes, below. **"I do not know" stays a GAP with a name
beside it** — the person's, or the client contact who would know.

### The answers the template has no method for

Each becomes the client's first blocked item in `backlog/00-client.md`,
`> STATUS: blocked — the template has no method for <the case>`, `> OWNER:` the
person, with its paragraph below as the body.

- **No design system** — building one from zero is not in this template; it is
  planned as a separate repository, later. `tokens`, `component` and `parity`
  start once one exists.
- **A design system that already exists** — a package, or a design file with
  no code. Nothing in the template reads what exists. It would take a skill
  that starts from what the client ships (the package's exports, the file's
  variables and sets) and writes the token set and the primitives of `src/ds/`,
  so `tokens`, `component` and `parity` run on top unchanged.
- **A stack other than React** — `component` and `sandbox` are written against
  React. It would take, per skill, the method (classify, name, record, prove)
  split from the React part, and a second set of that part for the stack that
  first arrives.
- **A design tool other than Figma** — `tokens-figma`, `component`'s Figma
  half, `component-props`, `parity` and `interactions` drive `use_figma`. It
  would take the same split: what each skill proves beside the code, stated
  once, and per tool how it is proven.

> SOURCE: Ian Rueff, 2026-10-08, question UI — out of the founding brief's
> scope; moved here from the backlog on 2026-10-09
> ([the brief](../../../docs/template-history/2026-10-09-empty-backlog.md)).

> SOURCE: Ian, 2026-10-27, chat — no design system joins them: building one
> from zero leaves the template for a separate repository, later.

## What it writes

**Write it after the person layer's question**, in the same run: the items
below name the person as an owner, and `pnpm check:backlog` holds every owner
to the roster the person layer adds their row to.

**1 · `docs/foundation/workspace-wiring.md`.** Replace the "no client has been
recorded" line, and turn each answered `> GAP:` into a fact with
`> SOURCE: <who>, <date>`. `## The client` also names the **product key**: the
PascalCase id the code and `docs/product/<ProductId>/` will use. Leave every
unanswered GAP standing, with who would know.

**2 · The client's people, in `docs/foundation/people.md`**, under
`## The client's people`: one row per person named in question 8 or in the
person's message — Name · Role at the client · Decides or knows · How to reach
· How it is known. Never a person nobody named. The first column is a roster
`pnpm check:backlog` reads, so a client contact can own a backlog item.

**3 · The spec, `briefs/<date>-client-setup.md`**, copied from
[the template](../../../briefs/TEMPLATE.md). Its Objective is this client
wired; its Context cites workspace-wiring; its Scope names what the answers
put out of scope; its Autonomy is `checkpoints`,
rung `default`. **Its Tasks are the order, one line each**, naming each
backlog item: the wiring, one task per row of [WIRING.md](WIRING.md)'s answer
table that an answer selected — the Figma MCP, the tracker's, the docs', the
channel's.

The spec's approval is the intake itself: each task still goes through the
gate in [CLAUDE.md](../../../CLAUDE.md) when somebody starts it.

**4 · One backlog item per task, in `backlog/00-client.md`**, in the spec's
order, each a `###` heading with its two lines:

- a wiring task: `> STATUS: open`, `> OWNER:` the person, and its command
  from WIRING.md's table in a code block;
- a task waiting on somebody — an access, a file, an answer:
  `> STATUS: blocked — <what it waits on>`, `> OWNER:` that somebody, a name
  from `people.md`;
- first of all, an answer the template has no method for, as its section above
  says.

The file opens with one line saying it was written by `/setup` from the spec,
and cites the spec.

**5 · The template's history, moved out of the way, in the spec's commit.**
`git mv` into `docs/template-history/` every file that was in `briefs/` before
this run, except `TEMPLATE.md` and `README.md`.
They record how the template was built, not this client's work, and they would
otherwise read as this repository's briefs. Then repoint each link
into a moved file: `pnpm check:links` names those in `CLAUDE.md` and `docs/`,
and `grep -n 'briefs/20' README.md GUIDE.md` the rest. This runs only in a
copy: the template itself never reaches the client layer.

## Done when

Checked at the end of the run, after the person layer:

- workspace-wiring.md no longer carries "no client has been recorded", and
  every GAP left in it names who would know;
- `pnpm check:briefs` lists the spec as `ok`;
- `pnpm check:backlog` is green with the client's people in its roster;
- `briefs/` holds the template and the spec, `pnpm check:links` is green, and
  the four files and the moves are committed by name on `feat/client-setup`, and
  `pnpm board --main feat/client-setup` shows every task of the spec under
  Open or Blocked.

Then the person layer, in [SKILL.md](SKILL.md), on the same branch. When both
are written, close as CLAUDE.md's "Closing a task" says: merge
`feat/client-setup` into `main`, delete it, run `pnpm gate` after the merge,
and push `main` on the person's yes. Until that push, no other clone has a
client.
