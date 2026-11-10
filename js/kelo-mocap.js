// Kelo-1's walk, run, turning on the spot, setting off and stopping, from motion capture
// (js/kelo-mocap-data.js: the CMU Graphics Lab Motion Capture Database, see CREDITS.md).
// Loaded after animations.js; finishKeloPose() calls in here every frame.
//
// The clips were converted offline to Kelo-1's joints, in leg lengths. The three cycles (stroll,
// walk, run) share one phase (0 = his left heel lands) and blend by his real speed over the ground.
// The cadence comes from the speed, and each clip's hip sweep is scaled to the stride that cadence
// gives, so a stride covers exactly the ground he moves over (his feet don't slide; js/kelo-ik.js
// pins the planted one). Turning on the spot he steps round with the turn clip; setting off plays
// the start clip by the distance he has covered; stopping, the leg still out steps in along the
// path the last step of a real stop takes (keloSettleStep in animations.js).

const KELO_MC = {
  leg: KELO_THIGH + KELO_SHIN,   // the clips are in leg lengths
  cad: 1.2,         // he steps a little quicker than a grown-up (shorter legs)
  cadPow: 0.7,      // above a clip's own speed, 70% of the extra comes from quicker steps
  bounce: 1.3,      // a bit more up-and-down than a person: cuter
  arms: 1.15,
  turnSeg: 0.85,    // seconds for one ~90° step-round on the spot
  turnMin: 0.35,    // a smaller change of facing just turns, without stepping
  segAngle: 1.4     // a bigger turn is split into steps-round of about this much
};
let keloMcClips = null;
const keloMcI = {};   // channel name -> row
const _keloMcAcc = new Float32Array(32), _keloMcTmp = new Float32Array(32);
const keloMcWrap = x => Math.atan2(Math.sin(x), Math.cos(x));

// A clip the other way round: left and right swapped, turns and sideways moves negated, and the
// phase moved so 0 is still his left heel landing
function keloMcMirror(c, shift) {
      const ch = KELO_MOCAP.ch, neg = /^(lLegZ|rLegZ|lArmZ|rArmZ|bodyY|bodyZ|shift)$/;
      const rows = ch.map(name => {
        const src = /^[lr][A-Z]/.test(name) ? (name[0] === 'l' ? 'r' : 'l') + name.slice(1) : name;
        const r = c.rows[keloMcI[src]], o = new Float32Array(r.length), n = r.length;
        for (let i = 0; i < n; i++) o[i] = r[(i + shift) % n] * (neg.test(name) ? -1 : 1);
        return o;
      });
      return { ...c, rows, cL: c.cR, cR: c.cL, y: c.y };
    }

// Per sample and foot: planted or not, and how far through that stance or swing it is, as the
// walk-phase number js/kelo-ik.js reads (planted below 0.5)
function keloMcContacts(c) {
      ['L', 'R'].forEach(side => {
        const s = c['c' + side], n = s.length, u = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const on = s[i] === '1';
          let i0 = i, i1 = i;
          while (i0 > 0 && (s[i0 - 1] === '1') === on) i0--;
          while (i1 < n - 1 && (s[i1 + 1] === '1') === on) i1++;
          // a stance running off the end of the clip counts as still early in it (he stays put)
          const p = on && i1 === n - 1 ? 0 : (i - i0 + 0.5) / (i1 - i0 + 1);
          u[i] = on ? 0.499 * p : 0.5 + 0.499 * p;
        }
        c['u' + side] = u;
      });
    }

