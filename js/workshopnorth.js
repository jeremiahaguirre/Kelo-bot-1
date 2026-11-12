// Kelo-bot-1 — js/workshopnorth.js
// Loaded after plantmodels.js (task 7b). His Workshop's north yard, over the range behind the Workshop
// (the pass and the yard's levelled land are WORKSHOP_LAND.pass / eastRoad / yard, js/workshopbuilding.js),
// at the south end of the runway field (RUNWAY_FIELD, js/agent.js):
//   - the GARAGE HALL: four tall bays for his big vehicles (a straight drive-through bay for the pickup
//     and its trailer, a service pit, a heavy-duty column lift and a wash bay), doors on the south face
//     and the drive-through's back door on the north face. Vehicles that don't fit door 1 and the car
//     elevator (the concrete mixer truck) and anything he takes there on purpose are serviced here.
//   - the BIG HANGAR: two full-size build bays and three parking bays, a 20 t bridge crane, and a
//     50-unit door facing north onto its apron and the reserved taxiway to the field.
// Both are built at real size (1.6 units a metre) with the Workshop's building kit (machinemodels.js mm*,
// the ws* wall and exterior helpers, materials.js dressBuilding). Their roofs fade with the cutaway
// switch, the wall facing the camera fades while he is inside, and nothing of them is drawn while the
// range hides them from the camera; their insides fill in only when the camera is near (perfWatchBuilding).

// Footprints (world units; x, z the centre). The hall's doors face south (local +z = world +z); the
// hangar is turned round (local +z = world -z), so its door faces north.
const GARAGE_HALL = { x: 90, z: -127, w: 32, d: 26, h: 9.6, rise: 1.3, door: { w: 5.8, h: 6.2 } };
// The hall's bays (hall-local x across, every bay runs the full depth, 7.4 units wide)
const GARAGE_HALL_BAYS = [
  { key: 'g1', kind: 'through', label: 'BAY 1  •  DRIVE-THROUGH', x: -12, w: 7.4, back: true },
  { key: 'g2', kind: 'pit', label: 'BAY 2  •  SERVICE PIT', x: -4, w: 7.4 },
  { key: 'g3', kind: 'lift', label: 'BAY 3  •  HEAVY LIFT 4 x 7.5 T', x: 4, w: 7.4 },
  { key: 'g4', kind: 'wash', label: 'BAY 4  •  WASH', x: 12, w: 7.4 }
];
const NORTH_HANGAR = { x: 34, z: -128, w: 56, d: 32, h: 12.5, rise: 1.6, door: { w: 50, h: 10 }, craneY: 11 };
// The big hangar's floor (hangar-local, door at +z): build bays 3 and 4 (each 22 x 16, room for a
// 10 m span aircraft or a full-size boat), a lane between them to the parking along the back wall
const NORTH_HANGAR_BAYS = [
  { key: 'build3', kind: 'build', label: 'BUILD BAY 3', x: -14.5, z: 1, w: 22, d: 16 },
  { key: 'build4', kind: 'build', label: 'BUILD BAY 4', x: 14.5, z: 1, w: 22, d: 16 },
  { key: 'lane2', kind: 'lane', label: 'LANE', x: 0, z: 2.5, w: 6, d: 23 },
  { key: 'park3', kind: 'parking', label: 'PARKING 3', x: -17, z: -12.4, w: 12, d: 5.6 },
  { key: 'park4', kind: 'parking', label: 'PARKING 4', x: 0, z: -12.4, w: 12, d: 5.6 },
  { key: 'park5', kind: 'parking', label: 'PARKING 5', x: 17, z: -12.4, w: 12, d: 5.6 }
];

// Hall-local / hangar-local to world
function hallToWorld(lx, lz) { return { x: GARAGE_HALL.x + lx, z: GARAGE_HALL.z + lz }; }
function northHangarToWorld(lx, lz) { return { x: NORTH_HANGAR.x - lx, z: NORTH_HANGAR.z - lz }; }

// The hall's bays in world terms: { key, kind, label, x, z (centre), w, d, front (outside the door), back (outside the back door, bay 1) }
function garageHallBays(kind) {
      const G = GARAGE_HALL;
      return GARAGE_HALL_BAYS.filter(b => !kind || b.kind === kind).map(b => {
        const c = hallToWorld(b.x, 0);
        return { key: b.key, kind: b.kind, label: b.label, x: c.x, z: c.z, y: WORKSHOP_PAD_Y + 0.12, w: b.w, d: G.d - 2, rotY: Math.PI / 2,
          front: { x: c.x, z: G.z + G.d / 2 + 9 }, back: b.back ? { x: c.x, z: G.z - G.d / 2 - 9 } : null };
      });
    }

// The big hangar's bays in world terms (w across world x, d along world z)
function northHangarBays(kind) {
      return NORTH_HANGAR_BAYS.filter(b => !kind || b.kind === kind).map(b => {
        const c = northHangarToWorld(b.x, b.z);
        return { key: b.key, kind: b.kind, label: b.label, x: c.x, y: WORKSHOP_PAD_Y + 0.12, z: c.z, w: b.w, d: b.d, rotY: 0, lane: b.kind === 'lane', north: true };
      });
    }

// --- The shed: walls, roof, trusses, lights, signs (the hangar's look, js/workshopbuilding.js) ---------
const wnBuilt = { hall: null, hangar: null };
const wnRoofs = [];            // their see-through roofs (in cutawayRoofMeshes too)
const wnFade = { hall: {}, hangar: {} };    // wall materials that fade while he is inside (by side)
let wnLightMat = null;

