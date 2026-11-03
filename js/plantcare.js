// Kelo-bot-1 — js/plantcare.js
// Loaded after groundwork.js. Looking after living things: his plantings in the valley
// (state.worldEdits of type 'plant') and the four garden beds (state.gardenPlots).
//   - Every plant has soil moisture, nutrients and health (e.care for plantings, p.care for beds).
//     They are worked out in fixed steps of ten world minutes from saved timestamps, so the garden
//     keeps growing while the page is closed and always comes out the same for the same history.
//   - The soil dries out, faster on hot summer afternoons; spring rain refills it. Growth needs
//     moist (not soggy) soil and nutrients; fertilizer (compost, bone meal, all-purpose) boosts it and
//     is used up. A dry or starved plant wilts: it droops and turns brown, and recovers with care.
//   - Plantings grow through stage models (seedling, sapling, young tree, mature; sprout, buds,
//     bloom) with smooth size changes; the beds' vegetables blossom, set green fruit and ripen.
//   - The first time a plant wilts he goes to look, then reads up on plant care at NetNode
//     (GROUND_JOBS.plantcare, js/groundwork.js). From then on he waters and feeds on his own when
//     the soil needs it, filling his watering can at the garden tap or the lake. Water runs from the
//     can's rose in droplets that splash and darken the soil.

const PC_STEP_MS = WORLD_DAY_MS / 24 / 6;   // ten world minutes (five real ones)
const PC_STEP_HOURS = 1 / 6;
const PC_MAX_STEPS = 40000;                  // catch-up limit (about 140 real days)
const PC_WILT_AT = 0.75;                     // health below this shows as wilting
const PC_CAN_RE = /watering can|garden hose|\bhose\b/i;
const PC_FERT_RE = /fertili[sz]er|compost|bone ?meal|blood ?meal|plant food|manure|worm castings/i;
const PC_TAP = { x: -13.4, z: 2.5 };         // the garden's yard hydrant, west of the beds
const PC_BEDS = [0, 1, 2, 3].map(p => ({ x: -11.5 + (p % 2) * 2.4, z: 1.6 + Math.floor(p / 2) * 1.8 })); // as built in js/scene.js
const PC_FEEDS = [
  { re: /bone ?meal/i, n: 0.35, label: 'bone meal' },
  { re: /compost|manure|worm castings/i, n: 0.3, m: 0.08, label: 'compost' },
  { re: /./, n: 0.5, label: 'fertilizer' }
];
const PC_BROWN = new THREE.Color(0x8a6a34);
const PC_SOIL_DRY = new THREE.Color(0x8c6a45), PC_SOIL_WET = new THREE.Color(0x2c1c0e);
const PC_BED_DRY = new THREE.Color(0x7a5a38), PC_BED_WET = new THREE.Color(0x23170b);

let pcWater = null, pcGrain = null;   // the two particle sprays
let pcTapGroup = null;
let pcBedSoils = [];                  // the beds' soil meshes (js/scene.js)
let pcBedLooks = [];                  // per bed: inner group, fruit, blossoms, foliage materials
let pcHeld = null;                    // what he is pouring with: { obj, tilt, rose, want }
let pcWeatherCache = new Map();
const pcBefore = {};                  // each plant's health as saved, before catching up (for the note on return)

// --- His notes on the garden ---------------------------------------------------------------------
function pcState() {
      if (!state.plantCare || typeof state.plantCare !== 'object') state.plantCare = {};
      const s = state.plantCare;
      if (!Number.isFinite(s.can)) s.can = 0;
      if (!Number.isFinite(s.waterings)) s.waterings = 0;
      if (!Number.isFinite(s.feedings)) s.feedings = 0;
      if (!Number.isFinite(s.refills)) s.refills = 0;
      if (s.firstWiltAt === undefined) s.firstWiltAt = null;
      return s;
    }

const pcClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pcStepFloor = (ms) => Math.floor(ms / PC_STEP_MS) * PC_STEP_MS;

// --- The weather a plant feels, step by step (repeatable: same time, same answer) ----------------
function pcWeatherAt(ms) {
      const idx = Math.floor(ms / PC_STEP_MS);
      const hit = pcWeatherCache.get(idx);
      if (hit) return hit;
      const w = worldNow(ms);
      const heatBase = { Winter: 0.05, Spring: 0.45, Summer: 1, Autumn: 0.35 }[w.season];
      const sun = Math.max(0, Math.sin(Math.PI * (w.hour - 6) / 14));
      const wx = {
        season: w.season,
        heat: heatBase * (0.35 + 0.65 * sun),
        rain: w.season === 'Spring' && typeof rainForHour === 'function' && rainForHour((w.day - 1) * 24 + Math.floor(w.hour)),
        frozen: w.season === 'Winter'
      };
      if (pcWeatherCache.size > 6000) pcWeatherCache.clear();
      pcWeatherCache.set(idx, wx);
      return wx;
    }

// One step of soil and plant life. Returns how fast it grew (0 = not at all, 1 = ideal, more when fed)
function pcStep(c, wx, established) {
      const H = PC_STEP_HOURS;
      let dry = wx.frozen ? 0.002 : 0.006 + 0.03 * wx.heat;
      if (c.m > 0.85) dry += 0.03; // the extra drains away
      c.m -= dry * H;
      if (wx.rain && c.m < 0.92) c.m = Math.min(0.92, c.m + 0.09 * H);
      if (established) c.m = Math.max(0.35, c.m); // deep roots reach the water table
      c.m = pcClamp(c.m, 0, 1);
      const mf = c.m < 0.12 ? 0 : c.m < 0.3 ? (c.m - 0.12) / 0.18 : c.m <= 0.85 ? 1 : 0.5;
      const nf = c.n < 0.25 ? Math.max(0.15, c.n / 0.25) : c.n > 0.55 ? 1 + 0.6 * Math.min(1, (c.n - 0.55) / 0.45) : 1;
      const sf = { Spring: 1.2, Summer: 1, Autumn: 0.6, Winter: 0.12 }[wx.season];
      const hf = pcClamp((c.h - 0.3) / 0.5, 0, 1);
      if (!wx.frozen && c.m < 0.15) c.h -= 0.05 * H;          // thirsty: wilts
      else if (c.m > 0.95) c.h -= 0.015 * H;                  // waterlogged roots
      else if (c.n < 0.06) c.h -= 0.01 * H;                   // starved
      else c.h += (c.m >= 0.3 && c.m <= 0.85 ? 0.03 : 0.01) * H;
      c.h = pcClamp(c.h, 0.05, 1);
      const rate = mf * nf * sf * hf;
      c.n = Math.max(0, c.n - (0.0035 * Math.min(1, rate) + 0.0004) * H);
      return rate;
    }

// Bring one plant's record up to `now`, a whole step at a time
function pcSimulate(c, kind, now = Date.now()) {
      let steps = Math.floor((now - c.t) / PC_STEP_MS);
      if (steps <= 0) return 0;
      if (steps > PC_MAX_STEPS) { c.t += (steps - PC_MAX_STEPS) * PC_STEP_MS; steps = PC_MAX_STEPS; }
      const live = typeof rainOverride !== 'undefined' && rainOverride !== null ? rainOverride : null;
      for (let i = 0; i < steps; i++) {
        let wx = pcWeatherAt(c.t + PC_STEP_MS / 2);
        if (live !== null && c.t + PC_STEP_MS > now - 2 * PC_STEP_MS) wx = { ...wx, rain: live };
        if (kind === 'bed') {
          const rate = pcStep(c, wx, false);
          c.g = Math.min(100, c.g + rate * PC_STEP_HOURS * 100 / (5 * 24));
        } else {
          const rate = pcStep(c, wx, kind === 'tree' && c.g >= 1);
          const days = kind === 'tree' ? GROW_DAYS : GROW_DAYS * 0.6;
          c.g = Math.min(1, c.g + rate * PC_STEP_HOURS / (days * 24));
        }
        c.t += PC_STEP_MS;
      }
      return steps;
    }

