/**
 * What `pnpm latency` is allowed to call a measurement.
 *
 * Every fixture here is a shape that was READ in a real transcript on
 * 2026-09-11, reduced to the fields the classifier touches. The cases that
 * matter are the ones where a plausible implementation reports a number that is
 * not latency: a resumed session, a `requestId` that comes back, a tool call
 * nothing answered, and a human who went to lunch mid-turn.
 */
import { describe, expect, it } from 'vitest';
import {
  HUMAN_TOOLS,
  IDLE_MS,
  classify,
  isAnEdit,
  isHumanPrompt,
  percentiles,
  rankCorrelation,
  requestRuns,
  sessionOpening,
  timedEntries,
  usageOf,
  writesAFile,
} from './latency-rules.mjs';

const T0 = Date.parse('2026-09-11T10:00:00.000Z');
const at = (ms) => new Date(T0 + ms).toISOString();

const assistant = (ms, requestId, content = [], extra = {}) => ({
  type: 'assistant',
  timestamp: at(ms),
  requestId,
  effort: 'high',
  message: { model: 'claude-opus-5', content, usage: extra.usage ?? {} },
  ...extra,
});

const prompt = (ms, text = 'do the thing') => ({
  type: 'user',
  timestamp: at(ms),
  message: { role: 'user', content: [{ type: 'text', text }] },
});

const result = (ms, id) => ({
  type: 'user',
  timestamp: at(ms),
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] },
});

const use = (id, name) => ({ type: 'tool_use', id, name, input: {} });

const kinds = (gaps) => gaps.map((g) => g.kind);
const of = (gaps, kind) => gaps.filter((g) => g.kind === kind).map((g) => g.ms);

describe('timedEntries', () => {
  it('drops what carries no clock and what nobody waited on', () => {
    const timed = timedEntries([
      { type: 'custom-title', customTitle: 'x' },
      { type: 'file-history-snapshot', messageId: 'm' },
      { type: 'attachment', timestamp: at(0), attachment: { type: 'hook_success' } },
      { type: 'user', timestamp: at(1), isMeta: true, message: { content: [] } },
      { type: 'system', timestamp: at(2), content: 'x' },
      prompt(3),
    ]);
    expect(timed).toHaveLength(1);
    expect(timed[0].at).toBe(T0 + 3);
  });

  it('drops an unparseable timestamp rather than emitting NaN', () => {
    expect(timedEntries([{ type: 'user', timestamp: 'not a date', message: {} }])).toHaveLength(0);
  });
});

describe('requestRuns', () => {
  it('groups the blocks of one request', () => {
    const runs = requestRuns(timedEntries([assistant(0, 'req_a'), assistant(800, 'req_a')]));
    expect(runs).toHaveLength(1);
    expect(runs[0].blocks).toHaveLength(2);
  });

  /* The case a map keyed on requestId gets wrong. A resumed session reuses the
   * id an hour later; grouping by adjacency closes the run the moment anything
   * intervenes, so the hour never becomes a generation time. */
  it('does not fuse two runs that share an id across a resume', () => {
    const runs = requestRuns(
      timedEntries([
        assistant(0, 'req_a'),
        prompt(3_600_000),
        assistant(3_600_500, 'req_a'),
      ]),
    );
    expect(runs).toHaveLength(2);
    expect(runs.every((r) => r.blocks.length === 1)).toBe(true);
  });

  it('keeps two adjacent runs apart when the id changes', () => {
    const runs = requestRuns(timedEntries([assistant(0, 'req_a'), assistant(10, 'req_b')]));
    expect(runs).toHaveLength(2);
  });

  /* A null id cannot vouch for two entries being one response, so each stands
   * alone. The alternative fuses every unidentified entry in the file. */
  it('never groups entries that carry no requestId', () => {
    const runs = requestRuns(timedEntries([assistant(0, null), assistant(10, null)]));
    expect(runs).toHaveLength(2);
  });
});

