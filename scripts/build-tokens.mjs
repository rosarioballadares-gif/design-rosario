#!/usr/bin/env node
/**
 * The product's tokens, from `src/ds/tokens/*.json` to what the app and an agent read.
 *
 *   pnpm tokens          writes src/ds/tokens/build/
 *   pnpm tokens --check  writes nothing; fails if build/ is not what the JSON makes
 *
 * `src/ds/tokens/config.json` names the prefix, the modes and the bands. Until
 * the `tokens` skill writes a prefix there, there is no set, and the build
 * writes the same files EMPTY — so the provider, the breakpoint hook and the
 * specs compile from the first commit, and the set lands in a circuit that
 * already runs.
 *
 * Style Dictionary v5, with three choices: everything is formatted in memory so
 * `--check` and the spec compare the same bytes a write would produce;
 * primitives never reach the TS, because a screen binds to a meaning, not to a
 * hue; and `usage.json` joins every semantic token to its rule in
 * `semantic/usage.json`.
 *
 * Bands are the second axis, beside the modes: `semantic/breakpoint/<band>.json`,
 * one block per band on `[data-breakpoint]` and `build/bands.ts` by band. They
 * stay out of the mode TS, which holds one value per token.
 *
 * Why TS beside CSS: some consumers take values, not `var(--…)` — a map
 * library's paint, a chart's palette.
 * The tier rules: .claude/skills/tokens/SKILL.md.
 */
import { existsSync, readFileSync, realpathSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import StyleDictionary from 'style-dictionary';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = 'src/ds/tokens';
export const OUT = `${DIR}/build`;

/** The set's shape, as `config.json` declares it. A null prefix is a set that does not exist yet. */
export function readConfig(root = ROOT) {
  const raw = JSON.parse(readFileSync(join(root, DIR, 'config.json'), 'utf8'));
  return {
    prefix: raw.prefix ?? null,
    modes: raw.modes ?? [],
    defaultMode: raw.defaultMode ?? raw.modes?.[0] ?? null,
    bands: raw.bands ?? [],
    defaultBand: raw.defaultBand ?? raw.bands?.[0] ?? null,
  };
}

const config = readConfig();
export const PREFIX = config.prefix;
export const MODES = config.modes;
/** Widest first, as Figma's modes: `semantic/breakpoint/<band>.json`, picked by `[data-breakpoint]`. */
export const BANDS = config.bands;
const isBand = (token) => token.filePath.includes('semantic/breakpoint/');
/** Values a stylesheet has no use for: a map's dash array, a list of numbers. */
const NOT_CSS = new Set(['dashArray', 'numberList', 'string']);

export const tierOf = (filePath) =>
  filePath.includes('primitive.json') ? 'primitive' : filePath.includes('component.json') ? 'component' : 'semantic';

/** The files a mode and a band read, leaving out the optional ones the set does not have yet. */
const sources = (mode, band) =>
  [`${DIR}/primitive.json`, `${DIR}/semantic/base.json`, `${DIR}/semantic/${mode}.json`, `${DIR}/component.json`, band && `${DIR}/semantic/breakpoint/${band}.json`]
    .filter(Boolean)
    .filter((s) => existsSync(join(ROOT, s)));

StyleDictionary.registerTransform({
  name: 'name/prefix',
  type: 'name',
  transform: (token) => `${PREFIX}-${token.path.join('-')}`,
});
StyleDictionary.registerTransform({
  name: 'gradient/css',
  type: 'value',
  transitive: true,
  filter: (token) => token.$type === 'gradient',
  /* Top to bottom, unless the token names its angle in `$extensions.gradient.angle`;
     radial when it names its shape, size and centre in `$extensions.gradient.radial`. */
  transform: (token) => {
    const stops = token.$value.map((s) => `${s.color} ${Math.round(s.position * 100)}%`).join(', ');
    const radial = token.$extensions?.gradient?.radial;
    return radial ? `radial-gradient(${radial}, ${stops})` : `linear-gradient(${token.$extensions?.gradient?.angle ?? 180}deg, ${stops})`;
  },
});

const shared = ['name/prefix', 'fontFamily/css', 'shadow/css/shorthand', 'typography/css/shorthand'];

async function dictionary(mode, band = config.defaultBand) {
  const sd = new StyleDictionary({
    source: sources(mode, band).map((s) => join(ROOT, s)),
    log: { verbosity: process.env.SD_VERBOSE ? 'verbose' : 'silent', warnings: 'disabled' },
    platforms: {
      css: { transforms: [...shared, 'gradient/css'] },
      ts: { transforms: shared },
    },
  });
  await sd.hasInitialized;
  return sd;
}

const tokensIn = async (sd, platform) => (await sd.getPlatformTokens(platform)).allTokens.map((t) => ({ ...t, tier: tierOf(t.filePath) }));

/** The primitive a text style's `letterSpacing` points at, since the font shorthand drops it. */
const trackingOf = (token) => token.original.$value?.letterSpacing?.slice(1, -1);

/**
 * `textStyle.display.2` as `{ font, letterSpacing }`, from every `text.*` style:
 * what an inline style spreads, so no reader pairs a font with its tracking.
 */
function textStyles(tokens, byPath) {
  const styles = tokens.filter((t) => t.$type === 'typography');
  const astray = styles.filter((t) => t.path[0] !== 'text').map((t) => t.path.join('.'));
  if (astray.length) throw new Error(`text styles outside text.*: ${astray.join(', ')}`);
  return nest(
    styles.map((t) => {
      const tracking = trackingOf(t);
      return { path: t.path.slice(1), $value: { font: t.$value, ...(tracking && { letterSpacing: byPath.get(tracking).$value }) } };
    }),
  );
}

/** A `var(--<prefix>-…)` where the token aliases another, so a stylesheet shows the tier it came from. */
function cssValue(token, byPath) {
  const raw = token.original.$value;
  if (typeof raw === 'string' && /^\{[^}]+\}$/.test(raw)) {
    const target = byPath.get(raw.slice(1, -1));
    if (target) return `var(--${target.name})`;
  }
  return token.$value;
}

