// Kelo-bot-1 — js/shopmaker.js
// Loaded after forklift.js, once every shop machine is registered (js/machines.js and the machine files).
// Making real, usable things in his own shops, from ideas he reads about on the real internet.
//   - What a thing is for is not a fixed list: things he makes or learns about get a kind and purposes
//     (sit, store, hold drinks, hold food, hold flowers, play, display...) that are registered with the
//     item-use rules (js/itemuse.js) at runtime and saved (state.makerKinds), so new kinds just work.
//   - Ideas come from NetNode: Wikipedia via wikiSummary / lookUpAnywhere. With an AI key the AI proposes
//     what it is, its materials, purposes and which of his shops can make it; without one a deterministic
//     reading of the article does (makerReadArticle). MAKER_CAPS says what each shop can make from what.
//   - If one shop can make the whole thing there is no parts list: he orders only that shop's missing
//     supplies through the Post Office (machineReady -> addItemRequest), waits, and makes it
//     (state.makerOrders). Otherwise he writes a real bill of materials (js/bom.js, js/assembly.js):
//     parts a shop of his can make are marked "I'll make this on the <machine>" and made there, those
//     shops' supplies go on the list too, and he builds only with what arrives.
//   - Practical things go to the Storehouse and he uses them: he sits on a stool he made, a shelf holds
//     things, a cup holds his drink, a bowl his food, a vase flowers. Only art goes to the Museum.
//   - Visitors: "make me a stool" is routed to the right shop, or politely declined.
// The hard-coded products and BOM_TEMPLATES stay as the fallback and the examples.

// --- 1. Purposes --------------------------------------------------------------------------------------
const MAKER_PURPOSES = ['sit', 'store', 'hold drinks', 'hold food', 'hold flowers', 'play', 'ride', 'display', 'light', 'music', 'build', 'fix', 'wear', 'read', 'measure', 'gadget', 'listen'];
Object.assign(PURPOSE_INFO, {
  sit: { say: 'sitting on', ask: null }, store: { say: 'holding and storing things', ask: null },
  'hold drinks': { say: 'holding a drink', ask: null }, 'hold food': { say: 'holding food', ask: null }, 'hold flowers': { say: 'holding flowers', ask: null }
});
PURPOSE_WORDS.unshift(
  [/\bsit (?:on|in|down)\b|\bsitting\b|have a seat/i, 'sit'],
  [/drink (?:out )?of|hold (?:a |my )?(?:drink|tea|coffee|water)/i, 'hold drinks'],
  [/(?:eat|food) (?:out )?of (?:the |my )?(?:bowl|dish|plate)/i, 'hold food'],
  [/flowers? in (?:the |my )?vase|arrange (?:the )?flowers/i, 'hold flowers'],
  [/\bstore (?:things|stuff|it)|keep (?:things|stuff) (?:on|in)|put (?:things|stuff) (?:on|in)/i, 'store']
);
VETTED_PURPOSES.push('sit', 'store', 'hold drinks', 'hold food', 'hold flowers');
// Things looked up at NetNode (lookUpItemUse) can turn out to be seats, storage or drinkware too
LOOKUP_PURPOSES.unshift([/\b(stool|chair|bench|seat furniture|a seat)\b/, 'seat'], [/\b(shelf|shelving|bookcase|cabinet|storage)\b/, 'storage'],
  [/\b(drinking vessel|cup|mug|tumbler)\b/, 'drinkware'], [/\b(bowl|dish|plate)\b/, 'dish'], [/\bvase\b/, 'vase']);

// Kinds of things he made himself (first match wins; checked before the general kinds)
const MAKER_KINDS = [
  { kind: 'art piece', label: 'a piece of art for his Museum', words: /sculpture|figurine|statue|\bbust\b|abstract|art piece|artwork|ornament|miniature figure|bas-relief/i, uses: ['display'], art: true },
  { kind: 'seat', label: 'a seat he made, to sit on', words: /\bstools?\b|\bchairs?\b|(?<!work|test )\bbench\b|\bseat\b(?! back)|ottoman|footstool/i, uses: ['sit', 'display'] },
  { kind: 'drinkware', label: 'a cup that holds drinks', words: /\bcups?\b|\bmugs?\b|tumbler|goblet|\bbeaker\b|drinking glass/i, uses: ['hold drinks', 'display'] },
  { kind: 'dish', label: 'a bowl or dish that holds food', words: /\bbowls?\b|\bplates?\b|\bdish\b|platter/i, uses: ['hold food', 'display'] },
  { kind: 'vase', label: 'a vase that holds flowers', words: /\bvases?\b|planter|flower pot/i, uses: ['hold flowers', 'display'] },
  { kind: 'storage', label: 'something that holds and stores things', words: /shel(f|ves|ving)|bookcase|\bbox\b|\bchest\b|(?<!door )\bcabinet\b(?! door)|crate|organi[sz]er|\brack\b|\bholder\b|\bbin\b|caddy|\bstand\b|\btray\b|\bhooks?\b/i, uses: ['store', 'display'] },
  { kind: 'table', label: 'a table that holds things', words: /\b(side |coffee |end )?table\b(?! saw| top)|\bdesk\b/i, uses: ['store', 'display'] },
  { kind: 'sign', label: 'a sign to put up', words: /\bsign\b|plaque|nameplate/i, uses: ['display'] },
  { kind: 'lamp', label: 'a lamp for light', words: /\blamp\b|lantern|night ?light/i, uses: ['light', 'display'] }
];

// Did he make it himself? (a part, a piece of furniture, glass, a print...)
const MAKER_MADE_RE = /\b(handmade|hand-made|hand-blown|turned|dovetailed|laser-cut|woodshop-made|home-built|homemade|shop-made|welded|cast concrete|wire-EDM-cut|garage-fabricated)\b/i;
function makerIsHisOwn(name) {
      const n = String(name || '');
      if (!n) return false;
      if ((typeof isMadeThing === 'function' && isMadeThing(n)) || MADE_THING_RE.test(n) || MAKER_MADE_RE.test(n)) return true;
      const lower = n.toLowerCase();
      if (state.makerThings && state.makerThings[lower]) return true;
      return (state.belongings || []).some(b => b.name === n && (b.category === 'made' || b.from === 'his own build'));
    }

ITEM_KINDS.unshift(...MAKER_KINDS.map(k => ({ kind: k.kind, label: k.label, uses: k.uses, art: Boolean(k.art), test: n => makerIsHisOwn(n) && k.words.test(n) })));
// Looked-up things (not made by him) of the same sorts
Object.assign(GENERIC_KINDS, {
  seat: { kind: 'seat', label: 'a seat to sit on', uses: ['sit', 'display'] }, storage: { kind: 'storage', label: 'something that holds and stores things', uses: ['store', 'display'] },
  drinkware: { kind: 'drinkware', label: 'a cup that holds drinks', uses: ['hold drinks', 'display'] }, dish: { kind: 'dish', label: 'a bowl that holds food', uses: ['hold food', 'display'] },
  vase: { kind: 'vase', label: 'a vase that holds flowers', uses: ['hold flowers', 'display'] }
});

// --- 2. Kinds learned at runtime (saved) ----------------------------------------------------------------
// state.makerKinds: { key: { kind, label, uses, nouns: [..], art, from, at } }
// state.makerThings: { lower name: key } (things he made or planned, so their kind is known at once)
function makerState() {
      if (!state.makerKinds || typeof state.makerKinds !== 'object') state.makerKinds = {};
      if (!state.makerThings || typeof state.makerThings !== 'object') state.makerThings = {};
      if (!Array.isArray(state.makerOrders)) state.makerOrders = [];
      if (!state.makerUses || typeof state.makerUses !== 'object') state.makerUses = {};
      return state;
    }

