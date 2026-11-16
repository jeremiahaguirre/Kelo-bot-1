// KELO_ROOT=... GFX=fast|balanced|high MODE=shots|perf OUT=dir TAG=before node gfxviews.js
// The graphics report's fixed views. MODE=shots: screenshots at deviceScaleFactor 2.
// MODE=perf: draw calls, triangles, JS ms per frame (inside animateDiorama, render submit included)
// and JS ms with the render stubbed (game JS only), per view.
const { boot } = require('./boot');
const path = require('path'), fs = require('fs');
(async () => {
  const gfx = process.env.GFX || 'balanced', mode = process.env.MODE || 'perf', tag = process.env.TAG || 'x';
  const out = process.env.OUT || path.join(__dirname, 'shots-gfx'); fs.mkdirSync(out, { recursive: true });
  const { W, look, shot, wait, done } = await boot({ gfx, seed: 12345, dsf: mode === 'shots' ? 2 : 1, w: mode === 'shots' ? 1280 : 640, h: mode === 'shots' ? 800 : 400 });
  await W(() => { state.botPos = { x: 2, z: 4 }; state.targetPos = { ...state.botPos }; });
  // Same draw distance in every run: no automatic step-down by the frame-rate watcher (software GL is slow)
  await W(() => { window.perfCanAutoStep = () => false; if (typeof graphicsChosen !== 'undefined') graphicsChosen = true; });
  // Hide toasts and story cards so the same views compare
  await W(() => { const st = document.createElement('style'); st.textContent = '.ui-toast, #storyCard, [id*="story"], [class*="toast"] { display: none !important; }'; document.head.appendChild(st); });
  const T0 = Date.now(); const log = (m) => console.log('[' + ((Date.now() - T0) / 1000).toFixed(0) + 's]', m);
  log('booted');
  const views = [
    ['town', [0, 22, 27, 0, 0.5, -1]],
    ['mainstreet', [12, 3.2, -4.5, -12, 1.2, -9.5]],
    ['lakeshore', [-14, 3.5, 16, 2, 0.5, 4]],
    ['meadow', [-44, 7, 8, -30, 1, -6]],
    ['workshop', [70, 13, 16, 53, 2, -7]],
    ['northyard', [110, 7, -100, 40, 0, -108]],
    ['golden', [0, 22, 27, 0, 0.5, -1], 1],
    ['night', [0, 22, 27, 0, 0.5, -1], 2],
    ['sunset', [22, 6, -9.5, -20, 3, -9], 1]
  ];
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  // JS ms per frame: time inside animateDiorama; "logic" leaves out the time inside renderer.render
  // (scene traversal, culling and WebGL submission; with software GL that also waits for the rasteriser)
  const measure = (secs) => W((secs) => new Promise(res => {
    const info = renderer.info; info.autoReset = false;
    const orig = window.animateDiorama, rr = renderer.render;
    let inRender = 0;
    renderer.render = function () { const a = performance.now(); const r = rr.apply(this, arguments); inRender += performance.now() - a; return r; };
    let n = 0, calls = 0, tris = 0, js = 0, logic = 0, t0 = 0;
    window.animateDiorama = function () {
      const a = performance.now();
      info.reset(); inRender = 0;
      orig();
      const b = performance.now();
      if (t0 === 0) { t0 = a; return; }
      n++; js += b - a; logic += b - a - inRender; calls += info.render.calls; tris += info.render.triangles;
      if (a - t0 > secs * 1000 && n >= 6) {
        window.animateDiorama = orig; info.autoReset = true; renderer.render = rr;
        res({ calls: Math.round(calls / n), tris: Math.round(tris / n), js: +(js / n).toFixed(2), logic: +(logic / n).toFixed(2), frame: +((a - t0) / n).toFixed(1), frames: n });
      }
    };
  }), secs);
  const res = {};
  for (const [name, cam, preset] of views) {
    if (only && !only.includes(name)) continue;
    await W(p => { if (p) { state.lightingMode = 'manual'; applySkyPreset(p); } else { state.lightingMode = 'auto'; applyTimeOfDay(); } }, preset || 0);
    log(name + ' light'); await look(...cam); log(name + ' look');
    await wait(mode === 'shots' ? 4000 : 2500);
    if (mode === 'shots') { await shot(path.join(out, `${tag}-${gfx}-${name}.png`)); continue; }
    log(name + ' measure'); const full = await measure(1); log(name + ' full');
    res[name] = { calls: full.calls, tris: full.tris, jsFrame: full.js, jsLogic: full.logic, frame: full.frame };
    console.log(gfx, name, JSON.stringify(res[name]));
  }
  if (mode === 'perf') { fs.writeFileSync(path.join(out, `${tag}-${gfx}-perf.json`), JSON.stringify(res, null, 1)); console.log('RESULT', JSON.stringify({ gfx, res })); }
  await done();
})();