function wnShed(o) {
      const hx = o.w / 2, hz = o.d / 2, g = new THREE.Group();
      const rib = wsRibTexture(), slat = wsSlatTexture();
      const clad = new THREE.MeshStandardMaterial({ color: o.clad || 0xd3d8de, roughness: 0.5, metalness: 0.22, map: rib, bumpMap: rib, bumpScale: 0.03 });
      const band = new THREE.MeshStandardMaterial({ color: o.band || 0x3b4a5e, roughness: 0.5, metalness: 0.25, map: rib, bumpMap: rib, bumpScale: 0.03 });
      const plinth = new THREE.MeshStandardMaterial({ color: 0x8f8f8a, roughness: 0.92 });
      const floorMat = new THREE.MeshStandardMaterial({ color: 0xb9bab5, roughness: 0.55, metalness: 0.05, map: wsConcreteTexture() });
      const doorMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.45, metalness: 0.45, map: slat, bumpMap: slat, bumpScale: 0.02 });
      const navy = mmMat('navy'), yellow = mmMat('yellow');
      wsPanel(g, o.w + 0.6, 0.38, o.d + 0.6, plinth, 0, -0.3, 0, 3).castShadow = false;
      wsPanel(g, o.w - 0.2, 0.04, o.d - 0.2, floorMat, 0, 0.08, 0, 3.2).castShadow = false;
      const t = 0.16, wallH = o.h - 1.5, win = { h: 1.4, y0: wallH - 2.4 };
      // Each wall side has its own cladding and band material, so after the parts are joined per material
      // the wall facing the camera can still fade on its own (wnFade lists the materials by side)
      const sides = {}, mats = {};
      ['front', 'back', 'west', 'east'].forEach(sd => { mats[sd] = { clad: clad.clone(), band: band.clone() }; sides[sd] = [mats[sd].clad, mats[sd].band]; });
      const door = v => typeof v === 'number' ? { c: v, w: o.doorW, h: o.doorH } : v;
      const fronts = o.front.map(door), backs = (o.back || []).map(door);
      // Front and back (along x) with their doors; the sides with a band of high windows
      wsWallWithOpenings(g, 'x', hz, -hx, hx, wallH, t, mats.front.clad, fronts, 1.28);
      wsWallWithOpenings(g, 'x', -hz, -hx, hx, wallH, t, mats.back.clad, [...backs, ...(o.backWindows ? [{ c: o.backWindows.c, w: o.backWindows.w, ...win }] : [])], 1.28);
      wsWallWithOpenings(g, 'z', -hx, -hz, hz, wallH, t, mats.west.clad, [{ c: 0, w: o.d - 4, ...win }], 1.28);
      wsWallWithOpenings(g, 'z', hx, -hz, hz, wallH, t, mats.east.clad, [{ c: 0, w: o.d - 4, ...win }], 1.28);
      const top = mmGroup(g, 0, wallH, 0);
      wsWallWithOpenings(top, 'x', hz, -hx, hx, 1.5, t, mats.front.band, [], 1.28);
      wsWallWithOpenings(top, 'x', -hz, -hx, hx, 1.5, t, mats.back.band, [], 1.28);
      wsWallWithOpenings(top, 'z', -hx, -hz, hz, 1.5, t, mats.west.band, [], 1.28);
      wsWallWithOpenings(top, 'z', hx, -hz, hz, 1.5, t, mats.east.band, [], 1.28);
      const glass = new THREE.MeshStandardMaterial({ color: 0x9cc7e6, roughness: 0.06, metalness: 0.3, transparent: true, opacity: 0.38 });
      [-hx, hx].forEach(x => mmBox(g, 0.04, win.h, o.d - 4, glass, x, win.y0, 0));
      if (o.backWindows) mmBox(g, o.backWindows.w, win.h, 0.04, glass, o.backWindows.c, win.y0, -hz);
      // Doors: a header and guide rails each, the rolled-up curtain, bollards outside
      const doorRow = (z, list) => list.forEach(d => {
        const c = d.c;
        mmBox(g, d.w + 0.6, 0.7, 0.5, navy, c, d.h, z - Math.sign(z) * 0.1);
        const curtain = new THREE.Mesh(wsUV(new THREE.BoxGeometry(d.w, 0.6, 0.05), 1.2), doorMat);
        curtain.position.set(c, d.h - 0.3, z + Math.sign(z) * 0.05);
        g.add(curtain);
        [-1, 1].forEach(s => {
          mmBox(g, 0.16, d.h, 0.2, 'steel', c + s * (d.w / 2 + 0.08), 0, z);
          if (o.bollards !== false && d.w > 3) mmCyl(g, 0.13, 1.0, yellow, c + s * (d.w / 2 + 0.55), 0.5, z + Math.sign(z) * 0.9);
        });
      });
      doorRow(hz, fronts);
      doorRow(-hz, backs);
      const sign = makeSignMesh(o.sign, { bg: '#1e3a5f', fg: '#f8fafc', width: o.signW || 6.4, height: 0.8 });
      sign.position.set(o.signX || 0, o.h - 0.75, hz + 0.1);
      g.add(sign);
      wsExteriorDetail(g, { W: o.w, D: o.d, eave: o.h, rise: o.rise, trim: navy,
        walls: [{ side: 'west', a: -hz, b: hz, y0: 0.35, flash: true }, { side: 'east', a: -hz, b: hz, y0: 0.35, flash: true },
          { side: 'back', a: -hx, b: hx, y0: 0.35, flash: true, skip: backs.map(d => [d.c - d.w / 2, d.c + d.w / 2]) },
          { side: 'front', a: -hx, b: hx, y0: 0.35, flash: true, skip: fronts.map(d => [d.c - d.w / 2, d.c + d.w / 2]) }],
        spouts: [[-hx, hz - 0.45, -1, 0], [hx, hz - 0.45, 1, 0], [-hx, -hz + 0.45, -1, 0], [hx, -hz + 0.45, 1, 0]],
        lamps: [['west', -o.d / 4, 5], ['west', o.d / 4, 5], ['east', -o.d / 4, 5], ['east', o.d / 4, 5]] });
      // The roof (see-through with the cutaway switch), trusses and columns
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b98a6, roughness: 0.55, metalness: 0.5, transparent: true, opacity: state.roofCutaway ? 0.18 : 0.95, side: THREE.DoubleSide });
      const pitch = Math.atan2(o.rise, hz);
      const roofs = [];
      [-1, 1].forEach(s => {
        const roof = new THREE.Mesh(wsUV(new THREE.BoxGeometry(o.w + 0.8, 0.08, Math.hypot(hz + 0.5, o.rise)), 1.0), roofMat);
        roof.position.set(0, o.h + o.rise / 2, s * (hz + 0.5) / 2);
        roof.rotation.x = s * pitch;
        g.add(roof);
        roofs.push(roof);
      });
      const bays = Math.max(4, Math.round(o.w / 8));
      for (let k = 0; k <= bays; k++) {
        const x = -hx + 0.3 + k * (o.w - 0.6) / bays;
        [-hz + 0.2, hz - 0.2].forEach(z => { if (!(z > 0 ? fronts : backs).some(d => Math.abs(x - d.c) < d.w / 2 + 0.2)) mmBox(g, 0.28, o.h - 0.1, 0.28, navy, x, 0, z); });
        mmBox(g, 0.18, 0.6, o.d - 0.4, navy, x, o.h - 0.65, 0);
      }
      // High-bay lights under the trusses (one shared lens material, lit by wsUpdateLighting)
      if (!wnLightMat) {
        wnLightMat = mmGlow('window');
        wnLightMat.emissive.setHex(0xf1f5ff);
        wnLightMat.emissiveIntensity = 1.2;
        if (typeof wsLights !== 'undefined') wsLights.push({ mesh: { material: wnLightMat } });
      }
      const fixGeo = new THREE.PlaneGeometry(1, 1);
      fixGeo.rotateX(Math.PI / 2);
      for (let k = 0; k < bays; k++) {
        const x = -hx + 0.3 + (k + 0.5) * (o.w - 0.6) / bays;
        [-o.d / 4, o.d / 4].forEach(z => { const m = new THREE.Mesh(fixGeo, wnLightMat); m.scale.set(0.7, 1, 0.4); m.position.set(x, o.h - 0.95, z); g.add(m); });
      }
      if (typeof dressBuilding === 'function') dressBuilding(g, [[roofMat, 'metalroof', 1.2], [plinth, 'stone', 2]]);
      return { g, roofs, sides, roofMat, floorMat };
    }

// Painted floor bays: outline, label, optional hatching (lane)
function wnPaintBay(g, b, mat, labelAlong = true, labelParent = g) {
      const line = (x, z, w, d, m = mat) => mmBox(g, w, 0.008, d, m, x, 0.125, z);
      line(b.x, b.z - b.d / 2, b.w, 0.1); line(b.x, b.z + b.d / 2, b.w, 0.1);
      line(b.x - b.w / 2, b.z, 0.1, b.d); line(b.x + b.w / 2, b.z, 0.1, b.d);
      if (b.kind === 'lane') for (let k = 0; k < 6; k++) line(b.x, b.z - b.d / 2 + 1 + k * (b.d - 2) / 5, b.w - 0.8, 0.14, mmMat('hazard'));
      const lw = Math.min(b.w - 0.8, 5.2);
      const l = mmLabel(labelParent, b.label, lw, lw * 0.11, b.x, 0.13, labelAlong ? b.z + b.d / 2 - 0.6 : b.z, { bg: '#b9bab5', fg: '#a16207' });
      l.rotation.x = -Math.PI / 2;
      return l;
    }

