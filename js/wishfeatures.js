// Kelo-bot-1 — js/wishfeatures.js
// Loaded right after coderequests.js. The things Kelo-1's code requests can actually switch on.
// Each feature has a key, words that recognise it in a request ("birds and deer in the meadow"
// is wildlife), whether its code exists in this build (ready), and the 3D content it builds.
// When the owner answers a code request "Done", markCodeRequest (js/coderequests.js) asks this
// registry for a match: a match is switched on for real (saved in state.unlockedFeatures, rebuilt
// on every load) and he goes to try it out; no match means the request honestly "Needs new code".
// The features themselves live in js/wildlife.js, js/companions.js and js/pastimes.js.

const WISH_FEATURES = [
  // Order matters for free-form requests: the more specific features are checked first
  { key: 'pet', label: 'A pet dog or cat', emoji: '🐕',
    words: [/\bpets?\b/i, /\bdogs?\b/i, /\bcats?\b/i, /\bpupp(y|ies)\b/i, /\bkitten/i, /\bkitty\b/i, /\banimal (friend|companion|buddy)/i],
    ready: () => typeof buildPet3D === 'function',
    build: () => buildPet3D(),
    run: (label) => playFetch(label),
    chance: () => (state.isSleeping ? 0 : 0.05),
    ai: 'playWithPet', aiHint: 'play fetch with your pet by the house' },
  { key: 'wildlife', label: 'Birds and deer in the valley', emoji: '🦌',
    words: [/\bbirds?\b/i, /\bdeer\b/i, /\banimals?\b/i, /wildlife/i, /\bcritters?\b/i, /\bfawns?\b/i, /songbird/i, /\bflocks?\b/i, /\bherds?\b/i, /\b(robins?|sparrows?|jays?|chickadees?|finch(es)?)\b/i],
    ready: () => typeof buildWildlife3D === 'function',
    build: () => buildWildlife3D(),
    run: (label) => studyWildlife(label),
    chance: () => (typeof worldNow === 'function' && worldNow().isNight ? 0.01 : 0.07),
    ai: 'studyWildlife', aiHint: 'walk quietly up to the deer or birds and study them' },
  { key: 'fishing', label: 'Fishing at the lake', emoji: '🎣',
    words: [/\bfish(ing)?\b/i, /fishing rod/i, /\bangl(e|ing)\b/i, /\btackle\b/i],
    ready: () => typeof goFishing === 'function',
    build: () => {},
    run: (label) => goFishing(label),
    chance: () => (typeof worldNow === 'function' && worldNow().isNight ? 0.01 : 0.05),
    ai: 'goFishing', aiHint: 'go fishing at the lake (eat or release what you catch)' },
  { key: 'cooking', label: 'A stove for cooking real meals', emoji: '🍳',
    words: [/\bcook(ing)?\b/i, /\bstove\b/i, /\bkitchen\b/i, /\bbak(e|ing)\b/i, /\brecipes?\b/i, /\bmeals?\b/i],
    ready: () => typeof buildStove3D === 'function',
    build: () => buildStove3D(),
    run: (label) => cookAMeal(label),
    chance: () => (state.knownNeeds && state.knownNeeds.food && state.fullness < 55 ? 0.12 : 0.03),
    ai: 'cookMeal', aiHint: 'cook a meal at your stove' },
  { key: 'music', label: 'Instruments that make real sounds', emoji: '🎵',
    words: [/\bmusic/i, /\binstruments?\b/i, /\bsounds?\b/i, /\bsongs?\b/i, /\bmelod/i, /hear (my|the) (songs?|music|tunes?)/i, /\btunes?\b/i],
    ready: () => typeof playHobbyMusic === 'function',
    build: () => {},
    run: (label) => playSomeMusic(label),
    chance: () => 0.02,
    ai: 'playMusic', aiHint: 'play music you can really hear' },
  { key: 'swimming', label: 'Swimming lessons', emoji: '🏊',
    words: [/\bswim/i, /\bfloat(ing)?\b/i, /stay afloat/i, /\bpaddl(e|ing)\b/i],
    ready: () => typeof goSwimming === 'function',
    build: () => {},
    run: (label) => goSwimming(label),
    chance: () => (typeof worldNow === 'function' && (worldNow().isNight || worldNow().season === 'Winter') ? 0 : 0.04),
    ai: 'goSwimming', aiHint: 'go for a swim in the lake' },
  { key: 'campfire', label: 'A campfire by the house', emoji: '🔥',
    words: [/campfire/i, /bonfire/i, /fire ?pit/i, /\bfires?\b/i],
    ready: () => typeof buildCampfire3D === 'function',
    build: () => buildCampfire3D(),
    run: (label) => sitByCampfire(label),
    chance: () => (typeof worldNow === 'function' && worldNow().isNight ? 0.2 : 0),
    ai: 'sitByCampfire', aiHint: 'sit by your campfire (it is lit at night)' },
  { key: 'stars', label: 'Named constellations', emoji: '✨',
    words: [/constellation/i, /\bstars?\b/i, /astronom/i, /night sky/i],
    ready: () => typeof learnConstellation === 'function',
    build: () => {},
    run: (label) => learnConstellation(label),
    chance: () => (typeof worldNow === 'function' && worldNow().isNight ? 0.1 : 0),
    ai: 'learnConstellation', aiHint: 'find and name a constellation in the night sky' },
  // Rain belongs to the weather code (js/seasons.js in another branch); only ready once it exists
  { key: 'rain', label: 'Rain', emoji: '🌧️',
    words: [/\brain(y|fall|ing|s)?\b/i, /\bstorms?\b/i, /\bpuddles?\b/i, /\bweather\b/i, /\bshowers?\b/i],
    ready: () => Boolean(rainHook()),
    build: () => {},
    run: () => { const go = rainHook(); if (go) go(); return Promise.resolve(Boolean(go)); },
    chance: () => 0,
    ai: null, aiHint: '' },
  { key: 'friend', label: 'A robot friend who helps', emoji: '🤖',
    words: [/\bfriends?\b/i, /\bhelpers?\b/i, /\bcompanions?\b/i, /\bneighbou?rs?\b/i, /\bbudd(y|ies)\b/i, /\bassistants?\b/i, /another robot/i, /\bsidekick\b/i, /\bpals?\b/i],
    ready: () => typeof buildCompanionBot3D === 'function',
    build: () => buildCompanionBot3D(),
    run: (label) => chatWithCompanion(label),
    chance: () => (state.isSleeping ? 0 : 0.04),
    ai: 'talkToFriend', aiHint: 'spend time talking with your robot friend' }
];

