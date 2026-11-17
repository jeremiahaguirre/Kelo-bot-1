// Kelo-bot-1 — js/farmdata.js
// Loaded after roadworks.js (before farmland.js, farmmodels.js and farm.js). The farm's data model:
// the registries (crops, field uses, buildings, machines, implements, field operations, supplies and,
// for stage 2, animals), his saved farm (`state.farm`, filled in for old saves by farmState()), the
// crop and soil simulation (one step per world day: season, heat, rain, soil moisture and nitrogen,
// weeds, pests, crop rotation, growth stages and yield) and the grain store (bins, drying, flour).
//
// Stage 1 is the land, the buildings and grain. Stage 2 (orchard and vegetables, livestock, hay and
// feed) extends the same registries: add a crop with `use: 'orchard'|'vegetable'|'hay'`, a field use,
// an animal in FARM_ANIMALS, a building, a machine or an implement; the simulation, the parts lists,
// the store and the Farm panel read the registries, so nothing else needs to know the new names.
// Scale everywhere: 1.6 world units = 1 metre (RUNWAY_FIELD.unitsPerMetre).

const FARM_U = 1.6;
const farmHa = (wUnits, dUnits) => (wUnits / FARM_U) * (dUnits / FARM_U) / 10000;

// --- Crops ---------------------------------------------------------------------------------------
// days: world days from seeding to ripe in a good season; window: day-of-year planting window
// (Kelowna: spring cereals and canola from late April, corn once the soil is warm in May);
// seed: kg per hectare; yield: t/ha in a good year (BC Interior dryland, irrigated corn);
// harvestMoisture: grain moisture % when it is first fit to combine; storeMoisture: dry enough to keep;
// n: kg nitrogen per hectare the crop takes up; price: CAD per tonne at the elevator (2026);
// stages: [from growth, name, look] where look picks the 3D model (farmmodels.js)
const FARM_CROPS = {
  wheat: {
    use: 'grain', label: 'Spring wheat', emoji: '🌾', variety: 'AAC Brandon (CWRS spring wheat)',
    days: 100, window: [105, 150], seed: 120, seedUnit: 'kg', yield: 3.6, harvestMoisture: 17, storeMoisture: 14.5,
    n: 110, price: 310, bushelKg: 27.2, flour: 0.75,
    stages: [[0, 'seeded', 'bare'], [0.07, 'emerged', 'sprout'], [0.25, 'tillering', 'leafy'], [0.5, 'heading', 'head'], [0.75, 'ripening', 'turning'], [1, 'ripe', 'ripe']],
    colour: { green: 0x5f8f2f, ripe: 0xd8b55a }, pests: { name: 'wheat midge', window: [175, 215], chance: 0.025 }
  },
  canola: {
    use: 'grain', label: 'Canola', emoji: '🌼', variety: 'InVigor L340PC (hybrid canola)',
    days: 95, window: [110, 150], seed: 5.5, seedUnit: 'kg', yield: 2.4, harvestMoisture: 11, storeMoisture: 9,
    n: 130, price: 690, bushelKg: 22.7,
    stages: [[0, 'seeded', 'bare'], [0.07, 'emerged', 'sprout'], [0.22, 'rosette', 'leafy'], [0.45, 'flowering', 'flower'], [0.7, 'podding', 'turning'], [1, 'ripe', 'ripe']],
    colour: { green: 0x4f8a3a, ripe: 0x9a7b45 }, pests: { name: 'flea beetles', window: [120, 160], chance: 0.04 }
  },
  corn: {
    use: 'grain', label: 'Grain corn', emoji: '🌽', variety: 'Pioneer P7211 (early grain corn, 2300 CHU)',
    days: 125, window: [125, 160], seed: 22, seedUnit: 'kg', yield: 9.5, harvestMoisture: 25, storeMoisture: 15.5,
    n: 170, price: 245, bushelKg: 25.4,
    stages: [[0, 'seeded', 'bare'], [0.06, 'emerged', 'sprout'], [0.2, 'knee high', 'leafy'], [0.5, 'tasselling', 'head'], [0.75, 'dent', 'turning'], [1, 'mature', 'ripe']],
    colour: { green: 0x4e8a2c, ripe: 0xc9a55e }, pests: { name: 'European corn borer', window: [185, 230], chance: 0.02 }
  }
};
// Which crop does well after which (the rotation he plans): factor on yield, and pest carry-over
const FARM_ROTATION = {
  wheat: { after: { canola: 1.12, corn: 1.0, wheat: 0.88 } },
  canola: { after: { wheat: 1.08, corn: 1.02, canola: 0.75 } },
  corn: { after: { wheat: 1.05, canola: 1.05, corn: 0.9 } }
};
const FARM_ROTATION_PLAN = ['wheat', 'canola', 'corn'];

// What a field is for. Stage 1 grows grain; stage 2 adds orchard, vegetable, hay and pasture uses
const FARM_FIELD_USES = {
  grain: { label: 'grain', ops: ['plough', 'disc', 'fertilize', 'seed', 'spray', 'harvest'] }
};

// Stage 2: the animals (kind -> { label, building, feed, products }). Empty for now on purpose.
const FARM_ANIMALS = {};

