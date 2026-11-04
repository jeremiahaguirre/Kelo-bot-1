// Kelo-bot-1 — js/buildmodels.js
// Loaded after bom.js. Parametric 3D models of the big builds, made part by part so they can grow
// on the build site as Kelo-1 works: the airplane's welded fuselage tubes appear first, then the
// wings rib by rib, the fabric, the engine and propeller. Everything is modelled in metres and shown
// at life size (ITEM_LIFE_SCALE, the same 1.6 the other real builds use).
// buildTargetModel(bom) returns a group whose userData.parts[subKey] lists the pieces of each
// sub-assembly in the order they go on; applyBuildProgress(model, bom, partial) shows the right ones.

const BUILD_MODEL_SCALE = typeof ITEM_LIFE_SCALE === 'number' ? ITEM_LIFE_SCALE : 1.6;
const BM_COL = { steel: 0x5f6672, primer: 0xa9b0a3, alu: 0xc9cfd6, fabric: 0xf3eedb, silver: 0xbcc2c8, yellow: 0xf2bf26, rubber: 0x16181d,
  cedar: 0xb5683a, cedarDark: 0x8a4a26, cedarLight: 0xd29a62, pine: 0xd8b27a, pt: 0x9c8a5a, osb: 0xc9a86a, shingle: 0x3f3f46, ash: 0xe2c79a };

// A builder: every piece added with p(sub, obj) is a part of that sub-assembly, in order
function bmBuilder() {
      const root = new THREE.Group();
      root.userData.parts = {};
      const p = (sub, obj) => { (root.userData.parts[sub] = root.userData.parts[sub] || []).push(obj); root.add(obj); return obj; };
      return { root, p };
    }

function bmTube(a, b, r, color, extra) { return rod(a, b, r, color, { metalness: 0.6, roughness: 0.45, ...(extra || {}) }); }
function bmBox(w, h, d, color, x, y, z, extra) { return at(mesh(new THREE.BoxGeometry(w, h, d), color, extra || {}), x, y, z); }

