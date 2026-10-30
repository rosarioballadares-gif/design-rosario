#!/usr/bin/env node
'use strict';
/*
 * The router for skills that are NOT described in the injected listing.
 *
 * WHY THIS EXISTS. Several skills here are listed to the agent by NAME ONLY —
 * `skillOverrides` in `.claude/settings.json` — so each costs about 20 bytes
 * instead of 300 and the `Skill` tool still reaches them. A name with no
 * description routes nothing on its own, which is exactly the gap this fills:
 * the name arrives with its CONDITION, at the moment the condition occurs.
 *
 * WHY NOT PROSE. A rule that depends on the model recalling a sentence written
 * in a file it read at session start is the rule that already failed. Measured
 * in the repository this was harvested from, over 82 sessions: skills were 0,6
 * per cent of tool calls, and one skill was invoked ZERO times while 3.303
 * calls were made into the surface it covered.
 *
 * IT WARNS, IT DOES NOT REFUSE. A prompt cannot be denied, so every entry here
 * is a notice. The other half of the router in the repository this came from
 * could deny, because it rode on `PreToolUse` over a tool whose first write is
 * irreversible. Nothing here has such a tool yet. When one arrives — a Figma
 * write, a deploy, a ticket create — the branch to add is `PreToolUse` with a
 * `deny`, and denial is the only form that lands before the damage.
 *
 * WHY ONCE PER SESSION, per entry. `additionalContext` enters the conversation
 * and is re-read on every later call, so an entry that fired repeatedly would
 * be accretion — the same standing cost `check:floor` exists to hold down,
 * paid in a worse place.
 *
 * Fails OPEN on anything unexpected: an unreadable payload, an unwritable
 * store, a shape it does not recognise. The worst this may ever do is stay
 * quiet.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { sweepOnce } = require('./hook-store-sweep.cjs');

/*
 * The prompt entries: a skill whose condition is something somebody SAYS, and
 * the words that say it.
 *
 * THE CRITERION FOR BEING HERE, and it is the same one that licenses taking a
 * skill's description away: a skill may lose its description only if its
 * condition occurs at a moment some mechanism already observes. A cut without a
 * route is the failure `check:skills-table` cannot see, because it demands a
 * reacher only of a skill the agent cannot see at all, and `name-only` is
 * visible.
 *
 * The terms are matched in English and in Spanish, because the people using
 * this workspace do not all prompt in the same language and a router that only
 * hears one of them is a router that fires for half the team.
 */
const MOMENTS = [
  {
    skill: 'pattern-research',
    what: 'somebody asking what other shipped systems already do with a pattern',
    terms:
      /\b(prior art|benchmark(ing)?|other (design )?systems|everyone else|industry standard|modal or drawer|drawer or modal|qu[ée] hacen (los )?dem[áa]s|otros sistemas)\b/i,
  },
  {
    skill: 'feedback',
    what: 'something in this workspace costing somebody time, or behaving unlike its own text',
    terms:
      /\b(cost me time|wasted my time|this is confusing|left me stuck|behaved unlike|contradicts its own|me hizo perder tiempo|me dej[óo] atascad|esto confunde)\b/i,
  },
];

/*
 * FOUR SKILLS ARE DELIBERATELY NOT HERE, and the reason is the same for each:
 * their condition is a STATE OF THE WORLD rather than something somebody says,
 * so any pattern that matched it would be firing on a proxy. A proxy is an
 * invented moment, which is what the criterion above refuses.
 *
 * `voice-audit` — "copy is about to ship" is not an utterance; the nearest
 *   observable event is an edit carrying copy, and that detection is exactly
 *   what the skill's own body says does not exist.
 * `update-message` — "finished work has to reach people" is likewise a state,
 *   and a push is most often routine integration rather than an audience.
 * `contrast-audit` — it was cut in the repository this came from on
 *   2026-09-15 for the opposite reason: it DID route itself, and the word
 *   `contrast` opened it uninvited often enough that designers reported the
 *   audit as a rabbit hole. It is reached by name when a colour is actually
 *   being judged.
 * `model-and-effort` — `CLAUDE.md` names it at the point a rung is chosen,
 *   which is this router's job done in the place the condition occurs.
 *
 * The first two therefore KEEP their description in the listing; the last two
 * are `name-only` with a reacher that is not this file.
 */

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  try {
    const data = raw ? JSON.parse(raw) : {};
    if (data.hook_event_name === 'UserPromptSubmit') return moments(data);
    if (data.hook_event_name === 'PostToolUse') return surfaces(data);
    return quiet();
  } catch {
    quiet();
  }
});

