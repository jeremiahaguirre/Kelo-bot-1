// Kelo-bot-1 — js/machinemodels.js
// Loaded after printer.js. The machines in his Workshop (js/workshopbuilding.js), built from shared
// materials and a few shared unit geometries (a mesh is a scaled unit box or cylinder), so even a
// shop full of machines stays light. Every model stands on its own floor at y = 0 with its front
// facing +z, sized in world units (about 1.6 a metre, a bit compact so a whole real shop fits).
// The moving parts each machine needs for its animation are kept in userData (gantry, head, bed,
// doors, spindle...); js/additive.js, js/cnc.js, js/electronics.js and js/garage.js move them.

const MM_GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 18),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  sphere: new THREE.SphereGeometry(1, 14, 10),
  torus: new THREE.TorusGeometry(1, 0.22, 8, 22),
  cone: new THREE.ConeGeometry(1, 1, 14)
};
Object.values(MM_GEO).forEach(g => { g.userData.sharedGeometry = true; });

// Every material is made once and shared by all the machines that use it
const MM_MAT_DEFS = {
  white: { color: 0xeef0f2, roughness: 0.5, metalness: 0.1 },
  grey: { color: 0xb8bec6, roughness: 0.45, metalness: 0.35 },
  haas: { color: 0xd2d5d9, roughness: 0.42, metalness: 0.25 },
  haasRed: { color: 0xc8102e, roughness: 0.5, metalness: 0.1 },
  dark: { color: 0x22272e, roughness: 0.55, metalness: 0.3 },
  black: { color: 0x0f1115, roughness: 0.6, metalness: 0.2 },
  steel: { color: 0x9aa3ad, roughness: 0.32, metalness: 0.85 },
  alu: { color: 0xc9ced4, roughness: 0.3, metalness: 0.8 },
  chrome: { color: 0xe5e7eb, roughness: 0.15, metalness: 0.95 },
  yellow: { color: 0xf4b400, roughness: 0.5, metalness: 0.15 },
  orange: { color: 0xf26b1d, roughness: 0.48, metalness: 0.1 },
  red: { color: 0xc62828, roughness: 0.5, metalness: 0.15 },
  blue: { color: 0x1d4ed8, roughness: 0.5, metalness: 0.2 },
  navy: { color: 0x1e3a5f, roughness: 0.5, metalness: 0.25 },
  green: { color: 0x15803d, roughness: 0.5, metalness: 0.15 },
  sienci: { color: 0x2fb04a, roughness: 0.45, metalness: 0.2 },
  teal: { color: 0x0f766e, roughness: 0.5, metalness: 0.2 },
  wcGrey: { color: 0x6b7f93, roughness: 0.5, metalness: 0.4 },
  rubber: { color: 0x16181b, roughness: 0.9, metalness: 0 },
  wood: { color: 0xc89b62, roughness: 0.8, metalness: 0 },
  ply: { color: 0xd9b27c, roughness: 0.8, metalness: 0 },
  mdf: { color: 0xa47f55, roughness: 0.92, metalness: 0 },
  bench: { color: 0x8a6a45, roughness: 0.75, metalness: 0 },
  concrete: { color: 0x9a9a94, roughness: 0.95, metalness: 0 },
  powder: { color: 0xe8e6df, roughness: 1, metalness: 0 },
  metalPowder: { color: 0x8e9298, roughness: 0.8, metalness: 0.6 },
  tiPowder: { color: 0x7b7f86, roughness: 0.75, metalness: 0.65 },
  pcb: { color: 0x166534, roughness: 0.5, metalness: 0.1 },
  copper: { color: 0xc77b3a, roughness: 0.3, metalness: 0.9 },
  brass: { color: 0xc9a227, roughness: 0.3, metalness: 0.9 },
  resin: { color: 0x8fb8d8, roughness: 0.2, metalness: 0.05, transparent: true, opacity: 0.75 },
  greyResin: { color: 0x8d9096, roughness: 0.35, metalness: 0.05 },
  glass: { color: 0xbfe3ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false },
  amberGlass: { color: 0xff8a1f, roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.45, depthWrite: false },
  yellowGlass: { color: 0xffd23f, roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.45, depthWrite: false },
  screen: { color: 0x0b1324, roughness: 0.3, metalness: 0.1, emissive: 0x2563eb, emissiveIntensity: 0.55 },
  lampGreen: { color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.9 },
  lampAmber: { color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.9 },
  lampRed: { color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.9 },
  stripe: { color: 0xfacc15, roughness: 0.6, metalness: 0 },
  hazard: { color: 0x111111, roughness: 0.6, metalness: 0 },
  fence: { color: 0xf4b400, roughness: 0.6, metalness: 0.2, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false },
  wax: { color: 0xfdf6e3, roughness: 0.7, metalness: 0 },
  paper: { color: 0xf5f0e1, roughness: 0.9, metalness: 0 },
  argon: { color: 0x3f6f4e, roughness: 0.45, metalness: 0.4 },
  oxygen: { color: 0x1f2937, roughness: 0.45, metalness: 0.4 },
  tire: { color: 0x1a1a1a, roughness: 0.95, metalness: 0 },
  oil: { color: 0x3b2a12, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 },
  sticker: { color: 0xffffff, roughness: 0.6 }
};
// Glowing things change brightness while a machine runs, so each machine gets its own copy
const MM_GLOW_DEFS = {
  uv: { color: 0x7c3aed, emissive: 0x8b5cf6, emissiveIntensity: 0 },
  laser: { color: 0xffffff, emissive: 0xfff3c4, emissiveIntensity: 0 },
  hot: { color: 0x7c2d12, emissive: 0xff6a00, emissiveIntensity: 0 },
  arc: { color: 0xffffff, emissive: 0xbfe0ff, emissiveIntensity: 0 },
  window: { color: 0x0b0f14, emissive: 0xfff1d6, emissiveIntensity: 0, roughness: 0.2 }
};
const MM_MATS = {};

function mmMat(key) {
      if (MM_MATS[key]) return MM_MATS[key];
      const def = MM_MAT_DEFS[key] || MM_MAT_DEFS.grey;
      const m = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.2, ...def });
      m.userData.keepMap = true;
      m.userData.shared = true;
      MM_MATS[key] = m;
      return m;
    }

function mmGlow(key) {
      const m = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0, ...(MM_GLOW_DEFS[key] || MM_GLOW_DEFS.hot) });
      m.userData.glowMax = { uv: 2.2, laser: 4, hot: 2.4, arc: 5, window: 0.9 }[key] || 2;
      return m;
    }

function mmMatOf(m) {
      return typeof m === 'string' ? mmMat(m) : m;
    }

// A box w x h x d, its bottom centre at (x, y, z) unless `centre` is set
function mmBox(parent, w, h, d, mat, x = 0, y = 0, z = 0, opts = {}) {
      const m = new THREE.Mesh(MM_GEO.box, mmMatOf(mat));
      m.scale.set(w, h, d);
      m.position.set(x, opts.centre ? y : y + h / 2, z);
      if (opts.rx) m.rotation.x = opts.rx;
      if (opts.ry) m.rotation.y = opts.ry;
      if (opts.rz) m.rotation.z = opts.rz;
      m.userData.sharedGeometry = true;
      if (parent) parent.add(m);
      return m;
    }

// A cylinder of radius r and length h along y (or x/z with axis), centred at (x, y, z)
function mmCyl(parent, r, h, mat, x = 0, y = 0, z = 0, opts = {}) {
      const m = new THREE.Mesh(opts.seg8 ? MM_GEO.cyl8 : MM_GEO.cyl, mmMatOf(mat));
      m.scale.set(r, h, opts.r2 || r);
      m.position.set(x, y, z);
      if (opts.axis === 'x') m.rotation.z = Math.PI / 2;
      if (opts.axis === 'z') m.rotation.x = Math.PI / 2;
      if (opts.rx) m.rotation.x = opts.rx;
      if (opts.rz) m.rotation.z = opts.rz;
      m.userData.sharedGeometry = true;
      if (parent) parent.add(m);
      return m;
    }

function mmSphere(parent, r, mat, x = 0, y = 0, z = 0) {
      const m = new THREE.Mesh(MM_GEO.sphere, mmMatOf(mat));
      m.scale.setScalar(r);
      m.position.set(x, y, z);
      m.userData.sharedGeometry = true;
      if (parent) parent.add(m);
      return m;
    }

function mmGroup(parent, x = 0, y = 0, z = 0) {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      if (parent) parent.add(g);
      return g;
    }

// A rod between two points
function mmRod(parent, a, b, r, mat) {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
      const len = va.distanceTo(vb);
      const m = new THREE.Mesh(MM_GEO.cyl8, mmMatOf(mat));
      m.scale.set(r, len, r);
      m.position.copy(va).add(vb).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
      m.userData.sharedGeometry = true;
      if (parent) parent.add(m);
      return m;
    }

