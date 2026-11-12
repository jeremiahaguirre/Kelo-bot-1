// Picking things up and putting them down for real: setCarriedObject() (js/items3d.js) hands over to
// here. Loaded after js/kelo-ik.js; finishKeloPose() calls keloHandoffFrame() after the carried thing
// has been put in his hands.
//
// Picking up: the thing first sits in the world where it is (its own spot on a shelf, a table, or the
// ground in front of him), he bends and reaches for it (the step-1 hand IK goes to its sides), his
// hands close on it at the contact frame of the clip, and only then is it his: it is parented to him
// and eases from where it lay into his hands as he straightens up.
// Putting down: he carries it to the place point (the ground in front of him, a shelf slot, a table),
// lowers it, his hands open at the contact frame, and it is left in the world exactly where it was set.
// It stays there: a place that shows its own model takes it over (opts.placed / opts.real), otherwise
// it lies there until he is well away (then it is tidied away out of sight).
//
// setCarriedObject(obj, holdMs, opts) opts:
//   from: a world point (or Object3D: it is hidden and the carried model takes its place) to pick up from
//   to: a world point (the bottom of the thing goes there) to put down at
//   placed(obj): called at the contact frame with the thing set down; the caller owns it from then on
//   real: true when the place shows its own model at once: the set-down thing is removed at contact
//   stow: true to put it away without setting it down (eaten, pocketed): it shrinks away in his hands
// While a hand-off is under way he stands still (keloClipHolds), at most about a second and a half.

const KELO_HANDOFF = { contactUp: 0.4, contactUpHeavy: 0.5, contactDown: 0.47, high: 0.55, ghostFar: 14, ghostMs: 180000, ghostMax: 6, settleMs: 2500 };
const keloHand = { up: null, down: null, ghosts: [], stows: [], waiters: [], placeholder: null, release: null };
const _hoV = new THREE.Vector3(), _hoW = new THREE.Vector3(), _hoBox = new THREE.Box3(), _hoQ = new THREE.Quaternion();
const _hoL = new THREE.Vector3(), _hoR = new THREE.Vector3(), _hoReach = { l: null, r: null, w: 0 };

// Whether he can do it properly now (standing, upright, not riding or asleep)
function keloHandoffCan() {
      if (!keloGroup || !keloGroup.parent || typeof scene === 'undefined' || !scene) return false;
      if (state.isWalking || state.riding || state.isSleeping || state.currentLocKey === 'bed' || state.microPose === 'collapsed') return false;
      if (typeof keloOnMovingPlatform === 'function' && keloOnMovingPlatform()) return false;
      return true;
    }
// Inside on a trip with its own reaching pose (a shelf, the PO box): that pose does the bending
function keloHandoffTripPose() { return typeof indoorTrip !== 'undefined' && indoorTrip.active && Boolean(indoorTrip.pose); }
// He stands still while his hands are on their way to the thing or setting it down
function keloHandoffBusy() {
      const H = keloHand;
      return Boolean((H.up && !H.up.attached) || H.down);
    }
// Resolves once nothing is being picked up or put down (or after a couple of seconds)
function keloHandoffSettled() {
      if (!keloHand.up && !keloHand.down) return Promise.resolve();
      return new Promise(res => {
        keloHand.waiters.push(res);
        setTimeout(res, KELO_HANDOFF.settleMs);
      });
    }

// The thing's own height and how far its origin sits above its bottom (in its own scale, upright)
function keloHandoffMeasure(obj) {
      const u = obj.userData;
      if (u.hoH !== undefined) return u;
      const parent = obj.parent, p = obj.position.clone(), q = obj.quaternion.clone();
      if (parent) parent.remove(obj);
      obj.position.set(0, 0, 0); obj.quaternion.identity();
      obj.updateMatrixWorld(true);
      _hoBox.setFromObject(obj);
      const empty = _hoBox.isEmpty();
      u.hoH = empty ? 0.3 : _hoBox.max.y - _hoBox.min.y;
      u.hoBottom = empty ? 0 : _hoBox.min.y;
      u.hoW = empty ? 0.3 : Math.max(_hoBox.max.x - _hoBox.min.x, _hoBox.max.z - _hoBox.min.z);
      obj.position.copy(p); obj.quaternion.copy(q);
      if (parent) parent.add(obj);
      return u;
    }

