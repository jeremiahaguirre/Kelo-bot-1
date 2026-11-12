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
  // (thinner cylinders need fewer sides to look round: see mmCylGeo)
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cyl12: new THREE.CylinderGeometry(1, 1, 1, 12),
  cyl16: new THREE.CylinderGeometry(1, 1, 1, 16),
  sphereLo: new THREE.SphereGeometry(1, 8, 6),
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
  firebrick: { color: 0xb5651d, roughness: 0.95, metalness: 0 },
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
  sticker: { color: 0xffffff, roughness: 0.6 },
  // Detail finishes (brand-neutral): powder-coated off-white and light grey, anthracite, plastics,
  // anodised black, cast iron, smoked acrylic, cable rubber, a blank alu plate, black PEI sheet
  offWhite: { color: 0xe4e2dc, roughness: 0.48, metalness: 0.12 },
  lightGrey: { color: 0xc7cac7, roughness: 0.46, metalness: 0.2 },
  anthracite: { color: 0x34393f, roughness: 0.5, metalness: 0.3 },
  plasticGrey: { color: 0x8b9097, roughness: 0.55, metalness: 0.02 },
  plasticDark: { color: 0x26292e, roughness: 0.6, metalness: 0.02 },
  blackAnod: { color: 0x1b1d21, roughness: 0.35, metalness: 0.7 },
  castIron: { color: 0x5b6066, roughness: 0.62, metalness: 0.65 },
  smoked: { color: 0x1c2026, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.55, depthWrite: false },
  cable: { color: 0x15171a, roughness: 0.7, metalness: 0 },
  plateAlu: { color: 0xd6d9dc, roughness: 0.35, metalness: 0.75 },
  pei: { color: 0x2a2620, roughness: 0.75, metalness: 0.3 },
  gold: { color: 0xc8a24a, roughness: 0.32, metalness: 0.85 }
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
// Which real finish each shared material gets: [finish, options, overrides]
const MM_FINISH = {
  white: ['painted', {}, { metalness: 0.12 }], grey: ['painted'], haas: ['painted', {}, { metalness: 0.2 }], haasRed: ['painted', {}, { metalness: 0.15 }],
  dark: ['painted', {}, { roughness: 0.5 }], yellow: ['painted', {}, { metalness: 0.15 }], orange: ['painted', {}, { metalness: 0.12 }],
  red: ['painted', {}, { metalness: 0.15 }], blue: ['painted'], navy: ['painted'], green: ['painted'], sienci: ['painted'], teal: ['painted'], wcGrey: ['painted'],
  steel: ['steel'], alu: ['steel', { texture: 'brushed' }, { roughness: 0.28, metalness: 0.8 }], copper: ['copper'], brass: ['brass'],
  wood: ['wood'], ply: ['wood'], mdf: ['wood', {}, { roughness: 0.9 }], bench: ['wood'],
  concrete: ['stone', { repeat: 2 }, { roughness: 0.95 }], firebrick: ['brick', {}, { roughness: 0.95 }],
  argon: ['painted'], oxygen: ['painted'], rubber: [null], tire: [null],
  offWhite: ['painted', {}, { metalness: 0.12 }], lightGrey: ['painted'], anthracite: ['painted', {}, { roughness: 0.48 }],
  blackAnod: ['steel', { texture: 'brushed' }, { roughness: 0.38, metalness: 0.6 }], castIron: ['iron'], plateAlu: ['steel', { texture: 'brushed' }, { roughness: 0.3, metalness: 0.75 }]
};
Object.keys(MM_FINISH).forEach(k => { if (!MM_FINISH[k][0]) delete MM_FINISH[k]; });

// After a machine is built: join its static parts per material, so a detailed machine still costs a
// handful of draw calls. Its moving parts (whatever its userData points at, one level into objects and
// arrays) stay separate, and each moving part's own static pieces are joined inside it the same way
// (keeping any moving part nested in it whole); nested machine models (a desk printer's `inner`) too.
// Keys in MM_JOIN_WHOLE are left exactly as built (job code reads their children by index).
const MM_JOIN_WHOLE = new Set(['work']);
function mmRefsOf(o) {
      const out = [];
      Object.entries(o.userData || {}).forEach(([k, v]) => [].concat(v).forEach(x => {
        if (x && x.isObject3D) out.push([k, x]);
        else if (x && typeof x === 'object' && !Array.isArray(x)) Object.values(x).forEach(y => { if (y && y.isObject3D) out.push([k, y]); });
      }));
      return out.filter(([, x]) => x !== o);
    }

function mmPlainUserData(o) {
      for (const k in o.userData) if (k !== 'sharedGeometry') return false;
      return true;
    }

function mmIsAncestor(a, o) {
      for (let p = o.parent; p; p = p.parent) if (p === a) return true;
      return false;
    }

// Small static parts (bolts, buttons, feet, slats...) are joined into their own mesh per material and
// size class, so the Workshop can leave them out when the camera is too far away to see them (and
// they never cast shadows). mmFineTier: mesh -> 1 (under MM_FINE_R[0] across its bounding sphere
// radius) or 2 (under MM_FINE_R[1]).
const MM_FINE_R = [0.04, 0.075], MM_FINE_THIN = [0.022, 0.045];
const mmFineTier = new WeakMap();
const _mmFineSize = new THREE.Vector3(), _mmFineScale = new THREE.Vector3();
// Small (its bounding sphere) or thin (its middle dimension: a long 1 cm strip is a hairline too)
function mmFineTierOf(g, mat) {
      if (!g.boundingSphere) g.computeBoundingSphere();
      if (!g.boundingBox) g.computeBoundingBox();
      const e = mat.elements;
      _mmFineScale.set(Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10]));
      const rad = g.boundingSphere.radius * Math.max(_mmFineScale.x, _mmFineScale.y, _mmFineScale.z);
      const sz = g.boundingBox.getSize(_mmFineSize).multiply(_mmFineScale);
      const mid = sz.x + sz.y + sz.z - Math.max(sz.x, sz.y, sz.z) - Math.min(sz.x, sz.y, sz.z);
      return rad < MM_FINE_R[0] || mid < MM_FINE_THIN[0] ? 1 : rad < MM_FINE_R[1] || mid < MM_FINE_THIN[1] ? 2 : 0;
    }

// Join root's static meshes per material (subtrees in `keep` stay whole); returns parts joined away
function mmJoin(root, keep, dropBase = false) {
      const kept = new Set();
      keep.forEach(k => k.traverse(c => kept.add(c)));
      root.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), m = new THREE.Matrix4();
      const sets = new Map();
      root.traverse(o => {
        if (o === root || !o.isMesh || o.isInstancedMesh || kept.has(o) || Array.isArray(o.material) || !o.visible || !mmPlainUserData(o)) return;
        for (let a = o.parent; a && a !== root; a = a.parent) if (!a.visible || !mmPlainUserData(a)) return;
        const g = o.geometry;
        if (!g || !g.attributes.position || o.matrixWorld.determinant() < 0 || o.morphTargetInfluences) return;
        const names = Object.keys(g.attributes).sort();
        const tier = mmFineTierOf(g, m.multiplyMatrices(inv, o.matrixWorld));
        const key = `${o.material.uuid}|${o.castShadow}|${o.renderOrder}|${tier}|${names.map(n => n + g.attributes[n].itemSize).join(',')}`;
        if (!sets.has(key)) sets.set(key, Object.assign([], { tier }));
        sets.get(key).push(o);
      });
      let joined = 0;
      sets.forEach(list => {
        if (list.length < 2) { if (list.tier && list[0]) mmFineTier.set(list[0], list.tier); return; }
        const parts = list.map(o => (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld)));
        const out = new THREE.BufferGeometry();
        Object.keys(parts[0].attributes).forEach(n => {
          const a0 = parts[0].attributes[n], size = a0.itemSize;
          const arr = new Float32Array(parts.reduce((t, p) => t + p.attributes[n].count * size, 0));
          let off = 0;
          parts.forEach(p => { arr.set(p.attributes[n].array, off); off += p.attributes[n].array.length; });
          out.setAttribute(n, new THREE.BufferAttribute(arr, size, a0.normalized));
        });
        parts.forEach(p => p.dispose());
        if (dropBase && !list[0].material.transparent) mmDropBaseFaces(out);
        const mesh = new THREE.Mesh(out, list[0].material);
        mesh.castShadow = list[0].castShadow;
        mesh.receiveShadow = list[0].receiveShadow;
        mesh.renderOrder = list[0].renderOrder;
        mesh.matrixAutoUpdate = false;
        mesh.userData.noShadow = !mesh.castShadow || list.tier > 0;
        mesh.userData.joinedParts = list.length;
        if (list.tier) mmFineTier.set(mesh, list.tier);
        root.add(mesh);
        mesh.updateMatrix();
        list.forEach(o => {
          o.parent.remove(o);
          if (!o.geometry.userData.sharedGeometry && !o.userData.sharedGeometry) o.geometry.dispose();
        });
        joined += list.length - 1;
      });
      return joined;
    }

// The undersides of parts standing on the floor (feet, bases, plinths) face straight down at the
// model's own y = 0: nobody ever sees them, so they are left out of the joined mesh
function mmDropBaseFaces(geo) {
      const pos = geo.attributes.position, n = pos.count / 3, keep = [];
      for (let t = 0; t < n; t++) {
        const a = t * 3, y0 = pos.getY(a), y1 = pos.getY(a + 1), y2 = pos.getY(a + 2);
        if (Math.max(y0, y1, y2) < 0.004) {
          // its face normal from the winding: pointing down means it lies against the floor
          const ux = pos.getX(a + 1) - pos.getX(a), uz = pos.getZ(a + 1) - pos.getZ(a);
          const vx = pos.getX(a + 2) - pos.getX(a), vz = pos.getZ(a + 2) - pos.getZ(a);
          if (uz * vx - ux * vz < 0) continue;
        }
        keep.push(t);
      }
      if (keep.length === n || !keep.length) return;
      Object.keys(geo.attributes).forEach(name => {
        const att = geo.attributes[name], size = att.itemSize, src = att.array, arr = new Float32Array(keep.length * 3 * size);
        keep.forEach((t, i) => arr.set(src.subarray(t * 3 * size, (t + 1) * 3 * size), i * 3 * size));
        geo.setAttribute(name, new THREE.BufferAttribute(arr, size, att.normalized));
      });
    }

function machineMergeStatic(root, depth = 0) {
      if (!root || depth > 6) return 0;
      const refs = mmRefsOf(root), objs = refs.map(r => r[1]);
      let n = 0;
      refs.forEach(([k, o]) => {
        if (o.isMesh && !o.children.length) return;
        if (MM_JOIN_WHOLE.has(k)) return;
        if (o.userData && o.userData.machineModel) { n += machineMergeStatic(o, depth + 1); return; }
        n += mmJoin(o, objs.filter(x => x !== o && !mmIsAncestor(x, o)).concat(mmRefsOf(o).map(r => r[1])));
      });
      return n + mmJoin(root, objs, true);
    }

// Near-identical small-part finishes share one material, so they join into the same mesh
const MM_MAT_ALIAS = { cable: 'rubber', plasticDark: 'black', plasticGrey: 'grey', anthracite: 'dark', lightGrey: 'grey', offWhite: 'white' };
function mmMat(key) {
      if (MM_MATS[key]) return MM_MATS[key];
      if (MM_MAT_ALIAS[key]) return (MM_MATS[key] = mmMat(MM_MAT_ALIAS[key]));
      const def = MM_MAT_DEFS[key] || MM_MAT_DEFS.grey;
      const m = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.2, ...def });
      // Real surfaces (js/materials.js): powder-coated paint, brushed steel, wood grain, cast concrete...
      const finish = MM_FINISH[key];
      if (finish && typeof finishMaterial === 'function' && !m.transparent) {
        const keep = m.color.getHex();
        finishMaterial(m, finish[0], finish[1] || {});
        m.color.setHex(keep);
        if (finish[2]) Object.assign(m, finish[2]);
      }
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
// As many sides as a cylinder that thick needs (a 2 cm pin is a few pixels across from the floor views)
function mmCylGeo(r, seg8) {
      if (r < 0.022) return MM_GEO.cyl6;
      if (seg8 || r < 0.05) return MM_GEO.cyl8;
      return r < 0.13 ? MM_GEO.cyl12 : r < 0.3 ? MM_GEO.cyl16 : MM_GEO.cyl;
    }

function mmCyl(parent, r, h, mat, x = 0, y = 0, z = 0, opts = {}) {
      const m = new THREE.Mesh(mmCylGeo(Math.max(r, opts.r2 || 0), opts.seg8), mmMatOf(mat));
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
      const m = new THREE.Mesh(r < 0.05 ? MM_GEO.sphereLo : MM_GEO.sphere, mmMatOf(mat));
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
      const m = new THREE.Mesh(mmCylGeo(r, true), mmMatOf(mat));
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
      mmRBox(g, w + 0.024, h + 0.024, 0.025, 'plasticDark', 0, 0, 0, { centre: true, r: 0.008 });
      mmBox(g, w, h, 0.005, mmHmiMat(), 0, 0, 0.012, { centre: true });
      g.rotation.y = ry;
      return g;
    }

function mmFinish(g, name, extra = {}) {
      g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      g.userData.machineModel = name;
      Object.assign(g.userData, extra);
      return g;
    }

// --- Detail kit: rounded panels, vents, handles, feet, cables, buttons, screens ---------------------
// Shared like the rest: rounded boxes are cached per size, the rest are scaled unit shapes, and
// machineMergeStatic joins them all per material afterwards, so detail costs triangles, not draw calls.
const MM_BEVELS = {};
// A box w x h x d with edges rounded to radius r (smooth normals), centred on the origin
function mmBevelGeo(w, h, d, r) {
      r = Math.max(0.002, Math.min(r, w * 0.45, h * 0.45, d * 0.45));
      const key = [w, h, d, r].map(v => Math.round(v * 1000)).join('|');
      if (MM_BEVELS[key]) return MM_BEVELS[key];
      // A chamfered box: 6 inset faces, 12 edge strips, 8 corner triangles (44 triangles). Every
      // vertex's normal points out from the rounded core, so the strips shade like rounded edges.
      const half = [w / 2 - r, h / 2 - r, d / 2 - r], size = [w, h, d];
      const pos = [], nor = [], uv = [];
      const pt = (sg, a) => { const p = sg.map((s, i) => s * half[i]); p[a] += sg[a] * r; const n = [0, 0, 0]; n[a] = sg[a]; return { p, n }; };
      const tri = (A, B, C) => {
        const ab = A.p.map((v, i) => B.p[i] - v), ac = A.p.map((v, i) => C.p[i] - v);
        const cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
        const avg = [0, 1, 2].map(i => A.n[i] + B.n[i] + C.n[i]);
        const list = cr[0] * avg[0] + cr[1] * avg[1] + cr[2] * avg[2] < 0 ? [A, C, B] : [A, B, C];
        list.forEach(V => {
          pos.push(...V.p); nor.push(...V.n);
          const ax = Math.abs(V.n[0]) > 0.5 ? 0 : Math.abs(V.n[1]) > 0.5 ? 1 : 2, u = (ax + 1) % 3, v = (ax + 2) % 3;
          uv.push(V.p[u] / size[u] + 0.5, V.p[v] / size[v] + 0.5);
        });
      };
      const quad = (A, B, C, D) => { tri(A, B, C); tri(A, C, D); };
      const S = [-1, 1];
      for (let a = 0; a < 3; a++) S.forEach(s => {
        const u = (a + 1) % 3, v = (a + 2) % 3, c = (x, y) => { const g = [0, 0, 0]; g[a] = s; g[u] = x; g[v] = y; return pt(g, a); };
        quad(c(-1, -1), c(1, -1), c(1, 1), c(-1, 1));
      });
      for (let a = 0; a < 3; a++) {
        const b = (a + 1) % 3, c = (a + 2) % 3;
        S.forEach(sa => S.forEach(sb => {
          const g = sc => { const x = [0, 0, 0]; x[a] = sa; x[b] = sb; x[c] = sc; return x; };
          quad(pt(g(-1), a), pt(g(-1), b), pt(g(1), b), pt(g(1), a));
        }));
      }
      S.forEach(x => S.forEach(y => S.forEach(z => tri(pt([x, y, z], 0), pt([x, y, z], 1), pt([x, y, z], 2)))));
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.userData.sharedGeometry = true;
      MM_BEVELS[key] = g;
      return g;
    }

// mmBox with rounded edges (r defaults to a few mm, scaled to the part)
function mmRBox(parent, w, h, d, mat, x = 0, y = 0, z = 0, opts = {}) {
      // (small parts stay plain boxes: a rounded edge there is too small to see but costs 4x the triangles)
      if (Math.max(w, h, d) < 0.15) return mmBox(parent, w, h, d, mat, x, y, z, opts);
      const r = opts.r != null ? opts.r : Math.min(0.03, Math.min(w, h, d) * 0.12);
      if (r < 0.006) return mmBox(parent, w, h, d, mat, x, y, z, opts);
      const m = new THREE.Mesh(mmBevelGeo(w, h, d, r), mmMatOf(mat));
      m.position.set(x, opts.centre ? y : y + h / 2, z);
      if (opts.rx) m.rotation.x = opts.rx;
      if (opts.ry) m.rotation.y = opts.ry;
      if (opts.rz) m.rotation.z = opts.rz;
      m.userData.sharedGeometry = true;
      if (parent) parent.add(m);
      return m;
    }

// Louvred vent: a dark recess with n slats across it, on a face whose normal is +z (turn with ry)
function mmVents(parent, w, h, x, y, z, opts = {}) {
      const g = mmGroup(parent, x, y, z);
      g.rotation.y = opts.ry || 0;
      const n = opts.n || Math.max(3, Math.round(h / 0.035));
      mmBox(g, w, h, 0.006, 'black', 0, 0, 0, { centre: true });
      for (let i = 0; i < n; i++) mmBox(g, w - 0.01, h / n * 0.45, 0.012, opts.mat || 'plasticDark', 0, -h / 2 + (i + 0.5) * h / n, 0.006, { centre: true, rx: -0.5 });
      return g;
    }

// A pull handle (bar on two stand-offs); axis 'y' upright or 'x' across, on a +z face
function mmHandle(parent, len, x, y, z, opts = {}) {
      const g = mmGroup(parent, x, y, z);
      g.rotation.y = opts.ry || 0;
      const up = opts.axis !== 'x', mat = opts.mat || 'chrome', off = opts.off || 0.035, r = opts.r || 0.011;
      mmCyl(g, r, len, mat, 0, 0, off, up ? {} : { axis: 'x' });
      [-1, 1].forEach(s => mmCyl(g, r * 0.8, off, mat, up ? 0 : s * len * 0.42, up ? s * len * 0.42 : 0, off / 2, { axis: 'z', seg8: true }));
      return g;
    }

// Levelling feet (or casters) under the four corners of a w x d base
function mmFeet(parent, w, d, opts = {}) {
      const inset = opts.inset || 0.06, y = opts.y || 0;
      [-1, 1].forEach(sx => [-1, 1].forEach(sz => {
        const x = sx * (w / 2 - inset), z = sz * (d / 2 - inset);
        if (opts.casters) {
          mmBox(parent, 0.06, 0.02, 0.06, 'steel', x, y + 0.07, z);
          mmCyl(parent, 0.035, 0.03, 'rubber', x, y + 0.035, z, { axis: 'x' });
        } else {
          mmCyl(parent, 0.008, 0.05, 'steel', x, y + 0.03, z, { seg8: true });
          mmCyl(parent, 0.03, 0.015, 'rubber', x, y + 0.0075, z);
        }
      }));
    }

// A flexible cable or hose through points (a smooth tube; joined with the rest at merge time)
function mmCable(parent, points, r, mat = 'cable', seg) {
      const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, seg || Math.max(6, points.length * 3), r, 5, false), mmMatOf(mat));
      if (parent) parent.add(m);
      return m;
    }

// Emergency stop: a red mushroom button on a yellow collar (face normal +z)
function mmEstop(parent, x, y, z, ry = 0, s = 1) {
      const g = mmGroup(parent, x, y, z);
      g.rotation.y = ry;
      mmCyl(g, 0.03 * s, 0.012 * s, 'yellow', 0, 0, 0.006 * s, { axis: 'z' });
      mmCyl(g, 0.012 * s, 0.02 * s, 'dark', 0, 0, 0.02 * s, { axis: 'z', seg8: true });
      mmCyl(g, 0.022 * s, 0.014 * s, 'red', 0, 0, 0.034 * s, { axis: 'z' });
      return g;
    }

// A row of n push buttons / pilot lights (face normal +z)
function mmButtons(parent, n, x, y, z, opts = {}) {
      const mats = opts.mats || ['lampGreen', 'black', 'black'];
      const gap = opts.gap || 0.04, r = opts.r || 0.012;
      for (let i = 0; i < n; i++) mmCyl(parent, r, 0.012, mats[i % mats.length], x + (i - (n - 1) / 2) * gap, y, z + 0.006, { axis: 'z' });
    }

