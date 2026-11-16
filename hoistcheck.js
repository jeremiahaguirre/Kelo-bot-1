// Finds code that runs while a script loads (outside any function) and names a top-level function that
// only a LATER script declares. Separate <script> tags see undefined there; one bundle sees the function.
// Usage: node hoistcheck.js <repo>
const acorn = require('acorn'), walk = require('acorn-walk'), fs = require('fs'), path = require('path');
const ROOT = process.argv[2];
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const files = [...html.split('</head>')[1].matchAll(/<script src="\.\/(js\/[^"]+)"/g)].map(m => m[1]);
const asts = files.map(f => acorn.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'), { ecmaVersion: 'latest', locations: true }));
const fnDecls = asts.map(a => new Set(a.body.filter(n => n.type === 'FunctionDeclaration').map(n => n.id.name)));
let hits = 0;
asts.forEach((ast, i) => {
  const later = new Map(); fnDecls.forEach((s, k) => { if (k > i) s.forEach(n => { if (!later.has(n)) later.set(n, files[k]); }); });
  const own = new Set(); fnDecls.slice(0, i + 1).forEach(s => s.forEach(n => own.add(n)));
  for (const stmt of ast.body) {
    if (stmt.type === 'FunctionDeclaration') continue;
    walk.recursive(stmt, null, {
      Function() {}, // bodies run later, not at load
      MemberExpression(n, st, c) { if (n.object.type === 'Identifier' && /^(window|globalThis|self)$/.test(n.object.name) && !n.computed && later.has(n.property.name)) { hits++; console.log(`${files[i]}:${n.loc.start.line} names window.${n.property.name}`); } c(n.object, st); if (n.computed) c(n.property, st); },
      Identifier(n) { if (later.has(n.name) && !own.has(n.name)) { hits++; console.log(`${files[i]}:${n.loc.start.line} names ${n.name} (declared in ${later.get(n.name)})`); } }
    }, walk.base);
  }
});
console.log(`${files.length} scripts checked: ` + (hits ? `${hits} load-time references to later functions` : 'no load-time code names a function from a later script'));
