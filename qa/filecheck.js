// Opens index.html from file:// (as the Windows app's loadFile does) and checks three.js and the world start.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'].concat(process.env.FILEACCESS ? ['--allow-file-access-from-files'] : []) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.route(/^https?:/, r => r.fulfill({ status: 404, body: '' }));
  await page.goto('file://' + process.env.KELO_ROOT + '/index.html', { timeout: 600000 });
  await page.waitForFunction(() => typeof renderer !== 'undefined' && renderer, null, { timeout: 600000 }).catch(() => {});
  await page.waitForTimeout(8000);
  console.log(JSON.stringify(await page.evaluate(() => ({ three: typeof THREE !== 'undefined' && THREE.REVISION, renderer: typeof renderer !== 'undefined' && !!renderer, sky: typeof skyMesh !== 'undefined' && !!skyMesh, hdr: typeof envPhotoTextures !== 'undefined' && Object.values(envPhotoTextures).every(Boolean), glb: typeof realModelsPending === 'function' ? 'fn' : '-', env: !!(typeof scene !== 'undefined' && scene && scene.environment) }))));
  const glb = await page.evaluate(() => Promise.all(REAL_MODELS.slice(0, 3).map(e => loadRealModelFile(e).then(s => e.file + ':' + (s ? 'loaded ' + (() => { let n = 0; s.traverse(o => { if (o.isMesh) n++; }); return n; })() + ' meshes' : 'FAILED'))))).catch(e => 'ERR ' + e.message);
  console.log('glb', JSON.stringify(glb));
  console.log('errors:', errs.length ? errs.slice(0, 8) : 'none');
  await browser.close();
})();