// The care record of a planting (older ones start from how far they had grown by the old clock)
function pcPlantingCare(e) {
      if (!e.care || !Number.isFinite(e.care.t)) {
        const age = Date.now() - (e.at || Date.now());
        const old = age < 120000 ? 0.02 : Math.min(1, 0.15 + (age + (e.rainMs || 0)) / WORLD_DAY_MS / GROW_DAYS);
        e.care = { m: 0.65, n: 0.45, h: 1, g: old, t: pcStepFloor(Date.now()) };
      }
      if (!(e.id in pcBefore)) pcBefore[e.id] = e.care.h;
      return e.care;
    }

function pcBedCare(p) {
      if (!p.care || !Number.isFinite(p.care.t)) p.care = { m: 0.6, n: 0.5, h: 1, t: pcStepFloor(Date.now()) };
      if (!(('bed:' + p.name) in pcBefore)) pcBefore['bed:' + p.name] = p.care.h;
      return p.care;
    }

// Everything he looks after, with where to stand to tend it
function pcTargets() {
      const list = [];
      (state.worldEdits || []).forEach(e => {
        if (e.type !== 'plant') return;
        const c = pcPlantingCare(e);
        list.push({ key: e.id, kind: e.kind === 'flowers' ? 'flowers' : 'tree', e, rec: c, x: e.x, z: e.z,
          label: e.kind === 'flowers' ? 'my flowers' : 'my young tree', floorY: () => getIslandGroundHeight(e.x, e.z) + 0.03 });
      });
      (state.gardenPlots || []).slice(0, PC_BEDS.length).forEach((p, i) => {
        const b = PC_BEDS[i];
        list.push({ key: 'bed' + i, kind: 'bed', p, idx: i, rec: pcBedCare(p), x: b.x, z: b.z,
          label: `the ${String(p.name).replace(/^(okanagan|heritage)\s+/i, '').toLowerCase()}`, floorY: () => getAnalyticalGroundHeight(b.x, b.z) + 0.49 });
      });
      return list;
    }

// Bring every plant up to now (beds keep their ripeness in p.growth, which harvesting lowers)
function pcSyncAll(now = Date.now()) {
      (state.worldEdits || []).forEach(e => { if (e.type === 'plant') pcSimulate(pcPlantingCare(e), e.kind === 'flowers' ? 'flowers' : 'tree', now); });
      (state.gardenPlots || []).slice(0, PC_BEDS.length).forEach(p => {
        const c = pcBedCare(p);
        c.g = Number.isFinite(p.growth) ? p.growth : 0;
        if (pcSimulate(c, 'bed', now)) p.growth = c.g; // unrounded, so live and catch-up steps agree exactly
      });
    }

// How far a planting has grown, 0..1 (read by growthOf in js/landscape.js)
function plantGrowthOf(e) {
      const c = pcPlantingCare(e);
      pcSimulate(c, e.kind === 'flowers' ? 'flowers' : 'tree');
      return c.g;
    }

function plantStageOf(e) {
      const g = plantGrowthOf(e);
      if (e.kind === 'flowers') return g < 0.3 ? 'sprouting' : g < 0.6 ? 'in bud' : 'in bloom';
      return g < 0.2 ? 'seedling' : g < 0.45 ? 'sapling' : g < 0.8 ? 'young tree' : 'mature tree';
    }

function pcWilt(c) {
      return pcClamp((0.85 - c.h) / 0.6, 0, 1);
    }

// --- Stage models for plantings ------------------------------------------------------------------
function pcLeafMaterial(e, i = 0) {
      const M = typeof naturalTreeMaterials === 'function' ? naturalTreeMaterials() : null;
      const base = M ? M.leaves[i % M.leaves.length] : new THREE.MeshStandardMaterial({ color: 0x4f7a2c, roughness: 0.8 });
      return base;
    }

function pcSeedlingModel(e, flowers) {
      const g = new THREE.Group();
      const rng = makeRng(e.id + 'sprout');
      const leaf = pcLeafMaterial(e, Math.floor(rng() * 6));
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.22, 6), leaf);
      stem.position.y = 0.11;
      g.add(stem);
      // Two seed leaves, then the first true leaves
      [[0.06, 0.2, 0], [-0.06, 0.2, Math.PI]].forEach(([x, y, r]) => {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 5), leaf);
        l.scale.set(1.3, 0.25, 0.7);
        l.position.set(x, y, 0);
        l.rotation.set(0, r, 0.3 * Math.sign(x));
        g.add(l);
      });
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 5), leaf);
      top.scale.set(0.8, 1.2, 0.5);
      top.position.y = 0.25;
      g.add(top);
      if (flowers) {
        // A low tuft of sprouts
        for (let i = 0; i < 6; i++) {
          const a = i * 2.4, r = 0.12 + (i % 3) * 0.12;
          const s = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16, 5), leaf);
          s.position.set(Math.cos(a) * r, 0.08, Math.sin(a) * r);
          s.rotation.z = (rng() - 0.5) * 0.5;
          g.add(s);
        }
      }
      return g;
    }

// A slim sapling tied to a bamboo stake
function pcSaplingModel(e) {
      const g = new THREE.Group();
      const rng = makeRng(e.id + 'sapling');
      const M = typeof naturalTreeMaterials === 'function' ? naturalTreeMaterials() : null;
      const bark = M ? M.bark : new THREE.MeshStandardMaterial({ color: 0x6b4a2e });
      const leaf = pcLeafMaterial(e, Math.floor(rng() * 6));
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.032, 1.1, 6), bark);
      stem.position.y = 0.55;
      const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 5), new THREE.MeshStandardMaterial({ color: 0xc9b07a, roughness: 0.8 }));
      stake.position.set(0.07, 0.5, 0);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 4, 10), new THREE.MeshStandardMaterial({ color: 0x2f6f3a }));
      tie.rotation.x = Math.PI / 2;
      tie.position.set(0.035, 0.7, 0);
      g.add(stem, stake, tie);
      for (let i = 0; i < 9; i++) {
        const a = i * 2.3 + rng(), y = 0.45 + i * 0.075;
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 5), leaf);
        l.scale.set(1.4, 0.35, 0.8);
        l.position.set(Math.cos(a) * 0.09, y, Math.sin(a) * 0.09);
        l.rotation.set(0, -a, 0.35);
        g.add(l);
      }
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.16, 9, 7), leaf);
      crown.scale.y = 1.3;
      crown.position.y = 1.12;
      g.add(crown);
      return g;
    }

