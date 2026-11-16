// Does it matter where the compiled Tailwind stylesheet sits relative to css/style.css?
// Loads the built page twice (Tailwind after style.css, then before), opens every menu tab, and
// compares the computed style of every element. Usage: node cascade.js <_site dir> <dev repo dir>
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.argv[2]); const DEV = path.resolve(process.argv[3]); const PORT = 8951, DEVPORT = 8952;
const NM = process.env.NM || '/home/user/Kelo-bot-1/node_modules';
const TW3 = path.join(__dirname, 'dl/twcdn/package/tailwindcss.js');
const mk = R => http.createServer((req, res) => { const p = path.join(R, decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Content-Type': { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2' }[path.extname(p)] || 'application/octet-stream' }); res.end(d); }); });
const srv = mk(ROOT), dsrv = mk(DEV);
const PROPS = ['display', 'position', 'color', 'background-color', 'font-size', 'font-weight', 'font-family', 'line-height', 'padding-top', 'padding-left', 'margin-top', 'margin-left', 'border-top-width', 'border-top-color', 'border-radius', 'box-shadow', 'width', 'height', 'gap', 'opacity', 'visibility', 'z-index', 'text-align', 'transform', 'cursor', 'overflow', 'flex-direction', 'align-items', 'justify-content', 'top', 'left', 'right', 'bottom', 'outline-style', 'text-decoration-line', 'appearance', 'background-image'];
async function dump(browser, twFirst, dev) {
  const port = dev ? DEVPORT : PORT;
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route('**/*', async route => {
    const u = route.request().url();
    if (u.endsWith('/index.html') && twFirst) {
      let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const tw = html.match(/\s*<link rel="stylesheet" href="\.\/css\/tailwind\.[^"]+" \/>/)[0];
      html = html.replace(tw, '').replace('<link rel="stylesheet" href="./css/style.css" />', tw.trim() + '\n  <link rel="stylesheet" href="./css/style.css" />');
      return route.fulfill({ body: html, contentType: 'text/html' });
    }
    if (u.startsWith(`http://localhost:${port}`)) return route.continue();
    if (u.includes('fonts.googleapis.com/css')) return route.fulfill({ contentType: 'text/css', body: fs.readFileSync(path.join(ROOT, 'css/vendor/fonts/fonts.css'), 'utf8').replace(/url\(\.\//g, `url(http://localhost:${PORT}/css/vendor/fonts/`) });
    if (u.includes('cdn.tailwindcss.com')) return route.fulfill({ path: TW3, contentType: 'application/javascript' });
    let m = u.match(/unpkg\.com\/@phosphor-icons\/web@2\.1\.1\/(src\/.*)$/); if (m) return route.fulfill({ path: path.join(NM, '@phosphor-icons/web', m[1]) });
    if (/unpkg\.com\/@phosphor-icons\/web@2\.1\.1$/.test(u)) return route.fulfill({ path: path.join(NM, '@phosphor-icons/web/src/index.js'), contentType: 'application/javascript' });
    if (u.includes('three.min.js')) return route.fulfill({ path: '/home/user/qa/vendor/three.min.js', contentType: 'application/javascript' });
    if (u.includes('OrbitControls.js')) return route.fulfill({ path: '/home/user/qa/vendor/OrbitControls.js', contentType: 'application/javascript' });
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`http://localhost:${port}/index.html`, { timeout: 600000 });
  await page.waitForFunction(() => typeof renderer !== 'undefined' && renderer.info.render.frame > 0, null, { timeout: 600000 });
  await page.evaluate(() => { state.isCollectingMail = true; });
  await page.waitForTimeout(1500);
  console.log(dev ? 'dev' : twFirst ? 'built, tailwind first' : 'built, tailwind last', 'head order:', await page.evaluate(() => [...document.head.children].filter(e => e.tagName === 'STYLE' || e.tagName === 'LINK').map(e => e.tagName === 'STYLE' ? 'STYLE(' + e.textContent.length + ')' : (e.getAttribute('href') || '').split('/').pop()).join(' , ')));
  const out = {};
  const grab = async (tag) => Object.assign(out, await page.evaluate(([tag, PROPS]) => {
    const r = {}; let i = 0;
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('svg') && el.tagName !== 'svg') continue;
      const cs = getComputedStyle(el); i++; let pth = [], q = el; while (q && q !== document.body) { pth.unshift(q.id ? '#' + q.id : q.tagName + ':' + [...q.parentNode.children].indexOf(q)); if (q.id) break; q = q.parentNode; } const key = `${tag}:${pth.join('>')}.${String(el.className.baseVal ?? el.className).slice(0, 50)}`;
      r[key] = PROPS.map(p => cs.getPropertyValue(p)).join('|');
      for (const pseudo of ['::before', '::after']) { const ps = getComputedStyle(el, pseudo); if (ps.content && ps.content !== 'none' && ps.content !== 'normal') r[key + pseudo] = PROPS.map(p => ps.getPropertyValue(p)).join('|'); }
    }
    return r;
  }, [tag, PROPS]));
  const click = sel => page.evaluate(s => document.querySelector(s)?.click(), sel);
  await grab('closed');
  await click('#btnToggleMenu'); await page.waitForTimeout(800);
  for (const tab of await page.$$eval('.inspector-tab-btn', bs => bs.map(b => b.dataset.tab))) {
    await click(`.inspector-tab-btn[data-tab="${tab}"]`); await page.waitForTimeout(600); await grab('tab-' + tab);
  }
  await click('#btnOpenSettings'); await page.waitForTimeout(600); await grab('settings');
  await page.close();
  return out;
}
(async () => {
  await new Promise(r => srv.listen(PORT, r)); await new Promise(r => dsrv.listen(DEVPORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const d = await dump(browser, false, true), a = await dump(browser, false);
  const cmp = (x, y, name) => {
  let diffs = 0; const byProp = {}; let shown = 0;
  let missing = 0;
  for (const k of Object.keys(x)) {
    if (!(k in y)) { missing++; continue; }
    if (x[k] !== y[k]) { diffs++; const av = x[k].split('|'), bv = y[k].split('|'); av.forEach((v, i) => { if (v !== bv[i]) { byProp[PROPS[i]] = (byProp[PROPS[i]] || 0) + 1; if (shown++ < 25) console.log('  ', k, PROPS[i], 'dev:', v, name + ':', bv[i]); } }); }
  }
  console.log(`DEV vs ${name}: ${Object.keys(x).length} element states compared, ${diffs} differ, ${missing} not matched`, JSON.stringify(byProp));
  };
  cmp(d, a, 'built');
  await browser.close(); srv.close(); dsrv.close();
})();
