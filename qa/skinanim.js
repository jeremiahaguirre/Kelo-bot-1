// ANIMATION CHECK for every skin: IK reach, mocap idle + walk, pick up / carry / put down, a tool
// swing, every action clip in kelo-clips.js, through-his-eyes. Virtual clock (1/30 s), seeded random,
// a fresh page per skin, so each skin runs exactly the same sequence; joint rotations are compared
// frame by frame against Classic. Writes OUT/anim-<skin>.json, a frame strip and an mp4 per skin.
//   node skinanim.js [skin ...]      (default: all six, Classic first)
const { boot } = require('./skinlib');
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const OUT = process.env.OUT || path.join(__dirname, 'shots', 'skins');
fs.mkdirSync(OUT, { recursive: true });
const SKINS = process.argv.slice(2).length ? process.argv.slice(2) : ['classic@warmup', 'classic', 'explorer', 'kitbot', 'marshmallow', 'twirl', 'spark', 'ember', 'aegis', 'nebula', 'clockwork'];
const DT = 1 / 30;
let START = { x: +(process.env.SX || 6), z: +(process.env.SZ || -3) }, WALK_TO = { x: +(process.env.WX || 12.5), z: +(process.env.WZ || -3) };

const PAGE_SETUP = `(() => {
  const orig = renderer.render.bind(renderer);
  renderer.render = (s, c) => { if (!__vt.noRender) orig(s, c); };
  window.__rec = null;
  window.__act = null;
  // His own life (decisions, trips, the agenda) must not steer him mid-test: only the test may set
  // where he is or where he goes. Blocked attempts are counted (and the first few stacks kept).
  window.__allow = true; window.__blocked = [];
  ['targetPos'].forEach(k => {
    let v = state[k];
    Object.defineProperty(state, k, { configurable: true, enumerable: true, get: () => v, set: n => {
      if (window.__allow) { v = n; return; }
      if (window.__blocked.length < 5) window.__blocked.push(k + ' ' + (new Error().stack || '').split(String.fromCharCode(10)).slice(2, 5).join(' | '));
      else window.__blocked.push(k);
    } });
  });
  // State the pose code reads is held steady between frames (his needs and mood drift on real-time
  // timers); the test changes __pin itself where it needs to (riding for the drive clip)
  window.__pin = { health: 80, happiness: 70, fullness: 70, wonderLevel: 80, calmLevel: 70, microPose: 'normal', currentLocKey: null, isSleeping: false, isBusy: false, isBuilding: false, isPracticing: false, riding: null, ridingMode: null, ridingSpeed: 0, speechBubble: '' };
  // (timer-driven emotes from his idle life are kept out too; the wave/celebrate clips are tested as actions)
  window.__beforeStep = () => { Object.assign(state, window.__pin); if (typeof keloEmote !== 'undefined') keloEmote = null; if (typeof keloHuman !== 'undefined') keloHuman.pending = null; };
  window.__go = (x, z) => { __allow = true; state.targetPos = { x, z }; __allow = false; };
  // His pose code draws from its own seeded stream (wildlife, weather and the rest share the other one)
  window.__keloRnd = 99991; let worldRnd = 0;
  const bk = beginKeloPose;
  beginKeloPose = function (t) { if (__vt.rnd && __vt.inStep) { worldRnd = __vt.rnd; __vt.rnd = window.__keloRnd; } return bk(t); };
  const fk = finishKeloPose;
  finishKeloPose = function (t) {
    if (window.__act) keloAction(window.__act);
    try { return fk(t); } finally { if (worldRnd && __vt.inStep) { window.__keloRnd = __vt.rnd; __vt.rnd = worldRnd; worldRnd = 0; } }
  };
  window.__bones = () => ({ body: keloBody, head: keloHead, lArm: keloLeftArm, rArm: keloRightArm, lElbow: keloLeftElbow, rElbow: keloRightElbow, lHand: keloLeftHand, rHand: keloRightHand, lLeg: keloLeftLeg, rLeg: keloRightLeg, lKnee: keloLeftKnee, rKnee: keloRightKnee, lFoot: keloLeftFoot, rFoot: keloRightFoot });
  const _v = new THREE.Vector3(), _m = new THREE.Matrix4();
  window.__palm = hand => { keloPalmLocal(hand, _v); return keloGroup.localToWorld(_v.clone()); };
  window.__afterStep = () => {
    const r = window.__rec; if (!r) return;
    r.n++;
    KELO_JOINTS.forEach(([, g]) => { const o = g().rotation; r.J.push(+o.x.toFixed(5), +o.y.toFixed(5), +o.z.toFixed(5)); });
    const c = keloClip.cur && keloClip.cur.clip; if (c) r.clips[c.name] = (r.clips[c.name] || 0) + 1;
    const s = keloClip.shot && keloClip.shot.clip; if (s) r.clips[s.name] = (r.clips[s.name] || 0) + 1;
    if (keloClip.carryW > 0.5 && keloClip.carryCur) r.clips[keloClip.carryCur.name] = (r.clips[keloClip.carryCur.name] || 0) + 1;
    r.phaseAt.push(r.phase);
    // where the carried thing is (in his hands, or on its way down), every frame
    const held = (typeof carriedObject !== 'undefined' && carriedObject) || (typeof keloHand !== 'undefined' && keloHand.down && keloHand.down.obj) || null;
    if (held && held.parent) { const w = held.getWorldPosition(_v); r.H.push(+w.x.toFixed(4), +w.y.toFixed(4), +w.z.toFixed(4)); } else r.H.push(0, 0, 0);
    // skin parts: where each skin group sits in its bone's space (must never change), and how far it moved in the world
    keloGroup.updateMatrixWorld(true);
    r.groups.forEach(G => {
      const w = G.g.getWorldPosition(_v);
      if (G.last) G.travel += w.distanceTo(G.last); G.last = w.clone();
      _m.copy(G.bone.matrixWorld).invert();
      const local = w.clone().applyMatrix4(_m);
      G.dev = Math.max(G.dev, local.distanceTo(G.local0));
      if (G.g.parent !== G.bone) G.reparented = true;
    });
    if (r.reach) {
      const L = __palm(keloLeftHand), R = __palm(keloRightHand);
      r.reach.errs.push([L.distanceTo(r.reach.l), R.distanceTo(r.reach.r)]);
    }
  };
  window.__startRec = () => {
    const groups = [];
    Object.entries(__bones()).forEach(([k, b]) => b.children.forEach(g => { if (g.userData.keloSkin) groups.push({ k, g, bone: b }); }));
    keloGroup.updateMatrixWorld(true);
    groups.forEach(G => { const w = G.g.getWorldPosition(new THREE.Vector3()); G.local0 = w.clone().applyMatrix4(new THREE.Matrix4().copy(G.bone.matrixWorld).invert()); G.dev = 0; G.travel = 0; G.last = null; });
    window.__rec = { n: 0, J: [], H: [], clips: {}, phase: 'start', phaseAt: [], groups, reach: null };
  };
})();`;

