// Kelo-bot-1 — js/farm2year.js
// Loaded after farm2.js. The mixed farm's year (agenda kind farmmixed, ref farm:mixedyear:<year>). Each
// time the task comes up he looks at the whole farm and does the chore that matters most right now
// (farm2Chores: each candidate has an urgency; the animals' feed and health come first), then the next.
// The task's four steps are the seasons; it is done when the next spring comes and a new year begins.
// Field passes on the plots and the hay field use stage 1's farmWorkField (js/farm.js): the same strips,
// hitching, fuel and parking. What each pass does to a plot is farm2OpDone below.

const FARM2_PLURAL = { apple: 'apples', cherry: 'cherries' };
const FARM2_YEAR_STEPS = [['spring', 'Spring: prune, plant the plots, calving'], ['summer', 'Summer: hay, water, weeds, cherries'], ['autumn', 'Autumn: apples, dig, feed up for winter'], ['winter', 'Winter: feed, milk, plan next year']];
function farm2SeasonIndex(d = farmDayNow()) { const s = farmDayInfo(d).season; return { Spring: 0, Summer: 1, Autumn: 2, Winter: 3 }[s]; }
function farm2StartYear(why = '') {
      const yr = worldNow().year, ref = 'farm:mixedyear:' + yr;
      if (agendaGet(ref)) return agendaGet(ref);
      const open = farm2YearTask();
      if (open) return open;
      return agendaAdd({ ref, kind: 'farmmixed', title: `Run the mixed farm (year ${yr})`, emoji: '🐄', priority: 4, why: why || 'The orchard, the plots, the hay and the animals, day by day',
        steps: FARM2_YEAR_STEPS.map(s => s[1]), data: { year: yr, startedSeason: farm2SeasonIndex(), chores: 0 } });
    }

// --- What each pass does to a plot or the hay field ---------------------------------------------------------
const FARM2_OPS = new Set(['till', 'plant', 'cultivate', 'dig', 'orchardspray', 'mow', 'ted', 'rake', 'bale', 'balesq']);
function farm2OpDone(f, opKey) {
      const X = farm2State(), d = Math.floor(farmDayNow());
      if (opKey === 'till') { f.soil = 'harrowed'; f.w = Math.max(0.02, f.w * 0.3); f.n = Math.min(220, f.n + 25); }
      if (opKey === 'plant') { f.soil = 'seeded'; f.g = 0; f.yp = 1; f.seededDay = d; f.pest = null; f.p = 0; f.w = Math.min(f.w, 0.05); f.harvestedT = 0; f.ripeDay = null; }
      if (opKey === 'cultivate') { f.w = Math.max(0.02, f.w * 0.2); f.cultivated = d; }
      if (opKey === 'dig') {
        const C = FARM_CROPS[f.crop], t = farmExpectedYield(f);
        const kg = Math.round(t * 1000);
        farm2StoreAdd(f.crop, kg);
        X.harvests = X.harvests || [];
        X.harvests.unshift({ plot: f.name, crop: f.crop, kg, day: d, year: worldNow().year, tPerHa: Math.round(t / farmFieldHa(f) * 10) / 10 });
        if (X.harvests.length > 30) X.harvests.length = 30;
        f.history.push(f.crop); if (f.history.length > 6) f.history.shift();
        f.lastCrop = f.crop; f.crop = null; f.soil = 'stubble'; f.g = 0; f.lastKg = kg;
        X.irrigating[f.id] = false;
        farmLog(`Harvested ${kg} kg ${C ? C.label.toLowerCase() : ''} from the ${f.name.toLowerCase()}`);
      }
      if (opKey === 'mow') {
        f.swath = { t: Math.round(farm2HayYieldT(f) * 100) / 100, m: FARM_CROPS.hay.mowMoisture, q: Math.min(1, f.q || 1) * (f.g > 1.1 ? 0.85 : 1), stage: 'swath', day: d, days: 0, n: f.op ? f.op.n : 20 };
        f.g = 0.06; f.ripeDay = null; f.q = 1; f.cutsThisYear = (f.cutsThisYear || 0) + 1; f.w = Math.max(0.02, f.w * 0.8);
      }
      if (opKey === 'ted' && f.swath) f.swath.stage = 'tedded';
      if (opKey === 'rake' && f.swath) f.swath.stage = 'windrow';
      if ((opKey === 'bale' || opKey === 'balesq') && f.swath) {
        const S = f.swath, kg = S.t * 1000 * (1 - Math.max(0, S.m - 15) / 100);
        const n = opKey === 'bale' ? Math.max(1, Math.round(kg / 450)) : Math.max(1, Math.round(kg / 25));
        X.fieldBales = X.fieldBales || { round: 0, square: 0, q: 1, field: f.id };
        if (opKey === 'bale') X.fieldBales.round += n; else X.fieldBales.square += n;
        X.fieldBales.q = S.q; X.fieldBales.field = f.id;
        farmUse(opKey === 'bale' ? 'netwrap' : 'twine', n);
        X.hayLog = X.hayLog || [];
        X.hayLog.unshift({ day: d, cut: f.cutsThisYear, bales: n, kind: opKey === 'bale' ? 'round' : 'square', m: Math.round(S.m), q: Math.round(S.q * 100) });
        if (X.hayLog.length > 20) X.hayLog.length = 20;
        f.swath = null;
      }
      f.op = null;
      farmLog(`${FARM_OPS[opKey] ? FARM_OPS[opKey].label : opKey} done: ${f.name}`);
      farmRefreshFieldLook(f);
      farm2Refresh3D(true);
    }
if (typeof farmFieldOpDone === 'function') {
  const farm2OrigOpDone = farmFieldOpDone;
  farmFieldOpDone = function (f, opKey) { return FARM2_OPS.has(opKey) ? farm2OpDone(f, opKey) : farm2OrigOpDone(f, opKey); };
}
// The crop is gone behind the mower and the digger, strip by strip (as behind the combine)
if (typeof farmHarvestedAt === 'function') {
  const farm2OrigHarvestedAt = farmHarvestedAt;
  farmHarvestedAt = function (f, x, z) {
      const op = f.op;
      if (op && (op.key === 'mow' || op.key === 'dig')) {
        const n = op.n, i = Math.max(0, Math.min(n - 1, Math.floor((f.z1 - z) / ((f.z1 - f.z0) / n))));
        return Boolean(op.done[i] || (op.cur === i && farmStripPartDone(f, op, i, x)));
      }
      return farm2OrigHarvestedAt(f, x, z);
    };
}
// A field pass on one of his plots (or the hay field, or the orchard alleys)
async function farm2Pass(f, opKey) {
      const O = FARM_OPS[opKey];
      if (['mow', 'ted', 'rake', 'bale', 'balesq', 'plant', 'orchardspray'].includes(opKey) && typeof isRaining === 'function' && isRaining()) return { type: 'weather', label: `dry weather to ${O.verb}`, until: Date.now() + 15 * 60000 / farmFastK() };
      if (farmDayInfo(farmDayNow()).frozen && opKey !== 'dig') return { type: 'season', label: 'the ground to thaw' };
      return farmWorkField(f, opKey);
    }
// The orchard as a "field" of alleys for the airblast sprayer (rows run east-west, 3.5 m apart)
function farm2OrchardField() {
      const X = farm2State();
      if (!X.orchardField) { const r = farm2RectWorld(FARM2_LAYOUT.orchard); X.orchardField = { id: 'orch', name: 'Orchard', use: 'orchard', ...r, soil: 'sod', crop: null, g: 0, w: 0, p: 0, history: [], op: null }; }
      return X.orchardField;
    }

