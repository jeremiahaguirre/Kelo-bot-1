// Kelo-bot-1 — js/projects.js
// Loaded after landscape.js. Real builds: Kelo-1 comes across a real thing online (a birdhouse, a
// picnic table...), reads how it's made, and asks visitors for exactly the materials and tools it
// takes. When everything has arrived he builds it at the welding table, using the materials up,
// and sets the finished piece out in the valley at its real size.
// Firewood logs from trees he has chopped (js/landscape.js) can stand in for bought lumber: with a
// saw he rips them into rough boards first, so a wooden build can come straight from the valley.

// Wood he can saw out of his own firewood logs
const FIREWOOD_RE = /firewood|\blogs?\b/i;

const BUILD_PLANS = [
  { key: 'birdhouse', name: 'Birdhouse', wiki: 'Nest box', emoji: '🐦',
    materials: [{ ask: 'Cedar boards', re: /cedar|board|plank|lumber|timber/i, lumber: true }, { ask: 'A box of nails', re: /nail/i }],
    tools: ['hammer', 'saw'], build: () => birdhouseModel() },
  { key: 'picnic', name: 'Picnic table', wiki: 'Picnic table', emoji: '🧺',
    materials: [{ ask: 'Pine planks', re: /plank|board|lumber|timber/i, lumber: true }, { ask: 'A box of wood screws', re: /screw/i }],
    tools: ['saw', 'drill'], build: () => picnicTableModel() },
  { key: 'bench', name: 'Garden bench', wiki: 'Bench (furniture)', emoji: '🪑',
    materials: [{ ask: 'Oak planks', re: /plank|board|lumber|timber/i, lumber: true }, { ask: 'A box of wood screws', re: /screw/i }, { ask: 'A tin of wood stain', re: /stain|varnish|wood oil/i }],
    tools: ['saw', 'drill'], build: () => gardenBenchModel() },
  { key: 'raisedbed', name: 'Raised garden bed', wiki: 'Raised-bed gardening', emoji: '🥕',
    materials: [{ ask: 'Cedar boards', re: /cedar|board|plank|lumber|timber/i, lumber: true }, { ask: 'Bags of garden soil', re: /soil|compost/i }, { ask: 'A box of nails', re: /nail/i }],
    tools: ['hammer', 'saw'], build: () => raisedBedModel() },
  { key: 'feeder', name: 'Bird feeder', wiki: 'Bird feeder', emoji: '🌻',
    materials: [{ ask: 'Cedar boards', re: /cedar|board|plank|lumber|timber/i, lumber: true }, { ask: 'A bag of birdseed', re: /bird ?seed/i }],
    tools: ['saw', 'drill'], build: () => birdFeederModel() },
  { key: 'windchime', name: 'Wind chime', wiki: 'Wind chime', emoji: '🎐',
    materials: [{ ask: 'Copper pipes', re: /copper|pipe|tubing/i }, { ask: 'A spool of fishing line', re: /fishing line|string|cord|twine/i }],
    tools: ['saw'], build: () => windChimeModel() },
  { key: 'doghouse', name: 'Doghouse', wiki: 'Doghouse', emoji: '🐕', r: 1.0,
    materials: [{ ask: 'Cedar boards', re: /cedar|board|plank|lumber|timber/i, lumber: true }, { ask: 'A bundle of asphalt roof shingles', re: /shingle|roofing/i }, { ask: 'A box of nails', re: /nail/i }],
    tools: ['hammer', 'saw'], build: () => doghouseModel() },
  { key: 'kayakrack', name: 'Kayak rack', wiki: 'Kayak', reads: /kayak|canoe/i, emoji: '🛶', r: 1.5, beach: true,
    materials: [{ ask: 'Pressure-treated 4x4 posts', re: /4x4|post|lumber|timber|plank|board/i, lumber: true }, { ask: 'A bag of carriage bolts', re: /bolt/i }, { ask: 'A length of foam pipe insulation', re: /foam|pool noodle|padding|insulation/i }],
    tools: ['saw', 'drill'], build: () => kayakRackModel() },
  { key: 'treehouse', name: 'Treehouse platform', wiki: 'Tree house', reads: /tree ?house/i, emoji: '🌳', r: 1.7, inTree: true,
    materials: [{ ask: 'Pressure-treated 2x8 joists', re: /joist|2x8|2x6|lumber|timber|beam/i, lumber: true }, { ask: 'Cedar decking boards', re: /deck|cedar|board|plank|lumber/i, lumber: true }, { ask: 'A box of structural lag screws', re: /lag|screw/i }, { ask: 'A coil of rope', re: /\brope\b/i }],
    tools: ['saw', 'drill', 'hammer'], build: () => treehousePlatformModel() }
];

const BUILD_TOOLS = {
  hammer: { ask: 'A claw hammer', re: /^(?!.*jack ?hammer).*(hammer|mallet)/i },
  saw: { ask: 'A hand saw', re: /\bsaw\b|handsaw/i },
  drill: { ask: 'A cordless drill', re: /drill(?! bits?)/i }
};

const projectMeshes = {};
const buildsQueued = new Map(); // project id -> when it was queued to wait for him to be free

function planFor(key) {
      return BUILD_PLANS.find(p => p.key === key) || null;
    }

function activeProject() {
      return state.projects.find(p => p.status === 'gathering') || null;
    }

