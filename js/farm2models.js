// Kelo-bot-1 — js/farm2models.js
// Loaded after farmlife.js. Original models (made here in code) for stage 2 of the farm: the packing shed,
// hay shed, chicken coop, milk house, barn stalls and pump house (staged like stage 1's buildings), the
// compact tractor, the hay, vegetable and orchard implements, the vegetable and hay clumps, the orchard
// trees (instanced: trunks, canopies, blossom, fruit), the animals (instanced bodies and heads, so a cow
// can lower her head to graze), bales, swaths and windrows, and the pasture fence. Repeated things are
// InstancedMesh, one draw call per kind; js/farm2.js decides what is shown at each graphics level.

// --- Little geometry helpers (vertex-coloured parts merged into one geometry) -------------------------------
function farm2Part(geo, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
      if (rx) geo.rotateX(rx); if (ry) geo.rotateY(ry); if (rz) geo.rotateZ(rz);
      geo.translate(x, y, z);
      const g = geo.index ? geo.toNonIndexed() : geo;
      g.computeVertexNormals();
      const n = g.attributes.position.count, c = new THREE.Color(hex), col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    }
function farm2Ellipsoid(rx, ry, rz, hex, x, y, z, seg = 8) { const g = new THREE.SphereGeometry(1, seg, Math.max(4, seg - 2)); g.scale(rx, ry, rz); return farm2Part(g, hex, x, y, z); }
function farm2BoxG(w, h, d, hex, x, y, z, rx, ry, rz) { return farm2Part(new THREE.BoxGeometry(w, h, d), hex, x, y, z, rx, ry, rz); }
function farm2CylG(rt, rb, h, seg, hex, x, y, z, rx, ry, rz) { return farm2Part(new THREE.CylinderGeometry(rt, rb, h, seg), hex, x, y, z, rx, ry, rz); }
let farm2VCMat = null;
function farm2VertexMat() {
      if (!farm2VCMat) farm2VCMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02 });
      return farm2VCMat;
    }
function farm2Instanced(geo, max, name, mat = null) {
      const im = new THREE.InstancedMesh(geo, mat || farm2VertexMat(), Math.max(1, max));
      im.name = name; im.count = 0; im.castShadow = false; im.receiveShadow = true;
      if (typeof chunkDynamic !== 'undefined') chunkDynamic.add(im);
      return im;
    }
// Bounds for an instanced mesh from the points it holds (the frustum patch in js/farm.js reads them)
function farm2Bounds(im, pts, pad = 4) {
      const box = new THREE.Box3();
      pts.forEach(p => box.expandByPoint(p));
      box.expandByScalar(pad);
      im.boundingSphere = box.isEmpty() ? null : box.getBoundingSphere(new THREE.Sphere());
    }

