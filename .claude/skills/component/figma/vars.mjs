// node .claude/skills/component/figma/vars.mjs <prefix>
// Prints the PAYLOAD that vars.js pastes into Figma: one entry per token under
// `<prefix>` in component.json, and one per primitive those tokens point at.
// Each component entry still needs its `d`, one sentence written by hand.
import { readFileSync } from 'node:fs';

const [prefix] = process.argv.slice(2);
if (!prefix) throw new Error('usage: vars.mjs <prefix>');
const read = (p) => JSON.parse(readFileSync(new URL(`../../../../src/ds/tokens/${p}`, import.meta.url), 'utf8'));
const component = read('component.json');
const primitive = read('primitive.json');

const REF = /^\{([a-zA-Z][\w.-]*)\}$/;
const TYPE = { color: 'COLOR', dimension: 'FLOAT', number: 'FLOAT', fontWeight: 'FLOAT', duration: 'TIMING' };
const at = (tree, path) => path.split('.').reduce((n, k) => n?.[k], tree);

const out = [];
const prims = new Map();
(function walk(node, path) {
  if (node.$type) {
    const m = REF.exec(node.$value);
    const type = TYPE[node.$type];
    if (!type) return console.error(`skip ${path.join('.')}: ${node.$type} is not a variable`);
    const to = m ? m[1] : null;
    const prim = to && at(primitive, to);
    /* Figma holds an opacity in per cent: the JSON's 0.7 is `opacity/70` = 70 there. */
    const value = parseFloat(prim?.$value) * (to?.startsWith('opacity.') ? 100 : 1);
    const unit = /px$/.test(String(prim?.$value)) ? 'px' : '';
    if (prim?.$type && !prims.has(to)) prims.set(to, { name: to.replaceAll('.', '/'), type, value, unit, usedBy: [] });
    if (prim?.$type) prims.get(to).usedBy.push(path.join('/'));
    out.push({ name: path.join('/'), type, to: to?.replaceAll('.', '/') ?? node.$value, primitive: !!prim?.$type, d: '' });
    return;
  }
  for (const [k, v] of Object.entries(node)) if (!k.startsWith('$')) walk(v, [...path, k]);
})(component[prefix], [prefix]);

console.log(JSON.stringify({ primitives: [...prims.values()], component: out }, null, 1));
