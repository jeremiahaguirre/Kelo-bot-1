// Kelo-bot-1 — js/motion.js
// Loaded right after animations.js. How Kelo-1 (and whatever he drives) moves through the world:
//   - he speeds up and slows down smoothly instead of jumping to full speed and stopping dead,
//     and brakes early enough to come to rest right at his target;
//   - he turns at a limited, eased rate and walks where he faces, so corners become curves; for a
//     big change of direction he slows down and turns on the spot first;
//   - he steers toward a point a little way along his path (not the next grid cell), so the A* path
//     (js/scene.js) becomes one smooth line around obstacles instead of a zig-zag;
//   - vehicles accelerate more slowly than he walks, turn wider, and bank (lean) into turns;
//   - sudden jumps of his body (sitting down, standing up, climbing into a seat) slide smoothly
//     instead of popping, while anything far away (a real teleport) still snaps.
// scene.js calls keloLocomote() each frame he is on the move; animations.js calls
// keloSmoothRoot() at the end of finishKeloPose(); vehicles.js calls keloVehicleBank().

const KELO_GAIT = {
  accel: 5.0,          // units/s² when setting off on foot
  decel: 7.0,          // units/s² when braking
  jerk: 22,            // how quickly the acceleration itself builds (units/s³)
  turnRate: 6.5,       // fastest turn while walking (rad/s)
  pivotRate: 4.2,      // fastest turn on the spot (rad/s)
  turnAccel: 30,       // how quickly a turn builds up (rad/s²)
  pivotAngle: 1.75,    // a change of direction bigger than this (about 100°) is turned on the spot
  resumeAngle: 0.45,   // ...and he walks on once he faces within this of the way
  lookahead: 1.15      // how far along the path he aims (units)
};
// Vehicles: turn rate (rad/s), acceleration (units/s²) and how far they lean into a turn
const KELO_VEHICLE_GAIT = {
  land: { turnRate: 2.1, accel: 3.2, decel: 5.0, bank: 0.03, pivot: false },
  snow: { turnRate: 2.4, accel: 3.6, decel: 5.0, bank: 0.06, pivot: false },
  water: { turnRate: 1.3, accel: 2.0, decel: 2.4, bank: 0.05, pivot: false },
  air: { turnRate: 1.1, accel: 2.4, decel: 3.0, bank: 0.06, pivot: true },
  bike: { turnRate: 2.8, accel: 4.0, decel: 6.0, bank: 0.08, pivot: false }
};

const keloMotion = {
  speed: 0,            // units/s along his heading
  acc: 0,              // units/s²
  heading: null,       // which way he (or his vehicle) faces, radians
  yawRate: 0,          // rad/s
  desiredYaw: 0,       // which way his path wants him to go
  yawError: 0,         // desiredYaw - heading (for the head leading the body, js/humanize.js)
  pivot: false,        // turning on the spot
  lastCall: -1,
  lastX: null, lastZ: null,
  aim: null,           // the point on his path he steers toward
  bank: 0,             // vehicle lean
  pitch: 0,            // vehicle nose up/down when speeding up or braking
  root: { corr: null, prev: null, yawCorr: 0 }
};

function keloMotionWrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

// The gait for whatever he is doing now: on foot, or the kind of vehicle he rides
function keloGaitNow() {
      if (!state.riding) return null;
      const v = (state.vehicles || []).find(x => x.id === state.riding);
      const type = v && typeof vehicleTypeFor === 'function' ? vehicleTypeFor(v.name) : null;
      if (type && type.kind === 'bike') return KELO_VEHICLE_GAIT.bike;
      return KELO_VEHICLE_GAIT[state.ridingMode] || KELO_VEHICLE_GAIT.land;
    }

// The point `ahead` units along his remaining path, if he can walk to it in a straight line.
// This rounds the corners of the A* path into curves (pure-pursuit steering).
function keloPathAim(px, pz, target, ahead) {
      const pts = (typeof currentPath !== 'undefined' && currentPath.length) ? currentPath : [target];
      let ax = px, az = pz, left = ahead, aim = null;
      for (let i = 0; i < pts.length; i++) {
        const seg = Math.hypot(pts[i].x - ax, pts[i].z - az);
        if (seg >= left) { const k = left / seg; aim = { x: ax + (pts[i].x - ax) * k, z: az + (pts[i].z - az) * k }; break; }
        left -= seg; ax = pts[i].x; az = pts[i].z;
      }
      if (!aim) { const last = pts[pts.length - 1]; aim = { x: last.x, z: last.z }; }
      if (typeof segmentClear === 'function' && !segmentClear(px, pz, aim.x, aim.z, target)) return null;
      return aim;
    }

