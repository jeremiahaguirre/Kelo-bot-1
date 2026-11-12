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

  if (scenario === 'top') {
    const [px, py, pz, tx, tz] = (process.env.CAM || '10,40,-4.01,10,-4').split(',').map(Number);
    if (process.env.SETUP) await page.evaluate(process.env.SETUP);
    await page.waitForTimeout(+process.env.WAIT || 500);
    await look(px, py, pz, tx, 0, tz);
    await page.waitForTimeout(800);
    await shot(process.env.NAME || 'top');
  }

  if (scenario === 'gear') {
    // Freeze his own life so nothing moves him around mid-shot
    await page.evaluate(() => { state.isPracticing = true; state.isBusy = true; });
    // Tools lined up beside Kelo-1 in the empty yard, at the size he carries them
    await page.evaluate(() => {
      const names = ['A sturdy shovel', 'Pickaxe', 'Jackhammer', 'Axe', 'Claw hammer', 'Wrench', 'Hand saw', 'Pliers', 'Screwdriver', 'Knife', 'Cordless drill', 'Toolbox', 'Telescope', 'Skis', 'Snowshoes', 'Car keys'];
      window.__lineup = new THREE.Group();
      names.forEach((n, i) => { const x = 20.2 + i * 0.62; const m = buildItemModel3D(n, { label: false }); m.scale.setScalar(1.6); m.position.set(x, getAnalyticalGroundHeight(x, 0), 0); window.__lineup.add(m); });
      scene.add(window.__lineup);
      state.botPos = { x: 18.6, z: 0 }; state.targetPos = { ...state.botPos }; state.botRotY = Math.PI / 2;
    });
    await look(23.2, 2.6, 7.4, 23.2, 1.1, 0);
    await page.waitForTimeout(1500);
    await shot('gear-tools');
    await page.evaluate(() => {
      scene.remove(window.__lineup);
      ['Dump truck', 'Excavator', 'Bicycle', 'Snowmobile', 'Helicopter', 'Hot air balloon', 'Rowboat'].forEach(n => { state.toolInventory.push(n); registerVehicle(n); });
      state.botPos = { x: 19.5, z: 5.2 }; state.targetPos = { ...state.botPos }; state.botRotY = Math.PI;
    });
    await look(25, 10, 15, 25, 0, -1);
    await page.waitForTimeout(1500);
    await shot('gear-yard');
    await look(31, 9, 8, 38.5, 2, -2);
    await page.waitForTimeout(800);
    await shot('gear-pads');
    await look(-16, 8, 8, -24, 4, -2.5);
    await page.waitForTimeout(800);
    await shot('gear-balloon');
    // Kelo-1 in the truck's driver seat, seen from the driver's side
    await page.evaluate(() => {
      const v = findVehicle('truck');
      state.riding = v.id; state.ridingMode = 'land'; state.botPos = { x: v.x, z: v.z }; state.targetPos = { ...state.botPos }; state.botRotY = Math.PI / 2;
    });
    await look(25.5, 3.2, -11.5, 23.4, 2.4, -5.0);
    await page.waitForTimeout(1200);
    await shot('gear-truck-seat');
    await page.evaluate(() => {
      const v = findVehicle('bike');
      state.riding = v.id; state.botPos = { x: v.x, z: v.z }; state.targetPos = { ...state.botPos }; state.botRotY = Math.PI / 2;
    });
    await look(21.0, 2.5, 8.5, 21.0, 1.5, 2.2);
    await page.waitForTimeout(1200);
    await shot('gear-bike-seat');
    await page.evaluate(() => {
      state.riding = null;
      state.botPos = { x: 14, z: 3 }; state.targetPos = { ...state.botPos };
      ['A dump truck', 'Excavator', 'Bicycle', 'Hot air balloon', 'Helicopter', 'Rowboat'].forEach((n, i) => state.mailbox.push({ id: 'm' + i, kind: 'gift', name: n, from: 'test' }));
      renderPostOfficeParcels3D();
    });
    await look(16.2, 2.2, 3.0, 16.2, 1.0, 0.4);
    await page.waitForTimeout(800);
    await shot('gear-counter');
    await look(4, 5, 4, 2.2, 0, 11.6);
    await page.waitForTimeout(500);
    await shot('gear-dock');
  }

  if (scenario === 'sizes') {
    await page.evaluate(() => { state.isPracticing = true; state.isBusy = true; state.roofCutaway = true; });
    await page.evaluate(() => {
      ['Screwdriver', 'Toolbox', 'A sturdy shovel', 'Claw hammer', 'Wrench', 'Telescope', 'A basket of apples', 'Yo-yo', 'Cordless drill', 'Pliers', 'Skis', 'Knife', 'Jackhammer', 'Axe']
        .forEach(n => state.toolInventory.push(n));
      renderStorehouseShelves3D();
      state.botPos = { x: 5.5, z: -2.2 }; state.targetPos = { ...state.botPos }; state.botRotY = Math.PI;
      setCarriedObject(buildItemModel3D('A sturdy shovel', { label: false }));
    });
    await look(5.5, 3.6, 2.6, 5.5, 1.2, -6.2);
    await page.waitForTimeout(1500);
    await shot('sizes-shelves');
    await page.evaluate(() => { setCarriedObject(buildItemModel3D('Toolbox', { label: false })); state.botRotY = 0.6; });
    await look(7.5, 2.4, 1.5, 5.5, 1.2, -2.2);
    await page.waitForTimeout(800);
    await shot('sizes-carry');
    await page.evaluate(() => {
      ['Screwdriver', 'A dump truck', 'A sturdy shovel', 'Toolbox', 'A basket of apples', 'Telescope'].forEach((n, i) => state.mailbox.push({ id: 's' + i, kind: 'gift', name: n, from: 'test' }));
      renderPostOfficeParcels3D();
    });
    await look(16.2, 2.2, 3.0, 16.2, 1.0, 0.4);
    await page.waitForTimeout(800);
    await shot('sizes-counter');
  }

  if (scenario === 'ui') {
    const tag = process.env.VW ? 'm' : 'd';
    await page.waitForTimeout(1500);
    await shot(`ui-${tag}-main`);
    await page.evaluate(s => document.querySelector(s).click(), '#btnToggleMenu');
    await page.waitForTimeout(600);
    for (const t of ['talk', 'requests', 'diary', 'brain', 'world']) {
      await page.evaluate(s => document.querySelector(s).click(), `[data-tab="${t}"]`);
      await page.waitForTimeout(400);
      await shot(`ui-${tag}-${t}`);
    }
    await page.evaluate(s => document.querySelector(s).click(), '#btnCloseMenu');
    await page.evaluate(s => document.querySelector(s).click(), '#btnOpenSettings');
    await page.waitForTimeout(500);
    await shot(`ui-${tag}-settings`);
  }

  if (scenario === 'things') {
    await page.evaluate(() => { state.isPracticing = true; state.isBusy = true; });
    await page.evaluate(() => {
      const names = ['A sourdough loaf', 'Baguette', 'Croissant', 'Cherry pie', 'Birthday cake', 'Cookies', 'Ramen', 'Cheddar cheese', 'Pizza', 'Chocolate bar', 'Coffee', 'Hot cocoa', 'Thermos', 'Fresh salmon', 'Carrots', 'A basket of apples',
        'Kite', 'Yo-yo', 'Soccer ball', 'Juggling balls', 'Beach ball', 'Rubber duck', 'Spinning top', 'Toy frog', 'Lego bricks', 'Guitar', 'Ukulele', 'Violin', 'Harmonica', 'A novel', 'Seed packets'];
      window.__lineup = new THREE.Group();
      names.forEach((n, i) => { const row = i < 16 ? 0 : 1; const x = 19.8 + (row ? i - 16 : i) * 0.62; const z = row ? -1.4 : 0.2;
        const m = lifeSize(buildItemModel3D(n, { label: false })); m.position.set(x, getAnalyticalGroundHeight(x, z), z); window.__lineup.add(m); });
      scene.add(window.__lineup);
      state.botPos = { x: 18.4, z: -0.4 }; state.targetPos = { ...state.botPos }; state.botRotY = Math.PI / 2;
    });
    await look(22.6, 2.4, 5.0, 22.6, 0.6, -0.6);
    await page.waitForTimeout(1500);
    await shot('things-left');
    await look(27.2, 2.0, 4.0, 27.2, 0.4, -0.6);
    await page.waitForTimeout(800);
    await shot('things-right');
  }

  if (scenario === 'knowhow') {
    const waitFor = async (fn, ms = 120000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await page.waitForTimeout(500); } return false; };
    // 1. Digging: he has a shovel but has never used one
    await page.evaluate(() => { state.toolInventory.push('A sturdy shovel'); state.knowsDigging = true; state.isCollectingMail = false; });
    console.log('dig attempt:', await page.evaluate(() => digAt(-10, -20, 'Test')));
    console.log('speech:', await page.evaluate(() => state.speechBubble));
    console.log('learned dig:', await waitFor(() => Boolean(state.knowHow.dig)));
    console.log('diary:', await page.evaluate(() => state.diaryEntries[0].mood + ' | ' + state.diaryEntries[0].text.slice(0, 120)));
    await page.evaluate(() => { state.isCollectingMail = true; });
    // 2. A dump truck with an empty tank
    await page.evaluate(() => { state.toolInventory.push('Dump truck'); registerVehicle('Dump truck'); state.knowHow.truck = { at: 1 }; });
    console.log('truck ready?', await page.evaluate(() => readyToOperate('Dump truck', findVehicle('truck'))), await page.evaluate(() => state.speechBubble));
    console.log('requests:', await page.evaluate(() => state.requestsToUser.filter(r => !r.fulfilled).map(r => r.requestedGear).join(' | ')));
    // 3. Diesel arrives
    await page.evaluate(() => { state.belongings.unshift({ name: 'A jerry can of diesel', category: 'fuel' }); state.isCollectingMail = false; receiveFuel('A jerry can of diesel'); });
    console.log('refuelled:', await waitFor(() => findVehicle('truck').fuel === 100), await page.evaluate(() => ({ can: state.belongings.some(b => /diesel/.test(b.name)), mood: state.moodTitle })));
    console.log('truck ready now?', await page.evaluate(() => readyToOperate('Dump truck', findVehicle('truck'))));
    await page.evaluate(() => { const v = findVehicle('truck'); burnFuel(v, 30); });
    console.log('fuel after 30 units:', await page.evaluate(() => findVehicle('truck').fuel));
    // 4. Telescope by day, then at night
    await page.evaluate(() => { state.toolInventory.push('Telescope'); state.knowHow.telescope = { at: 1 }; window.__realNow = worldNow; });
    console.log('day stargaze:', await page.evaluate(() => stargaze('Test')), await page.evaluate(() => state.speechBubble));
    await page.evaluate(() => { window.worldNow = () => ({ ...window.__realNow(), isNight: true }); });
    const p = page.evaluate(() => stargaze('Test'));
    await waitFor(() => /Stargazing/.test(state.moodTitle), 60000);
    await page.waitForTimeout(500);
    await look(TOWN_LOCATIONS_X = -12.5, 2.4, 2.5, -15.5, 1.2, -1.5).catch(() => {});
    await page.evaluate(() => { state.cameraMode = 'none'; const k = keloGroup.position; camera.position.set(k.x + 1.0, k.y + 2.6, k.z + 4.2); controls.target.set(k.x + 0.6, k.y + 1.3, k.z); controls.update(); });
    await page.waitForTimeout(600);
    await shot('knowhow-stargaze');
    console.log('night stargaze:', await p, await page.evaluate(() => state.speechBubble));
  }

  if (scenario === 'snow') {
    const waitFor = async (fn, ms = 120000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await page.waitForTimeout(500); } return false; };
    await page.evaluate(() => { window.__realNow = worldNow; window.worldNow = () => ({ ...window.__realNow(), season: 'Winter', isNight: false }); applySeasonLook('Winter'); });
    await page.evaluate(() => { state.cameraMode = 'overview'; });
    await page.waitForTimeout(2500);
    await shot('snow-winter-valley');
    // Walk him into the snow with no gear
    await page.evaluate(() => { state.isCollectingMail = false; state.botPos = { x: -4, z: -3 }; state.targetPos = { x: -4, z: -12 }; state.cameraMode = 'follow'; });
    console.log('stuck:', await waitFor(() => state.knowsSnow === true, 30000), await page.evaluate(() => ({ sink: snowSink(state.botPos), speech: state.speechBubble })));
    await page.waitForTimeout(800);
    await shot('snow-stuck');
    console.log('researched:', await waitFor(() => state.requestsToUser.some(r => /snowshoe/i.test(r.requestedGear || '')), 150000));
    console.log('requests:', await page.evaluate(() => state.requestsToUser.filter(r => !r.fulfilled).map(r => r.requestedGear).join(' | ')));
    // Snowshoes arrive
    await page.evaluate(() => { state.toolInventory.push('A pair of snowshoes'); state.isCollectingMail = true; state.isPracticing = true; state.botPos = { x: -4, z: -6 }; state.targetPos = { x: -4, z: -9 }; });
    console.log('with snowshoes:', await page.evaluate(() => ({ factor: snowWalkFactor(state.botPos), sink: snowSink(state.botPos) })));
    await page.waitForTimeout(1500);
    await shot('snow-snowshoes');
    await page.evaluate(() => { window.worldNow = () => ({ ...window.__realNow(), season: 'Spring' }); applySeasonLook('Spring'); state.cameraMode = 'overview'; });
    await page.waitForTimeout(2500);
    await shot('snow-spring-valley');
  }

  if (scenario === 'landscape') {
    await page.evaluate(() => { state.isCollectingMail = true; });
    const run = (fn) => page.evaluate(fn);
    // Chop the tree nearest a spot
    const target = await run(() => { const t = nearestTree(-22, -2); return { id: t.id, x: t.x, z: t.z }; });
    console.log('tree:', JSON.stringify(target));
    await run(() => { state.toolInventory.push('An axe'); state.knowHow.axe = { at: 1 }; state.botPos = { x: -18, z: -1 }; state.targetPos = { ...state.botPos }; });
    console.log('chop:', await run(() => chopTree(-22, -2, 'Testing.')), await run(() => ({ edits: state.worldEdits.length, logs: state.belongings.some(b => b.name === 'Firewood logs'), treeGone: nearestTree(-22, -2).id })));
    // He already knows these jobs and has their tools (the research flow is covered by the groundwork scenario)
    await run(() => { state.jobKnowledge = state.jobKnowledge || {}; ['road', 'earthwork', 'planting'].forEach(k => { state.jobKnowledge[k] = { at: Date.now(), from: [], tools: [], materials: [] }; }); state.toolInventory.push('A garden trowel', 'A watering can', 'A wheelbarrow', 'A landscape rake', 'A plate compactor'); state.isBusy = false; state.isPracticing = false; state.isBuilding = false; state.isBrowsing = false; });
    // Buildings are off limits
    console.log('plant at storehouse:', await run(() => { state.belongings.unshift({ name: 'A packet of maple tree seeds', category: 'material' }); return plantSeeds(5.5, -6.5); }), await run(() => state.speechBubble));
    console.log('plant:', await run(() => plantSeeds(-6, -1.5, 'A tree of my own.')));
    await run(() => { state.belongings.unshift({ name: 'Wildflower seeds', category: 'material' }); });
    console.log('flowers:', await run(() => plantSeeds(-21, 4.5, 'Colour.')));
    // Road and hill
    await run(() => { state.toolInventory.push('A sturdy shovel'); state.knowHow.dig = { at: 1 }; state.belongings.unshift({ name: 'A load of gravel', category: 'material' }); });
    console.log('road:', await run(() => buildRoad(-30, -8.5, -40, -8.5, 'Testing.')));
    console.log('hill:', await run(() => raiseHill(-35, -3, 'A lookout.')), await run(() => getAnalyticalGroundHeight(-35, -3).toFixed(2)));
    // Let the tree grow up for the picture
    await run(() => { state.worldEdits.filter(e => e.type === 'plant').forEach(e => { e.at -= 7 * WORLD_DAY_MS; editMeshes[e.id].scale.setScalar(growthOf(e)); }); savePersistentBrainState(); });
    await look(-21, 6, 12, -25, 0.5, 0);
    await page.waitForTimeout(800);
    await shot('landscape-after');
    // It all survives a reload
    await page.reload({ timeout: 420000 });
    await page.waitForTimeout(4000);
    console.log('after reload:', JSON.stringify(await run(() => ({ edits: state.worldEdits.map(e => e.type), meshes: Object.keys(editMeshes).length, treeStillGone: valleyTrees.find(t => t.id === state.worldEdits.find(e => e.type === 'chop').treeId).removed, hill: getAnalyticalGroundHeight(-35, -3).toFixed(2) }))));
    await look(-21, 6, 12, -25, 0.5, 0);
    await page.waitForTimeout(800);
    await shot('landscape-reloaded');
    // Undo the hill
    await run(() => { state.isCollectingMail = true; });
    console.log('undo hill:', await run(() => { const h = state.worldEdits.find(e => e.type === 'hill'); return h ? undoEdit(h.id) : 'no hill was made'; }), await run(() => ({ edits: state.worldEdits.map(e => e.type), hill: getAnalyticalGroundHeight(-35, -3).toFixed(2) })));
  }

  if (scenario === 'anywhere') {
    const run = (fn) => page.evaluate(fn);
    console.log('spots:', await run(() => {
      const pts = Array.from({ length: 400 }, () => openGroundSpot(1.5, Math.random() < 0.5 ? state.botPos : null));
      const bs = Array.from({ length: 200 }, () => buildSpot());
      const all = pts.concat(bs);
      return { inTown: all.filter(p => inTown(p.x, p.z)).length, offLimits: pts.filter(p => offLimits(p.x, p.z)).length,
        mountain: pts.filter(p => p.z < -12).length, east: pts.filter(p => p.x > TOWN.maxX).length, west: pts.filter(p => p.x < TOWN.minX).length, beach: pts.filter(p => p.z > 7).length };
    }));
    await run(() => { state.toolInventory.push('A sturdy shovel'); state.knowHow.dig = { at: 1 }; state.belongings.unshift({ name: 'A load of gravel', category: 'material' }); state.botPos = { x: 30, z: -2 }; state.targetPos = { ...state.botPos }; });
    console.log('town hill refused:', await run(() => raiseHill(0, 0, 'test')), await run(() => state.speechBubble));
    const hs = await run(() => { const a = openGroundSpot(2.6, { x: -30, z: -2 }), b = openGroundSpot(2.6, { x: -36, z: 3 }); window.__hs = [a, b]; return [a, b]; });
    console.log('spots for hills', JSON.stringify(hs));
    console.log('hollow:', await run(() => { const p = __hs[0]; state.botPos = { x: p.x - 3, z: p.z }; state.targetPos = { ...state.botPos }; return raiseHill(p.x, p.z, 'A sheltered spot.', 'Test', true); }), await run(() => getAnalyticalGroundHeight(__hs[0].x, __hs[0].z).toFixed(2)), await run(() => state.speechBubble));
    console.log('hill:', await run(() => raiseHill(__hs[1].x, __hs[1].z, 'A lookout.')), await run(() => getAnalyticalGroundHeight(__hs[1].x, __hs[1].z).toFixed(2)));
    console.log('road east:', await run(() => buildRoad(30, 4, 44, 4, 'A path.')));
    console.log('summary:', await run(() => landscapeSummaryForAI()));
    await page.evaluate(([p]) => { state.cameraMode = 'none'; camera.position.set(p.x + 2, 6, p.z + 11); controls.target.set(p.x + 2, 0, p.z); controls.update(); }, hs);
    await page.waitForTimeout(900);
    await shot('anywhere');
    console.log('undo hollow:', await run(() => { const e = state.worldEdits.find(e => e.type === 'hill' && e.h < 0); return e ? undoEdit(e.id) : 'none'; }));
    for (let i = 0; i < 3; i++) console.log('own shaping:', await run(async () => { state.isPracticing = false; const r = await shapeTheValleyOnMyOwn(); return [r, state.moodTitle]; }));
  }

  if (scenario === 'groundwork') {
    const run = (fn) => page.evaluate(fn);
    const waitFor = async (fn, ms = 240000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await page.waitForTimeout(1000); } return false; };
    await run(() => { state.toolInventory.push('A sturdy shovel'); state.belongings.unshift({ name: 'A load of gravel', category: 'material' }); state.isCollectingMail = false; state.isBusy = false; state.isPracticing = false; });
    console.log('first try:', await run(() => buildRoad(-30, -8.5, -42, -8.5, 'test')), await run(() => state.speechBubble));
    console.log('researched:', await waitFor(() => jobKnown('road')), await run(() => state.diaryEntries[0].text.slice(0, 300)));
    await page.waitForTimeout(2500);
    await run(() => { state.isCollectingMail = true; });
    console.log('asked for:', await run(() => state.requestsToUser.filter(r => !r.fulfilled).map(r => r.requestedGear).join(' | ')));
    await run(() => { state.toolInventory.push('A wheelbarrow', 'A landscape rake', 'A plate compactor'); state.isBusy = false; state.isPracticing = false; state.isBuilding = false; state.isBrowsing = false; });
    const p = run(() => buildRoad(-30, -8.5, -42, -8.5, 'A path to the woods.'));
    await waitFor(() => /Rake it/.test(state.speechBubble), 120000);
    await page.evaluate(() => { state.cameraMode = 'none'; camera.position.set(state.botPos.x + 3, 4, state.botPos.z + 7); controls.target.set(state.botPos.x, 0.8, state.botPos.z); controls.update(); });
    await page.waitForTimeout(600);
    await shot('gw-rake');
    await waitFor(() => /pack it down/.test(state.speechBubble), 120000);
    await page.evaluate(() => { state.cameraMode = 'none'; camera.position.set(state.botPos.x + 3, 4, state.botPos.z + 7); controls.target.set(state.botPos.x, 0.8, state.botPos.z); controls.update(); });
    await page.waitForTimeout(600);
    await shot('gw-compact');
    console.log('road built:', await p, await run(() => ({ gravelLeft: ownedItemNames().filter(n => /gravel/i.test(n)), road: state.worldEdits.filter(e => e.type === 'road').map(e => e.surface) })));
    await run(() => { state.isBusy = false; state.isPracticing = false; state.isBuilding = false; state.isBrowsing = false; state.isCollectingMail = false; });
    console.log('pave try:', await run(() => paveRoad('any', 'test')), await run(() => state.speechBubble));
    console.log('researched paving:', await waitFor(() => jobKnown('paving')));
    await page.waitForTimeout(2500);
    console.log('asked for:', await run(() => state.requestsToUser.filter(r => !r.fulfilled).map(r => r.requestedGear).join(' | ')));
    await run(() => { state.isCollectingMail = true; state.isBusy = false; state.isPracticing = false; state.isBuilding = false; state.isBrowsing = false; state.toolInventory.push('A walk-behind road roller'); state.belongings.unshift({ name: 'A load of hot-mix asphalt', category: 'material' }); });
    const q = run(() => paveRoad('any', 'Smoother.'));
    await waitFor(() => /roll it flat/.test(state.speechBubble), 120000);
    await page.evaluate(() => { state.cameraMode = 'none'; camera.position.set(state.botPos.x + 3, 4, state.botPos.z + 7); controls.target.set(state.botPos.x, 0.8, state.botPos.z); controls.update(); });
    await page.waitForTimeout(600);
    await shot('gw-roll');
    console.log('paved:', await q, await run(() => ({ asphaltLeft: ownedItemNames().filter(n => /asphalt/i.test(n)), road: state.worldEdits.filter(e => e.type === 'road').map(e => e.surface), summary: groundworkSummaryForAI() })));
    await look(-36, 7, -2, -36, 0, -8.5);
    await page.waitForTimeout(800);
    await shot('gw-paved');
  }

  if (scenario === 'skills') {
    const run = (fn) => page.evaluate(fn);
    const waitFor = async (fn, ms = 240000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await page.waitForTimeout(1000); } return false; };
    console.log('no heli:', await run(async () => { await respondToVisitor('Jeremiah', 'Try flying your helicopter!'); return state.chatLog.slice(-1)[0].text; }));
    await run(() => { state.toolInventory.push('A helicopter'); registerVehicle('A helicopter'); renderVehicles3D(); const v = findVehicle('air'); v.fuel = 100; state.knowHow.helicopter = { at: 1 }; });
    await run(() => { state.isCollectingMail = false; state.isBusy = false; state.isPracticing = false; state.isBuilding = false; state.isBrowsing = false; });
    console.log('asked:', await run(async () => { await respondToVisitor('Jeremiah', 'Try flying your helicopter!'); return state.chatLog.slice(-1)[0].text; }));
    await waitFor(() => state.riding, 120000);
    await page.waitForTimeout(6000);
    await page.evaluate(() => { state.cameraMode = 'none'; camera.position.set(state.botPos.x + 10, 16, state.botPos.z + 16); controls.target.set(state.botPos.x, 8, state.botPos.z); controls.update(); });
    await page.waitForTimeout(600);
    await shot('skill-heli');
    console.log('done:', await waitFor(() => state.skills['flying helicopter'], 300000), await run(() => ({ skills: state.skills, speech: state.speechBubble, diary: state.diaryEntries[0].text.slice(0, 200), fuel: findVehicle('air').fuel, summary: skillsSummaryForAI() })));
    await run(() => { document.querySelector('[data-section="skills"]') && renderSkillsList(); });
    console.log('list:', await run(() => document.getElementById('skillsListContainer').innerText));
    console.log('weld goes to museum:', await run(() => { const c = { title: 'Test piece', x: -40, z: -30, archetype: 'custom_weld', colorHex: '#ff0000', secondaryColorHex: '#00ff00', parts: null }; weldAndPlace(c); return true; }));
    await waitFor(() => !state.isBuilding && state.inventedCreations.some(c => c.title === 'Test piece'), 200000);
    console.log('test piece:', await run(() => state.inventedCreations.filter(c => c.title === 'Test piece').map(c => ({ inMuseum: c.inMuseum, x: c.x, z: c.z }))));
  }

  if (scenario === 'fresh') {
    await page.evaluate(() => { localStorage.setItem('kelo1_brain_v3', JSON.stringify({ health: 3, worldEdits: [{ type: 'hill' }] })); localStorage.setItem('kelo1_memory_archive_v2', '{}'); localStorage.setItem('kelo1_gemini_api_key', 'KEEP'); });
    await page.reload({ timeout: 420000 });
    await page.waitForTimeout(6000);
    console.log('fresh:', JSON.stringify(await page.evaluate(() => ({
      oldGone: localStorage.getItem('kelo1_brain_v3') === null && localStorage.getItem('kelo1_memory_archive_v2') === null,
      keyKept: localStorage.getItem('kelo1_gemini_api_key') === 'KEEP',
      day: worldNow().day, mood: state.moodTitle, health: state.health,
      nonEmpty: Object.entries(state).filter(([k, v]) => (Array.isArray(v) && v.length) || (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length)).map(([k, v]) => k + ':' + JSON.stringify(v).slice(0, 80))
    }))));
    await page.evaluate(() => localStorage.removeItem('kelo1_gemini_api_key'));
    // He keeps what he learns from here on: no reset on later visits
    await page.evaluate(() => { state.health = 33; state.diaryEntries.unshift({ time: 'Test', location: 'x', mood: 'x', text: 'REMEMBER ME' }); state.worldEdits.push({ id: 'hill-test', type: 'hill', x: -40, z: 2, r: 2.4, h: 1 }); savePersistentBrainStateNow ? savePersistentBrainStateNow() : savePersistentBrainState(); });
    for (let i = 1; i <= 2; i++) {
      await page.reload({ timeout: 420000 });
      await page.waitForTimeout(6000);
      console.log('reload', i, JSON.stringify(await page.evaluate(() => ({ health: Math.round(state.health), remembers: state.diaryEntries.some(d => d.text === 'REMEMBER ME'), hill: state.worldEdits.some(e => e.id === 'hill-test') }))));
    }
  }

  if (scenario === 'watch') {
    await page.evaluate(() => { state.isCollectingMail = false; });
    const mins = +process.env.MINS || 6;
    const t0 = Date.now(); let last = '';
    const seen = {};
    while (Date.now() - t0 < mins * 60000) {
      const snap = await page.evaluate(() => {
        if (!(state.isBusy || state.isBuilding || state.isPracticing || state.isCollectingMail || state.isSleeping) && Math.random() < 0.5) { try { runAutonomousLifeTick(); } catch (e) {} }
        return `${state.moodTitle} | ${String(state.speechBubble).slice(0, 110)} | busy=${+!!state.isBusy} bld=${+!!state.isBuilding} prac=${+!!state.isPracticing} mail=${+!!state.isCollectingMail}`;
      });
      if (snap !== last) { const k = snap.split(' | ')[0]; seen[k] = (seen[k] || 0) + 1; console.log(`[${Math.round((Date.now() - t0) / 1000)}s] ${snap}`); last = snap; }
      await page.waitForTimeout(2000);
    }
    console.log('COUNTS', JSON.stringify(Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 12)));
    console.log('requests:', await page.evaluate(() => state.requestsToUser.filter(r => !r.fulfilled).map(r => r.requestedGear || r.codeFeature || r.title).join(' | ')));
  }

  if (scenario === 'loops') {
    console.log('loop test:', JSON.stringify(await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      let calls = 0;
      window.landscapeChance = () => 1;
      const real = window.shapeTheValleyOnMyOwn;
      window.shapeTheValleyOnMyOwn = () => { calls++; return Promise.resolve('getting-ready'); };
      ['diggingChance', 'disposalChance', 'projectChance', 'shopChance', 'printChance', 'codeWishChance', 'skillPracticeChance'].forEach(f => { if (typeof window[f] === 'function') window[f] = () => 0; });
      state.isCollectingMail = false; state.isBusy = false; state.isPracticing = false; state.isBuilding = false;
      for (let i = 0; i < 6; i++) { runAutonomousLifeTick(); await sleep(300); state.isBusy = false; state.isPracticing = false; state.isBuilding = false; state.isCollectingMail = false; }
      window.shapeTheValleyOnMyOwn = real;
      const rep = (() => { state.recentDecisionTitles = ['Welding a Copper Heron by the Lake']; return [isRepeatDecision({ actionTitle: 'Welding a copper heron near the lake' }), isRepeatDecision({ actionTitle: 'Reading about bees at NetNode' })]; })();
      return { landscapeCalls: calls, cooling: activityCoolingDown('landscape'), repeatCheck: rep };
    })));
  }

  if (scenario === 'printshop') {
    const run = (fn, arg) => page.evaluate(fn, arg);
    await run(() => {
      const p = printerState();
      const add = (name, key, parts) => { p.designs[name] = { key, parts: parts || null, color: '#2563eb', material: 'PLA', size: null, at: Date.now() }; p.history.unshift({ key: key || name, what: name, ok: true }); };
      add('a 3d-printed phone stand', 'stand'); add('a 3d-printed little tugboat', 'tugboat'); add('a 3d-printed gear', 'gear');
      add('a 3d-printed statue of "buried treasure theory"', null, [{ shape: 'box', x: 0, y: 0.2, z: 0, sx: 0.2, sy: 0.4, sz: 0.2 }]);
      add('a 3d-printed little heron', null, [{ shape: 'cylinder', x: 0, y: 0.2, z: 0, sx: 0.05, sy: 0.4, sz: 0.05 }]);
      p.prints = 5;
    });
    console.log('candidates:', JSON.stringify(await run(() => sellableCandidates().map(c => `${c.name} @ $${guessPrice(c)}`))));
    console.log('refuse hammer:', await run(() => [resolveSellable('A claw hammer'), state.speechBubble]));
    console.log('refuse gear:', await run(() => [resolveSellable('a 3d-printed gear'), state.speechBubble]));
    console.log('refuse concept:', await run(() => [resolveSellable('a 3d-printed statue of "buried treasure theory"'), state.speechBubble]));
    await run(() => { state.isCollectingMail = false; state.isBusy = false; state.isPracticing = false; state.isBuilding = false; state.isSleeping = false; });
    console.log('list stand at $50:', await run(() => listForSale(resolveSellable('phone stand'), 50, '', 'Test')));
    await run(() => { state.isBusy = false; state.isPracticing = false; state.isBuilding = false; state.isSleeping = false; });
    console.log('list next:', await run(() => tendShop('Test')));
    await page.waitForTimeout(90000);
    console.log('listings:', JSON.stringify(await run(() => ensureShop().listings.map(l => ({ name: l.name, price: l.price, details: l.file.details, desc: l.description })))));
    const id = await run(() => ensureShop().listings[ensureShop().listings.length - 1].id);
    await run(i => markListingSold(i), id);
    console.log('after sale:', JSON.stringify(await run(() => ({ n: ensureShop().listings.length, sales: ensureShop().listings.map(l => l.sales), earned: ensureShop().earnings }))));
    const dl = page.waitForEvent('download');
    await run(i => downloadListingSTL(i), id);
    const d = await dl;
    const file = require('path').join(OUT, 'test.stl');
    await d.saveAs(file);
    const txt = require('fs').readFileSync(file, 'utf8');
    console.log('stl:', d.suggestedFilename(), txt.split('\n')[0], 'facets', (txt.match(/facet normal/g) || []).length, txt.trim().split('\n').pop());
    await run(() => { if (typeof savePersistentBrainStateNow === 'function') savePersistentBrainStateNow(); else savePersistentBrainState(); });
    await page.evaluate(() => { const el = document.getElementById('keloShopPanel'); if (el) { renderShopPanel(); el.scrollIntoView(); } });
    await page.waitForTimeout(800);
    await shot('printshop-panel');
    await page.goto(`http://localhost:${PORT}/shop.html`, { timeout: 420000 });
    await page.waitForTimeout(3000);
    await shot('printshop-site');
  }

  if (scenario === 'notice') {
    const run = (fn) => page.evaluate(fn);
    console.log('before:', JSON.stringify(await run(() => state.placesNoticed)));
    const t0 = Date.now(); let done = false, sawWs = false;
    while (Date.now() - t0 < 600000 && !done) {
      const r = await run(() => ({ n: state.placesNoticed || {}, title: state.moodTitle, pos: state.botPos }));
      if (r.n.workshop && !sawWs) { sawWs = true; console.log('workshop noticed at', JSON.stringify(r.pos), 'title', r.title); await page.evaluate(() => { state.cameraMode = 'none'; camera.position.set(state.botPos.x - 4, 5, state.botPos.z + 9); controls.target.set(state.botPos.x, 2, state.botPos.z - 4); controls.update(); }); await page.waitForTimeout(800); await shot('notice-workshop'); }
      if (r.n.workshop && r.n.plant) done = true;
      await page.waitForTimeout(3000);
    }
    console.log('plant noticed at', JSON.stringify(await run(() => state.botPos)));
    await page.evaluate(() => { state.cameraMode = 'none'; camera.position.set(state.botPos.x - 6, 5, state.botPos.z + 8); controls.target.set(state.botPos.x + 4, 2, state.botPos.z); controls.update(); });
    await page.waitForTimeout(800); await shot('notice-plant');
    console.log('after:', JSON.stringify(await run(() => ({ n: state.placesNoticed, diary: state.diaryEntries.slice(0, 2).map(d => d.mood + ' | ' + d.text.slice(0, 80)), busy: state.isBusy }))));
    await page.reload({ timeout: 420000 }); await page.waitForTimeout(25000);
    console.log('after reload, not repeated:', JSON.stringify(await run(() => ({ n: Object.keys(state.placesNoticed || {}), firstDiary: state.diaryEntries[0].mood }))));
  }

  if (scenario === 'projnudge') {
    const run = (fn) => page.evaluate(fn);
    await run(() => { state.projects = state.projects.filter(p => p.status !== 'gathering'); state.projects.unshift({ id: 'proj-test', key: 'treehouse', status: 'gathering', startedAt: Date.now() - 3600e3 }); state.requestsToUser = state.requestsToUser.filter(r => !/treehouse/i.test(r.question || '')); });
    await page.waitForTimeout(20000);
    console.log('after nudge:', JSON.stringify(await run(() => ({ open: state.requestsToUser.filter(r => !r.fulfilled && /treehouse/i.test(r.question || '')).map(r => r.requestedGear), diary: state.diaryEntries[0].mood + ' | ' + state.diaryEntries[0].text.slice(0, 160), speech: state.speechBubble, nudged: !!state.projects[0].nudgedAt }))));
    await page.waitForTimeout(12000);
    console.log('no spam:', await run(() => state.diaryEntries.filter(d => /Waiting to build/.test(d.mood)).length));
  }

  if (scenario === 'planitems') {
    const run = (fn) => page.evaluate(fn);
    console.log('plans:', JSON.stringify(await run(() => BUILD_PLANS.map(plan => {
      const keep = state.belongings.slice(), keepTools = state.toolInventory.slice();
      state.belongings = plan.materials.map(m => ({ name: m.ask, category: 'material' }));
      state.toolInventory = plan.tools.map(t => BUILD_TOOLS[t].ask);
      const miss = missingFor(plan);
      const r = { plan: plan.key, missing: [...miss.materials.map(m => m.ask), ...miss.tools.map(t => BUILD_TOOLS[t].ask)] };
      state.belongings = keep; state.toolInventory = keepTools;
      return r;
    }).filter(r => r.missing.length))));
    // A real treehouse build once the rope is in his things
    await run(() => {
      const plan = planFor('treehouse');
      state.projects = state.projects.filter(p => p.status !== 'gathering');
      state.projects.unshift({ id: 'proj-th', key: 'treehouse', status: 'gathering', startedAt: Date.now() - 86400e3 });
      plan.materials.forEach(m => state.belongings.unshift({ name: m.ask, category: 'material' }));
      plan.tools.forEach(t => state.toolInventory.push(BUILD_TOOLS[t].ask));
      state.isBusy = false; state.isBuilding = false; state.isPracticing = false; state.isCollectingMail = false;
    });
    console.log('missing now:', JSON.stringify(await run(() => missingFor(planFor('treehouse')))));
    const t0 = Date.now(); let st = '';
    while (Date.now() - t0 < 900000) { st = await run(() => (state.projects.find(p => p.id === 'proj-th') || {}).status + ' | ' + state.moodTitle); if (/^built/.test(st)) break; await page.waitForTimeout(5000); }
    console.log('treehouse:', st, JSON.stringify(await run(() => { const p = state.projects.find(q => q.id === 'proj-th'); return p && { x: p.x, z: p.z, tree: p.treeId }; })));
    if (/^built/.test(st)) { await run(() => { const p = state.projects.find(q => q.id === 'proj-th'); state.cameraMode = 'none'; camera.position.set(p.x + 6, 6, p.z + 7); controls.target.set(p.x, 2.5, p.z); controls.update(); }); await page.waitForTimeout(1500); await shot('treehouse-built'); }
  }

  if (scenario === 'madething') {
    const names = ['An SLA-printed resin jewellery master', 'An SLA-printed resin gear', 'A DMLS-printed stainless rocket nozzle', 'A Haas-machined aluminium bracket', 'A hand-blown glass cup', 'A turned maple bowl', 'A handmade maple stool'];
    for (const n of names) {
      console.log('add', n, '->', await page.evaluate(nm => { try { addMadeThing(nm, 'Test', { emoji: '🖨️' }); return 'ok ' + (state.workshop && state.workshop.made && state.workshop.made[0] && state.workshop.made[0].name); } catch (e) { return 'THROW ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' | '); } }, n));
    }
  }

  if (scenario === 'projects') {
    const waitFor = async (fn, ms = 180000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await page.waitForTimeout(1000); } return false; };
    const run = (fn) => page.evaluate(fn);
    await run(() => { state.isCollectingMail = true; });
    console.log('start:', await run(() => startProject('picnic', 'Test')));
    console.log('asked for:', await run(() => state.requestsToUser.filter(r => !r.fulfilled).map(r => r.requestedGear).join(' | ')));
    console.log('speech:', await run(() => state.speechBubble));
    // The visitor sends everything
    await run(() => {
      state.belongings.unshift({ name: 'Pine planks', category: 'material' }, { name: 'A box of wood screws', category: 'material' });
      state.toolInventory.push('A hand saw', 'A cordless drill');
      state.isCollectingMail = false;
    });
    console.log('built:', await waitFor(() => state.projects[0].status === 'built'), await run(() => ({ p: state.projects[0], planksLeft: state.belongings.some(b => /plank/i.test(b.name)), mesh: Object.keys(projectMeshes).length, diary: state.diaryEntries[0].text.slice(0, 160) })));
    await page.reload({ timeout: 420000 });
    await page.waitForTimeout(4000);
    console.log('after reload:', await run(() => ({ built: state.projects.filter(p => p.status === 'built').length, meshes: Object.keys(projectMeshes).length })));
    // Every build next to Kelo-1, for scale
    await run(() => {
      state.isPracticing = true; state.isBusy = true;
      BUILD_PLANS.forEach((plan, i) => { const p = { id: 'test-' + i, key: plan.key, status: 'built', x: 20 + i * 2.1, z: 0, rotY: 0 }; placeProjectMesh(p); });
      state.botPos = { x: 18.2, z: 0.4 }; state.targetPos = { ...state.botPos }; state.botRotY = Math.PI / 2;
    });
    await look(25.5, 3.2, 7.5, 25.5, 0.9, 0);
    await page.waitForTimeout(1200);
    await shot('projects-lineup');
  }

  if (scenario === 'trash') {
    const run = (fn) => page.evaluate(fn);
    await run(() => { state.isCollectingMail = true; });
    // Gifts arrive the normal way and get opened
    await run(async () => {
      for (const n of ['Rubber duck', 'Claw hammer', 'A novel']) await openParcel({ id: 'g-' + n, kind: 'gift', name: n, from: 'Tester', category: categorizeItem(n), note: '', time: 'now' });
      state.belongings.unshift({ name: 'a rusty bolt', category: 'junk', emoji: '🪨', from: 'a dig' });
      state.foundItems.unshift({ id: 'find-x', name: 'Gold nugget', emoji: '🪙', at: Date.now() });
      state.belongings.unshift({ name: 'Gold nugget', category: 'find', emoji: '🪙', from: 'the mountain' });
      state.isBusy = false; state.isPracticing = false; state.isBuilding = false;
    });
    for (const n of ['Rubber duck', 'Claw hammer', 'a rusty bolt', 'Gold nugget']) {
      await run(() => { state.isBusy = false; state.isPracticing = false; state.isBuilding = false; state.isSleeping = false; });
      console.log('dispose', n, await page.evaluate((n) => disposeItem(n, 'test'), n));
    }
    await run(() => { savePersistentBrainState(); renderAllUI(); if (typeof renderPortal === 'function') renderPortal(); });
    await page.reload({ timeout: 420000 });
    await page.waitForTimeout(3500);
    await run(() => { renderAllUI(); if (typeof renderPortal === 'function') renderPortal(); });
    const found = await run(() => {
      const out = {};
      ['Rubber duck', 'Claw hammer', 'rusty bolt', 'Gold nugget', 'A novel'].forEach(n => {
        out[n] = [...document.querySelectorAll('[id]')].filter(el => el.children.length < 200 && el.id && !/^(tab-|sideMenu)/.test(el.id) && el.textContent.includes(n)).map(el => el.id).filter((id, i, a) => !a.some(o => o !== id && document.getElementById(o).contains(document.getElementById(id)) && false)).slice(0, 12);
      });
      out.state = { inv: state.toolInventory, toys: state.toys.map(t => t.name), bel: state.belongings.map(b => b.name), unstored: state.unstoredItems };
      return out;
    });
    console.log(JSON.stringify(found, null, 1));
  }

  if (scenario === 'town') {
    const run = (fn) => page.evaluate(fn);
    // An older save with things he put in town
    await run(() => {
      state.inventedCreations.unshift({ title: 'Copper Heron', archetype: 'custom_weld', colorHex: '#c2773a', secondaryColorHex: '#334155', x: 2, z: 1, emoji: '🐦', parts: null, createdTime: 'Welded & placed' });
      state.inventedCreations.unshift({ title: 'Wind Spiral', archetype: 'kinetic_spire', colorHex: '#38bdf8', secondaryColorHex: '#f472b6', x: -30, z: 2, emoji: '🌀', createdTime: 'Welded & placed' });
      state.murals = [{ wallId: 'cafe_east', text: 'WONDER', palette: ['#ef4444', '#facc15', '#22c55e', '#3b82f6'], skill: 40, seed: 'm1', at: 1 }, { wallId: 'post_west', text: 'K1', palette: ['#a855f7', '#f97316', '#06b6d4', '#f8fafc'], skill: 70, seed: 'm2', at: 2 }];
      state.plantings = [{ x: -10, z: 6, color: '#ff00ff', at: 1 }];
      state.worldEdits = [{ id: 'hill-a', type: 'hill', x: 0, z: -2, r: 2.4, h: 1, at: 1 }];
      state.projects = [{ id: 'p1', key: 'picnic', status: 'built', x: -3.6, z: -1.3, rotY: 0 }];
      state.digSites = [{ id: 'dig-t', x: 3, z: -9, depth: 1, dirt: 2, finds: [] }];
      savePersistentBrainState();
    });
    await page.reload({ timeout: 420000 });
    await page.waitForTimeout(4500);
    console.log('after tidy:', JSON.stringify(await run(() => ({
      creations: state.inventedCreations.map(c => [c.title, Boolean(c.inMuseum)]), plantings: state.plantings.length, edits: state.worldEdits.length,
      project: [state.projects[0].x, state.projects[0].z], digs: state.digSites.length, diary: state.diaryEntries[0].text.slice(0, 200), museum: museumSummaryForAI() }))));
    // Town is refused, the beach is fine
    console.log('plant in town:', await run(() => { state.isCollectingMail = true; state.belongings.unshift({ name: 'Wildflower seeds', category: 'material' }); return plantSeeds(4, 2); }), await run(() => state.speechBubble));
    console.log('plant on beach:', await run(() => plantSeeds(-6, 8.3, 'By the water.')));
    console.log('dig in town:', await run(() => digAt(2, -3)));
    await run(() => { state.isPracticing = true; state.isBusy = true; state.botPos = { x: -40, z: 1.5 }; state.targetPos = { ...state.botPos }; state.botRotY = Math.PI; state.roofCutaway = true; cutawayRoofMeshes.forEach(r => { r.material.opacity = 0.18; }); });
    await look(-40, 7.5, 9, -40, 1.6, -4.5);
    await page.waitForTimeout(1200);
    await shot('museum-outside');
    await look(-40, 4.2, 1.2, -40, 1.8, -4.8);
    await page.waitForTimeout(800);
    await shot('museum-inside');
  }

  if (scenario === 'basement') {
    const run = (fn) => page.evaluate(fn);
    await run(() => { state.isCollectingMail = true; });
    // Fill the shelves and more: nothing should be dropped
    const n = await run(() => {
      for (let i = 0; i < 70; i++) state.belongings.unshift({ name: `Thing number ${i + 1}`, category: 'thing' });
      renderStorehouseShelves3D(); savePersistentBrainState();
      return { slots: shelfSlots.length, stored: storedItems().length, levels: storehouseBasementLevels(), lastLevel: storehouseLevelOf('Thing number 70') };
    });
    console.log('storehouse:', JSON.stringify(n));
    // A new gift goes down to the basement; then fetch something from B2
    await run(() => { state.belongings.unshift({ name: 'Rubber duck', category: 'toy' }); state.unstoredItems.push('Rubber duck'); });
    let deepest = 0;
    const p = run(() => putAwayItems());
    let done = false; p.then(() => { done = true; });
    for (let i = 0; i < 400 && !done; i++) { const d = await run(() => state.basementDepth); deepest = Math.max(deepest, d); if (d > 2 && i % 4 === 0 && !globalThis.__shot) { globalThis.__shot = 1; await look(9.5, 3.4, 1.2, 6.6, 0.4, -6); await shot('basement-going-down'); } await page.waitForTimeout(250); }
    console.log('put away:', await p, 'deepest went:', deepest.toFixed(1), await run(() => ({ level: storehouseLevelOf('Rubber duck'), title: state.moodTitle, depthNow: state.basementDepth })));
    await run(() => { state.basementDepth = 0; });
    // Reload: everything still there
    await page.reload({ timeout: 420000 }); await page.waitForTimeout(3500);
    console.log('after reload:', JSON.stringify(await run(() => ({ belongings: state.belongings.length, levels: storehouseBasementLevels() }))));
    // Museum: 20 sculptures + 11 paintings
    console.log('museum:', JSON.stringify(await run(() => {
      for (let i = 0; i < 20; i++) state.inventedCreations.unshift({ title: `Study ${i + 1}`, archetype: 'kinetic_spire', colorHex: '#38bdf8', secondaryColorHex: '#f472b6', x: -40, z: -5, inMuseum: true, createdTime: 'On display' });
      for (let i = 0; i < 11; i++) state.murals.unshift({ wallId: 'canvas-' + i, text: 'K' + i, palette: ['#ef4444', '#facc15', '#22c55e', '#3b82f6'], skill: 50, seed: 's' + i, at: i });
      trimBrainState(); renderMuseum3D();
      return { sculptures: allMuseumSculptures().length, paintings: allMuseumPaintings().length, levels: museumBasementLevels(), next: Math.floor(allMuseumSculptures().length / (MUSEUM_PLINTHS.length || 8)), summary: museumSummaryForAI() };
    })));
    await run(() => { state.isPracticing = true; state.isBusy = true; state.botPos = { x: -38, z: 1.5 }; state.targetPos = { ...state.botPos }; });
    await look(-40, 7.5, 9, -40, 1.6, -4.5);
    await page.waitForTimeout(1200);
    await shot('basement-museum');
    await look(9.5, 4.5, 2.5, 5.6, 0.8, -6.5);
    await page.waitForTimeout(600);
    await shot('basement-storehouse');
  }

  if (scenario === 'water') {
    const run = (fn) => page.evaluate(fn);
    console.log('depths:', JSON.stringify(await run(() => [8.5, 9.5, 10.5, 11.5, 13, 16].map(z => [z, waterDepthAt({ x: 2, z }).toFixed(2)]))));
    await run(() => { state.isCollectingMail = true; state.isPracticing = true; state.botPos = { x: -6, z: 8.4 }; state.targetPos = { x: -6, z: 15 }; state.cameraMode = 'none'; });
    let shotTaken = false;
    for (let i = 0; i < 80; i++) {
      await page.waitForTimeout(250);
      const st = await run(() => ({ z: state.botPos.z, title: state.moodTitle, y: keloGroup.position.y }));
      if (!shotTaken && st.z > 10.6) { shotTaken = true; await look(-1, 3, 15, -6, 0, 10); await shot('water-wading-under'); console.log('in the water at z', st.z.toFixed(2), 'body y', st.y.toFixed(2)); }
      if (/breathe/i.test(st.title)) { console.log('drowning triggered at z', st.z.toFixed(2)); break; }
    }
    await page.waitForTimeout(6000);
    console.log('after:', JSON.stringify(await run(() => ({ z: state.botPos.z.toFixed(2), knows: state.knowsLakeDanger, asked: state.requestsToUser.some(r => /rowboat/i.test(r.requestedGear || '')), diary: state.diaryEntries[0].mood }))));
  }

  if (scenario === 'pile') {
    const run = (fn) => page.evaluate(fn);
    await run(() => { state.isCollectingMail = true; state.isPracticing = true; state.isBusy = true; });
    const sx = -24, sz = -18;
    await page.evaluate(([x, z]) => { state.digSites.unshift({ id: 'dig-test', x, z, depth: 0, dirt: 0, finds: [] }); }, [sx, sz]);
    for (const [k, depth, dirt] of [[1, 0.4, 0.6], [2, 1.0, 1.6], [3, 1.8, 3.2], [4, 3.0, 6]]) {
      const info = await page.evaluate(([d, dirt]) => { const s = state.digSites[0]; s.depth = d; s.dirt = dirt; refreshTerrainAround(s.x, s.z, 1.6 + d * 0.45); updateDirtPile3D(s);
        const p = pileOffset(s); return { shape: pileShape(s), raise: dirtPileRaiseAt(p.x, p.z).toFixed(2) }; }, [depth, dirt]);
      console.log('stage', k, JSON.stringify(info));
      await page.evaluate(([x, z]) => { state.botPos = { x: x - 2, z: z + 2.5 }; state.targetPos = { ...state.botPos }; state.cameraMode = 'none'; camera.position.set(x + 1, getAnalyticalGroundHeight(x, z) + 6, z + 11); controls.target.set(x + 2.5, getAnalyticalGroundHeight(x + 3, z), z); controls.update(); }, [sx, sz]);
      await page.waitForTimeout(700);
      await shot('pile-' + k);
    }
  }

  if (scenario === 'landfill') {
    const run = (fn) => page.evaluate(fn);
    await run(() => { state.isCollectingMail = true; state.isPracticing = true; });
    // Shallow vs deep patches need different amounts
    console.log('needed:', JSON.stringify(await run(() => {
      const a = { id: 'a', x: -20, z: 10.6, r: 2.0, volume: 0 }, b = { id: 'b', x: -20, z: 15, r: 2.0, volume: 0 };
      return { shallowDepth: (WATER_LEVEL - bedWithoutFills(a.x, a.z)).toFixed(2), shallow: volumeToLevel(a, LAND_TOP).toFixed(1), deepDepth: (WATER_LEVEL - bedWithoutFills(b.x, b.z)).toFixed(2), deep: volumeToLevel(b, LAND_TOP).toFixed(1) };
    })));
    await run(() => { state.toolInventory.push('Dump truck'); registerVehicle('Dump truck'); state.knowHow.truck = { at: 1 }; findVehicle('truck').fuel = 100; startLandFill(-20, 'Test'); window.driveVehicle = async (v, t) => { v.x = t.x; v.z = t.z; renderVehicles3D(); }; });
    const f0 = await run(() => ({ needed: activeLandFill().needed }));
    console.log('fill:', JSON.stringify(f0));
    for (let i = 1; i <= 30; i++) {
      const t0 = Date.now(); const r = await run(async () => { const t = findVehicle('truck'); t.load = 4; await dumpIntoLake(t, 4); const f = state.landFills[0]; return { vol: f.volume, done: f.done, top: fillLevel(f).toFixed(2), centerGround: getAnalyticalGroundHeight(f.x, f.z).toFixed(2), speech: state.speechBubble.slice(0, 90) }; });
      console.log('load', i, (Date.now() - t0) + 'ms', JSON.stringify(r));
      if (i === 2) { await look(-14, 6, 18, -20, 0, 10.5); await page.waitForTimeout(500); await shot('landfill-underwater'); }
      if (r.done) break;
    }
    console.log('walkable:', await run(() => waterDepthAt({ x: -20, z: 10.6 }).toFixed(2)));
    await look(-14, 6, 18, -20, 0, 10.5);
    await page.waitForTimeout(800);
    await shot('landfill-done');
    await page.reload({ timeout: 420000 }); await page.waitForTimeout(3500);
    console.log('after reload ground:', await run(() => getAnalyticalGroundHeight(-20, 10.6).toFixed(2)));
  }

  if (scenario === 'keys') {
    const run = (fn) => page.evaluate(fn);
    await run(() => { state.isCollectingMail = true; });
    // Memories from the AI are used offline
    console.log('offline reuse:', JSON.stringify(await run(() => {
      rememberAIDecision({ actionTitle: 'Build a heron sculpture by the lake', emoji: '🐦', speech: 'A heron, standing in the shallows.', diary: 'Dear Diary, I welded a heron.', destination: { x: -20, z: 8, placeName: 'the beach' } });
      let hits = 0; for (let i = 0; i < 200; i++) if (generateProceduralDecision({}).actionTitle === 'Build a heron sculpture by the lake') hits++;
      return { learned: state.aiLearned.length, reusedOutOf200: hits };
    })));
    // A key added elsewhere is noticed and he switches straight away
    await run(() => { localStorage.setItem('kelo1_gemini_api_key', 'test-key-123'); window.dispatchEvent(new StorageEvent('storage', { key: 'kelo1_gemini_api_key' })); });
    await page.waitForTimeout(800);
    console.log('after key added:', await run(() => ({ has: hasLLMKey(), brain: document.getElementById('aiBrainBtnText').textContent })));
    // Remove it from settings
    await page.evaluate(s => document.querySelector(s).click(), '#btnOpenSettings');
    await page.waitForTimeout(300);
    await shot('keys-settings');
    await page.evaluate(s => document.querySelector(s).click(), '[data-remove-key="gemini"]');
    await page.waitForTimeout(300);
    console.log('after remove:', await run(() => ({ has: hasLLMKey(), stored: localStorage.getItem('kelo1_gemini_api_key'), brain: document.getElementById('aiBrainBtnText').textContent, status: document.getElementById('aiKeyStatus').textContent })));
  }

  if (scenario === 'viewer') {
    const run = (fn) => page.evaluate(fn);
    await run(() => {
      state.isCollectingMail = true; state.isPracticing = true; state.isBusy = true;
      ['A sturdy shovel', 'Claw hammer', 'Wrench', 'Toolbox', 'Telescope', 'Guitar', 'Kite', 'Rubber duck', 'A basket of apples', 'Pizza', 'Hand saw', 'Cordless drill', 'Skis', 'Harmonica', 'A novel', 'Yo-yo']
        .forEach(n => state.toolInventory.push(n));
      renderStorehouseShelves3D();
      for (let i = 0; i < 3; i++) state.inventedCreations.unshift({ title: `Spiral ${i + 1}`, archetype: 'kinetic_spire', colorHex: '#38bdf8', secondaryColorHex: '#f472b6', x: -40, z: -5, inMuseum: true, createdTime: 'On display' });
      state.murals.unshift({ wallId: 'c1', text: 'WONDER', palette: ['#ef4444', '#facc15', '#22c55e', '#3b82f6'], skill: 60, seed: 'v1', at: 1 });
      renderMuseum3D();
    });
    // Click the Storehouse where it appears on screen
    await look(5.5, 9, 8, 5.5, 1, -6.5);
    await page.waitForTimeout(800);
    const pt = await run(() => { const v = new THREE.Vector3(STOREHOUSE.x, getAnalyticalGroundHeight(STOREHOUSE.x, STOREHOUSE.z) + 1.2, STOREHOUSE.z + 1.5).project(camera); const r = renderer.domElement.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; });
    await page.mouse.click(pt.x, pt.y);
    await page.waitForTimeout(1500);
    console.log('opened by click:', await run(() => Boolean(document.getElementById('keloViewer')) && viewerState.which));
    await shot('viewer-storehouse-1');
    await page.evaluate(s => document.querySelector(s).click(), '[data-viewer="next"]');
    await page.waitForTimeout(800);
    await shot('viewer-storehouse-2');
    await page.evaluate(s => document.querySelector(s).click(), '[data-viewer="exit"]');
    console.log('closed:', await run(() => !document.getElementById('keloViewer')));
    await run(() => openBuildingViewer('museum'));
    await page.waitForTimeout(1200);
    await shot('viewer-museum');
    await page.evaluate(s => document.querySelector(s).click(), '[data-viewer="exit"]');
    // Photo wall
    await run(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 300; const x = c.getContext('2d'); x.fillStyle = '#38bdf8'; x.fillRect(0, 0, 400, 300); x.fillStyle = '#fde047'; x.beginPath(); x.arc(300, 80, 40, 0, 7); x.fill(); x.fillStyle = '#166534'; x.fillRect(0, 210, 400, 90);
      state.photoAlbum.unshift({ thumb: c.toDataURL(), caption: 'Sunny day at the lake', from: 'Tester', time: 'today', reaction: 'The sun looks like a lemon!' }); renderPortal(); state.isCollectingMail = true; });
    await run(() => window.openKeloMenu('requests'));
    await page.waitForTimeout(500);
    await page.evaluate(s => document.querySelector(s).click(), '#photoWallGrid [data-photo-idx="0"]');
    await page.waitForTimeout(600);
    await shot('viewer-photo');
    console.log('photo open:', await run(() => viewerState && viewerState.kind));
    await page.keyboard.press('Escape');
    console.log('esc closed:', await run(() => !document.getElementById('keloViewer')));
  }

  if (scenario === 'chat') {
    const run = (fn) => page.evaluate(fn);
    await run(() => { state.isCollectingMail = true; });
    for (const msg of ['hi', 'How are you?', 'What are you doing?', 'Where are you?', 'What do you have?', 'I saw a quokka at the zoo yesterday', 'Did you know the lake is deep?']) {
      const t0 = Date.now();
      await page.evaluate((m) => handleVisitorChatMessage(m), msg);
      console.log(`> ${msg}\n< ${await run(() => state.chatLog[state.chatLog.length - 1].text)}  (${Date.now() - t0}ms)`);
    }
    console.log('vocab:', JSON.stringify(await run(() => state.vocabulary)));
    console.log('unknown in "the lake is beautiful":', await run(() => JSON.stringify(unknownWords('the lake is beautiful'))));
  }

  if (scenario === 'takeout') {
    const run = (fn) => page.evaluate(fn);
    await run(() => {
      state.isCollectingMail = true;
      window.waitForArrival = async () => {}; window.travelTo = async (t) => { state.botPos = { ...t }; };
      for (let i = 0; i < 10; i++) state.inventedCreations.unshift({ title: `Spiral ${i + 1}`, archetype: 'kinetic_spire', colorHex: '#38bdf8', secondaryColorHex: '#f472b6', x: -40, z: -5, inMuseum: true, createdTime: 'On display' });
      state.murals.unshift({ wallId: 'c1', text: 'WONDER', palette: ['#ef4444', '#facc15', '#22c55e', '#3b82f6'], skill: 60, seed: 'v1', at: 1 });
      state.toolInventory.push('Telescope'); state.knowHow.telescope = { at: 1 };
      renderMuseum3D();
    });
    console.log('floor of Spiral 10:', await run(() => (f => Math.floor(allMuseumSculptures().indexOf(f.piece) / (MUSEUM_PLINTHS.length || 8)))(findMuseumPiece('Spiral 10'))));
    console.log('display:', await run(() => takeOutOfMuseum('Spiral 10', 'display', 'Test')), JSON.stringify(await run(() => { const c = state.inventedCreations.find(c => c.title === 'Spiral 10'); return { inMuseum: c.inMuseum, x: c.x, inTown: inTown(c.x, c.z), museum: museumSummaryForAI() }; })));
    console.log('dispose painting:', await run(() => disposeItem('WONDER', 'Test')), await run(() => ({ murals: state.murals.length, disposed: state.disposedItems[0].name })));
    console.log('use telescope:', await run(() => takeOutToUse('Telescope')), await run(() => state.moodTitle));
    await run(() => openBuildingViewer('museum'));
    await page.waitForTimeout(1000);
    await shot('takeout-viewer');
    await page.evaluate(s => document.querySelector(s).click(), '[data-take="dispose"]');
    console.log('button:', await run(() => document.querySelector('[data-take="dispose"]').textContent));
  }

  if (scenario === 'unbox') {
    const run = (fn) => page.evaluate(fn);
    // A stale AI design must not win over the real dump truck model
    console.log('rule first:', await run(() => { state.itemDesigns['dump truck'] = { parts: [{ shape: 'box', x: 0, y: 0.5, z: 0, sx: 1, sy: 1, sz: 1, color: '#a855f7' }], at: 1 }; return Boolean(buildItemModel3D('Dump truck', { label: false }).userData.fullSize); }));
    console.log('unknown thing:', await run(() => { const m = buildItemModel3D('A heron statue', { label: false }); let boxes = 0; m.traverse(o => { if (o.isMesh) boxes++; }); return boxes; }));
    await run(() => { state.isCollectingMail = true; state.isPracticing = true; state.botPos = { x: 14, z: 4 }; state.targetPos = { ...state.botPos }; state.botRotY = 0; });
    const p = run(() => unboxInHands(lifeSize(buildItemModel3D('Guitar', { label: false }), 1.4)));
    await look(14.4, 2.3, 7.4, 14, 1.3, 4);
    await page.waitForTimeout(500); await shot('unbox-1-wrapped');
    await page.waitForTimeout(700); await shot('unbox-2-opening');
    await p; await page.waitForTimeout(300); await shot('unbox-3-item');
  }

  if (scenario === 'nobox') {
    const run = (fn) => page.evaluate(fn);
    console.log('before lookup has model:', await run(() => hasRealItemModel('a kalimba')));
    await run(() => postMail({ kind: 'gift', from: 'Tester', name: 'A kalimba', category: 'toy' }));
    await page.waitForTimeout(2500);
    console.log('lookup:', JSON.stringify(await run(() => state.itemLookups['a kalimba'])));
    console.log('no-info thing (mystery widget):', await run(async () => { await lookUpItemModel('A zorbulator'); const m = buildItemModel3D('A zorbulator', { label: false }); let purple = 0; m.traverse(o => { if (o.isMesh && o.material.color && o.material.color.getHex() === 0xa855f7) purple++; }); return { lookup: state.itemLookups['a zorbulator'], giftBoxParts: purple }; }));
  }

  if (scenario === 'tidy') {
    const run = (fn) => page.evaluate(fn);
    await run(() => {
      state.isCollectingMail = true;
      window.waitForArrival = async () => {}; window.travelTo = async (t) => { state.botPos = { ...t }; };
      state.belongings.unshift({ name: 'a rusty bolt', category: 'junk' }, { name: 'Snapped sturdy shovel', category: 'broken' }, { name: 'Old map', category: 'thing' });
      state.toys.push({ name: 'Yo-yo' }, { name: 'Yo-yo' });
      state.toolInventory.push('Spray paint');
      state.hobbies.push({ name: 'Murals', emoji: '🎨', style: 'mural', skill: 10, practiced: 0, tool: 'Spray paint', startedAt: 1 });
      state.itemUse['old map'] = worldDayNow() - 40;
      state.lastTidyAt = Date.now() - 31 * 60 * 1000;
    });
    console.log('due:', await run(() => tidyUpDue()), JSON.stringify(await run(() => tidyCandidates().map(c => c.name + ' (' + c.reason + ')'))));
    await run(() => { state.isCollectingMail = false; });
    await run(() => startTidyUp());
    await run(() => { state.isCollectingMail = true; });
    console.log('after:', JSON.stringify(await run(() => ({ diary: state.diaryEntries.find(d => /Tidy-up/.test(d.mood)).text, disposed: state.disposedItems.map(d => d.name), sprayKept: state.toolInventory.includes('Spray paint'), yoyos: state.toys.filter(t => t.name === 'Yo-yo').length, dueNow: tidyUpDue() }))));
  }

  if (scenario === 'pit') {
    await look(+process.env.PX||14, +process.env.PY||14, +process.env.PZ||-1, 20, 0, -9);
    await page.waitForTimeout(800);
    await shot('pit-overview');
  }

  if (scenario === 'toss') {
    await page.evaluate(() => {
      state.belongings.unshift({ name: 'a rusty bolt', category: 'junk', emoji: '🪨', from: 'a dig' });
      state.toolInventory.push('Garden trowel', 'Garden trowel');
      state.botPos = { x: 14, z: -6 }; state.targetPos = { x: 14, z: -6 };
      renderStorehouseShelves3D();
    });
    const before = await page.evaluate(() => ({ unwanted: unwantedItem(), chance: disposalChance() }));
    console.log('before', JSON.stringify(before));
    await look(10, 6, -2, 19, 0, -9);
    const p = page.evaluate(() => disposeUnwanted());
    for (let i = 0; i < 160; i++) {
      await page.waitForTimeout(500);
      const t = await page.evaluate(() => state.moodTitle);
      if (/Throwing/.test(t)) { await page.waitForTimeout(500); await shot('toss-midair'); break; }
    }
    console.log('result', await p);
    const after = await page.evaluate(() => ({
      junkLeft: state.belongings.filter(b => b.name === 'a rusty bolt').length,
      disposed: state.disposedItems.map(d => d.name),
      diary: state.diaryEntries[0].text, unwanted: unwantedItem()
    }));
    console.log('after', JSON.stringify(after));
    const p2 = page.evaluate(() => disposeUnwanted());
    console.log('dupe result', await p2, JSON.stringify(await page.evaluate(() => ({ trowels: state.toolInventory.filter(n => n === 'Garden trowel').length, unwanted: unwantedItem() }))));
    await shot('toss-after');
  }

  if (scenario === 'haul' || scenario === 'vehicle') {
    await page.evaluate(() => {
      state.toolInventory.push('Dump truck', 'Excavator', 'A sturdy shovel');
      registerVehicle('Dump truck'); registerVehicle('Excavator');
      state.knowHow = { dig: { at: 1 }, truck: { at: 1 }, excavator: { at: 1 } };
      state.vehicles.forEach(v => { v.fuel = 100; });
      state.knowsDigging = true;
    });
  }

  if (scenario === 'haul') {
    await page.evaluate(() => {
      state.digSites.unshift({ id: 'dig-test', x: 12, z: -14, depth: 1.0, dirt: 5.5, finds: [], startedAt: Date.now() });
      refreshTerrainAround(12, -14, 3); updateDirtPile3D(state.digSites[0]);
      state.botPos = { x: 12, z: -10 }; state.targetPos = { x: 12, z: -10 };
      state.isPracticing = true;
    });
    await look(8, 9, -1, 17, 0, -9);
    const p = page.evaluate(() => haulDirt(state.digSites[0]));
    for (let i = 0; i < 120; i++) {
      await page.waitForTimeout(500);
      const t = await page.evaluate(() => state.moodTitle);
      if (/Disposal Pit/.test(t)) { await page.waitForTimeout(6000); await shot('haul-tipping'); break; }
    }
    console.log('hauled', await p);
    console.log(JSON.stringify(await page.evaluate(() => ({ dirtDisposed: state.dirtDisposed, load: findVehicle('truck').load, speech: state.speechBubble }))));
    await shot('haul-after');
  }

  if (scenario === 'vehicle') {
    await page.evaluate(() => { state.botPos = { x: 8, z: -3 }; state.targetPos = { x: 8, z: -3 }; });
    await look(8, 9, -1, 17, 0, -9);
    const r = await page.evaluate(() => disposeItem('Excavator', 'I want to see what happens.'));
    console.log('vehicle disposed', r, JSON.stringify(await page.evaluate(() => ({ vehicles: state.vehicles.map(v => v.name), tools: state.toolInventory, meshes: Object.keys(vehicleMeshes).length }))));
    await shot('vehicle-after');
  }

  if (scenario === 'llm') {
    await page.evaluate(() => {
      state.toys.push({ name: 'Yo-yo' });
      applyDecision({ actionTitle: 'Letting go', emoji: '🗑️', discard: { item: 'the yo-yo', why: 'It keeps tangling.' } }, 'Test');
      applyDecision({ actionTitle: 'Nonsense', emoji: '🗑️', discard: { item: 'Post Office' } }, 'Test');
      state.isCollectingMail = false; state.isBusy = false;
    });
    const iv = setInterval(async () => { try { console.log('t', JSON.stringify(await page.evaluate(() => [state.moodTitle, state.isBusy, state.isPracticing, state.isBuilding, state.isCollectingMail]))); } catch (e) {} }, 15000);
    await page.waitForFunction(() => !state.toys.some(t => t.name === 'Yo-yo'), null, { timeout: 280000 });
    console.log('yo-yo gone', JSON.stringify(await page.evaluate(() => state.disposedItems)));
  }

  // Reload: the pit must persist and nothing should come back
  if (scenario === 'reload') {
    await page.evaluate(() => { state.disposedItems.unshift({ name: 'test thing', at: 1 }); savePersistentBrainState(); });
    await page.reload({ timeout: 420000 });
    await page.waitForTimeout(3500);
    console.log('after reload', JSON.stringify(await page.evaluate(() => ({ d: state.disposedItems.length, pin: !!TOWN_LOCATIONS.disposal_pit, ground: getAnalyticalGroundHeight(20, -9).toFixed(2), rim: getAnalyticalGroundHeight(23, -9).toFixed(2) }))));
  }

  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
  if (server) server.close();
})();
