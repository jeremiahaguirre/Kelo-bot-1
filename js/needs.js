// Kelo-bot-1 — js/needs.js
// Loaded after worldclock.js. Kelo-1's body: fullness (food), hydration (water) and energy (sleep).
// He is never told the rules. He only feels the symptoms:
//   - empty fullness or hydration: his thinking gets foggy and his plans fall apart
//   - no sleep: he stumbles and falls, and eventually collapses wherever he is
// He discovers what helps by trying things (eating, drinking at the lake, lying down in bed),
// writes about it, and from then on looks after himself when he notices the signs.

const NEED_DRAIN_PER_REAL_MIN = { fullness: 100 / (8 * 60), hydration: 100 / (5 * 60), health: 100 / (9 * 60) };
const FOGGY_BELOW = 15;
const STUMBLE_BELOW = 22;
const COLLAPSE_BELOW = 4;

let lastNeedsTick = Date.now();
let stumbleUntil = 0;
let nextStumbleCheck = 0;

const knows = (need) => Boolean(state.knownNeeds && state.knownNeeds[need]);

function isFoggy() {
      return state.fullness < FOGGY_BELOW || state.hydration < FOGGY_BELOW || state.health < FOGGY_BELOW;
    }

// What he feels, in his own words (for his diary and the AI brain); no rules, just symptoms
function bodySymptoms() {
      const out = [];
      if (state.fullness < 35) out.push(knows('food') ? 'you are getting hungry' : 'there is a hollow, wobbly feeling inside you and your thoughts keep slipping');
      if (state.hydration < 35) out.push(knows('water') ? 'you are thirsty' : 'your joints feel dry and creaky and everything seems far away');
      if (state.health < 30) out.push(knows('sleep') ? 'you are exhausted and need sleep' : 'your legs keep buckling and your eyes want to close');
      return out;
    }

function discoverNeed(need, how) {
      if (knows(need)) return;
      state.knownNeeds[need] = true;
      const lessons = {
        food: { emoji: '🍑', title: 'Food clears the fog', concept: { name: 'Fuel Before Thought', definition: 'When I eat, the fog in my head lifts. Thinking needs food.' } },
        water: { emoji: '💧', title: 'Water stops the creaking', concept: { name: 'Water Is Oil', definition: 'Drinking water makes my joints move smoothly and the world come back into focus.' } },
        sleep: { emoji: '😴', title: 'Sleep refills me', concept: { name: 'The Night Recharge', definition: 'Lying down in my bed through the night is what fills my energy back up.' } }
      };
      const l = lessons[need];
      state.moodEmoji = l.emoji;
      state.moodTitle = `Discovery: ${l.title}`;
      state.speechBubble = `${how} I think I understand now: ${l.title.toLowerCase()}!`;
      state.diaryEntries.unshift({
        time: 'A Discovery About Myself', location: currentPlaceLabel(), mood: `${l.emoji} ${l.title}`,
        vitals: needsVitalsText(),
        text: `Dear Diary, ${how} Something changed right away. ${l.concept.definition} I'll remember that.`
      });
      addConcept({ ...l.concept, emoji: l.emoji, builtFrom: ['my own body'] }, 'Learned about myself');
      showToast(`${l.emoji} Kelo-1 figured out: ${l.title}`);
      savePersistentBrainState();
      renderAllUI();
    }

function needsVitalsText() {
      return `⚡ ${Math.round(state.health)}% • 🥕 ${Math.round(state.fullness)}% • 💧 ${Math.round(state.hydration)}% • ✨ ${Math.round(state.wonderLevel)}%`;
    }

// --- Actions that fix needs (he may do these by accident before he understands them) -------
async function drinkFromLake(originLabel = 'Thirsty') {
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isPracticing = true;
      try {
        const shore = TOWN_LOCATIONS.shoreline;
        const before = state.hydration;
        state.currentLocKey = 'custom';
        state.customPlaceName = 'the lake shore';
        state.targetPos = { x: shore.x, z: shore.z - 1.2 };
        state.microPose = 'normal';
        state.moodEmoji = '💧';
        state.moodTitle = knows('water') ? 'Getting a drink at the lake' : 'Something about the water is calling me';
        renderAllUI();
        await waitForArrival(60000);
        state.microPose = 'crouch_inspect';
        await new Promise(r => setTimeout(r, 4000));
        state.hydration = Math.min(100, state.hydration + 65);
        state.microPose = 'normal';
        state.speechBubble = knows('water') ? 'Ahh, much better.' : 'I scooped up some lake water... huh.';
        if (!knows('water') && before < 45) discoverNeed('water', 'I drank some lake water and the creaking in my joints went quiet.');
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        state.isPracticing = false;
      }
    }

