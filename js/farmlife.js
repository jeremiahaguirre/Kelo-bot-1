// Kelo-bot-1 — js/farmlife.js
// Loaded after farm.js. Stage 2 of the farm, the numbers only (no 3D, no jobs): his mixed farm's saved
// state (`state.farm.mixed`, filled in for older saves by farm2State()), and one step per world day of
// the orchard (age, bloom, frost, fruit set, pests, ripening, drop), the vegetable plots (the grain field
// model of js/farmdata.js plus drip irrigation), the hay stand (regrowth, cuts, swath drying, rain on cut
// hay), the pasture, the animals (rations, health, illness, pregnancy, births, milk, eggs, growth) and the
// store (the cooler, the bulk tank, the hay stack). js/farm2.js does the work; this keeps the books.
// All names start with farm2 / FARM2_. Time is world days (farmDayNow, js/farmdata.js).

// --- His mixed farm's saved state ------------------------------------------------------------------------
function farm2Default() {
      return {
        v: 2, startedAt: 0, laidOut: false, lastDay: 0,
        orchard: { planted: { apple: 0, cherry: 0 }, plantedDay: { apple: null, cherry: null }, trellisRows: 0,
          blocks: { apple: farm2NewBlock(), cherry: farm2NewBlock() }, m: 0.6 },
        plots: [], hayId: null, irrigating: {}, pasture: { kg: 900, fenced: 0 },
        herd: [], flock: { n: 0, since: null, nestEggs: 0, layToday: 0, light: true }, nextId: 1,
        bunk: 0, feeder: 0, hay: { round: 0, square: 0, q: 0.8 }, store: {}, tankL: 0,
        births: [], deaths: [], sales: [], vet: [], lastCheck: 0, lastChores: 0, budget: null, decisions: [], earned: 0
      };
    }
function farm2NewBlock() { return { fruitKg: 0, setYear: null, prunedYear: null, sprayedYear: null, sprays: 0, frost: 0, pest: null, p: 0, pickedKg: 0, droppedKg: 0, ripe: false, fruitG: 0 }; }
function farm2State() {
      const F = farmState();
      const d = farm2Default();
      if (!F.mixed || typeof F.mixed !== 'object' || Array.isArray(F.mixed)) F.mixed = d;
      const X = F.mixed;
      Object.keys(d).forEach(k => {
        if (X[k] === undefined || X[k] === null && d[k] !== null) X[k] = d[k];
        else if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) && (typeof X[k] !== 'object' || Array.isArray(X[k]))) X[k] = d[k];
        else if (Array.isArray(d[k]) && !Array.isArray(X[k])) X[k] = d[k];
      });
      ['planted', 'plantedDay', 'blocks'].forEach(k => { if (!X.orchard[k] || typeof X.orchard[k] !== 'object') X.orchard[k] = d.orchard[k]; });
      ['apple', 'cherry'].forEach(c => { if (!X.orchard.blocks[c]) X.orchard.blocks[c] = farm2NewBlock(); if (!Number.isFinite(X.orchard.planted[c])) X.orchard.planted[c] = 0; });
      ['round', 'square'].forEach(k => { if (!Number.isFinite(X.hay[k])) X.hay[k] = 0; });
      if (X.herd.length > 60) X.herd.length = 60;
      ['births', 'deaths', 'sales', 'vet', 'decisions'].forEach(k => { if (X[k].length > 40) X[k].length = 40; });
      return X;
    }
function farm2Started() { const F = state.farm; return Boolean(F && F.mixed && F.mixed.startedAt); }
function farm2Done(key) { return ((farmState().buildings[key] || {}).stage) === 'done'; }
function farm2Log(text) { const X = farm2State(); X.decisions.unshift({ day: Math.floor(farmDayNow()), text: String(text).slice(0, 200) }); if (X.decisions.length > 40) X.decisions.length = 40; farmLog(text); }
// The calendar year of world day d (as the season task counts years)
function farm2Year(d = farmDayNow()) { const cal = ensureCalendar(); return 1 + Math.floor((cal.startDayOfYear + Math.floor(d)) / DAYS_PER_YEAR); }   // = worldNow().year
function farm2Hash(n) { return typeof windHash === 'function' ? windHash(n) : ((Math.sin(n * 12.9898) * 43758.5453) % 1 + 1) % 1; }

