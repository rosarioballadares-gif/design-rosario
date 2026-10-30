// Read-only: every set in the file, one row each.
// page | id | name | set description length | variants/described | order ok or REORDER | 👁️ variants | properties as they list
const bare = k => k.includes('#') ? k.slice(0, k.lastIndexOf('#')) : k;
const rows = [];
for (const page of figma.root.children) {
  await figma.setCurrentPageAsync(page);
  for (const set of page.findAllWithCriteria({ types: ['COMPONENT_SET'] })) {
    const defs = set.componentPropertyDefinitions;
    const recreatable = Object.keys(defs).filter(k => ['BOOLEAN', 'TEXT', 'INSTANCE_SWAP'].includes(defs[k].type));
    // the same order prop-order.js derives: each variant's layer order merged topologically
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
    const inOrder = recreatable.join() === [...inLayers, ...recreatable.filter(k => !inLayers.includes(k))].join();
    const eye = Object.keys(defs).filter(k => defs[k].type === 'VARIANT' && k.startsWith('👁')).join(',');
    const described = set.children.filter(v => v.description.trim()).length;
    rows.push([page.name, set.id, set.name, set.description.length, set.children.length + '/' + described, inOrder ? 'ok' : 'REORDER', eye, inOrder ? '' : Object.entries(defs).map(([k, d]) => bare(k) + ':' + d.type[0]).join(' ')].join(' | '));
  }
}
return { sets: rows.length, rows };
