// Kelo-bot-1 — js/perf.js
// Loaded after realmodels.js. Keeps the game smooth as his world fills up:
//   - the Performance setting (Auto / High / Low) and the numbers that come with it
//     (how far things are drawn, how far shadows reach, when the Storehouse and Museum fill in)
//   - a light watcher that runs a few times a second and tells a building when the camera comes
//     close enough to see inside (then it builds its shelves and plinths) and when it has been far
//     away for a while (then it throws those models away again and shows simple stand-ins)
//   - hiding outdoor creations, builds and landscape changes beyond the view distance, and
//     turning their shadows off beyond the shadow distance
//   - small helpers: only rewrite a list's HTML when it really changed, a bounded cache, and
//     merging many little boxes into one draw call (InstancedMesh)
// Anything else can read perfSettings() or listen for the 'kelo-perf' event on document.

const PERF_KEY = 'kelo1_perf_level';
const PERF_LEVELS = {
  // viewDist: outdoor things further than this from the camera are hidden (the fog has them by then)
  // shadowDist: beyond this they stop casting shadows
  // nearBuild: the camera has to come this close to a building before its contents are built
  // shadowMapSize, maxPixelRatio: caps for the renderer on Low (applyPerfToRenderer)
  high: { label: 'High', viewDist: 150, shadowDist: 55, nearBuild: 42, shadowMapSize: 2048, maxPixelRatio: 2 },
  low: { label: 'Low', viewDist: 75, shadowDist: 24, nearBuild: 24, shadowMapSize: 1024, maxPixelRatio: 1 }
};
// How long a building stays built after the camera leaves before its models are thrown away
const PERF_FORGET_MS = 25000;

let perfChoice = 'auto';
try { perfChoice = localStorage.getItem(PERF_KEY) || 'auto'; } catch (e) {}
if (!['auto', 'high', 'low'].includes(perfChoice)) perfChoice = 'auto';
// What Auto picks: a phone or a small computer starts on Low; it steps down if frames get slow
let perfAutoLevel = (() => {
  const phone = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || '') || (window.keloNative && window.keloNative.memory);
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 8;
  return phone || cores <= 2 || mem <= 2 ? 'low' : 'high';
})();

function perfLevel() {
      return perfChoice;
    }

// The level in use right now ('high' or 'low'; Auto resolves to one of them)
function perfActiveLevel() {
      return perfChoice === 'auto' ? perfAutoLevel : perfChoice;
    }

function perfSettings() {
      return { level: perfActiveLevel(), choice: perfChoice, ...PERF_LEVELS[perfActiveLevel()] };
    }

function setPerfLevel(choice) {
      if (!['auto', 'high', 'low'].includes(choice)) return;
      perfChoice = choice;
      try { localStorage.setItem(PERF_KEY, choice); } catch (e) {}
      perfChanged();
    }

function perfChanged() {
      applyPerfToRenderer();
      perfOutdoorKey = null; // look at every outdoor thing again with the new distances
      document.dispatchEvent(new CustomEvent('kelo-perf', { detail: perfSettings() }));
      const sel = document.getElementById('perfLevelSelect');
      if (sel && sel.value !== perfChoice) sel.value = perfChoice;
      const note = document.getElementById('perfLevelNote');
      if (note) note.textContent = perfChoice === 'auto' ? `Auto is using ${PERF_LEVELS[perfAutoLevel].label} on this device.` : '';
    }

// Shadow detail and screen sharpness follow the setting. High leaves the renderer exactly as
// scene.js set it up; Low caps the shadow map and the pixel ratio (and puts them back after).
let perfRendererOriginal = null;
function applyPerfToRenderer() {
      if (typeof renderer === 'undefined' || !renderer) return;
      const sun = typeof sunLight !== 'undefined' && sunLight && sunLight.shadow ? sunLight : null;
      if (!perfRendererOriginal) perfRendererOriginal = { ratio: renderer.getPixelRatio(), shadow: sun ? sun.shadow.mapSize.x : 2048 };
      const s = PERF_LEVELS[perfActiveLevel()];
      const low = perfActiveLevel() === 'low';
      const ratio = low ? Math.min(perfRendererOriginal.ratio, s.maxPixelRatio) : perfRendererOriginal.ratio;
      if (Math.abs(renderer.getPixelRatio() - ratio) > 0.01) {
        renderer.setPixelRatio(ratio);
        const vp = renderer.domElement.parentElement;
        if (vp && vp.clientWidth) renderer.setSize(vp.clientWidth, vp.clientHeight);
      }
      const size = low ? Math.min(perfRendererOriginal.shadow, s.shadowMapSize) : perfRendererOriginal.shadow;
      if (sun && sun.shadow.mapSize.x !== size) {
        sun.shadow.mapSize.set(size, size);
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      }
    }