const makerRegistered = new Set();
function makerEscape(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function makerRegisterRule(key) {
      const k = makerState().makerKinds[key];
      if (!k || makerRegistered.has(key)) return null;
      const nouns = (k.nouns || []).filter(w => /^[a-z][a-z -]{1,30}$/.test(w));
      if (!nouns.length) return null;
      const re = new RegExp(`\\b(${nouns.map(makerEscape).join('|')})s?\\b`, 'i');
      const rule = { kind: k.kind, label: k.label, uses: k.uses.slice(), art: Boolean(k.art), learned: true,
        test: n => state.makerThings && state.makerThings[String(n).toLowerCase()] === key || (makerIsHisOwn(n) && re.test(n)) };
      ITEM_KINDS.unshift(rule);
      makerRegistered.add(key);
      return rule;
    }

// Register a kind of thing (from an article, the AI, or a visitor's ask). Purposes are checked against
// the ones he knows how to do; a thing with none is for display.
function makerRegisterKind(spec, names = []) {
      const s = makerState();
      const noun = String(spec.noun || '').toLowerCase().replace(/[^a-z -]/g, '').trim().slice(0, 30);
      if (!noun) return null;
      const known = MAKER_KINDS.find(k => k.words.test(noun));
      let uses = (spec.purposes || []).filter(p => MAKER_PURPOSES.includes(p));
      if (!uses.length) uses = known ? known.uses.slice() : ['display'];
      if (!uses.includes('display') && !spec.art) uses.push('display');
      const key = 'learned ' + noun;
      s.makerKinds[key] = { kind: key, label: String(spec.label || `${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}, for ${uses.filter(u => u !== 'display').map(purposeSay).join(' and ') || 'display'}`).slice(0, 120),
        uses: spec.art ? ['display'] : uses, nouns: [...new Set([noun, ...(spec.nouns || [])].map(w => String(w).toLowerCase()))].slice(0, 6), art: Boolean(spec.art),
        from: spec.from || null, at: Date.now() };
      names.forEach(n => { if (n) s.makerThings[String(n).toLowerCase()] = key; });
      makerRegistered.delete(key);
      const old = ITEM_KINDS.findIndex(r => r.learned && r.kind === key);
      if (old >= 0) ITEM_KINDS.splice(old, 1);
      makerRegisterRule(key);
      names.forEach(n => { if (n) { state.itemPurposes = state.itemPurposes || {}; state.itemPurposes[String(n).toLowerCase()] = { kind: key, from: spec.from || 'his own shop', at: Date.now() }; } });
      savePersistentBrainState();
      return s.makerKinds[key];
    }

// --- 3. What his shops can make ---------------------------------------------------------------------------
// key: the shop (a WORKSHOP_MACHINES machine, or one of MAKER_OUTSIDE_SHOPS); mat: materials it works;
// forms: things it can make whole (null: it makes nothing whole); part: the made-name pattern for a product;
// maxCm: the biggest thing it can make, from the real machine's build volume, bed, travel or swing;
// run: the WORKSHOP_MACHINES key whose plan does the job when that differs from key.
const MAKER_CAPS = [
  { key: 'woodshop', mat: ['wood'], maxCm: 240, forms: /stool|chair|bench|table|desk|shel(f|ves)|bookcase|box|chest|cabinet|frame|rack|crate|birdhouse|caddy|organi[sz]er|holder|tray|toy|furniture|board|stand|legs?|seat|top|base|lid|door|drawer|panel/i,
    name: (noun, m) => `A handmade ${m || 'maple'} ${noun}`, wood: true },
  { key: 'woodturning', mat: ['wood'], maxCm: 40, forms: /bowl|cup|mug|goblet|vase|spindle|handle|knob|candlestick|rolling pin|spinning top|base|finial/i,
    name: (noun, m) => `A turned ${m || 'cherry'} ${noun}`, wood: true },
  { key: 'glassstudio', mat: ['glass'], maxCm: 45, forms: /vase|bowl|cup|mug|tumbler|goblet|ornament|paperweight|shade|lampshade|bottle|float|sculpture|marble|globe|dish/i,
    name: noun => `A hand-blown glass ${noun}` },
  { key: 'fdm', mat: ['plastic'], maxCm: 25, forms: /bracket|clip|mount|stand|holder|hook|case|enclosure|knob|toy|figure|organi[sz]er|cup|planter|spinning top|whistle|gear|box|cover|caddy/i,
    name: noun => `An FDM-printed PLA ${noun}`, small: true },
  { key: 'sla', mat: ['resin'], maxCm: 18, forms: /figure|figurine|miniature|ring|jewel|statue|lens|bust/i, name: noun => `An SLA-printed resin ${noun}`, small: true },
  // EOS Formiga P 110: 200 x 250 x 330 mm of nylon powder, no supports
  { key: 'sls', mat: ['nylon', 'plastic'], maxCm: 33, forms: /hinge|clip|duct|bracket|housing|enclosure|gear|drone arm|lattice|snap|buckle|case|holder|grip|knob|chain|toy/i,
    name: noun => `An SLS-printed nylon ${noun}`, small: true },
  // HP Jet Fusion 5200: 380 x 284 x 380 mm
  { key: 'mjf', mat: ['nylon', 'plastic'], maxCm: 38, forms: /pedal|gear|insole|housing|bracket|enclosure|clip|duct|lattice|handle|grip|case|manifold|orthotic/i,
    name: noun => `An MJF-printed nylon ${noun}`, small: true },
  // Stratasys J850: 490 x 390 x 200 mm, full colour and clear photopolymer
  { key: 'polyjet', mat: ['resin', 'plastic'], maxCm: 49, forms: /prototype|model|figure|figurine|statue|bust|lens|enclosure|anatomical|miniature|sculpture|light pipe|mock-?up/i,
    name: noun => `A PolyJet-printed photopolymer ${noun}`, small: true },
  // Mcor paper LOM: an A4 sheet stack, 256 x 169 x 150 mm
  { key: 'lom', mat: ['paper'], maxCm: 25, forms: /model|architectural|pattern|mold|mould|prototype|figurine|bust|terrain|map/i,
    name: noun => `A LOM-built paper ${noun}`, small: true },
  { key: 'avid4896', mat: ['wood', 'plywood'], maxCm: 240, forms: /sign|plaque|panel|puzzle|template|letters|cutout|shelf|board|coaster/i, name: noun => `An Avid-routed plywood ${noun}` },
  { key: 'laser', mat: ['acrylic'], maxCm: 60, forms: /sign|panel|stand|box|ornament|coaster|cover|plaque/i, name: noun => `A laser-cut acrylic ${noun}` },
  // The Welding Studio: steel sections and plate, cut, fitted and welded on a 4 x 8 ft table
  { key: 'weldstudio', mat: ['steel', 'stainless', 'aluminium', 'metal'], maxCm: 300, outside: true,
    forms: /bench|table|chair|stool|frame|rack|gate|grill|bbq|barbecue|fire pit|cart|stand|shel(f|ves)|planter|sculpture|railing|hook|bracket|box|bed frame|arch|trellis|wheelbarrow|mailbox|bike rack|coat rack|candle holder|workbench|sawhorse|ladder|trailer|frame|cage|basket|lantern|wind ?vane|weather ?vane|bird feeder|log rack|tool rack|anvil stand|tripod|easel/i,
    name: (noun, m) => `A welded ${m === 'aluminium' ? 'aluminium' : m === 'stainless' ? 'stainless steel' : 'steel'} ${noun}` },
  // The batch plant's ready-mix, cast in a form in the plant yard (it cures before it is moved)
  { key: 'batchplant', mat: ['concrete'], maxCm: 250, outside: true,
    forms: /bench|planter|stepping stones?|bird ?bath|paver|block|slab|post base|countertop|garden edging|bollard|pad|footing|pier|fire ring|\bpot\b|trough|statue base|steps?|bowl|sphere|table/i,
    name: noun => `A cast concrete ${noun}` },
  // The garage: its MIG/TIG welder and plasma table do vehicle fabrication (hitches, racks, bumpers)
  { key: 'garage', run: 'migtig', mat: ['steel'], maxCm: 400, forms: /trailer hitch|hitch|exhaust|roll ?(bar|cage)|bumper|skid plate|tow bar|bull bar|roof rack|kart frame|go-?kart chassis|ladder rack|truck rack|trailer/i,
    name: noun => `A garage-fabricated steel ${noun}` },
  { key: 'haasvs1', mat: ['aluminium', 'steel'], maxCm: 50, forms: /bracket|plate|hub|knob|mount|bottle opener|block|part|spindle|pedal/i, name: (noun, m) => `A Haas-machined ${m === 'steel' ? 'steel' : 'aluminium'} ${noun}` },
  { key: 'plasma', mat: ['steel'], maxCm: 120, forms: /gusset|bracket|sign|silhouette|plate|wall art|stencil|coaster|tag|cutout|plaque/i, name: noun => `A plasma-cut steel ${noun}` },
  // Sodick wire EDM: 400 x 300 x 250 mm travel, cuts any conductive plate to a profile
  { key: 'edm', mat: ['steel', 'stainless', 'aluminium', 'titanium', 'metal'], maxCm: 40, forms: /gear|punch|die|key\b|spline|sprocket|cam\b|bracket|tool|blade|bottle opener|template|plate|pawl|ratchet/i,
    name: (noun, m) => `A wire-EDM-cut ${m === 'aluminium' ? 'aluminium' : m === 'titanium' ? 'titanium' : 'steel'} ${noun}`, small: true },
  // EOS M 290: 250 x 250 x 325 mm of stainless powder
  { key: 'dmls', mat: ['stainless', 'steel', 'metal'], maxCm: 32, forms: /nozzle|manifold|bracket|impeller|heat exchanger|valve|lattice|insert|turbine|gear|bottle opener|ring/i,
    name: noun => `A DMLS-printed stainless ${noun}` , small: true },
  // ExOne InnoventX: 160 x 65 x 65 mm
  { key: 'binder', mat: ['stainless', 'steel', 'metal'], maxCm: 16, forms: /impeller|gear|sprocket|bracket|bushing|figurine|key|ring|bottle opener|small part/i,
    name: noun => `A binder-jetted stainless ${noun}`, small: true },
  // A wire-arc DED robot: big near-net shapes within the arm's reach, then machined
  { key: 'ded', mat: ['stainless', 'steel', 'metal'], maxCm: 90, forms: /flange|blade|turbine|shaft|propeller|ring|nozzle|boss|large bracket/i,
    name: noun => `A DED-built stainless ${noun}` },
  // Arcam Q10: 200 x 200 x 180 mm of titanium
  { key: 'ebm', mat: ['titanium'], maxCm: 20, forms: /implant|bracket|lattice|cup|cage|bike part|dropout|lug|ring|bottle opener/i,
    name: noun => `An EBM-printed titanium ${noun}`, small: true },
  // The support-removal waterjet only blasts PolyJet support away; it makes nothing whole
  { key: 'waterjet', mat: ['resin'], maxCm: 49, forms: null, finishes: 'polyjet' },
  { key: 'pcbline', mat: ['electronics'], maxCm: 30, forms: /radio|weather station|controller|console/i, name: noun => `A homemade ${noun}` },
  { key: 'pcbmill', mat: ['electronics'], maxCm: 20, forms: /circuit|board|controller|pcb|electronics/i, name: noun => `A PCB-milled ${noun}` }
];

// How big a thing is (its largest dimension in cm), from what it is: the too-big rule for each shop
const MAKER_SIZES = [
  [/\b(shed|cabin|house|garage|barn|boat|canoe|kayak|car|truck|trailer|plane|aircraft|bridge|greenhouse|gazebo|pergola|deck)\b/i, 450],
  [/\b(arch|bed frame|workbench|bed|ladder|gate|railing|countertop|slab|pad|steps|bench|trellis)\b/i, 200],
  [/\b(table|desk|bookcase|cabinet|chest|bird ?bath|fire pit|grill|bbq|barbecue|cart|wheelbarrow|coat rack|mailbox|bike rack|log rack|sawhorse|easel|propeller|chair|rack|bumper|roof rack|hitch|blade|bollard)\b/i, 110],
  [/\b(stool|box|lamp|birdhouse|bird feeder|stepping stones?|planter|tray|caddy|sign|sculpture|statue|bust|shel(f|ves)|stand|crate|footstool|manifold|flange|panel|frame|lantern|trough|paver|block|board|turbine|prototype)\b/i, 45],
  [/\b(cup|mug|tumbler|goblet|bracket|gear|impeller|bowl|vase|candle|handle|mount|holder|case|enclosure|hinge|pedal|sprocket|plaque|insole|implant|duct|plate|spindle|hub|nozzle|figure|figurine|whistle|toy|top|model)\b/i, 18],
  [/\b(ring|jewel\w*|bead|key|clip|knob|button|insert|lens|marble|miniature|coaster|paperweight|ornament|bottle opener|hook|tag)\b/i, 6]
];
function makerSizeCm(noun) {
      // The head noun decides ("trailer hitch" is a hitch, "bench vise" a vise), then the whole name
      const n = String(noun || '').toLowerCase().replace(/\s*\(.*\)$/, '').trim();
      const head = n.split(/\s+/).pop();
      const hit = MAKER_SIZES.find(([re]) => re.test(head)) || MAKER_SIZES.find(([re]) => re.test(n));
      return hit ? hit[1] : 30;
    }
function makerFits(cap, noun) { return !cap.maxCm || makerSizeCm(noun) <= cap.maxCm; }
// One of the shop's forms, or one of the products its machine already lists (WORKSHOP_MACHINES makes:)
function makerFormOk(cap, form) {
      if (!cap || !cap.forms) return false;
      if (cap.forms.test(form)) return true;
      const def = typeof WORKSHOP_MACHINES !== 'undefined' && WORKSHOP_MACHINES[cap.run || cap.key];
      return Boolean(def && Array.isArray(def.makes) && def.makes.some(re => re.test(String(form).toLowerCase())));
    }

// Materials and the words articles use for them; the ones with no shop are noted so he can say so
const MAKER_MATERIALS = [
  ['wood', /\b(wood(en)?|timber|lumber|oak|maple|pine|cedar|walnut|cherry|birch|beech|bamboo|ash)\b/i],
  ['plywood', /\bplywood\b/i],
  ['glass', /\b(?<!fibre|fiber)glass\b(?!es)/i],
  ['acrylic', /\b(acrylic|plexiglass|perspex)\b/i],
  ['resin', /\b(resin|photopolymer)\b/i],
  ['nylon', /\b(nylon|polyamide|PA ?12)\b/i],
  ['plastic', /\b(plastics?|polymer|polypropylene|polyethylene|polystyrene|nylon|abs|pla)\b/i],
  ['aluminium', /\balumin(i)?um\b/i],
  ['stainless', /\bstainless\b/i],
  ['titanium', /\btitanium\b/i],
  ['steel', /\b(steel|iron|metal|metals|wrought)\b/i],
  ['concrete', /\b(concrete|cement|cast stone)\b/i],
  ['electronics', /\b(electronic|circuit|transistor|microcontroller|integrated circuit)\b/i],
  ['ceramic', /\b(ceramic|porcelain|stoneware|earthenware|china|clay|pottery)\b/i],
  ['fabric', /\b(fabric|textile|cloth|leather|upholster\w*|canvas|cushion(ed|ing)?|wool|cotton)\b/i],
  ['stone', /\b(stone|marble|granite)\b/i],
  ['paper', /\b(paper|cardboard)\b/i],
  ['rubber', /\brubber\b/i]
];
const MAKER_WOODS = /\b(oak|maple|pine|cedar|walnut|cherry|birch|beech|ash|bamboo)\b/i;
// Bought components: nothing in his shops makes these
const MAKER_BOUGHT = [
  ['light bulb', /\b(light )?bulbs?\b/i, 1, ''], ['lamp socket', /\bsockets?\b|lampholder/i, 1, ''], ['power cord with plug', /\b(power )?cords?\b|\bplugs?\b|\bflex\b/i, 1, ''],
  ['inline switch', /\bswitch(es)?\b/i, 1, ''], ['AA batteries', /\bbatter(y|ies)\b/i, 4, ''], ['small DC motor', /\bmotors?\b/i, 1, ''],
  ['speaker driver', /\bspeaker\b|\bloudspeaker\b/i, 1, ''], ['caster wheels', /\bcasters?\b|\bwheels?\b/i, 4, ''], ['brass hinges', /\bhinges?\b/i, 2, ''],
  ['magnets', /\bmagnets?\b/i, 4, ''], ['springs', /\bsprings?\b/i, 2, ''], ['clock movement', /\bclock movement|clockwork\b/i, 1, ''],
  ['seat cushion fabric', /\bcushion|upholster/i, 1, 'yd'], ['mirror glass', /\bmirror\b/i, 1, ''], ['guitar strings', /\bstrings\b/i, 1, 'set'],
];
// Parts things are made of, for a parts list
const MAKER_COMPONENTS = /\b(base|shade|lampshade|seat|legs?|top|frame|body|handle|lid|shel(?:f|ves)|door|panels?|case|enclosure|stand|arms?|cover|back|drawers?|roof|walls?|perch|knob|neck|bowl|globe|tank|blades?)\b/gi;
const MAKER_TOO_BIG = /\b(building|house|vehicle|car|truck|ship|aircraft|airplane|bridge|tower|engine|spacecraft|rocket|machine tool|locomotive)\b/i;

function makerCap(key) { return MAKER_CAPS.find(c => c.key === key) || null; }
function makerShopName(key) {
      const out = MAKER_OUTSIDE_SHOPS[key];
      if (out) return out.short;
      const d = WORKSHOP_MACHINES[key]; return d ? (d.short || d.name) : key;
    }

// --- Shops outside the Workshop's machine list: the Welding Studio and the concrete batch plant --------------
// Each says whether he knows the trade, what he still needs (Post Office asks), and how a job runs.
// missing(job) returns null while he still has to learn the trade, else [{ key, ask, kind: 'c'|'p' }].
const MAKER_OUTSIDE_SHOPS = {
  weldstudio: {
    short: 'Welding Studio',
    plan: job => (typeof weldPlanFor === 'function' ? weldPlanFor({ title: job.make || '', material: job.metal || '' }) : null),
    known(job = {}) { const p = this.plan(job); return !p || jobKnown(p.key); },
    learn(job = {}, label = 'Learning to Weld') { const p = this.plan(job); if (p) doWhenFree(() => researchJob(p.key, label), { key: `learn:${p.key}` }); },
    missing(job = {}) {
      const p = this.plan(job);
      if (!p) return [];
      if (!jobKnown(p.key)) return null;
      return missingForJob(p.key).map(m => ({ key: m.ask, ask: m.ask, kind: m.kind === 'tool' ? 'p' : 'c', re: m.re }));
    },
    ask(job, missing, context) { const p = this.plan(job); if (p) groundworkReady(p.key, context); },
    run: (job, label) => makerWeldRun(job, label)
  },
  batchplant: {
    short: 'concrete batch plant',
    known: () => typeof jobKnown === 'function' && jobKnown('batchPlant') && jobKnown('concretePour'),
    learn(job, label = 'Learning the Concrete Plant') {
      ['batchPlant', 'concretePour'].filter(k => !jobKnown(k)).slice(0, 1).forEach(k => doWhenFree(() => researchJob(k, label), { key: `learn:${k}` }));
    },
    missing() {
      if (!this.known()) return null;
      const out = [];
      if (typeof readyMixName === 'function' && readyMixName()) return missingForJob('concretePour').map(m => ({ key: m.ask, ask: m.ask, kind: 'p', re: m.re }));
      if (typeof findVehicle === 'function' && !findVehicle('mixer')) out.push({ key: 'mixer', ask: 'A concrete mixer truck', kind: 'p', re: /concrete mixer truck|cement mixer truck|ready.?mix truck|transit mixer/i });
      if (typeof plantShortfall === 'function') plantShortfall('batch', 'pad').forEach(f => out.push({ key: f.key, ask: f.ask, kind: 'c', plant: true }));
      missingForJob('batchPlant').concat(missingForJob('concretePour')).forEach(m => { if (!out.some(o => o.ask === m.ask)) out.push({ key: m.ask, ask: m.ask, kind: 'p', re: m.re }); });
      return out;
    },
    ask(job, missing, context) {
      if (typeof plantPreflight === 'function' && !readyMixName()) plantPreflight('batch', 'pad');
      groundworkReady('concretePour', context);
    },
    run: (job, label) => makerCastRun(job, label)
  }
};

// The WORKSHOP_MACHINES key that runs a shop's job (the garage's fabrication runs on its MIG/TIG welder)
function makerRunKey(key) { const c = makerCap(key); return (c && c.run) || key; }
function makerShopExists(key) { return Boolean(MAKER_OUTSIDE_SHOPS[key] || WORKSHOP_MACHINES[makerRunKey(key)]); }
function makerShopKnown(key, job = {}) { const out = MAKER_OUTSIDE_SHOPS[key]; return out ? out.known(job) : machineKnown(makerRunKey(key)); }
function makerShopLearn(key, job = {}, label = 'Learning a Shop for a Job') {
      const out = MAKER_OUTSIDE_SHOPS[key];
      if (out) return out.learn(job, label);
      const k = makerRunKey(key);
      doWhenFree(() => researchMachine(k, label), { key: `learn:${k}` });
    }
// What a shop still needs for this job: [{ key, ask, kind }] (null while the trade is still to learn)
function makerShopMissing(key, job = {}) {
      const out = MAKER_OUTSIDE_SHOPS[key];
      if (out) return out.missing(job);
      const def = WORKSHOP_MACHINES[makerRunKey(key)];
      if (!def) return [];
      if (!machineKnown(def.key)) return null;
      return missingSupplies(def, job).map(k => { const s = WORKSHOP_SUPPLIES[k]; return { key: k, ask: s ? s.ask : k, kind: s && (s.kind === 'stock' || s.kind === 'consumable') ? 'c' : 'p', supply: k }; });
    }
function makerShopAsk(key, job, missing, context) {
      const out = MAKER_OUTSIDE_SHOPS[key];
      if (out) return out.ask(job, missing, context);
      const def = WORKSHOP_MACHINES[makerRunKey(key)];
      const keys = missing.map(m => m.supply).filter(Boolean);
      if (def && keys.some(k => !supplyAwaited(k) && Date.now() - (workshopState().asked[k] || 0) > 2 * 3600000)) requestSupplies(def, keys, context);
    }
function makerShopAwaited(m) {
      if (m.supply) return supplyAwaited(m.supply);
      return state.requestsToUser.some(r => !r.fulfilled && r.requestedGear === m.ask) || state.mailbox.some(x => x.name === m.ask);
    }
function makerShopRun(key, job, label) {
      const out = MAKER_OUTSIDE_SHOPS[key];
      if (out) return out.run(job, label);
      return runMachineJob(makerRunKey(key), job, label);
    }

// The wire EDM and the garage's MIG/TIG welder had no job of their own: now they make whole parts.
// (noSolo: he only runs them for an order or a parts list, not on a whim.)
if (typeof WORKSHOP_MACHINES !== 'undefined' && WORKSHOP_MACHINES.edm && !WORKSHOP_MACHINES.edm.plan) {
  Object.assign(WORKSHOP_MACHINES.edm, {
    emoji: '⚡', noSolo: true, wiki: ['Electrical discharge machining'],
    learned: 'A wire EDM cuts any conductive metal with a thin brass wire and a stream of tiny sparks under deionised water. It follows the part\'s outline to a few microns, so it makes gears, punches, dies and keys from plate, with no force on the part.',
    needs: ['edmWire', 'steelPlate', 'gloves', 'safetyGlasses'], words: [/\bedm\b|wire edm|spark erosion/i],
    products: ['A wire-EDM-cut steel gear'],
    plan(job) {
      const key = 'edm', name = job.product || madeName('wire-EDM-cut', 'steel', job.make, this.products[0]);
      return {
        title: `Wire EDM cutting ${wsWhat(name)}`, product: name, speech: 'Plate clamped in the tank, wire threaded, and the water rises.',
        stops: [
          { key, act: async ctx => { await machineStep(ctx, 'Clamping the plate and threading the wire', 2200, null, 'Brass wire threaded top to bottom, the start hole drilled.'); useWorkshopSupply('steelPlate', 1, 'EDM'); useWorkshopSupply('gloves', 1, 'EDM'); return true; } },
          postStop('edm', `Cutting ${wsWhat(name)} out of the plate`, 7000, POST_ANIMS.edm, { part: name, size: 0.14, consume: { edmWire: 1 }, speech: 'Thousands of sparks a second, each one taking a speck of steel.' })
        ],
        finish: () => { addMadeThing(name, 'wire EDM', { emoji: '⚡' }); machineSkill(key, 6); }
      };
    }
  });
}
if (typeof WORKSHOP_MACHINES !== 'undefined' && WORKSHOP_MACHINES.migtig && !WORKSHOP_MACHINES.migtig.plan) {
  Object.assign(WORKSHOP_MACHINES.migtig, {
    emoji: '🔥', noSolo: true, wiki: ['Gas metal arc welding', 'Plasma cutting'],
    learned: 'Vehicle fabrication: cut the steel on the plasma table, grind the edges, tack it square, then MIG weld it out, bolt it on and paint it.',
    needs: ['steelPlate', 'plasmaKit', 'migWire', 'shieldGas', 'weldHelmet', 'gloves'],
    plan(job) {
      const name = job.product || `A garage-fabricated steel ${String(job.make || 'trailer hitch').replace(/^(an?|the)\s+/i, '')}`;
      return {
        title: `Fabricating ${wsWhat(name)}`, product: name, speech: 'Measure the vehicle, cut the steel, tack it, weld it.',
        stops: [
          { floor: 2, key: 'plasma', act: async ctx => { await machineStep(ctx, 'Plasma cutting the steel parts', 4000, null, 'Shade 5 lenses down. Brackets and plates out of the sheet.'); useWorkshopSupply('steelPlate', 1, 'Fabrication'); useWorkshopSupply('plasmaKit', 1, 'Fabrication'); return true; } },
          { floor: 2, key: 'migtig', act: async ctx => { await machineStep(ctx, `Tacking and MIG welding ${wsWhat(name)}`, 6000, null, 'Tack, check square, tack, then weld it out.'); useWorkshopSupply('migWire', 1, 'Fabrication'); useWorkshopSupply('shieldGas', 1, 'Fabrication'); useWorkshopSupply('gloves', 1, 'Fabrication'); return true; } }
        ],
        finish: () => { addMadeThing(name, 'garage', { emoji: '🔥' }); machineSkill('garage', 6); }
      };
    }
  });
}

// --- 4. Reading an article (no key needed) -----------------------------------------------------------------
// Returns { noun, what, art, purposes, materials, whole: { shop, name } | null, parts: [...] | null, bought, decline }
function makerNounOf(title, extract) {
      const t = String(title || '').replace(/\s*\(.*\)$/, '').trim().toLowerCase();
      const m = String(extract || '').match(/\bis (?:a|an|one of the [a-z ]+? forms of) ([a-z -]{2,40}?)(?: that| which| used| for| with| made|[,.;])/i);
      return { noun: t.replace(/^(a|an|the)\s+/, '').slice(0, 30) || (m ? m[1].toLowerCase() : 'thing'), what: m ? m[1].toLowerCase() : '' };
    }

function makerPurposesFrom(text, noun) {
      const t = `${noun}. ${text}`.toLowerCase();
      const out = [];
      const add = (re, p) => { if (re.test(t) && !out.includes(p)) out.push(p); };
      add(/\b(seat|sit|sitting|chair|stool|bench)\b/, 'sit');
      add(/\b(stor(e|es|age|ing)|shel(f|ves)|contain(er|s)|organi[sz]|holds? (books|objects|things|items|tools|papers))\b/, 'store');
      add(/\b(drink|drinking|beverage|liquids?|tea|coffee)\b/, 'hold drinks');
      add(/\b(food|serving|soup|salad|eating)\b/, 'hold food');
      add(/\b(flowers?|bouquet)\b/, 'hold flowers');
      add(/\b(toy|game|play(ing|ed)?|children)\b/, 'play');
      add(/\b(ride|riding|transport)\b/, 'ride');
      add(/\b(light|lamp|illuminat\w*)\b/, 'light');
      add(/\b(music|musical|instrument)\b/, 'music');
      add(/\b(component|bracket|mount(ing)?|fasten\w*|supports? a)\b/, 'build');
      add(/\b(decorat\w*|ornament\w*|display\w*|art|artwork|sculpture)\b/, 'display');
      return out.length ? out : ['display'];
    }

function makerMaterialsIn(text) {
      // In the order the text names them ("glass, metal, china or wood": glass first)
      return MAKER_MATERIALS.map(([m, re]) => { const hit = String(text).match(re); return hit ? [m, hit.index] : null; })
        .filter(Boolean).sort((a, b) => a[1] - b[1]).map(([m]) => m);
    }

// The shop that can make a form from one of these materials (in the article's order of materials)
function makerShopFor(form, materials, noun = form) {
      for (const m of materials) {
        const cap = MAKER_CAPS.find(c => c.mat.includes(m) && makerFormOk(c, form) && makerFits(c, noun) && makerShopExists(c.key));
        if (cap) return { cap, material: m };
      }
      // Anything else made of steel that isn't too big: cut, fitted and welded in the Welding Studio
      const metal = materials.find(m => ['steel', 'stainless', 'aluminium', 'metal'].includes(m));
      const weld = makerCap('weldstudio');
      if (metal && weld && makerFits(weld, noun) && !MAKER_TOO_BIG.test(noun) && makerShopExists('weldstudio')) return { cap: weld, material: metal === 'metal' ? 'steel' : metal };
      return null;
    }

// Can this shop really make the whole thing? (its forms, its size limit, and nothing too big)
function makerShopCanWhole(cap, noun) {
      return Boolean(cap && makerFormOk(cap, noun) && makerFits(cap, noun) && !MAKER_TOO_BIG.test(noun) && makerShopExists(cap.key));
    }

function makerProductName(cap, noun, material, text = '') {
      const wood = cap.wood ? ((text.match(MAKER_WOODS) || [])[1] || '').toLowerCase() : '';
      // "steel bench" on the weld studio is "A welded steel bench", not "A welded steel steel bench"
      const bare = noun.replace(/^(an?|the)\s+/i, '').replace(/\b(stainless steel|steel|stainless|aluminium|aluminum|titanium|concrete|cement|glass|wooden|wood|plastic|nylon|resin|acrylic|plywood|paper|metal|iron)\s+/gi, '').trim() || noun;
      return cap.name(bare, cap.wood ? wood : material).replace(/\s+/g, ' ').slice(0, 70);
    }

function makerReadArticle(title, extract) {
      const text = String(extract || '');
      const { noun, what } = makerNounOf(title, text);
      const first = (text.match(/^[^.]+\./) || [text])[0];
      const art = /\b(sculpture|artwork|work of art|abstract|figurine|statue|ornament)\b/i.test(`${noun}. ${first}`);
      const purposes = art ? ['display'] : makerPurposesFrom(text, noun);
      const materials = makerMaterialsIn(text);
      const out = { noun, what, art, purposes, materials, whole: null, parts: null, bought: [], decline: null, source: 'article' };
      if (MAKER_TOO_BIG.test(`${noun} ${what}`) || makerSizeCm(noun) > Math.max(...MAKER_CAPS.map(c => c.maxCm || 0))) { out.decline = `a ${noun} is far bigger than anything my shops can make`; out.tooBig = true; return out; }
      // Bought components the article names
      out.bought = MAKER_BOUGHT.filter(([, re]) => re.test(text)).map(([name, , qty, unit]) => ({ name, qty, unit }));
      // Components and what each is made of ("a wooden base", "a shade of glass", "base, often of wood or ceramic")
      const pairs = [];
      text.split(/[.;]/).forEach(sentence => {
        let m;
        const re = new RegExp(MAKER_COMPONENTS.source, 'gi');
        while ((m = re.exec(sentence))) {
          const comp = m[1].toLowerCase();
          const near = sentence.slice(Math.max(0, m.index - 30), m.index + comp.length + 45);
          const mats = makerMaterialsIn(near);
          if (mats.length && !pairs.some(p => p.comp === comp)) pairs.push({ comp, mats });
        }
      });
      const makeable = pairs.map(p => ({ ...p, shop: makerShopFor(p.comp, p.mats) || makerShopFor(noun, p.mats, noun) }));
      const shops = new Set(makeable.filter(p => p.shop).map(p => p.shop.cap.key));
      // One shop makes the whole thing: nothing bought, and every made component from that one shop
      if (!out.bought.length && shops.size <= 1 && makeable.every(p => p.shop)) {
        const hit = makerShopFor(noun, materials.length ? materials : ['wood', 'plastic', 'glass'], noun);
        if (hit && (!shops.size || shops.has(hit.cap.key))) {
          out.whole = { shop: hit.cap.key, material: hit.material, name: makerProductName(hit.cap, noun, hit.material, text) };
          return out;
        }
      }
      // A parts list: shop-made components marked, the rest bought
      const made = makeable.filter(p => p.shop);
      if (made.length || (out.bought.length && materials.some(m => MAKER_CAPS.some(c => c.mat.includes(m))))) {
        const product = (cap, comp, m) => makerProductName(cap, comp.includes(noun) ? comp : `${noun} ${comp}`, m, text);
        const line = (cap, comp, m) => { const full = product(cap, comp, m); return { name: full.replace(/^an? /i, '').replace(/^\w/, c => c.toUpperCase()), product: full, qty: 1, unit: '', kind: 'p', make: cap.key }; };
        const parts = made.map(p => line(p.shop.cap, p.comp, p.shop.material));
        makeable.filter(p => !p.shop).forEach(p => parts.push({ name: `${p.mats[0]} ${p.comp} for the ${noun}`, qty: 1, unit: '', kind: 'p' }));
        if (!parts.some(p => p.make)) {
          const hit = makerShopFor(noun, materials);
          if (hit) parts.unshift(line(hit.cap, 'body', hit.material));
        }
        if (parts.some(p => p.make)) { out.parts = parts; return out; }
      }
      const noShop = materials.filter(m => !MAKER_CAPS.some(c => c.mat.includes(m)));
      out.decline = noShop.length ? `a ${noun} is made of ${noShop.join(' and ')}, and none of my shops works that`
        : `none of my shops makes anything like a ${noun}`;
      return out;
    }

// With an AI key: the AI proposes, the same checks keep it honest. Null means "read it myself".
async function makerAskAI(title, extract) {
      if (typeof hasLLMKey !== 'function' || !hasLLMKey() || typeof callLLMJSON !== 'function') return null;
      const shops = MAKER_CAPS.filter(c => c.forms && makerShopExists(c.key)).map(c => `${c.key} (${makerShopName(c.key)}: ${c.mat.join('/')}, up to ${c.maxCm} cm)`).join('; ');
      const prompt = `You are Kelo-1, a robot maker with these shops: ${shops}.
You read about "${title}": ${String(extract).slice(0, 900)}
Work out what it is and whether your shops can make it. Return ONLY JSON:
{"noun": "short name of the thing", "art": true|false, "purposes": [from ${JSON.stringify(MAKER_PURPOSES)}],
 "materials": [words like wood, glass, plastic, resin, steel, aluminium, acrylic, electronics, fabric, ceramic],
 "wholeShop": one shop key above if that one shop can make the WHOLE thing, else null,
 "parts": null or [2 to 10 of {"name": "...", "qty": number, "unit": "", "kind": "part"|"fastener"|"consumable", "shop": a shop key above if one of your shops makes it, else null}]}`;
      let r = null;
      try { r = await callLLMJSON([{ text: prompt }]); } catch (e) { r = null; }
      if (!r || typeof r !== 'object' || typeof r.noun !== 'string') return null;
      const noun = r.noun.toLowerCase().replace(/[^a-z -]/g, '').trim().slice(0, 30);
      if (!noun) return null;
      const materials = (Array.isArray(r.materials) ? r.materials : []).map(m => String(m).toLowerCase()).filter(m => MAKER_MATERIALS.some(([k]) => k === m));
      const purposes = (Array.isArray(r.purposes) ? r.purposes : []).filter(p => MAKER_PURPOSES.includes(p));
      const out = { noun, what: '', art: Boolean(r.art), purposes: purposes.length ? purposes : ['display'], materials, whole: null, parts: null, bought: [], decline: null, source: 'ai' };
      const cap = makerCap(r.wholeShop);
      // The AI's whole-shop answer must fit that shop: one of its forms, within its size limit, not too big
      if (cap && !makerShopCanWhole(cap, noun)) out.aiRejected = `${cap.key} can't make a whole ${noun}`;
      if (cap && makerShopCanWhole(cap, noun)) {
        const m = materials.find(x => cap.mat.includes(x)) || cap.mat[0];
        out.whole = { shop: cap.key, material: m, name: makerProductName(cap, noun, m, extract) };
        return out;
      }
      if (Array.isArray(r.parts) && r.parts.length >= 2) {
        out.parts = r.parts.slice(0, 10).map(p => {
          const c = makerCap(p && p.shop);
          return { name: String(p && p.name || 'part').slice(0, 60), qty: Math.max(1, Math.min(500, Number(p && p.qty) || 1)), unit: String(p && p.unit || '').slice(0, 10),
            kind: /fast/i.test(p && p.kind) ? 'f' : /cons/i.test(p && p.kind) ? 'c' : 'p', make: c && c.forms && makerShopExists(c.key) ? c.key : null };
        });
        if (out.parts.some(p => p.make)) return out;
      }
      return null;
    }

async function makerAnalyze(title, extract) {
      const ai = await makerAskAI(title, extract);
      return ai || makerReadArticle(title, extract);
    }

// --- 5. Whole-shop orders -------------------------------------------------------------------------------
// state.makerOrders: { id, name, noun, shop, status: learning|waiting|ready|making|done, from, url, visitor, at }
let makerJob = null; // { product, order?, line? } while one of his shop jobs runs for this file

function makerStartOrder(an, { from = null, url = null, visitor = null } = {}) {
      const s = makerState();
      const name = an.whole.name;
      const open = s.makerOrders.find(o => o.status !== 'done' && o.name.toLowerCase() === name.toLowerCase());
      if (open) return open;
      makerRegisterKind({ noun: an.noun, purposes: an.purposes, art: an.art, from }, [name]);
      const o = { id: 'mk-' + Date.now().toString(36), name, noun: an.noun, shop: an.whole.shop, metal: an.whole.material || null, status: 'waiting', from, url, visitor, at: Date.now(), purposes: an.purposes, art: an.art };
      s.makerOrders.unshift(o);
      if (s.makerOrders.length > 20) s.makerOrders.length = 20;
      state.diaryEntries.unshift({ time: visitor ? `Asked by ${visitor}` : 'An Idea From NetNode', location: currentPlaceLabel(), mood: `🛠️ Planning ${wsWhat(name)}`.slice(0, 80),
        vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, ${from ? `I read about ${from}. ` : ''}I can make ${wsWhat(name)} on my ${makerShopName(o.shop)}, the whole thing, so there's no parts list to send: just that shop's supplies. It will be for ${an.purposes.map(purposeSay).join(' and ')}.` });
      makerAdvance(o);
      savePersistentBrainState();
      renderAllUI();
      return o;
    }

// Move an order on: learn the shop, ask for its missing supplies (Post Office), or make it
function makerAdvance(o) {
      if (!o || o.status === 'done' || o.status === 'making' || o.status === 'curing') return o && o.status;
      if (!makerShopExists(o.shop)) { o.status = 'done'; o.failed = 'no such shop'; return o.status; }
      const job = { make: o.noun, product: o.name, metal: o.metal || null };
      const missing = makerShopMissing(o.shop, job);
      if (missing === null || !makerShopKnown(o.shop, job)) {
        o.status = 'learning';
        if (!state.isBusy && !state.isBrowsing) makerShopLearn(o.shop, job);
        return o.status;
      }
      if (missing.length) {
        o.status = 'waiting';
        o.waitingFor = missing.map(m => m.ask);
        // Ask once for what isn't asked for yet; otherwise just keep waiting (no speech every tick)
        if (missing.some(m => !makerShopAwaited(m))) makerShopAsk(o.shop, job, missing, `Making ${wsWhat(o.name)}`);
        return o.status;
      }
      o.status = 'ready';
      o.waitingFor = [];
      doWhenFree(() => makerRunOrder(o.id), { key: `make:${o.id}` });
      return o.status;
    }

async function makerRunOrder(id) {
      const o = makerState().makerOrders.find(x => x.id === id);
      if (!o || o.status !== 'ready' || makerJob) return false;
      o.status = 'making';
      makerJob = { product: o.name, order: o };
      let r = false;
      try { r = await makerShopRun(o.shop, { make: o.noun, product: o.name, metal: o.metal || null, order: o.id }, o.visitor ? `Making it for ${o.visitor}` : 'Making Something I Read About'); }
      finally { makerJob = null; }
      if (r === 'curing') { o.status = 'curing'; savePersistentBrainState(); return r; }
      if (r === true && o.madeAt) { o.status = 'done'; savePersistentBrainState(); return true; }
      o.status = 'waiting';
      if (r === 'not-ready') makerAdvance(o);
      return r;
    }

// --- The Welding Studio as a shop: a real steel thing welded at the table, then into his Storehouse ------------
async function makerWeldRun(job, label = 'Welding Something Real') {
      if (typeof weldTheJob !== 'function') return false;
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping || (typeof workshopJobRunning !== 'undefined' && workshopJobRunning)) return false;
      const creation = { title: plainItem(job.product || job.make || 'a steel piece'), material: job.metal || 'steel', x: 0, z: 0 };
      if (typeof weldingReady === 'function' && !weldingReady(creation, label)) return 'not-ready';
      const bench = TOWN_LOCATIONS.weld;
      state.isBuilding = true;
      let piece = null;
      try {
        state.currentLocKey = 'custom';
        state.customPlaceName = bench.building;
        state.targetPos = { x: bench.x, z: bench.z };
        state.moodEmoji = '👨‍🏭';
        state.moodTitle = `Welding ${wsWhat(job.product).replace(/\bwelded /, '')}`.slice(0, 80);
        state.speechBubble = `Off to my Welding Studio: ${wsWhat(job.product)}, cut, fitted and welded from steel stock.`;
        renderAllUI();
        await waitForArrival(45000);
        // The piece grows on the table as it is tacked and welded
        piece = lifeSize(buildItemModel3D(job.product, { label: false }), 1);
        const bx = WELD_TABLE_TOP.x, bz = WELD_TABLE_TOP.z - 0.3;
        piece.position.set(bx, getAnalyticalGroundHeight(bx, bz) + 0.93, bz);
        piece.scale.multiplyScalar(0.05);
        const full = piece.scale.x / 0.05;
        scene.add(piece);
        const grow = k => { if (piece) piece.scale.setScalar(full * (0.05 + 0.95 * Math.min(1, k))); };
        await weldTheJob(creation, grow);
        grow(1);
        if (typeof gainSkill === 'function') gainSkill('welding', 'welding', 6);
        addMadeThing(job.product, 'Welding Studio', { emoji: '🔥' });
        return true;
      } finally {
        if (piece && piece.parent) piece.parent.remove(piece);
        state.isBuilding = false;
        renderAllUI();
      }
    }

// --- The batch plant as a shop: ready-mix cast in a form in the plant yard, then it cures ----------------
// state.makerCastings: [{ id, order, product, noun, x, z, castAt }]; the form comes off after a world day
async function makerCastRun(job, label = 'Casting Concrete') {
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      if (typeof runBatchPlant !== 'function') return false;
      if (!readyMixName()) {
        const r = await runBatchPlant('pad', `For a cast concrete ${job.make}.`, label);
        if (r !== true) return 'not-ready';
      }
      if (!groundworkReady('concretePour', label)) return 'not-ready';
      state.isPracticing = true;
      let mesh = null;
      try {
        const yard = plantSpot('batch', 'stockpile');
        const spot = (typeof openGroundNear === 'function' && openGroundNear({ x: yard.x - 2.5, z: yard.z + 1.5 }, 0.8)) || { x: yard.x - 2.5, z: yard.z + 1.5 };
        state.currentLocKey = 'aggregate_plant';
        state.targetPos = { x: spot.x + 0.9, z: spot.z };
        state.moodEmoji = '🧱';
        renderAllUI();
        await waitForArrival(60000);
        state.botRotY = Math.atan2(spot.x - state.botPos.x, spot.z - state.botPos.z);
        mesh = lifeSize(buildItemModel3D(job.product, { label: false }), 1);
        mesh.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set('#b9b6ae'); o.material.roughness = 0.95; o.material.metalness = 0; } });
        mesh.position.set(spot.x, getAnalyticalGroundHeight(spot.x, spot.z), spot.z);
        const full = mesh.scale.y;
        mesh.scale.y = full * 0.02;
        scene.add(mesh);
        const steps = [['Oiling the form and setting it level', 'Form oil first, so the concrete lets go of it tomorrow.', 0],
          ['Shovelling ready-mix into the form', 'In it goes, a layer at a time, rodded into the corners.', 0.7],
          ['Tapping the form to bring the air out', 'Tap, tap, tap: the bubbles come up and the face fills in.', 0.95],
          ['Striking it off and covering it to cure', 'Struck off flat, then a plastic sheet over it so it stays damp.', 1]];
        for (const [title, say, h] of steps) {
          state.moodTitle = title;
          state.speechBubble = say;
          if (typeof holdJobTool === 'function') holdJobTool(/shovel|spade/i, 'digging');
          renderAllUI();
          const t0 = Date.now(), y0 = mesh.scale.y / full;
          while (Date.now() - t0 < 2500) { mesh.scale.y = full * Math.max(0.02, y0 + (h - y0) * (Date.now() - t0) / 2500); await new Promise(r => setTimeout(r, 100)); }
        }
        useReadyMixFor(`casting ${wsWhat(job.product)}`);
        const s = makerState();
        if (!Array.isArray(s.makerCastings)) s.makerCastings = [];
        s.makerCastings.push({ id: 'cast-' + Date.now().toString(36), order: job.order || null, line: makerJob && makerJob.line || null, product: job.product, noun: job.make, x: spot.x, z: spot.z, castAt: Date.now() });
        if (typeof gainSkill === 'function') gainSkill('pouring concrete', 'pouring concrete', 4);
        state.diaryEntries.unshift({ time: label, location: 'his concrete plant', mood: `🧱 Cast ${wsWhat(job.product)}`.slice(0, 80), vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I batched ready-mix at my own plant and cast ${wsWhat(job.product)} in a form in the yard. The form comes off tomorrow; then it keeps curing and gets stronger for weeks.` });
        state.speechBubble = `Cast! The form comes off tomorrow, once it has set.`;
        makerShowCastings();
        savePersistentBrainState();
        return 'curing';
      } finally {
        if (mesh && mesh.parent) mesh.parent.remove(mesh);
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.microPose = 'normal';
        state.isPracticing = false;
        renderAllUI();
      }
    }