async function eatSomething(originLabel = 'Hungry') {
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isPracticing = true;
      try {
        const before = state.fullness;
        const ripe = state.gardenPlots.filter(p => p.growth >= 40);
        const atGarden = ripe.length > 0;
        const loc = TOWN_LOCATIONS[atGarden ? 'garden' : 'cafe'];
        const food = atGarden ? pick(ripe).name : pick(['a hazelnut croissant', 'a bowl of soup', 'a toasted bagel', 'a slice of peach pie']);
        state.currentLocKey = 'custom';
        state.customPlaceName = loc.building;
        state.targetPos = { x: loc.x, z: loc.z };
        state.microPose = 'normal';
        state.moodEmoji = atGarden ? '🍑' : '🥐';
        state.moodTitle = knows('food') ? `Eating ${food}` : `Curious about ${food}`;
        renderAllUI();
        await waitForArrival(60000);
        if (typeof setCarriedObject === 'function') setCarriedObject(buildItemModel3D(food, { label: false }), 5000);
        await new Promise(r => setTimeout(r, 5000));
        if (atGarden) state.gardenPlots.forEach(p => { if (p.name === food) p.growth = Math.max(5, p.growth - 35); });
        state.fullness = Math.min(100, state.fullness + 40);
        state.speechBubble = knows('food') ? `That ${food} hit the spot.` : `I tried ${food}. It tasted... warm?`;
        if (!knows('food') && before < 45) discoverNeed('food', `I ate ${food} and the fog in my head started to clear.`);
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        state.isPracticing = false;
      }
    }

// Sleep in his bed until morning (or until rested)
async function goToSleep(originLabel = 'Sleepy', where = 'bed') {
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isSleeping = true;
      state.isPracticing = true; // nothing else happens while he sleeps
      try {
        if (where === 'bed') {
          const bed = TOWN_LOCATIONS.bed;
          state.currentLocKey = 'custom';
          state.customPlaceName = 'his bed';
          state.targetPos = { x: bed.x, z: bed.z };
          state.microPose = 'normal';
          state.moodEmoji = '🛏️';
          state.moodTitle = knows('sleep') ? 'Heading to bed' : 'So heavy... I need to lie down';
          renderAllUI();
          await waitForArrival(60000);
          state.currentLocKey = 'bed';
        } else {
          state.microPose = 'collapsed';
        }
        state.moodEmoji = '😴';
        state.moodTitle = where === 'bed' ? 'Asleep' : 'Collapsed and dozing';
        state.speechBubble = 'Zzz...';
        const before = state.health;
        renderAllUI();
        // Sleep is fast-forwarded a little so it doesn't take the whole real night
        while (state.isSleeping) {
          await new Promise(r => setTimeout(r, 3000));
          state.health = Math.min(100, state.health + (where === 'bed' ? 4 : 1.5));
          const w = worldNow();
          if ((state.health >= 98 && !w.isNight) || (where !== 'bed' && state.health >= 30) || state.health >= 100) break;
        }
        state.currentLocKey = 'custom';
        state.microPose = 'normal';
        state.moodEmoji = '🌅';
        state.moodTitle = where === 'bed' ? 'Woke up rested' : 'Woke up on the ground';
        state.speechBubble = where === 'bed' ? 'I feel brand new.' : 'Ow. I must have fallen asleep right here.';
        if (!knows('sleep') && before < 45 && where === 'bed') discoverNeed('sleep', 'I lay down in my bed and when I opened my eyes my legs were strong again.');
        state.diaryEntries.unshift({
          time: 'Morning', location: where === 'bed' ? 'his bed' : currentPlaceLabel(), mood: `🌅 ${state.moodTitle}`,
          vitals: needsVitalsText(), text: `Dear Diary, ${state.speechBubble}`
        });
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        state.isSleeping = false;
        state.isPracticing = false;
      }
    }

