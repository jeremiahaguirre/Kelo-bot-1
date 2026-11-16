// What is Kelo-1 doing when the harness starts its scripted part (load event + 4 s, as harness.js)?
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.argv[2]), PORT = 8981;
const srv = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' }[path.extname(p)] || 'application/octet-stream' }); res.end(d); }); });
(async () => {
  await new Promise(r => srv.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  for (let i = 0; i < 2; i++) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { window.__dcl = performance.now(); }); });
    await page.route('**/*', route => { const u = route.request().url();
      if (u.startsWith(`http://localhost:${PORT}`)) return route.continue();
      if (u.includes('three.min.js')) return route.fulfill({ path: '/home/user/qa/vendor/three.min.js', contentType: 'application/javascript' });
      if (u.includes('OrbitControls.js')) return route.fulfill({ path: '/home/user/qa/vendor/OrbitControls.js', contentType: 'application/javascript' });
      if (u.includes('cdn.tailwindcss.com')) return route.fulfill({ path: '/home/user/qa/vendor/tailwind.js', contentType: 'application/javascript' });
      if (u.includes('phosphor-icons')) return route.fulfill({ body: '', contentType: 'application/javascript' });
      return route.fulfill({ status: 404, body: '' }); });
    await page.goto(`http://localhost:${PORT}/index.html`, { timeout: 420000 });
    const atLoad = await page.evaluate(() => ({ sinceDCL: Math.round(performance.now() - window.__dcl), dcl: Math.round(window.__dcl) }));
    await page.waitForTimeout(4000);
    console.log(process.argv[3], i, JSON.stringify({ atLoad, ...(await page.evaluate(() => ({ sinceDCL: Math.round(performance.now() - window.__dcl), busy: state.isBusy, building: state.isBuilding, practising: state.isPracticing, mood: state.moodTitle, landFill: typeof activeLandFill === 'function' ? !!activeLandFill() : 'n/a' }))) }));
    await page.close();
  }
  await browser.close(); srv.close();
})();