// --- Watching what the camera can see -------------------------------------------------------------
const perfFrustum = new THREE.Frustum();
const perfMatrix = new THREE.Matrix4();
const perfSphere = new THREE.Sphere();
const perfWatched = []; // { key, center(), radius, forced(), show(near), near, lastNear }

// A building that fills in only while it can be seen. show(true) builds what's inside,
// show(false) throws it away (it is only called after the camera has been away PERF_FORGET_MS).
function perfWatchBuilding(entry) {
      perfWatched.push({ near: false, lastWanted: 0, ...entry });
    }

function perfCameraSees(x, y, z, r) {
      perfSphere.center.set(x, y, z);
      perfSphere.radius = r;
      return perfFrustum.intersectsSphere(perfSphere);
    }

function perfUpdateFrustum() {
      camera.updateMatrixWorld();
      perfMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      perfFrustum.setFromProjectionMatrix(perfMatrix);
    }

// Should this building be filled in now? Close and in view, or very close, or he is inside it
function perfWants(w) {
      if (w.forced && w.forced()) return true;
      const c = w.center();
      if (!c) return false;
      const d = camera.position.distanceTo(c);
      const near = PERF_LEVELS[perfActiveLevel()].nearBuild * (w.near ? 1.25 : 1); // a little slack once built
      if (d < w.radius + 6) return true;
      return d < near + w.radius && perfCameraSees(c.x, c.y, c.z, w.radius);
    }

function perfCheckBuildings(now) {
      perfWatched.forEach(w => {
        if (perfWants(w)) {
          w.lastWanted = now;
          if (!w.near) { w.near = true; w.show(true); }
        } else if (w.near && now - w.lastWanted > PERF_FORGET_MS) {
          w.near = false;
          w.show(false);
        }
      });
    }

// Every frame: a building that is filling in builds its next few models
function perfBuildingsWork() {
      perfWatched.forEach(w => { if (w.tick) w.tick(w.near); });
    }

// --- Outdoor things: hidden beyond the view distance, no shadow beyond the shadow distance --------
let perfOutdoorKey = null;
const perfOutdoorState = new WeakMap(); // object -> { visible, shadow }

function perfOutdoorObjects() {
      const list = [];
      if (typeof emergentCreationsGroup !== 'undefined' && emergentCreationsGroup) list.push(...emergentCreationsGroup.children);
      if (typeof projectMeshes !== 'undefined' && projectMeshes) list.push(...Object.values(projectMeshes));
      if (typeof editMeshes !== 'undefined' && editMeshes) list.push(...Object.values(editMeshes));
      return list;
    }

// Remember which meshes were meant to cast shadows, so turning shadows back on restores just those
function perfShadowCasters(obj) {
      if (!obj.userData.perfCasters) {
        const casters = [];
        obj.traverse(o => { if (o.isMesh && o.castShadow) casters.push(o); });
        obj.userData.perfCasters = casters;
        // Nothing in these moves on its own except spinning parts, so their matrices are worked out once
        obj.traverse(o => {
          if (o === obj || !o.isMesh || (o.userData && o.userData.spin)) return;
          o.updateMatrix();
          o.matrixAutoUpdate = false;
        });
      }
      return obj.userData.perfCasters;
    }

