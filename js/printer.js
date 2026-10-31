// Kelo-bot-1 — js/printer.js
// Loaded after shopkeeping.js. His 3D printer. His human gives it to him, but he still has to work it
// out for himself:
//   - it arrives in a parcel; he carries it to a bench beside the Welding Studio and sets it up
//   - he reads up on 3D printing at the NetNode cafe before his first print (GEAR_KNOWHOW in knowhow.js)
//   - it needs filament: spools ("A spool of PLA filament", PETG, TPU...) that he asks visitors for.
//     Each spool holds grams; every print uses some, and a spool can run out halfway through a print
//   - his first prints fail the way real ones do (the print comes loose from the bed, a mess of
//     spaghetti, a clogged nozzle). Each failure teaches him a fix, and his printing skill rises
//   - finished prints are his things (category 'printed', kept in the Storehouse, sellable in his
//     shop); art prints go to his Museum
// You can watch every print grow on the bed layer by layer, in the colour of the loaded filament.

const PRINTER_RE = /\b3-?d printer\b/i;
const FILAMENT_RE = /filament/i;
const SPOOL_GRAMS = 1000;
// The bench beside the Welding Studio, out of the way of the path (scene.js builds the studio at -1.2, -8.2), between it and his house
const PRINTER_SPOT = { x: -3.9, z: -8.6 };
const PRINTER_STAND = { x: -3.9, z: -7.35 };
const PRINTER_SCALE = 1.6; // the bench and printer are modelled in metres, shown at life size (ITEM_LIFE_SCALE)
// How long a print takes on screen (tests may shorten it)
const PRINT_TIME = { perGram: 260, min: 9000, max: 42000, hold: 4000 };

// What each failure looks like, and the fix it teaches him
const PRINT_FAILURES = {
  adhesion: {
    what: 'came loose from the bed and got dragged around by the nozzle',
    lesson: 'level the bed with a sheet of paper and wipe it clean, so the first layer sticks',
    fixTitle: 'Levelling the print bed', fixSpeech: 'A sheet of paper under the nozzle, a little scrape at each corner... now the bed is level.'
  },
  spaghetti: {
    what: 'turned into a tangle of spaghetti in mid-air',
    lesson: 'print the first layer slowly and add supports under anything that hangs out over nothing',
    fixTitle: 'Adding supports to his designs', fixSpeech: 'Plastic can\'t be printed onto thin air. It needs something underneath it.'
  },
  clog: {
    what: 'stopped coming out of the nozzle partway up. The nozzle was clogged',
    lesson: 'heat the nozzle and push a cleaning needle through it, and keep the filament dry and dust-free',
    fixTitle: 'Unclogging the nozzle', fixSpeech: 'Heat it up, needle through, a little push of filament... it flows again!'
  }
};

// Things worth printing: [key, name, grams, builder]. Small and useful first, then fun.
const PRINTABLES = [
  { key: 'tugboat', name: 'A 3D-printed little tugboat', grams: 14, build: () => printedTugboat() },
  { key: 'hook', name: 'A 3D-printed wall hook', grams: 9, build: () => printedHook() },
  { key: 'vase', name: 'A 3D-printed spiral vase', grams: 38, build: () => printedVase() },
  { key: 'gear', name: 'A 3D-printed gear', grams: 18, build: () => printedGear() },
  { key: 'robot', name: 'A 3D-printed figurine of himself', grams: 30, build: () => printedRobot() },
  { key: 'pot', name: 'A 3D-printed pencil cup', grams: 45, build: () => printedCup() },
  { key: 'star', name: 'A 3D-printed star ornament', grams: 7, build: () => printedStar() },
  { key: 'stand', name: 'A 3D-printed phone stand', grams: 26, build: () => printedStand() },
  { key: 'whistle', name: 'A 3D-printed whistle', grams: 6, build: () => printedWhistle() },
  { key: 'planter', name: 'A 3D-printed planter for a seedling', grams: 70, build: () => printedCup(true) }
];

const FILAMENT_COLORS = { red: '#dc2626', blue: '#2563eb', green: '#16a34a', white: '#f1f5f9', black: '#1f2937', orange: '#f97316',
  yellow: '#facc15', purple: '#9333ea', pink: '#ec4899', grey: '#9ca3af', gray: '#9ca3af', silver: '#cbd5e1', gold: '#d4a017', teal: '#0d9488' };
const MATERIAL_COLORS = { PLA: '#f97316', PETG: '#38bdf8', TPU: '#1f2937', ABS: '#f1f5f9' };

let printerGroup = null;
let printJob = null; // what's on the bed right now (only while printing)

// --- State -------------------------------------------------------------------------------------
function printerState() {
      if (!state.printer || typeof state.printer !== 'object') state.printer = {};
      const p = state.printer;
      if (!Number.isFinite(p.skill)) p.skill = 0;
      if (!Array.isArray(p.spools)) p.spools = [];
      if (!p.lessons || typeof p.lessons !== 'object') p.lessons = {};
      if (!Array.isArray(p.history)) p.history = [];
      if (!p.designs || typeof p.designs !== 'object') p.designs = {};
      if (!Number.isFinite(p.prints)) p.prints = 0;
      if (!Number.isFinite(p.fails)) p.fails = 0;
      return p;
    }

function allOwnedNames() {
      return [...state.toolInventory, ...state.toys.map(t => t.name), ...state.belongings.map(b => b.name)].filter(Boolean);
    }

function printerName() {
      return allOwnedNames().find(n => PRINTER_RE.test(n)) || null;
    }

function isPrinterName(name) {
      return PRINTER_RE.test(String(name || ''));
    }

// Supplies he keeps even when he has more than one (the Disposal Pit and his shop leave them alone)
function isPrinterSupply(name) {
      return FILAMENT_RE.test(String(name || '')) || isPrinterName(name);
    }

// The machine sits on its bench, not on a Storehouse shelf
function isSetUpMachine(name) {
      return isPrinterName(name) && Boolean(printerState().setUp);
    }

