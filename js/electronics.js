// Kelo-bot-1 — js/electronics.js
// Loaded after cnc.js. Floor 2 of his Workshop, the computer manufacturing and electronics room: a
// working PCB line. He designs the board and writes its firmware at the ESD bench, mills the board
// from copper-clad FR-4, prints solder paste through a stencil, the pick-and-place puts the parts
// down from their reels, the reflow oven melts the paste, AOI inspects it, the wave solders the
// through-hole connectors, the laser cuts an acrylic front panel and the FDM or SLA printer makes
// the enclosure. Then he puts it together, flashes it and tests it: a real gadget he can use (a
// weather station, an FM radio, a controller for his robot friend, a game console).
// Floor 2 machines are built only while he is up there (js/workshopbuilding.js).

// Local positions on floor 2 (x across, z toward the front)
const PCB_ROW = -6.5, PCB_ROW2 = -4.3;

function e2(def) {
      return registerWorkshopMachine({ floor: 2, kind: 'electronics', ...def });
    }

e2({ key: 'esd', name: 'ESD electronics bench', short: 'electronics bench', at: { x: -2.9, z: -2.75, ry: Math.PI }, size: { w: 1.6, h: 1.4, d: 0.7 }, learnAs: 'pcbline', model: esdBenchModel, stand: { x: -2.9, z: -1.85 } });
e2({ key: 'paste', name: 'DEK solder paste printer', short: 'solder paste printer', at: { x: -3.3, z: PCB_ROW, ry: 0 }, size: { w: 0.9, h: 1.4, d: 0.8 }, learnAs: 'pcbline', skill: 'Solder paste printing', model: pastePrinterModel, stand: { x: -3.3, z: -5.5 } });
e2({ key: 'pnp', name: 'Juki pick-and-place machine', short: 'pick-and-place', at: { x: -2.05, z: PCB_ROW, ry: 0 }, size: { w: 1.2, h: 1.5, d: 1.0 }, learnAs: 'pcbline', skill: 'Pick and place', model: pickPlaceModel, stand: { x: -2.05, z: -5.5 } });
e2({ key: 'reflow', name: 'Reflow oven', short: 'reflow oven', at: { x: -0.2, z: PCB_ROW, ry: 0 }, size: { w: 2.0, h: 1.3, d: 0.8 }, learnAs: 'pcbline', skill: 'Reflow soldering', model: reflowOvenModel, stand: { x: -0.2, z: -5.5 } });
e2({ key: 'aoi', name: 'AOI inspection machine', short: 'AOI', at: { x: 1.65, z: PCB_ROW, ry: 0 }, size: { w: 0.9, h: 1.4, d: 0.8 }, learnAs: 'pcbline', skill: 'Optical inspection', model: aoiModel, stand: { x: 1.65, z: -5.5 } });
e2({ key: 'wave', name: 'Wave soldering machine', short: 'wave solder', at: { x: -2.9, z: PCB_ROW2, ry: 0 }, size: { w: 1.7, h: 1.3, d: 0.8 }, learnAs: 'pcbline', skill: 'Wave soldering', model: waveSolderModel, stand: { x: -2.9, z: -3.4 } });
e2({ key: 'encbench', name: 'Enclosure printer bench (FDM + SLA)', short: 'enclosure printers', at: { x: 2.0, z: PCB_ROW2, ry: 0 }, size: { w: 1.6, h: 1.3, d: 0.7 }, learnAs: 'pcbline', skill: 'Printing enclosures',
  stand: { x: 2.0, z: -3.4 },
  model: () => {
    const g = workBenchModel(1.6, 0.7);
    const f = fdmPrinterModel(); f.position.set(-0.4, 0.98, 0.05); g.add(f);
    const s = slaPrinterModel(); s.position.set(0.4, 0.98, 0.05); g.add(s);
    g.userData.fdm = f; g.userData.sla = s;
    return g;
  } });

