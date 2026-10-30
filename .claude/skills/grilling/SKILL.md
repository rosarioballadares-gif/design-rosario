---
name: grilling
description: Stress-test a plan, decision or idea. Fires on any 'grill' phrase, or when somebody wants their thinking attacked.
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled — the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round: number each question and give your recommended answer. Then wait for the user's answers before the next round.

Each question should be formatted like so:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Each round the user answers reshapes the tree — settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent to find it — don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report — ask the rest of the frontier now. The _decisions_ are the user's — put each to them and wait.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.

## In this repo

A grilling session here has a destination: the **execution prompt** in
[CLAUDE.md](../../../CLAUDE.md), and the brief it becomes under
[`briefs/`](../../../briefs/). The frontier is empty when all seven of its
fields can be filled with a citation, a `> SOURCE: who, when`, or a
`> GAP: what nobody knows`. Those three are the only endings a question has —
a reasonable assumption is an open question wearing the costume of a fact, and
it is the state this workspace is built to make visible.

That is the same rule as the one about facts above, seen from the other end.
Anything reachable from the filesystem, from an MCP server, from the design
a screen you can run is yours to find, and asking the user for it spends a
round of the interview on something they would have to go and look up too.

This workspace also loads `superpowers:brainstorming`, which covers the same
ground in a different shape. Reach for grilling when the output is an execution
prompt somebody has to approve.

---

**Provenance.** From [`mattpocock/skills`](https://github.com/mattpocock/skills)
at commit `8b78b53` (2026-08-13), MIT © Matt Pocock. Changed here: this closing
section. The interview itself is verbatim.