// --- The chores: every candidate with its urgency -------------------------------------------------------------
function farm2Chores() {
      const X = farm2State(), F = farmState(), d = farmDayNow(), w = farmDayInfo(d), doy = w.doy, yr = worldNow().year, day = Math.floor(d);
      const out = [], add = (score, key, label, run) => out.push({ score, key, label, run });
      const cattle = farm2Cattle(), B = farm2FeedBudget(d);
      // a machine of his he can't drive yet: he learns it first (nothing on the plots happens without it)
      const unlearned = state.vehicles.find(v => FARM_VEHICLE_KINDS.has((vehicleTypeFor(v.name) || {}).kind) && knowHowRule(v.name) && !state.knowHow[knowHowRule(v.name).key]);
      if (unlearned) add(72, 'learn', `Learn to drive the ${farmPlain(unlearned.name).replace(/ with .*$/, '')}`, () => farm2Learn(unlearned));
      // the animals: feed and water first
      if (cattle.length && B.bunkDays < 1.2) add(B.bunkDays < 0.5 ? 100 : 66 - B.bunkDays * 5, 'feedcattle', 'Mix and feed the cattle ration', farm2FeedCattle);
      if (X.flock.n && B.feederDays < 2) add(B.feederDays < 0.7 ? 95 : 60, 'feedhens', 'Grind layer mash and fill the hen feeder', farm2FeedHens);
      const sick = X.herd.find(a => a.sick);
      if (sick) add(90, 'sick', `Treat ${sick.name} (${sick.sick})`, () => farm2Treat(sick));
      // (a birth he missed by days is past checking: the calf is up and about by then)
      X.births.forEach(b => { if (!b.checked && d - b.day > 5) b.checked = true; });
      const newborn = X.births.find(b => !b.checked);
      if (newborn) add(84, 'newborn', `Check ${newborn.dam}'s new calf`, () => farm2CheckCalf(newborn));
      const dueSoon = farm2Adults('dairy').concat(farm2Adults('beef')).find(a => a.due != null && a.due - d < 2 && !a.inPen);
      if (dueSoon) add(80, 'calving', `Move ${dueSoon.name} to the calving pen`, () => farm2CalvingPen(dueSoon));
      // milk and eggs
      if (X.tankL >= 120 || (X.tankL > 20 && (X.tankDays || 0) >= 2)) add((X.tankDays || 0) >= 2 || X.tankL > 800 ? 78 : 45, 'milk', 'Pasteurize and bottle the milk', farm2BottleMilk);
      if (X.flock.nestEggs >= 36 || (X.flock.nestEggs >= 12 && day - (X.lastEggs || 0) >= 2)) add(day - (X.lastEggs || day) >= 2 || X.flock.nestEggs >= 120 ? 58 : 40, 'eggs', 'Collect, wash and pack the eggs', farm2CollectEggs);
      // herd out on grass in the season, back to the pen for winter
      if (cattle.length && X.pasture.fenced >= 1) {
        const want = farm2GrazingSeason(d) && X.pasture.kg > 300 * farm2PastureHa();
        if (want !== Boolean(X.herdOut)) add(52, 'moveherd', want ? 'Turn the herd out on the pasture' : 'Bring the herd in to the barn', () => farm2MoveHerd(want));
      }
      if (cattle.length && day - (X.lastCheck || 0) >= 3) add(30 + (day - (X.lastCheck || 0)), 'healthcheck', 'Walk through the herd: condition, feet, eyes', farm2HealthCheck);
      // the hay chain
      farm2ClaimHayField();
      const H = farm2HayField();
      if (H && H.soil !== 'seeded' && !H.op && ((doy >= 105 && doy <= 165) || (doy >= 215 && doy <= 240)) && !w.frozen) add(64, 'sowhay', `Sow the ${H.name.toLowerCase()} to hay`, () => farm2SowHay(H));
      if (H && H.soil === 'seeded') {
        const S = H.swath;
        if (!S && !w.frozen && doy < 275 && (H.g >= 0.97 || (H.g >= 0.8 && doy >= 245)) && (H.cutsThisYear || 0) < FARM_CROPS.hay.cuts && !(X.fieldBales && (X.fieldBales.round + X.fieldBales.square) > 0)) add(70, 'mow', `Mow the ${H.name.toLowerCase()}`, () => farm2Pass(H, 'mow'));
        if (S && S.stage === 'swath' && S.days >= 1 && S.m > 45) add(58, 'ted', 'Ted the hay', () => farm2Pass(H, 'ted'));
        if (S && (S.stage === 'swath' || S.stage === 'tedded') && S.m <= 42) add(62, 'rake', 'Rake the hay into windrows', () => farm2Pass(H, 'rake'));
        if (S && S.stage === 'windrow' && S.m <= FARM_CROPS.hay.baleMoisture + 2) add(76, 'bale', 'Bale the hay', () => farm2Bale(H));
      }
      if (X.fieldBales && (X.fieldBales.round + X.fieldBales.square) > 0) add(54, 'haulhay', 'Haul the bales to the hay shed', farm2HaulBales);
      // the plots
      farm2Veg().forEach(p => {
        const C = FARM_CROPS[p.plan || p.planned], win = C && C.window;
        if (!p.crop && C && !w.frozen && doy >= win[0] - 12 && doy <= win[1] && p.soil !== 'harrowed' && p.soil !== 'seeded') add(60, 'till:' + p.id, `Till the ${p.name.toLowerCase()}`, () => farm2Pass(p, 'till'));
        if (!p.crop && C && p.soil === 'harrowed' && doy >= win[0] && doy <= win[1] && !w.frozen) add(63, 'plant:' + p.id, `Plant the ${p.name.toLowerCase()}`, () => farm2Plant(p));
        if (p.crop && p.soil === 'seeded') {
          if (p.m < 0.35 && !X.irrigating[p.id] && farm2Done('well') && !w.frozen) add(66, 'water:' + p.id, `Open the drip on the ${p.name.toLowerCase()}`, () => farm2Irrigate(p, true));
          if (p.w > 0.22 && p.g < 0.65) add(46 + p.w * 20, 'weed:' + p.id, `Cultivate the weeds in the ${p.name.toLowerCase()}`, () => farm2Pass(p, 'cultivate'));
          if (p.g >= 1) add(68 + (p.crop === 'bean' ? 8 : 0), 'harvest:' + p.id, `Harvest the ${p.name.toLowerCase()}`, () => farm2HarvestPlot(p));
        }
        if (X.irrigating[p.id] && (p.m > 0.75 || !p.crop)) add(40, 'water:' + p.id, `Close the drip on the ${p.name.toLowerCase()}`, () => farm2Irrigate(p, false));
      });
      // the orchard
      const O = X.orchard;
      ['apple', 'cherry'].forEach(c => {
        const Bk = O.blocks[c];
        if (!O.planted[c]) return;
        if (doy >= 32 && doy <= 105 && Bk.prunedYear !== yr && farm2TreeAge(c) > 0.4) add(44, 'prune:' + c, `Prune the ${c} trees`, () => farm2Prune(c));
        if (Bk.pest && Bk.p > 0.05 && Bk.fruitKg > 0) add(64, 'spray:' + c, `Spray the ${FARM2_PLURAL[c]} for ${Bk.pest}`, () => farm2SprayOrchard(c));
        if (Bk.ripe && Bk.fruitKg > 3 && doy <= FARM_CROPS[c].window[1] + 8) add(c === 'cherry' ? 82 : 74, 'pick:' + c, `Pick the ${FARM2_PLURAL[c]}`, () => farm2Pick(c));
      });
      // selling and the books
      const stock = Object.keys(X.store).filter(k => farm2StoreHas(k) >= (FARM_RETAIL[k] ? (FARM_RETAIL[k].kg || 1) * 4 : 4));
      if (stock.length && day - (X.lastSell || 0) >= 3) add(34 + stock.length, 'sell', 'Stock the stand and list produce on the website', farm2Sell);
      if (cattle.length && ((doy >= 235 && X.budgetYear !== yr) || (B.hayShortKg > 0 && day - (X.budgetDay || 0) >= 30))) add(57, 'budget', 'Work out the winter feed budget', farm2FeedReview);
      if (doy >= 60 && doy <= 120 && X.seedYear !== yr && X.plots.length) add(53, 'seedorder', 'Order seed and supplies for the year', farm2YearOrder);
      // calves and steers: dairy bull calves go to a neighbour at a week; beef steers at about 18 months
      const bull = X.herd.find(a => a.calf && a.kind === 'dairy' && a.sex === 'm' && d - a.born >= 7);
      if (bull) add(38, 'sellcalf', `Sell ${bull.name}`, () => farm2SellCalf(bull));
      // the barn has twelve stalls: past that, the youngest grown heifer (or the oldest cow) is sold
      const grown = X.herd.filter(a => !a.calf);
      if (grown.length > FARM2_STALLS) add(41, 'sellcow', 'Sell a cow: the stalls are full', farm2SellSurplus);
      const steer = X.herd.find(a => a.calf && a.kind === 'beef' && a.sex === 'm' && d - a.born >= FARM_ANIMALS.beef.sellDays && a.kg >= FARM_ANIMALS.beef.sellKg * 0.9);
      if (steer) add(42, 'beef', `Send ${steer.name} for beef`, () => farm2Beef(steer));
      return out.sort((a, b) => b.score - a.score);
    }