// --- The orchard --------------------------------------------------------------------------------------------
// Bearing: none before bearFrom years, a ramp to full crop at fullAt
function farm2TreeAge(crop, d = farmDayNow()) { const pd = farm2State().orchard.plantedDay[crop]; return Number.isFinite(pd) ? Math.max(0, (d - pd) / DAYS_PER_YEAR) : 0; }
function farm2Bearing(crop, d = farmDayNow()) {
      const C = FARM_CROPS[crop], age = Math.floor(farm2TreeAge(crop, d) + 0.6);   // its 2nd summer counts as year 2
      if (!farm2State().orchard.planted[crop] || age < C.bearFrom) return 0;
      return Math.min(1, (age - C.bearFrom + 1) / (C.fullAt - C.bearFrom + 1));
    }
function farm2OrchardStage(crop, d = farmDayNow()) {
      const C = FARM_CROPS[crop], B = farm2State().orchard.blocks[crop], doy = farmDayInfo(d).doy;
      if (!farm2State().orchard.planted[crop]) return 'not planted';
      if (doy < C.bloom - 25 || doy > 320) return 'dormant';
      if (doy < C.bloom - 6) return 'buds swelling';
      if (doy <= C.bloom + 6) return 'in bloom';
      if (!B.fruitKg) return doy > C.window[1] ? 'leaves turning' : 'in leaf';
      if (doy < C.window[0]) return 'fruit sizing';
      if (doy <= C.window[1] + 8) return 'ripe';
      return 'past ripe';
    }
function farm2OrchardDay(d) {
      const X = farm2State(), O = X.orchard, w = farmDayInfo(d), yr = farm2Year(d);
      // the orchard is on drip from the well once the well is in; otherwise rain only
      const drip = farm2Done('well') && (O.trellisRows > 0);
      O.m = Math.max(0.08, Math.min(1, O.m + w.rainH * 0.018 - (0.003 + 0.011 * w.heat) + (drip && O.m < 0.55 ? 0.03 : 0) + (w.frozen ? 0.006 : 0)));
      ['apple', 'cherry'].forEach(crop => {
        const C = FARM_CROPS[crop], B = O.blocks[crop], n = O.planted[crop];
        if (!n) return;
        // a frost night in bloom kills open flowers (Kelowna: a late frost every few springs)
        if (Math.abs(w.doy - C.bloom) <= 6 && farm2Hash(6600000 + Math.floor(d) * 3 + (crop === 'apple' ? 1 : 2)) < 0.035) {
          B.frost = Math.min(0.8, (B.frost || 0) + 0.25);
          farmLog(`Frost in the ${crop} bloom`);
        }
        // fruit set ten days after bloom, sized to the trees' age, the pruning and the frost
        if (w.doy === C.bloom + 10 && B.setYear !== yr) {
          const bearing = farm2Bearing(crop, d), pruned = B.prunedYear === yr ? 1 : 0.8, water = O.m < 0.2 ? 0.75 : 1;
          B.fruitKg = Math.round(n * C.kgTree * bearing * pruned * water * (1 - (B.frost || 0)) * 10) / 10;
          B.setYear = yr; B.fruitG = 0; B.pickedKg = 0; B.droppedKg = 0; B.ripe = false; B.pest = null; B.p = 0; B.sprays = 0;
        }
        if (w.doy === 1) { B.frost = 0; }
        if (B.fruitKg > 0) {
          // sizing to the picking window; drought costs size
          const span = Math.max(20, C.window[0] - C.bloom - 10);
          if (w.doy > C.bloom + 10 && w.doy < C.window[0]) B.fruitG = Math.min(1, B.fruitG + 1 / span * (O.m < 0.2 ? 0.7 : 1));
          if (w.doy >= C.window[0]) { B.fruitG = 1; B.ripe = true; }
          if (O.m < 0.15 && !w.frozen) B.fruitKg = Math.max(0, B.fruitKg * 0.998);
          // pests: a chance each day in their window, then they build until he sprays
          if (C.pests && !B.pest && w.doy >= C.pests.window[0] && w.doy <= C.pests.window[1] && farm2Hash(6700000 + Math.floor(d) * 5 + crop.length) < C.pests.chance) { B.pest = C.pests.name; B.p = 0.06; }
          if (B.pest) { B.p = Math.min(1, B.p + 0.03); B.fruitKg = Math.max(0, B.fruitKg * (1 - B.p * 0.006)); }
          // past the window the fruit drops; frost finishes what is left
          if (w.doy > C.window[1] + 4) { const drop = B.fruitKg * 0.03; B.fruitKg -= drop; B.droppedKg = (B.droppedKg || 0) + drop; }
          // two weeks past the window what is left has dropped or rotted; frost finishes the rest
          if ((w.frozen && w.doy > 290) || w.doy > C.window[1] + 14) { B.droppedKg = (B.droppedKg || 0) + B.fruitKg; B.fruitKg = 0; B.ripe = false; }
          B.fruitKg = Math.round(B.fruitKg * 10) / 10;
        }
      });
    }