// The castings in their forms in the plant yard (rebuilt after a reload)
const makerCastMeshes = {};
function makerShowCastings() {
      const list = (state.makerCastings || []);
      Object.keys(makerCastMeshes).forEach(id => { if (!list.some(c => c.id === id)) { scene.remove(makerCastMeshes[id]); delete makerCastMeshes[id]; } });
      list.forEach(c => {
        if (makerCastMeshes[c.id] || typeof scene === 'undefined' || !scene) return;
        const g = lifeSize(buildItemModel3D(c.product, { label: false }), 1);
        g.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set('#9d9a93'); o.material.roughness = 0.95; o.material.metalness = 0; } });
        g.position.set(c.x, getAnalyticalGroundHeight(c.x, c.z), c.z);
        scene.add(g);
        makerCastMeshes[c.id] = g;
      });
    }

// A day after casting: the form comes off and it's a real thing he owns
function makerCastingTick() {
      const s = makerState();
      if (!Array.isArray(s.makerCastings) || !s.makerCastings.length || makerJob) return;
      const day = typeof WORLD_DAY_MS === 'number' ? WORLD_DAY_MS : 43200000;
      const c = s.makerCastings.find(x => Date.now() - x.castAt >= day);
      if (!c) return;
      s.makerCastings = s.makerCastings.filter(x => x !== c);
      const o = c.order && s.makerOrders.find(x => x.id === c.order);
      makerJob = { product: c.product, order: o || null, line: c.line || null };
      try { addMadeThing(c.product, 'concrete batch plant', { emoji: '🧱' }); } finally { makerJob = null; }
      if (o) o.status = 'done';
      makerShowCastings();
      savePersistentBrainState();
    }

