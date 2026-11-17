// Kelo-bot-1 — js/farm2.js
// Loaded after farm2models.js. Stage 2 of his farm: a mixed farm round the grain. One long plan on his
// agenda ("Grow a mixed farm", ref farm:mixed): read up, lay out the orchard, the vegetable plots, the
// pasture and the hay field, order and build the new buildings (pump house, packing shed and cooler, hay
// shed, coop, barn stalls, milk house with a robot milker), fence the pasture, get the compact tractor and
// the hay and garden implements, plant the orchard and bring the animals home. Then every year a task
// (kind farmmixed, ref farm:mixedyear:<year>) in which he picks the most urgent chore himself each time:
// feeding (his own hay and grain, mixed), sick animals, eggs, milk, the hay chain (mow, ted, rake, bale,
// haul), the plots (till, plant, water, weed, dig, wash and pack), the orchard (prune, spray, pick), the
// pasture, selling (stand and website) and, every autumn, the feed budget that drives what he orders or
// sells. Supplies come through the Post Office on the same list cards as stage 1. Numbers: js/farmlife.js.

// --- What he learns, drives and parks ---------------------------------------------------------------------
if (typeof GROUND_JOBS !== 'undefined') {
  GROUND_JOBS.mixedfarm = {
    title: 'running a mixed farm: orchard, market garden, livestock and hay', wiki: ['Orchard', 'Market garden', 'Dairy cattle', 'Hay'],
    learned: 'A mixed farm feeds itself: hay cut at first flower, dried, raked and baled, grain rolled into the cows\' ration, manure back on the land. Fruit trees bear after a few years if they are pruned each winter; vegetables want water, clean rows and a cool room after harvest. Animals need feed, water and a look every day.',
    tools: [], materials: []
  };
}
if (typeof GEAR_KNOWHOW !== 'undefined' && !GEAR_KNOWHOW.some(r => r.key === 'farmcompact')) GEAR_KNOWHOW.unshift({ key: 'farmcompact', re: FARM_MACHINES.compact.re, label: 'a compact tractor', wiki: 'Tractor', how: 'Low and narrow for the orchard alleys and the beds; the loader for bales and bins, the PTO for the tiller and the sprayer fan.', fuel: 'diesel' });
if (typeof VEHICLE_TYPES !== 'undefined') VEHICLE_TYPES.unshift({ kind: 'farmcompact', re: FARM_MACHINES.compact.re, mode: 'land', speed: FARM_MACHINES.compact.speed, scale: 1, seatY: 1.6 });
if (typeof VEHICLE_KIND_WORDS !== 'undefined') VEHICLE_KIND_WORDS.farmcompact = 'compact tractor';
if (typeof VEHICLE_TERRAIN !== 'undefined') VEHICLE_TERRAIN.farmcompact = { max: 0.55, road: 0.6, text: 'orchard alleys, the plots, the yard and the lane' };
FARM_VEHICLE_KINDS.add('farmcompact');
// The compact tractor lives in the hay shed (by the machine shed until that is built)
if (typeof parkingSlotsFor === 'function') {
  const farm2OrigSlots = parkingSlotsFor;
  parkingSlotsFor = function (type, name = '') {
      if (type && type.kind === 'farmcompact' && farmSite()) {
        const r = farmBuildingRect('hayshed'), sx = farmSite().id === 'west' ? -1 : 1;
        return [[r.x + sx * (r.hw + 3.5 * FARM_U), r.z + r.hd - 1.5 * FARM_U]];
      }
      return farm2OrigSlots(type, name);
    };
}
// Stage 2 implements stand in a row north of the machine shed; the roller mill sits in the workshop corner
function farm2ImplSpot(key) {
      if (key === 'rollermill') { const w = farmBuildingRect('workshop'); return { x: w.x - 1.5 * FARM_U * (farmSite().id === 'west' ? -1 : 1), z: w.z - 2 * FARM_U, rot: 0 }; }
      const keys = Object.keys(FARM_IMPLEMENTS).filter(k => FARM_IMPLEMENTS[k].stage2 && k !== 'rollermill'), i = Math.max(0, keys.indexOf(key));
      const p = farmWorld(8 + i * 3.6, 78);
      return { x: p.x, z: p.z, rot: 0 };
    }
if (typeof farmImplParkSpot === 'function') {
  const farm2OrigImplSpot = farmImplParkSpot;
  farmImplParkSpot = function (key) { return FARM_IMPLEMENTS[key] && FARM_IMPLEMENTS[key].stage2 ? farm2ImplSpot(key) : farm2OrigImplSpot(key); };
}
// Stage 1's machine list keeps to stage 1's implements; stage 2's have their own list
if (typeof farmMachineListLines === 'function') {
  const farm2OrigMachineLines = farmMachineListLines;
  farmMachineListLines = function () { return farm2OrigMachineLines().filter(l => !(l.fk === 'impl' && FARM_IMPLEMENTS[l.key] && FARM_IMPLEMENTS[l.key].stage2)); };
}