// --- Buildings (staged: frame, walls, roof, fit; door side south, +z) ----------------------------------------
function farm2BuildingModel(key) {
      const U = FARM_U, B = FARM_BUILDINGS[key], g = new THREE.Group();
      const W = B.w * U, D = B.d * U, fy = 0.25;
      const stages = { frame: [], walls: [], roof: [], fit: [] };
      const put = (stage, m) => { stages[stage].push(m); g.add(m); return m; };
      const wood = farmMat(0xb08a5a, { roughness: 0.8 }), steel = farmMat(FARM_PAINT.galv, { metalness: 0.55, roughness: 0.4 }), dark = farmMat(FARM_PAINT.dark, { roughness: 0.7 });
      const white = farmMat(FARM_PAINT.white, { roughness: 0.55 }), stainless = farmMat(0xc9d0d4, { metalness: 0.8, roughness: 0.25 });
      // a simple gable building: posts, walls (with a door gap on the south), a roof of two slopes
      const gable = (H, wallMat, roofMat, pitch = 0.32, doorW = 2.4) => {
        for (let x = -W / 2; x <= W / 2 + 0.01; x += 2 * U) [-D / 2, D / 2].forEach(z => put('frame', fBox(0.16 * U, H, 0.16 * U, wood, x, fy + H / 2, z)));
        put('frame', fBox(W, 0.18 * U, 0.18 * U, wood, 0, fy + H, D / 2)); put('frame', fBox(W, 0.18 * U, 0.18 * U, wood, 0, fy + H, -D / 2));
        put('walls', fBox(W, H, 0.1 * U, wallMat, 0, fy + H / 2, -D / 2));
        [-1, 1].forEach(s => put('walls', fBox(0.1 * U, H, D, wallMat, s * W / 2, fy + H / 2, 0)));
        const side = (W - doorW * U) / 2;
        [-1, 1].forEach(s => put('walls', fBox(side, H, 0.1 * U, wallMat, s * (doorW * U / 2 + side / 2), fy + H / 2, D / 2)));
        put('walls', fBox(doorW * U, H - 2.4 * U, 0.1 * U, wallMat, 0, fy + 2.4 * U + (H - 2.4 * U) / 2, D / 2));
        const half = D / 2 + 0.4 * U, slope = half / Math.cos(pitch);
        [-1, 1].forEach(s => { const r = put('roof', fBox(W + 0.6 * U, 0.12 * U, slope, roofMat, 0, fy + H + Math.tan(pitch) * half / 2, s * half / 2)); r.rotation.x = s * pitch; });
        const tri = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, Math.tan(pitch) * D / 2)]);
        [-1, 1].forEach(s => { const gm = new THREE.Mesh(new THREE.ShapeGeometry(tri), farmMat(wallMat.color.getHex(), { roughness: 0.75, side: THREE.DoubleSide })); gm.rotation.y = Math.PI / 2; gm.position.set(s * W / 2, fy + H, 0); put('roof', gm); });
      };
      if (key === 'packshed') {
        gable(3.6 * U, farmMat(0x6d8a7a, { roughness: 0.6, metalness: 0.2 }), farmMat(0x3f4347, { roughness: 0.8 }));
        // the walk-in cooler box, the barrel washer, the packing table with crates
        put('fit', fBox(3 * U, 2.6 * U, 4 * U, white, -W / 2 + 1.7 * U, fy + 1.3 * U, -D / 2 + 2.2 * U));
        put('fit', fBox(0.5 * U, 0.4 * U, 0.15 * U, dark, -W / 2 + 1.7 * U, fy + 2.75 * U, -D / 2 + 0.25 * U));
        put('fit', fCyl(0.5 * U, 0.5 * U, 2.2 * U, 14, stainless, 1.5 * U, fy + 1.0 * U, 0.2 * U, null, 'z'));
        put('fit', fBox(3.2 * U, 0.08 * U, 1.0 * U, stainless, 1.4 * U, fy + 0.9 * U, -2.2 * U));
        [[0.4, -2.2], [1.6, -2.2], [2.6, -2.2]].forEach(([x, z]) => put('fit', fBox(0.55 * U, 0.3 * U, 0.4 * U, farmMat(0xa8794a, { roughness: 0.9 }), x * U, fy + 1.1 * U, z * U)));
        put('fit', fBox(1.3 * U, 0.3 * U, 0.06 * U, farmMat(0x2e5d3a, { roughness: 0.6 }), 0, fy + 3.0 * U, D / 2 + 0.12 * U));
      } else if (key === 'hayshed') {
        // open-sided pole shed: poles, trusses, a single-slope steel roof; the bales are drawn by js/farm2.js
        const H = 5.2 * U;
        for (let x = -W / 2; x <= W / 2 + 0.01; x += W / 5) [-D / 2, D / 2].forEach(z => put('frame', fBox(0.22 * U, H + (z < 0 ? 0.8 * U : 0), 0.22 * U, wood, x, fy + (H + (z < 0 ? 0.8 * U : 0)) / 2, z)));
        for (let x = -W / 2; x <= W / 2 + 0.01; x += W / 8) put('frame', fRod([x, fy + H, D / 2], [x, fy + H + 0.8 * U, -D / 2], 0.08 * U, wood));
        put('walls', fBox(W, 0.6 * U, 0.08 * U, wood, 0, fy + 0.3 * U, -D / 2));
        const r = put('roof', fBox(W + 0.8 * U, 0.1 * U, D + 1.2 * U, farmMat(0x5e6a72, { metalness: 0.4, roughness: 0.5 }), 0, fy + H + 0.45 * U, 0)); r.rotation.x = Math.atan2(0.8 * U, D);
      } else if (key === 'coop') {
        const H = 2.2 * U, red = farmMat(0xa8452f, { roughness: 0.75 });
        [-1, 1].forEach(s => put('frame', fBox(W, 0.25 * U, 0.2 * U, wood, 0, 0.12 * U, s * (D / 2 - 0.2 * U))));
        for (let x = -W / 2; x <= W / 2 + 0.01; x += 1.2 * U) [-D / 2, D / 2].forEach(z => put('frame', fBox(0.1 * U, H, 0.1 * U, wood, x, 0.25 * U + H / 2, z)));
        put('walls', fBox(W, H, 0.08 * U, red, 0, 0.25 * U + H / 2, -D / 2)); put('walls', fBox(W, H, 0.08 * U, red, 0, 0.25 * U + H / 2, D / 2));
        [-1, 1].forEach(s => put('walls', fBox(0.08 * U, H, D, red, s * W / 2, 0.25 * U + H / 2, 0)));
        put('walls', fBox(0.8 * U, 1.8 * U, 0.06 * U, white, -W / 4, 0.25 * U + 0.9 * U, D / 2 + 0.06 * U));
        put('walls', fBox(0.35 * U, 0.4 * U, 0.06 * U, dark, W / 2 - 0.6 * U, 0.45 * U, D / 2 + 0.06 * U));
        put('walls', fBox(0.9 * U, 0.6 * U, 0.05 * U, farmMat(0x8fb3c2, { roughness: 0.15 }), W / 4, 0.25 * U + 1.4 * U, D / 2 + 0.06 * U));
        // the nest-box bank sticking out of the west wall, lid hinged
        put('fit', fBox(0.6 * U, 0.7 * U, 2.4 * U, red, -W / 2 - 0.3 * U, 0.25 * U + 0.8 * U, 0));
        put('fit', fBox(0.75 * U, 0.06 * U, 2.5 * U, farmMat(0x3f4347, { roughness: 0.8 }), -W / 2 - 0.32 * U, 0.25 * U + 1.2 * U, 0));
        const r = put('roof', fBox(W + 0.6 * U, 0.08 * U, D + 0.8 * U, farmMat(0x5e6a72, { metalness: 0.4, roughness: 0.5 }), 0, 0.25 * U + H + 0.3 * U, 0)); r.rotation.x = -0.18;
        put('fit', fRod([W / 2 - 0.5 * U, 0.3, D / 2 + 0.1 * U], [W / 2 + 0.3 * U, 0.02, D / 2 + 1.0 * U], 0.12 * U, wood));
      } else if (key === 'milkhouse') {
        gable(3.4 * U, white, farmMat(0x3f4347, { roughness: 0.8 }), 0.35, 2.0);
        // the robot box with its arm, the bulk tank, the pasteurizer and the bottle filler
        put('fit', fBox(2.8 * U, 1.8 * U, 1.2 * U, farmMat(0x9aa4ab, { metalness: 0.5, roughness: 0.35 }), -W / 2 + 1.8 * U, fy + 0.9 * U, 0.6 * U));
        put('fit', fBox(0.9 * U, 0.5 * U, 0.6 * U, farmMat(0xe25c2a, { roughness: 0.5 }), -W / 2 + 1.6 * U, fy + 0.5 * U, 1.4 * U));
        const tank = put('fit', fCyl(0.8 * U, 0.8 * U, 2.4 * U, 18, stainless, 1.2 * U, fy + 1.1 * U, -1.6 * U, null, 'z'));
        tank.userData.tank = true;
        put('fit', fCyl(0.45 * U, 0.45 * U, 1.0 * U, 14, stainless, 2.4 * U, fy + 0.7 * U, 1.2 * U));
        put('fit', fBox(1.2 * U, 0.9 * U, 0.6 * U, stainless, 0.4 * U, fy + 0.45 * U, 2.5 * U));
        put('fit', fBox(1.6 * U, 0.35 * U, 0.06 * U, farmMat(0x2b4f7a, { roughness: 0.6 }), 0, fy + 3.0 * U, D / 2 + 0.12 * U));
      } else if (key === 'stalls') {
        // inside the barn: free-stall loops in two rows, rubber mats, a feed alley with headlocks, waterers
        const galv = farmMat(FARM_PAINT.galv, { metalness: 0.7, roughness: 0.3 }), mat = farmMat(0x1d1f22, { roughness: 0.95 });
        for (let i = 0; i < 6; i++) [-1, 1].forEach(s => {
          const z = -D / 2 + 2 * U + i * 2.2 * U, x = s * (W / 2 - 1.3 * U);
          put('frame', fRod([x - 1.1 * U, fy + 0.2 * U, z], [x - 1.1 * U, fy + 1.1 * U, z], 0.05 * U, galv));
          put('frame', fRod([x - 1.1 * U, fy + 1.1 * U, z], [x + 1.1 * U, fy + 1.1 * U, z], 0.05 * U, galv));
          put('walls', fBox(2.2 * U, 0.06 * U, 1.1 * U, mat, x, fy + 0.05 * U, z + 0.6 * U));
        });
        [-1, 1].forEach(s => put('roof', fBox(0.15 * U, 1.2 * U, D * 0.8, galv, s * 1.4 * U, fy + 0.6 * U, 0)));
        put('roof', fBox(2.4 * U, 0.12 * U, D * 0.8, farmMat(0xbfb9ab, { roughness: 0.9 }), 0, fy + 0.06 * U, 0));
        [-1, 1].forEach(s => put('fit', fBox(0.6 * U, 0.7 * U, 0.6 * U, galv, s * (W / 2 - 0.5 * U), fy + 0.35 * U, D / 2 - 1.5 * U)));
      } else if (key === 'well') {
        const H = 2.4 * U;
        gable(H, farmMat(0x8a6a48, { roughness: 0.8 }), farmMat(0x5e6a72, { metalness: 0.4, roughness: 0.5 }), 0.45, 1.0);
        put('fit', fCyl(0.35 * U, 0.35 * U, 1.1 * U, 12, farmMat(0x2f6fa5, { roughness: 0.4 }), 0.6 * U, fy + 0.55 * U, -0.6 * U));
        put('fit', fCyl(0.12 * U, 0.12 * U, 0.6 * U, 8, steel, -0.7 * U, fy + 0.3 * U, -0.5 * U));
      }
      g.userData.stages = stages;
      g.userData.key = key;
      return g;
    }
