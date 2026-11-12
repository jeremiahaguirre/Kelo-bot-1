// Builds the judged table for REPORT.md from the before/after measurements (items.json files from itemsheet.js)
const fs = require('fs');
const cls = {}; require('./classes.json').forEach(c => (cls[c.name] = c));
const load = f => { const m = {}; try { require(f).forEach(r => (m[r.name] = r)); } catch (e) {} return m; };
const before = { ...load('./before/cat.json'), ...load('./before/ai.json') };
const after = { ...load('./after/shelf.json'), ...load('./after/ai.json') };
const generic = r => r && /INFERRED|FORM|CATEGORY/.test(r.route) && !/^glb/.test(r.route);
const dims = r => r && r.m ? r.m.map(v => v >= 1 ? v.toFixed(2) + ' m' : Math.round(v * 100) + ' cm').join(' × ') : '';
const LEFT = require('./left.json'); // name -> what is still not right
const esc = s => String(s).replace(/\|/g, '\\|');
const rows = [], counts = { shelf: 0, beforeGeneric: 0, beforeChanged: 0, beforeFloat: 0, afterGeneric: 0, left: 0 };
const names = [...new Set([...require('./classes.json').map(c => c.name), ...require('./ai-names.json')])];
names.forEach(n => {
  const c = cls[n] || { src: 'AI sample', where: 'shelf' };
  const b = before[n], a = after[n];
  let bv = 'ok', av = '';
  if (!b) bv = '—';
  else if (generic(b)) bv = 'generic fallback';
  else if (a && a.route !== b.route) bv = 'wrong object/route';
  if (b && b.minY !== undefined && Math.abs(b.minY) > 0.005) bv += (bv === 'ok' ? '' : '; ') + (b.minY > 0 ? 'floating' : 'sunk') + ` ${Math.round(b.minY * 100)} cm`;
  if (c.where !== 'shelf') av = 'not shelved (' + c.where + ')';
  else if (!a) av = '—';
  else if (LEFT[n]) av = 'LEFT: ' + LEFT[n];
  else if (generic(a)) av = 'generic';
  else av = 'ok';
  if (c.where === 'shelf' || c.src === 'AI sample') {
    counts.shelf++;
    if (b && generic(b)) counts.beforeGeneric++;
    if (/wrong/.test(bv)) counts.beforeChanged++;
    if (/floating|sunk/.test(bv)) counts.beforeFloat++;
    if (a && generic(a) && !LEFT[n]) counts.afterGeneric++;
    if (LEFT[n]) counts.left++;
  }
  rows.push(`| ${esc(n)} | ${esc(c.src.split(':')[0])} | ${esc(bv)} | ${esc(av)} | ${esc(dims(a || b))} | ${esc(((a || b) || {}).route || '').slice(0, 60)} |`);
});
fs.writeFileSync('table.md', '| Item | Source | Before | After | Real size (after) | Model route (after) |\n|---|---|---|---|---|---|\n' + rows.join('\n') + '\n');
console.log(JSON.stringify(counts));
