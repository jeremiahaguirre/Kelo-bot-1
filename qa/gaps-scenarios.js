// Scenarios for the six owner gaps (branch agent/gaps). Each logs PASS/FAIL lines.
const run = (page, fn, arg) => page.evaluate(fn, arg);
const waitFor = async (page, fn, ms = 300000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await page.waitForTimeout(1500); } return false; };
const check = (name, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`);
const free = page => run(page, () => { state.placesNoticed = Object.assign(state.placesNoticed || {}, { workshop: Date.now(), plant: Date.now() }); state.isBusy = false; state.isBuilding = false; state.isPracticing = false; state.isCollectingMail = false; state.isSleeping = false; state.isBrowsing = false; });

module.exports = {
  // 1. Routable shops: MAKER_CAPS routing, the AI wholeShop check, and a real weld-studio job
  async weldroute({ page, shot, look }) {
    const table = await run(page, () => {
      const cases = [['steel bench', ['steel']], ['steel table', ['steel']], ['nylon hinge', ['nylon']], ['titanium implant', ['titanium']], ['concrete planter', ['concrete']],
        ['concrete bird bath', ['concrete']], ['steel gear', ['steel']], ['trailer hitch', ['steel']], ['stainless impeller', ['stainless']], ['architectural model', ['paper']],
        ['clear prototype', ['resin']], ['steel shed', ['steel']], ['steel bottle opener', ['steel']], ['nylon pedal', ['nylon']], ['stainless flange', ['stainless']], ['steel coat rack', ['steel']]];
      return cases.map(([n, m]) => { const h = makerShopFor(n, m, n); return [n, h ? h.cap.key : null, h ? makerProductName(h.cap, n, h.material) : '']; });
    });
    table.forEach(r => console.log('route', JSON.stringify(r)));
    const want = { 'steel bench': 'weldstudio', 'steel table': 'weldstudio', 'nylon hinge': 'sls', 'titanium implant': 'ebm', 'concrete planter': 'batchplant', 'concrete bird bath': 'batchplant', 'steel gear': 'edm', 'trailer hitch': 'garage', 'stainless impeller': 'dmls', 'architectural model': 'lom', 'clear prototype': 'polyjet', 'steel shed': null, 'nylon pedal': 'mjf', 'stainless flange': 'ded', 'steel coat rack': 'weldstudio' };
    Object.entries(want).forEach(([n, k]) => { const r = table.find(x => x[0] === n); check(`route ${n} -> ${k}`, r && r[1] === k, r && r[1]); });
    const caps = await run(page, () => ['weldstudio', 'batchplant', 'sls', 'mjf', 'dmls', 'polyjet', 'binder', 'ded', 'ebm', 'lom', 'waterjet', 'edm', 'garage'].map(k => [k, Boolean(makerCap(k)), makerShopExists(k), (makerCap(k) || {}).maxCm]));
    check('all 13 new shops have MAKER_CAPS entries', caps.every(c => c[1] && c[2]), JSON.stringify(caps));
    check('old workshopCanMake reader removed', await run(page, () => typeof workshopCanMake === 'undefined' && typeof workshopMakePart === 'undefined'));
    // The AI's wholeShop answer is checked against the shop's forms and the too-big rule
    const ai = await run(page, async () => {
      const keep = [window.hasLLMKey, window.callLLMJSON];
      const tries = [{ noun: 'table', wholeShop: 'fdm', materials: ['plastic'] }, { noun: 'garden shed', wholeShop: 'weldstudio', materials: ['steel'] }, { noun: 'bench', wholeShop: 'weldstudio', materials: ['steel'] }];
      const out = [];
      for (const t of tries) {
        hasLLMKey = () => true; callLLMJSON = async () => t;
        const r = await makerAskAI(t.noun, 'A ' + t.noun + '.');
        out.push([t.noun, t.wholeShop, r && r.whole ? r.whole.shop : null]);
      }
      hasLLMKey = keep[0]; callLLMJSON = keep[1];
      return out;
    });
    console.log('ai', JSON.stringify(ai));
    check('AI wholeShop fdm for a table is rejected', ai[0][2] === null);
    check('AI wholeShop for a shed is rejected (too big)', ai[1][2] === null);
    check('AI wholeShop weldstudio for a bench is kept', ai[2][2] === 'weldstudio');
    // A visitor: "make me a steel bench" goes to the Welding Studio
    const ask = await run(page, () => { const a = parseUseRequest('Kelo, make me a steel bench please'); return a && a.maker; });
    check('"make me a steel bench" parsed as a maker ask', ask && /steel bench/.test(ask.what), JSON.stringify(ask));
    const route = await run(page, async () => { state.isCollectingMail = true; const r = await answerMakerAsk({ what: 'steel bench' }, 'Tester'); const o = makerState().makerOrders[0]; return { r, shop: o && o.shop, name: o && o.name, status: o && o.status, reply: state.speechBubble }; });
    console.log('order', JSON.stringify(route));
    check('steel bench order is on the weld studio', route.r === 'shop' && route.shop === 'weldstudio', route.name);
    // He learns MIG (simulated research) and the supplies arrive through the Post Office (requests then delivery)
    const asked = await run(page, () => {
      state.jobKnowledge = state.jobKnowledge || {}; state.jobKnowledge.weld_mig = { at: Date.now(), from: ['test'] };
      const o = makerState().makerOrders[0]; makerAdvance(o);
      return { status: o.status, waitingFor: o.waitingFor, open: state.requestsToUser.filter(r => !r.fulfilled).map(r => r.requestedGear) };
    });
    console.log('asked', JSON.stringify(asked));
    check('order waits for weld supplies incl. steel stock', asked.status === 'waiting' && asked.waitingFor.some(w => /steel stock/i.test(w)));
    check('steel stock asked at the Post Office', asked.open.some(w => /steel stock/i.test(w)));
    await run(page, async () => {
      const gear = state.requestsToUser.filter(r => !r.fulfilled && /weld|argon|ER70S|steel stock|gloves/i.test(r.requestedGear)).map(r => r.requestedGear);
      for (const g of gear) { state.belongings.unshift({ name: g, category: /hood|gloves/i.test(g) ? 'tool' : 'material', from: 'Tester' }); const r = state.requestsToUser.find(x => x.requestedGear === g); r.fulfilled = true; }
    });
    await free(page);
    await run(page, () => { window.__keloShotHold = 'weld'; const o = makerState().makerOrders[0]; makerAdvance(o); });
    const welding = await waitFor(page, () => /weld/i.test(state.moodTitle) && /Weld/i.test(state.moodTitle + state.speechBubble) && state.isBuilding, 240000);
    check('he goes to weld it', welding, await run(page, () => state.moodTitle));
    const atTable = await waitFor(page, () => window.__keloShotHeld === 'weld' || makerState().makerOrders[0].status === 'done', 1800000);
    if (atTable) {
      await run(page, () => { state.cameraMode = 'none'; camera.position.set(-1.2 + 2.2, 2.0, -8.2 + 2.4); controls.target.set(-1.2, 1.0, -8.4); controls.update(); });
      await page.waitForTimeout(1500);
      await shot('gaps-1-weld-studio-job');
    }
    await run(page, () => { window.__keloShotHold = null; });
    const done = await waitFor(page, () => { const o = makerState().makerOrders[0]; return o && o.status === 'done'; }, 900000);
    const res = await run(page, () => ({ o: makerState().makerOrders[0], own: ownedItemNames().filter(n => /welded steel/i.test(n)), kind: (itemKindOf('A welded steel bench') || {}).kind, stock: ownedItemNames().filter(n => /steel stock/i.test(n)), sup: state.supplies && Object.entries(state.supplies).filter(([k]) => /steel stock/.test(k)) }));
    console.log('result', JSON.stringify(res));
    check('the welded steel bench is made and his own (a real item)', done && res.own.length > 0, res.kind);
  },
// 2. Big builds without an AI key: a plan from the reading, and machine lines on every big-build BOM
  async nokeybuild({ page, shot }) {
    const tpl = await run(page, () => Object.keys(BOM_TEMPLATES).map(k => { const b = bomFromTemplate(k); makerMarkBomLines(b); return [k, b.subs.flatMap(s => s.lines.filter(l => l.make).map(l => `${l.name} -> ${l.makeOn}`))]; }));
    tpl.forEach(t => console.log('template', JSON.stringify(t)));
    check('some template BOM lines are marked for his machines', tpl.some(t => t[1].length > 0));
    check('parseBuildRequest leaves "build me a table" to the woodshop (with a key)', await run(page, () => { const k = hasLLMKey; hasLLMKey = () => true; const r = parseBuildRequest('build me a table'); const u = parseUseRequest('build me a table'); hasLLMKey = k; return r === null && u && u.maker && true; }));
    check('"build me a shed" is still a big build (with a key)', await run(page, () => { const k = hasLLMKey; hasLLMKey = () => true; const r = parseBuildRequest('build me a shed'); hasLLMKey = k; return Boolean(r && r.target); }));
    // No key, no template: a gazebo, planned from the article
    await run(page, () => {
      window.__wiki = wikiSummary;
      wikiSummary = async t => /gazebo/i.test(t) ? { title: 'Gazebo', url: 'https://en.wikipedia.org/wiki/Gazebo', extract: 'A gazebo is a pavilion structure, sometimes octagonal or turret-shaped, often built in a park, garden or spacious public area. Gazebos are freestanding or attached to a garden wall, roofed, and open on all sides; they provide shade and shelter. They are usually built of wood on a concrete base, with a steel bracket at each post.' } : null;
      state.buildProjects = (state.buildProjects || []).filter(p => p.status !== 'gathering' && p.status !== 'testing');
    });
    await free(page);
    const r = await run(page, async () => { state.isBusy = state.isBuilding = state.isPracticing = state.isSleeping = state.isCollectingMail = false; const out = await researchBuild('gazebo', 'Test', 'Test'); const p = state.buildProjects[0]; return { out, name: p && p.bom.name, fromAI: p && p.fromAI, subs: p && p.bom.subs.map(s => `${s.name}: ${s.lines.map(l => `${l.name} x${l.qty}${l.make ? ' [make ' + l.makeOn + ']' : ''}${l.forShop ? ' [supplies for ' + l.forShop + ']' : ''}`).join('; ')}`) }; });
    console.log('gazebo', JSON.stringify(r, null, 1));
    check('no-key gazebo build is planned (not "no-plans")', r.out === true && r.name === 'Gazebo' && !r.fromAI, r.out);
    check('the gazebo BOM has machine lines', r.subs && r.subs.some(x => /\[make /.test(x)));
    check('the gazebo foundation is ready-mix from the batch plant', r.subs && r.subs.some(x => /Ready-mix.*\[make concrete batch plant\]/.test(x)));
    // The list cards in the Post tab, with "I'll make this on the ..." lines
    await run(page, () => {
      const p = state.buildProjects[0];
      const reqs = state.requestsToUser.filter(q => q.category === 'bomlist' && q.listProject === p.id);
      const d = document.createElement('div');
      d.id = '__bomshot';
      d.style.cssText = 'position:fixed;left:10px;top:10px;width:460px;max-height:780px;overflow:auto;z-index:99999;background:#0f172a;padding:10px;border-radius:12px';
      const hasMake = q => (p.bom.subs.find(x => x.key === q.listSub) || { lines: [] }).lines.some(l => l.make || l.forShop);
      d.innerHTML = reqs.filter(hasMake).concat(reqs.filter(q => !hasMake(q))).slice(0, 2).map(q => bomListCardHtml(q)).join('');
      document.body.appendChild(d);
    });
    await page.waitForTimeout(800);
    await shot('gaps-2-nokey-build-machine-lines');
    await run(page, () => { document.getElementById('__bomshot').remove(); wikiSummary = window.__wiki; });
    // An unknown thing with no article at all still gets a plan
    await run(page, () => { state.buildProjects = state.buildProjects.filter(p => p.status !== 'gathering'); });
    await free(page);
    const r2 = await run(page, async () => { state.isBusy = state.isBuilding = state.isPracticing = state.isSleeping = state.isCollectingMail = false; const out = await researchBuild('pedal car', 'Test', 'Test'); const p = state.buildProjects[0]; return { out, subs: p && p.bom.subs.map(s => s.name) }; });
    check('no-key pedal car (no article) is planned from part families', r2.out === true && r2.subs && r2.subs.length >= 2, JSON.stringify(r2));
  },

  // 3. Food: "make me a sandwich" goes to the stove; ingredients via the Post Office; a real food item
  async food({ page, shot }) {
    const parsed = await run(page, () => ['make me a sandwich', 'Could you make me a lemonade please', 'cook us pancakes', 'make me a steel bench', 'make me a stool'].map(m => { const a = parseUseRequest(m); return [m, a && a.food ? 'food' : a && a.maker ? 'maker' : 'other']; }));
    console.log('parsed', JSON.stringify(parsed));
    check('sandwich, lemonade and pancakes go to food; bench and stool to the maker', parsed.map(x => x[1]).join() === 'food,food,food,maker,maker');
    const r = await run(page, async () => { state.isCollectingMail = true; const a = parseUseRequest('make me a sandwich'); const out = await answerUseRequest(a, 'Tester'); const o = state.foodOrders[0]; return { out, o, open: state.requestsToUser.filter(q => !q.fulfilled && q.category === 'ingredient').map(q => q.requestedGear), shop: makerState().makerOrders.some(m => /sandwich/i.test(m.noun)), reply: state.speechBubble }; });
    console.log('order', JSON.stringify(r));
    check('sandwich order is a food order, not a shop order', r.out === 'food' && r.o && /sandwich/.test(r.o.dish) && !r.shop);
    check('ingredients asked at the Post Office', r.open.length >= 3, r.open.join(' | '));
    // The ingredients arrive (the first through receiveItem, the real delivery path): not eaten on arrival
    const got = await run(page, async () => {
      const asks = state.requestsToUser.filter(q => !q.fulfilled && q.category === 'ingredient').map(q => q.requestedGear);
      const full0 = state.fullness;
      await receiveItem(asks[0], 'food', 'Tester');
      asks.slice(1).forEach(a => state.belongings.unshift({ name: a, category: 'ingredient', from: 'Tester' }));
      state.requestsToUser.forEach(q => { if (asks.includes(q.requestedGear)) q.fulfilled = true; });
      return { first: asks[0], kept: ownedItemNames().includes(asks[0]), cat: (state.belongings.find(b => b.name === asks[0]) || {}).category, snack: storedFoodName() };
    });
    console.log('arrived', JSON.stringify(got));
    check('a delivered ingredient is kept for the order (not eaten)', got.kept && got.cat === 'ingredient', got.cat);
    check('reserved ingredients are not picked as a snack', !got.snack || !/bread|cheese|ham|lettuce|mustard/i.test(got.snack), got.snack);
    await free(page);
    await run(page, () => { window.__keloShotHold = 'cook'; state.isBusy = false; foodTick(); });
    const cooking = await waitFor(page, () => window.__keloShotHeld === 'cook', 400000);
    if (cooking) {
      await run(page, () => { state.cameraMode = 'none'; const s = PASTIME_SPOTS.stove; camera.position.set(s.x + 3.6, 2.2, s.z + 2.4); controls.target.set(s.x + 0.6, 0.9, s.z); controls.update(); });
      await page.waitForTimeout(1500);
      await shot('gaps-3-sandwich-at-stove');
    }
    await run(page, () => { window.__keloShotHold = null; });
    const done = await waitFor(page, () => state.foodOrders[0].status === 'done', 240000);
    const res = await run(page, () => { const o = state.foodOrders[0]; const b = state.belongings.find(x => x.name === o.madeName); return { o, b, kind: (itemKindOf(o.madeName) || {}).kind, left: o.ingredients.filter(i => { const n = foodIngredientOwned(i); if (!n) return false; const sp = state.supplies[n.toLowerCase()]; return !(sp && sp.cur < sp.per); }).length, chat: state.chatLog.slice(-1)[0].text }; });
    console.log('made', JSON.stringify(res));
    check('the sandwich is made and is a real food item', done && res.b && res.b.category === 'food' && res.kind === 'food', res.o.madeName);
    check('each ingredient was used (gone, or one serving less)', res.left === 0, res.left);
  },

  // 4. Concrete foundations: ready-mix batched at his plant, poured at the site, cured before building on it
  async foundation({ page, shot }) {
    const setup = await run(page, () => {
      ASSEMBLY_PACE = 0.3; plantTimeScale = 0.25; window.__keloShotHold = 'pour';
      state.buildProjects = (state.buildProjects || []).filter(p => p.status !== 'gathering' && p.status !== 'testing');
      const bom = bomFromTemplate('shed'); makerMarkBomLines(bom);
      const p = { id: 'build-shedtest', target: 'shed', why: 'Test', status: 'gathering', startedAt: Date.now(), fromAI: false, bom, readings: [], tests: {}, parcels: 0, site: null };
      state.buildProjects.unshift(p); siteFor(p);
      // He knows the plant and the pour; the plant is stocked; a mixer truck with fuel; the build's tools
      state.jobKnowledge = state.jobKnowledge || {}; ['batchPlant', 'concretePour'].forEach(k => { state.jobKnowledge[k] = { at: Date.now(), from: ['test'] }; });
      ['A slump cone test kit', 'A sturdy shovel', 'A set of concrete form boards and stakes', 'A concrete screed board and bull float', 'Concrete mixer truck'].forEach(n => state.toolInventory.push(n));
      registerVehicle('Concrete mixer truck');
      state.knowHow = state.knowHow || {}; state.knowHow.mixer = { at: 1 };
      const v = findVehicle('mixer'); if (v) v.fuel = 100;
      ensureAggregatePlantState(); const st = plantStateOf('batch').stock; st.cement = 10; st.sand = 20; st.stone = 20; st.water = 8000;
      bom.tools.forEach(t => state.toolInventory.push(t.name));
      const f = bom.subs[0];
      f.lines.forEach(l => { if (!l.make) l.got = l.qty; });
      return { mix: f.lines.find(l => /ready-mix/i.test(l.name)), site: p.site, tools: bom.tools.map(t => t.name) };
    });
    console.log('setup', JSON.stringify(setup));
    check('the shed footing ready-mix line is made on the batch plant', setup.mix && setup.mix.make === 'batchplant', setup.mix && setup.mix.makeOn);
    await free(page);
    const batched = await waitFor(page, () => { const l = state.buildProjects[0].bom.subs[0].lines.find(x => /ready-mix/i.test(x.name)); return l.got >= l.qty && plantStateOf('batch').batches >= 1; }, 400000);
    check('he batched the ready-mix at his own plant', batched, await run(page, () => `${state.moodTitle} | ${plantStateOf('batch').batches} batches`));
    // His own build tick may already be pouring: only start it if nothing is running (never clear his flags mid-job)
    await waitFor(page, () => assemblyJobRunning || !state.isPracticing, 300000);
    const startPour = await run(page, () => { window.__keloShotHold = 'pour'; if (assemblyJobRunning) return 'already pouring'; state.isBusy = state.isBuilding = state.isPracticing = state.isCollectingMail = false; const p = state.buildProjects[0]; buildNextSubAssembly(p.id, 'Test'); return 'started'; });
    console.log('pour', startPour);
    const pouring = await waitFor(page, () => window.__keloShotHeld === 'pour', 600000);
    if (pouring) {
      await page.waitForTimeout(2500);
      await run(page, () => { const c = state.concretePours.find(x => x.forBuild === 'build-shedtest'); const cal = ensureCalendar(); cal.startHour += 13 - worldNow().hour; state.cameraMode = 'none'; const mx = (c.x + c.toX) / 2, mz = (c.z + c.toZ) / 2, gy = getAnalyticalGroundHeight(mx, mz); camera.position.set(mx + 3.2, gy + 4.2, mz + 4.6); controls.target.set(mx, gy + 0.2, mz); controls.update(); });
      await page.waitForTimeout(4000);
      await shot('gaps-4-foundation-pour');
    }
    await run(page, () => { window.__keloShotHold = null; });
    const poured = await waitFor(page, () => state.buildProjects[0].bom.subs[0].built, 900000);
    const after = await run(page, () => { const p = state.buildProjects[0]; const c = state.concretePours.find(x => x.forBuild === p.id); return { pour: c && { stage: c.stage, kind: c.kind, w: c.w }, mixLeft: Boolean(readyMixName()), sub0: p.bom.subs[0].pourId === (c && c.id) }; });
    console.log('poured', JSON.stringify(after));
    check('the footings were poured visibly at the site and are curing', poured && after.pour && after.pour.stage === 'curing' && after.sub0 && !after.mixLeft, JSON.stringify(after.pour));
    // The floor waits for the cure
    const wait = await run(page, () => { const p = state.buildProjects[0]; p.bom.subs[1].lines.forEach(l => { l.got = l.qty; }); state.isBusy = state.isBuilding = state.isPracticing = state.isCollectingMail = false; return buildNextSubAssembly(p.id, 'Test'); });
    check('nothing is built on it while it cures', wait === 'curing', String(wait));
    const cured = await run(page, () => { const c = state.concretePours.find(x => x.forBuild === 'build-shedtest'); c.pouredAt -= (CONCRETE_CURE_DAYS + 0.5) * WORLD_DAY_MS; plantTimeTick(); return c.stage; });
    check('after 7 days the pour is cured', cured === 'cured', cured);
    await free(page);
    const go = await run(page, async () => { const p = state.buildProjects[0]; return await buildNextSubAssembly(p.id, 'Test'); });
    check('the floor is built once the footings have cured', go === true, String(go));
    // A reload keeps the pour and the build
    await run(page, () => savePersistentBrainState());
  },

  // 5. Supplies rule: upgrades and photo welds order their materials through the Post Office
  async supplies({ page, shot }) {
    const r = await run(page, async () => {
      state.worldUpgrades = []; state.upgradePlans = []; state.lastUpgradeAt = 0;
      const t = UPGRADE_TEMPLATES.find(x => x.key === 'fountain') || UPGRADE_TEMPLATES[0];
      state.isBusy = state.isPracticing = state.isBuilding = state.isCollectingMail = false;
      const out = await codeAnUpgrade('Test', t.build());
      return { out, plans: state.upgradePlans.map(p => ({ name: p.code.name, mats: p.mats.map(m => m.ask) })), built: state.worldUpgrades.length, open: state.requestsToUser.filter(q => !q.fulfilled).map(q => q.requestedGear) };
    });
    console.log('upgrade', JSON.stringify(r));
    check('a coded upgrade is not built from nothing', r.out === 'needs-materials' && r.built === 0);
    check('its materials are asked at the Post Office', r.plans[0] && r.plans[0].mats.every(m => r.open.includes(m)), r.plans[0] && r.plans[0].mats.join(' | '));
    const mats = r.plans[0].mats;
    await run(page, m => { m.forEach(a => state.belongings.unshift({ name: a, category: 'material', from: 'Tester' })); state.requestsToUser.forEach(q => { if (m.includes(q.requestedGear)) q.fulfilled = true; }); }, mats);
    await free(page);
    const built = await run(page, async () => { state.isBusy = state.isBuilding = state.isPracticing = state.isSleeping = state.isCollectingMail = false; const pl = state.upgradePlans[0]; if (!pl) return 'no plan (already built by his own tick?)'; return await buildPlannedUpgrade(pl.id, 'Test'); });
    console.log('build returned', built);
    if (built !== true) await waitFor(page, () => (state.worldUpgrades || []).length === 1 && !upgradeSessionRunning, 180000);
    const res = await run(page, m => ({ ups: state.worldUpgrades.map(u => ({ name: u.name, materials: u.materials })), left: m.filter(a => ownedItemNames().includes(a) && !(isConsumableItem(a) && state.supplies[a.toLowerCase()] && state.supplies[a.toLowerCase()].cur < state.supplies[a.toLowerCase()].per)) }), mats);
    console.log('built', JSON.stringify(res));
    check('the upgrade is built once its materials come, and they are used (boxes of screws lose a serving)', res.ups.length === 1 && res.left.length === 0, JSON.stringify(res.left));
    // Templates for fence, path and lamps all carry materials
    const all = await run(page, () => UPGRADE_TEMPLATES.map(t => { const c = validateWorldUpgrade(t.build()); return [t.key, c.ok ? upgradeMaterialsFor(c.code).map(m => m.ask) : 'invalid']; }));
    all.forEach(a => console.log('mats', JSON.stringify(a)));
    check('every built-in upgrade template needs real materials', all.filter(a => a[0] !== 'routine').every(a => Array.isArray(a[1]) && a[1].length > 0));
    // A photo weld: the weld plan needs steel stock; without it the weld waits and asks
    const w = await run(page, () => {
      state.jobKnowledge = state.jobKnowledge || {}; state.jobKnowledge.weld_mig = { at: Date.now(), from: ['test'] };
      ['A welding hood with an auto-darkening lens', 'A pair of leather welding gloves', 'A 75/25 argon-CO2 shielding gas cylinder', 'A spool of ER70S-6 MIG wire (0.030 inch)'].forEach(n => state.belongings.unshift({ name: n, category: 'material' }));
      state.belongings = state.belongings.filter(b => !/steel stock/i.test(b.name));
      const creation = { title: 'Photo sculpture', x: 0, z: 0 };
      weldAskedAt = 0;
      const ready = weldingReady(creation, 'Image-Inspired 3D Weld');
      return { ready, missing: missingForJob(weldPlanFor(creation).key).map(m => m.ask), open: state.requestsToUser.filter(q => !q.fulfilled).map(q => q.requestedGear) };
    });
    console.log('photo weld', JSON.stringify(w));
    check('a photo weld waits for steel stock and asks for it', w.ready === false && w.missing.some(m => /steel stock/i.test(m)) && w.open.some(m => /steel stock/i.test(m)));
    const w2 = await run(page, () => { state.belongings.unshift({ name: 'A bundle of mild steel stock (square tube, angle, flat bar and plate)', category: 'material' }); const plan = weldPlanFor({ title: 'x' }); const ready = weldingReady({ title: 'x' }); useWeldSupplies(plan); return { ready, sup: state.supplies['a bundle of mild steel stock (square tube, angle, flat bar and plate)'] }; });
    check('with steel stock it welds, and a weld uses some stock', w2.ready === true && w2.sup && w2.sup.cur < w2.sup.per, JSON.stringify(w2));
  },

  // 6. A visitor's painting is painted once
  async paintonce({ page }) {
    const r = await run(page, async () => {
      state.murals = state.murals || [];
      const before = state.murals.length;
      // He knows watercolour and has the supplies (no trips to learn or ask)
      const M = PAINT_MEDIA.watercolour;
      state.paintKnowledge = state.paintKnowledge || {}; state.paintKnowledge.watercolour = { at: Date.now(), from: ['test'] };
      M.needs.forEach(n => state.belongings.unshift({ name: n.ask, category: 'material', from: 'test' }));
      state.isBusy = state.isPracticing = state.isBuilding = state.isCollectingMail = state.isSleeping = false;
      answerPaintRequest({ medium: 'watercolour', subject: 'lake', overrides: {} }, 'Tester');
      // Both paths fire: the life tick's paintPlanTick and the free queue
      paintPlanTick();
      return { before, plan: state.paintPlan };
    });
    console.log('asked', JSON.stringify(r));
    await waitFor(page, () => !state.paintPlan && !paintSessionRunning, 600000);
    await page.waitForTimeout(40000);   // the free-queue job would fire in this window
    const res = await run(page, b => ({ n: state.murals.length - b, plan: state.paintPlan, forTester: state.murals.filter(m => m.for === 'Tester').length }), r.before);
    console.log('painted', JSON.stringify(res));
    check('the visitor painting was painted exactly once', res.n === 1 && res.forTester === 1 && !res.plan, JSON.stringify(res));
  }
};
// (camera helper used above in a try; the evaluate below sets it properly)
function TOWN_LOCATIONS_W() { return { x: -1.2, z: -8.2 }; }
// Instanced meshes inside a group are filed in the right chunk (a pour away from the origin is drawn):
// blue = instanced in the scene, yellow = instanced inside concretePourGroup, red = a plain mesh
module.exports.pourchunk = async ({ page, shot }) => {
  const r = await page.evaluate(() => {
    const x = -41, z = -3, gy = getAnalyticalGroundHeight(x, z);
    const o = new THREE.Object3D(); o.position.set(x, gy + 0.5, z);
    const im = perfInstances(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x0000ff }), [o]); scene.add(im);
    const g = new THREE.Group(); const o2 = new THREE.Object3D(); o2.position.set(x + 2, gy + 0.5, z); g.add(perfInstances(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffff00 }), [o2])); concretePourGroup.add(g);
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xff0000 })); m.position.set(x - 2, gy + 0.5, z); scene.add(m);
    const cal = ensureCalendar(); cal.startHour += 13 - worldNow().hour;
    state.isPracticing = true; state.cameraMode = 'none'; camera.position.set(x, gy + 4, z + 7); controls.target.set(x, gy, z); controls.update();
    return { renderer: renderer.info.render, onBR: typeof scene.onBeforeRender };
  });
  console.log('pourchunk', JSON.stringify(r));
  await page.waitForTimeout(3000);
  await shot('gaps-pourchunk');
};
