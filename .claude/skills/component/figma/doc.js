// Paste into use_figma on the client's library file after build.js. Puts the set
// in its own Section, to the right of the page's last one, and clones the model
// documentation frame beside it with DOC's copy.
//
// MODEL_SECTION, MODEL_DOC  the Section and the documentation frame every later
// component copies: the first component's, drawn by hand (SKILL.md, step 8).
// FONT  the family the documentation frame is set in, with its four weights.
//
// STAGES lists the instances drawn on the Dark and the Light stage, each as the
// properties to set: { 'Off <--> On': 'On', '✏️ Label': 'On' }. A property
// name may omit its `#id` suffix.
const SET_ID = '';
const SECTION = 'Example';
const DOC = {
  title: 'Example',
  summary: '',
  code: '<Prefix>Example in code, src/ds/components/<Prefix>Example.tsx. Controls/<Prefix>Example in Storybook.',
  variants: '',
  variantLines: [],
  goesIn: '',
  doesNotGoIn: '',
  particularity: '',
  useWhen: [],
  do: [],
  dont: [],
  record: 'src/ds/guidance/records/<Prefix>Example.ts',
};
const STAGES = [];

const MODEL_SECTION = '';
const MODEL_DOC = '';
const FONT = '';
if (!MODEL_SECTION || !MODEL_DOC || !FONT) throw new Error('Set MODEL_SECTION, MODEL_DOC and FONT first.');
for (const style of ['Regular', 'Medium', 'SemiBold', 'Bold']) await figma.loadFontAsync({ family: FONT, style });
const set = await figma.getNodeByIdAsync(SET_ID);
const page = set.parent.type === 'PAGE' ? set.parent : set.parent.parent;
await figma.setCurrentPageAsync(page);
const model = await figma.getNodeByIdAsync(MODEL_SECTION);

const section = figma.createSection();
section.name = SECTION;
section.fills = model.fills;
const others = page.children.filter((n) => n.type === 'SECTION' && n !== section);
section.x = others.length ? Math.max(...others.map((n) => n.x + n.width)) + 100 : 0;
section.y = others.length ? Math.min(...others.map((n) => n.y)) : 0;
section.appendChild(set);
set.x = 80;
set.y = 80;

const doc = (await figma.getNodeByIdAsync(MODEL_DOC)).clone();
section.appendChild(doc);
doc.name = `${SECTION} — documentation`;
doc.x = set.x + set.width + 80;
doc.y = 80;

const put = (t, s) => { t.characters = s; t.name = s.slice(0, 40); };
function list(frame, items, prefix) {
  const [, first] = frame.children;
  while (frame.children.length > 2) frame.children[2].remove();
  if (!items.length) { first.remove(); return; }
  put(first, prefix + items[0]);
  for (const item of items.slice(1)) { const t = first.clone(); frame.appendChild(t); put(t, prefix + item); }
}
const [header, variants, where, usage] = doc.children;
put(header.children[0], DOC.title);
put(header.children[1], DOC.summary);
put(header.children[2], DOC.code);
put(variants.children[1], DOC.variants);
const lines = variants.children[3];
while (lines.children.length > 1) lines.children[1].remove();
put(lines.children[0], DOC.variantLines[0] || '');
for (const s of DOC.variantLines.slice(1)) { const t = lines.children[0].clone(); lines.appendChild(t); put(t, s); }
if (!DOC.variantLines.length) lines.remove();
put(where.children[1].children[1], DOC.goesIn);
put(where.children[2].children[1], DOC.doesNotGoIn);
put(where.children[3].children[1], DOC.particularity);
put(usage.children[1], `The rule an agent reads before placing one, from ${DOC.record}.`);
list(usage.children[2], DOC.useWhen, '• ');
list(usage.children[3], DOC.do, '• ');
list(usage.children[4], DOC.dont, '• ');

const byName = {};
for (const k of Object.keys(set.componentPropertyDefinitions)) byName[k.split('#')[0]] = k;
// Two stages side by side crop a set wider than the documentation column.
variants.children[2].layoutMode = set.width > 450 ? 'VERTICAL' : 'HORIZONTAL';
const stages = variants.children[2].children;
const created = [];
for (const stage of stages) {
  while (stage.children.length > 1) stage.children[1].remove();
  for (const props of STAGES) {
    const inst = set.defaultVariant.createInstance();
    stage.appendChild(inst);
    const full = {};
    for (const [k, v] of Object.entries(props)) full[byName[k] || k] = v;
    inst.setProperties(full);
    created.push(inst.id);
  }
}

const desc = [DOC.summary, `Goes in: ${DOC.goesIn}`, `Does not go in: ${DOC.doesNotGoIn}`, `Particularity: ${DOC.particularity}`, DOC.variantLines.join('\n')].filter(Boolean);
set.description = desc.join('\n\n');
section.resizeWithoutConstraints(doc.x + doc.width + 80, Math.max(set.y + set.height, doc.y + doc.height) + 80);
return { sectionId: section.id, docId: doc.id, createdNodeIds: created, size: [section.width, section.height] };
