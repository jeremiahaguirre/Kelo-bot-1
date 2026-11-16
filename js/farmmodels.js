// Kelo-bot-1 — js/farmmodels.js
// Loaded after farmland.js. The farm's 3D models, all at real size (1.6 units = 1 m) and in an
// original livery (teal-blue machines with cream wheels, a red board barn, galvanized steel):
//   - buildings in their build stages (foundation = his concrete pour, js/plantmodels.js; then frame,
//     walls, roof), each stage revealed part by part as he works; finished ones are joined per material
//   - machines (vehicles, js/vehicles.js): the row-crop tractor, the big 4WD tractor, the combine
//     harvester and the grain truck (+x forward, seat for Kelo-1, wheels that roll)
//   - implements that follow the tractor's hitch: plough, disc harrow, seed drill, sprayer (booms fold
//     out), fertilizer spreader (spinners), grain cart (auger swings out), the combine's draper header
//     (reel turns), and the flour mill in the workshop corner
//   - crops: one instanced mesh per field (and one for its weeds), a model per crop and growth stage,
//     swaying in the wind (js/realism.js foliageSwayShader); one soil mesh per field showing each pass

const farmMatCache = new Map();
function farmMat(hex, o = {}) {
      const key = hex + JSON.stringify(o);
      if (!farmMatCache.has(key)) farmMatCache.set(key, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.6, metalness: 0.05, ...o }));
      return farmMatCache.get(key);
    }
const FARM_PAINT = {
      body: 0x1d6a86, bodyDark: 0x154d62, cream: 0xe7dcc0, tyre: 0x17181b, steel: 0x9aa4ab, galv: 0xb9c0c4, dark: 0x262b30,
      glass: 0x9fc4d8, red: 0x9e2b25, white: 0xf1ede4, roof: 0x4b5157, wood: 0x8a6a48, concrete: 0xc9c5bc, yellow: 0xe0a92a
    };
function fBox(w, h, d, mat, x, y, z, parent) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
      if (parent) parent.add(m);
      return m;
    }
function fCyl(rt, rb, h, seg, mat, x, y, z, parent, rot) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
      if (rot === 'x') m.rotation.x = Math.PI / 2; else if (rot === 'z') m.rotation.z = Math.PI / 2;
      if (parent) parent.add(m);
      return m;
    }
function fRod(a, b, r, mat, parent) {
      const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), dir = to.clone().sub(from);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 8), mat);
      m.position.copy(from).add(to).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      m.castShadow = true;
      if (parent) parent.add(m);
      return m;
    }
// A tyre with a cream rim, axle along z; userData.wheelRadius so js/vehicles.js rolls it
function fWheel(r, w, lugs = true) {
      const g = new THREE.Group();
      fCyl(r, r, w, 24, farmMat(FARM_PAINT.tyre, { roughness: 0.95 }), 0, 0, 0, g, 'x');
      fCyl(r * 0.62, r * 0.62, w + 0.03, 18, farmMat(FARM_PAINT.cream, { roughness: 0.4, metalness: 0.3 }), 0, 0, 0, g, 'x');
      fCyl(r * 0.18, r * 0.22, w + 0.1, 10, farmMat(FARM_PAINT.dark, { metalness: 0.6 }), 0, 0, 0, g, 'x');
      if (lugs) for (let i = 0; i < 18; i++) {
        const a = i / 18 * Math.PI * 2, lug = fBox(0.12, 0.09, w * 0.95, farmMat(FARM_PAINT.tyre, { roughness: 0.95 }), Math.cos(a) * r, Math.sin(a) * r, 0, g);
        lug.rotation.z = a + 0.5;
      }
      g.userData.wheelRadius = r;
      return g;
    }
// Join everything static in a model per material (moving parts carry userData and are kept)
function farmJoin(root) { if (typeof mergeStaticMeshes === 'function') { try { mergeStaticMeshes(root); } catch (e) {} } return root; }

// --- Machines --------------------------------------------------------------------------------------
function farmTractorModel(big = false) {
      const U = FARM_U, b = new THREE.Group();
      const paint = farmMat(FARM_PAINT.body, { roughness: 0.32, metalness: 0.15 }), dark = farmMat(FARM_PAINT.dark, { roughness: 0.7 });
      const glassM = farmMat(FARM_PAINT.glass, { transparent: true, opacity: 0.35, roughness: 0.05 });
      if (big) {
        // 4WD articulated: four equal duals, two frames joined at a pivot
        const r = 1.05 * U, x0 = -1.75 * U, x1 = 1.75 * U;
        [x0, x1].forEach(x => [-1, 1].forEach(s => [0.48, 1.18].forEach(o => { const w = fWheel(r, 0.62 * U); w.position.set(x, r, s * o * U); b.add(w); })));
        fBox(2.4 * U, 1.1 * U, 1.3 * U, paint, 1.6 * U, 1.9 * U, 0, b);                     // engine frame
        fBox(1.5 * U, 0.9 * U, 1.1 * U, paint, 2.95 * U, 1.75 * U, 0, b);                    // nose
        fBox(2.2 * U, 0.8 * U, 1.2 * U, paint, -1.6 * U, 1.65 * U, 0, b);                    // rear frame
        fBox(0.4 * U, 0.4 * U, 0.6 * U, dark, 0, 1.5 * U, 0, b);                             // pivot
        fBox(2.0 * U, 0.12 * U, 1.9 * U, paint, -0.4 * U, 3.75 * U, 0, b);                   // cab roof
        fBox(1.8 * U, 1.3 * U, 1.7 * U, glassM, -0.4 * U, 3.05 * U, 0, b);
        fBox(1.9 * U, 0.3 * U, 1.75 * U, dark, -0.4 * U, 2.3 * U, 0, b);
        fCyl(0.08 * U, 0.08 * U, 1.2 * U, 10, farmMat(0xb0b5ba, { metalness: 0.9, roughness: 0.25 }), 1.0 * U, 3.0 * U, 0.55 * U, b);
        [-1, 1].forEach(s => fBox(2.4 * U, 0.08 * U, 0.6 * U, paint, x0, 2.15 * U, s * 0.83 * U, b));
        const hitch = new THREE.Object3D(); hitch.position.set(-2.8 * U, 0.7 * U, 0); b.add(hitch);
        const seat = { x: -0.5 * U, y: 2.5 * U - KELO_SIT_OFFSET, z: 0 };
        return miniature(farmJoin(b), { seat, hitch, farm: 'bigtractor' });
      }
      // Row-crop tractor: big rear wheels, steerable fronts, long hood, glass cab, 3-point hitch
      const rr = 0.93 * U, fr = 0.66 * U, ax = -1.3 * U, fx = 1.75 * U;
      [-1, 1].forEach(s => { const w = fWheel(rr, 0.55 * U); w.position.set(ax, rr, s * 0.95 * U); b.add(w); });
      const fronts = [-1, 1].map(s => {
        const pivot = new THREE.Group(); pivot.position.set(fx, fr, s * 0.82 * U);
        pivot.add(fWheel(fr, 0.42 * U)); pivot.userData.steer = true; b.add(pivot); return pivot;
      });
      fBox(3.0 * U, 0.75 * U, 0.85 * U, paint, 1.2 * U, 1.65 * U, 0, b);                        // hood
      fBox(0.6 * U, 0.7 * U, 0.8 * U, dark, 2.75 * U, 1.45 * U, 0, b);                          // grille
      for (let i = 0; i < 6; i++) fBox(0.03 * U, 0.6 * U, 0.06 * U, farmMat(0x9aa0a6, { metalness: 0.8 }), 3.06 * U, 1.45 * U, (i - 2.5) * 0.12 * U, b);
      fBox(0.5 * U, 0.35 * U, 0.9 * U, dark, 3.15 * U, 0.95 * U, 0, b);                         // front weights
      fBox(3.6 * U, 0.3 * U, 0.7 * U, dark, 0.6 * U, 1.0 * U, 0, b);                            // frame
      fBox(1.3 * U, 0.9 * U, 1.15 * U, paint, -1.25 * U, 1.35 * U, 0, b);                       // transmission
      [-1, 1].forEach(s => {
        const fender = new THREE.Mesh(new THREE.CylinderGeometry(rr + 0.08 * U, rr + 0.08 * U, 0.62 * U, 20, 1, true, -0.2, Math.PI * 0.62), paint);
        fender.material = farmMat(FARM_PAINT.body, { roughness: 0.32, metalness: 0.15, side: THREE.DoubleSide });
        fender.rotation.x = Math.PI / 2; fender.rotation.y = Math.PI; fender.position.set(ax, rr, s * 0.95 * U); fender.castShadow = true; b.add(fender);
        fBox(0.3 * U, 0.05 * U, 0.4 * U, dark, -0.2 * U, 0.75 * U, s * 0.7 * U, b);           // steps
      });
      // cab
      const cy = 2.0 * U;
      fBox(1.7 * U, 0.25 * U, 1.5 * U, dark, -1.15 * U, cy, 0, b);
      fBox(1.6 * U, 1.35 * U, 1.42 * U, glassM, -1.15 * U, cy + 0.8 * U, 0, b);
      [[-0.37, -0.7], [-0.37, 0.7], [-1.93, -0.7], [-1.93, 0.7]].forEach(([x, z]) => fBox(0.07 * U, 1.35 * U, 0.07 * U, dark, x * U, cy + 0.8 * U, z * U, b));
      fBox(1.85 * U, 0.14 * U, 1.65 * U, paint, -1.15 * U, cy + 1.55 * U, 0, b);
      [-0.55, 0.55].forEach(z => fBox(0.08 * U, 0.06 * U, 0.16 * U, farmMat(0xfff4d6, { emissive: 0xfff0c8, emissiveIntensity: 0.5 }), -0.25 * U, cy + 1.5 * U, z * U, b));
      fBox(0.45 * U, 0.15 * U, 0.45 * U, dark, -1.3 * U, cy + 0.3 * U, 0, b);                   // seat
      fBox(0.1 * U, 0.5 * U, 0.45 * U, dark, -1.55 * U, cy + 0.55 * U, 0, b);
      const steer = new THREE.Mesh(new THREE.TorusGeometry(0.18 * U, 0.025 * U, 8, 18), dark);
      steer.rotation.y = Math.PI / 2; steer.rotation.x = 0.6; steer.position.set(-0.75 * U, cy + 0.75 * U, 0); steer.userData.steeringWheel = true; b.add(steer);
      fCyl(0.05 * U, 0.06 * U, 1.3 * U, 10, farmMat(0x30343a, { roughness: 0.4, metalness: 0.6 }), 0.5 * U, 2.6 * U, 0.33 * U, b);   // exhaust
      // 3-point hitch arms and the PTO
      [-1, 1].forEach(s => fRod([-1.85 * U, 0.85 * U, s * 0.25 * U], [-2.6 * U, 0.6 * U, s * 0.42 * U], 0.05 * U, dark, b));
      fRod([-1.85 * U, 1.35 * U, 0], [-2.6 * U, 1.25 * U, 0], 0.04 * U, dark, b);
      const hitch = new THREE.Object3D(); hitch.position.set(-2.65 * U, 0.6 * U, 0); b.add(hitch);
      const seat = { x: -1.3 * U, y: cy + 0.38 * U - KELO_SIT_OFFSET, z: 0 };
      const root = miniature(farmJoin(b), { seat, hitch, fronts, farm: 'tractor' });
      return root;
    }

