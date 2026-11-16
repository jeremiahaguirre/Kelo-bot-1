// KELO_ROOT=... GFX=balanced node callmap.js : draw calls in the town view grouped by top-level scene object (main + shadow passes)
const { boot } = require('./boot');
(async () => {
  const { W, look, wait, done } = await boot({ gfx: process.env.GFX || 'balanced', seed: 12345 });
  await W(() => { state.botPos = { x: 2, z: 4 }; state.targetPos = { ...state.botPos }; });
  const v = (process.env.VIEW || '0,22,27,0,0.5,-1').split(',').map(Number);
  await look(...v); await wait(6000);
  const res = await W(() => new Promise(r => {
    const orig = renderer.renderBufferDirect.bind(renderer), counts = new Map();
    const top = o => { let p = o; while (p.parent && p.parent !== scene) p = p.parent; return p; };
    renderer.renderBufferDirect = function (cam, sc, geo, mat, obj, grp) {
      const t = top(obj); const k = (t.name || t.type) + '@' + t.position.x.toFixed(0) + ',' + t.position.z.toFixed(0) + (cam.isOrthographicCamera ? '' : '');
      const e = counts.get(k) || { main: 0, shadow: 0 }; if (sc === scene && !cam.isOrthographicCamera) e.main++; else e.shadow++; counts.set(k, e);
      return orig(cam, sc, geo, mat, obj, grp);
    };
    requestAnimationFrame(() => requestAnimationFrame(() => {
      renderer.renderBufferDirect = orig;
      r([...counts.entries()].map(([k, e]) => [k, e.main, e.shadow]).sort((a, b) => (b[1] + b[2]) - (a[1] + a[2])).slice(0, 40));
    }));
  }));
  let tm = 0, ts = 0; res.forEach(([k, m, s]) => { tm += m; ts += s; console.log(k.padEnd(40), m, s); });
  console.log('top40 total main', tm, 'shadow', ts);
  await done();
})();
