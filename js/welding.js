// Kelo-bot-1 — js/welding.js
// Loaded after groundwork.js. Welding done the real way, at the welding table in his Welding Studio
// (js/weldstudio.js):
//   - The right consumables for the process and the metal: MIG needs a shielding-gas cylinder
//     (75/25 argon-CO2 for steel, pure argon for aluminium, tri-mix for stainless) and a spool of
//     matching wire; TIG needs pure argon, tungsten electrodes and filler rods; stick needs electrodes.
//     Plus a welding hood and leather gloves. MIG on steel is his default.
//   - The first time, he learns MIG welding at NetNode (GROUND_JOBS + researchJob from js/groundwork.js),
//     and he asks for exactly what is missing, with the reason for each.
//   - He sets up by hand, in steps you can watch: chains the cylinder on the cart, screws the regulator
//     on, connects the gas hose to the welder, loads the wire spool, plugs in the gun lead and the work
//     clamp and clamps it to the table, opens the bottle valve and sets the flow. The hoses and cables
//     are real tubes between the parts. The setup is saved, so a reload keeps everything connected.
//   - He fetches his hood, puts it on, and it flips down as the arc strikes: a blue-white arc at the
//     gun tip that lights the shop, sparks and spatter, and a bead that runs along the joint, glowing
//     orange and cooling to grey.
//   - The gas, wire, rods and electrodes are used up (js/itemuse.js useUpItem); an empty cylinder is
//     swapped for a spare, and when the last is gone he asks for more.

// --- What each process takes ----------------------------------------------------------------------
const WELD_PROCESSES = {
  mig: {
    name: 'MIG', title: 'MIG welding', wiki: ['Gas metal arc welding', 'Shielding gas'],
    learned: 'MIG welding feeds a wire electrode through the gun while shielding gas flows round it. The arc melts the wire into the joint. Steel takes a 75/25 argon-CO2 mix and ER70S-6 wire; aluminium needs pure argon and aluminium wire. Hook up the gas, the gun and the work clamp, open the cylinder, set about 25 CFH of gas, and always wear a welding hood and gloves.',
    lead: 'MIG gun lead', gun: 'MIG gun', gas: true
  },
  tig: {
    name: 'TIG', title: 'TIG welding', wiki: ['Gas tungsten arc welding'],
    learned: 'TIG welding holds the arc on a tungsten electrode that doesn\'t melt, under pure argon, while you dip a filler rod into the puddle by hand. Clean metal, a sharp tungsten, about 20 CFH of argon, a hood and gloves.',
    lead: 'TIG torch lead', gun: 'TIG torch', gas: true
  },
  stick: {
    name: 'stick', title: 'stick welding', wiki: ['Shielded metal arc welding'],
    learned: 'Stick welding burns a flux-coated electrode clamped in the holder; the flux makes its own shielding gas and leaves slag to chip off. No gas cylinder needed: just the electrodes, the work clamp, a hood and gloves.',
    lead: 'electrode holder lead', gun: 'electrode holder', gas: false
  }
};

// Safety gear for any arc
const WELD_SAFETY = [
  { role: 'hood', re: /welding (hood|helmet|mask)|auto-?darkening/i, ask: 'An auto-darkening welding hood', why: 'to protect my eyes and face from the arc\'s UV light and the sparks' },
  { role: 'gloves', re: /welding (gloves|gauntlets)|welder'?s gloves/i, ask: 'A pair of leather welding gloves', why: 'to keep the heat and spatter off my hands' }
];

// Consumables by process and metal: role, how to recognise it, what to ask for and why
const WELD_CONSUMABLES = {
  mig: {
    steel: [
      { role: 'gas', re: /(argon|ar)\W*(\/|-|\s)?\W*co2|\bc25\b|75\/25|co2.*argon/i, ask: 'A 75/25 argon-CO2 shielding gas cylinder', why: 'to shield the molten steel from the air so the bead doesn\'t come out porous', flow: 25 },
      { role: 'wire', re: /er70s|(mild )?steel (mig )?wire|mig wire(?!.*(alumin|stainless|er4043|er5356|er308))/i, ask: 'A spool of ER70S-6 MIG wire (0.030 inch)', why: 'as the filler wire for mild steel' }
    ],
    aluminium: [
      { role: 'gas', re: /^(?!.*(co2|c25|mix|helium|tri)).*argon/i, ask: 'A 100% argon shielding gas cylinder', why: 'because aluminium needs pure argon; CO2 in the mix would burn it', flow: 30 },
      { role: 'wire', re: /er4043|er5356|alumin\w* (mig )?wire/i, ask: 'A spool of ER4043 aluminium MIG wire', why: 'to match the aluminium' }
    ],
    stainless: [
      { role: 'gas', re: /tri-?mix|98\/2|helium/i, ask: 'A tri-mix (helium-argon-CO2) shielding gas cylinder', why: 'so stainless welds stay clean and don\'t lose their corrosion resistance', flow: 25 },
      { role: 'wire', re: /er308|stainless (mig )?wire/i, ask: 'A spool of ER308L stainless MIG wire', why: 'to match the stainless steel' }
    ]
  },
  tig: {
    steel: [
      { role: 'gas', re: /^(?!.*(co2|c25|mix|helium|tri)).*argon/i, ask: 'A 100% argon shielding gas cylinder', why: 'because TIG only works under pure argon', flow: 20 },
      { role: 'tungsten', re: /tungsten/i, ask: 'A pack of 2% lanthanated tungsten electrodes', why: 'to carry the arc in the TIG torch' },
      { role: 'filler', re: /er70s-2|steel (tig |filler )?rods?|(tig|filler) rods?(?!.*(alumin|stainless|er4043|er308))/i, ask: 'A tube of ER70S-2 TIG filler rods', why: 'to add metal to steel joints' }
    ],
    aluminium: [
      { role: 'gas', re: /^(?!.*(co2|c25|mix|helium|tri)).*argon/i, ask: 'A 100% argon shielding gas cylinder', why: 'because TIG only works under pure argon', flow: 20 },
      { role: 'tungsten', re: /tungsten/i, ask: 'A pack of 2% lanthanated tungsten electrodes', why: 'to carry the arc in the TIG torch' },
      { role: 'filler', re: /er4043.*rod|alumin\w* (tig |filler )?rods?/i, ask: 'A tube of ER4043 aluminium TIG filler rods', why: 'to match the aluminium' }
    ],
    stainless: [
      { role: 'gas', re: /^(?!.*(co2|c25|mix|helium|tri)).*argon/i, ask: 'A 100% argon shielding gas cylinder', why: 'because TIG only works under pure argon', flow: 20 },
      { role: 'tungsten', re: /tungsten/i, ask: 'A pack of 2% lanthanated tungsten electrodes', why: 'to carry the arc in the TIG torch' },
      { role: 'filler', re: /er308.*rod|stainless (tig |filler )?rods?/i, ask: 'A tube of ER308L stainless TIG filler rods', why: 'to match the stainless steel' }
    ]
  },
  stick: {
    steel: [{ role: 'electrode', re: /e7018|e6013|e6011|e6010|(steel |stick )electrodes?|welding rods?(?!.*(alumin|stainless))/i, ask: 'A box of E7018 stick electrodes', why: 'as the rods that carry the arc and fill the joint on steel' }],
    aluminium: [{ role: 'electrode', re: /e4043|alumin\w* electrodes?/i, ask: 'A box of aluminium stick electrodes (E4043)', why: 'to match the aluminium' }],
    stainless: [{ role: 'electrode', re: /e308|stainless electrodes?/i, ask: 'A box of E308L-16 stainless electrodes', why: 'to match the stainless steel' }]
  }
};

// One research trip per process (his first ever is MIG); the gear list is filled in for the metal at hand
Object.entries(WELD_PROCESSES).forEach(([key, p]) => {
  if (typeof GROUND_JOBS === 'undefined') return;
  GROUND_JOBS['weld_' + key] = { title: p.title, wiki: p.wiki, learned: p.learned, tools: WELD_SAFETY.slice(), materials: WELD_CONSUMABLES[key].steel.slice() };
});

// Which process: his own TIG or stick welder if he was given one, otherwise the studio's MIG welder
function weldProcessNow() {
      if (hasItem(/\btig\b.*(welder|torch|machine)/i)) return 'tig';
      if (hasItem(/stick welder|arc welder|smaw|buzz ?box/i)) return 'stick';
      return 'mig';
    }

// What metal the piece is made of (steel unless it says otherwise)
function weldMetalFor(creation) {
      const text = creation ? `${creation.title || ''} ${creation.material || ''} ${creation.description || ''} ${(creation.parts || []).map(p => p && p.material || '').join(' ')}` : '';
      if (/alumin/i.test(text)) return 'aluminium';
      if (/stainless/i.test(text)) return 'stainless';
      return 'steel';
    }

// The plan for welding this piece: process, metal, the research job and its gear list
function weldPlanFor(creation) {
      const process = weldProcessNow();
      const metal = weldMetalFor(creation);
      const key = 'weld_' + process;
      const job = GROUND_JOBS[key];
      job.title = `${WELD_PROCESSES[process].title} ${metal}`;
      job.tools = WELD_SAFETY.slice();
      job.materials = WELD_CONSUMABLES[process][metal].slice();
      return { process, metal, key, info: WELD_PROCESSES[process], consumables: job.materials };
    }

// His saved setup (state.weldSetup in agent.js), with any missing fields filled in
function weldSetupState() {
      const d = { cylinder: null, wire: null, regulator: false, hoses: { gas: false, gun: false, clamp: false }, valveOpen: false, flow: 0, hoodAt: null, glovesAt: null, kept: [], welds: 0 };
      const s = state.weldSetup && typeof state.weldSetup === 'object' ? state.weldSetup : {};
      state.weldSetup = { ...d, ...s, hoses: { ...d.hoses, ...(s.hoses || {}) }, kept: Array.isArray(s.kept) ? s.kept : [] };
      return state.weldSetup;
    }

// Gear and consumables he keeps at the studio stay off the Storehouse shelves (js/storehouse.js)
function keptAtWeldStudio(name) {
      const s = state.weldSetup;
      return Boolean(s && Array.isArray(s.kept) && s.kept.includes(String(name).toLowerCase()));
    }

let weldAskedAt = 0;

// Can he weld this piece right now? If not, he researches the process or asks for exactly what's missing.
function weldingReady(creation, context) {
      if (typeof GROUND_JOBS === 'undefined' || typeof groundworkReady !== 'function') return true;
      const plan = weldPlanFor(creation);
      const title = creation && creation.title ? `Welding "${creation.title}"` : 'Welding';
      const missing = jobKnown(plan.key) ? missingForJob(plan.key) : null;
      if (missing && !missing.length) return true;
      // Say it (and ask) at most every few minutes while the build waits
      const loud = Date.now() - weldAskedAt > 4 * 60 * 1000;
      if (loud) weldAskedAt = Date.now();
      if (!loud) return false;
      groundworkReady(plan.key, context || title);
      if (missing) state.changedLatelySummary = `Waiting for welding supplies: ${missing.map(m => plainItem(m.ask).toLowerCase()).join(', ')}`;
      return false;
    }

// --- The 3D rig: hoses, cables, regulator, cylinder, spool, gun, clamp, hood, gloves, the arc and the bead ---
const weldRig = {
  built: false, active: false, group: null, parts: {}, cables: {},
  inHand: null, pose: null, face: null, holdingGun: false,
  ik: { right: null, left: null }, lean: 0.22,
  arc: false, arcAt: new THREE.Vector3(), arcStarted: 0, hoodDown: false, hoodAngle: -1.75, nodAt: -10,
  doorOpen: 0, valveSpin: 0, flowShown: 0, gaugeShown: 0,
  joint: null, bead: null, sparks: null, spatter: null, fumes: null,
  hood: null, gauntlets: [], clock: 0
};

const _weldV = new THREE.Vector3(), _weldV2 = new THREE.Vector3(), _weldPalm = new THREE.Vector3();

// Studio-local to world (the studio group is not rotated)
function weldLocal(x, y, z, out = new THREE.Vector3()) {
      const gy = weldStudio ? weldStudio.gy : getAnalyticalGroundHeight(WELD_STUDIO.x, WELD_STUDIO.z);
      return out.set(WELD_STUDIO.x + x, gy + y, WELD_STUDIO.z + z);
    }

// A named spot on the welder cart, in world space
function weldMark(name, out = new THREE.Vector3()) {
      const m = weldStudio && weldStudio.cart.getObjectByName(name);
      if (!m) return out.set(WELD_STUDIO.x, 1, WELD_STUDIO.z);
      m.updateWorldMatrix(true, false);
      return m.getWorldPosition(out);
    }

// Where he stands for each part of the job (studio-local x, z) and which way he faces
const WELD_SPOTS = {
  front: { x: 1.65, z: 1.08, face: Math.PI },        // the welder's front panel, sockets, hooks
  side: { x: 2.42, z: 0.12, face: -Math.PI / 2 },    // the cylinder, regulator, gas inlet, wire door
  weld: { x: 0.0, z: 1.25, face: Math.PI }           // at the table, a step in from his usual spot
};
// The joint he welds (studio-local), at the front of the table where he can reach it
const WELD_JOINT = { x0: 0.02, x1: -0.34, z: 0.6, y: 0.936 };
const WELD_GUN_REST = { x: 0.42, y: 0.935, z: 0.56 };
const WELD_CLAMP_SPOT = { x: 1.08, y: 0.9, z: 0.71 };

function weldMat(color, roughness = 0.6, metalness = 0, extra = {}) {
      return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    }

function weldMesh(geo, mat, parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.castShadow = true;
      if (parent) parent.add(m);
      return m;
    }

// The welding hood: a black shell on a headgear that pivots at his headphone ears, with a dark lens
function buildWeldHoodModel() {
      const g = new THREE.Group();
      const shellMat = weldMat(0x1b1d22, 0.45, 0.1, { side: THREE.DoubleSide });
      const shell = weldMesh(new THREE.SphereGeometry(0.44, 26, 16, Math.PI / 2 - 1.12, 2.24, 0.42, 2.0), shellMat, g);
      shell.scale.set(1.06, 0.86, 1);
      // A stripe of his amber down the middle, for luck
      const stripe = weldMesh(new THREE.SphereGeometry(0.445, 6, 10, Math.PI / 2 - 0.05, 0.1, 0.42, 0.62), weldMat(0xffb547, 0.4, 0.2, { side: THREE.DoubleSide }), g);
      stripe.scale.copy(shell.scale);
      // The lens: a frame and an auto-darkening filter that goes dark when the arc strikes
      weldMesh(new THREE.BoxGeometry(0.24, 0.12, 0.03), weldMat(0x0b0c0e, 0.5), g, 0, 0.0, 0.43);
      const lens = weldMesh(new THREE.BoxGeometry(0.19, 0.08, 0.012), weldMat(0x2c5d3c, 0.08, 0.4, { emissive: 0x0b2a16, emissiveIntensity: 0.4 }), g, 0, 0.0, 0.447);
      // Headgear: pivot knobs over each ear and the side arms to the shell
      [-1, 1].forEach(s => {
        weldMesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12), weldMat(0x2b2d30, 0.5), g, s * 0.47, 0, 0.0, 0, 0, Math.PI / 2);
        weldMesh(new THREE.BoxGeometry(0.02, 0.05, 0.2), weldMat(0x2b2d30, 0.5), g, s * 0.455, 0, 0.09, 0, -s * 0.35, 0);
      });
      g.userData.lens = lens;
      return g;
    }