function farmCombineModel() {
      const U = FARM_U, b = new THREE.Group();
      const paint = farmMat(FARM_PAINT.body, { roughness: 0.32, metalness: 0.15 }), dark = farmMat(FARM_PAINT.dark, { roughness: 0.7 }), cream = farmMat(FARM_PAINT.cream, { roughness: 0.45 });
      const glassM = farmMat(FARM_PAINT.glass, { transparent: true, opacity: 0.35, roughness: 0.05 });
      const fr = 0.95 * U, rr = 0.62 * U;
      [-1, 1].forEach(s => { const w = fWheel(fr, 0.75 * U); w.position.set(1.6 * U, fr, s * 1.35 * U); b.add(w); });
      [-1, 1].forEach(s => { const p = new THREE.Group(); p.position.set(-3.1 * U, rr, s * 1.2 * U); p.add(fWheel(rr, 0.45 * U)); p.userData.steer = true; b.add(p); });
      fBox(6.2 * U, 2.3 * U, 2.6 * U, paint, -0.5 * U, 2.5 * U, 0, b);                            // body (threshing rotor inside)
      fBox(5.6 * U, 0.15 * U, 2.7 * U, cream, -0.6 * U, 3.7 * U, 0, b);
      fBox(3.4 * U, 1.1 * U, 2.8 * U, paint, -0.7 * U, 4.35 * U, 0, b);                           // grain tank
      for (let i = 0; i < 4; i++) fBox(3.2 * U, 0.05 * U, 0.05 * U, dark, -0.7 * U, 4.95 * U, (i - 1.5) * 0.7 * U, b);
      fBox(1.1 * U, 1.6 * U, 1.3 * U, paint, 2.5 * U, 1.9 * U, 0, b);                             // feeder house
      fBox(0.5 * U, 1.2 * U, 2.0 * U, dark, -3.75 * U, 2.0 * U, 0, b);                           // straw chopper / spreader
      // cab, high at the front
      fBox(1.7 * U, 0.3 * U, 1.8 * U, dark, 2.25 * U, 3.75 * U, 0, b);
      fBox(1.6 * U, 1.35 * U, 1.7 * U, glassM, 2.3 * U, 4.6 * U, 0, b);
      fBox(1.9 * U, 0.15 * U, 1.95 * U, paint, 2.3 * U, 5.35 * U, 0, b);
      [-0.75, 0.75].forEach(z => fBox(0.08 * U, 0.06 * U, 0.2 * U, farmMat(0xfff4d6, { emissive: 0xfff0c8, emissiveIntensity: 0.5 }), 3.15 * U, 5.3 * U, z * U, b));
      fBox(0.45 * U, 0.15 * U, 0.45 * U, dark, 2.1 * U, 4.05 * U, 0, b);
      fCyl(0.07 * U, 0.08 * U, 1.6 * U, 10, farmMat(0x30343a, { roughness: 0.4, metalness: 0.6 }), -1.5 * U, 4.9 * U, 1.0 * U, b);
      // unloading auger: pivots at the tank's back corner; folded along the left side, swings out to unload
      const auger = new THREE.Group(); auger.position.set(-2.2 * U, 4.4 * U, -1.35 * U);
      fCyl(0.17 * U, 0.17 * U, 6.0 * U, 12, cream, 3.0 * U, 0, 0, auger, 'z');
      const spout = fCyl(0.2 * U, 0.12 * U, 0.6 * U, 10, dark, 6.0 * U, -0.3 * U, 0, auger);
      auger.userData.swing = { folded: 0, out: -Math.PI / 2 * 0.95 };
      auger.rotation.y = 0;
      b.add(auger);
      // the grain in the tank (shown as it fills)
      const load = new THREE.Mesh(new THREE.BoxGeometry(3.2 * U, 0.9 * U, 2.6 * U), farmMat(0xd5b062, { roughness: 1 }));
      load.position.set(-0.7 * U, 4.4 * U, 0); load.scale.y = 0.01; load.visible = false; load.userData.grain = true; b.add(load);
      const front = new THREE.Object3D(); front.position.set(3.4 * U, 0.6 * U, 0); b.add(front);
      const seat = { x: 2.1 * U, y: 4.12 * U - KELO_SIT_OFFSET, z: 0 };
      return miniature(farmJoin(b), { seat, front, auger, spout, grainMesh: load, farm: 'combine' });
    }

