// Kelo-bot-1 — js/woodshop.js
// Loaded after glassstudio.js. Floor 3 of his Workshop, east side: a woodworking shop. A table saw with
// riving knife and blade guard, jointer, thickness planer, bandsaw, drill press, router table, mitre
// saw, lathe, spindle and belt sanders, a dust collector with ducts and blast gates, benches with
// vises, a clamp rack, hand tools, a lumber rack (rough lumber, plywood, hardwoods, with a moisture
// meter) and a finishing corner with a spray booth and a drying rack.
// Projects go the real way: check the moisture, mill the rough lumber (joint, plane, rip, crosscut),
// cut the joinery, glue up and clamp, sand, then finish. Bowls are turned on the lathe. Push sticks,
// ear defenders and safety glasses, dust collector on; lumber, glue, sandpaper and finish are used up.
// Once the Workshop exists this is where his woodworking happens; the outdoor bench (js/workbench.js,
// WORK_BENCH) stays for his quick welded and hand builds.

// --- Models ----------------------------------------------------------------------------------------
function tableSawModel() {
      const g = new THREE.Group();
      mmBox(g, 0.55, 0.8, 0.55, 'yellow', 0, 0, 0);                           // cabinet
      mmBox(g, 1.0, 0.06, 0.75, 'steel', 0, 0.8, 0);                         // cast-iron top
      mmBox(g, 1.0, 0.04, 0.9, 'alu', 0, 0.82, -0.75);                        // outfeed table
      [-0.45, 0.45].forEach(x => mmBox(g, 0.04, 0.8, 0.04, 'dark', x, 0, -0.75));
      mmBox(g, 0.06, 0.08, 0.75, 'dark', 0.32, 0.86, 0);                      // rip fence
      mmBox(g, 1.2, 0.05, 0.05, 'chrome', 0, 0.78, 0.4);                      // fence rail
      const blade = mmCyl(g, 0.13, 0.008, 'chrome', 0, 0.82, 0, { axis: 'x' });
      for (let i = 0; i < 8; i++) mmBox(blade, 0.01, 0.2, 0.12, 'steel', 0, 0, 0, { rx: i * Math.PI / 8 });
      mmBox(g, 0.006, 0.14, 0.08, 'red', 0, 0.86, -0.13);                     // riving knife
      const guard = mmBox(g, 0.08, 0.1, 0.3, 'glass', 0, 0.9, -0.05);         // blade guard
      mmCyl(g, 0.06, 0.06, 'red', 0.3, 0.55, 0.3, { axis: 'z' });             // switch
      mmLabel(g, 'TABLE SAW', 0.3, 0.06, 0, 0.5, 0.28, { bg: '#ca8a04', fg: '#111827' });
      return mmFinish(g, 'tablesaw', { blade, guard, plate: { y: 0.84 }, w: 1.0, d: 1.6 });
    }

function jointerModel() {
      const g = new THREE.Group();
      mmBox(g, 0.5, 0.7, 0.35, 'grey', 0, 0, 0);
      mmBox(g, 1.4, 0.05, 0.3, 'steel', 0, 0.72, 0);
      mmBox(g, 1.0, 0.18, 0.03, 'steel', 0.1, 0.77, -0.14);
      const head = mmCyl(g, 0.05, 0.28, 'chrome', 0, 0.74, 0, { axis: 'z' });
      mmLabel(g, 'JOINTER', 0.25, 0.06, 0, 0.45, 0.176, { bg: '#374151', fg: '#fff' });
      return mmFinish(g, 'jointer', { head, plate: { y: 0.77 }, w: 1.4, d: 0.4 });
    }

function planerModel() {
      const g = new THREE.Group();
      mmBox(g, 0.6, 0.6, 0.5, 'dark', 0, 0, 0);
      mmBox(g, 0.55, 0.35, 0.5, 'grey', 0, 0.75, 0);
      mmBox(g, 0.5, 0.03, 1.0, 'steel', 0, 0.68, 0);
      mmCyl(g, 0.08, 0.03, 'red', 0.32, 0.95, 0, { axis: 'x' });
      const roller = mmCyl(g, 0.04, 0.48, 'chrome', 0, 0.72, 0, { axis: 'x' });
      mmLabel(g, 'PLANER', 0.25, 0.06, 0, 0.8, 0.252, { bg: '#374151', fg: '#fff' });
      return mmFinish(g, 'planer', { roller, plate: { y: 0.72 }, w: 0.6, d: 1.0 });
    }

