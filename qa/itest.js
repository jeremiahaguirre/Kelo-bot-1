// Usage: node harness.js <scenario>   (server must be running on :8765 from the repo root)
const { chromium } = require('playwright');
const path = require('path');
const V = path.join(__dirname, 'vendor');
const OUT = process.env.OUT || __dirname;
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
  const page = await browser.newPage({ viewport: { width: +process.env.VW || 1280, height: +process.env.VH || 800 }, deviceScaleFactor: +process.env.DSF || 1, isMobile: Boolean(process.env.VW && +process.env.VW < 600), hasTouch: Boolean(process.env.VW && +process.env.VW < 600) });
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
  const run = (fn, arg) => page.evaluate(fn, arg);
  const lookK = async (dx, dy, dz, ty = 1.1) => { const k = await run(() => [keloGroup.position.x, keloGroup.position.y, keloGroup.position.z]); await look(k[0] + dx, k[1] + dy, k[2] + dz, k[0], k[1] + ty, k[2]); };
  const pin = await run(() => Object.fromEntries(['cafe', 'cyber', 'post_office'].map(k => [k, [TOWN_LOCATIONS[k].x, TOWN_LOCATIONS[k].z]])));

  const setup = async (x, z) => { await run(() => { runAutonomousLifeTick = () => {}; placesToNotice = () => []; noticeNextAt = Infinity; if (state.isBusy && state.targetPos) state.botPos = { ...state.targetPos }; });
    for (let i = 0; i < 12; i++) { await page.waitForTimeout(2500); const busy = await run(() => { if (state.isBusy && state.targetPos) state.botPos = { ...state.targetPos }; return state.isBusy; }); if (!busy) break; }
    await setup0(x, z); };
  const setup0 = (x, z) => run(([x, z]) => {
    runAutonomousLifeTick = () => {};
    state.isCollectingMail = false; state.isBusy = false; state.isPracticing = false;
    const c = ensureCalendar(); c.startHour = 12; c.epoch = Date.now();
    state.botPos = { x, z }; state.targetPos = { x, z };
  }, [x, z]);
  const until = async (fn, ms, label) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await run(fn)) return true; await page.waitForTimeout(400); } console.log('TIMEOUT', label); return false; };
  const status = () => run(() => ({ visit: interiorVisitNow ? interiorVisitNow.key : null, trip: indoorTrip.active, busy: state.isBusy, browsing: state.isBrowsing, practicing: state.isPracticing, mail: state.isCollectingMail, bot: [+state.botPos.x.toFixed(2), +state.botPos.z.toFixed(2)], title: state.moodTitle }));
  const pathCheck = () => run(() => {
    // every scripted walk segment stays clear of the furniture (Kelo about 0.28 wide each side)
    const bad = [];
    Object.entries(INTERIOR_SPECS).forEach(([key, S]) => {
      const o = interiorRooms[key].root.position;
      const boxes = worldObstacles.filter(b => b.interior === key);
      const legs = [];
      const spot = S.seat || S.box;
      const route = [S.walkIn[S.walkIn.length - 1], ...(S.order ? [S.order] : []), ...spot.via, ...(S.box ? [S.box] : [])];
      for (let i = 1; i < route.length; i++) legs.push([route[i - 1], route[i]]);
      legs.forEach(([a, b]) => { for (let k = 0; k <= 20; k++) { const x = o.x + a.x + (b.x - a.x) * k / 20, z = o.z + a.z + (b.z - a.z) * k / 20; boxes.forEach(bx => { if (obstacleProbe(bx, x, z).d < 0.28) bad.push(key + ':' + bx.part + '@' + k); }); } });
    });
    return [...new Set(bad)];
  });
  if (scenario === 'paths') console.log('path clashes:', JSON.stringify(await pathCheck()));
  if (scenario === 'netnode' || scenario === 'netreload') {
    await setup(pin.cyber[0], pin.cyber[1] + 0.8);
    await run(() => { window.__done = false; browseInternet('Kalimba').then(() => { window.__done = true; }); });
    await until(() => interiorVisitNow && interiorVisitNow.readyAt > 0, 120000, 'seated');
    console.log('seated', JSON.stringify(await status()));
    if (scenario === 'netreload') {
      await run(() => savePersistentBrainState());
      await page.reload({ timeout: 420000 }); await page.waitForTimeout(4000);
      await run(() => { runAutonomousLifeTick = () => {}; });
      console.log('after reload', JSON.stringify(await status()));
      await page.waitForTimeout(5000);
      console.log('later', JSON.stringify(await status()), await run(() => keloGroup.position.toArray().map(v => +v.toFixed(2))));
    } else {
      await page.waitForTimeout(2500);
      await lookK(3.0, 2.6, 3.4);
      await page.waitForTimeout(1500);
      await shot('netnode-computer');
      await until(() => window.__done && !interiorVisitNow, 240000, 'left');
      console.log('after', JSON.stringify(await status()));
    }
  }
  if (scenario === 'cafe') {
    await setup(pin.cafe[0] + 0.2, pin.cafe[1] + 0.7);
    await run(() => { state.gardenPlots.forEach(p => { p.growth = 0; }); storedFoodName = () => null; state.fullness = 30; window.__done = false; eatSomething('Hungry').then(r => { window.__done = r; }); });
    await run(() => { window.__ev = []; let last = ''; window.__evT = setInterval(() => { const v = interiorVisitNow; const k = state.moodTitle + '|' + (v ? v.key + (v.readyAt ? ':ready' : '') + (v.food ? ':food' : '') : '-'); if (k !== last) { last = k; window.__ev.push(k); }
      if (v && v.food && !window.__held) { window.__held = 1; state.isBuilding = true; } }, 50); });
    await until(() => interiorVisitNow && interiorVisitNow.food, 180000, 'eating');
    console.log('eating', JSON.stringify(await status()));
    await lookK(1.6, 2.6, 4.2, 0.9);
    await page.waitForTimeout(1000);
    await shot('cafe-eating');
    await run(() => { state.isBuilding = false; });
    console.log('events', JSON.stringify(await run(() => window.__ev)));
    await until(() => window.__done && !interiorVisitNow, 120000, 'left');
    console.log('after', JSON.stringify(await status()), await run(() => state.fullness));
  }
  const PT = await run(() => typeof PICKUP_TABLE !== 'undefined' ? [PICKUP_TABLE.x, PICKUP_TABLE.z] : [16.2, 0.4]);
  if (scenario === 'post') {
    await setup(pin.post_office[0] + 0.1, pin.post_office[1] + 0.8);
    await run(() => { ['Kalimba', 'Yo-yo', 'Telescope', 'A basket of apples'].forEach(n => postMail({ kind: 'gift', name: n, from: 'test' })); renderPostOfficeParcels3D(); window.__done = false; pickUpMail('Test').then(r => { window.__done = r; }); });
    await run(() => { window.__evT = setInterval(() => { const r = interiorRooms.post_office; if (!window.__held && interiorVisitNow && r.parts.door && r.parts.door.rotation.y < -1.6) { window.__held = 1; window.__holdAt = Date.now(); state.isBuilding = true; } }, 50); });
    await until(() => window.__held, 180000, 'box open');
    await lookK(2.6, 1.6, 2.4, 1.4);
    await page.waitForTimeout(300);
    await shot('post-mailbox');
    await look(PT[0] + 1.0, 2.9, PT[1] + 4.2, PT[0], 1.2, PT[1]);
    await page.waitForTimeout(500);
    await shot('post-table');
    await run(() => { state.isBuilding = false; });
    await until(() => window.__done && !interiorVisitNow, 400000, 'left');
    console.log('after', JSON.stringify(await status()), await run(() => ({ left: state.mailbox.length, onTable: parcelDisplayGroup.children.length })));
    await look(PT[0] + 1.0, 2.9, PT[1] + 4.2, PT[0], 1.2, PT[1]);
    await page.waitForTimeout(500);
    await shot('post-table-after');
  }

  if (scenario === 'dbg') {
    await setup(6.8, 7.5);
    await run(() => { window.__log = []; browseInternet('Kalimba'); });
    for (let i = 0; i < 20; i++) { console.log(JSON.stringify(await run(() => [state.targetPos, state.botPos.x.toFixed(1), state.botPos.z.toFixed(1), state.isBusy, state.isBrowsing, state.moodTitle, state.autonomyTag, !!interiorVisitNow, state.cameraMode]))); await page.waitForTimeout(2000); }
  }

  if (scenario === 'dbgcafe') {
    await setup(0, 8);
    console.log('wrapped', await run(() => String(waitForArrival).includes('interior')));
    await run(() => { state.gardenPlots.forEach(p => { p.growth = 0; }); storedFoodName = () => null; state.fullness = 30; window.__t0 = Date.now(); window.__ev = []; setInterval(() => { const tp = state.targetPos, b = state.botPos; window.__ev.push([((Date.now() - window.__t0) / 1000).toFixed(1), tp.x.toFixed(1), tp.z.toFixed(1), b.x.toFixed(2), b.z.toFixed(2), arrivalRadius(tp).toFixed(2), state.isPracticing, !!interiorVisitNow, interiorKeyForTarget(tp)].join(' ')); }, 500); eatSomething('Hungry'); });
    await page.waitForTimeout(40000);
    console.log((await run(() => window.__ev)).join('\n'));
  }
  if (scenario === 'peek') {
    await run(() => { state.isPracticing = true; state.isBusy = true; state.botPos = { x: 6.8, z: 4.4 }; state.targetPos = { ...state.botPos }; state.botRotY = Math.PI; });
    await look(10, 4, 10, 6.8, 1, 3);
    await page.waitForTimeout(1500);
    await shot('peek');
  }
  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
  if (server) server.close();
})();
