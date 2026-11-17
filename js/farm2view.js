// Kelo-bot-1 — js/farm2view.js
// Loaded after farm2year.js. What you see of the mixed farm, and its place in his mind: the orchard (one
// instanced mesh each for trunks, canopies, blossom and fruit, coloured by season), the plots (stage 1's
// field look), swaths, windrows and bales, the stacked hay shed, the fences and trellis, and the animals
// walking, grazing and pecking (instanced bodies and heads; the update rate and the head and walking motion
// follow the Low/Medium/High setting, js/look.js). Also the Brain-tab panel, the AI summary, the long goal
// (js/goals.js), the idea to start it, and the hooks into stage 1's ticks.

// --- Graphics levels --------------------------------------------------------------------------------------------
const FARM2_LEVELS = {
  fast: { animHz: 8, heads: false, bob: false, hens: 12, blossom: false, treeShadows: false },
  balanced: { animHz: 24, heads: true, bob: false, hens: 40, blossom: true, treeShadows: false },
  high: { animHz: 45, heads: true, bob: true, hens: 60, blossom: true, treeShadows: true }
};
function farm2Level() { const k = typeof graphicsLevel !== 'undefined' ? graphicsLevel : 'balanced'; return FARM2_LEVELS[k] || FARM2_LEVELS.balanced; }

// --- The areas in world units ---------------------------------------------------------------------------------------
function farm2Rects() {
      const X = farm2State();
      return { pasture: farm2RectWorld(FARM2_LAYOUT.pasture), pen: farm2RectWorld(FARM2_LAYOUT.pen), run: farm2RectWorld(FARM2_LAYOUT.run), orchard: farm2RectWorld(FARM2_LAYOUT.orchard), herdOut: Boolean(X.herdOut && X.pasture.fenced >= 1) };
    }

let farm2Group = null;
const farm2V = { orchard: null, orchardSig: '', hay: null, haySig: '', fences: null, fenceSig: '', anim: null, sprites: new Map(), lastAnim: 0, trough: null };
// Instanced groups have their instances far from their own origin: keep them out of the chunk system
// (js/chunks.js files a static object under its middle) so the renderer's own culling handles them
function farm2Dyn(root) { if (typeof chunkDynamic !== 'undefined') root.traverse(o => chunkDynamic.add(o)); return root; }
function farm2Ensure3D() {
      if (typeof farmGroup === 'undefined' || !farmGroup || !farmSite()) return false;
      if (!farm2Group) { farm2Group = new THREE.Group(); farm2Group.name = 'farm2'; farm2Dyn(farm2Group); farmGroup.add(farm2Group); }
      else if (farm2Group.parent !== farmGroup) farmGroup.add(farm2Group);
      return true;
    }

// --- The orchard ----------------------------------------------------------------------------------------------------------
function farm2TreeSpots() {
      const L = FARM2_LAYOUT.orchard, O = farm2State().orchard, out = [];
      const per = { apple: Math.floor((L.x1 - L.x0 - 2) / L.treeM.apple), cherry: Math.floor((L.x1 - L.x0 - 2) / L.treeM.cherry) };
      const count = { apple: 0, cherry: 0 };
      for (let r = 0; r < L.rows.apple + L.rows.cherry; r++) {
        const crop = r < L.rows.apple ? 'apple' : 'cherry', dm = L.d0 + 1.75 + r * L.rowM;
        for (let i = 0; i < per[crop]; i++) {
          if (count[crop] >= O.planted[crop]) break;
          count[crop]++;
          const p = farmWorld(L.x0 + 1 + (i + 0.5) * L.treeM[crop], dm), j = farm2Hash(r * 131 + i * 7);
          out.push({ crop, x: p.x + (j - 0.5) * 0.15, z: p.z, j });
        }
      }
      return out;
    }
function farm2OrchardLook(crop) {
      const st = farm2OrchardStage(crop), B = farm2State().orchard.blocks[crop], C = FARM_CROPS[crop], doy = farmDayInfo(farmDayNow()).doy;
      const leaf = st === 'dormant' || st === 'buds swelling' ? 0 : st === 'in bloom' ? 0.45 : 1;
      let col = C.colour.green;
      if (doy > 275 && doy <= 300) col = crop === 'apple' ? 0xb7a43a : 0xc0602a;
      if (doy > 300 || doy < C.bloom - 25) col = 0x6a5a48;
      const fruit = B.fruitKg > 0 && B.fruitG > 0.15;
      const fcol = new THREE.Color(0x6aa83a).lerp(new THREE.Color(C.colour.ripe), Math.min(1, Math.max(0, (B.fruitG - 0.5) * 2)));
      return { st, leaf, col, fruit, fruitScale: 0.4 + 0.6 * B.fruitG, fcol, blossom: st === 'in bloom' };
    }