// --- Buildings -----------------------------------------------------------------------------------
// Local layout on the farm site (x from the site's west edge, d from its south edge northward, in
// metres); w x d footprint in metres; stages built in order. parts: the real parts list for it.
// concrete: m³ for the foundation (footings/slab), batched on his plant or bagged.
const FARM_BUILD_STAGES = ['staked', 'foundation', 'curing', 'frame', 'walls', 'roof', 'done'];
const FARM_BUILDINGS = {
  farmhouse: {
    label: 'Farmhouse', emoji: '🏡', at: [22, 27], w: 13, d: 10, rot: 0, concrete: 26, foundation: 'Frost-wall footings and basement slab',
    parts: [['Pressure-treated sill plate 2×6 × 16 ft', 24, 'p'], ['SPF stud 2×6 × 8 ft (KD)', 320, 'p'], ['LVL beam 1¾ × 11⅞ in × 24 ft', 4, 'p'],
      ['Engineered floor joist 11⅞ in × 24 ft', 34, 'p'], ['OSB sheathing 7/16 in 4×8', 140, 'p'], ['Prefab roof truss, 8/12 pitch, 34 ft', 22, 'p'],
      ['Asphalt architectural shingles (bundle)', 75, 'p'], ['Fibre-cement lap siding (board)', 260, 'p'], ['Vinyl double-hung window 36 × 48 in', 12, 'p'],
      ['Insulated steel entry door 36 in', 2, 'p'], ['R-20 batt insulation (bag)', 40, 'p'], ['Drywall ½ in 4×12', 120, 'p'],
      ['Framing nails 3¼ in (box)', 6, 'f'], ['Rebar 15M × 20 ft', 60, 'p'], ['Ready-mix concrete 30 MPa (m³)', 26, 'c']]
  },
  barn: {
    label: 'Big barn', emoji: '🛖', at: [50, 52], w: 18, d: 30, rot: 0, concrete: 54, foundation: 'Perimeter grade beam and slab',
    parts: [['Glulam post 6¾ × 6 in × 20 ft', 26, 'p'], ['Gambrel roof truss, 18 m span', 16, 'p'], ['Douglas-fir girt 2×6 × 16 ft', 180, 'p'],
      ['Board-and-batten barn siding (red, 1×10 × 12 ft)', 420, 'p'], ['29-gauge steel roofing sheet × 4.9 m', 96, 'p'], ['Sliding barn door kit 4.3 × 4.3 m', 2, 'p'],
      ['Hay-loft floor joist 2×10 × 16 ft', 70, 'p'], ['Structural screws 6 in (box)', 8, 'f'], ['Rebar 15M × 20 ft', 110, 'p'], ['Ready-mix concrete 30 MPa (m³)', 54, 'c']]
  },
  shed: {
    label: 'Machine shed', emoji: '🏚️', at: [24, 64], w: 30, d: 16, rot: 0, concrete: 72, foundation: 'Post footings and a 150 mm shop slab',
    parts: [['Steel post-frame kit 30 × 16 m (columns, rafters, purlins)', 1, 'p'], ['Galvalume wall sheet 29-ga × 6 m', 120, 'p'],
      ['Galvalume roof sheet 29-ga × 8.5 m', 70, 'p'], ['Insulated overhead door 6 × 5 m', 2, 'p'], ['Man door, steel, 36 in', 1, 'p'],
      ['Self-drilling roofing screws (box of 1000)', 10, 'f'], ['Rebar 15M × 20 ft', 140, 'p'], ['Ready-mix concrete 30 MPa (m³)', 72, 'c']]
  },
  workshop: {
    label: 'Workshop corner', emoji: '🔧', at: [33, 64], w: 8, d: 8, rot: 0, inside: 'shed', concrete: 0,
    parts: [['Steel workbench 2.4 m with vise', 1, 'p'], ['Air compressor 80 gal, 7.5 hp', 1, 'p'], ['MIG welder 250 A', 1, 'p'],
      ['Mechanic\'s tool chest, 52 in', 1, 'p'], ['Grease gun and hose reel', 1, 'p'], ['Bench grinder 8 in', 1, 'p']]
  },
  bins: {
    label: 'Grain bins', emoji: '🛢️', at: [60, 87], w: 30, d: 11, rot: 0, concrete: 48, foundation: 'Three ring-wall bin pads', count: 3, diaM: 9.1, capT: 470,
    parts: [['Corrugated steel grain bin 9.1 m dia × 8 rings (470 t, kit)', 3, 'p'], ['Full-floor aeration and fan 7.5 hp', 3, 'p'],
      ['Bin unload sump, sweep auger and wall ladder', 3, 'p'], ['Grain temperature cable', 6, 'p'], ['Rebar 15M × 20 ft', 120, 'p'], ['Ready-mix concrete 30 MPa (m³)', 48, 'c']]
  },
  dryer: {
    label: 'Grain dryer and auger', emoji: '🔥', at: [80, 82], w: 5, d: 9, rot: 0, concrete: 10, foundation: 'Dryer pad',
    parts: [['Continuous-flow grain dryer, 13 t/h (propane)', 1, 'p'], ['Swing-away grain auger 13 in × 84 ft', 1, 'p'],
      ['Wet holding tank 60 t', 1, 'p'], ['Propane tank 1000 USG on skids', 1, 'p'], ['Rebar 15M × 20 ft', 24, 'p'], ['Ready-mix concrete 30 MPa (m³)', 10, 'c']]
  },
  fueltank: {
    label: 'Fuel tank', emoji: '⛽', at: [40, 32], w: 6, d: 3, rot: 0, concrete: 4, foundation: 'Containment pad',
    parts: [['Double-walled diesel tank 10 000 L (ULC-S601)', 1, 'p'], ['Fuel pump 15 GPM with meter and nozzle', 1, 'p'],
      ['Spill kit and fire extinguisher', 1, 'p'], ['Ready-mix concrete 30 MPa (m³)', 4, 'c']]
  },
  stand: {
    label: 'Farm stand', emoji: '🧺', at: [5, 6], w: 5, d: 3, rot: 0, concrete: 0,
    parts: [['Cedar 2×4 × 8 ft', 24, 'p'], ['Cedar fence board 1×6 × 6 ft', 40, 'p'], ['Corrugated roof panel 8 ft', 6, 'p'], ['Deck screws 3 in (box)', 2, 'f']]
  }
};
const FARM_BUILD_ORDER = ['shed', 'fueltank', 'bins', 'dryer', 'barn', 'farmhouse', 'workshop', 'stand'];

// --- Machines (vehicles) and implements -----------------------------------------------------------
// Machines are vehicles (js/vehicles.js): driven, fuelled with diesel, parked in the machine shed.
// tankL: fuel tank; lph: litres an hour working; hp: engine power (an implement needs enough)
const FARM_MACHINES = {
  tractor: { kind: 'farmtractor', label: 'Tractor', ask: 'A 180 hp row-crop tractor with 3-point hitch and PTO', re: /row-?crop tractor|farm tractor|\b180 hp\b.*tractor/i, hp: 180, tankL: 390, lph: 26, speed: 1.15, emoji: '🚜' },
  bigtractor: { kind: 'farmbigtractor', label: 'Big tractor', ask: 'A 450 hp four-wheel-drive articulated tractor', re: /four-?wheel-?drive articulated tractor|450 hp/i, hp: 450, tankL: 1000, lph: 60, speed: 1.1, emoji: '🚜', later: true },
  combine: { kind: 'combine', label: 'Combine harvester', ask: 'A combine harvester, class 7 (rotary)', re: /combine harvester|\bcombine\b/i, hp: 400, tankL: 950, lph: 50, speed: 0.95, emoji: '🌾' },
  truck: { kind: 'graintruck', label: 'Grain truck', ask: 'A tandem-axle grain truck with a 20 ft box and roll tarp', re: /grain truck/i, hp: 350, tankL: 300, lph: 22, speed: 1.6, emoji: '🚚' }
};
// Implements hitch to the tractor (or the header onto the combine). widthM: working width;
// kmh: working speed; lpha: diesel per hectare; needHp; op: the field operation it does
const FARM_IMPLEMENTS = {
  plough: { label: 'Plough', ask: 'A 6-bottom semi-mounted mouldboard plough', re: /mouldboard plough|moldboard plow/i, widthM: 2.7, kmh: 8, needHp: 160, op: 'plough' },
  disc: { label: 'Disc harrow', ask: 'A 7.6 m tandem disc harrow', re: /disc harrow/i, widthM: 7.6, kmh: 11, needHp: 170, op: 'disc' },
  drill: { label: 'Seed drill', ask: 'A 9 m air seed drill with cart', re: /seed drill|air drill/i, widthM: 9.1, kmh: 9, needHp: 170, op: 'seed' },
  sprayer: { label: 'Sprayer', ask: 'A 3000 L trailed field sprayer with 24 m booms', re: /field sprayer/i, widthM: 24, kmh: 14, needHp: 90, op: 'spray' },
  spreader: { label: 'Fertilizer spreader', ask: 'A twin-disc fertilizer spreader, 3 t hopper', re: /fertili[sz]er spreader/i, widthM: 24, kmh: 14, needHp: 80, op: 'fertilize' },
  header: { label: 'Combine header', ask: 'A 9 m draper header for the combine', re: /draper header|combine header/i, widthM: 9.1, kmh: 7, needHp: 0, op: 'harvest', onto: 'combine' },
  cart: { label: 'Grain cart', ask: 'A 22 t grain cart with folding unload auger', re: /grain cart/i, widthM: 0, kmh: 15, needHp: 150, op: 'cart' },
  mill: { label: 'Stone flour mill', ask: 'A stone burr flour mill, 1.5 kW (40 kg/h)', re: /flour mill|stone burr mill|grain mill/i, widthM: 0, kmh: 0, needHp: 0, op: 'mill', inside: 'workshop' }
};

