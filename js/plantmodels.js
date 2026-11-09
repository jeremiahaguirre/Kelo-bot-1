// Kelo-bot-1 — js/plantmodels.js
// Loaded after plants.js. The 3D side of his concrete and asphalt plant (js/plants.js runs them):
//   - the flattened, gravelled site south of the big workshop, its signs and the trees cleared off it
//   - a ready-mix concrete batch plant: two cement silos with screw conveyors, sand and stone bins over
//     a weigh belt, an inclined belt up a steel tower to the aggregate weigh hopper, a twin-shaft mixer
//     with its cement and water weigh hoppers, a truck loading chute, a water tank, admixture totes and
//     a control room
//   - a hot-mix asphalt plant: cold feed bins with feeder belts, an inclined conveyor and scalping screen,
//     a rotating drum dryer with its burner and flame, a baghouse with exhaust fan and stack, a heated
//     bitumen tank with hot-oil heater, a pugmill, a slat conveyor to a hot storage silo over the truck
//     lane, a burner fuel tank and a control house
//   - a drivable concrete mixer truck (built at real size like the dump truck, js/gearmodels.js)
//   - his concrete pours (formwork, wet, screeded, curing, cured), drawn from state.concretePours
// Everything repeated (beams, legs, rails, idlers, rungs, bolts...) is drawn with one InstancedMesh per
// material; materials are shared. Full detail is built only while the camera is near (js/perf.js);
// otherwise each plant is a few simple boxes. Every part has a hover label.

const PLANT_GEO = {};          // unit geometries, shared
let plantMatCache = null;      // shared materials
let aggregatePlantGroup = null; // always there: the site, signs and the stand-ins
const plantModels = { batch: null, asphalt: null };   // full detail, only while near
const plantStandInMeshes = { batch: null, asphalt: null };
let concretePourGroup = null;
const concretePourMeshes = {};
// What the plants are doing right now (js/plants.js sets these, the frame loop shows them)
const plantViz = {
  batch: { screw: false, weighBelt: false, incline: false, mixer: false, chute: false, pump: false, dust: false },
  asphalt: { feeders: false, incline: false, drum: false, burner: false, fan: false, pugmill: false, slat: false, gate: false, steam: false, heater: false }
};

function plantMats() {
      if (plantMatCache) return plantMatCache;
      const std = (color, rough = 0.6, metal = 0.2, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
      const m = {
        frame: std(0x1d4ed8, 0.5, 0.45),        // the batch plant's blue steel
        frameDark: std(0x1e3a8a, 0.55, 0.45),
        white: std(0xe7e9ec, 0.42, 0.35),        // silos
        galv: std(0xb7bdc5, 0.38, 0.8),           // galvanised steel: rails, grating, ladders
        grey: std(0x8b929b, 0.5, 0.55),
        dark: std(0x24282e, 0.6, 0.5),
        rubber: std(0x16181c, 0.92, 0),
        yellow: std(0xf2b705, 0.5, 0.3),          // handrails and guards
        orange: std(0xe8590c, 0.48, 0.35),        // the asphalt plant's paint
        asphaltGrey: std(0xa3a8ae, 0.5, 0.5),
        drum: std(0x3b4047, 0.55, 0.6),
        cladding: std(0xd3d7dc, 0.3, 0.75),       // insulated, aluminium-clad tanks and silo
        concrete: std(0xb9b5ad, 0.92, 0),
        sand: std(0xc9a46c, 0.98, 0),
        gravel: std(0x8e8a84, 0.95, 0),
        stone: std(0x6f6c68, 0.95, 0),
        chips: std(0x7d7a75, 0.95, 0),
        blackMix: std(0x141416, 0.75, 0.05),
        wetConcrete: std(0x6f7276, 0.35, 0.05),
        polyBlue: std(0x2b6cb0, 0.45, 0.05),
        tote: std(0xf1f3f5, 0.3, 0, { transparent: true, opacity: 0.82 }),
        toteAmber: std(0xb7791f, 0.3, 0, { transparent: true, opacity: 0.85 }),
        toteBlue: std(0x3b82f6, 0.3, 0, { transparent: true, opacity: 0.8 }),
        wood: std(0x9a7448, 0.8, 0),
        glass: std(0xbfdbfe, 0.06, 0.1, { transparent: true, opacity: 0.38 }),
        cabin: std(0xf4f4f5, 0.6, 0.15),
        screen: std(0x0f172a, 0.3, 0.1, { emissive: 0x38bdf8, emissiveIntensity: 0.55 }),
        flame: new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.9, depthWrite: false }),
        flameCore: new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.95, depthWrite: false }),
        glow: std(0x3b0a00, 0.4, 0, { emissive: 0xff6a00, emissiveIntensity: 0 }),
        beaconAmber: std(0x7c4a03, 0.3, 0, { emissive: 0xf59e0b, emissiveIntensity: 0 }),
        beaconGreen: std(0x065f2a, 0.3, 0, { emissive: 0x22c55e, emissiveIntensity: 0 }),
        pad: std(0x9a958d, 0.95, 0),
        paint: std(0xf8fafc, 0.8, 0),
        form: std(0x8a6a44, 0.85, 0),
        formSteel: std(0x6b7280, 0.45, 0.7),
        stake: std(0x9a7448, 0.85, 0)
      };
      if (typeof finishMaterial === 'function') {
        ['frame', 'frameDark', 'orange', 'asphaltGrey', 'drum', 'yellow', 'polyBlue'].forEach(k => finishMaterial(m[k], 'painted'));
        finishMaterial(m.galv, 'steel'); finishMaterial(m.grey, 'steel'); finishMaterial(m.dark, 'iron');
        finishMaterial(m.cladding, 'cladding'); finishMaterial(m.white, 'cladding');
        finishMaterial(m.concrete, 'stone'); finishMaterial(m.pad, 'gravel');
        finishMaterial(m.sand, 'soil'); finishMaterial(m.gravel, 'gravel'); finishMaterial(m.stone, 'gravel'); finishMaterial(m.chips, 'gravel');
        finishMaterial(m.wood, 'wood'); finishMaterial(m.form, 'wood'); finishMaterial(m.stake, 'wood'); finishMaterial(m.cabin, 'cladding');
        // finishes may reset these; keep the ones that matter
        m.white.color.set(0xe7e9ec); m.cabin.color.set(0xf4f4f5);
      }
      // Wear: the paint dulls and dust settles as the plants are used (plantShowWear)
      m.frame.userData.base = m.frame.color.getHex();
      m.orange.userData.base = m.orange.color.getHex();
      m.white.userData.base = m.white.color.getHex();
      plantMatCache = m;
      return m;
    }

function plantUnitGeos() {
      if (PLANT_GEO.box) return PLANT_GEO;
      PLANT_GEO.box = new THREE.BoxGeometry(1, 1, 1);
      PLANT_GEO.cyl = new THREE.CylinderGeometry(1, 1, 1, 18);
      PLANT_GEO.cyl8 = new THREE.CylinderGeometry(1, 1, 1, 8);
      PLANT_GEO.pyr = new THREE.CylinderGeometry(Math.SQRT1_2, Math.SQRT1_2 * 0.22, 1, 4, 1).rotateY(Math.PI / 4); // a square hopper, wide at the top
      PLANT_GEO.cone = new THREE.CylinderGeometry(1, 0.18, 1, 18, 1);   // a round hopper or silo cone
      // A trough: axis along x, open at the top (scale: length, radius, radius)
      PLANT_GEO.halfCyl = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true, Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).rotateY(Math.PI / 2);
      PLANT_GEO.hoop = new THREE.TorusGeometry(0.42, 0.02, 4, 14, Math.PI);
      return PLANT_GEO;
    }

// --- A kit that gathers parts and draws each material's boxes and cylinders in one go -----------------
// Every add takes a hover label; the InstancedMesh keeps one label per copy.
function plantKit(parent) {
      const G = plantUnitGeos();
      const buckets = new Map();
      const up = new THREE.Vector3(0, 1, 0);
      const put = (geoKey, mat, o, label) => {
        const key = geoKey + '|' + mat.uuid;
        if (!buckets.has(key)) buckets.set(key, { geo: G[geoKey], mat, places: [], labels: [] });
        const b = buckets.get(key);
        b.places.push(o);
        b.labels.push(label || '');
      };
      const kit = {
        box(mat, w, h, d, x, y, z, label, ry = 0, rx = 0, rz = 0) {
          const o = new THREE.Object3D();
          o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(w, h, d);
          put('box', mat, o, label);
          return kit;
        },
        cyl(mat, r, h, x, y, z, label, { rx = 0, ry = 0, rz = 0, geo = 'cyl', r2 = null } = {}) {
          const o = new THREE.Object3D();
          o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(r, h, r2 === null ? r : r2);
          put(geo, mat, o, label);
          return kit;
        },
        // A trough along x (flip it for a hood over a belt)
        trough(mat, r, len, x, y, z, label, { flip = false, ry = 0 } = {}) {
          const o = new THREE.Object3D();
          o.position.set(x, y, z); o.rotation.set(flip ? Math.PI : 0, ry, 0); o.scale.set(len, r, r);
          put('halfCyl', mat, o, label);
          return kit;
        },
        // Any shared geometry at scale 1 (or the given scale)
        add(geoKey, mat, x, y, z, label, rx = 0, ry = 0, rz = 0, sc = 1) {
          const o = new THREE.Object3D();
          o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.setScalar(sc);
          put(geoKey, mat, o, label);
          return kit;
        },
        // A square steel section (or a round one with `round`) from a to b
        beam(mat, a, b, t, label, round = false) {
          const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
          const dir = B.clone().sub(A);
          const len = dir.length();
          if (len < 1e-4) return kit;
          const o = new THREE.Object3D();
          o.position.copy(A).add(B).multiplyScalar(0.5);
          o.quaternion.setFromUnitVectors(up, dir.normalize());
          o.scale.set(t, len, t);
          put(round ? 'cyl8' : 'box', mat, o, label);
          return kit;
        },
        pipe(mat, a, b, r, label) {
          const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
          const dir = B.clone().sub(A);
          const o = new THREE.Object3D();
          o.position.copy(A).add(B).multiplyScalar(0.5);
          o.quaternion.setFromUnitVectors(up, dir.clone().normalize());
          o.scale.set(r, dir.length(), r);
          put('cyl', mat, o, label);
          return kit;
        },
        // A polyline of pipe
        run(mat, pts, r, label) {
          for (let i = 1; i < pts.length; i++) kit.pipe(mat, pts[i - 1], pts[i], r, label);
          return kit;
        },
        // Four legs with X-bracing on two faces (x faces when `bracedX`)
        legs(mat, x0, x1, z0, z1, y0, y1, t, label, { braceX = true, braceZ = true } = {}) {
          [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].forEach(([x, z]) => kit.beam(mat, [x, y0, z], [x, y1, z], t, label));
          const bt = t * 0.45;
          if (braceZ) [z0, z1].forEach(z => { kit.beam(mat, [x0, y0 + 0.15, z], [x1, y1 - 0.1, z], bt, label); kit.beam(mat, [x1, y0 + 0.15, z], [x0, y1 - 0.1, z], bt, label); });
          if (braceX) [x0, x1].forEach(x => { kit.beam(mat, [x, y0 + 0.15, z0], [x, y1 - 0.1, z1], bt, label); kit.beam(mat, [x, y0 + 0.15, z1], [x, y1 - 0.1, z0], bt, label); });
          return kit;
        },
        // Handrail along a straight edge: posts, top rail and knee rail
        rail(a, b, y, label = 'Safety handrail', h = 1.0) {
          const m = plantMats().yellow;
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const n = Math.max(1, Math.round(len / 0.9));
          for (let i = 0; i <= n; i++) {
            const x = a[0] + (b[0] - a[0]) * i / n, z = a[1] + (b[1] - a[1]) * i / n;
            kit.beam(m, [x, y, z], [x, y + h, z], 0.04, label, true);
          }
          kit.beam(m, [a[0], y + h, a[1]], [b[0], y + h, b[1]], 0.04, label, true);
          kit.beam(m, [a[0], y + h * 0.5, a[1]], [b[0], y + h * 0.5, b[1]], 0.03, label, true);
          return kit;
        },
        // A vertical ladder against something, rungs every 0.3
        ladder(x, z, y0, y1, ry, label = 'Access ladder') {
          const m = plantMats().galv;
          const s = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry)).multiplyScalar(0.22);
          kit.beam(m, [x - s.x, y0, z - s.z], [x - s.x, y1, z - s.z], 0.04, label, true);
          kit.beam(m, [x + s.x, y0, z + s.z], [x + s.x, y1, z + s.z], 0.04, label, true);
          for (let y = y0 + 0.25; y < y1; y += 0.3) kit.beam(m, [x - s.x, y, z - s.z], [x + s.x, y, z + s.z], 0.025, label, true);
          return kit;
        },
        flush() {
          buckets.forEach(b => {
            const im = perfInstances(b.geo, b.mat, b.places, { castShadow: true, receiveShadow: true });
            im.userData.labels = b.labels;
            parent.add(im);
          });
          buckets.clear();
          return parent;
        }
      };
      return kit;
    }