describe('classify', () => {
  it('separates waiting from generating', () => {
    const { gaps } = classify([
      prompt(0),
      assistant(2_000, 'req_a'),
      assistant(3_500, 'req_a'),
    ]);
    expect(of(gaps, 'wait')).toEqual([2_000]);
    expect(of(gaps, 'gen')).toEqual([1_500]);
  });

  it('emits no gen for a request of one block', () => {
    const { gaps } = classify([prompt(0), assistant(2_000, 'req_a')]);
    expect(kinds(gaps)).toEqual(['wait']);
  });

  it('times a tool from the call that asked for it to the result', () => {
    const { gaps } = classify([
      prompt(0),
      assistant(1_000, 'req_a', [use('t1', 'Bash')]),
      result(4_000, 't1'),
    ]);
    const tool = gaps.filter((g) => g.kind === 'tool');
    expect(tool).toHaveLength(1);
    expect(tool[0]).toMatchObject({ ms: 3_000, tool: 'Bash' });
  });

  it('pairs two tools asked for in one turn, by id and not by order', () => {
    const { gaps } = classify([
      prompt(0),
      assistant(1_000, 'req_a', [use('t1', 'Read'), use('t2', 'Grep')]),
      result(2_000, 't2'),
      result(5_000, 't1'),
    ]);
    const byTool = Object.fromEntries(
      gaps.filter((g) => g.kind === 'tool').map((g) => [g.tool, g.ms]),
    );
    expect(byTool).toEqual({ Grep: 1_000, Read: 4_000 });
  });

  /* The defect the first full run exposed: `AskUserQuestion` was the slowest
   * tool on the board at 20,8 h, all of it a person deciding. An instrument
   * that calls that latency reports the agent as slowest exactly when it asks
   * the question the intake gate requires. */
  it('calls a question to a person human, not tool', () => {
    const { gaps } = classify([
      prompt(0),
      assistant(1_000, 'req_a', [use('q1', 'AskUserQuestion')]),
      result(41_000, 'q1'),
    ]);
    const asked = gaps.find((g) => g.tool === 'AskUserQuestion');
    expect(asked).toMatchObject({ kind: 'human', ms: 40_000 });
    expect(of(gaps, 'tool')).toEqual([]);
  });

  it('still times an ordinary tool as a tool in the same turn', () => {
    const { gaps } = classify([
      prompt(0),
      assistant(1_000, 'req_a', [use('q1', 'AskUserQuestion'), use('t1', 'Bash')]),
      result(2_000, 't1'),
      result(41_000, 'q1'),
    ]);
    expect(of(gaps, 'tool')).toEqual([1_000]);
    expect(of(gaps, 'human')).toEqual([40_000]);
  });

  it('holds the human-tool list to what blocks on a person', () => {
    expect([...HUMAN_TOOLS]).toEqual(['AskUserQuestion', 'ExitPlanMode']);
  });

  it('counts a tool call nothing answered instead of dropping it', () => {
    const out = classify([prompt(0), assistant(1_000, 'req_a', [use('t1', 'Bash')])]);
    expect(out.unansweredCalls).toBe(1);
    expect(of(out.gaps, 'tool')).toEqual([]);
  });

  it('counts a result whose call is not in this file', () => {
    const out = classify([result(1_000, 'from-another-transcript')]);
    expect(out.unmatchedResults).toBe(1);
  });

  /* The gap before a typed prompt is a person thinking. Counting it as latency
   * is how an instrument reports that the agent got slower over lunch. */
  it('labels the gap before a typed prompt human, and the one before a tool result not', () => {
    const { gaps } = classify([
      prompt(0),
      assistant(1_000, 'req_a', [use('t1', 'Bash')]),
      result(2_000, 't1'),
      assistant(3_000, 'req_b'),
      prompt(60_000),
    ]);
    expect(of(gaps, 'human')).toEqual([57_000]);
    expect(of(gaps, 'wait')).toEqual([1_000, 1_000]);
  });

  it('relabels an over-threshold gap idle and remembers what it was', () => {
    const { gaps } = classify([prompt(0), assistant(IDLE_MS + 1, 'req_a')]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ kind: 'idle', was: 'wait' });
  });

  it('takes the threshold as an argument', () => {
    const { gaps } = classify([prompt(0), assistant(5_000, 'req_a')], { idleMs: 1_000 });
    expect(gaps[0].kind).toBe('idle');
  });

  /* A subagent's entries are interleaved into nothing here — they live in their
   * own file — but a transcript that carries the flag must not have its gaps
   * silently merged with the parent's. The runner reads this field; the
   * classifier's job is only to leave it reachable. */
  it('leaves the sidechain flag on the run for the caller to segment by', () => {
    const { runs } = classify([prompt(0), { ...assistant(1_000, 'req_a'), isSidechain: true }]);
    expect(runs[0].blocks[0].isSidechain).toBe(true);
  });

  it('reports no gap at all for a transcript of one entry', () => {
    expect(classify([prompt(0)]).gaps).toEqual([]);
  });
});