// --- Field operations -----------------------------------------------------------------------------
// impl: which implement; machine: what pulls/does it; soil: the field's soil after it; lpha: diesel
// per hectare; input: what it uses per hectare (stock key, amount)
const FARM_OPS = {
  plough: { label: 'Ploughing', verb: 'plough', impl: 'plough', machine: 'tractor', soil: 'ploughed', lpha: 22, emoji: '🟫' },
  disc: { label: 'Disc harrowing', verb: 'disc', impl: 'disc', machine: 'tractor', soil: 'harrowed', lpha: 9, emoji: '〰️' },
  fertilize: { label: 'Spreading fertilizer', verb: 'spread fertilizer on', impl: 'spreader', machine: 'tractor', soil: null, lpha: 3, emoji: '⚪' },
  seed: { label: 'Seeding', verb: 'seed', impl: 'drill', machine: 'tractor', soil: 'seeded', lpha: 7, emoji: '🌱' },
  spray: { label: 'Spraying', verb: 'spray', impl: 'sprayer', machine: 'tractor', soil: null, lpha: 2, emoji: '💧' },
  harvest: { label: 'Harvesting', verb: 'harvest', impl: 'header', machine: 'combine', soil: 'stubble', lpha: 18, emoji: '🌾' }
};

// --- Supplies (the farm ledger, state.farm.stock) -------------------------------------------------
// unit is what the ledger counts; per: how much one ordered line brings
const FARM_SUPPLIES = {
  seed_wheat: { label: 'wheat seed', ask: 'Certified AAC Brandon spring wheat seed (1 t tote)', unit: 'kg', per: 1000 },
  seed_canola: { label: 'canola seed', ask: 'InVigor L340PC canola seed (22.7 kg bag)', unit: 'kg', per: 22.7 },
  seed_corn: { label: 'corn seed', ask: 'Pioneer P7211 seed corn (80 000 kernel bag, 22 kg)', unit: 'kg', per: 22 },
  urea: { label: 'urea 46-0-0', ask: 'Urea fertilizer 46-0-0 (1 t tote)', unit: 'kg', per: 1000 },
  map: { label: 'MAP 11-52-0', ask: 'MAP fertilizer 11-52-0 (1 t tote)', unit: 'kg', per: 1000 },
  herbicide: { label: 'herbicide', ask: 'Glyphosate 540 herbicide (115 L tote)', unit: 'L', per: 115 },
  insecticide: { label: 'insecticide', ask: 'Lambda-cyhalothrin insecticide (10 L jug)', unit: 'L', per: 10 },
  diesel: { label: 'diesel', ask: 'A bulk delivery of farm diesel, 5000 L', unit: 'L', per: 5000 },
  propane: { label: 'propane', ask: 'A propane fill for the dryer tank, 3000 L', unit: 'L', per: 3000 },
  stakes: { label: 'survey stakes', ask: 'Survey stakes and flagging tape (bundle of 100)', unit: '', per: 100 },
  posts: { label: 'fence posts', ask: 'Pressure-treated fence posts 4 in × 8 ft (bundle of 50)', unit: '', per: 50 },
  wire: { label: 'page wire', ask: 'Woven page wire fence 330 m roll', unit: 'm', per: 330 },
  gates: { label: 'farm gates', ask: 'A 16 ft galvanized tube farm gate with hinges', unit: '', per: 1 },
  culvert: { label: 'culvert pipe', ask: 'Corrugated steel culvert pipe 600 mm × 6 m', unit: '', per: 1 },
  tile: { label: 'drain tile', ask: 'Perforated drain tile 100 mm (75 m roll)', unit: 'm', per: 75 },
  gravel: { label: 'lane gravel', ask: 'Crushed gravel road base, 20 t load', unit: 't', per: 20 },
  sacks: { label: 'flour sacks', ask: 'Paper flour sacks 10 kg (bundle of 50)', unit: '', per: 50 }
};

// --- Prices he asks at the farm stand and on his website (CAD) -----------------------------------
const FARM_RETAIL = {
  flour: { label: '10 kg bag of stone-ground whole-wheat flour', kg: 10, price: 24 },
  wheat: { label: '20 kg sack of cleaned wheat berries', kg: 20, price: 22 },
  corn: { label: '20 kg sack of feed corn', kg: 20, price: 14 },
  canola: { label: '10 kg bag of canola seed for crushing', kg: 10, price: 15 }
};

// --- His saved farm --------------------------------------------------------------------------------
// state.farm is created here (before js/main.js loads the save), so loadPersistentBrainState restores
// it; farmState() fills in anything an older save (or an older farm) is missing.
function farmDefaultState() {
      return {
        v: 1, startedAt: 0, goalRef: null, site: null, surveyed: false,
        land: { cleared: 0, graded: 0, drained: 0, fenced: 0, lane: 0, stones: 0 },
        buildings: {}, fields: [], stock: {}, owned: {},
        bins: {}, wet: {}, flour: 0, sold: [], earnings: 0, stand: { open: false, sales: 0 },
        home: null, hitch: null, log: [], lastDay: 0, harvests: [], plan: []
      };
    }
if (typeof state !== 'undefined' && !state.farm) state.farm = farmDefaultState();

function farmState() {
      if (!state.farm || typeof state.farm !== 'object' || Array.isArray(state.farm)) state.farm = farmDefaultState();
      const f = state.farm, d = farmDefaultState();
      Object.keys(d).forEach(k => {
        if (f[k] === undefined || f[k] === null && d[k] !== null) f[k] = d[k];
        else if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) && (typeof f[k] !== 'object' || Array.isArray(f[k]))) f[k] = d[k];
        else if (Array.isArray(d[k]) && !Array.isArray(f[k])) f[k] = d[k];
      });
      Object.keys(d.land).forEach(k => { if (!Number.isFinite(f.land[k])) f.land[k] = 0; });
      if (f.log.length > 60) f.log.length = 60;
      return f;
    }

function farmStock(key) { return Math.max(0, Number(farmState().stock[key]) || 0); }
function farmUse(key, amt) {
      const f = farmState();
      const have = farmStock(key), used = Math.min(have, Math.max(0, amt));
      f.stock[key] = Math.round((have - used) * 100) / 100;
      return used;
    }
function farmAdd(key, amt) { const f = farmState(); f.stock[key] = Math.round((farmStock(key) + amt) * 100) / 100; }
function farmFmt(key, amt) {
      const s = FARM_SUPPLIES[key], u = s ? s.unit : '';
      const n = amt >= 100 ? Math.round(amt) : Math.round(amt * 10) / 10;
      return u === 'kg' && amt >= 1000 ? `${Math.round(amt / 100) / 10} t` : `${n}${u ? ' ' + u : ''}`;
    }
function farmLog(text) {
      const f = farmState();
      f.log.unshift({ at: Date.now(), day: Math.floor(farmDayNow()), text: String(text).slice(0, 200) });
      if (f.log.length > 60) f.log.length = 60;
    }

// --- World time (in world days, fractional) -------------------------------------------------------
// A world day is 12 real hours (js/worldclock.js). Everything on the farm runs on this clock, so a
// test (or a long absence) moves the whole farm forward by moving the calendar.
function farmDayNow(now = Date.now()) {
      const cal = ensureCalendar();
      return (Math.max(0, now - cal.epoch) + (cal.startHour / 24) * WORLD_DAY_MS) / WORLD_DAY_MS;
    }
