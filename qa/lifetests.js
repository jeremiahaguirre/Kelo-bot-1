// Regression tests for the life/world audit fixes (agent/audit-life). One page, many small checks.
// Usage: KELO_ROOT=... PORT=8904 node lifetests.js [name ...]
const { chromium } = require('playwright');
const path = require('path'), http = require('http'), fs = require('fs');
const V = path.join(__dirname, 'vendor');
const ROOT = process.env.KELO_ROOT || path.resolve(__dirname, '../../kelo-bot-1');
const PORT = +process.env.PORT || 8904;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const only = process.argv.slice(2);

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

const TESTS = {
  // Workshop maker data used to be dropped on reload (not in the default state)
  async makerReload(page) {
    await page.evaluate(() => {
      makerState();
      state.makerOrders.push({ id: 'order-test', name: 'Phone stand', status: 'waiting' });
      state.makerKinds.teststand = { kind: 'hold', label: 'a stand', uses: ['hold'], nouns: ['stand'] };
      savePersistentBrainStateNow();
    });
    await page.reload({ timeout: 420000 });
    await page.waitForTimeout(3000);
    return page.evaluate(() => (state.makerOrders || []).some(o => o.id === 'order-test') && Boolean(state.makerKinds && state.makerKinds.teststand));
  },
  // A blocked step's retry time is kept even when the kind's check passes
  async agendaUntil(page) {
    return page.evaluate(() => {
      agendaRegisterKind('qa-test', { check: () => true, resume: () => true });
      const t = agendaAdd({ kind: 'qa-test', title: 'QA wait test', quiet: true });
      agendaWait(t.id, { type: 'time', label: 'a better moment', until: Date.now() + 180000 }, '');
      const early = agendaWaitSatisfied(t);
      t.waitingFor.until = Date.now() - 1;
      const later = agendaWaitSatisfied(t);
      agendaAbandon && agendaAbandon(t.id, 'test');
      return early === false && later === true;
    });
  },
  // Core memories keep forming once the archive is at its cap
  async coreMemoryCap(page) {
    return page.evaluate(async () => {
      while (memoryArchive.diary.length < MAX_ARCHIVED_DIARY) memoryArchive.diary.push({ text: 'old', at: 1 });
      state.life.lastDistilledAt = totalDiaryCount(); // the old counter is saturated
      state.life.lastDistilledTime = Date.now() - 1000;
      const before = state.coreMemories.length;
      for (let i = 0; i < 9; i++) state.diaryEntries.unshift({ time: 't', location: 'here', mood: 'm', text: 'Dear Diary, test entry ' + i, at: Date.now() });
      await maybeDistillCoreMemory();
      return state.coreMemories.length === before + 1;
    });
  },
  // A visitor's ask while he sleeps waits for him to be free
  async synthWhileAsleep(page) {
    return page.evaluate(async () => {
      state.isCollectingMail = false; state.isSleeping = true;
      const tp = { ...state.targetPos };
      await synthesizeUnboundedExperience('weld a tower', 'Asked by QA');
      const ok = state.targetPos.x === tp.x && state.targetPos.z === tp.z && freeQueue.some(j => j.key.startsWith('synth:Asked by QA'));
      state.isSleeping = false; state.isCollectingMail = true;
      freeQueue.length = 0;
      return ok;
    });
  },
  // Two different discards queued while busy are both kept
  async queueKeys(page) {
    return page.evaluate(() => {
      freeQueue.length = 0;
      state.toys.push({ name: 'QA ball' }, { name: 'QA kite' });
      applyDecision({ actionTitle: 'One', discard: { item: 'QA ball', why: 'x' } }, 'Test');
      applyDecision({ actionTitle: 'Two', discard: { item: 'QA kite', why: 'y' } }, 'Test');
      const keys = freeQueue.map(j => j.key);
      freeQueue.length = 0;
      state.toys = state.toys.filter(t => !/^QA /.test(t.name));
      return keys.includes('dispose:QA ball') && keys.includes('dispose:QA kite');
    });
  },
  // A clock set back gives no negative catch-up
  async growthBackwards(page) {
    return page.evaluate(() => localCatchUp(-30) === 0 && localCatchUp(13) === 2);
  },
  // A cooldown from before the clock was set back doesn't block for hours
  async cooldownClockBack(page) {
    return page.evaluate(() => {
      state.activityCooldowns = { qa: Date.now() + 5 * 3600000, qa2: Date.now() + 60000 };
      return canTry('qa') === true && canTry('qa2') === false;
    });
  },
  // Servicing a plant part holds him busy for the walk
  async plantServiceBusy(page) {
    return page.evaluate(async () => {
      ensureAggregatePlantState();
      state.toolInventory.push('A burner service kit (nozzle, igniter and fuel filter)');
      state.asphaltPlant.wear.burner = 100;
      state.isCollectingMail = false;
      const p = servicePlant('asphalt', 'burner');
      const busyDuring = state.isPracticing === true && !keloIsFree();
      const r = await p;
      const after = state.isPracticing;
      state.isCollectingMail = true;
      return busyDuring && r === true && after === false && state.asphaltPlant.wear.burner === 0;
    });
  },
  // A road aimed into town stops at its edge
  async roadNotIntoTown(page) {
    return page.evaluate(async () => {
      state.isCollectingMail = false;
      window.groundworkReady = () => true; window.readyToOperate = () => true;
      state.toolInventory.push('A sturdy shovel', 'A load of gravel');
      // a clear start west of town, aimed east into it
      let sx = null, sz = null;
      for (let z = -10; z <= 7 && sx === null; z += 0.5) for (let x = -30; x >= -40; x -= 0.5) {
        if (!offLimits(x, z, 0.5) && !offLimits(x + 2, z, 0.5) && !offLimits(x + 4, z, 0.5)) { sx = x; sz = z; break; }
      }
      state.botPos = { x: sx, z: sz }; state.targetPos = { ...state.botPos };
      const r = await buildRoad(sx, sz, sx + 16, sz, 'QA road', 'QA');
      const road = state.worldEdits.filter(e => e.type === 'road').pop();
      state.isCollectingMail = true;
      const ok = r !== false && road && road.toX <= TOWN.minX && !inTown(road.toX, road.toZ);
      return ok || { ok, info: JSON.stringify({ r, road, speech: state.speechBubble }) };
    });
  },
  // Gardening plants real seeds outside town and uses them
  async gardeningHobby(page) {
    return page.evaluate(async () => {
      state.isCollectingMail = false;
      window.groundworkReady = () => true; window.readyToOperate = () => true;
      state.toolInventory.push('A packet of wildflower seeds');
      const hobby = { name: 'Gardening', style: 'plant', emoji: '🌱', skill: 10, practiced: 0, tool: 'A packet of wildflower seeds' };
      state.hobbies.push(hobby);
      const plantingsBefore = state.plantings.length;
      const r = await practiceHobby(hobby, 'QA');
      const plant = state.worldEdits.filter(e => e.type === 'plant' || e.type === 'tree' || /plant|seed/.test(e.type)).pop();
      state.isCollectingMail = true;
      const ok = r === true && plant && !inTown(plant.x, plant.z) && state.plantings.length === plantingsBefore && hobby.practiced === 1;
      return ok || { ok, info: JSON.stringify({ r, plant, speech: state.speechBubble, types: state.worldEdits.map(e => e.type), practiced: hobby.practiced }) };
    });
  },
  // Using fertilizer with nothing hungry doesn't waste it
  async fertilizerNotWasted(page) {
    return page.evaluate(async () => {
      state.isCollectingMail = false;
      state.toolInventory.push('A bag of all-purpose fertilizer');
      const before = supplyOf ? JSON.stringify(supplyOf('A bag of all-purpose fertilizer')) : '';
      await useItemFor('A bag of all-purpose fertilizer', 'feed the plants', '', 'QA');
      const after = supplyOf ? JSON.stringify(supplyOf('A bag of all-purpose fertilizer')) : '';
      state.isCollectingMail = true;
      return before === after && state.toolInventory.includes('A bag of all-purpose fertilizer');
    });
  },
};

