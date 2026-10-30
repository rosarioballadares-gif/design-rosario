---
name: diff-review
description: At a task's end, over its whole diff, and from a file's second pass on - where the review names what comes OUT.
---

# Reading your own diff

## First, the rule that is not obvious

**From the second pass on the same artefact, a review must return at least one
removal — or say, in words, that it looked for one and found none.**

Not a suggestion. The finding it exists to stop is measured, and it is not the
one people expect.

## What was measured, 2026-09-10

Across 3.765 `Edit` calls in 82 sessions of this repository:

| | | |
| --- | ---: | --- |
| edits that make the file **longer** | **90,5 %** | averaging **+731** characters |
| edits that make it shorter | 8,2 % | averaging −135 characters |
| net | | **+2,4 MB added by editing** |

An addition weighs **5,4 times** what a removal does. And the round number
changes nothing: the first pass over a file averages +680 characters and the
twelfth averages +609. **There is no round at which the process starts taking
things out.**

Only **11 exact reverts** occurred in 5.451 edits, so this is not a loop of
undoing itself. It is monotonic accretion, and it is why `CLAUDE.md` reached
86 KB, `BACKLOG.md` reached 381 KB and a brief averages 9.343 bytes. None of
them was written that long. Each was **revised** that long.

**The cause is the question.** A review asked *"what is missing?"* can only be
answered by adding. Nothing in that loop is able to conclude *"this is now too
long"*, because that was never what it was asked.

## The pass

1. **Read the whole diff, `git diff origin/main...HEAD`.** Not the summary —
   the lines.
2. **Name, for each changed line, the sentence of the request it answers.** A
   line with no such sentence is scope you added. This is `CLAUDE.md`'s surgical
   rule, and it is worth doing literally rather than in spirit.
3. **Clean up the orphans your own change created** — an import, a variable, a
   helper your edit made unused. That is your mess, and leaving it is not
   restraint.
4. **Leave pre-existing dead code alone.** Say it is there. A deletion nobody
   asked for is indistinguishable from a mistake when the diff is read.
5. **From the second pass: name what comes out.** If the honest answer is
   nothing, write that sentence — *"looked for something to remove and found
   none"* — the same way a `> GAP:` is a complete answer. What is not acceptable
   is a second pass that simply did not consider it.

## The one deletion that is always licensed

A premises spec that fails — `card-content.spec.ts` and the ones like it — means
the override it guards has stopped being needed. **The correct repair is to
delete the rule, not to update the test.** That deletion has a failing test
behind it and a sentence in the request, which is what separates it from
noticing dead code while passing through.

## Where the pressure should NOT go

Do not shorten by compressing a rule until it loses the condition that fires it.
An audit of a 38 KB cut on 2026-09-10 found four rules that survived and stopped
working, because the trigger went and the statement stayed. **A rule that does
not say when it applies does not apply**, and that is a worse outcome than the
length it saved.

The things worth removing first, in order: narration of how something was
discovered, when the rule alone is what acts; a fact stated twice in one file; a
transcription of something a tool answers on demand; and a measurement whose
date is old enough that nobody would act on it.

## What this cannot see

Whether the diff is any good. It reads a change against the request that asked
for it, and against its own length. It does not run anything — that is what
`## Validation` in the brief is for, and a review that passes here still owes
evidence there.
