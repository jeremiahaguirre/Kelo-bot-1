// Design pass checks: screenshots of every piece of UI and a WCAG contrast report over day/night/snow scenes.
// Usage: KELO_ROOT=... PORT=8900 VW=1280 VH=800 TAG=before node design.js shots|contrast
//   shots:    HUD in Follow/Explore/Eyes; with MENU=1 also every menu tab, settings, a toast, loading/empty states
//   contrast: every visible text element and icon against its real background (the 3D world under glass panels)
const { chromium } = require('playwright');
const path = require('path'), http = require('http'), fs = require('fs');
const V = path.join(__dirname, 'vendor'), P = path.join(V, 'pkgs');
const ROOT = process.env.KELO_ROOT || '/home/user/kelo-bot-1';
const PORT = +process.env.PORT || 8900;
const VW = +process.env.VW || 1280, VH = +process.env.VH || 800;
const TAG = process.env.TAG || 'before';
const OUT = path.join(__dirname, 'shots', 'design', TAG);
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };

// Local Google Fonts and Phosphor icons, so the shots look like the real site
function fontsCss() {
  let css = '';
  for (const [pkg, fam] of [['fontsource-inter-5.3.0', 'inter'], ['fontsource-newsreader-5.3.0', 'newsreader'], ['fontsource-jetbrains-mono-5.3.0', 'jetbrains-mono']]) {
    const dir = path.join(P, pkg, 'package');
    for (const f of ['400.css', '500.css', '600.css', '700.css', '800.css', '400-italic.css']) {
      const p = path.join(dir, f);
      if (fs.existsSync(p)) css += fs.readFileSync(p, 'utf8').replace(/\.\/files\//g, `https://fonts.gstatic.com/kelo/${pkg}/`);
    }
  }
  return css;
}

function startServer() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(p, (err, data) => {
        if (err) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    srv.listen(PORT, () => resolve(srv));
  });
}