(async () => {
  const server = await startServer().catch(() => null);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) console.log('console.error:', m.text().slice(0, 200)); });
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.includes('three.min.js')) return route.fulfill({ path: path.join(V, 'three.min.js'), contentType: 'application/javascript' });
    if (u.includes('OrbitControls.js')) return route.fulfill({ path: path.join(V, 'OrbitControls.js'), contentType: 'application/javascript' });
    if (u.includes('cdn.tailwindcss.com')) return route.fulfill({ path: path.join(V, 'tailwind.js'), contentType: 'application/javascript' });
    if (u.includes('phosphor-icons')) return route.fulfill({ body: '', contentType: 'application/javascript' });
    if (u.includes('wikipedia.org')) return route.fulfill({ body: '{"query":{"search":[]}}', contentType: 'application/json' });
    if (u.startsWith(`http://localhost:${PORT}`)) return route.continue();
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`http://localhost:${PORT}/index.html`, { timeout: 420000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => { state.isCollectingMail = true; renderer.render = () => {}; });
  let fails = 0;
  for (const [name, fn] of Object.entries(TESTS)) {
    if (only.length && !only.includes(name)) continue;
    let ok = false;
    try { ok = await fn(page); if (ok && typeof ok === 'object') { console.log(name, 'info', ok.info); ok = ok.ok; } } catch (e) { console.log(name, 'threw', e.message.slice(0, 300)); }
    console.log(ok ? 'PASS' : 'FAIL', name);
    if (!ok) fails++;
    await page.evaluate(() => { state.isCollectingMail = true; renderer.render = () => {}; }).catch(() => {});
  }
  console.log('failures:', fails);
  console.log('page errors:', errors.length ? JSON.stringify(errors.slice(0, 5)) : 'none');
  await browser.close();
  if (server) server.close();
  process.exit(fails || errors.length ? 1 : 0);
})();
