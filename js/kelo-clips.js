// Kelo-1's hand-keyed action clips: sitting, sleeping, digging, welding, bench work, typing, eating,
// waving, thinking, celebrating, picking up and putting down, carrying, vehicles, painting, planting,
// watering, chopping, fishing, the kite and machine work.
// Loaded after js/kelo-mocap.js; finishKeloPose() (js/animations.js) calls keloClipLayer() every frame.
//
// A clip is a list of key poses: [time, pose, ease]. A pose names only the channels it sets (the
// same channels finishKeloPose blends: lArmX, rKneeX, headY, bodyX, lift, lGrip...); a channel the
// clip uses but a key leaves out takes the standing value. The ease shapes the move INTO that key:
// 'l' linear, 's' smooth, 'i' in (speeds up: strikes), 'o' out (slows down: follow-through),
// 'O' strong out, 'b' back (overshoots a little and settles), 'h' hold (jumps at the key).
// Every clip also gets overlapping action for free: the body leads a little, and the head, elbows
// and hands trail behind it (KELO_CLIP_LAG), so moves ripple through him instead of all at once.
//
// An action (KELO_ACTS) is an enter clip, loop clips (a different one, and a slightly different
// speed, every time round) and an exit clip. Code asks for an action every frame it wants it:
//   keloAction(name, opts)  - from pose code between beginKeloPose() and finishKeloPose()
//   keloDoing(name, opts)   - a sticky hint from job code (watering, fishing): used while he stands still
// When the request stops, the exit clip plays (standing up, waking), then the clip blends out to
// whatever is underneath. Actions with `hold` keep his feet still until he has got up
// (keloClipHolds(), read by scene.js and basements.js), so he never walks off half-seated.
//
// Special channels: root and tilt (1 = where he was when the clip started, 0 = where the code put
// him: sitting down onto a seat, lying on the bed, climbing into a cab glide instead of popping),
// tool/toolZ (extra turn of a held tool, js/animations.js keloHoldInHands), lit (the welding torch
// is on), reach (how much the step-1 hand IK target counts, js/kelo-ik.js) and rod (fishing rod).

const KELO_CLIP_CHANNELS = (() => {
  const c = [];
  ['lArm', 'rArm', 'lLeg', 'rLeg', 'head', 'body', 'lElbow', 'rElbow', 'lHand', 'rHand', 'lKnee', 'rKnee', 'lFoot', 'rFoot']
    .forEach(j => c.push(j + 'X', j + 'Y', j + 'Z'));
  return c.concat(['lGrip', 'rGrip', 'bodyLift', 'bodyShift', 'lift', 'yaw', 'root', 'tilt', 'tool', 'toolY', 'toolZ', 'lit', 'reach', 'rod', 'rodZ']);
})();
const KELO_CLIP_IDX = {};
KELO_CLIP_CHANNELS.forEach((ch, i) => { KELO_CLIP_IDX[ch] = i; });
const KELO_CLIP_SPECIAL = KELO_CLIP_IDX.root;   // channels from here on are not joints
const KELO_CLIP_UPPER = KELO_CLIP_CHANNELS.map(ch => /^(lArm|rArm|head|lElbow|rElbow|lHand|rHand|lGrip|rGrip)/.test(ch));
const KELO_CLIP_LEGS = KELO_CLIP_CHANNELS.map(ch => /^(lLeg|rLeg|lKnee|rKnee|lFoot|rFoot|lift)/.test(ch));
// Overlapping action: seconds each joint trails (+) or leads (-) the keys
const KELO_CLIP_LAG = { body: -0.03, head: 0.07, lElbow: 0.04, rElbow: 0.04, lHand: 0.08, rHand: 0.08 };
// His standing pose, as finishKeloPose leaves him (elbows and knees soft, arms clear of his sides)
const KELO_STAND = { lArmZ: -0.1, rArmZ: 0.1, lElbowX: -0.16, rElbowX: -0.16, lKneeX: 0.04, rKneeX: 0.04, reach: 1 };

// --- Pose helpers (worked out once from his proportions) ---------------------------------------------
// A squat that lowers his hips by d, feet where they stand
function keloClipSquat(d, extra) {
      const a = Math.acos(Math.max(0.2, 1 - d / (KELO_THIGH + KELO_SHIN)));
      return Object.assign({ lLegX: -a, rLegX: -a, lKneeX: 2 * a, rKneeX: 2 * a, lift: -d }, extra || {});
    }
const KP = (() => {
  const gK = keloSitKnee(-2.0, 0.2);
  return {
    // seated on a chair or a seat (the code puts his root on it)
    chair: { lLegX: -1.45, rLegX: -1.45, lKneeX: 1.35, rKneeX: 1.35, lift: 0 },
    // on the ground, knees up (hips 0.2 above it)
    ground: { lLegX: -2.0, rLegX: -2.0, lLegZ: -0.1, rLegZ: 0.1, lKneeX: gK, rKneeX: gK, lift: 0.2 - KELO_LEG_Y },
    // down on his left knee, right foot planted in front (hips 0.5 above the ground)
    kneel: { lLegX: 0.12, lKneeX: 1.62, lFootX: 1.2, rLegX: -1.72, rKneeX: 1.62, rLegZ: 0.08, lift: 0.5 - KELO_LEG_Y },
    // a working stance: left foot forward, knees soft
    stance: { lLegX: -0.2, lKneeX: 0.22, rLegX: 0.18, rKneeX: 0.12 },
    // lying flat on his back (the bed tips his whole body over)
    lie: { lLegX: 0, rLegX: 0, lKneeX: 0.08, rKneeX: 0.08, lArmX: 0.05, rArmX: 0.05, lArmZ: -0.12, rArmZ: 0.12, lElbowX: -0.3, rElbowX: -0.3, lGrip: 0.35, rGrip: 0.35, headY: 0, headX: 0 },
    // hands on a wheel or handlebars
    wheel: { lArmX: -0.62, rArmX: -0.62, lArmZ: 0.04, rArmZ: -0.04, lElbowX: -0.72, rElbowX: -0.72, lGrip: 0.85, rGrip: 0.85 },
    // a palette in his left hand, held at his side in front
    palette: { lArmX: -0.55, lArmZ: -0.3, lArmY: 0.3, lElbowX: -1.35, lHandY: -0.4, lGrip: 0.6 }
  };
})();
const kpm = (...poses) => Object.assign({}, ...poses);

