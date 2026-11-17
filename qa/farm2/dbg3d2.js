module.exports = async (page, h) => {
  await h.wait(6000);
  h.log(JSON.stringify(await h.ev(() => {
    const t = farm2V.orchard && farm2V.orchard.children[0]; if (!t) return 'none';
    const m = new THREE.Matrix4(); t.getMatrixAt(5, m); const p = new THREE.Vector3().setFromMatrixPosition(m);
    let vis = true, o = t; while (o) { if (!o.visible) vis = o.name || 'unnamed'; o = o.parent; }
    t.updateMatrixWorld(true);
    return { name: t.name, count: t.count, p: [p.x, p.y, p.z], ground: getAnalyticalGroundHeight(p.x, p.z), bs: t.boundingSphere && [t.boundingSphere.center.x, t.boundingSphere.center.z, t.boundingSphere.radius], vis, inScene: (() => { let o = t; while (o.parent) o = o.parent; return o === scene; })(), mw: t.matrixWorld.elements.slice(12, 15), geoCount: t.geometry.attributes.position.count, frustumCulled: t.frustumCulled, mat: t.material.type, layers: t.layers.mask };
  })));
};
