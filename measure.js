// Load-time measurement for Kelo-1 (build-step task). Not part of the game.
// Usage: KELO_ROOT=<dir with index.html> NM=<node_modules for phosphor> PORT=8931 node measure.js <label> [runs] [memMinutes]
// Laptop-like setting: CPU slowed 2x (CDP), network 40 Mbit/s + 20 ms per request (done in this server so it
// also covers the CDN files), gzip for text like GitHub Pages, cold cache (fresh browser context each run).
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.resolve(process.env.KELO_ROOT);
const NM = process.env.NM || path.join(ROOT, 'node_modules');
const V = process.env.QAV || '/home/user/qa/vendor';
const PORT = +process.env.PORT || 8931;
const LABEL = process.argv[2] || 'run';
const RUNS = +process.argv[3] || 3;
const MEM_MIN = +(process.argv[4] || 0);
const CPU = +process.env.CPU || 2;
const BW = (+process.env.MBIT || 40) * 1e6 / 8; // bytes per second
const RTT = +process.env.RTT || 20;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.map': 'application/json', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream' };
const GZ = /^(text\/|application\/javascript|application\/json|image\/svg)/;
const CDN = [
  [/three\.min\.js$/, () => path.join(V, 'three.min.js')],
  [/OrbitControls\.js$/, () => path.join(V, 'OrbitControls.js')],
  [/cdn\.tailwindcss\.com/, () => process.env.TW || path.join(__dirname, 'dl/twcdn/package/tailwindcss.js')],
  [/unpkg\.com\/@phosphor-icons\/web@2\.1\.1\/?$/, () => path.join(NM, '@phosphor-icons/web/src/index.js')],
  [/unpkg\.com\/@phosphor-icons\/web@2\.1\.1\/(src\/.*)$/, m => path.join(NM, '@phosphor-icons/web', m[1])]
];
let bytes = 0, requests = 0, busyUntil = 0; const perType = {};
function send(res, file, data) {
  const type = TYPES[path.extname(file)] || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'max-age=600' };
  if (GZ.test(type)) { data = zlib.gzipSync(data, { level: 6 }); headers['Content-Encoding'] = 'gzip'; }
  bytes += data.length; requests++;
  const k = path.extname(file) || 'other'; perType[k] = (perType[k] || 0) + data.length;
  // Shared link: each response waits its turn for bandwidth, plus the round trip
  const now = Date.now(); const start = Math.max(now, busyUntil); busyUntil = start + data.length / BW * 1000;
  setTimeout(() => { res.writeHead(200, headers); res.end(data); }, busyUntil - now + RTT);
}
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u.startsWith('/__cdn/')) {
    const real = u.slice(7);
    for (const [re, f] of CDN) { const m = real.match(re); if (m) { const p = f(m); return fs.readFile(p, (e, d) => e ? (res.writeHead(404), res.end()) : send(res, p, d)); } }
    res.writeHead(404); return res.end();
  }
  const p = path.join(ROOT, u === '/' ? '/index.html' : u);
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(p, (err, data) => err ? (res.writeHead(404), res.end()) : send(res, p, data));
});

const INIT = `(() => {
  window.__m = {};
  const tick = () => {
    try { if (!window.__m.ready && typeof renderer !== 'undefined' && renderer && renderer.info && renderer.info.render.frame > 0 && typeof keloGroup !== 'undefined') { window.__m.ready = performance.now(); } } catch (e) {}
    if (!window.__m.ready) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  document.addEventListener('DOMContentLoaded', () => { window.__m.dcl = performance.now(); });
})();`;

