// node run.js <steps.js>  — load the game once, run an async steps module (exports async (page, h) => {})
const { chromium } = require('playwright');
const path = require('path'), http = require('http'), fs = require('fs');
const V = path.join(__dirname, '..', 'qa', 'vendor');
const ROOT = process.env.KELO_ROOT || '/home/user/Kelo-bot-1';
const PORT = +process.env.PORT || 8911;
const OUT = process.env.OUT || path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream' };
(async () => {
  const srv = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(data); });
  });
  await new Promise(r => srv.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: +process.env.VW || 1280, height: +process.env.VH || 800 }, deviceScaleFactor: +process.env.DSF || 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => { errors.push(e.message); if (errors.filter(x => x === e.message).length < 2) console.log('PAGEERROR', e.message, (e.stack || '').split('\n').slice(0, 8).join(' | ')); });
  page.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/Failed to load resource/.test(t)) console.log('console.error:', t); if (/^\[farm\]/.test(t)) console.log(t); });
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.includes('three.min.js')) return route.fulfill({ path: path.join(V, 'three.min.js'), contentType: 'application/javascript' });
    if (u.includes('OrbitControls.js')) return route.fulfill({ path: path.join(V, 'OrbitControls.js'), contentType: 'application/javascript' });
    if (u.includes('cdn.tailwindcss.com')) return route.fulfill({ path: path.join(V, 'tailwind.js'), contentType: 'application/javascript' });
    if (u.includes('phosphor-icons')) return route.fulfill({ body: '', contentType: 'application/javascript' });
    if (u.includes('generativelanguage') || u.includes('anthropic.com')) return route.fulfill({ status: 500, body: '{}' });
    if (u.includes('wikipedia.org')) return route.fulfill({ body: '{"query":{"search":[]}}', contentType: 'application/json' });
    if (u.startsWith(`http://localhost:${PORT}`)) return route.continue();
    return route.fulfill({ status: 404, body: '' });
  });
  if (process.env.PRESAVE) await page.addInitScript(fs.readFileSync(process.env.PRESAVE, 'utf8'));
  await page.goto(`http://localhost:${PORT}/index.html`, { timeout: 420000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => { state.isCollectingMail = true; });
  // QA only: NORENDER=1 skips drawing (the simulation still runs every frame) so long fast-time cycles are
  // not held back by the software renderer; screenshots turn drawing back on (h.render(true))
  // QA only: WARP=N runs his walking/driving simulation N times faster (keloSimAdvance sees N x the elapsed time)
  if (process.env.WARP) await page.evaluate(n => { const orig = keloSimAdvance; let base = null; keloSimAdvance = function (t) { if (base === null) base = t; return orig(base + (t - base) * n); }; }, +process.env.WARP);
  if (process.env.NORENDER) await page.evaluate(() => { const r = renderer.render.bind(renderer); window.__noRender = true; renderer.render = function (...a) { if (!window.__noRender) return r(...a); }; });
  const h = {
    page, errors, OUT,
    shot: async (name, opts = {}) => { try { await page.screenshot({ path: path.join(OUT, name + (opts.type === 'jpeg' ? '.jpg' : '.png')), timeout: 300000, ...opts }); console.log('shot', name); } catch (e) { console.log('shot FAILED', name, e.message); } },
    look: (px, py, pz, tx, ty, tz) => page.evaluate(([px, py, pz, tx, ty, tz]) => { state.cameraMode = 'none'; camera.position.set(px, py, pz); if (typeof controls !== 'undefined' && controls) { controls.target.set(tx, ty, tz); controls.update(); } else camera.lookAt(tx, ty, tz); }, [px, py, pz, tx, ty, tz]),
    ev: (fn, arg) => page.evaluate(fn, arg),
    wait: ms => page.waitForTimeout(ms),
    log: (...a) => console.log(...a),
    render: on => page.evaluate(v => { window.__noRender = !v; }, on)
  };
  try { await require(path.resolve(process.argv[2]))(page, h); } catch (e) { console.log('STEPS FAILED', e && e.stack || e); errors.push('steps: ' + e.message); }
  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close(); srv.close();
  process.exit(errors.length ? 1 : 0);
})();