// --- Vegetable plots and the hay stand: the grain field model, plus drip and a perennial stand --------------
function farm2Plots() { return farm2State().plots; }
function farm2Veg() { return farm2Plots().filter(p => p.use === 'vegetable'); }
function farm2HayField() { const X = farm2State(); return X.plots.find(p => p.id === X.hayId) || null; }
function farm2PlotDay(f, d) {
      const X = farm2State(), w = farmDayInfo(d);
      if (f.use === 'hay') return farm2HayDay(f, d);
      farmFieldDay(f, d);
      // drip: the valve open tops the beds up; the crop drinks more in the heat
      if (X.irrigating[f.id] && !w.frozen && farm2Done('well')) {
        const C = FARM_CROPS[f.crop] || {};
        if (f.m < 0.78) f.m = Math.min(0.85, f.m + 0.045 * (C.water || 1));
        X.waterL = (X.waterL || 0) + farmFieldHa(f) * 10000 * 0.004 * 1000;
      }
      // a ripe vegetable left in the ground: beans get tough, squash keeps a while, roots keep longest
      if (f.crop && f.g >= 1 && f.soil === 'seeded') {
        const keep = { bean: 6, squash: 40, carrot: 50, potato: 45 }[f.crop] || 20;
        if (d - (f.ripeDay || d) > keep) f.yp = Math.max(0.1, f.yp - 0.03);
      }
    }
// The hay stand: regrows after each cut (not reseeded), sleeps in winter; cut hay dries in the swath
function farm2HayDay(f, d) {
      const C = FARM_CROPS.hay, w = farmDayInfo(d);
      const canopy = f.soil === 'seeded' ? Math.min(1, f.g * 1.4) : 0;
      f.m = Math.max(0.05, Math.min(1, f.m + w.rainH * 0.018 - (0.003 + 0.011 * w.heat) * (0.5 + canopy * 0.7) + (w.frozen ? 0.006 : 0)));
      if (w.doy >= 80 && w.doy <= 100) f.m = Math.min(0.85, f.m + 0.012);
      if (f.soil === 'seeded' && !w.frozen) {
        const mf = f.m < 0.12 ? 0.15 : f.m < 0.3 ? 0.15 + 0.85 * (f.m - 0.12) / 0.18 : 1;
        // establishing in its first summer: slower
        const est = f.seededDay && d - f.seededDay < 70 ? 0.6 : 1;
        if (f.g < 1) { f.g = Math.min(1, f.g + (0.3 + 0.7 * w.heat) * mf * est / C.days * 1.15); if (f.g >= 1) f.ripeDay = d; }
        else { f.q = Math.max(0.45, (f.q || 1) - 0.006); f.g = Math.min(1.25, f.g + 0.004); }
        f.w = Math.min(0.6, f.w + 0.002 * w.heat);
      }
      if (w.frozen && f.g > 0.2 && f.soil === 'seeded') { f.g = Math.max(0.12, f.g - 0.02); }
      if (w.doy === 70) { f.q = 1; f.cutsThisYear = 0; }
      // the swath: mown hay drying in the sun; rain on it washes the leaves and the quality out
      const S = f.swath;
      if (S && S.stage !== 'baled') {
        const k = S.stage === 'tedded' ? 1.5 : S.stage === 'windrow' ? 0.65 : 1;
        S.m = Math.max(10, S.m - (5 + 17 * w.heat) * k + w.rainH * 3);
        if (w.rainH) S.q = Math.max(0.35, S.q - 0.04 * Math.min(4, w.rainH));
        S.days = (S.days || 0) + 1;
        if (S.days > 14) S.q = Math.max(0.3, S.q - 0.02);
      }
    }
