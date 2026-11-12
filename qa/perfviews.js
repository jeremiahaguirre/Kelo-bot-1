// Usage: KELO_ROOT=... GFX=fast|balanced [PHONE=1] [SHOTS=dir] [TAG=before] node perfviews.js
// Measures draw calls, triangles, JS ms per frame (time inside animateDiorama, which runs the frame
// hooks and submits the render) and frame time (rAF to rAF) in fixed views.
const { boot } = require('./boot');
const path = require('path');
(async () => {
  const gfx = process.env.GFX || 'balanced', phone = Boolean(process.env.PHONE);
  const { W, look, shot, wait, done } = await boot({ gfx, phone, seed: 12345, dsf: process.env.SHOTS ? 2 : 1 });
  const shots = process.env.SHOTS, tag = process.env.TAG || 'x';
  if (shots) require('fs').mkdirSync(shots, { recursive: true });
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
        res({ calls: Math.round(calls / n), tris: Math.round(tris / n), js: +(js / n).toFixed(1), frame: +((a - t0) / n).toFixed(1), p95: +ft[Math.floor(ft.length * 0.95)].toFixed(1), frames: n });
      }
    };
  }), secs);
  // Kelo-1 stands in town for the outdoor views
  await W(() => { state.botPos = { x: 2, z: 4 }; state.targetPos = { ...state.botPos }; });
  const views = [
    ['town', [0, 22, 27, 0, 0.5, -1]],
    ['meadow', [-44, 7, 8, -30, 1, -6]],
    ['mountain', [8, 30, 4, -14, 13, -28]],
    ['high', [10, 170, 90, 10, 0, -10]]
  ];
  const out = {};
  for (const [name, cam] of views) {
    await look(...cam);
    await wait(2500);
    out[name] = await measure();
    out[name].chunks = await W(() => typeof chunkStats === 'function' ? chunkStats() : null);
    console.log(gfx + (phone ? '/phone' : ''), name, JSON.stringify(out[name]));
    if (shots) await shot(path.join(shots, `${tag}-${phone ? 'phone-' : ''}${gfx}-${name}.png`));
  }
  if (!phone) {
    // Inside the Workshop: he walks in by the person door and waits on the shop floor
    await W(() => {
      const site = workshopSite(); const o = siteToWorld(site, site.outside.x, site.outside.z, 0);
      state.botPos = { x: o.x, z: o.z }; state.targetPos = { ...state.botPos };
      state.cameraMode = 'follow'; // the indoor-trip camera looks in through the cutaway
      window.__perfHold = goIntoWorkshop({ stops: [{ stand: { x: 0, z: 1 }, act: () => new Promise(r => { window.__perfIn = r; }) }] });
    });
    await W(() => new Promise(r => { const c = () => (window.__perfIn ? r() : setTimeout(c, 300)); c(); }));
    await wait(3000);
    out.workshop = await measure();
    console.log(gfx, 'workshop', JSON.stringify(out.workshop));
    if (shots) await shot(path.join(shots, `${tag}-${gfx}-workshop.png`));
    await W(() => { window.__perfIn(true); });
  }
  console.log('RESULT', JSON.stringify({ gfx, phone, out }));
  await done();
})();
