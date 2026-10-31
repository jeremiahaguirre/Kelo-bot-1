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
  { key: 'telescope', re: /telescope/i, label: 'a telescope', wiki: 'Telescope',
    how: 'Point it at the night sky and focus slowly: it only shows the stars when it is dark.' }
];

const FUEL_TYPES = {
  diesel: { re: /diesel/i, ask: 'A jerry can of diesel' },
  gasoline: { re: /gasoline|petrol|\bgas can\b/i, ask: 'A can of gasoline' },
  'jet fuel': { re: /jet fuel|aviation fuel|kerosene/i, ask: 'A drum of jet fuel' },
  propane: { re: /propane/i, ask: 'A full propane tank' }
};
const FUEL_PER_UNIT = 0.9; // percent of a tank used per unit driven

function knowHowRule(name) {
      return GEAR_KNOWHOW.find(r => r.re.test(String(name || ''))) || null;
    }

function knowsHowToUse(name) {
      const rule = knowHowRule(name);
      return !rule || Boolean(state.knowHow[rule.key]);
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

function requestFuel(fuel, why) {
      const type = FUEL_TYPES[fuel];
      if (!type) return;
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
      if (fuelTypeOf(item)) doWhenFree(() => refuelWith(item));
    }

async function refuelWith(item, originLabel = 'Filling Up') {
      const fuel = fuelTypeOf(item);
      const thirsty = state.vehicles.filter(v => fuelNeededBy(v) === fuel && fuelLeft(v) < 100);
      if (!fuel || !thirsty.length) return false;
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isPracticing = true;
      try {
        if (typeof setCarriedObject === 'function') setCarriedObject(buildItemModel3D(item, { label: false }));
        for (const v of thirsty) {
          const plain = v.name.replace(/^(an?|the)\s+/i, '');
          state.currentLocKey = 'custom';
          state.customPlaceName = `the ${plain}`;
          state.targetPos = boardingSpot(v);
          state.moodEmoji = '⛽';
          state.moodTitle = `Filling the ${plain} with ${fuel}`;
          state.speechBubble = `Glug, glug, glug... the ${plain} gets a full tank.`;
          renderAllUI();
          await waitForArrival(60000);
          await new Promise(r => setTimeout(r, 2200));
          v.fuel = 100;
        }
        if (typeof forgetItem === 'function') forgetItem(item);
        const names = thirsty.map(v => v.name.replace(/^(an?|the)\s+/i, '')).join(' and ');
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
          const seen = pick(NIGHT_SKY);
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