// --- The clips --------------------------------------------------------------------------------------
// [time s, pose, ease]; `z` adds a buzz between two times: [from, to, Hz, {channel: amplitude}]
const KELO_CLIP_DEFS = {
  // Sitting on a chair or seat: lean forward over his feet, reach back, lower himself, settle
  sitDown: { k: [
    [0, { root: 1 }],
    [0.3, kpm(keloClipSquat(0.1), { bodyX: 0.3, headX: 0.25, lArmX: -0.3, rArmX: -0.3, root: 1 }), 's'],
    [0.7, { lLegX: -1.15, rLegX: -1.15, lKneeX: 1.45, rKneeX: 1.45, lift: -0.08, bodyX: 0.45, headX: 0.1, lArmX: 0.25, rArmX: 0.25, lArmZ: -0.25, rArmZ: 0.25, root: 0.35 }, 's'],
    [0.95, kpm(KP.chair, { bodyX: -0.06, headX: -0.05, lArmX: -0.35, rArmX: -0.35, root: 0 }), 'o'],
    [1.25, kpm(KP.chair, { bodyX: 0.06, lArmX: -0.5, rArmX: -0.5, lElbowX: -0.9, rElbowX: -0.9, root: 0 }), 'b']] },
  standUp: { k: [
    [0, kpm(KP.chair, { bodyX: 0.06, lArmX: -0.5, rArmX: -0.5, lElbowX: -0.9, rElbowX: -0.9, root: 1 })],
    [0.35, kpm(KP.chair, { lKneeX: 1.65, rKneeX: 1.65, bodyX: 0.6, headX: 0.15, lArmX: -0.6, rArmX: -0.6, lElbowX: -0.3, rElbowX: -0.3, root: 1 }), 's'],
    [0.75, { lLegX: -0.55, rLegX: -0.55, lKneeX: 0.9, rKneeX: 0.9, lift: -0.08, bodyX: 0.35, headX: -0.05, lArmX: -0.4, rArmX: -0.4, root: 0.2 }, 's'],
    [1.05, { bodyX: -0.05, headX: -0.08, root: 0 }, 'o'],
    [1.3, { root: 0 }, 's']] },
  sitIdle: { k: [
    [0, kpm(KP.chair, { bodyX: 0.06, lArmX: -0.5, rArmX: -0.5, lElbowX: -0.9, rElbowX: -0.9 })],
    [1.4, { headY: 0.35, headX: -0.05 }, 's'], [2.0, { headY: 0.38, headZ: 0.12 }, 's'],
    [3.0, { headY: -0.3 }, 's'], [3.8, { headY: -0.32, headZ: -0.06 }, 's'],
    [4.6, { headY: 0 }, 's']], base: 'first' },
  sitFeet: { k: [   // swinging his feet under the seat
    [0, kpm(KP.chair, { bodyX: 0.06, lArmX: -0.5, rArmX: -0.5, lElbowX: -0.9, rElbowX: -0.9 })],
    [0.4, { lKneeX: 1.0, rKneeX: 1.6, headZ: 0.06 }, 's'], [0.8, { lKneeX: 1.6, rKneeX: 1.0, headZ: -0.06 }, 's'],
    [1.2, { lKneeX: 1.0, rKneeX: 1.6, headZ: 0.06 }, 's'], [1.6, { lKneeX: 1.6, rKneeX: 1.0, headZ: -0.06 }, 's'],
    [2.0, {}, 's'], [3.0, {}, 'l']], base: 'first' },

  // On the ground, knees up (the shore stones, a rest in the meadow)
  sitDownGround: { k: [
    [0, {}],
    [0.3, keloClipSquat(0.18, { bodyX: 0.35, headX: 0.25, lArmX: -0.45, rArmX: -0.45 }), 's'],
    [0.8, keloClipSquat(0.5, { bodyX: 0.2, headX: 0.1, lArmX: 0.6, rArmX: 0.6, lArmZ: -0.3, rArmZ: 0.3, lElbowX: -0.1, rElbowX: -0.1 }), 's'],
    [1.15, kpm(KP.ground, { bodyX: -0.28, headX: -0.15, lArmX: 0.6, rArmX: 0.6, lArmZ: -0.25, rArmZ: 0.25, lElbowX: 0.05, rElbowX: 0.05, lGrip: 0.1, rGrip: 0.1 }), 'o'],
    [1.5, kpm(KP.ground, { bodyX: -0.18, headX: -0.08, lArmX: 0.55, rArmX: 0.55, lArmZ: -0.25, rArmZ: 0.25, lElbowX: 0.08, rElbowX: 0.08, lGrip: 0.1, rGrip: 0.1 }), 'b']] },
  standUpGround: { k: [
    [0, kpm(KP.ground, { bodyX: -0.18, lArmX: 0.55, rArmX: 0.55, lArmZ: -0.25, rArmZ: 0.25, lElbowX: 0.08, rElbowX: 0.08, lGrip: 0.1, rGrip: 0.1 })],
    [0.4, kpm(KP.ground, { lKneeX: KP.ground.lKneeX + 0.35, rKneeX: KP.ground.rKneeX + 0.35, bodyX: 0.5, headX: 0.2, lArmX: 0.7, rArmX: 0.7, lArmZ: -0.3, rArmZ: 0.3 }), 's'],
    [0.85, keloClipSquat(0.45, { bodyX: 0.55, headX: 0.1, lArmX: -0.3, rArmX: -0.3 }), 's'],
    [1.25, { bodyX: -0.04, headX: -0.05 }, 'o'], [1.5, {}, 's']] },
  shoreIdle: { k: [
    [0, kpm(KP.ground, { bodyX: -0.18, headX: -0.08, lArmX: 0.55, rArmX: 0.55, lArmZ: -0.25, rArmZ: 0.25, lElbowX: 0.08, rElbowX: 0.08, lGrip: 0.1, rGrip: 0.1 })],
    [0.5, { lKneeX: KP.ground.lKneeX + 0.25, headZ: 0.15 }, 's'], [0.9, { headZ: 0.18 }, 's'],
    [1.3, { rKneeX: KP.ground.rKneeX + 0.25, headZ: -0.12 }, 's'], [1.7, {}, 's'],
    [2.6, { headX: -0.22, headY: 0.3, bodyX: -0.22 }, 's'], [3.6, { headX: -0.2, headY: 0.32 }, 's'],
    [4.6, {}, 's']], base: 'first' },
  shoreLook: { k: [   // hugs his knees and looks out over the water
    [0, kpm(KP.ground, { bodyX: -0.18, headX: -0.08, lArmX: 0.55, rArmX: 0.55, lArmZ: -0.25, rArmZ: 0.25, lElbowX: 0.08, rElbowX: 0.08, lGrip: 0.1, rGrip: 0.1 })],
    [0.7, { bodyX: 0.2, lArmX: -0.8, rArmX: -0.8, lArmZ: 0.15, rArmZ: -0.15, lElbowX: -1.2, rElbowX: -1.2, lGrip: 0.6, rGrip: 0.6, headX: -0.1 }, 's'],
    [2.4, { bodyX: 0.24, lArmX: -0.8, rArmX: -0.8, lArmZ: 0.15, rArmZ: -0.15, lElbowX: -1.2, rElbowX: -1.2, lGrip: 0.6, rGrip: 0.6, headX: -0.15, headY: -0.25, headZ: 0.12 }, 's'],
    [3.1, { bodyX: 0.24, lArmX: -0.8, rArmX: -0.8, lArmZ: 0.15, rArmZ: -0.15, lElbowX: -1.2, rElbowX: -1.2, lGrip: 0.6, rGrip: 0.6, headY: 0.1 }, 's'],
    [3.9, {}, 's']], base: 'first' },

  // Bed: sit on the edge, swing round and lie back; breathe; stretch, sit up and get up
  lieDown: { k: [
    [0, { root: 1, tilt: 1 }],
    [0.45, keloClipSquat(0.15, { bodyX: 0.3, headX: 0.2, root: 0.85, tilt: 1 }), 's'],
    [0.9, { lLegX: -1.35, rLegX: -1.35, lKneeX: 1.3, rKneeX: 1.3, lift: -0.3, bodyX: 0.1, lArmX: 0.3, rArmX: 0.3, root: 0.55, tilt: 1 }, 's'],
    [1.5, { lLegX: -0.9, rLegX: -0.9, lKneeX: 0.9, rKneeX: 0.9, bodyX: -0.15, headX: 0.25, lArmX: 0.4, rArmX: 0.4, root: 0.2, tilt: 0.45 }, 's'],
    [2.0, kpm(KP.lie, { headX: 0.1, root: 0, tilt: 0 }), 'o'],
    [2.4, kpm(KP.lie, { bodyZ: 0.06, headY: 0.35, lKneeX: 0.3 }), 'b']] },
  collapse: { k: [   // knees buckle and he folds over where he stands
    [0, { root: 1, tilt: 1 }],
    [0.35, keloClipSquat(0.25, { bodyX: 0.4, headX: 0.5, lArmX: 0.1, rArmX: 0.1, root: 1, tilt: 1 }), 'i'],
    [0.8, keloClipSquat(0.45, { bodyX: 0.2, headX: 0.3, root: 0.5, tilt: 0.6 }), 'o'],
    [1.3, kpm(KP.lie, { root: 0, tilt: 0 }), 'O'],
    [1.6, kpm(KP.lie, { headY: -0.3, lKneeX: 0.25 }), 'b']] },
  sleepBreathe: { k: [
    [0, kpm(KP.lie, { bodyZ: 0.06, headY: 0.35, lKneeX: 0.3 })],
    [2.2, { bodyLift: 0.03, bodyX: -0.04, headX: -0.05, lArmZ: -0.16, rArmZ: 0.16 }, 's'],
    [4.6, { bodyLift: -0.01 }, 's'],
    [6.8, { bodyLift: 0.03, bodyX: -0.04, headX: -0.05, lArmZ: -0.16, rArmZ: 0.16, rGrip: 0.6 }, 's'],
    [9.2, {}, 's']], base: 'first' },
  sleepShift: { k: [   // rolls a little onto one side and back, one knee drawn up
    [0, kpm(KP.lie, { bodyZ: 0.06, headY: 0.35, lKneeX: 0.3 })],
    [1.6, { bodyZ: 0.25, headY: 0.6, rLegX: -0.5, rKneeX: 0.9, rArmX: -0.6, rElbowX: -1.2, rArmY: 0.4 }, 's'],
    [5.0, { bodyZ: 0.26, headY: 0.62, rLegX: -0.52, rKneeX: 0.95, rArmX: -0.62, rElbowX: -1.25, rArmY: 0.4, bodyLift: 0.03 }, 's'],
    [7.0, {}, 's'], [8.0, {}, 'l']], base: 'first' },
  wake: { k: [
    [0, kpm(KP.lie, { bodyZ: 0.06, headY: 0.35, lKneeX: 0.3, root: 1, tilt: 1 })],
    [0.7, kpm(KP.lie, { lArmZ: -2.7, rArmZ: 2.7, lArmX: 0, rArmX: 0, lElbowX: -0.1, rElbowX: -0.1, lGrip: 0, rGrip: 0, lFootX: 0.4, rFootX: 0.4, headX: -0.25, bodyX: -0.12, root: 1, tilt: 1 }), 's'],
    [1.1, kpm(KP.lie, { lArmZ: -2.8, rArmZ: 2.8, lArmX: 0, rArmX: 0, lFootX: 0.5, rFootX: 0.5, headX: -0.3, root: 1, tilt: 1 }), 'l'],
    [1.7, { lLegX: -0.7, rLegX: -0.7, lKneeX: 0.8, rKneeX: 0.8, bodyX: 0.25, headX: 0.15, lArmX: 0.3, rArmX: 0.3, root: 0.85, tilt: 0.45 }, 's'],
    [2.3, { lLegX: -1.3, rLegX: -1.3, lKneeX: 1.35, rKneeX: 1.35, lift: -0.3, bodyX: 0.45, headX: 0.1, lArmX: -0.4, rArmX: -0.4, root: 0.4, tilt: 0.05 }, 's'],
    [2.8, { bodyX: -0.05, headX: -0.1, root: 0, tilt: 0 }, 'o'],
    [3.1, { root: 0, tilt: 0 }, 's']] },

  // Shovel: drive it in, lift the load, swing it aside and toss, back to ready
  dig: { k: [   // shovel: drive the blade in, lift the load, turn at the waist and toss it off to the side
    [0, kpm(KP.stance, { lArmX: -0.7, rArmX: -0.75, lArmZ: 0.15, rArmZ: -0.15, lElbowX: -0.4, rElbowX: -0.6, bodyX: 0.2, headX: 0.3, lGrip: 1, rGrip: 1, tool: -0.3 })],
    [0.3, { lArmX: -0.95, rArmX: -1.0, lArmZ: 0.15, rArmZ: -0.15, lElbowX: -0.75, rElbowX: -0.9, bodyX: 0.12, headX: 0.35, lift: 0.03, tool: -0.1, lLegX: -0.2, lKneeX: 0.2, rLegX: 0.18, rKneeX: 0.12 }, 's'],
    [0.48, { lArmX: -0.3, rArmX: -0.4, lArmZ: 0.15, rArmZ: -0.15, lElbowX: -0.15, rElbowX: -0.35, bodyX: 0.55, headX: 0.45, lift: -0.07, tool: -0.6, lLegX: -0.35, lKneeX: 0.55, rLegX: 0.18, rKneeX: 0.2 }, 'i'],
    [0.62, { lArmX: -0.34, rArmX: -0.45, lArmZ: 0.15, rArmZ: -0.15, lElbowX: -0.2, rElbowX: -0.4, bodyX: 0.5, headX: 0.42, lift: -0.06, tool: -0.5, toolY: 0.1, lLegX: -0.33, lKneeX: 0.5, rLegX: 0.18, rKneeX: 0.2 }, 'b'],
    [1.05, { lArmX: -0.95, rArmX: -0.95, lArmZ: 0.15, rArmZ: -0.15, lElbowX: -0.95, rElbowX: -1.1, bodyX: 0.25, headX: 0.25, lift: -0.1, tool: -0.85, lLegX: -0.42, lKneeX: 0.6, rLegX: 0.05, rKneeX: 0.35 }, 's'],
    [1.35, { lArmX: -1.0, rArmX: -1.05, lArmZ: 0.1, rArmZ: 0.1, lElbowX: -0.9, rElbowX: -1.0, bodyX: 0.22, bodyY: 0.35, headX: 0.2, headY: 0.1, lift: -0.04, tool: -0.8, toolZ: -0.25, lLegX: -0.25, lKneeX: 0.3, rLegX: 0.15, rKneeX: 0.15 }, 's'],
    [1.55, { lArmX: -1.3, rArmX: -1.2, lArmZ: 0.35, rArmZ: 0.25, lElbowX: -0.45, rElbowX: -0.6, bodyX: 0.15, bodyY: -0.55, headX: 0.1, headY: -0.4, tool: -1.15, toolZ: 0.45, toolY: -1.1, lLegX: -0.2, lKneeX: 0.22, rLegX: 0.18, rKneeX: 0.12 }, 'i'],
    [1.8, { lArmX: -1.2, rArmX: -1.1, lArmZ: 0.38, rArmZ: 0.28, lElbowX: -0.5, rElbowX: -0.65, bodyX: 0.12, bodyY: -0.6, headX: 0.05, headY: -0.45, tool: -1.0, toolZ: 0.5, toolY: -1.3, lLegX: -0.2, lKneeX: 0.22, rLegX: 0.18, rKneeX: 0.12 }, 'o'],
    [2.3, {}, 's']], base: 'first' },
  digRest: { k: [   // leans on the shovel and looks at the hole
    [0, kpm(KP.stance, { lArmX: -0.7, rArmX: -0.7, lArmZ: 0.15, rArmZ: -0.15, lElbowX: -0.4, rElbowX: -0.4, bodyX: 0.2, headX: 0.3, lGrip: 1, rGrip: 1, tool: -0.3 })],
    [0.6, { lArmX: -0.85, rArmX: -0.85, lArmZ: 0.15, rArmZ: -0.15, lElbowX: -1.1, rElbowX: -1.1, bodyX: 0.12, headX: 0.45, headZ: 0.2, tool: 0, rGrip: 1, lGrip: 1 }, 's'],
    [1.7, { lArmX: -0.85, rArmX: -0.85, lArmZ: 0.15, rArmZ: -0.15, lElbowX: -1.1, rElbowX: -1.1, bodyX: 0.12, headX: 0.4, headZ: -0.12, headY: 0.2, tool: 0, rGrip: 1, lGrip: 1 }, 's'],
    [2.4, {}, 's']], base: 'first' },
  // Pickaxe: slow wind-up overhead, a fast heavy strike, the jolt, pull it free
  pick: { k: [   // pickaxe (and sledge): a slow wind-up up and over his head, a fast heavy strike, the jolt, pull it free
    [0, kpm(KP.stance, { lArmX: -0.8, rArmX: -0.85, lArmZ: 0.12, rArmZ: -0.12, lElbowX: -0.45, rElbowX: -0.55, bodyX: 0.2, headX: 0.3, lGrip: 1, rGrip: 1, tool: 2.6 })],
    [0.35, { lArmX: -1.8, rArmX: -1.9, lArmZ: 0.12, rArmZ: 0.05, lElbowX: -0.7, rElbowX: -0.8, bodyX: 0.0, headX: 0.0, lift: 0.02, tool: 1.0, toolZ: -0.15, lLegX: -0.22, lKneeX: 0.18, rLegX: 0.2, rKneeX: 0.08 }, 's'],
    [0.6, { lArmX: -2.65, rArmX: -2.7, lArmZ: 0.12, rArmZ: 0.0, lElbowX: -0.9, rElbowX: -1.0, bodyX: -0.15, headX: -0.1, lift: 0.03, tool: -0.4, toolZ: -0.1, lLegX: -0.22, lKneeX: 0.18, rLegX: 0.2, rKneeX: 0.08 }, 's'],
    [0.7, { lArmX: -2.72, rArmX: -2.75, lArmZ: 0.12, rArmZ: 0.0, lElbowX: -0.95, rElbowX: -1.05, bodyX: -0.17, headX: -0.08, lift: 0.03, tool: -0.5, toolZ: -0.08, lLegX: -0.22, lKneeX: 0.18, rLegX: 0.2, rKneeX: 0.08 }, 'o'],
    [0.86, { lArmX: -0.4, rArmX: -0.45, lArmZ: 0.12, rArmZ: -0.12, lElbowX: -0.1, rElbowX: -0.2, bodyX: 0.55, headX: 0.45, lift: -0.09, tool: 2.4, toolZ: 0, rHandX: 0.3, lLegX: -0.38, lKneeX: 0.55, rLegX: 0.2, rKneeX: 0.22 }, 'i'],
    [0.98, { lArmX: -0.52, rArmX: -0.57, lArmZ: 0.12, rArmZ: -0.12, lElbowX: -0.2, rElbowX: -0.3, bodyX: 0.5, headX: 0.38, lift: -0.07, tool: 2.5, lLegX: -0.36, lKneeX: 0.5, rLegX: 0.2, rKneeX: 0.2 }, 'O'],
    [1.25, { lArmX: -0.62, rArmX: -0.67, lArmZ: 0.12, rArmZ: -0.12, lElbowX: -0.55, rElbowX: -0.65, bodyX: 0.35, bodyY: 0.08, headX: 0.35, lift: -0.04, tool: 2.7, toolY: 0.2 }, 's'],
    [1.6, {}, 's']], base: 'first', z: [0.86, 1.1, 30, { lArmX: 0.035, rArmX: 0.035, headZ: 0.03 }] },
  // Axe: twist away and lift, swing through at the trunk, the bite, wrench it out
  chop: { k: [   // axe: twist away and lift it over the right shoulder, swing down and across with a roll of
                 // the wrists, the bite, wrench it out
    [0, kpm(KP.stance, { lArmX: -1.1, rArmX: -1.15, lArmZ: 0.2, rArmZ: -0.05, lElbowX: -0.5, rElbowX: -0.6, bodyX: 0.12, headX: 0.15, lGrip: 1, rGrip: 1, tool: 2.2, toolZ: 0.15 })],
    [0.55, { lArmX: -2.1, rArmX: -2.2, lArmZ: 0.45, rArmZ: 0.55, lElbowX: -0.8, rElbowX: -0.95, bodyX: -0.05, bodyY: 0.6, headY: 0.15, headX: 0, tool: -0.3, toolZ: -0.6, toolY: 0.3, rHandZ: -0.35, lLegX: -0.22, lKneeX: 0.15, rLegX: 0.22, rKneeX: 0.18 }, 's'],
    [0.64, { lArmX: -2.15, rArmX: -2.25, lArmZ: 0.46, rArmZ: 0.56, lElbowX: -0.82, rElbowX: -0.97, bodyX: -0.06, bodyY: 0.62, headY: 0.12, tool: -0.35, toolZ: -0.62, toolY: 0.32, rHandZ: -0.38, lLegX: -0.22, lKneeX: 0.15, rLegX: 0.22, rKneeX: 0.18 }, 'o'],
    [0.8, { lArmX: -1.35, rArmX: -1.35, lArmZ: -0.05, rArmZ: -0.3, lElbowX: -0.1, rElbowX: -0.2, bodyX: 0.25, bodyY: -0.3, headX: 0.15, headY: -0.05, lift: -0.05, tool: 1.75, toolZ: 0.4, toolY: -0.25, rHandZ: 0.35, lLegX: -0.32, lKneeX: 0.42, rLegX: 0.2, rKneeX: 0.2 }, 'i'],
    [0.92, { lArmX: -1.3, rArmX: -1.3, lArmZ: -0.02, rArmZ: -0.27, lElbowX: -0.18, rElbowX: -0.28, bodyX: 0.22, bodyY: -0.24, headX: 0.12, lift: -0.04, tool: 1.85, toolZ: 0.38, toolY: -0.25, rHandZ: 0.3, lLegX: -0.3, lKneeX: 0.4, rLegX: 0.2, rKneeX: 0.2 }, 'O'],
    [1.25, { lArmX: -1.2, rArmX: -1.25, lArmZ: 0.15, rArmZ: -0.05, lElbowX: -0.55, rElbowX: -0.65, bodyX: 0.05, bodyY: 0.1, headX: 0.1, tool: 2.2, toolZ: 0.15, toolY: 0.15 }, 's'],
    [1.6, {}, 's']], base: 'first', z: [0.8, 1.0, 26, { lArmX: 0.03, rArmX: 0.03, bodyY: 0.02 }] },
  // Rake or hoe: reach out, draw it back toward him
  rake: { k: [   // rake or hoe: reach out to one side, draw it back across toward him, the other way next
    [0, kpm(KP.stance, { lArmX: -0.55, rArmX: -0.6, lArmZ: 0.12, rArmZ: -0.12, lElbowX: -0.9, rElbowX: -1.0, bodyX: 0.15, headX: 0.35, lGrip: 1, rGrip: 1, tool: -0.35 })],
    [0.55, { lArmX: -1.05, rArmX: -1.1, lArmZ: 0.2, rArmZ: 0.05, lElbowX: -0.2, rElbowX: -0.3, bodyX: 0.4, bodyY: 0.3, headX: 0.45, headY: 0.2, lift: -0.05, tool: -0.85, toolZ: -0.3, lLegX: -0.35, lKneeX: 0.45, rLegX: 0.2, rKneeX: 0.15 }, 's'],
    [1.25, { lArmX: -0.5, rArmX: -0.55, lArmZ: 0.05, rArmZ: -0.2, lElbowX: -0.95, rElbowX: -1.05, bodyX: 0.15, bodyY: -0.2, headX: 0.38, headY: -0.15, tool: -0.32, toolZ: 0.25 }, 'o'],
    [1.8, { lArmX: -1.05, rArmX: -1.1, lArmZ: 0.0, rArmZ: -0.3, lElbowX: -0.2, rElbowX: -0.3, bodyX: 0.4, bodyY: -0.3, headX: 0.45, headY: -0.2, lift: -0.05, tool: -0.85, toolZ: 0.3, lLegX: -0.35, lKneeX: 0.45, rLegX: 0.2, rKneeX: 0.15 }, 's'],
    [2.5, { lArmX: -0.5, rArmX: -0.55, lArmZ: 0.2, rArmZ: 0.0, lElbowX: -0.95, rElbowX: -1.05, bodyX: 0.15, bodyY: 0.2, headX: 0.38, headY: 0.15, tool: -0.32, toolZ: -0.25 }, 'o'],
    [2.8, {}, 's']], base: 'first' },
  // The built-in core drill along his right forearm: draw back, thrust in, ride the vibration, ease off
  drill: { k: [
    [0, kpm(KP.stance, { rArmX: -0.55, rElbowX: -0.3, rGrip: 1, lArmX: -0.75, lArmZ: 0.3, lElbowX: -0.75, lGrip: 0.6, bodyX: 0.06, headX: 0.3 })],
    [0.45, { rArmX: -0.42, rElbowX: -0.45, lArmX: -0.65, lArmZ: 0.3, lElbowX: -0.85, bodyX: -0.04, headX: 0.25, lift: 0.02 }, 's'],
    [0.6, { rArmX: -0.82, rElbowX: -0.25, lArmX: -0.8, lArmZ: 0.3, lElbowX: -0.7, bodyX: 0.24, headX: 0.35, lift: -0.04, lLegX: -0.3, lKneeX: 0.38 }, 'i'],
    [1.15, { rArmX: -0.8, rElbowX: -0.25, lArmX: -0.8, lArmZ: 0.3, lElbowX: -0.7, bodyX: 0.22, headX: 0.33, lift: -0.04, lLegX: -0.3, lKneeX: 0.38 }, 'l'],
    [1.4, {}, 's']], base: 'first', z: [0.6, 1.15, 24, { rArmX: 0.04, lArmX: 0.03, headZ: 0.04, bodyZ: 0.01 }] },
  // A jackhammer: hands on the handles at his waist, leaning into it, shaking with it
  jackhammer: { k: [
    [0, kpm(KP.stance, { lArmX: -0.45, rArmX: -0.45, lArmZ: 0.25, rArmZ: -0.25, lElbowX: -0.7, rElbowX: -0.7, bodyX: 0.3, headX: 0.35, lGrip: 1, rGrip: 1, tool: 0 })],
    [0.3, { lArmX: -0.5, rArmX: -0.5, lArmZ: 0.25, rArmZ: -0.25, lElbowX: -0.75, rElbowX: -0.75, bodyX: 0.36, headX: 0.4, lift: -0.04, tool: 0 }, 's'],
    [1.5, { lArmX: -0.5, rArmX: -0.5, lArmZ: 0.25, rArmZ: -0.25, lElbowX: -0.75, rElbowX: -0.75, bodyX: 0.36, headX: 0.4, lift: -0.04, tool: 0 }, 'l'],
    [1.85, { lArmX: -0.6, rArmX: -0.6, lArmZ: 0.25, rArmZ: -0.25, lElbowX: -0.9, rElbowX: -0.9, bodyX: 0.2, headX: 0.3, lift: 0.02, tool: 0.1 }, 's'],
    [2.2, {}, 's']], base: 'first', z: [0.3, 1.5, 28, { bodyX: 0.025, lift: 0.012, headX: 0.04, lArmX: 0.03, rArmX: 0.03 }] },

  // Welding: lean in and nod the hood down, the torch walks small circles along the seam with the
  // other hand steadying the work; now and then he lifts the torch and leans back to look
  weldIn: { k: [
    [0, {}],
    [0.35, kpm(KP.stance, { bodyX: 0.08, headX: -0.05, rArmX: -0.9, rElbowX: -0.7, rGrip: 1, lArmX: -0.6, lElbowX: -0.5, lit: 0 }), 's'],
    [0.5, kpm(KP.stance, { bodyX: 0.12, headX: 0.45, rArmX: -1.0, rElbowX: -0.55, rGrip: 1, lArmX: -0.75, lArmZ: 0.25, lElbowX: -0.6, lit: 0 }), 'i'],
    [0.7, kpm(KP.stance, { bodyX: 0.17, headX: 0.28, rArmX: -1.3, rArmZ: -0.12, rElbowX: -0.45, rGrip: 1, lArmX: -0.85, lArmZ: 0.3, lElbowX: -0.6, lGrip: 0.15, lit: 0 }), 'b']] },
  weldBead: { k: [   // the torch weaves small circles along the seam, the wrist doing the weave
    [0, kpm(KP.stance, { bodyX: 0.17, headX: 0.28, rArmX: -1.3, rArmZ: -0.12, rElbowX: -0.45, rGrip: 1, lArmX: -0.85, lArmZ: 0.3, lElbowX: -0.6, lGrip: 0.15, lit: 1 })],
    [0.5, { rArmX: -1.36, rArmZ: -0.08, rHandZ: 0.12, rHandX: 0.06 }, 's'], [1.0, { rArmX: -1.3, rArmZ: -0.04, rHandZ: -0.12, rHandX: -0.06, headZ: 0.05 }, 's'],
    [1.5, { rArmX: -1.24, rArmZ: -0.08, rHandZ: 0.12, rHandX: 0.06 }, 's'], [2.0, { rArmX: -1.3, rArmZ: -0.13, rHandZ: -0.12, rHandX: -0.06, headZ: -0.04 }, 's'],
    [2.5, { rArmX: -1.36, rArmZ: -0.17, rHandZ: 0.12, rHandX: 0.06, bodyShift: 0.02 }, 's'], [3.0, { rArmX: -1.3, rArmZ: -0.21, rHandZ: -0.12, rHandX: -0.06, bodyShift: 0.03 }, 's'],
    [3.5, {}, 's']], base: 'first', z: [0, 3.5, 31, { rArmX: 0.012, rHandZ: 0.05 }] },
  weldLook: { k: [
    [0, kpm(KP.stance, { bodyX: 0.17, headX: 0.28, rArmX: -1.3, rArmZ: -0.12, rElbowX: -0.45, rGrip: 1, lArmX: -0.85, lArmZ: 0.3, lElbowX: -0.6, lGrip: 0.15, lit: 0 })],
    [0.45, { bodyX: -0.03, headX: 0.1, headY: 0.25, headZ: -0.15, rArmX: -0.75, rArmZ: 0.1, rElbowX: -0.95, rGrip: 1, lArmX: -0.3, lArmZ: 0.1, lElbowX: -0.4, lit: 0 }, 's'],
    [1.4, { bodyX: -0.02, headX: 0.12, headY: 0.3, headZ: -0.2, rArmX: -0.75, rArmZ: 0.1, rElbowX: -0.95, rGrip: 1, lArmX: -0.3, lArmZ: 0.1, lElbowX: -0.4, lit: 0 }, 's'],
    [1.6, { bodyX: 0.0, headX: 0.15, headY: 0.2, headZ: -0.1, rArmX: -0.75, rArmZ: 0.1, rElbowX: -0.95, rGrip: 1, lArmX: -0.3, lArmZ: 0.1, lElbowX: -0.4, lit: 0 }, 's'],   // a little nod: good bead
    [1.75, { bodyX: 0.0, headX: 0.3, headY: 0.2, rArmX: -0.75, rArmZ: 0.1, rElbowX: -0.95, rGrip: 1, lArmX: -0.3, lArmZ: 0.1, lElbowX: -0.4, lit: 0 }, 'o'],
    [2.3, { lit: 0 }, 's'], [2.31, { lit: 1 }, 'h']], base: 'first' },

  // At the work bench: hammer, saw, sanding block, drill; the left hand holds the work
  hammer: { k: [   // the arm comes up and back with the wrist cocked, then whips down with a snap of the wrist
    [0, kpm(KP.stance, { bodyX: 0.25, headX: 0.4, rArmX: -0.9, rElbowX: -0.6, rArmZ: 0.1, rGrip: 1, lArmX: -0.95, lArmZ: -0.15, lElbowX: -0.6, lGrip: 0.8 })],
    [0.35, { rArmX: -1.95, rElbowX: -1.45, rArmZ: 0.12, rHandX: -0.7, bodyX: 0.18, headX: 0.38 }, 's'],
    [0.47, { rArmX: -0.75, rElbowX: -0.45, rHandX: 0.45, bodyX: 0.29, headX: 0.42, lift: -0.015 }, 'i'],
    [0.57, { rArmX: -0.95, rElbowX: -0.7, rHandX: 0.1, bodyX: 0.26 }, 'O'],
    [0.85, { rArmX: -1.8, rElbowX: -1.35, rHandX: -0.65, bodyX: 0.2 }, 's'],
    [0.96, { rArmX: -0.75, rElbowX: -0.45, rHandX: 0.45, bodyX: 0.29, lift: -0.015 }, 'i'],
    [1.06, { rArmX: -0.95, rElbowX: -0.7, rHandX: 0.1, bodyX: 0.26 }, 'O'],
    [1.34, { rArmX: -1.85, rElbowX: -1.4, rHandX: -0.7, bodyX: 0.19 }, 's'],
    [1.45, { rArmX: -0.75, rElbowX: -0.45, rHandX: 0.5, bodyX: 0.3, lift: -0.02 }, 'i'],
    [1.6, { rArmX: -0.95, rElbowX: -0.7, rHandX: 0.1, bodyX: 0.26 }, 'O'],
    [2.1, { headX: 0.55, headZ: 0.18, bodyX: 0.32, lElbowX: -0.7 }, 's'],   // checks the nail
    [2.6, {}, 's']], base: 'first' },
  saw: { k: [   // long push-pull strokes along the cut, the body rocking with them, the wrist staying in line
    [0, kpm(KP.stance, { bodyX: 0.25, headX: 0.42, rArmX: -1.0, rElbowX: -0.9, rArmZ: 0.15, rGrip: 1, lArmX: -0.9, lArmZ: -0.05, lElbowX: -0.7, lGrip: 0.3 })],
    [0.42, { rArmX: -1.35, rElbowX: -0.4, rHandX: -0.15, bodyX: 0.33, bodyZ: -0.04, bodyShift: 0.02, headX: 0.45 }, 's'],
    [0.85, { rArmX: -0.68, rElbowX: -1.4, rHandX: 0.15, bodyX: 0.21, bodyZ: 0.03, headX: 0.4 }, 's'],
    [1.27, { rArmX: -1.35, rElbowX: -0.4, rHandX: -0.15, bodyX: 0.33, bodyZ: -0.04, bodyShift: 0.02, headX: 0.45 }, 's'],
    [1.7, {}, 's']], base: 'first' },
  sand: { k: [
    [0, kpm(KP.stance, { bodyX: 0.25, headX: 0.4, rArmX: -0.95, rArmZ: 0.1, rElbowX: -0.7, lArmX: -0.95, lArmZ: -0.1, lElbowX: -0.7, rGrip: 0.4, lGrip: 0.4 })],
    [0.3, { rArmX: -1.07, rArmZ: 0.22, lArmX: -0.83, lArmZ: -0.22, bodyShift: 0.02 }, 's'],
    [0.6, { rArmX: -0.95, rArmZ: 0.34, lArmX: -0.95, lArmZ: -0.34 }, 's'],
    [0.9, { rArmX: -0.83, rArmZ: 0.22, lArmX: -1.07, lArmZ: -0.22, bodyShift: -0.02 }, 's'],
    [1.2, {}, 's']], base: 'first' },
  drillBench: { k: [   // leans on it, holds it steady, small corrections of the wrist while it bites, backs it out
    [0, kpm(KP.stance, { bodyX: 0.25, headX: 0.42, rArmX: -0.85, rElbowX: -1.0, rGrip: 1, lArmX: -0.95, lArmZ: 0.2, lElbowX: -0.9, lGrip: 0.7 })],
    [0.35, { bodyX: 0.36, lift: -0.03, rArmX: -0.75, rElbowX: -0.85, lArmX: -0.85, lArmZ: 0.2, lElbowX: -0.75, headX: 0.48 }, 'i'],
    [0.7, { bodyX: 0.37, lift: -0.03, rArmX: -0.74, rElbowX: -0.84, rHandZ: 0.08, lArmX: -0.84, lArmZ: 0.2, lElbowX: -0.74, headX: 0.5, headZ: 0.06 }, 's'],
    [1.05, { bodyX: 0.38, lift: -0.035, rArmX: -0.73, rElbowX: -0.83, rHandZ: -0.06, rHandX: 0.05, lArmX: -0.83, lArmZ: 0.2, lElbowX: -0.73, headX: 0.5, headZ: -0.04 }, 's'],
    [1.4, { bodyX: 0.38, lift: -0.035, rArmX: -0.72, rElbowX: -0.82, rHandZ: 0.02, lArmX: -0.83, lArmZ: 0.2, lElbowX: -0.73, headX: 0.5 }, 's'],
    [1.75, { bodyX: 0.18, rArmX: -0.95, rElbowX: -1.15, headX: 0.32, headZ: 0.12 }, 's'],
    [2.2, {}, 's']], base: 'first', z: [0.35, 1.4, 22, { rArmX: 0.02, lArmX: 0.015, headZ: 0.015 }] },
  twist: { k: [   // a wrench or screwdriver: the forearm turns the tool, a regrip, turn again; then a look
    [0, kpm(KP.stance, { bodyX: 0.28, headX: 0.45, rArmX: -0.95, rElbowX: -0.9, rArmZ: 0.05, rGrip: 1, lArmX: -0.9, lArmZ: -0.1, lElbowX: -0.75, lGrip: 0.7 })],
    [0.45, { rHandY: 1.1, rArmZ: -0.05, rElbowX: -0.95, bodyX: 0.3 }, 's'],
    [0.6, { rHandY: 1.1, rGrip: 0.4 }, 's'],
    [0.85, { rHandY: -0.2, rGrip: 0.4, rArmZ: 0.08 }, 's'],
    [0.95, { rHandY: -0.2, rGrip: 1 }, 's'],
    [1.4, { rHandY: 1.0, rArmZ: -0.04, rElbowX: -0.95, bodyX: 0.31 }, 's'],
    [1.55, { rHandY: 1.0, rGrip: 0.4 }, 's'],
    [1.8, { rHandY: -0.2, rGrip: 0.4 }, 's'],
    [1.9, { rHandY: -0.2, rGrip: 1, headZ: 0.15, headX: 0.5 }, 's'],
    [2.4, {}, 's']], base: 'first' },

  // Machines: press the controls, step back and check, wait with arms folded
  machinePress: { k: [
    [0, { bodyX: 0.1, headX: 0.2, reach: 1, lGrip: 0.4, rGrip: 0.4 }],
    [0.4, { bodyX: 0.18, headX: 0.3, reach: 1, lift: 0.015 }, 's'],
    [0.55, { bodyX: 0.24, headX: 0.32, reach: 1, lift: -0.01 }, 'i'],
    [0.75, { bodyX: 0.16, headX: 0.25, reach: 1 }, 'O'],
    [1.3, { bodyX: 0.18, headX: 0.35, headZ: 0.1, reach: 1 }, 's'],
    [1.8, {}, 's']], base: 'first' },
  machineCheck: { k: [
    [0, { bodyX: 0.1, headX: 0.2, reach: 1, lGrip: 0.4, rGrip: 0.4 }],
    [0.6, { bodyX: -0.04, headX: 0.15, headY: 0.35, headZ: -0.15, bodyShift: -0.03, reach: 0, lArmX: -0.15, rArmX: -0.15, lArmZ: -0.45, rArmZ: 0.45, lElbowX: -1.6, rElbowX: -1.6, lArmY: -0.5, rArmY: 0.5 }, 's'],
    [1.8, { bodyX: -0.04, headX: 0.2, headY: -0.25, headZ: 0.1, bodyShift: -0.03, reach: 0, lArmX: -0.15, rArmX: -0.15, lArmZ: -0.45, rArmZ: 0.45, lElbowX: -1.6, rElbowX: -1.6, lArmY: -0.5, rArmY: 0.5 }, 's'],
    [2.2, { bodyX: -0.02, headX: 0.32, headY: -0.2, bodyShift: -0.03, reach: 0, lArmX: -0.15, rArmX: -0.15, lArmZ: -0.45, rArmZ: 0.45, lElbowX: -1.6, rElbowX: -1.6, lArmY: -0.5, rArmY: 0.5 }, 's'],
    [2.9, {}, 's']], base: 'first' },
  machineWait: { k: [
    [0, { bodyX: 0.1, headX: 0.2, reach: 1, lGrip: 0.4, rGrip: 0.4 }],
    [0.6, { bodyX: -0.02, headX: 0.1, reach: 0, lArmX: -0.35, lArmY: 0.9, lArmZ: 0.2, lElbowX: -1.7, rArmX: -0.35, rArmY: -0.9, rArmZ: -0.2, rElbowX: -1.7, lGrip: 0.5, rGrip: 0.5 }, 's'],
    [1.6, { bodyX: -0.02, headX: 0.12, headY: 0.3, reach: 0, lArmX: -0.35, lArmY: 0.9, lArmZ: 0.2, lElbowX: -1.7, rArmX: -0.35, rArmY: -0.9, rArmZ: -0.2, rElbowX: -1.7, lGrip: 0.5, rGrip: 0.5, bodyShift: 0.03 }, 's'],
    [2.6, { bodyX: -0.02, headX: 0.15, headY: -0.1, reach: 0, lArmX: -0.35, lArmY: 0.9, lArmZ: 0.2, lElbowX: -1.7, rArmX: -0.35, rArmY: -0.9, rArmZ: -0.2, rElbowX: -1.7, lGrip: 0.5, rGrip: 0.5, bodyShift: 0.03 }, 's'],
    [3.2, {}, 's']], base: 'first' },

  // Typing: bursts of quick finger taps with little nods, then a pause with his chin on his hand
  typeBurst: { k: [
    [0, { lArmX: -0.75, rArmX: -0.75, lArmZ: 0.1, rArmZ: -0.1, lElbowX: -0.85, rElbowX: -0.85, lHandX: -0.35, rHandX: -0.35, headX: 0.12, bodyX: 0.08, lGrip: 0.2, rGrip: 0.2 }],
    [0.12, { lGrip: 0.5, headX: 0.14 }, 'o'], [0.24, { rGrip: 0.5 }, 'o'], [0.36, { lGrip: 0.45, headX: 0.13 }, 'o'], [0.48, { rGrip: 0.55 }, 'o'],
    [0.6, { lGrip: 0.5, rGrip: 0.2, headX: 0.16 }, 'o'], [0.72, { rGrip: 0.5 }, 'o'], [0.84, { lGrip: 0.5, headY: 0.08 }, 'o'], [0.96, { rGrip: 0.5, headY: 0.1 }, 'o'],
    [1.08, { lGrip: 0.45, headY: 0.06 }, 'o'], [1.2, { rGrip: 0.55 }, 'o'], [1.32, { lGrip: 0.5, rGrip: 0.2 }, 'o'], [1.44, { rGrip: 0.5, headX: 0.1 }, 'o'],
    [1.56, { lGrip: 0.5 }, 'o'], [1.7, { headX: 0.12, lGrip: 0.2, rGrip: 0.2 }, 'o']], base: 'first' },
  typePause: { k: [
    [0, { lArmX: -0.75, rArmX: -0.75, lArmZ: 0.1, rArmZ: -0.1, lElbowX: -0.85, rElbowX: -0.85, lHandX: -0.35, rHandX: -0.35, headX: 0.12, bodyX: 0.08, lGrip: 0.2, rGrip: 0.2 }],
    [0.45, { rArmX: -0.6, rArmZ: -0.1, rElbowX: -1.95, rHandX: 0.15, rGrip: 0.6, headX: 0.02, headZ: 0.22, bodyX: 0.04, lArmX: -0.75, lArmZ: 0.1, lElbowX: -0.85, lHandX: -0.35, lGrip: 0.3 }, 's'],
    [1.6, { rArmX: -0.6, rArmZ: -0.1, rElbowX: -1.9, rHandX: 0.15, rGrip: 0.6, headX: 0.0, headZ: 0.25, headY: 0.1, bodyX: 0.04, lArmX: -0.75, lArmZ: 0.1, lElbowX: -0.85, lHandX: -0.35, lGrip: 0.3 }, 's'],
    [1.75, { rArmX: -0.6, rArmZ: -0.1, rElbowX: -1.9, rHandX: 0.15, rGrip: 0.6, headX: 0.1, headZ: 0.2, bodyX: 0.04, lArmX: -0.75, lArmZ: 0.1, lElbowX: -0.85, lHandX: -0.35, lGrip: 0.3 }, 'o'],   // an "aha" nod
    [2.2, {}, 's']], base: 'first' },

  // Eating: pick a bite off the plate, up to his mouth, chew; sip from the cup; set it down
  eatBite: { k: [
    [0, { rArmX: -0.55, rArmZ: -0.15, rElbowX: -0.6, rGrip: 0.4, lArmX: -0.5, lArmZ: 0.12, lElbowX: -0.9, headX: 0.18, bodyX: 0.06 }],
    [0.3, { rArmX: -0.48, rArmZ: -0.12, rElbowX: -0.5, rGrip: 0.2, headX: 0.25, bodyX: 0.12 }, 's'],
    [0.42, { rArmX: -0.5, rArmZ: -0.12, rElbowX: -0.52, rGrip: 0.85, headX: 0.25, bodyX: 0.12 }, 'o'],
    [0.95, { rArmX: -1.05, rArmZ: -0.4, rElbowX: -2.0, rGrip: 0.85, headX: -0.06, bodyX: 0.03 }, 's'],
    [1.1, { rArmX: -1.08, rArmZ: -0.42, rElbowX: -2.05, rGrip: 0.85, headX: 0.1, bodyX: 0.06 }, 'i'],
    [1.3, { rArmX: -0.85, rArmZ: -0.3, rElbowX: -1.6, rGrip: 0.6, headX: 0.04 }, 's'],
    [1.5, { rArmX: -0.7, rArmZ: -0.2, rElbowX: -1.0, rGrip: 0.5, headX: 0.12 }, 's'],
    [1.7, { headX: 0.06 }, 's'], [1.9, { headX: 0.13 }, 's'], [2.1, { headX: 0.06 }, 's'], [2.3, { headX: 0.13, headZ: 0.08 }, 's'],
    [2.7, {}, 's']], base: 'first' },
  eatChew: { k: [
    [0, { rArmX: -0.55, rArmZ: -0.15, rElbowX: -0.6, rGrip: 0.4, lArmX: -0.5, lArmZ: 0.12, lElbowX: -0.9, headX: 0.18, bodyX: 0.06 }],
    [0.25, { headX: 0.1 }, 's'], [0.5, { headX: 0.18 }, 's'], [0.75, { headX: 0.1, headY: 0.25 }, 's'], [1.0, { headX: 0.16, headY: 0.3 }, 's'],
    [1.25, { headX: 0.08, headY: 0.32, headZ: 0.12 }, 's'], [1.9, { headX: 0.12, headY: 0.2, headZ: 0.1 }, 's'], [2.4, {}, 's']], base: 'first' },
  eatSip: { k: [   // leans down to the cup his left hand holds, sips, sits back with a happy sigh
    [0, { rArmX: -0.55, rArmZ: -0.15, rElbowX: -0.6, rGrip: 0.4, lArmX: -0.5, lArmZ: 0.12, lElbowX: -0.9, headX: 0.18, bodyX: 0.06 }],
    [0.5, { bodyX: 0.3, headX: 0.32, headY: -0.25, bodyY: -0.12 }, 's'],
    [1.2, { bodyX: 0.32, headX: 0.36, headY: -0.27, bodyY: -0.12 }, 's'],
    [1.7, { bodyX: -0.05, headX: -0.12, bodyLift: 0.02 }, 's'],
    [2.3, {}, 's']], base: 'first' },

  // Greeting wave: a dip, the arm comes up with a little overshoot, waves from the elbow, settles
  wave: { k: [
    [0, {}],
    [0.18, { rArmX: -0.05, rArmZ: 0.0, rElbowX: -0.3, bodyZ: -0.03, headZ: 0.04 }, 's'],
    [0.48, { rArmX: -0.2, rArmZ: 1.35, rElbowX: 0.1, rElbowZ: 1.4, rHandY: 1.5, rGrip: 0, bodyZ: 0.06, headZ: -0.15, headX: -0.08, lArmZ: -0.12 }, 'b'],
    [0.68, { rArmX: -0.2, rArmZ: 1.3, rElbowX: 0.1, rElbowZ: 1.0, rHandY: 1.5, rHandZ: -0.15, rGrip: 0, bodyZ: 0.05, headZ: -0.13, headX: -0.08, lArmZ: -0.12 }, 's'],
    [0.9, { rArmX: -0.2, rArmZ: 1.3, rElbowX: 0.1, rElbowZ: 1.65, rHandY: 1.5, rHandZ: 0.15, rGrip: 0, bodyZ: 0.06, headZ: -0.17, headX: -0.08, lArmZ: -0.12 }, 's'],
    [1.12, { rArmX: -0.2, rArmZ: 1.3, rElbowX: 0.1, rElbowZ: 1.05, rHandY: 1.5, rHandZ: -0.15, rGrip: 0, bodyZ: 0.05, headZ: -0.13, headX: -0.08, lArmZ: -0.12 }, 's'],
    [1.34, { rArmX: -0.2, rArmZ: 1.3, rElbowX: 0.1, rElbowZ: 1.55, rHandY: 1.5, rHandZ: 0.12, rGrip: 0, bodyZ: 0.06, headZ: -0.16, headX: -0.08, lArmZ: -0.12 }, 's'],
    [1.56, { rArmX: -0.2, rArmZ: 1.3, rElbowX: 0.1, rElbowZ: 1.2, rHandY: 1.5, rHandZ: -0.08, rGrip: 0, bodyZ: 0.05, headZ: -0.14, headX: -0.08, lArmZ: -0.12 }, 's'],
    [1.85, { rArmX: -0.2, rArmZ: 1.3, rElbowX: 0.1, rElbowZ: 1.35, rHandY: 1.5, rGrip: 0, bodyZ: 0.05, headZ: -0.12, headX: -0.06, lArmZ: -0.12 }, 's'],
    [2.35, {}, 's']] },
  // Thinking: hand to his chin, the other arm folded under the elbow, taps, looks up, nods
  think: { k: [
    [0, {}],
    [0.5, { rArmX: -0.8, rArmZ: -1.45, rElbowX: -1.84, rHandX: 0.2, rHandY: 0.4, rGrip: 0.65, lArmX: -0.15, lArmY: 1.0, lArmZ: 0.15, lElbowX: -1.5, lHandY: -0.3, lGrip: 0.5, headX: -0.05, headZ: 0.1, bodyX: -0.03 }, 'b'],
    [1.2, { rArmX: -0.8, rArmZ: -1.45, rElbowX: -1.84, rHandX: 0.2, rHandY: 0.4, rGrip: 0.65, lArmX: -0.15, lArmY: 1.0, lArmZ: 0.15, lElbowX: -1.5, lHandY: -0.3, lGrip: 0.5, headX: -0.12, headZ: 0.16, headY: 0.15, bodyX: -0.03 }, 's'],
    [1.45, { rElbowX: -1.9 }, 's'], [1.7, { rElbowX: -1.78 }, 's'], [1.95, { rElbowX: -1.9 }, 's'],
    [2.6, { rArmX: -0.8, rArmZ: -1.45, rElbowX: -1.84, rHandX: 0.2, rHandY: 0.4, rGrip: 0.65, lArmX: -0.15, lArmY: 1.0, lArmZ: 0.15, lElbowX: -1.5, lHandY: -0.3, lGrip: 0.5, headX: -0.3, headY: 0.35, headZ: 0.05, bodyX: -0.06 }, 's'],
    [3.1, { rArmX: -0.8, rArmZ: -1.45, rElbowX: -1.84, rHandX: 0.2, rHandY: 0.4, rGrip: 0.65, lArmX: -0.15, lArmY: 1.0, lArmZ: 0.15, lElbowX: -1.5, lHandY: -0.3, lGrip: 0.5, headX: 0.12, headY: 0.05, bodyX: 0.02 }, 'i'],
    [3.4, { rArmX: -0.8, rArmZ: -1.45, rElbowX: -1.84, rHandX: 0.2, rHandY: 0.4, rGrip: 0.65, lArmX: -0.15, lArmY: 1.0, lArmZ: 0.15, lElbowX: -1.5, lHandY: -0.3, lGrip: 0.5, headX: -0.05 }, 'O'],
    [4.0, {}, 's']], base: 'first' },
  // Celebrating a finished build: crouch, jump and spin with arms up, land soft, fist pumps, bounce
  celebrate: { k: [
    [0, {}],
    [0.28, keloClipSquat(0.14, { bodyX: 0.25, lArmX: 0.45, rArmX: 0.45, lElbowX: -0.6, rElbowX: -0.6, lGrip: 1, rGrip: 1, headX: 0.12 }), 's'],
    [0.55, { lift: 0.6, yaw: Math.PI, lArmZ: -2.8, rArmZ: 2.8, lArmX: 0, rArmX: 0, lElbowX: -0.15, rElbowX: -0.15, lGrip: 0, rGrip: 0, lLegX: -0.35, rLegX: 0.1, lKneeX: 0.8, rKneeX: 0.35, lFootX: 0.4, rFootX: 0.4, headX: -0.25, bodyX: -0.08 }, 'O'],
    [0.84, { lift: 0.0, yaw: 2 * Math.PI, lArmZ: -2.6, rArmZ: 2.6, lArmX: 0, rArmX: 0, lElbowX: -0.2, rElbowX: -0.2, lGrip: 0.5, rGrip: 0.5, headX: -0.15 }, 'i'],
    [0.85, { yaw: 0 }, 'h'],
    [0.98, keloClipSquat(0.13, { bodyX: 0.18, lArmZ: -2.3, rArmZ: 2.3, lArmX: -0.1, rArmX: -0.1, lElbowX: -0.3, rElbowX: -0.3, lGrip: 1, rGrip: 1, headX: 0.05 }), 'o'],
    [1.2, { lArmZ: -2.5, rArmZ: 2.9, lArmX: -0.1, rArmX: -0.1, lElbowX: -0.9, rElbowX: -0.3, lGrip: 1, rGrip: 1, headX: -0.2, bodyZ: 0.05, lift: 0.04 }, 'b'],
    [1.45, { lArmZ: -2.9, rArmZ: 2.5, lArmX: -0.1, rArmX: -0.1, lElbowX: -0.3, rElbowX: -0.9, lGrip: 1, rGrip: 1, headX: -0.2, bodyZ: -0.05, lift: 0.0 }, 's'],
    [1.7, { lArmZ: -2.5, rArmZ: 2.9, lArmX: -0.1, rArmX: -0.1, lElbowX: -0.9, rElbowX: -0.3, lGrip: 1, rGrip: 1, headX: -0.2, bodyZ: 0.05, lift: 0.05 }, 's'],
    [1.95, { lArmZ: -2.9, rArmZ: 2.5, lArmX: -0.1, rArmX: -0.1, lElbowX: -0.3, rElbowX: -0.9, lGrip: 1, rGrip: 1, headX: -0.2, bodyZ: -0.05, lift: 0.0 }, 's'],
    [2.3, { lArmZ: -2.2, rArmZ: 2.2, lElbowX: -1.2, rElbowX: -1.2, lGrip: 1, rGrip: 1, headX: -0.1, lift: 0.07 }, 's'],
    [2.55, keloClipSquat(0.05, { lArmZ: -1.0, rArmZ: 1.0, lElbowX: -1.2, rElbowX: -1.2, lGrip: 1, rGrip: 1 }), 's'],
    [3.0, { lArmZ: -0.3, rArmZ: 0.3, headX: -0.08 }, 's'],
    [3.5, {}, 'b']] },
  // Looking at something on the ground: crouched, head tilting, a hand reaching down to touch it
  crouchDown: { k: [
    [0, {}],
    [0.25, keloClipSquat(0.08, { bodyX: 0.2, headX: 0.3 }), 's'],
    [0.7, keloClipSquat(0.4, { bodyX: 0.42, headX: 0.38, rArmX: -0.75, rElbowX: -0.3, lArmX: -0.5, lArmZ: 0.1, lElbowX: -0.9 }), 's'],
    [0.95, keloClipSquat(0.37, { bodyX: 0.4, headX: 0.35, rArmX: -0.75, rElbowX: -0.3, lArmX: -0.5, lArmZ: 0.1, lElbowX: -0.9 }), 'b']] },
  crouchUp: { k: [
    [0, keloClipSquat(0.37, { bodyX: 0.4, headX: 0.35, rArmX: -0.75, rElbowX: -0.3, lArmX: -0.5, lArmZ: 0.1, lElbowX: -0.9 })],
    [0.25, keloClipSquat(0.4, { bodyX: 0.5, headX: 0.25 }), 's'],
    [0.7, { bodyX: -0.04, headX: -0.06 }, 'o'], [0.95, {}, 's']] },
  inspectLook: { k: [
    [0, keloClipSquat(0.37, { bodyX: 0.4, headX: 0.35, rArmX: -0.75, rElbowX: -0.3, rGrip: 0.1, lArmX: -0.5, lArmZ: 0.1, lElbowX: -0.9 })],
    [0.6, { headZ: 0.3, headY: 0.15 }, 's'], [1.4, { headZ: 0.32, headY: 0.18, headX: 0.42 }, 's'],
    [2.0, { headZ: -0.25, headY: -0.1 }, 's'], [2.8, { headZ: -0.27 }, 's'],
    [3.3, {}, 's']], base: 'first' },
  inspectTouch: { k: [
    [0, keloClipSquat(0.37, { bodyX: 0.4, headX: 0.35, rArmX: -0.75, rElbowX: -0.3, rGrip: 0.1, lArmX: -0.5, lArmZ: 0.1, lElbowX: -0.9 })],
    [0.6, { rArmX: -0.45, rElbowX: -0.05, rGrip: 0.0, rHandX: 0.3, bodyX: 0.55, headX: 0.5 }, 's'],
    [0.8, { rArmX: -0.42, rElbowX: -0.02, rGrip: 0.3, bodyX: 0.56, headX: 0.52 }, 'o'],
    [1.0, { rArmX: -0.55, rElbowX: -0.2, rGrip: 0.1, bodyX: 0.48, headX: 0.45, bodyLift: 0.02 }, 'O'],   // a little startle
    [1.7, { headZ: 0.2 }, 's'], [2.3, {}, 's']], base: 'first' },
  // Planting on one knee: kneel, scoop the hole with the trowel, set the seed in, pat it down
  kneelDown: { k: [
    [0, {}],
    [0.3, keloClipSquat(0.1, { bodyX: 0.25, headX: 0.3 }), 's'],
    [0.75, kpm(KP.kneel, { lift: KP.kneel.lift + 0.06, bodyX: 0.4, headX: 0.35, rArmX: -0.6, lArmX: -0.3 }), 's'],
    [1.0, kpm(KP.kneel, { bodyX: 0.38, headX: 0.38, rArmX: -0.6, rElbowX: -0.3, lArmX: -0.3, lArmZ: -0.2, lElbowX: -0.6 }), 'b']] },
  kneelUp: { k: [
    [0, kpm(KP.kneel, { bodyX: 0.38, headX: 0.38, rArmX: -0.6, rElbowX: -0.3, lArmX: -0.3, lArmZ: -0.2, lElbowX: -0.6 })],
    [0.35, kpm(KP.kneel, { bodyX: 0.55, headX: 0.2, lArmX: -0.4, lArmZ: 0.2, lElbowX: -1.2 }), 's'],   // hand on knee, push
    [0.8, keloClipSquat(0.2, { bodyX: 0.35, headX: 0.05 }), 's'],
    [1.1, { bodyX: -0.04 }, 'o'], [1.3, {}, 's']] },
  plantScoop: { k: [   // the trowel goes in, scoops, twists the soil out to the side and comes back
    [0, kpm(KP.kneel, { bodyX: 0.38, headX: 0.38, rArmX: -0.6, rElbowX: -0.3, lArmX: -0.3, lArmZ: -0.2, lElbowX: -0.6, rGrip: 1, tool: -0.6 })],
    [0.3, { rArmX: -0.75, rElbowX: -0.7, tool: -1.0, bodyX: 0.36 }, 's'],
    [0.45, { rArmX: -0.35, rElbowX: -0.1, tool: -0.2, bodyX: 0.48, headX: 0.45 }, 'i'],
    [0.75, { rArmX: -0.55, rElbowX: -0.35, rArmZ: 0.35, tool: -1.2, toolY: 0.9, toolZ: -0.3, bodyX: 0.42, bodyY: 0.15 }, 's'],
    [1.0, { rArmX: -0.6, rElbowX: -0.3, tool: -0.6 }, 'o'],
    [1.2, {}, 's']], base: 'first' },
  plantPat: { k: [
    [0, kpm(KP.kneel, { bodyX: 0.38, headX: 0.38, rArmX: -0.6, rElbowX: -0.3, lArmX: -0.3, lArmZ: -0.2, lElbowX: -0.6, rGrip: 1, tool: -0.6 })],
    [0.35, { lArmX: -0.55, lArmZ: 0.05, lElbowX: -0.15, lGrip: 0.1, bodyX: 0.5, headX: 0.5 }, 's'],   // sets the seed in
    [0.6, { lArmX: -0.45, lArmZ: 0.05, lElbowX: -0.05, lGrip: 0, bodyX: 0.52, headX: 0.52 }, 'o'],
    [0.75, { lArmX: -0.6, lElbowX: -0.35, lGrip: 0, bodyX: 0.5 }, 's'],   // pat
    [0.85, { lArmX: -0.45, lElbowX: -0.05, lGrip: 0, bodyX: 0.52 }, 'i'],
    [1.0, { lArmX: -0.6, lElbowX: -0.35, lGrip: 0, bodyX: 0.5 }, 's'],   // pat
    [1.1, { lArmX: -0.45, lElbowX: -0.05, lGrip: 0, bodyX: 0.52 }, 'i'],
    [1.5, { bodyX: 0.3, headX: 0.3, headZ: 0.15 }, 's'],   // looks at it, pleased
    [1.9, {}, 's']], base: 'first' },
  // Watering: can held out in front, leaning in, sweeping the rose slowly over the plants
  waterPour: { k: [
    [0, kpm(KP.stance, { lArmX: -0.95, rArmX: -0.95, lArmZ: 0.1, rArmZ: -0.1, lElbowX: -0.5, rElbowX: -0.5, bodyX: 0.18, headX: 0.38 })],
    [1.2, { lArmX: -1.0, rArmX: -1.0, lArmZ: 0.1, rArmZ: -0.1, lElbowX: -0.45, rElbowX: -0.45, bodyX: 0.22, bodyY: 0.25, headX: 0.42, headY: 0.15, bodyShift: 0.02 }, 's'],
    [2.6, { lArmX: -1.0, rArmX: -1.0, lArmZ: 0.1, rArmZ: -0.1, lElbowX: -0.45, rElbowX: -0.45, bodyX: 0.22, bodyY: -0.25, headX: 0.42, headY: -0.15, bodyShift: -0.02 }, 's'],
    [3.6, {}, 's']], base: 'first' },
  // Painting at the easel, brush in his right hand and palette in his left
  paintDab: { k: [
    [0, kpm(KP.palette, { rArmX: -1.15, rArmZ: 0.1, rElbowX: -0.7, rGrip: 0.9, bodyX: 0.06, headX: 0.05, tool: -1.3 })],
    [0.2, { rArmX: -1.2, rElbowX: -0.85 }, 's'], [0.3, { rArmX: -1.28, rElbowX: -0.55, bodyX: 0.1 }, 'i'], [0.42, { rArmX: -1.2, rElbowX: -0.8 }, 'O'],
    [0.62, { rArmX: -1.22, rArmZ: 0.2, rElbowX: -0.85 }, 's'], [0.72, { rArmX: -1.3, rArmZ: 0.2, rElbowX: -0.55, bodyX: 0.1 }, 'i'], [0.84, { rArmX: -1.22, rArmZ: 0.2, rElbowX: -0.8 }, 'O'],
    [1.04, { rArmX: -1.32, rArmZ: 0.05, rElbowX: -0.85 }, 's'], [1.14, { rArmX: -1.4, rArmZ: 0.05, rElbowX: -0.55, bodyX: 0.1 }, 'i'], [1.26, { rArmX: -1.3, rElbowX: -0.8 }, 'O'],
    [1.6, {}, 's']], base: 'first' },
  paintStroke: { k: [   // a long sweep across the canvas, the brush turned to keep its bristles on it
    [0, kpm(KP.palette, { rArmX: -1.15, rArmZ: 0.1, rElbowX: -0.7, rGrip: 0.9, bodyX: 0.06, headX: 0.05, tool: -1.3 })],
    [0.35, { rArmX: -1.4, rArmZ: -0.15, rElbowX: -0.6, bodyX: 0.1, bodyY: -0.12, headY: -0.08, tool: -1.35, toolZ: 0.35, toolY: 0.2 }, 's'],
    [1.0, { rArmX: -1.1, rArmZ: 0.45, rElbowX: -0.5, bodyX: 0.1, bodyY: 0.15, headY: 0.12, bodyShift: 0.02, tool: -1.25, toolZ: -0.4, toolY: -0.2 }, 's'],
    [1.15, { rArmX: -1.05, rArmZ: 0.5, rElbowX: -0.75, bodyX: 0.08, bodyY: 0.15, tool: -1.0, toolZ: -0.45 }, 'O'],
    [1.6, {}, 's']], base: 'first' },
  paintMix: { k: [   // dips the brush on the palette
    [0, kpm(KP.palette, { rArmX: -1.15, rArmZ: 0.1, rElbowX: -0.7, rGrip: 0.9, bodyX: 0.06, headX: 0.05, tool: -1.3 })],
    [0.45, { rArmX: -0.7, rArmZ: -0.35, rArmY: -0.3, rElbowX: -1.2, headX: 0.35, headY: -0.3, lArmX: -0.75, lArmZ: -0.15, lElbowX: -1.2 }, 's'],
    [0.6, { rArmX: -0.65, rArmZ: -0.38, rArmY: -0.3, rElbowX: -1.15, headX: 0.38, headY: -0.32, lArmX: -0.75, lArmZ: -0.15, lElbowX: -1.2 }, 's'],
    [0.75, { rArmX: -0.72, rArmZ: -0.33, rArmY: -0.3, rElbowX: -1.22, headX: 0.36, headY: -0.3, lArmX: -0.75, lArmZ: -0.15, lElbowX: -1.2 }, 's'],
    [1.25, {}, 's']], base: 'first' },
  paintLook: { k: [   // steps back, head on one side, looks at it
    [0, kpm(KP.palette, { rArmX: -1.15, rArmZ: 0.1, rElbowX: -0.7, rGrip: 0.9, bodyX: 0.06, headX: 0.05, tool: -1.3 })],
    [0.6, { bodyX: -0.08, bodyShift: -0.03, headZ: 0.22, headX: -0.02, rArmX: -0.6, rArmZ: -0.05, rElbowX: -1.5, rHandX: 0.2 }, 's'],
    [1.5, { bodyX: -0.08, bodyShift: -0.03, headZ: -0.15, headX: 0.02, rArmX: -0.6, rArmZ: -0.05, rElbowX: -1.5, rHandX: 0.2 }, 's'],
    [1.75, { bodyX: -0.06, headZ: -0.1, headX: 0.15, rArmX: -0.6, rArmZ: -0.05, rElbowX: -1.5 }, 's'],   // nods
    [2.3, {}, 's']], base: 'first' },
  // Fishing: wind back over his shoulder, whip the cast out, follow through; wait; reel in
  fishCast: { k: [
    [0, kpm(KP.stance, { rod: 0.55, bodyX: 0.05, headX: 0.1, lGrip: 0.9, rGrip: 0.9 })],
    [0.6, { rod: -0.55, rodZ: -0.35, bodyX: -0.12, bodyY: 0.25, headX: -0.1, lLegX: -0.15, rLegX: 0.15, rKneeX: 0.2 }, 's'],
    [0.7, { rod: -0.62, rodZ: -0.38, bodyX: -0.13, bodyY: 0.27, headX: -0.12, lLegX: -0.15, rLegX: 0.15, rKneeX: 0.2 }, 'o'],
    [0.9, { rod: 1.35, rodZ: 0.12, bodyX: 0.28, bodyY: -0.15, headX: 0.05, lLegX: -0.3, lKneeX: 0.35, rLegX: 0.2 }, 'i'],
    [1.25, { rod: 0.95, rodZ: 0.04, bodyX: 0.15, bodyY: -0.05, headX: 0.0, lLegX: -0.25, lKneeX: 0.28, rLegX: 0.2 }, 'O'],
    [1.7, kpm(KP.stance, { rod: 0.9, bodyX: 0.08, headX: 0.05 }), 's']] },
  fishWait: { k: [
    [0, kpm(KP.stance, { rod: 0.9, bodyX: 0.08, headX: 0.05, lGrip: 0.9, rGrip: 0.9 })],
    [1.4, { rod: 0.86, headY: 0.2, headZ: 0.12 }, 's'], [2.6, { rod: 0.92, headY: -0.15 }, 's'],
    [3.0, { rod: 0.8, headX: 0.12 }, 'i'], [3.4, { rod: 0.9 }, 'O'],   // a little twitch of the line
    [4.4, {}, 's']], base: 'first' },
  fishWaitSway: { k: [
    [0, kpm(KP.stance, { rod: 0.9, bodyX: 0.08, headX: 0.05, lGrip: 0.9, rGrip: 0.9 })],
    [1.5, { rod: 0.88, bodyShift: 0.04, bodyZ: 0.04, headZ: -0.1 }, 's'],
    [3.0, { rod: 0.9, bodyShift: -0.03, bodyZ: -0.03, headZ: 0.08 }, 's'],
    [4.0, {}, 's']], base: 'first' },
  fishReel: { k: [
    [0, kpm(KP.stance, { rod: 0.5, bodyX: -0.12, headX: 0.1, lGrip: 1, rGrip: 1, lLegX: -0.3, lKneeX: 0.25 })],
    [0.2, { rod: 0.25, bodyX: -0.2, headX: 0.05, lLegX: -0.3, lKneeX: 0.25 }, 'i'],
    [0.45, { rod: 0.55, bodyX: -0.08, headX: 0.15, lLegX: -0.3, lKneeX: 0.25 }, 'O'],
    [0.6, { rod: 0.45, bodyX: -0.12, lLegX: -0.3, lKneeX: 0.25 }, 's']], base: 'first', z: [0, 0.6, 9, { bodyZ: 0.02, headZ: 0.04 }] },
  fishShow: { k: [   // holds his catch up and admires it
    [0, kpm(KP.stance, { rod: 0.3, bodyX: -0.08, headX: -0.25 })],
    [0.5, { rod: 0.3, bodyX: -0.1, headX: -0.3, headZ: 0.15, lift: 0.03 }, 'b'],
    [1.2, { rod: 0.3, bodyX: -0.08, headX: -0.28, headZ: -0.12, lift: 0 }, 's'],
    [1.8, {}, 's']], base: 'first' },
  // Flying the kite: hands up holding the line, tugging it in, letting it run
  kiteHold: { k: [
    [0, kpm(KP.stance, { lArmX: -1.3, rArmX: -1.35, lArmZ: 0.1, rArmZ: -0.05, lElbowX: -0.6, rElbowX: -0.5, lGrip: 1, rGrip: 1, headX: -0.4, bodyX: -0.06 })],
    [1.2, { lArmX: -1.4, rArmX: -1.45, headX: -0.45, headY: 0.12, bodyZ: 0.03 }, 's'],
    [2.4, { lArmX: -1.25, rArmX: -1.3, headX: -0.38, headY: -0.1, bodyZ: -0.03 }, 's'],
    [3.0, {}, 's']], base: 'first' },
  kiteTug: { k: [
    [0, kpm(KP.stance, { lArmX: -1.3, rArmX: -1.35, lArmZ: 0.1, rArmZ: -0.05, lElbowX: -0.6, rElbowX: -0.5, lGrip: 1, rGrip: 1, headX: -0.4, bodyX: -0.06 })],
    [0.25, { lArmX: -1.5, rArmX: -1.55, lElbowX: -0.4, rElbowX: -0.3, headX: -0.45 }, 's'],
    [0.4, { lArmX: -0.85, rArmX: -0.9, lElbowX: -1.1, rElbowX: -1.0, bodyX: -0.16, headX: -0.42, lLegX: -0.25, lKneeX: 0.3, lift: -0.02 }, 'i'],
    [0.7, { lArmX: -1.0, rArmX: -1.05, lElbowX: -0.95, rElbowX: -0.85, bodyX: -0.12, headX: -0.42, lLegX: -0.25, lKneeX: 0.3 }, 'O'],
    [1.3, {}, 's']], base: 'first' },
  // Getting into a vehicle: grab, step up, swing in, settle; and out again
  getIn: { k: [
    [0, { root: 1, tilt: 1 }],
    [0.3, keloClipSquat(0.08, { rArmX: -1.7, rArmZ: 0.2, rElbowX: -0.6, rGrip: 1, lArmX: -0.4, bodyX: 0.12, headX: -0.15, root: 1, tilt: 1 }), 's'],
    [0.65, { lLegX: -1.2, lKneeX: 1.3, rLegX: -0.3, rKneeX: 0.4, rArmX: -1.5, rElbowX: -1.0, rGrip: 1, bodyX: 0.25, lift: 0.08, root: 0.55, tilt: 0.6 }, 's'],
    [1.0, kpm(KP.chair, PKW(), { bodyX: -0.06, headX: -0.06, root: 0.08, tilt: 0 }), 's'],
    [1.25, kpm(KP.chair, PKW(), { bodyX: 0.03, root: 0 }), 'b']] },
  getOut: { k: [
    [0, kpm(KP.chair, PKW(), { root: 1, tilt: 1 })],
    [0.3, kpm(KP.chair, { bodyX: 0.25, bodyY: 0.3, headY: 0.4, lArmX: -0.4, rArmX: -1.5, rElbowX: -0.7, rGrip: 1, root: 1, tilt: 1 }), 's'],
    [0.75, { lLegX: -0.9, lKneeX: 1.0, rLegX: -0.4, rKneeX: 0.5, bodyX: 0.2, bodyY: 0.1, rArmX: -1.4, rGrip: 1, lift: -0.05, root: 0.35, tilt: 0.3 }, 's'],
    [1.05, keloClipSquat(0.1, { bodyX: 0.12, root: 0, tilt: 0 }), 'o'],
    [1.35, { root: 0 }, 'b']] },
  drive: { k: [
    [0, kpm(PKW(), { bodyX: 0.03, headX: 0 })],
    [1.5, { lArmX: -0.6, rArmX: -0.66, headY: 0.06 }, 's'], [3.0, { lArmX: -0.66, rArmX: -0.6, headY: -0.06 }, 's'],
    [4.0, {}, 's']], base: 'first' },
  driveLook: { k: [   // checks a mirror, then the other way
    [0, kpm(PKW(), { bodyX: 0.03 })],
    [0.5, { headY: 0.75, headX: -0.05, bodyY: 0.08 }, 's'], [1.2, { headY: 0.78 }, 's'],
    [1.7, { headY: -0.6, bodyY: -0.05 }, 's'], [2.3, { headY: -0.62 }, 's'],
    [2.9, {}, 's']], base: 'first' },
  // Picking something up and putting it down (one-shots on top of whatever he is doing)
  pickUp: { k: [
    [0, {}],
    [0.32, keloClipSquat(0.32, { bodyX: 0.55, headX: 0.5, lArmX: -0.55, rArmX: -0.55, lElbowX: -0.25, rElbowX: -0.25, lGrip: 0.2, rGrip: 0.2 }), 's'],
    [0.45, keloClipSquat(0.33, { bodyX: 0.55, headX: 0.48, lArmX: -0.55, rArmX: -0.55, lElbowX: -0.3, rElbowX: -0.3, lGrip: 1, rGrip: 1 }), 'o'],
    [0.85, { bodyX: -0.04, headX: 0.12 }, 's'], [1.05, {}, 'b']] },
  pickUpHeavy: { k: [
    [0, {}],
    [0.38, keloClipSquat(0.4, { bodyX: 0.45, headX: 0.45, lArmX: -0.5, rArmX: -0.5, lElbowX: -0.2, rElbowX: -0.2, lGrip: 0.2, rGrip: 0.2 }), 's'],
    [0.55, keloClipSquat(0.42, { bodyX: 0.42, headX: 0.3, lArmX: -0.5, rArmX: -0.5, lElbowX: -0.25, rElbowX: -0.25, lGrip: 1, rGrip: 1 }), 'o'],
    [1.1, keloClipSquat(0.22, { bodyX: 0.2, headX: -0.1, lGrip: 1, rGrip: 1 }), 's'],   // the effort of lifting it
    [1.45, { bodyX: -0.12, headX: -0.05, bodyLift: 0.02 }, 's'], [1.75, {}, 'b']] },
  putDown: { k: [
    [0, {}],
    [0.35, keloClipSquat(0.3, { bodyX: 0.5, headX: 0.5, lArmX: -0.5, rArmX: -0.5, lElbowX: -0.3, rElbowX: -0.3, lGrip: 0.9, rGrip: 0.9 }), 's'],
    [0.5, keloClipSquat(0.31, { bodyX: 0.52, headX: 0.5, lArmX: -0.5, rArmX: -0.5, lElbowX: -0.3, rElbowX: -0.3, lGrip: 0, rGrip: 0 }), 'o'],
    [0.85, { bodyX: 0.0, headX: 0.15, lArmX: -0.3, rArmX: -0.3, lGrip: 0, rGrip: 0 }, 's'],
    [1.0, { lArmZ: -0.2, rArmZ: 0.2, lElbowX: -0.5, rElbowX: -0.5, lHandZ: 0.3, rHandZ: -0.3 }, 's'],   // brushes his hands
    [1.15, { lArmZ: -0.15, rArmZ: 0.15, lElbowX: -0.5, rElbowX: -0.5, lHandZ: -0.3, rHandZ: 0.3 }, 's'],
    [1.4, {}, 's']] },
  // From and onto something high (a shelf, a table): no squat, arms up and out, up on his toes a little
  pickHigh: { k: [
    [0, {}],
    [0.3, { lArmX: -1.35, rArmX: -1.35, lElbowX: -0.35, rElbowX: -0.35, bodyX: 0.12, headX: -0.05, lGrip: 0.2, rGrip: 0.2, lift: 0.02 }, 's'],
    [0.42, { lArmX: -1.4, rArmX: -1.4, lElbowX: -0.3, rElbowX: -0.3, bodyX: 0.14, headX: 0, lGrip: 1, rGrip: 1, lift: 0.02 }, 'o'],
    [0.8, { lArmX: -0.6, rArmX: -0.6, lElbowX: -1.0, rElbowX: -1.0, bodyX: -0.03, headX: 0.1, lGrip: 1, rGrip: 1 }, 's'], [1.0, {}, 'b']] },
  putHigh: { k: [
    [0, {}],
    [0.35, { lArmX: -1.4, rArmX: -1.4, lElbowX: -0.3, rElbowX: -0.3, bodyX: 0.15, headX: 0, lGrip: 0.9, rGrip: 0.9, lift: 0.02 }, 's'],
    [0.5, { lArmX: -1.38, rArmX: -1.38, lElbowX: -0.32, rElbowX: -0.32, bodyX: 0.15, lGrip: 0, rGrip: 0, lift: 0.02 }, 'o'],
    [0.9, { lArmX: -0.3, rArmX: -0.3, headX: 0.1, lGrip: 0, rGrip: 0 }, 's'], [1.1, {}, 's']] },
  // Carrying: a light thing held easily; a heavy one leaned back against, hoisted now and then
  carryLight: { k: [[0, { bodyX: -0.02, headX: 0.05 }], [1.6, { headX: 0.12, headY: 0.1 }, 's'], [3.2, {}, 's']], base: 'first' },
  carryHeavy: { k: [
    [0, { bodyX: -0.12, headX: -0.06, bodyLift: -0.015, lElbowX: -0.85, rElbowX: -0.85 }],
    [1.8, { bodyX: -0.1, headX: -0.04, bodyLift: -0.015, lElbowX: -0.85, rElbowX: -0.85 }, 's'],
    [2.0, { bodyX: -0.16, headX: -0.1, bodyLift: 0.02, lElbowX: -1.05, rElbowX: -1.05 }, 'i'],   // hoists it up again
    [2.35, { bodyX: -0.12, headX: -0.06, bodyLift: -0.015, lElbowX: -0.85, rElbowX: -0.85 }, 'O'],
    [3.0, {}, 's']], base: 'first' }
};
// The hands-on-the-wheel pose (a function so the data above can use it before the constant is made)
function PKW() { return KP.wheel; }

