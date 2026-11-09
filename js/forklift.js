// Kelo-bot-1 — js/forklift.js
// Loaded after woodshop.js. An electric counterbalance forklift for his Workshop and hangar, with a
// wall charger and pallet racking.
//   - It is a vehicle like his others (VEHICLE_TYPES kind 'forklift'): he asks for it at the Post
//     Office (one of each, js/trips.js vehicleRequestCheck), learns to drive it first (GEAR_KNOWHOW,
//     a NetNode read), and it only drives on the Workshop's and hangar's floors and paved aprons
//     (VEHICLE_TERRAIN / tripCanStep).
//   - Its battery (vehicle.charge, 0-100) drains as it works; he drives it to the charger, plugs the
//     cable in, and it charges over time (the charger's bar shows it).
//   - Jobs: pick a pallet off the racking in the hangar (mast up, tilt back), carry it where it is
//     needed and set it down. It can ride the car elevator between floors like any vehicle.

const FORKLIFT_RE = /fork ?lift|lift truck/i;
// The charger and the pallet racking stand in the Workshop's north wing (WS_WING.spots, js/workshopbuilding.js)
const FORKLIFT_CHARGER = (() => {
  const S = WORKSHOP_SITE, c = WS_WING.spots.charger;
  return { x: S.x + c.x, z: S.z + c.z, park: { x: S.x + c.park.x, z: S.z + c.park.z }, flip: c.park.x > c.x };
})();
const PALLET_RACK = (() => {
  const S = WORKSHOP_SITE, r = WS_WING.spots.rack;
  return { x: S.x + r.x, z: S.z + r.z, w: r.w };
})();
const PALLET_GOODS = ['glass batch', 'maple lumber', 'aluminium sheet stock', 'a truck engine', 'machine parts'];

// --- The model -------------------------------------------------------------------------------------
function forkliftModel() {
      const b = group();
      const yellow = 0xf4b400, dark = 0x1f2937, grey = 0x6b7280;
      // Chassis and the heavy counterweight at the back (+x is forward, toward the forks)
      b.add(at(mesh(new THREE.BoxGeometry(1.9, 0.6, 1.25), yellow), 0, 0.55, 0));
      b.add(at(mesh(new THREE.BoxGeometry(0.55, 0.85, 1.25), dark), -0.95, 0.7, 0));
      // Battery compartment under the seat, with its plug
      b.add(at(mesh(new THREE.BoxGeometry(0.9, 0.35, 0.9), grey), -0.2, 1.0, 0));
      b.add(at(mesh(new THREE.BoxGeometry(0.12, 0.1, 0.18), 0xef4444), -0.75, 0.9, 0.55));
      // Seat, steering column and wheel
      b.add(at(mesh(new THREE.BoxGeometry(0.45, 0.12, 0.5), dark), -0.3, 1.25, 0));
      b.add(at(mesh(new THREE.BoxGeometry(0.1, 0.5, 0.5), dark), -0.52, 1.5, 0));
      b.add(at(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), dark), 0.25, 1.45, 0));
      const wheelRing = mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 16), dark);
      wheelRing.rotation.z = Math.PI / 2 - 0.5;
      b.add(at(wheelRing, 0.2, 1.72, 0));
      // Overhead guard: four posts and a grid roof
      [[0.45, -0.55], [0.45, 0.55], [-0.75, -0.55], [-0.75, 0.55]].forEach(([x, z]) => b.add(at(mesh(new THREE.BoxGeometry(0.07, 1.45, 0.07), dark), x, 1.55, z)));
      for (let i = 0; i < 5; i++) b.add(at(mesh(new THREE.BoxGeometry(1.25, 0.04, 0.05), dark), -0.15, 2.28, -0.5 + i * 0.25));
      // Warning beacon on the guard
      const beacon = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 12), 0xf59e0b, { emissive: 0xf59e0b, emissiveIntensity: 0.2 });
      b.add(at(beacon, -0.6, 2.38, 0));
      // Wheels
      [[0.55, 0.32], [-0.75, 0.26]].forEach(([x, r]) => [-0.6, 0.6].forEach(z => {
        const w = mesh(new THREE.CylinderGeometry(r, r, 0.22, 16), 0x111111);
        w.rotation.x = Math.PI / 2;
        w.userData.wheelRadius = r;
        w.userData.wheelAxis = 'y'; // its own axle is the cylinder's y (js/vehicles.js spins it)
        b.add(at(w, x, r, z));
      }));
      // The mast (tilts at its foot) with the carriage and forks that ride up it
      const mast = group();
      mast.position.set(1.05, 0.35, 0);
      [-0.38, 0.38].forEach(z => mast.add(at(mesh(new THREE.BoxGeometry(0.08, 2.4, 0.1), grey, { metalness: 0.6 }), 0, 1.2, z)));
      mast.add(at(mesh(new THREE.BoxGeometry(0.06, 0.06, 0.86), grey), 0, 2.38, 0));
      mast.add(at(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8), 0xcbd5e1, { metalness: 0.9 }), -0.06, 0.9, 0));
      const carriage = group();
      carriage.add(at(mesh(new THREE.BoxGeometry(0.06, 0.55, 0.9), dark), 0.07, 0.3, 0));
      [-0.25, 0.25].forEach(z => carriage.add(at(mesh(new THREE.BoxGeometry(1.1, 0.05, 0.12), dark), 0.6, 0.03, z)));
      const load = group();
      load.position.set(0.6, 0.06, 0);
      carriage.add(load);
      mast.add(carriage);
      b.add(mast);
      return miniature(b, { seat: { x: -0.3, y: 1.31 - (typeof KELO_SIT_OFFSET === 'number' ? KELO_SIT_OFFSET : 0.3), z: 0 }, mast, carriage, load, beacon });
    }