// The solid walls as obstacles, open at the doors (a box obstacle would turn every walk to a bay into a
// walk to the door: the halls are entered on foot and by vehicle)
function wnWallObstacles(cx, cz, w, d, frontZ, frontGaps, backGaps, rot) {
      const hx = w / 2, hz = d / 2, s = rot ? -1 : 1, tag = { workshop: true, north: true };
      // gaps given in local x; with the building turned round, local x runs the other way
      const gapsAlong = list => list.map(([a, b]) => rot ? [hx - b, hx - a] : [a + hx, b + hx]);
      const fz = cz + s * hz, bz = cz - s * hz;
      addObstacle(
        obstacleWall(cx - hx, fz, cx + hx, fz, 0.6, gapsAlong(frontGaps), tag),
        obstacleWall(cx - hx, bz, cx + hx, bz, 0.6, gapsAlong(backGaps), tag),
        obstacleWall(cx - hx, cz - hz, cx - hx, cz + hz, 0.6, [], tag),
        obstacleWall(cx + hx, cz - hz, cx + hx, cz + hz, 0.6, [], tag));
    }

// --- The garage hall --------------------------------------------------------------------------------
function buildGarageHall3D() {
      if (wnBuilt.hall || !scene) return;
      const G = GARAGE_HALL, hz = G.d / 2;
      const fronts = GARAGE_HALL_BAYS.map(b => b.x), backs = GARAGE_HALL_BAYS.filter(b => b.back).map(b => b.x);
      const s = wnShed({ w: G.w, d: G.d, h: G.h, rise: G.rise, front: fronts, back: backs, doorW: G.door.w, doorH: G.door.h,
        sign: 'GARAGE HALL', signW: 5.6, signX: 0, backWindows: { c: 4, w: 18 } });
      const g = s.g;
      g.position.set(G.x, WORKSHOP_PAD_Y, G.z);
      g.userData.isWorkshop = true;
      wnFade.hall = s.sides;
      const yellow = mmMat('yellow'), white = mmMat('white');
      const inside = mmGroup(g, 0, 0, 0);      // what fills in only when the camera is near
      // Bay numbers over the doors and bay outlines on the floor
      GARAGE_HALL_BAYS.forEach((b, i) => {
        mmLabel(inside, String(i + 1), 0.8, 0.8, b.x, G.door.h + 0.55, hz + 0.12, { bg: '#facc15', fg: '#111827' });
        wnPaintBay(g, { ...b, z: 0, d: G.d - 2 }, i === 0 ? yellow : white, true, inside);
        // painted lead-in lines out front
        mmBox(g, 0.12, 0.01, 6, yellow, b.x - G.door.w / 2 + 0.4, 0.02, hz + 3.2);
        mmBox(g, 0.12, 0.01, 6, yellow, b.x + G.door.w / 2 - 0.4, 0.02, hz + 3.2);
      });
      // A concrete apron in front of the doors (and behind the drive-through's back door)
      const apron = new THREE.MeshStandardMaterial({ color: 0xa8a49b, roughness: 0.9, map: wsConcreteTexture() });
      wsPanel(g, G.w + 2, 0.06, 7, apron, 0, -0.05, hz + 3.5, 3.2).castShadow = false;
      wsPanel(g, G.door.w + 3, 0.06, 7, apron, GARAGE_HALL_BAYS[0].x, -0.05, -hz - 3.5, 3.2).castShadow = false;
      const parts = {};
      // Bay 2: a covered service pit (steel grating, yellow edge, steps down at the back, a pit light)
      const pit = GARAGE_HALL_BAYS[1];
      mmBox(inside, 1.5, 0.03, 10.5, 'dark', pit.x, 0.1, 0.5);
      for (let z = -4.6; z <= 5.6; z += 0.5) mmBox(inside, 1.5, 0.02, 0.06, 'steel', pit.x, 0.13, z);
      [-0.8, 0.8].forEach(x => mmBox(inside, 0.12, 0.03, 10.6, 'hazard', pit.x + x, 0.11, 0.5));
      mmBox(inside, 1.0, 0.9, 0.2, yellow, pit.x, 0.1, -5.3);
      mmCyl(inside, 0.05, 0.9, yellow, pit.x - 0.9, 0.55, -5.0);
      mmCyl(inside, 0.05, 0.9, yellow, pit.x + 0.9, 0.55, -5.0);
      // an oil drain caddy and a wheel-chock pair beside it
      const caddy = mmGroup(inside, pit.x + 2.4, 0.1, 3.2);
      mmCyl(caddy, 0.35, 0.8, 'red', 0, 0.55, 0);
      mmCyl(caddy, 0.45, 0.06, 'dark', 0, 1.0, 0);
      mmRod(caddy, [0, 0.95, 0], [0, 1.9, -0.3], 0.03, 'steel');
      [-0.3, 0.3].forEach(dx => mmBox(caddy, 0.08, 0.14, 0.08, 'black', dx, 0, 0.3));
      // Bay 3: four heavy-duty mobile column lifts (one under each wheel of a truck)
      const lift = GARAGE_HALL_BAYS[2];
      parts.columns = [];
      [[-2.3, -3.6], [2.3, -3.6], [-2.3, 3.6], [2.3, 3.6]].forEach(([dx, dz]) => {
        const col = mmGroup(inside, lift.x + dx, 0.1, dz);
        const out = Math.sign(dx);
        mmBox(col, 0.9, 0.18, 1.1, yellow, out * 0.25, 0, 0);
        mmBox(col, 0.42, 4.4, 0.42, yellow, out * 0.45, 0.18, 0);
        mmBox(col, 0.3, 0.6, 0.25, 'dark', out * 0.45, 1.2, 0.3);
        mmLabel(col, '7.5 T', 0.36, 0.18, out * 0.45, 3.6, 0.23, { bg: '#111827', fg: '#facc15' });
        const carriage = mmGroup(col, 0, 0.25, 0);
        mmBox(carriage, 0.55, 0.5, 0.55, 'dark', out * 0.45, 0, 0);
        mmBox(carriage, 0.7, 0.08, 0.5, 'steel', -out * 0.15, 0.2, 0);
        col.userData.carriage = carriage;
        parts.columns.push(carriage);
      });
      // a control console on the first column's cable
      const con = mmGroup(inside, lift.x - 3.2, 0.1, -5.2);
      mmBox(con, 0.5, 1.2, 0.35, yellow, 0, 0, 0);
      mmBox(con, 0.4, 0.3, 0.05, 'screen', 0, 0.95, 0.18);
      mmEstop(con, 0.15, 0.8, 0.18);
      // two axle stands and a transmission jack against the wall
      [-1, 1].forEach(k => { const st = mmGroup(inside, lift.x + 3.3, 0.1, -9 + k * 0.6); mmCone(st, 0.22, 0.6, 'red', 0, 0.3, 0); mmCyl(st, 0.04, 0.55, 'steel', 0, 0.85, 0); });
      // Bay 4: the wash bay (trench drain, pressure washer cart, hose reel, curtain rails)
      const wash = GARAGE_HALL_BAYS[3];
      mmBox(inside, 0.6, 0.02, 20, 'steel', wash.x, 0.13, 0);
      for (let z = -9.8; z <= 9.8; z += 0.4) mmBox(inside, 0.6, 0.025, 0.05, 'dark', wash.x, 0.13, z);
      const washer = mmGroup(inside, wash.x + 2.8, 0.1, -7.5);
      mmRBox(washer, 0.8, 0.9, 1.1, 'blue', 0, 0.25, 0);
      [-0.35, 0.35].forEach(dx => mmCyl(washer, 0.22, 0.12, 'tire', dx, 0.22, -0.45, { axis: 'x' }));
      mmRod(washer, [0, 1.15, 0.5], [0, 1.6, 0.7], 0.03, 'steel');
      mmCyl(washer, 0.25, 0.12, 'dark', 0, 1.2, -0.2, { axis: 'z' });
      const reel = mmGroup(g, wash.x + G.w / 2 - wash.x - 0.35, 2.4, 2);
      mmCyl(reel, 0.42, 0.25, 'red', 0, 0, 0, { axis: 'x' });
      mmCyl(reel, 0.28, 0.27, 'black', 0, 0, 0, { axis: 'x' });
      [-1, 1].forEach(k => mmBox(g, 0.06, 0.06, G.d - 3, 'steel', wash.x + k * 3.4, 7.2, 0));
      // Along the back wall: roll cabinets, a bench with a vise, shelving with parts, a tyre rack, drums
      const backZ = -hz + 0.9;
      const bench = mmGroup(inside, -4, 0.1, backZ);
      mmBox(bench, 3.2, 0.08, 0.9, 'bench', 0, 0.95, 0);
      [-1.5, 1.5].forEach(x => mmBox(bench, 0.08, 0.95, 0.8, 'steel', x, 0, 0));
      mmBox(bench, 0.35, 0.25, 0.25, 'castIron', 1.1, 1.03, 0.1);
      mmBox(bench, 3.2, 1.2, 0.04, 'ply', 0, 1.6, -0.45);
      [[1.6, 'red'], [2.6, 'red'], [6.6, 'blue']].forEach(([x, c]) => { const cab = mmGroup(inside, x, 0.1, backZ); mmRBox(cab, 0.95, 1.05, 0.55, c, 0, 0.12, 0); for (let k = 0; k < 5; k++) mmBox(cab, 0.85, 0.02, 0.02, 'chrome', 0, 0.3 + k * 0.17, 0.29); [-0.38, 0.38].forEach(dx => mmCyl(cab, 0.06, 0.06, 'black', dx, 0.06, 0.2, { axis: 'x' })); });
      const shelf = mmGroup(inside, 10.5, 0.1, backZ - 0.2);
      [-1.4, 1.4].forEach(x => mmBox(shelf, 0.08, 3.2, 0.6, 'orange', x, 0, 0));
      [0.3, 1.2, 2.1, 3.0].forEach(y => mmBox(shelf, 2.9, 0.06, 0.6, 'blue', 0, y, 0));
      [[-0.8, 0.36, 'oil'], [0, 0.36, 'red'], [0.8, 1.26, 'grey'], [-0.6, 2.16, 'orange'], [0.6, 2.16, 'oil']].forEach(([x, y, c]) => mmBox(shelf, 0.6, 0.45, 0.45, c, x, y, 0));
      const tyres = mmGroup(inside, 13.8, 0.1, -3);
      for (let k = 0; k < 4; k++) mmCyl(tyres, 0.55, 0.32, 'tire', 0, 0.55, -1.2 + k * 0.42, { axis: 'z' });
      mmBox(tyres, 0.1, 1.2, 1.9, 'steel', 0.6, 0, -0.55);
      [[-14.3, 8.5], [-14.3, 9.4]].forEach(([x, z]) => mmCyl(inside, 0.36, 1.1, 'blue', x, 0.65, z));
      // A big compressor and air reel on the west wall
      const comp = mmGroup(inside, -15.1, 0.1, -7.5);
      mmCyl(comp, 0.45, 1.6, 'red', 0, 0.55, 0, { axis: 'z' });
      mmBox(comp, 0.55, 0.45, 0.6, 'dark', 0, 1.0, -0.2);
      mmCyl(comp, 0.18, 0.05, 'chrome', 0.35, 1.2, 0.3, { axis: 'x' });
      g.userData.parts = parts;
      g.userData.inside = inside;
      // the equipment joins per material on its own (the lift carriages move), then the shell
      wsMergeStatic(inside, new Set(), parts.columns);
      wsMergeStatic(g, new Set(s.roofs), [inside]);
      scene.add(g);
      s.roofs.forEach(r => { wnRoofs.push(r); if (typeof cutawayRoofMeshes !== 'undefined') cutawayRoofMeshes.push(r); });
      if (typeof mergeStaticMeshesSoon === 'function') mergeStaticMeshesSoon(g, () => [...s.roofs, inside]);
      const gap = c => [c - G.door.w / 2 - 0.3, c + G.door.w / 2 + 0.3];
      wnWallObstacles(G.x, G.z, G.w, G.d, G.z + G.d / 2, fronts.map(gap), backs.map(gap), false);
      // What stands inside: the columns of the lift, the pit rail, the bench, cabinets, shelves, drums
      const H = (lx, lz, r) => { const p = hallToWorld(lx, lz); return { x: p.x, z: p.z, r, workshop: true, north: true }; };
      addObstacle(...[[-2.3, -3.6], [2.3, -3.6], [-2.3, 3.6], [2.3, 3.6]].map(([dx, dz]) => H(lift.x + dx + Math.sign(dx) * 0.45, dz, 0.45)),
        H(pit.x, -5.3, 0.6), H(pit.x + 2.4, 3.2, 0.45), H(lift.x - 3.2, -5.2, 0.4),
        H(-5.5, backZ, 0.6), H(-4, backZ, 0.6), H(-2.5, backZ, 0.6), H(1.6, backZ, 0.55), H(2.6, backZ, 0.55), H(6.6, backZ, 0.55),
        H(10, backZ - 0.2, 0.6), H(11, backZ - 0.2, 0.6), H(13.8, -3.6, 0.7), H(13.8, -2.4, 0.7), H(wash.x + 2.8, -7.5, 0.7),
        H(-14.3, 8.5, 0.45), H(-14.3, 9.4, 0.45), H(-15.1, -7.5, 0.6), H(-15.1, -8.3, 0.5), H(-15.1, -6.7, 0.5));
      wnBuilt.hall = g;
      return g;
    }

