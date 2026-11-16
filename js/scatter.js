// Kelo-bot-1 — js/scatter.js
// Loaded after look.js. Vegetation and ground cover, batched:
//   - every tree (valley broadleafs, mountain firs) is joined into one mesh per material (bark, leaves)
//     instead of 7-13 separate meshes, the broadleaf crowns sway on the GPU like the firs (no more
//     per-tree JavaScript in wind.js), and each tree gets its own size and a slight lean
//   - the meadow grass near the camera is denser close in and thins out with distance, with flowers
//     mixed in (one instanced mesh each), swaying with the wind
//   - the valley's decorative flower patches are one instanced mesh (they were 140 meshes)
//   - soft contact shadows under buildings, trees and rocks (one instanced mesh, baked: no extra pass)
// Trees keep their groups, ids, obstacles and spots, so chopping, seasons and old saves are unchanged.

// --- 1. Joining a group's meshes per material ----------------------------------------------------
// Bakes each child's transform into its geometry. Attributes: position, normal, uv (if every part has
// one) and keloSway (0 where a part has none). Returns the new meshes (already added to the group).
const scatM4 = new THREE.Matrix4(), scatN3 = new THREE.Matrix3(), scatV3 = new THREE.Vector3();
function scatJoinByMaterial(group, swayFor) {
      const byMat = new Map();
      group.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
      group.children.slice().forEach(c => {
        if (!c.isMesh || c.userData && Object.keys(c.userData).length || c.children.length) return;
        if (!byMat.has(c.material)) byMat.set(c.material, []);
        byMat.get(c.material).push(c);
      });
      const out = [];
      byMat.forEach((parts, mat) => {
        if (parts.length < 2 && !swayFor) return;
        let n = 0;
        const geos = parts.map(p => { const g = p.geometry.index ? p.geometry.toNonIndexed() : p.geometry; n += g.attributes.position.count; return g; });
        const hasUv = geos.every(g => g.attributes.uv);
        const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), sway = new Float32Array(n), uv = hasUv ? new Float32Array(n * 2) : null;
        let o = 0, anySway = false;
        parts.forEach((p, k) => {
          const g = geos[k];
          scatM4.multiplyMatrices(inv, p.matrixWorld);
          scatN3.getNormalMatrix(scatM4);
          const P = g.attributes.position, N = g.attributes.normal, S = g.attributes.keloSway, U = g.attributes.uv;
          for (let i = 0; i < P.count; i++, o++) {
            scatV3.fromBufferAttribute(P, i).applyMatrix4(scatM4);
            pos[o * 3] = scatV3.x; pos[o * 3 + 1] = scatV3.y; pos[o * 3 + 2] = scatV3.z;
            if (N) { scatV3.fromBufferAttribute(N, i).applyMatrix3(scatN3).normalize(); nor[o * 3] = scatV3.x; nor[o * 3 + 1] = scatV3.y; nor[o * 3 + 2] = scatV3.z; }
            let s = S ? S.getX(i) : 0;
            if (!S && swayFor) s = swayFor(mat, pos[o * 3 + 1]);
            if (s) anySway = true;
            sway[o] = s;
            if (uv) { uv[o * 2] = U.getX(i); uv[o * 2 + 1] = U.getY(i); }
          }
        });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        if (anySway) geo.setAttribute('keloSway', new THREE.BufferAttribute(sway, 1));
        geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = parts.some(p => p.castShadow);
        mesh.receiveShadow = parts.some(p => p.receiveShadow);
        parts.forEach(p => { group.remove(p); if (p.geometry !== geos[parts.indexOf(p)]) geos[parts.indexOf(p)].dispose(); p.geometry.dispose(); });
        group.add(mesh);
        out.push(mesh);
      });
      return out;
    }

// A steady hash for each tree built (the trees' own random sequences are left alone)
let scatTreeCount = 0;
function scatHash(n, k) { const s = Math.sin(n * 91.7 + k * 47.3) * 43758.5453; return s - Math.floor(s); }