// Thin dark seams that split a face into panels (vertical lines at the given x's, on a +z face)
function mmSeams(parent, xs, h, y, z, opts = {}) {
      xs.forEach(x => mmBox(parent, opts.t || 0.006, h, 0.004, 'black', x, y, z));
    }

// A blank alu rating plate (brand-neutral)
function mmPlate(parent, w, h, x, y, z, ry = 0) {
      const m = mmBox(parent, w, h, 0.004, 'plateAlu', x, y, z, { centre: true });
      m.rotation.y = ry;
      return m;
    }

// A generic machine HMI screen picture (one canvas, shared): a menu bar, a part view, a progress bar
let MM_HMI = null;
function mmHmiMat() {
      if (MM_HMI) return MM_HMI;
      const cv = document.createElement('canvas');
      cv.width = 128; cv.height = 80;
      const x = cv.getContext('2d');
      x.fillStyle = '#0b1220'; x.fillRect(0, 0, 128, 80);
      x.fillStyle = '#1e3a8a'; x.fillRect(0, 0, 128, 12);
      x.fillStyle = '#93c5fd'; [6, 30, 54, 78].forEach(a => x.fillRect(a, 4, 18, 4));
      x.fillStyle = '#111c33'; x.fillRect(6, 18, 70, 50);
      x.strokeStyle = '#38bdf8'; x.lineWidth = 1.5; x.strokeRect(20, 30, 40, 28); x.beginPath(); x.moveTo(20, 30); x.lineTo(32, 22); x.lineTo(72, 22); x.lineTo(60, 30); x.moveTo(72, 22); x.lineTo(72, 50); x.lineTo(60, 58); x.stroke();
      x.fillStyle = '#e2e8f0'; for (let i = 0; i < 5; i++) x.fillRect(84, 20 + i * 9, 34 - (i % 3) * 6, 3);
      x.fillStyle = '#334155'; x.fillRect(6, 72, 116, 4);
      x.fillStyle = '#22c55e'; x.fillRect(6, 72, 70, 4);
      const tex = new THREE.CanvasTexture(cv);
      MM_HMI = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.75, roughness: 0.25, metalness: 0 });
      MM_HMI.userData.keepMap = true;
      MM_HMI.userData.shared = true;
      return MM_HMI;
    }

// A hinge pair on a door edge (x, from y0 to y1, on a +z face)
function mmHinges(parent, x, y0, y1, z) {
      [y0, y1].forEach(y => mmCyl(parent, 0.012, 0.06, 'steel', x, y, z, { seg8: true }));
    }

// A wash-down cabinet with a window, glove ports, gloves inside, a light and a foot pedal
function mmGloveBox(g, w, h, d, body, glassH, opts = {}) {
      mmRBox(g, w, h, d, body, 0, 0, 0, { r: 0.025 });
      mmRBox(g, w - 0.04, 0.06, d - 0.04, 'plasticDark', 0, 0, 0, { r: 0.01 });
      mmBox(g, w, glassH, d, 'glass', 0, h, 0);
      [-1, 1].forEach(sx => [-1, 1].forEach(sz => mmBox(g, 0.03, glassH, 0.03, 'dark', sx * (w / 2 - 0.015), h, sz * (d / 2 - 0.015))));
      mmRBox(g, w + 0.02, 0.05, d + 0.02, 'dark', 0, h + glassH - 0.01, 0, { r: 0.01 });
      mmBox(g, w * 0.6, 0.015, 0.03, mmMat('lampAmber'), 0, h + glassH - 0.04, -d / 2 + 0.06);
      const py = opts.portY || h + glassH * 0.35;
      [-1, 1].forEach(s => {
        const x = s * (opts.portX || w * 0.22);
        mmCyl(g, 0.075, 0.04, 'plasticDark', x, py, d / 2 + 0.005, { axis: 'z' });
        mmCyl(g, 0.055, 0.05, 'rubber', x, py, d / 2 + 0.01, { axis: 'z' });
        mmCyl(g, 0.05, 0.22, 'rubber', x, py - 0.06, d / 2 - 0.12, { rx: 1.1 });
      });
      mmBox(g, w - 0.1, 0.02, d - 0.1, 'steel', 0, h + 0.005, 0);
      mmRBox(g, 0.12, 0.03, 0.16, 'plasticDark', w * 0.3, 0, d / 2 + 0.12, { r: 0.01, rx: -0.15 });
      mmCable(g, [[w * 0.3, 0.02, d / 2 + 0.05], [w * 0.38, 0.03, d / 2 - 0.02], [w / 2 - 0.02, 0.2, 0]], 0.008);
    }

// A cone of radius r and height h, its middle at (x, y, z); flip points it down (a hopper)
function mmCone(parent, r, h, mat, x = 0, y = 0, z = 0, flip = false) {
      const m = new THREE.Mesh(MM_GEO.cone, mmMatOf(mat));
      m.scale.set(r, h, r);
      m.position.set(x, y, z);
      if (flip) m.rotation.x = Math.PI;
      m.userData.sharedGeometry = true;
      if (parent) parent.add(m);
      return m;
    }

// A rectangular frame (four bars of width t) w x h, its bottom edge at y, on a +z face at z
function mmFrame(parent, w, h, t, x, y, z, mat = 'plasticDark', depth = 0.02) {
      mmBox(parent, w, t, depth, mat, x, y, z);
      mmBox(parent, w, t, depth, mat, x, y + h - t, z);
      [-1, 1].forEach(s => mmBox(parent, t, h - 2 * t, depth, mat, x + s * (w - t) / 2, y + t, z));
    }

// A stepper / servo motor standing upright, centred at (x, y, z): black body, a coloured ring, end cap
function mmMotor(parent, x, y, z, ring = 'steel', axis = 'y', s = 1) {
      const g = mmGroup(parent, x, y, z);
      if (axis === 'x') g.rotation.z = Math.PI / 2;
      if (axis === 'z') g.rotation.x = Math.PI / 2;
      mmRBox(g, 0.1 * s, 0.11 * s, 0.1 * s, 'blackAnod', 0, -0.055 * s, 0, { r: 0.012 * s });
      mmBox(g, 0.104 * s, 0.012 * s, 0.104 * s, mmMatOf(ring), 0, 0.02 * s, 0);
      mmCyl(g, 0.035 * s, 0.03 * s, 'steel', 0, 0.065 * s, 0);
      mmBox(g, 0.03 * s, 0.025 * s, 0.03 * s, 'plasticDark', 0.04 * s, 0.035 * s, 0.04 * s);
      return g;
    }

// The monitor and keyboard on a swing arm at the front corner of an SMT machine
function mmSmtConsole(g, x, y, z) {
      mmBox(g, 0.04, 0.12, 0.04, 'anthracite', x, y, z - 0.02);
      mmScreen(g, 0.24, 0.16, x, y + 0.24, z + 0.02).rotation.x = -0.1;
      mmRBox(g, 0.3, 0.02, 0.12, 'anthracite', x, y + 0.02, z + 0.1, { r: 0.006, rx: 0.2 });
      mmBox(g, 0.26, 0.008, 0.08, 'plasticDark', x, y + 0.04, z + 0.1, { rx: 0.2 });
    }

// --- Benches and stands ------------------------------------------------------------------------
function workBenchModel(w = 2.4, d = 0.8, top = 'bench') {
      const g = new THREE.Group();
      // A thick top with rounded edges on a powder-coated steel frame, a lower shelf and levelling feet
      mmRBox(g, w, 0.06, d, top, 0, 0.92, 0, { r: 0.012 });
      [-1, 1].forEach(sx => [-1, 1].forEach(sz => mmRBox(g, 0.06, 0.88, 0.06, 'anthracite', sx * (w / 2 - 0.06), 0.04, sz * (d / 2 - 0.06), { r: 0.008 })));
      mmFeet(g, w, d, { inset: 0.06 });
      [-1, 1].forEach(sz => mmBox(g, w - 0.12, 0.05, 0.03, 'anthracite', 0, 0.84, sz * (d / 2 - 0.06)));
      mmBox(g, w - 0.1, 0.03, d - 0.1, 'mdf', 0, 0.22, 0);
      [-1, 1].forEach(sz => mmBox(g, w - 0.12, 0.04, 0.03, 'anthracite', 0, 0.19, sz * (d / 2 - 0.06)));
      // Pegboard on two uprights, a power strip along its foot and a few tools on hooks
      [-1, 1].forEach(sx => mmBox(g, 0.04, 0.95, 0.04, 'anthracite', sx * (w / 2 - 0.03), 0.98, -d / 2 + 0.02));
      mmBox(g, w - 0.04, 0.88, 0.02, 'mdf', 0, 1.0, -d / 2 + 0.02);
      mmBox(g, w - 0.04, 0.03, 0.03, 'anthracite', 0, 1.88, -d / 2 + 0.02);
      mmRBox(g, w * 0.5, 0.05, 0.05, 'plasticGrey', -w * 0.18, 0.99, -d / 2 + 0.06, { r: 0.01 });
      for (let i = 0; i < 6; i++) mmBox(g, 0.025, 0.018, 0.004, 'black', -w * 0.18 - w * 0.21 + i * w * 0.084, 1.015, -d / 2 + 0.087);
      mmCable(g, [[-w * 0.43, 1.015, -d / 2 + 0.06], [-w / 2 + 0.03, 0.9, -d / 2 + 0.08], [-w / 2 + 0.05, 0.3, -d / 2 + 0.06], [-w / 2 + 0.1, 0.01, -d / 2 + 0.05]], 0.006);
      for (let i = 0; i < 6; i++) {
        const x = -w / 2 + 0.3 + i * (w - 0.6) / 5;
        mmBox(g, 0.008, 0.008, 0.04, 'steel', x, 1.47, -d / 2 + 0.05);
        if (i % 2) mmRBox(g, 0.05, 0.2, 0.025, 'red', x, 1.24, -d / 2 + 0.05, { r: 0.008 });
        else { mmBox(g, 0.012, 0.18, 0.012, 'steel', x, 1.27, -d / 2 + 0.05); mmRBox(g, 0.03, 0.09, 0.03, 'plasticDark', x, 1.36, -d / 2 + 0.05, { r: 0.008 }); }
      }
      return mmFinish(g, 'bench', { top: 0.98 });
    }

// --- 3D printers ---------------------------------------------------------------------------------
// Original Prusa-style bed slinger: orange printed parts, black frame, a spool on top
function fdmPrinterModel() {
      const g = new THREE.Group();
      // Y frame: two extrusions front to back, orange front and back parts, rubber feet
      [-0.12, 0.12].forEach(x => mmBox(g, 0.035, 0.035, 0.44, 'blackAnod', x, 0.02, 0));
      [-1, 1].forEach(s => mmRBox(g, 0.36, 0.05, 0.05, 'orange', 0, 0.01, s * 0.2, { r: 0.01 }));
      mmFeet(g, 0.46, 0.44, { inset: 0.03 });
      mmBox(g, 0.008, 0.008, 0.4, 'chrome', -0.06, 0.06, 0);
      mmBox(g, 0.008, 0.008, 0.4, 'chrome', 0.06, 0.06, 0);
      mmRBox(g, 0.045, 0.045, 0.045, 'black', 0, 0.03, -0.2, { r: 0.006 });   // Y motor
      const bed = mmGroup(g, 0, 0.09, 0);
      mmBox(bed, 0.3, 0.012, 0.3, 'dark', 0, 0, 0);
      mmRBox(bed, 0.29, 0.004, 0.27, 'gold', 0, 0.012, 0.005, { r: 0.002 });
      mmBox(bed, 0.05, 0.006, 0.03, 'gold', 0, 0.012, 0.152);               // the sheet's tab
      mmBox(bed, 0.2, 0.02, 0.16, 'blackAnod', 0, -0.022, 0);
      // Z frame: two uprights and the top bar, Z motors at the foot, lead screws beside the uprights
      [-0.2, 0.2].forEach(x => {
        mmBox(g, 0.04, 0.5, 0.04, 'blackAnod', x, 0.06, -0.05);
        mmRBox(g, 0.045, 0.045, 0.045, 'black', x - Math.sign(x) * 0.045, 0.06, -0.05, { r: 0.006 });
        mmCyl(g, 0.004, 0.42, 'brass', x - Math.sign(x) * 0.045, 0.33, -0.05);
        mmCyl(g, 0.004, 0.42, 'chrome', x - Math.sign(x) * 0.02, 0.33, -0.07);
      });
      mmBox(g, 0.44, 0.04, 0.05, 'blackAnod', 0, 0.55, -0.05);
      [-1, 1].forEach(s => mmRBox(g, 0.06, 0.06, 0.06, 'orange', s * 0.2, 0.52, -0.05, { r: 0.01 }));
      // PSU on the back of the right upright, and the cable bundle up to the extruder
      mmRBox(g, 0.07, 0.17, 0.05, 'black', 0.2, 0.1, -0.11, { r: 0.006 });
      mmVents(g, 0.05, 0.08, 0.2, 0.2, -0.137, { ry: Math.PI, n: 4 });
      mmCable(g, [[0.2, 0.57, -0.06], [0.12, 0.66, -0.1], [0.02, 0.6, -0.12]], 0.008, 'cable');
      // X axis: two smooth rods between the X ends, the extruder riding on them (gantry/head move)
      const gantry = mmGroup(g, 0, 0.32, -0.05);
      mmCyl(gantry, 0.004, 0.42, 'chrome', 0, 0.015, 0, { axis: 'x' });
      mmCyl(gantry, 0.004, 0.42, 'chrome', 0, -0.015, 0, { axis: 'x' });
      [-1, 1].forEach(s => mmRBox(gantry, 0.05, 0.06, 0.05, 'orange', s * 0.2, 0, 0, { centre: true, r: 0.008 }));
      mmBox(gantry, 0.38, 0.01, 0.004, 'black', 0, 0.03, -0.01);            // the belt
      const head = mmGroup(gantry, 0, 0, 0.03);
      mmRBox(head, 0.07, 0.09, 0.05, 'orange', 0, -0.025, 0, { centre: true, r: 0.01 });
      mmRBox(head, 0.05, 0.045, 0.02, 'black', 0, -0.05, 0.03, { centre: true, r: 0.006 });   // print fan
      mmCyl(head, 0.016, 0.004, 'dark', 0, -0.05, 0.041, { axis: 'z' });
      mmRBox(head, 0.04, 0.04, 0.04, 'black', 0, 0.035, -0.005, { centre: true, r: 0.006 }); // extruder motor
      mmBox(head, 0.02, 0.014, 0.02, 'alu', 0, -0.077, 0.01, { centre: true });             // heater block
      mmCyl(head, 0.006, 0.03, 'brass', 0, -0.09, 0.01);
      mmCable(head, [[0, 0.055, -0.01], [0, 0.09, -0.04], [0.02, 0.12, -0.07]], 0.006, 'cable');
      // The LCD knob unit at the front, angled up
      const lcd = mmGroup(g, 0.17, 0.1, 0.205);
      lcd.rotation.x = -0.35;
      mmRBox(lcd, 0.13, 0.08, 0.03, 'orange', 0, -0.04, 0, { r: 0.008 });
      mmBox(lcd, 0.075, 0.045, 0.004, mmHmiMat(), -0.015, 0.0, 0.016, { centre: true });
      mmCyl(lcd, 0.012, 0.012, 'plasticDark', 0.045, 0.0, 0.018, { axis: 'z' });
      // Spool holder on the top bar, a spool of filament on it
      mmBox(g, 0.012, 0.06, 0.012, 'black', 0, 0.57, -0.05);
      const spool = mmCyl(g, 0.09, 0.06, 'orange', 0, 0.64, -0.05, { axis: 'x' });
      [-1, 1].forEach(s => mmCyl(g, 0.095, 0.004, 'plasticDark', s * 0.032, 0.64, -0.05, { axis: 'x' }));
      mmCyl(g, 0.03, 0.07, 'black', 0, 0.64, -0.05, { axis: 'x' });
      mmCable(g, [[0, 0.56, 0.02], [0.03, 0.52, 0.03], [0.01, 0.44, 0.0]], 0.0025, 'orange', 8);
      return mmFinish(g, 'fdm', { bed, gantry, head, spool, plate: { y: 0.105 }, travel: { x: 0.12, z: 0.11 } });
    }

// Formlabs Form 3 style: grey base, an orange see-through cover, the build platform rises out of the resin tank
function slaPrinterModel(cover = 'amberGlass', base = 'grey', name = 'sla') {
      const g = new THREE.Group();
      mmRBox(g, 0.37, 0.03, 0.37, 'plasticDark', 0, 0, 0, { r: 0.012 });
      mmRBox(g, 0.38, 0.17, 0.38, base, 0, 0.03, 0, { r: 0.025 });
      mmBox(g, 0.36, 0.004, 0.36, 'black', 0, 0.2, 0);
      mmScreen(g, 0.12, 0.08, 0.1, 0.12, 0.195).rotation.x = -0.3;
      mmCyl(g, 0.012, 0.008, 'plasticDark', -0.12, 0.13, 0.192, { axis: 'z' });
      mmCyl(g, 0.006, 0.01, 'lampGreen', -0.12, 0.13, 0.196, { axis: 'z' });
      mmVents(g, 0.2, 0.05, 0, 0.12, -0.192, { ry: Math.PI, n: 5 });
      const tank = mmBox(g, 0.24, 0.04, 0.2, 'resin', 0, 0.2, 0.02);
      mmRBox(g, 0.26, 0.03, 0.22, 'plasticDark', 0, 0.2, 0.02, { r: 0.008 });
      const uv = mmBox(g, 0.18, 0.004, 0.16, mmGlow('uv'), 0, 0.2, 0.02);
      // Z tower and lead screw at the back, the resin cartridge behind it
      mmRBox(g, 0.05, 0.42, 0.04, 'alu', 0, 0.2, -0.14, { r: 0.006 });
      mmCyl(g, 0.005, 0.38, 'chrome', 0.035, 0.41, -0.14);
      if (name === 'sla') {
        mmRBox(g, 0.13, 0.17, 0.05, 'plasticGrey', 0, 0.21, -0.17, { r: 0.012 });
        mmCyl(g, 0.02, 0.012, 'black', 0, 0.385, -0.17);
      }
      const platform = mmGroup(g, 0, 0.26, 0.02);
      mmBox(platform, 0.18, 0.015, 0.16, 'alu', 0, 0, 0);
      mmBox(platform, 0.03, 0.03, 0.18, 'alu', 0, 0.015, -0.08);
      mmCyl(platform, 0.012, 0.03, 'black', 0, 0.045, 0.0);
      const lid = mmRBox(g, 0.38, 0.45, 0.38, cover, 0, 0.2, 0, { r: 0.03 });
      return mmFinish(g, name, { tank, uv, platform, lid, plate: { y: -0.005 }, inverted: true });
    }

function dlpPrinterModel() {
      const g = slaPrinterModel('yellowGlass', 'offWhite', 'dlp');
      mmCyl(g, 0.03, 0.04, 'dark', 0, 0.1, 0.02);
      mmVents(g, 0.18, 0.08, 0.191, 0.11, 0, { ry: Math.PI / 2, n: 6 });
      mmRBox(g, 0.12, 0.03, 0.008, 'plasticDark', -0.1, 0.06, 0.19, { r: 0.004 });
      return g;
    }

function msslaPrinterModel() {
      const g = slaPrinterModel('yellowGlass', 'black', 'msla');
      mmRBox(g, 0.18, 0.018, 0.04, 'plasticDark', 0, 0.65, 0, { r: 0.008 });
      mmVents(g, 0.18, 0.08, -0.191, 0.11, 0, { ry: -Math.PI / 2, n: 6 });
      return g;
    }

// Form Wash (a basket that dunks into IPA) and Form Cure (UV and heat on a turntable)
function washStationModel() {
      const g = new THREE.Group();
      mmRBox(g, 0.3, 0.32, 0.3, 'grey', 0, 0, 0, { r: 0.025 });
      mmRBox(g, 0.29, 0.02, 0.29, 'plasticDark', 0, 0, 0, { r: 0.008 });
      mmRBox(g, 0.28, 0.012, 0.28, 'plasticDark', 0, 0.3, 0, { r: 0.005 });
      mmBox(g, 0.26, 0.02, 0.26, 'resin', 0, 0.3, 0);
      const basket = mmGroup(g, 0, 0.36, 0);
      mmBox(basket, 0.18, 0.12, 0.18, 'steel', 0, 0, 0);
      [-1, 1].forEach(s => mmBox(basket, 0.004, 0.12, 0.185, 'chrome', s * 0.045, 0, 0));
      mmBox(basket, 0.04, 0.03, 0.12, 'alu', 0, 0.12, -0.06);
      mmRBox(g, 0.05, 0.4, 0.04, 'alu', 0, 0.32, -0.12, { r: 0.008 });
      mmScreen(g, 0.07, 0.04, 0.06, 0.2, 0.152);
      mmCyl(g, 0.016, 0.014, 'plasticDark', -0.07, 0.2, 0.152, { axis: 'z' });
      return mmFinish(g, 'wash', { basket, plate: { y: 0.12 } });
    }

