// Kelo-bot-1 — js/eyecam.js
// Loaded after explore.js. "Through his eyes": a first-person camera mounted at Kelo-1's eyes.
//   - It looks wherever his head looks, eased so it glides rather than jerks, with the horizon
//     kept level and his walking bob filtered down to a slight sway (no seasickness).
//   - His head (and anything worn on it) is hidden from view so the camera never sees its inside.
//   - When he works or carries something it tilts down a little so his hands and tools show.
//   - You can look around yourself: drag (or one finger), the arrow keys / WASD / the joystick;
//     scroll or pinch to zoom. Let go and the view drifts back to where he looks.
//   - A small HUD says what he is looking at and what he is thinking (it can be hidden).
// Switch with the camera bar's "Eyes" button, the Places list, the World tab camera buttons or V.
// Any other camera choice switches back. Camera prefs stay on this device (localStorage).

const EYECAM_PREFS_KEY = 'kelo1_eyecam_prefs';
const EYECAM_FOV = 72;

const eyeCam = {
  on: false,
  prefs: { hud: true },
  enterT: 0, from: null,               // the view we glide in from
  pos: null, yaw: 0, pitch: 0,         // the stabilised eye
  lookYaw: 0, lookPitch: 0,            // your own look-around, on top of his
  zoom: 1,
  lastInput: 0,
  saved: null,                         // camera settings to put back
  hudAt: 0,
  lastHeadYaw: null
};
const _eyeV = new THREE.Vector3(), _eyeDir = new THREE.Vector3(), _eyeQ = new THREE.Quaternion();

// What he is working on, for "through his eyes" to look at (a machine's moving part, the screen he
// types on, his plate, his PO box...). Activities call setKeloFocus(fn) with a function that returns
// a world point (it is read every frame, so it follows moving parts) and clearKeloFocus(fn) after.
const keloFocus = { fn: null, until: 0 };
function setKeloFocus(fn, ms = 10 * 60000) {
      keloFocus.fn = fn;
      keloFocus.until = Date.now() + ms;
    }
function clearKeloFocus(fn) {
      if (!fn || keloFocus.fn === fn) keloFocus.fn = null;
    }
function keloFocusPoint() {
      if (!keloFocus.fn) return null;
      if (Date.now() > keloFocus.until) { keloFocus.fn = null; return null; }
      try {
        const p = keloFocus.fn();
        return p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z) ? p : null;
      } catch (e) { return null; }
    }
// A machine model's working spot: its moving part if it has one, else the middle of its top half
const KELO_FOCUS_PARTS = ['part', 'platform', 'basket', 'table', 'bed', 'head', 'spindle', 'nozzle', 'blade', 'arm', 'brush', 'inside', 'glow', 'uv', 'window', 'screen'];
function machineFocusFn(model) {
      if (!model) return null;
      const u = model.userData || {}, inner = (u.inner && u.inner.userData) || {};
      let part = null;
      for (const k of KELO_FOCUS_PARTS) {
        const o = u[k] || inner[k];
        if (o && o.isObject3D) { part = o; break; }
      }
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const mid = box.getCenter(new THREE.Vector3());
      mid.y = box.min.y + (box.max.y - box.min.y) * 0.65;
      const v = new THREE.Vector3();
      return () => (part && part.parent ? part.getWorldPosition(v) : mid);
    }

function eyeCamLoadPrefs() {
      try { Object.assign(eyeCam.prefs, JSON.parse(localStorage.getItem(EYECAM_PREFS_KEY) || '{}')); } catch (e) {}
    }
function eyeCamSavePrefs() {
      try { localStorage.setItem(EYECAM_PREFS_KEY, JSON.stringify(eyeCam.prefs)); } catch (e) {}
    }

// Switch to his eyes (the frame loop does the rest)
function eyeCamStart() {
      if (typeof exploreCam !== 'undefined') { exploreCam.fly = null; exploreHideSpotMenu?.(); exploreTogglePlaces?.(false); }
      state.cameraMode = 'eyes';
      if (typeof exploreUpdateUI === 'function') exploreUpdateUI();
    }

function eyeCamToggle() {
      if (state.cameraMode === 'eyes') { if (typeof exploreFlyToKelo === 'function') exploreFlyToKelo(); else state.cameraMode = 'follow'; }
      else eyeCamStart();
    }

// Is he working with his hands or holding something? Then show them.
function eyeCamHandsBusy() {
      const holding = typeof carriedObject !== 'undefined' && carriedObject;
      const tool = (keloDrillToolGroup && keloDrillToolGroup.visible) || (keloWeldTorchGroup && keloWeldTorchGroup.visible);
      return Boolean(holding || tool || keloAnim.mode === 'dig' || keloAnim.mode === 'weld' || state.currentLocKey === 'cyber');
    }