function keloMcLoad() {
      if (keloMcClips) return keloMcClips;
      if (typeof KELO_MOCAP === 'undefined') return null;
      KELO_MOCAP.ch.forEach((name, i) => { keloMcI[name] = i; });
      const C = {};
      for (const name in KELO_MOCAP.clips) {
        const s = KELO_MOCAP.clips[name];
        const c = { ...s, rows: s.d.map(r => Float32Array.from(r, x => x / 1000)) };
        c.n = c.rows[0].length;
        if (s.dist) c.dist = Float32Array.from(s.dist, x => x / 1000);
        if (s.y) c.y = Float32Array.from(s.y, x => x / 1000);
        if (s.cL) { c.sfL = s.cL.split('1').length - 1; c.sfL /= c.n; c.sfR = (s.cR.split('1').length - 1) / c.n; }
        delete c.d;
        C[name] = c;
      }
      // His legs are nearly straight standing, so a planted foot is only in reach with his hips no
      // higher than that: each clip's hip height is moved down until it is a touch lower whenever a
      // foot is on the ground (the bounce stays; in a run's flight he still rises)
      ['walk', 'stroll', 'run', 'start', 'turn'].forEach(k => {
        const c = C[k], r = c.rows[keloMcI.lift];
        let m = -Infinity;
        for (let i = 0; i < c.n; i++) if (c.cL[i] === '1' || c.cR[i] === '1') m = Math.max(m, r[i]);
        if (isFinite(m)) for (let i = 0; i < c.n; i++) r[i] -= m + 0.012;
      });
      // How far each cycle's planted foot really sweeps back under him per stance, as a stride (units):
      // a person's pelvis, heel and toe make up the rest of their stride, which his legs alone don't
      ['walk', 'stroll', 'run'].forEach(k => {
        const c = C[k], n = c.n;
        // (a jogger's foot is down a little longer than the clip's strict contact test says)
        if (k === 'run') { c.sfL = Math.max(c.sfL, 0.36); c.sfR = Math.max(c.sfR, 0.36); }
        // Where the foot is in front of the hip (units), from the hip and knee angles
        const I = keloMcI, foot = (h, kn) => KELO_THIGH * Math.sin(-h) + KELO_SHIN * Math.sin(-h - kn);
        const lx = c.rows[I.lLegX], rx = c.rows[I.rLegX], lk = c.rows[I.lKneeX], rk = c.rows[I.rKneeX];
        const nL = Math.round(c.sfL * n), oR = Math.round(c.offR * n) % n, nR = Math.round(c.sfR * n);
        const eL = nL - 1, eR = (oR + nR - 1) % n;
        // each leg's planted sweep centred under his hip: a person lands a foot a little ahead and
        // pushes off well behind, which his short straight legs can't reach without crouching
        for (let it = 0; it < 3; it++) {
          const mid = (foot(lx[0], lk[0]) + foot(lx[eL], lk[eL]) + foot(rx[oR], rk[oR]) + foot(rx[eR], rk[eR])) / 4;
          for (let i = 0; i < n; i++) { lx[i] += mid / KELO_MC.leg; rx[i] += mid / KELO_MC.leg; }
        }
        const sL = (foot(lx[0], lk[0]) - foot(lx[eL], lk[eL])) / c.sfL;
        const sR = (foot(rx[oR], rk[oR]) - foot(rx[eR], rk[eR])) / c.sfR;
        c.S = (sL + sR) / 2;
      });
      C.turnR = keloMcMirror(C.turn, 0);
      C.veerR = keloMcMirror(C.veer, Math.round(C.walk.offR * C.walk.n));
      ['turn', 'turnR', 'start'].forEach(k => keloMcContacts(C[k]));
      // The start clip lands his left foot just before it ends: how long before, in clip samples
      const cl = C.start.cL;
      C.start.lastL = cl.lastIndexOf('01') + 1;
      C.start.lift = Math.min(cl.indexOf('0'), C.start.cR.indexOf('0'));   // nothing moves before this
      // The last step of the stop: his right foot's swing, as a shape for keloSettleStep
      const st = C.stop, i0 = st.cR.indexOf('0'), i1 = st.cR.indexOf('1', i0);
      st.swing = [i0 - 1, i1];
      keloMcClips = C;
      return C;
    }

// Add w × clip at fractional sample s into acc (wrapping round for a cycle), each channel scaled
function keloMcAdd(acc, c, s, w, loop, scale) {
      const n = c.n;
      let i0, f;
      if (loop) { s = ((s % n) + n) % n; i0 = Math.floor(s); f = s - i0; }
      else { s = Math.max(0, Math.min(n - 1, s)); i0 = Math.min(n - 2, Math.floor(s)); f = s - i0; }
      const i1 = loop ? (i0 + 1) % n : i0 + 1;
      for (let k = 0; k < c.rows.length; k++) {
        const r = c.rows[k];
        acc[k] += w * (scale ? scale[k] : 1) * (r[i0] + (r[i1] - r[i0]) * f);
      }
    }
