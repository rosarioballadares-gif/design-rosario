/**
 * The rules behind `pnpm check:env`, as pure functions.
 *
 * Split from the checker so they can be tested without a network, without a
 * token, and — the case that matters most — without the broken states they
 * exist to name. Nobody has a token that is deliberately left
 * un-authorized, so the `403` branch cannot be produced on a real machine. Here
 * it is one object literal.
 *
 * WHAT THIS IS FOR. The backlog has said "documented, not removed"
 * since the repository's first week, and names its own fix: "either fewer steps
 * or a check that names which one you are missing." The three steps are
 * organization membership, a classic token with `read:packages`, and SSO
 * authorization of that token — and the two ways they fail are a `401` and a
 * `403` that look equally like "it is broken" to somebody who has never seen
 * either. This module is the part that tells them apart.
 *
 * THE VERSIONS ARE A CACHE, AND CACHES GO STALE. Node and pnpm minimums are
 * stated in package.json and repeated here as numbers. When package.json
 * moves, this moves.
 */

/**
 * Node's accepted range: 22.12+. Vite 8 also takes 20.19+, but style-dictionary
 * needs 22, so 20.x and 21.x are rejected rather than waved through.
 *
 * @see package.json — `engines.node`, ">=22.12"
 */
export const NODE_RANGES = [{ major: 22, minor: 12 }];

/** pnpm's minimum. Major only: nothing here depends on a minor. */
export const PNPM_MINIMUM = { major: 10, minor: 0 };

/** The registry this repository's scope maps to, from .npmrc. */
export const REGISTRY_HOST = 'npm.pkg.github.com';

/**
 * Parses `v24.13.1`, `24.13.1` or `10.33.0` into numbers.
 * Returns null for anything that is not a version, which is what an absent
 * binary produces and is a different answer from an old one.
 */
export function parseVersion(raw) {
  const m = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(String(raw ?? ''));
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3] ?? 0) };
}

/**
 * Node against the accepted range: at or above its floor.
 */
export function checkNode(raw) {
  const v = parseVersion(raw);
  if (!v) return { state: 'missing', detail: 'not found on PATH' };

  const floor = [...NODE_RANGES].reverse().find((r) => v.major >= r.major);
  if (!floor) {
    return { state: 'too-old', detail: `${format(v)} — below ${NODE_RANGES[0].major}.${NODE_RANGES[0].minor}` };
  }
  if (v.major === floor.major && v.minor < floor.minor) {
    return {
      state: 'too-old',
      detail: `${format(v)} — ${floor.major}.x needs ${floor.major}.${floor.minor}`,
    };
  }
  return { state: 'ok', detail: format(v) };
}

/** pnpm against its floor. */
export function checkPnpm(raw) {
  const v = parseVersion(raw);
  if (!v) return { state: 'missing', detail: 'not found — `corepack enable` is usually enough' };
  if (v.major < PNPM_MINIMUM.major) {
    return { state: 'too-old', detail: `${format(v)} — needs ${PNPM_MINIMUM.major}` };
  }
  return { state: 'ok', detail: format(v) };
}

/**
 * Turns a failed `npm view` into the step of the chain that is missing.
 *
 * Takes what a process hands back — an exit code and its stderr — rather than
 * an npm error object, because that is what a script has and because npm's
 * wording has changed before while the codes have not.
 *
 * The `403` answer names two possible causes in the order they should be
 * checked, and that is deliberate. README.md attributes it to a token that is
 * not SSO-authorized, which is the common case, but somebody who was never
 * added to the organization gets the same code — and telling them only about
 * SSO sends them to a button that is not on their screen yet.
 */
export function classifyRegistry({ exitCode, stderr = '', stdout = '' }) {
  if (exitCode === 0) {
    const version = String(stdout).trim().split(/\s+/)[0];
    return { state: 'ok', step: null, detail: version ? `${version} readable` : 'readable' };
  }

  const text = `${stderr}\n${stdout}`;
  const code = /code (E\d{3})/.exec(text)?.[1] ?? statusFallback(text);

  switch (code) {
    case 'E401':
      return {
        state: 'blocked',
        step: 'token',
        detail: '401 — no token. The registry never saw a credential',
      };
    case 'E403':
      return {
        state: 'blocked',
        step: 'sso',
        detail:
          '403 — a token arrived and was refused. Either you are not in the organization that owns the scope yet, or the token is not SSO-authorized for it',
      };
    case 'E404':
      return {
        state: 'blocked',
        step: 'scope',
        detail: `404 — the private scope is not pointing at ${REGISTRY_HOST}`,
      };
    default:
      if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network|getaddrinfo/i.test(text)) {
        return { state: 'unknown', step: 'network', detail: 'the registry was unreachable' };
      }
      return { state: 'unknown', step: null, detail: firstLine(text) || `exit ${exitCode}` };
  }
}

/**
 * Finds a token written into a tracked .npmrc.
 *
 * This is the one row here that reports a problem the person did not have
 * before they tried to fix another one. README.md says the repository's .npmrc
 * deliberately holds no token because pnpm would read one from there and the
 * file is committed — so the natural fix for a 401, pasting the token where the
 * scope mapping already is, publishes the credential to everyone with the repo.
 * It fails nothing and it renders nothing. Only a check finds it.
 */