function woodBandsawModel() {
      const g = new THREE.Group();
      mmBox(g, 0.4, 0.5, 0.4, 'dark', 0, 0, 0);
      mmBox(g, 0.12, 1.4, 0.12, 'blue', -0.15, 0.5, 0);
      mmBox(g, 0.4, 0.12, 0.12, 'blue', 0, 1.8, 0);
      mmCyl(g, 0.18, 0.05, 'dark', 0.02, 1.7, 0, { axis: 'z' });
      mmCyl(g, 0.18, 0.05, 'dark', 0.02, 0.6, 0, { axis: 'z' });
      mmBox(g, 0.45, 0.03, 0.45, 'steel', 0.05, 1.0, 0);
      const blade = mmBox(g, 0.004, 1.1, 0.01, 'chrome', 0.12, 0.6, 0.02);
      return mmFinish(g, 'woodbandsaw', { blade, w: 0.5, d: 0.5 });
    }

function drillPressModel() {
      const g = new THREE.Group();
      mmBox(g, 0.35, 0.05, 0.45, 'dark', 0, 0, 0);
      mmCyl(g, 0.04, 1.6, 'steel', 0, 0.8, -0.12);
      mmBox(g, 0.3, 0.03, 0.3, 'steel', 0, 0.85, 0.05);
      const head = mmGroup(g, 0, 1.45, 0);
      mmBox(head, 0.22, 0.25, 0.4, 'green', 0, 0, 0);
      const chuck = mmCyl(head, 0.03, 0.12, 'chrome', 0, -0.18, 0.08);
      return mmFinish(g, 'drillpress', { head, chuck, plate: { y: 0.88 }, w: 0.4, d: 0.5 });
    }

function routerTableModel() {
      const g = new THREE.Group();
      [-0.4, 0.4].forEach(x => [-0.22, 0.22].forEach(z => mmBox(g, 0.05, 0.85, 0.05, 'dark', x, 0, z)));
      mmBox(g, 1.0, 0.05, 0.6, 'mdf', 0, 0.85, 0);
      mmBox(g, 0.9, 0.12, 0.06, 'alu', 0, 0.9, -0.15);
      const bit = mmCyl(g, 0.02, 0.04, 'chrome', 0, 0.9, 0.0);
      mmLabel(g, 'ROUTER TABLE', 0.35, 0.06, 0, 0.7, 0.31, { bg: '#374151', fg: '#fff' });
      return mmFinish(g, 'routertable', { bit, plate: { y: 0.9 }, w: 1.0, d: 0.6 });
    }

function mitreSawModel() {
      const g = new THREE.Group();
      mmBox(g, 1.8, 0.05, 0.35, 'dark', 0, 0.75, 0);
      [-0.8, 0.8].forEach(x => mmBox(g, 0.06, 0.75, 0.3, 'dark', x, 0, 0));
      mmBox(g, 0.4, 0.06, 0.35, 'steel', 0, 0.8, 0);
      const arm = mmGroup(g, 0, 0.9, -0.15);
      mmBox(arm, 0.08, 0.08, 0.35, 'red', 0, 0.2, 0.15);
      const blade = mmCyl(arm, 0.14, 0.01, 'chrome', 0.05, 0.12, 0.25, { axis: 'x' });
      arm.rotation.x = -0.4;
      return mmFinish(g, 'mitresaw', { arm, blade, plate: { y: 0.82 }, w: 1.8, d: 0.4 });
    }

function woodLatheModel() {
      const g = new THREE.Group();
      [-0.6, 0.6].forEach(x => mmBox(g, 0.12, 0.75, 0.3, 'dark', x, 0, 0));
      mmBox(g, 1.5, 0.1, 0.2, 'grey', 0, 0.75, 0);                            // bed
      mmBox(g, 0.3, 0.3, 0.25, 'grey', -0.6, 0.85, 0);                        // headstock
      mmBox(g, 0.18, 0.22, 0.2, 'grey', 0.55, 0.85, 0);                       // tailstock
      mmBox(g, 0.05, 0.05, 0.4, 'steel', 0.1, 1.0, 0.18);                     // tool rest
      const work = mmGroup(g, -0.1, 1.05, 0);
      mmCyl(work, 0.15, 0.22, 'wood', 0, 0, 0, { axis: 'x' });
      const gouge = mmBox(g, 0.4, 0.03, 0.03, 'steel', 0.05, 1.05, 0.33, { ry: 0.6 });
      mmLabel(g, 'LATHE', 0.2, 0.06, 0, 0.5, 0.156, { bg: '#374151', fg: '#fff' });
      return mmFinish(g, 'woodlathe', { work, gouge, plate: { y: 1.05 }, w: 1.5, d: 0.4 });
    }

