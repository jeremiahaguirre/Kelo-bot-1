// Perf per skin in the default town view (draw calls and triangles per frame, shadow pass included),
// and a contact sheet of all six skins front / side / back at deviceScaleFactor 2.
const { boot } = require('./skinlib');
const path = require('path'), fs = require('fs');
const OUT = process.env.OUT || path.join(__dirname, 'shots', 'skins');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const { page, errors, close } = await boot({ dpr: 2 });
  const ev = (fn, a) => page.evaluate(fn, a);
  await ev(() => {
    state.calendar.epoch = Date.now(); state.calendar.startHour = 12.5; applyTimeOfDay();
    state.skins.owned = KELO_SKINS.map(s => s.id);
    state.botPos = { x: -9.5, z: -4.6 }; state.targetPos = { x: -9.5, z: -4.6 };
    state.cameraMode = 'follow';
  });
  await page.waitForTimeout(3000);
  // Freeze the default follow view where it is, then measure each skin in turn on the same frames
  await ev(() => __vtOn());
  const perf = await ev(() => {
    __seed(99);
    __step(30, 1 / 30);
    state.cameraMode = 'none';
    const camPos = camera.position.clone(), tgt = controls.target.clone();
    renderer.info.autoReset = false;
    const out = {};
    const order = ['classic', ...KELO_SKINS.map(s => s.id).filter(i => i !== 'classic'), 'classic'];
    order.forEach((id, i) => {
      equipKeloSkin(id, { quiet: true });
      camera.position.copy(camPos); controls.target.copy(tgt); controls.update();
      __step(3, 1 / 30);   // shaders compiled, shadow casters checked
      const s = [];
      for (let k = 0; k < 4; k++) { renderer.info.reset(); __step(1, 1 / 30); s.push({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }); }
      let meshes = 0, kTris = 0;
      keloGroup.traverse(o => { if (o.isMesh && o.visible) { meshes++; const g = o.geometry; kTris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
      out[id + (i ? '' : '0')] = { calls: Math.max(...s.map(x => x.calls)), callsMin: Math.min(...s.map(x => x.calls)), tris: Math.max(...s.map(x => x.tris)), keloMeshes: meshes, keloTris: Math.round(kTris) };
    });
    renderer.info.autoReset = true;
    __vtOff();
    return out;
  });
  console.log('perf', JSON.stringify(perf, null, 1));
  fs.writeFileSync(path.join(OUT, 'perf.json'), JSON.stringify(perf, null, 1));
  await ev(() => __vtOn());
  await page.screenshot({ path: path.join(OUT, 'perf-view.png'), timeout: 300000 }).catch(e => console.log('perf-view shot failed'));
  // Contact sheet: each skin from the front, the side and the back, drawn in the skins studio
  const WIDE = process.env.SHEET === 'all';
  if (WIDE) await page.setViewportSize({ width: 2120, height: 800 });
  await ev(ids => {
    const LIST = ids === 'all' ? KELO_SKINS : ids ? KELO_SKINS.filter(s => ids.includes(s.id)) : KELO_SKINS.slice(0, 6);
    const wrap = document.createElement('div');
    wrap.id = 'sheet';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#1d2633;display:grid;grid-template-columns:repeat(' + LIST.length + ',1fr);gap:6px;padding:10px;font:600 13px Inter,sans-serif;color:#e2e8f0;';
    document.body.appendChild(wrap);
    LIST.forEach(s => {
      const col = document.createElement('div');
      col.style.cssText = 'display:grid;gap:4px;justify-items:center;align-content:start';
      const h = document.createElement('div'); h.textContent = `${s.name} · ${formatSkinPrice(s)}`; col.appendChild(h);
      const fig = buildKeloFigure(s.id);
      [['front', 0], ['side', Math.PI / 2], ['back', Math.PI]].forEach(([n, yaw]) => {
        const c = document.createElement('canvas'); c.width = 400; c.height = 460; c.style.cssText = 'width:200px;height:230px;background:#2a3646;border-radius:8px';
        drawKeloFigure(fig, yaw, c);
        col.appendChild(c);
        const l = document.createElement('div'); l.textContent = n; l.style.cssText = 'font-weight:400;font-size:11px;color:#94a3b8;margin-top:-2px'; col.appendChild(l);
      });
      disposeKeloFigure(fig);
      wrap.appendChild(col);
    });
  }, process.env.SHEET === 'all' ? 'all' : process.env.SHEET ? process.env.SHEET.split(',') : null);
  await ev(() => __vtOn());   // the game loop waits while the sheet is photographed
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, (process.env.TAG || '') + 'contact-sheet.png'), clip: { x: 0, y: 0, width: WIDE ? 2120 : 1280, height: 800 }, timeout: 300000 });
  // Each skin from the angle of its reference picture, large
  await ev(ids => {
    const LIST = ids === 'all' ? KELO_SKINS : ids ? KELO_SKINS.filter(s => ids.includes(s.id)) : KELO_SKINS.slice(0, 6);
    document.getElementById('sheet').remove();
    const wrap = document.createElement('div');
    wrap.id = 'sheet2';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#1d2633;display:grid;grid-template-columns:repeat(' + LIST.length + ',1fr);gap:6px;padding:10px;font:600 13px Inter,sans-serif;color:#e2e8f0;';
    document.body.appendChild(wrap);
    LIST.forEach(s => {
      const col = document.createElement('div');
      col.style.cssText = 'display:grid;gap:4px;justify-items:center;align-content:start';
      const h = document.createElement('div'); h.textContent = s.name; col.appendChild(h);
      const fig = buildKeloFigure(s.id);
      const v = s.view || {};
      const c = document.createElement('canvas'); c.width = 400; c.height = 720; c.style.cssText = 'width:200px;height:360px;background:#cfe3ea;border-radius:8px';
      drawKeloFigure(fig, v.yaw || 0, c, 2, { elev: v.elev });
      col.appendChild(c);
      const fig2 = buildKeloFigure(s.id);
      const c2 = document.createElement('canvas'); c2.width = 400; c2.height = 720; c2.style.cssText = 'width:200px;height:360px;background:#2a3646;border-radius:8px';
      drawKeloFigure(fig2, (v.yaw || 0) + Math.PI * 0.75, c2, 2, { elev: 0.1 });
      col.appendChild(c2);
      disposeKeloFigure(fig); disposeKeloFigure(fig2);
      wrap.appendChild(col);
    });
  }, process.env.SHEET === 'all' ? 'all' : process.env.SHEET ? process.env.SHEET.split(',') : null);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, (process.env.TAG || '') + 'photo-views.png'), clip: { x: 0, y: 0, width: WIDE ? 2120 : 1280, height: 800 }, timeout: 300000 });
  console.log('page errors:', errors.length ? errors : 'none');
  await close();
})();