// The built-in wishes (CODE_WISHES in js/coderequests.js) map straight to a feature by key
const CODE_WISH_FEATURE_KEYS = { friends: 'friend' };

// Whatever the weather code calls its "start the rain" function, if it is in this build at all
function rainHook() {
      const names = ['startRain', 'makeItRain', 'beginRain', 'setRaining', 'startRainShower'];
      for (const n of names) if (typeof window[n] === 'function') return () => (n === 'setRaining' ? window[n](true) : window[n]());
      if (typeof window.setWeather === 'function') return () => window.setWeather('rain');
      return null;
    }

function featureOn(key) {
      return Boolean(state.unlockedFeatures && state.unlockedFeatures[key]);
    }

function wishFeatureByKey(key) {
      return WISH_FEATURES.find(f => f.key === key) || null;
    }

// Which feature a code request is asking for, or null. The feature name is checked before the
// reason, so "a pet, because a friend who stays would be nice" is a pet and not a friend.
function wishFeatureFor(req) {
      if (!req) return null;
      const wish = (state.codeWishes || []).find(w => typeof codeWishKey === 'function' && codeWishKey(w.feature) === codeWishKey(req.codeFeature));
      const builtIn = (req.wishKey && CODE_WISHES.some(w => w.key === req.wishKey)) ? req.wishKey
        : (wish && CODE_WISHES.some(w => w.key === wish.key) ? wish.key : null);
      if (builtIn) return wishFeatureByKey(CODE_WISH_FEATURE_KEYS[builtIn] || builtIn);
      for (const text of [req.codeFeature, req.codeWhy]) {
        if (!text) continue;
        const hit = WISH_FEATURES.find(f => f.words.some(re => re.test(text)));
        if (hit) return hit;
      }
      return null;
    }

function wishFeatureReady(feature) {
      try { return Boolean(feature && feature.ready()); } catch (e) { return false; }
    }

// 'ready' (built and waiting to be switched on), 'on' (already switched on) or 'needs-code'
function wishCardStatus(req) {
      const f = wishFeatureFor(req);
      if (!f || !wishFeatureReady(f)) return { status: 'needs-code', feature: f };
      return { status: featureOn(f.key) ? 'on' : 'ready', feature: f };
    }

function wishDiary(time, mood, text, location) {
      state.diaryEntries.unshift({
        time, location: location || currentPlaceLabel(), mood,
        vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text
      });
    }