function farm2BuildOrchard() {
      const X = farm2State(), spots = farm2TreeSpots(), lv = farm2Level();
      const looks = { apple: farm2OrchardLook('apple'), cherry: farm2OrchardLook('cherry') };
      const sig = `${spots.length}|${looks.apple.st}|${looks.cherry.st}|${looks.apple.fruit}|${looks.cherry.fruit}|${Math.round(X.orchard.blocks.apple.fruitG * 5)}|${Math.round(X.orchard.blocks.cherry.fruitG * 5)}|${Math.floor(farm2TreeAge('apple') * 4)}|${lv.blossom}|${lv.treeShadows}|${X.orchard.trellisRows}`;
      if (sig === farm2V.orchardSig) return;
      farm2V.orchardSig = sig;
      if (farm2V.orchard) { farm2Group.remove(farm2V.orchard); farm2V.orchard.traverse(o => { if (o.isInstancedMesh && o.userData.ownGeo) o.geometry.dispose(); }); }
      const g = new THREE.Group(); g.name = 'farm2Orchard';
      farm2V.orchard = g; farm2Group.add(g);
      if (!spots.length && !X.orchard.trellisRows) return;
      const G = farm2TreeGeometries(), n = spots.length;
      const trunk = farm2Instanced(G.trunk, n, 'farm2Trunks'), canopy = farm2Instanced(G.canopy, n, 'farm2Canopy', farm2TintMat()), fruit = farm2Instanced(G.fruit, n, 'farm2Fruit', farm2TintMat()), bloom = farm2Instanced(G.blossom, n, 'farm2Blossom', farm2TintMat());
      [trunk, canopy].forEach(m => { m.castShadow = lv.treeShadows; });
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color(), pts = [];
      let nf = 0, nb = 0, nc = 0;
      spots.forEach((t, i) => {
        const L = looks[t.crop], age = farm2TreeAge(t.crop), size = (0.55 + 0.45 * Math.min(1, age / 3)) * (t.crop === 'cherry' ? 1.15 : 1);
        const y = getAnalyticalGroundHeight(t.x, t.z);
        q.setFromAxisAngle(up, t.j * 6.28);
        m.compose(p.set(t.x, y, t.z), q, s.set(size, size, size)); trunk.setMatrixAt(i, m);
        pts.push(p.clone().setY(y + 2));
        if (L.leaf > 0.01) {
          m.compose(p.set(t.x, y, t.z), q, s.set(size * L.leaf, size * (0.6 + 0.4 * L.leaf), size * L.leaf)); canopy.setMatrixAt(nc, m);
          c.setHex(L.col).offsetHSL(0, 0, (t.j - 0.5) * 0.06); canopy.setColorAt(nc, c); nc++;
        }
        if (L.fruit) { m.compose(p.set(t.x, y, t.z), q, s.set(size * L.fruitScale, size, size * L.fruitScale)); fruit.setMatrixAt(nf, m); fruit.setColorAt(nf, L.fcol); nf++; }
        if (L.blossom && lv.blossom) { m.compose(p.set(t.x, y, t.z), q, s.set(size, size, size)); bloom.setMatrixAt(nb, m); bloom.setColorAt(nb, c.setHex(FARM_CROPS[t.crop].colour.blossom)); nb++; }
      });
      trunk.count = n; canopy.count = nc; fruit.count = nf; bloom.count = nb;
      [trunk, canopy, fruit, bloom].forEach(im => { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; farm2Bounds(im, pts, 4); g.add(im); });
      farm2Dyn(g);
      // the trellis: a post every 10 m, three wires
      if (X.orchard.trellisRows) {
        const L = FARM2_LAYOUT.orchard, runs = [];
        for (let r = 0; r < X.orchard.trellisRows; r++) { const dm = L.d0 + 1.75 + r * L.rowM, a = farmWorld(L.x0 + 0.5, dm), b = farmWorld(L.x1 - 0.5, dm); runs.push([a.x, a.z, b.x, b.z]); }
        g.add(farm2FenceMesh(runs, { postM: 10, h: 3, strands: [0.9, 1.8, 2.7], postColour: 0x6a5a48, wireK: 0.5 }));
      }
      farm2Dyn(g);
    }

