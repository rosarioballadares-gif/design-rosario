#!/usr/bin/env node
/**
 * Launching a Chromium and speaking CDP to it.
 *
 * WHY IT IS ITS OWN FILE. It lived inside `stacked-gaps.mjs`, which four other
 * scripts imported for the plumbing rather than for the check. That file was
 * deleted on 2026-09-12 and the plumbing moved here verbatim — the
 * checks that remain speak CDP directly, with no `playwright` dependency at
 * runtime, and that is deliberate: the browser is a binary this fetches, not a
 * library this builds against.
 *
 * `findChrome` THROWS when nothing resolves. A check that could not run is not
 * a check that passed, and every caller here is a check.
 */
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Where Playwright parks the browsers `npx playwright install chromium` fetches.
 *
 * The only Chromium a machine can acquire from a command line with no Homebrew
 * and no installer, which is the case this was written for.
 */
function playwrightCache() {
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA;
    return local ? join(local, 'ms-playwright') : null;
  }
  const home = homedir();
  if (!home) return null;
  return process.platform === 'darwin'
    ? join(home, 'Library', 'Caches', 'ms-playwright')
    : join(home, '.cache', 'ms-playwright');
}

/**
 * The binary inside one `chromium-<build>` directory, across the layouts
 * Playwright has shipped.
 *
 * **Not a glob, and the reason is the name.** The current mac build is
 * `chrome-mac-arm64/Google Chrome for Testing.app`, the older one is
 * `chrome-mac/Chromium.app`, and both are addressed by a literal once the build
 * number is off the front. `chromium_headless_shell-<build>` is deliberately
 * NOT read: these checks launch with `--headless=new`, which is a flag for the
 * full browser.
 */
const PLAYWRIGHT_BINARIES = [
  'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
  'chrome-linux/chrome',
  'chrome-win/chrome.exe',
];

/**
 * Every Playwright chromium on this machine, newest build first.
 *
 * Sorted NUMERICALLY on the build: `chromium-1243` and `chromium-987` sort the
 * wrong way as strings, and the wrong way means an old browser silently
 * answering for a new one.
 */
function playwrightChromes(cache = playwrightCache()) {
  if (!cache) return [];
  let entries = [];
  try {
    entries = readdirSync(cache);
  } catch {
    /* no cache on this machine: the literals below are the whole answer */
    return [];
  }
  return entries
    .map((name) => /^chromium-(\d+)$/.exec(name))
    .filter(Boolean)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .flatMap((m) => PLAYWRIGHT_BINARIES.map((rel) => join(cache, m[0], ...rel.split('/'))))
    .filter((p) => existsSync(p));
}

/** Chrome, wherever this machine keeps it. `CHROME_PATH` wins. */
function findChrome() {
  const named = process.env.CHROME_PATH;
  if (named) return named;
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  const found = candidates.find((p) => existsSync(p)) ?? playwrightChromes()[0];
  if (!found) {
    throw new Error(
      'No Chrome found. Set CHROME_PATH to the binary, or run\n' +
        '  npx playwright install chromium\n' +
        'Looked in:\n  ' +
        candidates.join('\n  ') +
        '\n  ' +
        (playwrightCache() ?? '(no Playwright cache path for this platform)'),
    );
  }
  return found;
}

/**
 * A Chrome DevTools Protocol client over the WebSocket Node 22+ ships as a
 * global. No dependency, which is the same argument the other checks here
 * makes for importing only builtins: this has to run on a box that has not
 * installed from a private registry.
 */
class Cdp {
  #ws;
  #next = 1;
  #pending = new Map();
  #handlers = new Map();
  #dead = null;

