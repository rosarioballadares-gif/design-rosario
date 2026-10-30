# The review panel

How an [autopilot](autopilot.md) run's end is judged: three read-only lenses at
once, each writing one file that opens on its verdict, and a fix loop with a
bound. Why this shape is [PDR-0010](../decisions/0010-review-panel.md); what the
end has to cover is [PDR-0007](../decisions/0007-verify-at-the-end.md).

A plain `Go` task does not use it. Its end stays in its own session.

## When it runs

After the run's last step is committed and before the afters. The afters are
taken once the panel is all PASS, so they measure the final code.

## The lenses

Each lens is a general-purpose subagent that inherits the director's model. It
reads its own section below, runs what that section names, and writes exactly
one file. It never edits anything else and never commits.

### code

- `pnpm lint` and `pnpm test:run`. A warning the base did not have, a failing
  spec, or a spec-file count lower than the base's is CHANGES.
- [diff-review](../../.claude/skills/diff-review/SKILL.md) over
  `git diff <base>...HEAD`, against the brief. A line that traces to no sentence
  of it, or an orphan the change created, is CHANGES. Pre-existing dead code is
  a Note.

### copy

- `pnpm check:copy`. Any finding is CHANGES.
- [voice-audit](../../.claude/skills/voice-audit/SKILL.md) over the copy the
  diff adds. A hard finding is CHANGES; a tone finding is a Note, because tone
  is the person's call.
- A diff that adds no copy is PASS, and says so.

### ui

- An import of a vendor package outside `src/ds/` is CHANGES.
- A raw colour, size or space where a token of the set exists is CHANGES.
- A margin on a child of a container with a `gap` is CHANGES (CLAUDE.md §
  Spacing).
- Each route the diff changes, captured with `scripts/shot.mjs` at phone and
  desktop width, on a dev server this lens starts on the port its prompt names.
  Overflow, a clipped label or a broken layout is CHANGES.
- [contrast-audit](../../.claude/skills/contrast-audit/SKILL.md) when the diff
  moves a colour.
- A diff with no visible change is PASS, and says so.

## The prompt

The director launches all three in one message, each with:

```
Lens: <code|copy|ui>, docs/foundation/review-panel.md § <lens>.
Worktree: <absolute path>. Brief: <path>. Base: <sha>. Round: <N>.
Write: <absolute path of the file>. Port: <free port, ui only>.
```

`Base` is the commit the run's branch was born from, not `origin/main`: in a
queue, local `main` already carries the earlier tasks. The port is one nothing
listens on, never 5173 or 6006.

## The file

`<registry without .md>/round-<N>/review-<lens>.md`, beside the registry and
committed with it by the director.

```markdown
VERDICT: PASS | CHANGES

## Findings
1. `path:line` — what breaks which rule, and the fix.

## Notes
Non-blocking. Optional.
```

- The first line is exactly `VERDICT: PASS` or `VERDICT: CHANGES`.
- CHANGES only for a finding that breaks a written rule: CLAUDE.md, a skill,
  the brief. Taste goes under Notes.
- Under Findings, `None.` when there are none.
- From round 2, the lens reads its own previous file and says, per finding,
  fixed or still there.

## The loop

1. **Wait for all three files.** The director reads each first line only and
   writes the verdicts into the registry. A lens that returns without its file,
   or without a verdict on the first line, is launched once more; a second miss
   waits in the registry as a question.
2. **All PASS:** the afters, then the final stop.
3. **Any CHANGES, with rounds left:** one fresh worker addresses every CHANGES
   finding in one fix commit, `pnpm build` green. It may refute a finding
   instead, with its reason in the registry; the next round's lens reads it and
   drops or keeps the finding. Then the next round runs **all three lenses
   again**, because a fix can break what passed.
4. **Any CHANGES after round 3:** no third fix. The outstanding findings wait
   in the registry as a question, with their files, and the final stop reports
   them.
