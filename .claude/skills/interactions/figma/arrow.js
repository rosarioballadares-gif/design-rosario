// Draws arrows in an Interactions section, each from a piece of the page copy to its state.
// The tail sits TAIL px off the piece, the head HEAD px off the state, each square to the side
// that faces the other; a crossing throws, and a throw persists none of them.
// SECTION: the section id. ARROWS: [piece, state, side] each — the piece's layer in the copy
// (or in a state, for a chain), the state's id (a direct child of the section), and the
// piece's side the arrow leaves from, 'left' | 'right' | 'top' | 'bottom', or null for the
// one facing the state. Each is named "Arrow · <piece's layer name>", so audit.js finds its
// piece; a second from the same piece adds its state, as "Arrow · Grabber · half".
const SECTION = '', ARROWS = [];
const ACCENT = '', OPACITY = 0.4, WEIGHT = 2; // ACCENT: the id of the file's Theme/borderColor/accent variable
if (!ACCENT) throw new Error('Set ACCENT first.');
const TAIL = 6, HEAD = 8;

const section = await figma.getNodeByIdAsync(SECTION);
let page = section; while (page.type !== 'PAGE') page = page.parent;
await figma.setCurrentPageAsync(page);
const accent = await figma.variables.getVariableByIdAsync(ACCENT);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const inBox = (p, b) => p[0] >= b.x && p[0] <= b.x + b.width && p[1] >= b.y && p[1] <= b.y + b.height;
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

const drawn = [];
for (const [PIECE, STATE, SIDE] of ARROWS) {
  const piece = await figma.getNodeByIdAsync(PIECE), state = await figma.getNodeByIdAsync(STATE);
  if (state.parent !== section) throw new Error(`${state.name} is not a child of ${section.name}`);
  const P = piece.absoluteBoundingBox, S = state.absoluteBoundingBox;

  // The piece's side that faces the state: the axis with the larger separation
  const side = SIDE || (() => {
    const dx = S.x >= P.x + P.width ? S.x - P.x - P.width : P.x >= S.x + S.width ? P.x - S.x - S.width : -1;
    const dy = S.y >= P.y + P.height ? S.y - P.y - P.height : P.y >= S.y + S.height ? P.y - S.y - S.height : -1;
    if (dx < 0 && dy < 0) throw new Error(`${piece.name} and ${state.name} overlap: set its side`);
    return dx >= dy ? (S.x > P.x ? 'right' : 'left') : (S.y > P.y ? 'bottom' : 'top');
  })();
  // Along its side each end lines up with the other box's centre, clamped to its own box
  let tail, head;
  if (side === 'left' || side === 'right') {
    const y = clamp(S.y + S.height / 2, P.y, P.y + P.height);
    tail = [side === 'right' ? P.x + P.width + TAIL : P.x - TAIL, y];
    head = [side === 'right' ? S.x - HEAD : S.x + S.width + HEAD, clamp(y, S.y, S.y + S.height)];
  } else {
    const x = clamp(S.x + S.width / 2, P.x, P.x + P.width);
    tail = [x, side === 'bottom' ? P.y + P.height + TAIL : P.y - TAIL];
    head = [clamp(x, S.x, S.x + S.width), side === 'bottom' ? S.y - HEAD : S.y + S.height + HEAD];
  }

  const taken = section.children.some(n => n.name === `Arrow · ${piece.name}`);
  const name = `Arrow · ${piece.name}` + (taken ? ` · ${state.name.slice(state.name.indexOf(' · ') + 3)}` : '');
  // Nothing crossed: another arrow, or a box other than its state's and the one it starts in
  const crossed = [];
  for (const n of section.children) {
    if (!n.visible || n === state) continue;
    if (n.name === name) throw new Error(`${name} already exists: ${n.id}`);
    if (n.name.startsWith('Arrow · ') && n.type === 'VECTOR') {
      const t = n.absoluteTransform, at = v => [t[0][0] * v.x + t[0][1] * v.y + t[0][2], t[1][0] * v.x + t[1][1] * v.y + t[1][2]];
      const [a, b] = n.vectorNetwork.vertices.map(at);
      if (a && b && cross(tail, head, a, b)) crossed.push(n.name);
    } else if (n.absoluteBoundingBox && !inBox(tail, n.absoluteBoundingBox) && crossesBox(tail, head, n.absoluteBoundingBox)) crossed.push(n.name);
  }
  if (crossed.length) throw new Error(`${name} would cross ${crossed.join(', ')}: move the state or set its side`);

  // The recipe: a straight VECTOR, stroke 2 on Theme/borderColor/accent at 0.4, caps NONE and ARROW_LINES
  const o = section.absoluteTransform;
  const lt = [tail[0] - o[0][2], tail[1] - o[1][2]], lh = [head[0] - o[0][2], head[1] - o[1][2]];
  const x = Math.min(lt[0], lh[0]), y = Math.min(lt[1], lh[1]);
  const v = figma.createVector();
  section.appendChild(v);
  v.name = name;
  await v.setVectorNetworkAsync({
    vertices: [{ x: lt[0] - x, y: lt[1] - y, strokeCap: 'NONE' }, { x: lh[0] - x, y: lh[1] - y, strokeCap: 'ARROW_LINES' }],
    segments: [{ start: 0, end: 1 }],
  });
  v.x = x; v.y = y;
  v.strokes = [figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: OPACITY }, 'color', accent)];
  v.strokeWeight = WEIGHT;
  v.strokeJoin = 'ROUND';
  v.fills = [];
  drawn.push({ id: v.id, name, side });
}
return { createdNodeIds: drawn.map(d => d.id), drawn };