function sandersModel() {
      const g = new THREE.Group();
      mmBox(g, 0.5, 0.85, 0.45, 'grey', -0.35, 0, 0);
      const spindle = mmCyl(g, 0.04, 0.2, 'paper', -0.35, 0.95, 0);
      mmBox(g, 0.55, 0.85, 0.45, 'grey', 0.35, 0, 0);
      const belt = mmBox(g, 0.5, 0.06, 0.18, 'paper', 0.35, 0.88, 0);
      mmLabel(g, 'SPINDLE  •  BELT SANDERS', 0.6, 0.06, 0, 0.5, 0.226, { bg: '#374151', fg: '#fff' });
      return mmFinish(g, 'sanders', { spindle, belt, w: 1.2, d: 0.45 });
    }

function woodBenchModel() {
      const g = workBenchModel(2.0, 0.8, 'wood');
      [-0.85, 0.85].forEach(x => { mmBox(g, 0.2, 0.12, 0.12, 'dark', x, 0.86, 0.4); mmCyl(g, 0.01, 0.3, 'chrome', x, 0.92, 0.5, { axis: 'x' }); });
      // hand tools: chisels, planes, a saw and a mallet
      [0, 1, 2, 3].forEach(i => mmBox(g, 0.02, 0.18, 0.02, 'wood', -0.6 + i * 0.08, 1.2, -0.37));
      mmBox(g, 0.22, 0.06, 0.06, 'blue', 0.1, 1.2, -0.37);
      mmBox(g, 0.4, 0.15, 0.01, 'chrome', 0.55, 1.3, -0.37);
      mmBox(g, 0.12, 0.08, 0.08, 'wood', 0.3, 0.99, 0.1);
      return mmFinish(g, 'woodbench', { top: 0.98, plate: { y: 0.98 }, w: 2.0, d: 0.8 });
    }

function clampRackModel() {
      const g = new THREE.Group();
      mmBox(g, 1.6, 0.06, 0.15, 'wood', 0, 1.6, 0);
      for (let i = 0; i < 9; i++) {
        mmBox(g, 0.03, 1.1, 0.03, 'steel', -0.7 + i * 0.175, 0.5, 0.06);
        mmBox(g, 0.06, 0.12, 0.08, i % 2 ? 'yellow' : 'red', -0.7 + i * 0.175, 0.5, 0.08);
      }
      mmLabel(g, 'CLAMPS', 0.3, 0.07, 0, 1.75, 0.08, { bg: '#111827', fg: '#fff' });
      return mmFinish(g, 'clamprack', { w: 1.6, d: 0.2 });
    }

function lumberRackModel() {
      const g = new THREE.Group();
      [-1.0, 0, 1.0].forEach(x => {
        mmBox(g, 0.1, 2.2, 0.1, 'navy', x, 0, -0.25);
        [0.4, 0.95, 1.5, 2.05].forEach(y => mmBox(g, 0.06, 0.06, 0.55, 'navy', x, y, 0.0));
      });
      // rough lumber, plywood sheets, hardwoods (maple, walnut, cherry)
      [['wood', 0.45], ['ply', 1.0], ['bench', 1.55], ['mdf', 2.1]].forEach(([m, y]) => mmBox(g, 2.3, 0.12, 0.45, m, 0, y, 0.0));
      const meter = mmBox(g, 0.08, 0.14, 0.04, 'yellow', 1.15, 1.2, 0.2);
      mmLabel(g, 'LUMBER  •  MC 7%', 0.6, 0.1, 0, 2.3, 0.26, { bg: '#111827', fg: '#86efac' });
      return mmFinish(g, 'lumberrack', { meter, w: 2.4, d: 0.6 });
    }

