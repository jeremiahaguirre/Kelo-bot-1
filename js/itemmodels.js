// Kelo-bot-1 — js/itemmodels.js
// Loaded after materials.js (uses mesh/group/realSize from items3d.js, at/rod/slab from gearmodels.js,
// lathe from everydaymodels.js). Real-size models for the everyday things he is given, asks for or
// buys: kitchenware, electronics, sports gear, building materials and supplies, clothes, toys,
// instruments and household things. Every model here is built in metres, stands on y = 0 with its
// front towards +z, and is marked realSize, so lifeSize() shows it at its true size beside Kelo-1.
// The rules are put in front of the general ones in items3d.js (the specific rules other files
// unshift later still come first). Each model shares one material per colour (imKit).

// One material per colour and finish within a model, and short helpers for the usual shapes
function imKit() {
      const mats = new Map();
      const mat = (color, extra = {}) => {
        const key = color + '|' + JSON.stringify(extra);
        if (!mats.has(key)) {
          const m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra });
          // A part modelled with its own finish keeps it (the name's words don't turn a bag of glass beads
          // into glass); wooden parts still get their grain
          if (Object.keys(extra).length && extra !== IM.wood) m.userData.keepLook = true;
          // Polished metal needs something to reflect (js/materials.js; null when the HDR sky lights the scene)
          if (m.metalness >= 0.5 && typeof materialReflections === 'function') { m.envMap = materialReflections(); m.envMapIntensity = 1; }
          mats.set(key, m);
        }
        return mats.get(key);
      };
      const put = (geo, color, extra, x = 0, y = 0, z = 0) => {
        const o = new THREE.Mesh(geo, mat(color, extra));
        o.castShadow = true;
        o.position.set(x, y, z);
        return o;
      };
      return {
        mat,
        box: (w, h, d, color, x = 0, y = 0, z = 0, extra = {}) => put(new THREE.BoxGeometry(w, h, d), color, extra, x, y, z),
        cyl: (rt, rb, h, color, x = 0, y = 0, z = 0, extra = {}, seg = 20) => put(new THREE.CylinderGeometry(rt, rb, h, seg), color, extra, x, y, z),
        ball: (r, color, x = 0, y = 0, z = 0, extra = {}, seg = 16) => put(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75 | 0)), color, extra, x, y, z),
        torus: (r, t, color, x = 0, y = 0, z = 0, extra = {}, arc = Math.PI * 2) => put(new THREE.TorusGeometry(r, t, 8, 28, arc), color, extra, x, y, z),
        lathe: (profile, color, extra = {}, seg = 28) => put(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg), color, extra),
        // A rounded rectangle (w along x, d along z) standing h high from y0
        rr: (w, d, h, r, color, x = 0, y0 = 0, z = 0, extra = {}) => put(imRoundRectGeometry(w, d, h, r), color, extra, x, y0, z),
        tube: (pts, r, color, extra = {}, closed = false) => put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), closed), Math.max(12, pts.length * 8), r, 8, closed), color, extra),
        // A flat outline (x, y points) extruded `depth` along z, centred on z = 0
        slab: (pts, depth, color, extra = {}) => {
          const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth, bevelEnabled: false, curveSegments: 10 });
          geo.translate(0, 0, -depth / 2);
          return put(geo, color, extra);
        },
        rod: (a, b, r, color, extra = {}) => {
          const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), dir = to.clone().sub(from);
          const o = put(new THREE.CylinderGeometry(r, r, dir.length(), 10), color, extra);
          o.position.copy(from).add(to).multiplyScalar(0.5);
          o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
          return o;
        },
        // Many copies of one small part (keys, studs, strings) as a single draw call
        many: (geo, color, spots, extra = {}) => {
          const o = new THREE.Mesh(imMergeCopies(geo, spots), mat(color, extra));
          o.castShadow = true;
          return o;
        },
        done: (...parts) => realSize(group(...parts))
      };
    }

// Copies of one geometry at each spot, joined into a single geometry (one draw call, true bounds)
function imMergeCopies(geo, spots) {
      const src = geo.index ? geo.toNonIndexed() : geo;
      const names = ['position', 'normal', 'uv'].filter(n => src.attributes[n]);
      const count = src.attributes.position.count;
      const out = new THREE.BufferGeometry();
      names.forEach(n => {
        const a = src.attributes[n], size = a.itemSize, arr = new Float32Array(count * size * spots.length);
        spots.forEach((p, k) => {
          for (let i = 0; i < count; i++) for (let c = 0; c < size; c++) arr[(k * count + i) * size + c] = a.array[i * size + c] + (n === 'position' ? p[c] : 0);
        });
        out.setAttribute(n, new THREE.BufferAttribute(arr, size));
      });
      if (src !== geo) src.dispose();
      geo.dispose();
      return out;
    }

function imRoundRectGeometry(w, d, h, r) {
      r = Math.min(r, w / 2 - 1e-4, d / 2 - 1e-4);
      const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
      s.moveTo(x + r, y);
      s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
      s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
      const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 6 });
      geo.rotateX(-Math.PI / 2); // extrusion up the y axis, the outline lying in x-z
      return geo;
    }

const IM = {
  steel: { metalness: 0.9, roughness: 0.28 }, chrome: { metalness: 1, roughness: 0.12 }, alu: { metalness: 0.85, roughness: 0.35 },
  iron: { metalness: 0.55, roughness: 0.6 }, plastic: { roughness: 0.4 }, matte: { roughness: 0.85 }, rubber: { roughness: 0.92 },
  glass: { transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1 }, screen: { roughness: 0.15, metalness: 0.2, emissive: 0x0b1220, emissiveIntensity: 0.6 },
  cloth: { roughness: 0.95 }, wood: { roughness: 0.7 }, ceramic: { roughness: 0.25 }, paper: { roughness: 0.9 }
};

// --- Kitchen -----------------------------------------------------------------------------------
function imPanModel(lower) {
      const K = imKit();
      const cast = /cast ?iron|skillet/.test(lower), wok = /\bwok\b/.test(lower);
      const col = cast ? 0x26262a : wok ? 0x3a3a3e : 0x2e2f33;
      const fin = cast ? IM.iron : { metalness: 0.4, roughness: 0.45 };
      const R = wok ? 0.17 : 0.13, H = wok ? 0.09 : 0.05;
      const body = K.lathe([[0, 0], [R * 0.75, 0], [R * 0.85, 0.006], [R, H], [R - 0.005, H], [R * 0.84, 0.011], [0, 0.011]], col, { ...fin, side: THREE.DoubleSide });
      const handleCol = cast ? col : 0x1c1917;
      const handle = K.box(0.17, 0.018, 0.03, handleCol, R + 0.08, H - 0.012, 0, cast ? fin : IM.plastic);
      handle.rotation.z = 0.15;
      const parts = [body, handle];
      if (cast) parts.push(K.box(0.03, 0.012, 0.04, col, -R - 0.012, H - 0.005, 0, fin));
      else parts.push(K.cyl(0.012, 0.012, 0.012, 0x9ca3af, R + 0.005, H - 0.01, 0, IM.steel));
      return K.done(...parts);
    }

function imPotModel(lower) {
      const K = imKit();
      const sauce = /sauce ?pan/.test(lower), dutch = /dutch oven|casserole/.test(lower), stock = /stock ?pot|soup pot|big pot/.test(lower);
      const R = stock ? 0.14 : sauce ? 0.085 : 0.12, H = stock ? 0.24 : sauce ? 0.1 : 0.13;
      const col = dutch ? 0xb91c1c : 0xc8ccd0, fin = dutch ? { roughness: 0.3, metalness: 0.1 } : IM.steel;
      const body = K.lathe([[0, 0], [R, 0], [R, H], [R - 0.003, H], [R - 0.003, 0.004], [0, 0.004]], col, { ...fin, side: THREE.DoubleSide });
      const lid = K.lathe([[0, H + 0.025], [R * 0.5, H + 0.02], [R + 0.004, H + 0.002], [R + 0.004, H]], dutch ? col : 0xd4d8dc, dutch ? fin : IM.steel);
      const knob = K.cyl(0.014, 0.018, 0.02, dutch ? 0x1c1917 : 0x9ca3af, 0, H + 0.035, 0, dutch ? IM.plastic : IM.steel);
      const parts = [body, lid, knob];
      if (sauce) {
        const h = K.box(0.18, 0.016, 0.026, 0x9ca3af, R + 0.09, H - 0.02, 0, IM.steel);
        h.rotation.z = 0.2;
        parts.push(h);
      } else [-1, 1].forEach(s => { const h = K.torus(0.022, 0.006, dutch ? col : 0x9ca3af, s * (R + 0.012), H - 0.03, 0, fin, Math.PI); h.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2; h.rotation.x = Math.PI / 2; parts.push(h); });
      return K.done(...parts);
    }

function imKettleModel(lower) {
      const K = imKit();
      if (/electric|cordless/.test(lower)) {
        const base = K.cyl(0.085, 0.09, 0.025, 0x1f2937, 0, 0.0125, 0, IM.plastic);
        const body = K.lathe([[0, 0.025], [0.08, 0.025], [0.075, 0.2], [0.05, 0.225], [0, 0.225]], 0xd4d4d8, IM.steel);
        const handle = K.box(0.024, 0.16, 0.03, 0x111827, -0.1, 0.13, 0, IM.plastic);
        const spout = K.cyl(0.012, 0.025, 0.06, 0xd4d4d8, 0.085, 0.19, 0, IM.steel); spout.rotation.z = -0.9;
        const lid = K.cyl(0.04, 0.045, 0.012, 0x111827, 0, 0.23, 0, IM.plastic);
        const window = K.box(0.01, 0.12, 0.025, 0x93c5fd, 0, 0.12, 0.079, IM.glass);
        return K.done(base, body, handle, spout, lid, window);
      }
      const body = K.lathe([[0, 0], [0.1, 0], [0.105, 0.04], [0.09, 0.13], [0.045, 0.16], [0, 0.165]], 0xb91c1c, { roughness: 0.3, metalness: 0.2 });
      const spout = K.cyl(0.01, 0.022, 0.11, 0xb91c1c, 0.11, 0.1, 0, { roughness: 0.3 }); spout.rotation.z = -0.95;
      const arch = K.torus(0.07, 0.008, 0x111827, 0, 0.17, 0, IM.plastic, Math.PI);
      const knob = K.ball(0.014, 0x111827, 0, 0.17, 0);
      return K.done(body, spout, arch, knob);
    }

function imCuttingBoardModel() {
      const K = imKit();
      const board = K.rr(0.38, 0.25, 0.02, 0.025, 0xc8955a, 0, 0, 0, IM.wood);
      const hole = K.cyl(0.012, 0.012, 0.021, 0x8b5a2b, -0.165, 0.0105, 0, IM.wood);
      const groove = K.box(0.33, 0.002, 0.006, 0xa87442, 0.01, 0.0205, 0.1, IM.wood);
      return K.done(board, hole, groove);
    }

function imRollingPinModel() {
      const K = imKit();
      const roller = K.cyl(0.03, 0.03, 0.26, 0xd6a96c, 0, 0.03, 0, IM.wood); roller.rotation.z = Math.PI / 2;
      const parts = [roller];
      [-1, 1].forEach(s => { const h = K.cyl(0.013, 0.016, 0.09, 0xb7793e, s * 0.175, 0.03, 0, IM.wood); h.rotation.z = Math.PI / 2; parts.push(h, K.ball(0.016, 0xb7793e, s * 0.222, 0.03, 0)); });
      return K.done(...parts);
    }

// Kitchen hand tools lying flat: a handle and a head of the right kind
function imUtensilModel(lower) {
      const K = imKit();
      const parts = [];
      const lay = (o) => { parts.push(o); return o; };
      if (/whisk/.test(lower)) {
        lay(K.cyl(0.012, 0.012, 0.12, 0x9ca3af, -0.1, 0.03, 0, IM.steel)).rotation.z = Math.PI / 2;
        for (let i = 0; i < 4; i++) {
          const loop = K.torus(0.05, 0.0015, 0xd1d5db, 0.01, 0.03, 0, IM.steel);
          loop.scale.set(1.9, 0.6, 1);
          loop.rotation.x = (i / 4) * Math.PI;
          lay(loop);
        }
        return K.done(...parts);
      }
      if (/tongs/.test(lower)) {
        [-1, 1].forEach(s => { const arm = K.box(0.24, 0.004, 0.02, 0xd1d5db, 0, 0.02 + s * 0.012, 0, IM.steel); arm.rotation.z = s * 0.06; lay(arm); });
        lay(K.box(0.03, 0.03, 0.022, 0x1f2937, -0.12, 0.02, 0, IM.plastic));
        return K.done(...parts);
      }
      const wood = /wooden/.test(lower);
      const handleCol = wood ? 0xc8955a : 0x1f2937;
      lay(K.box(0.2, 0.01, 0.022, handleCol, -0.1, 0.01, 0, wood ? IM.wood : IM.plastic));
      if (/ladle/.test(lower)) {
        lay(K.lathe([[0, 0], [0.04, 0.004], [0.045, 0.035], [0.043, 0.035], [0, 0.003]], 0xd1d5db, { ...IM.steel, side: THREE.DoubleSide })).position.set(0.04, 0, 0);
      } else if (/spoon/.test(lower)) {
        const bowl = lay(K.ball(0.03, handleCol, 0.03, 0.012, 0, wood ? IM.wood : IM.plastic)); bowl.scale.set(1.4, 0.35, 1);
      } else {
        // a turner / spatula: a broad flat head with slots
        lay(K.rr(0.1, 0.075, 0.004, 0.012, wood ? 0xc8955a : 0x111827, 0.045, 0.006, 0, wood ? IM.wood : IM.rubber));
      }
      return K.done(...parts);
    }

function imCutleryModel() {
      const K = imKit(), parts = [];
      [-0.03, 0, 0.03].forEach((z, i) => {
        parts.push(K.box(0.13, 0.004, 0.012, 0xd1d5db, -0.04, 0.003 + i * 0.002, z, IM.steel));
        if (i === 0) for (let t = 0; t < 4; t++) parts.push(K.box(0.05, 0.003, 0.003, 0xd1d5db, 0.05, 0.003, z - 0.0075 + t * 0.005, IM.steel));
        if (i === 1) { const b = K.ball(0.02, 0xd1d5db, 0.045, 0.006, z, IM.steel); b.scale.set(1.5, 0.3, 1); parts.push(b); }
        if (i === 2) parts.push(K.box(0.09, 0.003, 0.016, 0xe5e7eb, 0.065, 0.007, z, IM.chrome));
      });
      return K.done(...parts);
    }

function imMeasuringCupsModel() {
      const K = imKit(), parts = [];
      [0.045, 0.038, 0.031, 0.024].forEach((r, i) => {
        const x = -0.09 + i * 0.065;
        parts.push(K.lathe([[0, 0], [r * 0.85, 0], [r, r * 1.1], [r - 0.002, r * 1.1], [0, 0.002]], 0xd1d5db, { ...IM.steel, side: THREE.DoubleSide }));
        parts[parts.length - 1].position.x = x;
        parts.push(K.box(0.07, 0.003, 0.016, 0xd1d5db, x, r * 1.1, -r - 0.035, IM.steel));
        parts[parts.length - 1].rotation.y = Math.PI / 2;
      });
      return K.done(...parts);
    }

function imMixingBowlModel(lower) {
      const K = imKit(), parts = [];
      const col = /glass/.test(lower) ? 0xdbeafe : /ceramic|stoneware/.test(lower) ? 0xf5f5f4 : 0xd4d4d8;
      const fin = /glass/.test(lower) ? IM.glass : /ceramic|stoneware/.test(lower) ? IM.ceramic : IM.steel;
      const sizes = /set|bowls/.test(lower) ? [0.14, 0.11, 0.085] : [0.13];
      sizes.forEach((R, i) => {
        const b = K.lathe([[0, 0], [R * 0.45, 0], [R * 0.85, R * 0.4], [R, R * 0.75], [R - 0.003, R * 0.75], [R * 0.84, R * 0.4], [R * 0.44, 0.004], [0, 0.004]], col, { ...fin, side: THREE.DoubleSide }, 32);
        b.position.y = i * 0.012;
        parts.push(b);
      });
      return K.done(...parts);
    }

function imPlatesModel(lower) {
      const K = imKit(), parts = [];
      const n = /plates|dishes|set|dinnerware/.test(lower) ? 5 : 1;
      const col = /blue/.test(lower) ? 0xdbeafe : 0xfafaf9;
      for (let i = 0; i < n; i++) {
        const p = K.lathe([[0, 0], [0.08, 0], [0.09, 0.008], [0.135, 0.02], [0.133, 0.023], [0.088, 0.012], [0, 0.005]], col, IM.ceramic, 36);
        p.position.y = i * 0.012;
        parts.push(p);
      }
      parts.push(K.torus(0.131, 0.0015, 0x1d4ed8, 0, n * 0.012 + 0.009, 0, IM.ceramic)); parts[parts.length - 1].rotation.x = Math.PI / 2;
      return K.done(...parts);
    }

function imMugModel(lower) {
      const K = imKit();
      if (/turned|wooden|maple|cherry|walnut|oak/.test(lower)) {
        const wood = /cherry/.test(lower) ? 0x9a4a2b : /walnut/.test(lower) ? 0x5c3a21 : 0xd6a96c;
        const cup = K.lathe([[0, 0], [0.042, 0], [0.044, 0.006], [0.044, 0.1], [0.038, 0.1], [0.036, 0.012], [0, 0.012]], wood, IM.wood, 28);
        const h = K.torus(0.026, 0.009, wood, 0.048, 0.055, 0, IM.wood, Math.PI); h.rotation.z = -Math.PI / 2;
        return K.done(cup, h);
      }
      const col = /white/.test(lower) ? 0xf8fafc : /red/.test(lower) ? 0xb91c1c : /black/.test(lower) ? 0x1f2937 : /green/.test(lower) ? 0x15803d : /enamel|camp/.test(lower) ? 0x1e3a8a : 0x2f6f8f;
      const body = K.lathe([[0, 0], [0.04, 0], [0.042, 0.004], [0.042, 0.095], [0.039, 0.095], [0.039, 0.008], [0, 0.008]], col, { ...IM.ceramic, side: THREE.DoubleSide }, 32);
      const inside = K.cyl(0.038, 0.038, 0.001, 0x3b2010, 0, 0.07, 0, { roughness: 0.2 });
      const handle = K.torus(0.026, 0.007, col, 0.046, 0.05, 0, IM.ceramic, Math.PI); handle.rotation.z = -Math.PI / 2;
      return K.done(body, ...(/coffee|tea|cocoa/.test(lower) ? [inside] : []), handle);
    }

function imFrenchPressModel() {
      const K = imKit();
      const glassBody = K.cyl(0.05, 0.05, 0.17, 0xdbeafe, 0, 0.1, 0, IM.glass); glassBody.castShadow = false;
      const coffee = K.cyl(0.047, 0.047, 0.09, 0x3b2010, 0, 0.06, 0, { roughness: 0.3 });
      const frame = K.lathe([[0, 0], [0.056, 0], [0.056, 0.016], [0.052, 0.016], [0.052, 0.004], [0, 0.004]], 0xd1d5db, IM.steel);
      const lid = K.cyl(0.054, 0.054, 0.018, 0xd1d5db, 0, 0.195, 0, IM.steel);
      const plunger = K.cyl(0.004, 0.004, 0.08, 0xd1d5db, 0, 0.23, 0, IM.steel);
      const knob = K.ball(0.014, 0x111827, 0, 0.27, 0);
      const handle = K.tube([[0.052, 0.17], [0.09, 0.16], [0.095, 0.08], [0.052, 0.04]].map(([x, y]) => [x, y, 0]), 0.008, 0x111827, IM.plastic);
      return K.done(glassBody, coffee, frame, lid, plunger, knob, handle);
    }

function imApplianceModel(lower) {
      const K = imKit();
      if (/toaster oven|microwave/.test(lower)) {
        const body = K.rr(0.48, 0.36, 0.28, 0.02, 0xd4d4d8, 0, 0, 0, IM.alu);
        const door = K.box(0.33, 0.22, 0.01, 0x111827, -0.05, 0.14, 0.181, IM.screen);
        const panel = K.box(0.1, 0.22, 0.01, 0x27272a, 0.18, 0.14, 0.181, IM.plastic);
        return K.done(body, door, panel);
      }
      if (/toaster/.test(lower)) {
        const body = K.rr(0.28, 0.17, 0.19, 0.04, 0xe5e7eb, 0, 0, 0, IM.steel);
        const slots = [-0.03, 0.03].map(z => K.box(0.2, 0.004, 0.03, 0x111827, 0, 0.19, z, IM.matte));
        const lever = K.box(0.02, 0.012, 0.03, 0x111827, 0.15, 0.13, 0, IM.plastic);
        const feet = K.box(0.26, 0.012, 0.15, 0x111827, 0, 0.006, 0, IM.plastic);
        return K.done(body, ...slots, lever, feet);
      }
      if (/blender|food processor|mixer/.test(lower)) {
        const base = K.rr(0.17, 0.17, 0.12, 0.03, 0x1f2937, 0, 0, 0, IM.plastic);
        const dial = K.cyl(0.02, 0.02, 0.012, 0xd1d5db, 0, 0.06, 0.087, IM.chrome); dial.rotation.x = Math.PI / 2;
        const jar = K.lathe([[0.055, 0.12], [0.075, 0.38], [0.073, 0.38], [0.053, 0.13]], 0xdbeafe, { ...IM.glass, side: THREE.DoubleSide }); jar.castShadow = false;
        const lid = K.cyl(0.078, 0.076, 0.02, 0x111827, 0, 0.39, 0, IM.plastic);
        const handle = K.box(0.02, 0.2, 0.03, 0x1f2937, 0.09, 0.26, 0, IM.plastic);
        return K.done(base, dial, jar, lid, handle);
      }
      // a drip coffee maker / espresso machine
      const base = K.rr(0.22, 0.24, 0.035, 0.02, 0x111827, 0, 0, 0, IM.plastic);
      const tower = K.rr(0.22, 0.1, 0.34, 0.02, 0x111827, 0, 0, -0.07, IM.plastic);
      const top = K.rr(0.22, 0.24, 0.06, 0.02, 0x1f2937, 0, 0.3, 0, IM.plastic);
      const pot = K.lathe([[0, 0], [0.065, 0], [0.07, 0.07], [0.05, 0.14], [0, 0.14]], 0xdbeafe, IM.glass); pot.position.set(0, 0.035, 0.04); pot.castShadow = false;
      const brew = K.cyl(0.062, 0.062, 0.05, 0x3b2010, 0, 0.06, 0.04, { roughness: 0.2 });
      return K.done(base, tower, top, pot, brew);
    }

// --- Electronics -------------------------------------------------------------------------------
function imLaptopModel() {
      const K = imKit();
      const base = K.rr(0.32, 0.22, 0.016, 0.01, 0xa1a1aa, 0, 0, 0, IM.alu);
      const keys = K.box(0.27, 0.002, 0.1, 0x18181b, 0, 0.017, -0.025, IM.matte);
      const pad = K.box(0.1, 0.001, 0.065, 0x8b8b93, 0, 0.0165, 0.06, IM.alu);
      // The lid hinges at the back edge, opened a little past upright; the screen is on its inner face
      const lid = group(K.rr(0.32, 0.21, 0.008, 0.01, 0xa1a1aa, 0, 0, 0.105, IM.alu), K.box(0.29, 0.001, 0.18, 0x0f172a, 0, -0.001, 0.105, IM.screen));
      lid.position.set(0, 0.016, -0.11);
      lid.rotation.x = -1.83;
      return K.done(base, keys, pad, lid);
    }

function imPhoneModel(lower) {
      const K = imKit();
      const tablet = /tablet|ipad|e-?reader|kindle/.test(lower);
      const [w, d, t] = tablet ? [0.17, 0.25, 0.007] : [0.072, 0.15, 0.008];
      const body = K.rr(w, d, t, tablet ? 0.012 : 0.009, 0x27272a, 0, 0, 0, IM.alu);
      const screen = K.rr(w - 0.006, d - 0.008, 0.0006, tablet ? 0.009 : 0.007, /e-?reader|kindle/.test(lower) ? 0xd6d3d1 : 0x0f172a, 0, t, 0, /e-?reader|kindle/.test(lower) ? IM.paper : IM.screen);
      // lying on its back, screen up, with its home bar and speaker slot
      const bar = K.box(w * 0.3, 0.0008, 0.004, 0x9ca3af, 0, t + 0.0007, d / 2 - 0.01);
      const slot = K.box(w * 0.25, 0.0008, 0.003, 0x111827, 0, t + 0.0007, -d / 2 + 0.008);
      const glow = K.box(w - 0.016, 0.0004, d * 0.35, tablet ? 0x1e3a8a : 0x0f766e, 0, t + 0.0008, -d * 0.12, { ...IM.screen, emissive: 0x1e3a8a, emissiveIntensity: 0.35 });
      return K.done(body, screen, bar, slot, ...(/e-?reader|kindle/.test(lower) ? [] : [glow]));
    }

function imHeadphonesModel(lower) {
      const K = imKit();
      if (/earbuds|earphones|airpods/.test(lower)) {
        const c = K.rr(0.06, 0.03, 0.045, 0.012, 0xf8fafc, 0, 0, 0, IM.plastic);
        const lid = K.box(0.0605, 0.001, 0.0305, 0xe5e7eb, 0, 0.032, 0);
        return K.done(c, lid);
      }
      const col = /white/.test(lower) ? 0xf1f5f9 : 0x1f2937;
      const band = K.torus(0.085, 0.009, col, 0, 0.1, 0, IM.plastic, Math.PI);
      const cups = [-1, 1].map(s => { const cup = K.cyl(0.045, 0.045, 0.035, col, s * 0.085, 0.06, 0, IM.plastic); cup.rotation.z = Math.PI / 2; return cup; });
      const pads = [-1, 1].map(s => { const p = K.cyl(0.04, 0.04, 0.012, 0x111827, s * 0.062, 0.06, 0, { roughness: 0.9 }); p.rotation.z = Math.PI / 2; return p; });
      return K.done(band, ...cups, ...pads);
    }

function imSpeakerModel(lower) {
      const K = imKit();
      if (/bluetooth|portable|wireless/.test(lower)) {
        const body = K.cyl(0.04, 0.04, 0.18, 0x1e3a8a, 0, 0.04, 0, IM.cloth); body.rotation.z = Math.PI / 2;
        const ends = [-1, 1].map(s => { const e = K.cyl(0.042, 0.042, 0.01, 0x111827, s * 0.093, 0.04, 0, IM.rubber); e.rotation.z = Math.PI / 2; return e; });
        const keys = K.box(0.08, 0.004, 0.015, 0x111827, 0, 0.081, 0, IM.rubber);
        return K.done(body, ...ends, keys);
      }
      const box = K.box(0.18, 0.3, 0.22, 0x3f2a1d, 0, 0.15, 0, IM.wood);
      const woofer = K.cyl(0.065, 0.06, 0.012, 0x111827, 0, 0.1, 0.11, IM.matte); woofer.rotation.x = Math.PI / 2;
      const tweeter = K.cyl(0.02, 0.018, 0.012, 0x27272a, 0, 0.23, 0.11, IM.matte); tweeter.rotation.x = Math.PI / 2;
      return K.done(box, woofer, tweeter);
    }

function imKeyboardModel(lower) {
      const K = imKit();
      const plate = K.rr(0.44, 0.14, 0.022, 0.008, 0x27272a, 0, 0, 0, IM.plastic);
      const spots = [];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 15; c++) spots.push([-0.2 + c * 0.0285, 0.026, -0.052 + r * 0.026]);
      const keys = K.many(new THREE.BoxGeometry(0.024, 0.01, 0.022), /white/.test(lower) ? 0xe5e7eb : 0x3f3f46, spots, IM.plastic);
      const space = K.box(0.13, 0.01, 0.022, 0x3f3f46, 0, 0.026, 0.078, IM.plastic);
      return K.done(plate, keys, space);
    }

function imMouseModel() {
      const K = imKit();
      const shell = K.ball(0.033, 0x27272a, 0, 0.0, 0, IM.plastic, 20); shell.scale.set(0.95, 0.6, 1.75);
      const wheel = K.cyl(0.006, 0.006, 0.006, 0x52525b, 0, 0.019, -0.03, IM.rubber); wheel.rotation.z = Math.PI / 2;
      const g = group(shell, wheel);
      return K.done(at(g, 0, 0.02, 0));
    }

// A bare circuit board: a Raspberry Pi, an Arduino, an ESP32, a breadboard or any PCB
function imCircuitBoardModel(lower) {
      const K = imKit();
      if (/breadboard/.test(lower)) {
        const b = K.box(0.165, 0.01, 0.055, 0xf5f5f4, 0, 0.005, 0, IM.plastic);
        const rails = [-0.024, 0.024].map(z => K.box(0.16, 0.001, 0.002, z < 0 ? 0x2563eb : 0xdc2626, 0, 0.0105, z));
        return K.done(b, ...rails);
      }
      if (/bare|blank|fr-?4|copper.?clad/.test(lower)) return K.done(...[0, 1, 2, 3].map(i => K.box(0.16, 0.0016, 0.1, i === 3 ? 0xc2702e : 0xd4a017, i * 0.004, 0.0008 + i * 0.0018, i * 0.003, i === 3 ? IM.chrome : { roughness: 0.5 })));
      const pi = /raspberry|\bpi\b/.test(lower), ard = /arduino|uno|nano|mega/.test(lower), esp = /esp32|esp8266|microcontroller/.test(lower);
      const [w, d] = pi ? [0.085, 0.056] : ard ? [0.069, 0.053] : esp ? [0.052, 0.028] : [0.1, 0.07];
      const pcbCol = pi ? 0x166534 : ard ? 0x0e7490 : 0x14532d;
      const parts = [K.box(w, 0.0016, d, pcbCol, 0, 0.0028, 0, { roughness: 0.45 })];
      [[-w / 2 + 0.003, -d / 2 + 0.003], [w / 2 - 0.003, -d / 2 + 0.003], [-w / 2 + 0.003, d / 2 - 0.003], [w / 2 - 0.003, d / 2 - 0.003]].forEach(([x, z]) => parts.push(K.cyl(0.0015, 0.0015, 0.002, 0x111111, x, 0.001, z)));
      parts.push(K.box(0.014, 0.0015, 0.014, 0x111827, -w * 0.05, 0.0043, 0, IM.matte)); // main chip
      if (pi) {
        parts.push(K.box(0.05, 0.0085, 0.005, 0x111827, -0.005, 0.0078, -d / 2 + 0.004, IM.plastic)); // GPIO header
        parts.push(K.box(0.017, 0.013, 0.013, 0xd1d5db, w / 2 - 0.008, 0.01, -0.012, IM.steel), K.box(0.017, 0.016, 0.015, 0xd1d5db, w / 2 - 0.008, 0.011, 0.012, IM.steel), K.box(0.013, 0.013, 0.015, 0x9ca3af, w / 2 - 0.008, 0.009, -0.03 + 0.02, IM.steel));
      } else if (ard) {
        parts.push(K.box(0.012, 0.011, 0.016, 0xd1d5db, -w / 2 + 0.005, 0.009, -0.012, IM.steel)); // USB
        parts.push(K.box(0.014, 0.011, 0.009, 0x111827, -w / 2 + 0.006, 0.009, 0.015, IM.plastic)); // barrel jack
        parts.push(K.box(0.045, 0.0085, 0.0025, 0x111827, 0.005, 0.0078, -d / 2 + 0.003, IM.plastic), K.box(0.045, 0.0085, 0.0025, 0x111827, 0.005, 0.0078, d / 2 - 0.003, IM.plastic));
        parts.push(K.box(0.035, 0.004, 0.009, 0x111827, 0.012, 0.0055, 0.008, IM.matte));
      } else {
        parts.push(K.box(0.018, 0.003, 0.016, 0xa3a3a3, 0.01, 0.005, 0, IM.steel));
        for (let i = 0; i < 4; i++) parts.push(K.box(0.004, 0.002, 0.003, 0x52525b, -w * 0.3 + i * 0.008, 0.0045, d * 0.3));
      }
      return K.done(...parts);
    }

function imMultimeterModel() {
      const K = imKit();
      const body = K.rr(0.09, 0.18, 0.035, 0.01, 0xeab308, 0, 0, 0, IM.rubber);
      const face = K.rr(0.075, 0.16, 0.002, 0.006, 0x27272a, 0, 0.035, 0, IM.plastic);
      const lcd = K.box(0.06, 0.002, 0.035, 0x9ca38f, 0, 0.037, -0.05, { roughness: 0.3 });
      const dial = K.cyl(0.022, 0.022, 0.006, 0x111827, 0, 0.039, 0.015, IM.plastic);
      const jacks = [-0.022, 0, 0.022].map((x, i) => K.cyl(0.004, 0.004, 0.003, i === 0 ? 0xdc2626 : 0x111827, x, 0.038, 0.065));
      const leads = [0xdc2626, 0x111827].map((c, i) => K.tube([[-0.022 + i * 0.022, 0.04, 0.065], [0.03 + i * 0.02, 0.01, 0.12], [0.08 + i * 0.015, 0.005, 0.05], [0.07 + i * 0.02, 0.005, -0.06]], 0.002, c, IM.rubber));
      return K.done(body, face, lcd, dial, ...jacks, ...leads);
    }

function imSolderingIronModel() {
      const K = imKit();
      const base = K.rr(0.12, 0.09, 0.02, 0.01, 0x1f2937, 0, 0, 0, IM.iron);
      const sponge = K.box(0.05, 0.008, 0.04, 0xeab308, -0.025, 0.024, 0, { roughness: 1 });
      const coil = K.many(new THREE.TorusGeometry(0.013, 0.0015, 6, 14), 0xd1d5db, Array.from({ length: 8 }, (_, i) => [0.03, 0.03 + i * 0.008, 0]), IM.steel);
      coil.rotation.z = 0.5;
      coil.position.set(-0.01, 0, 0);
      const iron = group(
        K.cyl(0.011, 0.012, 0.09, 0x2563eb, 0, 0.045, 0, IM.rubber),
        K.cyl(0.005, 0.006, 0.05, 0xd1d5db, 0, 0.115, 0, IM.steel),
        K.cyl(0.0012, 0.003, 0.025, 0x94a3b8, 0, 0.152, 0, IM.steel)
      );
      iron.rotation.z = -1.0;
      iron.position.set(0.05, 0.03, 0);
      const cord = K.tube([[-0.02, 0.06, 0], [-0.07, 0.02, 0.03], [-0.09, 0.005, 0.08]], 0.003, 0x111827, IM.rubber);
      return K.done(base, sponge, coil, iron, cord);
    }

function imCableModel(lower) {
      const K = imKit();
      const col = /white|usb-?c|lightning/.test(lower) ? 0xf1f5f9 : /orange|extension/.test(lower) ? 0xf97316 : 0x1f2937;
      const r = /extension/.test(lower) ? 0.09 : 0.06, t = /extension/.test(lower) ? 0.004 : 0.0022;
      const loops = [0, 1, 2, 3].map(i => { const l = K.torus(r - i * 0.004, t, col, 0, t + i * t * 1.6, 0, IM.rubber); l.rotation.x = Math.PI / 2; return l; });
      const plugA = K.box(0.03, 0.01, 0.014, col, r + 0.02, 0.006, 0.01, IM.plastic);
      const plugB = K.box(0.02, 0.008, 0.012, 0xd1d5db, r + 0.04, 0.006, 0.01, IM.steel);
      const parts = [...loops, plugA, plugB];
      if (/charger|adapter|power brick/.test(lower)) parts.push(K.rr(0.05, 0.05, 0.028, 0.006, col, -0.0, 0.0, 0, IM.plastic));
      return K.done(...parts);
    }

function imPowerBankModel() {
      const K = imKit();
      return K.done(K.rr(0.07, 0.14, 0.016, 0.01, 0x334155, 0, 0, 0, IM.plastic), ...[0, 1, 2, 3].map(i => K.cyl(0.0015, 0.0015, 0.001, i < 3 ? 0x22c55e : 0x475569, -0.012 + i * 0.008, 0.0165, 0.05)));
    }

