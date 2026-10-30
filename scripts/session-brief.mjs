/**
 * The first line of every session in this repository: who is using it.
 *
 * Wired as a SessionStart hook in .claude/settings.json, whose output the
 * harness injects as session context. Without it, `/setup` only ever runs when
 * somebody remembers to type it — and the people this repository is being handed
 * to are product managers, product designers and design managers who have never
 * seen it, for whom "there is a skill you should run" is exactly the kind of
 * thing nobody says in time. So when the client or the person is not recorded,
 * the notice tells the AGENT to start `/setup` on the first message; which
 * layers are owed is decided in `session-brief-rules.mjs`, which has a spec.
 *
 * THIS EXITS 0, ALWAYS. A hook that fails is a hook that greets somebody's first
 * session with an error about a file they have never heard of. Every read here
 * is guarded and every failure degrades to the notice, which is the message a
 * broken profile deserves anyway.
 *
 * IT STAYS SHORT ON PURPOSE. This text is loaded into every session in this
 * repository, forever. Anything that is merely nice to know belongs in a
 * document the agent can go and read.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { owedLayers, setupNotice } from './session-brief-rules.mjs';
import { daysSinceNewest } from './snapshot-rules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROFILE = join(ROOT, '.claude', 'profile.local.json');
const WINDOWS = join(ROOT, 'metrics', 'windows.json');
const WIRING = join(ROOT, 'docs', 'foundation', 'workspace-wiring.md');
const BRIEFS = join(ROOT, 'briefs');

/** Days of silence before the snapshot is worth a line.
 *
 * Three, because the retained window measured six days on 2026-09-12 and half
 * of it is the margin. Higher and the nudge arrives after the day it would have
 * saved; lower and it is noise in a week nobody worked. */
const STALE_AFTER = 3;

/**
 * One line when `pnpm snapshot` has not run for a while, and silence otherwise.
 *
 * Silent when there is no store at all: somebody who cloned this and never runs
 * the cost tools should not be greeted by a chore they have no use for. Silent
 * on anything unreadable, for the same reason this whole file exits 0.
 */
function snapshotNudge() {
  try {
    const days = Object.keys(JSON.parse(readFileSync(WINDOWS, 'utf8')));
    const gap = daysSinceNewest(days, new Date().toISOString().slice(0, 10));
    if (gap === null || gap <= STALE_AFTER) return null;
    return `The last \`pnpm snapshot\` was ${gap} days ago — the cost and routing window keeps about six.`;
  } catch {
    return null;
  }
}

function load() {
  try {
    const parsed = JSON.parse(readFileSync(PROFILE, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The short board of peers — other worktrees, other sessions — or nothing.
 *
 * The hook's stdin names this session (`session_id`, `cwd`) and its parent pid
 * is this session's, so the board leaves it out; a terminal is never read,
 * since it would wait for input. git and the session registry only, never the
 * process table: the hook has 10 seconds and every session waits on it. Silent
 * on any failure, for the reason this whole file exits 0.
 */
async function peersBoard() {
  try {
    const input = process.stdin.isTTY ? {} : JSON.parse(readFileSync(0, 'utf8') || '{}');
    const { collect, selfOf, shortBoard } = await import('./peers.mjs');
    const self = selfOf(input);
    return shortBoard(collect({ cwd: self.cwd, full: false }), self);
  } catch {
    return [];
  }
}

/** A file's text, or null when it cannot be read. */
function readOrNull(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/** The names under briefs/, or none when it cannot be read. */
function briefNames() {
  try {
    return readdirSync(BRIEFS);
  } catch {
    return [];
  }
}

/** This checkout's `origin` URL, or null when there is none. */
function origin() {
  try {
    return execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim();
  } catch {
    return null;
  }
}

const profile = load();
const peers = await peersBoard();
const owed = owedLayers({ hasProfile: Boolean(profile), wiringText: readOrNull(WIRING), briefNames: briefNames(), origin: origin() });
const setup = setupNotice(owed);

if (!profile) {
  console.log([setup, ...peers].filter(Boolean).join('\n'));
  process.exit(0);
}

/** Prints `label: value` only when there is a value, so an unanswered field says nothing. */
const line = (label, value) => (value ? `${label}: ${value}` : null);

const out = [
  line('Who', [profile.name, profile.role].filter(Boolean).join(', ') || null),
  line('Product', profile.product),
  line('Speak', profile.language),
  line('Writes code', profile.writesCode === undefined ? null : profile.writesCode ? 'yes' : 'no — compose and review only'),
  line('Code', profile.code?.state === 'ready' ? 'ready' : `not ready — ${profile.code?.detail ?? 'see /setup'}`),
  line('Figma', profile.figma?.state),
  line('Tracker', profile.tracker?.kind === 'none' ? 'none' : [profile.tracker?.kind, profile.tracker?.projectKey].filter(Boolean).join(' ') || null),
].filter(Boolean);

const open = Array.isArray(profile.open) ? profile.open.length : 0;

console.log(
  [
    `Workspace profile, recorded ${profile.recorded ?? 'at an unknown date'}:`,
    ...out.map((l) => `  ${l}`),
    open ? `  Open questions: ${open} — read .claude/profile.local.json` : null,
    'Read it before offering work this person cannot do. Rerun /setup when anything changes.',
    setup,
    owed.spec ? `Client spec: briefs/${owed.spec} — its tasks are in backlog/00-client.md.` : null,
    snapshotNudge(),
    ...peers,
  ]
    .filter(Boolean)
    .join('\n'),
);
