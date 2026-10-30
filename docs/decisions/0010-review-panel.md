---
id: PDR-0010
date: 2026-10-07
status: accepted
---

# PDR-0010 — An autopilot run's end is judged by three read-only lenses at once, and a CHANGES gets at most two fix commits

## Context

[PDR-0007](0007-verify-at-the-end.md) put the checks at the end of a task,
over its whole diff, with what they find going into one fix commit. On its
measured run, 2026-09-29, two read-only agents ran them in parallel. Nothing
fixed that shape:

- diff-review and voice-audit report in prose, so the
  [autopilot](../foundation/autopilot.md) director reads every finding whole to
  know whether the run may stop.
- Nothing says what happens when the fix commit's own diff needs a second look,
  or how many times.

zazencodes' software factory runs four reviewers at once, each writing a file
whose first line is its verdict, and resumes its builder at most twice.

> SOURCE: [PDR-0007](0007-verify-at-the-end.md) § Rationale; https://github.com/zazencodes/zazencodes-season-3/tree/main/src/software-factory-claude-code,
> read 2026-10-07; Ian Rueff, 2026-10-07: «el resto vamos con lo q recomendas»,
> taking the panel and the bounded loop from it.

## Decision

The contract is [the review panel](../foundation/review-panel.md); this is what
it closes off.

1. **An autopilot run's end is three lenses — code, copy, ui — launched
   together.** Each is read-only and writes one file beside the registry.
2. **Each file opens `VERDICT: PASS` or `VERDICT: CHANGES`**, so the director
   reads one line per lens.
3. **A CHANGES goes to one fresh fix worker, at most twice.** Every round runs
   all three lenses. What is still CHANGES after round 3 waits in the registry
   as a question.
4. **The lenses inherit the director's model**, and each is a section of a
   document handed to a general-purpose agent, not a file in `.claude/agents/`.

## Rationale

- **Read-only is what makes parallel safe.** [PDR-0006](0006-continuous-autopilot.md)
  runs one worker at a time because two writers collide; a lens writes only its
  own file.
- **The bound turns an open loop into a question.** A third disagreement
  between a lens and a fixer is a call for the person, not a fourth round.
- **Ruled out: Sonnet lenses.** diff-review judges against a stipulated
  definition, which is where Sonnet's false findings came from in
  [model-and-effort](../../.claude/skills/model-and-effort/SKILL.md) § Do not
  hand it.
- **Ruled out: `.claude/agents/` files**, the factory's form. An agent's
  description is paid on every call of every session, and `pnpm check:floor`
  does not read that directory.
- **Ruled out: the factory's security and ux lenses, its approver and its
  parallel jobs.** Ian kept the recommendation that left them out; parallel
  jobs collide in `component.json`, as the components run learned (PDR-0006).

## Consequences

- **PDR-0006's one worker at a time has a read-only exception**, the lenses.
- **PDR-0007's one fix commit becomes up to two** in an autopilot run.
- **A run's end costs up to nine lens agents and two fixers.** The ui lens is
  the slowest, with its own dev server and captures. The dry run's two rounds
  and one fix took about 500k subagent tokens and 8 minutes of wall clock, the
  ui lens 4 of them in round 1.
- **The review files are versioned** with the registry, one folder per round.

> SOURCE: the dry run, 2026-10-07, on a throwaway branch with five planted
> defects in `SupportChat.tsx`: round 1, three CHANGES with ten findings
> covering all five; one fix commit; round 2, three PASS, each naming its
> earlier findings fixed.
>
> GAP: whether three lenses is the right set is proven on real runs; the dry
> run proves the loop, not the set.

## Related

- Brief: 2026-10-07-review-panel, in a previous client's repository.
- It amends [PDR-0006](0006-continuous-autopilot.md) and
  [PDR-0007](0007-verify-at-the-end.md) for autopilot runs only.
- Carried in [the review panel](../foundation/review-panel.md) and
  [autopilot.md](../foundation/autopilot.md).
