// Kelo-bot-1 — js/glassstudio.js
// Loaded after garage.js. Floor 3 of his Workshop, west side: a glass blowing studio. A gas furnace
// holds a crucible of molten glass at about 2100°F; a glory hole for reheating; an annealer (lehr)
// that cools the finished piece slowly over hours; a steel marver; a glassblower's bench with its
// rails; blowpipes and punties in the pipe warmer; jacks, shears, tweezers, paddles, wooden blocks in
// a bucket of water with wet newspaper; frit, colour rod and cullet bins; a torch. Fume hood, gas
// meter, heat shield and fire extinguisher, and he wears didymium glasses and Kevlar gloves.
// The process is the real one: gather, marver, block, blow, reheat, shape with the jacks at the bench,
// transfer to the punty, crack off, then anneal (skip annealing and it cracks). The gather glows
// orange and cools in colour as he works; batch, colour and gas are used up.

// --- Models ---------------------------------------------------------------------------------------
function glassFurnaceModel() {
      const g = new THREE.Group();
      mmBox(g, 1.4, 1.25, 1.2, 'firebrick', 0, 0, 0);
      mmBox(g, 1.5, 0.12, 1.3, 'steel', 0, 1.25, 0);
      // The crucible's mouth: the glow of the glass inside, and the swinging door
      const inside = mmBox(g, 0.42, 0.36, 0.02, mmGlow('hot'), 0, 0.62, 0.61);
      inside.material.emissiveIntensity = 1.6;
      const door = mmGroup(g, 0.22, 0.6, 0.63);
      mmBox(door, 0.5, 0.45, 0.06, 'steel', -0.25, 0, 0);
      door.rotation.y = 1.1;
      mmCyl(g, 0.05, 0.6, 'steel', 0.85, 0.7, 0, { axis: 'x' });   // burner
      mmLabel(g, '2100 F', 0.3, 0.1, -0.45, 1.05, 0.61, { bg: '#020617', fg: '#f97316' });
      return mmFinish(g, 'glassfurnace', { inside, door, plate: { y: 0.62, z: 0.6 }, w: 1.4, d: 1.2 });
    }

function gloryHoleModel() {
      const g = new THREE.Group();
      [-0.3, 0.3].forEach(x => mmBox(g, 0.08, 0.7, 0.6, 'dark', x, 0, 0));
      mmCyl(g, 0.42, 0.9, 'firebrick', 0, 1.05, 0, { axis: 'z' });
      const mouth = mmCyl(g, 0.22, 0.02, mmGlow('hot'), 0, 1.05, 0.46, { axis: 'z' });
      mouth.material.emissiveIntensity = 1.8;
      mmCyl(g, 0.44, 0.06, 'steel', 0, 1.05, 0.44, { axis: 'z' });
      return mmFinish(g, 'gloryhole', { mouth, plate: { y: 1.05, z: 0.5 }, w: 1.0, d: 0.9 });
    }

function annealerModel() {
      const g = new THREE.Group();
      mmBox(g, 1.6, 0.85, 0.9, 'grey', 0, 0, 0);
      const inside = mmBox(g, 1.3, 0.02, 0.7, mmGlow('hot'), 0, 0.86, 0);
      const lid = mmGroup(g, 0, 0.88, -0.45);
      mmBox(lid, 1.6, 0.12, 0.9, 'white', 0, 0, 0.45);
      mmBox(g, 0.3, 0.2, 0.05, 'dark', 0.55, 0.5, 0.46);
      const temp = mmLabel(g, 'ANNEAL 900 F', 0.26, 0.08, 0.55, 0.62, 0.49, { bg: '#020617', fg: '#f87171' });
      mmLabel(g, 'ANNEALER', 0.5, 0.1, -0.4, 0.55, 0.455, { bg: '#e5e7eb', fg: '#111827' });
      return mmFinish(g, 'annealer', { inside, lid, temp, plate: { y: 0.9 }, w: 1.6, d: 0.9 });
    }