// A loft of rectangular sections [x, yBottom, yTop, halfWidth]: a covered fuselage
function bmLoft(sections, color, extra) {
      const pos = [], idx = [];
      sections.forEach(([x, yb, yt, w]) => pos.push(x, yb, -w, x, yb, w, x, yt, w, x, yt, -w));
      for (let i = 0; i < sections.length - 1; i++) for (let k = 0; k < 4; k++) {
        const a = i * 4 + k, b = i * 4 + (k + 1) % 4, c = a + 4, d = b + 4;
        idx.push(a, b, d, a, d, c);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return mesh(g, color, { side: THREE.DoubleSide, roughness: 0.6, ...(extra || {}) });
    }

// --- Ultralight airplane ------------------------------------------------------------------------------
// +x forward, wheels on y = 0. Kitfox-like: high wing 9.75 m span, 1.35 m chord, 5.6 m long.
const UL_ST = [[1.20, 0.60, 1.35, 0.34], [0.80, 0.52, 1.80, 0.36], [-0.55, 0.48, 1.80, 0.36], [-1.40, 0.56, 1.45, 0.29], [-2.30, 0.66, 1.30, 0.21], [-3.20, 0.76, 1.18, 0.12], [-4.10, 0.86, 1.08, 0.03]];
const UL_AIRFOIL = [[0.80, 1.86], [0.74, 1.92], [0.60, 1.96], [0.40, 1.985], [0.15, 1.98], [-0.15, 1.95], [-0.40, 1.90], [-0.55, 1.87], [-0.55, 1.86], [-0.20, 1.835], [0.30, 1.83], [0.60, 1.835], [0.75, 1.845]];

function ultralightModel() {
      const { root, p } = bmBuilder();
      const S = UL_ST, T = 0.014;
      const tube = (sub, a, b, r = T) => p(sub, bmTube(a, b, r, BM_COL.steel));
      // Fuselage: bottom longerons, uprights, top longerons, cross tubes, diagonals, cabin cage, firewall
      [-1, 1].forEach(s => S.slice(0, -1).forEach((a, i) => tube('fuselage', [a[0], a[1], s * a[3]], [S[i + 1][0], S[i + 1][1], s * S[i + 1][3]], 0.016)));
      S.forEach(a => [-1, 1].forEach(s => tube('fuselage', [a[0], a[1], s * a[3]], [a[0], a[2], s * a[3]])));
      [-1, 1].forEach(s => S.slice(0, -1).forEach((a, i) => tube('fuselage', [a[0], a[2], s * a[3]], [S[i + 1][0], S[i + 1][2], s * S[i + 1][3]], 0.016)));
      S.slice(0, -1).forEach(a => { tube('fuselage', [a[0], a[1], -a[3]], [a[0], a[1], a[3]]); tube('fuselage', [a[0], a[2], -a[3]], [a[0], a[2], a[3]]); });
      [-1, 1].forEach(s => S.slice(1, -1).forEach((a, i) => tube('fuselage', [a[0], a[1], s * a[3]], [S[i + 2][0], S[i + 2][2], s * S[i + 2][3]], 0.011)));
      S.slice(2, -1).forEach((a, i) => tube('fuselage', [a[0], a[1], -a[3]], [S[i + 3][0], S[i + 3][1], S[i + 3][3]], 0.011));
      [0.62, -0.20].forEach(x => tube('fuselage', [x, 1.82, -0.38], [x, 1.82, 0.38], 0.018));
      [-1, 1].forEach(s => tube('fuselage', [0.80, 1.80, s * 0.36], [-0.55, 0.48, s * 0.36], 0.011));
      p('fuselage', bmBox(0.012, 0.74, 0.66, BM_COL.alu, 1.21, 0.97, 0, { metalness: 0.7 }));
      // Landing gear: V legs, axles, wheels, bungees, tailwheel
      [-1, 1].forEach(s => {
        tube('gear', [0.95, 0.56, s * 0.34], [0.55, 0.19, s * 0.85], 0.02);
        tube('gear', [0.20, 0.49, s * 0.34], [0.55, 0.19, s * 0.85], 0.02);
      });
      [-1, 1].forEach(s => p('gear', at(wheel(0.19, 0.15), 0.55, 0.19, s * 0.85)));
      [-1, 1].forEach(s => { const b = mesh(new THREE.TorusGeometry(0.05, 0.02, 6, 12), 0x111827); b.position.set(0.6, 0.42, s * 0.5); p('gear', b); });
      tube('gear', [-3.95, 0.84, 0], [-4.10, 0.15, 0], 0.012);
      p('gear', at(wheel(0.075, 0.05), -4.12, 0.075, 0));
      // Tail: stabilizer, elevator, fin and rudder outlines; hinges; brace wires
      const stab = [[-3.30, 0], [-3.40, 1.25], [-3.95, 1.30], [-3.95, 0]], elev = [[-3.97, 0.05], [-3.97, 1.30], [-4.35, 1.25], [-4.42, 0.05]];
      const fin = [[-3.55, 1.08], [-3.95, 1.95], [-4.10, 1.95], [-4.10, 1.08]], rud = [[-4.12, 0.75], [-4.12, 2.0], [-4.40, 1.95], [-4.55, 1.2], [-4.45, 0.75]];
      const outline = (pts, map) => pts.forEach((a, i) => { const b = pts[(i + 1) % pts.length]; tube('tail', map(a), map(b), 0.009); });
      [-1, 1].forEach(s => { outline(stab, ([x, w]) => [x, 1.06, s * w]); outline(elev, ([x, w]) => [x, 1.06, s * w]); });
      outline(fin, ([x, y]) => [x, y, 0]); outline(rud, ([x, y]) => [x, y, 0]);
      [-1, 1].forEach(s => tube('tail', [-3.6, 1.06, s * 0.9], [-3.95, 1.8, 0], 0.004));
      [-1, 1].forEach(s => tube('tail', [-3.6, 1.06, s * 0.9], [-3.6, 0.80, s * 0.1], 0.004));
      // Wings: spars, ribs root to tip, compression struts, drag wires, leading edges, tip bows, flaperons, struts
      const W0 = 0.38, W1 = 4.875;
      [0.62, -0.20].forEach(x => [-1, 1].forEach(s => p('wings', bmTube([x, 1.89, s * W0], [x, 1.89, s * W1], 0.025, BM_COL.alu, { metalness: 0.8 }))));
      const ribs = 17;
      for (let i = 0; i < ribs; i++) [-1, 1].forEach(s => {
        const rib = slab(UL_AIRFOIL, 0.01, BM_COL.alu, { metalness: 0.7 });
        rib.position.z = s * (W0 + 0.08 + i * ((W1 - W0 - 0.12) / (ribs - 1)));
        p('wings', rib);
      });
      [1.2, 2.4, 3.6].forEach(z => [-1, 1].forEach(s => p('wings', bmTube([0.62, 1.89, s * z], [-0.20, 1.89, s * z], 0.01, BM_COL.alu))));
      [[0.6, 1.8], [1.8, 3.0], [3.0, 4.2]].forEach(([a, b]) => [-1, 1].forEach(s => p('wings', bmTube([0.62, 1.89, s * a], [-0.20, 1.89, s * b], 0.003, 0x9ca3af))));
      [-1, 1].forEach(s => { const le = slab(UL_AIRFOIL.filter(([x]) => x > 0.55).concat([[0.55, 1.83], [0.55, 1.97]]), W1 - W0, BM_COL.alu, { metalness: 0.75, roughness: 0.3 }); le.position.z = s * (W0 + W1) / 2; p('wings', le); });
      [-1, 1].forEach(s => p('wings', bmTube([0.70, 1.89, s * W1], [-0.50, 1.88, s * W1], 0.02, BM_COL.alu)));
      [-1, 1].forEach(s => { const fl = bmBox(0.28, 0.035, 3.4, BM_COL.alu, -0.72, 1.86, s * 2.95, { metalness: 0.6 }); fl.material.wireframe = true; p('wings', fl); });
      [[0.62, 0.20], [-0.20, -0.10]].forEach(([wx, fx]) => [-1, 1].forEach(s => p('wings', bmTube([fx, 0.52, s * 0.34], [wx, 1.84, s * 2.9], 0.022, BM_COL.alu, { metalness: 0.8 }))));
      [-1, 1].forEach(s => p('wings', bmTube([0.1, 1.2, s * 1.9], [0.25, 1.84, s * 1.9], 0.012, BM_COL.alu)));
      // Controls: seat, stick, pedals, cables to the tail
      p('controls', bmBox(0.42, 0.06, 0.5, 0x1f2937, -0.15, 0.62, 0));
      p('controls', bmBox(0.06, 0.45, 0.46, 0x1f2937, -0.38, 0.85, 0));
      p('controls', bmTube([0.25, 0.55, 0], [0.18, 1.05, 0], 0.012, 0x111827));
      [-1, 1].forEach(s => p('controls', bmBox(0.06, 0.16, 0.08, 0x374151, 0.78, 0.66, s * 0.14)));
      [-1, 1].forEach(s => p('controls', bmTube([0.7, 0.6, s * 0.14], [-4.0, 0.95, s * 0.06], 0.004, 0x9ca3af)));
      [-1, 1].forEach(s => p('controls', bmTube([0.2, 0.62, s * 0.2], [-0.55, 1.75, s * 0.3], 0.006, 0x9ca3af)));
      // Fabric covering: fuselage aft and forward, cabin windows and windshield, tail skins, wing skins
      const fab = (geoMesh) => { geoMesh.userData.fabric = true; return geoMesh; };
      p('covering', fab(bmLoft(S.slice(2), BM_COL.fabric)));
      p('covering', fab(bmLoft(S.slice(0, 2).map(([x, yb, yt, w], i) => [x, yb, i ? 1.0 : yt, w]), BM_COL.fabric)));
      const win = glass(new THREE.BoxGeometry(1.32, 1.1, 0.74));
      win.position.set(0.12, 1.28, 0);
      p('covering', win);
      const ws = glass(new THREE.PlaneGeometry(0.62, 0.72));
      ws.position.set(1.0, 1.58, 0); ws.rotation.set(0, Math.PI / 2, 0); ws.rotateX(-0.85);
      p('covering', ws);
      [-1, 1].forEach(s => { const a = slab(stab.map(([x, w]) => [x, w]), 0.025, BM_COL.fabric); a.rotation.x = s * Math.PI / 2; a.position.y = 1.06; a.scale.y = 1; p('covering', fab(a)); });
      [-1, 1].forEach(s => { const a = slab(elev.map(([x, w]) => [x, w]), 0.02, BM_COL.fabric); a.rotation.x = s * Math.PI / 2; a.position.y = 1.06; p('covering', fab(a)); });
      p('covering', fab(slab(fin, 0.03, BM_COL.fabric)));
      p('covering', fab(slab(rud, 0.025, BM_COL.fabric)));
      [-1, 1].forEach(s => { const sk = slab(UL_AIRFOIL, W1 - W0, BM_COL.fabric); sk.position.z = s * (W0 + W1) / 2; p('covering', fab(sk)); });
      [-1, 1].forEach(s => p('covering', fab(bmBox(0.28, 0.04, 3.4, BM_COL.fabric, -0.72, 1.86, s * 2.95))));
      // Engine and propeller: mount, Rotax 582, radiator, exhaust, prop and spinner
      [[0.6, 0.30], [0.6, -0.30], [1.3, 0.30], [1.3, -0.30]].forEach(([y, z]) => tube('engine', [1.21, y, z], [1.42, 1.0 + (y - 0.95) * 0.3, z * 0.4], 0.012));
      p('engine', bmBox(0.34, 0.30, 0.40, 0x9ca3af, 1.52, 0.98, 0, { metalness: 0.7 }));
      [-1, 1].forEach(s => { const c = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.2, 14), 0x4b5563, { metalness: 0.6 }); c.position.set(1.52, 1.22, s * 0.1); p('engine', c); });
      p('engine', bmBox(0.18, 0.2, 0.2, 0x111827, 1.74, 1.02, 0));
      p('engine', bmBox(0.08, 0.32, 0.4, 0x334155, 1.38, 0.62, 0, { metalness: 0.5 }));
      p('engine', bmTube([1.55, 0.85, 0.2], [1.0, 0.55, 0.38], 0.04, 0x52525b, { metalness: 0.8 }));
      const prop = new THREE.Group();
      prop.position.set(1.86, 1.02, 0);
      [0, Math.PI].forEach(a => { const bl = bmBox(0.04, 0.86, 0.09, 0x7c4a1e, 0, Math.cos(a) * 0.45, 0); bl.rotation.y = 0.25; prop.add(bl); });
      const spin = mesh(new THREE.ConeGeometry(0.115, 0.22, 16), 0xdc2626);
      spin.rotation.z = -Math.PI / 2; spin.position.x = 0.1;
      prop.add(spin);
      p('engine', prop);
      root.userData.prop = prop;
      // Fuel system: wing-root tanks, lines, gascolator
      [-1, 1].forEach(s => p('fuel', bmBox(0.6, 0.12, 0.45, 0xd1d5db, 0.25, 1.9, s * 0.62, { metalness: 0.8 })));
      [-1, 1].forEach(s => p('fuel', bmTube([0.25, 1.86, s * 0.4], [0.9, 0.65, s * 0.1], 0.006, 0x60a5fa)));
      p('fuel', bmBox(0.06, 0.1, 0.06, 0xd1d5db, 1.0, 0.65, 0));
      // Instruments: panel, gauges, pitot
      const panel = bmBox(0.03, 0.26, 0.6, 0x111827, 0.88, 1.28, 0);
      panel.rotation.z = -0.25;
      p('instruments', panel);
      [-0.2, -0.07, 0.07, 0.2].forEach(z => { const g = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 14), 0xe5e7eb); g.rotation.z = Math.PI / 2; g.position.set(0.86, 1.30, z); p('instruments', g); });
      p('instruments', bmTube([0.85, 1.84, -3.4], [1.15, 1.84, -3.4], 0.008, 0xd1d5db));
      // Electrical: battery, harness, nav lights and strobe
      p('electrical', bmBox(0.18, 0.17, 0.08, 0x111827, -0.7, 0.62, 0.15));
      p('electrical', bmTube([-0.7, 0.66, 0.15], [1.2, 0.95, 0.2], 0.006, 0xef4444));
      p('electrical', at(mesh(new THREE.SphereGeometry(0.035, 8, 6), 0xef4444, { emissive: 0xef4444, emissiveIntensity: 0.6 }), 0.2, 1.88, -4.9));
      p('electrical', at(mesh(new THREE.SphereGeometry(0.035, 8, 6), 0x22c55e, { emissive: 0x22c55e, emissiveIntensity: 0.6 }), 0.2, 1.88, 4.9));
      p('electrical', at(mesh(new THREE.SphereGeometry(0.03, 8, 6), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 }), -4.1, 2.0, 0));
      // Steel turns from bare to primer; fabric from white to silver to Cub yellow with a red rudder
      root.userData.paint = bom => {
        const f = bomSubFraction(bom, 'fuselage'), c = bomSubFraction(bom, 'covering');
        root.userData.parts.fuselage.forEach(m => { if (m.material && m.material.color && m.geometry.type === 'CylinderGeometry') m.material.color.setHex(f >= 1 ? BM_COL.primer : BM_COL.steel); });
        root.userData.parts.covering.forEach((m, i) => {
          if (!m.userData.fabric) return;
          const col = c >= 5 / 6 ? (i === 6 ? 0xc2261e : BM_COL.yellow) : c >= 4 / 6 ? BM_COL.silver : BM_COL.fabric;
          m.material.color.setHex(col);
          m.material.transparent = c < 4 / 6;
          m.material.opacity = c < 4 / 6 ? 0.82 : 1;
        });
      };
      root.userData.seat = { x: -0.15, y: 0.65, z: 0 };
      return root;
    }

