// Standalone render of reference paintings (no game): node render.js <outdir> <configs.json>
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = '/home/user/kelo-bot-1', FX = '/tmp/fx';
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const configs = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const page0 = `<!doctype html><html><body><script>
const state = {}; function pick(a){return a[Math.floor(Math.random()*a.length)];}
${fs.readFileSync(ROOT + '/js/agent.js', 'utf8').match(/function makeRng[\s\S]*?\n    }\n/)[0]}
</script><script src="/js/paintrender.js"></script><script src="/js/refpaint.js"></script></body></html>`;
const srvx = 0; const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(page0); }
  const p = u.startsWith('/fx/') ? path.join(FX, u.slice(4)) : path.join(ROOT, u);
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'application/javascript' : p.endsWith('.png') ? 'image/png' : 'image/jpeg' }); res.end(d); });
}).listen(+process.env.RPORT || 8931, async () => {
  const b = await chromium.launch();
  const pg = await b.newPage();
  pg.on('pageerror', e => console.log('ERR', e.message));
  await pg.goto('http://localhost:' + (+process.env.RPORT || 8931) + '/');
  for (const c of configs) {
    const t0 = Date.now();
    const r = await pg.evaluate(async c => {
      const load = async f => { const img = new Image(); img.src = '/fx/' + f; await img.decode(); return refpToCanvas(img); };
      const imgs = await Promise.all(c.refs.map(load));
      const spec = { medium: c.medium, q: c.q, seed: c.seed || c.name, subject: 'reference', time: 'day', season: 'Summer', weather: 'clear', refImages: imgs, refHow: c.how || null };
      const under = refpSceneFromReference(spec).ref.toDataURL('image/jpeg', 0.85);
      const out = await renderPaintingInMedium(spec);
      return { under, out: out.toDataURL('image/jpeg', 0.9), thumbs: imgs.map(refpThumb) };
    }, c);
    const w = (n, d) => fs.writeFileSync(path.join(OUT, n), Buffer.from(d.split(',')[1], 'base64'));
    w(c.name + '-under.jpg', r.under); w(c.name + '.jpg', r.out); r.thumbs.forEach((t, i) => w(`${c.name}-ref${i}.jpg`, t));
    console.log(c.name, Date.now() - t0, 'ms');
  }
  await b.close(); srv.close();
});