// --- Small helpers ------------------------------------------------------------------------------------------
function farm2W(xm, dm) { return farmWorld(xm, dm); }
function farm2RectWorld(R) {
      const a = farmWorld(R.x0, R.d0), b = farmWorld(R.x1, R.d1);
      return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) };
    }
function farm2Fmt(n, unit) { return `${n >= 100 ? Math.round(n) : Math.round(n * 10) / 10}${unit ? ' ' + unit : ''}`; }
function farm2Money(n) { return typeof formatCAD === 'function' ? formatCAD(n) : '$' + Math.round(n); }
function farm2Task() { return agendaGet('farm:mixed'); }
function farm2YearTask() { return agendaOpenTasks().find(t => t.kind === 'farmmixed') || null; }
function farm2Earn(amount, what) {
      const F = farmState(), X = farm2State();
      F.earnings = Math.round((F.earnings + amount) * 100) / 100;
      X.earned = Math.round(((X.earned || 0) + amount) * 100) / 100;
      F.sold.unshift({ what: String(what).slice(0, 80), price: Math.round(amount * 100) / 100, day: Math.floor(farmDayNow()) });
      if (F.sold.length > 40) F.sold.length = 40;
    }
// Work that runs a field pass on a plot needs the shared farm lock, like stage 1's jobs
async function farm2Locked(fn) {
      if (farmBusy) return false;
      farmBusy = 'mixed'; state.isPracticing = true;
      try { return await fn(); }
      finally { farmBusy = null; state.isPracticing = false; state.microPose = 'normal'; if (typeof setCarriedObject === 'function') setCarriedObject(null); if (state.riding) farmUnboard(state.vehicles.find(x => x.id === state.riding)); }
    }

// --- Parts lists (the same Post Office list card as stage 1: farm: true joblist requests) -----------------
function farm2Line(key, qty, why) { const s = FARM_SUPPLIES[key]; return { id: 's-' + key, fk: 'supply', key, name: s.ask, qty: Math.max(1, Math.ceil(qty)), unit: '×', kind: 'c', why }; }
function farm2SendList(listKey, title, icon, question, lines) {
      const req = farmSendList(listKey, title, icon, question, lines);
      const t = farm2Task(), y = farm2YearTask();
      if (req) [t, y].filter(Boolean).forEach(x => { x.data.reqIds = [...new Set([...(x.data.reqIds || []), req.id])]; });
      return req;
    }
function farm2BuildListLines() {
      const lines = [];
      FARM2_BUILD_ORDER.forEach(k => FARM_BUILDINGS[k].parts.forEach(([name, qty, kind], i) => lines.push({ id: `p-${k}-${i}`, fk: 'part', b: k, key: k, name, qty, unit: '×', kind: kind === 'c' ? 'c' : 'tool', why: FARM_BUILDINGS[k].label })));
      const P = FARM2_LAYOUT.pasture, perM = 2 * ((P.x1 - P.x0) + (P.d1 - P.d0));
      lines.push(farm2Line('posts', perM / 3 / 50 + 0.4, `${Math.round(perM)} m of pasture fence, a post every 3 m`));
      lines.push(farm2Line('wire', perM * 3 / 330, 'three strands of high-tensile wire round the pasture'));
      lines.push(farm2Line('gates', 2, 'the pasture gate and the hen-run gate'));
      lines.push({ id: 't-trough', fk: 'tool', name: 'A 1100 L galvanized stock tank with a float valve', re: 'stock tank', qty: 1, unit: '', kind: 'tool', why: 'water in the pasture' });
      return lines;
    }
function farm2MachineListLines() {
      const lines = [{ id: 'm-compact', fk: 'machine', key: 'compact', name: FARM_MACHINES.compact.ask, qty: 1, unit: '', kind: 'vehicle', why: 'narrow enough for the orchard alleys and the beds; the loader moves bales and bins' }];
      Object.entries(FARM_IMPLEMENTS).filter(([, I]) => I.stage2).forEach(([k, I]) => lines.push({ id: 'i-' + k, fk: 'impl', key: k, name: I.ask, qty: 1, unit: '', kind: 'tool',
        why: FARM_OPS[I.op] ? FARM_OPS[I.op].label.toLowerCase() : { haulhay: 'hauls the bales to the hay shed', mix: 'mixes hay and rolled grain into the cows\' ration', grind: 'rolls corn and wheat for the cattle, grinds layer mash for the hens' }[I.op] || I.op }));
      lines.push({ id: 't-prune', fk: 'tool', name: 'Bypass pruning shears, loppers and a pruning saw', re: 'pruning shears|loppers', qty: 1, unit: '', kind: 'tool', why: 'winter pruning' });
      lines.push({ id: 't-pick', fk: 'tool', name: 'An orchard tripod ladder and four picking bags', re: 'tripod ladder|picking bag', qty: 1, unit: '', kind: 'tool', why: 'picking fruit' });
      lines.push({ id: 't-hmt', fk: 'tool', name: 'A hay moisture tester', re: 'hay moisture tester', qty: 1, unit: '', kind: 'tool', why: 'so I bale at 18% and not wetter' });
      return lines;
    }
