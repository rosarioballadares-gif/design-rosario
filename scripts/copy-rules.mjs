/**
 * The four characters the voice guide forbids without exception, and what
 * counts as copy in the first place.
 *
 * **The judgement half of a copy audit cannot be automated and this does not
 * try.** Clients versus customers, sentence case, point of view, value-forward
 * — every one of those needs a reader who knows whose relationship the sentence
 * names. The `voice-audit` skill is right that no lint reads English.
 *
 * **It is wrong that the MECHANICAL half needs a person too, and that is what
 * this file is for.** Writing the chart library's usage rules on 2026-09-02 put
 * **nine semicolons into one file in one sitting**, every one of them a
 * straightforward violation of a rule with no exceptions, and the only reason
 * they were found is that somebody happened to run the audit.
 *
 * **The serial comma is deliberately NOT here**, and that is the measurement
 * that decided the scope rather than caution: a naive `, and` scan over the
 * chart library's copy flagged 18 strings, and **17 of them were two
 * independent clauses**, where the comma is required. A rule that is wrong 94
 * per cent of the time is how a check becomes something people learn to
 * silence. The comma stays with the human.
 *
 * The pure half lives here and the walking lives in `check-copy.mjs`, so this
 * can be tested without a filesystem — the same split `brief-fields.mjs` uses.
 */

/** One rule: a name, what it matches, and what to write instead. */
export const RULES = [
  {
    id: 'semicolon',
    test: (s) => s.includes(';'),
    repair: 'Two sentences, or a dash. The guide forbids the semicolon outright.',
  },
  {
    id: 'ellipsis',
    test: (s) => s.includes('…'),
    repair: 'Say the whole sentence. An ellipsis in product copy is a trailing off.',
  },
  {
    id: 'ampersand',
    // Spaced, so `Q&A`, `AT&T` and a URL parameter are not swept up. An
    // ampersand standing in for "and" is the one the guide forbids.
    test: (s) => / & /.test(s),
    repair: 'Write "and".',
  },
  {
    id: 'emoji',
    /**
     * Four alternatives rather than one character class, because the variation
     * selector is a COMBINING character and oxlint refuses it inside a class —
     * `no-misleading-character-class`, and it is right: inside a class it reads
     * as a member rather than as the modifier it is.
     *
     * The arrow block is here on purpose. CLAUDE.md records that writing a
     * A design tool escapes angle brackets, so an arrow in copy is already
     * a character that travels badly, and it is a picture standing in for a
     * word exactly as an emoji is.
     */
    test: (s) =>
      /[\u{1F300}-\u{1FAFF}]/u.test(s) ||
      /[\u{2600}-\u{27BF}]/u.test(s) ||
      /[\u{2190}-\u{21FF}]/u.test(s) ||
      s.includes('️'),
    repair: 'Say it in words, or use a published icon.',
  },
];

/**
 * What counts as copy, which is the whole difficulty.
 *
 * Three words or more, containing a letter. A class name, a token name, a path
 * and an import specifier all fall out, and so does every single-word label —
 * which is a real hole and a deliberate one: `Save;` is not a string anybody
 * writes, and widening this to one word floods the result with identifiers.
 *
 * A stylesheet in a template literal falls out too: `{border-top:1px solid
 * ${LINE};…}` has three words, and its semicolons are syntax. Measured
 * 2026-09-24, three of ten findings were CSS in `MapGrammar.tsx`.
 */
export const looksLikeCss = (s) => /\{[\w-]+:(?:[^{}]|\$\{[^{}]*\})*;/.test(s);

export const looksLikeCopy = (s) =>
  /[A-Za-z]/.test(s) && s.trim().split(/\s+/).length >= 3 && !looksLikeCss(s);

/**
 * Files whose strings are RECORDS rather than copy, and why each one is here.
 *
 * **This list is the check's honesty and it is measured rather than assumed.**
 * In the repository this was harvested from, a blanket scan over `src/` on
 * 2026-09-02 returned 126 findings, and 120 of them were in record modules:
 * prose about the system, where a semicolon is ordinary English, rather than
 * copy that broke a rule. This repository starts with one:
 *
 * - `*.spec.ts` — assertion messages, read by whoever the test failed on.
 *
 * The others it will grow are of two shapes: a typed product model quoted
 * close to verbatim from the sources it cites, where editing a punctuation mark
 * falsifies a citation, and a findings record with file paths, measurements
 * and evidence in it.
 *
 * A file added here is a claim that nothing in it reaches a reader as product
 * copy, and it is a deliberate edit rather than a pattern, so the claim has an
 * author.
 */
export const RECORD_MODULES = [
  /\.spec\.tsx?$/,
];

export const isRecordModule = (path) => RECORD_MODULES.some((re) => re.test(path));

/**
 * Blank out comments, keeping the line count so a finding's line number is the
 * line it is on.
 *
 * A comment naming a semicolon reads as one to any scanner that does not strip
 * them, and this repository has been caught by exactly that before.
 */
export function stripComments(text) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return text
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead) => lead + blank(m.slice(lead.length)));
}

/**
 * The strings in one file, with the line each is on.
 *
 * Single quotes, double quotes and template literals — the third because a
 * template is what copy uses the moment it interpolates a name.
 *
 * **It does NOT read JSX text nodes**, and saying so is the point: `<p>Ready to
 * publish; not yet live</p>` is copy this check cannot see. Reading it properly
 * needs a parser rather than a regular expression, and a regular expression
 * that half-reads JSX would report a coverage it does not have. Stated here
 * rather than discovered by somebody trusting a green run.
 */
export function stringsIn(text) {
  const source = stripComments(text);
  const found = [];
  source.split('\n').forEach((line, index) => {
    const pattern = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
    for (const match of line.matchAll(pattern)) {
      const value = match[1] ?? match[2] ?? match[3] ?? '';
      if (value) found.push({ line: index + 1, value });
    }
  });
  return found;
}

/** Every finding in one file's text. `path` is repo-relative, with forward slashes. */
export function findingsIn(path, text) {
  if (isRecordModule(path)) return [];
  return stringsIn(text)
    .filter(({ value }) => looksLikeCopy(value))
    .flatMap(({ line, value }) =>
      RULES.filter((rule) => rule.test(value)).map((rule) => ({
        path,
        line,
        rule: rule.id,
        repair: rule.repair,
        text: value,
      })),
    );
}

/**
 * A finding's identity in the baseline, and it deliberately excludes the LINE.
 *
 * A line number moves every time somebody edits above it, so keying on one
 * would turn an unrelated change into a new finding and a fixed one into a
 * stale entry. The path, the rule and the string itself are what identify it —
 * the same reasoning every baseline here uses for its own key.
 */
export const keyOf = (f) => `${f.path} | ${f.rule} | ${f.text}`;