// A pallet with its load on it (in metres-ish units, like the forklift)
function palletModel(what) {
      const g = group();
      for (let i = 0; i < 5; i++) g.add(at(mesh(new THREE.BoxGeometry(1.2, 0.025, 0.14), 0xc89b62), 0, 0.14, -0.45 + i * 0.225));
      [-0.5, 0, 0.5].forEach(x => g.add(at(mesh(new THREE.BoxGeometry(0.12, 0.12, 1.0), 0xa47f55), x, 0.06, 0)));
      const w = String(what || '');
      if (/glass/.test(w)) for (let i = 0; i < 6; i++) g.add(at(mesh(new THREE.BoxGeometry(0.5, 0.2, 0.35), 0xe5e7eb), -0.3 + (i % 2) * 0.6, 0.27 + Math.floor(i / 2) * 0.2, 0));
      else if (/lumber/.test(w)) for (let i = 0; i < 4; i++) g.add(at(mesh(new THREE.BoxGeometry(1.15, 0.08, 0.9), 0xd9b27c), 0, 0.2 + i * 0.09, 0));
      else if (/sheet/.test(w)) g.add(at(mesh(new THREE.BoxGeometry(1.15, 0.2, 0.9), 0xc9ced4, { metalness: 0.8, roughness: 0.3 }), 0, 0.25, 0));
      else if (/engine/.test(w)) { g.add(at(mesh(new THREE.BoxGeometry(0.7, 0.5, 0.55), 0x1f2937), 0, 0.42, 0)); g.add(at(mesh(new THREE.BoxGeometry(0.5, 0.15, 0.35), 0xc62828), 0, 0.74, 0)); }
      else g.add(at(mesh(new THREE.BoxGeometry(1.0, 0.6, 0.8), 0x8a6a45), 0, 0.46, 0));
      return g;
    }

// --- It's a vehicle ------------------------------------------------------------------------------------
if (typeof VEHICLE_TYPES !== 'undefined' && !VEHICLE_TYPES.some(t => t.kind === 'forklift')) {
  VEHICLE_TYPES.unshift({ kind: 'forklift', re: FORKLIFT_RE, mode: 'land', speed: 0.9, scale: 2.6, seatY: 0.9 });
}
if (typeof VEHICLE_KIND_WORDS !== 'undefined') VEHICLE_KIND_WORDS.forklift = 'forklift';
if (typeof VEHICLE_TERRAIN !== 'undefined') VEHICLE_TERRAIN.forklift = { max: 0.12, text: 'indoor floors and paved yards only: the Workshop, the hangar and their aprons' };
if (typeof tripCanStep === 'function') {
  const baseTripCanStep = tripCanStep;
  tripCanStep = function (key, a, b) {
    if (key === 'forklift') {
      const grade = Math.abs(b.h - a.h) / Math.max(0.01, Math.hypot(b.x - a.x, b.z - a.z));
      return !b.water && grade <= 0.12 && typeof inWorkshopSite === 'function' && inWorkshopSite(b.x, b.z, 0.5);
    }
    return baseTripCanStep(key, a, b);
  };
}
if (typeof parkingSlotsFor === 'function') {
  const baseParkingSlots = parkingSlotsFor;
  parkingSlotsFor = function (type, name) {
    if (type && type.kind === 'forklift') return [[FORKLIFT_CHARGER.park.x, FORKLIFT_CHARGER.park.z]];
    return baseParkingSlots(type, name);
  };
}
if (typeof GEAR_KNOWHOW !== 'undefined' && !GEAR_KNOWHOW.some(r => r.key === 'forklift')) {
  GEAR_KNOWHOW.push({ key: 'forklift', re: FORKLIFT_RE, label: 'a forklift', wiki: 'Forklift',
    how: 'Seat belt on, forks low while driving, tilt back to carry, look where you are going, never lift with the mast tilted forward; charge the battery when the gauge is low.' });
}
if (typeof ITEM_MODEL_RULES !== 'undefined') ITEM_MODEL_RULES.unshift([/fork ?lift|lift truck/, () => forkliftModel()]);

