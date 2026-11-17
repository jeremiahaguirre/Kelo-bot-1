module.exports = async (page, h) => {
  await h.ev(() => { state.isPracticing = true; });
  const out = {};
  const views = { town: [0, 22, 30, 0, 0, -4], workshop: [54, 26, 30, 54, 0, -7], northyard: [60, 60, -60, 60, 0, -128] };
  for (const [k, v] of Object.entries(views)) {
    await h.look(...v); await h.wait(4000);
    const s = [];
    for (let i = 0; i < 4; i++) { await h.wait(500); s.push(await h.ev(() => ({ c: renderer.info.render.calls, t: renderer.info.render.triangles }))); }
    out[k] = { calls: Math.round(s.reduce((a, b) => a + b.c, 0) / s.length), tris: Math.round(s.reduce((a, b) => a + b.t, 0) / s.length) };
  }
  h.log('PERF', process.env.LABEL, JSON.stringify(out));
};
