/**
 * Measures the standing per-call floor and fails when a part crosses its
 * ceiling.
 *
 * The rules live in `context-floor.mjs`, which has its own spec and reads no
 * file; the ceilings live in `context-floor.json`; this file is the read, the
 * scope floor and the exit code — the same three-way split the skills table,
 * the brief fields and the claim registry all use.
 *
 * **NO BASELINE AND NO `--write-baseline`.** See the header of
 * `context-floor.mjs`. The ceiling is raised by hand, with a date and a
 * sentence, which is the point rather than the friction.
 *
 * **WHAT IT CANNOT SEE, printed on every run.** The MCP tool definitions, which
 * `--mcp` measures on demand rather than every run, because measuring them
 * means spawning a server over `npx`. The harness's own system
 * prompt. Anything a hook prints at session start, which is read from a file
 * that is not versioned. And — the one that matters most — whether the rules
 * inside CLAUDE.md are any good. A 3.000-token CLAUDE.md that lets an agent
 * ship the wrong screen is cheaper and worse, and this check would call it an
 * improvement.
 */
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ceilingTotal,
  findings,
  floorFailures,
  measure,
  tokens,
  CHARS_PER_TOKEN,
} from './context-floor.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLAUDE_PATH = 'CLAUDE.md';
const SKILLS_PATH = '.claude/skills';
const SETTINGS_PATH = '.claude/settings.json';
const BUDGET_PATH = 'scripts/context-floor.json';

const CANNOT_SEE =
  'the MCP tool definitions on its own — run it with --mcp for\n' +
  '  those, and note that a deny does not remove them. Nor the harness system\n' +
  '  prompt, nor whatever a session-start hook prints from a file that is not\n' +
  '  versioned. It also cannot see whether the rules inside CLAUDE.md are worth\n' +
  '  their tokens, which is the only question that actually matters and the one\n' +
  '  no check can answer.';

/**
 * Any read error at all exits 1.
 *
 * A rename, a sparse checkout or a permission error all mean this could not
 * read what it was asked to read, and reporting green over that is the failure
 * every sibling check here has a paragraph about.
 */
function read(relative, reader) {
  try {
    return reader(join(ROOT, relative));
  } catch (error) {
    console.error(`FAIL — could not read ${relative}.`);
    console.error(`  ${error.message}`);
    process.exit(1);
  }
}

const claudeText = read(CLAUDE_PATH, (p) => readFileSync(p, 'utf8'));
const budget = read(BUDGET_PATH, (p) => JSON.parse(readFileSync(p, 'utf8')));

/* Directories only. A stray file in there is not a skill and must not read as
 * one — the same read `check-skills-table.mjs` makes, for the same reason. */
const names = read(SKILLS_PATH, (p) =>
  readdirSync(p, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name),
);

/* Two mechanisms hide a skill from the listing and neither can be read from the
 * other's file: `disable-model-invocation` in the skill's own frontmatter, and
 * `skillOverrides` in settings. Reading only one reports on the wrong set. */
const overrides = (() => {
  try {
    return JSON.parse(readFileSync(join(ROOT, SETTINGS_PATH), 'utf8')).skillOverrides ?? {};
  } catch {
    return {};
  }
})();

const skills = names.map((name) => {
  let body = '';
  try {
    body = readFileSync(join(ROOT, SKILLS_PATH, name, 'SKILL.md'), 'utf8');
  } catch {
    /* a skill directory with no SKILL.md is check:skills-table's business */
  }
  const described = /^description:\s*(.*)$/m.exec(body);
  return {
    name,
    description: described ? described[1] : '',
    hidden: /^disable-model-invocation:\s*true\s*$/m.test(body),
    nameOnly: overrides[name] === 'name-only',
  };
});

const measured = measure({ claudeText, skills });

console.log(`Read the standing floor: ${CLAUDE_PATH} and the listing of ${SKILLS_PATH}/.`);
console.log(
  `  ${measured.listed} skill(s) reach the listing, of ${measured.onDisk} on disk. ` +
    `Bytes at ${CHARS_PER_TOKEN} characters a token.`,
);
console.log(`  Ceilings set ${budget.set ?? '(undated)'} in ${BUDGET_PATH}.`);

/* The floor before the findings, because two empty measurements compare equal
 * and a run that read nothing is under every ceiling ever written. */