// One mesh with its own label
function plantPart(geo, mat, label, x = 0, y = 0, z = 0) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.plantLabel = label;
      return m;
    }

// A canvas texture of a rubber belt with cleats; its offset scrolls while the belt runs
function plantBeltTexture(repeat) {
      if (!PLANT_GEO.beltCanvas) {
        const c = document.createElement('canvas');
        c.width = 64; c.height = 64;
        const g = c.getContext('2d');
        g.fillStyle = '#1b1d21'; g.fillRect(0, 0, 64, 64);
        g.fillStyle = '#4a4e55';
        // chevron cleats across the belt (u runs along the belt)
        for (let i = 0; i < 2; i++) {
          g.beginPath(); g.moveTo(8 + i * 32, 2); g.lineTo(20 + i * 32, 32); g.lineTo(8 + i * 32, 62); g.lineTo(16 + i * 32, 62); g.lineTo(28 + i * 32, 32); g.lineTo(16 + i * 32, 2); g.fill();
        }
        g.fillStyle = 'rgba(160,150,135,0.35)';
        for (let i = 0; i < 40; i++) g.fillRect((i * 37) % 60, (i * 23) % 62, 2, 2);
        PLANT_GEO.beltCanvas = c;
      }
      const t = new THREE.CanvasTexture(PLANT_GEO.beltCanvas);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat, 1);
      return t;
    }

// A belt conveyor from a to b (local points), with stringers, idlers, return belt, head and tail
// pulleys, a drive and support bents to the ground. Returns { group, belt } (belt.material.map scrolls).
function plantConveyor(a, b, width, label, { bents = true, frameMat = null, cover = false } = {}) {
      const M = plantMats();
      const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
      const len = A.distanceTo(B);
      const g = new THREE.Group();
      g.position.copy(A);
      // local +x runs along the conveyor
      const dir = B.clone().sub(A).normalize();
      g.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      // keep the belt flat across (no roll): rebuild the frame from yaw then pitch
      const yaw = Math.atan2(-(B.z - A.z), B.x - A.x), pitch = Math.atan2(B.y - A.y, Math.hypot(B.x - A.x, B.z - A.z));
      g.quaternion.setFromEuler(new THREE.Euler(0, yaw, pitch, 'YZX'));
      const k = plantKit(g);
      const fm = frameMat || M.frame;
      const hw = width / 2 + 0.08;
      // Truss stringers on both sides with diagonal web
      [-hw, hw].forEach(z => {
        k.beam(fm, [0, 0, z], [len, 0, z], 0.07, label);
        k.beam(fm, [0, -0.32, z], [len, -0.32, z], 0.06, label);
        for (let x = 0; x < len - 0.2; x += 0.6) {
          k.beam(fm, [x, -0.32, z], [x, 0, z], 0.04, label);
          k.beam(fm, [x, -0.32, z], [Math.min(len, x + 0.6), 0, z], 0.035, label);
        }
      });
      // Troughing idlers every 0.45 and return rollers under
      for (let x = 0.3; x < len - 0.2; x += 0.45) {
        k.cyl(M.galv, 0.05, width * 0.42, x, 0.02, -width * 0.28, 'Troughing idler', { rx: Math.PI / 2 - 0.35 });
        k.cyl(M.galv, 0.05, width * 0.42, x, 0.02, width * 0.28, 'Troughing idler', { rx: Math.PI / 2 + 0.35 });
        if (Math.round(x / 0.45) % 2 === 0) k.cyl(M.galv, 0.04, width, x, -0.26, 0, 'Return roller', { rx: Math.PI / 2 });
      }
      // Head and tail pulleys
      k.cyl(M.dark, 0.12, width + 0.06, 0, 0.0, 0, 'Tail pulley', { rx: Math.PI / 2 });
      k.cyl(M.dark, 0.14, width + 0.06, len, 0.0, 0, 'Head pulley (driven)', { rx: Math.PI / 2 });
      // Drive: a gear motor on the head
      k.box(M.grey, 0.32, 0.26, 0.26, len - 0.05, 0.0, hw + 0.2, 'Conveyor gear motor');
      k.cyl(M.frameDark, 0.11, 0.34, len - 0.05, 0.0, hw + 0.5, 'Conveyor electric motor', { rx: Math.PI / 2 });
      // The return belt
      k.box(M.rubber, len, 0.015, width * 0.95, len / 2, -0.24, 0, 'Return belt');
      if (cover) { k.box(M.galv, len - 0.4, 0.03, width + 0.2, len / 2, 0.42, 0, 'Conveyor casing lid'); [-1, 1].forEach(sd => k.box(M.galv, len - 0.4, 0.36, 0.03, len / 2, 0.24, sd * (width / 2 + 0.1), 'Conveyor casing')); }
      k.flush();
      const tex = plantBeltTexture(len / 0.5);
      const beltMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, map: tex });
      const belt = plantPart(new THREE.BoxGeometry(len, 0.02, width * 0.9), beltMat, label, len / 2, 0.06, 0);
      g.add(belt);
      // Bents: steel legs from the ground up to the conveyor (in world-up, so built in the parent)
      const bentsOut = [];
      if (bents) {
        const n = Math.max(1, Math.floor(len / 3));
        for (let i = 1; i <= n; i++) {
          const f = i / (n + 1);
          const p = A.clone().lerp(B, f);
          if (p.y < 0.9) continue;
          bentsOut.push(p);
        }
      }
      return { group: g, belt, tex, bents: bentsOut, len };
    }

// A twin-shaft mixer (or pugmill) body along x: trough, open grate on top, two paddle shafts that
// turn, and gear motors at one end. Returns { group, shafts }.
function plantTwinShaft(len, wid, hgt, label, mat) {
      const M = plantMats();
      const g = new THREE.Group();
      const k = plantKit(g);
      // Trough sides, ends and rounded bottom halves
      k.box(mat, len, hgt, 0.06, 0, hgt / 2, -wid / 2, label);
      k.box(mat, len, hgt, 0.06, 0, hgt / 2, wid / 2, label);
      k.box(mat, 0.08, hgt, wid, -len / 2, hgt / 2, 0, label);
      k.box(mat, 0.08, hgt, wid, len / 2, hgt / 2, 0, label);
      [-wid / 4, wid / 4].forEach(z => k.trough(M.dark, wid / 4, len * 0.98, 0, hgt * 0.45, z, label + ': wear liners'));
      // A cover over half, a safety grate over the other half (so the paddles show)
      k.box(mat, len * 0.45, 0.05, wid, -len * 0.27, hgt, 0, label + ': cover');
      for (let x = 0; x < len * 0.5; x += 0.12) k.box(M.galv, 0.025, 0.03, wid, x + 0.04, hgt + 0.01, 0, label + ': inspection grate');
      // Gear motors on the +x end
      [-wid / 4, wid / 4].forEach(z => {
        k.box(M.grey, 0.32, 0.3, 0.3, len / 2 + 0.2, hgt * 0.45, z, label + ': gearbox');
        k.cyl(M.frameDark, 0.13, 0.4, len / 2 + 0.55, hgt * 0.45, z, label + ': drive motor', { rz: Math.PI / 2 });
      });
      k.flush();
      const shafts = [];
      [-wid / 4, wid / 4].forEach((z, si) => {
        const s = new THREE.Group();
        s.position.set(0, hgt * 0.45, z);
        const sk = plantKit(s);
        sk.cyl(M.galv, 0.05, len * 0.94, 0, 0, 0, label + ': mixing shaft', { rz: Math.PI / 2 });
        const arms = Math.max(4, Math.round(len / 0.32));
        for (let i = 0; i < arms; i++) {
          const x = -len * 0.42 + (len * 0.84) * i / (arms - 1);
          const a = i * Math.PI / 2 + si * Math.PI / 4;
          const r = Math.min(wid / 4, hgt * 0.45) * 0.82;
          sk.beam(M.galv, [x, 0, 0], [x, Math.cos(a) * r, Math.sin(a) * r], 0.035, label + ': paddle arm');
          sk.box(M.dark, 0.14, 0.03, 0.12, x, Math.cos(a) * r, Math.sin(a) * r, label + ': paddle tip', 0, a, 0);
        }
        sk.flush();
        g.add(s);
        shafts.push(s);
      });
      return { group: g, shafts };
    }

// --- The site ---------------------------------------------------------------------------------------
function plantSiteLocal(kind) {
      return plantOrigin(kind);
    }

// Gravel ground on the pad and its yard, a concrete apron under each plant, the truck lanes, signs
function buildAggregatePlantGround() {
      const S = aggregatePlantSite(), M = plantMats();
      if (typeof terrainGroundMesh !== 'undefined' && terrainGroundMesh) {
        const geo = terrainGroundMesh.geometry, pos = geo.attributes.position, col = geo.attributes.color;
        const gravel = new THREE.Color(0x9a948a), dark = new THREE.Color(0x7d786f);
        for (let i = 0; i < pos.count; i++) {
          const vx = pos.getX(i), vz = pos.getZ(i);
          const wob = (Math.sin(vx * 2.3) * Math.cos(vz * 3.1) + 1) / 2;
          let c;
          if (inAggregatePlantSite(vx, vz, 0.2)) c = gravel.clone().lerp(dark, wob / 1.5);
          else {
            // The made land: a gravel walkway along the plant (and the trailer row, js/trips.js), meadow,
            // then a sand beach into the water
            const d = KELO_ADDED_LAND.reduce((m, L) => Math.min(m, addedLandDistance(L, vx, vz)), Infinity);
            if (d > 4.3) continue;
            const walk = (vz < S.z + S.d / 2 + 2.2 && vz > S.z && Math.abs(vx - S.x) < S.w / 2 + 0.6)
              || (typeof TRAILER_SLOTS !== 'undefined' && TRAILER_SLOTS.some(([tx, tz]) => tz > 9 && Math.abs(vx - tx) < 3.4 && Math.abs(vz - tz) < 1.5));
            if (d > -1.3) c = (pos.getY(i) > WATER_LEVEL + 0.02 ? new THREE.Color(0xd2bf93) : new THREE.Color(0x8a7a5c)).lerp(new THREE.Color(0xc8b48c), wob * 0.4);
            else if (walk) c = new THREE.Color(0xb3a58c).lerp(dark, wob / 4);
            else c = new THREE.Color(0x5d7d33).lerp(new THREE.Color(0x46662a), wob * 0.6).lerp(new THREE.Color(0x87884a), (1 - wob) * 0.3);
          }
          if (typeof mottleGround === 'function') mottleGround(c, vx, vz, 0.05);
          col.setXYZ(i, c.r, c.g, c.b);
          // The seasons (js/seasons.js) repaint the ground from these, so the gravel stays gravel
          if (typeof terrainBaseColors !== 'undefined' && terrainBaseColors) terrainBaseColors.set([c.r, c.g, c.b], i * 3);
        }
        col.needsUpdate = true;
      }
      const g = new THREE.Group();
      const k = plantKit(g);
      const y = S.y;
      // Concrete aprons where the trucks load, and slabs under the plants
      const B = plantSiteLocal('batch'), A = plantSiteLocal('asphalt');
      k.box(M.concrete, 11.6, 0.08, 2.8, B.x + 0.2, y + 0.03, B.z + PLANT_LANE_Z, 'Concrete loading apron');
      k.box(M.concrete, 13.4, 0.08, 2.8, A.x - 0.4, y + 0.03, A.z + PLANT_LANE_Z, 'Concrete loading apron');
      // Painted edges on each row's truck lane, from the yard strip to the east end
      const x0 = S.x - S.w / 2 + PLANT_YARD_W, x1 = S.x + S.w / 2;
      [B, A].forEach(O => {
        for (let x = x0 + 0.6; x < x1 - 0.6; x += 1.2) k.box(M.paint, 0.7, 0.01, 0.08, x, y + 0.075, O.z + PLANT_LANE_Z - 1.4, 'Truck lane marking');
      });
      // The yard strip's edge, along the plants
      for (let z = S.z - S.d / 2 + 0.8; z < S.z + S.d / 2 - 0.6; z += 1.2) k.box(M.paint, 0.08, 0.01, 0.7, x0 - 0.2, y + 0.075, z, 'Yard marking');
      // Jersey barriers along the lake edge and the east edge
      for (let x = x0 + 0.6; x < x1 - 0.8; x += 2.1) k.box(M.concrete, 1.9, 0.55, 0.32, x, y + 0.28, S.z + S.d / 2 - 0.05, 'Concrete jersey barrier');
      for (let z = S.z - S.d / 2 + 1.2; z < S.z + S.d / 2 - 0.8; z += 2.1) k.box(M.concrete, 0.32, 0.55, 1.9, x1 - 0.05, y + 0.28, z, 'Concrete jersey barrier');
      k.flush();
      // Signs
      const sign = (text, x, z, ry, bg = '#1d4ed8') => {
        const sy = getIslandGroundHeight(x, z);
        const post = plantPart(new THREE.CylinderGeometry(0.06, 0.06, 2.3, 8), M.galv, 'Sign post', x, sy + 1.15, z);
        const s = makeSignMesh(text, { bg, fg: '#ffffff', width: 2.6, height: 0.5 });
        s.position.set(x, sy + 2.1, z);
        s.rotation.y = ry;
        s.userData.plantLabel = text.charAt(0) + text.slice(1).toLowerCase();
        g.add(post, s);
      };
      // Facing the lake: the batch plant's at the back of the yard strip, the asphalt plant's on the walkway
      sign('KELO-1 READY-MIX', S.x - S.w / 2 + 1.6, S.z - S.d / 2 + 0.9, 0);
      sign('KELO-1 HOT MIX ASPHALT', A.x - 1.0, S.z + S.d / 2 + 0.8, 0, '#c2410c');
      return g;
    }

