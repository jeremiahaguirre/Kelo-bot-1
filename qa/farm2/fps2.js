module.exports = async (page, h) => {
  const fps = () => h.ev(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 5000) requestAnimationFrame(f); else r(Math.round(n / 5 * 10) / 10); }; requestAnimationFrame(f); }));
  await h.wait(5000);
  h.log('level', await h.ev(() => graphicsLevel), 'fps', await fps());
  await h.ev(() => setGraphicsLevel('fast', true)); await h.wait(2000);
  h.log('fast fps', await fps());
};