// A young tree: a thin trunk and a small, open crown
function pcYoungTreeModel(e) {
      const g = new THREE.Group();
      const rng = makeRng(e.id + 'young');
      const M = typeof naturalTreeMaterials === 'function' ? naturalTreeMaterials() : null;
      const bark = M ? M.bark : new THREE.MeshStandardMaterial({ color: 0x6b4a2e });
      const leaf = pcLeafMaterial(e, Math.floor(rng() * 6));
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 1.6, 7), bark);
      trunk.position.y = 0.8;
      trunk.castShadow = true;
      g.add(trunk);
      for (let b = 0; b < 3; b++) {
        const a = b * 2.1 + rng(), len = 0.5;
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.035, len, 5), bark);
        br.position.set(Math.cos(a) * 0.15, 1.45, Math.sin(a) * 0.15);
        br.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
        g.add(br);
      }
      for (let k = 0; k < 5; k++) {
        const a = rng() * Math.PI * 2, d = k === 0 ? 0 : 0.28 + rng() * 0.2;
        const r = k === 0 ? 0.5 : 0.3 + rng() * 0.12;
        const geo = new THREE.SphereGeometry(r, 10, 8);
        if (typeof roughenGeometry === 'function') roughenGeometry(geo, 0.12, rng() * 100);
        const blob = new THREE.Mesh(geo, leaf);
        blob.position.set(Math.cos(a) * d, k === 0 ? 1.85 : 1.55 + rng() * 0.45, Math.sin(a) * d);
        blob.scale.y = 0.85;
        blob.castShadow = true;
        g.add(blob);
      }
      return g;
    }

// Flower stems with closed buds
function pcBudModel(e) {
      const g = new THREE.Group();
      const leaf = pcLeafMaterial(e, 1);
      const bud = new THREE.MeshStandardMaterial({ color: 0x7fae4a, roughness: 0.7 });
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4, r = 0.15 + (i % 3) * 0.2;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.3, 4), leaf);
        stem.position.set(x, 0.15, z);
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 7, 5), bud);
        b.scale.y = 1.5;
        b.position.set(x, 0.31, z);
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 4), leaf);
        l.scale.set(1, 0.2, 0.4);
        l.position.set(x + 0.04, 0.09, z);
        l.rotation.z = 0.5;
        g.add(stem, b, l);
      }
      return g;
    }

const pcHeightOf = (obj) => Math.max(0.05, new THREE.Box3().setFromObject(obj).max.y);

// Fit a planting's mesh (js/landscape.js plantingMesh) with its younger stages, once
function pcDressPlanting(e, m) {
      const flowers = e.kind === 'flowers';
      const mature = new THREE.Group();
      let soil = null;
      m.children.slice().forEach(ch => {
        if (!soil && ch.isMesh && ch.geometry && ch.geometry.type === 'CircleGeometry') { soil = ch; return; }
        mature.add(ch);
      });
      const stages = flowers
        ? [{ grp: pcSeedlingModel(e, true), to: 0.3 }, { grp: pcBudModel(e), to: 0.6 }, { grp: mature, to: 1.01 }]
        : [{ grp: pcSeedlingModel(e, false), to: 0.2 }, { grp: pcSaplingModel(e), to: 0.45 }, { grp: pcYoungTreeModel(e), to: 0.8 }, { grp: mature, to: 1.01 }];
      const mats = [];
      stages.forEach(s => {
        s.base = pcHeightOf(s.grp);
        // Each planting gets its own copies of its materials so it can wilt on its own
        const seen = new Map();
        s.grp.traverse(o => {
          if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
          if (!seen.has(o.material)) {
            const c = o.material.clone();
            if (o.material.userData && o.material.userData.baseColor === undefined && o.material.userData.seasonal) c.userData.baseColor = o.material.color.getHex();
            seen.set(o.material, c);
            mats.push(c);
          }
          o.material = seen.get(o.material);
        });
        const holder = new THREE.Group(); // droops and scales; the meshes inside stay put (js/perf.js)
        holder.add(s.grp);
        s.holder = holder;
        holder.visible = false;
        m.add(holder);
      });
      // Instanced flower heads measure as one flower: the clump really stands about 0.42 tall
      if (flowers) stages[stages.length - 1].base = 0.42;
      const hMature = stages[stages.length - 1].base;
      if (soil) {
        soil.material = soil.material.clone();
        soil.material.userData.pcSoil = true;
      }
      const rng = makeRng(e.id + 'lean');
      m.userData.pc = { stages, mats, soil, hMature, lean: rng() * Math.PI * 2, cur: { h: 0, w: 0, wet: -1 }, want: { h: 0, w: 0, wet: 0 } };
      if (typeof seasonApplied !== 'undefined') seasonApplied = null; // the new leaves take on the season
    }

// The height a planting stands at for its growth (smooth across the stage changes)
function pcPlantHeight(e, g, hMature) {
      const knots = e.kind === 'flowers' ? [[0, 0.12], [0.3, 0.45], [0.6, 0.7], [1, 1]] : [[0, 0.025], [0.2, 0.14], [0.45, 0.38], [0.8, 0.8], [1, 1]];
      for (let i = 1; i < knots.length; i++) {
        if (g <= knots[i][0]) {
          const [g0, h0] = knots[i - 1], [g1, h1] = knots[i];
          return (h0 + (h1 - h0) * (g - g0) / (g1 - g0)) * hMature;
        }
      }
      return hMature;
    }

// Called by js/landscape.js whenever a planting's mesh is made or refreshed
function plantcareLook(e, m) {
      if (!m) return;
      if (!m.userData.pc) pcDressPlanting(e, m);
      m.scale.setScalar(1);
      const c = pcPlantingCare(e);
      pcSimulate(c, e.kind === 'flowers' ? 'flowers' : 'tree');
      const pc = m.userData.pc;
      pc.want = { h: pcPlantHeight(e, c.g, pc.hMature), w: pcWilt(c), wet: pcClamp((c.m - 0.12) / 0.6, 0, 1), g: c.g };
      if (pc.cur.wet < 0) pc.cur = { ...pc.want }; // the first time: no easing in from nothing
    }

// Ease a planting toward how it should look now
function pcApplyPlantingLook(m, k) {
      const pc = m.userData.pc;
      const cur = pc.cur, want = pc.want;
      cur.h += (want.h - cur.h) * k;
      cur.w += (want.w - cur.w) * k;
      cur.wet += (want.wet - cur.wet) * k;
      const g = want.g;
      const stage = pc.stages.find(s => g < s.to) || pc.stages[pc.stages.length - 1];
      pc.stages.forEach(s => {
        const on = s === stage;
        if (s.holder.visible !== on) s.holder.visible = on;
        if (!on) return;
        const sc = cur.h / s.base;
        // Wilting: it sags and leans over, and the leaves brown
        s.holder.scale.set(sc, sc * (1 - 0.28 * cur.w), sc);
        s.holder.rotation.set(Math.sin(pc.lean) * 0.32 * cur.w, 0, Math.cos(pc.lean) * 0.32 * cur.w);
      });
      pcTint(pc.mats, cur.w * 0.8);
      if (pc.soil) pcSoilColor(pc.soil.material, cur.wet, PC_SOIL_DRY, PC_SOIL_WET);
    }

// Brown a set of materials by `amount`, on top of whatever colour the seasons gave them
function pcTint(mats, amount) {
      mats.forEach(mt => {
        const u = mt.userData;
        const hex = mt.color.getHex();
        if (u.pcSet !== hex) u.pcBase = hex; // someone else (the seasons) recoloured it
        if (u.pcAmt !== undefined && Math.abs(u.pcAmt - amount) < 0.004 && u.pcSet === hex) return;
        mt.color.setHex(u.pcBase).lerp(PC_BROWN, amount);
        u.pcSet = mt.color.getHex();
        u.pcAmt = amount;
      });
    }