// --- 2. Trees: joined, GPU wind, variety ---------------------------------------------------------
(function scatHookTrees() {
      if (typeof buildNaturalLeafyTree === 'function') {
        const origLeafy = buildNaturalLeafyTree;
        buildNaturalLeafyTree = function () {
          const tree = origLeafy.apply(this, arguments);
          const M = naturalTreeMaterials();
          M.leaves.forEach(m => { if (!m.userData.scatSway) { m.userData.scatSway = true; m.onBeforeCompile = foliageSwayShader; m.needsUpdate = true; } });
          const leafSet = new Set(M.leaves);
          // crowns sway from about the fork up; the trunk and branches stay put
          scatJoinByMaterial(tree, (mat, y) => (leafSet.has(mat) ? Math.pow(Math.max(0, Math.min(1, (y - 1.1) / 2.2)), 1.5) * 0.85 : 0));
          scatVaryTree(tree, 0.82, 1.22, 0.06);
          return tree;
        };
      }
      if (typeof buildNaturalFir === 'function') {
        const origFir = buildNaturalFir;
        buildNaturalFir = function () {
          const tree = origFir.apply(this, arguments);
          scatJoinByMaterial(tree, null);
          scatVaryTree(tree, 0.9, 1.12, 0.035);
          return tree;
        };
      }
    })();

function scatVaryTree(tree, sMin, sMax, lean) {
      const n = ++scatTreeCount;
      const s = sMin + (sMax - sMin) * scatHash(n, 1);
      tree.scale.set(s * (0.94 + 0.12 * scatHash(n, 2)), s, s * (0.94 + 0.12 * scatHash(n, 3)));
      // a slight lean, as trees on real ground have (in the tree's own frame, so it turns with it)
      const inner = new THREE.Group();
      tree.children.slice().forEach(c => inner.add(c));
      inner.rotation.set((scatHash(n, 4) - 0.5) * 2 * lean, 0, (scatHash(n, 5) - 0.5) * 2 * lean);
      tree.add(inner);
      tree.userData.scatTree = { r: 0.9 * s };
    }

// --- 3. Grass and flowers near the camera --------------------------------------------------------
// Replaces realism.js's updateGrassTufts: two rings of the same jittered grid, fine close in (innerCell)
// and coarse further out (outerCell, bigger tufts), thinning toward the edge. Flowers share the spots.
let scatFlowers = null;
const scatGrassCentre = new THREE.Vector3();
function scatFlowerGeometry() {
      const pos = [], col = [], sway = [], nor = [];
      // a thin stem (two crossed blades) and a five-petal head facing up
      const h = 0.62;
      [[0.02, 0], [0, 0.02]].forEach(([wx, wz]) => {
        pos.push(-wx, 0, -wz, wx, 0, wz, 0, h, 0);
        col.push(0.22, 0.42, 0.14, 0.22, 0.42, 0.14, 0.3, 0.5, 0.18);
        sway.push(0, 0, 0.9);
        nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      });
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2, b = a + 0.62, c = a - 0.62, r = 0.13;
        pos.push(0, h + 0.015, 0, Math.cos(b) * r, h + 0.04, Math.sin(b) * r, Math.cos(c) * r, h + 0.04, Math.sin(c) * r);
        col.push(1.15, 1.15, 0.7, 1, 1, 1, 1, 1, 1);
        sway.push(1, 1, 1);
        nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute('keloSway', new THREE.Float32BufferAttribute(sway, 1));
      return g;
    }