// Which of his things go into each material of a plan. Every thing is used once: a plan that needs
// two lots of lumber takes two. Bought lumber goes first; with a saw, a stack of his own firewood logs
// stands in for any lumber that is still missing (he rips the logs into rough boards).
function allocateMaterials(plan) {
      // Only things meant for building count (no food or toys: js/itemuse.js); logs can stand in for lumber
      // Anything the plan itself asks for counts too (a coil of rope is for climbing and tying, but the
      // treehouse plan needs exactly that), as long as it is the same kind of thing as what was asked for
      const asked = n => typeof itemKindOf === 'function' && plan.materials.some(m => m.re.test(n) && itemKindOf(n) && itemKindOf(m.ask) && itemKindOf(n).kind === itemKindOf(m.ask).kind);
      const pool = ownedItemNames().filter(n => FIREWOOD_RE.test(n) || typeof usableFor !== 'function' || usableFor(n, 'build') || asked(n));
      const take = re => {
        const i = pool.findIndex(n => re.test(n) && !FIREWOOD_RE.test(n));
        return i >= 0 ? pool.splice(i, 1)[0] : null;
      };
      const canSaw = pool.some(n => BUILD_TOOLS.saw.re.test(n));
      const out = plan.materials.map(m => ({ m, item: take(m.re), fromLogs: false }));
      out.forEach(a => {
        if (a.item || !a.m.lumber || !canSaw) return;
        const i = pool.findIndex(n => FIREWOOD_RE.test(n));
        if (i >= 0) { a.item = pool.splice(i, 1)[0]; a.fromLogs = true; }
      });
      return out;
    }

// What is still missing for a plan: materials and tools he doesn't have yet
function missingFor(plan) {
      const owned = typeof buildableOwnedNames === 'function' ? buildableOwnedNames() : ownedItemNames();
      return {
        materials: allocateMaterials(plan).filter(a => !a.item).map(a => a.m),
        tools: plan.tools.filter(t => !owned.some(n => BUILD_TOOLS[t].re.test(n)))
      };
    }

// Firewood logs are build stock, not clutter: spare stacks are never thrown out as duplicates (js/disposal.js)
function isLumberStock(name) {
      return FIREWOOD_RE.test(String(name || ''));
    }

function requestMissing(plan) {
      const miss = missingFor(plan);
      miss.materials.forEach(m => addItemRequest(m.ask, 'material', `For the ${plan.name.toLowerCase()} I'm building.`, `Building a ${plan.name.toLowerCase()}`));
      miss.tools.forEach(t => addItemRequest(BUILD_TOOLS[t].ask, 'tool', `I need it to build the ${plan.name.toLowerCase()}.`, `Building a ${plan.name.toLowerCase()}`));
      return miss;
    }

// He has found a real thing he wants to make: read how it's built, then ask for what it takes
async function startProject(key, originLabel = 'Found Something to Build') {
      const plan = planFor(key);
      if (!plan || activeProject() || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isBusy = true;
      state.isBrowsing = true;
      try {
        const cafe = TOWN_LOCATIONS.cyber;
        state.currentLocKey = 'cyber';
        state.customPlaceName = null;
        state.targetPos = { x: cafe.x, z: cafe.z };
        state.moodEmoji = plan.emoji;
        state.moodTitle = `Reading how to build a ${plan.name.toLowerCase()}`;
        state.speechBubble = `I found a real ${plan.name.toLowerCase()} online. I want to build one myself, properly.`;
        renderAllUI();
        await waitForArrival(90000);
        await new Promise(r => setTimeout(r, 2500));
        let article = null;
        try { article = typeof wikiSummary === 'function' ? await wikiSummary(plan.wiki) : null; } catch (e) {}
        state.webHistory.unshift({
          query: `How to build a ${plan.name.toLowerCase()}`, time: 'Just now',
          verdict: `It takes ${plan.materials.map(m => m.ask.toLowerCase()).join(', ')}, and a ${plan.tools.join(' and a ')}.`,
          hops: article ? [{ title: article.title, url: article.url, extract: article.extract.slice(0, 280) }] : []
        });
        if (state.webHistory.length > 12) state.webHistory.length = 12;
        state.projects.unshift({ id: 'proj-' + Date.now().toString(36), key, status: 'gathering', startedAt: Date.now() });
        const miss = requestMissing(plan);
        const asked = [...miss.materials.map(m => m.ask.toLowerCase()), ...miss.tools.map(t => BUILD_TOOLS[t].ask.toLowerCase())];
        const ownLogs = allocateMaterials(plan).some(a => a.fromLogs);
        state.moodTitle = `Planning a ${plan.name.toLowerCase()}`;
        state.speechBubble = (asked.length ? `To build it I need ${asked.join(', ')}. I've written letters asking for them.` : 'I already have everything it takes!')
          + (ownLogs ? " For the lumber I'll saw up my own firewood logs." : '');
        state.diaryEntries.unshift({
          time: originLabel, location: 'NetNode Cyber Cafe', mood: `${plan.emoji} Planning a ${plan.name.toLowerCase()}`,
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I read about ${article ? article.title.toLowerCase() : `${plan.name.toLowerCase()}s`} and decided to build a real one. It takes ${plan.materials.map(m => m.ask.toLowerCase()).join(', ')}, and I'll need a ${plan.tools.join(' and a ')}.${asked.length ? ` I asked for ${asked.join(', ')}.` : ''}${ownLogs ? ' Instead of buying lumber, I can saw the logs from a tree I chopped into rough boards.' : ''}`
        });
        showToast(`${plan.emoji} Kelo-1 is planning a ${plan.name.toLowerCase()}`);
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        state.isBusy = false;
        state.isBrowsing = false;
      }
    }

// Somewhere open near home to set a finished build down: a kayak rack goes on the beach, and a
// treehouse platform goes up around the trunk of a standing valley tree
function buildSpot(plan = null) {
      const taken = (x, z, pad) => state.projects.some(q => q.status === 'built' && Number.isFinite(q.x) && Math.hypot(q.x - x, q.z - z) < pad);
      if (plan && plan.inTree && typeof valleyTrees !== 'undefined') {
        const home = { x: HOUSE.x, z: HOUSE.z };
        const tree = valleyTrees
          // Room round it for the platform and the ladder: clear of buildings, gardens and other things
          .filter(t => !t.removed && !t.hosting && !(typeof offLimits === 'function' && offLimits(t.x, t.z, 2)) && !taken(t.x, t.z, 4)
            && !Object.values(TOWN_LOCATIONS).some(l => Math.hypot(l.x - t.x, l.z - t.z) < 7)
            && !worldObstacles.some(o => o !== t.obstacle && Math.hypot(o.x - t.x, o.z - t.z) < o.r + 2.4))
          .sort((a, b) => Math.hypot(a.x - home.x, a.z - home.z) - Math.hypot(b.x - home.x, b.z - home.z))[0];
        if (tree) return { x: tree.x, z: tree.z, treeId: tree.id };
      }
      for (let i = 0; i < 60; i++) {
        // Anywhere outside town: the meadows, woods, mountain slopes, along the beach, or land he made
        const r = (plan && plan.r) || 1.2;
        const beach = (plan && plan.beach) || Math.random() < 0.25;
        const free = !beach && typeof openGroundSpot === 'function' ? openGroundSpot(r, Math.random() < 0.5 ? state.botPos : null) : null;
        const x = free ? free.x : Math.round(randRange(-30, 30) * 10) / 10, z = free ? free.z : Math.round(randRange(8.0, 8.8) * 10) / 10;
        if (typeof offLimits === 'function' && offLimits(x, z, r)) continue;
        if (pointBlocked(x, z, { x: 999, z: 999 }) || worldObstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.r + r + 0.2) || taken(x, z, r + 1.5)) continue;
        return { x, z };
      }
      return { x: -14, z: 4 };
    }

