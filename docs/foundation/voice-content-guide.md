# Voice and content guide

The rules the product's copy follows, gathered from the four places they already
lived: the six `voice-audit` judges, the four characters `pnpm check:copy`
refuses, the noun phrase a token's `useWhen` takes, and `CLAUDE.md`'s English
rule. It is the standard [`voice-audit`](../../.claude/skills/voice-audit/SKILL.md)
measures copy against, and it adds no rule of its own. The client's tone and
terms are recorded by nobody until somebody owns the voice, so they stand as
GAPs where they belong.

It applies wherever somebody reads the words: the screens, the component and
token docs Figma prints, and the Figma files themselves. Which strings count as
copy, surface by surface, is in `voice-audit`.

> SOURCE: Ian, 2026-09-27, on what the guide holds: "las reglas que ya hay".
> The layout is a previous client's voice guide, and none of its voice is
> carried.

---

## Quick reference

- **English, always** — every string a person reads, and everything versioned.
- **Sentence case** — except proper nouns and feature or tool names.
- **Point of view** — the reader is *you*, the product is *we*, *our*,
  *let's*, and the people the reader serves are *they*.
- **Value-forward** — lead with what the reader gets, not what the product has.
- **No serial comma** in a list. Two clauses joined by *and* keep theirs.
- **Four characters, never** — the semicolon, the ellipsis, an ampersand
  standing for *and*, and emoji or arrows.
- **A token's `useWhen` is a noun phrase**, because Figma prints it after
  "Use it for:".
- **Tone and terms** — not recorded yet.

---

## Language — English, always

Every string a person reads ships in English, and so does everything versioned:
identifiers, comments, tests, docs and commit messages. Not everyone who reads
this repository shares a first language. The word that slips through is the
short one with no accent: *Guardar*, *Cancelar*, *Buscar* look like identifiers
to a pattern.

Before: `<button>Guardar</button>` · After: `<button>Save</button>`

> SOURCE: `CLAUDE.md`, Language, and `voice-audit`'s first rule.

## Voice and tone

> GAP: how the product sounds is not recorded, nor whether it shifts between
> someone trying it and someone who runs their work on it. Whoever owns the
> voice decides it. Until then every tone finding is a proposal.

### Point of view

The reader is **you**. The product is **we**, **our**, **let's**. The people the
reader serves are **they**, **them**. The reader is never spoken of in the third
person, and the people they serve are never *you*.

Before: *Users can export their list as a CSV file.* · After: *Export your list
as a CSV file.*

> SOURCE: `voice-audit`, point of view.

## Value-forward content

Lead with the outcome the reader gets, not the capability the product has. It
is the rule most often broken by copy that is otherwise clean. Enthusiasm is
earned, not performed: an outcome said plainly beats a claim about power.

Before: *Rings and sources can be filtered.* · After: *Pick a ring or a source
to keep only its cells lit.*

> SOURCE: `voice-audit`, value-forward. The After is the Terrestrial tip,
> `MapGrammar.tsx:1865`.

## Component copy rules

**A semantic token's `useWhen` entry is a noun phrase.** Figma prints the
token's description, then its `useWhen` list under "Use it for:", so each entry
names the thing: *A card that invites the person somewhere else, one at a time.*
(`semantic/usage.json:69`), not a phrase that opens on a preposition, such as
*On a card that floats*.

> SOURCE: `voice-audit` on a card's Figma copy, 2026-09-27, in the repository
> this method was built in. Where Figma prints
> it: `tokens-figma`, Descriptions.

## Grammar and style

**Sentence case**, everywhere except proper nouns and feature or tool names. A
matcher cannot tell a product's name from a capitalised common noun, so this
takes a reader.

Before: *Quality Breakdown* · After: *Quality breakdown*
Leave alone: *Network Explorer*, a product's name.

> SOURCE: `voice-audit`, sentence case. The names are in
> `src/product-context/registry.ts`.

**No serial comma.** The last two items of a list take no comma before *and* or
*or*. Two independent clauses keep theirs, which is why a pattern cannot decide
it.

Before: *Pick a ring, a source, or a tier.* · After: *Pick a ring, a source or a
tier.*
Leave alone: *Pick a ring or a source to keep only its cells lit, and pick it
again for all.* Two clauses, `MapGrammar.tsx:1865`.

> SOURCE: `voice-audit`, serial comma. `copy-rules.mjs` leaves it out on
> purpose: a `, and` scan was wrong for 17 strings in 18.

## Things to avoid

Four characters, with no exception in copy.

| Character | Write instead |
| --- | --- |
| Semicolon | Two sentences, or a dash |
| Ellipsis | The whole sentence |
| An ampersand standing for *and*, spaced | *and*. `Q&A` is a name, not one |
| Emoji and arrows | Words, or a published icon |

`pnpm check:copy` refuses them in string literals of three words or more under
`src/`, outside the record modules
[`copy-rules.mjs`](../../scripts/copy-rules.mjs) lists. JSX text, JSDoc, JSON
and Figma it cannot read, so the audit reads them. A Figma property's emoji,
`👁️` or `✏️`, belongs to the property's name, not to copy.

> SOURCE: `scripts/copy-rules.mjs`, `RULES`. The property names: the
> `component` skill, step 7.

## What we call people

Most products have two audiences one word apart: the person using the product,
and the people they serve. The wrong word reads as carelessness to exactly the
reader who notices, and only the relationship the sentence names decides it.

> GAP: the product's audiences and the word for each are not recorded.
> Whoever owns the voice decides them. Until then an audit flags the ambiguity
> rather than picking a word.

## Feature naming

> GAP: the product's names for its features and tools are not recorded, so
> sentence case cannot yet tell a feature's name from a common noun.