// The day-of-year (1..365) and season of world day index `d` (0-based, as farmDayNow)
function farmDayInfo(d) {
      const cal = ensureCalendar();
      const doy0 = (cal.startDayOfYear + Math.floor(d)) % DAYS_PER_YEAR;
      let season = 'Winter';
      if (doy0 >= 79 && doy0 < 171) season = 'Spring';
      else if (doy0 >= 171 && doy0 < 265) season = 'Summer';
      else if (doy0 >= 265 && doy0 < 355) season = 'Autumn';
      // Heat: the growing degree days of a Kelowna year, 0 in deep winter, 1 at the height of summer
      const heat = Math.max(0, Math.cos((doy0 + 1 - 200) / 365 * Math.PI * 2) * 0.62 + 0.38);
      let rainH = 0;
      if (season === 'Spring' && typeof rainForHour === 'function') for (let h = 0; h < 24; h++) if (rainForHour(Math.floor(d) * 24 + h)) rainH++;
      // Summer thunderstorms and autumn rain the game's sky doesn't show: a little, now and then
      const hash = typeof windHash === 'function' ? windHash(9100003 + Math.floor(d)) : 0.5;
      if (season === 'Summer' && hash < 0.2) rainH += 3;
      if (season === 'Autumn' && hash < 0.22) rainH += 4;
      return { doy: doy0 + 1, season, heat, rainH, frozen: season === 'Winter' || doy0 + 1 > 300 || doy0 + 1 < 85 };
    }
// Can field work happen today? (no ploughing frozen ground, no combining in the rain)
function farmFieldWorkable(op, d = farmDayNow()) {
      const w = farmDayInfo(d);
      if (w.frozen && op !== 'harvest') return { ok: false, why: 'the ground is frozen' };
      if (op === 'harvest' && w.season === 'Winter') return { ok: false, why: 'it is winter' };
      const now = typeof isRaining === 'function' && isRaining();
      if (now && (op === 'harvest' || op === 'spray' || op === 'seed')) return { ok: false, why: 'it is raining' };
      return { ok: true };
    }
function farmInWindow(crop, d = farmDayNow()) {
      const c = FARM_CROPS[crop], doy = farmDayInfo(d).doy;
      return Boolean(c && doy >= c.window[0] && doy <= c.window[1]);
    }

// --- Fields ---------------------------------------------------------------------------------------
// A field: { id, name, use, x0, z0, x1, z1 (world rect), soil: 'sod'|'stubble'|'ploughed'|'harrowed'|
// 'seeded', crop, history:[crop by year], g (growth 0..1), m (moisture 0..1), n (nitrogen kg/ha),
// w (weeds 0..1), p (pests 0..1), pest, yp (yield potential 0..1), seededDay, ripeDay, lastSim (day),
// op: { key, done: [strip bools], at } while an operation is under way, fert, sprayed }
function farmNewField(id, name, rect) {
      return { id, name, use: 'grain', ...rect, soil: 'sod', crop: null, history: [], g: 0, m: 0.6, n: 45, w: 0.25, p: 0, pest: null, yp: 1,
        seededDay: null, ripeDay: null, lastSim: Math.floor(farmDayNow()), op: null, fert: 0, sprayed: 0, harvestedT: 0, moistureGrain: null };
    }
function farmFieldHa(f) { return farmHa(Math.abs(f.x1 - f.x0), Math.abs(f.z1 - f.z0)); }
function farmCropStage(f) {
      const c = FARM_CROPS[f.crop];
      if (!c || f.soil !== 'seeded') return null;
      let st = c.stages[0];
      c.stages.forEach(s => { if (f.g >= s[0]) st = s; });
      return { name: st[1], look: st[2] };
    }

// One world day of a field's life. Pure numbers; the 3D look follows (farmmodels.js)
function farmFieldDay(f, d) {
      const w = farmDayInfo(d);
      // Soil water: rain in, evaporation and the crop's use out (more in the heat, more with a big canopy)
      const canopy = f.soil === 'seeded' ? Math.min(1, f.g * 1.6) : 0;
      f.m = Math.max(0.05, Math.min(1, f.m + w.rainH * 0.018 - (0.003 + 0.011 * w.heat) * (0.5 + canopy * 0.7) + (w.frozen ? 0.006 : 0)));
      // Snowmelt tops the soil up in early spring
      if (w.doy >= 80 && w.doy <= 100) f.m = Math.min(0.85, f.m + 0.012);
      // Weeds come up from the seed bank whenever the soil is warm, slower under a crop
      if (!w.frozen && w.heat > 0.25) f.w = Math.min(1, f.w + 0.008 * w.heat * (1 - canopy * 0.85) * (f.soil === 'ploughed' ? 0.3 : 1));
      if (w.frozen) f.w = Math.max(0.05, f.w - 0.01);
      // Nitrogen: a little is released from the soil each warm day
      if (!w.frozen) f.n = Math.min(220, f.n + 0.15 * w.heat);
      const c = FARM_CROPS[f.crop];
      if (!c || f.soil !== 'seeded') return;
      if (f.g >= 1) {
        // Ripe crop standing in the field dries down, then starts to shatter and lodge
        f.grainM = Math.max(c.storeMoisture - 2, (f.grainM || c.harvestMoisture + 6) - (w.rainH ? -0.6 : 0.35 + 0.4 * w.heat));
        if (d - (f.ripeDay || d) > 30 || w.season === 'Winter') f.yp = Math.max(0.2, f.yp - 0.01);
        return;
      }
      if (w.frozen) {
        // Frost on a green crop ends the season for it
        if (f.g > 0.07) { f.yp = Math.max(0.3, f.yp - 0.04); f.g = Math.min(1, f.g + 0.01); }
        return;
      }
      // Growth: heat x water x nitrogen x health
      const mf = f.m < 0.12 ? 0.1 : f.m < 0.3 ? 0.1 + 0.9 * (f.m - 0.12) / 0.18 : f.m > 0.92 ? 0.6 : 1;
      const needN = c.n * f.g, nf = f.n <= 0 ? 0.4 : Math.min(1.1, 0.5 + 0.6 * Math.min(1, f.n / Math.max(30, c.n - needN)));
      const hf = 1 - 0.5 * f.p;
      // Development runs on heat (growing degree days); drought and hunger only hurry it a little at the
      // end. What stress takes is the yield (yp below), as in a real field.
      const rate = (0.35 + 0.65 * w.heat) * (0.85 + 0.15 * Math.min(1, mf * nf * hf));
      const dg = rate / c.days * 1.15;
      f.g = Math.min(1, f.g + dg);
      // The crop takes up nitrogen as it grows
      f.n = Math.max(0, f.n - c.n * dg * 0.9);
      // Stress lowers what the field will yield: drought, hunger, weeds, pests
      const stress = (1 - mf) * 0.012 + (nf < 0.8 ? (0.8 - nf) * 0.02 : 0) + f.w * 0.006 + f.p * 0.012;
      f.yp = Math.max(0.15, Math.min(1.1, f.yp - stress + (nf > 1 && mf === 1 ? 0.001 : 0)));
      // Pests: in their window, a chance each day of an outbreak; then they build until sprayed
      const P = c.pests, rot = f.history[f.history.length - 1] === f.crop ? 2.5 : 1;
      if (P && !f.pest && w.doy >= P.window[0] && w.doy <= P.window[1]) {
        const roll = typeof windHash === 'function' ? windHash(8800000 + Math.floor(d) * 7 + f.id.length * 131 + f.id.charCodeAt(f.id.length - 1)) : Math.random();
        if (roll < P.chance * rot) { f.pest = P.name; f.p = 0.08; }
      }
      if (f.pest) f.p = Math.min(1, f.p + 0.035);
      if (f.g >= 1) { f.ripeDay = d; f.grainM = c.harvestMoisture + 6; }
    }

