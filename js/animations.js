// Kelo-1's body language: smooth blending between poses, a weighted walk cycle, breathing and
// glancing around while he stands, actions with a wind-up and follow-through, and emotes.
// Loaded right after scene.js.
//
// How it fits together: every frame scene.js calls beginKeloPose(), which puts his joints back at
// rest. It then writes the pose it wants for whatever he is doing (vehicles.js does too while he
// rides). finishKeloPose() treats what was written as a target, eases the real joints toward it so
// nothing snaps, and layers the walk cycle, idle life and any emote on top.

const keloAnim = {
  mode: 'other',   // 'walk', 'idle', 'dig', 'weld' or 'other', set by scene.js each frame
  rate: 1,         // how snappy this frame's pose is; quick actions like a dig swing turn it up
  lastT: null,
  dt: 1 / 60,
  base: null,      // the smoothed pose, one number per channel
  yaw: null,
  groupX: 0,
  groupZ: 0,
  speed: 0,        // how fast he is really moving over the ground (units per second)
  phase: 0,        // where he is in the walk cycle
  walkW: 0,        // how much of the walk cycle is showing (0 standing, 1 walking)
  idleW: 0,
  lookW: 0,
  ramp: 0,         // eases his speed up as he sets off
  look: { x: 0, y: 0, z: 0 },
  lookTarget: { x: 0, y: 0, z: 0 },
  nextLookAt: 0,
  shift: 0,
  shiftTarget: 0,
  nextShiftAt: 0,
  idleSince: 0,
  lastX: null,
  lastZ: null
};

// The emote playing now, if any: { name, start, dur, w }
let keloEmote = null;

// Shoulders, hips, head and upper body, then the joints further down each limb (js/kelo-body.js).
// Elbows and knees bend about x (an elbow forward with a negative angle, a knee back with a positive
// one); hands and feet turn at the wrist and ankle. Feet level themselves unless a pose says otherwise.
const KELO_JOINTS = [
  ['lArm', () => keloLeftArm], ['rArm', () => keloRightArm],
  ['lLeg', () => keloLeftLeg], ['rLeg', () => keloRightLeg],
  ['head', () => keloHead], ['body', () => keloBody],
  ['lElbow', () => keloLeftElbow], ['rElbow', () => keloRightElbow],
  ['lHand', () => keloLeftHand], ['rHand', () => keloRightHand],
  ['lKnee', () => keloLeftKnee], ['rKnee', () => keloRightKnee],
  ['lFoot', () => keloLeftFoot], ['rFoot', () => keloRightFoot]
];
// Channels an emote may still move while he walks or rides (his legs are busy)
const KELO_UPPER_CHANNELS = /^(lArm|rArm|head|lElbow|rElbow|lHand|rHand|lGrip|rGrip)/;

const clamp01 = x => Math.max(0, Math.min(1, x));
const smoothstep = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
// Frame-rate independent easing: move a fraction of the way toward the target
const dampTo = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
// Frame-rate independent critically damped spring (exact for any dt, so it never blows up on a slow
// frame): returns the new value and velocity. omega is how stiff it is (about 2x a dampTo rate).
const _keloSpring = { x: 0, v: 0 };
function keloSpringTo(x, v, target, omega, dt) {
      if (!(dt > 0) || !isFinite(x)) { _keloSpring.x = isFinite(x) ? x : target; _keloSpring.v = 0; return _keloSpring; }
      const off = x - target, e = Math.exp(-omega * dt), tmp = (v + omega * off) * dt;
      _keloSpring.x = target + (off + tmp) * e;
      _keloSpring.v = (v - omega * tmp) * e;
      return _keloSpring;
    }

// Start of Kelo-1's part of the frame: work out the frame time and put every joint at rest
function beginKeloPose(t) {
      keloAnim.dt = keloAnim.lastT === null ? 1 / 60 : Math.max(0, Math.min(0.1, t - keloAnim.lastT));
      keloAnim.lastT = t;
      keloAnim.mode = 'other';
      keloAnim.rate = 1;
      // Anything scene.js doesn't set this frame stays where it was (without an emote's spin)
      if (keloGroup && keloAnim.yaw !== null) keloGroup.rotation.set(keloAnim.groupX, keloAnim.yaw, keloAnim.groupZ);
      if (keloBody) {
        KELO_JOINTS.forEach(([, get]) => get().rotation.set(0, 0, 0));
        keloBody.position.set(0, KELO_HIP_Y, 0);
        keloLeftHand.userData.grip = KELO_REST_GRIP;
        keloRightHand.userData.grip = KELO_REST_GRIP;
      }
      return keloAnim.dt;
    }