const SCAT_PETALS = [[1.0, 0.86, 0.3], [1.0, 1.0, 0.96], [0.86, 0.5, 0.95], [1.0, 0.52, 0.62], [0.55, 0.66, 1.0], [1.0, 0.62, 0.3]];
function scatEnsureGrassMeshes(cap) {
      if (grassTufts && grassTufts.userData.cap >= cap) return;
      [grassTufts, scatFlowers].forEach(m => { if (m) { scene.remove(m); m.geometry.dispose(); m.dispose && m.dispose(); } });
      const make = (geo, n, ds) => {
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9, side: ds ? THREE.DoubleSide : THREE.FrontSide });
        mat.onBeforeCompile = foliageSwayShader;
        const m = new THREE.InstancedMesh(geo, mat, n);
        m.userData = { cap: n, noShadow: true };
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
        m.frustumCulled = false;
        m.castShadow = false;
        m.receiveShadow = true;
        m.count = 0;
        if (typeof chunkDynamic !== 'undefined' && chunkDynamic.add) chunkDynamic.add(m);
        scene.add(m);
        return m;
      };
      grassTufts = make(grassTuftGeometry(), cap, true);
      scatFlowers = make(scatFlowerGeometry(), Math.ceil(cap * 0.15), true);
      grassState.x = 1e9;
    }