function pcSoilColor(mat, wet, dry, wetC) {
      if (mat.userData.pcWet !== undefined && Math.abs(mat.userData.pcWet - wet) < 0.003) return;
      mat.userData.pcWet = wet;
      mat.color.copy(dry).lerp(wetC, wet);
      mat.roughness = 1 - 0.45 * wet;
    }

// --- The garden beds ---------------------------------------------------------------------------------
function pcFindBedSoils() {
      pcBedSoils = PC_BEDS.map(() => null);
      scene.traverse(o => {
        const p = o.geometry && o.geometry.parameters;
        if (!o.isMesh || !p || o.geometry.type !== 'BoxGeometry' || Math.abs(p.width - 1.65) > 0.01 || Math.abs(p.depth - 1.05) > 0.01) return;
        const i = PC_BEDS.findIndex(b => Math.hypot(b.x - o.position.x, b.z - o.position.z) < 0.3);
        if (i >= 0) { o.material = o.material.clone(); pcBedSoils[i] = o; }
      });
    }

function pcDressBeds() {
      pcBedLooks = [];
      if (typeof gardenCropGroups === 'undefined') return;
      const hsl = {};
      gardenCropGroups.forEach((cluster, i) => {
        if (!cluster) return;
        const inner = new THREE.Group();
        cluster.children.slice().forEach(ch => inner.add(ch));
        cluster.add(inner);
        const fruit = [], foliage = new Set(), fruitMats = new Map();
        inner.children.forEach(o => {
          if (!o.isMesh) return;
          o.material.color.getHSL(hsl);
          const green = hsl.h > 0.18 && hsl.h < 0.48 && hsl.s > 0.2;
          const type = o.geometry.type;
          if (green) foliage.add(o.material);
          else if (type === 'SphereGeometry' || type === 'ConeGeometry') {
            fruit.push({ mesh: o, scale: o.scale.clone() });
            if (!fruitMats.has(o.material)) fruitMats.set(o.material, o.material.color.getHex());
          }
        });
        // White blossoms come before the fruit (carrots are a root: no blossoms)
        const blossoms = [];
        if (i !== 2) {
          const petal = new THREE.MeshStandardMaterial({ color: i === 0 ? 0xffc6d6 : 0xfffbea, roughness: 0.6, emissive: 0x222222 });
          fruit.forEach((f, k) => {
            if (k % 2) return;
            const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 7, 5), petal);
            b.scale.y = 0.5;
            b.position.copy(f.mesh.position).add(new THREE.Vector3(0.02, 0.06, 0.03));
            inner.add(b);
            blossoms.push(b);
          });
        }
        pcBedLooks[i] = { inner, fruit, blossoms, foliage: [...foliage], fruitMats, cur: { w: 0, wet: -1, g: -1 } };
      });
    }

function pcApplyBedLook(i, k) {
      const look = pcBedLooks[i], p = (state.gardenPlots || [])[i];
      if (!look || !p) return;
      const c = pcBedCare(p);
      const cur = look.cur;
      const wantW = pcWilt(c), wantWet = pcClamp((c.m - 0.12) / 0.6, 0, 1), G = Number(p.growth) || 0;
      if (cur.wet < 0) { cur.w = wantW; cur.wet = wantWet; cur.g = G; }
      cur.w += (wantW - cur.w) * k;
      cur.wet += (wantWet - cur.wet) * k;
      cur.g += (G - cur.g) * k;
      look.inner.scale.set(1, 1 - 0.32 * cur.w, 1);
      look.inner.rotation.z = 0.14 * cur.w;
      look.inner.rotation.x = 0.1 * cur.w;
      pcTint(look.foliage, cur.w * 0.85);
      // Fruit sets green once the blossoms fade, swells, and colours as it ripens
      const root = i === 2;
      const from = root ? 8 : 30;
      const size = pcClamp((cur.g - from) / 40, 0, 1);
      look.fruit.forEach(f => {
        f.mesh.visible = size > 0.02;
        if (f.mesh.visible) f.mesh.scale.copy(f.scale).multiplyScalar(0.25 + 0.75 * size);
      });
      const ripe = pcClamp((cur.g - 55) / 30, 0, 1);
      look.fruitMats.forEach((hex, mat) => {
        if (mat.userData.pcRipe !== undefined && Math.abs(mat.userData.pcRipe - ripe) < 0.004) return;
        mat.userData.pcRipe = ripe;
        mat.color.setHex(root ? hex : 0x6f9a3a).lerp(new THREE.Color(hex), root ? 1 : ripe).lerp(PC_BROWN, cur.w * 0.4);
      });
      const bloom = cur.g >= 12 && cur.g < 45 ? Math.min(1, (cur.g - 12) / 8, (45 - cur.g) / 8) : 0;
      look.blossoms.forEach(b => { b.visible = bloom > 0.05; if (b.visible) b.scale.set(bloom, bloom * 0.5, bloom); });
      if (pcBedSoils[i]) pcSoilColor(pcBedSoils[i].material, cur.wet, PC_BED_DRY, PC_BED_WET);
    }

// --- The garden tap ------------------------------------------------------------------------------------
function pcTapSpout() {
      return new THREE.Vector3(PC_TAP.x, getAnalyticalGroundHeight(PC_TAP.x, PC_TAP.z) + 1.47, PC_TAP.z + 0.3);
    }

function buildGardenTap3D() {
      const gy = getAnalyticalGroundHeight(PC_TAP.x, PC_TAP.z);
      const g = new THREE.Group();
      g.position.set(PC_TAP.x, gy, PC_TAP.z);
      const steel = { metalness: 0.7, roughness: 0.4 };
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0x9a9690, roughness: 0.95 }));
      pad.position.y = 0.04;
      pad.receiveShadow = true;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.55, 12), new THREE.MeshStandardMaterial({ color: 0x2f6f3a, ...steel }));
      post.position.y = 0.81;
      post.castShadow = true;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.16), new THREE.MeshStandardMaterial({ color: 0x2f6f3a, ...steel }));
      head.position.set(0, 1.58, 0.03);
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: 0.8, roughness: 0.3 }));
      spout.rotation.x = Math.PI / 2 + 0.5;
      spout.position.set(0, 1.53, 0.18);
      const lever = new THREE.Group();
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.36, 8), new THREE.MeshStandardMaterial({ color: 0x1f2937, ...steel }));
      arm.rotation.z = Math.PI / 2;
      arm.position.x = 0.12;
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.5 }));
      knob.position.x = 0.3;
      lever.add(arm, knob);
      lever.position.set(0, 1.66, 0);
      // A worn wet patch on the gravel under the spout
      const drain = new THREE.Mesh(new THREE.CircleGeometry(0.18, 14), new THREE.MeshStandardMaterial({ color: 0x5b5650, roughness: 0.5 }));
      drain.rotation.x = -Math.PI / 2;
      drain.position.set(0, 0.085, 0.24);
      g.add(pad, post, head, spout, lever, drain);
      g.userData.lever = lever;
      scene.add(g);
      if (typeof worldObstacles !== 'undefined') worldObstacles.push({ x: PC_TAP.x, z: PC_TAP.z, r: 0.35 });
      if (typeof makeSignMesh === 'function') {
        const sign = makeSignMesh('GARDEN TAP', { bg: '#e0f2fe', fg: '#075985', width: 0.5, height: 0.13 });
        sign.position.set(0, 1.1, 0.07);
        g.add(sign);
      }
      return g;
    }

