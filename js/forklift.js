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
// The model is drawn in metres; at 1.6 units a metre (lifeSize) a real counterbalance truck is this
// much bigger than its model: the overhead guard about 2.15 m high, so Kelo-1 sits under it.
const FORKLIFT_SCALE = 1.5;
const FORKLIFT_RACK_Y = 2.4;      // the racking's upper beam (world units, about 1.5 m)
const FORKLIFT_PICK_H = 1.35;     // carriage height (model units) that puts the forks into that level's pallets
const PALLET_GOODS = ['glass batch', 'maple lumber', 'aluminium sheet stock', 'a truck engine', 'machine parts'];

// --- The model -------------------------------------------------------------------------------------
function forkliftModel() {
      const b = group();
      // Chassis with rounded corners, the cast counterweight at the back with its tow pin and lamps
      // (+x is forward, toward the forks)
      mmRBox(b, 1.9, 0.55, 1.25, 'yellow', 0, 0.28, 0, { r: 0.08 });
      mmRBox(b, 0.55, 0.85, 1.25, 'anthracite', -0.95, 0.28, 0, { r: 0.12 });
      mmBox(b, 0.05, 0.08, 0.5, 'black', -1.22, 0.45, 0);
      mmCyl(b, 0.04, 0.12, 'steel', -1.25, 0.5, 0);
      [-0.45, 0.45].forEach(z => { mmBox(b, 0.03, 0.08, 0.14, mmMat('lampRed'), -1.225, 0.95, z); mmBox(b, 0.04, 0.1, 0.12, mmMat('lampAmber'), 0.96, 0.75, z * 1.15); });
      mmBox(b, 1.7, 0.03, 1.27, 'black', 0, 0.82, 0);
      // Step and grab handle on each side, the floor plate and pedals
      [-1, 1].forEach(s => { mmBox(b, 0.4, 0.04, 0.12, 'castIron', 0.2, 0.3, s * 0.66); mmBox(b, 0.3, 0.02, 0.11, 'black', 0.2, 0.34, s * 0.66); });
      mmBox(b, 0.5, 0.02, 0.9, 'castIron', 0.3, 0.83, 0);
      [-0.15, 0.15].forEach(z => mmBox(b, 0.1, 0.03, 0.08, 'black', 0.5, 0.86, z, { rz: 0.4 }));
      // Battery hood under the seat, with its plug on the side
      mmRBox(b, 0.9, 0.35, 0.95, 'anthracite', -0.2, 0.83, 0, { r: 0.05 });
      mmBox(b, 0.12, 0.1, 0.18, 'red', -0.75, 0.85, 0.6);
      // Suspension seat with its backrest and hip restraints, the steering column, wheel and spinner knob
      mmRBox(b, 0.45, 0.12, 0.5, 'plasticDark', -0.3, 1.19, 0, { r: 0.05 });
      mmRBox(b, 0.12, 0.5, 0.5, 'plasticDark', -0.52, 1.25, 0, { r: 0.05 });
      [-1, 1].forEach(s => mmRBox(b, 0.3, 0.12, 0.05, 'plasticDark', -0.35, 1.28, s * 0.24, { r: 0.02 }));
      mmRBox(b, 0.18, 0.4, 0.5, 'anthracite', 0.4, 0.83, 0, { r: 0.04 });
      mmRBox(b, 0.2, 0.12, 0.35, 'plasticDark', 0.42, 1.23, 0, { r: 0.03 });
      mmBox(b, 0.08, 0.03, 0.12, mmHmiMat(), 0.44, 1.3, 0.0, { rz: 0.5 });
      mmCyl(b, 0.03, 0.55, 'plasticDark', 0.25, 1.45, 0, { rz: -0.5 });
      const wheelRing = mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 16), 0x16181b);
      wheelRing.material = mmMat('rubber');
      wheelRing.rotation.z = Math.PI / 2 - 0.5;
      b.add(at(wheelRing, 0.2, 1.72, 0));
      mmCyl(b, 0.02, 0.06, 'plasticDark', 0.16, 1.82, 0.12, { rz: -0.5 });
      // Hydraulic levers
      for (let i = 0; i < 3; i++) { mmCyl(b, 0.008, 0.15, 'steel', 0.5, 1.33, 0.3 + i * 0.05, { rz: -0.3 }); mmSphere(b, 0.02, 'plasticDark', 0.48, 1.4, 0.3 + i * 0.05); }
      // Overhead guard: four tube posts and a slatted roof with work lights
      [[0.45, -0.55], [0.45, 0.55], [-0.75, -0.55], [-0.75, 0.55]].forEach(([x, z]) => mmCyl(b, 0.04, 1.45, 'black', x, 1.55, z, { rz: x > 0 ? -0.08 : 0 }));
      mmRBox(b, 1.35, 0.06, 1.2, 'black', -0.15, 2.22, 0, { r: 0.03 });
      for (let i = 0; i < 5; i++) mmBox(b, 1.2, 0.02, 0.05, 'blackAnod', -0.15, 2.29, -0.5 + i * 0.25);
      [-0.4, 0.4].forEach(z => mmBox(b, 0.04, 0.08, 0.12, mmMat('lampAmber'), 0.53, 2.2, z));
      // Warning beacon on the guard
      const beacon = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 12), 0xf59e0b, { emissive: 0xf59e0b, emissiveIntensity: 0.2 });
      b.add(at(beacon, -0.6, 2.38, 0));
      mmCyl(b, 0.075, 0.02, 'black', -0.6, 2.31, 0);
      // Wheels: solid tyres on steel rims (the drive tyres at the front, the steer tyres at the back)
      [[0.55, 0.32], [-0.75, 0.26]].forEach(([x, r]) => [-0.6, 0.6].forEach(z => {
        const w = mesh(new THREE.CylinderGeometry(r, r, 0.22, 20), 0x111111);
        w.material = mmMat('tire');
        w.rotation.x = Math.PI / 2;
        w.userData.wheelRadius = r;
        w.userData.wheelAxis = 'y'; // its own axle is the cylinder's y (js/vehicles.js spins it)
        mmCyl(w, r * 0.62, 0.23, 'grey', 0, 0, 0);
        mmCyl(w, r * 0.25, 0.24, 'steel', 0, 0, 0);
        b.add(at(w, x, r, z));
      }));
      [-1, 1].forEach(s => mmRBox(b, 0.75, 0.06, 0.24, 'anthracite', 0.55, 0.62, s * 0.6, { r: 0.03 }));
      // The mast (tilts at its foot): two channels, the cross members, the lift cylinder and chains;
      // the carriage with its backrest grille and forks rides up it
      const mast = group();
      mast.position.set(1.05, 0.35, 0);
      [-0.38, 0.38].forEach(z => {
        mast.add(at(mesh(new THREE.BoxGeometry(0.08, 2.4, 0.1), 0x6b7280, { metalness: 0.6 }), 0, 1.2, z));
        mmBox(mast, 0.06, 2.3, 0.04, 'castIron', 0.02, 0.05, z - Math.sign(z) * 0.07);
        mmBox(mast, 0.01, 2.0, 0.03, 'steel', 0.03, 0.3, z * 0.55);
      });
      mast.children.forEach(c => { if (c.material && !c.material.userData.shared) c.material = mmMat('castIron'); });
      [0.05, 1.2, 2.38].forEach(y => mmBox(mast, 0.06, 0.06, 0.86, 'castIron', 0, y, 0));
      mmCyl(mast, 0.05, 1.6, 'chrome', -0.06, 0.9, 0);
      mmCyl(mast, 0.07, 0.9, 'castIron', -0.06, 0.45, 0);
      mmCable(mast, [[-0.03, 1.8, 0.12], [0.0, 1.0, 0.18], [0.02, 0.4, 0.15]], 0.012, 'rubber');
      const carriage = group();
      mmBox(carriage, 0.06, 0.55, 0.9, 'anthracite', 0.07, 0.03, 0);
      for (let i = 0; i < 6; i++) mmBox(carriage, 0.03, 0.5, 0.03, 'black', 0.08, 0.58, -0.36 + i * 0.144);
      mmBox(carriage, 0.03, 0.03, 0.9, 'black', 0.08, 1.08, 0);
      [-0.25, 0.25].forEach(z => {
        mmBox(carriage, 1.1, 0.05, 0.12, 'castIron', 0.6, 0.005, z);
        mmBox(carriage, 0.05, 0.4, 0.12, 'castIron', 0.1, 0.03, z);
        mmBox(carriage, 0.05, 0.02, 0.13, 'stripe', 1.12, 0.02, z);
      });
      const load = group();
      load.position.set(0.6, 0.06, 0);
      carriage.add(load);
      mast.add(carriage);
      b.add(mast);
      b.traverse(o => { if (o.isMesh) o.castShadow = true; });
      b.scale.setScalar(FORKLIFT_SCALE);
      const F = FORKLIFT_SCALE;
      const fl = miniature(b, { seat: { x: -0.3 * F, y: 1.31 * F - (typeof KELO_SIT_OFFSET === 'number' ? KELO_SIT_OFFSET : 0.3), z: 0 }, mast, carriage, load, beacon });
      if (typeof machineMergeStatic === 'function') machineMergeStatic(fl);
      return fl;
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
  VEHICLE_TYPES.unshift({ kind: 'forklift', re: FORKLIFT_RE, mode: 'land', speed: 0.9, scale: FORKLIFT_SCALE, seatY: 1.67 });
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
      // Wall-mounted charger cabinet: rounded case, cooling louvres, the charge bar, status lamps, the
      // mains conduit up the wall and the charging lead coiled on its hook
      mmRBox(g, 0.25, 0.8, 0.55, 'lightGrey', 0, 1.0, 0, { r: 0.03 });
      mmRBox(g, 0.03, 0.6, 0.3, 'anthracite', -0.13, 1.1, 0.08, { r: 0.008 });
      const bar = mmBox(g, 0.02, 0.5, 0.08, mmGlow('window'), -0.13, 1.15, 0.15);
      bar.material.emissive.setHex(0x22c55e);
      mmVents(g, 0.18, 0.2, -0.126, 1.25, -0.15, { ry: -Math.PI / 2, n: 5 });
      [['lampGreen', -0.15], ['lampAmber', -0.08]].forEach(([m, z]) => mmCyl(g, 0.014, 0.02, m, -0.13, 1.7, z, { axis: 'x' }));
      mmBox(g, 0.05, 1.6, 0.05, 'steel', 0.08, 1.8, -0.2);
      mmCyl(g, 0.012, 0.4, 'steel', -0.2, 0.85, -0.1, { axis: 'x' });
      const cable = mmCable(g, [[-0.13, 1.0, -0.1], [-0.3, 0.7, -0.05], [-0.25, 0.85, -0.12], [-0.4, 0.4, -0.1], [-0.42, 0.32, -0.1]], 0.02, 'rubber');
      const plug = mmRBox(g, 0.12, 0.1, 0.16, 'red', -0.42, 0.25, -0.1, { r: 0.02 });
      // Parking box on the floor
      const P = { x: sgn * (C.park.x - C.x), z: sgn * (C.park.z - C.z) };
      [[0, -1.25, 4.0, 0.08], [0, 1.25, 4.0, 0.08], [-2.0, 0, 0.08, 2.5], [2.0, 0, 0.08, 2.5]].forEach(([dx, dz, w, d]) => mmBox(g, w, 0.01, d, 'stripe', P.x + dx, 0.006, P.z + dz));
      mmLabel(g, 'FORKLIFT CHARGING', 1.6, 0.3, P.x, 0.02, P.z + 0.6, { bg: '#b9bab5', fg: '#1d4ed8' }).rotation.x = -Math.PI / 2;
      g.userData = { bar, cable, plug };
      // Pallet racking along the hangar's back wall, two levels of pallets
      const r = PALLET_RACK;
      const rack = mmGroup(g, sgn * (r.x - C.x), 0, sgn * (r.z - C.z));
      rack.rotation.y = C.flip ? Math.PI : 0;
      [0.15, FORKLIFT_RACK_Y].forEach(yy => mmBox(rack, r.w, 0.12, 1.1, 'orange', 0, yy, 0));
      const bays = Math.max(1, Math.floor(r.w / 2.0));
      for (let i = 0; i <= bays; i++) mmBox(rack, 0.1, 3.9, 1.1, 'blue', -r.w / 2 + i * r.w / bays, 0, 0);
      PALLET_GOODS.forEach((what, i) => { if (i < bays) { const p = palletModel(what); p.scale.setScalar(FORKLIFT_SCALE); p.position.set(-r.w / 2 + r.w / bays * (i + 0.5), FORKLIFT_RACK_Y + 0.06, 0); rack.add(p); } });
      mmLabel(rack, 'PALLET RACKING', 1.4, 0.25, 0, 3.6, 0.56, { bg: '#ea580c', fg: '#fff' });
      g.userData.rack = rack;
      if (typeof machineMergeStatic === 'function') machineMergeStatic(g);
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
        await keloNextFrame();
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
const forkliftPlacedPallets = [];
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
        const H = FORKLIFT_PICK_H;
        await forkliftAnim(2500, k => forkliftMast(v, k * H, 0));
        const pallet = palletModel(what);
        if (m && m.userData.load) { m.userData.load.add(pallet); }
        await forkliftAnim(1200, k => forkliftMast(v, H + k * 0.05, k * 0.08));
        await forkliftAnim(2200, k => forkliftMast(v, H + 0.05 - k * (H - 0.1), 0.08));
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
          pallet.scale.setScalar(FORKLIFT_SCALE);
          scene.add(pallet);
          // Only the last few pallets stay on the floor (the same 6 the save keeps); older ones are taken away
          forkliftPlacedPallets.unshift(pallet);
          while (forkliftPlacedPallets.length > 6) { const old = forkliftPlacedPallets.pop(); if (old.parent) old.parent.remove(old); }
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
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping || state.isCollectingMail) return false;
      if (typeof readyToOperate === 'function' && !readyToOperate(v.name, v)) return 'learning';
      if (forkliftCharge(v) < 25) { await forkliftToCharger(v, 'The forklift needs charging first'); return 'charging'; }
      forkliftBusy = true;
      // Busy for the whole trip, like forkliftMovePallet, so his life tick doesn't send him off mid-tour
      state.isPracticing = true;
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
        state.isPracticing = false;
      }
    }
