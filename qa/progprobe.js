const { boot } = require('./boot');
(async () => {
  const { W, done, wait, look } = await boot({ gfx: process.env.GFX || 'balanced', seed: 12345 });
  await look(0, 22, 27, 0, 0.5, -1); await wait(4000);
  const r = await W(() => { const m = {}; renderer.info.programs.forEach(p => { const k = p.name || '?'; m[k] = (m[k] || 0) + 1; }); return { rev: THREE.REVISION, n: renderer.info.programs.length, m }; });
  console.log(JSON.stringify(r));
  await done();
})();
