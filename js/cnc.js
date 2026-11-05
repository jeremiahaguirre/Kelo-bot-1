// Kelo-bot-1 — js/cnc.js
// Loaded after additive.js. The CNC machines on floor 1 of his Workshop, each with what the real
// machine needs: tooling (end mills, V-bits, compression bits, face mills), stock (plywood, MDF,
// aluminium, steel, a big casting), workholding (clamps and a spoilboard, a vacuum table, a vise,
// fixtures), dust collection for the routers, flood coolant for the mills, safety glasses and ear
// defenders. Every job is the real sequence: he writes the CAM toolpaths (the G-code is saved),
// loads and holds the work down, homes the machine, zeroes the tool, then cuts, with dust or chips
// and coolant flying.
//   - Avid CNC PRO4896 and PRO60120: large modular routers for wood and plastics
//   - Sienci AltMill 4x8: a production router
//   - ShopSaber IS 510: a heavy welded-steel sheet router with a vacuum table
//   - Laguna SmartShop: an industrial router with a tool changer, for cabinets and signs
//   - Haas VS-1 and VS-3: big vertical machining centres
//   - Waldrich Coburg Taurus: a giant gantry mill in its own high bay

// --- Chips, dust and coolant ------------------------------------------------------------------------
// A small pool of particles per machine while it cuts (they fly, fall and fade)
function wsSpray(model, from, opts) {
      const u = model.userData;
      if (!u.spray) u.spray = [];
      const n = opts.rate || 2;
      for (let i = 0; i < n && u.spray.length < (opts.max || 40); i++) {
        const mat = opts.mat || (opts.mat = new THREE.MeshStandardMaterial({ color: opts.color, roughness: 0.4, metalness: opts.metal ? 0.8 : 0, transparent: true, opacity: 0.9, depthWrite: false }));
        const p = new THREE.Mesh(MM_GEO.box, mat);
        p.userData.sharedGeometry = true;
        p.scale.setScalar(opts.size || 0.015);
        p.position.copy(from);
        const a = Math.random() * Math.PI * 2, sp = (opts.speed || 1) * (0.5 + Math.random());
        p.userData.v = new THREE.Vector3(Math.cos(a) * sp, (opts.up || 0.6) * Math.random() * sp, Math.sin(a) * sp);
        p.userData.life = 0;
        model.add(p);
        u.spray.push(p);
      }
      const dt = 1 / 60;
      u.spray = u.spray.filter(p => {
        p.userData.life += dt;
        p.userData.v.y -= (opts.gravity === undefined ? 4 : opts.gravity) * dt;
        p.position.addScaledVector(p.userData.v, dt);
        if (p.position.y < (opts.floor || 0)) { p.position.y = opts.floor || 0; p.userData.v.set(0, 0, 0); }
        p.rotation.x += 0.2;
        if (p.userData.life > (opts.life || 0.9)) { model.remove(p); return false; }
        return true;
      });
    }

function wsClearSpray(model) {
      const u = model.userData;
      (u.spray || []).forEach(p => model.remove(p));
      u.spray = [];
    }

// A hold-down clamp: a stepped block outside the sheet, a slotted strap across onto the sheet edge,
// the stud through the T-track and its flange nut
function routerClamp(parent, x, y, z, side) {
      const c = mmGroup(parent, x, y, z);
      [0, 1, 2].forEach(i => mmBox(c, 0.05 - i * 0.012, 0.016, 0.06, 'dark', side * (0.03 + i * 0.006), i * 0.016, 0));
      mmBox(c, 0.16, 0.014, 0.035, 'steel', -side * 0.03, 0.048, 0);
      mmCyl(c, 0.008, 0.09, 'chrome', -side * 0.01, 0.05, 0);
      mmCyl(c, 0.016, 0.014, 'steel', -side * 0.01, 0.066, 0, { seg8: true });
      return c;
    }

