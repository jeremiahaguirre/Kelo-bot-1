// Kelo-1's feet and hands find the real world: two-bone IK on top of the animated pose.
// Loaded after js/humanize.js; finishKeloPose() (js/animations.js) calls keloApplyIK() once his
// pose, root and smoothing are done for the frame, and before a carried thing is put in his hands.
//
// Feet: each foot is planted on the ground under it (terrain, dug holes, dirt piles, ice, snow sink,
// building floors, steps and stairs, the elevator car). A planted foot is locked to its spot in the
// world until the walk cycle lifts it, so it never slides; a swinging foot keeps its animated lift
// above a ground that blends from where it left to where it will land. His hips drop when the lower
// foot needs it (slopes, steps), and each planted foot tilts a little with the ground under it.
// The animated pose is the input every frame (keloAnim.base is never touched), so switching IK off
// (sitting, riding, lying down, a tilted body) just blends back to it.
//
// Hands: setKeloReach(fn) gives a world point (or { l, r }) for his hands to reach while he stands
// at something (his PO box door, a machine's controls, a shelf slot, the keyboard, his plate); the
// arms bend to put his palms there, blended in and out. Without a target the pose stays as written.
//
// Ground under a foot: outdoors the terrain functions; inside (indoorTrip) a short ray down into the
// building's own meshes, cast only when a foot plants or lifts (a few times a second), never per frame.

const KELO_IK = {
  ankle: KELO_LEG_Y - KELO_THIGH - KELO_SHIN,   // ankle height above the sole
  heel: -0.1, toe: 0.2,                         // probe points along the foot, from the ankle
  side: 0.07,                                   // half the sole's width, for side slopes (outdoors)
  edge: 0.07,                                   // heel-to-toe height difference that is a step edge, not a slope
  maxDrop: 0.45,                                // the most his hips go down for a low foot
  stepUp: 0.45, stepDown: 0.6,                  // how far a probe looks above and below his floor
  reach: (KELO_THIGH + KELO_SHIN) * 0.985
};

const keloIK = {
  legW: 0, drop: 0, dropV: 0, reachW: 0, lastRoot: null, lastYaw: 0,
  L: { planted: false, lx: 0, ly: 0, lz: 0, pitch: 0, roll: 0, liftX: 0, liftY: 0, liftZ: 0, landY: 0, landProbed: 0, probeX: null, probeZ: 0 },
  R: { planted: false, lx: 0, ly: 0, lz: 0, pitch: 0, roll: 0, liftX: 0, liftY: 0, liftZ: 0, landY: 0, landProbed: 0, probeX: null, probeZ: 0 },
  stats: { probes: 0, relocks: 0, short: 0 }
};

// --- Reach targets --------------------------------------------------------------------------------
// fn() returns a world point for both hands (they take it from either side), or { l, r } with a point
// (or null) per hand. Read every frame, so it follows a swinging door or a moving part.
const keloReach = { fn: null, until: 0 };
function setKeloReach(fn, ms = 10 * 60000) {
      keloReach.fn = fn;
      keloReach.until = Date.now() + ms;
    }
function clearKeloReach(fn) {
      if (!fn || keloReach.fn === fn) keloReach.fn = null;
    }
function keloReachTargets() {
      if (!keloReach.fn) return null;
      if (Date.now() > keloReach.until) { keloReach.fn = null; return null; }
      try {
        const p = keloReach.fn();
        if (!p) return null;
        const ok = q => q && Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z) ? q : null;
        if (p.l !== undefined || p.r !== undefined) { const l = ok(p.l), r = ok(p.r); return l || r ? { l, r } : null; }
        return ok(p) ? { both: p } : null;
      } catch (e) { return null; }
    }

// --- The ground under one point ----------------------------------------------------------------------
const _ikRay = new THREE.Raycaster(), _ikFrom = new THREE.Vector3(), _ikDown = new THREE.Vector3(0, -1, 0), _ikN = new THREE.Vector3();
function keloIkShown(o) {
      for (; o; o = o.parent) if (!o.visible) return false;
      return true;
    }
