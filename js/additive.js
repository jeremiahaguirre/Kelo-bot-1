// Kelo-bot-1 — js/additive.js
// Loaded after machines.js. One 3D printer of every kind in his Workshop (floor 1), each with its
// real process, materials, safety gear and post-processing:
//   FDM (his Prusa-style printer: the filament spools of js/printer.js), SLA, DLP, MSLA (resin, then
//   an IPA wash and a UV cure, in nitrile gloves), SLS (PA12 powder, depowdering, bead blasting),
//   DMLS/SLM (metal powder under argon, wire EDM or bandsaw off the build plate, heat treat, a
//   respirator), MJF (PA12 with fusing and detailing agents, cooling, unpacking), PolyJet
//   (photopolymer cartridges, waterjet support removal), binder jetting (powder and binder, curing,
//   sintering), DED (a robot arm laying wire under shielding gas, then machining), EBM (titanium
//   powder in a vacuum on a preheated bed, then powder recovery) and LOM (paper, glue and a knife,
//   then decubing). Each print visibly builds, layer by layer.

// --- Shared bits ---------------------------------------------------------------------------------
const wsPick = pick;

// The thing he asked for, named as what this machine makes ("An SLS-printed nylon hinge")
function madeName(prefix, material, make, fallback) {
      const what = String(make || '').replace(/^(an?|the|some|me)\s+/i, '').replace(/\b(on|with|using)\b.*$/i, '').trim();
      if (!what) return fallback;
      const clean = what.replace(new RegExp(`\\b${material}\\b`, 'i'), '').replace(/\s+/g, ' ').trim();
      const name = `${prefix} ${material} ${clean}`.replace(/\s+/g, ' ').trim();
      return (/^[aeiou]/i.test(name) || /^(FDM|SLA|SLS|MSLA|MJF|LOM|EBM)/.test(name) ? 'An ' : 'A ') + name.slice(0, 70);
    }

// A product sitting on a build plate (in the machine's own space), scaled to fit
function wsPartOn(model, name, size = 0.16, at = null) {
      const part = madePartModel(String(name).toLowerCase());
      const box = new THREE.Box3().setFromObject(part);
      const s = new THREE.Vector3();
      box.getSize(s);
      part.scale.setScalar(size / Math.max(0.01, s.x, s.y, s.z));
      const plate = (at || model.userData.plate || { y: 0.1 });
      part.position.set(plate.x || 0, plate.y || 0, plate.z || 0);
      return part;
    }

function wsGlowSet(mesh, k) {
      if (!mesh || !mesh.material) return;
      mesh.material.emissiveIntensity = (mesh.material.userData.glowMax || 2) * Math.max(0, Math.min(1, k));
    }

// The default powder-bed process: the recoater sweeps a fresh layer, the beam scans, the bed drops
function powderBedFrame(u, k, t, opts = {}) {
      const layers = opts.layers || 24;
      const f = k * layers, layer = Math.floor(f), lk = f - layer;
      const w = (u.winW || 0.5) * 0.4;
      if (u.recoater) u.recoater.position.x = lk < 0.3 ? -w + (lk / 0.3) * 2 * w : (lk < 0.35 ? w : -w);
      if (u.dot) {
        const s = Math.max(0, (lk - 0.35) / 0.65);
        const row = Math.floor(s * 6);
        u.dot.visible = lk > 0.35 && !opts.noBeam;
        u.dot.position.x = (row % 2 ? 1 - (s * 6 % 1) : s * 6 % 1) * w * 1.2 - w * 0.6;
        u.dot.position.z = -0.04 + row * 0.016;
        wsGlowSet(u.dot, 0.6 + Math.random() * 0.4);
      }
      if (u.bed) u.bed.position.y = -k * 0.03;
      if (u.window) wsGlowSet(u.window, opts.glow !== undefined ? opts.glow : 0.35 + (lk > 0.35 ? 0.4 : 0));
    }

function wsMachineIdle(u) {
      if (!u) return;
      if (u.dot) u.dot.visible = false;
      if (u.window) wsGlowSet(u.window, 0);
      if (u.uv) wsGlowSet(u.uv, 0);
      if (u.tower) mmSetTower(u.tower, 'idle');
    }

// Walk to a post-processing station and run it: ctx stop for goIntoWorkshop
function postStop(key, title, ms, anim, opts = {}) {
      return {
        key, act: async ctx => {
          const m = ctx.model;
          const u = m ? m.userData : {};
          if (opts.consume) for (const [k, n] of Object.entries(opts.consume)) useWorkshopSupply(k, n, title);
          let part = null;
          const host = m && (m.userData.inner || m);
          if (host && opts.part) { part = wsPartOn(host, opts.part, opts.size || 0.14); host.add(part); }
          await machineStep(ctx, title, ms, (k, t) => anim && anim(u, k, t, part), opts.speech);
          if (part && part.parent) part.parent.remove(part);
          if (opts.after) opts.after(u);
          machineSkill(key, 3);
          return true;
        }
      };
    }