// --- Actions -------------------------------------------------------------------------------------------
// in/out: enter and exit clips; loop: clips picked at random each time round; grp: actions in the
// same group switch by crossfading their loops (sitting stays seated); hold: he gets up before he
// walks off; grip: where up a held tool's handle his hands are (0.8 near the top, 0.15 near the end: a
// pickaxe or axe head swings out on the far end); ride: allowed (legs too) while riding; bi/bo: blend in/out seconds; mode: keloAnim.mode
const KELO_ACTS = {
  sit: { in: 'sitDown', loop: ['sitIdle', 'sitIdle', 'sitFeet'], out: 'standUp', grp: 'seat', hold: 1 },
  type: { in: 'sitDown', loop: ['typeBurst', 'typeBurst', 'typePause'], out: 'standUp', grp: 'seat', hold: 1, add: KP.chair },
  eat: { in: 'sitDown', loop: ['eatBite', 'eatChew', 'eatBite', 'eatSip'], out: 'standUp', grp: 'seat', hold: 1, add: KP.chair },
  typeStand: { loop: ['typeBurst', 'typeBurst', 'typePause'] },
  sitGround: { in: 'sitDownGround', loop: ['shoreIdle', 'shoreLook'], out: 'standUpGround', hold: 1 },
  sleep: { in: 'lieDown', loop: ['sleepBreathe', 'sleepBreathe', 'sleepShift'], out: 'wake', hold: 1, bi: 0.1 },
  doze: { in: 'collapse', loop: ['sleepBreathe', 'sleepShift'], out: 'wake', hold: 1, bi: 0.1 },
  dig: { loop: ['dig', 'dig', 'dig', 'digRest'], mode: 'dig', sep: 0.32 },
  pick: { loop: ['pick'], mode: 'dig', grip: 0.15, sep: 0.13 },
  chop: { loop: ['chop'], mode: 'dig', grip: 0.15, sep: 0.13 },
  rake: { loop: ['rake'], mode: 'dig', sep: 0.35 },
  drill: { loop: ['drill'], mode: 'dig' },
  jackhammer: { loop: ['jackhammer'], mode: 'dig' },
  plant: { in: 'kneelDown', loop: ['plantScoop', 'plantScoop', 'plantPat'], out: 'kneelUp', hold: 1, mode: 'dig', hand: 'r' },
  weld: { in: 'weldIn', loop: ['weldBead', 'weldBead', 'weldLook'], mode: 'weld' },
  hammer: { loop: ['hammer'] },
  saw: { loop: ['saw'] },
  sand: { loop: ['sand'] },
  drillBench: { loop: ['drillBench'] },
  twist: { loop: ['twist'] },
  machine: { loop: ['machinePress', 'machinePress', 'machineCheck', 'machineWait'] },
  greet: { loop: ['wave'] },
  think: { loop: ['think'] },
  celebrate: { loop: ['celebrate'] },
  inspect: { in: 'crouchDown', loop: ['inspectLook', 'inspectTouch'], out: 'crouchUp', hold: 1 },
  water: { loop: ['waterPour'], bi: 0.5 },
  paint: { loop: ['paintDab', 'paintStroke', 'paintStroke', 'paintMix', 'paintLook'], hand: 'r' },
  fish: { in: 'fishCast', loop: ['fishWait', 'fishWaitSway'] },
  fishReel: { loop: ['fishReel'] },
  fishShow: { loop: ['fishShow'] },
  kite: { loop: ['kiteHold', 'kiteHold', 'kiteTug'] },
  drive: { in: 'getIn', loop: ['drive', 'drive', 'driveLook'], out: 'getOut', ride: 1, hold: 1, bi: 0.1 }
};