function cureStationModel() {
      const g = new THREE.Group();
      mmRBox(g, 0.32, 0.06, 0.32, 'grey', 0, 0, 0, { r: 0.015 });
      mmBox(g, 0.3, 0.004, 0.3, 'chrome', 0, 0.06, 0);
      const table = mmCyl(g, 0.11, 0.015, 'steel', 0, 0.07, 0);
      const glow = mmBox(g, 0.28, 0.3, 0.28, mmGlow('uv'), 0, 0.06, 0);
      glow.material.transparent = true;
      glow.material.opacity = 0.35;
      mmRBox(g, 0.32, 0.34, 0.32, 'amberGlass', 0, 0.06, 0, { r: 0.03 });
      mmRBox(g, 0.12, 0.02, 0.04, 'plasticDark', 0, 0.4, 0, { r: 0.008 });
      mmScreen(g, 0.06, 0.03, 0.08, 0.03, 0.162);
      mmCyl(g, 0.012, 0.012, 'plasticDark', -0.08, 0.03, 0.162, { axis: 'z' });
      return mmFinish(g, 'cure', { table, glow, plate: { y: 0.08 } });
    }

// A powder-bed cabinet: SLS, DMLS/SLM, EBM. A window looks onto the build: the recoater sweeps
// fresh powder, the platform drops a layer, the laser (or beam) traces the part.
function powderBedCabinet(w, h, d, body, accent, opts = {}) {
      const g = new THREE.Group();
      mmRBox(g, w, h - 0.1, d, body, 0, 0.1, 0, { r: 0.035 });
      mmRBox(g, w - 0.04, 0.1, d - 0.04, 'plasticDark', 0, 0, 0, { r: 0.01 });
      mmRBox(g, w + 0.02, 0.06, d + 0.02, accent, 0, h - 0.12, 0, { r: 0.012 });
      // Process-chamber door: an outline round the window, hinges on the left, a long handle on the right
      const winX = opts.winX || 0, winY = opts.winY || h * 0.45, winW = opts.winW || w * 0.45, winH = opts.winH || h * 0.25;
      const dw = Math.min(w - 0.12, winW + 0.3), dh = Math.min(h - 0.4, winH + 0.55), dy = 0.18;
      mmBox(g, dw, 0.006, 0.004, 'black', winX, dy, d / 2 + 0.001);
      mmBox(g, dw, 0.006, 0.004, 'black', winX, dy + dh, d / 2 + 0.001);
      [-1, 1].forEach(s => mmBox(g, 0.006, dh, 0.004, 'black', winX + s * dw / 2, dy, d / 2 + 0.001));
      mmHinges(g, winX - dw / 2 + 0.02, dy + 0.12, dy + dh - 0.12, d / 2 + 0.008);
      mmHandle(g, Math.min(0.4, dh * 0.6), winX + dw / 2 - 0.05, dy + dh * 0.5, d / 2, { mat: 'steel' });
      // The build chamber window
      const window = mmBox(g, winW, winH, 0.01, mmGlow('window'), winX, winY, d / 2 + 0.002);
      mmFrame(g, winW + 0.07, winH + 0.07, 0.035, winX, winY - 0.035, d / 2, 'plasticDark');
      // The chamber inside, seen through the window: powder bed, recoater, part and the laser dot
      const chamber = mmGroup(g, winX, winY + 0.02, d / 2 - 0.08);
      const bed = mmBox(chamber, winW * 0.8, 0.012, 0.12, opts.powder || 'powder', 0, 0, 0);
      mmBox(chamber, winW * 0.95, 0.01, 0.15, 'steel', 0, -0.01, 0);
      const recoater = mmBox(chamber, 0.02, 0.03, 0.13, 'steel', -winW * 0.4, 0.012, 0);
      const dot = mmSphere(chamber, 0.012, mmGlow(opts.beam || 'laser'), 0, 0.016, 0);
      const plate = { y: 0.012 };
      // Side louvres, a service hatch, the rating plate
      [-1, 1].forEach(s => mmVents(g, d * 0.45, 0.22, s * (w / 2 + 0.001), h * 0.25, 0, { ry: s * Math.PI / 2, n: 7 }));
      mmBox(g, 0.004, h * 0.5, d * 0.6, 'black', w / 2 + 0.001, h * 0.42, 0);
      mmPlate(g, 0.12, 0.06, -w / 2 + 0.12, 0.3, d / 2 + 0.003);
      // Screen on a swing arm with the e-stop and the key switch beside it
      const sx = w / 2 - 0.15, sy = h * 0.62;
      mmBox(g, 0.04, 0.04, 0.06, 'dark', sx, sy - 0.02, d / 2 + 0.01, { centre: true });
      mmScreen(g, 0.16, 0.11, sx, sy, d / 2 + 0.05).rotation.x = -0.15;
      mmEstop(g, sx + 0.13, sy - 0.1, d / 2, 0, 0.9);
      mmCyl(g, 0.012, 0.012, 'chrome', sx + 0.13, sy - 0.18, d / 2 + 0.006, { axis: 'z' });
      const tower = mmLightTower(g, -w / 2 + 0.08, h, -d / 2 + 0.08);
      const out = { window, chamber, bed, recoater, dot, plate, tower, winW };
      Object.defineProperty(out, 'g', { value: g, enumerable: false });
      return out;
    }

function slsPrinterModel() {
      const c = powderBedCabinet(1.0, 1.55, 0.85, 'offWhite', 'orange');
      const st = mmGroup(c.g, 0.66, 0, 0.1);
      mmRBox(st, 0.28, 0.9, 0.4, 'lightGrey', 0, 0, 0, { r: 0.02 });
      mmRBox(st, 0.24, 0.2, 0.01, 'smoked', 0, 0.55, 0.2, { r: 0.006 });
      [-0.06, 0.06].forEach(x => mmCyl(st, 0.04, 0.03, 'rubber', x, 0.4, 0.205, { axis: 'z' }));
      mmRBox(st, 0.2, 0.08, 0.3, 'plasticDark', 0, 0.9, 0, { r: 0.015 });
      mmCable(c.g, [[0.62, 0.95, 0.1], [0.62, 1.15, 0.0], [0.5, 1.3, -0.1]], 0.025, 'plasticGrey');
      mmFeet(st, 0.28, 0.4, { casters: true, inset: 0.05 });
      return mmFinish(c.g, 'sls', { ...c, w: 1.0, d: 0.85 });
    }

function dmlsPrinterModel() {
      const c = powderBedCabinet(1.6, 1.75, 0.95, 'lightGrey', 'anthracite', { winX: -0.15, winW: 0.6, powder: 'metalPowder' });
      // The glove ports for handling the powder under argon, gloves hanging inside
      [-0.35, 0.05].forEach(x => {
        mmCyl(c.g, 0.075, 0.04, 'plasticDark', x, 0.55, 0.48, { axis: 'z' });
        mmCyl(c.g, 0.055, 0.05, 'rubber', x, 0.55, 0.5, { axis: 'z' });
        mmCyl(c.g, 0.05, 0.2, 'rubber', x, 0.5, 0.36, { rx: 1.2 });
      });
      // Recirculating filter module on the right
      mmRBox(c.g, 0.32, 1.1, 0.5, 'anthracite', 0.62, 0.1, -0.15, { r: 0.02 });
      mmVents(c.g, 0.24, 0.3, 0.62, 0.95, 0.1, { n: 8 });
      mmCable(c.g, [[0.62, 1.2, -0.15], [0.62, 1.5, -0.25], [0.45, 1.65, -0.3]], 0.04, 'steel');
      // Argon supply: two cylinders chained on a rack and the gas line into the chamber
      const gas = mmGroup(c.g, 1.05, 0, -0.1);
      [-0.13, 0.13].forEach(z => {
        mmCyl(gas, 0.1, 1.0, 'argon', 0, 0.55, z);
        mmSphere(gas, 0.1, 'argon', 0, 1.05, z);
        mmCyl(gas, 0.02, 0.08, 'brass', 0, 1.17, z);
        mmCyl(gas, 0.03, 0.04, 'brass', 0.04, 1.2, z, { axis: 'x' });
      });
      mmBox(gas, 0.03, 0.03, 0.42, 'yellow', -0.11, 0.75, 0);
      mmBox(gas, 0.04, 1.0, 0.04, 'dark', -0.12, 0.04, -0.23);
      mmBox(gas, 0.04, 1.0, 0.04, 'dark', -0.12, 0.04, 0.23);
      const gauge = mmCyl(gas, 0.04, 0.02, 'white', 0, 1.24, 0, { axis: 'z' });
      mmCable(c.g, [[1.05, 1.22, -0.1], [0.98, 1.4, -0.12], [0.8, 1.4, -0.1]], 0.012, 'copper');
      mmBox(gas, 0.3, 0.04, 0.5, 'dark', 0, 0, 0);
      return mmFinish(c.g, 'dmls', { ...c, w: 1.6, d: 0.95, gauge });
    }

function ebmPrinterModel() {
      const c = powderBedCabinet(1.2, 1.9, 0.95, 'anthracite', 'teal', { powder: 'tiPowder', beam: 'arc', winH: 0.32 });
      mmCyl(c.g, 0.2, 0.06, 'steel', 0, 1.93, -0.05);
      mmCyl(c.g, 0.16, 0.4, 'steel', 0, 2.1, -0.05);
      [0.0, 0.12, 0.24].forEach(y => mmCyl(c.g, 0.17, 0.02, 'chrome', 0, 1.98 + y, -0.05));
      mmCyl(c.g, 0.1, 0.12, 'dark', 0, 2.36, -0.05);
      mmCable(c.g, [[0.08, 2.4, -0.05], [0.25, 2.45, -0.2], [0.45, 2.1, -0.35], [0.5, 1.9, -0.4]], 0.03, 'cable');
      const pump = mmGroup(c.g, 0.82, 0, 0.1);
      mmRBox(pump, 0.36, 0.42, 0.42, 'teal', 0, 0, 0, { r: 0.02 });
      mmVents(pump, 0.26, 0.2, 0, 0.22, 0.211, { n: 6 });
      mmCyl(pump, 0.12, 0.32, 'steel', 0, 0.58, 0);
      for (let i = 0; i < 5; i++) mmCyl(pump, 0.13, 0.012, 'chrome', 0, 0.46 + i * 0.05, 0);
      mmRod(c.g, [0.82, 0.74, 0.1], [0.6, 1.2, 0.1], 0.035, 'steel');
      const vac = mmCyl(c.g, 0.035, 0.02, 'white', -0.4, 1.0, 0.48, { axis: 'z' });
      return mmFinish(c.g, 'ebm', { ...c, w: 1.2, d: 0.95, vac });
    }

// HP Jet Fusion 5200: a long two-tone printer, the build unit trolley, and the processing station
function mjfPrinterModel() {
      const g = new THREE.Group();
      mmRBox(g, 1.5, 1.07, 0.8, 'offWhite', 0, 0.08, 0, { r: 0.03 });
      mmRBox(g, 1.46, 0.08, 0.76, 'plasticDark', 0, 0, 0, { r: 0.01 });
      mmRBox(g, 1.5, 0.37, 0.8, 'black', 0, 1.14, 0, { r: 0.04 });
      mmBox(g, 1.52, 0.03, 0.82, 'dark', 0, 1.13, 0);
      const window = mmBox(g, 0.62, 0.22, 0.01, mmGlow('window'), -0.25, 1.2, 0.402);
      mmFrame(g, 0.68, 0.28, 0.03, -0.25, 1.17, 0.4, 'plasticDark');
      const chamber = mmGroup(g, -0.25, 1.17, 0.32);
      const bed = mmBox(chamber, 0.5, 0.012, 0.1, 'powder', 0, 0, 0);
      const carriage = mmBox(chamber, 0.04, 0.05, 0.11, 'dark', -0.25, 0.015, 0);
      const dot = mmBox(chamber, 0.03, 0.04, 0.11, mmGlow('hot'), 0.25, 0.015, 0);
      mmScreen(g, 0.16, 0.1, 0.55, 0.95, 0.43).rotation.x = -0.2;
      // Agent cartridges behind a smoked door, the build-unit bay below, panel seams and a handle
      mmRBox(g, 0.4, 0.24, 0.012, 'smoked', 0.42, 0.47, 0.404, { r: 0.008 });
      [0, 1, 2, 3].forEach(i => mmBox(g, 0.06, 0.14, 0.02, i % 3 ? 'teal' : 'black', 0.3 + i * 0.08, 0.5, 0.396));
      mmBox(g, 0.62, 0.7, 0.004, 'black', -0.3, 0.12, 0.401);
      mmHandle(g, 0.3, -0.3, 0.7, 0.4, { axis: 'x', mat: 'steel' });
      mmSeams(g, [0.12], 1.0, 0.1, 0.401);
      [-1, 1].forEach(s => mmVents(g, 0.4, 0.25, s * 0.751, 0.45, 0, { ry: s * Math.PI / 2, n: 7 }));
      const tower = mmLightTower(g, -0.68, 1.5, -0.3);
      const unit = mmGroup(g, 0, 0, 0.75);
      mmRBox(unit, 0.5, 0.6, 0.45, 'grey', 0, 0.06, 0, { r: 0.02 });
      mmHandle(unit, 0.3, 0, 0.55, 0.225, { axis: 'x' });
      [-0.2, 0.2].forEach(x => [-0.18, 0.18].forEach(z => mmCyl(unit, 0.04, 0.04, 'rubber', x, 0.04, z, { axis: 'x' })));
      unit.visible = false;
      return mmFinish(g, 'mjf', { window, chamber, bed, recoater: carriage, dot, tower, unit, plate: { y: 0.012 }, winW: 0.62, w: 1.5, d: 0.8 });
    }

function mjfStationModel() {
      const g = new THREE.Group();
      mmRBox(g, 1.0, 1.22, 0.75, 'offWhite', 0, 0.08, 0, { r: 0.03 });
      mmRBox(g, 0.96, 0.08, 0.71, 'plasticDark', 0, 0, 0, { r: 0.01 });
      mmRBox(g, 1.0, 0.25, 0.75, 'black', 0, 1.3, 0, { r: 0.035 });
      mmBox(g, 0.5, 0.35, 0.01, 'glass', -0.12, 0.85, 0.38);
      mmFrame(g, 0.56, 0.41, 0.03, -0.12, 0.82, 0.376, 'plasticDark');
      [-0.24, 0.0].forEach(x => mmCyl(g, 0.05, 0.03, 'rubber', x, 0.72, 0.385, { axis: 'z' }));
      const brush = mmGroup(g, -0.12, 0.85, 0.32);
      mmBox(brush, 0.02, 0.2, 0.02, 'steel', 0, 0, 0);
      mmBox(brush, 0.05, 0.03, 0.03, 'plasticDark', 0, 0.18, 0);
      mmScreen(g, 0.14, 0.09, 0.34, 0.85, 0.4).rotation.x = -0.2;
      mmBox(g, 0.7, 0.45, 0.004, 'black', 0, 0.15, 0.376);
      mmHandle(g, 0.3, 0, 0.5, 0.375, { axis: 'x', mat: 'steel' });
      mmVents(g, 0.3, 0.2, 0.501, 0.4, 0, { ry: Math.PI / 2, n: 6 });
      return mmFinish(g, 'mjfstation', { brush, w: 1.0, d: 0.75 });
    }

// Stratasys J850 PolyJet: a big white printer with a grey lid; the print block sweeps over the tray
function polyjetPrinterModel() {
      const g = new THREE.Group();
      mmRBox(g, 1.35, 0.87, 0.9, 'offWhite', 0, 0.08, 0, { r: 0.03 });
      mmRBox(g, 1.31, 0.08, 0.86, 'plasticDark', 0, 0, 0, { r: 0.01 });
      mmRBox(g, 1.35, 0.1, 0.9, 'lightGrey', 0, 0.95, 0, { r: 0.02 });
      const lid = mmRBox(g, 1.2, 0.28, 0.8, 'smoked', 0, 1.05, 0, { r: 0.04 });
      mmRBox(g, 1.22, 0.04, 0.82, 'lightGrey', 0, 1.32, 0, { r: 0.015 });
      mmHandle(g, 0.4, 0, 1.2, 0.4, { axis: 'x', mat: 'plasticDark' });
      const tray = mmGroup(g, 0, 1.06, 0);
      mmBox(tray, 0.8, 0.012, 0.5, 'dark', 0, 0, 0);
      const block = mmGroup(g, -0.35, 1.18, 0);
      mmRBox(block, 0.16, 0.1, 0.52, 'grey', 0, 0, 0, { r: 0.015 });
      mmBox(block, 0.14, 0.02, 0.5, 'black', 0, -0.015, 0);
      const lamp = mmBox(block, 0.04, 0.03, 0.5, mmGlow('uv'), 0.1, -0.02, 0);
      mmCable(g, [[-0.6, 1.3, -0.3], [-0.45, 1.29, -0.28], [-0.35, 1.28, -0.22]], 0.02, 'cable');
      mmScreen(g, 0.18, 0.12, 0.45, 0.78, 0.47).rotation.x = -0.2;
      // Material cabinet: six cartridge drawers with their colour tabs and pulls
      ['teal', 'red', 'yellow', 'white', 'black', 'grey'].forEach((c, i) => {
        const x = -0.55 + i * 0.15;
        mmRBox(g, 0.13, 0.32, 0.02, 'lightGrey', x, 0.18, 0.448, { r: 0.006 });
        mmBox(g, 0.1, 0.03, 0.006, c, x, 0.45, 0.46);
        mmBox(g, 0.06, 0.012, 0.02, 'plasticDark', x, 0.3, 0.465);
      });
      [-1, 1].forEach(s => mmVents(g, 0.5, 0.2, s * 0.676, 0.6, 0, { ry: s * Math.PI / 2, n: 6 }));
      const tower = mmLightTower(g, 0.6, 1.05, -0.38);
      return mmFinish(g, 'polyjet', { lid, tray, block, lamp, tower, plate: { y: 0.012 }, w: 1.35, d: 0.9 });
    }

// Waterjet support-removal booth (PolyJet support comes off under a pressure washer)
function waterjetBoothModel() {
      const g = new THREE.Group();
      mmGloveBox(g, 0.8, 0.85, 0.6, 'grey', 0.5, { portX: 0.18 });
      const nozzle = mmGroup(g, 0, 1.2, 0);
      mmCyl(nozzle, 0.012, 0.18, 'steel', 0, 0, 0);
      mmCyl(nozzle, 0.02, 0.05, 'plasticDark', 0, 0.1, 0);
      mmCable(g, [[0, 1.3, 0], [-0.15, 1.33, -0.1], [-0.3, 1.2, -0.2]], 0.012, 'cable');
      // High-pressure pump underneath
      mmVents(g, 0.4, 0.2, 0, 0.35, 0.301, { n: 6 });
      mmRBox(g, 0.12, 0.12, 0.012, 'plasticDark', 0.28, 0.65, 0.3, { r: 0.006 });
      mmCyl(g, 0.03, 0.02, 'white', 0.28, 0.67, 0.31, { axis: 'z' });
      return mmFinish(g, 'waterjet', { nozzle, plate: { y: 0.92 }, w: 0.8, d: 0.6 });
    }

// ExOne-style binder jet: a grey cabinet with a yellow gantry, and the sintering furnace
function binderJetModel() {
      const c = powderBedCabinet(1.1, 1.45, 0.85, 'lightGrey', 'yellow', { powder: 'metalPowder', beam: 'laser' });
      c.dot.visible = false;
      mmCyl(c.g, 0.07, 0.24, 'white', 0.62, 0.12, 0.2);
      mmCyl(c.g, 0.03, 0.04, 'blue', 0.62, 0.26, 0.2);
      mmCable(c.g, [[0.62, 0.3, 0.2], [0.6, 0.6, 0.1], [0.55, 0.9, 0.0]], 0.008, 'plasticGrey');
      mmCyl(c.g, 0.18, 0.2, 'steel', -0.2, 1.55, -0.1);
      mmCone(c.g, 0.18, 0.15, 'steel', -0.2, 1.37, -0.1, true);
      mmCyl(c.g, 0.19, 0.02, 'dark', -0.2, 1.66, -0.1);
      return mmFinish(c.g, 'binder', { ...c, w: 1.1, d: 0.85 });
    }

