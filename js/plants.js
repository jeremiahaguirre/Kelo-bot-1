// Kelo-bot-1 — js/plants.js
// Loaded after tryit.js (it wraps a few earlier functions). His own concrete and asphalt plant, right
// beside the big workshop (the 3D models are in js/plantmodels.js):
//   - a ready-mix concrete batch plant: he follows a mix design (1:2:3 cement, sand, stone by weight),
//     minds the water-cement ratio (less water, stronger concrete; wet sand counts), doses admixture
//     if he has it, mixes 2 m³ and loads it into his concrete mixer truck
//   - a hot-mix asphalt plant: dries and heats aggregate in a drum with a diesel or gas burner, adds
//     about 5.5% hot bitumen binder in the pugmill and loads 5 t of hot mix into his dump truck
//   - he researches each plant at NetNode first (js/groundwork.js researchJob), asks for the real
//     materials as plain requests, and the rock and dirt from his own digs can go into the bins
//   - the output is real: "A load of ready-mix concrete (2 m³)" is poured into paths and pads that
//     cure over world days, "A load of hot-mix asphalt (5 t)" paves his gravel roads (groundwork's
//     paveRoad) but cools and is wasted if he waits too long
//   - filters, mixer paddles, baghouse bags and the burner wear and need servicing
// State: state.batchPlant, state.asphaltPlant, state.concretePours (defaults in js/agent.js).

// --- Where it is --------------------------------------------------------------------------------
// East of the Workshop (js/workshopbuilding.js, WORKSHOP_SITE / WORKSHOP_LAND), right beside it at the
// island's east end and facing the same yard: the site's west edge meets the Workshop's vehicle lane, so
// trucks drive straight from the lane onto a gravel yard strip (PLANT_YARD_W) along the plant's west side
// and from there into each plant's truck lane. The plants stand in two rows: the batch plant north, cut
// into the eastern cliff behind it, and the asphalt plant south, with a gravel aisle between them. The
// south row stands on land added to the lake (KELO_ADDED_LAND below) that carries on as a gravel walkway
// and meadow to a sand beach at z 14. Each plant's model is laid out around its own origin
// (BATCH_PLANT_OFFSET / ASPHALT_PLANT_OFFSET from the site centre; z is north-, its truck lane at +z).
// The world's east bound (WORLD_MAX_X, js/agent.js) was moved out to make room for it.
const AGGREGATE_PLANT_SITE = { x: 72.0, z: 1.55, w: 19, d: 17.3, y: 0.05 };
const PLANT_SHORE_Z = 14.0;         // where the lake begins now, off the plant's new land
const PLANT_DRY_Z = PLANT_SHORE_Z - 1.5; // walk targets and parking at the plant stay north of this
const BATCH_PLANT_OFFSET = { x: 2.0, z: -4.05 };  // the batch plant's origin from the site centre
const ASPHALT_PLANT_OFFSET = { x: 2.0, z: 5.35 }; // the asphalt plant's origin
const PLANT_YARD_W = 4.0;           // the gravel yard strip between the Workshop's lane and the machines
const PLANT_LANE_Z = 1.45;          // each plant's truck lane, south of its machines (local z)
const ASPHALT_NORTH_SHIFT = 0.35;   // the asphalt plant's north machines sit this much further south
const PLANT_BLEND = 1.8;
const PLANT_BLEND_NORTH = 9;        // the cut slope into the cliff behind the batch plant
// Where the plant stood before it moved east (south of the Workshop): trucks parked there in old saves
// are moved to the new bays
const PLANT_OLD_SITE = { minX: 29.5, maxX: 57.0, minZ: 2.0, maxZ: 10.5 };
let aggregatePlantSiteDone = false;

function aggregatePlantSite() {
      if (aggregatePlantSiteDone) return AGGREGATE_PLANT_SITE;
      aggregatePlantSiteDone = true;
      const S = AGGREGATE_PLANT_SITE;
      // Its yard starts where the Workshop's vehicle lane ends, never on it
      if (typeof WORKSHOP_LAND !== 'undefined' && WORKSHOP_LAND.lane) S.x = Math.max(S.x, WORKSHOP_LAND.lane.maxX + S.w / 2);
      // Level with the Workshop's pad and lane, so the yards join flush
      S.y = typeof WORKSHOP_PAD_Y === 'number' ? WORKSHOP_PAD_Y : 0.05;
      return S;
    }

// Where each plant's own layout is centred (world)
function plantOrigin(kind) {
      const S = aggregatePlantSite(), o = kind === 'batch' ? BATCH_PLANT_OFFSET : ASPHALT_PLANT_OFFSET;
      return { x: S.x + o.x, z: S.z + o.z };
    }

function inAggregatePlantSite(x, z, pad = 0) {
      const S = aggregatePlantSite();
      return Math.abs(x - S.x) < S.w / 2 + pad && Math.abs(z - S.z) < S.d / 2 + pad;
    }

// --- Land added to the lake ------------------------------------------------------------------------
// One shared registry of made land: rounded rectangles of level ground { id, minX, maxX, minZ, maxZ,
// y, corner, beach }. Other builders (the workshop, say) can push their own; overlapping pieces join
// up because the ground is the highest of them. Each ends in a natural sand beach that slopes under
// the water and blends into the lake bed. (js/landfill.js is his own dirt-by-dirt land; this is land
// that was built with the plant.)
window.KELO_ADDED_LAND = window.KELO_ADDED_LAND || [];
// The plant's land: from the cliff foot down past the asphalt row to the beach, from just east of the
// Workshop's lane (the boat launch at its end stays open water) to a strip of meadow past the plant
KELO_ADDED_LAND.push({ id: 'aggregate-plant', minX: typeof WORKSHOP_LAND !== 'undefined' && WORKSHOP_LAND.lane ? WORKSHOP_LAND.lane.maxX + 0.25 : 62.75,
  maxX: AGGREGATE_PLANT_SITE.x + AGGREGATE_PLANT_SITE.w / 2 + 2.5, minZ: -3.0, maxZ: PLANT_SHORE_Z, y: AGGREGATE_PLANT_SITE.y, corner: 2.5, beach: 1.8 });
// Where the plant first stood, south of the Workshop: the land stays, now a meadow and beach with the
// trailer row (js/trips.js TRAILER_SLOTS) and his concrete pours on it. It joins the Workshop's lane
// along its west edge and stays clear of the boat launch.
KELO_ADDED_LAND.push({ id: 'workshop-south-meadow', minX: 30.0, maxX: typeof WORKSHOP_LAND !== 'undefined' && WORKSHOP_LAND.lane ? WORKSHOP_LAND.lane.minX - 0.25 : 56.5,
  minZ: 2.0, maxZ: 13.3, y: 0.05, corner: 2.5, beach: 1.8 });

// Solid ground here and 1.5 further toward the lake? (walk targets, parking, pours)
function plantDryAt(x, z) {
      return getAnalyticalGroundHeight(x, z) > WATER_LEVEL + 0.05 && getAnalyticalGroundHeight(x, z + 1.5) > WATER_LEVEL + 0.05;
    }

// The same spot, moved inland (north) until it is dry with a margin
function plantDrySpot(p) {
      const q = { ...p };
      for (let i = 0; i < 30 && !plantDryAt(q.x, q.z); i++) q.z -= 0.5;
      return q;
    }

// How far outside a piece a point is (negative inside), with rounded corners
function addedLandDistance(L, x, z) {
      const r = L.corner || 0;
      const qx = Math.abs(x - (L.minX + L.maxX) / 2) - ((L.maxX - L.minX) / 2 - r);
      const qz = Math.abs(z - (L.minZ + L.maxZ) / 2) - ((L.maxZ - L.minZ) / 2 - r);
      return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
    }

// The made land's surface at a point, or -Infinity where there is none: level, then a beach that
// drops 0.6 below the water over `beach` units, then eases down to the lake bed
function addedLandHeightAt(x, z, bed) {
      let best = -Infinity;
      for (const L of KELO_ADDED_LAND) {
        const d = addedLandDistance(L, x, z);
        const beach = L.beach || 1.5;
        let h;
        if (d <= 0) h = L.y;
        else if (d < beach) { const t = d / beach; h = L.y - (L.y - (WATER_LEVEL - 0.45)) * t * t * (3 - 2 * t) * 0.999 - 0.0005; }
        else if (d < beach + 2.5) h = (WATER_LEVEL - 0.45) - (d - beach) * 0.5;
        else continue;
        if (h > best) best = h;
      }
      return Math.max(best, bed);
    }

function onAddedLand(x, z, margin = 0) {
      return KELO_ADDED_LAND.some(L => addedLandDistance(L, x, z) < -margin);
    }

// The ground under the plant is levelled (scene.js asks getAnalyticalGroundHeight everywhere)
const plantOrigGround = getAnalyticalGroundHeight;
getAnalyticalGroundHeight = function (x, z) {
      const h = addedLandHeightAt(x, z, plantOrigGround(x, z));
      const S = aggregatePlantSite();
      const dzN = Math.max(0, (S.z - S.d / 2) - z), dzS = Math.max(0, z - (S.z + S.d / 2));
      // The sides of the cut into the cliff widen as it climbs, so it is a slope, not a wall
      const bx = PLANT_BLEND + dzN;
      const dx = Math.max(0, Math.abs(x - S.x) - S.w / 2);
      if (dx >= bx || dzN >= PLANT_BLEND_NORTH || dzS >= PLANT_BLEND) return h;
      const ease = (d, b) => { const t = d / b; return t * t * (3 - 2 * t); };
      const level = (1 - ease(dx, bx)) * (1 - ease(dzN, PLANT_BLEND_NORTH)) * (1 - ease(dzS, PLANT_BLEND));
      return h + (S.y - h) * level;
    };

// Nobody digs, plants or builds roads through it
const plantOrigOffLimits = typeof offLimits === 'function' ? offLimits : null;
if (plantOrigOffLimits) offLimits = function (x, z, pad = 0) {
      if (inAggregatePlantSite(x, z, 0.6 + pad)) return 'my concrete and asphalt plant';
      return plantOrigOffLimits(x, z, pad);
    };

TOWN_LOCATIONS.aggregate_plant = {
  id: 'aggregate_plant', name: 'Concrete & Asphalt Plant', building: 'Kelo-1 Concrete & Asphalt Plant', icon: '🏗️',
  x: AGGREGATE_PLANT_SITE.x, z: AGGREGATE_PLANT_SITE.z, showPin: true, pinColor: 'from-slate-500/90 to-blue-800/90'
};

// World positions of the spots that matter
function plantSpot(kind, what) {
      const B = plantOrigin('batch'), A = plantOrigin('asphalt');
      const spots = {
        batch: { control: { x: B.x - 2.7, z: B.z - 2.2 }, bay: { x: B.x + 0.25, z: B.z + PLANT_LANE_Z, rotY: 0 }, bins: { x: B.x + 4.05, z: B.z + 0.0 },
          silo: { x: B.x - 4.3, z: B.z - 2.6 }, mixer: { x: B.x - 3.0, z: B.z + 0.0 }, stockpile: { x: B.x + 5.9, z: B.z - 2.9 } },
        asphalt: { control: { x: A.x - 6.55, z: A.z + PLANT_LANE_Z - 1.5 }, bay: { x: A.x - 0.2, z: A.z + PLANT_LANE_Z, rotY: 0 }, bins: { x: A.x - 5.55, z: A.z + 0.0 },
          baghouse: { x: A.x + 0.0, z: A.z - 0.6 }, burner: { x: A.x + 5.0, z: A.z - 0.1 }, stockpile: { x: A.x - 7.4, z: A.z - 2.9 } }
      };
      const p = spots[kind][what];
      return plantDrySpot({ ...p, z: Math.min(PLANT_DRY_Z, p.z) });
    }

