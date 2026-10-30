/**
 * Names the step of the setup chain that is missing, instead of leaving
 * somebody with a `403` and a guess.
 *
 * BACKLOG.md section 8 has read "documented, not removed" since the first week:
 * getting `pnpm install` to succeed takes organization membership, a classic
 * token with `read:packages`, and SSO authorization of that token — three
 * steps, each failing with a code that does not explain itself. README.md
 * spells the chain out, and a document is the mitigation rather than the fix.
 * This is the fix the same section asks for.
 *
 * WHAT IT DOES NOT DO. It changes nothing. Every remedy is a line somebody
 * pastes themselves, because the one thing missing here is usually a credential
 * and a script that writes a credential is a script nobody should run on a
 * machine they did not set up.
 *
 * WHAT IT CANNOT SEE, said out loud in its own output. Whether any MCP server
 * answers. Those authenticate through the agent harness,
 * not through this process, so `/setup` probes them by calling one of their
 * tools and this command reports that it did not. A check that quietly skipped
 * them would read as a check that passed them.
 *
 * Nor whether the roles the setup skill lists are the teams the organization
 * actually has. Nothing here reads an org chart. The `your role` row compares
 * your profile against that list and says nothing about whether the list is
 * current.
 *
 * The rules live in env-checks.mjs, tested without a network. This file is the
 * part that needs one.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkNode,
  checkPnpm,
  classifyBrowser,
  classifyRegistry,
  classifyRole,
  findTokenInRepoNpmrc,
  formatReport,
  summarise,
} from './env-checks.mjs';
import { unionSlugs } from './role-list.mjs';
import { findChrome } from './browser.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STRICT = process.argv.includes('--strict');
/**
 * The private scope this repository installs from, READ from `.npmrc` rather
 * than typed here — a literal would name a registry that may not be this
 * project's. No `.npmrc` means no private scope, and the registry rows below
 * are skipped rather than failed: a check that cannot run is not a check that
 * passed, but there is nothing here to run.
 */
const NPMRC = join(ROOT, '.npmrc');
const PROFILE = join(ROOT, '.claude', 'profile.local.json');
const ROLE_SKILL = join(ROOT, '.claude', 'skills', 'setup', 'SKILL.md');

/** Remedies, keyed by the step classifyRegistry names. Each one is a thing to do, not a diagnosis. */
const REMEDIES = {
  token:
    'Put the token in your USER .npmrc, never this one:\n' +
    '      //<the registry host>/:_authToken=<your token>',
  sso:
    'Join the organization that owns the scope first, then authorize the\n' +
    '      token for it: on the token page, Configure SSO, Authorize.',
  scope: 'Check that .npmrc still maps the scope at the host it publishes to.',
  network: 'Nothing to fix here — the registry was unreachable. Try again on a working connection.',
};