function sprayBoothModel() {
      const g = new THREE.Group();
      mmBox(g, 2.0, 2.0, 0.05, 'white', 0, 0, -0.55);
      [-1, 1].forEach(x => mmBox(g, 0.05, 2.0, 1.1, 'white', x, 0, 0));
      mmBox(g, 2.0, 0.05, 1.1, 'white', 0, 2.0, 0);
      mmBox(g, 1.6, 1.4, 0.03, 'powder', 0, 0.3, -0.52);                      // filter wall
      mmCyl(g, 0.2, 0.8, 'alu', 0, 2.4, -0.4);
      const stand = mmGroup(g, 0, 0, 0.0);
      mmCyl(stand, 0.18, 0.05, 'dark', 0, 0.7, 0);
      mmCyl(stand, 0.03, 0.7, 'dark', 0, 0.35, 0);
      mmLabel(g, 'SPRAY BOOTH', 0.5, 0.1, 0, 1.85, 0.56, { bg: '#111827', fg: '#fff' });
      return mmFinish(g, 'spraybooth', { stand, plate: { y: 0.75 }, w: 2.0, d: 1.2 });
    }

function dryingRackModel() {
      const g = new THREE.Group();
      [-0.35, 0.35].forEach(x => mmBox(g, 0.04, 1.6, 0.04, 'dark', x, 0, 0));
      [0.3, 0.7, 1.1, 1.5].forEach(y => mmBox(g, 0.7, 0.02, 0.4, 'steel', 0, y, 0));
      return mmFinish(g, 'dryingrack', { w: 0.8, d: 0.45 });
    }

function woodDustModel() {
      const g = dustCollectorModel();
      // ducts up to the ceiling and along to the machines, with blast gates
      mmRod(g, [0, 1.4, 0], [0, 3.4, 0], 0.08, 'alu');
      mmRod(g, [0, 3.4, 0], [-3.6, 3.4, 0], 0.07, 'alu');
      mmRod(g, [0, 3.4, 0], [0, 3.4, -3.0], 0.07, 'alu');
      [[-1.2, 0], [-2.4, 0], [0, -1.5]].forEach(([x, z]) => mmBox(g, 0.16, 0.12, 0.16, 'yellow', x, 3.34, z));
      return g;
    }

// --- Supplies -----------------------------------------------------------------------------------
Object.assign(WORKSHOP_SUPPLIES, {
  roughLumber: { ask: 'A stack of rough-sawn maple lumber', re: /rough-sawn|lumber|walnut boards|cherry boards/i, kind: 'stock', label: 'rough lumber (maple, walnut, cherry)', uses: ['build'] },
  woodGlue: { ask: 'A bottle of wood glue', re: /wood glue|glue/i, kind: 'consumable', label: 'wood glue', uses: ['build'] },
  sandpaper: { ask: 'A pack of sandpaper (80 to 220 grit)', re: /sandpaper|sanding discs/i, kind: 'consumable', per: 6, unit: 'projects', label: 'sandpaper', uses: ['build'] },
  woodFinish: { ask: 'A can of wipe-on polyurethane', re: /polyurethane|danish oil|lacquer/i, kind: 'consumable', per: 3, unit: 'projects', label: 'finish (poly, oil or lacquer)', uses: ['build'] },
  pushSticks: { ask: 'A set of push sticks and a push block', re: /push sticks?|push block/i, kind: 'safety', label: 'push sticks for the table saw', uses: ['cut'] },
  bowlBlank: { ask: 'A cherry bowl blank', re: /bowl blank/i, kind: 'stock', per: 1, unit: 'bowl', label: 'a bowl blank for the lathe', uses: ['build'] },
  gouges: { ask: 'A set of turning gouges', re: /turning gouges?|bowl gouge/i, kind: 'tooling', label: 'turning gouges', uses: ['cut'] },
  faceShield: { ask: 'A full face shield', re: /face shield/i, kind: 'safety', label: 'a face shield for turning', uses: ['wear'] }
});
if (typeof ITEM_KINDS !== 'undefined') {
  ITEM_KINDS.unshift(
    { kind: 'woodwork', label: 'a piece of furniture or woodwork he made', re: /handmade (maple|walnut|cherry|oak) |dovetailed .*box|turned .*bowl/i, uses: ['display', 'build'] },
    { kind: 'ws sandpaper', label: 'sandpaper', re: /sandpaper|sanding discs/i, uses: ['build'], per: 6, unit: 'projects' },
    { kind: 'ws woodFinish', label: 'a wood finish', re: /polyurethane|danish oil|lacquer/i, uses: ['build'], per: 3, unit: 'projects' },
    { kind: 'ws pushSticks', label: 'push sticks for the table saw', re: /push sticks?|push block/i, uses: ['cut'] },
    { kind: 'ws bowlBlank', label: 'a bowl blank for the lathe', re: /bowl blank/i, uses: ['build'], per: 1, unit: 'bowl' },
    { kind: 'ws gouges', label: 'turning gouges', re: /turning gouges?|bowl gouge/i, uses: ['cut'] },
    { kind: 'ws faceShield', label: 'a face shield', re: /face shield/i, uses: ['wear'] }
  );
}

