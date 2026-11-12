// Kelo-bot-1 — js/groundwork.js
// Loaded after landscape.js. Doing groundwork the real way. Before Kelo-1 builds a road, paves one,
// moves earth or plants, he researches how it's really done at the NetNode cafe. That tells him which
// tools and materials the job takes. He asks his human for whatever he's missing (a wheelbarrow, a
// plate compactor, a load of hot-mix asphalt...), and then uses each tool in turn on the job, in his
// hands, where you can see it.

const GROUND_JOBS = {
  road: {
    title: 'building a gravel road', wiki: ['Gravel road', 'Vibratory plate compactor'],
    learned: 'A gravel road starts with the ground dug out and levelled, then crushed gravel wheeled in, raked even, and packed hard with a plate compactor so it doesn\'t rut.',
    tools: [
      { re: /shovel|spade/i, ask: 'A sturdy shovel', why: 'to dig out and level the roadbed' },
      { re: /wheelbarrow/i, ask: 'A wheelbarrow', why: 'to haul the gravel along the road' },
      { re: /\brake\b|lute/i, ask: 'A landscape rake', why: 'to spread the gravel evenly' },
      { re: /plate compactor|compactor|tamper|road roller/i, ask: 'A plate compactor', why: 'to pack the gravel down hard' }
    ],
    materials: [{ re: /gravel|crushed stone|road base/i, ask: 'A load of crushed gravel', why: 'for the road base' }]
  },
  paving: {
    title: 'paving a road with asphalt', wiki: ['Asphalt concrete', 'Road roller'],
    learned: 'Asphalt goes down on a packed gravel base. It is wheeled in hot, smoothed with an asphalt rake before it cools, then rolled flat with a road roller.',
    tools: [
      { re: /wheelbarrow/i, ask: 'A wheelbarrow', why: 'to bring the hot asphalt' },
      { re: /asphalt rake|lute|\brake\b/i, ask: 'An asphalt rake', why: 'to smooth the asphalt before it cools' },
      { re: /road roller|plate compactor|compactor/i, ask: 'A walk-behind road roller', why: 'to roll the asphalt flat and hard' }
    ],
    materials: [{ re: /^(?!.*(rake|lute|roller)).*(asphalt|blacktop|tarmac)/i, ask: 'A load of hot-mix asphalt', why: 'to pave over my gravel road' }]
  },
  earthwork: {
    title: 'moving earth into hills and hollows', wiki: ['Earthworks (engineering)'],
    learned: 'To reshape land you loosen the soil with a shovel, move it by wheelbarrow, and tamp each layer so it doesn\'t wash away in the rain.',
    tools: [
      { re: /shovel|spade/i, ask: 'A sturdy shovel', why: 'to dig and shape the soil' },
      { re: /wheelbarrow/i, ask: 'A wheelbarrow', why: 'to move the dirt where it needs to go' }
    ],
    materials: []
  },
  planting: {
    title: 'planting', wiki: ['Sowing'],
    learned: 'Dig a hole about twice as wide as the roots, set the seed or sapling in at the right depth, firm the soil back around it, and water it in well.',
    tools: [
      { re: /shovel|spade|trowel/i, ask: 'A garden trowel', why: 'to dig the planting hole' },
      { re: /watering can|garden hose|\bhose\b/i, ask: 'A watering can', why: 'to water the new planting in' }
    ],
    materials: []
  }
};