function imFanModel() {
      const K = imKit();
      const base = K.cyl(0.1, 0.11, 0.03, 0xf1f5f9, 0, 0.015, 0, IM.plastic);
      const stem = K.cyl(0.012, 0.014, 0.22, 0xf1f5f9, 0, 0.14, 0, IM.plastic);
      const motor = K.ball(0.05, 0xf1f5f9, 0, 0.29, -0.05, IM.plastic); motor.scale.z = 1.4;
      const cage = K.torus(0.15, 0.004, 0xd1d5db, 0, 0.29, 0.02, IM.steel);
      const rings = K.torus(0.08, 0.002, 0xd1d5db, 0, 0.29, 0.03, IM.steel);
      const parts = [base, stem, motor, cage, rings];
      for (let i = 0; i < 3; i++) {
        const blade = K.ball(0.06, 0x7dd3fc, 0, 0.29, 0.0, { ...IM.plastic, transparent: true, opacity: 0.8 }); blade.scale.set(0.55, 1, 0.08);
        const pivot = group(at(blade, 0, 0.065, 0)); pivot.position.set(0, 0.29 - 0.29, 0.0); pivot.rotation.z = i * (Math.PI * 2 / 3);
        const holder = group(pivot); holder.position.set(0, 0.29, 0.0); parts.push(holder);
        blade.position.y = 0.065;
      }
      return K.done(...parts);
    }

function imClockModel(lower) {
      const K = imKit();
      if (/wall clock|kitchen clock|clock face/.test(lower)) {
        const rim = K.cyl(0.15, 0.15, 0.04, 0x1f2937, 0, 0.15, 0, IM.plastic); rim.rotation.x = Math.PI / 2;
        const face = K.cyl(0.14, 0.14, 0.002, 0xf8fafc, 0, 0.15, 0.021, IM.paper); face.rotation.x = Math.PI / 2;
        const ticks = K.many(new THREE.BoxGeometry(0.006, 0.018, 0.002), 0x111827, Array.from({ length: 12 }, (_, i) => [Math.sin(i / 12 * Math.PI * 2) * 0.12, 0.15 + Math.cos(i / 12 * Math.PI * 2) * 0.12, 0.023]));
        const hh = K.box(0.006, 0.07, 0.002, 0x111827, 0.02, 0.18, 0.025); hh.rotation.z = -0.6;
        const mh = K.box(0.004, 0.11, 0.002, 0x111827, -0.03, 0.195, 0.026); mh.rotation.z = 0.55;
        return K.done(rim, face, ticks, hh, mh);
      }
      // a twin-bell alarm clock
      const body = K.cyl(0.055, 0.055, 0.045, 0xb91c1c, 0, 0.07, 0, { roughness: 0.3, metalness: 0.4 }); body.rotation.x = Math.PI / 2;
      const face = K.cyl(0.048, 0.048, 0.002, 0xf8fafc, 0, 0.07, 0.023, IM.paper); face.rotation.x = Math.PI / 2;
      const bells = [-1, 1].map(s => { const b = K.ball(0.026, 0xd1d5db, s * 0.04, 0.13, 0, IM.chrome, 14); b.scale.y = 0.7; return b; });
      const feet = [-1, 1].map(s => K.rod([s * 0.025, 0.025, 0], [s * 0.045, 0, 0.01], 0.004, 0x111827, IM.steel));
      const hh = K.box(0.004, 0.028, 0.002, 0x111827, 0.008, 0.08, 0.025); hh.rotation.z = -0.8;
      return K.done(body, face, ...bells, ...feet, hh);
    }

function imCameraModel(lower) {
      const K = imKit();
      const slr = /dslr|slr|mirrorless|canon|nikon/.test(lower);
      const body = K.rr(slr ? 0.13 : 0.1, slr ? 0.07 : 0.03, slr ? 0.09 : 0.06, 0.01, 0x18181b, 0, 0, 0, IM.rubber);
      const lens = K.cyl(slr ? 0.034 : 0.02, slr ? 0.034 : 0.022, slr ? 0.08 : 0.02, 0x27272a, 0.012, slr ? 0.045 : 0.03, (slr ? 0.035 : 0.015) + (slr ? 0.04 : 0.01), IM.plastic);
      lens.rotation.x = Math.PI / 2;
      const glassFront = K.cyl(slr ? 0.026 : 0.014, slr ? 0.026 : 0.014, 0.002, 0x1e3a8a, 0.012, slr ? 0.045 : 0.03, slr ? 0.156 : 0.036, { roughness: 0.05, metalness: 0.6 });
      glassFront.rotation.x = Math.PI / 2;
      const parts = [body, lens, glassFront, K.cyl(0.006, 0.006, 0.006, 0xd1d5db, -0.035, slr ? 0.093 : 0.063, 0, IM.chrome)];
      if (slr) parts.push(K.box(0.04, 0.025, 0.05, 0x18181b, 0.012, 0.1, 0, IM.rubber));
      return K.done(...parts);
    }

function imGamepadModel() {
      const K = imKit();
      const body = K.rr(0.11, 0.06, 0.03, 0.025, 0x27272a, 0, 0.004, -0.005, IM.plastic);
      const grips = [-1, 1].map(s => { const g = K.ball(0.026, 0x27272a, s * 0.05, 0.018, 0.025, IM.plastic); g.scale.set(1, 0.7, 1.4); return g; });
      const sticks = [-1, 1].map(s => K.cyl(0.008, 0.009, 0.012, 0x111827, s * 0.025, 0.04, 0.01, IM.rubber));
      const btns = [[0.04, -0.012, 0x22c55e], [0.05, -0.002, 0xdc2626], [0.03, -0.002, 0x2563eb], [0.04, 0.008, 0xeab308]].map(([x, z, c]) => K.cyl(0.004, 0.004, 0.004, c, x, 0.035, z));
      const dpad = K.box(0.016, 0.004, 0.005, 0x111827, -0.04, 0.035, -0.004);
      const dpad2 = K.box(0.005, 0.004, 0.016, 0x111827, -0.04, 0.035, -0.004);
      return K.done(body, ...grips, ...sticks, ...btns, dpad, dpad2);
    }

function imWalkieTalkieModel(lower) {
      const K = imKit(), parts = [];
      const n = /walkie-?talkies|pair/.test(lower) ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * 0.07;
        parts.push(K.rr(0.055, 0.035, 0.13, 0.01, i ? 0xeab308 : 0x1f2937, x, 0, 0, IM.rubber));
        parts.push(K.cyl(0.005, 0.007, 0.08, 0x111827, x + 0.015, 0.17, 0, IM.rubber));
        parts.push(K.box(0.04, 0.03, 0.002, 0x334155, x, 0.1, 0.018, IM.screen));
        parts.push(K.box(0.04, 0.035, 0.002, 0x111827, x, 0.04, 0.018, IM.matte));
      }
      return K.done(...parts);
    }

function imScreenModel(lower) {
      const K = imKit();
      const tv = /tv|television/.test(lower);
      const w = tv ? 1.1 : 0.6, h = tv ? 0.63 : 0.35;
      const panel = K.box(w, h, 0.03, 0x18181b, 0, h / 2 + 0.11, 0, IM.plastic);
      const screen = K.box(w - 0.02, h - 0.02, 0.002, 0x0f172a, 0, h / 2 + 0.11, 0.016, IM.screen);
      const neck = K.box(0.05, 0.1, 0.03, 0x27272a, 0, 0.06, -0.02, IM.alu);
      const foot = K.rr(tv ? 0.4 : 0.22, 0.16, 0.012, 0.02, 0x27272a, 0, 0, -0.01, IM.alu);
      return K.done(panel, screen, neck, foot);
    }

function imLightBulbModel(lower) {
      const K = imKit();
      const n = /bulbs|pack/.test(lower) ? 3 : 1, parts = [];
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * 0.07;
        const bulb = K.lathe([[0, 0.11], [0.028, 0.104], [0.03, 0.085], [0.018, 0.05], [0.014, 0.035]], 0xfef9c3, { transparent: true, opacity: 0.6, roughness: 0.1, emissive: 0xfde68a, emissiveIntensity: 0.15 });
        bulb.position.x = x;
        const base = K.cyl(0.013, 0.012, 0.03, 0xd1d5db, x, 0.02, 0, IM.alu);
        const tip = K.cyl(0.006, 0.006, 0.006, 0x111827, x, 0.003, 0);
        parts.push(bulb, base, tip);
      }
      return K.done(...parts);
    }

function imWatchModel() {
      const K = imKit();
      const face = K.cyl(0.02, 0.02, 0.011, 0xd1d5db, 0, 0.012, 0, IM.steel);
      const dial = K.cyl(0.017, 0.017, 0.001, 0x0f172a, 0, 0.018, 0, { roughness: 0.2 });
      const hands = K.box(0.002, 0.001, 0.013, 0xf8fafc, 0.003, 0.019, -0.004); hands.rotation.y = 0.6;
      const strap = K.torus(0.032, 0.006, 0x3f2a1d, 0, 0.006 + 0.032, -0.0, { roughness: 0.7 });
      strap.scale.set(0.55, 1, 1);
      strap.rotation.y = Math.PI / 2;
      strap.position.set(0, 0.03, 0);
      const g = group(face, dial, hands);
      g.position.y = 0.05;
      g.rotation.x = 0;
      return K.done(strap, g);
    }

// --- Sports and outdoors -----------------------------------------------------------------------
function imRacketModel(lower) {
      const K = imKit();
      const badminton = /badminton/.test(lower), paddle = /pickleball|ping ?pong|table tennis/.test(lower);
      if (paddle) {
        const big = /pickleball/.test(lower);
        const face = K.cyl(big ? 0.095 : 0.075, big ? 0.095 : 0.075, 0.012, big ? 0x2563eb : 0xb91c1c, 0, 0.006, 0, IM.rubber);
        face.scale.z = big ? 1.1 : 1;
        const handle = K.box(0.03, 0.022, big ? 0.13 : 0.1, 0xc8955a, 0, 0.011, (big ? 0.1 : 0.075) + (big ? 0.065 : 0.05), IM.wood);
        return K.done(face, handle);
      }
      const hr = badminton ? 0.1 : 0.135, len = badminton ? 0.67 : 0.68, col = badminton ? 0x1d4ed8 : 0xdc2626;
      const head = K.torus(hr, 0.009, col, 0, 0.012, -len / 2 + hr + 0.02, IM.plastic);
      head.scale.set(0.78, 1, 1);
      head.rotation.x = Math.PI / 2;
      const strings = [];
      for (let i = -6; i <= 6; i++) strings.push(K.box(0.001, 0.001, Math.sqrt(Math.max(0, 1 - (i / 7) ** 2)) * hr * 2, 0xf8fafc, i * hr * 0.78 / 7, 0.012, -len / 2 + hr + 0.02));
      for (let i = -7; i <= 7; i++) strings.push(K.box(Math.sqrt(Math.max(0, 1 - (i / 8) ** 2)) * hr * 0.78 * 2, 0.001, 0.001, 0xf8fafc, 0, 0.012, -len / 2 + hr + 0.02 + i * hr / 8));
      const throat = [-1, 1].map(s => K.rod([s * 0.045, 0.012, -len / 2 + 2 * hr - 0.005], [0, 0.012, len / 2 - 0.2], 0.008, col, IM.plastic));
      const handle = K.cyl(0.016, 0.016, badminton ? 0.2 : 0.2, 0x111827, 0, 0.016, len / 2 - 0.1, IM.rubber);
      handle.rotation.x = Math.PI / 2;
      return K.done(head, ...strings, ...throat, handle);
    }

function imBatModel(lower) {
      const K = imKit();
      if (/cricket/.test(lower)) {
        const blade = K.box(0.108, 0.04, 0.56, 0xe7c48d, 0, 0.02, 0.1, IM.wood);
        const handle = K.cyl(0.017, 0.017, 0.3, 0x111827, 0, 0.022, -0.32, IM.rubber); handle.rotation.x = Math.PI / 2;
        return K.done(blade, handle);
      }
      const alu = /alumin|metal/.test(lower);
      const bat = K.lathe([[0, 0], [0.03, 0], [0.032, 0.01], [0.012, 0.03], [0.013, 0.3], [0.03, 0.55], [0.033, 0.8], [0.03, 0.84], [0, 0.845]], alu ? 0x9ca3af : 0xd6a96c, alu ? IM.alu : IM.wood, 20);
      bat.rotation.z = Math.PI / 2;
      bat.position.set(0.42, 0.033, 0);
      const grip = K.cyl(0.0135, 0.0135, 0.2, 0x111827, 0.42 - 0.13, 0.033, 0, IM.rubber); grip.rotation.z = Math.PI / 2;
      return K.done(bat, grip);
    }

function imGloveModel() {
      const K = imKit();
      const tan = 0xa0522d;
      const palm = K.ball(0.1, tan, 0, 0.05, 0, { roughness: 0.75 }, 20); palm.scale.set(1, 0.5, 1.15);
      const fingers = [-0.045, -0.015, 0.015, 0.045].map(x => { const f = K.cyl(0.02, 0.022, 0.12, tan, x, 0.05, -0.15, { roughness: 0.75 }); f.rotation.x = Math.PI / 2 - 0.15; return f; });
      const thumb = K.cyl(0.022, 0.025, 0.1, tan, 0.1, 0.05, -0.04, { roughness: 0.75 }); thumb.rotation.set(Math.PI / 2, 0, 0.8);
      const web = K.box(0.06, 0.04, 0.05, 0x5b3a1e, 0.075, 0.07, -0.1, IM.cloth);
      const lace = K.torus(0.1, 0.004, 0xd6b38a, 0, 0.06, 0, IM.cloth); lace.rotation.x = Math.PI / 2; lace.scale.set(1, 1.15, 1);
      return K.done(palm, ...fingers, thumb, web, lace);
    }

function imSportsBallModel(lower) {
      const K = imKit();
      const spec = [
        [/basketball/, 0.12, 0xd9661f, 0x1c1917], [/tennis ball/, 0.0335, 0xd4e837, 0xf8fafc], [/baseball|softball/, /softball/.test(lower) ? 0.048 : 0.037, 0xf8fafc, 0xdc2626],
        [/golf ball/, 0.0214, 0xf8fafc, null], [/volleyball/, 0.105, 0xf8fafc, 0x1d4ed8], [/bowling ball/, 0.108, 0x1e3a8a, null],
        [/ping ?pong|table tennis ball/, 0.02, 0xfafafa, null], [/rugby|american football|\bfootball\b(?!.*soccer)/, 0.09, 0x7c2d12, 0xf8fafc], [/dodge ?ball|kick ?ball|playground ball/, 0.1, 0xdc2626, null]
      ].find(([re]) => re.test(lower));
      if (!spec) return null;
      const [, r, col, seam] = spec;
      const rugby = /rugby|football/.test(lower);
      const ball = K.ball(r, col, 0, r, 0, { roughness: /bowling/.test(lower) ? 0.15 : 0.6 }, 24);
      const parts = [ball];
      if (rugby) { ball.scale.set(1.55, 1, 1); }
      if (seam && !rugby) {
        const a = K.torus(r * 1.002, r * 0.03, seam, 0, r, 0); a.rotation.y = Math.PI / 2;
        const b = K.torus(r * 1.002, r * 0.03, seam, 0, r, 0); b.rotation.x = Math.PI / 2;
        parts.push(a, b);
        if (/basketball/.test(lower)) { const c = K.torus(r * 1.002, r * 0.03, seam, 0, r, 0); parts.push(c); }
      }
      if (rugby) parts.push(K.box(r * 0.6, r * 0.04, r * 0.08, seam, 0, r * 2, 0));
      if (/bowling/.test(lower)) [[-0.02, 0.02], [0.02, 0.02], [0, -0.025]].forEach(([x, z]) => parts.push(K.cyl(0.011, 0.011, 0.003, 0x0b1220, x, r * 2 - 0.004, z)));
      return K.done(...parts);
    }

function imStickModel(lower) {
      const K = imKit();
      if (/golf/.test(lower)) {
        const shaft = K.rod([-0.5, 0.02, 0], [0.42, 0.02, 0], 0.006, 0xd1d5db, IM.chrome);
        const grip = K.rod([-0.5, 0.02, 0], [-0.25, 0.02, 0], 0.012, 0x111827, IM.rubber);
        const head = K.box(0.04, 0.04, 0.09, /driver|wood/.test(lower) ? 0x18181b : 0xd1d5db, 0.44, 0.02, 0.03, IM.steel);
        return K.done(shaft, grip, head);
      }
      const col = /wood/.test(lower) ? 0xc8955a : 0x111827;
      const shaft = K.box(1.4, 0.028, 0.02, col, -0.1, 0.014, 0, /wood/.test(lower) ? IM.wood : IM.plastic);
      const blade = K.slab([[0, 0], [0.32, 0], [0.34, 0.04], [0.06, 0.08], [0, 0.07]], 0.016, col, IM.plastic);
      blade.rotation.x = -Math.PI / 2;
      blade.position.set(0.58, 0.008, -0.0);
      const tape = K.box(0.15, 0.03, 0.022, 0xf8fafc, 0.68, 0.016, -0.02, IM.cloth);
      const butt = K.box(0.22, 0.031, 0.023, 0xf8fafc, -0.7, 0.014, 0, IM.cloth);
      return K.done(shaft, blade, tape, butt);
    }

function imBoardSportModel(lower) {
      const K = imKit();
      if (/snowboard/.test(lower)) {
        const deck = K.rr(1.55, 0.26, 0.012, 0.12, 0x1d4ed8, 0, 0, 0, IM.plastic);
        const bindings = [-0.25, 0.25].map(x => K.box(0.12, 0.08, 0.22, 0x111827, x, 0.052, 0, IM.rubber));
        return K.done(deck, ...bindings);
      }
      if (/surfboard|paddle ?board/.test(lower)) {
        const sup = /paddle/.test(lower);
        const board = K.ball(0.5, sup ? 0x0ea5e9 : 0xf8fafc, 0, 0.04, 0, IM.plastic, 28);
        board.scale.set(sup ? 3.2 : 1.9, 0.08, sup ? 0.8 : 0.53);
        const stripe = K.box(sup ? 2.8 : 1.6, 0.002, 0.03, sup ? 0xf8fafc : 0x0ea5e9, 0, 0.081, 0);
        return K.done(board, stripe);
      }
      // a skateboard (a longboard is longer)
      const L = /longboard/.test(lower) ? 1.0 : 0.8;
      const deck = K.rr(L - 0.12, 0.2, 0.012, 0.09, 0x27272a, 0, 0.09, 0, IM.matte);
      const kicks = [-1, 1].map(s => { const k = K.rr(0.12, 0.2, 0.012, 0.09, 0x27272a, s * (L / 2 - 0.08), 0.098, 0, IM.matte); k.rotation.z = s * 0.25; return k; });
      const wood = K.rr(L - 0.12, 0.2, 0.004, 0.09, 0xd6a96c, 0, 0.086, 0, IM.wood);
      const parts = [deck, ...kicks, wood];
      [-1, 1].forEach(s => {
        parts.push(K.box(0.05, 0.03, 0.03, 0x9ca3af, s * (L / 2 - 0.17), 0.07, 0, IM.alu));
        parts.push(K.rod([s * (L / 2 - 0.17), 0.03, -0.1], [s * (L / 2 - 0.17), 0.03, 0.1], 0.004, 0xd1d5db, IM.steel));
        [-1, 1].forEach(z => { const w = K.cyl(0.027, 0.027, 0.032, 0xfde68a, s * (L / 2 - 0.17), 0.027, z * 0.085, { roughness: 0.6 }); w.rotation.x = Math.PI / 2; parts.push(w); });
      });
      return K.done(...parts);
    }

function imFishingRodModel() {
      const K = imKit();
      const blank = K.lathe([[0.007, 0], [0.002, 1.95], [0, 1.95]], 0x1f2937, { roughness: 0.3 }, 10);
      blank.rotation.z = -Math.PI / 2;
      blank.position.set(-0.95, 0.03, 0);
      const handle = K.cyl(0.013, 0.012, 0.32, 0x8b5a2b, -0.8, 0.03, 0, { roughness: 0.9 }); handle.rotation.z = Math.PI / 2;
      const reel = K.cyl(0.03, 0.03, 0.025, 0x9ca3af, -0.6, 0.0, 0, IM.alu); reel.rotation.x = Math.PI / 2; reel.position.y = 0.03 - 0.0; reel.position.z = 0;
      const foot = K.box(0.04, 0.02, 0.01, 0x9ca3af, -0.6, 0.03, 0, IM.alu);
      const guides = K.many(new THREE.TorusGeometry(0.006, 0.0012, 6, 12), 0xd1d5db, [-0.3, 0.0, 0.3, 0.6, 0.85].map(x => [x, 0.042, 0]), IM.steel);
      const g = group(blank, handle, foot, guides, at(reel, -0.6, 0.0, 0.0));
      return K.done(g);
    }

function imTackleBoxModel() {
      const K = imKit();
      const body = K.rr(0.36, 0.2, 0.14, 0.015, 0x15803d, 0, 0, 0, IM.plastic);
      const lid = K.rr(0.365, 0.205, 0.04, 0.015, 0x166534, 0, 0.14, 0, IM.plastic);
      const handle = K.rod([-0.06, 0.2, 0], [0.06, 0.2, 0], 0.008, 0x111827, IM.plastic);
      const posts = [-0.06, 0.06].map(x => K.rod([x, 0.18, 0], [x, 0.2, 0], 0.006, 0x111827, IM.plastic));
      const latches = [-0.11, 0.11].map(x => K.box(0.03, 0.03, 0.01, 0xd1d5db, x, 0.14, 0.104, IM.steel));
      return K.done(body, lid, handle, ...posts, ...latches);
    }

function imRolledModel(lower) {
      // A yoga mat, a sleeping bag or a rug rolled up and tied
      const K = imKit();
      const rug = /\brug\b|carpet|runner/.test(lower), bag = /sleeping bag|bedroll/.test(lower);
      const col = rug ? 0x9f1239 : bag ? 0x1e40af : /blue/.test(lower) ? 0x2563eb : 0x7c3aed;
      const L = rug ? 1.2 : bag ? 0.42 : 0.61, R = rug ? 0.08 : bag ? 0.13 : 0.06;
      const roll = K.cyl(R, R, L, col, 0, R, 0, rug ? { ...IM.cloth, roughness: 1 } : IM.rubber, 24); roll.rotation.z = Math.PI / 2;
      const ends = [-1, 1].map(s => { const e = K.cyl(R * 0.98, R * 0.98, 0.002, rug ? 0xfde68a : 0x312e81, s * L / 2, R, 0); e.rotation.z = Math.PI / 2; return e; });
      const straps = [-0.3, 0.3].map(f => { const t = K.torus(R + 0.003, 0.005, 0x111827, f * L, R, 0, IM.cloth); t.rotation.y = Math.PI / 2; return t; });
      const parts = [roll, ...ends, ...straps];
      if (rug) for (let i = -2; i <= 2; i++) parts.push(K.box(0.003, 0.04, 0.003, 0xfde68a, -L / 2 - 0.02, R + i * 0.03, 0));
      return K.done(...parts);
    }

function imDumbbellModel(lower) {
      const K = imKit();
      if (/kettlebell/.test(lower)) {
        const bell = K.ball(0.1, 0x1f2937, 0, 0.095, 0, IM.iron, 20); bell.scale.y = 0.95;
        const handle = K.torus(0.065, 0.016, 0x1f2937, 0, 0.19, 0, IM.iron, Math.PI);
        const flat = K.cyl(0.07, 0.07, 0.01, 0x1f2937, 0, 0.005, 0, IM.iron);
        return K.done(bell, handle, flat);
      }
      const parts = [], n = /dumbbells|pair|set/.test(lower) ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const z = (i - (n - 1) / 2) * 0.16;
        const bar = K.cyl(0.015, 0.015, 0.3, 0xd1d5db, 0, 0.065, z, IM.chrome); bar.rotation.z = Math.PI / 2;
        parts.push(bar);
        [-1, 1].forEach(s => { const w = K.cyl(0.065, 0.065, 0.06, 0x111827, s * 0.11, 0.065, z, IM.rubber, 6); w.rotation.z = Math.PI / 2; parts.push(w); });
      }
      return K.done(...parts);
    }

function imJumpRopeModel() {
      const K = imKit();
      const handles = [-1, 1].map(s => { const h = K.cyl(0.013, 0.015, 0.14, 0xdc2626, s * 0.1, 0.015, 0.15, IM.plastic); h.rotation.x = Math.PI / 2; return h; });
      const rope = K.tube([[-0.1, 0.01, 0.08], [-0.15, 0.006, -0.05], [-0.05, 0.006, -0.15], [0.08, 0.006, -0.12], [0.15, 0.006, -0.02], [0.1, 0.01, 0.08]], 0.003, 0x111827, IM.rubber);
      return K.done(...handles, rope);
    }

function imFrisbeeModel() {
      const K = imKit();
      return K.done(K.lathe([[0, 0.026], [0.12, 0.022], [0.135, 0.012], [0.133, 0.0], [0.128, 0.0], [0.128, 0.012], [0.118, 0.019], [0, 0.023]], 0xf97316, { ...IM.plastic, side: THREE.DoubleSide }, 40));
    }

function imTentModel(lower) {
      const K = imKit();
      if (/bag|packed|stuff sack/.test(lower)) {
        const b = K.cyl(0.09, 0.09, 0.55, 0x15803d, 0, 0.09, 0, IM.cloth); b.rotation.z = Math.PI / 2;
        return K.done(b, K.torus(0.092, 0.006, 0x111827, -0.25, 0.09, 0, IM.cloth));
      }
      // a two-person dome tent, pitched
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), K.mat(0x15803d, { ...IM.cloth, side: THREE.DoubleSide }));
      dome.scale.set(1.05, 1.05, 0.72); dome.castShadow = true;
      const door = new THREE.Mesh(new THREE.SphereGeometry(1.003, 12, 8, -0.35, 0.7, 0.35, Math.PI / 2 - 0.35), K.mat(0x14532d, IM.cloth));
      door.scale.copy(dome.scale);
      const poles = [0.6, -0.6].map(a => { const p = K.torus(1.06, 0.008, 0x9ca3af, 0, 0, 0, IM.alu, Math.PI); p.rotation.y = a; p.scale.set(1, 1, 0.72); return p; });
      return K.done(dome, door, ...poles);
    }

function imBackpackModel(lower) {
      const K = imKit();
      const col = /red/.test(lower) ? 0xb91c1c : /blue/.test(lower) ? 0x1e40af : /green|hiking/.test(lower) ? 0x3f6212 : 0x334155;
      const big = /hiking|camping|rucksack|expedition/.test(lower);
      const H = big ? 0.68 : 0.45, W = big ? 0.34 : 0.3, D = big ? 0.24 : 0.18;
      const body = K.rr(W, D, H, 0.06, col, 0, 0, 0, IM.cloth);
      const lid = K.rr(W * 0.9, D * 0.95, 0.07, 0.05, col, 0, H - 0.03, -0.0, IM.cloth);
      const pocket = K.rr(W * 0.7, 0.06, H * 0.35, 0.03, 0x111827, 0, 0.06, D / 2 + 0.01, IM.cloth);
      const straps = [-1, 1].map(s => K.tube([[s * 0.07, H - 0.06, -D / 2], [s * 0.09, H * 0.6, -D / 2 - 0.05], [s * 0.1, 0.1, -D / 2 - 0.02]], 0.012, 0x111827, IM.cloth));
      const loop = K.torus(0.03, 0.006, 0x111827, 0, H + 0.04, -D / 2 + 0.02, IM.cloth, Math.PI);
      return K.done(body, lid, pocket, ...straps, loop);
    }

function imLifeJacketModel() {
      const K = imKit(), parts = [];
      [-1, 1].forEach(s => {
        parts.push(K.rr(0.2, 0.07, 0.5, 0.05, 0xf97316, s * 0.12, 0, 0.03, IM.cloth));
        parts.push(K.box(0.18, 0.012, 0.004, 0xd1d5db, s * 0.12, 0.35, 0.068, { roughness: 0.2, metalness: 0.4 }));
      });
      parts.push(K.rr(0.44, 0.07, 0.45, 0.05, 0xea580c, 0, 0, -0.06, IM.cloth));
      [0.12, 0.26, 0.4].forEach(y => parts.push(K.box(0.42, 0.025, 0.004, 0x111827, 0, y, 0.07, IM.cloth)));
      [0.12, 0.26].forEach(y => parts.push(K.box(0.04, 0.035, 0.012, 0x111827, 0, y, 0.072, IM.plastic)));
      return K.done(...parts);
    }

function imHelmetModel(lower) {
      const K = imKit();
      const hard = /hard ?hat|construction|safety helmet/.test(lower);
      const col = hard ? 0xfacc15 : /ski|snowboard/.test(lower) ? 0xf8fafc : /climb/.test(lower) ? 0xf97316 : 0x2563eb;
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), K.mat(col, { roughness: 0.3, side: THREE.DoubleSide }));
      shell.scale.set(0.82, 0.95, 1); shell.castShadow = true;
      const parts = [shell];
      if (hard) {
        const brim = K.cyl(0.15, 0.155, 0.008, col, 0, 0.004, 0.02, { roughness: 0.3 }); brim.scale.set(0.85, 1, 1);
        parts.push(brim, K.box(0.012, 0.03, 0.2, col, 0, 0.115, 0, { roughness: 0.3 }));
      } else {
        for (let i = -2; i <= 2; i++) parts.push(K.box(0.012, 0.02, 0.09, 0x111827, i * 0.03, 0.115 - Math.abs(i) * 0.008, -0.01));
        parts.push(K.tube([[-0.1, 0.01, 0.02], [-0.06, -0.09, 0.04], [0.06, -0.09, 0.04], [0.1, 0.01, 0.02]], 0.004, 0x111827, IM.cloth));
      }
      return K.done(...parts); // standing on its rim
    }

function imSkatesModel(lower) {
      const K = imKit(), parts = [];
      const roller = /roller|inline/.test(lower);
      [-1, 1].forEach(s => {
        const x = s * 0.07;
        parts.push(K.rr(0.09, 0.28, 0.07, 0.04, roller ? 0xf8fafc : 0x111827, x, roller ? 0.05 : 0.06, 0, { roughness: 0.6 }));
        parts.push(K.rr(0.085, 0.13, 0.17, 0.04, roller ? 0xf8fafc : 0x111827, x, roller ? 0.1 : 0.11, -0.07, { roughness: 0.6 }));
        if (roller) [-0.1, -0.03, 0.04, 0.11].forEach(z => { const w = K.cyl(0.03, 0.03, 0.022, 0x7c3aed, x, 0.03, z, IM.rubber); w.rotation.z = Math.PI / 2; parts.push(w); });
        else { parts.push(K.box(0.004, 0.035, 0.3, 0xd1d5db, x, 0.0175, 0.01, IM.chrome), K.box(0.012, 0.025, 0.24, 0x9ca3af, x, 0.045, 0.0, IM.steel)); }
      });
      return K.done(...parts);
    }

function imSledModel(lower) {
      const K = imKit();
      if (/toboggan/.test(lower)) {
        const deck = K.box(1.3, 0.012, 0.42, 0xc8955a, 0, 0.03, 0, IM.wood);
        const curl = K.torus(0.12, 0.006, 0xc8955a, 0.65, 0.15, 0, IM.wood, Math.PI); curl.scale.z = 35; curl.rotation.z = -Math.PI / 2;
        const rails = [-1, 1].map(s => K.rod([-0.62, 0.05, s * 0.2], [0.62, 0.05, s * 0.2], 0.008, 0x7c2d12, IM.cloth));
        return K.done(deck, rails[0], rails[1], K.box(0.03, 0.2, 0.42, 0xc8955a, 0.7, 0.12, 0, IM.wood));
      }
      if (/plastic|saucer/.test(lower)) {
        return K.done(K.lathe([[0, 0], [0.3, 0.01], [0.33, 0.06], [0.32, 0.07], [0.29, 0.02], [0, 0.012]], 0xdc2626, { ...IM.plastic, side: THREE.DoubleSide }, 32));
      }
      // a classic wooden sled with steel runners
      const parts = [];
      for (let i = -2; i <= 2; i++) parts.push(K.box(0.85, 0.016, 0.06, 0xc8955a, 0, 0.17, i * 0.075, IM.wood));
      [-1, 1].forEach(s => {
        parts.push(K.tube([[-0.5, 0.03, s * 0.17], [0.35, 0.01, s * 0.17], [0.52, 0.06, s * 0.17], [0.48, 0.16, s * 0.17]], 0.008, 0xb91c1c, IM.steel));
        [-0.3, 0.0, 0.3].forEach(x => parts.push(K.box(0.03, 0.15, 0.015, 0x7c2d12, x, 0.09, s * 0.17, IM.wood)));
      });
      parts.push(K.box(0.04, 0.02, 0.38, 0x7c2d12, 0.38, 0.19, 0, IM.wood));
      return K.done(...parts);
    }

function imUmbrellaModel() {
      const K = imKit();
      // closed, lying down: a furled canopy round the shaft and a crook handle
      const canopy = K.lathe([[0.0, 0], [0.035, 0.12], [0.03, 0.55], [0.01, 0.68], [0, 0.7]], 0x1e3a8a, IM.cloth, 12);
      const tip = K.cyl(0.004, 0.002, 0.05, 0xd1d5db, 0, 0.72, 0, IM.chrome);
      const shaft = K.cyl(0.005, 0.005, 0.18, 0x111827, 0, -0.09, 0, IM.steel);
      const crook = K.torus(0.04, 0.012, 0x3f2a1d, 0.04, -0.18, 0, IM.wood, Math.PI); crook.rotation.z = Math.PI;
      const strap = K.torus(0.037, 0.005, 0x1e3a8a, 0, 0.35, 0, IM.cloth); strap.rotation.x = Math.PI / 2;
      const g = group(canopy, tip, shaft, crook, strap);
      g.rotation.z = Math.PI / 2;
      g.position.set(-0.27, 0.045, 0);
      return K.done(g);
    }

// --- Building materials and supplies -----------------------------------------------------------
// A filled bag lying flat: cement, concrete mix, mortar, sand, soil, flour, birdseed...
function imSackModel(lower) {
      const K = imKit();
      const paper = /cement|concrete|mortar|grout|plaster|lime|flour|sugar|thinset|stucco/.test(lower);
      const big = /cement|concrete|mortar|sand|gravel|soil|grout|stucco|thinset|30 kg|40 kg|25 kg|50 lb/.test(lower);
      const [L, W, T] = big ? [0.68, 0.42, 0.12] : /flour|sugar|rice|seed|feed/.test(lower) ? [0.32, 0.2, 0.09] : [0.45, 0.3, 0.1];
      const col = paper ? (/flour|sugar/.test(lower) ? 0xf5f5f4 : 0xd6c7a1) : /soil|potting|compost/.test(lower) ? 0x14532d : /sand/.test(lower) ? 0xf5f5f4 : /seed|feed/.test(lower) ? 0x92400e : 0xe7e5e4;
      const band = /cement|portland/.test(lower) ? 0x1d4ed8 : /concrete/.test(lower) ? 0xdc2626 : /mortar|grout/.test(lower) ? 0x15803d : /soil|potting/.test(lower) ? 0xf59e0b : /sand/.test(lower) ? 0xeab308 : 0x7c2d12;
      const body = K.ball(0.5, col, 0, T / 2, 0, paper ? IM.paper : { roughness: 0.55 }, 20);
      body.scale.set(L, T, W);
      const flat = K.box(L * 0.86, T * 0.8, W * 0.9, col, 0, T * 0.42, 0, paper ? IM.paper : { roughness: 0.55 });
      const label = K.box(L * 0.4, 0.002, W * 0.7, band, 0, T * 0.82 + 0.001, 0, IM.paper);
      return K.done(body, flat, label);
    }

// A small retail box: screws, nails, bolts, staples, a board game, a deck of cards...
function imCartonModel(w, h, d, col, labelCol, extra = []) {
      const K = imKit();
      const box = K.box(w, h, d, col, 0, h / 2, 0, IM.paper);
      const label = K.box(w * 0.8, h * 0.45, 0.001, labelCol, 0, h * 0.55, d / 2 + 0.0006, IM.paper);
      return K.done(box, label, ...extra.map(f => f(K)));
    }

