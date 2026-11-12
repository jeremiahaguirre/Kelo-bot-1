// node probe.js '<async js body returning JSON-able>'  (boots the game, freezes his life, runs the body)
const { boot } = require('./boot');
(async () => {
  const { W, done } = await boot({ gfx: process.env.GFX || 'balanced', phone: Boolean(process.env.PHONE), seed: 12345, life: Boolean(process.env.LIFE) });
  const body = process.argv[2];
  const r = await W(new Function('return (async () => {' + body + '})()'));
  console.log('PROBE', JSON.stringify(r, null, 1));
  await done();
})();