function farm2NextChore() { try { return farm2Chores()[0] || null; } catch (e) { return null; } }
function farm2ChoreCheck() { farm2Simulate(); return Boolean(farm2NextChore()); }

// --- The year task ---------------------------------------------------------------------------------------------
async function farm2RunYear(t) {
      if (farmBusy || !t || agendaClosed(t)) return false;
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping || state.isCollectingMail) return false;
      farm2Simulate();
      const X = farm2State(), si = farm2SeasonIndex();
      // a new year starts with the next spring
      const yr = worldNow().year;
      if (yr > t.data.year && si === 0) {
        agendaDone(t.id, `Year ${t.data.year} on the mixed farm: ${farm2YearSummary(t.data.year)}`);
        farmDiary(`A year on the mixed farm`, '🐄', farm2YearSummary(t.data.year));
        farm2StartYear('A new year on the mixed farm');
        return true;
      }
      const step = (si - (t.data.startedSeason || 0) + 4) % 4;
      if (step !== t.step && step > t.step) agendaStep(t.id, step, '');
      const chore = farm2NextChore();
      if (!chore) { agendaWait(t.id, { type: 'time', label: 'the next chore on the mixed farm', test: 'farm2ChoreCheck', quiet: true }); return 'waiting'; }
      // two failures of the same chore in a row: let it rest a little and do the next one
      if (X.failKey === chore.key && Date.now() - (X.failAt || 0) < 8 * 60000 / farmFastK()) {
        const next = farm2Chores().find(c => c.key !== chore.key);
        if (!next) { agendaWait(t.id, { ...(X.failWait || { type: 'time', label: chore.label }), test: 'farm2ChoreCheck' }); return 'waiting'; }
        return farm2DoChore(t, next);
      }
      return farm2DoChore(t, chore);
    }
async function farm2DoChore(t, chore) {
      const X = farm2State();
      const r = await farm2Locked(async () => chore.run());
      if (r === false) return false;
      t.data.chores = (t.data.chores || 0) + 1;
      X.lastChore = { key: chore.key, label: chore.label, day: Math.floor(farmDayNow()), ok: r === true };
      if (r === true) { if (X.failKey === chore.key) X.failKey = null; return true; }
      // it could not be done now (a delivery, the weather, know-how): note it, and wait on it if nothing else is pressing
      X.failKey = chore.key; X.failAt = Date.now(); X.failWait = r;
      farm2Log(`Could not ${chore.label.toLowerCase()}: waiting for ${r && r.label || 'something'}`);
      const other = farm2Chores().find(c => c.key !== chore.key);
      if (other) return true;
      agendaWait(t.id, { ...r, test: 'farm2ChoreCheck' });
      return 'waiting';
    }
function farm2YearBlocker(t) {
      if (t.status !== 'waiting') return null;
      return farm2ChoreCheck() ? null : (t.waitingFor || { type: 'time', label: 'the next chore on the mixed farm' });
    }
agendaRegisterKind('farmmixed', { label: 'mixed farm year', check: t => { const b = farm2YearBlocker(t); return b ? { waitingFor: b } : true; }, resume: t => farm2RunYear(t) });
function farm2YearSummary(year) {
      const X = farm2State(), H = (X.hayLog || []).filter(h => h.bales);
      const veg = (X.harvests || []).filter(h => h.year === year).map(h => `${Math.round(h.kg)} kg ${h.crop}`).join(', ');
      return `${X.births.filter(b => b).length} calves born so far, ${farm2Cattle().length} cattle and ${X.flock.n} hens now; hay: ${H.map(h => `${h.bales} ${h.kind}`).join(', ') || 'none baled yet'}; plots: ${veg || 'nothing dug yet'}; the mixed farm has earned ${farm2Money(X.earned || 0)}.`;
    }

async function farm2Learn(v) {
      // (the chore lock marks him busy; learning at NetNode wants him free)
      state.isPracticing = false;
      const ok = await learnToUse(v.name, 'Learning the Farm Machines');
      state.isPracticing = true;
      const rule = knowHowRule(v.name);
      return ok || (rule && state.knowHow[rule.key]) ? true : { type: 'skill', label: `learning to drive the ${farmPlain(v.name)}` };
    }

// --- Feeding: his own hay and grain, mixed -------------------------------------------------------------------------
function farm2Spot(key, dx = 0, dz = 0) { const r = farmBuildingRect(key); return { x: r.x + dx * FARM_U, z: r.z + r.hd + 2.5 * FARM_U + dz * FARM_U }; }
function farm2PenSpot() { const p = farm2RectWorld(FARM2_LAYOUT.pen); return { x: (p.x0 + p.x1) / 2, z: p.z1 + 1.5 }; }
async function farm2FeedCattle() {
      const X = farm2State(), dem = farm2CattleDemand(), days = 3;
      const want = Math.round(dem.tmr * days), hayKg = want * FARM_FEED.tmr.hay, cornKg = want * FARM_FEED.tmr.corn, wheatKg = want * FARM_FEED.tmr.wheat;
      const haveHay = farm2HayKg(), corn = ((farmState().bins.corn || {}).t || 0) * 1000, wheat = ((farmState().bins.wheat || {}).t || 0) * 1000;
      if (haveHay < 50 && corn + wheat < 50) {
        farm2OrderHay(Math.max(10, Math.ceil(dem.hay * 30 / 450)), 'The stack is empty and so are the bins');
        return { type: 'delivery', label: 'hay for the cattle' };
      }
      const tractor = farmMachineOf('tractor');
      const useMixer = tractor && farmState().owned.mixer && (!farmVehicleBlock(tractor));
      // what goes in: as much of the recipe as there is; short on one part, more of the other
      const hayUse = Math.min(haveHay, hayKg + Math.max(0, cornKg + wheatKg - corn - wheat) * 0.8);
      const cornUse = Math.min(corn, cornKg + Math.max(0, hayKg - haveHay) * 0.5), wheatUse = Math.min(wheat, wheatKg);
      const mineralUse = Math.min(farmStock('mineral'), want * FARM_FEED.tmr.mineral);
      if (useMixer) {
        if (!(await farmFuelUp(tractor))) return farmFuelUp.why || { type: 'supply', label: 'diesel for the tractor' };
        await farmHitch(tractor, 'mixer');
        await farmDrive(tractor, farm2Spot('hayshed', 0, 1));
        farmSay('Loading the mixer', '🌾', `Bale spear on the loader: ${Math.ceil(hayUse / 450)} round bale${hayUse > 450 ? 's' : ''} into the TMR mixer, the knives cutting it short.`);
        await farmPause(3000);
        await farmDrive(tractor, farm2Spot('workshop', 0, -3));
        farmSay('Rolling the grain', '🌽', `${Math.round(cornUse)} kg of my corn and ${Math.round(wheatUse)} kg of wheat through the roller mill, then mineral, all on the mixer's scale.`);
        await farmPause(3000);
        await farmDrive(tractor, farm2PenSpot());
        farmSay('Feeding the cows', '🐄', `${Math.round(hayUse + cornUse + wheatUse)} kg of ration down the feed alley; the cows come up to the headlocks.`);
        farmImplState.working = 'mixer'; await farmPause(3500); farmImplState.working = null;
        await farmUnhitch(); await farmPark(tractor);
      } else {
        await farmGo(farm2Spot('hayshed'), 240000);
        farmSay('Feeding hay by hand', '🌾', 'No mixer yet: I fork hay into the bunk and scoop rolled grain over it.');
        await farmPause(4000);
        await farmGo(farm2PenSpot(), 240000);
        await farmPause(2500);
      }
      // take it from the stack and the bins
      const H = X.hay, fromLoose = Math.min(H.loose || 0, hayUse);
      let need = hayUse - fromLoose;
      H.loose = (H.loose || 0) - fromLoose;
      while (need > 0 && (H.round > 0 || H.square > 0)) { if (H.square > 0 && need < 200) { H.square--; need -= 25; } else if (H.round > 0) { H.round--; need -= 450; } else { H.square--; need -= 25; } }
      // what is left of an opened bale stays by the bunk for next time
      H.loose = Math.max(0, Math.round((H.loose - need) * 10) / 10);
      farmTakeGrain('corn', cornUse / 1000); farmTakeGrain('wheat', wheatUse / 1000); farmUse('mineral', mineralUse);
      X.bunk = Math.round((X.bunk + hayUse + cornUse + wheatUse + mineralUse) * 10) / 10;
      X.lastFeed = Math.floor(farmDayNow());
      farmLog(`Fed the cattle ${Math.round(hayUse + cornUse + wheatUse)} kg`);
      // low on hay: the decision is made now, not when it runs out
      const b = farm2FeedBudget();
      if (b.hayShortKg > 0 && farm2HayKg() < dem.hay * 21) farm2OrderHay(Math.ceil(Math.min(b.hayShortKg, dem.hay * 60) / 450), `Only ${Math.round(farm2HayKg() / Math.max(1, dem.hay))} days of hay left in the shed`);
      return true;
    }
