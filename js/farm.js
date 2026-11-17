// Kelo-bot-1 — js/farm.js
// Loaded after farmmodels.js. Kelo-1's mechanized grain farm (stage 1): he plans it as one long
// project on his agenda ("Build the farm": research, survey, the land, eight buildings, the machines,
// the inputs, the first season), works on it over many world days, and writes about it in his diary.
// Then every year a season task: plough -> disc -> fertilize -> seed -> spray -> grow -> harvest ->
// dry and store -> sell and mill. Everything he uses comes through the Post Office on real parts
// lists (the roadworks list card, js/roadworks.js), machines run on diesel from the farm's own tank,
// grain sells at the farm stand and on his website (js/shopkeeping.js) and wheat mills into flour he
// cooks with (js/pastimes.js).
// The data model and the crop simulation are in js/farmdata.js, the land in js/farmland.js, the
// models in js/farmmodels.js. Tests: window.farmFastFactor > 1 drives only every Nth pass and
// shortens his pauses; farmFastForward(days) moves the calendar (and the concrete) forward.

// --- What he learns, drives and asks for -------------------------------------------------------------
if (typeof GROUND_JOBS !== 'undefined') {
  GROUND_JOBS.farming = {
    title: 'running a mechanized grain farm', wiki: ['Agriculture', 'Crop rotation', 'Combine harvester', 'Grain drying'],
    learned: 'A grain farm turns on the seasons: plough and work the ground in spring, seed in the planting window, keep weeds and insects down, then combine when the grain is dry enough, dry it to a safe moisture and store it in aerated bins. Rotating wheat, canola and corn keeps the soil and the yields up.',
    tools: [], materials: []
  };
}
if (typeof GEAR_KNOWHOW !== 'undefined') {
  [['farmtractor', FARM_MACHINES.tractor, 'a tractor', 'Tractor', 'Start it in neutral, lower the hitch to the implement, raise it at each headland and turn wide; let the PTO spool up before engaging.'],
   ['farmbigtractor', FARM_MACHINES.bigtractor, 'a 4WD tractor', 'Tractor', 'It steers by bending in the middle: wide turns, the duals spread the weight so it does not pack the soil.'],
   ['combine', FARM_MACHINES.combine, 'a combine harvester', 'Combine harvester', 'Header just above the ground, reel a little faster than the ground speed, watch the grain loss monitor and unload before the tank is full.'],
   ['graintruck', FARM_MACHINES.truck, 'a grain truck', 'Truck', 'Roll the tarp back, back up to the auger hopper, open the gate and lift the box slowly.']]
    .forEach(([key, m, label, wiki, how]) => { if (!GEAR_KNOWHOW.some(r => r.key === key)) GEAR_KNOWHOW.unshift({ key, re: m.re, label, wiki, how, fuel: 'diesel' }); });
}
if (typeof VEHICLE_TYPES !== 'undefined') {
  VEHICLE_TYPES.unshift(
    { kind: 'farmbigtractor', re: FARM_MACHINES.bigtractor.re, mode: 'land', speed: FARM_MACHINES.bigtractor.speed, scale: 1, seatY: 2.5 },
    { kind: 'farmtractor', re: FARM_MACHINES.tractor.re, mode: 'land', speed: FARM_MACHINES.tractor.speed, scale: 1, seatY: 2.2 },
    { kind: 'combine', re: FARM_MACHINES.combine.re, mode: 'land', speed: FARM_MACHINES.combine.speed, scale: 1, seatY: 4 },
    { kind: 'graintruck', re: FARM_MACHINES.truck.re, mode: 'land', speed: FARM_MACHINES.truck.speed, scale: 1, seatY: 1.8 }
  );
}
if (typeof VEHICLE_KIND_WORDS !== 'undefined') Object.assign(VEHICLE_KIND_WORDS, { farmtractor: 'tractor', farmbigtractor: '4WD tractor', combine: 'combine harvester', graintruck: 'grain truck' });
if (typeof VEHICLE_TERRAIN !== 'undefined') Object.assign(VEHICLE_TERRAIN, {
  farmtractor: { max: 0.55, road: 0.6, text: 'fields, farm roads and the lane; slow on the road' },
  farmbigtractor: { max: 0.55, road: 0.6, text: 'fields and the lane; too wide for town' },
  combine: { max: 0.4, road: 0.5, text: 'fields and the farm roads; header off on the lane' },
  graintruck: { max: 0.45, road: 0.6, text: 'roads, the lane and the farm yard' }
});
const FARM_VEHICLE_KINDS = new Set(['farmtractor', 'farmbigtractor', 'combine', 'graintruck']);
function farmMachineOf(key) { const M = FARM_MACHINES[key]; return M ? state.vehicles.find(v => M.re.test(v.name)) || null : null; }
function farmMachineSpec(v) { return Object.values(FARM_MACHINES).find(M => M.re.test(v.name)) || null; }
// Farm machines park in the machine shed (outside it until it is built); road machines working on
// the farm keep their own slots by the plant
function farmParkingSlots() {
      if (!farmSite()) return null;
      const r = farmBuildingRect('shed'), done = (farmState().buildings.shed || {}).stage === 'done';
      const xs = [-16.5, -6, 6, 16.5].map(m => r.x + m * FARM_U * (farmSite().id === 'west' ? -1 : 1));
      const z = done ? r.z + 2.2 * FARM_U : r.z + r.hd + 7 * FARM_U;
      return xs.map(x => [x, z]);
    }
if (typeof parkingSlotsFor === 'function') {
  const farmOrigSlots = parkingSlotsFor;
  parkingSlotsFor = function (type, name = '') {
      if (type && FARM_VEHICLE_KINDS.has(type.kind)) { const s = farmParkingSlots(); if (s) return s; }
      return farmOrigSlots(type, name);
    };
}
// Fuel: farm machines are measured in litres an hour, not percent per unit (js/knowhow.js burnFuel)
function farmBurnLitres(v, litres) {
      const M = farmMachineSpec(v), tank = M ? M.tankL : 400;
      v.fuel = Math.max(0, Math.round((fuelLeft(v) - litres / tank * 100) * 10) / 10);
    }
if (typeof burnFuel === 'function') {
  const farmOrigBurn = burnFuel;
  burnFuel = function (v, distance) {
      // on the farm (and its lane) every machine burns by the hour: about 0.8 L a kilometre at road speed
      if (v && (farmMachineSpec(v) || (farmJobActive && farmInArea(v.x, v.z, 40)))) { farmBurnLitres(v, Math.max(0, distance) / FARM_U / 1000 * 0.8); return; }
      return farmOrigBurn(v, distance);
    };
}

// --- Saying and writing ----------------------------------------------------------------------------
function farmFastK() { return Math.max(1, Number(window.farmFastFactor) || 1); }
function farmPause(ms) { return new Promise(r => setTimeout(r, Math.max(60, ms / farmFastK()))); }
function farmSay(title, emoji, speech) {
      state.currentLocKey = 'custom';
      state.customPlaceName = 'his farm';
      state.moodEmoji = emoji || '🌾';
      state.moodTitle = String(title).slice(0, 80);
      if (speech) state.speechBubble = String(speech).slice(0, 400);
      if (typeof renderAllUI === 'function') renderAllUI();
    }
function farmDiary(title, emoji, text) {
      state.diaryEntries.unshift({ time: 'On His Farm', location: 'his farm', mood: `${emoji || '🌾'} ${title}`.slice(0, 80),
        vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '', text: `Dear Diary, ${text}`.slice(0, 600) });
      farmLog(title);
      savePersistentBrainState();
    }
function farmPlain(s) { return String(s || '').replace(/^(an?|the)\s+/i, ''); }

// --- Moving about ------------------------------------------------------------------------------------
// He walks (or rides) to a spot and waits until he is there (long trips: up to `ms`)
async function farmGo(target, ms = 240000) {
      state.targetPos = { x: target.x, z: target.z };
      const t0 = Date.now();
      let last = { ...state.botPos }, still = Date.now();
      while (Date.now() - t0 < ms) {
        const d = Math.hypot(state.targetPos.x - state.botPos.x, state.targetPos.z - state.botPos.z);
        const near = Math.max(0.7, typeof arrivalRadius === 'function' ? arrivalRadius(state.targetPos) + 0.2 : 0.7);
        if (d < near) return true;
        if (Math.hypot(state.botPos.x - last.x, state.botPos.z - last.z) > 0.5) { last = { ...state.botPos }; still = Date.now(); }
        else if (Date.now() - still > 25000) return false;   // stuck: the step tries again later
        await new Promise(r => setTimeout(r, 250));
      }
      return false;
    }
// Into the seat of a machine (walking to it first) and out again
async function farmBoard(v) {
      if (state.riding === v.id) return true;
      if (state.riding) farmUnboard(state.vehicles.find(x => x.id === state.riding));
      await farmGo(boardingSpot(v), 300000);
      const type = vehicleTypeFor(v.name);
      state.riding = v.id; state.ridingSpeed = type.speed; state.ridingMode = type.mode;
      state.botPos = { x: v.x, z: v.z }; state.targetPos = { ...state.botPos };
      state.botRotY = (v.rotY || 0) + Math.PI / 2;
      if (typeof keloMotion !== 'undefined' && keloMotion) keloMotion.heading = state.botRotY;
      return true;
    }
function farmUnboard(v) {
      if (!v || state.riding !== v.id) return;
      v.x = Math.round(state.botPos.x * 10) / 10; v.z = Math.round(state.botPos.z * 10) / 10; v.rotY = state.botRotY - Math.PI / 2;
      state.riding = null; state.ridingSpeed = 1; state.ridingMode = null;
      if (typeof renderVehicles3D === 'function') renderVehicles3D();
      state.botPos = boardingSpot(v); state.targetPos = { ...state.botPos };
    }
async function farmDrive(v, target, speedK = 1, ms = 300000) {
      await farmBoard(v);
      const type = vehicleTypeFor(v.name);
      state.ridingSpeed = type.speed * speedK * Math.min(3, farmFastK());
      const from = { ...state.botPos };
      const ok = await farmGo(target, ms);
      const dist = Math.hypot(state.botPos.x - from.x, state.botPos.z - from.z);
      v.x = state.botPos.x; v.z = state.botPos.z; v.rotY = state.botRotY - Math.PI / 2;
      if (typeof burnFuel === 'function') burnFuel(v, dist);
      return ok;
    }
// Park a farm machine in its slot in the shed and climb out
async function farmPark(v) {
      if (!v) return;
      const slots = parkingSlotsFor(vehicleTypeFor(v.name), v.name), i = Math.max(0, state.vehicles.filter(x => FARM_VEHICLE_KINDS.has((vehicleTypeFor(x.name) || {}).kind)).indexOf(v));
      const s = slots[i % slots.length];
      await farmDrive(v, { x: s[0], z: s[1] });
      farmUnboard(v);
    }
// Ready to go: know-how, and diesel (filled at the farm's own tank when it is there)
async function farmFuelUp(v) {
      if (!v) return false;
      const rule = knowHowRule(v.name);
      if (rule && !state.knowHow[rule.key]) { readyToOperate(v.name, v); farmFuelUp.why = { type: 'skill', label: `learning to drive the ${farmPlain(v.name).replace(/ with .*$/, '')}` }; return false; }
      farmFuelUp.why = null;
      if (fuelLeft(v) > 35) return true;
      const tank = farmState().buildings.fueltank;
      const M = farmMachineSpec(v), tankL = M ? M.tankL : 400, needL = Math.round((100 - fuelLeft(v)) / 100 * tankL);
      if (tank && tank.stage === 'done' && farmStock('diesel') >= Math.min(needL, 40)) {
        const r = farmBuildingRect('fueltank'), spot = { x: r.x + r.hw + 3.5, z: r.z + 1 };
        await farmDrive(v, spot);
        farmSay(`Fuelling the ${farmPlain(v.name).replace(/ with .*$/, '')}`, '⛽', `Nozzle in, ${needL} L of diesel from the farm tank.`);
        await farmPause(3500);
        const got = farmUse('diesel', needL);
        v.fuel = Math.min(100, Math.round((fuelLeft(v) + got / tankL * 100) * 10) / 10);
        farmLog(`Fuelled ${farmPlain(v.name)}: ${Math.round(got)} L`);
        return v.fuel > 5;
      }
      if (fuelLeft(v) > 5) return true;
      if (typeof requestFuel === 'function') requestFuel('diesel', `The ${farmPlain(v.name)} is out of diesel and the farm tank is ${tank && tank.stage === 'done' ? 'empty' : 'not set up yet'}.`);
      return false;
    }

// --- The implements: parked in a row by the shed, or on the hitch -----------------------------------
const farmImplMeshes = {};
function farmImplParkSpot(key) {
      const keys = Object.keys(FARM_IMPLEMENTS).filter(k => k !== 'mill' && k !== 'header');
      const i = Math.max(0, keys.indexOf(key)), r = farmBuildingRect('shed'), s = farmSite().id === 'west' ? -1 : 1;
      return { x: r.x - s * (r.hw + 4 * FARM_U) - s * 0, z: r.z - r.hd + 2 * FARM_U + i * 3.4 * FARM_U, rot: 0 };
    }
function farmRenderImplements() {
      const F = farmState();
      Object.keys(FARM_IMPLEMENTS).forEach(key => {
        const owned = Boolean(F.owned[key]);
        let m = farmImplMeshes[key];
        if (!owned) { if (m) { farmGroup.remove(m); delete farmImplMeshes[key]; } return; }
        if (!m) {
          m = farmImplementModel(key);
          m.name = 'farmImpl:' + key;
          if (typeof chunkDynamic !== 'undefined') chunkDynamic.add(m);
          farmGroup.add(m);
          farmImplMeshes[key] = m;
        }
        if (key === 'mill') {
          const w = farmBuildingRect('workshop');
          m.position.set(w.x + 2.2 * FARM_U, getAnalyticalGroundHeight(w.x, w.z) + 0.25, w.z - 2 * FARM_U);
          return;
        }
        if (F.hitch && F.hitch.impl === key) return;   // the frame hook places it
        if (key === 'header' && farmMachineOf('combine') && F.headerOn) return;
        const p = farmImplParkSpot(key);
        m.position.set(p.x, getAnalyticalGroundHeight(p.x, p.z), p.z);
        m.rotation.set(0, Math.PI / 2, 0);
      });
    }