// --- Go-kart ------------------------------------------------------------------------------------------
function goKartModel() {
      const { root, p } = bmBuilder();
      const red = 0xdc2626, T = 0.0127;
      const rail = (a, b) => p('frame', bmTube(a, b, T, red, { metalness: 0.4 }));
      [-1, 1].forEach(s => { rail([0.75, 0.10, s * 0.22], [-0.70, 0.10, s * 0.32]); rail([0.75, 0.10, s * 0.22], [0.95, 0.14, s * 0.10]); });
      [0.62, 0.15, -0.35, -0.70].forEach(x => rail([x, 0.10, -0.3], [x, 0.10, 0.3]));
      [-1, 1].forEach(s => { rail([0.5, 0.10, s * 0.25], [0.5, 0.18, s * 0.45]); rail([-0.6, 0.10, s * 0.32], [-0.6, 0.16, s * 0.45]); });
      p('frame', bmBox(0.9, 0.006, 0.4, 0x6b7280, 0.2, 0.09, 0, { metalness: 0.6 }));
      // Steering
      p('steering', bmTube([0.62, 0.12, 0], [0.18, 0.42, 0], 0.01, 0x9ca3af));
      const sw = mesh(new THREE.TorusGeometry(0.14, 0.015, 8, 24), 0x111827);
      sw.position.set(0.18, 0.44, 0); sw.rotation.y = Math.PI / 2; sw.rotateX(0.5);
      p('steering', sw);
      [-1, 1].forEach(s => { p('steering', bmTube([0.55, 0.14, s * 0.45], [0.55, 0.22, s * 0.45], 0.012, 0x334155)); p('steering', bmTube([0.62, 0.13, 0], [0.5, 0.14, s * 0.43], 0.006, 0x9ca3af)); });
      // Rear axle, bearings, brake disc, sprocket
      p('axle', bmTube([-0.5, 0.14, -0.58], [-0.5, 0.14, 0.58], 0.0127, 0x9ca3af, { metalness: 0.9 }));
      [-0.3, 0, 0.3].forEach(z => p('axle', bmBox(0.08, 0.06, 0.05, 0x374151, -0.5, 0.14, z)));
      const disc = mesh(new THREE.CylinderGeometry(0.076, 0.076, 0.005, 20), 0xd1d5db, { metalness: 0.9 }); disc.rotation.x = Math.PI / 2; disc.position.set(-0.5, 0.14, -0.15); p('axle', disc);
      const spr = mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.006, 24), 0x52525b, { metalness: 0.8 }); spr.rotation.x = Math.PI / 2; spr.position.set(-0.5, 0.14, 0.2); p('axle', spr);
      // Wheels
      [-1, 1].forEach(s => p('wheels', at(wheel(0.127, 0.11, 0xe5e7eb), 0.55, 0.127, s * 0.52)));
      [-1, 1].forEach(s => p('wheels', at(wheel(0.14, 0.18, 0xe5e7eb), -0.5, 0.14, s * 0.62)));
      // Engine and drive
      p('engine', bmBox(0.26, 0.04, 0.24, 0x6b7280, -0.45, 0.13, 0.3));
      p('engine', bmBox(0.3, 0.3, 0.32, 0xb91c1c, -0.45, 0.30, 0.32));
      p('engine', bmBox(0.18, 0.12, 0.2, 0x111827, -0.45, 0.50, 0.32));
      p('engine', bmTube([-0.38, 0.22, 0.2], [-0.5, 0.14, 0.2], 0.004, 0x27272a));
      p('engine', bmTube([-0.32, 0.38, 0.45], [-0.62, 0.38, 0.45], 0.022, 0x52525b, { metalness: 0.8 }));
      p('engine', bmBox(0.18, 0.12, 0.02, 0x111827, -0.47, 0.18, 0.22));
      // Seat and body
      const seat = new THREE.Group();
      seat.add(bmBox(0.36, 0.04, 0.4, 0x111827, 0, 0, 0), bmBox(0.05, 0.38, 0.4, 0x111827, -0.18, 0.18, 0));
      seat.position.set(-0.15, 0.14, 0); seat.children[1].rotation.z = 0.25;
      p('seat', seat);
      [-1, 1].forEach(s => p('seat', bmTube([-0.3, 0.3, s * 0.2], [-0.5, 0.16, s * 0.25], 0.008, 0x9ca3af)));
      p('seat', bmTube([0.95, 0.14, -0.35], [0.95, 0.14, 0.35], 0.012, 0x111827));
      [-1, 1].forEach(s => p('seat', bmTube([0.3, 0.12, s * 0.48], [-0.25, 0.12, s * 0.5], 0.012, 0x111827)));
      root.userData.paint = () => {};
      root.userData.seat = { x: -0.12, y: 0.16, z: 0 };
      return root;
    }

