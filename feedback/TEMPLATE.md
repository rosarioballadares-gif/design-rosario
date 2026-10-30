# Feedback: <the friction, in a few words>

Copy this file to `feedback/YYYY-MM-DD-<slug>.md` and fill it in, or let the
`feedback` skill do it for you. `pnpm check:feedback` reads every record here.

**This is not a brief, and the difference is the point.** A brief asserts facts
about the world, so every section of one earns a citation. A record here is
**your testimony**: what happened to you, where, and what it cost. Nobody is
asked to cite their own morning.

Three things the check does ask for:

- **A name and a date**, as `> SOURCE: <your name>, YYYY-MM-DD`. The name is the
  person who **hit** this, never the person writing it down. That distinction
  has already been lost here once, and a record signed by the wrong person is
  worse than an unsigned one.
- **A place a reader can go** under `Where` — a path, a link or a command.
  "The setup skill" is not somewhere. `.claude/skills/setup/SKILL.md` is.
- **Something behind a proposal**, if you write one. That is the one part of
  this document that is a claim about how the repository should change.

**What does not belong here.** Feedback about the product being designed goes to that
product's context or its tracker. This directory is about **this workspace** —
the skills, the checks, the documents, the setup, the agent's behaviour.

**Write it even when it is small.** The four-minute confusion nobody reports is
the one that costs the next person four minutes too.

## What happened

```
What you were trying to do, and what the workspace did instead. Plain sentences.
No citation is required here and none should be invented.
```

## Where

```
The file, the skill, the command or the document. A path in backticks, a
markdown link, or a command like `pnpm check:env`. If you genuinely could not
tell what produced it, write "> GAP: I could not tell where this came from" —
that is a complete answer and it is useful on its own.
```

## What it cost

```
Time, a wrong turn, a thing you did not do, a decision you took on a guess.
An estimate is fine. A blank is what separates a report from a mention.
```

## What would fix it

```
Optional. Leave it out if you do not know — the person who hits friction is
frequently not the person who knows the repair, and a guessed fix sends the
next reader down it.

If you do write one, back it: a citation, a "> SOURCE: who told you, when", or
"> GAP: I do not know whether this is the right repair".
```

---

**This file fails `pnpm check:feedback` on purpose.** Every prompt above sits in
a fenced block and it carries no reporter, so an unfilled copy of it cannot pass
either. If it ever goes green, the check has stopped reading.