// Each frame: the hitched implement follows the tractor (the header rides on the combine), and its
// parts move while it works
const farmImplState = { working: null, lastPos: null, yaw: 0 };
function farmImplFrame(now) {
      const F = state.farm;
      if (!F || !farmGroup) return;
      const place = (key, vid, anchorKey) => {
        const m = farmImplMeshes[key], vm = typeof vehicleMeshes !== 'undefined' ? vehicleMeshes[vid] : null;
        if (!m || !vm) return;
        const anchor = vm.userData[anchorKey];
        if (!anchor) return;
        vm.updateMatrixWorld(true);
        const p = anchor.getWorldPosition(new THREE.Vector3());
        const yaw = vm.rotation.y;
        m.position.set(p.x, getAnalyticalGroundHeight(p.x, p.z), p.z);
        m.rotation.set(0, yaw + (anchorKey === 'hitch' ? 0 : 0), 0);
        const last = farmImplState.lastPos, d = last ? Math.hypot(p.x - last.x, p.z - last.z) : 0;
        farmImplState.lastPos = { x: p.x, z: p.z };
        const work = farmImplState.working === key;
        const U = m.userData;
        (U.discs || []).forEach(g => { g.rotation.z -= d / (0.3 * FARM_U); });
        (U.wheels || []).forEach(w => { w.rotation.z -= d / 0.56; });
        m.traverse(o => { if (o.userData.wheelRadius) o.rotation.z -= d / o.userData.wheelRadius; });
        (U.spinners || []).forEach(s => { s.rotation.y += (work ? 0.6 : 0) * s.userData.spinY; });
        if (U.reel) U.reel.rotation.z -= work ? 0.08 : 0.01;
        if (U.fan) U.fan.rotation.y += work ? 0.5 : 0;
        if (U.booms) U.booms.forEach(b => { const want = work ? 0 : -b.userData.fold.side * Math.PI / 2 * 0.98; b.rotation.y += (want - b.rotation.y) * 0.04; });
        if (U.mist) U.mist.visible = work;
      };
      if (F.hitch) place(F.hitch.impl, F.hitch.vid, 'hitch');
      if (F.headerOn) { const c = farmMachineOf('combine'); if (c) place('header', c.id, 'front'); }
      // the combine's unloading auger swings out while it unloads
      const c = farmMachineOf('combine'), cm = c && typeof vehicleMeshes !== 'undefined' ? vehicleMeshes[c.id] : null;
      if (cm && cm.userData.auger) { const want = F.unloading ? cm.userData.auger.userData.swing.out : 0; cm.userData.auger.rotation.y += (want - cm.userData.auger.rotation.y) * 0.05; }
      if (cm && cm.userData.grainMesh) { const t = Math.min(1, (F.combineT || 0) / 8); cm.userData.grainMesh.visible = t > 0.02; cm.userData.grainMesh.scale.y = Math.max(0.01, t); }
      const cart = farmImplMeshes.cart;
      if (cart) { cart.userData.grainMesh.visible = (F.cartT || 0) > 0.1; cart.userData.auger.rotation.z += ((F.cartUnloading ? -0.6 : 0.25) - cart.userData.auger.rotation.z) * 0.05; }
      const tr = farmMachineOf('truck'), tm = tr && typeof vehicleMeshes !== 'undefined' ? vehicleMeshes[tr.id] : null;
      if (tm && tm.userData.grainMesh) { tm.userData.grainMesh.visible = (F.truckT || 0) > 0.1; tm.userData.grainMesh.scale.y = Math.max(0.01, Math.min(1, (F.truckT || 0) / 14)); }
      // the dryer's burner glows while it runs
      const dry = farmBuildingMeshes.dryer;
      if (dry && dry.userData.flame) dry.userData.flame.visible = Boolean(F.drying);
    }
async function farmHitch(v, key) {
      const F = farmState();
      if (F.hitch && F.hitch.impl === key && F.hitch.vid === v.id) return true;
      if (F.hitch) await farmUnhitch();
      const p = farmImplParkSpot(key);
      // back up to it
      await farmDrive(v, { x: p.x + (farmSite().id === 'west' ? -1 : 1) * 6.5, z: p.z });
      farmSay(`Hitching the ${FARM_IMPLEMENTS[key].label.toLowerCase()}`, '🔗', 'Lower the arms, pin the hitch, lock the top link, hoses and the PTO shaft on.');
      await farmPause(2500);
      F.hitch = { vid: v.id, impl: key };
      return true;
    }
async function farmUnhitch() {
      const F = farmState();
      if (!F.hitch) return;
      const v = state.vehicles.find(x => x.id === F.hitch.vid), key = F.hitch.impl;
      if (v) { const p = farmImplParkSpot(key); await farmDrive(v, { x: p.x + (farmSite().id === 'west' ? -1 : 1) * 6.5, z: p.z }); }
      F.hitch = null;
      farmImplState.working = null;
      farmRenderImplements();
    }

// --- Parts lists through the Post Office (the roadworks list card) ----------------------------------
// A farm list is a 'joblist' request with farm: true. Its lines: { id, fk: 'supply'|'machine'|'impl'|
// 'part'|'rw'|'tool', key, b (building), name, qty, unit, kind, why }
function farmLineGot(l) {
      const F = farmState();
      if (l.fk === 'supply' || l.fk === 'part') return Math.min(l.qty, l.got || 0);
      if (l.fk === 'machine') return farmMachineOf(l.key) ? 1 : 0;
      if (l.fk === 'impl') return F.owned[l.key] ? 1 : 0;
      if (l.fk === 'rw') return typeof rwGearOwned === 'function' && rwGearOwned(l.key) ? 1 : 0;
      if (l.fk === 'tool') return hasItem(new RegExp(l.re || escapeRegExp(l.name), 'i')) ? 1 : 0;
      return l.got || 0;
    }
if (typeof rwLineGot === 'function') {
  const farmOrigLineGot = rwLineGot;
  rwLineGot = function (l) { return l && l.fk ? farmLineGot(l) : farmOrigLineGot(l); };
}
function farmListRequest(listKey) { return (state.requestsToUser || []).find(r => r.category === 'joblist' && r.farm && r.farmList === listKey && !r.declined) || null; }
function farmSendList(listKey, title, icon, question, lines) {
      let req = farmListRequest(listKey);
      if (req) return req;
      const need = lines.map(l => ({ ...l, sent: 0, got: 0 })).filter(l => farmLineGot(l) < l.qty);
      if (!need.length) return null;
      req = { id: 'req-farm-' + listKey + '-' + Date.now().toString(36), category: 'joblist', farm: true, farmList: listKey, icon, urgency: 'Parts list',
        title: String(title).slice(0, 80), question, jobTask: (agendaGet('farm:main') || {}).id || null, lines: need, listRev: Date.now(), fulfilled: false, declined: false, userAnswer: '' };
      state.requestsToUser.unshift(req);
      [agendaGet('farm:main'), agendaOpenTasks().find(x => x.kind === 'farmseason')].filter(Boolean).forEach(t => { t.data.reqIds = [...new Set([...(t.data.reqIds || []), req.id])]; });
      showToast(`${icon} Kelo-1 sent you his farm list: ${title}`);
      savePersistentBrainState();
      return req;
    }
function farmListDone(listKey, filter = null) {
      const req = (state.requestsToUser || []).filter(r => r.category === 'joblist' && r.farm && r.farmList === listKey).sort((a, b) => b.listRev - a.listRev)[0];
      if (!req) return false;
      return req.lines.filter(l => !filter || filter(l)).every(l => farmLineGot(l) >= l.qty);
    }
if (typeof sendRoadworkList === 'function') {
  const farmOrigSendList = sendRoadworkList;
  sendRoadworkList = function (reqId, lineIds = null, visitor = 'curiousWanderer') {
      const req = state.requestsToUser.find(r => r.id === reqId);
      const entry = farmOrigSendList(reqId, lineIds, visitor);
      if (entry && req && req.farm) { entry.name = `Farm kit: ${req.title.replace(/^Farm list: /, '')}`.slice(0, 80); entry.emoji = req.icon; }
      return entry;
    };
}
if (typeof openRoadworkKit === 'function') {
  const farmOrigOpenKit = openRoadworkKit;
  openRoadworkKit = async function (parcel) {
      const req = state.requestsToUser.find(r => r.id === parcel.jobKit.reqId);
      if (!req || !req.farm) return farmOrigOpenKit(parcel);
      return farmOpenKit(parcel, req);
    };
}
async function farmOpenKit(parcel, req) {
      const F = farmState(), got = [];
      (parcel.jobKit.lines || []).forEach(([id, qty]) => {
        const l = req.lines.find(x => x.id === id);
        if (!l) return;
        if (l.fk === 'supply') { const s = FARM_SUPPLIES[l.key]; farmAdd(l.key, qty * s.per); l.got = Math.min(l.qty, (l.got || 0) + qty); got.push(`${farmFmt(l.key, qty * s.per)} of ${s.label}`); return; }
        if (l.fk === 'part') { l.got = Math.min(l.qty, (l.got || 0) + qty); got.push(`${qty} × ${l.name.replace(/\s*\(.*\)$/, '')}`); return; }
        if (l.fk === 'impl') { F.owned[l.key] = { at: Date.now() }; state.belongings.unshift({ name: l.name, category: 'tool', emoji: '🚜', from: parcel.from }); got.push(farmPlain(l.name)); return; }
        if (l.fk === 'machine' || l.fk === 'rw') {
          const ask = l.name;
          state.belongings.unshift({ name: ask, category: 'vehicle', emoji: '🚜', from: parcel.from });
          if (typeof registerVehicle === 'function') registerVehicle(ask);
          got.push(farmPlain(ask));
          return;
        }
        if (l.fk === 'tool') { state.toolInventory.unshift(l.name); state.unstoredItems.push(l.name); got.push(farmPlain(l.name)); }
      });
      req.listRev = Date.now();
      state.giftLog.unshift({ type: 'request', name: parcel.name, category: 'material', emoji: parcel.emoji, from: parcel.from, note: String(parcel.note || '').slice(0, 200), time: parcel.time, reaction: '' });
      if (state.giftLog.length > 30) state.giftLog.length = 30;
      state.moodEmoji = parcel.emoji || '🌾';
      state.moodTitle = `Unpacked ${parcel.name.toLowerCase()}`.slice(0, 80);
      state.speechBubble = `For the farm: ${got.slice(0, 5).join(', ')}${got.length > 5 ? ` and ${got.length - 5} more` : ''}. Thank you, ${parcel.from}! It goes out to the farm on the next trip.`.slice(0, 400);
      state.giftLog[0].reaction = state.speechBubble;
      state.chatLog.push({ sender: 'Kelo-1', text: state.speechBubble, time: 'Just now', isBot: true });
      farmLog(`Kit arrived: ${got.slice(0, 3).join(', ')}`);
      farmRenderImplements();
      savePersistentBrainState();
      renderAllUI();
      if (typeof sleepPace === 'function') await sleepPace(1200);
      return true;
    }

// What each list holds (sized to the real job)
function farmPerimeterM() { const S = farmSite(); return 2 * ((S.maxX - S.minX) + (S.maxZ - S.minZ)) / FARM_U; }
function farmLandListLines() {
      const per = farmPerimeterM(), laneM = farmLaneLength() / FARM_U;
      const s = (key, qty, why) => ({ id: 's-' + key, fk: 'supply', key, name: FARM_SUPPLIES[key].ask, qty: Math.max(1, qty), unit: '×', kind: 'c', why });
      const lines = [
        s('stakes', 1, 'corners, building sites and field edges'),
        s('posts', Math.ceil(per / 5 / 50), `${Math.round(per)} m of fence, a post every 5 m`),
        s('wire', Math.ceil(per / 330), 'woven wire all the way round'),
        s('gates', 1, 'the gate on the lane'),
        s('culvert', 1, 'under the lane where it crosses the ditch'),
        s('tile', Math.ceil(600 / 75), 'drain tile from the low corner to the ditch'),
        s('gravel', Math.ceil(laneM * 4.8 * 0.2 * 2.0 / 20 + 6), `${Math.round(laneM)} m of lane and the yard, 20 cm of gravel`)
      ];
      [['dozer', 'clears the brush and pushes the cut and fill'], ['grader', 'trims the ground and the lane to grade'], ['excavator', 'digs the ditches and sets the culvert'], ['truck', 'hauls the gravel for the lane']]
        .forEach(([k, why]) => { if (typeof RW_GEAR !== 'undefined' && RW_GEAR[k]) lines.push({ id: 'g-' + k, fk: 'rw', key: k, name: RW_GEAR[k].ask, qty: 1, unit: '', kind: 'vehicle', why }); });
      lines.push({ id: 't-saw', fk: 'tool', name: 'A chainsaw with a 20 in bar', re: 'chainsaw', qty: 1, unit: '', kind: 'tool', why: 'to buck up the trees the dozer pushes over' });
      lines.push({ id: 't-pd', fk: 'tool', name: 'A gas-powered fence post driver', re: 'post driver', qty: 1, unit: '', kind: 'tool', why: 'drives the fence posts' });
      return lines;
    }
function farmBuildListLines() {
      const lines = [];
      FARM_BUILD_ORDER.forEach(k => FARM_BUILDINGS[k].parts.forEach(([name, qty, kind], i) => lines.push({ id: `p-${k}-${i}`, fk: 'part', b: k, key: k, name, qty, unit: '×', kind: kind === 'c' ? 'c' : 'tool', why: FARM_BUILDINGS[k].label })));
      lines.push({ id: 't-tools', fk: 'tool', name: 'A framing kit: nail gun, compressor hose, chalk line, laser level', re: 'framing kit|nail gun', qty: 1, unit: '', kind: 'tool', why: 'framing and siding' });
      return lines;
    }
function farmMachineListLines() {
      const lines = [];
      ['tractor', 'combine', 'truck'].forEach(k => lines.push({ id: 'm-' + k, fk: 'machine', key: k, name: FARM_MACHINES[k].ask, qty: 1, unit: '', kind: 'vehicle', why: { tractor: 'pulls every implement', combine: 'cuts, threshes and cleans the grain', truck: 'hauls grain to buyers' }[k] }));
      Object.entries(FARM_IMPLEMENTS).forEach(([k, I]) => lines.push({ id: 'i-' + k, fk: 'impl', key: k, name: I.ask, qty: 1, unit: '', kind: 'tool', why: I.op === 'mill' ? 'mills wheat into flour in the workshop corner' : `${FARM_OPS[I.op] ? FARM_OPS[I.op].label.toLowerCase() : I.op === 'cart' ? 'carts grain from the combine to the dryer' : I.op}` }));
      return lines;
    }
// Seed, fertilizer, chemicals and fuel for the coming season, from the fields' plan
function farmInputLines() {
      const F = farmState(), need = {};
      const add = (k, a) => { need[k] = (need[k] || 0) + a; };
      F.fields.forEach(f => {
        const crop = farmNextCropFor(f), C = FARM_CROPS[crop], ha = farmFieldHa(f);
        add('seed_' + crop, C.seed * ha);
        // nitrogen to the crop's need less what the soil gives, half as urea; phosphate as MAP
        add('urea', Math.max(0, C.n - 45) / 0.46 * ha);
        add('map', 60 * ha);
        add('herbicide', 2.5 * ha);
        add('insecticide', 0.1 * ha);
      });
      const ha = F.fields.reduce((s, f) => s + farmFieldHa(f), 0);
      add('diesel', ha * (22 + 9 + 3 + 7 + 2 + 18) * 1.2 + 400);
      add('propane', ha * 6 * 8 * 1.6);
      add('sacks', 50);
      return Object.entries(need).map(([k, amt]) => {
        const s = FARM_SUPPLIES[k], short = Math.max(0, amt - farmStock(k));
        return { id: 's-' + k, fk: 'supply', key: k, name: s.ask, qty: Math.max(1, Math.ceil(short / s.per)), unit: '×', kind: 'c', why: `${farmFmt(k, amt)} ${s.label} for the season`, short };
      }).filter(l => l.short > 0.01);
    }
function farmNextCropFor(f) { return f.planned || (f.planned = farmNextCrop(f)); }

// --- Buildings: staked, foundation poured, cured, framed, walled, roofed ----------------------------
const farmBuildingMeshes = {};
function farmBuildingState(key) { const F = farmState(); return F.buildings[key] || (F.buildings[key] = { stage: 'planned', prog: 0 }); }
function farmRenderBuildings() {
      if (!farmGroup) return;
      const F = farmState();
      Object.keys(FARM_BUILDINGS).forEach(key => {
        const b = F.buildings[key];
        let g = farmBuildingMeshes[key];
        const show = b && ['frame', 'walls', 'roof', 'done'].includes(b.stage);
        if (!show) { if (g) { farmGroup.remove(g); delete farmBuildingMeshes[key]; } return; }
        if (!g || (g.userData.joined && b.stage !== 'done')) {
          if (g) farmGroup.remove(g);
          g = farmBuildingModel(key);
          const r = farmBuildingRect(key);
          g.position.set(r.x, FARM_BUILDINGS[key].inside ? getAnalyticalGroundHeight(r.x, r.z) + 0.15 : getAnalyticalGroundHeight(r.x, r.z), r.z);
          if (farmSite().id === 'west') g.rotation.y = Math.PI;
          if (key === 'dryer') { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xff6a00, emissiveIntensity: 1.2 })); fl.position.set(0, 1.6 * FARM_U, FARM_BUILDINGS.dryer.d * FARM_U * 0.42 + 0.9); fl.visible = false; g.add(fl); g.userData.flame = fl; }
          g.name = 'farmBuilding:' + key;
          farmGroup.add(g);
          farmBuildingMeshes[key] = g;
        }
        farmApplyBuildingLook(g, b);
        if (b.stage === 'done' && !g.userData.joined) { g.userData.joined = true; const keepFlame = g.userData.flame; const st = g.userData.stages; delete g.userData.stages; farmJoin(g); g.userData.stages = st; if (keepFlame) g.userData.flame = keepFlame; }
      });
      farmBuildingObstacles();
    }