// The common post-processing anims
const POST_ANIMS = {
  wash: (u, k, t, part) => { if (u.basket) { u.basket.position.y = 0.2 + Math.abs(Math.sin(t * 2)) * 0.16 * (1 - k) + (k > 0.9 ? 0.16 : 0); u.basket.rotation.y = t * 3; } if (part) { part.position.y = u.basket ? u.basket.position.y + 0.04 : 0.3; part.rotation.y = t * 3; } },
  cure: (u, k, t, part) => { if (u.table) u.table.rotation.y = t * 1.5; if (part) part.rotation.y = t * 1.5; wsGlowSet(u.glow, k < 0.97 ? 0.8 + Math.sin(t * 20) * 0.1 : 0); },
  depowder: (u, k, t, part) => { if (u.nozzle) { u.nozzle.rotation.y = Math.sin(t * 4) * 0.8; u.nozzle.position.x = Math.sin(t * 2.3) * 0.15; } wsPuff(u, 0xeeeeee, t); },
  blast: (u, k, t, part) => { if (u.nozzle) { u.nozzle.rotation.y = Math.sin(t * 5) * 0.9; u.nozzle.position.x = Math.sin(t * 2.7) * 0.18; } if (part) part.rotation.y = t; wsPuff(u, 0xd6d3d1, t); },
  edm: (u, k, t, part) => { if (u.head) u.head.position.x = -0.18 + k * 0.36; if (u.spark) { u.spark.visible = Math.random() > 0.2; wsGlowSet(u.spark, Math.random()); } },
  bandsaw: (u, k, t) => { if (u.arm) u.arm.rotation.z = -0.25 * (1 - k); if (u.blade) u.blade.position.x = 0.4 + Math.sin(t * 40) * 0.01; },
  furnace: (u, k) => { wsGlowSet(u.inside, k < 0.85 ? Math.min(1, k * 2) : (1 - k) * 6); if (u.door) u.door.rotation.y = k < 0.05 || k > 0.95 ? -1.2 : 0; },
  waterjet: (u, k, t, part) => { if (u.nozzle) { u.nozzle.rotation.z = Math.sin(t * 6) * 0.6; u.nozzle.position.x = Math.sin(t * 2) * 0.15; } if (part) part.rotation.y = t * 0.8; wsPuff(u, 0x93c5fd, t); },
  unpack: (u, k, t) => { if (u.brush) { u.brush.position.x = Math.sin(t * 5) * 0.15; u.brush.rotation.z = Math.sin(t * 9) * 0.4; } wsPuff(u, 0xf5f5f4, t); }
};

// Little puffs of powder, grit or water inside a station (a few small spheres that rise and fade)
function wsPuff(u, color, t) {
      if (!u || !u.puffs) {
        if (!u) return;
        u.puffs = [];
      }
      const root = u.nozzle || u.brush;
      if (!root || !root.parent) return;
      // Real seconds since the last call (t is in seconds): same puffs per second at any frame rate
      const dt = u.puffLastT === undefined || t - u.puffLastT > 0.5 || t < u.puffLastT ? 1 / 60 : t - u.puffLastT;
      u.puffLastT = t;
      if (u.puffs.length < 10 && Math.random() < 1 - Math.pow(0.5, dt * 60)) {
        const p = mmSphere(root.parent, 0.02 + Math.random() * 0.02, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false }), root.position.x, root.position.y - 0.15, root.position.z);
        p.userData.born = t;
        u.puffs.push(p);
      }
      u.puffs = u.puffs.filter(p => {
        const age = t - p.userData.born;
        p.position.y += 0.24 * dt;
        p.position.x += (Math.random() - 0.5) * 0.01 * Math.sqrt(dt * 60);
        p.material.opacity = Math.max(0, 0.7 - age * 0.9);
        if (age > 0.8) { if (p.parent) p.parent.remove(p); p.material.dispose(); return false; }
        return true;
      });
    }

// The finished part (or failure) of a print. fail: chance of a classic failure while learning.
function printerFinish(key, name, fromLabel) {
      return () => {
        addMadeThing(name, fromLabel, { emoji: '🖨️' });
        machineSkill(key, 6);
        state.moodEmoji = '🎉';
        state.moodTitle = `Printed ${wsWhat(name)}`.slice(0, 80);
      };
    }

function printFailChance(key) {
      return Math.max(0.03, 0.22 - machineLevel(key) * 0.03);
    }

// --- The printers ------------------------------------------------------------------------------------
// Positions are local to the Workshop (x across, z toward the front doors), floor 1.
const DESK = { x: 2.35, z: 3.95 }; // the desktop printer bench (FDM, SLA, DLP, MSLA, wash and cure)

function deskSpot(i) {
      return { x: DESK.x - 1.25 + i * 0.5, z: DESK.z };
    }

registerWorkshopMachine({
  key: 'printbench', name: 'Desktop printer bench', kind: 'post', floor: 1, at: { x: DESK.x, z: DESK.z, ry: Math.PI }, size: { w: 3.0, h: 1.4, d: 0.8 }, color: 0x8a6a45, stand: { x: DESK.x, z: DESK.z - 0.85 },
  model: () => { const g = workBenchModel(3.0, 0.8); g.userData.machineKey = 'printbench'; return g; }
});

function deskPrinterDef(key, name, short, modelFn, i, extra) {
      const at = deskSpot(i);
      return registerWorkshopMachine({
        key, name, short, kind: 'printer', floor: 1, at: { x: at.x, z: at.z, ry: Math.PI }, size: { w: 0.45, h: 0.6, d: 0.45 }, color: 0xf26b1d,
        stand: { x: at.x, z: at.z - 0.85 }, model: () => { const m = modelFn(); m.position.y = 0.98; const g = new THREE.Group(); g.add(m); g.userData = { ...m.userData, inner: m }; return g; },
        ...extra
      });
    }

// FDM: his own printer's spools (js/printer.js), a Prusa-style machine on the bench
deskPrinterDef('fdm', 'Prusa FDM printer', 'FDM printer', fdmPrinterModel, 0, {
  emoji: '🧵', skill: 'FDM printing', learnAs: 'fdm',
  wiki: ['Fused filament fabrication'], learned: 'FDM melts plastic filament in a hot nozzle and lays it down one thin line at a time; the bed must be level and clean, and supports hold up overhangs.',
  needs: ['filament'], words: [/\bfdm\b|fff|prusa|filament printer/i],
  products: ['An FDM-printed PETG bracket', 'An FDM-printed cable clip set', 'An FDM-printed go-kart dash mount'],
  makes: [/bracket|clip|mount|enclosure|case|knob/],
  plan(job) {
    const name = madeName('FDM-printed', 'PETG', job.make, wsPick(this.products));
    const key = this.key;
    let fail = false;
    return {
      title: `Printing ${wsWhat(name)} on the FDM printer`, product: name,
      stops: [{
        key, act: async ctx => {
          const u = ctx.model.userData.inner.userData;
          await machineStep(ctx, 'Slicing the model and levelling the bed', 1800, null, 'Slice, level, heat up. PLA at 215, the bed at 60.');
          const fil = useWorkshopSupply('filament', 40, 'FDM print');
          if (!fil) return false;
          const part = wsPartOn(ctx.model.userData.inner, name, 0.14, { y: 0.012 });
          part.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set(fil.color || '#f97316'); } });
          u.bed.add(part);
          part.scale.y *= 0.01;
          const full = part.scale.x;
          fail = Math.random() < printFailChance(key);
          await machineStep(ctx, `Printing ${wsWhat(name)}`, 7000, (k, t) => {
            const kk = fail ? Math.min(k, 0.45) : k;
            u.head.position.x = Math.sin(t * 7) * u.travel.x;
            u.bed.position.z = Math.sin(t * 5.3) * u.travel.z;
            u.gantry.position.y = 0.12 + kk * 0.12;
            part.scale.y = Math.max(0.01, kk) * full;
            if (fail && k > 0.45) part.rotation.z = (k - 0.45) * 1.2;
          });
          if (fail) {
            ctx.say('The print came off the bed!', 'It lifted at the corner and knocked loose. Glue stick and a cleaner bed next time.');
            if (typeof printerState === 'function') printerState().lessons.adhesion = true;
            await ctx.wait(1800);
            u.bed.remove(part);
            return false;
          }
          await machineStep(ctx, 'Flexing it off the steel sheet', 1200);
          u.bed.remove(part);
          return true;
        }
      }],
      finish: printerFinish(key, name, 'FDM printer'),
      failed: () => { machineSkill(key, 3); state.speechBubble = 'The FDM print failed. I learned something about bed adhesion.'; }
    };
  }
});