function farmGrainTruckModel() {
      const U = FARM_U, b = new THREE.Group();
      const paint = farmMat(0xc9ccc6, { roughness: 0.35, metalness: 0.2 }), dark = farmMat(FARM_PAINT.dark, { roughness: 0.7 }), box = farmMat(FARM_PAINT.body, { roughness: 0.4, metalness: 0.2 });
      const glassM = farmMat(FARM_PAINT.glass, { transparent: true, opacity: 0.35, roughness: 0.05 });
      const r = 0.52 * U;
      [[3.0, 1.0], [-1.6, 0.95], [-2.95, 0.95]].forEach(([x, z]) => [-1, 1].forEach(s => { const w = fWheel(r, 0.32 * U, false); w.position.set(x * U, r, s * z * U); b.add(w); }));
      fBox(8.6 * U, 0.3 * U, 0.9 * U, dark, -0.3 * U, 0.95 * U, 0, b);
      fBox(1.4 * U, 0.9 * U, 2.2 * U, paint, 3.6 * U, 1.45 * U, 0, b);                            // hood
      fBox(1.7 * U, 1.3 * U, 2.3 * U, paint, 2.3 * U, 2.0 * U, 0, b);                             // cab
      fBox(1.0 * U, 0.75 * U, 2.2 * U, glassM, 2.85 * U, 2.35 * U, 0, b);
      fBox(0.2 * U, 0.5 * U, 1.4 * U, dark, 4.3 * U, 1.4 * U, 0, b);
      fBox(0.5 * U, 0.3 * U, 0.5 * U, dark, 2.3 * U, 1.65 * U, -0.5 * U, b);
      fCyl(0.07 * U, 0.07 * U, 1.8 * U, 10, farmMat(0xb0b5ba, { metalness: 0.9, roughness: 0.25 }), 1.4 * U, 2.6 * U, 1.05 * U, b);
      // the 20 ft box with a roll tarp; hinged at the back to tip into the auger hopper
      const bed = new THREE.Group(); bed.position.set(-4.4 * U, 1.15 * U, 0);
      fBox(6.1 * U, 0.12 * U, 2.4 * U, box, 3.05 * U, 0.06 * U, 0, bed);
      [-1, 1].forEach(s => fBox(6.1 * U, 1.4 * U, 0.08 * U, box, 3.05 * U, 0.75 * U, s * 1.18 * U, bed));
      fBox(0.08 * U, 1.4 * U, 2.4 * U, box, 6.1 * U, 0.75 * U, 0, bed);
      fBox(0.08 * U, 1.4 * U, 2.4 * U, box, 0.02 * U, 0.75 * U, 0, bed);
      fCyl(0.12 * U, 0.12 * U, 6.0 * U, 10, farmMat(0x3d4a3a, { roughness: 0.9 }), 3.05 * U, 1.5 * U, 1.1 * U, bed, 'z');
      const grain = new THREE.Mesh(new THREE.BoxGeometry(6.0 * U, 1.2 * U, 2.3 * U), farmMat(0xd5b062, { roughness: 1 }));
      grain.position.set(3.05 * U, 0.75 * U, 0); grain.scale.y = 0.01; grain.visible = false; grain.userData.grain = true; bed.add(grain);
      b.add(bed);
      const seat = { x: 2.2 * U, y: 1.75 * U - KELO_SIT_OFFSET, z: -0.5 * U };
      return miniature(farmJoin(b), { seat, bed, grainMesh: grain, farm: 'truck' });
    }

// Vehicle models by name (js/items3d.js ITEM_MODEL_RULES: first match wins)
if (typeof ITEM_MODEL_RULES !== 'undefined') {
  ITEM_MODEL_RULES.unshift(
    [/four-?wheel-?drive articulated tractor|450 hp/, () => farmTractorModel(true)],
    [/row-?crop tractor|farm tractor/, () => farmTractorModel(false)],
    [/combine harvester/, () => farmCombineModel()],
    [/grain truck/, () => farmGrainTruckModel()]
  );
}

