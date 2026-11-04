// Kelo-bot-1 — js/knowhow.js
// Loaded after disposal.js. Tools and vehicles only work as intended:
//   - before he uses something for the first time he reads up on it at the NetNode cafe
//   - vehicles arrive with an empty tank and burn fuel as he drives; he asks for the right fuel
//     (diesel, gasoline, jet fuel, propane for the balloon) and fills them up when it comes
//   - a telescope only shows stars, and only at night
// Bikes and rowboats need know-how but no fuel.

const GEAR_KNOWHOW = [
  { key: 'dig', re: /shovel|spade|pick ?ax(e)?|mattock/i, label: 'a shovel', wiki: 'Shovel',
    how: 'Step on the blade to push it in, lever the handle back, then lift and throw the dirt.' },
  { key: 'rock', re: /jack ?hammer|rock breaker|demolition hammer/i, label: 'a jackhammer', wiki: 'Jackhammer',
    how: 'Hold it upright, let its weight do the work, and squeeze the trigger in short bursts.' },
  { key: 'truck', re: /dump ?truck/i, label: 'a dump truck', wiki: 'Dump truck', fuel: 'diesel',
    how: 'Start the engine, drive it backwards up to the edge, then lift the bed to tip the load.' },
  { key: 'excavator', re: /excavator|digger|backhoe/i, label: 'an excavator', wiki: 'Excavator', fuel: 'diesel',
    how: 'The left lever swings the cab and stick, the right one lifts the boom and curls the bucket.' },
  { key: 'boat', re: /\b(boat|canoe|kayak|raft|rowboat|sailboat|paddle ?board)\b/i, label: 'a boat', wiki: 'Rowing',
    how: 'Sit facing the back, dip both oars together and pull, then lift them and reach again.' },
  { key: 'bike', re: /\b(bike|bicycle|scooter)\b/i, label: 'a bicycle', wiki: 'Bicycle',
    how: 'Keep pedalling to stay balanced, look where you want to go, and squeeze the brakes gently.' },
  { key: 'snowmobile', re: /snowmobile|snow ?machine/i, label: 'a snowmobile', wiki: 'Snowmobile', fuel: 'gasoline',
    how: 'Squeeze the throttle with your thumb, lean into turns, and keep it on the snow.' },
  { key: 'helicopter', re: /helicopter|gyrocopter/i, label: 'a helicopter', wiki: 'Helicopter', fuel: 'jet fuel',
    how: 'The collective lifts you, the cyclic tilts you, and the pedals turn the tail.' },
  { key: 'balloon', re: /hot.?air balloon/i, label: 'a hot-air balloon', wiki: 'Hot air balloon', fuel: 'propane',
    how: 'Fill the propane tank, light the burner, and heat the air in the envelope to rise.' },
  { key: 'axe', re: /^(?!.*pick ?ax).*(\baxe\b|hatchet)/i, label: 'an axe', wiki: 'Axe',
    how: 'Plant your feet, swing from the shoulder, and cut a notch on the side you want the tree to fall toward.' },
  { key: 'telescope', re: /telescope/i, label: 'a telescope', wiki: 'Telescope',
    how: 'Point it at the night sky and focus slowly: it only shows the stars when it is dark.' }
];

const FUEL_TYPES = {
  diesel: { re: /diesel/i, ask: 'A jerry can of diesel' },
  gasoline: { re: /gasoline|petrol|\bgas can\b|\bcans? of gas\b|\bjerry ?can of gas\b/i, ask: 'A can of gasoline' },
  'jet fuel': { re: /jet fuel|aviation fuel|kerosene/i, ask: 'A drum of jet fuel' },
  propane: { re: /propane/i, ask: 'A full propane tank' }
};
const FUEL_PER_UNIT = 0.9; // percent of a tank used per unit driven

function knowHowRule(name) {
      return GEAR_KNOWHOW.find(r => r.re.test(String(name || ''))) || null;
    }