// Bring every field up to today (catches up a long absence, capped at two years)
function farmSimulate(now = Date.now()) {
      const F = farmState(), today = Math.floor(farmDayNow(now));
      F.fields.forEach(f => {
        let d = Number.isFinite(f.lastSim) ? f.lastSim : today;
        if (today - d > 730) d = today - 730;
        while (d < today) { d++; farmFieldDay(f, d); }
        f.lastSim = today;
      });
      F.lastDay = today;
    }

// What the field would yield if harvested now, in tonnes
function farmExpectedYield(f) {
      const c = FARM_CROPS[f.crop];
      if (!c || f.soil !== 'seeded') return 0;
      const prev = f.history[f.history.length - 1];
      const rot = prev && FARM_ROTATION[f.crop] ? (FARM_ROTATION[f.crop].after[prev] || 1) : 1;
      const weeds = 1 - 0.55 * f.w, ripe = Math.min(1, f.g);
      return Math.max(0, c.yield * farmFieldHa(f) * f.yp * rot * weeds * ripe * ripe);
    }
// Which crop goes on this field next (his rotation)
function farmNextCrop(f) {
      const prev = f.crop || f.history[f.history.length - 1];
      if (!prev) return FARM_ROTATION_PLAN[farmState().fields.indexOf(f) % FARM_ROTATION_PLAN.length];
      const i = FARM_ROTATION_PLAN.indexOf(prev);
      return FARM_ROTATION_PLAN[(i + 1) % FARM_ROTATION_PLAN.length];
    }

// --- The grain store: bins, the wet tank, drying, milling ------------------------------------------
// bins: { crop: { t, m } } (tonnes at moisture %); wet: grain waiting for the dryer
function farmBinCapacity() {
      const F = farmState(), B = FARM_BUILDINGS.bins;
      return F.buildings.bins && F.buildings.bins.stage === 'done' ? B.capT * B.count : 0;
    }
function farmBinTotal() { return Object.values(farmState().bins).reduce((s, b) => s + (b.t || 0), 0); }
function farmStoreGrain(crop, t, moisture) {
      const F = farmState(), c = FARM_CROPS[crop];
      const target = c && moisture > c.storeMoisture + 0.2 ? F.wet : F.bins;
      const b = target[crop] || (target[crop] = { t: 0, m: moisture });
      b.m = (b.m * b.t + moisture * t) / Math.max(0.001, b.t + t);
      b.t = Math.round((b.t + t) * 100) / 100;
      return target === F.wet ? 'wet' : 'bin';
    }
// Dry `t` tonnes: each point of moisture off a tonne takes about 1.6 L of propane; the shrink is real
function farmDry(crop, t) {
      const F = farmState(), c = FARM_CROPS[crop], w = F.wet[crop];
      if (!c || !w || w.t <= 0) return 0;
      const amt = Math.min(t, w.t), points = Math.max(0, w.m - c.storeMoisture);
      const needL = amt * points * 1.6;
      if (farmStock('propane') < needL) return -1;
      farmUse('propane', needL);
      const dryT = amt * (100 - w.m) / (100 - c.storeMoisture);
      w.t = Math.round((w.t - amt) * 100) / 100;
      if (w.t <= 0.01) delete F.wet[crop];
      const b = F.bins[crop] || (F.bins[crop] = { t: 0, m: c.storeMoisture });
      b.m = (b.m * b.t + c.storeMoisture * dryT) / Math.max(0.001, b.t + dryT);
      b.t = Math.round((b.t + dryT) * 100) / 100;
      return dryT;
    }
function farmTakeGrain(crop, t) {
      const b = farmState().bins[crop];
      if (!b) return 0;
      const got = Math.min(b.t, t);
      b.t = Math.round((b.t - got) * 1000) / 1000;
      return got;
    }

// =====================================================================================================
// Stage 2: orchard and vegetables, livestock, hay and feed. The same registries, extended in place, so
// the field passes, the parts lists, the buildings and the store read them like stage 1's. Everything
// marked `stage2: true` belongs to the mixed-farm plan (js/farm2.js) and stays out of stage 1's lists.
// The numbers are for a small irrigated mixed farm in the BC Interior (Kelowna), 2026 prices in CAD.
// =====================================================================================================

// --- Orchard, vegetable and hay crops --------------------------------------------------------------
// Orchard: bearFrom/fullAt: years after planting a tree starts to bear / is in full crop; kgTree: a
// mature tree's crop; bloom: day of year; window: picking window; keepDays: in the cooler.
// Vegetables run through the same field model as grain (days, window, seed per ha, yield t/ha, n).
// Hay is a perennial stand: days = regrowth from one cut to the next, yield = t/ha of hay per cut.
Object.assign(FARM_CROPS, {
  apple: {
    use: 'orchard', label: 'Apples', emoji: '🍎', variety: 'Ambrosia on M9 rootstock (tall-spindle, high density)',
    bearFrom: 2, fullAt: 4, kgTree: 18, bloom: 125, window: [258, 292], keepDays: 150, price: 1.6, perKgRetail: true,
    pests: { name: 'codling moth', window: [150, 230], chance: 0.03 }, colour: { green: 0x4f7f2c, ripe: 0xc0392b, blossom: 0xf6e8ee }
  },
  cherry: {
    use: 'orchard', label: 'Cherries', emoji: '🍒', variety: 'Sweetheart on Gisela 5',
    bearFrom: 3, fullAt: 5, kgTree: 14, bloom: 112, window: [192, 214], keepDays: 14, price: 4.5, perKgRetail: true,
    pests: { name: 'cherry fruit fly', window: [170, 205], chance: 0.035 }, colour: { green: 0x3f6f28, ripe: 0x7a0f1d, blossom: 0xffffff }
  },
  potato: {
    use: 'vegetable', label: 'Potatoes', emoji: '🥔', variety: 'Yukon Gold (seed potatoes, cut and suberized)',
    days: 95, window: [115, 152], seed: 2000, seedUnit: 'kg', yield: 30, n: 150, keepDays: 180, water: 1.1,
    stages: [[0, 'planted', 'bare'], [0.12, 'emerged', 'sprout'], [0.3, 'vining', 'leafy'], [0.55, 'flowering', 'flower'], [0.85, 'vines dying back', 'turning'], [1, 'ready to dig', 'ripe']],
    colour: { green: 0x3f7a2e, ripe: 0x8a7a45 }, pests: { name: 'Colorado potato beetle', window: [160, 210], chance: 0.03 }
  },
  carrot: {
    use: 'vegetable', label: 'Carrots', emoji: '🥕', variety: 'Bolero (Nantes type)',
    days: 80, window: [110, 175], seed: 3, seedUnit: 'kg', yield: 45, n: 100, keepDays: 120, water: 1,
    stages: [[0, 'sown', 'bare'], [0.12, 'emerged', 'sprout'], [0.35, 'true leaves', 'leafy'], [0.7, 'roots sizing', 'head'], [1, 'ready to lift', 'ripe']],
    colour: { green: 0x4f9a35, ripe: 0x4f8a35 }, pests: { name: 'carrot rust fly', window: [150, 200], chance: 0.02 }
  },
  squash: {
    use: 'vegetable', label: 'Butternut squash', emoji: '🎃', variety: 'Waltham butternut',
    days: 100, window: [140, 162], seed: 4, seedUnit: 'kg', yield: 25, n: 110, keepDays: 90, water: 1.2,
    stages: [[0, 'sown', 'bare'], [0.1, 'emerged', 'sprout'], [0.3, 'running vines', 'leafy'], [0.5, 'flowering', 'flower'], [0.75, 'fruit sizing', 'turning'], [1, 'cured on the vine', 'ripe']],
    colour: { green: 0x3d7a2a, ripe: 0xd9a03a }, pests: { name: 'squash bugs', window: [170, 220], chance: 0.02 }
  },
  bean: {
    use: 'vegetable', label: 'Green beans', emoji: '🫛', variety: 'Provider bush bean',
    days: 58, window: [140, 185], seed: 110, seedUnit: 'kg', yield: 9, n: 40, keepDays: 7, water: 1,
    stages: [[0, 'sown', 'bare'], [0.12, 'emerged', 'sprout'], [0.4, 'bushy', 'leafy'], [0.65, 'flowering', 'flower'], [1, 'pods ready', 'ripe']],
    colour: { green: 0x4a8f32, ripe: 0x4a8f32 }, pests: { name: 'bean leaf beetles', window: [170, 215], chance: 0.02 }
  },
  hay: {
    use: 'hay', label: 'Alfalfa-grass hay', emoji: '🌿', variety: 'Alfalfa and orchardgrass mix (60/40)',
    days: 40, window: [110, 165], seed: 18, seedUnit: 'kg', yield: 2.9, n: 0, cuts: 3, mowMoisture: 78, baleMoisture: 18,
    stages: [[0, 'seeded', 'bare'], [0.1, 'regrowing', 'sprout'], [0.4, 'vegetative', 'leafy'], [0.8, 'early bud', 'head'], [1, 'first flower: cut now', 'ripe']],
    colour: { green: 0x5a9a3a, ripe: 0x6f9a45 }
  }
});