// --- The routers ---------------------------------------------------------------------------------------
// Letters for a sign (strokes in a 0..1 box), so the cutter traces something real
const SIGN_STROKES = [
  // a border
  [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
  // K
  [[0.1, 0.2], [0.1, 0.8]], [[0.25, 0.8], [0.1, 0.5], [0.25, 0.2]],
  // E
  [[0.45, 0.2], [0.33, 0.2], [0.33, 0.8], [0.45, 0.8]], [[0.33, 0.5], [0.43, 0.5]],
  // L
  [[0.53, 0.2], [0.53, 0.8], [0.65, 0.8]],
  // O
  [[0.75, 0.2], [0.9, 0.2], [0.9, 0.8], [0.75, 0.8], [0.75, 0.2]]
];

function strokePoints(strokes, w, d) {
      const pts = [];
      strokes.forEach(st => {
        st.forEach((p, i) => pts.push({ x: (p[0] - 0.5) * w, z: (p[1] - 0.5) * d, down: i > 0 }));
      });
      return pts;
    }

// A pocket and outline for a bracket or panel (cut-outs)
const PART_STROKES = [
  [[0.1, 0.15], [0.9, 0.15], [0.9, 0.85], [0.1, 0.85], [0.1, 0.15]],
  [[0.3, 0.4], [0.7, 0.4], [0.7, 0.6], [0.3, 0.6], [0.3, 0.4]]
];

function cncProgram(def, name, pts) {
      const lines = ['%', `(${name.toUpperCase().slice(0, 40)})`, 'G21 G90 G17', 'G28 G91 Z0', 'G90 G54', def.mill ? 'T1 M6' : 'M6 T1', 'S18000 M3', def.mill ? 'M8' : '(DUST COLLECTOR ON)', 'G0 Z5.'];
      pts.slice(0, 40).forEach(p => {
        if (p.down) lines.push(`G1 X${(p.x * 100).toFixed(2)} Y${(-p.z * 100).toFixed(2)} F2400.`);
        else lines.push('G0 Z5.', `G0 X${(p.x * 100).toFixed(2)} Y${(-p.z * 100).toFixed(2)}`, 'G1 Z-3.2 F600.');
      });
      lines.push('G0 Z25.', 'M5', def.mill ? 'M9' : '', 'G28 G91 Z0', 'M30', '%');
      return lines.filter(Boolean).join('\n');
    }

// Write the toolpaths: the program is kept, so you can read what he wrote (state.workshop.programs)
async function writeCam(ctx, def, name, pts) {
      const prog = cncProgram(def, name, pts);
      const w = workshopState();
      w.programs[def.key] = { name, at: Date.now(), gcode: prog };
      await machineStep(ctx, `Writing the CAM toolpaths for ${wsThing(name)}`, 2200, null, `Toolpaths done: ${prog.split('\n').length} lines of G-code. Feeds and speeds checked twice.`);
    }

// Move a router's head to a local (x, z) and height (0 = up)
function routerHead(u, x, z, plunge = 0) {
      u.gantry.position.x = Math.max(-u.travel.x, Math.min(u.travel.x, x));
      u.carriage.position.z = Math.max(-u.travel.z, Math.min(u.travel.z, z));
      u.zSlide.position.y = -plunge;
    }

function routerPlan(def, job) {
      const key = def.key;
      const sign = /sign|letter|name|plaque|carv/i.test(job.make || '') || (!job.make && def.signs);
      const mdf = /\bmdf\b|cabinet door/i.test(job.make || '') || def.stock === 'mdf';
      const name = job.make ? madeName(def.prefix, mdf ? 'MDF' : 'plywood', job.make, def.products[0]) : (sign ? def.products[0] : wsPick(def.products));
      const strokes = sign ? SIGN_STROKES : PART_STROKES;
      return {
        title: `Routing ${wsThing(name).replace(/^[A-Za-z]+-routed /, '')} on the ${def.name}`, product: name,
        speech: `Safety glasses and ear defenders on. Router day!`,
        stops: [{
          key, act: async ctx => {
            const m = ctx.model, u = m.userData;
            const sw = Math.min(u.w - 0.5, 1.6), sd = Math.min(u.d - 0.5, 1.0);
            const pts = strokePoints(strokes, sw * 0.9, sd * 0.85);
            await writeCam(ctx, def, name, pts);
            // The sheet goes on the spoilboard and is held down
            const sheet = mmBox(m, sw, 0.04, sd, mdf ? 'mdf' : 'ply', 0, u.bedTop, 0);
            const holds = [];
            if (def.vacuum) {
              await machineStep(ctx, 'Laying the sheet on the vacuum table and switching the pump on', 1600, null, 'The vacuum pump pulls it down flat. No clamps in the way.');
            } else {
              [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => holds.push(routerClamp(m, sx * (sw / 2 + 0.1), u.bedTop, sz * (sd / 2 - 0.12), sx)));
              await machineStep(ctx, 'Clamping the sheet to the spoilboard', 1600, null, 'Four hold-down clamps, well clear of the toolpath.');
            }
            useWorkshopSupply(mdf ? 'mdf' : 'plywood', 1, `${def.short} job`);
            const bit = sign ? 'vbit' : 'compBit';
            await machineStep(ctx, 'Homing the machine', 1800, k => routerHead(u, -u.travel.x * Math.sin(k * Math.PI), -u.travel.z * Math.sin(k * Math.PI), 0), 'Homing: every axis finds its switch.');
            await machineStep(ctx, `Fitting the ${sign ? 'V-bit' : 'compression bit'} and zeroing on the touch plate`, 1800, k => routerHead(u, pts[0].x, pts[0].z, 0.12 * Math.sin(k * Math.PI)));
            useWorkshopSupply(bit, 1, 'Router job');
            useWorkshopSupply('spoilboard', 1, 'Router job');
            await machineStep(ctx, 'Switching the dust collector on', 900, null, 'Dust collector on, hose on the dust shoe.');
            // Cut along the path: the grooves appear behind the bit
            const grooves = [];
            const total = pts.length - 1;
            let lastSeg = -1;
            await machineStep(ctx, `Routing ${wsThing(name).replace(/^[A-Za-z]+-routed /, '')} on the ${def.name}`, 9000, (k, t) => {
              const f = k * total, i = Math.min(total - 1, Math.floor(f)), uu = f - i;
              const a = pts[i], b = pts[i + 1];
              const x = a.x + (b.x - a.x) * uu, z = a.z + (b.z - a.z) * uu;
              routerHead(u, x, z, b.down ? 0.1 : 0.02);
              u.bit.rotation.y = t * 60;
              if (b.down && i !== lastSeg && grooves.length < 60) {
                lastSeg = i;
                const len = Math.hypot(b.x - a.x, b.z - a.z);
                const gm = mmBox(m, len, 0.008, sign ? 0.045 : 0.03, 'black', (a.x + b.x) / 2, u.bedTop + 0.036, (a.z + b.z) / 2, { ry: -Math.atan2(b.z - a.z, b.x - a.x) });
                gm.scale.x = 0.001;
                gm.userData.full = len;
                grooves.push(gm);
              }
              const g = grooves[grooves.length - 1];
              if (g && b.down) g.scale.x = Math.max(0.001, g.userData.full * uu);
              grooves.slice(0, -1).forEach(gg => { gg.scale.x = gg.userData.full; });
              if (b.down) wsSpray(m, new THREE.Vector3(u.gantry.position.x + 0.2, u.bedTop + 0.06, u.carriage.position.z), { color: mdf ? 0xa47f55 : 0xe8cfa0, rate: 2, speed: 0.5, up: 1.2, size: 0.012, gravity: 2.5, floor: u.bedTop + 0.04, life: 0.7 });
            });
            routerHead(u, 0, 0, 0);
            wsClearSpray(m);
            await machineStep(ctx, 'Unclamping and sanding the edges', 1600, null, sign ? 'Clean letters. A little sanding and it is a real sign.' : 'Tabs cut, edges sanded smooth.');
            [sheet, ...holds, ...grooves].forEach(o => m.remove(o));
            return true;
          }
        }],
        finish: () => { addMadeThing(name, def.short, { emoji: '🪵' }); machineSkill(key, 6); }
      };
    }

function routerDef(spec) {
      const workholding = spec.vacuum ? ['vacuumPump', 'spoilboard'] : ['clamps', 'spoilboard'];
      return registerWorkshopMachine({
        kind: 'cnc', floor: 1, emoji: '🪚', teaches: ['dust'],
        wiki: spec.wiki || ['CNC router'],
        learned: spec.learned || 'A CNC router moves a fast spindle over a sheet on a gantry. You draw the part, write toolpaths in CAM (G-code), hold the sheet down, home the machine and zero the bit, and run the dust collector while it cuts.',
        needsFor: job => {
          const sign = /sign|letter|name|plaque|carv/i.test(job.make || '') || (!job.make && spec.signs);
          const mdf = /\bmdf\b|cabinet door/i.test(job.make || '') || spec.stock === 'mdf';
          return [mdf ? 'mdf' : 'plywood', sign ? 'vbit' : 'compBit', ...workholding, 'dustHose', 'safetyGlasses', 'earDefenders'];
        },
        plan(job) { return routerPlan(this, job); },
        ...spec
      });
    }

const ROUTER_LEFT_X = -2.15, ROUTER_RIGHT_X = 2.6;
routerDef({
  key: 'avid4896', name: 'Avid CNC PRO4896', short: 'Avid PRO4896', at: { x: ROUTER_LEFT_X, z: -4.3, ry: 0 }, size: { w: 2.5, h: 1.5, d: 1.6 }, color: 0x22272e,
  stand: { x: -0.45, z: -4.3 }, skill: 'Running the Avid PRO4896', prefix: 'Avid-routed', signs: true,
  model: () => cncRouterModel({ name: 'avid4896', w: 2.5, d: 1.6, frame: 'black', gantryMat: 'dark', accent: 'red', logo: 'AVID CNC  PRO4896', logoBg: '#0f1115', logoFg: '#ef4444' }),
  wiki: ['CNC router', 'Computer-aided manufacturing'], words: [/avid|pro ?4896|4896/i],
  products: ['An Avid-routed plywood sign', 'An Avid-routed plywood go-kart seat back'], makes: [/sign|seat back|plaque/]
});
routerDef({
  key: 'avid60120', name: 'Avid CNC PRO60120', short: 'Avid PRO60120', at: { x: ROUTER_RIGHT_X, z: -4.3, ry: Math.PI }, size: { w: 2.9, h: 1.5, d: 1.85 }, color: 0x22272e,
  stand: { x: 0.75, z: -4.3 }, skill: 'Running the Avid PRO60120', prefix: 'Avid-routed',
  model: () => cncRouterModel({ name: 'avid60120', w: 2.9, d: 1.85, frame: 'black', gantryMat: 'dark', accent: 'red', logo: 'AVID CNC  PRO60120', logoBg: '#0f1115', logoFg: '#ef4444' }),
  wiki: ['CNC router'], words: [/60120|avid pro ?60|big avid/i],
  products: ['An Avid-routed plywood workbench top', 'An Avid-routed plywood kayak rack'], makes: [/workbench|kayak|table top/]
});
routerDef({
  key: 'altmill', name: 'Sienci AltMill 4x8', short: 'AltMill', at: { x: ROUTER_LEFT_X, z: -1.9, ry: 0 }, size: { w: 2.5, h: 1.5, d: 1.6 }, color: 0x2fb04a,
  stand: { x: -0.45, z: -1.9 }, skill: 'Running the AltMill', prefix: 'AltMill-routed', stock: 'mdf',
  model: () => cncRouterModel({ name: 'altmill', w: 2.5, d: 1.6, frame: 'dark', gantryMat: 'black', accent: 'sienci', logo: 'SIENCI ALTMILL 4x8', logoBg: '#0f1115', logoFg: '#4ade80' }),
  wiki: ['CNC router'], words: [/altmill|sienci/i],
  products: ['An AltMill-routed MDF cabinet door', 'An AltMill-routed MDF speaker baffle'], makes: [/cabinet door|baffle|door/]
});
routerDef({
  key: 'shopsaber', name: 'ShopSaber IS 510', short: 'ShopSaber', at: { x: ROUTER_RIGHT_X, z: -1.9, ry: Math.PI }, size: { w: 2.7, h: 1.6, d: 1.7 }, color: 0x334155,
  stand: { x: 0.75, z: -1.9 }, skill: 'Running the ShopSaber', prefix: 'ShopSaber-routed', vacuum: true,
  model: () => cncRouterModel({ name: 'shopsaber', w: 2.7, d: 1.7, frame: 'grey', gantryMat: 'dark', accent: 'orange', heavy: true, vacuum: true, logo: 'SHOPSABER  IS 510', logoBg: '#111827', logoFg: '#fb923c' }),
  wiki: ['CNC router', 'Vacuum table'], words: [/shopsaber|shop saber|is ?510/i],
  learned: 'The ShopSaber IS 510 is a heavy welded-steel router for full 5x10 sheets. A vacuum table holds the sheet flat through a spoilboard, a compression bit leaves clean top and bottom edges, and the dust collector clears the chips.',
  products: ['A ShopSaber-routed plywood shelving set', 'A ShopSaber-routed plywood go-kart floor pan'], makes: [/shel(f|ving)|floor pan/]
});
routerDef({
  key: 'laguna', name: 'Laguna SmartShop', short: 'Laguna SmartShop', at: { x: ROUTER_LEFT_X, z: 0.45, ry: 0 }, size: { w: 2.6, h: 1.6, d: 1.7 }, color: 0xeef0f2,
  stand: { x: -0.45, z: 0.45 }, skill: 'Running the Laguna SmartShop', prefix: 'Laguna-routed', vacuum: true,
  model: () => cncRouterModel({ name: 'laguna', w: 2.6, d: 1.7, frame: 'white', gantryMat: 'grey', accent: 'orange', heavy: true, atc: true, vacuum: true, logo: 'LAGUNA SmartShop', logoBg: '#f8fafc', logoFg: '#ea580c' }),
  wiki: ['CNC router', 'Automatic tool changer'], words: [/laguna|smartshop|smart shop/i],
  learned: 'The Laguna SmartShop is an industrial router for cabinets and signs: an automatic tool changer swaps bits between operations, a vacuum table holds the sheets, and a dust collector keeps the shop clean.',
  products: ['A Laguna-routed plywood cabinet carcass', 'A Laguna-routed plywood shop sign'], makes: [/cabinet|carcass|shop sign/]
});
registerWorkshopMachine({
  key: 'dust', name: 'Dust collector', short: 'dust collector', kind: 'post', floor: 1, at: { x: 4.7, z: -2.6, ry: 0 }, size: { w: 0.55, h: 1.5, d: 0.8 },
  learnAs: 'dust', skill: 'Dust collection', model: dustCollectorModel
});

// --- Haas vertical machining centres ----------------------------------------------------------------
// The spindle traces the part over the vise, coolant floods the cut and chips fly; doors shut first.
async function haasCycle(ctx, u, title, ms, name) {
      const m = ctx.model;
      const w = u.w - 0.6;
      // Close the doors
      await ctx.animate(900, k => u.doors.forEach((d, i) => { const s = i ? 1 : -1; d.position.x = d.userData.closedX + s * (w / 4) * 0.85 * (1 - k); }));
      mmSetTower(u.tower, 'run');
      const stock = u.vise.userData.stock || (u.vise.userData.stock = mmBox(u.vise, 0.24, 0.12, 0.12, /steel/i.test(name) ? 'steel' : 'alu', 0, 0.12, 0));
      stock.visible = true;
      const pts = strokePoints(PART_STROKES, 0.26, 0.12);
      await machineStep(ctx, title, ms, (k, t) => {
        const f = k * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), uu = f - i;
        const a = pts[i], b = pts[i + 1];
        u.head.position.x = a.x + (b.x - a.x) * uu;
        u.head.position.z = 0.05 + a.z + (b.z - a.z) * uu;
        u.head.position.y = u.headY - 0.08 - k * 0.02;
        u.tool.rotation.y = t * 50;
        stock.scale.y = 1 - k * 0.35;
        stock.position.y = 0.12 - 0.12 * k * 0.175;
        const tip = new THREE.Vector3(u.head.position.x, u.head.position.y - 0.27, u.head.position.z);
        wsSpray(m, tip, { color: /steel/i.test(name) ? 0x6b7280 : 0xd1d5db, metal: true, rate: 2, speed: 0.8, up: 0.8, size: 0.01, floor: u.plate.y - 0.15, life: 0.6, max: 30 });
        u.coolant = u.coolant || { color: 0x60a5fa };
        if (!u.coolMat) u.coolMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.65, depthWrite: false });
        wsSpray(m, tip.clone().add(new THREE.Vector3(0, 0.12, 0.04)), { mat: u.coolMat, rate: 3, speed: 0.4, up: 0.1, size: 0.02, gravity: 6, floor: u.plate.y - 0.15, life: 0.45, max: 70 });
      });
      wsClearSpray(m);
      mmSetTower(u.tower, 'idle');
      u.head.position.set(0, u.headY, 0.05);
      // Open the doors again
      await ctx.animate(900, k => u.doors.forEach((d, i) => { const s = i ? 1 : -1; d.position.x = d.userData.closedX + s * (w / 4) * 0.85 * k; }));
      stock.visible = false;
      stock.scale.y = 1;
    }