// The floor point in front of him (a hand-span ahead), where things are picked up or set down by default
function keloHandoffFront(out, ahead = 0.55) {
      const y = keloGroup.rotation.y, P = keloGroup.position;
      const fy = Number.isFinite(state.botAltitudeY) ? state.botAltitudeY : P.y;
      return out.set(P.x + Math.sin(y) * ahead, fy, P.z + Math.cos(y) * ahead);
    }
const keloHandoffPt = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z) ? new THREE.Vector3(p.x, p.y, p.z) : null;
function keloHandoffFloorY() { return Number.isFinite(state.botAltitudeY) ? state.botAltitudeY : keloGroup.position.y; }
function keloHandoffHeavy(obj) {
      const s = typeof keloCarrySize === 'function' && obj.parent === keloGroup ? keloCarrySize(obj) : null;
      const u = keloHandoffMeasure(obj);
      const sx = s ? s.x : u.hoW, sy = s ? s.y : u.hoH, sz = s ? s.z : u.hoW;
      return sx * sy * sz > 0.09 || Math.max(sx, sy, sz) > 0.95;
    }

// --- Called by setCarriedObject (js/items3d.js) ---------------------------------------------------------
// old: what he held (null for nothing), obj: what he holds now. Returns true when it took care of
// putting obj in his hands (the caller then doesn't add it to keloGroup).
function keloHandoffSwap(old, obj, opts) {
      opts = opts || {};
      const H = keloHand, can = keloHandoffCan();
      // something still on its way into his hands: it never got there
      if (H.up && H.up.obj === old && !H.up.attached) { keloHandoffDrop(H.up); H.up = null; old = null; }
      // (the parcel already in his hand from his PO box becomes the real thing: no reaching for it)
      let inHand = false;
      if (H.placeholder && H.placeholder !== obj) { keloHandoffDispose(H.placeholder); H.placeholder = null; inHand = Boolean(obj); }
      if (old) {
        if (opts.stow || !can || (H.down && H.down.obj !== old)) keloHandoffStow(old);
        else keloHandoffDown(old, opts);
      }
      if (!obj) return false;
      if (opts.inHand || inHand || !can) return false;
      keloHandoffUp(obj, opts);
      return true;
    }

function keloHandoffUp(obj, opts) {
      const H = keloHand, u = keloHandoffMeasure(obj);
      let at = null, hide = null;
      if (opts.from && opts.from.isObject3D) {
        hide = opts.from;
        hide.updateMatrixWorld(true);
        _hoBox.setFromObject(hide);
        at = _hoBox.isEmpty() ? hide.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3((_hoBox.min.x + _hoBox.max.x) / 2, _hoBox.min.y, (_hoBox.min.z + _hoBox.max.z) / 2);
      } else at = keloHandoffPt(opts.from) || keloHandoffFront(new THREE.Vector3());
      // (in the world where it lies, turned the way he faces, its bottom on the spot)
      scene.add(obj);
      obj.rotation.set(0, keloGroup.rotation.y, 0);
      obj.position.set(at.x, at.y - u.hoBottom * obj.scale.y, at.z);
      if (hide) hide.visible = false;
      const high = at.y - keloHandoffFloorY() > KELO_HANDOFF.high;
      const heavy = !high && keloHandoffHeavy(obj);
      // (after a put-down still going on, this one waits its turn)
      const delay = H.down ? Math.max(0, H.down.contact - H.down.t + 0.15) : 0;
      H.up = { obj, t: -delay, contact: high ? KELO_HANDOFF.contactUp : heavy ? KELO_HANDOFF.contactUpHeavy : KELO_HANDOFF.contactUp, attached: false, k: 0, p0: null, q0: null,
        clip: keloHandoffTripPose() ? null : high ? 'pickHigh' : heavy ? 'pickUpHeavy' : 'pickUp', started: false, hide };
    }

