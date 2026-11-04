// Kelo-bot-1 — js/garage.js
// Loaded after electronics.js. Floor 2 of his Workshop, the car garage: a two-post lift and a
// four-post lift, a tire changer, a wheel balancer, a brake lathe, an engine hoist, a hydraulic shop
// press, a MIG/TIG welder, a big air compressor with hard lines to the air tools (impact wrench, air
// jack, sandblaster), a CNC plasma table and a parts washer.
// He drives his own vehicles in through door 1, up the car elevator and onto the lift, and
// services them: tires, oil changes, brakes, engine pulls and weld repairs. Vehicles wear as he
// drives them (wearVehicle, called from js/vehicles.js; fuel stays js/knowhow.js's business), and a
// service puts that part back to new.

const GARAGE_PARTS = {
  tires: { label: 'tires', perUnit: 0.05 },
  brakes: { label: 'brakes', perUnit: 0.04 },
  oil: { label: 'engine oil', perUnit: 0.09 },
  engine: { label: 'engine', perUnit: 0.015 },
  body: { label: 'body and frame', perUnit: 0.01 }
};

function g2(def) {
      return registerWorkshopMachine({ floor: 2, kind: 'garage', learnAs: 'garage', ...def });
    }

const LIFT2 = { x: 5.85, z: -2.6 };      // the two-post lift, behind the car elevator (the truck backs on)
const LIFT2_CAR = { x: 5.85, z: -2.0 };  // where the vehicle sits on it (nose south, toward the elevator)
g2({ key: 'lift2', name: 'Two-post lift', short: 'two-post lift', at: { x: LIFT2.x, z: LIFT2.z, ry: 0 }, size: { w: 4.3, h: 3.6, d: 0.6 }, skill: 'Using a two-post lift', model: () => twoPostLiftModel(3.8, 1.6), stand: { x: 3.9, z: -1.2 } });
g2({ key: 'lift4', name: 'Four-post lift', short: 'four-post lift', at: { x: -2.0, z: 2.0, ry: 0 }, size: { w: 3.8, h: 2.9, d: 7.0 }, skill: 'Using a four-post lift', model: () => fourPostLiftModel(6.2, 2.0), stand: { x: -0.1, z: 5.9 } });
g2({ key: 'tirechanger', name: 'Tire changer', short: 'tire changer', at: { x: 0.9, z: 4.55, ry: Math.PI }, size: { w: 1.0, h: 1.8, d: 0.8 }, skill: 'Changing tires', model: tireChangerModel, stand: { x: 0.9, z: 3.6 } });
g2({ key: 'balancer', name: 'Wheel balancer', short: 'wheel balancer', at: { x: 2.55, z: 4.6, ry: Math.PI }, size: { w: 1.2, h: 1.4, d: 0.6 }, skill: 'Balancing wheels', model: wheelBalancerModel, stand: { x: 2.55, z: 3.65 } });
g2({ key: 'brakelathe', name: 'Brake lathe', short: 'brake lathe', at: { x: 3.5, z: 2.6, ry: -Math.PI / 2 }, size: { w: 1.0, h: 1.3, d: 0.5 }, skill: 'Turning brake rotors', model: brakeLatheModel, stand: { x: 2.7, z: 2.6 } });
g2({ key: 'hoist', name: 'Engine hoist (cherry picker)', short: 'engine hoist', at: { x: 5.85, z: 4.6, ry: Math.PI }, size: { w: 0.8, h: 1.8, d: 1.6 }, skill: 'Pulling engines', model: engineHoistModel, stand: { x: 3.7, z: 3.2 } });
g2({ key: 'press', name: 'Hydraulic shop press (20 t)', short: 'shop press', at: { x: 0.75, z: 2.6, ry: Math.PI / 2 }, size: { w: 0.9, h: 1.9, d: 0.4 }, skill: 'Pressing bearings', model: shopPressModel, stand: { x: 1.45, z: 2.6 } });
g2({ key: 'partswasher', name: 'Parts washer', short: 'parts washer', at: { x: 2.1, z: 1.0, ry: Math.PI }, size: { w: 0.85, h: 1.2, d: 0.6 }, skill: 'Cleaning parts', model: partsWasherModel, stand: { x: 2.1, z: 0.1 } });
g2({ key: 'migtig', name: 'MIG/TIG welder', short: 'MIG/TIG welder', at: { x: 3.55, z: 0.9, ry: Math.PI }, size: { w: 0.5, h: 1.2, d: 0.8 }, skill: 'MIG and TIG welding', model: migTigModel, stand: { x: 3.7, z: -0.4 } });
g2({ key: 'compressor', name: '80-gallon air compressor', short: 'air compressor', at: { x: 1.7, z: 6.75, ry: Math.PI }, size: { w: 1.7, h: 1.3, d: 0.8 }, skill: 'Running the air system', model: compressorModel, stand: { x: 1.7, z: 5.85 } });
g2({ key: 'airtools', name: 'Air tools: impact wrench, air jack, sandblaster', short: 'air tools', at: { x: 0.35, z: 6.8, ry: Math.PI }, size: { w: 0.9, h: 1.5, d: 0.6 }, skill: 'Using air tools', model: airToolsModel, stand: { x: 0.35, z: 5.9 } });