const unmeasured = floorFailures(measured, budget);
if (unmeasured.length) {
  console.error('\nFAIL — nothing was compared, so this run measured nothing.');
  for (const line of unmeasured) console.error(`  ${line}`);
  console.error('\n  This is a read or a budget failure rather than an overrun. A floor');
  console.error('  check that exits 0 having measured nothing is the exact shape of the');
  console.error('  problem it was written for.');
  process.exit(1);
}

for (const [part, spent] of Object.entries(measured.parts)) {
  const ceiling = budget.budget[part];
  const room = ceiling - spent;
  console.log(
    `  ${part.padEnd(15)} ${String(spent).padStart(6)} tokens  ceiling ${String(ceiling).padStart(6)}  ` +
      (room >= 0 ? `${room} to spare` : `OVER by ${-room}`),
  );
}
console.log(
  `  ${'TOTAL'.padEnd(15)} ${String(measured.total).padStart(6)} tokens  ceiling ${String(ceilingTotal(budget)).padStart(6)}  paid on every call`,
);

const found = findings(measured, budget);
if (found.length) {
  console.error(`\nFAIL — ${found.length} part(s) of the floor over budget.`);
  for (const line of found) console.error(`  ${line}`);
  console.error('\n  Cut something, or raise the ceiling in scripts/context-floor.json with');
  console.error('  today’s date and the sentence that justifies it. Both are legitimate.');
  console.error('  Raising it silently is not, and is why this check exists: CLAUDE.md grew');
  console.error('  from 13.734 bytes to 81.799 over 27 days without one thing objecting.');
  process.exit(1);
}

/**
 * The MCP tool definitions, measured rather than estimated, and only when asked.
 *
 * This is the one part of the floor that cannot be read off disk: what the
 * harness injects is whatever the servers in `.mcp.json` answer `tools/list`
 * with — name, description and input schema — so measuring it means starting
 * them. That costs an `npx` boot and a network, which is why it is a flag and
 * not part of every run, and why the number in `context-floor.json` carries the
 * date it was taken.
 *
 * It measures only what `.mcp.json` declares. A connector wired into a person's
 * own client is real cost and is not this repository's to hold a ceiling over.
 */
async function measureMcp(command, args) {
  const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'], shell: true });
  let buf = '';
  const pending = new Map();

  child.stdout.on('data', (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id && pending.has(msg.id)) {
          pending.get(msg.id)(msg);
          pending.delete(msg.id);
        }
      } catch {
        // npx chatter on a cold cache. Not a JSON-RPC frame, so not ours.
      }
    }
  });

  const send = (id, method, params) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${command} did not answer ${method} within 60s.`));
      }, 60_000);
      pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });

  try {
    await send(1, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'context-floor', version: '1' },
    });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const listed = await send(2, 'tools/list', {});
    const list = listed.result?.tools ?? [];
    return { tools: list.length, tokens: tokens(JSON.stringify(list).length) };
  } finally {
    child.kill();
  }
}

if (process.argv.includes('--mcp')) {
  const servers = read('.mcp.json', (p) => JSON.parse(readFileSync(p, 'utf8'))).mcpServers ?? {};
  const recorded = budget.mcp ?? {};
  console.log(
    `\n  MCP tool definitions, measured now over the ${Object.keys(servers).length} server(s) .mcp.json declares:`,
  );
  let mcpTotal = 0;
  for (const [name, spec] of Object.entries(servers)) {
    const got = await measureMcp(spec.command, spec.args ?? []);
    mcpTotal += got.tokens;
    const was = recorded.servers?.[name];
    const note = was ? `  recorded ${was.tokens} on ${recorded.measured}` : '  NOT RECORDED';
    console.log(`  ${name.padEnd(15)} ${String(got.tokens).padStart(6)} tokens over ${got.tools} tool(s)${note}`);
  }
  console.log(
    `  ${'TOTAL'.padEnd(15)} ${String(mcpTotal).padStart(6)} tokens  ceiling ${recorded.ceiling ?? '(none)'}`,
  );
  if (recorded.ceiling && mcpTotal > recorded.ceiling) {
    console.error(`\nFAIL — the MCP floor is ${mcpTotal} tokens against a ceiling of ${recorded.ceiling}.`);
    console.error('  A server added to .mcp.json is paid on every call by everyone who clones,');
    console.error('  which makes it the same kind of edit as a section added to CLAUDE.md.');
    process.exit(1);
  }
  console.log('  A connector wired into your own client is not measured here and is not');
  console.log('  this repository\'s to hold a ceiling over. It is still paid.');
}

console.log('\nOK — every part of the standing floor is inside its ceiling.');
console.log(`  It cannot see ${CANNOT_SEE}`);
