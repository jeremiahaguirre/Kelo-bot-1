// Checks for the five open audit fixes (agent/openfixes): when-free keys, Storehouse copies, shelf take-out/put-back,
// saved letters, Settings Save. Usage: KELO_ROOT=... PORT=8900 node openfix.js [free,store,shelf,museum,notes,settings | all]
const { chromium } = require('playwright');
const path = require('path');
const http = require('http'), fs = require('fs');
const V = path.join(__dirname, 'vendor');
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const ROOT = process.env.KELO_ROOT || '/home/user/kelo-bot-1';
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
    srv.on('error', () => resolve(null));
    srv.listen(PORT, () => resolve(srv));
  });
}
async function routes(page) {
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.includes('three.min.js')) return route.fulfill({ path: path.join(V, 'three.min.js'), contentType: 'application/javascript' });
    if (u.includes('OrbitControls.js')) return route.fulfill({ path: path.join(V, 'OrbitControls.js'), contentType: 'application/javascript' });
    if (u.includes('cdn.tailwindcss.com')) return route.fulfill({ path: path.join(V, 'tailwind.js'), contentType: 'application/javascript' });
    if (u.includes('phosphor-icons')) return route.fulfill({ body: '', contentType: 'application/javascript' });
    if (u.includes('generativelanguage') || u.includes('anthropic.com')) return route.fulfill({ status: 500, body: '{}' });
    if (u.includes('wikipedia.org') || u.includes('wikimedia.org')) return route.abort('internetdisconnected');
    if (u.startsWith(`http://localhost:${PORT}`)) return route.continue();
    return route.fulfill({ status: 404, body: '' });
  });
}