// The garage itself: what the AI or a visitor asks for ("change the truck's oil")
const GARAGE_SERVICES = {
  tires: { title: 'a tire change', words: /tire|tyre|wheel/i, needs: ['tires', 'wheelWeights', 'airToolOil', 'safetyGlasses', 'gloves'] },
  oil: { title: 'an oil change', words: /oil/i, needs: ['engineOil', 'oilFilter', 'gloves'] },
  brakes: { title: 'a brake job', words: /brake/i, needs: ['brakePads', 'brakeCleaner', 'airToolOil', 'gloves', 'safetyGlasses'] },
  engine: { title: 'an engine pull and rebuild', words: /engine|motor|rebuild|pull/i, needs: ['gasketSet', 'solvent', 'engineOil', 'gloves', 'safetyGlasses'] },
  body: { title: 'a weld repair on the frame', words: /weld|frame|body|crack/i, needs: ['migWire', 'shieldGas', 'weldHelmet', 'gloves'] }
};

function garageVehicles() {
      return (state.vehicles || []).filter(v => ['truck', 'excavator', 'bike', 'snowmobile'].includes(v.kind) || /truck|car|jeep|van|kart/i.test(v.name));
    }

// --- Wear and condition ------------------------------------------------------------------------------
function vehicleService(v) {
      if (!v.service || typeof v.service !== 'object') v.service = {};
      Object.keys(GARAGE_PARTS).forEach(k => { if (!Number.isFinite(v.service[k])) v.service[k] = 0; });
      return v.service;
    }

function vehicleCondition(v) {
      const s = vehicleService(v);
      const worst = Math.max(...Object.values(s));
      return Math.max(0, Math.round(100 - worst));
    }

// Called after every drive (js/vehicles.js): distance in world units
function wearVehicle(v, dist) {
      if (!v || !Number.isFinite(dist) || dist <= 0) return;
      const s = vehicleService(v);
      const rough = v.load ? 1.4 : 1;
      Object.entries(GARAGE_PARTS).forEach(([k, p]) => { s[k] = Math.min(100, Math.round((s[k] + dist * p.perUnit * rough * (0.8 + Math.random() * 0.4)) * 10) / 10); });
      v.wear = Math.round(100 - vehicleCondition(v));
      // Worn parts make themselves known
      const worst = Object.entries(s).sort((a, b) => b[1] - a[1])[0];
      if (worst && worst[1] > 70 && Math.random() < 0.3) {
        const say = { tires: 'The tires are getting bald.', brakes: 'The brakes are starting to squeal.', oil: 'The oil is overdue for a change.', engine: 'The engine sounds rough.', body: 'There\'s a crack starting in the frame.' }[worst[0]];
        state.speechBubble = `${say} I should take the ${plainItem(v.name).toLowerCase()} into the garage.`;
      }
    }