// --- Hay: swaths, windrows, bales on the field and the stack in the shed ------------------------------------------------
function farm2BuildHay() {
      const X = farm2State(), H = farm2HayField(), B = X.fieldBales || { round: 0, square: 0 }, S = H && H.swath, op = H && H.op;
      const sig = `${H ? H.id : ''}|${S ? S.stage + Math.round(S.m / 10) : ''}|${op ? op.key + op.done.join('') : ''}|${B.round}|${B.square}|${X.hay.round}|${X.hay.square}|${farm2Done('hayshed')}`;
      if (sig === farm2V.haySig) return;
      farm2V.haySig = sig;
      if (farm2V.hay) farm2Group.remove(farm2V.hay);
      const g = new THREE.Group(); g.name = 'farm2Hay'; farm2V.hay = g; farm2Group.add(g);
      const G = farm2HayGeometries(), U = FARM_U, m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
      // rows: the swaths behind the mower (strip by strip while it mows), then tedded, then windrows
      if (H && (S || (op && op.key === 'mow'))) {
        const stage = S ? S.stage : 'swath', n = stage === 'windrow' ? Math.max(1, Math.round((H.z1 - H.z0) / (FARM_IMPLEMENTS.rake.widthM * U))) : (S ? S.n : op.n) || 20;
        const rows = [];
        for (let i = 0; i < n; i++) { if (!S && !(op.done[i])) continue; rows.push(H.z1 - (i + 0.5) * (H.z1 - H.z0) / n); }
        const segs = Math.floor((H.x1 - H.x0 - 4) / 4), im = farm2Instanced(G.row, rows.length * segs, 'farm2Swath', farm2TintMat()), pts = [];
        const wide = { swath: [0.9, 0.22], tedded: [1.7, 0.07], windrow: [0.75, 0.42] }[stage] || [0.9, 0.2];
        const dry = S ? Math.max(0, Math.min(1, (78 - S.m) / 60)) : 0;
        c.setHex(0x6f9a3a).lerp(new THREE.Color(0xc9b26a), dry);
        let k = 0;
        rows.forEach(z => { for (let j = 0; j < segs; j++) { const x = H.x0 + 2 + (j + 0.5) * 4; m.compose(p.set(x, getAnalyticalGroundHeight(x, z) + 0.02, z), q.identity(), s.set(1, wide[1] * U, wide[0] * U)); im.setMatrixAt(k, m); im.setColorAt(k, c); k++; pts.push(p.clone()); } });
        im.count = k; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; farm2Bounds(im, pts, 3); g.add(im);
      }
      // bales lying on the field
      const field = X.plots.find(f => f.id === B.field) || H;
      if (field && (B.round || B.square)) {
        const rn = Math.min(60, B.round), sn = Math.min(200, B.square), rim = farm2Instanced(G.round, Math.max(1, rn), 'farm2FieldRound'), sim = farm2Instanced(G.square, Math.max(1, sn), 'farm2FieldSquare'), pts = [];
        for (let i = 0; i < rn; i++) { const x = field.x0 + 6 + ((i * 37) % 97) / 97 * (field.x1 - field.x0 - 12), z = field.z0 + 4 + ((i * 53) % 89) / 89 * (field.z1 - field.z0 - 8); q.setFromAxisAngle(up, i * 0.7); m.compose(p.set(x, getAnalyticalGroundHeight(x, z), z), q, s.set(1, 1, 1)); rim.setMatrixAt(i, m); pts.push(p.clone()); }
        for (let i = 0; i < sn; i++) { const x = field.x0 + 5 + ((i * 41) % 113) / 113 * (field.x1 - field.x0 - 10), z = field.z0 + 4 + ((i * 29) % 101) / 101 * (field.z1 - field.z0 - 8); q.setFromAxisAngle(up, (i % 5) * 0.3); m.compose(p.set(x, getAnalyticalGroundHeight(x, z), z), q, s.set(1, 1, 1)); sim.setMatrixAt(i, m); pts.push(p.clone()); }
        rim.count = rn; sim.count = sn; [rim, sim].forEach(im => { im.instanceMatrix.needsUpdate = true; farm2Bounds(im, pts, 3); g.add(im); });
      }
      // the stack in the hay shed (or beside it before it is built): rows of round bales three high, squares at the end
      if (X.hay.round || X.hay.square) {
        const r = farmBuildingRect('hayshed'), rn = Math.min(54, X.hay.round), sn = Math.min(120, X.hay.square), sx = farmSite().id === 'west' ? -1 : 1;
        const rim = farm2Instanced(G.round, Math.max(1, rn), 'farm2StackRound'), sim = farm2Instanced(G.square, Math.max(1, sn), 'farm2StackSquare'), pts = [];
        const y0 = getAnalyticalGroundHeight(r.x, r.z) + 0.25;
        for (let i = 0; i < rn; i++) { const col = i % 9, row = Math.floor(i / 9) % 2, lvl = Math.floor(i / 18); const x = r.x - sx * (r.hw - 1.0 * U - col * 1.55 * U), z = r.z - r.hd + 1.0 * U + row * 1.25 * U + lvl * 0.1; m.compose(p.set(x, y0 + lvl * 1.18 * U, z), q.setFromAxisAngle(up, Math.PI / 2), s.set(1, 1, 1)); rim.setMatrixAt(i, m); pts.push(p.clone()); }
        for (let i = 0; i < sn; i++) { const col = i % 4, row = Math.floor(i / 4) % 6, lvl = Math.floor(i / 24); const x = r.x + sx * (r.hw - 0.7 * U - col * 0.95 * U), z = r.z - r.hd + 0.5 * U + row * 0.5 * U; m.compose(p.set(x, y0 + lvl * 0.37 * U, z), q.identity(), s.set(1, 1, 1)); sim.setMatrixAt(i, m); pts.push(p.clone()); }
        rim.count = rn; sim.count = sn; [rim, sim].forEach(im => { im.instanceMatrix.needsUpdate = true; farm2Bounds(im, pts, 3); g.add(im); });
      }
      farm2Dyn(g);
    }

