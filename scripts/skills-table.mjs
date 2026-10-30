/**
 * The skills table in `CLAUDE.md` and the directory it describes, held against
 * each other.
 *
 * The table is a hand-kept index of `.claude/skills/` and nothing has ever read
 * both. `CLAUDE.md` says so about itself: *"No test, no lint and no CI job reads
 * `.claude/skills/`, so the table is a hand-kept index with no mechanism behind
 * it."* It listed twelve of seventeen for weeks, and was found only because four
 * subagents happened to list the directory while checking for name collisions.
 *
 * **This module names no skill, which is its acceptance test**: grep it for one
 * and the answer must be zero. The table is parsed and the directory is listed,
 * so a new skill needs no edit here. A rule that has to change when the set
 * changes is a third copy of the set wearing a check's clothes.
 *
 * **A line-oriented scan is enough here and it is worth saying why**, since the
 * two sibling modules both collapse their region first. A markdown table row
 * cannot be reflowed — a row is a line by definition, and a break inside one
 * ends the table. So the row shape is the boundary rather than a blank line.
 *
 * **WHAT IT CANNOT SEE.** Whether the description beside a skill is accurate,
 * whether the skill works, and whether the set is the set this workspace should
 * have. It reads a name against a directory name and nothing else. It also
 * cannot see the OTHER half of the failure this repairs: a past-tense sentence
 * elsewhere in a 900-line document describing a state that has ended. That one
 * has no rule and is recorded as an open gap rather than solved here.
 *
 * The pure half lives here and the reading lives in `check-skills-table.mjs`,
 * so this can be tested without a filesystem — the same split `role-list.mjs`,
 * `product-roster.mjs` and `brief-fields.mjs` use.
 */

/** The table's header row, and the only thing that locates it. */
export const ANCHOR = '| Skill | Use it when |';

/** A row naming a skill: a backticked slug in the first cell. */
const ROW = /^\|\s*`([a-z0-9-]+)`\s*\|/;

/**
 * The skills the table lists, in the order it lists them.
 *
 * Read from the anchor to the first line that is not a table row, so the
 * paragraphs beneath the table cannot contribute — several of them mention a
 * skill in backticks, and a region ending at a blank line would swallow the
 * separator row and stop one line later than intended either way.
 */
export function tabledSkills(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === ANCHOR);
  if (start === -1) return [];
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim().startsWith('|')) break;
    const match = ROW.exec(line.trim());
    if (match) out.push(match[1]);
  }
  return out;
}

/** How many times the header appears. Anything but one makes the region arbitrary. */
export function anchorCount(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .filter((l) => l.trim() === ANCHOR).length;
}

/** What a run actually resolved, printed whether it passes or fails. */
export function scopeOf(text, directory) {
  return {
    anchors: anchorCount(text),
    tabled: tabledSkills(text).length,
    onDisk: [...directory].length,
  };
}

/**
 * Did this resolve enough to have measured anything?
 *
 * Checked BEFORE any comparison, because two empty lists compare equal and a run
 * that parsed nothing would report no disagreement and exit 0, which reads
 * exactly like a pass.
 *
 * Floors and structural counts rather than today's numbers. Pinning the count
 * would fail the most ordinary correct edit there is — a skill added to both
 * places — which is how a check becomes something people learn to silence.
 */
export function floorFailures(text, directory) {
  const s = scopeOf(text, directory);
  const out = [];
  if (s.anchors !== 1) {
    out.push(`the table header was found ${s.anchors} times, expected exactly 1`);
  }
  if (s.tabled === 0) out.push('the table lists no skills, so nothing was read');
  if (s.onDisk === 0) out.push('the directory holds no skills, so nothing was read');
  return out;
}

/**
 * How the two disagree.
 *
 * Membership only, and NOT order. The directory arrives alphabetical while the
 * table is ordered by when a person needs each skill, which is a deliberate
 * editorial sequence — the two sibling checks compare order because both their
 * sides are authored, and this one has a side that is sorted by the filesystem.
 */
