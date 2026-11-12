// Kelo-bot-1 — js/roadworks.js
// Loaded after plantmodels.js. Building a real road (and, later, the runway) the way a road crew does:
//   research at NetNode -> one parts list to his human for the machines, tools and materials (js/bom.js
//   style list card in the Post tab: send all, send some, copy) -> survey and stake out -> clear and grub
//   (bulldozer) -> rough grade (motor grader) -> drainage (excavator, a culvert, concrete headwalls from
//   his own batch plant) -> compact the subgrade (single-drum vibratory roller) -> aggregate base (bulk
//   gravel delivered to his stockpile, hauled out in his dump truck, spread by the grader) -> compact the
//   base -> prime coat (asphalt distributor) -> pave (hot mix from his own plant, hauled in the dump
//   truck, laid by the asphalt paver) -> finish rolling (tandem roller) -> curing -> line marking (line
//   striper, traffic paint and glass beads).
// Every road is one task on his agenda (js/agenda.js): it keeps its step through interruptions and
// reloads, waits on deliveries, plant output, fuel and the weather, and resumes. Materials are a real
// ledger (state.roadworks.stock) that each step uses up; the machines are vehicles with fuel and
// know-how (js/knowhow.js), parked by the plant.
// The runway job (bottom of this file) uses the same machinery on RUNWAY_FIELD (another branch adds it);
// it does nothing until that exists.

const RW_UNITS_PER_M = 1.6;                  // world units a metre (js/agent.js town scale)
const RW_LANE_UNITS = 5.6;                   // a 3.5 m lane
const RW_MAX_UNITS = 36;                     // one road task is at most about 22 m
const RW_BASE_DEPTH_M = 0.15, RW_BASE_T_PER_M3 = 2.2, RW_BASE_LOAD_T = 15;
const RW_HMA_DEPTH_M = 0.05, RW_HMA_T_PER_M3 = 2.4;
const RW_PRIME_L_PER_M2 = 0.9;
const RW_PAINT_L_PER_M = 0.04;               // a 100 mm line at about 0.4 mm wet film
const RW_CURE_MS = 2 * (typeof WORLD_DAY_MS === 'number' ? WORLD_DAY_MS : 43200000) / 24;   // 2 world hours
let rwTimeScale = 1;                         // tests shorten the waits

// --- The machines and tools (requestable, each with its own know-how) -------------------------------------
// kind 'vehicle' is driven (js/vehicles.js VEHICLE_TYPES below), 'tool' is pushed or carried.
const RW_GEAR = {
  survey: { ask: 'A survey kit: total station, tripod and prism pole', re: /total station|survey(ing)? kit/i, kind: 'tool', wiki: 'Total station',
    how: 'Set the tripod over a known point, level it, sight the prism on the pole and read off distance and angle; stake each offset.', skill: ['surveying', 'surveying and staking out'] },
  dozer: { ask: 'A crawler bulldozer with a six-way blade', re: /bull ?dozer|crawler dozer/i, kind: 'vehicle', wiki: 'Bulldozer', fuel: 'diesel',
    how: 'Lower the blade to just below the topsoil, walk it forward in low gear, and push the spoil off to the side in overlapping passes.', skill: ['bulldozer', 'driving the bulldozer'] },
  grader: { ask: 'A motor grader with a 14 ft moldboard', re: /motor grader|road grader/i, kind: 'vehicle', wiki: 'Grader', fuel: 'diesel',
    how: 'Angle the moldboard, set the cutting edge to the grade stakes, and make long slow passes, crowning the road so water runs off.', skill: ['grader', 'driving the motor grader'] },
  soilroller: { ask: 'A single-drum vibratory soil compactor', re: /single.?drum|soil compactor|vibratory soil/i, kind: 'vehicle', wiki: 'Road roller', fuel: 'diesel',
    how: 'Vibration on, overlap each pass by a third of the drum, and keep rolling until it stops leaving a mark.', skill: ['soilroller', 'driving the soil compactor'] },
  tandemroller: { ask: 'A tandem vibratory asphalt roller', re: /tandem (vibratory )?(asphalt )?roller/i, kind: 'vehicle', wiki: 'Road roller', fuel: 'diesel',
    how: 'Roll hot asphalt right behind the paver, drive wheel first, water on the drums so nothing sticks; finish with static passes.', skill: ['tandemroller', 'driving the tandem roller'] },
  paver: { ask: 'A tracked asphalt paver with a heated screed', re: /asphalt paver|paving machine|road paver/i, kind: 'vehicle', wiki: 'Paver (vehicle)', fuel: 'diesel',
    how: 'Tip the hot mix into the hopper, keep the augers full, and crawl at a steady speed so the heated screed lays an even mat.', skill: ['paver', 'running the asphalt paver'] },
  distributor: { ask: 'An asphalt distributor (emulsion sprayer cart)', re: /asphalt distributor|emulsion sprayer|tack (coat )?sprayer/i, kind: 'tool', wiki: 'Prime coat',
    how: 'Heat the emulsion, open the spray bar at a walking pace, and lay an even film; let it break to black before paving.', skill: ['distributor', 'spraying prime and tack coat'] },
  striper: { ask: 'A walk-behind line striper (airless)', re: /line striper|striping machine|line marking machine/i, kind: 'tool', wiki: 'Road surface marking',
    how: 'Snap a string line, set the gun to a 100 mm line, walk at a steady pace and drop glass beads into the wet paint.', skill: ['striper', 'line marking'] },
  truck: { ask: 'A dump truck', re: /dump ?truck/i, kind: 'vehicle', existing: true },
  excavator: { ask: 'An excavator', re: /excavator|digger|backhoe/i, kind: 'vehicle', existing: true }
};
// What each step of the job takes (gear keys; truck and excavator are the ones he may already have)
const RW_STEP_GEAR = { survey: ['survey'], clear: ['dozer'], grade: ['grader'], drain: ['excavator'], subgrade: ['soilroller'], base: ['truck', 'grader'],
  compactbase: ['soilroller'], prime: ['distributor'], pave: ['truck', 'paver'], roll: ['tandemroller'], cure: [], stripe: ['striper'], lights: ['truck'] };

// --- The materials: a ledger in state.roadworks.stock, used up as he works ---------------------------
// per: how much one delivered unit holds. need(job) is worked out from the road's real size.
const RW_SUPPLIES = {
  stakes: { label: 'grade stakes', ask: 'A bundle of 100 wooden grade stakes and lath', re: /grade stakes|stakes and lath/i, unit: 'stakes', per: 100,
    need: j => Math.ceil(j.lenM / 7.5 + 1) * 2 + 2 },
  markpaint: { label: 'marking paint', ask: 'A case of 12 cans of inverted marking paint', re: /marking paint/i, unit: 'cans', per: 12, need: j => Math.max(2, Math.ceil(j.lenM / 15)) },
  culvert: { label: 'culvert pipe', ask: 'A corrugated HDPE culvert pipe, 450 mm × 6 m', re: /culvert/i, unit: 'pipes', per: 1, need: j => (j.runway ? Math.ceil(j.lenM / 400) : 1) },
  base: { label: 'crushed aggregate base', ask: 'A dump-truck load of crushed aggregate base course, 3/4 in. minus (15 t)', re: /crushed (aggregate )?base|road base|base course/i, unit: 't', per: RW_BASE_LOAD_T,
    need: j => Math.ceil(j.areaM2 * RW_BASE_DEPTH_M * RW_BASE_T_PER_M3) },
  prime: { label: 'asphalt prime emulsion', ask: 'A 205 L drum of asphalt prime emulsion (MS-2 / SS-1h)', re: /prime emulsion|asphalt emulsion|tack coat emulsion/i, unit: 'L', per: 205,
    need: j => Math.ceil(j.areaM2 * RW_PRIME_L_PER_M2) },
  paintyellow: { label: 'yellow traffic paint', ask: 'A 5 gal pail of yellow traffic paint', re: /yellow traffic paint/i, unit: 'L', per: 19, need: j => (j.runway ? 0 : Math.ceil(j.lenM * RW_PAINT_L_PER_M * 0.5 + 1)) },
  paintwhite: { label: 'white traffic paint', ask: 'A 5 gal pail of white traffic paint', re: /white traffic paint/i, unit: 'L', per: 19, need: j => (j.runway ? Math.ceil(j.areaM2 * 0.012) : 0) },
  rwycoarse: { label: 'runway-mix coarse aggregate', ask: 'A 30 t load of runway-mix coarse aggregate', re: /runway-mix coarse/i, unit: 't', per: 30, need: j => (j.runway ? Math.ceil(rwHma(j) * (1 - RW_BINDER) * 0.6) : 0) },
  rwyfine: { label: 'runway-mix fine aggregate', ask: 'A 30 t load of runway-mix fine aggregate (crusher dust)', re: /runway-mix fine/i, unit: 't', per: 30, need: j => (j.runway ? Math.ceil(rwHma(j) * (1 - RW_BINDER) * 0.4) : 0) },
  rwybinder: { label: 'polymer-modified runway binder', ask: 'A 30 t tanker of polymer-modified runway binder', re: /polymer-modified runway binder/i, unit: 't', per: 30, need: j => (j.runway ? Math.ceil(rwHma(j) * RW_BINDER) : 0) },
  edgelight: { label: 'runway edge lights', ask: 'An elevated LED runway edge light (white)', re: /runway edge light/i, unit: 'lights', per: 1, need: j => (j.runway ? 2 * (Math.ceil(j.lenM / 60) + 1) : 0) },
  thrlight: { label: 'threshold and end lights', ask: 'A runway threshold and end light (green / red)', re: /threshold and end light/i, unit: 'lights', per: 1, need: j => (j.runway ? 16 : 0) },
  rwysign: { label: 'runway signs', ask: 'A lighted runway designation sign', re: /runway designation sign/i, unit: 'signs', per: 1, need: j => (j.runway ? 2 : 0) },
  windsock: { label: 'windsock', ask: 'A lit windsock on an 18 ft mast', re: /windsock/i, unit: '', per: 1, need: j => (j.runway ? 1 : 0) },
  beads: { label: 'glass beads', ask: 'A 50 lb bag of reflective glass beads', re: /glass beads/i, unit: 'kg', per: 22.7, need: j => Math.ceil((j.runway ? j.areaM2 * 0.002 : j.lenM * 0.025) + 1) }
};
const RW_STEP_SUPPLY = { survey: ['stakes', 'markpaint'], drain: ['culvert'], base: ['base'], prime: ['prime'], pave: ['rwycoarse', 'rwyfine', 'rwybinder'], stripe: ['paintyellow', 'paintwhite', 'beads'], lights: ['edgelight', 'thrlight', 'rwysign', 'windsock'] };
const RW_BINDER = 0.055;
function rwHma(j) { return j.areaM2 * RW_HMA_DEPTH_M * 2 * RW_HMA_T_PER_M3; }   // a runway: two 50 mm lifts

function rwState() {
      if (!state.roadworks || typeof state.roadworks !== 'object' || Array.isArray(state.roadworks)) state.roadworks = {};
      const r = state.roadworks;
      if (!r.stock || typeof r.stock !== 'object') r.stock = {};
      if (!r.used || typeof r.used !== 'object') r.used = {};
      return r;
    }
function rwStock(key) { return Number(rwState().stock[key]) || 0; }
function rwUse(key, amount) {
      const r = rwState();
      const take = Math.min(rwStock(key), amount);
      r.stock[key] = Math.round((rwStock(key) - take) * 100) / 100;
      r.used[key] = Math.round(((Number(r.used[key]) || 0) + take) * 100) / 100;
      return take;
    }
function rwFmt(key, v) { const s = RW_SUPPLIES[key]; const n = Math.round(v * 10) / 10; return `${n.toLocaleString()} ${s ? s.unit : ''}`.trim(); }
function rwPlain(s) { return String(s || '').replace(/^(an?|some|the)\s+/i, '').toLowerCase(); }

// A supply that arrived as an ordinary item (a gift, a single request) goes into the ledger
function rwAbsorbSupplies() {
      let got = false;
      Object.entries(RW_SUPPLIES).forEach(([key, s]) => {
        const lists = [state.belongings, state.toolInventory];
        lists.forEach(list => {
          if (!Array.isArray(list)) return;
          for (let i = list.length - 1; i >= 0; i--) {
            const n = typeof list[i] === 'string' ? list[i] : list[i] && list[i].name;
            if (!n || !s.re.test(n)) continue;
            list.splice(i, 1);
            state.unstoredItems = (state.unstoredItems || []).filter(u => u !== n);
            rwState().stock[key] = rwStock(key) + s.per;
            got = true;
          }
        });
      });
      return got;
    }

