// Ground-relative views: VIEWS=crops|stand|yard|harvest (NAME prefix)
module.exports = async (page, h) => {
  await h.wait(3000);
  await h.ev(() => { state.isPracticing = true; state.isCollectingMail = true; const w = worldNow(); farmFastForward(((12.5 - w.hour + 24) % 24) / 24); if (typeof applyTimeOfDay === 'function') applyTimeOfDay(); state.farm.fields.forEach(f => farmRefreshFieldLook(f)); });
  const name = process.env.NAME;
  const at = (x, dy, z) => h.ev(([x, dy, z]) => getAnalyticalGroundHeight(x, z) + dy, [x, dy, z]);
  const lookG = async (px, py, pz, tx, ty, tz) => { const a = await at(px, py, pz), b = await at(tx, ty, tz); await h.look(px, a, pz, tx, b, tz); };
  const info = await h.ev(() => ({ fields: state.farm.fields.map(f => ({ x0: f.x0, x1: f.x1, z0: f.z0, z1: f.z1, crop: f.crop, st: (farmCropStage(f) || {}).name, g: Math.round(f.g * 100), soil: f.soil })), stand: farmBuildingRect('stand'), bins: farmBuildingRect('bins') }));
  h.log(name, JSON.stringify(info.fields));
  const calls = {};
  for (const v of (process.env.VIEWS || 'crops').split(',')) {
    if (v === 'crops') { const f = info.fields[0]; await lookG(f.x0 - 6, 9, f.z1 + 6, f.x0 + 30, 0, f.z1 - 25); }
    if (v === 'crops2') { const f = info.fields[1]; await lookG(f.x0 - 6, 9, f.z1 + 6, f.x0 + 30, 0, f.z1 - 25); }
    if (v === 'crops3') { const f = info.fields[2]; await lookG(f.x0 - 6, 9, f.z1 + 6, f.x0 + 30, 0, f.z1 - 25); }
    if (v === 'fieldsover') { const f = info.fields[1]; await lookG(f.x0 - 50, 70, (f.z0 + f.z1) / 2 + 60, (f.x0 + f.x1) / 2, 0, (f.z0 + f.z1) / 2); }
    if (v === 'stand') { const s = info.stand; await lookG(s.x + 9, 3, s.z + 11, s.x, 1.5, s.z); }
    if (v === 'yard') { const b = info.bins; await lookG(b.x - 45, 28, b.z + 60, b.x, 4, b.z); }
    if (v === 'kelo') { const p = await h.ev(() => state.botPos); await lookG(p.x - 12, 7, p.z + 12, p.x, 1.5, p.z); }
    await h.wait(3500);
    calls[v] = await h.ev(() => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }));
    await h.shot(`${name}-${v}`);
  }
  h.log('drawcalls', name, JSON.stringify(calls));
};
