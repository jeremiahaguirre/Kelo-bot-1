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

// How far he walks this frame (before vehicle and snow speed): he eases up to speed as he sets
// off, lengthens into a quicker stride on long trips, and slows for the last step as he arrives
function keloWalkStep(dist, dt) {
      keloAnim.ramp = Math.min(1, keloAnim.ramp + dt / 0.45);
      const cruise = 0.082 + 0.058 * smoothstep((dist - 8) / 8);
      const setOff = 0.3 + 0.7 * smoothstep(keloAnim.ramp);
      const arrive = 0.45 + 0.55 * clamp01(dist / 1.2);
      return cruise * setOff * arrive * dt * 60;
    }

// --- Action poses, called by scene.js -------------------------------------------------------

// Digging. With a hand tool he lifts it and drives it down with his whole body; with the built-in
// core drill he draws back, thrusts in, and rides the vibration before easing off again.
function keloDigPose(t) {
      keloAnim.mode = 'dig';
      keloAnim.rate = 2.2;
      const holding = typeof carriedObject !== 'undefined' && carriedObject;
      if (holding) {
        const u = (t % 1.5) / 1.5;
        let arm, lean, head;
        if (u < 0.42) {          // wind up: lift the tool, lean back
          const k = smoothstep(u / 0.42);
          arm = -0.6 - 1.15 * k; lean = 0.08 - 0.2 * k; head = 0.1 - 0.25 * k;
        } else if (u < 0.52) {   // strike: fast and heavy
          const k = Math.pow((u - 0.42) / 0.1, 2);
          arm = -1.75 + 1.25 * k; lean = -0.12 + 0.44 * k; head = -0.15 + 0.5 * k;
        } else if (u < 0.72) {   // impact: hold it in the ground while it judders
          const j = Math.sin(t * 60) * 0.04 * (1 - (u - 0.52) / 0.2);
          arm = -0.5 + j; lean = 0.32; head = 0.35;
        } else {                 // recover: straighten back up
          const k = smoothstep((u - 0.72) / 0.28);
          arm = -0.5 - 0.1 * k; lean = 0.32 - 0.24 * k; head = 0.35 - 0.25 * k;
        }
        keloLeftArm.rotation.set(arm, 0, 0.2);
        keloRightArm.rotation.set(arm, 0, -0.2);
        // Elbows bend more as the tool comes up, and straighten into the strike
        keloLeftElbow.rotation.x = keloRightElbow.rotation.x = -0.25 + 0.3 * (arm + 0.5);
        keloLeftHand.userData.grip = keloRightHand.userData.grip = 1;
        keloBody.rotation.x = lean;
        keloHead.rotation.x = head;
        // One foot forward, front knee bent to take his weight as he drives it down
        keloLeftLeg.rotation.x = -0.18 - lean * 0.5;
        keloLeftKnee.rotation.x = 0.15 + lean;
        keloRightLeg.rotation.x = 0.18;
        keloRightKnee.rotation.x = 0.1;
        return;
      }
      const u = (t % 1.3) / 1.3;
      let arm, lean;
      if (u < 0.35) {
        const k = smoothstep(u / 0.35);
        arm = -1.0 + 0.15 * k; lean = 0.06 - 0.1 * k;
      } else if (u < 0.45) {
        const k = (u - 0.35) / 0.1;
        arm = -0.85 - 0.6 * k * k; lean = -0.04 + 0.26 * k * k;
      } else if (u < 0.85) {
        arm = -1.45 + Math.sin(t * 24) * 0.08; lean = 0.22;
      } else {
        const k = smoothstep((u - 0.85) / 0.15);
        arm = -1.45 + 0.45 * k; lean = 0.22 - 0.16 * k;
      }
      // the drill runs along his forearm, angled down into the ground in front of him
      keloRightArm.rotation.x = arm * 0.55;
      keloRightElbow.rotation.x = -0.3;
      keloRightHand.userData.grip = 1;
      // the other hand braces on top of the drill
      keloLeftArm.rotation.set(-0.75, 0, 0.3);
      keloLeftElbow.rotation.x = -0.75;
      keloLeftHand.userData.grip = 0.6;
      keloBody.rotation.x = lean;
      keloHead.rotation.set(0.3, 0, Math.sin(t * 4) * 0.08);
      keloLeftLeg.rotation.x = -0.15 - lean * 0.6;
      keloLeftKnee.rotation.x = 0.1 + lean * 1.2;
      keloRightLeg.rotation.x = 0.15;
    }