// A treehouse platform's tree is an old giant: taller and broader than the young valley trees, so the
// deck sits under its crown. It can't be chopped while the treehouse is in it (js/landscape.js).
const TREEHOUSE_TREE_SCALE = { xz: 2.8, y: 4.2 };
function hostTree(p) {
      if (!p.treeId || typeof valleyTrees === 'undefined') return null;
      const tree = valleyTrees.find(t => t.id === p.treeId && !t.removed);
      if (!tree) return null;
      tree.hosting = p.id;
      tree.group.scale.set(TREEHOUSE_TREE_SCALE.xz, TREEHOUSE_TREE_SCALE.y, TREEHOUSE_TREE_SCALE.xz);
      return tree;
    }

function placeProjectMesh(p) {
      const plan = planFor(p.key);
      if (!plan || projectMeshes[p.id] || !Number.isFinite(p.x)) return;
      const m = lifeSize(realSize(plan.build()));
      const tree = hostTree(p);
      // The ground under a tree's trunk can sit a little lower than its edge, so the posts reach the lowest corner
      m.position.set(p.x, tree ? tree.group.position.y : getIslandGroundHeight(p.x, p.z), p.z);
      m.rotation.y = p.rotY || 0;
      m.traverse(o => { if (o.isMesh) o.castShadow = true; });
      finishBuildModel(m, plan, p);
      scene.add(m);
      projectMeshes[p.id] = m;
      const obstacle = { x: p.x, z: p.z, r: plan.r || (p.key === 'picnic' ? 1.6 : p.key === 'bench' || p.key === 'raisedbed' ? 1.2 : 0.6) };
      worldObstacles.push(obstacle);
      m.userData.obstacle = obstacle;
    }

// "two stacks of my firewood logs (sawn into boards for the joists and the decking) and the box of nails"
function usedUpText(alloc) {
      const plain = n => n.replace(/^(an?|the)\s+/i, '').toLowerCase();
      const logs = alloc.filter(a => a.fromLogs), rest = alloc.filter(a => a.item && !a.fromLogs);
      const parts = [];
      if (logs.length) parts.push(`${logs.length === 1 ? 'a stack' : `${logs.length === 2 ? 'two' : logs.length} stacks`} of my firewood logs (sawn into rough boards instead of the ${logs.map(a => plain(a.m.ask)).join(' and the ')})`);
      rest.forEach(a => parts.push(`the ${plain(a.m.ask)}`));
      return parts.join(', ').replace(/, ([^,]*)$/, ' and $1');
    }