// --- Compiling the clips (once, at load) ----------------------------------------------------------------
const KELO_CLIPS = (() => {
  const all = {};
  const easeCode = { l: 0, s: 1, i: 2, o: 3, O: 4, b: 5, h: 6 };
  for (const name in KELO_CLIP_DEFS) {
    const def = KELO_CLIP_DEFS[name];
    const keys = def.k.map(([t, p, e]) => [t, Array.isArray(p) ? Object.assign({}, ...p) : p, e || 's']);
    const used = new Set();
    keys.forEach(([, p]) => Object.keys(p).forEach(ch => { if (ch in KELO_CLIP_IDX) used.add(ch); }));
    if (def.z) Object.keys(def.z[3]).forEach(ch => used.add(ch));
    // a channel a key leaves out: the first key's value ('first' clips: loops that start and end
    // on the same pose), else standing
    const first = keys[0][1];
    const fill = (ch, p) => ch in p ? p[ch] : def.base === 'first' && ch in first ? first[ch] : (KELO_STAND[ch] || 0);
    const chans = [...used].map(ch => KELO_CLIP_IDX[ch]).sort((a, b) => a - b);
    const n = keys.length;
    const V = chans.map(c => Float32Array.from(keys, ([, p]) => fill(KELO_CLIP_CHANNELS[c], p)));
    const lag = chans.map(c => {
      const ch = KELO_CLIP_CHANNELS[c];
      return c >= KELO_CLIP_SPECIAL || ch === 'yaw' ? 0 : KELO_CLIP_LAG[ch.slice(0, -1)] || 0;
    });
    const Z = def.z ? { from: def.z[0], to: def.z[1], f: def.z[2], amp: chans.map(c => def.z[3][KELO_CLIP_CHANNELS[c]] || 0) } : null;
    all[name] = {
      name, d: keys[n - 1][0], n, T: Float32Array.from(keys, k => k[0]), E: Uint8Array.from(keys, k => easeCode[k[2]] ?? 1),
      chans, V, lag, Z, root: used.has('root') || used.has('tilt')
    };
  }
  return all;
})();
for (const k in KELO_ACTS) {
  const A = KELO_ACTS[k];
  A.name = k;
  if (A.add) A.addIdx = Object.keys(A.add).filter(ch => ch in KELO_CLIP_IDX).map(ch => [KELO_CLIP_IDX[ch], A.add[ch]]);
}