function theForklift() {
      return (state.vehicles || []).find(v => FORKLIFT_RE.test(v.name)) || null;
    }

function forkliftCharge(v) {
      if (!Number.isFinite(v.charge)) v.charge = 80;
      return v.charge;
    }

// --- The charger and the racking (in the hangar) -------------------------------------------------------
let forkliftChargerGroup = null;
function buildForkliftCharger3D() {
      if (forkliftChargerGroup || !scene) return;
      const g = forkliftChargerGroup = new THREE.Group();
      const C = FORKLIFT_CHARGER, y = (typeof WORKSHOP_PAD_Y !== 'undefined' ? WORKSHOP_PAD_Y : 0) + 0.12;
      g.position.set(C.x, y, C.z);
      g.userData.isWorkshop = true;
      // (it stands against a west wall, facing east, when its parking box is east of it)
      if (C.flip) g.rotation.y = Math.PI;
      const sgn = C.flip ? -1 : 1;
      mmBox(g, 0.25, 0.8, 0.55, 'navy', 0, 1.0, 0);
      const bar = mmBox(g, 0.02, 0.5, 0.08, mmGlow('window'), -0.13, 1.15, 0.15);
      bar.material.emissive.setHex(0x22c55e);
      mmLabel(g, 'CHARGER  48 V', 0.5, 0.1, -0.13, 1.7, 0, { bg: '#1e3a5f', fg: '#fff', ry: -Math.PI / 2 });
      const cable = mmRod(g, [-0.13, 1.0, -0.1], [-0.4, 0.3, -0.1], 0.02, 'black');
      const plug = mmBox(g, 0.12, 0.1, 0.16, 'red', -0.42, 0.25, -0.1);
      // Parking box on the floor
      const P = { x: sgn * (C.park.x - C.x), z: sgn * (C.park.z - C.z) };
      [[0, -1.0, 2.6, 0.08], [0, 1.0, 2.6, 0.08], [-1.3, 0, 0.08, 2.0], [1.3, 0, 0.08, 2.0]].forEach(([dx, dz, w, d]) => mmBox(g, w, 0.01, d, 'stripe', P.x + dx, 0.006, P.z + dz));
      mmLabel(g, 'FORKLIFT CHARGING', 1.6, 0.3, P.x, 0.02, P.z + 0.6, { bg: '#b9bab5', fg: '#1d4ed8' }).rotation.x = -Math.PI / 2;
      g.userData = { bar, cable, plug };
      // Pallet racking along the hangar's back wall, two levels of pallets
      const r = PALLET_RACK;
      const rack = mmGroup(g, sgn * (r.x - C.x), 0, sgn * (r.z - C.z));
      rack.rotation.y = C.flip ? Math.PI : 0;
      [0.15, 1.6].forEach(yy => mmBox(rack, r.w, 0.12, 1.1, 'orange', 0, yy, 0));
      const bays = Math.max(1, Math.floor(r.w / 2.0));
      for (let i = 0; i <= bays; i++) mmBox(rack, 0.1, 3.4, 1.1, 'blue', -r.w / 2 + i * r.w / bays, 0, 0);
      PALLET_GOODS.forEach((what, i) => { if (i < bays) { const p = palletModel(what); p.scale.setScalar(1.3); p.position.set(-r.w / 2 + r.w / bays * (i + 0.5), 1.72, 0); rack.add(p); } });
      mmLabel(rack, 'PALLET RACKING', 1.4, 0.25, 0, 3.0, 0.56, { bg: '#ea580c', fg: '#fff' });
      g.userData.rack = rack;
      scene.add(g);
      worldObstacles.push({ x: r.x - r.w / 4, z: r.z, r: 0.9, workshop: true }, { x: r.x + r.w / 4, z: r.z, r: 0.9, workshop: true }, { x: C.x, z: C.z, r: 0.4, workshop: true });
      setInterval(forkliftChargeTick, 5000);
    }