async function farm2FeedHens() {
      const X = farm2State(), n = X.flock.n, kg = Math.round(n * FARM_ANIMALS.hen.feedKg * 14);
      const corn = ((farmState().bins.corn || {}).t || 0) * 1000, wheat = ((farmState().bins.wheat || {}).t || 0) * 1000;
      if (farmStock('premix') < kg * FARM_FEED.layer.premix * 0.5) { farm2SupplyOrder(['premix', 'oyster'], 'The hens\' premix is nearly gone'); }
      if (corn + wheat < kg * 0.5) return { type: 'supply', label: 'corn or wheat for the layer mash' };
      const mill = farmState().owned.rollermill;
      await farmGo(farm2Spot('workshop', 0, -3), 240000);
      farmSay('Grinding layer mash', '🐔', mill ? `${Math.round(kg * 0.55)} kg corn and ${Math.round(kg * 0.2)} kg wheat through the hammer mill, the premix and oyster shell mixed in.` : 'No mill yet: cracking the grain by hand and mixing in the premix.');
      await farmPause(mill ? 3500 : 6000);
      const c = Math.min(corn, kg * FARM_FEED.layer.corn + Math.max(0, kg * FARM_FEED.layer.wheat - wheat)), wh = Math.min(wheat, kg - c - kg * 0.25);
      farmTakeGrain('corn', c / 1000); farmTakeGrain('wheat', Math.max(0, wh) / 1000);
      const pm = farmUse('premix', kg * FARM_FEED.layer.premix), oy = farmUse('oyster', kg * FARM_FEED.layer.oyster);
      const made = c + Math.max(0, wh) + pm + oy;
      await farmGo(farm2Spot('coop', 1), 240000);
      farmSay('Filling the hen feeder', '🐔', `${Math.round(made)} kg of mash in the feeder: two weeks for ${n} hens. Fresh water, a look at the flock.`);
      await farmPause(2500);
      X.feeder = Math.round((X.feeder + made) * 10) / 10;
      return true;
    }
function farm2OrderHay(bales, why) {
      const X = farm2State(), d = Math.floor(farmDayNow());
      if (farmListRequest('mixed-hay-' + (X.hayOrderDay || 0)) && d - (X.hayOrderDay || 0) < 20) return null;
      X.hayOrderDay = d;
      const lines = [farm2Line('hay_bought', Math.max(1, Math.ceil(bales / 10)), `${bales} round bales: ${why.toLowerCase()}`)];
      const req = farm2SendList('mixed-hay-' + d, 'Farm list: hay for the cattle', '🌾', `${why}. My own hay won't last until the next cut, so I'm buying some from a neighbour.`, lines);
      farm2Log(`Ordered ${bales} round bales of hay: ${why}`);
      return req;
    }
function farm2SupplyOrder(keys, why) {
      const X = farm2State(), d = Math.floor(farmDayNow()), key = 'mixed-sup-' + keys.join('-');
      if ((X.supOrders || {})[key] && d - X.supOrders[key] < 20) return null;
      X.supOrders = X.supOrders || {}; X.supOrders[key] = d;
      return farm2SendList(key + '-' + d, 'Farm list: supplies for the animals', '🧰', why, keys.map(k => farm2Line(k, 1, FARM_SUPPLIES[k].label)));
    }

// --- Health, calving and the daily look ------------------------------------------------------------------------
function farm2AnimalSpot(a) { const R = farm2Rects(); const r = a.inPen || !R.herdOut ? R.pen : R.pasture; return a.x != null ? { x: a.x, z: a.z } : { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 }; }
async function farm2Treat(a) {
      const X = farm2State();
      const p = farm2Sprite(a.id) || farm2AnimalSpot(a);
      await farmGo({ x: p.x + 1.2, z: p.z + 1.2 }, 240000);
      const T = { mastitis: 'Strip the quarter, a CMT paddle: clinical mastitis. Intramammary antibiotic, her milk kept out of the tank for the withdrawal days.',
        lameness: 'Lift the foot, trim it, a block on the good claw.', 'foot rot': 'Swollen between the claws: clean, a long-acting antibiotic, dry bedding.',
        pinkeye: 'A cloudy eye: a patch and an antibiotic shot.', scours: 'Weak and loose: electrolytes in a bottle twice a day, kept warm.' }[a.sick] || 'Temperature, a look, the right treatment.';
      const kit = farmStock('vetkit') >= 0.1;
      farmSay(`Treating ${a.name}`, '🩺', kit ? T : `I have no vet supplies left, so I call the vet out for ${a.name}.`);
      await farmPause(3500);
      if (kit) farmUse('vetkit', 0.15);
      else { farm2Earn(-180, `Vet call for ${a.name}`); farm2SupplyOrder(['vetkit'], 'The vet kit is used up'); }
      X.vet.unshift({ day: Math.floor(farmDayNow()), who: a.name, what: a.sick, by: kit ? 'him' : 'the vet' });
      farmLog(`Treated ${a.name} for ${a.sick}`);
      a.sick = null; a.health = Math.min(100, a.health + 15);
      return true;
    }
async function farm2CheckCalf(b) {
      const X = farm2State(), calf = X.herd.find(a => a.id === b.id);
      if (calf) { const p = farm2Sprite(calf.id) || farm2AnimalSpot(calf); await farmGo({ x: p.x + 1, z: p.z + 1 }, 240000); }
      farmSay('A new calf', '🐮', calf ? `${b.dam}'s ${b.sex === 'm' ? 'bull' : 'heifer'} calf: up and sucking, navel dipped in iodine, an ear tag in. Colostrum in the first hours is everything.` : 'The calf is fine.');
      await farmPause(2500);
      if (farmStock('vetkit') > 0.05) farmUse('vetkit', 0.05);
      b.checked = true;
      const dam = X.herd.find(a => a.name === b.dam); if (dam) dam.inPen = false;
      farmDiary(`${b.dam} had a calf`, '🐮', `${b.dam} the ${FARM_ANIMALS[b.kind].breed} had a ${b.sex === 'm' ? 'bull' : 'heifer'} calf on her own in the night. I dipped the navel, tagged it, and watched it drink. ${b.kind === 'dairy' ? 'She is milking again: the robot will find her.' : 'It will run with its mother all summer.'}`);
      return true;
    }
async function farm2CalvingPen(a) {
      const pen = farm2PenSpot();
      await farmGo(pen, 240000);
      farmSay(`${a.name} is close to calving`, '🐄', 'Springing, restless, her tail raised: into the calving pen with clean bedding. I will check her every few hours.');
      await farmPause(2000);
      a.inPen = true;
      if (farmStock('bedding') > 0.1) farmUse('bedding', 0.2);
      return true;
    }