// SLA / DLP / MSLA: resin in a vat, the platform peels each cured layer up out of it, then wash and cure
function resinPlan(def, job, prefix, products, label) {
      const key = def.key;
      const name = madeName(prefix, 'resin', job.make, wsPick(products));
      let ok = true;
      return {
        title: `Printing ${wsWhat(name)} on the ${label}`, product: name,
        speech: 'Gloves on first. Resin is nasty on skin.',
        stops: [
          {
            key, act: async ctx => {
              const u = ctx.model.userData.inner.userData;
              useWorkshopSupply('gloves', 1, 'Resin printing');
              await machineStep(ctx, 'Shaking the resin, filling the tank', 2000, () => {}, 'Nitrile gloves on. Shake the resin well, fill the tank to the line.');
              useWorkshopSupply('resin', 1, `${label} print`);
              const part = wsPartOn(ctx.model.userData.inner, name, 0.1, { y: -0.012 });
              part.rotation.x = Math.PI;
              u.platform.add(part);
              const full = part.scale.x;
              part.scale.y = 0.01;
              ok = Math.random() >= printFailChance(key);
              await machineStep(ctx, `Printing ${wsWhat(name)} layer by layer`, 8000, (k, t) => {
                const layers = 26, f = k * layers, lk = f - Math.floor(f);
                const reach = ok ? k : Math.min(k, 0.5);
                u.platform.position.y = 0.215 + reach * 0.16 + (lk < 0.5 ? lk * 0.03 : (1 - lk) * 0.03);
                wsGlowSet(u.uv, lk > 0.6 ? 1 : 0);
                part.scale.y = Math.max(0.01, reach) * full;
                if (!ok && k > 0.5) part.visible = false; // it stayed stuck to the film in the vat
              });
              wsGlowSet(u.uv, 0);
              if (!ok) {
                ctx.say('The print stuck to the tank film', 'It peeled off the platform and stayed in the vat. I\'ll filter the resin and check the platform level.');
                await ctx.wait(1500);
                u.platform.remove(part);
                return false;
              }
              u.platform.position.y = 0.42;
              await machineStep(ctx, 'Lifting the platform off and draining it', 1400);
              u.platform.remove(part);
              u.platform.position.y = 0.26;
              return true;
            }
          },
          postStop('wash', 'Washing the print in IPA', 4500, POST_ANIMS.wash, { part: name, size: 0.09, consume: { ipa: 1 }, speech: 'Ten minutes swishing in isopropyl alcohol to get the sticky resin off.' }),
          postStop('cure', 'UV curing it on the turntable', 4500, POST_ANIMS.cure, { part: name, size: 0.09, speech: 'Then UV light and a little heat, so it is fully hard.' }),
          {
            key, stand: null, act: async ctx => { await machineStep(ctx, 'Clipping off the supports', 1500, null, 'Snip the supports, sand the nubs. Done.'); return true; }
          }
        ],
        finish: printerFinish(key, name, label),
        failed: () => { machineSkill(key, 3); }
      };
    }

deskPrinterDef('sla', 'Formlabs Form 3 (SLA)', 'SLA printer', slaPrinterModel, 1, {
  emoji: '🧪', skill: 'SLA printing', teaches: ['wash', 'cure'],
  wiki: ['Stereolithography'], learned: 'SLA cures liquid photopolymer resin with a UV laser, one layer at a time on an upside-down platform. The prints must be washed in isopropyl alcohol and UV-cured, and resin needs gloves.',
  needs: ['resin', 'ipa', 'gloves'], words: [/\bsla\b|stereolith|form ?3|formlabs|resin printer/i],
  products: ['An SLA-printed resin miniature figure', 'An SLA-printed resin gear', 'An SLA-printed resin jewellery master'], makes: [/miniature|figure|jewel|master|lens/],
  plan(job) { return resinPlan(this, job, 'SLA-printed', this.products, 'SLA printer'); }
});

deskPrinterDef('dlp', 'Anycubic DLP printer', 'DLP printer', dlpPrinterModel, 2, {
  emoji: '🧪', skill: 'DLP printing', teaches: ['wash', 'cure'],
  wiki: ['Digital Light Processing'], learned: 'DLP projects a whole layer of UV light at once with a projector chip, so it is fast. Like SLA it needs resin, gloves, an IPA wash and a UV cure.',
  needs: ['resin', 'ipa', 'gloves'], words: [/\bdlp\b|digital light/i],
  products: ['A DLP-printed resin ring', 'A DLP-printed resin micro gear'], makes: [/ring|micro/],
  plan(job) { return resinPlan(this, job, 'DLP-printed', this.products, 'DLP printer'); }
});