// --- The big hangar ---------------------------------------------------------------------------------
function buildNorthHangar3D() {
      if (wnBuilt.hangar || !scene) return;
      const H = NORTH_HANGAR, hx = H.w / 2, hz = H.d / 2;
      // a back door for people (and the forklift) on the south face, by the lane
      const s = wnShed({ w: H.w, d: H.d, h: H.h, rise: H.rise, front: [0], back: [{ c: 0, w: 4.4, h: 4.9 }, { c: -14, w: 1.5, h: 3.1 }], doorW: H.door.w, doorH: H.door.h,
        sign: 'HANGAR 2  •  ASSEMBLY & PARKING', signW: 9, bollards: false, backWindows: { c: 14, w: 20 } });
      const g = s.g;
      g.position.set(H.x, WORKSHOP_PAD_Y, H.z);
      g.rotation.y = Math.PI;
      g.userData.isWorkshop = true;
      wnFade.hangar = s.sides;
      const yellow = mmMat('yellow'), navy = mmMat('navy'), white = mmMat('white');
      const inside = mmGroup(g, 0, 0, 0);
      NORTH_HANGAR_BAYS.forEach(b => wnPaintBay(g, b, b.kind === 'build' ? yellow : b.kind === 'parking' ? white : mmMat('hazard'), b.kind !== 'parking', inside));
      // span gauge along the back of each build bay (every metre)
      NORTH_HANGAR_BAYS.filter(b => b.kind === 'build').forEach(b => { for (let i = -6; i <= 6; i++) mmBox(g, 0.05, 0.008, i % 5 ? 0.4 : 0.7, yellow, b.x + i * 1.6, 0.125, b.z - b.d / 2 + 0.35); });
      // The bridge crane over both build bays
      [-hz + 0.5, hz - 0.5].forEach(z => mmBox(g, H.w - 0.6, 0.32, 0.32, yellow, 0, H.craneY, z));
      const crane = mmGroup(g, -8, H.craneY + 0.32, 0);
      mmBox(crane, 0.45, 0.6, H.d - 1.0, yellow, -0.45, 0, 0);
      mmBox(crane, 0.45, 0.6, H.d - 1.0, yellow, 0.45, 0, 0);
      const trolley = mmGroup(crane, 0, -0.2, 2);
      mmBox(trolley, 1.3, 0.55, 0.9, mmMat('dark'), 0, 0, 0);
      const hook = mmGroup(trolley, 0, -0.1, 0);
      mmCyl(hook, 0.012, 3.5, 'steel', 0, -1.75, 0);
      mmBox(hook, 0.32, 0.32, 0.16, yellow, 0, -3.6, 0);
      mmLabel(crane, '20 T', 0.6, 0.3, 0.7, 0.3, 0, { bg: '#facc15', fg: '#111827', ry: Math.PI / 2 });
      g.userData.crane = crane;
      g.userData.hook = hook;
      // Parts carts, trestles and a work platform by the build bays; a tug charger by the back door
      NORTH_HANGAR_BAYS.filter(b => b.kind === 'build').forEach((b, i) => {
        const cart = mmGroup(inside, b.x + (i ? -1 : 1) * (b.w / 2 - 1.2), 0.1, b.z - b.d / 2 + 1.2);
        mmBox(cart, 0.9, 0.05, 0.6, 'red', 0, 0.35, 0);
        mmBox(cart, 0.9, 0.05, 0.6, 'red', 0, 0.9, 0);
        [-0.42, 0.42].forEach(x => mmBox(cart, 0.04, 0.95, 0.04, 'red', x, 0, 0.27));
        [-3, 3].forEach(x => { mmBox(inside, 1.2, 0.08, 0.3, 'wood', b.x + x, 0.95, b.z - 2); [-0.5, 0.5].forEach(dx => mmBox(inside, 0.06, 0.95, 0.4, 'wood', b.x + x + dx, 0.1, b.z - 2)); });
        const plat = mmGroup(inside, b.x + (i ? 1 : -1) * (b.w / 2 - 1.6), 0.1, b.z + 3);
        mmBox(plat, 1.6, 0.06, 1.2, 'steel', 0, 1.8, 0);
        [[-0.75, -0.55], [0.75, -0.55], [-0.75, 0.55], [0.75, 0.55]].forEach(([x, z]) => mmBox(plat, 0.06, 1.8, 0.06, 'steel', x, 0, z));
        mmBox(plat, 1.6, 0.05, 0.05, yellow, 0, 2.8, -0.58);
        for (let k = 1; k < 6; k++) mmBox(plat, 0.6, 0.04, 0.2, 'steel', 0, k * 0.3, 0.75 + k * 0.12);
      });
      const charger = mmGroup(inside, -6, 0.1, -hz + 0.6);
      mmBox(charger, 0.8, 1.4, 0.4, 'green', 0, 0, 0);
      mmBox(charger, 0.5, 0.3, 0.04, 'screen', 0, 1.0, 0.21);
      mmLabel(inside, 'KEEP CLEAR  •  CRANE OVERHEAD', 5, 0.55, 0, 0.13, hz - 0.8, { bg: '#b9bab5', fg: '#b91c1c' }).rotation.x = -Math.PI / 2;
      // Apron outside the door (concrete, with a yellow centre line toward the taxiway)
      const apronMat = new THREE.MeshStandardMaterial({ color: 0xa8a49b, roughness: 0.9, map: wsConcreteTexture() });
      wsPanel(g, H.door.w + 4, 0.06, 6, apronMat, 0, -0.05, hz + 3, 3.2).castShadow = false;
      for (let z = hz + 1; z < hz + 6; z += 1.4) mmBox(g, 0.18, 0.012, 0.8, yellow, 0, 0.02, z);
      g.userData.inside = inside;
      wsMergeStatic(inside, new Set(), []);
      wsMergeStatic(g, new Set(s.roofs), [inside, crane]);
      scene.add(g);
      s.roofs.forEach(r => { wnRoofs.push(r); if (typeof cutawayRoofMeshes !== 'undefined') cutawayRoofMeshes.push(r); });
      if (typeof mergeStaticMeshesSoon === 'function') mergeStaticMeshesSoon(g, () => [...s.roofs, inside, crane]);
      wnWallObstacles(H.x, H.z, H.w, H.d, null, [[-H.door.w / 2 - 0.3, H.door.w / 2 + 0.3]], [[-2.5, 2.5], [-14.9, -13.1]], true);
      const O = (lx, lz, r) => { const p = northHangarToWorld(lx, lz); return { x: p.x, z: p.z, r, workshop: true, north: true }; };
      const obs = [O(-6, -hz + 0.6, 0.5)];
      NORTH_HANGAR_BAYS.filter(b => b.kind === 'build').forEach((b, i) => {
        obs.push(O(b.x + (i ? -1 : 1) * (b.w / 2 - 1.2), b.z - b.d / 2 + 1.2, 0.55), O(b.x + (i ? 1 : -1) * (b.w / 2 - 1.6), b.z + 3, 0.95));
      });
      addObstacle(...obs);
      wnBuilt.hangar = g;
      return g;
    }

