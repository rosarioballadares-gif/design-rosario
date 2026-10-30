// Paste into use_figma on the client's library file, the one workspace-wiring.md
// names under "The design tool". Rebuilds a set read by read-reference.js (or a
// DATA written by hand) as the client's set, restyled by RULES.
//
// DATA   read-reference.js's output, pruned and renamed by hand where the client differs.
// NAME   the set's name, the code export: '<Prefix>Checkbox'.
// PAGE   the category page; created when missing.
// DROP   reference properties the client does not have. Their layers go too.
// COLOR  reference variable name -> client variable name. Never matched by name alone:
//        two files can both have a `control/bgColor` that mean different things.
// RULES  in order, later wins. Each matches `l` (layer name, string or RegExp)
//        and optionally `v` (RegExp on the variant name), and sets any of:
//        w h r gap pad:[t,r,b,l] sw  (number, or a variable name to bind)
//        fill stroke                 (a variable name; null removes the paint)
//        text                        (a text style name)   tx (characters)
//        effect                      (an effect style name; null removes it)
//        skip                        (true: the layer is not built at all)
//        hide (true/false)           al ('H'|'V'|null)     sz (['FI'|'HU'|'FL', ..])
// Paints nobody mapped come back in `unmapped` and keep the reference's hex, so they
// show on the capture. The run is not done while that list has anything in it.
const DATA = {};
const NAME = 'Example';
const PAGE = 'CONTROLS';
const DROP = [];
const COLOR = {};
const RULES = [];

const FONT = 'Instrument Sans';
for (const style of ['Regular', 'Medium', 'SemiBold', 'Bold']) await figma.loadFontAsync({ family: FONT, style });
const vars = {};
for (const v of await figma.variables.getLocalVariablesAsync()) vars[v.name] = v;
const styles = {};
for (const s of await figma.getLocalTextStylesAsync()) styles[s.name] = s;
const effects = {};
for (const s of await figma.getLocalEffectStylesAsync()) effects[s.name] = s;
const need = (name) => { if (!vars[name]) throw new Error('no variable ' + name); return vars[name]; };
const hexToRgb = (h) => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255 });
const unmapped = new Set();
const dropKeys = new Set(Object.keys(DATA.props).filter((k) => DROP.includes(k.split('#')[0])));

function rulesFor(variant, layer) {
  const out = {};
  for (const r of RULES) {
    const hit = typeof r.l === 'string' ? r.l === layer : r.l.test(layer);
    if (hit && (!r.v || r.v.test(variant))) Object.assign(out, r);
  }
  return out;
}
const solid = (varName) => figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', need(varName));
function paintsFor(list, layer) {
  return (list || []).map((p) => {
    if (p.v && COLOR[p.v]) return solid(COLOR[p.v]);
    unmapped.add(`${layer}: ${p.v || p.c}`);
    return { type: 'SOLID', color: hexToRgb(p.c), opacity: p.o ?? 1 };
  });
}
function num(n, field, value) {
  if (value === undefined) return;
  if (typeof value === 'string') n.setBoundVariable(field, need(value));
  else n[field] = value;
}
const REFS = new Map();
const SIZING = { FI: 'FIXED', HU: 'HUG', FL: 'FILL' };

