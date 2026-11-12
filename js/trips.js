// Kelo-bot-1 — js/trips.js
// Loaded after skills.js. Vehicles follow real-world logic, and Kelo-1 thinks a trip through
// like a person would:
//   - every vehicle has terrain rules: a snowmobile runs only on snow, boats only on water, a bike on
//     roads and gentle ground, trucks off deep snow (unless chained) and steep slopes, an excavator
//     only short hops, a helicopter anywhere with fuel and a flat spot to land, a balloon by the wind
//   - a small trip planner works out, leg by leg, which vehicle can get where. A vehicle that can't
//     get there by itself is hauled: a pickup or the dump truck tows a trailer (snowmobile trailer,
//     boat trailer, lowboy), he loads it up the ramp, straps it down, drives to where its terrain
//     starts, unloads, uses it, loads it again and drives home
//   - it checks fuel for the whole trip, know-how (learnToUse), and gear (trailer, hitch, straps,
//     tire chains in winter). Anything missing he explains once, reads up at NetNode ("how to
//     transport a snowmobile") and asks for exactly what's needed, with his reasoning
//   - he asks for one of each kind of vehicle (two once he has a friend or a pet to share with)
// Trailers are vehicles with no engine: they park in a row south of the yard and hitch behind a truck.

// --- New kinds of vehicle: trailers and a pickup --------------------------------------------------
const TRAILER_KINDS = [
  { key: 'snowmobile trailer', re: /(snowmobile|snow ?machine|\bsled)\b.*\b(trailer|deck)\b|\btrailer\b.*\b(snowmobile|snow ?machine|sled)/i, carries: 'snowmobile',
    ask: 'A snowmobile trailer with a tilt deck', label: 'snowmobile trailer', deckLen: 4.8, width: 2.0, deckY: 0.72 },
  { key: 'boat trailer', re: /\b(boat|canoe|kayak)\b.*\btrailer\b|\btrailer\b.*\b(boat|canoe|kayak)\b/i, carries: 'boat',
    ask: 'A boat trailer', label: 'boat trailer', deckLen: 5.0, width: 1.9, deckY: 0.62 },
  { key: 'lowboy', re: /low-?boy|low-?bed|low ?loader|equipment trailer|float trailer/i, carries: 'excavator',
    ask: 'A lowboy trailer for hauling the excavator', label: 'lowboy trailer', deckLen: 7.6, width: 2.6, deckY: 0.55 }
];
const PICKUP_RE = /\bpick-?up\b/i;
const TRIP_TYPE_TRAILER = { kind: 'trailer', mode: 'tow', speed: 0, scale: 2.6, seatY: 0.4 };
const TRIP_TYPE_PICKUP = { kind: 'pickup', re: PICKUP_RE, mode: 'land', speed: 2.2, scale: 3.0, seatY: 1.0 };
// Fuel, straps, covers and toys named after a vehicle are not vehicles ("Gasoline for the snowmobile")
// (Fuel names themselves are checked against FUEL_TYPES with a container or "for", so a diesel dump truck stays a truck)
const TRIP_NOT_VEHICLE_RE = /\b((?<!jet )fuel(?! injected)|gas can|cans? of gas|jerry ?can|oil|helmet|cover|tarp|straps?|chains?|binders?|spare parts?|keys?|manual|toy|model|miniature|poster|sticker|oars?|life ?jackets?|hitch|ramp|wax|charger|anchor|picture|photo|drawing|painting)\b/i;
// Where trailers park: a row on the gravel south of the yard, couplers pointing west
// (the two east bays moved off the concrete plant's pad onto its new land's walkway, js/plants.js)
const TRAILER_SLOTS = [[27.0, 6.6], [33.5, 11.4], [40.0, 11.4]];
const TRAILER_ROT_Y = Math.PI;

function trailerKindOf(name) {
      const n = String(name || '');
      if (!/trailer|low-?boy|low-?bed|low ?loader|deck/i.test(n)) return null;
      return TRAILER_KINDS.find(t => t.re.test(n)) || null;
    }

// vehicleTypeFor (js/vehicles.js) asks this first: a type, null for "not a vehicle", undefined to carry on
function tripVehicleType(name) {
      const n = String(name || '');
      const trailer = trailerKindOf(n);
      if (trailer) return { ...TRIP_TYPE_TRAILER, re: trailer.re, trailer };
      if (/\btrailer\b/i.test(n)) return null; // some other trailer: nothing he can tow it for
      // "A pickup truck with a tow hitch" is a pickup: what it comes with doesn't change what it is
      const core = n.replace(/\s+(with|plus|and)\s+.*$/i, '');
      if (TRIP_NOT_VEHICLE_RE.test(core) && !/paddle ?board/i.test(core)) return null;
      // Fuel in something ("a jerry can of diesel", "gasoline for the snowmobile") is fuel; a "diesel dump truck" is a truck
      if (typeof FUEL_TYPES !== 'undefined' && Object.values(FUEL_TYPES).some(f => f.re.test(core))
        && (/\b(cans?|jerry|drums?|tanks?|bottles?|cylinders?|barrels?|totes?|gallons?|lit(re|er)s?|jugs?|refills?|for|of)\b/i.test(core) || !VEHICLE_TYPES.some(t => t.re.test(core)))) return null;
      if (PICKUP_RE.test(core)) return TRIP_TYPE_PICKUP;
      return undefined;
    }

// What kind of vehicle this is, for the one-of-each rule and the planner
function vehicleKindKey(name) {
      const type = typeof vehicleTypeFor === 'function' ? vehicleTypeFor(name) : null;
      if (!type) return null;
      if (type.trailer) return type.trailer.key;
      if (type.kind === 'air') return /balloon/i.test(name) ? 'balloon' : 'helicopter';
      if (type.kind === 'truck') return 'dump truck';
      return type.kind;
    }

const VEHICLE_KIND_WORDS = {
  snowmobile: 'snowmobile', boat: 'boat', bike: 'bike', 'dump truck': 'dump truck', pickup: 'pickup truck', excavator: 'excavator',
  helicopter: 'helicopter', balloon: 'hot-air balloon', 'snowmobile trailer': 'snowmobile trailer', 'boat trailer': 'boat trailer', lowboy: 'lowboy trailer'
};

// --- One of each until he has someone to share with --------------------------------------------
function tripFriendName() {
      const on = k => Boolean(state.unlockedFeatures && state.unlockedFeatures[k]);
      if (on('friend')) return typeof companionName === 'function' ? companionName() : 'my friend';
      if (on('pet')) return typeof petName === 'function' ? petName() : 'my pet';
      return null;
    }

function vehicleCapNow() {
      return tripFriendName() ? 2 : 1;
    }

// Owned, asked for and not yet answered, or waiting in the mailbox
function vehicleKindCount(key) {
      const owned = state.vehicles.filter(v => vehicleKindKey(v.name) === key).length;
      const asked = state.requestsToUser.filter(r => !r.fulfilled && !r.declined && r.requestedGear && vehicleKindKey(r.requestedGear) === key).length;
      const coming = state.mailbox.filter(m => vehicleKindKey(m.name || '') === key).length;
      return owned + asked + coming;
    }

// Called by addItemRequest (js/agent.js) for anything he asks for: { blocked } or { why } with his reasoning
function vehicleRequestCheck(item, why = '') {
      const key = vehicleKindKey(item);
      if (!key) return { blocked: false, why };
      const cap = vehicleCapNow(), have = vehicleKindCount(key), word = VEHICLE_KIND_WORDS[key] || key;
      const friend = tripFriendName();
      if (have >= cap) {
        const said = `vehcap:${key}:${cap}`;
        if (typeof activityCoolingDown !== 'function' || !activityCoolingDown(said)) {
          state.speechBubble = friend
            ? `I already have two ${word}s: one for me and one for ${friend}. That's plenty.`
            : `I already have a ${word}. One is plenty until I have someone to share with.`;
          if (typeof coolDownActivity === 'function') coolDownActivity(said, 30 * 60 * 1000);
          if (typeof renderAllUI === 'function') renderAllUI();
        }
        return { blocked: true, why };
      }
      if (have >= 1 && friend) return { blocked: false, why: `Now that ${friend} rides with me, a second ${word} makes sense. ${why || ''}`.trim() };
      return { blocked: false, why };
    }

function vehicleCapLineForAI() {
      const counts = Object.keys(VEHICLE_KIND_WORDS).map(k => [k, vehicleKindCount(k)]).filter(([, n]) => n > 0).map(([k, n]) => `${VEHICLE_KIND_WORDS[k]} ${n}`);
      const friend = tripFriendName();
      return `you may own or ask for at most ${vehicleCapNow()} of each kind of vehicle or trailer${friend ? ` (one for you and one for ${friend})` : ' until you have a friend or pet to share with'}; owned + asked for now: ${counts.join(', ') || 'none'}`;
    }

// --- Terrain rules -------------------------------------------------------------------------------
// max: the steepest grade (rise per unit) it can climb; road: steeper allowed on a road
const VEHICLE_TERRAIN = {
  snowmobile: { max: 1.25, text: 'snow only: it bogs down on dry ground, mud and roads' },
  boat: { text: 'water only: launched from the dock or a beach, or trailered to the water' },
  bike: { max: 0.3, road: 0.4, text: 'roads, paths and gentle ground; not the steep mountain or snow' },
  'dump truck': { max: 0.45, road: 0.6, text: 'roads and gentle ground; not deep snow (unless chained) or steep slopes; can tow a trailer' },
  pickup: { max: 0.45, road: 0.6, text: 'roads and gentle ground; not deep snow (unless chained) or steep slopes; tows a trailer' },
  excavator: { max: 0.6, reach: 26, text: 'slow and only short hops; long trips on a lowboy trailer' },
  helicopter: { text: 'anywhere, with fuel and a flat open spot to land' },
  balloon: { text: 'wherever the wind takes it, and only in light wind' },
  trailer: { text: 'no engine: towed behind a truck with a hitch' }
};

function terrainRuleText(v) {
      const key = vehicleKindKey(v.name);
      const t = VEHICLE_TERRAIN[key] || VEHICLE_TERRAIN[(typeof vehicleTypeFor === 'function' && vehicleTypeFor(v.name) || {}).kind] || null;
      return t ? t.text : '';
    }

function tripHasChains() {
      return ownedItemNames().some(n => /tire chains|snow chains|tyre chains/i.test(n));
    }

function tripHasStraps(heavy = false) {
      return ownedItemNames().some(n => heavy ? /load binders?|chains? and (load )?binders?|binder chains?/i.test(n) : /ratchet straps?|tie-?down straps?|cargo straps?/i.test(n));
    }

function tripHasHitch(tow) {
      return Boolean(tow && (/hitch/i.test(tow.name) || (vehicleKindKey(tow.name) === 'dump truck' ? ownedItemNames().some(n => /hitch/i.test(n) && !PICKUP_RE.test(n)) : ownedItemNames().some(n => /trailer hitch|tow hitch|hitch receiver/i.test(n)))));
    }

// A coarse grid over the island: ground height, snow, water, roads. Built fresh for each plan.
const TRIP_GRID = { x0: WORLD_MIN_X, z0: WORLD_MIN_Z, step: 2, nx: Math.round((WORLD_MAX_X - WORLD_MIN_X) / 2) + 1, nz: 29 };

