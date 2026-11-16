// Three.js upgrade check: the same fixed views on any build (r128 main or the upgraded branch).
// Usage: KELO_ROOT=<repo> PORT=8920 TAG=before [SHOTS=<dir>] [GFX=balanced] node threeviews.js
// Without SHOTS it measures draw calls, triangles, JS ms per frame (time inside animateDiorama) and
// frame time; with SHOTS it takes one screenshot per view at deviceScaleFactor 2 (no measuring).
// Views: town, lake, workshop (inside, Kelo-1 on the shop floor), north yard, night (town at 23:00).
const { boot } = require('./boot');
const path = require('path');
(async () => {
  const gfx = process.env.GFX || 'balanced';
  const shots = process.env.SHOTS, tag = process.env.TAG || 'x';
  const { W, look, shot, wait, done, page } = await boot({ gfx, seed: 12345, dsf: shots ? 2 : 1 });
  if (shots) require('fs').mkdirSync(shots, { recursive: true });
  console.log('three', await W(() => THREE.REVISION));
  const measure = (secs = 4) => W(secs => new Promise(res => {
    const info = renderer.info; info.autoReset = false;
    const orig = window.animateDiorama;
    let n = 0, calls = 0, tris = 0, js = 0, t0 = 0, last = 0, ft = [];
    window.animateDiorama = function () {
      const a = performance.now();
      info.reset();
      orig();
      const b = performance.now();
      if (t0 === 0) { t0 = a; last = a; return; }
      n++; js += b - a; calls += info.render.calls; tris += info.render.triangles; ft.push(a - last); last = a;
      if (a - t0 > secs * 1000 && n >= 5) {
        window.animateDiorama = orig; info.autoReset = true;
        ft.sort((x, y) => x - y);
        res({ calls: Math.round(calls / n), tris: Math.round(tris / n), js: +(js / n).toFixed(1), frame: +((a - t0) / n).toFixed(1), p95: +ft[Math.floor(ft.length * 0.95)].toFixed(1), frames: n, programs: renderer.info.programs ? renderer.info.programs.length : null });
      }
    };
  }), secs);
  const setHour = h => W(h => { state.calendar = { epoch: Date.now(), startDayOfYear: 180, startHour: h }; if (typeof applyTimeOfDay === 'function') applyTimeOfDay(); }, h);
  const view = async (name, cam, settle = 2500) => {
    await look(...cam);
    await wait(settle);
    if (shots) { await wait(1500); await shot(path.join(shots, `${tag}-${name}.png`)); return; }
    const r = await measure();
    console.log('PERF', name, JSON.stringify(r));
  };
  await W(() => { state.botPos = { x: 2, z: 4 }; state.targetPos = { ...state.botPos }; });
  await view('town', [0, 22, 27, 0, 0.5, -1]);
  await view('lake', [-6, 6, 14, 30, 0, 60]);
  await view('northyard', [60, 45, -215, 62, 0, -110]);
  await setHour(23);
  await wait(1500);
  await view('night', [0, 14, 22, 0, 1, -6]);
  await setHour(12);
  await wait(1500);
  // Inside the Workshop: he walks in by the person door and waits on the shop floor
  await W(() => {
    const site = workshopSite(); const o = siteToWorld(site, site.outside.x, site.outside.z, 0);
    state.botPos = { x: o.x, z: o.z }; state.targetPos = { ...state.botPos };
    state.cameraMode = 'follow';
    window.__perfHold = goIntoWorkshop({ stops: [{ stand: { x: 0, z: 1 }, act: () => new Promise(r => { window.__perfIn = r; }) }] });
  });
  await W(() => new Promise(r => { const c = () => (window.__perfIn ? r() : setTimeout(c, 300)); c(); }));
  await wait(3000);
  if (shots) { await wait(1500); await shot(path.join(shots, `${tag}-workshop.png`)); }
  else console.log('PERF', 'workshop', JSON.stringify(await measure()));
  await W(() => { window.__perfIn(true); });
  await done();
})();