// --- Hulls: canoe and kayak ----------------------------------------------------------------------------
// A band of hull surface between two girth positions (-1 port sheer .. 0 keel .. 1 starboard sheer)
function bmHullBand(L, B, D, g0, g1, color, chine = false) {
      const nu = 28, nv = chine ? 1 : 3, pos = [], idx = [];
      for (let i = 0; i <= nu; i++) {
        const u = -L / 2 + (i / nu) * L, t = Math.abs(2 * u / L);
        const b = (B / 2) * Math.pow(Math.max(0, 1 - Math.pow(t, 2.2)), 0.65), d = D + 0.12 * t * t, keel = 0.05 * t * t;
        for (let j = 0; j <= nv; j++) {
          const g = g0 + (g1 - g0) * (j / nv), th = g * Math.PI / 2;
          pos.push(u, keel + d * (1 - Math.cos(th)) * (chine ? 1 : 0.95), b * Math.sin(th));
        }
      }
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const a = i * (nv + 1) + j, b = a + 1, c = a + nv + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      return mesh(geo, color, { side: THREE.DoubleSide, roughness: 0.7, flatShading: chine });
    }

function bmHullSection(L, B, D, u) {
      const t = Math.abs(2 * u / L), b = (B / 2) * Math.pow(Math.max(0, 1 - Math.pow(t, 2.2)), 0.65), d = D + 0.12 * t * t, keel = 0.05 * t * t;
      const pts = [];
      for (let k = 0; k <= 12; k++) { const th = (-1 + k / 6) * Math.PI / 2; pts.push([b * Math.sin(th), keel + d * (1 - Math.cos(th)) * 0.95]); }
      return pts;
    }