// Welding: torch held out in small careful circles, the other hand steadying the work, leaning in.
// Every few seconds he lifts the torch and leans back to look at the seam. Returns whether the
// torch is lit (for the sparks).
function keloWeldPose(t) {
      keloAnim.mode = 'weld';
      keloAnim.rate = 1.5;
      const u = (t % 5.5) / 5.5;
      const inspecting = u > 0.78;
      keloRightHand.userData.grip = 1;
      if (inspecting) {
        keloRightArm.rotation.set(-0.75, 0, 0.1);
        keloRightElbow.rotation.x = -0.9;
        keloLeftArm.rotation.set(-0.3, 0, 0.1);
        keloLeftElbow.rotation.x = -0.4;
        keloBody.rotation.x = -0.02;
        keloHead.rotation.set(0.12, 0.25, -0.15);
      } else {
        keloRightArm.rotation.set(-Math.PI / 2.4 + Math.sin(t * 3) * 0.06 + Math.sin(t * 31) * 0.015, 0, -0.12 + Math.cos(t * 3) * 0.05);
        keloRightElbow.rotation.x = -0.45;
        keloLeftArm.rotation.set(-0.85, 0, 0.3);
        keloLeftElbow.rotation.x = -0.6;
        keloLeftHand.userData.grip = 0.15;
        keloBody.rotation.x = 0.16;
        keloHead.rotation.set(0.28, 0, 0.1 * Math.sin(t * 1.5));
      }
      keloLeftLeg.rotation.x = -0.12;
      keloLeftKnee.rotation.x = 0.12;
      keloRightLeg.rotation.x = 0.12;
      return !inspecting;
    }

// --- Emotes ---------------------------------------------------------------------------------
// Each one returns the channels it moves, given seconds since it started (e) and seconds left (r).
// Channels: <joint>X/Y/Z for lArm, rArm, lLeg, rLeg, head, body; bodyLift and bodyShift move his
// upper body; lift raises his whole body; yaw turns him around.
// Hip angle for a squat that lowers him by `drop` (the knee bends twice as far)
const squatAngle = drop => Math.acos(Math.max(0.2, 1 - Math.max(0, drop) / (KELO_THIGH + KELO_SHIN)));

