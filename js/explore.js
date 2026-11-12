// Kelo-bot-1 — js/explore.js
// Loaded after portal.js. An easier way to look around Kelo-1's world.
// There are two camera modes, switched with the bar at the top left:
//   - "Follow Kelo-1": the camera stays with him wherever he goes. You can still turn and zoom.
//   - "Explore freely": the camera is yours. Drag the ground to slide the map, right-drag (or twist
//     two fingers) to turn, scroll (or pinch) to zoom toward the cursor, WASD or the arrow keys to
//     move, Q and E to turn. It eases smoothly, never dips under the ground or leaves the world,
//     and rises over the mountains.
// Also here: double-click to fly to a spot, a click menu ("Fly here / Send Kelo-1 here / What's
// this?"), a live minimap, a Places list, "Where is Kelo-1?", a joystick on touch screens, and a
// short "How to explore" help card.
// This file drives the camera itself; OrbitControls (js/scene.js) stays only to aim it, with its own
// mouse and touch handling switched off.

const EXPLORE_BOUNDS = { minX: WORLD_MIN_X, maxX: WORLD_MAX_X, minZ: WORLD_MIN_Z, maxZ: 20 };
const EXPLORE_LIMITS = { minDist: 5, maxDist: 140, minPitch: 0.12, maxPitch: 1.45 };
const EXPLORE_CLEARANCE = 1.4;   // the camera always stays at least this far above the ground
const EXPLORE_IDLE_MS = 90000;   // "go back to Kelo-1" after this long without touching anything
const EXPLORE_PREFS_KEY = 'kelo1_explore_prefs';

const exploreCam = {
  ready: false,
  driving: false,                 // true while this file moved the camera last frame
  cur: null,                      // what is on screen: { target, yaw, pitch, dist }
  goal: null,                     // where the camera is easing toward
  fly: null,                      // a smooth flight in progress
  keys: {},                       // keyboard keys held down
  held: {},                       // on-screen buttons held down
  stick: { x: 0, y: 0 },          // the touch joystick, -1..1 each way
  lastMs: 0,
  lastInput: Date.now(),
  pointers: new Map(),            // fingers or mouse buttons down on the 3D view
  drag: null,
  suppressClickUntil: 0,
  outerGround: { at: 0, x: 0, z: 0, y: -99 },
  prefs: { autoReturn: true, mapOpen: null, helpSeen: false }
};

// --- Small helpers -------------------------------------------------------------------------------
function exploreClamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function exploreLoadPrefs() {
      try {
        const saved = JSON.parse(localStorage.getItem(EXPLORE_PREFS_KEY) || '{}');
        Object.assign(exploreCam.prefs, saved);
      } catch (e) {}
    }

function exploreSavePrefs() {
      try { localStorage.setItem(EXPLORE_PREFS_KEY, JSON.stringify(exploreCam.prefs)); } catch (e) {}
    }

// The ground (or the lake surface) at a spot. Inside the island this is the exact terrain; beyond
// it, the backdrop lands are measured with a ray now and then
function exploreGroundAt(x, z) {
      const water = typeof WATER_LEVEL === 'number' ? WATER_LEVEL : -0.18;
      if (islandContains(x, z)) return Math.max(water, getAnalyticalGroundHeight(x, z));
      const o = exploreCam.outerGround;
      if (Date.now() - o.at > 150 || Math.hypot(o.x - x, o.z - z) > 4) {
        o.at = Date.now(); o.x = x; o.z = z; o.y = water;
        if (terrainSwapGroup) {
          const ray = new THREE.Raycaster(new THREE.Vector3(x, 120, z), new THREE.Vector3(0, -1, 0));
          const hit = ray.intersectObjects(terrainSwapGroup.children, true)[0];
          if (hit) o.y = Math.max(water, hit.point.y);
        }
      }
      return o.y;
    }

const EXPLORE_GROUND_SAMPLES = [0.2, 0.4, 0.6, 0.8, 1];
// The ground as drawn: the terrain mesh (holes, piles, fills) where it exists, never below the water
function exploreSolidGroundAt(x, z) {
      const g = exploreGroundAt(x, z);
      const m = typeof terrainMeshHeightAt === 'function' && islandContains(x, z) ? terrainMeshHeightAt(x, z) : null;
      return m === null ? g : Math.max(g, m);
    }

function exploreCopy(s) {
      return { target: s.target.clone(), yaw: s.yaw, pitch: s.pitch, dist: s.dist };
    }

function exploreOffset(s) {
      const cp = Math.cos(s.pitch);
      return new THREE.Vector3(Math.sin(s.yaw) * cp, Math.sin(s.pitch), Math.cos(s.yaw) * cp).multiplyScalar(s.dist);
    }

// Read where the camera is now (after another mode or a test moved it)
function exploreSyncFromCamera() {
      const target = controls.target.clone();
      const off = camera.position.clone().sub(target);
      const dist = Math.max(0.01, off.length());
      const s = { target, yaw: Math.atan2(off.x, off.z), pitch: Math.asin(exploreClamp(off.y / dist, -1, 1)), dist };
      exploreClampState(s);
      exploreCam.cur = exploreCopy(s);
      exploreCam.goal = exploreCopy(s);
      exploreCam.adj = { lift: 0, bld: 0 };
      exploreCam.fv = null;
    }

function exploreClampState(s) {
      s.target.x = exploreClamp(s.target.x, EXPLORE_BOUNDS.minX, EXPLORE_BOUNDS.maxX);
      s.target.z = exploreClamp(s.target.z, EXPLORE_BOUNDS.minZ, EXPLORE_BOUNDS.maxZ);
      s.dist = exploreClamp(s.dist, EXPLORE_LIMITS.minDist, EXPLORE_LIMITS.maxDist);
      s.pitch = exploreClamp(s.pitch, EXPLORE_LIMITS.minPitch, EXPLORE_LIMITS.maxPitch);
    }

// A stand-in camera placed where the goal is, for working out which ground is under a finger
const exploreScratchCam = new THREE.PerspectiveCamera();
function exploreGoalCamera() {
      const g = exploreCam.goal;
      exploreScratchCam.fov = camera.fov;
      exploreScratchCam.aspect = camera.aspect;
      exploreScratchCam.near = camera.near;
      exploreScratchCam.far = camera.far;
      exploreScratchCam.updateProjectionMatrix();
      exploreScratchCam.position.copy(g.target).add(exploreOffset(g));
      exploreScratchCam.lookAt(g.target);
      exploreScratchCam.updateMatrixWorld();
      return exploreScratchCam;
    }

function exploreNdc(clientX, clientY) {
      const r = renderer.domElement.getBoundingClientRect();
      return new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    }

