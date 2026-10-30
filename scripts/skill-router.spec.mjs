/**
 * Holds `skill-router.cjs` to the one thing it exists to do: put a hidden
 * skill's CONDITION in front of the agent at the moment the condition occurs.
 *
 * Why a hook needs a spec at all, and what its absence cost in the repository
 * this came from: a second half of this same router went dead on 2026-09-12
 * when an MCP server changed its prefix, and nothing could see it. This half
 * had no spec at all, so the entries added on 2026-09-14 were
 * proven by a probe run once, by hand, in a session that then ended. The first
 * such probe was WRONG in a way worth recording here: it reused one
 * `session_id`, so `fireOnce` silenced every case after the first and two
 * passing entries read as failures. An entry that fires once per session cannot
 * be probed by a loop that looks like one session, which is why every case
 * below carries a session of its own.
 *
 * It runs the hook as a process, over stdin, because a matcher this file cannot
 * see is exactly how the other half stayed green while dead.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROUTER = fileURLToPath(new URL('./skill-router.cjs', import.meta.url));

/* Sessions are namespaced per run: `fireOnce` keys its store by session id in
 * the system temp directory, and a leftover from an earlier run would silence
 * a case that should fire. */
const RUN = `spec-${process.pid}-${Date.now()}`;
let n = 0;

/** The raw hook output for one submitted prompt. Empty string means quiet. */
function raw(prompt, session = `${RUN}-${n++}`) {
  return execFileSync('node', [ROUTER], {
    input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: session, prompt }),
    encoding: 'utf8',
  });
}

