/**
 * The standing floor — what this repository costs an agent on every call,
 * before a word of the task has been read — held against a budget somebody set
 * on a date for a reason.
 *
 * Two things are paid on every call and both are written in this repository:
 * `CLAUDE.md`, injected whole, and the skill listing, one line per skill the
 * agent is allowed to see. Nothing else here is in the repository's hands. The
 * MCP tool names cost about 719 tokens and a deny does not remove them; the
 * harness's own system prompt is not ours; the hook that prints the profile at
 * session start reads a file that is not versioned. Those are stated on every
 * run rather than filed in this header, because a floor check that quietly
 * measures a fraction of the floor is worse than none.
 *
 * **WHY THIS EXISTS.** `CLAUDE.md` went from 13.734 bytes on 2026-08-13 to
 * 81.799 on 2026-09-09 — 27 days of monotonic growth — and not one test, check
 * or job objected on the way up. It was cut in half the next morning by a
 * person who decided to look. Nothing would have objected if it had kept going,
 * and nothing objects today when it grows back. That is the whole finding, and
 * this module is the answer to it.
 *
 * **A BUDGET, NOT A BASELINE.** The sibling checks that carry a baseline guard
 * a subject somebody else broke — a design file, a published package — where the
 * honest record is what is wrong today. This subject is two files in this
 * repository, and the number is not a record of damage. It is a ceiling, and
 * crossing it is meant to cost a conversation: raise it in `context-floor.json`
 * with the date and the sentence that justifies it, or cut something. There is
 * no `--write-baseline` here for the same reason there is none on the skills
 * table — it would be a silencer with no legitimate use.
 *
 * **THE TOKEN COUNT IS A PROXY AND THAT IS FINE.** Bytes are converted at 3,7
 * characters a token, the ratio the 2026-09-12 audit used. A real tokenizer would move
 * these numbers by a few per cent and move the budget by the same few per cent,
 * so the comparison it is asked to make is unaffected. A proxy that is stable
 * is enough for a ceiling; it would not be enough for an invoice.
 *
 * The pure half lives here and the reading lives in `check-context-floor.mjs`,
 * so this can be tested without a filesystem — the same split `skills-table.mjs`,
 * `brief-fields.mjs` and `claim-rules.mjs` use.
 */

/**
 * Bytes to tokens. 3,7 is the ratio the audit of 2026-09-12 published, and at
 * that ratio `CLAUDE.md` reproduces the page's headline figure to the token:
 * 11.771. The listing measures 534 here where the page published 525, because
 * the page counted characters and this counts bytes — nine tokens of em dash
 * in the descriptions. The bytes are the honest number and the page is the one
 * that was nine tokens light.
 */
export const CHARS_PER_TOKEN = 3.7;

/**
 * Where the harness cuts a skill description in the listing. Measured off a
 * real injected listing on 2026-09-12: the longest surviving description ran
 * 119 characters and closed with a single-character ellipsis.
 */
export const DESCRIPTION_CAP = 120;

/**
 * BYTES, not characters, and the difference is 49 tokens on today's CLAUDE.md.
 *
 * A document full of em dashes and Spanish names decodes to fewer JavaScript
 * characters than it occupies on disk, and reading `.length` off the decoded
 * string quietly measures the smaller of the two. Bytes are what `wc -c` and
 * `git cat-file -s` return, which is what the audit published and what anybody
 * can reproduce at a prompt without trusting this file.
 */
export function bytes(text) {
  return Buffer.byteLength(text, 'utf8');
}

export function tokens(byteCount) {
  return Math.round(byteCount / CHARS_PER_TOKEN);
}

/**
 * One skill's line in the listing as the agent receives it.
 *
 * Three visibility states, and the difference between them is the whole reason
 * the listing is affordable: a hidden skill costs nothing, a `name-only` skill
 * costs its name, and a listed skill costs its name plus a description the
 * harness truncates. Returns `null` for a skill that never reaches the listing,
 * so the caller counts what was actually carried rather than what exists.
 */
