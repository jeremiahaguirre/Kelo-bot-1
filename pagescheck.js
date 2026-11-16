// GitHub Pages-like check: a plain static server (python http.server) with the site under /<repo>/,
// opened by its directory URL. Reports page errors and every failed or non-local request.
// Usage: node pagescheck.js <url> <label>
const { chromium } = require('playwright');
(async () => {
  const url = process.argv[2], label = process.argv[3];
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [], failed = [], local = new Set(), csp = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (/Content Security Policy|Refused to/.test(m.text())) csp.push(m.text().slice(0, 200)); });
  page.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
  page.on('requestfailed', r => failed.push('failed ' + r.url()));
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith('http://localhost')) { local.add(new URL(u).pathname.split('/').slice(0, 3).join('/')); return route.continue(); }
    if (u.includes('three.min.js')) return route.fulfill({ path: '/home/user/qa/vendor/three.min.js', contentType: 'application/javascript' });
    if (u.includes('OrbitControls.js')) return route.fulfill({ path: '/home/user/qa/vendor/OrbitControls.js', contentType: 'application/javascript' });
    failed.push('outside ' + u.slice(0, 100)); return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(url, { timeout: 420000 });
  await page.waitForFunction(() => typeof renderer !== 'undefined' && renderer.info.render.frame > 5, null, { timeout: 420000 });
  await page.waitForTimeout(8000);
  const info = await page.evaluate(() => ({ title: document.title, icons: getComputedStyle(document.querySelector('.ph-bold')).fontFamily, font: getComputedStyle(document.body).fontFamily.slice(0, 40), twApplied: getComputedStyle(document.body).overflow, frames: renderer.info.render.frame }));
  await page.screenshot({ path: `/home/user/qares/evidence/${label}.png` });
  console.log(label, JSON.stringify({ info, errors, csp, failed: failed.slice(0, 10), localPrefixes: [...local] }));
  await browser.close();
})();