// --- Cost while he isn't near: drawn only when the range doesn't hide them, filled in only close up ---
// From the valley the crest of the range hides the north land, except through the pass. A few sight
// lines from the camera to the north buildings (and the yard's middle) are tested against the ground.
function wnSightClear(c, tx, ty, tz) {
      for (let k = 1; k < 40; k++) {
        const f = k / 40, x = c.x + (tx - c.x) * f, z = c.z + (tz - c.z) * f, y = c.y + (ty - c.y) * f;
        if (getAnalyticalGroundHeight(x, z) > y + 0.5) return false;
      }
      return true;
    }

// { buildings, ground }: can the camera see either building (corners, roof ridges) / the pass and yard?
function wnInSight() {
      if (!camera) return { buildings: true, ground: true };
      const c = camera.position;
      if (c.z < -60) return { buildings: true, ground: true };
      const G = GARAGE_HALL, H = NORTH_HANGAR;
      const bld = [];
      [[G, 10.5], [H, 13.6]].forEach(([B, top]) => [-1, 1].forEach(sx => [-1, 1].forEach(sz => bld.push([B.x + sx * B.w / 2, top, B.z + sz * B.d / 2]))));
      const buildings = bld.some(([x, y, z]) => wnSightClear(c, x, y, z));
      const ground = buildings || [[62, 0.5, -60], [62, 0.5, -100], [40, 0.5, -150], [100, 0.5, -150], [20, 0.5, -110]].some(([x, y, z]) => wnSightClear(c, x, y, z));
      return { buildings, ground };
    }

// Far away each building is a plain box and roof (two draw calls instead of its whole shell)
const WN_FAR = 110;
const wnFar = { hall: null, hangar: null };
function wnFarBox(B, rotY, clad, roof) {
      const g = new THREE.Group();
      const walls = new THREE.Mesh(new THREE.BoxGeometry(B.w, B.h, B.d), clad);
      walls.position.y = B.h / 2;
      const shape = new THREE.Shape([new THREE.Vector2(-B.d / 2 - 0.5, 0), new THREE.Vector2(B.d / 2 + 0.5, 0), new THREE.Vector2(0, B.rise)]);
      const r = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: B.w + 0.8, bevelEnabled: false }), roof);
      r.rotation.y = Math.PI / 2;
      r.position.set(-B.w / 2 - 0.4, B.h, 0);
      g.add(walls, r);
      g.position.set(B.x, WORKSHOP_PAD_Y, B.z);
      g.rotation.y = rotY;
      g.visible = false;
      scene.add(g);
      return g;
    }

