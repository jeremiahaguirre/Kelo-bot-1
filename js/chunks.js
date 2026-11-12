// Kelo-bot-1 — js/chunks.js
// Loaded after perf.js. The world is split into square chunks (CHUNK_SIZE units, like Minecraft's)
// and every static object is registered into the chunk under its middle:
//   - trees, rocks, props, buildings, his plantings, roads and builds, things left in the world. New
//     objects register themselves: the scene (and any big group) is rescanned every couple of seconds,
//     so whatever another file adds or moves later just joins, at any spot (the grid has no bounds, so a
//     bigger world only adds chunks).
//   - nothing is reparented (code reads .parent). A registered mesh gets a KeloChunkLayers in place of
//     its THREE.Layers; its test() is what the renderer asks before it even looks at the mesh, so a whole
//     chunk is skipped with one box test a frame. .visible is never touched (other code owns it), and
//     raycasts, other cameras and the Map tab (drawn from data) are unaffected.
//   - each frame: a chunk is drawn when its box (plus a margin) is in the camera's view and within the
//     draw distance (the Graphics level's, or where the fog has hidden it, whichever is nearer). It casts
//     shadows only when its box is in the sun's shadow box.
//   - LOD: a chunk that is not right by the camera and has been quiet for a few seconds is drawn as one
//     merged mesh per material (same materials, same triangles, so it looks the same: trees keep their
//     own sway in the wind). Anything that changes (moves, turns, grows, hides, changes material) is
//     noticed by a rolling check of every mesh, the chunk goes back to its own meshes at once, and the
//     changing mesh is left out of the next merge. A merged chunk casts its shadows as the merged meshes too.
//   - Dynamic things (Kelo-1, vehicles, animals, his friend, carried items, clouds, birds, particles,
//     sky) are never registered, and any registered object that moves off its spot is let go: it falls
//     back to the renderer's own per-mesh frustum culling.
// window.KELO_CHUNKS_OFF = true turns it all off (for comparisons).

const CHUNK_SIZE = 32;
const CHUNK_MARGIN = 4;          // view-test slack around a chunk's box
const CHUNK_SHADOW_MARGIN = 10;  // the shadow box is from last frame; a little slack
const CHUNK_PROXY_NEAR = 24;     // closer than this the real meshes are drawn
const CHUNK_QUIET_MS = 4000;     // a chunk must be unchanged this long before it is merged
const CHUNK_BUSY_MS = 15000;     // a mesh that changed is left out of merges this long
// Meshes looked at per second (a full pass over ~1500 meshes takes about 0.15 s), so the cost doesn't
// grow with the screen's refresh rate; at least CHUNK_CHECK_MIN and at most CHUNK_CHECK_MAX a frame
const CHUNK_CHECK_PER_SEC = 9600, CHUNK_CHECK_MIN = 64, CHUNK_CHECK_MAX = 320;
let chunkCheckLast = 0;
const chunkMap = new Map();      // "cx,cz" -> chunk
const chunkEntries = [];         // registered roots
const chunkSeen = new WeakSet(); // objects already looked at (registered, a container, global or dynamic)
const chunkContainers = new Set();
const chunkDynamic = new WeakSet();
const chunkSwayClones = new Map(); // source sway material -> its merged copy
const chunkView = { frustum: new THREE.Frustum(), shadow: new THREE.Frustum(), m: new THREE.Matrix4(), box: new THREE.Box3(), v: new THREE.Vector3(), shadowOk: false };
let chunkShadowPhase = false;
let chunkProxyRoot = null, chunkReady = false, chunkCheckAt = 0, chunkScanAt = 0, chunkBuildWait = 0;
let chunkFrameMs = 0;

// The renderer asks every object's layers.test(camera.layers) first, for the main view (projectObject)
// and again for the shadow map (with the same camera), so a chunk decides both here.
class KeloChunkLayers extends THREE.Layers {
  constructor(chunk, mask) { super(); this.mask = mask; this.chunk = chunk; this.gen = -1; this.sig = NaN; this.busyAt = 0; this.nofog = false; }
  test(layers) {
    if ((this.mask & layers.mask) === 0) return false;
    const c = this.chunk;
    if (!c || window.KELO_CHUNKS_OFF || layers !== camera.layers) return true;
    const merged = c.proxyOn && this.gen === c.gen;
    if (chunkShadowPhase) return c.shadow && !merged;
    return c.inView && (c.inRange || this.nofog) && !merged;
  }
}