// --- 6. Parts lists: shop-made lines and the shops' supplies (js/bom.js, js/assembly.js) ---------------------
function makerStartPartsList(an, { from = null, url = null, visitor = null, readings = [] } = {}) {
      if (typeof normalizeBom !== 'function' || typeof askForLists !== 'function') return null;
      const cur = typeof activeBuild === 'function' ? activeBuild() : null;
      if (cur) return 'busy-with-build';
      const item = `A home-built ${an.noun}`;
      makerRegisterKind({ noun: an.noun, purposes: an.purposes, art: an.art, from }, [item]);
      const made = an.parts.filter(p => p.make);
      const bought = an.parts.filter(p => !p.make);
      an.bought.forEach(b => { if (!bought.some(x => x.name === b.name)) bought.push({ name: b.name, qty: b.qty, unit: b.unit, kind: 'p' }); });
      // The machines' missing supplies go on the list too
      const supplies = [];
      [...new Set(made.map(p => p.make))].forEach(k => {
        (makerShopMissing(k, { make: an.noun }) || []).forEach(m => {
          if (!supplies.some(x => x.name === m.ask)) supplies.push({ name: m.ask, qty: 1, unit: '', kind: m.kind, supply: m.supply || null, supplyAsk: m.supply ? null : m.ask, forShop: k });
        });
      });
      const electric = bought.some(b => /bulb|socket|cord|switch|batter|motor|speaker/i.test(b.name));
      const bom = normalizeBom({
        name: an.noun.replace(/^\w/, c => c.toUpperCase()), item, emoji: an.art ? '🎨' : '🛠️', site: 'bench', itemKind: 'thing',
        summary: `${an.noun} with ${made.map(p => p.name.toLowerCase()).join(', ')} from my own shops${bought.length ? ` and ${bought.map(b => b.name.toLowerCase()).join(', ')}` : ''}`,
        wiki: from ? [from] : [],
        subs: [
          { name: 'Shop-made parts', lines: [...made, ...supplies].map(l => ({ name: l.name, qty: l.qty, unit: l.unit, kind: l.kind })), steps: [{ verb: 'fit', say: 'Test-fitting the parts from my shops' }, { verb: 'sand', say: 'Easing the edges so they fit together' }] },
          { name: 'Hardware and assembly', lines: [...bought.map(b => ({ name: b.name, qty: b.qty, unit: b.unit, kind: b.kind || 'p' })),
            { name: '#8 x 3/4 in. wood screws', qty: 8, unit: '', kind: 'f' }, { name: 'Two-part epoxy', qty: 1, unit: 'tube', kind: 'c' }],
          steps: [{ verb: 'drill', say: 'Drilling pilot holes' }, ...(electric ? [{ verb: 'wire', say: 'Wiring it up, live to the switch' }] : []), { verb: 'glue', say: 'Gluing what needs glue' }, { verb: 'bolt', say: 'Screwing it together' }, { verb: 'inspect', say: 'Checking it over' }] }
        ],
        tools: [{ name: 'A cordless drill', why: 'pilot holes and screws' }, { name: 'A screwdriver', why: 'the hardware' }, ...(electric ? [{ name: 'Wire strippers', why: 'the wiring' }] : [])],
        skills: ['woodworking', 'assembly'], tests: [{ key: 'use', name: `Using the ${an.noun}`, how: electric ? 'Switched on, it works, nothing warm that shouldn\'t be' : 'Sturdy, square and does its job' }]
      });
      if (!bom) return null;
      // Mark the shop-made lines and the shops' supply lines (normalizeBom keeps the order)
      const sub = bom.subs[0];
      sub.lines.forEach((l, i) => {
        const src = [...made, ...supplies][i];
        if (!src) return;
        if (src.make) { l.make = src.make; l.makeOn = makerShopName(src.make); l.product = src.product || null; }
        if (src.supply) { l.supply = src.supply; l.forShop = src.forShop; }
        if (src.supplyAsk) { l.supplyAsk = src.supplyAsk; l.forShop = src.forShop; }
      });
      const p = { id: 'build-' + Date.now().toString(36), target: an.noun, why: visitor ? `${visitor} asked me to` : `I read about ${from || an.noun}`, status: 'gathering', startedAt: Date.now(),
        fromAI: an.source === 'ai', fromArticle: from, bom, readings: readings.map(r => r.title), tests: {}, parcels: 0, site: null };
      if (!Array.isArray(state.buildProjects)) state.buildProjects = [];
      state.buildProjects.unshift(p);
      if (state.buildProjects.length > 12) state.buildProjects.length = 12;
      if (typeof siteFor === 'function') siteFor(p);
      state.diaryEntries.unshift({ time: visitor ? `Asked by ${visitor}` : 'An Idea From NetNode', location: currentPlaceLabel(), mood: `📋 Parts list: ${an.noun}`.slice(0, 80),
        vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, ${from ? `I read about ${from}. ` : ''}No single shop of mine can make a whole ${an.noun}, so I wrote a parts list. I'll make ${made.map(l => `the ${l.name.toLowerCase()} on the ${makerShopName(l.make)}`).join(' and ')} myself${supplies.length ? ` (their supplies are on the list)` : ''}, and asked for ${bought.map(b => b.name.toLowerCase()).join(', ') || 'the hardware'}.` });
      askForLists(p);
      state.speechBubble = `A ${an.noun} needs parts no single shop of mine makes, so I wrote a parts list. I'll make ${made.length === 1 ? 'one part' : `${made.length} parts`} myself.`;
      showToast(`📋 Kelo-1 sent you a parts list for a ${an.noun}`);
      if (typeof renderBuildProjectsList === 'function') renderBuildProjectsList();
      savePersistentBrainState();
      renderAllUI();
      return p;
    }

// A shop-made line of the current build that he can make now (the shop learned and stocked)
function makerNextBuildPart() {
      const p = typeof activeBuild === 'function' ? activeBuild() : null;
      if (!p || p.status !== 'gathering') return null;
      for (const s of p.bom.subs) for (const l of s.lines) {
        if (!l.make || l.got >= l.qty || l.making || l.casting) continue;
        if (!makerShopExists(l.make)) continue;
        return { p, l };
      }
      return null;
    }

async function makerMakeBuildPart(projectId, lineId) {
      const p = buildProjectById(projectId);
      const l = p && p.bom.subs.flatMap(s => s.lines).find(x => x.id === lineId);
      if (!l || l.got >= l.qty || makerJob) return false;
      l.making = true;
      makerJob = { product: l.product || `A ${l.name}`, line: { project: p.id, id: l.id } };
      try {
        const r = await makerShopRun(l.make, { make: l.name, product: makerJob.product }, `Making a part for the ${p.bom.name.toLowerCase()}`);
        if (r === 'curing') l.casting = true;
        return r;
      } finally { l.making = false; makerJob = null; }
    }

// --- 7. What he makes: renamed to the order, sorted to the Storehouse or the Museum, or into the build ------
if (typeof addMadeThing === 'function') {
  const baseAddMadeThing = addMadeThing;
  addMadeThing = function (name, from, opts = {}) {
    const job = makerJob;
    if (job && job.product) name = job.product;
    // A part for a build: it's counted into the parts list and goes into the build
    if (job && job.line) {
      const p = buildProjectById(job.line.project);
      const l = p && p.bom.subs.flatMap(s => s.lines).find(x => x.id === job.line.id);
      const w = workshopState();
      w.made.unshift({ name, from, at: Date.now(), forBuild: p ? p.bom.name : null });
      if (w.made.length > 40) w.made.length = 40;
      if (l) { l.got = l.qty; l.madeAt = Date.now(); }
      state.diaryEntries.unshift({ time: 'Made in the Workshop', location: 'his Workshop', mood: `${opts.emoji || '⚙️'} Made ${wsThing(name)}`.slice(0, 80), vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, I made ${wsThing(name)} on the ${from} for my ${p ? p.bom.name.toLowerCase() : 'build'}, instead of asking anyone for it. It's ticked off my parts list.` });
      showToast(`${opts.emoji || '⚙️'} Kelo-1 made ${wsThing(name)} for his build`);
      if (p) { state.requestsToUser.forEach(r => { if (r.category === 'bomlist' && r.listProject === p.id) r.listRev = Date.now(); }); if (typeof renderBuildProjectsList === 'function') renderBuildProjectsList(); }
      savePersistentBrainState();
      return name;
    }
    const k = itemKindOf(name);
    // Art and abstract pieces go to the Museum; everything practical to the Storehouse
    if (k && k.art && Array.isArray(state.inventedCreations)) {
      const color = wsPick(['#38bdf8', '#f472b6', '#facc15', '#34d399', '#a78bfa']);
      state.inventedCreations.unshift({ title: plainItem(name).replace(/^\w/, c => c.toUpperCase()).slice(0, 60), actionVerb: `Made on the ${from}`, emoji: opts.emoji || '🎨', x: 0, z: 0, archetype: 'custom_weld',
        colorHex: color, secondaryColorHex: color, parts: [{ shape: 'icosahedron', x: 0, y: 0.7, z: 0, sx: 0.5, sy: 0.7, sz: 0.5, rx: 0, ry: 0.4, rz: 0, color }, { shape: 'cylinder', x: 0, y: 0.2, z: 0, sx: 0.4, sy: 0.4, sz: 0.4, rx: 0, ry: 0, rz: 0, color: '#334155' }],
        createdTime: 'On display in the Museum', inMuseum: true, philosophy: `Made by hand on the ${from}.` });
      const w = workshopState();
      w.made.unshift({ name, from, at: Date.now(), museum: true });
      if (w.made.length > 40) w.made.length = 40;
      state.diaryEntries.unshift({ time: 'Made in the Workshop', location: 'his Workshop', mood: `${opts.emoji || '🎨'} Made ${wsThing(name)}`.slice(0, 80), vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, I made ${wsThing(name)} on the ${from}. It isn't for anything but looking at, so it went into my Museum.` });
      if (typeof renderMuseum3D === 'function') renderMuseum3D();
      showToast(`🏛️ Kelo-1's ${plainItem(name).toLowerCase()} went to his Museum`);
      if (job && job.order) { job.order.madeAt = Date.now(); job.order.where = 'museum'; }
      savePersistentBrainState();
      return name;
    }
    const out = baseAddMadeThing(name, from, opts);
    if (!opts.gadget && k && k.kind !== 'made part' && state.diaryEntries[0] && /goes on the shelf until a build needs it/.test(state.diaryEntries[0].text)) {
      state.diaryEntries[0].text = state.diaryEntries[0].text.replace(`I made ${wsThing(name)} on`, `I made ${(/^[aeiou]/i.test(plainItem(name)) ? 'an ' : 'a ') + plainItem(name).replace(/^[A-Z][a-z]+\b(?!-)/, w => w.toLowerCase())} on`).replace('It goes on the shelf until a build needs it.', `It's ${k.label}, so it goes in my Storehouse and I'll use it for ${k.uses.filter(u => u !== 'display').map(purposeSay).join(' and ') || 'decoration'}.`);
    }
    if (job && job.order) { job.order.madeAt = Date.now(); job.order.where = 'storehouse'; }
    if (typeof putAwayItems === 'function') doWhenFree(putAwayItems, { key: 'putaway-made' });
    return out;
  };
}

// Parts kits that bring a shop's supplies: those lines arrive as real supplies he owns
if (typeof openPartsParcel === 'function') {
  const baseOpenParts = openPartsParcel;
  openPartsParcel = async function (parcel) {
    const info = parcel && parcel.parts;
    const p = info && buildProjectById(info.project);
    if (p) {
      info.lines.forEach(([id]) => {
        const l = p.bom.subs.flatMap(s => s.lines).find(x => x.id === id);
        if (l && l.supplyAsk && l.got < l.qty) { state.belongings.unshift({ name: l.supplyAsk, category: 'material', emoji: '📦', from: parcel.from }); state.unstoredItems.push(l.supplyAsk); return; }
        const s = l && l.supply && WORKSHOP_SUPPLIES[l.supply];
        if (!s || l.got >= l.qty) return;
        if (s.special === 'filament' && typeof addSpool === 'function') { state.belongings.unshift({ name: s.ask, category: 'material', emoji: '🧵', from: parcel.from }); addSpool(s.ask); }
        else if (s.kind === 'stock' || s.kind === 'consumable') state.belongings.unshift({ name: s.ask, category: 'material', emoji: '📦', from: parcel.from });
        else state.toolInventory.unshift(s.ask);
        state.unstoredItems.push(s.ask);
        if (typeof noteSupplyArrived === 'function') noteSupplyArrived(s.ask);
      });
    }
    return baseOpenParts(parcel);
  };
}

// --- 8. Using what he made ------------------------------------------------------------------------------------
function makerOwned(purpose) {
      const names = [...new Set(ownedItemNames())].filter(n => makerIsHisOwn(n) && usableFor(n, purpose));
      return names[0] || null;
    }

function makerNoteUse(name, what) {
      const u = makerState().makerUses;
      const e = u[name.toLowerCase()] || (u[name.toLowerCase()] = { count: 0 });
      e.count += 1;
      e.last = Date.now();
      e.what = String(what || '').slice(0, 120);
      if (typeof noteItemUsed === 'function') noteItemUsed(name);
    }

// A stool or chair: sitting on it. The pose is applied after the scene's own pose each frame.
let makerSeat = null; // { y, mesh }
function stoolModel(lower = 'stool') {
      const g = new THREE.Group();
      const wood = 0xb7814f, dark = 0x8a5a33;
      const chairLike = /chair/.test(lower);
      const chair = /chair/.test(lower);
      const h = 0.46, top = new THREE.Mesh(new THREE.CylinderGeometry(chair ? 0.2 : 0.17, chair ? 0.2 : 0.17, 0.035, chair ? 4 : 20), new THREE.MeshStandardMaterial({ color: wood, roughness: 0.6 }));
      if (chair) top.rotation.y = Math.PI / 4;
      top.position.y = h;
      g.add(top);
      for (let i = 0; i < (chair ? 4 : 3); i++) {
        const a = i / (chair ? 4 : 3) * Math.PI * 2 + (chair ? Math.PI / 4 : 0);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, h, 8), new THREE.MeshStandardMaterial({ color: dark, roughness: 0.7 }));
        leg.position.set(Math.cos(a) * 0.12, h / 2, Math.sin(a) * 0.12);
        leg.rotation.z = Math.cos(a) * -0.12; leg.rotation.x = Math.sin(a) * 0.12;
        g.add(leg);
      }
      if (chair) {
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.025), new THREE.MeshStandardMaterial({ color: wood }));
        back.position.set(0, h + 0.2, -0.14);
        g.add(back);
      }
      // Joinery: a rounded edge on the seat and a ring of stretchers between the legs
      const rungMat = new THREE.MeshStandardMaterial({ color: dark, roughness: 0.65 });
      if (!chairLike) {
        const edge = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 6, 28), top.material);
        edge.rotation.x = Math.PI / 2;
        edge.position.y = h;
        g.add(edge);
      }
      const n = chairLike ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const a0 = i / n * Math.PI * 2 + (chairLike ? Math.PI / 4 : 0), a1 = (i + 1) / n * Math.PI * 2 + (chairLike ? Math.PI / 4 : 0);
        const r = 0.125, y = 0.16;
        const ax = Math.cos(a0) * r, az = Math.sin(a0) * r, bx = Math.cos(a1) * r, bz = Math.sin(a1) * r;
        const len = Math.hypot(bx - ax, bz - az);
        const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, len, 6), rungMat);
        rung.position.set((ax + bx) / 2, y, (az + bz) / 2);
        rung.rotation.set(0, -Math.atan2(bz - az, bx - ax), Math.PI / 2);
        g.add(rung);
      }
      // Oiled wood with its grain (js/materials.js)
      if (typeof applyFinish === 'function') applyFinish(g, 'wood');
      g.traverse(o => { if (o.isMesh) o.castShadow = true; });
      return typeof realSize === 'function' ? realSize(g) : g;
    }
