// Draw calls and triangles at the north-yard viewpoints, plus the ground-in-building probe (inline, so it runs on main too)
module.exports = async ({ look, ev, wait }) => {
  await ev(() => { state.isPracticing = true; state.isBusy = true; });
  const probe = await ev(() => {
    const meshes = [terrainGroundMesh, northPatchMesh, farLandsMesh, scene.children.find(m => m.isMesh && m.geometry && m.geometry.parameters && m.geometry.parameters.width === 340)].filter(Boolean);
    const ray = new THREE.Raycaster(), out = {};
    meshes.forEach(m => { m.visible = true; m.updateMatrixWorld(); });
    [['hall', GARAGE_HALL], ['hangar', NORTH_HANGAR]].forEach(([k, B]) => {
      let top = -1e9, at = null, above = 0, n = 0;
      for (let x = B.x - B.w / 2 + 0.25; x <= B.x + B.w / 2 - 0.25; x += 1) for (let z = B.z - B.d / 2 + 0.25; z <= B.z + B.d / 2 - 0.25; z += 1) {
        ray.set(new THREE.Vector3(x, 80, z), new THREE.Vector3(0, -1, 0)); const h = ray.intersectObjects(meshes, false)[0]; n++;
        if (h) { if (h.point.y > WORKSHOP_PAD_Y + 0.12) above++; if (h.point.y > top) { top = h.point.y; at = [x, z]; } }
      }
      out[k] = { top: +top.toFixed(2), at, samplesAboveFloor: above, samples: n };
    });
    return out;
  });
  console.log('PROBE', JSON.stringify(probe));
  const V = [['owner-view', [60, 45, -215], [62, 0, -110]], ['between-buildings', [66, 9, -160], [66, 0, -100]], ['hall-inside', [90, 7, -117], [90, 1, -140]], ['valley-high', [62, 30, -10], [65, 0, -110]], ['town', [0, 20, 30], [0, 0, -5]]];
  for (const [n, p, t] of V) {
    await look(p, t); await wait(2500);
    const r = await ev(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => res({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles })))));
    console.log('PERF', n, JSON.stringify(r));
  }
};
