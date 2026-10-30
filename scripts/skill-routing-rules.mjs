/**
 * What counts as a skill firing, and which transcripts get read.
 *
 * **The rule that matters is the one a text search gets wrong.** Every request
 * carries the `Skill` TOOL DEFINITION, which names `Skill` exactly the way a
 * call does. Measured on this machine 2026-09-12: eleven lines matched the name
 * and three of them were calls. So an invocation is a `tool_use` block and
 * nothing else, which is what `invocationsIn` reads and what the spec pins.
 *
 * **A skill has two routes and they are different events.** The model choosing
 * it from a description is a `Skill` call; a person typing `/<name>` is a
 * `<command-name>` line. Folding them together answers neither question, and
 * the description is only implicated in the first.
 */

/**
 * A transcript directory name is a path with every other character flattened.
 *
 * Per CHARACTER, not per run of characters. `C:\design-ops` mangles to
 * `c--design-ops` — the colon and the separator each become a dash — and a `+`
 * in that class collapses them into one, producing `c-design-ops`, which
 * matches nothing. Measured 2026-09-10 in `session-cost.mjs`, which carried its
 * own copy of this line until 2026-09-12: the first version missed its own
 * project, fell through to reading all 19 on the machine, and printed a
 * confident total over somebody else's clients.
 */
export function projectSlug(path) {
  return path.replace(/[^A-Za-z0-9]/g, '-').toLowerCase();
}

/**
 * The main checkout, given any of its worktrees.
 *
 * A session inside `.claude/worktrees/<name>` is still this repository and its
 * skills are the same files, so a census scoped to the exact working directory
 * would read one worktree and call it the history.
 */
export function mainCheckout(cwd) {
  return cwd.replace(/[\\/]\.claude[\\/]worktrees[\\/][^\\/]+$/, '');
}

/**
 * Whether a transcript directory belongs to a checkout or one of its worktrees.
 *
 * The worktree segment is required rather than a bare prefix. A sibling
 * checkout named `design-ops-2` mangles to this repository's slug plus two
 * characters, so a bare `startsWith` would price another repository's sessions
 * into this one and report a confident total over both — the same shape of
 * defect as the slug that matched nothing in 2026-09-10. Found 2026-09-12 while
 * `pnpm cost` adopted this rule; nothing on this machine was affected, which is
 * exactly why it would have gone on being true until something was.
 */
export function belongsToRepo(directoryName, slug) {
  const name = directoryName.toLowerCase();
  return name === slug || name.startsWith(`${slug}--claude-worktrees-`);
}

/**
 * Every skill invocation in one transcript line.
 *
 * The name arrives directory-scoped when a skill is reached from a worktree —
 * `.claude/worktrees/feat+x:diff-review` is the same skill as `diff-review`,
 * and counting them apart would report one skill as two that each fired once.
 */
export function invocationsIn(line) {
  let record;
  try {
    record = JSON.parse(line);
  } catch {
    return [];
  }
  const content = record?.message?.content;
  if (!Array.isArray(content)) return [];
  return content
    .filter((block) => block?.type === 'tool_use' && block?.name === 'Skill')
    .map((block) => ({
      skill: String(block.input?.skill ?? '').replace(/^.*:/, ''),
      caller: block.caller?.type ?? 'unknown',
    }))
    .filter((entry) => entry.skill !== '');
}

/**
 * Every `/<name>` a person typed in one transcript line.
 *
 * The name has to follow immediately, because the `Skill` tool's own
 * description contains the words `<command-name>` followed by prose and would
 * otherwise be counted as somebody typing something.
 *
 * **And the line has to be a person SPEAKING, which is the half this read
 * missed until 2026-09-14.** A transcript carries the text of every file an
 * agent opened, so the `<command-name>/setup</command-name>` sitting in this
 * file's own spec fixtures was counted as somebody typing `/setup` every time
 * any session read it. Measured over the 90 retained transcripts: 29 counted,
 * 24 of them a `tool_result`, 4 an assistant turn, 1 an attachment — **1 was a
 * person**. The rule was already written ten lines above, for `invocationsIn`,
 * and this counter did not apply it.
 *
 * So the shape decides, never the text: a typed command is a `user` record, and
 * its words come from the string content or from `text` blocks. A `tool_result`
 * block is never read, whatever it quotes.
 */