/** The skills a prompt routes to, in the order the notice names them. */
function submit(prompt, session) {
  const out = raw(prompt, session);
  if (!out) return [];
  const notice = JSON.parse(out).hookSpecificOutput.additionalContext;
  return [...notice.matchAll(/skills\/([a-z-]+)\//g)].map((m) => m[1]);
}

/* One phrasing per entry, in the words somebody would type rather than the
 * words the regex is written in. Each has to route to its own skill and to
 * nothing else — an entry that also fires its neighbours is noise. */
const FIRES = {
  'pattern-research': 'modal or drawer — what does everyone else do',
  feedback: 'this is confusing, the check said green and measured nothing',
};

describe('the prompt half of skill-router', () => {
  for (const [skill, prompt] of Object.entries(FIRES)) {
    it(`routes to ${skill}, and to nothing else`, () => {
      expect(submit(prompt)).toEqual([skill]);
    });
  }

  /* The verdict of 2026-09-14 written as a test: five never-reached skills were
   * judged, three were cut to `name-only` with an entry here, and TWO were
   * refused because their condition is a state of the world rather than
   * something somebody says. A prompt about copy or about announcing work must
   * therefore route nowhere — those two keep their description instead.
   *
   * `contrast-audit` joined them on 2026-09-15, and it is the only one cut after
   * shipping. Designers reported the contrast checks as a rabbit hole; which
   * artefact they meant was never established, and this entry is the only one
   * that could start unasked. */
  it.each([
    ['the word copy on its own', 'please copy this file to the other directory'],
    ['ordinary design work', 'add a new section to the settings page'],
    ['a colour with no claim', 'change the card background to the subtle token'],
    ['a colour with a claim — contrast-audit is reached by name', 'does the subtle foreground token pass AA on that surface'],
    ['copy about to ship — voice-audit was refused', 'the empty state needs better microcopy and a clearer label'],
    ['work reaching people — update-message was refused', 'announce the new component to the team'],
  ])('stays quiet on %s', (_label, prompt) => {
    expect(submit(prompt)).toEqual([]);
  });

  it('fires an entry once per session, then stays quiet', () => {
    const session = `${RUN}-once`;
    expect(submit(FIRES['pattern-research'], session)).toEqual(['pattern-research']);
    expect(submit(FIRES['pattern-research'], session)).toEqual([]);
  });

  /* The notice told the agent the `Skill` tool REFUSES the skill, which was
   * false for every `name-only` entry and would have defeated the route the
   * 2026-09-14 cut depends on. */
  it('tells the agent the Skill tool reaches the skill', () => {
    const notice = JSON.parse(raw(FIRES['pattern-research'])).hookSpecificOutput.additionalContext;
    expect(notice).toContain('Skill(pattern-research) reaches it');
    expect(notice).not.toMatch(/refuses it/);
  });

  it('has a case above for every entry in MOMENTS', () => {
    const src = readFileSync(ROUTER, 'utf8');
    const body = src.slice(src.indexOf('const MOMENTS'), src.indexOf('let raw ='));
    const named = [...body.matchAll(/skill: '([a-z-]+)'/g)].map((m) => m[1]);
    expect(named.sort()).toEqual(Object.keys(FIRES).sort());
  });
});

/** The skills one tool call routes to. */
function use(tool_name, tool_input, session = `${RUN}-${n++}`) {
  const out = execFileSync('node', [ROUTER], {
    input: JSON.stringify({ hook_event_name: 'PostToolUse', session_id: session, tool_name, tool_input }),
    encoding: 'utf8',
  });
  if (!out) return [];
  const { hookEventName, additionalContext } = JSON.parse(out).hookSpecificOutput;
  expect(hookEventName).toBe('PostToolUse');
  return [...additionalContext.matchAll(/skills\/([a-z-]+)\//g)].map((m) => m[1]);
}

/* The read is the census that opened the rules-notice test on 2026-09-30,
 * where parity fired on it and so not on the write after it. */
const FIGMA_READS = {
  code: [
    "await figma.setCurrentPageAsync(await figma.getNodeByIdAsync('10:2'));",
    "const out = { pages: figma.root.children.map(p => p.name + ' ' + p.id), sets: {} };",
    "const s = await figma.getNodeByIdAsync('20:5');",
    "out.sets[s.name] = Object.entries(s.componentPropertyDefinitions).map(([k, d]) => d.type === 'VARIANT' ? k : d.type);",
    'return out;',
  ].join('\n'),
};
const FIGMA_WRITES = { code: "const n = await figma.getNodeByIdAsync('1:2');\nn.name = 'Card';" };

describe('the tool half of skill-router', () => {
  it.each([
    ['an edit under src/ds', 'Edit', { file_path: 'C:\\repo\\src\\ds\\tokens\\semantic\\dark.json' }],
    ['a new file under src/ds', 'Write', { file_path: '/repo/src/ds/Button.tsx' }],
    ['a Figma write, under any server name', 'mcp__figma-example__use_figma', FIGMA_WRITES],
    ['a Figma property set', 'mcp__figma__use_figma', { code: "h.setProperties({ Size: 'page' });" }],
  ])('routes %s to parity', (_label, tool, input) => {
    expect(use(tool, input)).toEqual(['parity']);
  });

  it.each([
    ['an edit outside src/ds', 'Edit', { file_path: '/repo/src/sandbox/dashboard/look.tsx' }],
    ['a Figma read', 'mcp__figma-example__get_screenshot', {}],
    ['plugin code that only reads', 'mcp__figma-example__use_figma', FIGMA_READS],
  ])('stays quiet on %s', (_label, tool, input) => {
    expect(use(tool, input)).toEqual([]);
  });

  it('fires once per session, then stays quiet', () => {
    const session = `${RUN}-parity-once`;
    expect(use('Edit', { file_path: '/repo/src/ds/index.ts' }, session)).toEqual(['parity']);
    expect(use('mcp__figma__use_figma', FIGMA_WRITES, session)).toEqual([]);
  });

  it('keeps its one notice for the write that follows a read', () => {
    const session = `${RUN}-parity-read-first`;
    expect(use('mcp__figma__use_figma', FIGMA_READS, session)).toEqual([]);
    expect(use('mcp__figma__use_figma', FIGMA_WRITES, session)).toEqual(['parity']);
  });
});

/** The raw notice a tool call gets, or '' when the router stays quiet. */
function notice(tool_name, tool_input, session = `${RUN}-${n++}`) {
  const out = execFileSync('node', [ROUTER], {
    input: JSON.stringify({ hook_event_name: 'PostToolUse', session_id: session, tool_name, tool_input }),
    encoding: 'utf8',
  });
  return out ? JSON.parse(out).hookSpecificOutput.additionalContext : '';
}

const PLACES = { code: 'const set = await figma.getNodeByIdAsync("30:2");\nframe.appendChild(set.defaultVariant.createInstance());' };
const RULES = /src\/ds\/guidance\/records\/ whose figmaNode/;

describe('the component-rules entry', () => {
  it('sends a Figma write that places an instance to the record and the JSDoc', () => {
    const text = notice('mcp__figma-example__use_figma', PLACES);
    expect(text).toMatch(RULES);
    expect(text).toMatch(/JSDoc/);
  });

  it('asks for every set the session places, since it fires only once', () => {
    const text = notice('mcp__figma-example__use_figma', PLACES);
    expect(text).toMatch(/every component set this session places/);
    expect(text).toMatch(/does not come back/);
  });

  it('stays out of a Figma write that places nothing, which parity still gets', () => {
    const text = notice('mcp__figma__use_figma', { code: 'frame.resize(320, 200);' });
    expect(text).not.toMatch(RULES);
    expect(text).toMatch(/skills\/parity\//);
  });

  it('stays quiet on an Edit whose content says createInstance(', () => {
    expect(notice('Edit', { file_path: '/repo/notes.md', new_string: 'createInstance(' })).toBe('');
  });

  it('fires once per session, then stays quiet', () => {
    const session = `${RUN}-rules-once`;
    expect(notice('mcp__figma__use_figma', PLACES, session)).toMatch(RULES);
    expect(notice('mcp__figma__use_figma', PLACES, session)).toBe('');
  });
});

describe('it fails open', () => {
  it('stays quiet on a payload that is not JSON', () => {
    expect(execFileSync('node', [ROUTER], { input: 'not json at all', encoding: 'utf8' })).toBe('');
  });

  it('stays quiet on a submit with no prompt', () => {
    const payload = JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: RUN });
    expect(execFileSync('node', [ROUTER], { input: payload, encoding: 'utf8' })).toBe('');
  });

  it('stays quiet on an event it does not handle', () => {
    const payload = JSON.stringify({ hook_event_name: 'Notification', prompt: FIRES.feedback });
    expect(execFileSync('node', [ROUTER], { input: payload, encoding: 'utf8' })).toBe('');
  });
});
