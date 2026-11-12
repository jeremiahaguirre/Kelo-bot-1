// Usage: KELO_ROOT=... [GFX=balanced] node chunkab.js
// Same page, same moment: each view drawn with the chunk system on and off (window.KELO_CHUNKS_OFF),
// clouds hidden so nothing drifts between the two. Prints how many pixels differ and the draw calls.
const { boot } = require('./boot');
const path = require('path'), fs = require('fs');
const OUT = process.env.OUT || path.join(__dirname, '../results/ab');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const gfx = process.env.GFX || 'balanced';
  const { W, look, wait, page, done } = await boot({ gfx, seed: 12345 });
  // Things that fly or swim across the view between two shots (clouds, the bird flock, the lake
  // creature, the sailboat, wildlife) are hidden for the comparison
  await W(() => { [typeof cloudGroup !== 'undefined' && cloudGroup, typeof birdFlockGroup !== 'undefined' && birdFlockGroup, typeof ogopogoGroup !== 'undefined' && ogopogoGroup, typeof sailboatGroup !== 'undefined' && sailboatGroup, typeof wildlifeGroup !== 'undefined' && wildlifeGroup].forEach(g => { if (g) g.visible = false; }); state.botPos = { x: 2, z: 4 }; state.targetPos = { ...state.botPos }; });
  // Only the 3D view is compared (the HUD's text changes on its own)
  await page.addStyleTag({ content: 'body *{visibility:hidden !important} canvas{visibility:visible !important}' });
  const calls = () => W(() => new Promise(r => { const info = renderer.info; info.autoReset = false; const o = window.animateDiorama; window.animateDiorama = function () { info.reset(); o(); window.animateDiorama = o; info.autoReset = true; r({ calls: info.render.calls, tris: info.render.triangles }); }; }));
  const views = [['town', [0, 22, 27, 0, 0.5, -1]], ['meadow', [-20, 5, 6, -32, 1.5, -6]], ['mountain', [-6, 22, -14, -18, 14, -30]], ['high', [10, 170, 90, 10, 0, -10]]];
  let ok = true;
  for (const [name, cam] of views) {
    await look(...cam);
    await W(() => { window.KELO_CHUNKS_OFF = false; });
    await wait(9000); // merges are built a few seconds after a chunk goes quiet
    const on = await calls();
    const st = await W(() => chunkStats());
    const a = await page.screenshot({ path: path.join(OUT, `${gfx}-${name}-on.png`) });
    await W(() => { window.KELO_CHUNKS_OFF = true; });
    await wait(1500);
    const off = await calls();
    const b = await page.screenshot({ path: path.join(OUT, `${gfx}-${name}-off.png`) });
    await wait(1500);
    const b2 = await page.screenshot();
    const cmp = (a, b) => W(async ([a, b]) => {
      const img = async s => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
      const A = await img(a), B = await img(b);
      let n = 0, big = 0;
      for (let i = 0; i < A.length; i += 4) { const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])); if (d > 8) n++; if (d > 40) big++; }
      return { pct: +(100 * n / (A.length / 4)).toFixed(3), bigPct: +(100 * big / (A.length / 4)).toFixed(3) };
    }, [a.toString('base64'), b.toString('base64')]);
    const diff = await cmp(a, b), noise = await cmp(b, b2);
    // The trees sway, the water moves and the HUD ticks between shots: on/off may differ only as much
    // as two "off" shots the same time apart do
    if (diff.bigPct > noise.bigPct * 1.5 + 0.1) ok = false;
    console.log(`${gfx} ${name.padEnd(8)} calls on ${on.calls} / off ${off.calls}  tris on ${on.tris} / off ${off.tris}  on vs off: ${diff.pct}% of pixels (>40: ${diff.bigPct}%), off vs off ${noise.pct}% (>40: ${noise.bigPct}%)  merged chunks ${st.proxies}, parts ${st.mergedParts}`);
  }
  console.log(ok ? 'CHUNK A/B: PASS' : 'CHUNK A/B: CHECK THE PICTURES');
  await W(() => { window.KELO_CHUNKS_OFF = false; });
  await done();
})();
