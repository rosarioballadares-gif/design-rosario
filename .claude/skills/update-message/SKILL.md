---
name: update-message
description: Finished work has to reach people - a library shipped, a component moved, a convention changed. Channel or direct.
---

# Announcing a change

An update message asks people to do something differently. That is what makes it
different from a brief, from a status table and from a ticket, all of which
record. This one has to move somebody.

## Before any of it: prove the thing is reachable

**An announcement tells people to go somewhere. Check that they can get there,
first, from the thing itself and not from your memory of it.**

Measured 2026-09-02: two drafts of these exact messages said *use these
components*, and the components were on an unmerged design-tool branch — reachable
from nobody's file but the author's. What settled it was one read of
the file key against the published library, which returned the parent key and
all ten families. The branch had been merged in the meantime and neither the
author nor the agent knew.

So the check is cheap and it is not optional. Open the library, hit the URL, run
the query. **The failure it prevents is the worst one an announcement has**: a
room full of people trying something that does not work, on your word.

## Plain text, no formatting syntax

**Write it with no markdown, no asterisks, no backticks.** These messages are
copied out of a terminal or a document and pasted into Slack, and `**bold**`
pastes as literally `**bold**`. Slack's own `*single asterisk*` is no better,
because it is wrong everywhere else.

Structure with line breaks, a bare heading line, and `•` for bullets. If a word
needs emphasis, put it at the start of its sentence instead.

> SOURCE: Ian Rueff, 2026-09-02 — three iterations, ending in "escribilo normal
> porq al copiar y pegar queda mal".

**Emoji are the exception, and they earn it as section markers.** A channel post
gets scanned rather than read, and a bare heading line does less work there than
one carrying a mark. The chart library release used eleven and reads well.

This is a decision and not a default, because it sits next to
[the voice guide](../../../docs/foundation/voice-content-guide.md), which lists
emoji first under `Never`. The two do not actually conflict — that guide scopes
itself in its opening paragraph to any **screen** built in this workspace, and a
Slack post is not a screen. What was missing is that nobody had said so, and two
announcements written here a day apart carried eleven emoji and none.

> SOURCE: Ian Rueff, 2026-09-09, asked directly after the disagreement was
> recorded as [feedback](../feedback/SKILL.md) in a previous client's
> repository.

## Short

Cut it, then cut it again. The first draft of the two messages below ran about
twice this length and was shortened twice on request. A release note that gets
skimmed to the end beats a complete one that gets abandoned in the middle.

## The two shapes

The facts are the same. What changes is what the reader needs from them.

### To a channel — release notes

Somebody scanning. Give them the shape of a version announcement, because that
is a form people already know how to read:

```
<Thing> — <what is new>, live now

Coverage / scale, in one line. The link.

New
• grouped, four or five lines at most

Improvements
• what they can stop doing by hand

Known limits
• and whose limits they are

One behavioural ask, with the reason.

Where questions go. The ticket.
```

**Name the limits and say whose they are.** *Scatter caps at 4 series — the
renderer clamps there* stops somebody promising a stakeholder a fifth. A list of
features cannot do that, and a list of features is what an announcement drifts
into when nobody decides otherwise.

**Close with a behavioural ask and the reason behind it.** *Please instance
rather than draw* is a rule. *A hand-drawn chart throws no error and looks fine,
which is why nothing stops it, and why it hands engineering a picture instead of
a spec* is why anybody would follow it.

### To one person — the thing only they care about

**The announcement is the frame. It is not the payload.** A named person reads
because something in it is about their work.

For the message to James Hills, whose code library everything was built from,
the payload was two defects in that code with the measurements attached:

- a literal `'#FFFFFF'` scoring 3.14 / 3.15 / 3.57 / 3.20 against the four series
  hues where black scores 6.70 / 6.66 / 5.89 / 6.57;
- two chart paths indexing the same palette differently, one with a modulo and
  one relying on a clamp.

Neither belongs in a channel post. Both are the reason he opens the message.

**Show that you understand their constraint before proposing anything.** *I know
a canvas can't read a CSS custom property, so it's not a one-line swap* is the
difference between a finding and a complaint.

**End with a concrete next step and a question**, not with "let me know". The
question is what turns a notification into a conversation.

## What goes in every one

- The link, on its own line.
- The ticket key, once, at the end.
- What changed, in numbers where numbers exist. *9 → 16 of 18* carries more than
  *significantly expanded*.
- Where questions go.

## What never goes in

- A restatement of the brief. Link it if it is readable by the audience; most
  briefs are not.
- Anything not yet true. Future tense in an announcement is a roadmap, and a
  roadmap in a release note is how people end up waiting for something nobody
  committed to.
- An apology for the length. Shorten it instead.
