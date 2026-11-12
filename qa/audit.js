// Regression checks for the bugs fixed on agent/audit-places (save/load, mail, keys, Escape, reloads).
// Usage: KELO_ROOT=... PORT=8900 node audit.js [maker,mail,keys,escape,museum,name,roof,hidden | all]
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


(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text())) console.log('console.error:', m.text().slice(0, 200)); });
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await routes(page);
  const load = async () => { await page.waitForFunction(() => typeof state !== 'undefined' && typeof keloGroup !== 'undefined' && keloGroup, null, { timeout: 900000 }); await page.waitForTimeout(3500); await page.evaluate(() => { state.isCollectingMail = true; }); };
  await page.goto(`http://localhost:${PORT}/index.html`, { timeout: 420000 });
  await load();
  const W = (fn, a) => page.evaluate(fn, a);
  const reload = async () => { await page.reload({ timeout: 420000 }); await load(); };
  const want = new Set((process.argv[2] || 'all').split(','));
  const on = k => want.has('all') || want.has(k);
  let fails = 0;
  const check = (name, ok, info) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info !== undefined ? ' ' + JSON.stringify(info) : ''}`); };

  if (on('maker')) {
    await W(() => { makerState(); state.makerOrders.push({ id: 'audit1', status: 'waiting', name: 'Audit stool', noun: 'stool', shop: 'woodshop', waitingFor: [] }); state.makerThings['audit stool'] = 'audit'; state.makerUses.audit = 1; savePersistentBrainStateNow(); });
    await reload();
    const r = await W(() => ({ order: (state.makerOrders || []).some(o => o.id === 'audit1'), thing: Boolean(state.makerThings && state.makerThings['audit stool']), use: state.makerUses && state.makerUses.audit }));
    check('shop-maker orders survive a reload', r.order && r.thing && r.use === 1, r);
  }
  if (on('mail')) {
    await W(() => {
      state.mailbox.length = 0;
      ['A', 'B', 'C'].forEach(n => state.mailbox.push({ id: 'audit-' + n, name: 'Audit letter ' + n, kind: 'message', from: 'Audit', note: '' }));
      window.waitForArrival = async () => true;
      window.__opened = [];
      window.openParcel = p => { window.__opened.push(p.name); if (/ A$/.test(p.name)) throw new Error('audit: parcel A fails'); if (/ B$/.test(p.name)) return new Promise(() => {}); return Promise.resolve(); };
      state.isCollectingMail = false; state.isBusy = false; state.isPracticing = false; state.isBuilding = false;
      pickUpMail('Audit');
    });
    await page.waitForFunction(() => window.__opened.length >= 2, null, { timeout: 120000 });
    const mid = await W(() => state.mailbox.map(p => p.name));
    check('a failing parcel does not drop the rest; unopened ones stay in the mailbox', mid.length === 1 && /C$/.test(mid[0]), mid);
    await reload();
    const after = await W(() => state.mailbox.map(p => p.name));
    check('reload mid mail run keeps the unopened parcel', after.length === 1 && /C$/.test(after[0]), after);
    await W(() => { state.mailbox.length = 0; savePersistentBrainStateNow(); });
  }
  if (on('keys')) {
    await W(() => { document.body.focus(); const ev = (t, o) => document.body.dispatchEvent(new KeyboardEvent(t, { bubbles: true, ...o })); ev('keydown', { code: 'KeyS', key: 's', ctrlKey: true }); ev('keyup', { code: 'KeyS', key: 's' }); ev('keydown', { code: 'KeyD', key: 'd' }); ev('keyup', { code: 'KeyD', key: 'd' }); });
    const r = await W(() => ({ S: arrowKeyState.KeyS, D: arrowKeyState.KeyD }));
    check('Ctrl+S and a plain D keypress leave no pan key held', !r.S && !r.D, r);
    const r2 = await W(() => { const sel = document.getElementById('graphicsLevelSelect'); if (!sel) return 'no select'; sel.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', key: 'ArrowDown', bubbles: true })); sel.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowDown', key: 'ArrowDown', bubbles: true })); return arrowKeyState.ArrowDown; });
    check('arrow key in a list box does not hold a pan key', r2 === false, r2);
  }
  if (on('escape')) {
    await W(() => { if (!document.body.classList.contains('menu-open')) document.getElementById('btnToggleMenu').click(); document.getElementById('codeViewerModal').classList.remove('hidden'); });
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const r = await W(() => ({ modal: !document.getElementById('codeViewerModal').classList.contains('hidden'), menu: document.body.classList.contains('menu-open') }));
    check('Escape closes the code dialog but not the menu under it', !r.modal && r.menu, r);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    check('a second Escape closes the menu', !(await W(() => document.body.classList.contains('menu-open'))));
  }
  if (on('museum')) {
    await W(() => { const o = worldObstacles.find(b => b.building === 'museum' && b.hw !== undefined && b.hw > 2); state.botPos = { x: o.x, z: o.z }; state.targetPos = { ...state.botPos }; window.__mo = o; savePersistentBrainStateNow(); });
    await reload();
    const r = await W(() => { const o = worldObstacles.find(b => b.building === 'museum' && b.hw !== undefined && b.hw > 2); const p = state.botPos; return { p, door: o.door, inside: Math.abs(p.x - o.x) < o.hw && Math.abs(p.z - o.z) < o.hd }; });
    check('reload inside the Museum puts him at its door', !r.inside && Math.hypot(r.p.x - r.door.x, r.p.z - r.door.z) < 1.5, r);
  }
  if (on('name')) {
    await W(() => { talkSaveName('Ann'); savePersistentBrainStateNow(); talkSaveName(''); savePersistentBrainStateNow(); });
    await reload();
    const r = await W(() => ({ box: document.getElementById('visitorNameInput').value, saved: state.lastVisitorName }));
    check('a cleared visitor name stays cleared after reload', r.box === '' && r.saved === '', r);
  }
  if (on('roof')) {
    await W(() => { state.roofCutaway = false; savePersistentBrainStateNow(); });
    await reload();
    const r = await W(() => ({ cut: state.roofCutaway, label: document.querySelector('#btnToggleRoof span').textContent }));
    check('roof button label matches the saved roof style', r.cut === false && r.label === 'Roofs: Solid', r);
    await W(() => { document.getElementById('btnToggleRoof').click(); savePersistentBrainStateNow(); });
  }
  if (on('hidden')) {
    // App build order: Tailwind's CSS before style.css. Simulate by moving style.css's rules ahead of a .ui-btn.hidden element
    const r = await W(() => [...document.querySelectorAll('.hidden')].filter(el => !/\b(sm|md|lg|xl):/.test(el.className) && getComputedStyle(el).display !== 'none').map(el => el.id || el.className.slice(0, 40)));
    check('every .hidden element is display:none', r.length === 0, r);
    const r2 = await W(() => { const s = document.createElement('style'); s.textContent = '.hidden{display:none}'; document.head.prepend(s); const b = document.createElement('button'); b.className = 'ui-btn hidden'; document.body.appendChild(b); const d = getComputedStyle(b).display; b.remove(); s.remove(); return d; });
    check('.ui-btn.hidden hides even when Tailwind loads first (app build order)', r2 === 'none', r2);
  }
  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
  if (server) server.close();
  process.exit(fails || errors.length ? 1 : 0);
})();