function farm2OrchardTrees() {
      const L = FARM2_LAYOUT.orchard, len = L.x1 - L.x0 - 2;
      return { apple: L.rows.apple * Math.floor(len / L.treeM.apple), cherry: L.rows.cherry * Math.floor(len / L.treeM.cherry), rows: L.rows.apple + L.rows.cherry };
    }
function farm2OrchardListLines() {
      const T = farm2OrchardTrees();
      return [farm2Line('trees_apple', T.apple / 25, `${T.apple} Ambrosia trees, 11 rows at 1.2 m`), farm2Line('trees_cherry', T.cherry / 10, `${T.cherry} Sweetheart trees, 3 rows at 2.5 m`),
        farm2Line('trellis', T.rows, `${T.rows} rows of trellis, posts every 10 m`), farm2Line('guards', (T.apple + T.cherry) / 50, 'a guard on every trunk against voles'),
        farm2Line('driptape', 1, 'drip along every row'), farm2Line('compost', 1, 'in the planting holes')];
    }
function farm2PlotHa(p) { return farmFieldHa(p); }
function farm2PlotListLines(withHay) {
      const X = farm2State(), lines = [], need = {};
      FARM2_LAYOUT.plots.forEach(L => { const p = X.plots.find(q => q.id === L.id); const ha = p ? farm2PlotHa(p) : (L.x1 - L.x0) * (L.d1 - L.d0) / 10000; const C = FARM_CROPS[L.crop]; need['seed_' + L.crop] = (need['seed_' + L.crop] || 0) + C.seed * ha; });
      if (withHay) { const f = farmState().fields.find(x => x.id === FARM2_LAYOUT.hayField) || farm2HayField(); if (f) need.seed_hay = FARM_CROPS.hay.seed * farmFieldHa(f); }
      Object.entries(need).forEach(([k, amt]) => { const short = amt - farmStock(k); if (short > 0.01) lines.push(farm2Line(k, short / FARM_SUPPLIES[k].per, `${farmFmt(k, amt)} of ${FARM_SUPPLIES[k].label}`)); });
      if (farmStock('compost') < 5) lines.push(farm2Line('compost', 1, 'worked into the beds'));
      if (farmStock('driptape') < 1500) lines.push(farm2Line('driptape', 1, 'a line down every bed'));
      if (farmStock('boxes') < 100) lines.push(farm2Line('boxes', 1, 'to pack what I harvest'));
      return lines;
    }
function farm2AnimalListLines() {
      const S = FARM2_STOCKING, lines = [];
      ['dairy', 'beef', 'hen'].forEach(k => lines.push({ id: 'a-' + k, fk: 'animal', key: k, name: FARM_ANIMALS[k].ask, qty: S[k], unit: '×', kind: 'vehicle', why: { dairy: 'milk, bottled in the milk house', beef: 'calves raised for grass-fed beef', hen: 'eggs for the stand' }[k] }));
      [['mineral', 2, 'free-choice and in the ration'], ['premix', 4, 'the protein in the layer mash'], ['oyster', 1, 'shells for the eggs'], ['vetkit', 1, 'for whoever gets sick'],
       ['bedding', 1, 'stalls and nest boxes'], ['cartons', 1, 'eggs'], ['bottles', 1, 'milk'], ['netwrap', 1, 'round bales'], ['twine', 1, 'small squares']].forEach(([k, q, why]) => lines.push(farm2Line(k, q, why)));
      return lines;
    }