export function findTokenInRepoNpmrc(text) {
  const line = String(text ?? '')
    .split(/\r?\n/)
    .find((l) => /_authToken\s*=\s*\S/.test(l) && !/^\s*[#;]/.test(l));
  return line ? { state: 'leak', detail: 'a token is written into the tracked .npmrc' } : null;
}

/**
 * States that stop somebody from running this repository at all.
 *
 * `todo` is deliberately not among them. An unwritten
 * profile are the next thing to do, not a broken machine, and a report that
 * files them under the same word as an unreadable registry teaches people to
 * skim the word.
 */
export const BLOCKING = new Set(['blocked', 'too-old', 'missing']);

/**
 * A browser check needs a Chromium, and nothing said so until one of
 * them went red.
 *
 * `todo` and not `missing`: a person who never touches a chart or a card is not
 * blocked by this, and `BLOCKING` is what `--strict` exits on.
 */
export function classifyBrowser(found) {
  return found
    ? { state: 'ok', detail: `${found} — a check that reads a rendered page can run` }
    : {
        state: 'todo',
        detail:
          'none found — run npx playwright install chromium, or set CHROME_PATH. ' +
          'Until then check:chart-render and check:chart-capture cannot run ' +
          'here, and neither can pnpm gate',
      };
}

/**
 * The value the setup skill's role question resolves to when it could not name
 * somebody.
 *
 * It is a member of the offered union, which is what made it worth separating:
 * a plain membership test reads it as an answered question.
 */
export const UNNAMED_ROLE = 'other';

/**
 * Whether the role a profile records is still one the setup skill offers.
 *
 * Three outcomes, and the middle one is the reason this function exists. Until
 * 2026-09-09 the rule was `offered.includes(role)`, and `other` is in `offered`
 * — so the value meaning "the skill could not name you" returned `ok` from the
 * one row a person runs to ask whether their role is right. Every manager who
 * ran the skill before it named the three manager roles is stored that way,
 * which made the population this row is most useful to the population it told
 * nothing.
 *
 * It returns `todo` rather than a failure, because `other` is a legitimate
 * final answer for somebody whose role genuinely is not in the list. The hedge
 * in its wording is lifted from the unlisted-slug branch below, which had
 * already solved the same objection in the same function.
 *
 * Pure, so the spec can reach it. The profile and skill reads stay in
 * `check-env.mjs` — that split is the only reason this defect outlived the 37
 * assertions sitting beside it.
 */
export function classifyRole(role, offered = []) {
  if (!role) return { state: 'todo', detail: 'the profile records no role — rerun /setup' };

  if (role === UNNAMED_ROLE) {
    const named = offered.filter((r) => r !== UNNAMED_ROLE).length;
    return {
      state: 'todo',
      detail:
        `${role} · the slot for a role the skill could not name. It names ${named} now — ` +
        `rerun /setup if one of them fits, legitimate if none does`,
    };
  }

  if (offered.includes(role)) {
    return { state: 'ok', detail: `${role} · one of the ${offered.length} the skill offers` };
  }

  return {
    state: 'todo',
    detail: `${role} · the skill does not list it. Legitimate if you named it yourself, stale otherwise`,
  };
}

/**
 * The exit code for a whole run.
 *
 * A leak exits non-zero on its own, because a published credential is worse
 * than an unusable checkout. Everything else is advisory when the person is
 * mid-setup — which is the state this command is written for — so `strict`
 * turns the blocking rows into failures for CI.
 */
export function summarise(rows, { strict = false } = {}) {
  const leaked = rows.some((r) => r.state === 'leak');
  const blocked = rows.filter((r) => BLOCKING.has(r.state));
  const next = rows.filter((r) => r.state === 'todo');
  return {
    exitCode: leaked || (strict && blocked.length) ? 1 : 0,
    leaked,
    blocked: blocked.map((r) => r.label),
    next: next.map((r) => r.label),
  };
}

/** The state word each row prints. */
export const STATE_WORDS = {
  ok: 'ok',
  blocked: 'BLOCKED',
  'too-old': 'TOO OLD',
  missing: 'MISSING',
  leak: 'LEAK',
  todo: 'next',
  unknown: 'unknown',
  skipped: 'not read',
};

/**
 * Renders the rows as a table.
 *
 * Returns lines rather than printing them, so a test can read the output
 * instead of capturing a stream. Both columns size to their contents — a fixed
 * width was tried first and `not read` ran into the label beside it.
 */
export function formatReport(rows) {
  const word = (r) => STATE_WORDS[r.state] ?? r.state;
  const stateWidth = Math.max(...rows.map((r) => word(r).length), 0);
  const labelWidth = Math.max(...rows.map((r) => r.label.length), 0);
  return rows.map((r) => {
    return `  ${word(r).padEnd(stateWidth)}  ${r.label.padEnd(labelWidth)}  ${r.detail ?? ''}`.trimEnd();
  });
}

function format(v) {
  return `${v.major}.${v.minor}.${v.patch}`;
}

function firstLine(text) {
  return String(text)
    .split(/\r?\n/)
    .map((l) => l.replace(/^npm (error|ERR!)\s*/, '').trim())
    .find((l) => l.length > 0);
}

/** npm has printed the bare status without a code before; this is the fallback. */
function statusFallback(text) {
  const m = /\b(401|403|404)\b/.exec(text);
  return m ? `E${m[1]}` : null;
}