FARM_FIELD_USES.orchard = { label: 'orchard', ops: ['prune', 'orchardspray', 'thin', 'pick'] };
FARM_FIELD_USES.vegetable = { label: 'vegetables', ops: ['till', 'plant', 'irrigate', 'cultivate', 'dig', 'pack'] };
FARM_FIELD_USES.hay = { label: 'hay', ops: ['mow', 'ted', 'rake', 'bale', 'haul'] };
FARM_FIELD_USES.pasture = { label: 'pasture', ops: ['graze', 'water'] };

// --- Livestock -------------------------------------------------------------------------------------------
// kg: grown weight; hayKg / grainKg: daily ration (as fed); waterL a day; gestation days; milkPeak L a
// day (dairy), lactation and dry days; lay: eggs per hen-day at peak (hens); grazeKgDM: what one
// takes from the pasture a day when it is out; price: what one costs to buy (CAD)
Object.assign(FARM_ANIMALS, {
  dairy: { label: 'Jersey dairy cow', short: 'cow', emoji: '🐄', breed: 'Jersey', kg: 450, hayKg: 11, grainKg: 5, waterL: 70, grazeKgDM: 12,
    gestation: 279, milkPeak: 24, lactation: 305, dry: 60, calfKg: 25, price: 2900, building: 'stalls', products: ['milk'], ask: 'A bred Jersey dairy cow (second lactation, due in spring)' },
  beef: { label: 'Black Angus cow', short: 'cow', emoji: '🐂', breed: 'Angus', kg: 600, hayKg: 12, grainKg: 0, waterL: 55, grazeKgDM: 13,
    gestation: 283, calfKg: 35, sellDays: 540, sellKg: 560, price: 3400, building: 'stalls', products: ['beef'], ask: 'A bred Black Angus cow (cow-calf pair later, due in spring)' },
  hen: { label: 'ISA Brown laying hen', short: 'hen', emoji: '🐔', breed: 'ISA Brown', kg: 2, feedKg: 0.115, waterL: 0.25, lay: 0.88,
    price: 28, building: 'coop', products: ['eggs'], ask: 'Point-of-lay ISA Brown hens (20 weeks)' }
});
// Each grown animal's daily ration is mixed from his own hay and grain (js/farm2.js): the TMR for the
// cattle (hay + rolled corn and wheat + mineral), layer mash for the hens (ground corn and wheat + premix)
const FARM_FEED = {
  tmr: { label: 'cattle TMR', hay: 0.66, corn: 0.22, wheat: 0.1, mineral: 0.02 },
  layer: { label: 'layer mash', corn: 0.55, wheat: 0.2, premix: 0.17, oyster: 0.08 }
};

// --- Stage 2 buildings (the same staged build: foundation, frame, walls, roof) -------------------------
Object.assign(FARM_BUILDINGS, {
  packshed: {
    stage2: true, label: 'Packing shed and cooler', emoji: '📦', at: [11, 88], w: 10, d: 8, rot: 0, concrete: 12, foundation: 'A sloped wash-floor slab with a trench drain',
    parts: [['Steel building kit 10 × 8 m, insulated', 1, 'p'], ['Walk-in cooler 3 × 4 m (insulated panels, 1.5 hp condensing unit)', 1, 'p'],
      ['Vegetable barrel washer, 2 hp', 1, 'p'], ['Stainless triple sink and spray nozzle', 1, 'p'], ['Packing table and roller conveyor 4 m', 1, 'p'],
      ['Bench scale 60 kg (legal for trade)', 1, 'p'], ['Trench drain 6 m', 1, 'p'], ['Rebar 15M × 20 ft', 30, 'p'], ['Ready-mix concrete 30 MPa (m³)', 12, 'c']]
  },
  hayshed: {
    stage2: true, label: 'Hay shed', emoji: '🌾', at: [31, 90], w: 16, d: 8, rot: 0, concrete: 3, foundation: 'Twelve post footings',
    parts: [['Pressure-treated pole 6 × 6 in × 20 ft', 12, 'p'], ['Prefab truss 8 m span', 9, 'p'], ['Purlin 2×4 × 16 ft', 40, 'p'],
      ['29-gauge steel roofing sheet × 4.9 m', 30, 'p'], ['Gravel pad 15 t (under the bales)', 1, 'p'], ['Ready-mix concrete 30 MPa (m³)', 3, 'c']]
  },
  coop: {
    stage2: true, label: 'Chicken coop', emoji: '🐔', at: [44, 104], w: 6, d: 4, rot: 0, concrete: 0,
    parts: [['Pressure-treated skid 4×6 × 20 ft', 2, 'p'], ['SPF stud 2×4 × 8 ft', 60, 'p'], ['Plywood 1/2 in 4×8', 22, 'p'], ['Metal roof panel 8 ft', 8, 'p'],
      ['Nest box bank, 10 holes', 1, 'p'], ['Roost bars and droppings board', 1, 'p'], ['Automatic pop door with light sensor', 1, 'p'],
      ['Hanging feeder 20 kg and heated waterer', 1, 'p'], ['Coop light on a timer (14 h day)', 1, 'p'], ['Welded-wire run fence 30 m and posts', 1, 'p']]
  },
  milkhouse: {
    stage2: true, label: 'Milk house and robot milker', emoji: '🥛', at: [65, 58], w: 8, d: 8, rot: 0, concrete: 16, foundation: 'Milk-house slab with a floor drain',
    parts: [['Voluntary milking robot, single box (with cow ID collars)', 1, 'p'], ['Bulk milk tank 1000 L with cooling', 1, 'p'],
      ['Batch pasteurizer 100 L', 1, 'p'], ['Bottle filler and capper', 1, 'p'], ['Stainless wash sinks and a 180 L hot-water tank', 1, 'p'],
      ['Steel building kit 8 × 8 m, insulated', 1, 'p'], ['Rebar 15M × 20 ft', 36, 'p'], ['Ready-mix concrete 30 MPa (m³)', 16, 'c']]
  },
  stalls: {
    stage2: true, label: 'Barn stalls and feed alley', emoji: '🐄', at: [50, 52], w: 14, d: 24, rot: 0, inside: 'barn', concrete: 0,
    parts: [['Free-stall loop, galvanized', 12, 'p'], ['Rubber stall mat 4 × 6 ft', 12, 'p'], ['Self-locking headlock, 5 head', 3, 'p'],
      ['Frost-free automatic waterer, 2 hole', 2, 'p'], ['Calving pen gates 12 ft', 4, 'p'], ['Feed bunk liner, 12 m', 1, 'p']]
  },
  well: {
    stage2: true, label: 'Well and pump house', emoji: '💧', at: [40, 98], w: 3, d: 3, rot: 0, concrete: 2, foundation: 'Pump-house pad',
    parts: [['Drilled well, 60 m, cased (driller)', 1, 'p'], ['Submersible pump 2 hp, 40 L/min', 1, 'p'], ['Pressure tank 300 L', 1, 'p'],
      ['Drip irrigation manifold: filter, valves, timer', 1, 'p'], ['Frost-free yard hydrant', 3, 'p'], ['PEX water line 1 in (100 m roll)', 3, 'p'], ['Ready-mix concrete 30 MPa (m³)', 2, 'c']]
  }
});
const FARM2_BUILD_ORDER = ['well', 'packshed', 'hayshed', 'coop', 'stalls', 'milkhouse'];