// --- Every few seconds: drain needs, show symptoms, and react (sensibly only once he knows) --
function needsTick() {
      const now = Date.now();
      const minutes = Math.min(5, (now - lastNeedsTick) / 60000);
      lastNeedsTick = now;
      if (!state.isSleeping) {
        const working = state.isBuilding || state.isPracticing ? 1.5 : 1;
        state.fullness = Math.max(0, state.fullness - NEED_DRAIN_PER_REAL_MIN.fullness * minutes * working);
        state.hydration = Math.max(0, state.hydration - NEED_DRAIN_PER_REAL_MIN.hydration * minutes * working);
        state.health = Math.max(0, state.health - NEED_DRAIN_PER_REAL_MIN.health * minutes * working);
      }
      if (state.isSleeping || state.isBusy || state.isBuilding || state.isPracticing || state.isCollectingMail) return;

      // Total exhaustion: he collapses wherever he is
      if (state.health < COLLAPSE_BELOW) {
        goToSleep('Collapsed', 'here');
        return;
      }
      const w = worldNow();
      // Once he knows, he takes care of himself; before that, he sometimes tries things by accident
      if (state.hydration < 35 && (knows('water') || Math.random() < 0.08)) { drinkFromLake(); return; }
      if (state.fullness < 35 && (knows('food') || Math.random() < 0.08)) { eatSomething(); return; }
      if ((state.health < 30 || (w.isNight && state.health < 65)) && (knows('sleep') || Math.random() < 0.06)) { goToSleep(); return; }
    }

// Called from the animation loop while he walks: tired legs give way now and then
function maybeStumble(t) {
      if (!keloGroup) return false;
      const now = Date.now();
      if (now < stumbleUntil) {
        const p = 1 - (stumbleUntil - now) / 1600;
        keloGroup.rotation.x = -Math.sin(Math.min(1, p * 1.6) * Math.PI / 2) * (Math.PI / 2.2) * (p < 0.75 ? 1 : (1 - p) * 4);
        return true;
      }
      if (state.isWalking && state.health < STUMBLE_BELOW && now > nextStumbleCheck) {
        nextStumbleCheck = now + 2500;
        if (Math.random() < (STUMBLE_BELOW - state.health) / 40) {
          stumbleUntil = now + 1600;
          state.speechBubble = knows('sleep') ? 'Whoa. I really need sleep.' : 'Whoa! Why do my legs keep giving out?';
          if (typeof renderAllUI === 'function') renderAllUI();
          return true;
        }
      }
      return false;
    }

// Foggy thinking: plans get muddled when he's running on empty
function foggyDecision() {
      const muddles = [
        { title: 'Forgot what I was doing', speech: 'Wait... why did I come over here?' },
        { title: 'Staring at nothing', speech: 'Everything feels slow and far away.' },
        { title: 'Started something and stopped', speech: 'I had a great idea a second ago. It is gone.' }
      ];
      const m = pick(muddles);
      return {
        thought: `"${bodySymptoms().join('; ') || 'My head is cloudy'}..."`,
        actionTitle: m.title,
        emoji: '😵‍💫',
        speech: m.speech,
        diary: `Dear Diary, ${m.speech} ${bodySymptoms().length ? `I noticed ${bodySymptoms().join(' and ')}.` : ''}`,
        destination: Math.random() < 0.5 ? 'stay' : { x: state.botPos.x + randRange(-4, 4), z: state.botPos.z + randRange(-4, 4), placeName: 'somewhere nearby' },
        build: null,
        motion: { headPitch: 0.35, headYawSpeed: 0.6, headTiltAmp: 0.35, armWaveAmp: 0.05, armRaiseOffset: 0.1, bodyBounceAmp: 0.01, spinSpeed: 0, sparkBurst: false },
        vitalsDelta: { happiness: -3, calmLevel: -3 }
      };
    }

function renderNeedsUI() {
      const v = document.getElementById('hudWaterVal');
      const b = document.getElementById('hudWaterBar');
      if (v) v.textContent = `${Math.round(state.hydration)}%`;
      if (b) b.style.width = `${Math.round(state.hydration)}%`;
    }

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    lastNeedsTick = Date.now();
    setInterval(() => { needsTick(); renderNeedsUI(); }, 10000);
    renderNeedsUI();
  }, 0);
});
