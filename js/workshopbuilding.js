// Kelo-bot-1 — js/workshopbuilding.js
// Loaded after machinemodels.js. His Workshop: a big two-storey steel building to the right (east)
// of the helipad. Steel cladding, three roll-up doors, clerestory windows, high-bay lights,
// painted floor lines and signs. Inside:
//   - Floor 1, the fabrication shop: every kind of 3D printer, the CNC routers, two Haas mills, the
//     Waldrich Coburg Taurus in its own double-height bay, his work bench, a weld bay and a
//     hangar/assembly bay with its own big door.
//   - Floor 2, reached by a CAR ELEVATOR (a platform lift a truck fits on): the electronics line and
//     the garage. Floor 2's machines are built only while he is up there.
// The machines themselves come from js/additive.js, js/cnc.js, js/electronics.js and js/garage.js
// (registerWorkshopMachine); what he does with them is js/machines.js. Floor 1's machines are
// built in full only while the camera is near (js/perf.js); far away they are plain boxes.
// He walks in through the front door (the indoor-trip walk from js/basements.js), and with the
// roofs on "cutaway" you can watch him at work.

// Centre and footprint (world units). Other buildings (the concrete plant) place themselves by it.
// It stands north of the concrete and asphalt plant's pad (js/plants.js, z 0.7 to 7.2), cut into the
// foot of the eastern cliff, with its vehicle lane running down the east side of the plant to the shore.
const WORKSHOP_SITE = { x: 53.5, z: -7.1, w: 16, d: 15 };
const WORKSHOP_PAD_Y = 0.05;            // the levelled ground it stands on (level with the plant's pad)
// The north wing (Workshop-local coordinates, x across, z towards the front): a single-storey CNC
// hall behind the main building, level with the hangar's back wall. The Haas mills, the pallet racking
// and the forklift charger are in it, and an east-west forklift aisle runs its length. That aisle is
// also the drive-through: hangar door -> hangar lane -> wing (door from the hangar) -> through the
// shop's back wall -> the floor-1 east aisle over the car elevator -> out of door 1 onto the lane.
// (7b, once the map grows: the wing can lengthen west or grow a storey; its contents are listed in
// WS_WING.spots and the machine defs, not baked into the walls.)
const WS_WING = {
  x: 0, z: -11.45, w: 16, d: 7.9, h: 5.6,
  aisleZ: -10.9, aisleW: 4.2,                                  // the forklift aisle / drive-through lane
  doors: { shop: { x: 5.85, w: 4.15, h: 4.9 }, hangar: { z: -10.9, w: 4.4, h: 4.9 } },
  spots: {
    rack: { x: -5.3, z: -14.7, w: 4.6 },                       // pallet racking on the back wall
    charger: { x: -7.55, z: -8.45, park: { x: -5.5, z: -8.45 } },
    barRack: { x: 6.75, z: -14.6, w: 1.8 }                       // cantilever rack for bar stock and sheet
  }
};
// The land the Workshop adds and levels: its pad (cut into the cliff behind) and the vehicle lane
// along the east edge down to a gravel beach. Other land (the plant's pad) joins it along z 0.6.
const WORKSHOP_LAND = {
  pad: { minX: WORKSHOP_SITE.x - WORKSHOP_SITE.w / 2 - 1.2, maxX: WORKSHOP_SITE.x + WORKSHOP_SITE.w / 2 + 1.2, minZ: WORKSHOP_SITE.z + WS_WING.z - WS_WING.d / 2 - 1.0, maxZ: WORKSHOP_SITE.z + WORKSHOP_SITE.d / 2 + 0.3 },
  lane: { minX: WORKSHOP_SITE.x + 5.85 - 2.6, maxX: WORKSHOP_SITE.x + WORKSHOP_SITE.w / 2 + 1.0, minZ: WORKSHOP_SITE.z, maxZ: 9.0 },
  // The hangar's pad (js/workshopbuilding.js, buildWorkshopHangar3D) and its apron down to the helipad
  hangar: { minX: 23.6, maxX: 45.6, minZ: -22.9, maxZ: -6.9 },
  y: WORKSHOP_PAD_Y, blend: 3.2, blendNorth: 9, shore: 1.4
};
// The hangar and assembly high bay: a single big bay beside the Workshop (west, north of the
// helipad) for his biggest projects and vehicles: an ultralight with a 10 m span (16 units), a
// pickup with its trailer, the dump truck, the mixer truck. A wide, tall roll-up door faces the
// helipad so a finished plane rolls straight out onto it; a bridge crane spans the whole bay.
const WORKSHOP_HANGAR = { x: 34.6, z: -15.0, w: 21, d: 14, h: 10.5, door: { w: 18.4, h: 8.0 }, craneY: 9.2 };
// What is marked out on the hangar floor (hangar-local x, z; w across x, d along z). Build bays take
// the assembly builds, parking bays take vehicles, the lane is the drive-through and forklift lane
// to the north wing (its door is in the hangar's east wall). 7b can widen the hangar and add bays here.
const WORKSHOP_HANGAR_BAYS = [
  { key: 'build1', kind: 'build', label: 'BUILD BAY 1  •  AIRCRAFT, 10 M SPAN', x: -2.15, z: -2.0, w: 16, d: 9.7 },
  { key: 'build2', kind: 'build', label: 'BUILD BAY 2', x: -6.6, z: 4.9, w: 7.0, d: 3.6 },
  { key: 'park1', kind: 'parking', label: 'PARKING 1', x: 1.5, z: 4.9, w: 8.8, d: 3.6, ry: 0 },
  { key: 'park2', kind: 'parking', label: 'PARKING 2', x: 8.3, z: 2.9, w: 4.0, d: 7.6, ry: Math.PI / 2, lane: true },
  { key: 'lane', kind: 'lane', label: 'DRIVE-THROUGH  •  FORKLIFT', x: 8.3, z: -3.9, w: 4.0, d: 5.8 }
];
const WS_F1 = 0.12;                      // floor 1 top, above the pad
const WS_F2 = 5.4;                       // floor 2 deck top
const WS_F3 = 13.0;                      // floor 3 deck top (glass studio and woodshop)
const WS_EAVE = 19.4;

function wsFloorY(floor) {
      return floor === 3 ? WS_F3 : floor === 2 ? WS_F2 : WS_F1;
    }
const WS_IN = { x: WORKSHOP_SITE.w / 2 - 0.15, z: WORKSHOP_SITE.d / 2 - 0.15 };
// The car elevator platform (local coordinates): a truck drives straight in through the east door
const WS_LIFT = { x: 5.85, z: 2.65, w: 4.0, d: 9.3 };
const WS_LIFT_GATE = 6.0;                // where he steps on and off the platform (z)
const WS_DOORS = {
  vehicle: { x: 5.85, w: 4.15, h: 4.9 },
  hangar: { x: -5.95, w: 3.6, h: 4.9 },
  person: { x: 0.3, w: 1.5, h: 3.1 }
};
const WORKSHOP_MACHINES = {};            // key -> machine definition (registerWorkshopMachine)

// Where the welding, bench work and big assemblies happen. Other systems (js/welding.js,
// js/workbench.js, the assembly builds) can move into these: each has a world position (x, y, z),
// the way the work faces (rotY) and where he stands (stand).
const WORKSHOP_STATIONS = {
  weld: { local: { x: -2.4, z: 6.55 }, floor: 1, rotY: 0, size: { w: 2.2, d: 1.3 }, label: 'Weld bay' },
  bench: { local: { x: 2.5, z: 6.6 }, floor: 1, rotY: 0, size: { w: 2.6, d: 0.8 }, label: 'Work bench' },
  assembly: { local: { x: -5.9, z: 4.6 }, floor: 1, rotY: 0, size: { w: 16, d: 9.7 }, label: 'Hangar build bay 1', world: { x: 34.6 - 2.15, z: -15.0 - 2.0 } },
  assembly2: { local: { x: -5.9, z: 4.6 }, floor: 1, rotY: 0, size: { w: 7.0, d: 3.6 }, label: 'Hangar build bay 2', world: { x: 34.6 - 6.6, z: -15.0 + 4.9 } },
  smallAssembly: { local: { x: -5.9, z: 4.6 }, floor: 1, rotY: 0, size: { w: 3.4, d: 4.6 }, label: 'Small-parts assembly bay' },
  electronics: { local: { x: -2.9, z: -2.75 }, floor: 2, rotY: 0, size: { w: 1.6, d: 0.7 }, label: 'Electronics bench' },
  garage: { local: { x: 5.85, z: -2.0 }, floor: 2, rotY: 0, size: { w: 3.8, d: 8.4 }, label: 'Garage lift bay' }
};

// --- Levelling the ground ------------------------------------------------------------------------------
// getAnalyticalGroundHeight (js/scene.js) asks this for every point: inside the footprint and its
// apron the ground is flat at WORKSHOP_PAD_Y, and it blends back to the natural slope around it
// (cutting into the foot of the eastern cliff behind it).
function workshopRectDist(r, x, z) {
      return { dx: Math.max(0, r.minX - x, x - r.maxX), dzN: Math.max(0, r.minZ - z), dzS: Math.max(0, z - r.maxZ) };
    }

// The height of the Workshop's land at (x, z) given the natural ground there (base). Inside the pad
// or the lane it is flat; round the pad it blends back to the slope (a long cut slope into the cliff
// to the north); off the end of the lane it shelves down to the lake bed as a beach.
function workshopLandAt(x, z, base) {
      const L = WORKSHOP_LAND;
      let k = 1;
      [L.pad, L.lane, L.hangar].forEach(r => {
        const d = workshopRectDist(r, x, z);
        const blend = d.dzN > 0 ? L.blendNorth : d.dzS > 0 && r === L.lane ? L.shore : L.blend;
        const out = Math.hypot(d.dx, d.dzN, d.dzS);
        const t = Math.min(1, out / blend);
        k = Math.min(k, t * t * (3 - 2 * t));
      });
      return k >= 1 ? base : L.y + (base - L.y) * k;
    }

// (the name scene.js asks for)
function workshopPadAt(x, z, base) {
      return workshopLandAt(x, z, base);
    }

function inWorkshopSite(x, z, pad = 0) {
      const L = WORKSHOP_LAND;
      return [L.pad, L.lane, L.hangar].some(r => x > r.minX - pad && x < r.maxX + pad && z > r.minZ - pad && z < r.maxZ + pad);
    }

// A point in the building's own coordinates (x across, z towards the front doors), as a world point
function workshopToWorld(lx, lz, floor = 1) {
      const s = WORKSHOP_SITE;
      return { x: s.x + lx, z: s.z + lz, y: WORKSHOP_PAD_Y + wsFloorY(floor) };
    }

function workshopStation(key) {
      const st = WORKSHOP_STATIONS[key];
      if (!st) return null;
      if (st.world) {
        const y = WORKSHOP_PAD_Y + 0.12;
        return { key, label: st.label, x: st.world.x, y, z: st.world.z, rotY: st.rotY, floor: 1, size: st.size, stand: { x: st.world.x, y, z: st.world.z + st.size.d / 2 + 0.8 } };
      }
      const w = workshopToWorld(st.local.x, st.local.z, st.floor);
      return { key, label: st.label, x: w.x, y: w.y, z: w.z, rotY: st.rotY, floor: st.floor, size: st.size,
        stand: workshopToWorld(st.local.x, st.local.z - (st.size.d / 2 + 0.55), st.floor) };
    }

// A pin and a place on the map, and his name for it (added before the scene builds its labels)
if (typeof TOWN_LOCATIONS !== 'undefined' && !TOWN_LOCATIONS.workshop) {
  TOWN_LOCATIONS.workshop = {
    id: 'workshop', name: 'Workshop', building: "Kelo-1's Workshop", icon: '🏭',
    x: WORKSHOP_SITE.x + WS_DOORS.person.x, z: WORKSHOP_SITE.z + WORKSHOP_SITE.d / 2 + 1.2, showPin: true,
    pinColor: 'from-slate-500/90 to-sky-700/90'
  };
}

function registerWorkshopMachine(def) {
      if (!def || !def.key) return null;
      WORKSHOP_MACHINES[def.key] = { floor: 1, ...def };
      return WORKSHOP_MACHINES[def.key];
    }

function workshopMachinesOn(floor) {
      return Object.values(WORKSHOP_MACHINES).filter(m => m.floor === floor && m.at);
    }

// Where he stands to work a machine (local), in front of it unless the machine says otherwise
function machineStand(def) {
      if (def.stand) return def.stand;
      const a = def.at.ry || 0, d = (def.size ? def.size.d : 1) / 2 + 0.6;
      return { x: def.at.x + Math.sin(a) * d, z: def.at.z + Math.cos(a) * d };
    }

// Circles he walks around inside (long machines get a row of them)
function machineCircles(def) {
      const sz = def.size || { w: 1, d: 1 };
      const a = def.at.ry || 0;
      const long = Math.max(sz.w, sz.d), short = Math.min(sz.w, sz.d);
      // (close enough together that a long thin thing, a clamp rack or a bench, has no gaps to walk through)
      const n = long - short < 1e-6 ? 1 : Math.max(2, Math.ceil((long - short) / Math.max(0.3, short / 2 + 0.25)) + 1);
      const alongX = sz.w >= sz.d;
      const out = [];
      for (let i = 0; i < n; i++) {
        const off = n === 1 ? 0 : -long / 2 + short / 2 + i * (long - short) / (n - 1);
        const lx = alongX ? off : 0, lz = alongX ? 0 : off;
        out.push({ x: def.at.x + lx * Math.cos(a) + lz * Math.sin(a), z: def.at.z - lx * Math.sin(a) + lz * Math.cos(a), r: short / 2 + 0.25 });
      }
      return out;
    }

// --- Materials ------------------------------------------------------------------------------------------
let wsGroup = null;            // the whole building (at the pad, centred)
let wsFloor1 = null;           // floor 1 machines (full models while near)
let wsFloor2 = null;           // floor 2 machines (only during a trip upstairs)
let wsStandIns = null;
let wsDeckMeshes = [];
let wsDeck3Meshes = [];
let wsFloor3 = null;           // floor 3 machines (only during a trip up there)
let wsFrontFade = [];          // the front wall panels that fade so the camera can see in during a trip
let wsLift = null;             // the car elevator platform group
let wsLights = [];
let wsWindowGlass = [];
const wsModels = {};           // machine key -> its built model

function wsRibTexture() {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 8;
      const ctx = c.getContext('2d');
      // Trapezoid ribs every 32 px: a bright crown, a shaded flank and the flat pan between
      for (let x = 0; x < 128; x++) {
        const p = x % 32;
        const v = p < 6 ? 210 : p < 9 ? 250 : p < 15 ? 232 : p < 18 ? 180 : 222;
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, 0, 1, 8);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 4;
      return tex;
    }

