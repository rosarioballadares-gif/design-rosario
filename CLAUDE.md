# Product operations — standing rules

A workspace for product managers, product designers and design managers to
build screens with AI, in code and in Figma. How it works, part by part, is
[GUIDE.md](GUIDE.md); what is missing on purpose lives in [backlog/](backlog/README.md).

## The one rule this repo is built on

**Work is spec-driven. Nothing gets built from a vibe.**

Before any non-trivial change, the agent fills in the execution prompt, shows it
to you, and waits. You read it, you approve it, and only then does anything get
edited. That minute is the difference between getting what you asked for and
getting something adjacent to it.

The rest of this file is what makes that rule work in practice.

## Language

Everything versioned is written in **English** — copy, identifiers, comments,
tests, docs, commit messages, this file. Not everyone who reads this repository
shares a first language, and a file is read by somebody who was not in the
conversation that produced it.

**The conversation defaults to English as well, and the person overrides it.**
What a session speaks is `language` in `.claude/profile.local.json`, which
[`session-brief.mjs`](scripts/session-brief.mjs) injects at session start. With
no profile, English. An editor setting is not the mechanism: it is untracked,
per-machine, and invisible to everybody who clones this.

## Task intake gate

When you are asked to **do** something — a change to code, to design, to
content — do not touch a tool until this has run, in order:

0. **Read who you are working with** — `.claude/profile.local.json`, injected at
   session start by [`session-brief.mjs`](scripts/session-brief.mjs), which also
   starts `/setup` when it or the client is absent. Read it before offering
   somebody work they have no access to do.
1. **Fill in the execution prompt** — the eight fields of
   [the brief template](briefs/TEMPLATE.md).
2. **Show it and ask** — through the question UI, never as loose text, with the
   recommended option first:
   - **Reformulate** — you read it and we rework it before anything is touched.
   - **Go** — start on a new `feat/<topic>` branch.
   - **Go + worktree** — the same work in an isolated worktree.
   - **Go autopilot** — worktree, [unattended](docs/foundation/autopilot.md) to
     a review stop.

   **Recommend `Go + worktree` over plain `Go` whenever more than one session
   may be running against this checkout.** A worktree removes the collision
   instead of asking somebody to catch it. Plain `Go` fits a quick, single-file
   change where a worktree is more ceremony than the task.
3. **Wait for the answer.** No edits before it.
4. **Write the brief.** Save the approved execution prompt to
   `briefs/YYYY-MM-DD-<slug>.md`, from [the template](briefs/TEMPLATE.md).
   `git-guard.cjs` refuses a commit that carries work with none.

**Exception:** genuinely operational work — run the app, take a screenshot,
answer a question, check status — needs no gate.

**Step 4 is not paperwork.** It is where the answers stay instead of in a chat
nobody can reopen. So when work arrives that somebody else started, **read
`briefs/` first**.

**Every section needs a citation, a `> SOURCE: who, when`, or a `> GAP: what
nobody knows` — there is no fourth state, and "reasonable assumption" is an open
question wearing the costume of a fact.** The eight fields, their byte budgets
and the heading names the checker resolves are in
[the template](briefs/TEMPLATE.md), which `pnpm check:briefs` enforces and
prints. Copy it rather than writing a brief from memory: **a heading the checker
does not match loses that whole section without saying so.**

## How to ask

**A real fork goes through the structured question UI**, never as prose in the
body of a reply. Recommended option first.

**The same holds for how the task runs.** [`.claude/settings.json`](.claude/settings.json)
sets the floor for everyone who clones — `effortLevel: high`, `ultracode: false`,
`workflowSizeGuideline: small` — and the task earns the escalation, declared in
`## Autonomy` rather than assumed. The ladder is in
[`model-and-effort`](.claude/skills/model-and-effort/SKILL.md), whose five rungs
are named — `census`, `repair`, `default`, `decision`, `audit` — so a brief cites
the row it stopped on, and `check:briefs` fails a rung whose effort contradicts
the ladder. Not every task is the top model at `high`, and stopping one row down
costs nothing. **`census` is the only rung that names a model, and a session
cannot change its own — so that row means HANDING the work to a cheaper
subagent, never writing the model name in the brief and running it yourself.** A
fan-out beyond that one agent has to be argued for every time.