// --- Ready-mix concrete batch plant (local to its origin; z is north-, the truck lane is at +z) -----
function buildBatchPlantModel() {
      const M = plantMats();
      const root = new THREE.Group();
      const parts = {};
      const k = plantKit(root);
      const L = PLANT_LANE_Z;           // truck lane centre
      const deck = 3.9;
      // 1. The mixer tower straddling the truck lane: legs, bracing on the north and south faces
      const tx0 = -4.3, tx1 = -1.7, tz0 = L - 1.4, tz1 = L + 1.4;
      k.legs(M.frame, tx0, tx1, tz0, tz1, 0, deck, 0.24, 'Mixer tower: steel legs', { braceX: false });
      [[tx0, tz0], [tx1, tz0], [tx0, tz1], [tx1, tz1]].forEach(([x, z]) => k.box(M.concrete, 0.6, 0.25, 0.6, x, 0.12, z, 'Concrete footing'));
      k.box(M.frameDark, 3.2, 0.14, 3.3, -3.0, deck, L, 'Mixer deck (steel grating)');
      k.box(M.frameDark, 3.0, 0.08, 0.2, -3.0, deck - 0.12, tz0, 'Deck beam');
      k.box(M.frameDark, 3.0, 0.08, 0.2, -3.0, deck - 0.12, tz1, 'Deck beam');
      k.rail([tx0 - 0.15, tz0 - 0.2], [tx1 + 0.15, tz0 - 0.2], deck + 0.07);
      k.rail([tx0 - 0.15, tz1 + 0.2], [tx1 + 0.15, tz1 + 0.2], deck + 0.07);
      k.rail([tx0 - 0.15, tz0 - 0.2], [tx0 - 0.15, tz1 + 0.2], deck + 0.07);
      k.ladder(tx1 + 0.35, tz0 - 0.25, 0, deck + 1.0, 0, 'Ladder up to the mixer deck');
      // Upper frame and roof over the mixer
      [[tx0, tz0], [tx1, tz0], [tx0, tz1], [tx1, tz1]].forEach(([x, z]) => k.beam(M.frame, [x, deck, z], [x, 7.0, z], 0.16, 'Mixer tower: upper frame'));
      k.box(M.frameDark, 3.0, 0.12, 0.14, -3.0, 6.4, tz0, 'Weigh-hopper beam');
      k.box(M.frameDark, 3.0, 0.12, 0.14, -3.0, 6.4, tz1, 'Weigh-hopper beam');
      k.box(M.frameDark, 0.14, 0.12, 2.9, -3.5, 6.4, L, 'Weigh-hopper beam');
      k.box(M.frameDark, 0.14, 0.12, 2.9, -2.4, 6.4, L, 'Weigh-hopper beam');
      k.box(M.galv, 3.5, 0.08, 3.6, -3.0, 7.1, L, 'Tower roof', 0, 0, 0.06);
      // 2. Twin-shaft mixer on the deck
      const mixer = plantTwinShaft(2.4, 1.4, 1.0, 'Twin-shaft mixer (2 m³)', M.grey);
      mixer.group.position.set(-3.1, deck + 0.08, L);
      root.add(mixer.group);
      parts.mixerShafts = mixer.shafts;
      // Discharge gate and the truck loading chute below the deck
      k.cyl(M.grey, 0.62, 0.45, -3.1, deck - 0.3, L, 'Mixer discharge gate', { geo: 'pyr' });
      k.box(M.dark, 0.3, 0.2, 0.3, -2.7, deck - 0.3, L, 'Discharge gate hydraulic cylinder');
      k.cyl(M.rubber, 0.24, 0.42, -3.1, deck - 0.72, L, 'Truck loading chute (rubber boot)', { r2: 0.24 });
      parts.chuteTip = new THREE.Vector3(-3.1, deck - 0.95, L);
      // 3. Weigh hoppers above the mixer, on load cells
      k.cyl(M.frame, 0.8, 0.9, -2.55, 5.75, L - 0.35, 'Aggregate weigh hopper (on load cells)', { geo: 'pyr' });
      k.cyl(M.white, 0.42, 0.75, -3.65, 5.6, L - 0.45, 'Cement weigh hopper (on load cells)', { geo: 'cone' });
      k.cyl(M.white, 0.42, 0.3, -3.65, 6.12, L - 0.45, 'Cement weigh hopper (on load cells)');
      k.cyl(M.polyBlue, 0.26, 0.55, -3.65, 5.5, L + 0.75, 'Water weigh tank');
      [[-2.55, L - 0.35, 0.62], [-3.65, L - 0.45, 0.42]].forEach(([x, z, r]) => [0, 1, 2, 3].forEach(i => {
        const a = i * Math.PI / 2 + Math.PI / 4;
        k.box(M.galv, 0.1, 0.12, 0.1, x + Math.cos(a) * r, 6.32, z + Math.sin(a) * r, 'Load cell');
      }));
      // 4. Two cement silos north of the tower, each with a screw conveyor up to the cement weigh hopper
      parts.screws = [];
      [[-4.3, -1.25, 1], [-5.6, L, 2]].forEach(([x, z, n]) => {
        const lab = `Cement silo ${n} (portland cement)`;
        k.legs(M.frame, x - 0.6, x + 0.6, z - 0.6, z + 0.6, 0, 2.5, 0.16, `Cement silo ${n}: legs`);
        k.cyl(M.white, 0.88, 0.95, x, 2.95, z, lab, { geo: 'cone' });
        k.cyl(M.white, 0.88, 5.6, x, 6.2, z, lab);
        k.cyl(M.white, 0.9, 0.25, x, 9.12, z, lab, { geo: 'cone', rx: Math.PI });
        k.box(M.grey, 0.62, 0.48, 0.5, x, 9.45, z, `Silo ${n} dust collector (filter cartridges)`);
        k.cyl(M.galv, 0.08, 0.32, x + 0.22, 9.8, z, `Silo ${n} dust collector vent`);
        k.box(M.dark, 0.18, 0.22, 0.18, x - 0.4, 9.32, z + 0.4, `Silo ${n} pressure relief valve`);
        k.rail([x - 0.85, z - 0.85], [x + 0.85, z - 0.85], 9.25, `Silo ${n} roof rail`, 0.8);
        k.rail([x - 0.85, z + 0.85], [x + 0.85, z + 0.85], 9.25, `Silo ${n} roof rail`, 0.8);
        k.ladder(x - 0.98, z, 2.6, 9.6, Math.PI / 2, `Silo ${n} caged ladder`);
        for (let y = 4.4; y < 9.4; y += 0.9) k.add('hoop', M.galv, x - 0.98, y, z, `Silo ${n} ladder safety cage`, Math.PI / 2, 0, Math.PI / 2);
        // Pneumatic fill pipe down the side, with the tanker coupling at the bottom
        k.pipe(M.galv, [x + 0.95, 1.0, z - 0.2], [x + 0.95, 9.0, z - 0.2], 0.06, `Silo ${n} pneumatic fill pipe (cement tanker connection)`);
        k.pipe(M.galv, [x + 0.95, 9.0, z - 0.2], [x + 0.5, 9.1, z - 0.2], 0.06, `Silo ${n} pneumatic fill pipe (cement tanker connection)`);
        k.cyl(M.dark, 0.1, 0.16, x + 0.95, 0.95, z - 0.2, `Silo ${n} tanker coupling`);
        k.box(M.dark, 0.26, 0.2, 0.26, x, 2.3, z, `Silo ${n} butterfly valve`);
        // Screw conveyor: tube from the cone outlet up to the cement weigh hopper
        const from = [x, 2.15, z], to = [-3.65, 6.3, L - 0.45];
        k.pipe(M.frame, from, to, 0.13, `Screw conveyor ${n} (cement)`);
        k.box(M.grey, 0.3, 0.3, 0.3, to[0] + (n === 1 ? -0.35 : 0.35), to[1] + 0.12, to[2] - 0.25, `Screw conveyor ${n} gear motor`);
        // Its drive flange turns while it runs
        const flange = new THREE.Group();
        flange.position.set(...from);
        const fk = plantKit(flange);
        fk.cyl(M.dark, 0.17, 0.06, 0, 0, 0, `Screw conveyor ${n} inlet flange`);
        for (let i = 0; i < 4; i++) fk.box(M.yellow, 0.3, 0.05, 0.04, 0, -0.05, 0, `Screw conveyor ${n} turning`, i * Math.PI / 4);
        fk.flush();
        root.add(flange);
        parts.screws.push(flange);
        parts['silo' + n] = new THREE.Vector3(x, 9.9, z);
      });
      // 5. Aggregate bins: sand, 20 mm gravel, 10 mm crushed stone, over a weigh belt
      const bins = [[2.95, 'sand', 'Sand bin (washed concrete sand)', M.sand], [4.05, 'stone', 'Gravel bin (20 mm stone)', M.gravel], [5.15, 'stone10', 'Crushed stone bin (10 mm)', M.stone]];
      const bz = -1.5;
      k.legs(M.frame, 2.4, 5.7, bz - 0.95, bz + 0.95, 0, 1.75, 0.18, 'Aggregate bins: legs');
      parts.binFill = [];
      bins.forEach(([x, key, lab, mat]) => {
        k.cyl(M.frame, 1.08, 0.7, x, 1.4, bz, lab + ': hopper', { geo: 'pyr', r2: 1.9 });
        k.box(M.dark, 0.3, 0.12, 0.3, x, 1.0, bz, lab + ': discharge gate');
        const fill = plantPart(PLANT_GEO.box, mat, lab, x, 2.2, bz);
        fill.scale.set(1.04, 0.9, 1.82);
        root.add(fill);
        parts.binFill.push({ mesh: fill, key });
      });
      [2.4, 3.5, 4.6, 5.7].forEach(x => k.box(M.frame, 0.06, 1.35, 2.0, x, 2.42, bz, 'Bin divider wall'));
      k.box(M.frame, 3.35, 1.35, 0.06, 4.05, 2.42, bz - 1.0, 'Bin wall');
      k.box(M.frame, 3.35, 1.35, 0.06, 4.05, 2.42, bz + 1.0, 'Bin wall');
      k.box(M.frame, 3.35, 0.06, 0.7, 4.05, 3.25, bz - 1.25, 'Bin loading flare', 0, 0.75);
      k.box(M.frame, 3.35, 0.06, 0.7, 4.05, 3.25, bz + 1.25, 'Bin loading flare', 0, -0.75);
      parts.binsTop = new THREE.Vector3(4.05, 3.3, bz);
      // The weigh belt under the bins, running west to the foot of the inclined conveyor
      const wb = plantConveyor([5.9, 0.7, bz], [1.75, 0.7, bz], 0.6, 'Aggregate weigh belt conveyor (on load cells)', { bents: false });
      root.add(wb.group);
      [5.5, 3.6, 2.1].forEach(x => k.legs(M.frame, x - 0.25, x + 0.25, bz - 0.38, bz + 0.38, 0, 0.36, 0.08, 'Weigh belt stand', { braceX: false, braceZ: false }));
      parts.belts = [wb];
      // 6. Inclined belt conveyor up to the aggregate weigh hopper
      const inc = plantConveyor([1.6, 0.85, bz], [-2.35, 6.75, L - 0.35], 0.6, 'Inclined belt conveyor (aggregates to the mixer)', { cover: false, bents: false });
      inc.bents = [new THREE.Vector3(1.6, 0.85, bz).lerp(new THREE.Vector3(-2.35, 6.75, L - 0.35), 0.55)];
      root.add(inc.group);
      inc.bents.forEach(p => {
        k.legs(M.frame, p.x - 0.35, p.x + 0.35, p.z - 0.3, p.z + 0.3, 0, p.y - 0.36, 0.13, 'Conveyor support bent', { braceZ: false });
        k.box(M.concrete, 0.9, 0.2, 0.75, p.x, 0.1, p.z, 'Concrete footing');
      });
      // Walkway with handrail along the incline
      parts.belts.push(inc);
      // 7. Water tank (filled from the lake) with its pump and the pipe up to the water weigh tank
      k.cyl(M.polyBlue, 0.5, 1.6, 0.6, 1.0, -0.75, 'Water tank (filled from the lake)');
      k.cyl(M.polyBlue, 0.52, 0.1, 0.6, 1.83, -0.75, 'Water tank lid');
      k.box(M.concrete, 1.15, 0.2, 1.15, 0.6, 0.1, -0.75, 'Water tank base');
      k.box(M.grey, 0.4, 0.3, 0.26, 0.6, 0.35, -0.05, 'Lake water pump');
      k.run(M.polyBlue, [[0.6, 0.12, 0.1], [0.6, 0.12, 3.1]], 0.05, 'Lake intake pipe');
      k.run(M.galv, [[0.6, 1.9, -0.75], [0.6, 3.6, -0.75], [-1.3, 3.6, -0.75], [-1.3, 3.6, L - 1.4], [-3.65, 5.4, L + 0.75]], 0.05, 'Water line to the mixer');
      // 8. Admixture: a tote of water reducer and a drum of set retarder, with the dosing pump
      {
        const x = -0.45, z = -0.95, lab = 'Admixture tote: water reducer';
        k.box(M.wood, 0.78, 0.12, 0.72, x, 0.06, z, lab + ' (pallet)');
        k.box(M.toteAmber, 0.7, 0.85, 0.64, x, 0.56, z, lab);
        k.cyl(M.dark, 0.08, 0.06, x, 1.02, z, lab + ' (cap)');
        for (const y of [0.16, 0.55, 0.98]) {
          k.box(M.galv, 0.76, 0.025, 0.025, x, y, z - 0.34, lab + ' (steel cage)');
          k.box(M.galv, 0.76, 0.025, 0.025, x, y, z + 0.34, lab + ' (steel cage)');
          k.box(M.galv, 0.025, 0.025, 0.7, x - 0.38, y, z, lab + ' (steel cage)');
          k.box(M.galv, 0.025, 0.025, 0.7, x + 0.38, y, z, lab + ' (steel cage)');
        }
      }
      k.cyl(M.toteBlue, 0.28, 0.85, 1.4, 0.43, -0.3, 'Admixture drum: set retarder (200 L)');
      k.box(M.grey, 0.3, 0.25, 0.25, -0.45, 0.2, -0.45, 'Admixture dosing pump');
      k.run(M.dark, [[-0.45, 0.3, -0.45], [-1.3, 3.5, -0.6], [-3.4, 5.2, L + 0.6]], 0.025, 'Admixture line to the mixer');
      // 9. Control room north of the tower, its window on the truck lane
      const cx = -2.1, cz = -0.95;
      k.box(M.cabin, 2.4, 2.3, 1.2, cx, 1.35, cz, 'Batch control room');
      k.box(M.dark, 2.6, 0.12, 1.4, cx, 2.56, cz, 'Control room roof');
      k.box(M.concrete, 2.6, 0.2, 1.4, cx, 0.1, cz, 'Control room base');
      k.box(M.glass, 1.6, 0.8, 0.05, cx, 1.75, cz + 0.61, 'Control room window (looks onto the truck lane and the chute)');
      k.box(M.dark, 0.8, 1.8, 0.06, cx - 0.6, 1.1, cz - 0.61, 'Control room door');
      k.box(M.grey, 0.4, 0.35, 0.3, cx + 0.8, 2.05, cz - 0.7, 'Air conditioner');
      k.box(M.dark, 1.4, 0.75, 0.35, cx, 0.95, cz + 0.35, 'Batching console');
      k.box(M.screen, 0.6, 0.38, 0.04, cx + 0.3, 1.55, cz + 0.5, 'Batching computer (mix designs and tickets)');
      k.box(M.grey, 0.5, 0.06, 0.5, cx - 0.6, 0.36, cz - 0.9, 'Control room step');
      const beacon = (mat, x, y, z, lab) => { const b = plantPart(new THREE.SphereGeometry(0.11, 12, 8), mat, lab, x, y, z); root.add(b); return b; };
      parts.beaconGreen = beacon(M.beaconGreen, cx - 0.7, 2.72, cz + 0.3, 'Running light');
      parts.beaconAmber = beacon(M.beaconAmber, cx + 0.7, 2.72, cz + 0.3, 'Service light (filters or mixer wear)');
      // Tower sign
      const sign = makeSignMesh('KELO-1 READY-MIX', { bg: '#1d4ed8', fg: '#ffffff', width: 2.8, height: 0.5 });
      sign.position.set(-3.0, 6.75, tz1 + 0.12);
      sign.userData.plantLabel = 'Kelo-1 Ready-Mix';
      root.add(sign);
      k.flush();
      // Flowing concrete from the chute into the truck, dust from the silo filters
      parts.stream = plantPart(new THREE.CylinderGeometry(0.13, 0.17, 1, 10), M.wetConcrete, 'Fresh concrete pouring into the truck', -3.1, deck - 1.25, L);
      parts.stream.scale.y = 0.6;
      parts.stream.visible = false;
      root.add(parts.stream);
      return { root, parts };
    }