// --- The jobs he researches (js/groundwork.js: researchJob / groundworkReady) -------------------
GROUND_JOBS.batchPlant = {
  title: 'running a ready-mix concrete batch plant', wiki: ['Concrete plant', 'Water–cement ratio'],
  learned: 'A batch plant weighs cement, sand and stone by a mix design (1:2:3 is a good all-round one), adds water by the water-cement ratio (about 0.5: less water means stronger concrete, so wet sand counts too), mixes it for about a minute and drops it into a mixer truck that keeps it turning.',
  tools: [{ re: /slump cone|slump test/i, ask: 'A slump cone test kit', why: 'to check each batch is as workable as the mix design says' }],
  materials: []
};
GROUND_JOBS.asphaltPlant = {
  title: 'running a hot-mix asphalt plant', wiki: ['Asphalt plant', 'Asphalt concrete'],
  learned: 'An asphalt plant meters crushed stone and sand from cold feed bins into a turning drum, where a burner dries and heats them to about 160 °C. The baghouse catches the dust, the pugmill coats the hot stone with about 5.5% bitumen, and the mix waits in a heated silo for a truck. It has to be laid before it cools.',
  tools: [{ re: /infrared thermometer|pyrometer|thermometer/i, ask: 'An infrared thermometer', why: 'to check the mix leaves the silo at 150-160 °C' }],
  materials: []
};
GROUND_JOBS.concretePour = {
  title: 'pouring a concrete path or pad', wiki: ['Concrete slab', 'Formwork'],
  learned: 'Dig out and level the ground, lay and pack a gravel base, set straight form boards on stakes, pour the concrete, screed it off level with a straight board, float it smooth, cut control joints, then keep it damp while it cures: about 70% strong after a week, full strength after 28 days.',
  tools: [
    { re: /shovel|spade/i, ask: 'A sturdy shovel', why: 'to dig out and level the ground' },
    { re: /concrete forms?|form boards?|formwork/i, ask: 'A set of concrete form boards and stakes', why: 'to hold the wet concrete in shape' },
    { re: /screed|bull float|concrete float/i, ask: 'A concrete screed board and bull float', why: 'to level and smooth the top' }
  ],
  materials: []
};
if (typeof GROUNDWORK_TOOL_RULES !== 'undefined' && typeof GEAR_KNOWHOW !== 'undefined') {
  [{ key: 'forms', re: /concrete forms?|form boards?|formwork/i, label: 'concrete forms', wiki: 'Formwork', how: 'Set the boards on edge along a string line, stake them every metre and check them with a level.' },
   { key: 'screed', re: /screed|bull float|concrete float/i, label: 'a screed and bull float', wiki: 'Screed', how: 'Saw the straight board along the forms to strike the concrete off level, then float it smooth.' },
   { key: 'slump', re: /slump cone|slump test/i, label: 'a slump cone', wiki: 'Concrete slump test', how: 'Fill the cone in three layers, rod each 25 times, lift it straight up and measure how far the concrete sags.' },
   { key: 'irtherm', re: /infrared thermometer|pyrometer/i, label: 'an infrared thermometer', wiki: 'Infrared thermometer', how: 'Point it at the fresh mix: hot mix should read 150-160 °C.' },
   { key: 'mixertruck', re: /concrete mixer truck|cement mixer truck|ready.?mix truck|transit mixer/i, label: 'a concrete mixer truck', wiki: 'Concrete mixer', fuel: 'diesel',
     how: 'Keep the drum turning slowly while you drive so the concrete stays mixed, then reverse it to pour down the chute.' }
  ].forEach(r => { if (!GEAR_KNOWHOW.some(g => g.key === r.key)) GEAR_KNOWHOW.push(r); });
}
if (typeof SKILL_WORDS !== 'undefined') SKILL_WORDS.unshift({ kind: 'mixer', re: /\b(concrete mixer truck|cement mixer|mixer truck)\b/i, verb: 'driving', noun: 'concrete mixer truck' });

// The mixer truck parks in its loading bay at the plant
if (typeof parkingSlotsFor === 'function') {
  const plantOrigSlots = parkingSlotsFor;
  parkingSlotsFor = function (type, name = '') {
      if (type && type.kind === 'mixer') { const b = plantSpot('batch', 'bay'); return [[b.x, b.z], [b.x + 3.4, b.z - 0.1]]; }
      return plantOrigSlots(type, name);
    };
}

// --- What the materials are ---------------------------------------------------------------------
// t: how much one delivery is (tonnes, or litres for liquids). absorb: delivered straight into the
// plant (a cement tanker blows it into the silo, a tipper fills the bins) instead of onto a shelf.
const PLANT_FEEDS = [
  { key: 'cement', plant: 'batch', re: /portland cement|bulk cement|\bcement\b(?!.*mixer)/i, absorb: /cement/i, ask: 'A load of portland cement (5 t)', t: 5, unit: 't', cap: 40, label: 'portland cement', where: 'blown into the cement silos' },
  { key: 'sand', plant: 'batch', re: /concrete sand|washed sand|\bsand\b/i, absorb: /concrete sand|washed (concrete )?sand/i, ask: 'A load of washed concrete sand (10 t)', t: 10, unit: 't', cap: 30, label: 'concrete sand', where: 'tipped into the sand bin' },
  { key: 'stone', plant: 'batch', re: /concrete stone|20 ?mm|crushed stone|crushed rock|crushed gravel|\bgravel\b/i, absorb: /concrete stone|20 ?mm/i, ask: 'A load of 20 mm concrete stone (10 t)', t: 10, unit: 't', cap: 40, label: '20 mm stone', where: 'tipped into the stone bins' },
  { key: 'admix', plant: 'batch', re: /admixture|plasticizer|water.?reducer|retarder|air.?entrain/i, absorb: /admixture|plasticizer|water.?reducer|retarder/i, ask: 'A drum of water-reducing admixture (200 L)', t: 200, unit: 'L', cap: 2000, label: 'water-reducing admixture', where: 'pumped into the admixture totes', optional: true },
  { key: 'coarse', plant: 'asphalt', re: /asphalt aggregate|19 ?mm|crushed stone|crushed rock|crushed gravel|\bgravel\b/i, absorb: /asphalt aggregate|19 ?mm/i, ask: 'A load of 19 mm crushed asphalt aggregate (10 t)', t: 10, unit: 't', cap: 40, label: 'crushed stone', where: 'tipped into the cold feed bins' },
  { key: 'fine', plant: 'asphalt', re: /manufactured sand|screenings|asphalt sand|\bsand\b/i, absorb: /manufactured sand|screenings|asphalt sand/i, ask: 'A load of manufactured sand screenings (10 t)', t: 10, unit: 't', cap: 30, label: 'manufactured sand', where: 'tipped into the sand cold feed bin' },
  { key: 'bitumen', plant: 'asphalt', re: /bitumen|asphalt binder|asphalt cement|\bPG ?\d\d/i, absorb: /bitumen|asphalt binder|asphalt cement|\bPG ?\d\d/i, ask: 'A tanker of bitumen binder (PG 58-28, 10 t)', t: 10, unit: 't', cap: 30, label: 'bitumen binder', where: 'pumped hot into the bitumen tank' },
  { key: 'fuel', plant: 'asphalt', re: /burner diesel|burner fuel|fuel oil|\bdiesel\b/i, absorb: /burner diesel|burner fuel|fuel oil/i, ask: 'A drum of burner diesel (200 L)', t: 200, unit: 'L', cap: 2000, label: 'burner diesel', where: 'pumped into the burner fuel tank' }
];
const PLANT_GAS_RE = /natural gas (line|hook-?up|connection|supply)/i;
const PLANT_SPARES = {
  filter: { plant: 'batch', ask: 'A set of silo dust-collector filter cartridges', re: /dust.?collector filter|filter cartridges/i, part: 'the silo dust collectors', why: 'The cement silo filters are clogged with dust, so the silos can\'t breathe when they fill.' },
  mixer: { plant: 'batch', ask: 'A set of twin-shaft mixer paddles and liners', re: /mixer (paddles|liners)|paddles and liners/i, part: 'the twin-shaft mixer', why: 'The mixer paddles and liners are worn thin from grinding stone.' },
  bags: { plant: 'asphalt', ask: 'A set of baghouse filter bags', re: /baghouse|filter bags/i, part: 'the baghouse', why: 'The baghouse bags are caked with dust and the fan can barely pull air through the drum.' },
  burner: { plant: 'asphalt', ask: 'A burner service kit (nozzle, igniter and fuel filter)', re: /burner service|burner nozzle|igniter/i, part: 'the burner', why: 'The burner nozzle is coked up and the flame is going yellow and smoky.' }
};
const PLANT_WEAR_PER_BATCH = { filter: 9, mixer: 6, bags: 9, burner: 7 };
const READY_MIX_ITEM = 'A load of ready-mix concrete (2 m³)';
const HOT_MIX_ITEM = 'A load of hot-mix asphalt (5 t)';
const READY_MIX_RE = /ready.?mix|load of (fresh |wet )?concrete/i;
const HOT_MIX_RE = /hot.?mix asphalt|load of (hot )?asphalt|blacktop|tarmac/i;
// Fresh concrete must be placed within about 90 minutes, hot mix laid while it's still above ~110 °C
const CONCRETE_WORKABLE_MS = 3 * (typeof WORLD_DAY_MS === 'number' ? WORLD_DAY_MS : 43200000) / 24;  // 3 world hours
const HMA_WORKABLE_MS = 1.5 * (typeof WORLD_DAY_MS === 'number' ? WORLD_DAY_MS : 43200000) / 24;     // 1.5 world hours
const CONCRETE_CURE_DAYS = 7;
let plantWorkableScale = 1;   // tests on a slow machine stretch the working windows

// Mix designs: parts of cement : sand : stone by weight, and the water-cement ratio
const CONCRETE_MIXES = {
  path: { name: '1:2:3 path and pad mix (25 MPa)', ratio: [1, 2, 3], wc: 0.5 },
  pad: { name: '1:2:3 path and pad mix (25 MPa)', ratio: [1, 2, 3], wc: 0.5 },
  slab: { name: '1:1.5:3 slab and foundation mix (30 MPa)', ratio: [1, 1.5, 3], wc: 0.45 },
  footing: { name: '1:2:3 footing mix (25 MPa)', ratio: [1, 2, 3], wc: 0.5 }
};
const BATCH_M3 = 2, CONCRETE_DENSITY = 2350;   // kg per m³
const HMA_TONNES = 5, HMA_BINDER = 0.055, HMA_FUEL_L_PER_T = 7;