async function make(o, parent, variant) {
  if (o.ref && Object.values(o.ref).some((k) => dropKeys.has(k))) return null;
  const rule = rulesFor(variant, o.n);
  if (rule.skip) return null;
  let n;
  if (o.t === 'COM') n = figma.createComponent();
  else if (o.t === 'TEX') n = figma.createText();
  else if (o.geo) { n = figma.createVector(); n.vectorPaths = o.geo.map((data) => ({ windingRule: 'NONZERO', data })); }
  else if (o.t === 'ELL') n = figma.createEllipse();
  else if (o.t === 'REC') n = figma.createRectangle();
  else n = figma.createFrame();
  n.name = o.n;
  if (parent) parent.appendChild(n);
  if ('fills' in n && n.type !== 'TEXT' && !o.geo) n.fills = [];
  const al = rule.al !== undefined ? rule.al : o.al?.[0];
  if ('layoutMode' in n) {
    if (al) {
      n.layoutMode = al === 'H' ? 'HORIZONTAL' : 'VERTICAL';
      if (o.al) { [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft, n.itemSpacing] = o.al.slice(1, 6); n.primaryAxisAlignItems = o.al[6]; n.counterAxisAlignItems = o.al[7]; }
    }
    n.clipsContent = false;
  }
  if (n.type !== 'TEXT' && !(o.geo && !rule.w)) n.resize(Math.max(o.wh[0], 0.01), Math.max(o.wh[1], 0.01));
  if (o.xy) { n.x = o.xy[0]; n.y = o.xy[1]; }
  if (o.t === 'TEX') {
    n.fontName = { family: FONT, style: 'Regular' };
    n.characters = rule.tx ?? o.tx;
    const byPx = { 12: 'text/content/caption', 14: 'text/content/body-2', 16: 'text/content/body' };
    const st = styles[rule.text || byPx[o.font?.[2]] || 'text/content/body-2'];
    if (st) await n.setTextStyleIdAsync(st.id);
  }
  if (o.c) for (const c of o.c) await make(c, n, variant);
  if (parent && parent.layoutMode && parent.layoutMode !== 'NONE') {
    const sz = rule.sz || o.sz;
    if (sz) { n.layoutSizingHorizontal = SIZING[sz[0]] || 'FIXED'; n.layoutSizingVertical = SIZING[sz[1]] || 'FIXED'; }
  } else if (o.t === 'COM' && o.sz) { n.layoutSizingHorizontal = SIZING[o.sz[0]] === 'FILL' ? 'FIXED' : SIZING[o.sz[0]]; n.layoutSizingVertical = SIZING[o.sz[1]] === 'FILL' ? 'FIXED' : SIZING[o.sz[1]]; }
  if ('fills' in n) {
    if (rule.fill !== undefined) n.fills = rule.fill ? [solid(rule.fill)] : [];
    else if (o.f) n.fills = paintsFor(o.f, o.n);
    else if (o.geo) n.fills = [];
  }
  if ('strokes' in n) {
    if (rule.stroke !== undefined) n.strokes = rule.stroke ? [solid(rule.stroke)] : [];
    else if (o.s) n.strokes = paintsFor(o.s, o.n);
    if (n.strokes.length) { n.strokeAlign = 'INSIDE'; num(n, 'strokeWeight', rule.sw ?? o.sw ?? 1); }
  }
  if ('cornerRadius' in n) {
    const r = rule.r ?? o.r;
    if (typeof r === 'string') for (const f of ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']) n.setBoundVariable(f, need(r));
    else if (r) n.cornerRadius = r;
  }
  if ('effects' in n) {
    if (rule.effect) await n.setEffectStyleIdAsync(effects[rule.effect].id);
    else n.effects = [];
  }
  num(n, 'width', rule.w); num(n, 'height', rule.h);
  if (rule.gap !== undefined) num(n, 'itemSpacing', rule.gap);
  if (rule.pad) ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].forEach((f, i) => num(n, f, rule.pad[i]));
  if (o.hid || rule.hide) n.visible = rule.hide === false;
  if (o.ref) REFS.set(n, o.ref);
  return n;
}

let page = figma.root.children.find((p) => p.name === PAGE);
if (!page) {
  page = figma.createPage();
  page.name = PAGE;
}
await figma.setCurrentPageAsync(page);
const comps = [];
for (const v of DATA.variants) comps.push(await make(v, null, v.n));
const set = figma.combineAsVariants(comps, page);
set.name = NAME;
// Clear of the page's Sections until doc.js moves it into its own.
set.x = Math.max(0, ...page.children.filter((n) => n !== set).map((n) => n.x + n.width)) + 400;
set.y = 0;
set.layoutMode = 'VERTICAL';
set.itemSpacing = 24;
set.paddingTop = set.paddingRight = set.paddingBottom = set.paddingLeft = 32;
set.layoutSizingHorizontal = 'HUG';
set.layoutSizingVertical = 'HUG';
const keyMap = {};
for (const [k, d] of Object.entries(DATA.props)) {
  if (d.type === 'VARIANT' || d.type === 'SLOT' || d.type === 'INSTANCE_SWAP' || dropKeys.has(k)) continue;
  keyMap[k] = set.addComponentProperty(k.split('#')[0], d.type, d.def);
}
for (const [n, ref] of REFS) {
  const next = {};
  for (const [field, key] of Object.entries(ref)) if (keyMap[key]) next[field] = keyMap[key];
  if (Object.keys(next).length) n.componentPropertyReferences = next;
}
return { setId: set.id, variants: set.children.map((c) => c.id + ' ' + c.name), props: Object.keys(set.componentPropertyDefinitions), unmapped: [...unmapped] };