// Where a screen point lands on the flat level the camera looks at (for sliding the map)
function explorePlanePoint(clientX, clientY, cam = exploreGoalCamera(), y = exploreCam.goal.target.y) {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(exploreNdc(clientX, clientY), cam);
      const d = ray.ray.direction;
      if (d.y > -0.02) return null; // looking at the sky
      const t = (y - ray.ray.origin.y) / d.y;
      if (t <= 0 || t > 600) return null;
      return ray.ray.origin.clone().addScaledVector(d, t);
    }

// Where a screen point lands on the real terrain (for zooming toward the cursor and double-clicks)
function exploreTerrainPoint(clientX, clientY) {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(exploreNdc(clientX, clientY), camera);
      if (terrainSwapGroup) {
        const hit = ray.intersectObjects(terrainSwapGroup.children, true)[0];
        if (hit) return hit.point.clone();
      }
      return explorePlanePoint(clientX, clientY, camera, controls.target.y);
    }

function exploreKeloSpot() {
      const p = keloGroup ? keloGroup.position : new THREE.Vector3(state.botPos.x, 0, state.botPos.z);
      // Follow the ground under him (not the bob of each step, or the drop when he sits or lies down),
      // unless he is clearly somewhere else: up on a bed, a ladder, a vehicle or down a basement
      const ground = Number.isFinite(state.botAltitudeY) ? state.botAltitudeY : p.y;
      const y = !state.riding && Math.abs(p.y - ground) < 1.2 ? ground : p.y;
      return new THREE.Vector3(p.x, y + 1.6, p.z);
    }

// --- Taking over the camera ----------------------------------------------------------------------
// Any touch, drag, key or button: cancel a flight, and leave Follow if the view is being moved
function exploreTakeOver(kind) {
      exploreCam.lastInput = Date.now();
      exploreHideSpotMenu();
      if (state.cameraMode === 'eyes') return;   // looking around through his eyes stays there
      const mode = state.cameraMode;
      if (exploreCam.fly) {
        exploreCam.fly = null;
        exploreCam.goal = exploreCopy(exploreCam.cur);
        if (mode !== 'follow' || kind === 'move' || kind === 'pan') exploreSetMode('explore');
        return;
      }
      if (mode !== 'follow' && mode !== 'explore') {
        exploreSyncFromCamera();
        exploreSetMode('explore');
        return;
      }
      if (!exploreCam.driving) exploreSyncFromCamera();
      if (mode === 'follow' && (kind === 'move' || kind === 'pan')) exploreSetMode('explore');
    }

function exploreSetMode(mode) {
      const was = state.cameraMode;
      state.cameraMode = mode;
      if (was !== mode) exploreUpdateUI();
    }

// --- Flying smoothly somewhere -------------------------------------------------------------------
// dest: { x, z, dist, pitch, yaw, follow }. Follow flights end following Kelo-1.
function exploreFlyTo(dest) {
      if (!exploreCam.ready) return;
      if (!exploreCam.driving || !exploreCam.cur) exploreSyncFromCamera();
      exploreCam.lastInput = Date.now();
      exploreHideSpotMenu();
      const from = exploreCopy(exploreCam.cur);
      const target = dest.follow ? exploreKeloSpot() : new THREE.Vector3(dest.x, 0, dest.z);
      if (!dest.follow) target.y = exploreGroundAt(target.x, target.z) + 0.4;
      const to = {
        target,
        yaw: Number.isFinite(dest.yaw) ? dest.yaw : from.yaw,
        pitch: Number.isFinite(dest.pitch) ? dest.pitch : Math.max(0.45, from.pitch),
        dist: Number.isFinite(dest.dist) ? dest.dist : from.dist
      };
      exploreClampState(to);
      // Turn the short way round
      let dy = to.yaw - from.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      to.yaw = from.yaw + dy;
      const travel = from.target.distanceTo(to.target);
      exploreCam.fly = {
        from, to, follow: Boolean(dest.follow),
        t0: performance.now(),
        ms: exploreClamp(650 + travel * 14, 800, 2200),
        lift: Math.min(45, travel * 0.35)
      };
      // Nothing else may move the camera during the flight
      state.cameraMode = dest.follow ? 'follow' : 'explore';
      exploreUpdateUI();
    }

function exploreFlyToKelo() {
      const d = exploreCam.cur ? exploreClamp(exploreCam.cur.dist, 10, 30) : 22;
      exploreFlyTo({ follow: true, dist: d, pitch: exploreCam.cur ? exploreClamp(exploreCam.cur.pitch, 0.35, 1.0) : 0.6 });
    }

function exploreEase(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }

// --- The per-frame update (called from the animate loop in js/scene.js) --------------------------
// Returns true when it placed the camera this frame
const exploreScratchGoal = new THREE.Vector3(), exploreScratchAcc = new THREE.Vector3();
function exploreCameraUpdate() {
      if (!exploreCam.ready || !camera || !controls) return false;
      const now = performance.now();
      const dt = exploreCam.lastMs ? Math.min(0.2, (now - exploreCam.lastMs) / 1000) : 1 / 60;
      exploreCam.lastMs = now;
      const mode = state.cameraMode;
      // Through his eyes (js/eyecam.js) places the camera itself
      if (typeof eyeCamFrame === 'function' && eyeCamFrame(dt)) { exploreCam.driving = false; return true; }

      if (!exploreCam.fly) {
        if (mode === 'follow') {
          // Walking into the Storehouse or the Museum: js/basements.js looks in through the cutaway
          const indoors = (typeof indoorTrip !== 'undefined' && indoorTrip.active) || (typeof tripCam !== 'undefined' && Date.now() < tripCam.releaseUntil);
          if (indoors) { exploreCam.driving = false; return false; }
        } else if (mode !== 'explore') {
          exploreCam.driving = false;
          return false;
        }
        if (!exploreCam.driving || !exploreCam.cur) exploreSyncFromCamera();
      }
      const cur = exploreCam.cur, goal = exploreCam.goal;

      if (exploreCam.fly) {
        const f = exploreCam.fly;
        if (f.follow) f.to.target.copy(exploreKeloSpot());
        const u = exploreClamp((now - f.t0) / f.ms, 0, 1), e = exploreEase(u);
        cur.target.lerpVectors(f.from.target, f.to.target, e);
        cur.yaw = f.from.yaw + (f.to.yaw - f.from.yaw) * e;
        cur.pitch = f.from.pitch + (f.to.pitch - f.from.pitch) * e;
        cur.dist = f.from.dist + (f.to.dist - f.from.dist) * e + Math.sin(Math.PI * u) * f.lift;
        exploreCam.goal = exploreCopy(cur);
        if (u >= 1) {
          exploreCam.fly = null;
          exploreCam.goal = exploreCopy(f.to);
          exploreCam.cur = exploreCopy(f.to);
          exploreSetMode(f.follow ? 'follow' : 'explore');
        }
      } else {
        exploreApplyHeldInput(dt);
        if (state.cameraMode === 'follow') goal.target.copy(exploreKeloSpot());
        else goal.target.y = exploreGroundAt(goal.target.x, goal.target.z) + 0.4;
        exploreClampState(goal);
        // Ease what is shown toward the goal: quick while dragging, gentler otherwise
        const dragging = Boolean(exploreCam.drag && exploreCam.drag.moved);
        const k = 1 - Math.exp(-(dragging ? 20 : 9) * dt);
        const kt = state.cameraMode === 'follow' ? 1 - Math.exp(-5 * dt) : k;
        if (state.cameraMode === 'follow') {
          // Following him: a spring with no overshoot, so starts, stops and turns ease in and out
          // instead of lurching. A big jump (he was moved, or a trip ended far away) is a short flight.
          if (cur.target.distanceTo(goal.target) > 30 && !exploreCam.drag) { exploreFlyToKelo(); exploreCam.fv = null; }
          else {
            const fv = exploreCam.fv || (exploreCam.fv = new THREE.Vector3());
            const w = 5.5;
            // The goal moved from where it was last frame to where it is now: the substeps follow it
            // along that line, so the camera lands in the same place at any frame rate
            const g0 = exploreCam.goalWas || (exploreCam.goalWas = goal.target.clone());
            if (g0.distanceTo(goal.target) > 5) g0.copy(goal.target);
            const gi = exploreScratchGoal, acc = exploreScratchAcc;
            for (let left = dt; left > 1e-4;) {
              const h = Math.min(left, 1 / 120);
              left -= h;
              gi.lerpVectors(goal.target, g0, dt > 0 ? left / dt : 0);
              fv.addScaledVector(acc.copy(gi).sub(cur.target).multiplyScalar(w * w).addScaledVector(fv, -2 * w), h);
              cur.target.addScaledVector(fv, h);
            }
            g0.copy(goal.target);
          }
        } else {
          exploreCam.fv = null;
          cur.target.lerp(goal.target, kt);
        }
        cur.yaw += (goal.yaw - cur.yaw) * k;
        cur.pitch += (goal.pitch - cur.pitch) * k;
        cur.dist += (goal.dist - cur.dist) * k;
      }

      // What is shown = what was asked for (cur), lifted so the camera and its whole line of sight stay
      // above the ground (holes, piles, hills) and above buildings. Buildings are treated like raised
      // ground with soft edges, so the camera rises over a roof smoothly instead of jumping in front of
      // a wall or ending up inside one. The lift is kept apart from cur, so it never fights the easing.
      const c = exploreCam.cur;
      const v = exploreCopy(c);
      const blds = exploreNearBuildings(v.target, v.dist);
      const needFor = (withBuildings) => {
        const off = exploreOffset(v);
        let need = -1;
        // The lens itself must clear the ground at once; the rest of the line (and roofs) eases in
        for (const t of (withBuildings ? EXPLORE_GROUND_SAMPLES : [1])) {
          const x = v.target.x + off.x * t, z = v.target.z + off.z * t;
          let g = exploreSolidGroundAt(x, z) + (t >= 1 ? EXPLORE_CLEARANCE : 0.8);
          if (withBuildings) g = Math.max(g, exploreBuildingHeightAt(blds, x, z) + (t >= 1 ? 1.2 : 0.3));
          need = Math.max(need, (g - v.target.y) / (v.dist * t));
        }
        return need;
      };
      const liftFor = (withBuildings) => {
        const p0 = v.pitch;
        for (let i = 0; i < 3; i++) {
          const need = needFor(withBuildings);
          if (Math.sin(v.pitch) >= need) break;
          v.pitch = Math.min(1.5, Math.asin(exploreClamp(need, -1, 0.997)));
        }
        const l = v.pitch - p0;
        v.pitch = p0;
        return Math.max(0, l);
      };
      const liftGround = liftFor(false);
      v.pitch = c.pitch + liftGround;
      const liftBld = liftFor(true);
      const adj = exploreCam.adj || (exploreCam.adj = { lift: 0, bld: 0 });
      // Up over the ground at once (never under it), back down gently
      adj.lift = liftGround >= adj.lift ? liftGround : adj.lift + (liftGround - adj.lift) * (1 - Math.exp(-4 * dt));
      // Over a roof quickly but smoothly, back down gently
      adj.bld += (liftBld - adj.bld) * (1 - Math.exp(-(liftBld > adj.bld ? 10 : 3) * dt));
      const shown = { target: c.target, yaw: c.yaw, pitch: Math.min(1.5, c.pitch + adj.lift + adj.bld), dist: c.dist };

      controls.target.copy(shown.target);
      camera.position.copy(shown.target).add(exploreOffset(shown));
      exploreCam.driving = true;

      // Optional: drift back to Kelo-1 after a while with nobody touching anything
      if (exploreCam.prefs.autoReturn && state.cameraMode === 'explore' && !exploreCam.fly
        && Date.now() - exploreCam.lastInput > EXPLORE_IDLE_MS && !document.getElementById('keloViewer')
        && !document.body.classList.contains('menu-open')) {
        exploreFlyToKelo();
      }
      return true;
    }

// Camera against buildings. Each building footprint (a box in worldObstacles) gets its roof height
// measured once, with one ray straight down (a few boxes per frame at most).
const exploreRoofs = new WeakMap();
const exploreRoofRay = new THREE.Raycaster();
let exploreRoofBudget = 0;
function exploreRoofOf(b) {
      let h = exploreRoofs.get(b);
      if (h !== undefined) return h;
      if (exploreRoofBudget <= 0) return null;
      exploreRoofBudget--;
      const ground = getAnalyticalGroundHeight(b.x, b.z);
      h = ground + 3; // walls at least this high
      exploreRoofRay.set(exploreRoofRay.ray.origin.set(b.x, ground + 40, b.z), exploreRoofRay.ray.direction.set(0, -1, 0));
      exploreRoofRay.camera = camera;
      exploreRoofRay.far = 41;
      try {
        const hits = exploreRoofRay.intersectObjects(scene.children, true);
        for (const hit of hits) {
          const m = hit.object.material;
          if (!hit.object.isMesh || hit.object === terrainGroundMesh || (m && m.transparent && m.opacity < 0.5)) continue;
          if (hit.point.y > ground + 0.5) { h = Math.max(h, Math.min(ground + 16, hit.point.y)); break; }
        }
      } catch (e) {}
      exploreRoofs.set(b, h);
      return h;
    }

