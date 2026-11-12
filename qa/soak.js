// Long soak test: Kelo-1 lives for simulated hours on a fake clock (Playwright page.clock).
// Rendering is stubbed so time runs fast. Logs stuck/idle/loop detections, errors and progress.
// Usage: KELO_ROOT=... PORT=8901 MODE=noai|ai HOURS=4 SEED=1 VISITOR=1 node soak.js
// MODE=ai mocks Gemini with a rotating set of decisions (some broken, some failing, some slow).
const { chromium } = require('playwright');
const path = require('path'), http = require('http'), fs = require('fs');
const V = path.join(__dirname, 'vendor');
const ROOT = process.env.KELO_ROOT || path.resolve(__dirname, '../../kelo-bot-1');
const PORT = +process.env.PORT || 8901;
const MODE = process.env.MODE || 'noai';
const HOURS = +process.env.HOURS || 2;
const SEED = +process.env.SEED || 1;
const VISITOR = process.env.VISITOR !== '0';
const STEP_MIN = +process.env.STEP || 1;
const SAVE = process.env.SAVE || ''; // a JSON file of localStorage to start from (old-save test)
const RELOAD_EVERY_H = +process.env.RELOAD || 0; // reload the page every N simulated hours
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

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

// Decisions the mocked AI hands back, in turn
const AI_DECISIONS = [
  { actionTitle: 'Walking to the meadow', emoji: '🌼', speech: 'Off to the meadow.', destination: { x: 12, z: 4, placeName: 'Meadow' }, diary: 'Walked.' },
  { actionTitle: 'Asking for a kite', emoji: '🪁', speech: 'A kite would be fun.', request: { item: 'A kite', category: 'toy', why: 'To fly in the wind.' } },
  { actionTitle: 'Digging a hole', emoji: '⛏️', speech: 'Time to dig.', dig: { x: 20, z: 6 } },
  { actionTitle: 'Going out on the lake', emoji: '🚣', destination: { x: 0, z: 30, placeName: 'Lake' } },
  { actionTitle: 'Walk into the hills', emoji: '⛰️', destination: { x: 9999, z: -9999, placeName: 'Far' } },
  { actionTitle: 'Welding a sculpture', emoji: '🔥', build: { title: 'Spiral', archetype: 'custom_weld', colorHex: '#ff8800' } },
  { actionTitle: 'Checking mail', emoji: '📬', checkMail: true },
  { actionTitle: 'Reading about kalimbas', emoji: '📖', webQuery: 'kalimba' },
  { actionTitle: 'Practising', emoji: '🎯', practise: 'juggling' },
  { actionTitle: 'Starting a hobby', emoji: '🎸', startHobby: { name: 'Whittling', why: 'Wood is nice.' } },
  { actionTitle: 'Building a shed', emoji: '🛖', buildAnything: { name: 'garden shed', why: 'Storage.' } },
  { actionTitle: 'Painting', emoji: '🎨', paint: { medium: 'watercolour', subject: 'the lake' } },
  { actionTitle: 'Using the shovel as a hat', emoji: '🎩', useItem: { item: 'A sturdy shovel', how: 'wear it as a hat' } },
  { actionTitle: 'Going on a trip', emoji: '🚚', takeTrip: { to: 'town', vehicle: 'truck' } },
  { actionTitle: 'Bad numbers', emoji: '❓', destination: { x: 'NaN', z: null }, vitalsDelta: { health: 'lots', fullness: 1e9 } },
];