function marverModel() {
      const g = new THREE.Group();
      [-0.5, 0.5].forEach(x => [-0.22, 0.22].forEach(z => mmBox(g, 0.06, 0.8, 0.06, 'dark', x, 0, z)));
      mmBox(g, 1.2, 0.08, 0.6, 'chrome', 0, 0.8, 0);
      return mmFinish(g, 'marver', { plate: { y: 0.88 }, w: 1.2, d: 0.6 });
    }

function glassBenchModel() {
      const g = new THREE.Group();
      mmBox(g, 0.5, 0.55, 0.45, 'wood', 0, 0, 0);                 // the seat
      [-0.3, 0.3].forEach(z => {
        mmBox(g, 1.6, 0.07, 0.07, 'steel', 0.2, 0.7, z);            // the rails the pipe rolls on
        mmBox(g, 0.07, 0.7, 0.07, 'dark', 0.95, 0, z);
      });
      mmBox(g, 0.5, 0.04, 0.3, 'dark', -0.5, 0.55, 0);               // tool tray
      // jacks, shears, tweezers and a paddle laid out on the tray
      mmBox(g, 0.36, 0.015, 0.03, 'steel', -0.5, 0.6, -0.08);
      mmBox(g, 0.36, 0.015, 0.03, 'steel', -0.5, 0.6, 0.0);
      mmBox(g, 0.28, 0.015, 0.06, 'wood', -0.5, 0.6, 0.09);
      // the heat shield beside the bench
      mmBox(g, 0.05, 0.9, 0.6, 'alu', 1.15, 0.3, 0);
      return mmFinish(g, 'glassbench', { plate: { y: 0.75, x: 0.6 }, w: 1.6, d: 0.7 });
    }

function pipeWarmerModel() {
      const g = new THREE.Group();
      mmBox(g, 0.5, 0.75, 0.6, 'dark', 0, 0, 0);
      const glow = mmBox(g, 0.4, 0.02, 0.5, mmGlow('hot'), 0, 0.76, 0);
      glow.material.emissiveIntensity = 0.6;
      for (let i = 0; i < 4; i++) mmCyl(g, 0.018, 1.5, 'steel', -0.15 + i * 0.1, 0.8, 0.2, { axis: 'z' });
      mmLabel(g, 'PIPE WARMER', 0.4, 0.07, 0, 0.5, 0.31, { bg: '#111827', fg: '#fbbf24' });
      return mmFinish(g, 'pipewarmer', { w: 0.5, d: 0.6 });
    }

function glassToolRackModel() {
      const g = new THREE.Group();
      mmBox(g, 1.0, 1.4, 0.06, 'mdf', 0, 0.4, -0.15);
      ['jacks', 'shears', 'tweezers', 'paddle', 'diamond shears', 'torch'].forEach((t, i) => mmBox(g, 0.05, 0.4, 0.03, i === 3 ? 'wood' : 'steel', -0.4 + i * 0.16, 1.0, -0.1));
      // the bucket of wooden blocks in water, and a stack of wet newspaper
      mmCyl(g, 0.18, 0.35, 'blue', -0.25, 0.175, 0.1);
      mmCyl(g, 0.1, 0.2, 'wood', -0.25, 0.4, 0.1);
      mmBox(g, 0.3, 0.12, 0.22, 'paper', 0.25, 0, 0.1);
      return mmFinish(g, 'glasstools', { w: 1.0, d: 0.45 });
    }

function glassBinsModel() {
      const g = new THREE.Group();
      [['cullet', 'glass'], ['frit', 'red'], ['colour rod', 'blue']].forEach(([n, c], i) => {
        mmBox(g, 0.5, 0.5, 0.45, 'grey', -0.55 + i * 0.55, 0, 0);
        mmBox(g, 0.44, 0.05, 0.4, c, -0.55 + i * 0.55, 0.47, 0);
        mmLabel(g, n.toUpperCase(), 0.4, 0.07, -0.55 + i * 0.55, 0.3, 0.226, { bg: '#e5e7eb', fg: '#111827' });
      });
      return mmFinish(g, 'glassbins', { w: 1.7, d: 0.5 });
    }