// --- Fences: the pasture (as far as it is built), the hen run, the water tank ------------------------------------------------
function farm2BuildFences() {
      const X = farm2State(), coop = farm2Done('coop');
      const stalls = farm2Done('stalls');
      const sig = `${Math.round(X.pasture.fenced * 4)}|${coop}|${stalls}`;
      if (sig === farm2V.fenceSig) return;
      farm2V.fenceSig = sig;
      if (farm2V.fences) farm2Group.remove(farm2V.fences);
      const g = new THREE.Group(); g.name = 'farm2Fences'; farm2V.fences = g; farm2Group.add(g);
      const P = FARM2_LAYOUT.pasture, corners = [[P.x0, P.d0], [P.x0, P.d1], [P.x1, P.d1], [P.x1, P.d0], [P.x0, P.d0]].map(([a, b]) => farmWorld(a, b));
      const runs = [];
      for (let i = 0; i < Math.round(X.pasture.fenced * 4); i++) runs.push([corners[i].x, corners[i].z, corners[i + 1].x, corners[i + 1].z]);
      const gate = farmWorld(P.gateX, P.d0);
      if (runs.length) g.add(farm2FenceMesh(runs, { gaps: [{ x: gate.x, z: gate.z, r: 3.5 }] }));
      if (X.pasture.fenced >= 1) {
        const t = farmWorld(P.x0 + 6, P.d0 + 4);
        const tank = fCyl(1.1 * FARM_U * 0.6, 1.1 * FARM_U * 0.6, 0.6 * FARM_U, 18, farmMat(FARM_PAINT.galv, { metalness: 0.6, roughness: 0.4 }), t.x, getAnalyticalGroundHeight(t.x, t.z) + 0.3 * FARM_U, t.z, g);
        fCyl(1.0 * FARM_U * 0.6, 1.0 * FARM_U * 0.6, 0.02, 18, farmMat(0x5b7f95, { roughness: 0.1 }), t.x, getAnalyticalGroundHeight(t.x, t.z) + 0.55 * FARM_U, t.z, g);
        tank.name = 'farm2Trough';
      }
      // the barnyard pen beside the barn (built with the stalls): board fence, a gate on the north side
      if (stalls) {
        const R = FARM2_LAYOUT.pen, c = [[R.x0, R.d0], [R.x1, R.d0], [R.x1, R.d1], [R.x0, R.d1]].map(([a, b]) => farmWorld(a, b)), gate = farmWorld((R.x0 + R.x1) / 2, R.d1);
        g.add(farm2FenceMesh([[c[0].x, c[0].z, c[1].x, c[1].z], [c[1].x, c[1].z, c[2].x, c[2].z], [c[2].x, c[2].z, c[3].x, c[3].z]], { postM: 2.4, h: 1.4, strands: [0.45, 0.9, 1.3], postColour: 0x7a5a3a, wireColour: 0x9a7a52, wireK: 4, gaps: [{ x: gate.x, z: gate.z, r: 2.6 }] }));
      }
      if (coop) {
        const R = FARM2_LAYOUT.run, c = [[R.x0, R.d0], [R.x0, R.d1], [R.x1, R.d1], [R.x1, R.d0], [R.x0, R.d0]].map(([a, b]) => farmWorld(a, b)), rr = [];
        for (let i = 0; i < 4; i++) rr.push([c[i].x, c[i].z, c[i + 1].x, c[i + 1].z]);
        g.add(farm2FenceMesh(rr, { postM: 2, h: 1.5, strands: [0.2, 0.5, 0.8, 1.1, 1.4], wireColour: 0xb8bcc0, wireK: 1.2 }));
      }
      farm2Dyn(g);
    }

// --- Animals: where each one is, walking, grazing, lying (not saved: they wander from where they are) --------------------------
function farm2Sprite(id) { return farm2V.sprites.get(id) || null; }
function farm2AreaFor(a, R) {
      if (a.kind === 'hen') return R.run;
      return a.inPen || !R.herdOut ? R.pen : R.pasture;
    }
function farm2RandIn(r, pad = 1.5) { return { x: r.x0 + pad + Math.random() * Math.max(0.1, r.x1 - r.x0 - 2 * pad), z: r.z0 + pad + Math.random() * Math.max(0.1, r.z1 - r.z0 - 2 * pad) }; }
function farm2Place3D() {
      if (!farm2Ensure3D()) return;
      const X = farm2State(), R = farm2Rects(), keep = new Set();
      const all = X.herd.concat([...Array(Math.min(X.flock.n, 60)).keys()].map(i => ({ id: 'hen' + i, kind: 'hen' })));
      all.forEach(a => {
        keep.add(a.id);
        let s = farm2V.sprites.get(a.id);
        const area = farm2AreaFor(a, R);
        if (!s) { const p = farm2RandIn(area); s = { x: p.x, z: p.z, h: Math.random() * 6.28, tx: p.x, tz: p.z, mode: 'graze', t: Math.random() * 6, pitch: 0, kind: a.kind, area }; farm2V.sprites.set(a.id, s); }
        // moved to another area (turned out, brought in): walk there
        if (s.area !== area) { s.area = area; const p = farm2RandIn(area); s.tx = p.x; s.tz = p.z; s.mode = 'walk'; }
        if (a.x == null && a.kind !== 'hen') { a.x = s.x; a.z = s.z; }
      });
      [...farm2V.sprites.keys()].forEach(id => { if (!keep.has(id)) farm2V.sprites.delete(id); });
      farm2EnsureAnimalMeshes();
    }
function farm2EnsureAnimalMeshes() {
      if (farm2V.anim) return farm2V.anim;
      const G = farm2AnimalGeometries(), A = {};
      ['dairy', 'beef', 'hen'].forEach(k => { A[k] = { body: farm2Instanced(G[k].body, k === 'hen' ? 60 : 40, 'farm2' + k + 'Body'), head: farm2Instanced(G[k].head, k === 'hen' ? 60 : 40, 'farm2' + k + 'Head') }; A[k].body.castShadow = true; farm2Group.add(A[k].body, A[k].head); });
      farm2V.anim = A;
      return A;
    }