export function listingLine({ name, description = '', hidden = false, nameOnly = false }) {
  if (hidden) return null;
  if (nameOnly || description.trim() === '') return `- ${name}\n`;
  const text = description.trim();
  const shown = text.length > DESCRIPTION_CAP ? `${text.slice(0, DESCRIPTION_CAP - 1)}…` : text;
  return `- ${name}: ${shown}\n`;
}

/**
 * The listing, as characters carried.
 *
 * Built from the lines rather than summed from lengths so that the one thing a
 * reader can check by eye — the rendered listing — is the thing that was
 * measured.
 */
export function listingText(skills) {
  return skills
    .map(listingLine)
    .filter((line) => line !== null)
    .join('');
}

/**
 * What the floor is, in tokens, part by part.
 *
 * `listed` and `onDisk` travel with it because the difference between them is
 * the compression this workspace is buying, and a run that reports a floor
 * without reporting how many skills produced it has hidden the lever.
 *
 * Line endings are counted as LF. A checkout with `core.autocrlf` writes CRLF,
 * and on 2026-10-08 the same CLAUDE.md measured 4.173 tokens from an LF tree
 * and 4.258 from the CRLF one Git wrote after a merge: a ceiling held against
 * whichever the machine happened to write is a ceiling on the machine.
 */
export function measure({ claudeText, skills }) {
  const listing = listingText(skills);
  const parts = {
    'CLAUDE.md': tokens(bytes(claudeText.replace(/\r\n/g, '\n'))),
    'skill listing': tokens(bytes(listing)),
  };
  return {
    parts,
    total: parts['CLAUDE.md'] + parts['skill listing'],
    listed: skills.filter((skill) => listingLine(skill) !== null).length,
    onDisk: skills.length,
  };
}

/**
 * The scope floor, checked BEFORE the findings and for the reason every check
 * here states it: a run that resolved nothing finds nothing over budget and
 * exits 0, and that reads exactly like a pass. An empty `CLAUDE.md`, an empty
 * skills directory or a budget file with no ceilings are all "this could not
 * measure", never "this measured zero".
 */
export function floorFailures(measured, budget) {
  const found = [];
  if (!measured.parts['CLAUDE.md']) {
    found.push('CLAUDE.md measured 0 tokens, so the document was not read.');
  }
  if (measured.onDisk === 0) {
    found.push('No skill directories were read, so the listing was not measured.');
  }
  for (const part of Object.keys(measured.parts ?? {})) {
    if (typeof budget?.budget?.[part] !== 'number') {
      found.push(`The budget names no ceiling for "${part}", so that part was not compared.`);
    }
  }
  return found;
}

/**
 * Every part over its ceiling, one finding each.
 *
 * A part the budget does not name is a finding rather than a skip: the day
 * somebody adds a third thing that is paid on every call, the check that
 * silently ignores it is the one that lets the floor grow again. This is the
 * same failure the lenient default in `brief-fields.mjs` was rewritten to
 * avoid — a check that decides not to inspect something still reports green.
 */
export function findings(measured, budget) {
  const ceilings = budget?.budget ?? {};
  const found = [];

  for (const [part, spent] of Object.entries(measured.parts)) {
    const ceiling = ceilings[part];
    if (typeof ceiling !== 'number') {
      found.push(`${part}: ${spent} tokens, and the budget names no ceiling for it.`);
      continue;
    }
    if (spent > ceiling) {
      found.push(
        `${part}: ${spent} tokens against a ceiling of ${ceiling}, over by ${spent - ceiling}.`,
      );
    }
  }

  return found;
}

/** The ceilings added up — the headline number, and the sum of the parts by construction. */
export function ceilingTotal(budget) {
  return Object.values(budget?.budget ?? {}).reduce((sum, ceiling) => sum + ceiling, 0);
}