// refY is the floor his root stands on; returns the floor height at (x, z), or refY when unsure
function keloIkGroundAt(x, z, refY) {
      keloIK.stats.probes++;
      const trip = typeof indoorTrip !== 'undefined' && indoorTrip.active ? indoorTrip : null;
      if (trip) {
        const g = trip.site && trip.site.group;
        if (!g) return refY;
        _ikRay.set(_ikFrom.set(x, refY + KELO_IK.stepUp, z), _ikDown);
        _ikRay.near = 0; _ikRay.far = KELO_IK.stepUp + KELO_IK.stepDown;
        const hits = _ikRay.intersectObject(g, true);
        for (const h of hits) {
          if (!h.face || !keloIkShown(h.object)) continue;
          _ikN.copy(h.face.normal).transformDirection(h.object.matrixWorld);
          if (_ikN.y < 0.55) continue;   // a wall or a rail, not something to stand on
          return h.point.y;
        }
        return refY;
      }
      let y = getIslandGroundHeight(x, z);
      if (typeof iceFloorAt === 'function') y = Math.max(y, iceFloorAt({ x, z }));
      return y;
    }

// Where a foot stands at (x, z), facing yaw: ankle-floor height, and how the sole tilts with it
const _ikProbe = { y: 0, pitch: 0, roll: 0 };
function keloIkProbeFoot(x, z, yaw, refY, sink) {
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const yh = keloIkGroundAt(x + fx * KELO_IK.heel, z + fz * KELO_IK.heel, refY);
      const yt = keloIkGroundAt(x + fx * KELO_IK.toe, z + fz * KELO_IK.toe, refY);
      const diff = yt - yh, P = _ikProbe;
      if (Math.abs(diff) > KELO_IK.edge) {
        // half on a step: stand level on the higher one
        P.y = Math.max(yh, yt); P.pitch = 0;
      } else {
        P.y = (yh + yt) / 2 + Math.abs(diff) * 0.2;
        P.pitch = Math.atan2(diff, KELO_IK.toe - KELO_IK.heel) * 0.65;
      }
      P.roll = 0;
      if (!(typeof indoorTrip !== 'undefined' && indoorTrip.active)) {
        const sx = Math.cos(yaw) * KELO_IK.side, sz = -Math.sin(yaw) * KELO_IK.side;
        const yl = keloIkGroundAt(x + sx, z + sz, refY), yr = keloIkGroundAt(x - sx, z - sz, refY);
        const d = yl - yr;
        if (Math.abs(d) < KELO_IK.edge) { P.roll = Math.atan2(d, KELO_IK.side * 2) * 0.5; P.y += Math.abs(d) * 0.25; }
      }
      P.y -= sink;
      return P;
    }

// --- Two-bone solve -------------------------------------------------------------------------------
// From joint S to target T (both in the chain's parent space) with bone lengths L1, L2. pole is the
// way the middle joint points (knee forward, elbow back). bend is +1 for a knee (bends about +x)
// and -1 for an elbow (bends about -x). Writes the root joint's rotation into q, returns the middle
// joint's x angle. Bones hang along -y at rest, as in js/kelo-body.js.
const _ikD = new THREE.Vector3(), _ikG = new THREE.Vector3(), _ikE = new THREE.Vector3(), _ikU1 = new THREE.Vector3(),
  _ikU2 = new THREE.Vector3(), _ikX = new THREE.Vector3(), _ikY = new THREE.Vector3(), _ikZ = new THREE.Vector3(),
  _ikM = new THREE.Matrix4(), _ikTc = new THREE.Vector3();