function imFastenerBoxModel(lower) {
      const nails = /nails?|brads/.test(lower) && !/screw/.test(lower);
      const col = /galvan|zinc/.test(lower) ? 0x94a3b8 : /drywall|black/.test(lower) ? 0x1f2937 : /brass/.test(lower) ? 0xc9a227 : 0xb0b6be;
      const [w, h, d] = /bucket|tub|5 lb|kg/.test(lower) ? [0.16, 0.18, 0.16] : [0.12, 0.07, 0.085];
      return imCartonModel(w, h, d, nails ? 0xd97706 : 0x1d4ed8, 0xf8fafc, [
        K => {
          // a handful lying in front of the box
          const spots = [];
          for (let i = 0; i < 6; i++) spots.push([-0.04 + i * 0.016, 0.004, d / 2 + 0.03 + (i % 2) * 0.012]);
          const geo = nails ? new THREE.CylinderGeometry(0.0015, 0.0015, 0.05, 6) : new THREE.CylinderGeometry(0.0022, 0.0018, 0.04, 6);
          geo.rotateX(Math.PI / 2);
          return K.many(geo, col, spots, IM.steel);
        }
      ]);
    }

function imSheetGoodsModel(lower) {
      const K = imKit(), parts = [];
      const mat = /drywall|gypsum|sheetrock/.test(lower) ? [0xf1f5f9, IM.paper, 0.0127] : /osb/.test(lower) ? [0xc49a5a, IM.wood, 0.011]
        : /mdf/.test(lower) ? [0xa87442, IM.wood, 0.018] : /acrylic|plexi|polycarbonate|perspex/.test(lower) ? [0xdbeafe, IM.glass, 0.006]
        : /sheet metal|steel sheet|aluminium sheet|aluminum sheet|galvani[sz]ed sheet|metal sheet/.test(lower) ? [0xb6bcc4, IM.alu, 0.0016]
        : /cement board|backer board/.test(lower) ? [0x9ca3af, IM.matte, 0.0127] : /glass pane|window glass|sheet glass|pane/.test(lower) ? [0xcfe8f5, IM.glass, 0.004] : [0xd8b07a, IM.wood, 0.012];
      const n = /sheets|stack|panels|boards/.test(lower) ? 4 : 2;
      for (let i = 0; i < n; i++) parts.push(K.box(1.22, mat[2], 0.61, mat[0], i * 0.004, mat[2] / 2 + i * (mat[2] + 0.0005), i * 0.003, mat[1]));
      return K.done(...parts);
    }

function imLumberModel(lower) {
      const K = imKit(), parts = [];
      const big = /4x4|post|beam|6x6/.test(lower);
      const [w, t] = /2x6/.test(lower) ? [0.14, 0.038] : /2x8/.test(lower) ? [0.184, 0.038] : /1x/.test(lower) ? [0.089, 0.019] : big ? [0.089, 0.089] : /plank|board/.test(lower) ? [0.14, 0.019] : [0.089, 0.038];
      const L = 2.44, col = /cedar/.test(lower) ? 0xb4653a : /oak|walnut|maple/.test(lower) ? 0xb88a52 : /treated/.test(lower) ? 0xa7a06a : 0xe2c08d;
      const n = big ? 2 : 4;
      for (let i = 0; i < n; i++) parts.push(K.box(L, t, w, col, 0, t / 2 + Math.floor(i / 2) * t, (i % 2 - 0.5) * (w + 0.003), IM.wood));
      return K.done(...parts);
    }

function imPaintCanModel(lower) {
      const K = imKit();
      const col = /yellow/.test(lower) ? 0xfacc15 : /white|primer/.test(lower) ? 0xf8fafc : /red/.test(lower) ? 0xdc2626 : /blue/.test(lower) ? 0x2563eb : /green/.test(lower) ? 0x16a34a : /black/.test(lower) ? 0x111827 : /stain|varnish/.test(lower) ? 0x92400e : 0x0ea5e9;
      if (/5.?gal|pail|bucket/.test(lower)) {
        const pail = K.lathe([[0, 0], [0.14, 0], [0.15, 0.37], [0.155, 0.38], [0, 0.38]], 0xf8fafc, IM.plastic, 28);
        const band = K.cyl(0.149, 0.145, 0.12, col, 0, 0.2, 0, IM.plastic);
        const bail = K.torus(0.15, 0.003, 0x9ca3af, 0, 0.36, 0, IM.steel, Math.PI);
        return K.done(pail, band, bail);
      }
      const quart = /quart|small|tin|sample/.test(lower);
      const r = quart ? 0.054 : 0.083, h = quart ? 0.12 : 0.19;
      const can = K.cyl(r, r, h, 0xd1d5db, 0, h / 2, 0, IM.steel, 28);
      const label = K.cyl(r + 0.0008, r + 0.0008, h * 0.7, col, 0, h * 0.48, 0, IM.paper, 28);
      const lid = K.cyl(r * 0.93, r * 0.93, 0.004, 0xa1a1aa, 0, h + 0.002, 0, IM.steel);
      const drip = K.cyl(r * 0.6, r * 0.6, 0.0015, col, 0.0, h + 0.0045, 0, { roughness: 0.2 });
      const bail = K.torus(r, 0.0025, 0x9ca3af, 0, h, 0, IM.steel, Math.PI);
      return K.done(can, label, lid, drip, bail);
    }

function imTapeRollModel(lower) {
      const K = imKit();
      const col = /duct/.test(lower) ? 0xa1a1aa : /masking/.test(lower) ? 0xfef3c7 : /painter/.test(lower) ? 0x60a5fa : /electrical/.test(lower) ? 0x111827 : /packing/.test(lower) ? 0xd6b38a : 0xa1a1aa;
      const R = /electrical/.test(lower) ? 0.03 : 0.055, W = /electrical/.test(lower) ? 0.019 : 0.048;
      const roll = K.lathe([[0.038 * R / 0.055, 0], [R, 0], [R, W], [0.038 * R / 0.055, W]], col, /duct/.test(lower) ? { roughness: 0.4, metalness: 0.3 } : { roughness: 0.5 }, 32);
      const core = K.lathe([[0.034 * R / 0.055, 0], [0.038 * R / 0.055, 0], [0.038 * R / 0.055, W], [0.034 * R / 0.055, W]], 0xc8a46a, IM.paper, 24);
      return K.done(roll, core);
    }

function imBricksModel(lower) {
      const K = imKit(), spots = [];
      const block = /cinder|concrete block|cmu/.test(lower);
      const [L, H, D] = block ? [0.39, 0.19, 0.19] : /paver/.test(lower) ? [0.2, 0.06, 0.1] : [0.19, 0.057, 0.09];
      const rows = block ? 2 : 3, per = block ? 2 : 3;
      for (let r = 0; r < rows; r++) for (let i = 0; i < per; i++) spots.push([(i - (per - 1) / 2) * (L + 0.008) + (r % 2) * L * 0.25, H / 2 + r * (H + 0.004), 0]);
      return K.done(K.many(new THREE.BoxGeometry(L, H, D), block ? 0x9ca3af : /paver/.test(lower) ? 0x78716c : 0xa0442a, spots, { roughness: 0.95 }));
    }

function imShinglesModel() {
      const K = imKit(), parts = [];
      for (let i = 0; i < 6; i++) parts.push(K.box(0.92, 0.012, 0.31, i % 2 ? 0x3f3f46 : 0x52525b, (i % 2) * 0.01, 0.006 + i * 0.012, 0, { roughness: 1 }));
      parts.push(K.box(0.6, 0.0721, 0.32, 0xf1f5f9, 0, 0.036, 0, IM.paper));
      return K.done(...parts);
    }

function imPipesModel(lower) {
      const K = imKit(), spots = [];
      if (/culvert/.test(lower)) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.6, 28, 1, true), K.mat(0x1f2937, { roughness: 0.6, side: THREE.DoubleSide })); pipe.position.y = 0.24; pipe.rotation.z = Math.PI / 2; pipe.castShadow = true;
        const ribs = K.many(new THREE.TorusGeometry(0.245, 0.012, 6, 28).rotateY(Math.PI / 2), 0x111827, Array.from({ length: 16 }, (_, i) => [-0.75 + i * 0.1, 0.24, 0]), { roughness: 0.6 });
        return K.done(pipe, ribs);
      }
      const col = /copper/.test(lower) ? 0xb87333 : /pvc|abs|plastic|white/.test(lower) ? (/abs|black/.test(lower) ? 0x1f2937 : 0xf1f5f9) : /galvan/.test(lower) ? 0xa8b0b8 : /black iron|black pipe/.test(lower) ? 0x27272a : 0x8f98a3;
      const metal = !/pvc|abs|plastic/.test(lower);
      const r = /copper/.test(lower) ? 0.011 : /pvc|abs/.test(lower) ? 0.024 : 0.017;
      const L = /copper/.test(lower) ? 1.2 : 1.5;
      const geo = new THREE.CylinderGeometry(r, r, L, 16, 1, true); geo.rotateZ(Math.PI / 2);
      [[0, 0], [1, 0], [2, 0], [0.5, 1], [1.5, 1]].forEach(([i, row]) => spots.push([0, r + row * r * 1.73, (i - 1) * r * 2.02]));
      const pipes = K.many(geo, col, spots, metal ? { metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide } : { roughness: 0.4, side: THREE.DoubleSide });
      return K.done(pipes);
    }

function imSpoolModel(lower) {
      const K = imKit();
      if (/smd|component reel/.test(lower)) return K.done(...[0, 1, 2].map(i => { const r = K.cyl(0.09, 0.09, 0.012, [0x111827, 0x1d4ed8, 0x111827][i], i * 0.012, 0.006 + i * 0.013, 0, IM.plastic, 28); return r; }), K.box(0.06, 0.001, 0.04, 0xf8fafc, 0.024, 0.039, 0.03, IM.paper));
      const col = /copper|magnet|enamel/.test(lower) ? 0xc2702e : /solder/.test(lower) ? 0xc0c4c8 : /steel|galvan|tie wire|baling/.test(lower) ? 0x9aa3ad : /red/.test(lower) ? 0xdc2626 : /black/.test(lower) ? 0x1f2937 : 0xc2702e;
      const R = /solder/.test(lower) ? 0.04 : 0.075, W = /solder/.test(lower) ? 0.04 : 0.07;
      const flanges = [-1, 1].map(s => { const f = K.cyl(R, R, 0.006, 0x111827, s * W / 2, 0, 0, IM.plastic, 28); f.rotation.z = Math.PI / 2; return f; });
      const wound = K.cyl(R * 0.85, R * 0.85, W - 0.006, col, 0, 0, 0, /copper|steel|solder|galvan/.test(lower) ? { metalness: 0.85, roughness: 0.35 } : IM.rubber, 28); wound.rotation.z = Math.PI / 2;
      const hub = K.cyl(R * 0.25, R * 0.25, W + 0.002, 0x0b0b0b, 0, 0, 0); hub.rotation.z = Math.PI / 2;
      const g = group(...flanges, wound, hub); g.position.y = R;
      return K.done(g);
    }

function imSandpaperModel() {
      const K = imKit(), parts = [];
      for (let i = 0; i < 4; i++) { const p = K.box(0.23, 0.0008, 0.28, i % 2 ? 0x9a3412 : 0xb45309, i * 0.006, 0.0006 + i * 0.001, i * 0.004, { roughness: 1 }); p.rotation.y = i * 0.04; parts.push(p); }
      parts.push(K.box(0.115, 0.025, 0.065, 0x111827, 0.05, 0.016, 0.05, IM.rubber));
      return K.done(...parts);
    }

// Glue, caulk, silicone, sealant, epoxy, oil and resin come in squeeze bottles, tubes and jugs
function imBottleModel(lower) {
      const K = imKit();
      if (/caulk|silicone|sealant|construction adhesive|liquid nails/.test(lower)) {
        const tube = K.cyl(0.024, 0.024, 0.21, /silicone|clear/.test(lower) ? 0xf8fafc : 0xf8fafc, 0, 0.024, 0, IM.plastic); tube.rotation.z = Math.PI / 2;
        const nozzle = K.cyl(0.003, 0.009, 0.08, 0xf8fafc, 0.145, 0.024, 0, IM.plastic); nozzle.rotation.z = -Math.PI / 2;
        const label = K.cyl(0.0245, 0.0245, 0.12, /silicone/.test(lower) ? 0x1d4ed8 : 0x16a34a, -0.01, 0.024, 0, IM.paper); label.rotation.z = Math.PI / 2;
        return K.done(tube, nozzle, label);
      }
      if (/epoxy|super ?glue|syringe/.test(lower)) {
        const tube = K.rr(0.04, 0.012, 0.14, 0.005, 0xf8fafc, 0, 0, 0, IM.plastic); tube.rotation.x = Math.PI / 2; tube.position.set(0, 0.006, 0.07);
        const card = K.box(0.08, 0.002, 0.18, 0x1d4ed8, 0, 0.001, 0, IM.paper);
        return K.done(card, tube);
      }
      if (/grease/.test(lower)) return K.done(K.cyl(0.06, 0.06, 0.08, 0x1d4ed8, 0, 0.04, 0, IM.plastic), K.cyl(0.062, 0.062, 0.015, 0xdc2626, 0, 0.087, 0, IM.plastic));
      const jug = /jug|gallon|4 l|litres? of|coolant|antifreeze|oil|resin|alcohol|solvent|thinner|cutting fluid|bleach|vinegar/.test(lower);
      if (jug) {
        const col = /coolant|antifreeze/.test(lower) ? 0x22c55e : /resin/.test(lower) ? 0x111827 : /oil/.test(lower) ? 0x1f2937 : /alcohol|ipa/.test(lower) ? 0xf8fafc : 0xf5f5f4;
        const body = K.rr(0.16, 0.11, 0.24, 0.025, col, 0, 0, 0, IM.plastic);
        const shoulder = K.cyl(0.03, 0.055, 0.04, col, -0.02, 0.26, 0, IM.plastic);
        const cap = K.cyl(0.022, 0.022, 0.024, /resin/.test(lower) ? 0xf97316 : 0xdc2626, -0.02, 0.29, 0, IM.plastic);
        const handle = K.box(0.03, 0.12, 0.03, col, 0.07, 0.2, 0, IM.plastic);
        const label = K.box(0.12, 0.1, 0.001, /resin/.test(lower) ? 0xf97316 : 0xf8fafc, -0.0, 0.11, 0.0556, IM.paper);
        return K.done(body, shoulder, cap, handle, label);
      }
      // a squeeze bottle of glue
      const col = /wood glue|yellow/.test(lower) ? 0xfacc15 : 0xf8fafc;
      const body = K.lathe([[0, 0], [0.032, 0], [0.034, 0.12], [0.02, 0.15], [0, 0.15]], 0xf8fafc, IM.plastic, 20);
      const label = K.cyl(0.0335, 0.0335, 0.08, col === 0xf8fafc ? 0xdc2626 : col, 0, 0.06, 0, IM.paper);
      const cap = K.cyl(0.005, 0.012, 0.04, 0xea580c, 0, 0.17, 0, IM.plastic);
      return K.done(body, label, cap);
    }

function imCaulkGunModel() {
      const K = imKit();
      const frame = K.box(0.3, 0.006, 0.05, 0x9ca3af, 0.05, 0.12, 0, IM.steel);
      const barrel = K.cyl(0.026, 0.026, 0.22, 0xdc2626, 0.07, 0.15, 0, { ...IM.steel, side: THREE.DoubleSide }); barrel.rotation.z = Math.PI / 2;
      const handle = K.box(0.035, 0.13, 0.03, 0xdc2626, -0.09, 0.065, 0, IM.plastic);
      const trigger = K.box(0.025, 0.12, 0.02, 0x9ca3af, -0.05, 0.07, 0, IM.steel); trigger.rotation.z = 0.2;
      const rodp = K.rod([-0.18, 0.15, 0], [-0.05, 0.15, 0], 0.003, 0xd1d5db, IM.steel);
      return K.done(frame, barrel, handle, trigger, rodp);
    }

function imTapeMeasureModel() {
      const K = imKit();
      const caseBox = K.rr(0.075, 0.07, 0.04, 0.02, 0xfacc15, 0, 0, 0, IM.rubber);
      const blade = K.box(0.06, 0.001, 0.025, 0xfde047, 0.06, 0.004, 0.0, IM.paper);
      const hook = K.box(0.002, 0.01, 0.025, 0xd1d5db, 0.09, 0.006, 0.0, IM.steel);
      const clip = K.box(0.04, 0.003, 0.03, 0xd1d5db, -0.02, 0.041, 0.0, IM.steel);
      return K.done(caseBox, blade, hook, clip);
    }

function imLevelModel(lower) {
      const K = imKit();
      const L = /torpedo/.test(lower) ? 0.23 : /4 ?ft|1\.2 ?m|long/.test(lower) ? 1.2 : 0.6;
      const bar = K.box(L, 0.055, 0.025, /yellow/.test(lower) ? 0xfacc15 : 0xd4d4d8, 0, 0.0275, 0, IM.alu);
      const vials = [-0.35, 0, 0.35].map(f => K.box(0.04, 0.014, 0.027, 0x86efac, f * L, 0.03, 0, { transparent: true, opacity: 0.8, roughness: 0.1 }));
      const ends = [-1, 1].map(s => K.box(0.02, 0.057, 0.027, 0x111827, s * (L / 2 - 0.01), 0.0285, 0, IM.rubber));
      return K.done(bar, ...vials, ...ends);
    }

function imUtilityKnifeModel() {
      const K = imKit();
      const body = K.slab([[-0.08, 0], [0.06, 0.002], [0.07, 0.02], [-0.07, 0.024], [-0.085, 0.012]], 0.018, 0xfacc15, IM.plastic);
      const blade = K.slab([[0.06, 0.006], [0.095, 0.006], [0.085, 0.02], [0.06, 0.02]], 0.001, 0xe5e7eb, IM.chrome);
      const g = group(body, blade); g.rotation.x = -Math.PI / 2; g.position.y = 0.009;
      return K.done(g);
    }

function imLadderModel(lower) {
      const K = imKit(), parts = [];
      const H = /step stool|2.?step/.test(lower) ? 0.6 : /extension/.test(lower) ? 3.0 : 1.8;
      const col = /wood/.test(lower) ? 0xc8955a : /fibreglass|fiberglass/.test(lower) ? 0xf59e0b : 0xc0c6cc;
      const fin = /wood/.test(lower) ? IM.wood : IM.alu;
      if (/extension|straight/.test(lower)) {
        [-1, 1].forEach(s => parts.push(K.box(H, 0.07, 0.025, col, 0, 0.035, s * 0.2, fin)));
        for (let x = -H / 2 + 0.15; x < H / 2; x += 0.3) parts.push(K.rod([x, 0.035, -0.2], [x, 0.035, 0.2], 0.015, col, fin));
        return K.done(...parts);
      }
      // a folding step ladder, standing open
      const spread = H * 0.32, w = 0.24;
      [-1, 1].forEach(s => {
        parts.push(K.rod([s * w, 0, spread / 2], [s * w * 0.85, H, 0], 0.02, col, fin));
        parts.push(K.rod([s * w, 0, -spread / 2], [s * w * 0.85, H, 0], 0.016, col, fin));
      });
      for (let i = 1; i < 6; i++) { const f = i / 6; parts.push(K.box(w * 2 * (1 - f * 0.15), 0.025, 0.08, col, 0, H * f, spread / 2 * (1 - f), fin)); }
      parts.push(K.box(w * 1.9, 0.04, 0.22, 0xf97316, 0, H + 0.02, 0, IM.plastic));
      return K.done(...parts);
    }

function imHoseModel(lower = '') {
      const K = imKit(), parts = [];
      const dust = /dust|vacuum|duct/.test(lower), thin = /coolant|fuel|brake|line|air/.test(lower);
      const col = dust ? 0xcbd5e1 : thin ? 0x111827 : 0x16a34a, t = dust ? 0.05 : thin ? 0.008 : 0.009, R = dust ? 0.3 : thin ? 0.12 : 0.2;
      for (let i = 0; i < (dust ? 3 : 5); i++) { const l = K.torus(R - i * t * 1.3, t, col, 0, t + i * t * 1.8, 0, dust ? { transparent: true, opacity: 0.85, roughness: 0.4 } : IM.rubber); l.rotation.x = Math.PI / 2; parts.push(l); }
      if (dust || thin) return K.done(...parts);
      const nozzle = K.box(0.12, 0.04, 0.03, 0xf97316, 0.06, 0.05, 0.2, IM.plastic);
      const fitting = K.cyl(0.014, 0.014, 0.025, 0xc9a227, 0.21, 0.02, 0.0, { metalness: 0.9, roughness: 0.3 }); fitting.rotation.x = Math.PI / 2;
      return K.done(...parts, nozzle, fitting);
    }

function imShearsModel(lower) {
      const K = imKit();
      const hedge = /hedge|loppers/.test(lower);
      const L = hedge ? 0.3 : 0.11, H = hedge ? 0.35 : 0.1;
      const col = /scissors/.test(lower) ? 0x2563eb : 0xdc2626;
      const parts = [];
      [-1, 1].forEach(s => {
        const blade = K.slab([[0, -0.006], [L, -0.002], [L * 1.02, 0.004], [0, 0.008]], 0.003, 0xd1d5db, IM.chrome); blade.rotation.set(-Math.PI / 2, 0, s * 0.12); blade.position.set(0, 0.008 + s * 0.002, 0);
        const handle = K.slab([[0, -0.009], [-H, -0.012 * (hedge ? 1 : 1.4)], [-H, 0.012], [0, 0.009]], 0.012, col, IM.rubber); handle.rotation.set(-Math.PI / 2, 0, -s * 0.18); handle.position.set(0, 0.008 + s * 0.002, 0);
        parts.push(blade, handle);
      });
      parts.push(K.cyl(0.006, 0.006, 0.02, 0x9ca3af, 0, 0.01, 0, IM.steel));
      return K.done(...parts);
    }

function imPowerYardToolModel(lower) {
      const K = imKit();
      if (/chainsaw/.test(lower)) {
        const body = K.rr(0.3, 0.13, 0.2, 0.03, 0xf97316, -0.08, 0, 0, IM.plastic);
        const bar = K.rr(0.42, 0.006, 0.07, 0.03, 0xd1d5db, 0.27, 0.08, 0, IM.steel); bar.rotation.x = Math.PI / 2;
          const handle = K.torus(0.08, 0.012, 0x111827, -0.02, 0.2, 0, IM.rubber, Math.PI); handle.rotation.y = Math.PI / 2;
        const rear = K.box(0.12, 0.03, 0.04, 0x111827, -0.26, 0.12, 0, IM.rubber);
        return K.done(body, bar, handle, rear);
      }
      if (/leaf blower/.test(lower)) {
        const body = K.rr(0.25, 0.14, 0.2, 0.05, 0x16a34a, 0, 0, 0, IM.plastic);
        const tube = K.cyl(0.035, 0.045, 0.6, 0x111827, 0.4, 0.09, 0, IM.plastic); tube.rotation.z = Math.PI / 2 + 0.12;
        const handle = K.torus(0.06, 0.012, 0x111827, -0.02, 0.22, 0, IM.rubber, Math.PI); handle.rotation.y = Math.PI / 2;
        return K.done(body, tube, handle);
      }
      if (/string trimmer|weed ?(eater|whacker)|whipper/.test(lower)) {
        const shaft = K.rod([-0.7, 0.3, 0], [0.6, 0.06, 0], 0.014, 0x111827, IM.alu);
        const motor = K.rr(0.18, 0.13, 0.15, 0.04, 0x16a34a, -0.75, 0.24, 0, IM.plastic);
        const head = K.cyl(0.06, 0.06, 0.05, 0xf97316, 0.62, 0.03, 0, IM.plastic);
        const guard = K.cyl(0.13, 0.13, 0.008, 0x111827, 0.58, 0.07, 0, IM.plastic, 20);
        return K.done(shaft, motor, head, guard);
      }
      // a push lawn mower
      const deck = K.lathe([[0, 0.2], [0.24, 0.2], [0.26, 0.12], [0.26, 0.07], [0, 0.07]], 0xdc2626, IM.plastic, 28);
      const engine = K.cyl(0.11, 0.12, 0.16, 0x27272a, 0, 0.28, -0.02, IM.plastic);
      const parts = [deck, engine];
      [[-0.22, 0.2], [0.22, 0.2], [-0.22, -0.2], [0.22, -0.2]].forEach(([x, z]) => { const w = K.cyl(0.09, 0.09, 0.05, 0x111827, x * 1.15, 0.09, z, IM.rubber); w.rotation.z = Math.PI / 2; parts.push(w); });
      [-1, 1].forEach(s => parts.push(K.rod([s * 0.22, 0.2, -0.25], [s * 0.22, 0.95, -0.75], 0.012, 0x111827, IM.steel)));
      parts.push(K.rod([-0.22, 0.95, -0.75], [0.22, 0.95, -0.75], 0.014, 0x111827, IM.rubber));
      parts.push(K.box(0.4, 0.25, 0.3, 0x111827, 0, 0.32, -0.42, IM.cloth));
      return K.done(...parts);
    }

// --- Toys --------------------------------------------------------------------------------------
function imPlushModel(lower) {
      const K = imKit();
      if (/dino|dragon/.test(lower)) {
        const col = 0x4ade80, f = IM.cloth;
        const body = K.ball(0.09, col, 0, 0.09, 0, f); body.scale.set(1.4, 1, 1);
        const neck = K.rod([0.09, 0.12, 0], [0.15, 0.2, 0], 0.035, col, f);
        const head = K.ball(0.045, col, 0.17, 0.22, 0, f); head.scale.set(1.4, 1, 1);
        const tail = K.cyl(0.0, 0.05, 0.18, col, -0.19, 0.07, 0, f); tail.rotation.z = Math.PI / 2 + 0.3;
        const legs = [[-0.05, -0.05], [-0.05, 0.05], [0.05, -0.05], [0.05, 0.05]].map(([x, z]) => K.cyl(0.025, 0.028, 0.06, col, x, 0.03, z, f));
        const spikes = [-0.08, -0.03, 0.02, 0.07].map(x => { const s = K.cyl(0, 0.018, 0.035, 0xf97316, x, 0.185 - Math.abs(x) * 0.3, 0, f, 4); return s; });
        const eyes = [-1, 1].map(s => K.ball(0.007, 0x111827, 0.2, 0.235, s * 0.025));
        return K.done(body, neck, head, tail, ...legs, ...spikes, ...eyes);
      }
      // a teddy bear sitting up
      const col = /white|polar/.test(lower) ? 0xf5f5f4 : /pink/.test(lower) ? 0xf9a8d4 : 0xa0662f, f = { roughness: 1 };
      const body = K.ball(0.085, col, 0, 0.09, 0, f); body.scale.set(1, 1.15, 0.9);
      const belly = K.ball(0.055, 0xe7c9a0, 0, 0.09, 0.04, f); belly.scale.set(1, 1.2, 0.6);
      const head = K.ball(0.07, col, 0, 0.24, 0.0, f);
      const snout = K.ball(0.03, 0xe7c9a0, 0, 0.225, 0.06, f); snout.scale.z = 0.8;
      const nose = K.ball(0.01, 0x1c1917, 0, 0.235, 0.085);
      const ears = [-1, 1].map(s => K.ball(0.025, col, s * 0.055, 0.3, -0.005, f));
      const eyes = [-1, 1].map(s => K.ball(0.008, 0x1c1917, s * 0.025, 0.26, 0.06));
      const arms = [-1, 1].map(s => { const a = K.ball(0.03, col, s * 0.085, 0.12, 0.03, f); a.scale.set(1, 1.7, 1); a.rotation.z = s * 0.5; return a; });
      const legs = [-1, 1].map(s => { const l = K.ball(0.035, col, s * 0.05, 0.03, 0.06, f); l.scale.set(1, 0.9, 1.5); return l; });
      const ribbon = K.torus(0.045, 0.008, 0xdc2626, 0, 0.18, 0, IM.cloth); ribbon.rotation.x = Math.PI / 2;
      return K.done(body, belly, head, snout, nose, ...ears, ...eyes, ...arms, ...legs, ribbon);
    }

function imDollModel() {
      const K = imKit();
      const dress = K.cyl(0.035, 0.07, 0.13, 0xdb2777, 0, 0.095, 0, IM.cloth);
      const torso = K.cyl(0.025, 0.033, 0.07, 0xdb2777, 0, 0.19, 0, IM.cloth);
      const head = K.ball(0.04, 0xf3d2b3, 0, 0.26, 0, { roughness: 0.6 });
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.043, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), K.mat(0x92400e, IM.cloth)); hair.position.set(0, 0.265, -0.004); hair.castShadow = true;
      const arms = [-1, 1].map(s => K.rod([s * 0.03, 0.215, 0], [s * 0.06, 0.15, 0.01], 0.01, 0xf3d2b3));
      const legs = [-1, 1].map(s => K.cyl(0.011, 0.011, 0.04, 0xf3d2b3, s * 0.02, 0.02, 0));
      const eyes = [-1, 1].map(s => K.ball(0.005, 0x1e3a8a, s * 0.014, 0.265, 0.037));
      return K.done(dress, torso, head, hair, ...arms, ...legs, ...eyes);
    }

function imToyTrainModel() {
      const K = imKit(), parts = [];
      parts.push(K.box(0.5, 0.008, 0.06, 0xa16207, 0, 0.004, 0, IM.wood));
      // the engine
      parts.push(K.box(0.1, 0.03, 0.05, 0xdc2626, 0.12, 0.035, 0, IM.wood));
      const boiler = K.cyl(0.022, 0.022, 0.07, 0x1d4ed8, 0.15, 0.065, 0, IM.wood); boiler.rotation.z = Math.PI / 2; parts.push(boiler);
      parts.push(K.box(0.04, 0.05, 0.05, 0x1d4ed8, 0.09, 0.075, 0, IM.wood), K.cyl(0.01, 0.012, 0.03, 0x111827, 0.17, 0.1, 0, IM.wood));
      // two cars
      [[-0.01, 0xfacc15], [-0.13, 0x16a34a]].forEach(([x, c]) => parts.push(K.box(0.1, 0.04, 0.05, c, x, 0.04, 0, IM.wood)));
      [0.15, 0.09, 0.02, -0.04, -0.1, -0.16].forEach(x => [-1, 1].forEach(s => { const w = K.cyl(0.012, 0.012, 0.008, 0x111827, x, 0.02, s * 0.029); w.rotation.x = Math.PI / 2; parts.push(w); }));
      return K.done(...parts);
    }

function imCardsModel() {
      const K = imKit();
      const box = K.box(0.065, 0.02, 0.09, 0xb91c1c, 0, 0.01, 0, IM.paper);
      const cards = K.box(0.063, 0.012, 0.088, 0xf8fafc, 0.06, 0.006, 0.01, IM.paper);
      const ace = K.box(0.02, 0.001, 0.02, 0x111827, 0.06, 0.0125, 0.01);
      return K.done(box, cards, ace);
    }

function imBoardGameModel(lower) {
      const jigsaw = /jigsaw/.test(lower);
      return imCartonModel(jigsaw ? 0.33 : 0.4, 0.07, jigsaw ? 0.23 : 0.27, jigsaw ? 0x0369a1 : 0x15803d, 0xfacc15, [
        K => K.box(jigsaw ? 0.31 : 0.36, 0.001, jigsaw ? 0.21 : 0.23, jigsaw ? 0x38bdf8 : 0xfde68a, 0, 0.0705, 0, IM.paper)
      ]);
    }

function imCubePuzzleModel() {
      const K = imKit(), parts = [K.box(0.057, 0.057, 0.057, 0x111111, 0, 0.0285, 0, IM.plastic)];
      const faces = [[0, 1, 0, 0xf8fafc], [0, 0, 1, 0xdc2626], [1, 0, 0, 0x16a34a], [-1, 0, 0, 0x2563eb], [0, 0, -1, 0xf97316]];
      faces.forEach(([nx, ny, nz, col]) => {
        const spots = [];
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
          const p = [0, 0.0285, 0];
          if (ny) { p[0] = a * 0.019; p[2] = b * 0.019; p[1] += 0.0286; } else if (nz) { p[0] = a * 0.019; p[1] += b * 0.019; p[2] = nz * 0.0286; } else { p[2] = a * 0.019; p[1] += b * 0.019; p[0] = nx * 0.0286; }
          spots.push(p);
        }
        const geo = new THREE.BoxGeometry(ny ? 0.016 : nx ? 0.001 : 0.016, ny ? 0.001 : 0.016, nz ? 0.001 : 0.016);
        parts.push(K.many(geo, col, spots, IM.plastic));
      });
      return K.done(...parts);
    }

function imToyRobotModel() {
      const K = imKit(), col = 0x9ca3af, f = { metalness: 0.6, roughness: 0.4 };
      const body = K.box(0.09, 0.1, 0.06, col, 0, 0.12, 0, f);
      const panel = K.box(0.05, 0.04, 0.002, 0x1e3a8a, 0, 0.12, 0.031, IM.screen);
      const head = K.box(0.07, 0.055, 0.055, col, 0, 0.2, 0, f);
      const eyes = [-1, 1].map(s => K.cyl(0.009, 0.009, 0.004, 0xfacc15, s * 0.018, 0.205, 0.028, { emissive: 0xfacc15, emissiveIntensity: 0.6 }));
      eyes.forEach(e => (e.rotation.x = Math.PI / 2));
      const antenna = K.rod([0, 0.227, 0], [0, 0.26, 0], 0.002, 0x111827);
      const tip = K.ball(0.006, 0xdc2626, 0, 0.262, 0);
      const arms = [-1, 1].map(s => K.box(0.02, 0.08, 0.025, 0xdc2626, s * 0.058, 0.12, 0, IM.plastic));
      const legs = [-1, 1].map(s => K.box(0.03, 0.07, 0.035, 0x475569, s * 0.022, 0.035, 0, f));
      return K.done(body, panel, head, ...eyes, antenna, tip, ...arms, ...legs);
    }

// --- Musical instruments -----------------------------------------------------------------------
function imBrassModel(lower) {
      const K = imKit(), brass = { metalness: 0.95, roughness: 0.25 }, gold = 0xd4a520;
      if (/sax/.test(lower)) {
        const body = K.tube([[0, 0.62, 0], [0.02, 0.4, 0], [0.03, 0.15, 0], [0.08, 0.04, 0], [0.14, 0.1, 0], [0.15, 0.24, 0]], 0.03, gold, brass);
        const bell = K.cyl(0.075, 0.035, 0.1, gold, 0.15, 0.28, 0, { ...brass, side: THREE.DoubleSide });
        const neck = K.tube([[0, 0.62, 0], [-0.02, 0.68, 0], [-0.08, 0.7, 0]], 0.012, gold, brass);
        const keys = K.many(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 12), 0xd1d5db, [0.55, 0.48, 0.41, 0.34, 0.27, 0.2].map(y => [0.032, y, 0.02]), IM.chrome);
        const g = group(body, bell, neck, keys); g.rotation.z = Math.PI / 2 - 0.1; g.position.set(0.36, 0.04, 0);
        return K.done(g);
      }
      if (/trombone/.test(lower)) {
        const slide = K.many(new THREE.CylinderGeometry(0.008, 0.008, 0.7, 10).rotateZ(Math.PI / 2), gold, [[0.1, 0.02, -0.05], [0.1, 0.02, 0.05]], brass);
        const bell = K.cyl(0.1, 0.015, 0.25, gold, -0.25, 0.1, 0.05, { ...brass, side: THREE.DoubleSide }); bell.rotation.z = Math.PI / 2;
        return K.done(slide, bell);
      }
      // a trumpet lying on its side
      const lead = K.rod([-0.22, 0.04, 0], [0.12, 0.04, 0], 0.006, gold, brass);
      const loop = K.tube([[0.12, 0.04, 0], [0.18, 0.04, -0.02], [0.18, 0.04, -0.07], [0.12, 0.04, -0.08], [-0.1, 0.04, -0.08], [-0.15, 0.04, -0.05], [-0.12, 0.04, -0.03]], 0.006, gold, brass);
      const bell = K.cyl(0.006, 0.062, 0.2, gold, -0.31, 0.06, -0.08, { ...brass, side: THREE.DoubleSide }); bell.rotation.z = Math.PI / 2;
      const mouth = K.cyl(0.008, 0.012, 0.06, 0xd1d5db, 0.2, 0.04, 0, IM.chrome); mouth.rotation.z = Math.PI / 2;
      const valves = [-0.02, 0.01, 0.04].map(x => K.cyl(0.009, 0.009, 0.09, gold, x, 0.05, -0.04, brass));
      const caps = [-0.02, 0.01, 0.04].map(x => K.cyl(0.011, 0.011, 0.01, 0xf5f5f4, x, 0.1, -0.04, { roughness: 0.3 }));
      return K.done(lead, loop, bell, mouth, ...valves, ...caps);
    }