function tripOnRoad(x, z) {
      if (typeof inParkingArea === 'function' && inParkingArea(x, z, 1)) return true;
      if (x > TOWN.minX && x < TOWN.maxX && z > TOWN.minZ && z < TOWN.maxZ) return true;
      return (state.worldEdits || []).some(e => {
        if (e.type !== 'road') return false;
        const dx = e.toX - e.x, dz = e.toZ - e.z, len2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - e.x) * dx + (z - e.z) * dz) / len2));
        return Math.hypot(x - (e.x + dx * t), z - (e.z + dz * t)) < 1.8;
      });
    }

function tripGridNow() {
      const G = TRIP_GRID, cells = [];
      const frozen = typeof lakeFrozen === 'function' && lakeFrozen();
      for (let j = 0; j < G.nz; j++) {
        for (let i = 0; i < G.nx; i++) {
          const x = G.x0 + i * G.step, z = G.z0 + j * G.step;
          const h = getAnalyticalGroundHeight(x, z);
          const water = z > 7.5 && h < WATER_LEVEL - 0.05;
          cells.push({ i, j, x, z, h, water, ice: water && frozen, snow: !water && typeof inSnow === 'function' && inSnow({ x, z }), road: !water && tripOnRoad(x, z) });
        }
      }
      return cells;
    }

function tripCellAt(cells, x, z) {
      const G = TRIP_GRID;
      const i = Math.max(0, Math.min(G.nx - 1, Math.round((x - G.x0) / G.step)));
      const j = Math.max(0, Math.min(G.nz - 1, Math.round((z - G.z0) / G.step)));
      return cells[j * G.nx + i];
    }

let tripAssumeChains = false; // planning "if I had tire chains"

// Can this kind of vehicle go from cell a to cell b?
function tripCanStep(key, a, b) {
      const grade = Math.abs(b.h - a.h) / Math.hypot(b.x - a.x, b.z - a.z);
      const rule = VEHICLE_TERRAIN[key] || {};
      if (key === 'boat') return b.water && !b.ice;
      if (b.water) return false;
      if (key === 'snowmobile') return b.snow && grade <= rule.max;
      if (key === 'bike') return !b.snow && grade <= (b.road && a.road ? rule.road : rule.max);
      if (key === 'dump truck' || key === 'pickup') return (!b.snow || tripAssumeChains || tripHasChains()) && grade <= (b.road && a.road ? rule.road : rule.max);
      if (key === 'excavator') return grade <= rule.max;
      return true;
    }

// Cheapest routes from a start cell over everything this kind can drive on (Dijkstra on the grid)
function tripFlood(cells, key, starts) {
      const G = TRIP_GRID, n = cells.length;
      const dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
      // A small binary heap of [distance, cell]
      const heap = [];
      const push = (d, k) => {
        heap.push([d, k]);
        let i = heap.length - 1;
        while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
      };
      const pop = () => {
        const top = heap[0], last = heap.pop();
        if (heap.length) {
          heap[0] = last;
          let i = 0;
          for (;;) {
            const l = i * 2 + 1, r = l + 1;
            let m = i;
            if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
            if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
            if (m === i) break;
            [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
          }
        }
        return top;
      };
      starts.forEach(c => { const k = c.j * G.nx + c.i; dist[k] = 0; push(0, k); });
      while (heap.length) {
        const k = pop()[1];
        if (done[k]) continue;
        done[k] = 1;
        const a = cells[k];
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const i = a.i + di, j = a.j + dj;
          if (i < 0 || j < 0 || i >= G.nx || j >= G.nz) continue;
          const m = j * G.nx + i, b = cells[m];
          if (done[m] || !tripCanStep(key, a, b)) continue;
          const d = dist[k] + Math.hypot(b.x - a.x, b.z - a.z) * (b.road ? 0.85 : 1);
          if (d < dist[m]) { dist[m] = d; prev[m] = k; push(d, m); }
        }
      }
      return { dist, prev };
    }

function tripPathTo(cells, flood, cell) {
      const G = TRIP_GRID, out = [];
      let k = cell.j * G.nx + cell.i;
      if (!Number.isFinite(flood.dist[k])) return null;
      while (k >= 0) { out.unshift(cells[k]); k = flood.prev[k]; }
      return out;
    }

// Fewer, straighter waypoints: keep the corners
function tripSimplify(path) {
      if (!path || path.length < 3) return (path || []).map(c => ({ x: c.x, z: c.z }));
      const out = [path[0]];
      for (let k = 1; k < path.length - 1; k++) {
        const a = out[out.length - 1], b = path[k], c = path[k + 1];
        const d1 = [Math.sign(b.x - a.x), Math.sign(b.z - a.z)], d2 = [Math.sign(c.x - b.x), Math.sign(c.z - b.z)];
        if (d1[0] !== d2[0] || d1[1] !== d2[1] || Math.hypot(b.x - a.x, b.z - a.z) > 10) out.push(b);
      }
      out.push(path[path.length - 1]);
      return out.map(c => ({ x: c.x, z: c.z }));
    }

function tripLength(pts, from = null) {
      let d = 0, p = from || pts[0];
      pts.forEach(q => { d += Math.hypot(q.x - p.x, q.z - p.z); p = q; });
      return d;
    }

// Quick check for travelTo (js/vehicles.js): is it this vehicle's terrain all the way there?
function canDriveThere(v, target) {
      const key = vehicleKindKey(v.name);
      if (!key || key === 'helicopter' || key === 'balloon') return true;
      if (tripLoadOf(v) || tripCargoOn(v)) return false; // strapped on a trailer, or a trailer itself
      if (key.includes('trailer') || key === 'lowboy') return false;
      const from = state.riding === v.id ? state.botPos : { x: v.x, z: v.z };
      const steps = Math.max(2, Math.ceil(Math.hypot(target.x - from.x, target.z - from.z) / 2));
      if (key === 'excavator' && steps * 2 > VEHICLE_TERRAIN.excavator.reach) return false;
      let a = null;
      for (let s = 0; s <= steps; s++) {
        const x = from.x + (target.x - from.x) * s / steps, z = from.z + (target.z - from.z) * s / steps;
        const h = getAnalyticalGroundHeight(x, z);
        const water = z > 7.5 && h < WATER_LEVEL - 0.05;
        const b = { x, z, h, water, ice: water && typeof lakeFrozen === 'function' && lakeFrozen(), snow: !water && typeof inSnow === 'function' && inSnow({ x, z }), road: tripOnRoad(x, z) };
        if (a && !tripCanStep(key, a, b)) return false;
        if (!a && key === 'snowmobile' && !b.snow) return false;
        a = b;
      }
      return true;
    }

// --- Trailer state -------------------------------------------------------------------------------
// state.tripState: { hitch: { tow, trailer } | null, loads: { trailerId: cargoId }, researched: {}, said: {}, bogged: {}, last: {} }
function tripStateNow() {
      if (!state.tripState || typeof state.tripState !== 'object') state.tripState = {};
      const t = state.tripState;
      t.loads = t.loads || {}; t.researched = t.researched || {}; t.said = t.said || {}; t.bogged = t.bogged || {};
      // Nothing left pointing at a vehicle he no longer has
      Object.keys(t.loads).forEach(k => { if (!state.vehicles.some(v => v.id === k) || !state.vehicles.some(v => v.id === t.loads[k])) delete t.loads[k]; });
      if (t.hitch && !(state.vehicles.some(v => v.id === t.hitch.tow) && state.vehicles.some(v => v.id === t.hitch.trailer))) t.hitch = null;
      return t;
    }

function tripCargoOn(trailer) {
      const id = trailer && tripStateNow().loads[trailer.id];
      return id ? state.vehicles.find(v => v.id === id) || null : null;
    }

function tripLoadOf(cargo) {
      const loads = tripStateNow().loads;
      const tid = Object.keys(loads).find(k => loads[k] === cargo.id);
      return tid ? state.vehicles.find(v => v.id === tid) || null : null;
    }

// A boat sitting on its trailer (or anywhere on dry land) has to be taken to the water
function boatOnLand(boat) {
      if (!boat) return false;
      if (tripLoadOf(boat)) return true;
      return getAnalyticalGroundHeight(boat.x, boat.z) > WATER_LEVEL + 0.1 && Math.hypot(boat.x - 2, boat.z - 11.6) > 6;
    }

function trailerFor(cargoKey) {
      const tk = TRAILER_KINDS.find(t => t.carries === cargoKey);
      return tk ? state.vehicles.find(v => (trailerKindOf(v.name) || {}).key === tk.key) || null : null;
    }

// Park a new trailer in its row; a boat that arrives while there's an empty boat trailer goes on it
function parkNewTrailer(v) {
      if (!v || !trailerKindOf(v.name)) return;
      const used = state.vehicles.filter(o => o !== v).map(o => [o.x, o.z]);
      const slot = TRAILER_SLOTS.find(([x, z]) => !used.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < 2)) || TRAILER_SLOTS[0];
      Object.assign(v, { x: slot[0], z: slot[1], rotY: TRAILER_ROT_Y });
    }

function stowBoatOnTrailer(boat) {
      const tr = trailerFor('boat');
      if (!boat || !tr || tripCargoOn(tr) || vehicleKindKey(boat.name) !== 'boat') return false;
      tripStateNow().loads[tr.id] = boat.id;
      Object.assign(boat, { x: tr.x, z: tr.z, rotY: tr.rotY });
      return true;
    }

// --- Models ----------------------------------------------------------------------------------------
// Built at real size around Kelo-1 like the other vehicles (+x is forward), then shrunk with miniature()
function pickupTruckModel() {
      const paint = 0x1d4ed8, dark = 0x111827, chrome = 0xcbd5e1;
      const b = group();
      b.add(at(mesh(new THREE.BoxGeometry(6.0, 0.28, 1.5), dark), 0, 0.72, 0));
      [1.95, -1.75].forEach(x => [-1.08, 1.08].forEach(z => b.add(at(wheel(0.58, 0.42), x, 0.58, z))));
      // Hood, cab and a bed with a tailgate
      b.add(at(mesh(new THREE.BoxGeometry(1.6, 0.85, 2.3), paint, { metalness: 0.35, roughness: 0.4 }), 2.25, 1.32, 0));
      b.add(at(mesh(new THREE.BoxGeometry(1.95, 1.0, 2.3), paint, { metalness: 0.35, roughness: 0.4 }), 0.55, 1.4, 0));
      const cabin = group(
        at(glass(new THREE.BoxGeometry(1.7, 0.85, 2.2)), 0.5, 2.32, 0),
        at(mesh(new THREE.BoxGeometry(1.8, 0.08, 2.3), paint), 0.5, 2.78, 0));
      [-1.1, 1.1].forEach(z => [-0.32, 1.33].forEach(x => cabin.add(at(mesh(new THREE.BoxGeometry(0.1, 0.85, 0.08), paint), x, 2.32, z))));
      b.add(cabin);
      b.add(at(mesh(new THREE.BoxGeometry(2.6, 0.12, 2.2), 0x334155), -1.75, 0.98, 0));
      [-1.1, 1.1].forEach(z => b.add(at(mesh(new THREE.BoxGeometry(2.6, 0.7, 0.1), paint, { metalness: 0.35, roughness: 0.4 }), -1.75, 1.33, z)));
      b.add(at(mesh(new THREE.BoxGeometry(0.1, 0.7, 2.3), paint), -3.05, 1.33, 0));
      b.add(at(mesh(new THREE.BoxGeometry(0.12, 0.7, 2.3), paint), -0.43, 1.33, 0));
      // Grille, lights and the bumpers
      b.add(at(mesh(new THREE.BoxGeometry(0.06, 0.5, 1.6), chrome, { metalness: 0.8, roughness: 0.25 }), 3.07, 1.25, 0));
      [-0.85, 0.85].forEach(z => b.add(at(mesh(new THREE.BoxGeometry(0.06, 0.2, 0.4), 0xfef9c3, { emissive: 0xfef3c7, emissiveIntensity: 0.4 }), 3.08, 1.45, z)));
      [-0.95, 0.95].forEach(z => b.add(at(mesh(new THREE.BoxGeometry(0.06, 0.25, 0.25), 0xef4444, { emissive: 0xef4444, emissiveIntensity: 0.4 }), -3.12, 1.45, z)));
      b.add(at(mesh(new THREE.BoxGeometry(0.25, 0.25, 2.4), chrome, { metalness: 0.8 }), 3.15, 0.8, 0));
      b.add(at(mesh(new THREE.BoxGeometry(0.2, 0.22, 2.3), chrome, { metalness: 0.8 }), -3.15, 0.8, 0));
      // The tow hitch: a receiver and a ball
      b.add(at(mesh(new THREE.BoxGeometry(0.5, 0.12, 0.12), dark), -3.4, 0.62, 0));
      b.add(at(mesh(new THREE.SphereGeometry(0.09, 10, 8), chrome, { metalness: 0.9 }), -3.6, 0.74, 0));
      return miniature(b, { seat: { x: 0.45, y: 1.32 - KELO_SIT_OFFSET, z: -0.5 }, hitchX: -3.6 });
    }