// Bend his knees into a squat that lowers his hips by `drop`, feet staying under him. Returns the
// hip angle; the caller lowers keloGroup by the same drop.
function keloSquat(drop, lean = 0) {
      const a = Math.acos(Math.max(0.2, 1 - Math.max(0, drop) / (KELO_THIGH + KELO_SHIN)));
      keloLeftLeg.rotation.x = keloRightLeg.rotation.x = -a - lean;
      keloLeftKnee.rotation.x = keloRightKnee.rotation.x = 2 * a;
      return a;
    }

// Sit with his thighs level and his shins hanging down (vehicle seats, a ledge). Returns how far
// to lower keloGroup so the underside of his thighs rests `seatAbove` above where his feet would be.
function keloSitPose(seatAbove, kneeBend = 1.35) {
      keloLeftLeg.rotation.x = keloRightLeg.rotation.x = -1.45;
      keloLeftKnee.rotation.x = keloRightKnee.rotation.x = kneeBend;
      return KELO_LEG_Y - KELO_THIGH_R - seatAbove;
    }

// For sitting on the ground: with his hips hipH above the ground and thighs raised to hip angle a
// (more negative is higher), how far his knees must bend for his feet to rest flat on the ground
function keloSitKnee(a, hipH) {
      const ankleY = KELO_LEG_Y - KELO_THIGH - KELO_SHIN;
      const kneeY = hipH - KELO_THIGH * Math.cos(a);
      const shin = Math.acos(Math.max(-1, Math.min(1, (kneeY - ankleY) / KELO_SHIN)));
      return -a - shin;
    }

// --- Action poses, called by scene.js -------------------------------------------------------

// Digging: the clip comes from the tool in his hands (shovel, pickaxe, axe, rake, trowel, jackhammer;
// the built-in core drill with none), js/kelo-clips.js
function keloDigPose(t) {
      keloAnim.mode = 'dig';
      const holding = typeof carriedObject !== 'undefined' && carriedObject;
      keloAction(keloDigActFor(holding ? carriedObject : null));
    }

// Welding: lean in, the torch walks small circles along the seam, the other hand steadies the work;
// now and then he lifts the torch and leans back to look at it. Returns whether the torch is lit.
function keloWeldPose(t) {
      keloAnim.mode = 'weld';
      keloAction('weld');
      return keloClipValue('lit', 0) > 0.5;
    }

// --- Emotes ---------------------------------------------------------------------------------
// Each one returns the channels it moves, given seconds since it started (e) and seconds left (r).
// Channels: <joint>X/Y/Z for lArm, rArm, lLeg, rLeg, head, body; bodyLift and bodyShift move his
// upper body; lift raises his whole body; yaw turns him around.
// Hip angle for a squat that lowers him by `drop` (the knee bends twice as far)
const squatAngle = drop => Math.acos(Math.max(0.2, 1 - Math.max(0, drop) / (KELO_THIGH + KELO_SHIN)));