function imWoodwindModel(lower) {
      const K = imKit();
      const flute = /flute|piccolo/.test(lower);
      const L = /piccolo/.test(lower) ? 0.32 : flute ? 0.67 : /recorder/.test(lower) ? 0.32 : 0.66;
      const col = flute ? 0xd1d5db : /recorder/.test(lower) ? 0xe7d4b5 : 0x111827;
      const tube = K.cyl(flute ? 0.0095 : 0.014, flute ? 0.0095 : 0.02, L, col, 0, 0.02, 0, flute ? IM.chrome : IM.plastic, 16);
      tube.rotation.z = Math.PI / 2;
      const keys = K.many(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 10), flute ? 0xe5e7eb : 0xd1d5db, Array.from({ length: 8 }, (_, i) => [-L * 0.3 + i * L * 0.075, 0.02 + (flute ? 0.0095 : 0.017), 0]), IM.chrome);
      const parts = [tube, keys];
      if (!flute && /clarinet|oboe/.test(lower)) { const bell = K.cyl(0.02, 0.035, 0.07, col, -L / 2 - 0.03, 0.035 - 0.0, 0, IM.plastic); bell.rotation.z = Math.PI / 2; parts.push(bell); }
      if (flute) parts.push(K.box(0.02, 0.003, 0.012, 0xd1d5db, L * 0.38, 0.03, 0, IM.chrome));
      return K.done(...parts);
    }

function imDrumModel(lower) {
      const K = imKit();
      const shell = (r, h, x, z, col) => [K.cyl(r, r, h, col, x, h / 2, z, { roughness: 0.25, metalness: 0.3 }), K.cyl(r * 0.99, r * 0.99, 0.002, 0xf5f5f4, x, h + 0.001, z, { roughness: 0.6 }), K.torus(r, 0.006, 0xd1d5db, x, h, z, IM.chrome)].map((o, i) => { if (i === 2) o.rotation.x = Math.PI / 2; return o; });
      if (/drum (set|kit)|drum ?kit|drumset/.test(lower)) {
        const parts = [];
        const kick = K.cyl(0.28, 0.28, 0.4, 0x7f1d1d, 0, 0.28, -0.1, { roughness: 0.25, metalness: 0.3 }); kick.rotation.x = Math.PI / 2;
        const head = K.cyl(0.27, 0.27, 0.002, 0xf5f5f4, 0, 0.28, 0.101); head.rotation.x = Math.PI / 2;
        parts.push(kick, head, ...shell(0.18, 0.15, 0.4, 0.15, 0x7f1d1d).map(o => { o.position.y += 0.5; return o; }));
        parts.push(K.cyl(0.012, 0.012, 0.5, 0xd1d5db, 0.4, 0.25, 0.15, IM.chrome));
        parts.push(...shell(0.13, 0.13, 0.15, -0.05, 0x7f1d1d).map(o => { o.position.y += 0.56; return o; }));
        parts.push(K.cyl(0.006, 0.006, 1.0, 0xd1d5db, -0.45, 0.5, 0, IM.chrome), K.cyl(0.2, 0.2, 0.004, 0xd4a520, -0.45, 1.0, 0, { metalness: 0.95, roughness: 0.3 }));
        return K.done(...parts);
      }
      if (/bongo/.test(lower)) return K.done(...shell(0.09, 0.18, -0.09, 0, 0xa16207), ...shell(0.11, 0.18, 0.11, 0, 0xa16207), K.box(0.05, 0.04, 0.03, 0x111827, 0, 0.12, 0));
      const djembe = /djembe/.test(lower);
      if (djembe) return K.done(K.lathe([[0.08, 0], [0.09, 0.02], [0.06, 0.25], [0.155, 0.5], [0.16, 0.6], [0, 0.6]], 0x7c2d12, IM.wood, 28), K.cyl(0.16, 0.16, 0.003, 0xe7d4b5, 0, 0.6, 0, IM.cloth));
      return K.done(...shell(0.18, 0.14, 0, 0, 0xb91c1c));
    }

function imTambourineModel() {
      const K = imKit();
      const ring = K.lathe([[0.12, 0], [0.125, 0], [0.125, 0.05], [0.12, 0.05]], 0xc8955a, { ...IM.wood, side: THREE.DoubleSide }, 32);
      const skin = K.cyl(0.124, 0.124, 0.001, 0xf5ecd7, 0, 0.05, 0, IM.cloth);
      const jingles = K.many(new THREE.CylinderGeometry(0.018, 0.018, 0.004, 14).rotateX(Math.PI / 2), 0xd4d4d8, [0, 1, 2, 3, 4].map(i => { const a = i / 5 * Math.PI * 2; return [Math.cos(a) * 0.125, 0.025, Math.sin(a) * 0.125]; }), IM.chrome);
      return K.done(ring, skin, jingles);
    }

function imPianoKeyboardModel(lower) {
      const K = imKit();
      const L = /piano$|upright/.test(lower) ? 1.3 : 0.95;
      const body = K.rr(L, 0.3, 0.09, 0.02, 0x18181b, 0, 0, 0, IM.plastic);
      const whites = [], blacks = [];
      const n = Math.round(L / 0.0235) - 4;
      for (let i = 0; i < n; i++) {
        const x = -n * 0.0235 / 2 + i * 0.0235 + 0.012;
        whites.push([x, 0.092, 0.07]);
        if ([0, 1, 3, 4, 5].includes(i % 7) && i < n - 1) blacks.push([x + 0.0118, 0.1, 0.05]);
      }
      const w = K.many(new THREE.BoxGeometry(0.022, 0.012, 0.14), 0xfafaf9, whites, { roughness: 0.3 });
      const b = K.many(new THREE.BoxGeometry(0.012, 0.014, 0.09), 0x0a0a0a, blacks, { roughness: 0.3 });
      const panel = K.box(L * 0.4, 0.002, 0.06, 0x27272a, 0, 0.091, -0.09, IM.screen);
      return K.done(body, w, b, panel);
    }

function imKalimbaModel() {
      const K = imKit();
      const box = K.rr(0.13, 0.17, 0.035, 0.012, 0xa0662f, 0, 0, 0, IM.wood);
      const hole = K.cyl(0.015, 0.015, 0.001, 0x1c1917, 0, 0.0356, 0.03);
      const bar = K.box(0.11, 0.008, 0.008, 0xd1d5db, 0, 0.04, -0.03, IM.chrome);
      const tines = [];
      for (let i = 0; i < 9; i++) { const len = 0.04 + (4 - Math.abs(i - 4)) * 0.008; tines.push(K.box(0.006, 0.002, len, 0xe5e7eb, -0.048 + i * 0.012, 0.045, -0.04 + len / 2 - 0.02 - 0.0, IM.chrome)); }
      return K.done(box, hole, bar, ...tines);
    }

// --- Household, clothes and furniture ----------------------------------------------------------
// Clothes lie folded the way they come out of a box: a garment outline with its collar and cuffs
function imClothingModel(lower) {
      const K = imKit();
      const tone = (COLOR_WORDS.find(([re]) => re.test(lower)) || [])[1];
      if (/scarf/.test(lower)) {
        const col = tone ?? 0xb91c1c, parts = [];
        for (let i = 0; i < 4; i++) parts.push(K.box(0.18, 0.012, 0.22, i % 2 ? col : col, 0, 0.006 + i * 0.012, 0, IM.cloth));
        const tail = K.box(0.18, 0.012, 0.25, col, 0, 0.004, 0.23, IM.cloth);
        const stripes = K.many(new THREE.BoxGeometry(0.182, 0.0125, 0.02), 0xf8fafc, [[0, 0.004, 0.3], [0, 0.004, 0.33]], IM.cloth);
        const fringe = K.many(new THREE.BoxGeometry(0.004, 0.002, 0.03), col, Array.from({ length: 12 }, (_, i) => [-0.085 + i * 0.0155, 0.002, 0.37]), IM.cloth);
        return K.done(...parts, tail, stripes, fringe);
      }
      if (/\b(toque|beanie|knit hat|winter hat|wool hat)\b/.test(lower)) {
        const col = tone ?? 0x1d4ed8;
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), K.mat(col, { roughness: 1 })); dome.scale.y = 1.2; dome.position.y = 0.03; dome.castShadow = true;
        return K.done(dome, K.cyl(0.102, 0.102, 0.05, col, 0, 0.025, 0, { roughness: 1 }), K.ball(0.035, 0xf8fafc, 0, 0.155, 0, { roughness: 1 }));
      }
      if (/\b(cap|baseball cap|ball cap|sun hat|hat)\b/.test(lower)) {
        const col = tone ?? 0x1e3a8a;
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.095, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), K.mat(col, IM.cloth)); crown.scale.set(1, 0.85, 1.08); crown.castShadow = true;
        const brim = K.cyl(0.085, 0.085, 0.006, col, 0, 0.004, 0.09, IM.cloth); brim.scale.set(1, 1, 0.75);
        const button = K.ball(0.008, col, 0, 0.082, 0);
        if (/sun hat|straw/.test(lower)) return K.done(crown, K.cyl(0.18, 0.18, 0.006, col, 0, 0.004, 0, IM.cloth));
        return K.done(crown, brim, button);
      }
      if (/boots?|shoes|sneakers|wellies|waders/.test(lower)) {
        const rain = /rain|rubber|wellies|gum/.test(lower), col = tone ?? (rain ? 0x15803d : 0x7c4a1e);
        const parts = [];
        [-1, 1].forEach(s => {
          const x = s * 0.06;
          parts.push(K.rr(0.095, 0.28, 0.04, 0.04, 0x1c1917, x, 0, 0.03, IM.rubber));
          parts.push(K.rr(0.09, 0.12, rain ? 0.36 : 0.2, 0.04, col, x, 0.03, -0.03, rain ? { roughness: 0.3 } : { roughness: 0.75 }));
          parts.push(K.rr(0.088, 0.14, 0.06, 0.04, col, x, 0.03, 0.07, rain ? { roughness: 0.3 } : { roughness: 0.75 }));
        });
        return K.done(...parts);
      }
      if (/gloves|mittens|mitts/.test(lower) && !/weld|nitrile|heat|kevlar|work gloves|rubber gloves/.test(lower)) {
        const col = tone ?? 0x7f1d1d, parts = [];
        [-1, 1].forEach(s => {
          parts.push(K.slab([[-0.045, 0], [0.045, 0], [0.05, 0.13], [0.03, 0.18], [-0.03, 0.18], [-0.05, 0.12]], 0.025, col, IM.cloth));
          parts.push(K.slab([[0.04, 0.06], [0.08, 0.1], [0.07, 0.12], [0.04, 0.1]], 0.022, col, IM.cloth));
          parts.slice(-2).forEach(p => { p.rotation.x = -Math.PI / 2; p.position.set(s * 0.06 - (s < 0 ? 0.0 : 0), 0.0125 + (s > 0 ? 0.025 : 0), 0.09); if (s < 0) p.scale.x = -1; });
        });
        return K.done(...parts);
      }
      if (/socks/.test(lower)) {
        const col = tone ?? 0x6b7280;
        return K.done(...[-1, 1].map(s => { const p = K.slab([[-0.035, 0], [0.035, 0], [0.035, 0.18], [0.1, 0.22], [0.1, 0.27], [-0.035, 0.27]], 0.012, col, IM.cloth); p.rotation.x = -Math.PI / 2; p.position.set(s * 0.06, 0.006 + (s > 0 ? 0.012 : 0), 0.13); return p; }));
      }
      if (/pants|jeans|trousers|shorts/.test(lower)) {
        const col = tone ?? 0x1e3a8a, L = /shorts/.test(lower) ? 0.25 : 0.4;
        const legs = K.slab([[-0.18, 0], [0.18, 0], [0.16, -L], [0.02, -L], [0, -0.1], [-0.02, -L], [-0.16, -L]], 0.04, col, IM.cloth);
        legs.rotation.x = -Math.PI / 2; legs.position.set(0, 0.02, -L / 2);
        const band = K.box(0.36, 0.041, 0.035, col, 0, 0.02, -L / 2 - 0.015, IM.cloth);
        return K.done(legs, band);
      }
      // A shirt, sweater, hoodie, jacket or coat, laid out flat: its outline, collar, cuffs and hem
      const coat = /jacket|coat|parka|raincoat/.test(lower), knit = /sweater|jumper|wool|knit|cardigan/.test(lower);
      const long = !/t-?shirt|tee\b|vest|short.?sleeve/.test(lower), vest = /\bvest\b/.test(lower);
      const col = tone ?? (coat ? 0x1f2937 : knit ? 0x9f1239 : /hoodie|fleece|sweatshirt/.test(lower) ? 0x6b7280 : 0x2563eb);
      const W = coat ? 0.29 : 0.26, L = coat ? 0.72 : 0.66, S = vest ? 0 : long ? 0.58 : 0.2, T = coat ? 0.04 : knit ? 0.025 : 0.012;
      const outline = [[-W, 0], [W, 0], [W, L - 0.2]];
      if (S) outline.push([W + S * 0.92, L - 0.2 - S * 0.55], [W + S, L - 0.2 - S * 0.4], [W + 0.03, L - 0.04]);
      outline.push([0.07, L], [-0.07, L]);
      if (S) outline.push([-W - 0.03, L - 0.04], [-W - S, L - 0.2 - S * 0.4], [-W - S * 0.92, L - 0.2 - S * 0.55]);
      outline.push([-W, L - 0.2]);
      const fin = { roughness: coat ? 0.6 : 1 };
      const body = K.slab(outline, T, col, fin);
      body.rotation.x = -Math.PI / 2; body.position.set(0, T / 2, L / 2);
      const parts = [body];
      const top = T + 0.0015;
      const collar = K.torus(0.075, coat ? 0.016 : 0.01, col, 0, top, -L / 2 + 0.02, fin, Math.PI); collar.rotation.x = -Math.PI / 2; parts.push(collar);
      parts.push(K.box(W * 2, 0.003, 0.04, col, 0, top, L / 2 - 0.02, { roughness: 1 })); // hem band
      if (coat || /hoodie|cardigan|zip/.test(lower)) parts.push(K.box(0.008, 0.003, L - 0.06, coat ? 0x9ca3af : 0x111827, 0, top, 0.02, IM.steel));
      if (coat) [-1, 1].forEach(sx => parts.push(K.box(0.1, 0.004, 0.07, col, sx * 0.14, top + 0.001, L / 2 - 0.16, fin)));
      if (/hoodie/.test(lower)) { const hood = K.ball(0.1, col, 0, top, -L / 2 + 0.02, { roughness: 1 }); hood.scale.set(1.1, 0.25, 0.8); parts.push(hood); }
      if (knit) parts.push(...[-1, 1].map(sx => K.box(0.05, 0.004, 0.06, col, sx * (W + S * 0.94), top, -0.25 + S * 0.47, { roughness: 1 })));
      if (!coat && !knit && !/hoodie/.test(lower)) parts.push(K.box(0.05, 0.002, 0.055, 0xf8fafc, -0.12, top, -L / 2 + 0.18, IM.cloth)); // a chest pocket or print
      return K.done(...parts);
    }

function imTextileModel(lower) {
      const K = imKit();
      const tone = (COLOR_WORDS.find(([re]) => re.test(lower)) || [])[1];
      if (/pillow|cushion/.test(lower) && !/fabric/.test(lower)) {
        const col = tone ?? 0xf1f5f9;
        const p = K.ball(0.5, col, 0, 0.07, 0, { roughness: 1 }, 24); p.scale.set(/seat cushion/.test(lower) ? 0.42 : 0.5, 0.14, /seat cushion/.test(lower) ? 0.42 : 0.34);
        return K.done(p);
      }
      if (/fabric|cloth|canvas roll|ceconite|material/.test(lower)) {
        const col = tone ?? (/ceconite|dacron/.test(lower) ? 0xf5f5f4 : 0x9ca3af);
        const bolt = K.cyl(0.05, 0.05, 1.1, col, 0, 0.05, 0, IM.cloth, 20); bolt.rotation.z = Math.PI / 2;
        const core = K.cyl(0.02, 0.02, 1.12, 0xc8a46a, 0, 0.05, 0, IM.paper); core.rotation.z = Math.PI / 2;
        return K.done(bolt, core);
      }
      // a folded blanket, quilt or towel
      const towel = /towel/.test(lower);
      const col = tone ?? (/quilt/.test(lower) ? 0x1d4ed8 : towel ? 0xf8fafc : 0x7f1d1d);
      const parts = [];
      const n = towel ? 3 : 5;
      for (let i = 0; i < n; i++) parts.push(K.rr(towel ? 0.3 : 0.45, towel ? 0.2 : 0.35, 0.022, 0.02, col, 0, i * 0.023, 0, { roughness: 1 }));
      if (/plaid|quilt|tartan/.test(lower) || !towel) parts.push(K.box(towel ? 0.3 : 0.45, n * 0.023, 0.03, 0xf8fafc, 0, n * 0.0115, 0.08, { roughness: 1 }));
      return K.done(...parts);
    }

function imFurnitureModel(lower) {
      const K = imKit();
      const tone = (COLOR_WORDS.find(([re]) => re.test(lower)) || [])[1];
      const wood = tone ?? (/walnut/.test(lower) ? 0x6b4226 : /maple|birch|pine/.test(lower) ? 0xdcb17c : /oak/.test(lower) ? 0xb88a52 : 0xa0662f);
      const parts = [];
      if (/book ?(case|shelf)|bookshelves|shelving unit/.test(lower)) {
        const W = 0.8, H = 1.8, D = 0.3;
        [-1, 1].forEach(s => parts.push(K.box(0.02, H, D, wood, s * (W / 2 - 0.01), H / 2, 0, IM.wood)));
        parts.push(K.box(W, H, 0.006, wood, 0, H / 2, -D / 2 + 0.003, IM.wood));
        const shelves = [0.04, 0.45, 0.9, 1.35, 1.79];
        shelves.forEach(y => parts.push(K.box(W - 0.04, 0.02, D, wood, 0, y, 0, IM.wood)));
        const cols = [0x7f1d1d, 0x1e3a8a, 0x14532d, 0xa16207, 0x334155];
        shelves.slice(0, 4).forEach((y, r) => { let x = -W / 2 + 0.04; let i = r; while (x < W / 2 - 0.08) { const t = 0.025 + ((i * 7) % 3) * 0.008, h = 0.22 + ((i * 5) % 4) * 0.025; parts.push(K.box(t, h, 0.2, cols[i % 5], x + t / 2, y + 0.01 + h / 2, 0.02, IM.paper)); x += t + 0.003; i++; if (i - r > 12) break; } });
        return K.done(...parts);
      }
      if (/coat rack|hat stand|hall tree/.test(lower)) {
        parts.push(K.cyl(0.02, 0.025, 1.75, wood, 0, 0.875, 0, IM.wood));
        [0, 1, 2].forEach(i => { const a = i * Math.PI * 2 / 3; parts.push(K.rod([0, 0.02, 0], [Math.cos(a) * 0.28, 0.0, Math.sin(a) * 0.28], 0.015, wood, IM.wood)); });
        [0, 1, 2, 3].forEach(i => { const a = i * Math.PI / 2; parts.push(K.rod([0, 1.6, 0], [Math.cos(a) * 0.14, 1.72, Math.sin(a) * 0.14], 0.012, wood, IM.wood)); });
        return K.done(...parts);
      }
      if (/bench/.test(lower)) {
        parts.push(K.box(1.5, 0.04, 0.4, wood, 0, 0.44, 0, IM.wood));
        [-0.65, 0.65].forEach(x => [-0.15, 0.15].forEach(z => parts.push(K.box(0.05, 0.42, 0.05, wood, x, 0.21, z, IM.wood))));
        parts.push(K.box(1.5, 0.14, 0.03, wood, 0, 0.75, -0.19, IM.wood));
        [-0.65, 0.65].forEach(x => parts.push(K.box(0.04, 0.4, 0.03, wood, x, 0.64, -0.19, IM.wood)));
        return K.done(...parts);
      }
      if (/raised (garden )?bed|planter box/.test(lower)) {
        [[1.2, 0, 0.6], [1.2, 0, -0.6]].forEach(([w, x, z]) => parts.push(K.box(w + 0.04, 0.28, 0.04, wood, x, 0.14, z / 2, IM.wood)));
        [-0.6, 0.6].forEach(x => parts.push(K.box(0.04, 0.28, 0.6, wood, x, 0.14, 0, IM.wood)));
        parts.push(K.box(1.18, 0.02, 0.58, 0x3b2a1a, 0, 0.25, 0, { roughness: 1 }));
        return K.done(...parts);
      }
      if (/picnic table/.test(lower)) {
        parts.push(K.box(1.8, 0.04, 0.75, wood, 0, 0.76, 0, IM.wood));
        [-1, 1].forEach(s => { parts.push(K.box(1.8, 0.04, 0.25, wood, 0, 0.45, s * 0.6, IM.wood)); parts.push(K.rod([s * 0.7, 0.74, -0.75], [s * 0.7, 0, 0.0], 0.03, wood, IM.wood), K.rod([s * 0.7, 0.74, 0.75], [s * 0.7, 0, 0.0], 0.03, wood, IM.wood)); });
        return K.done(...parts);
      }
      if (/dresser|chest of drawers|cabinet|nightstand|bedside table/.test(lower)) {
        const small = /nightstand|bedside/.test(lower), W = small ? 0.45 : 0.9, H = small ? 0.6 : 0.85, D = 0.42, n = small ? 2 : 3;
        parts.push(K.box(W, H - 0.08, D, wood, 0, H / 2 + 0.04, 0, IM.wood));
        for (let i = 0; i < n; i++) { const y = 0.1 + (i + 0.5) * (H - 0.14) / n; parts.push(K.box(W - 0.04, (H - 0.14) / n - 0.015, 0.012, wood, 0, y, D / 2 + 0.006, IM.wood), K.box(0.08, 0.012, 0.015, 0xc9a227, 0, y, D / 2 + 0.016, IM.steel)); }
        [-1, 1].forEach(sx => [-1, 1].forEach(sz => parts.push(K.box(0.04, 0.06, 0.04, wood, sx * (W / 2 - 0.03), 0.03, sz * (D / 2 - 0.03), IM.wood))));
        return K.done(...parts);
      }
      // a table or desk (a side table is small)
      const side = /side table|end table|coffee table|stand\b/.test(lower), desk = /desk/.test(lower);
      const [W, H, D] = side ? (/coffee/.test(lower) ? [1.0, 0.45, 0.55] : [0.5, 0.6, 0.45]) : desk ? [1.2, 0.75, 0.6] : [1.4, 0.75, 0.85];
      parts.push(K.box(W, 0.03, D, wood, 0, H - 0.015, 0, IM.wood));
      parts.push(K.box(W - 0.1, 0.08, D - 0.1, wood, 0, H - 0.07, 0, IM.wood));
      [-1, 1].forEach(sx => [-1, 1].forEach(sz => parts.push(K.box(0.045, H - 0.03, 0.045, wood, sx * (W / 2 - 0.05), (H - 0.03) / 2, sz * (D / 2 - 0.05), IM.wood))));
      if (desk) parts.push(K.box(0.4, 0.16, D - 0.12, wood, W / 2 - 0.25, H - 0.13, 0, IM.wood), K.box(0.08, 0.012, 0.015, 0xc9a227, W / 2 - 0.25, H - 0.13, D / 2 - 0.05, IM.steel));
      return K.done(...parts);
    }

function imPictureFrameModel(lower) {
      const K = imKit();
      const W = /large|poster/.test(lower) ? 0.5 : 0.2, H = W * 1.25;
      const frame = K.box(W, H, 0.02, /black/.test(lower) ? 0x111827 : 0x8b5a2b, 0, H / 2 + 0.0, 0, IM.wood);
      const mat = K.box(W - 0.03, H - 0.03, 0.002, 0xfafaf9, 0, H / 2, 0.0105, IM.paper);
      const pic = K.box(W * 0.6, H * 0.55, 0.001, 0x5b8fb9, 0, H / 2 + 0.005, 0.012, IM.paper);
      const hill = K.box(W * 0.6, H * 0.18, 0.0012, 0x4d7c0f, 0, H / 2 - H * 0.16, 0.0125, IM.paper);
      const g = group(frame, mat, pic, hill); g.rotation.x = -0.12; g.position.z = 0.02;
      const leg = K.rod([0, H * 0.45, -0.01], [0, 0, -H * 0.3], 0.004, 0x5b3a1e, IM.wood);
      return K.done(g, leg);
    }

function imMirrorModel() {
      const K = imKit();
      const frame = K.box(0.5, 0.7, 0.03, 0xb88a52, 0, 0.35, 0, IM.wood);
      const glassFace = K.box(0.44, 0.64, 0.004, 0xdde3ea, 0, 0.35, 0.016, { metalness: 1, roughness: 0.04 });
      const g = group(frame, glassFace); g.rotation.x = -0.1;
      return K.done(at(g, 0, 0.0, 0.04));
    }

function imFireExtinguisherModel() {
      const K = imKit();
      const body = K.lathe([[0, 0], [0.065, 0], [0.068, 0.01], [0.068, 0.36], [0.05, 0.4], [0.02, 0.42], [0, 0.42]], 0xdc2626, { roughness: 0.3, metalness: 0.2 }, 28);
      const label = K.cyl(0.0685, 0.0685, 0.12, 0xf8fafc, 0, 0.2, 0, IM.paper);
      const valve = K.box(0.03, 0.04, 0.03, 0x111827, 0, 0.44, 0, IM.steel);
      const lever = K.box(0.1, 0.008, 0.025, 0x111827, 0.03, 0.47, 0, IM.steel); lever.rotation.z = -0.15;
      const gauge = K.cyl(0.012, 0.012, 0.008, 0xf8fafc, 0.0, 0.44, 0.02); gauge.rotation.x = Math.PI / 2;
      const hose = K.tube([[0.02, 0.44, -0.01], [0.06, 0.4, -0.05], [0.075, 0.25, -0.04], [0.072, 0.18, 0.0]], 0.007, 0x111827, IM.rubber);
      return K.done(body, label, valve, lever, gauge, hose);
    }

function imFirstAidModel() {
      return imCartonModel(0.26, 0.09, 0.17, 0xdc2626, 0xdc2626, [
        K => K.box(0.06, 0.0015, 0.018, 0xf8fafc, 0, 0.0905, 0),
        K => K.box(0.018, 0.0015, 0.06, 0xf8fafc, 0, 0.0905, 0),
        K => K.rr(0.08, 0.02, 0.015, 0.008, 0x111827, 0, 0.09, -0.0, IM.plastic)
      ]);
    }

function imBinocularsModel() {
      const K = imKit(), parts = [];
      [-1, 1].forEach(s => {
        const barrel = K.cyl(0.03, 0.028, 0.13, 0x1f2937, s * 0.042, 0.035, 0, IM.rubber); barrel.rotation.x = Math.PI / 2; parts.push(barrel);
        const ob = K.cyl(0.025, 0.025, 0.002, 0x1e3a8a, s * 0.042, 0.035, 0.066, { metalness: 0.6, roughness: 0.05 }); ob.rotation.x = Math.PI / 2; parts.push(ob);
        const eye = K.cyl(0.018, 0.02, 0.03, 0x111827, s * 0.035, 0.035, -0.075, IM.rubber); eye.rotation.x = Math.PI / 2; parts.push(eye);
      });
      parts.push(K.box(0.04, 0.014, 0.05, 0x27272a, 0, 0.055, -0.03, IM.plastic));
      const focus = K.cyl(0.01, 0.01, 0.022, 0x52525b, 0, 0.065, -0.03, IM.rubber); focus.rotation.z = Math.PI / 2; parts.push(focus);
      return K.done(...parts);
    }

function imGlobeModel() {
      const K = imKit();
      const sea = K.ball(0.15, 0x1d4ed8, 0, 0, 0, { roughness: 0.35 }, 28);
      const lands = [[0.4, 0.3], [2.0, 0.5], [3.6, -0.2], [5.0, 0.4], [1.2, -0.6]].map(([lon, lat], i) => {
        const l = K.ball(0.05 + (i % 2) * 0.02, 0x65a30d, Math.cos(lat) * Math.cos(lon) * 0.13, Math.sin(lat) * 0.13, Math.cos(lat) * Math.sin(lon) * 0.13, { roughness: 0.5 });
        l.scale.set(0.9, 0.9, 0.9); return l;
      });
      const earth = group(sea, ...lands); earth.rotation.z = 0.41;
      const meridian = K.torus(0.16, 0.004, 0xc9a227, 0, 0, 0, { metalness: 0.9, roughness: 0.3 }, Math.PI * 1.2); meridian.rotation.z = 0.41 - 0.6;
      const top = group(earth, meridian); top.position.y = 0.24;
      const stand = K.lathe([[0, 0], [0.09, 0], [0.09, 0.015], [0.02, 0.03], [0.012, 0.08], [0, 0.08]], 0x3f2a1d, IM.wood);
      return K.done(stand, top);
    }

function imHourglassModel() {
      const K = imKit();
      const glassBulb = K.lathe([[0.004, 0.13], [0.04, 0.165], [0.045, 0.21], [0.03, 0.235], [0, 0.24]], 0xe0f2fe, { ...IM.glass, side: THREE.DoubleSide });
      const low = K.lathe([[0, 0.02], [0.03, 0.025], [0.045, 0.05], [0.04, 0.095], [0.004, 0.13]], 0xe0f2fe, { ...IM.glass, side: THREE.DoubleSide });
      [glassBulb, low].forEach(o => (o.castShadow = false));
      const sand = K.lathe([[0, 0.022], [0.04, 0.03], [0.04, 0.05], [0, 0.065]], 0xe7c48d, { roughness: 1 });
      const plates = [0.01, 0.25].map(y => K.cyl(0.06, 0.06, 0.02, 0x7c4a1e, 0, y, 0, IM.wood));
      const posts = [0, 1, 2].map(i => { const a = i * Math.PI * 2 / 3; return K.cyl(0.006, 0.006, 0.23, 0x7c4a1e, Math.cos(a) * 0.05, 0.13, Math.sin(a) * 0.05, IM.wood); });
      return K.done(glassBulb, low, sand, ...plates, ...posts);
    }

function imBirdFeederModel() {
      const K = imKit();
      const tube = K.cyl(0.04, 0.04, 0.22, 0xe0f2fe, 0, 0.14, 0, IM.glass); tube.castShadow = false;
      const seed = K.cyl(0.037, 0.037, 0.14, 0xb08a4a, 0, 0.1, 0, { roughness: 1 });
      const roof = K.cyl(0.0, 0.07, 0.05, 0x166534, 0, 0.275, 0, IM.plastic);
      const base = K.cyl(0.07, 0.06, 0.03, 0x166534, 0, 0.015, 0, IM.plastic);
      const perches = [0, Math.PI / 2].map(r => { const p = K.cyl(0.003, 0.003, 0.14, 0xd1d5db, 0, 0.06, 0, IM.steel); p.rotation.set(Math.PI / 2, 0, r); return p; });
      const hook = K.torus(0.02, 0.003, 0xd1d5db, 0, 0.32, 0, IM.steel);
      return K.done(tube, seed, roof, base, ...perches, hook);
    }

function imFlowerPotModel(lower) {
      const K = imKit();
      const R = /large|big/.test(lower) ? 0.17 : 0.08;
      const pot = K.lathe([[0, 0], [R * 0.72, 0], [R, R * 1.3], [R * 1.08, R * 1.3], [R * 1.08, R * 1.5], [R * 0.95, R * 1.5], [R * 0.9, R * 0.2], [0, R * 0.2]], 0xc2642d, { roughness: 0.9, side: THREE.DoubleSide }, 28);
      const soil = /soil|plant|seedling/.test(lower) ? [K.cyl(R * 0.93, R * 0.93, 0.004, 0x3b2a1a, 0, R * 1.35, 0, { roughness: 1 })] : [];
      const saucer = K.cyl(R * 0.85, R * 0.78, 0.012, 0xb45d2a, 0, 0.006, 0, { roughness: 0.9 });
      return K.done(pot, saucer, ...soil);
    }

function imBucketModel(lower) {
      const K = imKit();
      const metal = /metal|galvan|steel|tin/.test(lower);
      const col = metal ? 0xb6bcc4 : /orange/.test(lower) ? 0xf97316 : /white/.test(lower) ? 0xf8fafc : 0x2563eb;
      const pail = K.lathe([[0, 0], [0.12, 0], [0.15, 0.3], [0.155, 0.31], [0.145, 0.31], [0.115, 0.012], [0, 0.012]], col, { ...(metal ? IM.alu : IM.plastic), side: THREE.DoubleSide }, 28);
      const bail = K.torus(0.152, 0.003, 0x52525b, 0, 0.29, 0, IM.steel, Math.PI);
      const grip = K.cyl(0.012, 0.012, 0.08, 0x111827, 0, 0.44, 0, IM.plastic); grip.rotation.z = Math.PI / 2;
      return K.done(pail, bail, grip);
    }

function imBroomModel(lower) {
      const K = imKit();
      const mop = /mop/.test(lower), push = /push broom|shop broom/.test(lower);
      const handle = K.rod([-0.65, 0.025, 0], [0.6, 0.025, 0], 0.012, /wood/.test(lower) || !mop ? 0xc8955a : 0x2563eb, IM.wood);
      if (mop) { const head = K.ball(0.08, 0xe7e5e4, 0.66, 0.06, 0, { roughness: 1 }); head.scale.set(1.2, 0.7, 1.6); return K.done(handle, head); }
      if (push) return K.done(handle, K.box(0.06, 0.05, 0.45, 0x7c4a1e, 0.63, 0.06, 0, IM.wood), K.box(0.04, 0.06, 0.44, 0x111827, 0.67, 0.03, 0, IM.cloth));
      const bristles = K.slab([[0, -0.04], [0.28, -0.13], [0.28, 0.13], [0, 0.04]], 0.04, 0xd6b25e, { roughness: 1 }); bristles.rotation.x = -Math.PI / 2; bristles.position.set(0.6, 0.025, 0);
      return K.done(handle, bristles, K.box(0.04, 0.045, 0.1, 0x7f1d1d, 0.6, 0.025, 0, IM.cloth));
    }