function fuelLeft(v) {
      // Vehicles saved before fuel existed are treated as full
      return typeof v.fuel === 'number' ? v.fuel : 100;
    }

function fuelNeededBy(v) {
      const rule = knowHowRule(v.name);
      return rule && rule.fuel ? rule.fuel : null;
    }

// Can he use this right now? If not, he says why and sets about fixing it (unless `quiet`)
function readyToOperate(name, v = null, { quiet = false } = {}) {
      const rule = knowHowRule(name);
      if (!rule) return true;
      const plain = String(name).replace(/^(an?|the)\s+/i, '');
      if (!state.knowHow[rule.key]) {
        if (!quiet) {
          state.speechBubble = `I don't actually know how to use the ${plain} yet. I'll read up on it at NetNode first.`;
          renderAllUI();
          doWhenFree(() => learnToUse(name, 'Learning How Things Work'));
        }
        return false;
      }
      if (v && rule.fuel && fuelLeft(v) <= 0) {
        if (!quiet) {
          state.speechBubble = `The ${plain} won't start: its tank is empty. It runs on ${rule.fuel}.`;
          renderAllUI();
          requestFuel(rule.fuel, `My ${plain} is out of ${rule.fuel}, so it won't go anywhere.`);
        }
        return false;
      }
      return true;
    }

// A can (jerry can, drum, tank) of this fuel he owns. Only real fuel counts: a "Diesel dump truck"
// is a truck, not a can of diesel, and filling a tank from it would loop forever.
function fuelCanFor(fuel) {
      return ownedItemNames().find(n => fuelTypeOf(n) === fuel && !(typeof vehicleTypeFor === 'function' && vehicleTypeFor(n))
        && (typeof usesPerItem !== 'function' || usesPerItem(n) > 0)) || null;
    }

// One queued fill-up per fuel at a time (this session only). doWhenFree gives up after ~3 minutes
// of him being busy, so a queued one older than 4 minutes no longer counts.
const refuelsQueued = new Map();
function refuelQueued(fuel) {
      return Date.now() - (refuelsQueued.get(fuel) || 0) < 4 * 60 * 1000;
    }

function requestFuel(fuel, why) {
      const type = FUEL_TYPES[fuel];
      if (!type) return;
      // Some left in a can on his shelf? He fills up from that before asking for more,
      // once: a fill-up that just failed isn't retried on every check (js/loopguard.js)
      const can = fuelCanFor(fuel);
      if (can) {
        if (refuelQueued(fuel) || (typeof activityCoolingDown === 'function' && activityCoolingDown('refuel:' + fuel))) return;
        refuelsQueued.set(fuel, Date.now());
        doWhenFree(async () => {
          try { await refuelWith(can); } finally { refuelsQueued.delete(fuel); }
        });
        return;
      }
      // Already waiting for some (asked, or sitting in the mailbox)?
      if (state.requestsToUser.some(r => !r.fulfilled && type.re.test(r.requestedGear || '')) || state.mailbox.some(m => type.re.test(m.name || ''))) return;
      addItemRequest(type.ask, 'fuel', why, 'Fuel');
      showToast(`⛽ Kelo-1 asked for ${type.ask.toLowerCase()}`);
    }

// Every drive burns some of the tank
function burnFuel(v, distance) {
      if (!fuelNeededBy(v)) return;
      v.fuel = Math.max(0, Math.round((fuelLeft(v) - distance * FUEL_PER_UNIT) * 10) / 10);
      if (v.fuel <= 0) {
        state.speechBubble = `The ${v.name.replace(/^(an?|the)\s+/i, '')} coughed and stopped. Out of ${fuelNeededBy(v)}.`;
        requestFuel(fuelNeededBy(v), `I ran my ${v.name.replace(/^(an?|the)\s+/i, '')} until the tank was empty.`);
      }
    }