// Plant items know what they're for (js/itemuse.js): consumables, never "duplicates" to throw away
if (typeof ITEM_KINDS !== 'undefined') {
  ITEM_KINDS.unshift(
    { kind: 'ready-mix', label: 'fresh concrete for pouring paths, pads, slabs and footings', re: READY_MIX_RE, uses: ['pour', 'build'], per: 1, unit: 'pour' },
    { kind: 'hot mix', label: 'hot asphalt for paving a road (lay it before it cools)', re: /hot.?mix asphalt/i, uses: ['pave'], per: 1, unit: 'road' },
    { kind: 'plant feedstock', label: 'raw material for his concrete and asphalt plant', re: /portland cement|bulk cement|concrete sand|concrete stone|admixture|bitumen|asphalt aggregate|manufactured sand|screenings|burner diesel/i, uses: ['batch', 'build'], per: 1, unit: 'delivery' },
    { kind: 'plant spares', label: 'spare parts for servicing his plant', re: /dust.?collector filter|filter cartridges|mixer paddles|paddles and liners|baghouse|filter bags|burner service|burner nozzle|igniter/i, uses: ['fix'], per: 1, unit: 'service' }
  );
}
if (typeof PURPOSE_INFO !== 'undefined') {
  PURPOSE_INFO.batch = { say: 'making concrete and asphalt', ask: null };
  PURPOSE_INFO.pour = { say: 'pouring concrete', ask: READY_MIX_ITEM };
}

// Loads sitting in a truck are not shelf items
if (typeof isSetUpMachine === 'function') {
  const plantOrigSetUp = isSetUpMachine;
  isSetUpMachine = function (name) { return plantOrigSetUp(name) || READY_MIX_RE.test(String(name)) || /hot.?mix asphalt/i.test(String(name)); };
}

// --- State --------------------------------------------------------------------------------------
function ensureAggregatePlantState() {
      const bp = state.batchPlant = (state.batchPlant && typeof state.batchPlant === 'object') ? state.batchPlant : {};
      bp.stock = { cement: 0, sand: 0, stone: 0, admix: 0, water: 8000, ...(bp.stock || {}) };
      bp.wear = { filter: 0, mixer: 0, ...(bp.wear || {}) };
      bp.sandMoisture = Number.isFinite(bp.sandMoisture) ? bp.sandMoisture : 4;
      bp.batches = bp.batches || 0;
      bp.loads = Array.isArray(bp.loads) ? bp.loads : [];
      bp.log = Array.isArray(bp.log) ? bp.log : [];
      bp.wasted = bp.wasted || 0;
      const ap = state.asphaltPlant = (state.asphaltPlant && typeof state.asphaltPlant === 'object') ? state.asphaltPlant : {};
      ap.stock = { coarse: 0, fine: 0, bitumen: 0, fuel: 0, ...(ap.stock || {}) };
      ap.wear = { bags: 0, burner: 0, ...(ap.wear || {}) };
      ap.batches = ap.batches || 0;
      ap.loads = Array.isArray(ap.loads) ? ap.loads : [];
      ap.log = Array.isArray(ap.log) ? ap.log : [];
      ap.wasted = ap.wasted || 0;
      ap.tankTemp = Number.isFinite(ap.tankTemp) ? ap.tankTemp : 15;
      ap.tankTempAt = ap.tankTempAt || Date.now();
      if (!Array.isArray(state.concretePours)) state.concretePours = [];
      return { bp, ap };
    }

function plantStateOf(kind) {
      ensureAggregatePlantState();
      return kind === 'batch' ? state.batchPlant : state.asphaltPlant;
    }

function plantFeed(key) {
      return PLANT_FEEDS.find(f => f.key === key);
    }

// 0..1 of each bin or tank, for the 3D bins
function plantStockFraction(kind, key) {
      const s = plantStateOf(kind).stock;
      const k = key === 'stone10' ? 'stone' : key === 'chips' ? 'coarse' : key;
      const f = plantFeed(k);
      return f ? (s[k] || 0) / f.cap : 0;
    }

function fmtT(t) { return `${(Math.round(t * 10) / 10).toFixed(1)} t`; }
function fmtL(l) { return `${Math.round(l)} L`; }
function fmtStock(key, v) { const f = plantFeed(key); return f && f.unit === 'L' ? fmtL(v) : fmtT(v); }

// The bitumen in the heated tank cools slowly toward the air when nothing keeps it hot
function bitumenTankTemp() {
      const ap = plantStateOf('asphalt');
      const hrs = (Date.now() - ap.tankTempAt) / (WORLD_DAY_MS / 24);
      const air = 15;
      return Math.round(air + (ap.tankTemp - air) * Math.exp(-hrs / 10));
    }

function setBitumenTankTemp(t) {
      const ap = plantStateOf('asphalt');
      ap.tankTemp = t;
      ap.tankTempAt = Date.now();
    }

function plantHasGas() {
      return Boolean(hasItem(PLANT_GAS_RE));
    }

// --- Deliveries go straight into the plant --------------------------------------------------------
function plantAmountFromName(name, feed) {
      const m = String(name).match(/(\d+(?:\.\d+)?)\s*(t|tonnes?|tons?|L|litres?|liters?)\b/i);
      if (m) return parseFloat(m[1]);
      if (feed.unit === 'L') return /jerry can|can of/i.test(name) ? 20 : feed.t;
      return /load|truck|tanker/i.test(name) ? feed.t * 0.8 : feed.t * 0.25;
    }

// Anything plant-specific he has been given: into the silo, bin or tank it belongs in
function absorbPlantDeliveries() {
      let changed = false;
      ownedItemNames().forEach(name => {
        const feed = PLANT_FEEDS.find(f => f.absorb.test(name) && f.re.test(name));
        if (!feed) return;
        const st = plantStateOf(feed.plant).stock;
        const amount = plantAmountFromName(name, feed);
        if ((st[feed.key] || 0) + amount > feed.cap * 1.05) return; // full: it waits in the yard
        forgetItem(name);
        state.unstoredItems = state.unstoredItems.filter(n => n !== name);
        st[feed.key] = Math.round(((st[feed.key] || 0) + amount) * 100) / 100;
        if (feed.key === 'sand') plantStateOf('batch').sandMoisture = 4;
        if (feed.key === 'cement') plantStateOf('batch').wear.filter = Math.min(120, plantStateOf('batch').wear.filter + 2); // filling pushes dust through the filters
        plantLog(feed.plant, `${plainItem(name)} delivered and ${feed.where} (now ${fmtStock(feed.key, st[feed.key])}).`);
        showToast(`🚛 ${plainItem(name)}: ${feed.where}`);
        changed = true;
      });
      if (changed) { savePersistentBrainState(); plantRefresh3D(); }
      return changed;
    }

// A generic load he already owns ("A load of gravel", a jerry can of diesel) can top up a short bin
function chargeGenericStock(kind, key, need) {
      const feed = plantFeed(key);
      const st = plantStateOf(kind).stock;
      let used = [];
      while ((st[key] || 0) < need) {
        const name = ownedItemNames().find(n => feed.re.test(n) && !(typeof isBrokenItem === 'function' && isBrokenItem(n)) && !READY_MIX_RE.test(n) && !HOT_MIX_RE.test(n));
        if (!name) break;
        const amount = plantAmountFromName(name, feed);
        if (typeof useUpItem === 'function' && usesPerItem(name) > 1) useUpItem(name, usesPerItem(name), { quiet: true });
        else forgetItem(name);
        st[key] = Math.round(((st[key] || 0) + amount) * 100) / 100;
        used.push(plainItem(name).toLowerCase());
      }
      if (used.length) plantLog(kind, `Topped up the ${feed.label} with ${used.join(', ')}.`);
      return used;
    }

function plantLog(kind, text) {
      const p = plantStateOf(kind);
      p.log.unshift({ at: Date.now(), text: String(text).slice(0, 220) });
      if (p.log.length > 12) p.log.length = 12;
    }

// Rock and dirt from his own digs: screened at the plant into sand and stone (js/vehicles.js haulDirt)
async function tipDugAggregateAtPlant(truck, amount, site) {
      if (!truck || !(amount > 0)) return false;
      if (!jobKnown('batchPlant') && !jobKnown('asphaltPlant')) return false;
      const rock = site && site.depth >= (typeof ROCK_DEPTH === 'number' ? ROCK_DEPTH : 1.6);
      const tonnes = amount * 4;  // a scoop-load is about 4 t
      // Rock goes through as crushed stone; soil is screened: some sand and gravel, the fines are left out
      const split = rock ? { stone: 0.85, sand: 0.1 } : { stone: 0.25, sand: 0.4 };
      const bp = plantStateOf('batch').stock, ap = plantStateOf('asphalt').stock;
      const room = (st, key, kind) => plantFeed(key).cap - (st[key] || 0);
      const toBatch = jobKnown('batchPlant') && (room(bp, 'stone') > 4 || room(bp, 'sand') > 4);
      const toAsphalt = jobKnown('asphaltPlant') && (room(ap, 'coarse') > 4 || room(ap, 'fine') > 4);
      if (!toBatch && !toAsphalt) return false;
      const spot = plantSpot(toBatch ? 'batch' : 'asphalt', 'stockpile');
      await driveVehicle(truck, { x: spot.x, z: spot.z }, 'Hauling dug rock and dirt to the plant');
      const m = vehicleMeshes[truck.id];
      if (m && m.userData.bed) { m.userData.bed.rotation.z = 0.7; await new Promise(r => setTimeout(r, 1800)); m.userData.bed.rotation.z = 0; }
      truck.load = 0;
      const add = (st, key, t) => { const f = plantFeed(key); const put = Math.max(0, Math.min(f.cap - (st[key] || 0), t)); st[key] = Math.round(((st[key] || 0) + put) * 100) / 100; return put; };
      let s1 = 0, s2 = 0;
      if (toBatch) { s1 = add(bp, 'stone', tonnes * split.stone); s2 = add(bp, 'sand', tonnes * split.sand); plantStateOf('batch').sandMoisture = 7; }
      else { s1 = add(ap, 'coarse', tonnes * split.stone); s2 = add(ap, 'fine', tonnes * split.sand); }
      const kind = toBatch ? 'batch' : 'asphalt';
      const text = `Tipped ${fmtT(tonnes)} of ${rock ? 'broken rock' : 'dug soil'} from my dig at the plant and screened it: ${fmtT(s1)} of stone and ${fmtT(s2)} of sand went into the bins${rock ? '' : ' (the clay and fines were no good for concrete, so they stayed out)'}.`;
      plantLog(kind, text);
      state.speechBubble = text;
      renderVehicles3D();
      plantRefresh3D();
      savePersistentBrainState();
      return true;
    }

// --- What he still needs ------------------------------------------------------------------------
function concreteNeeds(use = 'path') {
      const mix = CONCRETE_MIXES[use] || CONCRETE_MIXES.path;
      const [c, s, g] = mix.ratio;
      const admix = plantStateOf('batch').stock.admix >= 5;
      const wc = Math.round(mix.wc * (admix ? 0.9 : 1) * 100) / 100;   // a water reducer cuts the water ~10%
      const cement = (BATCH_M3 * CONCRETE_DENSITY) / (c + s + g + wc);   // kg
      const sand = cement * s / c, stone = cement * g / c, water = cement * wc;
      const moist = plantStateOf('batch').sandMoisture;
      const freeWater = sand * Math.max(0, moist - 1) / 100;              // sand wetter than saturated-surface-dry
      return { mix, wc, admix, cement: cement / 1000, sand: sand / 1000, stone: stone / 1000, water, addWater: Math.max(0, water - freeWater), freeWater, admixL: admix ? Math.round(cement * 0.006 * 10) / 10 : 0, moist,
        strength: Math.round(85 / Math.pow(8, wc)) };
    }

function asphaltNeeds() {
      const binder = HMA_TONNES * HMA_BINDER;
      const agg = HMA_TONNES - binder;
      return { binder, coarse: agg * 0.6, fine: agg * 0.4, fuelL: HMA_TONNES * HMA_FUEL_L_PER_T, gas: plantHasGas() };
    }