const KELO_EMOTES = {
  wave: {
    ms: 2400,
    pose(e) {
      const up = smoothstep(e / 0.3);
      const swing = smoothstep((e - 0.25) / 0.3) * Math.sin(e * 9);
      // Upper arm out to the side, forearm up, open palm turned to face you, waving from the elbow
      return {
        rArmX: -0.2, rArmY: 0, rArmZ: 1.3 * up, rElbowX: 0.1 * up, rElbowZ: (1.3 + swing * 0.32) * up,
        rHandY: 1.5 * up, rHandZ: swing * 0.15, rGrip: 0,
        lArmZ: -0.08, headX: -0.08, headZ: -0.12 + swing * 0.04, bodyZ: 0.05
      };
    }
  },
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
  think: {
    ms: 4000,
    pose(e) {
      const tap = smoothstep((e - 1.0) / 0.4) * Math.sin(e * 5) * 0.05;
      // Right hand up to his chin, the other arm folded across his middle under that elbow
      return {
        rArmX: -0.8, rArmY: 0, rArmZ: -1.45, rElbowX: -1.84 + tap, rHandX: 0.2, rHandY: 0.4, rGrip: 0.65,
        lArmX: -0.15, lArmY: 1.0, lArmZ: 0.15, lElbowX: -1.5, lHandY: -0.3, lGrip: 0.5,
        headX: -0.12, headZ: 0.14, headY: 0.15 + Math.sin(e * 0.8) * 0.12, bodyZ: 0.02, bodyX: -0.03
      };
    }
  },
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
  sit: {
    ms: 8000,
    pose(e, r) {
      const s = smoothstep(Math.min(e, r) / 0.9);   // sitting down at the start, getting up at the end
      const lean = 0.35 * Math.sin(Math.PI * s) + 0.12 * s;  // leans forward on the way down and up
      // Down on the ground, knees up, forearms resting on his knees
      return {
        lift: -(KELO_LEG_Y - 0.22) * s, lLegX: -2.15 * s, rLegX: -2.15 * s, lLegZ: -0.12 * s, rLegZ: 0.12 * s,
        lKneeX: keloSitKnee(-2.15, 0.22) * s, rKneeX: keloSitKnee(-2.15, 0.22) * s,
        bodyX: lean, lArmX: -0.75 * s, rArmX: -0.75 * s, lArmZ: -0.12 * s, rArmZ: 0.12 * s, lElbowX: -0.5 * s, rElbowX: -0.5 * s,
        headY: Math.sin(e * 0.6) * 0.3 * s, headX: -0.15 * s
      };
    }
  },
  celebrate: {
    ms: 3500,
    pose(e) {
      if (e < 0.25) {
        const k = smoothstep(e / 0.25), a = squatAngle(0.12 * k);
        return { lift: -0.12 * k, bodyX: 0.2 * k, lArmX: 0.4 * k, rArmX: 0.4 * k, lElbowX: -0.6 * k, rElbowX: -0.6 * k, lLegX: -a, rLegX: -a, lKneeX: 2 * a, rKneeX: 2 * a, lGrip: 1, rGrip: 1 };
      }
      if (e < 0.85) {
        const k = (e - 0.25) / 0.6;
        return { lift: 0.65 * Math.sin(Math.PI * k), yaw: Math.PI * 2 * smoothstep(k), lArmZ: -2.8, rArmZ: 2.8, lArmX: 0, rArmX: 0, lGrip: 0, rGrip: 0,
          lLegX: -0.3, rLegX: 0.1, lKneeX: 0.8, rKneeX: 0.3, lFootX: 0.4, rFootX: 0.4, headX: -0.2 };
      }
      const pump = Math.sin(e * 9);
      return {
        lift: Math.abs(Math.sin(e * 4.5)) * 0.08, bodyZ: Math.sin(e * 4.5) * 0.05, headX: -0.2,
        rArmX: -0.1, rArmZ: 2.5 + Math.max(0, pump) * 0.4, lArmX: -0.1, lArmZ: -2.5 - Math.max(0, -pump) * 0.4,
        rElbowX: -0.3 - Math.max(0, -pump) * 0.6, lElbowX: -0.3 - Math.max(0, pump) * 0.6, lGrip: 1, rGrip: 1
      };
    }
  }
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
      if (!a.base) a.base = { ...target };
      const out = {};
      for (const ch in target) {
        const rate = (/^(lLeg|rLeg|lKnee|rKnee|lFoot|rFoot)/.test(ch) ? 12 : /^body/.test(ch) ? 8 : 10) * a.rate;
        a.base[ch] = dampTo(a.base[ch], target[ch], rate, dt);
        out[ch] = a.base[ch];
      }
      out.lift = 0;
      out.yaw = 0;

      // His whole-body tilt (falling asleep, stumbling) and turning to face where he goes
      const g = keloGroup.rotation;
      a.groupX = dampTo(a.groupX, g.x, resting ? 4 : 9, dt);
      a.groupZ = dampTo(a.groupZ, g.z, 8, dt);
      if (a.yaw === null || riding) a.yaw = g.y;
      else a.yaw += Math.atan2(Math.sin(g.y - a.yaw), Math.cos(g.y - a.yaw)) * (1 - Math.exp(-9 * dt));

      // How fast he really moves over the ground drives the walk cycle, so his feet keep up
      const p = state.botPos;
      let raw = 0;
      if (a.lastX !== null && dt > 0) raw = Math.hypot(p.x - a.lastX, p.z - a.lastZ) / dt;
      if (raw > 30) raw = 0;  // a jump to a new place, not a step
      a.lastX = p.x; a.lastZ = p.z;
      a.speed = dampTo(a.speed, walking ? raw : 0, 8, dt);
      a.walkW = dampTo(a.walkW, walking ? 1 : 0, 6, dt);

      // --- Walk cycle
      const k = a.walkW * clamp01(a.speed / 2);
      if (k > 0.001) {
        const run = smoothstep((a.speed - 5.5) / 3);
        a.phase += Math.PI * 2 * a.speed / (2.6 + run) * dt;
        const s = Math.sin(a.phase), c = Math.cos(a.phase);
        const armS = Math.sin(a.phase - 0.25);  // arms trail the legs a little
        const legA = 0.5 + 0.3 * run, armA = 0.42 + 0.3 * run;
        const holdingTool = (keloDrillToolGroup && keloDrillToolGroup.visible) || (keloWeldTorchGroup && keloWeldTorchGroup.visible);
        const armL = holding ? 0.1 : 1, armR = holding ? 0.1 : holdingTool ? 0.3 : 1;
        out.lLegX += k * legA * s;
        out.rLegX -= k * legA * s;
        // Each knee folds as its leg swings through, and gives a little as the foot lands
        const swingL = Math.max(0, -c), swingR = Math.max(0, c);
        out.lKneeX += k * (0.1 + (0.85 + 0.45 * run) * swingL * swingL + 0.12 * Math.max(0, -s) * (1 - swingL));
        out.rKneeX += k * (0.1 + (0.85 + 0.45 * run) * swingR * swingR + 0.12 * Math.max(0, s) * (1 - swingR));
        // Heel strikes with the toes up; the back foot rolls onto its toes as it pushes off
        out.lFootX += k * (-0.18 * Math.max(0, -s) + 0.3 * Math.max(0, s) * (1 - swingL));
        out.rFootX += k * (-0.18 * Math.max(0, s) + 0.3 * Math.max(0, -s) * (1 - swingR));
        out.lArmX -= k * armA * armS * armL;
        out.rArmX += k * armA * armS * armR;
        // Elbows bend more as each arm swings forward
        out.lElbowX -= k * (0.12 + 0.3 * Math.max(0, armS) + 0.25 * run) * armL;
        out.rElbowX -= k * (0.12 + 0.3 * Math.max(0, -armS) + 0.25 * run) * armR;
        out.lArmZ -= k * 0.06 * armL;
        out.rArmZ += k * 0.06 * armR;
        // Up at the passing step, down as each foot lands; lean into the walk, more when running
        out.lift += k * (0.05 + 0.05 * run) * (1 - Math.abs(s));
        const lean = 0.07 + 0.1 * run + 0.025 * Math.cos(a.phase * 2);
        out.bodyX += k * lean;
        out.bodyY += k * s * (0.09 + 0.05 * run);   // shoulders turn with the arms
        out.bodyZ += k * c * 0.045;                 // weight rolls over the planted foot
        out.bodyShift += k * c * 0.035;
        // Head stays level and looking ahead while the body moves under it
        out.headX -= k * lean * 0.75;
        out.headY -= k * s * (0.09 + 0.05 * run) * 0.85;
        out.headZ -= k * c * 0.045 * 0.8;
        out.headY += k * Math.sin(t * 0.55) * 0.1;
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
      const idle = a.mode === 'idle' && !walking;
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
      out.lLegX -= Math.max(0, sh) * 0.08;    // the leg without his weight on it relaxes
      out.rLegX -= Math.max(0, -sh) * 0.08;
      out.lift -= Math.abs(sh) * 0.015;
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

      if (holding) keloHoldInHands(riding || resting ? null : a.mode);
    }

// Whatever he carries sits in his hands: held between them while carrying, and gripped like a tool while digging
function keloHoldInHands(mode) {
      const obj = carriedObject;
      if (mode !== 'dig' && mode !== 'walk' && mode !== 'idle') {
        obj.position.x = 0;
        obj.position.z = 0.62;
        obj.rotation.x = 0;
        return;
      }
      keloGroup.updateMatrixWorld(true);
      keloPalmLocal(keloLeftHand, _keloHandL);
      keloPalmLocal(keloRightHand, _keloHandR);
      _keloHandL.add(_keloHandR).multiplyScalar(0.5);
      if (mode === 'dig') {
        // Grip it near the top: the handle sits in his hands and the business end points down
        if (!obj.userData.gripHeight) obj.userData.gripHeight = Math.max(0.2, keloCarrySize(obj).y * 0.8);
        obj.rotation.x = -0.2;
        _keloGrip.set(0, obj.userData.gripHeight, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), obj.rotation.x);
        obj.position.copy(_keloHandL).sub(_keloGrip);
      } else {
        // Something small or wide sits between his palms; something tall is held a third of the way up
        const h = keloCarrySize(obj).y;
        obj.rotation.x = 0;
        obj.position.set(_keloHandL.x, _keloHandL.y - Math.min(h * 0.45, h > 0.9 ? h * 0.33 : 0.3), _keloHandL.z);
      }
    }
