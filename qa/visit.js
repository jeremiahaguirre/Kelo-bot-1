// Usage: node harness.js <scenario>   (server must be running on :8765 from the repo root)
const { chromium } = require('playwright');
const path = require('path');
const V = path.join(__dirname, 'vendor');
const OUT = process.env.OUT || path.join(__dirname, 'shots');
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
  const page = await browser.newPage({ viewport: { width: +process.env.VW || 1280, height: +process.env.VH || 800 }, deviceScaleFactor: +process.env.DSF || (process.env.VW && +process.env.VW < 600 ? 2 : 1), isMobile: Boolean(process.env.VW && +process.env.VW < 600), hasTouch: Boolean(process.env.VW && +process.env.VW < 600) });
  page.setDefaultTimeout(400000);
  await page.addInitScript(g => { try { localStorage.setItem('kelo-graphics', g); } catch (e) {} }, process.env.GFX || 'balanced');
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
  await page.goto(`http://localhost:${PORT}/index.html`, { timeout: 900000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof wsGroup !== 'undefined' && wsGroup && typeof keloGroup !== 'undefined' && keloGroup, null, { timeout: 900000 });
  await page.waitForTimeout(4000);
  const shot = async name => { await page.screenshot({ path: path.join(OUT, name + '.png') }); console.log('shot', name); };
  const W = async (fn, arg) => page.evaluate(fn, arg);
  const wait = ms => page.waitForTimeout(ms);
  const TAG = process.env.TAG || ((+process.env.VW || 1280) < 600 ? 'phone' : 'desk');
  const SHOTS = new Set((process.env.SHOTS || '').split(',').filter(Boolean));   // machine keys to photograph
  const fails = [];
  await W(() => {
    state.isCollectingMail = true;
    if (typeof runAutonomousLifeTick === 'function') window.runAutonomousLifeTick = () => {};
    if (typeof decideNextAction === 'function') window.decideNextAction = async () => {};
    const c = ensureCalendar(); c.startHour += 12.5 - worldNow().hour; if (typeof applyTimeOfDay === 'function') applyTimeOfDay();
    Object.values(WORKSHOP_MACHINES).forEach(d => { workshopState().known[d.learnAs || d.key] = { at: Date.now() }; });
  });
  const settle = async () => { await page.waitForFunction(() => !shopVisit.trans, null, { timeout: 120000, polling: 200 }); await wait(500); };
  // Open: the World tab's button opens the chooser, a click on an area starts the visit
  const before = await W(() => ({ mode: state.cameraMode, fov: camera.fov, near: camera.near }));
  await W(() => { const b = document.querySelector('[data-cam="visit"]'); if (b) b.click(); else shopVisitOpenChooser(); });
  await wait(600);
  const chooser = await W(() => [...document.querySelectorAll('#svChooser .sv-choice')].map(b => b.innerText.replace(/\s+/g, ' ')));
  console.log('chooser:', JSON.stringify(chooser));
  if (!chooser.length) fails.push('chooser did not open');
  await W(() => document.querySelector('#svChooser [data-sv-area="f1"]').click());
  await wait(1500);
  if (!(await W(() => shopVisit.on && state.cameraMode === 'visit'))) fails.push('visit did not start');
  // Each area, by the HUD's buttons
  for (const key of ['hangar', 'wing', 'f1', 'f2', 'f3']) {
    await W(k => document.querySelector(`#svHud [data-sv-area="${k}"]`).click(), key);
    await settle(); await wait(1500);
    const st = await W(() => ({ floor: shopVisit.floor, area: svAreaKeyHere(), view: wsViewFloor, d2: wsDeckMeshes.some(m => m.visible), d3: wsDeck3Meshes.some(m => m.visible), f2: wsFloor2 && wsFloor2.visible, f3: wsFloor3 && wsFloor3.visible, roof: svRoofs().some(m => m.visible), name: document.getElementById('svAreaName').textContent }));
    console.log('area', key, JSON.stringify(st));
    if (st.area !== key) fails.push(`area ${key}: ended in ${st.area}`);
    if (st.view !== st.floor || st.d2 !== st.floor >= 2 || st.d3 !== st.floor >= 3 || Boolean(st.f3) !== st.floor >= 3 || st.roof) fails.push(`area ${key}: floor hiding wrong ${JSON.stringify(st)}`);
    await shot(`visit-${TAG}-area-${key}`);
  }
  // Every target: a clear viewing spot, travel there, its card opens
  const keys = await W(() => svTargets().map(t => t.key));
  if (process.env.ONLY) keys.splice(0, keys.length, ...keys.filter(k => SHOTS.has(k)));   // (just the photographed ones)
  const noSpot = [], blocked = [];
  for (const k of keys) {
    const r = await W(k => {
      const t = svTargets().find(o => o.key === k);
      if (t.type === 'forklift' && !t.box.isEmpty() && t.area === 'outside') return { skip: true };
      const sp = svViewSpot(t);
      svGoToTarget(t);
      return { name: t.name, floor: t.floor, area: t.area, spot: sp && { x: +sp.x.toFixed(2), z: +sp.z.toFixed(2), clear: sp.clear } };
    }, k);
    if (r.skip) continue;
    if (!r.spot) { noSpot.push(k); continue; }
    if (!r.spot.clear) blocked.push(k);
    await settle();
    const card = await W(k => {
      const el = document.getElementById('svCard'), t = svTargets().find(o => o.key === k);
      const c = t.box.getCenter(new THREE.Vector3()), d = Math.hypot(c.x - shopVisit.x, c.z - shopVisit.z);
      // is it in the middle of the view?
      const p = c.clone().project(camera);
      return { shown: !el.classList.contains('hidden') && shopVisit.pinned === t, text: el.innerText.split('\n')[0], floor: shopVisit.floor, dist: +d.toFixed(2), onScreen: Math.abs(p.x) < 0.7 && Math.abs(p.y) < 0.8 && p.z < 1 };
    }, k);
    console.log('target', k, JSON.stringify(r.spot), JSON.stringify(card));
    if (!card.shown) fails.push(`${k}: card not shown`);
    if (!card.onScreen) fails.push(`${k}: not in view from its spot`);
    if (SHOTS.has(k)) { await wait(1200); await shot(`visit-${TAG}-card-${k}`); }
  }
  if (noSpot.length) fails.push('no viewing spot: ' + noSpot.join(', '));
  if (blocked.length) fails.push('no clear viewing spot: ' + blocked.join(', '));
  console.log('targets checked:', keys.length, 'no spot:', noSpot.length, 'not clear:', blocked.length);
  // The machines list
  await W(() => document.querySelector('#svHud [data-sv="list"]').click());
  await wait(800);
  const items = await W(() => document.querySelectorAll('#svListItems [data-sv-go]').length);
  console.log('list items here:', items);
  if (!items) fails.push('machines list empty');
  await shot(`visit-${TAG}-list`);
  await W(() => document.querySelector('#svList [data-sv="list-close"]').click());
  // Stairs: walk into the flight on floor 1 and come out on floor 2, then back down
  await W(() => document.querySelector('#svHud [data-sv-area="f1"]').click()); await settle();
  for (const [from, to, i] of [[1, 2, 0], [2, 1, 1]]) {
    await W(([from, i]) => { const z = shopVisit.geo.zones.filter(z => z.floor === from)[i]; shopVisit.stairCool = false; shopVisit.x = (z.r.x0 + z.r.x1) / 2; shopVisit.z = (z.r.z0 + z.r.z1) / 2; }, [from, from === 2 ? 0 : 0]);
    await wait(400); await settle();
    const f = await W(() => shopVisit.floor);
    console.log('stairs', from, '->', f);
    if (f !== to) fails.push(`stairs ${from}->${to} ended on ${f}`);
  }
  // Elevator: the landing shows the ride buttons, they ride to floor 3 and back
  await W(() => { const r = shopVisit.geo.lift[shopVisit.floor]; shopVisit.x = (r.x0 + r.x1) / 2; shopVisit.z = (r.z0 + r.z1) / 2; });
  await wait(700);
  const liftShown = await W(() => !document.getElementById('svLift').classList.contains('hidden'));
  if (!liftShown) fails.push('elevator buttons not shown on the landing');
  for (const n of [3, 1]) {
    await W(n => document.querySelector(`#svLift [data-sv-floor="${n}"]`)?.click() ?? svGoFloor(n), n);
    await settle();
    const f = await W(() => ({ floor: shopVisit.floor, view: wsViewFloor }));
    console.log('elevator ->', JSON.stringify(f));
    if (f.floor !== n || f.view !== n) fails.push(`elevator to ${n}: ${JSON.stringify(f)}`);
  }
  // Leave: the camera, HUD and the building go back to normal
  await W(() => document.querySelector('#svHud [data-sv="exit"]').click());
  await wait(1200);
  const after = await W(() => ({ mode: state.cameraMode, fov: camera.fov, near: camera.near, hud: document.getElementById('svHud').classList.contains('hidden'), card: document.getElementById('svCard').classList.contains('hidden'), body: document.body.classList.contains('shopvisit-on'), roof: svRoofs().every(m => m.visible), view: wsViewFloor, f2: !wsFloor2 || wsFloor2.visible, bar: getComputedStyle(document.getElementById('exploreBar') || document.body).display }));
  console.log('after exit:', JSON.stringify(after), 'before:', JSON.stringify(before));
  if (after.mode !== before.mode || Math.abs(after.fov - before.fov) > 0.01 || after.near !== before.near || !after.hud || !after.card || after.body || !after.roof || after.view !== null || !after.f2) fails.push('exit did not restore: ' + JSON.stringify(after));
  await shot(`visit-${TAG}-after-exit`);
  console.log('fails:', fails.length ? fails : 'none');
  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
  if (server) server.close();
  process.exit(fails.length || errors.length ? 1 : 0);
})();