// A MIG gun: handle, trigger, swan neck and copper nozzle. Origin at the nozzle tip; 'back' is where the lead goes in.
function buildWeldGunModel() {
      const g = new THREE.Group();
      const black = weldMat(0x1a1a1a, 0.5);
      weldMesh(new THREE.CylinderGeometry(0.022, 0.026, 0.17, 10), black, g, 0, 0.1, -0.13, -1.1, 0, 0);
      weldMesh(new THREE.BoxGeometry(0.015, 0.04, 0.02), weldMat(0xb91c1c, 0.4), g, 0, 0.06, -0.12, -0.3, 0, 0);
      weldMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 8), weldMat(0x9aa7b5, 0.35, 0.7), g, 0, 0.045, -0.035, -0.6, 0, 0);
      weldMesh(new THREE.CylinderGeometry(0.016, 0.02, 0.05, 10), weldMat(0xd97706, 0.25, 0.85), g, 0, 0.012, 0, 0, 0, 0);
      const back = new THREE.Object3D();
      back.position.set(0, 0.17, -0.2);
      back.name = 'back';
      g.add(back);
      return g;
    }

// A work clamp: two copper jaws and the spring handles
function buildWeldClampModel() {
      const g = new THREE.Group();
      const copper = weldMat(0xb87333, 0.35, 0.85);
      weldMesh(new THREE.BoxGeometry(0.03, 0.015, 0.07), copper, g, 0, 0.012, 0);
      weldMesh(new THREE.BoxGeometry(0.03, 0.015, 0.07), copper, g, 0, -0.012, 0);
      weldMesh(new THREE.BoxGeometry(0.026, 0.012, 0.09), weldMat(0x111111, 0.6), g, 0, 0.025, 0.07, 0.2, 0, 0);
      weldMesh(new THREE.BoxGeometry(0.026, 0.012, 0.09), weldMat(0x111111, 0.6), g, 0, -0.025, 0.07, -0.2, 0, 0);
      const back = new THREE.Object3D();
      back.position.set(0, 0, 0.12);
      back.name = 'back';
      g.add(back);
      return g;
    }

// The regulator: brass body on the cylinder valve, a pressure gauge, a flowmeter tube with its ball, and the hose barb
function buildWeldRegulatorModel() {
      const g = new THREE.Group();
      const brass = weldMat(0xc8a24a, 0.3, 0.9);
      weldMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 10), brass, g, 0.025, 0, 0, 0, 0, Math.PI / 2);   // inlet nut
      weldMesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), brass, g, 0.07, 0, 0);
      // Cylinder-pressure gauge facing out
      const dial = new THREE.Group();
      dial.position.set(0.11, 0.03, 0);
      weldMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.022, 18), weldMat(0x2b2d30, 0.4, 0.5), dial, 0, 0, 0, 0, 0, Math.PI / 2);
      weldMesh(new THREE.CircleGeometry(0.03, 18), weldMat(0xf4f4f0, 0.6), dial, 0.012, 0, 0, 0, Math.PI / 2, 0);
      const needle = new THREE.Group();
      needle.position.set(0.013, 0, 0);
      weldMesh(new THREE.BoxGeometry(0.002, 0.026, 0.004), weldMat(0xc81e1e, 0.5), needle, 0, 0.012, 0);
      dial.add(needle);
      g.add(dial);
      // Flowmeter: a clear tube with a ball that floats up with the gas flow
      weldMesh(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.05, transparent: true, opacity: 0.35 }), g, 0.07, 0.09, 0.0);
      weldMesh(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 12), brass, g, 0.07, 0.155, 0.0);
      const ball = weldMesh(new THREE.SphereGeometry(0.008, 10, 8), weldMat(0x111111, 0.3), g, 0.07, 0.04, 0.0);
      // Flow knob and the outlet barb underneath
      weldMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 10), weldMat(0x1a1a1a, 0.5), g, 0.07, -0.035, 0.035, Math.PI / 2, 0, 0);
      weldMesh(new THREE.CylinderGeometry(0.006, 0.008, 0.03, 8), brass, g, 0.07, -0.04, 0.0);
      const out = new THREE.Object3D();
      out.position.set(0.07, -0.06, 0);
      out.name = 'out';
      g.add(out);
      g.userData = { needle, ball };
      return g;
    }