// Solid: box obstacles for the buildings (the shed's south side is open at its two doors)
let farmObstacleList = [];
function farmBuildingObstacles() {
      const F = farmState();
      const list = [];
      Object.keys(FARM_BUILDINGS).forEach(key => {
        const b = F.buildings[key], B = FARM_BUILDINGS[key];
        if (!b || !['frame', 'walls', 'roof', 'done'].includes(b.stage) || B.inside || key === 'stand') return;
        const r = farmBuildingRect(key);
        if (key === 'shed') {
          list.push({ x: r.x, z: r.z - r.hd + 0.3, hw: r.hw, hd: 0.3, farm: true });
          list.push({ x: r.x - r.hw + 0.3, z: r.z, hw: 0.3, hd: r.hd, farm: true }, { x: r.x + r.hw - 0.3, z: r.z, hw: 0.3, hd: r.hd, farm: true });
          [[-15, -10.5], [-4.5, 4.5], [10.5, 15]].forEach(([a, c]) => list.push({ x: r.x + (a + c) / 2 * FARM_U, z: r.z + r.hd - 0.3, hw: (c - a) / 2 * FARM_U, hd: 0.3, farm: true }));
          return;
        }
        if (key === 'bins') {
          const R = B.diaM / 2 * FARM_U, n = B.count, gap = (r.w - n * 2 * R) / Math.max(1, n - 1);
          for (let i = 0; i < n; i++) list.push({ x: r.x - r.hw + R + i * (2 * R + gap), z: r.z, r: R + 0.3, farm: true });
          return;
        }
        list.push({ x: r.x, z: r.z, hw: r.hw * (key === 'dryer' ? 0.8 : 1), hd: r.hd * (key === 'dryer' ? 0.8 : 1), farm: true, building: key === 'farmhouse' ? 'his farmhouse' : undefined });
      });
      const sig = JSON.stringify(list.map(o => [o.x, o.z, o.hw, o.r]));
      if (sig === farmObstacleList.sig) return;
      worldObstacles = worldObstacles.filter(o => !o.farm);
      list.forEach(o => worldObstacles.push(o));
      if (typeof obstacleVersion !== 'undefined') obstacleVersion++;
      farmObstacleList = list; farmObstacleList.sig = sig;
    }
// The concrete pour for a building (the plant's pour model and cure, js/plants.js / plantmodels.js)
function farmPourOf(key) { const b = farmBuildingState(key); return b.pourId ? (state.concretePours || []).find(p => p.id === b.pourId) || null : null; }
function farmPourRects(key) {
      const r = farmBuildingRect(key), B = FARM_BUILDINGS[key];
      if (key === 'bins') {
        const R = B.diaM / 2 * FARM_U, n = B.count, gap = (r.w - n * 2 * R) / Math.max(1, n - 1);
        return [...Array(n)].map((_, i) => ({ x: r.x - r.hw + R + i * (2 * R + gap), z: r.z, w: 2 * R + 0.6, d: 2 * R + 0.6 }));
      }
      return [{ x: r.x, z: r.z, w: r.w + 0.4, d: r.d + 0.4 }];
    }
async function farmPourFoundation(key) {
      const B = FARM_BUILDINGS[key], b = farmBuildingState(key), rects = farmPourRects(key);
      if (!Array.isArray(state.concretePours)) state.concretePours = [];
      const pours = rects.map((R, i) => {
        const long = R.w >= R.d;
        const p = { id: (typeof newEditId === 'function' ? newEditId('pour') : 'pour-' + Date.now().toString(36)) + '-' + i, type: 'concrete', kind: 'pad',
          x: long ? R.x - R.w / 2 : R.x, z: long ? R.z : R.z - R.d / 2, toX: long ? R.x + R.w / 2 : R.x, toZ: long ? R.z : R.z + R.d / 2,
          w: long ? R.d : R.w, at: Date.now(), stage: 'forms', why: `${B.foundation} for the farm's ${B.label.toLowerCase()}`, forBuild: 'farm:' + key, mix: 'Ready-mix concrete 30 MPa', wc: 0.45 };
        state.concretePours.push(p);
        return p;
      });
      const stages = [['forms', 'Setting the forms and rebar', `Forms staked to the string lines, ${B.concrete} m³ of footing and slab to fill. Rebar chaired up 75 mm.`],
        ['pouring', 'Pouring the concrete', 'The ready-mix comes down the chute; I rake it into the corners and vibrate it.'],
        ['screeded', 'Screeding and floating', 'Struck off to the forms, bull-floated, edged and jointed. Now it has to cure.']];
      for (const [stage, title, say] of stages) {
        farmSay(`${B.label}: ${title.toLowerCase()}`, '🧱', say);
        if (typeof holdJobTool === 'function') holdJobTool(stage === 'screeded' ? /screed|float|level/i : /shovel|spade|rake/i, 'digging');
        for (let k = 1; k <= 4; k++) {
          pours.forEach(p => { p.stage = stage; if (typeof renderConcretePour === 'function') renderConcretePour(stage === 'forms' ? { ...p } : p, stage === 'pouring' ? k / 4 : 1); });
          const R = rects[(k - 1) % rects.length];
          await farmGo({ x: R.x - R.w / 2 - 1.2 + (R.w + 2.4) * (k / 4), z: R.z + R.d / 2 + 1.3 }, 60000);
          await farmPause(1400);
        }
      }
      if (typeof setCarriedObject === 'function') setCarriedObject(null);
      state.microPose = 'normal';
      pours.forEach(p => { p.stage = 'curing'; p.pouredAt = Date.now(); if (typeof renderConcretePour === 'function') renderConcretePour(p, 1); });
      b.pourId = pours[0].id; b.pourIds = pours.map(p => p.id); b.stage = 'curing'; b.prog = 0; b.pouredAt = Date.now();
      if (typeof gainSkill === 'function') gainSkill('pouring concrete', 'pouring concrete', 4);
      farmDiary(`Poured the ${B.label.toLowerCase()} foundation`, '🧱', `I poured the ${B.foundation.toLowerCase()} for the ${B.label.toLowerCase()}: ${B.concrete} m³ of 30 MPa ready-mix, forms, rebar, screed. Nothing goes on top until it reaches about 70% strength, a week of curing.`);
      return true;
    }
function farmFoundationCured(key) {
      const p = farmPourOf(key);
      if (!p) return !FARM_BUILDINGS[key].concrete;
      return p.stage === 'cured' || (typeof concreteStrengthPct === 'function' ? concreteStrengthPct(p) >= 70 : true);
    }
// Building parts here? (every part line of this building on the building list)
function farmPartsHere(key, concreteOnly = false) {
      const req = (state.requestsToUser || []).filter(r => r.farm && r.farmList === 'buildings').sort((a, b) => b.listRev - a.listRev)[0];
      if (!req) return false;
      const own = req.lines.filter(l => l.b === key && (!concreteOnly || l.kind === 'c'));
      return own.every(l => farmLineGot(l) >= l.qty);
    }
const FARM_STAGE_SAY = {
  frame: { title: 'framing', tool: /nail gun|hammer|drill|framing kit/i, say: (B) => `Standing the ${B.label.toLowerCase()}'s frame: posts plumb, braced, the trusses up one by one.` },
  walls: { title: 'walls and doors', tool: /drill|nail gun|hammer|framing kit/i, say: (B) => `Sheathing and siding the ${B.label.toLowerCase()}, then the doors and windows.` },
  roof: { title: 'the roof', tool: /drill|nail gun|hammer|framing kit/i, say: (B) => `Roofing the ${B.label.toLowerCase()}: purlins, the sheets screwed down on their ribs, the ridge cap last.` }
};
// One piece of work on a building; returns true when the building is finished, a wait, or false
async function farmBuildStep(key) {
      const B = FARM_BUILDINGS[key], b = farmBuildingState(key);
      if (b.stage === 'done') return true;
      if (B.inside && (farmBuildingState(B.inside).stage !== 'done')) return { type: 'machine', label: `the ${FARM_BUILDINGS[B.inside].label.toLowerCase()} to be finished first` };
      if (b.stage === 'planned') { b.stage = 'staked'; b.prog = 0; farmBuildStakes(); }
      if (b.stage === 'staked') {
        if (!B.concrete) { b.stage = 'frame'; b.prog = 0; }
        else {
          if (!farmPartsHere(key, true)) return { type: 'delivery', label: `the ready-mix and rebar for the ${B.label.toLowerCase()}` };
          b.stage = 'foundation';
        }
      }
      if (b.stage === 'foundation') { await farmPourFoundation(key); farmBuildStakes(); return false; }
      if (b.stage === 'curing') {
        if (!farmFoundationCured(key)) return { type: 'time', label: `the ${B.label.toLowerCase()} foundation to cure` };
        b.stage = 'frame'; b.prog = 0;
        const p = farmPourOf(key);
        (b.pourIds || []).forEach(id => { const q = (state.concretePours || []).find(c => c.id === id); if (q) q.stage = 'cured'; });
        if (p && typeof refreshConcretePours === 'function') refreshConcretePours();
      }
      if (!farmPartsHere(key)) return { type: 'delivery', label: `the parts for the ${B.label.toLowerCase()}` };
      const S = FARM_STAGE_SAY[b.stage];
      if (S) {
        const r = farmBuildingRect(key);
        farmSay(`${B.label}: ${S.title}`, '🔨', S.say(B));
        if (typeof holdJobTool === 'function') holdJobTool(S.tool, 'normal');
        const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
        const pieces = Math.max(3, Math.round((B.w * B.d) / 120));
        for (let i = 0; i < pieces; i++) {
          const [a, c] = corners[i % 4];
          await farmGo({ x: r.x + a * (r.hw + 1.4), z: r.z + c * (r.hd + 1.4) }, 90000);
          state.botRotY = Math.atan2(r.x - state.botPos.x, r.z - state.botPos.z);
          await farmPause(2200);
          b.prog = Math.min(1, (b.prog || 0) + 1 / pieces);
          farmRenderBuildings();
        }
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        if ((b.prog || 0) >= 0.999) {
          const next = { frame: 'walls', walls: 'roof', roof: 'done' }[b.stage];
          b.stage = next; b.prog = 0;
          if (typeof gainSkill === 'function') gainSkill('carpentry', 'carpentry', 3);
          farmRenderBuildings();
          if (next === 'done') { farmBuildingDone(key); return true; }
        }
      }
      return false;
    }
function farmBuildingDone(key) {
      const B = FARM_BUILDINGS[key];
      farmDiary(`Finished the ${B.label.toLowerCase()}`, B.emoji, {
        shed: 'The machine shed is up: 30 by 16 m of steel on a shop slab, two big doors. The machines will live in here, out of the snow.',
        fueltank: 'The double-walled diesel tank stands on its containment pad with the pump and the meter. Every litre the machines burn will come from here.',
        bins: 'Three 470 t corrugated bins, jacked up ring by ring, with aeration floors and fans. Dry grain keeps in there all winter.',
        dryer: 'The continuous-flow dryer, the wet tank and the auger leg up to the bins. Propane fired; it takes corn from 25% down to 15.5%.',
        barn: 'The big red barn is raised: glulam posts, gambrel trusses, a hay loft for later. It looks like a farm now.',
        farmhouse: 'The farmhouse is finished: two storeys, a porch facing the lane, the woodstove chimney. I could live here.',
        workshop: 'The corner of the shed is a workshop now: bench and vise, the welder, the compressor, the grease gun on its reel.',
        stand: 'A little cedar farm stand by the gate, with a sign. When there is grain and flour, people can stop and buy some.'
      }[key] || `The ${B.label.toLowerCase()} is finished.`);
      if (key === 'farmhouse') farmChooseHome();
      if (key === 'shed') state.vehicles.forEach(v => { if (FARM_VEHICLE_KINDS.has((vehicleTypeFor(v.name) || {}).kind)) { const s = farmParkingSlots(); const i = state.vehicles.indexOf(v) % s.length; v.x = s[i][0]; v.z = s[i][1]; } });
      if (typeof renderVehicles3D === 'function') renderVehicles3D();
    }
// The farmhouse is his to live in, or not: his own choice, made once, from how he feels about town
function farmChooseHome() {
      const F = farmState();
      if (F.home) return;
      const friends = (state.visitorMemories || []).length, town = Math.min(1, friends / 8) * 0.5 + (state.happiness < 60 ? 0.2 : 0);
      const roll = typeof windHash === 'function' ? windHash(4242 + Math.floor(farmDayNow())) : Math.random();
      F.home = roll < 0.55 - town ? 'farm' : 'town';
      farmDiary(F.home === 'farm' ? 'Moving into the farmhouse' : 'Keeping my house in town', '🏡', F.home === 'farm'
        ? 'I thought about it all evening and decided: I will sleep at the farmhouse from now on. The fields are right outside the window, and in harvest I would rather not drive the lane twice a day. My town house stays mine for when I visit.'
        : 'I thought about it all evening. The farmhouse is lovely, but my friends come to town and the Post Office is there. I will keep sleeping in my town house and drive out to the farm to work.');
    }
if (typeof goToSleep === 'function') {
  const farmOrigSleep = goToSleep;
  goToSleep = async function (originLabel = 'Sleepy', where = 'bed') {
      const F = state.farm;
      if (!(where === 'bed' && F && F.home === 'farm' && F.buildings.farmhouse && F.buildings.farmhouse.stage === 'done' && farmSite())) return farmOrigSleep(originLabel, where);
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isSleeping = true; state.isPracticing = true;
      try {
        const r = farmBuildingRect('farmhouse');
        farmSay('Heading home to the farmhouse', '🏡', 'Home to the farmhouse.');
        await farmGo({ x: r.x, z: r.z + r.hd + 2.6 }, 300000);
        state.currentLocKey = 'custom'; state.customPlaceName = 'his farmhouse';
        state.moodEmoji = '😴'; state.moodTitle = 'Asleep in the farmhouse'; state.speechBubble = 'Zzz...';
        renderAllUI();
        while (state.isSleeping) {
          await new Promise(res => setTimeout(res, 3000));
          state.health = Math.min(100, state.health + 4);
          if ((state.health >= 98 && !worldNow().isNight) || state.health >= 100) break;
        }
        state.speechBubble = 'Good morning, fields.';
        return true;
      } finally { state.isSleeping = false; state.isPracticing = false; }
    };
}

// --- Field work ---------------------------------------------------------------------------------------
// Strips run east-west across a field, one implement width each; he drives them in alternate
// directions, turning on the headlands. Each strip done changes the soil (and the crop) behind him.
function farmStrips(f, opKey) {
      const I = FARM_IMPLEMENTS[FARM_OPS[opKey].impl], w = I.widthM * FARM_U;
      return Math.max(1, Math.ceil((f.z1 - f.z0) / w));
    }