// The most worn vehicle part that's due a service, if any: { key: 'garage', job, why }
function garageServiceDue() {
      let best = null;
      garageVehicles().forEach(v => {
        const s = vehicleService(v);
        Object.entries(s).forEach(([part, wear]) => {
          if (wear >= 60 && (!best || wear > best.wear)) best = { v, part, wear };
        });
      });
      if (!best) return null;
      return { key: 'garage', job: { vehicle: best.v, service: best.part }, why: `My ${plainItem(best.v.name).toLowerCase()} needs ${GARAGE_SERVICES[best.part].title} (${Math.round(best.wear)}% worn).` };
    }

function garageConditionHtml() {
      const vs = garageVehicles();
      if (!vs.length) return '';
      return `<div class="text-[10px] uppercase tracking-wide text-slate-500 mt-1">Vehicle condition</div>` + vs.map(v => {
        const s = vehicleService(v), c = vehicleCondition(v);
        return `<div class="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-200">
          <div class="flex items-center gap-2"><span class="flex-1">🚗 ${escapeHtml(v.name)}</span><span class="${c > 60 ? 'text-emerald-300' : c > 30 ? 'text-amber-300' : 'text-red-300'} font-bold">${c}%</span></div>
          <div class="text-[10px] text-slate-400">${Object.entries(s).map(([k, w]) => `${GARAGE_PARTS[k].label} ${Math.round(100 - w)}%`).join(' · ')}</div></div>`;
      }).join('');
    }

// --- The lift and the vehicle on it -------------------------------------------------------------------
// Raise the two-post lift (and the vehicle sitting on its arms) to height h above the floor
async function liftTo(ctx, h, ms = 2500) {
      const lift = workshopModel('lift2');
      const v = workshopTrip.vehicle;
      const mesh = v && vehicleMeshes[v.id];
      const u = lift.userData;
      const from = u.carriages[0].position.y - u.liftY;
      const base = wsGroup.position.y + WS_F2;
      await ctx.animate(ms, k => {
        const e = k * k * (3 - 2 * k), y = from + (h - from) * e;
        u.carriages.forEach(c => { c.position.y = u.liftY + y; });
        if (mesh) mesh.position.y = base + y;
      });
    }

function wheelOff(ctx) {
      // A loose wheel by the truck's front corner (where he takes it off)
      const g = new THREE.Group();
      mmCyl(g, 0.62, 0.45, 'tire', 0, 0, 0, { axis: 'z' });
      mmCyl(g, 0.36, 0.47, 'chrome', 0, 0, 0, { axis: 'z' });
      return g;
    }