function furnaceModel(name = 'furnace', label = 'SINTER / HEAT TREAT') {
      const g = new THREE.Group();
      mmRBox(g, 0.95, 1.15, 0.85, 'anthracite', 0, 0.1, 0, { r: 0.03 });
      mmFeet(g, 0.9, 0.8, { inset: 0.06 });
      mmBox(g, 0.85, 0.1, 0.75, 'dark', 0, 0, 0);
      mmRBox(g, 0.97, 0.06, 0.87, 'red', 0, 1.25, 0, { r: 0.012 });
      // The firebrick-lined mouth glowing behind the door
      mmBox(g, 0.58, 0.5, 0.02, 'firebrick', 0, 0.51, 0.415);
      const inside = mmBox(g, 0.5, 0.42, 0.02, mmGlow('hot'), 0, 0.55, 0.41);
      const door = mmGroup(g, -0.3, 0.5, 0.44);
      mmRBox(door, 0.62, 0.55, 0.06, 'grey', 0.3, 0, 0, { r: 0.015 });
      mmBox(door, 0.5, 0.42, 0.02, 'firebrick', 0.3, 0.065, -0.035);
      mmCyl(door, 0.02, 0.2, 'chrome', 0.55, 0.28, 0.04);
      [0.15, 0.4].forEach(y => mmCyl(door, 0.022, 0.07, 'steel', 0, y, 0.0, { seg8: true }));
      // Controller: temperature readout, buttons, e-stop
      mmRBox(g, 0.3, 0.22, 0.03, 'plasticDark', 0.28, 0.86, 0.425, { r: 0.01 });
      const temp = mmLabel(g, '20 C', 0.16, 0.06, 0.24, 0.95, 0.443, { bg: '#020617', fg: '#f87171' });
      mmButtons(g, 3, 0.24, 0.9, 0.44, { gap: 0.04, r: 0.01 });
      mmEstop(g, 0.38, 0.95, 0.44, 0, 0.8);
      mmVents(g, 0.4, 0.15, -0.476, 0.4, 0, { ry: -Math.PI / 2, n: 5 });
      mmCyl(g, 0.06, 0.04, 'steel', 0.3, 1.32, -0.2);
      mmRod(g, [0.3, 1.3, -0.2], [0.3, 1.9, -0.2], 0.05, 'steel');
      mmCable(g, [[-0.4, 1.0, -0.43], [-0.42, 0.6, -0.45], [-0.4, 0.02, -0.46]], 0.012);
      return mmFinish(g, name, { inside, door, temp, plate: { y: 0.35 }, w: 0.95, d: 0.85 });
    }

// A robot cell for DED: safety fence, a six-axis arm with a deposition head, a positioner and a wire feeder
function dedCellModel() {
      const g = new THREE.Group();
      [[-0.95, 0, 0, 1.9], [0.95, 0, 0, 1.9], [0, -0.95, 1.9, 0]].forEach(([x, z, w, d]) => {
        mmBox(g, w || 0.03, 1.5, d || 0.03, 'fence', x, 0.05, z);
        mmBox(g, w || 0.05, 0.05, d || 0.05, 'yellow', x, 1.55, z);
        mmBox(g, w || 0.04, 0.04, d || 0.04, 'yellow', x, 0.05, z);
      });
      [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]].forEach(([x, z]) => { mmBox(g, 0.05, 1.6, 0.05, 'yellow', x, 0, z); mmBox(g, 0.12, 0.01, 0.12, 'dark', x, 0, z); });
      // Light curtain posts at the open front
      [-0.92, 0.92].forEach(x => { mmRBox(g, 0.04, 1.3, 0.04, 'plasticDark', x, 0.1, 0.92, { r: 0.008 }); mmBox(g, 0.006, 1.2, 0.006, mmMat('lampRed'), x - Math.sign(x) * 0.022, 0.15, 0.92); });
      mmBox(g, 1.8, 0.004, 0.06, 'stripe', 0, 0.002, 0.9);
      // Positioner: a tilting frame on a pedestal with the turntable on it
      mmRBox(g, 0.36, 0.3, 0.36, 'orange', 0.35, 0, 0.2, { r: 0.02 });
      mmCyl(g, 0.22, 0.2, 'dark', 0.35, 0.4, 0.2);
      [-1, 1].forEach(s => mmBox(g, 0.04, 0.2, 0.3, 'orange', 0.35 + s * 0.26, 0.3, 0.2));
      const table = mmCyl(g, 0.26, 0.04, 'steel', 0.35, 0.52, 0.2);
      // The arm
      const base = mmGroup(g, -0.4, 0, -0.35);
      mmBox(base, 0.4, 0.03, 0.4, 'dark', 0, 0, 0);
      mmCyl(base, 0.16, 0.21, 'orange', 0, 0.135, 0);
      const turret = mmGroup(base, 0, 0.24, 0);
      mmCyl(turret, 0.13, 0.16, 'orange', 0, 0.08, 0);
      mmRBox(turret, 0.12, 0.12, 0.12, 'plasticGrey', -0.12, 0.08, 0, { r: 0.02 });
      const shoulder = mmGroup(turret, 0, 0.2, 0);
      mmCyl(shoulder, 0.08, 0.16, 'orange', 0, 0, 0, { axis: 'z' });
      mmRBox(shoulder, 0.1, 0.62, 0.1, 'orange', 0, 0, 0, { r: 0.03 });
      mmRBox(shoulder, 0.08, 0.1, 0.08, 'plasticGrey', 0, 0.05, -0.1, { r: 0.015 });
      mmCable(shoulder, [[0, 0.1, -0.07], [0.05, 0.35, -0.08], [0, 0.6, -0.07]], 0.016, 'cable');
      const elbow = mmGroup(shoulder, 0, 0.62, 0);
      mmCyl(elbow, 0.075, 0.15, 'orange', 0, 0, 0, { axis: 'z' });
      mmRBox(elbow, 0.5, 0.085, 0.085, 'orange', 0.25, -0.045, 0, { r: 0.03 });
      mmRBox(elbow, 0.1, 0.08, 0.08, 'plasticGrey', -0.06, 0, 0, { centre: true, r: 0.015 });
      const wrist = mmGroup(elbow, 0.5, 0, 0);
      mmCyl(wrist, 0.05, 0.1, 'dark', 0, 0, 0, { axis: 'z' });
      const torch = mmGroup(wrist, 0, 0, 0);
      mmCyl(torch, 0.035, 0.22, 'copper', 0, -0.11, 0);
      mmCyl(torch, 0.04, 0.05, 'dark', 0, -0.02, 0);
      mmCyl(torch, 0.02, 0.06, 'brass', 0, -0.25, 0);
      const tip = mmSphere(torch, 0.03, mmGlow('arc'), 0, -0.29, 0);
      // Wire feeder, wire spool and shielding gas
      mmRBox(g, 0.3, 0.3, 0.25, 'blue', -0.65, 0, 0.55, { r: 0.02 });
      mmCyl(g, 0.12, 0.08, 'copper', -0.65, 0.42, 0.55, { axis: 'z' });
      mmCyl(g, 0.13, 0.01, 'plasticDark', -0.65, 0.42, 0.6, { axis: 'z' });
      mmCable(g, [[-0.6, 0.3, 0.45], [-0.5, 0.6, 0.0], [-0.4, 0.35, -0.3]], 0.015, 'cable');
      mmCyl(g, 0.09, 0.9, 'argon', -0.75, 0.48, 0.82);
      mmSphere(g, 0.09, 'argon', -0.75, 0.93, 0.82);
      mmCyl(g, 0.02, 0.06, 'brass', -0.75, 1.03, 0.82);
      // Robot controller cabinet outside the fence (behind it)
      mmRBox(g, 0.5, 1.1, 0.35, 'lightGrey', 0.55, 0, -1.2, { r: 0.02 });
      mmHandle(g, 0.2, 0.75, 0.6, -1.025);
      mmVents(g, 0.3, 0.2, 0.5, 0.25, -1.024, { n: 6 });
      mmCable(g, [[0.4, 0.02, -1.1], [0.0, 0.01, -0.9], [-0.35, 0.02, -0.5]], 0.025, 'cable');
      mmScreen(g, 0.14, 0.1, 0.8, 1.2, 0.95, 0).rotation.x = -0.2;
      mmBox(g, 0.04, 1.15, 0.04, 'dark', 0.8, 0, 0.95);
      mmEstop(g, 0.8, 1.05, 0.97);
      const tower = mmLightTower(g, 0.95, 1.6, -0.95);
      return mmFinish(g, 'ded', { turret, shoulder, elbow, wrist, torch, tip, table, tower, plate: { y: 0.54, x: 0.35, z: 0.2 }, w: 1.9, d: 1.9 });
    }

// LOM: a roll of paper feeds across the bed, a knife plotter cuts each glued sheet
function lomPrinterModel() {
      const g = new THREE.Group();
      mmRBox(g, 0.7, 0.32, 0.5, 'offWhite', 0, 0, 0, { r: 0.02 });
      mmBox(g, 0.7, 0.24, 0.5, 'glass', 0, 0.32, 0);
      [-1, 1].forEach(sx => [-1, 1].forEach(sz => mmBox(g, 0.025, 0.24, 0.025, 'lightGrey', sx * 0.338, 0.32, sz * 0.238)));
      mmRBox(g, 0.72, 0.03, 0.52, 'lightGrey', 0, 0.56, 0, { r: 0.01 });
      const roll = mmCyl(g, 0.07, 0.5, 'paper', -0.42, 0.42, 0, { axis: 'z' });
      [-1, 1].forEach(s => mmBox(g, 0.04, 0.14, 0.02, 'dark', -0.42, 0.33, s * 0.26));
      const sheet = mmBox(g, 0.5, 0.004, 0.36, 'paper', 0, 0.33, 0);
      const stack = mmGroup(g, 0.05, 0.33, 0);
      const gantry = mmGroup(g, 0, 0.48, 0);
      mmBox(gantry, 0.04, 0.03, 0.44, 'dark', 0, 0, 0);
      const knife = mmGroup(gantry, 0, -0.05, 0);
      mmRBox(knife, 0.04, 0.06, 0.04, 'orange', 0, 0, 0, { r: 0.008 });
      mmCyl(knife, 0.005, 0.04, 'chrome', 0, -0.04, 0);
      mmScreen(g, 0.12, 0.07, 0.22, 0.16, 0.252);
      mmCyl(g, 0.012, 0.01, 'lampGreen', 0.05, 0.16, 0.252, { axis: 'z' });
      mmVents(g, 0.3, 0.12, -0.15, 0.14, 0.251, { n: 4 });
      return mmFinish(g, 'lom', { roll, sheet, stack, gantry, knife, plate: { y: 0.335, x: 0.05 }, w: 0.7, d: 0.5 });
    }

// Depowdering station (glove box with an air nozzle) and a bead-blast cabinet
function depowderStationModel() {
      const g = new THREE.Group();
      mmGloveBox(g, 0.9, 0.8, 0.6, 'blue', 0.5, { portX: 0.2 });
      const nozzle = mmGroup(g, 0, 1.1, 0);
      mmCyl(nozzle, 0.01, 0.16, 'steel', 0, 0, 0, { rz: 0.6 });
      mmCable(g, [[0.05, 1.12, 0], [0.2, 1.2, -0.1], [0.38, 1.0, -0.2]], 0.008, 'yellow');
      // Extraction unit on the side and its duct
      mmRBox(g, 0.2, 0.5, 0.3, 'anthracite', 0.56, 0, -0.1, { r: 0.015 });
      mmCable(g, [[0.56, 0.5, -0.1], [0.56, 0.9, -0.15], [0.44, 1.2, -0.15]], 0.04, 'plasticGrey');
      return mmFinish(g, 'depowder', { nozzle, plate: { y: 0.86 }, w: 0.9, d: 0.6 });
    }

function beadBlastModel() {
      const g = new THREE.Group();
      // Four legs, the hopper funnel under the cabinet, the sloped window with its wiper, glove ports
      [-0.38, 0.38].forEach(x => [-0.24, 0.24].forEach(z => { mmBox(g, 0.05, 0.75, 0.05, 'dark', x, 0, z); mmBox(g, 0.08, 0.01, 0.08, 'black', x, 0, z); }));
      [-1, 1].forEach(s => mmBox(g, 0.8, 0.04, 0.04, 'dark', 0, 0.25, s * 0.24));
      mmCone(g, 0.36, 0.32, 'grey', 0, 0.59, 0, true);
      mmCyl(g, 0.06, 0.12, 'dark', 0, 0.42, 0);
      mmRBox(g, 0.9, 0.55, 0.6, 'grey', 0, 0.75, 0, { r: 0.02 });
      mmBox(g, 0.55, 0.2, 0.01, 'glass', 0, 1.3, 0.2, { rx: -0.6 });
      mmRBox(g, 0.9, 0.1, 0.6, 'grey', 0, 1.3, -0.05, { rx: -0.6, r: 0.015 });
      mmRBox(g, 0.6, 0.25, 0.02, 'dark', 0, 1.29, 0.19, { rx: -0.6, r: 0.01 });
      [-0.18, 0.18].forEach(x => { mmCyl(g, 0.07, 0.03, 'plasticDark', x, 1.0, 0.3, { axis: 'z' }); mmCyl(g, 0.06, 0.06, 'rubber', x, 1.0, 0.31, { axis: 'z' }); });
      mmHandle(g, 0.3, 0.46, 1.0, 0, { ry: Math.PI / 2 });
      mmRBox(g, 0.12, 0.03, 0.16, 'plasticDark', 0.25, 0, 0.42, { r: 0.01, rx: -0.15 });
      // The dust collector beside it and its hose
      mmRBox(g, 0.22, 0.6, 0.25, 'blue', -0.6, 0, -0.1, { r: 0.015 });
      mmCable(g, [[-0.6, 0.6, -0.1], [-0.6, 0.95, -0.12], [-0.45, 1.15, -0.1]], 0.04, 'plasticGrey');
      mmCable(g, [[0.3, 1.0, 0.2], [0.32, 0.6, 0.35], [0.25, 0.02, 0.45]], 0.01, 'yellow');
      const nozzle = mmGroup(g, 0, 1.05, 0);
      mmCyl(nozzle, 0.012, 0.15, 'steel', 0, 0, 0, { rz: 0.5 });
      return mmFinish(g, 'beadblast', { nozzle, plate: { y: 0.82 }, w: 0.9, d: 0.6 });
    }

// Wire EDM (cuts the part off the build plate) and a horizontal bandsaw
function wireEdmModel() {
      const g = new THREE.Group();
      mmRBox(g, 1.0, 0.75, 0.85, 'offWhite', 0, 0.1, 0, { r: 0.03 });
      mmRBox(g, 0.96, 0.1, 0.81, 'plasticDark', 0, 0, 0, { r: 0.01 });
      mmBox(g, 0.75, 0.04, 0.6, 'steel', 0, 0.82, 0.05);
      const tank = mmBox(g, 0.7, 0.2, 0.55, 'resin', 0, 0.85, 0.05);
      [-1, 1].forEach(s => mmBox(g, 0.02, 0.22, 0.57, 'blackAnod', s * 0.36, 0.84, 0.05));
      mmBox(g, 0.74, 0.22, 0.02, 'blackAnod', 0, 0.84, -0.235);
      mmRBox(g, 0.2, 0.95, 0.22, 'blue', 0, 0.85, -0.35, { r: 0.025 });
      mmRBox(g, 0.14, 0.09, 0.52, 'blue', 0, 1.67, -0.12, { r: 0.025 });
      mmCyl(g, 0.08, 0.06, 'brass', 0.13, 1.45, -0.35, { axis: 'x' });
      mmCyl(g, 0.04, 0.07, 'plasticDark', 0.13, 1.45, -0.35, { axis: 'x' });
      const head = mmGroup(g, 0, 1.6, 0.05);
      mmRBox(head, 0.1, 0.12, 0.1, 'dark', 0, 0, 0, { r: 0.015 });
      const wire = mmCyl(head, 0.003, 0.6, 'brass', 0, -0.3, 0);
      const spark = mmSphere(head, 0.02, mmGlow('arc'), 0, -0.52, 0);
      mmVents(g, 0.5, 0.2, 0, 0.4, 0.426, { n: 6 });
      mmPlate(g, 0.12, 0.06, 0.36, 0.25, 0.428);
      mmScreen(g, 0.16, 0.1, 0.55, 1.2, 0.3, -0.4);
      mmBox(g, 0.05, 0.05, 0.3, 'dark', 0.55, 1.18, 0.12);
      mmEstop(g, 0.62, 1.08, 0.33, -0.4, 0.8);
      mmCable(g, [[0.5, 0.86, -0.42], [0.6, 0.6, -0.5], [0.45, 0.02, -0.55]], 0.025, 'cable');
      return mmFinish(g, 'edm', { head, wire, spark, tank, plate: { y: 0.95 }, w: 1.0, d: 0.85 });
    }

function bandsawModel() {
      const g = new THREE.Group();
      mmRBox(g, 0.9, 0.55, 0.4, 'blue', 0, 0.05, 0, { r: 0.02 });
      mmBox(g, 0.86, 0.05, 0.36, 'dark', 0, 0, 0);
      mmBox(g, 0.85, 0.05, 0.35, 'steel', 0, 0.6, 0);
      mmBox(g, 0.7, 0.03, 0.3, 'dark', 0, 0.56, 0.0);
      mmBox(g, 0.05, 0.1, 0.25, 'castIron', -0.05, 0.65, 0.0);
      mmBox(g, 0.05, 0.1, 0.25, 'castIron', 0.18, 0.65, 0.0);
      mmCyl(g, 0.012, 0.2, 'chrome', 0.32, 0.7, 0.0, { axis: 'x' });
      mmCyl(g, 0.05, 0.02, 'dark', 0.43, 0.7, 0.0, { axis: 'x' });
      const arm = mmGroup(g, -0.35, 0.72, 0);
      mmRBox(arm, 0.8, 0.22, 0.12, 'blue', 0.4, 0.0, -0.05, { r: 0.03 });
      mmRBox(arm, 0.28, 0.28, 0.06, 'blue', 0.05, -0.04, 0.03, { r: 0.04 });
      mmRBox(arm, 0.28, 0.28, 0.06, 'blue', 0.75, -0.04, 0.03, { r: 0.04 });
      mmCyl(arm, 0.12, 0.05, 'dark', 0.05, 0.1, 0.02, { axis: 'z' });
      mmCyl(arm, 0.12, 0.05, 'dark', 0.75, 0.1, 0.02, { axis: 'z' });
      mmRBox(arm, 0.12, 0.14, 0.14, 'anthracite', -0.06, 0.05, -0.08, { r: 0.02 });
      const blade = mmBox(arm, 0.65, 0.02, 0.004, 'chrome', 0.4, -0.02, 0.05);
      mmRod(g, [-0.38, 0.35, -0.16], [-0.1, 0.78, -0.16], 0.02, 'chrome');
      mmRBox(g, 0.18, 0.1, 0.02, 'plasticDark', 0.3, 0.38, 0.201, { r: 0.008 });
      mmButtons(g, 2, 0.28, 0.4, 0.21, { gap: 0.05 });
      mmEstop(g, 0.36, 0.4, 0.21, 0, 0.7);
      return mmFinish(g, 'bandsaw', { arm, blade, plate: { y: 0.63 }, w: 0.9, d: 0.4 });
    }

