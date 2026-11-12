// Usage: KELO_ROOT=... node tunnel.js
// Tunnelling: at 30, 60 and 144 frames a second on a virtual clock (a fresh page each), checked every frame:
//   wall     - a fast vehicle driven straight at a thin wall (posts 0.1 units thick, 0.3 apart)
//   building - a fast vehicle driven straight at the Post Office
//   shards   - glass dropped and shattered on the floor (fixed-step physics with a floor clamp)
//   landing  - his airplane's whole circuit to the stop: never below the ground or the water
const { boot, virtualClock } = require('./boot');
const FPS = (process.env.FPS || '30,60,144').split(',').map(Number);

async function run(fps) {
  const { W, done, page } = await boot({ seed: 12345, gfx: 'fast', bypassCSP: true }); // (the probes are compiled in the page)
  await virtualClock(W, page);
  // Pump frames; probe() runs after each and returns a number to keep the worst (smallest) of
  const pump = (secs, probe) => W(async ([fps, secs, probe]) => {
    const f = probe ? new Function('return ' + probe)() : null;
    let worst = Infinity, n = Math.round(secs * fps);
    for (let i = 0; i < n; i++) {
      window.__vc.now += 1000 / fps;
      window.__vc.q.splice(0).forEach(cb => cb(window.__vc.now));
      if (f) worst = Math.min(worst, f());
      if (window.__stop && window.__stop()) break;
      await new Promise(r => setTimeout(r, 0));
    }
    return worst;
  }, [fps, secs, probe]);
  const out = {};
  // A fast truck (straight line, no path planning: as if he aimed right at it)
  const drive = (from, to, rot) => W(([from, to, rot]) => {
    let v = findVehicle('truck');
    if (!v) { state.toolInventory.push('Dump truck'); registerVehicle('Dump truck'); v = findVehicle('truck'); }
    state.riding = v.id; state.ridingMode = 'water'; state.ridingSpeed = 6;
    window.vehicleTypeFor = ((orig) => (n) => { const t = orig(n); return t && t.kind === 'truck' ? { ...t, mode: 'land' } : t; })(window.__vtf || (window.__vtf = vehicleTypeFor));
    state.botPos = { ...from }; state.botRotY = rot; state.targetPos = { ...to };
    if (typeof renderVehicles3D === 'function') renderVehicles3D();
  }, [from, to, rot]);
  // 1. A thin wall across the meadow
  await W(() => {
    window.__wall = [];
    for (let z = 10; z <= 80; z += 0.3) window.__wall.push({ x: 60, z, r: 0.05, testWall: true });
    worldObstacles.push(...window.__wall);
  });
  // (out on the lake, where nothing else is in the way; a very fast truck, ridingSpeed 20)
  await drive({ x: -55, z: 26 }, { x: 85, z: 26 }, Math.PI / 2);
  await W(() => { state.ridingSpeed = 20; });
  // the most he got past the wall's far face while level with the wall (negative = never through it;
  // going round its end is fine)
  out.wall = { past: -(await pump(9, '() => { window.__maxSpeed = Math.max(window.__maxSpeed || 0, keloMotion.speed); const x = state.botPos.x, z = state.botPos.z, px = window.__px ?? x; if (px < 60 && x >= 60 && window.__crossZ === undefined) window.__crossZ = window.__pz + (z - window.__pz) * (60 - px) / Math.max(1e-9, x - px); window.__px = x; window.__pz = z; return (z > 10 - 0.6 && z < 80 + 0.6) ? -(x - (60 + 0.05)) : Infinity; }')), x: 0 };
  out.wall.x = await W(() => state.botPos.x);
  out.wall.speed = await W(() => keloMotion.speed);
  out.wall.maxSpeed = await W(() => window.__maxSpeed || 0);
  out.wall.crossZ = await W(() => window.__crossZ ?? null);
  await W(() => { worldObstacles.splice(0, worldObstacles.length, ...worldObstacles.filter(o => !o.testWall)); });
  // 2. The Post Office (its footprint is a box obstacle)
  const po = await W(() => ({ x: TOWN_BUILDINGS.post_office.x, z: TOWN_BUILDINGS.post_office.z }));
  await drive({ x: po.x + 16, z: po.z }, { x: po.x - 30, z: po.z }, -Math.PI / 2);
  out.building = { minGap: await pump(8, `() => { let g = Infinity; for (const o of worldObstacles) { if (Math.hypot(o.x - ${po.x}, o.z - ${po.z}) > 14) continue; g = Math.min(g, obstacleProbe(o, state.botPos.x, state.botPos.z).d); } return g; }`) };
  out.building.x = await W(() => state.botPos.x);
  out.building.speed = await W(() => keloMotion.speed);
  await W(() => { state.riding = null; state.ridingSpeed = 1; state.ridingMode = null; window.vehicleTypeFor = window.__vtf; state.botPos = { x: 2, z: 4 }; state.targetPos = { ...state.botPos }; });
  // 3. Glass shattering on the floor (the floor is the height it lands at)
  await W(() => {
    window.__floorY = getIslandGroundHeight(-12, 2) + 0.4;
    // (the same random spray in every run: other code draws random numbers once a frame, so the count so far differs by frame rate)
    let a = 777; const rnd = Math.random; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    window.__shards = shatterAt(new THREE.Vector3(-12, window.__floorY, 2), 10, 'glass');
    Math.random = rnd;
  });
  out.shards = { minAboveFloor: await pump(5, '() => Math.min(...window.__shards.map(s => s.position.y - (window.__floorY - 0.05)))') };
  out.shards.end = await W(() => window.__shards.map(s => s.userData.p || s.position).map(p => [p.x, p.y, p.z].map(v => +v.toFixed(4))).flat());
  // 4. The airplane's circuit, to the stop
  const plane = await W(() => {
    state.toolInventory.push('Ultralight airplane');
    const v = registerVehicle('Ultralight airplane') || state.vehicles.find(x => /ultralight/i.test(x.name));
    if (typeof renderVehicles3D === 'function') renderVehicles3D();
    const m = vehicleMeshes[v.id];
    if (!m) return null;
    m.userData.fixedWing = true;
    // The real strip: out of the hangar door, nose toward the lake (as flyBuiltAirplane does)
    const site = { ...workshopAssemblyBay(1), inWorkshop: true };
    const start = hangarExitFor(site), run = planeRunwayDir(site);
    const plan = planeCircuitFor(start, run);
    state.riding = v.id; state.ridingMode = 'air'; state.ridingSpeed = vehicleTypeFor(v.name).speed;
    state.botPos = { ...start }; state.targetPos = { ...start }; state.botRotY = 0;
    Object.assign(m.userData, { alt: 0, landing: false, lift: 1, flight: { plan, s: 0, lastT: null, phase: null, pitch: 0, bank: 0, heading: 0, done: false } });
    window.__plane = m;
    window.__stop = () => m.userData.flight.done;
    return { sEnd: plan.sEnd };
  });
  if (plane) {
    const gap = await pump(400, '() => { const f = window.__plane.userData.flight; const g = f.y - Math.max(getIslandGroundHeight(state.botPos.x, state.botPos.z), WATER_LEVEL); if (!(g >= (window.__lowG ?? Infinity))) window.__lowG = g, window.__lowAt = [f.s, state.botPos.x, state.botPos.z, f.phase]; return g; }');
    out.landing = { minAboveFloor: gap, ...(await W(() => { const f = window.__plane.userData.flight; return { done: f.done, s: f.s, x: state.botPos.x, z: state.botPos.z, lowAt: window.__lowAt }; })), sEnd: plane.sEnd };
  } else out.landing = { skipped: true };
  console.log('RESULT ' + JSON.stringify(out));
  await done();
}