// A shielding gas cylinder (origin at its base), its shoulder painted for the gas inside
function buildWeldCylinderModel(name) {
      const g = new THREE.Group();
      const body = /alumin|^(?!.*(co2|c25|mix|helium|tri)).*argon/i.test(name || '') ? 0x5f6b72 : 0x7d8a92;
      const shoulder = /tri-?mix|helium/i.test(name || '') ? 0x8a5a2b : /co2|c25|mix/i.test(name || '') ? 0x3f8a52 : 0x2e6b3a;
      const paint = weldMat(body, 0.45, 0.35);
      weldMesh(new THREE.CylinderGeometry(0.11, 0.11, 1.12, 16), paint, g, 0, 0.56, 0);
      weldMesh(new THREE.CylinderGeometry(0.05, 0.11, 0.12, 16), weldMat(shoulder, 0.45, 0.35), g, 0, 1.18, 0);
      weldMesh(new THREE.CylinderGeometry(0.112, 0.112, 0.06, 16), weldMat(0xf1f1ee, 0.6), g, 0, 0.92, 0);   // the label band
      const brass = weldMat(0xc8a24a, 0.3, 0.9);
      weldMesh(new THREE.CylinderGeometry(0.024, 0.026, 0.09, 10), brass, g, 0, 1.285, 0);
      weldMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 8), brass, g, 0.038, 1.29, 0, 0, 0, Math.PI / 2);
      const wheel = new THREE.Group();
      wheel.position.set(0, 1.345, 0);
      weldMesh(new THREE.CylinderGeometry(0.04, 0.04, 0.014, 12), weldMat(0x1a1a1a, 0.5), wheel);
      weldMesh(new THREE.BoxGeometry(0.075, 0.016, 0.012), weldMat(0x1a1a1a, 0.5), wheel, 0, 0.01, 0);
      g.add(wheel);
      const out = new THREE.Object3D();
      out.position.set(0.062, 1.29, 0);
      out.name = 'valveOut';
      g.add(out);
      g.userData = { wheel };
      return g;
    }

// A wire spool: black plastic flanges with copper-coloured wire wound between them (axis along x)
function buildWeldSpoolModel(name) {
      const g = new THREE.Group();
      const wire = /alumin|er4043|er5356/i.test(name || '') ? 0xc9ccd1 : /stainless|er308/i.test(name || '') ? 0xa9adb3 : 0xb87333;
      weldMesh(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 20), weldMat(wire, 0.35, 0.85), g, 0, 0, 0, 0, 0, Math.PI / 2);
      [-0.03, 0.03].forEach(x => weldMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.008, 22), weldMat(0x111111, 0.6), g, x, 0, 0, 0, 0, Math.PI / 2));
      return g;
    }

// A coil of hose or cable hanging on a hook (a few loops)
function buildWeldCoil(r, tube, color, loops = 3) {
      const g = new THREE.Group();
      const mat = weldMat(color, 0.8);
      for (let i = 0; i < loops; i++) weldMesh(new THREE.TorusGeometry(r * (1 - i * 0.05), tube, 6, 22), mat, g, i * tube * 1.4, -i * 0.01, 0, 0, Math.PI / 2, 0);
      return g;
    }

// Leather gloves lying flat
function buildWeldGlovesModel() {
      const g = new THREE.Group();
      const leather = weldMat(0x9b7448, 0.9);
      [-0.06, 0.07].forEach((x, i) => {
        weldMesh(new THREE.BoxGeometry(0.1, 0.025, 0.17), leather, g, x, 0.012, 0, 0, i ? 0.3 : -0.2, 0);
        weldMesh(new THREE.BoxGeometry(0.11, 0.028, 0.1), weldMat(0xb48a58, 0.9), g, x + (i ? 0.03 : -0.02), 0.014, -0.12, 0, i ? 0.3 : -0.2, 0);
      });
      return g;
    }

// A cable as a tube from one end to the other, sagging in the middle and lying on the floor if it reaches it
function makeWeldCable(radius, color, sag = 0.25) {
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), weldMat(color, 0.75));
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      mesh.visible = false;
      weldRig.group.add(mesh);
      return { mesh, radius, sag, a: null, b: null, aDir: new THREE.Vector3(0, 0, 1), bDir: new THREE.Vector3(0, 0, 1), key: '' };
    }

function updateWeldCable(c) {
      if (!c.a || !c.b) { c.mesh.visible = false; return; }
      const A = c.a(new THREE.Vector3()), B = c.b(new THREE.Vector3());
      const key = `${A.x.toFixed(3)},${A.y.toFixed(3)},${A.z.toFixed(3)},${B.x.toFixed(3)},${B.y.toFixed(3)},${B.z.toFixed(3)}`;
      c.mesh.visible = true;
      if (key === c.key) return;
      c.key = key;
      const floor = (weldStudio ? weldStudio.gy : 0) + 0.03 + c.radius;
      const len = A.distanceTo(B);
      const a1 = A.clone().addScaledVector(c.aDir, 0.06);
      const b1 = B.clone().addScaledVector(c.bDir, 0.06);
      const mid = a1.clone().lerp(b1, 0.5);
      mid.y = Math.max(floor, Math.min(a1.y, b1.y) - c.sag * Math.min(1.2, len));
      const q1 = a1.clone().lerp(mid, 0.5); q1.y = Math.max(floor, q1.y - c.sag * 0.25 * len);
      const q2 = b1.clone().lerp(mid, 0.5); q2.y = Math.max(floor, q2.y - c.sag * 0.25 * len);
      const curve = new THREE.CatmullRomCurve3([A, a1, q1, mid, q2, b1, B]);
      c.mesh.geometry.dispose();
      c.mesh.geometry = new THREE.TubeGeometry(curve, Math.max(16, Math.round(len * 30)), c.radius, 6, false);
      c.mesh.position.set(0, 0, 0);
    }

// Small soft round texture for sparks, the arc and fumes
function weldGlowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(190,225,255,0.8)', outer = 'rgba(80,140,255,0)') {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const x = c.getContext('2d');
      const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, inner);
      gr.addColorStop(0.25, mid);
      gr.addColorStop(1, outer);
      x.fillStyle = gr;
      x.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    }

function buildWeldingRig3D() {
      if (!weldStudio || !scene) return;
      weldSetupState();
      const g = new THREE.Group();
      g.name = 'weldRig';
      scene.add(g);
      weldRig.group = g;
      const P = weldRig.parts;
      weldStudio.group.updateMatrixWorld(true);
      // The cylinder lives on the cart's back rack; spares stand chained to the back wall (js/weldstudio.js)
      P.cylinder = null;
      P.regulator = buildWeldRegulatorModel();
      g.add(P.regulator);
      P.spool = null;
      P.gun = buildWeldGunModel();
      g.add(P.gun);
      P.clamp = buildWeldClampModel();
      g.add(P.clamp);
      P.hoodOnHook = buildWeldHoodModel();
      P.hoodOnHook.scale.setScalar(0.8);
      g.add(P.hoodOnHook);
      P.gloves = buildWeldGlovesModel();
      g.add(P.gloves);
      P.gasCoil = buildWeldCoil(0.07, 0.008, 0x2f6b3a);
      g.add(P.gasCoil);
      P.gunCoil = buildWeldCoil(0.11, 0.014, 0x161616);
      g.add(P.gunCoil);
      P.clampCoil = buildWeldCoil(0.1, 0.012, 0x7a1f17);
      P.clampCoil.rotation.z = Math.PI / 2;
      g.add(P.clampCoil);
      // Plug ends he carries while connecting
      P.plug = weldMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.07, 10), weldMat(0xc8a24a, 0.3, 0.9), null);
      P.plug.visible = false;
      g.add(P.plug);
      weldRig.cables = {
        gas: makeWeldCable(0.009, 0x2f6b3a, 0.18),
        gun: makeWeldCable(0.016, 0x161616, 0.3),
        clamp: makeWeldCable(0.013, 0x7a1f17, 0.3)
      };
      // The arc: a white-hot core, a jagged arc line, a flickering light (forgeArcLight) and the shop flare
      weldRig.arcCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: weldGlowTexture(), color: 0xeaf4ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
      weldRig.arcCore.visible = false;
      g.add(weldRig.arcCore);
      const arcGeo = new THREE.BufferGeometry();
      arcGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
      weldRig.arcLine = new THREE.Line(arcGeo, new THREE.LineBasicMaterial({ color: 0xd8ecff, transparent: true, opacity: 0.95, toneMapped: false, blending: THREE.AdditiveBlending }));
      weldRig.arcLine.frustumCulled = false;
      weldRig.arcLine.visible = false;
      g.add(weldRig.arcLine);
      // Sparks: little hot droplets that fly, fall, bounce on the table and fade from yellow to red
      const N = 180;
      const sGeo = new THREE.BufferGeometry();
      sGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      sGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      weldRig.sparks = new THREE.Points(sGeo, new THREE.PointsMaterial({ size: 0.028, map: weldGlowTexture('rgba(255,255,255,1)', 'rgba(255,220,150,0.9)', 'rgba(255,120,20,0)'), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      weldRig.sparks.frustumCulled = false;
      weldRig.sparks.userData.p = Array.from({ length: N }, () => ({ life: 1, max: 1, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0 }));
      g.add(weldRig.sparks);
      // Fumes rising to the extractor hood
      weldRig.fumes = Array.from({ length: 10 }, () => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: weldGlowTexture('rgba(200,200,200,0.5)', 'rgba(170,170,170,0.25)', 'rgba(150,150,150,0)'), transparent: true, depthWrite: false, opacity: 0 }));
        s.userData.life = 1;
        s.visible = false;
        g.add(s);
        return s;
      });
      buildWeldBead();
      weldRig.built = true;
      syncWeldRig();
    }