function chunkKeyAt(x, z) { return Math.floor(x / CHUNK_SIZE) + ',' + Math.floor(z / CHUNK_SIZE); }

function chunkGet(key) {
      let c = chunkMap.get(key);
      if (!c) {
        c = { key, entries: [], box: new THREE.Box3(), viewBox: new THREE.Box3(), inView: true, inRange: true, shadow: true, dist: 0,
          gen: 0, proxy: null, proxyOn: false, changedAt: performance.now(), mergeable: true };
        chunkMap.set(key, c);
      }
      return c;
    }

function chunkRefreshBox(c) {
      c.box.makeEmpty();
      c.entries.forEach(e => c.box.union(e.box));
      c.viewBox.copy(c.box).expandByScalar(CHUNK_MARGIN);
    }

// Things that move on their own or must always draw are never chunked
function chunkIsDynamic(o) {
      if (chunkDynamic.has(o) || o.isLight || o.isCamera || o.isPoints || o.isLine || o.isSprite || o.frustumCulled === false) return true;
      if (o === chunkProxyRoot || (typeof keloGroup !== 'undefined' && o === keloGroup)) return true;
      const named = [
        typeof cloudGroup !== 'undefined' && cloudGroup, typeof birdFlockGroup !== 'undefined' && birdFlockGroup,
        typeof ogopogoGroup !== 'undefined' && ogopogoGroup, typeof sailboatGroup !== 'undefined' && sailboatGroup,
        typeof wildlifeGroup !== 'undefined' && wildlifeGroup, typeof carriedObject !== 'undefined' && carriedObject,
        typeof skyMesh !== 'undefined' && skyMesh, typeof skyDome !== 'undefined' && skyDome,
        typeof companionBot !== 'undefined' && companionBot && companionBot.group,
        typeof petAnimal !== 'undefined' && petAnimal && petAnimal.group
      ];
      if (named.includes(o)) return true;
      if (typeof vehicleMeshes !== 'undefined' && Object.values(vehicleMeshes).includes(o)) return true;
      if (typeof assemblyMeshes !== 'undefined' && Object.values(assemblyMeshes).includes(o)) return true;
      return false;
    }

function chunkDrawable(o) { return o.isMesh || o.isPoints || o.isLine || o.isSprite; }

// Look at one object under a container: register it, make it a container, or leave it alone
function chunkConsider(o) {
      if (chunkSeen.has(o)) return;
      chunkSeen.add(o);
      if (chunkIsDynamic(o)) return;
      const box = new THREE.Box3().setFromObject(o);
      if (box.isEmpty()) {
        // An empty group (things get added to it later) or an object with nothing to draw
        if (!chunkDrawable(o)) chunkContainers.add(o);
        return;
      }
      const size = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
      if (size > CHUNK_SIZE * 1.25) {
        // Too big for one chunk: its parts go in on their own; a big single mesh (terrain, the lake,
        // the outer lands) stays as it is
        if (o.children.length) { chunkContainers.add(o); o.children.forEach(chunkConsider); }
        return;
      }
      const at = box.getCenter(new THREE.Vector3());
      const e = { obj: o, box, home: new THREE.Vector3().setFromMatrixPosition(o.matrixWorld), chunk: null, sig: NaN, parent: o.parent };
      chunkPlace(e, chunkGet(chunkKeyAt(at.x, at.z)));
      chunkEntries.push(e);
    }

function chunkPlace(e, c) {
      if (e.chunk) { const i = e.chunk.entries.indexOf(e); if (i >= 0) e.chunk.entries.splice(i, 1); chunkDirty(e.chunk); chunkRefreshBox(e.chunk); }
      e.chunk = c;
      if (!c) { e.obj.traverse(o => { if (o.layers instanceof KeloChunkLayers) o.layers.chunk = null; }); return; }
      c.entries.push(e);
      chunkRefreshBox(c);
      chunkDirty(c);
      e.obj.traverse(o => chunkTag(o, c));
    }