updateGrassTufts = function scatUpdateGrass() {
      const q = graphics(), R = q.grassRadius || 0;
      if (!R || !terrainGroundMesh || typeof controls === 'undefined' || !controls) { if (grassTufts) grassTufts.visible = false; if (scatFlowers) scatFlowers.visible = false; return; }
      const G = LOOK.grass, ci = G.innerCell, co = G.outerCell, Ri = Math.min(R, G.innerR);
      const cap = Math.ceil(Math.PI * Ri * Ri / (ci * ci) + Math.PI * Math.max(0, R * R - Ri * Ri) / (co * co) + 64);
      scatEnsureGrassMeshes(cap);
      // centred between what the camera looks at and the ground under it (the foreground gets grass too)
      const cam = camera.position, tgt = controls.target;
      const tg = scatGrassCentre.set(tgt.x + (cam.x - tgt.x) * 0.4, 0, tgt.z + (cam.z - tgt.z) * 0.4);
      const far = cam.y - getAnalyticalGroundHeight(cam.x, cam.z) > 45;
      grassTufts.visible = !far;
      scatFlowers.visible = !far && Boolean(q.flowers);
      const col = terrainGroundMesh.geometry.attributes.color;
      const key = `${R}|${q.flowers ? 1 : 0}|${col.version}|${typeof seasonApplied !== 'undefined' ? seasonApplied : ''}|${typeof obstacleVersion !== 'undefined' ? obstacleVersion : 0}|${(state.worldEdits || []).length}|${(state.concretePours || []).length}`;
      const moved = Math.hypot(tg.x - grassState.x, tg.z - grassState.z) >= R * 0.12;
      const now = performance.now();
      if (far || (!moved && (key === grassState.key || now - grassState.at < 1500))) return;
      grassState.x = tg.x; grassState.z = tg.z; grassState.key = key; grassState.at = now;
      grassState.near = [];
      grassState.floors = grassFloorRects().filter(r => r.maxX > tg.x - R - 1 && r.minX < tg.x + R + 1 && r.maxZ > tg.z - R - 1 && r.minZ < tg.z + R + 1);
      (typeof worldObstacles !== 'undefined' ? worldObstacles : []).forEach(o => { if (Math.hypot(o.x - tg.x, o.z - tg.z) < R + (o.r || 1) + 1) grassState.near.push(o); });
      (state.worldEdits || []).forEach(e => { if (e.type === 'road' && Number.isFinite(e.toX)) grassState.near.push({ road: true, x: e.x, z: e.z, toX: e.toX, toZ: e.toZ }); });
      (state.concretePours || []).forEach(p => { if (Number.isFinite(p.toX)) grassState.near.push({ road: true, x: p.x, z: p.z, toX: p.toX, toZ: p.toZ, hw: (p.w || 1.2) / 2 + 0.3 }); });
      const m = new THREE.Matrix4(), qq = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
      const winter = typeof seasonApplied !== 'undefined' && seasonApplied === 'Winter';
      const flowerChance = q.flowers && !winter ? G.flowerChance * (typeof seasonApplied !== 'undefined' && seasonApplied === 'Spring' ? 1.8 : seasonApplied === 'Autumn' ? 0.4 : 1) : 0;
      let k = 0, kf = 0;
      const ring = (cell, rMin, rMax, sizeK, layer) => {
        const n = Math.ceil(rMax / cell), cx = Math.round(tg.x / cell), cz = Math.round(tg.z / cell);
        for (let j = -n; j <= n; j++) {
          for (let i = -n; i <= n; i++) {
            const gi = cx + i, gj = cz + j;
            const h0 = grassHash(gi, gj, 1 + layer * 10);
            if (h0 > 0.92) continue;
            const x = gi * cell + (grassHash(gi, gj, 2 + layer * 10) - 0.5) * cell * 0.95, z = gj * cell + (grassHash(gi, gj, 3 + layer * 10) - 0.5) * cell * 0.95;
            const d = Math.hypot(x - tg.x, z - tg.z);
            if (d > rMax || d < rMin) continue;
            // thins out with distance: fewer tufts toward the edge
            const thin = (d - Ri * 0.5) / (R - Ri * 0.5);
            if (thin > 0 && grassHash(gi, gj, 7 + layer * 10) < thin * 0.55) continue;
            if (!grassGroundColour(x, z, c)) continue;
            if (!(c.g > c.r * 0.97 && c.g > c.b * 1.25)) continue;
            const ym = typeof terrainMeshHeightAt === 'function' ? terrainMeshHeightAt(x, z) : null;
            const y = ym === null ? getAnalyticalGroundHeight(x, z) : ym;
            if (y < 0.02 || y > 3.2) continue;
            if (grassBlockedAt(x, z)) continue;
            const fade = Math.min(1, (R - d) / (R * 0.25));
            const hs = grassHash(gi, gj, 4 + layer * 10);
            qq.setFromAxisAngle(up, grassHash(gi, gj, 5 + layer * 10) * Math.PI * 2);
            if (flowerChance && kf < scatFlowers.userData.cap && grassHash(gi, gj, 8 + layer * 10) < flowerChance * (0.6 + 0.8 * Math.sin(x * 0.21 + z * 0.17) ** 2)) {
              const fs = (0.5 + hs * 0.3) * (0.4 + 0.6 * fade) * sizeK;
              m.compose(p.set(x, y - 0.01, z), qq, sc.set(fs, fs * (0.8 + hs * 0.5), fs));
              scatFlowers.setMatrixAt(kf, m);
              const pc = SCAT_PETALS[Math.floor(grassHash(Math.floor(x / 3), Math.floor(z / 3), 9) * SCAT_PETALS.length)];
              c.setRGB(pc[0], pc[1], pc[2]);
              scatFlowers.setColorAt(kf, c);
              kf++;
              continue;
            }
            if (k >= grassTufts.userData.cap) continue;
            const s = (0.28 + hs * 0.28) * (0.35 + 0.65 * fade) * sizeK;
            m.compose(p.set(x, y - 0.01, z), qq, sc.set(s * 1.4, s * (0.85 + 0.3 * grassHash(gi, gj, 6 + layer * 10)), s * 1.4));
            grassTufts.setMatrixAt(k, m);
            c.multiplyScalar(0.82 + grassHash(gi, gj, 6) * 0.4);
            // drier, yellower tips here and there
            if (grassHash(gi >> 2, gj >> 2, 11) > 0.7) c.setRGB(c.r * 1.15, c.g * 1.07, c.b * 0.88);
            grassTufts.setColorAt(k, c);
            k++;
          }
        }
      };
      ring(ci, 0, Ri, 1, 0);
      if (R > Ri) ring(co, Ri, R, 1.35, 1);
      grassTufts.count = k;
      scatFlowers.count = kf;
      // culled as one patch around where they were laid
      [grassTufts, scatFlowers].forEach(mm => { mm.frustumCulled = true; mm.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(tg.x, getAnalyticalGroundHeight(tg.x, tg.z), tg.z), R + 2); });
      [grassTufts, scatFlowers].forEach(mm => { mm.instanceMatrix.needsUpdate = true; if (mm.instanceColor) mm.instanceColor.needsUpdate = true; });
    };