// --- Water and granules in the air ----------------------------------------------------------------
// A soft round dot, so the drops aren't square
function pcDropTexture() {
      if (pcDropTexture.tex) return pcDropTexture.tex;
      const c = document.createElement('canvas');
      c.width = c.height = 32;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.45, 'rgba(255,255,255,0.85)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 32, 32);
      pcDropTexture.tex = new THREE.CanvasTexture(c);
      return pcDropTexture.tex;
    }

function pcMakeSpray(color, size, count, streaks) {
      const pos = new Float32Array(count * 3).fill(0);
      for (let i = 0; i < count; i++) pos[i * 3 + 1] = -999;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, map: pcDropTexture(), alphaTest: 0.05, transparent: true, opacity: 0.95, depthWrite: false }));
      pts.frustumCulled = false;
      scene.add(pts);
      let lines = null;
      if (streaks) {
        const lp = new Float32Array(count * 6).fill(-999);
        const lg = new THREE.BufferGeometry();
        lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
        lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
        lines.frustumCulled = false;
        scene.add(lines);
      }
      return { pts, lines, count, pos, vel: new Float32Array(count * 3), floor: new Float32Array(count), life: new Float32Array(count),
        splash: new Uint8Array(count), next: 0, source: null, acc: 0, alive: 0 };
    }

function pcEmit(sp, p, v, floorY, splash) {
      const i = sp.next;
      sp.next = (sp.next + 1) % sp.count;
      sp.pos[i * 3] = p.x; sp.pos[i * 3 + 1] = p.y; sp.pos[i * 3 + 2] = p.z;
      sp.vel[i * 3] = v.x; sp.vel[i * 3 + 1] = v.y; sp.vel[i * 3 + 2] = v.z;
      sp.floor[i] = floorY;
      sp.life[i] = 3;
      sp.splash[i] = splash ? 1 : 0;
    }

// Every frame: new drops from the source, gravity, and a splash where each lands
function pcUpdateSpray(sp, dt) {
      if (!sp) return;
      const _p = pcUpdateSpray.p || (pcUpdateSpray.p = new THREE.Vector3());
      const _v = pcUpdateSpray.v || (pcUpdateSpray.v = new THREE.Vector3());
      if (sp.source) {
        const src = sp.source();
        if (src) {
          sp.acc += dt * src.rate;
          while (sp.acc >= 1) {
            sp.acc -= 1;
            _p.copy(src.pos).addScaledVector(src.dir, Math.random() * 0.02);
            _v.copy(src.dir).multiplyScalar(src.speed * (0.85 + Math.random() * 0.3));
            _v.x += (Math.random() - 0.5) * src.spread; _v.y += (Math.random() - 0.5) * src.spread; _v.z += (Math.random() - 0.5) * src.spread;
            pcEmit(sp, _p, _v, src.floorY, src.splash);
          }
        }
      }
      const P = sp.pos, V = sp.vel;
      let alive = 0;
      for (let i = 0; i < sp.count; i++) {
        if (sp.life[i] <= 0) continue;
        alive++;
        sp.life[i] -= dt;
        V[i * 3 + 1] -= 6.5 * dt;
        P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
        if (P[i * 3 + 1] <= sp.floor[i]) {
          P[i * 3 + 1] = sp.floor[i];
          if (sp.splash[i] === 1) {
            // A splash: a few bright beads jump back up and fall again
            sp.splash[i] = 2;
            V[i * 3] = (Math.random() - 0.5) * 0.7; V[i * 3 + 1] = 0.35 + Math.random() * 0.55; V[i * 3 + 2] = (Math.random() - 0.5) * 0.7;
            sp.life[i] = 0.32;
          } else sp.life[i] = 0;
        }
        if (sp.life[i] <= 0) P[i * 3 + 1] = -999;
      }
      sp.alive = alive;
      sp.pts.geometry.attributes.position.needsUpdate = true;
      if (sp.lines) {
        const L = sp.lines.geometry.attributes.position.array;
        for (let i = 0; i < sp.count; i++) {
          const o = i * 6;
          if (sp.life[i] <= 0 || sp.splash[i] === 2) { L[o + 1] = L[o + 4] = -999; continue; }
          L[o] = P[i * 3]; L[o + 1] = P[i * 3 + 1]; L[o + 2] = P[i * 3 + 2];
          L[o + 3] = P[i * 3] - V[i * 3] * 0.045; L[o + 4] = P[i * 3 + 1] - V[i * 3 + 1] * 0.045; L[o + 5] = P[i * 3 + 2] - V[i * 3 + 2] * 0.045;
        }
        sp.lines.geometry.attributes.position.needsUpdate = true;
      }
      sp.pts.visible = alive > 0;
      if (sp.lines) sp.lines.visible = alive > 0;
    }

// --- The watering can in his hands ------------------------------------------------------------------
function pcCanModel() {
      const name = hasItem(PC_CAN_RE);
      const can = typeof buildItemModel3D === 'function' ? buildItemModel3D(name || 'A watering can', { label: false }) : new THREE.Group();
      let rose = null;
      can.traverse(o => {
        const p = o.geometry && o.geometry.parameters;
        if (o.isMesh && p && o.geometry.type === 'CylinderGeometry' && Math.abs(p.radiusTop - 0.05) < 1e-3 && Math.abs(p.radiusBottom - 0.03) < 1e-3) rose = o;
      });
      if (!rose) {
        // Some other model: the far top corner of it is where the water comes out
        const box = new THREE.Box3().setFromObject(can);
        rose = new THREE.Object3D();
        rose.position.set(box.max.x, box.max.y, (box.min.z + box.max.z) / 2);
        can.add(rose);
      }
      const body = new THREE.Object3D();
      body.position.set(0, 0.2, 0);
      can.add(body);
      can.rotation.y = -Math.PI / 2; // spout forward
      const tilt = new THREE.Group();
      tilt.add(can);
      const outer = new THREE.Group();
      outer.add(tilt);
      return { obj: outer, tilt, rose, body, want: 0 };
    }

function pcHoldCan() {
      pcHeld = pcCanModel();
      if (typeof setCarriedObject === 'function') setCarriedObject(pcHeld.obj);
      state.microPose = 'normal';
      return pcHeld;
    }

function pcDropHeld() {
      if (pcWater) pcWater.source = null;
      if (pcGrain) pcGrain.source = null;
      if (pcHeld && pcHeld.obj.parent === scene) scene.remove(pcHeld.obj); // still standing under the tap
      pcHeld = null;
      if (typeof setCarriedObject === 'function') setCarriedObject(null);
    }

// Where the water leaves the can, and which way it is heading
function pcRoseSource(floorY, rate = 230) {
      const pos = new THREE.Vector3(), base = new THREE.Vector3(), dir = new THREE.Vector3();
      return () => {
        if (!pcHeld || !pcHeld.obj.parent) return null;
        pcHeld.rose.getWorldPosition(pos);
        pcHeld.body.getWorldPosition(base);
        dir.copy(pos).sub(base).normalize();
        if (pcHeld.tilt.rotation.x < 0.5) return null; // not tipped far enough to pour yet
        return { pos, dir, speed: 1.3, spread: 0.45, rate, floorY: floorY(), splash: true };
      };
    }

// --- Walking to a plant -------------------------------------------------------------------------------
function pcStandFor(t) {
      if (t.kind === 'bed') {
        const north = t.idx < 2;
        return { x: t.x, z: north ? t.z - 1.3 : t.z + 1.3, face: north ? 0 : Math.PI };
      }
      const dx = t.x - state.botPos.x, dz = t.z - state.botPos.z;
      const d = Math.hypot(dx, dz) || 1;
      const ux = dx / d, uz = dz / d;
      return { x: t.x - ux * 1.15, z: t.z - uz * 1.15, face: Math.atan2(ux, uz) };
    }