function run(command, args) {
  const r = spawnSync(command, args, { encoding: 'utf8', shell: true, timeout: 60_000 });
  return { exitCode: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function read(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

const rows = [];

/* ------------------------------------------------------------- runtimes --- */

rows.push({ label: 'node', ...checkNode(process.version) });
rows.push({ label: 'pnpm', ...checkPnpm(run('pnpm', ['--version']).stdout) });

/**
 * Whether the pnpm actually running is the one this repository names.
 *
 * The row above is a FLOOR, and a floor said `ok` to somebody for whom every
 * command exited 1. Measured 2026-09-08 on a fresh clone: pnpm 11 turned
 * `strictDepBuilds` on by default, and with no allowlist declared an ignored
 * esbuild postinstall stopped `install`, `dev`, `build`, `lint` and `test:run`
 * alike. This command printed `ok pnpm` and `every step this command can see
 * is in place` over all of it, because nothing here had ever compared the
 * running version against the one the deploy uses.
 *
 * `packageManager` now closes that, and pnpm honours it by fetching the named
 * version itself. So this row is normally `ok` and its job is to be legible on
 * the day it is not — when corepack is off and a pnpm too old to read the field
 * is running, which is the one shape that still slips through.
 */
const pinned = (() => {
  try {
    return JSON.parse(read(join(ROOT, 'package.json'))).packageManager ?? null;
  } catch {
    return null;
  }
})();
const runningPnpm = run('pnpm', ['--version']).stdout.trim();

rows.push({
  label: 'pnpm pin',
  ...(!pinned
    ? { state: 'todo', detail: 'package.json names no version, so every machine picks its own' }
    : pinned === `pnpm@${runningPnpm}`
      ? { state: 'ok', detail: `${pinned} — the version CI and the deploy run` }
      : {
          state: 'todo',
          detail: `running ${runningPnpm || 'an unknown version'}, this repo names ${pinned}. Run corepack enable so pnpm fetches it`,
        }),
});


/* ------------------------------------------------------- the credential --- */

/*
 * The private scope is READ from `.npmrc` rather than named here, because a
 * literal would name a registry that may not be this project's.
 *
 * NO `.npmrc` MEANS NO PRIVATE SCOPE, and both rows below are then skipped
 * rather than failed. That is the one place in this report where skipping is
 * right: there is nothing to run, as opposed to something that could not run.
 */
const npmrc = read(NPMRC);
const scope = /^(@[^:\s]+):registry=(\S+)/m.exec(npmrc);

/** `null` when there is no private scope, which the remedy block below reads. */
let registry = null;

if (!scope) {
  rows.push({
    label: 'private registry',
    state: 'skipped',
    detail: 'no .npmrc, so this project installs only from the public registry',
  });
} else {
  const leak = findTokenInRepoNpmrc(npmrc);
  rows.push({
    label: 'repo .npmrc',
    ...(leak ?? { state: 'ok', detail: `maps ${scope[1]} and holds no token, which is correct` }),
  });

  /*
   * Probed with the scope itself rather than a package name. `npm view` on a
   * bare scope answers with the same E401/E403/E404 the classifier reads, and
   * it needs no literal package that could be renamed or dropped.
   */
  registry = classifyRegistry(run('npm', ['view', `${scope[1]}/${scope[1].slice(1)}`, 'version']));
  rows.push({ label: 'the registry', state: registry.state, detail: registry.detail, step: registry.step });
}

/* ---------------------------------------------------------- the install --- */

const installed = existsSync(join(ROOT, 'node_modules', '.pnpm'));
rows.push({
  label: 'the install',
  state: installed ? 'ok' : 'missing',
  detail: installed ? 'node_modules is populated' : 'not installed — run pnpm install',
});

let browser = null;
try {
  browser = findChrome();
} catch {
  /* the resolver throws when it finds nothing, and nothing is a row here */
}
rows.push({ label: 'a browser', ...classifyBrowser(browser) });

/* ------------------------------------------------- what needs a harness --- */

const declared = Object.keys(JSON.parse(read(join(ROOT, '.mcp.json')) || '{}').mcpServers ?? {});
rows.push({
  label: 'MCP servers',
  state: 'skipped',
  detail: `this repo declares ${declared.join(', ') || 'none'} · an MCP server answers to the agent, not to this process`,
});

/* ------------------------------------------------------------- the person --- */

rows.push({
  label: 'your profile',
  state: existsSync(PROFILE) ? 'ok' : 'todo',
  detail: existsSync(PROFILE)
    ? '.claude/profile.local.json — this workspace knows who you are'
    : 'none yet — run /setup in Claude Code and this workspace will know how you work',
});

/**
 * Whether the role your profile records is still one the setup skill offers.
 *
 * ADVISORY, like every row here, and deliberately not one of the blocking
 * states: nothing installs or breaks because of it, and `--strict` is passed by
 * nothing today, so this cannot fail a run. Calling it the thing that keeps the
 * list current would be an overclaim — no script here can see an org chart.
 *
 * It earns a row for a narrower reason. `/setup` writes the profile FROM the
 * skill's own list, so an agent following the skill can only record a value the
 * list already holds. This fires on a hand edit, or on a profile written before
 * the list changed and never rerun.
 *
 * It is also the first read of that file anywhere here that PARSES it. The row
 * above calls existsSync and nothing more, so a corrupt profile reports a clean
 * `ok` there, and the session-start hook swallows the same parse error in a
 * script that exits 0 always. A profile that cannot be read now says so.
 */
const offered = unionSlugs(read(ROLE_SKILL));

function roleRow() {
  if (!offered.length) {
    return { state: 'unknown', detail: "the skill's own list did not parse — run node scripts/check-role-list.mjs" };
  }
  if (!existsSync(PROFILE)) {
    return { state: 'todo', detail: `no profile yet · the skill offers ${offered.length}` };
  }
  let profile;
  try {
    profile = JSON.parse(read(PROFILE));
  } catch {
    return { state: 'unknown', detail: 'the profile is there and does not parse — rerun /setup' };
  }
  // The decision itself lives in env-checks.mjs so the spec can reach it. What
  // stays here is the reading, which is the half a test cannot have.
  return classifyRole(profile?.role, offered);
}

rows.push({ label: 'your role', ...roleRow() });

/* ---------------------------------------------------------------- report --- */

console.log('');
console.log(`Environment for this repository · ${STRICT ? 'strict' : 'advisory'}`);
console.log('');
for (const line of formatReport(rows)) console.log(line);
console.log('');

const remedy = registry ? REMEDIES[registry.step] : undefined;
if (remedy) {
  console.log('  The registry is the one that stops everything. To fix it:');
  console.log(`      ${remedy}`);
  console.log('');
  console.log('  The whole chain, in order, is in .claude/skills/setup/WIRING.md');
  console.log('');
}

const { exitCode, leaked, blocked, next } = summarise(rows, { strict: STRICT });

if (leaked) {
  console.error('FAIL — a token is written into the repository\'s own .npmrc.');
  console.error('  That file is tracked by git, so the credential is shared with everyone');
  console.error('  who has the repo. Remove the line, move it to your user .npmrc, and');
  console.error('  revoke the token on GitHub. It has to be assumed public.');
  console.error('');
} else if (blocked.length) {
  console.log(`Blocked: ${blocked.join(', ')}. Nothing installs until that reads.`);
  console.log('');
} else {
  console.log('OK — every step this command can see is in place.');
  console.log('  It did not read any MCP server. /setup does that.');
  console.log('');
}

if (next.length) {
  console.log(`Next: ${next.join(', ')}. Neither stops you working today.`);
  console.log('');
}

process.exit(exitCode);