// --- 4. The valley's decorative flower patches, instanced ----------------------------------------
// scene.js hands its spots here instead of building 70 two-mesh flowers
function scatValleyFlowers(spots) {
      if (!spots.length) return;
      const geo = scatFlowerGeometry();
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });
      mat.onBeforeCompile = foliageSwayShader;
      const mesh = new THREE.InstancedMesh(geo, mat, spots.length * 5);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
      let k = 0;
      spots.forEach(({ x, z, color }, i) => {
        // a little clump of 3-5 around each old spot
        const n = 3 + (i % 3);
        for (let j = 0; j < n; j++) {
          const a = scatHash(i, j) * Math.PI * 2, r = j ? 0.12 + scatHash(i, j + 9) * 0.28 : 0;
          const fx = x + Math.cos(a) * r, fz = z + Math.sin(a) * r;
          const k2 = 0.42 + scatHash(i, j + 3) * 0.2;
          q.setFromAxisAngle(up, a * 3);
          m.compose(p.set(fx, getAnalyticalGroundHeight(fx, fz) - 0.01, fz), q, s.set(k2, k2, k2));
          mesh.setMatrixAt(k, m);
          mesh.setColorAt(k, c.setHex(color));
          k++;
        }
      });
      mesh.count = k;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.userData.noShadow = true;
      scene.add(mesh);
      return mesh;
    }