// Outdoor work with no named spot (digging, welding at his table, painting, building, planting,
// chopping, fixing things): look at his hands' work, or at the ground in front of him when he digs or
// crouches to look. Smoothed, so the swing of a shovel or a brush doesn't shake the view.
const eyeWork = { p: null, on: false };
function eyeCamWorkFocus(dt) {
      const pose = state.microPose;
      const working = !state.isWalking && !state.riding && !state.isSleeping && (
        eyeCamHandsBusy() || state.currentLocKey === 'weld' || pose === 'digging' || pose === 'crouch_inspect' || pose === 'procedural_custom'
        || keloAnim.mode === 'other' || state.isBuilding);
      if (!working || typeof handsWorldPosition !== 'function') { eyeWork.p = null; return null; }
      let want;
      const fwd = new THREE.Vector3(Math.sin(keloGroup.rotation.y), 0, Math.cos(keloGroup.rotation.y));
      if (pose === 'digging' || keloAnim.mode === 'dig' || pose === 'crouch_inspect') {
        const x = keloGroup.position.x + fwd.x * 1.6, z = keloGroup.position.z + fwd.z * 1.6;
        want = new THREE.Vector3(x, getIslandGroundHeight(x, z) + 0.05, z);
      } else {
        want = handsWorldPosition().addScaledVector(fwd, 0.7);
      }
      if (!eyeWork.p) eyeWork.p = want.clone();
      else eyeWork.p.lerp(want, 1 - Math.exp(-3 * dt));
      return eyeWork.p;
    }

// Where his eyes are and which way his head faces, in the world
function eyeCamRead() {
      keloGroup.updateMatrixWorld(true);
      const eye = keloHead.localToWorld(_eyeV.set(0, 0.3, 0.1)).clone();
      keloHead.getWorldQuaternion(_eyeQ);
      _eyeDir.set(0, 0, 1).applyQuaternion(_eyeQ);
      return { eye, yaw: Math.atan2(_eyeDir.x, _eyeDir.z), pitch: -Math.asin(Math.max(-1, Math.min(1, _eyeDir.y))) };
    }

function eyeCamEnter() {
      eyeCam.on = true;
      eyeCam.saved = { fov: camera.fov, near: camera.near, maxPolar: controls.maxPolarAngle, minDist: controls.minDistance };
      controls.maxPolarAngle = Math.PI;   // he can look up at the sky
      controls.minDistance = 0.5;
      camera.near = 0.05;
      const r = eyeCamRead();
      eyeCam.pos = r.eye.clone();
      eyeCam.yaw = r.yaw; eyeCam.pitch = r.pitch;
      eyeCam.lookYaw = eyeCam.lookPitch = 0; eyeCam.zoom = 1;
      eyeCam.from = { pos: camera.position.clone(), target: controls.target.clone(), fov: camera.fov };
      eyeCam.enterT = performance.now();
      keloHead.visible = false;
      document.body.classList.add('eyecam-on');
      eyeCamRenderHud(true);
    }

function eyeCamLeave() {
      eyeCam.on = false;
      if (keloHead) keloHead.visible = true;
      const s = eyeCam.saved;
      if (s) {
        camera.fov = s.fov; camera.near = s.near; camera.updateProjectionMatrix();
        controls.maxPolarAngle = s.maxPolar; controls.minDistance = s.minDist;
      }
      // Leave the aim point a little ahead and below, so the next camera starts from this view
      const fwd = new THREE.Vector3(Math.sin(eyeCam.yaw), 0, Math.cos(eyeCam.yaw));
      controls.target.copy(camera.position).addScaledVector(fwd, 6);
      controls.target.y = Math.min(controls.target.y, camera.position.y - 1.2);
      if (typeof exploreCam !== 'undefined') exploreCam.driving = false;
      document.body.classList.remove('eyecam-on');
      eyeCamRenderHud(false);
    }

// Look-around input (pixels dragged), and zoom (factor > 1 zooms out)
function eyeCamLook(dx, dy) {
      eyeCam.lastInput = performance.now();
      eyeCam.lookYaw -= dx * 0.005 * eyeCam.zoom;
      eyeCam.lookPitch += dy * 0.004 * eyeCam.zoom;
      eyeCam.lookYaw = Math.max(-2.6, Math.min(2.6, eyeCam.lookYaw));
      eyeCam.lookPitch = Math.max(-1.0, Math.min(1.0, eyeCam.lookPitch));
    }