function trailerModel(lower) {
      const tk = trailerKindOf(lower) || TRAILER_KINDS[0];
      const steel = tk.key === 'lowboy' ? 0xf59e0b : 0x475569, dark = 0x1f2937, wood = 0x8a5a2b;
      const L = tk.deckLen, W = tk.width, y = tk.deckY;
      const b = group();
      const tongue = L / 2 + 1.6;
      // Frame rails and a deck (bunks for a boat, a plank deck otherwise)
      [-W / 2 + 0.08, W / 2 - 0.08].forEach(z => b.add(at(mesh(new THREE.BoxGeometry(L, 0.16, 0.12), steel, { metalness: 0.6 }), 0, y - 0.12, z)));
      if (tk.key === 'boat trailer') {
        [-0.45, 0.45].forEach(z => b.add(at(mesh(new THREE.BoxGeometry(L * 0.8, 0.12, 0.16), wood, { roughness: 0.9 }), -0.2, y, z)));
        for (let x = -L / 2 + 0.4; x < L / 2; x += 1.1) b.add(at(mesh(new THREE.BoxGeometry(0.12, 0.12, W), steel, { metalness: 0.6 }), x, y - 0.12, 0));
        b.add(rod([L / 2 - 0.2, y - 0.1, 0], [L / 2 - 0.2, y + 0.9, 0], 0.06, steel, { metalness: 0.6 }));
        b.add(at(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 10), dark), L / 2 - 0.2, y + 0.8, 0));
      } else {
        b.add(at(mesh(new THREE.BoxGeometry(L, 0.08, W), tk.key === 'lowboy' ? 0x52525b : wood, { roughness: 0.9 }), 0, y, 0));
        if (tk.key === 'lowboy') b.add(at(mesh(new THREE.BoxGeometry(1.4, 0.7, W), steel, { metalness: 0.5 }), L / 2 + 0.4, y + 0.3, 0)); // gooseneck
      }
      // Axles under the back half, with fenders
      const axles = tk.key === 'lowboy' ? [-L / 2 + 0.9, -L / 2 + 2.0] : [-0.35];
      axles.forEach(x => [-W / 2 - 0.2, W / 2 + 0.2].forEach(z => {
        b.add(at(wheel(0.36, 0.26), x, 0.36, z));
        b.add(at(mesh(new THREE.BoxGeometry(0.95, 0.06, 0.34), steel, { metalness: 0.5 }), x, 0.82, z));
      }));
      // A-frame tongue, coupler and a jack stand
      [-W / 2 + 0.1, W / 2 - 0.1].forEach(z => b.add(rod([L / 2 - 0.1, y - 0.12, z], [tongue - 0.15, 0.7, 0], 0.06, steel, { metalness: 0.6 })));
      b.add(at(mesh(new THREE.BoxGeometry(0.35, 0.14, 0.18), dark, { metalness: 0.7 }), tongue - 0.1, 0.74, 0));
      b.add(rod([tongue - 0.6, 0.7, 0.18], [tongue - 0.6, 0.06, 0.18], 0.04, dark));
      // Tail lights
      [-W / 2 + 0.1, W / 2 - 0.1].forEach(z => b.add(at(mesh(new THREE.BoxGeometry(0.05, 0.12, 0.2), 0xef4444, { emissive: 0xef4444, emissiveIntensity: 0.4 }), -L / 2 - 0.02, y - 0.05, z)));
      // Loading ramps, folded up until he lowers them
      const ramp = group();
      [-0.45, 0.45].forEach(z => ramp.add(at(mesh(new THREE.BoxGeometry(2.0, 0.06, 0.4), 0x9ca3af, { metalness: 0.6 }), -1.0, 0, z)));
      ramp.position.set(-L / 2, y, 0);
      ramp.rotation.z = -1.4;
      b.add(ramp);
      // Straps, shown once something is tied down
      const straps = group();
      straps.visible = false;
      b.add(straps);
      return miniature(b, { trailerKey: tk.key, deckY: y + 0.05, deckLen: L, width: W, tongue, ramp, straps });
    }

function ratchetStrapsModel() {
      const g = group();
      for (let i = 0; i < 3; i++) {
        const roll = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16), 0xf97316, { roughness: 0.8 });
        roll.rotation.x = Math.PI / 2;
        g.add(at(roll, i * 0.27 - 0.27, 0.12, 0));
        g.add(at(mesh(new THREE.BoxGeometry(0.1, 0.05, 0.14), 0x9ca3af, { metalness: 0.8 }), i * 0.27 - 0.27, 0.26, 0));
      }
      return realSize(g);
    }

function tireChainsModel() {
      const g = group();
      for (let i = 0; i < 2; i++) {
        const ring = mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 20), 0x9ca3af, { metalness: 0.9, roughness: 0.3 });
        ring.rotation.x = Math.PI / 2;
        g.add(at(ring, i * 0.5 - 0.25, 0.04 + i * 0.06, 0));
      }
      return realSize(g);
    }

// items3d.js picks the first rule that matches, so these go in front of the truck/snowmobile/boat rules
if (typeof ITEM_MODEL_RULES !== 'undefined') {
  ITEM_MODEL_RULES.unshift(
    [/^(?!.*hitch).*(trailer|low-?boy|low-?bed|low ?loader)/, lower => (trailerKindOf(lower) ? trailerModel(lower) : null) || trailerModel('snowmobile trailer')],
    [/\bpick-?up\b.*truck|\bpick-?up\b$/, () => pickupTruckModel()],
    [/ratchet straps?|tie-?down straps?|cargo straps?/, () => ratchetStrapsModel()],
    [/tire chains|tyre chains|snow chains|load binders?/, () => tireChainsModel()]
  );
}
// Know-how: the pickup (gasoline) and towing a trailer, before the snowmobile and boat rules can claim them
if (typeof GEAR_KNOWHOW !== 'undefined') {
  GEAR_KNOWHOW.unshift(
    { key: 'towing', re: /trailer|low-?boy|low-?bed|low ?loader/i, label: 'a trailer', wiki: 'Trailer (vehicle)',
      how: 'Back the hitch ball under the coupler, drop it on and lock the latch, cross the safety chains, plug in the lights, and take corners wide.' },
    { key: 'pickup', re: PICKUP_RE, label: 'a pickup truck', wiki: 'Pickup truck', fuel: 'gasoline',
      how: 'Start it, check the mirrors, and remember a trailer behind you needs wide turns and gentle braking.' }
  );
}
if (typeof SKILL_WORDS !== 'undefined') SKILL_WORDS.unshift({ kind: 'pickup', re: /\bpick-?up( truck)?\b/i, verb: 'driving', noun: 'pickup truck' });

// --- Every frame: trailers follow their hitch, cargo rides on the deck ----------------------------
const tripRig = { ramp: null, reversing: false };
const tripV3 = new THREE.Vector3();

function tripMesh(v) {
      return v && typeof vehicleMeshes !== 'undefined' ? vehicleMeshes[v.id] || null : null;
    }

function tripHitchX(tow) {
      const m = tripMesh(tow);
      if (!m) return -3.4;
      if (typeof m.userData.hitchX === 'number') return m.userData.hitchX;
      // The back of whatever it is (the dump truck's frame), measured once
      const keep = { p: m.position.clone(), r: m.rotation.clone() };
      m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(m);
      m.position.copy(keep.p); m.rotation.copy(keep.r); m.updateMatrixWorld(true);
      m.userData.hitchX = box.min.x - 0.15;
      return m.userData.hitchX;
    }

// How far below its origin a vehicle's lowest point is, and how tall it is (measured once)
function tripCargoBox(cargo) {
      const m = tripMesh(cargo);
      if (!m) return { bottom: 0, top: 1.2 };
      if (m.userData.tripBox) return m.userData.tripBox;
      const keep = { p: m.position.clone(), r: m.rotation.clone() };
      m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(m);
      m.position.copy(keep.p); m.rotation.copy(keep.r); m.updateMatrixWorld(true);
      m.userData.tripBox = { bottom: box.min.y, top: box.max.y, len: box.max.x - box.min.x };
      return m.userData.tripBox;
    }

function tripPlaceTrailer(tr, m, x, z, b) {
      const u = m.userData, half = (u.deckLen || 4.8) / 2;
      const hf = getIslandGroundHeight(x + Math.cos(b) * half, z - Math.sin(b) * half);
      const hr = getIslandGroundHeight(x - Math.cos(b) * half, z + Math.sin(b) * half);
      const pitch = Math.atan2(hf - hr, half * 2);
      m.position.set(x, (hf + hr) / 2, z);
      m.rotation.set(0, b, pitch);
      tr.x = x; tr.z = z; tr.rotY = b;
    }