deskPrinterDef('msla', 'Elegoo Saturn (MSLA/LCD)', 'MSLA printer', msslaPrinterModel, 3, {
  emoji: '🧪', skill: 'MSLA printing', teaches: ['wash', 'cure'],
  wiki: ['Stereolithography'], learned: 'MSLA (masked SLA) shines UV LEDs through an LCD screen that masks each layer\'s shape. Same resin rules: gloves, an IPA wash and a UV cure.',
  needs: ['resin', 'ipa', 'gloves'], words: [/\bmsla\b|\blcd printer|saturn|elegoo|masked/i],
  products: ['An MSLA-printed tabletop miniature', 'An MSLA-printed resin enclosure'], makes: [/tabletop|terrain/],
  plan(job) { return resinPlan(this, job, 'MSLA-printed', this.products, 'MSLA printer'); }
});

registerWorkshopMachine({
  key: 'wash', name: 'Form Wash (IPA)', short: 'wash station', kind: 'post', floor: 1, at: { x: deskSpot(4).x, z: DESK.z, ry: Math.PI }, size: { w: 0.35, h: 0.6, d: 0.35 },
  stand: { x: deskSpot(4).x, z: DESK.z - 0.85 }, learnAs: 'wash', skill: 'Washing resin prints',
  model: () => { const m = washStationModel(); m.position.y = 0.98; const g = new THREE.Group(); g.add(m); g.userData = { ...m.userData, inner: m }; return g; }
});
registerWorkshopMachine({
  key: 'cure', name: 'Form Cure (UV)', short: 'cure station', kind: 'post', floor: 1, at: { x: deskSpot(5).x, z: DESK.z, ry: Math.PI }, size: { w: 0.35, h: 0.5, d: 0.35 },
  stand: { x: deskSpot(5).x, z: DESK.z - 0.85 }, learnAs: 'cure', skill: 'UV curing',
  model: () => { const m = cureStationModel(); m.position.y = 0.98; const g = new THREE.Group(); g.add(m); g.userData = { ...m.userData, inner: m }; return g; }
});

// SLS: a nylon powder bed fused by a laser, cooled, then depowdered and bead blasted
registerWorkshopMachine({
  key: 'sls', name: 'EOS Formiga P 110 (SLS)', short: 'SLS printer', kind: 'printer', floor: 1, at: { x: -3.15, z: 1.95, ry: 0 }, size: { w: 1.3, h: 1.6, d: 0.9 }, color: 0xeef0f2,
  emoji: '🟫', skill: 'SLS printing', teaches: ['depowder', 'beadblast'], model: slsPrinterModel, stand: { x: -2.1, z: 2.95 },
  wiki: ['Selective laser sintering'], learned: 'SLS spreads thin layers of nylon PA12 powder and a laser sinters each slice; the loose powder holds the part up, so it needs no supports. Afterwards it cools, is dug out and depowdered, then bead blasted smooth. Fine powder means a respirator.',
  needs: ['pa12', 'respirator', 'blastMedia'], words: [/\bsls\b|selective laser sinter|formiga/i],
  products: ['An SLS-printed nylon hinge', 'An SLS-printed nylon drone arm', 'An SLS-printed nylon go-kart duct'], makes: [/hinge|duct|drone arm|clip/],
  plan(job) {
    const key = this.key, name = madeName('SLS-printed', 'nylon', job.make, wsPick(this.products));
    return {
      title: `Printing ${wsWhat(name)} on the SLS printer`, product: name, speech: 'Respirator on. Nylon powder is fine enough to breathe in.',
      stops: [
        {
          key, act: async ctx => {
            const u = ctx.model.userData;
            await machineStep(ctx, 'Loading PA12 powder (respirator on)', 2200, null, 'Fresh powder mixed with recycled, into the hopper.');
            useWorkshopSupply('pa12', 1, 'SLS build');
            mmSetTower(u.tower, 'run');
            await machineStep(ctx, 'Preheating the powder bed', 1600, k => wsGlowSet(u.window, k * 0.5));
            await machineStep(ctx, `Sintering ${wsWhat(name)} layer by layer`, 8000, (k, t) => powderBedFrame(u, k, t));
            await machineStep(ctx, 'Letting the build cake cool down slowly', 2200, k => wsGlowSet(u.window, 0.5 * (1 - k)));
            wsMachineIdle(u);
            return true;
          }
        },
        postStop('depowder', 'Digging out and depowdering the part', 3500, POST_ANIMS.depowder, { part: name, size: 0.14 }),
        postStop('beadblast', 'Bead blasting it smooth', 3500, POST_ANIMS.blast, { part: name, size: 0.14, consume: { blastMedia: 1 } })
      ],
      finish: printerFinish(key, name, 'SLS printer')
    };
  }
});

registerWorkshopMachine({
  key: 'depowder', name: 'Depowdering station', short: 'depowder station', kind: 'post', floor: 1, at: { x: 3.45, z: -6.75, ry: 0 }, size: { w: 0.9, h: 1.3, d: 0.6 },
  learnAs: 'depowder', skill: 'Depowdering', model: depowderStationModel
});
registerWorkshopMachine({
  key: 'beadblast', name: 'Bead blast cabinet', short: 'bead blaster', kind: 'post', floor: 1, at: { x: 2.0, z: -6.75, ry: 0 }, size: { w: 0.9, h: 1.4, d: 0.6 },
  learnAs: 'beadblast', skill: 'Bead blasting', model: beadBlastModel
});