async function farm2HealthCheck() {
      const X = farm2State(), C = farm2Cattle();
      const R = farm2Rects(), r = X.herdOut ? R.pasture : R.pen;
      await farmGo({ x: (r.x0 + r.x1) / 2, z: r.z1 + 1 }, 240000);
      const thin = C.filter(a => a.bcs < 2.6), low = farm2FeedBudget();
      farmSay('Walking through the herd', '🔎', `${C.length} head. Condition ${Math.round(C.reduce((s, a) => s + a.bcs, 0) / Math.max(1, C.length) * 10) / 10} on average${thin.length ? `, ${thin.map(a => a.name).join(' and ')} on the thin side` : ''}. Feet, eyes, manure all looked at. Bunk: ${low.bunkDays} days; ${X.flock.n} hens laying about ${X.flock.layToday} a day.`);
      await farmPause(3000);
      X.lastCheck = Math.floor(farmDayNow());
      return true;
    }
async function farm2MoveHerd(out) {
      const X = farm2State(), R = farm2Rects();
      const gate = farm2W(FARM2_LAYOUT.pasture.gateX, FARM2_LAYOUT.pasture.d0);
      await farmGo(farm2PenSpot(), 240000);
      farmSay(out ? 'Turning the herd out' : 'Bringing the herd in', '🐄', out ? 'Gate open, the cows walk the lane to the pasture and put their heads straight down.' : 'The grass is done for the year: the cows come back to the barn and the bunk.');
      await farmGo({ x: gate.x, z: gate.z + 2 }, 240000);
      X.herdOut = out;
      farm2Place3D();
      await farmPause(2000);
      farmLog(out ? 'Herd out on pasture' : 'Herd in for winter');
      return true;
    }

// --- Milk and eggs ---------------------------------------------------------------------------------------------------
async function farm2BottleMilk() {
      const X = farm2State();
      await farmGo(farm2Spot('milkhouse'), 240000);
      const bottles = Math.floor(farmStock('bottles'));
      const L = Math.min(X.tankL, Math.max(0, bottles), 300);
      farmSay('Bottling milk', '🥛', `${Math.round(X.tankL)} L in the bulk tank at 3 °C. ${L ? `${Math.round(L)} L through the pasteurizer (63 °C for 30 minutes), cooled and bottled with the cream on top.` : 'No bottles left: it goes to the calves.'}`);
      await farmPause(5000);
      if (L > 0) { farmUse('bottles', Math.floor(L)); farm2StoreAdd('milk', Math.floor(L)); }
      if (bottles < 60) farm2SupplyOrder(['bottles'], 'Running out of milk bottles');
      const rest = X.tankL - L;
      X.calfMilkL = (X.calfMilkL || 0) + rest;
      X.tankL = 0; X.tankDays = 0;
      farmLog(`Bottled ${Math.floor(L)} L of milk`);
      return true;
    }
async function farm2CollectEggs() {
      const X = farm2State(), eggs = X.flock.nestEggs;
      await farmGo(farm2Spot('coop', -1.5), 240000);
      const dozen = Math.min(Math.floor(eggs / 12), Math.floor(farmStock('cartons')));
      farmSay('Collecting eggs', '🥚', `${eggs} eggs from the nest boxes. Washed, candled, sized: ${dozen} dozen into cartons and into the cooler.`);
      if (typeof holdJobTool === 'function') holdJobTool(/basket|bucket/i, 'normal');
      await farmPause(3500);
      farmUse('cartons', dozen);
      farm2StoreAdd('eggs', dozen);
      X.flock.nestEggs = 0; X.lastEggs = Math.floor(farmDayNow());
      if (farmStock('cartons') < 30) farm2SupplyOrder(['cartons'], 'Nearly out of egg cartons');
      return true;
    }

// --- Hay ---------------------------------------------------------------------------------------------------------------
// The north field leaves the grain rotation once its grain is off (or straight away if nothing grows on it):
// from then on it is his hay field, one of his plots
function farm2ClaimHayField() {
      const X = farm2State(), F = farmState();
      if (!X.hayPlanned || X.hayId) return null;
      const f = F.fields.find(x => x.id === X.hayPlanned);
      if (!f || f.soil === 'seeded' || f.op || F.fields.length < 2 || (farmBusy && farmBusy !== 'mixed' && farmBusy !== (farm2Task() || {}).id)) return null;
      F.fields = F.fields.filter(x => x.id !== f.id);
      f.use = 'hay'; f.crop = null; f.planned = 'hay'; f.swath = null;
      X.plots.push(f); X.hayId = f.id;
      farm2Log(`The ${f.name.toLowerCase()} leaves the grain rotation: it will be hay`);
      return f;
    }
// Sowing it: disc the stubble, drill the alfalfa-grass mix
async function farm2SowHay(f) {
      const X = farm2State(), F = farmState(), ha = farmFieldHa(f), need = FARM_CROPS.hay.seed * ha;
      if (farmStock('seed_hay') < need * 0.98) { farm2SendList('mixed-hayseed', 'Farm list: hay seed', '🌿', 'Alfalfa-grass seed for the north field.', [farm2Line('seed_hay', (need - farmStock('seed_hay')) / FARM_SUPPLIES.seed_hay.per, `${Math.round(need)} kg for ${Math.round(ha * 100) / 100} ha`)]); return { type: 'supply', label: 'hay seed' }; }
      if (f.soil !== 'harrowed') { const r = await farmWorkField(f, 'disc'); if (r !== true) return r; }
      f.crop = 'hay'; f.planned = 'hay';
      const r = await farmWorkField(f, 'seed');
      if (r !== true) { if (f.soil !== 'seeded') f.crop = null; return r; }
      f.use = 'hay'; f.q = 1; f.cutsThisYear = 0; f.swath = null; f.g = 0.02;
      farmDiary('Sowed the north field to hay', '🌿', `The north field is out of the grain rotation now: disced, then drilled with ${Math.round(need)} kg of alfalfa and orchardgrass. It will take a couple of months to establish; after that it gives three cuts a year for five years or more, and the alfalfa puts nitrogen back into the soil.`);
      return true;
    }
async function farm2Bale(f) {
      const X = farm2State(), sq = (X.hay.square || 0) + ((X.fieldBales || {}).square || 0) < 60 && FARM_CROPS.hay && (f.cutsThisYear || 0) >= 2;
      const key = sq ? 'balesq' : 'bale';
      if (!farmState().owned[FARM_OPS[key].impl]) return { type: 'delivery', label: `the ${FARM_IMPLEMENTS[FARM_OPS[key].impl].label.toLowerCase()}` };
      if (farmStock(sq ? 'twine' : 'netwrap') < 1) { farm2SupplyOrder([sq ? 'twine' : 'netwrap'], 'Out of baling supplies'); return { type: 'supply', label: sq ? 'baler twine' : 'net wrap' }; }
      const S = f.swath;
      farmSay('Checking the hay', '🌾', `Moisture tester into the windrow: ${Math.round(S.m)}%. ${sq ? 'Small squares this cut, for the stand and the hens.' : 'Round bales for the cows.'}`);
      await farmPause(1500);
      return farm2Pass(f, key);
    }