const KELO_EMOTES = {
  // wave, think, celebrate and sit are hand-keyed clips (js/kelo-clips.js)
  wave: { ms: 2400, pose: (e, r) => keloActPose('greet', e, r) },
  cheer: {
    ms: 2600,
    pose(e) {
      const p = { lArmZ: -2.85, rArmZ: 2.85, lArmX: 0, rArmX: 0, lElbowX: -0.15, rElbowX: -0.15, lGrip: 1, rGrip: 1, headX: -0.2 };
      if (e < 2.0) {
        const u = e % 1.0;   // each jump starts in a crouch
        if (u < 0.3) {
          const k = smoothstep(u / 0.3), a = squatAngle(0.14 * k);
          Object.assign(p, { lift: -0.14 * k, bodyX: 0.22 * k, lArmZ: -0.3, rArmZ: 0.3, lArmX: 0.45 * k, rArmX: 0.45 * k, lElbowX: -0.5 * k, rElbowX: -0.5 * k,
            lLegX: -a, rLegX: -a, lKneeX: 2 * a, rKneeX: 2 * a, headX: 0.1 });
        } else if (u < 0.75) {
          const k = (u - 0.3) / 0.45;
          // in the air his knees tuck up a little and his toes point down
          Object.assign(p, { lift: 0.75 * Math.sin(Math.PI * k), bodyX: -0.08, lLegX: -0.35, rLegX: 0.15, lKneeX: 0.7, rKneeX: 0.35, lFootX: 0.5, rFootX: 0.4 });
        } else {
          const k = (u - 0.75) / 0.25, a = squatAngle(0.1 * Math.sin(Math.PI * k));
          Object.assign(p, { lift: -0.1 * Math.sin(Math.PI * k), bodyX: 0.12 * Math.sin(Math.PI * k), lLegX: -a, rLegX: -a, lKneeX: 2 * a, rKneeX: 2 * a });
        }
      } else {
        p.lArmZ += Math.sin(e * 16) * 0.12;
        p.rArmZ -= Math.sin(e * 16) * 0.12;
      }
      return p;
    }
  },
  dance: {
    ms: 6000,
    pose(e) {
      const ph = e * Math.PI * 2 * 1.1;
      const s = Math.sin(ph);
      const bob = Math.abs(s);
      const a = squatAngle(0.1 * (1 - bob));
      return {
        bodyZ: s * 0.14, bodyY: Math.sin(ph * 0.5) * 0.35, bodyShift: s * 0.08, lift: bob * 0.12 - 0.1 * (1 - bob),
        lArmX: -0.7 + s * 0.45, rArmX: -0.7 - s * 0.45, lArmZ: -0.45 + Math.cos(ph) * 0.25, rArmZ: 0.45 + Math.cos(ph) * 0.25,
        lElbowX: -1.2 - s * 0.3, rElbowX: -1.2 + s * 0.3, lGrip: 0.8, rGrip: 0.8,
        lLegX: -a + Math.max(0, s) * -0.45, rLegX: -a + Math.max(0, -s) * -0.45,
        lKneeX: 2 * a + Math.max(0, s) * 0.7, rKneeX: 2 * a + Math.max(0, -s) * 0.7,
        headZ: -s * 0.15, headX: Math.sin(ph * 2) * 0.1, headY: Math.sin(ph * 0.5) * -0.2
      };
    }
  },
  think: { ms: 4000, pose: (e, r) => keloActPose('think', e, r) },
  stretch: {
    ms: 3600,
    pose(e) {
      const up = smoothstep(e / 0.9) * (1 - smoothstep((e - 2.7) / 0.8));
      const side = e > 1.2 && e < 2.7 ? Math.sin((e - 1.2) / 1.5 * Math.PI * 2) * 0.25 : 0;
      return {
        lArmZ: -2.95 * up - 0.15, rArmZ: 2.95 * up + 0.15, lArmX: 0, rArmX: 0,
        lElbowX: 0.1 * up, rElbowX: 0.1 * up, lGrip: 0.3 - 0.3 * up, rGrip: 0.3 - 0.3 * up, lHandZ: -0.4 * up, rHandZ: 0.4 * up,
        bodyX: -0.16 * up, bodyZ: side, lift: 0.05 * up, lFootX: 0.25 * up, rFootX: 0.25 * up, headX: -0.3 * up, headZ: -side * 0.5
      };
    }
  },
  shiver: {
    ms: 3500,
    pose(e) {
      const tremble = Math.sin(e * 48);
      const rub = Math.sin(e * 9) * 0.1;
      // Arms wrapped around himself, rubbing his upper arms
      return {
        lArmX: -0.75 + rub, lArmY: 0.6, lArmZ: 0.45, rArmX: -0.75 - rub, rArmY: -0.6, rArmZ: -0.45,
        lElbowX: -1.75, rElbowX: -1.75, lHandY: 0.4, rHandY: -0.4, lGrip: 0.45, rGrip: 0.45,
        bodyZ: tremble * 0.035, bodyX: 0.1, bodyLift: -0.04, headX: 0.22, headY: tremble * 0.05,
        lLegZ: 0.06, rLegZ: -0.06, lKneeX: 0.12, rKneeX: 0.12
      };
    }
  },
  sit: { ms: 8000, pose: (e, r) => keloActPose('sitGround', e, r) },
  celebrate: { ms: 3500, pose: (e, r) => keloActPose('celebrate', e, r) }
};

// Play an emote by name ('wave', 'cheer', 'dance', 'think', 'stretch', 'shiver', 'sit', 'celebrate').
// Returns false for an unknown name. While walking or riding only his arms and head join in.
function playEmote(name, durationMs) {
      const key = String(name || '').toLowerCase().trim().replace(/^sit[ _-]?down$/, 'sit').replace(/^jump$/, 'cheer');
      const emote = KELO_EMOTES[key];
      if (!emote) return false;
      const now = keloAnim.lastT || 0;
      const dur = Math.max(0.6, Math.min(20, (Number(durationMs) || emote.ms) / 1000));
      keloEmote = { name: key, start: now, dur, w: keloEmote ? keloEmote.w : 0 };
      return true;
    }