// --- Workshop tools, safety gear and supplies --------------------------------------------------
function imPowerToolModel(lower) {
      const K = imKit();
      const col = /dewalt|yellow/.test(lower) ? 0xf5b70a : /makita|teal/.test(lower) ? 0x0e9aa7 : /milwaukee|red/.test(lower) ? 0xc8102e : 0x0e9aa7;
      const body = (pts, d) => K.slab(pts, d, col, IM.plastic);
      if (/angle grinder/.test(lower)) {
        const b = K.cyl(0.03, 0.033, 0.27, col, -0.05, 0.035, 0, IM.plastic); b.rotation.z = Math.PI / 2;
        const head = K.box(0.06, 0.05, 0.06, 0x52525b, 0.11, 0.04, 0, IM.alu);
        const disc = K.cyl(0.0575, 0.0575, 0.004, 0x3f3f46, 0.11, 0.075, 0, IM.matte, 28); disc.rotation.x = 0;
        disc.position.set(0.11, 0.035, 0.04); disc.rotation.x = Math.PI / 2;
        const guard = K.cyl(0.062, 0.062, 0.012, 0xa1a1aa, 0.11, 0.035, 0.03, { ...IM.alu, side: THREE.DoubleSide }, 20); guard.rotation.x = Math.PI / 2; guard.scale.set(1, 1, 1);
        const side = K.cyl(0.012, 0.012, 0.09, 0x111827, 0.11, 0.09, 0, IM.rubber);
        return K.done(b, head, disc, side);
      }
      if (/jigsaw/.test(lower)) {
        const b = body([[-0.11, 0.05], [0.09, 0.05], [0.1, 0.11], [0.02, 0.2], [-0.1, 0.2], [-0.12, 0.12]], 0.07);
        const hole = K.box(0.1, 0.05, 0.072, 0x111827, -0.03, 0.14, 0, IM.rubber);
        const shoe = K.box(0.2, 0.012, 0.08, 0xa1a1aa, 0, 0.034, 0, IM.alu);
        const blade = K.box(0.008, 0.06, 0.002, 0xd1d5db, 0.06, 0.0, 0, IM.steel);
        const g = group(b, hole, shoe, blade); g.position.y = 0.03;
        return K.done(g);
      }
      if (/circular saw/.test(lower)) {
        const guard = K.cyl(0.095, 0.095, 0.05, 0x52525b, 0, 0.1, 0, IM.alu); guard.rotation.x = Math.PI / 2;
        const motor = K.cyl(0.05, 0.05, 0.1, col, 0, 0.1, -0.07, IM.plastic); motor.rotation.x = Math.PI / 2;
        const shoe = K.box(0.3, 0.008, 0.2, 0xa1a1aa, 0, 0.004, -0.02, IM.alu);
        const handle = K.torus(0.06, 0.014, 0x111827, -0.04, 0.17, -0.05, IM.rubber, Math.PI);
        return K.done(guard, motor, shoe, handle);
      }
      if (/router|trim router/.test(lower) && !/table|cnc/.test(lower)) {
        const base = K.cyl(0.075, 0.075, 0.012, 0x111827, 0, 0.006, 0, IM.plastic);
        const motor = K.cyl(0.045, 0.045, 0.17, col, 0, 0.11, 0, IM.plastic);
        const top = K.cyl(0.04, 0.045, 0.03, 0x111827, 0, 0.21, 0, IM.plastic);
        const posts = [-1, 1].map(s => K.cyl(0.008, 0.008, 0.06, 0xd1d5db, s * 0.06, 0.04, 0, IM.chrome));
        const knobs = [-1, 1].map(s => K.ball(0.025, 0x111827, s * 0.085, 0.09, 0));
        return K.done(base, motor, top, ...posts, ...knobs);
      }
      if (/sander/.test(lower)) {
        const pad = K.cyl(0.0625, 0.0625, 0.015, 0x111827, 0, 0.008, 0, IM.rubber);
        const b = K.ball(0.07, col, 0, 0.07, 0, IM.plastic); b.scale.set(1, 0.9, 1.1);
        const bag = K.cyl(0.03, 0.03, 0.1, 0x334155, 0, 0.06, -0.1, IM.cloth); bag.rotation.x = Math.PI / 2;
        return K.done(pad, b, bag);
      }
      if (/staple gun|nail gun|brad nailer|rivet gun|pop.?rivet/.test(lower)) {
        const rivet = /rivet/.test(lower);
        const b = body([[-0.08, 0.0], [0.12, 0.0], [0.12, 0.05], [-0.08, 0.06]], 0.04);
        const grip = K.slab([[-0.05, 0], [-0.01, 0], [-0.03, -0.12], [-0.07, -0.12]], 0.035, 0x111827, IM.rubber);
        const nose = K.cyl(0.006, 0.01, 0.05, 0xd1d5db, 0.15, 0.03, 0, IM.chrome); nose.rotation.z = -Math.PI / 2;
        const g = group(b, grip, ...(rivet ? [nose] : [])); g.position.y = 0.12;
        if (/staple/.test(lower)) { const h = K.slab([[-0.08, 0.06], [0.08, 0.06], [0.06, 0.1], [-0.07, 0.1]], 0.03, 0x111827, IM.rubber); g.add(h); }
        return K.done(g);
      }
      if (/spray gun|hvlp/.test(lower)) {
        const cup = K.cyl(0.04, 0.035, 0.1, 0xe5e7eb, 0, 0.21, 0, { transparent: true, opacity: 0.8, roughness: 0.2 });
        const gun = K.box(0.14, 0.04, 0.03, 0x9ca3af, 0.01, 0.14, 0, IM.alu);
        const handle = K.box(0.03, 0.12, 0.03, 0x9ca3af, -0.04, 0.07, 0, IM.alu); handle.rotation.z = 0.2;
        const cap = K.cyl(0.018, 0.018, 0.02, 0xd1d5db, 0.09, 0.14, 0, IM.chrome); cap.rotation.z = Math.PI / 2;
        return K.done(cup, gun, handle, cap);
      }
      if (/heat gun|hot air gun/.test(lower)) {
        const barrel = K.cyl(0.03, 0.035, 0.18, col, 0.06, 0.15, 0, IM.plastic); barrel.rotation.z = Math.PI / 2;
        const grip = K.box(0.04, 0.13, 0.04, col, -0.02, 0.065, 0, IM.plastic);
        const nozzle = K.cyl(0.02, 0.022, 0.05, 0xd1d5db, 0.17, 0.15, 0, IM.chrome); nozzle.rotation.z = Math.PI / 2;
        return K.done(barrel, grip, nozzle);
      }
      // an impact driver or a hammer drill: the cordless drill's shape in the brand colour
      const b = body([[-0.07, 0.0], [0.07, 0.0], [0.08, 0.03], [0.08, 0.06], [-0.07, 0.065], [-0.085, 0.035]], 0.055);
      const grip = K.slab([[-0.035, 0], [0.01, 0], [0.0, -0.12], [-0.045, -0.12]], 0.045, 0x111827, IM.rubber);
      const battery = K.box(0.1, 0.045, 0.075, 0x111827, -0.025, -0.145, 0, IM.plastic);
      const chuck = K.cyl(0.013, 0.016, 0.03, 0x111827, 0.095, 0.035, 0, IM.steel); chuck.rotation.z = -Math.PI / 2;
      const g = group(b, grip, battery, chuck); g.position.y = 0.17;
      return K.done(g);
    }

function imBenchMachineModel(lower) {
      const K = imKit();
      if (/bandsaw/.test(lower)) {
        const metal = /metal/.test(lower);
        if (metal) {
          const base = K.box(0.6, 0.1, 0.35, 0x1e40af, 0, 0.05, 0, IM.iron);
          const vise = K.box(0.12, 0.08, 0.2, 0x52525b, -0.1, 0.14, 0, IM.iron);
          const arm = K.box(0.55, 0.14, 0.12, 0x1e40af, 0.03, 0.27, -0.05, IM.iron); arm.rotation.z = 0.15;
          const blade = K.box(0.45, 0.012, 0.002, 0xd1d5db, 0.03, 0.17, 0.0, IM.steel);
          return K.done(base, vise, arm, blade);
        }
        const frame = K.slab([[-0.2, 0], [0.2, 0], [0.2, 0.08], [0.06, 0.08], [0.06, 0.6], [-0.2, 0.6]], 0.16, 0x1e3a8a, IM.iron);
        const table = K.box(0.3, 0.02, 0.3, 0x9ca3af, 0.08, 0.25, 0, IM.alu);
        const blade = K.box(0.004, 0.5, 0.004, 0xd1d5db, 0.12, 0.33, 0, IM.steel);
        const base = K.box(0.4, 0.2, 0.3, 0x111827, 0, -0.1, 0, IM.iron);
        const g = group(frame, table, blade, base); g.position.y = 0.2;
        return K.done(g);
      }
      if (/welder|plasma cutter|tig machine/.test(lower)) {
        const box = K.rr(0.24, 0.48, 0.3, 0.02, /plasma/.test(lower) ? 0x2563eb : 0xdc2626, 0, 0, 0, IM.plastic);
        const face = K.box(0.2, 0.2, 0.004, 0x111827, 0, 0.17, 0.241, IM.plastic);
        const knobs = [-0.05, 0.05].map(x => K.cyl(0.015, 0.015, 0.02, 0x111827, x, 0.2, 0.25, IM.plastic)); knobs.forEach(k => (k.rotation.x = Math.PI / 2));
        const handle = K.box(0.06, 0.03, 0.3, 0x111827, 0, 0.32, 0, IM.plastic);
        const lead = K.tube([[0.05, 0.08, 0.24], [0.15, 0.03, 0.32], [0.3, 0.01, 0.2], [0.33, 0.01, 0.0]], 0.008, 0x111827, IM.rubber);
        const gun = K.cyl(0.012, 0.018, 0.15, 0x111827, 0.33, 0.02, -0.07, IM.rubber); gun.rotation.x = Math.PI / 2;
        return K.done(box, face, ...knobs, handle, lead, gun);
      }
      if (/air compressor|compressor/.test(lower)) {
        const tank = K.cyl(0.13, 0.13, 0.45, 0xdc2626, 0, 0.16, 0, { roughness: 0.3, metalness: 0.3 }); tank.rotation.z = Math.PI / 2;
        const motor = K.box(0.2, 0.14, 0.14, 0x111827, 0, 0.36, 0, IM.iron);
        const wheels = [-1, 1].map(s => { const w = K.cyl(0.06, 0.06, 0.03, 0x111827, 0.2, 0.06, s * 0.13, IM.rubber); w.rotation.x = Math.PI / 2; return w; });
        const handle = K.rod([-0.25, 0.3, -0.1], [-0.25, 0.3, 0.1], 0.012, 0x111827);
        return K.done(tank, motor, ...wheels, handle);
      }
      if (/shop vac|wet.?dry vac|vacuum/.test(lower)) {
        const drum = K.cyl(0.2, 0.18, 0.4, 0xf59e0b, 0, 0.24, 0, IM.plastic);
        const lid = K.cyl(0.2, 0.2, 0.08, 0x111827, 0, 0.48, 0, IM.plastic);
        const hose = K.tube([[0.18, 0.3, 0], [0.32, 0.25, 0.1], [0.35, 0.05, 0.25]], 0.025, 0x111827, IM.rubber);
        return K.done(drum, lid, hose);
      }
      // a bench vise
      const base = K.box(0.16, 0.03, 0.12, 0x1e3a8a, 0, 0.015, 0, IM.iron);
      const body = K.box(0.1, 0.09, 0.2, 0x1e3a8a, 0, 0.075, 0, IM.iron);
      const jaws = [-0.06, 0.06].map(z => K.box(0.15, 0.06, 0.03, 0x1e3a8a, 0, 0.14, z, IM.iron));
      const plates = [-0.044, 0.044].map(z => K.box(0.15, 0.05, 0.004, 0x52525b, 0, 0.145, z, IM.steel));
      const screw = K.rod([0, 0.1, 0.1], [0, 0.1, 0.24], 0.01, 0xd1d5db, IM.chrome);
      const tbar = K.rod([-0.09, 0.1, 0.24], [0.09, 0.1, 0.24], 0.007, 0xd1d5db, IM.chrome);
      return K.done(base, body, ...jaws, ...plates, screw, tbar);
    }

function imHandToolSetModel(lower) {
      const K = imKit();
      if (/clamp/.test(lower)) {
        const parts = [], n = /clamps/.test(lower) ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const z = i * 0.09;
          parts.push(K.box(0.45, 0.012, 0.025, 0xd1d5db, 0, 0.012, z, IM.steel));
          parts.push(K.box(0.03, 0.012, 0.11, 0xf97316, -0.2, 0.012, z + 0.05, IM.plastic), K.box(0.03, 0.012, 0.11, 0xf97316, 0.05, 0.012, z + 0.05, IM.plastic));
          parts.push(K.box(0.05, 0.03, 0.12, 0x111827, 0.07, 0.016, z + 0.05, IM.rubber));
        }
        return K.done(...parts);
      }
      if (/chisels|gouges|file\b|rasp/.test(lower)) {
        const parts = [], n = /set|chisels|gouges/.test(lower) ? 4 : 1;
        parts.push(...(n > 1 ? [K.box(0.32, 0.01, 0.16, 0x3f2a1d, 0, 0.005, 0, { roughness: 1 })] : []));
        for (let i = 0; i < n; i++) {
          const z = (i - (n - 1) / 2) * 0.035;
          const steel = K.box(/file|rasp/.test(lower) ? 0.2 : 0.13, 0.005, 0.012 + i * 0.004, 0x9ca3af, 0.04, 0.014, z, IM.steel);
          const handle = K.cyl(0.012, 0.014, 0.12, 0xb7793e, -0.09, 0.016, z, IM.wood); handle.rotation.z = Math.PI / 2;
          parts.push(steel, handle);
        }
        return K.done(...parts);
      }
      // a socket set in its case
      const box = K.rr(0.36, 0.22, 0.06, 0.02, 0x1f2937, 0, 0, 0, IM.plastic);
      const spots = [];
      for (let i = 0; i < 10; i++) spots.push([-0.15 + i * 0.03, 0.07, -0.06]);
      const sockets = K.many(new THREE.CylinderGeometry(0.011, 0.011, 0.03, 12), 0xd1d5db, spots, IM.chrome);
      const ratchet = K.box(0.2, 0.015, 0.025, 0xd1d5db, 0.0, 0.068, 0.04, IM.chrome);
      return K.done(box, sockets, ratchet);
    }

function imSafetyGearModel(lower) {
      const K = imKit();
      if (/respirator|gas mask|dust mask/.test(lower)) {
        const face = K.ball(0.06, 0x6b7280, 0, 0.06, 0, IM.rubber); face.scale.set(1, 1, 0.75);
        const cartridges = [-1, 1].map(s => { const c = K.cyl(0.035, 0.035, 0.03, 0xec4899, s * 0.06, 0.05, 0.03, IM.plastic); c.rotation.set(Math.PI / 2, 0, s * 0.5); return c; });
        const strap = K.torus(0.08, 0.005, 0x111827, 0, 0.07, -0.05, IM.cloth); strap.rotation.x = Math.PI / 2;
        return K.done(face, ...cartridges, strap);
      }
      if (/ear (defenders|muffs|protection)|earmuffs/.test(lower)) {
        const band = K.torus(0.08, 0.008, 0x111827, 0, 0.09, 0, IM.plastic, Math.PI);
        const cups = [-1, 1].map(s => { const c = K.cyl(0.04, 0.04, 0.045, 0xf59e0b, s * 0.08, 0.05, 0, IM.plastic); c.rotation.z = Math.PI / 2; return c; });
        return K.done(band, ...cups);
      }
      if (/face shield/.test(lower)) {
        const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.22, 20, 1, true, -1.2, 2.4), K.mat(0xdbeafe, { ...IM.glass, side: THREE.DoubleSide })); visor.position.y = 0.12;
        const band = K.torus(0.1, 0.012, 0x111827, 0, 0.23, 0, IM.plastic); band.rotation.x = Math.PI / 2;
        return K.done(visor, band);
      }
      if (/safety glasses|goggles/.test(lower)) {
        const lens = K.box(0.15, 0.045, 0.004, /fpv/.test(lower) ? 0x111827 : 0xfef08a, 0, 0.03, 0.03, /fpv/.test(lower) ? IM.plastic : IM.glass);
        if (/fpv/.test(lower)) return K.done(K.rr(0.18, 0.08, 0.07, 0.02, 0x111827, 0, 0, 0, IM.plastic), K.box(0.03, 0.03, 0.03, 0x52525b, 0.07, 0.085, 0, IM.plastic));
        const arms = [-1, 1].map(s => K.box(0.004, 0.012, 0.13, 0x111827, s * 0.075, 0.04, -0.03, IM.plastic));
        return K.done(lens, ...arms);
      }
      if (/esd|wrist strap/.test(lower)) {
        const band = K.torus(0.035, 0.008, 0x111827, 0, 0.008, 0, IM.cloth); band.rotation.x = Math.PI / 2;
        const lead = K.tube([[0.035, 0.008, 0], [0.1, 0.004, 0.05], [0.15, 0.004, -0.02], [0.2, 0.004, 0.03]], 0.002, 0x2563eb, IM.rubber);
        return K.done(band, lead, K.box(0.02, 0.01, 0.03, 0xd1d5db, 0.2, 0.008, 0.03, IM.steel));
      }
      if (/nitrile|latex|disposable/.test(lower)) return imCartonModel(0.24, 0.07, 0.12, 0x1d4ed8, 0xf8fafc, [K2 => K2.box(0.08, 0.002, 0.03, 0x1d4ed8, 0, 0.071, 0)]);
      // work gloves (leather, Kevlar heat gloves)
      const col = /kevlar|heat/.test(lower) ? 0xeab308 : 0xc69c6d;
      const parts = [];
      [-1, 1].forEach(s => {
        const p = K.slab([[-0.05, 0], [0.05, 0], [0.055, 0.14], [0.035, 0.24], [-0.035, 0.24], [-0.055, 0.14]], 0.03, col, { roughness: 0.9 });
        p.rotation.x = -Math.PI / 2; p.position.set(s * 0.065, 0.015 + (s > 0 ? 0.03 : 0), 0.13);
        const cuff = K.box(0.12, 0.03, 0.12, col, s * 0.065, 0.015 + (s > 0 ? 0.03 : 0), -0.05, { roughness: 0.9 });
        parts.push(p, cuff);
      });
      return K.done(...parts);
    }

function imCutterSetModel(lower) {
      const K = imKit();
      if (/face mill/.test(lower)) {
        const body = K.cyl(0.038, 0.038, 0.045, 0x52525b, 0, 0.0225, 0, IM.steel, 24);
        const inserts = K.many(new THREE.BoxGeometry(0.012, 0.01, 0.012), 0xd4a520, Array.from({ length: 6 }, (_, i) => [Math.cos(i / 6 * Math.PI * 2) * 0.036, 0.005, Math.sin(i / 6 * Math.PI * 2) * 0.036]), { metalness: 0.9, roughness: 0.3 });
        return K.done(body, inserts, K.cyl(0.012, 0.012, 0.03, 0x9ca3af, 0, 0.06, 0, IM.steel));
      }
      // a box of end mills, router bits or drill bits standing in a holder
      const n = /set|bits$|end mills|kit/.test(lower) ? 6 : 1;
      const v = /v-?bit|engraving/.test(lower);
      const tray = n > 1 ? [K.rr(0.2, 0.06, 0.02, 0.008, 0x1f2937, 0, 0, 0, IM.plastic)] : [];
      const parts = [...tray];
      for (let i = 0; i < n; i++) {
        const x = n > 1 ? -0.075 + i * 0.03 : 0, y0 = n > 1 ? 0.02 : 0;
        parts.push(K.cyl(0.003 + (n > 1 ? i * 0.0006 : 0.003), 0.003 + (n > 1 ? i * 0.0006 : 0.003), 0.04, 0xd1d5db, x, y0 + 0.02, 0, IM.chrome));
        parts.push(v ? K.cyl(0.006, 0.0005, 0.02, 0xd4a520, x, y0 + 0.05, 0, { metalness: 0.9, roughness: 0.3 }) : K.cyl(0.003 + (n > 1 ? i * 0.0006 : 0.003), 0.003 + (n > 1 ? i * 0.0006 : 0.003), 0.025, 0x9ca3af, x, y0 + 0.0525, 0, { metalness: 0.9, roughness: 0.2 }));
      }
      return K.done(...parts);
    }

function imBladeCoilModel() {
      const K = imKit(), parts = [];
      for (let i = 0; i < 3; i++) { const l = K.torus(0.17, 0.008, 0x9ca3af, 0, 0.004 + i * 0.006, 0, IM.steel); l.rotation.x = Math.PI / 2; l.scale.set(1, 1, 0.08); parts.push(l); }
      return K.done(...parts, K.box(0.08, 0.02, 0.04, 0xf97316, 0.16, 0.01, 0, IM.paper));
    }

function imJackStandModel(lower) {
      const K = imKit(), parts = [];
      if (/floor jack|trolley jack/.test(lower)) {
        parts.push(K.box(0.65, 0.08, 0.28, 0xdc2626, 0, 0.09, 0, IM.iron));
        [[-0.28, 0.12], [-0.28, -0.12], [0.28, 0.12], [0.28, -0.12]].forEach(([x, z]) => { const w = K.cyl(0.04, 0.04, 0.03, 0x111827, x, 0.04, z, IM.rubber); w.rotation.x = Math.PI / 2; parts.push(w); });
        parts.push(K.cyl(0.06, 0.06, 0.02, 0x111827, 0.3, 0.17, 0, IM.rubber), K.rod([-0.3, 0.13, 0], [-0.75, 0.6, 0], 0.012, 0x111827, IM.steel));
        return K.done(...parts);
      }
      const n = /pair|stands/.test(lower) ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * 0.32;
        [0, 1, 2, 3].forEach(k => { const a = k * Math.PI / 2 + Math.PI / 4; parts.push(K.rod([x + Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12], [x + Math.cos(a) * 0.03, 0.28, Math.sin(a) * 0.03], 0.012, 0xdc2626, IM.iron)); });
        parts.push(K.cyl(0.018, 0.018, 0.2, 0xd1d5db, x, 0.36, 0, IM.steel), K.box(0.07, 0.03, 0.05, 0xd1d5db, x, 0.47, 0, IM.steel));
      }
      return K.done(...parts);
    }

function imTyreModel(lower) {
      const K = imKit(), parts = [];
      const small = /6 in\.|5 in\.|-5|-6|wheelbarrow|kart|go-?kart|scooter|caster/.test(lower), n = /tyres|tires|wheels|\(pair\)/.test(lower) ? 2 : 1;
      const R = /caster/.test(lower) ? 0.04 : small ? 0.14 : 0.33, W = /caster/.test(lower) ? 0.025 : small ? 0.12 : 0.21;
      for (let i = 0; i < n; i++) {
        const g = group(K.torus(R * 0.72, R * 0.28, 0x1c1917, 0, 0, 0, IM.rubber), K.cyl(R * 0.5, R * 0.5, W * 0.7, 0xb6bcc4, 0, 0, 0, IM.alu, 20));
        g.children[0].scale.z = W / (R * 0.56);
        g.children[1].rotation.x = Math.PI / 2;
        g.position.set(i * (W + 0.02), R, 0);
        g.rotation.y = Math.PI / 2;
        parts.push(g);
      }
      if (/caster/.test(lower)) parts.forEach(p => p.add(at(K.box(0.05, 0.01, 0.05, 0xd1d5db, 0, R + 0.02, 0, IM.steel), 0, R + 0.01, 0)));
      return K.done(...parts);
    }

function imGaugeModel(lower) {
      const K = imKit();
      const R = /2-1\/4|small/.test(lower) ? 0.03 : 0.04;
      const can = K.cyl(R, R, 0.06, 0x111827, 0, R, 0, IM.matte); can.rotation.x = Math.PI / 2;
      const face = K.cyl(R * 0.88, R * 0.88, 0.002, 0x0b0b0b, 0, R, 0.031, { roughness: 0.3 }); face.rotation.x = Math.PI / 2;
      const ticks = K.many(new THREE.BoxGeometry(0.0015, 0.006, 0.001), 0xf8fafc, Array.from({ length: 9 }, (_, i) => { const a = -2.3 + i * 0.575; return [Math.sin(a) * R * 0.72, R + Math.cos(a) * R * 0.72, 0.033]; }));
      const needle = K.box(0.0015, R * 0.65, 0.001, 0xf97316, 0.006, R + 0.008, 0.034); needle.rotation.z = -0.6;
      const bezel = K.torus(R * 0.92, 0.003, 0x52525b, 0, R, 0.031, IM.steel);
      return K.done(can, face, ticks, needle, bezel);
    }

// Small parts in a clear zip bag: bolts, nuts, washers, rivets, pins, sleeves, standoffs...
function imHardwareBagModel(lower) {
      const K = imKit();
      if (/rusty bolt|\ba bolt\b/.test(lower)) {
        const shank = K.cyl(0.006, 0.006, 0.07, 0x7c3f1d, 0.0, 0.006, 0, { roughness: 1, metalness: 0.3 }); shank.rotation.z = Math.PI / 2;
        const head = K.cyl(0.011, 0.011, 0.007, 0x6b3518, -0.038, 0.011, 0, { roughness: 1, metalness: 0.3 }, 6); head.rotation.z = Math.PI / 2;
        return K.done(shank, head);
      }
      if (/consumables kit/.test(lower)) return imCartonModel(0.16, 0.05, 0.11, 0x1d4ed8, 0xf8fafc, [K2 => K2.many(new THREE.CylinderGeometry(0.006, 0.006, 0.02, 10), 0xc2702e, [[-0.03, 0.06, 0], [0, 0.06, 0], [0.03, 0.06, 0]], IM.chrome)]);
      const bag = K.rr(0.12, 0.16, 0.025, 0.01, 0xe0f2fe, 0, 0, 0, { transparent: true, opacity: 0.4, roughness: 0.15 }); bag.castShadow = false;
      const seal = K.box(0.12, 0.026, 0.006, 0x2563eb, 0, 0.013, -0.075);
      const col = /stainless|zinc|cadmium|an\d|ms\d/.test(lower) ? 0xc0c6cc : /brass|bronze/.test(lower) ? 0xc9a227 : /nylon|plastic/.test(lower) ? 0xf5f5f4 : 0x9aa3ad;
      const spots = [];
      for (let i = 0; i < 8; i++) spots.push([-0.04 + (i % 4) * 0.027, 0.012, -0.03 + Math.floor(i / 4) * 0.05]);
      let geo;
      if (/nuts?\b/.test(lower)) geo = new THREE.CylinderGeometry(0.007, 0.007, 0.006, 6);
      else if (/washers?|grommets?|rings?|isolators?/.test(lower)) geo = new THREE.TorusGeometry(0.007, 0.0025, 6, 12).rotateX(Math.PI / 2);
      else if (/pins?|rivets?|sleeves?|terminals?/.test(lower)) geo = new THREE.CylinderGeometry(0.0025, 0.0025, 0.02, 8).rotateZ(Math.PI / 2);
      else geo = new THREE.CylinderGeometry(0.003, 0.003, 0.035, 8).rotateZ(Math.PI / 2);
      const label = K.box(0.06, 0.001, 0.03, 0xf8fafc, 0.0, 0.026, 0.05, IM.paper);
      return K.done(bag, seal, K.many(geo, col, spots, IM.steel), label);
    }

// Hinges, brackets, joist hangers, ties, pad eyes, fittings: a few pressed-steel pieces
function imBracketModel(lower) {
      const K = imKit(), parts = [];
      const col = /brass/.test(lower) ? 0xc9a227 : /galvan|joist|hurricane|hanger|tie/.test(lower) ? 0xb6bcc4 : 0x8f98a3;
      const fin = { metalness: 0.85, roughness: 0.35 };
      const n = /s\b|\(pair\)|set/.test(lower) ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const z = i * 0.09;
        if (/hinge/.test(lower)) {
          const L = /strap/.test(lower) ? 0.2 : 0.075;
          parts.push(K.box(L, 0.002, 0.035, col, -L / 2 - 0.004, 0.001, z, fin), K.box(0.04, 0.002, 0.05, col, 0.024, 0.001, z, fin), K.cyl(0.004, 0.004, 0.05, col, 0, 0.004, z, fin));
          parts[parts.length - 1].rotation.x = Math.PI / 2;
        } else if (/hanger/.test(lower)) {
          parts.push(K.box(0.04, 0.13, 0.002, col, 0, 0.065, z - 0.02, fin), K.box(0.04, 0.002, 0.04, col, 0, 0.001, z, fin), K.box(0.002, 0.13, 0.04, col, 0.02, 0.065, z, fin), K.box(0.002, 0.13, 0.04, col, -0.02, 0.065, z, fin));
        } else if (/padeye|pad eye|eye ?bolt|shackle/.test(lower)) {
          parts.push(K.box(0.04, 0.003, 0.025, col, 0, 0.0015, z, fin), K.torus(0.008, 0.0025, col, 0, 0.012, z, fin, Math.PI));
        } else {
          parts.push(K.box(0.06, 0.002, 0.03, col, 0, 0.001, z, fin), K.box(0.002, 0.06, 0.03, col, -0.03, 0.03, z, fin));
        }
      }
      return K.done(...parts);
    }

function imMechPartModel(lower) {
      const K = imKit();
      const steel = { metalness: 0.85, roughness: 0.35 };
      if (/steering wheel/.test(lower)) {
        const rim = K.torus(0.13, 0.012, 0x111827, 0, 0.012, 0, IM.rubber); rim.rotation.x = Math.PI / 2;
        const hub = K.cyl(0.03, 0.03, 0.03, 0x52525b, 0, 0.015, 0, steel);
        return K.done(rim, hub, ...[0, 1, 2].map(i => { const a = i * Math.PI * 2 / 3 + Math.PI / 2; return K.rod([0, 0.015, 0], [Math.cos(a) * 0.13, 0.012, Math.sin(a) * 0.13], 0.008, 0x9ca3af, steel); }));
      }
      if (/sprocket|gear\b|pulley/.test(lower)) {
        const r = /60-?tooth|large/.test(lower) ? 0.12 : 0.05;
        const disc = K.cyl(r, r, 0.008, 0x52525b, 0, r, 0, steel, /pulley/.test(lower) ? 24 : 40); disc.rotation.x = Math.PI / 2;
        const teeth = /pulley/.test(lower) ? [] : [K.many(new THREE.BoxGeometry(0.008, 0.012, 0.008), 0x52525b, Array.from({ length: 30 }, (_, i) => [Math.cos(i / 30 * Math.PI * 2) * (r + 0.004), r + Math.sin(i / 30 * Math.PI * 2) * (r + 0.004), 0]), steel)];
        const hub = K.cyl(r * 0.3, r * 0.3, 0.03, 0x9ca3af, 0, r, 0, steel); hub.rotation.x = Math.PI / 2;
        return K.done(disc, ...teeth, hub);
      }
      if (/chain/.test(lower)) {
        const parts = [];
        for (let i = 0; i < 4; i++) { const l = K.torus(0.08 - i * 0.008, 0.005, 0x52525b, 0, 0.005 + i * 0.008, 0, steel); l.rotation.x = Math.PI / 2; parts.push(l); }
        return K.done(...parts);
      }
      if (/bearing/.test(lower)) {
        const outer = K.lathe([[0.02, 0], [0.026, 0], [0.026, 0.012], [0.02, 0.012]], 0xd1d5db, IM.chrome, 24);
        const inner = K.lathe([[0.008, 0], [0.013, 0], [0.013, 0.012], [0.008, 0.012]], 0xd1d5db, IM.chrome, 20);
        const seal = K.lathe([[0.013, 0.0115], [0.02, 0.0115], [0.02, 0.0118], [0.013, 0.0118]], 0x111827, IM.rubber, 24);
        return K.done(outer, inner, seal);
      }
      if (/brake disc|rotor/.test(lower)) {
        const d = K.lathe([[0.03, 0], [0.076, 0], [0.076, 0.005], [0.03, 0.005]], 0x9ca3af, steel, 32);
        return K.done(d, K.cyl(0.035, 0.035, 0.03, 0x52525b, 0, 0.015, 0, steel));
      }
      if (/brake pads/.test(lower)) {
        return K.done(...[0, 1].map(i => K.slab([[-0.06, 0], [0.06, 0], [0.05, 0.05], [-0.05, 0.05]], 0.015, i ? 0x52525b : 0x52525b, steel)).map((p, i) => { p.rotation.x = -Math.PI / 2; p.position.set(i * 0.13 - 0.065, 0.008, 0.025); return p; }));
      }
      if (/spark plug/.test(lower)) {
        const parts = [];
        [0, 1].forEach(i => { const x = i * 0.04; parts.push(K.cyl(0.006, 0.009, 0.045, 0xf5f5f4, x, 0.06, 0, IM.ceramic), K.cyl(0.011, 0.011, 0.014, 0xd1d5db, x, 0.03, 0, IM.chrome, 6), K.cyl(0.007, 0.007, 0.018, 0xb6bcc4, x, 0.012, 0, IM.steel)); });
        return K.done(...parts);
      }
      if (/oil filter|fuel filter|gascolator|filter cartridge/.test(lower)) {
        const many = /cartridges|set/.test(lower) ? 3 : 1, parts = [];
        for (let i = 0; i < many; i++) parts.push(K.cyl(0.038, 0.038, 0.09, /oil/.test(lower) ? 0x1d4ed8 : 0xf8fafc, i * 0.085, 0.045, 0, { roughness: 0.4, metalness: 0.3 }), K.cyl(0.03, 0.03, 0.004, 0x111827, i * 0.085, 0.092, 0));
        return K.done(...parts);
      }
      if (/spring/.test(lower)) {
        const pts = [];
        for (let i = 0; i <= 80; i++) { const a = i / 80 * Math.PI * 2 * 8; pts.push([Math.cos(a) * 0.012, 0.012 + Math.sin(a) * 0.012, -0.04 + i / 80 * 0.08]); }
        return K.done(K.tube(pts, 0.0015, 0x9ca3af, IM.steel));
      }
      if (/magnets?/.test(lower)) return K.done(K.many(new THREE.CylinderGeometry(0.01, 0.01, 0.004, 16), 0xa1a1aa, [0, 1, 2, 3, 4].map(i => [0, 0.002 + i * 0.004, 0]), IM.chrome));
      if (/axle|shaft|torque tube/.test(lower)) {
        const r = /1 in/.test(lower) ? 0.0127 : 0.0095;
        const s = K.cyl(r, r, 0.9, 0x9ca3af, 0, r, 0, IM.steel); s.rotation.z = Math.PI / 2;
        return K.done(s, K.box(0.08, 0.004, 0.005, 0x52525b, 0.4, r * 2, 0));
      }
      if (/radiator/.test(lower)) return K.done(K.box(0.4, 0.3, 0.04, 0x27272a, 0, 0.15, 0, IM.alu), K.cyl(0.015, 0.015, 0.05, 0x27272a, 0.15, 0.3, 0, IM.alu));
      if (/exhaust|muffler|pipe/.test(lower)) {
        const pipe = K.tube([[-0.3, 0.05, 0], [0, 0.06, 0], [0.15, 0.1, 0.0]], 0.022, 0x6b7280, steel);
        const can = K.cyl(0.05, 0.05, 0.25, 0x6b7280, 0.28, 0.1, 0, steel); can.rotation.z = Math.PI / 2;
        return K.done(pipe, can);
      }
      if (/strut|tube|spar|spindle/.test(lower)) return imPipesModel(lower.includes('alumin') ? 'aluminium pipe' : 'steel pipe');
      // a machined block or fitting
      return K.done(K.box(0.08, 0.03, 0.05, 0xb6bcc4, 0, 0.015, 0, steel), K.cyl(0.006, 0.006, 0.031, 0x52525b, 0.02, 0.016, 0));
    }