// --- Machines are vehicles: types, know-how, fuel, skills, parking ------------------------------------
if (typeof VEHICLE_TYPES !== 'undefined') {
  VEHICLE_TYPES.unshift(
    { kind: 'dozer', re: RW_GEAR.dozer.re, mode: 'land', speed: 0.8, scale: 1, seatY: 1.2 },
    { kind: 'grader', re: RW_GEAR.grader.re, mode: 'land', speed: 1.2, scale: 1, seatY: 1.6 },
    { kind: 'soilroller', re: RW_GEAR.soilroller.re, mode: 'land', speed: 0.9, scale: 1, seatY: 1.3 },
    { kind: 'tandemroller', re: RW_GEAR.tandemroller.re, mode: 'land', speed: 0.9, scale: 1, seatY: 1.3 },
    { kind: 'paver', re: RW_GEAR.paver.re, mode: 'land', speed: 0.6, scale: 1, seatY: 1.5 }
  );
}
if (typeof GEAR_KNOWHOW !== 'undefined') {
  Object.entries(RW_GEAR).forEach(([key, g]) => {
    if (g.existing || GEAR_KNOWHOW.some(r => r.key === 'rw-' + key)) return;
    const label = { survey: 'a survey kit', dozer: 'a bulldozer', grader: 'a motor grader', soilroller: 'a soil compactor', tandemroller: 'a tandem roller', paver: 'an asphalt paver', distributor: 'an asphalt distributor', striper: 'a line striper' }[key];
    GEAR_KNOWHOW.unshift({ key: 'rw-' + key, re: g.re, label, wiki: g.wiki, how: g.how, ...(g.fuel ? { fuel: g.fuel } : {}) });
  });
}
if (typeof SKILL_WORDS !== 'undefined') {
  SKILL_WORDS.unshift(
    { kind: 'grader', re: /\bmotor grader|road grader\b/i, verb: 'driving', noun: 'motor grader' },
    { kind: 'dozer', re: /\bbull ?dozer\b/i, verb: 'driving', noun: 'bulldozer' },
    { kind: 'paver', re: /\basphalt paver\b/i, verb: 'running', noun: 'asphalt paver' }
  );
}
// Road machines park in a row on the plant's gravel yard, by the asphalt plant, so they're near the work
const RW_PARK_KINDS = new Set(['dozer', 'grader', 'soilroller', 'tandemroller', 'paver']);
function rwParkingSlots() {
      if (typeof AGGREGATE_PLANT_SITE === 'undefined') return null;
      const S = AGGREGATE_PLANT_SITE, west = S.x - S.w / 2;
      // The yard strip along the plant's west side (PLANT_YARD_W wide), vehicles nose to tail along z
      const x = west + (typeof PLANT_YARD_W === 'number' ? PLANT_YARD_W : 4) / 2;
      return [-5.5, -1.5, 2.5, 6.5, 10.0].map(dz => [x, Math.min(typeof PLANT_DRY_Z === 'number' ? PLANT_DRY_Z - 1 : 11, S.z + dz)]);
    }
if (typeof parkingSlotsFor === 'function') {
  const rwOrigSlots = parkingSlotsFor;
  parkingSlotsFor = function (type, name = '') {
      if (type && RW_PARK_KINDS.has(type.kind)) { const s = rwParkingSlots(); if (s) return s; }
      return rwOrigSlots(type, name);
    };
}

// --- The research (GROUND_JOBS, js/groundwork.js: researchJob does the NetNode visit) -----------------
if (typeof GROUND_JOBS !== 'undefined') {
  GROUND_JOBS.roadworks = {
    title: 'building a proper paved road', wiki: ['Road construction', 'Grader', 'Road roller', 'Paver (vehicle)', 'Road surface marking'],
    learned: 'A real road is surveyed and staked first, then cleared and grubbed with a dozer, rough-graded with a motor grader and given ditches and a culvert so water drains away. The subgrade is compacted with a vibratory roller, then about 150 mm of crushed aggregate base is trucked in, spread with the grader and compacted. A prime coat seals the base, hot-mix asphalt is laid with a paver and rolled with a tandem roller while it is hot, left to cool and cure, and finally the lines are painted with a striper and glass beads.',
    tools: [], materials: []
  };
  GROUND_JOBS.runway = {
    title: 'building a paved runway', wiki: ['Runway', 'Runway edge lights', 'Windsock', 'Airport pavement'],
    learned: 'A runway is built like a heavy-duty road, only wider, flatter and thicker: the strip is surveyed, cleared, graded to a gentle cross-fall with drainage along the sides, compacted, given a deep crushed base and paved in lanes. Then it gets aviation markings in white (threshold "piano keys", the runway numbers from its magnetic heading, a dashed centre line, aiming points and edge lines), white edge lights along both sides, green and red threshold lights at each end, signs, and a windsock pilots can see.',
    tools: [], materials: []
  };
}

// --- Models (world units at real size next to Kelo-1, +x forward, then shrunk with miniature()) -------
const RW_YELLOW = 0xf2b705, RW_DARK = 0x1f2937, RW_STEEL = 0x6b7280;
function rwCab(b, x, y, z, w, h, d, roofColor = RW_YELLOW) {
      // A ROPS cab: glass box on a painted floor, four posts, a roof with work lights
      b.add(at(glass(new THREE.BoxGeometry(w, h, d)), x, y + h / 2, z));
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => b.add(at(mesh(new THREE.BoxGeometry(0.1, h, 0.1), RW_DARK), x + sx * (w / 2 - 0.05), y + h / 2, z + sz * (d / 2 - 0.05))));
      b.add(at(mesh(new THREE.BoxGeometry(w + 0.2, 0.14, d + 0.2), roofColor), x, y + h + 0.07, z));
      [-0.3, 0.3].forEach(dz => b.add(at(mesh(new THREE.BoxGeometry(0.1, 0.12, 0.18), 0xfffbeb, { emissive: 0xfef3c7, emissiveIntensity: 0.5 }), x + w / 2 + 0.06, y + h - 0.05, z + dz * d)));
      b.add(at(mesh(new THREE.BoxGeometry(0.16, 0.12, 0.16), 0xf59e0b, { emissive: 0xf59e0b, emissiveIntensity: 0.6 }), x, y + h + 0.2, z));   // the beacon
      // The seat and controls inside
      b.add(at(mesh(new THREE.BoxGeometry(0.6, 0.18, 0.6), RW_DARK), x - 0.1, y + 0.3, z));
      b.add(at(mesh(new THREE.BoxGeometry(0.14, 0.75, 0.6), RW_DARK), x - 0.42, y + 0.7, z));
      [-0.32, 0.32].forEach(dz => b.add(rod([x + 0.25, y + 0.3, z + dz], [x + 0.4, y + 0.85, z + dz], 0.025, 0x111827)));
    }
function rwTrack(b, x, z, len, h, w) {
      // A crawler track: the shoe belt round two idlers, with rollers and grousers
      const belt = mesh(new THREE.BoxGeometry(len, h, w), 0x26282c, { roughness: 0.95 });
      b.add(at(belt, x, h / 2, z));
      [-1, 1].forEach(s => { const idler = mesh(new THREE.CylinderGeometry(h / 2, h / 2, w + 0.02, 16), 0x3f3f46, { metalness: 0.5 }); idler.rotation.x = Math.PI / 2; b.add(at(idler, x + s * (len / 2), h / 2, z)); });
      for (let i = 0; i < Math.floor(len / 0.32); i++) b.add(at(mesh(new THREE.BoxGeometry(0.08, 0.06, w + 0.04), 0x18181b), x - len / 2 + 0.16 + i * 0.32, 0.03, z));
      for (let i = 0; i < 5; i++) { const r = mesh(new THREE.CylinderGeometry(0.12, 0.12, w * 0.6, 10), RW_STEEL, { metalness: 0.6 }); r.rotation.x = Math.PI / 2; b.add(at(r, x - len * 0.35 + i * len * 0.175, h * 0.32, z + Math.sign(z) * 0.05)); }
    }
function rwDrum(radius, width, color = 0x9ca3af) {
      const g = group();
      const shell = mesh(new THREE.CylinderGeometry(radius, radius, width, 28), color, { metalness: 0.75, roughness: 0.35 });
      shell.rotation.x = Math.PI / 2;
      g.add(shell);
      [-1, 1].forEach(s => { const cap = mesh(new THREE.CylinderGeometry(radius * 0.5, radius * 0.5, 0.06, 16), RW_DARK); cap.rotation.x = Math.PI / 2; cap.position.z = s * width / 2; g.add(cap); });
      g.userData.wheelRadius = radius;   // rolls with the ground (js/vehicles.js)
      return g;
    }
function rwExhaust(b, x, y, z, h = 1.0) {
      b.add(at(mesh(new THREE.CylinderGeometry(0.07, 0.08, h, 10), 0x52525b, { metalness: 0.8 }), x, y + h / 2, z));
      b.add(at(mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.12, 10), 0x27272a), x, y + h + 0.04, z));
    }

function rwDozerModel() {
      const b = group();
      [-1.15, 1.15].forEach(z => rwTrack(b, -0.2, z, 4.0, 0.9, 0.62));
      b.add(at(mesh(new THREE.BoxGeometry(3.6, 0.5, 1.7), RW_DARK), -0.2, 1.0, 0));                 // the main frame
      b.add(at(mesh(new THREE.BoxGeometry(2.0, 1.15, 1.9), RW_YELLOW), 0.85, 1.7, 0));             // the engine hood
      for (let i = 0; i < 6; i++) b.add(at(mesh(new THREE.BoxGeometry(0.06, 0.6, 1.5), 0x3f3f46), 1.88, 1.6, -0.6 + i * 0.24));   // grille bars
      b.add(at(mesh(new THREE.BoxGeometry(1.3, 0.5, 2.4), RW_YELLOW), -1.2, 1.4, 0));             // the fenders and deck
      rwCab(b, -1.2, 1.65, 0, 1.4, 1.5, 1.5);
      rwExhaust(b, 1.3, 2.25, 0.55, 0.9);
      // The six-way blade on push arms, with lift and tilt cylinders
      const blade = at(group(), 2.75, 0.75, 0);
      const plate = mesh(new THREE.CylinderGeometry(0.75, 0.75, 3.5, 16, 1, true, Math.PI * 0.75, Math.PI * 0.5), RW_YELLOW, { side: THREE.DoubleSide, metalness: 0.3 });
      plate.rotation.x = Math.PI / 2;
      blade.add(at(plate, -0.5, 0.1, 0));
      blade.add(at(mesh(new THREE.BoxGeometry(0.14, 0.12, 3.5), 0x52525b, { metalness: 0.8 }), 0.04, -0.6, 0));   // the cutting edge
      [-1.65, 1.65].forEach(z => blade.add(at(mesh(new THREE.BoxGeometry(0.4, 1.3, 0.08), RW_YELLOW), -0.2, 0.05, z)));
      b.add(blade);
      [-1.0, 1.0].forEach(z => {
        b.add(rod([-0.4, 0.55, z * 1.15], [2.45, 0.45, z * 1.2], 0.09, RW_YELLOW));
        b.add(rod([1.6, 1.85, z * 0.8], [2.45, 1.05, z * 0.9], 0.06, 0xd4d4d8, { metalness: 0.9 }));
      });
      // A ripper at the back
      b.add(at(mesh(new THREE.BoxGeometry(0.3, 0.3, 1.6), RW_YELLOW), -2.6, 1.0, 0));
      b.add(at(mesh(new THREE.BoxGeometry(0.16, 0.9, 0.14), 0x3f3f46, { metalness: 0.6 }), -2.75, 0.55, 0));
      return miniature(b, { seat: { x: -1.3, y: 1.95 - KELO_SIT_OFFSET, z: 0 }, blade });
    }

function rwGraderModel() {
      const b = group();
      // Tandem rear wheels, a long arched frame forward to the steered front axle
      [-2.4, -3.6].forEach(x => [-1.15, 1.15].forEach(z => b.add(at(wheel(0.62, 0.5), x, 0.62, z))));
      [-1.05, 1.05].forEach(z => b.add(at(wheel(0.58, 0.42), 3.9, 0.58, z)));
      b.add(at(mesh(new THREE.BoxGeometry(2.6, 1.1, 1.6), RW_YELLOW), -3.0, 1.5, 0));             // engine
      for (let i = 0; i < 5; i++) b.add(at(mesh(new THREE.BoxGeometry(0.05, 0.7, 1.3), 0x3f3f46), -4.32, 1.45, -0.5 + i * 0.25));
      b.add(at(mesh(new THREE.BoxGeometry(1.6, 0.45, 2.3), RW_YELLOW), -1.2, 1.25, 0));
      rwCab(b, -1.2, 1.5, 0, 1.4, 1.6, 1.7);
      rwExhaust(b, -2.6, 2.05, 0.45, 0.9);
      const arch = slab([[-0.6, 1.1], [0.4, 1.9], [3.0, 2.0], [4.1, 1.2], [4.1, 0.85], [3.0, 1.6], [0.4, 1.55], [-0.6, 0.8]], 0.5, RW_YELLOW);
      b.add(arch);
      b.add(at(mesh(new THREE.BoxGeometry(0.5, 0.3, 2.0), RW_YELLOW), 3.9, 1.05, 0));             // front axle beam
      // The circle and the moldboard under the frame, angled across the road
      const circle = mesh(new THREE.TorusGeometry(0.8, 0.07, 8, 24), RW_DARK, { metalness: 0.6 });
      circle.rotation.x = Math.PI / 2;
      b.add(at(circle, 1.2, 1.05, 0));
      const board = at(group(), 1.2, 0.45, 0);
      const mold = mesh(new THREE.CylinderGeometry(0.42, 0.42, 4.2, 16, 1, true, Math.PI * 0.8, Math.PI * 0.45), RW_YELLOW, { side: THREE.DoubleSide, metalness: 0.3 });
      mold.rotation.x = Math.PI / 2;
      board.add(mold);
      board.add(at(mesh(new THREE.BoxGeometry(0.1, 0.08, 4.2), 0x52525b, { metalness: 0.8 }), 0.25, -0.36, 0));
      board.rotation.y = 0.45;
      b.add(board);
      [-0.6, 0.6].forEach(z => b.add(rod([2.4, 1.9, z], [1.4, 0.75, z * 1.4], 0.05, 0xd4d4d8, { metalness: 0.9 })));   // lift cylinders
      return miniature(b, { seat: { x: -1.3, y: 1.8 - KELO_SIT_OFFSET, z: 0 }, blade: board });
    }

