# Brief: no Claude attribution on commits and PRs

## Objective

Commits and PRs made with Claude Code in this repo carry no Claude attribution
from now on: no Co-Authored-By trailer, no PR footer, no session link.

> SOURCE: Ian Rueff, 2026-10-30, question UI: "Go + worktree (Recommended)"

## Differentiator

Claude Code's default appends a "Co-Authored-By: Claude" trailer and a PR
footer. The template is used on client repos, so every copy must inherit the
setting: a checked-in setting travels with each copy, a user-level one would not.

> SOURCE: Ian Rueff, 2026-10-30

## Context and rules

No `attribution` key existed before (grep of .claude/settings.json, 2026-10-30).
Empty `commit` and `pr` strings hide the trailer and the footer; `sessionUrl`
false drops the session link. `includeCoAuthoredBy` is deprecated, so unused.
History is not rewritten.

https://code.claude.com/docs/en/settings-reference

## Dependencies

None open.

> SOURCE: Ian Rueff, 2026-10-30

## Scope

In: the `attribution` key in `.claude/settings.json`, plus any hard-coded
trailer found in a script. Out: a history rewrite, user-level settings, and
AI-disclosure under a client contract.

> GAP: whether a client contract requires AI disclosure; owner Cami

## Tasks

1. Add `"attribution": { "commit": "", "pr": "", "sessionUrl": false }` to
   `.claude/settings.json`.
2. Grep scripts and docs for a hard-coded trailer or footer; none found.
3. Validate, then commit on `feat/no-claude-attribution`.

## Autonomy

Checkpoints. Rung `census`, effort low: one cheaper subagent does the edit.
Not autopilot: the push is a publish that Ian confirms.

> SOURCE: Ian Rueff, 2026-10-30

## Validation

- `node -e "console.log(JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')).attribution)"`
  prints the object.
- `pnpm check:briefs` and `pnpm lint`: exit 0.
- The setting itself is proven by a new session's first commit.

> SOURCE: Ian Rueff, 2026-10-30