if (typeof ITEM_MODEL_RULES !== 'undefined') ITEM_MODEL_RULES.unshift([/\b(stool|chair)\b(?!.*(seat back|lift))/, lower => stoolModel(lower)]);

// --- The things he makes, modelled like the real thing (sizes in metres, like stoolModel) -----------
// Blown glass: a thin lathed wall (outside and inside surfaces), clear and glossy, with a thicker base
function madeGlassMaterial(tint = 0xd9eef0) {
      return new THREE.MeshStandardMaterial({ color: tint, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6 });
    }

function madeLathe(profile, mat, segs = 28) {
      const m = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs), mat);
      m.castShadow = true;
      return m;
    }

function madeGlassModel(kind) {
      const g = new THREE.Group();
      const tint = kind === 'vase' ? 0xbfe3dc : kind === 'ornament' ? 0x9cc7e8 : 0xdcecef;
      const mat = madeGlassMaterial(tint);
      const P = {
        cup: [[0, 0], [0.034, 0], [0.037, 0.006], [0.036, 0.05], [0.041, 0.1], [0.038, 0.1], [0.033, 0.05], [0.031, 0.012], [0, 0.012]],
        bowl: [[0, 0], [0.045, 0], [0.085, 0.03], [0.11, 0.07], [0.105, 0.07], [0.08, 0.032], [0.04, 0.008], [0, 0.008]],
        vase: [[0, 0], [0.055, 0], [0.07, 0.05], [0.072, 0.12], [0.05, 0.2], [0.032, 0.25], [0.04, 0.28], [0.036, 0.28], [0.028, 0.25], [0.045, 0.2], [0.066, 0.12], [0.064, 0.05], [0.05, 0.01], [0, 0.01]]
      };
      if (kind === 'ornament') {
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), mat);
        ball.position.y = 0.05;
        const swirl = new THREE.Mesh(new THREE.TorusKnotGeometry(0.028, 0.004, 48, 6, 2, 3), new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.2, metalness: 0.1 }));
        swirl.position.y = 0.05;
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.016, 10), new THREE.MeshStandardMaterial({ color: 0xc9a64a, roughness: 0.3, metalness: 0.9 }));
        cap.position.y = 0.106;
        g.add(ball, swirl, cap);
      } else {
        g.add(madeLathe(P[kind] || P.cup, mat));
        // The punty mark and a little colour trail where the glass was worked
        const trail = new THREE.Mesh(new THREE.TorusGeometry(kind === 'bowl' ? 0.108 : kind === 'vase' ? 0.038 : 0.04, 0.0025, 4, 32), madeGlassMaterial(0x2f8f83));
        trail.rotation.x = Math.PI / 2;
        trail.position.y = kind === 'bowl' ? 0.068 : kind === 'vase' ? 0.278 : 0.098;
        g.add(trail);
      }
      return realSize(g);
    }

// A turned wooden bowl: lathe profile with a foot and a rolled rim, oiled grain
function madeWoodBowlModel() {
      const mat = new THREE.MeshStandardMaterial({ color: 0x9a6a3c, roughness: 0.5 });
      const g = new THREE.Group();
      g.add(madeLathe([[0, 0.006], [0.04, 0.006], [0.042, 0], [0.05, 0], [0.09, 0.025], [0.118, 0.062], [0.12, 0.07], [0.112, 0.07], [0.105, 0.06], [0.08, 0.03], [0.04, 0.016], [0, 0.016]], mat, 32));
      if (typeof finishMaterial === 'function') finishMaterial(mat, 'wood', { texture: 'rings' });
      return realSize(g);
    }

// A wall shelf: a board with a routed front edge on two steel brackets
function madeShelfModel() {
      const g = new THREE.Group();
      const wood = new THREE.MeshStandardMaterial({ color: 0xb98a58, roughness: 0.6 });
      const steel = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.4, metalness: 0.7 });
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.025, 0.18), wood);
      board.position.y = 0.16;
      const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.6, 8), wood);
      lip.rotation.z = Math.PI / 2;
      lip.position.set(0, 0.16, 0.09);
      g.add(board, lip);
      [-0.21, 0.21].forEach(x => {
        const up = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.012), steel);
        up.position.set(x, 0.075, -0.084);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.16), steel);
        arm.position.set(x, 0.142, -0.01);
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.17), steel);
        brace.position.set(x, 0.085, -0.02);
        brace.rotation.x = -0.72;
        g.add(up, arm, brace);
      });
      if (typeof applyFinish === 'function') { applyFinish(board, 'wood'); applyFinish(lip, 'wood'); }
      if (typeof finishMaterial === 'function') finishMaterial(steel, 'painted');
      g.traverse(o => { if (o.isMesh) o.castShadow = true; });
      return realSize(g);
    }

// A table lamp: a turned base, a brass stem, a linen drum shade and a warm bulb inside
function madeTableLampModel() {
      const g = new THREE.Group();
      const base = madeLathe([[0, 0], [0.075, 0], [0.078, 0.012], [0.06, 0.03], [0.03, 0.05], [0.02, 0.07], [0, 0.07]], new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.5 }), 24);
      if (typeof finishMaterial === 'function') finishMaterial(base.material, 'wood');
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 10), new THREE.MeshStandardMaterial({ color: 0xc9a64a, roughness: 0.3, metalness: 0.9 }));
      stem.position.y = 0.2;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), new THREE.MeshStandardMaterial({ color: 0xfff4dc, emissive: 0xffd28c, emissiveIntensity: 0.8 }));
      bulb.position.y = 0.33;
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.13, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0xf1e7d0, roughness: 0.9, side: THREE.DoubleSide, emissive: 0xffd9a0, emissiveIntensity: 0.15 }));
      shade.position.y = 0.35;
      if (typeof finishMaterial === 'function') finishMaterial(shade.material, 'nylon');
      g.add(base, stem, bulb, shade);
      g.traverse(o => { if (o.isMesh) o.castShadow = o !== bulb; });
      return realSize(g);
    }

if (typeof ITEM_MODEL_RULES !== 'undefined') ITEM_MODEL_RULES.unshift(
  [/\bglass (cup|tumbler|mug)\b|hand-?blown (glass )?(cup|tumbler)/, () => madeGlassModel('cup')],
  [/\bglass bowl\b|hand-?blown (glass )?bowl/, () => madeGlassModel('bowl')],
  [/\bglass vase\b|hand-?blown (glass )?vase/, () => madeGlassModel('vase')],
  [/\bglass ornament\b|hand-?blown (glass )?ornament/, () => madeGlassModel('ornament')],
  [/(hand-?turned|turned|wooden|handmade) (wooden )?bowl\b/, () => madeWoodBowlModel()],
  [/\b(handmade|wooden|floating|wall) (wooden |wall )?shelf\b/, () => madeShelfModel()],
  [/\b(table|desk|bedside|handmade) (wooden )?lamp\b/, () => madeTableLampModel()]
);