if (typeof farmBuildingModel === 'function') {
  const farm2OrigBuildingModel = farmBuildingModel;
  farmBuildingModel = function (key) { return FARM_BUILDINGS[key] && FARM_BUILDINGS[key].stage2 ? farm2BuildingModel(key) : farm2OrigBuildingModel(key); };
}

// --- The compact tractor (55 hp, front loader, open ROPS, 3-point hitch) ---------------------------------------
function farm2CompactModel() {
      const U = FARM_U, b = new THREE.Group();
      const paint = farmMat(FARM_PAINT.body, { roughness: 0.32, metalness: 0.15 }), dark = farmMat(FARM_PAINT.dark, { roughness: 0.7 }), yellow = farmMat(FARM_PAINT.yellow, { roughness: 0.4 });
      const rr = 0.62 * U, fr = 0.42 * U, ax = -0.8 * U, fx = 1.0 * U;
      [-1, 1].forEach(s => { const w = fWheel(rr, 0.38 * U); w.position.set(ax, rr, s * 0.72 * U); b.add(w); });
      const fronts = [-1, 1].map(s => { const p = new THREE.Group(); p.position.set(fx, fr, s * 0.6 * U); p.add(fWheel(fr, 0.26 * U)); p.userData.steer = true; b.add(p); return p; });
      fBox(1.8 * U, 0.6 * U, 0.6 * U, paint, 0.55 * U, 1.0 * U, 0, b);
      fBox(0.3 * U, 0.5 * U, 0.58 * U, dark, 1.5 * U, 0.95 * U, 0, b);
      fBox(0.9 * U, 0.7 * U, 0.8 * U, paint, -0.75 * U, 0.95 * U, 0, b);
      [-1, 1].forEach(s => fBox(0.9 * U, 0.06 * U, 0.35 * U, paint, -0.8 * U, 1.35 * U, s * 0.55 * U, b));
      fBox(0.4 * U, 0.12 * U, 0.4 * U, dark, -0.85 * U, 1.42 * U, 0, b);
      fBox(0.08 * U, 0.4 * U, 0.4 * U, dark, -1.05 * U, 1.65 * U, 0, b);
      // the roll bar
      [-1, 1].forEach(s => fRod([-1.2 * U, 1.3 * U, s * 0.5 * U], [-1.2 * U, 2.55 * U, s * 0.5 * U], 0.05 * U, dark, b));
      fRod([-1.2 * U, 2.55 * U, -0.5 * U], [-1.2 * U, 2.55 * U, 0.5 * U], 0.05 * U, dark, b);
      const steer = new THREE.Mesh(new THREE.TorusGeometry(0.15 * U, 0.02 * U, 8, 16), dark); steer.rotation.y = Math.PI / 2; steer.rotation.x = 0.7; steer.position.set(-0.4 * U, 1.7 * U, 0); b.add(steer);
      fCyl(0.04 * U, 0.04 * U, 0.7 * U, 8, dark, 0.4 * U, 1.6 * U, 0.2 * U, b);
      // the loader: two arms from the towers to a bucket ahead of the nose
      [-1, 1].forEach(s => { fBox(0.12 * U, 0.6 * U, 0.12 * U, yellow, 0.2 * U, 1.3 * U, s * 0.42 * U, b); fRod([0.2 * U, 1.55 * U, s * 0.45 * U], [1.9 * U, 0.6 * U, s * 0.45 * U], 0.06 * U, yellow, b); });
      fBox(0.5 * U, 0.4 * U, 1.3 * U, yellow, 2.1 * U, 0.4 * U, 0, b);
      [-1, 1].forEach(s => fRod([-1.2 * U, 0.65 * U, s * 0.18 * U], [-1.6 * U, 0.5 * U, s * 0.3 * U], 0.04 * U, dark, b));
      const hitch = new THREE.Object3D(); hitch.position.set(-1.65 * U, 0.5 * U, 0); b.add(hitch);
      const seat = { x: -0.85 * U, y: 1.5 * U - KELO_SIT_OFFSET, z: 0 };
      return miniature(farmJoin(b), { seat, hitch, fronts, farm: 'compact' });
    }
