// Usage: KELO_ROOT=/home/user/kelo-bot-1 node itemsheet.js names.json outdir [tag]
//    or: BACKUP=kelo1-brain-YYYY-MM-DD.json node itemsheet.js - outdir mysave
//        (a brain backup from the game's Memory panel: loads that save read-only in a throwaway
//         browser profile and renders everything in his Storehouse, toys, belongings and mailbox)
// Renders every item name at the Storehouse shelf view and close-up, writes JPEG contact sheets
// (name, real size in metres, model route under each) and items.json with the measurements.
const { chromium } = require('playwright');
const path = require('path'), http = require('http'), fs = require('fs');
const V = '/home/user/qa/qa/vendor';
const ROOT = process.env.KELO_ROOT || '/home/user/kelo-bot-1';
const PORT = +process.env.PORT || 8911;
const [namesFile, outDir, tag = 'sheet'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.hdr': 'application/octet-stream' };
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
  let names = namesFile === '-' ? [] : JSON.parse(fs.readFileSync(namesFile, 'utf8')).map(n => typeof n === 'string' ? n : n.name);
  const backup = process.env.BACKUP ? JSON.parse(fs.readFileSync(process.env.BACKUP, 'utf8')) : null;
  if (backup && (backup.format !== 'kelo1-brain' || typeof backup.data !== 'object')) throw new Error('Not a Kelo-1 brain backup');
  if (process.env.ONLY) names = names.filter(n => new RegExp(process.env.ONLY, 'i').test(n));
  const server = await startServer();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.includes('three.min.js')) return route.fulfill({ path: path.join(V, 'three.min.js'), contentType: 'application/javascript' });
    if (u.includes('OrbitControls.js')) return route.fulfill({ path: path.join(V, 'OrbitControls.js'), contentType: 'application/javascript' });
    if (u.includes('cdn.tailwindcss.com')) return route.fulfill({ path: path.join(V, 'tailwind.js'), contentType: 'application/javascript' });
    if (u.includes('phosphor-icons')) return route.fulfill({ body: '', contentType: 'application/javascript' });
    if (u.startsWith(`http://localhost:${PORT}`)) return route.continue();
    if (u.includes('GLTFLoader') && fs.existsSync(path.join(V, 'GLTFLoader.js'))) return route.fulfill({ path: path.join(V, 'GLTFLoader.js'), contentType: 'application/javascript' });
    return route.fulfill({ status: 404, body: '' });
  });
  if (backup) await page.addInitScript(data => { try { if (!sessionStorage.getItem('loaded')) { Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v)); sessionStorage.setItem('loaded', '1'); } } catch (e) {} }, backup.data);
  await page.goto(`http://localhost:${PORT}/index.html`, { timeout: 420000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => { state.isCollectingMail = true; state.isPracticing = true; state.isBusy = true; });
  if (backup) {
    names = await page.evaluate(() => [...new Set([...storedItems().map(i => i.name), ...state.mailbox.filter(m => m.kind === 'gift').map(m => m.name)])]);
    console.log('items in this save:', names.length);
  }
  const results = [];
  const PER = 48;
  for (let s = 0; s * PER < names.length; s++) {
    const batch = names.slice(s * PER, (s + 1) * PER);
    const out = await page.evaluate(async (batch) => {
      const W = 180, H = 150, COLS = 8, TH = H * 2 + 40;
      const R = renderer, S = ITEM_LIFE_SCALE;
      const keepVp = new THREE.Vector4(); R.getViewport(keepVp);
      const sheet = document.createElement('canvas');
      sheet.width = W * COLS; sheet.height = TH * Math.ceil(batch.length / COLS);
      const ctx = sheet.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, sheet.width, sheet.height);
      const mkScene = () => {
        const sc = new THREE.Scene();
        sc.environment = scene.environment || null;
        sc.background = new THREE.Color(0xcfc8bd);
        const hemi = new THREE.HemisphereLight(0xffffff, 0x8a7a66, 2.2);
        const dir = new THREE.DirectionalLight(0xfff4e6, 3.2); dir.position.set(1.5, 3, 2.5);
        sc.add(hemi, dir);
        return sc;
      };
      // The shelf slot (world units): plank 1.09 wide, 0.8 deep, the next shelf 0.88 up, a back wall
      const shelfMat = new THREE.MeshStandardMaterial({ color: 0xc8955a, roughness: 0.8 });
      const shelfBits = () => {
        const g = new THREE.Group();
        const plank = new THREE.Mesh(new THREE.BoxGeometry(1.09, 0.096, 0.8), shelfMat); plank.position.y = -0.048; g.add(plank);
        const up = plank.clone(); up.position.y = 0.88 - 0.048; g.add(up);
        const wall = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.2), new THREE.MeshStandardMaterial({ color: 0xa63d2a, roughness: 0.9 })); wall.position.set(0, 0.4, -0.42); g.add(wall);
        for (let i = 0; i <= 10; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.002, i % 5 ? 0.03 : 0.06), new THREE.MeshBasicMaterial({ color: 0x111111 })); t.position.set(-0.5 + i * 0.16, 0.001, 0.38); g.add(t); }
        return g;
      };
      const ground = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ color: 0xe7e2da, roughness: 1 }));
      ground.rotation.x = -Math.PI / 2;
      const shelfCam = new THREE.PerspectiveCamera(42, W / H, 0.01, 50);
      shelfCam.position.set(0, 0.5, 1.75); shelfCam.lookAt(0, 0.4, 0);
      const cam = new THREE.PerspectiveCamera(35, W / H, 0.005, 200);
      const snap = (sc, c, x, y) => {
        R.setScissorTest(true); R.setViewport(0, 0, W, H); R.setScissor(0, 0, W, H);
        R.render(sc, c);
        const cv = R.domElement, pr = R.getPixelRatio();
        ctx.drawImage(cv, 0, cv.height - H * pr, W * pr, H * pr, x, y, W, H);
        R.setScissorTest(false);
      };
      const routeOf = (lower) => {
        const list = splitItemList(lower);
        const one = (l) => {
          let r;
          const i = ITEM_MODEL_RULES.findIndex(([re]) => re.test(l));
          if (i >= 0) r = 'rule /' + ITEM_MODEL_RULES[i][0].source.slice(0, 38) + '/';
          else if (aiDesignedItemModel(l)) r = 'ai-design';
          else if (state.itemLookups && state.itemLookups[l] && state.itemLookups[l].like) r = 'lookup';
          else if (inferredItemModel(l)) r = 'INFERRED';
          else if (typeof formForText === 'function' && formForText(l)) r = 'FORM';
          else r = 'CATEGORY:' + (typeof categorizeItem === 'function' ? categorizeItem(l) : '?');
          const e = typeof realModelEntry === 'function' && realModelEntry(l);
          if (e) r = 'glb ' + e.file + ' | ' + r;
          return r;
        };
        return list ? 'LIST[' + list.map(one).join(' ; ') + ']' : one(lower);
      };
      const res = [];
      for (let i = 0; i < batch.length; i++) {
        const name = batch[i], lower = name.toLowerCase();
        const col = i % COLS, row = Math.floor(i / COLS), x0 = col * W, y0 = row * TH;
        const rec = { name, route: routeOf(lower) };
        try {
          (splitItemList(lower) || [lower]).forEach(p => { try { preloadRealModel(p); } catch (e) {} });
          let probe = buildItemModel3D(name, { label: false });
          const pend = typeof realModelsPending === 'function' && realModelsPending(probe);
          if (pend) { await Promise.race([pend, new Promise(r => setTimeout(r, 8000))]); }
          // Shelf view: exactly as shelfHolderFor places it
          const sc1 = mkScene(); sc1.add(shelfBits());
          const onShelf = fitOnShelf(buildItemModel3D(name, { label: false }));
          sc1.add(onShelf);
          onShelf.updateMatrixWorld(true);
          const b1 = new THREE.Box3(); onShelf.traverse(o => { if (o.isMesh && o.visible) b1.expandByObject(o); });
          rec.shelfScale = +onShelf.scale.x.toFixed(3);
          rec.shelfMinY = +b1.min.y.toFixed(3);
          snap(sc1, shelfCam, x0, y0);
          // Close-up at life size, uncapped
          const m = lifeSize(buildItemModel3D(name, { label: false }));
          const sc2 = mkScene();
          sc2.add(m); m.updateMatrixWorld(true);
          const b = new THREE.Box3(); let labels = 0, meshes = 0, canvasTex = 0;
          m.traverse(o => { if (!o.isMesh) return; meshes++; if (!o.visible) return; if (o.userData && o.userData.isLabel) labels++; const mt = Array.isArray(o.material) ? o.material[0] : o.material; if (mt && mt.map && mt.map.isCanvasTexture) canvasTex++; b.expandByObject(o); });
          const size = new THREE.Vector3(), c = new THREE.Vector3(); b.getSize(size); b.getCenter(c);
          rec.m = [size.x / S, size.y / S, size.z / S].map(v => +v.toFixed(3));
          rec.minY = +(b.min.y / S).toFixed(3);
          rec.meshes = meshes; rec.labels = labels; rec.canvasTex = canvasTex;
          rec.realSize = Boolean(m.userData.realSize);
          const rad = Math.max(size.length() / 2, 0.02);
          ground.scale.setScalar(rad * 2.2); ground.position.set(c.x, Math.min(0, b.min.y) - 0.001, c.z);
          sc2.add(ground);
          const dirv = new THREE.Vector3(0.9, 0.65, 1.5).normalize();
          cam.position.copy(c).addScaledVector(dirv, rad / Math.sin(THREE.MathUtils.degToRad(35 / 2)) * 1.05);
          cam.near = rad * 0.05; cam.far = rad * 20; cam.updateProjectionMatrix(); cam.lookAt(c);
          snap(sc2, cam, x0, y0 + H);
          sc2.remove(ground);
        } catch (e) { rec.error = String(e && e.message || e); ctx.fillStyle = '#fdd'; ctx.fillRect(x0, y0, W, H * 2); }
        ctx.fillStyle = '#000'; ctx.font = 'bold 11px sans-serif';
        const nm = name.length > 30 ? name.slice(0, 29) + '…' : name;
        ctx.fillText(nm, x0 + 3, y0 + H * 2 + 12);
        ctx.font = '10px sans-serif'; ctx.fillStyle = '#333';
        const dims = rec.m ? rec.m.map(v => v >= 1 ? v.toFixed(2) : Math.round(v * 100) + 'c').join('×') + 'm' : 'ERR';
        ctx.fillText(dims + (rec.minY && Math.abs(rec.minY) > 0.01 ? ' y' + rec.minY : ''), x0 + 3, y0 + H * 2 + 24);
        ctx.fillStyle = /INFERRED|FORM|CATEGORY/.test(rec.route) ? '#c00' : '#666';
        ctx.fillText(rec.route.slice(0, 34), x0 + 3, y0 + H * 2 + 36);
        ctx.strokeStyle = '#999'; ctx.strokeRect(x0 + 0.5, y0 + 0.5, W - 1, TH - 1);
        res.push(rec);
      }
      R.setViewport(keepVp);
      return { res, jpg: sheet.toDataURL('image/jpeg', 0.82) };
    }, batch);
    const file = path.join(outDir, `${tag}-${String(s + 1).padStart(2, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(out.jpg.split(',')[1], 'base64'));
    results.push(...out.res);
    console.log('sheet', file, batch.length);
  }
  fs.writeFileSync(path.join(outDir, `${tag}.json`), JSON.stringify(results, null, 1));
  console.log('page errors:', errors.length ? errors.slice(0, 5).join(' | ') : 'none');
  await browser.close(); server.close();
})();