function keloIkSolve(S, T, L1, L2, pole, bend, q) {
      const D = _ikD.subVectors(T, S);
      let d = D.length();
      if (d < 1e-5) { D.set(0, -1, 0); d = 1e-5; }
      D.divideScalar(d);
      d = Math.max(Math.abs(L1 - L2) + 0.02, Math.min((L1 + L2) * 0.9995, d));
      const cosA = Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))), sinA = Math.sqrt(1 - cosA * cosA);
      const G = _ikG.copy(pole).addScaledVector(D, -pole.dot(D));
      if (G.lengthSq() < 1e-8) G.set(0, 0, bend > 0 ? 1 : -1).addScaledVector(D, -D.z);
      G.normalize();
      const E = _ikE.copy(S).addScaledVector(D, L1 * cosA).addScaledVector(G, L1 * sinA);
      const U1 = _ikU1.subVectors(E, S).divideScalar(L1);
      const Tc = _ikTc.copy(S).addScaledVector(D, d);
      const U2 = _ikU2.subVectors(Tc, E).divideScalar(L2);
      const X = bend > 0 ? _ikX.crossVectors(G, D) : _ikX.crossVectors(D, G);
      X.addScaledVector(U1, -X.dot(U1)).normalize();
      const Y = _ikY.copy(U1).negate(), Z = _ikZ.crossVectors(X, Y);
      _ikM.makeBasis(X, Y, Z);
      q.setFromRotationMatrix(_ikM);
      return Math.atan2(-U2.dot(Z), -U2.dot(Y));
    }

// --- Every frame, from finishKeloPose() -----------------------------------------------------------
// ctx: { walking, riding, resting }
const _ikQh = new THREE.Quaternion(), _ikQk = new THREE.Quaternion(), _ikQf = new THREE.Quaternion(), _ikQa = new THREE.Quaternion(),
  _ikQt = new THREE.Quaternion(), _ikQs = new THREE.Quaternion(), _ikEu = new THREE.Euler(), _ikV = new THREE.Vector3(),
  _ikA = { L: new THREE.Vector3(), R: new THREE.Vector3() }, _ikW = { L: new THREE.Vector3(), R: new THREE.Vector3() },
  _ikT = { L: new THREE.Vector3(), R: new THREE.Vector3() }, _ikPole = new THREE.Vector3(), _ikMb = new THREE.Matrix4(),
  _ikMi = new THREE.Matrix4(), _ikS = new THREE.Vector3(), _ikFootQ = { L: new THREE.Quaternion(), R: new THREE.Quaternion() };
const _ikX1 = new THREE.Vector3(1, 0, 0), _ikZ1 = new THREE.Vector3(0, 0, 1);

// The animated ankle, in keloGroup's space (hips hang straight off keloGroup), and the foot's turn
function keloIkAnkle(hip, knee, foot, out, qFoot) {
      _ikQh.copy(hip.quaternion);
      _ikQk.copy(_ikQh).multiply(knee.quaternion);
      out.copy(hip.position).add(_ikV.set(0, -KELO_THIGH, 0).applyQuaternion(_ikQh)).add(_ikV.set(0, -KELO_SHIN, 0).applyQuaternion(_ikQk));
      if (qFoot) qFoot.copy(_ikQk).multiply(foot.quaternion);
      return out;
    }