// --- The blend, every frame -----------------------------------------------------------------

const _keloHandL = new THREE.Vector3(), _keloHandR = new THREE.Vector3(), _keloGrip = new THREE.Vector3();

// How big a carried thing is, measured once in its own upright position (keloGroup's turn aside)
function keloCarrySize(obj) {
      if (obj.userData.carrySize) return obj.userData.carrySize;
      const r = keloGroup.rotation.clone();
      keloGroup.rotation.set(0, 0, 0);
      keloGroup.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj);
      keloGroup.rotation.copy(r);
      keloGroup.updateMatrixWorld(true);
      const size = box.isEmpty() ? new THREE.Vector3(0.4, 0.4, 0.4) : box.getSize(new THREE.Vector3());
      obj.userData.carrySize = size;
      return size;
    }

// One leg at a time steps from the pose he stopped in to standing under him, the other planted
function keloSettleStep(a, out, dt) {
      const S = a.settle;
      const away = P => Math.abs(P.hip) > 0.012 || Math.abs(P.knee) > 0.03 || Math.abs(P.foot) > 0.03;
      if (!S.step) {
        let side = S.first && away(S[S.first]) ? S.first : null;
        if (!side) side = away(S.L) || away(S.R) ? (Math.abs(S.L.hip) + S.L.knee * 0.3 >= Math.abs(S.R.hip) + S.R.knee * 0.3 ? 'L' : 'R') : null;
        if (side && !away(S[side])) side = side === 'L' ? 'R' : 'L';
        S.first = null;
        if (!side) { a.settle = null; return; }
        const from = { ...S[side] }, reach = clamp01(Math.abs(from.hip) / 0.3);
        S.step = { side, from, t: 0, dur: keloMcStopStep(0).dur * (0.7 + 0.4 * reach), lift: 0.75 + 0.45 * reach };
      }
      const st = S.step;
      st.t += dt;
      // The foot lifts clear and travels home along the path the last step of a real stop takes
      // (motion capture, js/kelo-mocap.js): the knee folds, the thigh comes forward a little
      const M = keloMcStopStep(st.t / st.dur), P = S[st.side];
      P.hip = st.from.hip * (1 - M.w) + M.hip * st.lift;
      P.knee = st.from.knee * (1 - M.w) + Math.max(M.knee * st.lift, 0.3 * st.lift * Math.sin(Math.PI * clamp01(st.t / st.dur)));
      P.foot = st.from.foot * (1 - M.w);
      if (st.t >= st.dur) { S[st.side] = { hip: 0, knee: 0, foot: 0 }; S.step = null; }
      out.lLegX += S.L.hip; out.lKneeX += S.L.knee; out.lFootX += S.L.foot;
      out.rLegX += S.R.hip; out.rKneeX += S.R.knee; out.rFootX += S.R.foot;
    }