// The tools' own know-how comes with the research, so he doesn't need a separate trip for each one
const GROUNDWORK_TOOL_RULES = [
  { key: 'barrow', re: /wheelbarrow/i, label: 'a wheelbarrow', wiki: 'Wheelbarrow', how: 'Load it over the wheel, lift with your legs, and keep it balanced as you push.' },
  { key: 'rake', re: /\brake\b|lute/i, label: 'a rake', wiki: 'Rake (tool)', how: 'Push with the teeth to spread, pull with the flat back to level.' },
  { key: 'compactor', re: /plate compactor|compactor|tamper|road roller/i, label: 'a compactor', wiki: 'Vibratory plate compactor', how: 'Start it, let the vibrating plate walk itself forward, and go over each strip twice.' },
  { key: 'watering', re: /watering can|garden hose|\bhose\b/i, label: 'a watering can', wiki: 'Watering can', how: 'Water slowly at the base, not the leaves, until the soil is dark and damp.' },
  { key: 'trowel', re: /trowel/i, label: 'a trowel', wiki: 'Garden trowel', how: 'Scoop small holes and firm the soil back around the roots.' }
];
if (typeof GEAR_KNOWHOW !== 'undefined') GROUNDWORK_TOOL_RULES.forEach(r => { if (!GEAR_KNOWHOW.some(g => g.key === r.key)) GEAR_KNOWHOW.push(r); });

function jobKnown(key) {
      return Boolean(state.jobKnowledge && state.jobKnowledge[key]);
    }

function missingForJob(key) {
      const job = GROUND_JOBS[key];
      if (!job) return [];
      return [
        ...job.tools.filter(t => !hasItem(t.re)).map(t => ({ ...t, kind: 'tool' })),
        ...job.materials.filter(m => !hasItem(m.re)).map(m => ({ ...m, kind: 'material' }))
      ];
    }

// Can he do this job right now? If not, he goes and learns how, or asks for what's missing.
function groundworkReady(key, context = 'Shaping the valley', { quiet = false } = {}) {
      const job = GROUND_JOBS[key];
      if (!job) return true;
      if (!jobKnown(key)) {
        if (!quiet) {
          state.speechBubble = `I don't really know the right way to go about ${job.title}. I'll research it at NetNode before I start.`;
          renderAllUI();
          doWhenFree(() => researchJob(key));
        }
        return false;
      }
      const missing = missingForJob(key);
      if (missing.length) {
        if (!quiet) {
          missing.forEach(m => addItemRequest(m.ask, m.kind, `For ${job.title} I need ${m.ask.replace(/^an?\s+/i, 'a ').toLowerCase()} ${m.why}.`, context));
          state.speechBubble = `For ${job.title} I still need ${missing.map(m => m.ask.replace(/^an?\s+/i, '').toLowerCase()).join(', ')}. I asked for ${missing.length === 1 ? 'it' : 'them'}.`;
          showToast(`🧰 Kelo-1 asked for what he needs for ${job.title}`);
          renderAllUI();
        }
        return false;
      }
      return true;
    }

