/**
 * Is this feedback record usable by somebody who was not there?
 *
 * WHAT THIS IS NOT, first, because the resemblance to `brief-fields.mjs` is the
 * trap. A brief asserts facts about the world, so every one of its sections
 * earns a citation, an attribution or a stated gap. A feedback record is
 * attributed testimony: somebody says what happened to them. "This cost me
 * forty minutes" can never carry a citation, and a checker that demanded one
 * would teach the writer to invent a link — which is the single failure the
 * three-state rule exists to prevent, reintroduced by the tool meant to enforce
 * it.
 *
 * So the three states apply to exactly one section here, `What would fix it`,
 * because a proposal IS a claim about the world. The observation and the cost
 * are held to a different bar: they must be written, and the document must name
 * who wrote them and when.
 *
 * WHAT IT CANNOT DO. It cannot tell friction from praise. A record whose cost
 * section reads "nothing, this worked fine" passes every rule below. What it
 * can tell is that somebody typed a cost, which turns a blank into a visible
 * act rather than an omission. Judgement stays with the reader, as it does in
 * the sibling check.
 *
 * It also cannot tell whether the person named is the person who experienced
 * it. That failure has already happened here once, in the other direction:
 * Christine Moreau's observation about the theme picker reached CLAUDE.md
 * attributed to Ian Rueff, because the record was written by the person who
 * heard it rather than the person who had it. No regular expression sees that.
 * The skill is where it is addressed.
 *
 * Pure: takes text, returns findings. No filesystem.
 */

import {
  CITATION,
  GAP_MARKER,
  SOURCE_MARKER,
  splitSections,
  stripFences,
} from './brief-fields.mjs';

/**
 * The sections of a feedback record, in reading order.
 *
 * Four, and deliberately fewer than the brief's ten. A record nobody writes is
 * worth nothing, and every field is a reason not to start. These are the ones
 * that make a record legible to somebody who was not in the room: what
 * happened, where it happened, what it cost, and — optionally — what the person
 * thinks would fix it.
 */
export const FEEDBACK_FIELDS = ['What happened', 'Where', 'What it cost', 'What would fix it'];

/**
 * The three that must be present.
 *
 * `What would fix it` is optional on purpose. The person who hits the friction
 * is frequently not the person who knows the repair, and requiring a proposal
 * would push them to guess one. A record that says only "this happened, here,
 * and it cost me an afternoon" is complete feedback.
 */
export const REQUIRED_FEEDBACK_FIELDS = ['What happened', 'Where', 'What it cost'];

/**
 * The one section held to the brief's three-state rule.
 *
 * A proposal is a claim about how this repository should change, and it is read
 * by somebody deciding whether to make that change. It earns the same bar every
 * other claim here earns.
 */
export const CLAIM_FIELDS = ['What would fix it'];

/** `YYYY-MM-DD-<slug>.md` — the shape a record's filename must have. */
export const FEEDBACK_FILENAME = /^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;

/**
 * A reporter: a `SOURCE:` line that names somebody AND carries an ISO date.
 *
 * The date is not decoration. Feedback ages differently from a decision — "the
 * setup skill left me stuck" is a fact about a version of a file, and without a
 * date the next reader cannot tell whether it has already been repaired. A
 * `SOURCE:` with a name and no date passes the sibling check and fails here,
 * which is the one place these two checks deliberately disagree.
 */
export const REPORTER = /^>\s*SOURCE:\s*(.+?),\s*(\d{4}-\d{2}-\d{2})/gim;

/**
 * A locator: something that sends a reader to the surface being reported on.
 *
 * Wider than the brief's `CITATION`, because the surfaces here are frequently
 * commands rather than files. "It failed when I ran the env check" names
 * nothing a reader can run; `pnpm check:env` does. Restricted to the runners
 * this repository actually uses, so an arbitrary backticked phrase does not
 * pass as a location.
 */
export const COMMAND = /`(?:pnpm|npm|npx|node|git|gh|tsc|vite)\s[^`\n]+`/g;

export const LOCATOR = new RegExp(`${CITATION.source}|${COMMAND.source}`, 'g');

/**
 * The short forms people write, mapped to the section they mean.
 *
 * Three of the four fields begin with "What", which defeats the sibling
 * checker's expansion rule and is why `fieldForFeedback` resolves ambiguity to
 * null rather than to the longest match.
 */
const HEADING_ALIASES = new Map([
  ['what went wrong', 'What happened'],
  ['the problem', 'What happened'],
  ['problem', 'What happened'],
  ['observation', 'What happened'],
  ['what i hit', 'What happened'],
  ['surface', 'Where'],
  ['location', 'Where'],
  ['cost', 'What it cost'],
  ['the cost', 'What it cost'],
  ['impact', 'What it cost'],
  ['what this cost', 'What it cost'],
  ['fix', 'What would fix it'],
  ['the fix', 'What would fix it'],
  ['proposal', 'What would fix it'],
  ['what would help', 'What would fix it'],
  ['suggestion', 'What would fix it'],
]);

/**
 * Which section a heading means, or null.
 *
 * Same three rules as the brief's resolver with one deliberate difference: an
 * expansion that matches MORE THAN ONE field resolves to null. "What" expands
 * to three fields here, and the brief's longest-first tiebreak would silently
 * bind it to `What would fix it` — so a record headed `## What` would satisfy
 * the optional field and be reported as missing the two required ones, with the
 * author looking at a heading that seemed to say the right thing.
 */