// Small electronic parts on their backing card: switches, pots, pickups, receivers, antennas...
function imComponentModel(lower) {
      const K = imKit();
      const card = K.box(0.1, 0.002, 0.13, 0xf8fafc, 0, 0.001, 0, IM.paper);
      const parts = [card];
      if (/clip-on tuner/.test(lower)) parts.push(K.rr(0.05, 0.035, 0.015, 0.008, 0x111827, 0, 0.002, -0.02, IM.plastic), K.box(0.035, 0.001, 0.022, 0x22c55e, 0, 0.0175, -0.02, IM.screen), K.box(0.015, 0.012, 0.05, 0x111827, 0, 0.008, 0.025, IM.plastic));
      else if (/speaker driver/.test(lower)) { parts.length = 0; const cone = K.lathe([[0.02, 0.01], [0.07, 0.045], [0.08, 0.05], [0.08, 0.055], [0.068, 0.05]], 0x111827, { roughness: 0.9, side: THREE.DoubleSide }); const magnet = K.cyl(0.035, 0.035, 0.025, 0x52525b, 0, 0.0125, 0, IM.steel); const frame = K.torus(0.082, 0.004, 0x9ca3af, 0, 0.054, 0, IM.alu); frame.rotation.x = Math.PI / 2; parts.push(cone, magnet, frame); }
      else if (/clock movement/.test(lower)) { parts.length = 0; parts.push(K.box(0.056, 0.016, 0.056, 0x111827, 0, 0.008, 0, IM.plastic), K.cyl(0.004, 0.004, 0.02, 0xc9a227, 0, 0.026, 0, IM.steel), K.box(0.003, 0.001, 0.05, 0x111827, 0, 0.033, -0.02), K.box(0.002, 0.001, 0.07, 0x111827, 0, 0.034, -0.03), K.cyl(0.008, 0.008, 0.004, 0xd1d5db, 0, 0.018, 0.02, IM.steel)); }
      else if (/potentiometer|pot\b|knob/.test(lower)) [-0.025, 0.025].forEach(x => parts.push(K.cyl(0.012, 0.012, 0.01, 0x9ca3af, x, 0.007, 0, IM.alu), K.cyl(0.003, 0.003, 0.02, 0xc9a227, x, 0.02, 0, IM.steel)));
      else if (/pickups?/.test(lower)) [-0.025, 0.025].forEach(x => parts.push(K.rr(0.02, 0.085, 0.018, 0.009, 0xf8fafc, x, 0.002, 0, IM.plastic)));
      else if (/switch/.test(lower)) parts.push(K.box(0.03, 0.015, 0.05, 0x111827, 0, 0.0095, 0, IM.plastic), K.box(0.006, 0.02, 0.006, 0xd1d5db, 0, 0.025, 0, IM.chrome));
      else if (/antenna/.test(lower)) parts.push(K.cyl(0.004, 0.004, 0.05, 0x111827, 0, 0.006, 0, IM.plastic), K.ball(0.012, 0x111827, 0, 0.006, -0.03));
      else if (/tuners?/.test(lower)) for (let i = 0; i < 6; i++) parts.push(K.cyl(0.006, 0.006, 0.012, 0xd1d5db, -0.04 + (i % 3) * 0.04, 0.008, i < 3 ? -0.03 : 0.03, IM.chrome), K.box(0.018, 0.004, 0.012, 0xd1d5db, -0.04 + (i % 3) * 0.04, 0.008, (i < 3 ? -0.03 : 0.03) + 0.02, IM.chrome));
      else if (/strings/.test(lower)) parts.push(K.box(0.1, 0.008, 0.13, 0x111827, 0, 0.004, 0, IM.paper), K.box(0.06, 0.001, 0.03, 0xc9a227, 0, 0.0085, 0));
      else if (/inlays|dots/.test(lower)) parts.push(K.many(new THREE.CylinderGeometry(0.0032, 0.0032, 0.001, 12), 0xf8fafc, [0, 1, 2, 3, 4].map(i => [-0.03 + i * 0.015, 0.0025, 0]), { roughness: 0.2, metalness: 0.4 }));
      else if (/goggles|camera|video transmitter|vtx/.test(lower)) parts.push(K.box(0.035, 0.008, 0.035, 0x111827, 0, 0.006, 0, IM.plastic), K.cyl(0.003, 0.003, 0.03, 0x111827, 0.015, 0.006, 0.03, IM.plastic));
      else parts.push(K.box(0.03, 0.004, 0.03, 0x166534, 0, 0.004, 0), K.box(0.012, 0.002, 0.012, 0x111827, 0, 0.0065, 0));
      return K.done(...parts);
    }

function imFuelContainerModel(lower) {
      const K = imKit();
      if (/drum|barrel|200 ?l|55.?gal/.test(lower)) {
        const col = /bitumen|asphalt|tar\b/.test(lower) ? 0x111827 : /jet|kerosene/.test(lower) ? 0x1d4ed8 : /diesel/.test(lower) ? 0xfacc15 : /admixture|chemical/.test(lower) ? 0x2563eb : /solvent|washer/.test(lower) ? 0xdc2626 : 0x15803d;
        const drum = K.cyl(0.29, 0.29, 0.88, col, 0, 0.44, 0, { roughness: 0.4, metalness: 0.4 }, 28);
        const ribs = [0.29, 0.59].map(y => K.torus(0.292, 0.008, col, 0, y, 0, { metalness: 0.4 })); ribs.forEach(r => (r.rotation.x = Math.PI / 2));
        const lid = K.cyl(0.27, 0.27, 0.004, col, 0, 0.881, 0);
        const bung = K.cyl(0.025, 0.025, 0.012, 0xd1d5db, 0.17, 0.885, 0, IM.steel);
        return K.done(drum, ...ribs, lid, bung);
      }
      if (/propane tank|propane bottle|bbq tank/.test(lower)) {
        const body = K.lathe([[0, 0.04], [0.15, 0.06], [0.155, 0.35], [0.1, 0.44], [0, 0.45]], 0xf8fafc, { roughness: 0.3, metalness: 0.4 });
        const foot = K.cyl(0.13, 0.13, 0.05, 0xf8fafc, 0, 0.025, 0, IM.steel);
        const collar = K.cyl(0.09, 0.09, 0.1, 0xf8fafc, 0, 0.5, 0, { ...IM.steel, side: THREE.DoubleSide });
        return K.done(body, foot, collar, K.cyl(0.02, 0.02, 0.05, 0xc9a227, 0, 0.47, 0, IM.steel));
      }
      // a jerry can (red for gasoline, yellow for diesel, blue for kerosene)
      const col = /diesel/.test(lower) ? 0xeab308 : /kerosene|water/.test(lower) ? 0x1d4ed8 : /oil|mix/.test(lower) ? 0x15803d : 0xdc2626;
      const body = K.rr(0.34, 0.17, 0.46, 0.03, col, 0, 0, 0, { roughness: 0.4 });
      const ridge = K.box(0.25, 0.3, 0.004, col, -0.02, 0.22, 0.087, { roughness: 0.4 });
      const handle = K.box(0.16, 0.04, 0.03, col, -0.05, 0.48, 0, { roughness: 0.4 });
      const spout = K.cyl(0.02, 0.025, 0.05, 0x111827, 0.13, 0.48, 0, IM.plastic); spout.rotation.z = -0.5;
      return K.done(body, ridge, handle, spout);
    }

