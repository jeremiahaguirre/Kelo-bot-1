// Loads the game once and lists page errors, console errors and three.js warnings (deduplicated).
const { chromium } = require('playwright');
const path = require('path'), http = require('http'), fs = require('fs');
const ROOT = process.env.KELO_ROOT, PORT = +process.env.PORT || 8930, V = path.join(__dirname, 'vendor');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
(async () => {
  const srv = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(d); }); });
  await new Promise(r => srv.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const seen = new Map();
  const note = (k, t) => { const key = k + ' ' + t.slice(0, 300); seen.set(key, (seen.get(key) || 0) + 1); };
  page.on('pageerror', e => note('PAGEERROR', e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') note(m.type(), m.text()); });
  page.on('requestfailed', r => note('reqfail', r.url()));
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.includes('cdn.tailwindcss.com')) return route.fulfill({ path: path.join(V, 'tailwind.js'), contentType: 'application/javascript' });
    if (u.includes('phosphor-icons')) return route.fulfill({ body: '', contentType: 'application/javascript' });
    if (u.startsWith(`http://localhost:${PORT}`)) return route.continue();
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`http://localhost:${PORT}/index.html`, { timeout: 600000 });
  await page.waitForTimeout(+process.env.WAIT || 20000);
  console.log('three', await page.evaluate(() => typeof THREE !== 'undefined' && THREE.REVISION), 'renderer', await page.evaluate(() => typeof renderer !== 'undefined' && !!renderer));
  for (const [k, n] of seen) console.log(n + 'x', k);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  await browser.close(); srv.close();
})();
