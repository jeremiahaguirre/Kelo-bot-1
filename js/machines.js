// Kelo-bot-1 — js/machines.js
// Loaded after workshopbuilding.js. Using the machines in his Workshop for real.
//   - Every machine has to be learned first: he reads up on it at NetNode (researchMachine), the
//     way js/groundwork.js does groundwork. That tells him the consumables, tooling, workholding
//     and safety gear it really takes.
//   - Then he asks for what he's missing (one request card each, never twice), and once it has
//     come he goes in and runs the job, step by step, at the machine (goIntoWorkshop).
//   - Consumables are used up with useUpItem (js/itemuse.js): resin, IPA, powders, gas, wire,
//     stock, coolant... Tooling wears out the same way (an end mill lasts a few jobs).
//   - What he makes is a real thing in his inventory ('made' parts are build materials, gadgets
//     work), and every machine is a skill he gets better at (gainSkill).
// The machines themselves (models, positions, steps) are in js/additive.js, js/cnc.js,
// js/electronics.js and js/garage.js.

// --- What the machines need -------------------------------------------------------------------------
// kind: consumable (used up), tooling (wears out over jobs), workholding, safety, stock (used up)
const WORKSHOP_SUPPLIES = {
  // Printing
  filament: { ask: 'A spool of PLA filament', re: /filament/i, kind: 'consumable', special: 'filament' },
  resin: { ask: 'A 1 L bottle of grey photopolymer resin', re: /photopolymer resin|\bresin\b(?!.*cartridge)/i, kind: 'consumable', per: 4, unit: 'prints', label: 'photopolymer resin for SLA, DLP and MSLA printers', uses: ['print'] },
  ipa: { ask: 'A 4 L jug of 99% isopropyl alcohol (IPA)', re: /isopropyl|\bIPA\b/i, kind: 'consumable', per: 6, unit: 'washes', label: 'isopropyl alcohol for washing resin prints', uses: ['print', 'clean'] },
  gloves: { ask: 'A box of nitrile gloves', re: /nitrile gloves/i, kind: 'safety', per: 10, unit: 'jobs', label: 'nitrile gloves (one pair a job)', uses: ['wear', 'print'] },
  pa12: { ask: 'A 10 kg bag of PA12 nylon powder', re: /PA ?12|nylon powder/i, kind: 'consumable', per: 4, unit: 'builds', label: 'nylon PA12 powder for SLS and MJF printers', uses: ['print'] },
  steelPowder: { ask: 'A 10 kg flask of 316L stainless steel powder', re: /316L[^,]*powder|stainless steel powder|metal powder/i, kind: 'consumable', per: 3, unit: 'builds', label: 'metal powder for DMLS/SLM printing', uses: ['print'] },
  argonHP: { ask: 'A cylinder of high-purity argon', re: /high-purity argon|argon 5\.0/i, kind: 'consumable', per: 4, unit: 'builds', label: 'inert argon gas for metal printing', uses: ['print'] },
  respirator: { ask: 'A P100 half-face respirator', re: /respirator/i, kind: 'safety', label: 'a respirator for fine powders', uses: ['wear'] },
  edmWire: { ask: 'A spool of brass EDM wire', re: /EDM wire/i, kind: 'consumable', per: 4, unit: 'cuts', label: 'brass wire for the wire EDM', uses: ['cut'] },
  bandsawBlade: { ask: 'A bi-metal bandsaw blade', re: /bandsaw blade/i, kind: 'tooling', per: 8, unit: 'cuts', label: 'a bandsaw blade', uses: ['cut'] },
  fusingAgent: { ask: 'An HP 3D600 fusing agent cartridge', re: /fusing agent/i, kind: 'consumable', per: 3, unit: 'builds', label: 'fusing agent for the MJF printer', uses: ['print'] },
  detailingAgent: { ask: 'An HP 3D600 detailing agent cartridge', re: /detailing agent/i, kind: 'consumable', per: 3, unit: 'builds', label: 'detailing agent for the MJF printer', uses: ['print'] },
  polyjetCart: { ask: 'A PolyJet VeroWhite model cartridge', re: /polyjet|vero(white|clear)/i, kind: 'consumable', per: 3, unit: 'builds', label: 'PolyJet photopolymer cartridges', uses: ['print'] },
  supportCart: { ask: 'A PolyJet SUP706 support cartridge', re: /SUP70\d|support (material )?cartridge/i, kind: 'consumable', per: 3, unit: 'builds', label: 'PolyJet support material', uses: ['print'] },
  bjPowder: { ask: 'A 5 kg tub of 17-4PH binder-jet powder', re: /binder-?jet powder|17-4 ?PH/i, kind: 'consumable', per: 3, unit: 'builds', label: 'metal powder for binder jetting', uses: ['print'] },
  binder: { ask: 'A jug of binder-jet liquid binder', re: /liquid binder/i, kind: 'consumable', per: 4, unit: 'builds', label: 'liquid binder for binder jetting', uses: ['print'] },
  dedWire: { ask: 'A spool of 316L stainless welding wire', re: /stainless welding wire|316L[^,]*wire|DED wire/i, kind: 'consumable', label: 'metal wire feedstock for DED', uses: ['print', 'weld'] },
  shieldGas: { ask: 'A cylinder of argon shielding gas', re: /shielding gas/i, kind: 'consumable', label: 'argon shielding gas', uses: ['weld', 'print'] },
  weldHelmet: { ask: 'An auto-darkening welding helmet', re: /welding (helmet|hood)|auto-darkening/i, kind: 'safety', label: 'a welding helmet', uses: ['wear'] },
  tiPowder: { ask: 'A 10 kg flask of Ti-6Al-4V titanium powder', re: /titanium powder|Ti-?6Al-?4V/i, kind: 'consumable', per: 3, unit: 'builds', label: 'titanium powder for EBM', uses: ['print'] },
  lomPaper: { ask: 'A ream of LOM paper sheets', re: /LOM paper|paper sheets/i, kind: 'consumable', per: 4, unit: 'builds', label: 'paper sheets for the LOM printer', uses: ['print'] },
  lomGlue: { ask: 'A bottle of LOM adhesive', re: /LOM adhesive/i, kind: 'consumable', per: 4, unit: 'builds', label: 'adhesive for laminating', uses: ['print', 'build'] },
  lomBlade: { ask: 'A pack of LOM knife blades', re: /knife blades/i, kind: 'tooling', per: 6, unit: 'builds', label: 'knife blades for the LOM cutter', uses: ['cut'] },
  blastMedia: { ask: 'A bag of glass bead blasting media', re: /blasting media|glass beads?/i, kind: 'consumable', per: 5, unit: 'jobs', label: 'glass beads for the blast cabinet', uses: ['clean'] },
  // CNC
  endMills: { ask: 'A set of carbide end mills', re: /end mills?/i, kind: 'tooling', per: 6, unit: 'jobs', label: 'carbide end mills', uses: ['machine'] },
  vbit: { ask: 'A 60-degree V-bit', re: /v-?bit/i, kind: 'tooling', per: 8, unit: 'jobs', label: 'a V-bit for carving and signs', uses: ['machine'] },
  compBit: { ask: 'A 1/4 inch compression bit', re: /compression bit/i, kind: 'tooling', per: 8, unit: 'jobs', label: 'a compression bit for clean sheet edges', uses: ['machine'] },
  faceMill: { ask: 'A 3 inch face mill with carbide inserts', re: /face ?mill/i, kind: 'tooling', per: 6, unit: 'jobs', label: 'a face mill', uses: ['machine'] },
  plywood: { ask: 'A 4x8 sheet of Baltic birch plywood', re: /plywood/i, kind: 'stock', label: 'plywood sheet stock', uses: ['machine', 'build'] },
  mdf: { ask: 'A 4x8 sheet of MDF', re: /\bMDF\b(?!.*spoilboard)/i, kind: 'stock', per: 1, unit: 'job', label: 'MDF sheet stock', uses: ['machine', 'build'] },
  aluStock: { ask: 'A block of 6061 aluminium', re: /6061|block of [^,]*alumin|alumin(i)?um (block|bar|billet)/i, kind: 'stock', per: 1, unit: 'job', label: 'aluminium bar stock', uses: ['machine', 'build'] },
  steelStock: { ask: 'A block of 1018 steel', re: /1018|block of [^,]*\bsteel\b|steel (block|billet|bar stock)/i, kind: 'stock', per: 1, unit: 'job', label: 'steel bar stock', uses: ['machine', 'build'] },
  bigCasting: { ask: 'A large bronze propeller casting', re: /propeller casting|large casting|wing spar blank/i, kind: 'stock', per: 1, unit: 'job', label: 'a big casting for the gantry mill', uses: ['machine'] },
  clamps: { ask: 'A set of hold-down clamps', re: /hold-?down clamps|t-?track clamps|\bclamps\b/i, kind: 'workholding', label: 'hold-down clamps', uses: ['fix', 'build'] },
  spoilboard: { ask: 'A sacrificial MDF spoilboard', re: /spoilboard/i, kind: 'workholding', per: 8, unit: 'jobs', label: 'a spoilboard (resurfaced as it wears)', uses: ['machine'] },
  vacuumPump: { ask: 'A vacuum table pump', re: /vacuum (table )?pump/i, kind: 'workholding', label: 'a vacuum pump for the vacuum table', uses: ['machine'] },
  vise: { ask: 'A 6 inch Kurt machining vise', re: /\bvise\b|machining vice/i, kind: 'workholding', label: 'a machining vise', uses: ['machine'] },
  fixturePlate: { ask: 'A modular fixture plate set', re: /fixture plate|modular fixture/i, kind: 'workholding', label: 'fixtures for big parts', uses: ['machine'] },
  dustHose: { ask: 'A 4 inch dust collection hose', re: /dust (collection )?hose/i, kind: 'workholding', label: 'a hose to the dust collector', uses: ['clean'] },
  coolant: { ask: 'A 5 gal pail of water-soluble coolant', re: /coolant/i, kind: 'consumable', per: 5, unit: 'jobs', label: 'flood coolant concentrate', uses: ['machine'] },
  safetyGlasses: { ask: 'A pair of safety glasses', re: /safety (glasses|goggles|spectacles)/i, kind: 'safety', label: 'safety glasses', uses: ['wear'] },
  earDefenders: { ask: 'A pair of ear defenders', re: /ear defenders|ear muffs|earmuffs|hearing protection/i, kind: 'safety', label: 'ear defenders', uses: ['wear'] },
  // Electronics
  solderPaste: { ask: 'A jar of SAC305 solder paste', re: /solder paste/i, kind: 'consumable', per: 4, unit: 'boards', label: 'solder paste', uses: ['solder'] },
  stencil: { ask: 'A laser-cut stainless stencil', re: /stencil/i, kind: 'tooling', label: 'a solder paste stencil', uses: ['solder'] },
  reels: { ask: 'A kit of SMD component reels', re: /component reels?|SMD (component|parts)|reels of/i, kind: 'consumable', per: 4, unit: 'boards', label: 'components on reels', uses: ['solder'] },
  pcbs: { ask: 'A pack of bare FR-4 circuit boards', re: /FR-?4|copper-clad|bare [^,]*(pcb|circuit board)s?/i, kind: 'consumable', per: 4, unit: 'boards', label: 'bare circuit boards', uses: ['solder'] },
  flux: { ask: 'A bottle of no-clean flux', re: /no-clean flux|\bflux\b(?!.?core)/i, kind: 'consumable', per: 6, unit: 'boards', label: 'flux', uses: ['solder'] },
  solderBar: { ask: 'A bar of SAC305 wave solder', re: /solder bar|wave solder|bar of [^,]*solder/i, kind: 'consumable', per: 4, unit: 'boards', label: 'solder bar for the wave', uses: ['solder'] },
  acrylic: { ask: 'A sheet of clear acrylic', re: /acrylic sheet|sheet of [^,]*acrylic/i, kind: 'stock', per: 2, unit: 'panels', label: 'acrylic sheet for laser-cut panels', uses: ['machine', 'build'] },
  millBits: { ask: 'A set of PCB milling bits', re: /pcb (milling )?bits|milling bits|engraving bits/i, kind: 'tooling', per: 6, unit: 'boards', label: 'PCB milling bits', uses: ['machine'] },
  esdStrap: { ask: 'An ESD wrist strap', re: /\bESD\b|wrist strap/i, kind: 'safety', label: 'an ESD wrist strap', uses: ['wear'] },
  // Garage
  engineOil: { ask: 'A 5 L jug of 5W-30 engine oil', re: /engine oil|motor oil|5W-?30/i, kind: 'consumable', per: 1, unit: 'oil change', label: 'engine oil', uses: ['service'] },
  oilFilter: { ask: 'An oil filter', re: /oil filter/i, kind: 'consumable', per: 1, unit: 'oil change', label: 'an oil filter', uses: ['service'] },
  brakePads: { ask: 'A set of brake pads', re: /brake pads?/i, kind: 'consumable', per: 1, unit: 'brake job', label: 'brake pads', uses: ['service'] },
  tires: { ask: 'A set of four truck tires', re: /\b(truck |new )?tires\b|\btyres\b/i, kind: 'consumable', per: 1, unit: 'tire change', label: 'tires', uses: ['service'] },
  wheelWeights: { ask: 'A box of wheel weights', re: /wheel weights?/i, kind: 'consumable', per: 8, unit: 'wheels', label: 'wheel balancing weights', uses: ['service'] },
  brakeCleaner: { ask: 'A can of brake cleaner', re: /brake cleaner/i, kind: 'consumable', per: 4, unit: 'jobs', label: 'brake cleaner', uses: ['service', 'clean'] },
  solvent: { ask: 'A drum of parts washer solvent', re: /parts washer solvent|washer solvent/i, kind: 'consumable', per: 6, unit: 'jobs', label: 'parts washer solvent', uses: ['clean'] },
  gasketSet: { ask: 'An engine gasket set', re: /gasket set/i, kind: 'consumable', per: 1, unit: 'engine job', label: 'a gasket set for an engine pull', uses: ['service'] },
  plasmaKit: { ask: 'A plasma torch consumables kit', re: /plasma (torch )?consumables/i, kind: 'tooling', per: 5, unit: 'cuts', label: 'plasma electrodes and nozzles', uses: ['cut'] },
  steelPlate: { ask: 'A sheet of 10-gauge steel plate', re: /steel plate|10-gauge steel/i, kind: 'stock', per: 1, unit: 'job', label: 'steel plate', uses: ['cut', 'build'] },
  migWire: { ask: 'A spool of ER70S-6 welding wire', re: /ER70S|mild steel welding wire|mig wire/i, kind: 'consumable', label: 'MIG welding wire', uses: ['weld'] },
  airToolOil: { ask: 'A bottle of air tool oil', re: /air tool oil/i, kind: 'consumable', per: 6, unit: 'jobs', label: 'air tool oil', uses: ['service'] },
  jackStands: { ask: 'A pair of jack stands', re: /jack stands?/i, kind: 'safety', label: 'jack stands', uses: ['service'] }
};