(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text())) console.log('console.error:', m.text().slice(0, 200)); });
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await routes(page);
  const load = async () => { await page.waitForFunction(() => typeof state !== 'undefined' && typeof keloGroup !== 'undefined' && keloGroup, null, { timeout: 900000 }); await page.waitForTimeout(3500); await page.evaluate(() => { state.isCollectingMail = true; }); };
  await page.goto(`http://localhost:${PORT}/index.html`, { timeout: 420000 });
  await load();
  const W = (fn, a) => page.evaluate(fn, a);
  const reload = async () => { await page.reload({ timeout: 420000 }); await load(); };
  const want = new Set((process.argv[2] || 'all').split(','));
  const on = k => want.has('all') || want.has(k);
  let fails = 0;
  const check = (name, ok, info) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info !== undefined ? ' ' + JSON.stringify(info) : ''}`); };
  const shot = async name => { try { await page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 300000 }); console.log('shot', name); } catch (e) { console.log('shot FAILED', name); } };

  // 1. The when-free queue: different arguments from one call site are two jobs; intended merges stay merged
  if (on('free')) {
    const r = await W(() => {
      state.isBusy = true; freeQueue.length = 0;
      const q = () => freeQueue.length;
      const out = {};
      // Land shaping (landscape.js: one line, `run` closures with the same source text for any x, z)
      applyShapeDecision({ action: 'chop', x: -20, z: -15 }); applyShapeDecision({ action: 'chop', x: -30, z: -25 });
      out.chopTwoPlaces = q(); freeQueue.length = 0;
      applyShapeDecision({ action: 'chop', x: -20, z: -15 }); applyShapeDecision({ action: 'chop', x: -20, z: -15 });
      out.chopSamePlace = q(); freeQueue.length = 0;
      // Selling two different things (shopkeeping.js) — a stand-in resolver so both are sellable
      const realResolve = window.resolveSellable; window.resolveSellable = n => ({ name: n });
      sellItemDecision({ item: 'Print A', price: 5 }); sellItemDecision({ item: 'Print B', price: 5 });
      out.sellTwo = q(); window.resolveSellable = realResolve; freeQueue.length = 0;
      // Two different Workshop machine jobs (machines.js)
      try { useMachineDecision({ machine: 'woodshop', make: 'a stool' }); useMachineDecision({ machine: 'woodshop', make: 'a shelf' }); } catch (e) { out.umErr = e.message; }
      out.machineTwo = q(); freeQueue.length = 0;
      // Intended merges: eating, putting away
      doWhenFree(() => 1, { key: 'eat' }); doWhenFree(() => 2, { key: 'eat' });
      out.eatTwice = q(); freeQueue.length = 0;
      if (typeof putAwayItems === 'function') { for (let i = 0; i < 3; i++) doWhenFree(putAwayItems, { key: 'putaway' }); }
      out.putawayThrice = q(); freeQueue.length = 0;
      // No key: never merged with another call
      const f = n => doWhenFree(() => n); f(1); f(2);
      out.noKeyTwo = q(); freeQueue.length = 0;
      state.isBusy = false;
      return out;
    });
    check('two chop decisions at different places are two jobs', r.chopTwoPlaces === 2, r);
    check('the same chop twice is one job', r.chopSamePlace === 1);
    check('selling two different things is two jobs', r.sellTwo === 2);
    check('two different machine jobs are two jobs', r.machineTwo === 2);
    check('eating twice / putting away thrice are one job each', r.eatTwice === 1 && r.putawayThrice === 1);
    check('calls without a key are never merged', r.noKeyTwo === 2);
  }

  // 2. Storehouse copies with the same name
  if (on('store')) {
    const has = await W(() => typeof syncStoreCopies === 'function');
    // Older save: no records, a duplicate name with one copy still to put away
    const before = await W(() => {
      state.toolInventory = ['Claw hammer', 'Hand saw', 'Claw hammer', 'Wrench']; state.toys = [{ name: 'Yo-yo' }]; state.belongings = [{ name: 'Pebble', category: 'thing' }, { name: 'Pebble', category: 'thing' }];
      state.unstoredItems = ['Claw hammer'];
      // the old shelf order: everything reversed, every copy of a name still to put away hidden
      const all = [...state.toolInventory, ...state.toys.map(t => t.name), ...state.belongings.map(b => b.name)].reverse();
      const oldLayout = all.filter(n => n !== 'Claw hammer');
      return { oldLayout };
    });
    // Write it as an older save would have it (no shelf records) and reload
    await W(() => {
      savePersistentBrainStateNow();
      const raw = JSON.parse(keloStore.getItem(BRAIN_KEY)); delete raw.storeCopies; delete raw.storeCopyNext; keloStore.setItem(BRAIN_KEY, JSON.stringify(raw));
      const real = keloStore.setItem.bind(keloStore);
      keloStore.setItem = (k, v) => { if (k === BRAIN_KEY) { try { const o = JSON.parse(v); delete o.storeCopies; delete o.storeCopyNext; v = JSON.stringify(o); } catch (e) {} } return real(k, v); };
    });
    await reload();
    const mig = await W(() => storedItems().map(i => ({ name: i.name, slot: i.slot, id: i.id })));
    const layoutKept = before.oldLayout.every((n, i) => mig[i] && mig[i].name === n && (mig[i].slot === undefined || mig[i].slot === i));
    check('an older save keeps its shelf layout', layoutKept, { old: before.oldLayout, now: mig.map(m => `${m.slot}:${m.name}`) });
    const hammers = mig.filter(m => m.name === 'Claw hammer');
    check('the stored Claw hammer shows although another copy is still to put away', hammers.length === 1, hammers);
    check('each copy has its own id and slot', has && new Set(mig.map(m => m.id)).size === mig.length && new Set(mig.map(m => m.slot)).size === mig.length);
    // Take one Pebble out (the trip itself stubbed): only that copy's slot empties
    const take = await W(async () => {
      const realGo = window.goIndoors; window.goIndoors = async (site, jobs) => { jobs.forEach(j => { j.done = true; if (j.onPlaced) j.onPlaced(); }); return true; };
      try {
        const pebblesBefore = storedItems().filter(i => i.name === 'Pebble').map(i => i.slot);
        const got = await fetchFromStorehouse('Pebble');
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        const pebblesAfter = storedItems().filter(i => i.name === 'Pebble').map(i => i.slot);
        const out = typeof storeCopiesOut === 'function' ? storeCopiesOut().map(c => c.slot) : [];
        // Needed again before he put it back: he uses the one he has, not the second copy
        await fetchFromStorehouse('Pebble');
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        const outAgain = typeof storeCopiesOut === 'function' ? storeCopiesOut().length : -1;
        // Put it back: it returns to its own slot
        state.isPracticing = false; state.isBusy = false; state.isBuilding = false;
        // (the same trip also puts away the waiting Claw hammer)
        const hammerSlotsBefore = storedItems().filter(i => i.name === 'Claw hammer').map(i => i.slot);
        const putBack = await putAwayItems();
        const pebblesBack = storedItems().filter(i => i.name === 'Pebble').map(i => i.slot);
        // The waiting Claw hammer went to an empty slot of its own, not the older copy's
        const hammerSlotsAfter = storedItems().filter(i => i.name === 'Claw hammer').map(i => i.slot);
        return { got: got && got.name, outAgain, pebblesBefore, pebblesAfter, out, putBack, pebblesBack, hammerSlotsBefore, hammerSlotsAfter, unstored: state.unstoredItems.slice() };
      } finally { window.goIndoors = realGo; }
    });
    check('taking one Pebble out hides only that copy', take.pebblesBefore.length === 2 && take.pebblesAfter.length === 1 && take.out.length === 1 && take.out[0] === take.pebblesBefore[0], take);
    check('needing it again before putting it back takes no second copy', take.outAgain === 1, take.outAgain);
    check('putting it back returns it to its own slot', take.putBack === true && JSON.stringify(take.pebblesBack) === JSON.stringify(take.pebblesBefore));
    const newSlot = take.hammerSlotsAfter.filter(s => !take.hammerSlotsBefore.includes(s));
    check('a new copy of a name already stored gets its own slot; the older copy stays put', take.hammerSlotsAfter.length === 2 && take.hammerSlotsBefore.every(s => take.hammerSlotsAfter.includes(s)) && newSlot.length === 1 && take.unstored.length === 0, { before: take.hammerSlotsBefore, after: take.hammerSlotsAfter });
    // Records survive a reload (taking a copy out again first)
    const pre = await W(async () => {
      const realGo = window.goIndoors; window.goIndoors = async () => true;
      try { await fetchFromStorehouse('Hand saw'); } finally { window.goIndoors = realGo; }
      if (typeof setCarriedObject === 'function') setCarriedObject(null);
      state.isBusy = true; // he doesn't put it back before the reload
      savePersistentBrainStateNow();
      return JSON.stringify((state.storeCopies || []).map(c => [c.id, c.name, c.slot, c.out]).sort());
    });
    await reload();
    const post = await W(() => { state.isBusy = true; return JSON.stringify((state.storeCopies || []).map(c => [c.id, c.name, c.slot, c.out]).sort()); });
    check('shelf records (ids, slots, a copy out) survive a reload', has && pre === post && /Hand saw",\d+,true/.test(post), { pre, post });
    await W(() => { state.isBusy = false; });
  }

  // 3. A shelf thing taken out to use: its slot is empty everywhere while he has it; back on its slot once he puts it back
  if (on('shelf')) {
    const setup = await W(() => {
      state.isBusy = false; state.isPracticing = false; state.isBuilding = false; state.isCollectingMail = true;
      state.toolInventory = ['Hand saw']; state.toys = []; state.belongings = []; state.unstoredItems = [];
      // the saw first, on an empty Storehouse, so it sits upstairs (slot 0); the hammers end up in basement B1
      if (Array.isArray(state.storeCopies)) { state.storeCopies = []; storedItems(); }
      for (let i = 0; i < 40; i++) state.belongings.unshift({ name: `Thing number ${i + 1}`, category: 'thing' });
      state.belongings.unshift({ name: 'Claw hammer', category: 'thing' }); state.belongings.unshift({ name: 'Claw hammer', category: 'thing' });
      state.unstoredItems = [];
      showStorehouseModels(true); renderStorehouseShelves3D(); buildQueuedShelfModels(Infinity);
      const d = worldObstacles.find(o => o.building === 'storehouse').door; state.botPos = { x: d.x, z: d.z }; state.targetPos = { ...state.botPos };
      const per = shelfSlots.length;
      // (main before the fix has no slot field: a thing's slot was its place in storedItems())
      const all = storedItems().map((it, i) => ({ ...it, slot: it.slot ?? i }));
      return { per, saw: all.find(i => i.name === 'Hand saw'), hammers: all.filter(i => i.name === 'Claw hammer') };
    });
    console.log('setup', JSON.stringify(setup));
    const look = (taken) => W(([taken, per]) => {
      const up = shelfItemsGroup.children.filter(h => h.visible && h.userData.itemName).map(h => `${h.userData.slotIndex}:${h.userData.itemName}`);
      const lvl = Math.floor(taken.slot / per);
      let basement = null;
      if (lvl > 0) { const g = new THREE.Group(); fillStorehouseRoom(g, lvl, -lvl * BASEMENT_LEVEL_DEPTH); const fy = -lvl * BASEMENT_LEVEL_DEPTH, shift = fy - levelFloorY(basementSite('storehouse'), 0);
        // the slot each model sits in, from where it stands (main before the fix doesn't tag basement models)
        const slotOf = h => shelfSlots.findIndex(sl => Math.abs(sl.x - h.position.x) < 1e-3 && Math.abs(sl.z - h.position.z) < 1e-3 && Math.abs(sl.y + shift - h.position.y) < 1e-3);
        basement = g.children.filter(h => h.userData && h.userData.itemName).map(h => `${slotOf(h)}:${h.userData.itemName}`); }
      const cells = storehouseViewerItems();
      const cell = cells[taken.slot];
      // the 12-a-page viewer: page and cell of that slot
      const pageItems = cells.slice(Math.floor(taken.slot / 12) * 12, Math.floor(taken.slot / 12) * 12 + 12);
      return { up, basement, cell: cell ? { empty: Boolean(cell.empty), name: cell.name || cell.outName || null } : null, pageNames: pageItems.map(c => (c && !c.empty ? c.name : '')), out: typeof storeCopiesOut === 'function' ? storeCopiesOut().map(c => c.slot) : null };
    }, [taken, setup.per]);
    // The saw (upstairs) and a hammer (basement B1)
    for (const which of ['Hand saw', 'Claw hammer']) {
      const taken = which === 'Hand saw' ? setup.saw : setup.hammers[0];
      const other = which === 'Claw hammer' ? setup.hammers[1] : null;
      const t0 = Date.now();
      await W(async (n) => { await fetchFromStorehouse(n); }, which);
      console.log(which, 'taken in', ((Date.now() - t0) / 1000).toFixed(0), 's');
      await W(() => { state.isBusy = true; if (typeof setCarriedObject === 'function') setCarriedObject(null); renderStorehouseShelves3D(); buildQueuedShelfModels(Infinity); });
      const mid = await look(taken);
      const k = taken.slot % setup.per;
      const lvl = Math.floor(taken.slot / setup.per);
      const emptyUp = lvl > 0 || !mid.up.some(s => s.startsWith(k + ':'));
      const emptyDown = lvl === 0 || !mid.basement.some(s => s.startsWith(k + ':'));
      const otherShown = !other || (Math.floor(other.slot / setup.per) === lvl ? (lvl === 0 ? mid.up : mid.basement).includes(`${other.slot % setup.per}:Claw hammer`) : true);
      check(`${which} taken out: its slot is empty on the shelf, in the basement room and in the viewer`, emptyUp && emptyDown && mid.cell && mid.cell.empty && otherShown, { slot: taken.slot, ...mid, up: mid.up.length, basement: mid.basement && mid.basement.length });
      if (which === 'Hand saw') { await W(() => { const p = storehouseGroup.position; state.cameraMode = 'none'; camera.position.set(p.x + 2, p.y + 4, p.z + 9); controls.target.set(p.x, p.y + 1.2, p.z); controls.update(); }); await page.waitForTimeout(800); await shot('openfix-shelf-saw-out'); }
      // He is done with it: free again, he puts it back
      await W(() => { state.isBusy = false; });
      const t1 = Date.now();
      const back = await W(() => putAwayItems());
      console.log(which, 'put back in', ((Date.now() - t1) / 1000).toFixed(0), 's');
      await W(() => { renderStorehouseShelves3D(); buildQueuedShelfModels(Infinity); });
      const after = await look(taken);
      const shownAgain = lvl === 0 ? after.up.includes(`${k}:${which}`) : after.basement.includes(`${k}:${which}`);
      check(`${which} put back: it shows on its own slot again (shelf/basement and viewer)`, back === true && shownAgain && after.cell && !after.cell.empty && after.cell.name === which && (after.out || []).length === 0, { back, ...after, up: after.up.length, basement: after.basement && after.basement.length });
      if (which === 'Hand saw') await shot('openfix-shelf-saw-back');
    }
  }

  // 3b. Museum: a piece taken out is gone from the Museum, its basement gallery and the viewer alike
  if (on('museum')) {
    const r = await W(async () => {
      for (let i = 0; i < 12; i++) state.inventedCreations.unshift({ title: `Openfix study ${i + 1}`, archetype: 'kinetic_spire', colorHex: '#38bdf8', secondaryColorHex: '#f472b6', x: -40, z: -5, inMuseum: true, createdTime: 'On display ' + i });
      if (typeof showMuseumModels === 'function') showMuseumModels(true); else { museumModelsWanted = true; }
      renderMuseum3D();
      const name = 'Openfix study 3';
      const realGo = window.goIndoors; window.goIndoors = async () => true;
      const realWait = window.waitForArrival; window.waitForArrival = async () => true;
      const realTravel = window.travelTo; window.travelTo = async () => true;
      const realDrop = window.dropIntoPit; window.dropIntoPit = async () => true;
      let ok;
      try { state.isBusy = false; state.isPracticing = false; state.isBuilding = false; ok = await takeOutOfMuseum(name, 'dispose', 'test'); } finally { window.goIndoors = realGo; window.waitForArrival = realWait; window.travelTo = realTravel; window.dropIntoPit = realDrop; }
      renderMuseum3D();
      const inList = allMuseumSculptures().some(c => c.title === name);
      const in3d = museumArtGroup.children.some(h => h.visible && h.userData.itemName === name);
      const inViewer = museumViewerItems().some(i => i.name === name);
      let inBasement = false;
      for (let lvl = 1; lvl <= museumBasementLevels(); lvl++) { const g = new THREE.Group(); fillMuseumRoom(g, lvl, -lvl * BASEMENT_LEVEL_DEPTH); g.traverse(o => { if (o.userData && o.userData.itemName === name) inBasement = true; }); }
      const others = museumViewerItems().filter(i => /^Openfix study/.test(i.name)).length;
      return { ok, inList, in3d, inViewer, inBasement, others };
    });
    check('a Museum piece taken out is gone from the Museum, its basement and the viewer; the rest stay', r.ok && !r.inList && !r.in3d && !r.inViewer && !r.inBasement && r.others === 11, r);
  }

  // 4. A letter queued but not yet read survives a reload, and is read once
  if (on('notes')) {
    await W(() => {
      state.isBusy = true; // not read yet
      state.unopenedNotesQueue.length = 0;
      if (typeof queueVisitorNote === 'function') queueVisitorNote({ id: 'parcel:openfix-1', sender: 'Openfix', text: 'Do you like the lake?', timestamp: 'now' });
      else state.unopenedNotesQueue.push({ sender: 'Openfix', text: 'Do you like the lake?', timestamp: 'now' });
      savePersistentBrainStateNow();
    });
    const readBefore = await W(() => (state.readNoteIds || []).includes('parcel:openfix-1'));
    await reload();
    // He may already have read it in the seconds after the reload (his life ticks on): either way it wasn't lost
    const q = await W(() => { state.isBusy = true; return { waiting: state.unopenedNotesQueue.map(n => n.sender + ':' + n.text), read: (state.readNoteIds || []).includes('parcel:openfix-1'), diary: state.diaryEntries.slice(0, 3).map(d => d.time) }; });
    check('a letter waiting to be read survives a reload (still waiting, or read since)', !readBefore && ((q.waiting.length === 1 && /Openfix:Do you like/.test(q.waiting[0])) || (q.waiting.length === 0 && q.read)), q);
    if (q.read) await W(() => { state.unopenedNotesQueue.push({ id: 'parcel:openfix-1', sender: 'Openfix', text: 'Do you like the lake?' }); state.readNoteIds = state.readNoteIds.filter(i => i !== 'parcel:openfix-1'); });
    const read = await W(async () => {
      state.isBusy = false;
      const realDecide = window.decideNextAction, realSynth = window.synthesizeUnboundedExperience, realDirect = window.directKeloToActivity;
      window.decideNextAction = async () => {}; window.synthesizeUnboundedExperience = async () => {}; window.directKeloToActivity = async () => {};
      let reads = 0;
      const realProcess = window.processNextUnopenedVisitorNote;
      try {
        await processNextUnopenedVisitorNote(); reads++;
        const left = state.unopenedNotesQueue.length;
        const giftsBefore = state.giftLog.length;
        // The same letter opened again (say a reload mid mail run left its parcel in the mailbox)
        await openParcel({ id: 'openfix-1', kind: 'message', from: 'Openfix', note: 'Do you like the lake?', time: 'now', name: 'Letter' });
        return { left, again: state.unopenedNotesQueue.length, giftsAdded: state.giftLog.length - giftsBefore, readIds: (state.readNoteIds || []).slice(-3) };
      } finally { window.decideNextAction = realDecide; window.synthesizeUnboundedExperience = realSynth; window.directKeloToActivity = realDirect; }
    });
    check('once read it leaves the queue, and the same letter opened again is not read twice', read.left === 0 && read.again === 0 && read.giftsAdded === 0, read);
    await W(() => savePersistentBrainStateNow());
    await reload();
    const q2 = await W(() => ({ q: state.unopenedNotesQueue.length, ids: (state.readNoteIds || []).length }));
    check('after another reload nothing is waiting (no second read)', q2.q === 0, q2);
    // Bounded
    const b = await W(() => { state.isBusy = true; if (typeof queueVisitorNote !== 'function') return null; for (let i = 0; i < 30; i++) queueVisitorNote({ id: 'parcel:b' + i, sender: 'B', text: 'n' + i }); const n = state.unopenedNotesQueue.length; state.unopenedNotesQueue.length = 0; state.isBusy = false; savePersistentBrainStateNow(); return n; });
    check('the saved queue is bounded', b !== null && b <= 20, b);
  }

  // 5. Settings Save: a new AI decision only when the key set changed
  if (on('settings')) {
    const run = async (gem, contact) => {
      await W(() => { window.__decides = 0; if (!window.__realDecide) { window.__realDecide = window.decideNextAction; window.decideNextAction = async () => { window.__decides++; }; } document.getElementById('btnOpenAIConfig').click(); });
      await page.waitForTimeout(200);
      await W(([gem, contact]) => { document.getElementById('geminiApiKeyInput').value = gem; const c = document.getElementById('shopContactInput'); if (c && contact !== null) { c.value = contact; c.dispatchEvent(new Event('input', { bubbles: true })); c.dispatchEvent(new Event('change', { bubbles: true })); } document.getElementById('btnSaveAIConfig').click(); }, [gem, contact]);
      await page.waitForTimeout(300);
      return W(() => window.__decides);
    };
    const add = await run('test-key-1', null);
    const same = await run('test-key-1', 'shop@example.com');
    const sameAgain = await run('test-key-1', '');
    const changed = await run('test-key-2', null);
    const removed = await run('', null);
    await W(() => { window.decideNextAction = window.__realDecide; delete window.__realDecide; });
    check('Save with a new key starts one AI decision', add === 1, add);
    check('Save with the same key (only the shop contact changed) starts none', same === 0 && sameAgain === 0, { same, sameAgain });
    check('Save with a changed key starts one', changed === 1, changed);
    check('Save with no key starts none', removed === 0, removed);
  }

  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
  if (server) server.close();
  process.exit(fails || errors.length ? 1 : 0);
})();