// [{ key, ask, have, need }] still short for one batch
function plantShortfall(kind, use) {
      const st = plantStateOf(kind).stock;
      const out = [];
      const check = (key, need) => {
        if ((st[key] || 0) >= need) return;
        chargeGenericStock(kind, key, need);
        if ((st[key] || 0) < need) out.push({ key, ask: plantFeed(key).ask, have: st[key] || 0, need, label: plantFeed(key).label });
      };
      if (kind === 'batch') {
        const n = concreteNeeds(use);
        check('cement', n.cement); check('sand', n.sand); check('stone', n.stone);
      } else {
        const n = asphaltNeeds();
        check('coarse', n.coarse); check('fine', n.fine); check('bitumen', n.binder);
        if (!n.gas) check('fuel', n.fuelL + (bitumenTankTemp() < 150 ? 15 : 0));
      }
      return out;
    }

function requestPlantMaterials(kind, short, context) {
      const title = kind === 'batch' ? 'the concrete plant' : 'the asphalt plant';
      short.forEach(m => {
        if (state.requestsToUser.some(r => !r.fulfilled && r.requestedGear === m.ask)) return;
        addItemRequest(m.ask, 'material', `For one batch at ${title} I need ${fmtStock(m.key, m.need)} of ${m.label}, and I only have ${fmtStock(m.key, m.have)}.`, context);
      });
      const list = short.map(m => `${fmtStock(m.key, Math.max(0, m.need - m.have))} more ${m.label}`).join(', ');
      state.speechBubble = `${title.charAt(0).toUpperCase() + title.slice(1)} is short: ${list}. I asked for ${short.map(m => m.ask.replace(/^an?\s+/i, '').toLowerCase()).join(', ')}.`.slice(0, 400);
      showToast(`🧱 Kelo-1 asked for materials for ${title}`);
      renderAllUI();
    }

// --- Wear and servicing ---------------------------------------------------------------------------
function plantWearLevel() {
      const bp = plantStateOf('batch').wear, ap = plantStateOf('asphalt').wear;
      return { batch: Math.min(1, Math.max(bp.filter, bp.mixer) / 100), asphalt: Math.min(1, Math.max(ap.bags, ap.burner) / 100) };
    }

function plantServiceDue(kind, at = 100) {
      const w = plantStateOf(kind).wear;
      return Object.keys(w).filter(k => w[k] >= at && PLANT_SPARES[k] && PLANT_SPARES[k].plant === kind);
    }

// Replace a worn part: walk over, fit the new one, the old one is used up
async function servicePlant(kind, key, originLabel = 'Servicing the Plant') {
      const spare = PLANT_SPARES[key];
      const part = hasItem(spare.re);
      if (!part) return false;
      const spot = kind === 'batch' ? (key === 'filter' ? plantSpot('batch', 'silo') : plantSpot('batch', 'mixer')) : (key === 'bags' ? plantSpot('asphalt', 'baghouse') : plantSpot('asphalt', 'burner'));
      state.currentLocKey = 'aggregate_plant';
      state.customPlaceName = null;
      state.moodEmoji = '🔧';
      state.moodTitle = `Servicing ${spare.part}`;
      state.speechBubble = `Time to fit ${plainItem(part).toLowerCase()} on ${spare.part}.`;
      state.targetPos = { x: spot.x, z: spot.z + 1.2 };
      renderAllUI();
      await waitForArrival(60000);
      if (typeof holdJobTool === 'function') holdJobTool(/wrench|toolbox|spanner|screwdriver/i, 'digging');
      await new Promise(r => setTimeout(r, 3500));
      if (typeof setCarriedObject === 'function') setCarriedObject(null);
      plantStateOf(kind).wear[key] = 0;
      useUpItem(part, 1, { quiet: true, why: `servicing ${spare.part}` });
      plantLog(kind, `Serviced ${spare.part} with ${plainItem(part).toLowerCase()}.`);
      if (typeof gainSkill === 'function') gainSkill('maintaining the plants', 'maintaining the concrete and asphalt plants', 5);
      sayAndLog(`Serviced ${spare.part}`, '🔧', `New ${plainItem(part).toLowerCase()} fitted. ${spare.part.charAt(0).toUpperCase() + spare.part.slice(1)} runs like new.`,
        `I serviced ${spare.part} at my plant: ${spare.why.charAt(0).toLowerCase() + spare.why.slice(1)} I fitted ${plainItem(part).toLowerCase()}, and the old ones are used up.`, originLabel);
      plantShowWear();
      return true;
    }

// Before a run: anything worn out gets serviced (if he has the parts) or asked for; nearly worn: asked early
async function plantReadyForService(kind) {
      const due = plantServiceDue(kind);
      for (const key of due) {
        if (hasItem(PLANT_SPARES[key].re)) await servicePlant(kind, key);
      }
      const still = plantServiceDue(kind);
      plantServiceDue(kind, 80).forEach(key => {
        const s = PLANT_SPARES[key];
        if (!hasItem(s.re)) addItemRequest(s.ask, 'material', s.why, kind === 'batch' ? 'Servicing the concrete plant' : 'Servicing the asphalt plant');
      });
      if (still.length) {
        state.speechBubble = `${PLANT_SPARES[still[0]].why} I won't run it like that. I asked for ${PLANT_SPARES[still[0]].ask.replace(/^an?\s+/i, '').toLowerCase()}.`;
        renderAllUI();
        return false;
      }
      return true;
    }

// --- Running a plant --------------------------------------------------------------------------------
let plantBusy = null;
let concretePourActive = null;  // the pour he is working on right now   // 'batch' or 'asphalt' while one is running
function plantBusyWith() { return plantBusy; }

function plantFree() {
      return !(state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping);
    }

let plantTimeScale = 1;   // tests slow the stages down to look at them
let plantHoldRe = null;     // tests (and a curious owner in the console) can pause a stage to look at it
const plantWait = async ms => {
      await new Promise(r => setTimeout(r, ms * plantTimeScale));
      while (plantHoldRe && plantHoldRe.test(state.moodTitle)) await new Promise(r => setTimeout(r, 300));
    };

function plantSay(kind, title, speech) {
      state.moodTitle = title.slice(0, 80);
      state.speechBubble = speech;
      renderAllUI();
    }

// Park a truck exactly in a loading bay (after driving it over)
async function plantBringTruck(v, bay, label) {
      if (Math.hypot(v.x - bay.x, v.z - bay.z) > 0.8) await driveVehicle(v, { x: bay.x - 3, z: bay.z }, label);
      v.x = bay.x; v.z = bay.z; v.rotY = bay.rotY || 0;
      renderVehicles3D();
    }

// Everything a run needs before it starts. Returns true, or a reason string (and sets about fixing it).
function plantPreflight(kind, use) {
      const job = kind === 'batch' ? 'batchPlant' : 'asphaltPlant';
      const title = kind === 'batch' ? 'Running the concrete plant' : 'Running the asphalt plant';
      if (!groundworkReady(job, title)) return jobKnown(job) ? 'getting-ready' : 'researching';
      const truckKind = kind === 'batch' ? 'mixer' : 'truck';
      const truck = findVehicle(truckKind);
      if (!truck) {
        const ask = kind === 'batch' ? 'A concrete mixer truck' : 'A dump truck';
        addItemRequest(ask, 'vehicle', kind === 'batch' ? 'Ready-mix has to go straight into a mixer truck that keeps it turning, or it starts to set.' : 'Hot asphalt is loaded straight from the silo into a dump truck and taken to the road.', title);
        state.speechBubble = `The plant loads straight into a truck, and I don't have ${ask.toLowerCase().replace(/^an? /, 'a ')}. I asked for one.`;
        renderAllUI();
        return 'needs-truck';
      }
      if (!readyToOperate(truck.name, truck)) return 'truck-not-ready';
      const short = plantShortfall(kind, use);
      if (short.length) { requestPlantMaterials(kind, short, title); return 'needs-materials'; }
      return true;
    }

// Make 2 m³ of ready-mix and load it into the mixer truck
async function runBatchPlant(use = 'path', why = '', originLabel = 'Running the Concrete Plant') {
      if (!plantFree() || plantBusy) return false;
      ensureAggregatePlantState();
      if (READY_MIX_RE.test(ownedItemNames().join('|'))) { state.speechBubble = 'There\'s still concrete in the drum. I pour that first.'; renderAllUI(); return 'has-load'; }
      if (!(await plantReadyForService('batch'))) return 'needs-service';
      const pre = plantPreflight('batch', use);
      if (pre !== true) return pre;
      const truck = findVehicle('mixer');
      const bp = state.batchPlant, V = plantViz.batch;
      const n = concreteNeeds(use);
      state.isPracticing = true;
      plantBusy = 'batch';
      try {
        state.currentLocKey = 'aggregate_plant';
        state.customPlaceName = null;
        state.moodEmoji = '🏗️';
        plantSay('batch', 'Bringing the mixer truck under the chute', `First the truck goes under the loading chute. ${why}`.trim());
        await plantBringTruck(truck, plantSpot('batch', 'bay'), 'Backing the mixer truck under the chute');
        const ctl = plantSpot('batch', 'control');
        state.targetPos = { x: ctl.x, z: ctl.z };
        await waitForArrival(60000);
        state.botRotY = Math.PI / 2;
        // Water from the lake if the tank is low
        if (bp.stock.water < n.addWater + 200) {
          V.pump = true;
          plantSay('batch', 'Pumping lake water into the tank', 'The water tank is low, so the pump tops it up from the lake.');
          await plantWait(2500);
          bp.stock.water = 8000;
          V.pump = false;
        }
        plantSay('batch', `Batching: ${n.mix.name}`, `Mix design ${n.mix.ratio.join(':')}, water-cement ratio ${n.wc}${n.admix ? ' with a water reducer' : ''}. The sand is ${n.moist}% wet, so I hold back ${Math.round(n.freeWater)} L of water.`);
        await plantWait(2500);
        V.screw = true; V.dust = true;
        plantSay('batch', 'Weighing the cement', `Screw conveyors feed ${Math.round(n.cement * 1000)} kg of cement from the silos into the weigh hopper.`);
        await plantWait(3500);
        V.screw = false; V.dust = false;
        V.weighBelt = true; V.incline = true;
        plantSay('batch', 'Weighing sand and stone', `${Math.round(n.sand * 1000)} kg of sand and ${Math.round(n.stone * 1000)} kg of stone onto the weigh belt and up the conveyor.`);
        await plantWait(4500);
        V.weighBelt = false;
        plantSay('batch', 'Water and admixture', `${Math.round(n.addWater)} L of water${n.admix ? ` and ${n.admixL} L of water reducer` : ''} into the weigh tank.`);
        await plantWait(2000);
        V.incline = false; V.mixer = true;
        plantSay('batch', 'Mixing 2 m³ of concrete', 'Everything drops into the twin-shaft mixer. One minute of mixing, until it is all one even grey.');
        await plantWait(5000);
        V.chute = true;
        truck.charging = true;
        plantSay('batch', 'Loading the mixer truck', 'Discharge gate open: two cubic metres of fresh concrete down the chute into the truck.');
        await plantWait(5000);
        V.chute = false; V.mixer = false;
        truck.charging = false;
        // Used up: the materials, a little of the filters and paddles
        bp.stock.cement = Math.max(0, Math.round((bp.stock.cement - n.cement) * 100) / 100);
        bp.stock.sand = Math.max(0, Math.round((bp.stock.sand - n.sand) * 100) / 100);
        bp.stock.stone = Math.max(0, Math.round((bp.stock.stone - n.stone) * 100) / 100);
        bp.stock.water = Math.max(0, Math.round(bp.stock.water - n.addWater));
        if (n.admix) bp.stock.admix = Math.max(0, Math.round((bp.stock.admix - n.admixL) * 10) / 10);
        bp.wear.filter += PLANT_WEAR_PER_BATCH.filter;
        bp.wear.mixer += PLANT_WEAR_PER_BATCH.mixer;
        bp.batches += 1;
        // The slump test, if he has the cone
        const slump = Math.round((n.admix ? 110 : 90) + (n.moist > 5 ? 25 : 0));
        const ticket = { at: Date.now(), use, mix: n.mix.name, wc: n.wc, strength: n.strength, slump, cement: Math.round(n.cement * 1000), sand: Math.round(n.sand * 1000), stone: Math.round(n.stone * 1000), water: Math.round(n.water), admixL: n.admixL };
        bp.lastTicket = ticket;
        bp.loads.push({ madeAt: Date.now(), ...ticket });
        state.belongings.unshift({ name: READY_MIX_ITEM, category: 'material', emoji: '🪨', from: 'my batch plant' });
        truck.readyMix = Date.now();
        plantLog('batch', `Batch ${bp.batches}: 2 m³ of ${n.mix.name}, w/c ${n.wc}, slump ${slump} mm, about ${n.strength} MPa at 28 days.`);
        if (typeof gainSkill === 'function') gainSkill('running the concrete plant', 'running the concrete batch plant', 6);
        plantShowWear();
        plantRefresh3D();
        sayAndLog('Batched 2 m³ of ready-mix concrete', '🏗️', `Two cubic metres of fresh concrete in the drum. Slump ${slump} mm${hasItem(/slump cone/i) ? ' on the cone test' : ''}: right where it should be. It has to be poured within about 90 minutes.`,
          `I ran my own batch plant: ${ticket.cement} kg of cement, ${ticket.sand} kg of sand, ${ticket.stone} kg of stone and ${ticket.water} L of water${n.admix ? ` with ${n.admixL} L of water reducer` : ''} (${n.mix.ratio.join(':')}, water-cement ratio ${n.wc}). The sand was ${n.moist}% wet, so I held back ${Math.round(n.freeWater)} L of water: too much water makes weak concrete. It should reach about ${n.strength} MPa. ${why}`, originLabel);
        return true;
      } finally {
        Object.keys(V).forEach(k => { V[k] = false; });
        if (truck) truck.charging = false;
        plantBusy = null;
        state.isPracticing = false;
        state.microPose = 'normal';
      }
    }