export function fieldForFeedback(heading) {
  const norm = String(heading ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ')
    .trim();
  const byLength = [...FEEDBACK_FIELDS].sort((a, b) => b.length - a.length);

  const prefix = byLength.find((f) => norm.startsWith(f.toLowerCase()));
  if (prefix) return prefix;

  if (norm.length >= 4) {
    const expands = byLength.filter((f) => f.toLowerCase().startsWith(norm));
    if (expands.length === 1) return expands[0];
    if (expands.length > 1) return null;
  }

  for (const [alias, field] of HEADING_ALIASES) {
    if (norm === alias || norm.startsWith(`${alias} `)) return field;
  }

  return null;
}

const countMatches = (text, re) =>
  (text.match(new RegExp(re.source, re.flags.replace('g', '') + 'g')) || []).length;

/**
 * Check a record's filename.
 *
 * A record with no date in its name is a record whose age nobody can read, and
 * the directory sorts by name. There is no legacy corpus here to be lenient
 * about — the first record and this rule land in the same commit — so this is a
 * hard failure rather than the graded exemption the briefs carry.
 *
 * @param {string} filename
 * @returns {{field: string, code: string, detail: string}[]}
 */
export function checkFeedbackName(filename) {
  const name = String(filename ?? '');
  if (FEEDBACK_FILENAME.test(name)) return [];
  return [
    {
      field: '(filename)',
      code: 'unnamed',
      detail:
        `"${name}" is not "YYYY-MM-DD-<slug>.md". The date is how a reader tells ` +
        `whether this has already been repaired, and the directory sorts by it.`,
    },
  ];
}

/**
 * Check one feedback record.
 *
 * @param {string} markdown
 * @param {{ required?: readonly string[] }} [options]
 * @returns {{ ok: boolean, findings: {field: string, code: string, detail: string}[], stats: object }}
 */
export function checkFeedback(markdown, options = {}) {
  const required = options.required ?? REQUIRED_FEEDBACK_FIELDS;
  const text = String(markdown ?? '');
  const sections = splitSections(text, fieldForFeedback);
  const findings = [];

  const whole = stripFences(text);
  const reporters = countMatches(whole, REPORTER);
  const sourced = countMatches(whole, SOURCE_MARKER);

  // The rule that makes this a feedback record rather than an anonymous note.
  //
  // Checked over the whole document rather than per section, because the
  // attribution covers everything in it: one person reporting one piece of
  // friction on one day. Splitting it per section would invite a record that
  // attributes its observation and leaves its cost unowned.
  if (!reporters) {
    findings.push({
      field: '(document)',
      code: sourced ? 'undated-reporter' : 'unattributed',
      detail: sourced
        ? `a "> SOURCE:" line is here but none carries a date. Write ` +
          `"> SOURCE: <name>, YYYY-MM-DD" — without the date nobody can tell ` +
          `whether this was already repaired.`
        : `no "> SOURCE: <name>, YYYY-MM-DD" anywhere. A record nobody signed is ` +
          `a record nobody can go back to, and the name has to be the person who ` +
          `HIT this, not the person writing it down.`,
    });
  }

  // Every required section is present, exactly once. Same shape as the sibling
  // check and for the same reason: two headings resolving to one field means
  // one of them goes unread.
  for (const field of required) {
    const matching = sections.filter((s) => s.field === field);

    if (matching.length === 0) {
      findings.push({
        field,
        code: 'missing',
        detail: `no "## ${field}" section. It is one of the three a record cannot do without.`,
      });
      continue;
    }

    if (matching.length > 1) {
      findings.push({
        field,
        code: 'duplicate',
        detail:
          `${matching.length} headings resolve to "${field}" ` +
          `(${matching.map((s) => `"${s.heading}"`).join(', ')}). ` +
          `Merge them: only one is read, and the others go unchecked.`,
      });
    }
  }

  let cited = 0;
  let gaps = 0;

  for (const section of sections) {
    const label = section.field ?? section.heading;
    const body = stripFences(section.body);
    const hasProse = Boolean(body.trim());
    const hasBlock = Boolean(section.body.trim());

    const gapCount = countMatches(body, GAP_MARKER);
    const locatorCount = countMatches(body, LOCATOR);
    gaps += gapCount;
    cited += locatorCount;

    // An empty section is only worth a finding when it is one of the four. A
    // heading somebody left behind is their business.
    if (!hasProse && !hasBlock && section.field) {
      findings.push({
        field: label,
        code: 'empty',
        detail:
          `"## ${section.heading}" is empty. Write it, or state a "> GAP:". ` +
          `A blank section is the difference between a report and a mention.`,
      });
      continue;
    }

    if (!hasProse) continue;

    // `Where` has to send the reader somewhere. This is the only section with a
    // locator requirement, because it is the only one whose subject is a thing
    // in the repository rather than an experience of it.
    if (section.field === 'Where' && !locatorCount && !gapCount) {
      findings.push({
        field: label,
        code: 'unlocated',
        detail:
          `"## ${section.heading}" names no file, link or command. "the setup skill" ` +
          `is not somewhere a reader can go, and \`.claude/skills/setup/SKILL.md\` is. ` +
          `State "> GAP:" if you genuinely could not tell where it happened.`,
      });
    }

    // The proposal is the one claim in the document, and it carries the same
    // bar every other claim in this repository carries.
    if (CLAIM_FIELDS.includes(section.field)) {
      const sourceCount = countMatches(body, SOURCE_MARKER);
      if (!gapCount && !sourceCount && !locatorCount) {
        findings.push({
          field: label,
          code: 'unsupported-proposal',
          detail:
            `"## ${section.heading}" proposes a change with no citation, no ` +
            `"> SOURCE: who, when" and no "> GAP: ...". The observation above it ` +
            `needs none of those. A proposal is a claim about how this repository ` +
            `should change, and it is read by whoever decides.`,
        });
      }
    }
  }

  return {
    ok: findings.length === 0,
    findings,
    stats: {
      fields: required.length,
      sections: sections.length,
      reporters,
      cited,
      gaps,
    },
  };
}
