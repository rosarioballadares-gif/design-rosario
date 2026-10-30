// Recreate a set's BOOLEAN / TEXT / INSTANCE_SWAP properties in ORDER, reapply every instance's values.
// ORDER null: layer order, each layer's 👁️ then ✏️ then 🔃. A set already in that order returns untouched.
// Slots and variants are never recreated (a recreated slot empties every instance's content).
// DRY true: ends in throw, persists nothing. DRY false: throws on any diff, so a bad run persists nothing either.
const DRY = true;
const SET = '';
if (!SET) throw new Error('Set SET to the component set, as 123:456.');
const ORDER = null;
const set = await figma.getNodeByIdAsync(SET);
const sid = k => k.slice(k.lastIndexOf('#') + 1);
const recreatable = Object.keys(set.componentPropertyDefinitions).filter(k => ['BOOLEAN', 'TEXT', 'INSTANCE_SWAP'].includes(set.componentPropertyDefinitions[k].type));
// each variant's layer order is a constraint; merged topologically, ties by first appearance
const first = [], after = new Map();
for (const v of set.children) {
  const seq = [];
  const walk = n => { const r = n.componentPropertyReferences; if (r) for (const f of ['visible', 'characters', 'mainComponent']) if (recreatable.includes(r[f]) && !seq.includes(r[f])) seq.push(r[f]); if ('children' in n) for (const c of n.children) walk(c); };
  walk(v);
  for (const k of seq) if (!first.includes(k)) first.push(k);
  for (let i = 0; i < seq.length; i++) for (let j = i + 1; j < seq.length; j++) { if (!after.has(seq[j])) after.set(seq[j], new Set()); after.get(seq[j]).add(seq[i]); }
}
const inLayers = [];
for (const left = [...first]; left.length;) {
  const free = left.filter(k => ![...(after.get(k) || [])].some(p => left.includes(p) && !(after.get(p) || new Set()).has(k)));
  const pick = (free.length ? free : left)[0];
  inLayers.push(pick); left.splice(left.indexOf(pick), 1);
}
const target = ORDER || [...inLayers, ...recreatable.filter(k => !inLayers.includes(k))].map(sid);
if (recreatable.map(sid).join() === target.join()) return { set: set.name, inOrder: true };
const r2 = x => Math.round(x * 100) / 100;
const bare = k => k.includes('#') ? k.slice(0, k.lastIndexOf('#')) : k;
// a hidden subtree is not compared: Figma lists its children stale or not at all (memory figma-hidden-layer-not-in-children)
// setProperties on a TEXT property writes plain text: a range styled in the override (a card tone's Success) goes flat
const segs = t => t.getStyledTextSegments(['fills']).map(s => ({ s: s.start, e: s.end, f: s.fills }));
const segKey = t => segs(t).map(g => g.s + '-' + g.e + ':' + g.f.map(f => (f.boundVariables && f.boundVariables.color && f.boundVariables.color.id) || JSON.stringify(f.color)).join()).join(';');
const rows = (n, out = []) => { out.push(n.name + '|' + n.type + '|' + n.visible + '|' + r2(n.width) + 'x' + r2(n.height) + (n.type === 'TEXT' ? '|' + n.characters.slice(0, 30) + '|' + segKey(n) : '')); if (n.visible && 'children' in n) for (const c of n.children) rows(c, out); return out; };
const hid = n => { let p = n.parent; for (; p && p.type !== 'PAGE'; p = p.parent) if (!p.visible) return true; return !p; };
const shown = n => hid(n) ? rows(n).slice(0, 1) : rows(n);
const mains = async () => { const o = []; for (const v of set.children) for (const i of v.findAllWithCriteria({ types: ['INSTANCE'] }).filter(i => !hid(i))) { const m = await i.getMainComponentAsync(); o.push(v.name + '/' + i.name + '=' + (m && m.id)); } return o; };
const dif = (b, a) => { const out = []; for (let i = 0; i < Math.max(b.length, a.length); i++) if (b[i] !== a[i]) out.push(i + ': ' + b[i] + ' => ' + a[i]); return out.slice(0, 6); };