function rwRollerModel(tandem = false) {
      const b = group();
      if (tandem) {
        [2.0, -2.0].forEach(x => {
          const yoke = mesh(new THREE.BoxGeometry(1.4, 0.9, 2.1), RW_YELLOW);
          b.add(at(yoke, x, 1.1, 0));
          b.add(at(rwDrum(0.62, 1.8), x, 0.62, 0));
          b.add(at(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 6), 0x60a5fa), x + (x > 0 ? 0.68 : -0.68), 1.2, 0));   // the water spray bar
        });
        b.add(at(mesh(new THREE.BoxGeometry(2.6, 1.0, 1.8), RW_YELLOW), 0, 1.45, 0));
        b.add(at(mesh(new THREE.BoxGeometry(1.0, 0.5, 1.6), 0x60a5fa, { roughness: 0.4 }), -0.5, 2.15, 0));   // water tank
        rwCab(b, 0.4, 1.95, 0, 1.3, 1.45, 1.5);
        rwExhaust(b, -1.0, 1.95, 0.6, 0.8);
        return miniature(b, { seat: { x: 0.3, y: 2.25 - KELO_SIT_OFFSET, z: 0 } });
      }
      // Single smooth drum at the front in its yoke, articulated to the tyred engine unit
      b.add(at(rwDrum(0.78, 2.1), 2.3, 0.78, 0));
      b.add(at(mesh(new THREE.BoxGeometry(1.2, 0.35, 2.4), RW_YELLOW), 2.3, 1.65, 0));
      [-1.2, 1.2].forEach(z => b.add(at(mesh(new THREE.BoxGeometry(1.2, 1.1, 0.12), RW_YELLOW), 2.3, 1.05, z)));
      b.add(at(mesh(new THREE.BoxGeometry(0.6, 0.5, 0.8), RW_DARK), 1.4, 1.1, 0));                  // articulation joint
      [-1.0, 1.0].forEach(z => b.add(at(wheel(0.7, 0.6), -1.3, 0.7, z)));
      b.add(at(mesh(new THREE.BoxGeometry(2.4, 1.1, 1.7), RW_YELLOW), -1.3, 1.65, 0));
      rwCab(b, -0.1, 1.5, 0, 1.25, 1.5, 1.5);
      rwExhaust(b, -2.1, 2.2, 0.5, 0.8);
      return miniature(b, { seat: { x: -0.2, y: 1.8 - KELO_SIT_OFFSET, z: 0 } });
    }

function rwPaverModel() {
      const b = group();
      [-1.1, 1.1].forEach(z => rwTrack(b, 0.2, z, 3.4, 0.7, 0.5));
      // The hopper at the front with its wings, the tractor body, the operator platform and canopy
      const hopper = at(group(), 2.2, 1.0, 0);
      hopper.add(at(mesh(new THREE.BoxGeometry(1.4, 0.15, 2.6), RW_DARK), 0, 0, 0));
      [-1, 1].forEach(s => { const wing = mesh(new THREE.BoxGeometry(1.4, 0.8, 0.08), RW_YELLOW); wing.rotation.x = s * 0.45; hopper.add(at(wing, 0, 0.35, s * 1.38)); });
      hopper.add(at(mesh(new THREE.BoxGeometry(0.08, 0.6, 2.6), RW_YELLOW), 0.7, 0.3, 0));
      b.add(hopper);
      b.add(at(mesh(new THREE.BoxGeometry(2.2, 1.1, 2.2), RW_YELLOW), 0.1, 1.35, 0));
      b.add(at(mesh(new THREE.BoxGeometry(1.4, 0.2, 2.6), RW_DARK), -0.95, 1.95, 0));                // the operator platform
      [-1, 1].forEach(z => b.add(at(mesh(new THREE.BoxGeometry(0.09, 1.55, 0.09), RW_DARK), -0.95, 2.8, z * 1.2)));
      b.add(at(mesh(new THREE.BoxGeometry(1.7, 0.1, 2.7), RW_YELLOW), -0.95, 3.6, 0));               // the canopy
      b.add(at(mesh(new THREE.BoxGeometry(0.55, 0.18, 0.55), RW_DARK), -1.1, 2.15, -0.5));          // seat
      b.add(at(mesh(new THREE.BoxGeometry(0.45, 0.4, 0.6), 0x334155), -0.6, 2.3, -0.5));              // console
      rwExhaust(b, 0.6, 1.9, 0.8, 0.9);
      // The augers spreading the mix and the heated screed behind, wider than the tractor
      const auger = mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.6, 12), 0x9ca3af, { metalness: 0.8 });
      auger.rotation.x = Math.PI / 2;
      b.add(at(auger, -1.55, 0.25, 0));
      const screed = mesh(new THREE.BoxGeometry(0.8, 0.45, 4.0), RW_YELLOW);
      b.add(at(screed, -2.15, 0.28, 0));
      b.add(at(mesh(new THREE.BoxGeometry(0.85, 0.06, 4.0), 0x52525b, { metalness: 0.8 }), -2.15, 0.03, 0));
      b.add(at(mesh(new THREE.BoxGeometry(0.4, 0.5, 4.1), 0x3f3f46), -2.7, 0.55, 0));               // screed walkway
      [-1, 1].forEach(z => b.add(rod([-0.3, 0.9, z * 1.25], [-1.9, 0.45, z * 1.25], 0.07, RW_DARK)));   // tow arms
      return miniature(b, { seat: { x: -1.1, y: 2.3 - KELO_SIT_OFFSET, z: -0.5 }, screed });
    }

// Tools and materials, in item units (about a metre), like the other groundwork tools
function rwSurveyKitModel() {
      const g = group();
      [0, 2.1, 4.2].forEach(a => g.add(rod([0, 1.2, 0], [Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35], 0.015, 0xeab308)));
      g.add(at(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 12), RW_DARK), 0, 1.22, 0));
      g.add(at(mesh(new THREE.BoxGeometry(0.16, 0.22, 0.14), 0xfacc15), 0, 1.36, 0));
      const scope = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.2, 10), RW_DARK);
      scope.rotation.z = Math.PI / 2;
      g.add(at(scope, 0.02, 1.42, 0));
      g.add(rod([0.6, 0, 0.2], [0.6, 1.6, 0.2], 0.012, 0xe5e7eb));                                    // the prism pole
      g.add(at(mesh(new THREE.SphereGeometry(0.05, 10, 8), 0xf97316, { metalness: 0.6 }), 0.6, 1.62, 0.2));
      return g;
    }
function rwDistributorModel() {
      const g = group();
      const tank = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 16), 0x111827, { metalness: 0.4, roughness: 0.4 });
      tank.rotation.z = Math.PI / 2;
      g.add(at(tank, 0, 0.6, 0));
      [-0.3, 0.3].forEach(z => g.add(at(wheel(0.2, 0.08), 0, 0.2, z)));
      g.add(rod([-0.5, 0.25, -0.5], [-0.5, 0.25, 0.5], 0.015, 0x9ca3af, { metalness: 0.8 }));         // the spray bar
      g.add(rod([0.45, 0.6, 0], [0.9, 0.9, 0], 0.02, RW_DARK));
      g.add(at(mesh(new THREE.BoxGeometry(0.2, 0.18, 0.2), 0xdc2626), 0.2, 0.95, 0));                  // the burner box
      return g;
    }
function rwStriperModel() {
      const g = group();
      g.add(at(mesh(new THREE.BoxGeometry(0.5, 0.18, 0.36), 0xdc2626), 0, 0.32, 0));
      g.add(at(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 14), 0xfacc15), 0.05, 0.56, 0));       // the paint hopper
      [[0.22, -0.2], [0.22, 0.2], [-0.22, 0]].forEach(([x, z]) => g.add(at(wheel(0.1, 0.05), x, 0.1, z)));
      g.add(rod([-0.2, 0.4, 0], [-0.62, 0.95, 0], 0.016, RW_DARK));
      g.add(rod([-0.62, 0.95, -0.18], [-0.62, 0.95, 0.18], 0.018, RW_DARK));
      g.add(at(mesh(new THREE.BoxGeometry(0.05, 0.12, 0.05), 0x9ca3af, { metalness: 0.8 }), 0.18, 0.12, 0.28));   // the spray gun
      return g;
    }
function rwPailModel(color) {
      const g = group();
      g.add(at(mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.36, 16), 0xf8fafc), 0, 0.18, 0));
      g.add(at(mesh(new THREE.CylinderGeometry(0.152, 0.152, 0.03, 16), color), 0, 0.37, 0));
      return g;
    }
if (typeof ITEM_MODEL_RULES !== 'undefined') {
  ITEM_MODEL_RULES.unshift(
    [/bull ?dozer|crawler dozer/, () => rwDozerModel()],
    [/motor grader|road grader/, () => rwGraderModel()],
    [/tandem (vibratory )?(asphalt )?roller/, () => rwRollerModel(true)],
    [/single.?drum|soil compactor|vibratory soil/, () => rwRollerModel(false)],
    [/asphalt paver|paving machine|road paver/, () => rwPaverModel()],
    [/total station|survey(ing)? kit/, () => rwSurveyKitModel()],
    [/asphalt distributor|emulsion sprayer|tack (coat )?sprayer/, () => rwDistributorModel()],
    [/line striper|striping machine|line marking machine/, () => rwStriperModel()],
    [/yellow traffic paint/, () => rwPailModel(0xfacc15)],
    [/white traffic paint|prime emulsion/, () => rwPailModel(0xf8fafc)]
  );
}

// --- The job: its size, its route and its edit in the world -------------------------------------------
const RW_STEPS = [
  ['research', 'Research how a road is built'], ['order', 'Send the parts list'], ['survey', 'Survey and stake out'], ['clear', 'Clear and grub (bulldozer)'],
  ['grade', 'Rough grade (motor grader)'], ['drain', 'Ditches, culvert and headwalls'], ['subgrade', 'Compact the subgrade (soil roller)'],
  ['base', 'Haul and spread the aggregate base'], ['compactbase', 'Compact the base'], ['prime', 'Prime coat (distributor)'],
  ['pave', 'Pave with my own hot mix'], ['roll', 'Finish rolling (tandem roller)'], ['cure', 'Let it cool and cure'], ['stripe', 'Paint the lines (line striper)']
];
function rwStepList(t) { return t && t.data && t.data.runway ? RWY_STEPS : RW_STEPS; }
function rwStepKey(t) { const s = rwStepList(t)[t.step || 0]; return s ? s[0] : 'done'; }
function rwStepName(t, i = t.step || 0) { const s = rwStepList(t)[i]; return s ? s[1] : ''; }

function rwJobSize(J) {
      const lenU = Math.hypot(J.toX - J.x, J.toZ - J.z);
      const lenM = lenU / RW_UNITS_PER_M, widthM = J.width / RW_UNITS_PER_M;
      return { lenU, lenM, widthM, areaM2: lenM * widthM, runway: Boolean(J.runway) };
    }
function rwNeeds(J) {
      const size = rwJobSize(J);
      const out = {};
      Object.entries(RW_SUPPLIES).forEach(([k, s]) => { const n = s.need(size); if (n > 0) out[k] = n; });
      out.hma = Math.ceil(J.runway ? rwHma(size) : size.areaM2 * RW_HMA_DEPTH_M * RW_HMA_T_PER_M3);   // tonnes from his own plant
      return out;
    }

// Is a corridor this wide clear (buildings, town, water, steep ground, other roads and pours)?
function rwRouteOk(x, z, toX, toZ, w = RW_LANE_UNITS) {
      const len = Math.hypot(toX - x, toZ - z);
      if (len < 8) return false;
      const dx = (toX - x) / len, dz = (toZ - z) / len;
      for (let d = 0; d <= len; d += 1.2) {
        for (const o of [-w / 2 - 0.8, 0, w / 2 + 0.8]) {
          const px = x + dx * d + dz * o, pz = z + dz * d - dx * o;
          if (pz > 8.4 || offLimits(px, pz, 0.5)) return false;
          if (typeof pointBlocked === 'function' && pointBlocked(px, pz, { x: 999, z: 999 })) return false;
          const slope = Math.abs(getAnalyticalGroundHeight(px + 1, pz) - getAnalyticalGroundHeight(px - 1, pz)) + Math.abs(getAnalyticalGroundHeight(px, pz + 1) - getAnalyticalGroundHeight(px, pz - 1));
          if (slope > 1.1) return false;
        }
      }
      // Not across his other roads or concrete
      const near = (state.worldEdits || []).some(e => e.type === 'road' && typeof segDist === 'function' && [0, 0.5, 1].some(f => segDist(x + (toX - x) * f, z + (toZ - z) * f, e) < (e.width || 1.5) / 2 + w / 2 + 1));
      return !near;
    }
function rwPickRoute(near = null) {
      for (let i = 0; i < 80; i++) {
        const a = openGroundSpot(4, near && i < 40 ? near : null);
        const ang = Math.random() * Math.PI * 2, len = 22 + Math.random() * (RW_MAX_UNITS - 22);
        const b = { x: Math.round((a.x + Math.cos(ang) * len) * 10) / 10, z: Math.round((a.z + Math.sin(ang) * len) * 10) / 10 };
        if (rwRouteOk(a.x, a.z, b.x, b.z)) return { from: a, to: b };
      }
      return null;
    }