// One frame of moving toward state.targetPos. `dist` is how far away it is. Moves state.botPos,
// sets state.botRotY to his heading, and returns [sx, sz, step]: the direction he moved and how far.
function keloLocomote(dist, dt, t) {
      const m = keloMotion, p = state.botPos;
      const gait = keloGaitNow();
      // A fresh start: he stood still last frame, or was put somewhere new
      const jumped = m.lastX === null || Math.hypot(p.x - m.lastX, p.z - m.lastZ) > 1.5;
      // (dt is capped at 0.1 s, so on a slow frame rate compare with at least two seconds, or every frame looks like a fresh start)
      if (jumped || t - m.lastCall > Math.max(dt * 1.5 + 0.02, 2) || m.heading === null) {
        m.speed = 0; m.acc = 0; m.yawRate = 0; m.pivot = false;
        const shown = typeof keloAnim !== 'undefined' && keloAnim.yaw !== null && !state.riding ? keloAnim.yaw : state.botRotY;
        m.heading = Number.isFinite(shown) ? shown : 0;
      }
      m.lastCall = t;
      // Last step was taken back (he stumbled, js/needs.js): he has stopped, and sets off again gently
      if (m.lastStep && Math.hypot(p.x - (m.lastX - m.lastStep[0]), p.z - (m.lastZ - m.lastStep[1])) < 1e-5 && Math.hypot(m.lastStep[0], m.lastStep[1]) > 1e-5) {
        m.speed = 0; m.acc = 0;
      }

      // Which way the path wants him to go: a point a little way along it, so corners are rounded
      const [dx, dz] = nextPathDirection(p.x, p.z, state.targetPos);
      let wantX = dx, wantZ = dz;
      const straight = state.riding && (state.ridingMode === 'water' || state.ridingMode === 'air');
      if (!straight) {
        const aim = keloPathAim(p.x, p.z, state.targetPos, Math.min(KELO_GAIT.lookahead, dist));
        if (aim) {
          const ax = aim.x - p.x, az = aim.z - p.z, al = Math.hypot(ax, az);
          if (al > 0.05) { wantX = ax / al; wantZ = az / al; }
        }
        m.aim = aim;
      }
      // Looking ahead: if where he will be in a moment is too close to something solid, ease away from it
      if (!straight && typeof worldObstacles !== 'undefined' && m.speed > 0.5) {
        const ahead = Math.min(2.5, m.speed * 0.35);
        const fx = p.x + Math.sin(m.heading) * ahead, fz = p.z + Math.cos(m.heading) * ahead;
        for (const o of worldObstacles) {
          if (typeof obstacleHoldsTarget === 'function' && obstacleHoldsTarget(o, state.targetPos)) continue;
          const ox = fx - o.x, oz = fz - o.z, d = Math.hypot(ox, oz), clear = o.r + KELO_RADIUS + 0.25;
          if (d > 0 && d < clear + 0.5) {
            const push = Math.min(1, (clear + 0.5 - d) / 0.8) * 0.9;
            wantX += ox / d * push; wantZ += oz / d * push;
          }
        }
        const l = Math.hypot(wantX, wantZ) || 1; wantX /= l; wantZ /= l;
      }
      m.desiredYaw = Math.atan2(wantX, wantZ);
      const err = keloMotionWrap(m.desiredYaw - m.heading);
      m.yawError = err;

      // Turning on the spot for a big change of direction (on foot, or a hovering aircraft)
      const canPivot = !gait || gait.pivot;
      if (canPivot && !m.pivot && Math.abs(err) > KELO_GAIT.pivotAngle && m.speed < 0.8) m.pivot = true;
      if (m.pivot && Math.abs(err) < KELO_GAIT.resumeAngle) m.pivot = false;

      // Turn: the rate eases in and out (no instant snaps), and is capped
      const maxRate = gait ? gait.turnRate : (m.pivot ? KELO_GAIT.pivotRate : KELO_GAIT.turnRate);
      const wantRate = Math.max(-maxRate, Math.min(maxRate, err * (gait ? 2.5 : 6)));
      const dRate = wantRate - m.yawRate, maxD = KELO_GAIT.turnAccel * (gait ? 0.4 : 1) * dt;
      m.yawRate += Math.max(-maxD, Math.min(maxD, dRate));
      // Never swing past the way he wants to face
      let turn = m.yawRate * dt;
      if (Math.abs(turn) > Math.abs(err) && Math.sign(turn) === Math.sign(err)) { turn = err; m.yawRate = err / Math.max(dt, 1e-3) * 0.5; }
      m.heading = keloMotionWrap(m.heading + turn);

      // Speed: cruise (longer strides on long trips), slower when facing away from the path, and
      // braking early enough to stop right at the target
      const factor = (state.ridingSpeed || 1) * (typeof snowWalkFactor === 'function' ? snowWalkFactor(p) : 1);
      const cruise = (0.082 + 0.058 * smoothstep((dist - 8) / 8)) * 60 * factor;
      const facing = Math.max(0, Math.cos(err));
      const accel = (gait ? gait.accel : KELO_GAIT.accel) * Math.sqrt(factor);
      const decel = (gait ? gait.decel : KELO_GAIT.decel) * Math.sqrt(factor);
      const arriveR = typeof arrivalRadius === 'function' ? arrivalRadius(state.targetPos) : 0.16;
      const brakeDist = Math.max(0, dist - arriveR);
      const stopSpeed = Math.sqrt(2 * decel * 0.8 * brakeDist);
      let want = m.pivot ? 0 : Math.min(cruise * facing * facing, stopSpeed);
      if (!m.pivot && brakeDist > 0) want = Math.max(want, Math.min(0.2, cruise) * facing);  // creep the last bit
      // Build up acceleration gradually (jerk-limited) when speeding up. Braking for the target uses
      // the deceleration that stops him exactly there (v² / 2d), so he never arrives still moving fast.
      let wantAcc = Math.max(-decel, Math.min(accel, (want - m.speed) * 5));
      if (!m.pivot && stopSpeed < cruise * facing * facing && m.speed > want * 0.9 && brakeDist > 0.01) {
        wantAcc = Math.min(wantAcc, -Math.min(decel * 1.5, m.speed * m.speed / (2 * brakeDist)));
      }
      const jerk = wantAcc < m.acc ? KELO_GAIT.jerk * 3 : KELO_GAIT.jerk;
      m.acc += Math.max(-jerk * dt, Math.min(jerk * dt, wantAcc - m.acc));
      m.speed = Math.max(0, m.speed + m.acc * dt);
      if (m.speed > want && m.acc > 0) m.acc = 0;
      if (want === 0 && m.speed < 0.05) { m.speed = 0; m.acc = Math.min(0, m.acc); }

      let sx = Math.sin(m.heading), sz = Math.cos(m.heading);
      const step = Math.min(dist, m.speed * dt);
      // Brushing past something solid: slide along its edge rather than being shoved back out
      if (typeof worldObstacles !== 'undefined') {
        for (const o of worldObstacles) {
          if (typeof obstacleHoldsTarget === 'function' && obstacleHoldsTarget(o, state.targetPos)) continue;
          const nx = p.x + sx * step - o.x, nz = p.z + sz * step - o.z, d = Math.hypot(nx, nz);
          if (d > 0 && d < o.r + KELO_RADIUS + 0.02) {
            const ux = nx / d, uz = nz / d, inward = sx * ux + sz * uz;
            if (inward < 0) { sx -= inward * ux; sz -= inward * uz; const l = Math.hypot(sx, sz) || 1; sx /= l; sz /= l; }
          }
        }
      }
      p.x += sx * step;
      p.z += sz * step;
      pushOutOfObstacles(p, state.targetPos);
      m.lastX = p.x; m.lastZ = p.z;
      m.lastStep = [sx * step, sz * step];
      state.botRotY = m.heading;
      return [sx, sz, step];
    }

