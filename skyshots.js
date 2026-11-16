// Same views, same fixed light, from two copies of the game (e.g. dev with the 1k HDR skies vs the
// build with 512 ones). Usage: node skyshots.js <root> <label>
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.argv[2]), LABEL = process.argv[3], PORT = 8961 + (+process.env.SLOT || 0);
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const srv = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' }[path.extname(p)] || 'application/octet-stream' }); res.end(d); }); });
(async () => {
  await new Promise(r => srv.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(`http://localhost:${PORT}`)) return route.continue();
    if (u.includes('three.min.js')) return route.fulfill({ path: '/home/user/qa/vendor/three.min.js', contentType: 'application/javascript' });
    if (u.includes('OrbitControls.js')) return route.fulfill({ path: '/home/user/qa/vendor/OrbitControls.js', contentType: 'application/javascript' });
    if (u.includes('cdn.tailwindcss.com')) return route.fulfill({ path: path.join(__dirname, 'dl/twcdn/package/tailwindcss.js'), contentType: 'application/javascript' });
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`http://localhost:${PORT}/index.html`, { timeout: 600000 });
  await page.waitForFunction(() => typeof envPhotoTextures !== 'undefined' && Object.values(envPhotoTextures).every(Boolean), null, { timeout: 600000 });
  const views = [['yard', [24, 9, 16, 16, 1, 0]], ['lake', [-10, 6, 30, -30, 0, 60]], ['kelo', [0, 0, 0, 0, 0, 0]]];
  for (const [p, pname] of [[0, 'noon'], [1, 'sunset'], [2, 'night']]) {
    for (const [vname, v] of views) {
      await page.evaluate(([p, v, vname]) => {
        state.isCollectingMail = true; state.isBusy = true; state.lightingMode = 'manual';
        if (typeof rainShown !== 'undefined') rainShown = 0;
        applySkyPreset(p); SKY_STATE.envKey = ''; updateEnvironment();
        state.cameraMode = 'none';
        if (vname === 'kelo') { const k = keloGroup.position; camera.position.set(k.x + 2.2, k.y + 1.6, k.z + 2.6); controls.target.set(k.x, k.y + 0.9, k.z); }
        else { camera.position.set(v[0], v[1], v[2]); controls.target.set(v[3], v[4], v[5]); }
        controls.update();
      }, [p, v, vname]);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT, `sky-${pname}-${vname}-${LABEL}.png`), timeout: 300000 });
    }
  }
  console.log(LABEL, 'shots done, page errors:', errors.length ? errors : 'none');
  await browser.close(); srv.close();
})();