// What each kind of thing is for (js/itemuse.js): the most specific rules go first
if (typeof ITEM_KINDS !== 'undefined') {
  const rules = [
    { kind: 'made part', label: 'a part he made in his Workshop, for builds and repairs', re: /\b(FDM|SLA|DLP|MSLA|SLS|DMLS|MJF|PolyJet|binder-jetted|DED|EBM|LOM)-(printed|built)\b|\b(Haas|Taurus|Avid|AltMill|ShopSaber|Laguna|PCB|plasma)-(machined|routed|milled|cut)\b/i, uses: ['build', 'fix', 'display'], per: 1, unit: 'build' },
    { kind: 'homemade gadget', label: 'a gadget he built in his Workshop', re: /homemade (weather station|FM radio|radio|robot-friend controller|game console)/i, uses: ['gadget', 'listen', 'play', 'measure'] }
  ];
  Object.entries(WORKSHOP_SUPPLIES).forEach(([key, s]) => {
    if (!s.label || s.special || ['dedWire', 'shieldGas', 'migWire', 'plywood'].includes(key)) return; // these keep their usual kind
    rules.push({ kind: 'ws ' + key, label: s.label, re: s.re, uses: s.uses || ['machine'], ...(s.per ? { per: s.per, unit: s.unit } : {}) });
  });
  ITEM_KINDS.unshift(...rules);
}
if (typeof ITEM_CATEGORY_KINDS !== 'undefined') {
  ITEM_CATEGORY_KINDS.made = { kind: 'made part', label: 'a part he made in his Workshop', uses: ['build', 'fix', 'display'], per: 1, unit: 'build' };
}
if (typeof PURPOSE_INFO !== 'undefined') {
  Object.assign(PURPOSE_INFO, { machine: { say: 'machining', ask: null }, solder: { say: 'soldering circuit boards', ask: null }, service: { say: 'servicing vehicles', ask: null },
    gadget: { say: 'using a gadget', ask: null }, clean: { say: 'cleaning parts', ask: null } });
}