function canoeModel() {
      const { root, p } = bmBuilder();
      const L = 4.88, B = 0.86, D = 0.34;
      const hull = new THREE.Group();
      root.add(hull);
      const hp = (sub, obj) => { (root.userData.parts[sub] = root.userData.parts[sub] || []).push(obj); hull.add(obj); return obj; };
      // Strongback and the station molds (the hull is stripped upside down over them)
      p('forms', bmBox(4.6, 0.08, 0.3, BM_COL.pine, 0, 0.5, 0));
      [-1.9, 1.9].forEach(x => p('forms', bmBox(0.08, 0.46, 0.3, BM_COL.pine, x, 0.23, 0)));
      for (let i = 0; i < 15; i++) {
        const u = -L / 2 + 0.3 + i * ((L - 0.6) / 14);
        const sec = bmHullSection(L, B, D, u).map(([z, y]) => [z, 0.55 + (D + 0.12) - y]);
        const mold = slab(sec.concat([[sec[sec.length - 1][0], 0.55], [sec[0][0], 0.55]]), 0.012, 0xd6c7a1);
        mold.rotation.y = Math.PI / 2; mold.position.x = u;
        p('forms', mold);
      }
      // Stems, then strips from the sheer down to the keel, port and starboard in turn
      [-1, 1].forEach(s => hp('strips', bmTube([s * L / 2, 0.47, 0], [s * (L / 2 - 0.08), 0.05, 0], 0.012, BM_COL.ash)));
      const n = 12, shades = [BM_COL.cedar, BM_COL.cedarDark, BM_COL.cedarLight, BM_COL.cedar, 0x9a5530];
      for (let i = 0; i < n; i++) [-1, 1].forEach(s => {
        const g0 = s * (1 - i / n), g1 = s * (1 - (i + 1) / n);
        hp('strips', bmHullBand(L, B, D, Math.min(g0, g1), Math.max(g0, g1), shades[(i * 2 + (s > 0 ? 1 : 0)) % shades.length]));
      });
      // Glass is a sheen (handled in paint); gunwales, seats, thwarts, yoke, deck plates
      [-1, 1].forEach(s => { const pts = []; for (let i = 0; i <= 12; i++) { const u = -L / 2 + 0.1 + i * (L - 0.2) / 12; const sec = bmHullSection(L, B, D, u); pts.push(new THREE.Vector3(u, sec[s > 0 ? 12 : 0][1], sec[s > 0 ? 12 : 0][0])); }
        hp('outfit', new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.018, 6), new THREE.MeshStandardMaterial({ color: BM_COL.ash, roughness: 0.5 }))); });
      [[-1.55, 0.30, 0.62], [1.35, 0.28, 0.70]].forEach(([x, y, w]) => hp('outfit', bmBox(0.28, 0.025, w, 0xc8a46a, x, y, 0)));
      [-0.7, 0.75].forEach(x => hp('outfit', bmBox(0.05, 0.03, 0.8, BM_COL.ash, x, D + 0.02, 0)));
      hp('outfit', bmBox(0.09, 0.035, 0.86, BM_COL.ash, 0.05, D + 0.02, 0));
      [-1, 1].forEach(s => hp('outfit', bmBox(0.3, 0.02, 0.2, 0x7f1d1d, s * (L / 2 - 0.22), D + 0.1, 0)));
      root.userData.hull = hull;
      root.userData.paint = bom => {
        const glassed = bomSubFraction(bom, 'glass'), varn = bomSubFraction(bom, 'finish');
        root.userData.parts.strips.forEach(m => { if (m.material) { m.material.roughness = varn >= 0.66 ? 0.12 : glassed >= 0.25 ? 0.3 : 0.75; m.material.metalness = varn >= 0.66 ? 0.15 : 0; } });
        // Upside down on the forms until it's lifted off to glass the inside; then upright on the beach
        const flipped = glassed < 0.5;
        hull.rotation.x = flipped ? Math.PI : 0;
        hull.position.y = flipped ? 0.55 + D + 0.12 + 0.05 : 0.12;
        root.userData.parts.forms.forEach(m => { m.userData.hideAfter = !flipped; });
      };
      root.userData.seat = { x: -1.5, y: 0.2, z: 0 };
      return root;
    }

function kayakModel() {
      const { root, p } = bmBuilder();
      const L = 5.2, B = 0.6, D = 0.3;
      // Two sawhorses
      [-1.2, 1.2].forEach(x => { p('panels', bmBox(0.08, 0.06, 0.9, BM_COL.pine, x, 0.6, 0)); [-1, 1].forEach(s => p('panels', bmTube([x, 0.6, s * 0.4], [x + 0.15 * s, 0, s * 0.5], 0.02, BM_COL.pine))); });
      const hull = new THREE.Group();
      hull.position.y = 0.63;
      root.add(hull);
      const hp = (sub, obj) => { (root.userData.parts[sub] = root.userData.parts[sub] || []).push(obj); hull.add(obj); return obj; };
      const ply = 0xd9a874;
      [[-1, -0.5], [0.5, 1]].forEach(([a, b]) => hp('stitch', bmHullBand(L, B, D, a, b, ply, true)));
      [[-0.5, 0], [0, 0.5]].forEach(([a, b]) => hp('stitch', bmHullBand(L, B, D, a, b, 0xcf9c66, true)));
      for (let i = 0; i < 14; i++) hp('glass', bmBox(0.012, 0.012, 0.03, 0xb45309, -L / 2 + 0.4 + i * 0.34, 0.01, 0));
      // Deck: two panels meeting at a low peak, the coaming and bulkheads
      [-1, 1].forEach(s => { const sh = bmHullBand(L, B * 0.98, 0.06, 0, 1, 0xe0b483, true); sh.scale.set(1, -1, s); sh.position.y = D + 0.14; hp('deck', sh); });
      const coam = mesh(new THREE.TorusGeometry(0.3, 0.025, 8, 28), 0x7c4a1e); coam.scale.set(1.45, 1, 1); coam.rotation.x = Math.PI / 2; coam.position.set(-0.2, D + 0.2, 0);
      hp('deck', coam);
      [-1, 1].forEach(s => { const h = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 20), 0x7c4a1e); h.scale.set(1.3, 1, 1); h.position.set(s * 1.5, D + 0.17, 0); hp('outfit', h); });
      [-1, 1].forEach(s => hp('outfit', bmTube([-1.0, D + 0.17, s * 0.2], [1.0, D + 0.17, s * 0.2], 0.005, 0x111827)));
      hp('outfit', bmBox(0.36, 0.05, 0.36, 0x1e3a8a, -0.25, 0.12, 0));
      root.userData.paint = bom => {
        const g = bomSubFraction(bom, 'outfit');
        hull.children.forEach(m => { if (m.material) m.material.roughness = g >= 1 ? 0.15 : 0.6; });
      };
      root.userData.hull = hull;
      root.userData.seat = { x: -0.25, y: 0.15, z: 0 };
      return root;
    }