// --- The shop ------------------------------------------------------------------------------------
function w3(def) {
      return registerWorkshopMachine({ floor: 3, kind: 'wood', learnAs: 'wood', ...def });
    }

w3({ key: 'lumberrack', name: 'Lumber rack (rough lumber, plywood, hardwoods)', short: 'lumber rack', at: { x: 0.2, z: -6.9, ry: 0 }, size: { w: 2.4, h: 2.3, d: 0.6 }, model: lumberRackModel, stand: { x: 0.2, z: -5.9 } });
w3({ key: 'jointer', name: 'Jointer', short: 'jointer', at: { x: 2.7, z: -6.6, ry: 0 }, size: { w: 1.4, h: 0.9, d: 0.4 }, skill: 'Jointing', model: jointerModel, stand: { x: 2.7, z: -5.8 } });
w3({ key: 'planer', name: 'Thickness planer', short: 'planer', at: { x: 4.6, z: -6.3, ry: 0 }, size: { w: 0.6, h: 1.1, d: 1.0 }, skill: 'Planing', model: planerModel, stand: { x: 4.6, z: -5.3 } });
w3({ key: 'woodbandsaw', name: 'Bandsaw', short: 'bandsaw', at: { x: 6.0, z: -6.7, ry: 0 }, size: { w: 0.5, h: 1.9, d: 0.5 }, skill: 'Bandsawing', model: woodBandsawModel, stand: { x: 6.0, z: -5.9 } });
w3({ key: 'drillpress', name: 'Drill press', short: 'drill press', at: { x: 7.2, z: -6.7, ry: 0 }, size: { w: 0.4, h: 1.7, d: 0.5 }, skill: 'Drilling', model: drillPressModel, stand: { x: 7.2, z: -5.9 } });
w3({ key: 'routertable', name: 'Router table', short: 'router table', at: { x: 5.4, z: -4.2, ry: 0 }, size: { w: 1.0, h: 1.0, d: 0.6 }, skill: 'Router table joinery', model: routerTableModel, stand: { x: 5.4, z: -3.4 } });
w3({ key: 'mitresaw', name: 'Mitre saw', short: 'mitre saw', at: { x: 7.3, z: -3.9, ry: -Math.PI / 2 }, size: { w: 1.8, h: 1.2, d: 0.4 }, skill: 'Crosscutting', model: mitreSawModel, stand: { x: 6.6, z: -3.9 } });
w3({ key: 'tablesaw', name: 'Table saw (riving knife, blade guard)', short: 'table saw', at: { x: 1.6, z: -3.2, ry: 0 }, size: { w: 1.0, h: 1.0, d: 1.6 }, skill: 'Table saw', model: tableSawModel, stand: { x: 1.6, z: -2.0 } });
w3({ key: 'wooddust', name: 'Dust collection (ducts and blast gates)', short: 'dust collection', at: { x: 7.3, z: -2.6, ry: 0 }, size: { w: 0.6, h: 1.5, d: 0.6 }, model: woodDustModel });
w3({ key: 'woodlathe', name: 'Wood lathe', short: 'lathe', at: { x: 1.6, z: 0.6, ry: 0 }, size: { w: 1.5, h: 1.2, d: 0.4 }, skill: 'Wood turning', model: woodLatheModel, stand: { x: 1.6, z: 1.3 } });
w3({ key: 'sanders', name: 'Spindle and belt sanders', short: 'sanders', at: { x: 0.6, z: 2.6, ry: 0 }, size: { w: 1.2, h: 1.0, d: 0.45 }, skill: 'Sanding', model: sandersModel, stand: { x: 0.6, z: 3.3 } });
w3({ key: 'woodbench', name: 'Woodworking bench with vises', short: 'woodworking bench', at: { x: 2.6, z: 4.4, ry: Math.PI }, size: { w: 2.0, h: 1.5, d: 0.8 }, skill: 'Joinery and glue-ups', model: woodBenchModel, stand: { x: 2.6, z: 3.55 } });
w3({ key: 'clamprack', name: 'Clamp rack', short: 'clamp rack', at: { x: -0.1, z: 4.6, ry: Math.PI / 2 }, size: { w: 1.6, h: 1.8, d: 0.2 }, model: clampRackModel });
w3({ key: 'spraybooth', name: 'Finishing spray booth', short: 'spray booth', at: { x: 1.4, z: 6.6, ry: Math.PI }, size: { w: 2.0, h: 2.6, d: 1.2 }, skill: 'Finishing', model: sprayBoothModel, stand: { x: 1.4, z: 5.6 } });
w3({ key: 'dryingrack', name: 'Drying rack', short: 'drying rack', at: { x: -0.9, z: 6.7, ry: 0 }, size: { w: 0.8, h: 1.6, d: 0.45 }, model: dryingRackModel });