function haasDef(spec) {
      return registerWorkshopMachine({
        kind: 'cnc', floor: 1, emoji: '⚙️', mill: true,
        wiki: ['Machining center', 'Milling (machining)'],
        learned: 'A vertical machining centre holds the stock in a vise, swaps tools from its carousel and mills the part from G-code written in CAM. You home it, touch off each tool and set the work offset, close the doors and run flood coolant to carry the heat and chips away.',
        needsFor: job => [/steel/i.test(job.make || '') ? 'steelStock' : 'aluStock', 'endMills', 'faceMill', 'vise', 'coolant', 'safetyGlasses'],
        plan(job) {
          const key = this.key;
          const steel = /steel/i.test(job.make || '');
          const name = job.make ? madeName(`${spec.brand}-machined`, steel ? 'steel' : 'aluminium', job.make, this.products[0]) : wsPick(this.products);
          const what = wsThing(name).replace(/^[A-Za-z]+-machined /, '');
          const an = /^[aeiou]/i.test(what) ? 'an' : 'a';
          return {
            title: `Machining ${an} ${what} on the ${this.short}`, product: name, speech: 'Safety glasses on. Let\'s make chips.',
            stops: [{
              key, act: async ctx => {
                const u = ctx.model.userData;
                await writeCam(ctx, this, name, strokePoints(PART_STROKES, 0.26, 0.12));
                await machineStep(ctx, 'Clamping the stock in the vise', 1500, null, 'Parallels under it, vise snug, tapped down with a dead blow.');
                useWorkshopSupply(steel ? 'steelStock' : 'aluStock', 1, `${this.short} job`);
                await machineStep(ctx, 'Homing, touching off the tools and setting the work offset', 2000, k => { u.head.position.y = u.headY - Math.sin(k * Math.PI) * 0.15; }, 'G54 set from the probe. Tool lengths measured.');
                await machineStep(ctx, 'Tool change: face mill from the carousel into the spindle', 2200, (k, t) => {
                  if (u.carousel) u.carousel.rotation.y = k * Math.PI * 0.67;
                  if (u.atcArm) u.atcArm.rotation.y = Math.sin(k * Math.PI) * 1.4;
                  u.head.position.y = u.headY + Math.sin(k * Math.PI) * 0.1;
                }, 'T2 M6: the arm swaps the face mill in. T1, the end mill, goes back in the carousel after.');
                useWorkshopSupply('faceMill', 1, 'Facing');
                useWorkshopSupply('endMills', 1, 'Milling');
                useWorkshopSupply('coolant', 1, 'Flood coolant');
                await haasCycle(ctx, u, `Machining ${an} ${what} with flood coolant`, 9000, name);
                await machineStep(ctx, 'Deburring and checking it with calipers', 1500, null, 'Within two hundredths of a millimetre. Nice.');
                return true;
              }
            }],
            finish: () => { addMadeThing(name, this.short, { emoji: '⚙️' }); machineSkill(key, 6); }
          };
        },
        ...spec
      });
    }