async function farm2HaulBales() {
      const X = farm2State(), B = X.fieldBales, v = farmMachineOf('compact') || farmMachineOf('tractor');
      if (!v) return { type: 'delivery', label: 'a tractor' };
      if (!(await farmFuelUp(v))) return farmFuelUp.why || { type: 'supply', label: 'diesel' };
      const f = X.plots.find(p => p.id === B.field) || farm2HayField();
      const hs = farm2Spot('hayshed', 0, 0.5);
      const trips = Math.max(1, Math.ceil(B.round / 8) + (B.square ? 1 : 0)), k = farmFastK();
      if (farmState().owned.balewagon) await farmHitch(v, 'balewagon');
      for (let i = 0; i < trips; i++) {
        const load = Math.min(8, B.round);
        if (f && (k <= 1 || i % k === 0 || i === trips - 1)) {
          await farmDrive(v, { x: (f.x0 + f.x1) / 2, z: f.z0 + (f.z1 - f.z0) * ((i + 0.5) / trips) });
          farmSay('Hauling bales', '🌾', B.round ? 'Bale spear into each bale, onto the wagon, eight to a load.' : 'Small squares onto the wagon, stacked tight.');
          X.wagonBales = load; await farmPause(2000);
          await farmDrive(v, hs);
          farmSay('Stacking hay in the shed', '🌾', 'Off the wagon and onto the stack, butt to butt, out of the rain.');
          await farmPause(2000);
        }
        B.round -= load; X.hay.round += load; X.wagonBales = 0;
        if (i === trips - 1 && B.square) { X.hay.square += B.square; B.square = 0; }
        X.hay.q = Math.round(((X.hay.q || 0.8) * 0.6 + B.q * 0.4) * 100) / 100;
        farm2Refresh3D(true);
      }
      B.round = 0; B.square = 0;
      if (farmState().hitch) await farmUnhitch();
      await farmPark(v);
      farmDiary('Hay in the shed', '🌾', `Another cut in: the stack is ${X.hay.round} round bales and ${X.hay.square} small squares, about ${Math.round(farm2HayKg() / 100) / 10} t, quality ${Math.round(X.hay.q * 100)}%. ${farm2FeedBudget().hayShortKg > 0 ? 'Still not enough for the winter at this rate.' : 'Enough for the winter if nothing goes wrong.'}`);
      return true;
    }

// --- The plots ------------------------------------------------------------------------------------------------------------
async function farm2Plant(p) {
      const crop = p.plan || p.planned, C = FARM_CROPS[crop], ha = farmFieldHa(p), need = C.seed * ha;
      if (farmStock('seed_' + crop) < need * 0.98) { farm2YearOrder(); return { type: 'supply', label: `${C.label.toLowerCase()} seed` }; }
      p.crop = crop;
      const r = await farm2Pass(p, 'plant');
      if (r !== true) { if (p.soil !== 'seeded') p.crop = null; return r; }
      farmUse('seed_' + crop, need); farmUse('driptape', ha * 10000 / 0.9 * 0.5); farmUse('compost', ha * 30);
      farmDiary(`Planted the ${p.name.toLowerCase()}`, C.emoji, `${C.variety} in the ${p.name.toLowerCase()}, ${Math.round(ha * 10000)} m², with drip tape down every bed. About ${C.days} days to harvest if the water holds.`);
      return true;
    }
async function farm2Irrigate(p, on) {
      const X = farm2State(), r = farmBuildingRect('well');
      await farmGo({ x: r.x + r.hw + 1.5, z: r.z + r.hd + 1.5 }, 240000);
      farmSay(on ? 'Opening the drip' : 'Closing the drip', '💧', on ? `The ${p.name.toLowerCase()} is down to ${Math.round(p.m * 100)}% soil moisture: valve open, the pump kicks on, 40 L a minute through the filter to the drip tape.` : `The ${p.name.toLowerCase()} is wet enough (${Math.round(p.m * 100)}%): valve closed.`);
      await farmPause(2000);
      X.irrigating[p.id] = on;
      return true;
    }
async function farm2HarvestPlot(p) {
      const crop = p.crop, C = FARM_CROPS[crop];
      let r = true;
      if (crop === 'potato' || crop === 'carrot') r = await farm2Pass(p, 'dig');
      else {
        // squash and beans are picked by hand, walking the beds with crates
        const k = farmFastK(), n = Math.max(2, Math.round((p.z1 - p.z0) / (1.8 * FARM_U)));
        farmSay(`Picking the ${C.label.toLowerCase()}`, C.emoji, crop === 'squash' ? 'Cutting each butternut with a bit of stem, into crates, to cure in the sun a few days.' : 'Down every bed picking beans into a bucket: the long straight pods, the small ones left for next week.');
        for (let i = 0; i < n; i++) {
          if (k > 1 && i % k !== 0 && i !== n - 1) continue;
          const z = p.z1 - (i + 0.5) * (p.z1 - p.z0) / n;
          await farmGo({ x: i % 2 ? p.x1 - 1 : p.x0 + 1, z }, 120000);
          await farmPause(1200);
        }
        farm2OpDone(p, 'dig');
      }
      if (r !== true) return r;
      const kg = p.lastKg || 0;
      // to the packing shed: wash, grade and into the cooler
      await farmGo(farm2Spot('packshed'), 240000);
      farmSay('Washing and packing', '📦', `${kg} kg of ${C.label.toLowerCase()} through the ${crop === 'potato' || crop === 'carrot' ? 'barrel washer' : 'sorting table'}, graded, packed and into the cooler at ${crop === 'squash' ? '12' : '1'} °C.`);
      await farmPause(3500);
      farmUse('boxes', kg / 20);
      farmDiary(`Harvested the ${p.name.toLowerCase()}`, C.emoji, `${kg} kg of ${C.label.toLowerCase()} from the ${p.name.toLowerCase()} (${Math.round(kg / 1000 / farmFieldHa(p) * 10) / 10} t/ha). Washed, packed and in the cooler. ${kg / 1000 / farmFieldHa(p) >= C.yield * 0.75 ? 'A good crop.' : 'Not as much as I hoped: water and weeds, I think.'}`);
      // a second short crop of beans fits after the potatoes in a long summer
      const d = farmDayInfo(farmDayNow());
      p.plan = crop === 'potato' && d.doy < 200 ? 'bean' : FARM2_LAYOUT.plots.find(L => L.id === p.id).crop;
      p.planned = p.plan;
      return true;
    }

// --- The orchard -------------------------------------------------------------------------------------------------------------
async function farm2OrchardRows(crop, fn) {
      const L = FARM2_LAYOUT.orchard, rows = crop === 'apple' ? [...Array(L.rows.apple).keys()] : [...Array(L.rows.cherry).keys()].map(i => i + L.rows.apple), k = farmFastK();
      for (let j = 0; j < rows.length; j++) {
        if (k > 1 && j % k !== 0 && j !== rows.length - 1) continue;
        const dm = L.d0 + 1.75 + rows[j] * L.rowM + 1.75, a = farm2W(L.x0 + 1, dm), b = farm2W(L.x1 - 1, dm);
        await farmGo(j % 2 ? { x: b.x, z: b.z } : { x: a.x, z: a.z }, 120000);
        await farmGo(j % 2 ? { x: a.x, z: a.z } : { x: b.x, z: b.z }, 120000);
        if (fn) await fn(j, rows.length);
      }
    }
async function farm2Prune(crop) {
      const X = farm2State(), B = X.orchard.blocks[crop];
      if (!hasItem(/pruning shears|loppers/i)) return { type: 'delivery', label: 'the pruning shears and loppers' };
      farmSay(`Pruning the ${crop} trees`, '✂️', crop === 'apple' ? 'Tall spindle: the leader kept, any limb more than half its thickness cut back to a stub, nothing crowding the light.' : 'Cherries on Gisela: thin the tops, keep the fruiting spurs, open the middle to the sun.');
      if (typeof holdJobTool === 'function') holdJobTool(/pruning shears|loppers/i, 'normal');
      await farm2OrchardRows(crop, () => farmPause(800));
      B.prunedYear = worldNow().year;
      if (typeof gainSkill === 'function') gainSkill('orcharding', 'orcharding', 3);
      farmLog(`Pruned the ${crop} trees`);
      return true;
    }
async function farm2SprayOrchard(crop) {
      const X = farm2State(), B = X.orchard.blocks[crop];
      if (farmStock('insecticide') < 0.5) { farm2SupplyOrder(['insecticide'], `${B.pest} in the ${FARM2_PLURAL[crop]} and no spray left`); return { type: 'supply', label: 'insecticide for the orchard' }; }
      const r = await farm2Pass(farm2OrchardField(), 'orchardspray');
      if (r !== true) return r;
      farmUse('insecticide', 0.6);
      farmDiary(`Sprayed the ${FARM2_PLURAL[crop]}`, '💨', `${B.pest} had got into the ${FARM2_PLURAL[crop]} (${Math.round(B.p * 100)}% pressure). One airblast pass down every alley at label rate, in the still of the early morning.`);
      B.pest = null; B.p = 0; B.sprays = (B.sprays || 0) + 1; B.sprayedYear = worldNow().year;
      return true;
    }
