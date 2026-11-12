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



  // Simulated following: he walks a route through town with stops, sits down, stands, walks on,
  // and once is moved far away. The camera is in follow mode; record it each 33 ms frame.
  const res = await page.evaluate(() => {
    state.isBusy = true; state.isPracticing = true;
    exploreCam.ready = true;
    exploreSetMode('follow');
    const route = [[-25, 10], [-10, 8], [0, 8], [10, 9], [10, -3], [25, -4], [40, -6]];
    const g = (x, z) => getIslandGroundHeight(x, z);
    const place = (x, z, dy, walking) => {
      state.botPos = { x, z }; state.isWalking = walking; state.botAltitudeY = g(x, z);
      keloGroup.position.set(x, g(x, z) + dy, z);
    };
    place(route[0][0], route[0][1], 0, false);
    exploreCam.fly = null;
    exploreCam.goal = { target: exploreKeloSpot(), yaw: 0.4, pitch: 0.5, dist: 18 };
    exploreCam.cur = exploreCopy(exploreCam.goal);
    for (let i = 0; i < 30; i++) { exploreCam.lastMs = performance.now() - 33; exploreCameraUpdate(); }
    const pos = []; let tick = 0;
    const frame = () => { exploreCam.lastMs = performance.now() - 33; exploreCameraUpdate(); pos.push(camera.position.clone()); tick++; };
    const sp = 2.2 * 0.033;
    for (let r = 1; r < route.length; r++) {
      const [ax, az] = route[r - 1], [bx, bz] = route[r];
      const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / sp);
      for (let i = 1; i <= n; i++) {
        const u = i / n, x = ax + (bx - ax) * u, z = az + (bz - az) * u;
        place(x, z, Math.abs(Math.sin(tick * 0.5)) * 0.06, true); frame();
      }
      // a stop; at the third stop he sits down for a bit
      for (let i = 0; i < 25; i++) { place(bx, bz, r === 3 && i > 5 ? -0.55 : 0, false); frame(); }
    }
    // moved far away (a trip ends across the map)
    for (let i = 0; i < 90; i++) { place(-45, -15, 0, false); frame(); }
    let maxJerk = 0, sum = 0, cnt = 0, maxJerkWalk = 0;
    for (let i = 2; i < pos.length; i++) {
      const j = pos[i].clone().sub(pos[i - 1]).sub(pos[i - 1].clone().sub(pos[i - 2])).length();
      if (i < pos.length - 90) maxJerkWalk = Math.max(maxJerkWalk, j);
      maxJerk = Math.max(maxJerk, j); sum += j; cnt++;
    }
    return [{ frames: pos.length, maxJerkWhileWalkingAndStops: +maxJerkWalk.toFixed(3), maxJerkInclJump: +maxJerk.toFixed(3), meanJerk: +(sum / cnt).toFixed(4) }];
  });
  res.forEach(r => console.log(JSON.stringify(r)));
  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
  if (server) server.close();
})();