function rwEdit(t) { return (state.worldEdits || []).find(e => e.id === t.data.editId) || null; }
function rwRender(e) { if (!e) return; removeEditMesh(e.id); renderEdit(e); }
// Move the road on to a new stage; `prog` is how far along the new stage has reached (0..1)
function rwSetStage(e, stage, prog = 1) {
      if (!e) return;
      if (e.stage !== stage) { e.prev = e.stage || null; e.stage = stage; }
      else if (prog < (e.prog ?? 0)) prog = e.prog;   // the next section carries on where the last one stopped
      e.prog = Math.max(0, Math.min(1, prog));
      rwRender(e);
    }

// --- The parts list: one card for the whole job, sent from the Post tab ----------------------------------
function rwListLines(t) {
      const J = t.data, need = rwNeeds(J);
      const lines = [];
      const gearKeys = [...new Set(Object.values(RW_STEP_GEAR).flat())];
      gearKeys.forEach(k => {
        const g = RW_GEAR[k];
        lines.push({ id: 'g-' + k, key: k, name: g.ask, qty: 1, unit: '', kind: g.kind, why: g.how ? g.how.split(',')[0] : (k === 'truck' ? 'hauls the base and the hot mix' : 'digs the ditches and sets the culvert') });
      });
      Object.entries(RW_SUPPLIES).forEach(([k, s]) => {
        if (!need[k]) return;
        const units = Math.ceil(Math.max(0, need[k] - rwStock(k)) / s.per);
        lines.push({ id: 's-' + k, key: k, name: s.ask, qty: Math.max(1, units), unit: units === 1 ? '' : '×', kind: 'c', why: `${rwFmt(k, need[k])} for the job`, supply: true });
      });
      (J.extraLines || []).forEach(l => lines.push({ ...l }));
      return lines;
    }
function rwLineGot(l) {
      if (l.supply) return Math.min(l.qty, l.got || 0);
      const g = RW_GEAR[l.key];
      if (g) return (g.kind === 'vehicle' ? state.vehicles.some(v => g.re.test(v.name)) || hasItem(g.re) : hasItem(g.re)) ? 1 : 0;
      return l.got || 0;
    }
function rwListRequest(t) { return (state.requestsToUser || []).find(r => r.category === 'joblist' && r.jobTask === t.id) || null; }

// Write the list and send it as a letter (only what he doesn't have yet)
function rwSendList(t) {
      let req = rwListRequest(t);
      const lines = rwListLines(t).map(l => ({ ...l, sent: 0, got: 0 })).filter(l => rwLineGot(l) < l.qty);
      if (req && !req.declined) return req;
      if (!lines.length) return null;
      req = {
        id: 'req-job-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1000),
        category: 'joblist', icon: t.data.runway ? '🛫' : '🚧', urgency: 'Parts list',
        title: `${t.data.runway ? 'Runway' : 'Roadwork'} list: ${t.title.replace(/^Build /, '')}`.slice(0, 80),
        question: `I read up on how ${t.data.runway ? 'a runway' : 'a proper road'} is built, step by step. These are the machines, tools and materials the job really takes (${Math.round(rwJobSize(t.data).lenM)} m × ${Math.round(rwJobSize(t.data).widthM * 10) / 10} m). The hot mix and the concrete I'll make in my own plants. Send all of it or just some; I'll start each step as soon as what it needs is here.`,
        jobTask: t.id, lines, listRev: Date.now(), fulfilled: false, declined: false, userAnswer: ''
      };
      state.requestsToUser.unshift(req);
      t.data.reqIds = [...new Set([...(t.data.reqIds || []), req.id])];
      showToast(`${req.icon} Kelo-1 sent you his ${t.data.runway ? 'runway' : 'roadwork'} parts list`);
      savePersistentBrainState();
      return req;
    }

function roadworkListCardHtml(req) {
      const id = escapeHtml(req.id);
      const kindTag = { vehicle: 'machine', tool: 'tool', c: 'material' };
      const rows = (req.lines || []).map(l => {
        const got = rwLineGot(l) >= l.qty, sent = (l.sent || 0) >= l.qty;
        return `<label class="flex items-start gap-2 px-2 py-1 rounded-lg ${got ? 'bg-emerald-500/10' : sent ? 'bg-sky-500/10' : 'hover:bg-slate-800/60'} cursor-pointer">
          <input type="checkbox" class="rw-line-cb mt-0.5 accent-amber-400" data-req-id="${id}" data-line-id="${escapeHtml(l.id)}" ${sent || got ? 'disabled' : 'checked'} />
          <span class="flex-1 text-[11px] text-slate-200 leading-snug">${escapeHtml(l.name)} <span class="font-mono font-bold text-amber-300">× ${escapeHtml(String(l.qty))}</span> <span class="text-[9px] uppercase text-slate-500">${kindTag[l.kind] || ''}</span>${l.why ? `<span class="block text-[10px] text-slate-400 italic">${escapeHtml(l.why)}</span>` : ''}</span>
          <span class="text-[10px] font-mono shrink-0 ${got ? 'text-emerald-300' : sent ? 'text-sky-300' : 'text-slate-500'}">${got ? '✓ here' : sent ? '📮 sent' : 'needed'}</span>
        </label>`;
      }).join('');
      const left = (req.lines || []).filter(l => (l.sent || 0) < l.qty && rwLineGot(l) < l.qty).length;
      return `<div class="p-4 rounded-2xl border ${req.fulfilled ? 'bg-slate-950/60 border-emerald-500/30' : 'bg-slate-950 border-amber-500/50 shadow-lg'} space-y-2.5" data-rw-card="${id}">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-bold text-white flex items-center gap-1.5"><span class="text-lg">${escapeHtml(req.icon)}</span><span>${escapeHtml(req.title)}</span></span>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 ${req.fulfilled ? 'bg-emerald-500/20 text-emerald-300' : req.declined ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/25 text-amber-300 border border-amber-400/40'}">${req.declined ? '✗ Not now' : req.fulfilled ? '📮 All sent' : `${(req.lines || []).length - left}/${(req.lines || []).length} sent`}</span>
        </div>
        <p class="text-xs text-slate-200 leading-relaxed font-serif italic">"${escapeHtml(req.question)}"</p>
        <div class="max-h-72 overflow-y-auto space-y-0.5 rounded-xl bg-slate-900/70 border border-slate-800 p-1">${rows}</div>
        <div class="flex flex-wrap gap-1.5">
          ${!req.fulfilled && !req.declined ? `<button data-req-id="${id}" class="rw-send-sel flex-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-bold text-xs">📦 Send checked</button>
          <button data-req-id="${id}" class="rw-send-all flex-1 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs">📦 Send all (${left})</button>` : ''}
          <button data-req-id="${id}" class="rw-copy-text px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs">📋 Copy as text</button>
          ${!req.fulfilled && !req.declined ? `<button data-req-id="${id}" class="rw-decline px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 text-xs">✗ Not now</button>` : ''}
        </div>
      </div>`;
    }
function roadworkListText(req) {
      return [`${req.title} (parts list from Kelo-1)`, ...(req.lines || []).map(l => `[${rwLineGot(l) >= l.qty ? 'x' : ' '}] ${l.name} × ${l.qty}${l.why ? ` (${l.why})` : ''}`)].join('\n');
    }
function bindRoadworkListButtons(list) {
      const visitor = () => ((document.getElementById('visitorNameInput') || {}).value || 'curiousWanderer').trim();
      const reqOf = btn => state.requestsToUser.find(r => r.id === btn.getAttribute('data-req-id'));
      list.querySelectorAll('.rw-send-sel').forEach(btn => { btn.onclick = () => {
        const ids = [...list.querySelectorAll(`.rw-line-cb[data-req-id="${btn.getAttribute('data-req-id')}"]`)].filter(cb => cb.checked && !cb.disabled).map(cb => cb.getAttribute('data-line-id'));
        if (!ids.length) { showToast('Tick what you want to send first.'); return; }
        sendRoadworkList(btn.getAttribute('data-req-id'), ids, visitor());
      }; });
      list.querySelectorAll('.rw-send-all').forEach(btn => { btn.onclick = () => sendRoadworkList(btn.getAttribute('data-req-id'), null, visitor()); });
      list.querySelectorAll('.rw-copy-text').forEach(btn => { btn.onclick = () => { const r = reqOf(btn); if (r && typeof copyToClipboard === 'function') { copyToClipboard(roadworkListText(r)); showToast('📋 Copied the list as text'); } }; });
      list.querySelectorAll('.rw-decline').forEach(btn => { btn.onclick = () => {
        const r = reqOf(btn);
        if (!r || r.fulfilled) return;
        Object.assign(r, { fulfilled: true, declined: true, declinedAt: Date.now(), userAnswer: 'Not now', listRev: Date.now() });
        state.speechBubble = "That's okay. I'll keep the job on my list and ask again later.";
        savePersistentBrainState();
        renderAllUI();
      }; });
    }

// The human sends some or all of the list: one kit at the Post Office
function sendRoadworkList(reqId, lineIds = null, visitor = 'curiousWanderer') {
      const req = state.requestsToUser.find(r => r.id === reqId && r.category === 'joblist');
      if (!req || req.fulfilled) return null;
      const lines = (req.lines || []).filter(l => (l.sent || 0) < l.qty && rwLineGot(l) < l.qty && (!lineIds || lineIds.includes(l.id)));
      if (!lines.length) return null;
      const entry = postMail({ kind: 'jobkit', from: visitor, name: `${req.icon === '🛫' ? 'Runway' : 'Roadwork'} kit (${lines.length} line${lines.length === 1 ? '' : 's'})`, category: 'material', emoji: req.icon,
        note: lines.slice(0, 5).map(l => `${l.name} × ${l.qty}`).join('; ') + (lines.length > 5 ? '…' : '') });
      if (!entry) return null;
      entry.jobKit = { reqId, lines: lines.map(l => [l.id, l.qty]) };
      lines.forEach(l => { l.sent = l.qty; });
      req.listRev = Date.now();
      if ((req.lines || []).every(l => (l.sent || 0) >= l.qty || rwLineGot(l) >= l.qty)) { req.fulfilled = true; req.userAnswer = 'Sent'; }
      if (typeof recordVisitorMemory === 'function') recordVisitorMemory(visitor, `Sent me ${lines.length} line${lines.length === 1 ? '' : 's'} of my roadwork list.`);
      savePersistentBrainState();
      renderAllUI();
      return entry;
    }

// He opens the kit at the Post Office: machines are parked, tools shelved, materials go on his ledger
async function openRoadworkKit(parcel) {
      const req = state.requestsToUser.find(r => r.id === parcel.jobKit.reqId);
      const got = [];
      (parcel.jobKit.lines || []).forEach(([id, qty]) => {
        const l = req && req.lines.find(x => x.id === id);
        if (!l) return;
        if (l.supply) {
          const s = RW_SUPPLIES[l.key];
          rwState().stock[l.key] = rwStock(l.key) + qty * s.per;
          l.got = Math.min(l.qty, (l.got || 0) + qty);
          got.push(`${rwFmt(l.key, qty * s.per)} of ${s.label}`);
          return;
        }
        const g = RW_GEAR[l.key];
        if (!g) return;
        if (g.kind === 'vehicle') { state.belongings.unshift({ name: g.ask, category: 'vehicle', emoji: '🚜', from: parcel.from }); if (typeof registerVehicle === 'function') registerVehicle(g.ask); }
        else { state.toolInventory.unshift(g.ask); state.unstoredItems.push(g.ask); }
        if (typeof noteSupplyArrived === 'function') noteSupplyArrived(g.ask);
        got.push(rwPlain(g.ask));
      });
      if (req) req.listRev = Date.now();
      state.giftLog.unshift({ type: 'request', name: parcel.name, category: 'material', emoji: parcel.emoji, from: parcel.from, note: String(parcel.note || '').slice(0, 200), time: parcel.time, reaction: '' });
      if (state.giftLog.length > 30) state.giftLog.length = 30;
      state.moodEmoji = parcel.emoji || '🚧';
      state.moodTitle = `Unpacked ${parcel.name.toLowerCase()}`.slice(0, 80);
      state.speechBubble = `From my list: ${got.slice(0, 5).join(', ')}${got.length > 5 ? ` and ${got.length - 5} more` : ''}. Thank you, ${parcel.from}!`.slice(0, 400);
      state.giftLog[0].reaction = state.speechBubble;
      state.chatLog.push({ sender: 'Kelo-1', text: state.speechBubble, time: 'Just now', isBot: true });
      savePersistentBrainState();
      renderAllUI();
      if (typeof sleepPace === 'function') await sleepPace(1200);
      return true;
    }
if (typeof openParcel === 'function') {
  const rwOrigOpenParcel = openParcel;
  openParcel = async function (parcel) {
      if (parcel && parcel.kind === 'jobkit' && parcel.jobKit) return openRoadworkKit(parcel);
      return rwOrigOpenParcel(parcel);
    };
}

// --- What stops the current step (null: nothing, he can work) ----------------------------------------
function rwGearOwned(k) {
      const g = RW_GEAR[k];
      if (!g) return null;
      if (g.kind === 'vehicle') return state.vehicles.find(v => g.re.test(v.name)) || null;
      return hasItem(g.re) || null;
    }
function rwWeatherOk(key) {
      if (!['prime', 'pave', 'roll', 'stripe'].includes(key)) return null;
      if (typeof isRaining === 'function' && isRaining()) return { type: 'weather', label: 'dry weather (prime, asphalt and paint go down on a dry surface)' };
      const w = typeof worldNow === 'function' ? worldNow() : null;
      if (w && w.season === 'Winter') return { type: 'season', label: 'spring: asphalt and line paint are not laid in freezing weather' };
      return null;
    }
