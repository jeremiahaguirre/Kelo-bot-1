// node perftable.js : the before/after table from ../results/{before,after}-{fast,balanced}[-phone].txt
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '../results');
const read = f => { try { const l = fs.readFileSync(path.join(R, f), 'utf8').split('\n').find(x => x.startsWith('RESULT ')); return l ? JSON.parse(l.slice(7)).out : null; } catch (e) { return null; } };
const rows = ['| Preset | View | Draw calls before → after | Triangles before → after | JS ms/frame before → after | Frame ms before → after |', '|---|---|---|---|---|---|'];
for (const g of ['fast', 'balanced']) for (const ph of ['', '-phone']) {
  const b = read(`before-${g}${ph}.txt`), a = read(`after-${g}${ph}.txt`);
  if (!b || !a) continue;
  for (const v of Object.keys(b)) {
    if (!a[v]) continue;
    const pct = (x, y) => `${x} → ${y} (${y >= x ? '+' : ''}${Math.round((y - x) / x * 100)}%)`;
    rows.push(`| ${g}${ph ? ' (phone 390×844)' : ''} | ${v} | ${pct(b[v].calls, a[v].calls)} | ${pct(b[v].tris, a[v].tris)} | ${b[v].js} → ${a[v].js} | ${b[v].frame} → ${a[v].frame} |`);
  }
}
console.log(rows.join('\n'));