const block = (selector, tokens, byPath) =>
  `${selector} {\n${tokens.map((t) => `  --${t.name}: ${cssValue(t, byPath)};`).join('\n')}\n}\n`;

function nest(tokens) {
  const tree = {};
  for (const t of tokens) {
    let node = tree;
    t.path.slice(0, -1).forEach((k) => (node = node[k] ??= {}));
    node[t.path.at(-1)] = t.$value;
  }
  return tree;
}

const HEADER = '/* Generated by scripts/build-tokens.mjs from src/ds/tokens/*.json. Do not edit: run `pnpm tokens`. */\n';

/** The four TS modules and the stylesheet, from what each holds — empty objects before there is a set. */
function emit(files, { css, modes, bands, colours, usage }) {
  files.set(`${OUT}/tokens.css`, HEADER + (css.length ? css.join('\n') : '/* No token set yet: the `tokens` skill builds one. */\n'));
  files.set(
    `${OUT}/modes.ts`,
    `${HEADER}/** Every semantic and component token, resolved per mode. Primitives are not here: a screen binds to a meaning. */\nconst modes = ${JSON.stringify(modes, null, 2)};\nexport default modes;\n`,
  );
  files.set(
    `${OUT}/bands.ts`,
    /* The index signature beside `breakpoint`: `satisfies` runs the excess-property check on a literal, so a closed type refuses the first band token past `minWidth`. */
    `${HEADER}/** Every band token by band, widest first: what a reader that cannot take a \`var(--…)\` reads by name. */\nconst bands = ${JSON.stringify(bands, null, 2)} satisfies Record<string, { breakpoint: { minWidth: string }; [group: string]: unknown }>;\nexport default bands;\n`,
  );
  files.set(
    `${OUT}/colours.ts`,
    `${HEADER}/** Every semantic colour by its name, as the \`var(--…)\` that paints it. */\nexport const semanticColours = ${JSON.stringify(colours, null, 2)} as const;\n\nexport type SemanticColour = keyof typeof semanticColours;\n`,
  );
  files.set(`${OUT}/usage.json`, JSON.stringify(usage, null, 2) + '\n');
  return files;
}

