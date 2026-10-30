# The checks, and what each one paid for

Read this before editing a check, writing one, arguing one is unnecessary, or
reading a green run as evidence of anything. A check whose reasoning you cannot
state is one you are about to weaken by accident.

**Every check prints its own scope on the first lines and its verdict on the
last.** What a check measures, what it refuses to do, and what it cannot see
arrive when it is run — not from here. This document holds the part a run
cannot say: why the check exists, and what its absence cost somebody.

Most of these were harvested on 2026-09-19 from two repositories running the
same method against two different clients. Where a measurement below has a date
before that, it was taken there and is kept because the reasoning travels even
though the tree does not.

## What runs, and where

| | |
| --- | --- |
| **`pnpm gate`, before every push to `main`** | Everything a publish is proven against, then everything CI runs that a deploy does not. Writes `.gate-receipt.json`, which `git-guard` demands at the push |
| **CI, on every push to `main`** | Reports, and holds the deploy: a red `check` publishes nothing. **It never gates the merge** |
| **The deploy, CI's `deploy` job** | Vercel runs the five publish checks again and promotes only a green build, so a red step leaves the last green one live — but `main` already carries the defect |
| **The hooks** | At the moment the rule applies, on every session |

> SOURCE: the agent, 2026-10-09 — `vercel deploy --target preview` ran the five
> steps of `vercel.json`'s `buildCommand` in order, and with lint red on purpose
> it stopped at `lint` and published nothing
> ([the brief](../../briefs/2026-10-09-vercel-deploy.md)).

**CI does not gate the merge on purpose, and that is worth understanding
rather than fixing by reflex.** Work reaches `main` through a local `git merge` that no
workflow observes — the run starts on the push afterwards, when the merge
already exists — and turning a red run into a blocked merge takes a branch
protection rule, which GitHub does not offer on a private repository outside a
paid plan. So a red run is a message to whoever reads it. Read it.

`pnpm gate` is what closes that distance the cheap way.

## The rule for writing one

**A check earns its place by naming a failure that is SILENT.** Not one the
build catches, not one a reader would notice — one where nothing goes red and
the thing is simply wrong. Every check below was written after such a failure,
and each is cheaper than the afternoon it replaced.

The corollary decides the other direction too: **a rule may leave `CLAUDE.md`
only for a mechanism that fires in time.** Moving a rule into a document
nobody opens is not a cut, it is a deletion with a pointer left behind.

## The brief machinery

**`check:briefs`** refuses a brief whose sections carry prose with nothing
behind it — a citation, a `> SOURCE: who, when`, or a `> GAP:`, and there is no
fourth state. It also enforces a byte budget per field, because a brief is
written into the conversation and then carried in every later call of the
session, so length is paid twice and the second time repeatedly.

What it cannot do is tell a filled field from a plausible sentence. A confident
paragraph about a screen nobody opened passes. What it does is make the
unsupported parts *visible* instead of letting them read like the rest.

**`check:brief-present`**, wired into `git-guard`, refuses a commit that
carries work with no brief behind it. The gate that produced the brief is a
rule in prose, and a rule in prose is one the agent can forget; this is the
mechanism that fires at the moment it is forgotten.

## `git-guard` — the five rules nothing caught

`PreToolUse` on `Bash` and `PowerShell`, refusing what `CLAUDE.md` forbids at
the moment a `git` command is typed rather than describing it in a file read
hours earlier. It acts only in a repository that carries
`scripts/git-guard.cjs`.

- **`git add` over the whole tree.** Measured 2026-09-07, with six agent
  sessions against one checkout: a `git add -A` in a commit about one subject
  swept up another session's unfinished work and carried it to `main` under a
  message about something else. Nothing failed and nothing was lost, **which is
  exactly why prose could not catch it — there was no symptom to notice.**
- **A commit on a branch that is not a working surface.** `main` is not one.
- **A commit that carries work with no brief**, as `check:brief-present` above
  decides it. `feedback/`, `docs/foundation/people.md` and
  `docs/foundation/workspace-wiring.md` owe none.
- **A push that would update `main` over a tree `pnpm gate` has not measured.**
  The receipt names a commit, and it is compared to the commit the push sends,
  not to HEAD. A merge moves HEAD, so a receipt written before the merge does
  not match after it. It proves the TREE, never the approval —
  the confirmation stays a person's.
- **`git worktree remove` while processes still run out of that worktree.**
  Measured 2026-09-25: 82 orphaned node processes in 32 trees, and a gate that
  died for the memory they held. The repair is `pnpm worktree:close <name>`,
  which stops them first. **It cannot see `ExitWorktree`**, which does not go
  through `Bash`.

## `check:floor` — the one cost a repository controls

It measures what every call pays before a word of the task is read — the
standing rules whole, plus one line per skill the agent is allowed to see — and
fails when a part crosses the ceiling in `scripts/context-floor.json`.

**Raising a ceiling is one edit: the number, today's date, and a sentence in
`why` that justifies it. That sentence is the whole mechanism.** The number is
cheap to change and is supposed to be. What the check buys is that changing it
leaves a record, which 27 days of monotonic growth never did.

**Lowering a ceiling after a cut is the same edit and needs the same sentence.**
A ceiling left far above the measurement is a check that has stopped checking.

What it cannot see, printed on every run: the harness's own system prompt,
anything a hook prints at session start, and — the one that matters — **whether
the rules inside are any good.** A 3.000-token `CLAUDE.md` that lets an agent
ship the wrong screen is cheaper and worse, and this check would call it an
improvement.

## The consistency checks

