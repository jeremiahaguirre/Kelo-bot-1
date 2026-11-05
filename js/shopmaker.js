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
const MAKER_MADE_RE = /\b(handmade|hand-made|hand-blown|turned|dovetailed|laser-cut|woodshop-made|home-built|homemade|shop-made)\b/i;
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
// key: the WORKSHOP_MACHINES machine; mat: materials it works; forms: things it can make whole; part: the
// made-name pattern for a product
const MAKER_CAPS = [
  { key: 'woodshop', mat: ['wood'], forms: /stool|chair|bench|table|desk|shel(f|ves)|bookcase|box|chest|cabinet|frame|rack|crate|birdhouse|caddy|organi[sz]er|holder|tray|toy|furniture|board|stand|legs?|seat|top|base|lid|door|drawer|panel/i,
    name: (noun, m) => `A handmade ${m || 'maple'} ${noun}`, wood: true },
  { key: 'woodturning', mat: ['wood'], forms: /bowl|cup|mug|goblet|vase|spindle|handle|knob|candlestick|rolling pin|spinning top|base|finial/i,
    name: (noun, m) => `A turned ${m || 'cherry'} ${noun}`, wood: true },
  { key: 'glassstudio', mat: ['glass'], forms: /vase|bowl|cup|mug|tumbler|goblet|ornament|paperweight|shade|lampshade|bottle|float|sculpture|marble|globe|dish/i,
    name: noun => `A hand-blown glass ${noun}` },
  { key: 'fdm', mat: ['plastic'], forms: /bracket|clip|mount|stand|holder|hook|case|enclosure|knob|toy|figure|organi[sz]er|cup|planter|spinning top|whistle|gear|box|cover|caddy/i,
    name: noun => `An FDM-printed PLA ${noun}`, small: true },
  { key: 'sla', mat: ['resin'], forms: /figure|figurine|miniature|ring|jewel|statue|lens|bust/i, name: noun => `An SLA-printed resin ${noun}`, small: true },
  { key: 'avid4896', mat: ['wood', 'plywood'], forms: /sign|plaque|panel|puzzle|template|letters|cutout|shelf|board|coaster/i, name: noun => `An Avid-routed plywood ${noun}` },
  { key: 'laser', mat: ['acrylic'], forms: /sign|panel|stand|box|ornament|coaster|cover|plaque/i, name: noun => `A laser-cut acrylic ${noun}` },
  { key: 'haasvs1', mat: ['aluminium', 'steel'], forms: /bracket|plate|hub|knob|mount|bottle opener|block|part|spindle|pedal/i, name: (noun, m) => `A Haas-machined ${m === 'steel' ? 'steel' : 'aluminium'} ${noun}` },
  { key: 'plasma', mat: ['steel'], forms: /gusset|bracket|sign|silhouette|plate|sculpture|fire pit|bracket|frame|stand|rack|hook/i, name: noun => `A plasma-cut steel ${noun}` },
  { key: 'pcbline', mat: ['electronics'], forms: /radio|weather station|controller|console/i, name: noun => `A homemade ${noun}` },
  { key: 'pcbmill', mat: ['electronics'], forms: /circuit|board|controller|pcb|electronics/i, name: noun => `A PCB-milled ${noun}` }
];