function eyeCamZoom(factor) {
      eyeCam.lastInput = performance.now();
      eyeCam.zoom = Math.max(0.6, Math.min(1.2, eyeCam.zoom * factor));
    }

// Every frame, from exploreCameraUpdate() (js/explore.js). Returns true when it placed the camera.
function eyeCamFrame(dt) {
      if (state.cameraMode !== 'eyes') { if (eyeCam.on) eyeCamLeave(); return false; }
      if (!keloGroup || !keloHead || !camera || !controls) return false;
      if (!eyeCam.on) eyeCamEnter();
      keloHead.visible = false;   // in case something else showed it
      const r = eyeCamRead();
      const wrap = x => Math.atan2(Math.sin(x), Math.cos(x));
      const teleported = r.eye.distanceTo(eyeCam.pos) > 4;
      if (teleported) eyeCam.pos.copy(r.eye);

      // Keys, held buttons and the joystick look around
      if (typeof exploreCam !== 'undefined') {
        const k = exploreCam.keys, h = exploreCam.held, s = exploreCam.stick;
        const turn = (k.KeyA || k.ArrowLeft || k.KeyQ || h.left || h.turnLeft ? 1 : 0) - (k.KeyD || k.ArrowRight || k.KeyE || h.right || h.turnRight ? 1 : 0) - s.x;
        const tilt = (k.KeyS || k.ArrowDown || k.KeyF || h.down ? 1 : 0) - (k.KeyW || k.ArrowUp || k.KeyR || h.up || h.tiltUp ? 1 : 0) + s.y;
        const zoom = (k.Equal || k.NumpadAdd || h.zoomIn ? 1 : 0) - (k.Minus || k.NumpadSubtract || h.zoomOut ? 1 : 0);
        if (turn || tilt) eyeCamLook(-turn * 380 * dt, tilt * 300 * dt);
        if (zoom) eyeCamZoom(Math.exp(-zoom * 0.8 * dt));
      }
      // With nobody looking around for a moment, drift back to where he looks
      if (performance.now() - eyeCam.lastInput > 2500) {
        eyeCam.lookYaw = dampTo(eyeCam.lookYaw, 0, 1.6, dt);
        eyeCam.lookPitch = dampTo(eyeCam.lookPitch, 0, 1.6, dt);
      }

      // Stabilise: follow his eyes sideways closely, filter the up-and-down bob of his steps down to a
      // slight sway, and ease the turn of his head
      const busy = eyeCamHandsBusy();
      eyeCam.pos.x = dampTo(eyeCam.pos.x, r.eye.x, 16, dt);
      eyeCam.pos.z = dampTo(eyeCam.pos.z, r.eye.z, 16, dt);
      eyeCam.pos.y = dampTo(eyeCam.pos.y, r.eye.y, 4.5, dt);
      const bob = 0.01 * (keloAnim.stepAct || 0) * Math.sin(keloAnim.phase * 2);
      // Working on something: look at it (the part moving in a machine, the screen, the plate),
      // not just the way his head points. Kept within what he could see by turning his head.
      const named = keloFocusPoint();
      const focus = named || eyeCamWorkFocus(dt);
      let wantYaw = r.yaw, wantPitch = Math.max(-0.7, Math.min(0.95, r.pitch)) + (busy ? 0.42 : 0.1);
      if (focus) {
        const dx = focus.x - eyeCam.pos.x, dy = focus.y - eyeCam.pos.y, dz = focus.z - eyeCam.pos.z;
        const flat = Math.hypot(dx, dz);
        if (flat > 0.05) {
          const fy = Math.atan2(dx, dz), body = keloGroup.rotation.y;
          wantYaw = body + Math.max(-1.6, Math.min(1.6, wrap(fy - body)));
        }
        wantPitch = Math.max(-0.7, Math.min(named ? 1.25 : 0.95, Math.atan2(-dy, Math.max(0.05, flat))));
      }
      eyeCam.yaw += wrap(wantYaw - eyeCam.yaw) * (1 - Math.exp(-(focus ? 4 : 6) * dt));
      eyeCam.pitch = dampTo(eyeCam.pitch, wantPitch, focus ? 4 : 5, dt);

      const yaw = eyeCam.yaw + eyeCam.lookYaw;
      const pitch = Math.max(-1.3, Math.min(1.35, eyeCam.pitch + eyeCam.lookPitch));
      const pos = _eyeV.copy(eyeCam.pos); pos.y += bob;
      const dir = _eyeDir.set(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      const target = pos.clone().addScaledVector(dir, 6);
      const fov = Math.max(40, Math.min(90, (EYECAM_FOV + (busy ? 6 : 0)) * eyeCam.zoom));

      // Glide in from the previous view for the first moment
      const u = Math.min(1, (performance.now() - eyeCam.enterT) / 700);
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      if (u < 1 && eyeCam.from) {
        camera.position.lerpVectors(eyeCam.from.pos, pos, e);
        controls.target.lerpVectors(eyeCam.from.target, target, e);
        camera.fov = eyeCam.from.fov + (fov - eyeCam.from.fov) * e;
      } else {
        camera.position.copy(pos);
        controls.target.copy(target);
        camera.fov = fov;
      }
      camera.updateProjectionMatrix();

      const now = performance.now();
      if (now - eyeCam.hudAt > 300) { eyeCam.hudAt = now; eyeCamRenderHud(true); }
      return true;
    }

// --- What he is looking at ------------------------------------------------------------------------
function eyeCamLookingAt() {
      const p = camera.position;
      _eyeDir.set(0, 0, -1).applyQuaternion(camera.quaternion);
      const fx = _eyeDir.x, fz = _eyeDir.z, fl = Math.hypot(fx, fz) || 1;
      const things = [];
      Object.values(TOWN_LOCATIONS || {}).forEach(l => { if (l.showPin !== false) things.push({ name: `${l.icon || '📍'} ${l.name}`, x: l.x, z: l.z, size: 3 }); });
      (state.vehicles || []).forEach(v => things.push({ name: `🚙 His ${String(v.name).replace(/^(an?|the)\s+/i, '').toLowerCase()}`, x: v.x, z: v.z, size: 1.5 }));
      (state.projects || []).filter(pr => Number.isFinite(pr.x)).forEach(pr => {
        const plan = typeof planFor === 'function' ? planFor(pr.key) : null;
        things.push({ name: `${plan ? plan.emoji : '🔨'} His ${plan ? plan.name.toLowerCase() : 'project'}`, x: pr.x, z: pr.z, size: 1.5 });
      });
      let best = null;
      things.forEach(o => {
        const dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz);
        if (d < 0.5 || d > 60) return;
        const ang = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / (d * fl))));
        const allowed = 0.22 + Math.atan(o.size / d);
        if (ang > allowed) return;
        const score = ang / allowed + d / 120;
        if (!best || score < best.score) best = { name: o.name, score };
      });
      if (best) return best.name;
      if (_eyeDir.y > 0.35) return '☁️ The sky';
      // Otherwise the ground a few steps ahead
      const ahead = { x: p.x + fx / fl * 8, z: p.z + fz / fl * 8 };
      ahead.y = getAnalyticalGroundHeight(ahead.x, ahead.z);
      return typeof exploreDescribeSpot === 'function' ? exploreDescribeSpot(ahead, true).replace(/^📍 On /, '🌿 ') : '🌿 The valley';
    }