if (typeof ITEM_MODEL_RULES !== 'undefined') ITEM_MODEL_RULES.unshift([/compact utility tractor|\b55 hp\b/i, () => farm2CompactModel()]);

// --- Stage 2 implements (+x toward the tractor, hitch at the origin) ----------------------------------------
function farm2ImplementModel(key) {
      const U = FARM_U, g = new THREE.Group(), I = FARM_IMPLEMENTS[key], parts = g.userData;
      const paint = farmMat(0xc0392b, { roughness: 0.4, metalness: 0.15 }), dark = farmMat(FARM_PAINT.dark, { roughness: 0.7 }), steel = farmMat(FARM_PAINT.steel, { metalness: 0.75, roughness: 0.35 });
      const green = farmMat(0x2f7a3a, { roughness: 0.4, metalness: 0.1 }), W = (I.widthM || 2) * U;
      const wheel = (r, w, x, z) => { const k = fWheel(r * U, w * U, false); k.position.set(x * U, r * U, z * U); g.add(k); return k; };
      if (key === 'tiller') {
        fBox(0.8 * U, 0.5 * U, W, paint, -0.6 * U, 0.45 * U, 0, g);
        const rotor = fCyl(0.22 * U, 0.22 * U, W * 0.95, 10, steel, -0.6 * U, 0.22 * U, 0, g, 'x'); rotor.userData.wheelRadius = 0.08;
        fBox(0.6 * U, 0.05 * U, W, dark, -1.1 * U, 0.3 * U, 0, g);
      } else if (key === 'planter') {
        fBox(0.3 * U, 0.2 * U, W, dark, -0.3 * U, 0.6 * U, 0, g);
        [-0.45, 0.45].forEach(z => { fBox(0.5 * U, 0.5 * U, 0.4 * U, green, -0.8 * U, 0.95 * U, z * U, g); wheel(0.25, 0.12, -1.25, z); fRod([-0.6 * U, 0.6 * U, z * U], [-0.6 * U, 0.05 * U, z * U], 0.03 * U, steel, g); });
        fCyl(0.2 * U, 0.2 * U, 0.3 * U, 10, dark, -0.5 * U, 1.0 * U, 0, g);
      } else if (key === 'cultivator') {
        fBox(0.25 * U, 0.2 * U, W, paint, -0.4 * U, 0.6 * U, 0, g);
        for (let i = 0; i < 8; i++) { const z = -W / 2 + (i + 0.5) * W / 8; fRod([-0.4 * U, 0.6 * U, z], [-0.75 * U, 0.04 * U, z], 0.025 * U, steel, g); }
        [-0.7, 0.7].forEach(z => wheel(0.2, 0.1, -0.2, z));
      } else if (key === 'digger') {
        fBox(1.6 * U, 0.15 * U, 1.0 * U, paint, -1.1 * U, 0.55 * U, 0, g);
        const chain = fBox(1.4 * U, 0.06 * U, 0.8 * U, steel, -1.1 * U, 0.35 * U, 0, g); chain.rotation.z = 0.25; parts.chain = chain;
        fBox(0.3 * U, 0.05 * U, 0.9 * U, steel, -0.25 * U, 0.08 * U, 0, g);
        [-0.6, 0.6].forEach(z => wheel(0.3, 0.15, -1.6, z));
      } else if (key === 'airblast') {
        fRod([0, 0.5 * U, 0], [-1.2 * U, 0.6 * U, 0], 0.05 * U, dark, g);
        fCyl(0.55 * U, 0.55 * U, 1.6 * U, 16, farmMat(0xe8e2d0, { roughness: 0.4 }), -2.0 * U, 0.85 * U, 0, g, 'z');
        fCyl(0.75 * U, 0.75 * U, 0.4 * U, 18, paint, -3.0 * U, 0.85 * U, 0, g, 'z');
        const fan = new THREE.Group(); fan.position.set(-3.25 * U, 0.85 * U, 0);
        for (let i = 0; i < 6; i++) { const blade = fBox(0.03 * U, 0.6 * U, 0.12 * U, dark, 0, 0.3 * U, 0, null); const hold = new THREE.Group(); hold.rotation.x = i / 6 * Math.PI * 2; hold.add(blade); fan.add(hold); }
        g.add(fan); parts.blower = fan;
        [-0.65, 0.65].forEach(z => wheel(0.35, 0.18, -2.0, z));
        const mist = new THREE.Mesh(new THREE.SphereGeometry(1.4 * U, 10, 8), new THREE.MeshBasicMaterial({ color: 0xe8f4f8, transparent: true, opacity: 0.22, depthWrite: false }));
        mist.scale.set(0.5, 0.9, 1.6); mist.position.set(-3.6 * U, 1.2 * U, 0); mist.visible = false; g.add(mist); parts.mist = mist;
      } else if (key === 'mower') {
        fRod([0, 0.5 * U, 0], [-1.6 * U, 0.6 * U, 1.0 * U], 0.07 * U, paint, g);
        fBox(1.4 * U, 0.9 * U, W, paint, -2.2 * U, 0.6 * U, 1.0 * U, g);
        fBox(1.5 * U, 0.12 * U, W, dark, -1.6 * U, 0.08 * U, 1.0 * U, g);
        const rolls = fCyl(0.15 * U, 0.15 * U, W * 0.9, 10, dark, -2.4 * U, 0.3 * U, 1.0 * U, g, 'x'); rolls.userData.wheelRadius = 0.06;
        [-1, 1].forEach(s => wheel(0.35, 0.18, -2.6, 1.0 + s * (W / U / 2 + 0.2)));
      } else if (key === 'tedder') {
        fBox(0.2 * U, 0.2 * U, W, dark, -1.0 * U, 0.9 * U, 0, g);
        fRod([0, 0.5 * U, 0], [-1.0 * U, 0.9 * U, 0], 0.06 * U, dark, g);
        parts.spinners = [];
        for (let i = 0; i < 4; i++) {
          const z = -W / 2 + (i + 0.5) * W / 4, rotor = new THREE.Group(); rotor.position.set(-1.2 * U, 0.55 * U, z);
          for (let k = 0; k < 6; k++) { const arm = fBox(0.6 * U, 0.04 * U, 0.04 * U, paint, 0.3 * U, 0, 0, null); const h = new THREE.Group(); h.rotation.y = k / 6 * Math.PI * 2; h.add(arm); const tine = fBox(0.03 * U, 0.4 * U, 0.03 * U, steel, 0.6 * U, -0.2 * U, 0, null); h.add(tine); rotor.add(h); }
          rotor.rotation.x = 0.15; rotor.userData.spinY = i % 2 ? 1 : -1; g.add(rotor); parts.spinners.push(rotor);
          wheel(0.2, 0.08, -1.2, z / U);
        }
      } else if (key === 'rake') {
        fRod([0, 0.5 * U, 0], [-3.4 * U, 0.6 * U, 0], 0.07 * U, paint, g);
        [-1, 1].forEach(s => { fRod([-0.6 * U, 0.65 * U, 0], [-3.6 * U, 0.65 * U, s * W / 2], 0.06 * U, paint, g); for (let i = 0; i < 4; i++) { const t = (i + 0.5) / 4; const rw = new THREE.Group(); rw.position.set((-0.6 - 3.0 * t) * U, 0.6 * U, s * W / 2 * t); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6 * U, 0.03 * U, 4, 16), steel); rw.add(ring); for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; const tn = fBox(0.03 * U, 0.25 * U, 0.03 * U, steel, Math.cos(a) * 0.72 * U, Math.sin(a) * 0.72 * U, 0, null); tn.rotation.z = a - Math.PI / 2; rw.add(tn); } rw.rotation.y = s * 0.6; rw.userData.wheelRadius = 0.6 * U; g.add(rw); } });
        wheel(0.3, 0.15, -3.6, 0);
      } else if (key === 'baler' || key === 'squarebaler') {
        const sq = key === 'squarebaler';
        fRod([0, 0.5 * U, 0], [-1.6 * U, 0.8 * U, sq ? 1.0 * U : 0], 0.07 * U, dark, g);
        const body = sq ? [3.4, 1.2, 0.7] : [1.9, 2.1, 2.2];
        fBox(body[0] * U, body[1] * U, body[2] * U, sq ? farmMat(0x2f7a3a, { roughness: 0.4 }) : paint, -(1.6 + body[0] / 2) * U, (0.45 + body[1] / 2) * U, sq ? 1.0 * U : 0, g);
        if (!sq) { const gate = fBox(0.15 * U, 1.9 * U, 2.0 * U, paint, -3.6 * U, 1.5 * U, 0, g); parts.gate = gate; }
        const pick = fCyl(0.22 * U, 0.22 * U, 1.9 * U, 12, dark, -1.4 * U, 0.3 * U, sq ? 0 : 0, g, 'x'); parts.reel = pick;
        [-1, 1].forEach(s => wheel(0.4, 0.22, sq ? -3.4 : -2.6, (sq ? 1.0 : 0) + s * 1.25));
      } else if (key === 'balewagon') {
        fRod([0, 0.5 * U, 0], [-1.4 * U, 0.8 * U, 0], 0.07 * U, dark, g);
        fBox(9 * U * 0.6, 0.15 * U, 2.4 * U, farmMat(0x8a6a48, { roughness: 0.85 }), -4.1 * U, 1.0 * U, 0, g);
        fBox(0.1 * U, 1.4 * U, 2.4 * U, farmMat(0x8a6a48, { roughness: 0.85 }), -1.4 * U, 1.7 * U, 0, g);
        [-2.2, -5.8].forEach(x => [-1, 1].forEach(s => wheel(0.4, 0.2, x, s * 1.0)));
        // the load: up to eight round bales on the deck (shown by js/farm2.js)
        const load = [];
        for (let i = 0; i < 8; i++) { const bale = fCyl(0.6 * U, 0.6 * U, 1.2 * U, 14, farmMat(0xc9b26a, { roughness: 0.95 }), -(2.0 + (i % 4) * 1.3) * U, 1.7 * U + Math.floor(i / 4) * 1.15 * U, (i % 2 ? 0.55 : -0.55) * U * 0, g, 'x'); bale.visible = false; load.push(bale); }
        parts.load = load;
      } else if (key === 'mixer') {
        fRod([0, 0.5 * U, 0], [-1.2 * U, 0.7 * U, 0], 0.07 * U, dark, g);
        fCyl(1.3 * U, 1.0 * U, 2.0 * U, 18, farmMat(0x2b6aa0, { roughness: 0.4, metalness: 0.2 }), -2.6 * U, 1.6 * U, 0, g);
        fBox(0.6 * U, 0.3 * U, 0.2 * U, steel, -2.6 * U, 0.9 * U, 1.15 * U, g);
        [-1, 1].forEach(s => wheel(0.45, 0.25, -2.6, s * 1.1));
        const auger = new THREE.Group(); auger.position.set(-2.6 * U, 1.4 * U, 0); auger.add(fBox(0.08 * U, 1.6 * U, 1.4 * U, steel, 0, 0, 0, null)); g.add(auger); parts.spinners = [auger]; auger.userData.spinY = 1;
      } else if (key === 'rollermill') {
        fBox(1.0 * U, 1.0 * U, 0.8 * U, farmMat(0x6d7f8a, { metalness: 0.4, roughness: 0.4 }), 0, 0.5 * U, 0, g);
        const hop = new THREE.Mesh(new THREE.CylinderGeometry(0.6 * U, 0.15 * U, 0.7 * U, 4), farmMat(FARM_PAINT.galv, { metalness: 0.6, roughness: 0.4 })); hop.position.set(0, 1.35 * U, 0); hop.rotation.y = Math.PI / 4; g.add(hop);
        fCyl(0.25 * U, 0.25 * U, 0.3 * U, 12, farmMat(0x2b6aa0, { roughness: 0.5 }), 0.65 * U, 0.6 * U, 0, g, 'z');
      }
      g.userData.key = key;
      return g;
    }