(async () => {
  const server = await startServer().catch(() => null);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: { width: 900, height: 600 } });
  const page = await context.newPage();
  const errors = [], warns = {};
  page.on('pageerror', e => { errors.push(e.message); console.log('PAGEERROR', e.message.slice(0, 300)); });
  page.on('console', m => {
    if (m.type() === 'error' || m.type() === 'warning') {
      const k = m.text().slice(0, 140);
      warns[k] = (warns[k] || 0) + 1;
      if (warns[k] === 1) console.log(`console.${m.type()}:`, k);
    }
  });
  let aiCalls = 0;
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.includes('three.min.js')) return route.fulfill({ path: path.join(V, 'three.min.js'), contentType: 'application/javascript' });
    if (u.includes('OrbitControls.js')) return route.fulfill({ path: path.join(V, 'OrbitControls.js'), contentType: 'application/javascript' });
    if (u.includes('cdn.tailwindcss.com')) return route.fulfill({ path: path.join(V, 'tailwind.js'), contentType: 'application/javascript' });
    if (u.includes('phosphor-icons')) return route.fulfill({ body: '', contentType: 'application/javascript' });
    if (u.includes('generativelanguage')) {
      aiCalls++;
      const n = aiCalls;
      if (n % 11 === 0) return route.fulfill({ status: 503, body: '{}' });
      if (n % 13 === 0) return route.fulfill({ body: '{"candidates":[{"content":{"parts":[{"text":"not json at all"}]}}]}', contentType: 'application/json' });
      const d = AI_DECISIONS[n % AI_DECISIONS.length];
      return route.fulfill({ body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(d) }] } }] }), contentType: 'application/json' });
    }
    if (u.includes('anthropic.com')) return route.fulfill({ status: 500, body: '{}' });
    if (u.includes('wikipedia.org') && /summary\//i.test(u)) return route.fulfill({ body: JSON.stringify({ type: 'standard', title: 'Thing', extract: 'A thing is an object made of wood and steel used for holding and storing other things.' }), contentType: 'application/json' });
    if (u.includes('wikipedia.org')) return route.fulfill({ body: '{"query":{"search":[]}}', contentType: 'application/json' });
    if (u.startsWith(`http://localhost:${PORT}`)) return route.continue();
    return route.fulfill({ status: 404, body: '' });
  });
  // A fake clock: timers, Date, performance and animation frames all follow it
  await page.clock.install({ time: new Date(process.env.START || '2026-07-01T08:00:00') });
  await page.addInitScript(([seed, mode, save]) => {
    // Repeatable randomness
    let s = seed >>> 0;
    Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    // Animation frames every 50 ms of fake time (motion is frame-rate independent)
    window.requestAnimationFrame = cb => window.setTimeout(() => cb(performance.now()), 50);
    window.cancelAnimationFrame = id => window.clearTimeout(id);
    if (!sessionStorage.getItem('soakInit')) {
      sessionStorage.setItem('soakInit', '1');
      if (save) { localStorage.clear(); Object.entries(JSON.parse(save)).forEach(([k, v]) => localStorage.setItem(k, v)); }
      if (mode === 'ai') localStorage.setItem('kelo1_gemini_api_key', 'test-key');
    }
  }, [SEED, MODE, SAVE ? fs.readFileSync(SAVE, 'utf8') : '']);

  const stubRender = () => page.evaluate(() => {
    const noop = () => {};
    if (typeof renderer !== 'undefined' && renderer) renderer.render = noop;
    if (typeof postComposer !== 'undefined' && postComposer) postComposer.render = noop;
    if (THREE.EffectComposer) THREE.EffectComposer.prototype.render = noop;
    if (typeof thumbRenderer !== 'undefined' && thumbRenderer) thumbRenderer.render = noop;
    window.__soak = { lastPos: null, still: 0, flags: {}, titles: [], visits: 0 };
  });
  stubRender.again = () => page.evaluate(() => {
    const noop = () => {};
    if (typeof renderer !== 'undefined' && renderer && renderer.render !== noop && !renderer.__stub) { renderer.render = noop; renderer.__stub = 1; }
    if (typeof postComposer !== 'undefined' && postComposer && !postComposer.__stub) { postComposer.render = noop; postComposer.__stub = 1; }
  });
  const load = async () => {
    await page.goto(`http://localhost:${PORT}/index.html`, { timeout: 600000 });
    await page.clock.runFor(4000);
    await stubRender();
  };
  await load();

  const sample = () => page.evaluate(() => {
    const flags = ['isBusy', 'isBuilding', 'isPracticing', 'isCollectingMail', 'isSleeping'].filter(f => state[f]);
    const ag = (state.agenda && state.agenda.tasks) || [];
    return {
      x: +state.botPos.x.toFixed(2), z: +state.botPos.z.toFixed(2), tx: +(state.targetPos?.x ?? NaN).toFixed?.(2), tz: +(state.targetPos?.z ?? NaN).toFixed?.(2),
      flags, riding: state.riding || null, title: state.moodTitle, tag: state.autonomyTag, loc: state.currentLocKey,
      walking: typeof keloSim !== 'undefined' ? !!keloSim.walking : null,
      trip: typeof indoorTrip !== 'undefined' ? !!indoorTrip : null,
      agenda: ag.map(t => `${t.kind}:${t.status}:${t.step}/${(t.steps || []).length}${t.waitingFor ? ':' + (t.waitingFor.type || '') : ''}`),
      agendaDone: ag.filter(t => t.status === 'done').length,
      openReq: state.requestsToUser.filter(r => !r.fulfilled).length,
      mail: state.mailbox.length, health: state.health, full: state.fullness, hyd: state.hydration,
      decisions: state.lifeStats ? state.lifeStats.decisions : (state.life && state.life.stats ? state.life.stats.decisions : null),
      diary: state.diaryEntries.length, inv: state.toolInventory.length,
    };
  });
  // A visitor who answers his item requests now and then (through the Post Office, as the UI does)
  const visit = () => page.evaluate(() => {
    let n = 0;
    state.requestsToUser.filter(r => !r.fulfilled).slice(0, 4).forEach(req => {
      try {
        if (req.bomList || req.lines || req.listSub) {
          if (typeof sendBomList === 'function' && req.bomList !== undefined) { sendBomList(req.id, null, 'soakVisitor'); n++; return; }
          if (typeof sendRoadworkList === 'function' && req.lines) { sendRoadworkList(req.id, null, 'soakVisitor'); n++; return; }
        }
        if (req.isToolRequest && req.requestedGear) {
          req.fulfilled = true; req.userAnswer = req.requestedGear;
          postMail({ kind: 'request', from: 'soakVisitor', name: req.requestedGear, category: req.category, emoji: req.icon, note: '' });
          n++;
        }
      } catch (e) { console.error('soak visitor failed:', e.message); }
    });
    if (n) { savePersistentBrainState(); }
    return n;
  });

  const totalMin = HOURS * 60;
  const t0 = Date.now();
  const flagSince = {}; let stillMin = 0, lastPos = null, lastTitle = '', titleRuns = {}, nanSeen = false;
  const detections = [];
  const detect = (min, kind, msg) => { detections.push({ min, kind, msg }); console.log(`[${min}m] DETECT ${kind}: ${msg}`); };
  let prev = null;
  for (let min = STEP_MIN; min <= totalMin; min += STEP_MIN) {
    try { await page.clock.runFor(STEP_MIN * 60000); } catch (e) { detect(min, 'runFor', e.message.slice(0, 200)); break; }
    await stubRender.again();
    const s = await sample();
    if (!Number.isFinite(s.x) || !Number.isFinite(s.z)) { if (!nanSeen) detect(min, 'NaN', JSON.stringify(s)); nanSeen = true; }
    // flags held a long time
    ['isBusy', 'isBuilding', 'isPracticing', 'isCollectingMail', 'isSleeping', 'riding'].forEach(f => {
      const on = f === 'riding' ? !!s.riding : s.flags.includes(f);
      if (on) { flagSince[f] = flagSince[f] ?? min; const held = min - flagSince[f]; const lim = f === 'isSleeping' ? 600 : f === 'isBuilding' ? 120 : 45; if (held === lim) detect(min, 'flag', `${f} held ${held} min (title "${s.title}", tag ${s.tag})`); }
      else delete flagSince[f];
    });
    // standing still
    const moved = lastPos && Math.hypot(s.x - lastPos.x, s.z - lastPos.z) > 0.05;
    stillMin = moved || !lastPos ? 0 : stillMin + STEP_MIN;
    if (stillMin === 60 && !s.flags.includes('isSleeping')) detect(min, 'still', `not moved for 60 min at (${s.x},${s.z}) flags=${s.flags} title "${s.title}"`);
    lastPos = s;
    // target far from him but not walking (walk stuck)
    if (s.tx != null && Math.hypot(s.tx - s.x, s.tz - s.z) > 1.5 && !s.walking && !s.riding && !s.trip && stillMin >= 10 && stillMin % 30 === 10) detect(min, 'target', `target (${s.tx},${s.tz}) but standing at (${s.x},${s.z}) title "${s.title}"`);
    // repeated titles
    if (s.title !== lastTitle) { titleRuns[s.title] = (titleRuns[s.title] || 0) + 1; lastTitle = s.title; }
    if (VISITOR && min % 20 === 0) { const n = await visit().catch(e => { detect(min, 'visit', e.message); return 0; }); if (n) console.log(`[${min}m] visitor answered ${n} requests`); }
    if (RELOAD_EVERY_H && min % (RELOAD_EVERY_H * 60) === 0 && min < totalMin) {
      await page.evaluate(() => savePersistentBrainStateNow && savePersistentBrainStateNow());
      await page.reload({ timeout: 600000 }); await page.clock.runFor(4000); await stubRender();
      console.log(`[${min}m] reloaded`);
    }
    if (min % 10 === 0 || !prev || prev.title !== s.title) {
      console.log(`[${min}m +${Math.round((Date.now() - t0) / 1000)}s] (${s.x},${s.z}) ${s.flags.join(',') || '-'}${s.riding ? ' ride=' + s.riding : ''} "${s.title}" [${s.tag}] hp${s.health} f${s.full} h${s.hyd} req${s.openReq} mail${s.mail} ag[${s.agenda.join(' ')}]`);
    }
    prev = s;
  }
  const end = await sample();
  console.log('---- SUMMARY ----');
  console.log('mode', MODE, 'hours', HOURS, 'seed', SEED, 'aiCalls', aiCalls, 'real seconds', Math.round((Date.now() - t0) / 1000));
  console.log('end', JSON.stringify(end));
  console.log('titles', JSON.stringify(Object.entries(titleRuns).sort((a, b) => b[1] - a[1]).slice(0, 25)));
  console.log('detections', detections.length, JSON.stringify(detections));
  console.log('warnings', JSON.stringify(Object.entries(warns).sort((a, b) => b[1] - a[1]).slice(0, 25)));
  console.log('page errors:', errors.length ? errors.length + ' ' + JSON.stringify([...new Set(errors)].slice(0, 10)) : 'none');
  await browser.close();
  if (server) server.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('SOAK FAILED', e); process.exit(2); });