// act: also set about fixing it (ask, learn, fuel up). Quiet checks only look.
function rwStepBlocker(t, act = false) {
      const key = rwStepKey(t), J = t.data;
      if (key === 'research') return jobKnown(J.runway ? 'runway' : 'roadworks') ? null : { type: 'skill', label: `researching ${J.runway ? 'runways' : 'road building'} at NetNode` };
      if (key === 'order' || key === 'cure' || key === 'done') return null;
      const req = rwListRequest(t);
      for (const k of RW_STEP_GEAR[key] || []) {
        const have = rwGearOwned(k);
        if (!have) {
          if (act && (!req || req.declined) && (k === 'truck' || k === 'excavator')) addItemRequest(RW_GEAR[k].ask, 'vehicle', `For ${t.title.toLowerCase()} I need ${rwPlain(RW_GEAR[k].ask)}.`, t.title);
          return { type: 'delivery', label: `${rwPlain(RW_GEAR[k].ask).replace(/ with .*$|:.*$/, '')} (on my parts list)`, items: [RW_GEAR[k].re.source] };
        }
        const name = typeof have === 'string' ? have : have.name;
        if (typeof readyToOperate === 'function' && !readyToOperate(name, typeof have === 'object' ? have : null, { quiet: !act })) {
          const v = typeof have === 'object' ? have : null;
          const rule = typeof knowHowRule === 'function' ? knowHowRule(name) : null;
          const known = rule && state.knowHow && state.knowHow[rule.key];
          return known && v ? { type: 'supply', label: `${typeof fuelNeededBy === 'function' ? fuelNeededBy(v) || 'fuel' : 'fuel'} for the ${rwPlain(name).replace(/ with .*$/, '')}` } : { type: 'skill', label: `learning to use the ${rwPlain(name).replace(/ with .*$|:.*$/, '')}` };
        }
      }
      const need = rwNeeds(J);
      for (const k of RW_STEP_SUPPLY[key] || []) {
        if (!need[k]) continue;
        const left = need[k] - (Number((J.usedFor || {})[k]) || 0);
        const min = J.runway ? Math.min(left, need[k] / RWY_SECTIONS) : k === 'base' ? Math.min(left, RW_BASE_LOAD_T) : left;
        if (left > 0 && rwStock(k) + 1e-6 < min) {
          if (act && (!req || req.declined || req.fulfilled) && !(req && req.lines.some(l => l.key === k && (l.sent || 0) < l.qty))) addItemRequest(RW_SUPPLIES[k].ask, 'material', `For ${t.title.toLowerCase()} I still need ${rwFmt(k, min - rwStock(k))} more ${RW_SUPPLIES[k].label}.`, t.title);
          return { type: 'delivery', label: `${rwFmt(k, min - rwStock(k))} more ${RW_SUPPLIES[k].label}`, items: [] };
        }
      }
      if (key === 'pave') {
        if (!jobKnown('asphaltPlant')) { if (act) groundworkReady('asphaltPlant', 'Getting my asphalt plant ready for the road'); return { type: 'skill', label: 'learning to run my asphalt plant' }; }
        const short = typeof plantShortfall === 'function' ? plantShortfall('asphalt') : [];
        if (short.length && !hasItem(/hot.?mix asphalt/i)) { if (act) requestPlantMaterials('asphalt', short, t.title); return { type: 'plant', label: `materials for my asphalt plant (${short.map(m => m.label).slice(0, 3).join(', ')})` }; }
        if (!J.runway && !rwGearOwned('tandemroller')) return { type: 'delivery', label: 'the tandem roller (breakdown rolling right behind the paver)', items: [RW_GEAR.tandemroller.re.source] };
      }
      if (key === 'drain' && !J.runway && !J.headwalls) {
        if (!jobKnown('batchPlant')) { if (act) groundworkReady('batchPlant', 'Concrete headwalls for the culvert'); return { type: 'skill', label: 'learning to run my concrete plant (culvert headwalls)' }; }
        const truck = findVehicle('mixer');
        if (!truck && !hasItem(/ready.?mix/i)) { if (act) addItemRequest('A concrete mixer truck', 'vehicle', 'The culvert headwalls take ready-mix from my own plant, carried in a mixer truck.', t.title); return { type: 'delivery', label: 'a concrete mixer truck (for the headwalls)', items: [/concrete mixer truck|cement mixer truck|ready.?mix truck|transit mixer/i.source] }; }
        const short = typeof plantShortfall === 'function' ? plantShortfall('batch', 'pad') : [];
        if (short.length && !hasItem(/ready.?mix/i)) { if (act) requestPlantMaterials('batch', short, t.title); return { type: 'plant', label: `materials for my concrete plant (${short.map(m => m.label).slice(0, 3).join(', ')})` }; }
      }
      return rwWeatherOk(key);
    }

// --- Doing it ---------------------------------------------------------------------------------------------
function rwAlong(e, f, side = 0) {
      const len = Math.hypot(e.toX - e.x, e.toZ - e.z) || 1, dx = (e.toX - e.x) / len, dz = (e.toZ - e.z) / len;
      return { x: e.x + (e.toX - e.x) * f + dz * side, z: e.z + (e.toZ - e.z) * f - dx * side };
    }
function rwProgressOf(e) {
      const len2 = (e.toX - e.x) ** 2 + (e.toZ - e.z) ** 2 || 1;
      return Math.max(0, Math.min(1, ((state.botPos.x - e.x) * (e.toX - e.x) + (state.botPos.z - e.z) * (e.toZ - e.z)) / len2));
    }
// While he works along the road, the new stage grows behind him
function rwWatch(e, stage, from = 0, to = 1) {
      let last = -1;
      rwSetStage(e, stage, from);
      const timer = setInterval(() => {
        const f = Math.max(from, Math.min(to, rwProgressOf(e)));
        if (f - last > 0.08) { last = f; e.prog = f; rwRender(e); }
      }, 700);
      return () => { clearInterval(timer); e.prog = to; rwRender(e); };
    }
function rwSecRange(t) {
      if (!t.data.runway) return [0, 1];
      const s = t.data.sec || 0;
      return [s / RWY_SECTIONS, (s + 1) / RWY_SECTIONS];
    }
async function rwPass(t, gearKey, stage, say, { from = rwSecRange(t)[0], to = rwSecRange(t)[1], back = false } = {}) {
      const e = rwEdit(t), v = rwGearOwned(gearKey);
      if (!e || !v) return false;
      const name = rwPlain(v.name).replace(/ with .*$/, '');
      state.speechBubble = say;
      const a = rwAlong(e, from), b = rwAlong(e, to);
      await driveVehicle(v, a, `Bringing the ${name} to the start`);
      const stop = rwWatch(e, stage, from, to);
      try { await driveVehicle(v, b, `${rwStepName(t)}: the ${name}`); }
      finally { stop(); }
      if (back) await driveVehicle(v, rwAlong(e, from, -RW_LANE_UNITS * 0.3), `A second pass with the ${name}`);
      const g = RW_GEAR[gearKey];
      if (g && g.skill && typeof gainSkill === 'function') gainSkill(g.skill[0], g.skill[1], 5);
      return true;
    }
async function rwWalkWith(t, gearKey, stage, say, pose = 'normal') {
      const e = rwEdit(t);
      if (!e) return false;
      // Fetch it from his shelves (never longer than 90 s: a tool not on a shelf yet is taken from where it is)
      if (typeof fetchFromStorehouse === 'function') await Promise.race([fetchFromStorehouse(rwGearOwned(gearKey)), new Promise(r => setTimeout(r, 90000))]);
      holdJobTool(RW_GEAR[gearKey].re, pose);
      state.speechBubble = say;
      const [f0, f1] = rwSecRange(t);
      state.targetPos = rwAlong(e, f0, RW_LANE_UNITS * 0.25);
      await waitForArrival(60000);
      const stop = rwWatch(e, stage, f0, f1);
      try { state.targetPos = rwAlong(e, f1, RW_LANE_UNITS * 0.25); await waitForArrival(90000); }
      finally { stop(); if (typeof setCarriedObject === 'function') setCarriedObject(null); state.microPose = 'normal'; }
      const g = RW_GEAR[gearKey];
      if (g && g.skill && typeof gainSkill === 'function') gainSkill(g.skill[0], g.skill[1], 5);
      return true;
    }
function rwSay(t, title, speech) {
      state.currentLocKey = 'custom';
      state.customPlaceName = t.data.runway ? 'the runway' : 'his new road';
      state.moodEmoji = t.data.runway ? '🛫' : '🚧';
      state.moodTitle = String(title).slice(0, 80);
      state.speechBubble = speech;
      renderAllUI();
    }
function rwShare(J, need, k) { return J.runway ? (need[k] || 0) / RWY_SECTIONS : (need[k] || 0); }
function rwUsedFor(J, k, amount) { J.usedFor = J.usedFor || {}; J.usedFor[k] = Math.round(((Number(J.usedFor[k]) || 0) + amount) * 100) / 100; }
async function rwTipTruck(v) {
      const m = v && vehicleMeshes[v.id];
      if (m && m.userData.bed) { m.userData.bed.rotation.z = 0.55; await new Promise(r => setTimeout(r, 1500)); m.userData.bed.rotation.z = 0; }
    }
function rwStockpileSpot() {
      if (typeof plantSpot === 'function') { const p = plantSpot('asphalt', 'stockpile'); return { x: p.x, z: p.z }; }
      return { x: state.botPos.x, z: state.botPos.z };
    }