if (typeof farmImplementModel === 'function') {
  const farm2OrigImplModel = farmImplementModel;
  farmImplementModel = function (key) { return FARM_IMPLEMENTS[key] && FARM_IMPLEMENTS[key].stage2 ? farm2ImplementModel(key) : farm2OrigImplModel(key); };
}

// --- Vegetable and hay clumps (one per square metre, as the grain crops) ------------------------------------
function farm2ClumpGeometry(crop, look) {
      const U = FARM_U, C = FARM_CROPS[crop], green = C.colour.green, parts = [];
      const leaves = (n, r, h, hex, tilt = 0.6, size = 0.12, spread = 0.3) => {
        for (let i = 0; i < n; i++) { const a = i * 2.39996, rr = spread * Math.sqrt((i + 0.5) / n) * U; const leaf = new THREE.CircleGeometry(size * U, 6); leaf.rotateX(-Math.PI / 2 + tilt); leaf.rotateY(a); leaf.translate(Math.cos(a) * rr, (h + (i % 3) * 0.05) * U, Math.sin(a) * rr); leaf.computeVertexNormals(); parts.push(farmColGeo(leaf, hex)); }
      };
      if (look === 'stubble') parts.push(...farmBlades(6, 0.08 * U, 0.05 * U, 0x9a8a5e, 0.05, 0.5 * U, 0.3));
      else if (crop === 'potato') {
        const H = { sprout: 0.12, leafy: 0.4, flower: 0.55, turning: 0.4, ripe: 0.15 }[look] || 0.1;
        const col = look === 'turning' ? 0x8a8a45 : look === 'ripe' ? 0x7a6a45 : green;
        parts.push(...farmBlades(5, H * U, 0.03 * U, col, 0.4, 0.25 * U, 0.4));
        leaves(look === 'sprout' ? 4 : 10, 0.3, H * 0.7, col, 0.5, 0.11, 0.35);
        if (look === 'flower') for (let i = 0; i < 5; i++) { const fl = new THREE.OctahedronGeometry(0.05 * U, 0); fl.translate(Math.cos(i * 1.3) * 0.2 * U, (H + 0.04) * U, Math.sin(i * 1.3) * 0.2 * U); parts.push(farmColGeo(fl, 0xf3f0f5)); }
      } else if (crop === 'carrot') {
        const H = { sprout: 0.06, leafy: 0.2, head: 0.38, ripe: 0.42 }[look] || 0.06;
        // feathery fronds in two rows to a bed
        [-0.3, 0.3].forEach((dz, j) => farmBlades(look === 'sprout' ? 3 : 7, H * U, 0.05 * U, green, 0.45, 0.12 * U, j).forEach(g => { g.translate(0, 0, dz * U); parts.push(g); }));
        if (look === 'ripe' || look === 'head') [-0.3, 0.3].forEach(dz => { const top = new THREE.ConeGeometry(0.035 * U, 0.06 * U, 5); top.translate(0.05 * U, 0.02 * U, dz * U); parts.push(farmColGeo(top, 0xe07a1f)); });
      } else if (crop === 'squash') {
        const R = { sprout: 0.12, leafy: 0.45, flower: 0.6, turning: 0.65, ripe: 0.55 }[look] || 0.1;
        const col = look === 'ripe' ? 0x7f8a45 : green;
        leaves(look === 'sprout' ? 2 : 7, R, 0.25, col, 0.9, look === 'sprout' ? 0.07 : 0.2, R);
        if (look === 'flower') for (let i = 0; i < 2; i++) { const fl = new THREE.ConeGeometry(0.07 * U, 0.12 * U, 5, 1, true); fl.rotateX(Math.PI); fl.translate((i - 0.5) * 0.4 * U, 0.3 * U, 0.2 * U); parts.push(farmColGeo(fl, 0xf2b31b)); }
        if (look === 'turning' || look === 'ripe') { const fr = new THREE.SphereGeometry(0.1 * U, 8, 6); fr.scale(1, 1, 2); fr.translate(0.15 * U, 0.1 * U, -0.1 * U); parts.push(farmColGeo(fr, look === 'ripe' ? 0xd9a03a : 0x9aa94a)); }
      } else if (crop === 'bean') {
        const H = { sprout: 0.08, leafy: 0.3, flower: 0.4, ripe: 0.45 }[look] || 0.08;
        parts.push(...farmBlades(4, H * U, 0.025 * U, green, 0.3, 0.2 * U, 0.2));
        leaves(look === 'sprout' ? 2 : 9, 0.25, H * 0.75, green, 0.4, 0.07, 0.25);
        if (look === 'flower') for (let i = 0; i < 4; i++) { const fl = new THREE.OctahedronGeometry(0.03 * U, 0); fl.translate(Math.cos(i * 1.6) * 0.15 * U, H * 0.6 * U, Math.sin(i * 1.6) * 0.15 * U); parts.push(farmColGeo(fl, 0xf7f2e8)); }
        if (look === 'ripe') for (let i = 0; i < 6; i++) { const pod = new THREE.CylinderGeometry(0.012 * U, 0.012 * U, 0.14 * U, 4); pod.rotateZ(0.3); pod.translate(Math.cos(i * 1.1) * 0.16 * U, H * 0.4 * U, Math.sin(i * 1.1) * 0.16 * U); parts.push(farmColGeo(pod, 0x5aa83a)); }
      } else {
        // hay: orchardgrass tillers and alfalfa stems, purple flowers at first bloom
        const H = { sprout: 0.15, leafy: 0.4, head: 0.65, ripe: 0.75 }[look] || 0.12;
        parts.push(...farmBlades(look === 'sprout' ? 6 : 10, H * U, 0.035 * U, look === 'ripe' ? 0x6a9a45 : green, 0.3, 0.5 * U, 0.6));
        leaves(look === 'sprout' ? 3 : 8, 0.4, H * 0.6, 0x4f8a35, 0.3, 0.05, 0.4);
        if (look === 'ripe' || look === 'head') for (let i = 0; i < (look === 'ripe' ? 7 : 3); i++) { const fl = new THREE.OctahedronGeometry(0.035 * U, 0); fl.scale(1, 1.6, 1); fl.translate(Math.cos(i * 2.1) * 0.35 * U, (H - 0.03) * U, Math.sin(i * 2.1) * 0.35 * U); parts.push(farmColGeo(fl, 0x8a5bb8)); }
      }
      const geo = farmJoinGeos(parts);
      if (typeof markSway === 'function') markSway(geo, 0, 0.8 * U, 0.5);
      geo.computeBoundingSphere();
      return geo;
    }