function eyeCamRenderHud(show) {
      const hud = document.getElementById('eyeCamHud');
      if (!hud) return;
      hud.classList.toggle('hidden', !show);
      if (!show) return;
      const body = hud.querySelector('[data-eyecam-body]');
      const btn = hud.querySelector('[data-eyecam-hud]');
      if (body) body.classList.toggle('hidden', !eyeCam.prefs.hud);
      if (btn) { btn.textContent = eyeCam.prefs.hud ? 'Hide' : 'Show'; btn.setAttribute('aria-pressed', String(eyeCam.prefs.hud)); }
      if (!eyeCam.prefs.hud) return;
      const clean = s => (typeof stripCoords === 'function' ? stripCoords(String(s || '')) : String(s || '')).trim();
      const look = hud.querySelector('[data-eyecam-look]');
      const think = hud.querySelector('[data-eyecam-think]');
      if (look) look.textContent = eyeCamLookingAt();
      const said = clean(state.speechBubble);
      const doing = clean(state.moodTitle);
      if (think) think.textContent = said ? `"${said.length > 110 ? said.slice(0, 107) + '…' : said}"` : (doing || '…');
    }

window.addEventListener('DOMContentLoaded', () => {
  eyeCamLoadPrefs();
  document.querySelector('#eyeCamHud [data-eyecam-hud]')?.addEventListener('click', () => {
    eyeCam.prefs.hud = !eyeCam.prefs.hud;
    eyeCamSavePrefs();
    eyeCamRenderHud(state.cameraMode === 'eyes');
  });
  document.querySelector('#eyeCamHud [data-eyecam-exit]')?.addEventListener('click', () => eyeCamToggle());
});