function chunkTag(o, c) {
      if (!chunkDrawable(o)) return;
      if (o.layers instanceof KeloChunkLayers) { o.layers.chunk = c; return; }
      const L = new KeloChunkLayers(c, o.layers.mask);
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      L.nofog = Boolean(m && m.fog === false);
      o.layers = L;
    }

// Taken out of the world or moved under something else: it no longer follows its old chunk (a shelf
// item he picks up, a part a building merges away). The rolling check tags it again where it lands.
function chunkUntag(o) {
      o.traverse(m => { if (m.layers instanceof KeloChunkLayers) m.layers.chunk = null; });
    }
const chunkRemoveChild = THREE.Object3D.prototype.remove;
THREE.Object3D.prototype.remove = function (...objs) {
      for (const o of objs) if (o && o.isObject3D && o.parent === this) chunkUntag(o);
      return chunkRemoveChild.apply(this, objs);
    };

function chunkDirty(c) {
      c.changedAt = performance.now();
      if (c.proxy) chunkDropProxy(c);
      c.gen++;
    }

function chunkDropProxy(c) {
      if (!c.proxy) return;
      c.proxy.children.forEach(m => m.geometry.dispose());
      chunkProxyRoot.remove(c.proxy);
      c.proxy = null;
      c.proxySources = null;
      c.proxyOn = false;
    }

// Let an object go: it moved, so it is dynamic and the renderer's own culling handles it
function chunkRelease(e) {
      chunkDynamic.add(e.obj);
      chunkPlace(e, null);
      const i = chunkEntries.indexOf(e);
      if (i >= 0) chunkEntries.splice(i, 1);
    }

// One mesh's signature: where it is, how it is turned and scaled, its material and geometry
function chunkMeshSig(o) {
      const e = o.matrixWorld.elements, m = Array.isArray(o.material) ? o.material[0] : o.material, g = o.geometry;
      const pv = g && g.attributes && g.attributes.position ? g.attributes.position.version : 0;
      return e[12] * 1.31 + e[13] * 2.17 + e[14] * 3.11 + e[0] * 5.3 + e[1] * 4.1 + e[2] * 7.1 + e[5] * 11.3 + e[8] * 6.7 + e[10] * 9.7 +
        (m ? m.id * 0.013 + (m.visible ? 13 : 0) + (m.transparent ? 17 : 0) : 0) + (g ? g.id * 0.017 : 0) + pv * 0.19 + o.layers.mask * 0.7 + (o.castShadow ? 19 : 0) + (o.receiveShadow ? 23 : 0);
    }

// The rolling check: a few hundred meshes a frame. A mesh that changed is marked busy (left out of
// the next merges); if it was in the chunk's merged mesh, or a merged one is hidden now, the chunk shows
// its real meshes again at once. New meshes in a registered object are tagged.
function chunkCheck(now) {
      let n = 0;
      const gap = chunkCheckLast ? Math.max(0, now - chunkCheckLast) : 1000 / 30;
      chunkCheckLast = now;
      const budget = Math.max(CHUNK_CHECK_MIN, Math.min(CHUNK_CHECK_MAX, Math.round(CHUNK_CHECK_PER_SEC * gap / 1000)));
      for (let k = 0; k < chunkEntries.length && n < budget; k++) {
        if (chunkCheckAt >= chunkEntries.length) chunkCheckAt = 0;
        const e = chunkEntries[chunkCheckAt++];
        const o = e.obj, c = e.chunk;
        if (o.parent !== e.parent || !chunkInScene(o)) { chunkPlace(e, null); chunkEntries.splice(chunkCheckAt - 1, 1); chunkCheckAt--; continue; }
        // It moved off its spot: dynamic from now on
        chunkView.v.setFromMatrixPosition(o.matrixWorld);
        if (chunkView.v.distanceToSquared(e.home) > 0.25) { chunkRelease(e); chunkCheckAt--; continue; }
        let moved = false, stale = false, merged = 0;
        let hidden = false;
        for (let a = o.parent; a; a = a.parent) if (!a.visible) hidden = true;
        if (!hidden) o.traverseVisible(m => {
          if (!chunkDrawable(m)) return;
          n++;
          if (!(m.layers instanceof KeloChunkLayers) || m.layers.chunk !== c) { chunkTag(m, c); moved = true; }
          const L = m.layers, s = chunkMeshSig(m), inProxy = c.proxy && L.gen === c.gen;
          if (inProxy) merged++;
          if (s !== L.sig) {
            // (a leafy top swaying in the wind, wind.js: kept out of merges, but its few tenths of a unit
            // don't need the box measured again; CHUNK_MARGIN covers them)
            if (L.sig === L.sig) { L.busyAt = now; if (!m.userData.windBase) moved = true; if (inProxy) stale = true; }
            L.sig = s;
          }
        });
        // A merged part that is hidden now (it, or a group above it) would still show in the merge
        if (c.proxy && e.merged !== undefined && e.mergedGen === c.gen && merged < e.merged) stale = true;
        e.merged = merged; e.mergedGen = c.gen;
        if (moved) {
          // (the box follows whatever moves inside it, so the chunk test stays right)
          e.box.setFromObject(o);
          if (e.box.isEmpty()) e.box.setFromCenterAndSize(e.home, chunkView.v.set(0.01, 0.01, 0.01));
          chunkRefreshBox(c);
        }
        if (stale) chunkDirty(c);
      }
    }