const WOOD_PROJECTS = {
  table: { name: 'A handmade maple side table', joinery: 'mortise and tenon', words: /table|furniture|stool|chair/ },
  box: { name: 'A dovetailed walnut box', joinery: 'dovetails', words: /box|chest/ },
  shelf: { name: 'A handmade cherry wall shelf', joinery: 'dados', words: /shelf|shelves|bookcase/ }
};

function sawdust(model, at, color = 0xe8cfa0) {
      if (typeof wsSpray === 'function') wsSpray(model, at, { color, rate: 3, speed: 0.6, up: 1.0, size: 0.012, gravity: 2.5, floor: 0.02, life: 0.8, max: 40 });
    }

registerWorkshopMachine({
  key: 'woodshop', name: 'Woodworking shop (furniture and boxes)', short: 'woodshop', kind: 'wood', floor: 3, learnAs: 'wood', emoji: '🪵', skill: 'Woodworking',
  teaches: ['jointer', 'planer', 'tablesaw', 'mitresaw', 'routertable', 'woodbandsaw', 'drillpress', 'sanders', 'woodbench', 'spraybooth'],
  wiki: ['Woodworking', 'Table saw', 'Woodworking joints'],
  learned: 'Furniture starts with lumber dry enough (6-8% moisture), milled square: joint one face and edge, plane to thickness, rip to width on the table saw with a push stick, crosscut to length. Then the joinery (dovetails, mortise and tenon, dados), a glue-up with clamps, sanding through the grits and a finish. Riving knife and guard on, ear and eye protection, and the dust collector running.',
  needs: ['roughLumber', 'woodGlue', 'sandpaper', 'woodFinish', 'pushSticks', 'earDefenders', 'safetyGlasses'],
  words: [/woodwork|wood ?shop|table saw|furniture|dovetail|side table|wooden box|shelf/i],
  products: Object.values(WOOD_PROJECTS).map(p => p.name), makes: [/table|box|shelf|furniture/],
  plan(job) {
    const key = this.key;
    const pk = Object.keys(WOOD_PROJECTS).find(k => WOOD_PROJECTS[k].words.test(job.make || '')) || wsPick(Object.keys(WOOD_PROJECTS));
    const pr = WOOD_PROJECTS[pk];
    const at = (k, title, ms, speech, fn) => ({ floor: 3, key: k, act: async ctx => { await machineStep(ctx, title, ms, (kk, t) => fn && fn(ctx.model.userData, kk, t, ctx), speech); machineSkill(k, 2); return true; } });
    return {
      title: `Making ${wsWhat(pr.name)} in the woodshop`, product: pr.name, speech: 'Ear defenders, safety glasses, dust collector on.',
      stops: [
        at('lumberrack', 'Picking boards and checking the moisture (7%)', 2200, 'Seven percent moisture. Dry enough to work.', (u, k) => { if (k < 0.05) useWorkshopSupply('roughLumber', 1, 'Woodworking'); }),
        at('jointer', 'Jointing a face and an edge flat', 2600, 'One flat face, one square edge.', (u, k, t, ctx) => { u.head.rotation.y = t * 40; sawdust(ctx.model, new THREE.Vector3(0, 0.8, 0)); }),
        at('planer', 'Planing to thickness', 2400, 'Planed to three quarters of an inch.', (u, k, t, ctx) => { u.roller.rotation.x = t * 30; sawdust(ctx.model, new THREE.Vector3(0, 0.8, -0.5)); }),
        at('tablesaw', 'Ripping to width on the table saw', 3000, 'Push stick in hand, riving knife on, blade guard down.', (u, k, t, ctx) => {
          u.blade.rotation.x = t * 60;
          sawdust(ctx.model, new THREE.Vector3(0, 0.9, -0.2));
          if (!u.board) u.board = mmBox(ctx.model, 0.18, 0.04, 0.9, 'wood', 0.12, 0.84, 0.5);
          u.board.position.z = 0.5 - k * 1.1;
        }),
        at('mitresaw', 'Crosscutting to length on the mitre saw', 2000, null, (u, k, t, ctx) => { u.arm.rotation.x = -0.4 + Math.sin(k * Math.PI) * 0.5; u.blade.rotation.x = t * 60; sawdust(ctx.model, new THREE.Vector3(0, 0.85, 0)); }),
        at(pk === 'shelf' ? 'routertable' : pk === 'box' ? 'woodbandsaw' : 'drillpress', `Cutting the joinery: ${pr.joinery}`, 3000, `${pr.joinery[0].toUpperCase() + pr.joinery.slice(1)}, cut and test-fitted.`, (u, k, t, ctx) => {
          if (u.bit) u.bit.rotation.y = t * 50;
          if (u.blade && u.blade.isMesh && u.blade.geometry === MM_GEO.box) u.blade.position.y = 0.6 + Math.sin(t * 40) * 0.005;
          if (u.head) u.head.position.y = 1.45 - Math.abs(Math.sin(t * 2)) * 0.08;
          sawdust(ctx.model, new THREE.Vector3(0, 0.95, 0));
        }),
        at('woodbench', 'Glue-up: glue on, clamps on, square checked', 3000, 'Even squeeze-out all along the joint. Clamps on, check it square.', (u, k) => { if (k < 0.05) useWorkshopSupply('woodGlue', 1, 'Glue-up'); }),
        at('sanders', 'Sanding through 80, 120, 180 and 220 grit', 2600, null, (u, k, t, ctx) => { if (k < 0.05) useWorkshopSupply('sandpaper', 1, 'Sanding'); u.spindle.rotation.y = t * 30; sawdust(ctx.model, new THREE.Vector3(0.35, 0.9, 0), 0xf5e6c8); }),
        at('spraybooth', 'Finishing it in the spray booth', 2800, 'Three thin coats, a light sand between them.', (u, k, t) => { if (k < 0.05) useWorkshopSupply('woodFinish', 1, 'Finish'); u.stand.rotation.y = t; })
      ],
      finish: () => { addMadeThing(pr.name, 'woodshop', { emoji: '🪵' }); machineSkill(key, 8); }
    };
  }
});