// --- Learning at NetNode -----------------------------------------------------------------------
async function learnToUse(name, originLabel = 'Learning How Things Work') {
      const rule = knowHowRule(name);
      if (!rule || state.knowHow[rule.key]) return false;
      if (state.isBusy || state.isBrowsing || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isBusy = true;
      state.isBrowsing = true;
      const plain = String(name).replace(/^(an?|the)\s+/i, '');
      try {
        const cafe = TOWN_LOCATIONS.cyber;
        state.currentLocKey = 'cyber';
        state.customPlaceName = null;
        state.targetPos = { x: cafe.x, z: cafe.z };
        state.microPose = 'normal';
        state.moodEmoji = '📘';
        state.moodTitle = `Looking up how to use ${rule.label}`;
        state.speechBubble = `Before I touch the ${plain}, I want to know how it's meant to work.`;
        renderAllUI();
        await waitForArrival(60000);
        await new Promise(r => setTimeout(r, 2500));
        let article = null;
        try { article = typeof wikiSummary === 'function' ? await wikiSummary(rule.wiki) : null; } catch (e) {}
        const firstSentence = article ? (article.extract.match(/^[^.]*\./) || [article.extract])[0].slice(0, 220) : '';
        state.knowHow[rule.key] = { at: Date.now(), from: article ? article.title : rule.wiki, how: rule.how };
        state.webHistory.unshift({
          query: `How to use ${rule.label}`, time: 'Just now', verdict: rule.how,
          hops: article ? [{ title: article.title, url: article.url, extract: article.extract.slice(0, 280) }] : []
        });
        if (state.webHistory.length > 12) state.webHistory.length = 12;
        state.moodTitle = `Learned how to use ${rule.label}`;
        state.speechBubble = `${firstSentence ? firstSentence + ' ' : ''}So: ${rule.how}`.slice(0, 400);
        state.changedLatelySummary = `Learned how to use ${rule.label} at NetNode`;
        state.wonderLevel = Math.min(100, state.wonderLevel + 6);
        state.diaryEntries.unshift({
          time: originLabel, location: 'NetNode Cyber Cafe', mood: `📘 Learned how to use ${rule.label}`,
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I didn't want to break the ${plain} by guessing, so I read about it at NetNode. ${rule.how}${rule.fuel ? ` It runs on ${rule.fuel}, so I'll need some before it goes anywhere.` : ''}`
        });
        showToast(`📘 Kelo-1 learned how to use ${rule.label}`);
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        state.isBusy = false;
        state.isBrowsing = false;
      }
    }

// --- Fuel deliveries ---------------------------------------------------------------------------
function fuelTypeOf(item) {
      return Object.keys(FUEL_TYPES).find(k => FUEL_TYPES[k].re.test(String(item || ''))) || null;
    }

// Called when he opens a delivery: if it's fuel, he goes and fills up whatever runs on it
function receiveFuel(item) {
      const fuel = fuelTypeOf(item);
      if (!fuel || (typeof vehicleTypeFor === 'function' && vehicleTypeFor(item)) || refuelQueued(fuel)) return;
      refuelsQueued.set(fuel, Date.now());
      doWhenFree(async () => {
        try { await refuelWith(item); } finally { refuelsQueued.delete(fuel); }
      });
    }

// Couldn't fill up: say why once, and leave it alone for a while instead of trying again and again
function refuelFailed(fuel, why) {
      if (typeof coolDownActivity === 'function') coolDownActivity('refuel:' + fuel);
      state.speechBubble = why;
      state.diaryEntries.unshift({
        time: 'Filling Up', location: currentPlaceLabel(), mood: '⛽ Couldn\'t fill up',
        vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, ${why} I'll stop trying for now and do something else.`
      });
      renderAllUI();
      return 'refuel-failed';
    }

async function refuelWith(item, originLabel = 'Filling Up') {
      const fuel = fuelTypeOf(item);
      const thirsty = state.vehicles.filter(v => fuelNeededBy(v) === fuel && fuelLeft(v) < 100 && v.name !== item);
      if (!fuel || !thirsty.length) return false;
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      // Only a real can of fuel he owns can fill a tank
      if (!ownedItemNames().includes(item) || (typeof vehicleTypeFor === 'function' && vehicleTypeFor(item))) {
        return refuelFailed(fuel, `I went to fill up with the ${String(item).replace(/^(an?|the)\s+/i, '')}, but that isn't a can of ${fuel} I can pour.`);
      }
      state.isPracticing = true;
      try {
        if (typeof setCarriedObject === 'function') setCarriedObject(buildItemModel3D(item, { label: false }));
        const filled = [];
        for (const v of thirsty) {
          if (!ownedItemNames().includes(item)) break; // the can is empty
          const plain = v.name.replace(/^(an?|the)\s+/i, '');
          state.currentLocKey = 'custom';
          state.customPlaceName = `the ${plain}`;
          state.targetPos = boardingSpot(v);
          state.moodEmoji = '⛽';
          state.moodTitle = `Filling the ${plain} with ${fuel}`;
          state.speechBubble = `Off to fill the ${plain} with ${fuel}.`;
          renderAllUI();
          // He really walks over to it: something else changing where he's headed doesn't count as arriving
          const spot = { ...state.targetPos }, startedAt = Date.now();
          while (Date.now() - startedAt < 90000 && Math.hypot(state.botPos.x - spot.x, state.botPos.z - spot.z) > 1.2) {
            if (Math.hypot(state.targetPos.x - spot.x, state.targetPos.z - spot.z) > 0.1) state.targetPos = { ...spot };
            await waitForArrival(5000);
          }
          state.speechBubble = `Glug, glug, glug... ${fuel} into the ${plain}.`;
          renderAllUI();
          await new Promise(r => setTimeout(r, 2200));
          // A can holds about one tank: it pours what the tank needs, or what's left (js/itemuse.js).
          // Quiet: running the can dry isn't a reason to ask for more while the tank is now full.
          const need = 100 - fuelLeft(v);
          const got = typeof useUpItem === 'function' ? useUpItem(item, need, { quiet: true, why: `filling the ${plain}` }).used : need;
          if (!(got > 0)) {
            if (typeof forgetItem === 'function' && !(typeof supplyOf === 'function' && supplyOf(item))) forgetItem(item);
            return refuelFailed(fuel, `I tipped the ${String(item).replace(/^(an?|the)\s+/i, '')} into the ${plain}, but nothing came out: it's empty.`);
          }
          v.fuel = Math.min(100, Math.round((fuelLeft(v) + got) * 10) / 10);
          filled.push(v);
        }
        if (!filled.length) return refuelFailed(fuel, `I don't have any ${fuel} left to pour.`);
        if (typeof useUpItem !== 'function' && typeof forgetItem === 'function') forgetItem(item);
        const left = typeof supplyNote === 'function' ? supplyNote(item) : '';
        if (left) state.speechBubble = `The tank's topped up, and there's ${left.replace(' left', '')} of the ${fuel} left for later.`;
        else if (state.vehicles.some(v => fuelNeededBy(v) === fuel && fuelLeft(v) < 100)) requestFuel(fuel, `One can wasn't enough to fill everything that runs on ${fuel}.`);
        else state.speechBubble = `Full tank${filled.length > 1 ? 's' : ''}! That used up the whole can of ${fuel}.`;
        const names = filled.map(v => v.name.replace(/^(an?|the)\s+/i, '')).join(' and ');
        state.moodTitle = `Filled up the ${names}`.slice(0, 80);
        state.diaryEntries.unshift({
          time: originLabel, location: 'the vehicle yard', mood: '⛽ Full tank',
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, the ${fuel} came, so I filled up the ${names}. Now it can actually go somewhere.`
        });
        showToast(`⛽ Kelo-1 filled up the ${names}`);
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.isPracticing = false;
      }
    }

// --- The telescope -----------------------------------------------------------------------------
const NIGHT_SKY = ['Orion and his belt of three stars', 'the Big Dipper', 'Cassiopeia, like a crooked W', 'the Pleiades, a tiny cluster',
  'the craters along the edge of the Moon', 'Jupiter and four little moons beside it', 'the Milky Way, a river of faint light', 'Saturn and its rings'];

async function stargaze(originLabel = 'Looking Up') {
      const scope = [...state.toolInventory, ...state.belongings.map(b => b.name), ...state.toys.map(t => t.name)].find(n => /telescope/i.test(n));
      if (!scope || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      if (!readyToOperate(scope)) return false;
      const night = typeof worldNow === 'function' ? worldNow().isNight : false;
      state.isPracticing = true;
      let placed = null;
      try {
        if (typeof fetchFromStorehouse === 'function') await fetchFromStorehouse(scope);
        const spot = { x: TOWN_LOCATIONS.meadow.x + randRange(-2, 2), z: TOWN_LOCATIONS.meadow.z + randRange(-2, 2) };
        state.currentLocKey = 'meadow';
        state.customPlaceName = null;
        state.targetPos = spot;
        state.moodEmoji = '🔭';
        state.moodTitle = 'Setting up the telescope in the meadow';
        renderAllUI();
        await waitForArrival(60000);
        // Set it up on its tripod beside him and look through it
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        placed = lifeSize(buildItemModel3D(scope, { label: false }));
        placed.position.set(spot.x + 0.9, getIslandGroundHeight(spot.x + 0.9, spot.z), spot.z);
        scene.add(placed);
        state.botRotY = Math.PI / 2;
        await new Promise(r => setTimeout(r, 3000));
        if (night) {
          // With constellations switched on (js/pastimes.js) he finds a named one and sees it drawn
          const seen = (typeof constellationForStargaze === 'function' && constellationForStargaze()) || pick(NIGHT_SKY);
          state.moodTitle = 'Stargazing through the telescope';
          state.speechBubble = `I can see ${seen}! It's so much further away than anything I've ever touched.`;
          state.wonderLevel = Math.min(100, state.wonderLevel + 14);
          state.calmLevel = Math.min(100, state.calmLevel + 6);
          state.diaryEntries.unshift({
            time: originLabel, location: 'the meadow at night', mood: '🔭 Stargazing',
            vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
            text: `Dear Diary, I set up the telescope in the dark meadow and found ${seen}. Some of that light left before I existed.`
          });
          if (Math.random() < 0.4) queueCuriosity(seen.replace(/^the /, '').split(',')[0]);
        } else {
          state.moodTitle = 'Squinting through the telescope in daylight';
          state.speechBubble = "It's just bright blue sky. The stars only show up at night, so I'll come back after dark.";
          state.diaryEntries.unshift({
            time: originLabel, location: 'the meadow', mood: '🔭 Too bright for stars',
            vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
            text: "Dear Diary, I tried the telescope in the daytime and saw nothing but sky. It's for the night: I'll try again when it's dark."
          });
        }
        await new Promise(r => setTimeout(r, 3500));
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        if (placed) scene.remove(placed);
        state.isPracticing = false;
      }
    }

function stargazeChance() {
      const owns = [...state.toolInventory, ...state.belongings.map(b => b.name), ...state.toys.map(t => t.name)].some(n => /telescope/i.test(n));
      if (!owns) return 0;
      return typeof worldNow === 'function' && worldNow().isNight ? 0.25 : 0.02;
    }

function knowHowSummaryForAI() {
      const known = GEAR_KNOWHOW.filter(r => state.knowHow[r.key]).map(r => r.label.replace(/^an? /, ''));
      return known.length ? known.join(', ') : 'nothing yet (you read up on a tool or vehicle at NetNode before using it)';
    }
