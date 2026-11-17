module.exports = async (page, h) => {
  await h.wait(8000);
  h.log(JSON.stringify(await h.ev(() => {
    const out = {};
    farmGroup.children.forEach(c => { let n = 0; c.traverse(o => { if ((o.isMesh || o.isInstancedMesh || o.isLine) && o.visible) n++; }); const k = (c.name || c.type).split(':')[0] + (c.name && c.name.includes(':') ? ':' + c.name.split(':')[1] : ''); out[k] = (out[k] || 0) + n; });
    let veh = 0; Object.values(vehicleMeshes || {}).forEach(m => m.traverse(o => { if (o.isMesh && o.visible) veh++; }));
    out.__vehicles = veh;
    return Object.fromEntries(Object.entries(out).filter(([, v]) => v > 3).sort((a, b) => b[1] - a[1]));
  })));
};