function forkliftChargerShow(v) {
      const u = forkliftChargerGroup && forkliftChargerGroup.userData;
      if (!u) return;
      const c = forkliftCharge(v) / 100;
      u.bar.scale.y = Math.max(0.05, c);
      u.bar.material.emissive.setHSL(0.33 * c, 0.9, 0.45);
      u.bar.material.emissiveIntensity = v.plugged ? 1.2 : 0.4;
      u.plug.visible = !v.plugged;
    }

// Plugged in: it charges a little every few seconds (about 8 minutes from flat to full)
function forkliftChargeTick() {
      const v = theForklift();
      if (!v) return;
      if (v.plugged) v.charge = Math.min(100, forkliftCharge(v) + 1);
      forkliftChargerShow(v);
      const m = typeof vehicleMeshes !== 'undefined' && vehicleMeshes[v.id];
      if (m && m.userData.beacon) m.userData.beacon.material.emissiveIntensity = state.riding === v.id ? (Date.now() % 1000 < 500 ? 1.5 : 0.2) : 0.2;
    }

// --- Jobs -------------------------------------------------------------------------------------------
let forkliftBusy = false;

async function forkliftAnim(ms, fn) {
      const start = Date.now();
      for (;;) {
        const k = Math.min(1, (Date.now() - start) / ms);
        fn(k);
        if (k >= 1) return;
        await new Promise(r => setTimeout(r, 30));
      }
    }

// Mast: height of the forks (0..2) and tilt (radians, + back)
function forkliftMast(v, h, tilt) {
      const m = vehicleMeshes[v.id];
      if (!m || !m.userData.carriage) return;
      m.userData.carriage.position.y = h;
      m.userData.mast.rotation.z = tilt;
    }

async function forkliftToCharger(v, label = 'Charging the forklift') {
      if (typeof driveVehicle === 'function') await driveVehicle(v, { x: FORKLIFT_CHARGER.park.x, z: FORKLIFT_CHARGER.park.z }, 'Driving the forklift to its charger');
      state.moodEmoji = '🔌';
      state.moodTitle = label;
      state.speechBubble = `Battery at ${Math.round(forkliftCharge(v))}%. Plugging it in.`;
      v.plugged = true;
      forkliftChargerShow(v);
      renderAllUI();
      if (typeof gainSkill === 'function') gainSkill('vehicle-forklift', 'Driving the forklift', 1);
      savePersistentBrainState();
    }

