// KELO_ROOT=... OUT=dir node shots.js : the same seeded world in fixed views (his life frozen), for before/after pixel diffs
const { boot } = require('./boot');
const path = require('path');
(async () => {
  const { W, look, shot, wait, done } = await boot({ gfx: process.env.GFX || 'balanced', seed: 12345, dsf: 1 });
  const out = process.env.OUT; require('fs').mkdirSync(out, { recursive: true });
  // Freeze the clock-driven motion so two runs draw the same frame
  await W(() => { state.botPos = { x: 2, z: 4 }; state.targetPos = { ...state.botPos }; });
  const views = { town: [0, 22, 27, 0, 0.5, -1], house: [-9.2, 9.5, 0.5, -9.2, 1.4, -8.0], houseNear: [-4, 3, 2, -9, 1.5, -8], storehouse: [7.6, 7.5, 3.5, 7.6, 2.0, -7.6], high: [10, 170, 90, 10, 0, -10], meadow: [-44, 7, 8, -30, 1, -6], workshop: [60, 30, 60, 50, 0, 40], west: [-60, 30, -40, -50, 0, -30] };
  for (const [n, v] of Object.entries(views)) {
    await look(...v); await wait(5000);
    await W(() => { clock.stop(); clock.elapsedTime = 100; window.__frozenT = true; });
    await shot(path.join(out, n + '.png'));
    await W(() => { clock.start(); });
  }
  await done();
})();
