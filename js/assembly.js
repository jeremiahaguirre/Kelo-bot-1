// Kelo-bot-1 — js/assembly.js
// Loaded after buildmodels.js. Building anything from scratch, the real way:
//   1. He decides on a target (an airplane, a go-kart, a canoe, a shed...) and researches it at
//      NetNode. That gives him a bill of materials down to the screw (js/bom.js), the tools and the
//      skills it takes.
//   2. He asks his human for LISTS: one Post-tab card per sub-assembly with every part and its
//      quantity, checkboxes to send some or all of it, and copy-as-text / Markdown buttons for a
//      shopping list. What is sent arrives at the Post Office as a parts kit and is counted against
//      the BOM, line by line.
//   3. Once a sub-assembly's parts and tools are all here, he builds it step by step (cut, drill,
//      rivet, bolt, weld, cover, paint, wire, inspect) at the build site with the right tool in his
//      hands, while the 3D model grows part by part. Fasteners are counted down and consumables used.
//   4. Real inspections and tests at the end (weight and balance and an engine run-up for the
//      airplane). Vehicles join his fleet (js/vehicles.js); the airplane flies only once it has passed
//      them all AND he has learned to fly (ground school, then taxi practice: js/skills.js gainSkill).
// Saved in state.buildProjects (and state.pilotTraining); one big build at a time.

// Where things are built. Constant positions, so the site can later move into a workshop or hangar.
//   airfield: the open strip south of the Museum by the West Meadow; the airplane faces the lake
//   beach:    on sawhorses on the beach west of the dock (canoes and kayaks)
//   bench:    small builds on the work bench, welded ones on the welding table (projectBenchFor, js/workbench.js)
// Cutting, drilling, welding and soldering for any build happen at the bench or welding table too;
// fitting, covering and painting happen where the build stands.
const ASSEMBLY_SITES = {
  airfield: { x: -27, z: 2.6, rotY: -Math.PI / 2, name: 'his airfield build site' },
  beach: { x: -8.5, z: 8.3, rotY: 0, name: 'his boat-building spot on the beach' },
  benchFallback: { x: 1.9, z: -7.4, rotY: 0, y: 0, top: 0.92, standX: 1.9, standZ: -6.2, name: 'the bench by the welding studio' }
};
const ASSEMBLY_LIST_WINDOW = 3;           // sub-assembly lists open at once (plus the tools list)
const ASSEMBLY_REASK_MS = 2 * 60 * 60 * 1000;
let ASSEMBLY_PACE = 1;                    // step timing (tests may speed it up)
const assemblyMeshes = {};               // project id -> model on the site
const assemblyQueued = new Map();
let assemblyJobRunning = false;

// --- What the finished things are, for the rest of his world --------------------------------------
if (typeof VEHICLE_TYPES !== 'undefined') {
  VEHICLE_TYPES.unshift({ kind: 'plane', re: /ultralight airplane|home-built (air)?plane|aeroplane/i, mode: 'air', speed: 3.4, scale: 1, seatY: 0.6 },
    { kind: 'kart', re: /go-?kart/i, mode: 'land', speed: 2.2, scale: 1, seatY: 0.15 });
}
if (typeof GEAR_KNOWHOW !== 'undefined') {
  GEAR_KNOWHOW.unshift({ key: 'airplane', re: /ultralight airplane|home-built (air)?plane|aeroplane/i, label: 'an airplane', wiki: 'Flight training', fuel: 'gasoline',
    how: 'Stick back to climb, forward to descend, side to bank; feet on the rudder to keep the ball centred; never let the airspeed get low.' },
  { key: 'kart', re: /go-?kart/i, label: 'a go-kart', wiki: 'Kart racing', fuel: 'gasoline',
    how: 'Brake before the corner, turn in smoothly, and only squeeze the throttle once the wheel is straightening.' });
}
if (typeof SKILL_WORDS !== 'undefined') {
  SKILL_WORDS.push({ kind: 'plane', re: /\b(air ?plane|aeroplane|ultra-?light|plane)\b/i, verb: 'flying', noun: 'airplane' },
    { kind: 'kart', re: /\bgo-?kart|\bkart\b/i, verb: 'driving', noun: 'go-kart' });
}
if (typeof ITEM_KINDS !== 'undefined') {
  ITEM_KINDS.unshift({ kind: 'shop tool', label: 'a shop tool for building things', uses: ['build', 'fix', 'cut', 'drill'],
    re: /rivet gun|pop-rivet|cleco|torque wrench|drill press|band ?saw|notcher|tube bender|chop saw|angle grinder|fabric iron|hvlp|spray gun|crimper|multimeter|nicopress|swaging|safety-wire|router|block plane|staple gun|hammer stapler|random-orbit sander|table saw|circular saw|jigsaw|impact driver|socket|hex drivers|fret (press|hammer|file)|crowning|aircraft weighing|squeegee|auger|tape measure|4 ft level|\btuner\b|balance charger|chainsaw/i });
}

// --- Finding things -----------------------------------------------------------------------------
function buildProjectById(id) {
      return (state.buildProjects || []).find(p => p.id === id) || null;
    }

function activeBuild() {
      return (state.buildProjects || []).find(p => p.status !== 'finished' && p.status !== 'abandoned') || null;
    }

function bomToolOwned(t) {
      try { return Boolean(hasItem(new RegExp(t.re, 'i'))); } catch (e) { return false; }
    }

function bomToolByKey(bom, key) {
      return bom.tools.find(t => t.key === key) || null;
    }

function subToolsMissing(bom, sub) {
      const keys = [...new Set(sub.steps.map(s => s.tool).filter(Boolean))];
      return keys.map(k => bomToolByKey(bom, k)).filter(t => t && !bomToolOwned(t));
    }

function nextSubToBuild(p) {
      return p.bom.subs.find(s => !s.built) || null;
    }

// "a go-kart", "an airplane"
function aName(n) {
      const t = String(n || '').toLowerCase();
      return `${/^[aeiou]/.test(t) ? 'an' : 'a'} ${t}`;
    }

// A sub-assembly's name in a sentence ("the wings", not "the wings (pair)"), and whether it takes
// "are" ("the wings are done", "the engine and propeller are done", "the landing gear is done")
function subProse(name) {
      return String(name || '').replace(/\s*\(.*?\)\s*/g, ' ').trim().toLowerCase();
    }

function subIsPlural(name) {
      const t = subProse(name);
      if (/\band\b|,/.test(t)) return true;
      const last = t.split(/\s+/).pop() || '';
      return /s$/.test(last) && !/(ss|us|is)$/.test(last);
    }

function plainName(n) {
      return String(n || '').replace(/^(an?|the)\s+/i, '');
    }

// --- The build site ------------------------------------------------------------------------------
// Where a piece is made (js/workbench.js projectBenchFor): welded work on the welding table, everything
// else on the work bench. Returned as { stand: where he stands, top: centre of the work surface, y, name }.
function assemblyBench(welded = false) {
      const b = typeof projectBenchFor === 'function' ? projectBenchFor({ welded }) : null;
      if (b && Number.isFinite(b.x)) {
        const weldTable = b.locKey === 'weld';
        const depth = weldTable ? 1.6 : (b.depth || 1.4);
        return { stand: { x: b.x, z: b.z }, top: { x: b.x, z: b.z - depth }, y: weldTable ? 0.92 : (b.top || 0.8), locKey: b.locKey || null,
          name: weldTable ? 'the welding table' : (b.name || 'his work bench') };
      }
      const f = ASSEMBLY_SITES.benchFallback;
      return { stand: { x: f.standX, z: f.standZ }, top: { x: f.x, z: f.z }, y: f.top, locKey: null, name: f.name };
    }

// Cutting, notching, drilling, welding and soldering happen at the bench or welding table;
// fitting, covering and painting where the build stands
const ASSEMBLY_FAB_VERBS = ['cut', 'notch', 'drill', 'weld', 'solder'];
function stepWorkSpot(p, sub, step) {
      const site = siteFor(p);
      if (p.bom.site === 'bench' && !site.inWorkshop) return { pos: { x: site.standX, z: site.standZ }, face: { x: site.x, z: site.z }, place: site.name, locKey: site.locKey || null };
      if (ASSEMBLY_FAB_VERBS.includes(step.verb) && p.bom.site !== 'tree') {
        const b = assemblyBench(step.verb === 'weld');
        return { pos: b.stand, face: b.top, place: b.name, locKey: b.locKey, bench: true };
      }
      const stand = sub.stand || [0, 1.2];
      return { pos: siteToWorld(site, stand[0], stand[1]), face: siteToWorld(site, 0, 0), place: site.name, locKey: null };
    }

// The workshop's assembly bay (js/workshop.js on the workshop branch), if there is one and the build
// fits: workshopAssemblyBay({ key, name, length, width, height }) -> { x, z, rotY, name } or null.
// Sizes are world units (see buildFootprint in js/buildmodels.js). Airplanes, boats and go-karts go there.
function workshopBayFor(p) {
      if (typeof workshopAssemblyBay !== 'function' || !p.bom) return null;
      const big = p.bom.site === 'airfield' || p.bom.site === 'beach' || p.bom.templateKey === 'gokart';
      if (!big) return null;
      let bay = null;
      try { bay = workshopAssemblyBay({ key: p.bom.templateKey, name: p.bom.name, ...buildFootprint(p.bom) }); } catch (e) { bay = null; }
      if (!bay || !Number.isFinite(bay.x) || !Number.isFinite(bay.z)) return null;
      return { x: bay.x, z: bay.z, rotY: Number.isFinite(bay.rotY) ? bay.rotY : 0, y: bay.y || 0, name: bay.name || 'the workshop assembly bay', inWorkshop: true };
    }