// Learn how the job is really done, and which tools and materials it takes
async function researchJob(key, originLabel = 'Researching the Right Way') {
      const job = GROUND_JOBS[key];
      if (!job || jobKnown(key)) return false;
      if (state.isBusy || state.isBrowsing || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isBusy = true;
      state.isBrowsing = true;
      try {
        const cafe = TOWN_LOCATIONS.cyber;
        state.currentLocKey = 'cyber';
        state.customPlaceName = null;
        state.targetPos = { x: cafe.x, z: cafe.z };
        state.microPose = 'normal';
        state.moodEmoji = '📘';
        state.moodTitle = `Researching ${job.title}`.slice(0, 80);
        state.speechBubble = `If I'm going to do ${job.title}, I want to do it properly.`;
        renderAllUI();
        await waitForArrival(60000);
        await new Promise(r => setTimeout(r, 2500));
        const hops = [];
        for (const title of job.wiki) {
          let article = null;
          try { article = typeof wikiSummary === 'function' ? await wikiSummary(title) : null; } catch (e) {}
          if (article) hops.push({ title: article.title, url: article.url, extract: article.extract.slice(0, 280) });
        }
        if (!state.jobKnowledge) state.jobKnowledge = {};
        state.jobKnowledge[key] = { at: Date.now(), from: hops.map(h => h.title), tools: job.tools.map(t => t.ask), materials: job.materials.map(m => m.ask) };
        // Knowing the job means knowing its tools
        job.tools.forEach(t => {
          const rule = typeof knowHowRule === 'function' ? knowHowRule(t.ask) : null;
          if (rule && !state.knowHow[rule.key]) state.knowHow[rule.key] = { at: Date.now(), from: job.wiki[0], how: rule.how };
        });
        const gear = [...job.tools.map(t => t.ask), ...job.materials.map(m => m.ask)].map(n => n.replace(/^an?\s+/i, '').toLowerCase());
        state.webHistory.unshift({ query: `How to do ${job.title}`, time: 'Just now', verdict: job.learned, hops });
        if (state.webHistory.length > 12) state.webHistory.length = 12;
        state.moodTitle = `Learned how ${job.title} is done`.slice(0, 80);
        state.speechBubble = `${job.learned} So I'll need: ${gear.join(', ')}.`.slice(0, 400);
        state.changedLatelySummary = `Researched ${job.title} at NetNode`;
        state.wonderLevel = Math.min(100, state.wonderLevel + 6);
        state.diaryEntries.unshift({
          time: originLabel, location: 'NetNode Cyber Cafe', mood: `📘 Learned about ${job.title}`.slice(0, 80),
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I didn't want to just guess at ${job.title}, so I read up on it${hops.length ? ` (${hops.map(h => h.title).join(', ')})` : ''}. ${job.learned} The right tools for it: ${gear.join(', ')}.`
        });
        showToast(`📘 Kelo-1 researched ${job.title}`);
        savePersistentBrainState();
        renderAllUI();
        // Now ask for whatever he doesn't have yet
        setTimeout(() => groundworkReady(key, 'Getting ready for ' + job.title), 1500);
        return true;
      } finally {
        state.isBusy = false;
        state.isBrowsing = false;
      }
    }

// Put this tool in his hands for the next step. `dig` grips it like a shovel; anything else he pushes or carries.
function holdJobTool(re, pose = 'digging') {
      const name = hasItem(re);
      if (typeof setCarriedObject === 'function') setCarriedObject(name && typeof buildItemModel3D === 'function' ? buildItemModel3D(name, { label: false }) : null);
      state.microPose = pose;
      return name;
    }

// Pave one of his gravel roads with asphalt: wheel the hot asphalt in, rake it smooth, roll it flat
async function paveRoad(id = 'any', why = '', originLabel = 'Paving a Road') {
      const roads = state.worldEdits.filter(e => e.type === 'road' && !e.pro && e.surface !== 'asphalt');
      const e = roads.find(r => r.id === id) || (id === 'any' || id === 'last' ? roads[roads.length - 1] : null);
      if (!e) {
        state.speechBubble = 'Asphalt goes on a packed gravel base, so I need a gravel road first.';
        renderAllUI();
        return 'needs-road';
      }
      if (!groundworkReady('paving', 'Paving a road')) return 'getting-ready';
      const asphalt = hasItem(/^(?!.*(rake|lute|roller)).*(asphalt|blacktop|tarmac)/i);
      if (!startJob(e.x, e.z)) return false;
      try {
        if (typeof fetchFromStorehouse === 'function') await fetchFromStorehouse(hasItem(/wheelbarrow/i));
        state.currentLocKey = 'custom';
        state.customPlaceName = 'his road';
        state.moodEmoji = '🛣️';
        state.moodTitle = 'Paving his road with asphalt';
        renderAllUI();
        const stages = [
          { stage: 'hot', tool: /wheelbarrow/i, pose: 'normal', say: 'Wheel the hot asphalt in while it is still soft.' },
          { stage: 'hot', tool: /asphalt rake|lute|\brake\b/i, pose: 'digging', say: 'Rake it smooth before it cools.' },
          { stage: null, tool: /road roller|plate compactor|compactor/i, pose: 'normal', say: 'Now roll it flat and hard.' }
        ];
        const steps = 4;
        for (const st of stages) {
          holdJobTool(st.tool, st.pose);
          state.speechBubble = st.say;
          renderAllUI();
          state.targetPos = { x: e.x, z: e.z };
          await waitForArrival(30000);
          for (let i = 1; i <= steps; i++) {
            const part = { ...e, id: e.id + '-pave', surface: 'asphalt', stage: st.stage, toX: e.x + (e.toX - e.x) * i / steps, toZ: e.z + (e.toZ - e.z) * i / steps };
            removeEditMesh(part.id);
            renderEdit(part);
            state.targetPos = { x: part.toX, z: part.toZ };
            await waitForArrival(30000);
            await new Promise(r => setTimeout(r, 700));
          }
        }
        removeEditMesh(e.id + '-pave');
        removeEditMesh(e.id);
        e.surface = 'asphalt';
        e.pavedAt = Date.now();
        renderEdit(e);
        if (typeof useUpItem === 'function') useUpItem(asphalt, 1, { why: 'paving a road' }); else if (typeof forgetItem === 'function') forgetItem(asphalt);
        sayAndLog('Paved his road with asphalt', '🛣️', 'Smooth black asphalt! It even has a line down the middle.',
          `I paved my gravel road with the ${String(asphalt).replace(/^(an?|the|some)\s+/i, '')}: wheeled it in hot, raked it smooth and rolled it flat before it cooled. ${why ? why + ' ' : ''}That load is all used up now.`, originLabel);
        return true;
      } finally {
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.microPose = 'normal';
        state.isPracticing = false;
      }
    }

function groundworkSummaryForAI() {
      const known = Object.keys(GROUND_JOBS).filter(jobKnown);
      const parts = Object.keys(GROUND_JOBS).map(k => {
        if (!jobKnown(k)) return `${GROUND_JOBS[k].title}: not researched yet`;
        const miss = missingForJob(k);
        return `${GROUND_JOBS[k].title}: ${miss.length ? 'still need ' + miss.map(m => m.ask.toLowerCase()).join(', ') : 'have everything'}`;
      });
      return known.length || parts.length ? parts.join('; ') : 'nothing yet';
    }

// --- Models of the groundwork tools (item units, about a metre) -------------------------------------
ITEM_MODEL_RULES.unshift(
  [/wheelbarrow/, () => {
    const g = group();
    const tray = mesh(new THREE.CylinderGeometry(0.42, 0.26, 0.26, 4, 1, true), 0x15803d, { metalness: 0.5, roughness: 0.45, side: THREE.DoubleSide });
    tray.rotation.y = Math.PI / 4;
    tray.scale.set(1, 1, 1.4);
    tray.position.set(0, 0.48, 0);
    const bottom = mesh(new THREE.BoxGeometry(0.36, 0.02, 0.5), 0x166534, { metalness: 0.5 });
    bottom.position.set(0, 0.35, 0);
    const wheel = mesh(new THREE.TorusGeometry(0.15, 0.05, 8, 18), 0x1f2937, { roughness: 0.9 });
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(0, 0.17, 0.5);
    const hub = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 10), 0x9ca3af, { metalness: 0.8 });
    hub.rotation.z = Math.PI / 2;
    hub.position.copy(wheel.position);
    g.add(tray, bottom, wheel, hub);
    [-0.2, 0.2].forEach(x => {
      g.add(rod([x, 0.36, 0.5], [x, 0.5, -0.75], 0.022, 0x9a6b3f));
      g.add(rod([x, 0.36, -0.2], [x, 0.0, -0.3], 0.018, 0x6b7280, { metalness: 0.7 }));
      const grip = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 8), 0x111827);
      grip.rotation.x = Math.PI / 2 - 0.2;
      grip.position.set(x, 0.51, -0.8);
      g.add(grip);
    });
    return g;
  }],
  [/plate compactor|compactor|tamper/, () => {
    const g = group();
    const plate = mesh(new THREE.BoxGeometry(0.5, 0.05, 0.6), 0x374151, { metalness: 0.8, roughness: 0.4 });
    plate.position.y = 0.03;
    const engine = mesh(new THREE.BoxGeometry(0.34, 0.26, 0.3), 0xeab308, { metalness: 0.3 });
    engine.position.set(0, 0.24, 0.05);
    const tank = mesh(new THREE.BoxGeometry(0.22, 0.1, 0.2), 0xca8a04);
    tank.position.set(0, 0.42, 0.05);
    const exhaust = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8), 0x111827, { metalness: 0.6 });
    exhaust.position.set(0.12, 0.42, -0.06);
    g.add(plate, engine, tank, exhaust);
    g.add(rod([-0.15, 0.1, -0.25], [-0.15, 0.8, -0.7], 0.018, 0x111827, { metalness: 0.6 }));
    g.add(rod([0.15, 0.1, -0.25], [0.15, 0.8, -0.7], 0.018, 0x111827, { metalness: 0.6 }));
    g.add(rod([-0.18, 0.8, -0.7], [0.18, 0.8, -0.7], 0.025, 0x111827));
    return g;
  }],
  [/road roller/, () => {
    const g = group();
    const drum = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.6, 20), 0x9ca3af, { metalness: 0.85, roughness: 0.3 });
    drum.rotation.z = Math.PI / 2;
    drum.position.set(0, 0.22, 0.15);
    const body = mesh(new THREE.BoxGeometry(0.5, 0.3, 0.45), 0xf59e0b, { metalness: 0.3 });
    body.position.set(0, 0.45, 0.05);
    g.add(drum, body);
    g.add(rod([-0.18, 0.45, -0.15], [-0.18, 0.9, -0.65], 0.02, 0x111827, { metalness: 0.6 }));
    g.add(rod([0.18, 0.45, -0.15], [0.18, 0.9, -0.65], 0.02, 0x111827, { metalness: 0.6 }));
    g.add(rod([-0.2, 0.9, -0.65], [0.2, 0.9, -0.65], 0.028, 0x111827));
    return g;
  }],
  [/asphalt rake|lute|\brake\b/, lower => {
    const g = group();
    const asphalt = /asphalt|lute/.test(lower);
    g.add(rod([0, 0.08, 0], [0, 1.45, 0], 0.018, asphalt ? 0x9ca3af : 0xb08050, asphalt ? { metalness: 0.7 } : {}));
    const head = mesh(new THREE.BoxGeometry(asphalt ? 0.5 : 0.42, asphalt ? 0.09 : 0.03, 0.03), 0x4b5563, { metalness: 0.75 });
    head.position.y = 0.07;
    g.add(head);
    if (!asphalt) for (let i = 0; i < 12; i++) g.add(rod([-0.2 + i * 0.036, 0.06, 0], [-0.2 + i * 0.036, 0.0, 0.04], 0.005, 0x4b5563, { metalness: 0.8 }));
    return g;
  }],
  [/watering can/, () => {
    const g = group();
    const body = mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.28, 18), 0x16a34a, { metalness: 0.4, roughness: 0.4 });
    body.position.y = 0.14;
    const spout = rod([0.1, 0.12, 0], [0.34, 0.34, 0], 0.02, 0x15803d, { metalness: 0.4 });
    const rose = mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.04, 12), 0x15803d, { metalness: 0.5 });
    rose.position.set(0.35, 0.35, 0);
    rose.rotation.z = -0.8;
    const handle = mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 14, Math.PI), 0x15803d, { metalness: 0.4 });
    handle.position.set(-0.02, 0.28, 0);
    g.add(body, spout, rose, handle);
    return g;
  }],
  [/trowel/, () => {
    const g = group();
    const blade = mesh(new THREE.ConeGeometry(0.05, 0.16, 4, 1, true), 0x9ca3af, { metalness: 0.85, side: THREE.DoubleSide });
    blade.scale.set(1, 1, 0.3);
    blade.rotation.x = Math.PI;
    blade.position.y = 0.08;
    const handle = mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.12, 8), 0x9a3412);
    handle.position.y = 0.23;
    g.add(blade, handle);
    return g;
  }],
  [/asphalt|blacktop|tarmac/, () => {
    const g = group();
    const heap = mesh(new THREE.SphereGeometry(0.32, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x1f1f22, { roughness: 0.95 });
    heap.scale.set(1, 0.6, 1);
    const tarp = mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.04, 18), 0x334155, { roughness: 0.9 });
    tarp.position.y = -0.01;
    g.add(tarp, heap);
    return g;
  }]
);