// --- Implements (built at full size, +x toward the tractor, hitch point at the origin) --------------
function farmImplementModel(key) {
      const U = FARM_U, g = new THREE.Group(), I = FARM_IMPLEMENTS[key];
      const paint = farmMat(FARM_PAINT.body, { roughness: 0.35, metalness: 0.15 }), dark = farmMat(FARM_PAINT.dark, { roughness: 0.7 }), steel = farmMat(FARM_PAINT.steel, { metalness: 0.75, roughness: 0.35 });
      const W = (I.widthM || 3) * U;
      const parts = g.userData;
      if (key === 'plough') {
        // six bottoms on a diagonal beam, a land wheel, the headstock on the hitch
        fBox(0.4 * U, 0.6 * U, 0.8 * U, paint, -0.2 * U, 0.6 * U, 0, g);
        fRod([-0.3 * U, 0.7 * U, 0], [-4.6 * U, 0.7 * U, 2.2 * U], 0.09 * U, paint, g);
        for (let i = 0; i < 6; i++) {
          const x = -0.8 * U - i * 0.68 * U, z = 0.35 * U + i * 0.36 * U;
          fRod([x, 0.7 * U, z], [x - 0.2 * U, 0.15 * U, z], 0.05 * U, paint, g);
          const board = fBox(0.6 * U, 0.35 * U, 0.05 * U, steel, x - 0.35 * U, 0.12 * U, z + 0.12 * U, g);
          board.rotation.y = -0.6; board.rotation.x = 0.3;
        }
        const lw = fWheel(0.35 * U, 0.2 * U, false); lw.position.set(-4.5 * U, 0.35 * U, 2.5 * U); g.add(lw); parts.wheels = [lw];
        parts.len = 4.8 * U;
      } else if (key === 'disc') {
        fBox(1.0 * U, 0.3 * U, 0.3 * U, paint, -0.5 * U, 0.7 * U, 0, g);
        fBox(0.3 * U, 0.25 * U, W, paint, -1.2 * U, 0.75 * U, 0, g);
        fBox(0.3 * U, 0.25 * U, W, paint, -2.8 * U, 0.75 * U, 0, g);
        const discs = [];
        [-1.4, -3.0].forEach(x => {
          const gang = new THREE.Group(); gang.position.set(x * U, 0.32 * U, 0);
          const n = Math.round(W / (0.25 * U));
          for (let i = 0; i < n; i++) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * U, 0.3 * U, 0.02 * U, 14), steel); d.rotation.x = Math.PI / 2; d.rotation.y = 0.15; d.position.z = -W / 2 + (i + 0.5) * W / n; gang.add(d); }
          fCyl(0.03 * U, 0.03 * U, W, 6, dark, 0, 0, 0, gang, 'x');
          gang.userData.spin = 1; g.add(gang); discs.push(gang);
        });
        [-1, 1].forEach(s => { const w = fWheel(0.38 * U, 0.25 * U, false); w.position.set(-2.1 * U, 0.38 * U, s * 0.6 * U); g.add(w); });
        parts.discs = discs; parts.len = 3.4 * U;
      } else if (key === 'drill') {
        // an air drill: the tool bar with openers, and the air cart with two tanks behind it
        fBox(1.8 * U, 0.25 * U, 0.3 * U, paint, -0.9 * U, 0.8 * U, 0, g);
        fBox(0.4 * U, 0.3 * U, W, paint, -2.0 * U, 0.9 * U, 0, g);
        for (let i = 0; i < 30; i++) { const z = -W / 2 + (i + 0.5) * W / 30; fRod([-2.0 * U, 0.85 * U, z], [-2.3 * U, 0.08 * U, z], 0.025 * U, dark, g); }
        for (let i = 0; i < 10; i++) { const z = -W / 2 + (i + 0.5) * W / 10; const pw = fWheel(0.25 * U, 0.12 * U, false); pw.position.set(-2.55 * U, 0.25 * U, z); g.add(pw); }
        fRod([-2.4 * U, 0.9 * U, 0], [-3.4 * U, 0.9 * U, 0], 0.07 * U, dark, g);
        fBox(2.6 * U, 1.6 * U, 2.2 * U, farmMat(FARM_PAINT.cream, { roughness: 0.4 }), -4.8 * U, 2.0 * U, 0, g);
        fBox(2.4 * U, 0.12 * U, 2.0 * U, paint, -4.8 * U, 2.85 * U, 0, g);
        const fan = fCyl(0.3 * U, 0.3 * U, 0.2 * U, 12, dark, -3.6 * U, 1.2 * U, 0.9 * U, g, 'x');
        [-1, 1].forEach(s => { const w = fWheel(0.6 * U, 0.4 * U); w.position.set(-4.8 * U, 0.6 * U, s * 1.15 * U); g.add(w); });
        parts.fan = fan; parts.len = 6.2 * U;
      } else if (key === 'sprayer') {
        fRod([0, 0.8 * U, 0], [-1.6 * U, 0.8 * U, 0], 0.07 * U, dark, g);
        fCyl(0.95 * U, 0.95 * U, 2.6 * U, 18, farmMat(0xe8e6df, { roughness: 0.35 }), -3.2 * U, 1.6 * U, 0, g, 'z');
        fBox(2.9 * U, 0.15 * U, 1.6 * U, paint, -3.2 * U, 0.65 * U, 0, g);
        [-1, 1].forEach(s => { const w = fWheel(0.7 * U, 0.3 * U); w.position.set(-3.4 * U, 0.7 * U, s * 1.0 * U); g.add(w); });
        fBox(0.3 * U, 1.0 * U, 2.0 * U, paint, -4.7 * U, 1.3 * U, 0, g);
        const booms = [-1, 1].map(s => {
          const piv = new THREE.Group(); piv.position.set(-4.85 * U, 1.0 * U, s * 1.0 * U);
          const arm = fBox(0.12 * U, 0.12 * U, 11 * U, steel, 0, 0, s * 5.5 * U, piv);
          for (let i = 0; i < 22; i++) fBox(0.04 * U, 0.25 * U, 0.04 * U, dark, 0, -0.18 * U, s * (0.25 + i * 0.5) * U, piv);
          // trusses
          for (let i = 0; i < 5; i++) fRod([0, 0, s * i * 2.2 * U], [0, 0.45 * U, s * (i * 2.2 + 1.1) * U], 0.03 * U, steel, piv);
          piv.userData.fold = { side: s };
          g.add(piv); return piv;
        });
        // the mist under the booms while spraying
        const mist = new THREE.Mesh(new THREE.BoxGeometry(0.6 * U, 0.4 * U, 22 * U), farmMat(0xeaf3f7, { transparent: true, opacity: 0.18, depthWrite: false }));
        mist.position.set(-4.85 * U, 0.6 * U, 0); mist.visible = false; mist.userData.mist = true; g.add(mist);
        parts.booms = booms; parts.mist = mist; parts.len = 5.2 * U;
      } else if (key === 'spreader') {
        fRod([0, 0.8 * U, 0], [-0.8 * U, 1.0 * U, 0], 0.06 * U, dark, g);
        const hop = new THREE.Mesh(new THREE.CylinderGeometry(1.1 * U, 0.35 * U, 1.3 * U, 4), farmMat(0xe2e0d8, { roughness: 0.4 }));
        hop.rotation.y = Math.PI / 4; hop.position.set(-1.6 * U, 1.7 * U, 0); hop.castShadow = true; g.add(hop);
        fBox(1.6 * U, 0.15 * U, 1.6 * U, paint, -1.6 * U, 0.85 * U, 0, g);
        const spinners = [-1, 1].map(s => {
          const sp = new THREE.Group(); sp.position.set(-2.1 * U, 0.7 * U, s * 0.35 * U);
          fCyl(0.32 * U, 0.32 * U, 0.03 * U, 16, steel, 0, 0, 0, sp);
          for (let i = 0; i < 4; i++) { const v = fBox(0.3 * U, 0.06 * U, 0.02 * U, dark, 0, 0.04 * U, 0, sp); v.rotation.y = i * Math.PI / 2; v.position.x = Math.cos(i * Math.PI / 2) * 0.15 * U; v.position.z = Math.sin(i * Math.PI / 2) * 0.15 * U; }
          sp.userData.spinY = s; g.add(sp); return sp;
        });
        const dust = new THREE.Mesh(new THREE.ConeGeometry(6 * U, 0.4 * U, 18, 1, true), farmMat(0xf2f0e8, { transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
        dust.rotation.z = Math.PI / 2; dust.position.set(-5 * U, 0.8 * U, 0); dust.visible = false; dust.userData.mist = true; g.add(dust);
        parts.spinners = spinners; parts.mist = dust; parts.len = 2.5 * U;
      } else if (key === 'cart') {
        fRod([0, 0.8 * U, 0], [-1.8 * U, 0.9 * U, 0], 0.08 * U, dark, g);
        const hop = new THREE.Mesh(new THREE.BoxGeometry(4.2 * U, 2.2 * U, 2.9 * U), paint);
        hop.position.set(-4.0 * U, 2.3 * U, 0); hop.castShadow = true; g.add(hop);
        fBox(3.6 * U, 0.8 * U, 2.0 * U, paint, -4.0 * U, 1.0 * U, 0, g);
        [-1, 1].forEach(s => { const w = fWheel(0.95 * U, 0.75 * U); w.position.set(-4.0 * U, 0.95 * U, s * 1.55 * U); g.add(w); });
        const auger = new THREE.Group(); auger.position.set(-2.0 * U, 3.4 * U, -1.4 * U);
        fCyl(0.16 * U, 0.16 * U, 4.2 * U, 10, farmMat(FARM_PAINT.cream, { roughness: 0.4 }), 0, 1.9 * U, 0, auger);
        auger.rotation.z = 0.25; auger.userData.swing = { folded: 0, out: 0.9 };
        g.add(auger);
        const grain = new THREE.Mesh(new THREE.BoxGeometry(4.0 * U, 0.6 * U, 2.7 * U), farmMat(0xd5b062, { roughness: 1 }));
        grain.position.set(-4.0 * U, 3.1 * U, 0); grain.visible = false; grain.userData.grain = true; g.add(grain);
        parts.auger = auger; parts.grainMesh = grain; parts.len = 6.2 * U;
      } else if (key === 'header') {
        // the draper header on the combine's feeder house: cutter bar, belts, a reel that turns
        fBox(1.2 * U, 0.4 * U, W, farmMat(FARM_PAINT.cream, { roughness: 0.4 }), 0.6 * U, 0.35 * U, 0, g);
        fBox(1.5 * U, 0.06 * U, W, farmMat(0x3a4b2e, { roughness: 0.9 }), 0.9 * U, 0.18 * U, 0, g);
        fBox(0.15 * U, 0.8 * U, W, paint, 0.0, 0.6 * U, 0, g);
        [-1, 1].forEach(s => fBox(1.6 * U, 0.9 * U, 0.08 * U, paint, 0.8 * U, 0.6 * U, s * W / 2, g));
        const reel = new THREE.Group(); reel.position.set(1.3 * U, 1.3 * U, 0);
        fCyl(0.06 * U, 0.06 * U, W, 8, dark, 0, 0, 0, reel, 'x');
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; fCyl(0.03 * U, 0.03 * U, W, 6, farmMat(FARM_PAINT.yellow, { roughness: 0.5 }), Math.cos(a) * 0.55 * U, Math.sin(a) * 0.55 * U, 0, reel, 'x'); }
        reel.userData.spin = 1; g.add(reel);
        parts.reel = reel; parts.len = 1.6 * U;
      } else if (key === 'mill') {
        fBox(0.6 * U, 0.8 * U, 0.6 * U, farmMat(0x6b4b2f, { roughness: 0.7 }), 0, 0.4 * U, 0, g);
        fCyl(0.32 * U, 0.32 * U, 0.25 * U, 18, farmMat(0x9b958a, { roughness: 0.95 }), 0, 0.95 * U, 0, g);
        const hop = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * U, 0.08 * U, 0.4 * U, 4), farmMat(FARM_PAINT.galv, { metalness: 0.6, roughness: 0.4 }));
        hop.position.set(0, 1.3 * U, 0); g.add(hop);
        fBox(0.3 * U, 0.3 * U, 0.3 * U, farmMat(0xd8cfb4, { roughness: 1 }), 0.45 * U, 0.15 * U, 0, g);
        parts.len = 0.6 * U;
      }
      g.userData.key = key;
      return g;
    }