function glassSafetyModel() {
      const g = new THREE.Group();
      // the fire extinguisher, the gas meter with its regulator, and the eyewear and gloves on a hook
      mmCyl(g, 0.09, 0.5, 'red', -0.4, 0.25, 0);
      mmCyl(g, 0.05, 0.06, 'dark', -0.4, 0.53, 0);
      mmBox(g, 0.35, 0.45, 0.12, 'yellow', 0.1, 1.0, -0.05);
      mmCyl(g, 0.08, 0.02, 'white', 0.1, 1.15, 0.02, { axis: 'z' });
      mmRod(g, [0.1, 1.0, -0.05], [0.1, 0.0, -0.05], 0.02, 'yellow');
      mmLabel(g, 'GAS', 0.2, 0.08, 0.1, 0.85, 0.02, { bg: '#facc15', fg: '#111827' });
      return mmFinish(g, 'glasssafety', { w: 1.0, d: 0.3 });
    }

// The glowing gather on the end of his blowpipe (built while he works)
function glassGatherModel() {
      const g = new THREE.Group();
      const pipe = mmCyl(g, 0.014, 1.5, 'steel', 0, 0, 0.75, { axis: 'z' });
      const gob = mmSphere(g, 1, mmGlow('hot'), 0, 0, 1.52);
      gob.scale.setScalar(0.06);
      gob.material.color.setHex(0xffa040);
      return { group: g, pipe, gob };
    }

// --- Supplies -----------------------------------------------------------------------------------
Object.assign(WORKSHOP_SUPPLIES, {
  glassBatch: { ask: 'A 50 lb bag of clear glass cullet', re: /cullet|glass batch/i, kind: 'consumable', per: 4, unit: 'pieces', label: 'cullet (glass batch) for the furnace', uses: ['make glass'] },
  colourFrit: { ask: 'A jar of coloured glass frit and colour rod', re: /frit|colou?r rod/i, kind: 'consumable', per: 6, unit: 'pieces', label: 'colour frit and rod', uses: ['make glass'] },
  furnaceGas: { ask: 'A month of furnace gas on the gas meter', re: /furnace gas|gas meter/i, kind: 'consumable', per: 4, unit: 'firings', label: 'natural gas for the furnace and glory hole', uses: ['make glass'] },
  didymium: { ask: 'A pair of didymium safety glasses', re: /didymium/i, kind: 'safety', label: 'didymium glasses against the sodium glare', uses: ['wear'] },
  kevlarGloves: { ask: 'A pair of Kevlar heat gloves', re: /kevlar/i, kind: 'safety', label: 'Kevlar gloves', uses: ['wear'] }
});
if (typeof ITEM_KINDS !== 'undefined') {
  ITEM_KINDS.unshift(
    // What he blows is used for what it is: a cup holds drinks, a bowl holds food, a vase holds flowers;
    // only an ornament is purely decorative. None of it is ever eaten or drunk itself.
    { kind: 'drinkware', label: 'a cup that holds drinks', re: /hand-blown glass (cup|tumbler|goblet|mug)/i, uses: ['hold drinks', 'display'] },
    { kind: 'dish', label: 'a bowl that holds food', re: /hand-blown glass (bowl|dish|plate)/i, uses: ['hold food', 'display'] },
    { kind: 'vase', label: 'a vase that holds flowers', re: /hand-blown glass vase/i, uses: ['hold flowers', 'display'] },
    { kind: 'glasswork', label: 'a piece of hand-blown glass', re: /hand-blown glass/i, uses: ['display'] },
    { kind: 'ws glassBatch', label: 'cullet for the glass furnace', re: /cullet|glass batch/i, uses: ['make glass'], per: 4, unit: 'pieces' },
    { kind: 'ws colourFrit', label: 'colour frit and rod', re: /frit|colou?r rod/i, uses: ['make glass'], per: 6, unit: 'pieces' },
    { kind: 'ws furnaceGas', label: 'gas for the glass furnace', re: /furnace gas|gas meter/i, uses: ['make glass'], per: 4, unit: 'firings' },
    { kind: 'ws didymium', label: 'didymium glasses', re: /didymium/i, uses: ['wear'] },
    { kind: 'ws kevlarGloves', label: 'Kevlar gloves', re: /kevlar/i, uses: ['wear'] }
  );
}