// DMLS/SLM: metal powder under argon, a fibre laser; then off the plate by wire EDM (or the bandsaw) and heat treated
registerWorkshopMachine({
  key: 'dmls', name: 'EOS M 290 (DMLS/SLM)', short: 'DMLS printer', kind: 'printer', floor: 1, at: { x: -2.65, z: 4.35, ry: 0 }, size: { w: 2.3, h: 1.8, d: 1.0 }, color: 0xd2d5d9,
  emoji: '🔩', skill: 'Metal 3D printing (DMLS)', teaches: ['edm', 'bandsaw', 'furnace'], model: dmlsPrinterModel,
  stand: { x: -2.75, z: 4.8 },
  wiki: ['Selective laser melting', 'Electrical discharge machining'], learned: 'DMLS/SLM melts metal powder with a fibre laser in a chamber flooded with argon so it can\'t oxidise. The part is welded to a steel build plate: it comes off by wire EDM or bandsaw, then gets a stress-relief heat treatment. Metal powder needs a respirator and gloves.',
  needs: ['steelPowder', 'argonHP', 'respirator', 'gloves', 'edmWire'], words: [/\bdmls\b|\bslm\b|metal (3d )?print|laser melt|m ?290/i],
  products: ['A DMLS-printed stainless steel bracket', 'A DMLS-printed stainless rocket nozzle', 'A DMLS-printed stainless manifold'], makes: [/nozzle|manifold|metal bracket/],
  plan(job) {
    const key = this.key, name = madeName('DMLS-printed', 'stainless', job.make, wsPick(this.products));
    return {
      title: `Printing ${wsWhat(name)} in steel`, product: name, speech: 'Metal powder. Respirator and gloves on, and the chamber gets filled with argon first.',
      stops: [
        {
          key, act: async ctx => {
            const u = ctx.model.userData;
            useWorkshopSupply('gloves', 1, 'Metal powder');
            await machineStep(ctx, 'Loading 316L powder (respirator on)', 2200, null, 'The powder goes in through the glove ports.');
            useWorkshopSupply('steelPowder', 1, 'DMLS build');
            useWorkshopSupply('argonHP', 1, 'Argon purge');
            mmSetTower(u.tower, 'wait');
            await machineStep(ctx, 'Purging the chamber with argon', 3000, (k, t) => { if (u.gauge) u.gauge.rotation.z = -k * 2.4; }, 'Oxygen falling... under 0.1 percent. Good.');
            mmSetTower(u.tower, 'run');
            await machineStep(ctx, `Laser-melting ${wsWhat(name)}`, 9000, (k, t) => powderBedFrame(u, k, t, { layers: 30, glow: 0.8 }));
            wsMachineIdle(u);
            return true;
          }
        },
        postStop('edm', 'Wire EDM cutting it off the build plate', 4000, POST_ANIMS.edm, { part: name, size: 0.16, consume: { edmWire: 1 }, speech: 'A brass wire and a lot of tiny sparks, under water.' }),
        postStop('furnace', 'Stress-relief heat treatment', 4000, POST_ANIMS.furnace, { part: name, size: 0.16, speech: 'Two hours at 650 degrees takes the stress out of the metal.' })
      ],
      finish: printerFinish(key, name, 'DMLS printer')
    };
  }
});

registerWorkshopMachine({
  key: 'edm', name: 'Sodick wire EDM', short: 'wire EDM', kind: 'post', floor: 1, at: { x: -3.0, z: -6.75, ry: 0 }, size: { w: 1.0, h: 1.8, d: 0.85 },
  learnAs: 'edm', skill: 'Wire EDM', model: wireEdmModel
});
registerWorkshopMachine({
  key: 'bandsaw', name: 'Horizontal bandsaw', short: 'bandsaw', kind: 'post', floor: 1, at: { x: -1.5, z: -6.95, ry: 0 }, size: { w: 0.9, h: 1.0, d: 0.45 },
  learnAs: 'bandsaw', skill: 'Bandsaw cutting', model: bandsawModel
});
registerWorkshopMachine({
  key: 'furnace', name: 'Sintering / heat-treat furnace', short: 'furnace', kind: 'post', floor: 1, at: { x: -1.45, z: 6.7, ry: Math.PI }, size: { w: 0.95, h: 1.3, d: 0.85 }, stand: { x: -1.45, z: 5.7 },
  learnAs: 'furnace', skill: 'Heat treating and sintering', model: () => furnaceModel()
});

// MJF: PA12 with fusing and detailing agents, infrared fusing; it cools in the build unit, then unpacking
registerWorkshopMachine({
  key: 'mjf', name: 'HP Jet Fusion 5200 (MJF)', short: 'MJF printer', kind: 'printer', floor: 1, at: { x: -3.0, z: 6.7, ry: Math.PI }, size: { w: 1.5, h: 1.5, d: 0.8 }, color: 0xeef0f2,
  emoji: '🟫', skill: 'MJF printing', teaches: ['mjfstation', 'beadblast'], model: mjfPrinterModel, stand: { x: -3.0, z: 4.8 },
  wiki: ['Multi Jet Fusion'], learned: 'Multi Jet Fusion spreads PA12 powder, jets a fusing agent where the part goes and a detailing agent round its edges, then an infrared lamp fuses the layer. The build unit cools for hours before unpacking at the processing station, then bead blasting.',
  needs: ['pa12', 'fusingAgent', 'detailingAgent', 'respirator', 'blastMedia'], words: [/\bmjf\b|multi ?jet fusion|jet fusion|\bhp\b.*print/i],
  products: ['An MJF-printed nylon go-kart pedal', 'An MJF-printed nylon gear set', 'An MJF-printed nylon lattice insole'], makes: [/pedal|gear set|insole|kart/],
  plan(job) {
    const key = this.key, name = madeName('MJF-printed', 'nylon', job.make, wsPick(this.products));
    return {
      title: `Printing ${wsWhat(name)} on the MJF printer`, product: name,
      stops: [
        {
          key, act: async ctx => {
            const u = ctx.model.userData;
            await machineStep(ctx, 'Loading powder, checking the agents', 2000);
            useWorkshopSupply('pa12', 1, 'MJF build');
            useWorkshopSupply('fusingAgent', 1, 'MJF build');
            useWorkshopSupply('detailingAgent', 1, 'MJF build');
            mmSetTower(u.tower, 'run');
            await machineStep(ctx, `Fusing ${wsWhat(name)}`, 8000, (k, t) => {
              const sweep = Math.sin(t * 2.2);
              u.recoater.position.x = sweep * 0.24;
              u.dot.position.x = -sweep * 0.24;
              wsGlowSet(u.dot, 0.9);
              wsGlowSet(u.window, 0.55 + Math.abs(sweep) * 0.3);
              u.bed.position.y = -k * 0.03;
            });
            wsMachineIdle(u);
            u.unit.visible = true;
            await machineStep(ctx, 'Rolling the build unit out to cool', 2500, k => { u.unit.position.z = 0.75 + k * 0.35; }, 'It has to cool slowly or the parts warp.');
            u.unit.visible = false;
            u.unit.position.z = 0.75;
            return true;
          }
        },
        postStop('mjfstation', 'Unpacking and sieving at the processing station', 3500, POST_ANIMS.unpack, {}),
        postStop('beadblast', 'Bead blasting it clean', 3000, POST_ANIMS.blast, { part: name, size: 0.14, consume: { blastMedia: 1 } })
      ],
      finish: printerFinish(key, name, 'MJF printer')
    };
  }
});
registerWorkshopMachine({
  key: 'mjfstation', name: 'HP processing station', short: 'MJF processing station', kind: 'post', floor: 1, at: { x: -0.95, z: 1.95, ry: 0 }, size: { w: 1.0, h: 1.6, d: 0.75 },
  learnAs: 'mjfstation', skill: 'MJF unpacking', model: mjfStationModel
});