const farm2Tmp = { m: new THREE.Matrix4(), h: new THREE.Matrix4(), t: new THREE.Matrix4(), r: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), p: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) };
function farm2AnimalsFrame(now) {
      if (!farm2V.anim || !farm2Group || !farmGroup.visible || !camera) return;
      const lv = farm2Level(), dtMs = now - farm2V.lastAnim;
      if (dtMs < 1000 / lv.animHz) return;
      const dt = Math.min(0.5, dtMs / 1000);
      farm2V.lastAnim = now;
      const st = farmBuildingRect('barn'), d0 = Math.hypot(camera.position.x - st.x, camera.position.z - st.z);
      if (d0 > 330) return;
      const X = farm2State(), U = FARM_U, T = farm2Tmp, night = worldNow().isNight, A = farm2V.anim;
      const counts = { dairy: 0, beef: 0, hen: 0 }, pts = { dairy: [], beef: [], hen: [] };
      const byId = new Map(X.herd.map(a => [a.id, a]));
      let hensShown = 0;
      farm2V.sprites.forEach((s, id) => {
        const a = byId.get(id) || { kind: 'hen' }, kind = a.kind;
        if (kind === 'hen' && (night || hensShown >= lv.hens)) return;
        if (kind === 'hen') hensShown++;
        const big = kind !== 'hen', speed = (big ? 0.55 : 0.35) * U * (s.mode === 'walk' && s.area && Math.hypot(s.tx - s.x, s.tz - s.z) > 25 ? 2.2 : 1);
        s.t -= dt;
        if (s.mode === 'walk') {
          const dx = s.tx - s.x, dz = s.tz - s.z, dist = Math.hypot(dx, dz);
          if (dist < 0.3) { s.mode = big ? (Math.random() < 0.15 && night ? 'lie' : 'graze') : 'peck'; s.t = big ? 5 + Math.random() * 12 : 1 + Math.random() * 3; }
          else { const k = Math.min(dist, speed * dt); s.x += dx / dist * k; s.z += dz / dist * k; const want = Math.atan2(-dz, dx); let dh = want - s.h; while (dh > Math.PI) dh -= 6.283; while (dh < -Math.PI) dh += 6.283; s.h += dh * Math.min(1, dt * 3); }
        } else if (s.t <= 0) {
          if (s.mode === 'graze' || s.mode === 'peck' || s.mode === 'lie') { s.mode = 'look'; s.t = big ? 1.5 + Math.random() * 3 : 0.5 + Math.random(); }
          else { const p = farm2RandIn(s.area || farm2AreaFor(a, farm2Rects())); const near = big ? 6 : 3; s.tx = s.x + Math.max(-near, Math.min(near, p.x - s.x)); s.tz = s.z + Math.max(-near, Math.min(near, p.z - s.z)); const r = s.area; if (r) { s.tx = Math.max(r.x0 + 1, Math.min(r.x1 - 1, s.tx)); s.tz = Math.max(r.z0 + 1, Math.min(r.z1 - 1, s.tz)); } s.mode = 'walk'; }
        }
        const wantPitch = !lv.heads ? 0.15 : s.mode === 'graze' ? 0.95 : s.mode === 'peck' ? (Math.sin(now * 0.02 + s.x) > 0 ? 1.1 : 0.2) : s.mode === 'lie' ? 0.1 : 0.05;
        s.pitch += (wantPitch - s.pitch) * Math.min(1, dt * 4);
        if (a.x !== undefined && big) { a.x = Math.round(s.x * 10) / 10; a.z = Math.round(s.z * 10) / 10; }
        const sc = big ? (a.calf ? 0.45 + 0.55 * Math.min(1, a.kg / FARM_ANIMALS[kind].kg) : 1) : 1;
        const bob = lv.bob && s.mode === 'walk' ? Math.abs(Math.sin(now * 0.006 + s.x)) * 0.05 * sc : 0;
        const lie = s.mode === 'lie' ? -0.45 * U * sc : 0;
        if (s.y == null || Math.random() < 0.05) s.y = getAnalyticalGroundHeight(s.x, s.z);
        T.q.setFromAxisAngle(T.up, s.h);
        T.m.compose(T.p.set(s.x, s.y + bob + lie, s.z), T.q, T.s.set(sc, sc, sc));
        const M = A[kind];
        if (counts[kind] >= M.body.instanceMatrix.count) return;
        M.body.setMatrixAt(counts[kind], T.m);
        const piv = kind === 'hen' ? FARM2_HEAD_PIVOT.hen : FARM2_HEAD_PIVOT.cow;
        T.t.makeTranslation(piv[0] * U, piv[1] * U, 0); T.r.makeRotationZ(-s.pitch);
        T.h.multiplyMatrices(T.m, T.t).multiply(T.r);
        M.head.setMatrixAt(counts[kind], T.h);
        pts[kind].push(new THREE.Vector3(s.x, s.y + 1, s.z));
        counts[kind]++;
      });
      ['dairy', 'beef', 'hen'].forEach(k => { const M = A[k]; M.body.count = counts[k]; M.head.count = counts[k]; M.body.instanceMatrix.needsUpdate = true; M.head.instanceMatrix.needsUpdate = true; if (!M.boundAt || now - M.boundAt > 1500) { M.boundAt = now; farm2Bounds(M.body, pts[k], 6); M.head.boundingSphere = M.body.boundingSphere; } });
    }

