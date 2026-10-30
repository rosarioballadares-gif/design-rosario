// Paste into use_figma on the reference file, a design system the client's sets
// copy their structure from. Read-only.
// Set SET_ID to the reference's component set, and KEEP to a function that takes
// a variant's name and says whether the client keeps it. Returns the compact
// tree that build.js rebuilds in the client's library.
const SET_ID = '';
if (!SET_ID) throw new Error('Set SET_ID to the reference component set, as 123:456.');
const KEEP = (_name) => true;

const varName = {};
async function vn(alias) {
  if (!alias || !alias.id) return undefined;
  if (!(alias.id in varName)) {
    const v = await figma.variables.getVariableByIdAsync(alias.id);
    varName[alias.id] = v ? v.name : '?';
  }
  return varName[alias.id];
}
const hex = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
async function paints(ps) {
  if (!ps || ps === figma.mixed) return undefined;
  const o = [];
  for (const p of ps) {
    if (p.type !== 'SOLID' || p.visible === false) continue;
    o.push({ c: hex(p.color), o: p.opacity !== 1 ? +p.opacity.toFixed(2) : undefined, v: await vn(p.boundVariables?.color) });
  }
  return o.length ? o : undefined;
}
const SHAPES = ['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'POLYGON', 'LINE'];
async function ser(n) {
  const o = { t: n.type === 'INSTANCE' ? 'I' : n.type.slice(0, 3), n: n.name };
  if (!n.visible) o.hid = 1;
  o.wh = [Math.round(n.width), Math.round(n.height)];
  if (n.parent && n.parent.layoutMode === 'NONE' && n.parent.type !== 'COMPONENT_SET') o.xy = [Math.round(n.x), Math.round(n.y)];
  if (n.layoutMode && n.layoutMode !== 'NONE') o.al = [n.layoutMode[0], n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft, n.itemSpacing, n.primaryAxisAlignItems, n.counterAxisAlignItems];
  if (n.layoutSizingHorizontal) o.sz = [n.layoutSizingHorizontal.slice(0, 2), n.layoutSizingVertical.slice(0, 2)];
  const f = await paints(n.fills); if (f) o.f = f;
  const s = await paints(n.strokes); if (s) { o.s = s; o.sw = n.strokeWeight === figma.mixed ? n.strokeTopWeight : n.strokeWeight; }
  if (typeof n.cornerRadius === 'number' && n.cornerRadius) o.r = n.cornerRadius;
  if (n.type === 'TEXT') { o.tx = n.characters; o.font = [n.fontName.family, n.fontName.style, n.fontSize]; }
  if (SHAPES.includes(n.type)) o.geo = n.fillGeometry.map((g) => g.data);
  if (n.componentPropertyReferences && Object.keys(n.componentPropertyReferences).length) o.ref = n.componentPropertyReferences;
  const bv = {};
  for (const k of Object.keys(n.boundVariables || {})) {
    if (['fills', 'strokes', 'componentProperties'].includes(k)) continue;
    const b = n.boundVariables[k];
    const name = await vn(Array.isArray(b) ? b[0] : b);
    if (name) bv[k] = name;
  }
  if (Object.keys(bv).length) o.bv = bv;
  if ('children' in n && !SHAPES.includes(n.type)) { o.c = []; for (const c of n.children) o.c.push(await ser(c)); }
  return o;
}
const set = await figma.getNodeByIdAsync(SET_ID);
const props = {};
for (const [k, d] of Object.entries(set.componentPropertyDefinitions)) props[k] = d.type === 'VARIANT' ? { type: d.type, options: d.variantOptions } : { type: d.type, def: d.defaultValue };
const out = { name: set.name, props, variants: [] };
for (const v of set.children) if (KEEP(v.name)) out.variants.push(await ser(v));
return out;