// --- Buildings ---------------------------------------------------------------------------------------
// Each model is centred on its footprint with its door side to the south (+z), in units. Parts are
// tagged by stage (frame, walls, roof, fit); farmApplyBuildingLook shows a stage's parts in order as
// its progress goes 0 -> 1. The foundation is his concrete pour (state.concretePours).
function farmBuildingModel(key) {
      const U = FARM_U, B = FARM_BUILDINGS[key], g = new THREE.Group();
      const W = B.w * U, D = B.d * U;
      const stages = { frame: [], walls: [], roof: [], fit: [] };
      const put = (stage, m) => { stages[stage].push(m); g.add(m); return m; };
      const wood = farmMat(0xb08a5a, { roughness: 0.8 }), steel = farmMat(FARM_PAINT.galv, { metalness: 0.6, roughness: 0.35 }), dark = farmMat(FARM_PAINT.dark, { roughness: 0.7 });
      const fy = 0.25;  // on the slab
      if (key === 'farmhouse') {
        const H = 5.4 * U;
        for (let x = -W / 2; x <= W / 2 + 0.01; x += 0.6 * U) [-D / 2, D / 2].forEach(z => put('frame', fBox(0.06 * U, H, 0.14 * U, wood, x, fy + H / 2, z)));
        for (let z = -D / 2; z <= D / 2 + 0.01; z += 0.6 * U) [-W / 2, W / 2].forEach(x => put('frame', fBox(0.14 * U, H, 0.06 * U, wood, x, fy + H / 2, z)));
        put('frame', fBox(W, 0.25 * U, D, wood, 0, fy + 2.8 * U, 0));
        const siding = farmMat(0xd9d3c4, { roughness: 0.75 }), trim = farmMat(FARM_PAINT.white, { roughness: 0.5 });
        put('walls', fBox(W, H, 0.12 * U, siding, 0, fy + H / 2, D / 2));
        put('walls', fBox(W, H, 0.12 * U, siding, 0, fy + H / 2, -D / 2));
        put('walls', fBox(0.12 * U, H, D, siding, -W / 2, fy + H / 2, 0));
        put('walls', fBox(0.12 * U, H, D, siding, W / 2, fy + H / 2, 0));
        const winM = farmMat(0x6f8fa3, { roughness: 0.1, metalness: 0.3 });
        [-4.5, -1.5, 1.5, 4.5].forEach(x => [1.6, 4.2].forEach(y => { put('walls', fBox(1.0 * U, 1.25 * U, 0.05 * U, winM, x * U, fy + y * U, D / 2 + 0.08 * U)); put('walls', fBox(1.15 * U, 0.12 * U, 0.06 * U, trim, x * U, fy + (y - 0.68) * U, D / 2 + 0.1 * U)); put('walls', fBox(1.0 * U, 1.25 * U, 0.05 * U, winM, x * U, fy + y * U, -D / 2 - 0.08 * U)); }));
        put('walls', fBox(1.0 * U, 2.1 * U, 0.06 * U, farmMat(0x6b3a2a, { roughness: 0.6 }), 0, fy + 1.05 * U, D / 2 + 0.1 * U));
        // porch across the front
        put('fit', fBox(W * 0.8, 0.2 * U, 2.4 * U, farmMat(0x8b7356, { roughness: 0.85 }), 0, fy + 0.1 * U, D / 2 + 1.2 * U));
        [-0.38, -0.13, 0.13, 0.38].forEach(f => put('fit', fBox(0.15 * U, 2.6 * U, 0.15 * U, trim, f * W, fy + 1.4 * U, D / 2 + 2.3 * U)));
        put('fit', fBox(W * 0.82, 0.15 * U, 2.6 * U, farmMat(FARM_PAINT.roof, { roughness: 0.8 }), 0, fy + 2.75 * U, D / 2 + 1.25 * U));
        // the gable roof
        const pitch = Math.atan(8 / 12), half = D / 2 + 0.5 * U, slope = half / Math.cos(pitch);
        [-1, 1].forEach(s => { const r = put('roof', fBox(W + 1.0 * U, 0.2 * U, slope, farmMat(0x3f4347, { roughness: 0.85 }), 0, fy + H + Math.tan(pitch) * half / 2, s * half / 2)); r.rotation.x = s * pitch; });
        const gable = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, Math.tan(pitch) * D / 2)]);
        [-1, 1].forEach(s => { const gm = new THREE.Mesh(new THREE.ShapeGeometry(gable), farmMat(0xd9d3c4, { roughness: 0.75, side: THREE.DoubleSide })); gm.rotation.y = Math.PI / 2; gm.position.set(s * W / 2, fy + H, 0); put('roof', gm); });
        put('roof', fBox(0.9 * U, 2.5 * U, 0.9 * U, farmMat(0x8a4b3a, { roughness: 0.9 }), W * 0.3, fy + H + 1.4 * U, -0.8 * U));
      } else if (key === 'barn') {
        const H = 5.0 * U, red = farmMat(FARM_PAINT.red, { roughness: 0.7 }), trim = farmMat(FARM_PAINT.white, { roughness: 0.5 });
        for (let z = -D / 2; z <= D / 2 + 0.01; z += 3.6 * U) [-W / 2, W / 2].forEach(x => put('frame', fBox(0.28 * U, H, 0.28 * U, wood, x, fy + H / 2, z)));
        // gambrel trusses
        for (let z = -D / 2; z <= D / 2 + 0.01; z += 3.6 * U) {
          put('frame', fRod([-W / 2, fy + H, z], [-W / 4, fy + H + 3.4 * U, z], 0.12 * U, wood));
          put('frame', fRod([W / 2, fy + H, z], [W / 4, fy + H + 3.4 * U, z], 0.12 * U, wood));
          put('frame', fRod([-W / 4, fy + H + 3.4 * U, z], [0, fy + H + 4.6 * U, z], 0.12 * U, wood));
          put('frame', fRod([W / 4, fy + H + 3.4 * U, z], [0, fy + H + 4.6 * U, z], 0.12 * U, wood));
          put('frame', fRod([-W / 2, fy + H, z], [W / 2, fy + H, z], 0.1 * U, wood));
        }
        [-1, 1].forEach(s => put('walls', fBox(0.15 * U, H, D, red, s * W / 2, fy + H / 2, 0)));
        for (let z = -D / 2 + 0.3 * U; z < D / 2; z += 0.6 * U) [-1, 1].forEach(s => put('walls', fBox(0.06 * U, H, 0.08 * U, farmMat(0x84231f, { roughness: 0.75 }), s * (W / 2 + 0.08 * U), fy + H / 2, z)));
        // gable ends with the big sliding doors and a hay-loft door
        const gp = [[-W / 2, 0], [W / 2, 0], [W / 2, H], [W / 4, H + 3.4 * U], [0, H + 4.6 * U], [-W / 4, H + 3.4 * U], [-W / 2, H]].map(([x, y]) => new THREE.Vector2(x, y));
        [-1, 1].forEach(s => {
          const end = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(gp)), farmMat(FARM_PAINT.red, { roughness: 0.7, side: THREE.DoubleSide }));
          end.position.set(0, fy, s * D / 2); end.castShadow = true; put('walls', end);
          put('walls', fBox(4.3 * U, 4.3 * U, 0.1 * U, farmMat(0x7d201c, { roughness: 0.75 }), 0, fy + 2.15 * U, s * (D / 2 + 0.06 * U)));
          [[-2.15, 0], [2.15, 0], [0, 2.15], [0, -2.15]].forEach(([dx, dy]) => put('walls', fBox(dx ? 0.15 * U : 4.4 * U, dx ? 4.4 * U : 0.15 * U, 0.06 * U, trim, dx * U, fy + (2.15 + dy) * U, s * (D / 2 + 0.12 * U))));
          put('walls', fRod([-2.15 * U, fy + 0.1 * U, s * (D / 2 + 0.13 * U)], [2.15 * U, fy + 4.2 * U, s * (D / 2 + 0.13 * U)], 0.06 * U, trim));
          put('walls', fBox(1.8 * U, 1.8 * U, 0.08 * U, farmMat(0x7d201c, { roughness: 0.75 }), 0, fy + H + 1.6 * U, s * (D / 2 + 0.06 * U)));
        });
        // the roof: two pitches each side, steel
        const roofM = farmMat(0x5a6066, { metalness: 0.5, roughness: 0.45 });
        const pieces = [[[-W / 2, H], [-W / 4, H + 3.4 * U]], [[-W / 4, H + 3.4 * U], [0, H + 4.6 * U]], [[W / 2, H], [W / 4, H + 3.4 * U]], [[W / 4, H + 3.4 * U], [0, H + 4.6 * U]]];
        pieces.forEach(([[x0, y0], [x1, y1]]) => {
          const len = Math.hypot(x1 - x0, y1 - y0) + 0.4 * U, r = fBox(len, 0.12 * U, D + 1.0 * U, roofM, (x0 + x1) / 2, fy + (y0 + y1) / 2 + 0.1 * U, 0);
          r.rotation.z = Math.atan2(y1 - y0, x1 - x0); put('roof', r);
        });
        put('fit', fBox(1.4 * U, 1.4 * U, 1.4 * U, farmMat(FARM_PAINT.white, { roughness: 0.5 }), 0, fy + H + 5.2 * U, 0));
        const cap = new THREE.Mesh(new THREE.ConeGeometry(1.2 * U, 1.0 * U, 4), roofM); cap.rotation.y = Math.PI / 4; cap.position.set(0, fy + H + 6.4 * U, 0); put('fit', cap);
      } else if (key === 'shed') {
        const H = 6.0 * U, wallM = farmMat(0x7c8b7a, { metalness: 0.45, roughness: 0.4 }), trim = farmMat(0x3b4a3c, { roughness: 0.5 });
        for (let x = -W / 2; x <= W / 2 + 0.01; x += 6 * U) {
          [-D / 2, D / 2].forEach(z => put('frame', fBox(0.3 * U, H, 0.3 * U, steel, x, fy + H / 2, z)));
          put('frame', fRod([x, fy + H, -D / 2], [x, fy + H + 1.6 * U, 0], 0.15 * U, steel));
          put('frame', fRod([x, fy + H, D / 2], [x, fy + H + 1.6 * U, 0], 0.15 * U, steel));
        }
        put('walls', fBox(W, H, 0.1 * U, wallM, 0, fy + H / 2, -D / 2));
        [-1, 1].forEach(s => {
          put('walls', fBox(0.1 * U, H, D, wallM, s * W / 2, fy + H / 2, 0));
          const gable = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, 1.6 * U)])), farmMat(0x7c8b7a, { metalness: 0.45, roughness: 0.4, side: THREE.DoubleSide }));
          gable.rotation.y = Math.PI / 2; gable.position.set(s * W / 2, fy + H, 0); put('walls', gable);
        });
        // the south side: two 6 x 5 m doors (rolled up) between short wall panels
        const doors = [-7.5, 7.5];
        const segs = [[-15, -10.5], [-4.5, 4.5], [10.5, 15]];
        segs.forEach(([a, c]) => put('walls', fBox((c - a) * U, H, 0.1 * U, wallM, (a + c) / 2 * U, fy + H / 2, D / 2)));
        doors.forEach(x => {
          put('walls', fBox(6 * U, 1.0 * U, 0.1 * U, wallM, x * U, fy + H - 0.5 * U, D / 2));
          put('walls', fBox(6.2 * U, 0.6 * U, 0.5 * U, farmMat(0xd8d8d2, { roughness: 0.4 }), x * U, fy + H - 1.25 * U, D / 2 + 0.2 * U));   // rolled-up door
        });
        put('walls', fBox(W + 0.2 * U, 0.25 * U, 0.15 * U, trim, 0, fy + H, D / 2 + 0.06 * U));
        const roofM = farmMat(0x6e7378, { metalness: 0.55, roughness: 0.4 }), half = D / 2 + 0.6 * U, pitch = Math.atan(1.6 / 8), sl = half / Math.cos(pitch);
        [-1, 1].forEach(s => { const r = fBox(W + 1.0 * U, 0.12 * U, sl, roofM, 0, fy + H + 0.8 * U, s * half / 2); r.rotation.x = s * pitch; put('roof', r); });
        put('fit', fBox(W - 0.4 * U, 0.06 * U, D - 0.4 * U, farmMat(0xb9b5ab, { roughness: 0.8 }), 0, fy + 0.03, 0));
      } else if (key === 'workshop') {
        // the corner of the shed: bench with a vise, tool chest, compressor, welder, grinder
        const red = farmMat(0xb3261e, { roughness: 0.4, metalness: 0.3 });
        put('fit', fBox(3.8 * U, 0.08 * U, 0.8 * U, farmMat(0x5b4b3a, { roughness: 0.7 }), 0, 0.95 * U, -3.4 * U));
        [-1.8, 1.8].forEach(x => put('fit', fBox(0.08 * U, 0.9 * U, 0.7 * U, steel, x * U, 0.45 * U, -3.4 * U)));
        put('fit', fBox(0.3 * U, 0.2 * U, 0.2 * U, dark, 1.4 * U, 1.1 * U, -3.3 * U));
        put('fit', fBox(1.3 * U, 1.3 * U, 0.6 * U, red, -2.8 * U, 0.65 * U, -3.4 * U));
        put('fit', fCyl(0.35 * U, 0.35 * U, 1.7 * U, 14, farmMat(0x2f5d8a, { metalness: 0.4 }), 3.2 * U, 0.85 * U, -3.3 * U));
        put('fit', fBox(0.6 * U, 0.8 * U, 0.9 * U, farmMat(0xc9a227, { roughness: 0.4 }), 3.3 * U, 0.4 * U, -1.6 * U));
        put('fit', fBox(1.2 * U, 2.0 * U, 0.05 * U, farmMat(0x8f8f86, { roughness: 0.9 }), -0.5 * U, 1.9 * U, -3.82 * U));   // pegboard
      } else if (key === 'bins') {
        const R = B.diaM / 2 * U, H = 8 * 1.1 * U, n = B.count, gap = (W - n * 2 * R) / Math.max(1, n - 1);
        const ring = farmMat(FARM_PAINT.galv, { metalness: 0.7, roughness: 0.3 }), ring2 = farmMat(0xa9b1b5, { metalness: 0.7, roughness: 0.35 });
        for (let i = 0; i < n; i++) {
          const cx = -W / 2 + R + i * (2 * R + gap);
          // jack-built: the roof first, on jacks, then each ring added under it
          for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; put('frame', fBox(0.2 * U, 2.2 * U, 0.2 * U, farmMat(0xd04a1a, { roughness: 0.6 }), cx + Math.cos(a) * (R + 0.3 * U), fy + 1.1 * U, Math.sin(a) * (R + 0.3 * U))); }
          for (let k = 0; k < 8; k++) put('walls', fCyl(R, R, 1.1 * U, 36, k % 2 ? ring : ring2, cx, fy + (k + 0.5) * 1.1 * U, 0));
          const roof = new THREE.Mesh(new THREE.ConeGeometry(R + 0.2 * U, 2.8 * U, 36), ring); roof.position.set(cx, fy + H + 1.4 * U, 0); roof.castShadow = true; put('roof', roof);
          put('roof', fCyl(0.5 * U, 0.6 * U, 0.4 * U, 12, ring2, cx, fy + H + 2.9 * U, 0));
          put('fit', fBox(0.5 * U, H, 0.06 * U, dark, cx + R * 0.7, fy + H / 2, R * 0.72));   // ladder
          put('fit', fCyl(0.5 * U, 0.5 * U, 0.6 * U, 14, farmMat(0x4b5563, { metalness: 0.4 }), cx, fy + 0.6 * U, R + 0.3 * U, null, 'x'));   // aeration fan
        }
      } else if (key === 'dryer') {
        const tower = farmMat(0xc4c9cc, { metalness: 0.55, roughness: 0.4 });
        put('frame', fBox(W * 0.8, 0.3 * U, D * 0.8, steel, 0, fy + 0.6 * U, 0));
        for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) put('frame', fBox(0.2 * U, 9 * U, 0.2 * U, steel, x * W * 0.38, fy + 4.5 * U, z * D * 0.4));
        put('walls', fBox(W * 0.75, 7.5 * U, D * 0.7, tower, 0, fy + 4.8 * U, 0));
        for (let k = 0; k < 10; k++) put('walls', fBox(W * 0.77, 0.06 * U, D * 0.72, farmMat(0x8f979c, { metalness: 0.5 }), 0, fy + (1.3 + k * 0.75) * U, 0));
        put('walls', fBox(1.3 * U, 1.4 * U, 1.2 * U, farmMat(0x9a3b2a, { roughness: 0.5 }), 0, fy + 1.4 * U, D * 0.42));   // burner and fan
        // the wet tank and the auger leg up to the bins
        put('roof', fCyl(1.5 * U, 1.5 * U, 4.5 * U, 20, tower, -W * 0.15, fy + 2.25 * U, -D * 0.95));
        const leg = fRod([1.2 * U, fy + 0.5 * U, D * 0.5 + 2 * U], [-1.0 * U, fy + 13 * U, -D * 0.2], 0.25 * U, farmMat(FARM_PAINT.cream, { roughness: 0.4 }));
        put('roof', leg);
        put('fit', fCyl(1.2 * U, 1.2 * U, 2.0 * U, 18, farmMat(0xe6e6e2, { roughness: 0.4 }), W * 0.55, fy + 1.2 * U, D * 0.3, null, 'x'));   // propane tank
        const hopper = new THREE.Mesh(new THREE.ConeGeometry(1.0 * U, 0.8 * U, 4, 1, true), farmMat(FARM_PAINT.cream, { roughness: 0.4, side: THREE.DoubleSide }));
        hopper.rotation.x = Math.PI; hopper.position.set(1.2 * U, fy + 0.6 * U, D * 0.5 + 2.2 * U); put('fit', hopper);
      } else if (key === 'fueltank') {
        put('frame', fBox(W * 0.9, 0.3 * U, 0.2 * U, farmMat(0x9aa0a4, { roughness: 0.8 }), 0, fy + 0.15 * U, -D / 2));
        put('frame', fBox(W * 0.9, 0.3 * U, 0.2 * U, farmMat(0x9aa0a4, { roughness: 0.8 }), 0, fy + 0.15 * U, D / 2));
        [-1.5, 1.5].forEach(x => put('frame', fBox(0.3 * U, 0.6 * U, 1.8 * U, farmMat(FARM_PAINT.dark, { roughness: 0.6 }), x * U, fy + 0.3 * U, 0)));
        put('walls', fCyl(1.0 * U, 1.0 * U, 4.6 * U, 24, farmMat(0xd9d6cf, { roughness: 0.4, metalness: 0.2 }), 0, fy + 1.55 * U, 0, null, 'z'));
        put('roof', fBox(0.6 * U, 1.2 * U, 0.5 * U, farmMat(0x9e2b25, { roughness: 0.5 }), 2.8 * U, fy + 0.8 * U, 0.6 * U));
        put('roof', fRod([2.8 * U, fy + 1.0 * U, 0.85 * U], [2.4 * U, fy + 0.2 * U, 1.3 * U], 0.04 * U, dark));
        put('fit', fBox(1.2 * U, 0.3 * U, 0.05 * U, farmMat(0xf3c614, { roughness: 0.5 }), 0, fy + 1.6 * U, 1.02 * U));
      } else if (key === 'stand') {
        const cedar = farmMat(0xa0683e, { roughness: 0.8 });
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([x, z]) => put('frame', fBox(0.12 * U, 2.6 * U, 0.12 * U, cedar, x * W * 0.45, fy + 1.3 * U, z * D * 0.42)));
        put('walls', fBox(W * 0.9, 0.9 * U, 0.08 * U, cedar, 0, fy + 0.45 * U, D * 0.42));
        put('walls', fBox(W * 0.9, 0.06 * U, D * 0.6, cedar, 0, fy + 0.9 * U, D * 0.15));
        put('walls', fBox(W * 0.9, 1.8 * U, 0.06 * U, cedar, 0, fy + 1.0 * U, -D * 0.42));
        const r = fBox(W + 0.6 * U, 0.08 * U, D + 0.6 * U, farmMat(0x6e7378, { metalness: 0.5, roughness: 0.4 }), 0, fy + 2.7 * U, 0); r.rotation.x = -0.12; put('roof', r);
        put('fit', fBox(2.4 * U, 0.45 * U, 0.05 * U, farmMat(0xf2ead2, { roughness: 0.7 }), 0, fy + 2.25 * U, D * 0.47));
        for (let i = 0; i < 5; i++) put('fit', fBox(0.35 * U, 0.55 * U, 0.25 * U, farmMat(0xd9c9a0, { roughness: 0.95 }), (-1.2 + i * 0.6) * U, fy + 1.2 * U, D * 0.12));
      }
      g.userData.stages = stages;
      g.userData.key = key;
      return g;
    }
