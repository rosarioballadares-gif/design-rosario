---
name: setup
description: Fresh clone, no client or no profile at session start, or access changed - records the client, then the person.
argument-hint: "Your role, if you already know it"
---

# Setup — wire this workspace to the client, then to the person

This runs when somebody new opens this repository, and it is one of the two
tasks here exempt from the intake gate in [CLAUDE.md](../../../CLAUDE.md) — the
gate's step 0 reads the profile, which is the thing this skill exists to create.
The other is [`feedback`](../feedback/SKILL.md), exempt for its own reason.

**Two layers, and the session-start notice says which are owed.**

- **The client, once per repository** — when
  [`workspace-wiring.md`](../../../docs/foundation/workspace-wiring.md) still
  carries "no client has been recorded". Read [CLIENT.md](CLIENT.md) and run
  its questions first: who the client is, whether they have a design system,
  where their code and design live. It ends in a spec of what to wire.
- **The person, once per person and machine** — when
  `.claude/profile.local.json` is absent, or their access changed. Everything
  below.

When both are owed, run the client's questions, then the person's question,
then write everything both layers produce. The person layer alone never asks a
client question; the client is recorded for everybody.

## What it is actually for

Measuring the machine is the small half. `pnpm check:env` does that in four
seconds and would not need a skill.

**The large half is that this workspace behaves differently depending on who is
using it, and it cannot tell.** A product manager who never opens Figma should
not be offered a Figma composition; somebody who does not write code should not
be handed a diff to review. Without a profile the agent guesses, and it guesses
the same way for everybody — which is the state this repository is in until
somebody runs this.

The other half of the reason is the one this whole repository is built around: a
rehearsed handoff on 2026-08-13 found that **nothing** crossed between a product
manager and a designer. Every question was answered and every answer lived in a
conversation that ended. So everything said here lands in a file, or it did not
happen.

## The rule that governs every answer

**Two states, no third.** A fact is either **given** — this person said it, or
you read it somewhere citable — or it is an **open question you named**.
"Reasonable assumption" is not a third state; it is an open question wearing the
costume of a fact.

When somebody does not know, write the gap with their name on it. Do not fill it
in. A profile that says `"tracker": "jira"` because Jira is common produces a
workspace that confidently points at the wrong place.

## Before you ask anything

One read, because it retires questions:
**[`docs/foundation/workspace-wiring.md`](../../../docs/foundation/workspace-wiring.md)** —
the team's facts. Anything already recorded there is **confirmed in one line,
not asked again**. The second person to run this skill should answer roughly half
of what the first one did, and if they do not, this step was skipped.

The product roster used to be the second read. Nothing here asks about a product
any more, and typed product data is read by the prototypes in
`src/` rather than by anybody being set up.

## How to ask, and how little

**Three questions, in ONE call of the structured question UI** — the person
layer's whole interview. Not one call per question, and not a fourth because it would be useful to have: everything else
this profile holds is either MEASURED below, or asked by the task that needs it
on the day it needs it.

> SOURCE: Ian Rueff, 2026-09-15 — "q el setup sea lo mas agil posible, q te
> pregunte lo minimo... menos es.mas". What this replaces asked about a dozen
> things across four calls, and the product question alone ran sixty lines.

**Offer "I do not know" as a real option in all three.** It is the answer that
produces a correct profile, and a question that does not offer it produces a
plausible one.

### The three

- **Role.** Product manager, product designer, research manager, design
  experience manager, design system manager, or something else they should
  name themselves. The three managers run teams, and this workspace does the
  same job for them as for a product manager or a product designer.

  > SOURCE: Ian Rueff, 2026-09-08 — "seria product designer manager como un
  > rol mas directivo, tenemos manager para user experience research, product
  > designer experience, product design system", each running several teams.
  > Later the same day, on those managers: "ellos tmb deberian poder hacer lo
  > mismo q los pd y pms".

- **Do you write code here, or compose only?** The single answer that changes the
  most later, so it is asked plainly rather than inferred from the role.
  Designers here do both, and so can any of the three managers.
- **Do you design in Figma at all?** A no is worth having explicitly: it is what
  stops the agent offering a composition to somebody with no seat.

### What is NOT asked, and where each one goes instead