// PolyJet: jetted photopolymer droplets cured by UV, with gel support that a waterjet washes off
registerWorkshopMachine({
  key: 'polyjet', name: 'Stratasys J850 (PolyJet)', short: 'PolyJet printer', kind: 'printer', floor: 1, at: { x: 3.2, z: 2.3, ry: 0 }, size: { w: 1.35, h: 1.4, d: 0.9 }, color: 0xeef0f2,
  emoji: '🌈', skill: 'PolyJet printing', teaches: ['waterjet'], model: polyjetPrinterModel, stand: { x: 3.2, z: 3.15 },
  wiki: ['Material jetting'], learned: 'PolyJet material jetting sprays tiny drops of photopolymer like an inkjet and cures each layer with UV lamps, in many colours at once. Gel support fills the gaps and is blasted off with a waterjet afterwards.',
  needs: ['polyjetCart', 'supportCart', 'gloves'], words: [/polyjet|material jetting|stratasys|j850/i],
  products: ['A PolyJet-printed multi-colour prototype', 'A PolyJet-printed clear enclosure'], makes: [/prototype|clear/],
  plan(job) {
    const key = this.key, name = madeName('PolyJet-printed', 'photopolymer', job.make, wsPick(this.products));
    return {
      title: `Printing ${wsWhat(name)} on the PolyJet printer`, product: name,
      stops: [
        {
          key, act: async ctx => {
            const u = ctx.model.userData;
            useWorkshopSupply('gloves', 1, 'PolyJet');
            useWorkshopSupply('polyjetCart', 1, 'PolyJet build');
            useWorkshopSupply('supportCart', 1, 'PolyJet support');
            const part = wsPartOn(ctx.model, name, 0.22, { y: 0.012 });
            u.tray.add(part);
            const full = part.scale.x;
            part.scale.y = 0.01;
            mmSetTower(u.tower, 'run');
            await machineStep(ctx, `Jetting ${wsWhat(name)}`, 8000, (k, t) => {
              u.block.position.x = Math.sin(t * 2.6) * 0.38;
              wsGlowSet(u.lamp, 0.7 + Math.random() * 0.3);
              u.tray.position.y = 1.06 - k * 0.02;
              part.scale.y = Math.max(0.01, k) * full;
            });
            wsGlowSet(u.lamp, 0);
            mmSetTower(u.tower, 'idle');
            u.tray.remove(part);
            return true;
          }
        },
        postStop('waterjet', 'Waterjetting the gel support away', 4000, POST_ANIMS.waterjet, { part: name, size: 0.16 })
      ],
      finish: printerFinish(key, name, 'PolyJet printer')
    };
  }
});
registerWorkshopMachine({
  key: 'waterjet', name: 'Support-removal waterjet', short: 'waterjet', kind: 'post', floor: 1, at: { x: 3.35, z: 5.45, ry: Math.PI }, size: { w: 0.8, h: 1.4, d: 0.6 }, stand: { x: 3.35, z: 4.75 },
  learnAs: 'waterjet', skill: 'Support removal', model: waterjetBoothModel
});

// Binder jetting: powder glued by a jetted binder, cured, depowdered as a fragile "green" part, sintered
registerWorkshopMachine({
  key: 'binder', name: 'ExOne InnoventX (binder jetting)', short: 'binder jet printer', kind: 'printer', floor: 1, at: { x: 1.9, z: 5.45, ry: Math.PI }, size: { w: 1.1, h: 1.5, d: 0.85 }, color: 0xb8bec6,
  emoji: '⚙️', skill: 'Binder jetting', teaches: ['furnace', 'depowder'], model: binderJetModel, stand: { x: 1.9, z: 4.75 },
  wiki: ['Binder jetting', 'Sintering'], learned: 'Binder jetting glues metal powder layer by layer with a liquid binder from an inkjet head, no laser. The "green" part is cured, gently depowdered, then sintered in a furnace near melting point, where it shrinks about a fifth into solid metal.',
  needs: ['bjPowder', 'binder', 'respirator'], words: [/binder.?jet|exone|innovent/i],
  products: ['A binder-jetted stainless impeller', 'A binder-jetted stainless gear'], makes: [/impeller|gear/],
  plan(job) {
    const key = this.key, name = madeName('binder-jetted', 'stainless', job.make, wsPick(this.products));
    return {
      title: `Binder jetting ${wsWhat(name)}`, product: name,
      stops: [
        {
          key, act: async ctx => {
            const u = ctx.model.userData;
            useWorkshopSupply('bjPowder', 1, 'Binder jet build');
            useWorkshopSupply('binder', 1, 'Binder jet build');
            mmSetTower(u.tower, 'run');
            await machineStep(ctx, `Binder jetting ${wsWhat(name)}`, 7000, (k, t) => powderBedFrame(u, k, t, { noBeam: true, glow: 0.25 }));
            await machineStep(ctx, 'Curing the bed (green part)', 2200, k => wsGlowSet(u.window, 0.6 * Math.sin(k * Math.PI)));
            wsMachineIdle(u);
            return true;
          }
        },
        postStop('depowder', 'Carefully depowdering the fragile green part', 3000, POST_ANIMS.depowder, { part: name, size: 0.16 }),
        postStop('furnace', 'Sintering it in the furnace (it shrinks about 20%)', 5000, POST_ANIMS.furnace, { part: name, size: 0.13 })
      ],
      finish: printerFinish(key, name, 'binder jet printer')
    };
  }
});