// --- Hot-mix asphalt plant (local to its origin) ---------------------------------------------------
function buildAsphaltPlantModel() {
      const M = plantMats();
      const root = new THREE.Group();
      const parts = {};
      // The machines north of the lane sit a little further south, so the plant stays clear of the workshop
      const north = new THREE.Group();
      north.position.z = ASPHALT_NORTH_SHIFT;
      root.add(north);
      let k = plantKit(north);
      const L = PLANT_LANE_Z;
      // 1. Cold feed bins with feeder belts under each
      const bz = -1.85;
      const bins = [[-6.75, 'coarse', 'Cold feed bin: 19 mm crushed stone', M.gravel], [-5.55, 'chips', 'Cold feed bin: 10 mm chips', M.chips], [-4.35, 'fine', 'Cold feed bin: manufactured sand', M.sand]];
      k.legs(M.orange, -7.35, -3.75, bz - 0.8, bz + 0.8, 0, 1.25, 0.16, 'Cold feed bins: legs');
      parts.binFill = [];
      bins.forEach(([x, key, lab, mat]) => {
        k.cyl(M.orange, 0.95, 1.45, x, 2.0, bz, lab, { geo: 'pyr', r2: 1.55 });
        k.box(M.orange, 1.36, 0.35, 0.06, x, 2.85, bz - 1.02, lab + ': extension board', 0, 0.5);
        k.box(M.orange, 1.36, 0.35, 0.06, x, 2.85, bz + 1.02, lab + ': extension board', 0, -0.5);
        const fill = plantPart(new THREE.SphereGeometry(0.62, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat, lab, x, 2.55, bz);
        fill.scale.set(1, 0.5, 1.5);
        north.add(fill);
        parts.binFill.push({ mesh: fill, key });
        // Feeder belt and its motor
        k.box(M.dark, 0.9, 0.18, 0.55, x, 1.0, bz, 'Variable-speed feeder belt');
        k.cyl(M.frameDark, 0.1, 0.3, x + 0.52, 1.0, bz + 0.35, 'Feeder belt motor', { rx: Math.PI / 2 });
      });
      parts.belts = [];
      const coll = plantConveyor([-7.4, 0.5, bz], [-3.5, 0.5, bz], 0.55, 'Collecting conveyor (cold feed)', { bents: false, frameMat: M.orange });
      north.add(coll.group);
      parts.belts.push(coll);
      // 2. Inclined conveyor with a scalping screen at the top
      const inc = plantConveyor([-3.35, 0.55, bz], [-1.1, 3.2, -1.65], 0.55, 'Inclined charging conveyor', { frameMat: M.orange });
      north.add(inc.group);
      parts.belts.push(inc);
      inc.bents.forEach(p => k.legs(M.orange, p.x - 0.3, p.x + 0.3, p.z - 0.3, p.z + 0.3, 0, p.y - 0.36, 0.12, 'Conveyor support bent', { braceZ: false }));
      const screen = plantPart(new THREE.BoxGeometry(0.85, 0.42, 0.85), M.orange, 'Scalping screen (rejects oversize)', -0.95, 3.3, -1.65);
      north.add(screen);
      parts.screen = screen;
      k.box(M.galv, 0.9, 0.05, 0.9, -0.95, 3.53, -1.65, 'Scalping screen deck');
      k.legs(M.orange, -1.3, -0.6, -2.0, -1.3, 0, 3.1, 0.1, 'Scalping screen support');
      k.box(M.dark, 0.5, 0.5, 0.5, -0.4, 2.9, -1.65, 'Drum feed chute');
      // 3. The drum dryer: rotating shell with riding rings and girth gear, on trunnion rollers
      const dz = -1.65, dx0 = -0.25, dx1 = 4.05, dy0 = 2.35, dy1 = 2.05;
      const drum = new THREE.Group();
      drum.position.set((dx0 + dx1) / 2, (dy0 + dy1) / 2, dz);
      drum.rotation.z = Math.atan2(dy1 - dy0, dx1 - dx0);
      const spin = new THREE.Group();
      drum.add(spin);
      const dl = Math.hypot(dx1 - dx0, dy1 - dy0);
      const sk = plantKit(spin);
      sk.cyl(M.drum, 0.82, dl, 0, 0, 0, 'Drum dryer (counter-flow, turning)', { rz: Math.PI / 2 });
      [-dl * 0.3, dl * 0.3].forEach(x => sk.cyl(M.dark, 0.92, 0.2, x, 0, 0, 'Drum riding ring', { rz: Math.PI / 2 }));
      sk.cyl(M.grey, 0.95, 0.12, 0.25, 0, 0, 'Drum girth sprocket', { rz: Math.PI / 2 });
      // Weld seams and bolt strips: they show the drum turning
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        sk.box(M.dark, dl * 0.92, 0.035, 0.07, 0, Math.cos(a) * 0.83, Math.sin(a) * 0.83, 'Drum dryer shell seam', 0, a, 0);
      }
      for (let x = -dl / 2 + 0.3; x < dl / 2; x += 0.45) sk.cyl(M.dark, 0.835, 0.03, x, 0, 0, 'Drum dryer shell', { rz: Math.PI / 2 });
      sk.flush();
      north.add(drum);
      parts.drum = spin;
      // Drum frame and trunnions
      k.box(M.orange, dl + 0.6, 0.18, 0.2, (dx0 + dx1) / 2, 0.95, dz - 0.75, 'Drum frame');
      k.box(M.orange, dl + 0.6, 0.18, 0.2, (dx0 + dx1) / 2, 0.95, dz + 0.75, 'Drum frame');
      [dx0 + 0.95, dx1 - 0.95].forEach(x => [-0.5, 0.5].forEach(o => {
        const y = dy0 + (dy1 - dy0) * (x - dx0) / (dx1 - dx0);
        k.cyl(M.grey, 0.2, 0.28, x, y - 1.0, dz + o, 'Trunnion roller', { rz: Math.PI / 2 });
        k.box(M.orange, 0.36, y - 1.0 - 0.95, 0.3, x, (y - 1.0 + 0.95) / 2, dz + o, 'Trunnion pedestal');
      }));
      [dx0 + 0.2, (dx0 + dx1) / 2, dx1 - 0.2].forEach(x => k.legs(M.orange, x - 0.15, x + 0.15, dz - 0.75, dz + 0.75, 0, 0.9, 0.16, 'Drum frame legs', { braceZ: false }));
      k.box(M.dark, 0.5, 0.45, 0.4, 2.2, 0.55, dz + 1.1, 'Drum drive gear motor');
      k.beam(M.dark, [2.2, 0.75, dz + 0.9], [2.15, 1.25, dz + 0.8], 0.06, 'Drum drive chain');
      // Feed breeching (stationary) and the exhaust duct to the baghouse
      k.box(M.asphaltGrey, 0.7, 2.0, 1.95, dx0 - 0.4, 2.15, dz, 'Feed breeching (exhaust gases leave here)');
      k.run(M.asphaltGrey, [[dx0 - 0.4, 3.1, dz], [dx0 - 0.4, 4.6, dz], [0.6, 4.6, -3.05]], 0.34, 'Exhaust duct to the baghouse');
      // Burner end: hood, burner, blower and fuel train
      k.box(M.asphaltGrey, 0.4, 2.0, 2.0, dx1 + 0.25, 1.95, dz, 'Burner hood (hot aggregate falls out here)');
      const glow = plantPart(new THREE.CircleGeometry(0.34, 20), M.glow, 'Burner sight glass', dx1 + 0.46, 2.45, dz + 0.55);
      glow.rotation.y = Math.PI / 2;
      north.add(glow);
      parts.glow = glow;
      k.cyl(M.orange, 0.38, 0.85, dx1 + 1.45, 1.95, dz, 'Burner (diesel or natural gas)', { rz: Math.PI / 2 });
      // An open burner throat between the burner and the hood, so the flame shows
      [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([a, b]) => k.beam(M.dark, [dx1 + 0.45, 1.95 + a * 0.42, dz + b * 0.42], [dx1 + 1.02, 1.95 + a * 0.42, dz + b * 0.42], 0.05, 'Burner throat frame'));
      k.cyl(M.dark, 0.3, 0.2, dx1 + 1.95, 1.95, dz, 'Burner air register', { rz: Math.PI / 2 });
      k.cyl(M.orange, 0.5, 0.36, dx1 + 1.5, 0.85, dz - 0.25, 'Combustion air blower', { rx: Math.PI / 2 });
      k.cyl(M.frameDark, 0.18, 0.45, dx1 + 1.5, 0.85, dz + 0.25, 'Blower motor', { rx: Math.PI / 2 });
      k.pipe(M.orange, [dx1 + 1.5, 1.25, dz - 0.25], [dx1 + 1.5, 1.75, dz - 0.25], 0.15, 'Blower duct to the burner');
      k.run(M.yellow, [[dx1 + 1.2, 2.35, dz + 0.3], [dx1 + 2.1, 2.35, dz + 0.3], [dx1 + 2.1, 0.6, dz + 0.3], [5.4, 0.6, -2.9]], 0.04, 'Burner fuel train');
      [[dx1 + 1.5, 2.35], [dx1 + 1.8, 2.35]].forEach(([x, y]) => k.box(M.dark, 0.12, 0.16, 0.12, x, y, dz + 0.3, 'Fuel safety shut-off valve'));
      // The flame inside the burner throat (a cone of fire pointing into the drum)
      const flame = new THREE.Group();
      flame.position.set(dx1 + 1.05, 1.95, dz);
      const outer = plantPart(new THREE.ConeGeometry(0.42, 1.6, 16, 1, true), M.flame, 'Burner flame');
      outer.rotation.z = Math.PI / 2;
      outer.position.x = -0.6;
      const core = plantPart(new THREE.ConeGeometry(0.2, 1.0, 12, 1, true), M.flameCore, 'Burner flame');
      core.rotation.z = Math.PI / 2;
      core.position.x = -0.4;
      [outer, core].forEach(m => { m.castShadow = false; m.receiveShadow = false; });
      flame.add(outer, core);
      flame.visible = false;
      north.add(flame);
      parts.flame = flame;
      // 4. Baghouse dust collector with hoppers, pulse-jet headers, fan and stack
      const hx = 1.5, hz = -3.05;
      k.legs(M.asphaltGrey, hx - 1.1, hx + 1.1, hz - 0.5, hz + 0.5, 0, 1.3, 0.16, 'Baghouse legs', { braceZ: false });
      k.box(M.asphaltGrey, 2.4, 2.6, 1.2, hx, 3.3, hz, 'Baghouse dust collector (filter bags)');
      [-0.75, 0, 0.75].forEach(dx => k.cyl(M.asphaltGrey, 0.55, 0.75, hx + dx, 1.65, hz, 'Baghouse dust hopper', { geo: 'pyr', r2: 0.75 }));
      k.box(M.asphaltGrey, 2.5, 0.35, 1.3, hx, 4.78, hz, 'Clean-air plenum');
      for (let i = 0; i < 5; i++) k.cyl(M.galv, 0.04, 1.2, hx - 1.0 + i * 0.5, 5.02, hz, 'Pulse-jet compressed-air header', { rx: Math.PI / 2 });
      k.cyl(M.galv, 0.18, 0.8, hx + 0.9, 5.25, hz - 0.3, 'Compressed-air tank', { rz: Math.PI / 2 });
      k.pipe(M.asphaltGrey, [hx - 0.75, 1.25, hz], [hx + 0.75, 1.25, hz], 0.1, 'Fines return screw');
      k.run(M.asphaltGrey, [[hx + 0.75, 1.25, hz], [3.0, 1.25, hz + 0.4], [3.4, 1.7, -0.6 - ASPHALT_NORTH_SHIFT]], 0.1, 'Fines return screw (dust back into the mix)');
      k.box(M.asphaltGrey, 0.7, 0.9, 0.7, hx + 1.65, 4.0, hz, 'Baghouse outlet duct');
      k.cyl(M.orange, 0.55, 0.45, hx + 1.95, 1.0, hz - 0.1, 'Exhaust fan (induced draft)', { rx: Math.PI / 2 });
      k.cyl(M.frameDark, 0.22, 0.5, hx + 1.95, 1.0, hz + 0.45, 'Exhaust fan motor', { rx: Math.PI / 2 });
      k.pipe(M.asphaltGrey, [hx + 1.65, 3.6, hz], [hx + 1.95, 1.5, hz - 0.1], 0.25, 'Fan inlet duct');
      const sx = hx + 2.15, sz = hz - 0.55;
      k.cyl(M.galv, 0.3, 8.3, sx, 4.65, sz, 'Exhaust stack');
      k.cyl(M.dark, 0.34, 0.12, sx, 8.82, sz, 'Stack lip');
      k.cyl(M.galv, 0.6, 0.06, sx, 5.6, sz, 'Stack sampling platform');
      k.ladder(sx - 0.42, sz, 0.2, 6.4, Math.PI / 2, 'Stack ladder');
      parts.stackTop = new THREE.Vector3(sx, 8.9, sz + ASPHALT_NORTH_SHIFT);
      k.ladder(hx - 1.3, hz, 0, 4.9, Math.PI / 2, 'Baghouse ladder');
      // 9. Burner fuel tank and the gas meter
      k.cyl(M.white, 0.48, 1.8, 5.35, 0.85, -3.0, 'Burner diesel tank (double-walled)', { rz: Math.PI / 2 });
      k.legs(M.grey, 4.7, 6.0, -3.25, -2.75, 0, 0.4, 0.1, 'Fuel tank saddles', { braceX: false, braceZ: false });
      k.box(M.yellow, 0.4, 0.55, 0.3, 6.15, 0.35, -1.8, 'Natural gas meter');
      k.flush();
      k = plantKit(root);
      // 5. Pugmill under the drum discharge, with the bitumen spray bar
      const pug = plantTwinShaft(1.6, 0.9, 0.7, 'Pugmill (twin-shaft asphalt mixer)', M.orange);
      pug.group.position.set(3.35, 0.85, -0.3);
      root.add(pug.group);
      parts.pugShafts = pug.shafts;
      k.legs(M.orange, 2.6, 4.1, -0.7, 0.1, 0, 0.85, 0.12, 'Pugmill legs', { braceZ: false });
      k.pipe(M.dark, [3.7, 1.75, -1.4 + ASPHALT_NORTH_SHIFT], [3.55, 1.2, -0.5], 0.17, 'Hot aggregate chute (from the drum to the pugmill)');
      k.pipe(M.cladding, [2.75, 1.65, -0.3], [3.95, 1.65, -0.3], 0.05, 'Bitumen spray bar (5.5% binder)');
      // 6. Slat conveyor up to the hot storage silo over the truck lane
      const silX = -1.2;
      const slat = plantConveyor([3.95, 0.95, 0.15], [silX + 0.35, 6.75, L - 0.2], 0.5, 'Slat (drag) conveyor to the silo', { frameMat: M.orange, cover: true });
      root.add(slat.group);
      parts.belts.push(slat);
      parts.slat = slat;
      slat.bents.forEach(p => k.legs(M.orange, p.x - 0.25, p.x + 0.25, p.z - 0.25, p.z + 0.25, 0, p.y - 0.36, 0.12, 'Slat conveyor support', { braceZ: false }));
      // 7. Hot storage silo: insulated, on legs over the truck, with the clam gate
      k.legs(M.orange, silX - 0.95, silX + 0.95, L - 1.3, L + 1.3, 0, 3.4, 0.22, 'Hot storage silo legs', { braceX: false });
      [[silX - 0.95, L - 1.3], [silX + 0.95, L - 1.3], [silX - 0.95, L + 1.3], [silX + 0.95, L + 1.3]].forEach(([x, z]) => k.box(M.concrete, 0.55, 0.22, 0.55, x, 0.11, z, 'Concrete footing'));
      k.box(M.orange, 2.1, 0.2, 2.7, silX, 3.4, L, 'Silo support ring beam');
      k.cyl(M.cladding, 0.92, 0.75, silX, 3.85, L, 'Hot storage silo (insulated)', { geo: 'cone' });
      k.cyl(M.cladding, 0.92, 2.5, silX, 5.45, L, 'Hot storage silo (insulated)');
      k.cyl(M.cladding, 0.95, 0.3, silX, 6.85, L, 'Hot storage silo roof', { geo: 'cone', rx: Math.PI });
      k.cyl(M.orange, 0.38, 0.5, silX + 0.15, 7.1, L - 0.1, 'Batcher (gob hopper, stops segregation)', { geo: 'cone' });
      k.box(M.dark, 0.5, 0.3, 0.5, silX, 3.3, L, 'Silo clam gate');
      k.box(M.dark, 0.12, 0.45, 0.12, silX + 0.35, 3.25, L, 'Clam gate air cylinder');
      k.rail([silX - 1.0, L - 1.0], [silX + 1.0, L - 1.0], 6.95, 'Silo roof rail', 0.85);
      k.rail([silX - 1.0, L + 1.0], [silX + 1.0, L + 1.0], 6.95, 'Silo roof rail', 0.85);
      k.ladder(silX - 1.15, L - 1.35, 0, 7.7, Math.PI / 2, 'Silo ladder');
      parts.gateTip = new THREE.Vector3(silX, 3.1, L);
      parts.siloTop = new THREE.Vector3(silX, 7.2, L);
      // 8. Heated bitumen tank, hot-oil heater and the binder line to the pugmill
      const tx = 5.35, tz = L - 0.1;
      k.cyl(M.cladding, 0.8, 3.3, tx, 1.95, tz, 'Bitumen tank (heated, insulated, 30 t)');
      k.cyl(M.cladding, 0.82, 0.28, tx, 3.72, tz, 'Bitumen tank roof', { geo: 'cone', rx: Math.PI });
      k.box(M.concrete, 2.0, 0.3, 2.0, tx, 0.15, tz, 'Bitumen tank base');
      k.cyl(M.dark, 0.06, 0.4, tx + 0.3, 4.0, tz, 'Bitumen tank vent');
      k.ladder(tx - 0.95, tz, 0.3, 4.2, Math.PI / 2, 'Bitumen tank ladder');
      k.box(M.orange, 0.9, 1.2, 0.8, tx + 0.35, 0.9, tz - 1.25, 'Hot-oil heater (keeps the bitumen at 160 °C)');
      k.cyl(M.galv, 0.11, 1.6, tx + 0.6, 2.2, tz - 1.25, 'Hot-oil heater flue');
      k.run(M.cladding, [[tx - 0.7, 0.55, tz - 0.4], [4.2, 0.55, -0.3], [4.2, 1.65, -0.3], [3.95, 1.65, -0.3]], 0.07, 'Heated bitumen line (to the spray bar)');
      k.box(M.grey, 0.4, 0.3, 0.3, 4.7, 0.3, tz - 0.6, 'Bitumen metering pump');
      parts.tankVent = new THREE.Vector3(tx + 0.3, 4.25, tz);
      parts.heaterFlue = new THREE.Vector3(tx + 0.6, 3.05, tz - 1.25);
      // 10. Control house at the west end of the lane
      const cx = -6.55, cz = L;
      k.box(M.cabin, 1.7, 2.3, 2.4, cx, 1.35, cz, 'Asphalt plant control house');
      k.box(M.dark, 1.9, 0.12, 2.6, cx, 2.56, cz, 'Control house roof');
      k.box(M.concrete, 1.9, 0.2, 2.6, cx, 0.1, cz, 'Control house base');
      k.box(M.glass, 0.05, 0.9, 1.8, cx + 0.86, 1.75, cz, 'Control house window (looks onto the silo)');
      k.box(M.dark, 0.06, 1.8, 0.8, cx, 1.1, cz - 1.22, 'Control house door', Math.PI / 2);
      k.box(M.dark, 0.4, 0.75, 1.4, cx + 0.5, 0.95, cz, 'Plant control desk');
      k.box(M.screen, 0.04, 0.38, 0.6, cx + 0.68, 1.55, cz + 0.3, 'Plant computer (feed rates, temperatures, binder %)');
      k.box(M.grey, 0.5, 0.4, 0.3, cx - 0.4, 2.0, cz + 1.3, 'Air conditioner');
      const beacon = (mat, x, y, z, lab) => { const b = plantPart(new THREE.SphereGeometry(0.11, 12, 8), mat, lab, x, y, z); root.add(b); return b; };
      parts.beaconGreen = beacon(M.beaconGreen, cx + 0.45, 2.72, cz - 0.6, 'Running light');
      parts.beaconAmber = beacon(M.beaconAmber, cx + 0.45, 2.72, cz + 0.6, 'Service light (baghouse bags or burner)');
      const sign = makeSignMesh('KELO-1 HOT MIX', { bg: '#c2410c', fg: '#ffffff', width: 2.2, height: 0.45 });
      sign.position.set(silX, 6.15, L + 0.97);
      sign.userData.plantLabel = 'Kelo-1 Hot Mix';
      root.add(sign);
      k.flush();
      // Hot asphalt falling from the clam gate into the truck
      parts.stream = plantPart(new THREE.CylinderGeometry(0.2, 0.32, 1, 10), M.blackMix, 'Hot-mix asphalt dropping into the truck', silX, 2.7, L);
      parts.stream.scale.y = 0.7;
      parts.stream.visible = false;
      root.add(parts.stream);
      return { root, parts };
    }