// The walk cycle (animations.js) and the camera read his real speed from here while he moves
function keloMotionSpeed(t) {
      return t - keloMotion.lastCall < 0.2 ? keloMotion.speed : 0;
    }

// --- No popping ---------------------------------------------------------------------------------
// Called at the very end of finishKeloPose() with keloGroup already placed. A sudden jump of his
// body (more than a step's worth in one frame, less than 4 units) is absorbed into a correction
// that fades over about a third of a second, so sitting, standing, climbing in and out of seats and
// collapsing all slide smoothly. Steady motion (walking, terrain, an aircraft climbing) is untouched.
function keloSmoothRoot(dt) {
      if (!keloGroup) return;
      const r = keloMotion.root, P = keloGroup.position;
      if (!r.prev) { r.prev = P.clone(); r.corr = new THREE.Vector3(); return; }
      const dx = P.x - r.prev.x, dy = P.y - r.prev.y, dz = P.z - r.prev.z;
      const flat = Math.hypot(dx, dz), all = Math.hypot(flat, dy);
      const speed = Math.max(keloMotion.speed, state.riding ? 30 : 9);
      const stepOk = speed * dt * 1.6 + 0.03;
      r.prev.copy(P);
      if (all > 4) {
        r.corr.set(0, 0, 0);             // a real teleport: snap
      } else if (flat > stepOk || Math.abs(dy) > 0.06 + flat * 1.5) {
        r.corr.x -= flat > stepOk ? dx : 0;
        r.corr.z -= flat > stepOk ? dz : 0;
        r.corr.y -= dy;
      }
      const k = Math.exp(-7.5 * dt);
      r.corr.multiplyScalar(k);
      if (r.corr.lengthSq() < 1e-8) r.corr.set(0, 0, 0);
      P.add(r.corr);
    }

// --- Vehicles: lean into turns ------------------------------------------------------------------
// Called by updateVehicles() (js/vehicles.js) while he rides. Rolls the vehicle about its own
// forward axis (+x) and returns the lean, so his seat and his body can lean with it.
function keloVehicleBank(mesh, dt) {
      const m = keloMotion;
      const moving = keloMotionSpeed(keloAnim.lastT || 0) > 0;
      const gait = keloGaitNow() || KELO_VEHICLE_GAIT.land;
      const speed = moving ? m.speed : 0, yawRate = moving ? m.yawRate : 0;
      // A left turn (heading increasing) leans to the left
      const want = Math.max(-0.2, Math.min(0.2, -yawRate * speed * gait.bank));
      m.bank = dampTo(m.bank, want, 4, dt);
      if (Math.abs(m.bank) < 1e-4) m.bank = 0;
      mesh.rotation.order = 'YXZ';
      mesh.rotation.x = m.bank;
      return m.bank;
    }