// A delivered bulk load (gravel, crushed stone, aggregate): a heap the size its tonnage makes
function imBulkPileModel(lower) {
      const K = imKit();
      const t = Number((lower.match(/(\d+(?:\.\d+)?)\s*t\b/) || [])[1]) || 5;
      const r = Math.cbrt(t / 1.6 / 0.733), h = r * 0.7;
      const col = /dust|fine|sand/.test(lower) ? 0xb8ada0 : /topsoil|soil/.test(lower) ? 0x4a3527 : /asphalt/.test(lower) ? 0x27272a : 0x9a958c;
      const geo = new THREE.ConeGeometry(r, h, 28, 6);
      const p = geo.attributes.position, rnd = seededRandom(Math.round(t * 100));
      for (let i = 0; i < p.count; i++) { if (p.getY(i) > h / 2 - 1e-3 || p.getY(i) < -h / 2 + 1e-3) continue; const k = 1 + (rnd() - 0.5) * 0.12; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
      geo.computeVertexNormals();
      const heap = new THREE.Mesh(geo, K.mat(col, { roughness: 1 })); heap.position.y = h / 2; heap.castShadow = true;
      return K.done(heap);
    }

// --- Art supplies ------------------------------------------------------------------------------
function imArtSupplyModel(lower) {
      const K = imKit();
      if (/easel/.test(lower)) {
        const field = /field|french|portable|box/.test(lower), H = field ? 1.6 : 1.8, wood = 0xc8955a;
        const parts = [-1, 1].map(s => K.rod([s * 0.32, 0, 0.18], [s * 0.05, H, 0], 0.016, wood, IM.wood));
        parts.push(K.rod([0, 0, -0.45], [0, H * 0.85, 0], 0.016, wood, IM.wood));
        parts.push(K.box(0.6, 0.03, 0.06, wood, 0, H * 0.45, 0.1, IM.wood));
        if (field) parts.push(K.box(0.48, 0.1, 0.32, wood, 0, H * 0.42, 0.0, IM.wood));
        parts.push(K.box(0.05, 0.05, 0.05, wood, 0, H * 0.95, 0.02, IM.wood));
        return K.done(...parts);
      }
      if (/canvas/.test(lower)) {
        const n = Number((lower.match(/(\d+)\s*(stretched )?canvas/) || [])[1]) || 1;
        const [w, h] = (lower.match(/(\d+)\s*x\s*(\d+)\s*in/) || [0, 12, 9]).slice(1).map(v => Number(v) * 0.0254);
        const parts = [];
        for (let i = 0; i < Math.min(n, 4); i++) parts.push(K.box(w, h, 0.02, 0xfafaf9, i * 0.01, h / 2, -i * 0.025, IM.cloth), K.box(w - 0.01, h - 0.01, 0.018, 0xd6b38a, i * 0.01, h / 2, -i * 0.025 - 0.002, IM.wood));
        const g = group(...parts); g.rotation.x = -0.1;
        return K.done(at(g, 0, 0.0, 0.05));
      }
      if (/\b(pad|block|ream|sheets)\b|paper|sketchbook/.test(lower)) {
        const tint = /tinted|pastel/.test(lower) ? 0xc7b8a3 : /rice|xuan/.test(lower) ? 0xf5f0e1 : 0xfafaf9;
        const big = /ream/.test(lower);
        const pad = K.box(big ? 0.28 : 0.3, big ? 0.05 : 0.012, big ? 0.22 : 0.23, tint, 0, big ? 0.025 : 0.006, 0, IM.paper);
        const cover = K.box(0.3, 0.002, 0.23, /hot-press|gouache/.test(lower) ? 0x1e3a8a : 0x334155, 0, 0.013, 0, IM.paper);
        const spine = K.box(0.3, 0.014, 0.02, 0x111827, 0, 0.007, -0.105, IM.paper);
        return big ? K.done(pad, K.box(0.282, 0.02, 0.222, 0xf97316, 0, 0.04, 0, IM.paper)) : K.done(pad, cover, spine);
      }
      if (/pastels|crayons|charcoal|pencils/.test(lower)) {
        const tin = K.rr(0.22, 0.13, 0.02, 0.008, 0x1f2937, 0, 0, 0, IM.alu);
        const cols = [0xdc2626, 0xf97316, 0xfacc15, 0x16a34a, 0x0ea5e9, 0x1d4ed8, 0x7c3aed, 0xdb2777, 0x92400e, 0x111827, 0xf8fafc, 0x65a30d];
        const sticks = cols.map((c, i) => { const s = K.cyl(0.0055, 0.0055, 0.06, c, -0.09 + i * 0.0165, 0.025, 0, { roughness: 1 }); s.rotation.x = Math.PI / 2; return s; });
        return K.done(tin, ...sticks);
      }
      if (/palette/.test(lower)) {
        if (/stay-?wet/.test(lower)) return K.done(K.rr(0.3, 0.22, 0.03, 0.02, 0x0e7490, 0, 0, 0, IM.plastic), K.box(0.28, 0.002, 0.2, 0xf5f5f4, 0, 0.031, 0, IM.paper));
        const board = K.slab([[-0.15, -0.1], [0.12, -0.12], [0.18, 0.02], [0.08, 0.12], [-0.14, 0.1]], 0.006, 0xc8955a, IM.wood); board.rotation.x = -Math.PI / 2; board.position.y = 0.003;
        const dabs = [0xdc2626, 0xfacc15, 0x1d4ed8, 0xf8fafc, 0x16a34a].map((c, i) => { const d = K.ball(0.012, c, -0.1 + i * 0.05, 0.007, -0.06 + (i % 2) * 0.02, { roughness: 0.3 }); d.scale.y = 0.3; return d; });
        return K.done(board, ...dabs);
      }
      if (/eraser|stumps|tortillon/.test(lower)) {
        if (/stump|tortillon/.test(lower)) return K.done(...[0, 1, 2].map(i => { const s = K.cyl(0.004 + i * 0.002, 0.004 + i * 0.002, 0.13, 0xe7e0d0, i * 0.02, 0.006, 0, IM.paper); s.rotation.x = Math.PI / 2; return s; }));
        const e = K.ball(0.025, 0x9ca3af, 0, 0.012, 0, { roughness: 1 }); e.scale.set(1.4, 0.5, 1);
        return K.done(e);
      }
      if (/brush/.test(lower)) {
        const jar = K.cyl(0.04, 0.04, 0.1, 0xdbeafe, 0, 0.05, 0, IM.glass); jar.castShadow = false;
        const parts = [jar];
        for (let i = 0; i < 5; i++) { const a = i * 1.26, x = Math.cos(a) * 0.015, z = Math.sin(a) * 0.015; parts.push(K.rod([x, 0.02, z], [x * 3, 0.24, z * 3], 0.004, i % 2 ? 0xb91c1c : 0x111827, IM.plastic), K.cyl(0.003, 0.004, 0.02, 0xd1d5db, x * 3.2, 0.255, z * 3.2, IM.chrome)); }
        return K.done(...parts);
      }
      // a box of paints: tubes laid in a tin, or a watercolour pan set
      if (/watercolou?r|pan/.test(lower)) {
        const tin = K.rr(0.2, 0.1, 0.018, 0.008, 0x111827, 0, 0, 0, IM.alu);
        const cols = [0xdc2626, 0xf97316, 0xfacc15, 0x16a34a, 0x0ea5e9, 0x1d4ed8, 0x7c3aed, 0x92400e, 0x111827, 0xdb2777, 0x65a30d, 0xb45309];
        return K.done(tin, ...cols.map((c, i) => K.box(0.026, 0.006, 0.018, c, -0.075 + (i % 6) * 0.03, 0.02, (i < 6 ? -0.02 : 0.02), { roughness: 0.4 })));
      }
      const cols = [0xdc2626, 0xfacc15, 0x1d4ed8, 0xf8fafc, 0x16a34a, 0x111827];
      const box = K.box(0.2, 0.025, 0.14, 0x7f1d1d, 0, 0.0125, 0, IM.paper);
      return K.done(box, ...cols.map((c, i) => { const t = K.cyl(0.011, 0.011, 0.1, 0xd1d5db, -0.075 + i * 0.03, 0.035, 0, IM.alu); t.rotation.x = Math.PI / 2; const cap = K.cyl(0.0115, 0.0115, 0.04, c, -0.075 + i * 0.03, 0.035, 0.02, IM.plastic); cap.rotation.x = Math.PI / 2; return group(t, cap); }));
    }

function imAerosolModel(lower) {
      const K = imKit();
      const col = /brake cleaner/.test(lower) ? 0xdc2626 : /fixative/.test(lower) ? 0x1f2937 : /primer/.test(lower) ? 0x9ca3af : /lubricant|wd-?40/.test(lower) ? 0x1d4ed8 : 0x16a34a;
      const can = K.cyl(0.033, 0.033, 0.2, col, 0, 0.1, 0, { roughness: 0.3, metalness: 0.5 });
      const shoulder = K.cyl(0.02, 0.033, 0.025, 0xd1d5db, 0, 0.2125, 0, IM.chrome);
      const cap = K.cyl(0.03, 0.031, 0.045, /fixative/.test(lower) ? 0xf8fafc : 0xf8fafc, 0, 0.245, 0, IM.plastic);
      const label = K.cyl(0.0333, 0.0333, 0.08, 0xf8fafc, 0, 0.1, 0, IM.paper);
      return K.done(can, shoulder, cap, label);
    }

// --- Outdoor finds and odds and ends -----------------------------------------------------------
function imStoneModel(lower) {
      const K = imKit();
      const mica = /mica/.test(lower), river = /river|smooth|pebble/.test(lower);
      const r = /pebble/.test(lower) ? 0.02 : mica ? 0.035 : 0.05;
      const geo = river ? new THREE.SphereGeometry(r, 18, 12) : new THREE.DodecahedronGeometry(r, 1);
      const rock = new THREE.Mesh(geo, K.mat(mica ? 0x8a7f6a : /pebble/.test(lower) ? 0x6b7280 : 0x57534e, mica ? { metalness: 0.6, roughness: 0.25, flatShading: true } : river ? { roughness: 0.45 } : { roughness: 0.9, flatShading: true }));
      rock.scale.set(1.3, river ? 0.55 : 0.75, 1);
      rock.position.y = r * (river ? 0.55 : 0.75);
      rock.castShadow = true;
      return K.done(rock);
    }

function imCapsuleModel() {
      const K = imKit();
      const body = K.cyl(0.08, 0.08, 0.3, 0x6b7280, 0, 0.08, 0, { metalness: 0.7, roughness: 0.6 }); body.rotation.z = Math.PI / 2;
      const caps = [-1, 1].map(s => { const c = K.cyl(0.085, 0.085, 0.04, 0x52525b, s * 0.15, 0.08, 0, IM.iron); c.rotation.z = Math.PI / 2; return c; });
      const rust = K.cyl(0.0805, 0.0805, 0.1, 0x8b4513, -0.04, 0.08, 0, { roughness: 1 }); rust.rotation.z = Math.PI / 2;
      return K.done(body, ...caps, rust);
    }

function imInstrumentModel(lower) {
      const K = imKit();
      if (/infrared thermometer|ir thermometer|temperature gun/.test(lower)) {
        const head = K.rr(0.05, 0.13, 0.05, 0.015, 0xdc2626, 0, 0.12, 0, IM.plastic);
        const grip = K.box(0.035, 0.12, 0.04, 0x111827, 0, 0.07, -0.04, IM.rubber); grip.rotation.x = 0.25;
        const lens = K.cyl(0.014, 0.014, 0.004, 0x111827, 0, 0.145, 0.066); lens.rotation.x = Math.PI / 2;
        return K.done(head, grip, lens);
      }
      if (/slump cone/.test(lower)) {
        const cone = K.lathe([[0.1, 0], [0.104, 0], [0.054, 0.3], [0.05, 0.3]], 0xa1a1aa, { ...IM.alu, side: THREE.DoubleSide }, 28);
        const plate = K.box(0.5, 0.005, 0.5, 0x6b7280, 0, 0.0025, 0, IM.steel);
        const rodp = K.rod([-0.2, 0.012, 0.2], [0.35, 0.012, 0.15], 0.008, 0xd1d5db, IM.chrome);
        const handles = [-1, 1].map(s => K.torus(0.02, 0.004, 0xa1a1aa, s * 0.08, 0.2, 0, IM.alu, Math.PI));
        return K.done(cone, plate, rodp, ...handles);
      }
      if (/spectrometer|spectroscope/.test(lower)) {
        const tube = K.cyl(0.012, 0.012, 0.11, 0x111827, 0, 0.012, 0, IM.alu); tube.rotation.z = Math.PI / 2;
        const slit = K.cyl(0.013, 0.013, 0.01, 0xd1d5db, -0.06, 0.012, 0, IM.chrome); slit.rotation.z = Math.PI / 2;
        return K.done(tube, slit);
      }
      if (/gas meter|meter/.test(lower)) {
        const box = K.rr(0.24, 0.16, 0.26, 0.02, 0x9ca3af, 0, 0, 0, IM.alu);
        const dials = K.box(0.12, 0.05, 0.002, 0xf8fafc, 0, 0.18, 0.081, IM.paper);
        const pipes = [-1, 1].map(s => K.cyl(0.015, 0.015, 0.08, 0xc9a227, s * 0.07, 0.29, 0, IM.steel));
        return K.done(box, dials, ...pipes);
      }
      return imMultimeterModel();
    }

// Runway and airfield gear
function imAirfieldModel(lower) {
      const K = imKit();
      if (/windsock/.test(lower)) {
        const H = /18 ft/.test(lower) ? 5.5 : 4;
        const mast = K.cyl(0.04, 0.05, H, 0xf8fafc, 0, H / 2, 0, IM.steel);
        const ring = K.torus(0.22, 0.012, 0xd1d5db, 0.05, H - 0.1, 0, IM.steel); ring.rotation.y = Math.PI / 2;
        const sock = K.lathe([[0.22, 0], [0.1, 1.5], [0.0, 1.5]], 0xf97316, { roughness: 0.9, side: THREE.DoubleSide }, 20);
        sock.rotation.z = -Math.PI / 2 + 0.25; sock.position.set(0.05, H - 0.1, 0);
        const stripes = [0.3, 0.9].map(f => { const s = K.torus(0.22 - f * 0.08, 0.06, 0xf8fafc, 0.05 + f * 1.45, H - 0.1 - f * 0.37, 0, IM.cloth); s.rotation.y = Math.PI / 2; s.rotation.x = 0.25; return s; });
        const lamp = K.cyl(0.05, 0.05, 0.08, 0xfacc15, 0, H + 0.04, 0, { emissive: 0xfacc15, emissiveIntensity: 0.3 });
        return K.done(mast, ring, sock, lamp);
      }
      if (/sign/.test(lower)) {
        const box = K.box(1.2, 0.45, 0.2, 0x111827, 0, 0.55, 0, IM.plastic);
        const face = K.box(1.12, 0.37, 0.002, 0xfacc15, 0, 0.55, 0.101, { emissive: 0xfacc15, emissiveIntensity: 0.15 });
        const text = K.box(0.4, 0.2, 0.001, 0x111827, 0, 0.55, 0.103);
        const legs = [-0.45, 0.45].map(x => K.cyl(0.02, 0.025, 0.33, 0xf97316, x, 0.165, 0, IM.steel));
        return K.done(box, face, text, ...legs);
      }
      // an elevated runway edge light: a frangible stake with a glass globe
      const col = /blue/.test(lower) ? 0x3b82f6 : /green/.test(lower) ? 0x22c55e : /red/.test(lower) ? 0xef4444 : 0xfef9c3;
      const stake = K.cyl(0.025, 0.03, 0.3, 0xfacc15, 0, 0.15, 0, IM.steel);
      const base = K.cyl(0.07, 0.07, 0.03, 0x52525b, 0, 0.015, 0, IM.iron);
      const globe = K.lathe([[0.04, 0.3], [0.05, 0.34], [0.04, 0.39], [0, 0.41]], col, { transparent: true, opacity: 0.75, emissive: col, emissiveIntensity: 0.25, roughness: 0.1 });
      return K.done(stake, base, globe);
    }

function imWindChimeModel() {
      const K = imKit();
      const top = K.cyl(0.07, 0.07, 0.015, 0xc8955a, 0, 0.6, 0, IM.wood);
      const tubes = [0, 1, 2, 3, 4].map(i => { const a = i / 5 * Math.PI * 2, L = 0.22 + i * 0.04; return K.cyl(0.008, 0.008, L, 0xd1d5db, Math.cos(a) * 0.05, 0.52 - L / 2, Math.sin(a) * 0.05, IM.chrome); });
      const strings = [0, 1, 2, 3, 4].map(i => { const a = i / 5 * Math.PI * 2; return K.rod([Math.cos(a) * 0.05, 0.6, Math.sin(a) * 0.05], [Math.cos(a) * 0.05, 0.52, Math.sin(a) * 0.05], 0.0008, 0x111827); });
      const striker = K.cyl(0.03, 0.03, 0.008, 0xc8955a, 0, 0.28, 0, IM.wood);
      const sail = K.box(0.06, 0.1, 0.004, 0xc8955a, 0, 0.12, 0, IM.wood);
      const line = K.rod([0, 0.6, 0], [0, 0.17, 0], 0.0008, 0x111827);
      const hook = K.torus(0.015, 0.003, 0xd1d5db, 0, 0.63, 0, IM.steel);
      return K.done(top, ...tubes, ...strings, striker, sail, line, hook);
    }

function imCrateModel(lower) {
      // A wooden parts crate (a parts kit or a delivery of many lines)
      const K = imKit(), parts = [];
      const W = 0.8, H = 0.5, D = 0.6, wood = 0xd6b38a;
      for (let i = 0; i < 4; i++) {
        const y = 0.06 + i * 0.12;
        parts.push(K.box(W, 0.1, 0.02, wood, 0, y, D / 2, IM.wood), K.box(W, 0.1, 0.02, wood, 0, y, -D / 2, IM.wood), K.box(0.02, 0.1, D, wood, W / 2, y, 0, IM.wood), K.box(0.02, 0.1, D, wood, -W / 2, y, 0, IM.wood));
      }
      [-1, 1].forEach(sx => [-1, 1].forEach(sz => parts.push(K.box(0.05, H, 0.05, 0xb7793e, sx * (W / 2 - 0.02), H / 2, sz * (D / 2 - 0.02), IM.wood))));
      parts.push(K.box(W, 0.02, D, wood, 0, H, 0, IM.wood));
      parts.push(K.box(0.25, 0.15, 0.002, 0xf8fafc, 0, 0.28, D / 2 + 0.012, IM.paper));
      if (/road|runway/.test(lower)) parts.push(K.box(0.08, 0.08, 0.003, 0xf97316, 0.25, 0.28, D / 2 + 0.012));
      return K.done(...parts);
    }

// --- Which model a name gets ------------------------------------------------------------------
// Checked in order, before the general rules in items3d.js. Kept away from vehicles' names (they
// park outside with their own models) and from the specific makers' rules other files add first.
const IM_RULES = [
  // things he makes or gets delivered by the line
  [/^roadwork kit|^runway kit|parts crate|^crate of/, l => imCrateModel(l)],
  [/binder-jetted|-printed\b|-sintered|-machined|-milled|-routed|laser-cut (?!.*(sign|coaster|stencil|plaque))/, l => (typeof madePartModel === 'function' ? realSize(madePartModel(l)) : imCartonModel(0.1, 0.06, 0.08, 0xd6b38a, 0xf8fafc))],
  [/smelting furnace|melting furnace|\bkiln\b|\bforge\b(?!d)/, l => imFurnaceModel(l)],
  [/rock splitter|plug and feathers|feathers and wedges/, () => imBase('jackhammer', 0.9)],
  [/screed|bull float|darby|concrete float|hand float|concrete edger|groover/, l => imConcreteToolModel(l)],
  [/push sticks?|push block/, () => imPushBlockModel()],
  [/socket (and wrench )?set|wrench set|spanner set|hex (drivers|keys)|allen (keys|wrenches)|screwdriver set|ratchet set/, l => imHandToolSetModel('socket set')],
  [/service kit|repair kit|tune.?up kit|rebuild kit|maintenance kit/, () => imHardwareBagModel('consumables kit')],
  [/culvert/, l => imPipesModel(l)],
  [/runway (edge |threshold )?light|threshold (and end )?light|end light|taxiway light|edge light|windsock|runway designation sign|taxiway sign|lighted .*sign/, l => imAirfieldModel(l)],
  [/(\d+(\.\d+)?\s*t\b.*\bload\b|\bload of\b).*(gravel|stone|aggregate|crusher dust|sand|topsoil|fill|rock)|^(an? )?load of (crushed )?gravel/, l => imBulkPileModel(l)],
  [/(drum|barrel) of|jerry ?can|gas can|fuel can|can of (gasoline|diesel|gas|fuel|kerosene)|propane tank|propane bottle|tanker of|bitumen|\b(200|205) ?l\b|55.?gal|gasoline|unleaded|\bdiesel\b|kerosene|jet fuel|\bfuel\b(?! (pump|hose|filter|shutoff|sight|system|valve|gauge|line|tank cap))/, l => imFuelContainerModel(l)],
  [/\btyres?\b|\btires?\b(?! chains)|caster wheels?|main wheels|tailwheel|wheels? with|on rims/, l => imTyreModel(l)],
  [/altimeter|tachometer|airspeed indicator|slip indicator|\b(temperature|pressure|fuel|oil|egt|sight|vacuum|tire|tyre|air) gauges?\b/, l => imGaugeModel(l)],
  [/sprocket|roller chain|\bchain\b(?!saw| guard)|bearings?|brake disc|brake pads?|spark plugs?|oil filter|fuel filter|gascolator|filter cartridges?|\bsprings?\b(?!\s*clamps?)|magnets?\b|\baxles?\b|steering shaft|torque tube|radiator|exhaust|muffler|kingpin|spindles|machined|\bhubs?\b|pulleys?|mixer paddles|paddles and liners/, l => imMechPartModel(l)],
  [/garden hose|water hose|\bhose\b(?!.*(clamp|fitting))|brake line|fuel line/, l => imHoseModel(l)],
  [/spray ?paint|aerosol|brake cleaner|fixative|wd-?40|spray (can|primer|lubricant)/, l => imAerosolModel(l)],
  [/\b(5 ?gal(lon)?|pail|bucket) of\b/, l => imPaintCanModel(l + ' pail')],
  [/^(?!.*charger).*(\b(aa|aaa|9 ?v|c|d)( size)? batter(y|ies)\b|\bbatteries\b|battery pack|lipo|car battery|\bbattery\b(?!.*(powered|operated)))/, l => imBatteryModel(l)],
  [/clip-?on tuner|strobe (or clip-on )?tuner/, l => imComponentModel('clip-on tuner')],
  [/cartridge/, l => imCartridgeModel(l)],
  [/(acrylic|wooden|routed|laser-cut|metal|hand-?painted) (sign|plaque)|\bsign\b(?!.*(runway|taxiway))/, l => imSignModel(l)],
  [/coaster/, l => imCoasterModel(l)],
  [/dovetail(ed)?.*\bbox\b|wooden box|keepsake box|jewe?l(le)?ry box|trinket box/, l => imWoodBoxModel(l)],
  [/bagel|doughnut|\bdonut\b/, l => imBagelModel(l)],
  [/^(?!.*(jump|skipping|power|extension|electric|charging|usb)).*(bungee|shock cord|paracord|lacing cord|\bcord\b(?!less)|twine|climbing rope|\brope\b)/, l => imRopeCoilModel(l)],
  [/bar of .*solder|solder bar/, () => imBase('ingot', 0.2)],
  [/component reels|smd reels|reels? of (smd|components)/, l => imSpoolModel('smd reel')],
  [/vacuum (table )?pump/, () => imBenchMachineModel('air compressor')],
  [/consumables kit|rusty bolt|\ba bolt\b/, l => imHardwareBagModel(l)],
  [/steering wheel/, l => imMechPartModel(l)],
  [/\b(pears?|tomato(es)?|oranges?|lemons?|limes?|plums?|mangoes?|nectarines?|onions?|potato(es)?|bell peppers?)\b(?!.*(pie|tart|jam|juice|sauce|soup))/, l => imProduceModel(l)],
  [/easel|stretched canvas|canvas(es| panels?| boards?)|\b(drawing|sketch|watercolou?r|gouache|pastel|rice|xuan|bristol|tinted) (paper|pad|block)|\bpad of\b|ream of|soft pastels|box of pastels|\bpastels\b|crayons|charcoal sticks|drawing pencils|sketching pencils|palette|kneaded eraser|\beraser\b|blending stumps|tortillons|paint ?brush(es)?|brush set|brushes\b|watercolou?r (set|paints|pans)|paint set|oil paints|acrylic paints|gouache (set|paints)|tubes of paint/, l => imArtSupplyModel(l)],
  [/aquarium|fish ?tank|tank of .*(fish|jellyfish|guppies|shrimp)/, l => imAquariumModel(l)],
  [/multi-?tool|leatherman|swiss army knife|pocket knife|pen ?knife/, l => imMultitoolModel(l)],
  [/^(?!.*(weld|plasma|propane|blow ?torch)).*(head ?lamp|head torch|flashlight|\btorch\b|lantern|lamp socket|light socket|bulb socket|lamp holder)/, l => imLightModel(l)],
  [/(flask|tub|jar|bottle|canister|can|drum|pail) of .*powder|metal powder|stainless powder|ti-?6al-?4v|17-4 ?ph|316l powder|in718 powder/, l => imContainerModel(l + ' powder')],
  [/^(an? )?(jar|bottle|flask|tub|tin|vial) of\b|solder paste|\bink\b(?! cartridge)|sumi ink/, l => imContainerModel(l)],
  [/knife blades|blade pack|utility blades|scalpel blades|razor blades|spare blades/, () => imCartonModel(0.1, 0.012, 0.025, 0xdc2626, 0xf8fafc)],
  [/(block|billet|bar|slab|chunk) of .*(aluminium|aluminum|steel|brass|bronze|copper|titanium|delrin|acetal|metal)|\b(round|flat|hex|square) (bar|stock)\b|bar stock|billet/, l => imMetalStockModel(l)],
  [/propeller|impeller/, l => (typeof madePartModel === 'function' ? realSize(madePartModel(l)) : imMechPartModel('pulley'))],
  [/bottle caps?|crown caps?/, () => imBottleCapModel()],
  [/shards of|broken glass|cracked glass|glass shards|glass piece/, () => imGlassShardsModel()],
  [/paperweight/, () => imPaperweightModel()],
  [/\b(turned|carved|wooden|walnut|cherry|maple|oak|olive ?wood) .*\bbowl\b(?! blank)/, () => (typeof madeWoodBowlModel === 'function' ? madeWoodBowlModel() : imMixingBowlModel('wooden bowl'))],
  [/bowl blank|turning blank|pen blanks?|\bwood blank/, l => imWoodBlankModel(l)],
  [/trailer hitch|tow hitch|hitch ball|ball mount|hitch receiver/, () => imHitchModel()],
  [/camera film|roll of film|film roll|\b35 ?mm film|\b(120|instant) film/, () => imFilmModel()],
  [/filter bags?|baghouse/, () => imFilterBagsModel()],
  [/fossil|trilobite|ammonite|petrified|dinosaur (bone|rib|tooth|fossil)|rib bone|\bbones?\b|arrowhead|\bcoins?\b|nuggets?|meteorite|obsidian/, l => imFindModel(l)],
  [/pliers|wire strippers|wire cutters|side cutters|snips|crimpers?|crimping tool|swaging tool|nicopress tool/, () => realSize(pliersModel())],
  [/fabric iron|clothes iron|steam iron|^(?!.*(cast|wrought|soldering|golf|tyre|tire|skillet|\bpan\b|\bore\b|pipe|filings|\brod|\bbar\b|angle|flat|corrugated|sheet|fence|gate|waffle|curling|flat ?iron)).*\biron\b/, () => imIronModel()],
  [/drill press/, () => imDrillPressModel()],
  [/weighing scales?|\bscales\b(?! (model|insect))|bathroom scale|kitchen scale|luggage scale/, l => imScalesModel(l)],
  [/table saw|chop saw|mitre saw|miter saw|cut-?off saw|scroll saw/, l => imSawMachineModel(l)],
  [/(block|hand|jack|smoothing|bench|rabbet|shoulder) plane\b/, () => imHandPlaneModel()],
  [/footstool|foot stool|step stool(?!.*ladder)/, l => (typeof stoolModel === 'function' ? stoolModel('low ' + l) : imFurnitureModel('side table'))],
  [/tube notcher|pipe notcher/, () => imBenchMachineModel('bench vise')],
  [/gaskets?|o-rings?/, () => imGasketModel()],
  [/(case|box|pack) of .*(spray|marking|inverted)|marking paint|inverted marking/, l => imAerosolModel(l)],
  // kitchen
  [/\b(skillet|frying pan|fry ?pan|saut[eé] pan|wok|griddle pan|crepe pan)\b/, l => imPanModel(l)],
  [/sauce ?pan|stock ?pot|dutch oven|casserole dish|cooking pot|soup pot|pots and pans/, l => imPotModel(l)],
  [/\bkettle\b/, l => imKettleModel(l)],
  [/cutting board|chopping board|bread board|butcher block/, () => imCuttingBoardModel()],
  [/rolling pin/, () => imRollingPinModel()],
  [/\bwhisk\b|spatula|\bturner\b|\bladle\b|wooden spoon|serving spoon|slotted spoon|\btongs\b/, l => imUtensilModel(l)],
  [/cutlery|silverware|flatware|knives? and forks?|forks? and spoons?/, () => imCutleryModel()],
  [/measuring (cups|spoons)/, () => imMeasuringCupsModel()],
  [/mixing bowls?|salad bowl|serving bowl|cereal bowls?|bowl set|ceramic bowls?|empty bowl|bowls$/, l => imMixingBowlModel(l)],
  [/\b(dinner|side|salad|ceramic|china|paper|dessert) plates?\b|dinnerware|\bdishes\b|dish set|\bplatter\b/, l => imPlatesModel(l)],
  [/french press|cafeti[eè]re|coffee press/, () => imFrenchPressModel()],
  [/toaster|blender|food processor|stand mixer|hand mixer|coffee (maker|machine)|espresso machine|microwave/, l => imApplianceModel(l)],
  [/\bmugs?\b|coffee cup|\b(ceramic|camp|enamel|paper) cups?\b|^(an? |a )?cups?$/, l => imMugModel(l)],
  // electronics
  [/laptop|notebook computer|macbook|chromebook/, () => imLaptopModel()],
  [/\b(usb|hdmi|ethernet|charging|aux|audio|power|extension|phone|lightning|usb-c|network) (cables?|cords?|leads?)\b|\bchargers?\b|extension cords?|power cord|charging cable|\bcable$/, l => imCableModel(l)],
  [/raspberry ?pi|arduino|esp32|esp8266|micro ?controller|breadboard|circuit boards?|pcb-milled|\bpcbs?\b(?!-| milling| drill)|flight controller|\besc\b|\breceiver\b|dev(elopment)? board/, l => imCircuitBoardModel(l)],
  [/smart ?phone|cell ?phone|mobile phone|iphone|\bphone\b(?! (case|stand))|\btablet\b(?! (saw|press))|ipad|e-?reader|kindle/, l => imPhoneModel(l)],
  [/head ?phones|headset|ear ?buds|earphones|airpods/, l => imHeadphonesModel(l)],
  [/\bspeakers?\b(?! (driver|wire))/, l => imSpeakerModel(l)],
  [/keyboard piano|piano keyboard|electric piano|digital piano|synthesi[sz]er|\bsynth\b|\bpiano\b|music keyboard/, l => imPianoKeyboardModel(l)],
  [/keyboard/, l => imKeyboardModel(l)],
  [/computer mouse|(wireless|gaming|optical|usb) mouse/, () => imMouseModel()],
  [/multimeter|voltmeter/, () => imMultimeterModel()],
  [/soldering (iron|station)/, () => imSolderingIronModel()],
  [/power ?bank|portable charger/, () => imPowerBankModel()],
  [/desk fan|table fan|electric fan|box fan|pedestal fan|^(an? )?fan$/, () => imFanModel()],
  [/\bclock\b(?! movement)/, l => imClockModel(l)],
  [/digital camera|dslr|\bslr\b|mirrorless|camcorder|point.and.shoot|action camera|gopro|compact camera/, l => imCameraModel(l)],
  [/game ?(controller|pad)|gamepad|joystick/, () => imGamepadModel()],
  [/walkie.?talkies?|two-way radios?|handheld radio/, l => imWalkieTalkieModel(l)],
  [/\b(tv|television|computer monitor|monitor|computer screen|display screen)\b/, l => imScreenModel(l)],
  [/light ?bulbs?|led bulbs?|edison bulbs?|^(an? )?bulbs?$/, l => imLightBulbModel(l)],
  [/wrist ?watch|smart ?watch|stopwatch|pocket watch|^(an? )?watch$/, () => imWatchModel()],
  [/speaker driver|potentiometers?|pickups?\b|blade switch|toggle switch|inline switch|kill switch|\bswitch(es)?$|antenna|tuners?\b(?!.*(clip|strobe))|strings\b|inlays|video transmitter|clock movement|\bfpv goggles\b/, l => (/fpv goggles/.test(l) ? imSafetyGearModel(l) : imComponentModel(l))],
  // sports and outdoors
  [/\b(atlas|dictionary|encyclopa?edia|almanac|thesaurus|field guide|guide ?book|textbook|cook ?book|comic|magazine|hardcover|paperback|bible|novel|journal|diary|notebook)\b(?!.*computer)/, l => realSize(bookModel(l))],
  [/racket|racquet|pickleball paddle|ping ?pong paddle|table tennis (bat|paddle)/, l => imRacketModel(l)],
  [/baseball bat|cricket bat|softball bat|^(an? )?bat$/, l => imBatModel(l)],
  [/baseball glove|catcher'?s mitt|fielding glove|ball glove/, () => imGloveModel()],
  [/basketball|tennis ball|baseball(?! (bat|cap|glove))|softball(?! bat)|golf ball|volleyball|bowling ball|ping ?pong ball|table tennis ball|rugby ball|american football|\bfootball\b|dodge ?ball|kick ?ball|playground ball/, l => imSportsBallModel(l) || ballModel(l)],
  [/hockey stick|field hockey|lacrosse stick|golf clubs?|golf (driver|iron|putter)|\bputter\b/, l => imStickModel(l)],
  [/skate ?board|longboard|snowboard|surf ?board/, l => imBoardSportModel(l)],
  [/fishing (rod|pole)/, () => imFishingRodModel()],
  [/tackle box|fishing box/, () => imTackleBoxModel()],
  [/yoga mat|exercise mat|sleeping bag|bedroll|\brug\b|carpet|runner rug/, l => imRolledModel(l)],
  [/dumbbells?|kettlebell|hand weights|free weights/, l => imDumbbellModel(l)],
  [/jump ?rope|skipping rope/, () => imJumpRopeModel()],
  [/frisbee|flying disc/, () => imFrisbeeModel()],
  [/\btent\b/, l => imTentModel(l)],
  [/backpack|rucksack|day ?pack|knapsack/, l => imBackpackModel(l)],
  [/life ?jacket|life vest|\bpfd\b|buoyancy aid/, () => imLifeJacketModel()],
  [/^(?!.*weld).*(helmet|hard ?hat)/, l => imHelmetModel(l)],
  [/ice skates|roller skates|inline skates|figure skates|hockey skates|\bskates\b/, l => imSkatesModel(l)],
  [/\bsled\b|sledge|toboggan|snow saucer/, l => imSledModel(l)],
  [/umbrella|parasol/, () => imUmbrellaModel()],
  [/snow shovel/, () => imSnowShovelModel()],
  // building materials and supplies
  [/^(?!.*\b(bolts|nuts|screws|washers|nails|parts|marbles)\b).*(\b(bags?|sacks?) of\b|\b(cement|concrete mix|mortar mix|mortar|grout|thinset|stucco|plaster|potting (soil|mix)|topsoil|play sand|flour|sugar|bird ?seed|chicken feed)\b)/, l => imSackModel(l)],
  [/\bbox(es)? of (\w+ )?(screws|nails|bolts|staples|brads|rivets|washers|fasteners|anchors|lag screws)|\b(deck|wood|drywall|structural|roofing|framing|siding|connector|sheathing|joist-hanger|lag|machine|sheet metal|stainless|silicon-bronze|neck|bridge|pickguard) (screws|nails)\b|\b(galvani[sz]ed|finishing|common|box|roofing|framing) nails\b|\bnails\b|\bscrews\b|\d+d (galvani[sz]ed )?\w* ?nails|staples\b/, l => imFastenerBoxModel(l)],
  [/\b(bolts?|nuts|nylock|washers|cotter pins|rivets|sleeves|thimbles|turnbuckles|set screws|standoffs|heim joints|zip ties|grommets|ring terminals|crimp|clevis pins|shackles)\b/, l => (/zip ties/.test(l) ? imHardwareBagModel('nylon pins') : imHardwareBagModel(l))],
  [/hinges?\b|joist hangers?|hurricane ties|padeyes?|pad eyes?|\bbrackets?\b|angle brackets|corner braces|wing-attach fittings|hinge fittings|strap buttons|neck plate/, l => imBracketModel(l)],
  [/plywood|\bmdf\b|\bosb\b|drywall sheet|gypsum board|sheetrock|cement board|backer board|acrylic sheet|sheet of (clear )?acrylic|plexiglass|polycarbonate|perspex|sheet metal|(steel|aluminium|aluminum|galvani[sz]ed|metal) (sheet|plate)|sheet of .*(steel|plate)|steel plate|floor pan|firewall|spoilboard|fixture plate|stencil|corrugated .*roofing|window glass|glass pane|sheathing \d|okoume/, l => imSheetGoodsModel(l)],
  [/\b(2x4|2x6|2x8|2 ?× ?4|1x\d|4x4|6x6)\b|lumber|joists?\b|\bstuds\b|decking|\bposts\b|\bplanks?\b|\bboards\b(?!.*circuit)|timber|blank \d|body blank|neck blank|stakes\b|\blath\b/, l => imLumberModel(l)],
  [/(cans?|tins?|gallons?|quarts?|pails?|buckets?) of (\w+ )?(paint|primer|stain|varnish|polyurethane|sealer|lacquer)|\b(exterior|interior|house|wall|latex|chalk|enamel|marine) (paint|primer)|\bprimer\b|polyurethane|spar varnish|\bvarnish\b|wood stain|\bstain\b|topcoat|grain filler|fabric cement|\bpaint\b(?!.*(brush|set|marker|spray|tube|pan|box|roller|tray|gun|stick))/, l => imPaintCanModel(l)],
  [/\btape\b(?! measure)/, l => imTapeRollModel(l)],
  [/bricks?\b|cinder blocks?|concrete blocks?|\bpavers?\b|\bcmu\b/, l => imBricksModel(l)],
  [/shingles|roofing felt|tar paper/, () => imShinglesModel()],
  [/^(?!.*(paint|glue|caulk|cream|notcher)).*(\bpvc\b|\babs pipe|copper pipe|plumbing pipe|black iron pipe|galvani[sz]ed pipe|chromoly tube|\btubes?\b(?! of)|tubing|\bdom\b|spar tube|push-pull tubes|compression struts|lift struts|jury struts|seat struts)/, l => imPipesModel(l)],
  [/spool|reel of|\bwire\b(?!.*(stripper|brush|cutter))|solder\b(?!ing)/, l => imSpoolModel(l)],
  [/sandpaper|sanding (sheets|discs|paper)|emery/, () => imSandpaperModel()],
  [/\bglue\b|epoxy|caulk|silicone|sealant|construction adhesive|liquid nails|\bjug\b|\bjugs?\b|coolant|antifreeze|brake fluid|gearbox oil|motor oil|injection oil|two-stroke oil|isopropyl|\bipa\b|resin(?! cartridge)|cutting fluid|liquid binder|mek reducer|solvent(?! drum)|thinner|tru-oil|grease|\boil\b(?! (filter|brush|paint|pastel))/, l => (/ceramic|pottery|stoneware|milk jug|water jug|pitcher/.test(l) ? imPitcherModel(l) : imBottleModel(l))],
  [/caulking gun|caulk gun/, () => imCaulkGunModel()],
  [/tape measure|measuring tape/, () => imTapeMeasureModel()],
  [/spirit level|\blevel\b(?!.*(up|meter))|torpedo level/, l => imLevelModel(l)],
  [/utility knife|box cutter|craft knife/, () => imUtilityKnifeModel()],
  [/ladder|step stool/, l => imLadderModel(l)],
  [/pruning shears|secateurs|pruners|hedge (shears|clippers)|loppers|scissors|\bshears\b/, l => imShearsModel(l)],
  [/chainsaw|leaf blower|lawn ?mower|string trimmer|weed ?(eater|whacker)|whipper snipper/, l => imPowerYardToolModel(l)],
  // workshop tools, safety gear and parts
  [/angle grinder|jig ?saw(?! puzzle)|circular saw|\brouter\b(?! bits?)(?!.*(table|cnc))|trim router|\bsander\b|staple gun|nail gun|brad nailer|rivet gun|pop.?rivet|spray gun|hvlp|heat gun|hot air gun|impact (driver|wrench)|hammer drill/, l => imPowerToolModel(l)],
  [/bandsaw(?! blade)|band saw(?! blade)|\b(mig|tig|stick|arc) welder|welding machine|plasma cutter|air compressor|shop vac|wet.?dry vac|machining vise|bench vise|\bvise\b|\bvice\b/, l => imBenchMachineModel(l)],
  [/\bclamps?\b|chisels?|gouges|\bfiles?\b|\brasp\b|socket set|ratchet set|crowning file/, l => imHandToolSetModel(l)],
  [/respirator|gas mask|dust mask|ear (defenders|muffs|protection)|earmuffs|face shield|safety glasses|safety goggles|esd|wrist strap|nitrile|latex gloves|disposable gloves|heat gloves|kevlar|work gloves|leather gloves/, l => imSafetyGearModel(l)],
  [/end ?mills?|router bits?|milling bits?|engraving bits?|v-?bit|compression bit|engraving bit|face mill|carbide inserts/, l => imCutterSetModel(l)],
  [/bandsaw blade|band saw blade|saw blades?/, () => imBladeCoilModel()],
  [/jack stands?|floor jack|trolley jack/, l => imJackStandModel(l)],
  // art supplies
  // clothes, textiles, furniture and household things
  [/scarf|toque|beanie|knit hat|winter hat|wool hat|(?<!bottle )\bcap\b|sun ?hat|\bhat\b|boots?\b|\bshoes\b|wellies|waders|\bgloves\b|mittens|\bmitts\b|\bsocks\b|\bpants\b|jeans|trousers|shorts\b|jacket|\bcoat\b(?! (rack|hook|hanger|stand))|parka|\bvest\b|hoodie|fleece|sweater|jumper|cardigan|sweatshirt|t-?shirt|\bshirt\b|blouse|raincoat/, l => imClothingModel(l)],
  [/pillow|cushion|blanket|quilt|throw\b|towel|duvet|\bfabric\b|cloth\b|ceconite/, l => imTextileModel(l)],
  [/book ?(case|shelf)|bookshelves|shelving unit|coat rack|hat stand|hall tree|garden bench|park bench|\bbench\b(?!.*(grinder|vise|vice|press|top))|raised (garden )?bed|planter box|picnic table|dresser|chest of drawers|\bcabinet\b|nightstand|bedside table|side table|end table|coffee table|dining table|kitchen table|\bdesk\b(?! (lamp|fan))|^(an? )?table$|(wooden|oak|maple|walnut|pine|handmade|small) (side )?table/, l => imFurnitureModel(l)],
  [/picture frame|photo frame|\bphotos?\b|framed (photo|picture|print)/, l => imPictureFrameModel(l)],
  [/^(?!.*(rear|side|telescope|hand)).*\bmirror\b/, () => imMirrorModel()],
  [/fire extinguisher/, () => imFireExtinguisherModel()],
  [/first.?aid/, () => imFirstAidModel()],
  [/binoculars|opera glasses|field glasses/, () => imBinocularsModel()],
  [/\bglobe\b/, () => imGlobeModel()],
  [/hourglass|sand timer|egg timer/, () => imHourglassModel()],
  [/bird ?feeder/, () => imBirdFeederModel()],
  [/flower ?pot|plant pot|terracotta pot|clay pot|\bplanter\b/, l => imFlowerPotModel(l)],
  [/\b(bucket|pail)\b/, l => imBucketModel(l)],
  [/broom|\bmop\b/, l => imBroomModel(l)],
  [/infrared thermometer|ir thermometer|slump cone|spectrometer|spectroscope|gas meter/, l => imInstrumentModel(l)],
  [/wind ?chime/, () => imWindChimeModel()],
  [/time capsule/, () => imCapsuleModel()],
  [/mica|river stone|pebble|\bstone\b(?!.*(ware|wash))/, l => imStoneModel(l)],
  // toys and instruments
  [/teddy|plush|stuffed (animal|toy|bear|dino)|soft toy/, l => imPlushModel(l)],
  [/\bdoll\b(?!.*house)/, () => imDollModel()],
  [/toy train|train set|wooden train/, () => imToyTrainModel()],
  [/playing cards|deck of cards|card deck|\bcards\b(?!.*(sd|memory|graphics|credit))/, () => imCardsModel()],
  [/board game|jigsaw|^(an? )?game$|monopoly|scrabble|\bcatan\b|checkers/, l => imBoardGameModel(l)],
  [/rubik|puzzle cube|speed cube|magic cube/, () => imCubePuzzleModel()],
  [/toy robot|robot toy|wind-?up robot|robot kit/, () => imToyRobotModel()],
  [/saxophone|\bsax\b|trumpet|cornet|trombone|bugle|french horn|tuba/, l => imBrassModel(l)],
  [/\bflute\b|piccolo|clarinet|\boboe\b|recorder(?! (pen|box))/, l => imWoodwindModel(l)],
  [/drum (set|kit)|drum ?kit|drumset|bongos?|djembe|snare|\bdrums?\b(?! (of|brake))|tom-?tom/, l => imDrumModel(l)],
  [/tambourine/, () => imTambourineModel()],
  [/kalimba|thumb piano|mbira/, () => imKalimbaModel()],
  [/^(?!.*(camping|landing|snow|climbing|rain|ski|fishing|safety|welding|hiking|winter|running|riot|scuba|dive|diving) gear).*\bgears?\b/, l => imMechPartModel(l.replace(/gears?/, 'gear '))],
  [/\bvases?\b(?!.*flowers)/, () => (typeof madeGlassModel === 'function' ? madeGlassModel('vase') : imFlowerPotModel('vase'))],
  [/pencil cup|pen holder|pencil holder/, () => imMugModel('pencil cup')],
  [/phone stand|tablet stand/, l => imMadeShapeModel('pla ' + l)],
  [/wall hook|coat hook|\bhooks?\b(?!.*(fish|crane|tow))/, () => imHookModel()],
  [/whistle/, () => imWhistleModel()],
  [/star ornament|christmas ornament|\bornament\b/, () => imStarModel()],
  [/\b(box|carton|case|pack|packet) of\b/, l => imCartonModel(0.2, 0.1, 0.14, 0xc8a46a, 0xf8fafc)]
];

// A snow shovel: a wide, shallow plastic scoop on a long handle
function imSnowShovelModel() {
      const K = imKit();
      const shaft = K.rod([-0.7, 0.06, 0], [0.38, 0.03, 0], 0.016, 0x111827, IM.alu);
      const grip = K.torus(0.06, 0.012, 0x111827, -0.76, 0.06, 0, IM.plastic, Math.PI); grip.rotation.set(Math.PI / 2, 0, Math.PI / 2);
      const blade = K.slab([[0, -0.26], [0.42, -0.24], [0.44, 0.24], [0, 0.26]], 0.006, 0x1d4ed8, IM.plastic); blade.rotation.x = -Math.PI / 2; blade.position.set(0.36, 0.008, 0);
      const back = K.box(0.006, 0.12, 0.52, 0x1d4ed8, 0.37, 0.06, 0, IM.plastic);
      const edge = K.box(0.03, 0.004, 0.5, 0x9ca3af, 0.79, 0.006, 0, IM.steel);
      return K.done(shaft, grip, blade, back, edge);
    }

if (typeof ITEM_MODEL_RULES !== 'undefined') ITEM_MODEL_RULES.unshift(...IM_RULES);

// The real size of things whose older models were drawn at a display size (in items3d.js and the
// AI's guesses): longest side in metres. Applied by imTrueSize when the drawn model isn't realSize.
const IM_TRUE_METRES = [
  [/crucible/, 0.16], [/cauldron/, 0.45], [/ingots?/, 0.2], [/\bmou?lds?\b/, 0.25],
  [/bar stock|steel bar|\brods?\b|rebar/, 0.9], [/drill bits?|\bbits\b/, 0.15],
  [/electric motor|\bmotor\b/, 0.3], [/generator/, 0.6], [/\bengine\b|rotax/, 0.6], [/turbine/, 0.5],
  [/\blens\b/, 0.08], [/monocle/, 0.04],
  [/gas cylinder|argon|oxygen|propane|co2/, 0.9], [/\bjars?\b/, 0.15], [/flask/, 0.2], [/bottles?/, 0.28], [/canister/, 0.3], [/\btank\b/, 0.6],
  [/\baaa?\b|aa batteries|batteries/, 0.06], [/lipo|battery pack/, 0.14], [/car battery/, 0.3], [/capacitor/, 0.04], [/power supply/, 0.2], [/battery|power cell/, 0.07],
  [/solar panel/, 1.0], [/panel/, 0.6],
  [/geode/, 0.12], [/amethyst|garnet/, 0.06], [/quartz|crystal|jade/, 0.08], [/fossil|trilobite|ammonite/, 0.12], [/bone/, 0.25], [/petrified/, 0.2],
  [/coin/, 0.03], [/nugget/, 0.03], [/meteorite/, 0.09], [/obsidian/, 0.1], [/arrowhead/, 0.05],
  [/rope|cord|twine|line\b/, 0.35], [/cable|wire/, 0.3],
  [/magnif/, 0.22], [/compass/, 0.07], [/microphone|\bmic\b/, 0.2],
  [/headlamp/, 0.09], [/flashlight|torch\b/, 0.2], [/lantern/, 0.3], [/lamp/, 0.45],
  [/kaleidoscope|spyglass/, 0.25], [/clay|mud/, 0.2], [/stained glass|glass/, 0.4]
];

function imTrueSize(lower, drawn) {
      if (!drawn || drawn.userData.realSize || drawn.userData.fullSize || /^(parts kit|tools for|roadwork kit|runway kit)/.test(lower)) return drawn;
      if (typeof vehicleTypeFor === 'function' && vehicleTypeFor(lower)) return drawn;
      const hit = IM_TRUE_METRES.find(([re]) => re.test(lower));
      if (!hit) return drawn;
      drawn.updateMatrixWorld(true);
      const box = new THREE.Box3();
      drawn.traverse(o => { if (o.isMesh && !(o.userData && o.userData.isLabel)) box.expandByObject(o); });
      if (box.isEmpty()) return drawn;
      const size = box.getSize(new THREE.Vector3());
      const longest = Math.max(size.x, size.y, size.z);
      if (!(longest > 0)) return drawn;
      drawn.scale.multiplyScalar(hit[1] / longest);
      return realSize(group(drawn));
    }

// Stand a model on y = 0 (some older models dip below it or hover above it)
function imGround(model) {
      model.updateMatrixWorld(true);
      const box = new THREE.Box3();
      model.traverse(o => { if (o.isMesh && !(o.userData && o.userData.isLabel)) box.expandByObject(o); });
      if (box.isEmpty()) return model;
      const lift = -box.min.y / (model.scale.y || 1);
      if (Math.abs(lift) > 1e-4) model.children.forEach(c => { if (!(c.userData && c.userData.isLabel)) c.position.y += lift; });
      return model;
    }

// --- Small extras ------------------------------------------------------------------------------
function imBatteryModel(lower) {
      const K = imKit();
      if (/car battery|deep.?cycle|12 ?v battery|marine battery/.test(lower)) {
        return K.done(K.rr(0.26, 0.17, 0.2, 0.01, 0x111827, 0, 0, 0, IM.plastic), K.cyl(0.01, 0.01, 0.02, 0xdc2626, 0.09, 0.21, -0.05), K.cyl(0.01, 0.01, 0.02, 0x111827, -0.09, 0.21, -0.05), K.box(0.15, 0.06, 0.001, 0xfacc15, 0, 0.12, 0.0855, IM.paper));
      }
      if (/lipo|battery pack|drone battery/.test(lower)) {
        const pack = K.rr(0.075, 0.035, 0.035, 0.006, 0x111827, 0, 0, 0, IM.plastic);
        const label = K.box(0.06, 0.02, 0.001, 0xf97316, 0, 0.018, 0.0176, IM.paper);
        const leads = [0xdc2626, 0x111827].map((c, i) => K.tube([[0.037, 0.02, -0.005 + i * 0.01], [0.06, 0.02, -0.005 + i * 0.01], [0.08, 0.008, 0.01]], 0.002, c, IM.rubber));
        return K.done(pack, label, ...leads, K.box(0.016, 0.008, 0.012, 0xfacc15, 0.085, 0.006, 0.012, IM.plastic));
      }
      const nine = /9 ?v/.test(lower), size = /\baaa\b/.test(lower) ? [0.0053, 0.0445] : /\b(c|d)( size)?\b/.test(lower) ? [0.016, 0.06] : [0.00725, 0.0505];
      const n = /pack|batteries/.test(lower) ? 4 : 1, parts = [];
      if (n > 1) parts.push(K.box(n * size[0] * 2.2 + 0.01, 0.002, size[1] * 1.3, 0xfacc15, 0, 0.001, 0, IM.paper));
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * size[0] * 2.2;
        if (nine) { parts.push(K.box(0.026, 0.048, 0.017, 0x111827, x * 2, 0.024, 0, IM.plastic)); continue; }
        const cell = K.cyl(size[0], size[0], size[1] * 0.9, 0x111827, x, size[0] + 0.002, 0, { roughness: 0.4, metalness: 0.3 }, 16); cell.rotation.x = Math.PI / 2;
        const band = K.cyl(size[0] * 1.01, size[0] * 1.01, size[1] * 0.3, 0xc2702e, x, size[0] + 0.002, size[1] * 0.3, { metalness: 0.7, roughness: 0.3 }, 16); band.rotation.x = Math.PI / 2;
        const tip = K.cyl(size[0] * 0.35, size[0] * 0.35, size[1] * 0.06, 0xd1d5db, x, size[0] + 0.002, size[1] * 0.48, IM.chrome); tip.rotation.x = Math.PI / 2;
        parts.push(cell, band, tip);
      }
      return K.done(...parts);
    }

function imCartridgeModel(lower) {
      const K = imKit();
      const col = /fusing/.test(lower) ? 0x111827 : /detailing/.test(lower) ? 0x7dd3fc : /support|sup706/.test(lower) ? 0xf8fafc : /resin/.test(lower) ? 0xf97316 : 0x334155;
      const body = K.rr(0.3, 0.09, 0.12, 0.01, col, 0, 0, 0, IM.plastic);
      const label = K.box(0.18, 0.06, 0.001, 0xf8fafc, -0.02, 0.06, 0.0456, IM.paper);
      const chip = K.box(0.02, 0.02, 0.002, 0xc9a227, 0.12, 0.06, 0.046, IM.steel);
      const port = K.cyl(0.012, 0.012, 0.02, 0x111827, 0.155, 0.04, 0, IM.plastic); port.rotation.z = Math.PI / 2;
      return K.done(body, label, chip, port);
    }

function imSignModel(lower) {
      const K = imKit();
      const acrylic = /acrylic|laser/.test(lower), metal = /metal|steel|aluminium|aluminum/.test(lower);
      const col = acrylic ? 0xdbeafe : metal ? 0xb6bcc4 : 0xb88a52;
      const board = K.box(0.4, 0.2, 0.012, col, 0, 0.115, 0, acrylic ? { transparent: true, opacity: 0.6, roughness: 0.1 } : metal ? IM.alu : IM.wood);
      const letters = K.many(new THREE.BoxGeometry(0.03, 0.05, 0.003), acrylic ? 0x1d4ed8 : 0x3f2a1d, [0, 1, 2, 3, 4, 5, 6].map(i => [-0.12 + i * 0.04, 0.12, 0.007]));
      const stand = K.box(0.3, 0.015, 0.06, acrylic ? 0x111827 : col, 0, 0.0075, 0, acrylic ? IM.plastic : IM.wood);
      const g = group(board, letters); g.rotation.x = -0.12; g.position.y = 0.0;
      return K.done(g, stand);
    }

function imCoasterModel(lower) {
      const K = imKit();
      const acrylic = /acrylic/.test(lower);
      return K.done(...[0, 1, 2, 3].map(i => K.cyl(0.05, 0.05, 0.004, acrylic ? 0xdbeafe : /cork/.test(lower) ? 0xc8a46a : 0xb88a52, i * 0.004, 0.002 + i * 0.0042, 0, acrylic ? { transparent: true, opacity: 0.7, roughness: 0.1 } : IM.wood, 28)));
    }

function imWoodBoxModel(lower) {
      const K = imKit();
      const wood = /walnut/.test(lower) ? 0x5c3a21 : /maple/.test(lower) ? 0xdcb17c : /cherry/.test(lower) ? 0x8b4a2b : 0xb88a52;
      const box = K.box(0.25, 0.1, 0.16, wood, 0, 0.05, 0, IM.wood);
      const lid = K.box(0.255, 0.02, 0.165, wood, 0, 0.11, 0, IM.wood);
      const tails = K.many(new THREE.BoxGeometry(0.003, 0.012, 0.012), 0xd9b98a, [0, 1, 2, 3].map(i => [0.1265, 0.015 + i * 0.024, 0.07]), IM.wood);
      const knob = K.cyl(0.012, 0.012, 0.012, 0x2b1a10, 0, 0.126, 0, IM.wood);
      return K.done(box, lid, tails, knob);
    }

function imBagelModel(lower) {
      const K = imKit();
      const bagel = K.torus(0.035, 0.022, /donut|doughnut/.test(lower) ? 0xd29a5c : 0xc58a4a, 0, 0.022, 0, { roughness: 0.75 }); bagel.rotation.x = Math.PI / 2; bagel.scale.z = 0.8;
      const parts = [bagel];
      if (/toast/.test(lower)) { const cut = K.cyl(0.056, 0.056, 0.002, 0xe8c58a, 0, 0.03, 0, { roughness: 1 }); parts.push(cut); }
      if (/donut|doughnut/.test(lower)) { const icing = K.torus(0.035, 0.016, 0xf472b6, 0, 0.032, 0, { roughness: 0.3 }); icing.rotation.x = Math.PI / 2; icing.scale.z = 0.5; parts.push(icing); }
      const plate = K.cyl(0.08, 0.075, 0.008, 0xfafaf9, 0, 0.004, 0, IM.ceramic, 28);
      parts.forEach(p => (p.position.y += 0.008));
      return K.done(plate, ...parts);
    }

function imRopeCoilModel(lower) {
      const K = imKit();
      const col = /bungee|shock/.test(lower) ? 0x111827 : /climb|dynamic/.test(lower) ? 0xf97316 : /paracord/.test(lower) ? 0x4d7c0f : /twine|jute|lacing/.test(lower) ? 0xc8a46a : 0xd6c7a1;
      const t = /twine|lacing|paracord/.test(lower) ? 0.003 : /bungee|shock/.test(lower) ? 0.007 : 0.011;
      const R = /twine/.test(lower) ? 0.05 : 0.17, parts = [];
      if (/twine/.test(lower)) return K.done(K.cyl(0.05, 0.05, 0.1, col, 0, 0.05, 0, { roughness: 1 }));
      for (let i = 0; i < 6; i++) { const l = K.torus(R - (i % 3) * t * 1.2, t, col, 0, t + Math.floor(i / 3) * t * 1.6, 0, { roughness: 0.95 }); l.rotation.x = Math.PI / 2; l.rotation.y = (i % 2) * 0.04; parts.push(l); }
      const tie = K.torus(t * 4, t * 0.9, col, R, t * 2.5, 0, { roughness: 0.95 }); tie.rotation.y = Math.PI / 2;
      parts.push(tie);
      if (/carabiner/.test(lower)) parts.push(K.torus(0.035, 0.005, 0x9ca3af, 0, 0.05, 0.2, IM.alu));
      return K.done(...parts);
    }

// Fruit and vegetables heaped in the woven basket (items3d's fruitBasket), each in its own colour
function imProduceModel(lower) {
      const spec = [[/pear/, 0xb5c24a, 0.035], [/tomato/, 0xd62f1f, 0.03], [/orange/, 0xf28c1a, 0.037], [/lemon/, 0xf2d52a, 0.03], [/lime/, 0x6aa52b, 0.025],
        [/plum/, 0x5b2a5e, 0.024], [/mango/, 0xf2a03a, 0.045], [/nectarine/, 0xe3542b, 0.032], [/onion/, 0xb7793e, 0.035], [/potato/, 0x9a7546, 0.035], [/pepper/, 0xc92a1e, 0.035]].find(([re]) => re.test(lower));
      const [, col, r] = spec || [0, 0xd62f1f, 0.03];
      const single = /^(an? )?(pear|tomato|orange|lemon|lime|plum|mango|nectarine|onion|potato|bell pepper)$/.test(lower.trim());
      if (single) {
        const K = imKit();
        const fruit = K.ball(r, col, 0, r, 0, { roughness: 0.45 }, 18);
        if (/pear/.test(lower)) { fruit.scale.set(1, 1.25, 1); const top = K.ball(r * 0.6, col, 0, r * 2.2, 0, { roughness: 0.45 }); return K.done(fruit, top, K.cyl(0.002, 0.002, 0.02, 0x3f2a14, 0, r * 2.8, 0)); }
        return K.done(fruit, K.cyl(0.002, 0.002, 0.012, 0x3f6212, 0, r * 2, 0));
      }
      return fruitBasket(col, r, Math.round(9 * (0.04 / r) ** 2), 'apple');
    }

// One of items3d's general models by a word, at the true size given (a solder bar is an ingot)
function imBase(word, metres) {
      const rule = ITEM_MODEL_RULES.find(([re]) => !IM_RULES.some(r => r[0] === re) && re.test(word));
      const m = rule ? rule[1](word) : giftBox();
      IM_TRUE_METRES.unshift([new RegExp(word), metres]);
      const sized = imTrueSize(word, m);
      IM_TRUE_METRES.shift();
      return sized;
    }

function imFurnaceModel(lower) {
      const K = imKit();
      const body = K.cyl(0.2, 0.2, 0.36, 0x52525b, 0, 0.18, 0, IM.iron, 24);
      const lid = K.cyl(0.2, 0.2, 0.06, 0x3f3f46, 0, 0.39, 0, IM.iron, 24);
      const vent = K.cyl(0.04, 0.04, 0.02, 0x111827, 0, 0.43, 0, IM.iron);
      const glow = K.cyl(0.035, 0.035, 0.002, 0xf97316, 0, 0.441, 0, { emissive: 0xea580c, emissiveIntensity: 0.8 });
      const burner = K.cyl(0.025, 0.025, 0.2, 0x9ca3af, 0.25, 0.14, 0, IM.steel); burner.rotation.z = Math.PI / 2;
      const handle = K.rod([-0.22, 0.4, -0.05], [-0.22, 0.4, 0.05], 0.01, 0x111827);
      return K.done(body, lid, vent, glow, burner, handle);
    }

function imConcreteToolModel(lower) {
      const K = imKit();
      if (/bull float|darby/.test(lower)) {
        const plate = K.box(0.9, 0.02, 0.2, 0x9ca3af, 0, 0.01, 0, IM.alu);
        const pole = K.rod([0, 0.02, 0], [0.1, 0.05, 1.3], 0.016, 0x9ca3af, IM.alu);
        return K.done(plate, pole);
      }
      if (/screed/.test(lower)) return K.done(K.box(2.4, 0.1, 0.03, 0xb6bcc4, 0, 0.05, 0, IM.alu), ...[-0.4, 0.4].map(x => K.box(0.15, 0.05, 0.03, 0x111827, x, 0.12, 0, IM.rubber)));
      return K.done(K.box(0.25, 0.006, 0.08, 0x9ca3af, 0, 0.003, 0, IM.steel), K.box(0.12, 0.03, 0.03, 0xc8955a, 0, 0.03, 0, IM.wood));
    }

function imPushBlockModel() {
      const K = imKit();
      const block = K.box(0.25, 0.04, 0.08, 0xf97316, 0, 0.02, -0.05, IM.plastic);
      const grip = K.torus(0.06, 0.012, 0xf97316, 0, 0.04, -0.05, IM.plastic, Math.PI);
      const stick = K.slab([[0, 0], [0.3, 0], [0.32, -0.02], [0.3, 0.03], [0.05, 0.05], [0, 0.03]], 0.015, 0xf59e0b, IM.plastic);
      stick.rotation.x = -Math.PI / 2; stick.position.set(-0.15, 0.0075, 0.08);
      return K.done(block, grip, stick);
    }

// --- Second round: things the catalogue showed were still wrong --------------------------------
function imAquariumModel(lower) {
      const K = imKit();
      const glassBox = K.box(0.6, 0.35, 0.3, 0xdbeafe, 0, 0.195, 0, { transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false }); glassBox.castShadow = false;
      const water = K.box(0.58, 0.3, 0.28, 0x38bdf8, 0, 0.17, 0, { transparent: true, opacity: 0.3, roughness: 0.1, depthWrite: false }); water.castShadow = false;
      const base = K.box(0.62, 0.02, 0.32, 0x111827, 0, 0.01, 0, IM.plastic), lid = K.box(0.62, 0.025, 0.32, 0x111827, 0, 0.38, 0, IM.plastic);
      const gravel = K.box(0.58, 0.03, 0.28, 0xb8a58a, 0, 0.035, 0, { roughness: 1 });
      const jelly = /jellyfish/.test(lower);
      const swimmers = [[-0.15, 0.2, 0.02], [0.1, 0.26, -0.05], [0.18, 0.14, 0.06]].map(([x, y, z]) => {
        const b = K.ball(jelly ? 0.03 : 0.018, jelly ? 0xf0abfc : 0xf97316, x, y, z, jelly ? { emissive: 0xc026d3, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 } : { roughness: 0.4 });
        b.scale.set(jelly ? 1 : 1.8, jelly ? 0.7 : 1, 1); return b;
      });
      const weed = K.cyl(0.004, 0.006, 0.2, 0x15803d, -0.22, 0.14, -0.08, { roughness: 0.8 });
      return K.done(base, gravel, water, glassBox, lid, weed, ...swimmers);
    }

function imMultitoolModel(lower) {
      const K = imKit();
      const red = /swiss|pocket|pen ?knife/.test(lower);
      const body = K.rr(0.1, 0.022, 0.018, 0.009, red ? 0xc81e1e : 0x9ca3af, 0, 0, 0, red ? IM.plastic : IM.alu);
      const blade = K.slab([[0, 0.002], [0.07, 0.004], [0.075, 0.011], [0, 0.013]], 0.002, 0xe5e7eb, IM.chrome);
      blade.rotation.x = -Math.PI / 2; blade.position.set(0.045, 0.012, 0.0); blade.rotation.y = 0.25;
      const parts = [body, blade];
      if (red) parts.push(K.box(0.012, 0.001, 0.012, 0xf8fafc, -0.02, 0.0185, 0));
      else parts.push(K.box(0.05, 0.004, 0.006, 0x52525b, -0.02, 0.0185, 0, IM.steel), K.cyl(0.003, 0.003, 0.024, 0x52525b, -0.048, 0.009, 0, IM.steel));
      return K.done(...parts);
    }

function imLightModel(lower) {
      const K = imKit();
      if (/socket|holder/.test(lower)) {
        const body = K.cyl(0.02, 0.02, 0.06, 0x111827, 0, 0.03, 0, IM.plastic);
        const thread = K.cyl(0.0135, 0.0135, 0.025, 0xc9a227, 0, 0.065, 0, IM.steel);
        const cord = K.tube([[0, 0.0, 0], [0.04, 0.004, 0.03], [0.1, 0.004, 0.02]], 0.003, 0x111827, IM.rubber);
        return K.done(body, thread, cord);
      }
      if (/head ?lamp|head torch/.test(lower)) {
        const band = K.torus(0.08, 0.008, 0x1f2937, 0, 0.008, 0, IM.cloth); band.rotation.x = Math.PI / 2; band.scale.set(1, 1.15, 4);
        const lamp = K.rr(0.05, 0.03, 0.035, 0.01, 0xf97316, 0, 0.0, 0.09, IM.plastic);
        const lens = K.cyl(0.013, 0.013, 0.004, 0xfef9c3, 0, 0.0175, 0.106, { emissive: 0xfde68a, emissiveIntensity: 0.4 }); lens.rotation.x = Math.PI / 2;
        return K.done(band, lamp, lens);
      }
      if (/flashlight|torch/.test(lower)) {
        const body = K.cyl(0.014, 0.014, 0.13, 0x111827, -0.02, 0.018, 0, IM.alu); body.rotation.z = Math.PI / 2;
        const head = K.cyl(0.022, 0.016, 0.04, 0x111827, 0.065, 0.022, 0, IM.alu); head.rotation.z = Math.PI / 2;
        const lens = K.cyl(0.02, 0.02, 0.002, 0xfef9c3, 0.086, 0.022, 0, { emissive: 0xfde68a, emissiveIntensity: 0.4 }); lens.rotation.z = Math.PI / 2;
        const button = K.box(0.012, 0.006, 0.01, 0xdc2626, 0.02, 0.033, 0, IM.rubber);
        return K.done(body, head, lens, button);
      }
      // a lantern: a camping one, or a miner's / hurricane lantern with its glass globe and bail
      const old = /miner|hurricane|oil|kerosene|old|antique|storm/.test(lower);
      const col = old ? 0x7f1d1d : 0x15803d;
      const fount = K.cyl(0.07, 0.075, 0.05, col, 0, 0.025, 0, { roughness: 0.5, metalness: 0.4 });
      const globe = K.lathe([[0.03, 0.05], [0.055, 0.1], [0.055, 0.17], [0.035, 0.2]], 0xfef3c7, { transparent: true, opacity: 0.55, roughness: 0.1, emissive: 0xfbbf24, emissiveIntensity: 0.25 }); globe.castShadow = false;
      const flame = K.ball(0.012, 0xfbbf24, 0, 0.115, 0, { emissive: 0xf59e0b, emissiveIntensity: 1 }); flame.scale.y = 1.8;
      const guards = [0, 1, 2, 3].map(i => { const a = i * Math.PI / 2; return K.rod([Math.cos(a) * 0.06, 0.05, Math.sin(a) * 0.06], [Math.cos(a) * 0.04, 0.2, Math.sin(a) * 0.04], 0.003, col, IM.steel); });
      const cap = K.cyl(0.03, 0.045, 0.035, col, 0, 0.215, 0, { roughness: 0.5, metalness: 0.4 });
      const bail = K.torus(0.06, 0.003, 0x52525b, 0, 0.24, 0, IM.steel, Math.PI);
      return K.done(fount, globe, flame, ...guards, cap, bail);
    }

// Jars, bottles, flasks and tubs of whatever is named: a metal powder flask, solder paste, ink, frit...
function imContainerModel(lower) {
      const K = imKit();
      if (/glue|adhesive|epoxy|resin|oil|solvent|alcohol|binder\b|coolant/.test(lower) && !/powder/.test(lower)) return imBottleModel(lower);
      if (/powder/.test(lower)) {
        // a sealed metal-powder bottle (stainless, titanium) or a nylon powder tub
        const tub = /tub|nylon|pa12/.test(lower);
        if (tub) return K.done(K.cyl(0.11, 0.1, 0.22, 0xf8fafc, 0, 0.11, 0, IM.plastic, 24), K.cyl(0.112, 0.112, 0.03, 0x1d4ed8, 0, 0.235, 0, IM.plastic, 24), K.box(0.12, 0.08, 0.001, 0xfacc15, 0, 0.12, 0.105, IM.paper));
        const body = K.cyl(0.07, 0.07, 0.2, 0xb6bcc4, 0, 0.1, 0, IM.alu, 24);
        const shoulder = K.cyl(0.03, 0.07, 0.04, 0xb6bcc4, 0, 0.22, 0, IM.alu, 24);
        const cap = K.cyl(0.032, 0.032, 0.03, 0x111827, 0, 0.255, 0, IM.plastic);
        const label = K.cyl(0.0705, 0.0705, 0.08, /titan|ti-?6/.test(lower) ? 0x7c3aed : 0xdc2626, 0, 0.1, 0, IM.paper, 24);
        return K.done(body, shoulder, cap, label);
      }
      const ink = /\bink\b/.test(lower), paste = /paste/.test(lower), frit = /frit|beads|glitter/.test(lower);
      if (paste) return K.done(K.cyl(0.03, 0.03, 0.035, 0x9ca3af, 0, 0.0175, 0, IM.plastic, 20), K.cyl(0.031, 0.031, 0.012, 0x1d4ed8, 0, 0.041, 0, IM.plastic, 20));
      if (ink) return K.done(K.lathe([[0, 0], [0.025, 0], [0.026, 0.05], [0.012, 0.065], [0.01, 0.075], [0, 0.075]], 0x111827, { roughness: 0.15 }, 18), K.cyl(0.012, 0.012, 0.02, 0xb91c1c, 0, 0.085, 0, IM.plastic), K.cyl(0.0262, 0.0262, 0.025, 0xf5f0e1, 0, 0.025, 0, IM.paper, 18));
      // a glass jar with what's in it showing through
      const fill = frit ? 0x2563eb : /honey/.test(lower) ? 0xd97706 : /jam/.test(lower) ? 0x9f1239 : /pickle/.test(lower) ? 0x65a30d : 0xd6c7a1;
      const jar = K.cyl(0.045, 0.045, 0.11, 0xdbeafe, 0, 0.055, 0, { transparent: true, opacity: 0.3, roughness: 0.05, depthWrite: false }, 24); jar.castShadow = false;
      const content = K.cyl(0.042, 0.042, 0.085, fill, 0, 0.044, 0, frit ? { roughness: 0.3, metalness: 0.2 } : { roughness: 0.6 }, 24);
      const lid = K.cyl(0.046, 0.046, 0.016, 0xd1d5db, 0, 0.118, 0, IM.steel, 24);
      return K.done(content, jar, lid);
    }

function imMetalStockModel(lower) {
      const K = imKit();
      const col = /brass|bronze/.test(lower) ? 0xc9a227 : /copper/.test(lower) ? 0xb87333 : /titanium/.test(lower) ? 0x8f8f99 : /steel|1018|4140|a36/.test(lower) ? 0x8a929b : /delrin|acetal/.test(lower) ? 0xf5f5f4 : 0xc8ccd0;
      const fin = /delrin|acetal/.test(lower) ? IM.plastic : { metalness: 0.85, roughness: 0.38 };
      if (/round|bar stock|rod/.test(lower)) { const b = K.cyl(0.0125, 0.0125, 0.3, col, 0, 0.0125, 0, fin, 20); b.rotation.z = Math.PI / 2; return K.done(b); }
      if (/flat bar/.test(lower)) return K.done(K.box(0.3, 0.0064, 0.038, col, 0, 0.0032, 0, fin));
      if (/hex/.test(lower)) { const b = K.cyl(0.013, 0.013, 0.3, col, 0, 0.0113, 0, fin, 6); b.rotation.z = Math.PI / 2; return K.done(b); }
      const [w, h, d] = /billet/.test(lower) ? [0.2, 0.05, 0.1] : [0.15, 0.05, 0.1];
      return K.done(K.box(w, h, d, col, 0, h / 2, 0, fin), K.box(w * 0.4, 0.0005, d * 0.3, 0x1d4ed8, -w * 0.2, h + 0.0003, 0));
    }

function imBottleCapModel() {
      const K = imKit();
      const cap = K.cyl(0.0145, 0.016, 0.006, 0xb91c1c, 0, 0.003, 0, { metalness: 0.6, roughness: 0.4 }, 21);
      return K.done(cap, K.cyl(0.012, 0.012, 0.0005, 0xd1d5db, 0, 0.0063, 0, IM.steel));
    }

function imGlassShardsModel() {
      const K = imKit(), parts = [];
      [[0, 0, 0.06, 0], [0.05, 0.02, 0.04, 1.2], [-0.04, 0.03, 0.05, 2.4], [0.01, -0.04, 0.03, 3.6]].forEach(([x, z, r, a]) => {
        const shard = K.slab([[0, 0], [r, r * 0.2], [r * 0.6, r * 0.9], [-r * 0.2, r * 0.5]], 0.004, 0xbfe3f5, { transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.1 });
        shard.rotation.set(-Math.PI / 2, 0, a); shard.position.set(x, 0.002, z); shard.castShadow = false; parts.push(shard);
      });
      return K.done(...parts);
    }

function imPaperweightModel() {
      const K = imKit();
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.04, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), K.mat(0xe0f2fe, { transparent: true, opacity: 0.4, roughness: 0.02 })); dome.scale.y = 0.85;
      const swirl = K.torus(0.018, 0.006, 0x2563eb, 0, 0.014, 0, { roughness: 0.2 }); swirl.rotation.x = Math.PI / 2.5;
      const swirl2 = K.torus(0.012, 0.005, 0xf97316, 0, 0.016, 0, { roughness: 0.2 }); swirl2.rotation.x = -Math.PI / 3;
      return K.done(swirl, swirl2, dome);
    }