// Show a building as far as it is built: stage and progress (0..1 in that stage)
function farmApplyBuildingLook(g, b) {
      const st = g.userData.stages, order = ['frame', 'walls', 'roof', 'fit'];
      const idx = { staked: -1, foundation: -1, curing: -1, frame: 0, walls: 1, roof: 2, done: 4 }[b.stage] ?? -1;
      order.forEach((k, i) => {
        const list = st[k];
        let n = i < idx ? list.length : i === idx ? Math.ceil(list.length * Math.max(0, Math.min(1, b.prog || 0))) : 0;
        // the framing stays only where walls don't hide it anyway (it is there, just inside)
        if (k === 'roof' && b.stage === 'roof' && (b.prog || 0) >= 1) n = list.length;
        list.forEach((m, j) => { m.visible = j < n; });
      });
      if (idx >= 3) st.fit.forEach(m => { m.visible = b.stage === 'done' || (b.stage === 'roof' && b.prog >= 1); });
      // a bin is jacked up ring by ring: the jacks come away once it stands on its own
      if (g.userData.key === 'bins' && b.stage === 'done') st.frame.forEach(m => { m.visible = false; });
    }

// --- Crops ---------------------------------------------------------------------------------------------
// One clump every 1.6 x 1.6 units (a square metre) per field: ~8 700 per field, one draw call each.
// The clump geometry depends on the crop and its look (sprout, leafy, head, flower, turning, ripe,
// stubble); heights are real (wheat to 0.9 m, canola 1.3 m, corn 2.6 m).
const FARM_CLUMP = 1.6;
function farmColGeo(geo, hex) {
      const g = geo.index ? geo.toNonIndexed() : geo, n = g.attributes.position.count, c = new THREE.Color(hex), col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const y = g.attributes.position.getY(i); const k = 0.75 + 0.25 * Math.min(1, y / 1.5); col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    }