// --- Garden shed: 8 × 10 ft, gable roof along z ---------------------------------------------------------
function shedModel() {
      const { root, p } = bmBuilder();
      const W = 2.44, Dp = 3.05, F = 0.3, H = 2.0, R = 0.75;
      [-1, 0, 1].forEach(i => [-1, 0, 1].forEach(j => p('foundation', bmBox(0.28, 0.12, 0.28, 0x9ca3af, i * 1.05, 0.06, j * 1.35))));
      [-1, 0, 1].forEach(i => p('foundation', bmBox(0.09, 0.09, Dp, BM_COL.pt, i * 1.05, 0.165, 0)));
      for (let i = 0; i < 9; i++) p('floor', bmBox(W, 0.14, 0.04, BM_COL.pt, 0, 0.28, -Dp / 2 + 0.02 + i * (Dp - 0.04) / 8));
      [-1, 1].forEach(s => p('floor', bmBox(0.04, 0.14, Dp, BM_COL.pt, s * (W / 2 - 0.02), 0.28, 0)));
      [-1, 0, 1].forEach(i => p('floor', bmBox(W, 0.019, Dp / 3, BM_COL.osb, 0, F + 0.06, i * Dp / 3)));
      const y0 = F + 0.07;
      // Studs 16 in. on centre round all four walls, plates, a door header
      const studs = [];
      for (let z = -Dp / 2 + 0.05; z <= Dp / 2 - 0.05; z += 0.406) [-1, 1].forEach(s => studs.push([s * (W / 2 - 0.05), z]));
      for (let x = -W / 2 + 0.05; x <= W / 2 - 0.05; x += 0.406) [-1, 1].forEach(s => { if (!(s > 0 && Math.abs(x) < 0.65)) studs.push([x, s * (Dp / 2 - 0.05)]); });
      studs.forEach(([x, z]) => p('walls', bmBox(0.04, H, 0.09, BM_COL.pine, x, y0 + H / 2, z)));
      [-1, 1].forEach(s => { p('walls', bmBox(0.09, 0.04, Dp, BM_COL.pine, s * (W / 2 - 0.05), y0 + H, 0)); p('walls', bmBox(W, 0.04, 0.09, BM_COL.pine, 0, y0 + H, s * (Dp / 2 - 0.05))); });
      p('walls', bmBox(1.3, 0.14, 0.09, BM_COL.pine, 0, y0 + 1.85, Dp / 2 - 0.05));
      // Ridge and rafter pairs
      p('roofframe', bmBox(0.04, 0.14, Dp + 0.3, BM_COL.pine, 0, y0 + H + R, 0));
      for (let i = 0; i < 8; i++) { const z = -Dp / 2 + i * Dp / 7; [-1, 1].forEach(s => p('roofframe', bmTube([s * (W / 2 + 0.2), y0 + H - 0.1, z], [0, y0 + H + R, z], 0.025, BM_COL.pine))); }
      const pitch = Math.atan2(R + 0.1, W / 2 + 0.2), slope = Math.hypot(R + 0.1, W / 2 + 0.2);
      const roofPanel = (sub, color, lift, thick, rows = 1) => [-1, 1].forEach(s => { for (let r = 0; r < rows; r++) {
        const frac = (r + 0.5) / rows, len = slope / rows;
        const b = bmBox(len + 0.02, thick, Dp + 0.35, color, s * (W / 2 + 0.2) * (1 - frac), y0 + H - 0.1 + (R + 0.1) * frac + lift, 0);
        b.rotation.z = -s * pitch; p(sub, b);
      } });
      roofPanel('roofing', BM_COL.osb, 0.04, 0.012, 2);
      roofPanel('roofing', 0x1f2937, 0.055, 0.004, 1);
      roofPanel('roofing', BM_COL.shingle, 0.07, 0.02, 5);
      p('roofing', bmBox(0.18, 0.04, Dp + 0.35, 0x27272a, 0, y0 + H + R + 0.09, 0));
      // Siding panels, gables, doors, window and trim
      [-1, 1].forEach(s => [-1, 0, 1].forEach(i => p('siding', bmBox(0.012, H, Dp / 3, 0xc19a6b, s * (W / 2 + 0.006), y0 + H / 2, i * Dp / 3))));
      [-1, 1].forEach(s => [-1, 1].forEach(i => { if (!(s > 0)) p('siding', bmBox(W / 2, H, 0.012, 0xc19a6b, i * W / 4, y0 + H / 2, s * (Dp / 2 + 0.006))); }));
      [-1, 1].forEach(i => p('siding', bmBox(0.6, H - 0.15, 0.012, 0xc19a6b, i * 0.92, y0 + H / 2, Dp / 2 + 0.006)));
      [-1, 1].forEach(s => p('siding', slab([[-W / 2 - 0.1, 0], [W / 2 + 0.1, 0], [0, R]], 0.012, 0xc19a6b)).position.set(0, y0 + H, s * (Dp / 2 + 0.006)));
      [-1, 1].forEach(i => p('siding', bmBox(0.6, 1.75, 0.03, 0xa47d50, i * 0.31, y0 + 0.9, Dp / 2 + 0.03)));
      const win = glass(new THREE.BoxGeometry(0.03, 0.9, 0.6)); win.position.set(-W / 2 - 0.02, y0 + 1.3, 0); p('siding', win);
      [[0, y0 + 1.82, Dp / 2 + 0.04, 1.4, 0.09, 0.03]].forEach(([x, y, z, w, h, d]) => p('siding', bmBox(w, h, d, 0xf8fafc, x, y, z)));
      root.userData.paint = bom => {
        const pt = bomSubFraction(bom, 'paint');
        root.userData.parts.siding.forEach(m => { if (m.material && !m.material.transparent && m.material.color.getHex() !== 0xf8fafc) m.material.color.setHex(pt >= 0.66 ? 0x3f6f4f : pt >= 0.33 ? 0xe7e5e4 : 0xc19a6b); });
      };
      return root;
    }

// --- Quadcopter: 220 mm, 5 in. props ---------------------------------------------------------------------
function droneModel() {
      const { root, p } = bmBuilder();
      const carbon = 0x1f2937;
      p('frame', bmBox(0.12, 0.004, 0.08, carbon, 0, 0.02, 0));
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => { const arm = bmBox(0.17, 0.005, 0.022, carbon, a * 0.055, 0.02, b * 0.055); arm.rotation.y = -a * b * Math.PI / 4; p('frame', arm); });
      p('frame', bmBox(0.12, 0.003, 0.08, carbon, 0, 0.055, 0));
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => { const m = mesh(new THREE.CylinderGeometry(0.0145, 0.0145, 0.02, 14), 0x6b21a8, { metalness: 0.7 }); m.position.set(a * 0.078, 0.033, b * 0.078); p('power', m); });
      p('power', bmBox(0.036, 0.006, 0.036, 0x065f46, 0, 0.028, 0));
      p('power', bmTube([-0.02, 0.028, 0], [-0.09, 0.03, 0], 0.003, 0xdc2626));
      p('brain', bmBox(0.036, 0.004, 0.036, 0x1e3a8a, 0, 0.04, 0));
      p('radio', bmBox(0.019, 0.019, 0.019, 0x111827, 0.06, 0.04, 0));
      p('radio', bmBox(0.02, 0.005, 0.02, 0x065f46, -0.03, 0.047, 0));
      p('radio', bmTube([-0.05, 0.05, 0], [-0.08, 0.09, 0], 0.002, 0x111827));
      p('props', bmBox(0.075, 0.03, 0.035, 0xf59e0b, 0, 0.075, 0));
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => { const pr = mesh(new THREE.CylinderGeometry(0.0635, 0.0635, 0.002, 3), 0x22d3ee, { transparent: true, opacity: 0.75 }); pr.position.set(a * 0.078, 0.047, b * 0.078); p('props', pr); });
      root.userData.paint = () => {};
      return root;
    }