function wsSlatTexture() {
      const c = document.createElement('canvas');
      c.width = 8;
      c.height = 64;
      const ctx = c.getContext('2d');
      for (let y = 0; y < 64; y++) {
        const p = y % 16;
        const v = p < 2 ? 150 : p < 4 ? 245 : 225 - p * 2;
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(0, y, 8, 1);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      return tex;
    }

function wsConcreteTexture() {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#d6d6d2';
      ctx.fillRect(0, 0, 128, 128);
      let seed = 7;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < 260; i++) {
        const g = 190 + Math.floor(rnd() * 50);
        ctx.fillStyle = `rgba(${g},${g},${g - 4},0.35)`;
        ctx.beginPath();
        ctx.arc(rnd() * 128, rnd() * 128, 1 + rnd() * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Saw-cut control joints
      ctx.strokeStyle = 'rgba(90,90,90,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0.5); ctx.lineTo(128, 0.5); ctx.moveTo(0.5, 0); ctx.lineTo(0.5, 128);
      ctx.stroke();
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      return tex;
    }

// Real-size texture coordinates on a box (u along its face, v up), tile units per texture repeat
function wsUV(geo, tile) {
      if (typeof worldScaleUVs === 'function') return worldScaleUVs(geo, tile);
      return geo;
    }

function wsPanel(parent, w, h, d, mat, x, y, z, tile = 2.4) {
      const geo = wsUV(new THREE.BoxGeometry(w, h, d), tile);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y + h / 2, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    }

// A wall along x (front/back) or z (sides) from a to b, with openings [{ c, w, h, y0 }]
function wsWallWithOpenings(parent, axis, fixed, a, b, h, thick, mat, openings, tile, list) {
      const segs = [];
      let cur = a;
      openings.slice().sort((p, q) => p.c - q.c).forEach(o => {
        const o0 = o.c - o.w / 2, o1 = o.c + o.w / 2;
        if (o0 > cur) segs.push([cur, o0, 0, h]);
        // Above the opening (and below it, for windows)
        segs.push([o0, o1, (o.y0 || 0) + o.h, h]);
        if (o.y0) segs.push([o0, o1, 0, o.y0]);
        cur = o1;
      });
      if (cur < b) segs.push([cur, b, 0, h]);
      segs.forEach(([s0, s1, y0, y1]) => {
        if (s1 - s0 < 0.01 || y1 - y0 < 0.01) return;
        const len = s1 - s0, mid = (s0 + s1) / 2;
        const m = axis === 'x'
          ? wsPanel(parent, len, y1 - y0, thick, mat, mid, y0, fixed, tile)
          : wsPanel(parent, thick, y1 - y0, len, mat, fixed, y0, mid, tile);
        if (list) list.push(m);
      });
    }

// --- Exterior finish shared by the Workshop and the hangar ------------------------------------------
// The town buildings' level of detail (js/materials.js kit) on a steel shed: cladding panel joints on
// the column lines, a drip flashing over the plinth, box gutters on both eaves with downspouts that
// stand on splash blocks, rake trims up the gable ends and wall-pack lamps that light after dusk.
// All static and opaque, so they are joined per material with the rest of the building.
// o: { W, D, eave (wall top), rise (roof rise), trim,
//      walls: [{ side: 'back'|'front'|'west'|'east', a, b (range along the wall), y0, flash, skip: [[a, b]] }],
//      gutter: [x0, x1], spouts: [[x, z, nx, nz]] (on the wall face, nx/nz pointing out),
//      rakes: [-1, 1], lamps: [[side, along, y]] }
let wsOutdoorLamp = null;
function wsExteriorDetail(g, o) {
      const hx = o.W / 2, hz = o.D / 2, trim = o.trim, gut = typeof bldKit === 'function' ? bldKit().gutter : mmMat('steel');
      const face = { back: [0, -1], front: [0, 1], west: [-1, 0], east: [1, 0] };
      const at = (side, u, off = 0.1) => { const [nx, nz] = face[side]; return nx ? [nx * (hx + off), u] : [u, nz * (hz + off)]; };
      // Panel joints up the column lines (a cover strip every fifth of the wall), and a drip flashing
      (o.walls || []).forEach(w => {
        const len = w.side === 'back' || w.side === 'front' ? o.W : o.D, half = len / 2, along = w.side === 'back' || w.side === 'front';
        const free = u => u > w.a && u < w.b && !(w.skip || []).some(([p, q]) => u > p - 0.25 && u < q + 0.25);
        const h = o.eave - w.y0 - 0.1;
        for (let u = -half + len / 5; u < half - 0.5; u += len / 5) {
          if (!free(u)) continue;
          const [x, z] = at(w.side, u);
          mmBox(g, along ? 0.12 : 0.05, h, along ? 0.05 : 0.12, trim, x, w.y0 + 0.05, z);
        }
        if (!w.flash) return;
        // the flashing runs between the skipped spans (doors)
        let spans = [[Math.max(-half - 0.12, w.a), Math.min(half + 0.12, w.b)]];
        (w.skip || []).forEach(([p, q]) => { spans = spans.flatMap(([s0, s1]) => (p >= s1 || q <= s0) ? [[s0, s1]] : [[s0, p - 0.15], [q + 0.15, s1]]); });
        spans.forEach(([s0, s1]) => {
          if (s1 - s0 < 0.2) return;
          const [x, z] = at(w.side, (s0 + s1) / 2);
          mmBox(g, along ? s1 - s0 : 0.08, 0.06, along ? 0.08 : s1 - s0, trim, x, w.y0, z);
        });
      });
      // Box gutters along both eaves
      const [g0, g1] = o.gutter || [-hx - 0.4, hx + 0.4], gz = hz + 0.62;
      [-1, 1].forEach(sz => mmBox(g, g1 - g0, 0.18, 0.2, gut, (g0 + g1) / 2, o.eave - 0.2, sz * gz));
      // Downspouts: the pipe down the wall, a gooseneck out to the gutter, the shoe and a splash block
      (o.spouts || []).forEach(([x, z, nx, nz]) => {
        const px = x + nx * 0.17, pz = z + nz * 0.17, sz = Math.sign(z) || 1;
        mmBox(g, 0.13, o.eave - 0.75, 0.13, gut, px, 0.2, pz);
        mmRod(g, [px, o.eave - 0.58, pz], [Math.max(g0 + 0.1, Math.min(g1 - 0.1, px)), o.eave - 0.18, sz * gz], 0.065, gut);
        mmBox(g, 0.13 + Math.abs(nx) * 0.2, 0.13, 0.13 + Math.abs(nz) * 0.2, gut, px + nx * 0.1, 0.1, pz + nz * 0.1);
        mmBox(g, nx ? 0.6 : 0.34, 0.06, nz ? 0.6 : 0.34, 'concrete', px + nx * 0.45, -0.02, pz + nz * 0.45);
        [1.2, o.eave * 0.5, o.eave - 1.0].forEach(y => mmBox(g, 0.16, 0.05, 0.16, gut, px - nx * 0.06, y, pz - nz * 0.06));
      });
      // Rake trims up the gable ends
      const pitch = Math.atan2(o.rise, hz + 0.5), rl = Math.hypot(hz + 0.5, o.rise);
      (o.rakes || [-1, 1]).forEach(sx => [-1, 1].forEach(sz => mmBox(g, 0.08, 0.24, rl, trim, sx * (hx + 0.42), o.eave + o.rise / 2 - 0.02, sz * (hz + 0.5) / 2, { centre: true, rx: sz * pitch })));
      // Wall-pack lamps (one shared glowing lens material, lit after dusk by wsUpdateLighting)
      if (!wsOutdoorLamp) {
        wsOutdoorLamp = mmGlow('window');
        wsOutdoorLamp.emissive.setHex(0xfff4d6);
        wsLights.push({ mesh: { material: wsOutdoorLamp }, outdoor: true });
      }
      (o.lamps || []).forEach(([side, u, y]) => {
        const [nx, nz] = face[side], [x, z] = at(side, u, 0.24);
        mmBox(g, nx ? 0.25 : 0.4, 0.22, nx ? 0.4 : 0.25, 'dark', x, y, z);
        mmBox(g, nx ? 0.18 : 0.32, 0.03, nx ? 0.32 : 0.18, wsOutdoorLamp, x + nx * 0.02, y - 0.02, z + nz * 0.02);
      });
    }

// --- The building ---------------------------------------------------------------------------------------
function buildWorkshop3D() {
      if (wsGroup || typeof scene === 'undefined' || !scene) return;
      const S = WORKSHOP_SITE, W = S.w, D = S.d, hx = W / 2, hz = D / 2;
      wsGroup = new THREE.Group();
      wsGroup.position.set(S.x, WORKSHOP_PAD_Y, S.z);
      wsGroup.userData.isWorkshop = true;

      const rib = wsRibTexture();
      const cladding = new THREE.MeshStandardMaterial({ color: 0xd3d8de, roughness: 0.5, metalness: 0.22, map: rib, bumpMap: rib, bumpScale: 0.03 });
      const cladDark = new THREE.MeshStandardMaterial({ color: 0x3b4a5e, roughness: 0.5, metalness: 0.25, map: rib, bumpMap: rib, bumpScale: 0.03 });
      // The front wall shares the look but fades on its own during a trip
      const cladFront = cladding.clone();
      const cladFrontDark = cladDark.clone();
      [cladFront, cladFrontDark].forEach(m => { m.transparent = true; m.opacity = 1; });
      const trim = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.5, metalness: 0.4 });
      const plinth = new THREE.MeshStandardMaterial({ color: 0x8f8f8a, roughness: 0.92 });
      const conc = wsConcreteTexture();
      const floorMat = new THREE.MeshStandardMaterial({ color: 0xb9bab5, roughness: 0.55, metalness: 0.05, map: conc });
      const slat = wsSlatTexture();
      const doorMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.45, metalness: 0.45, map: slat, bumpMap: slat, bumpScale: 0.02 });
      const steel = mmMat('steel'), yellow = mmMat('yellow');
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x9cc7e6, roughness: 0.06, metalness: 0.3, transparent: true, opacity: 0.38, emissive: 0xffd9a0, emissiveIntensity: 0 });
      wsWindowGlass.push(glassMat);
      // Real-size textures: one rib every 0.3 units, slats 0.3 apart
      rib.repeat.set(1, 1);

      // Slab and the apron in front of the doors
      const slab = wsPanel(wsGroup, W + 0.6, 0.38, D + 0.6, plinth, 0, -0.3, 0, 3);
      slab.castShadow = false;
      const floor1 = wsPanel(wsGroup, W - 0.2, 0.04, D - 0.2, floorMat, 0, WS_F1 - 0.04, 0, 3.2);
      floor1.castShadow = false;
      const apron = wsPanel(wsGroup, W + 2.4, 0.06, 1.0, floorMat, 0, -0.04, hz + 0.6, 3.2);
      apron.castShadow = false;
      // The paved vehicle lane from door 1 down the east side to the beach (WORKSHOP_LAND.lane)
      const ln = WORKSHOP_LAND.lane, laneZ1 = ln.maxZ - 0.9 - S.z, laneZ0 = hz + 1.1;
      const asphalt = new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.85, metalness: 0.02, map: conc });
      // (east of x 58.6: the plant's pad, js/plants.js, ends there)
      const lx0 = Math.max(ln.minX, 58.6), lx1 = ln.maxX - 0.3;
      const lanePave = wsPanel(wsGroup, lx1 - lx0, 0.04, laneZ1 - laneZ0, asphalt, (lx0 + lx1) / 2 - S.x, -0.03, (laneZ0 + laneZ1) / 2, 3.2);
      lanePave.castShadow = false;
      for (let z = laneZ0 + 1.0; z < laneZ1 - 0.6; z += 2.2) mmBox(wsGroup, 0.12, 0.006, 1.1, 'yellow', (lx0 + lx1) / 2 - S.x, 0.012, z);

      // Walls: a concrete plinth course, then steel cladding up to the eaves, with a dark band
      // and the clerestory glazing high up on the long walls
      const wallT = 0.16;
      const doorOpen = Object.values(WS_DOORS).map(d => ({ c: d.x, w: d.w, h: d.h }));
      // Front (south): doors, windows on floor 2
      const frontWin = [{ c: -1.9, w: 3.2, h: 1.4, y0: 7.2 }, { c: 1.9, w: 2.6, h: 1.4, y0: 7.2 }, { c: -1.9, w: 3.2, h: 1.4, y0: 14.8 }, { c: 1.9, w: 2.6, h: 1.4, y0: 14.8 }];
      wsWallWithOpenings(wsGroup, 'x', hz, -hx, hx, 0.9, wallT + 0.04, plinth, doorOpen.map(o => ({ ...o, h: 0.9 })), 2.4, wsFrontFade);
      const frontGroup = mmGroup(wsGroup, 0, 0.9, 0);
      wsWallWithOpenings(frontGroup, 'x', hz, -hx, hx, WS_EAVE - 0.9 - 2.0, wallT, cladFront,
        [...doorOpen.map(o => ({ ...o, h: o.h - 0.9 })), ...frontWin.map(o => ({ ...o, y0: o.y0 - 0.9 }))], 0.32 * 4, wsFrontFade);
      const frontBand = mmGroup(wsGroup, 0, WS_EAVE - 2.0, 0);
      wsWallWithOpenings(frontBand, 'x', hz, -hx, hx, 2.0, wallT, cladFrontDark, [{ c: 0, w: W - 1.2, h: 1.1, y0: 0.45 }], 1.28, wsFrontFade);
      // Back (north)
      // (door 4 through to the north wing, on the line of door 1 and the car elevator)
      const backDoor = WS_WING.doors.shop;
      wsWallWithOpenings(wsGroup, 'x', -hz, -hx, hx, 0.9, wallT + 0.04, plinth, [{ c: backDoor.x, w: backDoor.w, h: 0.9 }], 2.4);
      const backGroup = mmGroup(wsGroup, 0, 0.9, 0);
      wsWallWithOpenings(backGroup, 'x', -hz, -hx, hx, WS_EAVE - 2.9, wallT, cladding, [{ c: backDoor.x, w: backDoor.w, h: backDoor.h - 0.9 }, { c: -1.5, w: 9, h: 1.3, y0: 2.2 }, { c: 0, w: W - 1.4, h: 1.3, y0: 7.0 }, { c: 0, w: W - 1.4, h: 1.3, y0: 13.9 }], 1.28);
      const backBand = mmGroup(wsGroup, 0, WS_EAVE - 2.0, 0);
      wsWallWithOpenings(backBand, 'x', -hz, -hx, hx, 2.0, wallT, cladDark, [{ c: 0, w: W - 1.2, h: 1.1, y0: 0.45 }], 1.28);
      // Sides: the west wall has a loading door facing the helipad, both have strip windows
      wsWallWithOpenings(wsGroup, 'z', -hx, -hz, hz, 0.9, wallT + 0.04, plinth, [{ c: 0.5, w: 3.0, h: 0.9 }], 2.4);
      const westGroup = mmGroup(wsGroup, 0, 0.9, 0);
      wsWallWithOpenings(westGroup, 'z', -hx, -hz, hz, WS_EAVE - 2.9, wallT, cladding, [{ c: 0.5, w: 3.0, h: 2.8 }, { c: -4.5, w: 4.0, h: 1.2, y0: 1.4 }, { c: 0, w: D - 2, h: 1.3, y0: 7.0 }, { c: 0, w: D - 2, h: 1.3, y0: 13.9 }], 1.28);
      wsWallWithOpenings(mmGroup(wsGroup, 0, WS_EAVE - 2.0, 0), 'z', -hx, -hz, hz, 2.0, wallT, cladDark, [], 1.28);
      wsWallWithOpenings(wsGroup, 'z', hx, -hz, hz, 0.9, wallT + 0.04, plinth, [], 2.4);
      wsWallWithOpenings(mmGroup(wsGroup, 0, 0.9, 0), 'z', hx, -hz, hz, WS_EAVE - 2.9, wallT, cladding, [{ c: -4.6, w: 4.4, h: 1.2, y0: 1.4 }, { c: 0, w: D - 2, h: 1.3, y0: 7.0 }, { c: 0, w: D - 2, h: 1.3, y0: 13.9 }], 1.28);
      wsWallWithOpenings(mmGroup(wsGroup, 0, WS_EAVE - 2.0, 0), 'z', hx, -hz, hz, 2.0, wallT, cladDark, [], 1.28);

      // Glazing in all the window openings (one pane each, with mullions)
      const glaze = (axis, fixed, c, w, y0, h) => {
        const pane = axis === 'x' ? mmBox(wsGroup, w, h, 0.04, glassMat, c, y0, fixed) : mmBox(wsGroup, 0.04, h, w, glassMat, fixed, y0, c);
        const n = Math.max(1, Math.round(w / 1.2));
        for (let i = 0; i <= n; i++) {
          const o = -w / 2 + i * w / n;
          if (axis === 'x') mmBox(wsGroup, 0.06, h, 0.08, trim, c + o, y0, fixed);
          else mmBox(wsGroup, 0.08, h, 0.06, trim, fixed, y0, c + o);
        }
        if (axis === 'x') { mmBox(wsGroup, w, 0.06, 0.1, trim, c, y0, fixed); mmBox(wsGroup, w, 0.06, 0.1, trim, c, y0 + h - 0.06, fixed); }
        else { mmBox(wsGroup, 0.1, 0.06, w, trim, fixed, y0, c); mmBox(wsGroup, 0.1, 0.06, w, trim, fixed, y0 + h - 0.06, c); }
        return pane;
      };
      frontWin.forEach(o => wsFrontFade.push(glaze('x', hz, o.c, o.w, o.y0, o.h)));
      wsFrontFade.push(glaze('x', hz, 0, W - 1.2, WS_EAVE - 2.0 + 0.45, 1.1));
      glaze('x', -hz, 0, W - 1.2, WS_EAVE - 2.0 + 0.45, 1.1);
      glaze('x', -hz, -1.5, 9, 3.1, 1.3);
      glaze('x', -hz, 0, W - 1.4, 7.9, 1.3);
      glaze('x', -hz, 0, W - 1.4, 14.8, 1.3);
      glaze('z', -hx, 0, D - 2, 14.8, 1.3);
      glaze('z', hx, 0, D - 2, 14.8, 1.3);
      glaze('z', -hx, -4.5, 4.0, 2.3, 1.2);
      glaze('z', -hx, 0, D - 2, 7.9, 1.3);
      glaze('z', hx, -4.6, 4.4, 2.3, 1.2);
      glaze('z', hx, 0, D - 2, 7.9, 1.3);

      // Roll-up doors: the slatted curtain (mostly rolled up, so you can see in), the coil box
      // above, the guide rails, and yellow bollards outside
      const doors = {};
      Object.entries(WS_DOORS).forEach(([k, d]) => {
        const g = mmGroup(wsGroup, d.x, 0, hz + 0.02);
        if (k === 'person') {
          // A steel man-door in its frame, standing open
          mmBox(g, d.w + 0.2, 0.1, 0.22, trim, 0, d.h, 0);
          [-1, 1].forEach(s => mmBox(g, 0.1, d.h, 0.22, trim, s * (d.w / 2 + 0.05), 0, 0));
          const leaf = mmGroup(g, -d.w / 2, 0, 0.08);
          mmBox(leaf, d.w * 0.95, d.h - 0.05, 0.06, trim, d.w / 2, 0, 0);
          mmBox(leaf, d.w * 0.4, 0.8, 0.07, glassMat, d.w / 2, 1.7, 0);
          leaf.rotation.y = -1.3;
          doors[k] = leaf;
          mmLabel(g, 'STAFF ENTRANCE', 1.2, 0.18, 0, d.h + 0.25, 0.12, { bg: '#1e3a5f', fg: '#fff' });
          // A steel canopy over it on two tie rods
          mmBox(g, d.w + 0.7, 0.1, 1.1, trim, 0, d.h + 0.55, 0.6);
          mmBox(g, d.w + 0.7, 0.14, 0.05, trim, 0, d.h + 0.5, 1.15);
          [-1, 1].forEach(sx => mmRod(g, [sx * (d.w / 2 + 0.2), d.h + 1.45, 0.05], [sx * (d.w / 2 + 0.2), d.h + 0.65, 1.1], 0.02, 'steel'));
          return;
        }
        const curtain = mmGroup(g, 0, d.h, 0.05);
        const slats = new THREE.Mesh(wsUV(new THREE.BoxGeometry(d.w, 1, 0.05), 1.2), doorMat);
        slats.position.y = -0.5;
        curtain.add(slats);
        curtain.scale.y = 0.6;      // open: only the bottom of the curtain shows under the coil box
        curtain.userData.slats = slats;
        mmBox(g, d.w + 0.4, 0.6, 0.5, trim, 0, d.h, -0.15);
        [-1, 1].forEach(s => {
          mmBox(g, 0.12, d.h, 0.18, steel, s * (d.w / 2 + 0.06), 0, 0);
          mmCyl(g, 0.12, 1.0, yellow, s * (d.w / 2 + 0.45), 0.5, 1.0);
          mmCyl(g, 0.13, 0.06, mmMat('dark'), s * (d.w / 2 + 0.45), 0.86, 1.0);
        });
        mmLabel(g, k === 'vehicle' ? 'DOOR 1  VEHICLES / CAR LIFT' : 'DOOR 3  HANGAR', 2.2, 0.2, 0, d.h + 0.42, 0.11, { bg: '#facc15', fg: '#111827' });
        doors[k] = curtain;
      });
      // The loading door on the west side
      const west = mmGroup(wsGroup, -hx - 0.02, 0, 0.5);
      mmBox(west, 0.5, 0.5, 3.4, trim, 0.15, 3.7, 0);
      const wcurt = new THREE.Mesh(wsUV(new THREE.BoxGeometry(0.05, 1.6, 3.0), 1.2), doorMat);
      wcurt.position.set(-0.03, 2.9, 0);
      west.add(wcurt);
      mmLabel(west, 'DOOR 2  DELIVERIES', 2.0, 0.2, -0.1, 4.2, 0, { bg: '#facc15', fg: '#111827', ry: -Math.PI / 2 });
      wsGroup.userData.doors = doors;

      // Big sign on the front, a wall-pack light over each door, downspouts at the corners
      const sign = makeSignMesh("KELO-1'S WORKSHOP", { bg: '#1e3a5f', fg: '#f8fafc', width: 7.2, height: 0.95 });
      sign.position.set(0, WS_EAVE - 2.6, hz + 0.1);
      wsGroup.add(sign);
      wsFrontFade.push(sign);
      const sub = makeSignMesh('FABRICATION  •  ELECTRONICS  •  GARAGE', { bg: '#0f172a', fg: '#facc15', width: 6.2, height: 0.42 });
      sub.position.set(0, WS_EAVE - 3.35, hz + 0.1);
      wsGroup.add(sub);
      wsFrontFade.push(sub);
      const packMat = mmGlow('window');
      packMat.emissive.setHex(0xfff4d6);
      [-5.95, 0.3, 5.85].forEach(x => {
        const lamp = mmBox(wsGroup, 0.4, 0.22, 0.25, mmMat('dark'), x, 5.6, hz + 0.18);
        const lens = mmBox(wsGroup, 0.32, 0.03, 0.18, packMat, x, 5.58, hz + 0.2);
        if (x === 0.3) wsLights.push({ mesh: lens, outdoor: true });
        wsFrontFade.push(lamp);
      });
      [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]].forEach(([x, z]) => mmBox(wsGroup, 0.14, WS_EAVE, 0.14, trim, x + Math.sign(x) * 0.1, 0, z + Math.sign(z) * 0.1));

      // (the front fades during a trip, the north wing covers the back below 5.8 and the hangar the
      // west wall north of z -0.9, so those parts stay plain)
      wsExteriorDetail(wsGroup, { W, D, eave: WS_EAVE, rise: 1.1, trim,
        walls: [{ side: 'east', a: -hz, b: hz, y0: 0.9, flash: true }, { side: 'west', a: -0.9, b: hz, y0: 0.9, flash: true, skip: [[-1.0, 2.0]] },
          { side: 'back', a: -hx, b: hx, y0: 5.8 }],
        spouts: [[hx, hz - 0.45, 1, 0], [-hx, hz - 0.45, -1, 0], [hx, -hz + 0.45, 1, 0]],
        lamps: [['east', -4.6, 5.4], ['east', 4.5, 5.4], ['west', 0.5, 5.4]] });
      // Roof: a low-pitch gable along x with standing seams and a ridge vent, see-through with
      // the "Roofs: Cutaway" switch (and during a trip)
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b98a6, roughness: 0.55, metalness: 0.5, transparent: true, opacity: state.roofCutaway ? 0.18 : 0.95, side: THREE.DoubleSide });
      const pitch = Math.atan2(1.1, hz);
      [-1, 1].forEach(s => {
        const len = Math.hypot(hz + 0.5, 1.1);
        const roof = new THREE.Mesh(wsUV(new THREE.BoxGeometry(W + 0.8, 0.08, len), 1.0), roofMat);
        roof.position.set(0, WS_EAVE + 0.55, s * (hz + 0.5) / 2);
        roof.rotation.x = s * pitch;
        roof.castShadow = true;
        wsGroup.add(roof);
        if (typeof cutawayRoofMeshes !== 'undefined') cutawayRoofMeshes.push(roof);
      });
      const ridge = mmBox(wsGroup, W * 0.8, 0.25, 0.5, roofMat, 0, WS_EAVE + 1.1, 0);
      if (typeof cutawayRoofMeshes !== 'undefined') cutawayRoofMeshes.push(ridge);
      if (typeof dressBuilding === 'function') dressBuilding(wsGroup, [[roofMat, 'metalroof', 1.2], [plinth, 'stone', 2]]);

      // Structure inside: steel columns along the walls and roof trusses
      for (let x = -hx + 0.3; x <= hx - 0.2; x += W / 5) {
        [-hz + 0.2, hz - 0.2].forEach(z => mmBox(wsGroup, 0.22, WS_EAVE - 0.1, 0.22, mmMat('navy'), x, 0, z));
        mmBox(wsGroup, 0.14, 0.5, D - 0.4, mmMat('navy'), x, WS_EAVE - 0.6, 0);
      }
      // A bridge crane over the high bay (the Taurus and the hangar)
      [-hz + 0.45, hz - 0.45].forEach(z => mmBox(wsGroup, 3.8, 0.25, 0.25, yellow, -5.9, WS_F3 - 1.6, z));
      const crane = mmGroup(wsGroup, -5.9, WS_F3 - 1.4, 0.4);
      mmBox(crane, 0.3, 0.45, D - 1.0, yellow, -1.6, 0, 0);
      mmBox(crane, 0.3, 0.45, D - 1.0, yellow, 1.6, 0, 0);
      mmBox(crane, 3.5, 0.3, 0.5, yellow, 0, 0.1, -2.0).rotation.y = 0;
      const hoist = mmBox(crane, 0.5, 0.45, 0.5, mmMat('dark'), 0, -0.3, -2.0);
      mmCyl(crane, 0.01, 3.5, steel, 0, -2.0, -2.0);
      mmLabel(crane, '10 T', 0.5, 0.2, 1.6, 0.25, 0, { bg: '#facc15', fg: '#111827', ry: Math.PI / 2 });
      wsGroup.userData.crane = crane;

      // Floor 2 deck: a steel-framed concrete deck over the main shop (not the high bay, not the lift)
      const deckMat = new THREE.MeshStandardMaterial({ color: 0xa8a9a4, roughness: 0.6, metalness: 0.05, map: conc, transparent: true, opacity: state.roofCutaway ? 0.18 : 0.95 });
      const deckX0 = -3.95, liftX0 = WS_LIFT.x - WS_LIFT.w / 2 - 0.1, liftZ0 = WS_LIFT.z - WS_LIFT.d / 2 - 0.1;
      const deckA = wsPanel(wsGroup, liftX0 - deckX0, 0.3, D - 0.3, deckMat, (deckX0 + liftX0) / 2, WS_F2 - 0.3, 0, 3.2);
      const deckB = wsPanel(wsGroup, WS_IN.x - liftX0, 0.3, liftZ0 + WS_IN.z, deckMat, (liftX0 + WS_IN.x) / 2, WS_F2 - 0.3, (liftZ0 - WS_IN.z) / 2, 3.2);
      wsDeckMeshes = [deckA, deckB];
      wsDeckMeshes.forEach(m => { m.castShadow = false; if (typeof cutawayRoofMeshes !== 'undefined') cutawayRoofMeshes.push(m); });
      // Its beams and the columns holding it up
      mmBox(wsGroup, 0.3, 0.45, D - 0.3, mmMat('navy'), deckX0 + 0.15, WS_F2 - 0.75, 0);
      for (let z = -hz + 1.6; z < hz - 0.5; z += 3.5) mmBox(wsGroup, 0.22, WS_F2 - 0.4, 0.22, mmMat('navy'), deckX0 + 0.15, WS_F1, z);
      [-6.0, -2.0].forEach(z => mmBox(wsGroup, 0.22, WS_F2 - 0.4, 0.22, mmMat('navy'), liftX0 - 0.1, WS_F1, z));
      // Safety railings along the open edges of the deck
      const rail = (x0, z0, x1, z1) => {
        const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
        [0.55, 1.1].forEach(y => mmBox(wsGroup, 0.05, 0.05, len, yellow, (x0 + x1) / 2, WS_F2 + y, (z0 + z1) / 2, { ry }));
        const n = Math.max(1, Math.round(len / 1.4));
        for (let i = 0; i <= n; i++) mmBox(wsGroup, 0.05, 1.12, 0.05, yellow, x0 + (x1 - x0) * i / n, WS_F2, z0 + (z1 - z0) * i / n);
        mmBox(wsGroup, 0.02, 0.12, len, yellow, (x0 + x1) / 2, WS_F2, (z0 + z1) / 2, { ry });
      };
      rail(deckX0 + 0.05, -hz + 0.3, deckX0 + 0.05, hz - 0.3);
      rail(liftX0, liftZ0 - 0.05, WS_IN.x, liftZ0 - 0.05);
      rail(liftX0 - 0.05, liftZ0, liftX0 - 0.05, WS_LIFT_GATE - 0.8);
      rail(liftX0 - 0.05, WS_LIFT_GATE + 0.8, liftX0 - 0.05, WS_IN.z - 0.1);

      // Floor 3 deck over everything but the lift shaft and the stairwell in the north-west corner
      const deck3Mat = deckMat.clone();
      const stairX1 = -6.15, stairZ0 = 2.35;
      const d3a = wsPanel(wsGroup, stairX1 + WS_IN.x, 0.3, stairZ0 + WS_IN.z, deck3Mat, (-WS_IN.x + stairX1) / 2, WS_F3 - 0.3, (stairZ0 - WS_IN.z) / 2, 3.2);
      const d3b = wsPanel(wsGroup, liftX0 - stairX1, 0.3, D - 0.3, deck3Mat, (stairX1 + liftX0) / 2, WS_F3 - 0.3, 0, 3.2);
      const d3c = wsPanel(wsGroup, WS_IN.x - liftX0, 0.3, liftZ0 + WS_IN.z, deck3Mat, (liftX0 + WS_IN.x) / 2, WS_F3 - 0.3, (liftZ0 - WS_IN.z) / 2, 3.2);
      wsDeck3Meshes = [d3a, d3b, d3c];
      wsDeck3Meshes.forEach(m => { m.castShadow = false; if (typeof cutawayRoofMeshes !== 'undefined') cutawayRoofMeshes.push(m); });
      mmBox(wsGroup, D - 0.3, 0.5, 0.3, mmMat('navy'), 0, WS_F3 - 0.8, 0, { ry: Math.PI / 2 });
      [-6.0, -2.0, 2.0, 6.0].forEach(z => [-3.95, liftX0 - 0.1].forEach(x => mmBox(wsGroup, 0.22, WS_F3 - WS_F2 - 0.4, 0.22, mmMat('navy'), x, WS_F2, z)));
      const rail3 = (x0, z0, x1, z1) => {
        const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
        [0.55, 1.1].forEach(y => mmBox(wsGroup, 0.05, 0.05, len, yellow, (x0 + x1) / 2, WS_F3 + y, (z0 + z1) / 2, { ry }));
        const n = Math.max(1, Math.round(len / 1.4));
        for (let i = 0; i <= n; i++) mmBox(wsGroup, 0.05, 1.12, 0.05, yellow, x0 + (x1 - x0) * i / n, WS_F3, z0 + (z1 - z0) * i / n);
      };
      rail3(liftX0, liftZ0 - 0.05, WS_IN.x, liftZ0 - 0.05);
      rail3(liftX0 - 0.05, liftZ0, liftX0 - 0.05, WS_LIFT_GATE - 0.8);
      rail3(liftX0 - 0.05, WS_LIFT_GATE + 0.8, liftX0 - 0.05, WS_IN.z - 0.1);
      rail3(stairX1 + 0.05, stairZ0, stairX1 + 0.05, WS_IN.z - 0.1);
      // The stair tower: switchback steel flights from floor 1 to 2 and 2 to 3, a walkway bridge to the floor-2 deck
      const flight = (x, z0, z1, y0, y1) => {
        const n = Math.round((y1 - y0) / 0.2), dz = (z1 - z0) / n, dy = (y1 - y0) / n;
        for (let i = 0; i < n; i++) mmBox(wsGroup, 0.75, 0.04, Math.abs(dz) + 0.02, 'steel', x, y0 + dy * (i + 1) - 0.04, z0 + dz * (i + 0.5));
        const len = Math.hypot(z1 - z0, y1 - y0), ang = Math.atan2(y1 - y0, z1 - z0);
        [-0.4, 0.4].forEach(ox => {
          const st = mmBox(wsGroup, 0.05, 0.22, len, yellow, x + ox, (y0 + y1) / 2, (z0 + z1) / 2, { centre: true });
          st.rotation.x = -ang;
          const hr = mmBox(wsGroup, 0.04, 0.04, len, yellow, x + ox, (y0 + y1) / 2 + 1.0, (z0 + z1) / 2, { centre: true });
          hr.rotation.x = -ang;
        });
      };
      const sx1 = -7.35, sx2 = -6.55, sz0 = 6.9, sz1 = 3.0;
      [[WS_F1, WS_F2], [WS_F2, WS_F3]].forEach(([ya, yb]) => {
        const mid = (ya + yb) / 2;
        flight(sx1, sz0, sz1, ya, mid);
        mmBox(wsGroup, 1.6, 0.08, 0.8, 'steel', (sx1 + sx2) / 2, mid - 0.08, sz1 - 0.4);
        flight(sx2, sz1, sz0, mid, yb);
        mmBox(wsGroup, 1.6, 0.08, 0.8, 'steel', (sx1 + sx2) / 2, yb - 0.08, sz0 + 0.4);
      });
      mmBox(wsGroup, -3.95 - sx2 + 0.4, 0.08, 0.9, 'steel', (sx2 - 0.4 - 3.95) / 2, WS_F2 - 0.08, sz0 + 0.3);
      [-0.45, 0.45].forEach(dz => mmBox(wsGroup, -3.95 - sx2 + 0.4, 0.05, 0.05, yellow, (sx2 - 0.4 - 3.95) / 2, WS_F2 + 1.0, sz0 + 0.3 + dz));
      mmLabel(wsGroup, 'STAIRS  1 • 2 • 3', 1.2, 0.25, (sx1 + sx2) / 2, 2.6, 7.2, { bg: '#facc15', fg: '#111827', ry: Math.PI });
      // Landings: a folding gate, call buttons and a floor number at the platform's door on every floor
      [WS_F1, WS_F2, WS_F3].forEach((y, i) => {
        const gx = liftX0 - 0.2;
        const call = mmGroup(wsGroup, gx - 0.25, y, WS_LIFT_GATE + 1.05);
        mmBox(call, 0.06, 1.3, 0.06, mmMat('dark'), 0, 0, 0);
        mmBox(call, 0.1, 0.32, 0.22, yellow, 0, 1.25, 0);
        mmCyl(call, 0.035, 0.03, 'lampGreen', -0.06, 1.47, 0, { axis: 'x' });
        mmCyl(call, 0.035, 0.03, 'lampAmber', -0.06, 1.35, 0, { axis: 'x' });
        mmLabel(call, String(i + 1), 0.22, 0.22, -0.06, 1.75, 0, { bg: '#111827', fg: '#facc15', ry: -Math.PI / 2 });
        // a big floor sign over the landing gate, facing the landing
        mmLabel(wsGroup, `FLOOR ${i + 1}  •  CAR ELEVATOR`, 1.6, 0.34, gx - 0.12, y + 2.55, WS_LIFT_GATE, { bg: '#facc15', fg: '#111827', ry: -Math.PI / 2 });
        // the landing gate, folded open to one side of the doorway
        const gate = mmGroup(wsGroup, gx + 0.1, y, WS_LIFT_GATE - 0.95);
        for (let k = 0; k < 4; k++) mmBox(gate, 0.03, 1.9, 0.12, i === 0 ? 'steel' : yellow, 0, 0, k * 0.08);
        mmBox(gate, 0.05, 0.05, 1.6, 'steel', 0, 1.95, 0.8);
      });
      // The car elevator: four tall yellow masts, a diamond-plate platform with hazard edges,
      // a hydraulic ram under it, gates and the call box
      const L = WS_LIFT;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
        mmBox(wsGroup, 0.32, WS_F3 + 2.6, 0.32, yellow, L.x + sx * (L.w / 2 + 0.16), WS_F1, L.z + sz * (L.d / 2 - 0.2));
        mmBox(wsGroup, 0.08, WS_F3 + 2.5, 0.1, steel, L.x + sx * (L.w / 2 - 0.02), WS_F1, L.z + sz * (L.d / 2 - 0.2));
      });
      [-1, 1].forEach(sz => mmBox(wsGroup, L.w + 0.64, 0.4, 0.4, yellow, L.x, WS_F3 + 2.6, L.z + sz * (L.d / 2 - 0.2)));
      mmLabel(wsGroup, 'CAR ELEVATOR  4,500 KG  •  FLOORS 1-2-3', 3.2, 0.3, L.x, WS_F3 + 2.8, L.z + L.d / 2, { bg: '#facc15', fg: '#111827' });
      wsLift = mmGroup(wsGroup, L.x, WS_F1, L.z);
      const plate = new THREE.Mesh(wsUV(new THREE.BoxGeometry(L.w, 0.14, L.d), 0.8), new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.35, metalness: 0.85, map: wsConcreteTexture() }));
      plate.position.y = -0.07;
      wsLift.add(plate);
      [-1, 1].forEach(s => {
        for (let i = 0; i < 12; i++) mmBox(wsLift, 0.12, 0.02, L.d / 12 * 0.5, i % 2 ? 'stripe' : 'hazard', s * (L.w / 2 - 0.07), 0, -L.d / 2 + (i + 0.5) * L.d / 12);
        mmBox(wsLift, 0.05, 1.0, L.d, 'fence', s * (L.w / 2 - 0.03), 0.02, 0);
        mmBox(wsLift, 0.06, 0.06, L.d, yellow, s * (L.w / 2 - 0.03), 1.0, 0);
      });
      // The floor selector on the platform (1, 2, 3)
      const sel = mmGroup(wsLift, -L.w / 2 + 0.15, 0, L.d / 2 - 1.0);
      mmBox(sel, 0.06, 1.2, 0.06, mmMat('dark'), 0, 0, 0);
      mmBox(sel, 0.12, 0.45, 0.22, yellow, 0, 1.15, 0);
      ['lampGreen', 'lampAmber', 'lampRed'].forEach((c, i) => mmCyl(sel, 0.03, 0.03, c, 0.07, 1.48 - i * 0.12, 0, { axis: 'x' }));
      // The ram (stretches as the platform rises)
      const ram = mmCyl(wsGroup, 0.2, 1, mmMat('chrome'), L.x, WS_F1 / 2, L.z);
      wsGroup.userData.ram = ram;
      const callBox = mmGroup(wsGroup, L.x - L.w / 2 - 0.45, WS_F1, L.z + L.d / 2 - 0.4);
      mmBox(callBox, 0.06, 1.2, 0.06, mmMat('dark'), 0, 0, 0);
      mmBox(callBox, 0.25, 0.35, 0.12, yellow, 0, 1.2, 0);
      mmCyl(callBox, 0.04, 0.03, 'lampGreen', 0, 1.45, 0.06, { axis: 'z' });
      mmCyl(callBox, 0.04, 0.03, 'lampRed', 0, 1.32, 0.06, { axis: 'z' });

      // Floor markings: yellow aisle lines, hatched no-go zones, the bays' outlines
      const line = (x, z, w, d, mat = yellow) => { const m = mmBox(wsGroup, w, 0.008, d, mat, x, WS_F1 + 0.004, z); m.receiveShadow = true; return m; };
      [-0.45, 1.05].forEach(x => line(x, 0, 0.08, D - 1.0));
      line(-3.95, 0, 0.08, D - 1.0);
      const hb = WORKSHOP_STATIONS.smallAssembly;
      [[0, -hb.size.d / 2], [0, hb.size.d / 2]].forEach(([dx, dz]) => line(hb.local.x + dx, hb.local.z + dz, hb.size.w, 0.08));
      [[-hb.size.w / 2, 0], [hb.size.w / 2, 0]].forEach(([dx]) => line(hb.local.x + dx, hb.local.z, 0.08, hb.size.d));
      for (let i = 0; i < 7; i++) line(L.x, L.z + L.d / 2 + 0.25, L.w, 0.08, i % 2 ? mmMat('hazard') : yellow).position.z = L.z + L.d / 2 + 0.06 + i * 0.03;
      mmLabel(wsGroup, 'ASSEMBLY BAY', 2.0, 0.4, hb.local.x, WS_F1 + 0.01, hb.local.z + 1.6, { bg: '#b9bab5', fg: '#a16207' }).rotation.x = -Math.PI / 2;
      mmLabel(wsGroup, 'KEEP CLEAR', 1.6, 0.35, L.x, WS_F1 + 0.01, L.z + L.d / 2 + 0.55, { bg: '#b9bab5', fg: '#b91c1c' }).rotation.x = -Math.PI / 2;
      // The east aisle from door 4 (the wing) down to the car elevator: the drive-through and forklift way
      const sdw = WS_WING.doors.shop, aisleZ1 = L.z - L.d / 2;
      [-1, 1].forEach(sx => line(sdw.x + sx * (sdw.w / 2 - 0.05), (-hz + aisleZ1) / 2, 0.08, aisleZ1 + hz));
      const ea = mmLabel(wsGroup, 'DRIVE-THROUGH', 1.8, 0.35, sdw.x, WS_F1 + 0.01, -hz + 1.4, { bg: '#b9bab5', fg: '#a16207' });
      ea.rotation.x = -Math.PI / 2;
      // Area signs hanging inside
      const hang = (text, x, y, z, ry = 0, bg = '#0f172a', fg = '#facc15') => { const s = makeSignMesh(text, { bg, fg, width: 2.6, height: 0.42 }); s.position.set(x, y, z); s.rotation.y = ry; wsGroup.add(s); return s; };
      hang('HIGH BAY  •  TAURUS', -5.9, 7.4, -hz + 0.25);
      hang('3D PRINTING', -2.1, 4.95, 1.6);
      hang('CNC MACHINING', 2.5, 4.95, -3.1);
      hang('PPE REQUIRED BEYOND THIS POINT', 0.3, 3.6, hz - 0.25, Math.PI, '#facc15', '#111827');
      hang('ELECTRONICS', -0.6, WS_F2 + 3.4, -1.6);
      hang('GARAGE', 4.9, WS_F2 + 3.4, -1.6);

      // Lights: LED high-bay fixtures under the roof and under the deck (they glow), plus two real
      // point lights that are only bright while the camera is near
      const lensMat = mmGlow('window');
      lensMat.emissive.setHex(0xf1f5ff);
      // Each LED high-bay hangs right under a roof truss: a thin housing and a lens that face down, so
      // from above (roof cut away) there is nothing loose to see, only the truss
      const fixGeo = new THREE.PlaneGeometry(1, 1);
      fixGeo.rotateX(Math.PI / 2); // facing down
      const housingMat = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.6, metalness: 0.4 });
      const fixture = (x, y, z) => {
        const housing = new THREE.Mesh(fixGeo, housingMat);
        housing.scale.set(0.7, 1, 0.45);
        housing.position.set(x, y, z);
        const lens = new THREE.Mesh(fixGeo, lensMat);
        lens.scale.set(0.6, 1, 0.36);
        lens.position.set(x, y - 0.03, z);
        wsGroup.add(housing, lens);
        if (!wsLights.some(l => l.mesh.material === lensMat)) wsLights.push({ mesh: lens });
      };
      for (let x = -hx + 0.3; x <= hx - 0.2; x += W / 5) [-4.5, 0, 4.5].forEach(z => fixture(x, WS_EAVE - 0.63, z));
      // (no real point lights: each one would make every material in the world dearer to draw)
      wsGroup.userData.lamps = [];

      // The work stations other systems can move into
      buildWorkshopStations();
      // The north wing: the CNC hall with the forklift aisle and the drive-through
      buildWorkshopWing3D({ cladding, cladDark, plinth, floorMat, doorMat, trim, glassMat, roofMat, lensMat });

      wsMergeStatic(wsGroup, new Set([...wsFrontFade, ...wsDeckMeshes, ...wsDeck3Meshes, ...(typeof cutawayRoofMeshes !== 'undefined' ? cutawayRoofMeshes : [])]),
        [wsLift, crane, ...Object.values(doors), ...Object.values(WORKSHOP_STATIONS).map(st => st.group).filter(Boolean), wsGroup.userData.ram]);
      wsFloor1 = mmGroup(wsGroup, 0, WS_F1, 0);
      wsFloor2 = mmGroup(wsGroup, 0, WS_F2, 0);
      wsFloor3 = mmGroup(wsGroup, 0, WS_F3, 0);
      scene.add(wsGroup);
      wsUpdateLift(0);
      wsClearSceneryInside();
      // Paths go round it: one solid box over the footprint (trips inside walk on their own); a walk
      // "to the Workshop" ends at the person door out front
      addObstacle(obstacleBox(S.x, S.z, hx, hz, { workshop: true, building: 'workshop', door: { x: S.x + WS_DOORS.person.x, z: S.z + hz + 1.2 } }));
      wsBuildStandIns();
      if (typeof perfWatchBuilding === 'function') {
        perfWatchBuilding({
          key: 'workshop', radius: 11,
          center: () => wsGroup.position.clone().setY(WORKSHOP_PAD_Y + 3),
          forced: () => Boolean(workshopTrip.active),
          show: near => wsShowFloor1(near),
          tick: near => { if (near) { wsBuildQueued(2); wsViewCull(); } }
        });
      } else wsShowFloor1(true);
      wsInitHover();
      try { buildWorkshopHangar3D(); } catch (e) { console.warn('hangar', e); }
      wsUpdateLighting();
      setInterval(wsUpdateLighting, 4000);
    }