function chunkInScene(o) {
      while (o.parent) o = o.parent;
      return o === scene;
    }

// New objects anywhere under the scene or a big group join their chunk
function chunkScan() {
      scene.children.forEach(chunkConsider);
      chunkContainers.forEach(g => {
        if (!chunkInScene(g)) { chunkContainers.delete(g); return; }
        g.children.forEach(chunkConsider);
      });
    }

// --- Merged chunks ---------------------------------------------------------------------------------
const chunkDefaultBeforeCompile = THREE.Material.prototype.onBeforeCompile;
const chunkDefaultBeforeRender = THREE.Object3D.prototype.onBeforeRender;

function chunkSwayMaterial(src) {
      let m = chunkSwayClones.get(src);
      if (!m) {
        m = src.clone();
        // The merged geometry is in world space: each vertex carries its own tree's root for the sway
        m.onBeforeCompile = function chunkSwayShader(shader) {
          foliageSwayShader(shader);
          shader.vertexShader = 'attribute vec3 keloRoot;\n' + shader.vertexShader.replace('vec3 kRoot = kM[3].xyz;', 'vec3 kRoot = keloRoot;');
        };
        chunkSwayClones.set(src, m);
      }
      return m;
    }

function chunkMergeable(o, c, now) {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.morphTargetInfluences || Array.isArray(o.material)) return false;
      const L = o.layers;
      if (!(L instanceof KeloChunkLayers) || L.chunk !== c || L.mask !== 1 || now - L.busyAt < CHUNK_BUSY_MS) return false;
      const m = o.material, g = o.geometry;
      if (!m || !m.visible || m.transparent || o.renderOrder !== 0 || !o.frustumCulled || o.onBeforeRender !== chunkDefaultBeforeRender) return false;
      if (m.onBeforeCompile !== chunkDefaultBeforeCompile && !(typeof foliageSwayShader === 'function' && m.onBeforeCompile === foliageSwayShader)) return false;
      // Small shadow casters switch their shadow on and off with the camera (js/realism.js): left alone
      if (o.castShadow && typeof smallCasters !== 'undefined' && smallCasters.has(o)) return false;
      if (!g || !g.isBufferGeometry || !g.attributes.position || Object.keys(g.morphAttributes).length || g.drawRange.count !== Infinity || g.drawRange.start !== 0) return false;
      for (const n in g.attributes) if (g.attributes[n].isInterleavedBufferAttribute) return false;
      if (!(g.attributes.position.array instanceof Float32Array) || (g.attributes.normal && !(g.attributes.normal.array instanceof Float32Array))) return false;
      return true;
    }