const keloMcAt = (arr, s) => { const n = arr.length, i = Math.max(0, Math.min(n - 2, Math.floor(s))), f = Math.max(0, Math.min(1, s - i)); return arr[i] + (arr[i + 1] - arr[i]) * f; };
// The first fractional sample where a rising curve reaches x
function keloMcFind(arr, x) {
      const n = arr.length;
      if (x <= arr[0]) return 0;
      for (let i = 1; i < n; i++) if (arr[i] >= x) return i - 1 + (x - arr[i - 1]) / Math.max(1e-6, arr[i] - arr[i - 1]);
      return n - 1;
    }

// --- Turning on the spot -----------------------------------------------------------------------
// Standing (indoors, tripFace and the like) and asked to face a new way: he steps round with the
// turn clip and his heading follows the clip's own (it turns as the feet step, not at an even
// rate). Returns true while it drives a.yaw.
function keloMcTurnYaw(a, want, dt, canStep) {
      const C = keloMcLoad();
      if (!C) return false;
      let T = a.turn;
      if (T && (T.follow || !canStep)) { if (!T.follow) T.end = true; return false; }
      if (T && T.end) T = null;
      const err = keloMcWrap(want - a.yaw);
      if (!T) {
        if (!canStep || Math.abs(err) < KELO_MC.turnMin) return false;
        T = a.turn = { dir: Math.sign(err), yaw0: a.yaw, s: 0, n: Math.max(1, Math.round(Math.abs(err) / KELO_MC.segAngle)), total: Math.abs(err), w: a.turn ? a.turn.w : 0, follow: false, end: false };
      }
      // the way to face can move while he turns: further the same way stretches the turn; back the
      // other way, he finishes this step-round and turns again from there
      const total = T.dir * keloMcWrap(want - T.yaw0);
      if (total > 0.05) {
        T.total = total;
        T.n = Math.max(T.n, Math.round(total / KELO_MC.segAngle));
      }
      const seg = T.total / T.n;
      const dur = KELO_MC.turnSeg * (0.55 + 0.45 * Math.min(1.3, seg / C.turn.yaw));
      T.s = Math.min(T.n, T.s + dt / dur);
      const k = Math.min(T.n - 1, Math.floor(T.s)), local = T.s - k;
      const frac = (k + keloMcAt(C.turn.y, local * (C.turn.n - 1))) / T.n;
      const ny = T.yaw0 + T.dir * T.total * frac;
      a.yawVel = dt > 0 ? keloMcWrap(ny - a.yaw) / dt : 0;
      a.yaw = ny;
      if (T.s >= T.n) { T.end = true; a.yawVel = 0; }
      return true;
    }

// How much of the on-the-spot turn shows this frame (0-1), and its sample. Outdoors (motion.js
// pivoting him) the heading is motion.js's, and the clip follows how far round he has got.
function keloMcTurnStep(a, dt, locoOn, onFeet, walking, v) {
      const C = keloMcLoad();
      if (!C) return 0;
      let T = a.turn;
      const pivot = locoOn && onFeet && typeof keloMotion !== 'undefined' && keloMotion.pivot;
      if (pivot && (!T || !T.follow || T.end)) {
        const dir = Math.sign(keloMotion.yawError) || 1;
        T = a.turn = { dir, yaw0: a.yaw, s: 0, n: 1, total: Math.abs(keloMotion.yawError), w: T ? T.w : 0, follow: true, end: false };
      }
      if (!T) return 0;
      if (T.follow) {
        if (!pivot) T.end = true;
        else {
          const turned = Math.max(0, T.dir * keloMcWrap(a.yaw - T.yaw0));
          const total = Math.max(0.05, turned + Math.max(0, T.dir * keloMotion.yawError));
          T.n = Math.max(T.n, Math.round(total / KELO_MC.segAngle));
          T.total = total;
          const x = Math.min(T.n, (turned / total) * T.n), k = Math.min(T.n - 1, Math.floor(x));
          T.s = Math.max(T.s, k + keloMcFind(C.turn.y, x - k) / (C.turn.n - 1));
        }
      }
      if (!onFeet || (walking && v > 0.3 && !T.follow)) T.end = true;
      T.w = dampTo(T.w, T.end ? 0 : 1, T.end ? 10 : 16, dt);
      if (T.end && T.w < 0.01) { a.turn = null; return 0; }
      return T.w;
    }

