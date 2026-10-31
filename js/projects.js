// Kelo-bot-1 — js/projects.js
// Loaded after landscape.js. Real builds: Kelo-1 comes across a real thing online (a birdhouse, a
// picnic table...), reads how it's made, and asks visitors for exactly the materials and tools it
// takes. When everything has arrived he builds it at the welding table, using the materials up,
// and sets the finished piece out in the valley at its real size.

const BUILD_PLANS = [
  { key: 'birdhouse', name: 'Birdhouse', wiki: 'Nest box', emoji: '🐦',
    materials: [{ ask: 'Cedar boards', re: /cedar|board|plank|lumber|timber/i }, { ask: 'A box of nails', re: /nail/i }],
    tools: ['hammer', 'saw'], build: () => birdhouseModel() },
  { key: 'picnic', name: 'Picnic table', wiki: 'Picnic table', emoji: '🧺',
    materials: [{ ask: 'Pine planks', re: /plank|board|lumber|timber/i }, { ask: 'A box of wood screws', re: /screw/i }],
    tools: ['saw', 'drill'], build: () => picnicTableModel() },
  { key: 'bench', name: 'Garden bench', wiki: 'Bench (furniture)', emoji: '🪑',
    materials: [{ ask: 'Oak planks', re: /plank|board|lumber|timber/i }, { ask: 'A box of wood screws', re: /screw/i }, { ask: 'A tin of wood stain', re: /stain|varnish|wood oil/i }],
    tools: ['saw', 'drill'], build: () => gardenBenchModel() },
  { key: 'raisedbed', name: 'Raised garden bed', wiki: 'Raised-bed gardening', emoji: '🥕',
    materials: [{ ask: 'Cedar boards', re: /cedar|board|plank|lumber|timber/i }, { ask: 'Bags of garden soil', re: /soil|compost/i }, { ask: 'A box of nails', re: /nail/i }],
    tools: ['hammer', 'saw'], build: () => raisedBedModel() },
  { key: 'feeder', name: 'Bird feeder', wiki: 'Bird feeder', emoji: '🌻',
    materials: [{ ask: 'Cedar boards', re: /cedar|board|plank|lumber|timber/i }, { ask: 'A bag of birdseed', re: /bird ?seed/i }],
    tools: ['saw', 'drill'], build: () => birdFeederModel() },
  { key: 'windchime', name: 'Wind chime', wiki: 'Wind chime', emoji: '🎐',
    materials: [{ ask: 'Copper pipes', re: /copper|pipe|tubing/i }, { ask: 'A spool of fishing line', re: /fishing line|string|cord|twine/i }],
    tools: ['saw'], build: () => windChimeModel() }
];

const BUILD_TOOLS = {
  hammer: { ask: 'A claw hammer', re: /^(?!.*jack ?hammer).*(hammer|mallet)/i },
  saw: { ask: 'A hand saw', re: /\bsaw\b|handsaw/i },
  drill: { ask: 'A cordless drill', re: /drill(?! bits?)/i }
};

const projectMeshes = {};
const buildsQueued = new Set(); // projects already waiting for him to be free

function ownedNames() {
      return [...state.toolInventory, ...state.toys.map(t => t.name), ...state.belongings.map(b => b.name)];
    }

function planFor(key) {
      return BUILD_PLANS.find(p => p.key === key) || null;
    }

function activeProject() {
      return state.projects.find(p => p.status === 'gathering') || null;
    }