async function farm2Pick(crop) {
      const X = farm2State(), B = X.orchard.blocks[crop], C = FARM_CROPS[crop];
      if (!hasItem(/tripod ladder|picking bag/i)) return { type: 'delivery', label: 'the orchard ladder and picking bags' };
      farmSay(`Picking ${FARM2_PLURAL[crop]}`, C.emoji, crop === 'apple' ? 'Picking bag on, the ladder against the trellis, each apple lifted and twisted so the stem stays on. Into the bins.' : 'Cherries picked with the stems on, straight into lugs, into the cooler within the hour.');
      if (typeof holdJobTool === 'function') holdJobTool(/picking bag|basket|bucket/i, 'normal');
      const total = B.fruitKg;
      await farm2OrchardRows(crop, () => farmPause(900));
      const kg = Math.round(total * 0.96);
      B.pickedKg = (B.pickedKg || 0) + kg; B.fruitKg = 0; B.ripe = false;
      await farmGo(farm2Spot('packshed'), 240000);
      farmSay('Into the cooler', '📦', `${kg} kg of ${C.label.toLowerCase()} sorted, the bruised ones out for the cows, the rest into the cooler.`);
      await farmPause(2500);
      farm2StoreAdd(crop, kg);
      X.fruitLog = X.fruitLog || []; X.fruitLog.unshift({ crop, kg, day: Math.floor(farmDayNow()), year: worldNow().year }); if (X.fruitLog.length > 20) X.fruitLog.length = 20;
      farmDiary(`Picked the ${FARM2_PLURAL[crop]}`, C.emoji, `${kg} kg of ${C.label.toLowerCase()} from ${X.orchard.planted[crop]} trees in their ${Math.floor(farm2TreeAge(crop) + 1)}${['st', 'nd', 'rd'][Math.floor(farm2TreeAge(crop))] || 'th'} year. ${B.prunedYear === worldNow().year ? 'Pruned in the winter, and it shows.' : 'I never got to pruning them this winter; the fruit is smaller.'}`);
      return true;
    }

// --- Animals sold ---------------------------------------------------------------------------------------------------------------
async function farm2SellCalf(a) {
      const X = farm2State();
      await farmGo(farm2PenSpot(), 240000);
      farmSay(`Selling ${a.name}`, '🐮', 'A neighbour raises dairy bull calves for veal and beef: he takes him at a week old with a full belly of colostrum.');
      await farmPause(2000);
      farm2Earn(260, `${a.name} (dairy bull calf)`);
      X.sales.unshift({ day: Math.floor(farmDayNow()), what: a.name, price: 260 });
      farm2Remove([a.id]);
      return true;
    }
const FARM2_STALLS = 12;
async function farm2SellSurplus() {
      const X = farm2State(), grown = X.herd.filter(a => !a.calf), d = farmDayNow();
      const pick = grown.filter(a => d - a.born < 3 * DAYS_PER_YEAR).sort((a, b) => b.born - a.born)[0] || grown.sort((a, b) => a.born - b.born)[0];
      if (!pick) return true;
      await farmGo(farm2PenSpot(), 240000);
      const price = pick.kind === 'dairy' ? 2600 : 2200;
      farmSay(`Selling ${pick.name}`, '🐄', `Twelve stalls and ${grown.length} grown cattle: ${pick.name} goes to a neighbour's herd, bred and sound.`);
      await farmPause(2000);
      farm2Earn(price, `${pick.name} (${FARM_ANIMALS[pick.kind].breed}, sold to a neighbour)`);
      X.sales.unshift({ day: Math.floor(d), what: pick.name, price });
      farm2Remove([pick.id]);
      return true;
    }
async function farm2Beef(a) {
      const X = farm2State();
      if (!farm2Done('packshed')) return { type: 'machine', label: 'a cooler to hang the beef in' };
      await farmGo(farm2PenSpot(), 240000);
      farmSay(`${a.name} goes for beef`, '🥩', `${Math.round(a.kg)} kg, grass-fed and finished on my own rolled corn. The licensed mobile abattoir comes to the farm; the carcass hangs 14 days, then it is cut and wrapped.`);
      await farmPause(3500);
      const hanging = a.kg * 0.6, retail = hanging * 0.68, quarters = Math.max(1, Math.round(retail / FARM_RETAIL.beef.kg));
      farm2StoreAdd('beef', quarters);
      farm2Earn(-Math.round(hanging * 1.6), `Abattoir and butcher for ${a.name}`);
      X.sales.unshift({ day: Math.floor(farmDayNow()), what: `${a.name}: ${quarters} quarters of beef`, price: 0 });
      farm2Remove([a.id]);
      farmDiary('Beef from my own steer', '🥩', `${a.name}, born here, went for beef today: ${Math.round(hanging)} kg hanging, about ${Math.round(retail)} kg of cuts, ${quarters} quarters for my website. It is a strange feeling, raising an animal for this. I made sure he had a good life on grass.`);
      return true;
    }

// --- The feed budget: what the winter needs, what he has, and what he decides --------------------------------------------------
async function farm2FeedReview() {
      const X = farm2State(), b = farm2FeedBudget(), F = farmState(), d = Math.floor(farmDayNow());
      await farmGo(farm2Spot('hayshed'), 240000);
      const dem = farm2CattleDemand();
      const lines = [`Feed budget for the next ${b.days} days: ${Math.round(b.hayNeedKg / 1000 * 10) / 10} t of hay and ${Math.round(b.grainNeedKg / 100) / 10} t of grain`,
        `In the shed: ${Math.round(b.hayHaveKg / 100) / 10} t of hay${b.hayComingKg ? `, about ${Math.round(b.hayComingKg / 100) / 10} t still to cut` : ''}; in the bins: ${Math.round(b.grainHaveKg / 100) / 10} t of corn and wheat`];
      const decisions = [];
      // hay short: buy a little, or with too many mouths sell a cow before winter; a big gap puts another field to hay
      if (b.hayShortKg > 0) {
        const bales = Math.ceil(b.hayShortKg / 450);
        const cows = farm2Adults('beef').concat(farm2Adults('dairy'));
        if (b.hayShortKg > dem.hay * 120 && cows.length > 2) {
          const cull = cows.filter(a => a.kind === 'beef').sort((a, c) => (a.calved == null) - (c.calved == null) || a.born - c.born)[0] || cows[0];
          decisions.push(`sell ${cull.name}, ${cull.due == null ? 'the oldest open cow' : 'my oldest beef cow'}, rather than buy ${bales} bales`);
          farm2Earn(1900, `${cull.name} (cow sold before winter)`); X.sales.unshift({ day: d, what: cull.name, price: 1900 }); farm2Remove([cull.id]);
          const left = farm2FeedBudget();
          if (left.hayShortKg > 0) { farm2OrderHay(Math.ceil(left.hayShortKg / 450), 'The winter feed budget is still short'); decisions.push(`buy ${Math.ceil(left.hayShortKg / 450)} round bales`); }
        } else { farm2OrderHay(bales, 'The winter feed budget is short'); decisions.push(`buy ${bales} round bales from a neighbour`); }
        if (b.hayShortKg > dem.hay * 60 && F.fields.length > 1 && !X.secondHayPlanned) { X.secondHayPlanned = true; decisions.push('think about a second hay field next year'); }
      } else decisions.push('no hay to buy: the stack and the cuts to come cover it');
      // grain: keep enough back in the bins (the website listing leaves it), or buy feed
      if (b.grainShortKg > 0) decisions.push(`keep all the corn and wheat for feed (still ${Math.round(b.grainShortKg / 100) / 10} t short: the cows get more hay instead)`);
      else decisions.push(`keep ${Math.round(farm2GrainReserveT('corn') * 10) / 10} t of corn and ${Math.round(farm2GrainReserveT('wheat') * 10) / 10} t of wheat back from sale for feed`);
      if (farmStock('mineral') < dem.tmr * b.days * FARM_FEED.tmr.mineral) { farm2SupplyOrder(['mineral'], 'Mineral for the winter'); decisions.push('order mineral'); }
      if (X.flock.n && farmStock('premix') < X.flock.n * FARM_ANIMALS.hen.feedKg * b.days * FARM_FEED.layer.premix) { farm2SupplyOrder(['premix', 'oyster'], 'Premix for the hens\' winter'); decisions.push('order layer premix'); }
      farmSay('The winter feed budget', '📋', `${lines.join('. ')}. So: ${decisions.join('; ')}.`);
      await farmPause(3000);
      X.budget = { day: d, ...b, decisions };
      X.budgetYear = worldNow().year; X.budgetDay = d;
      farm2Log(`Feed budget: ${decisions.join('; ')}`);
      farmDiary('Worked out the winter feed', '📋', `${lines.join('. ')}. I decided to ${decisions.join(', and to ')}.`);
      return true;
    }