async function buildProject(id, originLabel = 'Building Something Real') {
      const p = state.projects.find(q => q.id === id && q.status === 'gathering');
      const plan = p && planFor(p.key);
      if (!plan) return false;
      const miss = missingFor(plan);
      if (miss.materials.length || miss.tools.length) return false;
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isPracticing = true;
      let wip = null;
      try {
        // Pick the materials up from the Storehouse, then over to the bench
        const alloc = allocateMaterials(plan);
        const fromLogs = alloc.some(a => a.fromLogs);
        const material = (alloc.find(a => a.fromLogs) || alloc[0]).item;
        if (typeof fetchFromStorehouse === 'function' && material) await fetchFromStorehouse(material);
        const bench = typeof projectBenchFor === 'function' ? projectBenchFor(plan) : TOWN_LOCATIONS.weld;
        state.currentLocKey = bench.locKey || 'weld';
        state.customPlaceName = null;
        state.targetPos = { x: bench.x, z: bench.z };
        state.moodEmoji = '🔨';
        state.moodTitle = `Building a ${plan.name.toLowerCase()}`;
        state.speechBubble = 'Measure twice, cut once.';
        renderAllUI();
        await waitForArrival(60000);
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        // Saw, then fix, then finish: the piece takes shape on the bench
        // Big builds (a treehouse platform) are put together in sections that fit on the bench
        wip = finishBuildModel(lifeSize(realSize(plan.build()), 2.8), plan, { fromLogs });
        wip.position.set(bench.x, getIslandGroundHeight(bench.x, bench.z) + 0.8, bench.z - 1.4);
        scene.add(wip);
        const steps = [['Sawing the pieces to length', 'Zzzt, zzzt, zzzt...'], ['Putting it together', 'Tap, tap... it holds!'], ['Finishing it off', 'Smooth edges, square corners.']];
        // His own logs have to become boards first: rip them along the grain into rough planks
        if (fromLogs) steps.unshift(['Sawing logs into rough boards', 'Rip... rip... my own logs, turning into planks!']);
        const full = wip.scale.x;
        wip.visible = !fromLogs;
        let logStack = null;
        for (let i = 0; i < steps.length; i++) {
          state.moodTitle = steps[i][0];
          state.speechBubble = steps[i][1];
          const stage = fromLogs ? i - 1 : i;
          state.proceduralMotion = { ...(state.proceduralMotion || {}), sparkBurst: stage === 1 && Boolean(plan.welded) };
          if (stage < 0) {
            // The log stack on the bench while he saws it up
            logStack = lifeSize(firewoodModel());
            logStack.position.set(bench.x, getIslandGroundHeight(bench.x, bench.z) + 0.8, bench.z - 1.4);
            scene.add(logStack);
          } else {
            if (logStack) { scene.remove(logStack); logStack = null; }
            wip.visible = true;
            wip.scale.setScalar(full * (0.4 + 0.3 * stage));
          }
          renderAllUI();
          await new Promise(r => setTimeout(r, 2200));
        }
        if (logStack) scene.remove(logStack);
        scene.remove(wip);
        wip = null;
        // The materials are used up: one of each (one stack of logs for each lot of lumber they stood in
        // for), plus a squeeze of glue if he has some (js/itemuse.js)
        alloc.forEach(a => {
          if (!a.item) return;
          if (!a.fromLogs && typeof useUpItem === 'function') useUpItem(a.item, 1, { why: `on the ${plan.name.toLowerCase()}` });
          else if (typeof forgetItem === 'function') forgetItem(a.item);
        });
        const glue = typeof itemKindOf === 'function' ? ownedItemNames().find(n => itemKindOf(n).kind === 'glue') : null;
        if (glue) useUpItem(glue, 1, { why: `on the ${plan.name.toLowerCase()}` });
        // Carry it out and set it down
        const spot = buildSpot(plan);
        if (typeof setCarriedObject === 'function') setCarriedObject(finishBuildModel(lifeSize(realSize(plan.build()), 1.4), plan, { fromLogs }));
        state.currentLocKey = 'custom';
        state.customPlaceName = `a spot for the ${plan.name.toLowerCase()}`;
        state.targetPos = { x: spot.x - (plan.r || 0) - 1.3, z: spot.z };
        state.moodTitle = `Carrying the ${plan.name.toLowerCase()} out`;
        renderAllUI();
        await waitForArrival(60000);
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        Object.assign(p, { status: 'built', builtAt: Date.now(), x: spot.x, z: spot.z, rotY: Math.round(randRange(-0.6, 0.6) * 100) / 100 });
        if (spot.treeId) p.treeId = spot.treeId;
        if (fromLogs) p.fromLogs = true;
        // A kayak rack faces the water
        if (plan.beach) p.rotY = Math.round(randRange(-0.2, 0.2) * 100) / 100;
        placeProjectMesh(p);
        if (typeof bumpLifeStat === 'function') bumpLifeStat('builds');
        state.happiness = Math.min(100, state.happiness + 12);
        state.wonderLevel = Math.min(100, state.wonderLevel + 6);
        state.moodEmoji = plan.emoji;
        state.moodTitle = `Built a real ${plan.name.toLowerCase()}!`;
        state.speechBubble = fromLogs ? `I built a real ${plan.name.toLowerCase()} from the logs of a tree I chopped. Rough boards, but they're mine!`
          : `I built a real ${plan.name.toLowerCase()} from real materials. It's not a sculpture: it actually works!`;
        state.changedLatelySummary = `Built a ${plan.name.toLowerCase()} and set it out in the valley`;
        state.diaryEntries.unshift({
          time: originLabel, location: currentPlaceLabel(), mood: `${plan.emoji} Built a ${plan.name.toLowerCase()}`,
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, everything for the ${plan.name.toLowerCase()} arrived, so I built it at the bench and set it out ${spot.treeId ? 'in a big old tree' : plan.beach ? 'on the beach' : 'in the valley'}. I used up ${usedUpText(alloc)}.${fromLogs ? ' The wood came from a tree I chopped myself, which makes it feel even more mine.' : ''} It's something real that does a real job.`
        });
        showToast(`${plan.emoji} Kelo-1 built a ${plan.name.toLowerCase()}!`);
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        if (wip) scene.remove(wip); // half-built piece left on the bench if something went wrong
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.isPracticing = false;
      }
    }

// Now and then he goes looking for something real to build (only one project at a time)
function projectChance() {
      if (activeProject()) return 0;
      // A pile of his own firewood logs gets him thinking about what he could make from them
      if (ownedItemNames().some(isLumberStock)) return 0.07;
      return state.projects.length ? 0.03 : 0.05;
    }

function pickNewProject() {
      const done = new Set(state.projects.map(p => p.key));
      let fresh = BUILD_PLANS.filter(p => !done.has(p.key));
      if (!fresh.length) fresh = BUILD_PLANS;
      // With logs to use up, a wooden build is more tempting
      const wooden = fresh.filter(p => p.materials.some(m => m.lumber));
      if (ownedItemNames().some(isLumberStock) && wooden.length && Math.random() < 0.75) fresh = wooden;
      // A treehouse needs a standing tree to go in
      if (typeof valleyTrees !== 'undefined' && !valleyTrees.some(t => !t.removed && !t.hosting)) fresh = fresh.filter(p => !p.inTree);
      return (fresh.length ? pick(fresh) : pick(BUILD_PLANS)).key;
    }

// Reading at NetNode can spark a project when an article is about one of these things
function maybeProjectFromReading(text) {
      if (activeProject()) return;
      const plan = BUILD_PLANS.find(p => (p.reads || new RegExp(p.name.split(' ').slice(-1)[0], 'i')).test(String(text || '')));
      if (plan && Math.random() < 0.5) doWhenFree(() => startProject(plan.key, 'Read About It Online'));
    }

function projectsSummaryForAI() {
      const cur = activeProject();
      const built = state.projects.filter(p => p.status === 'built').map(p => planFor(p.key)?.name.toLowerCase()).filter(Boolean);
      const parts = [];
      if (cur) {
        const plan = planFor(cur.key), miss = missingFor(plan);
        parts.push(`building a ${plan.name.toLowerCase()}, still waiting for ${[...miss.materials.map(m => m.ask.toLowerCase()), ...miss.tools.map(t => BUILD_TOOLS[t].ask.toLowerCase())].join(', ') || 'nothing'}`);
      }
      if (built.length) parts.push(`already built: ${built.join(', ')}`);
      parts.push(`real things you know how to build: ${BUILD_PLANS.map(p => p.key).join(', ')} (a treehouse goes up in a standing tree, a kayak rack on the beach)`);
      const logs = ownedItemNames().filter(isLumberStock).length;
      parts.push(logs ? `you have ${logs} stack${logs === 1 ? '' : 's'} of firewood logs from chopped trees; with a saw they can stand in for the lumber in any wooden build` : 'firewood logs from trees you chop with an axe can stand in for lumber in wooden builds');
      return parts.join('; ');
    }