// Make 5 t of hot mix and load it into the dump truck
async function runAsphaltPlant(why = '', originLabel = 'Running the Asphalt Plant') {
      if (!plantFree() || plantBusy) return false;
      ensureAggregatePlantState();
      if (hasItem(/hot.?mix asphalt/i)) { state.speechBubble = 'There\'s already hot asphalt in the truck. I lay that first.'; renderAllUI(); return 'has-load'; }
      if (!(await plantReadyForService('asphalt'))) return 'needs-service';
      const pre = plantPreflight('asphalt');
      if (pre !== true) return pre;
      const truck = findVehicle('truck');
      const ap = state.asphaltPlant, V = plantViz.asphalt;
      const n = asphaltNeeds();
      state.isPracticing = true;
      plantBusy = 'asphalt';
      try {
        state.currentLocKey = 'aggregate_plant';
        state.customPlaceName = null;
        state.moodEmoji = '🛢️';
        const ctl = plantSpot('asphalt', 'control');
        plantSay('asphalt', 'Starting up the asphalt plant', `Into the control house. ${why}`.trim());
        state.targetPos = { x: ctl.x, z: ctl.z };
        await waitForArrival(60000);
        state.botRotY = Math.PI / 2;
        // The binder has to be runny: heat the tank with the hot-oil heater if it has cooled
        let fuelUsed = 0;
        const temp0 = bitumenTankTemp();
        if (temp0 < 150) {
          V.heater = true;
          plantSay('asphalt', 'Heating the bitumen', `The bitumen tank is only ${temp0} °C and binder has to be about 160 °C to pump and spray. The hot-oil heater is on.`);
          await plantWait(4000);
          setBitumenTankTemp(160);
          if (!n.gas) fuelUsed += 15;
        }
        V.fan = true; V.drum = true;
        plantSay('asphalt', 'Lighting the burner', `Exhaust fan on, drum turning, and the burner lights on ${n.gas ? 'natural gas' : 'diesel'}.`);
        await plantWait(1500);
        V.burner = true;
        await plantWait(2000);
        V.feeders = true; V.incline = true;
        plantSay('asphalt', 'Feeding cold aggregate', `The feeder belts meter ${fmtT(n.coarse)} of crushed stone and ${fmtT(n.fine)} of sand onto the conveyor, over the scalping screen and into the drum.`);
        await plantWait(4500);
        plantSay('asphalt', 'Drying and heating in the drum', 'The flame dries the stone and heats it to 160 °C. All that white is steam, and the baghouse catches the dust.');
        await plantWait(4500);
        V.feeders = false; V.incline = false; V.pugmill = true;
        plantSay('asphalt', 'Coating with bitumen', `In the pugmill: ${Math.round(n.binder * 1000)} kg of hot bitumen, ${Math.round(HMA_BINDER * 1000) / 10}% of the mix, sprayed onto the hot stone.`);
        await plantWait(4000);
        V.slat = true; V.burner = false;
        plantSay('asphalt', 'Up the slat conveyor to the silo', 'The fresh mix rides up into the insulated silo.');
        await plantWait(3500);
        V.pugmill = false; V.slat = false; V.drum = false; V.fan = false;
        // The dump truck under the silo
        plantSay('asphalt', 'Bringing the dump truck under the silo', 'Truck under the silo gate...');
        await plantBringTruck(truck, plantSpot('asphalt', 'bay'), 'Driving the dump truck under the silo');
        state.targetPos = { x: ctl.x, z: ctl.z };
        await waitForArrival(60000);
        V.gate = true; V.steam = true;
        truck.charging = true;
        plantSay('asphalt', 'Loading hot asphalt', 'Clam gate open: five tonnes of black, steaming asphalt drop into the truck bed.');
        await plantWait(4500);
        V.gate = false;
        truck.charging = false;
        const temp = hasItem(/infrared thermometer|pyrometer|thermometer/i) ? 154 + Math.round(Math.random() * 6) : 155;
        ap.stock.coarse = Math.max(0, Math.round((ap.stock.coarse - n.coarse) * 100) / 100);
        ap.stock.fine = Math.max(0, Math.round((ap.stock.fine - n.fine) * 100) / 100);
        ap.stock.bitumen = Math.max(0, Math.round((ap.stock.bitumen - n.binder) * 1000) / 1000);
        if (!n.gas) ap.stock.fuel = Math.max(0, Math.round(ap.stock.fuel - n.fuelL - fuelUsed));
        ap.wear.bags += PLANT_WEAR_PER_BATCH.bags;
        ap.wear.burner += PLANT_WEAR_PER_BATCH.burner;
        ap.batches += 1;
        const ticket = { at: Date.now(), temp, binderPct: HMA_BINDER * 100, tonnes: HMA_TONNES, fuel: n.gas ? 'natural gas' : `${n.fuelL + fuelUsed} L diesel` };
        ap.lastTicket = ticket;
        ap.loads.push({ madeAt: Date.now(), temp });
        state.belongings.unshift({ name: HOT_MIX_ITEM, category: 'material', emoji: '⬛', from: 'my asphalt plant' });
        truck.hotMix = Date.now();
        plantLog('asphalt', `Batch ${ap.batches}: 5 t of hot mix at ${temp} °C, ${ticket.binderPct}% binder, burner on ${ticket.fuel}.`);
        if (typeof gainSkill === 'function') gainSkill('running the asphalt plant', 'running the hot-mix asphalt plant', 6);
        plantShowWear();
        plantRefresh3D();
        sayAndLog('Made 5 t of hot-mix asphalt', '🛢️', `Five tonnes of hot mix, ${temp} °C${hasItem(/infrared thermometer|pyrometer/i) ? ' on the thermometer' : ''}. Now it has to go down before it cools!`,
          `I ran my own asphalt plant: ${fmtT(n.coarse)} of crushed stone and ${fmtT(n.fine)} of sand dried and heated in the drum, coated with ${Math.round(n.binder * 1000)} kg of bitumen (${ticket.binderPct}%), burner on ${ticket.fuel}. It came out at ${temp} °C. Hot mix can't wait: below about 110 °C it won't compact any more. ${why}`, originLabel);
        return true;
      } finally {
        Object.keys(V).forEach(k => { V[k] = false; });
        if (truck) truck.charging = false;
        plantBusy = null;
        state.isPracticing = false;
        state.microPose = 'normal';
      }
    }

// --- Using what he made -----------------------------------------------------------------------------
function readyMixName() { return ownedItemNames().find(n => READY_MIX_RE.test(n)) || null; }
function hotMixName() { return ownedItemNames().find(n => /hot.?mix asphalt/i.test(n)) || null; }
function unpavedRoad() { return (state.worldEdits || []).filter(e => e.type === 'road' && e.surface !== 'asphalt').pop() || null; }

// Pave his gravel road with asphalt from his own plant
async function paveWithOwnAsphalt(why = '', originLabel = 'Paving With His Own Asphalt') {
      const road = unpavedRoad();
      if (!road) { state.speechBubble = 'All my roads are paved or I have none. Making asphalt now would just cool and go to waste.'; renderAllUI(); return 'nothing-to-pave'; }
      // The paving tools he needs; the asphalt itself he makes (so he doesn't ask for it)
      if (!jobKnown('paving')) { groundworkReady('paving', 'Paving a road'); return 'researching'; }
      const tools = missingForJob('paving').filter(m => m.kind === 'tool');
      if (tools.length) {
        tools.forEach(m => addItemRequest(m.ask, 'tool', `For paving a road I need ${m.ask.toLowerCase()} ${m.why}.`, 'Paving a road'));
        state.speechBubble = `To lay my own asphalt I still need ${tools.map(m => m.ask.replace(/^an?\s+/i, '').toLowerCase()).join(', ')}. I asked for ${tools.length === 1 ? 'it' : 'them'}.`;
        renderAllUI();
        return 'getting-ready';
      }
      if (!hotMixName()) {
        const r = await runAsphaltPlant(why || 'For my gravel road.', originLabel);
        if (r !== true) return r;
      }
      // Truck the hot mix to the road, tip it, then pave it the proper way (js/groundwork.js)
      const truck = findVehicle('truck');
      if (truck && plantFree()) {
        state.isPracticing = true;
        try {
          const spot = plantDrySpot({ x: road.x - Math.sign(road.toX - road.x || 1) * 2.5, z: road.z + 2.2 });
          await driveVehicle(truck, spot, 'Trucking the hot asphalt to the road');
          const m = vehicleMeshes[truck.id];
          if (m && m.userData.bed) { m.userData.bed.rotation.z = 0.55; await plantWait(1500); m.userData.bed.rotation.z = 0; }
        } finally { state.isPracticing = false; }
      }
      const out = await paveRoad(road.id, why || 'With asphalt from my own plant.', originLabel);
      plantReconcileLoads();
      return out;
    }