// --- CNC routers -----------------------------------------------------------------------------------
// A gantry router: a frame on legs, an MDF spoilboard, the gantry riding the long rails, a Z carriage
// with the spindle and its dust shoe. colours: frame, gantry, accent; spec: w (along x), d, heavy, atc.
function cncRouterModel(spec) {
      const { w, d, frame, gantryMat, accent, heavy = false, atc = false, vacuum = false } = spec;
      const g = new THREE.Group();
      const legH = 0.72, railH = heavy ? 0.18 : 0.14, railW = heavy ? 0.2 : 0.14;
      // Base frame: welded tube legs with cross members and levelling feet
      const legs = heavy ? [-1, -0.33, 0.33, 1] : [-1, 0, 1];
      legs.forEach(fx => [-1, 1].forEach(sz => {
        const x = fx * (w / 2 - 0.1), z = sz * (d / 2 - 0.1);
        mmBox(g, heavy ? 0.14 : 0.1, legH - 0.04, heavy ? 0.14 : 0.1, frame, x, 0.04, z);
        mmBox(g, 0.16, 0.012, 0.16, frame, x, 0.03, z);
        mmCyl(g, 0.01, 0.03, 'steel', x, 0.02, z, { seg8: true });
        mmCyl(g, 0.06, 0.012, 'rubber', x, 0.006, z);
      }));
      [-1, 1].forEach(sz => mmBox(g, w, 0.1, 0.1, frame, 0, 0.2, sz * (d / 2 - 0.1)));
      for (let i = 0; i < 4; i++) mmBox(g, 0.08, 0.08, d - 0.2, frame, -w / 2 + 0.25 + i * (w - 0.5) / 3, 0.2, 0);
      // The table top: side rails with linear guides and gear racks the gantry drives on
      [-1, 1].forEach(sz => {
        const z = sz * (d / 2 - railW / 2);
        mmRBox(g, w, railH, railW, frame, 0, legH, z, { r: 0.012 });
        mmBox(g, w - 0.1, 0.03, 0.04, 'chrome', 0, legH + railH, z - sz * 0.02);
        mmBox(g, w - 0.1, 0.012, 0.03, 'steel', 0, legH + railH + 0.03, z - sz * 0.02);
        mmBox(g, w - 0.1, 0.03, 0.015, 'castIron', 0, legH + railH - 0.05, z + sz * (railW / 2 + 0.008));
        [-1, 1].forEach(sx => mmBox(g, 0.03, 0.05, 0.05, 'yellow', sx * (w / 2 - 0.04), legH + railH, z - sz * 0.02));   // end stops
      });
      [-1, 1].forEach(sx => mmRBox(g, 0.1, railH, d, frame, sx * (w / 2 - 0.05), legH, 0, { r: 0.012 }));
      // Spoilboard (MDF with T-tracks) or a vacuum table (grid, zones, plenum)
      const bed = mmBox(g, w - 0.2, 0.05, d - railW * 2 - 0.04, vacuum ? 'dark' : 'mdf', 0, legH + 0.05, 0);
      const bedTop = legH + 0.1;
      if (vacuum) {
        for (let i = -6; i <= 6; i++) mmBox(g, 0.01, 0.004, d - railW * 2 - 0.1, 'grey', i * (w - 0.3) / 13, bedTop - 0.002, 0);
        for (let i = -3; i <= 3; i++) mmBox(g, w - 0.3, 0.004, 0.01, 'grey', 0, bedTop - 0.002, i * (d - 0.4) / 7);
        mmRBox(g, 0.4, 0.35, 0.35, 'anthracite', w / 2 - 0.4, 0.25, 0, { r: 0.02 }); // vacuum pump under the table
        mmVents(g, 0.25, 0.2, w / 2 - 0.4, 0.42, 0.176, { n: 5 });
        mmCable(g, [[w / 2 - 0.4, 0.6, 0], [w / 2 - 0.45, 0.68, 0.1], [w / 2 - 0.6, legH + 0.04, 0.12]], 0.035, 'plasticGrey');
      } else {
        for (let i = -2; i <= 2; i++) mmBox(g, 0.035, 0.008, d - railW * 2 - 0.1, 'alu', i * (w - 0.4) / 5, bedTop - 0.003, 0);
      }
      // A fixed cable chain trough along the back rail feeding the gantry
      mmBox(g, w * 0.55, 0.06, 0.09, 'blackAnod', -w * 0.2, legH + railH - 0.06, -d / 2 - 0.05);
      for (let i = 0; i < 12; i++) mmRBox(g, w * 0.55 / 12 * 0.85, 0.05, 0.07, 'black', -w * 0.2 - w * 0.275 + (i + 0.5) * w * 0.55 / 12, legH + railH, -d / 2 - 0.05, { r: 0.008 });
      // The gantry: two upright side plates on bearing blocks, the beam across with its rail, the X motors
      const gantry = mmGroup(g, 0, legH + railH, 0);
      const plateH = heavy ? 0.75 : 0.66, beamY = plateH - 0.12;
      [-1, 1].forEach(sz => {
        const z = sz * (d / 2 - railW / 2);
        mmRBox(gantry, 0.34, 0.06, railW + 0.06, 'dark', 0, 0, z, { r: 0.01 });
        mmRBox(gantry, heavy ? 0.36 : 0.3, plateH, 0.05, gantryMat, 0, 0.06, z + sz * 0.05, { r: 0.012 });
        mmMotor(gantry, -0.16, 0.17, z + sz * 0.13, accent, 'y');
      });
      mmRBox(gantry, heavy ? 0.26 : 0.2, heavy ? 0.3 : 0.24, d + 0.1, gantryMat, 0, beamY, 0, { r: 0.02 });
      mmBox(gantry, 0.02, 0.05, d - 0.2, 'chrome', 0.11 + (heavy ? 0.03 : 0), beamY + 0.04, 0);
      mmBox(gantry, 0.02, 0.05, d - 0.2, 'chrome', 0.11 + (heavy ? 0.03 : 0), beamY + 0.16, 0);
      mmBox(gantry, 0.012, 0.025, d - 0.2, 'castIron', 0.12 + (heavy ? 0.03 : 0), beamY + 0.1, 0);   // Y rack
      mmPlate(gantry, 0.16, 0.06, -0.105 - (heavy ? 0.03 : 0), beamY + 0.12, d * 0.3, -Math.PI / 2);
      // Cable chain riding over the beam to the carriage
      const chain = mmGroup(gantry, -0.02, beamY + (heavy ? 0.32 : 0.26), 0);
      mmBox(chain, 0.09, 0.012, d - 0.2, 'blackAnod', 0, -0.03, 0);
      for (let i = 0; i < 14; i++) mmRBox(chain, 0.07, 0.05, (d - 0.3) / 14 * 0.85, 'black', 0, 0, -d / 2 + 0.15 + (i + 0.5) * (d - 0.3) / 14, { r: 0.008 });
      // The Z carriage: a plate on the beam's guides, the Z motor on top, the spindle with its collet
      const carriage = mmGroup(gantry, (heavy ? 0.16 : 0.13), beamY + 0.1, 0);
      mmRBox(carriage, 0.05, 0.36, 0.26, gantryMat, 0, -0.18, 0, { r: 0.01 });
      [-1, 1].forEach(s => mmBox(carriage, 0.03, 0.05, 0.05, 'dark', -0.03, s * 0.06 - 0.06, s * 0.09));
      mmMotor(carriage, 0.04, 0.24, 0, accent, 'y');
      const zSlide = mmGroup(carriage, 0.09, -0.05, 0);
      mmRBox(zSlide, 0.04, 0.32, 0.16, 'alu', -0.03, -0.25, 0, { r: 0.008 });
      const spindle = mmCyl(zSlide, 0.06, 0.34, heavy ? 'offWhite' : 'blackAnod', 0.04, -0.22, 0);
      mmCyl(zSlide, 0.065, 0.04, accent, 0.04, -0.06, 0);
      mmCyl(zSlide, 0.066, 0.012, 'steel', 0.04, -0.15, 0);
      mmCyl(zSlide, 0.066, 0.012, 'steel', 0.04, -0.3, 0);
      mmCyl(zSlide, 0.035, 0.05, 'steel', 0.04, -0.41, 0);
      const bit = mmCyl(zSlide, 0.009, 0.07, 'chrome', 0.04, -0.47, 0);
      // Water-cooled spindle: the coolant hoses and the power lead up into the chain
      mmCable(zSlide, [[0.06, -0.05, 0.05], [0.1, 0.1, 0.07], [0.0, 0.3, 0.05]], 0.008, 'blue');
      mmCable(zSlide, [[0.06, -0.05, -0.05], [0.1, 0.1, -0.07], [0.0, 0.3, -0.05]], 0.008, 'cable');
      // The dust shoe with its brush skirt, and the hose looping up to the boom and off to the collector
      const shoe = mmCyl(zSlide, 0.1, 0.06, 'glass', 0.04, -0.46, 0);
      mmCyl(zSlide, 0.1, 0.03, 'black', 0.04, -0.5, 0);
      mmCyl(zSlide, 0.104, 0.012, 'blackAnod', 0.04, -0.43, 0);
      mmCable(zSlide, [[0.12, -0.42, 0], [0.22, -0.3, 0.03], [0.3, -0.05, 0.05]], 0.035, 'plasticGrey');
      mmCable(gantry, [[0.3, beamY + 0.05, 0.05], [0.24, beamY + 0.24, 0.05], [0.05, beamY + 0.3, 0.05]], 0.035, 'plasticGrey');
      if (atc) {
        // Automatic tool changer rack along the back
        mmRBox(g, 0.75, 0.05, 0.12, 'alu', -w / 2 + 0.5, bedTop + 0.02, -d / 2 + railW + 0.1, { r: 0.01 });
        for (let i = 0; i < 8; i++) {
          const x = -w / 2 + 0.2 + i * 0.085, z = -d / 2 + railW + 0.1;
          mmCyl(g, 0.022, 0.035, 'plasticDark', x, bedTop + 0.08, z);
          mmCyl(g, 0.02, 0.06, 'steel', x, bedTop + 0.125, z);
          mmCyl(g, 0.008, 0.04, i % 2 ? 'brass' : 'chrome', x, bedTop + 0.175, z);
        }
      }
      // The control cabinet (drives, spindle drive, controller) and the pendant on its stand
      const box = mmGroup(g, w / 2 + 0.3, 0, -d / 2 + 0.3);
      mmRBox(box, 0.4, 1.06, 0.35, heavy ? 'lightGrey' : 'anthracite', 0, 0.04, 0, { r: 0.015 });
      mmFeet(box, 0.4, 0.35, { inset: 0.04 });
      mmBox(box, 0.36, 0.9, 0.004, 'black', 0, 0.12, 0.176);
      mmHandle(box, 0.12, 0.14, 0.6, 0.175, { mat: 'plasticDark' });
      mmVents(box, 0.22, 0.16, 0, 0.25, 0.178, { n: 5 });
      mmBox(box, 0.3, 0.12, 0.005, 'lampGreen', 0, 0.95, 0.18);
      mmCyl(box, 0.04, 0.03, 'lampRed', 0.12, 0.8, 0.18, { axis: 'z' });
      mmCyl(box, 0.045, 0.02, 'yellow', -0.1, 0.8, 0.185, { axis: 'z' });
      mmBox(box, 0.02, 0.07, 0.03, 'red', -0.1, 0.77, 0.2);
      mmCable(g, [[w / 2 + 0.3, 1.1, -d / 2 + 0.3], [w / 2 + 0.1, 1.25, -d / 2 + 0.1], [w / 2 - 0.2, legH + railH + 0.05, -d / 2 - 0.05]], 0.03, 'cable');
      const pendant = mmGroup(g, w / 2 - 0.15, 0, d / 2 + 0.25);
      mmRBox(pendant, 0.3, 0.02, 0.3, 'anthracite', 0, 0, 0, { r: 0.008 });
      mmRBox(pendant, 0.05, 1.03, 0.05, 'anthracite', 0, 0.02, 0, { r: 0.01 });
      mmBox(pendant, 0.3, 0.02, 0.18, 'anthracite', 0, 0.9, 0.06, { rx: -0.25 });
      mmScreen(pendant, 0.2, 0.14, 0, 1.12, 0.03).rotation.x = -0.25;
      mmEstop(pendant, 0.13, 1.02, 0.05, 0, 0.8);
      return mmFinish(g, spec.name || 'router', { gantry, carriage, zSlide, spindle, bit, shoe, bed, bedTop, travel: { x: w / 2 - 0.3, z: d / 2 - 0.3 }, pendant, w, d, plate: { y: bedTop } });
    }

// Dust collector (cyclone and bags), which the routers' hoses run to
function dustCollectorModel() {
      const g = new THREE.Group();
      mmRBox(g, 0.5, 0.06, 0.5, 'dark', 0, 0, 0, { r: 0.01 });
      mmFeet(g, 0.5, 0.5, { casters: true, inset: 0.05 });
      mmCyl(g, 0.22, 0.5, 'anthracite', 0, 0.35, 0);
      mmBox(g, 0.1, 0.3, 0.01, 'smoked', 0, 0.2, 0.22);
      mmCone(g, 0.24, 0.3, 'offWhite', 0, 0.75, 0, true);
      mmCyl(g, 0.24, 0.3, 'offWhite', 0, 1.05, 0);
      mmCyl(g, 0.25, 0.02, 'dark', 0, 0.9, 0);
      mmCyl(g, 0.15, 0.2, 'dark', 0, 1.3, 0);
      mmCyl(g, 0.16, 0.02, 'steel', 0, 1.21, 0);
      mmVents(g, 0.12, 0.08, 0, 1.32, 0.15, { n: 3 });
      const bag = mmCyl(g, 0.2, 0.4, 'powder', 0, 0.25, 0.35);
      for (let i = 0; i < 4; i++) mmCyl(g, 0.205, 0.008, 'dark', 0, 0.1 + i * 0.1, 0.35);
      mmCyl(g, 0.07, 0.12, 'steel', 0, 1.1, 0.25, { axis: 'z' });
      mmRod(g, [0, 1.1, 0.3], [0, 1.6, 0.8], 0.06, 'steel');
      mmRBox(g, 0.12, 0.1, 0.03, 'plasticDark', 0.17, 1.22, 0.14, { r: 0.008 });
      mmButtons(g, 2, 0.17, 1.27, 0.155, { gap: 0.04, r: 0.01, mats: ['lampGreen', 'red'] });
      return mmFinish(g, 'dust', { bag, w: 0.5, d: 0.8 });
    }

// --- Haas VS vertical machining centres --------------------------------------------------------------
function haasVmcModel(big) {
      const g = new THREE.Group();
      const w = big ? 2.7 : 1.9, h = big ? 2.35 : 2.15, d = big ? 1.75 : 1.55;
      mmRBox(g, w, 0.35, d, 'anthracite', 0, 0, 0, { r: 0.02 });
      mmBox(g, w - 0.1, 0.06, 0.02, 'black', 0, 0.06, d / 2 + 0.001);
      mmFeet(g, w, d, { inset: 0.12 });
      mmRBox(g, w, h - 0.35, 0.06, 'haas', 0, 0.35, -d / 2 + 0.03, { r: 0.02 });
      [-1, 1].forEach(s => {
        mmRBox(g, 0.06, h - 0.35, d, 'haas', s * (w / 2 - 0.03), 0.35, 0, { r: 0.02 });
        mmBox(g, 0.004, h - 0.6, 0.006, 'black', s * (w / 2 + 0.001), 0.45, -d * 0.1, { ry: Math.PI / 2 });
        mmVents(g, 0.4, 0.15, s * (w / 2 + 0.002), 0.55, -d * 0.3, { ry: s * Math.PI / 2, n: 5 });
      });
      mmRBox(g, w, 0.06, d, 'haas', 0, h - 0.06, 0, { r: 0.025 });
      // The front: a rounded header over the doors with a thin accent stripe, a work-light lens
      mmRBox(g, w, 0.45, 0.08, 'haas', 0, h - 0.45, d / 2 - 0.04, { r: 0.035 });
      mmBox(g, w - 0.06, 0.03, 0.01, 'anthracite', 0, h - 0.32, d / 2 + 0.002);
      mmPlate(g, 0.2, 0.08, w / 2 - 0.3, h - 0.2, d / 2 + 0.003);
      mmBox(g, w - 0.02, 0.06, 0.08, 'haas', 0, 0.35, d / 2 - 0.04);
      mmBox(g, w - 0.1, 0.01, 0.03, 'steel', 0, 0.41, d / 2 + 0.015);
      const doors = [-1, 1].map(s => {
        const door = mmGroup(g, s * w / 4, 0.35, d / 2 + 0.01);
        const dw = w / 2 - 0.02, dh = h - 0.82, ww = dw - 0.14, wh = dh - 0.52;
        mmRBox(door, dw, 0.3, 0.04, 'haas', 0, 0, 0, { r: 0.012 });
        mmRBox(door, dw, dh - 0.3 - wh, 0.04, 'haas', 0, 0.3 + wh, 0, { r: 0.012 });
        [-1, 1].forEach(sx => mmBox(door, (dw - ww) / 2, wh, 0.04, 'haas', sx * (ww + (dw - ww) / 2) / 2, 0.3, 0));
        mmBox(door, ww, wh, 0.01, 'glass', 0, 0.3, 0.005);
        mmFrame(door, ww + 0.02, wh + 0.02, 0.012, 0, 0.29, 0.02, 'plasticDark', 0.008);
        mmBox(door, ww, 0.015, 0.02, 'dark', 0, 0.3 + wh * 0.5, 0.012);
        mmBox(door, 0.04, 0.4, 0.06, 'chrome', -s * (w / 4 - 0.12), 0.4, 0.04);
        [0.25, 0.55].forEach(y => mmBox(door, 0.03, 0.03, 0.05, 'chrome', -s * (w / 4 - 0.12), y, 0.02));
        door.userData.closedX = s * w / 4;
        door.position.x = s * w / 4 * 1.85; // open
        return door;
      });
      // Inside: the T-slot table with a vise, the cast column and the spindle head that moves over it
      const tableY = 0.82;
      mmRBox(g, w * 0.7, 0.1, d * 0.42, 'castIron', 0, tableY, 0.05, { r: 0.01 });
      for (let i = -2; i <= 2; i++) mmBox(g, w * 0.68, 0.004, 0.018, 'black', 0, tableY + 0.1, 0.05 + i * d * 0.07);
      mmBox(g, w * 0.66, 0.38, d * 0.5, 'dark', 0, 0.42, 0.05);
      const table = mmGroup(g, 0, tableY + 0.1, 0.05);
      const vise = mmGroup(table, 0, 0, 0);
      mmRBox(vise, 0.36, 0.12, 0.14, 'blue', 0, 0, 0, { r: 0.01 });
      mmBox(vise, 0.06, 0.06, 0.14, 'steel', -0.15, 0.12, 0);
      mmBox(vise, 0.06, 0.06, 0.14, 'steel', 0.15, 0.12, 0);
      mmCyl(vise, 0.015, 0.08, 'chrome', 0.22, 0.06, 0, { axis: 'x' });
      mmRBox(g, w * 0.3, h - 0.9, 0.3, 'castIron', 0, 0.35, -d / 2 + 0.2, { r: 0.03 });
      mmBox(g, w * 0.28, h - 1.0, 0.004, 'steel', 0, 0.4, -d / 2 + 0.352);
      const head = mmGroup(g, 0, h - 0.78, 0.05);
      mmRBox(head, 0.36, 0.4, 0.36, 'castIron', 0, 0, -0.1, { r: 0.03 });
      mmCyl(head, 0.11, 0.2, 'anthracite', 0, 0.5, -0.1);
      mmCyl(head, 0.12, 0.02, 'steel', 0, 0.41, -0.1);
      const spindle = mmCyl(head, 0.07, 0.18, 'chrome', 0, -0.05, 0);
      mmCyl(head, 0.09, 0.03, 'steel', 0, -0.13, 0);
      const tool = mmCyl(head, 0.018, 0.12, 'brass', 0, -0.2, 0);
      [-0.1, 0.1].forEach(x => mmRod(head, [x, 0, 0.05], [x * 0.4, -0.18, 0.03], 0.008, 'blue'));
      const coolMat = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.55, emissive: 0x0ea5e9, emissiveIntensity: 0.25, depthWrite: false });
      const streams = mmGroup(head, 0, 0, 0);
      [-1, 1].forEach(sx => mmRod(streams, [sx * 0.04, -0.18, 0.03], [0, -0.27, 0], 0.012, coolMat));
      streams.visible = false;
      const chips = mmGroup(table, 0, 0, 0);
      for (let i = 0; i < 18; i++) {
        const a = i * 2.39, r = 0.12 + (i % 5) * 0.035;
        mmBox(chips, 0.03, 0.006, 0.012, i % 3 ? 'alu' : 'steel', Math.cos(a) * r, 0.003, Math.sin(a) * r * 0.6, { ry: a });
      }
      mmBox(chips, w * 0.62, 0.004, d * 0.36, coolMat, 0, 0.001, 0);
      chips.visible = false;
      // The control pendant on its swing arm
      const arm = [w / 2 - 0.04, h - 0.5, d / 2 - 0.1];
      mmRBox(g, 0.18, 0.08, 0.1, 'anthracite', arm[0] + 0.04, arm[1], arm[2], { r: 0.02 });
      mmRod(g, [arm[0] + 0.1, arm[1] + 0.04, arm[2]], [w / 2 + 0.12, 1.55, d / 2 - 0.1], 0.03, 'anthracite');
      const pendant = mmGroup(g, w / 2 + 0.12, 1.25, d / 2 - 0.1);
      pendant.rotation.y = -0.35;
      mmRBox(pendant, 0.44, 0.58, 0.09, 'anthracite', 0, 0, 0, { centre: true, r: 0.025 });
      mmBox(pendant, 0.3, 0.2, 0.005, mmHmiMat(), 0, 0.12, 0.046, { centre: true });
      mmFrame(pendant, 0.32, 0.22, 0.012, 0, 0.01, 0.046, 'black', 0.006);
      for (let i = 0; i < 18; i++) mmBox(pendant, 0.035, 0.022, 0.008, i === 17 ? 'lampRed' : i % 6 === 0 ? 'lightGrey' : 'plasticGrey', -0.16 + (i % 6) * 0.042, -0.06 - Math.floor(i / 6) * 0.034, 0.046, { centre: true });
      mmCyl(pendant, 0.035, 0.02, 'blackAnod', 0.15, -0.19, 0.05, { axis: 'z' });
      mmCyl(pendant, 0.03, 0.01, 'chrome', 0.15, -0.19, 0.062, { axis: 'z' });
      mmEstop(pendant, 0.17, 0.22, 0.045, 0, 1);
      mmButtons(pendant, 2, -0.12, -0.2, 0.045, { mats: ['lampGreen', 'red'], gap: 0.05, r: 0.014 });
      // Chip conveyor out of the side into a chip cart, the coolant tank and its pump
      mmRBox(g, 0.4, 0.5, 0.5, 'haas', -w / 2 - 0.22, 0, -0.2, { r: 0.02 });
      mmCyl(g, 0.05, 0.08, 'blue', -w / 2 - 0.12, 0.54, -0.3);
      mmRBox(g, 0.18, 0.12, 0.7, 'anthracite', -w / 2 - 0.12, 0.42, 0.25, { r: 0.015, rx: -0.5 });
      mmRBox(g, 0.32, 0.3, 0.32, 'blue', -w / 2 - 0.2, 0, 0.65, { r: 0.02 });
      mmRod(g, [-w / 2 - 0.22, 0.5, -0.2], [-w / 2 - 0.45, 1.0, -0.2], 0.08, 'dark');
      mmCable(g, [[w / 2 - 0.3, h, -d / 2 + 0.2], [w / 2 - 0.5, h + 0.12, -d / 2 + 0.1], [w / 2 - 0.8, h + 0.05, -d / 2 + 0.05]], 0.03, 'cable');
      const tower = mmLightTower(g, w / 2 - 0.1, h, -d / 2 + 0.1);
      // A work light inside, and a window in the side panel onto the tool changer
      mmBox(g, w * 0.6, 0.03, 0.04, mmMat('lampGreen'), 0, h - 0.62, -d / 2 + 0.12).material = (() => { const m = mmGlow('window'); m.emissive.setHex(0xf8fafc); m.emissiveIntensity = 1.0; return m; })();
      mmBox(g, 0.012, 0.45, 0.6, 'glass', -w / 2 - 0.006, h - 1.25, -d / 2 + 0.45);
      mmBox(g, 0.016, 0.5, 0.012, 'plasticDark', -w / 2 - 0.006, h - 1.275, -d / 2 + 0.15);
      mmBox(g, 0.016, 0.5, 0.012, 'plasticDark', -w / 2 - 0.006, h - 1.275, -d / 2 + 0.75);
      // The side-mount tool changer: a carousel of tool holders beside the column, and its arm
      const atc = mmGroup(g, -w / 2 + 0.38, h - 0.95, -d / 2 + 0.45);
      mmCyl(atc, 0.3, 0.08, 'grey', 0, 0, 0);
      mmCyl(atc, 0.32, 0.12, 'haas', 0, 0.1, 0);
      const carousel = mmGroup(atc, 0, -0.06, 0);
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        mmCyl(carousel, 0.03, 0.1, i % 4 ? 'steel' : 'blue', Math.cos(a) * 0.25, -0.05, Math.sin(a) * 0.25);
        mmCyl(carousel, 0.012, 0.08, 'brass', Math.cos(a) * 0.25, -0.13, Math.sin(a) * 0.25);
      }
      const atcArm = mmGroup(atc, 0.3, -0.12, 0.2);
      mmRBox(atcArm, 0.5, 0.04, 0.06, 'dark', 0.15, 0, 0, { centre: true, r: 0.012 });
      return mmFinish(g, big ? 'haasvs3' : 'haasvs1', { doors, head, spindle, tool, table, vise, tower, carousel, atcArm, streams, chips, plate: { y: tableY + 0.22, z: 0.05 }, travel: { x: w * 0.25, z: d * 0.14 }, w: w + 0.6, d, headY: h - 0.78 });
    }