// Fewer draw calls: the building's many fixed little parts (trim, mullions, railings, columns...) are
// baked into one mesh per material. Anything that moves or fades is left alone.
function wsMergeStatic(root, keep, keepTrees) {
      root.updateMatrixWorld(true);
      const skip = new Set();
      keepTrees.forEach(t => { if (t) t.traverse(o => skip.add(o)); });
      const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
      const byMat = new Map();
      root.traverse(o => {
        if (!o.isMesh || skip.has(o) || keep.has(o) || o.material.transparent) return;
        const g = o.geometry;
        if (!g.attributes.normal || !g.attributes.uv) return;
        if (!byMat.has(o.material)) byMat.set(o.material, []);
        byMat.get(o.material).push(o);
      });
      const m4 = new THREE.Matrix4();
      byMat.forEach((list, mat) => {
        if (list.length < 3) return;
        const pos = [], nor = [], uv = [];
        list.forEach(o => {
          const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
          m4.multiplyMatrices(inv, o.matrixWorld);
          g.applyMatrix4(m4);
          pos.push(...g.attributes.position.array);
          nor.push(...g.attributes.normal.array);
          uv.push(...g.attributes.uv.array);
          g.dispose();
          o.parent.remove(o);
        });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        const merged = new THREE.Mesh(geo, mat);
        merged.castShadow = list.some(o => o.castShadow);
        merged.receiveShadow = true;
        root.add(merged);
      });
    }