// --- Far away: a few plain boxes and cylinders in each plant's colours -----------------------------
function plantStandIns(kind) {
      const L = PLANT_LANE_Z, N = ASPHALT_NORTH_SHIFT;
      const spots = kind === 'batch' ? [
        { x: -3.0, y: 0, z: L, w: 3.0, h: 7.0, d: 2.9, color: 0x1d4ed8 },
        { x: -4.3, y: 0, z: -1.25, w: 1.7, h: 9.4, d: 1.7, color: 0xe7e9ec },
        { x: -5.6, y: 0, z: L, w: 1.7, h: 9.4, d: 1.7, color: 0xe7e9ec },
        { x: 4.05, y: 0, z: -1.5, w: 3.3, h: 3.2, d: 2.0, color: 0x1d4ed8 },
        { x: 0.6, y: 0, z: -0.75, w: 1.0, h: 1.9, d: 1.0, color: 0x2b6cb0 },
        { x: -2.1, y: 0, z: -0.95, w: 2.4, h: 2.6, d: 1.2, color: 0xf4f4f5 }
      ] : [
        { x: -5.55, y: 0, z: -1.85 + N, w: 3.6, h: 2.9, d: 1.8, color: 0xe8590c },
        { x: 1.9, y: 1.2, z: -1.65 + N, w: 4.4, h: 1.7, d: 1.7, color: 0x3b4047 },
        { x: 1.5, y: 0, z: -3.05 + N, w: 2.4, h: 4.9, d: 1.2, color: 0xa3a8ae },
        { x: 3.65, y: 0, z: -3.6 + N, w: 0.6, h: 8.9, d: 0.6, color: 0xb7bdc5 },
        { x: -1.2, y: 0, z: L, w: 1.9, h: 7.0, d: 1.9, color: 0xd3d7dc },
        { x: 5.35, y: 0, z: L - 0.1, w: 1.6, h: 3.9, d: 1.6, color: 0xd3d7dc },
        { x: -6.55, y: 0, z: L, w: 1.7, h: 2.6, d: 2.4, color: 0xf4f4f5 }
      ];
      return perfStandIns(spots, { castShadow: true });
    }