// 1. census: page scan ∪ getInstancesAsync
const vids = new Set(set.children.map(c => c.id));
const found = new Map();
for (const page of figma.root.children) {
  await figma.setCurrentPageAsync(page);
  for (const n of page.findAllWithCriteria({ types: ['INSTANCE'] })) {
    const m = await n.getMainComponentAsync();
    if (m && vids.has(m.id)) found.set(n.id, n);
  }
}
for (const v of set.children) for (const n of await v.getInstancesAsync()) if (!found.has(n.id)) found.set(n.id, n);
const depth = id => id.split(';').length;
const ids = [...found.keys()].sort((a, b) => depth(a) - depth(b));
function root(n) { let p = n.parent, last = n; while (p && p.type !== 'PAGE') { if (p.type === 'COMPONENT') return p; last = p; p = p.parent; } return last; }
function props(n) { const o = {}; for (const [k, v] of Object.entries(n.componentProperties)) if (v.type !== 'VARIANT') o[bare(k)] = v.value; return o; }
const before = {};
for (const id of ids) { const n = found.get(id); const rt = root(n); before[id] = { p: props(n), rows: shown(n), rid: rt.id, rn: rt.name, rh: r2(rt.height), names: Object.fromEntries(n.findAll(() => true).map(c => [c.id, c.name])), ranges: Object.fromEntries(n.findAllWithCriteria({ types: ['TEXT'] }).map(t => [t.id, segs(t)]).filter(([, s]) => s.length > 1)) }; }
const vBefore = set.children.map(v => rows(v)), mBefore = await mains();
// export hashes of every variant and up to three visible instances with a toned range: pixel-equal or GUARD
const fnv = b => { let h = 0x811c9dc5; for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
const hash = async n => fnv(await n.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 1 } }));
const rangedIds = ids.filter(id => Object.keys(before[id].ranges).length && !hid(found.get(id))).slice(0, 3);
const hB = []; for (const v of set.children) hB.push(await hash(v)); for (const id of rangedIds) hB.push(await hash(found.get(id)));

// 2. fonts for text reapply
const fonts = new Map();
const fontsOf = t => t.characters.length ? t.getRangeAllFontNames(0, t.characters.length) : [t.fontName];
for (const v of set.children) for (const t of v.findAllWithCriteria({ types: ['TEXT'] })) for (const f of fontsOf(t)) fonts.set(JSON.stringify(f), f);
for (const id of ids) for (const t of found.get(id).findAllWithCriteria({ types: ['TEXT'] })) for (const f of fontsOf(t)) fonts.set(JSON.stringify(f), f);
await Promise.all([...fonts.values()].map(f => figma.loadFontAsync(f)));

// 3. recreate in order: rename old, add new (appends), rebind layers, delete old
for (const id of target) {
  const defs = set.componentPropertyDefinitions;
  const oldKey = Object.keys(defs).find(k => k.endsWith('#' + id));
  if (!oldKey) throw new Error('no property #' + id);
  const d = defs[oldKey]; const name = bare(oldKey);
  if (!['BOOLEAN', 'TEXT', 'INSTANCE_SWAP'].includes(d.type)) throw new Error('not recreatable ' + oldKey);
  const tmp = set.editComponentProperty(oldKey, { name: name + ' ~old' });
  const opts = d.type === 'INSTANCE_SWAP' && d.preferredValues && d.preferredValues.length ? { preferredValues: d.preferredValues } : undefined;
  const nk = set.addComponentProperty(name, d.type, d.defaultValue, opts);
  let bound = 0;
  for (const v of set.children) for (const n of [v, ...v.findAll(() => true)]) {
    const refs = n.componentPropertyReferences; if (!refs) continue;
    const hit = Object.entries(refs).filter(([, val]) => val === tmp); if (!hit.length) continue;
    const next = { ...refs }; for (const [f] of hit) next[f] = nk; n.componentPropertyReferences = next; bound++;
  }
  set.deleteComponentProperty(tmp);
  if (!bound) throw new Error('bound to no layer: ' + name);
}