// Switch a feature on for good: saved, built in 3D right away, and (unless quiet) he goes to try it
function enableWishFeature(key, { req = null, quiet = false, migrated = false } = {}) {
      const f = wishFeatureByKey(key);
      if (!f || !wishFeatureReady(f)) return false;
      if (!state.unlockedFeatures || typeof state.unlockedFeatures !== 'object' || Array.isArray(state.unlockedFeatures)) state.unlockedFeatures = {};
      const text = req ? `${req.codeFeature || ''} ${req.codeWhy || ''}` : '';
      const already = featureOn(key);
      if (!already) {
        const entry = { at: Date.now(), from: req ? req.id : null };
        // The pet is a cat if he asked for a cat, otherwise a dog; companions get a name he picks
        if (key === 'pet') {
          entry.kind = /\bcats?\b|kitten|kitty/i.test(text) ? 'cat' : 'dog';
          entry.name = pick(entry.kind === 'cat' ? ['Mochi', 'Juniper', 'Pepper', 'Saffron', 'Tansy'] : ['Biscuit', 'Okie', 'Maple', 'Pebble', 'Rusty', 'Scout']);
        }
        if (key === 'friend') entry.name = pick(['Pip', 'Bolt', 'Sprocket', 'Nib', 'Tinker', 'Widget', 'Juno', 'Cog']);
        state.unlockedFeatures[key] = entry;
      }
      try { f.build(); } catch (e) { console.warn('Could not build', key, e); }
      if (req) req.featureKey = key;
      if (already) return true;
      const entry = state.unlockedFeatures[key];
      const named = entry.name ? ` I named ${entry.kind ? `my ${entry.kind}` : 'my new friend'} ${entry.name}.` : '';
      wishDiary(migrated ? 'Something New Appeared' : 'Switched On', `${f.emoji} ${f.label}`,
        migrated
          ? `Dear Diary, I looked around today and ${f.label.charAt(0).toLowerCase() + f.label.slice(1)} ${/s\b/.test(f.label.split(' ')[0]) ? 'are' : 'is'} really here now. I asked for this a while ago and my human said it was coded in. Now it truly is.${named}`
          : `Dear Diary, my human switched on ${f.label.charAt(0).toLowerCase() + f.label.slice(1)}. It's really in my world now, not just a promise.${named} I'm going to try it right away.`);
      if (!quiet && f.run) {
        doWhenFree(() => {
          try { Promise.resolve(f.run('Trying Something New')).catch(e => console.warn('Try-out failed:', e)); } catch (e) { console.warn('Try-out failed:', e); }
        });
      }
      savePersistentBrainState();
      return true;
    }

// Rebuild every switched-on feature (on load)
function rebuildWishFeatures() {
      Object.keys(state.unlockedFeatures || {}).forEach(key => {
        const f = wishFeatureByKey(key);
        if (f && wishFeatureReady(f)) { try { f.build(); } catch (e) { console.warn('Could not rebuild', key, e); } }
      });
    }

// Saves from before this update: requests already answered "Coded in" are switched on now, if
// their feature exists. Ones that don't match anything are flagged so the card stays honest.
function migrateCodedInWishes() {
      let changed = false, tried = false;
      (state.requestsToUser || []).forEach(req => {
        if (req.category !== 'code' || !req.fulfilled || req.declined || req.userAnswer !== 'Coded in') return;
        const f = wishFeatureFor(req);
        if (f && wishFeatureReady(f)) {
          // He goes to see the first one for himself; the rest are simply there
          if (!featureOn(f.key)) { enableWishFeature(f.key, { req, quiet: tried, migrated: true }); tried = true; changed = true; }
          if (req.featureKey !== f.key) { req.featureKey = f.key; changed = true; }
          if (req.notBuilt) { delete req.notBuilt; changed = true; }
        } else if (!req.featureKey && !req.notBuilt) {
          req.notBuilt = true;
          changed = true;
        }
      });
      if (changed) savePersistentBrainState();
      return changed;
    }

