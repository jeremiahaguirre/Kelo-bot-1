// Shared boot for the skins tests (same server and routes as harness.js), plus a virtual clock:
// after vtOn(), requestAnimationFrame and performance.now are driven by step(n, dt), and
// rendering can be skipped for speed (noRender). Math.random can be seeded (seed(n)).
const { chromium } = require('playwright');
const path = require('path'), http = require('http'), fs = require('fs');
const V = path.join(__dirname, 'vendor');
const ROOT = process.env.KELO_ROOT || '/home/user/kelo-bot-1';
const PORT = +process.env.PORT || 8765;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

function startServer() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(p, (err, data) => {
        if (err) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    srv.on('error', () => resolve(null));
    srv.listen(PORT, () => resolve(srv));
  });
}

const VT_INIT = `(() => {
  const realRAF = window.requestAnimationFrame.bind(window), realNow = performance.now.bind(performance);
  const vt = window.__vt = { on: false, t: 0, q: [], noRender: false, rnd: null };
  performance.now = () => vt.on ? vt.t : realNow();
  window.requestAnimationFrame = cb => { if (vt.on) { vt.q.push(cb); return 1; } return realRAF(cb); };
  const realRandom = Math.random;
  Math.random = () => { if (!vt.rnd || !vt.inStep) return realRandom(); let t = vt.rnd += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  window.__seed = n => { vt.rnd = n >>> 0 || 1; };
  // the game loop's next frame must land in the manual queue before stepping: await __vtOn()
  // fixedElapsed: put the game clock at exactly this many seconds (so every run's timers line up)
  const realDateNow = Date.now.bind(Date);
  let dateBase = 0;
  window.__vtOn = (fixedElapsed) => {
    vt.t = realNow();
    if (fixedElapsed && typeof clock !== 'undefined' && clock) vt.t = clock.oldTime + (fixedElapsed - clock.elapsedTime) * 1000;
    vt.on = true;
    return new Promise(r => { const chk = () => vt.q.length ? r() : setTimeout(chk, 10); chk(); });
  };
  window.__vtOff = () => { vt.on = false; const q = vt.q; vt.q = []; q.forEach(cb => realRAF(cb)); };
  window.__step = (n, dt) => {
    for (let i = 0; i < n; i++) {
      vt.t += dt * 1000;
      if (window.__beforeStep) window.__beforeStep();
      const q = vt.q; vt.q = [];
      // only the frame itself draws from the seeded stream (timers between frames use their own)
      vt.inStep = true;
      try { q.forEach(cb => cb(vt.t)); } finally { vt.inStep = false; }
      if (window.__afterStep) window.__afterStep();
    }
  };
})();`;

async function boot({ width = 1280, height = 800, dpr = 1, preload = null } = {}) {
  const server = await startServer();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) console.log('console.error:', m.text()); });
  await page.addInitScript(VT_INIT);
  if (preload) await page.addInitScript(preload);
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
  const load = async () => {
    await page.goto(`http://localhost:${PORT}/index.html`, { timeout: 420000 });
    await page.waitForTimeout(4000);
    await page.evaluate(() => { state.isCollectingMail = true; });
  };
  await load();
  const close = async () => { await browser.close(); if (server) server.close(); };
  return { page, browser, context, errors, close, reload: async () => { await page.reload({ timeout: 420000 }); await page.waitForTimeout(4000); await page.evaluate(() => { state.isCollectingMail = true; }); } };
}

module.exports = { boot, ROOT, PORT };