// Each step: does one piece of work and returns true when the whole step is done (then the task moves on)
const RW_STEP_RUN = {
  async survey(t) {
    const J = t.data, need = rwNeeds(J);
    rwSay(t, `${t.title}: surveying`, 'Total station on the tripod, prism on the pole. A stake every 7.5 m along both edges, the offsets marked in paint.');
    const ok = await rwWalkWith(t, 'survey', 'staked', 'Sight, measure, drive the stake, paint the offset. Next one.');
    if (!ok) return false;
    ['stakes', 'markpaint'].forEach(k => { const a = rwShare(J, need, k); rwUse(k, a); rwUsedFor(J, k, a); });
    return true;
  },
  async clear(t) {
    rwSay(t, `${t.title}: clearing and grubbing`, 'The dozer strips the turf and topsoil and grubs out the roots, so nothing rots under the road.');
    return rwPass(t, 'dozer', 'cleared', 'Blade down just below the topsoil, push it to the side.');
  },
  async grade(t) {
    rwSay(t, `${t.title}: rough grading`, 'The grader cuts it to the grade stakes, with a crown in the middle so rain runs off to the sides.');
    return rwPass(t, 'grader', 'graded', 'Moldboard angled, cutting to the stakes.', { back: true });
  },
  async drain(t) {
    const J = t.data, e = rwEdit(t), need = rwNeeds(J);
    rwSay(t, `${t.title}: drainage`, 'Ditches along both sides, and a culvert under the road where the water wants to cross.');
    const ex = rwGearOwned('excavator');
    if (ex && !J.ditched) {
      const [d0, d1] = rwSecRange(t), off = (J.width / 2 + 2.5);
      await driveVehicle(ex, rwAlong(e, d0, off), 'Bringing the excavator to dig the ditches');
      const stop = rwWatch(e, 'graded', d0, d1);
      e.ditches = true;
      try { await driveVehicle(ex, rwAlong(e, d1, off), 'Digging the side ditches'); } finally { stop(); }
      e.culvert = { d: 0.5 };
      rwRender(e);
      { const a = rwShare(J, need, 'culvert'); rwUse('culvert', a); rwUsedFor(J, 'culvert', a); }
      if (J.runway) return true;   // a runway section: ditches and its culverts; no headwalls
      J.ditched = true;
      if (typeof gainSkill === 'function') gainSkill('excavator', 'driving the excavator', 4);
      savePersistentBrainState();
      return false;   // the headwalls next time
    }
    if (!J.headwalls) {
      // Concrete headwalls at both ends of the culvert, from his own batch plant
      if (!hasItem(/ready.?mix/i)) {
        const r = await rwFreeFor(() => runBatchPlant('pad', 'For the culvert headwalls on my road.', 'Concrete for the Road'));
        if (r !== true) return r;
      }
      const mixer = findVehicle('mixer');
      if (mixer) await driveVehicle(mixer, rwAlong(e, 0.5, RW_LANE_UNITS * 1.1), 'Taking the ready-mix to the culvert');
      rwSay(t, `${t.title}: pouring the headwalls`, 'Forms at each end of the pipe, chute down, pour. The headwalls hold the fill and stop the water washing it out.');
      await new Promise(r => setTimeout(r, 2500));
      if (typeof useReadyMixFor === 'function') useReadyMixFor('the culvert headwalls');
      J.headwalls = true;
      e.headwalls = true;
      rwRender(e);
    }
    return true;
  },
  async subgrade(t) {
    rwSay(t, `${t.title}: compacting the subgrade`, 'Vibration on, overlapping passes until the drum stops leaving a mark.');
    return rwPass(t, 'soilroller', 'subgrade', 'Rolling the subgrade.', { back: true });
  },
  async base(t) {
    const J = t.data, e = rwEdit(t), need = rwNeeds(J);
    if (J.runway) return rwyBaseSection(t);
    const loads = Math.ceil(need.base / RW_BASE_LOAD_T);
    J.baseLoads = J.baseLoads || 0;
    if (J.baseLoads < loads) {
      const truck = rwGearOwned('truck');
      const tonnes = Math.min(RW_BASE_LOAD_T, need.base - (Number((J.usedFor || {}).base) || 0));
      rwSay(t, `${t.title}: aggregate base, load ${J.baseLoads + 1} of ${loads}`, `Loading ${Math.round(tonnes)} t of crushed base at my stockpile, then out to the road.`);
      await driveVehicle(truck, rwStockpileSpot(), 'Loading crushed base at the stockpile');
      if (truck.load !== undefined) truck.load = 1;
      const m = vehicleMeshes[truck.id];
      if (m && m.userData.loadMesh) { m.userData.loadMesh.visible = true; m.userData.loadMesh.material.color.setHex(0x9ca3af); }
      const f0 = J.baseLoads / loads, f1 = (J.baseLoads + 1) / loads;
      await driveVehicle(truck, rwAlong(e, f0, -RW_LANE_UNITS * 0.1), 'Hauling crushed base to the road');
      rwSay(t, `${t.title}: tipping the base`, 'Bed up: the gravel goes down in a windrow for the grader.');
      await rwTipTruck(truck);
      if (m && m.userData.loadMesh) m.userData.loadMesh.visible = false;
      if (truck.load !== undefined) truck.load = 0;
      rwUse('base', tonnes); rwUsedFor(J, 'base', tonnes);
      J.baseLoads += 1;
      rwSetStage(e, 'loose', f1);
      savePersistentBrainState();
      return false;
    }
    rwSay(t, `${t.title}: spreading the base`, 'The grader spreads the windrows into an even 150 mm layer.');
    return rwPass(t, 'grader', 'raked', 'Spreading and trimming the base course.');
  },
  async compactbase(t) {
    rwSay(t, `${t.title}: compacting the base`, 'A bit of water and the vibratory roller, until the base is hard as rock.');
    return rwPass(t, 'soilroller', 'basecompact', 'Rolling the base course.', { back: true });
  },
  async prime(t) {
    const J = t.data, need = rwNeeds(J);
    rwSay(t, `${t.title}: prime coat`, `About ${RW_PRIME_L_PER_M2} L of emulsion per square metre seals the base and makes the asphalt stick.`);
    const ok = await rwWalkWith(t, 'distributor', 'primed', 'Spray bar open, a steady walking pace.');
    if (!ok) return false;
    { const a = rwShare(J, need, 'prime'); rwUse('prime', a); rwUsedFor(J, 'prime', a); }
    return true;
  },
  async pave(t) {
    const J = t.data, e = rwEdit(t), need = rwNeeds(J);
    J.hmaDone = J.hmaDone || 0;
    if (J.runway) return rwyPaveSection(t);
    if (!hasItem(/hot.?mix asphalt/i)) {
      const r = await rwFreeFor(() => runAsphaltPlant(`For my ${J.runway ? 'runway' : 'road'} (${Math.round(J.hmaDone)} of ${need.hma} t laid).`, J.runway ? 'Hot Mix for the Runway' : 'Hot Mix for the Road'));
      if (r !== true) return r;
    }
    const truck = rwGearOwned('truck'), paver = rwGearOwned('paver');
    const f0 = Math.min(1, J.hmaDone / need.hma), f1 = Math.min(1, (J.hmaDone + HMA_TONNES) / need.hma);
    rwSay(t, `${t.title}: paving`, 'The truck backs up to the paver and tips the hot mix into the hopper.');
    await driveVehicle(paver, rwAlong(e, f0), 'Setting the paver at the joint');
    await driveVehicle(truck, rwAlong(e, Math.max(0, f0 - 0.08), -0.2), 'Backing the hot mix up to the paver');
    await rwTipTruck(truck);
    const stop = rwWatch(e, 'hot', f0, f1);
    try { await driveVehicle(paver, rwAlong(e, f1), 'Laying the mat with the paver'); } finally { stop(); }
    const name = hotMixName && hotMixName();
    if (name) useUpItem(name, 1, { quiet: true, why: 'paving my road' });
    if (typeof plantReconcileLoads === 'function') plantReconcileLoads();
    // Breakdown rolling right behind the paver, while it's hot
    const roller = rwGearOwned('tandemroller');
    if (roller) {
      await driveVehicle(roller, rwAlong(e, f0), 'Breakdown rolling behind the paver');
      await driveVehicle(roller, rwAlong(e, f1), 'Breakdown rolling while it is hot');
    }
    J.hmaDone += HMA_TONNES;
    if (RW_GEAR.paver.skill) gainSkill(RW_GEAR.paver.skill[0], RW_GEAR.paver.skill[1], 5);
    savePersistentBrainState();
    if (J.hmaDone + 1e-6 < need.hma) return false;
    J.pavedAt = Date.now();
    return true;
  },
  async roll(t) {
    rwSay(t, `${t.title}: finish rolling`, 'Static passes with the tandem roller to iron out the marks.');
    const ok = await rwPass(t, 'tandemroller', 'asphalt', 'Finish rolling, vibration off.', { back: true });
    if (ok) t.data.pavedAt = Date.now();
    return ok;
  },
  async cure(t) {
    const J = t.data;
    const until = (J.pavedAt || Date.now()) + RW_CURE_MS * rwTimeScale;
    if (Date.now() < until) { agendaWait(t.id, { type: 'time', label: 'the new asphalt to cool and cure before the lines go on', until }); return 'waiting'; }
    return true;
  },
  async stripe(t) {
    const J = t.data, e = rwEdit(t), need = rwNeeds(J);
    rwSay(t, `${t.title}: line marking`, 'String line, then the striper: a dashed yellow centre line and white edge lines, glass beads dropped into the wet paint so they shine in headlights.');
    const ok = await rwWalkWith(t, 'striper', 'asphalt', 'Steady pace, 100 mm lines.');
    if (!ok) return false;
    if (J.runway) e.markedTo = rwSecRange(t)[1]; else e.marked = true;
    rwRender(e);
    ['paintyellow', 'paintwhite', 'beads'].forEach(k => { if (need[k]) { const a = rwShare(J, need, k); rwUse(k, a); rwUsedFor(J, k, a); } });
    return true;
  }
};

// The plants run only when he is free (js/plants.js plantFree): the job lets go of him for the run
async function rwFreeFor(fn) {
      const was = state.isPracticing;
      state.isPracticing = false;
      try { return await fn(); } finally { state.isPracticing = was; }
    }

let rwJobRunning = null;
// One piece of the current step. Returns true (did work), a reason string (waiting), or false.
async function rwRunTask(t) {
      if (rwJobRunning || !t || agendaClosed(t)) return false;
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping || state.isCollectingMail) return false;
      const key = rwStepKey(t), J = t.data;
      if (key === 'research') {
        const job = J.runway ? 'runway' : 'roadworks';
        if (!jobKnown(job)) {
          const r = await researchJob(job, J.runway ? 'Reading Up on Runways' : 'Reading Up on Road Building');
          if (!jobKnown(job)) return r === false ? false : 'researching';
          rwLearnGear();
        }
        agendaStep(t.id, 1, `I read how ${J.runway ? 'a runway' : 'a road'} is really built. Now the list of what it takes.`);
        return true;
      }
      if (key === 'order') {
        const req = rwSendList(t);
        state.speechBubble = req ? `I wrote out everything the job takes and sent it: ${req.lines.length} lines. I'll start each step when its machines and materials are here.` : 'I already have everything on the list!';
        rwSay(t, `${t.title}: parts list sent`, state.speechBubble);
        agendaStep(t.id, 2, req ? `I sent my human the parts list for ${t.title.toLowerCase()}: ${req.lines.slice(0, 4).map(l => rwPlain(l.name).replace(/ with .*$|:.*$|\(.*$/, '').trim()).join(', ')} and the rest.` : '');
        return true;
      }
      const block = rwStepBlocker(t, true);
      if (block) { agendaWait(t.id, block); return 'waiting'; }
      if (!rwEdit(t)) {
        // The road's line on the ground, from the first stake on
        const e = { id: newEditId('road'), type: 'road', pro: true, surface: 'works', stage: null, prog: 0, x: J.x, z: J.z, toX: J.toX, toZ: J.toZ, width: J.width, at: Date.now(), why: String(t.why || '').slice(0, 160), task: t.id, runway: Boolean(J.runway) };
        state.worldEdits.push(e);
        J.editId = e.id;
      }
      const run = RW_STEP_RUN[key];
      if (!run) return false;
      rwJobRunning = t.id;
      if (J.runway && typeof runwayJobActive !== 'undefined') runwayJobActive = true;
      state.isPracticing = true;
      let r;
      try { r = await run(t); }
      finally {
        state.isPracticing = false;
        rwJobRunning = null;
        if (J.runway && typeof runwayJobActive !== 'undefined') runwayJobActive = false;
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.microPose = 'normal';
      }
      if (r === true) {
        // A runway is worked a section at a time: the step is done when the last section is
        if (J.runway && RWY_SECTIONED.has(key) && (J.sec || 0) + 1 < RWY_SECTIONS) { J.sec = (J.sec || 0) + 1; savePersistentBrainState(); return true; }
        J.sec = 0;
        // The field's own progress stage (agent/runway: field -> cleared -> graded -> base -> paved -> marked -> lit)
        const rwyStage = { clear: 'cleared', grade: 'graded', compactbase: 'base', roll: 'paved', stripe: 'marked', lights: 'lit' }[key];
        if (J.runway && rwyStage && typeof RUNWAY_FIELD !== 'undefined' && RUNWAY_FIELD) RUNWAY_FIELD.stage = rwyStage;
        const label = rwStepName(t);
        if (t.step >= rwStepList(t).length - 1) { rwFinish(t); return true; }
        agendaStep(t.id, t.step + 1, `Done: ${label.toLowerCase()}. Next: ${rwStepName(t, t.step + 1).toLowerCase()}.`);
        if (typeof gainSkill === 'function') gainSkill('road building', J.runway ? 'building a runway' : 'building roads the proper way', 4);
        savePersistentBrainState();
        return true;
      }
      if (typeof r === 'string' && t.status === 'active') {
        const b = rwStepBlocker(t, false);
        agendaWait(t.id, b || { type: 'plant', label: `my plant (${r.replace(/-/g, ' ')})`, until: Date.now() + 3 * 60000 });
      }
      savePersistentBrainState();
      return r === false ? true : r;   // a piece of a step done: carry on next time
    }

function rwLearnGear() {
      if (!state.knowHow) state.knowHow = {};
      Object.entries(RW_GEAR).forEach(([k, g]) => {
        if (g.existing) return;
        const rule = typeof knowHowRule === 'function' ? knowHowRule(g.ask) : null;
        if (rule && !state.knowHow[rule.key]) state.knowHow[rule.key] = { at: Date.now(), from: GROUND_JOBS.roadworks.wiki[0], how: rule.how };
      });
    }

function rwFinish(t) {
      const J = t.data, e = rwEdit(t);
      if (e) { e.surface = 'asphalt'; e.stage = null; e.prog = 1; e.marked = true; e.pavedAt = Date.now(); rwRender(e); }
      // A hand-built gravel path he rebuilt properly is replaced by the new road
      if (J.replaces) { const old = (state.worldEdits || []).find(x => x.id === J.replaces); if (old) { removeEditMesh(old.id); state.worldEdits = state.worldEdits.filter(x => x !== old); } }
      const need = rwNeeds(J), size = rwJobSize(J);
      const used = Object.keys(J.usedFor || {}).map(k => `${rwFmt(k, J.usedFor[k])} of ${RW_SUPPLIES[k] ? RW_SUPPLIES[k].label : k}`);
      agendaDone(t.id, `${J.runway ? 'The runway' : 'My road'} is finished: ${Math.round(size.lenM)} m surveyed, cleared, graded, drained, compacted, based, primed, paved with ${Math.round(J.hmaDone || need.hma)} t of hot mix from my own plant, rolled, cured and striped. Used up: ${used.join(', ')}.`);
      sayAndLog(J.runway ? 'Finished the runway' : 'Finished a proper road', J.runway ? '🛫' : '🛣️', J.runway ? 'Markings, lights and the windsock: the runway is done!' : 'A real road: crowned, drained, paved and striped.',
        `I built ${J.runway ? 'the runway' : 'a proper road'} the way a road crew would, one step after another, with the right machine for each. ${t.why || ''}`, J.runway ? 'Runway Finished' : 'Road Finished');
      if (J.runway && typeof RUNWAY_FIELD !== 'undefined') { RUNWAY_FIELD.developed = true; RUNWAY_FIELD.stage = 'lit'; }
      savePersistentBrainState();
    }

// --- Starting a road: an agenda task --------------------------------------------------------------------
function startRoadworks(from = null, to = null, why = '', opts = {}) {
      const open = agendaOpenTasks().filter(t => t.kind === 'roadwork' && !t.data.runway);
      if (open.length) return open[0];   // one road at a time: finish that one first
      let a = from, b = to;
      if (a && b) {
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        if (len > RW_MAX_UNITS) b = { x: a.x + (b.x - a.x) * RW_MAX_UNITS / len, z: a.z + (b.z - a.z) * RW_MAX_UNITS / len };
        if (!opts.force && !rwRouteOk(a.x, a.z, b.x, b.z)) { const r = rwPickRoute(a); if (!r) return null; a = r.from; b = r.to; }
      } else {
        const r = rwPickRoute(state.botPos);
        if (!r) return null;
        a = r.from; b = r.to;
      }
      const data = { x: a.x, z: a.z, toX: b.x, toZ: b.z, width: RW_LANE_UNITS, replaces: opts.replaces || null };
      const lenM = Math.round(rwJobSize(data).lenM);
      const t = agendaAdd({ ref: 'road:' + Date.now().toString(36), kind: 'roadwork', title: `Build a ${lenM} m paved road`, emoji: '🛣️', why: why || 'A real road, built properly', priority: 3,
        steps: RW_STEPS.map(s => s[1]), step: jobKnown('roadworks') ? 1 : 0, data });
      state.speechBubble = `I want to build a real ${lenM} m road, the proper way: survey, grade, drain, base, pave, stripe.`;
      renderAllUI();
      return t;
    }