// The PCB mill and the laser have jobs of their own too
e2({
  key: 'pcbmill', name: 'LPKF ProtoMat PCB mill', short: 'PCB mill', at: { x: -1.3, z: PCB_ROW2, ry: 0 }, size: { w: 0.7, h: 0.9, d: 0.6 }, emoji: '🟩', skill: 'PCB milling', model: () => { const g = new THREE.Group(); mmBox(g, 0.8, 0.75, 0.6, 'dark', 0, 0, 0); const m = pcbMillModel(); m.position.y = 0.75; g.add(m); g.userData = { ...m.userData, inner: m }; return g; },
  stand: { x: -1.3, z: -3.4 },
  wiki: ['Printed circuit board milling'], learned: 'A PCB mill cuts the copper away from a copper-clad FR-4 board around each trace with tiny engraving bits, then drills the holes and cuts the outline, so a prototype board is ready in an hour.',
  needs: ['pcbs', 'millBits', 'esdStrap'], words: [/pcb mill|protomat|lpkf|mill (a |me a )?(pcb|board)/i],
  products: ['A PCB-milled prototype board'], makes: [/prototype board|pcb/],
  plan(job) {
    const key = this.key, name = 'A PCB-milled prototype board';
    return {
      title: 'Milling a prototype circuit board', product: name,
      stops: [{ floor: 2, key, act: async ctx => { await pcbMillStep(ctx); return true; } }],
      finish: () => { addMadeThing(name, 'PCB mill', { emoji: '🟩' }); machineSkill(key, 6); }
    };
  }
});
e2({
  key: 'laser', name: 'Trotec laser cutter / marker', short: 'laser cutter', at: { x: 0.15, z: PCB_ROW2, ry: 0 }, size: { w: 1.1, h: 1.0, d: 0.75 }, emoji: '🔴', skill: 'Laser cutting', model: laserCutterModel,
  stand: { x: 0.15, z: -3.4 },
  wiki: ['Laser cutting'], learned: 'A CO2 laser cutter burns through acrylic, wood and card along vector lines and engraves raster images. The lid must stay shut (the beam is invisible and dangerous) and the fume extraction must run.',
  needs: ['acrylic', 'safetyGlasses'], words: [/laser (cut|cutter|mark|engrav)|trotec/i],
  products: ['A laser-cut acrylic sign', 'A laser-cut acrylic front panel'], makes: [/acrylic|panel|laser/],
  plan(job) {
    const key = this.key, name = job.make ? madeName('laser-cut', 'acrylic', job.make, this.products[0]) : this.products[0];
    return {
      title: `Laser cutting ${wsWhat(name)}`, product: name,
      stops: [{ floor: 2, key, act: async ctx => { await laserStep(ctx, name); return true; } }],
      finish: () => { addMadeThing(name, 'laser cutter', { emoji: '🔴' }); machineSkill(key, 6); }
    };
  }
});

// --- The steps (shared by the line and the single-machine jobs) -------------------------------------
async function pcbMillStep(ctx) {
      const u = ctx.model.userData.inner.userData;
      useWorkshopSupply('pcbs', 1, 'PCB milling');
      useWorkshopSupply('millBits', 1, 'PCB milling');
      const board = mmBox(ctx.model.userData.inner, 0.3, 0.01, 0.2, 'copper', 0, 0.46, 0);
      await machineStep(ctx, 'Milling the traces', 6000, (k, t) => {
        u.gantry.position.x = Math.sin(t * 3.1) * u.travel.x;
        u.head.position.z = Math.sin(t * 4.7) * u.travel.z;
        board.material = k > 0.5 ? mmMat('pcb') : mmMat('copper');
      }, 'Isolation milling: the copper between the traces comes away.');
      u.gantry.position.x = 0;
      ctx.model.userData.inner.remove(board);
      machineSkill('pcbmill', 3);
    }

async function laserStep(ctx, name) {
      const u = ctx.model.userData;
      useWorkshopSupply('acrylic', 1, 'Laser cutting');
      const sheet = mmBox(ctx.model, 0.7, 0.01, 0.45, 'glass', 0, 0.76, 0);
      await machineStep(ctx, 'Laser cutting the acrylic', 6000, (k, t) => {
        u.gantry.position.x = Math.sin(t * 2.3) * u.travel.x;
        u.head.position.z = Math.cos(t * 3.4) * u.travel.z;
        wsGlowSet(u.beam, Math.random() > 0.15 ? 1 : 0.2);
      }, 'The beam is invisible, so the lid stays shut. Smells like hot plastic.');
      wsGlowSet(u.beam, 0);
      ctx.model.remove(sheet);
      machineSkill('laser', 3);
    }

// A board riding the conveyor through an SMT machine (in the machine's own space)
function boardThrough(model, board, k) {
      const u = model.userData;
      board.position.set(-u.w / 2 - 0.05 + k * (u.w + 0.1), u.railY + 0.01, 0);
    }