function moments(data) {
  const prompt = typeof data.prompt === 'string' ? data.prompt : '';
  if (!prompt) return quiet();
  const hits = MOMENTS.filter((m) => m.terms.test(prompt) && fireOnce(data, m.skill));
  if (hits.length === 0) return quiet();
  say(
    hits
      .map(
        (m) =>
          `That prompt reads like ${m.what}. It is covered by ` +
          `.claude/skills/${m.skill}/SKILL.md, whose name is in your listing with no ` +
          `description, so Skill(${m.skill}) reaches it. This is a notice rather ` +
          `than a refusal, because a prompt cannot be refused; if the match is wrong, ` +
          `ignore it and carry on.`,
      )
      .join('\n\n'),
  );
}

/*
 * The tool entries: a skill whose condition is something a tool call DOES.
 * Kept out of MOMENTS, whose spec pairs every entry there with a prompt.
 *
 * `parity` keeps its description, which is what reaches it at intake; this is
 * the backstop for a session that reached the design system without it — the
 * first write in code or in Figma. A notice after the write, not a refusal
 * before it: which side a change belongs on is the person's answer, and one
 * side is sometimes it. This is the one described skill here, because its
 * moment is a tool call no description can observe.
 *
 * `component-rules` is no skill: it is a reading step, so it carries a `notice`
 * of its own. A component's rules live in code — its record in
 * `src/ds/guidance/records/` and the JSDoc on its props — and Figma's doc page
 * is a copy. Its moment is a Figma write that places an instance, the point at
 * which a screen is being built from the library.
 */

/* Plugin code that changes the file. A read leaves `fireOnce` unspent, so the
 * write after it still gets parity; a write through Object.assign stays quiet. */
const FIGMA_WRITE =
  /\b(create[A-Z]\w*|remove|appendChild|insertChild|set(?!CurrentPageAsync)[A-Z]\w*|resize\w*|clone|swapComponent|detachInstance|combineAsVariants)\s*\(|\.\w+\s*[-+]?=(?![=>])/;

const TOOL_MOMENTS = [
  {
    skill: 'parity',
    what: 'a write to the design system, which lives in code and in Figma',
    hit: (data) => {
      const tool = String(data.tool_name || '');
      const file = String((data.tool_input && data.tool_input.file_path) || '');
      const code = String((data.tool_input && data.tool_input.code) || '');
      return (/^(Edit|Write)$/.test(tool) && /[\\/]src[\\/]ds[\\/]/.test(file)) || (/^mcp__.+__use_figma$/.test(tool) && FIGMA_WRITE.test(code));
    },
  },
  {
    skill: 'component-rules',
    hit: (data) =>
      /^mcp__.+__use_figma$/.test(String(data.tool_name || '')) &&
      /\bcreateInstance\s*\(/.test(String((data.tool_input && data.tool_input.code) || '')),
    notice:
      'That call placed a component instance in Figma. Its rules live in code, not in ' +
      "Figma's doc page. For every component set this session places, the first time " +
      'it places one — this one and each set after it, and no set it does not use: ' +
      'find the record in src/ds/guidance/records/ whose figmaNode is that set, read ' +
      'its guidance and insteadOf, and the JSDoc on the props of its sourcePath. Check ' +
      'what was placed against them. This notice does not come back for the next set.',
  },
];

function surfaces(data) {
  const hits = TOOL_MOMENTS.filter((m) => m.hit(data) && fireOnce(data, m.skill));
  if (hits.length === 0) return quiet();
  say(
    hits
      .map(
        (m) =>
          m.notice ||
          `That call was ${m.what}. Unless the brief's Scope already names both ` +
          `sides, read .claude/skills/${m.skill}/SKILL.md (Skill(${m.skill}) reaches it) ` +
          `and ask the person which side this change belongs on.`,
      )
      .join('\n\n'),
    'PostToolUse',
  );
}

/**
 * True the first time an entry fires in a session, false afterwards.
 *
 * Fails OPEN in the direction of silence: if the store cannot be read the entry
 * fires, and if it cannot be written the entry may fire again. A duplicated
 * notice is cheap; a refusal that cannot be cleared is not, which is why the
 * write happens BEFORE the caller acts on the answer.
 */
function fireOnce(data, key) {
  const session = String(data.session_id || 'no-session').replace(/[^A-Za-z0-9_-]/g, '');
  const store = path.join(os.tmpdir(), `claude-skill-router-${session}.json`);
  let fired = {};
  try {
    fired = JSON.parse(fs.readFileSync(store, 'utf8'));
  } catch {
    /* first fire of the session, or a store we cannot read: start clean */
  }
  if (fired[key]) return false;
  fired[key] = true;
  try {
    sweepOnce(store, 'claude-skill-router-');
    fs.writeFileSync(store, JSON.stringify(fired));
  } catch {
    /* the entry will simply be able to fire again */
  }
  return true;
}

function say(text, event = 'UserPromptSubmit') {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: event, additionalContext: text },
      suppressOutput: true,
    }),
  );
}

function quiet() {
  process.stdout.write('');
}

module.exports = { MOMENTS, TOOL_MOMENTS };