async function pcWalkTo(spot, placeName) {
      state.currentLocKey = 'custom';
      state.customPlaceName = placeName;
      state.targetPos = { x: spot.x, z: spot.z };
      renderAllUI();
      await waitForArrival(45000);
      state.botRotY = spot.face;
      // Turn to face it before starting (his body eases round)
      for (let i = 0; i < 16; i++) {
        const d = typeof keloGroup !== 'undefined' && keloGroup ? Math.atan2(Math.sin(keloGroup.rotation.y - spot.face), Math.cos(keloGroup.rotation.y - spot.face)) : 0;
        if (Math.abs(d) < 0.12) break;
        await new Promise(r => setTimeout(r, 250));
      }
      await new Promise(r => setTimeout(r, 300));
    }

const pcWait = (ms) => new Promise(r => setTimeout(r, ms));

// Tip the can, let it run for `ms`, and soak the soil a little at a time
async function pcPour(t, amount, ms = 3200) {
      const pc = pcState();
      pcWater.source = pcRoseSource(t.floorY);
      pcHeld.want = 0.95;
      const parts = 8;
      await pcWait(500);
      for (let i = 0; i < parts; i++) {
        await pcWait(ms / parts);
        pcSyncAll();
        t.rec.m = Math.min(1, t.rec.m + amount / parts);
        pc.can = Math.max(0, pc.can - 0.22 / parts);
        refreshPlantLooks();
      }
      pcHeld.want = 0;
      await pcWait(400);
      pcWater.source = null;
    }

// He sets the can down on the tap's pad to fill it, then picks it up again
function pcSetCanUnderTap(down) {
      if (!pcHeld) return;
      const can = pcHeld.obj;
      if (down) {
        if (typeof carriedObject !== 'undefined' && carriedObject === can) { if (can.parent) can.parent.remove(can); carriedObject = null; }
        can.position.set(PC_TAP.x, getAnalyticalGroundHeight(PC_TAP.x, PC_TAP.z) + 0.08, PC_TAP.z + 0.3);
        can.rotation.set(0, Math.PI / 2, 0);
        pcHeld.tilt.rotation.x = 0;
        scene.add(can);
        state.microPose = 'normal';
      } else {
        if (can.parent) can.parent.remove(can);
        can.position.set(0, 0, 0);
        can.rotation.set(0, 0, 0);
        if (typeof setCarriedObject === 'function') setCarriedObject(can);
      }
    }

// Water running from the tap's spout into the can (or onto the drain if nothing is under it)
function pcTapSource() {
      const spout = pcTapSpout(), down = new THREE.Vector3(0, -0.4, 0.35).normalize();
      const top = new THREE.Vector3();
      return () => {
        if (pcHeld) pcHeld.body.getWorldPosition(top);
        return { pos: spout, dir: down, speed: 0.6, spread: 0.06, rate: 220, floorY: pcHeld ? Math.min(top.y + 0.1, spout.y - 0.25) : getAnalyticalGroundHeight(PC_TAP.x, PC_TAP.z) + 0.09, splash: !pcHeld };
      };
    }

// --- Filling the can: the garden tap, or the lake if that's nearer ----------------------------------------
async function refillCan(originLabel = 'Filling the Watering Can') {
      const pc = pcState();
      if (!pcHeld) pcHoldCan();
      const lakeX = pcClamp(state.botPos.x, WORLD_MIN_X + 3, WORLD_MAX_X - 3);
      const lake = { x: lakeX, z: 8.4 };
      const useTap = Math.hypot(state.botPos.x - PC_TAP.x, state.botPos.z - PC_TAP.z) <= Math.hypot(state.botPos.x - lake.x, state.botPos.z - lake.z) + 4;
      state.moodEmoji = '🚰';
      state.moodTitle = useTap ? 'Filling the watering can at the tap' : 'Filling the watering can at the lake';
      state.speechBubble = pc.can > 0.05 ? 'Nearly empty. Time for a refill.' : 'First, some water in the can.';
      if (useTap) {
        await pcWalkTo({ x: PC_TAP.x, z: PC_TAP.z + 1.0, face: Math.PI }, 'the garden tap');
        pcSetCanUnderTap(true);
        if (pcTapGroup) pcTapGroup.userData.lever.rotation.y = -1.2;
        state.speechBubble = 'Lever up... and the water runs.';
        renderAllUI();
        pcWater.source = pcTapSource();
        await pcWait(3600);
        pcWater.source = null;
        if (pcTapGroup) pcTapGroup.userData.lever.rotation.y = 0;
        await pcWait(400);
        pcSetCanUnderTap(false);
      } else {
        await pcWalkTo({ x: lake.x, z: lake.z, face: 0 }, 'the lakeshore');
        state.speechBubble = 'Dip it in and let it fill.';
        renderAllUI();
        pcHeld.want = 1.2;
        await pcWait(1800);
        pcHeld.want = 0;
        // Lake water runs off the can as he lifts it out
        const base = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
        pcWater.source = () => {
          if (!pcHeld) return null;
          pcHeld.body.getWorldPosition(base);
          return { pos: base.clone().add(new THREE.Vector3(0, -0.12, 0)), dir: down, speed: 0.2, spread: 0.25, rate: 70, floorY: (typeof WATER_LEVEL === 'number' ? WATER_LEVEL : -0.18), splash: true };
        };
        await pcWait(1500);
        pcWater.source = null;
      }
      pc.can = 1;
      pc.refills++;
      state.speechBubble = 'Full to the top. Heavy!';
      renderAllUI();
      return true;
    }

// Watering in a new planting (js/landscape.js plantSeeds): fill the can if it's empty, then pour
async function waterInPlanting(x, z) {
      const pc = pcState();
      const spot = { x: state.botPos.x, z: state.botPos.z };
      pcHoldCan();
      if (pc.can < 0.2) {
        await refillCan();
        await pcWalkTo({ ...spot, face: 0 }, 'a patch of open ground');
        state.speechBubble = 'And a good long drink to settle it in.';
      }
      state.botRotY = Math.atan2(x - state.botPos.x, z - state.botPos.z);
      state.microPose = 'normal';
      pcWater.source = pcRoseSource(() => getIslandGroundHeight(x, z) + 0.03);
      pcHeld.want = 0.95;
      await pcWait(2800);
      pcHeld.want = 0;
      pcWater.source = null;
      await pcWait(300);
      pc.can = Math.max(0, pc.can - 0.2);
      pc.waterings++;
      pcHeld.tilt.rotation.x = 0;
      pcHeld = null;
    }

// --- Looking after them -----------------------------------------------------------------------------
function pcBusy() {
      return state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping || state.isBrowsing;
    }

function pcWaterThreshold() {
      return 0.3 + Math.min(0.08, (pcState().waterings || 0) * 0.01);
    }

// He looks at the soil before he pours: only as much as it needs, never into mud
function pcPourAmount(c) {
      const known = typeof jobKnown === 'function' && jobKnown('plantcare');
      return known ? pcClamp(0.78 - c.m, 0.12, 0.55) : 0.5;
    }