  static async connect(url) {
    const cdp = new Cdp();
    cdp.#ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      cdp.#ws.addEventListener('open', resolve, { once: true });
      cdp.#ws.addEventListener('error', () => reject(new Error(`CDP refused ${url}`)), {
        once: true,
      });
    });
    cdp.#ws.addEventListener('message', (event) => cdp.#receive(String(event.data)));
    // **A dead socket has to reject, not go quiet.** Without these, a Chrome
    // that crashes mid-crawl leaves every pending promise unsettled and the
    // process simply stops — which in CI is not a failure, it is a job that
    // hangs to the runner's six-hour limit and reports nothing about why.
    const die = (why) => cdp.#fail(new Error(`CDP connection ${why}`));
    cdp.#ws.addEventListener('close', () => die('closed'), { once: true });
    cdp.#ws.addEventListener('error', () => die('errored'), { once: true });
    return cdp;
  }

  /** Reject everything still in flight. Idempotent — a close after an error. */
  #fail(error) {
    this.#dead = error;
    for (const waiting of this.#pending.values()) waiting.reject(error);
    this.#pending.clear();
  }

  #receive(raw) {
    const msg = JSON.parse(raw);
    if (msg.id !== undefined) {
      const waiting = this.#pending.get(msg.id);
      if (!waiting) return;
      this.#pending.delete(msg.id);
      if (msg.error) waiting.reject(new Error(`${msg.error.message} (${msg.error.code})`));
      else waiting.resolve(msg.result);
      return;
    }
    const list = this.#handlers.get(msg.method);
    if (list) for (const fn of list.splice(0)) fn(msg.params, msg.sessionId);
  }

  /**
   * One command, with a deadline.
   *
   * The timeout is the second half of the same argument as `#fail`: a browser
   * that is alive but wedged — a page that never fires `load`, an evaluate that
   * never settles — leaves this waiting forever with a healthy socket. Both
   * failure modes have to end in a non-zero exit and a sentence, because a
   * check that hangs is indistinguishable from a check that is slow.
   */
  send(method, params = {}, sessionId, timeoutMs = 120_000) {
    if (this.#dead) return Promise.reject(this.#dead);
    const id = this.#next++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => {
          this.#pending.delete(id);
          reject(new Error(`CDP ${method} did not answer within ${timeoutMs}ms`));
        },
        timeoutMs,
      );
      const settle = (fn) => (value) => {
        clearTimeout(timer);
        fn(value);
      };
      this.#pending.set(id, { resolve: settle(resolve), reject: settle(reject) });
      this.#ws.send(JSON.stringify(payload));
    });
  }

  /** Resolves on the next occurrence of `method`. One-shot, by design. */
  once(method, timeoutMs = 120_000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`CDP event ${method} never arrived within ${timeoutMs}ms`)),
        timeoutMs,
      );
      const list = this.#handlers.get(method) ?? [];
      list.push((params) => {
        clearTimeout(timer);
        resolve(params);
      });
      this.#handlers.set(method, list);
    });
  }

  /**
   * Every occurrence of `method`, until the connection closes.
   *
   * The dispatcher DRAINS the handler list on each event — that is what makes
   * `once` one-shot without any bookkeeping. So a persistent listener cannot be
   * a handler that sits in the list; it re-registers itself on the way through,
   * before the caller's handler runs, so a handler that throws still leaves the
   * listener armed.
   */
  on(method, handler) {
    const arm = () => {
      const list = this.#handlers.get(method) ?? [];
      list.push((params, from) => {
        arm();
        handler(params, from);
      });
      this.#handlers.set(method, list);
    };
    arm();
  }

  close() {
    this.#ws.close();
  }
}

/**
 * The origin vite actually bound, read off its own first lines.
 *
 * It prints `Local: http://127.0.0.1:<port>/` once listening, and that is the
 * only place the real port exists when it has stepped past a busy one. The
 * ANSI colour codes it wraps the URL in are why this matches on the digits
 * rather than on the whole line.
 */
function viteOrigin(child, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    let seen = '';
    const timer = setTimeout(() => {
      reject(new Error(`vite printed no URL within ${timeoutMs}ms. It said:\n${seen.trim()}`));
    }, timeoutMs);
    const read = (chunk) => {
      seen += String(chunk);
      const found = /http:\/\/127\.0\.0\.1:(\d+)/.exec(seen.replace(/\[[0-9;]*m/g, ''));
      if (!found) return;
      clearTimeout(timer);
      resolve(`http://127.0.0.1:${found[1]}`);
    };
    child.stdout.on('data', read);
    child.stderr.on('data', read);
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`vite exited with ${code} before listening. It said:\n${seen.trim()}`));
    });
  });
}

/**
 * The debugging port Chrome actually took, from `DevToolsActivePort`.
 *
 * Chrome writes that file into its profile directory once the debugging server
 * is listening: the port on the first line, the WebSocket path on the second.
 * It is the only place the number exists when the port was left to Chrome.
 */
async function chromePort(profileDir, timeoutMs = 60_000) {
  const file = join(profileDir, 'DevToolsActivePort');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(file)) {
      const first = readFileSync(file, 'utf8').split('\n')[0].trim();
      if (/^\d+$/.test(first)) return Number(first);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Chrome never wrote ${file}. It may have failed to start.`);
}

/** Poll a URL until it answers, or give up. Used for both vite and Chrome. */
async function waitFor(url, label, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch (error) {
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${label} never answered at ${url}. Last error: ${lastError?.message ?? 'none'}`);
}

/**
 * Ends `chrome` and removes the profile directory it ran in.
 *
 * WHY IT EXISTS. A profile is 50 to 100 MB, and the ones no script removed
 * filled the disk to 0 bytes on 2026-09-24. On Windows a killed Chrome keeps
 * its files locked for a moment, so this waits for the exit and `rmSync`
 * retries a lock rather than failing on it.
 *
 * NEVER THROWS. It runs in a `finally`, and a cleanup that failed must not
 * replace the error that brought the script there.
 */
async function dropProfile(chrome, dir) {
  if (chrome && chrome.exitCode === null && chrome.signalCode === null) {
    const gone = new Promise((r) => chrome.once('exit', r));
    chrome.kill();
    await Promise.race([gone, new Promise((r) => setTimeout(r, 5_000))]);
  }
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch (error) {
    console.error(`  could not remove the profile ${dir}: ${error.message}`);
  }
}

export { Cdp, findChrome, playwrightCache, playwrightChromes, viteOrigin, chromePort, waitFor, dropProfile };