// Opening a mixed-farm kit: the animals come off the hauler's trailer (the rest is stage 1's code)
if (typeof farmOpenKit === 'function') {
  const farm2OrigOpenKit = farmOpenKit;
  farmOpenKit = async function (parcel, req) {
      const animals = [];
      (parcel.jobKit.lines || []).forEach(([id, qty]) => { const l = req.lines.find(x => x.id === id); if (l && l.fk === 'animal') animals.push([l, qty]); });
      const r = await farm2OrigOpenKit(parcel, req);
      animals.forEach(([l, qty]) => { farm2AnimalsArrive(l.key, qty); l.got = Math.min(l.qty, (l.got || 0) + qty); });
      return r;
    };
}
function farm2AnimalsArrive(kind, qty) {
      const X = farm2State(), d = Math.floor(farmDayNow()), doy = farmDayInfo(d).doy;
      if (kind === 'hen') { X.flock.n += qty; if (X.flock.since == null) X.flock.since = d; X.feeder = Math.max(X.feeder, qty * FARM_ANIMALS.hen.feedKg * 4); }
      else for (let i = 0; i < qty; i++) {
        // bred cows, due in the spring (calving from day ~90 of the year)
        // (bought in the spring itself: they are close to calving, a few weeks apart)
        let toSpring = (92 + i * 6 - doy + DAYS_PER_YEAR) % DAYS_PER_YEAR;
        if (toSpring < 25 || toSpring > 330) toSpring = 18 + i * 9;
        const a = farm2NewAnimal(kind, { due: d + Math.min(toSpring, FARM_ANIMALS[kind].gestation - 30) });
        if (kind === 'dairy') a.calved = d - 200 - i * 20;   // second lactation, still milking
        X.herd.push(a);
      }
      // a day of hay in the bunk to settle them in
      if (kind !== 'hen') X.bunk = Math.max(X.bunk, farm2CattleDemand().tmr * 1.5);
      farm2Log(`${qty} ${FARM_ANIMALS[kind].label.toLowerCase()}${qty > 1 ? 's' : ''} arrived`);
      farm2Place3D();
    }
// The building parts of stage 2 are on their own list
if (typeof farmPartsHere === 'function') {
  const farm2OrigPartsHere = farmPartsHere;
  farmPartsHere = function (key, concreteOnly = false) {
      if (!(FARM_BUILDINGS[key] && FARM_BUILDINGS[key].stage2)) return farm2OrigPartsHere(key, concreteOnly);
      const req = (state.requestsToUser || []).filter(r => r.farm && r.farmList === 'mixed-buildings').sort((a, b) => b.listRev - a.listRev)[0];
      if (!req) return false;
      return req.lines.filter(l => l.b === key && (!concreteOnly || l.kind === 'c')).every(l => farmLineGot(l) >= l.qty);
    };
}
if (typeof farmBuildingDone === 'function') {
  const farm2OrigBuildingDone = farmBuildingDone;
  farmBuildingDone = function (key) {
      const say = {
        well: 'The well is drilled, 60 m, and the pump house is up over it: pump, pressure tank, the drip manifold with its filter and timer. Water for the orchard, the plots and the animals.',
        packshed: 'The packing shed is finished: a walk-in cooler at 1 °C, the barrel washer, stainless sinks and a packing table. Fruit and vegetables keep for months in there.',
        hayshed: 'The hay shed is up: twelve poles and a steel roof. Hay stacked under it stays dry all winter.',
        coop: 'The chicken coop is built: nest boxes, roosts, a pop door that opens with the light, and a fenced run.',
        stalls: 'The barn is fitted out for cows: free stalls with rubber mats, headlocks along the feed alley, frost-free waterers and a calving pen.',
        milkhouse: 'The milk house is done: the milking robot, a 1000 L cooled bulk tank, a 100 L pasteurizer and the bottle filler. The cows can milk themselves when they like.'
      }[key];
      if (!say) return farm2OrigBuildingDone(key);
      farmDiary(`Finished the ${FARM_BUILDINGS[key].label.toLowerCase()}`, FARM_BUILDINGS[key].emoji, say);
      farm2Refresh3D(true);
    };
}

// --- The plan: "Grow a mixed farm" ------------------------------------------------------------------------
const FARM2_PLAN = [
  ['research', 'Read up on orchards, market gardens, livestock and hay'], ['layout', 'Lay out the orchard, plots, pasture and hay field'],
  ['buildlist', 'Send the list for the new buildings and the pasture fence'],
  ...FARM2_BUILD_ORDER.map(k => ['b:' + k, { well: 'Drill the well and build the pump house', packshed: 'Build the packing shed and cooler', hayshed: 'Put up the hay shed', coop: 'Build the chicken coop', stalls: 'Fit stalls into the barn', milkhouse: 'Build the milk house' }[k]]),
  ['pasture', 'Fence the pasture and set the water tank'], ['machinelist', 'Send the list for the compact tractor and the implements'],
  ['orchardlist', 'Order the fruit trees and the trellis'], ['orchard', 'Plant the orchard'], ['plotlist', 'Order seed for the plots and the hay'],
  ['animallist', 'Order the cows and the hens'], ['animals', 'Bring the animals home'], ['year', 'Start the first year of the mixed farm']
];
const FARM2_GOAL = { id: 'farm2', title: 'Grow a mixed farm: orchard, vegetables, livestock and hay', emoji: '🐄',
  why: 'Grain is only half a farm. I want fruit trees, a vegetable garden, cows and hens, and hay and feed from my own fields for them.',
  steps: FARM2_PLAN.map(s => s[1]) };