const wnView = { at: 0, seen: true, ground: true, key: '' };
function wnUpdateView(now) {
      if (now - wnView.at < 300) return;
      wnView.at = now;
      const v = wnTrip.active ? { buildings: true, ground: true } : wnInSight();
      wnView.seen = v.buildings;
      const show = (key, B) => {
        const g = wnBuilt[key], far = wnFar[key];
        if (!g) return '';
        const d = camera ? Math.hypot(camera.position.x - B.x, camera.position.z - B.z, camera.position.y) : 0;
        const full = v.buildings && (d < WN_FAR || wnTrip.active), imp = v.buildings && !full;
        g.visible = full;
        if (far) far.visible = imp;
        return `${full ? 1 : 0}${imp ? 1 : 0}`;
      };
      wnView.key = show('hall', GARAGE_HALL) + show('hangar', NORTH_HANGAR);
      if (v.ground !== wnView.ground) {
        wnView.ground = v.ground;
        if (typeof northPatchMesh !== 'undefined' && northPatchMesh) northPatchMesh.visible = v.ground;
      }
    }

// The insides (equipment, carts, the crane's hook) only while the camera is close
function wnShowInsides(on) {
      [wnBuilt.hall, wnBuilt.hangar].forEach(g => { if (g && g.userData.inside) g.userData.inside.visible = on; });
    }

// --- Cutaway: roofs with the switch; while he is inside, the roof and the wall nearest the camera fade --
function wnInside(p) {
      const G = GARAGE_HALL, H = NORTH_HANGAR;
      if (Math.abs(p.x - G.x) < G.w / 2 && Math.abs(p.z - G.z) < G.d / 2) return 'hall';
      if (Math.abs(p.x - H.x) < H.w / 2 && Math.abs(p.z - H.z) < H.d / 2) return 'hangar';
      return null;
    }

const wnFadeState = { key: '' };
function wnUpdateFade() {
      const where = wnInside(state.botPos);
      let key = where || '';
      let side = null;
      if (where && camera) {
        const B = where === 'hall' ? GARAGE_HALL : NORTH_HANGAR, rot = where === 'hangar';
        const dx = camera.position.x - B.x, dz = camera.position.z - B.z;
        // the wall facing the camera, in the building's own terms (the hangar is turned round)
        const lx = rot ? -dx : dx, lz = rot ? -dz : dz;
        side = Math.abs(lz) / B.d > Math.abs(lx) / B.w ? (lz > 0 ? 'front' : 'back') : (lx > 0 ? 'east' : 'west');
        key += ':' + side;
      }
      key += ':' + Boolean(state.roofCutaway);
      if (key === wnFadeState.key) return;
      wnFadeState.key = key;
      ['hall', 'hangar'].forEach(b => {
        const g = wnBuilt[b];
        if (!g) return;
        const on = where === b;
        g.traverse(o => { if (wnRoofs.includes(o)) o.material.opacity = on ? 0.1 : state.roofCutaway ? 0.18 : 0.95; });
        Object.entries(wnFade[b] || {}).forEach(([sd, list]) => list.forEach(mat => wnSetFade(mat, on && sd === side ? 0.14 : 1)));
      });
    }

function wnSetFade(mat, opacity) {
      if (!mat || mat.opacity === opacity) return;
      mat.transparent = opacity < 1;
      mat.opacity = opacity;
      mat.depthWrite = opacity >= 1;
      mat.needsUpdate = true;
    }

// --- The hall's own trips: a big vehicle in through its bay's door, serviced, and back out ----------
const wnTrip = { active: false, vehicle: null, trailer: null };

// fn(k 0..1 by the clock, seconds since start), once a frame (keloTween, js/scene.js: frame-driven, a slow
// timer in a hidden tab)
function wnAnimate(ms, fn) {
      if (typeof keloTween === 'function') {
        const t0 = performance.now();
        return keloTween(ms, k => { try { fn(k, (performance.now() - t0) / 1000); } catch (e) { console.warn(e); } });
      }
      return new Promise(resolve => {
        const start = performance.now();
        const step = () => {
          const k = Math.min(1, (performance.now() - start) / ms);
          try { fn(k, (performance.now() - start) / 1000); } catch (e) { console.warn(e); }
          if (k >= 1) return resolve();
          if (document.hidden) setTimeout(step, 50); else requestAnimationFrame(step);
        };
        step();
      });
    }