// --- Waldrich Coburg Taurus: a travelling-gantry mill. Two long rails, a bridge across them riding
// on its legs, the cross slide and the ram with a big milling head, over a long floor table with a workpiece.
function taurusModel(len = 7.4) {
      const g = new THREE.Group();
      const span = 3.0;
      // Foundation, rails with their way covers and cable trough, the T-slot floor table
      mmBox(g, span + 0.8, 0.12, len + 0.4, 'concrete', 0, 0, 0);
      [-1, 1].forEach(s => {
        mmRBox(g, 0.3, 0.35, len, 'wcGrey', s * span / 2, 0.12, 0, { r: 0.02 });
        mmBox(g, 0.12, 0.04, len, 'chrome', s * span / 2, 0.47, 0);
        for (let i = 0; i < 18; i++) mmBox(g, 0.26, 0.012, 0.02, 'steel', s * span / 2, 0.47, -len / 2 + 0.2 + i * (len - 0.4) / 17);
        mmBox(g, 0.2, 0.15, len, 'blackAnod', s * (span / 2 + 0.28), 0.12, 0);
      });
      mmRBox(g, span - 0.9, 0.5, len - 1.2, 'castIron', 0, 0.12, 0, { r: 0.02 });
      for (let i = 0; i < 6; i++) mmBox(g, 0.05, 0.02, len - 1.3, 'steel', -0.85 + i * 0.34, 0.62, 0);
      for (let i = 0; i < 5; i++) mmBox(g, 0.03, 0.006, len - 1.3, 'black', -0.68 + i * 0.34, 0.62, 0);
      // The workpiece (its first child is the casting the job scales as it is cut)
      const work = mmGroup(g, 0, 0.64, 0.2);
      mmBox(work, 1.2, 0.3, 3.2, 'steel', 0, 0, 0);
      [-1, 1].forEach(s => mmBox(g, 1.5, 0.04, 0.2, 'yellow', 0, 0.64, 0.2 + s * 1.7));
      // The gantry bridge
      const gantry = mmGroup(g, 0, 0.5, -len / 2 + 1.2);
      [-1, 1].forEach(s => {
        mmRBox(gantry, 0.5, 3.3, 0.8, 'wcGrey', s * span / 2, 0, 0, { r: 0.04 });
        mmRBox(gantry, 0.56, 0.2, 0.9, 'dark', s * span / 2, 0, 0, { r: 0.02 });
        mmBox(gantry, 0.006, 1.6, 0.5, 'black', s * (span / 2 + 0.251), 0.5, 0);
        mmHandle(gantry, 0.25, s * (span / 2 + 0.25), 1.3, 0.15, { ry: s * Math.PI / 2 });
      });
      mmRBox(gantry, span + 0.5, 0.75, 0.8, 'wcGrey', 0, 3.3, 0, { r: 0.05 });
      mmBox(gantry, span + 0.5, 0.06, 0.82, 'anthracite', 0, 3.3, 0);
      mmBox(gantry, span - 0.4, 0.05, 0.06, 'chrome', 0, 3.42, 0.42);
      mmBox(gantry, span - 0.4, 0.05, 0.06, 'chrome', 0, 3.9, 0.42);
      mmPlate(gantry, 0.4, 0.15, span / 2 - 0.2, 3.75, 0.405);
      mmCable(gantry, [[span / 2 + 0.3, 3.0, -0.3], [span / 2 + 0.5, 1.6, -0.45], [span / 2 + 0.55, 0.0, -0.3]], 0.05, 'cable');
      // Operator's platform riding along on one leg: grating, railing, control panel
      const cab = mmGroup(gantry, span / 2 + 0.55, 1.4, 0);
      mmBox(cab, 0.6, 0.06, 0.9, 'dark', 0, 0, 0);
      [-0.4, 0, 0.4].forEach(z => mmBox(cab, 0.04, 0.95, 0.04, 'yellow', 0.28, 0.06, z));
      [0.5, 0.95].forEach(y => mmBox(cab, 0.04, 0.04, 0.84, 'yellow', 0.28, y, 0));
      mmBox(cab, 0.6, 0.004, 0.86, 'steel', 0, 0.06, 0);
      mmRBox(cab, 0.32, 0.45, 0.08, 'anthracite', 0, 0.06, -0.3, { r: 0.015 });
      mmBox(cab, 0.26, 0.16, 0.005, mmHmiMat(), 0, 0.3, -0.258);
      mmEstop(cab, 0.1, 0.18, -0.26, 0, 1);
      // Cross slide and the ram (moves along x, then down)
      const slide = mmGroup(gantry, 0, 3.0, 0.45);
      mmRBox(slide, 0.7, 0.9, 0.35, 'wcGrey', 0, 0, 0, { r: 0.03 });
      mmCyl(slide, 0.09, 0.2, 'anthracite', 0, 1.0, -0.05);
      const ram = mmGroup(slide, 0, -0.2, 0.05);
      mmRBox(ram, 0.42, 2.1, 0.42, 'lightGrey', 0, -1.8, 0, { r: 0.03 });
      const head = mmGroup(ram, 0, -1.85, 0);
      mmRBox(head, 0.55, 0.3, 0.55, 'castIron', 0, 0, 0, { r: 0.04 });
      const cutter = mmCyl(head, 0.2, 0.08, 'chrome', 0, -0.04, 0);
      for (let i = 0; i < 8; i++) mmBox(cutter, 0.12, 0.6, 0.12, 'gold', Math.cos(i * 0.785) * 0.95, -0.1, Math.sin(i * 0.785) * 0.95);
      mmCyl(head, 0.06, 0.12, 'steel', 0, 0.02, 0);
      const tower = mmLightTower(gantry, -span / 2, 3.35, 0.3);
      return mmFinish(g, 'taurus', { gantry, slide, ram, head, cutter, work, tower, len, span, plate: { y: 0.94, z: 0.2 }, w: span + 0.8, d: len + 0.4 });
    }

// --- Electronics line ----------------------------------------------------------------------------
// A conveyor-fed SMT box with a window and a light tower
function smtBoxModel(name, label, w, h, d, body = 'white', accent = 'navy') {
      const g = new THREE.Group();
      // Lower cabinet: two service doors with pulls, on levelling feet
      mmRBox(g, w, 0.71, d, 'lightGrey', 0, 0.04, 0, { r: 0.02 });
      mmFeet(g, w, d, { inset: 0.06 });
      mmBox(g, 0.006, 0.6, 0.004, 'black', 0, 0.1, d / 2 + 0.001);
      [-1, 1].forEach(s => mmHandle(g, 0.14, s * 0.08, 0.45, d / 2, { mat: 'plasticDark', off: 0.02 }));
      mmPlate(g, 0.1, 0.05, w / 2 - 0.1, 0.65, d / 2 + 0.003);
      // Upper body with a rounded hood, the accent band, a smoked hood window
      mmRBox(g, w, h - 0.75, d, body === 'white' ? 'offWhite' : body, 0, 0.75, 0, { r: 0.03 });
      mmRBox(g, w + 0.01, 0.06, d + 0.01, accent, 0, h - 0.12, 0, { r: 0.012 });
      const window = mmBox(g, w * 0.6, (h - 0.75) * 0.5, 0.01, 'smoked', 0, 0.85, d / 2 + 0.003);
      mmFrame(g, w * 0.6 + 0.03, (h - 0.75) * 0.5 + 0.03, 0.015, 0, 0.835, d / 2 + 0.004, 'plasticDark', 0.008);
      mmHandle(g, w * 0.3, 0, 0.84 + (h - 0.75) * 0.5, d / 2 + 0.005, { axis: 'x', mat: 'plasticDark', off: 0.02 });
      [-1, 1].forEach(s => mmVents(g, d * 0.4, 0.12, s * (w / 2 + 0.002), h - 0.35, 0, { ry: s * Math.PI / 2, n: 4 }));
      // The conveyor rails running through it, left to right, with the in and out shelves
      mmBox(g, w + 0.2, 0.03, 0.02, 'alu', 0, 0.9, 0.06);
      mmBox(g, w + 0.2, 0.03, 0.02, 'alu', 0, 0.9, -0.06);
      [-1, 1].forEach(s => { mmBox(g, 0.1, 0.02, 0.16, 'plasticDark', s * (w / 2 + 0.05), 0.88, 0); mmBox(g, 0.04, 0.06, 0.04, 'blackAnod', s * (w / 2 + 0.08), 0.84, -0.09); });
      mmEstop(g, -w / 2 + 0.08, 0.68, d / 2, 0, 0.8);
      const tower = mmLightTower(g, w / 2 - 0.06, h, -d / 2 + 0.06);
      const out = { tower, window, w, h, d, railY: 0.93 };
      Object.defineProperty(out, 'g', { value: g, enumerable: false });
      return out;
    }

function pastePrinterModel() {
      const s = smtBoxModel('paste', '', 0.9, 1.35, 0.8);
      const squeegee = mmGroup(s.g, 0, 0.98, 0);
      mmBox(squeegee, 0.04, 0.06, 0.2, 'steel', -0.15, 0, 0, { rz: 0.4 });
      mmBox(squeegee, 0.05, 0.03, 0.22, 'blackAnod', -0.16, 0.05, 0, { rz: 0.4 });
      mmBox(s.g, 0.32, 0.005, 0.26, 'chrome', 0, 0.96, 0);
      mmFrame(s.g, 0.36, 0.3, 0.02, 0, 0.958, -0.15, 'alu', 0.008);
      mmSmtConsole(s.g, 0.32, 1.0, 0.42);
      return mmFinish(s.g, 'paste', { ...s, squeegee, plate: { y: s.railY } });
    }

function pickPlaceModel() {
      const s = smtBoxModel('pnp', '', 1.2, 1.45, 0.95);
      const head = mmGroup(s.g, 0, 1.15, 0);
      mmRBox(head, 0.14, 0.12, 0.1, 'blackAnod', 0, 0, 0, { r: 0.015 });
      for (let i = 0; i < 4; i++) mmCyl(head, 0.006, 0.08, 'chrome', -0.045 + i * 0.03, -0.08, 0);
      mmCyl(head, 0.015, 0.03, 'plasticDark', 0.06, -0.03, 0.04);
      // The X beam over the board and the feeder bank of component reels along the front
      mmRBox(s.g, 1.0, 0.06, 0.08, 'alu', 0, 1.24, 0.0, { r: 0.012 });
      mmBox(s.g, 1.0, 0.05, 0.1, 'plasticDark', 0, 0.73, 0.42);
      for (let i = 0; i < 9; i++) {
        mmBox(s.g, 0.05, 0.3, 0.2, 'lightGrey', -0.48 + i * 0.12, 0.75, 0.42);
        mmCyl(s.g, 0.08, 0.02, i % 3 ? 'black' : 'blue', -0.48 + i * 0.12, 1.0, 0.5, { axis: 'x' });
        mmCyl(s.g, 0.03, 0.022, 'offWhite', -0.48 + i * 0.12, 1.0, 0.5, { axis: 'x' });
      }
      mmBox(s.g, 0.04, 0.1, 0.04, 'anthracite', -0.4, 1.45, 0.3);
      mmScreen(s.g, 0.24, 0.16, -0.4, 1.63, 0.32).rotation.x = -0.15;
      return mmFinish(s.g, 'pnp', { ...s, head, plate: { y: s.railY } });
    }

function reflowOvenModel() {
      const s = smtBoxModel('reflow', '', 2.0, 1.25, 0.8, 'white', 'red');
      const zones = [];
      for (let i = 0; i < 8; i++) zones.push(mmBox(s.g, 0.2, 0.02, 0.5, mmGlow('hot'), -0.8 + i * 0.23, 1.15, 0));
      // The hood (lifts for service): heater blowers on top of each zone, exhaust stacks, the mesh belt
      mmRBox(s.g, 2.0, 0.1, 0.8, 'lightGrey', 0, 1.25, 0, { r: 0.02 });
      for (let i = 0; i < 8; i++) mmCyl(s.g, 0.06, 0.05, 'anthracite', -0.8 + i * 0.23, 1.37, 0);
      [-0.7, 0.7].forEach(x => { mmCyl(s.g, 0.05, 0.3, 'steel', x, 1.5, -0.25); mmCyl(s.g, 0.06, 0.03, 'steel', x, 1.36, -0.25); });
      mmBox(s.g, 2.15, 0.006, 0.14, 'steel', 0, 0.905, 0);
      mmSmtConsole(s.g, 0.85, 0.9, 0.42);
      return mmFinish(s.g, 'reflow', { ...s, zones, plate: { y: s.railY } });
    }

function aoiModel() {
      const s = smtBoxModel('aoi', '', 0.9, 1.4, 0.8, 'white', 'teal');
      const cam = mmGroup(s.g, 0, 1.12, 0);
      mmRBox(cam, 0.12, 0.14, 0.12, 'blackAnod', 0, 0, 0, { r: 0.015 });
      mmCyl(cam, 0.04, 0.04, 'plasticDark', 0, 0.16, 0);
      const ring = mmCyl(cam, 0.07, 0.015, mmGlow('laser'), 0, -0.01, 0);
      mmRBox(s.g, 0.8, 0.06, 0.08, 'alu', 0, 1.3, 0, { r: 0.012 });
      mmScreen(s.g, 0.26, 0.17, 0.25, 1.2, 0.42).rotation.x = -0.1;
      mmBox(s.g, 0.04, 0.2, 0.04, 'anthracite', 0.25, 1.0, 0.4);
      return mmFinish(s.g, 'aoi', { ...s, cam, ring, plate: { y: s.railY } });
    }

function waveSolderModel() {
      const s = smtBoxModel('wave', '', 1.7, 1.3, 0.8, 'white', 'orange');
      const pot = mmBox(s.g, 0.4, 0.06, 0.4, mmGlow('hot'), 0.2, 0.83, 0);
      const wave = mmBox(s.g, 0.36, 0.05, 0.06, 'chrome', 0.2, 0.89, 0);
      const preheat = mmBox(s.g, 0.4, 0.02, 0.4, mmGlow('hot'), -0.4, 0.83, 0);
      mmBox(s.g, 0.44, 0.08, 0.44, 'steel', 0.2, 0.76, 0);
      mmCyl(s.g, 0.06, 0.6, 'steel', 0.6, 1.6, -0.2);
      mmCyl(s.g, 0.08, 0.04, 'steel', 0.6, 1.32, -0.2);
      mmCyl(s.g, 0.08, 0.2, 'blue', -0.75, 0.15, 0.25);
      mmSmtConsole(s.g, -0.6, 0.95, 0.42);
      return mmFinish(s.g, 'wave', { ...s, pot, wave, preheat, plate: { y: s.railY } });
    }

function pcbMillModel() {
      const g = new THREE.Group();
      mmRBox(g, 0.65, 0.45, 0.55, 'lightGrey', 0, 0, 0, { r: 0.025 });
      mmBox(g, 0.65, 0.35, 0.55, 'smoked', 0, 0.45, 0);
      [-1, 1].forEach(sx => [-1, 1].forEach(sz => mmBox(g, 0.02, 0.35, 0.02, 'lightGrey', sx * 0.315, 0.45, sz * 0.265)));
      mmRBox(g, 0.67, 0.03, 0.57, 'lightGrey', 0, 0.8, 0, { r: 0.01 });
      mmHandle(g, 0.2, 0, 0.6, 0.28, { axis: 'x', mat: 'plasticDark', off: 0.02 });
      mmBox(g, 0.5, 0.01, 0.4, 'dark', 0, 0.45, 0);
      const gantry = mmGroup(g, 0, 0.62, 0);
      mmBox(gantry, 0.04, 0.05, 0.48, 'grey', 0, 0, 0);
      const head = mmGroup(gantry, 0.03, 0, 0);
      mmCyl(head, 0.025, 0.1, 'dark', 0, -0.05, 0);
      mmCyl(head, 0.004, 0.04, 'chrome', 0, -0.12, 0);
      mmCyl(head, 0.03, 0.02, 'plasticDark', 0, -0.1, 0);
      mmVents(g, 0.3, 0.1, -0.1, 0.25, 0.276, { n: 4 });
      mmCyl(g, 0.012, 0.01, 'lampGreen', 0.25, 0.3, 0.276, { axis: 'z' });
      mmCable(g, [[0.25, 0.75, -0.2], [0.4, 0.9, -0.3], [0.45, 0.2, -0.35]], 0.025, 'plasticGrey');
      return mmFinish(g, 'pcbmill', { gantry, head, plate: { y: 0.46 }, travel: { x: 0.18, z: 0.15 } });
    }

function laserCutterModel() {
      const g = new THREE.Group();
      mmRBox(g, 1.1, 0.71, 0.75, 'anthracite', 0, 0.04, 0, { r: 0.025 });
      mmFeet(g, 1.1, 0.75, { casters: true, inset: 0.08 });
      mmRBox(g, 1.1, 0.12, 0.75, 'lightGrey', 0, 0.75, 0, { r: 0.02 });
      const lid = mmGroup(g, 0, 0.87, -0.37);
      mmRBox(lid, 1.08, 0.04, 0.72, 'anthracite', 0, 0.12, 0.36, { r: 0.015 });
      mmBox(lid, 0.8, 0.02, 0.4, 'amberGlass', 0, 0.15, 0.36);
      mmHandle(lid, 0.4, 0, 0.14, 0.72, { axis: 'x', mat: 'plasticDark', off: 0.02 });
      const gantry = mmGroup(g, 0, 0.84, 0);
      mmBox(gantry, 0.05, 0.03, 0.6, 'alu', 0, 0, 0);
      const head = mmGroup(gantry, 0, 0, 0);
      mmBox(head, 0.05, 0.05, 0.05, 'dark', 0, -0.02, 0);
      const beam = mmSphere(head, 0.01, mmGlow('laser'), 0, -0.05, 0);
      beam.material.emissive.setHex(0xff3b3b);
      mmRBox(g, 0.18, 0.12, 0.02, 'plasticDark', 0.4, 0.55, 0.375, { r: 0.008 });
      mmScreen(g, 0.1, 0.07, 0.4, 0.6, 0.38);
      mmEstop(g, 0.4, 0.45, 0.375, 0, 0.8);
      mmBox(g, 0.5, 0.4, 0.004, 'black', -0.2, 0.15, 0.376);
      mmHandle(g, 0.2, -0.2, 0.5, 0.375, { axis: 'x', mat: 'plasticDark', off: 0.02 });
      mmCyl(g, 0.07, 0.1, 'steel', 0.3, 0.5, -0.4, { axis: 'z' });
      mmCable(g, [[0.3, 0.5, -0.45], [0.3, 0.7, -0.6], [0.3, 1.6, -0.62]], 0.07, 'steel');
      return mmFinish(g, 'laser', { lid, gantry, head, beam, plate: { y: 0.8 }, travel: { x: 0.4, z: 0.2 } });
    }