async function waterPlants(targets = null, why = '', originLabel = 'Watering the Garden') {
      if (pcBusy()) return false;
      if (!hasItem(PC_CAN_RE)) {
        addItemRequest('A watering can', 'tool', 'My plants need water and I have nothing to carry it in.', 'Looking after my plants');
        state.speechBubble = "My plants need water, but I don't have a watering can. I asked for one.";
        renderAllUI();
        return 'needs-tools';
      }
      pcSyncAll();
      const list = (targets || pcTargets().filter(t => t.rec.m < pcWaterThreshold())).slice(0, 6);
      if (!list.length) return false;
      state.isPracticing = true;
      const pc = pcState();
      const watered = [];
      try {
        state.moodEmoji = '💧';
        state.moodTitle = 'Watering his plants';
        pcHoldCan();
        for (const t of list) {
          if (pc.can < 0.2) await refillCan();
          state.moodEmoji = '💧';
          state.moodTitle = `Watering ${t.label}`.slice(0, 80);
          await pcWalkTo(pcStandFor(t), t.kind === 'bed' ? 'the garden beds' : 'his plantings');
          const before = t.rec.m;
          state.speechBubble = before < 0.15 ? 'Bone dry. Here you go, a long slow drink.' : before > 0.6 ? 'Still damp, so just a splash.' : 'Slowly, at the base, until the soil goes dark.';
          renderAllUI();
          await pcPour(t, pcPourAmount(t.rec));
          pc.waterings++;
          watered.push(t.label);
        }
        pc.lastWateredAt = Date.now();
        sayAndLog(`Watered ${watered.length === 1 ? watered[0] : watered.length + ' plants'}`, '💧',
          'There. Dark, damp soil. They should perk up.',
          `I watered ${watered.join(', ')} with my watering can, slowly at the base until the soil went dark. ${why ? why + ' ' : ''}${pc.waterings > 3 ? "I can tell by the colour of the soil now when it's dry." : 'I want to see whether it helps.'}`, originLabel);
        if (typeof noteItemUsed === 'function') noteItemUsed(hasItem(PC_CAN_RE));
        return true;
      } finally {
        pcDropHeld();
        state.microPose = 'normal';
        state.isPracticing = false;
      }
    }

function pcFeedOf(name) {
      return PC_FEEDS.find(f => f.re.test(name));
    }

function ownedFertilizer() {
      if (typeof ownedItemFor === 'function') {
        const n = ownedItemFor('fertilize');
        if (n) return n;
      }
      return hasItem(PC_FERT_RE);
    }

// What he asks for to feed this plant: compost for the vegetable beds, bone meal for flowers
function askForFertilizer(t) {
      const ask = t && t.kind === 'bed' ? 'A bag of garden compost' : t && t.kind === 'flowers' ? 'A box of bone meal' : 'A bag of all-purpose fertilizer';
      addItemRequest(ask, 'material', `The soil under ${t ? t.label : 'my plants'} is worn out, and they've stopped growing. Plants need feeding as well as water.`, 'Looking after my plants');
      state.speechBubble = `${t ? t.label.replace(/^./, c => c.toUpperCase()) : 'My plants'} need feeding. I asked for ${ask.replace(/^A /, 'a ').toLowerCase()}.`;
      renderAllUI();
      return 'needs-materials';
    }

async function feedPlants(targets = null, why = '', originLabel = 'Feeding the Garden') {
      if (pcBusy()) return false;
      pcSyncAll();
      const list = (targets || pcTargets().filter(t => t.rec.n < 0.25)).filter(t => t.rec.n < 0.85).slice(0, 4);
      if (!list.length) return false;
      let fert = ownedFertilizer();
      if (!fert) return askForFertilizer(list[0]);
      state.isPracticing = true;
      const pc = pcState();
      const fed = [];
      try {
        state.moodEmoji = '🌾';
        state.moodTitle = `Feeding his plants with ${pcFeedOf(fert).label}`;
        for (const t of list) {
          fert = ownedFertilizer();
          if (!fert) break;
          const feed = pcFeedOf(fert);
          if (typeof setCarriedObject === 'function') setCarriedObject(buildItemModel3D(fert, { label: false }));
          await pcWalkTo(pcStandFor(t), t.kind === 'bed' ? 'the garden beds' : 'his plantings');
          state.speechBubble = `A handful of ${feed.label}, scattered round the base and scratched in.`;
          renderAllUI();
          // Granules fall from his hands onto the soil
          const from = new THREE.Vector3();
          pcGrain.source = () => {
            if (typeof keloGroup === 'undefined') return null;
            from.set(0, 1.0, 0.75).applyMatrix4(keloGroup.matrixWorld);
            const dir = new THREE.Vector3(Math.sin(state.botRotY), -0.6, Math.cos(state.botRotY)).normalize();
            return { pos: from, dir, speed: 0.9, spread: 0.7, rate: 70, floorY: t.floorY(), splash: false };
          };
          await pcWait(2400);
          pcGrain.source = null;
          pcSyncAll();
          t.rec.n = Math.min(1, t.rec.n + feed.n);
          if (feed.m) t.rec.m = Math.min(1, t.rec.m + feed.m);
          if (typeof useUpItem === 'function') useUpItem(fert, 1, { why: 'feeding my plants' }); else if (typeof forgetItem === 'function') forgetItem(fert);
          pc.feedings++;
          fed.push(t.label);
          refreshPlantLooks();
          await pcWait(500);
        }
        if (!fed.length) return false;
        pc.lastFedAt = Date.now();
        sayAndLog(`Fed ${fed.length === 1 ? fed[0] : fed.length + ' plants'}`, '🌾', 'Food for the soil. Now they can really grow.',
          `I fed ${fed.join(', ')} with ${plainItem(fert || 'the fertilizer').toLowerCase()}. Growing things use up what's in the soil, so it needs putting back. ${why}`.trim(), originLabel);
        return true;
      } finally {
        if (pcGrain) pcGrain.source = null;
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.microPose = 'normal';
        state.isPracticing = false;
      }
    }