// Trees, flowers and rocks that the valley scenery put inside the footprint are cleared away
function wsClearSceneryInside() {
      const s = WORKSHOP_SITE;
      const inside = (x, z) => inWorkshopSite(x, z, 0.8);
      if (typeof valleyTrees !== 'undefined') {
        for (let i = valleyTrees.length - 1; i >= 0; i--) {
          const t = valleyTrees[i];
          if (!inside(t.x, t.z)) continue;
          if (t.group && t.group.parent) t.group.parent.remove(t.group);
          worldObstacles = worldObstacles.filter(o => o !== t.obstacle);
          valleyTrees.splice(i, 1);
        }
      }
      scene.children.slice().forEach(o => {
        if (o === wsGroup || o.isLight || o.isCamera || !o.position || o.userData.isWorkshop) return;
        if (o === terrainSwapGroup || o === keloGroup) return;
        const p = o.position;
        if (!inside(p.x, p.z) || Math.abs(p.y - getAnalyticalGroundHeight(p.x, p.z)) > 1.5) return;
        const box = new THREE.Box3().setFromObject(o);
        if (box.isEmpty() || box.max.x - box.min.x > 6 || box.max.z - box.min.z > 6) return;
        scene.remove(o);
      });
      worldObstacles = worldObstacles.filter(o => o.workshop || !inside(o.x, o.z) || o.r > 6);
    }

// A weld bay (screens, a steel welding table) and his work bench on floor 1; the assembly bay is
// the marked-out floor in the high bay. Each keeps a group other systems can fill (userData.station).
function buildWorkshopStations() {
      // The weld bay and the bench bay are marked out and screened, but empty: his welding rig
      // (js/welding.js at WELD_STUDIO) and his work bench (js/workbench.js at WORK_BENCH) are the
      // real ones, so nothing is duplicated here. workshopStation('weld' | 'bench') gives the spot
      // to move them to (set WELD_STUDIO / WORK_BENCH x and z to it before they build).
      const weld = WORKSHOP_STATIONS.weld, bench = WORKSHOP_STATIONS.bench;
      const wg = mmGroup(wsGroup, weld.local.x, WS_F1, weld.local.z);
      const curtain = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.6, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
      mmBox(wg, 2.2, 1.9, 0.02, curtain, 0, 0.1, -0.65);
      mmBox(wg, 0.02, 1.9, 1.3, curtain, -1.1, 0.1, 0);
      mmBox(wg, 2.2, 0.04, 0.04, 'steel', 0, 2.0, -0.65);
      mmBox(wg, 0.04, 2.0, 0.04, 'steel', 1.1, 0, -0.65);
      mmBox(wg, 0.04, 2.0, 0.04, 'steel', -1.1, 0, 0.65);
      mmLabel(wg, 'WELD BAY', 0.8, 0.18, 0, 2.15, -0.64, { bg: '#b91c1c', fg: '#fff' });
      wg.userData.station = 'weld';
      WORKSHOP_STATIONS.weld.group = wg;
      const bg = mmGroup(wsGroup, bench.local.x, WS_F1, bench.local.z);
      [[0, -0.45, 2.7, 0.06], [0, 0.45, 2.7, 0.06], [-1.35, 0, 0.06, 0.96], [1.35, 0, 0.06, 0.96]].forEach(([x, z, w, d]) => mmBox(bg, w, 0.006, d, 'stripe', x, 0, z));
      mmLabel(bg, 'BENCH BAY', 1.0, 0.25, 0, 0.01, 0, { bg: '#b9bab5', fg: '#a16207' }).rotation.x = -Math.PI / 2;
      bg.userData.station = 'bench';
      WORKSHOP_STATIONS.bench.group = bg;
      const ab = WORKSHOP_STATIONS.assembly;
      const ag = mmGroup(wsGroup, ab.local.x, WS_F1, ab.local.z);
      // Two sawhorses and a parts cart wait in the bay
      [-0.9, 0.9].forEach(z => {
        mmBox(ag, 1.0, 0.06, 0.12, 'wood', 0, 0.7, z);
        [-0.4, 0.4].forEach(x => mmBox(ag, 0.05, 0.7, 0.3, 'wood', x, 0, z));
      });
      const cart = mmGroup(ag, 1.25, 0, -1.8);
      mmBox(cart, 0.6, 0.04, 0.4, 'red', 0, 0.3, 0);
      mmBox(cart, 0.6, 0.04, 0.4, 'red', 0, 0.8, 0);
      [-0.28, 0.28].forEach(x => mmBox(cart, 0.03, 0.85, 0.03, 'red', x, 0, 0.18));
      ag.userData.station = 'assembly';
      WORKSHOP_STATIONS.assembly.group = ag;
    }

// --- The north wing: CNC hall, forklift aisle, drive-through ------------------------------------------
// Built into wsGroup (Workshop-local coordinates) behind the shop's back wall, from WS_WING.
function wsWingBounds() {
      const Wg = WS_WING;
      return { x0: Wg.x - Wg.w / 2, x1: Wg.x + Wg.w / 2, z0: Wg.z - Wg.d / 2, z1: Wg.z + Wg.d / 2 };
    }

function buildWorkshopWing3D(m) {
      const Wg = WS_WING, b = wsWingBounds(), t = 0.16;
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      const yellow = mmMat('yellow'), navy = mmMat('navy');
      // Slab and floor (the floor stops short of the shared wall so the two slabs never fight)
      wsPanel(wsGroup, Wg.w + 0.6, 0.38, Wg.d + 0.3, m.plinth, cx, -0.3, cz - 0.15, 3).castShadow = false;
      wsPanel(wsGroup, Wg.w - 0.2, 0.04, Wg.d - 0.25, m.floorMat, cx, WS_F1 - 0.04, cz - 0.05, 3.2).castShadow = false;
      // Walls: north (back) with a strip of windows, east solid with one window, west with the door
      // from the hangar. Plinth course first, cladding above, a dark band at the top.
      const hd = Wg.doors.hangar;
      const wall = (axis, fixed, a0, a1, openings) => {
        wsWallWithOpenings(wsGroup, axis, fixed, a0, a1, 0.9, t + 0.04, m.plinth, openings.filter(o => !o.y0).map(o => ({ ...o, h: 0.9 })), 2.4);
        const g = mmGroup(wsGroup, 0, 0.9, 0);
        wsWallWithOpenings(g, axis, fixed, a0, a1, Wg.h - 0.9 - 0.9, t, m.cladding, openings.map(o => ({ ...o, h: o.y0 ? o.h : o.h - 0.9, y0: o.y0 ? o.y0 - 0.9 : 0 })), 1.28);
        wsWallWithOpenings(mmGroup(wsGroup, 0, Wg.h - 0.9, 0), axis, fixed, a0, a1, 0.9, t, m.cladDark, [], 1.28);
      };
      wall('x', b.z0, b.x0, b.x1, [{ c: cx, w: Wg.w - 2.4, h: 1.0, y0: 3.4 }]);
      wall('z', b.x1, b.z0, b.z1, [{ c: cz, w: 3.0, h: 1.0, y0: 3.4 }]);
      wall('z', b.x0, b.z0, b.z1, [{ c: hd.z, w: hd.w, h: hd.h }]);
      mmBox(wsGroup, Wg.w - 2.4, 1.0, 0.04, m.glassMat, cx, 3.4, b.z0);
      mmBox(wsGroup, 0.04, 1.0, 3.0, m.glassMat, b.x1, 3.4, cz);
      // The short link to the hangar's east wall: jambs, a header and a floor plate over the gap
      const H = WORKSHOP_HANGAR, gapX0 = H.x + H.w / 2 - WORKSHOP_SITE.x;
      const linkW = b.x0 - gapX0;
      if (linkW > 0.02) {
        [-1, 1].forEach(s => wsPanel(wsGroup, linkW + 0.1, hd.h + 0.5, 0.3, m.trim, (gapX0 + b.x0) / 2, 0, hd.z + s * (hd.w / 2 + 0.15)));
        wsPanel(wsGroup, linkW + 0.1, 0.5, hd.w + 0.6, m.trim, (gapX0 + b.x0) / 2, hd.h, hd.z);
        wsPanel(wsGroup, linkW + 0.2, 0.05, hd.w, m.floorMat, (gapX0 + b.x0) / 2, WS_F1 - 0.05, hd.z, 3.2).castShadow = false;
      }
      // Roll-up doors (open): door 5 from the hangar, door 4 through to the shop
      const rollUp = (g, w, h, along) => {
        mmBox(g, along === 'x' ? w + 0.4 : 0.5, 0.55, along === 'x' ? 0.5 : w + 0.4, m.trim, 0, h, 0);
        const c = new THREE.Mesh(wsUV(new THREE.BoxGeometry(along === 'x' ? w : 0.05, 0.6, along === 'x' ? 0.05 : w), 1.2), m.doorMat);
        c.position.y = h - 0.3;
        g.add(c);
        [-1, 1].forEach(s => mmBox(g, along === 'x' ? 0.12 : 0.18, h, along === 'x' ? 0.18 : 0.12, 'steel', along === 'x' ? s * (w / 2 + 0.06) : 0, 0, along === 'x' ? 0 : s * (w / 2 + 0.06)));
      };
      const dHangar = mmGroup(wsGroup, b.x0 + 0.02, 0, hd.z);
      rollUp(dHangar, hd.w, hd.h, 'z');
      mmLabel(dHangar, 'DOOR 5  HANGAR', 1.8, 0.2, 0.3, hd.h + 0.62, 0, { bg: '#facc15', fg: '#111827', ry: Math.PI / 2 });
      const sd = Wg.doors.shop;
      const dShop = mmGroup(wsGroup, sd.x, 0, b.z1 - 0.02);
      rollUp(dShop, sd.w, sd.h, 'x');
      mmLabel(dShop, 'DOOR 4  DRIVE-THROUGH', 2.2, 0.2, 0, sd.h + 0.62, -0.3, { bg: '#facc15', fg: '#111827', ry: Math.PI });
      // Roof: a low mono-pitch falling to the north, see-through with the cutaway switch
      const rise = 0.5, len = Math.hypot(Wg.d + 0.6, rise);
      const roof = new THREE.Mesh(wsUV(new THREE.BoxGeometry(Wg.w + 0.6, 0.08, len), 1.0), m.roofMat);
      roof.position.set(cx, Wg.h + rise / 2, cz - 0.1);
      roof.rotation.x = -Math.atan2(rise, Wg.d);
      roof.castShadow = true;
      wsGroup.add(roof);
      if (typeof cutawayRoofMeshes !== 'undefined') cutawayRoofMeshes.push(roof);
      // Columns and beams, LED fixtures facing down under the beams
      const fixGeo = new THREE.PlaneGeometry(1, 1);
      fixGeo.rotateX(Math.PI / 2);
      for (let x = b.x0 + 0.3; x <= b.x1 - 0.2; x += Wg.w / 4) {
        mmBox(wsGroup, 0.22, Wg.h - 0.1, 0.22, navy, x, 0, b.z0 + 0.2);
        mmBox(wsGroup, 0.14, 0.4, Wg.d - 0.3, navy, x, Wg.h - 0.45, cz);
        [cz - 1.8, cz + 1.8].forEach(z => {
          const l = new THREE.Mesh(fixGeo, m.lensMat);
          l.scale.set(0.6, 1, 0.36);
          l.position.set(x + Wg.w / 8, Wg.h - 0.5, z);
          wsGroup.add(l);
        });
      }
      // Floor markings: the forklift aisle (also the drive-through) and its turn to door 4
      const line = (x, z, w, d, mat = yellow) => mmBox(wsGroup, w, 0.008, d, mat, x, WS_F1 + 0.004, z);
      const az = Wg.aisleZ, aw = Wg.aisleW;
      const nEnd = sd.x + sd.w / 2, sEnd = sd.x - sd.w / 2;
      line((b.x0 + nEnd) / 2, az - aw / 2, nEnd - b.x0, 0.1);
      line((b.x0 + sEnd) / 2, az + aw / 2, sEnd - b.x0, 0.1);
      line(sd.x + sd.w / 2, (az - aw / 2 + b.z1) / 2, 0.1, b.z1 - (az - aw / 2));
      line(sd.x - sd.w / 2, (az + aw / 2 + b.z1) / 2, 0.1, b.z1 - (az + aw / 2));
      for (let x = b.x0 + 1.4; x < sd.x - 2; x += 2.4) line(x, az, 1.0, 0.12, mmMat('white'));
      const lab = (text, x, z, w = 2.6, ry = 0) => { const l = mmLabel(wsGroup, text, w, 0.42, x, WS_F1 + 0.012, z, { bg: '#b9bab5', fg: '#a16207' }); l.rotation.x = -Math.PI / 2; l.rotation.z = ry; return l; };
      lab('FORKLIFT AISLE  •  DRIVE-THROUGH', -2.0, az + 1.2, 3.6);
      // Signs
      const hang = (text, x, y, z, ry = 0) => { const s = makeSignMesh(text, { bg: '#0f172a', fg: '#facc15', width: 2.8, height: 0.42 }); s.position.set(x, y, z); s.rotation.y = ry; wsGroup.add(s); return s; };
      hang('CNC HALL  •  HAAS MILLS', 1.8, Wg.h - 1.3, b.z0 + 0.3);
      hang('FORKLIFTS  •  WATCH THE AISLE', -4.0, Wg.h - 1.3, b.z1 - 0.3, Math.PI);
      // The cantilever rack for bar stock and sheet (static; the pallet racking and the charger are js/forklift.js)
      const br = Wg.spots.barRack, rg = mmGroup(wsGroup, br.x, WS_F1, br.z);
      [-br.w / 2 + 0.1, br.w / 2 - 0.1].forEach(x => {
        mmBox(rg, 0.12, 2.6, 0.12, 'blue', x, 0, -0.35);
        mmBox(rg, 0.3, 0.1, 0.6, 'blue', x, 0, -0.15);
        [0.6, 1.3, 2.0].forEach(y => mmBox(rg, 0.08, 0.06, 0.75, 'blue', x, y, 0.05));
      });
      [0.68, 1.38].forEach((y, i) => { for (let k = 0; k < 5; k++) mmCyl(rg, 0.035, br.w, i ? 'steel' : 'chrome', 0, y + 0.04, -0.15 + k * 0.08, { axis: 'x' }); });
      mmBox(rg, br.w - 0.1, 0.03, 0.6, 'steel', 0, 2.08, 0.05);
      mmLabel(rg, 'BAR STOCK  •  6061 / 1018', 1.4, 0.18, 0, 2.35, 0.1, { bg: '#1e3a5f', fg: '#fff' });
      // Outside: the wing's walls keep paths off it (the doors stay open)
      const S = WORKSHOP_SITE;
      const X0 = S.x + b.x0, X1 = S.x + b.x1, Z0 = S.z + b.z0, Z1 = S.z + b.z1, ws = { workshop: true };
      addObstacle(obstacleWall(X0, Z0, X1, Z0, 0.6, [], ws), obstacleWall(X1, Z0, X1, Z1, 0.6, [], ws),
        obstacleWall(X0, Z0, X0, Z1, 0.6, [[hd.z - b.z0 - hd.w / 2 - 0.2, hd.z - b.z0 + hd.w / 2 + 0.2]], ws),
        obstacleWall(X0, Z1, X1, Z1, 0.6, [[sd.x - b.x0 - sd.w / 2 - 0.2, sd.x - b.x0 + sd.w / 2 + 0.2]], ws));
    }