// A lab bench (ESD mat, scope and soldering station) where the boards are tested and assembled
function esdBenchModel() {
      const g = workBenchModel(1.6, 0.7, 'bench');
      mmBox(g, 1.5, 0.005, 0.6, 'teal', 0, 0.98, 0.02);
      // Oscilloscope with its screen and knobs, a bench power supply, the soldering station and iron
      mmRBox(g, 0.32, 0.18, 0.22, 'lightGrey', -0.45, 0.985, -0.15, { r: 0.015 });
      mmBox(g, 0.18, 0.12, 0.005, mmHmiMat(), -0.5, 1.01, -0.037);
      for (let i = 0; i < 6; i++) mmCyl(g, 0.01, 0.01, 'plasticDark', -0.36 + (i % 2) * 0.04, 1.03 + Math.floor(i / 2) * 0.04, -0.037, { axis: 'z' });
      mmRBox(g, 0.18, 0.1, 0.16, 'anthracite', 0.45, 0.985, -0.15, { r: 0.012 });
      mmBox(g, 0.08, 0.03, 0.005, mmMat('lampRed'), 0.42, 1.04, -0.069);
      mmCyl(g, 0.015, 0.01, 'red', 0.5, 1.02, -0.069, { axis: 'z' });
      mmCyl(g, 0.03, 0.08, 'steel', 0.65, 1.02, -0.1, { rz: 0.6 });
      mmCable(g, [[0.45, 1.0, -0.07], [0.55, 0.99, 0.0], [0.62, 1.02, -0.06]], 0.005);
      // Fume extractor arm and a magnifier lamp
      mmRBox(g, 0.12, 0.12, 0.1, 'anthracite', 0.15, 0.985, -0.25, { r: 0.015 });
      mmRod(g, [0.15, 1.1, -0.25], [0.2, 1.35, -0.1], 0.015, 'alu');
      mmRod(g, [0.2, 1.35, -0.1], [0.12, 1.25, 0.05], 0.015, 'alu');
      mmCyl(g, 0.06, 0.03, 'plasticDark', 0.12, 1.23, 0.06);
      mmRod(g, [-0.72, 0.985, -0.3], [-0.65, 1.5, -0.25], 0.01, 'offWhite');
      mmRod(g, [-0.65, 1.5, -0.25], [-0.45, 1.4, 0.0], 0.01, 'offWhite');
      mmCyl(g, 0.08, 0.025, 'offWhite', -0.45, 1.38, 0.02);
      return mmFinish(g, 'esd', { top: 0.99 });
    }

// --- Garage ------------------------------------------------------------------------------------------
// A two-post lift: two columns, a carriage on each with swing arms; the carriages ride up (userData.carriage)
function twoPostLiftModel(span = 3.7, armLen = 1.6) {
      const g = new THREE.Group();
      const carriages = [];
      [-1, 1].forEach(s => {
        const x = s * span / 2;
        // Base plate with anchor bolts, the formed-steel column with its lock ladder and cover
        mmBox(g, 0.5, 0.05, 0.5, 'dark', x, 0, 0);
        [-1, 1].forEach(a => [-1, 1].forEach(b => mmCyl(g, 0.015, 0.03, 'steel', x + a * 0.2, 0.06, b * 0.2, { seg8: true })));
        mmRBox(g, 0.3, 3.4, 0.3, 'blue', x, 0, 0, { r: 0.03 });
        mmBox(g, 0.12, 3.3, 0.04, 'steel', x - s * 0.17, 0.05, 0);
        for (let i = 0; i < 14; i++) mmBox(g, 0.1, 0.012, 0.02, 'castIron', x - s * 0.17, 0.4 + i * 0.2, 0.025);
        mmRBox(g, 0.18, 0.18, 0.08, 'yellow', x, 0.6, 0.18, { r: 0.015 });     // the door guard pad
        const c = mmGroup(g, x - s * 0.22, 0.2, 0);
        mmRBox(c, 0.16, 0.4, 0.28, 'dark', 0, 0, 0, { r: 0.015 });
        mmCyl(c, 0.025, 0.06, 'yellow', -s * 0.05, 0.36, 0.15, { axis: 'z' });   // lock release
        [-1, 1].forEach(z => {
          const arm = mmGroup(c, 0, 0.05, z * 0.1);
          mmRBox(arm, armLen * 0.6, 0.09, 0.11, 'yellow', -s * armLen * 0.3, 0, 0, { r: 0.015 });
          mmRBox(arm, armLen * 0.5, 0.07, 0.08, 'yellow', -s * armLen * 0.72, 0.01, 0, { r: 0.012 });
          mmCyl(arm, 0.075, 0.03, 'steel', -s * (armLen - 0.05), 0.08, 0);
          mmCyl(arm, 0.07, 0.05, 'rubber', -s * (armLen - 0.05), 0.12, 0);
          mmCyl(arm, 0.04, 0.12, 'steel', 0, 0.02, 0);
          arm.rotation.y = s * z * 0.75;
        });
        carriages.push(c);
      });
      // Overhead beam with its shut-off bar, the equaliser cables and hydraulic hose
      mmRBox(g, span + 0.3, 0.2, 0.25, 'blue', 0, 3.4, 0, { r: 0.03 });
      mmBox(g, span - 0.4, 0.03, 0.03, 'red', 0, 3.3, 0.06);
      mmRod(g, [-span / 2 + 0.1, 3.4, 0.08], [span / 2 - 0.1, 3.4, 0.08], 0.008, 'steel');
      mmCable(g, [[span / 2 + 0.3, 1.25, 0.2], [span / 2 + 0.16, 1.6, 0.15], [span / 2 + 0.1, 3.3, 0.1], [0, 3.62, 0.0], [-span / 2 + 0.1, 3.3, 0.1]], 0.012, 'rubber', 30);
      mmPlate(g, 0.2, 0.12, 0, 3.5, 0.128);
      // Hydraulic power unit: motor, pump, reservoir and the up button
      mmRBox(g, 0.25, 0.5, 0.25, 'dark', span / 2 + 0.3, 1.0, 0.2, { r: 0.02 });
      mmCyl(g, 0.09, 0.22, 'blue', span / 2 + 0.3, 0.88, 0.2, { axis: 'z' });
      mmRBox(g, 0.12, 0.16, 0.025, 'plasticDark', span / 2 + 0.3, 1.25, 0.34, { r: 0.008 });
      mmCyl(g, 0.02, 0.02, 'lampGreen', span / 2 + 0.3, 1.35, 0.355, { axis: 'z' });
      return mmFinish(g, 'lift2', { carriages, liftY: 0.2, w: span + 0.6, d: 0.6 });
    }

// A four-post lift: four columns, two runways with ramps that rise together (userData.runways)
function fourPostLiftModel(len = 6.4, gauge = 2.2) {
      const g = new THREE.Group();
      [-1, 1].forEach(sx => [-1, 1].forEach(sz => {
        const x = sx * (gauge / 2 + 0.55), z = sz * (len / 2 + 0.1);
        mmBox(g, 0.4, 0.04, 0.4, 'dark', x, 0, z);
        mmRBox(g, 0.22, 2.8, 0.22, 'red', x, 0, z, { r: 0.025 });
        mmBox(g, 0.08, 2.6, 0.02, 'castIron', x, 0.1, z - sz * 0.115);
        mmCyl(g, 0.06, 0.05, 'steel', x, 2.82, z);
      }));
      const runways = mmGroup(g, 0, 0.1, 0);
      [-1, 1].forEach(s => {
        mmRBox(runways, 0.55, 0.12, len, 'steel', s * gauge / 2, 0, 0, { r: 0.015 });
        for (let i = 0; i < 16; i++) mmBox(runways, 0.5, 0.008, 0.03, 'castIron', s * gauge / 2, 0.12, -len / 2 + 0.3 + i * (len - 0.6) / 15);
        mmBox(runways, 0.05, 0.08, len, 'yellow', s * (gauge / 2 + 0.3), 0.04, 0);
      });
      mmCyl(runways, 0.04, len * 0.8, 'chrome', -gauge / 2 + 0.05, -0.05, 0, { axis: 'z' });
      [-1, 1].forEach(sz => mmRBox(runways, gauge + 1.3, 0.18, 0.3, 'red', 0, 0, sz * (len / 2 + 0.1), { r: 0.025 }));
      // Drive-on ramps at the front and the wheel stops at the back
      [-1, 1].forEach(s => mmBox(g, 0.55, 0.04, 0.8, 'steel', s * gauge / 2, 0.05, len / 2 + 0.6, { rx: 0.15 }));
      [-1, 1].forEach(s => mmBox(runways, 0.5, 0.08, 0.06, 'yellow', s * gauge / 2, 0.12, -len / 2 + 0.1));
      // Power unit on the front post and its hose
      const px = gauge / 2 + 0.75, pz = len / 2 + 0.1;
      mmRBox(g, 0.22, 0.45, 0.22, 'dark', px, 1.0, pz, { r: 0.02 });
      mmCyl(g, 0.08, 0.2, 'red', px, 0.9, pz, { axis: 'z' });
      mmBox(g, 0.08, 0.1, 0.02, 'lampGreen', px, 1.3, pz + 0.12);
      return mmFinish(g, 'lift4', { runways, liftY: 0.1, w: gauge + 1.6, d: len + 0.6 });
    }

// A rim-clamp tire changer (the Coats / Hunter shape): a low cabinet with the clamping turntable on
// top, a tilt-back column at the rear with the swing arm and the hex shaft carrying the mount/demount
// head, the bead breaker on the right side (a long arm with its blade, the rubber pad on the cabinet
// and the air cylinder behind), the inflation gauge on the column and the foot pedals at the front.
// Front is +z.
function tireChangerModel() {
      const g = new THREE.Group();
      const cw = 0.68, cd = 0.82, ch = 0.82;
      // Cabinet: red sheet steel with a dark kick plate and a lid
      mmRBox(g, cw, ch - 0.06, cd, 'red', 0, 0.06, 0, { r: 0.03 });
      mmRBox(g, cw + 0.04, 0.06, cd + 0.04, 'dark', 0, 0, 0, { r: 0.01 });
      mmRBox(g, cw + 0.02, 0.03, cd + 0.02, 'dark', 0, ch, 0, { r: 0.01 });
      mmVents(g, 0.3, 0.1, 0, 0.5, cd / 2 + 0.002, { n: 4 });
      mmPlate(g, 0.12, 0.06, 0.2, 0.68, cd / 2 + 0.003);
      // Bead lube bucket and brush on the side, a tray of valve stems on the lid
      mmCyl(g, 0.07, 0.12, 'plasticGrey', -cw / 2 - 0.08, 0.6, -0.2);
      mmRBox(g, 0.18, 0.03, 0.12, 'plasticDark', -0.18, ch + 0.03, cd / 2 - 0.1, { r: 0.008 });
      // The turntable: a disc with four sliding rim jaws in their slots
      const turntable = mmGroup(g, 0, ch + 0.03, 0.06);
      mmCyl(turntable, 0.31, 0.05, 'dark', 0, 0.025, 0);
      mmCyl(turntable, 0.06, 0.07, 'chrome', 0, 0.06, 0);
      const jaws = [];
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        const slot = mmGroup(turntable, 0, 0.05, 0);
        slot.rotation.y = a;
        mmBox(slot, 0.32, 0.012, 0.05, 'black', 0.15, 0, 0);
        const jaw = mmGroup(slot, 0.27, 0, 0);
        mmBox(jaw, 0.08, 0.06, 0.07, 'steel', 0, 0, 0);
        mmBox(jaw, 0.02, 0.05, 0.05, 'chrome', -0.04, 0.06, 0);
        jaws.push(jaw);
      }
      // The wheel being worked on (on the turntable), and one stood at the bead breaker
      const wheel = mmGroup(turntable, 0, 0.2, 0);
      mmCyl(wheel, 0.36, 0.22, 'tire', 0, 0, 0);
      mmCyl(wheel, 0.24, 0.235, 'chrome', 0, 0, 0);
      mmCyl(wheel, 0.06, 0.24, 'dark', 0, 0, 0);
      wheel.visible = false;
      const sideWheel = mmGroup(g, cw / 2 + 0.16, 0.37, 0.12);
      mmCyl(sideWheel, 0.36, 0.22, 'tire', 0, 0, 0, { axis: 'x' });
      mmCyl(sideWheel, 0.24, 0.235, 'chrome', 0, 0, 0, { axis: 'x' });
      sideWheel.visible = false;
      // The tilt-back column at the rear, the swing arm over the turntable, the hex shaft and the head
      const column = mmGroup(g, 0, ch, -cd / 2 + 0.06);
      mmBox(g, 0.2, 0.08, 0.16, 'dark', 0, ch - 0.02, -cd / 2 + 0.06);
      mmBox(column, 0.13, 0.95, 0.13, 'red', 0, 0, 0);
      mmBox(column, 0.16, 0.12, 0.16, 'dark', 0, 0.88, 0);
      const arm = mmGroup(column, 0, 0.88, 0);
      mmBox(arm, 0.11, 0.1, 0.5, 'red', 0, 0, 0.27);
      mmBox(arm, 0.12, 0.14, 0.1, 'dark', 0, -0.02, 0.5);
      mmBox(arm, 0.05, 0.05, 0.08, 'black', 0.07, 0.03, 0.5);             // the shaft lock
      const shaft = mmGroup(arm, 0, 0, 0.5);
      mmCyl(shaft, 0.025, 0.62, 'chrome', 0, -0.28, 0, { seg8: true });
      const mountHead = mmGroup(shaft, 0, -0.6, 0);
      mmBox(mountHead, 0.07, 0.07, 0.06, 'dark', 0, 0, 0);
      mmBox(mountHead, 0.03, 0.05, 0.12, 'black', 0.03, -0.05, 0.05, { rx: 0.35 });   // the duck head's nylon toe
      mmBox(mountHead, 0.04, 0.02, 0.06, 'black', -0.03, -0.06, -0.02);
      mountHead.position.y = -0.6;
      // Inflation: the gauge on the column with its hose and chuck
      const gauge = mmGroup(column, 0.09, 0.55, 0.0);
      mmCyl(gauge, 0.055, 0.03, 'white', 0, 0, 0, { axis: 'x' });
      mmCyl(gauge, 0.06, 0.02, 'dark', -0.012, 0, 0, { axis: 'x' });
      mmRod(column, [0.09, 0.5, 0], [0.22, -0.2, 0.15], 0.01, 'black');
      mmBox(column, 0.03, 0.06, 0.03, 'chrome', 0.22, -0.25, 0.15);
      // The bead breaker: blade on a long arm hinged at the back of the right side, the rubber pad
      // on the cabinet it pushes the tire against, and the air cylinder driving it
      const side = cw / 2;
      mmBox(g, 0.03, 0.42, 0.34, 'black', side + 0.015, 0.16, 0.12);       // rubber pad
      const breaker = mmGroup(g, side + 0.1, 0.72, -0.3);
      mmBox(g, 0.12, 0.14, 0.12, 'dark', side + 0.06, 0.66, -0.3);          // the hinge bracket
      mmRod(breaker, [0, 0, 0], [0.42, -0.42, 0.42], 0.03, 'red');
      mmRod(breaker, [0.42, -0.42, 0.42], [0.42, -0.5, 0.42], 0.02, 'red');
      mmBox(breaker, 0.03, 0.16, 0.2, 'steel', 0.36, -0.52, 0.42);         // the blade
      mmRod(breaker, [0.42, -0.42, 0.42], [0.55, -0.12, 0.62], 0.012, 'black'); // the handle
      mmRod(g, [side + 0.02, 0.25, -0.3], [side + 0.32, 0.38, -0.05], 0.045, 'chrome'); // the cylinder
      // The pedals: clamp jaws, bead breaker, turntable (forward / reverse)
      [-0.2, -0.05, 0.1, 0.24].forEach((x, i) => mmBox(g, 0.09, 0.035, 0.2, i === 3 ? 'chrome' : 'dark', x, 0.04, cd / 2 + 0.08, { rx: -0.22 }));
      // A tire iron on its hooks and the air line to the wall drop
      mmBox(g, 0.03, 0.05, 0.05, 'dark', -cw / 2 - 0.02, 0.62, 0.15);
      mmBox(g, 0.03, 0.05, 0.05, 'dark', -cw / 2 - 0.02, 0.62, -0.15);
      mmBox(g, 0.02, 0.025, 0.55, 'chrome', -cw / 2 - 0.04, 0.66, 0);
      mmRod(g, [-0.2, 0.3, -cd / 2], [-0.35, 1.7, -cd / 2 - 0.2], 0.015, 'yellow');
      return mmFinish(g, 'tirechanger', { turntable, jaws, wheel, sideWheel, column, arm, shaft, mountHead, breaker, gauge, w: 1.0, d: 0.8 });
    }

function wheelBalancerModel() {
      const g = new THREE.Group();
      mmRBox(g, 0.6, 0.85, 0.5, 'lightGrey', 0, 0, 0, { r: 0.03 });
      mmBox(g, 0.56, 0.05, 0.46, 'dark', 0, 0, 0);
      mmRBox(g, 0.62, 0.05, 0.52, 'red', 0, 0.85, 0, { r: 0.015 });
      for (let i = 0; i < 6; i++) mmBox(g, 0.07, 0.02, 0.16, i % 2 ? 'steel' : 'castIron', -0.2 + i * 0.08, 0.89, 0.12);
      mmRBox(g, 0.04, 0.3, 0.04, 'dark', 0, 0.9, -0.12, { r: 0.01 });
      mmScreen(g, 0.3, 0.2, 0, 1.25, -0.1).rotation.x = -0.15;
      mmRBox(g, 0.34, 0.08, 0.1, 'plasticDark', 0, 1.08, -0.06, { r: 0.012, rx: -0.4 });
      mmVents(g, 0.3, 0.12, 0, 0.3, 0.251, { n: 4 });
      mmCyl(g, 0.012, 0.18, 'chrome', -0.2, 0.55, 0.28, { axis: 'x' });       // the arm gauge
      const shaft = mmGroup(g, 0.35, 0.6, 0);
      mmCyl(shaft, 0.03, 0.3, 'chrome', 0.15, 0, 0, { axis: 'x' });
      mmCyl(shaft, 0.08, 0.04, 'steel', 0.02, 0, 0, { axis: 'x' });
      mmCyl(shaft, 0.04, 0.05, 'plasticDark', 0.32, 0, 0, { axis: 'x' });
      const wheel = mmGroup(shaft, 0.28, 0, 0);
      mmCyl(wheel, 0.38, 0.24, 'tire', 0, 0, 0, { axis: 'x' });
      mmCyl(wheel, 0.22, 0.26, 'chrome', 0, 0, 0, { axis: 'x' });
      wheel.visible = false;
      const hood = mmGroup(g, 0.4, 0.95, -0.2);
      mmRBox(hood, 0.6, 0.06, 0.5, 'lightGrey', 0.2, 0, 0.2, { r: 0.02 });
      [-1, 1].forEach(s => mmBox(hood, 0.6, 0.18, 0.02, 'lightGrey', 0.2, -0.16, 0.2 + s * 0.24));
      hood.rotation.z = 1.1;
      return mmFinish(g, 'balancer', { shaft, wheel, hood, w: 1.2, d: 0.6 });
    }

function brakeLatheModel() {
      const g = new THREE.Group();
      mmRBox(g, 0.9, 0.8, 0.5, 'navy', 0, 0, 0, { r: 0.025 });
      mmBox(g, 0.86, 0.04, 0.46, 'dark', 0, 0, 0);
      mmBox(g, 0.004, 0.6, 0.004, 'black', 0, 0.1, 0.251);
      [-0.22, 0.22].forEach(x => mmHandle(g, 0.12, x * 0.4, 0.6, 0.25, { mat: 'plasticDark', off: 0.02 }));
      for (let i = 0; i < 4; i++) mmCyl(g, 0.025, 0.12, i % 2 ? 'steel' : 'castIron', -0.3 + i * 0.06, 0.86, -0.15);
      mmRBox(g, 1.0, 0.25, 0.45, 'lightGrey', 0, 0.8, 0, { r: 0.03 });
      mmRBox(g, 0.4, 0.2, 0.35, 'castIron', -0.2, 1.05, 0, { r: 0.03 });
      mmCyl(g, 0.06, 0.06, 'blackAnod', -0.2, 1.15, 0.2, { axis: 'z' });
      mmCyl(g, 0.05, 0.02, 'chrome', 0.1, 1.0, 0.24, { axis: 'z' });
      const arbor = mmGroup(g, 0.25, 1.15, 0);
      mmCyl(arbor, 0.025, 0.4, 'chrome', 0, 0, 0, { axis: 'x' });
      mmCyl(arbor, 0.05, 0.04, 'steel', -0.05, 0, 0, { axis: 'x' });
      const rotor = mmGroup(arbor, 0.15, 0, 0);
      mmCyl(rotor, 0.2, 0.05, 'steel', 0, 0, 0, { axis: 'x' });
      mmCyl(rotor, 0.1, 0.12, 'dark', -0.05, 0, 0, { axis: 'x' });
      rotor.visible = false;
      const bits = mmGroup(g, 0.4, 1.12, 0.2);
      mmBox(bits, 0.04, 0.04, 0.2, 'dark', 0, 0, 0);
      mmBox(bits, 0.08, 0.06, 0.08, 'castIron', 0, -0.04, 0.08);
      mmBox(g, 0.3, 0.2, 0.01, 'smoked', 0.35, 1.05, 0.27);
      return mmFinish(g, 'brakelathe', { arbor, rotor, bits, w: 1.0, d: 0.5 });
    }