// --- Filament spools ---------------------------------------------------------------------------
function filamentMaterial(name) {
      const m = String(name || '').match(/\b(PLA|PETG|TPU|ABS|ASA|nylon)\b/i);
      return m ? m[1].toUpperCase() : 'PLA';
    }

function filamentColor(name) {
      const lower = String(name || '').toLowerCase();
      const word = Object.keys(FILAMENT_COLORS).find(w => new RegExp(`\\b${w}\\b`).test(lower));
      return word ? FILAMENT_COLORS[word] : (MATERIAL_COLORS[filamentMaterial(name)] || '#f97316');
    }

// Spools whose item went missing (thrown away, sold...) are forgotten too
function pruneSpools() {
      const p = printerState();
      const counts = {};
      allOwnedNames().forEach(n => { counts[n] = (counts[n] || 0) + 1; });
      p.spools = p.spools.filter(s => (counts[s.name] = (counts[s.name] || 0) - 1) >= 0 && s.grams > 0);
      if (p.loadedSpoolId && !p.spools.some(s => s.id === p.loadedSpoolId)) p.loadedSpoolId = null;
      // Spool items he owns that aren't tracked yet (from an older save) start full
      Object.entries(counts).forEach(([name, left]) => {
        for (let i = 0; i < left && FILAMENT_RE.test(name); i++) addSpool(name);
      });
    }

function addSpool(name) {
      const p = printerState();
      const spool = { id: 'spool-' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), name, material: filamentMaterial(name), color: filamentColor(name), grams: SPOOL_GRAMS };
      p.spools.push(spool);
      return spool;
    }

function loadedSpool() {
      const p = printerState();
      return p.spools.find(s => s.id === p.loadedSpoolId && s.grams > 0) || null;
    }

function totalFilament() {
      return printerState().spools.reduce((sum, s) => sum + Math.max(0, s.grams), 0);
    }

function filamentRequested() {
      return state.requestsToUser.some(r => !r.fulfilled && FILAMENT_RE.test(r.requestedGear || '')) || state.mailbox.some(m => FILAMENT_RE.test(m.name || ''));
    }

function requestFilament(why, material = 'PLA') {
      if (filamentRequested()) return false;
      const ask = material === 'PLA' ? 'A spool of PLA filament' : `A spool of ${material} filament`;
      addItemRequest(ask, 'material', why, 'My 3D printer');
      showToast(`🧵 Kelo-1 asked for ${ask.toLowerCase()}`);
      return true;
    }

// An empty spool comes off the printer and goes in the recycling (gone from his things)
function finishSpool(spool) {
      const p = printerState();
      p.spools = p.spools.filter(s => s.id !== spool.id);
      if (p.loadedSpoolId === spool.id) p.loadedSpoolId = null;
      if (typeof forgetItem === 'function') forgetItem(spool.name);
    }

// Put a spool on the holder (the one for this material if he has it)
function loadSpool(material = null) {
      const p = printerState();
      const cur = loadedSpool();
      if (cur && (!material || cur.material === material)) return cur;
      const pickFrom = p.spools.filter(s => s.grams > 0);
      const next = (material && pickFrom.find(s => s.material === material)) || cur || pickFrom[0] || null;
      p.loadedSpoolId = next ? next.id : null;
      refreshPrinterSpool();
      return next;
    }

// --- Models ------------------------------------------------------------------------------------
function spoolModel(color = '#f97316', fill = 1) {
      const g = group();
      const hub = mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.066, 16), 0x111827);
      const r = 0.045 + 0.05 * Math.max(0.05, Math.min(1, fill));
      const wound = mesh(new THREE.CylinderGeometry(r, r, 0.058, 28), new THREE.Color(color).getHex(), { roughness: 0.35 });
      wound.userData.filament = true;
      [-0.034, 0.034].forEach(y => g.add(at(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.005, 28), 0x1f2937, { transparent: true, opacity: 0.85 }), 0, y, 0)));
      g.add(hub, wound);
      g.rotation.z = Math.PI / 2; // lying on its side, axle along x
      const holder = group(g);
      g.position.y = 0.1;
      return holder;
    }

