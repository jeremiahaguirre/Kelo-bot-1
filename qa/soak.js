// Brain soak: N game days of his life, sped up with Playwright's clock, with or without a (mocked) AI key.
//   KEY=1|0  DAYS=2  REAL_MIN=40  SEED=42  OUT=file.json  KELO_ROOT=<repo> PORT=<port> node soak.js
// Same seed for every run: Math.random is a seeded PRNG from the first line of the page.
// A "visitor bot" delivers what he asks for one game hour after he asks (the same for every run).
// The mocked model answers decisions from a fixed pool of 30 ideas (seeded), takes up the first goal idea
// it is offered, and answers every other AI call with a generic object.
// Measures per game day: activities (by kind), distinct activities, diary lines, distinct diary lines,
// the most repeated diary line, goals started/finished, page errors.
const { chromium } = require('playwright');
const path = require('path'), http = require('http'), fs = require('fs');
const ROOT = process.env.KELO_ROOT, PORT = +process.env.PORT || 8941, V = path.join(__dirname, 'vendor');
const KEY = process.env.KEY === '1', DAYS = +process.env.DAYS || 2, REAL_MIN = +process.env.REAL_MIN || 40, SEED = +process.env.SEED || 42;
const OUT = process.env.OUT || `soak-${KEY ? 'key' : 'nokey'}.json`;
const T = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const DAY_MS = 12 * 3600000;

const IDEAS = ['Sketch the heron on the dock', 'Count the boats on the lake', 'Read about glacier lakes', 'Walk the ridge trail', 'Measure the wind at the pass',
  'Build a cairn by the shore', 'Listen to the woods at dusk', 'Map the creek bed', 'Write a song for the orchard', 'Photograph frost on the meadow',
  'Rest on the porch swing', 'Tidy the workbench', 'Visit the post office', 'Plant a row of beans', 'Collect pine cones', 'Watch the clouds over the peaks',
  'Paint the barn door pattern', 'Study the old rail spike', 'Name the three tallest firs', 'Balance stones on the beach', 'Look for animal tracks',
  'Practise slow breathing', 'Draw a map of the town', 'Invent a game with pebbles', 'Fix the squeaky gate', 'Sort my seed packets',
  'Watch the sunset from the hill', 'Teach myself a knot', 'Hum to the hum of the Workshop', 'Clean the telescope lens'];