// --- Stage 2 machines and implements -------------------------------------------------------------------
FARM_MACHINES.compact = { kind: 'farmcompact', label: 'Compact tractor', ask: 'A 55 hp compact utility tractor with front loader and 3-point hitch', re: /compact utility tractor|\b55 hp\b/i, hp: 55, tankL: 70, lph: 7, speed: 1.0, emoji: '🚜', stage2: true };
Object.assign(FARM_IMPLEMENTS, {
  tiller: { stage2: true, label: 'Rotary tiller', ask: 'A 1.8 m rotary tiller', re: /rotary tiller/i, widthM: 1.8, kmh: 4, needHp: 35, op: 'till' },
  planter: { stage2: true, label: 'Vegetable planter', ask: 'A 2-row vegetable planter with seed plates and a potato cup unit', re: /vegetable planter/i, widthM: 1.8, kmh: 5, needHp: 30, op: 'plant' },
  cultivator: { stage2: true, label: 'Row cultivator', ask: 'A 2-row S-tine cultivator with finger weeders', re: /row cultivator|S-tine cultivator/i, widthM: 1.8, kmh: 6, needHp: 25, op: 'cultivate' },
  digger: { stage2: true, label: 'Root lifter', ask: 'A 1-row potato and carrot lifter with a shaker chain', re: /carrot lifter|root lifter/i, widthM: 1.8, kmh: 4, needHp: 40, op: 'dig' },
  airblast: { stage2: true, label: 'Orchard sprayer', ask: 'A 600 L trailed airblast orchard sprayer', re: /airblast/i, widthM: 3.5, kmh: 6, needHp: 40, op: 'orchardspray' },
  mower: { stage2: true, label: 'Mower-conditioner', ask: 'A 3.2 m disc mower-conditioner', re: /mower-?conditioner/i, widthM: 3.2, kmh: 12, needHp: 80, op: 'mow' },
  tedder: { stage2: true, label: 'Hay tedder', ask: 'A 4-rotor hay tedder, 5.2 m', re: /hay tedder/i, widthM: 5.2, kmh: 12, needHp: 40, op: 'ted' },
  rake: { stage2: true, label: 'Wheel rake', ask: 'An 8-wheel V hay rake', re: /hay rake|wheel rake/i, widthM: 6.4, kmh: 12, needHp: 30, op: 'rake' },
  baler: { stage2: true, label: 'Round baler', ask: 'A 4 × 5 ft round baler with net wrap', re: /round baler/i, widthM: 6.4, kmh: 9, needHp: 70, op: 'bale' },
  squarebaler: { stage2: true, label: 'Small square baler', ask: 'A small square baler with a bale thrower', re: /square baler/i, widthM: 6.4, kmh: 7, needHp: 50, op: 'balesq' },
  balewagon: { stage2: true, label: 'Hay wagon', ask: 'A 9 m flat hay wagon and a bale spear for the loader', re: /hay wagon|bale spear/i, widthM: 0, kmh: 15, needHp: 40, op: 'haulhay' },
  mixer: { stage2: true, label: 'TMR mixer', ask: 'A 7 m³ vertical TMR feed mixer wagon with a scale', re: /TMR|feed mixer/i, widthM: 0, kmh: 10, needHp: 70, op: 'mix' },
  rollermill: { stage2: true, label: 'Roller and hammer mill', ask: 'A 5 hp grain roller mill and hammer mill', re: /roller mill|hammer mill/i, widthM: 0, kmh: 0, needHp: 0, op: 'grind' }
});
// Field operations of stage 2 (the same strip passes as stage 1; js/farm.js farmWorkField)
Object.assign(FARM_OPS, {
  till: { label: 'Tilling', verb: 'till', impl: 'tiller', machine: 'compact', soil: 'harrowed', lpha: 30, emoji: '🟫', say: f => `Rotary tiller down: the ${f.name.toLowerCase()} turned into a fine seedbed, beds 1.8 m wide.` },
  plant: { label: 'Planting', verb: 'plant', impl: 'planter', machine: 'compact', soil: 'seeded', lpha: 8, emoji: '🌱', say: f => `${FARM_CROPS[f.crop] ? FARM_CROPS[f.crop].variety : 'Seed'} going in, two rows to a bed, drip tape laid with it.` },
  cultivate: { label: 'Cultivating', verb: 'cultivate', impl: 'cultivator', machine: 'compact', soil: null, lpha: 6, emoji: '🌿', say: f => `S-tines between the rows, finger weeders in the row: the weeds in the ${f.name.toLowerCase()} uprooted while they are small.` },
  dig: { label: 'Digging', verb: 'dig', impl: 'digger', machine: 'compact', soil: 'stubble', lpha: 25, emoji: '🧺', say: f => `The digger lifts the ${FARM_CROPS[f.crop] ? FARM_CROPS[f.crop].label.toLowerCase() : 'roots'} onto the shaker chain; I pick them into the bins behind.` },
  orchardspray: { label: 'Orchard spraying', verb: 'spray', impl: 'airblast', machine: 'compact', soil: null, lpha: 10, emoji: '💨', say: () => 'Airblast sprayer down every alley, fan on, nozzles only on the tree side. Low drift, no wind.' },
  mow: { label: 'Mowing hay', verb: 'mow', impl: 'mower', machine: 'tractor', soil: null, lpha: 9, emoji: '🌿', say: f => `Mowing the ${f.name.toLowerCase()} at first flower: the conditioner rolls crimp the stems so they dry as fast as the leaves.` },
  ted: { label: 'Tedding', verb: 'ted', impl: 'tedder', machine: 'tractor', soil: null, lpha: 4, emoji: '🌀', say: () => 'Tedder rotors spinning: the swaths fluffed and spread out to dry in the sun.' },
  rake: { label: 'Raking', verb: 'rake', impl: 'rake', machine: 'tractor', soil: null, lpha: 3, emoji: '〰️', say: () => 'The wheel rake rolls the dry hay into windrows for the baler.' },
  bale: { label: 'Round baling', verb: 'bale', impl: 'baler', machine: 'tractor', soil: null, lpha: 8, emoji: '🟤', say: () => 'Pickup down on the windrow, the chamber filling: net wrap, tailgate up, and out rolls a 4 × 5 ft bale.' },
  balesq: { label: 'Square baling', verb: 'bale', impl: 'squarebaler', machine: 'tractor', soil: null, lpha: 7, emoji: '🟫', say: () => 'Small squares, tied with two strings, thrown into the wagon behind.' }
});

