/**
 * Deciding what a subagent was ASKED for, from the prompt it was handed.
 *
 * Kept apart from `subagent-shapes.mjs` for the same reason `transcript-walk.mjs`
 * is kept apart from `session-cost.mjs`: the runner reads the disk, prints and
 * exits at module load, so nothing can import it to test it. These two functions
 * are the whole judgement in that report, and the report's headline number is
 * only readable if the rule that produced it is pinned.
 */

/**
 * The words the ladder in `.claude/skills/model-and-effort/SKILL.md` uses for
 * each rung, in the ladder's own order. **First match wins.**
 *
 * `decision` sits above `census` deliberately: a prompt saying "count every file
 * and decide which to keep" is a decision that happens to count, and calling it
 * a census would inflate the one number this report exists to produce. The cost
 * of that choice is that `census` is a FLOOR — a prompt carrying both words
 * lands in `decision` and is never counted here.
 *
 * Measured 2026-09-11 and this is what makes the floor readable: of 976
 * `decision` prompts, **7 contain "count" at all**. The floor and the ceiling
 * are within a handful of transcripts of each other, so the headline share is
 * not resting on where this boundary was drawn.
 */
export const SHAPES = [
  {
    key: 'decision',
    re: /\b(decide|decision|recommend|propose|argue|judge|assess|evaluate|choose|weigh|trade[- ]?off|verdict|classify|review|audit|critique)\b/i,
  },
  {
    key: 'write',
    re: /\b(implement|write|edit|refactor|fix|build|create|add|rename|migrate|draft|author|compose)\b/i,
  },
  {
    key: 'census',
    re: /\b(count|counts|counting|enumerate|census|inventory|list all|list every|grep|search for|find all|find every|locate|capture|screenshot|tally|catalogue|catalog)\b/i,
  },
  {
    key: 'read',
    re: /\b(read|report|summar[iy]|describe|explain|what does|which files?|where is|look up|check whether|verify)\b/i,
  },
];

export const SHAPE_KEYS = [...SHAPES.map((s) => s.key), 'unclassified'];

/** First match wins, in ladder order. */
export function shapeOf(prompt) {
  for (const { key, re } of SHAPES) if (re.test(prompt)) return key;
  return 'unclassified';
}

/**
 * The opening prompt of a sidechain transcript.
 *
 * It is the first `user` entry that is not a tool result: a subagent's
 * transcript opens with the prompt its parent handed it, and every later `user`
 * entry is tool output being fed back. An entry mixing a tool result with text
 * is skipped whole rather than mined for its text — that shape is a result
 * being returned, and reading its prose as the brief would classify the
 * agent's own findings instead of its instructions.
 *
 * Returns `''` when there is none, which the runner REPORTS as `promptless`
 * rather than skipping. A transcript with no readable prompt is a hole in the
 * measurement, not a zero in it.
 */
export function openingPrompt(entries) {
  for (const entry of entries) {
    if (entry?.type !== 'user') continue;
    const content = entry?.message?.content;
    if (Array.isArray(content) && content.some((c) => c?.type === 'tool_result')) continue;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      const parts = content.filter((c) => c?.type === 'text').map((c) => c.text ?? '');
      if (parts.length) return parts.join(' ');
    }
  }
  return '';
}