function keloHandoffDown(obj, opts) {
      const H = keloHand, u = keloHandoffMeasure(obj);
      if (H.down) keloHandoffFinishDown(H.down, true);
      const to = keloHandoffPt(opts.to) || keloHandoffFront(new THREE.Vector3());
      const high = to.y - keloHandoffFloorY() > KELO_HANDOFF.high;
      keloGroup.updateMatrixWorld(true);
      keloHandoffHandsLocal(_hoV);
      H.down = { obj, t: 0, contact: KELO_HANDOFF.contactDown, to, high, off: obj.position.clone().sub(_hoV), q: obj.quaternion.clone(),
        placed: opts.placed || null, real: Boolean(opts.real), parent: opts.parent || null, clip: keloHandoffTripPose() ? null : high ? 'putHigh' : 'putDown', started: false };
      u.hoYaw = keloGroup.rotation.y;
    }

// Put away without setting it down: it shrinks into his hands
function keloHandoffStow(obj) {
      if (!obj.parent) { keloHandoffDispose(obj); return; }
      keloHand.stows.push({ obj, t: 0, s: obj.scale.clone() });
    }

function keloHandoffDrop(up) {
      if (up.hide) up.hide.visible = true;
      keloHandoffDispose(up.obj);
    }

function keloHandoffDispose(obj) {
      if (!obj) return;
      if (obj.parent) obj.parent.remove(obj);
      obj.traverse(o => { if (o.geometry && !(o.userData && o.userData.sharedGeometry)) o.geometry.dispose(); });
    }

// Halfway between his palms, in keloGroup's space
function keloHandoffHandsLocal(out) {
      keloPalmLocal(keloLeftHand, _hoL);
      keloPalmLocal(keloRightHand, _hoR);
      return out.copy(_hoL).add(_hoR).multiplyScalar(0.5);
    }

function keloHandoffFinishDown(D, early) {
      const H = keloHand, obj = D.obj;
      // left in the world exactly where it was set
      const parent = D.parent || scene;
      parent.attach(obj);
      if (early) { /* (a new hand-off cut it short: it goes straight to its spot) */
        const u = keloHandoffMeasure(obj);
        const w = new THREE.Vector3(D.to.x, D.to.y - u.hoBottom * obj.scale.y, D.to.z);
        obj.position.copy(parent === scene ? w : parent.worldToLocal(w));
      }
      H.down = null;
      if (D.real) keloHandoffDispose(obj);
      else if (D.placed) { try { D.placed(obj); } catch (e) { console.warn('placed', e); } }
      else {
        H.ghosts.push({ obj, at: Date.now() });
        while (H.ghosts.length > KELO_HANDOFF.ghostMax) keloHandoffDispose(H.ghosts.shift().obj);
      }
    }

// --- Every frame, at the end of finishKeloPose (after keloHoldInHands) -----------------------------------
function keloHandoffFrame(dt) {
      const H = keloHand;
      _hoReach.w = 0;
      if (H.up) keloHandoffUpFrame(H.up, dt);
      if (H.down) keloHandoffDownFrame(H.down, dt);
      else if (H.release && !H.up) {
        // (his hands leave it where it was set)
        const R = H.release;
        R.t += dt;
        _hoReach.l = R.l; _hoReach.r = R.r; _hoReach.w = 1 - smoothstep(R.t / 0.3);
        if (R.t >= 0.3) H.release = null;
      }
      for (let i = H.stows.length - 1; i >= 0; i--) {
        const S = H.stows[i];
        S.t += dt;
        const k = Math.max(0, 1 - S.t / 0.3);
        S.obj.scale.copy(S.s).multiplyScalar(Math.max(0.001, k * k));
        if (k <= 0) { keloHandoffDispose(S.obj); H.stows.splice(i, 1); }
      }
      if (H.placeholder && Date.now() - H.placeholderAt > 20000) { keloHandoffDispose(H.placeholder); H.placeholder = null; }
      if (H.ghosts.length && keloGroup) {
        const now = Date.now(), P = keloGroup.position;
        H.ghosts = H.ghosts.filter(g => {
          if (!g.obj.parent) return false;
          g.obj.getWorldPosition(_hoW);
          if (now - g.at > KELO_HANDOFF.ghostMs || Math.hypot(_hoW.x - P.x, _hoW.z - P.z) > KELO_HANDOFF.ghostFar) { keloHandoffDispose(g.obj); return false; }
          return true;
        });
      }
      if (!H.up && !H.down && H.waiters.length) { const w = H.waiters; H.waiters = []; w.forEach(f => f()); }
    }