(async () => {
  const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 640, height: 400 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  const warns = [];
  page.on('console', m => { const t = m.text(); if (/Gemini|Claude|AI reply|LLM/i.test(t) && warns.length < 40) warns.push(t.slice(0, 200)); });
  await page.addInitScript(seed => {
    let a = seed >>> 0;
    Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }, SEED);
  await page.clock.install({ time: new Date('2026-06-01T08:00:00Z') });
  let mockN = 0, aiCalls = 0, aiTok = 0;
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.includes('three.min.js')) return route.fulfill({ path: path.join(V, 'three.min.js') });
    if (u.includes('OrbitControls')) return route.fulfill({ path: path.join(V, 'OrbitControls.js') });
    if (u.includes('cdn.tailwindcss.com')) return route.fulfill({ path: path.join(V, 'tailwind.js') });
    if (u.includes('generativelanguage')) {
      let body = {}; try { body = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
      const text = ((body.contents || [])[0]?.parts || []).map(p => p.text || '').join('\n');
      aiCalls++; aiTok += Math.ceil(text.length / 4);
      let out;
      if (/MOMENT: decide what you want to do next/.test(text)) {
        const idea = IDEAS[(mockN * 7 + 3) % IDEAS.length]; mockN++;
        const m = text.match(/Goal ideas you could take up \("newGoal"\): "([a-z-]+)"/);
        out = { thought: `I feel like it: ${idea}.`, actionTitle: idea, emoji: '✨', speech: `${idea}, I think.`, diary: `Dear Diary, today: ${idea.toLowerCase()}. ${['It was quiet.', 'The lake was loud.', 'I learned something small.', 'My hands were cold.', 'It went better than I thought.'][mockN % 5]}`,
          destination: 'stay', build: null, newGoal: m && mockN % 3 === 0 ? m[1] : null };
      } else {
        out = { reply: 'Thank you!', verdict: 'Interesting.', speech: 'Interesting!', diary: 'Dear Diary, I read something.', text: 'A memory.', emoji: '💭', actionTitle: 'Looking around', placeName: 'Somewhere', x: 5, z: 2, parts: null, toss: [], keep: '', unknownWords: [] };
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }] }) });
    }
    if (u.includes('anthropic')) return route.fulfill({ status: 500, body: '{}' });
    if (u.includes('wikipedia.org')) return route.fulfill({ body: '{"query":{"search":[]}}', contentType: 'application/json' });
    if (u.startsWith(`http://localhost:${PORT}`)) return route.continue();
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`http://localhost:${PORT}/index.html`, { timeout: 420000 });
  await page.waitForTimeout(6000);
  await page.evaluate(([key]) => {
    window.alert = () => {};
    if (key) { localStorage.setItem('kelo1_gemini_api_key', 'TESTKEY-soak-000'); apiKey = 'TESTKEY-soak-000'; } else { localStorage.removeItem('kelo1_gemini_api_key'); localStorage.removeItem('kelo1_anthropic_api_key'); apiKey = ''; claudeApiKey = ''; }
    const M = window.__soak = { acts: [], diary: [], seen: new WeakSet(), start: Date.now() };
    const day = () => (typeof worldNow === 'function' ? worldNow().day : 0);
    M.day0 = day();
    (state.diaryEntries || []).forEach(e => { if (e && typeof e === 'object') M.seen.add(e); });
    const wrapAct = (name, kindOf) => { const f = window[name]; if (typeof f !== 'function') return; window[name] = function (...a) { try { M.acts.push({ d: day() - M.day0, k: kindOf(a) }); } catch (e) {} return f.apply(this, a); }; };
    wrapAct('tryActivity', a => 'act:' + a[0]);
    wrapAct('decideNextAction', a => 'decide:' + (a[0] ? 'prompted' : 'free'));
    wrapAct('agendaWorkOn', a => 'task:' + (a[0] && a[0].kind));
    wrapAct('runFamiliarRoutineTick', () => 'routine');
    M.llm = { calls: 0, errors: [], nulls: 0, hasKey: 0 };
    { const g = window.generateLLMDecision; window.generateLLMDecision = async function (...a) { M.llm.calls++; try { const r = await g.apply(this, a); if (!r) M.llm.nulls++; return r; } catch (e) { M.llm.errors.push(String(e && e.message || e).slice(0, 160)); throw e; } }; }
    { const d = window.decideNextAction; window.decideNextAction = function (...a) { if (hasLLMKey()) M.llm.hasKey++; return d.apply(this, a); }; }
    wrapAct('synthesizeUnboundedExperience', () => 'synth');
    setInterval(() => {
      (state.diaryEntries || []).slice(0, 20).forEach(e => { if (e && typeof e === 'object' && !M.seen.has(e)) { M.seen.add(e); M.diary.push({ d: day() - M.day0, t: String(e.text || '').slice(0, 300) }); } });
      // The visitor bot: whatever he asked for arrives about a game hour later
      (state.requestsToUser || []).forEach(r => {
        if (r.fulfilled || !r.isToolRequest || !r.requestedGear) return;
        r.__seen = r.__seen || Date.now();
        if (Date.now() - r.__seen > 1800000 && (state.mailbox || []).length < 15) { r.fulfilled = true; r.userAnswer = r.requestedGear; postMail({ kind: 'request', from: 'Sam', name: r.requestedGear, category: r.category, emoji: r.icon, note: '' }); }
      });
    }, 1000);
  }, [KEY]);
  const steps = Math.round(REAL_MIN * 60 / 5);
  const jump = Math.round(DAYS * DAY_MS / steps);
  for (let i = 0; i < steps; i++) {
    await page.clock.fastForward(jump).catch(() => {});
    await page.waitForTimeout(5000);
    if (i % 60 === 0) console.log(`step ${i}/${steps}`, await page.evaluate(() => `day ${worldNow().day - __soak.day0} acts ${__soak.acts.length} diary ${__soak.diary.length}`).catch(e => e.message));
  }
  const res = await page.evaluate(() => {
    const M = window.__soak, days = {};
    const norm = t => t.toLowerCase().replace(/[0-9]+(\.[0-9]+)?/g, '#').replace(/\s+/g, ' ').trim();
    M.acts.forEach(a => { const D = days[a.d] = days[a.d] || { acts: [], diary: [] }; D.acts.push(a.k); });
    M.diary.forEach(x => { const D = days[x.d] = days[x.d] || { acts: [], diary: [] }; D.diary.push(norm(x.t)); });
    const per = Object.entries(days).map(([d, D]) => {
      const c = {}; D.diary.forEach(t => { c[t] = (c[t] || 0) + 1; });
      const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0] || ['', 0];
      const ak = {}; D.acts.forEach(k => { ak[k] = (ak[k] || 0) + 1; });
      let streak = 0, best = 0; D.acts.forEach((k, i) => { streak = i && D.acts[i - 1] === k ? streak + 1 : 1; best = Math.max(best, streak); });
      return { day: +d, activities: D.acts.length, distinctActivities: Object.keys(ak).length, actKinds: ak, longestSameActivityRun: best, diary: D.diary.length, distinctDiary: Object.keys(c).length,
        repeatedDiaryLines: D.diary.length - Object.keys(c).length, topDiaryRepeats: top[1], topDiaryLine: top[0].slice(0, 120) };
    });
    const gs = state.goals || {};
    return { per, goals: { open: (gs.list || []).map(g => ({ t: g.title, p: Math.round(goalProgress(g) * 100), s: g.source, b: g.blocker && g.blocker.label })), history: (gs.history || []).map(h => ({ t: h.title, status: h.status, source: h.source })) },
      outcomes: state.outcomes ? { lessons: (state.outcomes.lessons || []).length, keys: Object.keys(state.outcomes.stats || {}).length, prefs: state.outcomes.prefs, bytes: JSON.stringify(state.outcomes).length } : null,
      llm: M.llm, goalBytes: JSON.stringify(state.goals || {}).length, agendaDone: (state.agenda.tasks || []).filter(t => t.status === 'done').length, gameDays: worldNow().day - M.day0,
      sampleDiary: M.diary.slice(-12).map(x => x.t.slice(0, 160)) };
  });
  res.key = KEY; res.aiWarnings = warns; res.errors = [...new Set(errors)]; res.aiCalls = aiCalls; res.aiTokPerCall = aiCalls ? Math.round(aiTok / aiCalls) : 0;
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  console.log(JSON.stringify({ per: res.per.map(p => ({ d: p.day, a: p.activities, da: p.distinctActivities, run: p.longestSameActivityRun, dl: p.diary, ddl: p.distinctDiary, top: p.topDiaryRepeats })), goals: res.goals.history.length, errors: res.errors.length, ai: res.aiCalls, tok: res.aiTokPerCall }));
  await browser.close(); srv.close();
})();