// The joint he welds, the bead's ripples and the spatter: instanced so they're cheap
function buildWeldBead() {
      const g = weldRig.group;
      const MAXB = 140, MAXS = 70;
      const ripple = new THREE.SphereGeometry(1, 10, 6);
      const solid = new THREE.InstancedMesh(ripple, new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.75 }), MAXB);
      const glow = new THREE.InstancedMesh(ripple, new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), MAXB);
      [solid, glow].forEach(m => { m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); g.add(m); });
      glow.scale.setScalar(1);
      const dot = new THREE.SphereGeometry(1, 6, 4);
      const spat = new THREE.InstancedMesh(dot, new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.6 }), MAXS);
      const spatGlow = new THREE.InstancedMesh(dot, new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), MAXS);
      [spat, spatGlow].forEach(m => { m.count = 0; m.frustumCulled = false; g.add(m); });
      weldRig.bead = { solid, glow, ripples: [], MAXB };
      weldRig.spatter = { solid: spat, glow: spatGlow, dots: [], MAXS };
      // Two steel plates butted together along the seam
      const plates = new THREE.Group();
      const plateMat = weldMat(0x6f747a, 0.45, 0.8);
      const len = Math.abs(WELD_JOINT.x1 - WELD_JOINT.x0) + 0.06;
      const cx = (WELD_JOINT.x0 + WELD_JOINT.x1) / 2;
      weldMesh(new THREE.BoxGeometry(len, 0.016, 0.12), plateMat, plates, 0, 0, -0.062);
      weldMesh(new THREE.BoxGeometry(len, 0.016, 0.09), plateMat, plates, 0, 0, 0.047);
      const p = weldLocal(cx, WELD_JOINT.y - 0.008, WELD_JOINT.z);
      plates.position.copy(p);
      plates.visible = false;
      g.add(plates);
      weldRig.joint = plates;
    }

const _weldM = new THREE.Matrix4(), _weldQ = new THREE.Quaternion(), _weldS = new THREE.Vector3(), _weldC = new THREE.Color();

// Bead colour by temperature: white-yellow when molten, orange, dull red, then nothing (the glow layer)
function weldHeatColor(T, out) {
      if (T <= 0) return out.setRGB(0, 0, 0);
      if (T > 0.75) return out.setRGB(1, 0.85 + 0.15 * (T - 0.75) * 4, 0.45 + 0.4 * (T - 0.75) * 4).multiplyScalar(1.6);
      if (T > 0.4) return out.setRGB(1, 0.35 + 0.5 * (T - 0.4) / 0.35, 0.08 + 0.37 * (T - 0.4) / 0.35).multiplyScalar(0.6 + T);
      return out.setRGB(0.75 * T / 0.4, 0.12 * T / 0.4, 0.02 * T / 0.4).multiplyScalar(0.9);
    }

function addWeldRipple(x, z, big = 1) {
      const b = weldRig.bead;
      if (b.ripples.length >= b.MAXB) return;
      b.ripples.push({ x, z, born: weldRig.clock, big });
    }