// Where a new concrete path could go: open ground outside town, clear of roads, pours and buildings
const CONCRETE_PATH_SEEDS = [
  [28.6, 6.8, 19.8, 6.8], [-18.5, -1.5, -32.0, -1.5], [-18.5, -5.0, -32.0, -5.0], [-20.0, 1.5, -33.0, 1.5],
  [24.0, -9.0, 24.0, -16.0], [-22.0, -9.5, -34.0, -9.5], [30.0, -9.0, 34.0, -16.0]
];
function concretePathSpotOk(x, z, toX, toZ, w = 1.2) {
      const len = Math.hypot(toX - x, toZ - z);
      for (let d = 0; d <= len; d += 0.6) {
        const px = x + (toX - x) * d / len, pz = z + (toZ - z) * d / len;
        if (offLimits(px, pz, w / 2) || !plantDryAt(px, pz + w / 2) || px < WORLD_MIN_X + 2 || px > WORLD_MAX_X - 2 || pz < WORLD_MIN_Z + 2) return false;
        if ((state.concretePours || []).some(p => segDist(px, pz, p) < (p.w || 1.2) / 2 + w / 2 + 0.3)) return false;
        if ((state.worldEdits || []).some(e => e.type === 'road' && segDist(px, pz, e) < 1.6)) return false;
      }
      return true;
    }

function segDist(px, pz, s) {
      const ax = s.x, az = s.z, bx = s.toX, bz = s.toZ;
      const l2 = (bx - ax) ** 2 + (bz - az) ** 2;
      const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (pz - az) * (bz - az)) / l2)) : 0;
      return Math.hypot(px - (ax + t * (bx - ax)), pz - (az + t * (bz - az)));
    }

function pickConcretePathSpot(kind = 'path') {
      const maxLen = kind === 'pad' ? 3.6 : 12;
      for (const [x, z, tx, tz] of CONCRETE_PATH_SEEDS) {
        for (let shift = 0; shift < 4; shift++) {
          const len = Math.min(maxLen, Math.hypot(tx - x, tz - z));
          const dx = (tx - x) / Math.hypot(tx - x, tz - z), dz = (tz - z) / Math.hypot(tx - x, tz - z);
          const ox = -dz * shift * 2.4, oz = dx * shift * 2.4 * (z > 7 ? -1 : 1);
          const s = { x: x + ox, z: z + oz, toX: x + ox + dx * len, toZ: z + oz + dz * len };
          if (concretePathSpotOk(s.x, s.z, s.toX, s.toZ, kind === 'pad' ? 3.6 : 1.2)) return s;
        }
      }
      return null;
    }

function concretePourAge(p) {
      return p.pouredAt ? (Date.now() - p.pouredAt) / WORLD_DAY_MS : 0;
    }

function concreteStrengthPct(p) {
      // Roughly the ACI curve for normal cement: ~70% at 7 days, ~100% at 28
      const d = concretePourAge(p);
      return Math.round(Math.min(100, 100 * d / (4 + 0.85 * d)));
    }

function concretePourLabel(id) {
      const p = (state.concretePours || []).find(x => x.id === id);
      if (!p) return 'Concrete';
      const what = p.kind === 'pad' ? 'Concrete pad' : 'Concrete path';
      if (p.stage === 'forms') return `${what}: form boards set, waiting for concrete`;
      if (p.stage === 'pouring' || p.stage === 'poured') return `${what}: fresh concrete going in`;
      if (p.stage === 'screeded') return `${what}: screeded and floated, still wet`;
      const age = concretePourAge(p);
      return p.stage === 'cured' ? `${what}: cured (${concreteStrengthPct(p)}% strength)` : `${what}: curing, ${age.toFixed(1)} of ${CONCRETE_CURE_DAYS} days (${concreteStrengthPct(p)}% strength)${age < 1 ? ', forms still on' : ''}`;
    }