const TYPED_COMMAND = /<command-name>\/?([A-Za-z][\w-]*)/g;

export function typedIn(line) {
  let record;
  try {
    record = JSON.parse(line);
  } catch {
    return [];
  }
  if (record?.type !== 'user') return [];
  const content = record?.message?.content;
  /* A string is what a typed command actually arrives as. The array branch is
   * for a turn assembled out of blocks, where only `text` is the person. */
  const spoken =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content
            .filter((block) => block?.type === 'text')
            .map((block) => String(block.text ?? ''))
            .join('\n')
        : '';
  return [...spoken.matchAll(TYPED_COMMAND)].map((match) => match[1]);
}

/**
 * When a session began, read out of the transcript rather than off the file.
 *
 * **Not `mtime`.** A session that opened before a change and kept writing after
 * it carries an mtime on the later side, so a window keyed on mtime files it
 * under text it never saw — and that is the one axis a census of descriptions
 * needs the window to get right. The first entry is the anchor that cannot
 * move.
 *
 * **And not line 1 either.** A transcript can open with a summary or a meta
 * record carrying no `timestamp`: measured 2026-09-13 over the 22 transcripts
 * of this project, 13 carry theirs on the first line and 9 as deep as the
 * fourth. So this scans forward to the first entry that has one and returns
 * `null` when the opening lines carry none, because a guessed start is worse
 * than an absent one.
 */
const SCAN_LINES = 20;

export function sessionStart(text) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length && i < SCAN_LINES; i += 1) {
    if (lines[i] === '') continue;
    let record;
    try {
      record = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    const stamp = record?.timestamp;
    if (typeof stamp === 'string' && !Number.isNaN(Date.parse(stamp))) return stamp;
  }
  return null;
}

/**
 * The `--since` boundary, as a millisecond value or as a refusal.
 *
 * **An unparseable value must not read as an absent one.** `--since yesterday`
 * quietly filtering nothing would print the whole window under a heading that
 * claims a boundary, which is the same shape as the zero `session-cost.mjs`
 * refuses to print: a number that looks measured and is not.
 */
export function parseSince(value) {
  if (value === undefined) return { since: null };
  if (typeof value !== 'string' || value === '' || value.startsWith('--')) {
    return { error: '--since needs an ISO timestamp after it, and none followed' };
  }
  const at = Date.parse(value);
  if (Number.isNaN(at)) return { error: `--since ${value} is not a date this can read` };
  return { since: at };
}

/**
 * Whether a session that began at `stamp` opened after the boundary.
 *
 * A transcript whose start could not be read is excluded rather than included,
 * because the question `--since` asks is "did this session open under the new
 * text" and an unknown start cannot answer yes. The walk counts those out loud
 * so the exclusion is visible instead of shrinking the window in silence.
 */
export function startedAfter(stamp, since) {
  if (since === null) return true;
  if (stamp === null) return false;
  return Date.parse(stamp) > since;
}

/**
 * What an agent can see of one skill.
 *
 * Two mechanisms, and neither is readable from the other's file:
 * `disable-model-invocation: true` in the frontmatter hides the name outright,
 * and `skillOverrides` in `.claude/settings.json` can drop it to `name-only`,
 * where the agent sees a name and pays for no description. A skill in either
 * state that never fired is not evidence about descriptions — it had none to
 * fire on, which is why this is read rather than assumed.
 *
 * `scripts/claim-probes.mjs` and `scripts/check-skills-table.mjs` each hold
 * their own copy of these two mechanisms. This is a third, and the brief says
 * so rather than refactoring two runners from inside a measurement.
 */
export function skillState(frontmatterText, override) {
  const flagged = /^disable-model-invocation:\s*true\s*$/m.test(frontmatterText);
  return flagged ? 'user-invocable-only' : (override ?? 'on');
}

/** Whether a skill in this state routes on its description at all. */
export function routesOnDescription(state) {
  return state === 'on';
}