haasDef({
  key: 'haasvs1', name: 'Haas VS-1', short: 'Haas VS-1', brand: 'Haas', at: { x: 6.95, z: -3.45, ry: -Math.PI / 2 }, size: { w: 2.5, h: 2.2, d: 1.55 }, color: 0xd2d5d9,
  stand: { x: 5.45, z: -2.4 }, skill: 'Machining on the Haas VS-1', model: () => haasVmcModel(false), words: [/vs-?1\b|haas(?!.*vs-?3)/i],
  products: ['A Haas-machined aluminium bracket', 'A Haas-machined aluminium go-kart pedal', 'A Haas-machined steel go-kart spindle'], makes: [/bracket|pedal|spindle|hub|kart/]
});
haasDef({
  key: 'haasvs3', name: 'Haas VS-3', short: 'Haas VS-3', brand: 'Haas', at: { x: 6.9, z: -6.0, ry: -Math.PI / 2 }, size: { w: 3.0, h: 2.4, d: 1.75 }, color: 0xd2d5d9,
  stand: { x: 5.4, z: -5.4 }, skill: 'Machining on the Haas VS-3', model: () => haasVmcModel(true), words: [/vs-?3\b/i],
  products: ['A Haas-machined aluminium mold plate', 'A Haas-machined aluminium drone frame plate'], makes: [/mold|frame plate|plate/]
});

