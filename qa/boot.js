// Shared Playwright bootstrap for the engine tests (perfviews.js, framerate.js, tunnel.js).
// Serves KELO_ROOT, routes the CDNs to vendor/, mocks the AI and Wikipedia, freezes his own life.
const { chromium } = require('playwright');
const path = require('path'), http = require('http'), fs = require('fs');
const V = path.join(__dirname, 'vendor');
const ROOT = process.env.KELO_ROOT || path.resolve(__dirname, '../../kelo-bot-1');
const PORT = +process.env.PORT || 8900;
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
async function boot(opts = {}) {
  const server = await startServer();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const phone = Boolean(opts.phone);
  const ctxOpts = phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: opts.dsf || 2, isMobile: true, hasTouch: true }
    : { viewport: { width: opts.w || 1280, height: opts.h || 800 }, deviceScaleFactor: opts.dsf || 1 };
  const page = await browser.newPage({ ...ctxOpts, bypassCSP: Boolean(opts.bypassCSP) });
  page.setDefaultTimeout(900000);
  await page.addInitScript(([g, seed]) => {
    try { localStorage.setItem('kelo-graphics', g); } catch (e) {}
    // The frame-rate tests build the same world every run: Math.random from a fixed seed
    if (seed) { let a = seed >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  }, [opts.gfx || "balanced", opts.seed || 0]);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('console.error:', m.text()); });
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
  await page.goto(`http://localhost:${PORT}/index.html`, { timeout: 900000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof keloGroup !== 'undefined' && keloGroup && typeof renderer !== 'undefined' && renderer, null, { timeout: 900000 });
  await page.waitForTimeout(4000);
  const W = (fn, arg) => page.evaluate(fn, arg);
  if (!opts.life) await W(() => {
    state.isCollectingMail = true; window.__noLife = true;
    if (typeof runAutonomousLifeTick === 'function') window.runAutonomousLifeTick = () => {};
    if (typeof decideNextAction === 'function') window.decideNextAction = async () => {};
    // Midday in summer, so the light and the fog are the same for every run
    state.calendar = { epoch: Date.now(), startDayOfYear: 180, startHour: 12 };
    if (typeof applyTimeOfDay === 'function') applyTimeOfDay();
    if (typeof applySeasonLook === 'function') applySeasonLook();
  });
  const look = (px, py, pz, tx, ty, tz) => W(([px, py, pz, tx, ty, tz]) => {
    state.cameraMode = 'none';
    camera.position.set(px, py, pz);
    controls.target.set(tx, ty, tz); controls.update();
  }, [px, py, pz, tx, ty, tz]);
  const shot = async (file) => { await page.screenshot({ path: file, timeout: 600000 }); console.log('shot', path.basename(file)); };
  const done = async () => { console.log('page errors:', errors.length ? errors : 'none'); await browser.close(); if (server) server.close(); process.exit(errors.length ? 1 : 0); };
  return { page, W, look, shot, errors, done, wait: ms => page.waitForTimeout(ms) };
}
// A virtual clock for the frame-rate tests: performance.now, Date.now, requestAnimationFrame and the
// scene clock are driven by pump(); drawing is skipped (logic only). The world clock and the scene's
// elapsed time start from the same values in every run, so time-based motion lines up too.
async function virtualClock(W, page) {
  await W(() => {
    const realNow = performance.now();
    window.__vc = { now: realNow, start: realNow, q: [] };
    const dateBase = state.calendar.epoch + 3600000;
    performance.now = () => window.__vc.now;
    Date.now = () => dateBase + (window.__vc.now - window.__vc.start);
    window.requestAnimationFrame = cb => { window.__vc.q.push(cb); return window.__vc.q.length; };
    renderer.render = () => {};
    if (typeof postComposer !== 'undefined' && postComposer) postComposer.render = () => {};
    clock.elapsedTime = 1000; clock.oldTime = realNow;
  });
  await page.waitForTimeout(1500); // the real loops hand over to the virtual one
}
module.exports = { boot, virtualClock };
