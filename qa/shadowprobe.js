// Town view frame time with the sun's shadows as they are, then shadows off (same page).
const { boot } = require('./boot');
(async () => {
  const { W, done, wait, look } = await boot({ gfx: 'balanced', seed: 12345 });
  await look(0, 22, 27, 0, 0.5, -1); await wait(3000);
  const frame = () => W(() => new Promise(res => { const ts = []; const f = t => { ts.push(t); if (ts.length < 7) requestAnimationFrame(f); else res(+((ts[6] - ts[1]) / 5).toFixed(0)); }; requestAnimationFrame(f); }));
  const out = { rev: await W(() => THREE.REVISION) };
  out.shadowsOn = await frame();
  await W(() => { sunLight.castShadow = false; });
  await wait(1500);
  out.shadowsOff = await frame();
  console.log('PROBE', JSON.stringify(out));
  await done();
})();