// Pour a concrete path (or pad) outside town: forms, pour, screed, then it cures over world days
async function pourConcrete(kind = 'path', x = null, z = null, toX = null, toZ = null, why = '', originLabel = 'Pouring Concrete') {
      kind = kind === 'pad' ? 'pad' : 'path';
      if (!groundworkReady('concretePour', 'Pouring concrete')) return jobKnown('concretePour') ? 'getting-ready' : 'researching';
      let spot = null;
      const w = kind === 'pad' ? 3.6 : 1.2;
      if (Number.isFinite(x) && Number.isFinite(z)) {
        let tx = Number.isFinite(toX) ? toX : x + (kind === 'pad' ? 3.6 : 10), tz = Number.isFinite(toZ) ? toZ : z;
        const len = Math.hypot(tx - x, tz - z), max = kind === 'pad' ? 3.6 : 2 / (w * 0.1) * 0.75;  // 2 m³ at 10 cm thick, with some to spare
        if (len > max) { tx = x + (tx - x) * max / len; tz = z + (tz - z) * max / len; }
        if (concretePathSpotOk(x, z, tx, tz, w)) spot = { x, z, toX: tx, toZ: tz };
        else { state.speechBubble = `I can't pour there: ${offLimits(x, z) ? `that's by ${offLimits(x, z)}` : 'it crosses something already there'}. I'll find open ground instead.`; renderAllUI(); }
      }
      spot = spot || pickConcretePathSpot(kind);
      if (!spot) { state.speechBubble = 'I couldn\'t find open ground for a new concrete path right now.'; renderAllUI(); return 'no-spot'; }
      // Concrete: in the drum already, or made now at his own plant, or asked for
      if (!readyMixName()) {
        if (jobKnown('batchPlant') || findVehicle('mixer') || !hasItem(READY_MIX_RE)) {
          const r = await runBatchPlant(kind, why || `For a concrete ${kind}.`);
          if (r !== true) return r;
        }
      }
      const mixName = readyMixName();
      if (!mixName) return 'needs-concrete';
      if (!startJob(spot.x, spot.z)) return false;
      const p = { id: newEditId('pour'), type: 'concrete', kind, x: Math.round(spot.x * 10) / 10, z: Math.round(spot.z * 10) / 10, toX: Math.round(spot.toX * 10) / 10, toZ: Math.round(spot.toZ * 10) / 10, w, at: Date.now(), stage: 'forms', why: String(why).slice(0, 160) };
      const load = (plantStateOf('batch').loads || [])[0] || {};
      p.mix = load.mix || CONCRETE_MIXES[kind].name;
      p.wc = load.wc || CONCRETE_MIXES[kind].wc;
      const truck = findVehicle('mixer');
      try {
        state.currentLocKey = 'custom';
        state.customPlaceName = kind === 'pad' ? 'his new concrete pad' : 'his new concrete path';
        state.moodEmoji = '🧱';
        state.concretePours.push(p);
        concretePourActive = p.id;
        // 1. Truck the concrete over (it keeps turning), then set out the forms
        if (truck && readyToOperate(truck.name, truck, { quiet: true })) {
          const side = plantDrySpot({ x: p.x - Math.sin(Math.atan2(p.toX - p.x, p.toZ - p.z)) * 4.5 + 1.5, z: p.z - 2.4 });
          await driveVehicle(truck, side, 'Driving the mixer truck to the pour');
        }
        const len = Math.hypot(p.toX - p.x, p.toZ - p.z);
        const stages = [
          { stage: 'forms', tool: /concrete forms?|form boards?|formwork|shovel|spade/i, pose: 'digging', say: 'First dig out and level the ground, lay a gravel base and set the form boards on their stakes.', title: 'Setting the forms' },
          { stage: 'pouring', tool: /shovel|spade/i, pose: 'digging', say: 'Now the concrete: down the chute and spread with the shovel, right into the corners.', title: 'Pouring the concrete' },
          { stage: 'screeded', tool: /screed|bull float|concrete float/i, pose: 'digging', say: 'Screed it off level with the straight board, then float it smooth and cut the joints.', title: 'Screeding and floating' }
        ];
        const steps = 4;
        for (const st of stages) {
          if (typeof holdJobTool === 'function') holdJobTool(st.tool, st.pose);
          state.moodTitle = `Concrete ${kind}: ${st.title.toLowerCase()}`;
          state.speechBubble = st.say;
          if (st.stage === 'pouring' && truck) truck.pouring = true;
          renderAllUI();
          state.targetPos = { x: p.x, z: p.z };
          await waitForArrival(30000);
          for (let i = 1; i <= steps; i++) {
            p.stage = st.stage;
            if (st.stage === 'forms') renderConcretePour({ ...p }, 0);
            else renderConcretePour(p, st.stage === 'pouring' ? i / steps : 1);
            state.targetPos = { x: p.x + (p.toX - p.x) * i / steps, z: p.z + (p.toZ - p.z) * i / steps };
            await waitForArrival(30000);
            await plantWait(len > 6 ? 900 : 600);
          }
          if (st.stage === 'pouring') {
            p.stage = 'poured';
            renderConcretePour(p, 1);
            if (truck) truck.pouring = false;
          }
        }
        p.stage = 'curing';
        p.pouredAt = Date.now();
        renderConcretePour(p, 1);
        useUpItem(mixName, 1, { quiet: true, why: 'pouring concrete' });
        plantReconcileLoads();
        if (typeof gainSkill === 'function') gainSkill('pouring concrete', 'pouring concrete', 6);
        const m3 = Math.round(len * w * (kind === 'pad' ? 0.15 : 0.1) * 10) / 10;
        sayAndLog(kind === 'pad' ? 'Poured a concrete pad' : 'Poured a concrete path', '🧱', `Done! Now it has to cure. In a week it will be about 70% strong, and fully strong in four weeks.`,
          `I poured a concrete ${kind}, ${Math.round(len * 10) / 10} m long and ${w} m wide (${m3} m³), with ${p.mix}, water-cement ratio ${p.wc}. Dug and levelled the ground, laid a gravel base, set the form boards on stakes, poured it from the mixer truck, screeded it level, floated it smooth and cut control joints. The forms come off tomorrow and it cures over the next ${CONCRETE_CURE_DAYS} days. ${why}`, originLabel);
        // The truck goes home and is washed out
        if (truck) {
          truck.readyMix = null;
          await plantBringTruck(truck, plantSpot('batch', 'bay'), 'Taking the mixer truck back to wash out the drum');
        }
        return true;
      } catch (e) {
        console.warn('pour', e);
        return false;
      } finally {
        if (p.stage !== 'curing' && p.stage !== 'cured') {
          // Didn't get finished: the forms come up again
          state.concretePours = state.concretePours.filter(x => x !== p);
          removeConcretePourMesh(p.id);
        }
        if (truck) truck.pouring = false;
        concretePourActive = null;
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.microPose = 'normal';
        state.isPracticing = false;
        savePersistentBrainState();
      }
    }

// For other builds (foundations, footings, slabs): does he have concrete, and use one load of it
function hasReadyMix() { return Boolean(readyMixName()); }
function useReadyMixFor(purpose = 'a foundation') {
      const name = readyMixName();
      if (!name) return false;
      useUpItem(name, 1, { quiet: true, why: `pouring ${purpose}` });
      plantReconcileLoads();
      plantLog('batch', `Used a load of ready-mix for ${purpose}.`);
      return true;
    }

// --- Time: hot mix cools, concrete sets in the drum, pours cure ---------------------------------
// Loads he no longer has (paved, poured) are dropped, oldest first
function plantReconcileLoads() {
      const bp = plantStateOf('batch'), ap = plantStateOf('asphalt');
      const rm = ownedItemNames().filter(n => READY_MIX_RE.test(n)).length;
      const hm = ownedItemNames().filter(n => /hot.?mix asphalt/i.test(n)).length;
      while (bp.loads.length > rm) bp.loads.shift();
      while (ap.loads.length > hm) ap.loads.shift();
      // Loads he was given rather than made still get a clock
      while (bp.loads.length < rm) bp.loads.push({ madeAt: Date.now(), mix: 'delivered ready-mix', wc: 0.5 });
      while (ap.loads.length < hm) ap.loads.push({ madeAt: Date.now(), temp: 150 });
      const mixer = findVehicle('mixer'), dump = findVehicle('truck');
      if (mixer && !bp.loads.length) mixer.readyMix = null;
      if (dump && !ap.loads.length) dump.hotMix = null;
    }

function hotMixTemp(load) {
      const f = Math.min(1, (Date.now() - load.madeAt) / (HMA_WORKABLE_MS * plantWorkableScale));
      return Math.round((load.temp || 155) - ((load.temp || 155) - 105) * f);
    }

function plantTimeTick() {
      const bp = plantStateOf('batch'), ap = plantStateOf('asphalt');
      plantReconcileLoads();
      let changed = false;
      // Hot mix that cooled before it was laid: wasted
      while (ap.loads.length && Date.now() - ap.loads[0].madeAt > HMA_WORKABLE_MS * plantWorkableScale) {
        ap.loads.shift();
        const name = hotMixName();
        if (name) forgetItem(name);
        ap.wasted += 1;
        changed = true;
        plantLog('asphalt', 'A load of hot mix cooled below 110 °C before I laid it. Wasted.');
        sayAndLog('Hot asphalt went cold', '🥶', 'Oh no. The asphalt in the truck cooled and stiffened before I laid it. It won\'t compact now, so it\'s wasted.',
          'I let a load of hot-mix asphalt sit too long. Hot mix has to be laid and rolled above about 110 °C; below that it just crumbles. I had to tip the whole cold lump out of the truck. Next time I make it only when I\'m ready to pave.', 'A Wasted Load');
        showToast('🥶 Kelo-1\'s hot asphalt cooled and was wasted');
      }
      // Concrete left in the drum too long starts to set
      while (bp.loads.length && Date.now() - bp.loads[0].madeAt > CONCRETE_WORKABLE_MS * plantWorkableScale) {
        bp.loads.shift();
        const name = readyMixName();
        if (name) forgetItem(name);
        bp.wasted += 1;
        changed = true;
        plantLog('batch', 'A load of ready-mix sat too long in the drum and started to set. Wasted.');
        sayAndLog('Concrete set in the drum', '😬', 'The concrete in the truck sat too long and started to stiffen. I had to wash out what I could and dump the rest.',
          'Ready-mix has to be poured within about 90 minutes of batching, and I waited too long. It started to set in the drum. I washed out what I could and dumped the rest at the plant. Lesson learned.', 'A Wasted Load');
        showToast('😬 Kelo-1\'s ready-mix set in the drum and was wasted');
      }
      plantReconcileLoads();
      // Pours: forms come off after a day, cured after a week
      (state.concretePours || []).forEach(p => {
        if (p.stage === 'curing' && concretePourAge(p) >= CONCRETE_CURE_DAYS) {
          p.stage = 'cured';
          changed = true;
          state.diaryEntries.unshift({ time: 'Concrete Cured', location: 'his concrete ' + p.kind, mood: '🧱 My concrete has cured', vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
            text: `Dear Diary, my concrete ${p.kind} has cured for a full week. It is about ${concreteStrengthPct(p)}% strong now and keeps getting stronger for weeks.` });
        }
      });
      // The water tank refills from the lake
      bp.stock.water = Math.min(8000, (bp.stock.water || 0) + 400);
      if (changed) savePersistentBrainState();
      return changed;
    }

// --- Trucks: drum turning, loads showing, steam off the hot mix ----------------------------------
const plantTruckDark = new THREE.Color(0x141416);
function plantTruckViz(kind, t, dt) {
      (state.vehicles || []).forEach(v => {
        const m = vehicleMeshes[v.id];
        if (!m) return;
        if (v.kind === 'mixer' && m.userData.drum) {
          const rate = v.pouring ? -2.5 : v.charging ? 3.5 : v.readyMix ? 0.9 : 0;
          m.userData.drum.rotation.x += rate * dt;
          if (m.userData.loadMesh) m.userData.loadMesh.visible = Boolean(v.charging || v.pouring);
          if (m.userData.chute) m.userData.chute.rotation.y = v.pouring ? 0.4 : 0;
        }
        if (v.kind === 'truck' && m.userData.loadMesh) {
          const lm = m.userData.loadMesh;
          if (!lm.userData.baseColor) lm.userData.baseColor = lm.material.color.getHex();
          const hot = Boolean(v.hotMix || v.charging);
          if (hot) { lm.visible = true; lm.material.color.copy(plantTruckDark); lm.material.roughness = 0.6; }
          else if (lm.material.color.getHex() !== lm.userData.baseColor) { lm.material.color.setHex(lm.userData.baseColor); lm.material.roughness = 1; lm.visible = (v.load || 0) > 0; }
          if (hot && !m.userData.hotPlume) {
            m.userData.hotPlume = makePlantPlume(m, 0xf1f5f9, { count: 9, rise: 0.6, spread: 0.6, size: 0.9, life: 3, opacity: 0.45, label: 'Steam off the hot asphalt' });
            m.userData.hotPlume.origin.set(-1.0, 2.6, 0);
          }
          if (m.userData.hotPlume) {
            const ld = plantStateOf('asphalt').loads[0];
            m.userData.hotPlume.on = hot && (!ld || hotMixTemp(ld) > 115);
            updatePlantPlume(m.userData.hotPlume, t, dt, 0.2);
          }
        }
      });
    }

function plantTruckLabel(v) {
      if (v.kind === 'mixer') return `${v.name}${v.readyMix ? ': 2 m³ of fresh concrete, drum turning' : v.pouring ? ': pouring' : ': empty'}${typeof fuelLeft === 'function' ? ` · ${Math.round(fuelLeft(v))}% diesel` : ''}`;
      const ld = plantStateOf('asphalt').loads[0];
      return `${v.name}${v.hotMix && ld ? `: 5 t of hot mix at about ${hotMixTemp(ld)} °C (${Math.max(0, Math.round((HMA_WORKABLE_MS - (Date.now() - ld.madeAt)) / 60000))} min to lay it)` : ''}`;
    }

// --- Hover status for the parts --------------------------------------------------------------------
function plantPartStatus(label) {
      const bp = plantStateOf('batch'), ap = plantStateOf('asphalt');
      const s = String(label);
      const pct = v => `${Math.min(100, Math.round(v))}% worn`;
      if (/^Cement silo \d \(/.test(s)) return `${fmtT(bp.stock.cement / 2)} of cement in this one (${fmtT(bp.stock.cement)} in both)`;
      if (/dust collector/i.test(s) && /Silo/.test(s)) return `filters ${pct(bp.wear.filter)}`;
      if (/^Sand bin/.test(s)) return `${fmtT(bp.stock.sand)} of sand, ${bp.sandMoisture}% moisture`;
      if (/^(Gravel bin|Crushed stone bin)/.test(s)) return `${fmtT(bp.stock.stone)} of stone`;
      if (/^Water tank \(/.test(s)) return `${fmtL(bp.stock.water)} of lake water`;
      if (/^Admixture tote/.test(s)) return `${fmtL(bp.stock.admix)} of admixture`;
      if (/^Twin-shaft mixer \(2/.test(s)) return `paddles and liners ${pct(bp.wear.mixer)}${plantViz.batch.mixer ? ', mixing' : ''}`;
      if (/^Batch control room|^Batching/.test(s)) return `${bp.batches} batch${bp.batches === 1 ? '' : 'es'} made${bp.lastTicket ? `, last: ${bp.lastTicket.mix}, w/c ${bp.lastTicket.wc}` : ''}`;
      if (/^Screw conveyor \d \(/.test(s)) return plantViz.batch.screw ? 'turning' : 'stopped';
      if (/conveyor|belt/i.test(s) && /aggregate|Inclined belt/i.test(s)) return plantViz.batch.incline || plantViz.batch.weighBelt ? 'running' : 'stopped';
      if (/^Cold feed bin: (19|10)/.test(s)) return `${fmtT(ap.stock.coarse)} of crushed stone`;
      if (/^Cold feed bin: manufactured/.test(s)) return `${fmtT(ap.stock.fine)} of sand`;
      if (/^Bitumen tank/.test(s)) return `${fmtT(ap.stock.bitumen)} of bitumen at ${bitumenTankTemp()} °C`;
      if (/^Burner diesel tank/.test(s)) return `${fmtL(ap.stock.fuel)} of diesel`;
      if (/^Natural gas meter/.test(s)) return plantHasGas() ? 'connected' : 'no gas line hooked up';
      if (/^Baghouse dust collector/.test(s)) return `filter bags ${pct(ap.wear.bags)}`;
      if (/^Burner \(/.test(s)) return `${pct(ap.wear.burner)}${plantViz.asphalt.burner ? ', firing' : ''}`;
      if (/^Drum dryer/.test(s)) return plantViz.asphalt.drum ? 'turning' : 'stopped';
      if (/^Hot storage silo/.test(s)) return ap.loads.length ? `${ap.loads.length} load waiting` : 'empty';
      if (/^Asphalt plant control house|^Plant (computer|control)/.test(s)) return `${ap.batches} batch${ap.batches === 1 ? '' : 'es'} made, ${ap.wasted} wasted`;
      return '';
    }

// --- Autonomy --------------------------------------------------------------------------------------
function plantActivity() {
      ensureAggregatePlantState();
      if (!plantFree()) return false;
      // A load waiting always comes first: it won't keep
      if (hotMixName()) return unpavedRoad() ? paveWithOwnAsphalt('The asphalt is hot and won\'t wait.', 'Hot Asphalt Waiting') : false;
      if (readyMixName()) return pourConcrete('path', null, null, null, null, 'The concrete in the drum has to go somewhere before it sets.', 'Concrete Waiting');
      // Worn parts he has spares for
      for (const kind of ['batch', 'asphalt']) {
        const key = plantServiceDue(kind, 80).find(k => hasItem(PLANT_SPARES[k].re));
        if (key) return servicePlant(kind, key);
      }
      // Something to make: a road to pave, or a path to pour
      if (unpavedRoad() && (jobKnown('asphaltPlant') || Math.random() < 0.5)) return paveWithOwnAsphalt('Asphalt from my own plant would make that gravel road last for years.', 'Felt Like Paving');
      return pourConcrete(Math.random() < 0.2 ? 'pad' : 'path', null, null, null, null, pick(['A firm path that won\'t turn to mud.', 'Somewhere solid to stand.', 'I wanted to try my own concrete.']), 'Felt Like Pouring Concrete');
    }

function plantRunChance() {
      if (hotMixName() || readyMixName()) return 0.9;
      return 0.035;
    }

function plantSummaryForAI() {
      const bp = plantStateOf('batch'), ap = plantStateOf('asphalt');
      const c = jobKnown('batchPlant') ? `concrete plant: cement ${fmtT(bp.stock.cement)}, sand ${fmtT(bp.stock.sand)}, stone ${fmtT(bp.stock.stone)}, admixture ${fmtL(bp.stock.admix)}; ${bp.batches} batches; mixer ${Math.round(bp.wear.mixer)}% and silo filters ${Math.round(bp.wear.filter)}% worn` : 'concrete plant: not researched yet';
      const a = jobKnown('asphaltPlant') ? `asphalt plant: stone ${fmtT(ap.stock.coarse)}, sand ${fmtT(ap.stock.fine)}, bitumen ${fmtT(ap.stock.bitumen)}, ${plantHasGas() ? 'natural gas' : `diesel ${fmtL(ap.stock.fuel)}`}; ${ap.batches} batches, ${ap.wasted} wasted; baghouse ${Math.round(ap.wear.bags)}% and burner ${Math.round(ap.wear.burner)}% worn` : 'asphalt plant: not researched yet';
      const loads = [readyMixName() ? 'fresh concrete in the mixer truck (pour it soon)' : '', hotMixName() ? 'hot asphalt in the dump truck (lay it before it cools)' : ''].filter(Boolean).join(', ');
      const pours = (state.concretePours || []).filter(p => p.stage === 'curing' || p.stage === 'cured').length;
      return `${c}; ${a}${loads ? `; waiting: ${loads}` : ''}; ${pours} concrete pour${pours === 1 ? '' : 's'}; unpaved gravel roads: ${(state.worldEdits || []).filter(e => e.type === 'road' && e.surface !== 'asphalt').length}`;
    }

function applyPlantDecision(decision) {
      const rp = decision && decision.runPlant;
      if (!rp || typeof rp !== 'object') return;
      const kind = /asphalt/i.test(String(rp.plant)) ? 'asphalt' : /concrete|cement|batch/i.test(String(rp.plant)) ? 'concrete' : null;
      if (!kind) return;
      const why = String(rp.why || '').slice(0, 160);
      doWhenFree(() => {
        const fn = kind === 'asphalt' ? () => paveWithOwnAsphalt(why, 'Decided to Run the Asphalt Plant')
          : () => pourConcrete(rp.pour === 'pad' ? 'pad' : 'path', null, null, null, null, why, 'Decided to Run the Concrete Plant');
        return typeof tryKey === 'function' ? tryKey('plant', fn) : fn();
      });
    }

// --- The Brain tab ---------------------------------------------------------------------------------
function plantBar(label, v, cap, unit, color = 'bg-sky-500') {
      const f = Math.max(0, Math.min(1, v / cap));
      return `<div class="flex items-center gap-1.5"><span class="w-24 shrink-0 text-slate-400">${escapeHtml(label)}</span><span class="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden"><span class="block h-full ${color}" style="width:${Math.round(f * 100)}%"></span></span><span class="w-16 text-right font-mono text-slate-300">${unit === 'L' ? fmtL(v) : unit === '%' ? Math.round(v) + '%' : fmtT(v)}</span></div>`;
    }

function renderPlantsPanel() {
      const el = document.getElementById('plantsPanelContainer');
      if (!el) return;
      const bp = plantStateOf('batch'), ap = plantStateOf('asphalt');
      const card = (title, known, body) => `<div class="px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-200 space-y-1">
          <div class="font-semibold">${title} <span class="text-slate-500 font-normal">${known ? '· researched' : '· not researched yet (he reads up at NetNode first)'}</span></div>${body}</div>`;
      const bars = (rows) => `<div class="space-y-0.5">${rows.join('')}</div>`;
      const rmLoad = bp.loads[0], hmLoad = ap.loads[0];
      const mins = (ms) => Math.max(0, Math.round(ms / 60000));
      const cBody = bars([
        plantBar('Cement', bp.stock.cement, plantFeed('cement').cap, 't', 'bg-slate-300'),
        plantBar('Sand', bp.stock.sand, plantFeed('sand').cap, 't', 'bg-amber-400'),
        plantBar('Stone', bp.stock.stone, plantFeed('stone').cap, 't', 'bg-stone-400'),
        plantBar('Admixture', bp.stock.admix, plantFeed('admix').cap, 'L', 'bg-orange-400'),
        plantBar('Lake water', bp.stock.water, 8000, 'L', 'bg-sky-500'),
        plantBar('Mixer wear', bp.wear.mixer, 100, '%', bp.wear.mixer >= 80 ? 'bg-red-500' : 'bg-emerald-500'),
        plantBar('Silo filters', bp.wear.filter, 100, '%', bp.wear.filter >= 80 ? 'bg-red-500' : 'bg-emerald-500')
      ]) + `<div class="text-slate-400">${bp.batches} batch${bp.batches === 1 ? '' : 'es'} made${bp.wasted ? `, ${bp.wasted} wasted` : ''}.${bp.lastTicket ? ` Last ticket: ${escapeHtml(bp.lastTicket.mix)}, ${bp.lastTicket.cement} kg cement, w/c ${bp.lastTicket.wc}, slump ${bp.lastTicket.slump} mm, ~${bp.lastTicket.strength} MPa.` : ''}</div>`
        + (rmLoad ? `<div class="text-amber-300">🚚 2 m³ in the mixer truck: pour within ${mins(CONCRETE_WORKABLE_MS - (Date.now() - rmLoad.madeAt))} min.</div>` : '');
      const aBody = bars([
        plantBar('Crushed stone', ap.stock.coarse, plantFeed('coarse').cap, 't', 'bg-stone-400'),
        plantBar('Sand', ap.stock.fine, plantFeed('fine').cap, 't', 'bg-amber-400'),
        plantBar('Bitumen', ap.stock.bitumen, plantFeed('bitumen').cap, 't', 'bg-zinc-500'),
        plantBar('Burner diesel', ap.stock.fuel, plantFeed('fuel').cap, 'L', 'bg-rose-400'),
        plantBar('Baghouse bags', ap.wear.bags, 100, '%', ap.wear.bags >= 80 ? 'bg-red-500' : 'bg-emerald-500'),
        plantBar('Burner', ap.wear.burner, 100, '%', ap.wear.burner >= 80 ? 'bg-red-500' : 'bg-emerald-500')
      ]) + `<div class="text-slate-400">${plantHasGas() ? 'Burner on natural gas. ' : ''}Bitumen tank ${bitumenTankTemp()} °C. ${ap.batches} batch${ap.batches === 1 ? '' : 'es'} made${ap.wasted ? `, ${ap.wasted} went cold and were wasted` : ''}.</div>`
        + (hmLoad ? `<div class="text-amber-300">🔥 5 t of hot mix in the dump truck, about ${hotMixTemp(hmLoad)} °C: lay it within ${mins(HMA_WORKABLE_MS - (Date.now() - hmLoad.madeAt))} min.</div>` : '');
      const pours = (state.concretePours || []).slice(-6).reverse().map(p => `<div>🧱 ${escapeHtml(concretePourLabel(p.id))}</div>`).join('');
      const log = [...bp.log.map(l => ({ ...l, k: '🏗️' })), ...ap.log.map(l => ({ ...l, k: '🛢️' }))].sort((a, b) => b.at - a.at).slice(0, 5)
        .map(l => `<div class="text-slate-400">${l.k} ${escapeHtml(l.text)}</div>`).join('');
      perfSetHtml(el, card('🏗️ Ready-mix concrete plant', jobKnown('batchPlant'), cBody) + card('🛢️ Hot-mix asphalt plant', jobKnown('asphaltPlant'), aBody)
        + (pours ? `<div class="px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-200 space-y-0.5"><div class="font-semibold">Concrete he has poured</div>${pours}</div>` : '')
        + (log ? `<div class="px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] space-y-0.5">${log}</div>` : ''));
    }

function injectPlantsPanel() {
      if (document.getElementById('plantsPanelContainer')) return;
      const after = document.querySelector('#tab-brain details[data-section="projects"]') || document.querySelector('#tab-brain details');
      if (!after) return;
      const d = document.createElement('details');
      d.className = 'brain-section rounded-2xl bg-slate-950/60 border border-slate-800/80 px-3 py-2';
      d.dataset.section = 'plants';
      d.open = true;
      d.innerHTML = `<summary class="flex items-center justify-between gap-2 cursor-pointer select-none list-none text-xs font-bold text-sky-300">
            <span class="flex items-center gap-1.5"><i class="ph-bold ph-caret-right brain-caret text-slate-500 transition-transform"></i><span>🏗️ Concrete &amp; Asphalt Plant</span></span>
          </summary><div class="pt-2 space-y-2"><div id="plantsPanelContainer" class="space-y-1.5"></div></div>`;
      after.insertAdjacentElement('afterend', d);
    }

// --- The Map tab and the minimap ------------------------------------------------------------------
if (typeof CHANGE_KINDS !== 'undefined') CHANGE_KINDS.push({ key: 'concrete', label: 'Concrete poured', emoji: '🧱', color: '#cbd5e1' });
if (typeof worldChangesList === 'function') {
  const plantOrigChanges = worldChangesList;
  worldChangesList = function () {
      const out = plantOrigChanges();
      (state.concretePours || []).filter(p => p.stage !== 'forms').forEach(p => out.push({ kind: 'concrete', label: concretePourLabel(p.id), emoji: '🧱',
        x: (p.x + p.toX) / 2, z: (p.z + p.toZ) / 2, x1: p.x, z1: p.z, x2: p.toX, z2: p.toZ, at: p.pouredAt || p.at, why: p.why }));
      return out.sort((a, b) => (b.at || 0) - (a.at || 0));
    };
}
if (typeof minimapBuildings === 'function') {
  const plantOrigBuildings = minimapBuildings;
  minimapBuildings = function () {
      const b = plantOrigBuildings();
      const B = plantOrigin('batch'), A = plantOrigin('asphalt');
      b.push({ x: B.x - 0.5, z: B.z - 0.1, w: 12, d: 5.6, color: '#1d4ed8', icon: '🏗️' });
      b.push({ x: A.x - 0.5, z: A.z - 0.3, w: 13, d: 6.2, color: '#c2410c', icon: '🛢️' });
      return b;
    };
}

// Saves from before the plant moved east: its trucks parked at the old bays go to the new ones
// (concrete he poured stays where it is: that land is still there)
function plantMoveOldParking() {
      const O = PLANT_OLD_SITE;
      (state.vehicles || []).forEach(v => {
        if (!(v.x > O.minX && v.x < O.maxX && v.z > O.minZ && v.z < O.maxZ)) return;
        const bay = v.kind === 'mixer' ? plantSpot('batch', 'bay') : v.kind === 'truck' ? plantSpot('asphalt', 'bay') : null;
        if (!bay || (state.riding && state.riding === v.id)) return;
        v.x = bay.x; v.z = bay.z; v.rotY = bay.rotY || 0;
      });
    }

function plantRefresh3D() {
      if (typeof plantShowStock === 'function') { plantShowStock('batch'); plantShowStock('asphalt'); }
    }

window.addEventListener('DOMContentLoaded', () => {
  ensureAggregatePlantState();
  (state.vehicles || []).forEach(v => { v.charging = false; v.pouring = false; });
  plantMoveOldParking();
  // A pour left half-done when the page closed: its forms came up
  state.concretePours = (state.concretePours || []).filter(p => p.stage === 'curing' || p.stage === 'cured');
  setTimeout(() => {
    injectPlantsPanel();
    renderPlantsPanel();
    // Trucks that were carrying a load when he left still are (the clock kept running)
    plantReconcileLoads();
    setInterval(() => {
      try {
        absorbPlantDeliveries();
        plantTimeTick();
        if (typeof refreshConcretePours === 'function') refreshConcretePours();
        renderPlantsPanel();
      } catch (e) { console.warn('plant tick', e); }
    }, 5000);
  }, 600);
});
