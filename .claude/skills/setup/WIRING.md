# WIRING — what a machine needs before this workspace works

Read by [`SKILL.md`](SKILL.md) and named by `pnpm check:env`, which reports what
it could reach and what it could not. This file is the chain in order; the check
is the instrument. **Neither can see whether a thing is the RIGHT thing** — only
that it answered.

## 1 · Node and pnpm

```sh
node --version     # 22 or later
corepack enable    # pnpm arrives through corepack, at the version package.json pins
pnpm install
```

`packageManager` in `package.json` pins the exact pnpm version. Corepack fetches
that one, so every machine and every CI job resolve the same tree. Installing
pnpm globally instead is how two machines end up eleven minor versions apart
with nothing saying so.

## 2 · Bypass permissions in Claude Code

Claude Code otherwise asks before every file it touches, which on a session of
this shape is a prompt every few seconds.
[`.claude/settings.json`](../../settings.json) is the guardrail that survives
it: it holds the model and effort floor, the hooks, and which skills are listed.
**Bypassing the per-action prompt does not bypass that file**, and the hooks it
wires — `git-guard` in particular — still refuse what they refuse.

## 3 · The private registry, if there is one

Nothing here installs from a private scope today, and `pnpm check:env` reports
`private registry — not read` rather than a failure. When one arrives:

- The scope mapping goes in the repository's own `.npmrc`, which is committed:
  `@scope:registry=https://<host>`
- **The token goes in your USER `.npmrc` and never in that one.** pnpm reads a
  token from either, and the repository's file is tracked by git — so the
  natural fix for a 401, pasting the token where the scope mapping already is,
  publishes the credential to everyone with the repo. It fails nothing and it
  renders nothing. Only `pnpm check:env` finds it, which is the one row in that
  report about a problem somebody created while fixing another one.
- CI needs the same token as a repository secret. A token that is set but not
  authorized for the organization answers **403** where a missing one answers
  **401** — two states that read identically as "it is broken" to somebody who
  has seen neither. `check:env` tells them apart and names which step you are
  missing.

## 4 · MCP servers

**No `.mcp.json` is tracked here.** One would be paid for by everyone who
clones — a server added there costs every call of every session, the same kind
of edit as a section added to `CLAUDE.md` — and it would carry a server one
person added to everybody. `pnpm check:floor --mcp` measures what a declared
one costs, should the team ever decide on one.

A server wired into a person's own client is a different thing: real cost, not
versioned here, and outside what any check can hold anybody to.

**Prove a server rather than recording a claim.** Call something on it that
names the account — most design and tracker servers publish a `whoami` or an
equivalent — and write down *which* server answered, not that one did. More than
one server can answer to the same name, and the wrong one returns plausible
answers about a workspace nobody here can reach.

**User scope, always** (`-s user`): the server reaches this person in every
project and is never written into a project `.mcp.json`. Each remote server
below signs in through the browser the first time; `/mcp` in a Claude Code
session runs that flow.

### What each intake answer wires

The client layer ([CLIENT.md](CLIENT.md)) turns each answer into the row below,
and the row's command into a task of the client's spec.

| Answer | Tool | Command |
| --- | --- | --- |
| design tool: Figma | Figma's plugin, which carries its MCP server and its skills | `claude plugin install figma@claude-plugins-official`, or the server alone: `claude mcp add -s user --transport http figma https://mcp.figma.com/mcp` |
| tracker or docs: Jira, Confluence | Atlassian's remote MCP server | `claude mcp add -s user --transport http atlassian https://mcp.atlassian.com/v1/mcp/authv2` |
| tracker: Linear | Linear's remote MCP server | `claude mcp add -s user --transport http linear https://mcp.linear.app/mcp` |
| docs: Notion | Notion's remote MCP server | `claude mcp add -s user --transport http notion https://mcp.notion.com/mcp` |
| docs: Google Drive | the Google Drive connector | turned on in claude.ai, Settings, Connectors; nothing to run here |
| channel: Slack | Slack's plugin, or its remote MCP server | `claude plugin install slack@claude-plugins-official`, or `claude mcp add -s user --transport http slack https://mcp.slack.com/mcp` |
| code: the client's own repository | the GitHub CLI | `gh auth login`, then `gh repo clone <owner>/<repo>` beside this checkout |
| inspiration: Mobbin | the Mobbin connector | turned on in claude.ai, Settings, Connectors |
| editor: VS Code | the Claude Code extension | `code --install-extension anthropic.claude-code` |

> SOURCE: each vendor's own setup page, read 2026-10-08 —
> https://developers.figma.com/docs/figma-mcp-server/remote-server-installation,
> https://linear.app/docs/mcp, https://developers.notion.com/docs/get-started-with-mcp,
> https://docs.slack.dev/ai/slack-mcp-server/connect-to-harnesses. The Atlassian
> URL came from a directory listing, not Atlassian's own page: prove it with a
> call that names the account before recording it.

An answer with no row — Teams, email, another tracker — is a task in the spec
that says so, and a `> GAP:` in workspace-wiring until somebody finds its tool.

## 5 · A browser

`pnpm check:env` resolves a Chromium and prints the path it found. Anything that
reads a rendered page needs one, and a check that could not run is not a check
that passed — so a machine with no browser fails `pnpm gate` rather than quietly
measuring fewer things.

## 6 · A sound when the agent stops, if you want one

Optional, and yours rather than the repository's: it goes in your USER
settings, `~/.claude/settings.json`, beside whatever is there. A sound when a
turn ends (`Stop`) and when the agent waits on you (`Notification`) is what
lets you look away from a long task. This is the block Ian Rueff runs, on
Windows:

```json
"hooks": {
  "Stop": [{"hooks": [{"type": "command", "command": "powershell -NoProfile -Command (New-Object Media.SoundPlayer 'C:\\Windows\\Media\\Windows Notify.wav').PlaySync()"}]}],
  "Notification": [{"hooks": [{"type": "command", "command": "powershell -NoProfile -Command (New-Object Media.SoundPlayer 'C:\\Windows\\Media\\chimes.wav').PlaySync()"}]}]
}
```

On a Mac the command is `afplay /System/Library/Sounds/Glass.aiff`.
