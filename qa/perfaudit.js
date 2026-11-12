// Performance audit probe (CDP). Usage:
//   KELO_ROOT=... MODE=load|frame|soak [GFX=balanced] [PHONE=1] [SECS=20] [VIEW=town|workshop|high] [LIFE=1] node perfaudit.js
// load : navigation timing, first paint, per-script fetch size, CPU self-time by file during startup, long tasks.
// frame: render stubbed (renderer.render no-op) so SwiftShader doesn't bury the JS; CPU profile self time by
//        function, sampled allocations by function, GC count, THREE.Vector3/Matrix4/Color constructions per frame,
//        DOM mutations per second, localStorage writes.
// soak : his life running (AI mocked as failing), render stubbed; samples heap, geometries/textures, scene
//        object count, listeners, timers, localStorage size and save time every SAMPLE seconds.
const { chromium } = require('playwright');
const path = require('path'), http = require('http'), fs = require('fs');
const V = path.join(__dirname, 'vendor');
const ROOT = process.env.KELO_ROOT || path.resolve(__dirname, '../../kelo-bot-1');
const PORT = +process.env.PORT || 8900;
const MODE = process.env.MODE || 'frame';
const SECS = +process.env.SECS || 20;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const sizes = {};
function startServer() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(p, (err, data) => {
        if (err) { res.writeHead(404); return res.end(); }
        sizes[req.url.split('?')[0]] = data.length;
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    srv.on('error', () => resolve(null));
    srv.listen(PORT, () => resolve(srv));
  });
}
const short = u => (u || '').replace(/^.*\/(js|vendor)\//, '').replace(/^http:\/\/localhost:\d+\//, '') || '(native)';
function selfByFn(profile, keyFn) {
  const dt = {}; const nodes = new Map(profile.nodes.map(n => [n.id, n]));
  const deltas = profile.timeDeltas; let total = 0;
  profile.samples.forEach((id, i) => { const n = nodes.get(id); const k = keyFn(n.callFrame); const d = (deltas[i] || 0) / 1000; dt[k] = (dt[k] || 0) + d; total += d; });
  return { total, rows: Object.entries(dt).sort((a, b) => b[1] - a[1]) };
}
function allocByFn(prof) {
  const out = {};
  const walk = (n) => { const cf = n.callFrame; const k = `${cf.functionName || '(anon)'} ${short(cf.url)}:${cf.lineNumber + 1}`; out[k] = (out[k] || 0) + n.selfSize; (n.children || []).forEach(walk); };
  walk(prof.head);
  return Object.entries(out).sort((a, b) => b[1] - a[1]);
}
(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--js-flags=--expose-gc'] });
  const phone = Boolean(process.env.PHONE);
  const page = await browser.newPage(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(900000);
  const cdp = await page.context().newCDPSession(page);
  await page.addInitScript(([g]) => {
    try { localStorage.setItem('kelo-graphics', g); } catch (e) {}
    // counters installed before any game script
    window.__pa = { lsWrites: 0, lsBytes: 0, lsKeys: {}, timers: 0, intervals: 0, liveIntervals: new Set(), listeners: 0, raf: 0, mut: 0 };
    const sp = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { const pa = window.__pa; pa.lsWrites++; pa.lsBytes += String(v).length; pa.lsKeys[k] = (pa.lsKeys[k] || 0) + 1; return sp.call(this, k, v); };
    const st = window.setTimeout; window.setTimeout = function () { window.__pa.timers++; return st.apply(this, arguments); };
    const si = window.setInterval; window.setInterval = function () { window.__pa.intervals++; const id = si.apply(this, arguments); window.__pa.liveIntervals.add(id); return id; };
    const ci = window.clearInterval; window.clearInterval = function (id) { window.__pa.liveIntervals.delete(id); return ci.apply(this, arguments); };
    const ae = EventTarget.prototype.addEventListener; EventTarget.prototype.addEventListener = function () { window.__pa.listeners++; return ae.apply(this, arguments); };
    const re = EventTarget.prototype.removeEventListener; EventTarget.prototype.removeEventListener = function () { window.__pa.listeners--; return re.apply(this, arguments); };
    const ra = window.requestAnimationFrame; window.requestAnimationFrame = function (cb) { window.__pa.raf++; return ra.call(this, cb); };
    document.addEventListener('DOMContentLoaded', () => { new MutationObserver(l => { window.__pa.mut += l.length; }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true }); });
  }, [process.env.GFX || 'balanced']);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
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
  const W = (fn, arg) => page.evaluate(fn, arg);
  await cdp.send('Performance.enable');
  if (MODE === 'load') {
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
  }
  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}/index.html`, { timeout: 900000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof keloGroup !== 'undefined' && keloGroup && typeof renderer !== 'undefined' && renderer, null, { timeout: 900000 });
  const tReady = Date.now() - t0;
  if (MODE === 'load') {
    await page.waitForTimeout(3000);
    const { profile } = await cdp.send('Profiler.stop');
    const nav = await W(() => { const n = performance.getEntriesByType('navigation')[0]; const p = performance.getEntriesByType('paint').map(e => [e.name, Math.round(e.startTime)]); return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), paint: p, scripts: document.scripts.length, longtasks: window.__lt || null }; });
    const byFile = selfByFn(profile, cf => short(cf.url));
    const byFn = selfByFn(profile, cf => `${cf.functionName || '(anon)'} ${short(cf.url)}:${cf.lineNumber + 1}`);
    const jsBytes = Object.entries(sizes).filter(([k]) => k.endsWith('.js')).reduce((s, [, v]) => s + v, 0);
    console.log('LOAD', JSON.stringify({ readyMs: tReady, ...nav, jsFiles: Object.keys(sizes).filter(k => k.endsWith('.js')).length, jsKB: Math.round(jsBytes / 1024), allKB: Math.round(Object.values(sizes).reduce((a, b) => a + b, 0) / 1024) }));
    console.log('CPU during load (ms, self) total', byFile.total.toFixed(0));
    byFile.rows.slice(0, 25).forEach(([k, v]) => console.log('  file', v.toFixed(0).padStart(6), k));
    byFn.rows.slice(0, 40).forEach(([k, v]) => console.log('  fn  ', v.toFixed(0).padStart(6), k));
    const big = Object.entries(sizes).sort((a, b) => b[1] - a[1]).slice(0, 12);
    big.forEach(([k, v]) => console.log('  size', Math.round(v / 1024).toString().padStart(5), 'KB', k));
  }
  await page.waitForTimeout(4000);
  const life = Boolean(process.env.LIFE) || MODE === 'soak';
  await W(([life]) => {
    if (!life) {
      state.isCollectingMail = true; window.__noLife = true;
      if (typeof runAutonomousLifeTick === 'function') window.runAutonomousLifeTick = () => {};
      if (typeof decideNextAction === 'function') window.decideNextAction = async () => {};
    }
    state.calendar = { epoch: Date.now(), startDayOfYear: 180, startHour: 12 };
    if (typeof applyTimeOfDay === 'function') applyTimeOfDay();
    if (!window.__keepRender) { window.__realRender = renderer.render.bind(renderer); renderer.render = () => {}; if (typeof postComposer !== 'undefined' && postComposer) postComposer.render = () => {}; }
  }, [life]);
  const view = process.env.VIEW || 'town';
  const look = (px, py, pz, tx, ty, tz) => W(([px, py, pz, tx, ty, tz]) => { state.cameraMode = 'none'; camera.position.set(px, py, pz); controls.target.set(tx, ty, tz); controls.update(); }, [px, py, pz, tx, ty, tz]);
  if (view === 'town') { await W(() => { state.botPos = { x: 2, z: 4 }; state.targetPos = { ...state.botPos }; }); await look(0, 22, 27, 0, 0.5, -1); }
  if (view === 'high') await look(10, 170, 90, 10, 0, -10);
  if (view === 'follow') await W(() => { state.cameraMode = 'follow'; });
  if (view === 'visit') await W(() => { if (typeof shopVisitEnter === 'function') shopVisitEnter('floor1'); else if (typeof shopVisitStart === 'function') shopVisitStart(); });
  if (view === 'workshop') {
    await W(() => { const site = workshopSite(); const o = siteToWorld(site, site.outside.x, site.outside.z, 0); state.botPos = { x: o.x, z: o.z }; state.targetPos = { ...state.botPos }; state.cameraMode = 'follow';
      window.__hold = goIntoWorkshop({ stops: [{ stand: { x: 0, z: 1 }, act: () => new Promise(r => { window.__in = r; }) }] }); });
    await W(() => new Promise(r => { const c = () => (window.__in ? r() : setTimeout(c, 300)); c(); }));
  }
  await page.waitForTimeout(3000);

  if (MODE === 'frame') {
    // per-frame counters
    await W(() => {
      const pa = window.__pa; pa.ctor = {}; pa.frames = 0; pa.js = 0; pa.max = 0;
      ['Vector3', 'Vector2', 'Matrix4', 'Quaternion', 'Color', 'Euler', 'Box3', 'Raycaster', 'Object3D', 'Mesh', 'BufferGeometry'].forEach(n => {
        const C = THREE[n]; if (!C) return;
        const P = new Proxy(C, { construct(t, a, nt) { pa.ctor[n] = (pa.ctor[n] || 0) + 1; if (pa.trace && n === pa.trace) { const s = new Error().stack.split('\n')[2] || ''; pa.sites[s.trim()] = (pa.sites[s.trim()] || 0) + 1; } return Reflect.construct(t, a, nt); } });
        THREE[n] = P;
      });
      pa.sites = {};
      const orig = window.animateDiorama;
      window.animateDiorama = function () { const a = performance.now(); orig(); const d = performance.now() - a; pa.frames++; pa.js += d; if (d > pa.max) pa.max = d; };
    });
    await page.waitForTimeout(1500);
    await W(() => { const pa = window.__pa; pa.ctor = {}; pa.frames = 0; pa.js = 0; pa.max = 0; pa.mut = 0; pa.lsWrites = 0; pa.lsBytes = 0; pa.lsKeys = {}; pa.timers = 0; pa.trace = process_trace(); function process_trace() { return 'Vector3'; } });
    const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
    await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.startSampling', { samplingInterval: 4096 });
    await page.waitForTimeout(SECS * 1000);
    const { profile } = await cdp.send('Profiler.stop');
    const { profile: heap } = await cdp.send('HeapProfiler.stopSampling');
    const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    const pa = await W(() => { const p = window.__pa; return { frames: p.frames, jsPerFrame: +(p.js / p.frames).toFixed(2), maxFrame: +p.max.toFixed(1), ctorPerFrame: Object.fromEntries(Object.entries(p.ctor).map(([k, v]) => [k, +(v / p.frames).toFixed(1)])), sites: Object.entries(p.sites).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => [+(v / p.frames).toFixed(1), k.replace(/https?:\/\/localhost:\d+\/js\//, '')]), mutPerSec: 0, mut: p.mut, lsWrites: p.lsWrites, lsBytes: p.lsBytes, lsKeys: p.lsKeys, timers: p.timers }; });
    pa.mutPerSec = +(pa.mut / SECS).toFixed(1);
    const info = await W(() => ({ geom: renderer.info.memory.geometries, tex: renderer.info.memory.textures, heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) }));
    console.log('FRAME', view, JSON.stringify({ ...pa, ...info, scriptMs: Math.round((m1.ScriptDuration - m0.ScriptDuration) * 1000), layoutMs: Math.round((m1.LayoutDuration - m0.LayoutDuration) * 1000), recalcStyleMs: Math.round((m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000), layouts: m1.LayoutCount - m0.LayoutCount, styleRecalcs: m1.RecalcStyleCount - m0.RecalcStyleCount }));
    const byFn = selfByFn(profile, cf => `${cf.functionName || '(anon)'} ${short(cf.url)}:${cf.lineNumber + 1}`);
    const byFile = selfByFn(profile, cf => short(cf.url));
    console.log(`CPU self in ${SECS}s total ${byFn.total.toFixed(0)} ms`);
    byFile.rows.slice(0, 15).forEach(([k, v]) => console.log('  file', v.toFixed(0).padStart(6), k));
    byFn.rows.filter(r => !/^\((idle|program)\)/.test(r[0])).slice(0, 40).forEach(([k, v]) => console.log('  fn  ', v.toFixed(0).padStart(6), k));
    const al = allocByFn(heap);
    const tot = al.reduce((s, r) => s + r[1], 0);
    console.log(`ALLOC sampled live ${Math.round(tot / 1024)} KB (sampling profile, live at stop)`);
    al.slice(0, 25).forEach(([k, v]) => console.log('  alloc', Math.round(v / 1024).toString().padStart(6), 'KB', k));
  }

  if (MODE === 'soak') {
    const SAMPLE = +process.env.SAMPLE || 60;
    const rows = [];
    const sample = async (label) => {
      await cdp.send('HeapProfiler.collectGarbage');
      const hu = await cdp.send('Runtime.getHeapUsage');
      const r = await W(() => {
        let objs = 0; scene.traverse(() => objs++);
        let ls = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls += (localStorage.getItem(k) || '').length; }
        let saveMs = null; if (typeof savePersistentBrainStateNow === "function") { const a = performance.now(); try { savePersistentBrainStateNow(); } catch (e) {} saveMs = +(performance.now() - a).toFixed(1); }
        const pa = window.__pa;
        return { heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1), geom: renderer.info.memory.geometries, tex: renderer.info.memory.textures, sceneObjs: objs, listeners: pa.listeners, liveIntervals: pa.liveIntervals.size, timersMade: pa.timers, lsKB: Math.round(ls / 1024), saveMs, lsWrites: pa.lsWrites, dom: document.getElementsByTagName('*').length, loc: state.currentLocKey, act: String(state.currentAction || '').slice(0, 40) };
      });
      r.heapMB = +(hu.usedSize / 1048576).toFixed(1); r.t = label; rows.push(r); console.log('SOAK', JSON.stringify(r));
    };
    await sample(0);
    const n = Math.round(SECS / SAMPLE);
    for (let i = 1; i <= n; i++) {
      if (process.env.ROAM) await W(i => { // move the camera around so on-demand buildings load and unload
        const spots = [[0, 22, 27, 0, 0, -1], [10, 170, 90, 10, 0, -10], [60, 30, 60, 50, 0, 40], [-60, 30, -40, -50, 0, -30], [0, 22, 27, 0, 0, -1]];
        const s = spots[i % spots.length]; state.cameraMode = 'none'; camera.position.set(s[0], s[1], s[2]); controls.target.set(s[3], s[4], s[5]); controls.update();
      }, i);
      await page.waitForTimeout(SAMPLE * 1000); await sample(i * SAMPLE);
    }
    const f = rows[0], l = rows[rows.length - 1];
    console.log('SOAK delta', JSON.stringify(Object.fromEntries(Object.keys(f).filter(k => typeof f[k] === 'number').map(k => [k, +(l[k] - f[k]).toFixed(1)]))));
  }
  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close(); if (server) server.close(); process.exit(0);
})();