// --- The hangar and assembly high bay ----------------------------------------------------------------
let wsHangar = null;
function buildWorkshopHangar3D() {
      if (wsHangar || !scene) return;
      const H = WORKSHOP_HANGAR, hx = H.w / 2, hz = H.d / 2;
      const g = wsHangar = new THREE.Group();
      g.position.set(H.x, WORKSHOP_PAD_Y, H.z);
      g.userData.isWorkshop = true;
      const rib = wsRibTexture();
      const clad = new THREE.MeshStandardMaterial({ color: 0xd3d8de, roughness: 0.5, metalness: 0.22, map: rib, bumpMap: rib, bumpScale: 0.03 });
      const band = new THREE.MeshStandardMaterial({ color: 0x3b4a5e, roughness: 0.5, metalness: 0.25, map: rib, bumpMap: rib, bumpScale: 0.03 });
      const plinth = new THREE.MeshStandardMaterial({ color: 0x8f8f8a, roughness: 0.92 });
      const floorMat = new THREE.MeshStandardMaterial({ color: 0xb9bab5, roughness: 0.55, metalness: 0.05, map: wsConcreteTexture() });
      const slat = wsSlatTexture();
      const doorMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.45, metalness: 0.45, map: slat, bumpMap: slat, bumpScale: 0.02 });
      const yellow = mmMat('yellow'), navy = mmMat('navy');
      wsPanel(g, H.w + 0.6, 0.38, H.d + 0.6, plinth, 0, -0.3, 0, 3).castShadow = false;
      const hfloor = wsPanel(g, H.w - 0.2, 0.04, H.d - 0.2, floorMat, 0, 0.08, 0, 3.2);
      hfloor.castShadow = false;
      wsPanel(g, H.door.w + 2, 0.06, 1.2, floorMat, 0, -0.04, hz + 0.6, 3.2).castShadow = false;
      const t = 0.16;
      // Front: the big door; back and sides: windows high up; a dark band under the eaves
      wsWallWithOpenings(g, 'x', hz, -hx, hx, H.h - 1.5, t, clad, [{ c: 0, w: H.door.w, h: H.door.h }], 1.28);
      wsWallWithOpenings(g, 'x', -hz, -hx, hx, H.h - 1.5, t, clad, [{ c: 0, w: H.w - 3, h: 1.4, y0: 6.6 }], 1.28);
      // (the east wall has door 5 through to the Workshop's north wing, on the line of its aisle)
      const wingDoorZ = WORKSHOP_SITE.z + WS_WING.doors.hangar.z - H.z, wingDoor = { c: wingDoorZ, w: WS_WING.doors.hangar.w, h: WS_WING.doors.hangar.h };
      [-hx, hx].forEach(x => wsWallWithOpenings(g, 'z', x, -hz, hz, H.h - 1.5, t, clad, [{ c: 0, w: H.d - 3, h: 1.4, y0: 6.6 }, ...(x > 0 ? [wingDoor] : [])], 1.28));
      const top = mmGroup(g, 0, H.h - 1.5, 0);
      wsWallWithOpenings(top, 'x', hz, -hx, hx, 1.5, t, band, [], 1.28);
      wsWallWithOpenings(top, 'x', -hz, -hx, hx, 1.5, t, band, [], 1.28);
      [-hx, hx].forEach(x => wsWallWithOpenings(top, 'z', x, -hz, hz, 1.5, t, band, [], 1.28));
      const glass = new THREE.MeshStandardMaterial({ color: 0x9cc7e6, roughness: 0.06, metalness: 0.3, transparent: true, opacity: 0.38 });
      mmBox(g, H.w - 3, 1.4, 0.04, glass, 0, 6.6, -hz);
      [-hx, hx].forEach(x => mmBox(g, 0.04, 1.4, H.d - 3, glass, x, 6.6, 0));
      // The door: header, guide rails, the rolled-up curtain and yellow bollards
      mmBox(g, H.door.w + 0.8, 0.9, 0.6, navy, 0, H.door.h, hz - 0.1);
      const curtain = new THREE.Mesh(wsUV(new THREE.BoxGeometry(H.door.w, 0.7, 0.05), 1.2), doorMat);
      curtain.position.set(0, H.door.h - 0.35, hz + 0.05);
      g.add(curtain);
      [-1, 1].forEach(s => {
        mmBox(g, 0.16, H.door.h, 0.2, 'steel', s * (H.door.w / 2 + 0.08), 0, hz);
        mmCyl(g, 0.13, 1.0, yellow, s * (H.door.w / 2 + 0.6), 0.5, hz + 0.9);
      });
      const sign = makeSignMesh('HANGAR & ASSEMBLY', { bg: '#1e3a5f', fg: '#f8fafc', width: 6.4, height: 0.8 });
      sign.position.set(0, H.h - 0.75, hz + 0.1);
      g.add(sign);
      // Outside: panel joints, flashing, gutters, downspouts, a rake trim and lamps (the east wall
      // stands against the Workshop and its north wing, so it stays plain)
      wsExteriorDetail(g, { W: H.w, D: H.d, eave: H.h, rise: 1.0, trim: navy,
        walls: [{ side: 'west', a: -hz, b: hz, y0: 0.35, flash: true }, { side: 'back', a: -hx, b: hx, y0: 0.35, flash: true },
          { side: 'front', a: -hx, b: hx, y0: 0.35, flash: true, skip: [[-H.door.w / 2, H.door.w / 2]] }],
        gutter: [-hx - 0.4, hx + 0.2], rakes: [-1],
        spouts: [[-hx, hz - 0.45, -1, 0], [-hx + 0.45, -hz, 0, -1], [hx - 0.45, -hz, 0, -1]],
        lamps: [['west', -3, 5], ['west', 3, 5], ['back', -5, 5], ['back', 5, 5]] });
      // Roof (see-through with the cutaway switch), trusses, the bridge crane
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b98a6, roughness: 0.55, metalness: 0.5, transparent: true, opacity: state.roofCutaway ? 0.18 : 0.95, side: THREE.DoubleSide });
      const pitch = Math.atan2(1.0, hz);
      [-1, 1].forEach(s => {
        const roof = new THREE.Mesh(wsUV(new THREE.BoxGeometry(H.w + 0.8, 0.08, Math.hypot(hz + 0.5, 1.0)), 1.0), roofMat);
        roof.position.set(0, H.h + 0.5, s * (hz + 0.5) / 2);
        roof.rotation.x = s * pitch;
        g.add(roof);
        if (typeof cutawayRoofMeshes !== 'undefined') cutawayRoofMeshes.push(roof);
      });
      for (let x = -hx + 0.3; x <= hx - 0.2; x += H.w / 6) {
        [-hz + 0.2, hz - 0.2].forEach(z => { if (Math.abs(x) > H.door.w / 2 + 0.2 || z < 0) mmBox(g, 0.24, H.h - 0.1, 0.24, navy, x, 0, z); });
        mmBox(g, 0.16, 0.5, H.d - 0.4, navy, x, H.h - 0.55, 0);
      }
      [-hz + 0.5, hz - 0.5].forEach(z => mmBox(g, H.w - 0.6, 0.3, 0.3, yellow, 0, H.craneY, z));
      const crane = mmGroup(g, 0, H.craneY + 0.3, 0);
      mmBox(crane, 0.4, 0.55, H.d - 1.0, yellow, -0.4, 0, 0);
      mmBox(crane, 0.4, 0.55, H.d - 1.0, yellow, 0.4, 0, 0);
      const trolley = mmGroup(crane, 0, -0.2, 0);
      mmBox(trolley, 1.2, 0.5, 0.8, mmMat('dark'), 0, 0, 0);
      const hook = mmGroup(trolley, 0, -0.1, 0);
      mmCyl(hook, 0.012, 3.0, 'steel', 0, -1.5, 0);
      mmBox(hook, 0.3, 0.3, 0.15, yellow, 0, -3.1, 0);
      mmLabel(crane, '20 T', 0.6, 0.3, 0.62, 0.3, 0, { bg: '#facc15', fg: '#111827', ry: Math.PI / 2 });
      g.userData.crane = crane;
      g.userData.hook = hook;
      // Lights under the trusses, facing down
      const fixGeo = new THREE.PlaneGeometry(1, 1);
      fixGeo.rotateX(Math.PI / 2);
      const lens = mmGlow('window');
      lens.emissive.setHex(0xf1f5ff);
      lens.emissiveIntensity = 1.2;
      for (let x = -hx + 0.3; x <= hx - 0.2; x += H.w / 6) [-3.5, 3.5].forEach(z => { const m = new THREE.Mesh(fixGeo, lens); m.scale.set(0.6, 1, 0.36); m.position.set(x, H.h - 0.82, z); g.add(m); });
      wsLights.push({ mesh: g.children[g.children.length - 1] });
      // Floor markings from WORKSHOP_HANGAR_BAYS: build bays in yellow, parking in white, the lane hatched
      const line = (x, z, w, d, mat = yellow) => mmBox(g, w, 0.008, d, mat, x, 0.125, z);
      const flat = (text, w, x, z, fg = '#a16207', rz = 0) => { const l = mmLabel(g, text, w, w * 0.11, x, 0.13, z, { bg: '#b9bab5', fg }); l.rotation.x = -Math.PI / 2; l.rotation.z = rz; return l; };
      WORKSHOP_HANGAR_BAYS.forEach(bay => {
        const mat = bay.kind === 'build' ? yellow : bay.kind === 'parking' ? mmMat('white') : mmMat('hazard');
        line(bay.x, bay.z - bay.d / 2, bay.w, 0.1, mat); line(bay.x, bay.z + bay.d / 2, bay.w, 0.1, mat);
        line(bay.x - bay.w / 2, bay.z, 0.1, bay.d, mat); line(bay.x + bay.w / 2, bay.z, 0.1, bay.d, mat);
        if (bay.kind === 'lane') for (let k = 0; k < 5; k++) line(bay.x, bay.z - bay.d / 2 + 0.7 + k * (bay.d - 1.4) / 4, bay.w - 0.6, 0.12, mmMat('hazard'));
        const lw = Math.min(bay.w - 0.6, bay.kind === 'build' && bay.w > 10 ? 5.0 : 2.6);
        if (bay.w >= bay.d || bay.kind === 'build') flat(bay.label, lw, bay.x, bay.z + bay.d / 2 - 0.55);
        else flat(bay.label, Math.min(bay.d - 0.6, 3.6), bay.x + bay.w / 2 - 0.6, bay.z, '#a16207', Math.PI / 2);
      });
      // A painted footprint of a high-wing ultralight (9.5 m span, 5.6 m long) in build bay 1, nose to the door
      const b1 = WORKSHOP_HANGAR_BAYS.find(b => b.key === 'build1');
      const span = 15.2, chord = 2.3, fus = 9.0, nose = b1.z + b1.d / 2 - 0.25, wingZ = nose - 2.4;
      [[b1.x, wingZ - chord / 2, span, 0.08], [b1.x, wingZ + chord / 2, span, 0.08]].forEach(([x, z, w, d]) => line(x, z, w, d, mmMat('white')));
      [-span / 2, span / 2].forEach(x => line(b1.x + x, wingZ, 0.08, chord, mmMat('white')));
      [-0.5, 0.5].forEach(x => line(b1.x + x, nose - fus / 2, 0.08, fus, mmMat('white')));
      line(b1.x, nose - fus, 4.2, 0.08, mmMat('white'));
      line(b1.x, nose - fus + 1.1, 4.2, 0.08, mmMat('white'));
      [-2.1, 2.1].forEach(x => line(b1.x + x, nose - fus + 0.55, 0.08, 1.1, mmMat('white')));
      // Wing span gauge marks (every metre, 1.6 units) along the back of the bay
      for (let i = -5; i <= 5; i++) line(b1.x + i * 1.6, b1.z - b1.d / 2 + 0.35, 0.05, i % 5 ? 0.4 : 0.7);
      flat('KEEP CLEAR  •  CRANE OVERHEAD', 3.4, -2.0, hz - 0.5, '#b91c1c');
      // A parts cart and two trestles in build bay 1, a pair of sawhorses in build bay 2
      const cart = mmGroup(g, b1.x + b1.w / 2 - 1.0, 0.1, b1.z - b1.d / 2 + 1.2);
      mmBox(cart, 0.9, 0.05, 0.6, 'red', 0, 0.35, 0);
      mmBox(cart, 0.9, 0.05, 0.6, 'red', 0, 0.9, 0);
      [-0.42, 0.42].forEach(x => mmBox(cart, 0.04, 0.95, 0.04, 'red', x, 0, 0.27));
      [-3, 3].forEach(x => { mmBox(g, 1.2, 0.08, 0.3, 'wood', b1.x + x, 0.95, b1.z - 1.5); [-0.5, 0.5].forEach(dx => mmBox(g, 0.06, 0.95, 0.4, 'wood', b1.x + x + dx, 0.1, b1.z - 1.5)); });
      const b2 = WORKSHOP_HANGAR_BAYS.find(b => b.key === 'build2');
      [-1.6, 1.6].forEach(x => { mmBox(g, 0.12, 0.06, 1.0, 'wood', b2.x + x, 0.8, b2.z - 0.2); [-0.4, 0.4].forEach(dz => mmBox(g, 0.3, 0.75, 0.05, 'wood', b2.x + x, 0.1, b2.z - 0.2 + dz)); });
      if (typeof dressBuilding === 'function') dressBuilding(g, [[roofMat, 'metalroof', 1.2], [plinth, 'stone', 2]]);
      // Its many small fixed parts (trusses, markings, trims, carts) join per material now, the way the
      // Workshop's do (mergeStaticMeshes below leaves the shared-geometry parts alone)
      wsMergeStatic(g, new Set(typeof cutawayRoofMeshes !== 'undefined' ? cutawayRoofMeshes : []), [crane]);
      scene.add(g);
      // Its static walls, trusses, markings and carts draw as one mesh per material (js/perf.js); the
      // crane and hook (userData), the see-through roof and the light fixtures stay separate
      if (typeof mergeStaticMeshesSoon === 'function') mergeStaticMeshesSoon(g, () => [...(typeof cutawayRoofMeshes !== 'undefined' ? cutawayRoofMeshes : []), ...wsLights.map(l => l && (l.mesh || l)).filter(Boolean)]);
      // Walls are solid; the inside and the door are open to walk and drive through
      // (thin wall boxes, js/scene.js obstacleWall; the door gaps stay open)
      const ws = { workshop: true };
      addObstacle(obstacleWall(H.x - hx, H.z - hz, H.x + hx, H.z - hz, 0.6, [], ws),
        obstacleWall(H.x - hx, H.z - hz, H.x - hx, H.z + hz, 0.6, [], ws),
        obstacleWall(H.x + hx, H.z - hz, H.x + hx, H.z + hz, 0.6, [[wingDoorZ + hz - wingDoor.w / 2 - 0.2, wingDoorZ + hz + wingDoor.w / 2 + 0.2]], ws),
        obstacleWall(H.x - hx, H.z + hz, H.x + hx, H.z + hz, 0.6, [[hx - H.door.w / 2 - 0.3, hx + H.door.w / 2 + 0.3]], ws));
      // Trees that grew where it now stands are gone
      if (typeof valleyTrees !== 'undefined') {
        for (let i = valleyTrees.length - 1; i >= 0; i--) {
          const tr = valleyTrees[i];
          if (Math.abs(tr.x - H.x) > hx + 1.5 || Math.abs(tr.z - H.z) > hz + 1.5) continue;
          if (tr.group && tr.group.parent) tr.group.parent.remove(tr.group);
          worldObstacles = worldObstacles.filter(o => o !== tr.obstacle);
          valleyTrees.splice(i, 1);
        }
      }
    }