// Building boxes near the camera, with their roof heights (measured a few per frame ahead of time,
// so a roof is known before the camera gets there). A box that holds what the camera looks at (an
// indoor trip) is left out.
const EXPLORE_BLD_SOFT = 5;      // the lift ramps up over this many units outside a wall
function exploreNearBuildings(target, dist) {
      exploreRoofBudget = 4;
      const out = [];
      if (typeof worldObstacles === 'undefined') return out;
      for (let i = 0; i < worldObstacles.length; i++) {
        const b = worldObstacles[i];
        if (b.hw === undefined || Math.min(b.hw, b.hd) < 0.9) continue;
        const d = Math.hypot(b.x - target.x, b.z - target.z);
        if (d > 140) continue;
        const roof = exploreRoofOf(b);
        if (d > dist + b.r + EXPLORE_BLD_SOFT + 1 || roof === null) continue;
        const cs = Math.cos(b.rot || 0), sn = Math.sin(b.rot || 0);
        const lx = target.x - b.x, lz = target.z - b.z;
        if (Math.abs(lx * cs - lz * sn) < b.hw + 0.35 && Math.abs(lx * sn + lz * cs) < b.hd + 0.35) continue;
        out.push({ b, cs, sn, roof });
      }
      return out;
    }

// How high the buildings stand at a point: the roof inside a footprint, easing to nothing a few
// units outside it (so the camera's lift has no sudden steps)
function exploreBuildingHeightAt(blds, x, z) {
      let h = -99;
      for (let i = 0; i < blds.length; i++) {
        const { b, cs, sn, roof } = blds[i];
        const lx = x - b.x, lz = z - b.z;
        const ox = Math.abs(lx * cs - lz * sn) - b.hw, oz = Math.abs(lx * sn + lz * cs) - b.hd;
        const out = Math.hypot(Math.max(0, ox), Math.max(0, oz));
        if (out >= EXPLORE_BLD_SOFT) continue;
        const u = out / EXPLORE_BLD_SOFT, f = 1 - u * u * (3 - 2 * u);
        const ground = getAnalyticalGroundHeight(b.x, b.z);
        h = Math.max(h, ground + (roof - ground) * f);
      }
      return h;
    }

// Keys, the joystick and held buttons
function exploreApplyHeldInput(dt) {
      const k = exploreCam.keys, h = exploreCam.held, s = exploreCam.stick, g = exploreCam.goal;
      let fwd = (k.KeyW || k.ArrowUp || h.up ? 1 : 0) - (k.KeyS || k.ArrowDown || h.down ? 1 : 0) - s.y;
      let side = (k.KeyD || k.ArrowRight || h.right ? 1 : 0) - (k.KeyA || k.ArrowLeft || h.left ? 1 : 0) + s.x;
      const turn = (k.KeyQ || h.turnLeft ? 1 : 0) - (k.KeyE || h.turnRight ? 1 : 0);
      const zoom = (k.Equal || k.NumpadAdd || h.zoomIn ? 1 : 0) - (k.Minus || k.NumpadSubtract || h.zoomOut ? 1 : 0);
      const tilt = (k.KeyR || h.tiltUp ? 1 : 0) - (k.KeyF || h.tiltDown ? 1 : 0);
      if (!fwd && !side && !turn && !zoom && !tilt) return;
      if (fwd || side) exploreTakeOver('move'); else exploreTakeOver('turn');
      const len = Math.hypot(fwd, side);
      if (len > 1) { fwd /= len; side /= len; }
      // Faster when zoomed out, slower close up
      const speed = (6 + g.dist * 0.6) * dt;
      const sy = Math.sin(g.yaw), cy = Math.cos(g.yaw);
      g.target.x += (-sy * fwd + cy * side) * speed;
      g.target.z += (-cy * fwd - sy * side) * speed;
      g.yaw += turn * 1.7 * dt;
      g.dist *= Math.exp(-zoom * 1.4 * dt);
      g.pitch += tilt * 0.9 * dt;
    }

// Zoom about a point on the ground, so whatever is under the cursor stays under it
function exploreZoomAbout(p, factor) {
      const g = exploreCam.goal;
      const nd = exploreClamp(g.dist * factor, EXPLORE_LIMITS.minDist, EXPLORE_LIMITS.maxDist);
      const f = nd / g.dist;
      g.dist = nd;
      if (p && state.cameraMode !== 'follow') {
        g.target.x = p.x + (g.target.x - p.x) * f;
        g.target.z = p.z + (g.target.z - p.z) * f;
      }
    }

// --- Mouse and touch on the 3D view -------------------------------------------------------------
function exploreBindPointer() {
      const el = renderer.domElement;
      el.style.touchAction = 'none';
      el.addEventListener('contextmenu', e => e.preventDefault());

      el.addEventListener('pointerdown', (e) => {
        exploreHideSpotMenu();
        exploreCam.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button, type: e.pointerType });
        try { el.setPointerCapture(e.pointerId); } catch (err) {}
        exploreStartDrag();
      });
      el.addEventListener('pointermove', (e) => {
        const p = exploreCam.pointers.get(e.pointerId);
        if (!p) return;
        const px = p.x, py = p.y;
        p.x = e.clientX; p.y = e.clientY;
        exploreMoveDrag(e, px, py);
      });
      const end = (e) => {
        if (!exploreCam.pointers.has(e.pointerId)) return;
        exploreCam.pointers.delete(e.pointerId);
        if (exploreCam.drag && exploreCam.drag.moved) exploreCam.suppressClickUntil = Date.now() + (exploreCam.drag.kind === 'pinch' ? 450 : 120);
        exploreStartDrag();
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);

      el.addEventListener('wheel', (e) => {
        e.preventDefault();
        exploreTakeOver('zoom');
        const factor = Math.exp(exploreClamp(e.deltaY, -120, 120) * 0.0022);
        if (state.cameraMode === 'eyes' && typeof eyeCamZoom === 'function') return eyeCamZoom(factor);
        exploreZoomAbout(exploreTerrainPoint(e.clientX, e.clientY), factor);
      }, { passive: false });

      el.addEventListener('dblclick', (e) => {
        clearTimeout(exploreSpotTimer);
        exploreHideSpotMenu();
        const p = exploreTerrainPoint(e.clientX, e.clientY);
        if (!p) return;
        exploreFlyTo({ x: p.x, z: p.z, dist: exploreClamp(exploreCam.cur ? exploreCam.cur.dist : 24, 14, 24) });
      });
    }