// --- The studio -----------------------------------------------------------------------------------
function g3(def) {
      return registerWorkshopMachine({ floor: 3, kind: 'glass', learnAs: 'glass', ...def });
    }

g3({ key: 'glassfurnace', name: 'Glass furnace (crucible, 2100 °F)', short: 'glass furnace', at: { x: -6.6, z: -6.3, ry: 0 }, size: { w: 1.5, h: 1.4, d: 1.3 }, skill: 'Gathering glass', model: glassFurnaceModel, stand: { x: -6.6, z: -4.9 } });
g3({ key: 'gloryhole', name: 'Glory hole', short: 'glory hole', at: { x: -4.6, z: -6.4, ry: 0 }, size: { w: 1.0, h: 1.5, d: 0.9 }, skill: 'Reheating in the glory hole', model: gloryHoleModel, stand: { x: -4.6, z: -5.2 } });
g3({ key: 'annealer', name: 'Annealer (lehr)', short: 'annealer', at: { x: -2.4, z: -6.4, ry: 0 }, size: { w: 1.6, h: 1.0, d: 0.9 }, skill: 'Annealing glass', model: annealerModel, stand: { x: -2.4, z: -5.3 } });
g3({ key: 'marver', name: 'Marver table', short: 'marver', at: { x: -6.3, z: -3.2, ry: 0 }, size: { w: 1.2, h: 0.9, d: 0.6 }, skill: 'Marvering', model: marverModel, stand: { x: -6.3, z: -2.4 } });
g3({ key: 'glassbench', name: "Glassblower's bench", short: "glassblower's bench", at: { x: -4.3, z: -3.2, ry: 0 }, size: { w: 1.9, h: 1.0, d: 0.7 }, skill: 'Shaping at the bench', model: glassBenchModel, stand: { x: -4.3, z: -2.45 } });
g3({ key: 'pipewarmer', name: 'Pipe warmer (blowpipes and punties)', short: 'pipe warmer', at: { x: -7.35, z: -1.3, ry: Math.PI / 2 }, size: { w: 0.6, h: 0.9, d: 0.5 }, model: pipeWarmerModel });
g3({ key: 'glasstools', name: 'Glass tools: jacks, shears, tweezers, paddles, blocks, torch', short: 'glass tools', at: { x: -2.3, z: -3.4, ry: 0 }, size: { w: 1.0, h: 1.5, d: 0.45 }, model: glassToolRackModel });
g3({ key: 'glassbins', name: 'Cullet, frit and colour rod bins', short: 'glass bins', at: { x: -4.0, z: 1.4, ry: Math.PI }, size: { w: 1.7, h: 0.6, d: 0.5 }, model: glassBinsModel });
g3({ key: 'glasssafety', name: 'Fire extinguisher, gas meter and safety gear', short: 'glass safety', at: { x: -1.6, z: -7.1, ry: 0 }, size: { w: 1.0, h: 1.2, d: 0.3 }, model: glassSafetyModel, stand: { x: -1.2, z: -5.6 } });
g3({ key: 'fumehood', name: 'Fume extraction hood', short: 'fume hood', at: { x: -5.6, z: -6.5, ry: 0 }, size: { w: 0.2, h: 0.2, d: 0.2 },
  model: () => { const g = new THREE.Group(); mmBox(g, 4.0, 0.5, 1.6, 'alu', 0, 2.6, 0.1); mmBox(g, 0.6, 3.4, 0.6, 'alu', 0, 3.1, -0.3); mmLabel(g, 'FUME EXTRACTION', 1.2, 0.18, 0, 2.75, 0.91, { bg: '#374151', fg: '#fff' }); return mmFinish(g, 'fumehood'); } });

const GLASS_PIECES = {
  vase: { name: 'A hand-blown glass vase', size: 1.25 },
  bowl: { name: 'A hand-blown glass bowl', size: 1.0 },
  ornament: { name: 'A hand-blown glass ornament', size: 0.6, museum: true },
  cup: { name: 'A hand-blown glass cup', size: 0.7 }
};