// The hangar's bays as world rectangles: { key, kind, label, x, y, z (centre on the floor), w, d, rotY }
function workshopHangarBays(kind) {
      const H = WORKSHOP_HANGAR;
      return WORKSHOP_HANGAR_BAYS.filter(b => !kind || b.kind === kind).map(b => ({
        key: b.key, kind: b.kind, label: b.label, x: H.x + b.x, y: WORKSHOP_PAD_Y + 0.12, z: H.z + b.z, w: b.w, d: b.d, rotY: b.ry || 0, lane: Boolean(b.lane)
      }));
    }

// The hangar's assembly bay, for the assembly builds (the ultralight and other big projects):
// { x, y, z } its centre on the floor, { w, d } the marked bay (w across x), the crane's hook height,
// and the door it rolls out through (centre, width, height, facing +z onto the helipad).
// workshopAssemblyBay(2) is the second, smaller build bay.
function workshopAssemblyBay(n = 1) {
      const H = WORKSHOP_HANGAR, bay = workshopHangarBays('build')[n - 1] || workshopHangarBays('build')[0];
      return {
        key: bay.key, x: bay.x, y: bay.y, z: bay.z, w: bay.w, d: bay.d, rotY: 0,
        craneHookY: WORKSHOP_PAD_Y + H.craneY - 3.0,
        door: { x: H.x, z: H.z + H.d / 2, w: H.door.w, h: H.door.h, facing: 'south' },
        outside: { x: H.x, z: H.z + H.d / 2 + 2.5 }
      };
    }

function workshopAssemblyBays() {
      return workshopHangarBays('build').map((_, i) => workshopAssemblyBay(i + 1));
    }

// Where vehicles park inside (world): the hangar's parking bays, then the wing's aisle
function workshopParkingSpots() {
      const S = WORKSHOP_SITE;
      return [...workshopHangarBays('parking'),
        { key: 'wing', kind: 'parking', label: 'Wing aisle (drive-through)', x: S.x + (WS_WING.x - WS_WING.w / 2 + WS_WING.doors.shop.x + WS_WING.doors.shop.w / 2) / 2, y: WORKSHOP_PAD_Y + 0.12, z: S.z + WS_WING.aisleZ, w: WS_WING.doors.shop.x + WS_WING.doors.shop.w / 2 - (WS_WING.x - WS_WING.w / 2), d: WS_WING.aisleW, rotY: 0, lane: true }];
    }

// Does something of this size (units, {x, y, z}) fit: through which doors, on the car elevator, in
// which bays. Given a list of sizes (or { name, size } items) it also packs them: each item gets a bay
// of its own (biggest first, build bays for builds, parking for vehicles) and the answer says where
// each one goes and what is left over. workshopFits([plane, pickupAndTrailer, dumpTruck]).
function wsFitsOne(size) {
      const L = Math.max(size.x, size.z), W = Math.min(size.x, size.z), Hh = size.y;
      const inBay = b => L < Math.max(b.w, b.d) + 0.01 && W < Math.min(b.w, b.d) + 0.01;
      const bays = {};
      WORKSHOP_HANGAR_BAYS.forEach(b => { bays[b.key] = inBay(b) && Hh < WORKSHOP_HANGAR.craneY - 0.5; });
      const wingLen = WS_WING.doors.shop.x + WS_WING.doors.shop.w / 2 - (WS_WING.x - WS_WING.w / 2);
      return {
        hangarDoor: W < WORKSHOP_HANGAR.door.w - 0.6 && Hh < WORKSHOP_HANGAR.door.h - 0.3,
        hangarBay: bays.build1,
        bays,
        door1: W < WS_DOORS.vehicle.w - 0.3 && Hh < WS_DOORS.vehicle.h - 0.2,
        wingDoor: W < WS_WING.doors.hangar.w - 0.3 && Hh < WS_WING.doors.hangar.h - 0.2,
        wingAisle: L < wingLen && W < WS_WING.aisleW - 0.2 && Hh < WS_WING.h - 0.6,
        driveThrough: W < Math.min(WS_WING.doors.hangar.w, WS_WING.doors.shop.w, WS_DOORS.vehicle.w, WS_LIFT.w + 0.2) - 0.3 && Hh < Math.min(WS_WING.doors.hangar.h, WS_WING.doors.shop.h, WS_DOORS.vehicle.h, WS_F2 - 0.3) - 0.2,
        carElevator: L < WS_LIFT.d - 0.2 && W < WS_LIFT.w - 0.1 && Hh < WS_F2 - 0.3 - WS_F1,
        garageLift: W < 3.6 && Hh + 1.9 < WS_F3 - 0.3 - WS_F2
      };
    }

function workshopFits(sizeOrList) {
      if (!Array.isArray(sizeOrList)) return wsFitsOne(sizeOrList);
      const items = sizeOrList.map((it, i) => {
        const size = it && it.size ? it.size : it;
        return { name: (it && it.name) || `item ${i + 1}`, size, build: Boolean(it && it.build), area: size.x * size.z, fits: wsFitsOne(size) };
      });
      const free = WORKSHOP_HANGAR_BAYS.filter(b => b.kind !== 'lane').map(b => ({ ...b }));
      free.push({ key: 'wing', kind: 'parking', w: WS_WING.doors.shop.x + WS_WING.doors.shop.w / 2 - (WS_WING.x - WS_WING.w / 2), d: WS_WING.aisleW });
      const placements = [], left = [];
      items.slice().sort((a, b) => b.area - a.area).forEach(it => {
        const ok = b => (it.fits.bays[b.key] !== undefined ? it.fits.bays[b.key] : it.fits.wingAisle) && (it.fits.hangarDoor || (b.key === 'wing' && it.fits.door1));
        const order = it.build ? ['build', 'parking'] : ['parking', 'build'];
        let bay = null;
        for (const kind of order) { bay = free.find(b => b.kind === kind && ok(b)); if (bay) break; }
        if (bay) { free.splice(free.indexOf(bay), 1); placements.push({ name: it.name, bay: bay.key }); } else left.push(it.name);
      });
      return { fits: left.length === 0, placements, left, each: items.map(it => ({ name: it.name, ...it.fits })) };
    }

// --- Floor 1 machines: built in full only while the camera is near ------------------------------------
let wsQueue = [];
let wsFloor1Wanted = false;

function wsBuildStandIns() {
      const spots = workshopMachinesOn(1).map(def => {
        const sz = def.size || { w: 1, h: 1, d: 1 };
        return { x: def.at.x, y: WS_F1, z: def.at.z, w: sz.w, h: sz.h || 1.2, d: sz.d, rotY: def.at.ry || 0, color: def.color || 0x9aa3ad };
      });
      if (wsStandIns) disposePerfStandIns(wsStandIns);
      wsStandIns = typeof perfStandIns === 'function' ? perfStandIns(spots) : null;
      if (wsStandIns) wsGroup.add(wsStandIns);
    }

function wsShowFloor1(near) {
      wsFloor1Wanted = near;
      if (near) {
        wsQueue = workshopMachinesOn(1).filter(def => !wsModels[def.key]).map(def => def.key);
        if (workshopTrip.active) wsBuildQueued(Infinity);
      } else {
        wsQueue = [];
        workshopMachinesOn(1).forEach(def => wsDropModel(def.key));
        if (wsStandIns) wsStandIns.visible = true;
      }
    }

function wsBuildQueued(n) {
      let made = 0;
      while (wsQueue.length && made < n) {
        const key = wsQueue.shift();
        if (!wsModels[key]) { wsBuildModel(WORKSHOP_MACHINES[key]); made++; }
      }
      if (!wsQueue.length && wsStandIns && wsFloor1Wanted) wsStandIns.visible = false;
    }

function wsBuildModel(def) {
      if (!def || !def.model || wsModels[def.key]) return wsModels[def.key] || null;
      let m;
      try { m = def.model(); } catch (e) { console.warn('workshop model', def.key, e); return null; }
      if (typeof machineMergeStatic === 'function') { try { machineMergeStatic(m); } catch (e) { console.warn('machine merge', def.key, e); } }
      m.position.set(def.at.x, 0, def.at.z);
      m.rotation.y = def.at.ry || 0;
      m.userData.machineKey = def.key;
      (def.floor === 3 ? wsFloor3 : def.floor === 2 ? wsFloor2 : wsFloor1).add(m);
      wsModels[def.key] = m;
      wsNoteModelView(m, def.floor);
      if (typeof def.onBuilt === 'function') def.onBuilt(m);
      return m;
    }

function wsDropModel(key) {
      const m = wsModels[key];
      if (!m) return;
      if (m.parent) m.parent.remove(m);
      if (typeof disposeTree === 'function') disposeTree(m);
      delete wsModels[key];
      wsModelView.delete(m);
    }

// --- Drawing only what can be seen -----------------------------------------------------------------
// Each machine's small parts (js/machinemodels.js mmFineTier) are left out once the camera is too
// far away to see them, and a machine under an opaque deck the camera looks down on is not drawn at
// all (it goes on layer 1, which the camera doesn't render). Floors above the one being viewed are
// hidden in wsSetDecksFor. Nothing here moves a part or changes what a job can reach.
const wsModelView = new Map();   // model -> { box (world), floor, fine: [[mesh, tier]], near: [bool, bool], hidden }
const WS_FINE_DIST = [8, 12.5];  // how far away each size class of small part still shows (Balanced)
let wsViewFloor = null, wsViewCullAt = 0, wsDeckRects = null;
function wsNoteModelView(m, floor) {
      m.updateWorldMatrix(true, true);
      const fine = [];
      if (typeof mmFineTier !== 'undefined') m.traverse(o => { const t = mmFineTier.get(o); if (t) fine.push([o, t]); });
      wsModelView.set(m, { box: new THREE.Box3().setFromObject(m), floor, fine, near: [true, true], hidden: false });
      wsViewCullAt = 0;
    }

function wsSetModelLayer(m, hide) {
      m.traverse(o => { if (hide) o.layers.set(1); else o.layers.set(0); });
    }

// The decks as world rectangles at their top surface (the building is never turned)
function wsDeckRectList() {
      if (wsDeckRects) return wsDeckRects;
      wsDeckRects = [...wsDeckMeshes.map(d => [d, 2]), ...wsDeck3Meshes.map(d => [d, 3])].map(([d, floor]) => {
        d.updateWorldMatrix(true, false);
        const b = new THREE.Box3().setFromObject(d);
        return { mesh: d, floor, x0: b.min.x + 0.02, x1: b.max.x - 0.02, z0: b.min.z + 0.02, z1: b.max.z - 0.02, y: b.max.y };
      });
      return wsDeckRects;
    }

// Hidden behind a deck: every corner of the machine's box, seen from the camera, is behind the same
// solid deck rectangle (the camera above it, the machine below it)
function wsBehindDeck(box, cam, rects) {
      for (const r of rects) {
        if (cam.y <= r.y + 0.05 || box.max.y >= r.y - 0.3) continue;
        let all = true;
        for (let i = 0; i < 8 && all; i++) {
          const x = i & 1 ? box.max.x : box.min.x, y = i & 2 ? box.max.y : box.min.y, z = i & 4 ? box.max.z : box.min.z;
          const t = (cam.y - r.y) / (cam.y - y), px = cam.x + (x - cam.x) * t, pz = cam.z + (z - cam.z) * t;
          all = px > r.x0 && px < r.x1 && pz > r.z0 && pz < r.z1;
        }
        if (all) return true;
      }
      return false;
    }

function wsViewCull() {
      const now = performance.now();
      if (!wsGroup || !camera || !wsModelView.size || now - wsViewCullAt < 150) return;
      wsViewCullAt = now;
      const q = typeof graphics === 'function' ? graphics() : null;
      const k = q && q.label === 'High' ? 1.4 : q && q.label === 'Fast' ? 0.6 : 1;
      const cam = camera.position;
      const rects = wsViewFloor >= 2 ? wsDeckRectList().filter(r => r.mesh.visible && r.mesh.material.opacity >= 0.97 && r.floor <= wsViewFloor) : [];
      wsModelView.forEach((v, m) => {
        const d = Math.max(0, v.box.distanceToPoint(cam));
        const n0 = d < WS_FINE_DIST[0] * k, n1 = d < WS_FINE_DIST[1] * k;
        if (n0 !== v.near[0] || n1 !== v.near[1]) {
          v.near = [n0, n1];
          v.fine.forEach(([o, t]) => { o.visible = t === 1 ? n0 : n1; });
        }
        const hide = v.floor < (wsViewFloor || 0) && rects.length > 0 && wsBehindDeck(v.box, cam, rects);
        // (re-applied while hidden: a job may have added a part to it since)
        if (hide || v.hidden) wsSetModelLayer(m, hide);
        v.hidden = hide;
      });
    }

// The model of a machine, built now if it isn't (during a trip, or a visitor's request)
function workshopModel(key) {
      const def = WORKSHOP_MACHINES[key];
      if (!def || !wsGroup) return null;
      return wsModels[key] || wsBuildModel(def);
    }

// Floors 2 and 3: built when he goes up, taken down when he comes back
const wsUpperBuilt = { 2: false, 3: false };
function workshopShowFloor(floor, on) {
      if (!wsGroup || !wsUpperBuilt.hasOwnProperty(floor)) return;
      if (on && !wsUpperBuilt[floor]) {
        workshopMachinesOn(floor).forEach(def => wsBuildModel(def));
        wsUpperBuilt[floor] = true;
      } else if (!on && wsUpperBuilt[floor]) {
        workshopMachinesOn(floor).forEach(def => wsDropModel(def.key));
        wsUpperBuilt[floor] = false;
      }
    }

function workshopShowUpstairs(on) {
      workshopShowFloor(2, on);
      if (!on) workshopShowFloor(3, false);
    }

// --- Lights and day/night -------------------------------------------------------------------------------
function wsUpdateLighting() {
      if (!wsGroup) return;
      const night = typeof worldNow === 'function' ? worldNow().isNight || worldNow().hour < 7 || worldNow().hour > 19 : false;
      const near = camera && camera.position.distanceTo(wsGroup.position) < 45;
      const on = near || night || workshopTrip.active;
      wsLights.forEach(l => { l.mesh.material.emissiveIntensity = l.outdoor ? (night ? 1.6 : 0.1) : (on ? 1.4 : 0.2); });
      wsWindowGlass.forEach(m => { m.emissiveIntensity = night ? 0.35 : 0; });
    }

// The platform at height y above floor 1's top (0 = down, WS_F2 - WS_F1 = up)
function wsUpdateLift(y) {
      if (!wsLift) return;
      wsLift.position.y = WS_F1 + y;
      const ram = wsGroup.userData.ram;
      if (ram) { ram.scale.y = Math.max(0.05, y + WS_F1); ram.position.y = (y + WS_F1) / 2 - 0.05; ram.visible = y > 0.05; }
    }

// --- Hover names --------------------------------------------------------------------------------------
let wsHoverTag = null, wsHovered = null;
function wsInitHover() {
      if (!renderer || !renderer.domElement) return;
      const ray = new THREE.Raycaster();
      const handle = (e) => {
        if (!wsGroup || camera.position.distanceTo(wsGroup.position) > 60) { wsSetHover(null); return; }
        const rect = renderer.domElement.getBoundingClientRect();
        ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
        const targets = [...wsFloor1.children, ...wsFloor2.children].filter(o => o.visible);
        const hits = ray.intersectObjects(targets, true);
        let o = hits.length ? hits[0].object : null;
        while (o && !(o.userData && o.userData.machineKey)) o = o.parent;
        wsSetHover(o);
      };
      renderer.domElement.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') handle(e); });
      renderer.domElement.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') handle(e); });
    }

function wsSetHover(obj) {
      if (obj === wsHovered) return;
      wsHovered = obj;
      if (wsHoverTag) {
        scene.remove(wsHoverTag);
        wsHoverTag.material.map.dispose();
        wsHoverTag.material.dispose();
        wsHoverTag = null;
      }
      if (!obj) return;
      const def = WORKSHOP_MACHINES[obj.userData.machineKey];
      if (!def) return;
      const learned = typeof machineKnown === 'function' && machineKnown(def.key);
      wsHoverTag = makeSignMesh(`${def.name}${learned ? '  ✓' : ''}`.slice(0, 40), { bg: '#0f172a', fg: learned ? '#86efac' : '#fde68a', width: 2.8, height: 0.32 });
      const box = new THREE.Box3().setFromObject(obj);
      wsHoverTag.position.set((box.min.x + box.max.x) / 2, box.max.y + 0.4, (box.min.z + box.max.z) / 2);
      wsHoverTag.quaternion.copy(camera.quaternion);
      wsHoverTag.renderOrder = 10;
      wsHoverTag.material.depthTest = false;
      scene.add(wsHoverTag);
    }

// --- Going inside -------------------------------------------------------------------------------------
// The site description the indoor-trip walk (js/basements.js) uses: routes go round the machines
// on whichever floor he is on.
const workshopTrip = { active: false, floor: 1, vehicle: null, liftY: 0 };