function updateWeldBead(t) {
      const b = weldRig.bead;
      if (!b) return;
      const y = weldLocal(0, WELD_JOINT.y, 0).y;
      b.ripples.forEach((r, i) => {
        const age = weldRig.clock - r.born;
        const T = Math.max(0, 1 - age / 7);
        _weldS.set(0.011 * r.big, 0.007 * r.big, 0.017 * r.big);
        _weldM.compose(_weldV.set(r.x, y + 0.002, r.z), _weldQ.identity(), _weldS);
        b.solid.setMatrixAt(i, _weldM);
        // Cooled steel bead: grey, with a faint straw and blue heat tint while it is still warm
        const g = 0.32 + 0.22 * (1 - T);
        b.solid.setColorAt(i, _weldC.setRGB(g + 0.05 * T, g, g - 0.02 + 0.06 * (1 - T)));
        _weldS.multiplyScalar(1.12);
        _weldM.compose(_weldV, _weldQ, _weldS);
        b.glow.setMatrixAt(i, _weldM);
        b.glow.setColorAt(i, weldHeatColor(T, _weldC));
      });
      b.solid.count = b.glow.count = b.ripples.length;
      [b.solid, b.glow].forEach(m => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
      const s = weldRig.spatter;
      s.dots.forEach((d, i) => {
        const T = Math.max(0, 1 - (weldRig.clock - d.born) / 2.5);
        _weldS.setScalar(d.r);
        _weldM.compose(_weldV.set(d.x, d.y, d.z), _weldQ.identity(), _weldS);
        s.solid.setMatrixAt(i, _weldM);
        s.solid.setColorAt(i, _weldC.setRGB(0.3, 0.3, 0.31));
        s.glow.setMatrixAt(i, _weldM);
        s.glow.setColorAt(i, weldHeatColor(T * 0.8, _weldC));
      });
      s.solid.count = s.glow.count = s.dots.length;
      [s.solid, s.glow].forEach(m => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    }

function clearWeldBead() {
      if (!weldRig.bead) return;
      weldRig.bead.ripples = [];
      weldRig.spatter.dots = [];
      weldRig.joint.visible = false;
      updateWeldBead(0);
    }

// Put every part where the saved setup says it is
function syncWeldRig() {
      if (!weldRig.built) return;
      const s = weldSetupState();
      const P = weldRig.parts, C = weldRig.cables;
      const at = (obj, name, dx = 0, dy = 0, dz = 0) => { weldMark(name, obj.position); obj.position.x += dx; obj.position.y += dy; obj.position.z += dz; };
      // Cylinder on the cart (rebuilt when a different gas arrives)
      if (s.cylinder && (!P.cylinder || P.cylinder.userData.name !== s.cylinder)) {
        if (P.cylinder) weldRig.group.remove(P.cylinder);
        P.cylinder = buildWeldCylinderModel(s.cylinder);
        P.cylinder.userData.name = s.cylinder;
        weldRig.group.add(P.cylinder);
        // and its chain round the rack
        weldMesh(new THREE.TorusGeometry(0.118, 0.008, 4, 18), weldMat(0x2b2d30, 0.5, 0.7), P.cylinder, 0, 0.75, 0, Math.PI / 2, 0, 0);
      }
      if (P.cylinder) {
        P.cylinder.visible = Boolean(s.cylinder);
        at(P.cylinder, 'bottle');
        P.cylinder.updateMatrixWorld(true);
      }
      // Spare cylinders of the same gas wait chained to the back wall
      const spares = s.cylinder && typeof copiesOwned === 'function' ? Math.max(0, copiesOwned(s.cylinder) - 1) : 0;
      weldStudio.spareBottles.forEach((b, i) => { b.visible = i < spares; });
      // Regulator: on the cylinder valve, or hanging on the cart handle
      const regOn = Boolean(s.regulator && s.cylinder && P.cylinder);
      if (weldRig.inHand !== P.regulator) {
        if (regOn) { P.cylinder.getObjectByName('valveOut').getWorldPosition(P.regulator.position); P.regulator.rotation.set(0, 0, 0); }
        else { at(P.regulator, 'regulatorHook', 0, -0.07, 0); P.regulator.rotation.set(0, Math.PI / 2, 0); }
      }
      P.regulator.updateMatrixWorld(true);
      // Gas hose: regulator outlet down to the welder's gas inlet, or coiled on the handle
      P.gasCoil.visible = !s.hoses.gas && C.gas.b === null;
      at(P.gasCoil, 'regulatorHook', -0.14, -0.12, 0);
      if (s.hoses.gas && regOn) {
        C.gas.a = v => P.regulator.getObjectByName('out').getWorldPosition(v);
        C.gas.aDir.set(0, -1, 0);
        C.gas.b = v => weldMark('gasInlet', v);
        C.gas.bDir.set(0, 0, -1);
      } else if (!weldRig.pose || weldRig.pose.cable !== 'gas') { C.gas.a = C.gas.b = null; }
      // Gun: on the table with its lead in the socket, or hanging on the cart with the lead coiled
      if (!weldRig.holdingGun && weldRig.inHand !== P.gun) {
        if (s.hoses.gun) {
          weldLocal(WELD_GUN_REST.x, WELD_GUN_REST.y, WELD_GUN_REST.z, P.gun.position);
          P.gun.rotation.set(Math.PI / 2 - 0.15, 0, 0);
          P.gun.position.y += 0.02;
        } else {
          at(P.gun, 'gunHook', -0.03, -0.12, 0);
          P.gun.rotation.set(0, Math.PI / 2, 0);
        }
      }
      P.gun.visible = !weldRig.holdingGun;
      P.gunCoil.visible = !s.hoses.gun;
      at(P.gunCoil, 'gunHook', -0.02, -0.12, 0);
      if (s.hoses.gun) {
        C.gun.a = v => weldMark('gunSocket', v);
        C.gun.aDir.set(0, 0, 1);
        C.gun.b = v => weldRig.holdingGun && keloWeldTorchGroup ? keloWeldTorchGroup.localToWorld(v.set(0, 0.11, -0.22)) : P.gun.getObjectByName('back').getWorldPosition(v);
        C.gun.bDir.set(0, 0.3, -1).normalize();
      } else if (!weldRig.pose || weldRig.pose.cable !== 'gun') { C.gun.a = C.gun.b = null; }
      // Work clamp: on the table's front edge with its cable in the (-) socket, or coiled on the bottom shelf
      if (weldRig.inHand !== P.clamp) {
        if (s.hoses.clamp) {
          weldLocal(WELD_CLAMP_SPOT.x, WELD_CLAMP_SPOT.y, WELD_CLAMP_SPOT.z, P.clamp.position);
          P.clamp.rotation.set(0, 0, 0);
        } else {
          at(P.clamp, 'clampRest', 0.1, 0.04, 0.02);
          P.clamp.rotation.set(0, 0.6, 0);
        }
      }
      P.clampCoil.visible = !s.hoses.clamp;
      at(P.clampCoil, 'clampRest', -0.08, 0.03, 0);
      P.clampCoil.rotation.set(Math.PI / 2, 0, 0);
      if (s.hoses.clamp) {
        C.clamp.a = v => weldMark('workSocket', v);
        C.clamp.aDir.set(0, 0, 1);
        C.clamp.b = v => P.clamp.getObjectByName('back').getWorldPosition(v);
        C.clamp.bDir.set(0, 0, 1);
      } else if (!weldRig.pose || weldRig.pose.cable !== 'clamp') { C.clamp.a = C.clamp.b = null; }
      // Wire spool on its spindle inside the welder
      if (s.wire && (!P.spool || P.spool.userData.name !== s.wire)) {
        if (P.spool) weldRig.group.remove(P.spool);
        P.spool = buildWeldSpoolModel(s.wire);
        P.spool.userData.name = s.wire;
        weldRig.group.add(P.spool);
      }
      if (P.spool && weldRig.inHand !== P.spool) { P.spool.visible = Boolean(s.wire); at(P.spool, 'spool'); }
      // Hood on its hook, gloves on top of the welder
      if (weldRig.inHand !== P.hoodOnHook) {
        P.hoodOnHook.visible = s.hoodAt === 'cart';
        at(P.hoodOnHook, 'hoodHook', -0.06, -0.1, 0);
        P.hoodOnHook.rotation.set(0.25, -Math.PI / 2, 0);
      }
      if (weldRig.inHand !== P.gloves) {
        P.gloves.visible = s.glovesAt === 'cart';
        at(P.gloves, 'glovesRest');
        P.gloves.rotation.set(0, 0.4, 0);
      }
      ensureWeldHood();
      if (weldRig.hood) weldRig.hood.visible = s.hoodAt === 'head';
      ensureWeldGauntlets();
      weldRig.gauntlets.forEach(gl => { gl.visible = s.glovesAt === 'hands'; });
      Object.values(C).forEach(c => { c.key = ''; });
    }

// The hood on his head: pivots at his headphone ears (js/kelo-body.js head rig)
function ensureWeldHood() {
      if (weldRig.hood || typeof keloHead === 'undefined' || !keloHead) return;
      const pivot = new THREE.Group();
      pivot.position.set(0, 0.3, 0);
      pivot.add(buildWeldHoodModel());
      pivot.rotation.x = weldRig.hoodAngle;
      pivot.visible = false;
      keloHead.add(pivot);
      weldRig.hood = pivot;
    }

// Leather gauntlets over his wrists
function ensureWeldGauntlets() {
      if (weldRig.gauntlets.length || typeof keloRightHand === 'undefined' || !keloRightHand) return;
      const leather = weldMat(0x9b7448, 0.9);
      weldRig.gauntlets = [keloLeftHand, keloRightHand].map(hand => {
        const g = new THREE.Group();
        weldMesh(new THREE.CylinderGeometry(0.068, 0.085, 0.13, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0x9b7448, roughness: 0.9, side: THREE.DoubleSide }), g, 0, 0.035, 0);
        weldMesh(new THREE.TorusGeometry(0.084, 0.008, 6, 16), leather, g, 0, -0.03, 0, Math.PI / 2, 0, 0);
        g.visible = false;
        hand.add(g);
        return g;
      });
    }

// --- Moving him through the steps ---------------------------------------------------------------------
const weldWait = ms => new Promise(r => setTimeout(r, ms));

function weldSay(title, speech) {
      if (title) state.moodTitle = title.slice(0, 80);
      if (speech) state.speechBubble = speech;
      renderAllUI();
    }

// Walk to a spot in the studio, then shuffle the last bit exactly onto it and face the work
async function weldWalkTo(spotKey) {
      const spot = WELD_SPOTS[spotKey];
      const w = weldLocal(spot.x, 0, spot.z);
      state.currentLocKey = 'custom';
      state.customPlaceName = 'his Welding Studio';
      weldRig.face = null;
      state.targetPos = { x: w.x, z: w.z };
      await waitForArrival(40000);
      const from = { ...state.botPos };
      const t0 = Date.now();
      while (Date.now() - t0 < 350) {
        const k = Math.min(1, (Date.now() - t0) / 350);
        state.botPos = { x: from.x + (w.x - from.x) * k, z: from.z + (w.z - from.z) * k };
        state.targetPos = { ...state.botPos };
        await weldWait(30);
      }
      state.botPos = { x: w.x, z: w.z };
      state.targetPos = { ...state.botPos };
      state.botRotY = spot.face;
      weldRig.face = spot.face;
      await weldWait(250);
    }

// Reach the right hand to a point (a function giving it in world space) and hold it there
async function weldReach(target, ms, opts = {}) {
      weldRig.pose = { kind: 'reach', target, side: opts.side || 'right', cable: opts.cable || null, both: Boolean(opts.both) };
      await weldWait(ms);
      weldRig.pose = null;
    }

// Something follows his right palm (a plug, the regulator, the hood...) until it's put down
function weldHold(obj) {
      weldRig.inHand = obj;
      if (obj) obj.visible = true;
    }

function weldPalmWorld(out, hand = keloRightHand) {
      const s = hand.userData.side || 1;
      return hand.localToWorld(out.set(-s * 0.024, -KELO_PALM - 0.02, 0.0));
    }

// Bring a thing from the Storehouse (or straight from where the delivery left it) to the studio
async function weldFetch(name, spotKey) {
      if (!name) return;
      const plain = plainItem(name).toLowerCase();
      weldSay(`Getting the ${plain} for the welder`, `First, the ${plain}. It belongs at the welder, not on a shelf.`);
      let got = null;
      try { got = typeof fetchFromStorehouse === 'function' ? await fetchFromStorehouse(name) : null; } catch (e) { got = null; }
      if (!got && typeof setCarriedObject === 'function' && typeof buildItemModel3D === 'function') setCarriedObject(lifeSize(buildItemModel3D(name, { label: false }), 1.1));
      const s = weldSetupState();
      const key = name.toLowerCase();
      if (!s.kept.includes(key)) s.kept.push(key);
      const ui = state.unstoredItems.indexOf(name);
      if (ui >= 0) state.unstoredItems.splice(ui, 1);
      await weldWalkTo(spotKey);
    }

function weldDropCarried() {
      if (typeof setCarriedObject === 'function') setCarriedObject(null);
    }

// Gear he needs this time, by role
function weldGear(plan) {
      const out = {};
      [...WELD_SAFETY, ...plan.consumables].forEach(m => { out[m.role] = { ...m, name: hasItem(m.re) }; });
      return out;
    }

// Everything before the arc: gear to the studio, cylinder and regulator, hoses and cables, valve and flow,
// machine settings, then hood and gloves on. Steps already done (saved in state.weldSetup) are skipped.
async function prepareWeldingStation(plan) {
      if (!weldRig.built) return false;
      const s = weldSetupState();
      const gear = weldGear(plan);
      const P = weldRig.parts, C = weldRig.cables;
      const info = plan.info;
      weldRig.active = true;
      state.moodEmoji = '🧰';
      // A different gas than the one on the cart (aluminium after steel...): swap the cylinder
      if (info.gas && s.cylinder && gear.gas.name && s.cylinder !== gear.gas.name) {
        await weldWalkTo('side');
        weldSay('Swapping the gas cylinder', `This job needs ${plainItem(gear.gas.ask).toLowerCase()}, so the ${plainItem(s.cylinder).toLowerCase()} comes off.`);
        s.valveOpen = false; s.regulator = false; s.hoses.gas = false;
        s.cylinder = null;
        syncWeldRig();
        await weldWait(900);
      }
      // 1. The cylinder onto the cart, chained to the rack
      if (info.gas && !s.cylinder && gear.gas.name) {
        await weldFetch(gear.gas.name, 'side');
        weldSay(`Chaining the gas cylinder onto the welder cart`, `${plainItem(gear.gas.name)}. Cylinders always stand chained up so they can't fall over.`);
        weldDropCarried();
        s.cylinder = gear.gas.name;
        syncWeldRig();
        await weldReach(v => P.cylinder.localToWorld(v.set(0.1, 0.75, 0)), 1800);
        s.flow = 0;
        savePersistentBrainState();
      }
      // 2. Regulator onto the cylinder valve
      if (info.gas && s.cylinder && !s.regulator) {
        await weldWalkTo('side');
        weldSay('Fitting the regulator', 'The regulator screws onto the cylinder valve. Hand-tight, then a snug turn with the wrench.');
        await weldReach(v => P.regulator.getWorldPosition(v), 700);
        weldHold(P.regulator);
        await weldReach(v => P.cylinder.getObjectByName('valveOut').getWorldPosition(v), 1600);
        weldHold(null);
        s.regulator = true;
        syncWeldRig();
        savePersistentBrainState();
      }
      // 3. Gas hose: regulator outlet to the welder's gas inlet
      if (info.gas && s.regulator && !s.hoses.gas) {
        await weldWalkTo('side');
        weldSay('Connecting the gas hose', 'Gas hose from the regulator to the welder: this end on the regulator barb...');
        await weldReach(v => P.regulator.getObjectByName('out').getWorldPosition(v), 1000);
        weldHold(P.plug);
        C.gas.a = v => P.regulator.getObjectByName('out').getWorldPosition(v);
        C.gas.aDir.set(0, -1, 0);
        C.gas.b = v => P.plug.getWorldPosition(v);
        C.gas.bDir.set(0, 1, 0);
        P.gasCoil.visible = false;
        weldSay(null, '...and the other end onto the gas inlet on the back of the welder.');
        await weldReach(v => weldMark('gasInlet', v), 1600, { cable: 'gas' });
        weldHold(null);
        P.plug.visible = false;
        s.hoses.gas = true;
        syncWeldRig();
        savePersistentBrainState();
      }
      // 4. Wire spool into the welder and threaded through the drive rolls (MIG only)
      if (plan.process === 'mig' && gear.wire.name && s.wire !== gear.wire.name) {
        if (s.wire) { s.wire = null; syncWeldRig(); }
        await weldFetch(gear.wire.name, 'side');
        weldSay('Loading the wire spool', `Open the side, put the ${plainItem(gear.wire.name).toLowerCase()} on the spindle...`);
        weldRig.doorOpen = 1;
        await weldWait(500);
        weldDropCarried();
        s.wire = gear.wire.name;
        syncWeldRig();
        weldHold(P.spool);
        await weldReach(v => weldMark('spool', v), 1500);
        weldHold(null);
        syncWeldRig();
        weldSay(null, '...thread the wire through the drive rolls and feed it up the gun liner. Then close the side.');
        await weldReach(v => weldMark('spool', v).add(_weldV2.set(0.02, 0.06, 0.18)), 1300);
        weldRig.doorOpen = 0;
        savePersistentBrainState();
      }
      // 5. Gun (or torch, or electrode holder) lead into its socket, then the gun onto the table
      if (!s.hoses.gun) {
        await weldWalkTo('front');
        weldSay(`Plugging in the ${info.lead}`, `The ${info.lead} plugs into the socket on the front and screws tight, so the current, wire and gas all get through.`);
        await weldReach(v => P.gunCoil.getWorldPosition(v), 800);
        weldHold(P.plug);
        P.gunCoil.visible = false;
        C.gun.a = v => P.gun.getObjectByName('back').getWorldPosition(v);
        C.gun.aDir.set(0, -1, 0);
        C.gun.b = v => P.plug.getWorldPosition(v);
        C.gun.bDir.set(0, 0, 1);
        await weldReach(v => weldMark('gunSocket', v), 1600, { cable: 'gun' });
        weldHold(null);
        P.plug.visible = false;
        s.hoses.gun = true;
        syncWeldRig();
        // Lay the gun on the table, ready
        await weldReach(v => P.gun.getWorldPosition(v), 700);
        weldHold(P.gun);
        await weldWalkTo('weld');
        weldSay(null, `The ${info.gun} goes on the table, ready to pick up.`);
        await weldReach(v => weldLocal(WELD_GUN_REST.x, WELD_GUN_REST.y + 0.03, WELD_GUN_REST.z, v), 1000);
        weldHold(null);
        syncWeldRig();
        savePersistentBrainState();
      }
      // 6. Work clamp: cable into the (-) socket, clamp onto the table so the current has a path back
      if (!s.hoses.clamp) {
        await weldWalkTo('front');
        weldSay('Connecting the work clamp', 'The work clamp cable goes in the other socket. Twist to lock.');
        await weldReach(v => P.clampCoil.getWorldPosition(v), 800);
        weldHold(P.plug);
        P.clampCoil.visible = false;
        C.clamp.a = v => P.clamp.getObjectByName('back').getWorldPosition(v);
        C.clamp.aDir.set(0, 0, 1);
        C.clamp.b = v => P.plug.getWorldPosition(v);
        C.clamp.bDir.set(0, 0, 1);
        await weldReach(v => weldMark('workSocket', v), 1500, { cable: 'clamp' });
        weldHold(null);
        P.plug.visible = false;
        C.clamp.a = v => weldMark('workSocket', v);
        C.clamp.b = v => P.clamp.getObjectByName('back').getWorldPosition(v);
        weldSay(null, 'And the clamp goes on the steel table, on bare metal, so the circuit is complete.');
        await weldReach(v => P.clamp.getWorldPosition(v), 700, { cable: 'clamp' });
        weldHold(P.clamp);
        await weldReach(v => weldLocal(WELD_CLAMP_SPOT.x, WELD_CLAMP_SPOT.y + 0.02, WELD_CLAMP_SPOT.z, v), 1500, { cable: 'clamp' });
        weldHold(null);
        s.hoses.clamp = true;
        syncWeldRig();
        savePersistentBrainState();
      }
      // 7. Open the cylinder valve slowly, then set the flow on the regulator
      if (info.gas && !s.valveOpen) {
        await weldWalkTo('side');
        weldSay('Opening the cylinder valve', 'Stand to the side of the regulator and open the cylinder valve slowly... the gauge comes up to full pressure.');
        weldRig.valveTurning = 1;
        await weldReach(v => P.cylinder.userData.wheel.getWorldPosition(v), 1800);
        weldRig.valveTurning = 0;
        s.valveOpen = true;
        const flow = gear.gas.flow || 25;
        if (s.flow !== flow) {
          weldSay('Setting the regulator', `Now the flow: I turn the knob until the ball sits at ${flow} CFH. Enough gas to shield the weld, not so much it pulls air in.`);
          await weldReach(v => P.regulator.localToWorld(v.set(0.07, -0.035, 0.05)), 1800);
          s.flow = flow;
        } else {
          weldSay('Checking the flow', `Flow is still set at ${flow} CFH. Good.`);
          await weldWait(900);
        }
        savePersistentBrainState();
      }
      // 8. Machine settings for this metal
      await weldWalkTo('front');
      weldSay('Setting the welder', `${plan.process === 'mig' ? 'Voltage and wire speed' : 'Amperage'} set for 1/8-inch ${plan.metal}, from the chart inside the door.`);
      await weldReach(v => weldMark('knobs', v), 1300);
      // 9. Hood and gloves: fetched the first time, then they live on the cart
      if (s.hoodAt !== 'cart' && s.hoodAt !== 'head' && gear.hood.name) {
        await weldFetch(gear.hood.name, 'front');
        weldDropCarried();
        s.hoodAt = 'cart';
        syncWeldRig();
      }
      if (s.glovesAt !== 'cart' && s.glovesAt !== 'hands' && gear.gloves.name) {
        await weldFetch(gear.gloves.name, 'front');
        weldDropCarried();
        s.glovesAt = 'cart';
        syncWeldRig();
      }
      if (s.glovesAt === 'cart') {
        weldSay('Gloves on', 'Leather gloves on. Spatter is hot.');
        await weldReach(v => P.gloves.getWorldPosition(v), 900);
        s.glovesAt = 'hands';
        syncWeldRig();
      }
      if (s.hoodAt === 'cart') {
        weldSay('Putting on my welding hood', 'Hood on, flipped up for now. It comes down before the arc, every time.');
        await weldReach(v => P.hoodOnHook.getWorldPosition(v), 800);
        weldHold(P.hoodOnHook);
        await weldReach(v => keloHead.localToWorld(v.set(0, 0.45, 0.25)), 900);
        weldHold(null);
        s.hoodAt = 'head';
        weldRig.hoodAngle = -1.75;
        syncWeldRig();
      }
      savePersistentBrainState();
      return true;
    }

// The welding itself: pick up the gun, tack the joint at both ends and the middle, then run the bead.
// onProgress(0..1) lets the workshop grow the piece on the table as he goes.
async function runWeldPasses(plan, onProgress = () => {}) {
      if (!weldRig.built) return false;
      const info = plan.info;
      await weldWalkTo('weld');
      state.currentLocKey = 'weld';
      state.customPlaceName = null;
      state.moodEmoji = '👨‍🏭';
      clearWeldBead();
      weldRig.joint.visible = true;
      // Pick up the gun
      weldSay(`Picking up the ${info.gun}`, 'Two plates butted together. Gun in hand...');
      await weldReach(v => weldRig.parts.gun.getWorldPosition(v), 700);
      weldRig.holdingGun = true;
      syncWeldRig();
      const J = WELD_JOINT;
      const seam = (u, out = new THREE.Vector3()) => weldLocal(J.x0 + (J.x1 - J.x0) * u, J.y, J.z, out);
      weldRig.pose = { kind: 'weld', u: 0 };
      await weldWait(900);
      // Tacks
      weldSay('Tack welding the joint', 'Hood down. Tack, tack, tack: it holds the plates while I run the bead.');
      for (const u of [0.04, 0.96, 0.5]) {
        weldRig.pose.u = u;
        await weldWait(600);
        await weldHoodDown();
        weldStrike(true);
        const p = seam(u);
        for (let i = 0; i < 4; i++) { addWeldRipple(p.x + (i - 1.5) * 0.004, p.z, 1.15); await weldWait(110); }
        weldStrike(false);
      }
      onProgress(0.25);
      await weldWait(400);
      weldRig.hoodDown = false;
      weldSay(null, 'Tacks look good. Now the full bead, nice and steady.');
      await weldWait(1100);
      // The bead
      const beadMs = 5200;
      weldRig.pose.u = 0;
      await weldWait(500);
      await weldHoodDown();
      weldSay(`${info.name} welding the joint`, plan.process === 'mig' ? 'Bzzzzzzt... push the puddle along, keep the gun at a slight angle.' : plan.process === 'tig' ? 'Dab the filler rod in, move the torch, dab... like stacking dimes.' : 'Crackle... drag the rod along, keep the arc short.');
      weldStrike(true);
      const t0 = Date.now();
      let last = -1;
      while (Date.now() - t0 < beadMs) {
        const u = Math.min(1, (Date.now() - t0) / beadMs);
        weldRig.pose.u = u;
        const n = Math.floor(u * 64);
        while (last < n) { last++; const p = seam(last / 64); addWeldRipple(p.x, p.z, 1 + 0.08 * Math.sin(last * 1.3)); }
        onProgress(0.25 + 0.7 * u);
        await weldWait(40);
      }
      weldStrike(false);
      // Post-flow: the gas keeps flowing a moment to protect the cooling weld
      await weldWait(600);
      weldRig.hoodDown = false;
      weldRig.pose = { kind: 'look' };
      weldSay('Looking over the weld', plan.process === 'stick' ? 'Chip the slag off... a nice even bead, cooling from orange to grey.' : 'Hood up. Look at that: an even bead, glowing orange and cooling to grey.');
      onProgress(1);
      await weldWait(2600);
      // Gun back on the table
      weldRig.pose = null;
      await weldReach(v => weldLocal(WELD_GUN_REST.x, WELD_GUN_REST.y + 0.03, WELD_GUN_REST.z, v), 800);
      weldRig.holdingGun = false;
      syncWeldRig();
      return true;
    }

async function weldHoodDown() {
      if (weldRig.hoodDown) return;
      weldRig.nodAt = weldRig.clock;
      await weldWait(180);
      weldRig.hoodDown = true;
      await weldWait(220);
    }

function weldStrike(on) {
      weldRig.arc = on;
      if (on) weldRig.arcStarted = weldRig.clock;
    }

// After the weld: close the cylinder, hood and gloves back on the cart, use up the consumables
async function finishWeldingSession(plan) {
      const s = weldSetupState();
      const P = weldRig.parts;
      try {
        if (!weldRig.built) return;
        if (plan.info.gas && s.valveOpen && P.cylinder) {
          await weldWalkTo('side');
          weldSay('Closing the cylinder valve', 'Done for now: cylinder valve closed so no gas leaks away. The hoses stay connected for next time.');
          weldRig.valveTurning = -1;
          await weldReach(v => P.cylinder.userData.wheel.getWorldPosition(v), 1300);
          weldRig.valveTurning = 0;
          s.valveOpen = false;
        }
        await weldWalkTo('front');
        if (s.hoodAt === 'head') {
          weldSay('Hanging up my hood', 'Hood back on its hook on the cart, gloves on top of the welder.');
          weldHold(P.hoodOnHook);
          s.hoodAt = 'cart';
          if (weldRig.hood) weldRig.hood.visible = false;
          await weldReach(v => weldMark('hoodHook', v).add(_weldV2.set(-0.06, -0.1, 0)), 1000);
          weldHold(null);
        }
        if (s.glovesAt === 'hands') {
          s.glovesAt = 'cart';
          syncWeldRig();
          await weldReach(v => P.gloves.getWorldPosition(v), 700);
        }
        syncWeldRig();
      } finally {
        useWeldSupplies(plan);
        s.welds = (s.welds || 0) + 1;
        weldRig.pose = null;
        weldRig.inHand = null;
        weldRig.holdingGun = false;
        weldRig.arc = false;
        weldRig.hoodDown = false;
        weldRig.active = false;
        clearWeldBead();
        syncWeldRig();
        savePersistentBrainState();
      }
    }

// One weld's worth of each consumable. An empty cylinder comes off (a spare goes on next time); an
// empty spool comes out of the welder. When the last is gone useUpItem notes it and asks for more.
let weldLastPlan = null;
function useWeldSupplies(plan = weldLastPlan) {
      if (!plan) plan = weldPlanFor(null);
      const s = weldSetupState();
      const used = [];
      plan.consumables.forEach(m => {
        const name = hasItem(m.re);
        if (!name) return;
        const before = typeof supplyOf === 'function' ? supplyOf(name) : null;
        const res = useUpItem(name, 1, { why: 'welding' });
        used.push(name);
        const finished = res && (res.ranOut || (before && before.cur <= 1));
        if (!finished) return;
        if (m.role === 'gas' && s.cylinder === name) { s.cylinder = null; s.regulator = false; s.hoses.gas = false; s.valveOpen = false; }
        if (m.role === 'wire' && s.wire === name) s.wire = null;
        if (res.ranOut) s.kept = s.kept.filter(k => k !== name.toLowerCase());
      });
      syncWeldRig();
      return used;
    }

// The whole welded job at the table, used by runWeldJob (js/workshop.js)
async function weldTheJob(creation, onProgress) {
      const plan = weldPlanFor(creation);
      weldLastPlan = plan;
      try {
        await prepareWeldingStation(plan);
        await runWeldPasses(plan, onProgress);
      } finally {
        await finishWeldingSession(plan);
      }
      return true;
    }

// --- Every frame, before his pose is blended (scene.js): reaching, welding, looking -----------------
// Right or left arm reaches so the end point (palm or gun tip) lands on target; a small search over
// the shoulder and elbow angles, warm-started from the last frame.
function weldSolveArm(side, target, endFn) {
      const arm = side === 'right' ? keloRightArm : keloLeftArm;
      const elbow = side === 'right' ? keloRightElbow : keloLeftElbow;
      const zOff = side === 'right' ? 0.1 : -0.1;
      const lo = [-3.0, side === 'right' ? -0.5 : -1.3, -2.5], hi = [0.7, side === 'right' ? 1.3 : 0.5, 0];
      let p = weldRig.ik[side] ? weldRig.ik[side].slice() : [-1.1, side === 'right' ? 0.1 : -0.1, -0.5];
      keloGroup.updateMatrixWorld(true);
      const err = q => {
        arm.rotation.set(q[0], 0, q[1] + zOff);
        elbow.rotation.set(q[2] - 0.16, 0, 0);
        arm.updateMatrixWorld(true);
        endFn(_weldV);
        return _weldV.distanceToSquared(target);
      };
      let best = err(p);
      for (const step of [0.2, 0.1, 0.05, 0.025, 0.012]) {
        for (let pass = 0, better = true; better && pass < 5; pass++) {
          better = false;
          for (let i = 0; i < 3; i++) {
            for (const d of [-step, step]) {
              const q = p.slice();
              q[i] = Math.max(lo[i], Math.min(hi[i], q[i] + d));
              const e = err(q);
              if (e < best - 1e-8) { best = e; p = q; better = true; }
            }
          }
        }
      }
      weldRig.ik[side] = p;
      arm.rotation.set(p[0], 0, p[1]);
      elbow.rotation.set(p[2], 0, 0);
      return Math.sqrt(best);
    }

function poseKeloForWelding(t) {
      if (typeof poseKeloAtWorkBench === 'function') poseKeloAtWorkBench(t);
      if (!weldRig.active || !keloBody) return;
      // Nothing else is welding while he sets up: no stray arc, sparks or torch from the old routine
      if (typeof weldingSparks !== 'undefined' && weldingSparks) weldingSparks.visible = false;
      if (typeof forgeArcLight !== 'undefined' && forgeArcLight) forgeArcLight.intensity = 0;
      if (keloWeldTorchGroup) keloWeldTorchGroup.visible = weldRig.holdingGun;
      if (keloDrillToolGroup) keloDrillToolGroup.visible = false;
      if (state.isWalking) {
        if (!weldRig.holdingGun) { keloRightArm.rotation.set(0, 0, 0); keloRightElbow.rotation.set(0, 0, 0); }
        return;
      }
      // Standing: start from rest so the old weld pose doesn't leak in
      KELO_JOINTS.forEach(([, get]) => get().rotation.set(0, 0, 0));
      keloBody.position.set(0, KELO_HIP_Y, 0);
      keloLeftHand.userData.grip = keloRightHand.userData.grip = KELO_REST_GRIP;
      keloAnim.mode = weldRig.pose ? 'other' : 'idle';
      keloAnim.rate = 1;
      const face = weldRig.face !== null ? weldRig.face : state.botRotY;
      keloGroup.rotation.set(0, face, 0);
      const gy = state.botAltitudeY;
      keloGroup.position.set(state.botPos.x, gy, state.botPos.z);
      const pose = weldRig.pose;
      if (!pose) return;
      if (pose.kind === 'reach') {
        const target = pose.target(new THREE.Vector3());
        const h = target.y - gy;
        const drop = h < 1.0 ? Math.min(0.42, (1.0 - h) * 0.75) : 0;
        if (drop > 0) { keloSquat(drop); keloGroup.position.y = gy - drop; }
        keloBody.rotation.x = h < 1.2 ? 0.28 : 0.08;
        const hand = pose.side === 'left' ? keloLeftHand : keloRightHand;
        hand.userData.grip = 0.6;
        weldSolveArm(pose.side, target, v => weldPalmWorld(v, hand));
        // Look at what his hand is doing
        const dx = target.x - state.botPos.x, dz = target.z - state.botPos.z;
        const horiz = Math.max(0.2, Math.hypot(dx, dz));
        keloHead.rotation.x = Math.max(-0.3, Math.min(0.55, Math.atan2(gy + 2.0 - drop - target.y, horiz) * 0.7));
        return;
      }
      if (pose.kind === 'look') {
        // Bent over the cooling bead, head tilted to see it
        keloBody.rotation.x = 0.22;
        keloHead.rotation.set(0.45, 0.15, -0.12);
        keloRightArm.rotation.set(-0.7, 0, 0.1);
        keloRightElbow.rotation.x = -0.9;
        keloRightHand.userData.grip = 1;
        keloLeftArm.rotation.set(-0.5, 0, -0.1);
        keloLeftElbow.rotation.x = -0.6;
        return;
      }
      if (pose.kind === 'weld') {
        keloAnim.mode = 'weld';
        keloBody.rotation.x = weldRig.lean;
        keloLeftLeg.rotation.x = -0.15;
        keloLeftKnee.rotation.x = 0.15;
        keloRightLeg.rotation.x = 0.1;
        keloRightHand.userData.grip = 1;
        keloRightHand.rotation.set(0.25, 0, 0);
        const J = WELD_JOINT;
        const u = pose.u || 0;
        const seam = weldLocal(J.x0 + (J.x1 - J.x0) * u, J.y, J.z);
        // The gun tip sits just above the joint: the wire stick-out and the arc gap
        const tipTarget = seam.clone().add(_weldV2.set(0, 0.03, 0.012));
        const e = weldSolveArm('right', tipTarget, v => keloWeldTipGlow.getWorldPosition(v));
        if (e > 0.03 && weldRig.lean < 0.5) weldRig.lean += 0.01;
        // Left hand steadies on the table beside the plates
        keloLeftHand.userData.grip = 0.2;
        weldSolveArm('left', weldLocal(0.32, 0.96, 0.64), v => weldPalmWorld(v, keloLeftHand));
        // Head down to watch the puddle; a quick nod flips the hood down
        const nod = Math.max(0, 1 - Math.abs(weldRig.clock - weldRig.nodAt - 0.1) / 0.15);
        keloHead.rotation.set(0.4 + nod * 0.35, -0.12, 0);
      }
    }

// --- Every frame, after his pose is final (from updateWeldingStudio): hand-held things, cables, the arc ---
let weldLastT = null;
function updateWeldingRigAfterPose(t) {
      if (!weldRig.built) return false;
      const dt = weldLastT === null ? 1 / 60 : Math.max(0, Math.min(0.1, t - weldLastT));
      weldLastT = t;
      weldRig.clock += dt;
      const P = weldRig.parts;
      // Something in his hand follows his palm
      if (weldRig.inHand && keloRightHand) {
        keloGroup.updateMatrixWorld(true);
        weldPalmWorld(weldRig.inHand.position, keloRightHand);
        if (weldRig.inHand === P.hoodOnHook || weldRig.inHand === P.regulator) weldRig.inHand.rotation.set(0, keloGroup.rotation.y, 0);
      }
      Object.values(weldRig.cables).forEach(updateWeldCable);
      // The hood flips: up, or down for the arc
      if (weldRig.hood) {
        const want = weldRig.hoodDown ? 0 : -1.75;
        weldRig.hoodAngle += (want - weldRig.hoodAngle) * (1 - Math.exp(-(weldRig.hoodDown ? 22 : 8) * dt));
        weldRig.hood.rotation.x = weldRig.hoodAngle;
        const lens = weldRig.hood.children[0] && weldRig.hood.children[0].userData.lens;
        if (lens) {
          lens.material.color.setHex(weldRig.arc ? 0x050806 : 0x2c5d3c);
          lens.material.emissiveIntensity = weldRig.arc ? 0 : 0.4;
        }
      }
      // Wire door, valve wheel, gauges
      if (weldStudio.door) weldStudio.door.rotation.y += ((weldRig.doorOpen ? -1.5 : 0) - weldStudio.door.rotation.y) * (1 - Math.exp(-6 * dt));
      if (P.cylinder && weldRig.valveTurning) P.cylinder.userData.wheel.rotation.y += weldRig.valveTurning * dt * 4;
      const s = state.weldSetup || {};
      const gaugeWant = s.valveOpen && s.regulator ? 1 : 0;
      weldRig.gaugeShown += (gaugeWant - weldRig.gaugeShown) * (1 - Math.exp(-3 * dt));
      weldRig.flowShown += ((s.valveOpen ? (s.flow || 0) : 0) - weldRig.flowShown) * (1 - Math.exp(-3 * dt));
      if (P.regulator.userData.needle) {
        P.regulator.userData.needle.rotation.x = 1.2 - 2.3 * weldRig.gaugeShown;
        P.regulator.userData.ball.position.y = 0.04 + 0.1 * Math.min(1, weldRig.flowShown / 40) * (weldRig.arc ? 1 : 0.92);
      }
      updateWeldArc(dt);
      updateWeldBead(t);
      return weldRig.active;
    }

function updateWeldArc(dt) {
      const arcOn = weldRig.arc && weldRig.holdingGun && keloWeldTipGlow;
      const flare = weldStudio.flare;
      const sparks = weldRig.sparks;
      const pts = sparks.userData.p;
      if (arcOn) {
        keloWeldTipGlow.getWorldPosition(_weldV);
        const J = WELD_JOINT;
        const u = weldRig.pose && weldRig.pose.kind === 'weld' ? weldRig.pose.u : 0;
        const seam = weldLocal(J.x0 + (J.x1 - J.x0) * u, J.y + 0.004, J.z, _weldV2);
        weldRig.arcAt.copy(seam);
        // The arc: a short jagged line from the wire tip to the puddle, and a white-hot core
        const pos = weldRig.arcLine.geometry.attributes.position;
        for (let i = 0; i < 8; i++) {
          const k = i / 7;
          const j = i === 0 || i === 7 ? 0 : 0.006;
          pos.setXYZ(i, _weldV.x + (seam.x - _weldV.x) * k + (Math.random() - 0.5) * j, _weldV.y + (seam.y - _weldV.y) * k, _weldV.z + (seam.z - _weldV.z) * k + (Math.random() - 0.5) * j);
        }
        pos.needsUpdate = true;
        weldRig.arcLine.visible = true;
        weldRig.arcCore.visible = true;
        weldRig.arcCore.position.copy(seam).lerp(_weldV, 0.3);
        const c = 0.07 + Math.random() * 0.06;
        weldRig.arcCore.scale.set(c, c, 1);
        // The shop flare (js/weldstudio.js) sits on the arc and flickers
        flare.visible = true;
        flare.position.copy(seam).sub(weldStudio.group.position);
        const f = 0.45 + Math.random() * 0.55;
        flare.scale.set(f, f, 1);
        flare.material.opacity = 0.65 + Math.random() * 0.35;
        // The light: bright, blue-white, flickering
        if (typeof forgeArcLight !== 'undefined' && forgeArcLight) {
          forgeArcLight.position.copy(seam).add(_weldV.set(0, 0.12, 0.1));
          forgeArcLight.color.setHex(0xb8dcff);
          forgeArcLight.intensity = (2 + Math.random() * 2.2) * (renderer && renderer.physicallyCorrectLights ? 6 : 1);
        }
        // New sparks shoot out of the puddle
        let born = 0;
        for (const p of pts) {
          if (p.life < p.max || born > 5) continue;
          born++;
          p.x = seam.x; p.y = seam.y + 0.005; p.z = seam.z;
          const a = Math.random() * Math.PI * 2, sp = 0.5 + Math.random() * 1.6;
          p.vx = Math.cos(a) * sp * 0.6; p.vz = Math.sin(a) * sp * 0.6 + 0.15; p.vy = 0.4 + Math.random() * 1.4;
          p.life = 0; p.max = 0.35 + Math.random() * 0.7;
        }
        // Spatter now and then: a droplet that lands and sticks near the bead
        if (Math.random() < dt * 4 && weldRig.spatter.dots.length < weldRig.spatter.MAXS) {
          const a = Math.random() * Math.PI * 2, d = 0.02 + Math.random() * 0.07;
          weldRig.spatter.dots.push({ x: seam.x + Math.cos(a) * d, y: seam.y + 0.001, z: seam.z + Math.sin(a) * d * 0.7, r: 0.0025 + Math.random() * 0.003, born: weldRig.clock });
        }
        // Fumes curl up toward the extractor hood
        if (Math.random() < dt * 6) {
          const f = weldRig.fumes.find(s => s.userData.life >= 1);
          if (f) { f.userData.life = 0; f.position.copy(seam); f.visible = true; f.userData.vx = (Math.random() - 0.5) * 0.05; }
        }
      } else {
        weldRig.arcLine.visible = false;
        weldRig.arcCore.visible = false;
        if (weldRig.active) {
          flare.visible = false;
          if (typeof forgeArcLight !== 'undefined' && forgeArcLight) forgeArcLight.intensity = 0;
        }
      }
      // Sparks fly, fall and bounce off the table, fading from yellow-white to red
      const tableY = weldLocal(0, 0.92, 0).y;
      const pos = sparks.geometry.attributes.position, col = sparks.geometry.attributes.color;
      let alive = 0;
      pts.forEach((p, i) => {
        if (p.life < p.max) {
          p.life += dt;
          p.vy -= 3.2 * dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          const onTable = Math.abs(p.x - WELD_STUDIO.x) < 1.2 && Math.abs(p.z - WELD_STUDIO.z) < 0.7;
          const floorY = onTable ? tableY : (weldStudio.gy + 0.06);
          if (p.y < floorY) { p.y = floorY; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
          const k = 1 - p.life / p.max;
          col.setXYZ(i, 1.4 * k + 0.3, 0.9 * k * k + 0.1, 0.4 * k * k * k);
          alive++;
        } else {
          col.setXYZ(i, 0, 0, 0);
          p.y = -99;
        }
        pos.setXYZ(i, p.x, p.y, p.z);
      });
      sparks.visible = alive > 0;
      pos.needsUpdate = true;
      col.needsUpdate = true;
      weldRig.fumes.forEach(f => {
        if (f.userData.life >= 1) { f.visible = false; return; }
        f.userData.life += dt / 2.2;
        const L = f.userData.life;
        f.position.y += dt * 0.35;
        f.position.x += f.userData.vx * dt;
        f.position.z -= dt * 0.12;
        f.scale.setScalar(0.08 + L * 0.35);
        f.material.opacity = 0.28 * Math.sin(Math.PI * Math.min(1, L));
      });
    }

// What he knows and has for welding, for the AI's picture of his life
function weldingSummaryForAI() {
      const plan = weldPlanFor(null);
      if (!jobKnown(plan.key)) return `${plan.info.title}: not learned yet`;
      const miss = missingForJob(plan.key);
      const s = weldSetupState();
      return `${plan.info.title}: ${miss.length ? 'still need ' + miss.map(m => m.ask.toLowerCase()).join(', ') : 'have everything'}; hoses ${s.hoses.gas && s.hoses.gun && s.hoses.clamp ? 'all connected' : 'not all connected'}; ${s.welds || 0} welds done`;
    }

// --- Item models for the welding things (built in metres; the counter and shelves scale them) ---------
if (typeof ITEM_MODEL_RULES !== 'undefined') ITEM_MODEL_RULES.unshift(
  [/shielding gas|gas cylinder|argon|\bco2\b.*cylinder|tri-?mix/, lower => {
    const m = buildWeldCylinderModel(lower);
    m.scale.setScalar(0.62);
    const g = new THREE.Group();
    g.add(m);
    return realSize(g);
  }],
  [/welding wire|mig wire|er70s-6|er4043.*wire|er308l?.*wire/, lower => {
    const g = new THREE.Group();
    const s = buildWeldSpoolModel(lower);
    s.rotation.z = Math.PI / 2;
    s.position.y = 0.1;
    s.scale.setScalar(0.9);
    g.add(s);
    return realSize(g);
  }],
  [/welding (hood|helmet|mask)|auto-?darkening/, () => {
    const g = new THREE.Group();
    const h = buildWeldHoodModel();
    h.scale.setScalar(0.42);
    h.position.y = 0.16;
    g.add(h);
    return realSize(g);
  }],
  [/welding (gloves|gauntlets)|welder'?s gloves/, () => realSize(buildWeldGlovesModel())],
  [/tungsten|filler rods?|tig rods?|electrodes?|welding rods?/, lower => {
    const g = new THREE.Group();
    const tube = /tungsten/.test(lower);
    const box = weldMesh(new THREE.BoxGeometry(tube ? 0.05 : 0.12, 0.04, tube ? 0.2 : 0.36), weldMat(tube ? 0x2563eb : /stick|e\d{4}|electrode/.test(lower) ? 0xb91c1c : 0x0f766e, 0.6), g, 0, 0.02, 0);
    box.castShadow = true;
    for (let i = 0; i < 5; i++) weldMesh(new THREE.CylinderGeometry(0.003, 0.003, tube ? 0.17 : 0.45, 5), weldMat(tube ? 0x9ca3af : 0xa3a3a3, 0.4, 0.8), g, -0.03 + i * 0.015, 0.05, 0.02, Math.PI / 2, 0, 0);
    return realSize(g);
  }]
);

window.addEventListener('DOMContentLoaded', () => {
  // A reload mid-weld: he took the hood and gloves off, and the arc stopped
  setTimeout(() => {
    const s = weldSetupState();
    if (s.hoodAt === 'head') s.hoodAt = 'cart';
    if (s.glovesAt === 'hands') s.glovesAt = 'cart';
    syncWeldRig();
  }, 1200);
});