// --- All of it, refreshed (cheap when nothing changed: each part keeps a signature) -------------------------------------------
function farm2Refresh3D(force = false) {
      if (!farm2Started() || !farm2Ensure3D()) return;
      try {
        if (force) { farm2V.haySig = ''; }
        farm2BuildOrchard(); farm2BuildHay(); farm2BuildFences();
        if (farm2Cattle().length || farm2State().flock.n) farm2Place3D();
        const mt = farmBuildingMeshes.milkhouse;
        if (mt) mt.traverse(o => { if (o.userData && o.userData.tank) o.scale.set(1, 1, 1); });
      } catch (e) { console.warn('farm2 3D', e); }
    }
function farm2FieldsFrame(now) {
      if (!farm2Started() || !farmGroup || !farmGroup.visible) return;
      farm2State().plots.forEach(p => { if (farmFieldMeshes[p.id]) farmFillCrop(p); });
      farm2AnimalsFrame(now);
      // the hay wagon's load, the airblast fan
      const wag = farmImplMeshes.balewagon;
      if (wag && wag.userData.load) wag.userData.load.forEach((b, i) => { b.visible = i < (farm2State().wagonBales || 0); });
      const ab = farmImplMeshes.airblast;
      if (ab && ab.userData.blower && farmImplState.working === 'airblast') ab.userData.blower.rotation.x += 0.6;
    }

// --- For the AI and the Brain tab ------------------------------------------------------------------------------------------------
function farm2SummaryForAI() {
      if (!farm2Started()) return farm2Ready() ? 'not started (you could grow a mixed farm on the empty north-west of your farm: orchard, vegetables, cows, hens and hay)' : '';
      const X = farm2State(), b = farm2FeedBudget(), O = X.orchard;
      const chore = farm2NextChore();
      return `orchard ${O.planted.apple} apple / ${O.planted.cherry} cherry trees (${farm2OrchardStage('apple')}); plots: ${farm2Veg().map(p => `${p.name.toLowerCase()} ${p.crop ? `${p.crop} ${(farmCropStage(p) || {}).name || ''}` : p.soil}`).join(', ')}; hay field: ${farm2HayField() ? `${Math.round(farm2HayField().g * 100)}% grown, ${farm2HayField().cutsThisYear || 0} cuts this year` : 'not sown yet'}; hay in shed ${X.hay.round} round + ${X.hay.square} square (${Math.round(b.hayHaveKg / 100) / 10} t, ${b.hayShortKg ? Math.round(b.hayShortKg / 100) / 10 + ' t short for winter' : 'enough'}); ${farm2Adults('dairy').length} dairy cows, ${farm2Adults('beef').length} beef cows, ${X.herd.filter(a => a.calf).length} calves, ${X.flock.n} hens; bunk ${b.bunkDays} days; sick: ${X.herd.filter(a => a.sick).map(a => a.name).join(', ') || 'none'}; store: ${Object.keys(X.store).filter(k => X.store[k].n > 0).map(k => `${Math.round(X.store[k].n)} ${k}`).join(', ') || 'empty'}; next chore: ${chore ? chore.label : 'none'}`;
    }
