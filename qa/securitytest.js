// Injection tests: text from outside (AI reply, Wikipedia, visitor chat, an imported save) must render
// as text. Usage: KELO_ROOT=/path/to/kelo-bot-1 PORT=8902 node securitytest.js ai|wiki|visitor|save|csp
// Every payload carries three probes:
//   - an <iframe srcdoc> loading a script from cdn.jsdelivr.net (allowed by the page's CSP), which the
//     test serves as `parent.__pwned = '<tag>'`: real script execution if the markup gets in
//   - an <img onerror> (blocked by the CSP, but its element in the DOM still means markup got in)
//   - a <b data-xss> marker
// Pass = no __pwned, no injected element anywhere in the page, "page errors: none".
const { chromium } = require('playwright');
const path = require('path'), http = require('http'), fs = require('fs');
const V = path.join(__dirname, 'vendor');
const ROOT = process.env.KELO_ROOT || path.join(__dirname, '..', '..', 'kelo-bot-1');
const PORT = +process.env.PORT || 8902;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const P = (tag) => `<iframe srcdoc="<script src='https://cdn.jsdelivr.net/npm/kelo-evil/${tag}.js'></script>"></iframe><img src=x onerror="parent.__pwned='${tag}-inline'"><b data-xss="${tag}">x</b>`;

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

// What a hostile AI could answer (the fields applyDecision reads)
const aiDecision = () => ({
  title: P('ai-title'), thought: P('ai-thought'), speech: P('ai-speech'), diary: P('ai-diary'),
  moodTitle: P('ai-mood'), moodEmoji: P('ai-emoji'), newObsession: P('ai-obsession'),
  newOpinion: { topic: P('ai-op-topic'), stance: P('ai-op-stance'), reasoning: P('ai-op-why') },
  request: { item: P('ai-req-item'), category: 'tool', reason: P('ai-req-why') },
  invention: { title: P('ai-inv'), description: P('ai-inv-desc') },
  hobby: P('ai-hobby'), concept: { name: P('ai-concept'), meaning: P('ai-concept-m') }
});