function tripFrame() {
      const ts = state.tripState;
      if (!ts) return;
      // A hitched trailer follows the ball: its tongue points at the hitch, its axle trails behind
      const h = ts.hitch;
      if (h && state.riding === h.tow) {
        const tow = state.vehicles.find(v => v.id === h.tow), tr = state.vehicles.find(v => v.id === h.trailer);
        const tm = tripMesh(tow), rm = tripMesh(tr);
        if (tow && tr && tm && rm) {
          const a = tm.rotation.y, hx = tripHitchX(tow);
          const hitch = { x: tm.position.x + Math.cos(a) * hx, z: tm.position.z - Math.sin(a) * hx };
          const L = rm.userData.tongue || 4;
          const dx = hitch.x - tr.x, dz = hitch.z - tr.z;
          const b = Math.hypot(dx, dz) > 0.01 ? Math.atan2(-dz, dx) : (tr.rotY || 0);
          tripPlaceTrailer(tr, rm, hitch.x - Math.cos(b) * L, hitch.z + Math.sin(b) * L, b);
        }
      }
      // Winching a boat on or floating it off: it slides between the deck and the water
      const sl = tripRig.slide;
      if (sl) {
        const cm = tripMesh(state.vehicles.find(v => v.id === sl.cargoId));
        if (cm) {
          const p = sl.p;
          cm.position.set(sl.from.x + (sl.to.x - sl.from.x) * p, sl.from.y + (sl.to.y - sl.from.y) * p, sl.from.z + (sl.to.z - sl.from.z) * p);
          cm.rotation.set(0, sl.b, 0);
        }
      }
      // Anything strapped on a trailer sits on its deck and goes where it goes
      Object.keys(ts.loads || {}).forEach(tid => {
        const tr = state.vehicles.find(v => v.id === tid), cargo = state.vehicles.find(v => v.id === ts.loads[tid]);
        const rm = tripMesh(tr), cm = tripMesh(cargo);
        if (!rm || !cm || state.riding === cargo.id || (sl && sl.cargoId === cargo.id)) return;
        if (!(h && state.riding === h.tow && h.trailer === tid)) tripPlaceTrailer(tr, rm, tr.x, tr.z, tr.rotY || 0);
        rm.updateMatrixWorld(true);
        const box = tripCargoBox(cargo);
        tripV3.set(0, (rm.userData.deckY || 0.7) - box.bottom, 0);
        rm.localToWorld(tripV3);
        cm.position.copy(tripV3);
        cm.rotation.set(0, rm.rotation.y, rm.rotation.z);
        cargo.x = tr.x; cargo.z = tr.z; cargo.rotY = tr.rotY;
      });
      // Riding up or down a ramp: lift the vehicle (and him in its seat) along the slope
      const r = tripRig.ramp;
      if (r && state.riding === r.cargoId) {
        const cm = tripMesh(state.vehicles.find(v => v.id === r.cargoId));
        if (cm) {
          const len = Math.hypot(r.to.x - r.from.x, r.to.z - r.from.z) || 1;
          const p = Math.max(0, Math.min(1, ((state.botPos.x - r.from.x) * (r.to.x - r.from.x) + (state.botPos.z - r.from.z) * (r.to.z - r.from.z)) / (len * len)));
          const ground = getIslandGroundHeight(state.botPos.x, state.botPos.z);
          const y = r.from.y + (r.to.y - r.from.y) * Math.min(1, p / 0.55);
          const lift = y - ground;
          cm.position.y += lift;
          cm.rotation.z = p > 0.02 && p < 0.55 ? Math.atan2(r.to.y - r.from.y, len * 0.55) : 0;
          if (typeof keloGroup !== 'undefined') keloGroup.position.y += lift;
        }
      }
    }

// A new trailer parks in the trailer row; a new boat goes on an empty boat trailer if he has one
if (typeof registerVehicle === 'function') {
  const registerVehicleBeforeTrips = registerVehicle;
  registerVehicle = function (name) {
    const v = registerVehicleBeforeTrips(name);
    if (v && trailerKindOf(v.name)) { parkNewTrailer(v); renderVehicles3D(); }
    else if (v && vehicleKindKey(v.name) === 'boat' && stowBoatOnTrailer(v)) renderVehicles3D();
    return v;
  };
}

// Run right after updateVehicles in the same frame (js/scene.js calls it by name)
if (typeof updateVehicles === 'function') {
  const updateVehiclesBeforeTrips = updateVehicles;
  updateVehicles = function (t) {
    updateVehiclesBeforeTrips(t);
    try { tripFrame(); } catch (e) { /* never break the frame */ }
  };
}

// --- The trip planner ------------------------------------------------------------------------------
const TRIP_PLACES = {
  mountain: { x: 50, z: -16, label: 'up on the snowy mountain' },
  lake: { x: 14, z: 20, label: 'out on the lake' }
};
// Where a trailered boat is backed into the water: the beach below the vehicle yard
const BOAT_LAUNCH = { x: 24, pullOutZ: -3.5, startZ: 3.0, backZ: 1.6, waterZ: 13.5 };
const TRIP_RIDE_RANGE = 30; // how far he rides on its own ground before turning back
const TOW_KINDS = { snowmobile: ['pickup', 'dump truck'], boat: ['pickup', 'dump truck'], excavator: ['dump truck'] };
const TRIP_VERBS = { snowmobile: 'ride the snowmobile', boat: 'take the boat', excavator: 'take the excavator', bike: 'ride my bike', pickup: 'drive the pickup', 'dump truck': 'drive the dump truck', helicopter: 'fly the helicopter', balloon: 'fly the balloon' };

function tripPlain(name) {
      return String(name || '').replace(/^(an?|the|my)\s+/i, '');
    }

function tripDestination(to, key) {
      if (to && typeof to === 'object' && Number.isFinite(to.x) && Number.isFinite(to.z)) return { x: to.x, z: to.z, label: to.label || 'over there' };
      const t = String(to || '').toLowerCase();
      if (/lake|water|beach|launch|fish|paddle|row/.test(t)) return { ...TRIP_PLACES.lake };
      if (/mountain|snow|peak|slope|summit|ridge|alpine/.test(t)) return { ...TRIP_PLACES.mountain };
      const loc = t && Object.entries(TOWN_LOCATIONS).find(([k, l]) => t.includes(k.replace(/_/g, ' ')) || (l.building && t.includes(String(l.building).toLowerCase())));
      if (loc) return { x: loc[1].x, z: loc[1].z, label: loc[1].building || loc[0] };
      if (key === 'snowmobile') return { ...TRIP_PLACES.mountain };
      if (key === 'boat') return { ...TRIP_PLACES.lake };
      // Somewhere a good ride away on open ground
      const home = TOWN_LOCATIONS.meadow || { x: -20, z: 0 };
      return { x: home.x, z: home.z, label: 'the meadow' };
    }

function findTripVehicle(name) {
      const t = String(name || '').toLowerCase().trim();
      if (!t) return null;
      return state.vehicles.find(v => v.name.toLowerCase() === t)
        || state.vehicles.find(v => t.includes(tripPlain(v.name).toLowerCase()) || tripPlain(v.name).toLowerCase().includes(tripPlain(t)))
        || state.vehicles.find(v => vehicleKindKey(v.name) === vehicleKindKey(t) && vehicleKindKey(t))
        || state.vehicles.find(v => (VEHICLE_KIND_WORDS[vehicleKindKey(v.name)] || '').split(' ').some(w => w.length > 3 && t.includes(w)))
        || null;
    }

// Where a vehicle is, as he'd say it (never coordinates)
function vehicleLocationLabel(v) {
      const tr = tripLoadOf(v);
      if (tr) return `on the ${tripPlain(tr.name).toLowerCase()}`;
      const ts = state.tripState || {};
      if (ts.hitch && ts.hitch.trailer === v.id) return 'hitched to the ' + tripPlain((state.vehicles.find(o => o.id === ts.hitch.tow) || {}).name || 'truck').toLowerCase();
      if (typeof inParkingArea === 'function' && inParkingArea(v.x, v.z, 0.5)) {
        if (AIR_SLOTS.some(([x, z]) => Math.hypot(v.x - x, v.z - z) < PAD_RADIUS)) return 'the helipad';
        if (BALLOON_SLOTS.some(([x, z]) => Math.hypot(v.x - x, v.z - z) < PAD_RADIUS)) return 'the balloon field';
        return 'the vehicle yard';
      }
      if (TRAILER_SLOTS.some(([x, z]) => Math.hypot(v.x - x, v.z - z) < 4)) return 'the trailer row by the yard';
      if (DOCK_SLOTS.some(([x, z]) => Math.hypot(v.x - x, v.z - z) < 3)) return 'the dock';
      if (v.z > 9.2) return 'out on the lake';
      if (v.z < -12) return 'up the mountain';
      const near = Object.values(TOWN_LOCATIONS).filter(l => l.building).sort((a, b) => Math.hypot(a.x - v.x, a.z - v.z) - Math.hypot(b.x - v.x, b.z - v.z))[0];
      return near ? `near the ${near.building}` : 'out in the valley';
    }

