// High preset, north yard view: mean brightness of the scene crop for several haze-density factors
const { boot } = require('./boot');
(async () => {
  const { W, done, wait, look, page } = await boot({ gfx: 'high', seed: 12345 });
  await look(60, 45, -215, 62, 0, -110); await wait(3000);
  const base = await W(() => ({ ...KELO_LIGHTING.fog }));
  const out = {};
  for (const k of (process.env.FACTORS || '1').split(',').map(Number)) {
    await W(([k, base]) => { ['base', 'dusk', 'night', 'overcast'].forEach(n => { KELO_LIGHTING.fog[n] = base[n] * k; }); applyTimeOfDay(); }, [k, base]);
    await wait(2500);
    const buf = await page.screenshot({ clip: { x: 192, y: 160, width: 896, height: 360 } });
    out[k] = buf.toString('base64');
  }
  require('fs').writeFileSync('/home/user/qa-out/fogprobe.json', JSON.stringify(out));
  console.log('PROBE', Object.keys(out).join(','));
  await done();
})();
