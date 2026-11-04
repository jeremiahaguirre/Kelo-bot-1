// Kelo-bot-1 — js/weldstudio.js
// Loaded after realism.js. Kelo-1's Welding Studio as a real small fab shop: a concrete slab (scorched
// round the table), a steel-clad back wall under a lean-to roof, a roll-up door, a heavy steel welding
// table with clamps and a vise, a MIG welder on its cart (with marked spots for the gas cylinder, the
// regulator, the gun lead, work clamp and gas hose that js/welding.js connects), spare cylinders
// chained to the wall, a bench grinder, a tool pegboard, a fume extractor arm, a rack of
// steel stock with an offcut bin, a fire extinguisher and warm shop lights. While he welds, the arc
// flashes blue-white and lights the room. The table top stays where it always was (centre -1.2, -8.2,
// 0.92 up), so his walk to the bench, his stand spot and the workpiece are unchanged.

const WELD_STUDIO = { x: -1.2, z: -8.2 };
let weldStudio = null;

// Concrete with trowel marks, stains, and burn marks where hot slag and spatter land around the table
function scorchedConcreteTexture() {
      const size = 512, c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      const rng = makeRng('kelo1-shop-floor');
      ctx.fillStyle = '#9a968f';
      ctx.fillRect(0, 0, size, size);
      const blot = (x, y, r, rgba) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rgba);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      };
      for (let i = 0; i < 70; i++) blot(rng() * size, rng() * size, 20 + rng() * 70, `rgba(${rng() < 0.5 ? '70,66,60' : '190,186,178'},0.12)`);
      for (let i = 0; i < 9000; i++) { const g = 110 + Math.floor(rng() * 90); ctx.fillStyle = `rgba(${g},${g},${g - 4},0.35)`; ctx.fillRect(rng() * size, rng() * size, 1.2, 1.2); }
      // Saw-cut control joints
      ctx.fillStyle = 'rgba(60,58,55,0.8)';
      ctx.fillRect(0, size * 0.5, size, 2);
      ctx.fillRect(size * 0.5, 0, 2, size);
      // Scorch: a dark halo under the table, spatter specks and a few oil stains
      const cx = size * 0.52, cy = size * 0.52;
      blot(cx, cy, size * 0.34, 'rgba(30,24,20,0.55)');
      blot(cx, cy, size * 0.18, 'rgba(20,16,14,0.5)');
      for (let i = 0; i < 1400; i++) {
        const a = rng() * Math.PI * 2, d = Math.pow(rng(), 0.6) * size * 0.4;
        ctx.fillStyle = rng() < 0.15 ? 'rgba(150,90,40,0.7)' : 'rgba(25,20,18,0.75)';
        ctx.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, 1 + rng() * 2, 1 + rng() * 2);
      }
      blot(size * 0.85, size * 0.3, 40, 'rgba(35,32,30,0.45)');
      blot(size * 0.2, size * 0.78, 30, 'rgba(35,32,30,0.35)');
      return new THREE.CanvasTexture(c);
    }

// A pegboard: brown hardboard with a grid of holes and painted tool outlines
function pegboardTexture() {
      const w = 256, h = 128, c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#8d6e4f';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#3d2c1e';
      for (let y = 6; y < h; y += 9) for (let x = 6; x < w; x += 9) { ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill(); }
      return new THREE.CanvasTexture(c);
    }

