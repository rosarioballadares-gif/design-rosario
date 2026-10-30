/**
 * Screenshots of this app, by a mechanism that is written down.
 *
 * **In the repository this was harvested from, eleven route shots were made by
 * something nobody committed.** Two of them went stale the moment
 * the geometry changed, and nothing in this repository could regenerate them.
 *
 * > SOURCE: Ian Rueff, 2026-09-23 — "Nadie sabe con qué script se generaron".
 *
 * **No Playwright, no Puppeteer, no `chromium-cli`.** Measured 2026-09-23: none
 * of the three is reachable on this machine, and adding one is a dependency
 * nobody asked for. Chrome is installed, it speaks CDP over a socket, and Node
 * 22+ carries a `WebSocket` client in the standard library — so the driver is
 * this file and nothing else.
 *
 * **It waits for `data-shot-ready="true"`**, which a prototype sets when what
 * it draws has stopped changing — a map's canvas, a chart's first animation.
 * A route that sets nothing is shot with `--ready <selector>` instead. A WebGL canvas photographed on a timer is a
 * photograph of whatever happened to have rendered by then.
 *
 * **It removes its Chrome profile when it ends, failed or not.** Each is ~50 MB
 * in the temp directory, and the ones it used to leave filled C: on 2026-09-24.
 *
 * Usage — the dev server has to be up; this does not start one:
 *   node scripts/shot.mjs --shot "<url>=<out-path>" [--shot ...]
 *
 * **In Git Bash, pass the WHOLE url.** MSYS rewrites any argument starting
 * with `/` into a Windows path, so `--shot "/#/x=out.png"` arrives as
 * `C:/Program Files/Git/#/x=out.png` and the navigation fails. A `--shot`
 * beginning with `http` skips `--base` for exactly this reason.
 *
 *   --base   origin, default http://localhost:5175
 *   --size   WxH in CSS pixels, default 1440x900
 *   --dpr    device pixel ratio, default 2
 *   --eval   JS run in the page after ready and before the capture. Its promise
 *            is awaited, so a hover can settle.
 *   --ready  the selector to wait for instead of the marker, for a page that
 *            does not set one: a Storybook story waits on its component's class.
 *   --ax 1   print the role, name and state of every control in the
 *            accessibility tree, the evidence that a hidden label still names one.
 *   --full 1 the whole page, not the viewport: the document's content height
 *            at --size's width, captured in tiles under 8.000 device pixels
 *            and stitched by png-stitch.mjs. Past about 6.900 pixels Chrome
 *            repeats the top of the page instead of drawing the rest, in one
 *            capture or one tall window alike (measured 2026-10-08). A page
 *            that scrolls inside its own container is still one viewport.
 *
 * Brief: a previous client's ribbon-geometry brief, 2026-09-23, not carried.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

import { stitchPngs } from './png-stitch.mjs';

const READY = '[data-shot-ready="true"]';
/** One --full tile's height in device pixels: under the ~6.900 where Chrome starts repeating, with room. */
const TILE_DEVICE_PX = 4000;
const CONTROLS = new Set(['button', 'checkbox', 'switch', 'radio', 'slider', 'spinbutton', 'textbox', 'searchbox', 'combobox', 'listbox', 'option', 'tab', 'tabpanel', 'menu', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'tree', 'treeitem', 'dialog', 'tooltip', 'progressbar', 'meter', 'img', 'image', 'scrollbar', 'group', 'radiogroup', 'link', 'heading', 'navigation', 'main', 'banner', 'complementary', 'contentinfo', 'region']);
const STATES = new Set(['checked', 'pressed', 'selected', 'expanded', 'disabled', 'valuenow', 'modal', 'level']);

/* Where Chrome is. CHROME_PATH first, because a machine that keeps it
   somewhere else should not need this list edited. */
const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

function chromePath() {
  for (const candidate of CANDIDATES) if (candidate && existsSync(candidate)) return candidate;
  throw new Error('No Chrome found. Set CHROME_PATH.');
}

function args(argv) {
  const out = { shots: [], base: 'http://localhost:5175', size: '1440x900', dpr: '2', eval: null, ready: READY, ax: null, full: null };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    const value = argv[i + 1];
    if (key === 'shot') out.shots.push(value);
    else out[key] = value;
  }
  return out;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Chrome writes the port it chose here, once its socket is up. */
async function devtoolsPort(dir) {
  const file = join(dir, 'DevToolsActivePort');
  for (let i = 0; i < 100; i += 1) {
    if (existsSync(file)) {
      const [port] = readFileSync(file, 'utf8').split('\n');
      if (port) return port.trim();
    }
    await sleep(100);
  }
  throw new Error('Chrome never reported a debugging port.');
}