// "I'll code it": the request stays open as a to-do, and he hears the honest answer
function promiseToCode(id) {
      const req = state.requestsToUser.find(r => r.id === id && r.category === 'code');
      if (!req || req.fulfilled) return;
      req.willCode = true;
      req.promisedAt = Date.now();
      const feature = req.codeFeature.charAt(0).toLowerCase() + req.codeFeature.slice(1);
      state.moodEmoji = '🛠️';
      state.moodTitle = 'Waiting on a promise';
      state.speechBubble = pick([
        `You'll code in ${feature}? I know it isn't in my world yet, so I'll be patient.`,
        `Thank you! It's not here yet, but knowing you're working on it is nice.`,
        `So ${feature} still needs new code. I'll keep an eye out for it.`]);
      state.happiness = Math.min(100, state.happiness + 6);
      state.chatLog.push({ sender: 'Kelo-1', text: state.speechBubble, time: 'Just now', isBot: true });
      wishDiary('A Promise', '🛠️ On my human\'s to-do list',
        `Dear Diary, I asked for ${feature}. My human told me the truth: it isn't in my world yet, it needs new code. They said they'll code it. I'll wait and see.`);
      showToast(`🛠️ Added to your to-do list: ${req.codeFeature}`);
      savePersistentBrainState();
      renderAllUI();
    }

// One line for the AI prompt: what can be switched on today, without ruling out new ideas
function codeRequestHintForAI() {
      const asked = new Set((state.requestsToUser || []).filter(r => r.category === 'code').map(r => (wishFeatureFor(r) || {}).key).filter(Boolean));
      const avail = WISH_FEATURES.filter(f => wishFeatureReady(f) && !featureOn(f.key) && !asked.has(f.key)).map(f => f.label.toLowerCase());
      return avail.length
        ? `your human can switch these on right away: ${avail.join('; ')}. Anything else is welcome too, but needs new code, so it takes longer`
        : 'anything new you wish for needs new code, so it takes your human a while';
    }

// Extra JSON fields for the AI: one way to enjoy each thing that is switched on
function wishFeaturesPromptLines() {
      const on = WISH_FEATURES.filter(f => f.ai && featureOn(f.key) && wishFeatureReady(f));
      if (!on.length) return '';
      return `  "pastime": null OR ${on.map(f => `"${f.ai}"`).join(' | ')} (${on.map(f => `${f.ai}: ${f.aiHint}`).join('; ')}),\n`;
    }

function wishFeaturesSummaryForAI() {
      const on = WISH_FEATURES.filter(f => featureOn(f.key)).map(f => {
        const e = state.unlockedFeatures[f.key];
        return e && e.name ? `${f.label.toLowerCase()} (${e.name})` : f.label.toLowerCase();
      });
      return on.length ? on.join(', ') : 'nothing extra yet';
    }

function applyWishFeatureDecision(decision) {
      const want = decision && typeof decision.pastime === 'string' ? decision.pastime.trim() : '';
      // studyWildlife: true is accepted too
      const f = WISH_FEATURES.find(w => w.ai && (w.ai === want || (decision && decision[w.ai] === true)));
      if (!f || !featureOn(f.key) || !wishFeatureReady(f)) return false;
      doWhenFree(() => { try { Promise.resolve(f.run('Decided to ' + (f.aiHint.split(' (')[0]))).catch(() => {}); } catch (e) {} });
      return true;
    }

// Called from the life tick: now and then he spends time on something that's been switched on
function wishFeatureActivity() {
      const on = WISH_FEATURES.filter(f => featureOn(f.key) && wishFeatureReady(f) && f.run);
      for (const f of on.sort(() => Math.random() - 0.5)) {
        let chance = 0;
        try { chance = f.chance(); } catch (e) {}
        if (Math.random() < chance) {
          try { Promise.resolve(f.run('Own Idea')).catch(e => console.warn('Activity failed:', e)); } catch (e) { console.warn(e); }
          return true;
        }
      }
      return false;
    }

// Every frame from scene.js, before the render: animals, companions, fire, swimming
function updateWishFeatures(t) {
      if (typeof updateWildlife === 'function' && featureOn('wildlife')) updateWildlife(t);
      if (typeof updateCompanionBot === 'function' && featureOn('friend')) updateCompanionBot(t);
      if (typeof updatePetAnimal === 'function' && featureOn('pet')) updatePetAnimal(t);
      if (typeof updatePastimes === 'function') updatePastimes(t);
      // Upgrades he coded himself (js/upgrades.js)
      if (typeof updateWorldUpgrades === 'function') updateWorldUpgrades(t);
    }

window.addEventListener('DOMContentLoaded', () => {
  // After main.js has loaded his memory and built the world
  setTimeout(() => {
    if (!state.unlockedFeatures || typeof state.unlockedFeatures !== 'object' || Array.isArray(state.unlockedFeatures)) state.unlockedFeatures = {};
    rebuildWishFeatures();
    if (migrateCodedInWishes()) renderAllUI();
  }, 0);
});