// --- Waldrich Coburg Taurus gantry mill -------------------------------------------------------------
registerWorkshopMachine({
  key: 'taurus', name: 'Waldrich Coburg Taurus', short: 'Taurus gantry mill', kind: 'cnc', floor: 1, at: { x: -5.9, z: -2.3, ry: 0 }, size: { w: 3.6, h: 4.6, d: 7.8 }, color: 0x6b7f93,
  emoji: '🏗️', skill: 'Gantry milling on the Taurus', stand: { x: -5.0, z: 1.95 }, mill: true,
  model: () => taurusModel(7.4),
  wiki: ['Milling (machining)', 'Gantry crane'], words: [/taurus|waldrich|coburg|gantry mill/i],
  learned: 'The Waldrich Coburg Taurus is a travelling-gantry milling machine for huge parts: ship propellers, turbine housings, aircraft spars. The work is fixtured on a long floor table, the bridge moves over it, and big face mills take heavy cuts under flood coolant. The crane loads the casting.',
  needs: ['bigCasting', 'faceMill', 'fixturePlate', 'coolant', 'earDefenders', 'safetyGlasses'],
  products: ['A Taurus-machined bronze ship propeller', 'A Taurus-machined aluminium wing spar'], makes: [/propeller|spar|turbine housing/],
  plan(job) {
    const key = this.key;
    const name = /spar|wing/i.test(job.make || '') ? this.products[1] : this.products[0];
    return {
      title: `Machining ${wsThing(name)} on the Taurus`, product: name, speech: 'The big one. The bridge crane brings the casting in.',
      stops: [{
        key, act: async ctx => {
          const u = ctx.model.userData, m = ctx.model;
          await writeCam(ctx, this, name, strokePoints(PART_STROKES, 1.0, 2.6));
          const crane = wsGroup.userData.crane;
          await machineStep(ctx, 'Craning the casting onto the fixtures', 2400, k => { if (crane) crane.position.z = 0.4 - Math.sin(k * Math.PI) * 2.0; }, 'Slowly... onto the fixture plates, bolted down.');
          useWorkshopSupply('bigCasting', 1, 'Taurus job');
          useWorkshopSupply('faceMill', 1, 'Taurus job');
          useWorkshopSupply('coolant', 1, 'Taurus job');
          await machineStep(ctx, 'Homing the gantry and probing the casting', 2000, k => { u.gantry.position.z = -u.len / 2 + 1.2 + Math.sin(k * Math.PI) * 1.0; });
          mmSetTower(u.tower, 'run');
          const work = u.work;
          await machineStep(ctx, `Milling ${wsThing(name)} with flood coolant`, 10000, (k, t) => {
            const pass = Math.floor(k * 6), pk = k * 6 - pass;
            u.gantry.position.z = -1.4 + (pass % 2 ? 1 - pk : pk) * 3.2;
            u.slide.position.x = -0.45 + pass * 0.18;
            u.ram.position.y = -0.2 - 0.15;
            u.cutter.rotation.y = t * 25;
            work.children[0].scale.y = 1 - k * 0.25;
            const tip = new THREE.Vector3(u.slide.position.x, 0.98, u.gantry.position.z + 0.5);
            wsSpray(m, tip, { color: 0xc9a227, metal: true, rate: 3, speed: 1.2, up: 1, size: 0.035, floor: 0.6, life: 0.8, max: 40 });
            if (!u.coolMat) u.coolMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.6, depthWrite: false });
            wsSpray(m, tip.clone().add(new THREE.Vector3(0, 0.4, 0)), { mat: u.coolMat, rate: 3, speed: 0.6, up: 0.1, size: 0.04, gravity: 6, floor: 0.65, life: 0.4, max: 80 });
          });
          wsClearSpray(m);
          mmSetTower(u.tower, 'idle');
          u.ram.position.y = -0.2;
          work.children[0].scale.y = 1;
          await machineStep(ctx, 'Measuring it with the laser tracker', 1500, null, 'Every blade within a tenth of a millimetre.');
          return true;
        }
      }],
      finish: () => { addMadeThing(name, 'Taurus gantry mill', { emoji: '🏗️' }); machineSkill(key, 8); }
    };
  }
});
