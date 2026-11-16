// Starts the packed desktop app (dist/linux-unpacked) under Xvfb with remote debugging and reads its page.
const { chromium } = require('playwright'); const { spawn } = require('child_process');
(async () => {
  const app = spawn('xvfb-run', ['-a', '/home/user/Kelo-bot-1/dist/linux-unpacked/kelo-1-world', '--no-sandbox', '--remote-debugging-port=9333', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'], { stdio: 'ignore' });
  let browser;
  for (let i = 0; i < 60 && !browser; i++) { await new Promise(r => setTimeout(r, 2000)); browser = await chromium.connectOverCDP('http://localhost:9333').catch(() => null); }
  const page = browser.contexts()[0].pages()[0];
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const failed = []; page.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url().slice(-60)); });
  // The container can't reach the three.js CDN: serve the same files locally, then reload
  await page.route('**/*', route => { const u = route.request().url();
    if (u.includes('three.min.js')) return route.fulfill({ path: '/home/user/qa/vendor/three.min.js', contentType: 'application/javascript' });
    if (u.includes('OrbitControls.js')) return route.fulfill({ path: '/home/user/qa/vendor/OrbitControls.js', contentType: 'application/javascript' });
    if (u.startsWith('file:')) return route.continue();
    return route.fulfill({ status: 404, body: '' }); });
  await page.reload();
  await page.waitForFunction(() => typeof renderer !== 'undefined' && renderer.info.render.frame > 5, null, { timeout: 300000 });
  await page.waitForTimeout(5000);
  console.log('electron', JSON.stringify({ url: page.url().replace(/.*resources/, '…resources'), scripts: await page.evaluate(() => [...document.scripts].map(s => (s.src || '').split('/').pop()).filter(s => s.startsWith('kelo'))), frames: await page.evaluate(() => renderer.info.render.frame), errors, failed: failed.slice(0, 8) }));
  await page.screenshot({ path: '/home/user/qares/evidence/electron-app.png' });
  await browser.close().catch(() => {}); app.kill(); process.exit(0);
})().catch(e => { console.log('electron check failed:', e.message); process.exit(1); });