function farm2HayYieldT(f) { return Math.max(0, FARM_CROPS.hay.yield * farmFieldHa(f) * Math.min(1.15, f.g) * (1 - 0.4 * f.w)); }

// --- The pasture ---------------------------------------------------------------------------------------------
function farm2PastureHa() { const P = FARM2_LAYOUT.pasture; return (P.x1 - P.x0) * (P.d1 - P.d0) / 10000; }
function farm2GrazingSeason(d = farmDayNow()) { const w = farmDayInfo(d); return !w.frozen && w.doy >= 120 && w.doy <= 300; }
function farm2PastureDay(d) {
      const X = farm2State(), w = farmDayInfo(d), ha = farm2PastureHa();
      // irrigated grass-clover pasture: up to ~70 kg DM/ha a day at the height of summer
      if (!w.frozen) X.pasture.kg = Math.min(3200 * ha, X.pasture.kg + 70 * ha * w.heat * (w.rainH || farm2Done('well') ? 1 : 0.6));
    }

// --- The animals ---------------------------------------------------------------------------------------------
function farm2Cattle() { return farm2State().herd.filter(a => a.kind === 'dairy' || a.kind === 'beef'); }
function farm2Adults(kind) { return farm2State().herd.filter(a => a.kind === kind && !a.calf); }
const FARM2_NAMES = { dairy: ['Daisy', 'Clover', 'Buttercup', 'Hazel', 'Primrose', 'Willow', 'Maple', 'Juniper', 'Poppy', 'Fern'], beef: ['Ruby', 'Midnight', 'Sable', 'Onyx', 'Raven', 'Ember', 'Coal', 'Pepper', 'Ash', 'Shadow'] };
function farm2NewAnimal(kind, opts = {}) {
      const X = farm2State(), A = FARM_ANIMALS[kind], id = 'a' + (X.nextId++);
      const names = FARM2_NAMES[kind] || ['Bo'], used = new Set(X.herd.map(a => a.name));
      const name = opts.name || names.find(n => !used.has(n)) || `${A.short} ${id}`;
      const d = Math.floor(farmDayNow());
      return { id, kind, name, sex: opts.sex || 'f', born: Number.isFinite(opts.born) ? opts.born : d - 4 * DAYS_PER_YEAR, kg: opts.kg || A.kg,
        bcs: 3.2, health: 100, sick: null, due: Number.isFinite(opts.due) ? opts.due : null, calved: null, dam: opts.dam || null, calf: Boolean(opts.calf), x: null, z: null };
    }
function farm2Ration(a, d) {
      const A = FARM_ANIMALS[a.kind], age = d - a.born;
      if (a.calf) {
        if (age < 60) return { hay: 0.5, grain: 0.3, milk: a.kind === 'dairy' ? 6 : 0 };
        const k = Math.min(1, a.kg / A.kg);
        return { hay: A.hayKg * k, grain: (a.kind === 'beef' && age > 420 ? 4 : 1.5) * k, milk: 0 };
      }
      const inMilk = a.kind === 'dairy' && a.calved != null && d - a.calved < A.lactation;
      return { hay: A.hayKg, grain: inMilk ? A.grainKg : A.grainKg * 0.4, milk: 0 };
    }
// Milk a day by days in milk (a Wood's lactation curve: peak at ~50 days, then a slow fall)
function farm2MilkL(a, d) {
      const A = FARM_ANIMALS.dairy;
      if (a.kind !== 'dairy' || a.calved == null || a.calf) return 0;
      const dim = d - a.calved;
      if (dim < 0 || dim >= A.lactation) return 0;
      if (a.due != null && a.due - d < A.dry) return 0;
      const t = Math.max(1, dim);
      const curve = Math.pow(t / 50, 0.25) * Math.exp(-0.25 * (t / 50 - 1)) * Math.exp(-0.0018 * Math.max(0, t - 50));
      return A.milkPeak * Math.min(1.02, curve);
    }
