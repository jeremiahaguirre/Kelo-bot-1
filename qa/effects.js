// KELO_ROOT=... GFX=balanced|high [VIEW=px,py,pz,tx,ty,tz] [PRESET=1|2] [TAG=x] node effects.js
// The cost of each new graphics effect in one view:
//  - draw calls of each effect's own objects (tagged userData.fx), main pass and shadow pass, counted
//    inside the renderer over 2 frames, plus the post-processing passes (full-screen quads)
//  - JavaScript ms of the new per-frame code and of the occasional rebuilds
//  - frame time (software GL here, so a fill-cost hint only) with each effect off and on, alternated
const { boot } = require('./boot');
const fs = require('fs');
(async () => {
  const gfx = process.env.GFX || 'balanced';
  const { W, look, wait, done } = await boot({ gfx, seed: 12345, w: 640, h: 400 });
  await W(() => { state.botPos = { x: 2, z: 4 }; state.targetPos = { ...state.botPos }; window.perfCanAutoStep = () => false; graphicsChosen = true; });
  const v = (process.env.VIEW || '0,22,27,0,0.5,-1').split(',').map(Number);
  if (process.env.PRESET) await W(p => { state.lightingMode = 'manual'; applySkyPreset(p); }, +process.env.PRESET);
  await look(...v); await wait(12000);
  const out = { gfx, view: v };
  out.calls = await W(() => new Promise(r => {
    const orig = renderer.renderBufferDirect.bind(renderer), by = {};
    const fxOf = o => { for (let p = o; p; p = p.parent) if (p.userData && p.userData.fx) return p.userData.fx; return null; };
    let total = 0;
    renderer.renderBufferDirect = function (cam, sc, geo, mat, obj, grp) {
      total++;
      const k = sc === null ? 'shadow' : sc === scene ? 'main' : 'post';
      const f = k === 'post' ? 'post passes' : fxOf(obj);
      if (f) { by[f] = by[f] || { main: 0, shadow: 0, post: 0 }; by[f][k]++; }
      return orig(cam, sc, geo, mat, obj, grp);
    };
    let frames = 0;
    const tick = () => { if (++frames < 3) return requestAnimationFrame(tick); renderer.renderBufferDirect = orig; Object.values(by).forEach(e => { e.main /= 3; e.shadow /= 3; e.post /= 3; }); r({ total: total / 3, by }); };
    requestAnimationFrame(() => { total = 0; Object.keys(by).forEach(k => delete by[k]); requestAnimationFrame(tick); });
  }));
  console.log('calls', JSON.stringify(out.calls));
  // JavaScript (ms per call)
  out.js = await W(() => {
    const t = (f, n = 300) => { const a = performance.now(); for (let i = 0; i < n; i++) f(); return +((performance.now() - a) / n).toFixed(4); };
    let now = performance.now();
    const r = {
      lookFrame: t(() => lookFrame(now += 16)),
      ambFrame: t(() => ambFrame(now += 16))
    };
    r.grassRelay = t(() => { grassState.x = 1e9; updateGrassTufts(); }, 5);
    r.contactRebuild = t(() => { scatContactState.sig = ''; scatBuildContact(); }, 5);
    r.counts = { tufts: grassTufts ? grassTufts.count : 0, flowers: scatFlowers ? scatFlowers.count : 0, contact: scatContact ? scatContact.count : 0, people: ambPeople.length };
    return r;
  });
  console.log('js', JSON.stringify(out.js));
  const measure = () => W(() => new Promise(res => {
    const orig = window.animateDiorama; let n = 0, t0 = 0;
    window.animateDiorama = function () { const a = performance.now(); orig(); if (!t0) { t0 = a; return; } n++; if (n >= 4) { window.animateDiorama = orig; res((a - t0) / n); } };
  }));
  const set = (k, val) => W(([k, val]) => { GRAPHICS_LEVELS[graphicsLevel][k] = val; applyGraphicsLevel(); }, [k, val]);
  const toggles = [['bloom', 'bloom'], ['grading', 'grade'], ['light shafts', 'shafts'], ['valley mist', 'mist'], ['cloud shadows', 'cloudShadows'], ['ground blending', 'groundBlend'], ['grass + flowers', 'grassRadius'], ['contact shadows', 'contactShadows'], ['air motes', 'airParticles'], ['town life', 'townLife']];
  out.frame = {};
  for (const [label, key] of toggles) {
    const on = await W(k => GRAPHICS_LEVELS[graphicsLevel][k], key);
    if (!on) { out.frame[label] = 'off at this level'; continue; }
    const offV = typeof on === 'number' ? 0 : false, a = [], b = [];
    for (let rep = 0; rep < 2; rep++) {
      await set(key, offV); await wait(1500); a.push(await measure());
      await set(key, on); await wait(1500); b.push(await measure());
    }
    const m = x => x.reduce((s, y) => s + y, 0) / x.length;
    out.frame[label] = { offMs: +m(a).toFixed(0), onMs: +m(b).toFixed(0), deltaPct: +((m(b) / m(a) - 1) * 100).toFixed(1) };
    console.log(label, JSON.stringify(out.frame[label]));
  }
  fs.mkdirSync('perf', { recursive: true });
  fs.writeFileSync(`perf/effects-${gfx}${process.env.TAG ? '-' + process.env.TAG : ''}.json`, JSON.stringify(out, null, 1));
  await done();
})();