function engineHoistModel() {
      const g = new THREE.Group();
      [-0.32, 0.32].forEach(x => {
        mmRBox(g, 0.08, 0.08, 1.4, 'red', x, 0.06, 0.4, { r: 0.012 });
        mmCyl(g, 0.05, 0.04, 'rubber', x, 0.05, 1.05, { axis: 'x' });
        mmBox(g, 0.06, 0.03, 0.06, 'steel', x, 0.1, 1.05);
        mmCyl(g, 0.012, 0.06, 'steel', x, 0.13, 0.7, { seg8: true });
      });
      mmRBox(g, 0.72, 0.08, 0.08, 'red', 0, 0.06, -0.25, { r: 0.012 });
      [-0.3, 0.3].forEach(x => mmCyl(g, 0.05, 0.04, 'rubber', x, 0.05, -0.25, { axis: 'x' }));
      mmRBox(g, 0.12, 1.6, 0.12, 'red', 0, 0.1, -0.25, { r: 0.015 });
      mmRod(g, [0, 0.4, -0.25], [0, 0.4, 0.4], 0.03, 'red');
      const boom = mmGroup(g, 0, 1.6, -0.25);
      mmRBox(boom, 0.1, 0.1, 1.5, 'red', 0, 0, 0.7, { r: 0.015 });
      mmBox(boom, 0.085, 0.085, 0.5, 'steel', 0, 0.008, 1.3);
      for (let i = 0; i < 4; i++) mmCyl(boom, 0.012, 0.11, 'steel', 0, 0.05, 0.85 + i * 0.12, { axis: 'x', seg8: true });
      mmRod(g, [0, 0.6, -0.2], [0, 1.45, 0.3], 0.04, 'chrome');
      mmRod(g, [0, 0.55, -0.2], [0, 1.0, 0.05], 0.055, 'red');
      mmRod(g, [0.08, 0.7, -0.18], [0.35, 1.05, -0.4], 0.012, 'chrome');
      const hook = mmGroup(boom, 0, 0, 1.4);
      mmCyl(hook, 0.008, 0.5, 'steel', 0, -0.25, 0);
      for (let i = 0; i < 6; i++) mmBox(hook, 0.012, 0.05, i % 2 ? 0.03 : 0.012, 'steel', 0, -0.06 - i * 0.075, 0);
      mmBox(hook, 0.06, 0.06, 0.06, 'dark', 0, -0.52, 0);
      mmCone(hook, 0.04, 0.08, 'yellow', 0, -0.6, 0, true);
      const engine = mmGroup(hook, 0, -0.85, 0);
      mmRBox(engine, 0.6, 0.45, 0.45, 'dark', 0, 0, 0, { r: 0.03 });
      mmRBox(engine, 0.5, 0.15, 0.3, 'red', 0, 0.45, 0, { r: 0.02 });
      mmCyl(engine, 0.12, 0.1, 'steel', 0.32, 0.25, 0, { axis: 'x' });
      engine.visible = false;
      return mmFinish(g, 'hoist', { boom, hook, engine, w: 0.8, d: 1.6 });
    }

function shopPressModel() {
      const g = new THREE.Group();
      [-0.35, 0.35].forEach(x => {
        mmRBox(g, 0.08, 1.9, 0.12, 'red', x, 0, 0, { r: 0.012 });
        mmRBox(g, 0.4, 0.06, 0.12, 'red', x, 0, 0, { r: 0.012 });
        for (let i = 0; i < 6; i++) mmCyl(g, 0.018, 0.125, 'black', x, 0.35 + i * 0.12, 0, { axis: 'z', seg8: true });
      });
      mmRBox(g, 0.78, 0.14, 0.14, 'red', 0, 1.78, 0, { r: 0.015 });
      [-1, 1].forEach(s => mmBox(g, 0.7, 0.08, 0.04, 'dark', 0, 0.7, s * 0.08));
      [-0.4, 0.4].forEach(x => mmCyl(g, 0.016, 0.24, 'chrome', x, 0.74, 0, { axis: 'z' }));
      [-0.1, 0.1].forEach(x => mmBox(g, 0.12, 0.08, 0.14, 'castIron', x, 0.78, 0));
      const ram = mmGroup(g, 0, 1.4, 0);
      mmCyl(ram, 0.07, 0.36, 'chrome', 0, 0, 0);
      mmCyl(ram, 0.05, 0.03, 'castIron', 0, -0.19, 0);
      mmCyl(g, 0.09, 0.2, 'black', 0, 1.68, 0);
      mmCyl(g, 0.04, 0.06, 'white', 0.25, 1.5, 0.08, { axis: 'z' });
      mmCyl(g, 0.045, 0.02, 'chrome', 0.25, 1.5, 0.06, { axis: 'z' });
      mmRBox(g, 0.12, 0.1, 0.1, 'dark', 0.25, 1.3, 0.05, { r: 0.015 });
      mmRod(g, [0.3, 1.38, 0.05], [0.55, 1.6, 0.12], 0.012, 'chrome');
      mmCable(g, [[0.25, 1.3, 0.06], [0.15, 1.55, 0.09], [0.06, 1.72, 0.04]], 0.008, 'rubber');
      return mmFinish(g, 'press', { ram, plate: { y: 0.78 }, w: 0.9, d: 0.4 });
    }

function migTigModel() {
      const g = new THREE.Group();
      mmRBox(g, 0.5, 0.05, 0.7, 'dark', 0, 0.12, 0, { r: 0.012 });
      mmRBox(g, 0.46, 0.04, 0.6, 'dark', 0, 0.85, 0.05, { r: 0.012 });
      [-0.2, 0.2].forEach(x => [-0.28, 0.28].forEach(z => mmCyl(g, 0.06, 0.04, 'rubber', x, 0.06, z, { axis: 'x' })));
      [-0.22, 0.22].forEach(x => mmBox(g, 0.03, 0.75, 0.03, 'dark', x, 0.12, -0.3));
      mmRod(g, [-0.22, 0.9, -0.3], [0.22, 0.9, -0.3], 0.012, 'dark');
      mmRBox(g, 0.4, 0.42, 0.55, 'blue', 0, 0.17, 0.05, { r: 0.03 });
      mmRBox(g, 0.36, 0.36, 0.02, 'plasticDark', 0, 0.2, 0.33, { r: 0.01 });
      mmScreen(g, 0.12, 0.08, 0, 0.45, 0.345);
      [-0.08, 0.08].forEach(x => mmCyl(g, 0.025, 0.02, 'plasticGrey', x, 0.33, 0.35, { axis: 'z' }));
      [-0.1, 0, 0.1].forEach(x => mmCyl(g, 0.016, 0.03, 'brass', x, 0.24, 0.35, { axis: 'z' }));
      mmVents(g, 0.4, 0.2, 0.201, 0.35, 0.05, { ry: Math.PI / 2, n: 6 });
      mmHandle(g, 0.3, 0, 0.62, 0.05, { axis: 'x', mat: 'plasticDark', off: 0.03 });
      mmCyl(g, 0.1, 0.95, 'argon', 0, 0.62, -0.3);
      mmSphere(g, 0.1, 'argon', 0, 1.1, -0.3);
      mmCyl(g, 0.02, 0.06, 'brass', 0, 1.22, -0.3);
      mmCyl(g, 0.025, 0.05, 'white', 0.04, 1.26, -0.3, { axis: 'x' });
      mmCable(g, [[0.04, 1.24, -0.3], [0.15, 0.9, -0.2], [0.1, 0.45, 0.0]], 0.006, 'rubber');
      mmCyl(g, 0.12, 0.05, 'rubber', 0.22, 0.55, 0.05, { axis: 'x' });
      mmCable(g, [[0.05, 0.25, 0.34], [0.2, 0.3, 0.4], [0.3, 0.7, 0.2]], 0.014, 'rubber');
      const torch = mmGroup(g, 0.3, 0.7, 0.2);
      mmCyl(torch, 0.02, 0.2, 'dark', 0, 0, 0, { rz: 0.8 });
      mmCyl(torch, 0.014, 0.06, 'copper', 0.07, -0.07, 0, { rz: 0.8 });
      const tip = mmSphere(torch, 0.02, mmGlow('arc'), 0.08, -0.08, 0);
      return mmFinish(g, 'migtig', { torch, tip, w: 0.5, d: 0.8 });
    }

// The big air compressor (horizontal tank, motor and belt guard), with hard lines and reels to the air tools
function compressorModel() {
      const g = new THREE.Group();
      mmCyl(g, 0.38, 1.5, 'red', 0, 0.48, 0, { axis: 'x' });
      [-1, 1].forEach(s => mmSphere(g, 0.38, 'red', s * 0.75, 0.48, 0).scale.set(0.12, 0.38, 0.38));
      [-0.6, 0.6].forEach(x => { mmBox(g, 0.1, 0.12, 0.5, 'dark', x, 0, 0); mmBox(g, 0.14, 0.01, 0.56, 'rubber', x, 0, 0); });
      mmBox(g, 1.0, 0.03, 0.5, 'dark', 0, 0.85, 0);
      mmRBox(g, 0.32, 0.26, 0.26, 'castIron', 0.3, 0.88, -0.05, { r: 0.03 });
      [-0.06, 0.08].forEach((x, i) => {
        mmCyl(g, 0.07 - i * 0.015, 0.2, 'castIron', 0.3 + x, 1.22, -0.05, { rz: (i ? -1 : 1) * 0.35 });
        for (let f = 0; f < 5; f++) mmCyl(g, 0.09 - i * 0.015, 0.012, 'castIron', 0.3 + x - (i ? -1 : 1) * f * 0.012, 1.16 + f * 0.035, -0.05, { rz: (i ? -1 : 1) * 0.35 });
      });
      mmRod(g, [0.25, 1.3, -0.05], [0.35, 1.32, -0.05], 0.015, 'copper');
      mmCyl(g, 0.16, 0.38, 'steel', -0.3, 0.98, 0);
      mmCyl(g, 0.165, 0.03, 'dark', -0.3, 0.8, 0);
      mmRBox(g, 0.75, 0.32, 0.06, 'red', 0.0, 0.92, 0.2, { r: 0.03 });
      mmVents(g, 0.5, 0.18, 0.0, 1.08, 0.231, { n: 6, mat: 'red' });
      const fan = mmGroup(g, -0.3, 1.2, 0);
      mmCyl(fan, 0.15, 0.03, 'red', 0, 0, 0);
      mmRBox(g, 0.12, 0.14, 0.08, 'plasticGrey', 0.55, 1.03, 0.15, { r: 0.012 });
      mmCyl(g, 0.06, 0.06, 'white', 0.55, 1.1, 0.2, { axis: 'z' });
      const gauge = mmCyl(g, 0.06, 0.02, 'white', -0.75, 0.9, 0.2, { axis: 'z' });
      mmCyl(g, 0.065, 0.015, 'chrome', -0.75, 0.9, 0.19, { axis: 'z' });
      mmCyl(g, 0.02, 0.08, 'brass', 0, 0.06, 0.1);
      mmRod(g, [-0.8, 0.5, 0], [-0.95, 2.4, 0], 0.025, 'copper');
      mmCable(g, [[0.6, 1.1, -0.15], [0.7, 1.4, -0.3], [0.8, 2.2, -0.35]], 0.012, 'rubber');
      return mmFinish(g, 'compressor', { fan, gauge, w: 1.7, d: 0.8 });
    }

// Air tools on a rack: impact wrench, air jack and a sandblaster pot
function airToolsModel() {
      const g = new THREE.Group();
      mmRBox(g, 0.9, 0.05, 0.4, 'dark', 0, 0.8, 0, { r: 0.01 });
      [-0.4, 0.4].forEach(x => mmBox(g, 0.05, 0.8, 0.05, 'dark', x, 0, 0));
      mmBox(g, 0.85, 0.03, 0.35, 'dark', 0, 0.25, 0);
      const impact = mmGroup(g, -0.25, 0.85, 0);
      mmRBox(impact, 0.08, 0.14, 0.18, 'black', 0, 0, 0, { r: 0.015 });
      mmRBox(impact, 0.06, 0.12, 0.06, 'plasticDark', 0, -0.0, -0.08, { r: 0.012, rx: 0.3 });
      mmCyl(impact, 0.03, 0.08, 'chrome', 0, 0.1, 0.12, { axis: 'z' });
      mmBox(impact, 0.02, 0.02, 0.02, 'chrome', 0, 0.1, 0.18);
      const jack = mmGroup(g, 0.2, 0, 0.35);
      mmRBox(jack, 0.25, 0.2, 0.25, 'yellow', 0, 0, 0, { r: 0.02 });
      mmBox(jack, 0.06, 0.06, 0.9, 'dark', 0, 0.2, 0.45, { rx: -0.25 });
      mmCyl(jack, 0.08, 0.04, 'rubber', 0, 0.22, 0);
      mmCyl(jack, 0.04, 0.04, 'rubber', 0.1, 0.04, 0.1, { axis: 'x' });
      mmCyl(jack, 0.04, 0.04, 'rubber', -0.1, 0.04, 0.1, { axis: 'x' });
      const pot = mmGroup(g, 0.3, 0.85, 0);
      mmCyl(pot, 0.12, 0.35, 'red', 0, 0.18, 0);
      mmSphere(pot, 0.12, 'red', 0, 0.35, 0).scale.set(0.12, 0.06, 0.12);
      mmCyl(pot, 0.03, 0.04, 'brass', 0, 0.42, 0);
      mmCyl(pot, 0.03, 0.02, 'white', 0.06, 0.38, 0.06, { axis: 'z' });
      mmCyl(g, 0.15, 0.04, 'yellow', -0.2, 1.4, -0.15, { axis: 'z' });
      mmCyl(g, 0.13, 0.05, 'rubber', -0.2, 1.4, -0.13, { axis: 'z' });
      mmBox(g, 0.2, 0.2, 0.02, 'dark', -0.2, 1.3, -0.18);
      mmCable(g, [[-0.2, 1.3, -0.1], [-0.25, 1.0, -0.05], [-0.25, 0.92, 0.02]], 0.008, 'yellow');
      return mmFinish(g, 'airtools', { impact, jack, pot, w: 0.9, d: 0.8 });
    }

// CNC plasma table: a water table with slats, a gantry and the torch
function plasmaTableModel() {
      const g = new THREE.Group();
      mmRBox(g, 1.7, 0.55, 1.0, 'anthracite', 0, 0, 0, { r: 0.02 });
      mmBox(g, 1.6, 0.06, 0.92, 'steel', 0, 0.55, 0);
      mmBox(g, 1.56, 0.02, 0.88, 'blue', 0, 0.5, 0);
      for (let i = 0; i < 9; i++) mmBox(g, 0.02, 0.1, 0.9, 'steel', -0.75 + i * 0.19, 0.55, 0);
      [-1, 1].forEach(s => { mmBox(g, 1.7, 0.04, 0.05, 'chrome', 0, 0.62, s * 0.52); mmBox(g, 1.7, 0.08, 0.06, 'anthracite', 0, 0.54, s * 0.52); });
      mmBox(g, 1.0, 0.05, 0.08, 'blackAnod', -0.3, 0.62, -0.6);
      const gantry = mmGroup(g, 0, 0.7, 0);
      [-1, 1].forEach(s => {
        mmRBox(gantry, 0.12, 0.3, 0.1, 'orange', 0, 0, s * 0.52, { r: 0.015 });
        mmMotor(gantry, -0.1, 0.15, s * 0.52, 'steel', 'y', 0.7);
      });
      mmRBox(gantry, 0.12, 0.12, 1.1, 'orange', 0, 0.3, 0, { r: 0.02 });
      mmBox(gantry, 0.02, 0.03, 1.0, 'chrome', 0.065, 0.36, 0);
      for (let i = 0; i < 8; i++) mmBox(gantry, 0.06, 0.04, 0.1, 'black', -0.02, 0.45, -0.45 + i * 0.12);
      const torch = mmGroup(gantry, 0.06, 0.2, 0);
      mmRBox(torch, 0.08, 0.16, 0.08, 'blackAnod', 0.03, 0.08, 0, { r: 0.012 });
      mmCyl(torch, 0.025, 0.28, 'dark', 0, -0.1, 0);
      mmCyl(torch, 0.016, 0.04, 'copper', 0, -0.25, 0);
      const arc = mmSphere(torch, 0.025, mmGlow('arc'), 0, -0.26, 0);
      // Plasma power source and the console
      mmRBox(g, 0.3, 0.32, 0.5, 'red', -0.65, 0.0, -0.75, { r: 0.025 });
      mmVents(g, 0.2, 0.12, -0.65, 0.18, -0.499, { n: 4 });
      mmCable(g, [[-0.65, 0.32, -0.6], [-0.5, 0.6, -0.6], [-0.3, 0.67, -0.6]], 0.02, 'rubber');
      mmBox(g, 0.05, 0.9, 0.05, 'anthracite', 0.75, 0, 0.6);
      mmScreen(g, 0.2, 0.14, 0.75, 1.0, 0.63).rotation.x = -0.2;
      mmEstop(g, 0.88, 0.9, 0.62, 0, 0.9);
      return mmFinish(g, 'plasma', { gantry, torch, arc, plate: { y: 0.61 }, travel: { x: 0.65, z: 0.35 }, w: 1.7, d: 1.0 });
    }

function partsWasherModel() {
      const g = new THREE.Group();
      mmCyl(g, 0.24, 0.78, 'red', 0, 0.39, 0, { seg8: false });
      [0.1, 0.4, 0.7].forEach(y => mmCyl(g, 0.245, 0.02, 'red', 0, y, 0));
      mmRBox(g, 0.85, 0.3, 0.6, 'red', 0, 0.8, 0, { r: 0.03 });
      mmBox(g, 0.75, 0.02, 0.5, 'oil', 0, 1.02, 0);
      mmBox(g, 0.7, 0.02, 0.45, 'steel', 0, 0.98, 0);
      const lid = mmGroup(g, 0, 1.1, -0.3);
      mmRBox(lid, 0.85, 0.03, 0.6, 'red', 0, 0, 0.3, { r: 0.01 });
      mmBox(lid, 0.3, 0.02, 0.03, 'steel', 0, 0.015, 0.58);
      lid.rotation.x = -1.2;
      mmCable(g, [[-0.3, 1.1, -0.25], [-0.3, 1.3, -0.15], [-0.2, 1.25, 0.0]], 0.012, 'rubber');
      mmCyl(g, 0.02, 0.06, 'brass', -0.2, 1.22, 0.02, { rz: 1.2 });
      mmRBox(g, 0.12, 0.1, 0.06, 'plasticDark', 0.32, 0.9, 0.31, { r: 0.012 });
      mmCyl(g, 0.012, 0.02, 'lampGreen', 0.32, 0.93, 0.345, { axis: 'z' });
      const brush = mmGroup(g, 0.2, 1.1, 0);
      mmCyl(brush, 0.012, 0.25, 'bench', 0, 0, 0, { rz: 0.8 });
      mmCyl(brush, 0.02, 0.06, 'yellow', -0.09, -0.08, 0, { rz: 0.8 });
      return mmFinish(g, 'partswasher', { lid, brush, plate: { y: 1.05 }, w: 0.85, d: 0.6 });
    }

// --- Shared product models: the things he makes ----------------------------------------------------
// Built in metres (realSize), so they carry and shelve like everything else
function madePartModel(lower) {
      const l = String(lower || '').toLowerCase();
      // Products with a shape of their own (rings, hinges, enclosures, cabinet doors...: js/itemmodels.js)
      const shaped = typeof imMadeShapeModel === 'function' ? imMadeShapeModel(l) : null;
      if (shaped) return shaped;
      const g = new THREE.Group();
      const metal = /steel|stainless|titanium|aluminium|aluminum|bronze|brass|copper|cast(ing)?\b|metal|dmls|ebm|ded|machined|haas|taurus|plasma|binder/.test(l);
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
      } else if (/miniature|figur|robot/.test(l)) {
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