function renderProjectsList() {
      const el = document.getElementById('projectsListContainer');
      if (!el) return;
      const owned = ownedItemNames();
      el.innerHTML = state.projects.slice(0, 8).map(p => {
        const plan = planFor(p.key);
        if (!plan) return '';
        const checks = p.status === 'built' ? '' : [...allocateMaterials(plan).map(a => [a.fromLogs ? `${a.m.ask} (from his logs)` : a.m.ask, Boolean(a.item)]), ...plan.tools.map(t => [BUILD_TOOLS[t].ask, owned.some(n => BUILD_TOOLS[t].re.test(n))])]
          .map(([label, have]) => `<span class="px-1.5 py-0.5 rounded-md ${have ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-400'}">${have ? '✓' : '○'} ${escapeHtml(label)}</span>`).join(' ');
        return `<div class="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-200 space-y-1">
          <div class="font-semibold">${escapeHtml(plan.emoji)} ${escapeHtml(plan.name)} <span class="text-slate-500 font-normal">${p.status === 'built' ? `· built${p.fromLogs ? ' from his own logs' : ''}` : '· gathering materials'}</span></div>
          ${checks ? `<div class="flex flex-wrap gap-1">${checks}</div>` : ''}
        </div>`;
      }).join('');
    }

// Real materials for a finished build: the parts tagged with a finish get it, the rest are worked out
// from their colours and what the plan is made of (cedar boards, copper pipes...)
// Boards he ripped from his own logs are rough-sawn: a little greyer, duller and more uneven.
function finishBuildModel(m, plan, opts = {}) {
      if (typeof applyFinish !== 'function') return m;
      m.traverse(o => { if (o.isMesh && o.userData.finish) finishMaterial(o.material, o.userData.finish, { texture: /wood/.test(o.userData.finish) ? woodTextureFor(o.geometry) : undefined }); });
      const words = plan.materials.map(x => (opts.fromLogs && x.lumber ? 'rough-sawn pine' : x.ask)).join(' ');
      applyMaterialLook(m, `${words} ${plan.name}`);
      // Wood from the same stack still differs a little board to board
      let n = 0;
      const rough = new THREE.Color(0x9a7b55);
      m.traverse(o => {
        if (!o.isMesh || !o.material.userData.material || MATERIALS[o.material.userData.material].family !== 'wood') return;
        if (opts.fromLogs) {
          o.material.color.lerp(rough, 0.35);
          o.material.roughness = Math.min(1, o.material.roughness + 0.12);
        }
        varyColor(o.material.color, n++, opts.fromLogs ? 0.09 : 0.04);
      });
      return m;
    }

// --- Models of the finished builds (real size, metres) --------------------------------------------
function birdhouseModel() {
      const wood = 0xc8955a, roof = 0x9a3412;
      const house = group(
        at(mesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), wood), 0, 0.1, 0),
        withFinish(at(mesh(new THREE.CircleGeometry(0.025, 14), 0x1f2937, { roughness: 1 }), 0, 0.13, 0.081), 'soil'),
        rod([0, 0.08, 0.08], [0, 0.08, 0.13], 0.005, 0x8a5a2b)
      );
      [-1, 1].forEach(s => {
        const panel = withFinish(at(mesh(new THREE.BoxGeometry(0.13, 0.012, 0.22), roof), s * 0.055, 0.235, 0), 'paintedwood');
        panel.rotation.z = -s * 0.7;
        house.add(panel);
      });
      return group(at(mesh(new THREE.BoxGeometry(0.06, 1.5, 0.06), 0x8a5a2b), 0, 0.75, 0), at(house, 0, 1.5, 0));
    }

function picnicTableModel() {
      const wood = 0xb7793e, dark = 0x8a5a2b;
      const g = group();
      for (let i = 0; i < 5; i++) g.add(at(mesh(new THREE.BoxGeometry(1.8, 0.04, 0.14), wood), 0, 0.75, -0.3 + i * 0.15));
      [-1, 1].forEach(s => {
        for (let i = 0; i < 2; i++) g.add(at(mesh(new THREE.BoxGeometry(1.8, 0.04, 0.13), wood), 0, 0.45, s * (0.62 + i * 0.14)));
        [-0.7, 0.7].forEach(x => {
          g.add(rod([x, 0, s * 0.85], [x, 0.74, s * 0.12], 0.035, dark));
          g.add(at(mesh(new THREE.BoxGeometry(0.06, 0.06, 1.9), dark), x, 0.42, 0));
        });
      });
      return g;
    }

function gardenBenchModel() {
      const wood = 0x9a6b3f, metal = 0x1f2937;
      const g = group();
      for (let i = 0; i < 4; i++) g.add(at(mesh(new THREE.BoxGeometry(1.5, 0.035, 0.1), wood), 0, 0.45, -0.18 + i * 0.12));
      for (let i = 0; i < 3; i++) {
        const back = at(mesh(new THREE.BoxGeometry(1.5, 0.09, 0.03), wood), 0, 0.6 + i * 0.13, -0.27 - i * 0.025);
        back.rotation.x = -0.2;
        g.add(back);
      }
      [-0.7, 0.7].forEach(x => {
        g.add(withFinish(slab([[-0.25, 0], [-0.22, 0.45], [-0.3, 0.9], [-0.26, 0.9], [-0.18, 0.45], [0.2, 0.45], [0.22, 0.62], [0.26, 0.62], [0.25, 0.42], [0.25, 0], [0.2, 0], [0.2, 0.4], [-0.2, 0.4], [-0.2, 0]], 0.05, metal, { metalness: 0.6, roughness: 0.4 }), 'iron'));
        g.children[g.children.length - 1].rotation.y = Math.PI / 2;
        g.children[g.children.length - 1].position.x = x;
      });
      return g;
    }