// DED: a robot arm with a wire-fed deposition head lays down weld beads under argon; then machined on the Haas
registerWorkshopMachine({
  key: 'ded', name: 'DED robot cell', short: 'DED cell', kind: 'printer', floor: 1, at: { x: 2.6, z: 0.15, ry: 0 }, size: { w: 1.95, h: 1.7, d: 1.95 }, color: 0xf4b400,
  emoji: '🤖', skill: 'Directed energy deposition', model: dedCellModel, stand: { x: 1.0, z: 0.3 },
  wiki: ['Directed energy deposition'], learned: 'Directed energy deposition feeds metal wire (or powder) into a melt pool made by an arc or laser on a robot arm, under shielding gas, building big near-net shapes bead by bead. The rough part is then machined to size.',
  needs: ['dedWire', 'shieldGas', 'weldHelmet', 'gloves', 'endMills', 'coolant'], words: [/\bded\b|directed energy|robot arm|wire arc|waam/i],
  products: ['A DED-built stainless turbine blade', 'A DED-built stainless flange'], makes: [/turbine|flange|blade/],
  plan(job) {
    const key = this.key, name = madeName('DED-built', 'stainless', job.make, wsPick(this.products));
    return {
      title: `Building ${wsWhat(name)} with the DED robot`, product: name, speech: 'Helmet down. That arc is bright.',
      stops: [
        {
          key, act: async ctx => {
            const u = ctx.model.userData;
            useWorkshopSupply('gloves', 1, 'DED');
            useWorkshopSupply('dedWire', 1, 'DED build');
            useWorkshopSupply('shieldGas', 1, 'DED shielding gas');
            const part = new THREE.Group();
            mmCyl(part, 0.16, 1, 'steel', 0, 0.5, 0);
            part.position.set(u.plate.x, u.plate.y, u.plate.z);
            part.scale.y = 0.01;
            ctx.model.add(part);
            mmSetTower(u.tower, 'run');
            await machineStep(ctx, `Depositing ${wsWhat(name)} bead by bead`, 9000, (k, t) => {
              const a = t * 2.4;
              u.turret.rotation.y = -0.9 + Math.sin(a) * 0.18;
              u.shoulder.rotation.z = -0.55 + Math.cos(a) * 0.06 - k * 0.15;
              u.elbow.rotation.z = -0.35 - Math.sin(a) * 0.08 + k * 0.1;
              u.wrist.rotation.z = 0.9;
              u.table.rotation.y = t * 1.2;
              part.rotation.y = t * 1.2;
              part.scale.y = Math.max(0.01, k) * 0.35;
              u.tip.visible = Math.random() > 0.1;
              wsGlowSet(u.tip, 0.7 + Math.random() * 0.3);
            });
            wsGlowSet(u.tip, 0);
            mmSetTower(u.tower, 'idle');
            ctx.model.remove(part);
            return true;
          }
        },
        {
          key: 'haasvs1', act: async ctx => {
            const u = ctx.model.userData;
            useWorkshopSupply('coolant', 1, 'Machining the DED part');
            useWorkshopSupply('endMills', 1, 'Machining the DED part');
            await haasCycle(ctx, u, `Machining the DED part to size`, 5000, name);
            machineSkill('haasvs1', 3);
            return true;
          }
        }
      ],
      finish: printerFinish(key, name, 'DED cell')
    };
  }
});

// EBM: titanium powder melted by an electron beam in a vacuum, the bed preheated; powder recovered afterwards
registerWorkshopMachine({
  key: 'ebm', name: 'Arcam Q10 (EBM)', short: 'EBM printer', kind: 'printer', floor: 1, at: { x: 1.6, z: 2.3, ry: 0 }, size: { w: 1.6, h: 2.4, d: 0.95 }, color: 0x22272e,
  emoji: '⚡', skill: 'Electron beam melting', teaches: ['depowder'], model: ebmPrinterModel, stand: { x: 1.4, z: 3.25 },
  wiki: ['Electron-beam additive manufacturing'], learned: 'EBM melts titanium powder with an electron beam, so the chamber must be pumped down to a vacuum, and the whole bed is preheated to about 700 degrees. Afterwards the sintered powder cake is blasted off in the powder recovery system and reused.',
  needs: ['tiPowder', 'respirator', 'gloves'], words: [/\bebm\b|electron beam|arcam/i],
  products: ['An EBM-printed titanium lattice bracket', 'An EBM-printed titanium implant cup'], makes: [/titanium|implant|lattice/],
  plan(job) {
    const key = this.key, name = madeName('EBM-printed', 'titanium', job.make, wsPick(this.products));
    return {
      title: `Printing ${wsWhat(name)} in titanium`, product: name,
      stops: [
        {
          key, act: async ctx => {
            const u = ctx.model.userData;
            useWorkshopSupply('gloves', 1, 'Titanium powder');
            useWorkshopSupply('tiPowder', 1, 'EBM build');
            mmSetTower(u.tower, 'wait');
            await machineStep(ctx, 'Pumping the chamber down to a vacuum', 3000, k => { if (u.vac) u.vac.rotation.z = -k * 2.6; }, 'An electron beam only works in a vacuum.');
            await machineStep(ctx, 'Preheating the powder bed', 2000, k => wsGlowSet(u.window, k * 0.8));
            mmSetTower(u.tower, 'run');
            await machineStep(ctx, `EBM melting ${wsWhat(name)}`, 8000, (k, t) => powderBedFrame(u, k, t, { layers: 36, glow: 0.95 }));
            await machineStep(ctx, 'Cooling down under helium', 1800, k => wsGlowSet(u.window, 0.9 * (1 - k)));
            wsMachineIdle(u);
            return true;
          }
        },
        postStop('depowder', 'Blasting the powder cake off and recovering the powder', 3500, POST_ANIMS.depowder, { part: name, size: 0.15 })
      ],
      finish: printerFinish(key, name, 'EBM printer')
    };
  }
});