// (Re)start a gesture from whatever fingers or buttons are down now
function exploreStartDrag() {
      const pts = [...exploreCam.pointers.values()];
      if (!pts.length) { exploreCam.drag = null; return; }
      const wasMoved = Boolean(exploreCam.drag && exploreCam.drag.moved);
      if (pts.length >= 2) {
        const [a, b] = pts;
        exploreCam.drag = { kind: 'pinch', moved: wasMoved, d: Math.hypot(a.x - b.x, a.y - b.y), a: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        return;
      }
      const p = pts[0];
      const rotate = p.type === 'mouse' && (p.button === 2 || p.button === 1);
      exploreCam.drag = { kind: rotate ? 'rotate' : 'pan', moved: wasMoved, anchor: null, sx: p.x, sy: p.y };
    }

function exploreMoveDrag(e, px, py) {
      const d = exploreCam.drag;
      if (!d) return;
      const pts = [...exploreCam.pointers.values()];
      if (!d.moved) {
        const p = pts[0];
        const far = d.kind === 'pinch' || Math.hypot(p.x - p.sx, p.y - p.sy) > 5;
        if (!far) return;
        d.moved = true;
        exploreTakeOver(d.kind === 'pan' ? 'pan' : 'turn');
      }
      exploreCam.lastInput = Date.now();
      if (state.cameraMode === 'eyes' && typeof eyeCamLook === 'function') {
        // Through his eyes: a drag looks around, a pinch zooms
        if (d.kind === 'pinch' && pts.length >= 2) {
          const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
          if (dist > 10 && d.d > 10) eyeCamZoom(d.d / dist);
          d.d = dist;
        } else eyeCamLook(e.clientX - px, e.clientY - py);
        return;
      }
      const g = exploreCam.goal;
      if (d.kind === 'rotate') {
        g.yaw -= (e.clientX - px) * 0.006;
        g.pitch += (e.clientY - py) * 0.005;
      } else if (d.kind === 'pan') {
        exploreSlideMap(px, py, e.clientX, e.clientY);
      } else if (d.kind === 'pinch' && pts.length >= 2) {
        const [a, b] = pts;
        const dist = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        if (state.cameraMode === 'explore') exploreSlideMap(d.mx, d.my, mx, my);
        if (dist > 10 && d.d > 10) exploreZoomAbout(explorePlanePoint(mx, my), d.d / dist);
        let da = ang - d.a;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        g.yaw += da;
        Object.assign(d, { d: dist, a: ang, mx, my });
      }
    }

// Map-style sliding: the ground that was under the finger follows the finger
function exploreSlideMap(fromX, fromY, toX, toY) {
      const g = exploreCam.goal;
      const cam = exploreGoalCamera();
      const a = explorePlanePoint(fromX, fromY, cam), b = explorePlanePoint(toX, toY, cam);
      if (!a || !b) return;
      const dx = a.x - b.x, dz = a.z - b.z;
      const cap = g.dist * 0.6; // near the horizon a tiny move would be a huge jump
      const len = Math.hypot(dx, dz);
      const s = len > cap ? cap / len : 1;
      g.target.x += dx * s;
      g.target.z += dz * s;
    }

// --- Keyboard ------------------------------------------------------------------------------------
const EXPLORE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE', 'KeyR', 'KeyF', 'Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract']);

function exploreTyping(e) {
      const t = e.target;
      if (!t || !t.tagName) return false;
      const tag = t.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
    }

function exploreBindKeys() {
      // Capture phase, so the old Bird's-Eye arrow handling in js/main.js never sees these keys
      window.addEventListener('keydown', (e) => {
        if (exploreTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
        if (document.getElementById('keloViewer')) return; // the arrows page through the viewer
        if (e.key === '?') { exploreShowHelp(true); return; }
        if (e.code === 'Escape') { exploreHideSpotMenu(); exploreTogglePlaces(false); exploreShowHelp(false); return; }
        if (e.code === 'KeyK' || e.code === 'Home') { exploreFlyToKelo(); e.stopPropagation(); return; }
        if (e.code === 'KeyV' && typeof eyeCamToggle === 'function') { eyeCamToggle(); e.stopPropagation(); return; }
        if (!EXPLORE_KEYS.has(e.code)) return;
        e.stopPropagation();
        // With the menu open the arrow keys scroll it instead
        if (document.body.classList.contains('menu-open') && e.code.startsWith('Arrow')) return;
        exploreCam.keys[e.code] = true;
        if (e.code.startsWith('Arrow')) e.preventDefault();
      }, true);
      window.addEventListener('keyup', (e) => {
        if (!EXPLORE_KEYS.has(e.code)) return;
        exploreCam.keys[e.code] = false;
        e.stopPropagation();
      }, true);
      window.addEventListener('blur', () => { exploreCam.keys = {}; exploreCam.held = {}; });
    }

// --- The click menu: Fly here / Send Kelo-1 here / What's this? ---------------------------------
let exploreSpotTimer = null;
let exploreSpot = null;

// Called by js/scene.js on a plain click on the ground (instead of sending Kelo-1 straight there)
function showExploreSpotMenu(e, pt) {
      if (!pt) return;
      clearTimeout(exploreSpotTimer);
      const x = e.clientX, y = e.clientY;
      // Wait a moment, in case this is the first half of a double-click
      exploreSpotTimer = setTimeout(() => exploreOpenSpotMenu(x, y, pt.clone ? pt.clone() : pt), 300);
    }

// js/scene.js asks before handling a click: ignore the click that ends a drag, pinch or right-click
function exploreSwallowClick(e) {
      if (Date.now() < exploreCam.suppressClickUntil) return true;
      if (e && e.pointerType === 'mouse' && e.button !== 0) return true;
      return false;
    }

function exploreOpenSpotMenu(x, y, pt) {
      const menu = document.getElementById('exploreSpotMenu');
      if (!menu) return;
      exploreSpot = pt;
      const where = exploreDescribeSpot(pt, true);
      menu.innerHTML = `
        <div class="flex items-start justify-between gap-2">
          <div class="text-[11px] font-bold text-amber-200 leading-snug">${escapeHtml(where)}</div>
          <button type="button" data-spot="close" class="explore-x" aria-label="Close">✕</button>
        </div>
        <div class="flex flex-col gap-1 mt-1.5">
          <button type="button" data-spot="fly" class="explore-spot-btn"><span aria-hidden="true">✈️</span> Fly here</button>
          <button type="button" data-spot="send" class="explore-spot-btn"><span aria-hidden="true">🤖</span> Send Kelo-1 here</button>
          <button type="button" data-spot="info" class="explore-spot-btn"><span aria-hidden="true">❓</span> What's this?</button>
        </div>
        <p data-spot-info class="hidden mt-1.5 text-[11px] text-slate-300 leading-snug"></p>`;
      menu.classList.remove('hidden');
      const vw = window.innerWidth, vh = window.innerHeight;
      const r = menu.getBoundingClientRect();
      menu.style.left = `${exploreClamp(x + 12, 8, vw - r.width - 8)}px`;
      menu.style.top = `${exploreClamp(y - 20, 8, vh - r.height - 8)}px`;
    }

function exploreHideSpotMenu() {
      const menu = document.getElementById('exploreSpotMenu');
      if (menu && !menu.classList.contains('hidden')) menu.classList.add('hidden');
    }

function exploreSpotAction(action) {
      const pt = exploreSpot;
      if (!pt) return;
      if (action === 'close') return exploreHideSpotMenu();
      if (action === 'fly') {
        exploreHideSpotMenu();
        return exploreFlyTo({ x: pt.x, z: pt.z, dist: exploreClamp(exploreCam.cur ? exploreCam.cur.dist : 24, 14, 24) });
      }
      if (action === 'send') {
        exploreHideSpotMenu();
        // The same suggestion a ground click used to send
        const rx = Math.round(pt.x * 10) / 10, rz = Math.round(pt.z * 10) / 10;
        const isMountain = rz < -13 || pt.y > 2.2;
        synthesizeUnboundedExperience(
          isMountain
            ? `Hike up to mountain coordinate (${rx}, ${rz}) at +${pt.y.toFixed(1)}m altitude and core-drill for gold & minerals`
            : `Explore valley coordinate (${rx}, ${rz}) and weld an experimental 3D landmark`,
          isMountain ? 'Mountain Expedition' : 'Terrain Click',
          { x: rx, z: rz }
        );
        return;
      }
      if (action === 'info') {
        const info = document.querySelector('#exploreSpotMenu [data-spot-info]');
        if (info) { info.textContent = exploreDescribeSpot(pt, false); info.classList.remove('hidden'); }
      }
    }

// A plain description of a spot. short: just its name
function exploreDescribeSpot(pt, short) {
      const x = pt.x, z = pt.z;
      const h = getAnalyticalGroundHeight(x, z);
      const water = typeof WATER_LEVEL === 'number' ? WATER_LEVEL : -0.18;
      const near = Object.values(TOWN_LOCATIONS)
        .map(l => ({ l, d: Math.hypot(l.x - x, l.z - z) }))
        .filter(o => o.d < 5).sort((a, b) => a.d - b.d)[0];
      let ground;
      const ice = typeof iceThicknessCm === 'function' ? iceThicknessCm() : 0;
      if (z > 7.5 && h < water) ground = ice > 0 ? `frozen Okanagan Lake: ${ice} cm of ice over water about ${Math.max(1, Math.round(water - h))} m deep` : `Okanagan Lake, about ${Math.max(1, Math.round(water - h))} m deep here`;
      else if (z > 8.2 && h < 0.6) ground = 'the sandy beach';
      else if (h > 2.6 || z < -12) ground = `the mountain, ${Math.round(h)} m up`;
      else if (x > 14 && z < -6) ground = 'the rise toward the Eastern Overlook';
      else ground = 'the valley meadow';
      if (short) return near ? `${near.l.icon || '📍'} Near ${near.l.name}` : `📍 On ${ground}`;
      const bits = [`This is ${ground}.`];
      if (near) bits.push(`${near.l.name}${near.l.building && near.l.building !== near.l.name ? ` (${near.l.building})` : ''} is right here.`);
      const season = typeof currentSeason === 'function' ? currentSeason() : null;
      if (typeof inSnow === 'function' && inSnow({ x, z })) bits.push(`Snow lies here this ${String(season).toLowerCase()}; without snowshoes or skis he sinks in.`);
      const dig = (state.digSites || []).find(s => Math.hypot(s.x - x, s.z - z) < 3);
      if (dig) bits.push(`He has dug a hole here, ${dig.depth.toFixed(1)} m deep.`);
      const edit = (state.worldEdits || []).find(w => Math.hypot(w.x - x, w.z - z) < 2.5);
      if (edit) bits.push({ chop: 'He chopped a tree down here.', plant: 'He planted something here.', road: 'His gravel road starts here.', hill: 'He raised this hill himself.' }[edit.type] || 'He changed the land here.');
      const fill = (state.landFills || []).find(f => Math.hypot(f.x - x, f.z - z) < (f.r || 2) + 1.5);
      if (fill) bits.push(fill.done ? 'This is new land he made by tipping dirt into the lake.' : 'He is filling the lake in here to make new land.');
      const veh = (state.vehicles || []).find(v => Math.hypot(v.x - x, v.z - z) < 3.5);
      if (veh) bits.push(`His ${veh.name.replace(/^(an?|the)\s+/i, '').toLowerCase()} is parked here.`);
      const proj = (state.projects || []).find(p => Number.isFinite(p.x) && Math.hypot(p.x - x, p.z - z) < 3);
      if (proj && typeof planFor === 'function' && planFor(proj.key)) bits.push(`He built a ${planFor(proj.key).name.toLowerCase()} here.`);
      if (typeof inTown === 'function' && inTown(x, z)) bits.push('This is town: he never builds here.');
      if (Math.hypot(state.botPos.x - x, state.botPos.z - z) < 3) bits.push('Kelo-1 is standing right here.');
      return bits.join(' ');
    }

// --- Places --------------------------------------------------------------------------------------
// Each place: where to look and how to frame it (dist = how far back, pitch = how steeply down)
function explorePlaces() {
      const out = [];
      const add = (group, id, icon, name, x, z, frame = {}) => {
        if (Number.isFinite(x) && Number.isFinite(z)) out.push({ group, id, icon, name, x, z, dist: 22, pitch: 0.6, yaw: 0, ...frame });
      };
      const loc = id => TOWN_LOCATIONS[id];
      const fromLoc = (group, id, frame) => { const l = loc(id); if (l) add(group, id, l.icon || '📍', l.name, l.x, l.z, frame); };
      add('Overview', 'valley', '⛰️', 'The whole valley', 0, -8, { dist: 82, pitch: 0.95 });
      add('Overview', 'mountain_view', '🏔️', 'The mountains', -6, -26, { dist: 70, pitch: 0.55 });
      add('Overview', 'lake', '🌊', 'The lake', 0, 16, { dist: 55, pitch: 0.7, yaw: Math.PI });
      if (typeof HOUSE !== 'undefined') add('Town', 'house', '🏠', 'His house', HOUSE.x, HOUSE.z, { dist: 18, pitch: 0.6 });
      fromLoc('Town', 'weld', { dist: 14 });
      fromLoc('Town', 'garden', { dist: 16 });
      add('Town', 'cafes', '☕', 'Bean & Byte and NetNode cafes', 2.6, 3.4, { dist: 20 });
      fromLoc('Town', 'post_office', { dist: 16 });
      if (typeof STOREHOUSE !== 'undefined') add('Town', 'storehouse', '📦', 'Storehouse', STOREHOUSE.x, STOREHOUSE.z, { dist: 16 });
      if (typeof MUSEUM !== 'undefined') add('Town', 'museum', '🏛️', 'Museum', MUSEUM.x, MUSEUM.z, { dist: 26 });
      if (typeof DISPOSAL_PIT !== 'undefined') add('Town', 'disposal_pit', '🕳️', 'Disposal Pit', DISPOSAL_PIT.x, DISPOSAL_PIT.z, { dist: 16, pitch: 0.75 });
      if (typeof VEHICLE_YARD !== 'undefined') add('Vehicles', 'yard', '🚚', 'Vehicle yard', (VEHICLE_YARD.minX + VEHICLE_YARD.maxX) / 2, (VEHICLE_YARD.minZ + VEHICLE_YARD.maxZ) / 2, { dist: 24, pitch: 0.7 });
      if (typeof AIR_SLOTS !== 'undefined') add('Vehicles', 'helipad', '🚁', 'Helipad', AIR_SLOTS[0][0], AIR_SLOTS[0][1], { dist: 20, pitch: 0.7 });
      if (typeof BALLOON_SLOTS !== 'undefined') add('Vehicles', 'balloon', '🎈', 'Balloon field', BALLOON_SLOTS[0][0], BALLOON_SLOTS[0][1], { dist: 22 });
      if (typeof DOCK_SLOTS !== 'undefined') add('Vehicles', 'dock', '⚓', 'The dock', DOCK_SLOTS[0][0], DOCK_SLOTS[0][1], { dist: 20, pitch: 0.55 });
      (state.vehicles || []).forEach(v => add('Vehicles', 'veh-' + v.id, '🚙', v.name, v.x, v.z, { dist: 14 }));
      fromLoc('Nature', 'shoreline', { dist: 20 });
      fromLoc('Nature', 'meadow', { dist: 22 });
      // High places are framed from above the clouds (they drift at heights 26 to 38)
      fromLoc('Nature', 'mountain_peak', { dist: 55, pitch: 0.95 });
      fromLoc('Nature', 'east_cliff', { dist: 50, pitch: 0.95 });
      // His own marks on the world
      const known = new Set(['storehouse', 'post_office', 'bed', 'couch', 'weld', 'garden', 'cafe', 'cyber', 'shoreline', 'meadow', 'mountain_peak', 'disposal_pit', 'museum', 'east_cliff']);
      Object.values(TOWN_LOCATIONS).forEach(l => { if (!known.has(l.id) && l.showPin !== false) add('His spots', l.id, l.icon || '📍', l.name, l.x, l.z, { dist: 18 }); });
      (state.digSites || []).forEach((s, i) => {
        const mountain = s.z < -12 || getAnalyticalGroundHeight(s.x, s.z) > 2.2;
        add('His digs', 'dig-' + i, '⛏️', `${mountain ? 'Mountain' : 'Valley'} dig (${s.depth.toFixed(1)} m deep)`, s.x, s.z, { dist: 14, pitch: 0.75 });
      });
      (state.projects || []).filter(p => Number.isFinite(p.x)).forEach(p => {
        const plan = typeof planFor === 'function' ? planFor(p.key) : null;
        add('His projects', p.id, plan ? plan.emoji : '🔨', plan ? plan.name : 'A project', p.x, p.z, { dist: 12 });
      });
      (state.worldEdits || []).filter(e => e.type !== 'chop').slice(-8).forEach(e => {
        const label = { road: ['🛣️', 'Gravel road'], hill: ['⛰️', 'Hill he raised'], plant: ['🌱', 'Something he planted'] }[e.type] || ['🧱', 'A change he made'];
        add('His changes', e.id, label[0], label[1], e.type === 'road' && Number.isFinite(e.toX) ? (e.x + e.toX) / 2 : e.x, e.type === 'road' && Number.isFinite(e.toZ) ? (e.z + e.toZ) / 2 : e.z, { dist: 16 });
      });
      (state.landFills || []).forEach((f, i) => add('New land', 'fill-' + i, '🏝️', f.done ? 'New land he made' : 'New land (still filling in)', f.x, f.z, { dist: 18, pitch: 0.65 }));
      return out;
    }

function exploreGoToPlace(id) {
      if (id === 'kelo') return exploreFlyToKelo();
      if (id === 'eyes' && typeof eyeCamStart === 'function') { exploreTogglePlaces(false); return eyeCamStart(); }
      const p = explorePlaces().find(pl => pl.id === id);
      if (p) exploreFlyTo(p);
      exploreTogglePlaces(false);
    }

function exploreRenderPlaces() {
      const list = document.getElementById('explorePlacesList');
      if (!list) return;
      const groups = {};
      explorePlaces().forEach(p => { (groups[p.group] = groups[p.group] || []).push(p); });
      list.innerHTML = `
        <div class="grid grid-cols-2 gap-1">
          <button type="button" data-place="kelo" class="explore-place explore-place-kelo"><span aria-hidden="true">🤖</span><span>Where is Kelo-1?</span></button>
          <button type="button" data-place="eyes" class="explore-place explore-place-kelo"><span aria-hidden="true">👀</span><span>Through his eyes</span></button>
        </div>
        ${Object.entries(groups).map(([g, items]) => `
          <div class="explore-place-group">${escapeHtml(g)}</div>
          <div class="grid grid-cols-2 gap-1">
            ${items.map(p => `<button type="button" data-place="${escapeHtml(p.id)}" class="explore-place"><span aria-hidden="true">${escapeHtml(p.icon)}</span><span class="truncate">${escapeHtml(p.name)}</span></button>`).join('')}
          </div>`).join('')}`;
    }

function exploreTogglePlaces(open) {
      const panel = document.getElementById('explorePlaces');
      const btn = document.getElementById('btnPlaces');
      if (!panel) return;
      const show = open === undefined ? panel.classList.contains('hidden') : open;
      if (show) exploreRenderPlaces();
      panel.classList.toggle('hidden', !show);
      btn?.setAttribute('aria-expanded', String(show));
      if (show) exploreHideSpotMenu();
    }

// --- Help card -----------------------------------------------------------------------------------
function exploreShowHelp(show) {
      const help = document.getElementById('exploreHelp');
      if (!help) return;
      help.classList.toggle('hidden', !show);
      help.classList.toggle('flex', show);
      if (show) {
        const auto = document.getElementById('exploreAutoReturn');
        if (auto) auto.checked = exploreCam.prefs.autoReturn;
        help.querySelector('[data-help-close]')?.focus();
      } else if (!exploreCam.prefs.helpSeen) {
        exploreCam.prefs.helpSeen = true;
        exploreSavePrefs();
      }
    }

// --- Buttons, joystick and the rest of the UI ----------------------------------------------------
function exploreUpdateUI() {
      const mode = state.cameraMode;
      document.querySelectorAll('[data-explore-mode]').forEach(b => {
        const on = b.getAttribute('data-explore-mode') === (mode === 'follow' || mode === 'eyes' ? mode : 'explore');
        b.classList.toggle('explore-mode-on', on);
        b.setAttribute('aria-pressed', String(on));
      });
      if (typeof updateCameraButtonsUI === 'function') updateCameraButtonsUI();
    }

function exploreBindButtons() {
      document.querySelectorAll('[data-explore-mode]').forEach(b => b.addEventListener('click', () => {
        if (b.getAttribute('data-explore-mode') === 'follow') exploreFlyToKelo();
        else if (b.getAttribute('data-explore-mode') === 'eyes') eyeCamStart();
        else { exploreTakeOver('pan'); exploreSetMode('explore'); }
      }));
      document.getElementById('btnPlaces')?.addEventListener('click', () => exploreTogglePlaces());
      document.getElementById('btnClosePlaces')?.addEventListener('click', () => exploreTogglePlaces(false));
      document.getElementById('explorePlacesList')?.addEventListener('click', (e) => {
        const b = e.target.closest('[data-place]');
        if (b) exploreGoToPlace(b.getAttribute('data-place'));
      });
      document.querySelectorAll('[data-explore-help]').forEach(b => b.addEventListener('click', () => exploreShowHelp(true)));
      document.querySelectorAll('[data-help-close]').forEach(b => b.addEventListener('click', () => exploreShowHelp(false)));
      document.getElementById('exploreHelp')?.addEventListener('click', (e) => { if (e.target.id === 'exploreHelp') exploreShowHelp(false); });
      document.querySelectorAll('[data-where-kelo]').forEach(b => b.addEventListener('click', () => exploreFlyToKelo()));
      const auto = document.getElementById('exploreAutoReturn');
      auto?.addEventListener('change', () => { exploreCam.prefs.autoReturn = auto.checked; exploreSavePrefs(); });
      document.getElementById('exploreSpotMenu')?.addEventListener('click', (e) => {
        const b = e.target.closest('[data-spot]');
        if (b) exploreSpotAction(b.getAttribute('data-spot'));
      });

      // Hold-to-move buttons (the desktop pad and the touch buttons)
      document.querySelectorAll('[data-hold]').forEach(b => {
        const key = b.getAttribute('data-hold');
        const stop = () => { exploreCam.held[key] = false; };
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); exploreCam.held[key] = true; try { b.setPointerCapture(e.pointerId); } catch (err) {} });
        b.addEventListener('pointerup', stop);
        b.addEventListener('pointercancel', stop);
        b.addEventListener('lostpointercapture', stop);
        b.addEventListener('contextmenu', e => e.preventDefault());
      });

      // The old camera buttons (World tab) and the activity panel's Follow button now fly smoothly
      document.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('.cam-btn, #btnFocusKelo');
        if (!b) return;
        e.stopPropagation();
        e.preventDefault();
        const cam = b.id === 'btnFocusKelo' ? 'follow' : b.getAttribute('data-cam');
        if (cam === 'follow') return exploreFlyToKelo();
        if (cam === 'eyes' && typeof eyeCamStart === 'function') return eyeCamStart();
        if (cam === 'bird') {
          const k = exploreKeloSpot();
          return exploreFlyTo({ x: k.x, z: k.z, dist: 60, pitch: 1.2 });
        }
        const place = { overview: 'valley', house: 'house', storehouse: 'storehouse', cafes: 'cafes' }[cam];
        if (place) exploreGoToPlace(place);
      }, true);

      // Click anywhere else closes the Places list and the spot menu. Any click or key counts as
      // someone being here, so the idle "go back to Kelo-1" waits
      document.addEventListener('keydown', () => { exploreCam.lastInput = Date.now(); }, true);
      document.addEventListener('pointerdown', (e) => {
        exploreCam.lastInput = Date.now();
        const t = e.target;
        if (!t.closest) return;
        if (!t.closest('#explorePlaces, #btnPlaces')) exploreTogglePlaces(false);
        if (!t.closest('#exploreSpotMenu') && t !== renderer.domElement) exploreHideSpotMenu();
      }, true);
    }