// --- Stage 2 supplies (the ledger) --------------------------------------------------------------------------
Object.assign(FARM_SUPPLIES, {
  trees_apple: { label: 'apple trees', ask: 'Bare-root Ambrosia apple trees on M9, 2-year feathered (bundle of 25)', unit: '', per: 25, stage2: true },
  trees_cherry: { label: 'cherry trees', ask: 'Bare-root Sweetheart cherry trees on Gisela 5 (bundle of 10)', unit: '', per: 10, stage2: true },
  trellis: { label: 'trellis posts and wire', ask: 'Orchard trellis: 3 m treated posts, 12.5 ga high-tensile wire, anchors (per 30 m row)', unit: 'rows', per: 1, stage2: true },
  guards: { label: 'tree guards and stakes', ask: 'Spiral tree guards and bamboo stakes (bundle of 50)', unit: '', per: 50, stage2: true },
  seed_potato: { label: 'seed potatoes', ask: 'Certified Yukon Gold seed potatoes (50 lb sack)', unit: 'kg', per: 22.7, stage2: true },
  seed_carrot: { label: 'carrot seed', ask: 'Bolero carrot seed, pelleted (1 kg)', unit: 'kg', per: 1, stage2: true },
  seed_squash: { label: 'squash seed', ask: 'Waltham butternut squash seed (500 g)', unit: 'kg', per: 0.5, stage2: true },
  seed_bean: { label: 'bean seed', ask: 'Provider bush bean seed (25 kg)', unit: 'kg', per: 25, stage2: true },
  seed_hay: { label: 'hay seed', ask: 'Alfalfa and orchardgrass hay seed mix (25 kg bag)', unit: 'kg', per: 25, stage2: true },
  compost: { label: 'compost', ask: 'Screened compost, 10 m³ load', unit: 'm³', per: 10, stage2: true },
  driptape: { label: 'drip tape', ask: 'Drip tape 8 mil, 30 cm emitters (2300 m roll)', unit: 'm', per: 2300, stage2: true },
  netwrap: { label: 'bale net wrap', ask: 'Round-bale net wrap (roll, about 350 bales)', unit: 'bales', per: 350, stage2: true },
  twine: { label: 'baler twine', ask: 'Small square baler twine (2 balls, about 400 bales)', unit: 'bales', per: 400, stage2: true },
  mineral: { label: 'cattle mineral', ask: 'Beef and dairy mineral 2:1 with selenium (25 kg bag)', unit: 'kg', per: 25, stage2: true },
  premix: { label: 'layer premix', ask: 'Layer protein premix 36% (25 kg bag)', unit: 'kg', per: 25, stage2: true },
  oyster: { label: 'oyster shell', ask: 'Oyster shell grit (25 kg bag)', unit: 'kg', per: 25, stage2: true },
  vetkit: { label: 'vet supplies', ask: 'Livestock vet kit: thermometer, calving chains, iodine, electrolytes, syringes', unit: 'kits', per: 1, stage2: true },
  bedding: { label: 'bedding', ask: 'Wood-shaving bedding (bulk, 10 m³)', unit: 'm³', per: 10, stage2: true },
  cartons: { label: 'egg cartons', ask: 'Egg cartons, dozen size (case of 200)', unit: '', per: 200, stage2: true },
  bottles: { label: 'milk bottles', ask: 'Glass milk bottles 1 L with caps (case of 120)', unit: '', per: 120, stage2: true },
  boxes: { label: 'produce boxes and bags', ask: 'Produce boxes, mesh bags and clamshells (mixed case of 300)', unit: '', per: 300, stage2: true },
  hay_bought: { label: 'bought hay', ask: 'Grass-alfalfa round bales from a neighbour, delivered (10 bales, 4.5 t)', unit: 'bales', per: 10, stage2: true }
});

// --- Prices at the stand and on the website (CAD, 2026) ---------------------------------------------------
Object.assign(FARM_RETAIL, {
  apple: { label: '2 kg bag of Ambrosia apples', kg: 2, price: 8, produce: 'apple' },
  cherry: { label: '1 kg clamshell of Sweetheart cherries', kg: 1, price: 12, produce: 'cherry' },
  potato: { label: '4.5 kg (10 lb) bag of Yukon Gold potatoes', kg: 4.5, price: 9, produce: 'potato' },
  carrot: { label: '1 kg bag of Bolero carrots', kg: 1, price: 4, produce: 'carrot' },
  squash: { label: 'Butternut squash (about 1.2 kg)', kg: 1.2, price: 4.5, produce: 'squash' },
  bean: { label: '500 g of green beans', kg: 0.5, price: 5, produce: 'bean' },
  eggs: { label: 'A dozen free-run brown eggs', dozen: 1, price: 7, produce: 'eggs' },
  milk: { label: '1 L glass bottle of cream-top whole milk (pasteurized)', litres: 1, price: 4.5, produce: 'milk' },
  beef: { label: 'A quarter of grass-fed Angus beef (about 55 kg, cut and wrapped)', kg: 55, price: 820, produce: 'beef' },
  hay: { label: 'A small square bale of alfalfa-grass hay', bales: 1, price: 12, produce: 'hay' }
});

// --- Where stage 2 goes on the farm (local metres, as the buildings: x from the gate side, d north) -----
// The north-west of the steading was left empty in stage 1 for this. The north field becomes hay.
const FARM2_LAYOUT = {
  orchard: { x0: 7, x1: 36, d0: 104, d1: 156, rowM: 3.5, rows: { apple: 11, cherry: 3 }, treeM: { apple: 1.2, cherry: 2.5 } },
  plots: [
    { id: 'v1', name: 'Potato plot', crop: 'potato', x0: 7, x1: 36, d0: 160, d1: 172 },
    { id: 'v2', name: 'Carrot plot', crop: 'carrot', x0: 7, x1: 36, d0: 174, d1: 186 },
    { id: 'v3', name: 'Squash plot', crop: 'squash', x0: 7, x1: 36, d0: 188, d1: 200 },
    { id: 'v4', name: 'Bean plot', crop: 'bean', x0: 7, x1: 36, d0: 202, d1: 213 }
  ],
  hayField: 'f3',
  pasture: { x0: 40, x1: 72, d0: 112, d1: 212, gateX: 46 },
  pen: { x0: 60, x1: 72, d0: 36, d1: 52 },
  run: { x0: 47.5, x1: 56, d0: 100, d1: 108 }
};
// A small fixed herd and flock (what this land can feed): the plan's livestock list
const FARM2_STOCKING = { dairy: 3, beef: 3, hen: 30 };