if (typeof farmClumpGeometry === 'function') {
  const farm2OrigClump = farmClumpGeometry;
  farmClumpGeometry = function (crop, look) {
      const C = FARM_CROPS[crop];
      if (!C || C.use === 'grain' || !C.use) return farm2OrigClump(crop, look);
      const key = crop + ':' + look;
      if (!farmClumpCache[key]) farmClumpCache[key] = farm2ClumpGeometry(crop, look);
      return farmClumpCache[key];
    };
}

// --- Orchard trees: a tall-spindle tree (trunk, leader, short limbs), blossom and fruit, instanced -------
let farm2TreeGeos = null;
function farm2TreeGeometries() {
      if (farm2TreeGeos) return farm2TreeGeos;
      const U = FARM_U;
      // trunk and leader, a bamboo stake, and short feathered limbs (bare in winter, under the leaves in summer)
      const tp = [farm2CylG(0.035 * U, 0.07 * U, 2.8 * U, 6, 0x5a4330, 0, 1.4 * U, 0), farm2CylG(0.015 * U, 0.015 * U, 3.0 * U, 4, 0xb8a27a, 0.1 * U, 1.5 * U, 0)];
      for (let i = 0; i < 9; i++) { const a = i * 2.39996, h = (0.7 + i * 0.2) * U, L = (0.55 - i * 0.04) * U; const b = new THREE.CylinderGeometry(0.008 * U, 0.018 * U, L, 4); b.translate(0, L / 2, 0); b.rotateZ(-1.15); b.rotateY(a); tp.push(farm2Part(b, 0x6a5038, 0, h, 0)); }
      const trunk = farmJoinGeos(tp);
      // the canopy: a narrow cone of leafy lumps (white: the instance colour tints it by crop and season)
      const can = [];
      for (let i = 0; i < 7; i++) { const t = i / 6, r = (0.55 - t * 0.35) * U, a = i * 2.4; can.push(farm2Ellipsoid(r, r * 0.8, r, 0xffffff, Math.cos(a) * 0.15 * U, (0.9 + t * 2.0) * U, Math.sin(a) * 0.15 * U, 6)); }
      const canopy = farmJoinGeos(can);
      const fr = [], bl = [];
      for (let i = 0; i < 14; i++) { const t = (i * 0.37) % 1, a = i * 2.39996, r = (0.5 - t * 0.3) * U; fr.push(farm2Part(new THREE.IcosahedronGeometry(0.07 * U, 0), 0xffffff, Math.cos(a) * r, (1.0 + t * 1.8) * U, Math.sin(a) * r)); }
      for (let i = 0; i < 18; i++) { const t = (i * 0.29) % 1, a = i * 2.1, r = (0.5 - t * 0.3) * U; bl.push(farm2Part(new THREE.OctahedronGeometry(0.11 * U, 0), 0xffffff, Math.cos(a) * r, (1.0 + t * 1.9) * U, Math.sin(a) * r)); }
      farm2TreeGeos = { trunk, canopy, fruit: farmJoinGeos(fr), blossom: farmJoinGeos(bl) };
      return farm2TreeGeos;
    }