// Small printed labels and logos (one canvas texture per distinct text, shared)
const MM_LABELS = {};
function mmLabel(parent, text, w, h, x, y, z, { bg = '#1f2937', fg = '#f8fafc', ry = 0 } = {}) {
      const key = `${text}|${bg}|${fg}|${w}|${h}`;
      let mat = MM_LABELS[key];
      if (!mat) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = Math.max(16, Math.round(256 * h / w));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = fg;
        ctx.font = `bold ${Math.round(canvas.height * 0.62)}px Inter, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1, canvas.width - 8);
        const tex = new THREE.CanvasTexture(canvas);
        tex.anisotropy = 4;
        mat = MM_LABELS[key] = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
        mat.userData.keepMap = true;
        mat.userData.shared = true;
      }
      const m = new THREE.Mesh(MM_GEO.box, mat);
      m.scale.set(w, h, 0.005);
      m.position.set(x, y, z);
      m.rotation.y = ry;
      m.userData.sharedGeometry = true;
      if (parent) parent.add(m);
      return m;
    }

// A status light tower (green, amber, red); userData.lights for the machine to switch
function mmLightTower(parent, x, y, z) {
      const g = mmGroup(parent, x, y, z);
      mmCyl(g, 0.012, 0.12, 'dark', 0, 0.06, 0);
      const lights = ['lampRed', 'lampAmber', 'lampGreen'].map((k, i) => {
        const m = mmCyl(g, 0.035, 0.05, mmGlow('hot'), 0, 0.15 + (2 - i) * 0.052, 0);
        m.material.color.copy(mmMat(k).color);
        m.material.emissive.copy(mmMat(k).emissive);
        m.material.emissiveIntensity = i === 2 ? 0.25 : 0.05;
        return m;
      });
      g.userData.lights = lights;
      return g;
    }

function mmSetTower(tower, mode) {
      if (!tower || !tower.userData.lights) return;
      const [r, a, gr] = tower.userData.lights;
      r.material.emissiveIntensity = mode === 'alarm' ? 1.4 : 0.05;
      a.material.emissiveIntensity = mode === 'wait' ? 1.2 : 0.05;
      gr.material.emissiveIntensity = mode === 'run' ? 1.4 : 0.25;
    }

// A touch screen on a little arm
function mmScreen(parent, w, h, x, y, z, ry = 0) {
      const g = mmGroup(parent, x, y, z);
      mmBox(g, w + 0.02, h + 0.02, 0.025, 'dark', 0, 0, 0, { centre: true });
      mmBox(g, w, h, 0.005, 'screen', 0, 0, 0.014, { centre: true });
      g.rotation.y = ry;
      return g;
    }

function mmFinish(g, name, extra = {}) {
      g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      g.userData.machineModel = name;
      Object.assign(g.userData, extra);
      return g;
    }

// --- Benches and stands ------------------------------------------------------------------------
function workBenchModel(w = 2.4, d = 0.8, top = 'bench') {
      const g = new THREE.Group();
      mmBox(g, w, 0.06, d, top, 0, 0.92, 0);
      [-1, 1].forEach(sx => [-1, 1].forEach(sz => mmBox(g, 0.06, 0.92, 0.06, 'dark', sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06))));
      mmBox(g, w - 0.1, 0.04, d - 0.1, 'dark', 0, 0.22, 0);
      // Pegboard with a few tools
      mmBox(g, w, 0.9, 0.03, 'mdf', 0, 0.98, -d / 2 + 0.015);
      for (let i = 0; i < 6; i++) mmBox(g, 0.04, 0.24, 0.02, i % 2 ? 'red' : 'steel', -w / 2 + 0.3 + i * (w - 0.6) / 5, 1.35, -d / 2 + 0.04);
      return mmFinish(g, 'bench', { top: 0.98 });
    }

// --- 3D printers ---------------------------------------------------------------------------------
// Original Prusa-style bed slinger: orange printed parts, black frame, a spool on top
function fdmPrinterModel() {
      const g = new THREE.Group();
      mmBox(g, 0.5, 0.06, 0.44, 'black', 0, 0, 0);
      const bed = mmGroup(g, 0, 0.09, 0);
      mmBox(bed, 0.3, 0.012, 0.3, 'dark', 0, 0, 0);
      mmBox(bed, 0.28, 0.004, 0.28, 'stripe', 0, 0.012, 0).material = mmMat('steel');
      [-0.2, 0.2].forEach(x => mmBox(g, 0.04, 0.5, 0.04, 'black', x, 0.06, -0.05));
      mmBox(g, 0.44, 0.04, 0.05, 'black', 0, 0.55, -0.05);
      const gantry = mmGroup(g, 0, 0.32, -0.05);
      mmBox(gantry, 0.42, 0.03, 0.03, 'alu', 0, 0, 0, { centre: true });
      const head = mmGroup(gantry, 0, 0, 0.03);
      mmBox(head, 0.07, 0.09, 0.06, 'orange', 0, -0.03, 0, { centre: true });
      mmCyl(head, 0.006, 0.03, 'brass', 0, -0.09, 0.01);
      mmBox(g, 0.12, 0.08, 0.02, 'orange', 0.17, 0.08, 0.2);
      mmScreen(g, 0.08, 0.05, 0.17, 0.11, 0.215);
      const spool = mmCyl(g, 0.09, 0.06, 'orange', 0, 0.64, -0.05, { axis: 'x' });
      mmCyl(g, 0.03, 0.07, 'black', 0, 0.64, -0.05, { axis: 'x' });
      return mmFinish(g, 'fdm', { bed, gantry, head, spool, plate: { y: 0.105 }, travel: { x: 0.12, z: 0.11 } });
    }

// Formlabs Form 3 style: grey base, an orange see-through cover, the build platform rises out of the resin tank
function slaPrinterModel(cover = 'amberGlass', base = 'grey', name = 'sla') {
      const g = new THREE.Group();
      mmBox(g, 0.38, 0.2, 0.38, base, 0, 0, 0);
      mmScreen(g, 0.12, 0.08, 0.1, 0.12, 0.195);
      const tank = mmBox(g, 0.24, 0.04, 0.2, 'resin', 0, 0.2, 0.02);
      const uv = mmBox(g, 0.18, 0.004, 0.16, mmGlow('uv'), 0, 0.2, 0.02);
      mmBox(g, 0.04, 0.42, 0.04, 'alu', 0, 0.2, -0.14);
      const platform = mmGroup(g, 0, 0.26, 0.02);
      mmBox(platform, 0.18, 0.015, 0.16, 'alu', 0, 0, 0);
      mmBox(platform, 0.03, 0.03, 0.18, 'alu', 0, 0.015, -0.08);
      const lid = mmBox(g, 0.38, 0.45, 0.38, cover, 0, 0.2, 0);
      return mmFinish(g, name, { tank, uv, platform, lid, plate: { y: -0.005 }, inverted: true });
    }

function dlpPrinterModel() {
      const g = slaPrinterModel('yellowGlass', 'white', 'dlp');
      mmLabel(g, 'DLP', 0.1, 0.035, -0.1, 0.12, 0.191, { bg: '#e5e7eb', fg: '#111827' });
      // The projector underneath shines up through the tank
      mmCyl(g, 0.03, 0.04, 'dark', 0, 0.1, 0.02);
      return g;
    }

function msslaPrinterModel() {
      const g = slaPrinterModel('yellowGlass', 'black', 'msla');
      mmLabel(g, 'SATURN', 0.14, 0.03, -0.08, 0.15, 0.191, { bg: '#0f1115', fg: '#e5e7eb' });
      return g;
    }

// Form Wash (a basket that dunks into IPA) and Form Cure (UV and heat on a turntable)
function washStationModel() {
      const g = new THREE.Group();
      mmBox(g, 0.3, 0.32, 0.3, 'grey', 0, 0, 0);
      mmBox(g, 0.26, 0.02, 0.26, 'resin', 0, 0.3, 0);
      const basket = mmGroup(g, 0, 0.36, 0);
      mmBox(basket, 0.18, 0.12, 0.18, 'steel', 0, 0, 0);
      mmBox(g, 0.04, 0.4, 0.04, 'alu', 0, 0.32, -0.12);
      mmLabel(g, 'WASH', 0.12, 0.03, 0, 0.18, 0.151, { bg: '#9ca3af', fg: '#111827' });
      return mmFinish(g, 'wash', { basket, plate: { y: 0.12 } });
    }

function cureStationModel() {
      const g = new THREE.Group();
      mmBox(g, 0.32, 0.06, 0.32, 'grey', 0, 0, 0);
      const table = mmCyl(g, 0.11, 0.015, 'steel', 0, 0.07, 0);
      const glow = mmBox(g, 0.28, 0.3, 0.28, mmGlow('uv'), 0, 0.06, 0);
      glow.material.transparent = true;
      glow.material.opacity = 0.35;
      mmBox(g, 0.32, 0.34, 0.32, 'amberGlass', 0, 0.06, 0);
      mmLabel(g, 'CURE', 0.12, 0.03, 0, 0.03, 0.161, { bg: '#9ca3af', fg: '#111827' });
      return mmFinish(g, 'cure', { table, glow, plate: { y: 0.08 } });
    }

// A powder-bed cabinet: SLS, DMLS/SLM, EBM. A window looks onto the build: the recoater sweeps
// fresh powder, the platform drops a layer, the laser (or beam) traces the part.
function powderBedCabinet(w, h, d, body, accent, opts = {}) {
      const g = new THREE.Group();
      mmBox(g, w, h, d, body, 0, 0, 0);
      mmBox(g, w + 0.02, 0.06, d + 0.02, accent, 0, h - 0.12, 0);
      // The build chamber window
      const winY = opts.winY || h * 0.45, winW = opts.winW || w * 0.45, winH = opts.winH || h * 0.25;
      const window = mmBox(g, winW, winH, 0.01, mmGlow('window'), opts.winX || 0, winY, d / 2 + 0.002);
      mmBox(g, winW + 0.06, winH + 0.06, 0.012, 'dark', opts.winX || 0, winY - 0.03, d / 2 - 0.002);
      // The chamber inside, seen through the window: powder bed, recoater, part and the laser dot
      const chamber = mmGroup(g, opts.winX || 0, winY + 0.02, d / 2 - 0.08);
      const bed = mmBox(chamber, winW * 0.8, 0.012, 0.12, opts.powder || 'powder', 0, 0, 0);
      const recoater = mmBox(chamber, 0.02, 0.03, 0.13, 'steel', -winW * 0.4, 0.012, 0);
      const dot = mmSphere(chamber, 0.012, mmGlow(opts.beam || 'laser'), 0, 0.016, 0);
      const plate = { y: 0.012 };
      mmScreen(g, 0.16, 0.11, w / 2 - 0.15, h * 0.62, d / 2 + 0.03);
      const tower = mmLightTower(g, -w / 2 + 0.08, h, -d / 2 + 0.08);
      return { g, window, chamber, bed, recoater, dot, plate, tower, winW };
    }

function slsPrinterModel() {
      const c = powderBedCabinet(1.0, 1.55, 0.85, 'white', 'orange');
      mmLabel(c.g, 'FORMIGA P 110', 0.42, 0.06, -0.1, 1.3, 0.426, { bg: '#f8fafc', fg: '#ea580c' });
      // Its unpacking and sieving station next door
      mmBox(c.g, 0.28, 0.9, 0.4, 'grey', 0.66, 0, 0.1);
      return mmFinish(c.g, 'sls', { ...c, w: 1.0, d: 0.85 });
    }

function dmlsPrinterModel() {
      const c = powderBedCabinet(1.6, 1.75, 0.95, 'haas', 'navy', { winX: -0.15, winW: 0.6, powder: 'metalPowder' });
      mmLabel(c.g, 'EOS M 290', 0.38, 0.07, 0.35, 1.45, 0.476, { bg: '#e5e7eb', fg: '#1e3a5f' });
      // The glove ports for handling the powder under argon
      [-0.35, 0.05].forEach(x => { mmCyl(c.g, 0.07, 0.04, 'black', x, 0.55, 0.48, { axis: 'z' }); mmCyl(c.g, 0.05, 0.05, 'rubber', x, 0.55, 0.5, { axis: 'z' }); });
      // Argon supply: two cylinders on a rack and the gas line into the chamber
      const gas = mmGroup(c.g, 1.05, 0, -0.1);
      [-0.13, 0.13].forEach(z => {
        mmCyl(gas, 0.1, 1.05, 'argon', 0, 0.53, z);
        mmSphere(gas, 0.1, 'argon', 0, 1.05, z);
        mmCyl(gas, 0.02, 0.08, 'brass', 0, 1.17, z);
      });
      const gauge = mmCyl(gas, 0.04, 0.02, 'white', 0, 1.24, 0, { axis: 'z' });
      mmRod(c.g, [1.05, 1.22, -0.1], [0.8, 1.4, -0.1], 0.012, 'copper');
      mmBox(gas, 0.3, 0.04, 0.5, 'dark', 0, 0, 0);
      return mmFinish(c.g, 'dmls', { ...c, w: 1.6, d: 0.95, gauge });
    }

function ebmPrinterModel() {
      const c = powderBedCabinet(1.2, 1.9, 0.95, 'dark', 'teal', { powder: 'tiPowder', beam: 'arc', winH: 0.32 });
      mmLabel(c.g, 'ARCAM Q10', 0.36, 0.07, 0.1, 1.62, 0.476, { bg: '#111827', fg: '#5eead4' });
      // The electron gun column on top and the vacuum pump beside it
      mmCyl(c.g, 0.16, 0.4, 'steel', 0, 2.1, -0.05);
      mmCyl(c.g, 0.1, 0.12, 'dark', 0, 2.36, -0.05);
      const pump = mmGroup(c.g, 0.82, 0, 0.1);
      mmBox(pump, 0.36, 0.42, 0.42, 'teal', 0, 0, 0);
      mmCyl(pump, 0.12, 0.32, 'steel', 0, 0.58, 0);
      mmRod(c.g, [0.82, 0.74, 0.1], [0.6, 1.2, 0.1], 0.035, 'steel');
      const vac = mmCyl(c.g, 0.035, 0.02, 'white', -0.4, 1.0, 0.48, { axis: 'z' });
      return mmFinish(c.g, 'ebm', { ...c, w: 1.2, d: 0.95, vac });
    }

// HP Jet Fusion 5200: a long two-tone printer, the build unit trolley, and the processing station
function mjfPrinterModel() {
      const g = new THREE.Group();
      mmBox(g, 1.5, 1.15, 0.8, 'white', 0, 0, 0);
      mmBox(g, 1.5, 0.35, 0.8, 'black', 0, 1.15, 0);
      mmBox(g, 1.52, 0.04, 0.82, 'dark', 0, 1.13, 0);
      const window = mmBox(g, 0.62, 0.22, 0.01, mmGlow('window'), -0.25, 1.2, 0.402);
      const chamber = mmGroup(g, -0.25, 1.17, 0.32);
      const bed = mmBox(chamber, 0.5, 0.012, 0.1, 'powder', 0, 0, 0);
      const carriage = mmBox(chamber, 0.04, 0.05, 0.11, 'dark', -0.25, 0.015, 0);
      const dot = mmBox(chamber, 0.03, 0.04, 0.11, mmGlow('hot'), 0.25, 0.015, 0);
      mmLabel(g, 'HP Jet Fusion 5200', 0.5, 0.05, 0.4, 1.3, 0.402, { bg: '#0f1115', fg: '#e5e7eb' });
      mmScreen(g, 0.16, 0.1, 0.55, 0.95, 0.43);
      // Agent cartridges behind a door on the side
      ['#1f2937', '#22d3ee', '#22d3ee', '#1f2937'].forEach((c, i) => mmBox(g, 0.06, 0.14, 0.02, i % 3 ? 'teal' : 'black', 0.3 + i * 0.08, 0.55, 0.402));
      const tower = mmLightTower(g, -0.68, 1.5, -0.3);
      // The build unit trolley it prints into
      const unit = mmGroup(g, 0, 0, 0.75);
      mmBox(unit, 0.5, 0.6, 0.45, 'grey', 0, 0.06, 0);
      [-0.2, 0.2].forEach(x => [-0.18, 0.18].forEach(z => mmCyl(unit, 0.04, 0.04, 'rubber', x, 0.04, z, { axis: 'x' })));
      unit.visible = false;
      return mmFinish(g, 'mjf', { window, chamber, bed, recoater: carriage, dot, tower, unit, plate: { y: 0.012 }, winW: 0.62, w: 1.5, d: 0.8 });
    }

function mjfStationModel() {
      const g = new THREE.Group();
      mmBox(g, 1.0, 1.3, 0.75, 'white', 0, 0, 0);
      mmBox(g, 1.0, 0.25, 0.75, 'black', 0, 1.3, 0);
      mmBox(g, 0.5, 0.35, 0.01, 'glass', -0.12, 0.85, 0.38);
      const brush = mmGroup(g, -0.12, 0.85, 0.32);
      mmBox(brush, 0.02, 0.2, 0.02, 'steel', 0, 0, 0);
      mmLabel(g, 'PROCESSING STATION', 0.4, 0.04, -0.1, 1.42, 0.376, { bg: '#0f1115', fg: '#e5e7eb' });
      mmScreen(g, 0.14, 0.09, 0.34, 0.85, 0.4);
      return mmFinish(g, 'mjfstation', { brush, w: 1.0, d: 0.75 });
    }

// Stratasys J850 PolyJet: a big white printer with a grey lid; the print block sweeps over the tray
function polyjetPrinterModel() {
      const g = new THREE.Group();
      mmBox(g, 1.35, 0.95, 0.9, 'white', 0, 0, 0);
      mmBox(g, 1.35, 0.1, 0.9, 'grey', 0, 0.95, 0);
      const lid = mmBox(g, 1.2, 0.28, 0.8, 'glass', 0, 1.05, 0);
      const tray = mmGroup(g, 0, 1.06, 0);
      mmBox(tray, 0.8, 0.012, 0.5, 'dark', 0, 0, 0);
      const block = mmGroup(g, -0.35, 1.18, 0);
      mmBox(block, 0.16, 0.1, 0.52, 'grey', 0, 0, 0);
      const lamp = mmBox(block, 0.04, 0.03, 0.5, mmGlow('uv'), 0.1, -0.02, 0);
      mmLabel(g, 'stratasys J850', 0.42, 0.06, -0.3, 0.7, 0.451, { bg: '#f8fafc', fg: '#0f172a' });
      mmScreen(g, 0.18, 0.12, 0.45, 0.78, 0.47);
      // Material cabinet with the photopolymer cartridges
      ['teal', 'red', 'yellow', 'white', 'black', 'grey'].forEach((c, i) => mmBox(g, 0.12, 0.3, 0.02, c, -0.55 + i * 0.15, 0.2, 0.452));
      const tower = mmLightTower(g, 0.6, 1.05, -0.38);
      return mmFinish(g, 'polyjet', { lid, tray, block, lamp, tower, plate: { y: 0.012 }, w: 1.35, d: 0.9 });
    }

// Waterjet support-removal booth (PolyJet support comes off under a pressure washer)
function waterjetBoothModel() {
      const g = new THREE.Group();
      mmBox(g, 0.8, 0.85, 0.6, 'grey', 0, 0, 0);
      mmBox(g, 0.8, 0.5, 0.6, 'glass', 0, 0.85, 0);
      mmBox(g, 0.82, 0.04, 0.62, 'dark', 0, 1.35, 0);
      [-0.18, 0.18].forEach(x => mmCyl(g, 0.06, 0.06, 'rubber', x, 1.0, 0.31, { axis: 'z' }));
      const nozzle = mmGroup(g, 0, 1.2, 0);
      mmCyl(nozzle, 0.012, 0.18, 'steel', 0, 0, 0);
      mmLabel(g, 'SUPPORT REMOVAL', 0.4, 0.05, 0, 0.7, 0.301, { bg: '#1e3a5f', fg: '#e0f2fe' });
      return mmFinish(g, 'waterjet', { nozzle, plate: { y: 0.92 }, w: 0.8, d: 0.6 });
    }

// ExOne-style binder jet: a grey cabinet with a yellow gantry, and the sintering furnace
function binderJetModel() {
      const c = powderBedCabinet(1.1, 1.45, 0.85, 'grey', 'yellow', { powder: 'metalPowder', beam: 'laser' });
      c.dot.visible = false;
      mmLabel(c.g, 'ExOne InnoventX', 0.44, 0.06, 0, 1.2, 0.426, { bg: '#e5e7eb', fg: '#111827' });
      // Binder bottle on the side
      mmCyl(c.g, 0.07, 0.24, 'white', 0.62, 0.12, 0.2);
      mmCyl(c.g, 0.03, 0.04, 'blue', 0.62, 0.26, 0.2);
      return mmFinish(c.g, 'binder', { ...c, w: 1.1, d: 0.85 });
    }

function furnaceModel(name = 'furnace', label = 'SINTER / HEAT TREAT') {
      const g = new THREE.Group();
      mmBox(g, 0.95, 1.25, 0.85, 'dark', 0, 0, 0);
      mmBox(g, 0.97, 0.06, 0.87, 'red', 0, 1.25, 0);
      const inside = mmBox(g, 0.5, 0.42, 0.02, mmGlow('hot'), 0, 0.55, 0.41);
      const door = mmGroup(g, -0.3, 0.5, 0.44);
      mmBox(door, 0.62, 0.55, 0.05, 'grey', 0.3, 0, 0);
      mmCyl(door, 0.02, 0.2, 'chrome', 0.55, 0.28, 0.04);
      mmLabel(g, label, 0.5, 0.06, 0, 1.12, 0.426, { bg: '#111827', fg: '#fbbf24' });
      const temp = mmLabel(g, '20 C', 0.16, 0.06, 0.32, 0.95, 0.428, { bg: '#020617', fg: '#f87171' });
      mmRod(g, [0.3, 1.3, -0.2], [0.3, 1.9, -0.2], 0.05, 'steel');
      return mmFinish(g, name, { inside, door, temp, plate: { y: 0.35 }, w: 0.95, d: 0.85 });
    }

// A robot cell for DED: safety fence, a six-axis arm with a deposition head, a positioner and a wire feeder
function dedCellModel() {
      const g = new THREE.Group();
      // Fence panels (open at the front for the view, with a gate)
      [[-0.95, 0, 0, 1.9], [0.95, 0, 0, 1.9], [0, -0.95, 1.9, 0]].forEach(([x, z, w, d]) => {
        mmBox(g, w || 0.03, 1.5, d || 0.03, 'fence', x, 0.05, z);
        mmBox(g, w || 0.05, 0.05, d || 0.05, 'yellow', x, 1.55, z);
      });
      [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]].forEach(([x, z]) => mmBox(g, 0.05, 1.6, 0.05, 'yellow', x, 0, z));
      // Positioner table with the part being built up
      mmCyl(g, 0.22, 0.5, 'dark', 0.35, 0.25, 0.2);
      const table = mmCyl(g, 0.26, 0.04, 'steel', 0.35, 0.52, 0.2);
      // The arm
      const base = mmGroup(g, -0.4, 0, -0.35);
      mmCyl(base, 0.16, 0.24, 'orange', 0, 0.12, 0);
      const turret = mmGroup(base, 0, 0.24, 0);
      mmCyl(turret, 0.13, 0.16, 'orange', 0, 0.08, 0);
      const shoulder = mmGroup(turret, 0, 0.2, 0);
      mmBox(shoulder, 0.1, 0.62, 0.1, 'orange', 0, 0, 0);
      const elbow = mmGroup(shoulder, 0, 0.62, 0);
      mmCyl(elbow, 0.07, 0.14, 'orange', 0, 0, 0, { axis: 'z' });
      mmBox(elbow, 0.5, 0.08, 0.08, 'orange', 0.25, -0.04, 0);
      const wrist = mmGroup(elbow, 0.5, 0, 0);
      mmCyl(wrist, 0.05, 0.1, 'dark', 0, 0, 0, { axis: 'z' });
      const torch = mmGroup(wrist, 0, 0, 0);
      mmCyl(torch, 0.035, 0.22, 'copper', 0, -0.11, 0);
      mmCyl(torch, 0.02, 0.06, 'brass', 0, -0.25, 0);
      const tip = mmSphere(torch, 0.03, mmGlow('arc'), 0, -0.29, 0);
      // Wire feeder and shielding gas
      mmBox(g, 0.3, 0.3, 0.25, 'blue', -0.65, 0, 0.55);
      mmCyl(g, 0.12, 0.08, 'copper', -0.65, 0.42, 0.55, { axis: 'z' });
      mmCyl(g, 0.09, 0.95, 'argon', -0.75, 0.48, 0.82);
      mmSphere(g, 0.09, 'argon', -0.75, 0.95, 0.82);
      mmLabel(g, 'DED CELL', 0.4, 0.07, 0, 1.3, -0.93, { bg: '#111827', fg: '#facc15' });
      const tower = mmLightTower(g, 0.95, 1.6, -0.95);
      return mmFinish(g, 'ded', { turret, shoulder, elbow, wrist, torch, tip, table, tower, plate: { y: 0.54, x: 0.35, z: 0.2 }, w: 1.9, d: 1.9 });
    }

// LOM: a roll of paper feeds across the bed, a knife plotter cuts each glued sheet
function lomPrinterModel() {
      const g = new THREE.Group();
      mmBox(g, 0.7, 0.32, 0.5, 'white', 0, 0, 0);
      mmBox(g, 0.7, 0.24, 0.5, 'glass', 0, 0.32, 0);
      mmBox(g, 0.72, 0.03, 0.52, 'grey', 0, 0.56, 0);
      const roll = mmCyl(g, 0.07, 0.5, 'paper', -0.42, 0.42, 0, { axis: 'z' });
      const sheet = mmBox(g, 0.5, 0.004, 0.36, 'paper', 0, 0.33, 0);
      const stack = mmGroup(g, 0.05, 0.33, 0);
      const gantry = mmGroup(g, 0, 0.48, 0);
      mmBox(gantry, 0.04, 0.03, 0.44, 'dark', 0, 0, 0);
      const knife = mmGroup(gantry, 0, -0.05, 0);
      mmBox(knife, 0.04, 0.06, 0.04, 'orange', 0, 0, 0);
      mmCyl(knife, 0.005, 0.04, 'chrome', 0, -0.04, 0);
      mmLabel(g, 'Mcor LOM', 0.22, 0.04, 0.2, 0.16, 0.251, { bg: '#f8fafc', fg: '#0f172a' });
      return mmFinish(g, 'lom', { roll, sheet, stack, gantry, knife, plate: { y: 0.335, x: 0.05 }, w: 0.7, d: 0.5 });
    }

// Depowdering station (glove box with an air nozzle) and a bead-blast cabinet
function depowderStationModel() {
      const g = new THREE.Group();
      mmBox(g, 0.9, 0.8, 0.6, 'blue', 0, 0, 0);
      mmBox(g, 0.9, 0.5, 0.6, 'glass', 0, 0.8, 0);
      mmBox(g, 0.92, 0.04, 0.62, 'dark', 0, 1.3, 0);
      [-0.2, 0.2].forEach(x => mmCyl(g, 0.07, 0.06, 'rubber', x, 0.98, 0.31, { axis: 'z' }));
      const nozzle = mmGroup(g, 0, 1.1, 0);
      mmCyl(nozzle, 0.01, 0.16, 'steel', 0, 0, 0, { rz: 0.6 });
      mmLabel(g, 'DEPOWDER', 0.3, 0.05, 0, 0.66, 0.301, { bg: '#1e3a8a', fg: '#e0f2fe' });
      return mmFinish(g, 'depowder', { nozzle, plate: { y: 0.86 }, w: 0.9, d: 0.6 });
    }

function beadBlastModel() {
      const g = new THREE.Group();
      [-0.32, 0.32].forEach(x => mmBox(g, 0.06, 0.75, 0.5, 'dark', x, 0, 0));
      mmBox(g, 0.9, 0.55, 0.6, 'grey', 0, 0.75, 0);
      mmBox(g, 0.55, 0.2, 0.01, 'glass', 0, 1.3, 0.2, { rx: -0.6 });
      mmBox(g, 0.9, 0.1, 0.6, 'grey', 0, 1.3, -0.05, { rx: -0.6 });
      [-0.18, 0.18].forEach(x => mmCyl(g, 0.06, 0.06, 'rubber', x, 1.0, 0.31, { axis: 'z' }));
      const nozzle = mmGroup(g, 0, 1.05, 0);
      mmCyl(nozzle, 0.012, 0.15, 'steel', 0, 0, 0, { rz: 0.5 });
      mmLabel(g, 'BEAD BLAST', 0.32, 0.05, 0, 0.95, 0.301, { bg: '#374151', fg: '#f9fafb' });
      return mmFinish(g, 'beadblast', { nozzle, plate: { y: 0.82 }, w: 0.9, d: 0.6 });
    }

// Wire EDM (cuts the part off the build plate) and a horizontal bandsaw
function wireEdmModel() {
      const g = new THREE.Group();
      mmBox(g, 1.0, 0.85, 0.85, 'white', 0, 0, 0);
      const tank = mmBox(g, 0.7, 0.2, 0.55, 'resin', 0, 0.85, 0.05);
      mmBox(g, 0.18, 0.95, 0.2, 'blue', 0, 0.85, -0.35);
      mmBox(g, 0.12, 0.08, 0.5, 'blue', 0, 1.7, -0.12);
      const head = mmGroup(g, 0, 1.6, 0.05);
      mmBox(head, 0.1, 0.12, 0.1, 'dark', 0, 0, 0);
      const wire = mmCyl(head, 0.003, 0.6, 'brass', 0, -0.3, 0);
      const spark = mmSphere(head, 0.02, mmGlow('arc'), 0, -0.52, 0);
      mmLabel(g, 'SODICK WIRE EDM', 0.44, 0.05, 0, 0.6, 0.426, { bg: '#f8fafc', fg: '#1e3a8a' });
      mmScreen(g, 0.16, 0.1, 0.55, 1.2, 0.3, -0.4);
      return mmFinish(g, 'edm', { head, wire, spark, tank, plate: { y: 0.95 }, w: 1.0, d: 0.85 });
    }

function bandsawModel() {
      const g = new THREE.Group();
      mmBox(g, 0.9, 0.6, 0.4, 'blue', 0, 0, 0);
      mmBox(g, 0.85, 0.05, 0.35, 'steel', 0, 0.6, 0);
      const arm = mmGroup(g, -0.35, 0.72, 0);
      mmBox(arm, 0.8, 0.22, 0.12, 'blue', 0.4, 0.1, -0.05);
      mmCyl(arm, 0.12, 0.05, 'dark', 0.05, 0.1, 0.02, { axis: 'z' });
      mmCyl(arm, 0.12, 0.05, 'dark', 0.75, 0.1, 0.02, { axis: 'z' });
      const blade = mmBox(arm, 0.65, 0.02, 0.004, 'chrome', 0.4, -0.02, 0.05);
      mmLabel(g, 'BANDSAW', 0.24, 0.05, 0, 0.3, 0.201, { bg: '#1d4ed8', fg: '#ffffff' });
      return mmFinish(g, 'bandsaw', { arm, blade, plate: { y: 0.63 }, w: 0.9, d: 0.4 });
    }

// --- CNC routers -----------------------------------------------------------------------------------
// A gantry router: a frame on legs, an MDF spoilboard, the gantry riding the long rails, a Z carriage
// with the spindle and its dust shoe. colours: frame, gantry, accent; spec: w (along x), d, heavy, atc.
function cncRouterModel(spec) {
      const { w, d, frame, gantryMat, accent, logo, logoBg = '#111827', logoFg = '#f8fafc', heavy = false, atc = false, vacuum = false } = spec;
      const g = new THREE.Group();
      const legH = 0.72, railH = heavy ? 0.18 : 0.14, railW = heavy ? 0.2 : 0.14;
      // Base frame: a welded or bolted table on legs with cross members and levelling feet
      const legs = heavy ? [-1, -0.33, 0.33, 1] : [-1, 0, 1];
      legs.forEach(fx => [-1, 1].forEach(sz => {
        const x = fx * (w / 2 - 0.1), z = sz * (d / 2 - 0.1);
        mmBox(g, heavy ? 0.14 : 0.1, legH, heavy ? 0.14 : 0.1, frame, x, 0, z);
        mmCyl(g, 0.06, 0.03, 'dark', x, 0.015, z);
      }));
      [-1, 1].forEach(sz => mmBox(g, w, 0.1, 0.1, frame, 0, 0.2, sz * (d / 2 - 0.1)));
      for (let i = 0; i < 4; i++) mmBox(g, 0.08, 0.08, d - 0.2, frame, -w / 2 + 0.25 + i * (w - 0.5) / 3, 0.2, 0);
      // The table top: the long side rails with linear guides and gear racks the gantry drives on
      [-1, 1].forEach(sz => {
        const z = sz * (d / 2 - railW / 2);
        mmBox(g, w, railH, railW, frame, 0, legH, z);
        mmBox(g, w - 0.1, 0.03, 0.04, 'chrome', 0, legH + railH, z - sz * 0.02);   // linear guide
        mmBox(g, w - 0.1, 0.03, 0.015, 'brass', 0, legH + railH - 0.05, z + sz * (railW / 2 + 0.008)); // gear rack
      });
      [-1, 1].forEach(sx => mmBox(g, 0.1, railH, d, frame, sx * (w / 2 - 0.05), legH, 0));
      // Spoilboard (MDF with T-tracks) or a vacuum table (grid, zones, plenum)
      const bed = mmBox(g, w - 0.2, 0.05, d - railW * 2 - 0.04, vacuum ? 'dark' : 'mdf', 0, legH + 0.05, 0);
      const bedTop = legH + 0.1;
      if (vacuum) {
        for (let i = -6; i <= 6; i++) mmBox(g, 0.01, 0.004, d - railW * 2 - 0.1, 'grey', i * (w - 0.3) / 13, bedTop - 0.002, 0);
        for (let i = -3; i <= 3; i++) mmBox(g, w - 0.3, 0.004, 0.01, 'grey', 0, bedTop - 0.002, i * (d - 0.4) / 7);
        mmBox(g, 0.4, 0.35, 0.35, 'dark', w / 2 - 0.4, 0.25, 0); // vacuum pump under the table
      } else {
        for (let i = -2; i <= 2; i++) mmBox(g, 0.035, 0.008, d - railW * 2 - 0.1, 'alu', i * (w - 0.4) / 5, bedTop - 0.003, 0);
      }
      // The gantry: two upright side plates on bearing blocks, the beam across with its rail, the X motors
      const gantry = mmGroup(g, 0, legH + railH, 0);
      const plateH = heavy ? 0.75 : 0.66, beamY = plateH - 0.12;
      [-1, 1].forEach(sz => {
        const z = sz * (d / 2 - railW / 2);
        mmBox(gantry, 0.34, 0.06, railW + 0.06, 'dark', 0, 0, z);            // bearing carriage
        mmBox(gantry, heavy ? 0.36 : 0.3, plateH, 0.05, gantryMat, 0, 0.06, z + sz * 0.05); // side plate
        mmBox(gantry, 0.11, 0.11, 0.11, accent, -0.16, 0.12, z + sz * 0.13);   // X motor and pinion
      });
      mmBox(gantry, heavy ? 0.26 : 0.2, heavy ? 0.3 : 0.24, d + 0.1, gantryMat, 0, beamY, 0);
      mmBox(gantry, 0.02, 0.05, d - 0.2, 'chrome', 0.11 + (heavy ? 0.03 : 0), beamY + 0.04, 0);   // Y guide
      mmBox(gantry, 0.02, 0.05, d - 0.2, 'chrome', 0.11 + (heavy ? 0.03 : 0), beamY + 0.16, 0);
      if (logo) mmLabel(gantry, logo, Math.min(1.0, d * 0.55), 0.1, -0.11 - (heavy ? 0.03 : 0), beamY + 0.12, 0, { bg: logoBg, fg: logoFg, ry: -Math.PI / 2 });
      // Cable chain riding over the beam to the carriage
      const chain = mmGroup(gantry, -0.02, beamY + (heavy ? 0.32 : 0.26), 0);
      for (let i = 0; i < 14; i++) mmBox(chain, 0.07, 0.05, (d - 0.3) / 14 * 0.85, 'black', 0, 0, -d / 2 + 0.15 + (i + 0.5) * (d - 0.3) / 14);
      // The Z carriage: a plate on the beam's guides, the Z motor on top, the spindle with its collet
      const carriage = mmGroup(gantry, (heavy ? 0.16 : 0.13), beamY + 0.1, 0);
      mmBox(carriage, 0.05, 0.36, 0.26, gantryMat, 0, -0.18, 0);
      mmBox(carriage, 0.09, 0.09, 0.09, accent, 0.04, 0.2, 0);
      const zSlide = mmGroup(carriage, 0.09, -0.05, 0);
      mmBox(zSlide, 0.04, 0.32, 0.16, 'alu', -0.03, -0.25, 0);
      const spindle = mmCyl(zSlide, 0.06, 0.34, heavy ? 'white' : 'dark', 0.04, -0.22, 0);
      mmCyl(zSlide, 0.065, 0.04, accent, 0.04, -0.06, 0);
      mmCyl(zSlide, 0.035, 0.05, 'steel', 0.04, -0.41, 0);
      const bit = mmCyl(zSlide, 0.009, 0.07, 'chrome', 0.04, -0.47, 0);
      // The dust shoe with its brush skirt, and the hose looping up to the boom and off to the collector
      const shoe = mmCyl(zSlide, 0.1, 0.06, 'glass', 0.04, -0.46, 0);
      mmCyl(zSlide, 0.1, 0.03, 'black', 0.04, -0.5, 0);
      mmRod(zSlide, [0.12, -0.42, 0], [0.3, -0.05, 0.05], 0.035, 'black');
      // (the hose goes up into the chain and back along it to the collector)
      mmRod(gantry, [0.3, beamY + 0.05, 0.05], [0.05, beamY + 0.3, 0.05], 0.035, 'black');
      if (atc) {
        // Automatic tool changer rack along the back
        mmBox(g, 0.75, 0.05, 0.12, 'alu', -w / 2 + 0.5, bedTop + 0.02, -d / 2 + railW + 0.1);
        for (let i = 0; i < 8; i++) mmCyl(g, 0.02, 0.07, i % 2 ? 'red' : 'steel', -w / 2 + 0.2 + i * 0.085, bedTop + 0.1, -d / 2 + railW + 0.1);
      }
      // The control box (drives and controller) and the pendant on its stand at the front corner
      const box = mmGroup(g, w / 2 + 0.3, 0, -d / 2 + 0.3);
      mmBox(box, 0.4, 1.1, 0.35, heavy ? 'grey' : 'dark', 0, 0, 0);
      mmBox(box, 0.3, 0.12, 0.005, 'lampGreen', 0, 0.95, 0.18);
      mmCyl(box, 0.04, 0.03, 'lampRed', 0.12, 0.8, 0.18, { axis: 'z' });
      const pendant = mmGroup(g, w / 2 - 0.15, 0, d / 2 + 0.25);
      mmBox(pendant, 0.05, 1.05, 0.05, 'dark', 0, 0, 0);
      mmScreen(pendant, 0.2, 0.14, 0, 1.12, 0.03);
      // Where work sits on the bed, and how far the head can move (from the centre)
      return mmFinish(g, spec.name || 'router', { gantry, carriage, zSlide, spindle, bit, shoe, bed, bedTop, travel: { x: w / 2 - 0.3, z: d / 2 - 0.3 }, pendant, w, d, plate: { y: bedTop } });
    }

// Dust collector (cyclone and bags), which the routers' hoses run to
function dustCollectorModel() {
      const g = new THREE.Group();
      mmBox(g, 0.5, 0.06, 0.5, 'dark', 0, 0, 0);
      mmCyl(g, 0.22, 0.6, 'red', 0, 0.4, 0);
      mmCyl(g, 0.24, 0.5, 'white', 0, 0.95, 0).material = mmMat('white');
      mmCyl(g, 0.12, 0.25, 'dark', 0, 1.3, 0);
      const bag = mmCyl(g, 0.2, 0.4, 'powder', 0, 0.25, 0.35);
      mmRod(g, [0, 1.05, 0.2], [0, 1.6, 0.8], 0.06, 'steel');
      mmLabel(g, 'DUST COLLECTOR', 0.38, 0.05, 0, 0.6, 0.231, { bg: '#991b1b', fg: '#fff' });
      return mmFinish(g, 'dust', { bag, w: 0.5, d: 0.8 });
    }

// --- Haas VS vertical machining centres --------------------------------------------------------------
function haasVmcModel(big) {
      const g = new THREE.Group();
      const w = big ? 2.7 : 1.9, h = big ? 2.35 : 2.15, d = big ? 1.75 : 1.55;
      // Sheet-metal enclosure in Haas grey with the red stripe
      mmBox(g, w, 0.35, d, 'dark', 0, 0, 0);
      mmBox(g, w, h - 0.35, 0.05, 'haas', 0, 0.35, -d / 2 + 0.025);
      [-1, 1].forEach(s => mmBox(g, 0.05, h - 0.35, d, 'haas', s * (w / 2 - 0.025), 0.35, 0));
      mmBox(g, w, 0.05, d, 'haas', 0, h - 0.05, 0);
      // The front: a fixed header, the two sliding doors with big windows, the red stripe
      mmBox(g, w, 0.45, 0.05, 'haas', 0, h - 0.45, d / 2 - 0.025);
      mmBox(g, w, 0.08, 0.055, 'haasRed', 0, h - 0.3, d / 2 - 0.02);
      mmLabel(g, 'HAAS', 0.42, 0.13, -w / 2 + 0.38, h - 0.2, d / 2 + 0.04, { bg: '#c8102e', fg: '#ffffff' });
      mmLabel(g, big ? 'VS-3' : 'VS-1', 0.3, 0.1, w / 2 - 0.35, h - 0.2, d / 2 + 0.04, { bg: '#d2d5d9', fg: '#111827' });
      const doors = [-1, 1].map(s => {
        const door = mmGroup(g, s * w / 4, 0.35, d / 2 + 0.01);
        // A sheet-metal frame round a big window, so you can watch the cut
        const dw = w / 2 - 0.02, dh = h - 0.82, ww = w / 2 - 0.28, wh = h - 1.3;
        mmBox(door, dw, 0.3, 0.04, 'haas', 0, 0, 0);
        mmBox(door, dw, dh - 0.3 - wh, 0.04, 'haas', 0, 0.3 + wh, 0);
        [-1, 1].forEach(sx => mmBox(door, (dw - ww) / 2, wh, 0.04, 'haas', sx * (ww + (dw - ww) / 2) / 2, 0.3, 0));
        mmBox(door, ww, wh, 0.01, 'glass', 0, 0.3, 0.005);
        mmBox(door, 0.04, 0.4, 0.06, 'chrome', -s * (w / 4 - 0.12), 0.4, 0.04);
        door.userData.closedX = s * w / 4;
        door.position.x = s * w / 4 * 1.85; // open
        return door;
      });
      // Inside: the table with a vise, the column and the spindle head that moves over it
      const tableY = 0.82;
      mmBox(g, w * 0.7, 0.1, d * 0.42, 'steel', 0, tableY, 0.05);
      const table = mmGroup(g, 0, tableY + 0.1, 0.05);
      const vise = mmGroup(table, 0, 0, 0);
      mmBox(vise, 0.36, 0.12, 0.14, 'dark', 0, 0, 0);
      mmBox(vise, 0.06, 0.06, 0.14, 'steel', -0.15, 0.12, 0);
      mmBox(vise, 0.06, 0.06, 0.14, 'steel', 0.15, 0.12, 0);
      mmBox(g, w * 0.3, h - 0.9, 0.3, 'grey', 0, 0.35, -d / 2 + 0.2);
      const head = mmGroup(g, 0, h - 0.78, 0.05);
      mmBox(head, 0.36, 0.4, 0.36, 'grey', 0, 0, -0.1);
      const spindle = mmCyl(head, 0.07, 0.18, 'chrome', 0, -0.05, 0);
      const tool = mmCyl(head, 0.018, 0.12, 'brass', 0, -0.2, 0);
      // Coolant nozzles beside the spindle
      [-0.1, 0.1].forEach(x => mmRod(head, [x, 0, 0.05], [x * 0.4, -0.18, 0.03], 0.008, 'blue'));
      // The control pendant on its swing arm, the chip conveyor and coolant tank
      const pendant = mmGroup(g, w / 2 + 0.12, 1.25, d / 2 - 0.1);
      mmBox(pendant, 0.42, 0.55, 0.08, 'dark', 0, 0, 0, { centre: true });
      mmBox(pendant, 0.28, 0.2, 0.005, 'screen', 0, 0.1, 0.042, { centre: true });
      for (let i = 0; i < 12; i++) mmBox(pendant, 0.04, 0.025, 0.005, i === 11 ? 'lampRed' : 'grey', -0.15 + (i % 6) * 0.06, -0.08 - Math.floor(i / 6) * 0.05, 0.042, { centre: true });
      mmBox(g, 0.4, 0.5, 0.5, 'haas', -w / 2 - 0.22, 0, -0.2);
      mmRod(g, [-w / 2 - 0.22, 0.5, -0.2], [-w / 2 - 0.45, 1.0, -0.2], 0.08, 'dark');
      const tower = mmLightTower(g, w / 2 - 0.1, h, -d / 2 + 0.1);
      // The side-mount tool changer: a carousel of tool holders beside the column, and its arm
      const atc = mmGroup(g, -w / 2 + 0.38, h - 0.95, -d / 2 + 0.45);
      mmCyl(atc, 0.3, 0.08, 'grey', 0, 0, 0);
      const carousel = mmGroup(atc, 0, -0.06, 0);
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        mmCyl(carousel, 0.03, 0.1, i % 4 ? 'steel' : 'haasRed', Math.cos(a) * 0.25, -0.05, Math.sin(a) * 0.25);
        mmCyl(carousel, 0.012, 0.08, 'brass', Math.cos(a) * 0.25, -0.13, Math.sin(a) * 0.25);
      }
      const atcArm = mmGroup(atc, 0.3, -0.12, 0.2);
      mmBox(atcArm, 0.5, 0.04, 0.06, 'dark', 0.15, 0, 0, { centre: true });
      return mmFinish(g, big ? 'haasvs3' : 'haasvs1', { doors, head, spindle, tool, table, vise, tower, carousel, atcArm, plate: { y: tableY + 0.22, z: 0.05 }, travel: { x: w * 0.25, z: d * 0.14 }, w: w + 0.6, d, headY: h - 0.78 });
    }

// --- Waldrich Coburg Taurus: a travelling-gantry mill. Two long rails, a bridge across them riding
// on its legs, the cross slide and the ram with a big milling head, over a long floor table with a workpiece.
function taurusModel(len = 7.4) {
      const g = new THREE.Group();
      const span = 3.0;
      // Foundation, rails and the floor table (along z)
      mmBox(g, span + 0.8, 0.12, len + 0.4, 'concrete', 0, 0, 0);
      [-1, 1].forEach(s => {
        mmBox(g, 0.3, 0.35, len, 'wcGrey', s * span / 2, 0.12, 0);
        mmBox(g, 0.12, 0.04, len, 'chrome', s * span / 2, 0.47, 0);
      });
      mmBox(g, span - 0.9, 0.5, len - 1.2, 'dark', 0, 0.12, 0);
      for (let i = 0; i < 6; i++) mmBox(g, 0.05, 0.02, len - 1.3, 'steel', -0.85 + i * 0.34, 0.62, 0);
      // The workpiece: a big marine propeller blade on fixtures (swapped for other jobs)
      const work = mmGroup(g, 0, 0.64, 0.2);
      mmBox(work, 1.2, 0.3, 3.2, 'steel', 0, 0, 0);
      // The gantry bridge
      const gantry = mmGroup(g, 0, 0.5, -len / 2 + 1.2);
      [-1, 1].forEach(s => {
        mmBox(gantry, 0.5, 3.3, 0.8, 'wcGrey', s * span / 2, 0, 0);
        mmBox(gantry, 0.56, 0.2, 0.9, 'dark', s * span / 2, 0, 0);
      });
      mmBox(gantry, span + 0.5, 0.75, 0.8, 'wcGrey', 0, 3.3, 0);
      mmBox(gantry, span + 0.5, 0.08, 0.82, 'yellow', 0, 3.3, 0);
      mmLabel(gantry, 'WALDRICH COBURG', 1.8, 0.24, 0, 3.7, 0.405, { bg: '#4b5d70', fg: '#ffffff' });
      mmLabel(gantry, 'TAURUS', 0.9, 0.2, 0, 3.42, 0.405, { bg: '#4b5d70', fg: '#fde047' });
      // Operator's platform riding along on one leg
      const cab = mmGroup(gantry, span / 2 + 0.55, 1.4, 0);
      mmBox(cab, 0.6, 0.06, 0.9, 'dark', 0, 0, 0);
      mmBox(cab, 0.03, 0.5, 0.9, 'yellow', 0.3, 0.06, 0);
      mmBox(cab, 0.3, 0.4, 0.06, 'dark', 0, 0.06, -0.3);
      mmBox(cab, 0.26, 0.16, 0.005, 'screen', 0, 0.3, -0.265);
      // Cross slide and the ram (moves along x, then down)
      const slide = mmGroup(gantry, 0, 3.0, 0.45);
      mmBox(slide, 0.7, 0.9, 0.35, 'wcGrey', 0, 0, 0);
      const ram = mmGroup(slide, 0, -0.2, 0.05);
      mmBox(ram, 0.42, 2.1, 0.42, 'grey', 0, -1.8, 0);
      const head = mmGroup(ram, 0, -1.85, 0);
      mmBox(head, 0.55, 0.3, 0.55, 'dark', 0, 0, 0);
      const cutter = mmCyl(head, 0.2, 0.08, 'chrome', 0, -0.04, 0);
      mmCyl(head, 0.06, 0.12, 'steel', 0, 0.02, 0);
      const tower = mmLightTower(gantry, -span / 2, 3.35, 0.3);
      return mmFinish(g, 'taurus', { gantry, slide, ram, head, cutter, work, tower, len, span, plate: { y: 0.94, z: 0.2 }, w: span + 0.8, d: len + 0.4 });
    }

// --- Electronics line ----------------------------------------------------------------------------
// A conveyor-fed SMT box with a window and a light tower
function smtBoxModel(name, label, w, h, d, body = 'white', accent = 'navy') {
      const g = new THREE.Group();
      mmBox(g, w, 0.75, d, 'grey', 0, 0, 0);
      mmBox(g, w, h - 0.75, d, body, 0, 0.75, 0);
      mmBox(g, w + 0.01, 0.06, d + 0.01, accent, 0, h - 0.12, 0);
      const window = mmBox(g, w * 0.6, (h - 0.75) * 0.5, 0.01, 'glass', 0, 0.85, d / 2 + 0.003);
      mmLabel(g, label, Math.min(w * 0.8, 0.6), 0.06, 0, h - 0.24, d / 2 + 0.006, { bg: '#1e293b', fg: '#e2e8f0' });
      // The conveyor rails running through it, left to right
      mmBox(g, w + 0.2, 0.03, 0.02, 'alu', 0, 0.9, 0.06);
      mmBox(g, w + 0.2, 0.03, 0.02, 'alu', 0, 0.9, -0.06);
      const tower = mmLightTower(g, w / 2 - 0.06, h, -d / 2 + 0.06);
      return { g, tower, window, w, h, d, railY: 0.93 };
    }

function pastePrinterModel() {
      const s = smtBoxModel('paste', 'DEK SOLDER PASTE PRINTER', 0.9, 1.35, 0.8);
      const squeegee = mmGroup(s.g, 0, 0.98, 0);
      mmBox(squeegee, 0.04, 0.06, 0.2, 'steel', -0.15, 0, 0, { rz: 0.4 });
      mmBox(s.g, 0.32, 0.005, 0.26, 'chrome', 0, 0.96, 0);
      return mmFinish(s.g, 'paste', { ...s, squeegee, plate: { y: s.railY } });
    }

function pickPlaceModel() {
      const s = smtBoxModel('pnp', 'JUKI PICK & PLACE', 1.2, 1.45, 0.95);
      const head = mmGroup(s.g, 0, 1.15, 0);
      mmBox(head, 0.14, 0.12, 0.1, 'dark', 0, 0, 0);
      for (let i = 0; i < 4; i++) mmCyl(head, 0.006, 0.08, 'chrome', -0.045 + i * 0.03, -0.08, 0);
      // The feeder bank of component reels along the front
      for (let i = 0; i < 9; i++) {
        mmBox(s.g, 0.05, 0.3, 0.2, 'grey', -0.48 + i * 0.12, 0.75, 0.42);
        mmCyl(s.g, 0.08, 0.02, i % 3 ? 'black' : 'blue', -0.48 + i * 0.12, 1.0, 0.5, { axis: 'x' });
      }
      return mmFinish(s.g, 'pnp', { ...s, head, plate: { y: s.railY } });
    }

function reflowOvenModel() {
      const s = smtBoxModel('reflow', 'REFLOW OVEN  8 ZONES', 2.0, 1.25, 0.8, 'white', 'red');
      const zones = [];
      for (let i = 0; i < 8; i++) {
        const z = mmBox(s.g, 0.2, 0.02, 0.5, mmGlow('hot'), -0.8 + i * 0.23, 1.15, 0);
        zones.push(z);
      }
      mmBox(s.g, 2.0, 0.1, 0.8, 'grey', 0, 1.25, 0);
      return mmFinish(s.g, 'reflow', { ...s, zones, plate: { y: s.railY } });
    }

function aoiModel() {
      const s = smtBoxModel('aoi', 'AOI INSPECTION', 0.9, 1.4, 0.8, 'white', 'teal');
      const cam = mmGroup(s.g, 0, 1.12, 0);
      mmBox(cam, 0.12, 0.14, 0.12, 'dark', 0, 0, 0);
      const ring = mmCyl(cam, 0.07, 0.015, mmGlow('laser'), 0, -0.01, 0);
      mmScreen(s.g, 0.26, 0.17, 0.25, 1.2, 0.42);
      return mmFinish(s.g, 'aoi', { ...s, cam, ring, plate: { y: s.railY } });
    }

function waveSolderModel() {
      const s = smtBoxModel('wave', 'WAVE SOLDER', 1.7, 1.3, 0.8, 'white', 'orange');
      const pot = mmBox(s.g, 0.4, 0.06, 0.4, mmGlow('hot'), 0.2, 0.83, 0);
      const wave = mmBox(s.g, 0.36, 0.05, 0.06, 'chrome', 0.2, 0.89, 0);
      // Flux sprayer and preheat zone
      const preheat = mmBox(s.g, 0.4, 0.02, 0.4, mmGlow('hot'), -0.4, 0.83, 0);
      mmCyl(s.g, 0.06, 0.6, 'steel', 0.6, 1.6, -0.2);
      return mmFinish(s.g, 'wave', { ...s, pot, wave, preheat, plate: { y: s.railY } });
    }

function pcbMillModel() {
      const g = new THREE.Group();
      mmBox(g, 0.65, 0.45, 0.55, 'white', 0, 0, 0);
      mmBox(g, 0.65, 0.35, 0.55, 'glass', 0, 0.45, 0);
      mmBox(g, 0.67, 0.03, 0.57, 'grey', 0, 0.8, 0);
      mmBox(g, 0.5, 0.01, 0.4, 'dark', 0, 0.45, 0);
      const gantry = mmGroup(g, 0, 0.62, 0);
      mmBox(gantry, 0.04, 0.05, 0.48, 'grey', 0, 0, 0);
      const head = mmGroup(gantry, 0.03, 0, 0);
      mmCyl(head, 0.025, 0.1, 'dark', 0, -0.05, 0);
      mmCyl(head, 0.004, 0.04, 'chrome', 0, -0.12, 0);
      mmLabel(g, 'LPKF ProtoMat', 0.3, 0.04, 0, 0.3, 0.276, { bg: '#f8fafc', fg: '#b91c1c' });
      return mmFinish(g, 'pcbmill', { gantry, head, plate: { y: 0.46 }, travel: { x: 0.18, z: 0.15 } });
    }

function laserCutterModel() {
      const g = new THREE.Group();
      mmBox(g, 1.1, 0.75, 0.75, 'black', 0, 0, 0);
      mmBox(g, 1.1, 0.12, 0.75, 'white', 0, 0.75, 0);
      const lid = mmGroup(g, 0, 0.87, -0.37);
      mmBox(lid, 1.08, 0.04, 0.72, 'black', 0, 0.12, 0.36);
      mmBox(lid, 0.8, 0.02, 0.4, 'amberGlass', 0, 0.15, 0.36);
      const gantry = mmGroup(g, 0, 0.84, 0);
      mmBox(gantry, 0.05, 0.03, 0.6, 'alu', 0, 0, 0);
      const head = mmGroup(gantry, 0, 0, 0);
      mmBox(head, 0.05, 0.05, 0.05, 'dark', 0, -0.02, 0);
      const beam = mmSphere(head, 0.01, mmGlow('laser'), 0, -0.05, 0);
      beam.material.emissive.setHex(0xff3b3b);
      mmLabel(g, 'TROTEC LASER', 0.34, 0.05, -0.2, 0.55, 0.376, { bg: '#0f1115', fg: '#ef4444' });
      mmScreen(g, 0.1, 0.07, 0.4, 0.6, 0.38);
      return mmFinish(g, 'laser', { lid, gantry, head, beam, plate: { y: 0.8 }, travel: { x: 0.4, z: 0.2 } });
    }

// A lab bench (ESD mat, scope and soldering station) where the boards are tested and assembled
function esdBenchModel() {
      const g = workBenchModel(1.6, 0.7, 'bench');
      mmBox(g, 1.5, 0.005, 0.6, 'teal', 0, 0.98, 0.02);
      mmBox(g, 0.32, 0.18, 0.22, 'blue', -0.45, 0.985, -0.15);
      mmBox(g, 0.2, 0.12, 0.005, 'screen', -0.45, 1.01, -0.039);
      mmBox(g, 0.18, 0.1, 0.16, 'red', 0.45, 0.985, -0.15);
      mmLabel(g, 'ESD AREA', 0.3, 0.06, 0, 1.6, -0.33, { bg: '#facc15', fg: '#111827' });
      return mmFinish(g, 'esd', { top: 0.99 });
    }

// --- Garage ------------------------------------------------------------------------------------------
// A two-post lift: two columns, a carriage on each with swing arms; the carriages ride up (userData.carriage)
function twoPostLiftModel(span = 3.7, armLen = 1.6) {
      const g = new THREE.Group();
      const carriages = [];
      [-1, 1].forEach(s => {
        const x = s * span / 2;
        mmBox(g, 0.5, 0.05, 0.5, 'dark', x, 0, 0);
        mmBox(g, 0.3, 3.4, 0.3, 'blue', x, 0, 0);
        mmBox(g, 0.12, 3.3, 0.04, 'steel', x - s * 0.17, 0.05, 0);
        const c = mmGroup(g, x - s * 0.22, 0.2, 0);
        mmBox(c, 0.16, 0.4, 0.28, 'dark', 0, 0, 0);
        [-1, 1].forEach(z => {
          const arm = mmGroup(c, 0, 0.05, z * 0.1);
          mmBox(arm, armLen, 0.08, 0.1, 'yellow', -s * armLen / 2, 0, 0);
          mmCyl(arm, 0.07, 0.08, 'rubber', -s * (armLen - 0.05), 0.08, 0);
          arm.rotation.y = s * z * 0.75;
        });
        carriages.push(c);
      });
      mmBox(g, span + 0.3, 0.2, 0.25, 'blue', 0, 3.4, 0);
      mmLabel(g, 'TWO-POST LIFT  10,000 LB', 1.3, 0.13, 0, 3.5, 0.13, { bg: '#1d4ed8', fg: '#fff' });
      // Hydraulic power unit
      mmBox(g, 0.25, 0.5, 0.25, 'dark', span / 2 + 0.3, 1.0, 0.2);
      return mmFinish(g, 'lift2', { carriages, liftY: 0.2, w: span + 0.6, d: 0.6 });
    }

// A four-post lift: four columns, two runways with ramps that rise together (userData.runways)
function fourPostLiftModel(len = 6.4, gauge = 2.2) {
      const g = new THREE.Group();
      [-1, 1].forEach(sx => [-1, 1].forEach(sz => {
        mmBox(g, 0.4, 0.04, 0.4, 'dark', sx * (gauge / 2 + 0.55), 0, sz * (len / 2 + 0.1));
        mmBox(g, 0.22, 2.8, 0.22, 'red', sx * (gauge / 2 + 0.55), 0, sz * (len / 2 + 0.1));
      }));
      const runways = mmGroup(g, 0, 0.1, 0);
      [-1, 1].forEach(s => {
        mmBox(runways, 0.55, 0.12, len, 'steel', s * gauge / 2, 0, 0);
        mmBox(runways, 0.05, 0.08, len, 'yellow', s * (gauge / 2 + 0.3), 0.04, 0);
      });
      [-1, 1].forEach(sz => mmBox(runways, gauge + 1.3, 0.18, 0.3, 'red', 0, 0, sz * (len / 2 + 0.1)));
      // Drive-on ramps at the front
      [-1, 1].forEach(s => mmBox(g, 0.55, 0.04, 0.8, 'steel', s * gauge / 2, 0.05, len / 2 + 0.6, { rx: 0.15 }));
      mmLabel(g, 'FOUR-POST LIFT', 1.0, 0.12, 0, 2.6, len / 2 + 0.22, { bg: '#b91c1c', fg: '#fff' });
      return mmFinish(g, 'lift4', { runways, liftY: 0.1, w: gauge + 1.6, d: len + 0.6 });
    }

function tireChangerModel() {
      const g = new THREE.Group();
      mmBox(g, 0.8, 0.7, 0.6, 'red', 0, 0, 0);
      const turntable = mmGroup(g, 0, 0.72, 0.05);
      mmCyl(turntable, 0.32, 0.05, 'dark', 0, 0, 0);
      for (let i = 0; i < 4; i++) mmBox(turntable, 0.06, 0.06, 0.12, 'steel', Math.cos(i * Math.PI / 2) * 0.24, 0.04, Math.sin(i * Math.PI / 2) * 0.24);
      const wheel = mmGroup(turntable, 0, 0.18, 0);
      mmCyl(wheel, 0.38, 0.24, 'tire', 0, 0, 0);
      mmCyl(wheel, 0.22, 0.26, 'chrome', 0, 0, 0);
      wheel.visible = false;
      mmBox(g, 0.12, 1.1, 0.12, 'red', 0, 0.7, -0.28);
      const arm = mmGroup(g, 0, 1.6, -0.28);
      mmBox(arm, 0.08, 0.08, 0.4, 'dark', 0, 0, 0.2);
      const mountHead = mmBox(arm, 0.06, 0.4, 0.06, 'steel', 0, -0.38, 0.38);
      // Bead breaker on the side
      const breaker = mmGroup(g, 0.42, 0.3, 0);
      mmBox(breaker, 0.05, 0.6, 0.05, 'dark', 0.06, 0, 0, { rz: -0.4 });
      mmBox(breaker, 0.12, 0.1, 0.2, 'steel', 0.25, 0.5, 0);
      mmLabel(g, 'TIRE CHANGER', 0.4, 0.06, 0, 0.45, 0.301, { bg: '#991b1b', fg: '#fff' });
      return mmFinish(g, 'tirechanger', { turntable, wheel, arm, mountHead, breaker, w: 1.0, d: 0.8 });
    }

function wheelBalancerModel() {
      const g = new THREE.Group();
      mmBox(g, 0.6, 0.85, 0.5, 'grey', 0, 0, 0);
      mmBox(g, 0.62, 0.05, 0.52, 'red', 0, 0.85, 0);
      mmScreen(g, 0.3, 0.2, 0, 1.25, -0.1);
      mmBox(g, 0.04, 0.3, 0.04, 'dark', 0, 0.9, -0.12);
      const shaft = mmGroup(g, 0.35, 0.6, 0);
      mmCyl(shaft, 0.03, 0.3, 'chrome', 0.15, 0, 0, { axis: 'x' });
      const wheel = mmGroup(shaft, 0.28, 0, 0);
      mmCyl(wheel, 0.38, 0.24, 'tire', 0, 0, 0, { axis: 'x' });
      mmCyl(wheel, 0.22, 0.26, 'chrome', 0, 0, 0, { axis: 'x' });
      wheel.visible = false;
      const hood = mmGroup(g, 0.4, 0.95, -0.2);
      mmBox(hood, 0.6, 0.06, 0.5, 'grey', 0.2, 0, 0.2);
      hood.rotation.z = 1.1;
      mmLabel(g, 'WHEEL BALANCER', 0.4, 0.05, 0, 0.55, 0.251, { bg: '#374151', fg: '#fff' });
      return mmFinish(g, 'balancer', { shaft, wheel, hood, w: 1.2, d: 0.6 });
    }

function brakeLatheModel() {
      const g = new THREE.Group();
      mmBox(g, 0.9, 0.8, 0.5, 'navy', 0, 0, 0);
      mmBox(g, 1.0, 0.25, 0.45, 'grey', 0, 0.8, 0);
      const arbor = mmGroup(g, 0.25, 1.15, 0);
      mmCyl(arbor, 0.025, 0.4, 'chrome', 0, 0, 0, { axis: 'x' });
      const rotor = mmGroup(arbor, 0.15, 0, 0);
      mmCyl(rotor, 0.2, 0.05, 'steel', 0, 0, 0, { axis: 'x' });
      mmCyl(rotor, 0.1, 0.12, 'dark', -0.05, 0, 0, { axis: 'x' });
      rotor.visible = false;
      const bits = mmGroup(g, 0.4, 1.12, 0.2);
      mmBox(bits, 0.04, 0.04, 0.2, 'dark', 0, 0, 0);
      mmLabel(g, 'BRAKE LATHE', 0.34, 0.05, 0, 0.5, 0.251, { bg: '#1e3a5f', fg: '#fff' });
      return mmFinish(g, 'brakelathe', { arbor, rotor, bits, w: 1.0, d: 0.5 });
    }

function engineHoistModel() {
      const g = new THREE.Group();
      [-0.32, 0.32].forEach(x => {
        mmBox(g, 0.08, 0.08, 1.4, 'red', x, 0.06, 0.4);
        mmCyl(g, 0.05, 0.05, 'rubber', x, 0.05, 1.05, { axis: 'x' });
      });
      mmBox(g, 0.72, 0.08, 0.08, 'red', 0, 0.06, -0.25);
      mmBox(g, 0.12, 1.6, 0.12, 'red', 0, 0.1, -0.25);
      const boom = mmGroup(g, 0, 1.6, -0.25);
      mmBox(boom, 0.1, 0.1, 1.5, 'red', 0, 0, 0.7);
      mmRod(g, [0, 0.6, -0.2], [0, 1.45, 0.3], 0.04, 'chrome');
      const hook = mmGroup(boom, 0, 0, 1.4);
      mmCyl(hook, 0.008, 0.5, 'steel', 0, -0.25, 0);
      mmBox(hook, 0.06, 0.06, 0.06, 'dark', 0, -0.52, 0);
      const engine = mmGroup(hook, 0, -0.85, 0);
      mmBox(engine, 0.6, 0.45, 0.45, 'dark', 0, 0, 0);
      mmBox(engine, 0.5, 0.15, 0.3, 'red', 0, 0.45, 0);
      mmCyl(engine, 0.12, 0.1, 'steel', 0.32, 0.25, 0, { axis: 'x' });
      engine.visible = false;
      mmLabel(g, 'ENGINE HOIST 2 T', 0.36, 0.06, 0, 1.0, -0.18, { bg: '#991b1b', fg: '#fff' });
      return mmFinish(g, 'hoist', { boom, hook, engine, w: 0.8, d: 1.6 });
    }

function shopPressModel() {
      const g = new THREE.Group();
      [-0.35, 0.35].forEach(x => {
        mmBox(g, 0.08, 1.9, 0.12, 'red', x, 0, 0);
        mmBox(g, 0.4, 0.06, 0.12, 'red', x, 0, 0);
      });
      mmBox(g, 0.78, 0.14, 0.14, 'red', 0, 1.78, 0);
      mmBox(g, 0.7, 0.08, 0.2, 'dark', 0, 0.7, 0);
      const ram = mmGroup(g, 0, 1.4, 0);
      mmCyl(ram, 0.07, 0.36, 'chrome', 0, 0, 0);
      mmCyl(g, 0.09, 0.2, 'black', 0, 1.68, 0);
      mmCyl(g, 0.04, 0.06, 'white', 0.25, 1.5, 0.08, { axis: 'z' });
      mmLabel(g, '20 TON PRESS', 0.36, 0.06, 0, 1.0, 0.07, { bg: '#991b1b', fg: '#fff' });
      return mmFinish(g, 'press', { ram, plate: { y: 0.78 }, w: 0.9, d: 0.4 });
    }

function migTigModel() {
      const g = new THREE.Group();
      mmBox(g, 0.5, 0.05, 0.7, 'dark', 0, 0.12, 0);
      [-0.2, 0.2].forEach(x => [-0.28, 0.28].forEach(z => mmCyl(g, 0.06, 0.04, 'rubber', x, 0.06, z, { axis: 'x' })));
      mmBox(g, 0.4, 0.42, 0.55, 'blue', 0, 0.17, 0.05);
      mmScreen(g, 0.12, 0.08, 0, 0.45, 0.33);
      mmLabel(g, 'MIG / TIG', 0.22, 0.05, 0, 0.3, 0.331, { bg: '#1d4ed8', fg: '#fff' });
      mmCyl(g, 0.1, 0.95, 'argon', 0, 0.62, -0.3);
      mmSphere(g, 0.1, 'argon', 0, 1.1, -0.3);
      const torch = mmGroup(g, 0.3, 0.7, 0.2);
      mmCyl(torch, 0.02, 0.2, 'dark', 0, 0, 0, { rz: 0.8 });
      const tip = mmSphere(torch, 0.02, mmGlow('arc'), 0.08, -0.08, 0);
      return mmFinish(g, 'migtig', { torch, tip, w: 0.5, d: 0.8 });
    }

// The big air compressor (horizontal tank, motor and belt guard), with hard lines and reels to the air tools
function compressorModel() {
      const g = new THREE.Group();
      mmCyl(g, 0.38, 1.6, 'red', 0, 0.48, 0, { axis: 'x' });
      [-0.6, 0.6].forEach(x => mmBox(g, 0.1, 0.12, 0.5, 'dark', x, 0, 0));
      mmBox(g, 0.55, 0.32, 0.45, 'dark', 0.3, 0.86, 0);
      mmCyl(g, 0.16, 0.38, 'steel', -0.3, 0.98, 0);
      const fan = mmGroup(g, -0.3, 1.2, 0);
      mmCyl(fan, 0.15, 0.03, 'red', 0, 0, 0);
      mmCyl(g, 0.06, 0.06, 'white', 0.55, 1.1, 0.2, { axis: 'z' });
      const gauge = mmCyl(g, 0.06, 0.02, 'white', -0.75, 0.9, 0.2, { axis: 'z' });
      mmRod(g, [-0.8, 0.5, 0], [-0.95, 2.4, 0], 0.025, 'copper');
      mmLabel(g, '80 GAL AIR', 0.4, 0.1, 0, 0.48, 0.385, { bg: '#991b1b', fg: '#fff' });
      return mmFinish(g, 'compressor', { fan, gauge, w: 1.7, d: 0.8 });
    }

// Air tools on a rack: impact wrench, air jack and a sandblaster pot
function airToolsModel() {
      const g = new THREE.Group();
      mmBox(g, 0.9, 0.05, 0.4, 'dark', 0, 0.8, 0);
      [-0.4, 0.4].forEach(x => mmBox(g, 0.05, 0.8, 0.05, 'dark', x, 0, 0));
      const impact = mmGroup(g, -0.25, 0.85, 0);
      mmBox(impact, 0.08, 0.14, 0.18, 'black', 0, 0, 0);
      mmCyl(impact, 0.03, 0.08, 'chrome', 0, 0.1, 0.12, { axis: 'z' });
      const jack = mmGroup(g, 0.2, 0, 0.35);
      mmBox(jack, 0.25, 0.2, 0.25, 'yellow', 0, 0, 0);
      mmBox(jack, 0.06, 0.06, 0.9, 'dark', 0, 0.2, 0.45, { rx: -0.25 });
      const pot = mmGroup(g, 0.3, 0.85, 0);
      mmCyl(pot, 0.12, 0.35, 'red', 0, 0.18, 0);
      mmCyl(g, 0.15, 0.04, 'yellow', -0.2, 1.4, -0.15, { axis: 'z' });
      return mmFinish(g, 'airtools', { impact, jack, pot, w: 0.9, d: 0.8 });
    }

// CNC plasma table: a water table with slats, a gantry and the torch
function plasmaTableModel() {
      const g = new THREE.Group();
      mmBox(g, 1.7, 0.55, 1.0, 'dark', 0, 0, 0);
      mmBox(g, 1.6, 0.06, 0.92, 'steel', 0, 0.55, 0);
      for (let i = 0; i < 9; i++) mmBox(g, 0.02, 0.1, 0.9, 'steel', -0.75 + i * 0.19, 0.55, 0);
      const gantry = mmGroup(g, 0, 0.7, 0);
      [-1, 1].forEach(s => mmBox(gantry, 0.08, 0.3, 0.08, 'orange', 0, 0, s * 0.52));
      mmBox(gantry, 0.1, 0.1, 1.1, 'orange', 0, 0.3, 0);
      const torch = mmGroup(gantry, 0.06, 0.2, 0);
      mmCyl(torch, 0.025, 0.28, 'dark', 0, -0.1, 0);
      const arc = mmSphere(torch, 0.025, mmGlow('arc'), 0, -0.26, 0);
      mmLabel(g, 'CNC PLASMA', 0.4, 0.08, 0, 0.3, 0.505, { bg: '#ea580c', fg: '#fff' });
      return mmFinish(g, 'plasma', { gantry, torch, arc, plate: { y: 0.61 }, travel: { x: 0.65, z: 0.35 }, w: 1.7, d: 1.0 });
    }

function partsWasherModel() {
      const g = new THREE.Group();
      mmBox(g, 0.5, 0.8, 0.4, 'red', 0, 0, 0);
      mmBox(g, 0.85, 0.3, 0.6, 'red', 0, 0.8, 0);
      mmBox(g, 0.75, 0.02, 0.5, 'oil', 0, 1.02, 0);
      const lid = mmGroup(g, 0, 1.1, -0.3);
      mmBox(lid, 0.85, 0.03, 0.6, 'red', 0, 0, 0.3);
      lid.rotation.x = -1.2;
      const brush = mmGroup(g, 0.2, 1.1, 0);
      mmCyl(brush, 0.012, 0.25, 'bench', 0, 0, 0, { rz: 0.8 });
      mmLabel(g, 'PARTS WASHER', 0.36, 0.06, 0, 0.6, 0.201, { bg: '#991b1b', fg: '#fff' });
      return mmFinish(g, 'partswasher', { lid, brush, plate: { y: 1.05 }, w: 0.85, d: 0.6 });
    }

// --- Shared product models: the things he makes ----------------------------------------------------
// Built in metres (realSize), so they carry and shelve like everything else
function madePartModel(lower) {
      const l = String(lower || '').toLowerCase();
      const g = new THREE.Group();
      const metal = /steel|stainless|titanium|aluminium|aluminum|metal|dmls|ebm|ded|machined|haas|taurus|plasma|binder/.test(l);
      const mat = /titanium|ebm/.test(l) ? 'tiPowder' : /alumin/.test(l) ? 'alu' : metal ? 'steel'
        : /resin|sla|dlp|msla|polyjet/.test(l) ? 'greyResin' : /nylon|sls|mjf|pa12/.test(l) ? 'powder' : /paper|lom/.test(l) ? 'paper' : /plywood|sign/.test(l) ? 'ply' : /mdf/.test(l) ? 'mdf' : 'orange';
      if (/sign/.test(l)) {
        mmBox(g, 0.6, 0.02, 0.3, mat, 0, 0, 0);
        mmBox(g, 0.5, 0.004, 0.06, 'mdf', 0, 0.02, 0.05);
        mmBox(g, 0.36, 0.004, 0.04, 'mdf', 0, 0.02, -0.06);
      } else if (/bracket/.test(l)) {
        mmBox(g, 0.12, 0.012, 0.06, mat, 0, 0, 0);
        mmBox(g, 0.012, 0.1, 0.06, mat, -0.054, 0, 0);
        mmBox(g, 0.06, 0.06, 0.008, mat, -0.03, 0.006, 0, { rz: 0.785 });
      } else if (/propeller|impeller/.test(l)) {
        mmCyl(g, 0.04, 0.06, mat, 0, 0.03, 0);
        for (let i = 0; i < 3; i++) mmBox(g, 0.2, 0.01, 0.06, mat, Math.cos(i * 2.09) * 0.11, 0.03, Math.sin(i * 2.09) * 0.11, { ry: -i * 2.09, rx: 0.3 });
      } else if (/pedal|spindle|hub|kart/.test(l)) {
        mmBox(g, 0.08, 0.02, 0.22, mat, 0, 0, 0);
        mmBox(g, 0.1, 0.012, 0.08, mat, 0, 0.02, 0.1);
        mmCyl(g, 0.02, 0.06, mat, 0, 0.02, -0.1, { axis: 'x' });
      } else if (/miniature|figure|robot/.test(l)) {
        mmCyl(g, 0.03, 0.01, mat, 0, 0.005, 0);
        mmBox(g, 0.03, 0.04, 0.02, mat, 0, 0.01, 0);
        mmSphere(g, 0.016, mat, 0, 0.065, 0);
      } else if (/gear/.test(l)) {
        mmCyl(g, 0.06, 0.02, mat, 0, 0.01, 0);
        for (let i = 0; i < 12; i++) mmBox(g, 0.016, 0.02, 0.016, mat, Math.cos(i * 0.52) * 0.066, 0, Math.sin(i * 0.52) * 0.066);
      } else if (/enclosure|case|box/.test(l)) {
        mmBox(g, 0.14, 0.05, 0.09, mat, 0, 0, 0);
      } else if (/rotor|disc/.test(l)) {
        mmCyl(g, 0.15, 0.025, 'steel', 0, 0.012, 0);
      } else if (/lattice|heat sink|manifold|nozzle|turbine|blade|spar|rib/.test(l)) {
        mmBox(g, 0.16, 0.06, 0.06, mat, 0, 0, 0);
        for (let i = 0; i < 5; i++) mmBox(g, 0.008, 0.05, 0.06, mat, -0.06 + i * 0.03, 0.06, 0);
      } else {
        mmBox(g, 0.1, 0.03, 0.08, mat, 0, 0, 0);
        mmCyl(g, 0.015, 0.035, 'dark', 0.025, 0.02, 0);
      }
      return mmFinish(g, 'made');
    }

// Homemade electronics: the board in its printed enclosure, with what it needs to do its job
function gadgetModel(lower) {
      const l = String(lower || '').toLowerCase();
      const g = new THREE.Group();
      if (/weather/.test(l)) {
        mmCyl(g, 0.012, 0.5, 'steel', 0, 0.25, 0);
        mmBox(g, 0.1, 0.08, 0.06, 'white', 0, 0.3, 0.04);
        const cups = mmGroup(g, 0, 0.52, 0);
        for (let i = 0; i < 3; i++) mmSphere(cups, 0.02, 'white', Math.cos(i * 2.09) * 0.06, 0, Math.sin(i * 2.09) * 0.06);
        mmBox(g, 0.12, 0.01, 0.03, 'dark', 0, 0.45, 0, { ry: 0.5 });
        g.userData.spin = cups;
      } else if (/radio/.test(l)) {
        mmBox(g, 0.16, 0.09, 0.06, 'orange', 0, 0, 0);
        mmCyl(g, 0.025, 0.006, 'dark', -0.04, 0.045, 0.031, { axis: 'z' });
        mmCyl(g, 0.004, 0.16, 'chrome', 0.06, 0.16, 0);
      } else if (/console/.test(l)) {
        mmBox(g, 0.18, 0.03, 0.08, 'dark', 0, 0, 0);
        mmBox(g, 0.08, 0.004, 0.05, 'screen', 0, 0.03, 0);
        mmCyl(g, 0.008, 0.008, 'red', 0.06, 0.032, 0.01);
        mmCyl(g, 0.012, 0.008, 'grey', -0.06, 0.032, 0);
      } else {
        mmBox(g, 0.12, 0.03, 0.08, 'teal', 0, 0, 0);
        mmCyl(g, 0.012, 0.04, 'red', -0.03, 0.04, 0);
        mmCyl(g, 0.012, 0.04, 'lampGreen', 0.03, 0.04, 0);
      }
      return mmFinish(g, 'gadget');
    }

// A bare circuit board (moves along the SMT line), with components that appear as they're placed
function pcbBoardModel() {
      const g = new THREE.Group();
      mmBox(g, 0.16, 0.006, 0.1, 'pcb', 0, 0, 0);
      const paste = mmBox(g, 0.14, 0.002, 0.08, 'alu', 0, 0.006, 0);
      paste.visible = false;
      const parts = [];
      for (let i = 0; i < 10; i++) {
        const p = mmBox(g, i % 4 === 0 ? 0.03 : 0.012, 0.006, i % 4 === 0 ? 0.03 : 0.008, i % 4 === 0 ? 'black' : 'dark', -0.06 + (i % 5) * 0.03, 0.006, i < 5 ? -0.025 : 0.025);
        p.visible = false;
        parts.push(p);
      }
      return mmFinish(g, 'pcb', { paste, parts });
    }

// Item models for the things he makes (carried, shelved, shown in the Storehouse)
if (typeof ITEM_MODEL_RULES !== 'undefined') {
  ITEM_MODEL_RULES.unshift(
    [/homemade (weather station|fm radio|radio|robot-friend controller|game console)/, (lower) => realSize(gadgetModel(lower))],
    [/\b(fdm|sla|dlp|msla|sls|dmls|mjf|polyjet|binder-jetted|ded|ebm|lom)-(printed|built)\b|\b(haas|taurus|avid|altmill|shopsaber|laguna|pcb|plasma)-(machined|routed|milled|cut)\b/, (lower) => realSize(madePartModel(lower))]
  );
}
