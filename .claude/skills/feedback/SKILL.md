---
name: feedback
description: A skill, check or doc here cost somebody time, confused them, or behaved unlike its own text. Or how to report it.
argument-hint: "What went wrong, if you already know"
---

# Feedback — put the friction in a file before the session ends

**This skill is exempt from the intake gate in [CLAUDE.md](../../../CLAUDE.md),
and the exemption is the whole design.** Demanding an approved brief before
somebody can say "the setup skill left me stuck" would cost more than the
friction did, and the record would never be written. Feedback is operational
work. Repairing what it reports is not, and that goes through the gate like
everything else.

## What it is actually for

The friction is not the loss. The loss is that it lives in a conversation, and
conversations here end.

Two of them already have. Sarah Johnston is the first person who did not write
this repository to run `/setup` and compose against it, on 2026-08-31 and
2026-09-01. Three commits survive and what it cost her does not, because nothing
asked. Somebody noticed the theme picker offered a brand it did not paint, and
finding reached CLAUDE.md as `> SOURCE: Ian Rueff` — recorded, and under the
wrong name, because the only person with a place to write it was the one who
heard it secondhand.

Both are the same failure with the same repair. A file, signed by the person it
happened to.

## The one rule that outranks the others

**The reporter is the person who hit it.** Not the person typing, not the agent,
not whoever relayed it. If Ian tells you what Christine ran into, the record is
Christine's and the line says so, with Ian named as how it reached you.

Getting this wrong is worse than not writing the record. A misattributed record
sends the next reader to the wrong person, and it takes credit for a finding
away from whoever earned it.

## Steps

1. **Name the reporter and the date.** The person at the prompt is the default,
   and [`.claude/profile.local.json`](../../profile.local.json) holds their
   name. Confirm it rather than assuming — this session may be running for
   somebody else. If the friction is something **you** observed rather than
   something a person reported, say so in the record and sign it as the agent's
   session with the date.
   *Done when you have a name and a `YYYY-MM-DD`, and you know which of those
   two cases you are in.*

2. **Get the three answers, in one exchange.** What they were trying to do and
   what the workspace did instead. Where — a file, a skill, a command, a
   document. What it cost — time, a wrong turn, a decision taken on a guess, a
   thing not done. Ask through the question UI wherever there is a real fork,
   as [CLAUDE.md](../../../CLAUDE.md) requires of every question here.
   *Done when all three are answered, or the person has said they cannot answer
   one — which is a `> GAP:` in the record, not a blank.*

3. **Write the record** to `feedback/YYYY-MM-DD-<slug>.md`, from
   [the template](../../../feedback/TEMPLATE.md). Keep the person's own words
   for the observation and the cost. A paraphrase that improves their sentence
   loses the detail that made it worth recording, and it quietly turns their
   report into your summary of it.
   *Done when the file exists and the observation reads like the person, not
   like this repository's documentation.*

4. **Run `pnpm check:feedback`.** It reads the name, the required sections, the
   locator under `Where` and the three states under `What would fix it`.
   *Done when it exits 0 and its scope line names the record you just wrote.*

5. **Commit it on a branch of its own, then close it like any task.** `git
   checkout -b feedback/<slug> main`, then assert the branch in the same command
   as the commit per CLAUDE.md — `test "$(git branch --show-current)" =
   feedback/<slug> && git add feedback/<file> && git commit …` — adding nothing
   else. Then the close in CLAUDE.md's "Closing a task": merge into `main`,
   delete the branch, `pnpm gate`, and push `main` on the person's yes. `main`
   is the only branch pushed here ([GUIDE.md](../../../GUIDE.md), section 13).

   **The push is the step, not the commit.** A record committed to a local
   branch dies on one machine exactly as thoroughly as one never written, and
   for four days this skill said to commit and stopped there. A record touching
   only `feedback/` owes no brief, but its push is still a publish, so it waits
   for the person's yes.
   *Done when `git log -1 --name-only` on the branch showed the record and
   nothing beside it, and the push to `main` printed — or the person said no
   and knows the record has not left this machine.*

6. **Report where it landed, and say what you did not do.** Give the path and
   whether `main` was pushed. The friction is recorded and it is not repaired —
   nobody has agreed to repair it, and if the person wants it fixed now that is
   a separate task through the intake gate.

   **Say who will see it, honestly.** Nothing notifies anybody: no issue is
   opened and no message is sent. The record reaches whoever next reads
   `feedback/` on `main`, so if somebody should hear about it now, the person
   tells them.
   *Done when the person knows the path, whether it was pushed, that recording
   is all that happened, and that telling somebody is theirs to do.*

## Rules

**One record per piece of friction.** Two problems in one file means the second
one is invisible to anybody scanning filenames, and it cannot be closed
separately from the first.

**A record has no state.** Testimony does not change once
written, so nothing in `feedback/` says whether a friction was ever dealt with,
and `pnpm check:feedback` cannot tell a `> GAP:` somebody answered from one still
open. **Repair something a record describes, then cite the record in the
repair's brief, naming what stayed open and where it now lives.** That citation
is the only place here a reader can tell an attended friction from an ignored one.

**This workspace, not the product being designed.** The subject is the skills,
the documents, the setup, the branch rules, the agent's own behaviour. Feedback
about Marketing Center belongs in that product's context or its tracker.

**Small friction counts, and it is the kind most often lost.** Four minutes of
confusion nobody reports costs the next person four minutes as well. The bar for
writing a record is that somebody was slowed down, not that something broke.

**Do not soften it.** "The instructions were unclear" is the version that
survives three retellings and helps nobody. What the person actually said —
which sentence, what they thought it meant, what they did instead — is the whole
value.

**Write it in English**, per the language rule in CLAUDE.md, even when the
conversation is in another one. If the person's words matter and they were not
in English, quote them as they were said and put the translation beside them.

**Praise is welcome and it is not what this directory is for.** A record whose
cost section says "nothing, this worked" passes the check and tells the next
reader nothing. Pass a compliment to the person who built the thing instead.

## What the check cannot see

It cannot tell whether the friction is real, and it cannot tell whether the name
on the record is the person who hit it. Both are yours. Every rule in `Steps`
above is there because no regular expression covers it.