function finishKeloPose(t) {
      if (!keloBody) return;
      const a = keloAnim, dt = a.dt;
      const riding = Boolean(state.riding);
      const walking = state.isWalking && !riding;
      const resting = !state.isWalking && (state.microPose === 'collapsed' || state.currentLocKey === 'bed');
      const holding = typeof carriedObject !== 'undefined' && carriedObject && carriedObject.parent === keloGroup;
      if (!state.isWalking) a.ramp = 0;

      // Carrying something: forearms out in front, hands gripping it from the sides
      if (holding && !riding && (a.mode === 'walk' || a.mode === 'idle')) {
        const size = keloCarrySize(carriedObject);
        const reach = Math.max(-0.35, Math.min(0.12, (Math.min(size.x, 0.9) / 2 + 0.03 - KELO_SHOULDER.x) / ((KELO_UPPER_ARM + KELO_FOREARM) * 0.75)));
        keloLeftArm.rotation.set(-0.38, 0, -Math.asin(reach));
        keloRightArm.rotation.set(-0.38, 0, Math.asin(reach));
        keloLeftElbow.rotation.x = keloRightElbow.rotation.x = -1.05;
        keloLeftHand.userData.grip = keloRightHand.userData.grip = 0.75;
      }

      // Read what was written as the target and ease toward it
      const target = {};
      KELO_JOINTS.forEach(([name, get]) => {
        const r = get().rotation;
        target[name + 'X'] = r.x; target[name + 'Y'] = r.y; target[name + 'Z'] = r.z;
      });
      target.lGrip = keloLeftHand.userData.grip;
      target.rGrip = keloRightHand.userData.grip;
      target.bodyLift = keloBody.position.y - KELO_HIP_Y;
      target.bodyShift = keloBody.position.x;
      // Relaxed joints are never quite straight: elbows and knees a touch bent, arms clear of his sides
      target.lElbowX -= 0.16; target.rElbowX -= 0.16;
      target.lArmZ -= 0.1; target.rArmZ += 0.1;
      target.lKneeX += 0.04; target.rKneeX += 0.04;
      if (!a.base) { a.base = { ...target }; a.vel = {}; }
      const out = {};
      for (const ch in target) {
        const rate = (/^(lLeg|rLeg|lKnee|rKnee|lFoot|rFoot)/.test(ch) ? 12 : /^body/.test(ch) ? 8 : 10) * a.rate;
        // A critically damped spring rather than a plain ease: a new pose starts moving gently
        // (no kink at the start of a blend, e.g. walk to sit, idle to dig) and settles without
        // overshoot. 2x the rate keeps the same overall timing as the old ease.
        const v = keloSpringTo(a.base[ch], a.vel[ch] || 0, target[ch], 2 * rate, dt);
        a.base[ch] = v.x;
        a.vel[ch] = v.v;
        out[ch] = a.base[ch];
      }
      out.lift = 0;
      out.yaw = 0;
      // --- Hand-keyed action clips (js/kelo-clips.js): sitting, sleeping, digging, welding, eating...
      if (typeof keloClipLayer === 'function') keloClipLayer(out, t, dt, { walking, riding, resting, holding });

      // His whole-body tilt (falling asleep, stumbling) and turning to face where he goes
      const g = keloGroup.rotation;
      a.groupX = dampTo(a.groupX, g.x, resting ? 4 : 9, dt);
      a.groupZ = dampTo(a.groupZ, g.z, 8, dt);
      // Walking, js/motion.js already eases his heading; standing, a new way to face is turned
      // toward at an eased, limited rate (he shuffles his feet round for a big one, below)
      const locoOn = walking && typeof keloMotion !== 'undefined' && t - keloMotion.lastCall < 0.2;
      if (a.yaw === null || riding) { a.yaw = g.y; a.yawVel = 0; }
      else if (locoOn) { a.yaw = g.y; a.yawVel = keloMotion.yawRate; }
      else if (!keloMcTurnYaw(a, g.y, dt, !riding && !resting && (a.mode === 'idle' || a.mode === 'walk') && (!walking || a.speed < 0.3))) {
        // (a big new way to face is stepped round to with the turn clip, js/kelo-mocap.js)
        const err = Math.atan2(Math.sin(g.y - a.yaw), Math.cos(g.y - a.yaw));
        const wantVel = Math.max(-4.5, Math.min(4.5, err * 7));
        a.yawVel = (a.yawVel || 0) + Math.max(-28 * dt, Math.min(28 * dt, wantVel - (a.yawVel || 0)));
        let turn = a.yawVel * dt;
        if (Math.abs(turn) >= Math.abs(err) && Math.sign(turn) === Math.sign(err)) { turn = err; a.yawVel = 0; }
        a.yaw += turn;
      }
      a.turnErr = Math.atan2(Math.sin(g.y - a.yaw), Math.cos(g.y - a.yaw));

      // How fast he really moves over the ground drives the walk cycle, so his feet keep up
      const p = state.botPos;
      let raw = 0;
      if (a.lastX !== null && dt > 0) raw = Math.hypot(p.x - a.lastX, p.z - a.lastZ) / dt;
      if (raw > 30) raw = 0;  // a jump to a new place, not a step
      a.lastX = p.x; a.lastZ = p.z;
      a.speed = locoOn ? dampTo(a.speed, keloMotion.speed, 30, dt) : dampTo(a.speed, walking ? raw : 0, walking ? 16 : 30, dt);
      a.walkW = dampTo(a.walkW, walking ? 1 : 0, 8, dt);

      // --- Walking and running, from motion capture (js/kelo-mocap.js): the stroll, walk and run
      // cycles blended by his real speed, with the cadence and stride matched to it so his feet
      // don't skate; the start clip as he sets off; and turning on the spot, he steps round.
      const v = a.speed;
      const onFeet = !riding && !resting && (a.mode === 'idle' || a.mode === 'walk');
      const shuffle = keloMcTurnStep(a, dt, locoOn, onFeet, walking, v);
      const cycW = a.walkW * clamp01(v / 0.2);
      const act = Math.max(cycW, shuffle);
      const wasCyc = a.cycW || 0;
      a.stepAct = act;
      a.cycW = cycW;
      // Stopping: once his body stops over the ground (or he stops walking), the legs don't fade back
      // to standing while the root is still (that drags the planted foot along the ground). The leg
      // pose he stopped in is held, and each leg that isn't under him steps home in turn: the one in
      // the air first, then the other, lifting its foot (keloSettleStep). Moving again blends it out.
      const rootStill = !walking || v < 0.08;
      if (a.settle && (shuffle > 0.05 || (walking && v > 0.15) || !onFeet)) { a.settleFade = { ...a.settle, k: 1 }; a.settle = null; }
      if (!a.settle && rootStill && onFeet && shuffle < 0.01 && a.legHold && a.legHold.act > 0.02) {
        a.settle = { L: { ...a.legHold.L }, R: { ...a.legHold.R }, first: a.legHold.swing, step: null, t: 0 };
        a.settleFade = null;
      }
      if (act <= 0.001 || a.settle || shuffle > 0.3) a.legHold = null;
      a.stepLift = 0;
      if (act <= 0.001) { a.ikPhase = null; a.mcStart = null; }
      // setting off from standing still
      if (walking && onFeet && wasCyc < 0.05 && cycW > 0 && !a.mcStart && (shuffle < 0.05 || (a.turn && a.turn.end))) keloMcStartOff(a);
      if (act > 0.001) {
        const yawRate = locoOn ? keloMotion.yawRate : (a.yawVel || 0) * (shuffle > 0.05 ? 0 : 1);
        const P = keloMcPose(a, dt, v, cycW, shuffle, walking, yawRate), I = keloMcI;
        if (!a.settle) {
          out.lLegX += P[I.lLegX]; out.rLegX += P[I.rLegX];
          out.lLegZ += P[I.lLegZ]; out.rLegZ += P[I.rLegZ];
          out.lKneeX += P[I.lKneeX]; out.rKneeX += P[I.rKneeX];
          out.lFootX += P[I.lFootX]; out.rFootX += P[I.rFootX];
          out.lift += P[I.lift];
          a.stepLift = P[I.lift];   // (js/eyecam.js takes it back out)
          const ph = a.ikPhase;
          if (shuffle <= 0.3) a.legHold = { act, swing: ph.uL >= ph.sf ? 'L' : ph.uR >= ph.sf ? 'R' : null,
            L: { hip: P[I.lLegX], knee: P[I.lKneeX], foot: P[I.lFootX] }, R: { hip: P[I.rLegX], knee: P[I.rKneeX], foot: P[I.rFootX] } };
        }
        // Arms swing as captured, but yield to carrying (forearms out holding it) and to a tool
        const holdingTool = (keloDrillToolGroup && keloDrillToolGroup.visible) || (keloWeldTorchGroup && keloWeldTorchGroup.visible);
        const armL = holding ? 0.1 : 1, armR = holding ? 0.1 : holdingTool ? 0.3 : 1;
        out.lArmX += P[I.lArmX] * armL; out.rArmX += P[I.rArmX] * armR;
        out.lArmZ += P[I.lArmZ] * armL; out.rArmZ += P[I.rArmZ] * armR;
        out.lElbowX += P[I.lElbowX] * armL; out.rElbowX += P[I.rElbowX] * armR;
        // His body as captured (lean, the shoulders turning against the hips, weight over the planted
        // foot), plus leaning into speeding up and into turns
        const accLean = locoOn ? Math.max(-0.05, Math.min(0.06, keloMotion.acc * 0.012)) : 0;
        const turnLean = locoOn ? Math.max(-0.08, Math.min(0.08, keloMotion.yawRate * v * 0.008)) : 0;
        const lean = P[I.bodyX] + accLean;
        out.bodyX += lean;
        out.bodyY += P[I.bodyY];
        out.bodyZ += P[I.bodyZ] - turnLean;
        out.bodyShift += P[I.shift];
        // Head stays level while the body moves under it
        out.headX -= lean * 0.75;
        out.headY -= P[I.bodyY] * 0.85;
        out.headZ -= (P[I.bodyZ] - turnLean) * 0.8;
      }

      if (a.settle) keloSettleStep(a, out, dt);
      if (a.settleFade) {
        const F = a.settleFade;
        F.k *= Math.exp(-12 * dt);
        out.lLegX += F.L.hip * F.k; out.lKneeX += F.L.knee * F.k; out.lFootX += F.L.foot * F.k;
        out.rLegX += F.R.hip * F.k; out.rKneeX += F.R.knee * F.k; out.rFootX += F.R.foot * F.k;
        if (F.k < 0.01) a.settleFade = null;
      }

      // --- Breathing, always (slower when he sleeps)
      const breathRate = resting ? 1.1 : 1.8;
      const b = Math.sin(t * breathRate);
      out.bodyLift += 0.014 * b;
      out.bodyX -= 0.01 * b;
      out.lArmZ -= 0.02 * (1 + b);
      out.rArmZ += 0.02 * (1 + b);
      out.headX += 0.012 * b;

      // --- Standing around: looking about now and then, and shifting his weight
      const idle = a.mode === 'idle' && !walking && !(typeof keloClipActive === 'function' && keloClipActive());
      a.idleW = dampTo(a.idleW, idle ? 1 : 0, 3, dt);
      a.lookW = dampTo(a.lookW, idle || riding ? 1 : 0, 3, dt);
      if (a.lookW > 0.01 && t > a.nextLookAt) {
        const wide = riding ? 0.5 : 0.75;
        a.lookTarget = Math.random() < 0.35 ? { x: 0, y: 0, z: 0 }
          : { x: -0.2 + Math.random() * 0.35, y: (Math.random() * 2 - 1) * wide, z: (Math.random() * 2 - 1) * 0.12 };
        a.nextLookAt = t + 2.5 + Math.random() * 4.5;
      }
      ['x', 'y', 'z'].forEach(ax => { a.look[ax] = dampTo(a.look[ax], a.lookTarget[ax], 3.5, dt); });
      out.headX += a.look.x * a.lookW;
      out.headY += a.look.y * a.lookW;
      out.headZ += a.look.z * a.lookW;
      out.bodyY += a.look.y * 0.15 * a.idleW;   // a big look turns his shoulders a little too
      if (a.idleW > 0.01 && t > a.nextShiftAt) {
        a.shiftTarget = [-1, 0, 1][Math.floor(Math.random() * 3)];
        a.nextShiftAt = t + 3 + Math.random() * 5;
      }
      a.shift = dampTo(a.shift, a.shiftTarget, 1.8, dt);
      const sh = a.shift * a.idleW;
      out.bodyShift += sh * 0.04;
      out.bodyZ += sh * 0.03;
      // The leg without his weight on it relaxes: the hip comes forward and the knee bends twice as
      // much (0.12 of it in js/humanize.js), which leaves that foot where it stands (thigh and shin
      // are about the same length)
      out.lLegX -= Math.max(0, sh) * 0.08;
      out.rLegX -= Math.max(0, -sh) * 0.08;
      out.lKneeX += Math.max(0, sh) * 0.04;
      out.rKneeX += Math.max(0, -sh) * 0.04;
      out.bodyLift -= Math.abs(sh) * 0.015;   // (his hips settle; his feet stay on the ground)
      // A long time standing still: sometimes he stretches or stops to think
      if (idle && !keloEmote) {
        if (!a.idleSince) a.idleSince = t;
        if (t - a.idleSince > 25 && Math.random() < dt * 0.03) {
          playEmote(Math.random() < 0.5 ? 'stretch' : 'think');
          a.idleSince = t;
        }
      } else if (!idle) {
        a.idleSince = 0;
      }

      // --- Riding: small steering movements
      if (riding) {
        out.lArmX += Math.sin(t * 1.1) * 0.05;
        out.rArmX -= Math.sin(t * 1.1) * 0.05;
        out.bodyZ += Math.sin(t * 0.9) * 0.02;
      }

      // --- Human touches: gaze, the head leading turns, gestures as he talks, fidgets (js/humanize.js)
      if (typeof keloHumanize === 'function') keloHumanize(out, t, dt, { walking, riding, resting, idle, holding, locoOn });

      // --- Emote on top, faded in and out
      if (keloEmote) {
        const em = keloEmote, e = t - em.start, r = em.dur - e;
        const allowed = !resting;
        em.w = dampTo(em.w, allowed && r > 0 ? 1 : 0, r > 0 ? 9 : 7, dt);
        if (r <= 0 && em.w < 0.01) {
          keloEmote = null;
        } else {
          const pose = KELO_EMOTES[em.name].pose(Math.min(e, em.dur), Math.max(0, r));
          const upperOnly = walking || riding;
          for (const ch in pose) {
            if (upperOnly && !KELO_UPPER_CHANNELS.test(ch)) continue;
            out[ch] = (out[ch] || 0) + (pose[ch] - (out[ch] || 0)) * em.w;
          }
        }
      }

      // --- Feet stay level with the ground under him (on top of any heel-and-toe roll)
      if (!resting) {
        out.lFootX -= out.lLegX + out.lKneeX;
        out.rFootX -= out.rLegX + out.rKneeX;
        out.lFootZ -= out.lLegZ;
        out.rFootZ -= out.rLegZ;
      }

      // --- Write it all back
      KELO_JOINTS.forEach(([name, get]) => get().rotation.set(out[name + 'X'], out[name + 'Y'], out[name + 'Z']));
      setKeloGrip(keloLeftHand, out.lGrip);
      setKeloGrip(keloRightHand, out.rGrip);
      // Blinking, his mood on his face, and the bounce of his antenna (js/kelo-body.js)
      if (typeof updateKeloFace === 'function') updateKeloFace(t, dt, resting);
      keloBody.position.set(out.bodyShift, KELO_HIP_Y + out.bodyLift, 0);
      keloGroup.position.y += out.lift;
      keloGroup.rotation.set(a.groupX, a.yaw + out.yaw, a.groupZ);
      // Gliding onto a seat, the bed or into a cab with the clip (js/kelo-clips.js)
      if (typeof keloClipRoot === 'function') keloClipRoot(dt);
      // Sitting, standing and climbing in or out slide instead of popping (js/motion.js)
      if (typeof keloSmoothRoot === 'function') keloSmoothRoot(dt);
      // Feet on the real ground, hands on what he reaches for (js/kelo-ik.js)
      if (typeof keloApplyIK === 'function') keloApplyIK(t, dt, { walking, riding, resting });

      if (holding) keloHoldInHands(riding || resting ? null : a.mode);
      // Things on their way into or out of his hands (js/kelo-handoff.js)
      if (typeof keloHandoffFrame === 'function') keloHandoffFrame(dt);
      if (typeof keloClipEndFrame === 'function') keloClipEndFrame();
    }