function farmJoinGeos(list) {
      let n = 0; list.forEach(g => { n += g.attributes.position.count; });
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
      let o = 0;
      list.forEach(g => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; });
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      out.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return out;
    }
// A few blades (thin tilted quads) round a point
function farmBlades(count, h, w, hex, lean = 0.25, spread = 0.5, seed = 1) {
      const out = [];
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + seed, r = spread * (0.3 + 0.7 * ((i * 37 % 10) / 10));
        const p = new THREE.PlaneGeometry(w, h, 1, 2);
        p.translate(0, h / 2, 0);
        const pa = p.attributes.position;
        for (let k = 0; k < pa.count; k++) { const y = pa.getY(k); pa.setX(k, pa.getX(k) + Math.sin(a) * lean * y * y / h); }
        p.rotateY(a);
        p.translate(Math.cos(a) * r, 0, Math.sin(a) * r);
        p.computeVertexNormals();
        out.push(farmColGeo(p, hex));
      }
      return out;
    }
const farmClumpCache = {};
function farmClumpGeometry(crop, look) {
      const key = crop + ':' + look;
      if (farmClumpCache[key]) return farmClumpCache[key];
      const U = FARM_U, C = FARM_CROPS[crop] || FARM_CROPS.wheat, green = C.colour.green, ripe = C.colour.ripe;
      let parts = [];
      const head = (n, h, hex, r = 0.05, len = 0.14, spread = 0.45) => {
        for (let i = 0; i < n; i++) {
          const a = i * 2.39996, rr = spread * Math.sqrt((i + 0.5) / n) * U;
          const g = new THREE.CylinderGeometry(r * U * 0.6, r * U, len * U, 5); g.translate(Math.cos(a) * rr, h * U + Math.sin(i * 1.7) * 0.05 * U, Math.sin(a) * rr);
          parts.push(farmColGeo(g, hex));
        }
      };
      if (look === 'stubble') parts = farmBlades(10, 0.18 * U, 0.05 * U, 0xb89b5e, 0.05, 0.6 * U, 0.3);
      else if (crop === 'corn') {
        const H = { sprout: 0.2, leafy: 0.9, head: 2.4, turning: 2.5, ripe: 2.5 }[look] || 0.2;
        const col = look === 'ripe' ? 0xc4a46a : look === 'turning' ? 0xa7a253 : green;
        // two plants per clump (rows 76 cm, ~8 plants/m²)
        [[-0.35, 0], [0.35, 0.2]].forEach(([dx, dz], j) => {
          const stalk = new THREE.CylinderGeometry(0.012 * U, 0.02 * U, H * U, 5); stalk.translate(dx * U, H * U / 2, dz * U); parts.push(farmColGeo(stalk, col));
          farmBlades(look === 'sprout' ? 3 : 7, H * 0.55 * U, 0.09 * U, col, 0.6, 0.05 * U, j * 1.3).forEach(g => { g.translate(dx * U, H * 0.15 * U, dz * U); parts.push(g); });
          if (look === 'head' || look === 'turning' || look === 'ripe') {
            const tas = new THREE.ConeGeometry(0.06 * U, 0.35 * U, 5); tas.translate(dx * U, (H + 0.15) * U, dz * U); parts.push(farmColGeo(tas, look === 'head' ? 0xc8b86a : 0x9c8456));
            const ear = new THREE.CylinderGeometry(0.035 * U, 0.03 * U, 0.25 * U, 6); ear.rotateZ(0.4); ear.translate((dx + 0.06) * U, H * 0.5 * U, dz * U); parts.push(farmColGeo(ear, look === 'ripe' ? 0xb39060 : 0x8fae4a));
          }
        });
      } else if (crop === 'canola') {
        const H = { sprout: 0.08, leafy: 0.3, flower: 1.2, turning: 1.3, ripe: 1.25 }[look] || 0.1;
        const col = look === 'ripe' ? ripe : look === 'turning' ? 0x8f8a45 : green;
        if (look === 'sprout' || look === 'leafy') {
          for (let i = 0; i < (look === 'sprout' ? 4 : 7); i++) { const a = i * 2.4, r = (0.1 + (i % 3) * 0.15) * U; const leaf = new THREE.CircleGeometry((look === 'sprout' ? 0.05 : 0.13) * U, 6); leaf.rotateX(-Math.PI / 2 + 0.5); leaf.rotateY(a); leaf.translate(Math.cos(a) * r, H * U, Math.sin(a) * r); leaf.computeVertexNormals(); parts.push(farmColGeo(leaf, col)); }
        } else {
          farmBlades(8, H * U, 0.03 * U, col, 0.15, 0.4 * U, 0.7).forEach(g => parts.push(g));
          // the yellow flower cloud, then the pods
          for (let i = 0; i < 7; i++) { const a = i * 2.4, r = (0.08 + (i % 4) * 0.12) * U; const top = new THREE.IcosahedronGeometry((look === 'flower' ? 0.17 : 0.12) * U, 0); top.scale(1, 0.6, 1); top.translate(Math.cos(a) * r, (H - 0.05) * U, Math.sin(a) * r); parts.push(farmColGeo(top, look === 'flower' ? 0xf2d21b : col)); }
        }
      } else {
        // wheat (~300 heads/m²: drawn as a tuft of tillers and a few heads)
        const H = { sprout: 0.1, leafy: 0.35, head: 0.85, turning: 0.88, ripe: 0.85 }[look] || 0.1;
        const col = look === 'ripe' ? ripe : look === 'turning' ? 0xb7b45a : green;
        farmBlades(look === 'sprout' ? 6 : 12, H * U, 0.04 * U, col, look === 'ripe' ? 0.3 : 0.2, 0.5 * U, 0.2).forEach(g => parts.push(g));
        if (look === 'head' || look === 'turning' || look === 'ripe') head(12, H - 0.08, look === 'head' ? 0x8fa54a : look === 'turning' ? 0xc9b86a : 0xd8b55a);
      }
      const geo = farmJoinGeos(parts);
      if (typeof markSway === 'function') markSway(geo, 0, 1.2 * U, 0.6);
      geo.computeBoundingSphere();
      farmClumpCache[key] = geo;
      return geo;
    }
let farmCropMaterial = null;
function farmCropMat() {
      if (farmCropMaterial) return farmCropMaterial;
      farmCropMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
      if (typeof foliageSwayShader === 'function') { farmCropMaterial.onBeforeCompile = foliageSwayShader; farmCropMaterial.customProgramCacheKey = () => 'farmCropSway'; }
      return farmCropMaterial;
    }
// The clump spots of a field (deterministic jitter)
function farmClumpSpots(f) {
      const out = [];
      const nx = Math.floor((f.x1 - f.x0) / FARM_CLUMP), nz = Math.floor((f.z1 - f.z0) / FARM_CLUMP);
      for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
        const h = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453, j = h - Math.floor(h);
        out.push([f.x0 + (i + 0.5) * FARM_CLUMP + (j - 0.5) * 0.6, f.z0 + (k + 0.5) * FARM_CLUMP + ((j * 7) % 1 - 0.5) * 0.6, j]);
      }
      return out;
    }