function keloHandoffUpFrame(U, dt) {
      const H = keloHand, obj = U.obj;
      if (!obj || (!U.attached && obj.parent !== scene) || carriedObject !== obj) { if (!U.attached) keloHandoffDrop(U); H.up = null; return; }
      U.t += dt;
      if (U.t < 0) return;
      if (!U.started) { U.started = true; if (U.clip && typeof keloClipShot === 'function') keloClipShot(U.clip); }
      if (!U.attached) {
        // hands to its sides (the side facing him across)
        keloHandoffSides(obj, U.contact, U.t);
        if (U.t >= U.contact) {
          if (U.hide && U.hide.parent) U.hide.visible = false;
          keloGroup.attach(obj);
          U.attached = true;
          U.p0 = obj.position.clone(); U.q0 = obj.quaternion.clone();
        }
        return;
      }
      // in his hands: from where it lay into the carrying grip as he straightens up (keloHoldInHands has
      // just put it where it is carried)
      U.k = Math.min(1, U.k + dt / 0.4);
      const k = smoothstep(U.k);
      obj.position.lerpVectors(U.p0, obj.position, k);
      _hoQ.copy(U.q0).slerp(obj.quaternion, k);
      obj.quaternion.copy(_hoQ);
      // (his hands let the reach go as the carrying grip takes over)
      keloHandoffSides(obj, 0.1, 1);
      _hoReach.w *= 1 - smoothstep(U.k / 0.6);
      if (U.k >= 1) H.up = null;
    }

function keloHandoffDownFrame(D, dt) {
      const obj = D.obj;
      if (!obj || obj.parent !== keloGroup) { keloHand.down = null; return; }
      D.t += dt;
      if (!D.started) { D.started = true; if (D.clip && typeof keloClipShot === 'function') keloClipShot(D.clip); }
      const u = keloHandoffMeasure(obj);
      keloGroup.updateMatrixWorld(true);
      // follows his hands down...
      keloHandoffHandsLocal(_hoV).add(D.off);
      // ...and arrives exactly on its spot at the contact frame
      const a = smoothstep((D.t - (D.contact - 0.32)) / 0.32);
      _hoW.set(D.to.x, D.to.y - u.hoBottom * obj.scale.y, D.to.z);
      keloGroup.worldToLocal(_hoW);
      obj.position.lerpVectors(_hoV, _hoW, a);
      obj.quaternion.copy(D.q);
      // hands to its sides at the spot
      keloHandoffSides(obj, D.contact, D.t, D.to, u);
      if (D.t >= D.contact) {
        keloHand.release = { l: _hoL.clone(), r: _hoR.clone(), t: 0 };
        keloHandoffFinishDown(D, false);
      }
    }

// Reach targets for both hands at the thing's sides, weighted up to the contact frame
function keloHandoffSides(obj, contact, t, to, u) {
      u = u || keloHandoffMeasure(obj);
      const half = Math.min(0.32, Math.max(0.06, u.hoW / 2));
      const yaw = keloGroup.rotation.y, rx = Math.cos(yaw), rz = -Math.sin(yaw);
      if (to) _hoW.set(to.x, to.y + u.hoH * obj.scale.y * 0.45, to.z);
      else {
        obj.updateMatrixWorld(true);
        obj.getWorldPosition(_hoW);
        _hoW.y += (u.hoBottom + u.hoH * 0.45) * obj.scale.y;
      }
      _hoL.set(_hoW.x - rx * half, _hoW.y, _hoW.z - rz * half);
      _hoR.set(_hoW.x + rx * half, _hoW.y, _hoW.z + rz * half);
      _hoReach.l = _hoL; _hoReach.r = _hoR;
      _hoReach.w = smoothstep((t - 0.08) / Math.max(0.1, contact - 0.12));
    }

// For js/kelo-ik.js: { l, r, w } while his hands go to a thing, or null
function keloHandoffReach() {
      return _hoReach.w > 0.001 ? _hoReach : null;
    }

// His mailbox parcel (or anything already in his hand) stays there until it becomes the carried thing
function keloHandoffHoldInHand(obj, hand) {
      if (keloHand.placeholder) keloHandoffDispose(keloHand.placeholder);
      (hand || keloLeftHand).attach(obj);
      keloHand.placeholder = obj;
      keloHand.placeholderAt = Date.now();
    }
