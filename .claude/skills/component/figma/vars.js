// Paste into use_figma on the client's library file with PAYLOAD from vars.mjs, each
// component entry's `d` filled in. Creates what is missing and leaves what
// exists: a rerun is safe, and an existing variable keeps its bindings.
const PAYLOAD = { primitives: [], component: [] };

const cols = await figma.variables.getLocalVariableCollectionsAsync();
const col = (name) => cols.find((c) => c.name === name);
const PRIM = col('Primitives');
const COMP = col('Component');
const vars = {};
for (const v of await figma.variables.getLocalVariablesAsync()) vars[v.name] = v;
const created = [];
const touched = [];

for (const p of PAYLOAD.primitives) {
  const family = p.name.split('/')[0];
  const KIND = { spacing: 'A space', sizing: 'A fixed size', borderRadius: 'A radius', borderWidth: 'A border width', opacity: 'An opacity', lineHeight: 'A line height' };
  const unit = p.unit ?? '';
  let v = vars[p.name];
  if (!v) {
    v = figma.variables.createVariable(p.name, PRIM, p.type);
    v.setValueForMode(PRIM.modes[0].modeId, p.value);
    v.scopes = [];
    v.hiddenFromPublishing = true;
    v.description = `${KIND[family] || 'A value'}, ${p.value}${unit}.\n\nUsed by ${p.usedBy.join(', ')}.\n\nA raw value: design with the tokens that use it, never with this one.`;
    vars[p.name] = v;
    created.push(p.name);
  } else {
    const m = /Used by ([^\n]*)\./.exec(v.description);
    const users = new Set(m ? m[1].split(', ') : []);
    const before = users.size;
    p.usedBy.forEach((u) => users.add(u));
    const unused = /No [^\n]*uses it yet\./.exec(v.description);
    if (m && users.size !== before) { v.description = v.description.replace(m[0], `Used by ${[...users].join(', ')}.`); touched.push(p.name); }
    else if (unused) { v.description = v.description.replace(unused[0], `Used by ${[...users].join(', ')}.`); touched.push(p.name); }
  }
}

for (const c of PAYLOAD.component) {
  if (vars[c.name]) continue;
  const target = vars[c.to];
  if (!target) throw new Error(`${c.name}: no variable ${c.to} to alias`);
  if (!c.d) throw new Error(`${c.name}: write its description first`);
  const v = figma.variables.createVariable(c.name, COMP, c.type);
  v.setValueForMode(COMP.modes[0].modeId, { type: 'VARIABLE_ALIAS', id: target.id });
  if (c.type !== 'TIMING') v.scopes = [];
  v.hiddenFromPublishing = true;
  v.description = c.primitive
    ? `${c.d}\n\nFollows the primitive ${c.to}: no semantic token for it exists yet. Use this one when building the component.`
    : `${c.d}\n\nFollows ${c.to}. Use it when building this component. Anywhere else, use ${c.to}.`;
  vars[c.name] = v;
  created.push(c.name);
}
return { created, touched };