function farm2HenLay(d) {
      const X = farm2State(), w = farmDayInfo(d), F = X.flock;
      if (!F.n) return 0;
      // daylength: the coop light keeps a 14 h day; without it they slow in short days
      const day = 12 + 3.6 * Math.cos((w.doy - 172) / 365 * Math.PI * 2);
      const light = F.light || day >= 14 ? 1 : Math.max(0.25, (day - 9) / 5);
      const weeks = F.since != null ? 20 + (d - F.since) / 7 : 30;
      const age = weeks < 22 ? 0.5 : weeks < 70 ? 1 : Math.max(0.55, 1 - (weeks - 70) * 0.008);
      return FARM_ANIMALS.hen.lay * light * age;
    }
function farm2CattleDemand(d = farmDayNow()) {
      let hay = 0, grain = 0;
      farm2Cattle().forEach(a => { const r = farm2Ration(a, d); hay += r.hay; grain += r.grain; });
      return { hay, grain, tmr: hay + grain };
    }
function farm2Day(d) {
      const X = farm2State(), w = farmDayInfo(d), day = Math.floor(d);
      farm2OrchardDay(d);
      X.plots.forEach(f => farm2PlotDay(f, d));
      farm2PastureDay(d);
      // the hay a neighbour delivered goes on the stack
      const bought = farmStock('hay_bought');
      if (bought >= 1) { X.hay.round += Math.floor(bought); farmUse('hay_bought', Math.floor(bought)); }
      const cattle = farm2Cattle();
      if (cattle.length) {
        // what they need (as fed), what the pasture gives in season, and the rest from the bunk
        const need = farm2CattleDemand(d);
        let fromPasture = 0;
        if (farm2GrazingSeason(d) && X.pasture.fenced >= 1) {
          const want = cattle.reduce((s, a) => s + (a.calf && d - a.born < 60 ? 0 : FARM_ANIMALS[a.kind].grazeKgDM * Math.min(1, a.kg / FARM_ANIMALS[a.kind].kg)), 0) * 0.6;
          fromPasture = Math.min(want, Math.max(0, X.pasture.kg - 150 * farm2PastureHa()));
          X.pasture.kg -= fromPasture;
        }
        const fromBunk = Math.min(X.bunk, Math.max(0, need.tmr - fromPasture * 1.15));
        X.bunk = Math.round((X.bunk - fromBunk) * 10) / 10;
        const fed = Math.min(1, (fromPasture * 1.15 + fromBunk) / Math.max(1, need.tmr));
        X.fedCattle = Math.round(fed * 100) / 100;
        cattle.forEach(a => farm2AnimalDay(a, d, fed, w));
      }
      // the hens: the feeder, the nest boxes
      if (X.flock.n > 0) {
        const need = X.flock.n * FARM_ANIMALS.hen.feedKg, got = Math.min(X.feeder, need);
        X.feeder = Math.round((X.feeder - got) * 100) / 100;
        const fed = need ? got / need : 1;
        X.fedHens = Math.round(fed * 100) / 100;
        if (fed < 0.5 && farm2Hash(6800000 + day) < 0.15) { X.flock.n = Math.max(0, X.flock.n - 1); X.deaths.unshift({ day, what: 'a hen (hungry, cold)' }); }
        const eggs = X.flock.n * farm2HenLay(d) * (0.4 + 0.6 * fed);
        // eggs left in the boxes: some get broken or pecked
        X.flock.nestEggs = Math.round(X.flock.nestEggs * 0.95 + eggs);
        X.flock.layToday = Math.round(eggs);
      }
      // the bulk tank: the robot milks each cow two or three times a day
      let milk = 0;
      farm2Adults('dairy').forEach(a => { milk += farm2MilkL(a, d) * (a.sick === 'mastitis' ? 0 : a.health / 100) * (0.6 + 0.4 * (X.fedCattle ?? 1)); });
      if (milk > 0) { X.tankL = Math.min(1000, Math.round((X.tankL + milk) * 10) / 10); X.tankDays = (X.tankDays || 0) + 1; }
      // raw milk keeps three days in the cooled tank; older than that goes down the drain
      if (X.tankDays > 3 && X.tankL > 0) { X.spiltL = (X.spiltL || 0) + X.tankL * 0.4; X.tankL = Math.round(X.tankL * 0.6); }
      farm2StoreDay(d);
    }