// --- The pose for this frame ---------------------------------------------------------------------
// Fills and returns the channel array (KELO_MOCAP.ch, angles in Kelo-1's joints; lift and shift in
// units), weighted already: cycW of the speed-blended cycle, the turn at turnW, and the start
// clip while he sets off. Also sets a.phase and a.ikPhase.
function keloMcPose(a, dt, v, cycW, turnW, walking, yawRate) {
      const C = keloMcLoad(), P = _keloMcAcc, nch = KELO_MOCAP.ch.length, I = keloMcI, L = KELO_MC.leg;
      P.fill(0);
      // Which cycles, by speed: stroll -> walk around 1.25 units/s, walk -> run from 4.3 to 6.3
      const wr = smoothstep((v - 4.3) / 2.0), ws = (1 - smoothstep((v - 0.9) / 0.7)) * (1 - wr), ww = Math.max(0, 1 - ws - wr);
      const G = [[C.stroll, ws], [C.walk, ww], [C.run, wr]];
      let f = 0, sf = 0, offR = 0;
      for (const [c, w] of G) {
        if (w <= 0) continue;
        const V = c.S * KELO_MC.cad / c.dur;
        f += w * KELO_MC.cad / c.dur * Math.pow(Math.max(v, 0.05) / V, KELO_MC.cadPow);
        sf += w * (c.sfL + c.sfR) / 2;
        offR += w * c.offR;
      }
      f = Math.max(1.25, Math.min(3.4, f));   // (slow, he takes small quick steps: a long stance outlasts a speed-up)
      a.phase += Math.PI * 2 * f * dt;
      const u = ((a.phase / (Math.PI * 2)) % 1 + 1) % 1;
      const stride = Math.max(v, 0.05) / f;

      // Setting off: the start clip, by the distance covered (before his first foot lifts it may run
      // ahead on the clock: that is only his weight shifting)
      const S = C.start;
      let M = a.mcStart;
      if (M && (!walking || (turnW > 0.3 && a.turn && !a.turn.end))) M = a.mcStart = null;
      let startW = 0;
      if (M) {
        M.d += v * dt / L;
        M.t = (M.t || 0) + dt;
        const sd = keloMcFind(S.dist, M.d);
        M.s = Math.max(sd, Math.min(S.lift, M.s + dt * (S.n - 1) / S.dur * 1.5));
        if (!M.done && (M.s >= S.n - 1.01 || M.d >= S.dist[S.n - 1])) {
          // hand over to the cycle at the matching phase: his left foot landed a moment ago
          M.done = true;
          // (where in its stance the cycle has that foot as far back as the clip leaves it)
          const want = keloMcAt(S.rows[I.lLegX], M.s), w = C.walk, kk = Math.max(0.35, Math.min(1.7, stride / w.S));
          let best = 0, bestErr = Infinity;
          for (let i = 0; i < Math.round(w.sfL * w.n); i++) {
            const e = Math.abs(w.rows[I.lLegX][i] * kk - want);
            if (e < bestErr) { bestErr = e; best = i; }
          }
          a.phase = Math.PI * 2 * (best / w.n);
        }
        M.w = M.done ? M.w * Math.exp(-9 * dt) : 1;
        if (M.w < 0.01) a.mcStart = M = null;
        else startW = M.w;
      }
      const clipS = M ? C.start : null;

      // The cycles, each hip sweep scaled to the stride he is really taking
      const T = _keloMcTmp, cw = cycW * (1 - startW);
      let A = 0;
      for (const [c, w] of G) {
        if (w <= 0) continue;
        const k = Math.max(0.35, Math.min(1.7, stride / c.S));
        A += w * Math.asin(Math.min(0.9, Math.max(0, KELO_THIGH * Math.sin(-c.rows[I.lLegX][0] * k) + KELO_SHIN * Math.sin(-c.rows[I.lLegX][0] * k - c.rows[I.lKneeX][0])) / 0.98));
        if (cw <= 0.001) continue;
        for (let i = 0; i < nch; i++) T[i] = 1;
        T[I.lLegX] = T[I.rLegX] = k;
        T[I.lKneeX] = T[I.rKneeX] = Math.min(1.25, 0.55 + 0.45 * k);
        T[I.lFootX] = T[I.rFootX] = 0.5 * Math.min(1, k);   // (his soles are stiffer than a person's: half the heel-and-toe roll)
        T[I.lift] = Math.sqrt(k) * KELO_MC.bounce * L;
        T[I.shift] = L;
        T[I.lArmX] = T[I.rArmX] = T[I.lElbowX] = T[I.rElbowX] = Math.sqrt(k) * KELO_MC.arms;
        keloMcAdd(P, c, u * c.n, w * cw, true, T);
      }
      // Turning as he walks: what veering changes, by how far he turns per stride
      const turnPer = Math.max(-0.35, Math.min(0.35, (yawRate || 0) / f));
      if (cw > 0.001 && Math.abs(turnPer) > 0.005) {
        for (let i = 0; i < nch; i++) T[i] = 1;
        T[I.shift] = L;
        keloMcAdd(P, turnPer > 0 ? C.veer : C.veerR, u * C.veer.n, Math.abs(turnPer) * cw, true, T);
      }
      // Starting off
      if (clipS && startW > 0.001) {
        for (let i = 0; i < nch; i++) T[i] = 1;
        T[I.lift] = KELO_MC.bounce * L; T[I.shift] = L;
        keloMcAdd(P, clipS, M.s, startW * smoothstep(M.t / 0.2), false, T);   // (eased in: his hips come down a touch)
      }
      // Stepping round on the spot (smaller turns take smaller steps)
      const R = a.turn;
      if (R && turnW > 0.001) {
        const c = R.dir > 0 ? C.turn : C.turnR;
        const amp = Math.min(1, (R.total / R.n) / 1.1);
        for (let i = 0; i < nch; i++) T[i] = amp;
        T[I.lift] = amp * L; T[I.shift] = 0;
        keloMcAdd(P, c, (R.s - Math.min(R.n - 1, Math.floor(R.s))) * (c.n - 1), turnW, false, T);
      }

      // Which foot is planted, for js/kelo-ik.js
      if (R && turnW > 0.05 && turnW >= cw && !(clipS && startW > 0.5 && R.end)) {
        const c = R.dir > 0 ? C.turn : C.turnR, s = Math.max(0, Math.min(c.n - 1, Math.round((R.s - Math.min(R.n - 1, Math.floor(R.s))) * (c.n - 1))));
        a.ikPhase = { uL: c.uL[s], uR: c.uR[s], sf: 0.5, f: 1.2, A: 0 };
      } else if (clipS && startW > 0.5) {
        const s = Math.round(M.s);
        a.ikPhase = { uL: clipS.uL[s], uR: clipS.uR[s], sf: 0.5, f, A };
      } else if (cw < 0.05) {
        a.ikPhase = { uL: 0, uR: 0, sf: 0.5, f, A: 0 };   // (both feet down)
      } else {
        a.ikPhase = { uL: u, uR: (u - offR + 1) % 1, sf, f, A };
      }
      return P;
    }