They share a shape: each holds two statements in this repository to each other,
and **none of them can see whether either statement is true of the world.**
Each says so in its own output rather than in a header nobody opens.

- **`check:skills-table`** reads the skills table in `CLAUDE.md` against the
  directory it indexes, in both directions, and fails a skill the agent cannot
  see with nothing to reach it. In the repository it came from that table sat at
  twelve of seventeen for weeks and was found by accident, when four subagents
  happened to list the directory and all four returned seventeen. **Order is
  deliberately not compared**: the directory arrives alphabetical and the table
  is ordered by when a person needs each one.
- **`check:role-list`** holds the two places `setup/SKILL.md` names its roles to
  each other, position by position. It was paid for once already: fields were
  written into the profile without being added to the documented shape, and the
  next run of that skill would have written the old shape back over them.
- **`check:links`** reads every markdown link in `CLAUDE.md` against the file it
  names. It exists because of how that document gets smaller — the rule stays
  and the evidence moves to `docs/`, leaving a pointer — and that trade has one
  failure mode and it is silent: the pointer survives, the destination is
  renamed or never written, and the reader is told the reasoning is somewhere it
  is not. **A dangling pointer is worse than none**, because it reads as an
  answer somebody could go and get. It checks EXISTENCE, never content.

## `check:copy`, `check:feedback`, `check:backlog`

**`check:copy`** finds the characters the voice guide forbids without exception
over the string literals in `src/`. The judgement half of a copy audit needs a
person and the mechanical half does not — writing one file's usage rules on
2026-09-02 put nine semicolons in it, and the only reason they were found is
that somebody happened to run the audit. Baseline-gated, so a NEW one fails and
the recorded ones do not.

**`check:feedback`** reads every record in `feedback/` for a name, a date, a
place a reader can go, and a cost. It runs early in CI, above anything that
needs a credential, for a reason particular to it: **the moment somebody is most
likely to file a record is the moment something else here is broken**, and a
check that only ran after a successful install would be unavailable exactly
then.

**`check:backlog`** refuses an item with no `> STATUS:`, because a state nobody
typed is not a state, and it refuses a `dropped` or `blocked` with no reason on
the same line — each closes something off, and a closed door with no note on it
gets opened again by the next person. It passes an EMPTY backlog, where a copy
starts, only while `backlog/README.md` is read: zero files with no README is a
walk that found nothing, and fails.

## The hooks

A hook is for a rule whose moment the model cannot be relied on to notice.
Measured across 82 sessions in the repository these came from: skills were 0,6
per cent of tool calls, and one skill was invoked ZERO times while 3.303 calls
were made into the surface it covered. **A rule that depends on the model
noticing the moment is a rule that does not fire.** These are deterministic.

| Hook | Fires | Why |
| --- | --- | --- |
| `session-brief` | session start | Who is using this workspace. **Exits 0, always** — a hook that fails greets somebody's first session with an error about a file they have never heard of |
| `git-guard` | before a `Bash` or `PowerShell` call | The five rules above |
| `memory-index-guard` | before an `Edit` or `Write` of an agent's `MEMORY.md` | The index is paid on every call and lives outside the repository, so no check sees it. **It refuses** a write that grows it past `memoryIndex` in `context-floor.json` or adds a line over its cap |
| `worktree-edit-guard` | before an `Edit`, `Write`, `NotebookEdit` or `MultiEdit` from inside `.claude/worktrees/<name>` | An edit into the main checkout or a sibling worktree writes into somebody else's work while this branch looks clean — the collision "Go + worktree" exists to remove. **It refuses** it; the worktree's own files and anything outside the repository pass. It sat in one person's user settings until 2026-10-08, so nobody who cloned had it |
| `ask-guard` | when a turn stops | A real fork goes through the question UI, and a session on 2026-10-09 closed two turns on prose questions with that rule in context. **It blocks the stop once** when the text after the last tool call ends on a `?` or `¿` outside code and quotes, or carries four brief headings; an ask with no question mark passes unseen |
| `skill-router` | on a prompt | A skill listed by name only routes nothing on its own, so the name arrives with its condition |
| `call-budget-notice` | every tool call, at 200 and every 100 after; a subagent counts its own | Cost is quadratic in session length and compaction fires too late to help. Nothing in a conversation knows how long it has been running |
| `bash-round-notice` | the third consecutive read of a different path | Those turns did not have to be three |
| `edit-round-notice` | the third edit of one file | 90,5 per cent of edits lengthen a file, by an average of 731 characters, while removals average 135. **The twelfth pass adds as much as the first**, because "what is missing?" can only be answered by adding |

Every one of them **fails open in the direction of silence**. An unreadable
payload, an unwritable store, a shape it does not recognise: the worst any of
them may ever do is stay quiet.

**Each notice fires once per session, per entry.** What a hook prints enters the
conversation and is re-read on every later call, so a notice that repeated would
be accretion — the same standing cost `check:floor` exists to hold down, paid in
a worse place.

## What a green run does not say

**Nothing here mounts a component.** `pnpm test:run` says the models are
well-formed and the checkers do what they claim. It does not say a screen works,
and it never has — that evidence is a screenshot or a capture, never a test
count.

**It does not typecheck either.** `tsc -b` runs inside `pnpm build` and nowhere
else.

**A file count LOWER than the last run means a spec failed to import and
reported green.** Read the count, not just the colour.

> GAP: nothing in this repository reads a rendered page. Two such checks existed
> in the repository this came from and were deleted on 2026-09-12 for costing
> 248 of 251 seconds. If a rule about layout matters here, it needs a check that
> reads the render — a spec that reads the stylesheet proves only that the file
> says what it says.
