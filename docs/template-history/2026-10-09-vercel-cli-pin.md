# Brief: the deploy accepts a project-scoped Vercel token

## Objective

A copy can deploy with a Vercel token scoped to its project, not only to its
team, and the README says which scopes the pinned CLI accepts.

> SOURCE: Ian Rueff, 2026-10-09, question UI — "Ambas cosas"

## Differentiator

Today a project-scoped token, the narrower credential, fails the `deploy` job
with `Could not retrieve Project Settings` on CLI 54.14.5, and the README's GAP
never says to pick the team scope, so a copy learns it from a red run, as this
repository did.

> SOURCE: the agent, 2026-10-09 — `gh api repos/studiohakuna/product-ops-base/actions/jobs/113826797840/logs`

## Context and rules

- [ci.yml](../.github/workflows/ci.yml) pins `vercel@54.14.5`; its comment says
  a range drifts silently, so the new pin stays exact.
- Project-only tokens reached `vercel deploy` in vercel/vercel PR 16999, merged
  after 56.3.0 was published: 56.3.1 is the first release with it.
- Both versions declare `node >= 18`; the job runs 22.
- `VERCEL_TOKEN` is team-scoped, replaced at 12:57 after the project one failed.

> SOURCE: the agent, 2026-10-09 — https://github.com/vercel/vercel/pull/16999;
> `npm view vercel time`, `npm view vercel@56.3.1 engines`; `gh secret list`

## Dependencies

A project-scoped token on `product-ops-base`, which Ian creates and stores as
`VERCEL_TOKEN`: a credential, so the agent prints the command and never holds
it. It stays as production's token, being narrower than the team one.

> SOURCE: the agent, 2026-10-09

## Scope

In: the pin moves to 56.3.1 and its comment says why; the README's "no deploy
in a copy" GAP says the pinned CLI takes a team or project token, and that
below 56.3.1 a project one fails with that error.

Out: `latest` (63.1.0), seven majors nobody asked for; the local CLI for
`vercel link`; previews; any other job.

> SOURCE: Ian Rueff, 2026-10-09, question UI — "Ambas cosas", then Go; the
> version, the agent

## Tasks

1. `ci.yml`: `vercel@56.3.1`, its comment naming PR 16999.
2. README GAP: which token scopes the pinned CLI accepts.
3. End checks, merge, gate, push on Ian's confirmation; that run deploys on
   56.3.1 with the team token.
4. Ian stores a project-scoped `VERCEL_TOKEN`; the deploy job is rerun.

> SOURCE: the agent, 2026-10-09

## Autonomy

Checkpoints, rung `default`, effort `high`. Not `repair`: one of the two files
is the CLI that every production deploy goes through, and a wrong pin stops
them all. Stops for Ian before the push and at the token.

> SOURCE: the agent, 2026-10-09

## Validation

- `pnpm gate` after the merge: every check passed.
- The push's run: `check` and `deploy` green on `vercel@56.3.1`;
  `vercel ls product-ops-base` lists a newer production deployment.
- After the project token, `gh run rerun --job`: `deploy` green, no
  `Could not retrieve Project Settings` in its log.
- `curl` on https://product-ops-base.vercel.app: 200.

> SOURCE: the agent, 2026-10-09