function chunkBuildProxy(c, now) {
      const sets = new Map();
      c.entries.forEach(e => e.obj.traverseVisible(o => {
        if (!chunkMergeable(o, c, now)) return;
        const g = o.geometry, names = Object.keys(g.attributes).sort();
        const key = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}|${names.map(n => `${n}${g.attributes[n].itemSize}${g.attributes[n].array.constructor.name}${g.attributes[n].normalized}`).join(',')}`;
        if (!sets.has(key)) sets.set(key, []);
        sets.get(key).push(o);
      }));
      const group = new THREE.Group();
      group.matrixAutoUpdate = false;
      const nm = new THREE.Matrix3(), v = new THREE.Vector3();
      const sources = [];
      let joined = 0;
      sets.forEach(list => {
        if (list.length < 2) return;
        const first = list[0], g0 = first.geometry, names = Object.keys(g0.attributes);
        const sway = first.material.onBeforeCompile !== chunkDefaultBeforeCompile;
        let verts = 0, idx = 0;
        list.forEach(o => { const p = o.geometry.attributes.position; verts += p.count; idx += o.geometry.index ? o.geometry.index.count : p.count; });
        if (verts > 400000) return;
        const out = new THREE.BufferGeometry();
        const arrays = {};
        names.forEach(n => { const a = g0.attributes[n]; arrays[n] = new a.array.constructor(verts * a.itemSize); });
        const root = sway ? new Float32Array(verts * 3) : null;
        const index = verts > 65535 ? new Uint32Array(idx) : new Uint16Array(idx);
        let vo = 0, io = 0;
        list.forEach(o => {
          const g = o.geometry, mw = o.matrixWorld, cnt = g.attributes.position.count;
          nm.getNormalMatrix(mw);
          names.forEach(n => {
            const a = g.attributes[n], s = a.itemSize, dst = arrays[n], src = a.array;
            if (n === 'position') for (let i = 0; i < cnt; i++) { v.fromArray(src, i * 3).applyMatrix4(mw); v.toArray(dst, (vo + i) * 3); }
            else if (n === 'normal') for (let i = 0; i < cnt; i++) { v.fromArray(src, i * 3).applyMatrix3(nm).normalize(); v.toArray(dst, (vo + i) * 3); }
            else dst.set(src.length === cnt * s ? src : src.subarray(0, cnt * s), (vo) * s);
          });
          if (root) { const x = mw.elements[12], y = mw.elements[13], z = mw.elements[14]; for (let i = 0; i < cnt; i++) { root[(vo + i) * 3] = x; root[(vo + i) * 3 + 1] = y; root[(vo + i) * 3 + 2] = z; } }
          const flip = mw.determinant() < 0;
          if (g.index) {
            const src = g.index.array, ic = g.index.count;
            for (let i = 0; i < ic; i += 3) { index[io++] = src[i] + vo; index[io++] = src[flip ? i + 2 : i + 1] + vo; index[io++] = src[flip ? i + 1 : i + 2] + vo; }
          } else {
            for (let i = 0; i < cnt; i += 3) { index[io++] = vo + i; index[io++] = vo + (flip ? i + 2 : i + 1); index[io++] = vo + (flip ? i + 1 : i + 2); }
          }
          vo += cnt;
        });
        names.forEach(n => out.setAttribute(n, new THREE.BufferAttribute(arrays[n], g0.attributes[n].itemSize, g0.attributes[n].normalized)));
        if (root) out.setAttribute('keloRoot', new THREE.BufferAttribute(root, 3));
        out.setIndex(new THREE.BufferAttribute(index, 1));
        out.computeBoundingSphere();
        out.computeBoundingBox();
        const mesh = new THREE.Mesh(out, sway ? chunkSwayMaterial(first.material) : first.material);
        mesh.matrixAutoUpdate = false;
        mesh.castShadow = first.castShadow; // the same shadow the parts cast
        mesh.receiveShadow = first.receiveShadow;
        mesh.raycast = () => {};          // never picked: clicks and hovers find the real meshes
        mesh.userData.noShadow = true;
        group.add(mesh);
        list.forEach(o => { o.layers.gen = c.gen; });
        sources.push(...list);
        joined += list.length;
      });
      if (!group.children.length) { c.mergeable = false; return false; }
      chunkProxyRoot.add(group);
      c.proxy = group;
      c.proxyParts = joined;
      c.proxySources = sources;
      return true;
    }

// --- Each frame --------------------------------------------------------------------------------------
function chunkDrawDistance() {
      const q = typeof graphics === 'function' ? graphics() : null;
      let d = (q && q.drawDist) || 900;
      // Past where the haze leaves 1% of a thing showing, it is gone anyway
      if (scene.fog && scene.fog.isFogExp2 && scene.fog.density > 0) d = Math.min(d, 2.146 / scene.fog.density);
      else if (scene.fog && scene.fog.far) d = Math.min(d, scene.fog.far);
      return d;
    }

function chunkFrame(now) {
      if (!chunkReady || window.KELO_CHUNKS_OFF) { if (chunkProxyRoot) chunkProxyRoot.visible = false; return; }
      const t0 = performance.now();
      chunkProxyRoot.visible = true;
      if (now - chunkScanAt > 2000) { chunkScanAt = now; chunkScan(); }
      chunkCheck(now);
      camera.updateMatrixWorld();
      const V = chunkView;
      V.frustum.setFromProjectionMatrix(V.m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const sc = typeof sunLight !== 'undefined' && sunLight && sunLight.castShadow !== false ? sunLight.shadow.camera : null;
      V.shadowOk = Boolean(sc && renderer.shadowMap.enabled && !sc.matrixWorldInverse.equals(V.m.identity()));
      if (V.shadowOk) V.shadow.setFromProjectionMatrix(V.m.multiplyMatrices(sc.projectionMatrix, sc.matrixWorldInverse));
      const far = chunkDrawDistance(), cam = camera.position;
      let build = null;
      chunkMap.forEach(c => {
        if (c.box.isEmpty()) { c.inView = false; c.shadow = false; c.proxyOn = false; return; }
        c.dist = c.box.distanceToPoint(cam);
        c.inView = V.frustum.intersectsBox(c.viewBox);
        c.inRange = c.dist < far;
        c.shadow = !V.shadowOk || V.shadow.intersectsBox(V.box.copy(c.box).expandByScalar(CHUNK_SHADOW_MARGIN));
        const wantProxy = c.dist > CHUNK_PROXY_NEAR && now - c.changedAt > CHUNK_QUIET_MS;
        if (wantProxy && !c.proxy && c.mergeable && c.inView && c.inRange && (!build || c.dist < build.dist)) build = c;
        c.proxyOn = Boolean(wantProxy && c.proxy);
        // (on for the shadow pass too: a merged chunk off screen can still throw a shadow into view)
        if (c.proxy) c.proxy.visible = c.proxyOn && ((c.inView && c.inRange) || c.shadow);
      });
      // One merge every few frames, nearest first
      if (build && --chunkBuildWait <= 0) { chunkBuildWait = 3; chunkBuildProxy(build, now); }
      // The merged trees follow their materials (seasons recolour, leaves fall)
      chunkSwayClones.forEach((m, src) => { m.color.copy(src.color); m.visible = src.visible; m.opacity = src.opacity; });
      chunkFrameMs = performance.now() - t0;
    }

// For tests and the console
function chunkStats() {
      let shown = 0, proxies = 0, parts = 0, shadow = 0, regs = 0;
      chunkMap.forEach(c => { if (c.inView && c.inRange) shown++; if (c.shadow) shadow++; if (c.proxyOn && c.proxy) { proxies++; parts += c.proxyParts || 0; } });
      chunkEntries.forEach(e => { e.obj.traverse(o => { if (o.layers instanceof KeloChunkLayers && o.layers.chunk) regs++; }); });
      return { chunks: chunkMap.size, shown, shadow, proxies, mergedParts: parts, entries: chunkEntries.length, meshes: regs, ms: +chunkFrameMs.toFixed(2) };
    }

function chunkInit() {
      if (chunkReady || typeof scene === 'undefined' || !scene || !renderer) return;
      chunkProxyRoot = new THREE.Group();
      chunkProxyRoot.name = 'chunkProxies';
      chunkProxyRoot.matrixAutoUpdate = false;
      scene.add(chunkProxyRoot);
      chunkSeen.add(chunkProxyRoot);
      // The shadow map asks the same layers test with the main camera: tell it which pass this is
      const sm = renderer.shadowMap, render = sm.render;
      sm.render = function (...args) { chunkShadowPhase = true; try { return render.apply(this, args); } finally { chunkShadowPhase = false; } };
      chunkScan();
      chunkReady = true;
    }

window.addEventListener('DOMContentLoaded', () => {
  // Once the world is built (scene.js and the buildings' own DOMContentLoaded work run first)
  setTimeout(() => {
    if (typeof keloEveryFrame !== 'function') return;
    keloEveryFrame(chunkFrame);
    const start = () => { if (typeof scene !== 'undefined' && scene && renderer) chunkInit(); else setTimeout(start, 500); };
    setTimeout(start, 2500);
  }, 0);
});