// LOM: sheets of paper glued and cut with a knife, one by one; the waste is cut into cubes and broken away
registerWorkshopMachine({
  key: 'lom', name: 'Mcor LOM printer', short: 'LOM printer', kind: 'printer', floor: 1, at: { x: -0.9, z: 4.35, ry: 0 }, size: { w: 0.9, h: 1.4, d: 0.65 }, color: 0xeef0f2,
  emoji: '📄', skill: 'LOM printing', stand: { x: -0.9, z: 4.8 },
  model: () => { const g = new THREE.Group(); mmBox(g, 0.9, 0.85, 0.65, 'dark', 0, 0, 0); const m = lomPrinterModel(); m.position.y = 0.85; g.add(m); g.userData = { ...m.userData, inner: m }; return g; },
  wiki: ['Laminated object manufacturing'], learned: 'Laminated object manufacturing glues sheet after sheet of paper (or laminate) and cuts each outline with a knife or laser. The waste around the part is cross-hatched into cubes that are broken away afterwards: decubing.',
  needs: ['lomPaper', 'lomGlue', 'lomBlade'], words: [/\blom\b|laminated object|mcor|paper printer/i],
  products: ['A LOM-built paper architectural model', 'A LOM-built laminated mold pattern'], makes: [/architectural|pattern|paper/],
  plan(job) {
    const key = this.key, name = madeName('LOM-built', 'paper', job.make, wsPick(this.products));
    return {
      title: `Laminating ${wsWhat(name)}`, product: name,
      stops: [
        {
          key, act: async ctx => {
            const u = ctx.model.userData.inner.userData;
            useWorkshopSupply('lomPaper', 1, 'LOM build');
            useWorkshopSupply('lomGlue', 1, 'LOM build');
            useWorkshopSupply('lomBlade', 1, 'LOM build');
            const block = mmBox(u.stack, 0.3, 1, 0.22, 'paper', 0, 0, 0);
            block.scale.y = 0.001;
            await machineStep(ctx, `Gluing and cutting sheet after sheet`, 8000, (k, t) => {
              const f = k * 20, lk = f - Math.floor(f);
              u.roll.rotation.x = t * 2;
              u.sheet.visible = lk < 0.3;
              u.gantry.position.x = Math.sin(lk * Math.PI * 2) * 0.12;
              u.knife.position.z = Math.cos(lk * Math.PI * 2) * 0.1;
              block.scale.y = Math.max(0.001, k * 0.14);
              u.sheet.position.y = 0.33 + k * 0.14;
            });
            u.stack.remove(block);
            u.sheet.position.y = 0.33;
            u.sheet.visible = true;
            return true;
          }
        },
        { key: 'printbench', stand: { x: DESK.x, z: DESK.z - 0.85 }, act: async ctx => { await machineStep(ctx, 'Decubing: breaking away the waste cubes', 3000, null, 'Snap, snap... the part is in here somewhere.'); return true; } }
      ],
      finish: printerFinish(key, name, 'LOM printer')
    };
  }
});

// --- His own 3D printer (js/printer.js) lives in the Workshop ----------------------------------------
// Once the Workshop is there, the printer he was given stands on its own bench in the bench bay by the
// desktop printers (not by the outdoor Welding Studio), and he walks in through the door to use it.
const PRINTER_BAY = { x: WORKSHOP_STATIONS.bench.local.x, z: WORKSHOP_STATIONS.bench.local.z, standZ: WORKSHOP_STATIONS.bench.local.z - 1.3 };
if (typeof PRINTER_SPOT !== 'undefined' && typeof PRINTER_STAND !== 'undefined') {
  const spot = workshopToWorld(PRINTER_BAY.x, PRINTER_BAY.z, 1), stand = workshopToWorld(PRINTER_BAY.x, PRINTER_BAY.standZ, 1);
  PRINTER_SPOT.x = spot.x; PRINTER_SPOT.z = spot.z;
  PRINTER_STAND.x = stand.x; PRINTER_STAND.z = stand.z;
}

if (typeof buildPrinterStation3D === 'function') {
  const basePrinterStation = buildPrinterStation3D;
  buildPrinterStation3D = function () {
    basePrinterStation();
    // Standing on the Workshop floor, facing the aisle he works from
    if (printerGroup && !printerGroup.userData.inWorkshop) {
      printerGroup.userData.inWorkshop = true;
      printerGroup.position.y = WORKSHOP_PAD_Y + WS_F1;
      printerGroup.rotation.y = Math.PI;
    }
  };
}

// Run one of printer.js's own errands (setting it up, a print) inside the Workshop
function printerErrandInWorkshop(base, args, after) {
      if (typeof goIntoWorkshop !== 'function' || workshopTrip.active || typeof wsGroup === 'undefined' || !wsGroup) return base(...args);
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return Promise.resolve(false);
      let result = false;
      return goIntoWorkshop({
        stops: [{
          stand: { x: PRINTER_BAY.x, z: PRINTER_BAY.standZ },
          act: async ctx => {
            ctx.face(PRINTER_BAY.x, PRINTER_BAY.z);
            const run = base(...args);
            if (after) after('start');
            result = await run;
            if (after) after('end', result);
            return result !== false;
          }
        }]
      }).then(() => result);
    }

if (typeof setUpPrinter === 'function') {
  const baseSetUpPrinter = setUpPrinter;
  setUpPrinter = function (originLabel) {
    return printerErrandInWorkshop(baseSetUpPrinter, [originLabel], (phase) => {
      if (phase === 'start') {
        state.customPlaceName = 'the printer bench in his Workshop';
        state.speechBubble = 'A 3D printer! It goes on its own bench in my Workshop, right by the other printers.';
      } else {
        const d = state.diaryEntries[0];
        if (d && /Welding Studio/.test(d.text || '')) {
          d.text = d.text.replace('on its own bench beside the Welding Studio', 'on its own bench in my Workshop, next to the other printers');
          d.location = "his Workshop";
        }
      }
    });
  };
}

if (typeof printSomething === 'function') {
  const basePrintSomething = printSomething;
  printSomething = function (idea, originLabel) {
    return printerErrandInWorkshop(basePrintSomething, [idea, originLabel], (phase) => {
      if (phase === 'start') state.customPlaceName = 'his 3D printer in the Workshop';
    });
  };
}

if (typeof printerSummaryForAI === 'function') {
  const basePrinterSummary = printerSummaryForAI;
  printerSummaryForAI = function () {
    return basePrinterSummary().replace('set up by the Welding Studio', 'set up in your Workshop');
  };
}
