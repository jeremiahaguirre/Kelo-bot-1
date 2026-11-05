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
// The land the Workshop adds and levels: its pad (cut into the cliff behind) and the vehicle lane
// along the east edge down to a gravel beach. Other land (the plant's pad) joins it along z 0.6.
const WORKSHOP_LAND = {
  pad: { minX: WORKSHOP_SITE.x - WORKSHOP_SITE.w / 2 - 1.2, maxX: WORKSHOP_SITE.x + WORKSHOP_SITE.w / 2 + 1.2, minZ: WORKSHOP_SITE.z - WORKSHOP_SITE.d / 2 - 0.8, maxZ: WORKSHOP_SITE.z + WORKSHOP_SITE.d / 2 + 0.3 },
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
const WS_F1 = 0.12;                      // floor 1 top, above the pad
const WS_F2 = 5.4;                       // floor 2 deck top
const WS_EAVE = 12.6;
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
  assembly: { local: { x: -5.9, z: 4.6 }, floor: 1, rotY: 0, size: { w: 17, d: 10.5 }, label: 'Hangar / assembly bay', world: { x: 34.6, z: -15.6 } },
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
      return { x: s.x + lx, z: s.z + lz, y: WORKSHOP_PAD_Y + (floor === 2 ? WS_F2 : WS_F1) };
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
      const n = Math.max(1, Math.round(long / Math.max(0.8, short)));
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

      // Walls: a concrete plinth course, then steel cladding up to the eaves, with a dark band
      // and the clerestory glazing high up on the long walls
      const wallT = 0.16;
      const doorOpen = Object.values(WS_DOORS).map(d => ({ c: d.x, w: d.w, h: d.h }));
      // Front (south): doors, windows on floor 2
      const frontWin = [{ c: -1.9, w: 3.2, h: 1.4, y0: 7.2 }, { c: 1.9, w: 2.6, h: 1.4, y0: 7.2 }];
      wsWallWithOpenings(wsGroup, 'x', hz, -hx, hx, 0.9, wallT + 0.04, plinth, doorOpen.map(o => ({ ...o, h: 0.9 })), 2.4, wsFrontFade);
      const frontGroup = mmGroup(wsGroup, 0, 0.9, 0);
      wsWallWithOpenings(frontGroup, 'x', hz, -hx, hx, WS_EAVE - 0.9 - 2.0, wallT, cladFront,
        [...doorOpen.map(o => ({ ...o, h: o.h - 0.9 })), ...frontWin.map(o => ({ ...o, y0: o.y0 - 0.9 }))], 0.32 * 4, wsFrontFade);
      const frontBand = mmGroup(wsGroup, 0, WS_EAVE - 2.0, 0);
      wsWallWithOpenings(frontBand, 'x', hz, -hx, hx, 2.0, wallT, cladFrontDark, [{ c: 0, w: W - 1.2, h: 1.1, y0: 0.45 }], 1.28, wsFrontFade);
      // Back (north)
      wsWallWithOpenings(wsGroup, 'x', -hz, -hx, hx, 0.9, wallT + 0.04, plinth, [], 2.4);
      const backGroup = mmGroup(wsGroup, 0, 0.9, 0);
      wsWallWithOpenings(backGroup, 'x', -hz, -hx, hx, WS_EAVE - 2.9, wallT, cladding, [{ c: -1.5, w: 9, h: 1.3, y0: 2.2 }, { c: 0, w: W - 1.4, h: 1.3, y0: 7.0 }], 1.28);
      const backBand = mmGroup(wsGroup, 0, WS_EAVE - 2.0, 0);
      wsWallWithOpenings(backBand, 'x', -hz, -hx, hx, 2.0, wallT, cladDark, [{ c: 0, w: W - 1.2, h: 1.1, y0: 0.45 }], 1.28);
      // Sides: the west wall has a loading door facing the helipad, both have strip windows
      wsWallWithOpenings(wsGroup, 'z', -hx, -hz, hz, 0.9, wallT + 0.04, plinth, [{ c: 0.5, w: 3.0, h: 0.9 }], 2.4);
      const westGroup = mmGroup(wsGroup, 0, 0.9, 0);
      wsWallWithOpenings(westGroup, 'z', -hx, -hz, hz, WS_EAVE - 2.9, wallT, cladding, [{ c: 0.5, w: 3.0, h: 2.8 }, { c: -4.5, w: 4.0, h: 1.2, y0: 1.4 }, { c: 0, w: D - 2, h: 1.3, y0: 7.0 }], 1.28);
      wsWallWithOpenings(mmGroup(wsGroup, 0, WS_EAVE - 2.0, 0), 'z', -hx, -hz, hz, 2.0, wallT, cladDark, [], 1.28);
      wsWallWithOpenings(wsGroup, 'z', hx, -hz, hz, 0.9, wallT + 0.04, plinth, [], 2.4);
      wsWallWithOpenings(mmGroup(wsGroup, 0, 0.9, 0), 'z', hx, -hz, hz, WS_EAVE - 2.9, wallT, cladding, [{ c: -4.6, w: 4.4, h: 1.2, y0: 1.4 }, { c: 0, w: D - 2, h: 1.3, y0: 7.0 }], 1.28);
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
      [-hz + 0.45, hz - 0.45].forEach(z => mmBox(wsGroup, 3.8, 0.25, 0.25, yellow, -5.9, WS_EAVE - 1.6, z));
      const crane = mmGroup(wsGroup, -5.9, WS_EAVE - 1.4, 0.4);
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

      // The car elevator: four tall yellow masts, a diamond-plate platform with hazard edges,
      // a hydraulic ram under it, gates and the call box
      const L = WS_LIFT;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
        mmBox(wsGroup, 0.32, WS_F2 + 2.6, 0.32, yellow, L.x + sx * (L.w / 2 + 0.16), WS_F1, L.z + sz * (L.d / 2 - 0.2));
        mmBox(wsGroup, 0.08, WS_F2 + 2.5, 0.1, steel, L.x + sx * (L.w / 2 - 0.02), WS_F1, L.z + sz * (L.d / 2 - 0.2));
      });
      [-1, 1].forEach(sz => mmBox(wsGroup, L.w + 0.64, 0.4, 0.4, yellow, L.x, WS_F2 + 2.6, L.z + sz * (L.d / 2 - 0.2)));
      mmLabel(wsGroup, 'CAR ELEVATOR  4,500 KG', 2.6, 0.3, L.x, WS_F2 + 2.8, L.z + L.d / 2, { bg: '#facc15', fg: '#111827' });
      wsLift = mmGroup(wsGroup, L.x, WS_F1, L.z);
      const plate = new THREE.Mesh(wsUV(new THREE.BoxGeometry(L.w, 0.14, L.d), 0.8), new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.35, metalness: 0.85, map: wsConcreteTexture() }));
      plate.position.y = -0.07;
      wsLift.add(plate);
      [-1, 1].forEach(s => {
        for (let i = 0; i < 12; i++) mmBox(wsLift, 0.12, 0.02, L.d / 12 * 0.5, i % 2 ? 'stripe' : 'hazard', s * (L.w / 2 - 0.07), 0, -L.d / 2 + (i + 0.5) * L.d / 12);
        mmBox(wsLift, 0.05, 1.0, L.d, 'fence', s * (L.w / 2 - 0.03), 0.02, 0);
        mmBox(wsLift, 0.06, 0.06, L.d, yellow, s * (L.w / 2 - 0.03), 1.0, 0);
      });
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
      const hb = WORKSHOP_STATIONS.assembly;
      [[0, -hb.size.d / 2], [0, hb.size.d / 2]].forEach(([dx, dz]) => line(hb.local.x + dx, hb.local.z + dz, hb.size.w, 0.08));
      [[-hb.size.w / 2, 0], [hb.size.w / 2, 0]].forEach(([dx]) => line(hb.local.x + dx, hb.local.z, 0.08, hb.size.d));
      for (let i = 0; i < 7; i++) line(L.x, L.z + L.d / 2 + 0.25, L.w, 0.08, i % 2 ? mmMat('hazard') : yellow).position.z = L.z + L.d / 2 + 0.06 + i * 0.03;
      mmLabel(wsGroup, 'ASSEMBLY BAY', 2.0, 0.4, hb.local.x, WS_F1 + 0.01, hb.local.z + 1.6, { bg: '#b9bab5', fg: '#a16207' }).rotation.x = -Math.PI / 2;
      mmLabel(wsGroup, 'KEEP CLEAR', 1.6, 0.35, L.x, WS_F1 + 0.01, L.z + L.d / 2 + 0.55, { bg: '#b9bab5', fg: '#b91c1c' }).rotation.x = -Math.PI / 2;
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

      wsMergeStatic(wsGroup, new Set([...wsFrontFade, ...wsDeckMeshes, ...(typeof cutawayRoofMeshes !== 'undefined' ? cutawayRoofMeshes : [])]),
        [wsLift, crane, ...Object.values(doors), ...Object.values(WORKSHOP_STATIONS).map(st => st.group).filter(Boolean), wsGroup.userData.ram]);
      wsFloor1 = mmGroup(wsGroup, 0, WS_F1, 0);
      wsFloor2 = mmGroup(wsGroup, 0, WS_F2, 0);
      scene.add(wsGroup);
      wsUpdateLift(0);
      wsClearSceneryInside();
      // Paths go round it (a row of circles over the footprint, clear of the doors outside)
      for (let x = -hx + 1.8; x <= hx - 1.6; x += 2.6) {
        for (let z = -hz + 1.8; z <= hz - 1.6; z += 2.6) worldObstacles.push({ x: S.x + x, z: S.z + z, r: 2.0, workshop: true });
      }
      wsBuildStandIns();
      if (typeof perfWatchBuilding === 'function') {
        perfWatchBuilding({
          key: 'workshop', radius: 11,
          center: () => wsGroup.position.clone().setY(WORKSHOP_PAD_Y + 3),
          forced: () => Boolean(workshopTrip.active),
          show: near => wsShowFloor1(near),
          tick: near => { if (near) wsBuildQueued(2); }
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
      [-hx, hx].forEach(x => wsWallWithOpenings(g, 'z', x, -hz, hz, H.h - 1.5, t, clad, [{ c: 0, w: H.d - 3, h: 1.4, y0: 6.6 }], 1.28));
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
      // Floor markings: the aircraft bay (sized for a 10 m span) and two vehicle bays
      const line = (x, z, w, d, mat = yellow) => mmBox(g, w, 0.008, d, mat, x, 0.125, z);
      const bay = WORKSHOP_STATIONS.assembly.size, bz = WORKSHOP_STATIONS.assembly.world.z - H.z;
      line(0, bz - bay.d / 2, bay.w, 0.1); line(0, bz + bay.d / 2, bay.w, 0.1);
      line(-bay.w / 2, bz, 0.1, bay.d); line(bay.w / 2, bz, 0.1, bay.d);
      const label = mmLabel(g, 'AIRCRAFT ASSEMBLY  •  10 M SPAN', 5.0, 0.6, 0, 0.13, bz - bay.d / 2 + 0.9, { bg: '#b9bab5', fg: '#a16207' });
      label.rotation.x = -Math.PI / 2;
      // A painted footprint of a high-wing ultralight (9.5 m span, 5.6 m long) to build it on
      const span = 15.2, chord = 2.3, fus = 9.0, wingZ = bz - 1.2;
      [[0, wingZ - chord / 2, span, 0.08], [0, wingZ + chord / 2, span, 0.08]].forEach(([x, z, w, d]) => line(x, z, w, d, mmMat('white')));
      [-span / 2, span / 2].forEach(x => line(x, wingZ, 0.08, chord, mmMat('white')));
      [-0.5, 0.5].forEach(x => line(x, wingZ - 1.4 + fus / 2, 0.08, fus, mmMat('white')));
      line(0, wingZ - 1.4 + fus, 4.2, 0.08, mmMat('white'));
      line(0, wingZ - 1.4 + fus - 1.1, 4.2, 0.08, mmMat('white'));
      [-2.1, 2.1].forEach(x => line(x, wingZ - 1.4 + fus - 0.55, 0.08, 1.1, mmMat('white')));
      // Wing span gauge marks (every metre, 1.6 units) along the front of the bay
      for (let i = -5; i <= 5; i++) line(i * 1.6, bz + bay.d / 2 - 0.35, 0.05, i % 5 ? 0.4 : 0.7);
      mmLabel(g, 'KEEP CLEAR  •  CRANE OVERHEAD', 3.4, 0.4, 0, 0.13, hz - 0.9, { bg: '#b9bab5', fg: '#b91c1c' }).rotation.x = -Math.PI / 2;
      // A parts cart and two trestles in the bay
      const cart = mmGroup(g, hx - 1.6, 0.1, -hz + 1.6);
      mmBox(cart, 0.9, 0.05, 0.6, 'red', 0, 0.35, 0);
      mmBox(cart, 0.9, 0.05, 0.6, 'red', 0, 0.9, 0);
      [-0.42, 0.42].forEach(x => mmBox(cart, 0.04, 0.95, 0.04, 'red', x, 0, 0.27));
      [-3, 3].forEach(x => { mmBox(g, 1.2, 0.08, 0.3, 'wood', x, 0.95, bz); [-0.5, 0.5].forEach(dx => mmBox(g, 0.06, 0.95, 0.4, 'wood', x + dx, 0.1, bz)); });
      if (typeof dressBuilding === 'function') dressBuilding(g, [[roofMat, 'metalroof', 1.2], [plinth, 'stone', 2]]);
      scene.add(g);
      // Walls are solid; the inside and the door are open to walk and drive through
      for (let x = -hx; x <= hx; x += 1.2) worldObstacles.push({ x: H.x + x, z: H.z - hz, r: 0.5, workshop: true });
      [-hx, hx].forEach(x => { for (let z = -hz; z <= hz; z += 1.2) worldObstacles.push({ x: H.x + x, z: H.z + z, r: 0.5, workshop: true }); });
      for (let x = -hx; x <= hx; x += 1.2) if (Math.abs(x) > H.door.w / 2 + 0.3) worldObstacles.push({ x: H.x + x, z: H.z + hz, r: 0.5, workshop: true });
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

// The hangar's assembly bay, for the assembly builds (the ultralight and other big projects):
// { x, y, z } its centre on the floor, { w, d } the marked bay (w across x), the crane's hook height,
// and the door it rolls out through (centre, width, height, facing +z onto the helipad).
function workshopAssemblyBay() {
      const H = WORKSHOP_HANGAR, st = WORKSHOP_STATIONS.assembly;
      return {
        x: st.world.x, y: WORKSHOP_PAD_Y + 0.12, z: st.world.z, w: st.size.w, d: st.size.d, rotY: 0,
        craneHookY: WORKSHOP_PAD_Y + H.craneY - 3.0,
        door: { x: H.x, z: H.z + H.d / 2, w: H.door.w, h: H.door.h, facing: 'south' },
        outside: { x: H.x, z: H.z + H.d / 2 + 2.5 }
      };
    }

// Does something of this size (units) fit: through which doors, on the car elevator, in which bays
function workshopFits(size) {
      const L = Math.max(size.x, size.z), W = Math.min(size.x, size.z), Hh = size.y;
      const bay = WORKSHOP_STATIONS.assembly.size;
      return {
        hangarDoor: W < WORKSHOP_HANGAR.door.w - 0.6 && Hh < WORKSHOP_HANGAR.door.h - 0.3,
        hangarBay: L < bay.w + 0.01 && W < bay.d + 0.01 && Hh < WORKSHOP_HANGAR.craneY - 0.5,
        door1: W < WS_DOORS.vehicle.w - 0.3 && Hh < WS_DOORS.vehicle.h - 0.2,
        carElevator: L < WS_LIFT.d - 0.2 && W < WS_LIFT.w - 0.1 && Hh < WS_F2 - 0.3 - WS_F1,
        garageLift: W < 3.6 && Hh + 1.9 < WS_EAVE - WS_F2
      };
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
      m.position.set(def.at.x, 0, def.at.z);
      m.rotation.y = def.at.ry || 0;
      m.userData.machineKey = def.key;
      (def.floor === 2 ? wsFloor2 : wsFloor1).add(m);
      wsModels[def.key] = m;
      if (typeof def.onBuilt === 'function') def.onBuilt(m);
      return m;
    }

function wsDropModel(key) {
      const m = wsModels[key];
      if (!m) return;
      if (m.parent) m.parent.remove(m);
      if (typeof disposeTree === 'function') disposeTree(m);
      delete wsModels[key];
    }

// The model of a machine, built now if it isn't (during a trip, or a visitor's request)
function workshopModel(key) {
      const def = WORKSHOP_MACHINES[key];
      if (!def || !wsGroup) return null;
      return wsModels[key] || wsBuildModel(def);
    }

// Floor 2: built when he goes up, taken down when he comes back
let wsUpstairsBuilt = false;
function workshopShowUpstairs(on) {
      if (!wsGroup) return;
      if (on && !wsUpstairsBuilt) {
        workshopMachinesOn(2).forEach(def => wsBuildModel(def));
        wsUpstairsBuilt = true;
      } else if (!on && wsUpstairsBuilt) {
        workshopMachinesOn(2).forEach(def => wsDropModel(def.key));
        wsUpstairsBuilt = false;
      }
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
      return {
        key: 'workshop', name: 'Workshop', group: wsGroup, w: WORKSHOP_SITE.w, d: WORKSHOP_SITE.d, floorY: WS_F1,
        hatch: { x: WS_LIFT.x, z: WS_LIFT.z }, entryAngle: Math.PI / 2,
        outside: { x: WS_DOORS.person.x, z: WORKSHOP_SITE.d / 2 + 1.2 },
        walkIn: [{ x: WS_DOORS.person.x, z: WORKSHOP_SITE.d / 2 + 0.6, y: 0 }, { x: WS_DOORS.person.x, z: WORKSHOP_SITE.d / 2 - 0.4, y: WS_F1 }, { x: WS_DOORS.person.x, z: WORKSHOP_SITE.d / 2 - 1.2, y: WS_F1 }],
        nodes,
        obstacles: () => wsObstacles(workshopTrip.floor),
        levels: () => 0, camDist: 15, cutFlat: 8
      };
    }

function wsObstacles(floor) {
      const out = [];
      workshopMachinesOn(floor).forEach(def => out.push(...machineCircles(def)));
      if (floor === 1) {
        // The deck columns, the Taurus bay edge, the stations
        for (let z = -WS_IN.z + 1.45; z < WS_IN.z - 0.4; z += 3.5) out.push({ x: -3.8, z, r: 0.35 });
        ['weld'].forEach(k => { const st = WORKSHOP_STATIONS[k]; out.push({ x: st.local.x - 0.6, z: st.local.z, r: 0.55 }, { x: st.local.x + 0.6, z: st.local.z, r: 0.55 }); });
      } else {
        // The open edge over the high bay
        for (let z = -WS_IN.z; z <= WS_IN.z; z += 0.8) out.push({ x: -4.4, z, r: 0.5 });
        if (workshopTrip.vehicle) {
          const v = workshopTrip.vehicleAt;
          if (v) for (let k = -3; k <= 3; k++) out.push({ x: v.x, z: v.z + k * 1.2, r: 1.5 });
        }
      }
      return out;
    }

// Walk inside to a local point on the floor he is on
function wsWalkTo(site, from, to) {
      const y = workshopTrip.floor === 2 ? WS_F2 : WS_F1;
      return tripWalk(routeInside(site, from, to).map(p => siteToWorld(site, p.x, p.z, y + (workshopTrip.liftY && wsOnLift(p) ? 0 : 0))));
    }

function wsOnLift(p) {
      return Math.abs(p.x - WS_LIFT.x) < WS_LIFT.w / 2 && Math.abs(p.z - WS_LIFT.z) < WS_LIFT.d / 2;
    }

// Ride the car elevator between floors. Whatever stands on the platform (him, a vehicle) rides with it.
async function wsRideLift(toFloor, riders = []) {
      const from = workshopTrip.liftY, to = toFloor === 2 ? WS_F2 - WS_F1 : 0;
      const ms = Math.max(800, Math.abs(to - from) / 0.9 * 1000);
      let start = Date.now(), pausedAt = 0, held = false;
      const base = wsGroup.position.y;
      await new Promise(resolve => {
        const tick = () => {
          // (window.__wsHold = 'elevator' stops the ride half way, for a screenshot; see js/machines.js)
          if (pausedAt) {
            if (window.__wsHold && /elevator/i.test(window.__wsHold) && workshopTrip.active) { setTimeout(tick, 50); return; }
            start += Date.now() - pausedAt; pausedAt = 0; window.__wsHeld = null;
          } else if (!held && window.__wsHold && /elevator/i.test(window.__wsHold) && Date.now() - start > ms / 2) {
            held = true; pausedAt = Date.now(); window.__wsHeld = 'car elevator';
            setTimeout(tick, 50);
            return;
          }
          const t = Math.min(1, (Date.now() - start) / ms), e = t * t * (3 - 2 * t);
          const y = from + (to - from) * e;
          workshopTrip.liftY = y;
          wsUpdateLift(y);
          riders.forEach(r => r(base + WS_F1 + y));
          if (t < 1 && workshopTrip.active) setTimeout(tick, 16); else resolve();
        };
        tick();
      });
      workshopTrip.liftY = to;
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
        const door = siteToWorld(site, WS_DOORS.vehicle.x, WORKSHOP_SITE.d / 2 + 4.2, 0);
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
        wsSetDeck(1);
        wsShowFloor1(true);
        wsBuildQueued(Infinity);
        wsUpdateLighting();
        if (veh) {
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
          try { results.push(await stop.act(ctx)); } catch (e) { console.warn('workshop stop', e); results.push(false); }
          indoorTrip.pose = null;
          indoorTrip.crouchTarget = 0;
        }
        if (veh) {
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
        indoorTrip.pose = null;
        indoorTrip.crouch = 0;
        state.basementDepth = 0;
        if (veh && workshopTrip.vehicleOut) state.botPos = { ...workshopTrip.vehicleOut };
        else state.botPos = { x: outside.x, z: outside.z };
        state.targetPos = { ...state.botPos };
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
    }

// Walk onto the platform, ride it, walk off onto the other floor
async function wsChangeFloor(site, cur, floor) {
      const onLift = { x: WS_LIFT.x, z: WS_LIFT_GATE };
      await wsWalkTo(site, cur, { x: WS_LIFT.x - WS_LIFT.w / 2 - 0.5, z: WS_LIFT_GATE });
      await tripWalk([siteToWorld(site, onLift.x, onLift.z, workshopTrip.floor === 2 ? WS_F2 : WS_F1)]);
      tripFace(siteToWorld(site, onLift.x, onLift.z + 2, 0));
      if (floor === 2) workshopShowUpstairs(true);
      wsSetDeck(floor === 2 ? 0.98 : 0.15);
      tripMood(floor === 2 ? 'Taking the car elevator up' : 'Riding the car elevator down', floor === 2 ? 'Up to the second floor!' : null);
      await tripPause(400);
      // (the engine hoist parks over the shaft upstairs: it's only there while the platform is up)
      if (wsModels.hoist) wsModels.hoist.visible = false;
      await wsRideLift(floor, [y => { if (indoorTrip.pos) indoorTrip.pos.y = y; }]);
      workshopTrip.floor = floor;
      if (floor === 2 && wsModels.hoist) wsModels.hoist.visible = true;
      await tripPause(300);
      const off = { x: WS_LIFT.x - WS_LIFT.w / 2 - 0.6, z: WS_LIFT_GATE };
      await tripWalk([siteToWorld(site, off.x, off.z, floor === 2 ? WS_F2 : WS_F1)]);
      if (floor === 1) workshopShowUpstairs(false);
      return off;
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
      const all = [p0, ...pts];
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
      });
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
      wsSetDeck(0.98);
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
      wsSetDeck(0.15);
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

// What a machine's act(ctx) gets: its model, the world point of the machine, ways to pose and wait
function wsContext(site, def, model, stop) {
      const floorY = workshopTrip.floor === 2 ? WS_F2 : WS_F1;
      return {
        site, def, model, stop,
        world: (lx, lz, ly = 0) => siteToWorld(site, lx, lz, floorY + ly),
        say: (title, speech) => tripMood(title, speech),
        wait: ms => tripPause(ms),
        animate: (ms, fn) => wsAnimate(ms, fn),
        face: (lx, lz) => tripFace(siteToWorld(site, lx, lz, 0)),
        // Hands on the controls (or reaching to a height above the floor)
        reach: h => { indoorTrip.pose = () => reachPose(h); },
        work: () => { indoorTrip.pose = t => wsWorkPose(t); },
        idle: () => { indoorTrip.pose = null; indoorTrip.crouchTarget = 0; },
        walk: async (lx, lz) => {
          const cur = { x: indoorTrip.pos.x - wsGroup.position.x, z: indoorTrip.pos.z - wsGroup.position.z };
          await wsWalkTo(site, cur, { x: lx, z: lz });
        },
        floor: workshopTrip.floor
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
      return `a big two-storey workshop east of your helipad (floor 1: fabrication shop with 3D printers, CNC routers and mills, welding and a work bench; floor 2 by car elevator: an electronics line and a garage)`;
    }

window.addEventListener('DOMContentLoaded', () => {
  // After the scene, the scenery and the vehicles are built
  setTimeout(() => { try { buildWorkshop3D(); } catch (e) { console.warn('workshop build', e); } }, 0);
});