// "An SLA-printed resin figure" -> "SLA-printed resin figure" (keeps acronyms and brand names as they are)
function wsThing(name) {
      const t = plainItem(name);
      return /^[A-Z][a-z]+\b(?!-)/.test(t) ? t[0].toLowerCase() + t.slice(1) : t;
    }

// "An SLA-printed resin miniature figure" -> "a resin miniature figure", for plain job titles
function wsWhat(name) {
      const t = plainItem(name).replace(/^\S+-(printed|built|machined|routed|milled|cut|jetted)\s+/i, '');
      const low = /^[A-Z][a-z]+\b(?!-)/.test(t) ? t[0].toLowerCase() + t.slice(1) : t;
      return (/^[aeiou]/i.test(low) ? 'an ' : 'a ') + low;
    }

// --- State ------------------------------------------------------------------------------------------
function workshopState() {
      if (!state.workshop || typeof state.workshop !== 'object') state.workshop = {};
      const w = state.workshop;
      if (!w.known || typeof w.known !== 'object') w.known = {};
      if (!Array.isArray(w.made)) w.made = [];
      if (!Number.isFinite(w.jobs)) w.jobs = 0;
      if (!w.programs || typeof w.programs !== 'object') w.programs = {};
      if (!Array.isArray(w.log)) w.log = [];
      if (!w.asked || typeof w.asked !== 'object') w.asked = {};
      return w;
    }