// Take a pallet off the racking and set it down where it's needed (the assembly bay by default)
async function forkliftMovePallet(what = null, to = null, originLabel = 'Moving a Pallet') {
      const v = theForklift();
      if (!v || forkliftBusy || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      if (typeof readyToOperate === 'function' && !readyToOperate(v.name, v)) return 'learning';
      if (forkliftCharge(v) < 15) { await forkliftToCharger(v, 'The forklift needs charging first'); return 'charging'; }
      forkliftBusy = true;
      state.isPracticing = true;
      what = what || PALLET_GOODS[Math.floor(Math.random() * PALLET_GOODS.length)];
      const bay = typeof workshopAssemblyBay === 'function' ? workshopAssemblyBay() : { x: 34.6, z: -15 };
      to = to || { x: bay.x + 4, z: bay.z + 3.5 };
      try {
        v.plugged = false;
        forkliftChargerShow(v);
        state.moodEmoji = '🏗️';
        state.moodTitle = `Fetching a pallet of ${what} with the forklift`.slice(0, 80);
        state.speechBubble = 'Beacon on, forks low, looking where I drive.';
        renderAllUI();
        const r = PALLET_RACK;
        await driveVehicle(v, { x: r.x, z: r.z + 3.0 }, 'Driving the forklift to the racking');
        const m = vehicleMeshes[v.id];
        if (m) { m.rotation.y = Math.PI / 2; } // forks toward the rack
        state.moodTitle = `Lifting the pallet of ${what} off the racking`.slice(0, 80);
        renderAllUI();
        await forkliftAnim(2500, k => forkliftMast(v, k * 1.65, 0));
        const pallet = palletModel(what);
        if (m && m.userData.load) { m.userData.load.add(pallet); }
        await forkliftAnim(1200, k => forkliftMast(v, 1.65 + k * 0.05, k * 0.08));
        await forkliftAnim(2200, k => forkliftMast(v, 1.7 - k * 1.55, 0.08));
        state.moodTitle = `Carrying the pallet of ${what} on the forklift`.slice(0, 80);
        renderAllUI();
        await driveVehicle(v, to, `Carrying a pallet of ${what}`);
        state.moodTitle = `Setting the pallet of ${what} down`.slice(0, 80);
        renderAllUI();
        await forkliftAnim(1600, k => forkliftMast(v, 0.15 - k * 0.15, 0.08 * (1 - k)));
        const m2 = vehicleMeshes[v.id];
        if (m2 && pallet.parent) {
          const wp = pallet.getWorldPosition(new THREE.Vector3());
          pallet.parent.remove(pallet);
          pallet.position.copy(wp);
          pallet.scale.setScalar(1.3);
          scene.add(pallet);
          (state.workshop.pallets = state.workshop.pallets || []).unshift({ what, x: wp.x, z: wp.z, at: Date.now() });
          if (state.workshop.pallets.length > 6) state.workshop.pallets.length = 6;
        }
        v.charge = Math.max(0, forkliftCharge(v) - 12);
        if (typeof gainSkill === 'function') gainSkill('vehicle-forklift', 'Driving the forklift', 4);
        state.speechBubble = `Pallet of ${what} delivered. Battery at ${Math.round(v.charge)}%.`;
        if (v.charge < 30) await forkliftToCharger(v);
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        forkliftBusy = false;
        state.isPracticing = false;
      }
    }

function forkliftChance() {
      const v = theForklift();
      if (!v || forkliftBusy) return 0;
      return forkliftCharge(v) < 15 && !v.plugged ? 0.3 : 0.04;
    }

function forkliftOnMyOwn() {
      const v = theForklift();
      if (!v) return false;
      if (forkliftCharge(v) < 15 && !v.plugged) return forkliftToCharger(v);
      if (Math.random() < 0.35) return forkliftDeliverUpstairs(Math.random() < 0.5 ? 2 : 3, PALLET_GOODS[Math.floor(Math.random() * PALLET_GOODS.length)]);
      return forkliftMovePallet();
    }

// Asking for one once the Workshop is up and he has heavy things to move
function forkliftWanted() {
      if (theForklift() || typeof addItemRequest !== 'function') return false;
      if (!state.workshop || (state.workshop.jobs || 0) < 3) return false;
      addItemRequest('An electric workshop forklift', 'vehicle', 'Pallets of lumber, glass batch and sheet stock are too heavy to carry by hand around my Workshop.', 'Workshop');
      return true;
    }

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { try { buildForkliftCharger3D(); const v = theForklift(); if (v) forkliftChargerShow(v); } catch (e) { console.warn('forklift', e); } }, 50);
});

// Take a pallet up to another floor of the Workshop: down the lane, onto the car elevator, up, and back
async function forkliftDeliverUpstairs(floor = 3, what = 'glass batch') {
      const v = theForklift();
      if (!v || forkliftBusy || typeof goIntoWorkshop !== 'function') return false;
      if (typeof readyToOperate === 'function' && !readyToOperate(v.name, v)) return 'learning';
      if (forkliftCharge(v) < 25) { await forkliftToCharger(v, 'The forklift needs charging first'); return 'charging'; }
      forkliftBusy = true;
      try {
        v.plugged = false;
        const m = vehicleMeshes[v.id];
        const pallet = palletModel(what);
        if (m && m.userData.load) m.userData.load.add(pallet);
        forkliftMast(v, 0.15, 0.08);
        state.moodEmoji = '🏗️';
        state.moodTitle = `Taking a pallet of ${what} up to floor ${floor} on the forklift`.slice(0, 80);
        renderAllUI();
        const r = await goIntoWorkshop({ vehicle: v, vehicleTour: [floor, 1], stops: [] });
        if (pallet.parent) pallet.parent.remove(pallet);
        v.charge = Math.max(0, forkliftCharge(v) - 15);
        state.speechBubble = `Pallet of ${what} delivered to floor ${floor}. Battery at ${Math.round(v.charge)}%.`;
        if (typeof gainSkill === 'function') gainSkill('vehicle-forklift', 'Driving the forklift', 4);
        // back to the hangar, and onto the charger if it's getting low
        if (v.charge < 30) await forkliftToCharger(v);
        savePersistentBrainState();
        renderAllUI();
        return Boolean(r);
      } finally {
        forkliftBusy = false;
      }
    }
