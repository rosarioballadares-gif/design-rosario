# Brief: the template deploys to Vercel, app and Storybook

## Objective

`main` publishes to Vercel as the app at `/` and Storybook at `/storybook/`,
and a red publish check stops the deploy before anything goes live.

> SOURCE: Ian Rueff, 2026-10-09, question UI — Vercel, the app and Storybook

## Differentiator

Today nothing publishes, and `PUBLISH` in `gate.mjs` lists checks no deploy
was seen running. The previous client's repository, which this was cut from, deploys in
3–5 s as an upload that runs no check, so its identical list was never true
either.

> SOURCE: the agent, 2026-10-09 — `vercel ls` on that client's project,
> [gate.mjs](../scripts/gate.mjs)

## Context and rules

- The repository stays in the `studiohakuna` org, and Vercel is the
  template's default: every clone carries `vercel.json`.
- Vercel has no `studiohakuna` team, so the project sits on Ian's Hobby scope
  `ianrueff-1995s-projects`, deployed with `vercel deploy --prod` from the
  pushed `main`. It builds remotely with `buildCommand`: the five checks, then
  both builds.
- `build:storybook` already writes `dist/storybook`, and routes are hashes.
- With the config in the repository, `gate.mjs` reads `PUBLISH` from it.

> SOURCE: Ian Rueff, 2026-10-09, question UI — "este repo debe vivir dentro de
> la org de studiohakuna y usar vercel como default"; the personal scope

> GAP: whether Hobby can connect a private org repository for deploy-on-push
> is unmeasured; the CLI path does not need it.

## Dependencies

Vercel CLI 54.14.5, logged in as `ianrueff-1995`; a `product-ops-base`
project on that scope, made by `vercel link`.

> SOURCE: the agent, 2026-10-09 — `vercel whoami`, `vercel teams ls`

## Scope

In: `vercel.json`; `.vercelignore`, so what `.gitignore` keeps out stays out
of the upload; `gate.mjs` reading `PUBLISH` from it; the GAPs in `gate.mjs`
and checks.md closed with the date and the command; the backlog entry
`landed`. Out: deploy-on-push through Git, a custom domain, deployment
protection — the production URL is public.

> SOURCE: Ian Rueff, 2026-10-09, question UI — Go + worktree

## Tasks

1. `vercel.json` and `.vercelignore`; `gate.mjs` reads `PUBLISH` from them.
2. `vercel link`; a preview deploy from the branch, then one with lint red on
   purpose to prove the build stops, reverted; the two GAPs closed.
3. End checks, merge, gate, push on Ian's confirmation; `vercel deploy --prod`
   from `main`; the backlog entry `landed`.

> SOURCE: the agent, 2026-10-09

## Autonomy

Checkpoints. Rung `default`, effort `high`: a config and a check with a real
diff, three Tasks. It stops for Ian before the push.

> SOURCE: the agent, 2026-10-09, the model-and-effort ladder

## Validation

- The preview's build log shows the five checks, then both builds; `/` and
  `/storybook/` answer 200.
- With lint red, the deploy fails at `lint` and publishes nothing.
- `pnpm gate` takes its list from `vercel.json` and still runs 12.
- After the push, production answers 200 on both URLs.

> SOURCE: the agent, 2026-10-09