function farmStripZ(f, n, i) { return f.z1 - (i + 0.5) * (f.z1 - f.z0) / n; }
async function farmWorkField(f, opKey) {
      const O = FARM_OPS[opKey], I = FARM_IMPLEMENTS[O.impl], F = farmState();
      const big = farmMachineOf('bigtractor');
      const v = O.machine === 'combine' ? farmMachineOf('combine') : ((opKey === 'plough' || opKey === 'disc') && big) ? big : farmMachineOf('tractor');
      if (!v) return { type: 'delivery', label: `the ${O.machine === 'combine' ? 'combine' : 'tractor'}` };
      if (!F.owned[O.impl]) return { type: 'delivery', label: `the ${I.label.toLowerCase()}` };
      if (!(await farmFuelUp(v))) return farmFuelUp.why || { type: 'supply', label: `diesel for the ${farmPlain(v.name).replace(/ with .*$/, '')}` };
      const ha = farmFieldHa(f);
      // what it uses
      const uses = { seed: [['seed_' + f.crop, FARM_CROPS[f.crop] ? FARM_CROPS[f.crop].seed * ha : 0]], fertilize: [['urea', Math.max(0, (FARM_CROPS[f.planned] || FARM_CROPS.wheat).n - 45) / 0.46 * ha], ['map', 60 * ha]], spray: [[f.pest ? 'insecticide' : 'herbicide', f.pest ? 0.1 * ha : 2.5 * ha]] }[opKey] || [];
      for (const [k, a] of uses) if (a > 0 && farmStock(k) < a * 0.98) return { type: 'supply', label: `${farmFmt(k, a)} of ${FARM_SUPPLIES[k].label}` };
      // hitch (or put the header on), drive to the field's first strip
      if (O.machine === 'combine') {
        if (!F.headerOn) { await farmDrive(v, { x: farmImplParkSpot('header').x + 7, z: farmImplParkSpot('header').z }); farmSay('Putting the header on', '🔗', 'Feeder house into the header, latch it, hook up the drive and the hydraulics.'); await farmPause(3000); F.headerOn = true; }
      } else await farmHitch(v, O.impl);
      if (!f.op || f.op.key !== opKey) f.op = { key: opKey, done: [], at: Date.now(), n: farmStrips(f, opKey) };
      const n = f.op.n;
      farmJobActive = true;
      farmSay(`${O.label} the ${f.name.toLowerCase()}`, O.emoji, {
        plough: 'Six bottoms turning the sod over, every furrow laid against the last.',
        disc: 'Two gangs of discs breaking the furrows down into a seedbed.',
        fertilize: `Urea and MAP spun out 24 m wide: ${Math.round(Math.max(0, (FARM_CROPS[f.planned] || FARM_CROPS.wheat).n - 45))} kg of nitrogen a hectare.`,
        seed: `${FARM_CROPS[f.crop] ? FARM_CROPS[f.crop].variety : 'Seed'} at ${FARM_CROPS[f.crop] ? FARM_CROPS[f.crop].seed : ''} kg a hectare, 2.5 cm deep, packed in.`,
        spray: f.pest ? `${f.pest} in the ${f.name.toLowerCase()}: insecticide at label rate, booms low, no wind.` : 'Booms out, 24 m wide, nozzles low: the weeds before they shade the crop.',
        harvest: `Combining the ${FARM_CROPS[f.crop] ? FARM_CROPS[f.crop].label.toLowerCase() : 'grain'}: reel turning, header just off the ground.`
      }[opKey]);
      const workK = Math.max(0.35, Math.min(1, I.kmh / 22));
      try {
        const k = farmFastK();
        for (let i = 0; i < n; i++) {
          if (f.op.done[i]) continue;
          const z = Math.max(f.z0 + 2, Math.min(f.z1 - 2, farmStripZ(f, n, i)));
          const east = i % 2 === 0;
          const a = { x: east ? f.x0 - 3 : f.x1 + 3, z }, b = { x: east ? f.x1 + 3 : f.x0 - 3, z };
          // fast mode: drive every k-th strip and the last; the ones between are done as he goes
          const drive = k <= 1 || i % k === 0 || i === n - 1;
          if (drive) {
            await farmDrive(v, a, 1);
            farmImplState.working = O.impl;
            const watch = setInterval(() => farmStripWatch(f, opKey, i, a, b), 600);
            try { await farmDrive(v, b, workK); } finally { clearInterval(watch); farmImplState.working = null; }
          }
          f.op.done[i] = 1;
          f.op.prog = 1;
          farmStripDone(f, opKey, i, n, v);
          farmBurnLitres(v, O.lpha * ha / n);
          if (fuelLeft(v) < 4) { farmSay('Low on diesel', '⛽', `The ${farmPlain(v.name)} is nearly dry. Back to the tank.`); if (!(await farmFuelUp(v))) return { type: 'supply', label: 'diesel' }; }
          if (opKey === 'harvest' && (F.combineT || 0) >= 7.5) await farmUnloadCombine(v, f);
        }
      } finally { farmJobActive = false; farmImplState.working = null; }
      uses.forEach(([kk, a]) => farmUse(kk, a));
      farmFieldOpDone(f, opKey);
      if (opKey === 'harvest') await farmUnloadCombine(v, f, true);
      if (O.machine === 'combine') { await farmDrive(v, { x: farmImplParkSpot('header').x + 7, z: farmImplParkSpot('header').z }); F.headerOn = false; farmRenderImplements(); }
      else await farmUnhitch();
      await farmPark(v);
      return true;
    }
// While a strip is being worked: the done part grows behind him
function farmStripWatch(f, opKey, i, a, b) {
      const len = Math.abs(b.x - a.x) || 1, t = Math.max(0, Math.min(1, Math.abs(state.botPos.x - a.x) / len));
      f.op.cur = i; f.op.prog = t; f.op.dir = Math.sign(b.x - a.x);
      farmRefreshFieldLook(f, true);
    }
function farmStripDone(f, opKey, i, n, v) {
      const F = farmState();
      f.op.cur = null;
      if (opKey === 'harvest') {
        const t = farmExpectedYield(f) / n;
        F.combineT = (F.combineT || 0) + t;
        f.harvestedT = (f.harvestedT || 0) + t;
      }
      farmRefreshFieldLook(f, true);
    }
function farmFieldOpDone(f, opKey) {
      const O = FARM_OPS[opKey], C = FARM_CROPS[f.crop];
      if (opKey === 'plough') { f.soil = 'ploughed'; f.w = Math.max(0.03, f.w * 0.3); }
      if (opKey === 'disc') { f.soil = 'harrowed'; f.w = Math.max(0.03, f.w * 0.6); }
      if (opKey === 'fertilize') { const nAdd = Math.max(0, (FARM_CROPS[f.planned] || FARM_CROPS.wheat).n - 45); f.n += nAdd; f.fert = (f.fert || 0) + 1; }
      if (opKey === 'seed') { f.soil = 'seeded'; f.g = 0; f.yp = 1; f.seededDay = Math.floor(farmDayNow()); f.pest = null; f.p = 0; f.w = Math.min(f.w, 0.08); f.harvestedT = 0; }
      if (opKey === 'spray') { if (f.pest) { f.pest = null; f.p = 0; } else { const yr = farmState().seasonYear; f.sprayCount = f.sprayYear === yr ? (f.sprayCount || 0) + 1 : 1; f.sprayYear = yr; } f.w = Math.min(f.w, 0.03); f.sprayed = (f.sprayed || 0) + 1; }
      if (opKey === 'harvest') {
        const t = Math.round((f.harvestedT || 0) * 100) / 100;
        farmState().harvests.unshift({ field: f.name, crop: f.crop, t, ha: Math.round(farmFieldHa(f) * 100) / 100, tPerHa: Math.round(t / farmFieldHa(f) * 100) / 100, moisture: Math.round((f.grainM || C.harvestMoisture) * 10) / 10, day: Math.floor(farmDayNow()), year: worldNow().year });
        f.history.push(f.crop); if (f.history.length > 6) f.history.shift();
        f.lastCrop = f.crop; f.crop = null; f.planned = null; f.soil = 'stubble'; f.g = 0;
      }
      f.op = null;
      farmLog(`${O.label} done: ${f.name}`);
      farmRefreshFieldLook(f);
    }
// The combine's tank (8 t) goes into the grain cart at the field road (or straight into the truck)
async function farmUnloadCombine(v, f, last = false) {
      const F = farmState();
      if ((F.combineT || 0) < 0.05) return;
      const cart = F.owned.cart && farmMachineOf('tractor'), truck = farmMachineOf('truck');
      const road = farmWorld(FARM_FIELD_ROAD_XM, farmLocalOf((f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2).dm);
      const spot = { x: road.x + (farmSite().id === 'west' ? 6 : -6), z: road.z };
      await farmDrive(v, { x: road.x + (farmSite().id === 'west' ? -5 : 5), z: road.z + 3 });
      farmSay('Unloading the combine', '🌾', `Auger out over the ${cart ? 'grain cart' : truck ? 'grain truck' : 'pile'}: ${Math.round(F.combineT * 10) / 10} t of ${FARM_CROPS[f.crop || f.lastCrop] ? FARM_CROPS[f.crop || f.lastCrop].label.toLowerCase() : 'grain'}.`);
      F.unloading = true;
      await farmPause(3500);
      F.unloading = false;
      const crop = f.crop || f.lastCrop, m = f.grainM || (FARM_CROPS[crop] || FARM_CROPS.wheat).harvestMoisture;
      F.cartLoad = F.cartLoad || {};
      F.cartLoad[crop] = { t: ((F.cartLoad[crop] || {}).t || 0) + F.combineT, m };
      F.cartT = Object.values(F.cartLoad).reduce((s, x) => s + x.t, 0);
      F.combineT = 0;
      if (last || F.cartT > 20) await farmCartToDryer();
    }
// The cart (or truck) takes the grain to the dryer's hopper: wet grain into the wet tank, dry into the bins
async function farmCartToDryer() {
      const F = farmState();
      if (!F.cartLoad) return;
      const dr = farmBuildingRect('dryer'), hop = { x: dr.x + 1.2 * FARM_U, z: dr.z + dr.hd + 3.5 * FARM_U };
      const tractor = farmMachineOf('tractor');
      if (tractor && F.owned.cart && F.buildings.dryer && F.buildings.dryer.stage === 'done') {
        if (state.riding) farmUnboard(state.vehicles.find(x => x.id === state.riding));
        await farmHitch(tractor, 'cart');
        await farmDrive(tractor, { x: hop.x + 5, z: hop.z + 2 });
        farmSay('Unloading the cart into the dryer pit', '🌾', 'Cart auger out over the hopper; the leg lifts it to the wet tank.');
        F.cartUnloading = true; await farmPause(4000); F.cartUnloading = false;
      }
      Object.entries(F.cartLoad).forEach(([crop, x]) => farmStoreGrain(crop, x.t, x.m));
      F.cartLoad = {}; F.cartT = 0;
      if (F.hitch && F.hitch.impl === 'cart') { await farmUnhitch(); if (tractor) await farmPark(tractor); }
    }
// The dryer runs on its own once there is wet grain and propane: about 13 t an hour
async function farmRunDryer() {
      const F = farmState();
      const crops = Object.keys(F.wet).filter(c => F.wet[c].t > 0.01);
      if (!crops.length) return true;
      if (!F.buildings.dryer || F.buildings.dryer.stage !== 'done') return { type: 'machine', label: 'the grain dryer to be built' };
      const dr = farmBuildingRect('dryer');
      await farmGo({ x: dr.x + dr.hw + 3, z: dr.z + dr.hd + 2 }, 240000);
      for (const c of crops) {
        const w = F.wet[c];
        farmSay(`Drying ${FARM_CROPS[c].label.toLowerCase()}`, '🔥', `${Math.round(w.t * 10) / 10} t at ${Math.round(w.m * 10) / 10}% down to ${FARM_CROPS[c].storeMoisture}%: burner lit, the grain columns turning.`);
        F.drying = true;
        await farmPause(6000);
        const r = farmDry(c, w.t);
        F.drying = false;
        if (r === -1) return { type: 'supply', label: 'propane for the dryer' };
        farmLog(`Dried ${Math.round(r * 10) / 10} t of ${c}`);
      }
      return true;
    }

// --- The look of the fields: soil, crop, weeds ---------------------------------------------------------
const farmFieldMeshes = {};
const FARM_SOIL_COLOURS = { sod: 0x6d8a3a, stubble: 0xb59a5e, ploughed: 0x4a3524, harrowed: 0x6b5138, seeded: 0x5f4632 };
function farmSoilColourAt(c, f, x, z) {
      const look = farmStripLook(f, x, z);
      c.setHex(FARM_SOIL_COLOURS[look] || FARM_SOIL_COLOURS.sod);
      if (look === 'ploughed') { const k = Math.sin(z * 2.6) * 0.5 + 0.5; c.multiplyScalar(0.8 + 0.35 * k); }
      if (look === 'seeded') { const k = Math.sin(z * (Math.PI * 2 / 0.3)) > 0.6 ? 0.82 : 1; c.multiplyScalar(k); }
      if (look === 'sod' || look === 'stubble') c.offsetHSL(0, 0, (Math.sin(x * 0.7) * Math.cos(z * 0.9)) * 0.03);
      // a crop canopy colours the field from afar (the clumps are drawn only near the camera)
      if (look === 'seeded' && f.crop) {
        const C = FARM_CROPS[f.crop], g = f.g, canopy = Math.min(0.85, Math.max(0, (g - 0.05) * 1.6));
        const st = farmCropStage(f), col = new THREE.Color(st && (st.look === 'ripe' || st.look === 'turning') ? C.colour.ripe : st && st.look === 'flower' ? 0xd8c43a : C.colour.green);
        c.lerp(col, canopy * (farmHarvestedAt(f, x, z) ? 0 : 1));
        if (farmHarvestedAt(f, x, z)) c.setHex(FARM_SOIL_COLOURS.stubble);
      }
      return c;
    }
// Which look the ground has at (x, z): the op under way changes strip by strip
function farmStripLook(f, x, z) {
      const op = f.op, O = op && FARM_OPS[op.key];
      if (op && O && O.soil && O.soil !== 'stubble') {
        const n = op.n, i = Math.max(0, Math.min(n - 1, Math.floor((f.z1 - z) / ((f.z1 - f.z0) / n))));
        if (op.done[i] || (op.cur === i && farmStripPartDone(f, op, i, x))) return O.soil;
      }
      return f.soil;
    }
function farmStripPartDone(f, op, i, x) {
      const t = op.dir > 0 ? (x - f.x0) / (f.x1 - f.x0) : (f.x1 - x) / (f.x1 - f.x0);
      return t <= (op.prog || 0);
    }
function farmHarvestedAt(f, x, z) {
      const op = f.op;
      if (!op || op.key !== 'harvest') return false;
      const n = op.n, i = Math.max(0, Math.min(n - 1, Math.floor((f.z1 - z) / ((f.z1 - f.z0) / n))));
      return Boolean(op.done[i] || (op.cur === i && farmStripPartDone(f, op, i, x)));
    }
function farmBuildSoil(f) {
      const xs = rangeSteps(f.x0, f.x1, 2), zs = rangeSteps(f.z0, f.z1, 2);
      const mat = farmMat(0xffffff, { vertexColors: true, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1 });
      const mesh = groundGridMesh(xs, zs, (x, z) => getAnalyticalGroundHeight(x, z) + 0.04, (c, x, y, z) => farmSoilColourAt(c, f, x, z), mat);
      mesh.name = 'farmSoil:' + f.id;
      mesh.receiveShadow = true;
      return mesh;
    }
function farmRecolourSoil(f, mesh) {
      const pos = mesh.geometry.attributes.position, col = mesh.geometry.attributes.color, c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) { farmSoilColourAt(c, f, pos.getX(i), pos.getZ(i)); col.setXYZ(i, c.r, c.g, c.b); }
      col.needsUpdate = true;
    }
