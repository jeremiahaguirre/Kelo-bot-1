// DSF-2 screenshots of a saved snapshot (PRESAVE): VIEWS=over,orchard,plots,pasture,hay,yard,pen,shed
const path = require('path');
module.exports = async (page, h) => {
  page.setDefaultTimeout(0);
  await h.render(true);
  await h.ev(() => { if (typeof setGraphicsLevel === 'function') setGraphicsLevel(window.__lvl || 'balanced', true); });
  await h.ev(() => { isRaining = () => false; rainForHour = () => false; state.isPracticing = true; const w = worldNow(); farmFastForward(((12.5 - w.hour + 24) % 24) / 24); if (typeof applyTimeOfDay === 'function') applyTimeOfDay(); });
  await h.wait(4000);
  const views = (process.env.VIEWS || 'over').split(',');
  for (const v of views) {
    const cam = await h.ev((v) => {
      state.cameraMode = 'none';
      const W = (x, d) => farmWorld(x, d), y = farmSiteY();
      const C = {
        over: [W(8, 30), 75, W(40, 140)], yard: [W(20, 60), 32, W(32, 96)], orchard: [W(4, 96), 14, W(22, 125)], orchard2: [W(22, 100), 7, W(22, 125)], cherry: [W(14, 138), 5, W(22, 150)], apple: [W(14, 108), 4.5, W(24, 116)],
        plots: [W(4, 150), 16, W(22, 186)], plots2: [W(20, 156), 6, W(20, 168)], pasture: [W(30, 100), 20, W(56, 140)], pasture2: [W(48, 110), 5, W(56, 125)],
        hay: [W(70, 135), 30, W(137, 180)], hay2: [W(110, 150), 9, W(130, 170)], pen: [W(76, 28), 11, W(66, 44)], shed: [W(30, 74), 10, W(31, 90)], coop: [W(40, 92), 6, W(48, 104)]
      }[v];
      if (!C) return null;
      camera.position.set(C[0].x, y + C[1], C[0].z);
      if (typeof controls !== 'undefined' && controls) { controls.target.set(C[2].x, y + 1, C[2].z); controls.update(); } else camera.lookAt(C[2].x, y + 1, C[2].z);
      if (typeof farmVisibilityFrame === 'function') farmVisibilityFrame();
      return [camera.position.x, camera.position.z];
    }, v);
    if (!cam) continue;
    await h.wait(5000);
    const info = await h.ev(() => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }));
    h.log('drawcalls', v, JSON.stringify(info));
    await h.shot(`${process.env.NAME || 'shot'}-${v}`, { type: 'jpeg', quality: 82 });
  }
};