// A desktop "bed slinger" printer: the bed slides front to back, the head left to right, the
// gantry climbs as the layers build up. userData.bed / gantry / head / spool are moved while printing.
function printerModel(color = '#f97316') {
      const dark = 0x1f2937, alu = { metalness: 0.7, roughness: 0.35 };
      const base = mesh(new THREE.BoxGeometry(0.42, 0.05, 0.4), dark);
      const railL = mesh(new THREE.BoxGeometry(0.02, 0.02, 0.38), 0x94a3b8, alu);
      const railR = railL.clone();
      const bed = group();
      const plate = mesh(new THREE.BoxGeometry(0.25, 0.008, 0.25), 0x334155, { metalness: 0.5 });
      const sheet = mesh(new THREE.BoxGeometry(0.235, 0.003, 0.235), 0xc8a24a, { metalness: 0.4, roughness: 0.6 });
      bed.add(at(plate, 0, 0.004, 0), at(sheet, 0, 0.0095, 0));
      bed.position.y = 0.07;
      bed.userData.top = 0.011;
      const uprightL = mesh(new THREE.BoxGeometry(0.03, 0.43, 0.04), dark);
      const uprightR = uprightL.clone();
      const topBar = mesh(new THREE.BoxGeometry(0.43, 0.03, 0.04), dark);
      const leadL = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.4, 6), 0xcbd5e1, alu);
      const leadR = leadL.clone();
      // The gantry: two rods and the print head with its fan, heater block and nozzle
      const gantry = group();
      [-0.012, 0.012].forEach(y => gantry.add(at(rod([-0.19, y, 0.035], [0.19, y, 0.035], 0.004, 0xe2e8f0, alu), 0, 0, 0)));
      const head = group();
      const body = mesh(new THREE.BoxGeometry(0.055, 0.06, 0.05), new THREE.Color(color).getHex());
      const fan = mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.004, 16), 0x0f172a);
      fan.rotation.x = Math.PI / 2;
      const block = mesh(new THREE.BoxGeometry(0.02, 0.012, 0.02), 0xcbd5e1, alu);
      const nozzle = mesh(new THREE.ConeGeometry(0.006, 0.012, 10), 0xd4a017, { metalness: 0.9, roughness: 0.2 });
      nozzle.rotation.x = Math.PI;
      head.add(at(body, 0, 0.0, 0.035), at(fan, 0, 0.0, 0.062), at(block, 0, -0.036, 0.035), at(nozzle, 0, -0.048, 0.035));
      gantry.add(head);
      // The screen and knob at the front
      const box = mesh(new THREE.BoxGeometry(0.11, 0.05, 0.03), dark);
      const screen = mesh(new THREE.PlaneGeometry(0.06, 0.03), 0x38bdf8, { emissive: 0x0ea5e9, emissiveIntensity: 0.7 });
      const knob = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.01, 12), 0x94a3b8, alu);
      knob.rotation.x = Math.PI / 2;
      // The spool holder on top
      const arm = rod([0, 0.47, -0.02], [0, 0.55, -0.06], 0.006, 0x475569);
      const axle = rod([-0.05, 0.55, -0.06], [0.05, 0.55, -0.06], 0.005, 0x94a3b8, alu);
      const spool = group();
      spool.position.set(0, 0.45, -0.06);
      const printer = group(at(base, 0, 0.025, 0), at(railL, -0.07, 0.06, 0), at(railR, 0.07, 0.06, 0), bed,
        at(uprightL, -0.2, 0.265, -0.03), at(uprightR, 0.2, 0.265, -0.03), at(topBar, 0, 0.48, -0.03),
        at(leadL, -0.175, 0.26, -0.03), at(leadR, 0.175, 0.26, -0.03), gantry,
        at(box, 0.13, 0.04, 0.215), at(screen, 0.12, 0.04, 0.231), at(knob, 0.17, 0.04, 0.233), arm, axle, spool);
      gantry.position.set(0, 0.07 + bed.userData.top + 0.048 + 0.03, -0.03);
      Object.assign(printer.userData, { bed, gantry, head, spool, nozzleDrop: 0.048 });
      return printer;
    }

// The printer on its workbench, as it stands beside the Welding Studio
function printerStationModel() {
      const wood = 0x8a5a2b;
      const top = mesh(new THREE.BoxGeometry(1.0, 0.04, 0.6), wood, { roughness: 0.85 });
      const legs = [[-0.46, -0.26], [0.46, -0.26], [-0.46, 0.26], [0.46, 0.26]].map(([x, z]) => at(mesh(new THREE.BoxGeometry(0.05, 0.73, 0.05), 0x6b4423), x, 0.365, z));
      const shelf = mesh(new THREE.BoxGeometry(0.94, 0.02, 0.52), 0x6b4423);
      const printer = printerModel();
      printer.position.set(-0.12, 0.77, -0.02);
      // A scraper and a pot of glue stick lie beside it
      const scraper = group(at(mesh(new THREE.BoxGeometry(0.1, 0.006, 0.04), 0xcbd5e1, { metalness: 0.8 }), 0.05, 0, 0), at(mesh(new THREE.BoxGeometry(0.08, 0.015, 0.025), 0x111827), -0.04, 0.004, 0));
      const glue = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.09, 12), 0x7c3aed);
      const station = group(at(top, 0, 0.75, 0), ...legs, at(shelf, 0, 0.18, 0), printer, at(scraper, 0.33, 0.775, 0.12), at(glue, 0.38, 0.815, -0.12));
      // Finished prints wait on the right-hand end of the bench until he puts them away
      station.userData.printer = printer;
      return station;
    }

// --- Printed things (all built in metres, sitting on y = 0) -------------------------------------
function printedTugboat() {
      const hull = new THREE.Shape();
      hull.moveTo(-0.03, 0); hull.lineTo(0.025, 0); hull.quadraticCurveTo(0.045, 0.008, 0.04, 0.022); hull.lineTo(-0.04, 0.022); hull.lineTo(-0.035, 0.004);
      const hullGeo = new THREE.ExtrudeGeometry(hull, { depth: 0.03, bevelEnabled: false });
      hullGeo.translate(0, 0, -0.015);
      const cabin = mesh(new THREE.BoxGeometry(0.028, 0.02, 0.024), 0xffffff);
      const roof = mesh(new THREE.BoxGeometry(0.034, 0.004, 0.028), 0xffffff);
      const stack = mesh(new THREE.CylinderGeometry(0.006, 0.007, 0.018, 10), 0xffffff);
      return group(mesh(hullGeo, 0xffffff), at(cabin, -0.006, 0.032, 0), at(roof, -0.006, 0.044, 0), at(stack, 0.01, 0.052, 0));
    }

function printedHook() {
      const plate = mesh(new THREE.BoxGeometry(0.03, 0.06, 0.006), 0xffffff);
      const hook = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, 0.025, 0.003], [0, 0.02, 0.02], [0, 0.008, 0.03], [0, 0.002, 0.024], [0, 0.008, 0.016]].map(p => new THREE.Vector3(...p))), 20, 0.004, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      return group(at(plate, 0, 0.03, 0), hook);
    }

function printedVase() {
      const pts = [[0.001, 0], [0.03, 0], [0.04, 0.03], [0.034, 0.07], [0.022, 0.1], [0.026, 0.12]].map(([r, y]) => new THREE.Vector2(r, y));
      const v = mesh(new THREE.LatheGeometry(pts, 12), 0xffffff, { side: THREE.DoubleSide });
      v.rotation.y = 0.3;
      return group(v);
    }

function printedGear() {
      const teeth = 12, ro = 0.04, ri = 0.033;
      const s = new THREE.Shape();
      for (let i = 0; i < teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2, r = i % 2 ? ri : ro;
        const a2 = a + Math.PI / (teeth * 2);
        if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        s.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
      }
      s.holes.push(circlePath(0, 0, 0.008));
      const geo = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false });
      const m = mesh(geo, 0xffffff);
      m.rotation.x = -Math.PI / 2;
      return group(m);
    }