function keloApplyIK(t, dt, ctx) {
      if (!keloBody || !keloGroup) return;
      const K = keloIK, a = keloAnim, P = keloGroup.position, yaw = keloGroup.rotation.y;
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const toWorld = (v, out) => out.set(P.x + v.x * cy + v.z * sy, P.y + v.y, P.z - v.x * sy + v.z * cy);
      const toLocal = (w, out) => { const dx = w.x - P.x, dz = w.z - P.z; return out.set(dx * cy - dz * sy, w.y - P.y, dx * sy + dz * cy); };
      const trip = typeof indoorTrip !== 'undefined' && indoorTrip.active ? indoorTrip : null;
      const sink = !trip && state.isWalking && typeof snowSink === 'function' ? snowSink(state.botPos) : 0;
      const floorY = (Number.isFinite(state.botAltitudeY) ? state.botAltitudeY : P.y) - sink;   // the floor his root stands on

      // The animated ankles
      const legs = { L: [keloLeftLeg, keloLeftKnee, keloLeftFoot], R: [keloRightLeg, keloRightKnee, keloRightFoot] };
      keloIkAnkle(...legs.L, _ikA.L, _ikFootQ.L);
      keloIkAnkle(...legs.R, _ikA.R, _ikFootQ.R);
      toWorld(_ikA.L, _ikW.L); toWorld(_ikA.R, _ikW.R);

      // --- How much IK his legs get: on his feet, upright, feet near the floor
      const tilt = Math.abs(keloGroup.rotation.x) + Math.abs(keloGroup.rotation.z);
      const footMode = a.mode === 'walk' || a.mode === 'idle';
      const near = side => Math.abs(_ikW[side].y - (floorY + KELO_IK.ankle)) < 0.12 && legs[side][0].rotation.x > -0.95 && legs[side][0].rotation.x < 0.6;
      let want = 0;
      if (!ctx.riding && !ctx.resting && tilt < 0.08 && state.microPose !== 'collapsed') {
        if (footMode) want = 1;
        else if (near('L') && near('R')) want = 1;
      }
      K.legW = dampTo(K.legW, want, want > K.legW ? 6 : 10, dt);
      const lockXZ = footMode;   // other poses keep their own foot placement; only the heights are fixed

      // A ride (elevator car) carries his planted feet along; a jump to a new place lets go of them
      const root = K.lastRoot || (K.lastRoot = new THREE.Vector3().copy(P));
      const dx = P.x - root.x, dy = P.y - root.y, dz = P.z - root.z;
      const platform = typeof keloOnMovingPlatform === 'function' && keloOnMovingPlatform();
      if (Math.hypot(dx, dz) > 0.8 || Math.abs(dy) > 1.2) { K.L.planted = K.R.planted = false; }
      else if (platform) {
        // (the car's floor is flat and moves with him: feet stay on it, never probed mid-ride)
        ['L', 'R'].forEach(s => { const F = K[s]; F.lx += dx; F.lz += dz; F.liftX += dx; F.liftZ += dz; F.ly = F.liftY = F.landY = floorY; F.pitch = F.roll = 0; });
      }
      root.copy(P);
      if (K.legW < 0.001) {
        K.L.planted = K.R.planted = false;
        K.drop = 0; K.dropV = 0;
        keloApplyReach(t, dt, ctx);
        return;
      }

      // --- Which feet are planted (the walk cycle's phase, a settle step, or both standing)
      const ph = a.ikPhase && a.stepAct > 0.05 && !a.settle ? a.ikPhase : null;
      const st = a.settle && a.settle.step;
      const state1 = side => {
        if (st) return st.side === side ? { planted: false, prog: clamp01(st.t / st.dur), settle: true } : { planted: true };
        if (ph) {
          const u = side === 'L' ? ph.uL : ph.uR;
          return u < ph.sf ? { planted: true, stance: u / ph.sf } : { planted: false, prog: (u - ph.sf) / (1 - ph.sf) };
        }
        return { planted: true };
      };
      const probe = (x, z) => platform ? Object.assign(_ikProbe, { y: floorY, pitch: 0, roll: 0 }) : keloIkProbeFoot(x, z, yaw, floorY + sink, sink);

      let dropNeed = 0;
      for (const side of ['L', 'R']) {
        const F = K[side], S = state1(side), A = _ikW[side], T = _ikT[side];
        // the animated foot's own heel-and-toe roll, relative to level
        _ikV.set(0, 0, 1).applyQuaternion(_ikFootQ[side]);
        const roll = Math.atan2(-_ikV.y, Math.hypot(_ikV.x, _ikV.z));
        if (S.planted) {
          const stray = Math.hypot(A.x - F.lx, A.z - F.lz);
          if (!F.planted || (!lockXZ && (F.probeX === null || Math.hypot(A.x - F.probeX, A.z - F.probeZ) > 0.04)) || stray > (ph ? 0.45 : 0.25)) {
            // touching down (or the pose moved this foot): lock it where it is, on the real ground
            if (F.planted && lockXZ) K.stats.relocks++;
            const g = probe(A.x, A.z);
            F.lx = A.x; F.lz = A.z; F.ly = g.y; F.pitch = g.pitch; F.roll = g.roll;
            F.probeX = A.x; F.probeZ = A.z;
            F.planted = true;
          }
          if (!lockXZ) { F.lx = A.x; F.lz = A.z; }
          // rolling onto the toe (or heel) lifts the ankle so the sole pivots on the ground
          const rel = roll - F.pitch;
          const raise = rel > 0 ? KELO_IK.ankle * (Math.cos(rel) - 1) + KELO_IK.toe * 1.15 * Math.sin(rel)
            : KELO_IK.ankle * (Math.cos(rel) - 1) + KELO_IK.heel * 1.2 * Math.sin(rel);
          T.set(F.lx, F.ly + KELO_IK.ankle + Math.max(0, raise), F.lz);
          const n = toLocal(T, _ikV), hip = legs[side][0].position;
          const horiz = Math.hypot(n.x - hip.x, n.z - hip.z);
          const maxV = Math.sqrt(Math.max(0, KELO_IK.reach * KELO_IK.reach - horiz * horiz));
          dropNeed = Math.max(dropNeed, hip.y - n.y - maxV);
          F.w = 1;
        } else {
          if (F.planted) {
            // lifting off: remember where from, and look where it will land
            F.planted = false;
            F.liftX = F.lx; F.liftY = F.ly; F.liftZ = F.lz;
            F.landProbed = 0;
          }
          if (F.landProbed === 0 || (F.landProbed === 1 && S.prog > 0.5)) {
            let lx, lz;
            if (S.settle) { const hp = legs[side][0].position; lx = P.x + hp.x * cy; lz = P.z - hp.x * sy; }
            else {
              const left = ph ? (1 - S.prog) * (1 - ph.sf) / ph.f : 0;
              const ahead = ph ? a.speed * left + 0.98 * Math.sin(ph.A) : 0;
              const hp = legs[side][0].position;
              lx = P.x + hp.x * cy + sy * ahead; lz = P.z - hp.x * sy + cy * ahead;
            }
            F.landY = probe(lx, lz).y;
            F.landPitch = _ikProbe.pitch;
            F.landProbed++;
          }
          // keep the animated lift above a floor that goes from where it left to where it lands
          const p = S.prog, up = F.landY > F.liftY;
          const k = up ? smoothstep(p / 0.6) : smoothstep((p - 0.35) / 0.65);
          const g = F.liftY + (F.landY - F.liftY) * k;
          const clear = Math.max(0, A.y - (floorY + KELO_IK.ankle));
          const rel = smoothstep(p / 0.3);   // the first bit of the swing lets go of the planted spot
          T.set(F.liftX + (A.x - F.liftX) * rel, g + KELO_IK.ankle + clear, F.liftZ + (A.z - F.liftZ) * rel);
          if (!lockXZ) T.set(A.x, g + KELO_IK.ankle + clear, A.z);
          F.pitch = F.pitch * (1 - k) + (F.landPitch || 0) * k;
          F.w = 0;
        }
      }
      // His hips come down for the lower planted foot (slopes, a step down), smoothly
      const dropT = Math.max(0, Math.min(KELO_IK.maxDrop, dropNeed)) * K.legW;
      const sp = keloSpringTo(K.drop, K.dropV, dropT, dropT > K.drop ? 40 : 14, dt);
      K.drop = sp.x; K.dropV = sp.v;
      P.y -= K.drop;

      // --- Solve each leg and turn each foot to the ground
      for (const side of ['L', 'R']) {
        const F = K[side], [hip, knee, foot] = legs[side];
        // blend from the animated ankle to the IK target
        const T = _ikT[side].lerp(_ikV.copy(_ikW[side]).setY(_ikW[side].y - K.drop), 1 - K.legW);
        const n = toLocal(T, _ikS);
        if (n.distanceTo(hip.position) > (KELO_THIGH + KELO_SHIN) * 0.9995) K.stats.short++;
        // knee forward, turned with the leg's own twist
        _ikPole.set(Math.sin(hip.rotation.y), 0, Math.cos(hip.rotation.y));
        _ikQa.copy(hip.quaternion);
        const animFoot = _ikQf.copy(_ikFootQ[side]);   // the foot's turn in keloGroup's space, as animated
        const kneeX = keloIkSolve(hip.position, n, KELO_THIGH, KELO_SHIN, _ikPole, 1, _ikQt);
        hip.quaternion.copy(_ikQa).slerp(_ikQt, K.legW);
        knee.rotation.set(knee.rotation.x + (kneeX - knee.rotation.x) * K.legW, knee.rotation.y, knee.rotation.z);
        // the sole: as animated, tilted with the ground under it (planted fully, swinging partly)
        const tw = K.legW * (F.planted ? 1 : 0.5);
        _ikEu.set(-F.pitch * tw, 0, (F.roll || 0) * tw);
        _ikQs.setFromEuler(_ikEu);
        const want = _ikQs.multiply(animFoot);
        _ikQk.copy(hip.quaternion).multiply(knee.quaternion).invert();
        foot.quaternion.copy(_ikQk.multiply(want));
      }
      keloApplyReach(t, dt, ctx);
    }

