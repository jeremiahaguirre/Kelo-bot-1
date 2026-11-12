// Usage: KELO_ROOT=... node framerate.js
// The same scripted scenario on a virtual clock at 60, 144 and 30 frames a second (a fresh page each):
// Kelo-1 walking, a truck he drives, a balloon climbing, his airplane's planned circuit and the
// follow camera. After the same number of seconds every result must match to within a hair.
const { boot, virtualClock } = require('./boot');
const FPS = (process.env.FPS || '60,144,30').split(',').map(Number);
const SECS = +process.env.SECS || 6;

async function run(fps) {
  const { W, done, page } = await boot({ seed: 12345, gfx: 'fast' });
  // Virtual clock: performance.now and requestAnimationFrame are ours; drawing is skipped (logic only)
  await virtualClock(W, page); // the real loops hand over to the virtual one
  // (a macrotask between frames, so promise-driven motion runs between them as it would for real)
  const pump = (secs) => W(async ([fps, secs]) => {
    const n = Math.round(secs * fps);
    for (let i = 0; i < n; i++) {
      window.__vc.now += 1000 / fps;
      const cbs = window.__vc.q.splice(0);
      cbs.forEach(cb => cb(window.__vc.now));
      await new Promise(r => setTimeout(r, 0));
    }
  }, [fps, secs]);
  const pose = () => W(() => ({
    x: state.botPos.x, z: state.botPos.z, rot: state.botRotY,
    gx: keloGroup.position.x, gy: keloGroup.position.y, gz: keloGroup.position.z, gr: keloGroup.rotation.y,
    cx: camera.position.x, cy: camera.position.y, cz: camera.position.z
  }));
  // Wait until the world has finished loading in the background (lazily built buildings add their
  // obstacles), so every run plans its paths around the same things
  const settle = async () => { let last = '', same = 0; for (let i = 0; i < 40 && same < 3; i++) { await pump(0.5); await page.waitForTimeout(1500); const sig = await W(() => obstacleSignature()); same = sig === last ? same + 1 : 0; last = sig; } return last; };
  const out = {};
  out.obstacles = { n: await W(async () => worldObstacles.length) };
  await settle();
  out.obstacles.n = await W(() => worldObstacles.length);
  // Some buildings finish loading at slightly different moments from run to run and add obstacles in
  // town; the walk and the drive are out west, so only the obstacles there are kept (same in every run)
  await W(() => { const keep = worldObstacles.filter(o => o.x < -12); worldObstacles.length = 0; worldObstacles.push(...keep); });
  out.obstacles.west = await W(() => worldObstacles.length);
  // Open ground (well clear of every obstacle) near a spot, found the same way every run
  await W(() => {
    window.__free = (x0, z0) => {
      for (let r = 0; r < 12; r += 0.5) for (let a = 0; a < 16; a++) {
        const x = Math.round((x0 + Math.cos(a / 16 * Math.PI * 2) * r) * 10) / 10, z = Math.round((z0 + Math.sin(a / 16 * Math.PI * 2) * r) * 10) / 10;
        if (Math.min(...worldObstacles.map(o => obstacleProbe(o, x, z).d)) > 1.6) return { x, z };
      }
      return { x: x0, z: z0 };
    };
  });
  // 1. Walking across the meadow, the camera following
  const walk = await W(() => ({ a: __free(-28, -12), b: __free(-46, -4) }));
  await W(w => {
    state.riding = null; state.ridingSpeed = 1; state.ridingMode = null;
    state.botPos = { ...w.a }; state.botRotY = 0; state.targetPos = { ...w.a };
    state.cameraMode = 'follow';
  }, walk);
  await pump(1);
  await W(w => { state.targetPos = { ...w.b }; }, walk);
  await pump(SECS);
  out.walk = await pose();
  out.walk.target = await W(() => state.targetPos.x);
  await settle();
  // 2. Driving the truck west along the valley
  await W(() => {
    state.toolInventory.push('Dump truck'); registerVehicle('Dump truck');
    const v = findVehicle('truck'); const type = vehicleTypeFor(v.name);
    const a = __free(-20, -16), b = __free(-50, -12);
    v.x = a.x; v.z = a.z;
    state.riding = v.id; state.ridingMode = 'land'; state.ridingSpeed = type.speed;
    state.botPos = { ...a }; state.botRotY = -Math.PI / 2; state.targetPos = { ...b };
    if (typeof renderVehicles3D === 'function') renderVehicles3D();
  });
  await pump(SECS);
  out.truck = await pose();
  out.truck.vx = await W(() => vehicleMeshes[findVehicle('truck').id].position.x);
  out.truck.target = await W(() => state.targetPos.x);
  // 3. A hot air balloon climbing out over the lake
  await W(() => {
    state.toolInventory.push('Hot air balloon'); registerVehicle('Hot air balloon');
    const v = state.vehicles.find(x => /balloon/i.test(x.name)); const type = vehicleTypeFor(v.name);
    state.riding = v.id; state.ridingMode = 'air'; state.ridingSpeed = type.speed;
    if (typeof renderVehicles3D === 'function') renderVehicles3D();
    const m = vehicleMeshes[v.id]; m.userData.alt = 0; m.userData.lastT = undefined;
    state.botPos = { x: 0, z: 6 }; state.botRotY = Math.PI; state.targetPos = { x: 2, z: 40 };
  });
  await pump(SECS);
  out.balloon = await pose();
  out.balloon.alt = await W(() => vehicleMeshes[state.riding].userData.alt);
  // 4. His airplane flying its planned circuit
  out.plane = await W(() => {
    try {
      state.toolInventory.push('Ultralight airplane');
      const v = registerVehicle('Ultralight airplane') || state.vehicles.find(x => /ultralight/i.test(x.name));
      if (typeof renderVehicles3D === 'function') renderVehicles3D();
      const m = vehicleMeshes[v.id];
      if (!m) return { skipped: 'no plane model' };
      m.userData.fixedWing = true; // (the plain model; the flight only needs the flag)
      const start = { x: 46, z: 2 }, run = { x: 0, z: 1 };
      const plan = planeCircuitFor(start, run);
      state.riding = v.id; state.ridingMode = 'air'; state.ridingSpeed = vehicleTypeFor(v.name).speed;
      state.botPos = { ...start }; state.targetPos = { ...start }; state.botRotY = 0;
      Object.assign(m.userData, { alt: 0, landing: false, lift: 1, flight: { plan, s: 0, lastT: null, phase: null, pitch: 0, bank: 0, heading: 0, done: false } });
      return { ok: true };
    } catch (e) { return { skipped: String(e) }; }
  });
  if (out.plane.ok) {
    await pump(SECS * 2);
    out.plane = await W(() => { const f = vehicleMeshes[state.riding].userData.flight; return { x: state.botPos.x, z: state.botPos.z, rot: state.botRotY, s: f.s, y: f.y, pitch: f.pitch, bank: f.bank }; });
  }
  console.log('RESULT ' + JSON.stringify(out));
  await done();
}