// Spring: seed and supplies for the year (only what is short)
async function farm2YearOrder() {
      const X = farm2State(), lines = farm2PlotListLines(false);
      [['netwrap', 20], ['twine', 60], ['bedding', 3], ['vetkit', 0.3], ['cartons', 60], ['bottles', 60], ['insecticide', 1]].forEach(([k, min]) => { if (farmStock(k) < min) lines.push(farm2Line(k, 1, FARM_SUPPLIES[k].label)); });
      if (lines.length) farm2SendList('mixed-year-' + worldNow().year, `Farm list: seed and supplies (year ${worldNow().year})`, '🌱', 'Seed for the four plots and what the animals and the hay will use up this year.', lines);
      X.seedYear = worldNow().year;
      return true;
    }

// --- Selling: the stand and the website ------------------------------------------------------------------------------------------
const FARM2_CASE = { apple: 5, cherry: 5, potato: 4, carrot: 10, squash: 8, bean: 6, eggs: 6, milk: 6, beef: 1, hay: 20 };
function farm2StoreUnits(key) {
      const R = FARM_RETAIL[key];
      if (key === 'eggs' || key === 'milk' || key === 'beef') return farm2StoreHas(key);
      if (key === 'hay') return farm2State().hay.square;
      return farm2StoreHas(key) / (R.kg || 1);
    }
function farm2TakeUnits(key, n) {
      const R = FARM_RETAIL[key];
      if (key === 'hay') { const H = farm2State().hay; const got = Math.min(H.square, n); H.square -= got; return got; }
      if (key === 'eggs' || key === 'milk' || key === 'beef') return farm2StoreTake(key, n);
      return farm2StoreTake(key, n * (R.kg || 1)) / (R.kg || 1);
    }
async function farm2Sell() {
      const X = farm2State();
      if ((farmState().buildings.stand || {}).stage === 'done') {
        const r = farmBuildingRect('stand');
        await farmGo({ x: r.x + r.hw + 2, z: r.z + r.hd + 1.5 }, 240000);
        farmState().stand.open = true;
        const have = Object.keys(FARM2_CASE).filter(k => farm2StoreUnits(k) >= 1);
        farmSay('Stocking the farm stand', '🧺', `On the stand today: ${have.map(k => `${FARM_RETAIL[k].label.toLowerCase()} ${farm2Money(FARM_RETAIL[k].price)}`).slice(0, 5).join(', ')}. Eggs and milk in the little cooler, the honesty box by the till.`);
        await farmPause(2500);
      }
      farm2ListOnWebsite();
      X.lastSell = Math.floor(farmDayNow());
      return true;
    }
function farm2ListOnWebsite() {
      const shop = typeof ensureShop === 'function' ? ensureShop() : null;
      if (!shop) return;
      Object.entries(FARM2_CASE).forEach(([k, n]) => {
        const R = FARM_RETAIL[k];
        if (farm2StoreUnits(k) < n * 1.5 || shop.listings.some(l => l.kind === 'farmgoods' && l.farm && l.farm.produce === k)) return;
        const name = n === 1 ? R.label : `${n} × ${R.label.replace(/^(A|An)\s+/, '').replace(/^\d[^ ]* /, m => m)}`;
        shop.listings.unshift({ id: 'farm-' + k + '-' + Date.now().toString(36), kind: 'farmgoods', name: `${name} (Kelo-1's farm)`.slice(0, 80),
          description: { apple: 'Ambrosia apples from his own young orchard, picked by hand and kept in his cooler.', cherry: 'Sweetheart cherries picked with the stems on, cooled within the hour.',
            potato: 'Yukon Gold potatoes dug, washed and cured on his farm.', carrot: 'Bolero carrots, sweet from the cool soil, washed and bagged.', squash: 'Butternut squash, cured in the sun, keeps for months.',
            bean: 'Provider green beans picked young.', eggs: 'Free-run brown eggs from his ISA Brown hens, washed, candled and graded.', milk: 'Cream-top whole milk from his Jersey cows, batch-pasteurized and bottled on the farm (bottle deposit extra).',
            beef: 'Grass-fed Black Angus raised on his pasture and finished on his own corn, from a licensed abattoir, cut and wrapped.', hay: 'Alfalfa-grass hay, small square bales, baled dry.' }[k],
          price: Math.round(R.price * n * 100) / 100, currency: 'CAD', image: '', listedAt: new Date().toISOString(), farm: { produce: k, units: n }, sales: 0 });
        farmLog(`Listed ${name} on the website`);
      });
      if (typeof renderAllUI === 'function') renderAllUI();
    }
// Sold on the website: the produce leaves the store; stage 1's own goods go on to its code
if (typeof removeSoldThing === 'function') {
  const farm2OrigRemoveSold = removeSoldThing;
  removeSoldThing = function (l) {
      if (l && l.kind === 'farmgoods' && l.farm && l.farm.produce) {
        const got = farm2TakeUnits(l.farm.produce, l.farm.units || 1);
        farm2Earn(Number(l.price) || 0, l.name);
        farmLog(`Sold on the website: ${l.name}${got < (l.farm.units || 1) ? ' (short)' : ''}`);
        return;
      }
      return farm2OrigRemoveSold(l);
    };
}
// Website grain listings leave the feed reserve in the bins
if (typeof farmListOnWebsite === 'function') {
  const farm2OrigListGrain = farmListOnWebsite;
  farmListOnWebsite = function () {
      const F = farmState(), saved = {};
      ['corn', 'wheat'].forEach(c => { const b = F.bins[c], r = farm2GrainReserveT(c); if (b && r > 0) { saved[c] = b.t; b.t = Math.max(0, b.t - r); } });
      try { farm2OrigListGrain(); } finally { Object.entries(saved).forEach(([c, t]) => { F.bins[c].t = t; }); }
    };
}
// The stand: a few customers a day buy produce, eggs and milk too
if (typeof farmStandTick === 'function') {
  const farm2OrigStand = farmStandTick;
  farmStandTick = function () {
      const F = state.farm;
      const before = F && F.stand ? F.stand.day : null;
      farm2OrigStand();
      if (!F || !F.stand || !F.stand.open || !F.mixed || !F.mixed.startedAt) return;
      const day = Math.floor(farmDayNow()), X = F.mixed;
      if (X.standDay === day) return;
      const days = Math.min(30, day - (X.standDay || before || day));
      X.standDay = day;
      for (let dd = 0; dd < days; dd++) {
        const w = farmDayInfo(day - dd), h = farm2Hash(5200000 + day - dd);
        const buyers = Math.floor(h * (w.season === 'Summer' ? 9 : w.season === 'Autumn' ? 7 : 3));
        for (let b = 0; b < buyers; b++) {
          const have = ['eggs', 'milk', 'apple', 'cherry', 'potato', 'carrot', 'squash', 'bean'].filter(k => farm2StoreUnits(k) >= 1);
          if (!have.length) break;
          const k = have[(b * 7 + day) % have.length];
          if (farm2TakeUnits(k, 1) >= 0.99) { F.earnings += FARM_RETAIL[k].price; X.earned = (X.earned || 0) + FARM_RETAIL[k].price; F.stand.sales++; X.standSales = (X.standSales || 0) + 1; }
        }
      }
      F.earnings = Math.round(F.earnings * 100) / 100; X.earned = Math.round((X.earned || 0) * 100) / 100;
    };
}