async function sitOnMadeSeat(name, originLabel = 'Sitting Down') {
      if (!name || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isPracticing = true;
      const plain = plainItem(name).toLowerCase();
      let seatMesh = null;
      try {
        if (typeof fetchFromStorehouse === 'function') await fetchFromStorehouse(name);
        const fire = PASTIME_SPOTS.campfire;
        // A spot beside the fire ring with room for the seat and him
        const ring = [0.75, 0.5, 1, 0.25, 1.25, 0, 1.5, 1.75].map(f => f * Math.PI * 2).map(a => ({ x: fire.x + Math.cos(a) * 1.9, z: fire.z + Math.sin(a) * 1.9 }));
        const spot = ring.find(p => obstacleClearAt(p.x, p.z, 0.45) && getAnalyticalGroundHeight(p.x, p.z) > WATER_LEVEL + 0.1) || openGroundNear({ x: fire.x - 1.8, z: fire.z + 1.6 }, 0.7) || { x: fire.x - 1.8, z: fire.z + 1.6 };
        state.currentLocKey = 'custom';
        state.customPlaceName = Math.hypot(spot.x - fire.x, spot.z - fire.z) < 3 ? 'the fire ring by his house' : 'the meadow by his house';
        state.targetPos = { x: spot.x, z: spot.z + 0.6 };
        state.moodEmoji = '🪑';
        state.moodTitle = `Carrying the ${plain} out to sit on`.slice(0, 80);
        renderAllUI();
        await waitForArrival(90000);
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        seatMesh = lifeSize(buildItemModel3D(name, { label: false }), 1.6);
        const gy = getIslandGroundHeight(spot.x, spot.z);
        seatMesh.position.set(spot.x, gy, spot.z);
        const face = Math.atan2(fire.x - spot.x, fire.z - spot.z);
        seatMesh.rotation.y = face;
        scene.add(seatMesh);
        const box = new THREE.Box3().setFromObject(seatMesh);
        state.botPos = { x: spot.x, z: spot.z };
        state.targetPos = { ...state.botPos };
        state.botRotY = face;
        makerSeat = { y: /chair/i.test(name) ? gy + (box.max.y - gy) * 0.6 : box.max.y, mesh: seatMesh };
        state.moodTitle = `Sitting on the ${plain} he made`.slice(0, 80);
        state.speechBubble = pick([`I made this ${plain} myself, and it holds me. That's the best test there is.`, `Sitting on my own ${plain}. Steady as anything.`, `A seat I made with my own hands, by my own fire ring.`]);
        renderAllUI();
        await new Promise(r => setTimeout(r, 15000));
        // (screenshots: window.__makerHold keeps him seated until cleared)
        for (let i = 0; i < 600 && window.__makerHold; i++) await new Promise(r => setTimeout(r, 500));
        state.calmLevel = Math.min(100, state.calmLevel + 12);
        state.happiness = Math.min(100, state.happiness + 6);
        makerNoteUse(name, 'sat on it by the fire ring');
        state.diaryEntries.unshift({ time: originLabel, location: 'the fire ring', mood: `🪑 Sat on my ${plain}`.slice(0, 80), vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I carried out the ${plain} I made and sat on it by my fire ring for a while. It didn't wobble. Things I make are for using.` });
        savePersistentBrainState();
        return true;
      } finally {
        makerSeat = null;
        if (seatMesh) {
          if (seatMesh.parent) seatMesh.parent.remove(seatMesh);
          if (typeof setCarriedObject === 'function') setCarriedObject(lifeSize(buildItemModel3D(name, { label: false }), 1.2));
          if (!state.unstoredItems.includes(name)) state.unstoredItems.push(name);
          if (typeof putAwayItems === 'function') doWhenFree(putAwayItems, { key: 'putaway-made' });
        }
        state.isPracticing = false;
        renderAllUI();
      }
    }

if (typeof poseKeloForWelding === 'function') {
  const basePoseForWelding = poseKeloForWelding;
  poseKeloForWelding = function (t) {
    basePoseForWelding(t);
    if (!makerSeat || state.riding) return;
    const drop = keloSitPose(0, 1.5);
    keloGroup.position.set(state.botPos.x, makerSeat.y - drop, state.botPos.z);
    keloGroup.rotation.set(0, state.botRotY, 0);
    keloLeftArm.rotation.set(-0.7, 0, 0.12);
    keloRightArm.rotation.set(-0.7, 0, -0.12);
    keloLeftElbow.rotation.x = keloRightElbow.rotation.x = -0.5;
  };
}

// A shelf, box or rack: it holds some of his small things
async function storeThingsInMade(name, originLabel = 'Putting Things Away') {
      if (!name || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      const small = [...new Set(ownedItemNames())].filter(n => n !== name && !(typeof vehicleTypeFor === 'function' && vehicleTypeFor(n)) && !makerIsHisOwn(n)
        && /book|toy|yo-?yo|ball|kite|camera|harmonica|compass|lantern|candle|jar|spool|cards|puzzle|binoculars|figurine/i.test(n)).slice(0, 4);
      state.isPracticing = true;
      try {
        if (typeof fetchFromStorehouse === 'function') await fetchFromStorehouse(name);
        const plain = plainItem(name).toLowerCase();
        state.moodEmoji = '📚';
        state.moodTitle = `Filling the ${plain} he made`.slice(0, 80);
        const holds = small.length ? small.map(n => plainItem(n).toLowerCase()) : ['my small tools'];
        state.speechBubble = `My ${plain} holds ${holds.join(', ')} now. Everything has a place.`;
        renderAllUI();
        await new Promise(r => setTimeout(r, 5000));
        makerNoteUse(name, `holds ${holds.join(', ')}`);
        makerState().makerUses[name.toLowerCase()].holds = holds;
        state.diaryEntries.unshift({ time: originLabel, location: 'his Storehouse', mood: `📚 Put my ${plain} to use`.slice(0, 80), vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I put ${holds.join(', ')} on the ${plain} I made. It's doing what it was built for.` });
        savePersistentBrainState();
        return true;
      } finally {
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        if (!state.unstoredItems.includes(name)) state.unstoredItems.push(name);
        if (typeof putAwayItems === 'function') doWhenFree(putAwayItems, { key: 'putaway-made' });
        state.isPracticing = false;
        renderAllUI();
      }
    }

// A vase: flowers from his own plantings, or wildflowers in spring and summer
async function arrangeFlowersIn(name, originLabel = 'Picking Flowers') {
      if (!name || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      const bed = (state.worldEdits || []).find(e => e.type === 'plant' && e.kind === 'flowers' && typeof growthOf === 'function' && growthOf(e) >= 0.6);
      const season = typeof worldNow === 'function' ? String(worldNow().season || '') : '';
      if (!bed && !/spring|summer/i.test(season)) return false;
      state.isPracticing = true;
      const plain = plainItem(name).toLowerCase();
      try {
        if (typeof fetchFromStorehouse === 'function') await fetchFromStorehouse(name);
        const at = bed ? { x: bed.x + 0.8, z: bed.z + 0.8 } : (openGroundNear({ x: -22, z: 2 }, 1) || { x: -22, z: 2 });
        state.currentLocKey = 'custom';
        state.customPlaceName = bed ? 'his flower patch' : 'the West Meadow';
        state.targetPos = at;
        state.moodEmoji = '💐';
        state.moodTitle = `Picking flowers for the ${plain}`.slice(0, 80);
        renderAllUI();
        await waitForArrival(90000);
        state.microPose = 'crouch_inspect';
        await new Promise(r => setTimeout(r, 4000));
        state.microPose = 'normal';
        const what = bed ? `flowers from the ${bed.seed ? plainItem(bed.seed).toLowerCase().replace(/^(packet|bag|pack) of /, '') : 'patch'} I planted` : 'wildflowers from the meadow';
        makerNoteUse(name, `holds ${what}`);
        makerState().makerUses[name.toLowerCase()].flowers = { what, at: Date.now() };
        state.speechBubble = `${what[0].toUpperCase() + what.slice(1)}, in the ${plain} I made. Pretty, and useful too.`;
        state.happiness = Math.min(100, state.happiness + 5);
        state.diaryEntries.unshift({ time: originLabel, location: currentPlaceLabel(), mood: `💐 Flowers in my ${plain}`.slice(0, 80), vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I picked ${what} and put them in the ${plain} I made. A vase holds flowers; that's its job.` });
        savePersistentBrainState();
        return true;
      } finally {
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        if (!state.unstoredItems.includes(name)) state.unstoredItems.push(name);
        if (typeof putAwayItems === 'function') doWhenFree(putAwayItems, { key: 'putaway-made' });
        state.microPose = 'normal';
        state.isPracticing = false;
        renderAllUI();
      }
    }

// A cup he made holds his drink at the lake; a bowl he made holds his food
if (typeof drinkFromLake === 'function') {
  const baseDrink = drinkFromLake;
  drinkFromLake = async function (originLabel) {
    const cup = makerOwned('hold drinks');
    if (cup && typeof setCarriedObject === 'function') setCarriedObject(lifeSize(buildItemModel3D(cup, { label: false }), 0.5));
    const ok = await baseDrink(originLabel);
    if (ok && cup) {
      state.hydration = Math.min(100, state.hydration + 10);
      state.speechBubble = `Lake water from the ${plainItem(cup).toLowerCase()} I made. ${state.speechBubble}`;
      makerNoteUse(cup, 'drank lake water from it');
      renderAllUI();
    }
    if (cup && typeof setCarriedObject === 'function') setCarriedObject(null);
    return ok;
  };
}
if (typeof eatStoredFood === 'function') {
  const baseEatStored = eatStoredFood;
  eatStoredFood = async function (name, originLabel) {
    const bowl = name && !usableFor(name, 'drink') ? makerOwned('hold food') : null;
    const ok = await baseEatStored(name, originLabel);
    if (ok && bowl) {
      state.speechBubble = `I ate it out of the ${plainItem(bowl).toLowerCase()} I made. ${state.speechBubble}`;
      makerNoteUse(bowl, `held my ${plainItem(name || 'food').toLowerCase()}`);
      renderAllUI();
    }
    return ok;
  };
}

// useItemFor: sit, store and the container purposes do the real thing
if (typeof useItemFor === 'function') {
  const baseUseItemFor = useItemFor;
  useItemFor = async function (name, purposeText = '', why = '', originLabel = 'Took It Out to Use') {
    const item = typeof findOwnedName === 'function' ? findOwnedName(name) : null;
    if (item) {
      const k = itemKindOf(item);
      const want = purposeText ? (PURPOSE_INFO[purposeText] ? purposeText : purposeFromText(purposeText)) : k.uses[0];
      if (want && usableFor(item, want)) {
        if (want === 'sit') return sitOnMadeSeat(item, originLabel);
        if (want === 'store') return storeThingsInMade(item, originLabel);
        if (want === 'hold flowers') { const r = await arrangeFlowersIn(item, originLabel); if (r !== false) return r; }
        if (want === 'hold drinks' && typeof drinkFromLake === 'function') return drinkFromLake(originLabel);
        if (want === 'hold food' && typeof eatSomething === 'function') return eatSomething(originLabel);
      }
    }
    return baseUseItemFor(name, purposeText, why, originLabel);
  };
}

// Something he made and hasn't used for a while: use it for what it's for
function makerUseSomething() {
      const u = makerState().makerUses;
      const stale = n => !u[n.toLowerCase()] || Date.now() - (u[n.toLowerCase()].last || 0) > 30 * 60000;
      const names = [...new Set(ownedItemNames())].filter(n => makerIsHisOwn(n) && stale(n));
      const seat = names.find(n => usableFor(n, 'sit'));
      if (seat) return sitOnMadeSeat(seat, 'Felt Like Sitting Down');
      const store = names.find(n => usableFor(n, 'store'));
      if (store) return storeThingsInMade(store, 'Putting Things Away');
      const vase = names.find(n => usableFor(n, 'hold flowers'));
      if (vase) return arrangeFlowersIn(vase, 'Picking Flowers');
      return false;
    }

// --- 9. Ideas from the internet --------------------------------------------------------------------------------
const MAKER_IDEA_TOPICS = ['Stool (seat)', 'Bookcase', 'Birdhouse', 'Mug', 'Spinning top', 'Coat rack', 'Table lamp', 'Vase', 'Bowl', 'Paperweight', 'Coaster', 'Bird feeder', 'Wall shelf', 'Footstool'];

async function makerFetchArticle(topic) {
      let a = null;
      try { a = typeof wikiSummary === 'function' ? await wikiSummary(topic) : null; } catch (e) { a = null; }
      if (!a && typeof lookUpAnywhere === 'function') { try { a = await lookUpAnywhere(topic); } catch (e) { a = null; } }
      return a;
    }

// Read about a thing and route it: a whole-shop order, a parts list, or "none of my shops can"
async function makerIdeaFrom(article, { visitor = null } = {}) {
      const an = await makerAnalyze(article.title, article.extract);
      state.webHistory.unshift({ query: `Can I make a ${an.noun}?`, time: 'Just now',
        verdict: an.whole ? `Yes: the whole thing on my ${makerShopName(an.whole.shop)} (${an.materials.join(', ') || 'its usual material'}); it's for ${an.purposes.map(purposeSay).join(' and ')}.`
          : an.parts ? `Partly: ${an.parts.filter(p => p.make).map(p => `${p.name.toLowerCase()} on the ${makerShopName(p.make)}`).join(', ')}; the rest goes on a parts list.` : `No: ${an.decline}.`,
        hops: [{ title: article.title, url: article.url, extract: String(article.extract).slice(0, 280) }] });
      if (state.webHistory.length > 12) state.webHistory.length = 12;
      if (an.whole) return { an, route: 'shop', order: makerStartOrder(an, { from: article.title, url: article.url, visitor }) };
      if (an.parts) {
        const p = makerStartPartsList(an, { from: article.title, url: article.url, visitor, readings: [article] });
        return { an, route: p === 'busy-with-build' ? 'busy' : 'parts', project: p };
      }
      return { an, route: 'decline' };
    }

async function makerIdeaFromInternet(topic = null, originLabel = 'An Idea From NetNode') {
      if (state.isBusy || state.isBrowsing || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      const done = new Set(makerState().makerOrders.map(o => o.noun));
      topic = topic || pick(MAKER_IDEA_TOPICS.filter(t => !done.has(t.toLowerCase().replace(/\s*\(.*\)$/, ''))).concat(MAKER_IDEA_TOPICS).slice(0, 12));
      state.isBusy = true;
      state.isBrowsing = true;
      try {
        const cafe = TOWN_LOCATIONS.cyber;
        state.currentLocKey = 'cyber';
        state.customPlaceName = null;
        state.targetPos = { x: cafe.x, z: cafe.z };
        state.moodEmoji = '💡';
        state.moodTitle = `Reading about ${plainItem(topic).replace(/\s*\(.*\)$/, '').toLowerCase()} to make one`.slice(0, 80);
        state.speechBubble = 'I want to make something real. Let me read how it\'s done, and what it\'s made of.';
        renderAllUI();
        await waitForArrival(90000);
        await new Promise(r => setTimeout(r, 2000));
        const article = await makerFetchArticle(topic);
        if (!article) { state.speechBubble = `I couldn't find anything about ${topic} just now.`; return 'no-article'; }
        const r = await makerIdeaFrom(article);
        state.speechBubble = r.route === 'shop' ? `I read about ${article.title}. I can make the whole thing on my ${makerShopName(r.order.shop)}! First its supplies.`
          : r.route === 'parts' ? state.speechBubble : r.route === 'busy' ? 'I\'ll keep that idea for after my current build.' : `I read about ${article.title}, but ${r.an.decline}.`;
        savePersistentBrainState();
        return r.route;
      } finally {
        state.isBusy = false;
        state.isBrowsing = false;
        renderAllUI();
      }
    }

// --- 10. Visitors: "make me a stool" -----------------------------------------------------------------------------
const MAKER_ASK_RE = /\b(?:make|build|craft|carve|print|turn|blow|fabricate)\s+(?:me|us)\s+(?:an?|some|a pair of|the)?\s*([a-z][a-z -]{2,40}?)(?:\s+(?:please|for me|on|with|in|out of)\b|[.!?]|$)|\bcan you (?:make|build|craft) (?:me )?(?:an?|some)\s+([a-z][a-z -]{2,40}?)(?:[.!?]|\s+(?:please|for me)|$)/i;
function parseMakerAsk(message) {
      const m = String(message || '').match(MAKER_ASK_RE);
      if (!m) return null;
      const what = (m[1] || m[2] || '').trim().replace(/\s+(please|for me|now|today)$/i, '');
      if (!what || /^(it|that|this|something|anything|a picture|a painting)$/i.test(what)) return null;
      return { what };
    }

async function answerMakerAsk(ask, visitor) {
      const what = ask.what.toLowerCase();
      const article = await makerFetchArticle(what.replace(/^\w/, c => c.toUpperCase()));
      const fallback = { title: what, extract: `A ${what}.`, url: '' };
      const r = await makerIdeaFrom(article || fallback, { visitor });
      const name = r.an.noun;
      let reply;
      if (r.route === 'shop') {
        const o = r.order, missing = o.waitingFor || [];
        reply = `A ${name}? Yes, ${visitor}! That's a job for my ${makerShopName(o.shop)}, the whole thing. ${o.status === 'learning' ? `I'll read up on the ${makerShopName(o.shop)} first, then ask for its supplies.` : missing.length ? `I've asked for what it still needs (${missing.map(a => plainItem(a).toLowerCase()).join(', ')}), and I'll make it when they come.` : 'Everything it needs is here, so I\'ll make it as soon as I\'m free.'}`;
      } else if (r.route === 'parts') {
        const made = r.an.parts.filter(p => p.make);
        reply = `A ${name}? Yes, ${visitor}! No single shop of mine makes the whole thing, so I wrote a parts list (it's in the Post tab). I'll make ${made.map(p => `the ${p.name.toLowerCase()} on my ${makerShopName(p.make)}`).join(' and ')} myself.`;
      } else if (r.route === 'busy') {
        reply = `I'd love to make a ${name}, ${visitor}, but I'm in the middle of a big build. One at a time!`;
      } else {
        reply = `I'm sorry, ${visitor}. I can't make a ${name}: ${r.an.decline}. Is there something wooden, glass, printed or machined I could make you instead?`;
      }
      if (typeof sayToVisitor === 'function') sayToVisitor(reply, visitor);
      if (typeof recordVisitorMemory === 'function') recordVisitorMemory(visitor, `Asked me to make a ${name} (${r.route === 'decline' ? 'I said I couldn\'t' : 'I said yes'}).`);
      savePersistentBrainState();
      return r.route;
    }

if (typeof parseUseRequest === 'function' && typeof answerUseRequest === 'function') {
  const baseParseUse = parseUseRequest, baseAnswerUse = answerUseRequest;
  parseUseRequest = function (message) {
    // Food and drink go to his stove, before any shop or machine: "make me a sandwich", "cook us pancakes"
    const fm = String(message || '').match(/\b(?:make|cook|bake|fix|prepare|brew|whip up|blend)\s+(?:me|us)\s+(?:an?|some|the)?\s*([a-z][a-z &-]{2,40}?)(?:\s+(?:please|for me|for us|now)\b|[.!?,]|$)/i);
    if (fm && makerIsFood(fm[1])) return { candidate: { food: true }, food: { what: fm[1].trim() } };
    const first = baseParseUse(message);
    if (first && (first.workshop || first.candidate)) return first;
    const mk = parseMakerAsk(message);
    if (mk && makerIsFood(mk.what)) return { candidate: { food: true }, food: mk };
    if (mk) return { candidate: { maker: true }, maker: mk };
    return first;
  };
  answerUseRequest = function (ask, visitor) {
    if (ask && ask.food) return answerFoodAsk(ask.food, visitor);
    if (ask && ask.maker) return answerMakerAsk(ask.maker, visitor);
    return baseAnswerUse(ask, visitor);
  };
}

// --- 12. Big builds: machine-made lines, and plans read from the article when there is no key ----------
// Lines of any big-build BOM (template, AI or article) that one of his shops can make whole are marked
// "I'll make this on the <machine>" and made there; those shops' missing supplies go on the list too.
// Raw stock (sheets, studs, tube by the foot), bought components and fasteners are never marked.
const MAKER_STOCK_LINE = /\b(sheets?|tub(e|ing)|studs?|planks?|lumber|joists?|rafters?|plates?, \d|rod stock|bar stock|wire|cable|rope|fabric|dacron|cloth|\d+\s*(ft|feet|in\.?|mm|m)\b|\bft\b|cu yd|gal|rolls?|spools?|packs?|bags?|kits?|set of|bolts?|nuts?|screws?|nails?|rivets?|washers?|batter(y|ies)|motor|engine|propeller blank|tires?|wheels?|bearings?|chain|cylinder|gauge|instrument|magneto|carburet|radio|strings?|pickups?|tuners?)\b/i;
function makerShopForLine(line) {
      if (!line || line.kind !== 'p' || line.make) return null;
      const n = String(line.name || '');
      const concrete = /\b(ready-?mix|concrete)\b/i.test(n) && /\b(footings?|piers?|slab|pad|foundation)\b/i.test(n);
      if (!concrete && (MAKER_STOCK_LINE.test(n) || MAKER_BOUGHT.some(([, re]) => re.test(n)))) return null;
      const mats = makerMaterialsIn(n);
      if (!mats.length) return null;
      for (const m of mats) {
        const cap = MAKER_CAPS.find(c => c.mat.includes(m) && makerFormOk(c, n) && makerFits(c, n) && makerShopExists(c.key));
        if (cap) return { cap, material: m };
      }
      return null;
    }

function makerMarkBomLines(bom) {
      if (!bom || !Array.isArray(bom.subs)) return 0;
      let marked = 0;
      const shops = new Set();
      bom.subs.forEach(sub => sub.lines.forEach(l => {
        const hit = makerShopForLine(l);
        if (!hit) return;
        l.make = hit.cap.key;
        l.makeOn = makerShopName(hit.cap.key);
        l.product = makerProductName(hit.cap, l.name.toLowerCase().replace(/\s*\(.*\)$/, ''), hit.material);
        shops.add(hit.cap.key);
        marked += 1;
      }));
      // Each marking shop's missing supplies go on the list, in the first sub-assembly that uses that shop
      shops.forEach(k => {
        const sub = bom.subs.find(x => x.lines.some(l => l.make === k));
        (makerShopMissing(k, {}) || []).forEach((m, i) => {
          if (bom.subs.some(x => x.lines.some(l => l.name === m.ask))) return;
          sub.lines.push({ id: `${sub.key}-s${k}${i}`, name: m.ask, qty: 1, unit: '', kind: m.kind, step: null, got: 0, sent: 0, used: 0, stepAt: -1,
            supply: m.supply || null, supplyAsk: m.supply ? null : m.ask, forShop: k });
        });
      });
      return marked;
    }

// Part families: what a kind of big thing is made of, written as real sub-assemblies with quantities.
// The family is picked from the thing's name and its article; the frame material from what the article says.
const MAKER_FAMILIES = [
  { key: 'structure', re: /\b(shed|gazebo|pergola|playhouse|greenhouse|cabin|hut|shelter|outbuilding|barn|kiosk|pavilion|deck|footbridge|treehouse|chicken coop|coop|sauna|bus shelter)\b/i, site: 'spot', emoji: '🏠', r: 3.4,
    subs: w => [
      { key: 'foundation', name: 'Foundation', lines: [['Ready-mix concrete for 6 pier footings (0.3 m³)', 1, 'load', 'p'], ['8 in. cardboard concrete tube forms, 4 ft', 6, '', 'p'], ['Galvanised post bases', 6, '', 'p'], ['1/2 in. anchor bolts with washers', 6, '', 'f']],
        steps: [['fit', 'shovel', 'Digging the footing holes below the frost line'], ['fit', 'shovel', 'Pouring the concrete footings'], ['inspect', 'level', 'Checking the footings are level and square']] },
      { key: 'frame', name: 'Frame', lines: [[w ? 'Pressure-treated 4 × 4 posts, 8 ft' : 'Steel 2 in. square tube, 20 ft', 6, '', 'p'], [w ? '2 × 6 beams and joists, 10 ft' : 'Steel 2 × 2 in. angle, 20 ft', 10, '', 'p'], ['Galvanised framing connectors', 24, '', 'p'], [w ? '3 in. structural screws' : '3/8 in. bolts with nuts', 200, '', 'f']],
        steps: [['cut', 'saw', 'Cutting the posts and beams'], ['fit', 'drill', 'Standing the posts and fixing the beams'], ['inspect', 'level', 'Plumb and square']] },
      { key: 'roof', name: 'Roof', lines: [['2 × 4 rafters, 8 ft', 12, '', 'p'], ['Corrugated metal roof panels, 8 ft', 6, '', 'p'], ['Roofing screws with washers', 150, '', 'f']],
        steps: [['cut', 'saw', 'Cutting the rafters'], ['fit', 'drill', 'Fixing rafters and roof panels']] },
      { key: 'walls', name: 'Walls and finish', lines: [['Cedar siding boards, 8 ft', 40, '', 'p'], ['Exterior wood stain', 2, 'gal', 'c'], ['2 in. siding nails', 600, '', 'f']],
        steps: [['fit', 'hammer', 'Nailing on the siding'], ['paint', 'brush', 'Staining the outside'], ['inspect', null, 'A last look round']] }
    ], tools: [['shovel', 'A post-hole shovel', 'the footing holes'], ['saw', 'A circular saw', 'cutting lumber'], ['drill', 'A cordless drill', 'screws and bolts'], ['level', 'A 4 ft level', 'plumb and level'], ['hammer', 'A framing hammer', 'nails'], ['brush', 'A paint brush', 'stain']],
    skills: ['Framing', 'Pouring concrete footings'] },
  { key: 'wheeled', re: /\b(cart|wagon|trailer|go-?kart|kart|soapbox|scooter|wheelbarrow|rickshaw|buggy|dolly|handcart|pedal car)\b/i, site: 'bench', emoji: '🛞', r: 1.5,
    subs: w => [
      { key: 'frame', name: 'Frame', lines: [[w ? 'Hardwood 2 × 4, 8 ft' : 'Mild steel 1 in. square tube, 20 ft', 2, '', 'p'], [w ? 'Steel corner brackets' : 'Steel gusset plates', 8, '', 'p'], [w ? '#10 x 2 in. wood screws' : 'ER70S-6 MIG wire', w ? 40 : 1, w ? '' : 'spool', w ? 'f' : 'c']],
        steps: [['cut', 'saw', 'Cutting the frame members'], [w ? 'fit' : 'weld', w ? 'drill' : null, w ? 'Screwing the frame together' : 'Welding the frame square'], ['inspect', null, 'Checking it sits flat and square']] },
      { key: 'wheels', name: 'Wheels and axles', lines: [['10 in. pneumatic wheels with bearings', 4, '', 'p'], ['5/8 in. steel axle rod, 3 ft', 2, '', 'p'], ['Axle bearing blocks', 4, '', 'p'], ['Cotter pins and washers', 8, '', 'f']],
        steps: [['drill', 'drill', 'Drilling the axle mounts'], ['fit', 'wrench', 'Mounting the axles and wheels'], ['inspect', null, 'Spinning every wheel']] },
      { key: 'deck', name: 'Deck and handle', lines: [['3/4 in. exterior plywood 4 × 4', 1, 'sheet', 'p'], ['Steel pull handle', 1, '', 'p'], ['1/4 in. carriage bolts with nuts', 12, '', 'f'], ['Exterior paint', 1, 'qt', 'c']],
        steps: [['cut', 'saw', 'Cutting the deck'], ['bolt', 'wrench', 'Bolting on the deck and handle'], ['paint', 'brush', 'Painting it']] }
    ], tools: [['saw', 'A circular saw', 'cutting'], ['drill', 'A cordless drill', 'holes'], ['wrench', 'A socket set', 'bolts'], ['brush', 'A paint brush', 'paint']], skills: ['Fabrication', 'Assembly'] },
  { key: 'boat', re: /\b(raft|boat|canoe|kayak|dinghy|paddle ?board|punt|pontoon|skiff|rowboat|coracle)\b/i, site: 'beach', emoji: '🛶', r: 3,
    subs: w => [
      { key: 'hull', name: 'Hull', lines: [['1/4 in. marine plywood 4 × 8', 4, 'sheets', 'p'], ['Marine epoxy kit', 1, 'gal', 'c'], ['6 oz fibreglass tape, 50 yd', 1, 'roll', 'c'], ['Copper stitching wire', 1, 'roll', 'c']],
        steps: [['cut', 'saw', 'Cutting the hull panels'], ['fit', null, 'Stitching the panels together'], ['glue', null, 'Taping and epoxying the seams'], ['sand', null, 'Fairing and sanding']] },
      { key: 'fittings', name: 'Seats and fittings', lines: [['Cedar seat boards', 2, '', 'p'], ['Oarlocks or paddle cleats', 2, '', 'p'], ['Stainless screws', 40, '', 'f'], ['Marine varnish', 1, 'qt', 'c']],
        steps: [['fit', 'drill', 'Fitting the seats'], ['paint', 'brush', 'Varnishing'], ['inspect', null, 'Checking every seam']] }
    ], tools: [['saw', 'A jigsaw', 'the hull panels'], ['drill', 'A cordless drill', 'stitch holes'], ['brush', 'A varnish brush', 'varnish']], skills: ['Stitch-and-glue boatbuilding'] },
  { key: 'flying', re: /\b(kite|glider|drone|quadcopter|model (air)?plane|hang glider|ornithopter|blimp)\b/i, site: 'bench', emoji: '🪁', r: 1.2,
    subs: w => [
      { key: 'frame', name: 'Frame', lines: [['Carbon fibre tube 8 mm, 1 m', 4, '', 'p'], ['Nylon tube connectors', 8, '', 'p'], ['Epoxy adhesive', 1, 'tube', 'c']],
        steps: [['cut', null, 'Cutting the spars'], ['glue', null, 'Gluing the joints']] },
      { key: 'skin', name: 'Covering and controls', lines: [['Ripstop nylon fabric', 2, 'yd', 'p'], ['Braided line', 1, 'spool', 'p'], ['Small hardware kit', 1, '', 'f']],
        steps: [['cover', null, 'Covering the frame'], ['fit', null, 'Rigging the lines'], ['inspect', null, 'A test in the wind']] }
    ], tools: [['scissors', 'Sharp scissors', 'the fabric']], skills: ['Light structures'] },
  { key: 'device', re: /\b(robot|clock|radio|telescope|machine|device|instrument|amplifier|computer|console|camera|weather station|lamp|projector|synth\w*)\b/i, site: 'bench', emoji: '🤖', r: 1,
    subs: w => [
      { key: 'body', name: 'Body', lines: [['Aluminium enclosure panels', 4, '', 'p'], ['Aluminium mounting brackets', 6, '', 'p'], ['M3 screws and standoffs', 40, '', 'f']],
        steps: [['drill', 'drill', 'Drilling the enclosure'], ['fit', 'driver', 'Mounting the brackets']] },
      { key: 'electronics', name: 'Electronics', lines: [['Microcontroller board', 1, '', 'p'], ['Power supply 12 V', 1, '', 'p'], ['Hook-up wire kit', 1, '', 'c'], ['Solder', 1, 'spool', 'c']],
        steps: [['solder', 'iron', 'Soldering the wiring'], ['wire', 'driver', 'Wiring it up'], ['inspect', null, 'Powering it up']] }
    ], tools: [['drill', 'A cordless drill', 'holes'], ['driver', 'A screwdriver set', 'screws'], ['iron', 'A soldering iron', 'wiring']], skills: ['Electronics', 'Assembly'] },
  { key: 'thing', re: /./, site: 'bench', emoji: '🛠️', r: 1.5,
    subs: w => [
      { key: 'body', name: 'Main body', lines: [[w ? 'Hardwood boards, 1 × 8 in., 8 ft' : 'Steel 1 in. square tube, 20 ft', 3, '', 'p'], [w ? 'Wooden mounting blocks' : 'Steel mounting brackets', 6, '', 'p'], [w ? '#8 wood screws' : '1/4 in. bolts with nuts', 60, '', 'f']],
        steps: [['cut', 'saw', 'Cutting the parts to size'], ['fit', 'drill', 'Putting the body together'], ['inspect', null, 'Checking it is solid']] },
      { key: 'finish', name: 'Fittings and finish', lines: [['Handles and fittings', 2, '', 'p'], ['Exterior finish', 1, 'qt', 'c']],
        steps: [['fit', 'drill', 'Fitting the hardware'], ['paint', 'brush', 'Finishing it']] }
    ], tools: [['saw', 'A saw', 'cutting'], ['drill', 'A cordless drill', 'holes and screws'], ['brush', 'A brush', 'the finish']], skills: ['Assembly'] }
];

// A bill of materials worked out from what he read (no AI, no template): the family's sub-assemblies,
// plus any components the article names, made on his shops where they can be.
function bomFromReading(target, readings = []) {
      if (typeof normalizeBom !== 'function') return null;
      const want = String(target || '').trim().toLowerCase();
      if (!want) return null;
      const text = readings.map(r => `${r.title}. ${r.extract || ''}`).join(' ');
      const fam = MAKER_FAMILIES.find(f => f.re.test(want)) || MAKER_FAMILIES.find(f => f.key !== 'thing' && f.re.test(text.slice(0, 400))) || MAKER_FAMILIES[MAKER_FAMILIES.length - 1];
      const mats = makerMaterialsIn(text);
      const wood = !mats.length || mats.indexOf('wood') >= 0 && (mats.indexOf('steel') < 0 || mats.indexOf('wood') < mats.indexOf('steel'));
      const subs = fam.subs(wood).map(s => ({ key: s.key, name: s.name, lines: s.lines.map(([name, qty, unit, kind]) => ({ name, qty, unit, kind })), steps: s.steps.map(([verb, tool, say]) => ({ verb, tool, say })) }));
      // Components the article names that the family doesn't already have
      const seen = new Set(subs.flatMap(s => s.lines.map(l => l.name.toLowerCase())));
      const extra = [];
      text.split(/[.;]/).forEach(sentence => {
        const re = new RegExp(MAKER_COMPONENTS.source, 'gi');
        let m;
        while ((m = re.exec(sentence)) && extra.length < 4) {
          const comp = m[1].toLowerCase();
          if ([...seen].some(n => n.includes(comp))) continue;
          const near = makerMaterialsIn(sentence.slice(Math.max(0, m.index - 30), m.index + comp.length + 45));
          const mat = near[0] || (wood ? 'wood' : 'steel');
          extra.push({ name: `${mat === 'wood' ? 'Wooden' : mat[0].toUpperCase() + mat.slice(1)} ${comp} for the ${want}`.slice(0, 70), qty: 1, unit: '', kind: 'p' });
          seen.add(comp);
        }
      });
      MAKER_BOUGHT.filter(([, re]) => re.test(text)).slice(0, 3).forEach(([name, , qty, unit]) => { if (!seen.has(name)) extra.push({ name, qty, unit, kind: 'p' }); });
      if (extra.length) subs.push({ key: 'parts', name: 'Parts from the article', lines: extra, steps: [{ verb: 'fit', tool: 'drill', say: 'Fitting the parts the article describes' }, { verb: 'inspect', tool: null, say: 'Checking them against the article' }] });
      const name = want.replace(/^\w/, c => c.toUpperCase());
      return normalizeBom({
        name, item: `A home-built ${want}`, emoji: fam.emoji, site: fam.site, r: fam.r, itemKind: fam.key === 'structure' ? null : 'thing',
        summary: `a ${want} worked out from ${readings.length ? readings.map(r => r.title).join(', ') : 'what I know'}: ${subs.map(s => s.name.toLowerCase()).join(', ')}${wood ? ', mostly wood' : ', mostly steel'}`,
        wiki: readings.map(r => r.title).slice(0, 3), subs,
        tools: fam.tools.map(([key, nm, why]) => ({ key, name: nm, why })), skills: fam.skills.slice(),
        tests: [{ key: 'use', name: `Using the ${want}`, how: 'It does its job, sturdy and safe' }],
        fromReading: true
      });
    }

// "Build me a table": when one of his shops can make the whole thing, it is a shop job, not a big build
function makerWholeShopForAsk(target) {
      const t = String(target || '').toLowerCase();
      if (!t || (typeof bomTemplateFor === 'function' && bomTemplateFor(t))) return null;
      const mats = makerMaterialsIn(t);
      return MAKER_CAPS.find(c => makerShopCanWhole(c, t) && (!mats.length || mats.some(m => c.mat.includes(m)))) || null;
    }

// --- 13. Food and drink: "make me a sandwich" is cooking, not a shop job --------------------------------------
// The ingredients come through the Post Office like any supply; he cooks it at his stove and the result is
// a real food (or drink) item in his things. state.foodOrders: { id, dish, drink, ingredients: [{ ask, re }],
// for, status: waiting|ready|cooking|done, at, madeName }
const FOOD_RECIPES = [
  [/sandwich|sub\b|hoagie/, 'sandwich', [['A loaf of whole-wheat sandwich bread', /sandwich bread|\bbread\b|\bloaf\b/i], ['A block of cheddar cheese', /cheddar|\bcheese\b/i], ['A pack of sliced ham', /\bham\b|turkey|salami/i], ['A head of lettuce', /lettuce/i], ['A jar of mustard', /mustard|mayo/i]]],
  [/pancake|crepe|waffle/, 'pancakes', [['A bag of all-purpose flour', /\bflour\b/i], ['A carton of eggs', /\beggs?\b/i], ['A carton of milk', /\bmilk\b/i], ['A pound of butter', /\bbutter\b/i], ['A bottle of maple syrup', /maple syrup/i]]],
  [/cookie|biscuit/, 'cookies', [['A bag of all-purpose flour', /\bflour\b/i], ['A pound of butter', /\bbutter\b/i], ['A bag of brown sugar', /\bsugar\b/i], ['A carton of eggs', /\beggs?\b/i], ['A bag of chocolate chips', /chocolate chips?/i]]],
  [/cake|cupcake|muffin|brownie/, 'cake', [['A bag of all-purpose flour', /\bflour\b/i], ['A bag of sugar', /\bsugar\b/i], ['A carton of eggs', /\beggs?\b/i], ['A pound of butter', /\bbutter\b/i], ['A tin of baking powder', /baking powder/i]]],
  [/pizza/, 'pizza', [['A bag of bread flour', /\bflour\b/i], ['A packet of dry yeast', /\byeast\b/i], ['A can of tomato sauce', /tomato sauce|passata/i], ['A ball of mozzarella', /mozzarella|\bcheese\b/i], ['A bottle of olive oil', /olive oil/i]]],
  [/soup|stew|chowder/, 'soup', [['A carton of vegetable stock', /\bstock\b|broth/i], ['A bag of carrots', /carrots?/i], ['A bag of onions', /onions?/i], ['A bag of potatoes', /potato(es)?/i]]],
  [/salad/, 'salad', [['A head of lettuce', /lettuce/i], ['A pint of cherry tomatoes', /tomato(es)?/i], ['A cucumber', /cucumber/i], ['A bottle of vinaigrette', /vinaigrette|dressing/i]]],
  [/omelet|omelette|scrambled eggs|fried eggs?/, 'omelette', [['A carton of eggs', /\beggs?\b/i], ['A pound of butter', /\bbutter\b/i], ['A block of cheddar cheese', /cheddar|\bcheese\b/i]]],
  [/pasta|spaghetti|noodles|mac(aroni)? (and|&) cheese/, 'pasta', [['A box of dried pasta', /pasta|spaghetti|noodles|macaroni/i], ['A jar of tomato pasta sauce', /pasta sauce|tomato sauce/i], ['A wedge of parmesan', /parmesan|\bcheese\b/i]]],
  [/toast/, 'toast', [['A loaf of whole-wheat sandwich bread', /sandwich bread|\bbread\b|\bloaf\b/i], ['A pound of butter', /\bbutter\b/i], ['A jar of strawberry jam', /\bjam\b|marmalade|honey/i]]],
  [/lemonade/, 'lemonade', [['A bag of lemons', /lemons?/i], ['A bag of sugar', /\bsugar\b/i]], true],
  [/hot chocolate|cocoa/, 'hot chocolate', [['A tin of cocoa powder', /cocoa/i], ['A carton of milk', /\bmilk\b/i], ['A bag of sugar', /\bsugar\b/i]], true],
  [/smoothie|milkshake|shake/, 'smoothie', [['A bunch of bananas', /bananas?/i], ['A bag of frozen berries', /berr(y|ies)/i], ['A tub of plain yogurt', /yogh?urt/i]], true],
  [/coffee|latte|espresso/, 'coffee', [['A bag of ground coffee', /coffee/i], ['A carton of milk', /\bmilk\b/i]], true],
  [/\btea\b|chai/, 'tea', [['A box of black tea bags', /\btea\b/i], ['A jar of honey', /honey/i]], true],
  [/juice/, 'juice', [['A bag of oranges', /oranges?/i]], true]
];
// Ingredients an article can name, for food he has no recipe for (no AI key needed)
const FOOD_INGREDIENT_WORDS = [['flour', 'A bag of all-purpose flour'], ['egg', 'A carton of eggs'], ['milk', 'A carton of milk'], ['butter', 'A pound of butter'], ['sugar', 'A bag of sugar'],
  ['cheese', 'A block of cheddar cheese'], ['rice', 'A bag of long-grain rice'], ['bread', 'A loaf of whole-wheat sandwich bread'], ['tomato', 'A pint of cherry tomatoes'], ['onion', 'A bag of onions'],
  ['potato', 'A bag of potatoes'], ['beans', 'A can of black beans'], ['chicken', 'A pack of chicken thighs'], ['beef', 'A pound of ground beef'], ['fish', 'A fillet of salmon'], ['noodle', 'A pack of noodles'],
  ['oil', 'A bottle of olive oil'], ['garlic', 'A bulb of garlic'], ['tortilla', 'A pack of flour tortillas'], ['chocolate', 'A bar of dark chocolate'], ['lemon', 'A bag of lemons'], ['yeast', 'A packet of dry yeast']];
const FOOD_DRINK_RE = /\b(drink|juice|lemonade|tea|coffee|latte|cocoa|hot chocolate|smoothie|milkshake|shake|soda|cider|punch|kombucha)\b/i;

function makerIsFood(what) {
      const w = String(what || '');
      const food = ITEM_KINDS.find(k => k.kind === 'food'), drink = ITEM_KINDS.find(k => k.kind === 'drink');
      return Boolean((food && food.re.test(w)) || (drink && drink.re.test(w)) || FOOD_DRINK_RE.test(w) || FOOD_RECIPES.some(([re]) => re.test(w)) || /\b(lunch|dinner|breakfast|supper|snack|treat|meal|omelet+e?)\b/i.test(w));
    }

function foodState() {
      if (!Array.isArray(state.foodOrders)) state.foodOrders = [];
      return state.foodOrders;
    }

// The ingredient list: a real recipe, or one read from the article about the dish, or the AI's
async function foodRecipeFor(what) {
      const w = String(what || '').toLowerCase().trim();
      const hit = FOOD_RECIPES.find(([re]) => re.test(w));
      if (hit) return { dish: w.replace(/^(a|an|some)\s+/, '') || hit[1], drink: Boolean(hit[3]), ingredients: hit[2].map(([ask, re]) => ({ ask, re: re.source })), from: 'recipe' };
      if (typeof hasLLMKey === 'function' && hasLLMKey() && typeof callLLMJSON === 'function') {
        try {
          const r = await callLLMJSON([{ text: `List the real ingredients a home cook needs to make "${w}". Return ONLY JSON: {"drink": true|false, "ingredients": [2 to 6 shop items like "A bag of all-purpose flour"]}` }]);
          if (r && Array.isArray(r.ingredients) && r.ingredients.length >= 2) {
            return { dish: w, drink: Boolean(r.drink), from: 'ai', ingredients: r.ingredients.slice(0, 6).map(a => String(a).replace(/[<>]/g, '').slice(0, 60)).filter(Boolean)
              .map(ask => ({ ask, re: makerEscape(ask.replace(/^(an?|some)\s+(\w+\s+of\s+)?/i, '').split(/\s+/).slice(-1)[0]) })) };
          }
        } catch (e) {}
      }
      const article = typeof makerFetchArticle === 'function' ? await makerFetchArticle(w.replace(/^\w/, c => c.toUpperCase())) : null;
      const text = article ? String(article.extract || '').toLowerCase() : '';
      let ings = FOOD_INGREDIENT_WORDS.filter(([word]) => new RegExp(`\\b${word}`).test(text)).slice(0, 6);
      if (ings.length < 2) ings = FOOD_INGREDIENT_WORDS.filter(([word]) => ['flour', 'egg', 'butter', 'milk'].includes(word));
      return { dish: w, drink: FOOD_DRINK_RE.test(w), from: article ? 'article' : 'basics', ingredients: ings.map(([word, ask]) => ({ ask, re: `\\b${word}` })) };
    }

function foodIngredientOwned(i) { return [...new Set(ownedItemNames())].find(n => new RegExp(i.re, 'i').test(n) && !/freshly made/i.test(n)) || null; }
function foodReservedNames() {
      const out = new Set();
      foodState().filter(o => o.status !== 'done').forEach(o => o.ingredients.forEach(i => { const n = foodIngredientOwned(i); if (n) out.add(n); }));
      return out;
    }

async function answerFoodAsk(ask, visitor) {
      const what = String(ask.what || '').toLowerCase().replace(/^(a|an|some|the)\s+/, '');
      const recipe = await foodRecipeFor(what);
      const o = { id: 'food-' + Date.now().toString(36), dish: recipe.dish, drink: recipe.drink, ingredients: recipe.ingredients, for: visitor, status: 'waiting', at: Date.now(), from: recipe.from };
      foodState().unshift(o);
      if (state.foodOrders.length > 10) state.foodOrders.length = 10;
      const missing = o.ingredients.filter(i => !foodIngredientOwned(i));
      missing.forEach(i => addItemRequest(i.ask, 'ingredient', `To make ${visitor} ${/^[aeiou]/.test(o.dish) ? 'an' : 'a'} ${o.dish} I need ${plainItem(i.ask).toLowerCase()}.`, `Making ${o.dish} for ${visitor}`));
      const reply = missing.length
        ? `${/^[aeiou]/.test(o.dish) ? 'An' : 'A'} ${o.dish}? I'd love to, ${visitor}! That's a job for my stove, not my Workshop. I need ${missing.map(i => plainItem(i.ask).toLowerCase()).join(', ')}, so I asked at the Post Office. I'll make it as soon as they come.`
        : `${/^[aeiou]/.test(o.dish) ? 'An' : 'A'} ${o.dish}? Coming up, ${visitor}! I have everything, so I'll make it at my stove as soon as I'm free.`;
      if (typeof sayToVisitor === 'function') sayToVisitor(reply, visitor);
      if (typeof recordVisitorMemory === 'function') recordVisitorMemory(visitor, `Asked me to make ${o.dish} (I said yes; it's a kitchen job).`);
      foodAdvance(o);
      savePersistentBrainState();
      renderAllUI();
      return 'food';
    }

function foodAdvance(o) {
      if (!o || o.status === 'done' || o.status === 'cooking') return o && o.status;
      if (o.ingredients.some(i => !foodIngredientOwned(i))) { o.status = 'waiting'; return o.status; }
      o.status = 'ready';
      doWhenFree(() => cookFoodOrder(o.id), { key: `cook:${o.id}`, maxWaitMs: 6 * 3600000 });
      return o.status;
    }

async function cookFoodOrder(id) {
      const o = foodState().find(x => x.id === id);
      if (!o || o.status !== 'ready') return false;
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      if (o.ingredients.some(i => !foodIngredientOwned(i))) { o.status = 'waiting'; return false; }
      o.status = 'cooking';
      state.isPracticing = true;
      if (typeof buildStove3D === 'function' && typeof pastimeStoveGroup !== 'undefined' && !pastimeStoveGroup) buildStove3D();
      const u = typeof pastimeStoveGroup !== 'undefined' && pastimeStoveGroup ? pastimeStoveGroup.userData : null;
      try {
        const st = PASTIME_SPOTS.stove;
        state.currentLocKey = 'custom';
        state.customPlaceName = 'the stove by his house';
        state.targetPos = { x: st.x + 1.3, z: st.z };
        state.moodEmoji = o.drink ? '🥤' : '🍳';
        state.moodTitle = `Making ${o.dish} for ${o.for}`.slice(0, 80);
        state.speechBubble = `Everything for the ${o.dish} came. Off to my stove.`;
        renderAllUI();
        await waitForArrival(60000);
        if (typeof pastimeFace === 'function') pastimeFace(st.x, st.z);
        if (u) { u.cooking = !o.drink || /hot|tea|coffee|cocoa/.test(o.dish); u.pan.visible = true; if (u.food) u.food.material.color.setHex(o.drink ? 0xfef3c7 : 0xd97706); }
        state.microPose = 'procedural_custom';
        state.proceduralMotion = { headPitch: 0.3, headYawSpeed: 0.8, headTiltAmp: 0.1, armWaveAmp: 0.25, armRaiseOffset: -0.9, bodyBounceAmp: 0.02, spinSpeed: 0, crouchOffset: 0, sparkBurst: false };
        const used = [];
        for (const i of o.ingredients) {
          const n = foodIngredientOwned(i);
          if (!n) continue;
          state.moodTitle = `${o.drink ? 'Mixing' : 'Cooking'} ${o.dish}: ${plainItem(n).toLowerCase().replace(/^(a |an )?(bag|carton|pack|jar|loaf|block|head|tin|bottle|box|can|ball|pound|pint|bunch|tub|packet|wedge|bulb|fillet|bar) of /, '')}`.slice(0, 80);
          state.speechBubble = `In goes the ${plainItem(n).toLowerCase().replace(/^(a |an )?(bag|carton|pack|jar|loaf|block|head|tin|bottle|box|can|ball|pound|pint|bunch|tub|packet|wedge|bulb|fillet|bar) of /, '')}.`;
          renderAllUI();
          await new Promise(r => setTimeout(r, 2200));
          useUpItem(n, 1, { quiet: true, why: `making ${o.dish}` });
          used.push(plainItem(n).toLowerCase());
        }
        const made = `A freshly made ${o.dish}${o.for && o.for !== 'Kelo-1' ? ` for ${o.for}` : ''}`.slice(0, 70);
        state.belongings.unshift({ name: made, category: o.drink ? 'drink' : 'food', emoji: o.drink ? '🥤' : '🥪', from: 'his own stove' });
        state.unstoredItems.push(made);
        o.status = 'done';
        o.madeName = made;
        o.madeAt = Date.now();
        state.microPose = 'normal';
        state.moodEmoji = '😋';
        state.moodTitle = `Made ${o.dish} for ${o.for}`.slice(0, 80);
        state.speechBubble = `${o.for}, your ${o.dish} is ready! Made with ${used.join(', ')}. It's waiting for you in my Storehouse.`;
        state.chatLog.push({ sender: 'Kelo-1', text: state.speechBubble, time: 'Just now', isBot: true, at: Date.now() });
        state.diaryEntries.unshift({ time: `Cooking for ${o.for}`, location: 'his stove', mood: `${o.drink ? '🥤' : '🍳'} Made ${o.dish}`.slice(0, 80), vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, ${o.for} asked me for ${/^[aeiou]/.test(o.dish) ? 'an' : 'a'} ${o.dish}. I don't make food in my Workshop: I got the ingredients through the Post Office (${used.join(', ')}) and made it at my stove. It's real food now, waiting in my Storehouse.` });
        if (typeof bumpLifeStat === 'function') bumpLifeStat('mealsCooked');
        showToast(`${o.drink ? '🥤' : '🍳'} Kelo-1 made ${o.dish} for ${o.for}`);
        savePersistentBrainState();
        return true;
      } finally {
        if (u) { u.cooking = false; u.pan.visible = false; }
        if (o.status === 'cooking') o.status = 'ready';
        if (state.microPose === 'procedural_custom') state.microPose = 'normal';
        state.isPracticing = false;
        renderAllUI();
      }
    }

function foodTick() { foodState().forEach(o => { if (o.status === 'waiting' || (o.status === 'ready' && !state.isPracticing)) foodAdvance(o); }); }

// Ingredients that come for a food order are kept for it: not eaten on arrival, not eaten as a snack
if (typeof receiveItem === 'function') {
  const baseReceiveItem = receiveItem;
  receiveItem = function (name, category, from, note = '', extra = {}) {
    const open = foodState().filter(o => o.status !== 'done');
    if (open.some(o => o.ingredients.some(i => new RegExp(i.re, 'i').test(String(name || ''))))) category = 'ingredient';
    return baseReceiveItem(name, category, from, note, extra);
  };
}
if (typeof storedFoodName === 'function') {
  const baseStoredFood = storedFoodName;
  storedFoodName = function () {
    const keep = foodReservedNames();
    if (!keep.size) return baseStoredFood();
    const names = [...new Set(ownedItemNames())].filter(n => !keep.has(n));
    return names.find(n => usableFor(n, 'eat') && state.supplies && state.supplies[n.toLowerCase()]) || names.find(n => usableFor(n, 'eat')) || null;
  };
}
if (typeof CATEGORY_ICONS !== 'undefined') CATEGORY_ICONS.ingredient = '🧂';

// --- 11. The tick ------------------------------------------------------------------------------------------------
function shopMakerChance() {
      const s = makerState();
      if (makerJob) return 0;
      const hasMade = ownedItemNames().some(n => makerIsHisOwn(n) && (usableFor(n, 'sit') || usableFor(n, 'store') || usableFor(n, 'hold flowers')));
      return (hasMade ? 0.06 : 0) + (s.makerOrders.some(o => o.status !== 'done') ? 0 : 0.015);
    }

function shopMakerOnMyOwn() {
      if (Math.random() < 0.7) { const r = makerUseSomething(); if (r) return r; }
      if (makerState().makerOrders.some(o => o.status !== 'done')) return false;
      return makerIdeaFromInternet(null, 'An Idea From NetNode');
    }

function makerTick() {
      const s = makerState();
      s.makerOrders.forEach(o => { if (o.status === 'waiting' || o.status === 'learning' || (o.status === 'ready' && !makerJob)) makerAdvance(o); });
      // A shop-made line of the current build: learn the shop, or make the part once its supplies are here
      const next = makerNextBuildPart();
      if (next && !makerJob && !workshopJobRunning) {
        const { p, l } = next;
        const miss = makerShopMissing(l.make, { make: l.name });
        if (miss === null || !makerShopKnown(l.make, { make: l.name })) makerShopLearn(l.make, { make: l.name }, 'Learning a Shop for a Build');
        else if (!miss.length) doWhenFree(() => makerMakeBuildPart(p.id, l.id), { key: `part:${p.id}:${l.id}` });
      }
      makerCastingTick();
      foodTick();
    }

function makerSummaryForAI() {
      const s = makerState();
      const open = s.makerOrders.filter(o => o.status !== 'done');
      const kinds = Object.values(s.makerKinds).slice(-6).map(k => `${k.nouns[0]} (${k.uses.join('/')})`);
      return `Shop orders: ${open.map(o => `${o.name} on the ${makerShopName(o.shop)} (${o.status})`).join('; ') || 'none'}. Kinds of things learned: ${kinds.join(', ') || 'none yet'}.`;
    }

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const s = makerState();
    Object.keys(s.makerKinds).forEach(makerRegisterRule);
    s.makerOrders.forEach(o => { if (o.status === 'making') o.status = 'waiting'; });
    makerShowCastings();
    setInterval(makerTick, 10000);
  }, 800);
});