(async () => {
  if (process.env.ONE) return run(+process.env.ONE);
  const { execFileSync } = require('child_process');
  const res = {};
  let ok = true;
  for (const f of FPS) {
    let txt = '';
    try { txt = execFileSync(process.execPath, [__filename], { env: { ...process.env, ONE: String(f) }, encoding: 'utf8', timeout: 3600000 }); } catch (e) { txt = String(e.stdout || ''); }
    const line = txt.split('\n').find(l => l.startsWith('RESULT '));
    const errs = txt.split('\n').filter(l => /page errors/.test(l)).join(' ');
    res[f] = line ? JSON.parse(line.slice(7)) : null;
    if (!res[f]) { ok = false; console.log(f, 'fps: no result', txt.slice(-800)); continue; }
    const r = res[f];
    const wallOk = r.wall.past < 0, bldOk = r.building.minGap > 0, shardOk = r.shards.minAboveFloor >= -1e-6, landOk = r.landing.skipped || (r.landing.minAboveFloor > -0.05 && r.landing.done);
    ok = ok && wallOk && bldOk && shardOk && landOk && /none/.test(errs);
    console.log(`${String(f).padStart(3)} fps  wall: furthest past ${r.wall.past.toFixed(3)} (top speed ${r.wall.maxSpeed.toFixed(1)} u/s = ${(r.wall.maxSpeed / f).toFixed(2)} a frame, ended at x ${r.wall.x.toFixed(2)}${r.wall.crossZ === null ? ', never crossed the wall line' : `, crossed the wall line at z ${r.wall.crossZ.toFixed(2)} (the wall runs z 10 to 80)`}) ${wallOk ? 'ok' : 'TUNNELLED'} | building: closest ${r.building.minGap.toFixed(3)} (stopped at x ${r.building.x.toFixed(2)}) ${bldOk ? 'ok' : 'INSIDE'} | shards: lowest ${r.shards.minAboveFloor.toFixed(4)} above floor ${shardOk ? 'ok' : 'FELL THROUGH'} | landing: ${r.landing.skipped ? 'skipped' : `lowest ${r.landing.minAboveFloor.toFixed(3)} above ground, stopped ${r.landing.done} at s ${r.landing.s.toFixed(1)}/${r.landing.sEnd.toFixed(1)}, lowest at ${JSON.stringify(r.landing.lowAt)}`} ${landOk ? 'ok' : 'BAD'} | ${errs}`);
  }
  const a = res[FPS[0]], b = res[FPS[FPS.length - 1]];
  if (a && b) {
    const sd = Math.max(...a.shards.end.map((v, i) => Math.abs(v - b.shards.end[i])));
    console.log(`shards end positions ${FPS[0]} vs ${FPS[FPS.length - 1]} fps: max difference ${sd.toExponential(2)}`);
    if (!a.landing.skipped) console.log(`plane stop ${FPS[0]} vs ${FPS[FPS.length - 1]} fps: ${Math.hypot(a.landing.x - b.landing.x, a.landing.z - b.landing.z).toExponential(2)} units apart`);
  }
  console.log(ok ? 'TUNNEL TEST: PASS' : 'TUNNEL TEST: FAIL');
  process.exit(ok ? 0 : 1);
})();
