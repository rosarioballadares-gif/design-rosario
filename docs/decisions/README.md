# Decision log — PDRs

A **Product Decision Record** is one file for one decision: what was chosen,
why, and what it costs. It is written when the decision is taken, and it is not
rewritten afterwards — a decision that turns out wrong gets a **new** record
that supersedes it, so the reasoning that led there survives.

## Why this exists, and what it is not

Without a log, every decision taken in a workspace like this lives as prose
inside `CLAUDE.md`. That is why such a file only ever grows: a rule and the
argument for the rule end up as the same paragraph. In the repository this one
was harvested from, that file reached 81.799 bytes over 27 days of monotonic
growth before anybody looked. Splitting the two is what keeps the standing
rules short enough to be read on every call.

**It is not [`briefs/`](../../briefs/).** A brief is the approved plan for one
task: what will be built, in what order, and how it gets proven. A PDR is a
choice between options that closes off other options. Most tasks change nothing
anyone will argue about later — those get a brief and no record here.

**The prefix is `PDR-` and not something shorter.** A citation has to name one
document, in one repository, with no ambiguity. Two logs each opening at
`0001` make every low number ambiguous in any conversation that reads both, so
a workspace that shares a room with another log picks a distinct prefix and
writes cross-repository references out in full.

## Writing one

Copy [`TEMPLATE.md`](TEMPLATE.md) to `NNNN-<slug>.md`, next number, and fill it
in. Keep the front matter — `id`, `date`, `status` — because the status is what
makes a superseded record readable rather than misleading.

`status` is one of `accepted`, `superseded by PDR-NNNN`, `rejected`, or
`proposed`.

A **rejected** record is worth keeping: it stops the same idea being
re-proposed with the same reasoning.

**`proposed` bends the rule above**, since this log holds decisions that were
taken and a proposal is one that was not. It exists for the case the three
states cannot hold: the argument is finished and the decision is deliberately
deferred. Without a fourth state the only moves are to decide in a hurry or to
lose the analysis, and both are worse. **The cost is that a `proposed` nobody
closes becomes a decision nobody took, filed among decisions that were** — so
it should be rare, and a record sitting in it is a question owed an answer.

## The records

The numbers continue the log of a previous client's repository, where this
method was built. The records that were that client's product are not carried;
the four that founded its design system are copied anonymised, renumbered after
the highest record here, as worked examples of a design system's decisions.

- [PDR-0006](0006-continuous-autopilot.md) — Autopilot runs with nobody
  watching: the main session directs, one fresh subagent works each step, and a
  question waits instead of stopping the run.
- [PDR-0007](0007-verify-at-the-end.md) — A task builds each commit and
  verifies once, at its end, over the whole diff.
- [PDR-0010](0010-review-panel.md) — An autopilot run's end is judged by three
  read-only lenses at once, and a CHANGES gets at most two fix commits.
- [PDR-0011](0011-tokens-three-tiers.md) — Tokens are three tiers under one
  prefix, a screen binds to semantic, and every semantic token carries a usage
  rule.
- [PDR-0012](0012-headless-ark-ui.md) — Components are built on Ark UI, wrapped
  in `src/ds/` and styled only through the prefixed tokens.
- [PDR-0013](0013-primitive-and-featured.md) — `src/ds/` holds primitives only;
  a component tied to one product place is featured.
- [PDR-0014](0014-spacing-breakpoint-scale.md) — Layout spacing is per-band
  tokens, named as a reference system names them and valued as the product
  renders.
- [PDR-0015](0015-component-tier-optional.md) — The component token tier is
  optional, and enters only for multi-brand and cases like it.

This log opened on 2026-09-19 in that client's repository, and was carried here on 2026-10-08.

> SOURCE: Ian Rueff, 2026-09-19 — nothing was back-filled from the repositories
> this workspace was harvested from. Their records are about design systems and
> deploys this project does not have, and a copy would drift from its original
> with nothing keeping the two in agreement.

> SOURCE: Ian Rueff, 2026-10-09, question UI — the four records that founded
> that client's design system are copied in anonymised, so a copy of this
> template links to nothing of that client.
