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
  const look = (px, py, pz, tx, ty, tz) => page.evaluate(([px, py, pz, tx, ty, tz]) => {
    state.cameraMode = 'none';
    camera.position.set(px, py, pz);
    if (typeof controls !== 'undefined' && controls) { controls.target.set(tx, ty, tz); controls.update(); } else camera.lookAt(tx, ty, tz);
  }, [px, py, pz, tx, ty, tz]);
  const scenario = process.argv[2] || 'pit';
  // Keep his own life ticks out of the way during scripted tests
  await page.evaluate(() => { state.isCollectingMail = true; });
  const SC = new Set(scenario.split(','));
  const W = async (fn, arg) => page.evaluate(fn, arg);
  const wait = ms => page.waitForTimeout(ms);
  // Freeze his own life: tests drive everything
  await W(() => { state.isCollectingMail = true; });
  const freeze = () => W(() => { state.isPracticing = false; state.isBusy = false; state.isCollectingMail = false; window.__noLife = true; });
  await W(() => {
    // Life ticks off: only the tested job runs
    if (typeof runAutonomousLifeTick === 'function') window.runAutonomousLifeTick = () => {};
    if (typeof decideNextAction === 'function') window.decideNextAction = async () => {};
  });
  const give = names => W(ns => { ns.forEach(n => receiveItem(n, '', 'test')); state.unstoredItems = []; }, names);
  const knowAll = () => W(() => { Object.values(WORKSHOP_MACHINES).forEach(d => { workshopState().known[d.learnAs || d.key] = { at: Date.now() }; }); });
  const ws = (lx, ly, lz) => W(([a, b, c]) => { const p = workshopToWorld(a, c, 1); return [p.x, WORKSHOP_PAD_Y + b, p.z]; }, [lx, ly, lz]);
  const lookLocal = async (cx, cy, cz, tx, ty, tz) => { const c = await ws(cx, cy, cz), t = await ws(tx, ty, tz); await look(c[0], c[1], c[2], t[0], t[1], t[2]); };
  const watchJob = async (name, shots, every = 3500) => {
    for (let i = 0; i < shots.length; i++) {
      await wait(shots[i].at || every);
      if (shots[i].cam) await lookLocal(...shots[i].cam);
      await wait(400);
      await shot(name + '-' + i);
      console.log(name, i, JSON.stringify(await W(() => [state.moodTitle, state.speechBubble.slice(0, 80)])));
    }
  };
  // Midday light for the pictures
  await W(() => { const c = ensureCalendar(); c.startHour += 12.5 - worldNow().hour; if (typeof applyTimeOfDay === 'function') applyTimeOfDay(); if (typeof wsUpdateLighting === 'function') wsUpdateLighting(); });
  const setup = process.env.SETUP;
  if (setup) await W(setup);

  if (SC.has('exterior')) {
    await W(() => { state.roofCutaway = false; cutawayRoofMeshes.forEach(r => { r.material.opacity = 0.95; }); });
    await look(28, 16, 22, 52, 3, -6);
    await wait(2500);
    await shot('ws-exterior');
    await look(66, 13, 14, 52, 4, -5);
    await wait(1500);
    await shot('ws-exterior2');
    await look(48, 50, 16, 48, 0, -3);
    await wait(1200);
    await shot('ws-top');
  }
  if (SC.has('inside')) {
    await W(() => { state.roofCutaway = true; cutawayRoofMeshes.forEach(r => { r.material.opacity = 0.05; }); wsSetFrontFade(0.12); wsSetDeck(0.1); wsShowFloor1(true); wsBuildQueued(Infinity); });
    await lookLocal(1.5, 24, 13, 0.5, 0, -0.5);
    await wait(4000);
    await shot('ws-inside');
    await lookLocal(-2, 6, 9, -1, 1, 2);
    await wait(1200);
    await shot('ws-printers');
    await lookLocal(2, 6, 4, 0, 1, -4);
    await wait(1200);
    await shot('ws-cnc');
    await lookLocal(-1.5, 7, 6, -6, 1.5, -2);
    await wait(1200);
    await shot('ws-taurus');
  }
  // Wait for a step (by its title), aim the camera (local coords), take a shot
  const shotWhen = async (re, name, cam, extra = 600) => {
    await W(r => { window.__wsHold = r; window.__wsHeld = null; }, re);
    try { await page.waitForFunction(() => window.__wsHeld, null, { timeout: 900000, polling: 500 }); }
    catch (e) { console.log('never saw', re, 'title:', await W(() => state.moodTitle)); }
    if (cam) await lookLocal(...cam);
    await wait(extra);
    await shot(name);
    console.log('shot at', JSON.stringify(await W(() => [state.moodTitle, state.speechBubble.slice(0, 90)])));
    await W(() => { window.__wsHold = null; });
  };
  const shotTitle = async (re, name, cam, extra = 600) => {
    try { await page.waitForFunction(r => new RegExp(r, 'i').test(state.moodTitle), re, { timeout: 900000, polling: 100 }); }
    catch (e) { console.log('never saw', re); }
    if (cam) await lookLocal(...cam);
    await wait(extra);
    await shot(name);
    console.log('shot at', JSON.stringify(await W(() => [state.moodTitle])));
  };
  const atDoor = () => W(() => { const p = workshopToWorld(0.3, 9.6, 1); state.botPos = { x: p.x, z: p.z }; state.targetPos = { ...state.botPos }; state.isCollectingMail = true; state.isBusy = false; state.isPracticing = false; window.__job = null; });
  const runJob = (key, job) => W(([k, j]) => { window.__job = 'running'; runMachineJob(k, j || {}, 'Test').then(r => { window.__job = String(r); }); }, [key, job]);
  const jobDone = async () => { await page.waitForFunction(() => window.__job && window.__job !== 'running', null, { timeout: 400000, polling: 500 }); const r = await W(() => window.__job); console.log('job result', r); return r; };
  const cutaway = () => W(() => { state.roofCutaway = true; cutawayRoofMeshes.forEach(r => { r.material.opacity = 0.18; }); });

  if (SC.has('sla')) {
    await knowAll(); await cutaway();
    await give(['A 1 L bottle of grey photopolymer resin', 'A 4 L jug of 99% isopropyl alcohol (IPA)', 'A box of nitrile gloves']);
    console.log('before', JSON.stringify(await W(() => ({ s: state.supplies, missing: missingSupplies(WORKSHOP_MACHINES.sla) }))));
    await atDoor(); await runJob('sla');
    await shotWhen('^Printing .* layer', 'sla-print', [1.85, 2.9, 5.3, 1.85, 1.15, 3.95], 2500);
    await shotWhen('Washing', 'sla-wash', [3.35, 2.8, 5.2, 3.35, 1.15, 3.95], 2000);
    await shotWhen('UV curing', 'sla-cure', [3.85, 2.8, 5.2, 3.85, 1.15, 3.95], 1500);
    await jobDone();
    console.log('after', JSON.stringify(await W(() => ({ s: state.supplies, made: state.workshop.made, skills: Object.keys(state.skills).filter(k => k.startsWith('ws-')), bel: state.belongings.slice(0, 2), kind: itemKindOf(state.workshop.made[0] && state.workshop.made[0].name) }))));
  }

  if (SC.has('fdm')) {
    await knowAll(); await cutaway();
    await give(['A spool of PLA filament']);
    await atDoor(); await runJob('fdm');
    await shotWhen('^Printing', 'fdm-print', [1.1, 1.9, 2.95, 1.1, 1.15, 3.95], 3000);
    await jobDone();
    console.log('fdm speech', await W(() => state.speechBubble));
  }
  if (SC.has('dmls')) {
    await knowAll(); await cutaway();
    await give(['A 10 kg flask of 316L stainless steel powder', 'A cylinder of high-purity argon', 'A P100 half-face respirator', 'A box of nitrile gloves', 'A spool of brass EDM wire']);
    await atDoor(); await runJob('dmls');
    await shotWhen('argon', 'dmls-argon', [-0.9, 2.3, 4.95, -2.9, 0.9, 4.4], 1500);
    await shotWhen('Laser-melting', 'dmls-print', [-1.2, 1.5, 4.85, -2.8, 0.85, 4.4], 3000);
    await shotWhen('Wire EDM', 'dmls-edm', [-1.6, 2.6, -4.6, -3.0, 1.2, -6.75], 2000);
    await shotWhen('heat treat', 'dmls-heat', [-0.3, 2.0, 4.5, -1.45, 0.8, 5.3], 2000);
    await jobDone();
    console.log('after', JSON.stringify(await W(() => ({ s: state.supplies, made: state.workshop.made[0], owned: ownedItemNames().slice(0, 8) }))));
  }
  if (SC.has('haas')) {
    await knowAll(); await cutaway();
    await give(['A block of 6061 aluminium', 'A set of carbide end mills', 'A 3 inch face mill with carbide inserts', 'A 6 inch Kurt machining vise', 'A 5 gal pail of water-soluble coolant', 'A pair of safety glasses']);
    await atDoor(); await runJob('haasvs1', { make: 'a bracket' });
    await shotWhen('Tool change', 'haas-toolchange', [-1.9, 2.3, -11.6, -0.2, 1.4, -14.4], 1500);
    await shotWhen('flood coolant', 'haas-cut', [-0.75, 1.45, -13.05, -0.3, 1.1, -14.45], 2500);
    await jobDone();
    console.log('after', JSON.stringify(await W(() => ({ made: state.workshop.made[0], prog: (state.workshop.programs.haasvs1 || {}).gcode.split('\n').slice(0, 8) }))));
  }
  if (SC.has('avid')) {
    await knowAll(); await cutaway();
    await give(['A 4x8 sheet of Baltic birch plywood', 'A 60-degree V-bit', 'A set of hold-down clamps', 'A sacrificial MDF spoilboard', 'A 4 inch dust collection hose', 'A pair of safety glasses', 'A pair of ear defenders']);
    await atDoor(); await runJob('avid4896', { make: 'a sign' });
    await shotWhen('Clamping', 'avid-clamp', [0.9, 3.6, -1.4, -2.15, 0.7, -4.3], 800);
    await shotWhen('^Routing', 'avid-cut', [0.9, 3.6, -1.4, -2.15, 0.7, -4.3], 4000);
    await jobDone();
    console.log('after', JSON.stringify(await W(() => ({ made: state.workshop.made[0], owned: ownedItemNames().filter(n => /plywood|sign/i.test(n)) }))));
  }
  const giveTruck = () => W(() => { state.toolInventory.push('Dump truck'); const v = registerVehicle('Dump truck'); v.fuel = 100; state.knowHow.truck = { at: 1 }; vehicleService(v).tires = 75; vehicleService(v).oil = 82; v.x = 59.55; v.z = 4.6; v.rotY = Math.PI / 2; renderVehicles3D(); return v.id; });
  if (SC.has('garage')) {
    await knowAll(); await cutaway();
    await give(['A set of four truck tires', 'A box of wheel weights', 'A bottle of air tool oil', 'A pair of safety glasses', 'A box of nitrile gloves', 'A 5 L jug of 5W-30 engine oil', 'An oil filter']);
    await giveTruck();
    await W(() => { const p = { x: 57.6, z: 5.6 }; state.botPos = p; state.targetPos = { ...p }; state.isCollectingMail = true; state.isBusy = false; });
    console.log('due', JSON.stringify(await W(() => garageServiceDue() && garageServiceDue().why)));
    await W(() => { window.__job = 'running'; runMachineJob('garage', { vehicle: findVehicle('truck'), service: 'tires' }, 'Test').then(r => { window.__job = String(r); }); });
    await shotWhen('elevator', 'elev-up', [-0.5, 7.5, 13.5, 6.05, 3.6, 2.0], 1500);
    await shotWhen('Starting the compressor', 'garage-raise', [0.5, 9.5, 6.5, 6.05, 6.5, -2.0], 3500);
    await shotWhen('Breaking the bead', 'garage-beadbreak', [-0.9, 7.4, 3.0, 0.55, 5.8, 4.5], 2500);
    await shotWhen('Demounting the old tire', 'garage-tirechanger', [-0.6, 7.6, 2.6, 0.9, 6.1, 4.55], 2500);
    await shotWhen('balancer', 'garage-balancer', [3.8, 8.0, 7.6, 2.55, 6.0, 4.6], 2500);
    await jobDone();
    console.log('tires done', JSON.stringify(await W(() => { const v = findVehicle('truck'); return { s: v.service, wear: v.wear, cond: vehicleCondition(v), x: v.x, z: v.z, bot: state.botPos }; })));
    await W(() => { window.__job = 'running'; state.isPracticing = false; runMachineJob('garage', { vehicle: findVehicle('truck'), service: 'oil' }, 'Test').then(r => { window.__job = String(r); }); });
    await shotWhen('drain plug', 'garage-oil', [2.4, 7.4, 1.6, 6.05, 7.0, -2.6], 2000);
    await shotWhen('fresh 5W-30', 'garage-oil-fill', [1.8, 9, 5.5, 6.05, 6.5, -2.0], 1200);
    await jobDone();
    console.log('oil done', JSON.stringify(await W(() => { const v = findVehicle('truck'); return { s: v.service, cond: vehicleCondition(v), supplies: state.supplies, owned: ownedItemNames().filter(n => /oil|tire/i.test(n)) }; })));
  }
  if (SC.has('pcb')) {
    await knowAll(); await cutaway();
    await give(['A pack of bare FR-4 circuit boards', 'A set of PCB milling bits', 'A jar of SAC305 solder paste', 'A laser-cut stainless stencil', 'A kit of SMD component reels', 'A bottle of no-clean flux', 'A bar of SAC305 wave solder', 'A sheet of clear acrylic', 'A spool of PLA filament', 'An ESD wrist strap', 'A pair of safety glasses']);
    await atDoor(); await runJob('pcbline', { make: 'a weather station' });
    const C = (x, z) => [x + 1.9, 7.6, z + 2.1, x, 6.2, z];
    await shotWhen('Designing', 'pcb-0-design', C(-2.9, -2.75), 800);
    await shotWhen('Milling the traces', 'pcb-1-mill', C(-1.3, -4.3), 1800);
    await shotWhen('solder paste through', 'pcb-2-paste', C(-3.3, -6.5), 1800);
    await shotWhen('Placing the components', 'pcb-3-pnp', C(-2.05, -6.5), 2500);
    await shotWhen('Reflow', 'pcb-4-reflow', C(-0.2, -6.5), 2500);
    await shotWhen('AOI', 'pcb-5-aoi', C(1.65, -6.5), 1500);
    await shotWhen('solder wave', 'pcb-6-wave', C(-2.9, -4.3), 2000);
    await shotWhen('cutting the acrylic', 'pcb-7-laser', C(0.15, -4.3), 2000);
    await shotWhen('enclosure', 'pcb-8-enclosure', C(2.0, -4.3), 2500);
    await shotWhen('^Testing', 'pcb-9-test', C(-2.9, -2.75), 800);
    await jobDone();
    console.log('made', JSON.stringify(await W(() => ({ made: state.workshop.made[0], kind: itemKindOf('A homemade weather station').kind, used: useWorkshopGadget('A homemade weather station'), say: state.speechBubble }))));
    await shot('pcb-10-use');
  }
  if (SC.has('require')) {
    // Missing resin -> research -> request -> receive -> print
    await cutaway();
    await W(() => { state.isCollectingMail = false; const p = workshopToWorld(0.3, 9.6, 1); state.botPos = { x: p.x, z: p.z }; });
    console.log('ready?', await W(() => machineReady('sla', {}, { quiet: true })), 'known', await W(() => machineKnown('sla')));
    await W(() => { window.__r = researchMachine('sla', 'Test'); });
    await page.waitForFunction(() => machineKnown('sla'), null, { timeout: 300000, polling: 500 });
    await wait(4000);
    const reqs = await W(() => state.requestsToUser.filter(r => !r.fulfilled).map(r => r.requestedGear));
    console.log('requested after research:', JSON.stringify(reqs), 'web:', await W(() => state.webHistory[0].query));
    console.log('second ask is not duplicated:', JSON.stringify(await W(() => { machineReady('sla', {}, {}); return state.requestsToUser.filter(r => !r.fulfilled).length; })));
    // The owner sends them (as the request card does) and he picks them up at the post office
    await W(() => { state.requestsToUser.filter(r => !r.fulfilled && /resin|isopropyl|nitrile/i.test(r.requestedGear)).forEach(r => { r.fulfilled = true; postMail({ kind: 'request', from: 'owner', name: r.requestedGear, category: r.category }); }); });
    await W(() => { const po = TOWN_LOCATIONS.post_office; state.botPos = { x: po.x, z: po.z + 1 }; state.targetPos = { ...state.botPos }; state.isBusy = false; state.isBrowsing = false; state.isPracticing = false; state.isCollectingMail = false; window.__m = pickUpMail('Test'); });
    await page.waitForFunction(() => { if (!state.isCollectingMail && state.mailbox.length && !state.isBusy) { state.isPracticing = false; pickUpMail('Test'); } return !state.isCollectingMail && !state.mailbox.length; }, null, { timeout: 900000, polling: 3000 });
    console.log('received:', JSON.stringify(await W(() => ({ owned: ownedItemNames().filter(n => /resin|isopropyl|nitrile/i.test(n)), missing: missingSupplies(WORKSHOP_MACHINES.sla) }))));
    await W(() => { state.unstoredItems = []; });
    await atDoor(); await runJob('sla');
    await jobDone();
    // Use it up: three more prints and the resin (4 prints a bottle) runs out
    for (let i = 0; i < 3; i++) { await atDoor(); await runJob('sla'); await jobDone(); }
    console.log('used up:', JSON.stringify(await W(() => ({ supplies: state.supplies, resin: ownedItemNames().filter(n => /resin/i.test(n) && !isMadeThing(n)), asked: state.requestsToUser.filter(r => !r.fulfilled).map(r => r.requestedGear), made: state.workshop.made.map(m => m.name), lvl: machineLevel('sla') }))));
    await W(() => savePersistentBrainStateNow());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof wsGroup !== 'undefined' && wsGroup, null, { timeout: 300000 });
    await wait(3000);
    console.log('after reload:', JSON.stringify(await W(() => ({ known: Object.keys(state.workshop.known), jobs: state.workshop.jobs, made: state.workshop.made.length, skill: state.skills['ws-sla'], supplies: state.supplies }))));
  }
  if (SC.has('ask')) {
    await knowAll();
    await give(['A block of 6061 aluminium', 'A set of carbide end mills', 'A 3 inch face mill with carbide inserts', 'A 6 inch Kurt machining vise', 'A 5 gal pail of water-soluble coolant', 'A pair of safety glasses']);
    console.log('parse', JSON.stringify(await W(() => { const a = parseUseRequest('machine me a bracket on the Haas'); return a && { key: a.workshop.def.key, what: a.workshop.what }; })));
    await atDoor();
    await W(() => { state.isCollectingMail = false; respondToVisitor('Tester', 'machine me a bracket on the Haas'); });
    await page.waitForFunction(() => state.workshop.made.length > 0, null, { timeout: 400000, polling: 1000 });
    console.log('made for visitor', JSON.stringify(await W(() => [state.workshop.made[0], state.chatLog.slice(-3).map(c => c.text)])));
    // The AI decision field
    console.log('decision', await W(() => useMachineDecision({ machine: 'the Avid router', make: 'a sign', why: 'test' })));
    console.log('prompt line', await W(() => workshopStatusLine()));
  }
  if (SC.has('fps')) {
    const fps = () => W(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 8000) requestAnimationFrame(f); else r(n / 8); }; requestAnimationFrame(f); }));
    await look(28, 16, 22, 52, 3, -6);
    console.log('fps with workshop', await fps(), JSON.stringify(await W(() => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, lights: (() => { let n = 0; scene.traverse(o => { if (o.isLight) n++; }); return n; })(), progs: renderer.info.programs.length }))));
    await W(() => { wsGroup.visible = false; });
    console.log('fps without', await fps(), JSON.stringify(await W(() => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }))));
    await W(() => { wsGroup.visible = true; wsGroup.userData.lamps.forEach(l => { l.intensity = 0; l.visible = false; }); });
    console.log('fps no lamps', await fps());
  }
  if (SC.has('sizes')) {
    // Will each vehicle and the plane fit? Models where they exist, otherwise real sizes x 1.6 (life scale)
    const rows = await W(() => {
      const out = [];
      const sizeOf = n => { const m = buildItemModel3D(n, { label: false }); if (m.userData.mini) m.userData.mini.scale.setScalar(1); m.updateMatrixWorld(true); const s = new THREE.Vector3(); new THREE.Box3().setFromObject(m).getSize(s); return s; };
      const pk = sizeOf('A pickup truck'), tr = sizeOf('A utility trailer');
      out.push({ n: 'Pickup truck + utility trailer (models, hitched)', from: 'model', size: [+(pk.x + tr.x + 0.4).toFixed(1), +Math.max(pk.y, tr.y).toFixed(1), +Math.max(pk.z, tr.z).toFixed(1)], fits: workshopFits(new THREE.Vector3(pk.x + tr.x + 0.4, Math.max(pk.y, tr.y), Math.max(pk.z, tr.z))) });
      ['Dump truck', 'Excavator', 'Bicycle', 'Snowmobile', 'Helicopter', 'A pickup truck', 'A utility trailer'].forEach(n => {
        const m = buildItemModel3D(n, { label: false });
        if (m.userData.mini) m.userData.mini.scale.setScalar(1);
        m.updateMatrixWorld(true);
        const s = new THREE.Vector3(); new THREE.Box3().setFromObject(m).getSize(s);
        out.push({ n, from: 'model', size: [+s.x.toFixed(1), +s.y.toFixed(1), +s.z.toFixed(1)], fits: workshopFits(s) });
      });
      const spec = { 'Ultralight (10 m span)': [16, 4.0, 9.6], 'Pickup + trailer': [16.6, 3.0, 3.2], 'Mixer truck': [15.2, 6.2, 4.0], 'Go-kart': [3.2, 1.6, 2.2], 'Small car': [6.6, 2.4, 2.9] };
      Object.entries(spec).forEach(([n, [x, y, z]]) => out.push({ n, from: 'real size x1.6', size: [x, y, z], fits: workshopFits(new THREE.Vector3(x, y, z)) }));
      return out;
    });
    rows.forEach(r => console.log('size', JSON.stringify(r)));
    // Every machine's stand spot is on the floor in front of it, never inside any machine's footprint
    console.log('stand clashes', JSON.stringify(await W(() => {
      const bad = [];
      Object.values(WORKSHOP_MACHINES).filter(d => d.at).forEach(d => {
        const st = machineStand(d);
        workshopMachinesOn(d.floor).forEach(o => {
          const sz = o.size || { w: 1, d: 1 }, a = -(o.at.ry || 0);
          const dx = st.x - o.at.x, dz = st.z - o.at.z;
          const lx = dx * Math.cos(a) - dz * Math.sin(a), lz = dx * Math.sin(a) + dz * Math.cos(a);
          if (Math.abs(lx) < sz.w / 2 + 0.25 && Math.abs(lz) < sz.d / 2 + 0.25) bad.push(`${d.key} stand in ${o.key}`);
        });
        const wb = wsWingBounds(), inWing = d.floor === 1 && st.x > wb.x0 + 0.3 && st.x < wb.x1 - 0.3 && st.z > wb.z0 + 0.3 && st.z < wb.z1 - 0.3;
        if (!inWing && (Math.abs(st.x) > WS_IN.x - 0.3 || Math.abs(st.z) > WS_IN.z - 0.3)) bad.push(`${d.key} stand outside the walls`);
      });
      return bad;
    })));
    console.log('size limits', JSON.stringify(await W(() => ({ hangar: WORKSHOP_HANGAR, assemblyBay: WORKSHOP_STATIONS.assembly.size, door1: WS_DOORS.vehicle, carElevator: WS_LIFT, floor1Clear: WS_F2 - 0.3 - WS_F1, floor2Clear: WS_EAVE - WS_F2 }))));
  }
  if (SC.has('hangar')) {
    await W(() => { state.roofCutaway = false; cutawayRoofMeshes.forEach(r => { r.material.opacity = 0.95; }); });
    await look(28, 14, 6, 36, 3, -14);
    await wait(2500);
    await shot('hangar-exterior');
    // The dump truck and the excavator parked inside, the aircraft bay marked out
    await W(() => {
      state.roofCutaway = true; cutawayRoofMeshes.forEach(r => { r.material.opacity = 0.12; });
    });
    await look(34.6, 26, -2, 34.6, 0, -15.5);
    await wait(2000);
    await shot('hangar-plane-footprint');
    await W(() => { ['Dump truck', 'Excavator', 'A pickup truck', 'A utility trailer'].forEach(n => { state.toolInventory.push(n); registerVehicle(n); });
      const by = re => state.vehicles.find(v => re.test(v.name));
      const t = by(/dump truck/i), e = by(/excavator/i), p = by(/pickup/i), tr = by(/trailer/i);
      const pk = workshopParkingSpots();
      t.x = pk[0].x; t.z = pk[0].z; t.rotY = 0; e.x = pk[1].x; e.z = pk[1].z; e.rotY = Math.PI / 2;
      if (p) { p.x = 52.0; p.z = -18.0; p.rotY = 0; }
      if (tr) { tr.x = 45.6; tr.z = -18.0; tr.rotY = 0; }
      renderVehicles3D();
      console.log('in hangar', JSON.stringify(state.vehicles.map(v => [v.name, v.x, v.z])));
      state.roofCutaway = true; cutawayRoofMeshes.forEach(r => { r.material.opacity = 0.12; }); });
    await look(34.6, 22, 4, 34.6, 0, -15);
    await wait(2500);
    await shot('hangar-inside');
    await look(34.6, 4.5, -4.5, 34.6, 2.5, -16);
    await wait(1500);
    await shot('hangar-door');
    await look(49, 18, -33, 50, 0, -18);
    await wait(1500);
    await shot('wing-parked');
  }
  if (SC.has('gift')) {
    // The 3D printer he is given goes into the Workshop's bench bay, and his first print happens there
    await cutaway();
    await W(() => { state.isCollectingMail = true; state.knowHow.printer = { at: 1 }; const p = workshopToWorld(0.3, 9.0, 1); state.botPos = { x: p.x, z: p.z }; state.targetPos = { ...state.botPos }; });
    await W(() => { receiveItem('A Prusa 3D printer', 'tool', 'test'); receiveItem('A spool of PLA filament', 'material', 'test'); });
    await wait(3000);
    await W(() => { state.isBusy = false; state.isBrowsing = false; state.isPracticing = false; state.isBuilding = false; window.__g = 'running'; setUpPrinter('Test').then(r => { window.__g = 'setup:' + r; }); });
    await shotTitle('Carrying his new 3D printer', 'gift-carry', [4.3, 3.2, 3.0, 2.65, 0.9, 6.0], 1500);
    await page.waitForFunction(() => window.__g !== 'running', null, { timeout: 900000, polling: 1000 });
    console.log('gift setup', JSON.stringify(await W(() => ({ r: window.__g, spot: PRINTER_SPOT, grp: printerGroup && [printerGroup.position.x, printerGroup.position.y, printerGroup.position.z], diary: state.diaryEntries[0].text.slice(0, 120), ai: printerSummaryForAI().slice(0, 60) }))));
    await W(() => { window.__g = 'running'; state.isBusy = false; state.isPracticing = false; printSomething(null, 'Test').then(r => { window.__g = 'print:' + r; }); });
    await shotTitle('^Printing', 'gift-print', [4.0, 2.8, 4.6, 2.65, 1.2, 6.4], 3000);
    await page.waitForFunction(() => window.__g !== 'running', null, { timeout: 900000, polling: 1000 });
    console.log('gift print', await W(() => window.__g), JSON.stringify(await W(() => state.botPos)));
  }
  if (SC.has('floor3')) {
    await knowAll(); await cutaway();
    // The car elevator: floor 1 -> 3 -> 2 -> 1 with the dump truck aboard, a picture at each landing
    await giveTruck();
    await W(() => { const v = findVehicle('truck'); v.x = 59.35; v.z = 4.6; v.rotY = Math.PI / 2; renderVehicles3D(); const p = { x: 57.6, z: 5.6 }; state.botPos = p; state.targetPos = { ...p }; state.isCollectingMail = true; state.isBusy = false; state.isPracticing = false;
      window.__job = 'running'; goIntoWorkshop({ vehicle: findVehicle('truck'), vehicleTour: [3, 2, 1], stops: [] }).then(r => { window.__job = 'tour:' + JSON.stringify(r); }); });
    const landing = async (f, cam) => {
      await W(() => { window.__wsHold = 'landing'; });
      await page.waitForFunction(fl => window.__wsHeld === 'landing ' + fl, f, { timeout: 900000, polling: 300 });
      await lookLocal(...cam);
      await wait(1500);
      await shot('elevator-floor' + f);
      console.log('landing', f, JSON.stringify(await W(() => [state.moodTitle, workshopTrip.floor, workshopTrip.liftY.toFixed(2)])));
      await W(() => { window.__wsHeld = null; });
    };
    await landing(3, [2.9, 14.7, 5.6, 5.85, 14.0, 3.4]);
    await landing(2, [2.9, 7.1, 5.6, 5.85, 6.4, 3.4]);
    await landing(1, [2.9, 1.8, 5.6, 5.85, 1.1, 3.4]);
    await W(() => { window.__wsHold = null; });
    await page.waitForFunction(() => window.__job !== 'running', null, { timeout: 900000, polling: 1000 });
    console.log('tour done', await W(() => window.__job), JSON.stringify(await W(() => { const v = findVehicle('truck'); return [v.x, v.z, state.botPos]; })));
    // Glass blowing: gather, blow, anneal
    await give(['A 50 lb bag of clear glass cullet', 'A jar of coloured glass frit and colour rod', 'A month of furnace gas on the gas meter', 'A pair of didymium safety glasses', 'A pair of Kevlar heat gloves']);
    await atDoor(); await runJob('glassstudio', { make: 'a vase' });
    await shotWhen('Gathering molten glass', 'glass-gather', [-5.2, 15.4, -3.6, -6.6, 13.9, -5.9], 1500);
    await shotWhen('Blowing the first bubble', 'glass-blow', [-3.0, 15.0, -1.4, -4.4, 14.0, -3.0], 1500);
    await shotWhen('Reheating in the glory hole', 'glass-gloryhole', [-3.3, 15.0, -3.8, -4.6, 14.1, -6.0], 1500);
    await shotWhen('Annealing', 'glass-anneal', [-1.0, 15.0, -4.2, -2.4, 13.9, -6.3], 1500);
    await jobDone();
    console.log('glass', JSON.stringify(await W(() => ({ made: state.workshop.made[0], kind: itemKindOf(state.workshop.made[0] && state.workshop.made[0].name).kind, supplies: state.supplies }))));
    // Woodshop: table saw rip, then the lathe
    await give(['A stack of rough-sawn maple lumber', 'A bottle of wood glue', 'A pack of sandpaper (80 to 220 grit)', 'A can of wipe-on polyurethane', 'A set of push sticks and a push block', 'A pair of ear defenders', 'A pair of safety glasses', 'A cherry bowl blank', 'A set of turning gouges', 'A full face shield']);
    await atDoor(); await runJob('woodshop', { make: 'a side table' });
    await shotWhen('Ripping to width', 'wood-tablesaw', [3.3, 15.0, -0.8, 1.6, 13.9, -3.0], 1500);
    await jobDone();
    await atDoor(); await runJob('woodturning', {});
    await shotWhen('Turning the bowl', 'wood-lathe', [3.2, 14.8, 2.2, 1.5, 14.0, 0.6], 1500);
    await jobDone();
    console.log('wood', JSON.stringify(await W(() => state.workshop.made.slice(0, 3))));
    await W(() => { wsSetDecksFor(3); state.roofCutaway = true; cutawayRoofMeshes.forEach(r => { if (!wsDeck3Meshes.includes(r)) r.material.opacity = 0.05; }); workshopShowFloor(3, true); wsSetFrontFade(0.12); });
    await lookLocal(2, 30, 12, 0, 13, -1);
    await wait(2500);
    await shot('floor3-overview');
  }
  if (SC.has('forklift')) {
    await W(() => { state.knowHow.forklift = { at: 1 }; state.toolInventory.push('An electric workshop forklift'); const v = registerVehicle('An electric workshop forklift'); v.charge = 60; v.fuel = 100; renderVehicles3D();
      const p = { x: FORKLIFT_CHARGER.park.x - 1.5, z: FORKLIFT_CHARGER.park.z + 2 }; state.botPos = p; state.targetPos = { ...p }; state.isCollectingMail = true; state.isBusy = false; state.isPracticing = false;
      state.roofCutaway = true; cutawayRoofMeshes.forEach(r => { r.material.opacity = 0.1; });
      window.__f = 'running'; forkliftMovePallet('glass batch').then(r => { window.__f = String(r); }); });
    console.log('forklift', JSON.stringify(await W(() => { const v = theForklift(); return { v: v && [v.name, v.kind, v.x, v.z, v.charge], terrain: VEHICLE_TERRAIN.forklift.text, cap: vehicleRequestCheck('A second forklift').blocked }; })));
    // From above the wing (roof cut away): lifting off the racking, then carrying it through door 5
    try { await page.waitForFunction(() => /Lifting the pallet/.test(state.moodTitle), null, { timeout: 900000, polling: 100 }); } catch (e) { console.log('never saw lifting'); }
    await wait(2200);
    { const p = await W(() => { const m = vehicleMeshes[theForklift().id]; return [m.position.x, m.position.y, m.position.z]; }); await look(p[0] + 2.6, p[1] + 3.2, p[2] + 2.4, p[0], p[1] + 1.4, p[2] - 1.2); }
    await wait(600);
    await shot('forklift-rack');
    try { await page.waitForFunction(() => /Carrying the pallet/.test(state.moodTitle), null, { timeout: 900000, polling: 100 }); } catch (e) { console.log('never saw carrying'); }
    await wait(1800);
    { const p = await W(() => { const m = vehicleMeshes[theForklift().id]; return [m.position.x, m.position.y, m.position.z]; }); await look(p[0] - 3.2, p[1] + 3.4, p[2] + 3.2, p[0], p[1] + 0.9, p[2]); }
    await wait(500);
    await shot('forklift-pallet');
    await page.waitForFunction(() => window.__f !== 'running', null, { timeout: 900000, polling: 1000 });
    await W(() => { const v = theForklift(); v.charge = 20; window.__f = 'running'; forkliftToCharger(v).then(() => { window.__f = 'charging'; }); });
    await page.waitForFunction(() => window.__f !== 'running', null, { timeout: 900000, polling: 1000 });
    await look(50.2, 2.8, -20.2, 46.6, 1.0, -15.5);
    await wait(6000);
    await shot('forklift-charging');
    console.log('charging', JSON.stringify(await W(() => { const v = theForklift(); return [v.plugged, v.charge]; })));
  }
  if (SC.has('usedup')) {
    // The last of the resin: one print left in the bottle, he prints, the bottle is gone and he asks again
    await knowAll();
    await give(['A 1 L bottle of grey photopolymer resin', 'A 4 L jug of 99% isopropyl alcohol (IPA)', 'A box of nitrile gloves']);
    await W(() => { state.supplies['a 1 l bottle of grey photopolymer resin'] = { cur: 1, per: 4 }; });
    console.log('before', JSON.stringify(await W(() => [supplyNote('A 1 L bottle of grey photopolymer resin'), ownedItemNames().filter(n => /resin/i.test(n) && !isMadeThing(n))])));
    for (let i = 0; i < 2; i++) {
      await atDoor(); await runJob('sla'); await jobDone();
      const st = await W(() => [ownedItemNames().filter(n => /resin/i.test(n) && !isMadeThing(n)), state.requestsToUser.filter(r => !r.fulfilled).map(r => r.requestedGear)]);
      console.log('used up check', JSON.stringify(st));
      if (!st[0].length) break;
    }
  }
  if (SC.has('wing')) {
    // The north wing, the hangar's bays, the drive-through with the pickup towing its trailer
    await W(() => { state.roofCutaway = true; cutawayRoofMeshes.forEach(r => { r.material.opacity = 0.08; }); wsShowFloor1(true); wsBuildQueued(Infinity); });
    await look(47, 30, -36, 47, 0, -15);
    await wait(4000);
    await shot('wing-top');
    await lookLocal(-7.0, 4.5, -8.4, 3.0, 1.0, -13.5);
    await wait(1500);
    await shot('wing-hall');
    console.log('fits', JSON.stringify(await W(() => workshopFits([
      { name: 'ultralight', build: true, size: { x: 16, y: 4.0, z: 9.6 } },
      { name: 'go-kart', build: true, size: { x: 3.2, y: 1.6, z: 2.2 } },
      { name: 'pickup + trailer', size: { x: 14.2, y: 3.0, z: 3.2 } },
      { name: 'dump truck', size: { x: 7.9, y: 4.1, z: 3.5 } },
      { name: 'pickup', size: { x: 7.0, y: 3.0, z: 3.2 } }
    ]))));
    console.log('fits one', JSON.stringify(await W(() => workshopFits({ x: 14.2, y: 3.0, z: 3.2 }))));
    console.log('bays', JSON.stringify(await W(() => ({ build: workshopAssemblyBays().map(b => [b.key, b.x, b.z, b.w, b.d]), park: workshopParkingSpots().map(b => [b.key, +b.x.toFixed(1), +b.z.toFixed(1), b.w, b.d]) }))));
    await W(() => { state.toolInventory.push('A pickup truck'); const v = registerVehicle('A pickup truck'); v.x = 42.9; v.z = -5.0; v.rotY = Math.PI / 2; v.fuel = 100; renderVehicles3D();
      const p = { x: 41.0, z: -4.4 }; state.botPos = p; state.targetPos = { ...p }; state.isCollectingMail = true; state.isBusy = false; state.isPracticing = false;
      window.__wsHold = 'drive'; window.__job = 'running';
      goIntoWorkshop({ vehicle: v, driveThrough: { trailer: true }, stops: [] }).then(r => { window.__job = 'drive:' + JSON.stringify(r); }); });
    const leg = async (name, cam) => {
      await page.waitForFunction(n => window.__wsHeld === 'drive ' + n, name, { timeout: 900000, polling: 300 });
      await look(...cam);
      await wait(1500);
      await shot('drive-' + name);
      console.log('drive', name, JSON.stringify(await W(() => [state.moodTitle, workshopTrip.vehicleAt, workshopTrip.trailer && workshopTrip.trailer.size])));
      await W(() => { window.__wsHeld = null; });
    };
    await leg('hangar', [40, 22, -31, 41, 0, -13]);
    await leg('wing', [44, 22, -32, 46, 0, -17]);
    await leg('aisle', [53, 20, -33, 53, 0, -18]);
    await W(() => 0); { const c = await ws(1.0, 4.2, 7.0), t = await ws(5.85, 1.2, -2.0); await leg('shop', [...c, ...t]); }
    await W(() => { window.__wsHold = null; });
    await page.waitForFunction(() => window.__job !== 'running', null, { timeout: 900000, polling: 1000 });
    console.log('drive done', await W(() => window.__job), JSON.stringify(await W(() => { const v = state.vehicles.find(v => /pickup/i.test(v.name)); return [v.x, v.z, state.botPos]; })));
    await look(64, 9, 14, 58, 1, 4);
    await wait(1500);
    await shot('drive-out');
  }

  if (SC.has('gallery') || SC.has('perf')) {
    const tag = process.env.TAG || 'x';
    await knowAll();
    await W(() => { window.__noLife = true; state.roofCutaway = true; cutawayRoofMeshes.forEach(r => { r.material.opacity = 0.05; }); wsSetFrontFade(0.12); wsShowFloor1(true); wsBuildQueued(Infinity); workshopShowFloor(2, true); workshopShowFloor(3, true); keloGroup.visible = false; });
    await wait(1500);
    const frame = () => W(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 5000) requestAnimationFrame(f); else r(+((performance.now() - t0) / n).toFixed(1)); }; requestAnimationFrame(f); }));
    const info = () => W(() => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, progs: renderer.info.programs.length }));
    // Per-machine cost
    const stats = await W(() => Object.keys(wsModels).map(k => { let meshes = 0, tris = 0; wsModels[k].traverse(o => { if (o.isMesh && o.visible) { meshes++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } }); return [k, meshes, Math.round(tris)]; }));
    let tm = 0, tt = 0; stats.forEach(s => { tm += s[1]; tt += s[2]; });
    console.log('machines', stats.length, 'meshes', tm, 'tris', tt);
    console.log('per machine', JSON.stringify(stats));
    // Floor overviews (draw calls / frame time)
    for (const f of [1, 2, 3]) {
      await W(fl => { wsSetDecksFor(fl); }, f);
      const y = f === 3 ? 13 : f === 2 ? 5.4 : 0.12;
      await lookLocal(1.5, y + 9, 12, 0.5, y, -1.5);
      await wait(1500);
      const ms = await frame();
      console.log('floor', f, 'frame ms', ms, JSON.stringify(await info()));
      await shot(tag + '-floor' + f);
    }
    if (SC.has('gallery')) {
      const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
      const keys = await W(() => Object.keys(wsModels));
      await page.addStyleTag({ content: 'body *{visibility:hidden !important} canvas{visibility:visible !important}' });
      await W(() => { controls.minDistance = 0.05; controls.maxPolarAngle = Math.PI; });
      for (const k of keys) {
        if (only && !only.test(k)) continue;
        const cam = await W(key => {
          const m = wsModels[key], def = WORKSHOP_MACHINES[key];
          wsSetDecksFor(def.floor);
          wsFloor1.visible = def.floor === 1; wsFloor2.visible = def.floor === 2; wsFloor3.visible = def.floor === 3;
          m.updateMatrixWorld(true);
          const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
          const big = Math.min(4.5, Math.max(s.x, s.y, s.z));
          const ry = def.at.ry || 0, dx = Math.sin(ry + 0.45), dz = Math.cos(ry + 0.45);
          const dist = big * 0.95 + 0.4;
          return [c.x + dx * dist, c.y + big * 0.3 + 0.2, c.z + dz * dist, c.x, c.y - s.y * 0.05, c.z];
        }, k);
        await look(...cam);
        await wait(400);
        await shot(tag + '-m-' + k);
      }
    }
  }
  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
  if (server) server.close();
})();