// --- 5. Contact shadows ----------------------------------------------------------------------------
// A soft dark patch on the ground right under things, where the sky can't reach (what ambient
// occlusion would give, baked). One instanced mesh of flat quads, multiplied over the ground.
let scatContact = null;
const scatContactState = { sig: '', at: 0 };
function scatContactTexture() {
      const size = 64, cv = document.createElement('canvas');
      cv.width = cv.height = size;
      const ctx = cv.getContext('2d');
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.45, 'rgba(0,0,0,0.6)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size, size);
      // multiply blending: white leaves the ground alone, darker darkens it
      const img = ctx.createImageData(size, size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        // a rounded square falloff, so building footprints get soft corners
        const u = Math.abs(x + 0.5 - size / 2) / (size / 2), v = Math.abs(y + 0.5 - size / 2) / (size / 2);
        const d = Math.pow(Math.pow(u, 3) + Math.pow(v, 3), 1 / 3);
        const a = Math.max(0, 1 - d);
        const val = Math.round(255 * (1 - a * a * (3 - 2 * a)));
        const i = (y * size + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = val; img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      const t = new THREE.CanvasTexture(cv);
      return t;
    }
function scatContactSpots() {
      const out = [], C = LOOK.contact;
      // buildings: their footprints, a little bigger
      if (typeof minimapBuildings === 'function') minimapBuildings().forEach(b => {
        if (!Number.isFinite(b.x) || !b.w || !b.d) return;
        out.push({ x: b.x, z: b.z, w: b.w + C.buildingPad * 2, d: b.d + C.buildingPad * 2, rot: 0, k: 0.85 });
      });
      // trees still standing, and the mountain's firs
      scene.children.forEach(o => {
        const t = o.userData && o.userData.scatTree;
        if (!t || !o.visible) return;
        const r = C.treeR * t.r * 2.2;
        out.push({ x: o.position.x, z: o.position.z, w: r, d: r, rot: 0, k: 1, tilt: true });
      });
      // rocks and other small round obstacles
      (typeof worldObstacles !== 'undefined' ? worldObstacles : []).forEach(o => {
        if (o.hw !== undefined || !o.r || o.r > 1.2 || o.r < 0.3) return;
        out.push({ x: o.x, z: o.z, w: o.r * 2.6, d: o.r * 2.6, rot: 0, k: 0.8, tilt: true });
      });
      return out;
    }
function scatBuildContact() {
      const q = graphics();
      if (!q.contactShadows) { if (scatContact) scatContact.visible = false; return; }
      const spots = scatContactSpots();
      const sig = spots.length + '|' + spots.reduce((a, s) => a + s.x * 0.37 + s.z * 0.11, 0).toFixed(2);
      if (scatContact && sig === scatContactState.sig) { scatContact.visible = true; return; }
      scatContactState.sig = sig;
      if (!scatContact || scatContact.userData.cap < spots.length) {
        if (scatContact) { scene.remove(scatContact); scatContact.dispose && scatContact.dispose(); }
        const geo = new THREE.PlaneGeometry(1, 1);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({ map: scatContactTexture(), transparent: true, depthWrite: false, blending: THREE.MultiplyBlending, fog: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
        // strength: lighten the texture toward white
        mat.onBeforeCompile = (sh) => {
          sh.uniforms.contactK = scatContactK;
          sh.fragmentShader = 'uniform float contactK;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb = mix( vec3( 1.0 ), diffuseColor.rgb, contactK * vKeloContact );')
            .replace('void main() {', 'varying float vKeloContact;\nvoid main() {');
          sh.vertexShader = 'attribute float contactStrength;\nvarying float vKeloContact;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvKeloContact = contactStrength;');
        };
        const cap = spots.length + 64;
        scatContact = new THREE.InstancedMesh(geo, mat, cap);
        geo.setAttribute('contactStrength', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1));
        scatContact.userData = { cap, noShadow: true };
        scatContact.castShadow = scatContact.receiveShadow = false;
        scatContact.renderOrder = -1;
        scatContact.frustumCulled = false;
        if (typeof chunkDynamic !== 'undefined' && chunkDynamic.add) chunkDynamic.add(scatContact);
        scene.add(scatContact);
      }
      const m = new THREE.Matrix4(), qq = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), nrm = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
      const strength = scatContact.geometry.attributes.contactStrength;
      spots.forEach((sp, i) => {
        const h = (x, z) => (typeof getIslandGroundHeight === 'function' ? getIslandGroundHeight(x, z) : getAnalyticalGroundHeight(x, z));
        const y = h(sp.x, sp.z);
        if (sp.tilt) {
          const e = 0.6;
          nrm.set(h(sp.x - e, sp.z) - h(sp.x + e, sp.z), 2 * e, h(sp.x, sp.z - e) - h(sp.x, sp.z + e)).normalize();
          qq.setFromUnitVectors(up, nrm);
        } else qq.identity();
        m.compose(p.set(sp.x, y + 0.03, sp.z), qq, s.set(sp.w, 1, sp.d));
        scatContact.setMatrixAt(i, m);
        strength.setX(i, sp.k);
      });
      scatContact.count = spots.length;
      if (spots.length) {
        const xs = spots.map(p => p.x), zs = spots.map(p => p.z), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
        scatContact.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, 0, cz), Math.hypot(Math.max(...xs) - cx, Math.max(...zs) - cz) + 12);
        scatContact.frustumCulled = true;
      }
      scatContact.instanceMatrix.needsUpdate = true;
      strength.needsUpdate = true;
      scatContact.visible = true;
    }
const scatContactK = { value: LOOK.contact.strength };

// --- 6. Level changes and upkeep ------------------------------------------------------------------
function scatApplyLevel() {
      scatContactState.sig = '';
      scatBuildContact();
      if (typeof grassState !== 'undefined') grassState.x = 1e9;
    }
window.addEventListener('DOMContentLoaded', () => {
  // trees get chopped and things move: re-lay the contact shadows now and then (cheap when unchanged)
  setInterval(() => { if (typeof scene !== 'undefined' && scene && terrainGroundMesh) scatBuildContact(); }, 3000);
});