// He sets off: play the start clip (from standing, first foot lifting) before the cycle
function keloMcStartOff(a) {
      if (!keloMcLoad()) return;
      a.mcStart = { d: 0, s: 0, w: 1, done: false };
    }

// The last step of a real stop, for the leg still out when he stops (keloSettleStep): at p (0-1)
// through the step, how far home it is (w) and how much the hip and knee lift on the way
const _keloMcStep = { w: 0, hip: 0, knee: 0, dur: 0.34 };
function keloMcStopStep(p) {
      const C = keloMcLoad(), O = _keloMcStep;
      if (!C) { O.w = smoothstep(p); O.hip = O.knee = 0; return O; }
      const st = C.stop, [i0, i1] = st.swing, I = keloMcI;
      const s = i0 + (i1 - i0) * Math.max(0, Math.min(1, p));
      const h = st.rows[I.rLegX], k = st.rows[I.rKneeX];
      const h0 = h[i0], h1 = h[i1], k0 = k[i0], k1 = k[i1];
      const hs = keloMcAt(h, s), ks = keloMcAt(k, s);
      // home-ness from the knee-free part of the hip path, kept monotonic and ending at 1
      const w = Math.abs(h0 - h1) > 0.02 ? (hs - h0) / (h1 - h0) : smoothstep(p);
      O.w = Math.max(0, Math.min(1, w)) * (1 - smoothstep((p - 0.85) / 0.15)) + smoothstep((p - 0.85) / 0.15);
      O.knee = Math.max(0, ks - (k0 + (k1 - k0) * O.w));
      O.hip = Math.min(0, hs - (h0 + (h1 - h0) * O.w));
      O.dur = (i1 - i0) / (st.n - 1) * st.dur / KELO_MC.cad;
      return O;
    }