function machineKnown(key) {
      const def = WORKSHOP_MACHINES[key];
      const k = def && def.learnAs ? def.learnAs : key;
      return Boolean(workshopState().known[k]);
    }

function supplyOwned(key) {
      const s = WORKSHOP_SUPPLIES[key];
      if (!s) return null;
      if (s.special === 'filament') {
        if (typeof pruneSpools === 'function') pruneSpools();
        if (typeof totalFilament === 'function') return totalFilament() > 0 ? 'filament' : null;
      }
      return ownedItemNames().find(n => s.re.test(n) && !isMadeThing(n)) || null;
    }

// Things he made himself ("An SLA-printed resin miniature") are never mistaken for supplies
const MADE_THING_RE = /\b(FDM|SLA|DLP|MSLA|SLS|DMLS|MJF|PolyJet|binder-jetted|DED|EBM|LOM)-(printed|built)\b|\b(Haas|Taurus|Avid|AltMill|ShopSaber|Laguna|PCB|plasma)-(machined|routed|milled|cut)\b|\bhomemade\b|3-?D-printed/i;
function isMadeThing(name) {
      return MADE_THING_RE.test(String(name || ''));
    }

// Waiting on it already (asked, or it's at the post office)?
function supplyAwaited(key) {
      const s = WORKSHOP_SUPPLIES[key];
      if (!s) return false;
      return state.requestsToUser.some(r => !r.fulfilled && s.re.test(r.requestedGear || ''))
        || state.mailbox.some(m => s.re.test(m.name || ''))
        || (typeof filamentRequested === 'function' && s.special === 'filament' && filamentRequested());
    }

// Everything this job needs: the machine's own list plus the extras the job adds
function jobNeeds(def, job = {}) {
      const list = [...(def.needsFor ? def.needsFor(job || {}) : def.needs || []), ...(job.needs || [])];
      return [...new Set(list.map(n => (typeof n === 'string' ? n : n.key)))];
    }

function missingSupplies(def, job = {}) {
      return jobNeeds(def, job).filter(k => !supplyOwned(k));
    }

// Ready to run? If not, he goes and learns it, or asks for what's missing. Returns true when ready.
function machineReady(key, job = {}, { quiet = false, context = 'Workshop' } = {}) {
      const def = WORKSHOP_MACHINES[key];
      if (!def) return false;
      if (!machineKnown(key)) {
        if (!quiet) {
          state.speechBubble = `I've never used the ${def.name}. I'll read up on how it's really done at NetNode before I touch it.`;
          renderAllUI();
          doWhenFree(() => researchMachine(key));
        }
        return false;
      }
      const missing = missingSupplies(def, job);
      if (missing.length) {
        if (!quiet) requestSupplies(def, missing, context);
        return false;
      }
      return true;
    }

function requestSupplies(def, missing, context = 'Workshop') {
      const w = workshopState();
      const asked = [];
      missing.forEach(k => {
        const s = WORKSHOP_SUPPLIES[k];
        if (!s || supplyAwaited(k)) return;
        if (s.special === 'filament' && typeof requestFilament === 'function') { requestFilament(`The ${def.name} needs filament to print.`); asked.push(s.ask); return; }
        const why = `${def.name}: I need ${s.label || plainItem(s.ask).toLowerCase()}${s.kind === 'safety' ? ' to work safely' : s.kind === 'workholding' ? ' to hold the work down' : ''}.`;
        addItemRequest(s.ask, s.kind === 'stock' || s.kind === 'consumable' ? 'material' : 'tool', why, `${context}: ${def.name}`);
        w.asked[k] = Date.now();
        asked.push(s.ask);
      });
      const names = missing.map(k => WORKSHOP_SUPPLIES[k] ? plainItem(WORKSHOP_SUPPLIES[k].ask).toLowerCase() : k);
      state.speechBubble = `For the ${def.name} I still need ${names.join(', ')}.${asked.length ? ` I asked for ${asked.length === 1 ? 'it' : 'them'}.` : ' I\'m waiting for them to come.'}`.slice(0, 380);
      if (asked.length) showToast(`🏭 Kelo-1 asked for what the ${def.name} needs`);
      savePersistentBrainState();
      renderAllUI();
      return asked;
    }