// --- Animals: a body and a separate head (instanced), so the head can go down to graze --------------------
// Built facing +x, feet on y = 0; the head's pivot is at the top of the neck (headPivot)
const FARM2_HEAD_PIVOT = { cow: [0.95, 1.25], hen: [0.12, 0.32] };
let farm2AnimalGeos = null;
function farm2AnimalGeometries() {
      if (farm2AnimalGeos) return farm2AnimalGeos;
      const U = FARM_U;
      const cowBody = (coat, legs, udder, belly) => {
        const p = [farm2Ellipsoid(0.92 * U, 0.42 * U, 0.33 * U, coat, 0, 1.05 * U, 0, 9), farm2Ellipsoid(0.4 * U, 0.38 * U, 0.3 * U, coat, -0.55 * U, 1.1 * U, 0, 7),
          farm2BoxG(0.42 * U, 0.3 * U, 0.26 * U, coat, 0.82 * U, 1.18 * U, 0, 0, 0, -0.5)];
        if (belly) p.push(farm2Ellipsoid(0.55 * U, 0.2 * U, 0.3 * U, belly, 0.05 * U, 0.82 * U, 0, 7));
        [[0.58, 0.18], [0.58, -0.18], [-0.62, 0.18], [-0.62, -0.18]].forEach(([x, z]) => { p.push(farm2BoxG(0.14 * U, 0.78 * U, 0.14 * U, legs, x * U, 0.39 * U, z * U)); p.push(farm2BoxG(0.15 * U, 0.08 * U, 0.15 * U, 0x2a2420, x * U, 0.04 * U, z * U)); });
        if (udder) { p.push(farm2Ellipsoid(0.2 * U, 0.13 * U, 0.16 * U, udder, -0.45 * U, 0.66 * U, 0, 7)); [[-0.38, 0.07], [-0.38, -0.07], [-0.52, 0.07], [-0.52, -0.07]].forEach(([x, z]) => p.push(farm2CylG(0.02 * U, 0.02 * U, 0.08 * U, 4, udder, x * U, 0.52 * U, z * U))); }
        p.push(farm2CylG(0.025 * U, 0.02 * U, 0.75 * U, 4, coat, -0.98 * U, 0.85 * U, 0, 0, 0, 0.12)); p.push(farm2Ellipsoid(0.05 * U, 0.1 * U, 0.05 * U, 0x2a2420, -1.02 * U, 0.46 * U, 0, 4));
        return farmJoinGeos(p);
      };
      const cowHead = (coat, muzzle) => {
        // relative to the pivot: the head hangs forward and down from the top of the neck
        const p = [farm2BoxG(0.5 * U, 0.3 * U, 0.26 * U, coat, 0.28 * U, -0.1 * U, 0, 0, 0, -0.5), farm2BoxG(0.18 * U, 0.2 * U, 0.22 * U, muzzle, 0.55 * U, -0.27 * U, 0, 0, 0, -0.5)];
        [-1, 1].forEach(s => p.push(farm2BoxG(0.08 * U, 0.05 * U, 0.2 * U, coat, 0.12 * U, 0.02 * U, s * 0.2 * U, 0.3 * s)));
        [-1, 1].forEach(s => p.push(farm2Ellipsoid(0.025 * U, 0.025 * U, 0.025 * U, 0x101010, 0.33 * U, -0.02 * U, s * 0.13 * U, 4)));
        return farmJoinGeos(p);
      };
      const hen = [farm2Ellipsoid(0.16 * U, 0.13 * U, 0.11 * U, 0x8a4a22, 0, 0.24 * U, 0, 7), farm2Ellipsoid(0.08 * U, 0.1 * U, 0.07 * U, 0x6e3a1a, -0.15 * U, 0.33 * U, 0, 5),
        farm2CylG(0.012 * U, 0.012 * U, 0.14 * U, 4, 0xd9a43a, 0.02 * U, 0.07 * U, 0.04 * U), farm2CylG(0.012 * U, 0.012 * U, 0.14 * U, 4, 0xd9a43a, 0.02 * U, 0.07 * U, -0.04 * U)];
      const henHead = [farm2Ellipsoid(0.06 * U, 0.065 * U, 0.055 * U, 0x9a5228, 0.03 * U, 0.03 * U, 0, 6), farm2BoxG(0.06 * U, 0.05 * U, 0.015 * U, 0xc81e1e, 0.03 * U, 0.1 * U, 0), farm2Part(new THREE.ConeGeometry(0.018 * U, 0.05 * U, 4), 0xe0b040, 0.1 * U, 0.02 * U, 0, 0, 0, -Math.PI / 2)];
      farm2AnimalGeos = {
        dairy: { body: cowBody(0xb27a48, 0x8a5a34, 0xe8b0a0, 0xd8b088), head: cowHead(0xa86e40, 0x2a2420) },
        beef: { body: cowBody(0x1c1a1a, 0x161414, null, null), head: cowHead(0x1c1a1a, 0x2a2626) },
        hen: { body: farmJoinGeos(hen), head: farmJoinGeos(henHead) }
      };
      return farm2AnimalGeos;
    }