// What is still missing for a plan: materials and tools he doesn't have yet
function missingFor(plan) {
      const owned = ownedNames();
      return {
        materials: plan.materials.filter(m => !owned.some(n => m.re.test(n))),
        tools: plan.tools.filter(t => !owned.some(n => BUILD_TOOLS[t].re.test(n)))
      };
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
        state.moodTitle = `Planning a ${plan.name.toLowerCase()}`;
        state.speechBubble = asked.length ? `To build it I need ${asked.join(', ')}. I've written letters asking for them.` : 'I already have everything it takes!';
        state.diaryEntries.unshift({
          time: originLabel, location: 'NetNode Cyber Cafe', mood: `${plan.emoji} Planning a ${plan.name.toLowerCase()}`,
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I read about ${article ? article.title.toLowerCase() : `${plan.name.toLowerCase()}s`} and decided to build a real one. It takes ${plan.materials.map(m => m.ask.toLowerCase()).join(', ')}, and I'll need a ${plan.tools.join(' and a ')}.${asked.length ? ` I asked for ${asked.join(', ')}.` : ''}`
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

// Somewhere open near home to set a finished build down
function buildSpot() {
      for (let i = 0; i < 40; i++) {
        // Out of town: west toward the Museum, or along the beach
        const beach = Math.random() < 0.3;
        const x = Math.round((beach ? randRange(-30, 30) : randRange(WORLD_MIN_X + 5, TOWN.minX - 2)) * 10) / 10, z = Math.round((beach ? randRange(8.0, 8.8) : randRange(-10, 6)) * 10) / 10;
        if (typeof offLimits === 'function' && offLimits(x, z, 1.2)) continue;
        if (pointBlocked(x, z, { x: 999, z: 999 }) || worldObstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 1.4)) continue;
        return { x, z };
      }
      return { x: -14, z: 4 };
    }

function placeProjectMesh(p) {
      const plan = planFor(p.key);
      if (!plan || projectMeshes[p.id] || !Number.isFinite(p.x)) return;
      const m = lifeSize(realSize(plan.build()));
      m.position.set(p.x, getIslandGroundHeight(p.x, p.z), p.z);
      m.rotation.y = p.rotY || 0;
      m.traverse(o => { if (o.isMesh) o.castShadow = true; });
      scene.add(m);
      projectMeshes[p.id] = m;
      const obstacle = { x: p.x, z: p.z, r: p.key === 'picnic' ? 1.6 : p.key === 'bench' || p.key === 'raisedbed' ? 1.2 : 0.6 };
      worldObstacles.push(obstacle);
      m.userData.obstacle = obstacle;
    }

async function buildProject(id, originLabel = 'Building Something Real') {
      const p = state.projects.find(q => q.id === id && q.status === 'gathering');
      const plan = p && planFor(p.key);
      if (!plan) return false;
      const miss = missingFor(plan);
      if (miss.materials.length || miss.tools.length) return false;
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isPracticing = true;
      try {
        // Pick the materials up from the Storehouse, then over to the bench
        const owned = ownedNames();
        const material = owned.find(n => plan.materials[0].re.test(n));
        if (typeof fetchFromStorehouse === 'function' && material) await fetchFromStorehouse(material);
        const bench = TOWN_LOCATIONS.weld;
        state.currentLocKey = 'weld';
        state.customPlaceName = null;
        state.targetPos = { x: bench.x, z: bench.z };
        state.moodEmoji = '🔨';
        state.moodTitle = `Building a ${plan.name.toLowerCase()}`;
        state.speechBubble = 'Measure twice, cut once.';
        renderAllUI();
        await waitForArrival(60000);
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        // Saw, then fix, then finish: the piece takes shape on the bench
        const wip = lifeSize(realSize(plan.build()));
        wip.position.set(bench.x, getIslandGroundHeight(bench.x, bench.z) + 0.8, bench.z - 1.4);
        scene.add(wip);
        const steps = [['Sawing the pieces to length', 'Zzzt, zzzt, zzzt...'], ['Putting it together', 'Tap, tap... it holds!'], ['Finishing it off', 'Smooth edges, square corners.']];
        const full = wip.scale.x;
        for (let i = 0; i < steps.length; i++) {
          state.moodTitle = steps[i][0];
          state.speechBubble = steps[i][1];
          state.proceduralMotion = { ...(state.proceduralMotion || {}), sparkBurst: i === 1 };
          wip.scale.setScalar(full * (0.4 + 0.3 * i));
          renderAllUI();
          await new Promise(r => setTimeout(r, 2200));
        }
        scene.remove(wip);
        // The materials are used up
        plan.materials.forEach(m => {
          const name = ownedNames().find(n => m.re.test(n));
          if (name && typeof forgetItem === 'function') forgetItem(name);
        });
        // Carry it out and set it down
        const spot = buildSpot();
        if (typeof setCarriedObject === 'function') setCarriedObject(lifeSize(realSize(plan.build()), 1.4));
        state.currentLocKey = 'custom';
        state.customPlaceName = `a spot for the ${plan.name.toLowerCase()}`;
        state.targetPos = { x: spot.x - 1.3, z: spot.z };
        state.moodTitle = `Carrying the ${plan.name.toLowerCase()} out`;
        renderAllUI();
        await waitForArrival(60000);
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        Object.assign(p, { status: 'built', builtAt: Date.now(), x: spot.x, z: spot.z, rotY: Math.round(randRange(-0.6, 0.6) * 100) / 100 });
        placeProjectMesh(p);
        if (typeof bumpLifeStat === 'function') bumpLifeStat('builds');
        state.happiness = Math.min(100, state.happiness + 12);
        state.wonderLevel = Math.min(100, state.wonderLevel + 6);
        state.moodEmoji = plan.emoji;
        state.moodTitle = `Built a real ${plan.name.toLowerCase()}!`;
        state.speechBubble = `I built a real ${plan.name.toLowerCase()} from real materials. It's not a sculpture: it actually works!`;
        state.changedLatelySummary = `Built a ${plan.name.toLowerCase()} and set it out in the valley`;
        state.diaryEntries.unshift({
          time: originLabel, location: currentPlaceLabel(), mood: `${plan.emoji} Built a ${plan.name.toLowerCase()}`,
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, everything for the ${plan.name.toLowerCase()} arrived, so I built it at the bench and set it out in the valley. I used up the ${plan.materials.map(m => m.ask.replace(/^(an?|the)\s+/i, '').toLowerCase()).join(' and the ')}. It's the first thing I've made that does a real job.`
        });
        showToast(`${plan.emoji} Kelo-1 built a ${plan.name.toLowerCase()}!`);
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.isPracticing = false;
      }
    }

// Now and then he goes looking for something real to build (only one project at a time)
function projectChance() {
      if (activeProject()) return 0;
      return state.projects.length ? 0.03 : 0.05;
    }

function pickNewProject() {
      const done = new Set(state.projects.map(p => p.key));
      const fresh = BUILD_PLANS.filter(p => !done.has(p.key));
      return (fresh.length ? pick(fresh) : pick(BUILD_PLANS)).key;
    }

// Reading at NetNode can spark a project when an article is about one of these things
function maybeProjectFromReading(text) {
      if (activeProject()) return;
      const plan = BUILD_PLANS.find(p => new RegExp(p.name.split(' ').slice(-1)[0], 'i').test(String(text || '')));
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
      parts.push(`real things you know how to build: ${BUILD_PLANS.map(p => p.key).join(', ')}`);
      return parts.join('; ');
    }

function renderProjectsList() {
      const el = document.getElementById('projectsListContainer');
      if (!el) return;
      const owned = ownedNames();
      el.innerHTML = state.projects.slice(0, 8).map(p => {
        const plan = planFor(p.key);
        if (!plan) return '';
        const checks = p.status === 'built' ? '' : [...plan.materials.map(m => [m.ask, owned.some(n => m.re.test(n))]), ...plan.tools.map(t => [BUILD_TOOLS[t].ask, owned.some(n => BUILD_TOOLS[t].re.test(n))])]
          .map(([label, have]) => `<span class="px-1.5 py-0.5 rounded-md ${have ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-400'}">${have ? '✓' : '○'} ${escapeHtml(label)}</span>`).join(' ');
        return `<div class="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-200 space-y-1">
          <div class="font-semibold">${escapeHtml(plan.emoji)} ${escapeHtml(plan.name)} <span class="text-slate-500 font-normal">${p.status === 'built' ? '· built' : '· gathering materials'}</span></div>
          ${checks ? `<div class="flex flex-wrap gap-1">${checks}</div>` : ''}
        </div>`;
      }).join('');
    }

// --- Models of the finished builds (real size, metres) --------------------------------------------
function birdhouseModel() {
      const wood = 0xc8955a, roof = 0x9a3412;
      const house = group(
        at(mesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), wood), 0, 0.1, 0),
        at(mesh(new THREE.CircleGeometry(0.025, 14), 0x1f2937), 0, 0.13, 0.081),
        rod([0, 0.08, 0.08], [0, 0.08, 0.13], 0.005, 0x8a5a2b)
      );
      [-1, 1].forEach(s => {
        const panel = at(mesh(new THREE.BoxGeometry(0.13, 0.012, 0.22), roof), s * 0.055, 0.235, 0);
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
        g.add(slab([[-0.25, 0], [-0.22, 0.45], [-0.3, 0.9], [-0.26, 0.9], [-0.18, 0.45], [0.2, 0.45], [0.22, 0.62], [0.26, 0.62], [0.25, 0.42], [0.25, 0], [0.2, 0], [0.2, 0.4], [-0.2, 0.4], [-0.2, 0]], 0.05, metal, { metalness: 0.6, roughness: 0.4 }));
        g.children[g.children.length - 1].rotation.y = Math.PI / 2;
        g.children[g.children.length - 1].position.x = x;
      });
      return g;
    }

function raisedBedModel() {
      const wood = 0xc8955a;
      const g = group(at(mesh(new THREE.BoxGeometry(1.16, 0.26, 0.56), 0x4a2c17, { roughness: 1 }), 0, 0.14, 0));
      [-1, 1].forEach(s => {
        g.add(at(mesh(new THREE.BoxGeometry(1.24, 0.3, 0.04), wood), 0, 0.15, s * 0.3));
        g.add(at(mesh(new THREE.BoxGeometry(0.04, 0.3, 0.6), wood), s * 0.6, 0.15, 0));
      });
      for (let i = 0; i < 6; i++) {
        const sprout = at(mesh(new THREE.ConeGeometry(0.04, 0.12, 5), 0x22c55e), -0.45 + i * 0.18, 0.33, (i % 2 ? 0.1 : -0.1));
        g.add(sprout);
      }
      return g;
    }

function birdFeederModel() {
      const wood = 0xc8955a;
      const feeder = group(
        at(mesh(new THREE.BoxGeometry(0.3, 0.02, 0.3), wood), 0, 0, 0),
        at(mesh(new THREE.BoxGeometry(0.22, 0.03, 0.22), 0xd9a441), 0, 0.02, 0)
      );
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => feeder.add(rod([a * 0.13, 0, b * 0.13], [a * 0.13, 0.18, b * 0.13], 0.008, wood)));
      [-1, 1].forEach(s => {
        const panel = at(mesh(new THREE.BoxGeometry(0.2, 0.012, 0.36), 0x15803d), s * 0.085, 0.23, 0);
        panel.rotation.z = -s * 0.55;
        feeder.add(panel);
      });
      return group(at(mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.6, 8), 0x8a5a2b), 0, 0.8, 0), at(feeder, 0, 1.6, 0));
    }

function windChimeModel() {
      const g = group();
      // A shepherd's-hook stand with the chime hanging from the hook
      g.add(rod([0, 0, 0], [0, 1.8, 0], 0.012, 0x1f2937, { metalness: 0.6 }));
      g.add(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.6 })));
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

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    state.projects.filter(p => p.status === 'built').forEach(placeProjectMesh);
    renderProjectsList();
    // Once everything for the current project has arrived, he gets building
    setInterval(() => {
      renderProjectsList();
      const p = activeProject();
      if (p && !buildsQueued.has(p.id)) {
        const miss = missingFor(planFor(p.key));
        if (!miss.materials.length && !miss.tools.length) {
          buildsQueued.add(p.id);
          doWhenFree(async () => { await buildProject(p.id); buildsQueued.delete(p.id); });
        }
      }
    }, 8000);
  }, 500);
});