function farm2AnimalDay(a, d, fed, w) {
      const X = farm2State(), A = FARM_ANIMALS[a.kind], day = Math.floor(d), h = farm2Hash(6900000 + day * 17 + parseInt(a.id.slice(1), 10) * 7);
      // body condition follows the feed; health follows condition and illness
      a.bcs = Math.max(1.5, Math.min(4.2, a.bcs + (fed - 0.92) * 0.04));
      if (a.calf) a.kg = Math.min(A.kg * (a.sex === 'm' ? 1.05 : 0.95), a.kg + (a.kind === 'beef' ? 1.05 : 0.75) * Math.max(0.2, fed));
      if (a.sick) a.health = Math.max(5, a.health - 2.5);
      else a.health = Math.min(100, a.health + (fed > 0.85 ? 1 : -1.5));
      // illness: a small chance any day, much more when hungry or thin
      const risk = 0.0018 + (fed < 0.8 ? 0.012 : 0) + (a.bcs < 2.3 ? 0.01 : 0) + (a.calf && d - a.born < 30 ? 0.006 : 0);
      if (!a.sick && h < risk) {
        a.sick = a.calf && d - a.born < 30 ? 'scours' : a.kind === 'dairy' && a.calved != null && d - a.calved < A.lactation ? (h < risk * 0.6 ? 'mastitis' : 'lameness') : h < risk * 0.5 ? 'pinkeye' : 'foot rot';
        a.sickDay = day;
        farmLog(`${a.name} is sick: ${a.sick}`);
      }
      if (a.health <= 5 && a.sick && d - (a.sickDay || d) > 12) { a.dead = true; X.deaths.unshift({ day, what: `${a.name} the ${A.short} (${a.sick}, untreated)` }); }
      // calving
      if (a.due != null && d >= a.due && !a.calf) {
        const sex = h < 0.5 ? 'm' : 'f';
        const calf = farm2NewAnimal(a.kind, { calf: true, sex, born: day, kg: A.calfKg, dam: a.id, name: `${a.name}'s ${sex === 'm' ? 'bull' : 'heifer'} calf` });
        calf.x = a.x; calf.z = a.z;
        X.herd.push(calf);
        a.calved = day; a.due = null; a.bred = null;
        X.births.unshift({ day, dam: a.name, kind: a.kind, sex, id: calf.id });
        if (X.births.length > 40) X.births.length = 40;
        farmLog(`${a.name} calved: a ${sex === 'm' ? 'bull' : 'heifer'} calf`);
      }
      // bred back (artificial insemination by the technician) about 80 days after calving
      if (!a.calf && a.due == null && a.calved != null && d - a.calved >= 80) { a.due = day + A.gestation; a.bred = day; }
      // a heifer calf grows up: bred at 15 months, first calf at two years
      if (a.calf && d - a.born >= 450 && a.sex === 'f') { a.calf = false; a.due = day + A.gestation; a.bred = day; a.name = a.name.replace(/'s heifer calf$/, ' II'); }
    }
function farm2Remove(ids) { const X = farm2State(); X.herd = X.herd.filter(a => !ids.includes(a.id)); }

// --- The store: the cooler, the bottled milk, the hay stack ------------------------------------------------
// store[key] = { kg (or dozen, litres, quarters), day }; fruit and vegetables keep their keepDays in the cooler
// and a fifth of that out of it
function farm2StoreAdd(key, amt, extra = {}) {
      const X = farm2State(), s = X.store[key] || (X.store[key] = { n: 0, day: Math.floor(farmDayNow()) });
      s.n = Math.round((s.n + amt) * 100) / 100; s.day = Math.floor(farmDayNow()); Object.assign(s, extra);
      return s.n;
    }
function farm2StoreHas(key) { const s = farm2State().store[key]; return s ? Math.max(0, s.n) : 0; }
function farm2StoreTake(key, amt) { const X = farm2State(), s = X.store[key]; if (!s) return 0; const got = Math.min(s.n, amt); s.n = Math.round((s.n - got) * 100) / 100; return got; }
function farm2StoreDay(d) {
      const X = farm2State(), cool = farm2Done('packshed');
      Object.entries(X.store).forEach(([k, s]) => {
        if (!(s.n > 0)) return;
        const C = FARM_CROPS[k];
        const keep = C ? C.keepDays * (cool ? 1 : 0.2) : k === 'eggs' ? 35 : k === 'milk' ? 10 : 0;
        if (!keep) return;
        // losses grow as it ages past its keeping time
        const age = d - (s.day || d), loss = age > keep ? 0.06 : 1 / (keep * 6);
        const lost = s.n * loss;
        s.n = Math.round((s.n - lost) * 100) / 100;
        X.spoiled = Math.round(((X.spoiled || 0) + lost) * 10) / 10;
      });
    }
function farm2HayKg() { const H = farm2State().hay; return H.round * 450 + H.square * 25 + (H.loose || 0); }

// --- Feed budget: what the animals need until the grass and the first cut, what is in the stack and bins ----
function farm2FeedBudget(d = farmDayNow()) {
      const X = farm2State(), w = farmDayInfo(d), dem = farm2CattleDemand(d);
      // days the herd must be fed from the stack: to the first cut of next year (~day 165) when out of season,
      // or to the end of the coming winter when planning in the autumn
      const doy = w.doy, toCut = doy <= 165 ? 165 - doy : DAYS_PER_YEAR - doy + 165;
      const grazeDays = farm2GrazingSeason(d) ? Math.max(0, 300 - doy) : 0;
      const days = Math.min(toCut, 365);
      const hayNeed = dem.hay * (days - grazeDays * 0.5);
      const hens = X.flock.n * FARM_ANIMALS.hen.feedKg * days;
      const grainNeed = dem.grain * days + hens * 0.75;
      const corn = ((farmState().bins.corn || {}).t || 0) * 1000, wheat = ((farmState().bins.wheat || {}).t || 0) * 1000;
      const hayHave = farm2HayKg() + X.bunk * FARM_FEED.tmr.hay;
      const H = farm2HayField(), cutsLeft = H && H.soil === 'seeded' && doy < 250 ? Math.max(0, (FARM_CROPS.hay.cuts - (H.cutsThisYear || 0))) : 0;
      const hayComing = H ? cutsLeft * FARM_CROPS.hay.yield * farmFieldHa(H) * 1000 * 0.85 : 0;
      return { days, hayNeedKg: Math.round(hayNeed), hayHaveKg: Math.round(hayHave), hayComingKg: Math.round(hayComing), hayShortKg: Math.max(0, Math.round(hayNeed - hayHave - hayComing)),
        grainNeedKg: Math.round(grainNeed), grainHaveKg: Math.round(corn + wheat), grainShortKg: Math.max(0, Math.round(grainNeed - corn - wheat)),
        bunkDays: dem.tmr ? Math.round(X.bunk / dem.tmr * 10) / 10 : 99, feederDays: X.flock.n ? Math.round(X.feeder / (X.flock.n * FARM_ANIMALS.hen.feedKg) * 10) / 10 : 99 };
    }
// Grain he keeps back in the bins for his own animals (not listed for sale): the budget's grain need
function farm2GrainReserveT(crop) {
      if (!farm2Started() || !farm2Cattle().length && !farm2State().flock.n) return 0;
      const b = farm2FeedBudget(), share = crop === 'corn' ? 0.7 : crop === 'wheat' ? 0.3 : 0;
      return Math.round(b.grainNeedKg * share / 100) / 10;
    }

// Bring the whole mixed farm up to today (a long absence catches up, capped at two years)
function farm2Simulate(now = Date.now()) {
      if (!farm2Started()) return;
      const X = farm2State(), today = Math.floor(farmDayNow(now));
      let d = Number.isFinite(X.lastDay) && X.lastDay > 0 ? X.lastDay : today;
      if (today - d > 730) d = today - 730;
      while (d < today) { d++; farm2Day(d); }
      X.lastDay = today;
      const dead = X.herd.filter(a => a.dead).map(a => a.id);
      if (dead.length) farm2Remove(dead);
    }