function keloClipEase(e, u) {
      switch (e) {
        case 0: return u;
        case 2: return u * u;
        case 3: return 1 - (1 - u) * (1 - u);
        case 4: return 1 - (1 - u) * (1 - u) * (1 - u);
        case 5: { const c = 1.4, v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; }
        case 6: return u < 1 ? 0 : 1;
        default: return u * u * (3 - 2 * u);
      }
    }

// Write clip `C` at time `t` into vals (and mark mask); loop wraps the overlap-lagged time
function keloClipSample(C, t, loop, vals, mask) {
      const T = C.T, n = C.n, d = C.d;
      for (let j = 0; j < C.chans.length; j++) {
        let tt = t - C.lag[j];
        if (loop && d > 0) tt = ((tt % d) + d) % d;
        else tt = tt < 0 ? 0 : tt > d ? d : tt;
        let i = 0;
        while (i < n - 2 && tt >= T[i + 1]) i++;
        const v = C.V[j];
        let val;
        if (n === 1 || tt <= T[0]) val = v[0];
        else if (tt >= T[n - 1]) val = v[n - 1];
        else {
          const span = T[i + 1] - T[i];
          const u = span > 0 ? (tt - T[i]) / span : 1;
          val = v[i] + (v[i + 1] - v[i]) * keloClipEase(C.E[i + 1], u);
        }
        if (C.Z && C.Z.amp[j] && t > C.Z.from && t < C.Z.to) {
          const fade = Math.min(1, (t - C.Z.from) * 8, (C.Z.to - t) * 8);
          val += C.Z.amp[j] * fade * (Math.sin(t * C.Z.f * 6.283) * 0.7 + Math.sin(t * C.Z.f * 4.1) * 0.3);
        }
        const c = C.chans[j];
        vals[c] = val; mask[c] = 1;
      }
    }

