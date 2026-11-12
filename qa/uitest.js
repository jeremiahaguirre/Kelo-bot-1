// UI click-through: opens every menu tab and presses every visible control, on desktop and phone.
// Usage: KELO_ROOT=... PORT=8900 node uitest.js [desktop|phone|both]
// Reports page errors per click, controls that are off-screen, overlapping HUD buttons,
// dialogs that do not close on Escape, typing in inputs that moves the camera, and settings that do not persist.
const { chromium, devices } = require('playwright');
const path = require('path');
const http = require('http'), fs = require('fs');
const V = path.join(__dirname, 'vendor');
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const ROOT = process.env.KELO_ROOT || '/home/user/kelo-bot-1';
const PORT = +process.env.PORT || 8765;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
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
    srv.on('error', () => resolve(null));
    srv.listen(PORT, () => resolve(srv));
  });
}
// Never press controls that wipe his life, sell things or leave the page
const SKIP = /reset|delete|erase|wipe|forget|start over|new life|restore|import|export|download|throw|sell|remove|clear (all|his)|sign out|uninstall/i;

async function routes(page) {
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.includes('three.min.js')) return route.fulfill({ path: path.join(V, 'three.min.js'), contentType: 'application/javascript' });
    if (u.includes('OrbitControls.js')) return route.fulfill({ path: path.join(V, 'OrbitControls.js'), contentType: 'application/javascript' });
    if (u.includes('cdn.tailwindcss.com')) return route.fulfill({ path: path.join(V, 'tailwind.js'), contentType: 'application/javascript' });
    if (u.includes('phosphor-icons')) return route.fulfill({ body: '', contentType: 'application/javascript' });
    // AI and Wikipedia are "offline" (500 / network error) so their error paths run
    if (u.includes('generativelanguage') || u.includes('anthropic.com')) return route.fulfill({ status: 500, body: '{}' });
    if (u.includes('wikipedia.org') || u.includes('wikimedia.org')) return route.abort('internetdisconnected');
    if (u.startsWith(`http://localhost:${PORT}`)) return route.continue();
    return route.fulfill({ status: 404, body: '' });
  });
}