function buildWeldingStudio3D() {
      const gy = getAnalyticalGroundHeight(WELD_STUDIO.x, WELD_STUDIO.z);
      const g = new THREE.Group();
      g.position.set(WELD_STUDIO.x, gy, WELD_STUDIO.z);
      const finish = (m, k, o) => { if (typeof finishMaterial === 'function') finishMaterial(m, k, o); return m; };
      const std = (color, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
      const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = g) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        m.rotation.set(rx, ry, rz);
        m.castShadow = true;
        m.receiveShadow = true;
        parent.add(m);
        return m;
      };
      const box = (w, h, d, mat, x, y, z, rx, ry, rz, parent) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz, parent);
      const cyl = (rt, rb, h, mat, x, y, z, seg = 10, rx, ry, rz, parent) => add(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, rx, ry, rz, parent);
      // A cable or hose drooping through the given points
      const hose = (pts, r, mat) => {
        const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
        const m = add(new THREE.TubeGeometry(curve, 24, r, 5, false), mat, 0, 0, 0);
        m.castShadow = false;
        return m;
      };

      // Materials
      const steel = finish(std(0x5d6166, 0.4, 0.8), 'steel');
      const blackSteel = finish(std(0x2b2d30, 0.55, 0.7), 'iron');
      const darkPaint = finish(std(0x30353b, 0.5, 0.3), 'painted');
      const welderBlue = finish(std(0x1f4f8f, 0.45, 0.3), 'painted');
      const red = finish(std(0xb3261e, 0.4, 0.3), 'painted');
      const yellow = finish(std(0xd9a21b, 0.45, 0.3), 'painted');
      const rubber = std(0x151515, 0.85);
      const copperRed = std(0x7a1f17, 0.6);
      const leather = std(0x9b7448, 0.9);
      const cladding = finish(std(0x8f949a, 0.45, 0.6), 'metalroof');
      const frame = finish(std(0x4a4f55, 0.5, 0.6), 'iron');
      const floorMat = new THREE.MeshStandardMaterial({ map: scorchedConcreteTexture(), roughness: 0.92 });
      floorMat.map.anisotropy = 4;

      // --- Slab, walls and roof (local x -1.9..2.9, z -2.1..2.2; the open front faces the path)
      const slab = add(new THREE.BoxGeometry(4.8, 0.06, 4.3), floorMat, 0.5, 0.0, 0.05);
      slab.castShadow = false;
      const back = box(4.8, 3.0, 0.08, cladding, 0.5, 1.5, -2.12);
      if (typeof worldScaleUVs === 'function') worldScaleUVs(back.geometry, 1.6);
      const left = box(0.08, 3.0, 2.1, cladding, -1.88, 1.5, -1.08);
      if (typeof worldScaleUVs === 'function') worldScaleUVs(left.geometry, 1.6);
      // Steel posts and a header beam carry the lean-to roof
      [[-1.88, 0.0], [2.88, 0.0], [2.88, -2.12], [-1.88, -2.12]].forEach(([x, z]) => box(0.12, 3.05, 0.12, frame, x, 1.52, z));
      box(4.9, 0.18, 0.14, frame, 0.5, 2.95, 0.0);
      // The roof covers the back half only, so the table stays in view from above
      const roof = box(5.1, 0.06, 2.5, cladding, 0.5, 3.12, -1.0, 0.12, 0, 0);
      if (typeof worldScaleUVs === 'function') worldScaleUVs(roof.geometry, 1.6);

      // Roll-up door in the right side, rolled most of the way up: drum housing, guide rails and slats
      box(0.32, 0.36, 2.12, darkPaint, 2.88, 2.78, -1.06);
      [-0.02, -2.1].forEach(z => box(0.06, 2.6, 0.06, frame, 2.86, 1.3, z));
      const slats = box(0.04, 0.55, 2.0, finish(std(0xb7bcc2, 0.5, 0.5), 'siding'), 2.88, 2.32, -1.06);
      if (typeof worldScaleUVs === 'function') worldScaleUVs(slats.geometry, 0.9);
      box(0.06, 0.05, 2.0, rubber, 2.88, 2.04, -1.06);

      // --- The welding table: 12 mm steel top on square-tube legs, with a shelf below
      box(2.4, 0.05, 1.4, steel, 0, 0.895, 0);
      [[-1.1, -0.6], [1.1, -0.6], [-1.1, 0.6], [1.1, 0.6]].forEach(([x, z]) => box(0.08, 0.87, 0.08, blackSteel, x, 0.435, z));
      box(2.2, 0.04, 1.2, blackSteel, 0, 0.25, 0);
      box(2.3, 0.06, 0.06, blackSteel, 0, 0.8, 0.62);
      box(2.3, 0.06, 0.06, blackSteel, 0, 0.8, -0.62);
      // Two C-clamps gripping the front edge
      [-0.6, 0.35].forEach(x => {
        const clamp = new THREE.Group();
        add(new THREE.TorusGeometry(0.075, 0.016, 6, 12, Math.PI * 1.3), blackSteel, 0, 0, 0, 0, Math.PI / 2, -0.4, clamp);
        cyl(0.008, 0.008, 0.18, steel, 0, -0.06, 0.0, 6, 0, 0, 0, clamp);
        box(0.02, 0.02, 0.12, red, 0, -0.15, 0, 0, 0, 0, clamp);
        clamp.position.set(x, 0.89, 0.7);
        g.add(clamp);
      });
      // A bench vise bolted to the front-right corner
      const vise = new THREE.Group();
      box(0.24, 0.1, 0.22, welderBlue, 0, 0.05, 0, 0, 0, 0, vise);
      box(0.22, 0.12, 0.06, welderBlue, 0, 0.16, -0.06, 0, 0, 0, vise);
      box(0.22, 0.12, 0.06, welderBlue, 0, 0.16, 0.08, 0, 0, 0, vise);
      cyl(0.012, 0.012, 0.3, steel, 0, 0.14, 0.2, 6, Math.PI / 2, 0, 0, vise);
      cyl(0.01, 0.01, 0.22, steel, 0, 0.14, 0.34, 6, 0, 0, Math.PI / 2, vise);
      vise.position.set(0.98, 0.92, 0.5);
      g.add(vise);
      // An angle grinder and a chipping hammer lying on the table
      cyl(0.035, 0.035, 0.22, yellow, -0.85, 0.955, -0.35, 8, 0, 0, Math.PI / 2);
      cyl(0.06, 0.06, 0.012, std(0x6b6b6b, 0.8), -0.98, 0.94, -0.35, 12);
      cyl(0.012, 0.012, 0.28, std(0x6e4b2a, 0.8), 0.6, 0.935, -0.4, 6, 0, 0.6, Math.PI / 2);
      box(0.12, 0.03, 0.03, blackSteel, 0.68, 0.935, -0.52, 0, 0.6, 0);

      // --- MIG welder on its cart, front facing the open shop. The hoses, cables, regulator, gas
      // cylinder, wire spool, hood and gloves are put in place by js/welding.js as he sets up; these
      // empty markers are where each one connects.
      const cart = new THREE.Group();
      const mark = (name, x, y, z) => { const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z); cart.add(o); return o; };
      box(0.7, 0.05, 0.5, darkPaint, 0, 0.18, 0, 0, 0, 0, cart);
      box(0.7, 0.04, 0.5, darkPaint, 0, 0.5, 0, 0, 0, 0, cart);
      [[-0.33, -0.23], [0.33, -0.23], [-0.33, 0.23], [0.33, 0.23]].forEach(([x, z]) => box(0.03, 0.4, 0.03, darkPaint, x, 0.33, z, 0, 0, 0, cart));
      [[-0.3, -0.21], [0.3, -0.21], [-0.3, 0.21], [0.3, 0.21]].forEach(([x, z]) => cyl(0.07, 0.07, 0.04, rubber, x, 0.07, z, 10, 0, 0, Math.PI / 2, cart));
      // The bottle rack at the back: a low platform, two uprights and the push handle
      box(0.34, 0.04, 0.3, darkPaint, 0.12, 0.1, -0.42, 0, 0, 0, cart);
      [-0.05, 0.29].forEach(x => box(0.03, 1.05, 0.03, darkPaint, x, 0.62, -0.57, 0, 0, 0, cart));
      cyl(0.016, 0.016, 0.42, rubber, 0.12, 1.15, -0.57, 8, 0, 0, Math.PI / 2, cart);
      // The machine: blue case, black front panel with a display, two knobs and the output sockets
      box(0.62, 0.42, 0.45, welderBlue, 0, 0.73, 0, 0, 0, 0, cart);
      box(0.5, 0.32, 0.02, std(0x1a1a1a, 0.4), 0, 0.75, 0.232, 0, 0, 0, cart);
      box(0.1, 0.045, 0.006, new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.8 }), 0.14, 0.86, 0.243, 0, 0, 0, cart);
      const knobs = [[-0.13, 0.84], [0.0, 0.84]].map(([x, y]) => cyl(0.03, 0.03, 0.03, std(0xdddddd, 0.4), x, y, 0.25, 12, Math.PI / 2, 0, 0, cart));
      cyl(0.03, 0.03, 0.025, std(0xb08d3c, 0.35, 0.9), -0.15, 0.66, 0.246, 12, Math.PI / 2, 0, 0, cart);   // euro gun socket
      cyl(0.024, 0.024, 0.025, std(0x111111, 0.6), 0.16, 0.66, 0.246, 12, Math.PI / 2, 0, 0, cart);       // work (-) socket
      cyl(0.012, 0.014, 0.05, std(0xb08d3c, 0.35, 0.9), 0.2, 0.86, -0.245, 8, Math.PI / 2, 0, 0, cart);   // gas inlet
      // Wire-feed compartment door on the right side, hinged at the front
      const door = new THREE.Group();
      door.position.set(0.313, 0.73, 0.21);
      box(0.012, 0.38, 0.4, welderBlue, 0, 0, -0.2, 0, 0, 0, door);
      box(0.014, 0.06, 0.02, std(0x111111, 0.5), 0.004, 0, -0.37, 0, 0, 0, door);
      cart.add(door);
      // The spindle the wire spool goes on, and the drive rolls that feed the wire to the gun
      cyl(0.012, 0.012, 0.12, steel, 0.24, 0.76, -0.08, 8, 0, 0, Math.PI / 2, cart);
      [0.84, 0.8].forEach(y => cyl(0.022, 0.022, 0.02, std(0xb08d3c, 0.35, 0.9), 0.28, y, 0.14, 10, 0, 0, Math.PI / 2, cart));
      // Hooks: the hood and gun hang on the left side; the regulator waits on the handle
      [[-0.32, 1.02, 0.1], [-0.32, 0.86, -0.12]].forEach(([x, y, z]) => cyl(0.008, 0.008, 0.08, steel, x - 0.04, y, z, 6, 0, 0, Math.PI / 2, cart));
      mark('gunSocket', -0.15, 0.66, 0.26);
      mark('workSocket', 0.16, 0.66, 0.26);
      mark('gasInlet', 0.2, 0.86, -0.27);
      mark('bottle', 0.12, 0.12, -0.42);
      mark('spool', 0.24, 0.76, -0.08);
      mark('hoodHook', -0.38, 1.0, 0.1);
      mark('gunHook', -0.38, 0.84, -0.12);
      mark('regulatorHook', 0.12, 1.1, -0.6);
      mark('clampRest', 0.12, 0.215, 0.05);
      mark('glovesRest', 0.05, 0.95, 0.0);
      mark('knobs', -0.06, 0.84, 0.27);
      cart.position.set(1.65, 0.03, 0.35);
      g.add(cart);

      // --- Spare gas cylinders chained to the back wall (shown when he has a spare one)
      const spareBottles = [-1.55, -1.25].map(x => {
        const b = new THREE.Group();
        const paint = finish(std(0x5c6b73, 0.45, 0.4), 'painted');
        cyl(0.115, 0.115, 1.35, paint, 0, 0.72, 0, 12, 0, 0, 0, b);
        cyl(0.07, 0.11, 0.12, finish(std(0x2e6b3a, 0.45, 0.4), 'painted'), 0, 1.45, 0, 12, 0, 0, 0, b);
        cyl(0.025, 0.03, 0.12, std(0xb08d3c, 0.35, 0.9), 0, 1.56, 0, 8, 0, 0, 0, b);
        add(new THREE.TorusGeometry(0.125, 0.01, 4, 16), blackSteel, 0, 1.1, 0, Math.PI / 2, 0, 0, b);
        b.position.set(x, 0, -1.88);
        b.visible = false;
        g.add(b);
        return b;
      });

      // --- Pegboard with tools (his hood and gloves live on the welder cart once he has them)
      const peg = new THREE.MeshStandardMaterial({ map: pegboardTexture(), roughness: 0.85 });
      box(1.6, 0.9, 0.025, peg, 0.25, 1.75, -2.06);
      [[-0.35, 1.9, 0.26], [-0.15, 1.88, 0.3], [0.05, 1.92, 0.22]].forEach(([x, y, l]) => box(0.03, l, 0.015, steel, x, y, -2.03));
      [[0.3, 1.95], [0.45, 1.95]].forEach(([x, y]) => { cyl(0.012, 0.012, 0.25, std(0x6e4b2a, 0.8), x, y - 0.05, -2.03, 6); box(0.1, 0.035, 0.03, blackSteel, x, y + 0.08, -2.03); });
      cyl(0.04, 0.04, 0.2, yellow, 0.75, 1.6, -2.0, 8, 0, 0, Math.PI / 2);   // a second angle grinder
      // A chipping hammer and wire brush hanging low, for cleaning slag and spatter off a weld
      box(0.04, 0.2, 0.02, std(0x6e4b2a, 0.8), -0.55, 1.5, -2.02);
      box(0.12, 0.04, 0.03, std(0x8a8a86, 0.5, 0.6), -0.55, 1.62, -2.02);

      // --- Bench grinder on a pedestal, front-left
      cyl(0.05, 0.12, 0.8, darkPaint, -1.45, 0.42, 0.6, 10);
      cyl(0.08, 0.08, 0.24, std(0x7a8288, 0.5, 0.5), -1.45, 0.92, 0.6, 12, 0, 0, Math.PI / 2);
      [-0.17, 0.17].forEach(dx => cyl(0.09, 0.09, 0.03, std(0x8a8a86, 0.95), -1.45 + dx, 0.92, 0.6, 14, 0, 0, Math.PI / 2));

      // --- Fume extractor: a wall bracket, two arm sections with joints, and a hood over the table
      const arm = new THREE.Group();
      box(0.12, 0.2, 0.12, std(0xd8d4c8, 0.6), 0, 0, 0, 0, 0, 0, arm);
      cyl(0.06, 0.06, 1.0, std(0xd8d4c8, 0.6), 0, 0.05, 0.5, 10, Math.PI / 2 - 0.25, 0, 0, arm);
      add(new THREE.SphereGeometry(0.075, 8, 6), blackSteel, 0, -0.07, 1.0, 0, 0, 0, arm);
      cyl(0.055, 0.055, 0.7, std(0xd8d4c8, 0.6), 0, -0.3, 1.15, 10, 0.5, 0, 0, arm);
      add(new THREE.ConeGeometry(0.2, 0.22, 14, 1, true), std(0xc9c4b6, 0.55, 0.2), 0, -0.68, 1.3, 0, 0, 0, arm).material.side = THREE.DoubleSide;
      arm.position.set(-0.3, 2.45, -2.0);
      g.add(arm);

      // --- Steel stock: a cantilever rack on the left wall with bars and tube, and an offcut bin
      [-1.7, -0.6].forEach(z => {
        box(0.08, 1.9, 0.08, frame, -1.8, 0.95, z);
        [0.5, 1.1, 1.7].forEach(y => box(0.35, 0.04, 0.05, frame, -1.65, y, z));
      });
      [[0.53, 0.0], [0.53, 0.05], [1.13, 0.0], [1.13, 0.06], [1.73, 0.02]].forEach(([y, dx], i) => {
        const geo = i % 2 ? new THREE.CylinderGeometry(0.025, 0.025, 1.9, 8) : new THREE.BoxGeometry(0.05, 1.9, 0.05);
        add(geo, i < 2 ? std(0x6b4a3a, 0.8, 0.6) : steel, -1.6 + dx, y + 0.03, -1.15, Math.PI / 2, 0, 0);
      });
      box(0.5, 0.35, 0.4, darkPaint, -1.5, 0.2, -0.15);
      [[0.02, 0.1, 0.4], [0.06, -0.08, 0.3], [-0.08, 0.02, 0.45]].forEach(([dx, dz, l], i) => box(0.04, l, 0.04, steel, -1.5 + dx, 0.45, -0.15 + dz, 0.2 * (i - 1), 0, 0.3 * (i - 1)));

      // --- Fire extinguisher by the open side
      cyl(0.08, 0.08, 0.5, red, -1.72, 0.3, 1.5, 12);
      cyl(0.03, 0.03, 0.08, blackSteel, -1.72, 0.59, 1.5, 8);
      hose([[-1.69, 0.6, 1.5], [-1.64, 0.45, 1.57], [-1.64, 0.2, 1.58]], 0.01, rubber);

      // The old sign keeps its name
      const sign = makeSignMesh('WELDING STUDIO', { bg: '#0f172a', fg: '#38bdf8', width: 2.2, height: 0.4 });
      sign.position.set(0.5, 2.7, 0.08);
      g.add(sign);

      // --- Warm shop lights: two hanging fixtures, and a lamp that matters most at dusk and night
      const glow = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffd9a0, emissiveIntensity: 0.6 });
      [-0.4, 1.4].forEach(x => {
        cyl(0.005, 0.005, 0.4, blackSteel, x, 2.75, -1.0, 4);
        box(0.9, 0.06, 0.14, darkPaint, x, 2.53, -1.0);
        box(0.85, 0.02, 0.1, glow, x, 2.5, -1.0).castShadow = false;
      });
      const shopLight = new THREE.PointLight(0xffc98a, 0, 8, 2);
      shopLight.position.set(0.5, 2.35, -0.9);
      g.add(shopLight);

      // The arc: a blue-white flare at the torch that only shows while he welds
      const flareCanvas = document.createElement('canvas');
      flareCanvas.width = flareCanvas.height = 64;
      const fctx = flareCanvas.getContext('2d');
      const fg = fctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      fg.addColorStop(0, 'rgba(255,255,255,1)');
      fg.addColorStop(0.15, 'rgba(200,230,255,0.9)');
      fg.addColorStop(0.5, 'rgba(110,170,255,0.25)');
      fg.addColorStop(1, 'rgba(80,140,255,0)');
      fctx.fillStyle = fg;
      fctx.fillRect(0, 0, 64, 64);
      const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(flareCanvas), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
      flare.position.set(0, 1.02, 0.2);
      flare.scale.setScalar(0.5);
      flare.visible = false;
      g.add(flare);

      scene.add(g);
      weldStudio = { group: g, shopLight, glow, flare, cart, door, knobs, spareBottles, gy };
      // His hoses, cables, regulator, hood and the arc itself (js/welding.js), and the work bench next door (js/workbench.js)
      if (typeof buildWeldingRig3D === 'function') buildWeldingRig3D();
      if (typeof buildWorkBench3D === 'function') buildWorkBench3D();
      // Walls, the rack, the cart and the grinder are solid; the front stays open to the bench
      const w = (x, z, r) => worldObstacles.push({ x: WELD_STUDIO.x + x, z: WELD_STUDIO.z + z, r });
      for (let x = -1.6; x <= 2.7; x += 0.6) w(x, -2.15, 0.35);
      [-1.6, -1.0, -0.4].forEach(z => w(-1.88, z, 0.35));
      w(-1.6, -1.2, 0.4); w(-1.5, -0.15, 0.35); w(-1.45, 0.6, 0.25); w(1.65, 0.3, 0.45); w(-1.72, 1.5, 0.15);
      return g;
    }

// Every frame: the shop lights follow the daylight; the arc flare flickers while the arc light is on.
// This runs after his pose is final for the frame, so the welding rig (js/welding.js) updates here too.
function updateWeldingStudio(t) {
      if (!weldStudio) return;
      const dark = typeof skyDarkness === 'function' ? skyDarkness() : 0;
      const physical = renderer && renderer.physicallyCorrectLights;
      weldStudio.shopLight.intensity = (0.4 + 1.6 * dark) * (physical ? 5 : 0.6);
      weldStudio.glow.emissiveIntensity = 0.4 + 1.4 * dark;
      if (typeof updateWeldingRigAfterPose === 'function' && updateWeldingRigAfterPose(t)) return; // the rig drives the flare itself
      const arcOn = typeof forgeArcLight !== 'undefined' && forgeArcLight && forgeArcLight.intensity > 0;
      weldStudio.flare.visible = arcOn;
      if (arcOn) {
        const s = 0.35 + Math.random() * 0.45;
        weldStudio.flare.scale.set(s, s, 1);
        weldStudio.flare.material.opacity = 0.7 + Math.random() * 0.3;
      }
    }
