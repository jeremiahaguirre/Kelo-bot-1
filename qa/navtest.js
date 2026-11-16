// Usage: node harness.js <scenario>   (server must be running on :8765 from the repo root)
const { chromium } = require('playwright');
const path = require('path');
const V = path.join(__dirname, 'vendor');
const OUT = path.join(__dirname, 'shots');
require('fs').mkdirSync(OUT, { recursive: true });

const http = require('http'), fs = require('fs');
const ROOT = process.env.KELO_ROOT || '/home/user/jeremiahaguirre/kelo-bot-1';
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
    srv.listen(PORT, () => resolve(srv));
  });
}

(async () => {
  const server = await startServer().catch(() => null);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: +process.env.VW || 1280, height: +process.env.VH || 800 }, deviceScaleFactor: process.env.VW && +process.env.VW < 600 ? 2 : 1, isMobile: Boolean(process.env.VW && +process.env.VW < 600), hasTouch: Boolean(process.env.VW && +process.env.VW < 600) });
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
    if (u.includes('wikipedia.org') && /summary\/kalimba/i.test(u)) return route.fulfill({ body: JSON.stringify({ type: 'standard', title: 'Kalimba', extract: 'The kalimba is a musical instrument of the lamellophone family, consisting of a wooden board with attached metal tines.' }), contentType: 'application/json' });
    if (u.includes('wikipedia.org') && /summary\/Quokka/i.test(u)) return route.fulfill({ body: JSON.stringify({ type: 'standard', title: 'Quokka', extract: 'The quokka is a small macropod about the size of a domestic cat, found on islands off Western Australia. It is known for its smiling face.' }), contentType: 'application/json' });
    if (u.includes('wikipedia.org')) return route.fulfill({ body: '{"query":{"search":[]}}', contentType: 'application/json' });
    if (u.startsWith(`http://localhost:${PORT}`)) return route.continue();
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`http://localhost:${PORT}/index.html`, { timeout: 420000 });
  await page.waitForTimeout(4000);
  const shot = async name => { try { await page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 300000 }); console.log('shot', name); } catch (e) { console.log('shot FAILED (load)', name); } };
  const look = (px, py, pz, tx, ty, tz) => page.evaluate(([px, py, pz, tx, ty, tz]) => {
    state.cameraMode = 'none';
    camera.position.set(px, py, pz);
    if (typeof controls !== 'undefined' && controls) { controls.target.set(tx, ty, tz); controls.update(); } else camera.lookAt(tx, ty, tz);
  }, [px, py, pz, tx, ty, tz]);
  const scenario = process.argv[2] || 'pit';
  // Keep his own life ticks out of the way during scripted tests
  await page.evaluate(() => { state.isCollectingMail = true; });


  // Simulated panning: step the goal along paths across town at several camera heights and
  // record where the camera ends up each 33 ms frame (no rendering needed).
  const res = await page.evaluate(() => {
    exploreSetMode('explore');
    exploreCam.ready = true;
    const paths = [
      { name: 'shore row low', from: [-30, 9], to: [25, 9], pitch: 0.45, dist: 22, yaw: 0 },
      { name: 'shore row high', from: [-30, 9], to: [25, 9], pitch: 0.9, dist: 40, yaw: 0 },
      { name: 'north row', from: [-20, -2], to: [30, -2], pitch: 0.55, dist: 26, yaw: 0.6 },
      { name: 'town diagonal close', from: [-25, 12], to: [20, -10], pitch: 0.35, dist: 14, yaw: -0.8 },
      { name: 'low over hills', from: [-60, -20], to: [80, -25], pitch: 0.13, dist: 35, yaw: 1.3 },
      { name: 'workshop pass', from: [20, -4], to: [70, -4], pitch: 0.5, dist: 24, yaw: 0.3 }
    ];
    const out = [];
    for (const P of paths) {
      exploreCam.fly = null; exploreCam.drag = null;
      exploreCam.goal.target.set(P.from[0], 0, P.from[1]); exploreCam.goal.pitch = P.pitch; exploreCam.goal.dist = P.dist; exploreCam.goal.yaw = P.yaw;
      exploreCam.cur = exploreCopy(exploreCam.goal);
      for (let i = 0; i < 40; i++) { exploreCam.lastMs = performance.now() - 33; exploreCameraUpdate(); }
      const pos = [], dists = []; let under = 0, inside = 0;
      const N = 240;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        exploreCam.goal.target.x = P.from[0] + (P.to[0] - P.from[0]) * u;
        exploreCam.goal.target.z = P.from[1] + (P.to[1] - P.from[1]) * u;
        exploreCam.lastMs = performance.now() - 33;
        exploreCameraUpdate();
        pos.push(camera.position.clone()); dists.push(camera.position.distanceTo(controls.target));
        const cp = camera.position;
        const gy = Math.max(getAnalyticalGroundHeight(cp.x, cp.z), typeof terrainMeshHeightAt === 'function' ? (terrainMeshHeightAt(cp.x, cp.z) ?? -99) : -99);
        if (cp.y < gy + 0.3) under++;
        for (const b of worldObstacles) {
          if (b.hw === undefined || Math.min(b.hw, b.hd) < 0.9) continue;
          const cs = Math.cos(b.rot || 0), sn = Math.sin(b.rot || 0), lx = cp.x - b.x, lz = cp.z - b.z;
          if (Math.abs(lx * cs - lz * sn) < b.hw && Math.abs(lx * sn + lz * cs) < b.hd && cp.y < (exploreRoofs.get(b) ?? getAnalyticalGroundHeight(b.x, b.z) + 3)) { inside++; break; }
        }
      }
      // jerk: change in per-frame velocity
      let maxJerk = 0, maxDistStep = 0, flips = 0, lastSign = 0;
      for (let i = 2; i < pos.length; i++) {
        const v1 = pos[i].clone().sub(pos[i - 1]), v0 = pos[i - 1].clone().sub(pos[i - 2]);
        maxJerk = Math.max(maxJerk, v1.sub(v0).length());
      }
      for (let i = 1; i < dists.length; i++) {
        const d = dists[i] - dists[i - 1];
        maxDistStep = Math.max(maxDistStep, Math.abs(d));
        const sg = Math.abs(d) < 0.02 ? 0 : Math.sign(d);
        if (sg && lastSign && sg !== lastSign) flips++;
        if (sg) lastSign = sg;
      }
      out.push({ path: P.name, maxJerk: +maxJerk.toFixed(3), maxDistStep: +maxDistStep.toFixed(3), distFlips: flips, minDist: +Math.min(...dists).toFixed(2), framesUnderGround: under, framesInsideBuilding: inside });
    }
    return out;
  });
  res.forEach(r => console.log(JSON.stringify(r)));
  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
  if (server) server.close();
})();