| | asked by nobody, because |
| --- | --- |
| the machine | `pnpm check:env` measures it, below |
| the Figma account and its seat | `whoami` proves it, below |
| which client and product | the client layer asked it once, for everybody; it is in workspace-wiring |
| the tracker | the client layer recorded the client's; the profile writes `"kind": "none"` and whatever opens a ticket asks at that moment |
| the composition file, the props file key | the Figma task that needs them asks, and they are `null` until then |

**The language is DECLARED, not asked.** Write the language they are writing to
you in, and say it back in the close so they can correct it in one word. That is
evidence rather than a guess — and a guess is what this file forbids two sections
up. Everything versioned stays English, which [CLAUDE.md](../../../CLAUDE.md)
explains; the conversation does not have to be.

## Then measure, rather than ask

### The machine

Run `pnpm check:env` and read its table with them. It reports Node, pnpm, the
registry chain, the install, and whether a credential has leaked into the tracked
`.npmrc`.

When a row is blocked, the recipe is in [`WIRING.md`](WIRING.md) — open it then,
and not before. **Print the command and let them run it.** Do not write a token
into any file: it is a credential, and the file it belongs in is outside this
repository.

If the registry cannot be fixed today, that is a legitimate outcome. Say which
half of the workspace is available anyway and carry on.

### Figma, if they said yes

**Prove it rather than recording a claim.** Call `whoami` on the Figma MCP and
write down what came back — it answers with the handle, the email and the **seat
on each plan**, which is the fact that decides whether they can compose at all. A
person can believe they have a connection they do not have, and `pnpm check:env`
cannot see this: those servers authenticate through the agent rather than through
a Node process, and the check says so in its own output.

Use `whoami` specifically. `get_libraries` looks like the natural probe and is
not one — it needs a `fileKey`, which is the thing you are trying to find out.
The probe has to take no arguments, or it fails for the reason you are testing
for and one you introduced.

**And run it on every Figma server the session has, not one.** More than one can
be connected, they answer as **different accounts**, either can be picked for a
request, and none of them says which account it carries — measured on this
workspace, where a second server answered as a personal studio account holding
no access to this team at all. Composing through the wrong one gets a 404 on the library,
which looks exactly like a missing seat. The details are in
[`workspace-wiring.md`](../../../docs/foundation/workspace-wiring.md).

> SOURCE: both probes run against this workspace by Claude, 2026-08-18

**Write down which server answered**, in `figma.server`. Not the fact that one
did — *which one*. It is the only record of which account this person's Figma
work goes through, and the whole point of the paragraph above is that the name
does not tell you: two servers answer to similar names as different people, and
picking the wrong one spends another account's quota to get a 404.

**`figma.propsFileKey` stays null here.** It is the 22 characters after
`/design/` in the URL of the file they AUTHOR components in — not the
composition URL — and any check over design-file properties needs it, which
is deliberate: there is no default file, because falling back to one the person
did not name would measure somebody else's work and report it as theirs. The
task that runs that check is the one that asks.

## Then write it, and write all of it

Nothing above counts until it is in a file. Files 2 and 3 are tracked, so they
are committed by name on a `feat/` branch — `feat/client-setup` when the client
layer ran — and closed as CLAUDE.md's "Closing a task" says: merge into `main`,
`pnpm gate`, push on the person's yes.

### 1 · The person, to `.claude/profile.local.json`

Not versioned — [`.gitignore`](../../../.gitignore) covers it — because it
describes a person and a laptop. Write this shape, and omit nothing: a field
nobody answered is `null` with its question in `open`, never a guess and never a
missing key.

```json
{
  "version": 1,
  "recorded": "YYYY-MM-DD",
  "name": "how they want to be addressed",
  "role": "product-manager | product-designer | research-manager | design-experience-manager | design-system-manager | other",
  "writesCode": true,
  "language": "the language to speak to them in",
  "code": { "state": "ready | blocked", "detail": "which step of the chain, if blocked" },
  "figma": {
    "state": "ready | no-seat | unproven",
    "mcp": "answered | absent",
    "server": "which Figma MCP server answered whoami — they are different accounts",
    "compositionFile": "URL or null",
    "propsFileKey": "the 22-char key of the file they AUTHOR in, or null — not the URL above",
    "authorsComponents": false
  },
  "tracker": { "kind": "none" },
  "open": ["every question nobody could answer, with who would know"]
}
```

**`role` names three managers, and that list is an org chart.** Research,
design experience and design system are named separately because the discipline
is what says which work somebody is asking for. **Nothing can check that list
against the organisation it describes**, and this one was inherited rather than
measured here — read it to the person and let them correct it.