function imWoodBlankModel(lower) {
      const K = imKit();
      const wood = /cherry/.test(lower) ? 0x9a4a2b : /walnut/.test(lower) ? 0x5c3a21 : /maple|birch/.test(lower) ? 0xdcb17c : /oak/.test(lower) ? 0xb88a52 : 0xc29a68;
      if (/pen/.test(lower)) return K.done(...[0, 1, 2].map(i => K.box(0.13, 0.02, 0.02, wood, 0, 0.01 + Math.floor(i / 2) * 0.02, (i % 2) * 0.022 - 0.011 + (i > 1 ? 0.011 : 0), IM.wood)));
      const disc = K.cyl(0.13, 0.13, 0.075, wood, 0, 0.0375, 0, IM.wood, 10);
      // end-grain sealed with green wax, the way turning blanks are sold
      const wax = K.cyl(0.1305, 0.1305, 0.004, 0x16a34a, 0, 0.0765, 0, { roughness: 0.4 }, 10);
      return K.done(disc, wax);
    }

function imHitchModel() {
      const K = imKit();
      const shank = K.box(0.3, 0.05, 0.05, 0x111827, -0.1, 0.03, 0, IM.iron);
      const plate = K.box(0.05, 0.08, 0.1, 0x111827, 0.07, 0.06, 0, IM.iron);
      const ball = K.ball(0.025, 0xd1d5db, 0.12, 0.13, 0, IM.chrome);
      const neck = K.cyl(0.015, 0.02, 0.04, 0xd1d5db, 0.12, 0.1, 0, IM.chrome);
      const pin = K.cyl(0.006, 0.006, 0.08, 0xd1d5db, -0.18, 0.03, 0, IM.steel); pin.rotation.x = Math.PI / 2;
      return K.done(shank, plate, ball, neck, pin);
    }

function imFilmModel() {
      const K = imKit();
      const box = K.box(0.04, 0.06, 0.03, 0xfacc15, -0.03, 0.03, 0, IM.paper);
      const can = K.cyl(0.0125, 0.0125, 0.05, 0x111827, 0.02, 0.0125, 0, IM.plastic); can.rotation.x = Math.PI / 2;
      const leader = K.box(0.03, 0.0005, 0.03, 0x7c2d12, 0.04, 0.001, 0.01, { roughness: 0.3 });
      return K.done(box, can, leader);
    }

function imFilterBagsModel() {
      const K = imKit();
      return K.done(...[0, 1, 2].map(i => { const b = K.cyl(0.075, 0.075, 1.2, 0xf5f5f4, 0, 0.075 + (i === 2 ? 0.13 : 0), (i - (i === 2 ? 1 : 0.5)) * 0.15, IM.cloth, 16); b.rotation.z = Math.PI / 2; return b; }));
    }

function imFindModel(lower) {
      const K = imKit();
      if (/coin/.test(lower)) {
        const silver = /silver|nickel|dime|quarter/.test(lower);
        const coin = K.cyl(0.0125, 0.0125, 0.0022, silver ? 0xd4d8dc : /copper|penny|cent/.test(lower) ? 0xb87333 : 0xd4a520, 0, 0.0011, 0, { metalness: 0.9, roughness: 0.35 }, 28);
        const rim = K.torus(0.0122, 0.0006, silver ? 0xc0c4c8 : 0xc29a20, 0, 0.0022, 0, { metalness: 0.9, roughness: 0.3 }); rim.rotation.x = Math.PI / 2;
        const relief = K.cyl(0.006, 0.006, 0.0004, silver ? 0xc0c4c8 : 0xc29a20, 0, 0.0023, 0, { metalness: 0.9, roughness: 0.5 });
        return K.done(coin, rim, relief);
      }
      if (/nugget/.test(lower)) {
        const n = new THREE.Mesh(new THREE.DodecahedronGeometry(0.012, 1), K.mat(0xd4a520, { metalness: 0.95, roughness: 0.3, flatShading: true }));
        n.scale.set(1.3, 0.6, 1); n.position.y = 0.007; n.castShadow = true;
        return K.done(n);
      }
      if (/arrowhead/.test(lower)) {
        const p = K.slab([[0, 0.05], [0.018, 0.005], [0.012, 0], [0.006, -0.008], [-0.006, -0.008], [-0.012, 0], [-0.018, 0.005]], 0.006, 0x1c1917, { roughness: 0.2, metalness: 0.1, flatShading: true });
        p.rotation.x = -Math.PI / 2; p.position.y = 0.003;
        return K.done(p);
      }
      if (/meteorite|obsidian/.test(lower)) {
        const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.04, 1), K.mat(/obsidian/.test(lower) ? 0x0b0b0f : 0x3f3a36, /obsidian/.test(lower) ? { roughness: 0.08, metalness: 0.2, flatShading: true } : { roughness: 0.7, metalness: 0.5, flatShading: true }));
        r.scale.set(1.2, 0.75, 1); r.position.y = 0.03; r.castShadow = true;
        return K.done(r);
      }
      if (/petrified/.test(lower)) {
        const log = K.cyl(0.07, 0.08, 0.2, 0x8a6a4f, 0, 0.075, 0, { roughness: 0.6, flatShading: true }, 9); log.rotation.z = Math.PI / 2;
        const rings = K.cyl(0.069, 0.069, 0.002, 0xb7894f, 0.101, 0.075, 0, { roughness: 0.3 }, 9); rings.rotation.z = Math.PI / 2;
        return K.done(log, rings);
      }
      if (/bone|rib/.test(lower)) {
        const shaft = K.tube([[-0.25, 0.03, 0], [-0.05, 0.05, 0.03], [0.15, 0.04, 0.06], [0.28, 0.025, 0.04]], 0.022, 0xe7dcc0, { roughness: 0.9 });
        const ends = [[-0.26, 0.03, 0], [0.29, 0.025, 0.04]].map(([x, y, z]) => K.ball(0.035, 0xd6c7a1, x, y, z, { roughness: 0.9 }));
        return K.done(shaft, ...ends);
      }
      // a fossil in its slab of stone: an ammonite's spiral, or a trilobite
      const slab = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08, 1), K.mat(0xc9b99a, { roughness: 0.95, flatShading: true }));
      slab.scale.set(1.2, 0.3, 1); slab.position.y = 0.024; slab.castShadow = true;
      const parts = [slab];
      if (/trilobite/.test(lower)) {
        const body = K.ball(0.03, 0x6b5b45, 0, 0.045, 0, { roughness: 0.7 }); body.scale.set(0.7, 0.25, 1.2); parts.push(body);
        for (let i = 0; i < 6; i++) parts.push(K.box(0.04, 0.006, 0.004, 0x5a4a36, 0, 0.05, -0.025 + i * 0.01));
      } else {
        const pts = [];
        for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 5, r = 0.004 + i / 60 * 0.045; pts.push([Math.cos(a) * r, 0.048, Math.sin(a) * r]); }
        parts.push(K.tube(pts, 0.006, 0x8b6b4a, { roughness: 0.6 }));
      }
      return K.done(...parts);
    }

function imIronModel() {
      const K = imKit();
      const plate = K.slab([[-0.13, -0.05], [0.07, -0.05], [0.13, 0], [0.07, 0.05], [-0.13, 0.05]], 0.02, 0xd1d5db, IM.chrome);
      plate.rotation.x = -Math.PI / 2; plate.position.y = 0.01;
      const shell = K.slab([[-0.12, -0.045], [0.06, -0.045], [0.115, 0], [0.06, 0.045], [-0.12, 0.045]], 0.04, 0x1d4ed8, IM.plastic);
      shell.rotation.x = -Math.PI / 2; shell.position.y = 0.04;
      const handle = K.tube([[-0.1, 0.06, 0], [-0.08, 0.13, 0], [0.04, 0.13, 0], [0.07, 0.06, 0]], 0.012, 0x1d4ed8, IM.plastic);
      const dial = K.cyl(0.015, 0.015, 0.008, 0xf8fafc, -0.02, 0.064, 0, IM.plastic);
      return K.done(plate, shell, handle, dial);
    }

function imDrillPressModel() {
      const K = imKit();
      const base = K.box(0.3, 0.04, 0.25, 0x1e3a8a, 0, 0.02, 0, IM.iron);
      const column = K.cyl(0.035, 0.035, 0.75, 0xd1d5db, 0, 0.415, -0.07, IM.chrome);
      const table = K.cyl(0.13, 0.13, 0.02, 0x52525b, 0, 0.32, 0.03, IM.iron, 24);
      const head = K.box(0.18, 0.18, 0.4, 0x1e3a8a, 0, 0.7, 0.05, IM.iron);
      const motor = K.cyl(0.07, 0.07, 0.15, 0x1e3a8a, 0, 0.7, -0.2, IM.iron); motor.rotation.x = Math.PI / 2;
      const quill = K.cyl(0.02, 0.02, 0.12, 0xd1d5db, 0, 0.55, 0.15, IM.chrome);
      const chuck = K.cyl(0.02, 0.015, 0.05, 0x52525b, 0, 0.47, 0.15, IM.steel);
      const handles = [0, 1, 2].map(i => { const a = i * 2.09; return K.rod([0.1, 0.65, 0.05], [0.1 + 0.02, 0.65 + Math.cos(a) * 0.15, 0.05 + Math.sin(a) * 0.15], 0.006, 0x111827); });
      return K.done(base, column, table, head, motor, quill, chuck, ...handles);
    }

function imScalesModel(lower) {
      const K = imKit();
      if (/aircraft|vehicle|\(3-?pad\)|pads/.test(lower)) {
        const parts = [];
        [-0.5, 0, 0.5].forEach((x, i) => parts.push(K.box(0.4, 0.05, 0.4, 0x1e3a8a, x, 0.025, i === 1 ? -0.5 : 0, IM.alu), K.box(0.36, 0.006, 0.36, 0x52525b, x, 0.053, i === 1 ? -0.5 : 0, IM.rubber)));
        parts.push(K.rr(0.25, 0.15, 0.08, 0.02, 0xfacc15, 0.6, 0, -0.5, IM.plastic), K.box(0.15, 0.001, 0.06, 0x1e293b, 0.6, 0.081, -0.5, IM.screen));
        return K.done(...parts);
      }
      const bath = /bathroom/.test(lower);
      return K.done(K.rr(bath ? 0.3 : 0.2, bath ? 0.3 : 0.16, 0.025, 0.02, bath ? 0xf8fafc : 0x9ca3af, 0, 0, 0, IM.plastic), K.box(0.06, 0.001, 0.025, 0x1e293b, 0, 0.0255, bath ? -0.1 : 0.05, IM.screen));
    }

function imSawMachineModel(lower) {
      const K = imKit();
      if (/table saw/.test(lower)) {
        const top = K.box(0.65, 0.04, 0.55, 0x9ca3af, 0, 0.32, 0, IM.alu);
        const body = K.box(0.5, 0.28, 0.42, 0xb91c1c, 0, 0.16, 0, IM.plastic);
        const blade = K.cyl(0.11, 0.11, 0.003, 0x52525b, 0, 0.34, 0, IM.steel, 28); blade.rotation.x = Math.PI / 2; blade.scale.set(1, 1, 1); blade.position.y = 0.3;
        const fence = K.box(0.05, 0.06, 0.55, 0x111827, 0.18, 0.37, 0, IM.alu);
        return K.done(top, body, blade, fence);
      }
      if (/scroll saw/.test(lower)) return K.done(K.box(0.5, 0.12, 0.25, 0x1e3a8a, 0, 0.06, 0, IM.iron), K.box(0.4, 0.02, 0.25, 0x9ca3af, 0, 0.13, 0, IM.alu), K.box(0.45, 0.06, 0.06, 0x1e3a8a, -0.02, 0.3, 0, IM.iron), K.box(0.002, 0.18, 0.004, 0xd1d5db, 0.18, 0.2, 0, IM.steel));
      // a mitre / chop saw: a round table, a pivoting arm with a guarded blade
      const base = K.box(0.45, 0.06, 0.35, 0x52525b, 0, 0.03, 0, IM.iron);
      const turntable = K.cyl(0.15, 0.15, 0.03, 0x9ca3af, 0, 0.075, 0, IM.alu, 24);
      const fence = K.box(0.45, 0.07, 0.03, 0x9ca3af, 0, 0.12, -0.08, IM.alu);
      const arm = K.box(0.08, 0.06, 0.3, /chop|abrasive|cut-?off/.test(lower) ? 0xdc2626 : 0x0e9aa7, 0, 0.32, -0.02, IM.plastic); arm.rotation.x = -0.6;
      const guard = K.cyl(0.13, 0.13, 0.05, 0xb6bcc4, 0, 0.26, 0.06, IM.alu, 24); guard.rotation.z = Math.PI / 2;
      const handle = K.box(0.04, 0.1, 0.04, 0x111827, 0, 0.42, 0.12, IM.rubber);
      return K.done(base, turntable, fence, arm, guard, handle);
    }

function imHandPlaneModel() {
      const K = imKit();
      const sole = K.box(0.16, 0.025, 0.05, 0x1e3a8a, 0, 0.0125, 0, IM.iron);
      const cap = K.box(0.06, 0.03, 0.04, 0x52525b, 0.0, 0.04, 0, IM.steel); cap.rotation.z = -0.6;
      const knob = K.cyl(0.012, 0.016, 0.03, 0x7c2d12, 0.055, 0.04, 0, IM.wood);
      const iron = K.box(0.004, 0.05, 0.035, 0xd1d5db, -0.005, 0.04, 0, IM.steel); iron.rotation.z = -0.6;
      return K.done(sole, cap, knob, iron);
    }

function imGasketModel() {
      const K = imKit(), parts = [K.box(0.18, 0.002, 0.24, 0xf8fafc, 0, 0.001, 0, IM.paper)];
      parts.push(...[[-0.04, -0.06, 0.035], [0.04, -0.06, 0.025], [0, 0.04, 0.05]].map(([x, z, r]) => { const g = K.torus(r, 0.004, 0x7c2d12, x, 0.004, z, { roughness: 0.6 }); g.rotation.x = Math.PI / 2; g.scale.z = 0.4; return g; }));
      parts.push(K.box(0.12, 0.002, 0.04, 0x52525b, 0, 0.004, 0.1, { roughness: 0.7 }));
      return K.done(...parts);
    }

function imPitcherModel(lower) {
      const K = imKit();
      const col = /blue/.test(lower) ? 0x1e40af : /white|milk/.test(lower) ? 0xf8fafc : 0xc8a27a;
      const body = K.lathe([[0, 0], [0.06, 0], [0.075, 0.06], [0.07, 0.15], [0.055, 0.2], [0.062, 0.22], [0.058, 0.22], [0.05, 0.2], [0.064, 0.15], [0.068, 0.06], [0.055, 0.008], [0, 0.008]], col, { ...IM.ceramic, side: THREE.DoubleSide }, 28);
      const spout = K.cyl(0.004, 0.02, 0.04, col, 0.065, 0.21, 0, IM.ceramic); spout.rotation.z = -1.1;
      const handle = K.torus(0.05, 0.01, col, -0.075, 0.13, 0, IM.ceramic, Math.PI); handle.rotation.z = Math.PI / 2;
      return K.done(body, spout, handle);
    }

// Workshop products whose shape is their own (called by madePartModel, js/machinemodels.js). The colour
// is the material it was made from; null for things madePartModel already shapes well.
function imMadeShapeModel(l) {
      const tone = /titanium|ebm/.test(l) ? [0x8f8f99, IM.alu] : /alumin/.test(l) ? [0xc8ccd0, IM.alu] : /bronze|brass/.test(l) ? [0xb08d57, { metalness: 0.9, roughness: 0.35 }]
        : /steel|stainless|metal|dmls|ded|binder/.test(l) ? [0xa8b0b8, { metalness: 0.85, roughness: 0.4 }] : /clear/.test(l) ? [0xdbeafe, { transparent: true, opacity: 0.5, roughness: 0.1 }]
        : /acrylic/.test(l) ? [0xdbeafe, { transparent: true, opacity: 0.6, roughness: 0.1 }] : /resin|sla|dlp|msla|polyjet/.test(l) ? [0x9ca3af, { roughness: 0.3 }]
        : /nylon|sls|mjf/.test(l) ? [0xe7e5e4, { roughness: 0.9 }] : /paper|lom/.test(l) ? [0xe7dcc0, IM.paper] : /mdf/.test(l) ? [0xa87442, IM.wood]
        : /plywood|ply|routed/.test(l) ? [0xdcb88a, IM.wood] : /petg|pla|fdm/.test(l) ? [0xf97316, IM.plastic] : [0xa8b0b8, { metalness: 0.85, roughness: 0.4 }];
      const [col, fin] = tone;
      const K = imKit();
      if (/pcb-milled|prototype board|controller board|\bcontroller\b/.test(l) && /pcb/.test(l)) return imCircuitBoardModel('pcb ' + l);
      if (/\bring\b|jewel+e?ry/.test(l)) { const r = K.torus(0.009, 0.0022, col, 0, 0.0115, 0, fin); return K.done(r, K.ball(0.003, col, 0, 0.022, 0, fin)); }
      if (/cable clip/.test(l)) return K.done(...[0, 1, 2, 3].map(i => { const c = K.torus(0.006, 0.0025, col, i * 0.02, 0.008, 0, fin, Math.PI * 1.5); return group(c, K.box(0.012, 0.003, 0.012, col, i * 0.02, 0.0015, 0, fin)); }));
      if (/hinge/.test(l)) return K.done(K.box(0.04, 0.003, 0.03, col, -0.022, 0.0015, 0, fin), K.box(0.04, 0.003, 0.03, col, 0.022, 0.0015, 0, fin), (() => { const k = K.cyl(0.004, 0.004, 0.03, col, 0, 0.004, 0, fin); k.rotation.x = Math.PI / 2; return k; })());
      if (/drone arm|frame plate|drone frame/.test(l)) return K.done(K.box(0.15, 0.004, 0.02, col, 0, 0.002, 0, fin), K.cyl(0.016, 0.016, 0.004, col, 0.075, 0.002, 0, fin), ...(/plate|frame/.test(l) ? [K.box(0.02, 0.004, 0.15, col, 0, 0.002, 0, fin)] : []));
      if (/enclosure|prototype|housing/.test(l)) { const b = K.rr(0.12, 0.08, 0.035, 0.008, col, 0, 0, 0, fin); return K.done(b, K.rr(0.122, 0.082, 0.006, 0.008, col, 0, 0.035, 0, fin), ...[[-0.05, -0.03], [0.05, -0.03], [-0.05, 0.03], [0.05, 0.03]].map(([x, z]) => K.cyl(0.0025, 0.0025, 0.001, 0x52525b, x, 0.0415, z))); }
      if (/cabinet door|door panel/.test(l)) return K.done(K.box(0.4, 0.6, 0.018, col, 0, 0.3, 0, fin), K.box(0.3, 0.5, 0.004, col, 0, 0.3, 0.008, fin), K.box(0.012, 0.1, 0.02, 0x52525b, 0.16, 0.3, 0.018, IM.steel));
      if (/speaker baffle|baffle/.test(l)) return K.done(K.box(0.24, 0.36, 0.018, col, 0, 0.18, 0, fin), ...[[0.1, 0.1], [0.25, 0.04]].map(([y, r]) => { const h = K.cyl(r, r, 0.019, 0x1c1917, 0, y, 0.0005, IM.matte, 24); h.rotation.x = Math.PI / 2; return h; }));
      if (/front panel|control panel/.test(l)) return K.done(K.box(0.3, 0.12, 0.004, col, 0, 0.06, 0, fin), ...[-0.1, -0.03, 0.04, 0.11].map(x => { const h = K.cyl(0.008, 0.008, 0.005, 0x111827, x, 0.06, 0); h.rotation.x = Math.PI / 2; return h; }));
      if (/shelving|shelves/.test(l)) return imFurnitureModel('bookshelf ' + (/ply/.test(l) ? 'birch' : ''));
      if (/carcass|cabinet\b/.test(l)) return K.done(K.box(0.018, 0.7, 0.5, col, -0.3, 0.35, 0, fin), K.box(0.018, 0.7, 0.5, col, 0.3, 0.35, 0, fin), K.box(0.6, 0.018, 0.5, col, 0, 0.009, 0, fin), K.box(0.6, 0.018, 0.5, col, 0, 0.69, 0, fin), K.box(0.6, 0.7, 0.006, col, 0, 0.35, -0.247, fin), K.box(0.58, 0.018, 0.48, col, 0, 0.35, 0, fin));
      if (/workbench top|bench top|table top/.test(l)) return K.done(K.box(1.5, 0.04, 0.7, col, 0, 0.02, 0, fin), K.box(1.5, 0.04, 0.7, col, 0, 0.06, 0, fin));
      if (/kayak rack|bike rack|rack\b/.test(l)) return K.done(...[-0.4, 0.4].map(x => K.box(0.05, 1.2, 0.05, col, x, 0.6, 0, fin)), ...[0.4, 0.8].map(y => K.box(0.9, 0.04, 0.4, col, 0, y, 0.18, fin)), K.box(0.9, 0.05, 0.4, col, 0, 0.025, 0, fin));
      if (/seat back/.test(l)) { const p = K.box(0.4, 0.45, 0.012, col, 0, 0.225, 0, fin); p.rotation.x = -0.15; return K.done(p); }
      if (/floor pan/.test(l)) return K.done(K.box(0.6, 0.012, 0.5, col, 0, 0.006, 0, fin));
      if (/duct/.test(l)) { const d = K.cyl(0.04, 0.05, 0.18, col, 0, 0.05, 0, { ...fin, side: THREE.DoubleSide }); d.rotation.z = Math.PI / 2; return K.done(d); }
      if (/insole/.test(l)) { const s = K.slab([[-0.04, 0], [0.04, 0], [0.045, 0.12], [0.035, 0.24], [0, 0.26], [-0.035, 0.24], [-0.04, 0.12]], 0.008, col, fin); s.rotation.x = -Math.PI / 2; s.position.set(0, 0.004, 0.13); return K.done(s); }
      if (/implant cup|acetabular/.test(l)) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.027, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), K.mat(col, { ...fin, side: THREE.DoubleSide })); c.rotation.x = Math.PI; c.position.y = 0.027; c.castShadow = true; return K.done(c); }
      if (/architectural model|architecture/.test(l)) return K.done(K.box(0.3, 0.008, 0.2, col, 0, 0.004, 0, fin), ...[[-0.08, 0.06, 0.05], [0.03, 0.12, -0.03], [0.1, 0.04, 0.05]].map(([x, h, z]) => K.box(0.07, h, 0.06, col, x, 0.008 + h / 2, z, fin)));
      if (/mold pattern|mould pattern|mold plate|mould plate/.test(l)) return K.done(K.box(0.2, 0.04, 0.15, col, 0, 0.02, 0, fin), K.cyl(0.04, 0.03, 0.005, 0x52525b, 0, 0.0405, 0, fin));
      if (/gusset/.test(l)) { const g = K.slab([[0, 0], [0.1, 0], [0, 0.1]], 0.005, col, fin); g.rotation.x = -Math.PI / 2; g.position.y = 0.0025; return K.done(g); }
      if (/fire pit/.test(l)) return K.done(K.lathe([[0, 0.02], [0.3, 0.02], [0.38, 0.3], [0.375, 0.3], [0.295, 0.025], [0, 0.025]], 0x3f3a36, { metalness: 0.6, roughness: 0.75, side: THREE.DoubleSide }, 28), ...[0, 1, 2].map(i => { const a = i * 2.09; return K.rod([Math.cos(a) * 0.25, 0.02, Math.sin(a) * 0.25], [Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3], 0.012, 0x3f3a36, IM.iron); }));
      if (/phone stand/.test(l)) { const s = K.slab([[0, 0], [0.08, 0], [0.08, 0.008], [0.02, 0.008], [0.045, 0.1], [0.037, 0.1], [0.01, 0.008], [0, 0.03]], 0.07, col, fin); return K.done(s); }
      if (/coaster/.test(l)) return imCoasterModel(l);
      if (/dash mount|mount\b/.test(l)) return K.done(K.box(0.08, 0.004, 0.05, col, 0, 0.002, 0, fin), K.box(0.004, 0.06, 0.05, col, -0.038, 0.03, 0, fin), K.cyl(0.012, 0.012, 0.02, 0x111827, 0, 0.012, 0));
      return null;
    }

function imHookModel() {
      const K = imKit();
      const plate = K.box(0.03, 0.06, 0.006, 0xf97316, 0, 0.03, 0, IM.plastic);
      const hook = K.tube([[0, 0.02, 0.003], [0, 0.015, 0.03], [0, 0.03, 0.045], [0, 0.045, 0.04]], 0.005, 0xf97316, IM.plastic);
      return K.done(plate, hook);
    }

function imWhistleModel() {
      const K = imKit();
      const barrel = K.cyl(0.012, 0.012, 0.03, 0xf97316, 0, 0.012, 0, IM.plastic); barrel.rotation.x = Math.PI / 2;
      const mouth = K.box(0.012, 0.008, 0.03, 0xf97316, 0, 0.016, -0.028, IM.plastic);
      const ring = K.torus(0.006, 0.0015, 0xf97316, 0, 0.012, 0.02, IM.plastic);
      return K.done(barrel, mouth, ring);
    }

function imStarModel() {
      const K = imKit(), pts = [];
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.018 : 0.045; pts.push([Math.cos(a) * r, Math.sin(a) * r + 0.05]); }
      const star = K.slab(pts, 0.008, 0xfacc15, { metalness: 0.4, roughness: 0.3 });
      const loop = K.torus(0.006, 0.0015, 0xd1d5db, 0, 0.1, 0, IM.steel);
      return K.done(star, loop);
    }