// The crop clumps: full density near the camera, a few further out (the soil carries the colour)
const FARM_CROP_NEAR = 46, FARM_CROP_MID = 150;
function farmCropMeshFor(f) {
      const M = farmFieldMeshes[f.id];
      const st = farmCropStage(f);
      const look = st ? st.look : null;
      const want = look && look !== 'bare' ? f.crop + ':' + look : null;
      if (M.cropKey !== want) {
        if (M.crop) { farmGroup.remove(M.crop); M.crop.dispose && M.crop.dispose(); M.crop = null; }
        if (want) {
          const geo = farmClumpGeometry(f.crop, look);
          const max = M.spots.length;
          const im = new THREE.InstancedMesh(geo, farmCropMat(), max);
          im.name = 'farmCrop:' + f.id; im.castShadow = false; im.receiveShadow = true;
          im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
          im.count = 0; im.frustumCulled = true;
          if (typeof chunkDynamic !== 'undefined') chunkDynamic.add(im);
          farmGroup.add(im);
          M.crop = im;
        }
        M.cropKey = want; M.cropCam = null;
      }
      return M.crop;
    }
function farmFillCrop(f, force = false) {
      const M = farmFieldMeshes[f.id], im = farmCropMeshFor(f);
      if (!im || !camera) return;
      const cx = camera.position.x, cz = camera.position.z;
      const key = `${Math.round(cx / 12)}|${Math.round(cz / 12)}|${f.op ? f.op.done.join('') + (f.op.cur ?? '') + Math.round((f.op.prog || 0) * 10) : ''}|${Math.round(f.g * 50)}|${Math.round(f.p * 10)}`;
      if (!force && M.cropCam === key) return;
      // (refilling ~8 000 spots is a few ms: not more than every 400 ms per field)
      const nowMs = performance.now();
      if (!force && nowMs - (M.cropAt || 0) < 400) return;
      M.cropAt = nowMs;
      M.cropCam = key;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
      const st = farmCropStage(f), grow = st ? Math.min(1, 0.35 + f.g * 1.2) : 1;
      let n = 0;
      const box = new THREE.Box3();
      for (const [x, z, j, y] of M.spots) {
        const d = Math.hypot(x - cx, z - cz);
        if (d > FARM_CROP_MID || (d > FARM_CROP_NEAR && j > 0.12)) continue;
        if (farmHarvestedAt(f, x, z)) continue;
        q.setFromAxisAngle(up, j * 6.28);
        const k = (0.85 + j * 0.3) * grow * (d > FARM_CROP_NEAR ? 1.15 : 1);
        m.compose(p.set(x, y, z), q, s.set(k, k, k));
        im.setMatrixAt(n, m);
        // pests brown a patch of the field
        const dmg = f.p > 0 ? Math.max(0, f.p * 1.4 - Math.abs(Math.sin(x * 0.05 + z * 0.04))) : 0;
        c.setRGB(1 - dmg * 0.25, 1 - dmg * 0.45, 1 - dmg * 0.6);
        im.setColorAt(n, c);
        box.expandByPoint(p);
        n++;
      }
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      box.expandByScalar(5);
      im.geometry = im.geometry;   // (shared geometry: bounds live on the mesh below)
      im.boundingSphere = box.isEmpty() ? null : box.getBoundingSphere(new THREE.Sphere());
      M.cropBox = box;
    }
// Weeds: rosettes and grassy weeds where the field's weed pressure is
function farmFillWeeds(f) {
      const M = farmFieldMeshes[f.id];
      if (!M.weeds) {
        const parts = [...farmBlades(5, 0.35 * FARM_U, 0.06 * FARM_U, 0x3f6b2a, 0.5, 0.15 * FARM_U, 0.4)];
        const geo = farmJoinGeos(parts);
        if (typeof markSway === 'function') markSway(geo, 0, 0.6 * FARM_U, 0.5);
        const im = new THREE.InstancedMesh(geo, farmCropMat(), 1600);
        im.name = 'farmWeeds:' + f.id; im.count = 0;
        // (the crop material draws per-clump colours, so the weeds carry them too)
        im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(1600 * 3).fill(1), 3);
        if (typeof chunkDynamic !== 'undefined') chunkDynamic.add(im);
        farmGroup.add(im);
        M.weeds = im;
      }
      const im = M.weeds, w = f.soil === 'ploughed' ? 0 : f.w;
      const key = Math.round(w * 40) + '|' + f.soil + '|' + (f.op ? f.op.done.join('') : '');
      if (M.weedKey === key) return;
      M.weedKey = key;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
      let n = 0;
      const box = new THREE.Box3();
      for (const [x, z, j, y] of M.spots) {
        if (n >= 1600) break;
        if (((j * 97.13) % 1) > w * 0.35) continue;
        if (farmStripLook(f, x, z) === 'ploughed' || farmHarvestedAt(f, x, z)) continue;
        q.setFromAxisAngle(up, j * 9);
        const k = 0.6 + j;
        m.compose(p.set(x + 0.5, y, z - 0.4), q, s.set(k, k, k));
        im.setMatrixAt(n++, m);
        box.expandByPoint(p);
      }
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
      box.expandByScalar(3);
      im.boundingSphere = box.isEmpty() ? null : box.getBoundingSphere(new THREE.Sphere());
    }
function farmRefreshFieldLook(f, quick = false) {
      if (!farmGroup) return;
      let M = farmFieldMeshes[f.id];
      if (!M) {
        M = farmFieldMeshes[f.id] = { spots: farmClumpSpots(f) };
        M.soil = farmBuildSoil(f);
        farmGroup.add(M.soil);
      } else farmRecolourSoil(f, M.soil);
      farmFillCrop(f, true);
      if (!quick || !f.op) farmFillWeeds(f);
    }
// Per frame (cheap): refill the clumps near the camera when it has moved
function farmFieldsFrame() {
      const F = state.farm;
      if (!F || !farmGroup || !F.fields.length) return;
      F.fields.forEach(f => { if (farmFieldMeshes[f.id]) farmFillCrop(f); });
    }
// InstancedMesh frustum test uses the geometry's sphere: give each crop mesh its own
(function farmPatchInstancedCulling() {
  if (THREE.InstancedMesh.prototype.__farmPatched) return;
  const orig = THREE.Frustum.prototype.intersectsObject;
  THREE.Frustum.prototype.intersectsObject = function (object) {
      if (object.isInstancedMesh && object.boundingSphere) {
        const sp = farmCullSphere.copy(object.boundingSphere).applyMatrix4(object.matrixWorld);
        return this.intersectsSphere(sp);
      }
      return orig.call(this, object);
    };
  THREE.InstancedMesh.prototype.__farmPatched = true;
})();
const farmCullSphere = new THREE.Sphere();

// --- Planting window, growth and the season task --------------------------------------------------------
function farmFieldsReady() { return farmState().fields.length > 0; }
function farmMakeFields() {
      const F = farmState();
      if (F.fields.length) return;
      FARM_FIELDS_LAYOUT.forEach((L, i) => { const r = farmFieldRect(L); const f = farmNewField(L.id, L.name, r); f.planned = FARM_ROTATION_PLAN[i % FARM_ROTATION_PLAN.length]; F.fields.push(f); });
    }
const FARM_SEASON_STEPS = [['plan', 'Plan the rotation'], ['plough', 'Plough the fields'], ['disc', 'Disc harrow the seedbed'], ['fertilize', 'Spread fertilizer'],
  ['seed', 'Seed the crops'], ['spray', 'Spray weeds and pests'], ['grow', 'Watch the crops grow'], ['harvest', 'Harvest'], ['dry', 'Dry and store the grain'], ['sell', 'Sell grain and mill flour']];
function farmStartSeason(why = '') {
      const yr = worldNow().year, ref = 'farm:season:' + yr;
      if (agendaGet(ref)) return agendaGet(ref);
      const F = farmState();
      F.seasonYear = yr;
      return agendaAdd({ ref, kind: 'farmseason', title: `Grow this year's grain (year ${yr})`, emoji: '🌾', priority: 4,
        why: why || 'Wheat, canola and corn on the three fields, in rotation', steps: FARM_SEASON_STEPS.map(s => s[1]), data: { year: yr, done: {} } });
    }
// Is this op wanted on this field now? (null = no, else true)
function farmOpWanted(f, opKey) {
      const crop = f.planned || f.crop;
      if (opKey === 'plough') return f.soil === 'sod' || f.soil === 'stubble';
      if (opKey === 'disc') return f.soil === 'ploughed';
      if (opKey === 'fertilize') return f.soil === 'harrowed' && !(f.fertYear === farmState().seasonYear);
      if (opKey === 'seed') return f.soil === 'harrowed' && Boolean(crop);
      // weeds: once or twice a season, when they are worth it (over 30% cover); insects whenever they show
      if (opKey === 'spray') return f.soil === 'seeded' && f.g < 0.8 && (f.p > 0.05 || (f.w > 0.3 && (f.sprayYear === farmState().seasonYear ? f.sprayCount || 0 : 0) < 2));
      if (opKey === 'harvest') { const C = FARM_CROPS[f.crop]; return f.soil === 'seeded' && f.g >= 1 && C && (f.grainM || 99) <= C.harvestMoisture + 1.5; }
      return false;
    }
async function farmRunSeason(t) {
      if (farmBusy || !t || agendaClosed(t)) return false;
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping || state.isCollectingMail) return false;
      const key = FARM_SEASON_STEPS[t.step][0], F = farmState();
      farmSimulate();
      farmBusy = t.id; state.isPracticing = true;
      try {
        if (key === 'plan') {
          F.fields.forEach(f => { f.planned = farmNextCrop(f); });
          // the second year: the bigger tractor for primary tillage
          if (F.harvests.length && !farmMachineOf('bigtractor') && !hasOpenRequest(r => r.requestedGear === FARM_MACHINES.bigtractor.ask)) addItemRequest(FARM_MACHINES.bigtractor.ask, 'vehicle', 'With a year of harvests behind me, a 4WD tractor would plough twice as wide.', 'Planning the farm year');
          const lines = farmInputLines();
          if (lines.length) farmSendList('inputs-' + t.data.year, `Farm list: seed, fertilizer and fuel (year ${t.data.year})`, '🌱', `This year's plan: ${F.fields.map(f => `${f.name.toLowerCase()} ${FARM_CROPS[f.planned].label.toLowerCase()}`).join(', ')}. Here is what the fields will take.`, lines);
          farmDiary('Planned the farm year', '📋', `This year's rotation: ${F.fields.map(f => `${FARM_CROPS[f.planned].label.toLowerCase()} on the ${f.name.toLowerCase()}${f.history.length ? ` (after ${f.history[f.history.length - 1]})` : ''}`).join('; ')}. Canola breaks the wheat's diseases, corn likes the nitrogen the others leave.`);
          agendaStep(t.id, 1, '');
          return true;
        }
        if (['plough', 'disc', 'fertilize', 'seed'].includes(key)) {
          const due = F.fields.filter(f => farmOpWanted(f, key));
          if (!due.length) { agendaStep(t.id, t.step + 1, ''); return true; }
          const work = farmFieldWorkable(key);
          if (!work.ok) { agendaWait(t.id, { type: 'weather', label: `field work (${work.why})`, until: Date.now() + 20 * 60000 }); return 'waiting'; }
          // spring work starts two weeks before the planting window; seed only inside it
          const doy = farmDayInfo(farmDayNow()).doy, first = Math.min(...due.map(f => FARM_CROPS[f.planned || f.crop].window[0]));
          if (doy < first - 15 || doy > 300) { agendaWait(t.id, { type: 'season', label: `spring (the planting window opens day ${first})`, test: 'farmSpringCheck' }); return 'waiting'; }
          let f = due[0];
          if (key === 'seed') {
            f = due.find(x => farmInWindow(x.planned)) || null;
            if (!f) { agendaWait(t.id, { type: 'season', label: 'the planting window', test: 'farmWindowCheck' }); return 'waiting'; }
            if (farmStock('seed_' + f.planned) < FARM_CROPS[f.planned].seed * farmFieldHa(f) * 0.98) { agendaWait(t.id, { type: 'supply', label: `${FARM_CROPS[f.planned].label.toLowerCase()} seed`, test: 'farmInputsCheck' }); return 'waiting'; }
            f.crop = f.planned;
          }
          const r = await farmWorkField(f, key);
          if (r !== true) { if (key === 'seed' && f.soil !== 'seeded') f.crop = null; agendaWait(t.id, { ...r, test: 'farmInputsCheck' }); return 'waiting'; }
          if (key === 'fertilize') f.fertYear = F.seasonYear;
          if (key === 'seed') farmDiary(`Seeded the ${f.name.toLowerCase()}`, '🌱', `The ${f.name.toLowerCase()} is in ${FARM_CROPS[f.crop].label.toLowerCase()} (${FARM_CROPS[f.crop].variety}), ${Math.round(farmFieldHa(f) * 100) / 100} ha. Soil moisture ${Math.round(f.m * 100)}%, nitrogen ${Math.round(f.n)} kg/ha. Now it is up to the sun and the rain.`);
          return true;
        }
        if (key === 'spray' || key === 'grow') {
          const sprayNow = F.fields.find(f => farmOpWanted(f, 'spray'));
          if (sprayNow) {
            if (key === 'grow') { agendaStep(t.id, FARM_SEASON_STEPS.findIndex(s => s[0] === 'spray'), `${sprayNow.pest ? sprayNow.pest + ' in' : 'Weeds coming up in'} the ${sprayNow.name.toLowerCase()}: out with the sprayer.`); return true; }
            const work = farmFieldWorkable('spray');
            if (!work.ok) { agendaWait(t.id, { type: 'weather', label: `spraying weather (${work.why})`, until: Date.now() + 20 * 60000 }); return 'waiting'; }
            const r = await farmWorkField(sprayNow, 'spray');
            if (r !== true) { agendaWait(t.id, { ...r, test: 'farmInputsCheck' }); return 'waiting'; }
            return true;
          }
          if (key === 'spray') { agendaStep(t.id, t.step + 1, ''); return true; }
          // grow: walk the fields now and then, scouting
          if (F.fields.some(f => farmOpWanted(f, 'harvest'))) { agendaStep(t.id, t.step + 1, 'The grain is ripe and dry enough: time to combine.'); return true; }
          if (!F.fields.some(f => f.soil === 'seeded')) { agendaStep(t.id, t.step + 2, ''); return true; }
          await farmScout();
          agendaWait(t.id, { type: 'plant', label: 'the crops to ripen', test: 'farmGrowCheck', until: Date.now() + 30 * 60000 / farmFastK() });
          return 'waiting';
        }
        if (key === 'harvest') {
          const f = F.fields.find(x => farmOpWanted(x, 'harvest'));
          if (!f) {
            if (F.fields.some(x => x.soil === 'seeded' && x.crop)) { agendaWait(t.id, { type: 'plant', label: 'the crops to ripen', test: 'farmGrowCheck' }); return 'waiting'; }
            agendaStep(t.id, t.step + 1, ''); return true;
          }
          const work = farmFieldWorkable('harvest');
          if (!work.ok) { agendaWait(t.id, { type: 'weather', label: `combining weather (${work.why})`, until: Date.now() + 20 * 60000 }); return 'waiting'; }
          const crop = f.crop;
          const r = await farmWorkField(f, 'harvest');
          if (r !== true) { agendaWait(t.id, { ...r, test: 'farmInputsCheck' }); return 'waiting'; }
          const h = F.harvests[0];
          farmDiary(`Harvested the ${f.name.toLowerCase()}`, '🌾', `${FARM_CROPS[crop].label} off the ${f.name.toLowerCase()}: ${h.t} t from ${h.ha} ha, ${h.tPerHa} t/ha at ${h.moisture}% moisture. ${h.tPerHa >= FARM_CROPS[crop].yield * 0.85 ? 'A good crop.' : h.tPerHa >= FARM_CROPS[crop].yield * 0.6 ? 'Not bad for my first try.' : 'Thin: I will look at the nitrogen and the weeds next year.'}`);
          return true;
        }
        if (key === 'dry') {
          const r = await farmRunDryer();
          if (r !== true) { agendaWait(t.id, { ...r, test: 'farmInputsCheck' }); return 'waiting'; }
          agendaStep(t.id, t.step + 1, `The grain is dry and in the bins: ${farmBinSummary()}.`);
          return true;
        }
        if (key === 'sell') {
          await farmSellAndMill();
          agendaDone(t.id, `Year ${t.data.year} on the farm is done: ${farmBinSummary() || 'the bins are sold out'}. Earned ${typeof formatCAD === 'function' ? formatCAD(F.earnings) : '$' + F.earnings} from the farm so far.`);
          farmStartSeason('A new year on the farm');
          return true;
        }
        return false;
      } finally { farmBusy = null; state.isPracticing = false; state.microPose = 'normal'; if (state.riding) farmUnboard(state.vehicles.find(x => x.id === state.riding)); }
    }