// --- The garage job ----------------------------------------------------------------------------------
registerWorkshopMachine({
  key: 'garage', name: 'Garage lift bay', short: 'garage', kind: 'garage', floor: 2, learnAs: 'garage', emoji: '🔧', skill: 'Servicing vehicles',
  teaches: ['lift2', 'lift4', 'tirechanger', 'balancer', 'brakelathe', 'hoist', 'press', 'partswasher', 'migtig', 'compressor', 'airtools'],
  wiki: ['Automobile repair shop', 'Vehicle lift', 'Tire changer'],
  learned: 'In a garage the vehicle goes up on a lift at its jacking points. Wheels come off with an impact wrench from the air compressor; tires are swapped on a tire changer and balanced with weights; brake pads are replaced and rotors turned on a brake lathe; oil drains from the sump and a new filter goes on; an engine comes out with a hoist after everything is disconnected.',
  needsFor: job => (GARAGE_SERVICES[job.service] || GARAGE_SERVICES.oil).needs,
  words: [/garage|lift|oil change|tire|tyre|brake|engine pull|service (the|my)|truck|mechanic/i],
  products: [], noSolo: false,
  plan(job) {
    const v = job.vehicle || garageVehicles()[0];
    if (!v) { state.speechBubble = 'I don\'t have a vehicle to work on yet.'; return null; }
    const service = job.service && GARAGE_SERVICES[job.service] ? job.service : Object.keys(GARAGE_SERVICES).find(k => GARAGE_SERVICES[k].words.test(job.make || '')) || 'oil';
    job.vehicle = v;
    job.service = service;
    const svc = GARAGE_SERVICES[service];
    const vname = plainItem(v.name).toLowerCase();
    const side = { x: 3.9, z: -1.2 };
    const under = { x: LIFT2.x - 0.2, z: LIFT2.z - 1.2 };
    const stops = [];
    const at = (key, stand, act) => stops.push({ floor: 2, key, stand, act });
    // Up it goes
    at('lift2', side, async ctx => {
      await machineStep(ctx, 'Setting the lift arms under the jacking points', 1800, null, 'Pads under the pinch welds, all four.');
      await machineStep(ctx, `Raising the ${vname}`, 100);
      await liftTo(ctx, service === 'oil' || service === 'engine' ? 1.9 : 1.2, 2800);
      machineSkill('lift2', 2);
      return true;
    });
    if (service === 'tires' || service === 'brakes') {
      at('compressor', null, async ctx => {
        const u = ctx.model.userData;
        useWorkshopSupply('airToolOil', 1, 'Air tools');
        await machineStep(ctx, 'Starting the compressor and oiling the impact wrench', 2200, (k, t) => { u.fan.rotation.y = t * 30; if (u.gauge) u.gauge.rotation.z = -k * 2; }, 'Tank up to 175 psi. A few drops of air tool oil in the wrench.');
        machineSkill('compressor', 2);
        return true;
      });
      at('airtools', side, async ctx => {
        ctx.face(LIFT2.x, LIFT2.z + 1.5);
        await machineStep(ctx, 'Zipping the lug nuts off with the impact wrench', 2400, null, 'Brrrrt! Brrrrt! Four wheels off.');
        machineSkill('airtools', 2);
        return true;
      });
    }
    if (service === 'tires') {
      at('tirechanger', null, async ctx => {
        const u = ctx.model.userData;
        useWorkshopSupply('tires', 1, 'Tire change');
        u.wheel.visible = true;
        await machineStep(ctx, 'Breaking the bead and changing the tire', 5000, (k, t) => {
          u.breaker.rotation.z = k < 0.2 ? -k * 2 : 0;
          u.turntable.rotation.y = k > 0.2 ? t * 3 : 0;
          u.mountHead.position.y = -0.38 - (k > 0.25 ? 0.06 : 0);
        }, 'Bead breaker, then the mount head walks the old tire off and the new one on.');
        u.wheel.visible = false;
        machineSkill('tirechanger', 4);
        return true;
      });
      at('balancer', null, async ctx => {
        const u = ctx.model.userData;
        useWorkshopSupply('wheelWeights', 4, 'Balancing');
        u.wheel.visible = true;
        await machineStep(ctx, 'Spinning each wheel on the balancer', 4000, (k, t) => {
          u.hood.rotation.z = k > 0.1 && k < 0.85 ? 0 : 1.1;
          u.wheel.rotation.x = k > 0.15 && k < 0.8 ? t * 30 : 0;
        }, '15 grams on the inside... spin again: zero, zero. Balanced.');
        u.wheel.visible = false;
        machineSkill('balancer', 4);
        return true;
      });
    }
    if (service === 'brakes') {
      at('brakelathe', null, async ctx => {
        const u = ctx.model.userData;
        u.rotor.visible = true;
        await machineStep(ctx, 'Turning the brake rotors true on the lathe', 4500, (k, t) => { u.arbor.rotation.x = t * 20; u.bits.position.y = 1.12 + Math.sin(k * Math.PI) * 0.02; });
        u.rotor.visible = false;
        machineSkill('brakelathe', 4);
        return true;
      });
      at('lift2', side, async ctx => {
        useWorkshopSupply('brakeCleaner', 1, 'Brakes');
        useWorkshopSupply('brakePads', 1, 'Brakes');
        await machineStep(ctx, 'Cleaning the calipers and fitting the new pads', 3500, null, 'Brake cleaner, new pads, a dab of grease on the slides.');
        return true;
      });
    }
    if (service === 'oil') {
      at('lift2', under, async ctx => {
        const lift = ctx.model;
        const pan = new THREE.Group();
        mmCyl(pan, 0.3, 0.12, 'yellow', 0, 0.06, 0);
        mmCyl(pan, 0.25, 0.02, 'oil', 0, 0.11, 0);
        const stream = mmCyl(pan, 0.025, 1, 'oil', 0, 0.6, 0);
        stream.visible = false;
        pan.position.set(-0.2, 0, -1.6);
        lift.add(pan);
        ctx.reach(2.2);
        await machineStep(ctx, 'Pulling the drain plug: old oil into the drain pan', 4000, (k, t) => { stream.visible = k < 0.85; stream.scale.y = 1.6 * (1 - k * 0.3); stream.position.y = 0.11 + stream.scale.y / 2; }, 'Dark and thin. It was overdue.');
        useWorkshopSupply('oilFilter', 1, 'Oil change');
        await machineStep(ctx, 'Spinning off the old filter, a new one on', 2500, null, 'A smear of fresh oil on the gasket, hand tight plus a quarter.');
        lift.remove(pan);
        ctx.idle();
        await liftTo(ctx, 0, 2200);
        useWorkshopSupply('engineOil', 1, 'Oil change');
        await machineStep(ctx, 'Filling it with fresh 5W-30 and checking the dipstick', 3000, null, 'Right on the full mark.');
        return true;
      });
    }
    if (service === 'engine') {
      at('hoist', null, async ctx => {
        const u = ctx.model.userData;
        await machineStep(ctx, 'Disconnecting hoses, wiring and the motor mounts', 2500);
        await liftTo(ctx, 0, 2000);
        u.engine.visible = true;
        await machineStep(ctx, 'Pulling the engine with the hoist', 4500, (k) => { u.boom.rotation.x = -0.2 * k; u.hook.position.y = 0.5 * k; ctx.model.position.z = 4.6 - Math.sin(k * Math.PI) * 0.9; });
        machineSkill('hoist', 4);
        return true;
      });
      at('partswasher', null, async ctx => {
        const u = ctx.model.userData;
        useWorkshopSupply('solvent', 1, 'Parts washer');
        await machineStep(ctx, 'Scrubbing the parts in the parts washer', 3500, (k, t) => { u.brush.position.x = 0.2 + Math.sin(t * 6) * 0.15; u.brush.rotation.z = 0.8 + Math.sin(t * 9) * 0.3; });
        machineSkill('partswasher', 3);
        return true;
      });
      at('press', null, async ctx => {
        const u = ctx.model.userData;
        useWorkshopSupply('gasketSet', 1, 'Engine rebuild');
        await machineStep(ctx, 'Pressing new bearings in on the shop press', 3000, k => { u.ram.position.y = 1.4 - Math.sin(k * Math.PI) * 0.45; });
        machineSkill('press', 3);
        return true;
      });
      at('hoist', null, async ctx => {
        const u = ctx.model.userData;
        useWorkshopSupply('engineOil', 1, 'Engine rebuild');
        await machineStep(ctx, 'New gaskets, then lowering the engine back in', 4000, (k) => { u.boom.rotation.x = -0.2 * (1 - k); u.hook.position.y = 0.5 * (1 - k); });
        u.engine.visible = false;
        return true;
      });
    }
    if (service === 'body') {
      at('migtig', side, async ctx => {
        const u = ctx.model.userData;
        useWorkshopSupply('migWire', 1, 'Frame repair');
        useWorkshopSupply('shieldGas', 1, 'Frame repair');
        ctx.face(LIFT2.x, LIFT2.z);
        await machineStep(ctx, 'Grinding the crack and MIG welding the frame', 4500, (k, t) => { wsGlowSet(u.tip, Math.random()); }, 'Helmet down. A nice stack of dimes.');
        wsGlowSet(u.tip, 0);
        machineSkill('migtig', 4);
        return true;
      });
    }
    if (service === 'tires' || service === 'brakes') {
      at('airtools', side, async ctx => {
        await machineStep(ctx, 'Wheels back on, torqued to spec in a star pattern', 2500, null, 'Impact wrench to snug, then the torque wrench: 140 ft-lb.');
        return true;
      });
    }
    // Down it comes (unless it already is)
    at('lift2', side, async ctx => {
      await liftTo(ctx, 0, 2200);
      await machineStep(ctx, 'Swinging the arms out', 900);
      return true;
    });
    return {
      title: `${svc.title[0].toUpperCase()}${svc.title.slice(1)} on the ${vname}`, product: `${svc.title} on the ${vname}`,
      speech: `Taking the ${vname} into the garage for ${svc.title}.`,
      stops,
      finish: () => {
        const s = vehicleService(v);
        s[service] = 0;
        if (service === 'engine') s.oil = 0;
        v.wear = Math.round(100 - vehicleCondition(v));
        machineSkill('garage', 8);
        state.moodEmoji = '🔧';
        state.moodTitle = `Finished ${svc.title} on the ${vname}`.slice(0, 80);
        state.speechBubble = `All done: the ${vname} is at ${vehicleCondition(v)}% now.`;
        state.diaryEntries.unshift({
          time: 'In the Garage', location: "his Workshop garage", mood: `🔧 ${state.moodTitle}`.slice(0, 80),
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I drove the ${vname} up the car elevator and did ${svc.title} myself. It's at ${vehicleCondition(v)}% condition now.`
        });
        showToast(`🔧 Kelo-1 did ${svc.title} on the ${vname}`);
      }
    };
  }
});