registerWorkshopMachine({
  key: 'woodturning', name: 'Wood lathe (turned bowls)', short: 'wood lathe', kind: 'wood', floor: 3, learnAs: 'woodturning', emoji: '🥣', skill: 'Wood turning',
  teaches: ['woodlathe'],
  wiki: ['Woodturning'], learned: 'A bowl blank is mounted on the lathe, trued round, the outside shaped with a bowl gouge with the bevel rubbing, then reversed to hollow the inside, sanded while it spins and finished. A face shield, because blanks can come apart.',
  needs: ['bowlBlank', 'gouges', 'faceShield', 'sandpaper', 'woodFinish'],
  words: [/lathe|turn(ed)? (a |me a )?bowl|woodturning/i],
  products: ['A turned cherry bowl'], makes: [/bowl/],
  plan(job) {
    const key = this.key;
    return {
      title: 'Turning a cherry bowl on the lathe', product: 'A turned cherry bowl', speech: 'Face shield down. Slow speed to start.',
      stops: [{
        floor: 3, key: 'woodlathe', act: async ctx => {
          const u = ctx.model.userData;
          useWorkshopSupply('bowlBlank', 1, 'Turning');
          await machineStep(ctx, 'Truing the blank round', 2400, (k, t) => { u.work.rotation.x = t * 25; sawdust(ctx.model, new THREE.Vector3(0.05, 1.05, 0.2), 0xb45309); });
          await machineStep(ctx, 'Turning the bowl with the gouge (the lathe spins the work)', 4000, (k, t) => {
            u.work.rotation.x = t * 35;
            u.work.children[0].scale.set(0.15 - k * 0.03, 0.22, 0.15 - k * 0.03);
            u.gouge.position.x = 0.05 + Math.sin(t * 2) * 0.08;
            sawdust(ctx.model, new THREE.Vector3(0.05, 1.05, 0.2), 0xb45309);
          }, 'Bevel rubbing, long curls of cherry flying off.');
          useWorkshopSupply('sandpaper', 1, 'Turning');
          useWorkshopSupply('woodFinish', 1, 'Turning');
          await machineStep(ctx, 'Sanding and oiling it while it spins', 2400, (k, t) => { u.work.rotation.x = t * 20; });
          u.work.children[0].scale.set(0.15, 0.22, 0.15);
          return true;
        }
      }],
      finish: () => { addMadeThing('A turned cherry bowl', 'wood lathe', { emoji: '🥣' }); machineSkill(key, 8); }
    };
  }
});