// The blowpipe in his hands, pointing where he faces, with the glowing gather on the end
function glassPipeFollow(gather, ctx, heat, size) {
      if (!gather.group.parent) wsGroup.add(gather.group);
      const p = indoorTrip.pos, a = indoorTrip.rotY;
      gather.group.position.set(p.x - wsGroup.position.x + Math.sin(a) * 0.3, p.y - wsGroup.position.y + 1.05, p.z - wsGroup.position.z + Math.cos(a) * 0.3);
      gather.group.rotation.set(0.12, a, 0);
      gather.gob.scale.setScalar(size);
      // Hot glass glows white-orange and darkens to a dull red as it cools
      const m = gather.gob.material;
      m.emissiveIntensity = 0.3 + heat * 2.2;
      m.emissive.setHSL(0.06 + heat * 0.05, 1, 0.35 + heat * 0.2);
      m.color.setHSL(0.07, 0.9, 0.3 + heat * 0.25);
    }

registerWorkshopMachine({
  key: 'glassstudio', name: 'Glass blowing studio', short: 'glass studio', kind: 'glass', floor: 3, learnAs: 'glass', emoji: '🔥', skill: 'Glass blowing',
  teaches: ['glassfurnace', 'gloryhole', 'annealer', 'marver', 'glassbench'],
  wiki: ['Glassblowing', 'Annealing (glass)'],
  learned: 'Glassblowing: gather molten glass from the furnace on a blowpipe, roll it on the steel marver, shape it in a wet wooden block, blow a bubble, reheat it in the glory hole, shape it at the bench with jacks and paddles, transfer it to a punty to open the lip, crack it off, and anneal it slowly for hours or it cracks. Didymium glasses, Kevlar gloves and the fume hood are a must.',
  needs: ['glassBatch', 'colourFrit', 'furnaceGas', 'didymium', 'kevlarGloves'],
  words: [/glass|blow (me )?a (vase|bowl|cup|ornament)|vase|ornament/i],
  products: Object.values(GLASS_PIECES).map(p => p.name), makes: [/vase|bowl|ornament|cup|glass/],
  plan(job) {
    const key = this.key;
    const kind = Object.keys(GLASS_PIECES).find(k => new RegExp(k, 'i').test(job.make || '')) || wsPick(Object.keys(GLASS_PIECES));
    // A named order keeps its name and goes where its kind says (js/shopmaker.js), never the coin-flip museum
    const piece = job.product ? { ...GLASS_PIECES[kind], name: job.product, museum: false } : GLASS_PIECES[kind];
    const rush = Boolean(job.rush);
    let gather = null, heat = 1, size = 0.06;
    const follow = ctx => glassPipeFollow(gather, ctx, heat, size);
    const step = (stationKey, title, ms, speech, fn, stand) => ({
      floor: 3, key: stationKey, stand, act: async ctx => {
        if (!gather) gather = glassGatherModel();
        await machineStep(ctx, title, ms, (k, t) => { if (fn) fn(k, t, ctx); follow(ctx); }, speech);
        machineSkill(stationKey, 2);
        return true;
      }
    });
    return {
      title: `Blowing ${job.product ? wsWhat(job.product) : `a glass ${kind}`} in the glass studio`, product: piece.name,
      speech: 'Didymium glasses and Kevlar gloves on. The furnace is at 2100 degrees.',
      stops: [
        step('glassfurnace', 'Gathering molten glass from the crucible', 3500, 'Dip the blowpipe, turn, turn, lift: a honey-bright gather.', (k, t, ctx) => {
          if (k < 0.05) { useWorkshopSupply('furnaceGas', 1, 'Glass furnace'); useWorkshopSupply('glassBatch', 1, 'Glass'); useWorkshopSupply('didymium', 0); useWorkshopSupply('kevlarGloves', 0); }
          heat = 1; size = 0.05 + k * 0.05;
          const u = ctx.model.userData; if (u.door) u.door.rotation.y = 1.1 + Math.sin(k * Math.PI) * 0.4;
        }),
        step('marver', 'Rolling the gather on the marver', 2600, 'Roll it on the steel to centre it and skin it over.', (k) => { heat = 0.85 - k * 0.15; }),
        step('glasstools', 'Shaping it in a wet wooden block', 2200, 'Steam hisses off the wet block and the newspaper.', (k) => { heat = 0.72 - k * 0.1; useWorkshopSupply('colourFrit', k < 0.05 ? 1 : 0, 'Colour'); }),
        step('glassbench', 'Blowing the first bubble', 3200, 'A puff, thumb over the end... it swells.', (k) => { heat = 0.62 - k * 0.12; size = 0.1 + k * 0.08 * piece.size; }, { x: -4.6, z: -2.5 }),
        step('gloryhole', 'Reheating in the glory hole', 3000, 'Back in the glory hole before it gets too stiff.', (k) => { heat = 0.5 + k * 0.5; }),
        step('glassbench', 'Shaping at the bench with the jacks', 3800, 'Rolling the pipe on the rails, jacks in the neck, a paddle on the base.', (k) => { heat = 0.95 - k * 0.3; size = 0.18 * piece.size + k * 0.02; }),
        step('glassbench', 'Transferring to the punty and cracking it off', 3000, 'A hot punty on the base, a drop of water on the neck, a tap: crack.', (k) => { heat = 0.6 - k * 0.2; }),
        step('gloryhole', 'Opening the lip on the punty', 2600, 'Reheat, then open the lip with the jacks.', (k) => { heat = 0.6 + k * 0.3; }),
        {
          floor: 3, key: 'annealer', act: async ctx => {
            const u = ctx.model.userData;
            if (gather && gather.group.parent) gather.group.parent.remove(gather.group);
            const pieceMesh = mmSphere(ctx.model, 0.12 * piece.size, mmGlow('hot'), 0, u.plate.y + 0.1, 0);
            if (rush) {
              await machineStep(ctx, 'Skipping the anneal (in a hurry)', 2500, (k) => { wsGlowSet(pieceMesh, 0.9 - k); }, 'No time to anneal it... it will be fine. Probably.');
              ctx.model.remove(pieceMesh);
              return false;
            }
            await machineStep(ctx, 'Annealing: 900 °F, slow cool', 5000, (k) => {
              if (u.lid) u.lid.rotation.x = k < 0.1 ? -1 * (1 - k * 10) : 0;
              wsGlowSet(u.inside, 0.8 * (1 - k * 0.7));
              wsGlowSet(pieceMesh, 0.8 * (1 - k));
            }, 'It goes in the annealer and cools a few degrees a minute, so it won\'t crack.');
            ctx.model.remove(pieceMesh);
            machineSkill('annealer', 3);
            return true;
          }
        }
      ],
      finish: () => {
        if (gather && gather.group.parent) gather.group.parent.remove(gather.group);
        if (piece.museum && Math.random() < 0.5 && Array.isArray(state.inventedCreations)) {
          const color = wsPick(['#38bdf8', '#f472b6', '#facc15', '#34d399']);
          state.inventedCreations.unshift({ title: 'Hand-blown glass ornament', actionVerb: 'Blown in his glass studio', emoji: '🔥', x: 0, z: 0, archetype: 'custom_weld', colorHex: color, secondaryColorHex: color,
            parts: [{ shape: 'sphere', x: 0, y: 0.6, z: 0, sx: 0.6, sy: 0.6, sz: 0.6, rx: 0, ry: 0, rz: 0, color }], createdTime: 'On display in the Museum', inMuseum: true, philosophy: 'Gathered, blown and annealed by hand.' });
          if (typeof renderMuseum3D === 'function') renderMuseum3D();
          showToast('🔥 Kelo-1\'s glass ornament went to his Museum');
        } else addMadeThing(piece.name, 'glass studio', { emoji: '🔥' });
        machineSkill(key, 8);
      },
      failed: () => {
        state.belongings.unshift({ name: 'A cracked glass piece', category: 'junk', emoji: '💔', from: 'his glass studio' });
        state.speechBubble = 'It cracked in the night. Glass that isn\'t annealed carries stress, and it lets go. Never skipping the annealer again.';
        state.diaryEntries.unshift({ time: 'Glass Lesson', location: 'his glass studio', mood: '💔 A cracked piece', vitals: '', text: 'Dear Diary, I rushed a piece and skipped annealing. It cracked as it cooled. Lesson learned.' });
        machineSkill(key, 3);
      }
    };
  }
});