// The CNC plasma table: cut a steel bracket from plate
registerWorkshopMachine({
  key: 'plasma', name: 'CNC plasma table', short: 'plasma table', kind: 'garage', floor: 2, at: { x: 1.2, z: -0.6, ry: Math.PI }, size: { w: 1.7, h: 1.1, d: 1.0 }, emoji: '⚡', skill: 'CNC plasma cutting',
  model: plasmaTableModel, stand: { x: 1.2, z: -1.6 },
  wiki: ['Plasma cutting'], learned: 'A plasma cutter blows an electric arc through a jet of compressed air hot enough to melt steel plate. On a CNC table the torch follows the G-code; the electrode and nozzle wear and must be replaced, and the bright arc needs eye protection.',
  needs: ['steelPlate', 'plasmaKit', 'weldHelmet', 'gloves'], words: [/plasma/i],
  products: ['A plasma-cut steel bracket', 'A plasma-cut steel go-kart frame gusset'], makes: [/gusset|steel bracket|plate bracket/],
  plan(job) {
    const key = this.key;
    const name = job.make ? madeName('plasma-cut', 'steel', job.make, this.products[0]) : wsPick(this.products);
    return {
      title: `Plasma cutting ${wsThing(name)}`, product: name,
      stops: [{ floor: 2, key, act: async ctx => {
        const u = ctx.model.userData, m = ctx.model;
        await writeCam(ctx, WORKSHOP_MACHINES.plasma, name, strokePoints(PART_STROKES, 1.0, 0.6));
        useWorkshopSupply('steelPlate', 1, 'Plasma');
        useWorkshopSupply('plasmaKit', 1, 'Plasma');
        const plate = mmBox(m, 1.2, 0.02, 0.7, 'steel', 0, 0.61, 0);
        const pts = strokePoints(PART_STROKES, 1.0, 0.6);
        await machineStep(ctx, `Cutting ${wsThing(name)} out of the plate`, 7000, (k, t) => {
          const f = k * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), uu = f - i;
          const a = pts[i], b = pts[i + 1];
          u.gantry.position.x = a.x + (b.x - a.x) * uu;
          u.torch.position.z = a.z + (b.z - a.z) * uu;
          u.arc.visible = b.down;
          wsGlowSet(u.arc, b.down ? 0.8 + Math.random() * 0.2 : 0);
          if (b.down) wsSpray(m, new THREE.Vector3(u.gantry.position.x + 0.06, 0.6, u.torch.position.z), { color: 0xffa94d, rate: 3, speed: 0.4, up: -0.2, size: 0.012, floor: 0.0, life: 0.4, max: 40 });
        }, 'Shade 5 lenses down. The arc screams through the steel.');
        wsGlowSet(u.arc, 0);
        wsClearSpray(m);
        m.remove(plate);
        return true;
      } }],
      finish: () => { addMadeThing(name, 'plasma table', { emoji: '⚡' }); machineSkill(key, 6); }
    };
  }
});