// --- Concrete mixer truck (real size, +x is forward, like the dump truck in js/gearmodels.js) ------
function mixerTruckModel() {
      const white = 0xf1f5f9, dark = 0x1f2937, chrome = 0xcbd5e1, drumCol = 0xffffff;
      const b = group();
      // Frame, wheels, fenders
      [-0.5, 0.5].forEach(z => b.add(at(mesh(new THREE.BoxGeometry(7.6, 0.3, 0.26), dark), -0.2, 0.92, z)));
      [3.0, -1.75, -2.95].forEach(x => [-1.05, 1.05].forEach(z => b.add(at(wheel(0.58, 0.44), x, 0.58, z))));
      [-1.12, 1.12].forEach(z => {
        b.add(at(mesh(new THREE.BoxGeometry(2.8, 0.1, 0.55), dark), -2.35, 1.28, z));
        const arch = mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.5, 16, 1, true, Math.PI / 2, Math.PI), white, { side: THREE.DoubleSide });
        arch.rotation.x = Math.PI / 2;
        b.add(at(arch, 3.0, 0.62, z));
      });
      // Cab
      b.add(at(mesh(new THREE.BoxGeometry(1.8, 1.2, 2.45), white, { metalness: 0.3, roughness: 0.4 }), 3.05, 1.6, 0));
      b.add(at(mesh(new THREE.BoxGeometry(0.7, 0.9, 2.3), white, { metalness: 0.3, roughness: 0.4 }), 4.2, 1.45, 0));
      for (let i = 0; i < 5; i++) b.add(at(mesh(new THREE.BoxGeometry(0.06, 0.05, 1.4), chrome, { metalness: 0.9, roughness: 0.2 }), 4.57, 1.15 + i * 0.14, 0));
      [-0.85, 0.85].forEach(z => {
        const lamp = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 14), 0xfffbeb, { emissive: 0xfef3c7, emissiveIntensity: 0.6 });
        lamp.rotation.z = Math.PI / 2;
        b.add(at(lamp, 4.57, 1.62, z));
      });
      b.add(at(mesh(new THREE.BoxGeometry(0.26, 0.3, 2.6), dark), 4.62, 0.9, 0));
      b.add(at(glass(new THREE.BoxGeometry(1.7, 1.35, 2.35)), 3.05, 2.88, 0));
      [[2.2, -1.18], [2.2, 1.18], [3.9, -1.18], [3.9, 1.18]].forEach(([x, z]) => b.add(at(mesh(new THREE.BoxGeometry(0.12, 1.35, 0.12), white), x, 2.88, z)));
      b.add(at(mesh(new THREE.BoxGeometry(1.9, 0.15, 2.5), white), 3.05, 3.62, 0));
      [-0.6, 0, 0.6].forEach(z => b.add(at(mesh(new THREE.BoxGeometry(0.12, 0.1, 0.22), 0xf59e0b, { emissive: 0xf59e0b, emissiveIntensity: 0.4 }), 3.8, 3.74, z)));
      b.add(at(mesh(new THREE.BoxGeometry(0.8, 0.22, 0.9), dark), 2.85, 1.12, -0.45));
      b.add(at(mesh(new THREE.BoxGeometry(0.2, 1.0, 0.9), dark), 2.45, 1.68, -0.45));
      const steer = mesh(new THREE.TorusGeometry(0.25, 0.04, 8, 20), dark);
      steer.rotation.y = Math.PI / 2;
      steer.rotation.x = 0.5;
      b.add(at(steer, 3.6, 2.1, -0.45));
      steer.userData.steeringWheel = true; // turns with the front wheels (js/vehicles.js)
      [-1, 1].forEach(s => {
        b.add(rod([3.9, 2.6, s * 1.25], [3.9, 2.6, s * 1.6], 0.03, dark));
        b.add(at(mesh(new THREE.BoxGeometry(0.08, 0.48, 0.24), dark), 3.9, 2.5, s * 1.62));
        b.add(at(mesh(new THREE.BoxGeometry(0.5, 0.06, 0.3), chrome, { metalness: 0.8 }), 2.6, 0.78, s * 1.3));
      });
      b.add(at(mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 10), chrome, { metalness: 0.9, roughness: 0.2 }), 2.05, 2.5, 1.05));
      // Water tank behind the cab, for washing out and adjusting slump
      const wtank = mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.6, 16), 0x2b6cb0, { metalness: 0.3 });
      wtank.rotation.x = Math.PI / 2;
      b.add(at(wtank, 1.75, 1.85, 0));
      // The drum: a striped lathe tilted up at the back, turning on its axis
      const pts = [[0.0, -2.4], [0.5, -2.35], [0.62, -2.0], [1.05, -0.9], [1.08, 0.3], [0.9, 1.3], [0.55, 2.05], [0.2, 2.2], [0.0, 2.2]].map(([r, y]) => new THREE.Vector2(r, y));
      const drumGeo = new THREE.LatheGeometry(pts, 28);
      const tex = mixerDrumTexture();
      const drumMat = new THREE.MeshStandardMaterial({ color: drumCol, roughness: 0.38, metalness: 0.3, map: tex });
      const pivot = group();
      pivot.position.set(-0.7, 2.25, 0);
      pivot.rotation.z = 0.19;          // the open end (rear, -x) is higher
      const drum = group();
      const drumMesh = mesh(drumGeo, drumCol);
      drumMesh.material = drumMat;
      drumMesh.rotation.z = Math.PI / 2;  // lathe axis (y) along -x..+x; the opening at -x
      drumMesh.rotation.y = Math.PI;
      drum.add(drumMesh);
      // Roller track ring at the back
      const ring = mesh(new THREE.TorusGeometry(0.66, 0.06, 8, 24), 0x334155, { metalness: 0.7 });
      ring.rotation.y = Math.PI / 2;
      drum.add(at(ring, -1.85, 0, 0));
      pivot.add(drum);
      b.add(pivot);
      // Drum supports: front pedestal and rear rollers frame
      b.add(at(mesh(new THREE.BoxGeometry(0.4, 1.3, 1.0), dark), 1.25, 1.65, 0));
      [-0.55, 0.55].forEach(z => b.add(rod([-2.6, 1.05, z], [-2.55, 2.55, z * 1.05], 0.08, dark)));
      // Hopper, collector and chute at the back
      const hop = mesh(new THREE.CylinderGeometry(0.62, 0.24, 0.6, 4, 1, true), 0x64748b, { side: THREE.DoubleSide, metalness: 0.5 });
      hop.rotation.y = Math.PI / 4;
      b.add(at(hop, -3.35, 3.0, 0));
      const load = mesh(new THREE.SphereGeometry(0.36, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x6f7276, { roughness: 0.35 });
      load.scale.set(1, 0.45, 1);
      load.visible = false;
      b.add(at(load, -3.35, 2.82, 0));
      const chute = group();
      chute.position.set(-3.45, 2.15, 0);
      const trough = mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.5, 12, 1, true, Math.PI / 2, Math.PI), 0x64748b, { side: THREE.DoubleSide, metalness: 0.5 });
      trough.rotation.z = Math.PI / 2 + 0.55;
      trough.position.set(-0.6, -0.4, 0);
      chute.add(trough);
      b.add(chute);
      // Ladder up to the hopper
      [-0.25, 0.25].forEach(z => b.add(rod([-3.75, 0.8, z + 0.8], [-3.65, 2.7, z + 0.8], 0.025, chrome)));
      for (let y = 1.0; y < 2.7; y += 0.3) b.add(rod([-3.72, y, 0.55], [-3.72, y, 1.05], 0.02, chrome));
      return miniature(b, { seat: { x: 2.85, y: 1.25 - KELO_SIT_OFFSET, z: -0.45 }, drum, loadMesh: load, chute });
    }

// Diagonal stripes so the turning drum is easy to see
function mixerDrumTexture() {
      if (PLANT_GEO.drumTex) return PLANT_GEO.drumTex;
      const c = document.createElement('canvas');
      c.width = 128; c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#f8fafc'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#ea580c';
      for (let i = -2; i < 4; i++) {
        g.beginPath();
        g.moveTo(i * 48, 0); g.lineTo(i * 48 + 22, 0); g.lineTo(i * 48 + 22 + 64, 128); g.lineTo(i * 48 + 64, 128);
        g.fill();
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(3, 1);
      PLANT_GEO.drumTex = t;
      return t;
    }

// The truck in his hands or on a counter
if (typeof ITEM_MODEL_RULES !== 'undefined') {
  ITEM_MODEL_RULES.unshift(
    [/concrete mixer truck|cement mixer truck|ready.?mix truck|transit mixer/, () => mixerTruckModel()],
    [/ready.?mix|load of (fresh |wet )?concrete/, () => {
      const g = group();
      const heap = mesh(new THREE.SphereGeometry(0.32, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x7b7e82, { roughness: 0.4 });
      heap.scale.set(1, 0.55, 1);
      const tray = mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.04, 18), 0x475569, { roughness: 0.9 });
      tray.position.y = -0.01;
      g.add(tray, heap);
      return g;
    }]
  );
}