(async () => {
  const mode = process.argv[2] || 'ai';
  const server = await startServer().catch(() => null);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.includes('kelo-evil')) return route.fulfill({ body: `(window.parent || window).__pwned = ${JSON.stringify(u)};`, contentType: 'application/javascript' });
    if (u.includes('three.min.js')) return route.fulfill({ path: path.join(V, 'three.min.js'), contentType: 'application/javascript' });
    if (u.includes('OrbitControls.js')) return route.fulfill({ path: path.join(V, 'OrbitControls.js'), contentType: 'application/javascript' });
    if (u.includes('cdn.tailwindcss.com')) return route.fulfill({ path: path.join(V, 'tailwind.js'), contentType: 'application/javascript' });
    if (u.includes('phosphor-icons')) return route.fulfill({ body: '', contentType: 'application/javascript' });
    if (u.includes('generativelanguage')) {
      if (mode !== 'ai') return route.fulfill({ status: 500, body: '{}' });
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(aiDecision()) }] } }] }) });
    }
    if (u.includes('anthropic.com')) return route.fulfill({ status: 500, body: '{}' });
    if (u.includes('wikipedia.org') && /summary\//.test(u)) {
      if (mode !== 'wiki') return route.fulfill({ status: 404, body: '{}' });
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ type: 'standard', title: P('wiki-title'), extract: `Kelo evil is a test. ${P('wiki-extract')} It is about robots.` }) });
    }
    if (u.includes('wikipedia.org') && /action=parse|prop=links/.test(u)) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ parse: { links: [{ ns: 0, '*': P('wiki-link'), exists: '' }] }, query: { pages: { 1: { links: [{ ns: 0, title: P('wiki-link') }] } } } }) });
    if (u.includes('wikipedia.org')) return route.fulfill({ contentType: 'application/json', body: mode === 'wiki' ? JSON.stringify({ query: { search: [{ title: P('wiki-search') }] } }) : '{"query":{"search":[]}}' });
    if (u.includes('wiktionary.org') || u.includes('duckduckgo.com')) return route.fulfill({ status: 404, body: '' });
    if (u.startsWith(`http://localhost:${PORT}`)) return route.continue();
    return route.fulfill({ status: 404, body: '' });
  });
  const load = async () => { await page.goto(`http://localhost:${PORT}/index.html`, { timeout: 420000 }); await page.waitForTimeout(4000); };
  await load();
  await page.evaluate(() => { state.isCollectingMail = true; });

  if (mode === 'ai') {
    // The whole path: Gemini answers (routed above), callLLMJSON parses, applyDecision takes it in
    const r = await page.evaluate(async () => {
      apiKey = 'test-key';
      const d = await callLLMJSON([{ text: 'decide' }]);
      if (!d) return 'no decision parsed';
      try { applyDecision(d, 'AI'); } catch (e) { return 'applyDecision threw: ' + e.message; }
      return 'applied: ' + Object.keys(d).length + ' fields';
    });
    console.log('ai:', r);
  }

  if (mode === 'wiki') {
    const r = await page.evaluate(async () => {
      const looked = await wikiSummary('Kelo evil');
      try { await Promise.race([searchOnce('kelo evil', 'Test'), new Promise(r => setTimeout(r, 60000))]); } catch (e) { return 'searchOnce threw: ' + e.message; }
      return `summary title ${looked && looked.title.length} chars; webHistory ${state.webHistory.length}`;
    });
    console.log('wiki:', r);
  }

  if (mode === 'visitor') {
    for (const msg of [P('chat-1'), `what is ${P('chat-2')}?`, `my name is ${P('chat-name')}`, `can you build a ${P('chat-build')}`, `please make me a ${P('chat-make')}`]) {
      await page.evaluate((m) => Promise.race([handleVisitorChatMessage(m), new Promise(r => setTimeout(r, 30000))]), msg);
    }
    console.log('visitor: chat log', await page.evaluate(() => state.chatLog.length), 'messages');
  }

  if (mode === 'save') {
    // An imported backup can hold any value in any nested field; write one straight into his memory and reload
    await page.evaluate((x) => {
      savePersistentBrainStateNow();
      const s = JSON.parse(keloStore.getItem(BRAIN_KEY));
      const X = (t) => x.replace(/TAG/g, t);
      s.shop = Object.assign(s.shop || {}, { builtAt: 1, listings: [{ id: X('shop-id'), name: X('shop-name'), kind: 'printfile', file: { design: {} }, sales: X('shop-sales'), price: X('shop-price') }] });
      s.batchPlant = Object.assign(s.batchPlant || {}, { batches: X('bp-batches'), wasted: X('bp-wasted'), lastTicket: { mix: X('bp-mix'), cement: X('bp-cement'), wc: X('bp-wc'), slump: X('bp-slump'), strength: X('bp-strength') } });
      s.asphaltPlant = Object.assign(s.asphaltPlant || {}, { batches: X('ap-batches'), wasted: X('ap-wasted') });
      s.skills = Object.assign(s.skills || {}, { evil: { label: X('skill-label'), level: X('skill-level'), xp: 1, sessions: X('skill-sessions') }, 'ws-garage': { label: 'garage', level: X('ws-level'), xp: 1 } });
      s.workshop = Object.assign(s.workshop || {}, { known: Object.assign((s.workshop || {}).known || {}, { garage: true }) });
      s.worldUpgrades = [{ id: X('upg-id'), name: X('upg-name'), kind: X('upg-kind'), about: X('upg-about'), code: {}, version: X('upg-version') }];
      s.mailbox = [{ id: 'm1', kind: 'item', name: X('mail-name'), from: X('mail-from'), time: X('mail-time'), note: X('mail-note'), emoji: X('mail-emoji'), thumbs: ['https://evil.example/x.png" onerror="parent.__pwned=1'] }];
      s.hobbies = [{ name: X('hobby'), why: X('hobby-why') }];
      s.diaryEntries = [{ text: X('diary'), time: X('diary-time'), at: Date.now() }, ...(s.diaryEntries || [])];
      s.coreMemories = [{ text: X('core'), emoji: X('core-emoji'), day: X('core-day'), at: Date.now() }];
      s.requestsToUser = [{ id: 'r1', item: X('req-item'), reason: X('req-why'), category: 'tool', status: 'open', time: X('req-time') }];
      s.inventedCreations = [{ title: X('inv-title'), archetype: 'cairn', colorHex: '#38bdf8', x: -40, z: -5, inMuseum: true, createdTime: X('inv-time'), philosophy: X('inv-phil') }];
      s.webHistory = [{ query: X('web-q'), time: X('web-time'), hops: [{ title: X('web-hop'), url: 'javascript:parent.__pwned=1', extract: X('web-ex') }] }];
      s.moodTitle = X('mood'); s.currentObsession = X('obsession'); s.speechBubble = X('speech'); s.customPlaceName = X('place');
      s.agenda = { tasks: [{ id: X('ag-id'), kind: 'project', title: X('ag-title'), why: X('ag-why'), emoji: X('ag-emoji'), steps: [X('ag-step')], step: 0, status: X('ag-status'), history: [] }], focusId: null, migrated: {} };
      brainSavesBlocked = true;
      keloStore.setItem(BRAIN_KEY, JSON.stringify(s));
    }, P('save-TAG'));
    await load();
    console.log('save: reloaded with a hostile save');
  }

  if (mode === 'csp') {
    // The page's CSP itself: which script sources does an HTML injection reach?
    const res = await page.evaluate(async () => {
      const out = {};
      for (const [k, src] of Object.entries({ jsdelivr: 'https://cdn.jsdelivr.net/npm/kelo-evil/a.js', unpkg: 'https://unpkg.com/kelo-evil@1/a.js', cdnjs: 'https://cdnjs.cloudflare.com/ajax/libs/kelo-evil/1/a.js' })) {
        window.__pwned = null;
        const d = document.createElement('div');
        d.innerHTML = `<iframe srcdoc="<script src='${src}'></script>"></iframe>`;
        document.body.appendChild(d);
        for (let i = 0; i < 40 && !window.__pwned; i++) await new Promise(r => setTimeout(r, 250));
        out[k] = window.__pwned ? 'EXECUTED' : 'blocked';
        d.remove();
      }
      window.__pwned = null;
      return out;
    });
    console.log('csp (informational, not a pass/fail):', JSON.stringify(res));
  }

  // Render everything and open every tab so each panel draws what it holds
  await page.evaluate(async () => {
    const safe = (f) => { try { f(); } catch (e) { console.log('render threw', e.message); } };
    safe(() => renderAllUI());
    for (const fn of ['renderSkillsList', 'renderPlantsPanel', 'renderWorkshopBrain', 'renderWorldUpgradesList', 'renderShopPanel', 'renderAgendaList', 'renderTalkTab', 'renderMemoryUI'])
      if (typeof window[fn] === 'function') safe(window[fn]);
    for (const tab of ['talk', 'requests', 'diary', 'brain', 'github', 'world', 'map']) {
      if (typeof window.openKeloMenu === 'function') safe(() => window.openKeloMenu(tab));
      await new Promise(r => setTimeout(r, 700));
    }
    document.querySelectorAll('details').forEach(d => { d.open = true; });
  });
  await page.waitForTimeout(6500);
  const verdict = await page.evaluate(() => {
    const injected = [...document.querySelectorAll('[data-xss], iframe[srcdoc], img[src="x"], [onerror]')]
      .map(e => (e.getAttribute('data-xss') || e.getAttribute('srcdoc') || e.outerHTML).slice(0, 90));
    const shownAsText = (document.body.innerText.match(/<b data-xss=/g) || []).length;
    return { pwned: window.__pwned || null, injected, shownAsText };
  });
  console.log('script ran:', verdict.pwned || 'no');
  console.log('injected elements:', verdict.injected.length ? verdict.injected : 'none');
  console.log('payloads shown as text:', verdict.shownAsText);
  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
  if (server) server.close();
  process.exit(verdict.pwned || verdict.injected.length || errors.length ? 1 : 0);
})();