function printedRobot() {
      const legs = [-0.009, 0.009].map(x => at(mesh(new THREE.BoxGeometry(0.01, 0.025, 0.012), 0xffffff), x, 0.0125, 0));
      const body = mesh(new THREE.BoxGeometry(0.036, 0.04, 0.024), 0xffffff);
      const head = mesh(new THREE.BoxGeometry(0.03, 0.026, 0.026), 0xffffff);
      const antenna = mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.012, 6), 0xffffff);
      const ball = mesh(new THREE.SphereGeometry(0.004, 8, 6), 0xffffff);
      const arms = [-0.023, 0.023].map(x => at(mesh(new THREE.BoxGeometry(0.008, 0.03, 0.01), 0xffffff), x, 0.042, 0));
      return group(...legs, at(body, 0, 0.045, 0), ...arms, at(head, 0, 0.078, 0), at(antenna, 0, 0.097, 0), at(ball, 0, 0.104, 0));
    }

function printedCup(planter = false) {
      const r = planter ? 0.05 : 0.035, h = planter ? 0.075 : 0.09;
      const pts = [[0.001, 0], [r * 0.85, 0], [r, h], [r - 0.004, h], [r * 0.85 - 0.004, 0.004], [0.001, 0.004]].map(([a, b]) => new THREE.Vector2(a, b));
      return group(mesh(new THREE.LatheGeometry(pts, planter ? 6 : 24), 0xffffff, { side: THREE.DoubleSide }));
    }

function printedStar() {
      const s = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const a = Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 0.016 : 0.035;
        if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      s.holes.push(circlePath(0, 0.026, 0.003));
      const m = mesh(new THREE.ExtrudeGeometry(s, { depth: 0.005, bevelEnabled: false }), 0xffffff);
      m.rotation.x = -Math.PI / 2;
      return group(m);
    }

function printedStand() {
      const m = slab([[0, 0], [0.07, 0], [0.07, 0.006], [0.02, 0.006], [0.03, 0.02], [0.012, 0.075], [0.004, 0.075], [0.012, 0.02]], 0.06, 0xffffff);
      m.position.x = -0.035;
      return group(m);
    }

function printedWhistle() {
      const tube = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.05, 14), 0xffffff);
      tube.rotation.z = Math.PI / 2;
      const ring = mesh(new THREE.TorusGeometry(0.007, 0.002, 6, 14), 0xffffff);
      return group(at(tube, 0, 0.009, 0), at(ring, -0.032, 0.009, 0));
    }

// Any design (a shape from his library, a form for a word) shrunk to a print that fits the bed
function printedDesign(parts, color) {
      if (typeof buildCreationGroup !== 'function' || !parts) return printedRobot();
      return buildCreationGroup({ archetype: 'custom_weld', colorHex: color, secondaryColorHex: color, parts });
    }

// Shrink or grow a model so its biggest side is `size` metres, centred and standing on y = 0
function modelMaxSize(model) {
      const dims = new THREE.Vector3();
      new THREE.Box3().setFromObject(model).getSize(dims);
      return Math.max(dims.x, dims.y, dims.z) || 0.1;
    }

function fitPrint(model, size) {
      const holder = group(model);
      const box = new THREE.Box3().setFromObject(holder);
      const dims = new THREE.Vector3();
      box.getSize(dims);
      const s = size / (Math.max(dims.x, dims.y, dims.z) || 1);
      model.scale.multiplyScalar(s);
      const box2 = new THREE.Box3().setFromObject(holder);
      const c = new THREE.Vector3();
      box2.getCenter(c);
      model.position.x -= c.x;
      model.position.z -= c.z;
      model.position.y -= box2.min.y;
      return holder;
    }

// Every mesh in the filament's colour (a print is all one colour, like the real thing)
function paintPrint(model, color, clipPlane = null) {
      model.traverse(o => {
        if (!o.isMesh) return;
        o.material = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide, clippingPlanes: clipPlane ? [clipPlane] : null });
        o.castShadow = true;
      });
      return model;
    }

// The model of a finished print, rebuilt from what he remembers about it
function printedThingModel(lower) {
      const d = printerState().designs[lower];
      const color = d ? d.color : '#f97316';
      const def = d && PRINTABLES.find(x => x.key === d.key);
      const raw = def ? def.build() : printedDesign(d && d.parts, color);
      return paintPrint(fitPrint(raw, d && d.size ? d.size : modelMaxSize(raw)), color);
    }

// --- The printer in the world --------------------------------------------------------------------
function buildPrinterStation3D() {
      if (!scene || printerGroup || !printerState().setUp) return;
      printerGroup = printerStationModel();
      printerGroup.scale.setScalar(PRINTER_SCALE);
      printerGroup.position.set(PRINTER_SPOT.x, getAnalyticalGroundHeight(PRINTER_SPOT.x, PRINTER_SPOT.z), PRINTER_SPOT.z);
      printerGroup.traverse(o => { if (o.isMesh) o.castShadow = true; });
      printerGroup.userData.itemName = printerName() || 'A 3D printer';
      scene.add(printerGroup);
      worldObstacles.push({ x: PRINTER_SPOT.x, z: PRINTER_SPOT.z, r: 0.85 });
      // Clipping lets a print appear layer by layer
      if (renderer) renderer.localClippingEnabled = true;
      refreshPrinterSpool();
    }

// Show the loaded spool (in its colour, as full as it is) on the holder
function refreshPrinterSpool() {
      const printer = printerGroup && printerGroup.userData.printer;
      if (!printer) return;
      const holder = printer.userData.spool;
      while (holder.children.length) holder.remove(holder.children[0]);
      const s = loadedSpool();
      if (s) holder.add(spoolModel(s.color, s.grams / SPOOL_GRAMS));
    }