// --- Electric guitar, lying on the bench -----------------------------------------------------------------
function guitarModel() {
      const { root, p } = bmBuilder();
      const g = new THREE.Group();
      g.rotation.x = -Math.PI / 2;
      root.add(g);
      const gp = (sub, obj) => { (root.userData.parts[sub] = root.userData.parts[sub] || []).push(obj); g.add(obj); return obj; };
      const body = [[-0.24, 0.0], [-0.22, 0.12], [-0.12, 0.17], [0.02, 0.13], [0.08, 0.16], [0.16, 0.10], [0.11, 0.03], [0.14, -0.04], [0.18, -0.12], [0.08, -0.15], [-0.05, -0.13], [-0.16, -0.16], [-0.24, -0.10]];
      gp('body', slab(body, 0.045, 0xd8b98a)).position.z = 0.0225;
      gp('neck', bmBox(0.62, 0.05, 0.02, 0xe9cf9c, 0.43, 0, 0.035));
      gp('neck', slab([[0.73, 0.03], [0.93, 0.045], [0.95, 0.0], [0.93, -0.03], [0.73, -0.026]], 0.015, 0xe9cf9c)).position.z = 0.03;
      gp('neck', bmBox(0.47, 0.055, 0.007, 0x3f2a1d, 0.49, 0, 0.049));
      for (let i = 1; i <= 22; i++) { const x = 0.725 - 0.648 * (1 - Math.pow(2, -i / 12)); gp('frets', bmBox(0.002, 0.056, 0.002, 0xe5e7eb, x, 0, 0.054)); }
      gp('frets', bmBox(0.005, 0.045, 0.006, 0xfafaf9, 0.727, 0, 0.055));
      gp('hardware', bmBox(0.06, 0.07, 0.008, 0xd1d5db, -0.12, 0, 0.05));
      for (let i = 0; i < 6; i++) gp('hardware', at(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.02, 8), 0xd1d5db, { metalness: 0.9 }), 0.77 + i * 0.03, 0.04, 0.045));
      gp('electronics', slab([[-0.17, 0.11], [0.12, 0.11], [0.13, -0.02], [0.05, -0.12], [-0.15, -0.12], [-0.20, 0.0]], 0.003, 0xf8fafc)).position.z = 0.047;
      [-0.06, 0.0, 0.05].forEach(x => gp('electronics', bmBox(0.017, 0.07, 0.01, 0xfafaf9, x, 0, 0.051)));
      [[-0.12, -0.09], [-0.08, -0.11], [-0.04, -0.12]].forEach(([x, y]) => gp('electronics', at(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.015, 12), 0xfafaf9), x, y, 0.055)));
      for (let i = 0; i < 6; i++) gp('setup', bmTube([-0.12, -0.022 + i * 0.009, 0.06], [0.727, -0.018 + i * 0.0072, 0.06], 0.0006, 0xe5e7eb));
      root.userData.paint = bom => { const f = bomSubFraction(bom, 'finish'); const b = root.userData.parts.body[0]; b.material.color.setHex(f >= 0.66 ? 0xb91c1c : 0xd8b98a); b.material.roughness = f >= 1 ? 0.15 : 0.6; };
      return root;
    }

// --- Tree fort, around the trunk at the origin ----------------------------------------------------------
function treeFortModel() {
      const { root, p } = bmBuilder();
      const Y = 2.4, S = 2.44;
      [[0.3, 0], [-0.3, 0]].forEach(([x]) => [-1, 1].forEach(s => p('supports', at(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 10), 0x6b7280, { metalness: 0.8 }), x, Y - 0.15, s * 0.3)).rotation.x = Math.PI / 2));
      [-1, 1].forEach(s => p('supports', bmTube([s * 0.25, 1.3, 0], [s * 1.0, Y - 0.25, 0], 0.045, BM_COL.pt)));
      [-1, 1].forEach(s => p('platform', bmBox(3.05, 0.19, 0.08, BM_COL.pt, 0, Y - 0.15, s * 0.42)));
      for (let i = 0; i < 7; i++) p('platform', bmBox(0.04, 0.14, S, BM_COL.pt, -S / 2 + i * S / 6, Y - 0.0, 0));
      for (let i = 0; i < 20; i++) { const z = -S / 2 + 0.06 + i * (S - 0.12) / 19; if (Math.abs(z) < 0.3) { [-1, 1].forEach(s => p('deck', bmBox(S / 2 - 0.3, 0.025, 0.11, 0xb46d3e, s * (S / 4 + 0.15), Y + 0.085, z))); } else p('deck', bmBox(S, 0.025, 0.11, 0xb46d3e, 0, Y + 0.085, z)); }
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([a, b]) => p('walls', bmBox(0.09, 1.0, 0.09, BM_COL.pine, a * (S / 2 - 0.05), Y + 0.6, b * (S / 2 - 0.05))));
      [-1, 1].forEach(s => { for (let i = 0; i < 12; i++) p('walls', bmBox(0.015, 0.8, 0.14, 0xc08452, s * (S / 2 + 0.01), Y + 0.5, -S / 2 + 0.1 + i * 0.2)); });
      for (let i = 0; i < 12; i++) p('walls', bmBox(0.14, 0.8, 0.015, 0xc08452, -S / 2 + 0.1 + i * 0.2, Y + 0.5, -S / 2 - 0.01));
      [-1, 1].forEach(a => [-1, 1].forEach(b => p('roof', bmBox(0.08, 1.0, 0.08, BM_COL.pine, a * (S / 2 - 0.05), Y + 1.6, b * (S / 2 - 0.05)))));
      for (let i = 0; i < 5; i++) { const r = bmBox(0.66, 0.012, S + 0.4, 0x94a3b8, -S / 2 + 0.25 + i * 0.5, Y + 2.15 - i * 0.08, 0, { metalness: 0.8, roughness: 0.35 }); r.rotation.z = 0.16; p('roof', r); }
      [-1, 1].forEach(s => p('access', bmTube([S / 2 + 0.6, 0, s * 0.25], [S / 2 + 0.05, Y + 0.1, s * 0.25], 0.03, BM_COL.pt)));
      for (let i = 1; i <= 8; i++) { const f = i / 9; p('access', bmTube([S / 2 + 0.6 - 0.55 * f, Y * f, -0.25], [S / 2 + 0.6 - 0.55 * f, Y * f, 0.25], 0.02, BM_COL.pt)); }
      root.userData.paint = () => {};
      return root;
    }

