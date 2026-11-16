// Brain 2 tests: smarter memory, long goals, learning from results, the no-key brain, reload.
//   node brain2.js <memory|goals|learn|nokey|reload|all>   (KELO_ROOT, PORT)
// memory also runs on the old code (BEFORE=1) for the token/recall comparison on the same fixtures.
const { chromium } = require('playwright');
const path = require('path'), http = require('http'), fs = require('fs');
const ROOT = process.env.KELO_ROOT, PORT = +process.env.PORT || 8961, V = path.join(__dirname, 'vendor');
const BEFORE = Boolean(process.env.BEFORE);
const T = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const which = process.argv[2] || 'all';
const results = [];
const check = (name, cond, info = '') => { results.push({ name, pass: Boolean(cond), info }); console.log(cond ? 'PASS' : 'FAIL', name, info); };

(async () => {
  const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 900, height: 600 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let lastPrompt = '';
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.includes('three.min.js')) return route.fulfill({ path: path.join(V, 'three.min.js') });
    if (u.includes('OrbitControls')) return route.fulfill({ path: path.join(V, 'OrbitControls.js') });
    if (u.includes('cdn.tailwindcss.com')) return route.fulfill({ path: path.join(V, 'tailwind.js') });
    if (u.includes('generativelanguage')) {
      try { const b = JSON.parse(route.request().postData()); const tx = b.contents[0].parts.map(p => p.text || '').join('\n'); if (/MOMENT: decide what you want to do next|Current state:/.test(tx)) lastPrompt = tx; } catch (e) {}
      const m = lastPrompt.match(/Goal ideas you could take up \("newGoal"\): "([a-z-]+)"/);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ thought: 'ok', actionTitle: 'Thinking it over', speech: 'Hm.', diary: 'Dear Diary, hm.', destination: 'stay', build: null, newGoal: m ? m[1] : null }) }] } }] }) });
    }
    if (u.includes('anthropic')) return route.fulfill({ status: 500, body: '{}' });
    if (u.includes('wikipedia.org')) return route.fulfill({ body: '{"query":{"search":[]}}', contentType: 'application/json' });
    if (u.startsWith(`http://localhost:${PORT}`)) return route.continue();
    return route.fulfill({ status: 404, body: '' });
  });
  const load = async () => { await page.goto(`http://localhost:${PORT}/index.html`, { timeout: 420000 }); await page.waitForTimeout(5000); await page.evaluate(() => { window.alert = () => {}; state.isCollectingMail = true; state.isBusy = false; }); };
  await load();

  // ---- 1) Smarter memory: same fixtures, tokens and whether the fact that matters made it in ----------
  if (which === 'memory' || which === 'all') {
    const FIX = [
      { name: 'hungry, apples in the Storehouse', setup: () => { state.fullness = 18; state.toolInventory.unshift('A basket of apples'); }, must: /apples/i, trigger: null },
      { name: 'night, has a telescope', setup: () => { state.toolInventory.unshift('A brass telescope'); }, must: /telescope/i, trigger: 'The stars are out over the lake tonight.' },
      { name: 'parcel waiting at the post office', setup: () => { state.mailbox.push({ id: 'mx1', kind: 'request', from: 'Sam', name: 'A sturdy shovel' }); }, must: /shovel/i, trigger: null },
      { name: 'paused task he must get back to', setup: () => { agendaAdd({ ref: 'fx-paint', kind: 'misc', title: 'Paint the boathouse door', steps: ['Sand it', 'Paint it'], quiet: true }); const t = agendaGet('fx-paint'); t.status = 'paused'; t.pausedBy = 'a visitor'; }, must: /boathouse door/i, trigger: null },
      { name: 'visitor asks about the frozen lake', setup: () => {}, must: /10 cm|ice/i, trigger: 'A visitor asked if you can walk on the frozen lake.' }
    ];
    // Everyone gets a busy life first, so there is a lot competing for space (same on before and after)
    await page.evaluate(() => {
      for (let i = 0; i < 25; i++) state.diaryEntries.unshift({ text: `Dear Diary, entry ${i} about ${['rocks', 'clouds', 'the cafe', 'my servos', 'a beetle'][i % 5]} and the long afternoon.` });
      for (let i = 0; i < 10; i++) state.coreMemories.unshift({ text: `I remember day ${i}, the ${['lake', 'snow', 'bees', 'road', 'kite'][i % 5]}.` });
      ['Claw hammer', 'Wrench', 'Hand saw', 'Pliers', 'Screwdriver', 'Axe', 'Kite', 'Spray paint', 'Cordless drill', 'Toolbox'].forEach(n => state.toolInventory.push(n));
      for (let i = 0; i < 6; i++) state.concepts.unshift({ name: `Idea ${i}`, definition: `Something about pattern ${i}.` });
      apiKey = 'TESTKEY-brain2-000';
    });
    const rows = [];
    for (const f of FIX) {
      const out = await page.evaluate(async ([setup, trig]) => {
        const snap = JSON.stringify({ f: state.fullness, t: state.toolInventory, m: state.mailbox, a: state.agenda });
        (eval(`(${setup})`))();
        await generateLLMDecision(trig);
        const s = JSON.parse(snap); state.fullness = s.f; state.toolInventory = s.t; state.mailbox = s.m; state.agenda = s.a;
        return true;
      }, [f.setup.toString(), f.trigger]);
      await page.waitForTimeout(300);
      const tok = Math.ceil(lastPrompt.length / 4);
      const schemaAt = lastPrompt.indexOf('Return JSON');
      const statePart = schemaAt > 0 ? lastPrompt.slice(0, schemaAt) : lastPrompt;
      const hit = f.must.test(statePart);
      const fenced = /<<<UNTRUSTED[\s\S]*Dear Diary|<<<UNTRUSTED[\s\S]*entry/.test(statePart) || /<<<UNTRUSTED/.test(statePart);
      rows.push({ fixture: f.name, promptTok: tok, stateTok: Math.ceil(statePart.length / 4), relevantFactIn: hit });
      check(`memory: ${f.name}: the fact that matters is in the prompt`, hit, `${tok} tokens (state ${Math.ceil(statePart.length / 4)})`);
      check(`memory: ${f.name}: untrusted text still fenced`, fenced);
    }
    fs.writeFileSync(path.join(__dirname, `memory-${BEFORE ? 'before' : 'after'}.json`), JSON.stringify(rows, null, 1));
    console.log('MEMORY', JSON.stringify(rows));
    if (!BEFORE) check('memory: prompt under 4,500 tokens on every fixture', rows.every(r => r.promptTok < 4500), rows.map(r => r.promptTok).join(','));
  }

  if (BEFORE) { finish(); return; }

  // ---- 2) Long goals ------------------------------------------------------------------------------------
  if (which === 'goals' || which === 'all') {
    const r = await page.evaluate(async () => {
      const out = {};
      state.goals = { list: [], history: [], lastPickAt: 0 };
      // Picked from what a visitor said
      state.chatLog.push({ sender: 'Ana', text: 'Have you ever looked at the stars and the planets through a telescope?', isBot: false });
      const c = goalCandidates();
      out.top = c.slice(0, 3).map(x => `${x.id}:${x.source}`);
      const sky = goalStart('night-sky', { params: {}, source: c.find(x => x.id === 'night-sky').source, sourceText: c.find(x => x.id === 'night-sky').sourceText });
      out.sky = Boolean(sky); out.skySource = sky && sky.source; out.stages = sky && sky.stages.length;
      out.onAgenda = Boolean(sky && agendaGet(sky.agendaId) && agendaGet(sky.agendaId).kind === 'goal');
      // Skip the reading step; the next step asks for a telescope and blocks on its delivery
      sky.stages[0].tasks[0].status = 'done'; goalAdvance(sky);
      state.toolInventory = state.toolInventory.filter(n => !/telescope/i.test(n));
      const r1 = await goalStep(sky);
      out.asked = state.requestsToUser.some(q => /telescope/i.test(q.requestedGear || '') && !q.fulfilled);
      out.blocked = sky.status === 'waiting' && sky.blocker && sky.blocker.type === 'items';
      out.blockLabel = sky.blocker && sky.blocker.label;
      // It arrives: the blocker clears on the agenda's check, and the step completes
      state.toolInventory.unshift('A telescope');
      out.cleared = goalAgendaCheck(agendaGet(sky.agendaId)) === true;
      await goalStep(sky);
      out.askDone = sky.stages[1].tasks[0].status === 'done';
      out.progress = Math.round(goalProgress(sky) * 100);
      // The farm machine's API: a custom template with a custom action, run to the end
      let ran = 0;
      registerGoalAction('till', { key: () => 'farm-till', label: t => `till field ${t.field}`, run: () => { ran++; return true; } });
      registerGoalTemplate('test-farm', { title: 'Build a big farm', emoji: '🚜', keywords: /farm|field/i, params: () => ({}), stages: () => [{ name: 'Till', tasks: [{ do: 'till', field: 1 }, { do: 'till', field: 2 }] }, { name: 'Look back', tasks: [{ do: 'reflect' }] }] });
      const farm = goalStart('test-farm', { source: 'self', force: true });
      for (let i = 0; i < 6 && farm.status !== 'done'; i++) { farm.blocker = null; await goalStep(farm); }
      out.farmDone = farm.status === 'done' && ran === 2;
      out.farmInHistory = state.goals.history.some(h => h.template === 'test-farm' && h.status === 'done');
      // A season blocker
      const garden = goalStart('garden', { source: 'self', force: true });
      garden.stages[0].tasks[0].status = 'done'; garden.stages[1].tasks[0].status = 'done'; goalAdvance(garden);
      const realNow = worldNow; window.worldNow = () => ({ ...realNow(), season: 'Winter' });
      await goalStep(garden);
      out.winterBlocked = garden.blocker && garden.blocker.type === 'season';
      window.worldNow = realNow;
      out.aiLine = goalsSummaryForAI();
      out.diary = state.diaryEntries.filter(d => d.goal).slice(0, 6).map(d => d.text);
      savePersistentBrainStateNow();
      return out;
    });
    check('goals: picked from what the visitor said (source visitor)', r.skySource === 'visitor', JSON.stringify(r.top));
    check('goals: goal -> stages -> tasks, on the agenda as one task', r.sky && r.stages === 4 && r.onAgenda);
    check('goals: asks for the telescope through the Post Office', r.asked);
    check('goals: blocked waiting for the delivery', r.blocked, r.blockLabel);
    check('goals: delivery arrives, blocker clears, step done', r.cleared && r.askDone, `progress ${r.progress}%`);
    check('goals: season blocker (no planting in winter)', r.winterBlocked);
    check('goals: registerGoalTemplate/registerGoalAction run a custom goal to the end', r.farmDone && r.farmInHistory);
    check('goals: the AI sees the goals', /Learn the night sky/.test(r.aiLine), r.aiLine.slice(0, 160));
    console.log('GOAL DIARY', JSON.stringify(r.diary, null, 1));
    // Reload mid-goal: it is still there, at the same stage, and the agenda resumes it
    const before = await page.evaluate(() => { const g = goalsOpen().find(x => x.template === 'night-sky'); return g && { id: g.id, stage: g.stage, p: goalProgress(g) }; });
    await load();
    await page.waitForTimeout(2500);
    const after = await page.evaluate(id => { const g = goalById(id); const t = g && agendaGet(g.agendaId); return g && { stage: g.stage, p: goalProgress(g), agenda: t && t.status }; }, before && before.id);
    check('goals: survives a reload at the same stage and progress', after && before && after.stage === before.stage && after.p === before.p, JSON.stringify({ before, after }));
  }

  // ---- 3) Learning from results ---------------------------------------------------------------------------
  if (which === 'learn' || which === 'all') {
    const r = await page.evaluate(async () => {
      const out = {};
      state.outcomes = { log: [], stats: {}, lessons: [] };
      recentActivities.length = 0; state.activityCooldowns = {};
      const before = state.diaryEntries.length;
      // A step fails for want of a tool
      await tryActivity('testweld', () => 'needs-tools');
      out.lesson = outcomeState().lessons[0];
      out.blockedSameWorld = !outcomeCanTry('testweld');
      // Something changes (he got a new thing): worth trying again, and the diary says what he'll do differently
      state.toolInventory.unshift('A welding clamp');
      out.retryAfterChange = outcomeCanTry('testweld');
      state.activityCooldowns = {};
      await tryActivity('testweld', () => true);
      out.workedNoted = Boolean(outcomeState().lessons[0].worked);
      out.diary = state.diaryEntries.slice(0, state.diaryEntries.length - before).map(d => d.text);
      // Prefer what worked: bias for an activity that keeps working vs one that keeps failing
      for (let i = 0; i < 5; i++) { outcomeRecord(outcomeSnapshot('goodact'), true); outcomeRecord(outcomeSnapshot('badact'), 'test-failed'); }
      out.biasGood = outcomeBias('goodact'); out.biasBad = outcomeBias('badact');
      // Learns WHEN: fails at night, works by day
      const realNow = worldNow;
      for (let i = 0; i < 4; i++) {
        window.worldNow = () => ({ ...realNow(), isNight: true }); outcomeRecord(outcomeSnapshot('scope'), 'too-windy');
        window.worldNow = () => ({ ...realNow(), isNight: false }); outcomeRecord(outcomeSnapshot('scope'), true);
      }
      window.worldNow = () => ({ ...realNow(), isNight: true }); out.nightFactor = outcomeContextFactor('scope');
      window.worldNow = () => ({ ...realNow(), isNight: false }); out.dayFactor = outcomeContextFactor('scope');
      window.worldNow = realNow;
      out.insight = outcomeContextInsight('scope');
      // Learns which fix works: 'order' failed twice for needs-tools, 'mail' worked
      outcomeFixResult('needs-tools', 'order', false); outcomeFixResult('needs-tools', 'order', false); outcomeFixResult('needs-tools', 'mail', true);
      outcomeRecord(outcomeSnapshot('fixtest'), 'needs-tools');
      out.fixChoice = outcomeFixFor('fixtest');
      // Goal planner retries differently: a failing goal step gets the fix inserted first
      registerGoalAction('flaky', { key: () => 'flakyact', label: () => 'do the flaky thing', run: () => 'learning' });
      registerGoalTemplate('test-flaky', { title: 'A flaky goal', keywords: /zzz/, params: () => ({}), stages: () => [{ name: 'Try', tasks: [{ do: 'flaky', topic: 'flaky things' }] }] });
      const realBrowse = browseInternet; window.browseInternet = async q => { state.webHistory.unshift({ query: q, verdict: 'read' }); };
      state.isCollectingMail = false; state.isBusy = false; state.isPracticing = false; state.isBrowsing = false;
      const g = goalStart('test-flaky', { force: true });
      await goalStep(g); g.blocker = null; recentActivities.length = 0; state.activityCooldowns = {};
      await goalStep(g);
      out.fixInserted = g.stages[0].tasks.some(t => t.isFix);
      out.fixKind = (g.stages[0].tasks.find(t => t.isFix) || {}).do;
      // Not the same failing plan forever: after 3 tries the step is set aside
      for (let i = 0; i < 8 && g.stages[0].tasks.some(t => !t.isFix && t.status === 'todo'); i++) { g.blocker = null; recentActivities.length = 0; state.activityCooldowns = {}; state.outcomes.stats.flakyact && (state.outcomes.stats.flakyact.lastFailAt = 0); await goalStep(g); }
      out.setAside = g.stages[0].tasks.some(t => !t.isFix && t.status === 'skipped');
      window.browseInternet = realBrowse; state.isCollectingMail = true;
      out.flakyTasks = JSON.stringify(g.stages[0].tasks.map(t => ({ do: t.do, s: t.status, tries: t.tries, r: t.lastResult, fix: t.isFix }))) + ' ' + JSON.stringify(g.blocker) + ' ' + g.status;
      // Bounded in the save
      for (let i = 0; i < 400; i++) outcomeRecord(outcomeSnapshot('k' + (i % 70)), i % 3 ? true : 'test-failed');
      const o = outcomeState();
      out.bounded = { log: o.log.length, keys: Object.keys(o.stats).length, lessons: o.lessons.length, bytes: JSON.stringify(o).length };
      out.aiLines = outcomeSummaryForAI().slice(0, 300);
      return out;
    });
    check('learn: a failure becomes a lesson (why + fix)', r.lesson && r.lesson.why && r.lesson.fix, JSON.stringify(r.lesson));
    check('learn: the same failing plan is not retried while nothing changed', r.blockedSameWorld);
    check('learn: retried once something changed', r.retryAfterChange);
    check('learn: diary says "Last time ..., so this time ..."', r.diary.some(t => /last time .*, so this time I.ll/i.test(t)), JSON.stringify(r.diary));
    check('learn: notes when the different way worked', r.workedNoted && r.diary.some(t => /It worked this time/.test(t)));
    check('learn: prefers what worked', r.biasGood > 1 && r.biasBad < 0.8, `good ${r.biasGood.toFixed(2)} bad ${r.biasBad.toFixed(2)}`);
    check('learn: learns WHEN it works (night vs day)', r.nightFactor < 0.8 && r.dayFactor > 1.1 && r.insight && r.insight.v === 'night' === !r.insight.good, `night ${r.nightFactor.toFixed(2)} day ${r.dayFactor.toFixed(2)} ${JSON.stringify(r.insight)}`);
    check('learn: picks the fix that worked before', r.fixChoice && r.fixChoice.kind === 'mail' && r.fixChoice.learned, JSON.stringify(r.fixChoice));
    check('learn: goal step retried differently (fix step inserted)', r.fixInserted, r.fixKind);
    check('learn: a step that keeps failing is set aside, not repeated', r.setAside, r.flakyTasks);
    check('learn: bounded in the save', r.bounded.log <= 60 && r.bounded.keys <= 40 && r.bounded.lessons <= 20 && r.bounded.bytes < 30000, JSON.stringify(r.bounded));
    console.log('LEARN AI', r.aiLines);
  }

  // ---- 4) The no-key brain ---------------------------------------------------------------------------------
  if (which === 'nokey' || which === 'all') {
    const r = await page.evaluate(() => {
      apiKey = ''; claudeApiKey = '';
      state.recentDecisionTitles = [];
      const titles = [], diaries = [];
      for (let i = 0; i < 40; i++) {
        const d = generateProceduralDecision({ noReplay: true });
        titles.push(d.actionTitle); diaries.push(d.diary);
        noteDecision(d.actionTitle);
        state.diaryEntries.unshift({ text: d.diary });
      }
      const verbs = titles.map(t => t.split(' ')[0]);
      let maxRun = 0, run = 0; titles.forEach((t, i) => { run = i && t === titles[i - 1] ? run + 1 : 1; maxRun = Math.max(maxRun, run); });
      return { distinctTitles: new Set(titles).size, distinctDiary: new Set(diaries).size, distinctVerbs: new Set(verbs).size, maxRun, sample: titles.slice(0, 8), dsample: diaries.slice(0, 3),
        night: (() => { const realNow = worldNow; window.worldNow = () => ({ ...realNow(), isNight: true, hour: 23 }); const n = []; for (let i = 0; i < 20; i++) n.push(generateProceduralDecision({ noReplay: true }).actionTitle); window.worldNow = realNow; return n; })() };
    });
    check('nokey: 40 decisions, at least 32 distinct', r.distinctTitles >= 32, `${r.distinctTitles} titles, ${r.distinctVerbs} verbs`);
    check('nokey: 40 diary lines, all distinct', r.distinctDiary === 40, `${r.distinctDiary}`);
    check('nokey: never the same decision twice in a row', r.maxRun === 1);
    check('nokey: the moment matters (at night, night subjects come up)', r.night.filter(t => /night|stars|moon|dark|lights/i.test(t)).length >= 5, r.night.slice(0, 6).join(' / '));
    console.log('NOKEY sample', JSON.stringify(r.sample), JSON.stringify(r.dsample, null, 1));
  }
  finish();

  function finish() {
    check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    const pass = results.filter(x => x.pass).length;
    console.log(`RESULT ${pass}/${results.length}`);
    fs.writeFileSync(path.join(__dirname, `brain2-${which}${BEFORE ? '-before' : ''}.json`), JSON.stringify(results, null, 1));
    browser.close().then(() => { srv.close(); process.exit(0); });
  }
})();