// --- Runtime state --------------------------------------------------------------------------------------
const KELO_CLIP_N = KELO_CLIP_CHANNELS.length;
const keloClip = {
  req: null, opts: null, hint: null, hintOpts: null, optsNow: null,
  cur: null,            // { A, phase: 'in'|'loop'|'out', clip, t, sp, last }
  prev: null,           // { clip, t, loop, k, rate } fading out under the current one
  w: 0, wv: 0,          // how much of the clip is showing (0..1, eased)
  ch: {},               // the special channels this frame (tool, lit, reach, rod...)
  hand: null,           // 'r' when a held thing goes in his right hand
  root: { k: 0, kt: 0, O: null, tx: 0, ty: 0, tz: 0, cap: false, siteX: 0, siteZ: 0 },
  last: null, lastRot: { x: 0, y: 0, z: 0 },
  shot: null,           // a one-shot on top: { clip, t }
  carried: undefined, carryCur: null, carryT: 0, carryW: 0,
  riding: false,
  vals: new Float32Array(KELO_CLIP_N), mask: new Uint8Array(KELO_CLIP_N),
  pv: new Float32Array(KELO_CLIP_N), pm: new Uint8Array(KELO_CLIP_N),
  ev: new Float32Array(KELO_CLIP_N), em: new Uint8Array(KELO_CLIP_N)
};