// --- Smoke, steam and dust: a few soft sprites that rise and fade ----------------------------------
function plantPuffTexture() {
      if (PLANT_GEO.puff) return PLANT_GEO.puff;
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      grd.addColorStop(0, 'rgba(255,255,255,0.9)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0.35)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
      PLANT_GEO.puff = new THREE.CanvasTexture(c);
      return PLANT_GEO.puff;
    }

// A plume: `count` sprites cycling up from a point. color, rise (units/s), spread, size
function makePlantPlume(parent, color, { count = 14, rise = 1.2, spread = 0.6, size = 1.0, life = 4, opacity = 0.55, label = 'Steam' } = {}) {
      const mat = new THREE.SpriteMaterial({ map: plantPuffTexture(), color, transparent: true, opacity, depthWrite: false });
      const sprites = [];
      for (let i = 0; i < count; i++) {
        const s = new THREE.Sprite(mat.clone());
        s.visible = false;
        s.userData = { phase: i / count, plantLabel: label };
        parent.add(s);
        sprites.push(s);
      }
      return { sprites, origin: new THREE.Vector3(), rise, spread, size, life, opacity, on: false, level: 0 };
    }

function updatePlantPlume(p, t, dt, wind = 0.35) {
      // Fades by real time, so a slow frame rate doesn't keep it faint
      const now = performance.now() / 1000, real = Math.max(0, now - (p.lastT || now));
      p.lastT = now;
      p.level += ((p.on ? 1 : 0) - p.level) * Math.min(1, real * 1.5);
      p.sprites.forEach(s => {
        if (p.level < 0.02) { s.visible = false; return; }
        const u = ((t / p.life) + s.userData.phase) % 1;
        s.visible = true;
        const r = p.size * (0.4 + u * 1.6);
        s.scale.set(r, r, r);
        s.position.set(p.origin.x + u * p.life * wind * 0.6 + Math.sin(s.userData.phase * 20 + t) * p.spread * u,
          p.origin.y + u * p.life * p.rise, p.origin.z + Math.cos(s.userData.phase * 13) * p.spread * u);
        s.material.opacity = p.opacity * p.level * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85);
      });
    }

// --- Building and showing them ------------------------------------------------------------------
function showPlantDetail(kind, near) {
      if (!aggregatePlantGroup) return;
      if (near && !plantModels[kind]) {
        const built = kind === 'batch' ? buildBatchPlantModel() : buildAsphaltPlantModel();
        const o = plantSiteLocal(kind);
        built.root.position.set(o.x, aggregatePlantSite().y, o.z);
        built.root.userData.plantKind = kind;
        // Plumes live in the world group so they don't inherit anything odd
        const P = built.parts;
        P.plumes = {};
        if (kind === 'asphalt') {
          P.plumes.stack = makePlantPlume(built.root, 0xf8fafc, { count: 16, rise: 1.1, spread: 0.5, size: 1.3, life: 5, opacity: 0.6, label: 'Steam from the stack (water driven off the aggregate)' });
          P.plumes.stack.origin.copy(P.stackTop);
          P.plumes.truck = makePlantPlume(built.root, 0xe5e7eb, { count: 10, rise: 0.7, spread: 0.7, size: 0.8, life: 3, opacity: 0.5, label: 'Steam off the hot asphalt' });
          P.plumes.truck.origin.set(P.gateTip.x, 2.5, P.gateTip.z);
          P.plumes.flue = makePlantPlume(built.root, 0xcbd5e1, { count: 6, rise: 0.8, spread: 0.2, size: 0.5, life: 3, opacity: 0.35, label: 'Hot-oil heater exhaust' });
          P.plumes.flue.origin.copy(P.heaterFlue);
          P.plumes.silo = makePlantPlume(built.root, 0xe5e7eb, { count: 6, rise: 0.6, spread: 0.3, size: 0.6, life: 3, opacity: 0.35, label: 'Blue smoke from the hot silo' });
          P.plumes.silo.origin.copy(P.siloTop);
        } else {
          P.plumes.dust1 = makePlantPlume(built.root, 0xd6d3d1, { count: 8, rise: 0.5, spread: 0.4, size: 0.7, life: 3, opacity: 0.45, label: 'Cement dust (caught by the silo filter)' });
          P.plumes.dust1.origin.copy(P.silo1);
          P.plumes.dust2 = makePlantPlume(built.root, 0xd6d3d1, { count: 8, rise: 0.5, spread: 0.4, size: 0.7, life: 3, opacity: 0.45, label: 'Cement dust (caught by the silo filter)' });
          P.plumes.dust2.origin.copy(P.silo2);
          P.plumes.mix = makePlantPlume(built.root, 0xe7e5e4, { count: 8, rise: 0.4, spread: 0.6, size: 0.8, life: 2.5, opacity: 0.35, label: 'Dust and vapour from the mixer' });
          P.plumes.mix.origin.set(-3.1, 5.2, PLANT_LANE_Z);
        }
        aggregatePlantGroup.add(built.root);
        plantModels[kind] = built;
        if (plantStandInMeshes[kind]) plantStandInMeshes[kind].visible = false;
        plantShowStock(kind);
        if (typeof plantShowWear === 'function') plantShowWear();
      } else if (!near && plantModels[kind]) {
        const built = plantModels[kind];
        aggregatePlantGroup.remove(built.root);
        built.root.traverse(o => {
          if (o.isSprite) { o.material.dispose(); return; }  // sprites share one geometry: keep it
          if (!o.geometry) return;
          // unit geometries and shared materials stay; clones and one-offs go
          if (!Object.values(PLANT_GEO).includes(o.geometry)) o.geometry.dispose();
          if (o.isSprite) o.material.dispose();
          if (o.material && o.material.map && o.material.map.image === PLANT_GEO.beltCanvas) { o.material.map.dispose(); o.material.dispose(); }
        });
        plantModels[kind] = null;
        if (plantStandInMeshes[kind]) plantStandInMeshes[kind].visible = true;
      }
    }

// Bin and silo contents follow the stock in js/plants.js
function plantShowStock(kind) {
      const built = plantModels[kind];
      if (!built || typeof plantStockFraction !== 'function') return;
      (built.parts.binFill || []).forEach(({ mesh, key }) => {
        const f = Math.max(0, Math.min(1, plantStockFraction(kind, key)));
        mesh.visible = f > 0.02;
        if (kind === 'batch') {
          mesh.scale.y = 0.05 + f * 1.25;
          mesh.position.y = 1.75 + mesh.scale.y / 2;
        } else {
          mesh.scale.y = 0.15 + f * 0.85;
          mesh.position.y = 1.35 + f * 1.25;
        }
      });
    }

// The frame loop (from perf.js's watcher tick): conveyors, shafts, drum, flame, plumes, beacons
function updatePlantViz(kind) {
      const built = plantModels[kind];
      const now = performance.now() / 1000;
      const t = now;
      const dt = Math.min(0.1, Math.max(0.001, now - (built && built.lastT || now - 0.016)));
      if (!built) return;
      built.lastT = now;
      const v = plantViz[kind], P = built.parts;
      if (kind === 'batch') {
        if (P.belts[0] && v.weighBelt) P.belts[0].tex.offset.x -= dt * 1.8;
        if (P.belts[1] && v.incline) P.belts[1].tex.offset.x -= dt * 1.8;
        P.mixerShafts.forEach((s, i) => { if (v.mixer) s.rotation.x += (i ? -1 : 1) * dt * 4.5; });
        P.screws.forEach(s => { if (v.screw) s.rotation.y += dt * 6; });
        P.stream.visible = v.chute;
        if (v.chute) P.stream.scale.x = P.stream.scale.z = 0.9 + Math.sin(t * 17) * 0.1;
        P.plumes.dust1.on = v.dust && v.screw; P.plumes.dust2.on = v.dust;
        P.plumes.mix.on = v.mixer;
        Object.values(P.plumes).forEach(p => updatePlantPlume(p, t, dt));
      } else {
        P.belts.forEach((b, i) => {
          const on = i === 2 ? v.slat : i === 1 ? v.incline : v.feeders;
          if (on) b.tex.offset.x -= dt * (i === 2 ? 1.2 : 1.8);
        });
        if (v.drum) P.drum.rotation.x += dt * 1.6;
        if (P.screen) P.screen.position.y = 3.3 + (v.incline ? Math.sin(t * 40) * 0.015 : 0);
        P.pugShafts.forEach((s, i) => { if (v.pugmill) s.rotation.x += (i ? -1 : 1) * dt * 5; });
        P.flame.visible = v.burner;
        if (v.burner) {
          const f = 1 + Math.sin(t * 23) * 0.08 + Math.sin(t * 37) * 0.05;
          P.flame.scale.set(f, 1 + Math.sin(t * 29) * 0.07, 1 + Math.sin(t * 31) * 0.07);
        }
        P.glow.material.emissiveIntensity += ((v.burner ? 2.4 : 0) - P.glow.material.emissiveIntensity) * Math.min(1, dt * 3);
        P.stream.visible = v.gate;
        if (v.gate) P.stream.scale.x = P.stream.scale.z = 0.9 + Math.sin(t * 13) * 0.12;
        P.plumes.stack.on = v.fan;
        P.plumes.truck.on = v.steam;
        P.plumes.flue.on = v.heater;
        P.plumes.silo.on = v.slat || v.gate;
        Object.values(P.plumes).forEach(p => updatePlantPlume(p, t, dt));
      }
      // Beacons: green while running, amber blinking when a service is due
      const running = Object.values(v).some(Boolean);
      P.beaconGreen.material.emissiveIntensity = running ? 1.6 + Math.sin(t * 6) * 0.4 : 0;
      const due = typeof plantServiceDue === 'function' && plantServiceDue(kind);
      P.beaconAmber.material.emissiveIntensity = due ? (Math.sin(t * 5) > 0 ? 2.2 : 0.1) : 0;
    }

// The trucks move wherever they are, near the plant or not
let plantTrucksLast = 0;
function plantTrucksTick() {
      const now = performance.now() / 1000;
      const dt = Math.min(0.1, Math.max(0.001, now - (plantTrucksLast || now - 0.016)));
      plantTrucksLast = now;
      if (typeof plantTruckViz === 'function') plantTruckViz('any', now, dt);
    }

// Paint dulls and dust builds up with wear (js/plants.js knows the wear)
function plantShowWear() {
      const M = plantMats();
      const wear = typeof plantWearLevel === 'function' ? plantWearLevel() : { batch: 0, asphalt: 0 };
      const dust = new THREE.Color(0xa8a29e);
      M.frame.color.setHex(M.frame.userData.base).lerp(dust, Math.min(0.45, wear.batch * 0.45));
      M.white.color.setHex(M.white.userData.base).lerp(dust, Math.min(0.35, wear.batch * 0.35));
      M.orange.color.setHex(M.orange.userData.base).lerp(new THREE.Color(0x57534e), Math.min(0.4, wear.asphalt * 0.4));
    }

// --- Hover labels: every part says what it is ----------------------------------------------------
let plantHoverEl = null;
const plantRay = new THREE.Raycaster();
function plantHoverAt(clientX, clientY) {
      if (!aggregatePlantGroup || typeof renderer === 'undefined' || !renderer) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      plantRay.setFromCamera(ndc, camera);
      const targets = [aggregatePlantGroup];
      if (concretePourGroup) targets.push(concretePourGroup);
      const trucks = (state.vehicles || []).filter(v => v.kind === 'mixer' || (v.kind === 'truck' && v.hotMix)).map(v => vehicleMeshes[v.id]).filter(Boolean);
      const hits = plantRay.intersectObjects([...targets, ...trucks], true).filter(h => h.object.visible && !(h.object.isSprite));
      for (const h of hits) {
        const o = h.object;
        if (o.userData.perfStandIn) return o.parent === aggregatePlantGroup ? 'Kelo-1 concrete and asphalt plant' : null;
        if (o.isInstancedMesh && o.userData.labels && h.instanceId != null && o.userData.labels[h.instanceId]) return o.userData.labels[h.instanceId];
        let p = o;
        while (p) {
          if (p.userData && p.userData.plantLabel) return p.userData.plantLabel;
          if (p.userData && p.userData.pourId) return typeof concretePourLabel === 'function' ? concretePourLabel(p.userData.pourId) : 'Concrete';
          const veh = trucks.includes(p) && state.vehicles.find(v => vehicleMeshes[v.id] === p);
          if (veh) return typeof plantTruckLabel === 'function' ? plantTruckLabel(veh) : veh.name;
          p = p.parent;
        }
      }
      return null;
    }