(async () => {
  const server = await startServer().catch(() => null);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const touch = VW < 1024;
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: process.argv[2] === 'contrast' ? 1 : 2, isMobile: touch, hasTouch: touch });
  // Shots use the Fast graphics level (software GL renders a 2x page very slowly); the UI is what is checked
  if (process.env.FAST !== '0') await page.addInitScript(() => { try { localStorage.setItem('kelo-graphics', 'fast'); } catch (e) {} });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const FONTS = fontsCss();
  const TWCSS = fs.readFileSync(process.env.TWCSS || path.join(V, 'tw3', TAG + '.css'), 'utf8');
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.includes('three.min.js')) return route.fulfill({ path: path.join(V, 'three.min.js'), contentType: 'application/javascript' });
    if (u.includes('OrbitControls.js')) return route.fulfill({ path: path.join(V, 'OrbitControls.js'), contentType: 'application/javascript' });
    // The site loads the Tailwind 3.4.17 play CDN; serve the same version compiled from this checkout (vendor/tw3/build.sh)
    if (u.includes('cdn.tailwindcss.com')) return route.fulfill({ body: `document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(TWCSS)}; document.head.appendChild(s); });`, contentType: 'application/javascript' });
    const ph = u.match(/@phosphor-icons\/web@2\.1\.1(\/src\/.*)?$/);
    if (ph) return route.fulfill({ path: path.join(P, 'phosphor-icons-web-2.1.1', 'package', ph[1] ? ph[1].slice(1) : 'src/index.js') });
    if (u.includes('fonts.googleapis.com')) return route.fulfill({ body: FONTS, contentType: 'text/css' });
    const gf = u.match(/fonts\.gstatic\.com\/kelo\/([^/]+)\/(.+)$/);
    if (gf) return route.fulfill({ path: path.join(P, gf[1], 'package', 'files', gf[2]), contentType: 'font/woff2' });
    if (u.includes('generativelanguage') || u.includes('anthropic.com')) return route.fulfill({ status: 500, body: '{}' });
    if (u.includes('wikipedia.org')) return route.fulfill({ body: '{"query":{"search":[]}}', contentType: 'application/json' });
    if (u.startsWith(`http://localhost:${PORT}`)) return route.continue();
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`http://localhost:${PORT}/index.html`, { timeout: 420000 });
  await page.waitForTimeout(5000);
  await page.evaluate(() => { state.isCollectingMail = true; });
  const size = `${VW}x${VH}`;
  const shot = async name => { try { await page.screenshot({ path: path.join(OUT, `${size}-${name}.png`), timeout: 300000 }); console.log('shot', name); } catch (e) { console.log('shot FAILED', name, e.message); } };
  const click = s => page.evaluate(s => { const el = document.querySelector(s); if (el) el.click(); return !!el; }, s);
  const wait = ms => page.waitForTimeout(ms);
  const setHour = h => page.evaluate(h => { const c = ensureCalendar(); c.startHour += h - worldNow().hour; applyTimeOfDay && applyTimeOfDay(); }, h);
  const mode = process.argv[2] || 'shots';

  if (mode === 'shots') {
    await setHour(12);
    await click('[data-explore-mode="follow"]'); await wait(2500); await shot('hud-follow');
    await click('[data-explore-mode="explore"]'); await wait(2500); await shot('hud-explore');
    await click('#btnPlaces'); await wait(600); await shot('hud-places'); await click('#btnPlaces');
    await click('[data-explore-mode="eyes"]'); await wait(2500); await shot('hud-eyes');
    await click('[data-explore-mode="follow"]'); await wait(1500);
    if (process.env.MENU) {
      await page.evaluate(() => showToast('Saved to his diary'));
      await wait(500); await shot('toast');
      await click('#btnToggleMenu'); await wait(800);
      for (const t of ['talk', 'requests', 'diary', 'brain', 'github', 'world', 'map']) {
        await click(`[data-tab="${t}"]`); await wait(900); await shot(`tab-${t}`);
      }
      // Loading: Kelo-1 is thinking about a reply
      await click('[data-tab="talk"]');
      await page.evaluate(() => { talkBeginThinking('hello'); });
      await wait(900); await shot('loading-talk');
      await page.evaluate(() => { talkEndThinking(); });
      // Empty: a diary search with no hits
      await click('[data-tab="diary"]'); await wait(400);
      await page.evaluate(() => { const i = document.querySelector('#tab-diary input[type="search"], #tab-diary input'); if (i) { i.value = 'zzqqxx'; i.dispatchEvent(new Event('input', { bubbles: true })); } });
      await wait(1200); await shot('empty-diary-search');
      await click('#btnCloseMenu'); await wait(500);
      await click('#btnOpenSettings'); await wait(800); await shot('dialog-settings');
    }
  }

  if (mode === 'contrast') {
    const scenes = [
      ['day', async () => { await setHour(12); }],
      ['night', async () => { await setHour(23.5); }],
      ['snow', async () => { await setHour(13); await page.evaluate(() => { window.__realNow = window.__realNow || worldNow; window.worldNow = () => ({ ...window.__realNow(), season: 'Winter' }); applySeasonLook('Winter'); }); }],
    ];
    const views = [
      ['follow', async () => { await click('[data-explore-mode="follow"]'); }],
      ['explore+places', async () => { await click('[data-explore-mode="explore"]'); await click('#btnPlaces'); }],
      ['eyes', async () => { await click('#btnPlaces'); await click('[data-explore-mode="eyes"]'); }],
      ['menu-talk', async () => { await click('[data-explore-mode="follow"]'); await click('#btnToggleMenu'); await click('[data-tab="talk"]'); }],
      ['menu-requests', async () => { await click('[data-tab="requests"]'); }],
      ['menu-diary', async () => { await click('[data-tab="diary"]'); }],
      ['menu-brain', async () => { await click('[data-tab="brain"]'); }],
      ['menu-world', async () => { await click('[data-tab="world"]'); }],
      ['settings', async () => { await click('#btnCloseMenu'); await wait(400); await click('#btnOpenSettings'); }],
    ];
    const report = { size, scenes: {} };
    for (const [sceneName, setup] of scenes) {
      await setup(); await wait(2500);
      const rows = [];
      for (const [viewName, go] of views) {
        await go(); await wait(1200);
        // The world alone (every overlay hidden), to read what is really behind the glass panels
        await page.evaluate(() => { for (const el of document.body.children) if (el.id !== 'dioramaViewport') { el.dataset.cvis = el.style.visibility; el.style.visibility = 'hidden'; } for (const el of document.querySelectorAll('#dioramaViewport > :not(canvas)')) { el.dataset.cvis = el.style.visibility; el.style.visibility = 'hidden'; } });
        const bg = (await page.screenshot({ timeout: 300000 })).toString('base64');
        await page.evaluate(() => { for (const el of document.querySelectorAll('[data-cvis]')) { el.style.visibility = el.dataset.cvis; delete el.dataset.cvis; } });
        await wait(150);
        const checkFn = async b64 => {
          const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
          const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
          const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
          const px = cx.getImageData(0, 0, cv.width, cv.height).data;
          const sx = cv.width / innerWidth;
          const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
          const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
          const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
          const over = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
          // The world pixels under a box: the lightest and darkest tenth (worst cases for light and dark text)
          const world = r => {
            const ls = [];
            const x0 = Math.max(0, Math.floor(r.left * sx)), x1 = Math.min(cv.width - 1, Math.ceil(r.right * sx));
            const y0 = Math.max(0, Math.floor(r.top * sx)), y1 = Math.min(cv.height - 1, Math.ceil(r.bottom * sx));
            const step = Math.max(1, Math.floor(Math.max(x1 - x0, y1 - y0) / 24));
            for (let y = y0; y <= y1; y += step) for (let x = x0; x <= x1; x += step) { const i = (y * cv.width + x) * 4; ls.push([px[i], px[i + 1], px[i + 2], 1]); }
            ls.sort((a, b) => lum(a) - lum(b));
            return ls.length ? [ls[Math.floor(ls.length * 0.9)] || ls[ls.length - 1], ls[Math.floor(ls.length * 0.1)]] : [[0, 0, 0, 1], [0, 0, 0, 1]];
          };
          const visible = el => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return false; let n = el; while (n && n.nodeType === 1) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; n = n.parentElement; } const c = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2))); return c && (c === el || el.contains(c) || c.contains(el)); };
          const out = [];
          const els = [...document.querySelectorAll('body *')].filter(el => {
            if (/^(SCRIPT|STYLE|CANVAS|svg|path|BR|OPTION)$/.test(el.tagName)) return false;
            const icon = el.tagName === 'I' && /\bph[-\w]*\b/.test(el.className);
            return icon || [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) || (el.tagName === 'INPUT' && el.placeholder && !el.value);
          });
          for (const el of els) {
            if (!visible(el)) continue;
            const cs = getComputedStyle(el);
            let fg = parse(el.tagName === 'INPUT' ? getComputedStyle(el, '::placeholder').color : cs.color); if (!fg) continue;
            // Background stack from the element down to the first opaque layer (or the world)
            const stack = []; let n = el, alphaMul = 1, opaque = false, grad = false;
            while (n && n.nodeType === 1) {
              const s = getComputedStyle(n); alphaMul *= +s.opacity;
              if (s.backgroundImage && s.backgroundImage.includes('gradient')) {
                // A gradient: take its lightest stop as the layer (the worst case for dark text is checked too)
                const stops = (s.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean);
                if (stops.length) { grad = true; const st = stops.sort((a, b) => lum(a) - lum(b)); const g = fg && lum(fg) < 0.2 ? st[0] : st[st.length - 1]; stack.push(g); if (g[3] >= 0.999) { opaque = true; break; } }
              }
              const c = parse(s.backgroundColor);
              if (c && c[3] > 0) { stack.push(c); if (c[3] >= 0.999) { opaque = true; break; } }
              n = n.parentElement;
            }
            const r = el.getBoundingClientRect();
            const [hi, lo] = opaque ? [[0, 0, 0, 1], [0, 0, 0, 1]] : world(r);
            const comp = base => { let b = base; for (let i = stack.length - 1; i >= 0; i--) b = over(stack[i], b); return b; };
            const fgA = [fg[0], fg[1], fg[2], fg[3] * alphaMul];
            const worst = Math.min(...[hi, lo].map(w => { const b = comp(w); return ratio(over(fgA, b), b); }));
            const size = parseFloat(cs.fontSize), weight = +cs.fontWeight || 400;
            const icon = el.tagName === 'I';
            const large = size >= 24 || (size >= 18.66 && weight >= 700);
            const need = icon || large ? 3 : 4.5;
            if (worst < need) {
              const id = el.id ? '#' + el.id : '';
              const cls = typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
              out.push({ el: (el.tagName.toLowerCase() + id + cls).slice(0, 90), text: (el.textContent || el.placeholder || '').trim().slice(0, 40), ratio: +worst.toFixed(2), need, grad, overWorld: !opaque });
            }
          }
          return out;
        };
        const fails = [];
        const seen = new Set();
        const steps = viewName.startsWith('menu') ? 10 : 1;
        for (let k = 0; k < steps; k++) {
          if (steps > 1) {
            const more = await page.evaluate(k => { const m = document.getElementById('menuScroll'); if (!m) return false; if (k && m.scrollTop + m.clientHeight >= m.scrollHeight - 2) return false; m.scrollTop = k * m.clientHeight * 0.8; return true; }, k);
            if (!more) break;
            await wait(250);
          }
          for (const f of await page.evaluate(checkFn, bg)) { const key = f.el + '|' + f.text; if (!seen.has(key)) { seen.add(key); fails.push(f); } }
        }
        if (steps > 1) await page.evaluate(() => { const m = document.getElementById('menuScroll'); if (m) m.scrollTop = 0; });
        for (const f of fails) rows.push({ view: viewName, ...f });
        console.log(sceneName, viewName, 'fails:', fails.length);
      }
      await click('#btnCloseAIConfigModal'); await wait(300);
      report.scenes[sceneName] = rows;
    }
    const file = path.join(__dirname, 'shots', 'design', `contrast-${TAG}-${size}.json`);
    fs.writeFileSync(file, JSON.stringify(report, null, 1));
    const total = Object.values(report.scenes).reduce((n, r) => n + r.length, 0);
    console.log('contrast failures total:', total, '->', file);
  }

  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
  if (server) server.close();
})();