async function run(browser, kind) {
  const opts = kind === 'phone' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 800 } };
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  let where = 'load';
  page.on('pageerror', e => errors.push(`[${where}] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text())) console.log(`console.error [${where}]:`, m.text().slice(0, 200)); });
  page.on('dialog', d => d.dismiss().catch(() => {}));
  page.on('popup', p => p.close().catch(() => {}));
  await routes(page);
  await page.goto(`http://localhost:${PORT}/index.html`, { timeout: 420000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => { state.isCollectingMail = true; });
  const problems = [];
  const note = s => { problems.push(s); console.log('PROBLEM:', s); };
  const shot = async name => { try { await page.screenshot({ path: path.join(OUT, `ui-${kind}-${name}.png`), timeout: 300000 }); } catch (e) {} };

  // 1. HUD layout: visible buttons on screen and not on top of each other
  const layout = await page.evaluate(() => {
    const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05 && !el.closest('.hidden'); };
    const btns = [...document.querySelectorAll('button, [role=button], a[href]')].filter(el => !el.closest('#sideMenu') && !el.closest('.ui-dialog') && vis(el));
    const out = { offscreen: [], overlaps: [] };
    const name = el => el.id || el.getAttribute('aria-label') || el.textContent.trim().slice(0, 24) || el.className.toString().slice(0, 30);
    const rs = btns.map(el => [el, el.getBoundingClientRect()]);
    for (const [el, r] of rs) if (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1) out.offscreen.push(name(el));
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const [a, ra] = rs[i], [b, rb] = rs[j];
      if (a.contains(b) || b.contains(a)) continue;
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (w > 4 && h > 4) out.overlaps.push(`${name(a)} x ${name(b)}`);
    }
    out.count = btns.length;
    out.hscroll = document.documentElement.scrollWidth > innerWidth + 1;
    return out;
  });
  console.log(`HUD buttons visible: ${layout.count}`);
  layout.offscreen.forEach(n => note(`HUD control off-screen: ${n}`));
  layout.overlaps.forEach(n => note(`HUD controls overlap: ${n}`));
  if (layout.hscroll) note('page scrolls horizontally');
  await shot('hud');

  // 2. Menu: every tab, every visible control inside it
  const tabs = await page.evaluate(() => [...document.querySelectorAll('[data-tab]')].map(b => b.dataset.tab));
  console.log('tabs:', tabs.join(' '));
  let clicks = 0;
  const openTab = async t => page.evaluate(t => {
    if (!document.body.classList.contains('menu-open')) document.getElementById('btnToggleMenu').click();
    document.querySelector(`[data-tab="${t}"]`).click();
  }, t);
  const closeDialogs = () => page.evaluate(() => {
    if (typeof closeViewer === 'function' && typeof viewerState !== 'undefined' && viewerState) closeViewer();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    const open = [...document.querySelectorAll('.ui-dialog, [role=dialog]')].filter(d => !d.classList.contains('hidden') && d.offsetParent !== null && !d.closest('#sideMenu'));
    return open.map(d => d.id || d.className.toString().slice(0, 40));
  });
  for (const t of tabs) {
    where = `tab ${t}`;
    await openTab(t);
    await page.waitForTimeout(500);
    await shot(`tab-${t}`);
    const panelOk = await page.evaluate(t => { const p = document.getElementById(`tab-${t}`); return p && !p.classList.contains('hidden') && p.getBoundingClientRect().height > 10; }, t);
    if (!panelOk) note(`tab ${t}: panel not shown after clicking its tab`);
    const seen = new Set();
    for (let pass = 0; pass < 60; pass++) {
      const next = await page.evaluate(([t, seen, skip]) => {
        const panel = document.getElementById(`tab-${t}`);
        if (!panel) return null;
        const re = new RegExp(skip, 'i');
        const els = [...panel.querySelectorAll('button, [role=button], input[type=checkbox], input[type=radio], select, summary, a[href]')];
        for (let i = 0; i < els.length; i++) {
          const el = els[i];
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2 || el.disabled || el.closest('.hidden')) continue;
          const label = (el.id || el.getAttribute('aria-label') || el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40) || el.tagName) + (el.id ? '' : `#${i}`);
          if (seen.includes(label)) continue;
          if (re.test(el.textContent + ' ' + (el.getAttribute('aria-label') || '') + ' ' + el.id)) { seen.push(label); continue; }
          el.scrollIntoView({ block: 'center' });
          if (el.tagName === 'SELECT') { const o = el.options[Math.min(1, el.options.length - 1)]; if (o) { el.value = o.value; el.dispatchEvent(new Event('change', { bubbles: true })); } }
          else if (el.tagName === 'A') { el.addEventListener('click', e => e.preventDefault(), { once: true }); el.click(); }
          else el.click();
          return label;
        }
        return null;
      }, [t, [...seen], SKIP.source]);
      if (!next) break;
      seen.add(next); clicks++;
      where = `tab ${t} > ${next}`;
      await page.waitForTimeout(350);
      const left = await closeDialogs();
      if (left.length) { await page.waitForTimeout(300); const still = await closeDialogs(); if (still.length) note(`${where}: dialog stays open after Escape: ${still.join(', ')}`); }
      // The click may have closed the menu or switched tab; go back
      const back = await page.evaluate(t => document.body.classList.contains('menu-open') && !document.getElementById(`tab-${t}`).classList.contains('hidden'), t);
      if (!back) await openTab(t);
    }
    console.log(`tab ${t}: pressed ${seen.size} controls`);
  }
  where = 'menu close';
  await page.evaluate(() => document.getElementById('btnCloseMenu').click());
  await page.waitForTimeout(300);
  if (await page.evaluate(() => document.body.classList.contains('menu-open'))) note('menu does not close with its close button');

  // 3. HUD buttons outside the menu
  const hudIds = await page.evaluate(skip => {
    const re = new RegExp(skip, 'i');
    return [...document.querySelectorAll('button[id]')].filter(b => !b.closest('#sideMenu') && !b.closest('.ui-dialog') && !re.test(b.id + b.textContent)).map(b => b.id);
  }, SKIP.source);
  for (const id of hudIds) {
    where = `hud ${id}`;
    const pressed = await page.evaluate(id => { const b = document.getElementById(id); const r = b.getBoundingClientRect(); if (r.width < 2 || b.closest('.hidden')) return false; b.click(); return true; }, id);
    if (!pressed) continue;
    clicks++;
    await page.waitForTimeout(400);
    const left = await closeDialogs();
    if (left.length) { await page.waitForTimeout(300); const still = await closeDialogs(); if (still.length) note(`${where}: dialog stays open after Escape: ${still.join(', ')}`); }
    await page.evaluate(() => { if (document.body.classList.contains('menu-open')) document.getElementById('btnCloseMenu').click(); });
  }
  console.log(`HUD buttons pressed: ${hudIds.length}`);

  // 4. Settings dialog: open, close by button, by Escape, by backdrop
  where = 'settings';
  const sOpen = async () => { await page.evaluate(() => document.getElementById('btnOpenSettings').click()); await page.waitForTimeout(300); return page.evaluate(() => !document.getElementById('aiConfigModal').classList.contains('hidden')); };
  if (!(await sOpen())) note('settings: does not open from the gear');
  await shot('settings');
  await page.evaluate(() => document.getElementById('btnCloseAIConfigModal').click());
  if (await page.evaluate(() => !document.getElementById('aiConfigModal').classList.contains('hidden'))) note('settings: close button leaves it open');
  await sOpen(); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  if (await page.evaluate(() => !document.getElementById('aiConfigModal').classList.contains('hidden'))) note('settings: Escape leaves it open');
  await sOpen(); await page.evaluate(() => document.getElementById('aiConfigModal').dispatchEvent(new MouseEvent('click', { bubbles: true }))); await page.waitForTimeout(200);
  if (await page.evaluate(() => !document.getElementById('aiConfigModal').classList.contains('hidden'))) note('settings: backdrop click leaves it open');

  // Toggles in settings persist across a reload
  await sOpen();
  const before = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('#aiConfigModal input[type=checkbox], #aiConfigModal select').forEach(el => {
      if (!el.id || el.closest('.hidden')) return;
      if (el.type === 'checkbox') { el.click(); out[el.id] = el.checked; }
      else { const o = [...el.options].find(o => o.value !== el.value); if (o) { el.value = o.value; el.dispatchEvent(new Event('change', { bubbles: true })); out[el.id] = el.value; } }
    });
    return out;
  });
  await page.evaluate(() => document.getElementById('btnSaveAIConfig')?.click());
  await page.waitForTimeout(600);
  console.log('settings changed:', JSON.stringify(before));
  await page.evaluate(() => { if (typeof saveState === 'function') saveState(); });
  await page.waitForTimeout(300);
  where = 'reload';
  await page.reload({ timeout: 420000 });
  await page.waitForTimeout(4000);
  const after = await page.evaluate(ids => { const o = {}; for (const id of ids) { const el = document.getElementById(id); o[id] = el ? (el.type === 'checkbox' ? el.checked : el.value) : null; } return o; }, Object.keys(before));
  for (const k of Object.keys(before)) if (before[k] !== after[k]) note(`setting ${k} did not persist across reload (${before[k]} -> ${after[k]})`);

  // 5. Typing in the chat box must not move the camera or trigger shortcuts
  where = 'typing';
  const typed = await page.evaluate(() => {
    const inp = [...document.querySelectorAll('input[type=text], textarea')].find(el => el.offsetParent !== null);
    return inp ? (inp.id || inp.name || 'input') : null;
  });
  if (!typed) {
    await page.evaluate(() => { document.getElementById('btnToggleMenu').click(); document.querySelector('[data-tab="talk"]').click(); });
    await page.waitForTimeout(400);
  }
  const typeRes = await page.evaluate(async () => {
    const inp = [...document.querySelectorAll('input[type=text], textarea, input:not([type])')].find(el => el.offsetParent !== null);
    if (!inp) return 'no input';
    inp.focus();
    const cam0 = camera.position.clone(), mode0 = state.cameraMode;
    for (const k of ['KeyW', 'KeyA', 'KeyK', 'KeyV', 'ArrowUp']) inp.dispatchEvent(new KeyboardEvent('keydown', { code: k, key: k.replace('Key', '').toLowerCase(), bubbles: true }));
    await new Promise(r => setTimeout(r, 600));
    for (const k of ['KeyW', 'KeyA', 'ArrowUp']) inp.dispatchEvent(new KeyboardEvent('keyup', { code: k, key: k.replace('Key', '').toLowerCase(), bubbles: true }));
    return { input: inp.id, moved: camera.position.distanceTo(cam0) > 0.01, modeChanged: state.cameraMode !== mode0 };
  });
  console.log('typing check:', JSON.stringify(typeRes));
  if (typeRes.moved || typeRes.modeChanged) note(`typing in ${typeRes.input} moves the camera or changes mode`);

  await page.waitForTimeout(500);
  console.log(`${kind}: ${clicks} controls pressed, ${problems.length} problems`);
  console.log('page errors:', errors.length ? errors : 'none');
  await ctx.close();
  return { problems, errors };
}

(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const which = process.argv[2] || 'both';
  let bad = 0;
  for (const kind of which === 'both' ? ['desktop', 'phone'] : [which]) {
    console.log(`=== ${kind} ===`);
    const r = await run(browser, kind);
    bad += r.errors.length;
  }
  await browser.close();
  if (server) server.close();
  process.exit(bad ? 1 : 0);
})();