// Whatever he carries sits in his hands: held between them while carrying, and gripped like a tool while digging
function keloHoldInHands(mode) {
      const obj = carriedObject;
      const oneHand = typeof keloClip !== 'undefined' && keloClip.hand === 'r';
      if (oneHand) {
        // In his right hand (a paintbrush, a trowel), turned by the clip's tool channels
        keloGroup.updateMatrixWorld(true);
        keloPalmLocal(keloRightHand, _keloHandL);
        if (!obj.userData.gripHeight) obj.userData.gripHeight = Math.max(0.05, keloCarrySize(obj).y * 0.8);
        obj.rotation.set(-0.2 + keloClipValue('tool'), keloClipValue('toolY'), keloClipValue('toolZ'));
        _keloGrip.set(0, obj.userData.gripHeight, 0).applyEuler(obj.rotation);
        obj.position.copy(_keloHandL).sub(_keloGrip);
        return;
      }
      if (mode !== 'dig' && mode !== 'walk' && mode !== 'idle') {
        obj.position.x = 0;
        obj.position.z = 0.62;
        obj.rotation.set(0, 0, 0);
        return;
      }
      keloGroup.updateMatrixWorld(true);
      keloPalmLocal(keloLeftHand, _keloHandL);
      keloPalmLocal(keloRightHand, _keloHandR);
      _keloHandL.add(_keloHandR).multiplyScalar(0.5);
      if (mode === 'dig') {
        // Grip it near the top: the handle sits in his hands and the business end points down
        const frac = typeof keloClip !== 'undefined' && keloClip.cur && keloClip.cur.A.grip || 0.8;
        obj.userData.gripHeight = Math.max(0.2, keloCarrySize(obj).y * frac);
        // (the clip swings it in all three axes: over his shoulder and down for a pickaxe, across and
        // down with a roll for an axe, turned over to tip a shovel's load off to the side)
        const cv = typeof keloClipValue === 'function' ? keloClipValue : () => 0;
        obj.rotation.set(-0.2 + cv('tool'), cv('toolY'), cv('toolZ'));
        _keloGrip.set(0, obj.userData.gripHeight, 0).applyEuler(obj.rotation);
        // a two-handed tool hangs from his right hand; his left hand holds the handle further along it
        // (js/kelo-clips.js keloToolReach puts it there)
        if (typeof keloToolSep === 'function' && keloToolSep() > 0) keloPalmLocal(keloRightHand, _keloHandL);
        obj.position.copy(_keloHandL).sub(_keloGrip);
      } else {
        // Something small or wide sits between his palms; something tall is held a third of the way up
        const h = keloCarrySize(obj).y;
        obj.rotation.set(0, 0, 0);
        obj.position.set(_keloHandL.x, _keloHandL.y - Math.min(h * 0.45, h > 0.9 ? h * 0.33 : 0.3), _keloHandL.z);
      }
    }
