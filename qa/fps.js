const { boot } = require('./boot');
(async () => {
  const { W, wait, done } = await boot({ gfx: process.env.GFX || 'balanced', seed: 12345 });
  for (let i = 0; i < 3; i++) {
    const r = await W(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 5000) res({ n, ms: performance.now() - t0, anim: typeof animateDiorama, hidden: document.hidden }); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
    console.log(JSON.stringify(r));
  }
  await done();
})();