/** One CDP socket. Ids matched to promises, sessions flattened onto it. */
function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let next = 1;
  const open = new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve());
    socket.addEventListener('error', () => reject(new Error('CDP socket failed to open.')));
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const slot = pending.get(message.id);
    if (!slot) return;
    pending.delete(message.id);
    if (message.error) slot.reject(new Error(message.error.message));
    else slot.resolve(message.result);
  });
  return {
    open,
    close: () => socket.close(),
    send(method, params = {}, sessionId) {
      const id = next;
      next += 1;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
  };
}

async function main() {
  const opts = args(process.argv.slice(2));
  if (opts.shots.length === 0) {
    console.error('shot.mjs - nothing to capture. Pass --shot "<url-path>=<out-path>".');
    process.exit(1);
  }
  const [width, height] = opts.size.split('x').map(Number);
  const dpr = Number(opts.dpr);

  console.log(`shot.mjs - ${opts.shots.length} capture(s), ${width}x${height} at ${dpr}x, each waiting on ${opts.ready}.`);
  console.log(`  base ${opts.base} - the dev server has to be up already.`);

  const exe = chromePath();
  const profile = mkdtempSync(join(tmpdir(), 'shot-'));
  let cdp = null;
  const chrome = spawn(exe, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    /* WebGL with no GPU. Without these a map library never draws and every
       capture is the page's background colour. */
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    `--window-size=${width},${height}`,
    'about:blank',
  ], { stdio: 'ignore' });
  const exited = new Promise((resolve) => chrome.once('exit', resolve));

  try {
    const port = await devtoolsPort(profile);
    const version = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json());
    cdp = connect(version.webSocketDebuggerUrl);
    await cdp.open;

    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send(
      'Emulation.setDeviceMetricsOverride',
      { width, height, deviceScaleFactor: dpr, mobile: false },
      sessionId,
    );

    let failed = 0;
    for (const shot of opts.shots) {
      const split = shot.lastIndexOf('=');
      const path = shot.slice(0, split);
      const out = shot.slice(split + 1);
      const url = path.includes('://') ? path : `${opts.base}${path}`;
      await cdp.send('Page.navigate', { url }, sessionId);

      let ready = false;
      for (let i = 0; i < 300; i += 1) {
        const probe = await cdp.send(
          'Runtime.evaluate',
          { expression: `!!document.querySelector(${JSON.stringify(opts.ready)})`, returnByValue: true },
          sessionId,
        );
        if (probe.result.value === true) { ready = true; break; }
        await sleep(100);
      }
      if (!ready) {
        console.error(`  MISS ${url} - never reached ${opts.ready} within 30s. Nothing written.`);
        failed += 1;
        continue;
      }

      if (opts.eval) {
        const { result } = await cdp.send(
          'Runtime.evaluate',
          { expression: opts.eval, awaitPromise: true, returnByValue: true },
          sessionId,
        );
        if (result?.value !== undefined) console.log(`  eval ${JSON.stringify(result.value)}`);
        await sleep(600);
      }

      if (opts.ax) {
        const { nodes } = await cdp.send('Accessibility.getFullAXTree', {}, sessionId);
        for (const node of nodes) {
          if (!CONTROLS.has(node.role?.value)) continue;
          const state = (node.properties || []).filter((p) => STATES.has(p.name)).map((p) => `${p.name}=${p.value.value}`);
          const said = [node.value?.value && `value="${node.value.value}"`, node.description?.value && `description="${node.description.value}"`].filter(Boolean);
          console.log(`  ax   ${node.role.value} "${node.name?.value ?? ''}" ${[...state, ...said].join(' ')}`);
        }
      }
      let png;
      if (opts.full) {
        const { cssContentSize } = await cdp.send('Page.getLayoutMetrics', {}, sessionId);
        const total = Math.ceil(cssContentSize.height);
        const tile = Math.floor(TILE_DEVICE_PX / dpr);
        const tiles = [];
        for (let y = 0; y < total; y += tile) {
          const clip = { x: 0, y, width, height: Math.min(tile, total - y), scale: 1 };
          const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip }, sessionId);
          tiles.push(Buffer.from(data, 'base64'));
        }
        png = tiles.length === 1 ? tiles[0] : stitchPngs(tiles);
        console.log(`  full ${width}x${total} in ${tiles.length} tile(s)`);
      } else {
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
        png = Buffer.from(data, 'base64');
      }
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, png);
      console.log(`  ok   ${url} -> ${out}`);
    }

    console.log(failed === 0
      ? `shot.mjs - ${opts.shots.length} written. A capture is what the canvas held when it went idle, never proof the screen is right.`
      : `shot.mjs - ${failed} of ${opts.shots.length} never became ready. Nothing was written for those.`);
    return failed === 0 ? 0 : 1;
  } finally {
    /* Chrome holds its files for a moment after it dies, hence the wait and
       the retries. */
    cdp?.close();
    if (chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill();
      await exited;
    }
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch {
      console.error(`  left ${profile} - Chrome still held it. Remove it by hand.`);
    }
  }
}

main().then((code) => process.exit(code), (error) => { console.error(error); process.exit(1); });
