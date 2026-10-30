/**
 * The two places `.claude/skills/setup/SKILL.md` names the roles it offers, and
 * how one is derived from the other.
 *
 * The skill states the list twice: once as the question a person is asked, and
 * once as the field of the profile shape that stores their answer. On
 * 2026-09-08 three roles were added to both. Nothing compared them, and
 * `briefs/2026-09-02-tracker-in-the-profile.md` records what that costs — a
 * field written into the profile without being added to the documented shape,
 * where "the next run of that skill would have written the old shape back over
 * them".
 *
 * **The two are DERIVABLE, which is why this holds two lists against each other
 * rather than against a third one kept here.** Measured 2026-09-08 against the
 * real file: collapse the bullet's region, cut it at the escape phrase, split on
 * commas, lowercase and hyphenate, and the result is byte-identical, in the same
 * order, to the shape's union minus its trailing escape value. So this module
 * names no role, which is its acceptance test: grep it for one and the answer
 * must be zero. A rule that has to be edited when the list changes is a second
 * copy of the list wearing a check's clothes.
 *
 * **A line-oriented scanner cannot do this.** Markdown reflow splits one role's
 * words across two source lines, so a grep for the phrase returns 0 while the
 * phrase is plainly there. The region is collapsed before anything is matched.
 *
 * **WHAT IT CANNOT SEE, and this is the whole point of saying it here.** Whether
 * these are the teams the organization actually has. No script in this
 * repository can read an org chart. Both statements agreeing is exactly as
 * likely when both are stale as when both are current, and this module cannot
 * tell those apart.
 *
 * The pure half lives here and the reading lives in `check-role-list.mjs`, so
 * this can be tested without a filesystem, the same split `copy-rules.mjs` and
 * `brief-fields.mjs` use.
 */

/** Where the question's list starts, and whose absence is a parse failure rather than a naming problem. */
export const ANCHOR = '- **Role.**';

/**
 * Where the question's list ends.
 *
 * Everything after it is the escape hatch and the sentence explaining the group,
 * neither of which is a list item. Cutting here rather than at the full stop is
 * what lets that sentence be reworded freely.
 */
export const ESCAPE = ', or something else';

/** The shape's field, as it appears in the fenced example. */
const UNION_FIELD = /"role":\s*"([^"]*)"/g;

/**
 * The bullet's region: from the anchor to the first blank line, with every
 * quoted line dropped.
 *
 * The blockquote is dropped rather than included because it is a citation of
 * what somebody said, in whatever language they said it, and it sits inside the
 * bullet. Including it would make the region's content depend on how an
 * attribution was worded.
 */
export function roleBulletRegion(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(ANCHOR));
  if (start === -1) return '';
  const region = [];
  for (let i = start; i < lines.length; i += 1) {
    if (i > start && lines[i].trim() === '') break;
    if (lines[i].trim().startsWith('>')) continue;
    region.push(lines[i]);
  }
  return region.join(' ').replace(/\s+/g, ' ').trim();
}

/** How many times the anchor appears. Anything but one and the region above is arbitrary. */
export function anchorCount(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .filter((l) => l.startsWith(ANCHOR)).length;
}

/**
 * The list the question offers, as slugs.
 *
 * Slugifying a comma-delimited list of proper nouns is not the same move as
 * scanning arbitrary English, and the difference is the failure mode. A form
 * this cannot handle produces a slug that matches nothing, which is a RED naming
 * both strings. It cannot pass quietly.
 */
export function derivedRoles(text) {
  const region = roleBulletRegion(text);
  if (!region) return [];
  const body = region.slice(ANCHOR.length);
  const cut = body.indexOf(ESCAPE);
  if (cut === -1) return [];
  return body
    .slice(0, cut)
    .split(/,\s*/)
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, '-'))
    .filter(Boolean);
}

/** The values the shape's field lists, in order, including the trailing escape value. */
export function unionSlugs(text) {
  const found = [...String(text ?? '').matchAll(UNION_FIELD)];
  if (found.length !== 1) return [];
  return found[0][1]
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** How many times the shape's field appears. Two would make the one read above arbitrary. */
export function unionFieldCount(text) {
  return [...String(text ?? '').matchAll(UNION_FIELD)].length;
}

/** What a run actually resolved, printed whether it passes or fails. */
export function scopeOf(text) {
  return {
    anchors: anchorCount(text),
    unionFields: unionFieldCount(text),
    regionChars: roleBulletRegion(text).length,
    proseItems: derivedRoles(text).length,
    unionItems: unionSlugs(text).length,
  };
}

/**
 * Did this resolve enough to have measured anything?
 *
 * Checked BEFORE any comparison, because two empty lists compare equal and a run
 * that parsed nothing would report no disagreement and exit 0, which reads
 * exactly like a pass.
 *
 * These are floors and structural counts rather than today's numbers. Pinning
 * the count would fail a correct edit that adds a role to both places, which is
 * how a check becomes something people learn to silence. Catching a one-sided
 * edit is the comparison's job, not the floor's.
 */
export function scopeFailure(text) {
  const s = scopeOf(text);
  if (s.anchors !== 1) {
    return `The question's anchor appears ${s.anchors} times rather than once. This is a parse failure and not a naming problem: nothing below read a list.`;
  }
  if (s.unionFields !== 1) {
    return `The shape's field appears ${s.unionFields} times rather than once. Nothing below read a list.`;
  }
  if (s.proseItems < 2) {
    return `The question resolved to ${s.proseItems} item(s) over ${s.regionChars} characters. The region or the escape phrase stopped resolving, so any comparison below is an artefact.`;
  }
  if (s.unionItems < 3) {
    return `The shape resolved to ${s.unionItems} value(s). It stopped resolving, so any comparison below is an artefact.`;
  }
  return null;
}

/**
 * Where the two statements disagree.
 *
 * The escape value is positional rather than named: the question ends with an
 * escape phrase and the shape ends with the value that stores it, so the shape
 * carries exactly one more entry and the rest line up in order. Naming that
 * value here would put a role name in this file.
 */
export function findingsIn(text) {
  const prose = derivedRoles(text);
  const union = unionSlugs(text);
  const findings = [];

  if (union.length !== prose.length + 1) {
    findings.push({
      rule: 'escape-slot',
      detail: `The question offers ${prose.length} and the shape stores ${union.length}. The shape carries exactly one more, for the answer the escape phrase invites.`,
      repair: 'Add the value to the shape, or remove the item from the question. Both are in the same file.',
    });
  }

  const paired = Math.min(prose.length, union.length);
  for (let i = 0; i < paired; i += 1) {
    if (prose[i] !== union[i]) {
      findings.push({
        rule: 'disagree',
        detail: `Position ${i + 1}: the question derives "${prose[i]}" and the shape stores "${union[i]}".`,
        repair: 'One of the two was edited alone. Make them match, in the same commit.',
      });
    }
  }

  return findings;
}