function workshopSite() {
      if (!wsGroup) return null;
      const nodes = [];
      for (let x = -WS_IN.x + 0.6; x <= WS_IN.x - 0.5; x += 0.9) for (let z = -WS_IN.z + 0.6; z <= WS_IN.z - 0.5; z += 0.9) nodes.push({ x, z });
      // the north wing (floor 1 only: upstairs these are off the deck and never reachable), and the
      // way through door 4
      const wb = wsWingBounds();
      for (let x = wb.x0 + 0.6; x <= wb.x1 - 0.5; x += 0.9) for (let z = wb.z0 + 0.6; z <= wb.z1 - 0.5; z += 0.9) nodes.push({ x, z, wing: true });
      [-1, 0, 1].forEach(k => nodes.push({ x: WS_WING.doors.shop.x + k * 1.2, z: wb.z1, wing: true }));
      return {
        key: 'workshop', name: 'Workshop', group: wsGroup, w: WORKSHOP_SITE.w, d: WORKSHOP_SITE.d, floorY: WS_F1,
        hatch: { x: WS_LIFT.x, z: WS_LIFT.z }, entryAngle: Math.PI / 2,
        outside: { x: WS_DOORS.person.x, z: WORKSHOP_SITE.d / 2 + 1.2 },
        walkIn: [{ x: WS_DOORS.person.x, z: WORKSHOP_SITE.d / 2 + 0.6, y: 0 }, { x: WS_DOORS.person.x, z: WORKSHOP_SITE.d / 2 - 0.4, y: WS_F1 }, { x: WS_DOORS.person.x, z: WORKSHOP_SITE.d / 2 - 1.2, y: WS_F1 }],
        get nodes() { return workshopTrip.floor === 1 ? nodes : nodes.filter(n => !n.wing); },
        obstacles: () => wsObstacles(workshopTrip.floor),
        levels: () => 0, camDist: 15, cutFlat: 8
      };
    }

function wsObstacles(floor) {
      const out = [];
      workshopMachinesOn(floor).forEach(def => out.push(...machineCircles(def)));
      // The car elevator's open west side and north end (masts, rails, the shaft when the platform
      // is on another floor): he steps on and off only through the landing gate, never along its edge
      const lx0 = WS_LIFT.x - WS_LIFT.w / 2, lz0 = WS_LIFT.z - WS_LIFT.d / 2, lz1 = WS_LIFT.z + WS_LIFT.d / 2;
      for (let z = lz0; z <= lz1 + 1e-6; z += 0.4) if (Math.abs(z - WS_LIFT_GATE) > 0.8) out.push({ x: lx0, z, r: 0.12 });
      for (let x = lx0 + 0.4; x <= WS_LIFT.x + WS_LIFT.w / 2 + 1e-6; x += 0.4) out.push({ x, z: lz0, r: 0.12 });
      if (floor === 1) {
        // The deck columns, the Taurus bay edge, the stations
        for (let z = -WS_IN.z + 1.45; z < WS_IN.z - 0.4; z += 3.5) out.push({ x: -3.8, z, r: 0.35 });
        ['weld'].forEach(k => { const st = WORKSHOP_STATIONS[k]; out.push({ x: st.local.x - 0.6, z: st.local.z, r: 0.55 }, { x: st.local.x + 0.6, z: st.local.z, r: 0.55 }); });
        // The back wall between the shop and the wing, open at door 4
        const sd = WS_WING.doors.shop;
        for (let x = -WS_IN.x; x <= WS_IN.x; x += 0.5) if (Math.abs(x - sd.x) > sd.w / 2 - 0.2) out.push({ x, z: -WORKSHOP_SITE.d / 2, r: 0.32 });
      } else {
        // The open edge over the high bay (floor 2; the floor-3 deck covers it)
        if (floor === 2) for (let z = -WS_IN.z; z <= WS_IN.z; z += 0.8) out.push({ x: -4.4, z, r: 0.5 });
        if (workshopTrip.vehicle) {
          const v = workshopTrip.vehicleAt;
          if (v) for (let k = -3; k <= 3; k++) out.push({ x: v.x, z: v.z + k * 1.2, r: 1.5 });
        }
      }
      return out;
    }

// Walk inside to a local point on the floor he is on
function wsWalkTo(site, from, to) {
      const y = wsFloorY(workshopTrip.floor);
      return tripWalk(routeInside(site, from, to).map(p => siteToWorld(site, p.x, p.z, y + (workshopTrip.liftY && wsOnLift(p) ? 0 : 0))));
    }

function wsOnLift(p) {
      return Math.abs(p.x - WS_LIFT.x) < WS_LIFT.w / 2 && Math.abs(p.z - WS_LIFT.z) < WS_LIFT.d / 2;
    }

// Ride the car elevator between floors. Whatever stands on the platform (him, a vehicle) rides with
// it: riders(y) puts them on the platform top y in the same frame the platform moves (tripRide, js/basements.js),
// eased in and out. The decks change as he passes them (the one above stays see-through until his
// feet are past it, so he never vanishes under a deck that turned solid before he got there).
async function wsRideLift(toFloor, riders = []) {
      const from = workshopTrip.liftY, to = wsFloorY(toFloor) - WS_F1;
      const ms = Math.max(1000, Math.abs(to - from) / 0.9 * 1000 * 1.25);
      const base = wsGroup.position.y;
      let held = false;
      // (window.__wsHold = 'elevator' stops the ride half way, for a screenshot; see js/machines.js)
      const holdIf = t => {
        const want = Boolean(window.__wsHold && /elevator/i.test(window.__wsHold) && workshopTrip.active);
        if (!held && want && t > 0.5) { held = true; window.__wsHeld = 'car elevator'; }
        if (held && !want && window.__wsHeld === 'car elevator') window.__wsHeld = null;
        return held && want;
      };
      await tripRide(ms, e => {
        const y = from + (to - from) * e;
        workshopTrip.liftY = y;
        wsUpdateLift(y);
        riders.forEach(r => r(base + WS_F1 + y));
        const top = WS_F1 + y + 0.05, f = top >= WS_F3 ? 3 : top >= WS_F2 ? 2 : 1;
        if (f !== wsViewFloor) wsSetDecksFor(f);
      }, holdIf);
      workshopTrip.liftY = to;
      wsUpdateLift(to);
    }

// Animate something over ms: fn(k 0..1, seconds since start). Keeps going when the tab is hidden.
function wsAnimate(ms, fn) {
      return new Promise(resolve => {
        const start = performance.now();
        let done = false;
        const step = () => {
          if (done) return;
          const t = performance.now() - start, k = Math.min(1, t / ms);
          try { fn(k, t / 1000); } catch (e) { console.warn(e); }
          if (k >= 1 || !workshopTrip.active) { done = true; resolve(); return; }
          if (document.hidden) setTimeout(step, 50); else requestAnimationFrame(step);
        };
        step();
      });
    }

// The visit itself. plan: { title, floor, vehicle, stops: [{ key | station, floor, stand, act(ctx) }] }
// One indoor trip at a time (shared queue with the Storehouse and Museum trips).
function goIntoWorkshop(plan) {
      const run = (typeof indoorQueue !== 'undefined' ? indoorQueue : Promise.resolve()).then(() => runWorkshopVisit(plan));
      if (typeof indoorQueue !== 'undefined') indoorQueue = run.catch(() => {});
      return run;
    }

async function runWorkshopVisit(plan) {
      if (!wsGroup) buildWorkshop3D();
      const site = workshopSite();
      if (!site || !keloGroup || typeof indoorTrip === 'undefined') return false;
      const outside = siteToWorld(site, site.outside.x, site.outside.z, 0);
      outside.y = getIslandGroundHeight(outside.x, outside.z);
      const veh = plan.vehicle || null;
      const vehHome = veh ? { x: veh.x, z: veh.z, rotY: veh.rotY || 0 } : null;
      if (veh && typeof driveVehicle === 'function') {
        // He drives it round to the vehicle door first
        const H = WORKSHOP_HANGAR, lane = WORKSHOP_HANGAR_BAYS.find(b => b.key === 'lane');
        const door = plan.driveThrough ? { x: H.x + lane.x, z: H.z + H.d / 2 + 3.0 } : siteToWorld(site, WS_DOORS.vehicle.x, WORKSHOP_SITE.d / 2 + 4.2, 0);
        if (Math.hypot(veh.x - door.x, veh.z - door.z) > 3) await driveVehicle(veh, { x: door.x, z: door.z }, `Driving the ${String(veh.name).replace(/^(an?|the)\s+/i, '')} to the Workshop`);
        // (he climbed out by the driver's door; he gets straight back in to back it inside)
        if (state.riding || Math.hypot(veh.x - door.x, veh.z - door.z) > 3) return false;
      } else {
        state.targetPos = { x: outside.x, z: outside.z };
        const far = Math.hypot(state.botPos.x - outside.x, state.botPos.z - outside.z);
        await waitForArrival(Math.min(150000, 15000 + far * 1500));
        if (Math.hypot(state.botPos.x - outside.x, state.botPos.z - outside.z) > 1.8 || state.riding) return false;
      }
      const roofs = typeof cutawayRoofMeshes !== 'undefined' ? cutawayRoofMeshes.filter(r => r.parent === wsGroup && !wsDeckMeshes.includes(r)) : [];
      const results = [];
      let cur = null;
      try {
        Object.assign(indoorTrip, {
          active: true, site, pos: { x: state.botPos.x, y: getIslandGroundHeight(state.botPos.x, state.botPos.z), z: state.botPos.z },
          rotY: state.botRotY, path: null, pose: null, crouch: 0, crouchTarget: 0, lastT: null, cutLevel: 0
        });
        Object.assign(workshopTrip, { active: true, floor: 1, vehicle: veh, vehicleAt: null, vehicleHome: vehHome, liftY: 0 });
        wsUpdateLift(0);
        roofs.forEach(r => { r.material.opacity = 0.1; });
        wsSetFrontFade(0.12);
        wsSetDecksFor(1);
        wsShowFloor1(true);
        wsBuildQueued(Infinity);
        wsUpdateLighting();
        if (veh && plan.driveThrough) {
          await wsDriveThrough(site, veh, plan.driveThrough === true ? {} : plan.driveThrough);
          cur = null;
        } else if (veh && plan.vehicleTour) {
          await wsVehicleTour(site, veh, plan.vehicleTour);
          cur = null;
        } else if (veh) {
          await wsDriveIn(site, veh);
          cur = { x: WS_LIFT.x - WS_LIFT.w / 2 - 0.45, z: WORKSHOP_STATIONS.garage.local.z + 0.8 };
        } else {
          await tripWalk([outside, ...site.walkIn.map(p => siteToWorld(site, p.x, p.z, p.y))]);
          const hub = site.walkIn[site.walkIn.length - 1];
          cur = { x: hub.x, z: hub.z };
        }
        for (const stop of plan.stops || []) {
          const floor = stop.floor || 1;
          if (floor !== workshopTrip.floor && !veh) cur = await wsChangeFloor(site, cur, floor);
          const def = stop.key ? WORKSHOP_MACHINES[stop.key] : null;
          const stand = stop.stand || (def ? machineStand(def) : null);
          if (stand) { await wsWalkTo(site, cur, stand); cur = stand; }
          const model = def ? workshopModel(def.key) : null;
          if (model) tripFace(siteToWorld(site, def.at.x, def.at.z, 0));
          const ctx = wsContext(site, def, model, stop);
          const focusFn = typeof machineFocusFn === 'function' ? machineFocusFn(model) : null;
          if (focusFn) setKeloFocus(focusFn);
          // his hands on the machine's controls while he works it (js/kelo-ik.js)
          const reachFn = typeof setKeloReach === 'function' ? wsControlReach(model) : null;
          if (reachFn) setKeloReach(reachFn);
          try { results.push(await stop.act(ctx)); } catch (e) { console.warn('workshop stop', e); results.push(false); }
          finally { if (focusFn) clearKeloFocus(focusFn); if (reachFn) clearKeloReach(reachFn); }
          indoorTrip.pose = null;
          indoorTrip.crouchTarget = 0;
          if (results[results.length - 1] === false) break; // a failed step ends the job (no washing a print that never came off)
        }
        if (veh && (plan.vehicleTour || plan.driveThrough)) {
          // (the tour drove back out already)
        } else if (veh) {
          await wsDriveOut(site, veh);
        } else {
          if (workshopTrip.floor !== 1) cur = await wsChangeFloor(site, cur, 1);
          const hub = site.walkIn[site.walkIn.length - 1];
          await wsWalkTo(site, cur, hub);
          await tripWalk([...site.walkIn.slice().reverse().map(p => siteToWorld(site, p.x, p.z, p.y)), outside]);
        }
        return results;
      } finally {
        indoorTrip.path = null;
        const hold = indoorTrip.resolve;
        indoorTrip.resolve = null;
        if (hold) hold();
        indoorTrip.active = false;
        indoorTrip.site = null;
        if (typeof clearKeloReach === 'function') clearKeloReach();
        indoorTrip.pose = null;
        indoorTrip.crouch = 0;
        state.basementDepth = 0;
        if (veh && workshopTrip.vehicleOut) state.botPos = { ...workshopTrip.vehicleOut };
        else state.botPos = { x: outside.x, z: outside.z };
        state.targetPos = { ...state.botPos };
        wsUnhitchTrailer();
        Object.assign(workshopTrip, { active: false, floor: 1, vehicle: null, vehicleAt: null, vehicleOut: null, vehicleHome: null, vehPose: null, liftY: 0 });
        wsUpdateLift(0);
        workshopShowUpstairs(false);
        wsSetFrontFade(1);
        wsSetDeck(null);
        roofs.forEach(r => { r.material.opacity = state.roofCutaway ? 0.18 : 0.95; });
        if (veh && typeof renderVehicles3D === 'function') renderVehicles3D();
      }
    }

function wsSetFrontFade(opacity) {
      wsFrontFade.forEach(m => {
        const mat = m.material;
        if (!mat) return;
        if (!mat.userData.wsBase) mat.userData.wsBase = { transparent: mat.transparent, opacity: mat.opacity, depthWrite: mat.depthWrite };
        if (opacity >= 1) Object.assign(mat, mat.userData.wsBase);
        else { mat.transparent = true; mat.opacity = opacity; mat.depthWrite = false; }
        mat.needsUpdate = true;
      });
    }

// The deck: see-through while he works downstairs (so you can watch), solid while he is up there
function wsSetDeck(opacity) {
      wsDeckMeshes.forEach(m => {
        m.material.opacity = opacity === null ? (state.roofCutaway ? 0.18 : 0.95) : opacity;
        m.visible = opacity === null || opacity > 0.12; // (hidden outright while he works downstairs)
      });
      if (opacity === null) {
        wsDeck3Meshes.forEach(m => { m.material.opacity = state.roofCutaway ? 0.18 : 0.95; m.visible = true; });
        wsViewFloor = null;
        if (wsFloor2) wsFloor2.visible = true;
        if (wsFloor3) wsFloor3.visible = true;
        wsViewCullAt = 0;
      }
    }

// Walk onto the platform, ride it, walk off onto the other floor
async function wsChangeFloor(site, cur, floor) {
      const from = workshopTrip.floor;
      const onLift = { x: WS_LIFT.x, z: WS_LIFT_GATE };
      await wsWalkTo(site, cur, { x: WS_LIFT.x - WS_LIFT.w / 2 - 0.5, z: WS_LIFT_GATE });
      await tripWalk([siteToWorld(site, onLift.x, onLift.z, wsFloorY(from))]);
      tripFace(siteToWorld(site, onLift.x, onLift.z + 2, 0));
      if (floor > 1) workshopShowFloor(floor, true);
      tripMood(`Taking the car elevator to floor ${floor}`, floor > from ? `Up to floor ${floor}!` : null);
      await tripPause(400);
      // (the engine hoist parks over the shaft on floor 2: it's only there while the platform is up there)
      if (wsModels.hoist) wsModels.hoist.visible = false;
      await wsRideLift(floor, [y => { if (indoorTrip.pos) indoorTrip.pos.y = y; }]);
      workshopTrip.floor = floor;
      if (floor === 2 && wsModels.hoist) wsModels.hoist.visible = true;
      await tripPause(300);
      const off = { x: WS_LIFT.x - WS_LIFT.w / 2 - 0.6, z: WS_LIFT_GATE };
      await tripWalk([siteToWorld(site, off.x, off.z, wsFloorY(floor))]);
      [2, 3].forEach(f => { if (f !== floor) workshopShowFloor(f, false); });
      return off;
    }

// Which decks show: the floor he is on and those below; the ones above him are hidden so you can see in
function wsSetDecksFor(floor) {
      wsSetDeck(floor >= 2 ? 0.98 : 0.1);
      wsDeck3Meshes.forEach(m => { m.material.opacity = 0.98; m.visible = floor >= 3; });
      // The machines on the floors above have no deck under them now: they aren't shown either
      wsViewFloor = floor;
      if (wsFloor2) wsFloor2.visible = floor >= 2;
      if (wsFloor3) wsFloor3.visible = floor >= 3;
      wsViewCullAt = 0;
    }

// Him in the driver's seat of a vehicle he is moving inside (not the outdoor riding code)
function wsSeatKelo(mesh) {
      const seat = mesh.userData.seat || { x: 0, y: 1, z: 0 };
      const a = mesh.rotation.y;
      const drop = keloSitPose(typeof KELO_SIT_OFFSET === 'number' ? KELO_SIT_OFFSET : 0.3, 1.3);
      indoorTrip.pos.x = mesh.position.x + Math.cos(a) * seat.x + Math.sin(a) * seat.z;
      indoorTrip.pos.z = mesh.position.z - Math.sin(a) * seat.x + Math.cos(a) * seat.z;
      indoorTrip.pos.y = mesh.position.y + seat.y - drop;
      indoorTrip.rotY = a + Math.PI / 2;
    }

function wsDrivePose() {
      keloSitPose(typeof KELO_SIT_OFFSET === 'number' ? KELO_SIT_OFFSET : 0.3, 1.3);
      keloLeftArm.rotation.set(-0.6, 0, 0.05);
      keloRightArm.rotation.set(-0.6, 0, -0.05);
      keloLeftElbow.rotation.x = keloRightElbow.rotation.x = -0.7;
    }

// Move the vehicle along local points [{x, z, ry}] (on the floor he's on), with him driving
async function wsDriveAlong(site, v, pts, ms) {
      const mesh = vehicleMeshes[v.id];
      if (!mesh) return;
      const p0 = { x: mesh.position.x - wsGroup.position.x, z: mesh.position.z - wsGroup.position.z, ry: mesh.rotation.y };
      const all = [p0, ...pts.map(p => ({ ...p }))];
      // each heading the short way round from the one before
      for (let i = 1; i < all.length; i++) {
        let d = all[i].ry - all[i - 1].ry;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        all[i].ry = all[i - 1].ry + d;
      }
      indoorTrip.pose = () => wsDrivePose();
      await wsAnimate(ms, k => {
        const f = k * (all.length - 1), i = Math.min(all.length - 2, Math.floor(f)), u = f - i;
        const e = all.length === 2 ? u * u * (3 - 2 * u) : u;
        const a = all[i], b = all[i + 1];
        mesh.position.x = wsGroup.position.x + a.x + (b.x - a.x) * e;
        mesh.position.z = wsGroup.position.z + a.z + (b.z - a.z) * e;
        mesh.position.y = wsGroup.position.y + WS_F1 + workshopTrip.liftY;
        mesh.rotation.y = a.ry + (b.ry - a.ry) * e;
        workshopTrip.vehicleAt = { x: mesh.position.x - wsGroup.position.x, z: mesh.position.z - wsGroup.position.z };
        wsHoldVehicle(mesh);
        wsSeatKelo(mesh);
        wsTowTrailer(mesh);
      });
    }

