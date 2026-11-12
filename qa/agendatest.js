// Usage: node agendatest.js agenda|roadwork|runway   (agenda, road job and runway job tests; same setup as harness.js)   (server must be running on :8765 from the repo root)
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
  const page = await browser.newPage({ viewport: { width: +process.env.VW || 1280, height: +process.env.VH || 800 }, deviceScaleFactor: +process.env.DSF || (process.env.VW && +process.env.VW < 600 ? 2 : 1), isMobile: Boolean(process.env.VW && +process.env.VW < 600), hasTouch: Boolean(process.env.VW && +process.env.VW < 600) });
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
  const waitFor = async (fn, ms = 240000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await page.waitForTimeout(1000); } return false; };
  // His own life loop is stopped; the test runs his free ticks itself, so it can watch every choice
  const stopLife = () => run(() => {
    clearTimeout(organicTimeoutId); scheduleNextOrganicImpulse = () => {};
    state.isCollectingMail = false; state.isBusy = false; state.isPracticing = false;
    Object.assign(state, { fullness: 100, hydration: 100, health: 100 });
    state.knownNeeds = { food: true, water: true, sleep: true };
  });
  const tick = () => run(() => { if (keloIsFree() && !agendaWorking) { runAutonomousLifeTick(); return true; } return false; });
  const task = ref => run(r => { const t = agendaGet(r) || state.agenda.tasks.find(x => x.ref === r); return t && { id: t.id, status: t.status, step: t.step, stepLabel: agendaStepLabel(t), waiting: t.waitingFor && t.waitingFor.label, pausedBy: t.pausedBy, focus: state.agenda.focusId === t.id }; }, ref);
  const openTab = async tab => { await run(() => { const m = document.getElementById('btnToggleMenu'); if (m) m.click(); }); await page.waitForTimeout(500); await run(t => document.querySelector(`[data-tab="${t}"]`).click(), tab); await page.waitForTimeout(800); };
  const closeMenu = () => run(() => { const b = document.getElementById('btnCloseMenu'); if (b) b.click(); });
  let fails = 0;
  const expect = (ok, what) => { console.log(ok ? 'PASS' : 'FAIL', what); if (!ok) fails++; };


  if (scenario === 'probe') {
    page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') console.log('console:', m.text().slice(0, 300)); });
    await stopLife();
    console.log(await run(() => { try { state.jobKnowledge.roadworks = { at: 1 }; const t = startRoadworks({ x: -31, z: -8.5 }, { x: -53, z: -8.5 }, 'p', { force: true }); const r = rwSendList(t); return JSON.stringify({ step: t.step, lines: r && r.lines.length }); } catch (e) { return 'ERR ' + e.stack; } }));
  }
  if (scenario === 'agenda') {
    await stopLife();
    console.log('start project:', await run(() => startProject('birdhouse', 'Test')));
    const ref = await run(() => 'project:' + state.projects[0].id);
    let t = await task(ref);
    console.log('task', JSON.stringify(t));
    expect(t && t.status === 'waiting' && t.step === 1, 'a new project is on the agenda, waiting at "gather"');
    // Some of it arrives, not all
    await run(() => { state.belongings.unshift({ name: 'Cedar boards', category: 'material' }); state.toolInventory.push('A claw hammer', 'A hand saw'); agendaTick(); });
    t = await task(ref);
    expect(t.status === 'waiting' && /nail/i.test(t.waiting), 'still waiting, now only for the nails: ' + t.waiting);
    await run(() => savePersistentBrainState());
    await page.reload({ timeout: 420000 }); await page.waitForTimeout(4000); await stopLife();
    t = await task(ref);
    expect(t && t.status === 'waiting' && t.step === 1, 'after a reload the task and its step are still there');
    // He is working on it when hunger, sleep and a visitor interrupt
    await run(r => agendaStep(agendaGet(r).id, 1), ref);
    await run(() => { state.fullness = 20; state.toolInventory.push('An apple'); window.__eat = eatSomething('Hungry'); });
    await page.waitForTimeout(800);
    t = await task(ref); expect((t.status === 'paused' && t.pausedBy === 'a bite to eat') || await run(r => (agendaGet(r).history || []).some(h => h.what === 'pause' && /bite to eat/.test(h.text)), ref), 'eating pauses it');
    await run(() => window.__eat); await waitFor(() => !state.isBusy, 60000);
    t = await task(ref); expect(t.status === 'active' && t.focus && t.step === 1, 'after eating he is back on it at the same step');
    await run(() => { state.health = 40; window.__sleep = goToSleep('Sleepy'); });
    await page.waitForTimeout(1500);
    t = await task(ref); expect((t.status === 'paused' && t.pausedBy === 'sleep') || await run(r => (agendaGet(r).history || []).some(h => h.what === 'pause' && /for sleep/.test(h.text)), ref), 'sleep pauses it');
    await page.waitForTimeout(4000);
    await run(() => { state.isSleeping = false; }); await run(() => window.__sleep); await page.waitForTimeout(500);
    t = await task(ref); expect(t.status === 'active' && t.step === 1, 'after waking up he is back on it');
    await run(() => { window.__chat = handleVisitorChatMessage('Hi Kelo, what are you up to?'); });
    await page.waitForTimeout(300);
    t = await task(ref); expect((t.status === 'paused' && t.pausedBy === 'a visitor') || await run(r => (agendaGet(r).history || []).some(h => h.what === 'pause' && /a visitor/.test(h.text)), ref), 'a visitor pauses it');
    await run(() => window.__chat); await page.waitForTimeout(500);
    t = await task(ref); expect(t.status === 'active', 'after the visitor he is back on it');
    // Reload mid-step: paused by the reload, and his next free moment goes straight back to it
    await run(() => savePersistentBrainState());
    await page.reload({ timeout: 420000 }); await page.waitForTimeout(4000); await stopLife();
    t = await task(ref); expect(t.status === 'paused' && t.pausedBy === 'reload' && t.step === 1, 'a reload mid-step pauses it at the same step');
    await tick(); await page.waitForTimeout(1500);
    t = await task(ref); expect(t.status === 'waiting' && /nail/i.test(t.waiting || ''), 'his first free tick resumes it, and it waits for the nails again');
    // The nails come; he goes for the mail because of it, and builds
    await run(() => postMail({ kind: 'request', from: 'test', name: 'A box of nails', category: 'material' }));
    expect(await run(() => agendaMailWaiting()), 'what he waits for is at the Post Office, so the mail is urgent');
    const iv = setInterval(async () => { try { console.log('  ...', await run(() => state.moodTitle)); } catch (e) {} }, 30000);
    const built = await waitFor(async () => { if (keloIsFree() && !agendaWorking) runAutonomousLifeTick(); return state.projects[0].status === 'built'; }, 600000);
    clearInterval(iv);
    t = await task(ref);
    expect(built && t.status === 'done', 'he picked it back up and built it: ' + JSON.stringify(t));
    const hist = await run(r => (state.agenda.tasks.find(x => x.ref === r).history || []).map(h => h.what).reverse().join(' > '), ref);
    console.log('history:', hist);
    expect(['start', 'wait', 'pause', 'resume', 'ready', 'done'].every(w => hist.includes(w)), 'diary/memory lines for start, wait, pause, resume, ready and done');
    console.log('diary:', JSON.stringify(await run(() => state.diaryEntries.filter(d => d.agenda).slice(0, 6).map(d => d.mood))));
    await openTab('brain'); await page.waitForTimeout(800);
    console.log('open tasks section:', await run(() => (document.getElementById('agendaListContainer') || {}).textContent.slice(0, 200)));
  }

  if (scenario === 'roadwork' || scenario === 'runway' || scenario === 'roadfinish') {
    await stopLife();
    await run(() => {
      plantTimeScale = 0.15; plantWorkableScale = 60; rwTimeScale = 0.002;
      // The plants are learned and stocked (their own tests cover that); he already has a truck, an excavator and a mixer truck
      state.jobKnowledge.asphaltPlant = { at: 1 }; state.jobKnowledge.batchPlant = { at: 1 };
      state.toolInventory.push('An infrared thermometer', 'A slump cone test kit');
      ensureAggregatePlantState();
      Object.assign(state.asphaltPlant.stock, { coarse: 40, fine: 30, bitumen: 30, fuel: 2000 });
      Object.assign(state.batchPlant.stock, { cement: 40, sand: 30, stone: 40, admix: 400 });
      ['A dump truck', 'An excavator', 'A concrete mixer truck'].forEach(n => { state.belongings.unshift({ name: n, category: 'vehicle' }); registerVehicle(n); });
      ['truck', 'excavator', 'mixer'].forEach(k => { const r = knowHowRule(k === 'mixer' ? 'A concrete mixer truck' : k === 'truck' ? 'A dump truck' : 'An excavator'); if (r) state.knowHow[r.key] = { at: 1 }; });
      setInterval(() => state.vehicles.forEach(v => { v.fuel = 100; }), 2000);
      Object.assign(state, { fullness: 100, hydration: 100, health: 100 });
      setInterval(() => Object.assign(state, { fullness: 100, hydration: 100, health: 100 }), 5000);
    });
  }

  if (scenario === 'roadwork') {
    const id = await run(() => { const t = startRoadworks({ x: -31, z: -8.5 }, { x: -53, z: -8.5 }, 'Test road', { force: true }); return t && t.id; });
    expect(Boolean(id), 'a road job is on the agenda');
    const order = [];
    let shotPave = false, shotList = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 6000000) {
      const t = await task(id);
      if (!t) break;
      const key = await run(i => rwStepKey(agendaGet(i)), id);
      if (order[order.length - 1] !== key) { order.push(key); console.log(`[${Math.round((Date.now() - t0) / 1000)}s] step ${t.step}: ${key} (${t.status}${t.waiting ? ', waiting for ' + t.waiting : ''})`); }
      if (t.status === 'done') break;
      if (key === 'survey' && !shotList) {
        shotList = true;
        const lines = await run(i => { const r = rwListRequest(agendaGet(i)); return r ? r.lines.map(l => `${l.name} x${l.qty}`) : []; }, id);
        console.log('parts list:', JSON.stringify(lines));
        expect(['grader', 'bulldozer', 'soil compactor', 'tandem', 'paver', 'survey kit', 'distributor', 'striper', 'aggregate base', 'prime emulsion', 'traffic paint', 'glass beads', 'culvert', 'grade stakes'].every(w => lines.some(l => l.toLowerCase().includes(w))), 'the parts list has the real machines and materials');
        expect(await run(() => !state.worldEdits.some(e => e.pro)), 'nothing is surveyed before the kit is here (' + t.status + (t.waiting ? ': ' + t.waiting : '') + ')');
        await openTab('requests'); await page.waitForTimeout(800);
        await run(() => { const c = document.querySelector('[data-rw-card]'); if (c) c.scrollIntoView(); });
        await page.waitForTimeout(500); await shot('agenda-partslist');
        await closeMenu();
        await run(i => { const r = rwListRequest(agendaGet(i)); sendRoadworkList(r.id, null, 'test'); }, id);
      }
      if (key === 'pave' && !shotPave && await run(() => /Laying the mat/.test(state.moodTitle))) {
        shotPave = true;
        await run(() => { state.cameraMode = 'none'; camera.position.set(state.botPos.x - 6, 7, state.botPos.z + 12); controls.target.set(state.botPos.x - 4, 0.8, state.botPos.z); controls.update(); });
        await page.waitForTimeout(1200); await shot('agenda-road-paving');
        await openTab('brain'); await run(() => { const s = document.querySelector('[data-section="agenda"]'); if (s) { s.open = true; s.scrollIntoView(); } }); await page.waitForTimeout(800);
        await shot('agenda-open-tasks'); await closeMenu();
      }
      // An interruption in the middle of the job, and a reload between steps
      if (key === 'grade' && !order.includes('__ate')) { order.push('__ate'); await run(() => { state.fullness = 20; state.toolInventory.push('A pear'); }); }
      if (key === 'subgrade' && !order.includes('__reload')) {
        order.push('__reload');
        await waitFor(() => keloIsFree() && !agendaWorking, 300000);
        await run(() => savePersistentBrainState());
        await page.reload({ timeout: 420000 }); await page.waitForTimeout(4000); await stopLife();
        await run(() => { plantTimeScale = 0.15; plantWorkableScale = 60; rwTimeScale = 0.002; setInterval(() => state.vehicles.forEach(v => { v.fuel = 100; }), 2000); setInterval(() => Object.assign(state, { hydration: 100, health: 100 }), 5000); });
        const r = await task(id); console.log('after reload:', JSON.stringify(r));
        expect(r && (await run(i => rwStepKey(agendaGet(i)), id)) === 'subgrade', 'after a reload the road job is at the same step');
      }
      await run(() => { if (keloIsFree() && !agendaWorking) { if (state.fullness < 30) eatSomething('Hungry'); else runAutonomousLifeTick(); } });
      await page.waitForTimeout(1500);
    }
    const steps = order.filter(k => !k.startsWith('__')).filter((k, i, a) => a.indexOf(k) === i);
    console.log('step order:', steps.join(' > '));
    const want = ['research', 'order', 'survey', 'clear', 'grade', 'drain', 'subgrade', 'base', 'compactbase', 'prime', 'pave', 'roll', 'cure', 'stripe'];
    expect(want.every((k, i) => steps.indexOf(k) === i), 'the steps ran in the right order');
    const fin = await run(i => { const t = agendaGet(i); const e = rwEdit(t); return { status: t.status, surface: e && e.surface, marked: e && e.marked, used: t.data.usedFor, stock: state.roadworks.stock, hma: t.data.hmaDone }; }, id);
    console.log('finished:', JSON.stringify(fin));
    expect(fin.status === 'done' && fin.surface === 'asphalt' && fin.marked, 'the road is paved and striped and the task is done');
    expect(fin.used && fin.used.base > 0 && fin.used.prime > 0 && fin.used.stakes > 0 && fin.hma >= 5, 'materials were used up');
    await run(() => { const e = state.worldEdits.find(x => x.pro); state.cameraMode = 'none'; camera.position.set(e.x - 4, 9, e.z + 14); controls.target.set((e.x + e.toX) / 2, 0, e.z); controls.update(); });
    await page.waitForTimeout(1200); await shot('agenda-road-done');
  }

  if (scenario === 'roadfinish') {
    // The last step on its own (the full road takes ~100 min on this machine): a cured road gets its lines and is crossed off
    const id = await run(() => {
      const t = startRoadworks({ x: -31, z: -8.5 }, { x: -53, z: -8.5 }, 'Test road', { force: true });
      state.jobKnowledge.roadworks = { at: 1 };
      t.step = 13; t.data.pavedAt = Date.now() - 1e7; t.data.hmaDone = 10;
      const e = { id: newEditId('road'), type: 'road', pro: true, surface: 'works', stage: 'asphalt', prev: 'primed', prog: 1, x: t.data.x, z: t.data.z, toX: t.data.toX, toZ: t.data.toZ, width: t.data.width, at: Date.now(), task: t.id };
      state.worldEdits.push(e); t.data.editId = e.id; renderEdit(e);
      ['A walk-behind line striper (airless)'].forEach(n => state.toolInventory.push(n));
      rwLearnGear();
      Object.assign(rwState().stock, { paintyellow: 19, beads: 22.7 });
      return t.id;
    });
    const ivf = setInterval(async () => { try { console.log('  ...', JSON.stringify(await run(i => { const t = agendaGet(i); return t && [t.status, rwStepKey(t), t.waitingFor && t.waitingFor.label, state.moodTitle, keloIsFree(), agendaWorking, state.isCollectingMail, state.isBusy, state.isPracticing]; }, id))); } catch (e) {} }, 30000);
    const done = await waitFor(async i => { if (keloIsFree() && !agendaWorking) runAutonomousLifeTick(); const t = agendaGet(i) || state.agenda.tasks.find(x => x.id === i); return t && t.status === 'done'; }, 600000, id);
    clearInterval(ivf);
    const fin2 = await run(i => { const t = state.agenda.tasks.find(x => x.id === i); const e = rwEdit(t); return { status: t.status, surface: e && e.surface, marked: e && e.marked, used: t.data.usedFor, diary: state.diaryEntries[0].text.slice(0, 200) }; }, id);
    console.log('finished:', JSON.stringify(fin2));
    expect(done && fin2.surface === 'asphalt' && fin2.marked && fin2.used && fin2.used.paintyellow > 0, 'the line striper paints the lines, the road is finished and crossed off');
    await run(() => { const e = state.worldEdits.find(x => x.pro); state.cameraMode = 'none'; camera.position.set((e.x + e.toX) / 2, 16, e.z + 9); controls.target.set((e.x + e.toX) / 2, 0, e.z - 1); controls.update(); });
    await page.waitForTimeout(1500); await shot('agenda-road-done');
  }

  if (scenario === 'runway') {
    // Without the field: nothing happens
    console.log('no field:', JSON.stringify(await run(() => ({ ready: runwayFieldReady(), start: startRunwayJob('test'), tasks: state.agenda.tasks.filter(t => t.data && t.data.runway).length }))));
    expect(await run(() => !runwayFieldReady() && !state.agenda.tasks.some(t => t.data && t.data.runway)), 'dormant without RUNWAY_FIELD');
    // A stub field (the real one comes from the agent/runway branch)
    const id = await run(() => {
      window.RUNWAY_FIELD = { minX: -58, maxX: -34, minZ: -13, maxZ: 6, centerX: -46, unitsPerMetre: 1.6, y: 0.05, developed: false };
      const t = startRunwayJob('Test runway'); return t && t.id;
    });
    let t = await task(id);
    console.log('runway task:', JSON.stringify(t));
    expect(t && t.step === 0, 'with a field it starts at research');
    const seen = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 900000) {
      t = await task(id);
      const key = await run(i => rwStepKey(agendaGet(i)), id);
      if (seen[seen.length - 1] !== key) { seen.push(key); console.log(`[${Math.round((Date.now() - t0) / 1000)}s] ${key} (${t.status}${t.waiting ? ', waiting for ' + t.waiting : ''})`); }
      if (key === 'survey' && t.status === 'waiting' && !seen.includes('__sent')) {
        seen.push('__sent');
        expect(await run(() => jobKnown('runway')), 'he researched runways before anything else');
        const lines = await run(i => rwListRequest(agendaGet(i)).lines.map(l => `${l.name} x${l.qty}`), id);
        console.log('runway list:', JSON.stringify(lines));
        expect(['edge light', 'threshold', 'windsock', 'designation sign', 'white traffic paint', 'paver', 'grader', 'runway binder'].every(w => lines.some(l => l.toLowerCase().includes(w))), 'the runway list has lights, signs, windsock, markings paint and the machines');
        expect(await run(() => !state.worldEdits.some(e => e.runway)), 'nothing touched on the field before the gear is here');
        await run(i => { const r = rwListRequest(agendaGet(i)); const ids = r.lines.filter(l => /survey|stakes|marking paint/i.test(l.name)).map(l => l.id); sendRoadworkList(r.id, ids, 'test'); }, id);
      }
      if (key === 'clear') break;
      await run(() => { if (keloIsFree() && !agendaWorking) runAutonomousLifeTick(); });
      await page.waitForTimeout(1500);
    }
    const st = await run(i => { const t = agendaGet(i), e = rwEdit(t); return { sec: t.data.sec, step: rwStepKey(t), stage: e && e.stage, status: t.status, waiting: t.waitingFor && t.waitingFor.label }; }, id);
    console.log('runway now:', JSON.stringify(st));
    expect(seen.includes('survey') && (st.step === 'clear' || st.stage === 'staked'), 'he surveyed the strip once the survey kit came');
    await run(() => { const e = state.worldEdits.find(x => x.runway); state.cameraMode = 'none'; camera.position.set(e.x + 30, 30, e.z + 10); controls.target.set(e.x, 0, (e.z + e.toZ) / 2); controls.update(); });
    await page.waitForTimeout(1000); await shot('agenda-runway-staked');
  }

  console.log(fails ? `FAILED: ${fails}` : 'all checks passed');
  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
  if (server) server.close();
  process.exit(fails ? 1 : 0);
})();
