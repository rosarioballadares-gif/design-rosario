# docs — where the written knowledge lives

Read this before adding a document. It says which house a thing belongs in, and
it names the houses that are empty on purpose.

Two things are deliberately **not** here, and looking for them in this tree is
the first way to get lost:

- **Product facts are typed, not written.** Personas, tiers, features, roles,
  navigation and KPIs belong in `src/` as TypeScript, because that is the
  source the application reads and the specs check. A markdown file here never
  restates one of those facts, since a second copy has nothing keeping the two
  in agreement.
- **The standing rules are at the root.** [`CLAUDE.md`](../CLAUDE.md) is how the
  agent works, [`backlog/`](../backlog/README.md) is what is missing on purpose,
  and [`README.md`](../README.md) is how to run the thing.

## The filing rule

**A document belongs to the product it is about, and it goes inside that
product's house.** Its research, its patterns and its specs go inside the same
house, not into a shared pile — a study is evidence about one product, and a
pile that mixes products loses which one it was about.

```
docs/
├─ README.md          ← you are here: the map
├─ decisions/         ← PDRs: what was decided, and what it cost
├─ foundation/        ← shared across every product: the checks, the method
└─ product/
   └─ <ProductId>/    ← one house per product, keyed as the code keys it
      ├─ research/
      ├─ patterns/
      └─ specs/
```

`<ProductId>` is not a nickname. It is the literal key the code uses, so the
folder name and the typed model always name the same product.

## The houses

| House | What it holds |
| --- | --- |
| [`decisions/`](decisions/README.md) | The decision log. What was chosen, why, and what it costs |
| [`foundation/`](foundation/) | What belongs to no single product. [The checks and what each one paid for](foundation/checks.md), [the autopilot contract](foundation/autopilot.md) and [its review panel](foundation/review-panel.md), [the voice and content guide](foundation/voice-content-guide.md), [how sessions on one machine coordinate](foundation/peers.md), and the client's facts — [the wiring](foundation/workspace-wiring.md) and [the people](foundation/people.md) |
| `product/` | One house per product, created by the first research or pattern written for it. Empty in the base |

## What lives outside this tree, and why

Three directories sit at the repository root rather than under `docs/`. None is
an oversight.

| Where | Why it is not in `docs/` |
| --- | --- |
| [`briefs/`](../briefs/) | The approved execution prompt for every task. `scripts/check-briefs.mjs`, `package.json`, the CI workflow and `CLAUDE.md` all name this path. It is a gated artefact, not a document |
| [`feedback/`](../feedback/) | Records of this workspace costing somebody time. Each names a person, a place and a cost, and `pnpm check:feedback` holds them to that |
| [`backlog/`](../backlog/README.md) | What is missing on purpose, one file per area, each item carrying a state and an owner |

## The gaps, stated

Better to name these than to let the empty folders read as complete.

- **No product is modelled in `src/` yet.** The first product house is named
  when `/setup` records the client, after the key the code will use.
- **Most of the method is not in `foundation/`.** Everything else the method knows is
  still inside the scripts that implement it, printed when each one runs.
- **This map is maintained by hand.** Nothing fails when a house is added and
  this file is not updated. If the tree and this table disagree, the tree is
  right and this file is stale.