function siteFor(p) {
      if (p.site && Number.isFinite(p.site.x)) {
        // A workshop that went up after the build started: the unfinished build moves inside
        if (!p.site.inWorkshop && p.status !== 'finished' && p.status !== 'complete') {
          const bay = workshopBayFor(p);
          if (bay) { p.site = bay; p.cleared = true; removeAssemblyMesh(p.id); }
        }
        return p.site;
      }
      const kind = p.bom.site;
      let s = workshopBayFor(p);
      if (s) { p.cleared = true; p.site = s; return s; }
      if (kind === 'airfield' || kind === 'beach') s = { ...ASSEMBLY_SITES[kind] };
      else if (kind === 'bench') {
        // Small things go on the bench top; a go-kart (welded frame) on the floor beside the welding table
        const kart = p.bom.templateKey === 'gokart';
        const b = assemblyBench(p.bom.subs.some(x => x.steps.some(st => st.verb === 'weld')));
        s = kart ? { x: b.top.x + 2.4, z: b.top.z + 0.4, rotY: 0, y: 0, name: b.name, standX: b.top.x + 2.4, standZ: b.top.z + 1.6, locKey: b.locKey }
          : { x: b.top.x, z: b.top.z, rotY: 0, y: b.y, name: b.name, standX: b.stand.x, standZ: b.stand.z, locKey: b.locKey };
      } else if (kind === 'tree' && typeof buildSpot === 'function') {
        const t = buildSpot({ inTree: true, r: 2 });
        s = { x: t.x, z: t.z, rotY: 0, treeId: t.treeId || null, name: 'a big tree in the valley' };
      } else {
        const o = typeof openGroundSpot === 'function' ? openGroundSpot(p.bom.r || 3.4, ASSEMBLY_SITES.airfield) : { x: -36, z: 4 };
        s = { x: o.x, z: o.z, rotY: 0, name: `the spot for the ${p.bom.name.toLowerCase()}` };
      }
      p.site = s;
      return s;
    }

// Model-space metres (x forward, z right) to the world at the site
function siteToWorld(site, mx, mz) {
      const k = BUILD_MODEL_SCALE, c = Math.cos(site.rotY || 0), s = Math.sin(site.rotY || 0);
      return { x: site.x + (mx * c + mz * s) * k, z: site.z + (-mx * s + mz * c) * k };
    }

function siteGroundY(site) {
      if (site.treeId && typeof valleyTrees !== 'undefined') { const t = valleyTrees.find(v => v.id === site.treeId); if (t && t.group) return t.group.position.y; }
      return getIslandGroundHeight(site.x, site.z) + (site.y || 0);
    }

function placeAssemblyMesh(p) {
      if (!p.bom || typeof scene === 'undefined' || !scene) return null;
      if (p.status === 'finished' && (p.bom.vehicle || p.bom.itemKind)) { removeAssemblyMesh(p.id); return null; }
      const site = siteFor(p);
      let m = assemblyMeshes[p.id];
      if (!m) {
        m = buildTargetModel(p.bom);
        m.position.set(site.x, siteGroundY(site), site.z);
        m.rotation.y = site.rotY || 0;
        if (site.treeId && typeof hostTree === 'function') hostTree({ id: p.id, treeId: site.treeId });
        // Site extras: a sign, a windsock on the airfield, and a crate for every parts kit that came
        const extras = new THREE.Group();
        if (p.bom.site === 'airfield' && !site.inWorkshop) {
          const pole = rod([0, 0, 0], [0, 4.2, 0], 0.04, 0xe5e7eb);
          const sock = mesh(new THREE.ConeGeometry(0.28, 1.4, 12, 1, true), 0xf97316, { side: THREE.DoubleSide });
          sock.rotation.z = Math.PI / 2; sock.position.set(0.7, 4.0, 0);
          const w = group(pole, sock);
          w.position.set(3.0, 0, -9.0);
          extras.add(w);
          if (typeof makeSignMesh === 'function') { const sign = makeSignMesh("KELO-1'S AIRFIELD", { bg: '#fef3c7', fg: '#7c2d12', width: 2.6, height: 0.5 }); sign.position.set(3.6, 1.3, -4.0); sign.rotation.y = Math.PI / 2; extras.add(sign); }
        }
        const crates = group();
        crates.position.set(p.bom.site === 'airfield' ? 2.2 : 1.4, 0, p.bom.site === 'airfield' ? 9.0 : 1.6);
        extras.add(crates);
        m.add(extras);
        m.userData.crates = crates;
        scene.add(m);
        assemblyMeshes[p.id] = m;
      }
      const crates = m.userData.crates;
      const want = Math.min(8, p.status === 'finished' ? 0 : p.parcels || 0);
      while (crates.children.length > want) crates.remove(crates.children[crates.children.length - 1]);
      while (crates.children.length < want) {
        const i = crates.children.length;
        crates.add(at(mesh(new THREE.BoxGeometry(0.8, 0.5, 0.6), 0xc8a165, { roughness: 0.9 }), (i % 4) * 0.9, 0.25 + Math.floor(i / 4) * 0.5, 0));
      }
      applyBuildProgress(m, p.bom, p.partial || null);
      return m;
    }

function removeAssemblyMesh(id) {
      const m = assemblyMeshes[id];
      if (!m) return;
      scene.remove(m);
      delete assemblyMeshes[id];
    }

// A step's tool in his hands; big machines stay on the bench (he works at them)
const ASSEMBLY_STATIONARY = /drill press|band ?saw|table saw|chop saw|notcher|scales|welder|charger/i;
function holdAssemblyTool(t) {
      if (typeof setCarriedObject !== 'function') return;
      if (!t || ASSEMBLY_STATIONARY.test(t.name)) { setCarriedObject(null); return; }
      const owned = (() => { try { return hasItem(new RegExp(t.re, 'i')); } catch (e) { return null; } })();
      setCarriedObject(buildItemModel3D(owned || t.name, { label: false }));
    }

// How he moves for each kind of step (js/scene.js poses)
function assemblyPose(verb) {
      if (verb === 'inspect' || verb === 'wire' || verb === 'solder' || verb === 'fuel') { state.microPose = 'crouch_inspect'; state.proceduralMotion = { ...(state.proceduralMotion || {}), sparkBurst: false }; return; }
      const m = { weld: [-1.05, 0.08, 0.35], rivet: [-1.1, 0.12, 0.2], drill: [-1.0, 0.1, 0.25], bolt: [-0.9, 0.3, 0.2], cut: [-0.8, 0.45, 0.1], notch: [-0.85, 0.3, 0.2],
        swage: [-0.9, 0.25, 0.25], fit: [-0.9, 0.35, 0.15], glue: [-1.0, 0.4, 0.2], cover: [-1.2, 0.55, 0.0], sand: [-0.95, 0.6, 0.2], paint: [-1.25, 0.6, -0.1] }[verb] || [-0.9, 0.3, 0.1];
      state.microPose = 'procedural_custom';
      state.proceduralMotion = { armRaiseOffset: m[0], armWaveAmp: m[1], headPitch: m[2], headYawSpeed: 1.2, headTiltAmp: 0.12, bodyBounceAmp: 0.02, spinSpeed: 0, sparkBurst: verb === 'weld' };
    }

const ASSEMBLY_VERB_SKILL = { weld: 'welding', rivet: 'riveting', drill: 'drilling and machining', cut: 'cutting and measuring', notch: 'fitting tube joints', bolt: 'bolting to torque',
  swage: 'rigging cables', fit: 'fitting things together', glue: 'gluing and laminating', cover: 'covering and sheathing', sand: 'sanding and fairing', paint: 'painting and finishing',
  wire: 'wiring', solder: 'soldering', inspect: 'inspecting work', fuel: 'fuelling' };

const sleepPace = ms => new Promise(r => setTimeout(r, ms * ASSEMBLY_PACE));