if (typeof farmSummaryForAI === 'function') {
  const farm2OrigSummary = farmSummaryForAI;
  farmSummaryForAI = function () { const s = farm2OrigSummary(), m = farm2SummaryForAI(); return m ? `${s}; MIXED FARM: ${m}` : s; };
}
function renderFarm2Panel() {
      const el = document.getElementById('farm2Panel');
      if (!el) return;
      const F = state.farm;
      if (!F || !F.startedAt) { if (el.dataset.k !== 'none') { el.innerHTML = ''; el.dataset.k = 'none'; } return; }
      if (!farm2Started()) {
        const html = farm2Ready() ? `<div class="text-2xs text-slate-400 mt-2">Mixed farm (stage 2): not started.</div><button id="farm2StartBtn" class="ui-btn ui-btn-sm mt-1">🐄 Suggest an orchard, vegetables and animals</button>` : '';
        if (el.dataset.k !== 'ready' + farm2Ready()) { el.innerHTML = html; el.dataset.k = 'ready' + farm2Ready(); const btn = document.getElementById('farm2StartBtn'); if (btn) btn.onclick = () => { farm2StartGoal('My human suggested it, and the farm has room for it.'); renderFarm2Panel(); }; }
        return;
      }
      const X = farm2State(), b = farm2FeedBudget(), O = X.orchard, t = farm2Task() || agendaState().tasks.find(x => x.ref === 'farm:mixed');
      const pct = t ? Math.round(((t.status === 'done' ? FARM2_PLAN.length : t.step) / FARM2_PLAN.length) * 100) : 0;
      const chore = farm2NextChore(), last = X.lastChore;
      const rows = [
        `<div class="text-xs text-slate-200 mt-2">🐄 Mixed farm ${t && t.status !== 'done' ? `· set-up ${pct}%` : '· running'}</div>`,
        `<div class="text-2xs text-slate-300">Orchard: ${O.planted.apple} apple, ${O.planted.cherry} cherry · ${escapeHtml(farm2OrchardStage('apple'))}${O.blocks.apple.fruitKg ? ` · ~${Math.round(O.blocks.apple.fruitKg)} kg apples on the trees` : ''}${O.blocks.cherry.fruitKg ? ` · ~${Math.round(O.blocks.cherry.fruitKg)} kg cherries` : ''}</div>`,
        ...farm2Veg().map(p => { const st = farmCropStage(p); return `<div class="text-2xs text-slate-300">${escapeHtml(p.name)}: ${escapeHtml(p.crop ? `${FARM_CROPS[p.crop].label}, ${st ? st.name : ''} (${Math.round(p.g * 100)}%)` : p.soil)} · water ${Math.round(p.m * 100)}%${X.irrigating[p.id] ? ' 💧' : ''} · weeds ${Math.round(p.w * 100)}%</div>`; }),
        `<div class="text-2xs text-slate-300">Hay: ${farm2HayField() ? `${escapeHtml(farm2HayField().name)} ${Math.round(Math.min(1, farm2HayField().g) * 100)}% grown, cut ${farm2HayField().cutsThisYear || 0}× this year${farm2HayField().swath ? ` · ${escapeHtml(farm2HayField().swath.stage)} at ${Math.round(farm2HayField().swath.m)}%` : ''}` : 'north field not sown yet'} · shed ${X.hay.round} round, ${X.hay.square} square (${Math.round(b.hayHaveKg / 100) / 10} t)</div>`,
        `<div class="text-2xs text-slate-300">Animals: ${farm2Adults('dairy').length} Jersey, ${farm2Adults('beef').length} Angus, ${X.herd.filter(a => a.calf).length} calves, ${X.flock.n} hens · bunk ${b.bunkDays} d, feeder ${b.feederDays} d · tank ${Math.round(X.tankL)} L${X.herd.some(a => a.sick) ? ` · sick: ${escapeHtml(X.herd.filter(a => a.sick).map(a => a.name).join(', '))}` : ''}</div>`,
        `<div class="text-2xs text-slate-400">Winter feed: need ${Math.round(b.hayNeedKg / 100) / 10} t hay, have ${Math.round(b.hayHaveKg / 100) / 10} t${b.hayComingKg ? ` + ~${Math.round(b.hayComingKg / 100) / 10} t to cut` : ''}${b.hayShortKg ? ` · <span class="text-amber-300">${Math.round(b.hayShortKg / 100) / 10} t short</span>` : ''} · grain ${Math.round(b.grainHaveKg / 100) / 10} of ${Math.round(b.grainNeedKg / 100) / 10} t</div>`,
        `<div class="text-2xs text-slate-400">Store: ${escapeHtml(Object.keys(X.store).filter(k => X.store[k].n > 0).map(k => `${Math.round(X.store[k].n)} ${k === 'eggs' ? 'doz eggs' : k === 'milk' ? 'L milk' : k === 'beef' ? 'qtr beef' : 'kg ' + k}`).join(', ') || 'empty')} · earned ${escapeHtml(farm2Money(X.earned || 0))}</div>`,
        `<div class="text-2xs text-slate-400">Next: ${escapeHtml(chore ? chore.label : 'nothing pressing')}${last ? ` · last: ${escapeHtml(last.label)}` : ''}</div>`
      ];
      const html = rows.join('');
      if (el.dataset.k !== html) { el.innerHTML = html; el.dataset.k = html; }
    }

// --- His long goals (js/goals.js): "Grow a mixed farm" -------------------------------------------------------------------------------
const FARM2_GOAL_STAGES = [['Lay out and build', farm2PlanStepIndex('b:milkhouse') + 1], ['Pasture, machines and orchard', farm2PlanStepIndex('plotlist') + 1], ['The animals', farm2PlanStepIndex('animals') + 1], ['The first mixed year', FARM2_PLAN.length]];
function farm2PlanStepNow() { const t = agendaGet('farm:mixed') || agendaState().tasks.find(x => x.ref === 'farm:mixed'); if (!t) return -1; return t.status === 'done' ? FARM2_PLAN.length : (t.step || 0); }
function farm2GoalAdopt() {
      if (typeof goalStart !== 'function' || typeof goalsOpen !== 'function') return null;
      if (goalsOpen().some(g => g.template === 'farm2' || g.templateId === 'farm2' || /mixed farm/i.test(g.title || ''))) return null;
      try { return goalStart('farm2', { source: 'self', sourceText: 'the mixed farm' }); } catch (e) { return null; }
    }