// Ask for an action this frame (from pose code). Unknown names are ignored.
function keloAction(name, opts) {
      if (!KELO_ACTS[name]) return false;
      keloClip.req = name;
      keloClip.opts = opts || null;
      if (KELO_ACTS[name].mode) keloAnim.mode = KELO_ACTS[name].mode;
      return true;
    }
// A sticky hint from job code: the action plays while he stands still, until keloDoing(null)
function keloDoing(name, opts) {
      keloClip.hint = name && KELO_ACTS[name] ? name : null;
      keloClip.hintOpts = opts || null;
    }
// Whether he is still getting up (walking waits for it)
function keloClipHolds() {
      const c = keloClip.cur;
      return Boolean(c && c.phase === 'out' && c.A.hold && !keloClip.riding) || (typeof keloHandoffBusy === 'function' && keloHandoffBusy());
    }
// Play a one-shot clip on top of whatever he is doing (picking up, putting down)
function keloClipShot(name) {
      if (KELO_CLIPS[name]) keloClip.shot = { clip: KELO_CLIPS[name], t: 0 };
    }
function keloClipActive() { return Boolean(keloClip.cur) || keloClip.w > 0.05; }
// A special channel's value this frame (tool, lit, reach, rod), or `def`
function keloClipValue(ch, def = 0) {
      const v = keloClip.ch[ch];
      return v === undefined ? def : v;
    }

function keloClipStartPhase(cur, phase) {
      const C = keloClip, A = cur.A;
      let name = phase === 'in' ? A.in : phase === 'out' ? A.out : null;
      if (phase === 'loop') {
        const L = A.loop, prevName = cur.clip && cur.clip.name;
        name = L[Math.floor(Math.random() * L.length)];
        if (L.length > 1 && name === prevName && Math.random() < 0.6) name = L[(L.indexOf(name) + 1) % L.length];
      }
      const clip = KELO_CLIPS[name];
      // a short crossfade from wherever the last clip was, so nothing ever snaps
      if (cur.clip) C.prev = { clip: cur.clip, t: cur.t, loop: false, k: 1, rate: 1 / 0.18 };
      cur.phase = phase;
      cur.clip = clip;
      cur.t = 0;
      cur.sp = phase === 'loop' ? 0.9 + Math.random() * 0.22 : 1;
      if (clip.root) C.root.cap = true;
    }

function keloClipStart(name) {
      const C = keloClip, A = KELO_ACTS[name];
      const cur = { A, phase: null, clip: null, t: 0, sp: 1 };
      C.cur = cur;
      keloClipStartPhase(cur, A.in ? 'in' : 'loop');
      C.hand = A.hand || null;
    }

function keloClipEnd() {
      const C = keloClip, cur = C.cur;
      if (!cur) return;
      C.prev = { clip: cur.clip, t: cur.t, loop: cur.phase === 'loop', k: 1, rate: 1 / (cur.A.bo || 0.35) };
      C.cur = null;
      C.hand = null;
    }