// The first time something wilts he goes and looks, then reads up on it
async function noticeWiltingPlant(t) {
      if (pcBusy()) return false;
      const pc = pcState();
      state.isPracticing = true;
      try {
        state.moodEmoji = '🥀';
        state.moodTitle = `Something is wrong with ${t.label}`.slice(0, 80);
        await pcWalkTo(pcStandFor(t), t.kind === 'bed' ? 'the garden beds' : 'his plantings');
        state.speechBubble = "Its leaves are hanging down and going brown at the edges. It looks... tired? I don't know what it needs.";
        renderAllUI();
        await pcWait(3500);
        pc.firstWiltAt = Date.now();
        state.diaryEntries.unshift({
          time: 'A Wilting Plant', location: currentPlaceLabel(), mood: `🥀 ${t.label} is wilting`.slice(0, 80),
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, ${t.label} drooped today. The leaves hang down and the edges have gone brown and crisp, and the soil around it is pale and dusty. Living things need something from me that I haven't been giving. I'm going to find out what.`
        });
        savePersistentBrainState();
      } finally {
        state.isPracticing = false;
      }
      const read = await researchJob('plantcare', 'A Wilting Plant');
      // Something else had him busy right then: he goes as soon as he's free
      if (!read && !jobKnown('plantcare')) doWhenFree(() => researchJob('plantcare', 'A Wilting Plant'));
      return read;
    }

// The life tick (js/agent.js): something that needs doing in the garden right now, or null
function plantCareJobNow() {
      pcSyncAll();
      const ts = pcTargets();
      const known = typeof jobKnown === 'function' && jobKnown('plantcare');
      if (!known) {
        const wilting = ts.find(t => t.rec.h < PC_WILT_AT);
        return wilting ? () => noticeWiltingPlant(wilting) : null;
      }
      const frozen = worldNow().season === 'Winter';
      const thirsty = frozen ? [] : ts.filter(t => t.rec.m < pcWaterThreshold() && !(t.kind === 'tree' && t.rec.g >= 1)).sort((a, b) => a.rec.m - b.rec.m);
      if (thirsty.length) return () => waterPlants(thirsty, 'The soil was dry a finger deep.', 'Watering the Garden');
      const hungry = ts.filter(t => t.rec.n < 0.22 && (t.kind === 'bed' || t.rec.g < 1)).sort((a, b) => a.rec.n - b.rec.n);
      if (hungry.length && !frozen) return () => feedPlants(hungry, '', 'Feeding the Garden');
      return null;
    }

function tendPlantsOnMyOwn() {
      const job = plantCareJobNow();
      return job ? job() : false;
    }

// The visitor's "water the garden" button: real water for the beds, not instant fruit
function visitorWatersGarden() {
      pcSyncAll();
      pcTargets().filter(t => t.kind === 'bed').forEach(t => { t.rec.m = Math.min(1, t.rec.m + 0.45); });
      refreshPlantLooks();
      savePersistentBrainState();
      renderAllUI();
      showToast('💧 You watered the 4 garden beds. The soil is dark and damp now.');
    }

// --- Words -------------------------------------------------------------------------------------------
function gardenStatusForAI() {
      pcSyncAll();
      const ts = pcTargets();
      const soil = (c) => (c.m < 0.15 ? 'parched' : c.m < 0.3 ? 'dry' : c.m > 0.9 ? 'waterlogged' : 'moist');
      const beds = ts.filter(t => t.kind === 'bed').map(t => `${t.p.name} ${Math.round(t.p.growth)}% ripe, ${soil(t.rec)}${t.rec.h < PC_WILT_AT ? ', wilting' : ''}`);
      const plants = ts.filter(t => t.kind !== 'bed').slice(-4).map(t => `${t.kind === 'flowers' ? 'flowers' : 'tree'} ${plantStageOf(t.e)}, ${soil(t.rec)}${t.rec.h < PC_WILT_AT ? ', wilting' : ''}${t.rec.n < 0.22 ? ', hungry' : ''}`);
      const can = hasItem(PC_CAN_RE) ? `watering can ${Math.round(pcState().can * 100)}% full` : 'no watering can';
      const fert = ownedFertilizer();
      const known = typeof jobKnown === 'function' && jobKnown('plantcare');
      return `beds: ${beds.join('; ')}${plants.length ? `; plantings: ${plants.join('; ')}` : ''}; ${can}; fertilizer: ${fert ? (typeof supplyLabel === 'function' ? supplyLabel(fert) : fert) : 'none'}${known ? '' : '; you have not learned yet what plants need'}`.slice(0, 600);
    }

function refreshPlantLooks() {
      if (typeof editMeshes === 'undefined') return;
      (state.worldEdits || []).forEach(e => { if (e.type === 'plant' && editMeshes[e.id]) plantcareLook(e, editMeshes[e.id]); });
    }

// --- How plant care is learned (js/groundwork.js researchJob) and what the things are ---------------------
if (typeof GROUND_JOBS !== 'undefined') {
  GROUND_JOBS.plantcare = {
    title: 'looking after plants', wiki: ['Wilting', 'Fertilizer', 'Irrigation'],
    learned: "Plants wilt when their soil dries out: water slowly at the base when the top of the soil is dry, deeply but not so much that the roots sit in mud. Growing plants use up the soil's nutrients, so feed them now and then with compost, bone meal or an all-purpose fertilizer. Hot summer days dry the soil fastest; rain does the watering for you.",
    tools: [{ re: PC_CAN_RE, ask: 'A watering can', why: 'to water my plants when the soil dries out' }],
    materials: [{ re: PC_FERT_RE, ask: 'A bag of all-purpose fertilizer', why: 'to feed my plants when the soil runs low' }]
  };
}

if (typeof ITEM_MODEL_RULES !== 'undefined') {
  ITEM_MODEL_RULES.unshift([/fertili[sz]er|compost|bone ?meal|blood ?meal|plant food|manure|worm castings/, lower => {
    const g = group();
    const kind = /compost|manure|castings/.test(lower) ? 0x5b4630 : /bone/.test(lower) ? 0xe9e1c8 : 0x2f7d4a;
    const sack = mesh(new THREE.BoxGeometry(0.3, 0.42, 0.14), kind, { roughness: 0.9 });
    sack.position.y = 0.21;
    const fold = mesh(new THREE.BoxGeometry(0.3, 0.05, 0.1), kind, { roughness: 0.9 });
    fold.position.set(0, 0.44, 0);
    fold.rotation.x = 0.25;
    const label = mesh(new THREE.BoxGeometry(0.2, 0.16, 0.005), 0xf8f3e3, { roughness: 0.7 });
    label.position.set(0, 0.22, 0.073);
    const leaf = mesh(new THREE.SphereGeometry(0.04, 8, 5), 0x4caf50);
    leaf.scale.set(1.4, 0.4, 0.2);
    leaf.position.set(0, 0.24, 0.078);
    g.add(sack, fold, label, leaf);
    return g;
  }]);
}

// --- Every frame, and every few seconds -------------------------------------------------------------
function pcFrame(dt, realDt = dt) {
      pcUpdateSpray(pcWater, dt);
      pcUpdateSpray(pcGrain, dt);
      if (pcHeld) pcHeld.tilt.rotation.x += (pcHeld.want - pcHeld.tilt.rotation.x) * Math.min(1, realDt * 3);
      const k = Math.min(1, dt * 1.5);
      if (typeof editMeshes !== 'undefined') {
        (state.worldEdits || []).forEach(e => {
          const m = e.type === 'plant' && editMeshes[e.id];
          if (m && m.userData.pc && m.visible) pcApplyPlantingLook(m, k);
        });
      }
      for (let i = 0; i < pcBedLooks.length; i++) pcApplyBedLook(i, k);
    }

// Something wilted while he was away (the page was closed): he notices when he's back
function pcCatchUpNote() {
      const before = (t) => pcBefore[t.kind === 'bed' ? 'bed:' + t.p.name : t.key];
      const newly = pcTargets().filter(t => t.rec.h < PC_WILT_AT && before(t) !== undefined && before(t) >= PC_WILT_AT);
      if (!newly.length || !(typeof jobKnown === 'function' && jobKnown('plantcare'))) return;
      state.speechBubble = `While I was away ${newly.map(t => t.label).join(' and ')} dried out and wilted. I'll get the watering can.`;
    }

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    pcState();
    pcSyncAll(); // catch up on everything that grew (or dried out) while the page was closed
    pcCatchUpNote();
    pcWater = pcMakeSpray(0xd6efff, 0.075, 600, true);
    pcGrain = pcMakeSpray(0x4a3220, 0.04, 160, false);
    pcTapGroup = buildGardenTap3D();
    pcFindBedSoils();
    pcDressBeds();
    refreshPlantLooks();
    let last = performance.now();
    (function plantCareFrame(now) {
      const real = Math.min(0.5, (now - last) / 1000);
      last = now;
      pcFrame(Math.min(0.1, real), real);
      requestAnimationFrame(plantCareFrame);
    })(last);
    setInterval(() => { pcSyncAll(); refreshPlantLooks(); }, 3000);
  }, 500);
});