/** Every file `build/` should hold, as path → content. */
export async function buildTokens() {
  const files = new Map();
  if (!PREFIX) return emit(files, { css: [], modes: {}, bands: {}, colours: {}, usage: [] });

  const css = [];
  const perMode = {};
  const modes = {};
  for (const mode of MODES) {
    const sd = await dictionary(mode);
    const cssTokens = (await tokensIn(sd, 'css')).filter((t) => !NOT_CSS.has(t.$type));
    const byPath = new Map(cssTokens.map((t) => [t.path.join('.'), t]));
    const from = (file) => cssTokens.filter((t) => t.filePath.includes(file));
    if (mode === config.defaultMode) {
      /* A text style's tracking rides beside its font, as the shorthand has no room for it. */
      const withTracking = from('semantic/base.json').flatMap((t) =>
        trackingOf(t) ? [t, { name: `${t.name}-letterSpacing`, original: { $value: `{${trackingOf(t)}}` } }] : [t],
      );
      css.push(block(':root', [...from('primitive.json'), ...withTracking], byPath));
    }
    const selector = mode === config.defaultMode ? `:root, [data-theme="${mode}"]` : `[data-theme="${mode}"]`;
    css.push(block(selector, [...from(`semantic/${mode}.json`), ...from('component.json')], byPath));

    const all = await tokensIn(sd, 'ts');
    const allByPath = new Map(all.map((t) => [t.path.join('.'), t]));
    const ts = all.filter((t) => t.tier !== 'primitive' && !isBand(t));
    perMode[mode] = ts.map((t) => (trackingOf(t) ? { ...t, letterSpacing: allByPath.get(trackingOf(t)).$value } : t));
    modes[mode] = { ...nest(ts), textStyle: textStyles(ts, allByPath) };
  }
  /* A band's tokens, and every token aliasing one, again under its `[data-breakpoint]`: a custom
     property resolves its `var()` where it is declared, so a band pinned on a subtree reaches
     a token aliasing a band token only if that token is declared there too. */
  const perBand = {};
  for (const band of BANDS) {
    const sd = await dictionary(config.defaultMode, band);
    const cssTokens = (await tokensIn(sd, 'css')).filter((t) => !NOT_CSS.has(t.$type));
    const byPath = new Map(cssTokens.map((t) => [t.path.join('.'), t]));
    const aliasOf = (t) => { const raw = t.original.$value; return typeof raw === 'string' && /^\{[^}]+\}$/.test(raw) ? byPath.get(raw.slice(1, -1)) : undefined; };
    const followsBand = (t) => { for (let a = aliasOf(t); a; a = aliasOf(a)) if (isBand(a)) return true; return false; };
    /* A text style with a field on a band token, a page heading whose size steps with the band: its shorthand, resolved in this band. */
    const fieldsFollowBand = (t) => t.$type === 'typography' && Object.values(t.original.$value).some((v) => { const f = typeof v === 'string' && /^\{[^}]+\}$/.test(v) && byPath.get(v.slice(1, -1)); return f && (isBand(f) || followsBand(f)); });
    /* `:where(:root)`, not `:root`: the fallback has to lose to every `[data-breakpoint]` on `<html>`, and `:root` ties
       an attribute selector on specificity, so whichever block is later wins. Widest first puts the default last. */
    const selector = band === config.defaultBand ? `:where(:root), [data-breakpoint="${band}"]` : `[data-breakpoint="${band}"]`;
    css.push(block(selector, [...cssTokens.filter(isBand), ...cssTokens.filter((t) => !isBand(t) && (followsBand(t) || fieldsFollowBand(t)))], byPath));
    perBand[band] = (await tokensIn(sd, 'ts')).filter(isBand);
  }

  const rulesFile = join(ROOT, DIR, 'semantic/usage.json');
  const rules = existsSync(rulesFile) ? JSON.parse(readFileSync(rulesFile, 'utf8')) : {};
  const base = perMode[config.defaultMode] ?? [];
  const cssNames = new Set(base.filter((t) => !NOT_CSS.has(t.$type)).map((t) => t.name));
  const usage = base
    .filter((t) => t.tier === 'semantic')
    .map((t) => {
      const token = t.path.join('.');
      const values = Object.fromEntries(MODES.map((m) => [m, perMode[m].find((u) => u.path.join('.') === token)?.$value]));
      return { token, cssVar: cssNames.has(t.name) ? `--${t.name}` : null, type: t.$type, ...values, ...(t.letterSpacing && { letterSpacing: t.letterSpacing }), ...rules[token] };
    })
    .concat(
      (perBand[config.defaultBand] ?? []).map((t) => {
        const token = t.path.join('.');
        const values = Object.fromEntries(BANDS.map((b) => [b, perBand[b].find((u) => u.path.join('.') === token)?.$value]));
        return { token, cssVar: NOT_CSS.has(t.$type) ? null : `--${t.name}`, type: t.$type, ...values, ...rules[token] };
      }),
    );

  /* A component that takes a colour is passed a semantic name, and paints it with the variable of whichever mode is around it. */
  const colours = Object.fromEntries(base.filter((t) => t.tier === 'semantic' && t.$type === 'color').map((t) => [t.path.join('.'), `var(--${t.name})`]));
  const bands = Object.fromEntries(BANDS.map((b) => [b, nest(perBand[b])]));
  return emit(files, { css, modes, bands, colours, usage });
}

const main = async () => {
  const check = process.argv.includes('--check');
  console.log(`tokens - ${check ? 'checks' : 'writes'} ${OUT}/ from ${DIR}/*.json and config.json: CSS for every mode and band, TS per mode and per band, the semantic colours' names, usage.json.`);
  console.log(PREFIX ? `  prefix "${PREFIX}", modes ${MODES.join(', ') || 'none'}, bands ${BANDS.join(', ') || 'none'}; primitives stay out of the TS.` : '  no set yet: config.json has no prefix, so every file is written empty. The `tokens` skill builds the set.');
  const files = await buildTokens();
  const stale = [];
  for (const [path, content] of files) {
    const abs = join(ROOT, path);
    if (check) {
      let now = null;
      /* Git may check the file out as CRLF; the bytes that matter are the lines. */
      try { now = readFileSync(abs, 'utf8').replace(/\r\n/g, '\n'); } catch { /* missing counts as stale */ }
      if (now !== content) stale.push(path);
    } else {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content);
    }
  }
  if (stale.length) {
    console.log(`FAIL ${stale.length} file(s) not what the JSON makes: ${stale.join(', ')}. Run \`pnpm tokens\`.`);
    process.exit(1);
  }
  console.log(`ok   ${files.size} files ${check ? 'match' : 'written'}.`);
};

/* Both sides through `realpathSync.native`: a symlinked path or a drive letter
   in another case names the same file, and the JS `realpathSync` keeps the case. */
const isEntry = () => {
  try { return realpathSync.native(process.argv[1]) === realpathSync.native(fileURLToPath(import.meta.url)); }
  catch { return false; }
};
if (process.argv[1] && isEntry()) await main();