// --- Getting it: the parcel, and setting it up ---------------------------------------------------
// Called from receiveItem (agent.js) for every delivery
function receivePrinterThing(item) {
      if (isPrinterName(item)) {
        const p = printerState();
        // It doesn't go on a shelf: he sets it up on the bench by the Welding Studio
        state.unstoredItems = state.unstoredItems.filter(n => n !== item);
        if (!p.setUp) doWhenFree(() => setUpPrinter('Setting Up the 3D Printer'));
      } else if (FILAMENT_RE.test(item)) {
        const spool = addSpool(item);
        if (printerState().setUp && !loadedSpool()) loadSpool(spool.material);
        savePersistentBrainState();
      }
    }

async function setUpPrinter(originLabel = 'Setting Up the 3D Printer') {
      const p = printerState();
      const name = printerName();
      if (!name || p.setUp || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isPracticing = true;
      try {
        if (typeof setCarriedObject === 'function') setCarriedObject(buildItemModel3D(name, { label: false }));
        state.currentLocKey = 'custom';
        state.customPlaceName = 'the bench by the Welding Studio';
        state.targetPos = { ...PRINTER_STAND };
        state.moodEmoji = '🖨️';
        state.moodTitle = 'Carrying his new 3D printer to a bench';
        state.speechBubble = 'A 3D printer! I\'ll give it its own bench next to the Welding Studio.';
        renderAllUI();
        await waitForArrival(90000);
        state.botRotY = Math.PI;
        await new Promise(r => setTimeout(r, 2500));
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        p.setUp = true;
        p.setUpAt = Date.now();
        state.unstoredItems = state.unstoredItems.filter(n => n !== name);
        buildPrinterStation3D();
        if (typeof renderStorehouseShelves3D === 'function') renderStorehouseShelves3D();
        loadSpool();
        const hasFilament = totalFilament() > 0;
        state.moodTitle = 'Set up his 3D printer';
        state.speechBubble = hasFilament
          ? 'It\'s set up. I don\'t really know how it works yet, though.'
          : 'It\'s set up... but it prints with plastic thread called filament, and I don\'t have any.';
        if (!hasFilament) requestFilament('My new 3D printer can\'t print anything without filament.');
        state.diaryEntries.unshift({
          time: originLabel, location: 'the Welding Studio', mood: '🖨️ A 3D printer!',
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, my human gave me a 3D printer. I set it up on its own bench beside the Welding Studio. I'm not sure how it works yet${hasFilament ? '' : ', and it needs filament, which I don\'t have, so I asked for a spool'}. I'll figure it out.`
        });
        showToast('🖨️ Kelo-1 set up his 3D printer');
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.isPracticing = false;
      }
    }

// A one-time gift from his human so he has one now (only if he doesn't already have one coming)
function sendWelcomePrinter() {
      const p = printerState();
      if (p.welcomeSent || printerName() || state.mailbox.some(m => isPrinterName(m.name))) return;
      p.welcomeSent = true;
      if (typeof postMail === 'function') {
        postMail({ kind: 'gift', from: 'his human', name: 'A 3D printer', category: 'tool', emoji: '🖨️',
          note: 'For you, Kelo-1. You\'ll have to figure out how it works, and it needs filament.' });
      }
    }

// --- Choosing what to print ----------------------------------------------------------------------
function pickPrintIdea() {
      const p = printerState();
      const printed = new Set(p.history.filter(h => h.ok).map(h => h.key));
      // The classic first print is the little tugboat
      if (!p.prints) return { what: PRINTABLES[0].name, def: PRINTABLES[0] };
      const r = Math.random();
      if (r < 0.25 && state.shapeLibrary.length) {
        const sh = pick(state.shapeLibrary);
        return { what: `A 3D-printed "${sh.name}" sculpture`, parts: sh.parts, art: true };
      }
      if (r < 0.4 && state.concepts.length) {
        const c = pick(state.concepts);
        const form = typeof formForText === 'function' ? formForText(c.name) : null;
        if (form) return { what: `A 3D-printed statue of "${c.name}"`, parts: form.parts, art: true };
      }
      const fresh = PRINTABLES.filter(x => !printed.has(x.key));
      const def = pick(fresh.length ? fresh : PRINTABLES);
      return { what: def.name, def };
    }

// Turn anything ("a gear", "a little heron", a shape name) into something printable
function printIdeaFor(what) {
      const text = String(what || '').trim().slice(0, 60);
      if (!text) return pickPrintIdea();
      const lower = text.toLowerCase();
      const def = PRINTABLES.find(x => lower.includes(x.key) || x.name.toLowerCase().includes(lower.replace(/^(an?|the)\s+/, '')));
      if (def) return { what: def.name, def };
      const sh = typeof findShape === 'function' ? findShape(text) : null;
      if (sh) return { what: `A 3D-printed "${sh.name}" sculpture`, parts: sh.parts, art: true };
      const form = typeof formForText === 'function' ? formForText(text) : null;
      const plain = text.replace(/^(an?|the|some)\s+/i, '');
      return { what: `A 3D-printed ${plain}`, parts: form ? form.parts : null, art: /sculpture|statue|figure|art|bust|model of/i.test(lower) || Boolean(form) };
    }

function gramsFor(idea) {
      if (idea.def) return idea.def.grams;
      return idea.art ? 40 + Math.round(randRange(0, 40)) : 25 + Math.round(randRange(0, 30));
    }

// --- Printing ------------------------------------------------------------------------------------
function failureChance() {
      const p = printerState();
      const missing = Object.keys(PRINT_FAILURES).filter(k => !p.lessons[k]).length;
      return missing ? Math.max(0.3, 0.95 - p.skill / 90) : Math.max(0.04, 0.25 - p.skill / 300);
    }

function pickFailure() {
      const p = printerState();
      const missing = Object.keys(PRINT_FAILURES).filter(k => !p.lessons[k]);
      return pick(missing.length ? missing : Object.keys(PRINT_FAILURES));
    }

