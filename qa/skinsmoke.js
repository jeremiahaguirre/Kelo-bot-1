// Quick look: equip each skin on the live rig, close-up shot, GPU memory before/after
const { boot } = require('./skinlib');
const path = require('path'), fs = require('fs');
const OUT = process.env.OUT || path.join(__dirname, 'shots', 'skins');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const { page, errors, close } = await boot();
  const look = () => page.evaluate(() => {
    state.cameraMode = 'none';
    const p = keloGroup.position;
    camera.position.set(p.x + 1.6, p.y + 2.0, p.z + 4.2);
    controls.target.set(p.x, p.y + 1.3, p.z); controls.update();
  });
  await page.evaluate(() => { state.skins.owned = KELO_SKINS.map(s => s.id); state.botPos = { x: -9.5, z: -4.6 }; state.targetPos = { x: -9.5, z: -4.6 }; state.botRotY = 0.4; });
  await page.waitForTimeout(1500);
  const mem0 = await page.evaluate(() => ({ ...renderer.info.memory, programs: renderer.info.programs.length }));
  for (const id of ['classic', 'explorer', 'kitbot', 'marshmallow', 'twirl', 'spark', 'classic']) {
    const r = await page.evaluate(id => { const ok = equipKeloSkin(id, { quiet: true }); let n = 0; keloGroup.traverse(() => n++); return { ok, n, eq: state.skins.equipped }; }, id);
    await look();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT, `smoke-${id}.png`), clip: { x: 440, y: 150, width: 400, height: 500 } });
    console.log(id, JSON.stringify(r), JSON.stringify(await page.evaluate(() => ({ ...renderer.info.memory, programs: renderer.info.programs.length }))));
  }
  console.log('mem0', JSON.stringify(mem0));
  console.log('page errors:', errors.length ? errors : 'none');
  await close();
})();