> GAP: whose org chart this is has not been confirmed for this workspace. The
> three manager roles came from the repository this was harvested from.
`pnpm check:role-list` holds the two statements in this file to each

other, position by position, and fails when one is edited alone — it cannot tell
a list that is current from one that is merely consistent, and it says so in its
own output on every run. `pnpm check:env` adds a row reporting whether the role
in your profile is one of these. Neither sees a team renamed, merged or added,
which still leaves the list wrong and silent. Read it to the person and let them
correct it rather than picking on their behalf.

`state` fields carry `unproven` rather than a guess when the probe did not run.
An unproven connection and a working one look identical in a profile that only
records what was said.

**`tracker` is written `{ "kind": "none" }` and nothing else is asked.** The
fields a create call needs — the board, the project key, the issue type, the
`Team` value with its id, the `accountId` — all still exist and are all still
required; whatever opens a ticket gathers them at the moment somebody files
one, which is the only moment they are known to matter. Setup collected them
from everybody, and most people here never file one.

> SOURCE: Valentina and Wadi through Ian Rueff, 2026-09-15 — the tracker
> questions read as confusing to designers who do not open tickets. On
> 2026-09-15 this block was first cut to one question and then to none, in the
> same afternoon and on the same branch.

### 2 · The team, to `docs/foundation/workspace-wiring.md`

Only facts that are true for everybody: the tracker, the library URL, who owns
access. Each one gets a `> SOURCE: <who>, <when>`. **Turn the `> GAP:` lines you
answered into sourced facts, and leave the rest standing** — a gap you could not
close is the most useful thing on the page, because it is the question the next
person knows to ask.

Anything about this one person goes in the profile instead. A name in this file
is a fact that outlives the person.

### 3 · The roster, to `docs/foundation/people.md`

**One row: name, role, today's date, and how it is known.** This is the only
place in the repository that knows who exists — `.claude/profile.local.json` is
per-machine and untracked, so without a row here nobody else can see that this
person is here.

It is what makes `> OWNER:` on a backlog item verifiable: `pnpm check:backlog`
reads the first column and fails an owner who is not in it, because a misspelled
name is an owner no filter will ever find while the item still looks assigned.

**Add a row. Never rewrite one that is already there**, and never fill in
somebody else's role — the `> GAP:` lines under that table name people who used
the workspace without registering, and only they can close them.

### 4 · No brief for the person

Briefs are per task and this is per person. The files above are where this
lands. The client layer's spec, `briefs/<date>-client-setup.md`, is the one
brief `/setup` writes, and only once per repository.

## Close with evidence, and with what is still missing

- **The `pnpm check:env` table**, pasted.
- **What the MCP probes returned** — which servers answered, which did not, and
  which were never tried.
- **The two file paths**, and one line each on what changed in them.
- **The open questions, with who would know.** A setup that returns without
  naming what it could not answer has hidden the most useful thing it produced.

**When the registry is not fixed, close in a declared partial state.** Say which
half works — Figma, reading, briefs — and which does not, and
what unblocks it. Do not close on "set up" when `pnpm install` still fails; the
person will find out an hour later and will not know which of the last ten
things they did caused it.

**And close by saying what happens next, which is not the same as what was
configured.** Point at [`GUIDE.md`](../../../GUIDE.md) and say in one sentence
what it is: every part of this workspace in the order a product designer meets
it. When the client layer ran, name the spec's first open task and its owner.
Then invite the first task, in plain language. **And say the language back to them** — it is the one
field on the profile that was declared rather than asked, and one word from them
corrects it.

**This is not decoration and it was paid for.** Until 2026-09-09 this skill
closed on the evidence bullets above and stopped, so a person finished setup
knowing exactly what had been measured about their machine and nothing about what
the workspace does or what to do with it. The second person to run it said so,
in a feedback record of the repository this was harvested from.
A closing report that names every file it wrote and no next step is a status
message, not an onboarding.

## What this skill must not do

- **Invent a fact to make the profile look complete.** An empty field with a
  stated question is a question somebody can still answer.
- **Write a credential anywhere.** Not `~/.npmrc`, not `.npmrc`, not an
  environment file. Print the line; they paste it.
- **Write a project `.mcp.json`.** None is tracked today, and one that was would
  carry a server added for one person to everybody who clones. User scope is `claude mcp add -s user`,
  and [`WIRING.md`](WIRING.md) has the commands.