async function runSkin(arg, ctx) {
  // 'classic@rerun' runs Classic again, saved as anim-classic-rerun (the determinism control)
  const [skin, tag] = arg.split('@'), name = tag ? `${skin}-${tag}` : skin;
  const { page, errors } = ctx;
  const ev = (fn, a) => page.evaluate(fn, a);
  // A fresh page with this skin saved as worn (the load path), then equip again in place (the rebuild path)
  await ev(s => { state.skins.owned = KELO_SKINS.map(k => k.id); state.skins.equipped = s; savePersistentBrainStateNow(); }, skin);
  await ctx.reload();
  const loaded = await ev(() => keloSkinBuilt && keloSkinBuilt.skin);
  await ev(s => { equipKeloSkinLook('classic'); equipKeloSkinLook(s); }, skin);
  await ev(PAGE_SETUP);
  // An open, flat spot: nothing within 7 units of the walk line, ground well above the lake
  const spot = await ev(() => {
    const H = (x, z) => getIslandGroundHeight(x, z);
    let best = null;
    for (let x = -70; x <= 70; x += 1.5) for (let z = -50; z <= 50; z += 1.5) {
      let ok = true, minH = 1e9, maxH = -1e9;
      for (let u = -2; u <= 9 && ok; u += 1) for (let v = -3; v <= 3 && ok; v += 1.5) {
        const h = H(x + u, z + v); minH = Math.min(minH, h); maxH = Math.max(maxH, h);
        if (!(h > (typeof WATER_LEVEL === 'number' ? WATER_LEVEL : -0.18) + 0.4)) ok = false;
      }
      if (!ok || maxH - minH > 0.9) continue;
      let clear = 1e9;
      worldObstacles.forEach(o => { const dx = Math.max(0, Math.abs(o.x - (x + 3.5)) - 6.5), dz = Math.abs(o.z - z); clear = Math.min(clear, Math.hypot(dx, dz) - (o.r || 0.5)); });
      const sc = Math.min(clear, 8) - Math.hypot(x, z) * 0.02;
      if (!best || sc > best.sc) best = { x, z, clear, flat: maxH - minH, sc };
    }
    return best;
  });
  if (!spot) throw new Error('no open spot found');
  START.x = spot.x; START.z = spot.z; WALK_TO.x = spot.x + 6.5; WALK_TO.z = spot.z;
  console.log('  spot', JSON.stringify(spot));
  await ev(() => __vtOn(1000));
  await ev(([S]) => {
    state.microPose = 'normal'; state.currentLocKey = null; state.isBuilding = false; state.isPracticing = false;
    state.calendar.epoch = Date.now(); state.calendar.startHour = 12.5; if (typeof applyTimeOfDay === 'function') applyTimeOfDay();
    __seed(424242); window.__keloRnd = 99991; __vt.noRender = true;
    state.isCollectingMail = true; state.cameraMode = 'none';
    state.botPos = { x: S.x, z: S.z }; state.targetPos = { x: S.x, z: S.z }; state.botRotY = Math.PI / 2;
    keloDoing(null); clearKeloReach(); if (carriedObject) setCarriedObject(null);
    // the same starting state every run: idle, glance and fidget timers, no emote
    keloEmote = null; keloAnim.nextLookAt = keloAnim.nextShiftAt = keloAnim.idleSince = 0;
    Object.assign(keloFace, { nextBlinkAt: 0, blinkStart: -1, blink: 0 });
    Object.assign(keloHuman, { lastSyncBlink: -9, syncBlinks: 0, talkStart: -9, talkUntil: -9, talkW: 0, gazeW: 0, gy: 0, gp: 0, lastHeadYaw: null, dipT: -9, lastCarried: undefined,  nextFidgetAt: 0, fidgets: 0, pending: null, wakeAt: 0 });
    keloFocus.fn = null; state.speechBubble = '';
    // and the motion state starts fresh: springs, walk cycle, settle steps, foot locks, clips
    // facing the test direction already (no steps round on the spot), standing still
    // the frame clocks and smoothing start over (the jump to the test clock would otherwise differ per run)
    keloAnim.lastT = null; keloAnim.look = { x: 0, y: 0, z: 0 }; keloAnim.lookTarget = { x: 0, y: 0, z: 0 };
    Object.assign(keloSim, { acc: 0, lastT: null, has: false, step: 0 });
    Object.assign(keloMotion, { lastCall: -1, frameT: null, root: { corr: null, prev: null, yawCorr: 0 } });
    if (keloIK.stats) keloIK.stats = { probes: 0, relocks: 0, short: 0 };
    keloAnim.yaw = state.botRotY; keloAnim.turn = null; keloAnim.mcStart = null; keloAnim.mcStride = 0;
    if (keloGroup) keloGroup.rotation.set(0, state.botRotY, 0);
    Object.assign(keloMotion, { speed: 0, acc: 0, heading: state.botRotY, yawRate: 0, desiredYaw: state.botRotY, yawError: 0, pivot: false, aim: null, lastX: null, lastZ: null });
    ['L', 'R'].forEach(k => Object.assign(keloIK[k], { planted: false, lx: 0, ly: 0, lz: 0, pitch: 0, roll: 0, liftX: 0, liftY: 0, liftZ: 0, landY: 0, landProbed: 0, landPitch: 0, probeX: null, probeZ: 0 }));
    Object.assign(keloAnim, { base: null, vel: {}, phase: 0, walkW: 0, idleW: 0, lookW: 0, ramp: 0, shift: 0, shiftTarget: 0, settle: null, settleFade: null, legHold: null, ikPhase: null, speed: 0, lastX: null, lastZ: null });
    ['L', 'R'].forEach(k => { keloIK[k].planted = false; });
    Object.assign(keloIK, { drop: 0, dropV: 0, reachW: 0, lastRoot: null, legW: 0 });
    Object.assign(keloClip, { cur: null, prev: null, w: 0, wv: 0, shot: null, carried: undefined, carryCur: null, carryT: 0, carryW: 0, hint: null, req: null });
    __step(150, 1 / 30);
    __allow = false;
    __seed(1234567); window.__keloRnd = 31337;
    __startRec();
  }, [START]);
  if (process.env.QUICK) {
    const snap = await ev(() => {
      const r = v => typeof v === 'number' ? +v.toFixed(4) : v;
      const flat = (o, depth = 0) => { const out = {}; for (const k in o) { const v = o[k]; if (typeof v === 'number' || typeof v === 'boolean' || v === null) out[k] = r(v); else if (v && typeof v === 'object' && !v.isObject3D && depth < 1 && !Array.isArray(v)) Object.entries(flat(v, depth + 1)).forEach(([kk, vv]) => { out[k + '.' + kk] = vv; }); } return out; };
      return { anim: flat(keloAnim), ik: flat(keloIK), motion: flat(keloMotion), sim: flat(keloSim), pos: [keloGroup.position.x, keloGroup.position.y, keloGroup.position.z, keloGroup.rotation.y].map(r), joints: KELO_JOINTS.map(([n, g]) => n + ':' + ['x', 'y', 'z'].map(a => r(g().rotation[a])).join('/')) };
    });
    fs.writeFileSync(path.join(OUT, `start-${name}.json`), JSON.stringify(snap, null, 1));
    return { n: 0, J: [], reachErr: { l: 0, r: 0 }, walked: 0, eyes: { visible: [], parts: 0 }, errors: [], groups: [], loaded };
  }
  const frames = [];
  const cam = async (label) => {
    await ev(() => {
      const p = keloGroup.position, y = keloGroup.rotation.y;
      // three-quarter front view from his right
      const a = y + 0.75;
      camera.position.set(p.x + Math.sin(a) * 5.4, p.y + 1.8, p.z + Math.cos(a) * 5.4);
      controls.target.set(p.x, p.y + 1.25, p.z); controls.update();
      __vt.noRender = false; __step(1, 1 / 30); __vt.noRender = true;
    });
    const f = path.join(OUT, `f-${name}-${String(frames.length).padStart(3, '0')}.png`);
    await page.screenshot({ path: f, clip: { x: 460, y: 170, width: 360, height: 460 }, timeout: 300000 });
    frames.push({ f, name: label });
  };
  const run = (phase, n) => ev(([p, n]) => { __rec.phase = p; __step(n, 1 / 30); }, [phase, n]);
  const video = async (phase, n, every, label) => { for (let i = 0; i < n; i += every) { await run(phase, every - 1); await cam(label); } };

  // 1. IK reach: both hands to points in front of his chest
  await ev(() => {
    const p = keloGroup.position, y = keloGroup.rotation.y, f = new THREE.Vector3(Math.sin(y), 0, Math.cos(y)), r = new THREE.Vector3(Math.cos(y), 0, -Math.sin(y));
    const c = new THREE.Vector3(p.x, p.y + 1.25, p.z).addScaledVector(f, 0.42);
    const l = c.clone().addScaledVector(r, 0.15), rr = c.clone().addScaledVector(r, -0.15);
    __rec.reachTargets = { l, r: rr };
    setKeloReach(() => ({ l, r: rr }));
  });
  await run('reach-in', 60);
  await ev(() => { __rec.reach = { l: __rec.reachTargets.l, r: __rec.reachTargets.r, errs: [] }; });
  await run('reach-hold', 20);
  await cam('reach');
  const reachErr = await ev(() => { const e = __rec.reach.errs; __rec.reach = null; clearKeloReach(); const m = e.reduce((a, b) => [a[0] + b[0], a[1] + b[1]], [0, 0]).map(x => x / e.length); return { l: m[0], r: m[1], max: Math.max(...e.flat()) }; });
  await run('reach-out', 30);
  // 2. Mocap idle, then the walk
  await run('idle', 90);
  await ev(([W]) => __go(W.x, W.z), [WALK_TO]);
  await video('walk', 120, 6, 'walk');
  await ev(() => { __rec.walkArrived = !state.isWalking; });
  await run('walk-end', 90);
  const walked = await ev(([S]) => Math.hypot(state.botPos.x - S.x, state.botPos.z - S.z), [START]);
  // 3. Pick up a box, carry it a few steps, put it down
  await ev(() => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.32), new THREE.MeshStandardMaterial({ color: 0xb08a5a })); b.scale.set(1.0001, 1, 1); setCarriedObject(b); });
  await video('pickUp', 36, 3, 'pick up');
  await ev(([S]) => __go(S.x + 3, S.z), [START]);
  await video('carry-walk', 60, 6, 'carry');
  await run('carry-stop', 60);
  await ev(() => setCarriedObject(null));
  await video('putDown', 36, 3, 'put down');
  await run('after', 30);
  // heavy pick up
  await ev(() => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x7a6a5a })); b.scale.set(1.0001, 1, 1); setCarriedObject(b); });
  await run('pickUpHeavy', 60);
  await ev(() => setCarriedObject(null));
  await run('putDownHeavy', 50);
  // 4. Tool swing: an axe, chopping
  await ev(() => { const axe = buildItemModel3D('Axe', { label: false }); setCarriedObject(axe); keloDoing('chop'); });
  await video('chop', 48, 3, 'tool swing');
  await ev(() => { keloDoing(null); });
  await run('chop-out', 40);
  await ev(() => setCarriedObject(null));
  await run('after-chop', 30);
  // 5. Every action clip (sticky hint while he stands), each followed by its exit
  const acts = await ev(() => Object.keys(KELO_ACTS).filter(a => a !== 'drive'));
  for (const a of acts) {
    const n = await ev(a => { const A = KELO_ACTS[a]; const d = (A.in ? KELO_CLIPS[A.in].d : 0) + A.loop.reduce((t, c) => t + KELO_CLIPS[c].d, 0) * 1.6; keloDoing(a); return Math.min(330, Math.ceil(d * 30)); }, a);
    await run('act:' + a, n);
    if (a === 'sit' || a === 'weld' || a === 'dig' || a === 'sleep') await cam(a);
    await ev(() => keloDoing(null));
    await run('exit:' + a, 60);
  }
  // 6. Driving: the drive action while riding (getIn, drive loops, getOut)
  await ev(() => { __pin.riding = 'Test car'; window.__act = 'drive'; });
  await run('act:drive', 200);
  await ev(() => { window.__act = null; });
  await run('exit:drive', 60);
  await ev(() => { __pin.riding = null; });
  await run('after-drive', 30);
  // 7. Through his eyes: no skin part may show
  const eyes = await ev(() => {
    state.cameraMode = 'eyes'; __vt.noRender = false; __step(3, 1 / 30);
    const shown = o => { for (let a = o; a; a = a.parent) if (!a.visible) return false; return true; };
    const parts = []; keloGroup.traverse(o => { if (o.userData && o.userData.keloSkin) parts.push(o); });
    const visible = parts.filter(shown).map(o => o.parent && o.parent.name || '?');
    return { parts: parts.length, visible, headHidden: !keloHead.visible };
  });
  await page.screenshot({ path: path.join(OUT, `eyes-${name}.png`), timeout: 300000 });
  await ev(() => { state.cameraMode = 'none'; __step(3, 1 / 30); __vt.noRender = true; });
  // Results
  const res = await ev(() => {
    const r = __rec;
    return { n: r.n, J: r.J, H: r.H, clips: r.clips, phaseAt: r.phaseAt, walkArrived: r.walkArrived,
      groups: r.groups.map(G => ({ bone: G.k, dev: G.dev, travel: G.travel, reparented: Boolean(G.reparented), children: G.g.children.length })),
      allClips: Object.keys(KELO_CLIPS), skinNow: keloSkinBuilt.skin, equipped: state.skins.equipped };
  });
  res.blocked = await ev(() => window.__blocked.slice(0, 8).concat([String(window.__blocked.length)]));
  res.reachErr = reachErr; res.walked = walked; res.eyes = eyes; res.loaded = loaded; res.errors = errors.slice();
  res.frames = frames.map(f => ({ f: path.basename(f.f), name: f.name }));
  fs.writeFileSync(path.join(OUT, `anim-${name}.json`), JSON.stringify(res));
  // frame strip (walk, pick up, carry, put down, tool swing) and an mp4 of every captured frame
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '6', '-i', path.join(OUT, `f-${name}-%03d.png`), '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-pix_fmt', 'yuv420p', path.join(OUT, `anim-${name}.mp4`)]);
  } catch (e) { console.log('ffmpeg failed', e.message); }
  return res;
}

(async () => {
  const ctx = await boot();
  for (const s of SKINS) {
    const t0 = Date.now();
    ctx.errors.length = 0;
    const r = await runSkin(s, ctx);
    console.log(`${s}: loaded=${r.loaded} frames=${r.n} walked=${r.walked.toFixed(2)} arrived=${r.walkArrived} reach l=${(r.reachErr.l * 100).toFixed(2)}cm r=${(r.reachErr.r * 100).toFixed(2)}cm groups=${r.groups.length} eyesVisible=${r.eyes.visible.length}/${r.eyes.parts} errors=${r.errors.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    if (r.errors.length) console.log('  errors:', r.errors.slice(0, 5));
  }
  await ctx.close();
})();