window.KELO_FARM2_GOAL = FARM2_GOAL;
function farm2Ready() { const t = agendaState().tasks.find(x => x.ref === 'farm:main'); return Boolean(t && t.status === 'done'); }
function farm2StartGoal(why = '') {
      const X = farm2State();
      if (farm2Task()) return farm2Task();
      if (!farm2Ready()) return null;
      if (X.startedAt && agendaState().tasks.find(t => t.ref === 'farm:mixed' && t.status === 'done')) return null;
      X.startedAt = X.startedAt || Date.now();
      X.lastDay = Math.floor(farmDayNow());
      const t = agendaAdd({ ref: 'farm:mixed', kind: 'farm2', title: FARM2_GOAL.title, emoji: FARM2_GOAL.emoji, priority: 3, why: why || FARM2_GOAL.why, steps: FARM2_GOAL.steps, data: {} });
      farm2GoalAdopt();
      farmDiary('The next part of the farm', '🐄', `The grain is growing, and the north-west corner of the farm is still empty. I want a real mixed farm: an orchard of apples and cherries, a market garden, a few Jersey and Angus cows and a flock of hens, and hay from the north field to feed them, with my own corn and wheat rolled into their ration. ${FARM2_PLAN.length} steps on my list.`);
      return t;
    }
function farm2PlanStepIndex(key) { return FARM2_PLAN.findIndex(s => s[0] === key); }
async function farm2RunPlan(t) {
      if (farmBusy || !t || agendaClosed(t)) return false;
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping || state.isCollectingMail) return false;
      const key = FARM2_PLAN[t.step][0], X = farm2State();
      if (key === 'research') {
        if (!jobKnown('mixedfarm')) { const r = await researchJob('mixedfarm', 'Reading Up on Mixed Farming'); if (!jobKnown('mixedfarm')) return r === false ? false : 'researching'; }
        agendaStep(t.id, 1, 'I read how orchards, market gardens, cows, hens and hay fit together. Next: where each goes.');
        return true;
      }
      farmBusy = t.id; state.isPracticing = true;
      try {
        if (key === 'layout') return await farm2DoLayout(t);
        if (key === 'buildlist') {
          const req = farm2SendList('mixed-buildings', 'Farm list: mixed-farm buildings and fence', '🏗️', 'Six buildings for the mixed farm: a well and pump house, a packing shed with a walk-in cooler, a hay shed, a chicken coop, stalls in the barn and a milk house with a milking robot. And the pasture fence. These are the real parts.', farm2BuildListLines());
          farmSay('Farm list: the mixed farm', '📮', req ? `I sent the list for the new buildings: ${req.lines.length} lines.` : 'Everything for the new buildings is here already.');
          agendaStep(t.id, t.step + 1, '');
          return true;
        }
        if (key.startsWith('b:')) {
          const b = key.slice(2);
          const r = await farmBuildStep(b);
          if (r === true) { agendaStep(t.id, t.step + 1, `${FARM_BUILDINGS[b].label} done.`); farm2Refresh3D(true); return true; }
          if (r && typeof r === 'object') { agendaWait(t.id, { ...r, test: 'farmPlanCheck' }); return 'waiting'; }
          return true;
        }
        if (key === 'pasture') {
          const r = await farm2FencePasture();
          if (r === true) { agendaStep(t.id, t.step + 1, 'The pasture is fenced and watered.'); return true; }
          agendaWait(t.id, { ...r, test: 'farmPlanCheck' }); return 'waiting';
        }
        if (key === 'machinelist') {
          if (!farmListRequest('mixed-machines')) farm2SendList('mixed-machines', 'Farm list: compact tractor and implements', '🚜', 'A compact tractor for the orchard and the plots, the hay line (mower-conditioner, tedder, rake, round and square balers, a hay wagon), the garden implements, an airblast sprayer, a TMR mixer and a roller mill for the feed.', farm2MachineListLines());
          if (!farmListDone('mixed-machines')) { agendaWait(t.id, { type: 'delivery', label: 'the compact tractor and the implements', test: 'farmPlanCheck' }); return 'waiting'; }
          const v = farmMachineOf('compact');
          if (v && !state.knowHow[(knowHowRule(v.name) || {}).key]) doWhenFree(() => learnToUse(v.name, 'Learning the Compact Tractor'), { key: 'learn:' + v.name });
          farmDiary('The mixed-farm machines are here', '🚜', 'The compact tractor with its loader, the mower-conditioner, the tedder, the wheel rake, both balers, the hay wagon, the tiller, the planter, the cultivator, the digger, the orchard sprayer, the TMR mixer and the roller mill. A whole second fleet.');
          agendaStep(t.id, t.step + 1, '');
          return true;
        }
        if (key === 'orchardlist') {
          farm2SendList('mixed-orchard', 'Farm list: fruit trees and trellis', '🍎', `${farm2OrchardTrees().apple} apple and ${farm2OrchardTrees().cherry} cherry trees for a tall-spindle orchard, with the trellis, guards and drip.`, farm2OrchardListLines());
          agendaStep(t.id, t.step + 1, '');
          return true;
        }
        if (key === 'orchard') {
          const r = await farm2PlantOrchard();
          if (r === true) { agendaStep(t.id, t.step + 1, 'The orchard is planted.'); return true; }
          agendaWait(t.id, { ...r, test: 'farmPlanCheck' }); return 'waiting';
        }
        if (key === 'plotlist') {
          const lines = farm2PlotListLines(true);
          if (lines.length) farm2SendList('mixed-plots-first', 'Farm list: seed for the plots and the hay', '🥕', 'Yukon Gold seed potatoes, carrot, squash and bean seed for the four plots, alfalfa-grass seed for the north field, compost, drip tape and produce boxes.', lines);
          agendaStep(t.id, t.step + 1, '');
          return true;
        }
        if (key === 'animallist') {
          if (!farmListRequest('mixed-animals')) farm2SendList('mixed-animals', 'Farm list: cows, hens and their supplies', '🐄', `${FARM2_STOCKING.dairy} bred Jersey cows, ${FARM2_STOCKING.beef} bred Angus cows and ${FARM2_STOCKING.hen} laying hens, with mineral, premix, oyster shell, vet supplies, bedding, cartons and bottles. The stalls and the coop are ready.`, farm2AnimalListLines());
          agendaStep(t.id, t.step + 1, '');
          return true;
        }
        if (key === 'animals') {
          if (!farmListDone('mixed-animals', l => l.fk === 'animal')) { agendaWait(t.id, { type: 'delivery', label: 'the cows and the hens', test: 'farmPlanCheck' }); return 'waiting'; }
          await farm2WelcomeAnimals();
          agendaStep(t.id, t.step + 1, '');
          return true;
        }
        if (key === 'year') {
          farm2StartYear('The mixed farm is set up: now its first year');
          agendaDone(t.id, `The mixed farm is set up: an orchard of ${X.orchard.planted.apple + X.orchard.planted.cherry} trees, four plots, ${farm2Cattle().length} cattle and ${X.flock.n} hens, the north field going to hay.`);
          farmDiary('The mixed farm is set up', '🐄', `Orchard planted, plots laid out, the pasture fenced, ${farm2Cattle().length} cows in the barn and ${X.flock.n} hens in the coop. From now on I decide each day what needs doing most: the animals first, then whatever the season and the weather call for.`);
          return true;
        }
        return false;
      } finally { farmBusy = null; state.isPracticing = false; state.microPose = 'normal'; if (typeof setCarriedObject === 'function') setCarriedObject(null); if (state.riding) farmUnboard(state.vehicles.find(x => x.id === state.riding)); }
    }