// A trailer on the hitch follows the truck: its axle is dragged towards the ball, so it swings
// wide through the turns the way a real one does
function wsTowTrailer(truck) {
      const tr = workshopTrip.trailer;
      if (!tr || !tr.mesh) return;
      const ry = truck.rotation.y, fx = Math.cos(ry), fz = -Math.sin(ry);
      const hitch = { x: truck.position.x - fx * tr.hitchBack, z: truck.position.z - fz * tr.hitchBack };
      if (!tr.axle) tr.axle = { x: hitch.x - fx * tr.len, z: hitch.z - fz * tr.len };
      const dx = hitch.x - tr.axle.x, dz = hitch.z - tr.axle.z, d = Math.hypot(dx, dz) || 1;
      tr.axle = { x: hitch.x - dx / d * tr.len, z: hitch.z - dz / d * tr.len };
      const heading = Math.atan2(-(hitch.z - tr.axle.z), hitch.x - tr.axle.x);
      tr.mesh.rotation.y = heading + (tr.flip ? Math.PI : 0);
      tr.mesh.position.set((hitch.x + tr.axle.x) / 2 - Math.cos(heading) * tr.centreBack, truck.position.y, (hitch.z + tr.axle.z) / 2 + Math.sin(heading) * tr.centreBack);
    }

// Hitch a trailer model on behind the vehicle for a drive (the game has no hitched trailers of its own)
function wsHitchTrailer(v, name = 'A utility trailer') {
      const truck = vehicleMeshes[v.id];
      if (!truck || typeof buildItemModel3D !== 'function') return null;
      const m = buildItemModel3D(name, { label: false });
      if (m.userData.mini) m.userData.mini.scale.setScalar(1);
      m.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(m), size = new THREE.Vector3();
      box.getSize(size);
      const tb = new THREE.Box3().setFromObject(truck), ts = new THREE.Vector3();
      tb.getSize(ts);
      const truckLen = Math.max(ts.x, ts.z);
      m.userData.isWorkshop = true;
      scene.add(m);
      workshopTrip.trailer = { mesh: m, hitchBack: truckLen / 2 + 0.2, len: size.x, centreBack: 0, axle: null, flip: false, size: { x: size.x, y: size.y, z: size.z } };
      wsTowTrailer(truck);
      return workshopTrip.trailer;
    }

function wsUnhitchTrailer() {
      const tr = workshopTrip.trailer;
      if (tr && tr.mesh && tr.mesh.parent) tr.mesh.parent.remove(tr.mesh);
      workshopTrip.trailer = null;
    }

// The drive-through: in at the hangar door, up the hangar's lane, through door 5 into the north
// wing, along the forklift aisle, through door 4 into the shop, down the east aisle over the car
// elevator and out of door 1 onto the lane. (With { trailer: true } the pickup tows its trailer.)
// window.__wsHold = 'drive' holds at each named point for a picture.
async function wsDriveThrough(site, v, opts = {}) {
      const mesh = vehicleMeshes[v.id];
      if (!mesh) return;
      const S = WORKSHOP_SITE, H = WORKSHOP_HANGAR;
      const lane = WORKSHOP_HANGAR_BAYS.find(b => b.key === 'lane');
      const lx = H.x + lane.x - S.x, doorZ = H.z + H.d / 2 - S.z;
      const az = WS_WING.aisleZ, wx0 = WS_WING.x - WS_WING.w / 2, sd = WS_WING.doors.shop;
      const N = Math.PI / 2, E = 0, Sth = -Math.PI / 2;
      const nm = String(v.name).replace(/^(an?|the)\s+/i, '');
      if (opts.trailer) wsHitchTrailer(v);
      const hold = async name => {
        if (window.__wsHold && /drive/i.test(window.__wsHold)) {
          window.__wsHeld = `drive ${name}`;
          const t0 = Date.now();
          while (window.__wsHold && /drive/i.test(window.__wsHold) && window.__wsHeld === `drive ${name}` && Date.now() - t0 < 600000) await tripPause(50);
          window.__wsHeld = null;
        }
      };
      const legs = [
        { mood: `Drive-through: the ${nm} in at the hangar door`, say: 'Big door up. Nice and slow past the build bays.', ms: 5000, name: 'hangar',
          pts: [{ x: lx, z: doorZ + 1.0, ry: N }, { x: lx, z: az + 2.6, ry: N }] },
        { mood: `Drive-through: turning the ${nm} into the north wing`, say: 'Door 5. Swing wide so the trailer clears.', ms: 3500, name: 'wing',
          pts: [{ x: lx + 0.5, z: az + 0.6, ry: N * 0.5 }, { x: wx0 + 1.5, z: az, ry: E }] },
        { mood: `Drive-through: the ${nm} along the CNC hall aisle`, say: 'Forklift aisle. Haas mills on the left.', ms: 6000, name: 'aisle',
          pts: [{ x: sd.x - 2.6, z: az, ry: E }] },
        { mood: `Drive-through: the ${nm} through door 4 into the shop`, say: 'Into the shop and over the car elevator.', ms: 6500, name: 'shop',
          pts: [{ x: sd.x - 0.6, z: az + 1.2, ry: -N * 0.5 }, { x: sd.x, z: -S.d / 2 + 1.5, ry: Sth }, { x: sd.x, z: WS_LIFT.z, ry: Sth }] },
        { mood: `Drive-through: the ${nm} out of door 1`, say: 'Out onto the lane. Straight through, no reversing.', ms: 5500, name: 'out',
          pts: [{ x: WS_DOORS.vehicle.x, z: S.d / 2 + 1.5, ry: Sth }, { x: WS_DOORS.vehicle.x, z: S.d / 2 + 4.2, ry: Sth }] }
      ];
      wsUpdateLift(0);
      for (const leg of legs) {
        tripMood(leg.mood, leg.say);
        await wsDriveAlong(site, v, leg.pts, leg.ms);
        await hold(leg.name);
      }
      wsUnhitchTrailer();
      const end = legs[legs.length - 1].pts.slice(-1)[0];
      v.x = S.x + end.x; v.z = S.z + end.z; v.rotY = end.ry;
      workshopTrip.vehicleHome = { x: v.x, z: v.z, rotY: v.rotY };
      const out = typeof boardingSpot === 'function' ? boardingSpot(v) : { x: v.x - 2, z: v.z };
      workshopTrip.vehicleOut = out;
      indoorTrip.pose = null;
      indoorTrip.pos = { x: out.x, y: getIslandGroundHeight(out.x, out.z), z: out.z };
      if (typeof gainSkill === 'function') gainSkill('ws-drivethrough', 'Driving through the Workshop', 1);
    }

// While a vehicle is inside, its pose is kept here: if anything re-places the parked vehicles
// (renderVehicles3D), it is put straight back where it is in the Workshop
function wsHoldVehicle(mesh) {
      workshopTrip.vehPose = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z, ry: mesh.rotation.y };
    }

if (typeof renderVehicles3D === 'function') {
  const baseRenderVehicles3D = renderVehicles3D;
  renderVehicles3D = function () {
    baseRenderVehicles3D();
    const v = workshopTrip.active && workshopTrip.vehicle, p = workshopTrip.vehPose;
    const mesh = v && typeof vehicleMeshes !== 'undefined' && vehicleMeshes[v.id];
    if (mesh && p) { mesh.position.set(p.x, p.y, p.z); mesh.rotation.y = p.ry; }
  };
}

// Drive in through door 1 off the east lane, onto the car elevator, ride up and on forwards onto the
// two-post lift behind the shaft
async function wsDriveIn(site, v) {
      const mesh = vehicleMeshes[v.id];
      if (!mesh) return;
      if (!workshopTrip.vehicleHome) workshopTrip.vehicleHome = { x: v.x, z: v.z, rotY: v.rotY || 0 };
      const nm = String(v.name).replace(/^(an?|the)\s+/i, '');
      const ry = Math.PI / 2; // nose north, into the building
      tripMood(`Driving the ${nm} onto the car elevator`, 'In through door 1, nice and slow.');
      const ax = WS_DOORS.vehicle.x, az = WORKSHOP_SITE.d / 2 + 4.2;
      await wsDriveAlong(site, v, [{ x: ax, z: az, ry }], 2500);
      await wsDriveAlong(site, v, [{ x: WS_DOORS.vehicle.x, z: WORKSHOP_SITE.d / 2 + 1.5, ry }, { x: WS_LIFT.x, z: WS_LIFT.z, ry }], 4200);
      workshopShowUpstairs(true);
      if (wsModels.hoist) wsModels.hoist.visible = false;
      tripMood('Taking the car elevator up', `Going up with the ${nm}. This is the best part.`);
      await wsRideLift(2, [y => { mesh.position.y = y; wsHoldVehicle(mesh); wsSeatKelo(mesh); }]);
      workshopTrip.floor = 2;
      if (wsModels.hoist) wsModels.hoist.visible = true;
      const car = WORKSHOP_STATIONS.garage.local;
      tripMood(`Driving the ${nm} onto the lift`);
      await wsDriveAlong(site, v, [{ x: car.x, z: car.z, ry }], 3500);
      workshopTrip.vehicleAt = { x: car.x, z: car.z };
      // He climbs out on the driver's side
      indoorTrip.pose = null;
      const side = siteToWorld(site, car.x - 2.05, car.z - 0.8, WS_F2);
      indoorTrip.pos = { x: side.x, y: side.y, z: side.z };
      await tripPause(400);
    }

async function wsDriveOut(site, v) {
      const mesh = vehicleMeshes[v.id];
      const car = WORKSHOP_STATIONS.garage.local;
      const ry = Math.PI / 2;
      if (!mesh) return;
      // Back in the driver's seat, reversing onto the platform
      await wsWalkTo(site, { x: indoorTrip.pos.x - wsGroup.position.x, z: indoorTrip.pos.z - wsGroup.position.z }, { x: car.x - 2.05, z: car.z - 0.8 });
      await wsDriveAlong(site, v, [{ x: WS_LIFT.x, z: WS_LIFT.z, ry }], 3500);
      if (wsModels.hoist) wsModels.hoist.visible = false;
      tripMood('Riding the car elevator down');
      await wsRideLift(1, [y => { mesh.position.y = y; wsHoldVehicle(mesh); wsSeatKelo(mesh); }]);
      workshopTrip.floor = 1;
      wsSetDecksFor(1);
      workshopShowUpstairs(false);
      // Reverse out of door 1 into the lane, then home to where it was parked
      const lane = { x: WS_DOORS.vehicle.x, z: WORKSHOP_SITE.d / 2 + 4.2 };
      await wsDriveAlong(site, v, [{ x: WS_DOORS.vehicle.x, z: WORKSHOP_SITE.d / 2 + 1.0, ry }, { x: lane.x, z: lane.z, ry }], 4200);
      const home = workshopTrip.vehicleHome || { x: wsGroup.position.x + lane.x, z: wsGroup.position.z + lane.z, rotY: ry };
      v.x = home.x;
      v.z = home.z;
      v.rotY = home.rotY;
      const out = typeof boardingSpot === 'function' ? boardingSpot(v) : { x: v.x - 2, z: v.z };
      workshopTrip.vehicleOut = out;
      indoorTrip.pose = null;
      indoorTrip.pos = { x: out.x, y: getIslandGroundHeight(out.x, out.z), z: out.z };
    }

// A ride with a vehicle aboard between any floors (e.g. [3, 2, 1]): on at floor 1, stop at each
// landing, and off again at floor 1. (window.__wsHold = 'landing' holds each stop for a picture.)
async function wsVehicleTour(site, v, floors) {
      const mesh = vehicleMeshes[v.id];
      if (!mesh) return;
      const nm = String(v.name).replace(/^(an?|the)\s+/i, '');
      const ry = Math.PI / 2;
      tripMood(`Driving the ${nm} onto the car elevator`);
      await wsDriveAlong(site, v, [{ x: WS_DOORS.vehicle.x, z: WORKSHOP_SITE.d / 2 + 4.2, ry }], 2000);
      await wsDriveAlong(site, v, [{ x: WS_DOORS.vehicle.x, z: WORKSHOP_SITE.d / 2 + 1.5, ry }, { x: WS_LIFT.x, z: WS_LIFT.z, ry }], 3800);
      for (const f of floors) {
        if (f > 1) workshopShowFloor(f, true);
        tripMood(`Car elevator: riding to floor ${f} with the ${nm}`);
        await wsRideLift(f, [y => { mesh.position.y = y; wsHoldVehicle(mesh); wsSeatKelo(mesh); }]);
        workshopTrip.floor = f;
        tripMood(`Car elevator: at the floor ${f} landing`, `Floor ${f}. Doors open.`);
        if (window.__wsHold && /landing/i.test(window.__wsHold)) {
          window.__wsHeld = `landing ${f}`;
          const t0 = Date.now();
          while (window.__wsHold && /landing/i.test(window.__wsHold) && window.__wsHeld === `landing ${f}` && Date.now() - t0 < 600000) await tripPause(50);
          window.__wsHeld = null;
        } else await tripPause(2500);
        [2, 3].forEach(k => { if (k !== f) workshopShowFloor(k, false); });
      }
      if (workshopTrip.floor !== 1) await wsRideLift(1, [y => { mesh.position.y = y; wsHoldVehicle(mesh); wsSeatKelo(mesh); }]);
      workshopTrip.floor = 1;
      wsSetDecksFor(1);
      const lane = { x: WS_DOORS.vehicle.x, z: WORKSHOP_SITE.d / 2 + 4.2 };
      await wsDriveAlong(site, v, [{ x: lane.x, z: WORKSHOP_SITE.d / 2 + 1.0, ry }, { x: lane.x, z: lane.z, ry }], 3800);
      const home = workshopTrip.vehicleHome || { x: wsGroup.position.x + lane.x, z: wsGroup.position.z + lane.z, rotY: ry };
      v.x = home.x; v.z = home.z; v.rotY = home.rotY;
      const out = typeof boardingSpot === 'function' ? boardingSpot(v) : { x: v.x - 2, z: v.z };
      workshopTrip.vehicleOut = out;
      indoorTrip.pose = null;
      indoorTrip.pos = { x: out.x, y: getIslandGroundHeight(out.x, out.z), z: out.z };
    }

// What a machine's act(ctx) gets: its model, the world point of the machine, ways to pose and wait
function wsContext(site, def, model, stop) {
      const floorY = wsFloorY(workshopTrip.floor);
      return {
        site, def, model, stop,
        world: (lx, lz, ly = 0) => siteToWorld(site, lx, lz, floorY + ly),
        say: (title, speech) => tripMood(title, speech),
        wait: ms => tripPause(ms),
        animate: (ms, fn) => wsAnimate(ms, fn),
        face: (lx, lz) => tripFace(siteToWorld(site, lx, lz, 0)),
        // Hands on the controls (or reaching to a height above the floor)
        reach: h => { indoorTrip.pose = () => reachPose(h); },
        work: () => { indoorTrip.pose = wsWorkPose; },
        idle: () => { indoorTrip.pose = null; indoorTrip.crouchTarget = 0; },
        walk: async (lx, lz) => {
          const cur = { x: indoorTrip.pos.x - wsGroup.position.x, z: indoorTrip.pos.z - wsGroup.position.z };
          await wsWalkTo(site, cur, { x: lx, z: lz });
        },
        floor: workshopTrip.floor
      };
    }

// Where his hands go on a machine while he works it (wsWorkPose): the face of its box nearest his
// chest, at working height, the two hands side by side and pressing in turn. Only while the work pose
// is on (not while he reaches up, walks round it or waits).
function wsControlReach(model) {
      if (!model) return null;
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      if (box.isEmpty()) return null;
      const l = new THREE.Vector3(), r = new THREE.Vector3();
      return () => {
        if (!indoorTrip.active || !indoorTrip.pos || indoorTrip.pose !== wsWorkPose) return null;
        const p = indoorTrip.pos, f = indoorTrip.rotY, fx = Math.sin(f), fz = Math.cos(f);
        const y = Math.max(box.min.y + 0.15, Math.min(box.max.y - 0.05, p.y + 1.15));
        if (y < p.y + 0.6 || y > p.y + 1.75) return null;
        const cx = Math.max(box.min.x, Math.min(box.max.x, p.x + fx * 0.3)), cz = Math.max(box.min.z, Math.min(box.max.z, p.z + fz * 0.3));
        if (Math.hypot(cx - p.x, cz - p.z) > 1.1) return null;   // out of reach from where he stands
        const t = keloAnim.lastT || 0, side = 0.13;
        const tapL = 0.03 * Math.max(0, Math.sin(t * 6)), tapR = 0.03 * Math.max(0, -Math.sin(t * 6));
        l.set(cx - fz * side + fx * tapL, y, cz + fx * side + fz * tapL);
        r.set(cx + fz * side + fx * tapR, y, cz - fx * side + fz * tapR);
        return { l, r };
      };
    }

// Busy hands at a control panel or bench
function wsWorkPose(t) {
      const s = Math.sin(t * 6) * 0.12;
      keloLeftArm.rotation.set(-1.05 + s, 0, 0.12);
      keloRightArm.rotation.set(-1.0 - s, 0, -0.12);
      keloLeftElbow.rotation.x = keloRightElbow.rotation.x = -0.5;
      keloLeftHand.userData.grip = keloRightHand.userData.grip = 0.4;
      keloBody.rotation.x = 0.12;
      keloHead.rotation.x = 0.25;
    }

function workshopSummaryForAI() {
      const lift = (state.vehicles || []).find(v => /forklift/i.test(v.name || v.type || ''));
      const liftNote = lift ? `; your electric forklift is at ${Math.round(typeof forkliftCharge === 'function' ? forkliftCharge(lift) : 80)}% charge` : '; no forklift yet';
      return 'a big Workshop east of your helipad. '
        + 'Floor 1: 3D printers of every type, CNC routers and mills, welding and a work bench. '
        + 'North wing: the CNC hall with the Haas mills and pallet racking. '
        + 'Hangar & Assembly: two build bays and vehicle parking with a bridge crane. '
        + 'Floor 2 (car elevator or stairs): the electronics line and the garage. '
        + 'Floor 3: a glass blowing studio and a woodshop'
        + liftNote;
    }

window.addEventListener('DOMContentLoaded', () => {
  // After the scene, the scenery and the vehicles are built
  setTimeout(() => { try { buildWorkshop3D(); } catch (e) { console.warn('workshop build', e); } }, 0);
});