async function once(browser, i, memMin) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(INIT);
  await page.route('**/*', async route => {
    const u = route.request().url();
    if (u.startsWith(`http://localhost:${PORT}`)) return route.continue();
    if (/generativelanguage|anthropic\.com|wikipedia|wiktionary|duckduckgo|github\.io/.test(u)) return route.fulfill({ status: 500, body: '{}' });
    if (/fonts\.(googleapis|gstatic)\.com/.test(u)) return route.fulfill({ status: 200, body: '', contentType: 'text/css' }); // not reachable from the test machine
    for (const [re] of CDN) if (re.test(u)) { const r = await route.fetch({ url: `http://localhost:${PORT}/__cdn/` + u.replace(/^https:\/\//, '') }); return route.fulfill({ response: r }); }
    return route.fulfill({ status: 404, body: '' });
  });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await cdp.send('Performance.enable');
  const events = [];
  cdp.on('Tracing.dataCollected', d => events.push(...d.value));
  const traceDone = new Promise(r => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,v8,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' });
  if (process.env.PROFILE) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start'); }
  bytes = 0; requests = 0; busyUntil = 0; for (const k in perType) delete perType[k];
  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}/index.html`, { timeout: 600000, waitUntil: 'commit' });
  await page.waitForFunction(() => window.__m && window.__m.ready, null, { timeout: 600000, polling: 250 });
  const m = await page.evaluate(() => ({ ...window.__m, fp: (performance.getEntriesByName('first-paint')[0] || {}).startTime, fcp: (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime }));
  const metrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  if (process.env.PROFILE) {
    const { profile } = await cdp.send('Profiler.stop');
    if (m.ready > +(process.env.SLOW || 10000) || process.env.PROFILE === 'all') {
      fs.writeFileSync(path.join(__dirname, `profile-${LABEL}-${i}.cpuprofile`), JSON.stringify(profile));
      const dt = {}; profile.samples.forEach((id, k) => { dt[id] = (dt[id] || 0) + (profile.timeDeltas[k] || 0); });
      const self = {};
      for (const n of profile.nodes) { const c = n.callFrame; const key = `${c.functionName || '(anon)'} ${c.url.split('/').pop()}:${c.lineNumber}:${c.columnNumber}`; self[key] = (self[key] || 0) + (dt[n.id] || 0) / 1000; }
      console.log('PROFILE run', i, 'ready', Math.round(m.ready), JSON.stringify(Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => k + ' ' + v.toFixed(0))));
    }
  }
  await page.waitForTimeout(3000); // let late loads (skies, textures) land before the trace stops
  await cdp.send('Tracing.end'); await traceDone;
  let compile = 0, evaluate = 0, parseBg = 0; const perUrl = {};
  for (const e of events) {
    if (e.ph !== 'X' || !e.dur) continue;
    if (e.name === 'v8.compile' || e.name === 'V8.CompileCode') compile += e.dur;
    else if (e.name === 'EvaluateScript') { evaluate += e.dur; const u = ((e.args && e.args.data && e.args.data.url) || '?').split('/').pop(); perUrl[u] = (perUrl[u] || 0) + e.dur / 1000; }
    else if (e.name === 'v8.parseOnBackground') parseBg += e.dur;
  }
  const r = { run: i, fp: Math.round(m.fp), fcp: Math.round(m.fcp), dcl: Math.round(m.dcl), worldReady: Math.round(m.ready),
    compileMs: Math.round(compile / 1000), evaluateScriptMs: Math.round(evaluate / 1000), bgParseMs: Math.round(parseBg / 1000), scriptDurationMs: Math.round(metrics.ScriptDuration * 1000),
    bytesAtReadyPlus3s: bytes, requests, perType: { ...perType }, heapAtReadyMB: +(metrics.JSHeapUsedSize / 1048576).toFixed(1), topEvaluate: Object.entries(perUrl).sort((a, b) => b[1] - a[1]).slice(0, +process.env.TOPN || 8).map(([u, ms]) => u + ' ' + ms.toFixed(1)), errors: errors.slice(0, 5), wall: Date.now() - t0 };
  if (memMin) {
    await page.evaluate(() => { state.isCollectingMail = false; });
    await page.waitForTimeout(memMin * 60000);
    await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.collectGarbage');
    const mm = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
    r.heapAfterMinMB = +(mm.JSHeapUsedSize / 1048576).toFixed(1); r.memMinutes = memMin; r.bytesTotal = bytes; r.errorsAfter = errors.slice(0, 5);
    r.domNodes = mm.Nodes;
  }
  await ctx.close();
  return r;
}

(async () => {
  await new Promise(r => srv.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const results = [];
  for (let i = 0; i < RUNS; i++) { const r = await once(browser, i, 0); console.log(JSON.stringify(r)); results.push(r); }
  if (MEM_MIN) { const r = await once(browser, 'mem', MEM_MIN); console.log(JSON.stringify(r)); results.push(r); }
  fs.writeFileSync(path.join(__dirname, `measure-${LABEL}.json`), JSON.stringify({ label: LABEL, root: ROOT, cpu: CPU, mbit: BW * 8 / 1e6, rtt: RTT, results }, null, 1));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
