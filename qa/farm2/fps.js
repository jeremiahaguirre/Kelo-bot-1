module.exports = async (page, h) => {
  const fps = () => h.ev(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 5000) requestAnimationFrame(f); else r(Math.round(n / 5 * 10) / 10); }; requestAnimationFrame(f); }));
  await h.wait(5000);
  h.log('fps before', await fps(), JSON.stringify(await h.ev(() => renderer.info.render)));
  if (process.env.FARM) { await require('./farm1fast')(h); await h.wait(3000); h.log('fps farm', await fps(), JSON.stringify(await h.ev(() => renderer.info.render))); }
  if (process.env.FARM2) { await h.ev(() => farm2StartGoal('x')); await h.wait(3000); h.log('fps farm2', await fps()); }
};