function raisedBedModel() {
      const wood = 0xc8955a;
      const g = group(withFinish(at(mesh(new THREE.BoxGeometry(1.16, 0.26, 0.56), 0x5a3a20, { roughness: 1 }), 0, 0.14, 0), 'soil'));
      [-1, 1].forEach(s => {
        g.add(at(mesh(new THREE.BoxGeometry(1.24, 0.3, 0.04), wood), 0, 0.15, s * 0.3));
        g.add(at(mesh(new THREE.BoxGeometry(0.04, 0.3, 0.6), wood), s * 0.6, 0.15, 0));
      });
      for (let i = 0; i < 6; i++) {
        const sprout = withFinish(at(mesh(new THREE.ConeGeometry(0.04, 0.12, 5), 0x22c55e), -0.45 + i * 0.18, 0.33, (i % 2 ? 0.1 : -0.1)), 'leaf');
        g.add(sprout);
      }
      return g;
    }

function birdFeederModel() {
      const wood = 0xc8955a;
      const feeder = group(
        at(mesh(new THREE.BoxGeometry(0.3, 0.02, 0.3), wood), 0, 0, 0),
        withFinish(at(mesh(new THREE.BoxGeometry(0.22, 0.03, 0.22), 0xd9a441), 0, 0.02, 0), 'seed')
      );
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => feeder.add(rod([a * 0.13, 0, b * 0.13], [a * 0.13, 0.18, b * 0.13], 0.008, wood)));
      [-1, 1].forEach(s => {
        const panel = withFinish(at(mesh(new THREE.BoxGeometry(0.2, 0.012, 0.36), 0x15803d), s * 0.085, 0.23, 0), 'paintedwood');
        panel.rotation.z = -s * 0.55;
        feeder.add(panel);
      });
      return group(at(mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.6, 8), 0x8a5a2b), 0, 0.8, 0), at(feeder, 0, 1.6, 0));
    }

function windChimeModel() {
      const g = group();
      // A shepherd's-hook stand with the chime hanging from the hook
      g.add(withFinish(rod([0, 0, 0], [0, 1.8, 0], 0.012, 0x1f2937, { metalness: 0.6 }), 'iron'));
      g.add(withFinish(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.6 })), 'iron'));
      g.children[1].position.set(0.12, 1.8, 0);
      const chime = group(at(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.015, 16), 0xa16207), 0, 0, 0));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2, len = 0.25 + i * 0.05;
        chime.add(rod([Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05], [Math.cos(a) * 0.05, -0.06, Math.sin(a) * 0.05], 0.002, 0xe2e8f0));
        chime.add(at(mesh(new THREE.CylinderGeometry(0.008, 0.008, len, 10), 0xc2773a, { metalness: 0.85, roughness: 0.25 }), Math.cos(a) * 0.05, -0.06 - len / 2, Math.sin(a) * 0.05));
      }
      g.add(at(chime, 0.24, 1.62, 0));
      g.add(rod([0.24, 1.8, 0], [0.24, 1.63, 0], 0.002, 0xe2e8f0));
      return g;
    }

// A doghouse: a raised floor on skids, red lap siding, a gable roof of asphalt shingles with an
// arched door in the front, white corner trim, and a steel water bowl by the door
function doghouseModel() {
      const paint = 0xa3201c, trim = 0xf5f5f4, shingle = 0x3f3f46, frame = 0xb7793e;
      const W = 0.8, D = 1.0, wallH = 0.55, rise = 0.3, base = 0.09;
      const g = group();
      // Two pressure-treated skids and the plywood floor
      [-0.28, 0.28].forEach(x => g.add(at(mesh(new THREE.BoxGeometry(0.07, 0.06, D + 0.04), 0x7c5a3a), x, 0.03, 0)));
      g.add(at(mesh(new THREE.BoxGeometry(W + 0.04, 0.03, D + 0.04), frame), 0, 0.075, 0));
      // Side walls: five lapped boards each, every board tipped out a little at the bottom
      [-1, 1].forEach(s => {
        for (let i = 0; i < 5; i++) {
          const board = withFinish(at(mesh(new THREE.BoxGeometry(0.018, 0.125, D), paint), s * (W / 2 + 0.006), base + 0.06 + i * 0.11, 0), 'paintedwood');
          board.rotation.z = s * 0.06;
          g.add(board);
        }
      });
      // Gable ends: the front one has the arched doorway cut out of it
      const gable = [[-W / 2, 0], [W / 2, 0], [W / 2, wallH], [0, wallH + rise], [-W / 2, wallH]];
      const door = new THREE.Path();
      door.moveTo(-0.16, 0.03); door.lineTo(0.16, 0.03); door.lineTo(0.16, 0.3);
      door.absarc(0, 0.3, 0.16, 0, Math.PI, false);
      door.lineTo(-0.16, 0.03);
      g.add(at(withFinish(slab(gable, 0.02, paint, {}, [door]), 'paintedwood'), 0, base, D / 2));
      g.add(at(withFinish(slab(gable, 0.02, paint), 'paintedwood'), 0, base, -D / 2));
      // White trim round the doorway and up the corners
      const arch = withFinish(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 20, Math.PI), new THREE.MeshStandardMaterial({ color: trim })), 'paintedwood');
      g.add(at(arch, 0, base + 0.3, D / 2 + 0.012));
      [-0.17, 0.17].forEach(x => g.add(withFinish(at(mesh(new THREE.BoxGeometry(0.024, 0.27, 0.012), trim), x, base + 0.165, D / 2 + 0.012), 'paintedwood')));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => g.add(withFinish(at(mesh(new THREE.BoxGeometry(0.035, wallH, 0.035), trim), a * (W / 2 + 0.008), base + wallH / 2, b * (D / 2 + 0.002)), 'paintedwood')));
      // The roof: a sheathing panel each side with rows of shingles stepped down it, and a ridge cap
      const slope = Math.atan2(rise, W / 2), L = (W / 2 + 0.08) / Math.cos(slope), ridgeY = base + wallH + rise + 0.02;
      [-1, 1].forEach(s => {
        const side = group(at(mesh(new THREE.BoxGeometry(L, 0.016, D + 0.14), frame), 0, 0, 0));
        for (let r = 0; r < 5; r++) {
          const row = withFinish(at(mesh(new THREE.BoxGeometry(L / 5 + 0.03, 0.012, D + 0.16), shingle, { roughness: 0.95 }), -L / 2 + L / 10 + r * L / 5, 0.012 + r * 0.002, 0), 'gravel');
          row.rotation.z = -0.03;
          side.add(row);
        }
        side.position.set(s * (L / 2) * Math.cos(slope), ridgeY - (L / 2) * Math.sin(slope), 0);
        side.rotation.z = -s * slope;
        g.add(side);
      });
      g.add(withFinish(at(mesh(new THREE.BoxGeometry(0.07, 0.03, D + 0.16), shingle, { roughness: 0.95 }), 0, ridgeY + 0.012, 0), 'gravel'));
      // A steel water bowl by the door
      const bowl = new THREE.LatheGeometry([[0, 0], [0.08, 0], [0.1, 0.05], [0.095, 0.05], [0.075, 0.008], [0, 0.008]].map(([r, y]) => new THREE.Vector2(r, y)), 20);
      g.add(withFinish(at(mesh(bowl, 0xcbd5e1, { metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide }), 0.3, 0, D / 2 + 0.22), 'steel'));
      g.add(at(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.004, 18), 0x60a5fa, { roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.7 }), 0.3, 0.035, D / 2 + 0.22));
      return g;
    }