function initPlantHover() {
      const vp = document.getElementById('dioramaViewport');
      if (!vp || typeof renderer === 'undefined' || !renderer) return;
      plantHoverEl = document.createElement('div');
      plantHoverEl.id = 'plantHoverLabel';
      plantHoverEl.style.cssText = 'position:absolute;z-index:30;pointer-events:none;display:none;max-width:280px;padding:4px 8px;border-radius:8px;background:rgba(15,23,42,0.92);border:1px solid rgba(148,163,184,0.5);color:#f8fafc;font:600 11px/1.35 Inter,system-ui,sans-serif;white-space:normal;box-shadow:0 4px 14px rgba(0,0,0,0.35)';
      vp.appendChild(plantHoverEl);
      let pending = null;
      const show = (e) => {
        pending = null;
        const label = plantHoverAt(e.clientX, e.clientY);
        if (!label) { plantHoverEl.style.display = 'none'; return; }
        const rect = vp.getBoundingClientRect();
        const status = typeof plantPartStatus === 'function' ? plantPartStatus(label) : '';
        plantHoverEl.textContent = status ? `${label} · ${status}` : label;
        plantHoverEl.style.display = 'block';
        plantHoverEl.style.left = `${Math.min(rect.width - 290, e.clientX - rect.left + 14)}px`;
        plantHoverEl.style.top = `${Math.max(4, e.clientY - rect.top - 30)}px`;
      };
      renderer.domElement.addEventListener('pointermove', e => {
        // Cheap: only near the plant or a pour, and at most every other frame
        if (pending) return;
        pending = requestAnimationFrame(() => show(e));
      });
      renderer.domElement.addEventListener('pointerleave', () => { if (plantHoverEl) plantHoverEl.style.display = 'none'; });
    }

// --- Concrete pours (paths and pads) -------------------------------------------------------------
// Stages: 'forms' (boards and stakes on a gravel base), 'pouring', 'poured' (wet, rough), 'screeded'
// (flat and glossy), then curing by world days: forms stripped after a day, grey lightening to cured.
function concretePourMesh(p, extent = 1) {
      const M = plantMats();
      const g = new THREE.Group();
      g.userData.pourId = p.id;
      const ang = Math.atan2(p.toX - p.x, p.toZ - p.z);
      const fullLen = Math.max(0.6, Math.hypot(p.toX - p.x, p.toZ - p.z));
      const len = fullLen * extent;
      const w = p.w || 1.2;
      const age = typeof concretePourAge === 'function' ? concretePourAge(p) : 0;   // world days since poured
      const stage = p.stage || 'cured';
      const formsUp = stage === 'forms' || stage === 'pouring' || stage === 'poured' || stage === 'screeded' || (stage === 'curing' && age < 1);
      const k = plantKit(g);
      const segs = Math.max(1, Math.ceil(fullLen / 0.8));
      const dir = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang)), side = new THREE.Vector3(Math.cos(ang), 0, -Math.sin(ang));
      const at = (d, s) => ({ x: p.x + dir.x * d + side.x * s, z: p.z + dir.z * d + side.z * s });
      // Gravel base under everything
      for (let i = 0; i < segs; i++) {
        const d = (i + 0.5) * fullLen / segs;
        const c = at(d, 0);
        const y = getIslandGroundHeight(c.x, c.z);
        k.box(M.gravel, w + 0.1, 0.04, fullLen / segs + 0.02, c.x, y + 0.02, c.z, 'Compacted gravel base', ang);
        if (formsUp) {
          [-1, 1].forEach(sd => {
            const e = at(d, sd * (w / 2 + 0.03));
            k.box(p.kind === 'pad' ? M.formSteel : M.form, 0.05, 0.16, fullLen / segs, e.x, y + 0.08, e.z, p.kind === 'pad' ? 'Steel form' : 'Form board (2×6)', ang);
            const st = at(d, sd * (w / 2 + 0.1));
            k.box(M.stake, 0.05, 0.32, 0.05, st.x, y + 0.12, st.z, 'Form stake', ang);
          });
        }
      }
      if (formsUp) [0, fullLen].forEach(d => {
        const e = at(d, 0);
        k.box(M.form, w + 0.1, 0.16, 0.05, e.x, getIslandGroundHeight(e.x, e.z) + 0.08, e.z, 'Form board (end)', ang);
      });
      k.flush();
      if (stage !== 'forms' && extent > 0) {
        // The slab itself: one box per segment so it follows the ground
        // Dark and wet when fresh, lightening to a pale grey as it cures (7 world days)
        const cured = stage === 'cured' ? 1 : Math.min(1, Math.max(0, age / 7));
        const curing = stage === 'curing' || stage === 'cured';
        const col = new THREE.Color(0x6a6e73).lerp(new THREE.Color(0xd9d5cc), curing ? Math.pow(cured, 0.55) : 0);
        const mat = new THREE.MeshStandardMaterial({ color: col, roughness: stage === 'poured' || stage === 'pouring' ? 0.5 : stage === 'screeded' ? 0.2 : 0.4 + cured * 0.5, metalness: 0 });
        const places = [], joints = [];
        const n = Math.max(1, Math.ceil(len / 0.8));
        for (let i = 0; i < n; i++) {
          const d = (i + 0.5) * len / n;
          const c = at(d, 0);
          const o = new THREE.Object3D();
          const rough = stage === 'pouring' || stage === 'poured';
          o.position.set(c.x, getIslandGroundHeight(c.x, c.z) + 0.1 + (rough ? Math.sin(i * 2.7) * 0.02 : 0), c.z);
          o.rotation.set(rough ? Math.sin(i * 1.3) * 0.03 : 0, ang, 0);
          o.scale.set(w, rough ? 0.12 : 0.1, len / n + 0.01);
          places.push(o);
        }
        // Control joints every 1.5 once it's finished
        if (stage === 'curing' || stage === 'cured' || stage === 'screeded') for (let d = 1.5; d < len - 0.2; d += 1.5) {
          const c = at(d, 0);
          const o = new THREE.Object3D();
          o.position.set(c.x, getIslandGroundHeight(c.x, c.z) + 0.151, c.z);
          o.rotation.y = ang;
          o.scale.set(w * 0.98, 0.005, 0.025);
          joints.push(o);
        }
        const slab = perfInstances(PLANT_GEO.box || plantUnitGeos().box, mat, places, { receiveShadow: true, castShadow: false });
        slab.userData.pourId = p.id;
        g.add(slab);
        if (joints.length) g.add(perfInstances(PLANT_GEO.box, M.dark, joints, {}));
        if (stage === 'screeded') {
          // A sheen of bleed water on top
          const sheen = new THREE.MeshStandardMaterial({ color: 0x9aa5b1, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.25 });
          const tops = places.map(o => { const q = o.clone(); q.position.y += 0.052; q.scale.y = 0.004; return q; });
          g.add(perfInstances(PLANT_GEO.box, sheen, tops, {}));
        }
      }
      return g;
    }

function renderConcretePour(p, extent = 1) {
      if (!concretePourGroup) return;
      removeConcretePourMesh(p.id);
      const m = concretePourMesh(p, extent);
      concretePourGroup.add(m);
      concretePourMeshes[p.id] = m;
    }

function removeConcretePourMesh(id) {
      const m = concretePourMeshes[id];
      if (!m) return;
      concretePourGroup.remove(m);
      const shared = Object.values(plantMats());
      m.traverse(o => { if (o.isInstancedMesh) { o.geometry.dispose(); if (!shared.includes(o.material)) o.material.dispose(); } });
      delete concretePourMeshes[id];
    }

// The look of a pour changes as it cures; redraw now and then
function refreshConcretePours() {
      (state.concretePours || []).forEach(p => {
        if (typeof concretePourActive !== 'undefined' && concretePourActive === p.id) return; // being worked on: the job draws it
        const m = concretePourMeshes[p.id];
        const key = `${p.stage}|${Math.floor((typeof concretePourAge === 'function' ? concretePourAge(p) : 0) * 4)}`;
        if (!m || m.userData.key !== key) {
          renderConcretePour(p);
          concretePourMeshes[p.id].userData.key = key;
        }
      });
    }

// --- Putting it in the world -----------------------------------------------------------------------
function initAggregatePlant3D() {
      if (typeof scene === 'undefined' || !scene || aggregatePlantGroup) return;
      plantUnitGeos();
      // The site is level ground now: no trees on it
      if (typeof valleyTrees !== 'undefined') valleyTrees.forEach(t => {
        if (!t.removed && inAggregatePlantSite(t.x, t.z, 1.2)) {
          scene.remove(t.group);
          worldObstacles = worldObstacles.filter(o => o !== t.obstacle);
          t.removed = true;
          t.hosting = true; // and never "chopped"
        }
      });
      if (typeof refreshTerrainAround === 'function') {
        const S = aggregatePlantSite();
        for (let x = S.x - S.w / 2; x <= S.x + S.w / 2; x += 4) refreshTerrainAround(x, S.z, S.d / 2 + PLANT_BLEND_NORTH);
      }
      aggregatePlantGroup = new THREE.Group();
      aggregatePlantGroup.name = 'aggregatePlant';
      aggregatePlantGroup.add(buildAggregatePlantGround());
      ['batch', 'asphalt'].forEach(kind => {
        const o = plantSiteLocal(kind);
        const s = plantStandIns(kind);
        s.position.set(o.x, aggregatePlantSite().y, o.z);
        aggregatePlantGroup.add(s);
        plantStandInMeshes[kind] = s;
        if (typeof perfWatchBuilding === 'function') {
          perfWatchBuilding({
            key: 'plant-' + kind,
            center: () => new THREE.Vector3(o.x, 4, o.z),
            radius: 8,
            forced: () => (typeof plantBusyWith === 'function' && plantBusyWith() === kind && Math.hypot(camera.position.x - o.x, camera.position.z - o.z) < 70),
            show: near => showPlantDetail(kind, near),
            tick: near => { if (near) updatePlantViz(kind); if (kind === 'batch') plantTrucksTick(); }
          });
        } else showPlantDetail(kind, true);
      });
      scene.add(aggregatePlantGroup);
      concretePourGroup = new THREE.Group();
      concretePourGroup.name = 'concretePours';
      scene.add(concretePourGroup);
      // Walk around the machines, not through them (the truck lane stays open)
      aggregatePlantObstacles().forEach(o => worldObstacles.push(o));
      refreshConcretePours();
      initPlantHover();
    }

// Obstacle circles for the solid parts (world coordinates)
function aggregatePlantObstacles() {
      const B = plantSiteLocal('batch'), A = plantSiteLocal('asphalt');
      const L = PLANT_LANE_Z, N = ASPHALT_NORTH_SHIFT;
      const b = [[-4.3, -1.25, 1.0], [-5.6, L, 1.0], [3.0, -1.5, 1.0], [4.6, -1.5, 1.0], [0.6, -0.75, 0.6], [-0.45, -0.95, 0.5], [1.4, -0.3, 0.35],
        [-2.8, -0.95, 0.65], [-1.5, -0.95, 0.65],
        [-4.3, L - 1.4, 0.25], [-1.7, L - 1.4, 0.25], [-4.3, L + 1.4, 0.25], [-1.7, L + 1.4, 0.25]];
      const a = [[-6.75, -1.85 + N, 0.95], [-5.55, -1.85 + N, 0.95], [-4.35, -1.85 + N, 0.95], [-2.2, -1.75 + N, 0.6], [0.6, -1.65 + N, 1.0], [2.2, -1.65 + N, 1.0], [3.7, -1.65 + N, 1.0], [5.2, -1.65 + N, 0.8],
        [1.5, -3.05 + N, 1.3], [5.35, -3.0 + N, 0.9], [3.35, -0.3, 0.9], [5.35, L - 0.1, 1.0], [-6.55, L - 0.5, 1.0], [-6.55, L + 0.6, 1.0],
        [-2.15, L - 1.3, 0.25], [-0.25, L - 1.3, 0.25], [-2.15, L + 1.3, 0.25], [-0.25, L + 1.3, 0.25]];
      // The water's edge around the plant's land: posts in the shallows (where the ground is under the
      // lake but dry land is close) so no path past the plant cuts through the water
      const shore = [];
      const wet = (x, z) => getAnalyticalGroundHeight(x, z) < WATER_LEVEL + 0.02;
      for (let x = 24; x <= WORLD_MAX_X + 1; x += 1.0) for (let z = 6; z <= PLANT_SHORE_Z + 3; z += 1.0) {
        if (!wet(x, z)) continue;
        if ([[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]].some(([dx, dz]) => !wet(x + dx, z + dz))) shore.push({ x, z, r: 0.55 });
      }
      return [...b.map(([x, z, r]) => ({ x: B.x + x, z: B.z + z, r })), ...a.map(([x, z, r]) => ({ x: A.x + x, z: A.z + z, r })), ...shore];
    }

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { try { initAggregatePlant3D(); } catch (e) { console.warn('aggregate plant 3D', e); } }, 400);
});