function perfCheckOutdoors() {
      const s = PERF_LEVELS[perfActiveLevel()];
      const cam = camera.position;
      const objs = perfOutdoorObjects();
      perfOutdoorKey = objs.length;
      objs.forEach(obj => {
        if (!obj || !obj.parent) return;
        const dx = obj.position.x - cam.x, dz = obj.position.z - cam.z;
        const d = Math.hypot(dx, dz);
        const prev = perfOutdoorState.get(obj) || { visible: true, shadow: true };
        // A little slack on the way back so things don't flicker at the edge
        const visible = d < s.viewDist * (prev.visible ? 1.08 : 1);
        const shadow = visible && d < s.shadowDist * (prev.shadow ? 1.1 : 1);
        if (visible !== prev.visible) obj.visible = visible;
        if (shadow !== prev.shadow) perfShadowCasters(obj).forEach(m => { m.castShadow = shadow; });
        else perfShadowCasters(obj);
        perfOutdoorState.set(obj, { visible, shadow });
      });
    }

// --- Auto: step down to Low when frames are slow for a while ---------------------------------------
let perfFrameAvg = 16, perfSlowSince = 0, perfLastFrame = 0;

function perfWatchFrames(now) {
      const dt = perfLastFrame ? now - perfLastFrame : 16;
      perfLastFrame = now;
      if (dt > 500 || document.visibilityState !== 'visible') return; // a hidden tab or a pause, not slowness
      perfFrameAvg += (dt - perfFrameAvg) * 0.05;
      if (perfChoice !== 'auto' || perfAutoLevel === 'low') return;
      if (perfFrameAvg > 45) {
        if (!perfSlowSince) perfSlowSince = now;
        else if (now - perfSlowSince > 8000) {
          perfAutoLevel = 'low';
          perfChanged();
        }
      } else perfSlowSince = 0;
    }

// --- The loop: a few checks a second, on its own animation frame ----------------------------------
let perfTickCount = 0;

function perfLoop(now) {
      requestAnimationFrame(perfLoop);
      if (typeof camera === 'undefined' || !camera || typeof scene === 'undefined' || !scene) return;
      perfWatchFrames(now);
      perfBuildingsWork();
      perfTickCount++;
      if (perfTickCount % 6 === 0) {
        perfUpdateFrustum();
        perfCheckBuildings(Date.now());
      }
      if (perfTickCount % 20 === 3) perfCheckOutdoors();
    }

// --- Helpers ------------------------------------------------------------------------------------
// Set a list's HTML only if it is different from last time (rewriting it makes the browser lay the
// whole page out again). Returns true when it changed, so click handlers are only re-attached then.
function perfSetHtml(el, html) {
      if (!el) return false;
      if (el.__keloHtml === html) return false;
      el.__keloHtml = html;
      el.innerHTML = html;
      return true;
    }

// How many rows a long list shows until "Show more" is pressed (per list, for this visit)
const perfListShown = {};
function perfListLimit(id, step) {
      return perfListShown[id] || step;
    }

// The "Show more" button under a long list: data-perf-more="<list id>" adds another step
function perfMoreButton(id, shown, total, step) {
      if (total <= shown) return '';
      return `<button type="button" data-perf-more="${id}" data-perf-step="${step}" class="w-full mt-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold">Show more (${total - shown} more)</button>`;
    }

document.addEventListener('click', e => {
  const btn = e.target.closest && e.target.closest('[data-perf-more]');
  if (!btn) return;
  const id = btn.getAttribute('data-perf-more');
  perfListShown[id] = perfListLimit(id, +btn.getAttribute('data-perf-step')) + (+btn.getAttribute('data-perf-step'));
  if (typeof renderAllUI === 'function') renderAllUI();
});

// A Map that keeps only the most recently used `max` entries; onEvict(value) runs for the ones dropped
function perfLRU(max, onEvict) {
      const map = new Map();
      return {
        has: k => map.has(k),
        get(k) {
          if (!map.has(k)) return undefined;
          const v = map.get(k);
          map.delete(k);
          map.set(k, v);
          return v;
        },
        set(k, v) {
          if (map.has(k)) map.delete(k);
          map.set(k, v);
          while (map.size > max) {
            const [oldK, oldV] = map.entries().next().value;
            map.delete(oldK);
            if (onEvict) onEvict(oldV, oldK);
          }
        },
        delete: k => map.delete(k),
        get size() { return map.size; }
      };
    }