// Use up some of a supply (the right owned thing for it). Filament comes off printer.js spools.
function useWorkshopSupply(key, amount = 1, why = '') {
      const s = WORKSHOP_SUPPLIES[key];
      if (!s) return null;
      if (s.special === 'filament') {
        if (typeof loadSpool !== 'function') return null;
        const spool = loadSpool();
        if (!spool) return null;
        const grams = Math.min(spool.grams, amount);
        spool.grams = Math.max(0, Math.round((spool.grams - grams) * 10) / 10);
        if (spool.grams <= 0 && typeof finishSpool === 'function') finishSpool(spool);
        if (typeof refreshPrinterSpool === 'function') refreshPrinterSpool();
        return { used: grams, color: spool.color, material: spool.material };
      }
      const name = supplyOwned(key);
      if (!name) return null;
      // Things that don't get used up (a respirator, a vise) are simply used
      if (typeof isConsumableItem === 'function' && !isConsumableItem(name)) return { used: 0, name };
      const r = useUpItem(name, amount, { why });
      // The last of it: he'll need more for this machine, so he asks (once)
      if (r && r.ranOut && !supplyOwned(key) && !supplyAwaited(key)) {
        addItemRequest(s.ask, s.kind === 'stock' || s.kind === 'consumable' ? 'material' : 'tool', `I used up the last of my ${wsThing(name)}${why ? ` (${why})` : ''}, and my Workshop needs more.`, 'Workshop');
        workshopState().asked[key] = Date.now();
      }
      return { ...r, name };
    }