**A brief of more than three Tasks runs [as director](docs/foundation/autopilot.md#in-checkpoints),
in checkpoints too:** one fresh subagent per Task, one line back; the main
session edits no code and no Figma.

**A default you would recommend anyway is DECLARED, not asked.** Say what you
are about to do and carry on — the person can interrupt, and an interruption
costs them nothing while a question costs them a turn and their attention.

So: ask about scope, about what the work descends from, and about anything whose
wrong answer is expensive or irreversible. Declare the rest.

## Changes are surgical

**Every changed line traces to what was asked for.** Read the diff and name,
line by line, the sentence of the request that line answers. A line with no such
sentence is scope you added.

What that rules out, in the order it actually happens:

- Improving adjacent code, comments or formatting because you were already in
  the file. Match the surrounding style even where you would write it
  differently.
- Refactoring something that is not broken and was not mentioned.
- Deleting pre-existing dead code. Say it is there and leave it — a deletion
  nobody asked for is indistinguishable from a mistake when the diff is read.

What it requires, and this is the half that gets dropped: **clean up the orphans
your own change created.** An import, a variable or a helper your edit made
unused is your mess, and leaving it is not restraint.

## Validation closes with evidence

**Each commit builds, and claims only what it measured; the rest runs once, at
the end, over the whole diff:** lint, `test:run`, `check:copy`, voice-audit and
diff-review, their fixes in one commit, then captures against befores taken
before the first edit ([PDR-0007](docs/decisions/0007-verify-at-the-end.md)).
"It should work" is not a result: say what a green check covered.

**Nothing here mounts a component.** A green `pnpm test:run` proves the models
and checkers, never a screen — that takes a screenshot or a capture. **Nor does
it typecheck**: `tsc -b` runs only inside `pnpm build`. **A file count LOWER
than the last run** means a spec failed to import and reported green.

## Branch hygiene

```
feat/<topic>  → where work happens (born from main)
     │ merge
     ▼
main          → integration and publish. CI runs here and reports
```

- Isolate **before** editing, not after. `main` is not a working surface.
- **Confirm before pushing `main`.** There is one branch, so every push is the
  publish — the one action here with an audience.
- **Name the files you commit**, and commit on a feature branch.
  [`scripts/git-guard.cjs`](scripts/git-guard.cjs) refuses the other forms at
  the call rather than describing them here — what it paid for is in
  [checks.md](docs/foundation/checks.md).
- **Run `pnpm gate` before pushing, AFTER the merge.** It runs the checks a
  publish is proven against and writes `.gate-receipt.json` naming the HEAD it
  measured. The guard refuses a push to `main` without a matching receipt, and a
  merge moves HEAD. It proves the TREE, never the approval — the confirmation
  stays yours.

## Closing a task

**Merge the finished `feat/<topic>` branch into `main`, delete the local
branch, and push once confirmed** — the push is the publish. A brief left on a
feature branch is invisible to a thread that starts anywhere else, so it only
does its job once merged. Run `pnpm lint` and `pnpm build` on `main` after
merging, before the gate and the push: a hand-resolved conflict is exactly
where a stray edit slips in unnoticed.

**Close a worktree with `pnpm worktree:close <name>`**, from the main
checkout: removing the folder leaves its dev servers running.

Close with a **status table**, not prose — branch, whether it was pushed, the
state of the tree, and **one row per surface the work touched, with the link**:
the Figma frame with its `?node-id=`, the deployed URL, the exact route on the
dev server. Closing is when work gets shared, and collecting the links
afterwards means reconstructing where everything ended up.

## What runs, and where

**Every check here prints its own rule in its own output** — the scope on the
first lines, the verdict on the last — so what a check measures, what it refuses
to do, and what it cannot see arrive when it is run rather than from here.
**Which check runs where** and what each one paid for is in
[checks.md](docs/foundation/checks.md). Read it before editing a check, writing
one, arguing one is unnecessary, or reading a green run as evidence of anything.
A check whose reasoning you cannot state is one you are about to weaken by
accident.

## Where documents live

[docs/README.md](docs/README.md) is the map, and it is worth reading once before
adding a document rather than after.

**Decisions go in [docs/decisions/](docs/decisions/README.md), as `PDR-NNNN`.**
The distinction against a brief is what each is for: a brief is the approved
plan for one task, a PDR is a choice that closes off other choices. Most tasks
need only the brief.

**Nothing enforces the map.** No test, no script and no CI job looks at where a
document sits, so the map is the entire mechanism.

## The design system

**Every design system import comes from [`src/ds/`](src/ds/README.md) and
nothing under `src/` outside it may name a vendor package.** That seam is what
makes the design system swappable, and it is worth defending from the first
commit — a repository that imports the vendor from 37 files has chosen its
design system forever without anybody deciding to.

- **`src/ds/` holds primitives only**; a component tied to one product place is
  featured. The `component` skill draws the line; a worked example is
  [PDR-0013](docs/decisions/0013-primitive-and-featured.md).
- **Never vendor a copy** of a design system and never patch the package. That
  path becomes a fork nobody can rebuild.
- **A `string`-typed prop is a prop with no validation.** Where a vendor types
  an enum as `string`, a name that does not exist compiles, renders nothing and
  warns nowhere. Narrow it locally.
- **A token reform is proven in a browser or it is not proven.** Lint, build and
  a full green suite have all passed over a stylesheet that silently dropped 66
  tokens.

### Spacing

**A container with a `gap` says every child sits the same distance apart.** A
child that needs a different distance belongs to one more level of grouping,
never to a margin on top — a margin does not replace the gap, it adds to it.

**The part that is NOT yours: how far apart the parts of one vendor component
sit.** A card owns the space between its own head and its own body. Arranging
components is layout; reaching inside one is the fork this file already forbids.

## What a tool call costs, and how to spend less

**Tool output is roughly half of what a workspace like this spends, and `Bash`
alone is a quarter.** A result injected at call k of a session is re-read on
every call after it, so the same output costs nothing at the end of a session
and a great deal at the start.

| instead of | write |
| --- | --- |
| `cat <file>` | `grep -n '^## \|^export ' <file> \| head -40` for the map, then read the range |
| `grep -rn <term> src` | `grep -rc <term> src` first, then `grep -n -m3` in the file that won |
| `pnpm check:x` | `pnpm check:x 2>&1 > "$SCRATCH/x.log"; { head -3; tail -20; } < "$SCRATCH/x.log"` |
| `git diff` | `git diff --stat`, then the one file |
| `git log` | `git log --oneline -10` |
| `ls -R` / `find` | add `\| head`, always |

**Copy the check line's shape, and the reason is the floor.** Every check here
prints its scope on the first lines and its verdict on the last, so a bare
`tail -20` throws away the half that says what was measured. The full log stays
on disk for the red case.

**Read a large file by range, never whole.** Get the map with `grep -n '^#'`,
then read the lines you need.

**`pnpm check:floor` is what keeps this file from growing.** It measures what
every call pays before a word of the task is read and fails at a ceiling that is
raised by hand, with a date and a sentence. That sentence is the mechanism — the
number is cheap to change and is supposed to be.

## Skills

| Skill | Use it when |
| --- | --- |
| `setup` | |
| `writing-for-agents` | |
| `diff-review` | |
| `grilling` | |
| `voice-audit` | |
| `contrast-audit` | When a colour is actually being judged |
| `tokens` | |
| `tokens-figma` | |
| `parity` | |
| `component` | |
| `component-props` | |
| `sandbox` | Prototyping a screen in `src/sandbox` |
| `interactions` | |
| `pattern-research` | |
| `update-message` | |
| `feedback` | |
| `model-and-effort` | Named above, at the point a rung is chosen |
| `to-questionnaire` | To turn a decision you cannot answer into a questionnaire for somebody who can — **invoked by a person, never by the agent** |

Rows are **deliberately empty** where the skill states its own condition in its
`description`: a sentence here would be the same sentence paid twice. The order
is editorial — roughly when a person needs each — against an injected listing
that arrives alphabetical.

`skillOverrides` in [`.claude/settings.json`](.claude/settings.json) puts some on
`name-only`: the agent sees the name, pays no description, and the `Skill` tool
still reaches them. **A name with no description routes nothing on its own**, so
those get their condition from [`skill-router.cjs`](scripts/skill-router.cjs) at
the moment it occurs, or from this file's prose at the point the condition
arises. `to-questionnaire` carries `disable-model-invocation` instead, which
hides the name AND refuses the tool — it is reachable only as a file or by a
person typing `/to-questionnaire`.

`pnpm check:skills-table` reads both mechanisms and fails a skill the agent
cannot see with nothing to reach it. **Order is deliberately not compared.**
What it still cannot see is whether the sentence beside a skill is true, and
whether this is the set that should exist.

## Measured gotchas

Things that cost time here, kept because the render does not reveal them. A
gotcha earns a line when somebody lost an afternoon to it and no check catches
it; when a check does catch it, the check is the better home and this list is
not.

> GAP: empty on 2026-10-09. This repository began 2026-10-08 and has measured
> nothing of its own yet. The ones inherited from the repositories it was
> harvested from are about design systems it does not use.