// Simple stand-ins for things too far away to see properly: one small box per spot, all drawn in one go.
// spots: [{ x, y, z, w, h, d, color, rotY }] in the parent's space.
function perfStandIns(spots, opts = {}) {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      geo.translate(0, 0.5, 0); // sits on its spot
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
      const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, spots.length));
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
      const c = new THREE.Color();
      let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      spots.forEach((s, i) => {
        q.setFromAxisAngle(up, s.rotY || 0);
        m.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(s.w, s.h, s.d));
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, c.set(s.color || 0x94a3b8));
        minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x);
        minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y + s.h);
        minZ = Math.min(minZ, s.z); maxZ = Math.max(maxZ, s.z);
      });
      mesh.count = spots.length;
      // The box geometry alone would give a sphere around one box; this one covers them all
      if (spots.length) {
        geo.boundingSphere = new THREE.Sphere(new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2), Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2 + 1);
      }
      mesh.castShadow = Boolean(opts.castShadow);
      mesh.receiveShadow = true;
      mesh.userData.perfStandIn = true;
      return mesh;
    }

// Many copies of one small mesh drawn in one go. `places` are Object3Ds (only their position,
// rotation and scale are read); colors, if given, tint each copy. The geometry is copied so the
// bounding sphere can cover every copy (three.js culls an InstancedMesh by its geometry's sphere).
function perfInstances(geo, mat, places, opts = {}) {
      const g = geo.clone();
      const mesh = new THREE.InstancedMesh(g, mat, Math.max(1, places.length));
      const box = new THREE.Box3();
      g.computeBoundingSphere();
      const r = g.boundingSphere.radius;
      places.forEach((p, i) => {
        p.updateMatrix();
        mesh.setMatrixAt(i, p.matrix);
        const s = Math.max(p.scale.x, p.scale.y, p.scale.z);
        box.expandByPoint(new THREE.Vector3(p.position.x - r * s, p.position.y - r * s, p.position.z - r * s));
        box.expandByPoint(new THREE.Vector3(p.position.x + r * s, p.position.y + r * s, p.position.z + r * s));
        if (opts.colors) mesh.setColorAt(i, new THREE.Color(opts.colors[i]));
      });
      mesh.count = places.length;
      if (places.length) g.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
      mesh.castShadow = Boolean(opts.castShadow);
      mesh.receiveShadow = Boolean(opts.receiveShadow);
      return mesh;
    }

// A colour for a name, so a stand-in looks a bit like "something" rather than plain grey
function perfColorFor(name) {
      let h = 0;
      for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      return new THREE.Color().setHSL((h % 360) / 360, 0.35, 0.55).getHex();
    }

function disposePerfStandIns(mesh) {
      if (!mesh) return;
      if (mesh.parent) mesh.parent.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      if (mesh.dispose) mesh.dispose();
    }

// --- Lines that follow things -------------------------------------------------------------------
// Moving a 2-point line (a kite string, a fishing line) by setFromPoints made a new GPU buffer every
// frame and never freed the old one. This moves the two ends of the one it has.
function setLineEnds(line, a, b) {
      const geo = line.geometry, p = geo.attributes.position;
      if (!p || p.count !== 2) { geo.setFromPoints([new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z)]); geo.computeBoundingSphere(); return; }
      p.setXYZ(0, a.x, a.y, a.z);
      p.setXYZ(1, b.x, b.y, b.z);
      p.needsUpdate = true;
      geo.computeBoundingSphere();
    }