agendaRegisterKind('roadwork', {
  label: 'roadwork',
  check: t => {
    if (rwStepKey(t) === 'cure') return Date.now() >= ((t.data.pavedAt || 0) + RW_CURE_MS * rwTimeScale) ? true : { waitingFor: { type: 'time', label: 'the new asphalt to cool and cure before the lines go on' } };
    const b = rwStepBlocker(t, false);
    return b ? { waitingFor: b } : true;
  },
  resume: t => rwRunTask(t)
});

// --- Drawing his road at each stage ------------------------------------------------------------------------
const RW_STAGE_LOOK = {
  staked: null,
  cleared: { color: 0x6b4a2b, rough: 1, lift: 0.01, wide: 1.2, finish: 'soil' },
  graded: { color: 0x8a6a45, rough: 1, lift: 0.015, wide: 0.6, finish: 'soil' },
  subgrade: { color: 0x7a5c3c, rough: 0.95, lift: 0.02, wide: 0.6, finish: 'soil' },
  loose: { color: 0xa8a29e, rough: 1, lift: 0.05, wide: 0, finish: 'gravel', bumpy: true },
  raked: { color: 0xa8a29e, rough: 1, lift: 0.04, wide: 0, finish: 'gravel' },
  basecompact: { color: 0x9a948e, rough: 0.95, lift: 0.04, wide: 0, finish: 'gravel' },
  primed: { color: 0x3a2a1c, rough: 0.35, lift: 0.045, wide: 0 },
  hot: { color: 0x161618, rough: 0.55, lift: 0.07, wide: 0 },
  asphalt: { color: 0x2a2a2d, rough: 0.92, lift: 0.07, wide: 0 }
};
const rwMatCache = {};
function rwMat(key, look) {
      if (rwMatCache[key]) return rwMatCache[key];
      const real = typeof finishMaterial === 'function';
      let m = new THREE.MeshStandardMaterial({ color: look.finish && real ? 0xffffff : look.color, roughness: look.rough });
      if (look.finish && real) m = finishMaterial(m, look.finish);
      rwMatCache[key] = m;
      return m;
    }
function proRoadMesh(e) {
      const g = new THREE.Group();
      const W = e.width || RW_LANE_UNITS, len = Math.hypot(e.toX - e.x, e.toZ - e.z);
      const step = len > 200 ? 4 : 0.6;
      const done = e.surface === 'asphalt';
      const cur = done ? 'asphalt' : e.stage, prev = done ? null : e.prev, prog = done ? 1 : (e.prog ?? 1);
      const strip = (stage, from, to) => {
        const look = RW_STAGE_LOOK[stage];
        if (!look || to <= from) return;
        const geo = roadRibbon(e, W + look.wide, d => look.lift + (look.bumpy ? 0.03 + Math.sin(d * 5) * 0.025 : 0), step, d => d >= from * len - 1e-6 && d <= to * len + 1e-6);
        if (!geo) return;
        const m = new THREE.Mesh(geo, rwMat(stage, look));
        m.receiveShadow = true;
        g.add(m);
      };
      strip(cur, 0, prog);
      if (prev) strip(prev, prog, 1);
      // Drainage: the side ditches and the culvert with its headwalls
      if (e.ditches) [-1, 1].forEach(s => {
        const side = { ...e, x: e.x, z: e.z };
        const off = (W / 2 + 0.9) * s, dx = (e.toX - e.x) / (len || 1), dz = (e.toZ - e.z) / (len || 1);
        Object.assign(side, { x: e.x + dz * off, z: e.z - dx * off, toX: e.toX + dz * off, toZ: e.toZ - dx * off });
        const geo = roadRibbon(side, 0.9, () => 0.012, step);
        if (geo) g.add(new THREE.Mesh(geo, rwMat('ditch', { color: 0x3f2e1f, rough: 1 })));
      });
      if (e.culvert && !e.runway) {
        const c = rwAlong(e, e.culvert.d), ang = Math.atan2(e.toX - e.x, e.toZ - e.z);
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, W + 2.4, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6, side: THREE.DoubleSide }));
        pipe.rotation.set(0, ang, Math.PI / 2, 'YXZ');
        pipe.position.set(c.x, getIslandGroundHeight(c.x, c.z) + 0.1, c.z);
        g.add(pipe);
        if (e.headwalls) [-1, 1].forEach(s => {
          const p = rwAlong(e, e.culvert.d, s * (W / 2 + 1.25));
          const wall = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.3), typeof finishMaterial === 'function' ? finishMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), 'concrete') : new THREE.MeshStandardMaterial({ color: 0xc8c4bc }));
          wall.rotation.y = ang + Math.PI / 2;
          wall.position.set(p.x, getIslandGroundHeight(p.x, p.z) + 0.3, p.z);
          wall.castShadow = true;
          g.add(wall);
        });
      }
      // Survey stakes with orange flagging along both edges (gone once the base is down)
      const staked = ['staked', 'cleared', 'graded', 'subgrade'].includes(cur) || ['staked', 'cleared', 'graded', 'subgrade'].includes(prev);
      if (staked && typeof perfInstances === 'function') {
        const posts = [], flags = [];
        const reach = cur === 'staked' ? prog : 1;
        for (let d = 0; d <= len * reach; d += Math.max(4.8, len / 60)) {
          [-1, 1].forEach(s => {
            const p = rwAlong(e, d / (len || 1), s * (W / 2 + 0.35));
            const y = getIslandGroundHeight(p.x, p.z);
            const o = new THREE.Object3D(); o.position.set(p.x, y + 0.3, p.z); posts.push(o);
            const f = new THREE.Object3D(); f.position.set(p.x, y + 0.58, p.z); flags.push(f);
          });
        }
        if (posts.length) {
          g.add(perfInstances(new THREE.BoxGeometry(0.05, 0.6, 0.05), new THREE.MeshStandardMaterial({ color: 0xd6b98c, roughness: 0.9 }), posts, { castShadow: true }));
          g.add(perfInstances(new THREE.BoxGeometry(0.12, 0.06, 0.02), new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.6 }), flags));
        }
      }
      // Lines: a dashed yellow centre line and white edge lines (a road), or runway markings
      if (e.marked && !e.runway) {
        const lift = RW_STAGE_LOOK.asphalt.lift + 0.012;
        const dash = 3 * RW_UNITS_PER_M, gap = 6 * RW_UNITS_PER_M;
        const c = roadRibbon(e, 0.16, () => lift, 0.3, d => d % (dash + gap) < dash);
        if (c) g.add(new THREE.Mesh(c, rwMat('yellow', { color: 0xfacc15, rough: 0.7 })));
        [-1, 1].forEach(s => {
          const off = (W / 2 - 0.25) * s, dx = (e.toX - e.x) / (len || 1), dz = (e.toZ - e.z) / (len || 1);
          const side = { ...e, x: e.x + dz * off, z: e.z - dx * off, toX: e.toX + dz * off, toZ: e.toZ - dx * off };
          const geo = roadRibbon(side, 0.16, () => lift, 0.3);
          if (geo) g.add(new THREE.Mesh(geo, rwMat('white', { color: 0xf8fafc, rough: 0.7 })));
        });
      }
      if (e.runway && typeof runwayDressing === 'function') runwayDressing(e, g);
      return g;
    }
if (typeof roadMesh === 'function') {
  const rwOrigRoadMesh = roadMesh;
  roadMesh = function (e) { return e && e.pro ? proRoadMesh(e) : rwOrigRoadMesh(e); };
}

// --- Where his whims and the AI start roads: a real roadworks task instead of a quick gravel path ------
if (typeof shapeTheValleyOnMyOwn === 'function') {
  const rwOrigShape = shapeTheValleyOnMyOwn;
  shapeTheValleyOnMyOwn = function () {
      const open = agendaOpenTasks().some(t => t.kind === 'roadwork' && !t.data.runway);
      // An old hand-built gravel path he may now want rebuilt as a proper road
      const gravel = (state.worldEdits || []).find(e => e.type === 'road' && !e.pro && e.surface !== 'asphalt');
      if (!open && gravel && Math.random() < 0.25) return startRoadworks({ x: gravel.x, z: gravel.z }, { x: gravel.toX, z: gravel.toZ }, 'The gravel path keeps washing out. I want a real road there.', { replaces: gravel.id }) ? true : false;
      if (!open && Math.random() < 0.3) return startRoadworks(null, null, 'I keep driving this way, and it should have a proper road.') ? true : false;
      return rwOrigShape();
    };
}
if (typeof applyShapeDecision === 'function') {
  const rwOrigApplyShape = applyShapeDecision;
  applyShapeDecision = function (shape) {
      const act = shape && String(shape.action || '').toLowerCase();
      if (act === 'road' || act === 'pave') {
        const n = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
        const x = n(shape.x, state.botPos.x), z = n(shape.z, state.botPos.z);
        const old = act === 'pave' ? (state.worldEdits || []).find(e => e.type === 'road' && !e.pro && e.surface !== 'asphalt' && (!shape.id || e.id === shape.id)) : null;
        if (old) startRoadworks({ x: old.x, z: old.z }, { x: old.toX, z: old.toZ }, String(shape.why || '').slice(0, 160), { replaces: old.id });
        else startRoadworks({ x, z }, { x: n(shape.toX, x + 24), z: n(shape.toZ, z) }, String(shape.why || '').slice(0, 160));
        return;
      }
      return rwOrigApplyShape(shape);
    };
}
// The hand paving and the plant's own paving leave his proper roads alone
if (typeof unpavedRoad === 'function') unpavedRoad = function () { return (state.worldEdits || []).filter(e => e.type === 'road' && !e.pro && e.surface !== 'asphalt').pop() || null; };

function roadworksSummaryForAI() {
      const t = agendaOpenTasks().find(x => x.kind === 'roadwork');
      const stock = Object.keys(RW_SUPPLIES).filter(k => rwStock(k) > 0).map(k => `${rwFmt(k, rwStock(k))} ${RW_SUPPLIES[k].label}`);
      const gear = Object.keys(RW_GEAR).filter(k => rwGearOwned(k)).map(k => k);
      return `${t ? `${t.title}: step ${t.step + 1}/${rwStepList(t).length} ${rwStepName(t)}` : 'no road job open'}${typeof runwayFieldReady === 'function' && runwayFieldReady() && !agendaOpenTasks().some(x => x.kind === 'roadwork' && x.data.runway) ? '; the runway field is ready for a runway (shape action "runway" starts that job: research first, then the parts list)' : ''}; machines: ${gear.join(', ') || 'none'}; stock: ${stock.join(', ') || 'none'}`;
    }

setInterval(() => { try { if (rwAbsorbSupplies()) savePersistentBrainState(); } catch (e) {} }, 10000);

// --- The runway (task 7b's RUNWAY_FIELD, added on another branch) ---------------------------------------
// One long agenda task: the same crew work as a road, done a section at a time along the strip, then
// aviation markings (white: threshold "piano keys", runway numbers, dashed centre line, aiming points,
// edge lines), edge lights, green/red threshold lights, designation signs and a windsock. Dormant until
// RUNWAY_FIELD exists; it only works the field while a step runs (runwayJobActive, js/landscape.js).
const RWY_SECTIONS = 8;
const RWY_SECTIONED = new Set(['survey', 'clear', 'grade', 'drain', 'subgrade', 'base', 'compactbase', 'prime', 'pave', 'roll', 'stripe', 'lights']);
const RWY_STEPS = [
  ['research', 'Research how a runway is built'], ['order', 'Send the runway parts list'], ['survey', 'Survey and stake the strip'], ['clear', 'Clear and grub the strip (bulldozer)'],
  ['grade', 'Grade to a gentle cross-fall (motor grader)'], ['drain', 'Side drains and culverts'], ['subgrade', 'Compact the subgrade'], ['base', 'Deep aggregate base'],
  ['compactbase', 'Compact the base'], ['prime', 'Prime coat'], ['pave', 'Pave in lanes with my own hot mix'], ['roll', 'Finish rolling'], ['cure', 'Let it cool and cure'],
  ['stripe', 'Runway markings (threshold, numbers, centre line)'], ['lights', 'Edge lights, threshold lights, signs and windsock']
];
function runwayFieldReady() {
      return typeof RUNWAY_FIELD !== 'undefined' && RUNWAY_FIELD && typeof RUNWAY_FIELD === 'object' && !RUNWAY_FIELD.developed
        && [RUNWAY_FIELD.minX, RUNWAY_FIELD.maxX, RUNWAY_FIELD.minZ, RUNWAY_FIELD.maxZ].every(Number.isFinite);
    }
// The strip: along the field's long axis on its centre line, a margin at each end, 45 m wide (or less on a small field)
function runwayStripGeometry() {
      const F = RUNWAY_FIELD, upm = F.unitsPerMetre || RW_UNITS_PER_M;
      const pt = (along, across) => (typeof runwayFieldPoint === 'function' ? runwayFieldPoint(along, across)
        : { x: (F.centerX ?? (F.minX + F.maxX) / 2) + across * (F.maxX - F.minX) / 2, z: F.maxZ - along * (F.maxZ - F.minZ) });
      const lenU = F.maxZ - F.minZ, margin = Math.min(100 * upm, lenU * 0.05);
      const a = pt(margin / lenU, 0), b = pt(1 - margin / lenU, 0);
      const width = Math.min(45 * upm, (F.maxX - F.minX) * 0.45);
      return { x: a.x, z: a.z, toX: b.x, toZ: b.z, width };
    }
