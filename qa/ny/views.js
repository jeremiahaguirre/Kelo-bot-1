// The report's fixed viewpoints (same on the before and after builds), at noon
module.exports = async ({ look, shot, ev, page, wait }) => {
  await ev(() => { const c = ensureCalendar(); c.startHour = (c.startHour + 12 - worldNow().hour + 24) % 24; state.isPracticing = true; state.isBusy = true; state.botPos = { x: 60, z: 2 }; state.targetPos = { x: 60, z: 2 }; });
  const probe = await ev(() => typeof northYardGroundProbe === 'function' ? northYardGroundProbe() : null);
  console.log('probe', JSON.stringify(probe));
  const V = [
    ['owner-view', [60, 45, -215], [62, 0, -110]],
    ['valley-up-route', [66, 8, -12], [62, 1, -85]],
    ['valley-high', [62, 30, -10], [65, 0, -110]],
    ['pass-mid', [62, 6, -50], [62, 1, -110]],
    ['between-buildings', [66, 9, -160], [66, 0, -100]],
    ['yard-street', [110, 7, -100], [40, 0, -108]],
    ['hall-inside', [90, 7, -117], [90, 1, -140]],
    ['hall-inside-back', [86, 6, -137], [92, 1, -112]],
    ['hangar-inside', [34, 9, -116], [34, 1, -142]],
    ['north-apron', [30, 10, -168], [70, 0, -146]]
  ];
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  for (const [n, p, t] of V) { if (only && !only.includes(n)) continue; await look(p, t); await wait(1200); await shot(n); }
  // the corner minimap on the north sheet, zoomed in, and the Map tab's north sheet
  if (!only || only.includes('minimap')) {
    await look([60, 70, -100], [62, 0, -128]);
    await ev(() => { if (typeof minimapSetOpen === 'function') minimapSetOpen(true); });
    for (let i = 0; i < 2; i++) await page.click('[data-minimap-zoom="1"]').catch(() => {});
    await wait(1500);
    const mm = await page.$('#exploreMinimap');
    if (mm) { await wait(1500); const bb = await mm.boundingBox(); await page.screenshot({ path: require('path').join(process.env.OUT, 'minimap-north.png'), clip: bb, timeout: 300000 }); console.log('shot minimap-north'); }
    await page.evaluate(() => { window.openKeloMenu('map'); });
    await wait(1200);
    await page.evaluate(() => { const b = document.querySelector('[data-map-sheet="north"]'); if (b) b.click(); else { changesMap.sheet = 'north'; changesMapDraw(); } });
    await wait(1500);
    const cm = await page.$('#changesMap');
    if (cm) { await cm.scrollIntoViewIfNeeded().catch(() => {}); await wait(800); const bb = await cm.boundingBox(); console.log('cm box', JSON.stringify(bb)); await page.screenshot({ path: require('path').join(process.env.OUT, 'maptab-north.png'), clip: bb, timeout: 300000 }); console.log('shot maptab-north'); }
  }
};