describe('usageOf', () => {
  it('reads context as everything the request had to carry', () => {
    const run = {
      blocks: [
        assistant(0, 'req_a', [], {
          usage: {
            input_tokens: 2,
            cache_read_input_tokens: 33_074,
            cache_creation_input_tokens: 27_964,
            output_tokens: 823,
            output_tokens_details: { thinking_tokens: 499 },
            speed: 'standard',
            service_tier: 'standard',
          },
        }),
      ],
    };
    expect(usageOf(run)).toMatchObject({ context: 61_040, output: 823, thinking: 499 });
  });

  it('answers zeros rather than NaN when a block carries no usage', () => {
    expect(usageOf({ blocks: [assistant(0, 'req_a')] })).toMatchObject({
      context: 0,
      thinking: 0,
      speed: 'unknown',
    });
  });
});

describe('percentiles', () => {
  it('returns a value that actually occurred', () => {
    expect(percentiles([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual({ 50: 5, 90: 9, 99: 10 });
  });

  it('answers null for an empty sample instead of zero', () => {
    expect(percentiles([])).toEqual({ 50: null, 90: null, 99: null });
  });

  it('does not sort its argument in place', () => {
    const values = [3, 1, 2];
    percentiles(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe('rankCorrelation', () => {
  const pairs = (n, f) => Array.from({ length: n }, (_, i) => [i, f(i)]);

  it('refuses to answer under thirty pairs', () => {
    expect(rankCorrelation(pairs(29, (i) => i))).toBeNull();
  });

  it('finds a monotonic rise', () => {
    expect(rankCorrelation(pairs(40, (i) => i * 3))).toBeCloseTo(1, 6);
  });

  it('finds a monotonic fall', () => {
    expect(rankCorrelation(pairs(40, (i) => -i))).toBeCloseTo(-1, 6);
  });

  it('answers zero when one column never varies', () => {
    expect(rankCorrelation(pairs(40, () => 7))).toBe(0);
  });
});

describe('isHumanPrompt', () => {
  it('tells a typed prompt from a tool result', () => {
    expect(isHumanPrompt(prompt(0))).toBe(true);
    expect(isHumanPrompt(result(0, 't1'))).toBe(false);
    expect(isHumanPrompt(assistant(0, 'req_a'))).toBe(false);
  });
});

describe('writesAFile', () => {
  it('reads a redirect to a real path as a write', () => {
    expect(writesAFile('echo hi > src/thing.ts')).toBe(true);
    expect(writesAFile("cat >> 'docs/foundation/checks.md'")).toBe(true);
  });

  it('does not read descriptor plumbing as a write', () => {
    expect(writesAFile('pnpm lint 2>&1')).toBe(false);
    expect(writesAFile('node scripts/x.mjs >&2')).toBe(false);
  });

  /* The case that decides whether this measurement means anything: CLAUDE.md's
   * own idiom for running a check redirects into the scratchpad. Counted as an
   * edit, every session's opening ends at its first check. */
  it('does not read the scratchpad or /dev/null as an edit', () => {
    expect(writesAFile('pnpm check:briefs 2>&1 > "$SCRATCH/briefs.log"')).toBe(false);
    expect(writesAFile('ls > /dev/null')).toBe(false);
    expect(writesAFile('node x.mjs > C:/Users/ianru/AppData/Local/Temp/claude/out.txt')).toBe(false);
  });

  /* A whole-segment match, not a substring one. `src/templates/` contains
   * "temp" and is not a scratch directory. */
  it('does not discard a real path that merely contains a discarded word', () => {
    expect(writesAFile('echo x > src/templates/card.ts')).toBe(true);
    expect(writesAFile('echo x > docs/scratching-the-surface.md')).toBe(true);
  });

  it('reads the in-place editors and the patch appliers as writes', () => {
    expect(writesAFile("sed -i 's/a/b/' src/x.ts")).toBe(true);
    expect(writesAFile('git apply /tmp/p.diff')).toBe(true);
    expect(writesAFile('cat p.diff | patch -p1')).toBe(true);
  });

  it('reads a plain read as no write at all', () => {
    expect(writesAFile("sed -n '1,40p' scripts/latency.mjs")).toBe(false);
    expect(writesAFile("grep -n '^export ' scripts/latency-rules.mjs | head -40")).toBe(false);
    expect(writesAFile('git diff --stat')).toBe(false);
  });

  it('answers false rather than throwing on a command that is not there', () => {
    expect(writesAFile(undefined)).toBe(false);
    expect(writesAFile('')).toBe(false);
  });
});

describe('isAnEdit', () => {
  it('takes both mechanisms and nothing else', () => {
    expect(isAnEdit({ name: 'Write', input: {} })).toBe(true);
    expect(isAnEdit({ name: 'Bash', input: { command: 'echo x > a.ts' } })).toBe(true);
    expect(isAnEdit({ name: 'Bash', input: { command: 'git status' } })).toBe(false);
    expect(isAnEdit({ name: 'Read', input: { file_path: 'a.ts' } })).toBe(false);
  });
});

describe('sessionOpening', () => {
  const bash = (id, command) => ({ type: 'tool_use', id, name: 'Bash', input: { command } });

  it('counts the calls before the first edit and not the edit itself', () => {
    const opening = sessionOpening([
      prompt(0),
      assistant(1000, 'req_a', [use('t1', 'Read')]),
      result(1500, 't1'),
      assistant(2000, 'req_b', [use('t2', 'Grep')]),
      result(2500, 't2'),
      assistant(3000, 'req_c', [use('t3', 'Edit')]),
      result(3500, 't3'),
    ]);
    expect(opening.kind).toBe('straight');
    expect(opening.calls).toBe(2);
    expect(opening.tools).toEqual(['Read', 'Grep']);
    expect(opening.ms).toBe(3000);
    expect(opening.by).toBe('tool');
  });

  /* The whole reason `writesAFile` exists. In bypass mode the edit arrives as a
   * heredoc, and a version of this that only knew `Edit`/`Write` would call this
   * session one that never edited anything. */
  it('sees an edit that arrived through Bash', () => {
    const opening = sessionOpening([
      prompt(0),
      assistant(1000, 'req_a', [bash('t1', "sed -n '1,20p' src/x.ts")]),
      result(1500, 't1'),
      assistant(2000, 'req_b', [bash('t2', 'cat > src/x.ts <<EOF')]),
    ]);
    expect(opening.kind).toBe('straight');
    expect(opening.by).toBe('bash');
    expect(opening.calls).toBe(1);
  });

  it('calls it deferred when a person typed again before the first edit', () => {
    const opening = sessionOpening([
      prompt(0),
      assistant(1000, 'req_a', [use('t1', 'Read')]),
      result(1500, 't1'),
      prompt(9000, 'no, do it the other way'),
      assistant(10_000, 'req_b', [use('t2', 'Write')]),
    ]);
    expect(opening.kind).toBe('deferred');
    expect(opening.prompts).toBe(2);
    expect(opening.calls).toBe(1);
  });

  it('reports a session that never edited rather than dropping it', () => {
    const opening = sessionOpening([
      prompt(0),
      assistant(1000, 'req_a', [use('t1', 'Read')]),
      result(1500, 't1'),
      assistant(2000, 'req_b', []),
    ]);
    expect(opening.kind).toBe('never');
    expect(opening.calls).toBe(1);
    expect(opening.ms).toBe(null);
  });

  /* The intake gate is supposed to cost this time. Returned beside `ms` so a
   * reader can subtract it, never subtracted here — the person's wait is real. */
  it('keeps the time spent inside a question to a person apart from the total', () => {
    const opening = sessionOpening([
      prompt(0),
      assistant(1000, 'req_a', [use('t1', 'AskUserQuestion')]),
      result(61_000, 't1'),
      assistant(62_000, 'req_b', [use('t2', 'Edit')]),
    ]);
    expect(opening.ms).toBe(62_000);
    expect(opening.humanMs).toBe(60_000);
    expect(opening.kind).toBe('straight');
  });

  it('reports what sat over the idle threshold instead of burying it in the total', () => {
    const opening = sessionOpening([
      prompt(0),
      assistant(1000, 'req_a', [use('t1', 'Read')]),
      result(1500, 't1'),
      assistant(IDLE_MS + 5000, 'req_b', [use('t2', 'Edit')]),
    ]);
    expect(opening.ms).toBe(IDLE_MS + 5000);
    expect(opening.idledMs).toBeGreaterThan(IDLE_MS);
  });

  /* Everything before the first typed prompt is the client starting up. A clock
   * that began at the first entry would measure the CLI, not the work. */
  it('starts the clock at the typed prompt, not at the first entry in the file', () => {
    const opening = sessionOpening([
      { type: 'user', timestamp: at(0), isMeta: true, message: { content: [] } },
      prompt(5000),
      assistant(6000, 'req_a', [use('t1', 'Write')]),
    ]);
    expect(opening.ms).toBe(1000);
  });

  it('answers null for a transcript nobody typed into', () => {
    expect(sessionOpening([assistant(0, 'req_a', [use('t1', 'Read')])])).toBe(null);
  });
});