// Runway numbers from the strip's heading (magnetic, to the nearest 10°: 16/34 for a north-south strip near Kelowna)
function runwayNumbers(e) {
      const hdg = (Math.atan2(e.toX - e.x, -(e.toZ - e.z)) * 180 / Math.PI + 360 - 15) % 360;   // magnetic = true - Kelowna's ~15° east variation
      const n = Math.round(hdg / 10) % 36 || 36, back = (n + 18) % 36 || 36;
      const two = v => String(v).padStart(2, '0');
      return [two(n), two(back)];
    }
function startRunwayJob(why = '') {
      if (!runwayFieldReady()) return null;
      const open = agendaOpenTasks().find(t => t.kind === 'roadwork' && t.data.runway);
      if (open) return open;
      const g = runwayStripGeometry();
      const data = { ...g, runway: true, sec: 0 };
      const size = rwJobSize(data);
      const [n1, n2] = runwayNumbers(g);
      const t = agendaAdd({ ref: 'runway', kind: 'roadwork', title: `Build runway ${n1}/${n2} (${Math.round(size.lenM)} m)`, emoji: '🛫', why: why || 'A real paved runway on the field, for my airplane', priority: 4,
        steps: RWY_STEPS.map(s => s[1]), step: jobKnown('runway') ? 1 : 0, data });
      state.speechBubble = `The runway field is waiting. Before I touch it I'll read how a runway is really built, and work out everything it takes.`;
      renderAllUI();
      return t;
    }
async function rwyBaseSection(t) {
      const J = t.data, e = rwEdit(t), need = rwNeeds(J);
      const [f0, f1] = rwSecRange(t), share = need.base / RWY_SECTIONS;
      const truck = rwGearOwned('truck');
      rwSay(t, `${t.title}: base course, section ${(J.sec || 0) + 1} of ${RWY_SECTIONS}`, `${Math.round(share).toLocaleString()} t of crushed base for this section: the bulk loads are tipped along the strip, and I haul from my stockpile to fill in.`);
      await driveVehicle(truck, rwStockpileSpot(), 'Loading crushed base at the stockpile');
      await driveVehicle(truck, rwAlong(e, f0, -J.width * 0.3), 'Hauling crushed base to the runway');
      await rwTipTruck(truck);
      rwUse('base', share); rwUsedFor(J, 'base', share);
      rwSetStage(e, 'loose', f1);
      return rwPass(t, 'grader', 'raked', 'Spreading the base in lifts and trimming it to the stakes.');
    }
async function rwyPaveSection(t) {
      const J = t.data, e = rwEdit(t), need = rwNeeds(J);
      const [f0, f1] = rwSecRange(t), share = need.hma / RWY_SECTIONS;
      // A real batch from his plant starts the shift; the rest of the section's mix runs through it on the bulk feeds
      if (!hasItem(/hot.?mix asphalt/i)) {
        const r = await rwFreeFor(() => runAsphaltPlant(`Production shift for runway section ${(J.sec || 0) + 1}.`, 'Hot Mix for the Runway'));
        if (r !== true) return r;
      }
      ['rwycoarse', 'rwyfine', 'rwybinder'].forEach(k => { const a = rwShare(J, need, k); rwUse(k, a); rwUsedFor(J, k, a); });
      const truck = rwGearOwned('truck'), paver = rwGearOwned('paver'), roller = rwGearOwned('tandemroller');
      rwSay(t, `${t.title}: paving section ${(J.sec || 0) + 1} of ${RWY_SECTIONS}`, `${Math.round(share).toLocaleString()} t of hot mix for this section, in lanes, the trucks shuttling from my plant to the paver.`);
      await driveVehicle(paver, rwAlong(e, f0), 'Setting the paver at the joint');
      await driveVehicle(truck, rwAlong(e, Math.max(0, f0 - 0.01), -0.3), 'Hauling hot mix from my plant to the paver');
      await rwTipTruck(truck);
      const name = hotMixName && hotMixName();
      if (name) useUpItem(name, 1, { quiet: true, why: 'paving the runway' });
      if (typeof plantReconcileLoads === 'function') plantReconcileLoads();
      const stop = rwWatch(e, 'hot', f0, f1);
      try { await driveVehicle(paver, rwAlong(e, f1), 'Laying the runway mat'); } finally { stop(); }
      if (roller) { await driveVehicle(roller, rwAlong(e, f0), 'Breakdown rolling behind the paver'); await driveVehicle(roller, rwAlong(e, f1), 'Breakdown rolling'); }
      J.hmaDone = (J.hmaDone || 0) + share;
      if (RW_GEAR.paver.skill) gainSkill(RW_GEAR.paver.skill[0], RW_GEAR.paver.skill[1], 5);
      if ((J.sec || 0) + 1 >= RWY_SECTIONS) J.pavedAt = Date.now();
      return true;
    }
RW_STEP_RUN.lights = async function (t) {
      const J = t.data, e = rwEdit(t), need = rwNeeds(J);
      const [f0, f1] = rwSecRange(t);
      const truck = rwGearOwned('truck');
      rwSay(t, `${t.title}: lights, section ${(J.sec || 0) + 1} of ${RWY_SECTIONS}`, 'Elevated white edge lights every 60 m along both edges, set just outside the pavement and wired in.');
      if (truck) await driveVehicle(truck, rwAlong(e, f0, J.width / 2 + 4), 'Bringing the lights out on the truck');
      state.targetPos = rwAlong(e, f1, J.width / 2 + 2);
      await waitForArrival(90000);
      ['edgelight'].forEach(k => { const a = rwShare(J, need, k); rwUse(k, a); rwUsedFor(J, k, a); });
      e.litTo = f1;
      if ((J.sec || 0) + 1 >= RWY_SECTIONS) {
        ['thrlight', 'rwysign', 'windsock'].forEach(k => { rwUse(k, need[k]); rwUsedFor(J, k, need[k]); });
        e.lit = true;
        state.speechBubble = 'Green threshold lights at each end, the signs, and the windsock where pilots can see it. Done!';
      }
      rwRender(e);
      return true;
    };

// Runway markings and lights on his runway edit (called from proRoadMesh)
function runwayDressing(e, g) {
      const W = e.width, len = Math.hypot(e.toX - e.x, e.toZ - e.z), upm = RW_UNITS_PER_M;
      const lift = RW_STAGE_LOOK.asphalt.lift + 0.015, white = rwMat('white', { color: 0xf8fafc, rough: 0.7 });
      const ang = Math.atan2(e.toX - e.x, e.toZ - e.z);
      const quad = (along, across, l, w, mat = white) => {
        // A flat marking `l` long (along the runway) and `w` wide, centred at (along, across) in world units
        const p = rwAlong(e, along / len, across);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat);
        m.rotation.order = 'YXZ'; m.rotation.y = ang; m.rotation.x = -Math.PI / 2;
        m.position.set(p.x, getIslandGroundHeight(p.x, p.z) + lift, p.z);
        g.add(m);
      };
      const markTo = e.marked || e.surface === 'asphalt' && e.lit ? 1 : (e.markedTo || 0);
      if (markTo > 0) {
        const reach = markTo * len;
        // Edge lines and the dashed centre line (30 m stripes, 20 m gaps)
        [-1, 1].forEach(s => { for (let d = 0; d < reach; d += 60 * upm) { const end = Math.min(reach, d + 60 * upm); quad((d + end) / 2, s * (W / 2 - 1.5 * upm), end - d, 0.9 * upm); } });
        for (let d = 150 * upm; d < Math.min(reach, len - 150 * upm); d += 50 * upm) quad(d + 15 * upm, 0, 30 * upm, 0.9 * upm);
        // Threshold piano keys and the numbers at each end, aiming points 400 m in
        const [n1, n2] = runwayNumbers(e);
        [[0, 1, n1], [len, -1, n2]].forEach(([d0, dir, num]) => {
          if (dir > 0 ? reach < 80 * upm : reach < len) return;
          for (let k = 0; k < 8; k++) [-1, 1].forEach(s => quad(d0 + dir * 30 * upm, s * (W * 0.08 + k * W * 0.05), 30 * upm, 1.8 * upm));
          runwayDigits(num, d0 + dir * 80 * upm, dir, quad, upm);
          [-1, 1].forEach(s => quad(d0 + dir * 400 * upm, s * W * 0.2, 45 * upm, 6 * upm));
        });
      }
      const litTo = e.lit ? 1 : (e.litTo || 0);
      if (litTo > 0 && typeof perfInstances === 'function') {
        const edge = [], ends = [];
        for (let d = 0; d <= litTo * len + 1e-6; d += 60 * upm) [-1, 1].forEach(s => {
          const p = rwAlong(e, d / len, s * (W / 2 + 1.5 * upm)), o = new THREE.Object3D();
          o.position.set(p.x, getIslandGroundHeight(p.x, p.z) + 0.25, p.z); edge.push(o);
        });
        g.add(perfInstances(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0xfffbeb, emissive: 0xfef9c3, emissiveIntensity: 0.9 }), edge));
        if (e.lit) {
          [0, len].forEach(d0 => { for (let k = -3.5; k <= 3.5; k += 1) { const p = rwAlong(e, d0 / len, k * W / 8), o = new THREE.Object3D(); o.position.set(p.x, getIslandGroundHeight(p.x, p.z) + 0.2, p.z); ends.push(o); } });
          g.add(perfInstances(new THREE.BoxGeometry(0.3, 0.25, 0.3), new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 1.0 }), ends));
          // The windsock beside the south threshold, and a designation sign at each end
          const w = rwAlong(e, 120 * upm / len, -(W / 2 + 25 * upm)), wy = getIslandGroundHeight(w.x, w.z);
          const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 5.5, 10), new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.6 }));
          mast.position.set(w.x, wy + 2.75, w.z); g.add(mast);
          const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.12, 2.4, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0xf97316, side: THREE.DoubleSide, roughness: 0.8 }));
          sock.rotation.z = Math.PI / 2 - 0.25; sock.position.set(w.x + 1.2, wy + 5.2, w.z); g.add(sock);
          [[0, runwayNumbers(e).join('-')], [len, runwayNumbers(e).reverse().join('-')]].forEach(([d0]) => {
            const p = rwAlong(e, Math.min(1, Math.max(0, (d0 + (d0 ? -1 : 1) * 40 * upm) / len)), W / 2 + 8 * upm);
            const sign = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.2), new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0x7f1d1d, emissiveIntensity: 0.4 }));
            sign.position.set(p.x, getIslandGroundHeight(p.x, p.z) + 0.7, p.z); sign.rotation.y = ang; g.add(sign);
          });
        }
      }
    }
// Big runway numbers painted from bars (a seven-segment style digit 18 m tall, 6 m wide)
const RWY_DIGIT_SEGS = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
function runwayDigits(num, d, dir, quad, upm) {
      const H = 18 * upm, Wd = 6 * upm, bar = 1.5 * upm;
      String(num).split('').forEach((ch, i) => {
        const cx = (i === 0 ? -1 : 1) * 5 * upm * dir;   // across
        const segs = RWY_DIGIT_SEGS[ch] || '';
        const along = (f) => d + dir * f * H;              // 0 bottom (nearest the threshold) .. 1 top
        const S = { a: [1, 0, Wd, bar], g: [0.5, 0, Wd, bar], d: [0, 0, Wd, bar], f: [0.75, -Wd / 2, bar, H / 2], b: [0.75, Wd / 2, bar, H / 2], e: [0.25, -Wd / 2, bar, H / 2], c: [0.25, Wd / 2, bar, H / 2] };
        segs.split('').forEach(k => { const [f, x, w, l] = S[k]; quad(along(f), cx + x * dir, k === 'a' || k === 'g' || k === 'd' ? bar : l, k === 'a' || k === 'g' || k === 'd' ? w : bar); });
      });
    }

// The field is reserved: rendering the runway's own geometry may sample it
if (typeof proRoadMesh === 'function') {
  const rwOrigProMesh = proRoadMesh;
  proRoadMesh = function (e) {
      if (!e || !e.runway || typeof runwayJobActive === 'undefined') return rwOrigProMesh(e);
      const was = runwayJobActive;
      runwayJobActive = true;
      try { return rwOrigProMesh(e); } finally { runwayJobActive = was; }
    };
}
// The AI's "runway" shape action, and now and then his own wish, once the field exists
if (typeof applyShapeDecision === 'function') {
  const rwOrigApplyShape2 = applyShapeDecision;
  applyShapeDecision = function (shape) {
      if (shape && /runway/i.test(String(shape.action || ''))) { startRunwayJob(String(shape.why || '').slice(0, 160)); return; }
      return rwOrigApplyShape2(shape);
    };
}
setInterval(() => {
  try {
    if (!runwayFieldReady() || agendaOpenTasks().some(t => t.kind === 'roadwork' && t.data.runway)) return;
    // Once he has an airplane or has built a road properly, the empty field starts to call to him
    const plane = (state.buildProjects || []).some(p => p.bom && p.bom.vehicle === 'plane');
    const roads = (state.worldEdits || []).some(e => e.pro && !e.runway && e.surface === 'asphalt');
    if ((plane || roads) && Math.random() < 0.02) startRunwayJob(plane ? 'My airplane deserves a real runway.' : 'I know how to build a road properly now. A runway is the same craft, only bigger.');
  } catch (e) {}
}, 60000);