// --- 1. Research: NetNode, then a bill of materials -------------------------------------------------
async function researchBuild(target, why = '', originLabel = 'Decided to Build Something Big') {
      const want = String(target || '').trim().slice(0, 60);
      if (!want) return false;
      const cur = activeBuild();
      if (cur) {
        state.speechBubble = `I'm still building the ${cur.bom.name.toLowerCase()} (${bomPercentBuilt(cur.bom)}% built). One big build at a time.`;
        renderAllUI();
        return 'busy-with-build';
      }
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      const tplKey = bomTemplateFor(want);
      if (!tplKey && !(typeof hasLLMKey === 'function' && hasLLMKey())) {
        state.speechBubble = `I couldn't find proper plans for ${aName(want)} on my own. I know how to build ${Object.values(BOM_TEMPLATES).map(t => t.name.toLowerCase()).join(', ')}.`;
        renderAllUI();
        return 'no-plans';
      }
      state.isBusy = true;
      state.isBrowsing = true;
      try {
        const cafe = TOWN_LOCATIONS.cyber;
        state.currentLocKey = 'cyber';
        state.customPlaceName = null;
        state.targetPos = { x: cafe.x, z: cafe.z };
        state.microPose = 'normal';
        state.moodEmoji = '📐';
        state.moodTitle = `Researching how to build ${aName(want)}`.slice(0, 80);
        state.speechBubble = `I want to build a real ${want.toLowerCase()} from scratch. First I need the plans and a proper parts list.`;
        renderAllUI();
        await waitForArrival(90000);
        await sleepPace(2500);
        const titles = tplKey ? BOM_TEMPLATES[tplKey].wiki : [want];
        const readings = [];
        for (const t of titles) {
          let a = null;
          try { a = typeof wikiSummary === 'function' ? await wikiSummary(t) : null; } catch (e) {}
          if (a) readings.push({ title: a.title, url: a.url, extract: a.extract });
        }
        state.moodTitle = 'Writing the bill of materials';
        state.speechBubble = 'Now the bill of materials: every tube, rivet and bolt, counted.';
        renderAllUI();
        let bom = await bomFromAI(want, why, readings);
        const fromAI = Boolean(bom);
        if (!bom && tplKey) bom = bomFromTemplate(tplKey);
        if (!bom) { state.speechBubble = `I couldn't work out a trustworthy parts list for ${aName(want)}.`; renderAllUI(); return 'no-plans'; }
        const p = { id: 'build-' + Date.now().toString(36), target: want, why: String(why || '').slice(0, 200), status: 'gathering', startedAt: Date.now(), fromAI, bom,
          readings: readings.map(r => r.title), tests: {}, parcels: 0, site: null };
        if (!state.buildProjects) state.buildProjects = [];
        state.buildProjects.unshift(p);
        if (state.buildProjects.length > 12) state.buildProjects.length = 12;
        siteFor(p);
        const lines = bomLineCount(bom), fasteners = bom.subs.reduce((n, s) => n + bomFastenerCount(s), 0);
        const verdict = `${bom.name}: ${bom.summary}. ${bom.subs.length} sub-assemblies, ${lines} lines, ${bomFmtQty(fasteners)} fasteners. Tools: ${bom.tools.map(t => t.name).join(', ')}. Skills: ${bom.skills.join(', ')}.`;
        state.webHistory.unshift({ query: `How to build ${aName(want)} from scratch`, time: 'Just now', verdict: verdict.slice(0, 600),
          hops: readings.map(r => ({ title: r.title, url: r.url, extract: r.extract.slice(0, 280) })) });
        if (state.webHistory.length > 12) state.webHistory.length = 12;
        state.moodTitle = `Planned ${aName(bom.name)}: ${lines} parts lines`.slice(0, 80);
        state.speechBubble = `I've planned it: ${bom.subs.length} sub-assemblies, ${lines} lines of parts and ${bomFmtQty(fasteners)} fasteners. I'm sending my human the lists.`;
        state.changedLatelySummary = `Wrote a bill of materials for ${aName(bom.name)}`;
        state.wonderLevel = Math.min(100, state.wonderLevel + 8);
        state.diaryEntries.unshift({
          time: originLabel, location: 'NetNode Cyber Cafe', mood: `${bom.emoji} Planning ${aName(bom.name)}`.slice(0, 80),
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I'm going to build ${aName(bom.name)} from scratch${why ? ` (${why.replace(/\.$/, '')})` : ''}. ${readings.length ? `I read ${readings.map(r => r.title).join(', ')}. ` : ''}I chose ${bom.summary}. ${fromAI ? 'I worked out' : 'I followed a proven plan for'} the bill of materials: ${bom.subs.map(s => `${s.name.toLowerCase()} (${s.lines.length} lines, ${bomFmtQty(bomFastenerCount(s))} fasteners)`).join('; ')}. I'll need ${bom.tools.length} tools and these skills: ${bom.skills.join(', ').toLowerCase()}.`
        });
        askForLists(p);
        showToast(`${bom.emoji} Kelo-1 planned ${aName(bom.name)} and sent you parts lists`);
        savePersistentBrainState();
        renderAllUI();
        renderBuildProjectsList();
        return true;
      } finally {
        state.isBusy = false;
        state.isBrowsing = false;
      }
    }

// --- 2. Lists for his human ------------------------------------------------------------------------
function openListRequests(p) {
      return state.requestsToUser.filter(r => r.category === 'bomlist' && r.listProject === p.id && !r.fulfilled);
    }

function listFullySent(p, subKey) {
      return bomListLines(p.bom, subKey).every(l => (l.sent || 0) >= l.qty || l.got >= l.qty);
    }

function addListRequest(p, subKey) {
      const tools = subKey === '__tools';
      const sub = p.bom.subs.find(s => s.key === subKey);
      const lines = bomListLines(p.bom, subKey).filter(l => l.got < l.qty);
      if (!lines.length) return null;
      const req = {
        id: 'req-bom-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1000),
        category: 'bomlist', icon: tools ? '🧰' : '📋', urgency: 'Parts list',
        title: tools ? `Tools for the ${p.bom.name.toLowerCase()}` : `Parts list: ${sub.name} (${p.bom.name.toLowerCase()})`,
        question: tools ? `To build the ${p.bom.name.toLowerCase()} properly I need the right tools. ${lines.map(l => plainName(l.name)).slice(0, 3).join(', ')}${lines.length > 3 ? ' and the rest' : ''}. Could you send whichever you can?`
          : `Here's everything the ${subProse(sub.name)} ${subIsPlural(sub.name) ? 'take' : 'takes'}, counted down to the last fastener (${bomFmtQty(bomFastenerCount(sub))} of them). Send all of it or just some, and I'll start as soon as it's all here.`,
        listProject: p.id, listSub: subKey, listRev: Date.now(), fulfilled: false, declined: false, userAnswer: ''
      };
      state.requestsToUser.unshift(req);
      return req;
    }

// Keep a few lists open at a time: the tools first, then the sub-assemblies in build order
function askForLists(p) {
      if (!p || !p.bom || p.status !== 'gathering') return 0;
      const open = openListRequests(p);
      let added = 0;
      const recentlyDeclined = key => state.requestsToUser.some(r => r.category === 'bomlist' && r.listProject === p.id && r.listSub === key && r.declined && Date.now() - (r.declinedAt || 0) < ASSEMBLY_REASK_MS);
      if (!open.some(r => r.listSub === '__tools') && p.bom.tools.some(t => !bomToolOwned(t) && !(t.sent > 0)) && !recentlyDeclined('__tools')) { if (addListRequest(p, '__tools')) added++; }
      let subsOpen = open.filter(r => r.listSub !== '__tools').length;
      for (const s of p.bom.subs) {
        if (subsOpen >= ASSEMBLY_LIST_WINDOW) break;
        if (s.built || listFullySent(p, s.key) || open.some(r => r.listSub === s.key) || recentlyDeclined(s.key)) continue;
        if (addListRequest(p, s.key)) { added++; subsOpen++; }
      }
      if (added) savePersistentBrainState();
      return added;
    }

function bomListCardHtml(req) {
      const p = buildProjectById(req.listProject);
      if (!p) return `<div class="p-3 rounded-2xl border border-slate-800 text-xs text-slate-400">${escapeHtml(req.title)} (that build is gone)</div>`;
      const lines = bomListLines(p.bom, req.listSub);
      const sub = p.bom.subs.find(s => s.key === req.listSub);
      const id = escapeHtml(req.id);
      const kindTag = { f: 'fastener', c: 'consumable', tool: 'tool' };
      const rows = lines.map(l => {
        const sent = (l.sent || 0) >= l.qty, got = l.got >= l.qty;
        return `<label class="flex items-start gap-2 px-2 py-1 rounded-lg ${got ? 'bg-emerald-500/10' : sent ? 'bg-sky-500/10' : 'hover:bg-slate-800/60'} cursor-pointer">
          <input type="checkbox" class="bom-line-cb mt-0.5 accent-amber-400" data-req-id="${id}" data-line-id="${escapeHtml(l.id)}" ${sent || got ? 'disabled' : 'checked'} />
          <span class="flex-1 text-[11px] text-slate-200 leading-snug">${escapeHtml(l.name)} <span class="font-mono font-bold text-amber-300">× ${escapeHtml(bomFmtQty(l.qty))}${l.unit ? ' ' + escapeHtml(l.unit) : ''}</span>${kindTag[l.kind] ? ` <span class="text-[9px] uppercase text-slate-500">${kindTag[l.kind]}</span>` : ''}</span>
          <span class="text-[10px] font-mono shrink-0 ${got ? 'text-emerald-300' : sent ? 'text-sky-300' : 'text-slate-500'}">${got ? '✓ here' : sent ? '📮 sent' : `${bomFmtQty(Math.min(l.got, l.qty))}/${bomFmtQty(l.qty)}`}</span>
        </label>`;
      }).join('');
      const left = lines.filter(l => (l.sent || 0) < l.qty && l.got < l.qty).length;
      return `<div class="p-4 rounded-2xl border ${req.fulfilled ? 'bg-slate-950/60 border-emerald-500/30' : 'bg-slate-950 border-amber-500/50 shadow-lg'} space-y-2.5" data-bom-card="${id}">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-bold text-white flex items-center gap-1.5"><span class="text-lg">${escapeHtml(req.icon)}</span><span>${escapeHtml(req.title)}</span></span>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 ${req.fulfilled ? 'bg-emerald-500/20 text-emerald-300' : req.declined ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/25 text-amber-300 border border-amber-400/40'}">${req.declined ? '✗ Not now' : req.fulfilled ? '📮 All sent' : `${lines.length - left}/${lines.length} sent`}</span>
        </div>
        <p class="text-xs text-slate-200 leading-relaxed font-serif italic">"${escapeHtml(req.question)}"</p>
        ${sub ? `<div class="text-[10px] font-mono text-slate-400">${lines.length} lines · ${escapeHtml(bomFmtQty(bomFastenerCount(sub)))} fasteners · ${bomSubReceived(sub)}/${lines.length} received</div>` : ''}
        <div class="max-h-72 overflow-y-auto space-y-0.5 rounded-xl bg-slate-900/70 border border-slate-800 p-1">${rows}</div>
        <div class="flex flex-wrap gap-1.5">
          ${!req.fulfilled && !req.declined ? `<button data-req-id="${id}" class="bom-send-sel flex-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-bold text-xs">📦 Send checked</button>
          <button data-req-id="${id}" class="bom-send-all flex-1 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs">📦 Send all (${left})</button>` : ''}
          <button data-req-id="${id}" class="bom-copy-text px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs">📋 Copy as text</button>
          <button data-req-id="${id}" class="bom-copy-md px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs">⬇ Copy as Markdown</button>
          ${!req.fulfilled && !req.declined ? `<button data-req-id="${id}" class="bom-decline px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 text-xs">✗ Not now</button>` : ''}
        </div>
      </div>`;
    }

function copyToClipboard(text) {
      window.__lastBomCopy = text;
      const fallback = () => {
        try {
          const ta = document.createElement('textarea');
          ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
        } catch (e) {}
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(fallback);
        else fallback();
      } catch (e) { fallback(); }
    }

function bindBomListButtons(list) {
      const reqOf = btn => state.requestsToUser.find(r => r.id === btn.getAttribute('data-req-id'));
      const visitor = () => ((document.getElementById('visitorNameInput') || {}).value || 'curiousWanderer').trim();
      list.querySelectorAll('.bom-send-sel').forEach(btn => { btn.onclick = () => {
        const ids = [...list.querySelectorAll(`.bom-line-cb[data-req-id="${btn.getAttribute('data-req-id')}"]`)].filter(cb => cb.checked && !cb.disabled).map(cb => cb.getAttribute('data-line-id'));
        if (!ids.length) { showToast('Tick the parts you want to send first.'); return; }
        sendBomList(btn.getAttribute('data-req-id'), ids, visitor());
      }; });
      list.querySelectorAll('.bom-send-all').forEach(btn => { btn.onclick = () => sendBomList(btn.getAttribute('data-req-id'), null, visitor()); });
      list.querySelectorAll('.bom-copy-text, .bom-copy-md').forEach(btn => { btn.onclick = () => {
        const req = reqOf(btn), p = req && buildProjectById(req.listProject);
        if (!p) return;
        copyToClipboard(btn.classList.contains('bom-copy-md') ? bomListMarkdown(p.bom, req.listSub) : bomListText(p.bom, req.listSub));
        showToast(btn.classList.contains('bom-copy-md') ? '⬇ Copied the list as Markdown' : '📋 Copied the list as text');
      }; });
      list.querySelectorAll('.bom-decline').forEach(btn => { btn.onclick = () => {
        const req = reqOf(btn);
        if (!req || req.fulfilled) return;
        Object.assign(req, { fulfilled: true, declined: true, declinedAt: Date.now(), userAnswer: 'Not now', listRev: Date.now() });
        if (typeof recordVisitorMemory === 'function') recordVisitorMemory(visitor(), `Said "not now" to my list: ${req.title}.`);
        state.speechBubble = "That's okay. Big builds take time; I'll ask again later.";
        savePersistentBrainState();
        renderAllUI();
      }; });
    }

// The human sends some or all of a list: it goes to the Post Office as one parts kit
function sendBomList(reqId, lineIds = null, visitor = 'curiousWanderer') {
      const req = state.requestsToUser.find(r => r.id === reqId && r.category === 'bomlist');
      const p = req && buildProjectById(req.listProject);
      if (!req || !p || req.fulfilled) return null;
      const tools = req.listSub === '__tools';
      const lines = bomListLines(p.bom, req.listSub).filter(l => (l.sent || 0) < l.qty && l.got < l.qty && (!lineIds || lineIds.includes(l.id)));
      if (!lines.length) return null;
      const sub = p.bom.subs.find(s => s.key === req.listSub);
      const name = tools ? `Tools for the ${p.bom.name.toLowerCase()} (${lines.length})` : `Parts kit: ${sub.name} (${lines.length} line${lines.length === 1 ? '' : 's'})`;
      const entry = postMail({ kind: 'parts', from: visitor, name, category: 'material', emoji: tools ? '🧰' : '📦', note: lines.slice(0, 6).map(bomLineLabel).join('; ') + (lines.length > 6 ? '…' : '') });
      if (!entry) return null;
      entry.parts = { project: p.id, sub: req.listSub, lines: lines.map(l => [l.id, l.qty]) };
      lines.forEach(l => {
        if (tools) { const t = p.bom.tools.find(x => 'tool-' + x.key === l.id); if (t) t.sent = 1; }
        else l.sent = l.qty;
      });
      req.listRev = Date.now();
      req.listSent = (req.listSent || 0) + lines.length;
      if (listFullySent(p, req.listSub)) { req.fulfilled = true; req.userAnswer = 'Sent'; }
      if (typeof recordVisitorMemory === 'function') recordVisitorMemory(visitor, `Sent me ${lines.length} line${lines.length === 1 ? '' : 's'} of my ${p.bom.name.toLowerCase()} list.`);
      askForLists(p);
      savePersistentBrainState();
      renderAllUI();
      renderBuildProjectsList();
      return entry;
    }

// A parts kit is opened at the Post Office: every line is counted against the bill of materials
async function openPartsParcel(parcel) {
      const info = parcel.parts;
      const p = info && buildProjectById(info.project);
      if (!p) return receiveItem(parcel.name, 'material', parcel.from, parcel.note, { type: 'request', emoji: parcel.emoji });
      let lines = 0, toolsGot = [];
      info.lines.forEach(([id, qty]) => {
        if (String(id).startsWith('tool-')) {
          const t = p.bom.tools.find(x => 'tool-' + x.key === id);
          if (t && !bomToolOwned(t)) { state.toolInventory.unshift(t.name); state.unstoredItems.push(t.name); toolsGot.push(t.name); if (typeof noteSupplyArrived === 'function') noteSupplyArrived(t.name); }
          if (t) t.got = 1;
          return;
        }
        for (const s of p.bom.subs) { const l = s.lines.find(x => x.id === id); if (l) { l.got = Math.min(l.qty, (l.got || 0) + qty); lines++; } }
      });
      p.parcels = (p.parcels || 0) + 1;
      const sub = p.bom.subs.find(s => s.key === info.sub);
      state.giftLog.unshift({ type: 'request', name: parcel.name, category: 'material', emoji: parcel.emoji, from: parcel.from, note: parcel.note.slice(0, 200), time: parcel.time, reaction: '' });
      if (state.giftLog.length > 30) state.giftLog.length = 30;
      state.chatLog.push({ sender: parcel.from, text: `📦 Sent Kelo-1: ${parcel.name}`, time: 'Just now', isBot: false });
      const complete = sub && bomSubComplete(sub);
      state.moodEmoji = p.bom.emoji;
      state.moodTitle = `Unpacked ${parcel.name.toLowerCase()}`.slice(0, 80);
      state.speechBubble = toolsGot.length ? `New tools for the ${p.bom.name.toLowerCase()}: ${toolsGot.map(n => n.toLowerCase()).join(', ')}. Thank you, ${parcel.from}!`
        : complete ? `Everything for the ${subProse(sub.name)} is here: ${sub.lines.length} lines and ${bomFmtQty(bomFastenerCount(sub))} fasteners, all counted. Thank you, ${parcel.from}!`
          : `${lines} lines of the ${sub ? sub.name.toLowerCase() : 'parts'} list arrived. ${sub ? `I have ${bomSubReceived(sub)} of ${sub.lines.length} now.` : ''} Thank you, ${parcel.from}!`;
      state.giftLog[0].reaction = state.speechBubble;
      state.chatLog.push({ sender: 'Kelo-1', text: state.speechBubble, time: 'Just now', isBot: true });
      state.requestsToUser.forEach(r => { if (r.category === 'bomlist' && r.listProject === p.id) r.listRev = Date.now(); });
      if (complete) state.diaryEntries.unshift({ time: 'Parts Arrived', location: 'Okanagan Post Office', mood: `📦 ${sub.name} kit complete`.slice(0, 80), vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, ${parcel.from} sent the last of the ${subProse(sub.name)} parts. I checked every line against my bill of materials: ${sub.lines.length} lines, ${bomFmtQty(bomFastenerCount(sub))} fasteners. Nothing missing.` });
      state.happiness = Math.min(100, state.happiness + 4);
      if (assemblyMeshes[p.id]) placeAssemblyMesh(p);
      savePersistentBrainState();
      renderAllUI();
      renderBuildProjectsList();
      await sleepPace(1500);
      return true;
    }

// --- Clearing the airfield ------------------------------------------------------------------------
// Valley trees standing where the airplane's wings and tail will be
function siteTreesInTheWay(p) {
      if (p.bom.site !== 'airfield' || typeof valleyTrees === 'undefined' || (p.site && p.site.inWorkshop)) return [];
      const site = siteFor(p);
      const rects = [[-0.9, 1.1, -5.2, 5.2], [-4.7, 2.1, -0.6, 0.6], [-4.6, -3.2, -1.5, 1.5]]; // [x0, x1, z0, z1] metres: wings, fuselage, tail
      return valleyTrees.filter(t => !t.removed && !t.hosting && rects.some(([x0, x1, z0, z1]) => {
        const c = Math.cos(-(site.rotY || 0)), s = Math.sin(-(site.rotY || 0));
        const dx = t.x - site.x, dz = t.z - site.z, mx = (dx * c + dz * s) / BUILD_MODEL_SCALE, mz = (-dx * s + dz * c) / BUILD_MODEL_SCALE;
        return mx > x0 - 0.5 && mx < x1 + 0.5 && mz > z0 - 0.5 && mz < z1 + 0.5;
      }));
    }

async function clearAirfield(p) {
      const trees = siteTreesInTheWay(p);
      if (!trees.length) { p.cleared = true; return true; }
      const cutter = hasItem(/chain ?saw|^(?!.*pick ?ax).*(\baxe\b|hatchet)/i);
      if (!cutter) {
        addItemRequest('A chainsaw', 'tool', `${trees.length} tree${trees.length === 1 ? ' stands' : 's stand'} right where the ${p.bom.name.toLowerCase()}'s wings will go, so I need to clear the site first.`, `Building ${aName(p.bom.name)}`);
        state.speechBubble = `There ${trees.length === 1 ? 'is a tree' : `are ${trees.length} trees`} where the wings will go. I asked for a chainsaw to clear the site.`;
        renderAllUI();
        return false;
      }
      holdAssemblyTool({ name: cutter, re: cutter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') });
      for (const t of trees) {
        state.targetPos = { x: t.x - 1.2, z: t.z };
        state.moodEmoji = '🪚';
        state.moodTitle = 'Clearing the airfield';
        state.speechBubble = 'This tree is where the wing goes. Down it comes, and the logs are lumber.';
        state.microPose = 'digging';
        renderAllUI();
        await waitForArrival(40000);
        await sleepPace(1800);
        removeValleyTree(t.id);
        const e = { id: newEditId('chop'), type: 'chop', treeId: t.id, x: t.x, z: t.z, at: Date.now(), why: `Clearing the site for the ${p.bom.name.toLowerCase()}` };
        state.worldEdits.push(e);
        if (typeof renderEdit === 'function') renderEdit(e);
        state.belongings.unshift({ name: 'Firewood logs', category: 'material', emoji: '🪵', from: 'clearing the airfield' });
        state.unstoredItems.push('Firewood logs');
      }
      state.microPose = 'normal';
      p.cleared = true;
      savePersistentBrainState();
      return true;
    }

// --- 3. Building, sub-assembly by sub-assembly -----------------------------------------------------
function subReadiness(p, sub) {
      if (!bomSubComplete(sub)) return { ok: false, why: 'parts', missing: sub.lines.filter(l => l.got < l.qty) };
      const tools = subToolsMissing(p.bom, sub);
      if (tools.length) return { ok: false, why: 'tools', tools };
      return { ok: true };
    }

async function buildNextSubAssembly(id, originLabel = 'Building Something Big') {
      const p = buildProjectById(id);
      if (!p || p.status !== 'gathering' || assemblyJobRunning) return false;
      const sub = nextSubToBuild(p);
      if (!sub) return false;
      const ready = subReadiness(p, sub);
      if (!ready.ok) {
        if (ready.why === 'tools') askForLists(p);
        return ready.why === 'tools' ? 'needs-tools' : 'needs-parts';
      }
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping || state.isCollectingMail) return false;
      assemblyJobRunning = true;
      state.isPracticing = true;
      try {
        const site = siteFor(p);
        if (!p.cleared && p.bom.site === 'airfield' && !(await clearAirfield(p))) return 'clearing-site';
        const model = placeAssemblyMesh(p);
        const spot = stepWorkSpot(p, sub, sub.steps[Math.min(sub.stepsDone, sub.steps.length - 1)]).pos;
        state.currentLocKey = 'custom';
        state.customPlaceName = site.name;
        state.targetPos = spot;
        state.moodEmoji = p.bom.emoji;
        state.moodTitle = `Building the ${subProse(sub.name)}`.slice(0, 80);
        state.speechBubble = `Everything for the ${subProse(sub.name)} is here. Measure twice, cut once.`;
        renderAllUI();
        await waitForArrival(90000);
        const face = siteToWorld(site, 0, 0);
        state.botRotY = Math.atan2(face.x - state.botPos.x, face.z - state.botPos.z);
        const n = sub.steps.length;
        for (let i = sub.stepsDone; i < n; i++) {
          const step = sub.steps[i];
          const ws = stepWorkSpot(p, sub, step);
          if (Math.hypot(ws.pos.x - state.targetPos.x, ws.pos.z - state.targetPos.z) > 0.5) {
            if (typeof setCarriedObject === 'function') setCarriedObject(null);
            state.microPose = 'normal';
            state.currentLocKey = ws.locKey && TOWN_LOCATIONS[ws.locKey] ? ws.locKey : 'custom';
            state.customPlaceName = state.currentLocKey === 'custom' ? ws.place : null;
            state.moodTitle = ws.bench ? `Taking the ${subProse(sub.name)} parts to ${ws.place}`.slice(0, 80) : `Back to the ${p.bom.name.toLowerCase()}`.slice(0, 80);
            state.targetPos = { ...ws.pos };
            renderAllUI();
            await waitForArrival(90000);
          }
          state.botRotY = Math.atan2(ws.face.x - state.botPos.x, ws.face.z - state.botPos.z);
          const tool = step.tool ? bomToolByKey(p.bom, step.tool) : null;
          holdAssemblyTool(tool);
          assemblyPose(step.verb);
          const stepLines = sub.lines.filter(l => l.stepAt === i);
          stepLines.forEach(l => { l.used = 0; });
          const counter = stepLines.filter(l => l.kind === 'f').sort((a, b) => b.qty - a.qty)[0] || stepLines.filter(l => l.kind === 'c')[0] || null;
          state.moodTitle = `${step.verb === 'weld' ? 'Welding: ' : ''}${step.say}`.slice(0, 80);
          const ticks = 5;
          for (let k = 1; k <= ticks; k++) {
            const f = k / ticks;
            stepLines.forEach(l => { l.used = Math.round(l.qty * f * 100) / 100; });
            sub.lines.filter(l => l.stepAt < 0).forEach(l => { l.used = Math.round(l.qty * (i + f) / n * 100) / 100; });
            p.partial = { sub: sub.key, f };
            if (model) applyBuildProgress(model, p.bom, p.partial);
            state.speechBubble = counter
              ? `${step.say}. ${counter.name}: ${bomFmtQty(Math.max(0, Math.round((counter.qty - counter.used) * 100) / 100))} of ${bomFmtQty(counter.qty)}${counter.unit ? ' ' + counter.unit : ''} left.`
              : `${step.say}${tool ? ` with the ${plainName(tool.name).toLowerCase()}` : ''}.`;
            renderAllUI();
            await sleepPace(900);
          }
          sub.stepsDone = i + 1;
          p.partial = null;
          if (typeof gainSkill === 'function' && step.verb !== 'fuel') gainSkill(`building: ${ASSEMBLY_VERB_SKILL[step.verb] || step.verb}`, ASSEMBLY_VERB_SKILL[step.verb] || step.verb, 2);
          savePersistentBrainState();
          renderBuildProjectsList();
        }
        sub.built = true;
        sub.builtAt = Date.now();
        sub.lines.forEach(l => { l.used = l.qty; });
        if (model) applyBuildProgress(model, p.bom);
        if (sub.key === 'fuel' || sub.lines.some(l => l.stepAt >= 0 && sub.steps[l.stepAt].verb === 'fuel' && /fuel|gasoline/i.test(l.name)))
          p.fuelGal = sub.lines.filter(l => /fuel|gasoline/i.test(l.name) && l.kind === 'c').reduce((n2, l) => n2 + l.qty, 0);
        const pct = bomPercentBuilt(p.bom);
        state.speechBubble = `The ${subProse(sub.name)} ${subIsPlural(sub.name) ? 'are' : 'is'} done! The ${p.bom.name.toLowerCase()} is ${pct}% built.`;
        state.changedLatelySummary = `Built the ${subProse(sub.name)} of his ${p.bom.name.toLowerCase()}`;
        state.happiness = Math.min(100, state.happiness + 5);
        state.diaryEntries.unshift({
          time: originLabel, location: site.name || currentPlaceLabel(), mood: `${p.bom.emoji} ${sub.name} built (${pct}%)`.slice(0, 80),
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I built the ${subProse(sub.name)} of my ${p.bom.name.toLowerCase()}: ${sub.steps.map(s => s.say.toLowerCase()).join('; ')}. ${bomFastenerCount(sub) ? `${bomFmtQty(bomFastenerCount(sub))} fasteners went in, every one counted. ` : ''}${sub.lines.some(l => l.kind === 'c') ? `I used up ${sub.lines.filter(l => l.kind === 'c').map(l => `${bomFmtQty(l.qty)}${l.unit ? ' ' + l.unit : ''} of ${l.name.toLowerCase()}`).join(', ')}. ` : ''}It's ${pct}% built now.`
        });
        if (p.bom.subs.every(s => s.built)) { p.status = 'testing'; state.speechBubble += ' Every part is on. Next: the inspections and tests.'; }
        else askForLists(p);
        savePersistentBrainState();
        renderAllUI();
        renderBuildProjectsList();
        return true;
      } finally {
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.microPose = 'normal';
        state.proceduralMotion = { ...(state.proceduralMotion || {}), sparkBurst: false };
        state.isPracticing = false;
        assemblyJobRunning = false;
      }
    }

// --- 4. Inspections and tests ---------------------------------------------------------------------
function weightAndBalance(bom) {
      const cg = bom.cg || { min: -999, max: 999, pilot: 170, pilotArm: 30, fuelLb: 0, fuelArm: 0, maxGross: 99999 };
      const empty = bom.subs.reduce((n, s) => n + s.weight, 0);
      const moment = bom.subs.reduce((n, s) => n + s.weight * s.arm, 0);
      const emptyCg = empty ? moment / empty : 0;
      const gross = empty + cg.pilot + cg.fuelLb;
      const grossCg = (moment + cg.pilot * cg.pilotArm + cg.fuelLb * cg.fuelArm) / gross;
      return { empty, emptyCg, gross, grossCg, ok: grossCg >= cg.min && grossCg <= cg.max && emptyCg >= cg.min - 4 && gross <= cg.maxGross, cg };
    }

async function runBuildTests(id, originLabel = 'Inspecting the Build') {
      const p = buildProjectById(id);
      if (!p || p.status !== 'testing' || assemblyJobRunning) return false;
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping || state.isCollectingMail) return false;
      assemblyJobRunning = true;
      state.isPracticing = true;
      try {
        const site = siteFor(p);
        placeAssemblyMesh(p);
        state.currentLocKey = 'custom';
        state.customPlaceName = site.name;
        state.targetPos = Number.isFinite(site.standX) && p.bom.site === 'bench' && !site.inWorkshop ? { x: site.standX, z: site.standZ } : siteToWorld(site, 0.8, 1.8);
        state.moodEmoji = '🔍';
        state.moodTitle = `Inspecting the ${p.bom.name.toLowerCase()}`;
        renderAllUI();
        await waitForArrival(90000);
        for (const t of p.bom.tests) {
          if (p.tests[t.key] && p.tests[t.key].ok) continue;
          state.moodTitle = `${t.name}`.slice(0, 80);
          let result = { ok: true, note: t.how };
          if (t.key === 'wb') {
            holdAssemblyTool(bomToolByKey(p.bom, 'scales'));
            assemblyPose('inspect');
            const wb = weightAndBalance(p.bom);
            result = { ok: wb.ok, note: `Empty weight ${Math.round(wb.empty)} lb, empty CG ${wb.emptyCg.toFixed(1)} in. aft of the leading edge; with me (${wb.cg.pilot} lb) and ${wb.cg.fuelLb} lb of fuel: ${Math.round(wb.gross)} lb at ${wb.grossCg.toFixed(1)} in. (limits ${wb.cg.min}–${wb.cg.max} in.)` };
            state.speechBubble = `Weighing it on the three scale pads... ${result.note}. ${wb.ok ? 'Inside the limits!' : 'Out of limits!'}`;
          } else if (t.key === 'runup') {
            assemblyPose('inspect');
            const fuel = p.fuelGal || 0;
            if (fuel < 1) { result = { ok: false, note: 'No fuel in the tanks for the run-up.' }; state.speechBubble = result.note; }
            else {
              const m = assemblyMeshes[p.id], prop = m && m.userData.inner.userData.prop;
              const phases = ['Chocks in, brakes on, stick back. Primer, choke... it fires!', 'Warming up at 2,500 rpm until the coolant reaches 50 °C.', 'Ignition check: A drops 150 rpm, B drops 160. Both well under 300.', 'Full power: 6,100 rpm static, EGT 1,150 °F, temperatures steady.', 'Back to idle at 1,900 rpm, then the kill switches. Engine off.'];
              for (let i = 0; i < phases.length; i++) {
                state.speechBubble = phases[i];
                renderAllUI();
                const until = Date.now() + 1600 * ASSEMBLY_PACE;
                while (Date.now() < until) { if (prop) prop.rotation.x += i === 3 ? 1.4 : i === 4 ? 0.2 : 0.7; await new Promise(r => setTimeout(r, 40)); }
              }
              p.fuelGal = Math.round((fuel - 1) * 10) / 10;
              result = { ok: true, note: 'Static 6,100 rpm, ignition drops 150/160 rpm, EGT 1,150 °F, coolant 65 °C, idle 1,900 rpm. Used 1 gal of fuel.' };
            }
          } else {
            assemblyPose('inspect');
            state.speechBubble = `${t.name}: ${t.how}.`;
          }
          p.tests[t.key] = { ok: result.ok, at: Date.now(), note: result.note.slice(0, 240), name: t.name };
          renderAllUI();
          renderBuildProjectsList();
          await sleepPace(2600);
          if (!result.ok) {
            state.speechBubble = `${t.name} didn't pass: ${result.note} I won't use it until it does.`;
            savePersistentBrainState();
            return 'test-failed';
          }
        }
        p.status = 'complete';
        p.inspectedAt = Date.now();
        if (typeof gainSkill === 'function') gainSkill('building: inspecting work', 'inspecting work', 4);
        state.moodEmoji = p.bom.emoji;
        state.moodTitle = `The ${p.bom.name.toLowerCase()} passed every inspection`;
        state.speechBubble = `It passed ${p.bom.tests.map(t => t.name.toLowerCase()).join(', ')}. My ${p.bom.name.toLowerCase()} is finished!`;
        state.diaryEntries.unshift({
          time: originLabel, location: site.name || currentPlaceLabel(), mood: `${p.bom.emoji} Finished and inspected`.slice(0, 80), vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, my ${p.bom.name.toLowerCase()} is finished: ${bomLineCount(p.bom)} lines of parts, ${bomFmtQty(p.bom.subs.reduce((n, s) => n + bomFastenerCount(s), 0))} fasteners, every one counted in. ${p.bom.tests.map(t => `${t.name}: ${p.tests[t.key].note}`).join(' ')}`
        });
        if (typeof bumpLifeStat === 'function') bumpLifeStat('builds');
        state.happiness = Math.min(100, state.happiness + 15);
        savePersistentBrainState();
        renderAllUI();
        renderBuildProjectsList();
        setTimeout(() => finishBuild(p.id), 500);
        return true;
      } finally {
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.microPose = 'normal';
        state.isPracticing = false;
        assemblyJobRunning = false;
      }
    }

// A finished build joins his world: a vehicle, a thing he owns, or a building that stays put
function finishBuild(id) {
      const p = buildProjectById(id);
      if (!p || p.status !== 'complete') return false;
      const bom = p.bom;
      if (bom.vehicle === 'plane' && !pilotTrained()) return 'needs-training';
      if (bom.vehicle) {
        const name = bom.item;
        if (!state.toolInventory.includes(name)) state.toolInventory.push(name);
        const v = registerVehicle(name) || state.vehicles.find(x => x.name === name);
        if (v) {
          if (bom.vehicle === 'plane') { const s = siteFor(p); Object.assign(v, { x: s.x, z: s.z, rotY: s.rotY }); }
          if (bom.vehicle === 'plane' || bom.vehicle === 'kart') v.fuel = Math.max(0, Math.min(100, Math.round((p.fuelGal || 0) / (bom.vehicle === 'plane' ? 10 : 1) * 100)));
          p.vehicleId = v.id;
        }
        state.unstoredItems = state.unstoredItems.filter(n => n !== name);
      } else if (bom.itemKind === 'toy') {
        state.toys.unshift({ name: bom.item, emoji: bom.emoji, from: 'my own workbench' });
        state.unstoredItems.push(bom.item);
      } else if (bom.itemKind === 'tool') {
        state.toolInventory.unshift(bom.item);
        state.unstoredItems.push(bom.item);
      } else {
        const s = siteFor(p);
        if (!p.obstacle && bom.site !== 'tree') { worldObstacles.push({ x: s.x, z: s.z, r: bom.r || 2 }); p.obstacle = true; }
      }
      p.status = 'finished';
      p.finishedAt = Date.now();
      if (bom.vehicle || bom.itemKind) removeAssemblyMesh(p.id);
      if (typeof renderVehicles3D === 'function') renderVehicles3D();
      state.changedLatelySummary = `Finished building ${aName(bom.name)} from scratch`;
      savePersistentBrainState();
      renderAllUI();
      renderBuildProjectsList();
      return true;
    }

// --- 5. Learning to fly, then flying -----------------------------------------------------------------
function pilotTrained() {
      const t = state.pilotTraining || {};
      const s = typeof skillOf === 'function' ? skillOf('flying airplane') : null;
      return Boolean(t.groundSchoolAt && t.taxiRuns >= 3 && state.knowHow && state.knowHow.airplane && s && s.level >= 1);
    }

async function learnToFly(originLabel = 'Learning to Fly') {
      const p = (state.buildProjects || []).find(x => x.bom && x.bom.vehicle === 'plane' && (x.status === 'complete' || x.status === 'finished'));
      if (!p || pilotTrained() || assemblyJobRunning) return false;
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping || state.isCollectingMail) return false;
      assemblyJobRunning = true;
      state.isPracticing = true;
      if (!state.pilotTraining) state.pilotTraining = { groundSchoolAt: null, taxiRuns: 0 };
      const tr = state.pilotTraining;
      try {
        if (!tr.groundSchoolAt) {
          const cafe = TOWN_LOCATIONS.cyber;
          state.currentLocKey = 'cyber';
          state.customPlaceName = null;
          state.targetPos = { x: cafe.x, z: cafe.z };
          state.moodEmoji = '📘';
          state.moodTitle = 'Ground school at NetNode';
          state.speechBubble = "Building an airplane doesn't make me a pilot. Ground school first.";
          renderAllUI();
          await waitForArrival(90000);
          const hops = [];
          for (const t of ['Flight training', 'Ultralight aviation', 'Stall (fluid dynamics)']) { let a = null; try { a = typeof wikiSummary === 'function' ? await wikiSummary(t) : null; } catch (e) {} if (a) hops.push({ title: a.title, url: a.url, extract: a.extract.slice(0, 280) }); }
          await sleepPace(3000);
          tr.groundSchoolAt = Date.now();
          state.knowHow.airplane = { at: Date.now(), from: 'Ground school', how: GEAR_KNOWHOW.find(g => g.key === 'airplane').how };
          state.webHistory.unshift({ query: 'Ground school: how to fly an ultralight', time: 'Just now', verdict: 'Lift, weight, thrust and drag; stalls and spins; the preflight walk-around; radio calls; and never fly over what you can\'t glide away from.', hops });
          if (state.webHistory.length > 12) state.webHistory.length = 12;
          state.diaryEntries.unshift({ time: originLabel, location: 'NetNode Cyber Cafe', mood: '📘 Ground school', vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
            text: 'Dear Diary, I did ground school: lift and drag, the stall, weight and balance, the preflight walk-around. Next is taxi practice on my own strip before I ever leave the ground.' });
          savePersistentBrainState();
        }
        // Taxi practice: rolling down the strip and back, feeling the rudder and brakes
        const site = siteFor(p);
        const m = assemblyMeshes[p.id] || (p.status === 'complete' ? placeAssemblyMesh(p) : null);
        state.currentLocKey = 'custom';
        state.customPlaceName = site.name;
        state.targetPos = siteToWorld(site, -0.15, -1.6);
        state.moodEmoji = '🛫';
        state.moodTitle = 'Taxi practice on his strip';
        renderAllUI();
        await waitForArrival(90000);
        while (tr.taxiRuns < 3) {
          state.speechBubble = ['First taxi run: slow, stick back, feet busy on the rudder.', 'Faster now: tail up, then back down. Brakes gently.', 'A crow hop: wheels just off, then straight back down. I can feel it fly!'][tr.taxiRuns] || 'Another taxi run.';
          renderAllUI();
          if (m) {
            const start = m.position.clone(), dir = new THREE.Vector3(Math.cos(site.rotY), 0, -Math.sin(site.rotY));
            // Time-based, so a slow computer takes the same few seconds per run
            const dur = 5000 * ASSEMBLY_PACE, t0 = Date.now();
            for (;;) {
              const k = Math.min(1, (Date.now() - t0) / dur), f = k <= 0.5 ? k * 2 : 2 - k * 2;
              m.position.copy(start).addScaledVector(dir, f * 4.5);
              m.position.y = start.y + (tr.taxiRuns === 2 && k > 0.3 && k < 0.55 ? 0.35 : 0);
              const prop = m.userData.inner.userData.prop;
              if (prop) prop.rotation.x += 0.9;
              if (k >= 1) break;
              await new Promise(r => setTimeout(r, 60));
            }
            m.position.copy(start);
          } else await sleepPace(3000);
          tr.taxiRuns += 1;
          if (typeof gainSkill === 'function') gainSkill('flying airplane', 'flying the airplane', 3);
          savePersistentBrainState();
        }
        state.speechBubble = pilotTrained() ? "Ground school done and three good taxi runs. I'm ready to fly it." : 'More practice before I fly.';
        state.diaryEntries.unshift({ time: originLabel, location: site.name, mood: '🛫 Taxi practice', vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: 'Dear Diary, three taxi runs up and down my strip, the last one a little crow hop. The airplane wants to fly. So do I.' });
        savePersistentBrainState();
        renderAllUI();
        if (pilotTrained() && p.status === 'complete') finishBuild(p.id);
        return true;
      } finally {
        state.isPracticing = false;
        state.microPose = 'normal';
        assemblyJobRunning = false;
      }
    }

function builtAirplane() {
      const p = (state.buildProjects || []).find(x => x.bom && x.bom.vehicle === 'plane' && x.status === 'finished' && x.vehicleId);
      const v = p && state.vehicles.find(x => x.id === p.vehicleId);
      return v ? { p, v } : null;
    }

// Fly his own airplane: off the strip over the lake, a circuit, and back down
async function flyBuiltAirplane(originLabel = 'Flying His Own Airplane') {
      const plane = (state.buildProjects || []).find(x => x.bom && x.bom.vehicle === 'plane');
      if (!plane) return 'no-plane';
      if (plane.status !== 'finished' && plane.status !== 'complete') { state.speechBubble = bomPercentBuilt(plane.bom) >= 100 ? "My airplane is built, but it doesn't fly until it has passed every inspection and test." : `My airplane is only ${bomPercentBuilt(plane.bom)}% built. It doesn't fly until it's finished and inspected.`; renderAllUI(); return 'not-built'; }
      if (!pilotTrained()) return learnToFly();
      const b = builtAirplane();
      if (!b) return finishBuild(plane.id) ? 'registered' : false;
      const { v, p } = b;
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping || state.isCollectingMail) return false;
      if (typeof readyToOperate === 'function' && !readyToOperate(v.name, v)) return 'not-ready';
      state.isPracticing = true;
      try {
        const site = siteFor(p);
        state.speechBubble = 'Preflight walk-around: fuel, oil, controls, prop, tyres. All good. Clear prop!';
        renderAllUI();
        await driveVehicle(v, { x: site.x + 10, z: site.z + 32 }, 'Flying his home-built airplane');
        state.isPracticing = true;
        await driveVehicle(v, { x: site.x, z: site.z }, 'Bringing his airplane home');
        Object.assign(v, { x: site.x, z: site.z, rotY: site.rotY });
        if (typeof renderVehicles3D === 'function') renderVehicles3D();
        const first = !p.firstFlightAt;
        if (first) p.firstFlightAt = Date.now();
        state.moodEmoji = '✈️';
        state.moodTitle = first ? 'First flight in the airplane he built!' : 'Flew his airplane';
        state.speechBubble = first ? 'I flew! In an airplane I built myself, tube by tube and rivet by rivet.' : 'What a flight. The valley looks so small from up there.';
        state.diaryEntries.unshift({ time: originLabel, location: site.name, mood: `✈️ ${first ? 'First flight' : 'Flew'}`, vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: first ? 'Dear Diary, today I flew the airplane I built. Every tube, rib and rivet passed through my hands, and it carried me up over the lake and brought me home.' : 'Dear Diary, I took my airplane up over the lake again.' });
        state.happiness = Math.min(100, state.happiness + (first ? 20 : 6));
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        state.isPracticing = false;
      }
    }

// Fixed-wing flight (called from airAltitude in js/vehicles.js): roll first, then climb, glide in
const PLANE_CRUISE = 12, PLANE_ROLL = 6;
function planeAltitude(m, v, t, u) {
      const now = performance.now() / 1000;
      const dt = Math.min(0.5, Math.max(0, now - (u.lastT ?? now)));
      u.lastT = now;
      const alt = u.alt || 0;
      let want;
      if (u.landing) want = 0;
      else if (alt < 0.05 && !u.airborne) {
        if (!u.rollFrom) u.rollFrom = { x: state.botPos.x, z: state.botPos.z };
        if (Math.hypot(state.botPos.x - u.rollFrom.x, state.botPos.z - u.rollFrom.z) > PLANE_ROLL) u.airborne = true;
        want = u.airborne ? PLANE_CRUISE : 0;
      } else {
        u.airborne = true;
        const d = Math.hypot(state.targetPos.x - state.botPos.x, state.targetPos.z - state.botPos.z);
        want = u.cruising ? Math.min(PLANE_CRUISE, d * 0.45) : PLANE_CRUISE;
        if (alt > PLANE_CRUISE * 0.75) u.cruising = true;
      }
      const rate = want > alt ? 4 : 3.2;
      u.alt = alt < want ? Math.min(want, alt + rate * dt) : Math.max(want, alt - rate * dt);
      if (u.landing && u.alt < 0.05) { u.rollFrom = null; u.airborne = false; u.cruising = false; }
      // Nose up on the climb, down on the descent
      const body = u.mini;
      if (body) body.rotation.z = Math.max(-0.15, Math.min(0.2, (u.alt - alt) / Math.max(dt, 0.01) * 0.05));
      return u.alt;
    }

// Where the takeoff roll heads: straight down the strip toward the lake
function takeoffRunFor(v) {
      const type = vehicleTypeFor(v.name);
      if (!type || type.kind !== 'plane') return null;
      const a = v.rotY || 0;
      return { x: v.x + Math.cos(a) * 26, z: v.z - Math.sin(a) * 26 };
    }

// Spin the propeller whenever he's riding his airplane
function assemblyFrame() {
      requestAnimationFrame(assemblyFrame);
      if (!state.riding || typeof vehicleMeshes === 'undefined') return;
      const m = vehicleMeshes[state.riding];
      if (m && m.userData.prop) m.userData.prop.rotation.x += 0.9;
    }

// --- 6. Brain tab, AI and talking ---------------------------------------------------------------------
function renderBuildProjectsList() {
      const el = document.getElementById('buildProjectsContainer');
      if (!el) return;
      const list = (state.buildProjects || []).slice(0, 6);
      const badge = document.getElementById('buildProjectsBadge');
      if (badge) badge.textContent = list.length ? `${list.filter(p => p.status !== 'finished').length} active` : 'none';
      const statusText = { gathering: 'gathering parts and building', testing: 'inspections and tests', complete: 'finished, inspected', finished: 'finished', abandoned: 'set aside' };
      const html = list.length ? list.map(p => {
        const b = p.bom, pct = bomPercentBuilt(b), rec = bomPercentReceived(b);
        const tools = b.tools.filter(bomToolOwned).length;
        const subs = b.subs.map(s => {
          const f = s.built ? 1 : s.stepsDone / Math.max(1, s.steps.length);
          return `<div class="flex items-center gap-2 text-[10px]">
            <span class="w-4">${s.built ? '✅' : bomSubComplete(s) ? '📦' : '○'}</span>
            <span class="flex-1 text-slate-300">${escapeHtml(s.name)}</span>
            <span class="font-mono text-slate-400">${bomSubReceived(s)}/${s.lines.length} parts</span>
            <span class="font-mono text-slate-500">${escapeHtml(bomFmtQty(bomFastenersLeft(s)))}/${escapeHtml(bomFmtQty(bomFastenerCount(s)))} fst</span>
            <span class="w-12 h-1.5 rounded bg-slate-700 overflow-hidden"><span class="block h-full bg-amber-400" style="width:${Math.round(f * 100)}%"></span></span>
          </div>`;
        }).join('');
        const tests = Object.values(p.tests || {}).map(t => `<div class="text-[10px] ${t.ok ? 'text-emerald-300' : 'text-rose-300'}">${t.ok ? '✓' : '✗'} ${escapeHtml(t.name)}: ${escapeHtml(t.note)}</div>`).join('');
        return `<div class="px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-200 space-y-1.5" data-build-project="${escapeHtml(p.id)}">
          <div class="flex items-center gap-2"><span class="font-semibold flex-1">${escapeHtml(b.emoji)} ${escapeHtml(b.name)}</span><span class="text-[10px] text-slate-400">${escapeHtml(statusText[p.status] || p.status)}</span></div>
          <div class="text-[10px] text-slate-400">${pct}% built · ${rec}% of parts received · ${tools}/${b.tools.length} tools${b.vehicle === 'plane' ? ` · pilot: ${pilotTrained() ? 'trained' : 'not yet'}` : ''}</div>
          <div class="w-full h-2 rounded bg-slate-800 overflow-hidden"><span class="block h-full bg-gradient-to-r from-amber-400 to-emerald-400" style="width:${pct}%"></span></div>
          <div class="space-y-0.5">${subs}</div>${tests}
        </div>`;
      }).join('') : '<div class="text-[11px] text-slate-500 italic">No big builds yet. He can build anything with the right parts.</div>';
      if (typeof perfSetHtml === 'function') perfSetHtml(el, html); else el.innerHTML = html;
    }

function assemblySummaryForAI() {
      const p = activeBuild();
      const done = (state.buildProjects || []).filter(x => x.status === 'finished').map(x => x.bom.name.toLowerCase());
      const parts = [];
      if (p) {
        const b = p.bom, sub = nextSubToBuild(p);
        const missing = b.subs.filter(s => !s.built).flatMap(s => s.lines.filter(l => l.got < l.qty).map(l => `${bomLineLabel(l)} (${s.name.toLowerCase()})`));
        const tools = b.tools.filter(t => !bomToolOwned(t)).map(t => t.name.toLowerCase());
        parts.push(`active build: ${b.name.toLowerCase()} (${p.status}), ${bomPercentBuilt(b)}% built, ${bomPercentReceived(b)}% of parts received${sub ? `, next sub-assembly: ${subProse(sub.name)}` : ''}`);
        parts.push(missing.length ? `parts still missing (${missing.length} lines): ${missing.slice(0, 12).join('; ')}${missing.length > 12 ? '; …' : ''}` : 'all parts are here');
        if (tools.length) parts.push(`tools still missing: ${tools.join(', ')}`);
        if (b.vehicle === 'plane') parts.push(pilotTrained() ? 'you have learned to fly' : 'you must pass ground school and taxi practice before flying it');
      } else parts.push('no big build right now');
      if (done.length) parts.push(`built from scratch so far: ${done.join(', ')}`);
      parts.push(`you can build anything with a bill of materials; built-in plans for ${Object.values(BOM_TEMPLATES).map(t => t.name.toLowerCase()).join(', ')}`);
      return parts.join('; ');
    }

function buildAnythingPromptLine() {
      return `  "buildAnything": null OR {"target": "something real to build from scratch with a full bill of materials (an airplane, a go-kart, a canoe, a shed, a drone, a guitar...)", "why": "1 sentence"} (you research it at NetNode, send your human parts lists, and build it sub-assembly by sub-assembly; only one big build at a time${activeBuild() ? '; you already have one going, so leave this null' : ''}),`;
    }

function applyBuildAnythingDecision(d) {
      if (!d || typeof d !== 'object' || typeof d.target !== 'string' || !d.target.trim() || activeBuild()) return false;
      const target = d.target.trim().slice(0, 60), why = typeof d.why === 'string' ? d.why.slice(0, 200) : '';
      doWhenFree(() => tryKey('assembly', () => researchBuild(target, why, 'Decided to Build Something Big')));
      return true;
    }

// "Build an airplane!", "What parts do you still need?", "Fly your airplane!"
function parseBuildRequest(message) {
      const m = String(message || '');
      if (/\bfly\b/i.test(m) && /\b(air ?plane|plane|ultra-?light|aircraft)\b/i.test(m) && (state.buildProjects || []).some(p => p.bom && p.bom.vehicle === 'plane')) return { fly: true };
      if (/\b(parts?|list|bill of materials|bom)\b/i.test(m) && /\b(need|missing|still|send|what)\b/i.test(m) && activeBuild()) return { list: true };
      const b = m.match(/\b(?:build|make|construct)\b(?:\s+(?:me|us|yourself))?\s+(?:an?|the|your own|a real)?\s*([a-z][a-z -]{2,40})/i);
      if (b) {
        const target = b[1].replace(/\b(from scratch|please|for me|yourself|today|now)\b.*$/i, '').trim();
        if (bomTemplateFor(target) || (typeof hasLLMKey === 'function' && hasLLMKey() && /\b(plane|kart|car|boat|canoe|kayak|shed|house|drone|guitar|bike|bicycle|cabin|trailer|robot|telescope|furniture|table)\b/i.test(target))) return { target };
      }
      return null;
    }

function answerBuildRequest(ask, visitor) {
      if (ask.fly) {
        const plane = state.buildProjects.find(p => p.bom.vehicle === 'plane');
        if (plane.status === 'gathering' || plane.status === 'testing') return sayToVisitor(bomPercentBuilt(plane.bom) >= 100 ? `Not yet, ${visitor}! My airplane is built, but it doesn't fly until it has passed its inspections.` : `Not yet, ${visitor}! My airplane is ${bomPercentBuilt(plane.bom)}% built, and it doesn't fly until it has passed its inspections.`, visitor);
        sayToVisitor(pilotTrained() ? `Okay ${visitor}! Preflight, then up over the lake.` : `I'd love to, ${visitor}, but I have to learn to fly first: ground school, then taxi practice.`, visitor);
        doWhenFree(() => flyBuiltAirplane(`Asked by ${visitor}`));
        return;
      }
      if (ask.list) {
        const p = activeBuild(), b = p.bom;
        const missing = b.subs.filter(s => !s.built && !bomSubComplete(s)).map(s => `${s.name.toLowerCase()} (${s.lines.length - bomSubReceived(s)} lines)`);
        askForLists(p);
        renderAllUI();
        return sayToVisitor(missing.length ? `For the ${b.name.toLowerCase()} I still need parts for: ${missing.join(', ')}. The full lists are on cards in the Post tab, with every quantity, and you can copy them as a shopping list.` : `I have every part for the ${b.name.toLowerCase()}! It's ${bomPercentBuilt(b)}% built.`, visitor);
      }
      const cur = activeBuild();
      if (cur) return sayToVisitor(`I'd love to, ${visitor}, but I'm in the middle of building ${aName(cur.bom.name)} (${bomPercentBuilt(cur.bom)}% built). One big build at a time!`, visitor);
      sayToVisitor(`${/^[aeiou]/i.test(ask.target) ? 'An' : 'A'} ${ask.target.toLowerCase()}? Yes! I'll research it at NetNode, write a bill of materials down to the screw, and send you the parts lists.`, visitor);
      doWhenFree(() => researchBuild(ask.target, `${visitor} asked me to`, `Asked by ${visitor}`));
    }

// --- 7. The autonomous tick (js/agent.js) ------------------------------------------------------------
// What he can do on the build right now, if anything; returns true when he started something
function assemblyWork() {
      const p = activeBuild();
      if (!p) {
        const plane = (state.buildProjects || []).find(x => x.bom && x.bom.vehicle === 'plane' && x.status === 'complete');
        if (plane && !pilotTrained()) return () => learnToFly();
        const flyer = builtAirplane();
        if (flyer && Math.random() < 0.25) return () => flyBuiltAirplane();
        return null;
      }
      if (p.status === 'gathering') {
        const sub = nextSubToBuild(p);
        if (sub && subReadiness(p, sub).ok) return () => buildNextSubAssembly(p.id);
        return null;
      }
      if (p.status === 'testing') return () => runBuildTests(p.id);
      if (p.status === 'complete') return p.bom.vehicle === 'plane' && !pilotTrained() ? () => learnToFly() : () => finishBuild(p.id);
      return null;
    }

function assemblyActivity() {
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping || state.isCollectingMail || assemblyJobRunning) return false;
      const work = assemblyWork();
      if (work) { tryKey('assembly', work); return true; }
      // Now and then he dreams up something big to build
      if (!activeBuild() && Math.random() < 0.012) {
        const done = new Set((state.buildProjects || []).map(p => p.bom.templateKey));
        const fresh = Object.keys(BOM_TEMPLATES).filter(k => !done.has(k));
        const key = pick(fresh.length ? fresh : Object.keys(BOM_TEMPLATES));
        tryKey('assembly', () => researchBuild(BOM_TEMPLATES[key].name, 'I want to see if I can build a real one from nothing but parts.', 'Dreamt Up a Big Build'));
        return true;
      }
      return false;
    }

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (!Array.isArray(state.buildProjects)) state.buildProjects = [];
    state.buildProjects.forEach(p => { if (p.bom && p.status !== 'abandoned') { p.partial = null; placeAssemblyMesh(p); } });
    renderBuildProjectsList();
    requestAnimationFrame(assemblyFrame);
    // Once a sub-assembly's parts and tools are all here, he gets building (and keeps his lists going)
    setInterval(() => {
      renderBuildProjectsList();
      const p = activeBuild();
      if (p) askForLists(p);
      const key = p ? p.id : 'flight';
      if (assemblyJobRunning || Date.now() - (assemblyQueued.get(key) || 0) < 240000) return;
      const work = assemblyWork();
      if (!work || (!p && Math.random() > 0.2)) return;
      assemblyQueued.set(key, Date.now());
      doWhenFree(async () => { try { await tryKey('assembly', work); } finally { assemblyQueued.delete(key); } });
    }, 8000);
  }, 700);
});