// --- Anything else (an AI plan with no model of its own): each sub-assembly as stacked components ------
function genericBuildModel(bom) {
      const { root, p } = bmBuilder();
      const n = bom.subs.length, cols = Math.ceil(Math.sqrt(n));
      bom.subs.forEach((s, i) => {
        const cx = (i % cols - (cols - 1) / 2) * 0.9, cz = (Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2) * 0.9;
        p(s.key, bmBox(0.7, 0.05, 0.7, BM_COL.pine, cx, 0.025, cz));
        s.lines.slice(0, 10).forEach((l, j) => {
          const col = l.kind === 'f' ? 0x9ca3af : l.kind === 'c' ? 0x38bdf8 : [0xf59e0b, 0x84cc16, 0xef4444, 0xa855f7, 0x14b8a6][j % 5];
          p(s.key, bmBox(0.5 - j * 0.03, 0.06, 0.5 - j * 0.03, col, cx, 0.08 + j * 0.065, cz));
        });
      });
      root.userData.paint = () => {};
      return root;
    }

const BUILD_MODELS = { ultralight: ultralightModel, gokart: goKartModel, canoe: canoeModel, kayak: kayakModel, shed: shedModel, drone: droneModel, guitar: guitarModel, treefort: treeFortModel };

// How far along a sub-assembly is (0..1), counting a step in progress
function bomSubFraction(bom, key, partial = null) {
      const s = bom.subs.find(x => x.key === key);
      if (!s) return 0;
      if (s.built) return 1;
      const extra = partial && partial.sub === key ? partial.f : 0;
      return Math.min(1, (s.stepsDone + extra) / Math.max(1, s.steps.length));
    }

function buildTargetModel(bom) {
      const make = BUILD_MODELS[bom.templateKey];
      const inner = make ? make() : genericBuildModel(bom);
      inner.scale.setScalar(BUILD_MODEL_SCALE);
      const outer = new THREE.Group();
      outer.add(inner);
      outer.userData.inner = inner;
      outer.traverse(o => { if (o.isMesh) { o.castShadow = true; o.material = o.material.clone(); } });
      return outer;
    }

// Show the parts that are on so far: each sub-assembly reveals its pieces in order as its steps are done
function applyBuildProgress(model, bom, partial = null) {
      const inner = model.userData.inner;
      const parts = inner.userData.parts || {};
      Object.keys(parts).forEach(key => {
        const list = parts[key];
        const f = bomSubFraction(bom, key, partial);
        const show = Math.ceil(f * list.length - 1e-6);
        list.forEach((m, i) => { m.visible = i < show; });
      });
      if (inner.userData.paint) inner.userData.paint(bom);
      Object.values(parts).forEach(list => list.forEach(m => { if (m.userData.hideAfter) m.visible = false; }));
      return model;
    }

// How big a build is once assembled, for fitting it in a workshop bay: the real size in metres and the
// size in the world (×BUILD_MODEL_SCALE). length is along the build's forward (+x), width across it
// (the ultralight's wingspan), height from the floor. Measured from the finished model, so it is exact.
const buildFootprintCache = {};
function buildFootprint(bomOrKey) {
      const bom = typeof bomOrKey === 'string' ? bomFromTemplate(bomOrKey) : bomOrKey;
      if (!bom) return null;
      const key = bom.templateKey || `ai:${bom.name}:${bom.subs.length}`;
      if (buildFootprintCache[key]) return buildFootprintCache[key];
      const b = JSON.parse(JSON.stringify(bom));
      b.subs.forEach(s => { s.built = true; });
      const m = applyBuildProgress(buildTargetModel(b), b);
      m.updateMatrixWorld(true);
      const box = new THREE.Box3();
      m.traverse(o => { if (o.isMesh && o.visible) box.expandByObject(o); });
      const size = new THREE.Vector3();
      box.getSize(size);
      const k = BUILD_MODEL_SCALE, r = v => Math.round(v * 100) / 100;
      const out = { length: r(size.x), width: r(size.z), height: r(size.y), metres: { length: r(size.x / k), width: r(size.z / k), height: r(size.y / k) } };
      m.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      return (buildFootprintCache[key] = out);
    }

// A finished build as a vehicle: full size, wrapped like the other vehicles (js/gearmodels.js)
function finishedBuildVehicle(key) {
      const bom = bomFromTemplate(key);
      bom.subs.forEach(s => { s.built = true; });
      const model = applyBuildProgress(buildTargetModel(bom), bom);
      const inner = model.userData.inner, seat = inner.userData.seat || { x: 0, y: 0.5, z: 0 };
      return miniature(model, { seat: { x: seat.x * BUILD_MODEL_SCALE, y: seat.y * BUILD_MODEL_SCALE - KELO_SIT_OFFSET, z: seat.z * BUILD_MODEL_SCALE }, prop: inner.userData.prop || null, fixedWing: key === 'ultralight' });
    }

function finishedBuildItem(key) {
      const bom = bomFromTemplate(key);
      bom.subs.forEach(s => { s.built = true; });
      const m = applyBuildProgress(buildTargetModel(bom), bom);
      m.userData.inner.scale.setScalar(1);
      return realSize(m);
    }

// What the finished things look like anywhere else (the Post Office counter, a shelf, his hands)
if (typeof ITEM_MODEL_RULES !== 'undefined') ITEM_MODEL_RULES.unshift(
  [/home-built ultralight airplane/, () => finishedBuildVehicle('ultralight')],
  [/home-built go-kart/, () => finishedBuildVehicle('gokart')],
  [/cedar-strip canoe/, () => finishedBuildVehicle('canoe')],
  [/wooden sea kayak/, () => finishedBuildVehicle('kayak')],
  [/home-built fpv quadcopter/, () => finishedBuildItem('drone')],
  [/home-built electric guitar/, () => finishedBuildItem('guitar')],
  [/^parts (kit|crate)|^tools for /, () => {
    const g = group();
    g.add(at(mesh(new THREE.BoxGeometry(0.5, 0.32, 0.36), 0xc8a165, { roughness: 0.9 }), 0, 0.16, 0));
    [0.05, 0.27].forEach(y => g.add(at(mesh(new THREE.BoxGeometry(0.52, 0.04, 0.38), 0x9a7440), 0, y, 0)));
    return g;
  }]
);