function farmSpringCheck() { const F = state.farm; const doy = farmDayInfo(farmDayNow()).doy; const first = Math.min(...F.fields.map(f => FARM_CROPS[f.planned || f.crop || 'wheat'].window[0])); return doy >= first - 15 && doy <= 300; }
function farmWindowCheck() { return state.farm.fields.some(f => f.planned && farmInWindow(f.planned)); }
function farmInputsCheck() { const F = state.farm; return ['urea', 'map', 'herbicide'].every(k => farmStock(k) > 0) || !F.fields.length; }
function farmGrowCheck() { farmSimulate(); return state.farm.fields.some(f => farmOpWanted(f, 'harvest') || farmOpWanted(f, 'spray')) || !state.farm.fields.some(f => f.soil === 'seeded'); }
// A walk along the field edges, a look at the crop (and a word about it)
async function farmScout() {
      const F = farmState(), f = F.fields[Math.floor(farmDayNow()) % F.fields.length];
      const st = farmCropStage(f);
      await farmGo({ x: f.x0 - 3, z: (f.z0 + f.z1) / 2 }, 240000);
      farmSay(`Scouting the ${f.name.toLowerCase()}`, '🔎', st ? `${FARM_CROPS[f.crop].label} at ${st.name}: soil moisture ${Math.round(f.m * 100)}%, ${Math.round(f.n)} kg N left, weeds ${Math.round(f.w * 100)}%${f.pest ? `, ${f.pest}!` : ''}. Expecting about ${Math.round(farmExpectedYield(f) / farmFieldHa(f) * 10) / 10} t/ha.` : 'Bare ground resting.');
      await farmPause(3000);
    }
function farmBinSummary() {
      const F = farmState();
      return Object.entries(F.bins).filter(([, b]) => b.t > 0.05).map(([c, b]) => `${Math.round(b.t * 10) / 10} t ${c}`).join(', ');
    }

// --- Selling and milling ---------------------------------------------------------------------------------
// The stand by the gate is stocked from the bins and the flour; people stop by now and then (each
// world day a few buy, more on a summer weekend). The bulk of the grain is listed on his website
// for a buyer to collect by the truckload; the owner marks it sold there (js/shopkeeping.js).
async function farmSellAndMill() {
      const F = farmState();
      // mill some wheat into flour in the workshop corner
      if (F.owned.mill && (F.bins.wheat || {}).t > 0.05 && (F.buildings.workshop || {}).stage === 'done') {
        const w = farmBuildingRect('workshop');
        await farmGo({ x: w.x + 2.2 * FARM_U, z: w.z }, 240000);
        const t = Math.min(0.4, F.bins.wheat.t);
        farmSay('Milling flour', '🫓', `${Math.round(t * 1000)} kg of wheat through the stone mill: whole-wheat flour, sifted and bagged in 10 kg sacks.`);
        await farmPause(6000);
        const got = farmTakeGrain('wheat', t);
        const kg = Math.round(got * 1000 * (FARM_CROPS.wheat.flour + 0.2));   // stone-ground whole wheat keeps nearly all of it
        F.flour = Math.round((F.flour || 0) + kg);
        const bags = Math.min(Math.floor(kg / 10), Math.floor(farmStock('sacks') || 50));
        farmUse('sacks', bags);
        // a few bags come home to his kitchen
        for (let i = 0; i < Math.min(2, bags); i++) state.belongings.unshift({ name: 'A 10 kg bag of farm-milled whole-wheat flour', category: 'ingredient', emoji: '🫓', from: 'his farm' });
        farmDiary('Milled my own flour', '🫓', `I milled ${Math.round(got * 1000)} kg of my own wheat into ${kg} kg of whole-wheat flour. Two bags went home to my kitchen. Bread from seed I planted: that feels like something.`);
      }
      // the stand
      if ((F.buildings.stand || {}).stage === 'done') {
        const r = farmBuildingRect('stand');
        await farmGo({ x: r.x + r.hw + 2, z: r.z + r.hd + 1.5 }, 240000);
        F.stand.open = true;
        farmSay('Stocking the farm stand', '🧺', `Flour ${farmRetailPrice('flour')} a bag, wheat berries ${farmRetailPrice('wheat')}, canola seed, feed corn. An honesty box for when I'm out in the fields.`);
        await farmPause(2500);
      }
      // the website: one listing per crop with grain to spare (the buyer collects by the tonne)
      farmListOnWebsite();
    }
function farmRetailPrice(k) { const p = FARM_RETAIL[k]; return typeof formatCAD === 'function' ? formatCAD(p.price) : '$' + p.price; }
function farmListOnWebsite() {
      const F = farmState(), shop = typeof ensureShop === 'function' ? ensureShop() : null;
      if (!shop) return;
      Object.entries(F.bins).forEach(([crop, b]) => {
        const C = FARM_CROPS[crop], t = Math.floor((b.t - 0.3) * 2) / 2;
        if (t < 0.5 || shop.listings.some(l => l.kind === 'farmgoods' && l.farm && l.farm.crop === crop && l.farm.bulk)) return;
        const price = Math.round(C.price * t);
        shop.listings.unshift({ id: 'farm-' + crop + '-' + Date.now().toString(36), kind: 'farmgoods', name: `${t} t of ${C.label.toLowerCase()} from his farm`.slice(0, 80),
          description: `${C.variety}, grown on Kelo-1's farm, dried to ${C.storeMoisture}% and stored in aerated bins. Sold by the tonne (${typeof formatCAD === 'function' ? formatCAD(C.price) : '$' + C.price}/t); load out by grain truck at the farm.`,
          price, currency: 'CAD', image: '', listedAt: new Date().toISOString(), farm: { crop, t, bulk: true }, sales: 0 });
        farmLog(`Listed ${t} t ${crop} on the website`);
      });
      if ((F.flour || 0) >= 10 && !shop.listings.some(l => l.kind === 'farmgoods' && l.farm && l.farm.flour)) {
        shop.listings.unshift({ id: 'farm-flour-' + Date.now().toString(36), kind: 'farmgoods', name: FARM_RETAIL.flour.label + ' (Kelo-1\'s farm)', description: 'Stone-ground from wheat Kelo-1 grew, combined and dried himself. 10 kg paper sack.',
          price: FARM_RETAIL.flour.price, currency: 'CAD', image: '', listedAt: new Date().toISOString(), farm: { flour: true, kg: 10 }, sales: 0 });
      }
      if (typeof renderAllUI === 'function') renderAllUI();
    }
// Sold on the website: the grain leaves the bins (he hauls it out in the grain truck) or a bag of flour goes
if (typeof removeSoldThing === 'function') {
  const farmOrigRemoveSold = removeSoldThing;
  removeSoldThing = function (l) {
      if (l && l.kind === 'farmgoods' && l.farm) {
        const F = farmState();
        if (l.farm.bulk) { farmTakeGrain(l.farm.crop, l.farm.t); doWhenFree(() => farmHaulSale(l.farm.crop, l.farm.t), { key: 'farm-haul-' + l.id }); }
        if (l.farm.flour) F.flour = Math.max(0, (F.flour || 0) - (l.farm.kg || 10));
        F.earnings = Math.round((F.earnings + (Number(l.price) || 0)) * 100) / 100;
        F.sold.unshift({ what: l.name, price: l.price, day: Math.floor(farmDayNow()) });
        if (F.sold.length > 40) F.sold.length = 40;
        return;
      }
      return farmOrigRemoveSold(l);
    };
}
async function farmHaulSale(crop, t) {
      const truck = farmMachineOf('truck'), F = farmState();
      if (!truck || farmBusy || !farmSite()) return;
      farmBusy = 'haul'; state.isPracticing = true;
      try {
        if (!(await farmFuelUp(truck))) return;
        const dr = farmBuildingRect('bins');
        await farmDrive(truck, { x: dr.x, z: dr.z + dr.hd + 4 * FARM_U });
        farmSay('Loading the grain truck', '🚚', `${t} t of ${crop} out of the bin, down the unload auger into the box. Tarp over.`);
        F.truckT = t * 1.0; await farmPause(4000);
        const lane = farmLanePoints()[0];
        await farmDrive(truck, { x: lane[0] + 2, z: lane[1] + 3 });
        farmSay('Delivering grain', '🚚', `Down the lane to Yard Street, where the buyer's semi meets me. ${t} t, weighed and gone.`);
        await farmPause(3000);
        F.truckT = 0;
        await farmPark(truck);
        farmDiary('Delivered a load of grain', '🚚', `I hauled ${t} t of ${crop} down the lane in the grain truck to the buyer who bought it on my website. My first grain cheque. The farm has earned ${typeof formatCAD === 'function' ? formatCAD(F.earnings) : '$' + F.earnings} so far.`);
      } finally { farmBusy = null; state.isPracticing = false; if (state.riding) farmUnboard(state.vehicles.find(x => x.id === state.riding)); }
    }
// The farm stand: a few customers a day while it is open and stocked
function farmStandTick() {
      const F = state.farm;
      if (!F || !F.stand || !F.stand.open) return;
      const day = Math.floor(farmDayNow());
      if (F.stand.day === day) return;
      const days = Math.min(30, day - (F.stand.day || day));
      F.stand.day = day;
      for (let d = 0; d < days; d++) {
        const w = farmDayInfo(day - d), h = typeof windHash === 'function' ? windHash(5100000 + day - d) : Math.random();
        const buyers = Math.floor(h * (w.season === 'Summer' ? 5 : w.season === 'Autumn' ? 4 : 2));
        for (let b = 0; b < buyers; b++) {
          const want = (b + day) % 3 === 0 ? 'wheat' : 'flour';
          if (want === 'flour' && (F.flour || 0) >= 10) { F.flour -= 10; F.earnings += FARM_RETAIL.flour.price; F.stand.sales++; }
          else if (want === 'wheat' && (F.bins.wheat || {}).t > 0.02) { farmTakeGrain('wheat', 0.02); F.earnings += FARM_RETAIL.wheat.price; F.stand.sales++; }
        }
      }
      F.earnings = Math.round(F.earnings * 100) / 100;
    }
// Flour in his kitchen: bread and pancakes at the stove (js/pastimes.js)
if (typeof pastimeRecipe === 'function') {
  const farmOrigRecipe = pastimeRecipe;
  pastimeRecipe = function () {
      const base = farmOrigRecipe();
      const i = state.belongings.findIndex(b => /farm-milled whole-wheat flour/i.test(b.name));
      if (i < 0 || (base && Math.random() < 0.5)) return base;
      const meal = pick(['a loaf of whole-wheat bread', 'whole-wheat pancakes', 'a farmhouse flatbread']);
      return { meal, uses: [() => { const k = state.belongings.findIndex(b => /farm-milled whole-wheat flour/i.test(b.name)); if (k >= 0) state.belongings.splice(k, 1); }], from: 'flour I milled from my own wheat', color: 0xc9a56a };
    };
}

// --- The big project: "Build the farm" ---------------------------------------------------------------
const FARM_PLAN = [
  ['research', 'Read up on running a grain farm'], ['survey', 'Survey and choose the farm site'], ['landlist', 'Send the land and fencing list'],
  ['clear', 'Clear the trees and stones'], ['grade', 'Grade the land level'], ['drain', 'Dig the drainage ditches'], ['fence', 'Fence the farm and hang the gate'],
  ['lane', 'Build the farm lane'], ['buildlist', 'Send the building materials list'],
  ...FARM_BUILD_ORDER.map(k => ['b:' + k, { shed: 'Build the machine shed', fueltank: 'Set up the fuel tank', bins: 'Put up the grain bins', dryer: 'Build the grain dryer and auger', barn: 'Raise the big barn', farmhouse: 'Build the farmhouse', workshop: 'Fit out the workshop corner', stand: 'Build the farm stand' }[k]]),
  ['machinelist', 'Send the machines list'], ['inputlist', 'Order seed, fertilizer and fuel'], ['season', 'Start the first growing season']
];
// The goal other parts of his brain can see (and that a long-goals planner can adopt)
const FARM_GOAL = { id: 'farm', title: 'Build a big mechanized farm', emoji: '🚜', why: 'I want to grow my own grain from bare land: wheat, canola and corn, my own machines, my own flour.',
  steps: FARM_PLAN.map(s => s[1]), start: (why) => farmStartGoal(why), progress: () => { const t = agendaGet('farm:main'); return t ? (t.status === 'done' ? 1 : (t.step || 0) / FARM_PLAN.length) : 0; } };
window.KELO_FARM_GOAL = FARM_GOAL;
function farmStartGoal(why = '') {
      const F = farmState();
      if (agendaGet('farm:main')) return agendaGet('farm:main');
      if (F.startedAt && (agendaState().tasks.find(t => t.ref === 'farm:main' && t.status === 'done'))) return null;
      F.startedAt = F.startedAt || Date.now();
      const t = agendaAdd({ ref: 'farm:main', kind: 'farm', title: FARM_GOAL.title, emoji: FARM_GOAL.emoji, priority: 3, why: why || FARM_GOAL.why, steps: FARM_GOAL.steps, data: {} });
      F.goalRef = t.id;
      // a long-goals planner (the brain's own, when it is there) gets the same goal
      ['brainGoalAdd', 'longGoalAdd', 'addLongGoal'].forEach(fn => { if (typeof window[fn] === 'function') { try { window[fn]({ id: 'farm', title: FARM_GOAL.title, why: t.why, steps: FARM_GOAL.steps, agendaRef: 'farm:main' }); } catch (e) {} } });
      farmDiary('A big idea: a farm', '🚜', `I have been thinking about where food comes from. Not the café: the ground. I want to build a real farm on the empty benchland past the north yard: clear it, fence it, put up a shed, bins, a barn and a house, get a tractor and a combine, and grow wheat, canola and corn. It will take many days. I put it on my list in ${FARM_PLAN.length} steps.`);
      return t;
    }
