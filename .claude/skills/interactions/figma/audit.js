// Read-only: audits Interactions sections, one finding per broken rule.
// SECTIONS: the section ids; [] audits every SECTION in the file whose name has "Interactions".
// A section holds the page copy (an instance of the SHELL set), the states and the arrows.
// Cannot see: whether a state is the right one for its piece, whether a note is true,
// and a tail with no layer named for its piece within 24 px (listed under `unchecked`):
// name an arrow after its piece's layer and its tail is measured.
const SECTIONS = [];
const FILL = 0x44 / 255;          // #444, literal
const INTERACTION = '';           // the file's Interaction annotation category id
const ACCENT = '';                // the id of the file's Theme/borderColor/accent variable
const SHELL = '';                 // the app shell set's name, as '<Prefix>AppShell'
if (!INTERACTION || !ACCENT || !SHELL) throw new Error('Set INTERACTION, ACCENT and SHELL first.');
const OPACITY = 0.4, WEIGHT = 2, JOIN = 'ROUND';
const TAIL = 6, HEAD = 8, TOL = 0.75; // from each vertex; the head's arrow lines reach ~1 px past its vertex

const box = n => n.absoluteBoundingBox;
const inside = (p, b) => p[0] > b.x && p[0] < b.x + b.width && p[1] > b.y && p[1] < b.y + b.height;
const onOrIn = (p, b) => p[0] >= b.x && p[0] <= b.x + b.width && p[1] >= b.y && p[1] <= b.y + b.height;
const gap =(p, b) => Math.hypot(Math.max(b.x - p[0], 0, p[0] - b.x - b.width), Math.max(b.y - p[1], 0, p[1] - b.y - b.height));
const r1 = v => Math.round(v * 10) / 10;
// Does segment a-b pass through rect b, its edges shrunk by 1 so a touch is not a crossing
const crossesBox = (a, c, b) => {
  const x0 = b.x + 1, y0 = b.y + 1, x1 = b.x + b.width - 1, y1 = b.y + b.height - 1;
  let t0 = 0, t1 = 1; const dx = c[0] - a[0], dy = c[1] - a[1];
  for (const [p, q] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const t = q / p; if (p < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return true;
};
const cross = (p, q, r, s) => {
  const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return d(p, q, r) * d(p, q, s) < 0 && d(r, s, p) * d(r, s, q) < 0;
};
const setName = async i => { const mc = await i.getMainComponentAsync(); return mc ? (mc.parent.type === 'COMPONENT_SET' ? mc.parent.name : mc.name) : null; };
const noted = n => (n.annotations || []).some(a => a.categoryId === INTERACTION && (a.label || a.labelMarkdown || '').trim());

let ids = SECTIONS;
if (!ids.length) {
  ids = [];
  for (const page of figma.root.children) {
    await figma.setCurrentPageAsync(page);
    for (const s of page.findAllWithCriteria({ types: ['SECTION'] })) if (s.name.includes('Interactions')) ids.push(s.id);
  }
}

const report = [];
for (const id of ids) {
  const s = await figma.getNodeByIdAsync(id);
  if (!s) { report.push({ id, findings: ['no such node'] }); continue; }
  let page = s; while (page.type !== 'PAGE') page = page.parent;
  await figma.setCurrentPageAsync(page);
  const f = [], unchecked = [];
  const fill = s.fills.length === 1 && s.fills[0];
  if (!fill || fill.type !== 'SOLID' || [fill.color.r, fill.color.g, fill.color.b].some(c => Math.abs(c - FILL) > 0.002) || fill.opacity !== 1 || (fill.boundVariables && fill.boundVariables.color)) f.push('section fill is not #444 literal');

  let copy = null; const states = [], arrows = [];
  for (const n of s.children) {
    if (!n.visible) continue;
    if (n.name.startsWith('Arrow · ')) { arrows.push(n); continue; }
    if (!copy && n.type === 'INSTANCE' && await setName(n) === SHELL) { copy = n; continue; }
    states.push(n);
  }
  if (!copy) f.push(`no page copy (an ${SHELL} instance)`);

  // States: named "<Piece> · <state>", an instance or a frame holding one, an Interaction note
  for (const n of states) {
    if (!/^.+ · .+$/.test(n.name)) f.push(`${n.name}: not named "<Piece> · <state>"`);
    if (n.type === 'INSTANCE') {
      if (!await n.getMainComponentAsync()) f.push(`${n.name}: its component is gone`);
      if (!noted(n)) f.push(`${n.name}: no Interaction annotation`);
    } else {
      const held = 'findAllWithCriteria' in n ? n.findAllWithCriteria({ types: ['INSTANCE'] }) : [];
      if (!held.length) f.push(`${n.name}: a ${n.type}, not an instance`);
      if (!noted(n) && !held.some(noted)) f.push(`${n.name}: no Interaction annotation`);
      const detached = 'findAll' in n ? n.findAll(d => d.type === 'FRAME' && d.detachedInfo) : [];
      if (n.type === 'FRAME' && n.detachedInfo) detached.unshift(n);
      for (const d of detached) f.push(`${n.name}: detached instance "${d.name}"`);
    }
  }
  for (const n of s.findAll(n => (n.annotations || []).some(a => a.categoryId !== INTERACTION))) f.push(`${n.name}: an annotation outside Interaction`);

  // Arrows: the recipe, the two gaps, and nothing crossed
  const lines = [], aimed = new Set();
  for (const a of arrows) {
    const name = a.name;
    if (a.type !== 'VECTOR') { f.push(`${name}: a ${a.type}, not a VECTOR`); continue; }
    const vn = a.vectorNetwork;
    if (vn.vertices.length !== 2 || vn.segments.length !== 1) { f.push(`${name}: ${vn.vertices.length} vertices, ${vn.segments.length} segments`); continue; }
    const hv = vn.vertices.find(v => v.strokeCap === 'ARROW_LINES'), tv = vn.vertices.find(v => v.strokeCap === 'NONE');
    if (!hv || !tv) { f.push(`${name}: caps ${vn.vertices.map(v => v.strokeCap).join(', ')}`); continue; }
    if (a.strokeWeight !== WEIGHT) f.push(`${name}: stroke ${String(a.strokeWeight)}`);
    if (a.strokeJoin !== JOIN) f.push(`${name}: join ${String(a.strokeJoin)}`);
    const p = a.strokes.length === 1 && a.strokes[0];
    if (!p || !p.boundVariables || !p.boundVariables.color || p.boundVariables.color.id !== ACCENT) f.push(`${name}: stroke not bound to Theme/borderColor/accent`);
    if (!p || Math.abs(p.opacity - OPACITY) > 0.01) f.push(`${name}: paint opacity ${p ? r1(p.opacity) : '-'}`);
    const t = a.absoluteTransform;
    const at = v => [t[0][0] * v.x + t[0][1] * v.y + t[0][2], t[1][0] * v.x + t[1][1] * v.y + t[1][2]];
    const head = at(hv), tail = at(tv);
    // Where it starts: a state it starts in or on, else the page copy
    const origin = states.find(st => onOrIn(tail, box(st))) || copy;
    // Head: a state it lands in is its target and a fault, else the nearest state
    let target = states.find(st => st !== origin && inside(head, box(st)));
    if (target) f.push(`${name}: head inside ${target.name}`);
    else {
      let d = Infinity;
      for (const st of states) { if (st === origin) continue; const g = gap(head, box(st)); if (g < d) { d = g; target = st; } }
      if (!target) f.push(`${name}: its head reaches no state`);
      else if (Math.abs(d - HEAD) > TOL) f.push(`${name}: head ${r1(d)} px off ${target.name}, not ${HEAD}`);
    }
    if (target) aimed.add(target);
    // Tail: the layer named for the piece, or one of its ancestors, inside where it starts
    // "Arrow · Grabber · half" is Grabber's second arrow: its piece is the first segment
    const rest = name.slice('Arrow · '.length).toLowerCase(), first = rest.split(' · ')[0];
    const is = s => s === rest || s === first;
    const named = origin ? origin.findAll(n => n.visible && (is(n.name.toLowerCase()) || (n.type === 'TEXT' && is(n.characters.toLowerCase())))) : [];
    const around = new Set();
    for (let n of named) for (; n && n !== origin; n = n.parent) around.add(n);
    const gaps = [...around].filter(n => box(n) && !onOrIn(tail, box(n))).map(n => gap(tail, box(n)));
    // A layer of that name this far off is another layer, not the piece
    if (!gaps.length || Math.min(...gaps) > 4 * TAIL) unchecked.push(name);
    else if (!gaps.some(g => Math.abs(g - TAIL) <= TOL)) f.push(`${name}: tail ${r1(Math.min(...gaps))} px off "${first}", not ${TAIL}`);
    // Crossing a state other than its own target and the one it starts in
    for (const st of states) if (st !== target && st !== origin && crossesBox(tail, head, box(st))) f.push(`${name}: crosses ${st.name}`);
    lines.push([name, tail, head]);
  }
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) if (cross(lines[i][1], lines[i][2], lines[j][1], lines[j][2])) f.push(`${lines[i][0]}: crosses ${lines[j][0]}`);
  for (const st of states) if (!aimed.has(st)) f.push(`${st.name}: no arrow reaches it`);

  report.push({ id, page: page.name, name: s.name, states: states.length, arrows: arrows.length, findings: f, unchecked });
}
return { sections: report.length, findings: report.reduce((n, r) => n + r.findings.length, 0), report };