// Materials and the words articles use for them; the ones with no shop are noted so he can say so
const MAKER_MATERIALS = [
  ['wood', /\b(wood(en)?|timber|lumber|oak|maple|pine|cedar|walnut|cherry|birch|beech|bamboo|ash)\b/i],
  ['plywood', /\bplywood\b/i],
  ['glass', /\b(?<!fibre|fiber)glass\b(?!es)/i],
  ['acrylic', /\b(acrylic|plexiglass|perspex)\b/i],
  ['resin', /\b(resin|photopolymer)\b/i],
  ['plastic', /\b(plastics?|polymer|polypropylene|polyethylene|polystyrene|nylon|abs|pla)\b/i],
  ['aluminium', /\balumin(i)?um\b/i],
  ['steel', /\b(steel|iron|metal|metals|wrought)\b/i],
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
function makerShopName(key) { const d = WORKSHOP_MACHINES[key]; return d ? (d.short || d.name) : key; }

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
function makerShopFor(form, materials) {
      for (const m of materials) {
        const cap = MAKER_CAPS.find(c => c.mat.includes(m) && c.forms.test(form) && WORKSHOP_MACHINES[c.key]);
        if (cap) return { cap, material: m };
      }
      return null;
    }

function makerProductName(cap, noun, material, text = '') {
      const wood = cap.wood ? ((text.match(MAKER_WOODS) || [])[1] || '').toLowerCase() : '';
      return cap.name(noun.replace(/^(an?|the)\s+/i, ''), cap.wood ? wood : material).replace(/\s+/g, ' ').slice(0, 70);
    }

function makerReadArticle(title, extract) {
      const text = String(extract || '');
      const { noun, what } = makerNounOf(title, text);
      const first = (text.match(/^[^.]+\./) || [text])[0];
      const art = /\b(sculpture|artwork|work of art|abstract|figurine|statue|ornament)\b/i.test(`${noun}. ${first}`);
      const purposes = art ? ['display'] : makerPurposesFrom(text, noun);
      const materials = makerMaterialsIn(text);
      const out = { noun, what, art, purposes, materials, whole: null, parts: null, bought: [], decline: null, source: 'article' };
      if (MAKER_TOO_BIG.test(`${noun} ${what}`)) { out.decline = `a ${noun} is far bigger than anything my shops can make`; return out; }
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
      const makeable = pairs.map(p => ({ ...p, shop: makerShopFor(p.comp, p.mats) || makerShopFor(noun, p.mats) }));
      const shops = new Set(makeable.filter(p => p.shop).map(p => p.shop.cap.key));
      // One shop makes the whole thing: nothing bought, and every made component from that one shop
      if (!out.bought.length && shops.size <= 1 && makeable.every(p => p.shop)) {
        const hit = makerShopFor(noun, materials.length ? materials : ['wood', 'plastic', 'glass']);
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
      const shops = MAKER_CAPS.filter(c => WORKSHOP_MACHINES[c.key]).map(c => `${c.key} (${makerShopName(c.key)}: ${c.mat.join('/')})`).join('; ');
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
      if (cap && WORKSHOP_MACHINES[cap.key]) {
        const m = materials.find(x => cap.mat.includes(x)) || cap.mat[0];
        out.whole = { shop: cap.key, material: m, name: makerProductName(cap, noun, m, extract) };
        return out;
      }
      if (Array.isArray(r.parts) && r.parts.length >= 2) {
        out.parts = r.parts.slice(0, 10).map(p => {
          const c = makerCap(p && p.shop);
          return { name: String(p && p.name || 'part').slice(0, 60), qty: Math.max(1, Math.min(500, Number(p && p.qty) || 1)), unit: String(p && p.unit || '').slice(0, 10),
            kind: /fast/i.test(p && p.kind) ? 'f' : /cons/i.test(p && p.kind) ? 'c' : 'p', make: c && WORKSHOP_MACHINES[c.key] ? c.key : null };
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
      const o = { id: 'mk-' + Date.now().toString(36), name, noun: an.noun, shop: an.whole.shop, status: 'waiting', from, url, visitor, at: Date.now(), purposes: an.purposes, art: an.art };
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
      if (!o || o.status === 'done' || o.status === 'making') return o && o.status;
      const def = WORKSHOP_MACHINES[o.shop];
      if (!def) { o.status = 'done'; o.failed = 'no such shop'; return o.status; }
      const job = { make: o.noun, product: o.name };
      if (!machineKnown(o.shop)) {
        o.status = 'learning';
        if (!state.isBusy && !state.isBrowsing) doWhenFree(() => researchMachine(o.shop, 'Learning a Shop for a Job'), { key: `learn:${o.shop}` });
        return o.status;
      }
      const missing = missingSupplies(def, job);
      if (missing.length) {
        o.status = 'waiting';
        o.waitingFor = missing.slice();
        requestSupplies(def, missing, `Making ${wsWhat(o.name)}`);
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
      try { r = await runMachineJob(o.shop, { make: o.noun, product: o.name }, o.visitor ? `Making it for ${o.visitor}` : 'Making Something I Read About'); }
      finally { makerJob = null; }
      if (r === true && o.madeAt) { o.status = 'done'; savePersistentBrainState(); return true; }
      o.status = 'waiting';
      if (r === 'not-ready') makerAdvance(o);
      return r;
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
        const def = WORKSHOP_MACHINES[k];
        if (!def) return;
        missingSupplies(def, { make: an.noun }).forEach(sk => {
          const s = WORKSHOP_SUPPLIES[sk];
          if (s && !supplies.some(x => x.supply === sk)) supplies.push({ name: s.ask, qty: 1, unit: '', kind: s.kind === 'stock' || s.kind === 'consumable' ? 'c' : 'p', supply: sk, forShop: k });
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
        if (!l.make || l.got >= l.qty || l.making) continue;
        if (!WORKSHOP_MACHINES[l.make]) continue;
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
        const r = await runMachineJob(l.make, { make: l.name, product: makerJob.product }, `Making a part for the ${p.bom.name.toLowerCase()}`);
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
      state.diaryEntries[0].text = state.diaryEntries[0].text.replace('It goes on the shelf until a build needs it.', `It's ${k.label}, so it goes in my Storehouse and I'll use it for ${k.uses.filter(u => u !== 'display').map(purposeSay).join(' and ') || 'decoration'}.`);
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
      g.traverse(o => { if (o.isMesh) o.castShadow = true; });
      return typeof realSize === 'function' ? realSize(g) : g;
    }
if (typeof ITEM_MODEL_RULES !== 'undefined') ITEM_MODEL_RULES.unshift([/\b(stool|chair)\b(?!.*(seat back|lift))/, lower => stoolModel(lower)]);

async function sitOnMadeSeat(name, originLabel = 'Sitting Down') {
      if (!name || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isPracticing = true;
      const plain = plainItem(name).toLowerCase();
      let seatMesh = null;
      try {
        if (typeof fetchFromStorehouse === 'function') await fetchFromStorehouse(name);
        const fire = PASTIME_SPOTS.campfire;
        const spot = openGroundNear({ x: fire.x - 1.8, z: fire.z + 1.6 }, 0.7) || { x: fire.x - 1.8, z: fire.z + 1.6 };
        state.currentLocKey = 'custom';
        state.customPlaceName = 'the fire ring by his house';
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
        await new Promise(r => setTimeout(r, 12000));
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
        reply = `A ${name}? Yes, ${visitor}! That's a job for my ${makerShopName(o.shop)}, the whole thing. ${o.status === 'learning' ? `I'll read up on the ${makerShopName(o.shop)} first, then ask for its supplies.` : missing.length ? `I've asked for what it still needs (${missing.map(k => plainItem(WORKSHOP_SUPPLIES[k].ask).toLowerCase()).join(', ')}), and I'll make it when they come.` : 'Everything it needs is here, so I\'ll make it as soon as I\'m free.'}`;
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
    const first = baseParseUse(message);
    if (first && (first.workshop || first.candidate)) return first;
    const mk = parseMakerAsk(message);
    if (mk) return { candidate: { maker: true }, maker: mk };
    return first;
  };
  answerUseRequest = function (ask, visitor) {
    if (ask && ask.maker) return answerMakerAsk(ask.maker, visitor);
    return baseAnswerUse(ask, visitor);
  };
}

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
        if (!machineKnown(l.make)) doWhenFree(() => researchMachine(l.make, 'Learning a Shop for a Build'), { key: `learn:${l.make}` });
        else if (!missingSupplies(WORKSHOP_MACHINES[l.make], { make: l.name }).length) doWhenFree(() => makerMakeBuildPart(p.id, l.id), { key: `part:${p.id}:${l.id}` });
      }
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
    setInterval(makerTick, 10000);
  }, 800);
});