// --- Hay: round and small square bales, swaths and windrows ----------------------------------------------------
let farm2HayGeos = null;
function farm2HayGeometries() {
      if (farm2HayGeos) return farm2HayGeos;
      const U = FARM_U;
      const round = farmJoinGeos([farm2CylG(0.6 * U, 0.6 * U, 1.5 * U, 16, 0xc8b06a, 0, 0.6 * U, 0, Math.PI / 2), farm2CylG(0.61 * U, 0.61 * U, 1.3 * U, 16, 0xe6e2d6, 0, 0.6 * U, 0, Math.PI / 2)]);
      const square = farmJoinGeos([farm2BoxG(0.9 * U, 0.36 * U, 0.46 * U, 0xc9b26a, 0, 0.18 * U, 0), farm2BoxG(0.02 * U, 0.37 * U, 0.47 * U, 0xd8c08a, 0.2 * U, 0.18 * U, 0), farm2BoxG(0.02 * U, 0.37 * U, 0.47 * U, 0xd8c08a, -0.2 * U, 0.18 * U, 0)]);
      // a swath/windrow segment: a low rounded mound 4 units long (scaled per stage)
      const mound = new THREE.CylinderGeometry(1, 1, 4, 8, 1, false, 0, Math.PI); mound.rotateZ(Math.PI / 2); mound.rotateX(-Math.PI / 2);
      const row = farm2Part(mound, 0xffffff);
      farm2HayGeos = { round, square, row };
      return farm2HayGeos;
    }

// --- Fences: posts and wire for the pasture, the hen run and the orchard trellis -------------------------------
// runs: [[ax, az, bx, bz], ...] in world units; gaps: [{x, z, r}] left open for gates
function farm2FenceMesh(runs, opts = {}) {
      const U = FARM_U, step = (opts.postM || 3) * U, g = new THREE.Group();
      const post = new THREE.CylinderGeometry(0.06 * U, 0.07 * U, (opts.h || 1.3) * U + 0.3, 6); post.translate(0, (opts.h || 1.3) * U / 2 - 0.1, 0);
      const pts = [], wires = [];
      runs.forEach(([ax, az, bx, bz]) => {
        const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / step));
        for (let k = 0; k <= n; k++) {
          const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n;
          if ((opts.gaps || []).some(q => Math.hypot(q.x - x, q.z - z) < q.r)) continue;
          pts.push([x, z]);
          if (k < n) {
            const x2 = ax + (bx - ax) * (k + 1) / n, z2 = az + (bz - az) * (k + 1) / n;
            if ((opts.gaps || []).some(q => Math.hypot(q.x - (x + x2) / 2, q.z - (z + z2) / 2) < q.r)) continue;
            wires.push([x, z, x2, z2]);
          }
        }
      });
      const pm = new THREE.InstancedMesh(post, farmMat(opts.postColour || 0x7a5a3a, { roughness: 0.9 }), Math.max(1, pts.length));
      const m = new THREE.Matrix4(), v3 = [];
      pts.forEach(([x, z], i) => { const y = getAnalyticalGroundHeight(x, z); m.makeTranslation(x, y, z); pm.setMatrixAt(i, m); v3.push(new THREE.Vector3(x, y + 1, z)); });
      pm.count = pts.length; farm2Bounds(pm, v3); g.add(pm);
      const strands = opts.strands || [0.45, 0.85, 1.2];
      const wireGeo = new THREE.BoxGeometry(1, 0.025 * U * (opts.wireK || 1), 0.025 * U * (opts.wireK || 1));
      const wm = new THREE.InstancedMesh(wireGeo, farmMat(opts.wireColour || 0x9aa0a6, { metalness: 0.6, roughness: 0.4 }), Math.max(1, wires.length * strands.length));
      const q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
      let n = 0;
      wires.forEach(([ax, az, bx, bz]) => {
        const len = Math.hypot(bx - ax, bz - az), y = (getAnalyticalGroundHeight(ax, az) + getAnalyticalGroundHeight(bx, bz)) / 2;
        q.setFromAxisAngle(up, -Math.atan2(bz - az, bx - ax));
        strands.forEach(h => { m.compose(p.set((ax + bx) / 2, y + h * U, (az + bz) / 2), q, s.set(len, 1, 1)); wm.setMatrixAt(n++, m); });
      });
      wm.count = n; farm2Bounds(wm, v3); g.add(wm);
      return g;
    }