// Lay out: stakes at the orchard, plots and pasture corners; the four plots become fields of his; the north
// field is marked for hay (it goes over once its grain is off)
async function farm2DoLayout(t) {
      const X = farm2State(), F = farmState();
      FARM2_LAYOUT.plots.forEach(L => {
        if (X.plots.some(p => p.id === L.id)) return;
        const r = farm2RectWorld(L), p = farmNewField(L.id, L.name, r);
        p.use = 'vegetable'; p.planned = L.crop; p.plan = L.crop; p.w = 0.3;
        X.plots.push(p);
      });
      X.hayPlanned = FARM2_LAYOUT.hayField;
      X.laidOut = true;
      farm2ClaimHayField();
      farmBuildStakes();
      const O = FARM2_LAYOUT.orchard, P = FARM2_LAYOUT.pasture;
      farmSay('Laying out the mixed farm', '📐', 'Tape and stakes: the orchard rows north of the yard, four vegetable plots beyond them, the pasture along the field road, and the north field for hay.');
      if (typeof holdJobTool === 'function') holdJobTool(/total station|survey|tape/i, 'normal');
      for (const [xm, dm] of [[O.x0, O.d0], [O.x1, O.d1], [P.x0, P.d0], [P.x1, P.d1]].slice(0, farmFastK() > 1 ? 2 : 4)) { const p = farm2W(xm, dm); await farmGo({ x: p.x, z: p.z }, 240000); await farmPause(1500); }
      farm2Refresh3D(true);
      X.plots.forEach(p => farmRefreshFieldLook(p));
      farmDiary('Laid out the mixed farm', '📐', `Staked it all out. The orchard: ${farm2OrchardTrees().rows} rows, 3.5 m apart, east-west for the sun. Four plots of about ${Math.round(farm2PlotHa(X.plots[0]) * 10000)} m² each for potatoes, carrots, squash and beans. A ${Math.round(farm2PastureHa() * 100) / 100} ha pasture beside the field road. And the north field (${Math.round(farmFieldHa(F.fields.find(f => f.id === FARM2_LAYOUT.hayField) || F.fields[0] || { x0: 0, x1: 1, z0: 0, z1: 1 }) * 100) / 100} ha) goes to alfalfa-grass hay after this crop: the cows need it more than the bins do.`);
      agendaStep(t.id, t.step + 1, '');
      return true;
    }