// 4. reapply, shallowest first, only where the value differs from what it now resolves to
let reapplied = 0;
for (const id of ids) {
  const n = await figma.getNodeByIdAsync(id); if (!n) continue;
  const cur = n.componentProperties; const fix = {};
  for (const [name, val] of Object.entries(before[id].p)) {
    const k = Object.keys(cur).find(x => bare(x) === name);
    if (k && cur[k].value !== val) fix[k] = val;
  }
  if (Object.keys(fix).length) { n.setProperties(fix); reapplied++; }
  for (const [tid, ss] of Object.entries(before[id].ranges)) {
    const t = await figma.getNodeByIdAsync(tid);
    if (t && segs(t).length !== ss.length) for (const g of ss) t.setRangeFills(g.s, g.e, g.f);
  }
}
// a reapplied INSTANCE_SWAP renames the swapped layer to the main's name (Icon/grid => 🔁 Icon): put each name back
let renamed = 0;
for (const id of ids) {
  const n = await figma.getNodeByIdAsync(id); if (!n || !dif(before[id].rows, shown(n)).length) continue;
  for (const [cid, nm] of Object.entries(before[id].names)) { const c = await figma.getNodeByIdAsync(cid); if (c && c.name !== nm) { c.name = nm; renamed++; } }
}

// 5. diff
const bad = [], roots = {};
for (const id of ids) {
  const n = await figma.getNodeByIdAsync(id); const b = before[id];
  if (!n) { bad.push({ id, gone: 1 }); continue; }
  const p = props(n); const pd = Object.keys(b.p).filter(k => p[k] !== b.p[k]);
  const d = dif(b.rows, shown(n));
  if (pd.length || d.length) bad.push({ id, pd, d });
  const rt = await figma.getNodeByIdAsync(b.rid); const rd = rt ? r2(rt.height - b.rh) : 'gone';
  if (rd) roots[b.rn + ' ' + b.rid] = rd;
}
const vDiff = set.children.map((v, i) => ({ v: v.name, d: dif(vBefore[i], rows(v)) })).filter(x => x.d.length);
vDiff.push(...dif(mBefore, await mains()).map(d => ({ v: 'mainComponent', d: [d] })));
const hA = []; for (const v of set.children) hA.push(await hash(v)); for (const id of rangedIds) hA.push(await hash(await figma.getNodeByIdAsync(id)));
const hashSame = hB.join() === hA.join();
const order = Object.entries(set.componentPropertyDefinitions).map(([k, d]) => bare(k) + ':' + d.type[0]);
const dangling = [];
for (const v of set.children) for (const n of v.findAll(() => true)) { const refs = n.componentPropertyReferences; if (refs) for (const val of Object.values(refs)) if (val && val.includes('#') && !(val in set.componentPropertyDefinitions) && !n.id.startsWith('I')) dangling.push(n.name + ' ' + val); }
const pages = {};
for (const id of ids) { let p = found.get(id); while (p && p.type !== 'PAGE') p = p.parent; if (p) pages[p.name] = (pages[p.name] || 0) + 1; }
const res = { set: set.name, total: ids.length, pages, ranged: rangedIds.map(id => before[id].rn + ' ' + id), sub: ids.filter(i => i.includes(';')).length, reapplied, renamed, bad: bad.length, variantsSame: !vDiff.length, dangling: dangling.length, hashSame, rootsChanged: Object.keys(roots).length, order, badList: bad.slice(0, 6), vDiff, roots };
if (DRY) throw new Error('DRY RUN ' + JSON.stringify(res));
if (bad.length || dangling.length || !res.variantsSame || !hashSame) throw new Error('GUARD ' + JSON.stringify(res));
return res;