function exploreBindJoystick() {
      const pad = document.getElementById('exploreJoystick');
      const knob = document.getElementById('exploreJoystickKnob');
      if (!pad || !knob) return;
      let id = null;
      const move = (e) => {
        const r = pad.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2, max = r.width / 2 - 14;
        let dx = e.clientX - cx, dy = e.clientY - cy;
        const len = Math.hypot(dx, dy);
        if (len > max) { dx *= max / len; dy *= max / len; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        const dead = 0.12;
        const nx = dx / max, ny = dy / max;
        exploreCam.stick.x = Math.abs(nx) < dead ? 0 : nx;
        exploreCam.stick.y = Math.abs(ny) < dead ? 0 : ny;
      };
      const stop = (e) => {
        if (e.pointerId !== id) return;
        id = null;
        exploreCam.stick.x = exploreCam.stick.y = 0;
        knob.style.transform = '';
      };
      pad.addEventListener('pointerdown', (e) => { e.preventDefault(); id = e.pointerId; try { pad.setPointerCapture(id); } catch (err) {} move(e); });
      pad.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
      pad.addEventListener('pointerup', stop);
      pad.addEventListener('pointercancel', stop);
    }

// On phones, keep the touch controls just above the activity panel at the bottom
function exploreFitToPanel() {
      const hud = document.getElementById('keloOverheadHUD');
      if (!hud) return;
      const r = hud.getBoundingClientRect();
      const gap = r.height > 0 ? Math.max(12, window.innerHeight - r.top + 10) : 12;
      document.documentElement.style.setProperty('--explore-above-panel', `${Math.round(gap)}px`);
      // ...and the camera bar just below the status card at the top
      const card = document.getElementById('worldClockText')?.closest('.pointer-events-auto');
      if (card) document.documentElement.style.setProperty('--explore-top', `${Math.round(card.getBoundingClientRect().bottom + 8)}px`);
    }

// --- Start up ------------------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  if (typeof controls === 'undefined' || !controls || !renderer) return;
  exploreLoadPrefs();
  // This file handles the mouse and touch now; OrbitControls only aims the camera
  controls.enabled = false;
  if (state.cameraMode !== 'explore') state.cameraMode = 'follow';
  exploreSyncFromCamera();
  exploreCam.ready = true;
  exploreBindPointer();
  exploreBindKeys();
  exploreBindButtons();
  exploreBindJoystick();
  exploreUpdateUI();
  exploreFitToPanel();
  window.addEventListener('resize', exploreFitToPanel);
  setInterval(exploreFitToPanel, 1500);
  if (typeof initExploreMinimap === 'function') initExploreMinimap();
  // The first visit shows how it works (automated test browsers skip it so it doesn't cover what they click)
  if (!exploreCam.prefs.helpSeen && !navigator.webdriver) setTimeout(() => exploreShowHelp(true), 1200);
});