// --- The whole line: a gadget from nothing ---------------------------------------------------------------
const GADGETS = [
  { key: 'weather', name: 'A homemade weather station', words: /weather/i, emoji: '🌦️', firmware: 'reads its wind cups, thermometer and barometer every minute' },
  { key: 'radio', name: 'A homemade FM radio', words: /radio|fm\b/i, emoji: '📻', firmware: 'tunes the FM band with a PLL tuner chip' },
  { key: 'controller', name: 'A homemade robot-friend controller', words: /controller|remote|robot/i, emoji: '🎮', firmware: 'talks to his robot friend over 2.4 GHz' },
  { key: 'console', name: 'A homemade game console', words: /console|game/i, emoji: '🕹️', firmware: 'runs little games he wrote himself' }
];

function gadgetFor(text) {
      return GADGETS.find(g => g.words.test(String(text || ''))) || null;
    }

registerWorkshopMachine({
  key: 'pcbline', name: 'PCB line (paste, place, reflow, AOI)', short: 'electronics line', kind: 'electronics', floor: 2, emoji: '🔌', skill: 'Building electronics',
  teaches: ['esd', 'paste', 'pnp', 'reflow', 'aoi', 'wave', 'encbench'],
  wiki: ['Surface-mount technology', 'Reflow soldering', 'Wave soldering', 'Automated optical inspection'],
  learned: 'An SMT line prints solder paste through a stencil onto the bare board, a pick-and-place machine sets each part from its reel, a reflow oven melts the paste with a careful temperature profile, and AOI cameras check every joint. Through-hole parts go over a wave of molten solder after flux. ESD straps protect the chips.',
  needsFor: job => {
    const sla = /resin|sla|clear/i.test(job.make || '');
    return ['pcbs', 'millBits', 'solderPaste', 'stencil', 'reels', 'flux', 'solderBar', 'acrylic', sla ? 'resin' : 'filament', 'esdStrap'];
  },
  words: [/pcb line|electronics|circuit board|weather station|radio|controller|game console|gadget|smt|pick.?and.?place|reflow|solder/i],
  products: GADGETS.map(g => g.name), makes: [/weather station|radio|controller|console/],
  plan(job) {
    const key = this.key;
    const made = state.workshop && state.workshop.made ? state.workshop.made.map(m => m.name) : [];
    const gadget = gadgetFor(job.make) || GADGETS.find(g => !made.includes(g.name)) || wsPick(GADGETS);
    const sla = /resin|sla|clear/i.test(job.make || '');
    let board = null;
    const carry = (model) => { board = board || pcbBoardModel(); model.add(board); return board; };
    const leave = (model) => { if (board && board.parent === model) model.remove(board); };
    let aoiFound = false;
    return {
      title: `Building ${plainItem(gadget.name).toLowerCase()}`, product: gadget.name, speech: `Wrist strap on. Today I'm building ${plainItem(gadget.name).toLowerCase()}.`,
      stops: [
        { floor: 2, key: 'esd', act: async ctx => {
          useWorkshopSupply('esdStrap', 0, 'ESD');
          await machineStep(ctx, 'Designing the schematic and board layout', 2600, null, 'Schematic, footprints, then routing the traces. Two layers is plenty.');
          await machineStep(ctx, 'Writing the firmware', 2000, null, `The firmware ${gadget.firmware}.`);
          workshopState().programs.pcbline = { name: gadget.name, at: Date.now(), gcode: `// firmware for ${gadget.name}: ${gadget.firmware}` };
          return true;
        } },
        { floor: 2, key: 'pcbmill', act: async ctx => { await pcbMillStep(ctx); return true; } },
        { floor: 2, key: 'paste', act: async ctx => {
          const m = ctx.model, u = m.userData;
          useWorkshopSupply('solderPaste', 1, 'Paste printing');
          const b = carry(m);
          await machineStep(ctx, 'Solder paste through the stencil', 3500, (k, t) => {
            boardThrough(m, b, Math.min(1, k * 2.2) * 0.5);
            if (k > 0.45 && k < 0.8) u.squeegee.position.x = -0.15 + (k - 0.45) / 0.35 * 0.3;
            b.userData.paste.visible = k > 0.6;
            if (k > 0.8) boardThrough(m, b, 0.5 + (k - 0.8) / 0.2 * 0.5);
          });
          leave(m);
          machineSkill('paste', 2);
          return true;
        } },
        { floor: 2, key: 'pnp', act: async ctx => {
          const m = ctx.model, u = m.userData;
          useWorkshopSupply('reels', 1, 'Pick and place');
          const b = carry(m);
          boardThrough(m, b, 0.5);
          mmSetTower(u.tower, 'run');
          await machineStep(ctx, 'Placing the components from their reels', 5000, (k, t) => {
            // Each part: the head goes to its feeder reel at the front, picks, comes back and places it
            const n = b.userData.parts.length, f = k * n, i = Math.min(n - 1, Math.floor(f)), c = f - i;
            b.userData.parts.forEach((p, j) => { p.visible = j < i || (j === i && c > 0.9); });
            const reelX = -0.48 + (i % 9) * 0.12, part = b.userData.parts[i];
            const boardX = b.position.x + part.position.x, boardZ = b.position.z + part.position.z;
            const go = c < 0.45 ? c / 0.45 : c < 0.55 ? 1 : 1 - (c - 0.55) / 0.45;
            u.head.position.x = boardX + (reelX - boardX) * go;
            u.head.position.z = boardZ + (0.33 - boardZ) * go;
            u.head.position.y = 1.15 - (Math.abs(c - 0.5) < 0.05 || c > 0.88 ? 0.06 : 0);
          }, 'Click-click-click: a part every fraction of a second.');
          mmSetTower(u.tower, 'idle');
          await ctx.animate(800, k => boardThrough(m, b, 0.5 + k * 0.5));
          leave(m);
          machineSkill('pnp', 2);
          return true;
        } },
        { floor: 2, key: 'reflow', act: async ctx => {
          const m = ctx.model, u = m.userData;
          const b = carry(m);
          mmSetTower(u.tower, 'run');
          await machineStep(ctx, 'Reflow: preheat, soak, peak, cool', 6000, (k) => {
            boardThrough(m, b, k);
            u.zones.forEach((z, i) => wsGlowSet(z, i < 6 ? 0.3 + i * 0.12 : 0.15));
          }, 'The paste goes grey, then shiny: every joint wets at once.');
          u.zones.forEach(z => wsGlowSet(z, 0));
          mmSetTower(u.tower, 'idle');
          leave(m);
          machineSkill('reflow', 2);
          return true;
        } },
        { floor: 2, key: 'aoi', act: async ctx => {
          const m = ctx.model, u = m.userData;
          const b = carry(m);
          aoiFound = Math.random() < Math.max(0.1, 0.45 - machineLevel(key) * 0.06);
          await machineStep(ctx, 'AOI cameras checking every joint', 3500, (k, t) => {
            boardThrough(m, b, k < 0.2 ? k * 2.5 : k > 0.8 ? 0.5 + (k - 0.8) * 2.5 : 0.5);
            u.cam.position.x = Math.sin(t * 6) * 0.2;
            wsGlowSet(u.ring, 0.8);
          }, aoiFound ? 'AOI flagged one resistor standing on end: a tombstone. I\'ll fix it at the bench.' : 'AOI: all joints pass.');
          wsGlowSet(u.ring, 0);
          leave(m);
          machineSkill('aoi', 2);
          return true;
        } },
        { floor: 2, key: 'wave', act: async ctx => {
          const m = ctx.model, u = m.userData;
          useWorkshopSupply('flux', 1, 'Wave soldering');
          useWorkshopSupply('solderBar', 1, 'Wave soldering');
          const b = carry(m);
          await machineStep(ctx, 'Over the solder wave', 4500, (k, t) => {
            boardThrough(m, b, k);
            wsGlowSet(u.preheat, 0.6);
            wsGlowSet(u.pot, 0.8);
            u.wave.position.y = 0.89 + Math.sin(t * 12) * 0.008;
          });
          wsGlowSet(u.preheat, 0);
          wsGlowSet(u.pot, 0);
          leave(m);
          machineSkill('wave', 2);
          return true;
        } },
        { floor: 2, key: 'laser', act: async ctx => { await laserStep(ctx, 'front panel'); return true; } },
        { floor: 2, key: 'encbench', act: async ctx => {
          const m = ctx.model;
          const printer = sla ? m.userData.sla : m.userData.fdm;
          const pu = printer.userData;
          if (sla) useWorkshopSupply('resin', 1, 'Enclosure'); else useWorkshopSupply('filament', 30, 'Enclosure');
          const box = mmBox(sla ? pu.platform : pu.bed, 0.12, 1, 0.08, sla ? 'greyResin' : 'orange', 0, sla ? -0.05 : 0.012, 0);
          box.scale.y = 0.001;
          await machineStep(ctx, `Printing the enclosure on the ${sla ? 'SLA' : 'FDM'} printer`, 5000, (k, t) => {
            if (sla) { pu.platform.position.y = 0.215 + k * 0.12; box.position.y = -0.05 * k; }
            else { pu.head.position.x = Math.sin(t * 7) * pu.travel.x; pu.gantry.position.y = 0.12 + k * 0.06; }
            box.scale.y = Math.max(0.001, k * 0.05);
          });
          box.parent.remove(box);
          machineSkill('encbench', 2);
          return true;
        } },
        { floor: 2, key: 'esd', act: async ctx => {
          if (aoiFound) await machineStep(ctx, 'Reworking the tombstoned resistor', 1800);
          await machineStep(ctx, 'Assembling it and flashing the firmware', 2600, null, 'Board in, panel on, screws in. Flashing... done!');
          await machineStep(ctx, `Testing ${plainItem(gadget.name).toLowerCase()}`, 1800, null, `It works! ${gadget.emoji}`);
          return true;
        } }
      ],
      finish: () => { addMadeThing(gadget.name, 'electronics line', { gadget: true, emoji: gadget.emoji }); machineSkill(key, 8); }
    };
  }
});

