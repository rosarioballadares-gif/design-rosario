# Brief: <what this is, in a few words>

Copy this file to `briefs/YYYY-MM-DD-<slug>.md` and fill it in. `pnpm check:briefs`
reads every file here and refuses one whose sections carry prose with nothing
behind it.

**Three ways to answer, and no fourth.** Every section needs one of them —
including `Differentiator`, which asks what the work descends from and where a
stated gap is sometimes the honest answer:

```
[a link](../src/Root.tsx) or `src/Root.tsx` or https://example.com
> SOURCE: Dana Ruiz, 2026-08-13
> GAP: nobody has decided which plans see this
```

A citation points at something readable. A `SOURCE:` names the person who told
you and when, because in this workspace the usual origin of a product fact is
that somebody said it, and a conversation has no URL — without a form for that,
the honest writer either downgrades a real fact to a gap or invents a link, and
the invented link is the one that survives review. A `GAP:` says you do not
know, which is a complete answer and needs nothing else.

What the check cannot do is tell a filled field from a plausible sentence. A
confident paragraph about a screen nobody opened passes. What it does is make
the unsupported parts visible instead of letting them read like the rest.

**Every field also has a byte budget**, and `pnpm check:briefs` prints the
tables it holds — the caps that apply from 2026-09-11, the lower ones from
2026-09-15, and the four raised from 2026-10-09. Read them from the run rather than from here; there is no third copy.
A brief is written into the conversation and then carried in every later call of
the session, so length is paid twice and the second time repeatedly. Over budget
is not wrong — it is unedited.

**A brief is held to the table its DATE picks, and the caps were never lowered
in place.** Measured 2026-09-14 over 64 enforced briefs, the maxima sat against
the old ceiling — `Tasks` at 900 of 900 — so lowering in place would have failed
files whose decisions nobody is re-taking.

### How the checker reads this file

`pnpm check:briefs` looks for `## <field>` and **tolerates decoration after it** —
`## Scope (in and out)` is fine — but the field name itself has to match. A
heading it does not recognize has its body checked as an extra section rather
than as that field, so the field reads as missing while the prose sits there
looking answered.

That is not hypothetical. The block in `CLAUDE.md` used to print
`Context & Rules`, which the checker does not match, so a brief written from it
lost that entire section without saying so while its author looked at a heading
that seemed right.

**One phrase resolves to a field**: `Differentiation` to `Differentiator`. It
matches none of the checker's prefix rules and it is a phrase somebody writes.

**Briefs dated before 2026-08-20 are not asked for the one upstream
field**, and `check:briefs` prints `7/8 fields` beside each one rather than an
unqualified `ok`. Requiring them retroactively would fail files whose
decisions nobody is re-taking, and the only repair available would be pasting
`> GAP:` into each — which turns a marker meaning *somebody looked and did not
know* into background noise. The cutoff is `UPSTREAM_REQUIRED_FROM` in
[`brief-fields.mjs`](../scripts/brief-fields.mjs), beside the two budget tables
and the date that picks between them.

**A filename with no leading `YYYY-MM-DD-` gets the strict set** — every field,
and the lowest caps — because the lenient default fails open: name a file
`draft.md` and the upstream field goes unasked while the run reports green over
a brief it decided not to inspect.

## Objective

What this achieves, in one sentence. Not the solution — the thing that is
different afterwards.

## Differentiator

What makes this version different from the alternative the person already has —
including the alternative of doing nothing, which is the one they are using
today and the one most often left uncounted.

## Context and rules

The verified current state, the constraints, and what must not change. This is
the section where invented facts do the most damage, because approval of the
brief becomes approval of everything asserted here.

**Cite the query. Never paste its answer.** If a tool can answer it — an MCP
server for a component's props, `pnpm check:env` for what this machine reaches,
a spec file for what is pinned — name the tool and the question, not the output. A
transcribed answer is a second copy of a fact with nothing keeping the two in
agreement, and it is stale the day the tool's answer changes.

Product facts belong here close to verbatim. If you were told something,
attribute it. If you assumed it, that is a gap.

It is the biggest field in most corpora, and the repair is usually that it
transcribes an answer a tool already serves.

## Dependencies

What has to exist or be decided first. Name who owns anything you are waiting
on, since a dependency with no owner is a wish.

## Scope

What is included, and — the half that gets skipped — what is explicitly
excluded. An unstated exclusion is read as an oversight later.

## Tasks

Concrete, ordered steps. Ordered because the order is usually a real
constraint, and writing it down is where a hidden dependency surfaces.

## Autonomy

Checkpoints or autopilot, and nothing else. If autopilot, the pre-authorizations,
listed — in a queue, the merge into local `main` among them — and the path of
the run's registry. Autopilot's own contract is in
[autopilot.md](../docs/foundation/autopilot.md).

**Plus the RUNG this task reaches and the effort it prescribes.**
`check:briefs` prints all five rungs with their efforts and fails a pair that
contradicts the ladder, so read them off the run — **do not paste the ladder's
link in here.** Measured 2026-09-14: 40 of 66 briefs did, at 24 per cent of the
field, and a link is navigation rather than an answer. Note what that costs:
40 of those 66 used the link as the section's CITATION, so this field now
usually closes with a `> SOURCE:` naming who chose the rung and when — about
the same bytes, carrying who decided instead of where the ladder lives.

**Name the row you did NOT take, and why** — *"Not `decision`: the cutoff is
reversible"*. This is the half that is actually worth the bytes. Nothing can
check whether a rung is the RIGHT one, so naming `default` for an audit passes;
the rejected neighbour is the only evidence that two rows were weighed. Measured
2026-09-14: 3 per cent of briefs do it.

**Fan-out only when there is one.** Half the corpus writes "no fan-out", which
is the default on every row but `census`.

## Validation

How this gets proven. One line per check: **the command, and what its output has
to say.** Not "it works", and not the reasoning either — why a check is the right
check belongs beside the check, not here.

If the work touches a screen, name it here along with the states it has to be
seen in: empty, loading, error, partial, full. There is no longer a `Key screen`
field — it was cut on 2026-09-14 — so the screen and its states arrive together,
at the point where they have to be proven. A screen designed only in its full
state, with plausible data in every slot, has not been designed. It has been
illustrated.

What overruns this field is almost always the reasoning; move that to `docs/` or
a PDR and cite it in one line.