// --- Static parts drawn together ---------------------------------------------------------------
// A building made of hundreds of boxes costs hundreds of draw calls (twice: once more for shadows).
// Parts that never move are joined into one mesh per material, so a building costs about one draw
// per material. Left alone: anything with userData, anything the root's userData points at (doors,
// cranes...), anything in `skip` (and what is inside them), mirrored parts, and arrays of materials.
function mergeStaticMeshes(root, skip = []) {
      if (!root) return 0;
      // First let the Graphics level decide who casts shadows, so the joined meshes keep that choice
      if (typeof updateShadowCasters === 'function') updateShadowCasters();
      root.updateMatrixWorld(true);
      const keep = new Set();
      const keepTree = o => o && o.isObject3D && o.traverse(c => keep.add(c));
      skip.forEach(keepTree);
      Object.values(root.userData || {}).forEach(v => [].concat(v).forEach(x => { if (x && x.isObject3D) keepTree(x); else if (x && typeof x === 'object') Object.values(x).forEach(keepTree); }));
      const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
      const m = new THREE.Matrix4();
      const sets = new Map(), casts = new Map();
      root.traverse(o => {
        if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || keep.has(o) || Array.isArray(o.material) || !o.visible) return;
        if (Object.keys(o.userData).length || o.morphTargetInfluences || o.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return;
        for (let a = o.parent; a && a !== root; a = a.parent) if (!a.visible || Object.keys(a.userData).length) return;
        const g = o.geometry;
        if (!g || !g.isBufferGeometry || !g.attributes.position || Object.keys(g.morphAttributes).length) return;
        if (o.matrixWorld.determinant() < 0) return; // mirrored: its faces would turn inside out
        const names = Object.keys(g.attributes).sort();
        // A small part that is out of shadow range right now still means to cast (js/realism.js)
        const cast = o.castShadow || (typeof smallCasters !== 'undefined' && smallCasters.has(o));
        const key = `${o.material.uuid}|${cast}|${o.receiveShadow}|${o.renderOrder}|${names.map(n => n + g.attributes[n].itemSize).join(',')}`;
        if (!sets.has(key)) sets.set(key, []);
        sets.get(key).push(o);
        casts.set(o, cast);
      });
      let joined = 0;
      sets.forEach(list => {
        if (list.length < 2) return;
        const parts = list.map(o => {
          const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
          return geo.applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
        });
        const names = Object.keys(parts[0].attributes);
        const out = new THREE.BufferGeometry();
        names.forEach(n => {
          const size = parts[0].attributes[n].itemSize;
          const arr = new Float32Array(parts.reduce((s, p) => s + p.attributes[n].count * size, 0));
          let off = 0;
          parts.forEach(p => { const a = p.attributes[n]; for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) arr[off++] = a.getComponent ? a.getComponent(i, k) : a.array[i * size + k]; });
          out.setAttribute(n, new THREE.BufferAttribute(arr, size, parts[0].attributes[n].normalized));
        });
        parts.forEach(p => p.dispose());
        const first = list[0];
        const mesh = new THREE.Mesh(out, first.material);
        mesh.castShadow = casts.get(first);
        mesh.receiveShadow = first.receiveShadow;
        mesh.renderOrder = first.renderOrder;
        mesh.matrixAutoUpdate = false;
        // Its shadow choice is made: js/realism.js mustn't turn a joined non-caster into a big caster
        mesh.userData.noShadow = !mesh.castShadow;
        mesh.userData.joinedParts = list.length;
        root.add(mesh);
        mesh.updateMatrix();
        const gone = new Set(list.map(o => o.geometry));
        list.forEach(o => o.parent.remove(o));
        // Free the old parts' buffers unless something still draws them
        if (typeof scene !== 'undefined' && scene) scene.traverse(o => { if (o.geometry) gone.delete(o.geometry); });
        gone.forEach(g => g.dispose());
        joined += list.length - 1;
      });
      return joined;
    }

// Join a building's static parts once the world has settled (shadows decided, materials dressed)
function mergeStaticMeshesSoon(root, skip = [], delay = 1500) {
      setTimeout(() => {
        try {
          const n = mergeStaticMeshes(root, typeof skip === 'function' ? skip() : skip);
          if (n && window.KELO_DEBUG) console.log(`Joined ${n} static parts`);
        } catch (e) { console.warn('mergeStaticMeshes failed:', e); }
      }, delay);
    }

// --- Settings ---------------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  const sel = document.getElementById('perfLevelSelect');
  if (sel) {
    sel.value = perfChoice;
    sel.addEventListener('change', () => setPerfLevel(sel.value));
  }
  // After scene.js has made the renderer (its own DOMContentLoaded handler runs first)
  setTimeout(() => { perfChanged(); requestAnimationFrame(perfLoop); }, 0);
});