// --- Using what he built ---------------------------------------------------------------------------------
function ownedGadgets() {
      return ownedItemNames().filter(n => /^A homemade (weather station|FM radio|robot-friend controller|game console)$/i.test(n));
    }

function useWorkshopGadget(name) {
      const g = GADGETS.find(x => x.name.toLowerCase() === String(name || '').toLowerCase()) || gadgetFor(name);
      if (!g || !ownedItemNames().includes(g.name)) return false;
      const w = workshopState();
      w.gadgetUses = (w.gadgetUses || 0) + 1;
      let speech = '', diary = '';
      if (g.key === 'weather') {
        const wx = typeof weatherSummaryForAI === 'function' ? weatherSummaryForAI() : 'calm';
        const wind = typeof windSummaryForAI === 'function' ? windSummaryForAI() : 'light';
        speech = `My weather station says: ${wx}; wind ${wind}.`.slice(0, 220);
        diary = `I checked the weather station I built. ${speech}`;
        w.weatherLog = [{ at: Date.now(), wx, wind }, ...(w.weatherLog || [])].slice(0, 10);
        state.wonderLevel = Math.min(100, state.wonderLevel + 4);
      } else if (g.key === 'radio') {
        speech = wsPick(['Tuned in to a station from Kelowna. Music!', 'Static... then a jazz station. My radio works!', 'The news says it\'s a nice day in the valley.']);
        diary = 'I listened to the FM radio I built myself. It picks up stations from all over the valley.';
        if (typeof playEmote === 'function') playEmote('dance');
        state.happiness = Math.min(100, state.happiness + 6);
      } else if (g.key === 'controller') {
        const friend = state.unlockedFeatures && state.unlockedFeatures.friend;
        speech = friend ? 'Calling my robot friend with the controller I built... it waved back!' : 'The controller pairs and blinks, waiting for a robot friend to talk to.';
        diary = speech;
        if (typeof playEmote === 'function') playEmote('wave');
        state.happiness = Math.min(100, state.happiness + 4);
      } else {
        speech = wsPick(['One more level of my own game. I keep beating my high score!', 'Playing the game I wrote on the console I built. Ha!']);
        diary = 'I played a game on the console I built, running games I wrote myself.';
        state.happiness = Math.min(100, state.happiness + 7);
        state.calmLevel = Math.min(100, state.calmLevel + 5);
      }
      state.moodEmoji = g.emoji;
      state.moodTitle = `Using my ${plainItem(g.name).replace(/^homemade\s+/i, '').toLowerCase()}`.slice(0, 80);
      state.speechBubble = speech;
      state.diaryEntries.unshift({ time: 'Using Something I Built', location: currentPlaceLabel(), mood: `${g.emoji} ${state.moodTitle}`.slice(0, 80), vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '', text: `Dear Diary, ${diary}` });
      if (typeof gainSkill === 'function') gainSkill('ws-pcbline', 'Building electronics', 1);
      renderAllUI();
      return true;
    }

function gadgetChance() {
      return ownedGadgets().length ? 0.06 : 0;
    }

function useGadgetOnMyOwn() {
      const list = ownedGadgets();
      return list.length ? useWorkshopGadget(wsPick(list)) : false;
    }

// "Use" from the AI (useItem) or takeOut also reaches gadgets: they work for what they are for
if (typeof PURPOSE_WORDS !== 'undefined') PURPOSE_WORDS.unshift([/weather station|listen to (my |the )?radio|play (on )?(my |the )?console/i, 'gadget']);