// A free-standing two-tier kayak rack: two narrow end towers of 4x4 posts on long feet, joined by
// rails, with arms cantilevered out both sides (a kayak rests on each pair), padded in black foam
// pipe insulation and with a small lip at the tip so a hull can't slide off
function kayakRackModel() {
      const wood = 0xa9865b, foam = 0x18181b, bolt = 0x9ca3af;
      const span = 1.6, gap = 0.15, reach = 0.62, H = 1.5;
      const g = group();
      // A 4x4 (or 2x6) laid from point a to point b
      const beam = (a, b, w, d) => {
        const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), dir = to.clone().sub(from);
        const m = mesh(new THREE.BoxGeometry(w, dir.length(), d), wood);
        m.position.copy(from).add(to).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        return m;
      };
      [-1, 1].forEach(e => {
        const x = e * span / 2;
        g.add(at(mesh(new THREE.BoxGeometry(0.09, 0.09, 2 * (gap + reach) - 0.1), wood), x, 0.045, 0)); // the long foot
        [-1, 1].forEach(s => {
          g.add(at(mesh(new THREE.BoxGeometry(0.09, H, 0.09), wood), x, H / 2 + 0.09, s * gap)); // post
          g.add(beam([x, 0.09, s * (gap + 0.42)], [x, 0.62, s * (gap + 0.04)], 0.06, 0.06)); // brace from the foot up to the post
          // Two tiers of arms reaching out, tipped up slightly, padded, with a lip and a bolt through the post
          [0.68, 1.26].forEach(y => {
            g.add(beam([x, y, s * (gap - 0.05)], [x, y + 0.05, s * (gap + reach)], 0.045, 0.14));
            const pad = rod([x, y + 0.085, s * (gap + 0.1)], [x, y + 0.115, s * (gap + reach - 0.06)], 0.04, foam, { roughness: 0.95 });
            g.add(pad);
            g.add(at(mesh(new THREE.BoxGeometry(0.045, 0.12, 0.04), wood), x, y + 0.13, s * (gap + reach - 0.02)));
            const head = at(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 10), bolt, { metalness: 0.8 }), x + 0.05, y, s * gap);
            head.rotation.z = Math.PI / 2;
            g.add(withFinish(head, 'steel'));
          });
        });
        // A board across the two posts at the top caps each tower
        g.add(at(mesh(new THREE.BoxGeometry(0.09, 0.14, 2 * gap + 0.09), wood), x, H + 0.02, 0));
      });
      // Rails along the length tie the two towers together, low and high
      [0.32, H - 0.1].forEach(y => [-1, 1].forEach(s => g.add(at(mesh(new THREE.BoxGeometry(span + 0.09, 0.09, 0.045), wood), 0, y, s * (gap - 0.068)))));
      return g;
    }