// The pasture fence: a post every 3 m with the driver, three strands of wire, a gate and a water tank
async function farm2FencePasture() {
      const X = farm2State();
      if (!hasItem(/post driver/i)) return { type: 'delivery', label: 'the fence post driver' };
      if (farmStock('posts') < 1 || farmStock('wire') < 1) return { type: 'delivery', label: 'fence posts and wire for the pasture' };
      if (!hasItem(/stock tank/i)) return { type: 'delivery', label: 'the stock tank for the pasture' };
      farmSay('Fencing the pasture', '🪵', 'A post every 3 m with the driver, three strands of high-tensile wire, the gate by the yard and a stock tank with a float.');
      if (typeof holdJobTool === 'function') holdJobTool(/post driver/i, 'digging');
      const P = FARM2_LAYOUT.pasture, corners = [[P.x0, P.d0], [P.x0, P.d1], [P.x1, P.d1], [P.x1, P.d0], [P.x0, P.d0]];
      const k = farmFastK();
      for (let i = Math.floor(X.pasture.fenced * 4); i < 4; i++) {
        const a = farm2W(...corners[i]), b = farm2W(...corners[i + 1]);
        if (k <= 1 || i % 2 === 0) { await farmGo({ x: a.x, z: a.z }, 240000); await farmGo({ x: b.x, z: b.z }, 240000); }
        X.pasture.fenced = Math.min(1, (i + 1) / 4);
        farm2Refresh3D(true);
        await farmPause(1200);
      }
      const per = 2 * ((P.x1 - P.x0) + (P.d1 - P.d0));
      farmUse('posts', Math.ceil(per / 3)); farmUse('wire', Math.ceil(per * 3 / 330)); farmUse('gates', 2);
      if (typeof setCarriedObject === 'function') setCarriedObject(null);
      state.microPose = 'normal';
      farmDiary('Fenced the pasture', '🪵', `${Math.round(per)} m of three-strand fence round the pasture, a gate by the yard and an 1100 L stock tank on a float valve from the well. The cows can go out on grass in the summer.`);
      return true;
    }
// Planting the orchard: trellis posts and wire, then a tree every 1.2 m (cherries 2.5 m), guards and drip
async function farm2PlantOrchard() {
      const X = farm2State(), O = X.orchard, L = FARM2_LAYOUT.orchard, T = farm2OrchardTrees();
      if (farmStock('trees_apple') < 1 && O.planted.apple < T.apple) return { type: 'delivery', label: 'the apple trees' };
      if (farmStock('trees_cherry') < 1 && O.planted.cherry < T.cherry) return { type: 'delivery', label: 'the cherry trees' };
      if (farmStock('trellis') < 1 && O.trellisRows < T.rows) return { type: 'delivery', label: 'the orchard trellis' };
      const doy = farmDayInfo(farmDayNow()).doy;
      // bare-root trees go in while they are dormant: early spring or late autumn, with the ground open
      if (farmDayInfo(farmDayNow()).frozen || (doy > 135 && doy < 280)) return { type: 'season', label: 'planting time for bare-root trees (early spring or late autumn)', until: Date.now() + 20 * 60000 / farmFastK() };
      const k = farmFastK();
      farmSay('Planting the orchard', '🌳', 'Trellis posts every 10 m, three wires, then the trees: graft union a hand above the soil, watered in, guard on, tied to the wire.');
      for (let r = 0; r < T.rows; r++) {
        const crop = r < L.rows.apple ? 'apple' : 'cherry', dm = L.d0 + 1.75 + r * L.rowM;
        const per = Math.floor((L.x1 - L.x0 - 2) / L.treeM[crop]);
        const rowStart = crop === 'apple' ? r * per : (r - L.rows.apple) * per;
        if (O.planted[crop] >= rowStart + per) continue;
        if (k <= 1 || r % k === 0 || r === T.rows - 1) {
          if (typeof holdJobTool === 'function') holdJobTool(/post driver/i, 'digging');
          const a = farm2W(L.x0 + 1, dm), b = farm2W(L.x1 - 1, dm);
          await farmGo({ x: a.x, z: a.z + 0.8 }, 240000);
          await farmGo({ x: b.x, z: b.z + 0.8 }, 240000);
        }
        O.trellisRows = Math.max(O.trellisRows, r + 1);
        const have = Math.floor(farmStock('trees_' + crop) + 1e-6);
        const n = Math.min(per, have);
        farmUse('trees_' + crop, n); farmUse('guards', n / 50);
        O.planted[crop] = Math.min(T[crop], O.planted[crop] + n);
        if (O.plantedDay[crop] == null) O.plantedDay[crop] = Math.floor(farmDayNow());
        farm2Refresh3D(true);
        await farmPause(1200);
        if (n < per) return { type: 'delivery', label: `more ${crop} trees` };
      }
      farmUse('trellis', T.rows); farmUse('compost', 1); farmUse('driptape', 400);
      if (typeof setCarriedObject === 'function') setCarriedObject(null);
      if (typeof gainSkill === 'function') gainSkill('orcharding', 'orcharding', 5);
      farmDiary('Planted the orchard', '🌳', `${O.planted.apple} Ambrosia apple trees and ${O.planted.cherry} Sweetheart cherries in ${T.rows} rows on a trellis, every one guarded and on drip. Apples on M9 bear a little in their second year and fully by the fourth; the cherries take a year longer. Pruning every winter decides how good the fruit is.`);
      return true;
    }
