---
name: model-and-effort
description: Before a long or expensive task, or any fan-out past three agents — which model, how much effort, how many agents.
---

# Choosing the model, the effort and the fan-out

## The rule

**The repository sets the floor. The task earns the escalation, and the
escalation is declared.**

`.claude/settings.json` here ships `effortLevel: high`, `ultracode: false` and
`workflowSizeGuideline: small`, so every clone starts at the same place and
nobody has to know to lower anything. A settings file is static and cannot know
what you are about to ask for — that is why the floor lives there and the ladder
lives here.

**Declare the choice when the task opens, in `## Autonomy`, beside the
checkpoints.** Model, effort, and — if there is a fan-out — how many agents and
what they cost. One line.

## The ladder

Climb it only as far as the task actually reaches, and say where you stopped.

| rung | the task is | model | effort | fan-out |
| --- | --- | --- | --- | --- |
| `census` | Counting, grepping, a census, a capture, running a check and reading its output | **hand to `sonnet`** | `low` | one agent, which IS the mechanism |
| `repair` | One file, one rule, a known repair, a brief, a commit | inherit | `medium` | none |
| `default` | **A normal change with a real diff, a screen, a skill edit** | inherit | **`high`** | none |
| `decision` | A decision that closes off other decisions; a plan; a cut nobody can undo cheaply | inherit | `xhigh` | up to 3, and say why |
| `audit` | Auditing a large surface where the answer must be exhaustive, or a design with several credible shapes | inherit | `xhigh` | a workflow, budgeted out loud |

**`census` is the one row that names a model, and naming it is not enough.** A
session cannot change its own model, so `sonnet` there is reachable only by
handing the work to an `Agent` with `model: "sonnet"`, or — for the `audit` row,
whose escalation is a workflow — by declaring `model` on the reading phases of
`meta.phases` in the workflow script. Writing the rung into
`## Autonomy` and then doing the census yourself runs it on whatever the session
opened with — which is what happened for the first 89 sessions here, all 56.695
priced calls of them on `claude-opus-5`.