// A treehouse platform round the trunk of a big tree (the trunk is at the middle): four posts with
// knee braces, two beams, joists, a deck with the trunk coming up through an opening, a railing
// with rope strung between the posts, and a ladder up one side
function treehousePlatformModel() {
      const wood = 0xb08a5c, deck = 0xc89a64, post = 0x8f6b45, rope = 0xd6c39a;
      const half = 1.0, deckY = 1.2, railH = 0.95, hole = 0.5;
      const g = group();
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      corners.forEach(([a, b]) => {
        g.add(at(mesh(new THREE.BoxGeometry(0.1, deckY + railH, 0.1), post), a * (half - 0.05), (deckY + railH) / 2, b * (half - 0.05)));
        g.add(withFinish(at(mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.12, 12), 0x9ca3af, { roughness: 0.9 }), a * (half - 0.05), 0.04, b * (half - 0.05)), 'stone')); // concrete footing
        // Knee brace from the post up to the beam
        g.add(rod([a * (half - 0.05), deckY - 0.55, b * (half - 0.05)], [a * (half - 0.45), deckY - 0.12, b * (half - 0.05)], 0.03, post));
      });
      // Beams run along x under each edge, joists across them (stopping short of the trunk)
      [-1, 1].forEach(b => g.add(at(mesh(new THREE.BoxGeometry(2 * half, 0.19, 0.08), wood), 0, deckY - 0.12, b * (half - 0.05))));
      for (let x = -half + 0.1; x <= half - 0.09; x += 0.4) {
        if (Math.abs(x) < hole + 0.05) {
          [-1, 1].forEach(b => g.add(at(mesh(new THREE.BoxGeometry(0.045, 0.19, half - hole - 0.05), wood), x, deckY - 0.12, b * (hole + (half - hole - 0.05) / 2))));
        } else g.add(at(mesh(new THREE.BoxGeometry(0.045, 0.19, 2 * half - 0.1), wood), x, deckY - 0.12, 0));
      }
      // Decking boards with small gaps, cut around the trunk
      for (let z = -half + 0.07; z < half; z += 0.145) {
        const y = deckY - 0.01, k = Math.round((z + half) / 0.145);
        if (Math.abs(z) < hole) {
          [-1, 1].forEach(s => {
            const len = half - hole;
            g.add(withFinish(at(mesh(new THREE.BoxGeometry(len, 0.03, 0.13), deck), s * (hole + len / 2), y, z), 'wood'));
          });
        } else {
          const board = withFinish(at(mesh(new THREE.BoxGeometry(2 * half + 0.06, 0.03, 0.13), deck), 0, y, z), 'wood');
          board.rotation.y = (k % 3 - 1) * 0.004;
          g.add(board);
        }
      }
      // Railing: a top rail all round except the ladder gap, and two strands of rope below it
      const top = deckY + railH;
      corners.forEach(([a, b], i) => {
        const [c, d] = corners[(i + 1) % 4];
        const from = [a * (half - 0.05), top, b * (half - 0.05)], to = [c * (half - 0.05), top, d * (half - 0.05)];
        const ladderSide = b === 1 && d === 1; // the +z edge
        if (ladderSide) {
          // Leave a gap in the middle for the ladder
          [[from, [-0.3, top, half - 0.05]], [[0.3, top, half - 0.05], to]].forEach(([p, q]) => {
            g.add(rod(p, q, 0.035, wood));
            [0.35, 0.65].forEach(f => g.add(rod([p[0], deckY + railH * f, p[2]], [q[0], deckY + railH * f, q[2]], 0.012, rope)));
          });
          [-0.3, 0.3].forEach(x => g.add(at(mesh(new THREE.BoxGeometry(0.08, railH, 0.08), post), x, deckY + railH / 2, half - 0.05)));
        } else {
          g.add(rod(from, to, 0.035, wood));
          [0.35, 0.65].forEach(f => g.add(rod([from[0], deckY + railH * f, from[2]], [to[0], deckY + railH * f, to[2]], 0.012, rope)));
        }
      });
      // A wooden ladder leaning up to the gap
      const foot = half + 0.55;
      [-0.22, 0.22].forEach(x => g.add(rod([x, 0, foot], [x, deckY + 0.35, half - 0.02], 0.03, post)));
      for (let i = 1; i <= 5; i++) {
        const f = i / 6.3, z = foot + (half - 0.02 - foot) * f, y = (deckY + 0.35) * f;
        g.add(rod([-0.22, y, z], [0.22, y, z], 0.02, wood));
      }
      return g;
    }

// A stack of firewood logs: bark round the outside, growth rings on the sawn ends (metres)
function firewoodModel() {
      const g = group();
      const real = typeof finishMaterial === 'function';
      const bark = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.95 });
      const ends = new THREE.MeshStandardMaterial({ color: 0xd9b07a, roughness: 0.85 });
      if (real) { finishMaterial(bark, 'bark'); finishMaterial(ends, 'rings'); }
      const rows = [[-0.13, 0, 0.13], [-0.065, 0.065], [0]];
      rows.forEach((row, r) => row.forEach((z, i) => {
        const rad = 0.06 + ((r * 3 + i) % 3) * 0.006;
        const log = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.04, 0.42, 12), [bark, ends, ends]);
        log.rotation.z = Math.PI / 2;
        log.rotation.x = ((r + i) % 2 ? 0.05 : -0.04);
        log.position.set(((r + i) % 2 ? 0.015 : -0.01), 0.062 + r * 0.108, z);
        log.castShadow = true;
        g.add(log);
      }));
      return realSize(g);
    }

// A project still waiting for things is not forgotten: every 20 minutes he checks what is missing, asks
// again for anything that has no open request (a request can be answered, trimmed or lost), and now and
// then says out loud what he is waiting for so it stays on his mind and in his diary.
function projectNudge(p, plan) {
      const now = Date.now();
      if (now - (p.nudgedAt || p.startedAt || 0) < 20 * 60 * 1000) return;
      p.nudgedAt = now;
      const miss = missingFor(plan);
      const wants = [...miss.materials.map(m => m.ask), ...miss.tools.map(t => BUILD_TOOLS[t].ask)];
      if (!wants.length) return;
      const before = state.requestsToUser.length;
      requestMissing(plan);
      const asked = state.requestsToUser.length > before;
      if (!asked && now - (p.remindedAt || 0) < 2 * 60 * 60 * 1000) return;
      p.remindedAt = now;
      const list = wants.map(w => w.replace(/^(an?|some|the)\s+/i, '').toLowerCase()).slice(0, 4).join(', ');
      if (!(state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping)) {
        state.speechBubble = `I haven't forgotten my ${plan.name.toLowerCase()}. I'm still waiting for ${list}.`;
        renderAllUI();
      }
      state.diaryEntries.unshift({
        time: 'Still Planning', location: currentPlaceLabel(), mood: `${plan.emoji} Waiting to build a ${plan.name.toLowerCase()}`,
        vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, my ${plan.name.toLowerCase()} is still on my mind. I'm waiting for ${list}.${asked ? ' I asked for it again in case my letter got lost.' : ''}`
      });
      savePersistentBrainState();
    }

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    state.projects.filter(p => p.status === 'built').forEach(placeProjectMesh);
    renderProjectsList();
    // Once everything for the current project has arrived, he gets building
    setInterval(() => {
      renderProjectsList();
      const p = activeProject();
      const plan = p && planFor(p.key);
      if (plan) projectNudge(p, plan);
      // doWhenFree gives up after about 3 minutes, so an older entry is queued again
      if (plan && Date.now() - (buildsQueued.get(p.id) || 0) > 240000) {
        const miss = missingFor(plan);
        if (!miss.materials.length && !miss.tools.length) {
          buildsQueued.set(p.id, Date.now());
          doWhenFree(async () => {
            try { await buildProject(p.id); } finally { buildsQueued.delete(p.id); }
          });
        }
      }
    }, 8000);
  }, 500);
});
