// Tags each catalogue name with where it ends up: shelf (Storehouse / hands / Post Office),
// parts-line (counted inside a parts-kit crate, never shelved alone), sub-assembly or build (built in place),
// painting (hangs in the Museum as a picture). Usage: node classify.js catalogue.json > classes.json
const fs = require('fs'), vm = require('vm');
const ROOT = process.env.KELO_ROOT || '/home/user/kelo-bot-1';
const cat = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const src = fs.readFileSync(ROOT + '/js/bom.js', 'utf8');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(src.slice(0, src.indexOf('function bomTemplateFor')) + '\nthis.T = BOM_TEMPLATES;', ctx);
const lines = new Set(), subs = new Set(), tools = new Set(), builds = new Set();
Object.values(ctx.T).forEach(t => {
  builds.add(t.name.toLowerCase());
  (t.subs || []).forEach(s => { subs.add(s.name.toLowerCase()); (s.lines || []).forEach(l => lines.add(String(l[0]).toLowerCase())); });
  (t.tools || []).forEach(x => tools.add(String(Array.isArray(x) ? x[1] : x.name || x).toLowerCase()));
});
const out = cat.map(c => {
  const n = c.name.toLowerCase(), f = c.src.split(':')[0];
  let where = 'shelf';
  if (tools.has(n)) where = 'shelf';
  else if (subs.has(n)) where = 'sub-assembly';
  else if (lines.has(n)) where = 'parts-line';
  else if (builds.has(n) || (/\.item$/.test(c.src) && !/guitar|quadcopter|drone/.test(n)) || (/BUILD_PLANS/.test(c.src) && /^(birdhouse|picnic table|garden bench|raised garden bed|bird feeder|wind chime|doghouse|kayak rack|treehouse platform)$/.test(n))) where = 'build';
  else if (f === 'paintstudio.js' && !/^(an?|the) /i.test(c.name) && !/easel|jar|palette/i.test(c.name)) where = 'painting';
  return { ...c, where };
});
const count = {}; out.forEach(o => count[o.where] = (count[o.where] || 0) + 1);
console.error(count);
process.stdout.write(JSON.stringify(out, null, 1));