// Plan a trip: which vehicle does which leg, what it needs, and why
function planTrip(v, to) {
      const key = vehicleKindKey(v.name);
      const dest = tripDestination(to, key);
      const plain = tripPlain(v.name);
      const plan = { ok: true, key, vehicle: v, dest, mode: 'direct', missing: [], learn: [], fuel: [], why: '', reasoning: '' };
      // There and back, plus the bits in between (hitching, lining up, parking) and the bends a route
      // really takes: a quarter extra and a few units more, so a tank doesn't run dry on the way home
      const fuelFor = (veh, length) => {
        if (typeof fuelNeededBy !== 'function' || !fuelNeededBy(veh)) return;
        plan.fuel.push({ v: veh, need: Math.min(100, Math.ceil((length * 2 + 12) * FUEL_PER_UNIT * 1.25)) });
      };
      const learnFor = veh => { const r = typeof knowHowRule === 'function' && knowHowRule(veh.name); if (r && !state.knowHow[r.key]) plan.learn.push(veh.name); };
      if (key && (key.includes('trailer') || key === 'lowboy')) return { ...plan, ok: false, why: `The ${plain} has no engine. It only goes where a truck pulls it.` };
      learnFor(v);
      if (key === 'balloon') { plan.mode = 'balloon'; return plan; }
      if (key === 'helicopter') {
        // Somewhere flat and open to set down near where he wants to go
        const cells = tripGridNow();
        const flat = c => !c.water && !(c.x > TOWN.minX && c.x < TOWN.maxX && c.z > TOWN.minZ && c.z < TOWN.maxZ)
          && Math.abs(getAnalyticalGroundHeight(c.x + 2, c.z) - getAnalyticalGroundHeight(c.x - 2, c.z)) < 1.2 && Math.abs(getAnalyticalGroundHeight(c.x, c.z + 2) - getAnalyticalGroundHeight(c.x, c.z - 2)) < 1.2;
        const spot = cells.filter(flat).sort((a, b) => Math.hypot(a.x - dest.x, a.z - dest.z) - Math.hypot(b.x - dest.x, b.z - dest.z))[0];
        if (!spot || Math.hypot(spot.x - dest.x, spot.z - dest.z) > 14) return { ...plan, ok: false, why: `There's nowhere flat and open to land the ${plain} near there.` };
        if (typeof safeToFly === 'function' && !safeToFly(v)) return { ...plan, ok: false, why: `It's too windy to fly the ${plain} right now.` };
        plan.mode = 'fly';
        plan.landing = { x: spot.x, z: spot.z };
        fuelFor(v, Math.hypot(spot.x - v.x, spot.z - v.z));
        return plan;
      }
      if (key === 'boat' && !boatOnLand(v)) {
        if (typeof lakeFrozen === 'function' && lakeFrozen()) return { ...plan, ok: false, why: 'The lake is frozen, so the boat stays put until spring.' };
        plan.mode = 'boat-dock';
        return plan;
      }
      const cells = tripGridNow();
      const startAt = tripLoadOf(v) || v;
      const start = tripCellAt(cells, startAt.x, startAt.z);
      // The reachable spot closest to where he wants to be, within a fair ride (fuel for there and back)
      const goalOf = (flood, near = dest, range = Infinity) => {
        let best = null, bestScore = Infinity;
        cells.forEach((c, k) => {
          if (!Number.isFinite(flood.dist[k]) || flood.dist[k] > range) return;
          const score = Math.hypot(c.x - near.x, c.z - near.z) - (key === 'snowmobile' ? Math.min(c.h, 12) * 0.25 : 0);
          if (score < bestScore) { bestScore = score; best = c; }
        });
        return best;
      };
      // 1. Can it get there by itself?
      if (key !== 'boat') {
        const own = tripFlood(cells, key, [start]);
        const goal = goalOf(own, dest, TRIP_RIDE_RANGE);
        const path = goal && tripPathTo(cells, own, goal);
        const len = path ? tripLength(tripSimplify(path)) : 0;
        const startsOnIt = key === 'snowmobile' ? start.snow : !(key === 'bike' && start.snow);
        const close = goal && Math.hypot(goal.x - dest.x, goal.z - dest.z) < (key === 'snowmobile' ? 18 : 10);
        if (startsOnIt && close && len > 4 && !(key === 'excavator' && len > VEHICLE_TERRAIN.excavator.reach)) {
          plan.route = tripSimplify(path);
          plan.length = len;
          fuelFor(v, len);
          return plan;
        }
      }
      // 2. Not by itself. Can it be hauled there?
      const tows = TOW_KINDS[key];
      const why0 = key === 'snowmobile' ? (start.snow ? `the snow doesn't reach all the way there` : `there's no snow between here and there, and a snowmobile just bogs down on dry ground`)
        : key === 'boat' ? `it's sitting on dry land, and a boat only goes on water`
        : key === 'excavator' ? `it's too far to crawl an excavator on its tracks`
        : `the ${plain} can't get there: it's for ${(VEHICLE_TERRAIN[key] || {}).text || 'other ground'}`;
      if (!tows) return { ...plan, ok: false, why: `I'd like to ${TRIP_VERBS[key] || 'go'} ${dest.label}, but ${why0}.` };
      plan.mode = 'haul';
      const tk = TRAILER_KINDS.find(t => t.carries === key);
      const tow = state.vehicles.find(o => tows.includes(vehicleKindKey(o.name)) && o !== v) || null;
      const towKey = tow ? vehicleKindKey(tow.name) : tows[0];
      const trailer = trailerFor(key);
      Object.assign(plan, { tow, towKey, trailer, trailerKind: tk });
      const towFrom = tow ? tripCellAt(cells, tow.x, tow.z) : tripCellAt(cells, 24, -1);
      // The truck keeps to dry ground if it can; only with nowhere dry to go does it plan on tire chains
      const towFloodWith = chains => {
        tripAssumeChains = chains;
        try { return tripFlood(cells, towKey, [towFrom]); } finally { tripAssumeChains = false; }
      };
      let towFlood = towFloodWith(false);
      let drop = null, cargoRoute = null;
      const findDrop = () => {
      drop = null; cargoRoute = null;
      if (key === 'boat') {
        // Back it down the beach below the yard into the water
        drop = tripCellAt(cells, BOAT_LAUNCH.x, BOAT_LAUNCH.startZ);
        if (!Number.isFinite(towFlood.dist[drop.j * TRIP_GRID.nx + drop.i])) drop = null;
        if (typeof lakeFrozen === 'function' && lakeFrozen()) plan.frozen = 'The lake is frozen solid, so there is nowhere to launch the boat until spring.';
      } else if (key === 'excavator') {
        drop = goalOf(towFlood);
        if (drop) {
          const own = tripFlood(cells, key, [drop]);
          const g = goalOf(own);
          const p = g && tripPathTo(cells, own, g);
          cargoRoute = p && tripLength(tripSimplify(p)) <= VEHICLE_TERRAIN.excavator.reach ? tripSimplify(p) : [{ x: drop.x, z: drop.z }];
        }
      } else {
        // Where its own ground begins next to somewhere the truck can reach
        const G = TRIP_GRID, sources = [], from = new Map();
        cells.forEach((c, k) => {
          if (!Number.isFinite(towFlood.dist[k])) return;
          for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
            const i = c.i + di, j = c.j + dj;
            if (i < 0 || j < 0 || i >= G.nx || j >= G.nz) continue;
            const n = cells[j * G.nx + i];
            if (tripCanStep(key, c, n)) {
              const prevBest = from.get(n);
              if (!prevBest || towFlood.dist[k] < towFlood.dist[prevBest.j * G.nx + prevBest.i]) from.set(n, c);
              if (!sources.includes(n)) sources.push(n);
            }
          }
        });
        if (sources.length) {
          const flood = tripFlood(cells, key, sources);
          const goal = goalOf(flood, dest, TRIP_RIDE_RANGE);
          const path = goal && tripPathTo(cells, flood, goal);
          if (path && path.length) {
            drop = from.get(path[0]);
            cargoRoute = tripSimplify(path);
            // A loop on its own ground: out to the far point and back to where it was unloaded,
            // flooded from that very spot (the multi-start flood could lead off from another edge)
            if (tripLength(cargoRoute) < 8) {
              const fromHere = tripFlood(cells, key, [path[0]]);
              const far = cells.filter((c, k) => Number.isFinite(fromHere.dist[k]) && fromHere.dist[k] <= TRIP_RIDE_RANGE)
                .sort((a, b) => Math.hypot(b.x - path[0].x, b.z - path[0].z) - Math.hypot(a.x - path[0].x, a.z - path[0].z))[0];
              const p2 = far && tripPathTo(cells, fromHere, far);
              if (p2 && p2.length > 1) cargoRoute = tripSimplify(p2);
            }
          }
        }
      }
      };
      findDrop();
      if (!drop && plan.ok !== false && !tripHasChains()) { towFlood = towFloodWith(true); findDrop(); }
      if (plan.frozen) return { ...plan, ok: false, why: plan.frozen };
      if (!drop) {
        return { ...plan, ok: false, why: key === 'snowmobile'
          ? `I want to ride the snowmobile ${dest.label}, but there's no snow anywhere a truck can drive to: the snow line is up past the steep slopes. It'll have to wait for more snow.`
          : `I want to ${TRIP_VERBS[key] || 'go'} ${dest.label}, but there's no road a truck could haul it along.` };
      }
      const towPath = tripPathTo(cells, towFlood, drop);
      plan.towRoute = tripSimplify(towPath);
      plan.towLength = tripLength(plan.towRoute);
      plan.drop = { x: drop.x, z: drop.z };
      plan.cargoRoute = cargoRoute || [];
      plan.length = tripLength(plan.cargoRoute);
      if (tripAssumeChainsNeeded(cells, towPath) && !tripHasChains()) plan.missing.push({ item: 'A set of tire chains', category: 'tool', why: `The ${VEHICLE_KIND_WORDS[towKey]} would spin out in the snow on the way without chains on its tires.` });
      // What it takes: a truck with a hitch, the right trailer, something to tie it down
      if (!tow) plan.missing.push({ item: towKey === 'pickup' ? 'A pickup truck with a tow hitch' : 'A dump truck', category: 'vehicle', why: `I need something to pull the ${tk.label}.` });
      else if (!tripHasHitch(tow)) plan.missing.push({ item: `A trailer hitch for the ${tripPlain(tow.name).toLowerCase()}`, category: 'tool', why: `The ${tripPlain(tow.name).toLowerCase()} has nothing to hook a trailer onto.` });
      if (!trailer) plan.missing.push({ item: tk.ask, category: 'vehicle', why: `The ${plain.toLowerCase()} rides up its ramp and gets strapped down on it.` });
      const heavy = key === 'excavator';
      if (!tripHasStraps(heavy)) plan.missing.push({ item: heavy ? 'A set of chains and load binders' : 'A set of ratchet straps', category: 'tool', why: `So the ${plain.toLowerCase()} can't shift or fall off on the way.` });
      if (tow) { learnFor(tow); fuelFor(tow, plan.towLength); }
      if (trailer) learnFor(trailer);
      if (key !== 'boat') fuelFor(v, plan.length + 4);
      plan.reasoning = `I want to ${TRIP_VERBS[key] || 'go'} ${dest.label}, but ${why0}. I need to haul it: on a ${tk.label} behind ${tow ? 'my ' + tripPlain(tow.name).toLowerCase() : 'a ' + VEHICLE_KIND_WORDS[towKey]}, strapped down, and unload it ${key === 'snowmobile' ? 'where the snow starts' : key === 'boat' ? 'at the water' : 'where the work is'}.`;
      return plan;
    }

function tripAssumeChainsNeeded(cells, path) {
      return Boolean(path && path.some(c => c.snow));
    }

// --- Saying it once, and reading up ----------------------------------------------------------------
function tripSay(key, text, ms = 30 * 60 * 1000) {
      const ts = tripStateNow();
      if (ts.said[key] && Date.now() - ts.said[key] < ms) return false;
      ts.said[key] = Date.now();
      state.speechBubble = text;
      if (typeof renderAllUI === 'function') renderAllUI();
      return true;
    }