export function disagreements(text, directory) {
  const tabled = tabledSkills(text);
  const onDisk = [...directory];
  const listed = new Set(tabled);
  const present = new Set(onDisk);
  const out = [];
  for (const name of onDisk) {
    if (!listed.has(name)) out.push(`${name} exists in .claude/skills/ and the table does not list it`);
  }
  for (const name of tabled) {
    if (!present.has(name)) out.push(`${name} is in the table and there is no such directory`);
  }
  // A row written twice passes both loops above — every tabled name exists and
  // every directory is listed — so it needs its own finding. It is worth having:
  // a duplicate is what a careless merge of two edits to this table produces,
  // and the table is exactly the kind of file two people edit at once.
  const seen = new Set();
  for (const name of tabled) {
    if (seen.has(name)) out.push(`${name} appears in the table more than once`);
    seen.add(name);
  }
  return out;
}

/**
 * A `: ` inside a skill's `description` breaks its frontmatter, and the failure
 * is silent in the worst possible way.
 *
 * YAML reads `key: value` and a second unquoted `: ` inside the value makes the
 * block unparseable. The harness then falls back to the file's `# H1`, so the
 * skill still appears in the listing, still has a name, and is described by its
 * TITLE — a heading that names what the file is about rather than when to reach
 * for it, which routes nothing. The file is complete and the skill is
 * unreachable.
 *
 * **It has now been paid for twice.** It is recorded in one person's private
 * memory from an earlier occurrence, and on 2026-09-10 a pass that shortened
 * eleven descriptions reintroduced it in two of them — in the same session that
 * measured eleven skills with zero invocations. A trap that survives being
 * written down is one that needs a check.
 *
 * The repair is an em dash, or quoting the whole value. This reports rather than
 * repairs, because which one reads better is a writing decision.
 */
export const COLON_IN_DESCRIPTION = /:\s/;

export function descriptionFailures(descriptions) {
  const found = [];
  for (const [skill, description] of Object.entries(descriptions ?? {})) {
    if (typeof description !== 'string') continue;
    if (!COLON_IN_DESCRIPTION.test(description)) continue;
    /* A string, because that is what `disagreements` returns and the runner
     * prints the two together. A finding shaped differently from its siblings
     * prints as [object Object] — a check that fires and says nothing. */
    found.push(
      `${skill} has a colon followed by a space in its description, so YAML stops ` +
        'parsing the frontmatter there. The harness falls back to the H1 and the skill ' +
        'is listed under its title rather than its trigger, which routes nothing, ' +
        'present and complete and unroutable. Use an em dash, or quote the whole value',
    );
  }
  return found;
}

/**
 * The states a skill can be in, and which of them leave it needing a reacher.
 *
 * Two mechanisms put a skill out of the agent's sight and they do not agree on
 * anything else: `disable-model-invocation: true` in the frontmatter hides it
 * AND refuses the `Skill` tool, while `skillOverrides` in settings has four
 * values of its own. `name-only` lists the name and keeps the tool working, so
 * it needs nothing — it is the state that costs almost nothing and stays
 * reachable, which is why the distinction is worth carrying.
 *
 * Measured the hard way: moving seven skills from the frontmatter flag to
 * `name-only` dropped this check from nine subjects to two, silently and green.
 * A rule that learns its subject from one of two sources reports on neither.
 */
export const NEEDS_A_REACHER = new Set(['frontmatter-flag', 'user-invocable-only', 'off']);

export function unreachableHidden(states, routerText, tableText) {
  const found = [];
  const rows = new Map();
  for (const line of String(tableText ?? '').split('\n')) {
    const row = ROW.exec(line);
    if (row) rows.set(row[1], line.slice(row[0].length).replace(/\|/g, '').trim());
  }
  for (const [skill, state] of Object.entries(states ?? {})) {
    if (!NEEDS_A_REACHER.has(state)) continue;
    if (String(routerText ?? '').includes(skill)) continue;
    if (rows.get(skill)) continue;
    found.push(
      `${skill} is ${state}, so the agent cannot see it, and nothing hands over ` +
        'its path: it is not named in scripts/skill-router.cjs and its table row is ' +
        'empty. Name it in the router with the condition that should reach it, write ' +
        'the sentence in the table if only a person starts it, or set it to ' +
        'name-only in skillOverrides, which lists the name and costs almost nothing',
    );
  }
  return found;
}