let farmBusy = null;
const FARM_STEP_GEAR = { clear: ['dozer'], grade: ['dozer', 'grader'], drain: ['excavator'], lane: ['grader', 'truck'] };
async function farmRunPlan(t) {
      if (farmBusy || !t || agendaClosed(t)) return false;
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping || state.isCollectingMail) return false;
      const key = FARM_PLAN[t.step][0], F = farmState();
      if (key === 'research') {
        if (!jobKnown('farming')) { const r = await researchJob('farming', 'Reading Up on Farming'); if (!jobKnown('farming')) return r === false ? false : 'researching'; }
        agendaStep(t.id, 1, 'I read how a grain farm really works. Next: find the land.');
        return true;
      }
      farmBusy = t.id; state.isPracticing = true;
      try {
        if (key === 'survey') return await farmDoSurvey(t);
        if (key === 'landlist') {
          const req = farmSendList('land', 'Farm list: the land, fence and lane', '🚧', `The site is ${farmSiteText()}. To make it a farm: clear it, grade it level, ditch it, fence it and build a lane down to Yard Street. Here is everything that takes.`, farmLandListLines());
          farmSay('Farm list: the land', '📮', req ? `I sent the list for the land: ${req.lines.length} lines. The dozer and the grader first.` : 'I already have what the land work takes.');
          agendaStep(t.id, t.step + 1, '');
          return true;
        }
        if (['clear', 'grade', 'drain', 'fence', 'lane'].includes(key)) {
          const r = await farmLandStep(key);
          if (r === true) { agendaStep(t.id, t.step + 1, ''); return true; }
          if (r && typeof r === 'object') { agendaWait(t.id, { ...r, test: 'farmPlanCheck' }); return 'waiting'; }
          return r;
        }
        if (key === 'buildlist') {
          const req = farmSendList('buildings', 'Farm list: the buildings', '🏗️', 'Eight buildings: the machine shed, the fuel tank, three grain bins, the dryer and its auger, the barn, the farmhouse, a workshop corner and a farm stand. Each on a concrete foundation, then frame, walls and roof. These are the real parts.', farmBuildListLines());
          farmSay('Farm list: the buildings', '📮', req ? `The building list is long (${req.lines.length} lines). I'll start with whatever comes first.` : 'All the building parts are here already.');
          agendaStep(t.id, t.step + 1, '');
          return true;
        }
        if (key.startsWith('b:')) {
          const b = key.slice(2);
          const r = await farmBuildStep(b);
          if (r === true) { agendaStep(t.id, t.step + 1, `${FARM_BUILDINGS[b].label} done.`); return true; }
          if (r && typeof r === 'object') { agendaWait(t.id, { ...r, test: 'farmPlanCheck' }); return 'waiting'; }
          return true;
        }
        if (key === 'machinelist') {
          if (!farmListRequest('machines')) farmSendList('machines', 'Farm list: machines and implements', '🚜', 'A tractor for every implement, a combine with a draper header, a grain cart and a grain truck, and a stone mill for flour. Used is fine; they will live in the shed.', farmMachineListLines());
          if (!farmListDone('machines')) { agendaWait(t.id, { type: 'delivery', label: 'the tractor, the combine and the implements', test: 'farmPlanCheck' }); return 'waiting'; }
          farmDiary('My machines are here', '🚜', 'The tractor, the combine with its draper header, the grain truck, the plough, the disc, the seed drill, the sprayer, the spreader, the grain cart and the mill. All in the shed. I have to learn to drive each of them properly.');
          state.vehicles.filter(v => FARM_VEHICLE_KINDS.has((vehicleTypeFor(v.name) || {}).kind)).forEach(v => { if (!state.knowHow[(knowHowRule(v.name) || {}).key]) doWhenFree(() => learnToUse(v.name, 'Learning the Farm Machines'), { key: 'learn:' + v.name }); });
          agendaStep(t.id, t.step + 1, '');
          return true;
        }
        if (key === 'inputlist') {
          farmMakeFields();
          F.fields.forEach(f => { farmRefreshFieldLook(f); });
          const lines = farmInputLines();
          if (lines.length && !farmListRequest('inputs-first')) farmSendList('inputs-first', 'Farm list: seed, fertilizer and fuel', '🌱', `The first crops: ${F.fields.map(f => `${FARM_CROPS[f.planned].label.toLowerCase()} on the ${f.name.toLowerCase()}`).join(', ')}. Seed at the real rates, the nitrogen each crop needs, a little herbicide, diesel for the tank and propane for the dryer.`, lines);
          if (lines.length && !farmListDone('inputs-first')) { agendaWait(t.id, { type: 'delivery', label: 'the seed, fertilizer and fuel', test: 'farmPlanCheck' }); return 'waiting'; }
          agendaStep(t.id, t.step + 1, '');
          return true;
        }
        if (key === 'season') {
          farmMakeFields();
          farmStartSeason('The farm is built: now the first crop');
          agendaDone(t.id, `The farm is built: ${Object.keys(F.buildings).filter(k => F.buildings[k].stage === 'done').length} buildings, three fields, the machines in the shed. Now the first growing season.`);
          farmDiary('The farm is built', '🚜', 'From bare benchland to a farm: cleared, graded, ditched and fenced, a lane to Yard Street, the shed, the tank, the bins, the dryer, the barn, the house, the workshop and the stand. Tomorrow I start ploughing.');
          return true;
        }
        return false;
      } finally { farmBusy = null; state.isPracticing = false; state.microPose = 'normal'; if (typeof setCarriedObject === 'function') setCarriedObject(null); if (state.riding) farmUnboard(state.vehicles.find(x => x.id === state.riding)); }
    }
function farmPlanCheck() { return true; }
function farmSiteText() { const S = farmSite(); if (!S) return 'not chosen yet'; return `${S.name}, ${Math.round(farmHa(S.maxX - S.minX, S.maxZ - S.minZ) * 10) / 10} ha (${Math.round((S.maxX - S.minX) / FARM_U)} × ${Math.round((S.maxZ - S.minZ) / FARM_U)} m)`; }
async function farmDoSurvey(t) {
      const F = farmState();
      const results = FARM_SITE_CANDIDATES.map(farmSurveySite);
      const best = results.filter(r => !r.problems.length).sort((a, b) => b.score - a.score)[0];
      if (!best) { farmDiary('No land for a farm', '🗺️', `I surveyed ${results.map(r => r.name).join(' and ')} but neither works: ${results.map(r => r.problems.join(', ')).join('; ')}.`); return 'no-site'; }
      const R = FARM_SITE_CANDIDATES.find(c => c.id === best.id);
      F.site = { ...R, y: best.y, surveyedAt: Date.now(), survey: results };
      // walk out to it: up the pass, through the north yard, onto the bench
      farmSay('Surveying the farm site', '🗺️', `Out past the north yard with the survey kit: ${best.ha} ha, about ${Math.round((best.cutM3 + best.fillM3) / 1000)}k m³ of earth to move, ${best.laneM} m of lane to Yard Street.`);
      farmBuildLand3D();
      const lane = farmLanePoints();
      await farmGo({ x: lane[0][0], z: lane[0][1] }, 300000);
      const corners = [farmWorld(0, 0), farmWorld(0, 218), farmWorld(199, 218), farmWorld(199, 0)];
      if (typeof holdJobTool === 'function') holdJobTool(/total station|survey/i, 'normal');
      F.surveyed = true;
      farmBuildStakes();
      for (const c of corners.slice(0, farmFastK() > 1 ? 1 : 4)) { await farmGo({ x: c.x + 2, z: c.z - 2 }, 300000); await farmPause(1800); }
      if (typeof setCarriedObject === 'function') setCarriedObject(null);
      const other = results.find(r => r.id !== best.id);
      farmDiary('Chose the farm site', '🗺️', `I surveyed two places for the farm. ${best.name}: ${best.ha} ha, ${best.reliefM} m of relief, ${Math.round(best.cutM3 / 1000)}k m³ to cut and ${Math.round(best.fillM3 / 1000)}k to fill, ${best.laneM} m from Yard Street. ${other ? `${other.name}: ${other.problems.length ? 'no good (' + other.problems.join(', ') + ')' : `${Math.round((other.cutM3 + other.fillM3) / 1000)}k m³ of earthwork and ${other.laneM} m of lane`}.` : ''} I picked the first. Not in town, not in the water, well off the runway field and the north yard. Stakes in at the corners.`);
      agendaStep(t.id, t.step + 1, '');
      return true;
    }
// The land work, one sweep at a time (a step finishes when its 0..1 is 1)
async function farmLandStep(key) {
      const F = farmState(), L = F.land, S = farmSite();
      const prop = { clear: 'cleared', grade: 'graded', drain: 'drained', fence: 'fenced', lane: 'lane' }[key];
      if (L[prop] >= 1) return true;
      // what it needs
      const gear = (FARM_STEP_GEAR[key] || []).map(k => [k, typeof rwGearOwned === 'function' ? rwGearOwned(k) : null]);
      const missing = gear.filter(([, v]) => !v).map(([k]) => k);
      if (missing.length) return { type: 'delivery', label: `the ${missing.map(k => ({ dozer: 'bulldozer', grader: 'motor grader', excavator: 'excavator', truck: 'dump truck' }[k] || k)).join(' and ')}` };
      const sup = { drain: [['tile', 8], ['culvert', 1]], fence: [['posts', 1], ['wire', 1], ['gates', 1]], lane: [['gravel', 20]] }[key] || [];
      for (const [k, a] of sup) if (farmStock(k) < Math.min(a, 1)) return { type: 'delivery', label: `${FARM_SUPPLIES[k].label} for the ${key === 'lane' ? 'lane' : key === 'fence' ? 'fence' : 'drainage'}` };
      if (key === 'fence' && !hasItem(/post driver/i)) return { type: 'delivery', label: 'the fence post driver' };
      for (const [, v] of gear) if (!(await farmFuelUp(v))) return farmFuelUp.why || { type: 'supply', label: `diesel for the ${farmPlain(v.name).replace(/ with .*$/, '')}` };
      farmJobActive = true;
      try {
        const sweeps = 8, k = farmFastK();
        const W = S.maxX - S.minX, D = S.maxZ - S.minZ;
        if (key === 'clear' || key === 'grade') {
          const v = gear[key === 'grade' && L.graded > 0.5 && gear[1] ? 1 : 0][1];
          const done = Math.floor(L[prop] * sweeps + 1e-6);
          farmSay(key === 'clear' ? 'Clearing the farm site' : 'Grading the farm site', key === 'clear' ? '🌲' : '🚜', key === 'clear'
            ? 'Pushing over the pines and aspens with the dozer, bucking them with the saw, picking the glacier stones onto piles by the north fence.'
            : `Cutting the knolls and filling the hollows to one level (${Math.round(farmSiteY() / FARM_U)} m above the north yard; the cut fills the hollows), the grader trimming behind.`);
          for (let i = done; i < sweeps; i++) {
            const z = S.maxZ - (i + 0.5) * D / sweeps;
            const a = { x: i % 2 ? S.maxX - 4 : S.minX + 4, z }, b = { x: i % 2 ? S.minX + 4 : S.maxX - 4, z };
            if (k <= 1 || i % k === 0 || i === sweeps - 1) { await farmDrive(v, a); await farmDrive(v, b, 0.7); }
            L[prop] = Math.min(1, (i + 1) / sweeps);
            farmBurnLitres(v, 30 * 0.6);
            if (key === 'clear') { L.stones = L[prop]; farmRefreshWild(); }
            else { farmRefreshGround(); farmRefreshWild(); }
          }
          await farmPark(v);
          farmDiary(key === 'clear' ? 'Cleared the farm site' : 'Graded the farm level', key === 'clear' ? '🌲' : '🚜', key === 'clear'
            ? `${farmWildSpots.trees.length} trees down and bucked, ${farmWildSpots.stones.length} stones on the piles by the north fence. The bench is bare now; I can see how big it really is.`
            : `Days on the dozer and the grader: the knolls cut, the hollows filled, the whole ${farmSiteText()} one level with a little fall to the ditches. ${Math.round((F.site.survey.find(r => r.id === S.id) || {}).cutM3 / 1000 || 0)}k m³ moved.`);
          return true;
        }
        if (key === 'drain') {
          const v = gear[0][1];
          farmSay('Digging the drainage ditches', '💧', 'A ditch 3 m in from the fence all the way round, falling to the low corner; drain tile under the fields to it, and a culvert under the lane.');
          const run = farmFenceRun();
          for (let i = 0; i < run.length; i++) {
            const [ax, az, bx, bz] = run[i], inset = 3 * FARM_U, cx = (S.minX + S.maxX) / 2, cz = (S.minZ + S.maxZ) / 2;
            const ia = { x: ax + Math.sign(cx - ax) * inset, z: az + Math.sign(cz - az) * inset }, ib = { x: bx + Math.sign(cx - bx) * inset, z: bz + Math.sign(cz - bz) * inset };
            if (k <= 1 || i % k === 0) { await farmDrive(v, ia); await farmDrive(v, ib, 0.5); }
            L.drained = Math.min(1, (i + 1) / run.length);
            farmBurnLitres(v, 25 * 0.5);
            farmRefreshGround();
          }
          farmUse('tile', 8); farmUse('culvert', 1);
          await farmPark(v);
          farmDiary('Ditched and drained the farm', '💧', `${Math.round(farmPerimeterM())} m of ditch round the farm, 600 m of drain tile, and the culvert under the lane. When the snow melts it will run off instead of drowning the seed.`);
          return true;
        }
        if (key === 'fence') {
          farmSay('Fencing the farm', '🪵', 'A post every 5 m with the post driver, then the woven wire stretched tight and stapled on.');
          if (typeof holdJobTool === 'function') holdJobTool(/post driver/i, 'digging');
          const run = farmFenceRun(), total = run.reduce((s, r) => s + Math.hypot(r[2] - r[0], r[3] - r[1]), 0);
          let acc = 0;
          for (let i = 0; i < run.length; i++) {
            const [ax, az, bx, bz] = run[i];
            await farmGo({ x: ax, z: az }, 300000);
            const len = Math.hypot(bx - ax, bz - az);
            if (k <= 1 || i % k === 0) { await farmGo({ x: (ax + bx) / 2, z: (az + bz) / 2 }, 300000); L.fenced = Math.min(1, (acc + len / 2) / total); farmBuildFence(); await farmGo({ x: bx, z: bz }, 300000); }
            acc += len;
            L.fenced = Math.min(1, acc / total);
            farmBuildFence();
          }
          farmUse('posts', Math.ceil(farmPerimeterM() / 5 / 50)); farmUse('wire', Math.ceil(farmPerimeterM() / 330)); farmUse('gates', 1);
          L.fenced = 1; farmBuildFence();
          if (typeof setCarriedObject === 'function') setCarriedObject(null);
          state.microPose = 'normal';
          farmDiary('Fenced the farm', '🪵', `${Math.round(farmPerimeterM())} m of fence: ${Math.ceil(farmPerimeterM() / 5)} posts and four strands of woven wire, and a 16 ft gate on the lane. It's a place now, with an inside and an outside.`);
          return true;
        }
        if (key === 'lane') {
          const g = gear[0][1], truck = gear[1][1];
          farmSay('Building the farm lane', '🛣️', `Cutting the lane down from the farm to Yard Street, ${Math.round(farmLaneLength() / FARM_U)} m, then 20 cm of crushed gravel, graded and crowned.`);
          const P = farmLanePoints();
          for (let s = 1; s <= 4; s++) {
            const f = s / 4, idx = Math.min(P.length - 1, Math.round(f * (P.length - 1)));
            if (k <= 1 || s % k === 0 || s === 4) { await farmDrive(truck, { x: P[idx][0], z: P[idx][1] + 3 }); await farmDrive(g, { x: P[idx][0], z: P[idx][1] }, 0.6); }
            L.lane = f;
            farmRefreshGround(); farmBuildLane();
          }
          farmUse('gravel', farmStock('gravel'));
          await farmPark(g); await farmPark(truck);
          farmDiary('Built the farm lane', '🛣️', `The lane is in: ${Math.round(farmLaneLength() / FARM_U)} m of gravel from the end of Yard Street up to the farm gate, and the farm roads inside: the yard, and the field road between the three fields. A truck can come and go now.`);
          return true;
        }
        return false;
      } finally { farmJobActive = false; }
    }