// Drive the vehicle he sits in along points (eased, facing the way it goes, or keeping its heading
// when reversing); a hitched trailer follows
async function wnDriveAlong(v, pts, ms, reverse = false) {
      const mesh = vehicleMeshes[v.id];
      let from = { x: state.botPos.x, z: state.botPos.z };
      const total = pts.reduce((s, p, i) => s + Math.hypot(p.x - (i ? pts[i - 1].x : from.x), p.z - (i ? pts[i - 1].z : from.z)), 0) || 1;
      for (const p of pts) {
        const len = Math.hypot(p.x - from.x, p.z - from.z);
        if (len < 0.05) continue;
        const want = Math.atan2(p.x - from.x, p.z - from.z) + (reverse ? Math.PI : 0);
        const r0 = state.botRotY;
        let dr = ((want - r0 + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        if (Math.abs(dr) > 0.05) await wnAnimate(600 + Math.abs(dr) * 500, k => { state.botRotY = r0 + dr * k * k * (3 - 2 * k); if (mesh && wnTrip.trailer) wsTowTrailer(mesh); });
        const a = { ...from };
        await wnAnimate(ms * len / total, k => {
          const e = k * k * (3 - 2 * k);
          state.botPos = { x: a.x + (p.x - a.x) * e, z: a.z + (p.z - a.z) * e };
          state.targetPos = { ...state.botPos };
          if (mesh && wnTrip.trailer) { mesh.updateMatrixWorld(); wsTowTrailer(mesh); }
        });
        from = { x: p.x, z: p.z };
      }
    }

function wnBoard(v) {
      state.riding = v.id;
      state.ridingMode = 'land';
      state.botPos = { x: v.x, z: v.z };
      state.targetPos = { ...state.botPos };
      state.botRotY = (v.rotY || 0) + Math.PI / 2;
    }

function wnPark(v) {
      v.x = Math.round(state.botPos.x * 10) / 10;
      v.z = Math.round(state.botPos.z * 10) / 10;
      v.rotY = state.botRotY - Math.PI / 2;
      state.riding = null;
      state.ridingMode = null;
      if (typeof renderVehicles3D === 'function') renderVehicles3D();
      state.botPos = typeof boardingSpot === 'function' ? boardingSpot(v) : { x: v.x - 2, z: v.z };
      state.targetPos = { ...state.botPos };
    }

async function wnWalk(p, ms = 20000) {
      state.targetPos = { x: p.x, z: p.z };
      await waitForArrival(ms);
    }

async function wnStep(title, ms, fn, say) {
      state.moodTitle = String(title).slice(0, 80);
      if (say) state.speechBubble = say;
      if (typeof renderAllUI === 'function') renderAllUI();
      await wnAnimate(ms, (k, t) => { if (fn) fn(k, t); });
    }

// Does this vehicle belong in the hall rather than up the car elevator? (too long, wide or tall for
// door 1 and the platform, asked for on purpose, or the pickup bringing its trailer)
function vehicleSizeOf(v) {
      const m = typeof vehicleMeshes !== 'undefined' && vehicleMeshes[v.id];
      if (!m) return null;
      const ry = m.rotation.y;
      m.rotation.y = 0;
      m.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(m), s = new THREE.Vector3();
      m.rotation.y = ry;
      m.updateMatrixWorld(true);
      b.getSize(s);
      return { x: s.x, y: s.y, z: s.z };
    }

function garageHallWanted(v, job = {}) {
      if (!v) return false;
      if (job.hall || job.trailer) return true;
      const size = vehicleSizeOf(v);
      if (!size || typeof wsFitsOne !== 'function') return false;
      const f = wsFitsOne(size);
      return !(f.door1 && f.carElevator && f.garageLift);
    }

// The garage job in the hall: the same services (and supplies) as the Workshop's floor-2 garage
function garageHallPlan(job, v, service) {
      const svc = GARAGE_SERVICES[service];
      const vname = plainItem(v.name).toLowerCase();
      const bay = garageHallBays().find(b => b.key === (job.trailer ? 'g1' : service === 'oil' ? 'g2' : 'g3'));
      return {
        title: `${svc.title[0].toUpperCase()}${svc.title.slice(1)} on the ${vname} in the garage hall`, product: `${svc.title} on the ${vname}`,
        speech: `Taking the ${vname} over the pass to the garage hall for ${svc.title}.`,
        visit: () => garageHallVisit(v, service, bay, job),
        finish: () => {
          const s = vehicleService(v);
          s[service] = 0;
          if (service === 'engine') s.oil = 0;
          v.wear = Math.round(100 - vehicleCondition(v));
          machineSkill('garage', 8);
          state.moodEmoji = '🔧';
          state.moodTitle = `Finished ${svc.title} on the ${vname}`.slice(0, 80);
          state.speechBubble = `All done: the ${vname} is at ${vehicleCondition(v)}% now.`;
          state.diaryEntries.unshift({
            time: 'In the Garage Hall', location: 'his garage hall', mood: `🔧 ${state.moodTitle}`.slice(0, 80),
            vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
            text: `Dear Diary, I drove the ${vname} over the pass to my garage hall (${bay.label.toLowerCase()}) and did ${svc.title} myself. It's at ${vehicleCondition(v)}% condition now.`
          });
          showToast(`🔧 Kelo-1 did ${svc.title} on the ${vname} in the garage hall`);
        }
      };
    }

async function garageHallVisit(v, service, bay, job = {}) {
      buildGarageHall3D();
      const mesh = vehicleMeshes[v.id];
      if (!mesh || typeof driveVehicle !== 'function') return false;
      const home = { x: v.x, z: v.z, rotY: v.rotY || 0 };
      const nm = plainItem(v.name).toLowerCase();
      const G = GARAGE_HALL, parts = wnBuilt.hall.userData.parts;
      const N = Math.PI, inside = { x: bay.x, z: G.z + 1.2 };
      const results = [];
      try {
        // Over the pass to the yard in front of its bay door
        await driveVehicle(v, bay.front, `Driving the ${nm} to the garage hall`);
        if (state.riding || Math.hypot(v.x - bay.front.x, v.z - bay.front.z) > 4) return false;
        wnTrip.active = true;
        wnTrip.vehicle = v;
        wnShowInsides(true);
        wnBoard(v);
        if (job.trailer && typeof wsHitchTrailer === 'function') {
          const saved = workshopTrip.trailer;
          wnTrip.trailer = wsHitchTrailer(v) ? workshopTrip.trailer : null;
          if (saved && saved !== wnTrip.trailer) workshopTrip.trailer = saved;
        }
        state.moodTitle = `Driving the ${nm} into ${bay.label.split('•')[0].trim().toLowerCase()}`;
        await wnDriveAlong(v, [{ x: bay.x, z: bay.front.z }, { x: bay.x, z: G.z + G.d / 2 + 1 }, inside], 6500);
        state.botRotY = N;
        wnPark(v);
        const side = { x: bay.x - 3.0, z: G.z + 2.5 };
        const lift = bay.kind === 'lift';
        const raise = async (h, ms) => {
          if (!lift) return;
          const y0 = parts.columns[0].position.y, base = WORKSHOP_PAD_Y + 0.12;
          await wnStep(h > 0 ? `Raising the ${nm} on the column lifts` : `Lowering the ${nm}`, ms, k => {
            const e = k * k * (3 - 2 * k), y = y0 + (0.25 + h - y0) * e;
            parts.columns.forEach(c => { c.position.y = y; });
            mesh.position.y = base + (y - 0.25);
          }, h > 0 ? 'All four columns synced. Up she goes.' : null);
        };
        await wnWalk(side);
        if (typeof useWorkshopSupply === 'function') useWorkshopSupply('gloves', 1, 'Garage work');
        if (lift) await wnStep('Rolling the column lifts to the wheels', 2200, null, 'Forks under every tyre, all four columns paired to the console.');
        else if (bay.kind === 'pit') await wnStep('Opening the service pit', 1600, null, 'Grating off, pit light on, down the steps.');
        await raise(service === 'oil' || service === 'engine' ? 2.2 : 1.6, 3200);
        const S = {
          tires: [['Wheels off with the impact wrench', 3000, 'Brrrt! Big truck lug nuts, 500 ft-lb.', 'airToolOil'], ['New tyres on the truck rims', 4500, 'Bead breaker, then the big tyre machine. Inflated in the cage.', 'tires'], ['Wheels on, torqued in a star pattern', 3000, 'Torque wrench: 450 ft-lb, star pattern, then again after 50 km.', 'wheelWeights']],
          oil: [['Draining the sump from the pit', 3500, 'Drain plug out, 30 litres into the caddy.', null], ['New filter, fresh oil', 4000, 'Filter on hand-tight plus three quarters. 28 litres of fresh oil.', 'engineOil'], ['Checking the level', 1500, 'Right on the full mark.', 'oilFilter']],
          brakes: [['Wheels off, calipers apart', 3500, 'Air brakes: caged the spring brakes first.', 'airToolOil'], ['New pads and shoes', 4500, 'New linings, drums measured in spec.', 'brakePads'], ['Bleeding and adjusting', 3000, 'Slack adjusters set. Brake cleaner on everything.', 'brakeCleaner']],
          engine: [['Pulling the engine with the crane hoist', 5000, 'Everything disconnected and labelled. Out it comes.', 'gasketSet'], ['Rebuilding it on the stand', 6000, 'New gaskets, rings and bearings.', 'solvent'], ['Engine back in and filled', 4500, 'Torqued to spec, fresh oil, and it fires first time.', 'engineOil']],
          body: [['Grinding out the frame crack', 3000, 'V-groove ground to bright steel.', null], ['MIG welding the frame', 4500, 'Helmet down. A nice stack of dimes.', 'migWire'], ['Fish plate on, primer and paint', 3000, 'Reinforced and painted.', 'shieldGas']]
        }[service] || [];
        for (const [title, ms, say, supply] of S) {
          await wnWalk({ x: bay.x + (results.length % 2 ? 2.9 : -2.9), z: G.z + (results.length % 2 ? -2 : 2.5) }, 8000);
          if (supply && typeof useWorkshopSupply === 'function') useWorkshopSupply(supply, 1, 'Garage hall');
          await wnStep(title, ms, null, say);
          results.push(true);
        }
        await raise(0, 2600);
        if (typeof machineSkill === 'function') machineSkill('garage', 2);
        // Back in the cab and out: straight on through the back door (bay 1), or reversing out the front
        await wnWalk(typeof boardingSpot === 'function' ? boardingSpot(v) : side, 8000);
        wnBoard(v);
        if (bay.back) {
          state.moodTitle = `Driving the ${nm} out through the back door`;
          await wnDriveAlong(v, [{ x: bay.x, z: G.z - G.d / 2 - 1 }, bay.back], 5000);
        } else {
          state.moodTitle = `Reversing the ${nm} out of the bay`;
          await wnDriveAlong(v, [{ x: bay.x, z: G.z + G.d / 2 + 1 }, bay.front], 6000, true);
        }
        wnPark(v);
        return results.length ? results : [true];
      } finally {
        if (wnTrip.trailer && wnTrip.trailer.mesh && wnTrip.trailer.mesh.parent) wnTrip.trailer.mesh.parent.remove(wnTrip.trailer.mesh);
        if (workshopTrip.trailer === wnTrip.trailer) workshopTrip.trailer = null;
        Object.assign(wnTrip, { active: false, vehicle: null, trailer: null });
        if (state.riding === v.id) wnPark(v);
        if (parts) parts.columns.forEach(c => { c.position.y = 0.25; });
        // Home again, where it was parked
        if (Math.hypot(v.x - home.x, v.z - home.z) > 3) {
          try { await driveVehicle(v, { x: home.x, z: home.z }, `Driving the ${nm} home`); } catch (e) { console.warn(e); }
        }
      }
    }

// --- Bays for builds and vehicles (extends js/workshopbuilding.js) ------------------------------------
// workshopAssemblyBay(3) and (4) are the big hangar's build bays; their builds face the north door.
// (The airplane keeps build bay 1: its flights start from the first hangar's door onto the helipad.)
function northAssemblyBay(n) {
      const bays = northHangarBays('build'), bay = bays[n - 3] || bays[0];
      const H = NORTH_HANGAR;
      return {
        key: bay.key, x: bay.x, y: bay.y, z: bay.z, w: bay.w, d: bay.d, rotY: 0, north: true,
        craneHookY: WORKSHOP_PAD_Y + H.craneY - 3.5,
        door: { x: H.x, z: H.z - H.d / 2, w: H.door.w, h: H.door.h, facing: 'north' },
        outside: { x: bay.x, z: H.z - H.d / 2 - 3 }
      };
    }

if (typeof workshopAssemblyBay === 'function') {
  const wnOrigAssemblyBay = workshopAssemblyBay, wnOrigAssemblyBays = workshopAssemblyBays, wnOrigParking = workshopParkingSpots, wnOrigFits = workshopFits;
  workshopAssemblyBay = function (n = 1) { return n >= 3 ? northAssemblyBay(n) : wnOrigAssemblyBay(n); };
  workshopAssemblyBays = function () { return [...wnOrigAssemblyBays(), northAssemblyBay(3), northAssemblyBay(4)]; };
  workshopParkingSpots = function () { return [...wnOrigParking(), ...northHangarBays('parking'), ...garageHallBays().map(b => ({ ...b, kind: 'parking', label: `Garage hall ${b.label}` }))]; };
  // workshopFits(size) also answers for the big hangar and the hall: bays.build3/4, park3-5, hall
  workshopFits = function (sizeOrList) {
    const r = wnOrigFits(sizeOrList);
    const add = (size, out) => {
      const L = Math.max(size.x, size.z), W = Math.min(size.x, size.z), Hh = size.y;
      const inBay = b => L < Math.max(b.w, b.d) + 0.01 && W < Math.min(b.w, b.d) + 0.01;
      if (!out.bays) out.bays = {};
      NORTH_HANGAR_BAYS.filter(b => b.kind !== 'lane').forEach(b => { out.bays[b.key] = inBay(b) && Hh < NORTH_HANGAR.craneY - 0.5; });
      out.northHangarDoor = W < NORTH_HANGAR.door.w - 0.6 && Hh < NORTH_HANGAR.door.h - 0.3;
      out.hallDoor = W < GARAGE_HALL.door.w - 0.4 && Hh < GARAGE_HALL.door.h - 0.3;
      out.hallBay = out.hallDoor && L < GARAGE_HALL.d - 2.5;
      out.hallDriveThrough = out.hallDoor && L < GARAGE_HALL.d + 20;
      return out;
    };
    if (!Array.isArray(sizeOrList)) return add(sizeOrList, r);
    (r.each || []).forEach((e, i) => { const it = sizeOrList[i]; add(it && it.size ? it.size : it, e); });
    return r;
  };
}

// The Workshop viewer (js/shopvisit.js): the two halls are areas you can walk round
if (typeof SV_AREAS !== 'undefined') {
  SV_AREAS.push({ key: 'hall', icon: '🔧', name: 'Garage hall (north yard)', short: 'Hall', floor: 1, note: 'drive-through, service pit, heavy lift, wash bay' },
    { key: 'hangar2', icon: '🛩️', name: 'Big hangar (north yard)', short: 'Hangar 2', floor: 1, note: 'build bays 3 and 4, parking, crane' });
}

// The minimap and Map tab (north sheet): the two buildings
if (typeof minimapBuildings === 'function') {
  const wnOrigBuildings = minimapBuildings;
  minimapBuildings = function () {
      const b = wnOrigBuildings();
      b.push({ x: GARAGE_HALL.x, z: GARAGE_HALL.z, w: GARAGE_HALL.w, d: GARAGE_HALL.d, color: '#475569', icon: '🔧' });
      b.push({ x: NORTH_HANGAR.x, z: NORTH_HANGAR.z, w: NORTH_HANGAR.w, d: NORTH_HANGAR.d, color: '#1e3a5f', icon: '✈️' });
      return b;
    };
}

// The AI's picture of the Workshop includes the north yard
if (typeof workshopSummaryForAI === 'function') {
  const wnOrigSummary = workshopSummaryForAI;
  workshopSummaryForAI = function () { return `${wnOrigSummary()}. ${northYardSummaryForAI()}`; };
}

// For the AI: what the north yard holds
function northYardSummaryForAI() {
      const free = northHangarBays('build').filter(b => !(state.buildProjects || []).some(p => p.site && p.site.bayKey === b.key && p.status !== 'finished' && p.status !== 'complete'));
      return `North yard (over the pass behind the Workshop): garage hall with 4 tall bays (drive-through for the pickup and trailer, service pit, heavy column lift, wash) for vehicles too big for door 1 and the car elevator; big hangar with build bays 3 and 4 (${free.length} free) and 3 parking bays. Runway field north of it: ${RUNWAY_FIELD.developed ? 'runway built' : 'undeveloped, kept clear'}.`;
    }

function buildWorkshopNorth3D() {
      try { buildGarageHall3D(); } catch (e) { console.warn('garage hall', e); }
      try { buildNorthHangar3D(); } catch (e) { console.warn('big hangar', e); }
      try {
        const clad = new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.6, metalness: 0.2 }), roof = new THREE.MeshStandardMaterial({ color: 0x8b98a6, roughness: 0.6, metalness: 0.4 });
        wnFar.hall = wnFarBox(GARAGE_HALL, 0, clad, roof);
        wnFar.hangar = wnFarBox(NORTH_HANGAR, Math.PI, clad, roof);
      } catch (e) { console.warn('north far boxes', e); }
      wnShowInsides(false);
      if (typeof perfWatchBuilding === 'function') {
        perfWatchBuilding({
          key: 'workshop-north', radius: 34,
          center: () => new THREE.Vector3(62, 5, -128),
          forced: () => Boolean(wnTrip.active) || Boolean(wnInside(state.botPos)),
          show: near => wnShowInsides(near)
        });
      } else wnShowInsides(true);
      if (typeof keloEveryFrame === 'function') keloEveryFrame(now => { wnUpdateView(now); wnUpdateFade(); });
      else setInterval(() => { wnUpdateView(performance.now()); wnUpdateFade(); }, 300);
    }

(function wnStart() {
  const go = () => { if (typeof scene !== 'undefined' && scene && typeof wsRibTexture === 'function') buildWorkshopNorth3D(); else setTimeout(go, 500); };
  setTimeout(go, 0);
})();
