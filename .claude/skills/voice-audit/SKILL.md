---
name: voice-audit
description: Copy is about to ship - screen text, component labels, design-file copy. The voice rules a regex cannot see.
---

# voice-audit

## There is no automated layer here

In the older repo this audit was the judgement half of a two-layer guardrail: a lint and
an edit-time hook caught the mechanical rules, and this skill caught the rest. **Neither
of those exists in this repo.** There is no lint for copy, no hook, no baseline, no test.
The only script this repo runs over source is oxlint, and oxlint does not read English.

So this audit is not the second line of defense. It is the only one. If it does not run,
copy ships unread. That also means the mechanical rules — emoji, ellipsis, ampersand,
semicolon — belong to this audit too, even though they were somebody else's job before.
They are the cheap part: scan for the characters, then spend your attention on the six
rules below.

## It depends on the voice guide

The standard is [docs/foundation/voice-content-guide.md](../../../docs/foundation/voice-content-guide.md).
Read it before auditing anything. Without it this skill has nothing to audit against — it
is a procedure, not a standard, and auditing from memory of "the brand voice" produces
opinions you cannot defend in review.

This is product-agnostic. The rules are brand voice: they apply to the client's product,
to another brand's surfaces, to an internal tool, to a mock you show on Thursday.

## Where the copy is

Copy is not only JSX text. Before auditing, list the surfaces:

- **Text nodes** in the components under `src/`, including empty states and error text.
- **Strings passed as props** to components — button labels, field labels and helper
  text, placeholders, tooltip content, tag and status text, table column headers, modal
  and drawer titles, confirm-dialog actions.
- **Copy stored as data** — arrays and objects in `.ts` files that a component maps over.
  Copy lives in `.ts` as often as in `.tsx`, and it is the half people forget.
- **User-visible `aria-label` and `title`** attributes. A screen reader user reads them.
- **Text in a design file** you composed. Read it with the file's metadata or design
  context tools rather than trusting a screenshot, which will not give you the exact
  string and cannot be quoted in a finding.

Not copy: comments, identifiers, import paths, class names, and anything in a dev-only
probe surface.

## The six rules a regular expression cannot see

**Language — English, always.** Every user-facing string ships in English. The reason
this needs judgement is the short accent-free word: *Guardar*, *Cancelar*, *Enviar*,
*Buscar*, *Borrar* are indistinguishable from identifiers to a pattern matcher, and they
are exactly what survives a translation pass.
Before: `<Button>Guardar</Button>` · After: `<Button>Save</Button>`

**Who the words are about.** Most products have two audiences one word apart —
the person using the product, and the people they serve. Getting it wrong reads
as carelessness to exactly the reader who notices, and no pattern can decide it,
because the correct word depends on whose relationship the sentence names.

> GAP: this product's two audiences and the word for each are not recorded.
> Whoever owns the voice guide decides them; until they do, flag the ambiguity
> rather than picking one.

**Serial comma.** The guide forbids the Oxford comma. A pattern can find `, and` but
cannot tell a list from two independent clauses, where the comma is required.
Before: *Add your hours, location, and phone number.* · After: *Add your hours, location
and phone number.*
Leave alone: *Save your changes, and we will publish them tonight.* — two clauses, not a
list.

**Sentence case.** Everywhere, except proper nouns and this product's feature or tool names. The
exception is the whole difficulty: a matcher cannot tell a product name from a
capitalized common noun.
Before: *Send Invoice* · After: *Send invoice*
Leave alone: *Connect Google Business Profile* — proper noun plus feature name.

**Point of view.** The reader is **you**. The product is **we, our, let's**. The reader's
clients are **they, them**. Never address the reader in the third person, and never call
their clients "you".
Before: *Users can export their list as a CSV file.* · After: *Export your list as a CSV
file.*
Before: *I'll set up your reminders.* · After: *Let's set up your reminders.*

**Value-forward.** Lead with the outcome the reader gets, not the capability the product
has. This is the rule most often broken by copy that is otherwise perfectly clean.
Before: *Two-way SMS sync is now available.* · After: *Reply to client texts without
leaving your inbox.*
Before: *Bulk edit is supported in this table.* · After: *Update several rows at once.*
Do not overcorrect into marketing. *Unlock the power of SMS. Do not miss out.* fails a
different rule — enthusiasm is earned, not performed.

## How to run it

This is a way of working, not a command. There is no script.

1. **Read the guide.** Then report whether the product's vocabulary is recorded: the
   guide's Voice and tone, What we call people and Feature naming sections, each written with a
   source or still a GAP. A recorded vocabulary is cited; for a GAP it has to come from the
   person who asked — and which of those you are in is the thing to establish before writing
   a word, not after.
2. **List the surfaces** as above and read them. One surface at a time; the findings run
   together otherwise.
3. **Draft findings.** For each one, capture the exact string, the file and line, the
   rule it breaks, and the replacement.
4. **Try to refute every finding before you report it.** This pass is not optional and it
   is where most of the value is. Ask of each: is this a proper noun, a feature
   name, or a metric abbreviation such as ROI or KPI? Is it a comment or an identifier I
   mistook for copy? **Does this string actually render** — trace the component that
   consumes it, because a label in a data file that nothing reads is dead data and
   flagging it wastes the reviewer's attention. Findings that survive the refutation get
   reported; the rest get dropped silently.
5. **Report, then apply.** Apply the hard findings. Present the tone findings and let a
   human choose, because a batch of unrequested tone rewrites is how an audit loses its
   credibility.

Findings cluster. When you find one voice gap, audit the whole surface rather than fixing
the one string — copy written in one sitting breaks the same rule repeatedly.

## Reporting discipline

Every finding carries four things. A finding without the replacement is homework, not an
audit.

| Field | Content |
| --- | --- |
| String | The offending text, quoted exactly as it renders |
| Location | File and line, or the design-file node id |
| Rule | Which rule, named — "serial comma", not "reads awkwardly" |
| Replacement | The corrected wording, ready to paste |

Mark each finding **hard** or **tone**. Hard is objective and checkable against the
guide: not English, wrong noun, serial comma, capitalization, point of view, a forbidden
character. Tone is a judgement rewrite, value-forward included once the sentence is
already correct. Apply hard, propose tone.

## Two things worth remembering

- **A green audit needs its scope stated.** "No findings" means nothing until you say
  which surfaces you read. Name them, including the ones you decided were out of scope
  and why.
- **When a rule keeps recurring and is genuinely mechanical, note it in
  [the backlog](../../../backlog/README.md)** as a check worth building. Fixing the instance and
  moving on is how the same defect arrives again next month, and in a repo with no
  automated layer that is the only way a lint ever gets built.