async function farm2WelcomeAnimals() {
      const X = farm2State(), pen = farm2RectWorld(FARM2_LAYOUT.pen);
      await farmGo({ x: (pen.x0 + pen.x1) / 2, z: pen.z1 + 2 }, 240000);
      farmSay('The animals are here', '🐄', `The hauler backed up to the barn: ${farm2Cattle().length} cows walked down the ramp into the pen, and ${X.flock.n} hens went into the coop in crates.`);
      farm2Place3D();
      await farmPause(3000);
      farmDiary('My cows and hens came home', '🐄', `${farm2Adults('dairy').map(a => a.name).join(', ')} are Jerseys, still milking; ${farm2Adults('beef').map(a => a.name).join(', ')} are Black Angus. All bred, due in the spring. ${X.flock.n} ISA Brown hens just at the point of lay. I gave each cow a look over, filled the bunk and the feeder, and checked the waterers. They are mine to look after every day now.`);
    }
function farm2PlanBlocker(t) {
      const key = (FARM2_PLAN[t.step] || [])[0], F = farmState(), X = farm2State();
      if (!key) return null;
      if (key.startsWith('b:')) {
        const k = key.slice(2), B = FARM_BUILDINGS[k], b = F.buildings[k] || { stage: 'planned' };
        if (B.inside && (F.buildings[B.inside] || {}).stage !== 'done') return { type: 'machine', label: `the ${FARM_BUILDINGS[B.inside].label.toLowerCase()} to be finished first` };
        if ((b.stage === 'planned' || b.stage === 'staked') && B.concrete && !farmPartsHere(k, true)) return { type: 'delivery', label: `the ready-mix and rebar for the ${B.label.toLowerCase()}` };
        if (b.stage === 'curing' && !farmFoundationCured(k)) return { type: 'time', label: `the ${B.label.toLowerCase()} foundation to cure` };
        if (['planned', 'staked', 'frame', 'walls', 'roof'].includes(b.stage) && !B.concrete && !farmPartsHere(k)) return { type: 'delivery', label: `the parts for the ${B.label.toLowerCase()}` };
        if (['frame', 'walls', 'roof'].includes(b.stage) && !farmPartsHere(k)) return { type: 'delivery', label: `the parts for the ${B.label.toLowerCase()}` };
        return null;
      }
      if (key === 'pasture') {
        if (!hasItem(/post driver/i)) return { type: 'delivery', label: 'the fence post driver' };
        if (X.pasture.fenced < 1 && (farmStock('posts') < 1 || farmStock('wire') < 1)) return { type: 'delivery', label: 'fence posts and wire for the pasture' };
        if (!hasItem(/stock tank/i)) return { type: 'delivery', label: 'the stock tank for the pasture' };
        return null;
      }
      if (key === 'machinelist' && farmListRequest('mixed-machines') && !farmListDone('mixed-machines')) return { type: 'delivery', label: 'the compact tractor and the implements' };
      if (key === 'orchard') {
        const T = farm2OrchardTrees(), O = X.orchard;
        if (farmStock('trees_apple') < 1 && O.planted.apple < T.apple) return { type: 'delivery', label: 'the apple trees' };
        if (farmStock('trees_cherry') < 1 && O.planted.cherry < T.cherry) return { type: 'delivery', label: 'the cherry trees' };
        const w = t.waitingFor;
        if (w && w.type === 'season') { const doy = farmDayInfo(farmDayNow()).doy; if (farmDayInfo(farmDayNow()).frozen || (doy > 135 && doy < 280)) return w; }
        return null;
      }
      if (key === 'animals' && farmListRequest('mixed-animals') && !farmListDone('mixed-animals', l => l.fk === 'animal')) return { type: 'delivery', label: 'the cows and the hens' };
      return null;
    }
agendaRegisterKind('farm2', { label: 'mixed farm', check: t => { const b = farm2PlanBlocker(t); return b ? { waitingFor: b } : true; }, resume: t => farm2RunPlan(t) });