function farm2RegisterGoal() {
      if (typeof registerGoalTemplate !== 'function' || typeof registerGoalAction !== 'function' || farm2RegisterGoal.done) return;
      farm2RegisterGoal.done = true;
      registerGoalAction('farm2plan', {
        key: () => 'farm2', label: task => task.label || 'work on the mixed farm',
        done: task => farm2PlanStepNow() >= task.upto,
        blocker: task => { const t = agendaGet('farm:mixed'); if (!t || t.status !== 'waiting') return null; const b = farm2PlanBlocker(t) || t.waitingFor; return b ? { type: 'ready', action: 'farm2plan', task, label: b.label || 'the mixed farm' } : null; },
        run: async task => {
          if (!agendaGet('farm:mixed') && farm2PlanStepNow() < 0) farm2StartGoal('One of my long goals');
          const t = agendaGet('farm:mixed');
          if (t && t.status !== 'waiting') await farm2RunPlan(t);
          return farm2PlanStepNow() >= task.upto;
        }
      });
      registerGoalTemplate('farm2', {
        title: FARM2_GOAL.title, emoji: FARM2_GOAL.emoji, base: 0.55, repeatAfterDays: 365,
        keywords: /\b(orchard|apples?|cherr(y|ies)|vegetables?|potato(es)?|carrots?|squash|beans?|cows?|cattle|dairy|milk|hens?|chickens?|eggs?|livestock|hay|bales?|pasture|feed)\b/i,
        params: () => (!farm2Ready() || farm2PlanStepNow() >= FARM2_PLAN.length ? null : {}),
        why: () => FARM2_GOAL.why,
        stages: () => FARM2_GOAL_STAGES.map(([name, upto]) => ({ name, tasks: [{ do: 'farm2plan', upto, label: name.toLowerCase() }] }))
      });
      if (farm2PlanStepNow() >= 0 && farm2PlanStepNow() < FARM2_PLAN.length) farm2GoalAdopt();
    }

// --- Starting it on his own: once the grain farm has had a season under way ---------------------------------------------------------
function farm2IdeaTick() {
      const F = state.farm;
      if (!F || !farm2Ready() || farm2Started() || !keloIsFree() || agendaOpenTasks().length >= 3) return;
      const t = agendaState().tasks.find(x => x.ref === 'farm:main');
      const since = t && t.doneAt ? (Date.now() - t.doneAt) / WORLD_DAY_MS : (F.harvests.length ? 99 : 0);
      if (since < 10 && !F.harvests.length) return;
      if (farm2Hash(7800000 + Math.floor(farmDayNow() * 4)) < 0.05) farm2StartGoal();
    }

// --- Hooks into stage 1: the scene, the ticks, fast time --------------------------------------------------------------------------------
if (typeof farmInit3D === 'function') {
  const farm2OrigInit3D = farmInit3D;
  farmInit3D = function () {
      farm2OrigInit3D();
      if (!farm2Started() || !farmSite()) return;
      farm2State().plots.forEach(p => farmRefreshFieldLook(p));
      farm2Refresh3D(true);
    };
}
if (typeof farmFastForward === 'function') {
  const farm2OrigFast = farmFastForward;
  farmFastForward = function (days) {
      farm2OrigFast(days);
      if (!farm2Started()) return;
      farm2Simulate();
      farm2State().plots.forEach(p => farmRefreshFieldLook(p, true));
      farm2Refresh3D();
    };
}
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { try { farm2RegisterGoal(); } catch (e) { console.warn('farm2 goal', e); } }, 1000);
  setTimeout(() => {
    try {
      if (farm2Started()) {
        const X = farm2State();
        X.wagonBales = 0;
        farm2Simulate();
        if (farmSite()) { X.plots.forEach(p => farmRefreshFieldLook(p)); farm2Refresh3D(true); }
      }
      if (typeof keloEveryFrame === 'function') keloEveryFrame(now => { try { farm2FieldsFrame(now); } catch (e) {} });
      setInterval(() => {
        try {
          farm2IdeaTick();
          // a plan under way joins his long goals once he has room for another (js/goals.js keeps two open)
          if (Math.random() < 0.08 && farm2PlanStepNow() >= 0 && farm2PlanStepNow() < FARM2_PLAN.length) farm2GoalAdopt();
          if (farm2Started()) { farm2Simulate(); if (Math.random() < 0.25) { farm2State().plots.forEach(p => farmRefreshFieldLook(p, true)); farm2Refresh3D(); } }
          renderFarm2Panel();
        } catch (e) { console.warn('farm2 tick', e); }
      }, 4000);
      renderFarm2Panel();
    } catch (e) { console.warn('farm2 init', e); }
  }, 900);
});
// Tests: the owner sends every open mixed-farm list (stage 1's farmSendAllLists sends them too)
function farm2Status() {
      const X = farm2State();
      return { plan: farm2PlanStepNow(), year: (farm2YearTask() || {}).title || null, orchard: X.orchard.planted, plots: X.plots.map(p => [p.id, p.crop, p.soil, Math.round(p.g * 100), Math.round(p.m * 100)]),
        hay: X.hay, fieldBales: X.fieldBales, herd: X.herd.map(a => [a.name, a.kind, a.calf ? 'calf' : 'cow', Math.round(a.kg), a.sick, a.due]), hens: X.flock.n, nest: X.flock.nestEggs, tank: X.tankL,
        store: Object.fromEntries(Object.entries(X.store).map(([k, s]) => [k, s.n])), bunk: X.bunk, feeder: X.feeder, earned: X.earned, budget: X.budget && X.budget.decisions, last: X.lastChore };
    }
