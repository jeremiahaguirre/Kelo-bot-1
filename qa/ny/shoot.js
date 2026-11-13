// Usage: node shoot.js <steps.js>  — loads the game once and runs the steps module: module.exports = async (api) => {...}
const { chromium } = require('playwright');
const path = require('path'), http = require('http'), fs = require('fs');
const V = path.join(__dirname, '..', 'vendor');
const OUT = process.env.OUT || path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const ROOT = process.env.KELO_ROOT || '/home/user/Kelo-bot-1';
const PORT = +process.env.PORT || 8911;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
(async () => {
  const srv = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(data); });
  });
  await new Promise(r => srv.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: +process.env.VW || 1280, height: +process.env.VH || 800 }, deviceScaleFactor: +process.env.DSF || 1 });
  const errors = [];
  page.on('pageerror', e => { errors.push(e.message); console.log('PAGEERROR', e.message); });
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.includes('three.min.js')) return route.fulfill({ path: path.join(V, 'three.min.js'), contentType: 'application/javascript' });
    if (u.includes('OrbitControls.js')) return route.fulfill({ path: path.join(V, 'OrbitControls.js'), contentType: 'application/javascript' });
    if (u.includes('cdn.tailwindcss.com')) return route.fulfill({ path: path.join(V, 'tailwind.js'), contentType: 'application/javascript' });
    if (u.includes('phosphor-icons')) return route.fulfill({ body: '', contentType: 'application/javascript' });
    if (u.startsWith(`http://localhost:${PORT}`)) return route.continue();
    return route.fulfill({ status: 404, body: '' });
  });
  if (process.env.SAVE) await page.addInitScript(s => { try { localStorage.setItem(s.k, s.v); } catch (e) {} }, JSON.parse(fs.readFileSync(process.env.SAVE, 'utf8')));
  await page.goto(`http://localhost:${PORT}/index.html`, { timeout: 420000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => { state.isCollectingMail = true; });
  const api = {
    page, errors, OUT,
    ev: (fn, arg) => page.evaluate(fn, arg),
    look: (p, t) => page.evaluate(([p, t]) => { state.cameraMode = 'none'; camera.position.set(...p); if (typeof controls !== 'undefined' && controls) { controls.target.set(...t); controls.update(); } else camera.lookAt(...t); }, [p, t]),
    shot: async name => { await page.waitForTimeout(+process.env.WAIT || 1500); await page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 300000 }); console.log('shot', name); },
    wait: ms => page.waitForTimeout(ms)
  };
  try { await require(path.resolve(process.argv[2]))(api); } catch (e) { console.log('STEP ERROR', e.stack || e); }
  console.log('errors:', errors.length);
  await browser.close(); srv.close();
})();
