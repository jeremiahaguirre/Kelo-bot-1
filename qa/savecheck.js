// Old save check. MODE=dump: run the game (any build) for a while, then write its localStorage to SAVE.
// MODE=load: start the game with SAVE's localStorage and print what loaded (plus page errors).
const { chromium } = require('playwright');
const path = require('path'), http = require('http'), fs = require('fs');
const ROOT = process.env.KELO_ROOT, PORT = +process.env.PORT || 8931, V = path.join(__dirname, 'vendor'), SAVE = process.env.SAVE;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
(async () => {
  const srv = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(d); }); });
  await new Promise(r => srv.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.includes('three.min.js')) return route.fulfill({ path: path.join(V, 'three.min.js'), contentType: 'application/javascript' });
    if (u.includes('OrbitControls.js')) return route.fulfill({ path: path.join(V, 'OrbitControls.js'), contentType: 'application/javascript' });
    if (u.includes('cdn.tailwindcss.com')) return route.fulfill({ path: path.join(V, 'tailwind.js'), contentType: 'application/javascript' });
    if (u.includes('phosphor-icons')) return route.fulfill({ body: '', contentType: 'application/javascript' });
    if (u.startsWith(`http://localhost:${PORT}`)) return route.continue();
    return route.fulfill({ status: 404, body: '' });
  });
  if (process.env.MODE === 'load') await page.addInitScript(all => { try { for (const [k, v] of Object.entries(all)) localStorage.setItem(k, v); } catch (e) {} }, JSON.parse(fs.readFileSync(SAVE, 'utf8')));
  await page.goto(`http://localhost:${PORT}/index.html`, { timeout: 600000 });
  await page.waitForFunction(() => typeof renderer !== 'undefined' && renderer && typeof state !== 'undefined', null, { timeout: 600000 });
  await page.waitForTimeout(+process.env.WAIT || 15000);
  const summary = () => page.evaluate(() => ({ three: THREE.REVISION, pos: state.botPos, diary: (state.diary || []).length, mem: (state.memories || state.longTermMemory || []).length, inv: (state.inventory || []).length, edits: (state.worldEdits || []).length, skin: state.skins && state.skins.equipped, mood: state.moodTitle }));
  if (process.env.MODE === 'dump') {
    await page.evaluate(() => { state.worldEdits = state.worldEdits || []; state.disposedItems = state.disposedItems || []; state.disposedItems.unshift({ name: 'r128 save marker', at: Date.now() }); (window.savePersistentBrainStateNow || savePersistentBrainState)(); });
    await page.waitForTimeout(2000);
    const all = await page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
    fs.writeFileSync(SAVE, JSON.stringify(all));
    console.log('dumped', Object.keys(all).length, 'keys', Math.round(JSON.stringify(all).length / 1024), 'KB', JSON.stringify(await summary()));
  } else {
    console.log('loaded', JSON.stringify(await summary()), 'marker', await page.evaluate(() => (state.disposedItems || []).some(d => d.name === 'r128 save marker')));
  }
  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close(); srv.close();
})();