// --- Project builds go through the woodshop (js/projects.js) ---------------------------------------
// Once the Workshop is up, a wooden project's parts are milled and cut here first (jointer, planer,
// table saw, mitre saw, joinery at the bench), then js/projects.js assembles and places it as before.
// Welded builds still go to the weld studio. Nothing in projects.js is duplicated.
const WOODSHOP_PROJECT_STEPS = [
  ['jointer', 'Jointing the boards for the', 1800],
  ['planer', 'Planing them to thickness for the', 1800],
  ['tablesaw', 'Ripping the parts on the table saw for the', 2200],
  ['mitresaw', 'Crosscutting the parts for the', 1600],
  ['woodbench', 'Cutting the joints and dry-fitting the', 2200]
];

async function millProjectInWoodshop(plan) {
      if (typeof goIntoWorkshop !== 'function' || typeof wsGroup === 'undefined' || !wsGroup || plan.welded) return false;
      const what = String(plan.name || 'project').toLowerCase();
      const stops = WOODSHOP_PROJECT_STEPS.map(([key, title, ms]) => ({
        floor: 3, key, act: async ctx => {
          const u = ctx.model.userData;
          await machineStep(ctx, `${title} ${what}`, ms, (k, t) => {
            if (u.blade && u.blade.rotation) u.blade.rotation.x = t * 60;
            if (u.head && key === 'jointer') u.head.rotation.y = t * 40;
            if (u.roller) u.roller.rotation.x = t * 30;
            if (u.arm) u.arm.rotation.x = -0.4 + Math.sin(k * Math.PI) * 0.5;
            if (key !== 'woodbench') sawdust(ctx.model, new THREE.Vector3(0, 0.9, 0));
          }, key === 'tablesaw' ? 'Push stick, riving knife, guard down.' : null);
          machineSkill(key, 2);
          return true;
        }
      }));
      state.moodEmoji = '🪵';
      state.moodTitle = `Milling the parts for the ${what} in the woodshop`.slice(0, 80);
      renderAllUI();
      const r = await goIntoWorkshop({ stops });
      if (r) machineSkill('woodshop', 3);
      return Boolean(r);
    }

if (typeof buildProject === 'function') {
  const baseBuildProject = buildProject;
  buildProject = async function (id, originLabel) {
    const p = state.projects && state.projects.find(q => q.id === id && q.status === 'gathering');
    const plan = p && typeof planFor === 'function' ? planFor(p.key) : null;
    if (plan && !plan.welded && !p.milledInWoodshop && !(state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping)
      && typeof missingFor === 'function' && !missingFor(plan).materials.length && !missingFor(plan).tools.length) {
      state.isPracticing = true;
      try { p.milledInWoodshop = await millProjectInWoodshop(plan); } finally { state.isPracticing = false; }
    }
    return baseBuildProject(id, originLabel);
  };
}