// --- Hands to a target ---------------------------------------------------------------------------
const _ikArmT = new THREE.Vector3(), _ikArmQ = new THREE.Quaternion();
function keloApplyReach(t, dt, ctx) {
      const K = keloIK;
      const targets = !ctx.riding && !ctx.resting && !state.isWalking ? keloReachTargets() : null;
      K.reachW = dampTo(K.reachW, targets ? 1 : 0, targets ? 4.5 : 6, dt);
      if (targets) K.lastReach = targets;
      const tg = targets || K.lastReach;
      if (K.reachW < 0.002 || !tg) { if (!targets) K.lastReach = null; return; }
      // keloBody's world matrix, from keloGroup's (keloGroup hangs straight off the scene)
      keloGroup.updateMatrix(); keloBody.updateMatrix();
      _ikMb.multiplyMatrices(keloGroup.matrix, keloBody.matrix);
      if (keloGroup.parent && keloGroup.parent !== scene) { keloGroup.parent.updateMatrixWorld(); _ikMb.premultiply(keloGroup.parent.matrixWorld); }
      _ikMi.copy(_ikMb).invert();
      const arms = [[-1, keloLeftArm, keloLeftElbow, 'l'], [1, keloRightArm, keloRightElbow, 'r']];
      for (const [s, sh, el, key] of arms) {
        let p = tg.both || tg[key];
        if (!p) continue;
        const T = _ikArmT.set(p.x, p.y, p.z).applyMatrix4(_ikMi);
        // both hands on one point: each takes its own side of it
        if (tg.both) T.x += s * 0.09;
        // elbow out to the side and back
        _ikPole.set(s * 0.55, -0.35, -1);
        _ikArmQ.copy(sh.quaternion);
        const elX = keloIkSolve(sh.position, T, KELO_UPPER_ARM, KELO_FOREARM + KELO_PALM, _ikPole, -1, _ikQt);
        sh.quaternion.copy(_ikArmQ).slerp(_ikQt, K.reachW);
        el.rotation.set(el.rotation.x + (Math.min(-0.05, elX) - el.rotation.x) * K.reachW, el.rotation.y * (1 - K.reachW), el.rotation.z * (1 - K.reachW));
      }
    }
