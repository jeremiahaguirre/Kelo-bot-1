module.exports = async (page, h) => {
  await h.render(true);
  await h.ev(() => { isRaining = () => false; rainForHour = () => false; });
  await h.wait(5000);
  const r = await h.ev(() => { const t = farm2V.orchard.children[0]; const m = new THREE.Matrix4(); t.getMatrixAt(5, m); const p = new THREE.Vector3().setFromMatrixPosition(m); state.cameraMode = 'none'; camera.position.set(p.x - 3, p.y + 4, p.z + 12); controls.target.set(p.x, p.y + 2, p.z); controls.update(); return { p: [p.x, p.y, p.z], cam: camera.position.toArray(), fv: farmGroup.visible, f2v: farm2Group.visible, near: camera.near, far: camera.far }; });
  h.log(JSON.stringify(r));
  await h.wait(5000);
  await h.shot('dbg-tree', { type: 'jpeg', quality: 80 });
  h.log(JSON.stringify(await h.ev(() => ({ cam: camera.position.toArray(), fv: farmGroup.visible, mode: state.cameraMode }))));
};