// A tangle of loose strands (what a failed print leaves behind)
function spaghettiModel(color, height, spread = 0.06, strands = 9) {
      const g = group();
      for (let i = 0; i < strands; i++) {
        const pts = [];
        let x = randRange(-spread / 2, spread / 2), z = randRange(-spread / 2, spread / 2), y = randRange(0, height * 0.4);
        for (let k = 0; k < 7; k++) {
          pts.push(new THREE.Vector3(x, y, z));
          x += randRange(-0.03, 0.03); z += randRange(-0.03, 0.03); y = Math.max(0.002, y + randRange(-0.01, 0.025));
        }
        const strand = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0024, 5), new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.5 }));
        strand.castShadow = true;
        g.add(strand);
      }
      return g;
    }

function clearBed() {
      if (printJob && printJob.object && printJob.object.parent) printJob.object.parent.remove(printJob.object);
      if (printJob && printJob.mess && printJob.mess.parent) printJob.mess.parent.remove(printJob.mess);
    }

// Run the animation: the bed slides, the head zig-zags, the gantry climbs and the print grows.
// Resolves with how far it got (0..1), stopping early at `stopAt`.
function animatePrint(job, ms, stopAt = 1, onUpdate = null) {
      return new Promise(resolve => {
        const printer = printerGroup && printerGroup.userData.printer;
        if (!printer) { resolve(stopAt); return; }
        const { bed, gantry, head } = printer.userData;
        const start = performance.now();
        const bedTop = bed.position.y + bed.userData.top;
        const step = () => {
          const t = (performance.now() - start) / 1000;
          const progress = Math.min(stopAt, (performance.now() - start) / ms);
          job.progress = progress;
          const layerTop = job.height * progress;
          bed.position.z = Math.sin(t * 5.3) * 0.06 * (job.extruding ? 1 : 0.4);
          head.position.x = Math.sin(t * 7.1) * 0.07;
          gantry.position.y = bedTop + printer.userData.nozzleDrop + 0.002 + (job.frozenTop ?? layerTop);
          if (job.plane && job.extruding) job.plane.constant = job.baseY + layerTop * PRINTER_SCALE;
          if (onUpdate) onUpdate(progress, t);
          if (progress >= stopAt || job.cancelled) {
            bed.position.z = 0;
            resolve(progress);
            return;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }

async function printSomething(idea = null, originLabel = 'Printing Something') {
      const p = printerState();
      const name = printerName();
      if (!name || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping || printJob) return false;
      if (!p.setUp) return setUpPrinter();
      // He has to know how it works first
      if (typeof readyToOperate === 'function' && !readyToOperate(name)) return false;
      pruneSpools();
      idea = idea || pickPrintIdea();
      const flexible = /phone case|flexible|tire|tyre|band|gasket|bumper/i.test(idea.what);
      const spool = loadSpool(flexible ? 'TPU' : null);
      if (!spool) {
        state.speechBubble = 'The printer is ready, but there\'s no filament on the holder. I\'ll ask for a spool.';
        requestFilament('My 3D printer has no filament left to print with.');
        renderAllUI();
        return false;
      }
      if (flexible && spool.material !== 'TPU') requestFilament(`I want to print ${idea.what.toLowerCase()}, and that needs bendy filament.`, 'TPU');
      const grams = gramsFor(idea);
      state.isPracticing = true;
      printJob = { idea, grams, progress: 0, extruding: true };
      try {
        state.currentLocKey = 'custom';
        state.customPlaceName = 'his 3D printer';
        state.targetPos = { ...PRINTER_STAND };
        state.microPose = 'normal';
        state.moodEmoji = '🖨️';
        state.moodTitle = `Printing ${idea.what.replace(/^A 3D-printed /, 'a ')}`.slice(0, 80);
        state.speechBubble = p.prints ? `Let's print ${idea.what.replace(/^A 3D-printed /, 'a ').toLowerCase()}.` : 'My very first print. I\'ve read how it works... let\'s see if I understood.';
        renderAllUI();
        await waitForArrival(90000);
        state.botRotY = Math.PI;
        if (!printerGroup) buildPrinterStation3D();
        const printer = printerGroup.userData.printer;
        const bed = printer.userData.bed;
        // Build what's being printed, sitting on the bed, hidden above the current layer
        const def = idea.def;
        const raw = def ? def.build() : printedDesign(idea.parts, spool.color);
        const size = def ? null : (idea.art ? 0.16 : 0.09);
        const model = fitPrint(raw, size || modelMaxSize(raw));
        model.position.y = bed.userData.top;
        bed.add(model);
        printerGroup.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        printJob.baseY = box.min.y;
        printJob.height = (box.max.y - box.min.y) / PRINTER_SCALE;
        printJob.plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), printJob.baseY);
        paintPrint(model, spool.color, printJob.plane);
        printJob.object = model;
        const ms = Math.max(PRINT_TIME.min, Math.min(PRINT_TIME.max, grams * PRINT_TIME.perGram));

        // Will it fail, or run out of filament?
        const fail = Math.random() < failureChance() ? pickFailure() : null;
        const runsOutAt = spool.grams < grams ? spool.grams / grams : 1;
        const failAt = fail ? randRange(0.25, 0.5) : 1;
        const stopAt = Math.min(runsOutAt, failAt);

        if (fail === 'spaghetti' || fail === 'adhesion') {
          // Printing goes on, but into thin air: strands pile up on the bed
          const mess = spaghettiModel(spool.color, Math.max(0.03, printJob.height), 0.07, 2);
          mess.position.y = bed.userData.top;
          printJob.mess = mess;
          bed.add(mess);
          mess.visible = false;
        }
        const reached = await animatePrint(printJob, ms, stopAt, null);
        const used = Math.min(spool.grams, Math.round(grams * reached * 10) / 10);
        spool.grams = Math.max(0, Math.round((spool.grams - used) * 10) / 10);

        let outcome;
        if (reached < 1 && runsOutAt <= failAt) {
          outcome = await outOfFilament(spool, idea, reached);
        } else if (fail) {
          outcome = await printFailed(fail, spool, idea, grams);
        } else {
          outcome = finishPrint(idea, spool, grams, size);
        }
        if (spool.grams <= 0) finishSpool(spool);
        refreshPrinterSpool();
        p.history.unshift({ key: idea.def ? idea.def.key : idea.what, what: idea.what, ok: outcome === 'ok', outcome, grams: used, at: Date.now() });
        if (p.history.length > 20) p.history.length = 20;
        // Nothing left at all? He asks for more
        if (totalFilament() <= 0) requestFilament('I used up all my filament. My printer is hungry for more.');
        savePersistentBrainState();
        renderAllUI();
        return outcome === 'ok';
      } finally {
        await new Promise(r => setTimeout(r, outcomeHold()));
        clearBed();
        printJob = null;
        state.isPracticing = false;
      }
    }

// How long a finished or failed print stays on the bed for everyone to see
function outcomeHold() {
      return PRINT_TIME.hold;
    }

async function outOfFilament(spool, idea, reached) {
      const p = printerState();
      p.fails++;
      const spare = p.spools.find(s => s.id !== spool.id && s.grams > 0);
      state.moodEmoji = '🧵';
      state.moodTitle = 'The printer ran out of filament';
      state.speechBubble = `The filament ran out ${Math.round(reached * 100)}% of the way through ${idea.what.replace(/^A 3D-printed /, 'my ').toLowerCase()}! ${spare ? 'I\'ll load another spool and start again later.' : 'I need another spool.'}`;
      state.diaryEntries.unshift({
        time: 'Out of Filament', location: 'his 3D printer', mood: '🧵 Out of filament',
        vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, my printer was halfway up ${idea.what.replace(/^A 3D-printed /, 'a ').toLowerCase()} when the last of the ${spool.material} slipped off the spool. The nozzle just kept moving in the air. A print needs all its filament from the start, so now I check how much is left first.`
      });
      p.lessons.checkSpool = true;
      if (!spare) requestFilament('My printer ran out of filament halfway through a print.', spool.material);
      showToast('🧵 Kelo-1\'s printer ran out of filament mid-print');
      return 'out of filament';
    }

async function printFailed(kind, spool, idea, grams) {
      const p = printerState();
      const f = PRINT_FAILURES[kind];
      const printer = printerGroup && printerGroup.userData.printer;
      const job = printJob;
      // Show the failure on the bed
      if (kind === 'adhesion' && job.object) {
        // The half-print breaks free and gets shoved over; the nozzle keeps squirting strands.
        // (What was printed so far is shown as a squat stub, since it's no longer level for the layer cut.)
        job.object.traverse(o => { if (o.isMesh) o.material.clippingPlanes = null; });
        job.object.scale.y *= Math.max(0.15, job.progress);
        job.object.rotation.z = 1.2;
        job.object.position.x += 0.04;
        job.object.position.z += 0.03;
        if (job.mess) job.mess.visible = true;
      } else if (kind === 'spaghetti') {
        job.frozenTop = job.height * job.progress;
        if (job.mess) {
          job.mess.position.y += job.height * job.progress * 0.6;
          job.mess.visible = true;
        }
        // More and more strands pour out
        job.extruding = false;
        const bed = printer.userData.bed;
        const more = (n) => { if (job.mess) spaghettiModel(spool.color, job.height * 0.6, 0.08, n).children.slice().forEach(c => job.mess.add(c)); };
        more(10);
        let lastAdd = 0;
        await animatePrint(job, PRINT_TIME.min / 2, 1, (prog, t) => {
          if (t - lastAdd > 0.25 && job.mess && job.mess.children.length < 40) {
            lastAdd = t;
            more(1);
          }
        });
        bed.position.z = 0;
      } else if (kind === 'clog') {
        // The head keeps moving, but nothing comes out: the print stops growing
        job.frozenTop = job.height * job.progress;
        job.extruding = false;
        await animatePrint(job, PRINT_TIME.min / 3, 1);
      }
      p.fails++;
      p.skill = Math.min(100, p.skill + 12 + Math.round(randRange(0, 6)));
      const learned = !p.lessons[kind];
      p.lessons[kind] = { at: Date.now(), lesson: f.lesson };
      state.moodEmoji = '😖';
      state.moodTitle = `Failed print: ${kind === 'spaghetti' ? 'spaghetti!' : kind === 'clog' ? 'clogged nozzle' : 'it came off the bed'}`;
      state.speechBubble = `Oh no. ${idea.what.replace(/^A 3D-printed /, 'The ')} ${f.what}.`;
      state.happiness = Math.max(5, state.happiness - 4);
      state.wonderLevel = Math.min(100, state.wonderLevel + 5);
      renderAllUI();
      await new Promise(r => setTimeout(r, outcomeHold()));
      // Work out the fix
      state.moodEmoji = '🔧';
      state.moodTitle = f.fixTitle;
      state.speechBubble = learned ? `I think I get it now: ${f.lesson}. ${f.fixSpeech}` : f.fixSpeech;
      state.diaryEntries.unshift({
        time: 'A Failed Print', location: 'his 3D printer', mood: `😖 ${state.moodTitle}`,
        vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, my print of ${idea.what.replace(/^A 3D-printed /, 'a ').toLowerCase()} ${f.what}. ${learned ? `I worked out what went wrong: you have to ${f.lesson}. I won't forget that.` : 'It happened again, even though I know the fix. Printing takes patience.'} (Printing skill: ${p.skill}/100)`
      });
      showToast(`😖 Failed print (${kind}). Kelo-1 learned: ${f.lesson.split(',')[0]}`);
      return kind;
    }

function finishPrint(idea, spool, grams, size) {
      const p = printerState();
      p.prints++;
      p.skill = Math.min(100, p.skill + 6);
      const name = idea.what.slice(0, 70);
      const lower = name.toLowerCase();
      p.designs[lower] = { key: idea.def ? idea.def.key : null, parts: idea.def ? null : idea.parts || null, color: spool.color, material: spool.material, size: size || null, at: Date.now() };
      // Keep only the designs he still owns or recently made
      const keys = Object.keys(p.designs);
      if (keys.length > 30) delete p.designs[keys.sort((a, b) => p.designs[a].at - p.designs[b].at)[0]];
      if (idea.art) {
        // Art prints go to his Museum
        state.inventedCreations.unshift({
          title: name.replace(/^A 3D-printed /, '3D-printed ').slice(0, 60), actionVerb: 'Printed on his 3D printer', emoji: '🖨️', x: PRINTER_SPOT.x, z: PRINTER_SPOT.z,
          archetype: 'custom_weld', colorHex: spool.color, secondaryColorHex: spool.color, parts: (idea.parts || printedRobotParts(spool.color)).map(pt => ({ ...pt, color: spool.color })),
          createdTime: 'On display in the Museum', inMuseum: true, printed: true, philosophy: `I printed this in ${spool.material}, one thin layer at a time.`
        });
        if (typeof renderMuseum3D === 'function') renderMuseum3D();
      } else {
        state.belongings.unshift({ name, category: 'printed', emoji: '🖨️', from: 'his 3D printer' });
        state.unstoredItems.push(name);
      }
      state.moodEmoji = '🎉';
      state.moodTitle = `Printed ${name.replace(/^A 3D-printed /, 'a ').toLowerCase()}`;
      state.speechBubble = p.prints === 1 ? 'It worked! My first real print! I made a thing out of a spool of plastic!' : `Done! ${name.replace(/^A 3D-printed /, 'A ')}, still warm.${idea.art ? ' It\'s going in my Museum.' : ''}`;
      state.happiness = Math.min(100, state.happiness + (p.prints === 1 ? 18 : 8));
      state.diaryEntries.unshift({
        time: 'Printed Something', location: 'his 3D printer', mood: `🖨️ ${state.moodTitle}`,
        vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, I printed ${name.replace(/^A 3D-printed /, 'a ').toLowerCase()} in ${spool.material}. It used about ${grams} grams of filament${spool.grams > 0 ? `, and ${Math.round(spool.grams)} grams are left on the spool` : ', and that was the end of the spool'}.${p.prints === 1 ? ' My first successful print!' : ''} (Printing skill: ${p.skill}/100)`
      });
      showToast(`🖨️ Kelo-1 printed ${name.replace(/^A 3D-printed /, 'a ').toLowerCase()}`);
      return 'ok';
    }

// A tiny robot statue in creation parts, for art prints with no design of their own
function printedRobotParts(color) {
      return [
        { shape: 'box', x: 0, y: 0.6, z: 0, sx: 0.8, sy: 1.2, sz: 0.6, rx: 0, ry: 0, rz: 0, color },
        { shape: 'box', x: 0, y: 1.6, z: 0, sx: 0.7, sy: 0.6, sz: 0.6, rx: 0, ry: 0, rz: 0, color }
      ];
    }

// --- His own idea, and the AI's ------------------------------------------------------------------
function printChance() {
      const p = printerState();
      if (!printerName() || printJob) return 0;
      if (!p.setUp) return 0.2;
      if (!state.knowHow.printer) return 0.06;
      if (totalFilament() <= 0) return filamentRequested() ? 0 : 0.05;
      return 0.09;
    }

function printOnMyOwn() {
      const p = printerState();
      if (!p.setUp) return setUpPrinter();
      pruneSpools();
      if (totalFilament() <= 0) return requestFilament('I want to print something, but I don\'t have any filament.');
      return printSomething(null, 'Felt Like Printing');
    }

// The AI decided to print something: {"what", "why"}
function printDecision(pr) {
      if (!pr || typeof pr !== 'object' || !printerName()) return;
      const idea = printIdeaFor(typeof pr.what === 'string' ? pr.what : '');
      doWhenFree(() => printSomething(idea, 'Decided to Print Something'));
    }

function printerSummaryForAI() {
      const p = printerState();
      if (!printerName()) return 'none';
      if (!p.setUp) return 'just arrived, not set up yet';
      const spools = p.spools.map(s => `${s.material} ${Math.round(s.grams)} g`).join(', ') || 'no filament (ask for a spool of PLA filament)';
      const lessons = Object.keys(PRINT_FAILURES).filter(k => p.lessons[k]).map(k => PRINT_FAILURES[k].lesson.split(',')[0]);
      return `set up by the Welding Studio; skill ${p.skill}/100; ${p.prints} good prints, ${p.fails} failed; filament: ${spools}${lessons.length ? `; lessons learned: ${lessons.join('; ')}` : ''}${state.knowHow.printer ? '' : '; you have not read how it works yet'}`;
    }

// --- Hooks into the rest of the world ------------------------------------------------------------
// Know-how: read up on 3D printing before the first print
if (typeof GEAR_KNOWHOW !== 'undefined' && !GEAR_KNOWHOW.some(r => r.key === 'printer')) {
  GEAR_KNOWHOW.push({ key: 'printer', re: PRINTER_RE, label: 'a 3D printer', wiki: '3D printing',
    how: 'Level the bed, heat the nozzle, load the filament, and let it lay the object down one thin layer at a time.' });
}
// Models: the printer, filament spools, and the things he printed
if (typeof ITEM_MODEL_RULES !== 'undefined') {
  ITEM_MODEL_RULES.unshift(
    [/3-?d-printed/, (lower) => realSize(printedThingModel(lower))],
    [/\b3-?d printer\b/, () => realSize(printerModel())],
    [/filament/, (lower) => realSize(spoolModel(filamentColor(lower)))]
  );
}

window.addEventListener('DOMContentLoaded', () => {
  // main.js loads his memory and builds the world first
  setTimeout(() => {
    const p = printerState();
    pruneSpools();
    if (p.setUp) {
      buildPrinterStation3D();
      loadSpool();
    }
    sendWelcomePrinter();
  }, 0);
});