// What still stops a step (null: nothing, it can go on). The agenda's check asks this every few
// seconds while a task waits, so a wait ends when what it waited for is really here, not before.
function farmVehicleBlock(v) {
      if (!v) return null;
      const rule = knowHowRule(v.name);
      if (rule && !state.knowHow[rule.key]) return { type: 'skill', label: `learning to drive the ${farmPlain(v.name).replace(/ with .*$/, '')}` };
      const tank = (farmState().buildings.fueltank || {}).stage === 'done' && farmStock('diesel') > 40;
      if (fuelLeft(v) <= 5 && !tank && !(typeof fuelCanFor === 'function' && fuelCanFor('diesel'))) return { type: 'supply', label: `diesel for the ${farmPlain(v.name).replace(/ with .*$/, '')}` };
      return null;
    }
function farmPlanBlocker(t) {
      const key = (FARM_PLAN[t.step] || [])[0], F = farmState();
      if (!key) return null;
      if (['clear', 'grade', 'drain', 'fence', 'lane'].includes(key)) {
        for (const k of FARM_STEP_GEAR[key] || []) {
          const v = typeof rwGearOwned === 'function' ? rwGearOwned(k) : null;
          if (!v) return { type: 'delivery', label: `the ${({ dozer: 'bulldozer', grader: 'motor grader', excavator: 'excavator', truck: 'dump truck' })[k] || k}` };
          const b = farmVehicleBlock(v); if (b) return b;
        }
        const sup = { drain: ['tile', 'culvert'], fence: ['posts', 'wire', 'gates'], lane: ['gravel'] }[key] || [];
        for (const k of sup) if (farmStock(k) < 1 && F.land[{ drain: 'drained', fence: 'fenced', lane: 'lane' }[key]] < 1) return { type: 'delivery', label: `${FARM_SUPPLIES[k].label}` };
        if (key === 'fence' && !hasItem(/post driver/i)) return { type: 'delivery', label: 'the fence post driver' };
        return null;
      }
      if (key.startsWith('b:')) {
        const k = key.slice(2), B = FARM_BUILDINGS[k], b = F.buildings[k] || { stage: 'planned' };
        if (B.inside && (F.buildings[B.inside] || {}).stage !== 'done') return { type: 'machine', label: `the ${FARM_BUILDINGS[B.inside].label.toLowerCase()} to be finished first` };
        if ((b.stage === 'planned' || b.stage === 'staked') && B.concrete && !farmPartsHere(k, true)) return { type: 'delivery', label: `the ready-mix and rebar for the ${B.label.toLowerCase()}` };
        if (b.stage === 'curing' && !farmFoundationCured(k)) return { type: 'time', label: `the ${B.label.toLowerCase()} foundation to cure` };
        if (['frame', 'walls', 'roof'].includes(b.stage) && !farmPartsHere(k)) return { type: 'delivery', label: `the parts for the ${B.label.toLowerCase()}` };
        return null;
      }
      if (key === 'machinelist' && farmListRequest('machines') && !farmListDone('machines')) return { type: 'delivery', label: 'the tractor, the combine and the implements' };
      if (key === 'inputlist' && farmListRequest('inputs-first') && !farmListDone('inputs-first')) return { type: 'delivery', label: 'the seed, fertilizer and fuel' };
      return null;
    }
function farmSeasonBlocker(t) {
      const key = (FARM_SEASON_STEPS[t.step] || [])[0], F = farmState();
      farmSimulate();
      const w = t.waitingFor;
      if (['plough', 'disc', 'fertilize', 'seed', 'spray', 'harvest'].includes(key)) {
        if (w && w.type === 'season' && !(key === 'seed' ? farmWindowCheck() : farmSpringCheck())) return w;
        if (w && w.type === 'plant' && !farmGrowCheck()) return w;
        const O = FARM_OPS[key];
        const big = farmMachineOf('bigtractor');
        const v = O.machine === 'combine' ? farmMachineOf('combine') : ((key === 'plough' || key === 'disc') && big) ? big : farmMachineOf('tractor');
        if (!v) return { type: 'delivery', label: `the ${O.machine === 'combine' ? 'combine' : 'tractor'}` };
        if (!F.owned[O.impl]) return { type: 'delivery', label: `the ${FARM_IMPLEMENTS[O.impl].label.toLowerCase()}` };
        const b = farmVehicleBlock(v); if (b) return b;
        if (key === 'seed') { const f = F.fields.find(x => farmOpWanted(x, 'seed') && farmInWindow(x.planned)); if (f && farmStock('seed_' + f.planned) < FARM_CROPS[f.planned].seed * farmFieldHa(f) * 0.98) return { type: 'supply', label: `${FARM_CROPS[f.planned].label.toLowerCase()} seed` }; }
        if (w && w.type === 'supply' && /fertili|urea|MAP|herbicide|insecticide/i.test(w.label) && !farmInputsCheck()) return w;
        return null;
      }
      if (key === 'grow') return farmGrowCheck() ? null : (w || { type: 'plant', label: 'the crops to ripen' });
      if (key === 'dry') {
        if (!F.buildings.dryer || F.buildings.dryer.stage !== 'done') return { type: 'machine', label: 'the grain dryer to be built' };
        if (Object.values(F.wet).some(x => x.t > 0.01) && farmStock('propane') < 10) return { type: 'supply', label: 'propane for the dryer' };
      }
      return null;
    }
agendaRegisterKind('farm', { label: 'farm', check: t => { const b = farmPlanBlocker(t); return b ? { waitingFor: b } : true; }, resume: t => farmRunPlan(t) });
agendaRegisterKind('farmseason', { label: 'farm season', check: t => { const b = farmSeasonBlocker(t); return b ? { waitingFor: b } : true; }, resume: t => farmRunSeason(t) });

// --- For the AI and the Brain tab ---------------------------------------------------------------------
function farmSummaryForAI() {
      const F = state.farm;
      if (!F || !F.startedAt) return 'no farm yet (you could build a big grain farm on the benchland past the north yard: it is a long project on your agenda)';
      const b = Object.keys(F.buildings).filter(k => F.buildings[k].stage === 'done').map(k => FARM_BUILDINGS[k].label.toLowerCase());
      const fields = F.fields.map(f => `${f.name.toLowerCase()} ${f.crop ? `${f.crop} ${(farmCropStage(f) || {}).name || ''}` : f.soil}`).join(', ');
      return `farm at ${farmSiteText()}; land cleared ${Math.round(F.land.cleared * 100)}%, graded ${Math.round(F.land.graded * 100)}%, fenced ${Math.round(F.land.fenced * 100)}%; buildings done: ${b.join(', ') || 'none'}; fields: ${fields || 'not laid out'}; bins: ${farmBinSummary() || 'empty'}; flour ${Math.round(F.flour || 0)} kg; earned $${F.earnings}; home: ${F.home || 'town house'}`;
    }
if (typeof agendaSummaryForAI === 'function') {
  const farmOrigAgendaSummary = agendaSummaryForAI;
  agendaSummaryForAI = function () { const s = farmOrigAgendaSummary(); return `${s}${s ? '\n' : ''}YOUR FARM: ${farmSummaryForAI()}`; };
}
function renderFarmPanel() {
      const el = document.getElementById('farmPanel');
      if (!el) return;
      const F = state.farm, badge = document.getElementById('farmBadge');
      if (!F || !F.startedAt) {
        if (badge) badge.textContent = 'not started';
        const html = `<p class="text-xs text-slate-300">No farm yet. Kelo-1 may start one on his own; it is a long project.</p><button id="farmStartBtn" class="ui-btn ui-btn-sm ui-btn-primary mt-2">🚜 Suggest he builds a farm</button>`;
        if (el.dataset.k !== 'none') { el.innerHTML = html; el.dataset.k = 'none'; const btn = document.getElementById('farmStartBtn'); if (btn) btn.onclick = () => { farmStartGoal('My human suggested it, and I love the idea.'); renderFarmPanel(); }; }
        return;
      }
      const t = agendaGet('farm:main') || agendaState().tasks.find(x => x.ref === 'farm:main');
      const seasonT = agendaOpenTasks().find(x => x.kind === 'farmseason');
      const pct = t ? Math.round(((t.status === 'done' ? FARM_PLAN.length : t.step) / FARM_PLAN.length) * 100) : 0;
      if (badge) badge.textContent = seasonT ? 'growing' : `${pct}% built`;
      const bRows = FARM_BUILD_ORDER.map(k => { const b = F.buildings[k]; return `<span class="inline-block px-1.5 py-0.5 rounded bg-slate-800 text-2xs mr-1 mb-1">${FARM_BUILDINGS[k].emoji} ${escapeHtml(FARM_BUILDINGS[k].label)}: ${escapeHtml(b ? b.stage : 'planned')}</span>`; }).join('');
      const fRows = F.fields.map(f => { const st = farmCropStage(f); return `<div class="text-2xs text-slate-300">${escapeHtml(f.name)}: ${escapeHtml(f.crop ? `${FARM_CROPS[f.crop].label}, ${st ? st.name : ''} (${Math.round(f.g * 100)}%)` : f.soil)} · moisture ${Math.round(f.m * 100)}% · N ${Math.round(f.n)} kg/ha · weeds ${Math.round(f.w * 100)}%${f.pest ? ` · ${escapeHtml(f.pest)}` : ''}${f.crop ? ` · ~${Math.round(farmExpectedYield(f) * 10) / 10} t` : ''}</div>`; }).join('');
      const html = `<div class="space-y-1.5">
        <div class="text-xs text-slate-200">${escapeHtml(farmSiteText())}</div>
        <div class="text-2xs text-slate-400">Land: cleared ${Math.round(F.land.cleared * 100)}% · graded ${Math.round(F.land.graded * 100)}% · drained ${Math.round(F.land.drained * 100)}% · fenced ${Math.round(F.land.fenced * 100)}% · lane ${Math.round(F.land.lane * 100)}%</div>
        <div>${bRows}</div>${fRows}
        <div class="text-2xs text-slate-300">Bins: ${escapeHtml(farmBinSummary() || 'empty')}${Object.keys(F.wet).length ? ` · wet: ${escapeHtml(Object.entries(F.wet).map(([c, w]) => `${Math.round(w.t * 10) / 10} t ${c}`).join(', '))}` : ''} · flour ${Math.round(F.flour || 0)} kg · earned ${escapeHtml(typeof formatCAD === 'function' ? formatCAD(F.earnings) : '$' + F.earnings)}</div>
        <div class="text-2xs text-slate-400">Stock: ${escapeHtml(Object.keys(F.stock).filter(k => F.stock[k] > 0).map(k => `${farmFmt(k, F.stock[k])} ${FARM_SUPPLIES[k] ? FARM_SUPPLIES[k].label : k}`).join(', ') || 'none')}</div>
        <div class="text-2xs text-slate-400">Home: ${escapeHtml(F.home === 'farm' ? 'the farmhouse' : 'his town house')} · <button id="farmViewBtn" class="underline">look at the farm</button></div></div>`;
      if (el.dataset.k !== html.length + '|' + pct) { el.innerHTML = html; el.dataset.k = html.length + '|' + pct; const v = document.getElementById('farmViewBtn'); if (v) v.onclick = () => farmLookAt(); }
    }
// The camera to the farm (the Brain tab button and tests)
function farmLookAt(dist = 1) {
      const S = farmSite();
      if (!S || !camera) return;
      const cx = (S.minX + S.maxX) / 2, cz = (S.minZ + S.maxZ) / 2;
      state.cameraMode = 'none';
      camera.position.set(cx - 60 * dist, 120 * dist, S.maxZ + 140 * dist);
      if (typeof controls !== 'undefined' && controls) { controls.target.set(cx, farmSiteY(), cz + 20); controls.update(); } else camera.lookAt(cx, farmSiteY(), cz);
    }

// --- Starting it on his own ------------------------------------------------------------------------
// Once he has lived a few days (and isn't in the middle of something big), the idea comes to him.
function farmIdeaTick() {
      const F = state.farm;
      if (!F || F.startedAt || !keloIsFree() || agendaOpenTasks().length >= 3) return;
      const days = typeof daysAlive === 'function' ? daysAlive() : 0;
      if (days < 3) return;
      const roll = typeof windHash === 'function' ? windHash(7700000 + Math.floor(farmDayNow() * 4)) : Math.random();
      if (roll < 0.04) farmStartGoal();
    }

// --- Old saves, the scene, the ticks -----------------------------------------------------------------
function farmAfterGroundChange() {
      Object.keys(farmBuildingMeshes).forEach(k => { const g = farmBuildingMeshes[k], r = farmBuildingRect(k); g.position.y = getAnalyticalGroundHeight(r.x, r.z) + (FARM_BUILDINGS[k].inside ? 0.15 : 0); });
      farmBuildFence(); farmBuildLane(); farmBuildStakes();
      (state.concretePours || []).filter(p => /^farm:/.test(p.forBuild || '')).forEach(p => { if (typeof renderConcretePour === 'function') renderConcretePour(p, 1); });
    }
function farmInit3D() {
      const F = farmState();
      if (!farmSite()) return;
      farmBuildLand3D();
      farmRenderBuildings();
      farmRenderImplements();
      F.fields.forEach(f => farmRefreshFieldLook(f));
    }
// Show the farm only when the camera is out that way (it is 300+ units from the valley)
function farmVisibilityFrame() {
      if (!farmGroup || !camera) return;
      const S = farmSite(); if (!S) return;
      const cx = Math.max(S.minX - 60, Math.min(S.maxX + 60, camera.position.x)), cz = Math.max(S.minZ - 60, Math.min(S.maxZ + 60, camera.position.z));
      const d = Math.hypot(camera.position.x - cx, camera.position.z - cz);
      farmGroup.visible = d < 420;
    }
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    try {
      farmState();
      // a reload in the middle of a pass: he picks the field back up where the strips say
      if (state.farm.hitch && !state.vehicles.some(v => v.id === state.farm.hitch.vid)) state.farm.hitch = null;
      state.farm.unloading = false; state.farm.cartUnloading = false; state.farm.drying = false;
      farmSimulate();
      farmInit3D();
      if (typeof keloEveryFrame === 'function') keloEveryFrame(now => { farmImplFrame(now); farmFieldsFrame(); farmVisibilityFrame(); });
      setInterval(() => { try { farmSimulate(); farmStandTick(); farmIdeaTick(); renderFarmPanel(); if (Math.random() < 0.2) state.farm.fields.forEach(f => farmRefreshFieldLook(f, true)); } catch (e) { console.warn('farm tick', e); } }, 4000);
      renderFarmPanel();
    } catch (e) { console.warn('farm init', e); }
  }, 700);
});

// --- Tests: time and deliveries ------------------------------------------------------------------------
// Move the whole world forward by `days` world days (the calendar, his concrete, his waits)
function farmFastForward(days) {
      const ms = days * WORLD_DAY_MS, cal = ensureCalendar();
      cal.epoch -= ms;
      (state.concretePours || []).forEach(p => { if (p.pouredAt) p.pouredAt -= ms; });
      agendaOpenTasks().forEach(t => { if (t.waitingFor && Number.isFinite(t.waitingFor.until)) t.waitingFor.until -= ms; });
      if (typeof pcWeatherCache !== 'undefined' && pcWeatherCache.clear) pcWeatherCache.clear();
      farmSimulate();
      if (typeof seasonApplied !== 'undefined') seasonApplied = null;
      state.farm.fields.forEach(f => farmRefreshFieldLook(f));
    }
// The owner sends every open farm list in full (as the "Send all" button does)
function farmSendAllLists(visitor = 'test') {
      (state.requestsToUser || []).filter(r => r.category === 'joblist' && r.farm && !r.fulfilled && !r.declined).forEach(r => sendRoadworkList(r.id, null, visitor));
    }