// --- Every frame, from finishKeloPose(), after the spring blend and before the walk cycle ---------------
function keloClipLayer(out, t, dt, ctx) {
      const C = keloClip;
      // Getting into a vehicle: the riding code asks for 'drive' (vehicles.js)
      C.riding = Boolean(ctx.riding);
      let want = C.req, opts = C.opts;
      if (!want && C.hint && !ctx.walking && !ctx.riding && !ctx.resting) { want = C.hint; opts = C.hintOpts; }
      C.req = null; C.opts = null;
      if (want) C.optsNow = opts;
      if (want && ctx.riding && !KELO_ACTS[want].ride) want = null;
      // His site's rotation before finishKeloPose rewrites it (the tilt offset is taken from it)
      C.root.siteX = keloGroup.rotation.x; C.root.siteZ = keloGroup.rotation.z;

      let cur = C.cur;
      if (cur && cur.A.name !== want && cur.phase !== 'out') {
        const B = want && KELO_ACTS[want];
        if (B && cur.A.grp && cur.A.grp === B.grp) { cur.A = B; keloClipStartPhase(cur, 'loop'); C.hand = B.hand || null; }
        else if (cur.A.out) keloClipStartPhase(cur, 'out');
        else keloClipEnd();
      }
      if (!C.cur && want) keloClipStart(want);
      cur = C.cur;
      if (cur) {
        if (cur.A.mode && cur.phase !== 'out') keloAnim.mode = cur.A.mode;
        // Getting up when he's already been sent somewhere: a little quicker
        cur.t += dt * cur.sp * (cur.phase === 'out' && (ctx.walking || keloClipHolds()) ? 1.25 : 1);
        if (cur.t >= cur.clip.d) {
          if (cur.phase === 'in') keloClipStartPhase(cur, 'loop');
          else if (cur.phase === 'loop') keloClipStartPhase(cur, 'loop');
          else { keloClipEnd(); if (want) keloClipStart(want); }
        }
      }
      cur = C.cur;
      // Blend weight: eased in and out
      const A = cur ? cur.A : null;
      const wantW = cur ? 1 : 0;
      const rate = cur ? 1 / (A.bi || (A.in ? 0.2 : 0.4)) : (C.prev ? C.prev.rate : 3);
      C.w = wantW ? Math.min(1, C.w + rate * dt) : Math.max(0, C.w - rate * dt);
      if (C.prev) {
        C.prev.t += C.prev.loop ? dt : 0;
        C.prev.k -= dt * C.prev.rate;
        if (C.prev.k <= 0 && cur) C.prev = null;
        if (!cur && C.w <= 0) C.prev = null;
      }
      const W = smoothstep(C.w);
      const vals = C.vals, mask = C.mask;
      mask.fill(0);
      for (const k in C.ch) C.ch[k] = undefined;
      if (W > 0.0005 && (cur || C.prev)) {
        if (cur) keloClipSample(cur.clip, cur.t, cur.phase === 'loop', vals, mask);
        if (cur && cur.phase === 'loop' && A.addIdx) for (const [c, v] of A.addIdx) { vals[c] = v; mask[c] = 1; }
        if (C.prev) {
          const pv = C.pv, pm = C.pm;
          pm.fill(0);
          keloClipSample(C.prev.clip, C.prev.t, C.prev.loop, pv, pm);
          const k = cur ? smoothstep(Math.max(0, C.prev.k)) : 1;
          for (let c = 0; c < KELO_CLIP_N; c++) {
            if (!pm[c] && !mask[c]) continue;
            if (mask[c] && (c === KELO_CLIP_IDX.root || c === KELO_CLIP_IDX.tilt)) continue;   // (never crossfaded: they are offsets)
            const ch = KELO_CLIP_CHANNELS[c];
            const base = c >= KELO_CLIP_SPECIAL ? (ch === 'reach' ? 1 : 0) : out[ch] !== undefined ? out[ch] : 0;
            const a = pm[c] ? pv[c] : base, b = mask[c] ? vals[c] : base;
            vals[c] = a + (b - a) * (1 - k);
            mask[c] = 1;
          }
        }
        keloClipApply(out, vals, mask, W, ctx, A);
        // the fishing rod swings with the clip (js/pastimes.js hands it over)
        const rod = C.optsNow && C.optsNow.rod;
        if (rod && C.ch.rod !== undefined) rod.rotation.x += (C.ch.rod - rod.rotation.x) * W;
        if (rod) rod.rotation.z += ((C.ch.rodZ || 0) - rod.rotation.z) * W;
      }
      keloClipOneShots(out, t, dt, ctx);
    }

function keloClipApply(out, vals, mask, W, ctx, A) {
      const C = keloClip;
      const upperOnly = (ctx.walking && !(A && A.ride && ctx.riding)) || (ctx.riding && !(A && A.ride));
      const legsW = 1 - keloAnim.walkW;
      for (let c = 0; c < KELO_CLIP_N; c++) {
        if (!mask[c]) continue;
        const ch = KELO_CLIP_CHANNELS[c], v = vals[c];
        if (c >= KELO_CLIP_SPECIAL) { C.ch[ch] = v; continue; }
        if (upperOnly && !KELO_CLIP_UPPER[c]) continue;
        const w = KELO_CLIP_LEGS[c] ? W * legsW : W;
        if (ch === 'lift' || ch === 'yaw') out[ch] += v * w;
        else out[ch] += (v - out[ch]) * w;
      }
      // the special channels fade with the clip (reach toward 1, the rest toward 0)
      if (C.ch.reach !== undefined) C.ch.reach = 1 + (C.ch.reach - 1) * W;
      if (C.ch.root !== undefined && !C.cur) C.ch.root = 0;
    }

// Picking up and putting down, and carrying light or heavy things, on top of everything else
function keloClipOneShots(out, t, dt, ctx) {
      const C = keloClip;
      const carried = typeof carriedObject !== 'undefined' ? carriedObject : null;
      // (picking up and putting down are started by the hand-off, js/kelo-handoff.js: keloClipShot)
      const vals = C.vals, mask = C.mask;
      if (C.shot) {
        const S = C.shot;
        S.t += dt;
        if (S.t >= S.clip.d || ctx.riding || ctx.resting) C.shot = null;
        else {
          mask.fill(0);
          keloClipSample(S.clip, S.t, false, vals, mask);
          const w = Math.min(1, S.t / 0.12, (S.clip.d - S.t) / 0.15);
          keloClipApply(out, vals, mask, smoothstep(w), ctx, null);
        }
      }
      // Carrying
      const holding = carried && carried.parent === keloGroup && !ctx.riding && !ctx.resting && (keloAnim.mode === 'walk' || keloAnim.mode === 'idle') && !C.cur;
      let clip = null;
      if (holding) {
        const s = typeof keloCarrySize === 'function' ? keloCarrySize(carried) : null;
        clip = KELO_CLIPS[s && (s.x * s.y * s.z > 0.09 || Math.max(s.x, s.y, s.z) > 0.95) ? 'carryHeavy' : 'carryLight'];
      }
      if (clip) C.carryCur = clip;
      C.carryW = dampTo(C.carryW, clip ? 1 : 0, 4, dt);
      if (C.carryW > 0.01 && C.carryCur) {
        C.carryT += dt;
        mask.fill(0);
        keloClipSample(C.carryCur, C.carryT, true, vals, mask);
        keloClipApply(out, vals, mask, C.carryW, { walking: false, riding: false }, null);
      }
    }

// After finishKeloPose has placed him: glide from where he was to where the code put him (sitting
// down onto a seat, lying on the bed, climbing into a cab), by the clip's root and tilt channels
function keloClipRoot(dt) {
      const C = keloClip, R = C.root, P = keloGroup.position, rot = keloGroup.rotation;
      if (!R.O) R.O = new THREE.Vector3();
      const kp = C.ch.root !== undefined ? C.ch.root : 0;
      const kt = C.ch.tilt !== undefined ? C.ch.tilt : kp;
      if (R.cap) {
        R.cap = false;
        if (C.last) {
          R.O.subVectors(C.last, P);
          if (R.O.length() > 6) R.O.set(0, 0, 0);   // a teleport, not a seat
          R.tx = C.lastRot.x - R.siteX;
          R.ty = Math.atan2(Math.sin(C.lastRot.y - rot.y), Math.cos(C.lastRot.y - rot.y));
          R.tz = C.lastRot.z - R.siteZ;
          // (the damped whole-body tilt starts from the code's own now; the offset carries the rest)
          keloAnim.groupX = R.siteX; keloAnim.groupZ = R.siteZ;
          rot.x = R.siteX; rot.z = R.siteZ;
        } else { R.O.set(0, 0, 0); R.tx = R.ty = R.tz = 0; }
        R.k = kp; R.kt = kt;
        if (typeof keloMotion !== 'undefined' && keloMotion.root && keloMotion.root.corr) {
          keloMotion.root.corr.set(0, 0, 0);
          if (keloMotion.root.vel) keloMotion.root.vel.set(0, 0, 0);
          R.reprev = true;
        }
      } else {
        // (an interrupted clip lets go quickly but never snaps)
        R.k = Math.abs(kp - R.k) > 0.15 ? dampTo(R.k, kp, 14, dt) : kp;
        R.kt = Math.abs(kt - R.kt) > 0.15 ? dampTo(R.kt, kt, 14, dt) : kt;
      }
      if (R.k > 1e-4) P.addScaledVector(R.O, R.k);
      if (R.kt > 1e-4) { rot.x += R.tx * R.kt; rot.y += R.ty * R.kt; rot.z += R.tz * R.kt; }
      if (R.reprev) { R.reprev = false; if (keloMotion.root.prev) keloMotion.root.prev.copy(P); }
    }

// The end of the frame: where he really is (the next clip's root offset starts from here)
function keloClipEndFrame() {
      const C = keloClip;
      if (!C.last) C.last = new THREE.Vector3();
      C.last.copy(keloGroup.position);
      C.lastRot.x = keloGroup.rotation.x; C.lastRot.y = keloGroup.rotation.y; C.lastRot.z = keloGroup.rotation.z;
    }

// An action as an emote (wave, think, celebrate, sit): the pose e seconds in, r seconds left
function keloActPose(name, e, r) {
      const A = KELO_ACTS[name], out = {};
      const vals = keloClip.ev, mask = keloClip.em;
      mask.fill(0);
      const cin = A.in && KELO_CLIPS[A.in], cout = A.out && KELO_CLIPS[A.out], loop = KELO_CLIPS[A.loop[0]];
      if (cout && r < cout.d) keloClipSample(cout, cout.d - r, false, vals, mask);
      else if (cin && e < cin.d) keloClipSample(cin, e, false, vals, mask);
      else keloClipSample(loop, e - (cin ? cin.d : 0), !cin && !cout ? false : true, vals, mask);
      for (let c = 0; c < KELO_CLIP_SPECIAL; c++) if (mask[c]) out[KELO_CLIP_CHANNELS[c]] = vals[c];
      return out;
    }

// The clip to dig with, from the tool in his hands
function keloDigActFor(obj) {
      if (!obj) return 'drill';
      const n = String(obj.userData && obj.userData.itemName || '').toLowerCase();
      if (/jack ?hammer|breaker|demolition/.test(n)) return 'jackhammer';
      if (/pick ?axe|pickaxe|mattock|\bpick\b|sledge|\bmaul\b/.test(n)) return 'pick';
      if (/\baxe\b|hatchet|chain ?saw/.test(n)) return 'chop';
      if (/\brake\b|\blute\b|\bhoe\b/.test(n)) return 'rake';
      if (/trowel|dibber/.test(n)) return 'plant';
      return 'dig';
    }

// Driving: his hands on the steering wheel's rim, a little above level, so they turn it with the
// wheels (vehicles.js passes the wheel as { wheel } with the drive action). Read by js/kelo-ik.js.
const _kcWl = new THREE.Vector3(), _kcWr = new THREE.Vector3(), _kcRide = { l: null, r: null };
function keloClipRideReach() {
      const C = keloClip, cur = C.cur;
      if (!cur || cur.A.name !== 'drive' || cur.phase !== 'loop') return null;
      const wh = C.optsNow && C.optsNow.wheel;
      if (!wh || !wh.parent || !wh.visible) return null;
      const r = wh.userData.rimR || (wh.userData.rimR = (wh.geometry && wh.geometry.parameters && wh.geometry.parameters.radius) || 0.25);
      // (the wheel models are tipped 0.5 about their own x; these two points sit level with each other)
      _kcRide.r = wh.localToWorld(_kcWr.set(0.998 * r, -0.148 * r, 0));
      _kcRide.l = wh.localToWorld(_kcWl.set(-0.666 * r, 0.762 * r, 0));
      return _kcRide;
    }

// A vehicle model's steering wheel (userData.steeringWheel), looked up once per model
const keloWheelCache = new WeakMap();
function keloSteeringWheelOf(mesh) {
      if (!mesh) return null;
      if (!keloWheelCache.has(mesh)) {
        let found = null;
        mesh.traverse(o => { if (!found && o.userData && o.userData.steeringWheel) found = o; });
        keloWheelCache.set(mesh, found);
      }
      return keloWheelCache.get(mesh);
    }

// Two-handed tools (shovel, pickaxe, axe, rake): the tool hangs from his right hand (keloHoldInHands),
// and his left hand goes to the handle further along it, wherever the clip swings it, so both hands
// stay on it. Read by js/kelo-ik.js keloApplyReach before the hands are solved.
const _ktV = new THREE.Vector3(), _ktE = new THREE.Euler(), _ktR = { l: null, r: null, w: 0 };
function keloToolSep() {
      const C = keloClip, cur = C.cur;
      if (!cur || !cur.A.sep || C.hand || cur.phase === 'out') return 0;
      const obj = typeof carriedObject !== 'undefined' ? carriedObject : null;
      if (!obj || obj.parent !== keloGroup || !keloRightHand) return 0;
      return cur.A.sep;
    }
function keloToolReach() {
      const sep = keloToolSep();
      if (!sep) return null;
      const obj = carriedObject, h = typeof keloCarrySize === 'function' ? keloCarrySize(obj).y : 1;
      keloGroup.updateMatrixWorld(true);
      keloPalmLocal(keloRightHand, _ktV);
      _ktE.set(-0.2 + keloClipValue('tool'), keloClipValue('toolY'), keloClipValue('toolZ'));
      // (down the handle from the right hand: toward the blade on a shovel, to the end on an axe)
      const d = Math.min(0.42, Math.max(0.1, sep * Math.max(0.6, h)));
      _ktV.add(_kcWr.set(0, -d, 0).applyEuler(_ktE));
      _ktR.l = keloGroup.localToWorld(_ktV);
      _ktR.w = smoothstep(keloClip.w);
      return _ktR;
    }
