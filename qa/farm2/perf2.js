// Draw calls and triangles per frame (all passes) at a view list and graphics levels: VIEWS=..., LEVELS=fast,balanced,high
module.exports = async (page, h) => {
  page.setDefaultTimeout(0);
  await h.render(true);
  await h.ev(() => { isRaining = () => false; rainForHour = () => false; state.isPracticing = true; });
  await h.wait(4000);
  const out = {};
  for (const lvl of (process.env.LEVELS || 'balanced').split(',')) {
    await h.ev(l => setGraphicsLevel(l, true), lvl);
    for (const v of (process.env.VIEWS || 'town').split(',')) {
      const ok = await h.ev((v) => {
        state.cameraMode = 'none';
        const S = farmSite(), W = (x, d) => S ? farmWorld(x, d) : { x: 0, z: 0 }, y = S ? farmSiteY() : 0;
        const C = { town: [{ x: 10, z: 60 }, 30, { x: 0, z: 0 }, 0], over: [W(8, 30), 75, W(40, 140), y], yard: [W(20, 60), 32, W(32, 96), y], orchard: [W(4, 96), 14, W(22, 125), y], pen: [W(76, 28), 11, W(66, 44), y], hay: [W(70, 135), 30, W(137, 180), y], plots: [W(4, 150), 16, W(22, 186), y] }[v];
        if (!C || (!S && v !== 'town')) return false;
        camera.position.set(C[0].x, C[3] + C[1], C[0].z); controls.target.set(C[2].x, C[3] + 1, C[2].z); controls.update();
        if (typeof farmVisibilityFrame === 'function') farmVisibilityFrame();
        return true;
      }, v);
      if (!ok) continue;
      await h.wait(4000);
      const r = await h.ev(() => new Promise(res => { renderer.info.autoReset = false; renderer.info.reset(); let raf = 0; const tick = () => { raf++; if (!res.done) requestAnimationFrame(tick); }; requestAnimationFrame(tick); setTimeout(() => { res.done = true; const n = Math.max(1, raf - 1); const o = { calls: Math.round(renderer.info.render.calls / n), tris: Math.round(renderer.info.render.triangles / n), frames: n }; renderer.info.autoReset = true; res(o); }, 15000); }));
      out[lvl + ':' + v] = r;
      h.log('PERF', process.env.LABEL || '', lvl, v, JSON.stringify(r));
    }
  }
};