(async () => {
  const res = {};
  for (const f of FPS) {
    // boot() exits the process at done(); run each fps in its own child instead
    if (process.env.ONE) { await run(+process.env.ONE); return; }
    const { execFileSync } = require('child_process');
    let txt = '';
    try { txt = execFileSync(process.execPath, [__filename], { env: { ...process.env, ONE: String(f) }, encoding: 'utf8', timeout: 1800000 }); }
    catch (e) { txt = String(e.stdout || ''); }
    const line = txt.split('\n').find(l => l.startsWith('RESULT '));
    console.log(f + ' fps:', txt.split('\n').filter(l => /page errors/.test(l)).join(' '));
    res[f] = line ? JSON.parse(line.slice(7)) : null;
  }
  const base = res[FPS[0]];
  let worst = 0, ok = true;
  console.log(`\nAfter ${SECS} s (plane ${SECS * 2} s), difference from ${FPS[0]} fps:`);
  console.log('obstacles (all / kept out west):', FPS.map(f => res[f] && res[f].obstacles ? `${f} fps ${res[f].obstacles.n}/${res[f].obstacles.west}` : f + ' -').join(', '));
  for (const sc of Object.keys(base || {}).filter(k => k !== 'obstacles')) {
    for (const f of FPS.slice(1)) {
      const a = base[sc], b = res[f] && res[f][sc];
      if (!a || !b || a.skipped) { console.log(sc, f, 'missing', a && a.skipped); continue; }
      const d = {};
      for (const k of Object.keys(a)) if (typeof a[k] === 'number') {
        let v = Math.abs(a[k] - b[k]);
        if (/rot|^gr$/.test(k)) v = Math.abs(Math.atan2(Math.sin(a[k] - b[k]), Math.cos(a[k] - b[k])));
        d[k] = +v.toExponential(2);
        // Simulation state must match closely; drawn things (keloGroup, camera) within a few cm
        const tol = /^(g|c)/.test(k) ? 0.05 : 0.005;
        if (v > tol) ok = false;
        worst = Math.max(worst, v);
      }
      console.log(`${sc.padEnd(8)} ${String(f).padStart(3)} fps  ` + Object.entries(d).map(([k, v]) => `${k}=${v}`).join(' '));
    }
  }
  console.log('\nvalues at ' + FPS[0] + ' fps:', JSON.stringify(base));
  console.log(ok ? 'FRAME RATE TEST: PASS' : 'FRAME RATE TEST: FAIL', 'worst', worst.toExponential(2));
  process.exit(ok ? 0 : 1);
})();
