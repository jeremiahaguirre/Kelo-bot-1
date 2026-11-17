// Screenshots of a loaded snapshot at noon (DSF from env). NAME prefix from env.
module.exports = async (page, h) => {
  const name = process.env.NAME || 'snap';
  await h.wait(3000);
  await h.ev(() => { state.isPracticing = true; const w = worldNow(); farmFastForward(((12.5 - w.hour + 24) % 24) / 24); if (typeof applyTimeOfDay === 'function') applyTimeOfDay(); document.querySelectorAll('.toast, #toastContainer, [id*=toast]').forEach(e => e.style.display = 'none'); });
  await h.wait(2500);
  const info = await h.ev(() => ({ site: farmSite(), land: state.farm.land, b: Object.fromEntries(Object.entries(state.farm.buildings).map(([k, v]) => [k, v.stage])), fields: state.farm.fields.map(f => [f.name, f.soil, f.crop, Math.round(f.g * 100)]) }));
  h.log(name, JSON.stringify(info));
  if (!info.site) return;
  const S = info.site, cx = (S.minX + S.maxX) / 2, cz = (S.minZ + S.maxZ) / 2;
  const views = (process.env.VIEWS || 'over,yard,field').split(',');
  const calls = {};
  for (const v of views) {
    if (v === 'over') await h.look(S.minX - 40, 150, S.maxZ + 90, cx, 6, cz);
    if (v === 'lane') await h.look(120, 70, -40, 150, 12, -118);
    if (v === 'yard') { const r = await h.ev(() => farmBuildingRect('barn')); await h.look(r.x - 60, 38, r.z + 75, r.x - 5, 6, r.z - 5); }
    if (v === 'field') { const f = await h.ev(() => state.farm.fields[0] ? state.farm.fields[0] : null); if (!f) continue; await h.look(f.x0 - 10, 18, f.z1 + 16, f.x0 + 40, 6, f.z1 - 30); }
    if (v === 'kelo') { const p = await h.ev(() => state.botPos); await h.look(p.x - 14, 10, p.z + 16, p.x, 3, p.z); }
    await h.wait(3000);
    calls[v] = await h.ev(() => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }));
    await h.shot(`${name}-${v}`);
  }
  h.log('drawcalls', name, JSON.stringify(calls));
};