**Effort works the same way, and the brief does not apply it either.** A
session runs at the effort it opened with — `effortLevel` here, `high` — and
writing `xhigh` in `## Autonomy` changes nothing about how it thinks. A rung
whose effort is above the session's is applied in one of two ways: the person
types `/effort xhigh` before the task starts, or the work is handed to an
`Agent` with `effort: "xhigh"` (a workflow's `agent()` takes the same option).
Measured 2026-10-08: three briefs of the base's founding declared
`decision`/`xhigh` — the founding brief, and the rehearsal's look-and-feel and
headless stages — `check:briefs` passed each pair, and every one ran at
`high`. So `## Autonomy` says which of the two it used, or that it ran at the
session's effort and why that was enough.

**The phase declaration takes, and almost nobody uses it.** Measured 2026-09-11
over 1.737 sidechain transcripts: `wf_e36accaf` ran 130 of its 164 calls on
Sonnet and `wf_51f97bca` 89 of 134, the balance being the orchestrator and the
phases that declared nothing. **Two of 74 runs did it.** Before reaching for it
at scale, read the size of the prize — `pnpm shapes` measured census-shaped work
at 7,4 per cent of subagent spend, so the whole lever is worth about 400 USD
across this repository's history, not thousands.

**Following this row DOES show in `pnpm cost`, since 2026-09-11.** The report
reads sidechain transcripts and prints subagent spend with a per-model
breakdown, so the census that ran on Sonnet on 2026-09-10 is in it. What the
instrument still cannot say is WHICH subagent a cost belongs to, so it confirms
that a sonnet call happened and not that this rung was the reason. The evidence
for what came back is still the subagent's own returned list.

**What to hand over.** The method, already written, and the extract — never the
file and never a tool it would have to go and read for itself. What comes back
is a short list with the command and its output beside each item, which is
stage one of the two-stage shape below. You classify it.

**What it costs is knowable as a total and not as an attribution**, for the
reason the fan-out rule gives below. So one agent is still the budget for a
census, and a second one is a fan-out that has to be argued for like any other —
the report cannot tell the two apart afterwards.

**The rung names are what `## Autonomy` has to carry**, since 2026-09-11: a
brief names its rung and the effort that rung prescribes, and `check:briefs`
fails the pair that disagree. The names exist for that — nothing was rearranged
to add them. What no checker can see is whether the rung you picked is the right
one, so picking one row down to save tokens costs nothing and is on you.

**The escalation that has to be argued for, every time, is the fan-out.** Its
total stopped being invisible on 2026-09-11; its attribution did not. One
workflow in this repository has run to two million subagent tokens, and the
report can say that it happened without saying which agent of it spent what.

**`effortLevel` accepts `low`, `medium`, `high` and `xhigh`.** `max` is not in
the schema; a settings file that carries it is describing a level this
configuration does not define.

## Two failure modes of the ladder itself

**Climbing on the wrong signal.** Long is not the same as hard. A task that
touches forty files mechanically is a `low` sweep; a task that changes one
sentence of `CLAUDE.md` can be the most consequential thing you do that day.
Read the shape, not the size.

**Never climbing down.** The floor is a default, not a starting bid. A session
that opened at `xhigh` for a hard decision and then spends an hour counting
files is paying the wrong rate for the second hour, and nothing will say so.

It goes in the brief for the same reason the checkpoint does: a result read a
week later cannot be judged without knowing what produced it. A partial answer
from a cheap model at low effort and a partial answer from an expensive one at
max mean different things, and nothing in the output says which you have.

## What this workspace has actually measured

**One measurement, 2026-09-10, and its limits are stated before its result.**
Two audit regions were run on `claude-opus-5` and then on `claude-sonnet-5` with
byte-identical prompts. Ground truth for those regions was **zero** operative
rules lost.

| | rules swept | findings | false positives |
| --- | ---: | ---: | ---: |
| Opus | 63 | 9 | 9 |
| Sonnet | 52 | 2 | 2 |

Sonnet returned an empty finding list for a whole region, which was correct and
is the hardest answer to give — an empty array reads as laziness. Opus filled
the same region with three inventions, and three of its nine false positives are
refuted by grepping the current file, which was step one of the method it was
given.

Six of Sonnet's citations were re-checked against the files: all six exact. No
fabricated output, no invented line number.

**THE LIMIT, which matters more than the result: a task with no true findings
measures the false-positive rate and CANNOT measure DETECTION recall.** Sonnet
was right not to report. Whether it would have found something real is not
known, and nothing here should be read as saying it would. That needs a task
with planted findings, and one ran on 2026-09-11 — its own section below.

**Enumeration recall WAS measured, 2026-09-11.**
A census of every file path `CLAUDE.md` names went to one `sonnet` agent under
this rung, against ground truth computed separately in the main loop —
`grep -oE` over the file, then `test -e` and `git ls-files`, 51 distinct names.

| | |
| --- | --- |
| names enumerated | **51 of 51** |
| line numbers, spot-checked | **7 of 7 exact** |
| names my regex missed, it found | 4, two real: a `.yml`, a specifier |
| its own totals | wrong twice: 55 rows over 54, one duplicate merged, one not |

**So it misses nothing when the thing to find is EVERY item of a kind**, which
is the census case and is now measured rather than assumed. The slips are
the failure to expect: it enumerates completely and then adds up wrong, so take
its rows and compute the total yourself.

**Its citations were not tested here, because the method forbade them.** The
prompt asked for a name and a line number and for no quoted sentence, on the
strength of the "quotes badly" result above. A census that needs a quotation is
still one to verify line by line.

## Detection recall, measured 2026-09-11 with five planted defects

Five true statements in `docs/foundation/checks.md` were made false inside a
throwaway worktree — a path that no longer resolves, a number, a regex, an
imported symbol, a spec name — and one blind prompt went to both models.

| | planted found | real defects also found | false positives |
| --- | ---: | ---: | ---: |
| Opus | **5 of 5** | 3 | 0 |
| Sonnet | **4 of 5** | 2 | 2 |

**The one Sonnet missed was the NUMBER** — "116 exports where the file said 115",
altered to read 126 and 125. It found all four structural defects and lost the
one a reader is least equipped to catch, which is the defect type `check:claims`
exists for.

**Both of its false positives were the documented failure again**: it read a
claim the sentence dates as present tense, and it replaced "7 claims covered 8 of
them" with "the registry holds 7 entries", then refuted its own version. Neither
came from a bad command.

**Three defects nobody planted were found, all real** — a workflow that no longer
diffs, an assertion count of 32 described as 21, and three links to a `BACKLOG.md`
deleted on 2026-09-10. Opus found all three, Sonnet two. The document under test
was wrong in ways nobody had noticed.

**So: hand it a census, not an audit.** On enumeration it loses nothing; on
detection it finds the structural defects, misses the numeric one and adds two
findings a person has to disprove. The two-stage shape below is what that result
argues for.

## Hand to the cheap model

- **Measuring, counting, grepping, inventorying.** Anything with a mechanical
  acceptance test: did every row of this table survive, what paths does this file
  name, which skills are in the directory and not in the table, how many gaps
  spend a primitive. This is the work `check:role-list`,
  `check:skills-table` and every `baseline:*` do, and none of it asks for
  judgement.
- **Executing a method that is already written** and returning the evidence: a
  skill with steps, a checklist, "I ran X and it printed Y".
- **Sweeps where the expected answer is "nothing is broken".** It costs the
  reviewer less noise — two refutations against nine on the same comparison.

## Do not hand it

- **Auditing against an abstract definition.** Operative versus record,
  reachable versus degraded, does this line trace to a sentence of the request.
  Both of Sonnet's false findings came from **replacing the stipulated
  definition with a reasonable one of its own** — not from a bad grep. In a
  repository whose entire contract is a file of rules meant to be applied
  literally, that is the failure to watch for, and it arrives with
  well-cited evidence beside it, which is the expensive way to be wrong.
- **Writing or editing `CLAUDE.md`, a skill, or a PDR.** Same defect on the
  writing side.
- **Designing a check, or deciding where it runs.** Choosing the floor, choosing
  what the `expect` scope excludes, deciding whether a baseline is a record or a
  silencer. This repository has already paid for getting those wrong.

## The two-stage shape, which beats both

Do not ask one model to sweep AND judge in one pass. That format produced nine
false positives from the expensive model and two from the cheap one, against a
ground truth of zero, and the reviewer pays for both.

1. **The cheap model sweeps, mechanically**, and returns a short list with the
   command and its output beside each item.
2. **The expensive model classifies that short list.**

The audit that produced the table above would have been better and far cheaper
run this way, and neither model ran the check that resolves it outright: a
fingerprint sweep of every sentence of the original against the whole
repository, which is about fifteen lines of node and returns a complete,
auditable answer.

## Effort

Effort trades thoroughness for tokens within one model, and it is the first
lever to reach for before changing model at all — lower effort on a capable
model often beats higher effort on a weaker one, and one model means one cache.

Reach for the top of the range only when correctness matters more than cost and
you have measured that the level below is not enough. A cheaper request that
needs three more turns to finish the job is not cheaper: judge cost per
completed task, never per request.

### Measured 2026-09-11: on a census, effort is free in both directions

Two subagents, identical but for the `effort` line in their frontmatter, ran
`scripts/effort-probe-prompt.txt` verbatim, concurrently, on the same machine.

| arm | tool calls | subagent tokens | duration |
| --- | ---: | ---: | ---: |
| `effort-probe-high` | 16 | 29.761 | **20.708 ms** |
| `effort-probe-xhigh` | 16 | 29.630 | **20.778 ms** |

**70 ms apart on 20,7 seconds — 0,3 per cent** — and the two answers were
identical character for character.

**Read it as a statement about the `census` row and nothing else.** The prompt
file says of itself that it is *deliberately a CENSUS: mechanical, serialized,
with no judgement in it*, which is the task shape where effort has the least to
buy. So this is evidence FOR the ladder's `census` row — `low` costs nothing
there, because nothing does — and no evidence at all about `decision` or
`audit`, which is where `xhigh` actually sits. It is also n=1 per arm.

**It also closed a blockage that was believed permanent.** The A/B was recorded
as unmeasurable because the `Agent` tool answered `Agent type not found` for both
probe types, and because a `claude -p` session writes no `effort` key. Neither
held here: an ordinary interactive session had both types in its registry, and
`pnpm latency --days 1` moved **+17 on `high` and +17 on `xhigh`**, symmetric,
with `unknown` unchanged — sixteen calls plus a final answer, per arm, each
carrying its effort. Why that earlier session's registry lacked them is still
unexplained, so do not read this as "it always works".

Brief: briefs/2026-09-11-effort-ab-run.md

## Budget a fan-out before launching it

Say the arithmetic out loud first: items × tools per item × agents. If the fan-out
reads a metered API, a budget is hard — the design tool allows 200 reads a day
for a whole account — and it was overrun five times over once, when 229 agents
for themselves. Read from the main loop, hand agents the extract.

`pnpm cost --tools` is what says afterwards what it actually cost, by tool and by
session, and `pnpm cost` is what says whether the choice made any difference.
**Subagent spend is invisible to both** — zero entries in 54.378 calls carried a
sidechain marker — so a fan-out's cost is not in any figure either one prints.