// --- Learning a machine at NetNode -----------------------------------------------------------------
async function researchMachine(key, originLabel = 'Reading Up on a Machine') {
      const def = WORKSHOP_MACHINES[key];
      if (!def || machineKnown(key)) return false;
      if (state.isBusy || state.isBrowsing || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isBusy = true;
      state.isBrowsing = true;
      try {
        const cafe = TOWN_LOCATIONS.cyber;
        state.currentLocKey = 'cyber';
        state.customPlaceName = null;
        state.targetPos = { x: cafe.x, z: cafe.z };
        state.moodEmoji = '📘';
        state.moodTitle = `Researching the ${def.name}`.slice(0, 80);
        state.speechBubble = `Before I run the ${def.name} I want to know how it's really done, and what it needs.`;
        renderAllUI();
        await waitForArrival(60000);
        await new Promise(r => setTimeout(r, 2500));
        const hops = [];
        for (const title of def.wiki || []) {
          let article = null;
          try { article = typeof wikiSummary === 'function' ? await wikiSummary(title) : null; } catch (e) {}
          if (article) hops.push({ title: article.title, url: article.url, extract: String(article.extract || '').slice(0, 280) });
        }
        const w = workshopState();
        const learnKey = def.learnAs || key;
        const needs = jobNeeds(def).map(k => WORKSHOP_SUPPLIES[k] ? plainItem(WORKSHOP_SUPPLIES[k].ask).toLowerCase() : k);
        w.known[learnKey] = { at: Date.now(), from: hops.map(h => h.title), needs };
        // Learning a printer or a line teaches its post-processing stations too
        (def.teaches || []).forEach(k => { if (!w.known[k]) w.known[k] = { at: Date.now(), from: [def.name] }; });
        state.webHistory.unshift({ query: `How to use a ${def.name}`, time: 'Just now', verdict: def.learned, hops });
        if (state.webHistory.length > 12) state.webHistory.length = 12;
        state.moodTitle = `Learned how the ${def.name} works`.slice(0, 80);
        state.speechBubble = `${def.learned} ${needs.length ? `It takes: ${needs.join(', ')}.` : ''}`.slice(0, 400);
        state.changedLatelySummary = `Researched the ${def.name} at NetNode`;
        state.wonderLevel = Math.min(100, state.wonderLevel + 5);
        state.diaryEntries.unshift({
          time: originLabel, location: 'NetNode Cyber Cafe', mood: `📘 Learned the ${def.name}`.slice(0, 80),
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I read up on the ${def.name}${hops.length ? ` (${hops.map(h => h.title).join(', ')})` : ''}. ${def.learned}${needs.length ? ` To run it properly I need: ${needs.join(', ')}.` : ''}`
        });
        if (typeof gainSkill === 'function') gainSkill('ws-' + key, def.skill || def.name, 2);
        showToast(`📘 Kelo-1 researched the ${def.name}`);
        savePersistentBrainState();
        renderAllUI();
        setTimeout(() => machineReady(key, {}, { context: 'Getting ready' }), 1500);
        return true;
      } finally {
        state.isBusy = false;
        state.isBrowsing = false;
      }
    }

// --- Running a job ---------------------------------------------------------------------------------
let workshopJobRunning = null;

// key: the machine; job: { make: product idea, vehicle, service ... } (each machine file reads it)
async function runMachineJob(key, job = {}, originLabel = 'In the Workshop') {
      const def = WORKSHOP_MACHINES[key];
      if (!def || !def.plan) return false;
      if (workshopJobRunning || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      if (typeof buildWorkshop3D === 'function') buildWorkshop3D();
      if (!machineReady(key, job, { context: originLabel })) return 'not-ready';
      const plan = def.plan(job);
      if (!plan) return false;
      workshopJobRunning = { key, at: Date.now(), title: plan.title || '', product: plan.product || '' };
      state.isPracticing = true;
      try {
        state.currentLocKey = 'workshop';
        state.customPlaceName = "his Workshop";
        state.moodEmoji = def.emoji || '🏭';
        state.moodTitle = wsBadgeTitle(plan.title || `Using the ${def.name}`);
        state.speechBubble = plan.speech || `Off to the Workshop to use the ${def.name}.`;
        renderAllUI();
        const results = await goIntoWorkshop({ vehicle: job.vehicle || null, stops: plan.stops });
        if (!results) {
          state.speechBubble = `I couldn't get into the Workshop just now. I'll try the ${def.name} later.`;
          return false;
        }
        const ok = results.every(r => r !== false);
        const w = workshopState();
        w.jobs += 1;
        w.log.unshift({ key, at: Date.now(), ok, what: plan.product || plan.title || def.name });
        if (w.log.length > 30) w.log.length = 30;
        if (ok && plan.finish) plan.finish();
        else if (!ok && plan.failed) plan.failed();
        savePersistentBrainState();
        renderAllUI();
        return ok;
      } finally {
        workshopJobRunning = null;
        state.isPracticing = false;
      }
    }

// A step at a machine: say what's happening, animate, and earn some skill in it
// Titles fit the status badge (about 40 characters): a long one loses its "on the <machine>" tail,
// then is cut at a word
function wsBadgeTitle(t, max = 42) {
      let s = String(t || '');
      if (s.length > max) s = s.replace(/\s+(on|in|with|at) the [^,]+$/i, '');
      if (s.length > max) s = s.slice(0, max).replace(/\s+\S*$/, '');
      return s;
    }

async function machineStep(ctx, title, ms, anim = null, speech = null) {
      title = wsBadgeTitle(title);
      ctx.say(title, speech);
      if (ctx.def) ctx.work();
      // (for screenshots and debugging: window.__wsHold = 'a title pattern' holds that step mid-way)
      if (window.__wsHold && new RegExp(window.__wsHold, 'i').test(title)) {
        window.__wsHeld = title;
        const t0 = performance.now();
        while (window.__wsHold && performance.now() - t0 < 600000) {
          if (anim) { const tt = (performance.now() - t0) / 1000; try { anim(0.35 + 0.3 * ((tt / 6) % 1), tt); } catch (e) {} }
          await new Promise(r => setTimeout(r, 30));
        }
        window.__wsHeld = null;
      }
      if (anim) await ctx.animate(ms, anim);
      else await ctx.wait(ms);
    }

function machineSkill(key, amount = 6) {
      const def = WORKSHOP_MACHINES[key];
      if (!def || typeof gainSkill !== 'function') return null;
      return gainSkill('ws-' + key, def.skill || def.name, amount);
    }

function machineLevel(key) {
      const def = WORKSHOP_MACHINES[key];
      const s = def && state.skills ? state.skills['ws-' + key] : null;
      return s ? s.level : 0;
    }

// A finished part goes into his things: a 'made' part (build material) or a gadget
function addMadeThing(name, from, { gadget = false, emoji = '⚙️' } = {}) {
      const w = workshopState();
      state.belongings.unshift({ name, category: gadget ? 'gadget' : 'made', emoji, from: `his Workshop (${from})` });
      state.unstoredItems.push(name);
      w.made.unshift({ name, from, at: Date.now() });
      if (w.made.length > 40) w.made.length = 40;
      state.diaryEntries.unshift({
        time: 'Made in the Workshop', location: "his Workshop", mood: `${emoji} Made ${wsThing(name)}`.slice(0, 80),
        vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, I made ${wsThing(name)} on the ${from}. ${gadget ? 'It works, and I can use it.' : 'It goes on the shelf until a build needs it.'}`
      });
      state.happiness = Math.min(100, state.happiness + 6);
      showToast(`${emoji} Kelo-1 made ${wsThing(name)}`);
      workshopPartToAssembly(name);
      return name;
    }

// Hook for the assembly system (js/bom.js on its branch): a made part can count toward a parts list
function workshopPartToAssembly(name) {
      const hooks = ['bomReceivePart', 'bomAcceptPart', 'assemblyReceivePart', 'assemblyAcceptPart', 'bomPartArrived'];
      for (const h of hooks) {
        const fn = window[h];
        if (typeof fn === 'function') { try { fn(name, { from: 'workshop' }); } catch (e) { console.warn(h, e); } return true; }
      }
      return false;
    }

// For the assembly system: which machine could make this parts-list line, and make it
function workshopCanMake(lineName) {
      const l = String(lineName || '').toLowerCase();
      const m = Object.values(WORKSHOP_MACHINES).find(def => def.makes && def.makes.some(re => re.test(l)));
      return m ? m.key : null;
    }

function workshopMakePart(lineName) {
      const key = workshopCanMake(lineName);
      if (!key) return Promise.resolve(false);
      return runMachineJob(key, { make: lineName }, 'Making a part for a build');
    }

// --- On his own --------------------------------------------------------------------------------------
// Something sensible to do in the Workshop now: service a worn vehicle, learn an unlearned machine,
// or make something on a machine that's ready (and that he hasn't just used).
function pickWorkshopActivity() {
      if (typeof garageServiceDue === 'function') {
        const due = garageServiceDue();
        if (due) return { key: due.key, job: due.job, why: due.why };
      }
      const machines = Object.values(WORKSHOP_MACHINES).filter(d => d.plan && !d.noSolo);
      const w = workshopState();
      const recent = new Set(w.log.slice(0, 4).map(l => l.key));
      // Ready to go (known and stocked), least practised first
      const ready = machines.filter(d => machineKnown(d.key) && !missingSupplies(d).length && !recent.has(d.key))
        .sort((a, b) => machineLevel(a.key) - machineLevel(b.key));
      if (ready.length && Math.random() < 0.75) return { key: ready[0].key, job: {} };
      // Known but waiting on supplies he hasn't asked for yet
      const short = machines.filter(d => machineKnown(d.key) && missingSupplies(d).some(k => !supplyAwaited(k)));
      if (short.length && Math.random() < 0.5) return { key: short[Math.floor(Math.random() * short.length)].key, job: {} };
      // Something new to learn
      const unknown = machines.filter(d => !machineKnown(d.key));
      if (unknown.length) return { key: unknown[Math.floor(Math.random() * unknown.length)].key, job: {}, learn: true };
      return ready.length ? { key: ready[0].key, job: {} } : null;
    }

function workshopChance() {
      if (workshopJobRunning || typeof WORKSHOP_MACHINES === 'undefined') return 0;
      const due = typeof garageServiceDue === 'function' && garageServiceDue();
      if (due) return 0.2;
      return 0.1;
    }

function workshopOnMyOwn() {
      // The forklift: charge it when it's low, move a pallet now and then, or ask for one
      if (typeof forkliftOnMyOwn === 'function' && Math.random() < forkliftChance()) return forkliftOnMyOwn();
      if (typeof forkliftWanted === 'function' && Math.random() < 0.08 && forkliftWanted()) return true;
      const pick = pickWorkshopActivity();
      if (!pick) return false;
      const def = WORKSHOP_MACHINES[pick.key];
      if (!machineKnown(pick.key)) return researchMachine(pick.key, 'Curious About a Machine');
      if (!machineReady(pick.key, pick.job, { context: 'Planning a Workshop job' })) return false;
      if (pick.why) state.speechBubble = pick.why;
      return runMachineJob(pick.key, pick.job, `Felt like using the ${def.name}`);
    }

// The AI chose a machine: {"machine": "the Haas VS-1", "make": "a bracket", "why": "..."}
function findMachineByText(text) {
      const t = String(text || '').toLowerCase();
      if (!t) return null;
      const all = Object.values(WORKSHOP_MACHINES).filter(d => d.plan);
      return all.find(d => (d.words || []).some(re => re.test(t))) || all.find(d => t.includes(String(d.short || d.name).toLowerCase())) || null;
    }

function useMachineDecision(um) {
      if (!um || typeof um !== 'object') return false;
      const def = findMachineByText(um.machine) || findMachineByText(um.make);
      if (!def) return false;
      const job = { make: typeof um.make === 'string' ? um.make.slice(0, 80) : '' };
      if (def.key === 'garage' || def.kind === 'garage') job.service = typeof um.make === 'string' ? um.make : '';
      doWhenFree(() => {
        if (!machineKnown(def.key)) return researchMachine(def.key, 'Decided to Learn a Machine');
        return runMachineJob(def.key, job, 'Decided to Use a Machine');
      });
      return true;
    }

// --- Visitors: "machine me a bracket on the Haas" ---------------------------------------------------------
const WORKSHOP_ASK_VERBS = /\b(machine|mill|print|3d.?print|route|rout|carve|cut|make|build|fabricate|weld|service|change|fix|solder|turn|plasma)\b/i;
function parseWorkshopAsk(message) {
      const m = String(message || '');
      if (!WORKSHOP_ASK_VERBS.test(m)) return null;
      const def = findMachineByText(m);
      if (!def) return null;
      const what = (m.match(/\b(?:me|us)\s+(?:an?|some|the)?\s*([a-z0-9 \-]{3,40}?)\s+(?:on|with|using|in)\b/i) || m.match(/\b(?:make|print|machine|mill|cut|route|build)\s+(?:me\s+)?(?:an?|some|the)?\s*([a-z0-9 \-]{3,40}?)(?:\s+(?:on|with|using|in)\b|[.!?]|$)/i) || [])[1] || '';
      return { def, what: what.trim() };
    }

function answerWorkshopAsk(ask, visitor) {
      const def = ask.def;
      const raw = ask.what || '';
      const what = raw ? (/^(an?|the|some|my)\s/i.test(raw) ? raw : `${/^[aeiou]/i.test(raw) ? 'an' : 'a'} ${raw}`) : (def.products ? wsWhat(def.products[0]) : 'something');
      const busy = workshopJobRunning || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping;
      let reply;
      if (!machineKnown(def.key)) reply = `I'd love to, ${visitor}! I haven't learned the ${def.name} yet, so first I'll read up on it at NetNode, then get what it needs.`;
      else if (missingSupplies(def, {}).length) reply = `Okay ${visitor}! The ${def.name} still needs ${missingSupplies(def).map(k => plainItem(WORKSHOP_SUPPLIES[k].ask).toLowerCase()).join(', ')}, so I'll ask for that first.`;
      else reply = busy ? `Okay ${visitor}! As soon as I'm free I'll make ${what} on the ${def.name}.` : `Okay ${visitor}! Off to the Workshop to make ${what} on the ${def.name}.`;
      if (typeof sayToVisitor === 'function') sayToVisitor(reply, visitor);
      workshopAsks.push({ key: def.key, job: { make: what, visitor } });
      setTimeout(takeWorkshopAsk, 1500);
    }

const workshopAsks = [];
function takeWorkshopAsk() {
      if (!workshopAsks.length || workshopJobRunning) return false;
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) { setTimeout(takeWorkshopAsk, 8000); return false; }
      const ask = workshopAsks.shift();
      if (!machineKnown(ask.key)) { researchMachine(ask.key, 'A Visitor Asked'); workshopAsks.unshift(ask); setTimeout(takeWorkshopAsk, 20000); return true; }
      if (!machineReady(ask.key, ask.job, { context: 'A visitor asked' })) return true;
      runMachineJob(ask.key, ask.job, 'A Visitor Asked');
      return true;
    }

// Hook js/skills.js's request parser if it's there: workshop requests are checked first
if (typeof parseUseRequest === 'function' && typeof answerUseRequest === 'function') {
  const baseParse = parseUseRequest, baseAnswer = answerUseRequest;
  parseUseRequest = function (message) {
    const ws = parseWorkshopAsk(message);
    if (ws) return { candidate: { workshop: true }, workshop: ws };
    return baseParse(message);
  };
  answerUseRequest = function (ask, visitor) {
    if (ask && ask.workshop) return answerWorkshopAsk(ask.workshop, visitor);
    return baseAnswer(ask, visitor);
  };
}

// --- For the AI and the Brain tab -------------------------------------------------------------------------
function workshopStatusLine() {
      const all = Object.values(WORKSHOP_MACHINES).filter(d => d.plan);
      const known = all.filter(d => machineKnown(d.key));
      const ready = known.filter(d => !missingSupplies(d).length);
      const w = workshopState();
      const worn = typeof garageServiceDue === 'function' ? garageServiceDue() : null;
      return `${known.length} of ${all.length} machines learned; ready to use: ${ready.map(d => d.short || d.name).slice(0, 10).join(', ') || 'none yet'}`
        + `; waiting on supplies: ${known.filter(d => missingSupplies(d).length).map(d => d.short || d.name).slice(0, 6).join(', ') || 'none'}`
        + `; ${w.jobs} jobs done${w.made.length ? `, last made ${w.made[0].name}` : ''}${worn ? `; ${worn.why}` : ''}`;
    }

function workshopPromptLine() {
      return `  "useMachine": null OR {"machine": "one of your Workshop machines (e.g. 'the Haas VS-1', 'the SLA printer', 'the Avid router', 'the garage lift')", "make": "what to make or which service (a bracket, a sign, a weather station, an oil change...)", "why": "1 sentence"} (you research a machine first and ask for its consumables, tooling and safety gear before using it),`;
    }

function renderWorkshopBrain() {
      const el = document.getElementById('workshopListContainer');
      if (!el) return;
      const groups = [['🖨️ 3D printers', 'printer'], ['🧽 Post-processing', 'post'], ['🛠️ CNC', 'cnc'], ['🔌 Electronics (floor 2)', 'electronics'], ['🚗 Garage (floor 2)', 'garage'], ['🔥 Glass studio (floor 3)', 'glass'], ['🪵 Woodshop (floor 3)', 'wood']];
      const w = workshopState();
      const html = groups.map(([title, kind]) => {
        const defs = Object.values(WORKSHOP_MACHINES).filter(d => d.kind === kind && d.key !== 'printbench');
        if (!defs.length) return '';
        return `<div class="text-2xs uppercase tracking-wide text-slate-500 mt-1">${title}</div>` + defs.map(d => {
          const known = machineKnown(d.key);
          const missing = known ? missingSupplies(d) : [];
          const lvl = machineLevel(d.key);
          const supplies = jobNeeds(d).map(k => {
            const s = WORKSHOP_SUPPLIES[k];
            const have = supplyOwned(k);
            const note = have && have !== 'filament' && typeof supplyNote === 'function' ? supplyNote(have) : have === 'filament' && typeof totalFilament === 'function' ? `${Math.round(totalFilament())} g` : '';
            return `<span class="${have ? 'text-emerald-300' : supplyAwaited(k) ? 'text-amber-300' : 'text-slate-500'}">${escapeHtml(plainItem(s ? s.ask : k).replace(/^(a|an)\s+/i, ''))}${note ? ` (${escapeHtml(note)})` : ''}</span>`;
          }).join(' · ');
          const status = !known ? '<span class="text-slate-400">not learned yet</span>' : !d.plan ? '<span class="text-sky-300">learned</span>' : missing.length ? `<span class="text-amber-300">needs ${missing.length} thing${missing.length > 1 ? 's' : ''}</span>` : '<span class="text-emerald-300 font-bold">ready</span>';
          return `<div class="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-2xs text-slate-200">
            <div class="flex items-center gap-2"><span class="flex-1">${d.emoji || '⚙️'} ${escapeHtml(d.name)}</span>${known ? `<span class="text-amber-300 font-bold">Lv ${escapeHtml(lvl)}</span>` : ''} ${status}</div>
            ${known ? `<div class="text-2xs mt-0.5 leading-snug">${supplies}</div>` : ''}
          </div>`;
        }).join('');
      }).join('');
      const made = w.made.length ? `<div class="text-2xs uppercase tracking-wide text-slate-500 mt-1">Made lately</div><div class="text-2xs text-slate-300">${w.made.slice(0, 6).map(m => escapeHtml(m.name)).join(', ')}</div>` : '';
      const vehicles = typeof garageConditionHtml === 'function' ? garageConditionHtml() : '';
      const out = html + made + vehicles || '<div class="text-2xs text-slate-500 italic">His Workshop is being built.</div>';
      if (typeof perfSetHtml === 'function') perfSetHtml(el, out); else el.innerHTML = out;
    }

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    workshopState();
    renderWorkshopBrain();
    setInterval(renderWorkshopBrain, 5000);
  }, 0);
});