async function researchTransport(plan, originLabel = 'Planning a Trip') {
      const ts = tripStateNow(), key = plan.key, plain = tripPlain(plan.vehicle.name).toLowerCase();
      if (state.isBusy || state.isBrowsing || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isBusy = true;
      state.isBrowsing = true;
      const query = key === 'boat' ? 'How to launch a boat from a trailer' : `How to transport ${key === 'excavator' ? 'an excavator' : 'a ' + plain}`;
      const how = key === 'boat'
        ? 'Keep the boat strapped on a boat trailer behind a truck, back the trailer down the beach until the boat floats, unhook the winch strap, and winch it back on afterwards.'
        : key === 'excavator'
          ? 'Long moves go on a lowboy trailer behind a big truck: drive it slowly up the ramps, lower the bucket, chain each corner down with load binders.'
          : `Haul it on a ${plan.trailerKind.label} behind a pickup with a hitch: ride it slowly up the ramp, strap it down front and back with ratchet straps, and unload it where the snow starts.`;
      try {
        state.currentLocKey = 'cyber';
        state.customPlaceName = null;
        state.targetPos = { x: TOWN_LOCATIONS.cyber.x, z: TOWN_LOCATIONS.cyber.z };
        state.moodEmoji = '🧭';
        state.moodTitle = `Looking up: ${query.toLowerCase()}`.slice(0, 80);
        state.speechBubble = plan.reasoning;
        renderAllUI();
        await waitForArrival(60000);
        await new Promise(r => setTimeout(r, 2500));
        let article = null;
        try { article = typeof wikiSummary === 'function' ? await wikiSummary(key === 'boat' ? 'Boat trailer' : 'Trailer (vehicle)') : null; } catch (e) {}
        ts.researched[key] = { at: Date.now(), how };
        state.webHistory.unshift({ query, time: 'Just now', verdict: how, hops: article ? [{ title: article.title, url: article.url, extract: String(article.extract || '').slice(0, 280) }] : [] });
        if (state.webHistory.length > 12) state.webHistory.length = 12;
        const need = plan.missing.map(m => m.item.replace(/^A /, 'a '));
        state.moodTitle = `Worked out how to haul the ${plain}`.slice(0, 80);
        state.speechBubble = `${how}${need.length ? ` So I need ${need.join(', ').replace(/, ([^,]*)$/, ' and $1')}.` : ''}`.slice(0, 400);
        state.diaryEntries.unshift({
          time: originLabel, location: 'NetNode Cyber Cafe', mood: `🧭 How to move a ${plain}`.slice(0, 80),
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, ${plan.reasoning} I read up on it at NetNode: ${how}${need.length ? ` I've asked for ${need.join(', ')}.` : ''}`
        });
        if (typeof addConcept === 'function' && !Object.keys(ts.researched).slice(1).length) addConcept({ name: 'The Right Ground for the Machine', emoji: '🚚', definition: 'Every vehicle has the ground it was made for; to go further you haul it there on something that can.', builtFrom: ['the snowmobile bogging down', 'trailers'] }, 'Worked it out');
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        state.isBusy = false;
        state.isBrowsing = false;
      }
    }

function requestTripGear(plan) {
      let asked = 0;
      plan.missing.forEach(m => {
        const open = state.requestsToUser.some(r => !r.fulfilled && !r.declined && (r.requestedGear === m.item || (vehicleKindKey(m.item) && vehicleKindKey(r.requestedGear || '') === vehicleKindKey(m.item))));
        const coming = state.mailbox.some(p => p.name === m.item);
        if (open || coming) return;
        const before = state.requestsToUser.length;
        addItemRequest(m.item, m.category, `${plan.reasoning} ${m.why}`.trim(), 'Planning a trip');
        if (state.requestsToUser.length > before) asked++;
      });
      if (asked) showToast(`🚚 Kelo-1 asked for what he needs to haul the ${tripPlain(plan.vehicle.name).toLowerCase()}`);
      return asked;
    }

// --- Driving, hitching, loading ---------------------------------------------------------------------
const tripSleep = sleep;

function tripFwd(b) {
      return { x: Math.cos(b), z: -Math.sin(b) };
    }

// Get to a point, even if something else nudges where he's headed. He keeps going as long as he's
// getting closer (a slow computer just takes longer); he gives up only when he's made no headway for a while.
async function tripGoTo(p, ms = null) {
      const started = Date.now();
      const far = Math.hypot(p.x - state.botPos.x, p.z - state.botPos.z);
      const cap = ms || Math.max(120000, far * 15000);
      let best = far, lastGain = Date.now();
      state.targetPos = { x: p.x, z: p.z };
      while (Date.now() - started < cap && Math.hypot(state.botPos.x - p.x, state.botPos.z - p.z) > 1.0) {
        if (Math.hypot(state.targetPos.x - p.x, state.targetPos.z - p.z) > 0.1) state.targetPos = { x: p.x, z: p.z };
        await waitForArrival(3000);
        const d = Math.hypot(state.botPos.x - p.x, state.botPos.z - p.z);
        if (d < best - 0.3) { best = d; lastGain = Date.now(); }
        else if (Date.now() - lastGain > 45000) break; // stuck
      }
    }

function tripSetRiding(v, slow = 1) {
      const type = vehicleTypeFor(v.name) || { speed: 1.5, mode: 'land' };
      state.riding = v.id;
      state.ridingSpeed = Math.max(0.15, (type.speed || 1.5) * slow);
      state.ridingMode = type.mode === 'water' ? 'water' : 'land';
    }

async function tripBoard(v, label) {
      if (state.riding !== v.id) {
        if (state.riding) tripExitVehicle(state.vehicles.find(o => o.id === state.riding));
        state.moodTitle = `Walking to the ${tripPlain(v.name).toLowerCase()}`;
        renderAllUI();
        await tripGoTo(boardingSpot(v), 60000);
        tripSetRiding(v, state.tripState && state.tripState.hitch && state.tripState.hitch.tow === v.id ? 0.8 : 1);
        state.botPos = { x: v.x, z: v.z };
        state.targetPos = { ...state.botPos };
        state.botRotY = (v.rotY || 0) + Math.PI / 2;
      }
      if (label) { state.moodTitle = label.slice(0, 80); renderAllUI(); }
    }

async function tripDrive(v, pts, label) {
      await tripBoard(v, label);
      let driven = 0, last = { ...state.botPos };
      for (const p of pts) {
        await tripGoTo(p);
        driven += Math.hypot(state.botPos.x - last.x, state.botPos.z - last.z);
        last = { ...state.botPos };
      }
      v.x = Math.round(state.botPos.x * 10) / 10;
      v.z = Math.round(state.botPos.z * 10) / 10;
      v.rotY = state.botRotY - Math.PI / 2;
      if (typeof burnFuel === 'function' && driven > 0) burnFuel(v, driven);
      return driven;
    }

function tripExitVehicle(v) {
      if (!v) return;
      if (state.riding === v.id) {
        v.x = Math.round(state.botPos.x * 10) / 10;
        v.z = Math.round(state.botPos.z * 10) / 10;
        v.rotY = state.botRotY - Math.PI / 2;
      }
      state.riding = null;
      state.ridingSpeed = 1;
      state.ridingMode = null;
      renderVehicles3D();
      const type = vehicleTypeFor(v.name);
      if (!type || type.mode !== 'water') state.botPos = boardingSpot(v);
      state.targetPos = { ...state.botPos };
    }

// Backing up in a straight line, facing the way it already faces
async function tripReverse(v, to, speed = 1.3) {
      const rot = state.botRotY, from = { ...state.botPos };
      // Timed by the clock, not by steps, so a slow computer doesn't make it crawl
      const len = Math.hypot(to.x - from.x, to.z - from.z), ms = Math.max(300, len / Math.abs(speed) * 1000), t0 = performance.now();
      for (;;) {
        const p = Math.min(1, (performance.now() - t0) / ms);
        state.botPos = { x: from.x + (to.x - from.x) * p, z: from.z + (to.z - from.z) * p };
        state.targetPos = { ...state.botPos };
        state.botRotY = rot;
        if (p >= 1) break;
        await keloNextFrame();
      }
      v.x = state.botPos.x; v.z = state.botPos.z; v.rotY = rot - Math.PI / 2;
    }

// Turning the vehicle to face a heading, a little at a time
async function tripTurnTo(b) {
      const want = b + Math.PI / 2;
      let d = ((want - state.botRotY) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      const start = state.botRotY, ms = Math.max(200, Math.abs(d) * 600), t0 = performance.now();
      for (;;) {
        const p = Math.min(1, (performance.now() - t0) / ms);
        state.botRotY = start + d * p;
        state.targetPos = { ...state.botPos };
        if (p >= 1) break;
        await keloNextFrame();
      }
    }

async function tripHitchUp(tow, trailer) {
      const ts = tripStateNow();
      if (ts.hitch && ts.hitch.tow === tow.id && ts.hitch.trailer === trailer.id) return;
      const rm = tripMesh(trailer);
      const b = trailer.rotY || 0, f = tripFwd(b), L = (rm && rm.userData.tongue) || 4, hx = tripHitchX(tow);
      const coupler = { x: trailer.x + f.x * L, z: trailer.z + f.z * L };
      const spot = { x: coupler.x - f.x * hx, z: coupler.z - f.z * hx };
      const approach = { x: spot.x + f.x * 3.5, z: spot.z + f.z * 3.5 };
      await tripDrive(tow, [approach], `Backing the ${tripPlain(tow.name).toLowerCase()} up to the ${tripPlain(trailer.name).toLowerCase()}`);
      // Couldn't get the truck lined up (something in the way): no hitching from across the yard
      if (Math.hypot(state.botPos.x - approach.x, state.botPos.z - approach.z) > 3) return false;
      await tripTurnTo(b);
      state.speechBubble = 'Back... back... a little more... stop.';
      renderAllUI();
      await tripReverse(tow, spot, 1.0);
      ts.hitch = { tow: tow.id, trailer: trailer.id, home: { x: spot.x, z: spot.z } };
      state.speechBubble = 'Clunk. Coupler on the ball, latch locked, safety chains crossed, lights plugged in.';
      renderAllUI();
      await tripSleep(1800);
      return true;
    }

function tripUnhitch() {
      const ts = tripStateNow();
      ts.hitch = null;
    }

function tripRampDown(trailer, down) {
      const rm = tripMesh(trailer);
      if (rm && rm.userData.ramp) rm.userData.ramp.rotation.z = down ? Math.asin(Math.min(0.9, (rm.userData.deckY || 0.7) / 2)) : -1.4;
    }

function tripDeckPoints(cargo, trailer) {
      const rm = tripMesh(trailer), u = rm ? rm.userData : {};
      const b = trailer.rotY || 0, f = tripFwd(b), back = (u.deckLen || 4.8) / 2 + 2.4;
      const foot = { x: trailer.x - f.x * back, z: trailer.z - f.z * back };
      foot.y = getIslandGroundHeight(foot.x, foot.z);
      let deckY = (u.deckY || 0.7) + getIslandGroundHeight(trailer.x, trailer.z);
      if (rm) { rm.updateMatrixWorld(true); tripV3.set(0, u.deckY || 0.7, 0); rm.localToWorld(tripV3); deckY = tripV3.y; }
      const box = tripCargoBox(cargo);
      return { foot, deck: { x: trailer.x, z: trailer.z, y: deckY - box.bottom }, b, f };
    }

// Ride it up the ramp onto the deck (a boat is winched up instead)
async function tripLoad(cargo, trailer, label) {
      const ts = tripStateNow(), plain = tripPlain(cargo.name).toLowerCase();
      tripRampDown(trailer, true);
      const { foot, deck, b, f } = tripDeckPoints(cargo, trailer);
      if (vehicleKindKey(cargo.name) === 'boat') {
        state.moodTitle = `Winching the ${plain} onto the trailer`;
        state.speechBubble = 'Hook on the bow eye... crank, crank, crank.';
        renderAllUI();
        await tripSlide(cargo, { x: cargo.x, z: cargo.z, y: WATER_LEVEL }, deck, b, 4000);
      } else {
        if (Math.hypot(cargo.x - foot.x, cargo.z - foot.z) > 1.5) await tripDrive(cargo, [foot], `Creeping the ${plain} over to the ramp`);
        else await tripBoard(cargo);
        await tripTurnTo(b);
        state.moodTitle = label || `Riding the ${plain} up the ramp`;
        state.speechBubble = 'Slow and steady up the ramp...';
        renderAllUI();
        tripRig.ramp = { cargoId: cargo.id, from: foot, to: deck };
        tripSetRiding(cargo, 0.3);
        await tripReverse(cargo, deck, 0.9); // at a crawl, in a straight line up the ramp
        tripRig.ramp = null;
        state.riding = null; state.ridingSpeed = 1; state.ridingMode = null;
      }
      ts.loads[trailer.id] = cargo.id;
      Object.assign(cargo, { x: trailer.x, z: trailer.z, rotY: b });
      tripRampDown(trailer, false);
      const side = { x: trailer.x + Math.sin(b) * 2.2, z: trailer.z + Math.cos(b) * 2.2 };
      state.botPos = side; state.targetPos = { ...side };
      renderAllUI();
      await tripSleep(600);
    }

// Down the ramp and off, still in the seat (or floated off into the water)
async function tripUnload(cargo, trailer, waterAt = null) {
      const ts = tripStateNow(), plain = tripPlain(cargo.name).toLowerCase();
      const { foot, deck, b } = tripDeckPoints(cargo, trailer);
      delete ts.loads[trailer.id];
      if (waterAt) {
        state.moodTitle = `Floating the ${plain} off the trailer`;
        state.speechBubble = 'Unhook the winch strap... and off she floats.';
        renderAllUI();
        await tripSlide(cargo, deck, { x: waterAt.x, z: waterAt.z, y: WATER_LEVEL - 0.05 }, b, 3500);
        Object.assign(cargo, { x: waterAt.x, z: waterAt.z, rotY: b });
        renderVehicles3D();
        return;
      }
      tripRampDown(trailer, true);
      state.botPos = { x: deck.x, z: deck.z };
      tripSetRiding(cargo, 0.3);
      state.botRotY = b + Math.PI / 2;
      state.moodTitle = `Backing the ${plain} down the ramp`;
      state.speechBubble = 'Easy... easy... and down.';
      renderAllUI();
      tripRig.ramp = { cargoId: cargo.id, from: foot, to: deck };
      await tripReverse(cargo, foot, 0.9);
      tripRig.ramp = null;
      tripRampDown(trailer, false);
      Object.assign(cargo, { x: foot.x, z: foot.z, rotY: b });
      tripSetRiding(cargo);
    }

async function tripSlide(cargo, from, to, b, ms) {
      tripRig.slide = { cargoId: cargo.id, from, to, b, p: 0 };
      const t0 = performance.now();
      for (;;) {
        tripRig.slide.p = Math.min(1, (performance.now() - t0) / ms);
        if (tripRig.slide.p >= 1) break;
        await keloNextFrame();
      }
      tripRig.slide = null;
    }

async function tripStrap(trailer, on) {
      const rm = tripMesh(trailer), cargo = tripCargoOn(trailer);
      if (!rm || !rm.userData.straps) return;
      const straps = rm.userData.straps;
      if (!on) {
        state.speechBubble = 'Ratchets released, straps off.';
        renderAllUI();
        await tripSleep(1500);
        straps.visible = false;
        return;
      }
      while (straps.children.length) straps.remove(straps.children[0]);
      const u = rm.userData, box = cargo ? tripCargoBox(cargo) : { top: 1, bottom: 0 };
      const top = u.deckY + (box.top - box.bottom) * 0.8, half = (u.width || 2) / 2;
      [-0.28, 0.28].forEach(k => {
        const x = k * (u.deckLen || 4.8);
        straps.add(rod([x, u.deckY, -half], [x, top, -0.25], 0.035, 0xf97316));
        straps.add(rod([x, u.deckY, half], [x, top, 0.25], 0.035, 0xf97316));
        straps.add(rod([x, top, -0.25], [x, top, 0.25], 0.035, 0xf97316));
      });
      // He walks round both sides, hooking and ratcheting
      const b = trailer.rotY || 0;
      for (const sgn of [1, -1]) {
        await tripGoTo({ x: trailer.x + Math.sin(b) * 2.0 * sgn, z: trailer.z + Math.cos(b) * 2.0 * sgn }, 15000);
        state.speechBubble = sgn > 0 ? 'Hook it on the rail, over the top... click, click, click.' : 'And this side. Click, click, click. Tight.';
        renderAllUI();
        if (sgn > 0) straps.visible = true;
        await tripSleep(1600);
      }
    }

// The very first time he tries to ride a snowmobile across dry ground, it bogs down
async function tripBogDown(v, originLabel) {
      const ts = tripStateNow(), plain = tripPlain(v.name).toLowerCase();
      state.isPracticing = true;
      try {
        await tripBoard(v, `Trying to ride the ${plain} on dry ground`);
        state.speechBubble = "Let's go! Throttle on...";
        renderAllUI();
        tripSetRiding(v, 0.08);
        const a = v.rotY || 0;
        state.targetPos = { x: v.x + Math.cos(a) * 3, z: v.z - Math.sin(a) * 3 };
        await tripSleep(4500);
        state.targetPos = { ...state.botPos };
        state.moodEmoji = '😣';
        state.moodTitle = `The ${plain} bogged down`;
        state.speechBubble = `The track's just spinning and grinding on the gravel. It barely moved. A ${plain} is made for snow: on dry ground it bogs down and wrecks its track.`;
        renderAllUI();
        await tripSleep(6000);
        tripExitVehicle(v);
        ts.bogged.snowmobile = Date.now();
        state.diaryEntries.unshift({
          time: originLabel, location: currentPlaceLabel(), mood: `😣 The ${plain} bogged down`.slice(0, 80),
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I tried to ride the ${plain} out of the yard and it just ground into the gravel. Its track and skis need snow under them. If I want to ride it somewhere snowy, I have to get it there some other way.`
        });
        savePersistentBrainState();
      } finally {
        if (state.riding === v.id) tripExitVehicle(v);
        state.isPracticing = false;
      }
    }

// --- Taking a trip ----------------------------------------------------------------------------------
function tripBusy() {
      return state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping || state.isBrowsing;
    }

async function takeTrip(name, to = null, why = '', originLabel = 'Taking a Trip') {
      if (tripBusy()) return false;
      const ts = tripStateNow();
      const v = typeof name === 'object' && name ? name : findTripVehicle(name);
      if (!v) {
        tripSay(`trip:none:${String(name).toLowerCase()}`, `I don't have ${/^(an?|the|my)\s/i.test(String(name)) ? String(name).toLowerCase() : 'a ' + String(name).toLowerCase()} to take anywhere.`);
        return 'no-vehicle';
      }
      const plan = planTrip(v, to);
      const plain = tripPlain(v.name).toLowerCase();
      ts.last = { at: Date.now(), vehicle: v.name, to: plan.dest.label, ok: plan.ok, mode: plan.mode, why: (plan.ok ? plan.reasoning || `The ${plain} can get there by itself.` : plan.why).slice(0, 240) };
      if (!plan.ok) {
        if (tripSay(`trip:${plan.key}:no`, plan.why)) {
          state.diaryEntries.unshift({
            time: originLabel, location: currentPlaceLabel(), mood: `🤔 Not a trip for the ${plain}`.slice(0, 80),
            vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '', text: `Dear Diary, ${plan.why} I'll do something else instead.`
          });
        }
        if (typeof coolDownActivity === 'function') coolDownActivity(`trip:${plan.key}`);
        return 'cannot';
      }
      if (plan.mode === 'balloon') return typeof flyBalloon === 'function' ? flyBalloon(originLabel) : false;
      if (plan.mode === 'boat-dock') return goBoating(originLabel);
      // The first time, he finds out the hard way that a snowmobile won't go on dry ground
      if (plan.mode === 'haul' && plan.key === 'snowmobile' && !ts.bogged.snowmobile && !tripLoadOf(v) && !plan.learn.includes(v.name) && fuelLeft(v) > 0) {
        await tripBogDown(v, originLabel);
      }
      if (plan.missing.length) {
        if (!ts.researched[plan.key] && plan.mode === 'haul') await researchTransport(plan, originLabel);
        else tripSay(`trip:${plan.key}:need`, `${plan.reasoning || ''} I'm still waiting for ${plan.missing.map(m => m.item.replace(/^A /, 'a ')).join(', ').replace(/, ([^,]*)$/, ' and $1')}.`.trim());
        requestTripGear(plan);
        if (typeof coolDownActivity === 'function') coolDownActivity(`trip:${plan.key}`);
        renderAllUI();
        return 'waiting-for-gear';
      }
      if (plan.learn.length) {
        tripSay(`trip:${plan.key}:learn`, `Before I take the ${plain} anywhere, I want to know how to handle the ${tripPlain(plan.learn[0]).toLowerCase()}.`);
        await learnToUse(plan.learn[0], 'Learning Before a Trip');
        return 'learning';
      }
      for (const f of plan.fuel) {
        if (fuelLeft(f.v) >= f.need) continue;
        const fuel = fuelNeededBy(f.v), can = typeof fuelCanFor === 'function' ? fuelCanFor(fuel) : null, fp = tripPlain(f.v.name).toLowerCase();
        tripSay(`trip:fuel:${f.v.id}`, `The ${fp} has ${Math.round(fuelLeft(f.v))}% ${fuel} left, and this trip there and back takes about ${f.need}%. ${can ? "I'll fill it up first." : "I'll need more fuel first."}`);
        if (can && !(typeof activityCoolingDown === 'function' && activityCoolingDown('refuel:' + fuel))) {
          await refuelWith(can, 'Filling Up Before a Trip');
          if (fuelLeft(f.v) >= f.need) continue;
        } else if (!can) requestFuel(fuel, `I want to take the ${plain} ${plan.dest.label}, and the ${fp} doesn't have enough ${fuel} for the trip there and back.`);
        if (typeof coolDownActivity === 'function') coolDownActivity(`trip:${plan.key}`);
        return 'needs-fuel';
      }
      if (tripBusy()) return false;
      state.isPracticing = true;
      state.currentLocKey = 'custom';
      state.customPlaceName = plan.dest.label;
      state.moodEmoji = '🧭';
      try {
        if (plan.mode === 'haul' && !(await runHaulTrip(plan, why))) {
          if (typeof coolDownActivity === 'function') coolDownActivity(`trip:${plan.key}`);
          renderAllUI();
          return 'turned-back';
        }
        if (plan.mode === 'fly') await runFlyTrip(plan);
        else if (plan.mode !== 'haul') await runDirectTrip(plan);
        const skill = typeof skillCandidates === 'function' && skillCandidates().find(c => c.vehicle === v);
        if (skill && typeof gainSkill === 'function') gainSkill(skill.key, skill.label, 8);
        state.happiness = Math.min(100, state.happiness + 8);
        state.diaryEntries.unshift({
          time: originLabel, location: plan.dest.label, mood: `${plan.key === 'snowmobile' ? '🏂' : plan.key === 'boat' ? '🛶' : '🚚'} A real trip with the ${plain}`.slice(0, 80),
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: plan.mode === 'haul'
            ? `Dear Diary, ${plan.reasoning} So I did: hitched up the ${tripPlain(plan.trailer.name).toLowerCase()}, loaded the ${plain}, strapped it down, towed it with the ${tripPlain(plan.tow.name).toLowerCase()}, unloaded it ${plan.key === 'snowmobile' ? 'at the snow line and rode it on the snow' : plan.key === 'boat' ? 'into the water and rowed out' : 'and put it to work'}, then loaded it up and came home.${why ? ' ' + why : ''}`
            : `Dear Diary, I took the ${plain} ${plan.dest.label}. It could get there on its own ground the whole way.${why ? ' ' + why : ''}`
        });
        ts.trips = (ts.trips || 0) + 1;
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        if (state.riding) tripExitVehicle(state.vehicles.find(o => o.id === state.riding));
        tripRig.ramp = null; tripRig.slide = null;
        state.isPracticing = false;
        state.microPose = 'normal';
      }
    }

async function runDirectTrip(plan) {
      const v = plan.vehicle, plain = tripPlain(v.name).toLowerCase();
      const trailer = tripLoadOf(v);
      const home = trailer ? null : { x: v.x, z: v.z };
      if (trailer) { await tripStrap(trailer, false); await tripUnload(v, trailer); }
      const back = [...plan.route].reverse();
      await tripDrive(v, plan.route, `Riding the ${plain} ${plan.dest.label}`);
      state.speechBubble = plan.key === 'snowmobile' ? 'Woohoo! This is what it was made for.' : `Made it, all on the right ground for the ${plain}.`;
      renderAllUI();
      await tripSleep(2500);
      if (trailer) {
        await tripDrive(v, back.slice(1), `Riding the ${plain} back to its trailer`);
        await tripLoad(v, trailer);
        await tripStrap(trailer, true);
      } else {
        await tripDrive(v, [...back.slice(1), home], `Bringing the ${plain} home`);
        tripExitVehicle(v);
      }
    }

async function runFlyTrip(plan) {
      const v = plan.vehicle, home = { x: v.x, z: v.z };
      await driveVehicle(v, plan.landing, `Flying the ${tripPlain(v.name).toLowerCase()} ${plan.dest.label}`);
      await tripSleep(2500);
      await driveVehicle(v, home, `Flying the ${tripPlain(v.name).toLowerCase()} home`);
    }

async function runHaulTrip(plan) {
      const { vehicle: cargo, tow, trailer, key } = plan;
      const cp = tripPlain(cargo.name).toLowerCase(), tp = tripPlain(tow.name).toLowerCase(), trp = tripPlain(trailer.name).toLowerCase();
      const towHome = { x: tow.x, z: tow.z, rotY: tow.rotY || 0 };
      state.speechBubble = plan.reasoning;
      renderAllUI();
      await tripSleep(2500);
      // 1. Hitch up and load
      if (await tripHitchUp(tow, trailer) === false) {
        tripExitVehicle(tow);
        state.speechBubble = `I couldn't get the ${tp} lined up with the ${trp}. Something's in the way, so the trip will have to wait.`;
        return false;
      }
      if (tripLoadOf(cargo) !== trailer) {
        await tripLoad(cargo, trailer);
        await tripStrap(trailer, true);
      } else if (!(tripMesh(trailer) && tripMesh(trailer).userData.straps.visible)) await tripStrap(trailer, true);
      // 2. Tow it to where its own ground starts (the truck stays on its own ground)
      if (key === 'boat') {
        const L = BOAT_LAUNCH;
        await tripDrive(tow, [...plan.towRoute, { x: L.x, z: L.startZ }, { x: L.x, z: L.pullOutZ }], `Towing the ${cp} to the beach`);
        state.speechBubble = 'Now back it down the beach, slowly, until the boat floats.';
        renderAllUI();
        await tripTurnTo(Math.PI / 2);
        await tripReverse(tow, { x: L.x, z: L.backZ }, 1.0);
        tripExitVehicle(tow);
        await tripStrap(trailer, false);
        const rear = tripDeckPoints(cargo, trailer);
        await tripUnload(cargo, trailer, { x: rear.foot.x, z: Math.max(L.waterZ, rear.foot.z + 1) });
        // 3. Out on the water and back
        await driveVehicle(cargo, { x: plan.dest.x, z: Math.max(14, plan.dest.z) }, `Rowing the ${cp} out on the lake`);
        state.speechBubble = pick(['Launched from my own trailer! The lake is huge from out here.', 'No dock needed: I backed it right in.', 'The water is so calm today.']);
        renderAllUI();
        await tripSleep(2500);
        await driveVehicle(cargo, { x: rear.foot.x, z: Math.max(L.waterZ, rear.foot.z + 1) }, `Rowing the ${cp} back to the trailer`);
        state.riding = null; state.ridingSpeed = 1; state.ridingMode = null;
        state.botPos = { x: L.x + 2.2, z: 8.2 }; state.targetPos = { ...state.botPos };
        await tripLoad(cargo, trailer);
        await tripStrap(trailer, true);
        await tripDrive(tow, [{ x: L.x, z: L.pullOutZ }], `Pulling the ${cp} out of the water`);
      } else {
        await tripDrive(tow, plan.towRoute, `Towing the ${cp} on the ${trp}`);
        // Didn't make it to where its ground starts: don't unload it on the wrong ground, take it home
        if (Math.hypot(state.botPos.x - plan.drop.x, state.botPos.z - plan.drop.z) > 5) {
          state.speechBubble = `The ${tp} couldn't get through to ${key === 'snowmobile' ? 'the snow line' : 'the spot'} today. I'll take the ${cp} home and try another time.`;
          renderAllUI();
          await tripSleep(2500);
          plan.turnedBack = true;
        } else {
          state.speechBubble = key === 'snowmobile' ? "This is as far as the truck should go. The snow starts right here." : 'Here we are.';
          renderAllUI();
          tripExitVehicle(tow);
          await tripSleep(1200);
          await tripStrap(trailer, false);
          await tripUnload(cargo, trailer);
          // 3. Use it on its own ground, then back to the trailer
          const foot = { x: cargo.x, z: cargo.z };
          if (key === 'excavator') {
            await tripDrive(cargo, plan.cargoRoute.slice(1), 'Crawling the excavator to the work');
            const ex = tripMesh(cargo);
            state.moodTitle = 'Digging with the excavator';
            for (let i = 0; i < 4; i++) {
              if (ex && ex.userData.house) { ex.userData.house.rotation.y = i % 2 ? 1.0 : -0.4; if (ex.userData.boom) ex.userData.boom.rotation.z = i % 2 ? 0.9 : 0.4; }
              await tripSleep(1100);
            }
            if (ex && ex.userData.house) ex.userData.house.rotation.y = 0;
          } else {
            state.speechBubble = 'Woohoo! Snow under the track at last.';
            await tripDrive(cargo, plan.cargoRoute.length > 1 ? plan.cargoRoute.slice(1) : plan.cargoRoute, `Riding the ${cp} on the snow`);
            await tripSleep(2000);
            await tripDrive(cargo, [...plan.cargoRoute].reverse().slice(1), `Riding the ${cp} back to the trailer`);
          }
          await tripDrive(cargo, [foot], `Lining the ${cp} up with the ramp`);
          await tripLoad(cargo, trailer);
          await tripStrap(trailer, true);
        }
      }
      // 4. Home, unhitch, park the truck
      const hitchHome = (tripStateNow().hitch || {}).home || { x: towHome.x, z: towHome.z };
      const cells = tripGridNow(), here = tripCellAt(cells, tow.x, tow.z), there = tripCellAt(cells, hitchHome.x, hitchHome.z);
      tripAssumeChains = tripHasChains();
      const flood = tripFlood(cells, plan.towKey, [here]);
      tripAssumeChains = false;
      const back = tripSimplify(tripPathTo(cells, flood, there) || []);
      await tripDrive(tow, [...back, hitchHome], `Towing the ${cp} home`);
      tripExitVehicle(tow);
      tripUnhitch();
      state.speechBubble = `Unhitched. The ${cp} stays strapped on its ${trp} for next time.`;
      renderAllUI();
      await tripSleep(1200);
      await tripDrive(tow, [{ x: towHome.x, z: towHome.z }], `Parking the ${tp}`);
      tripExitVehicle(tow);
      tow.x = towHome.x; tow.z = towHome.z; tow.rotY = towHome.rotY;
      renderVehicles3D();
      return !plan.turnedBack;
    }

// --- Snow within reach? (cached: the skills list asks often) ---------------------------------------
let tripSnowCache = { at: 0, season: '', ok: false };
function snowmobileHasSnow(v) {
      const season = typeof currentSeason === 'function' ? currentSeason() : '';
      if (Date.now() - tripSnowCache.at < 60000 && tripSnowCache.season === season) return tripSnowCache.ok;
      let ok = false;
      try { ok = planTrip(v, 'mountain').ok; } catch (e) { ok = false; }
      tripSnowCache = { at: Date.now(), season, ok };
      return ok;
    }

// --- For his AI, and the Brain tab ------------------------------------------------------------------
function vehicleReadiness(v) {
      const key = vehicleKindKey(v.name);
      if (key && (key.includes('trailer') || key === 'lowboy')) { const c = tripCargoOn(v); return c ? `carrying the ${tripPlain(c.name).toLowerCase()}` : 'empty'; }
      const rule = typeof knowHowRule === 'function' && knowHowRule(v.name);
      if (rule && !state.knowHow[rule.key]) return 'needs know-how';
      if (typeof fuelNeededBy === 'function' && fuelNeededBy(v) && fuelLeft(v) <= 0) return 'empty tank';
      if (key === 'snowmobile' && !(typeof inSnow === 'function' && inSnow(v))) return 'no snow here: needs hauling';
      if (key === 'boat' && boatOnLand(v)) return 'on land: needs trailering to the water';
      return 'ready';
    }

function vehiclesSummaryForAI() {
      if (!state.vehicles.length) return 'none';
      return state.vehicles.map(v => {
        const fuel = typeof fuelNeededBy === 'function' && fuelNeededBy(v) ? `${Math.round(fuelLeft(v))}% ${fuelNeededBy(v)}` : 'no fuel needed';
        const cond = Number.isFinite(v.condition) ? `, condition ${Math.round(v.condition)}%` : '';
        const where = vehicleLocationLabel(v);
        return `${v.name} (${fuel}${cond}; ${/^(on|near|out|up|hitched) /.test(where) ? where : 'at ' + where}; ${vehicleReadiness(v)}; rule: ${terrainRuleText(v)})`;
      }).join('; ');
    }

function tripSummaryForAI() {
      const l = state.tripState && state.tripState.last;
      return l ? `last trip plan: ${l.vehicle} to ${l.to}: ${l.why}` : 'no trips planned yet';
    }

const tripsQueued = new Map(); // trips the AI asked for, waiting for him to be free (this session only)

// From an AI decision: "takeTrip": {"vehicle": ..., "to": ..., "why": ...}
function applyTripDecision(decision) {
      const t = decision && decision.takeTrip;
      if (!t || typeof t !== 'object' || !t.vehicle) return false;
      const v = findTripVehicle(String(t.vehicle).slice(0, 80));
      const key = v ? vehicleKindKey(v.name) : vehicleKindKey(String(t.vehicle));
      const k = `trip:${key || 'none'}`;
      // Already queued, or tried lately and still blocked: the same idea again changes nothing
      const cooling = () => typeof activityCoolingDown === 'function' && activityCoolingDown(k);
      if (cooling() || Date.now() - (tripsQueued.get(k) || 0) < 4 * 60 * 1000) return false;
      tripsQueued.set(k, Date.now());
      doWhenFree(() => {
        tripsQueued.delete(k);
        if (cooling()) return;
        return typeof tryActivity === 'function' ? tryActivity(k, () => takeTrip(v || String(t.vehicle), String(t.to || ''), String(t.why || '').slice(0, 200), 'Decided to Take a Trip')) : takeTrip(v || String(t.vehicle), t.to, t.why);
      });
      return true;
    }

function renderVehiclesList() {
      const el = document.getElementById('vehiclesListContainer');
      if (!el) return;
      const html = state.vehicles.length ? state.vehicles.map(v => {
        const key = vehicleKindKey(v.name);
        const fuel = typeof fuelNeededBy === 'function' && fuelNeededBy(v) ? Math.round(fuelLeft(v)) : null;
        const ready = vehicleReadiness(v);
        const ok = ready === 'ready' || ready.startsWith('carrying') || ready === 'empty';
        return `
        <div class="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-2xs text-slate-200 space-y-0.5">
          <div class="flex items-center gap-2">
            <span class="flex-1 font-semibold">${escapeHtml(v.name)}</span>
            <span class="${ok ? 'text-emerald-300' : 'text-amber-300'}">${escapeHtml(ready)}</span>
          </div>
          <div class="flex items-center gap-2 text-slate-400">
            ${fuel === null ? '<span>No fuel needed</span>' : `<span>⛽ ${fuel}%</span><span class="w-14 h-1.5 rounded bg-slate-700 overflow-hidden"><span class="block h-full ${fuel > 30 ? 'bg-emerald-400' : 'bg-rose-400'}" style="width:${fuel}%"></span></span>`}
            <span class="flex-1 text-right">📍 ${escapeHtml(vehicleLocationLabel(v))}</span>
          </div>
          <div class="text-slate-500">${escapeHtml(((VEHICLE_TERRAIN[key] || {}).text || '').replace(/^./, c => c.toUpperCase()))}</div>
        </div>`;
      }).join('') : '<div class="text-2xs text-slate-500 italic">No vehicles yet. He has to ask for each one.</div>';
      if (typeof perfSetHtml === 'function') perfSetHtml(el, html); else el.innerHTML = html;
    }

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    tripStateNow();
    // Trailers that arrived before this file existed get a spot in the trailer row
    state.vehicles.filter(v => trailerKindOf(v.name) && !TRAILER_SLOTS.some(([x, z]) => Math.hypot(v.x - x, v.z - z) < 5) && !(state.tripState.hitch && state.tripState.hitch.trailer === v.id)).forEach(parkNewTrailer);
    state.riding = null;
    renderVehicles3D();
    renderVehiclesList();
    setInterval(renderVehiclesList, 5000);
  }, 50);
});
