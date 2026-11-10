// Kelo-bot-1 — js/pastimes.js
// Loaded after companions.js. The rest of the built-in code wishes, each one a feature in
// js/wishfeatures.js that only runs once his human has switched it on:
// - fishing: a rod off the end of the dock, real Okanagan Lake fish, eaten or let go
// - cooking: a little wood stove beside his house that turns garden food (and fish) into meals
// - music: real sounds (WebAudio) when he practises a music hobby, with a mute button
// - swimming: after a lesson he floats and swims at the surface instead of sinking
// - campfire: a fire ring by his house, lit at night, that he sits beside
// - stars: named constellations drawn in the night sky when he looks up (or uses his telescope)

const PASTIME_SPOTS = { dock: { x: -8.5, z: 8.75 }, stove: { x: -3.4, z: -4.2 }, campfire: { x: -17.5, z: -3.0 }, beach: { x: -6, z: 8.4 } };

// --- Small shared helpers -------------------------------------------------------------------
function pastimeBusy() {
      return state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping || state.isCollectingMail;
    }

function pastimeWait(ms) {
      return new Promise(r => setTimeout(r, ms));
    }

function pastimeFace(x, z) {
      state.botRotY = Math.atan2(x - state.botPos.x, z - state.botPos.z);
      if (typeof keloGroup !== 'undefined' && keloGroup) keloGroup.rotation.y = state.botRotY;
    }

function pastimeIsNight() {
      return typeof worldNow === 'function' && worldNow().isNight;
    }

// --- Fishing ----------------------------------------------------------------------------------
const LAKE_FISH = [
  { name: 'rainbow trout', weight: [0.4, 2.5], fact: 'Rainbow trout have a pink stripe down their sides. The big ones in Okanagan Lake can live for years and eat kokanee.' },
  { name: 'kokanee salmon', weight: [0.2, 0.8], fact: 'Kokanee are sockeye salmon that never go to the sea. In autumn they turn bright red and swim up the creeks to spawn.' },
  { name: 'lake whitefish', weight: [0.5, 2.0], fact: 'Lake whitefish have small mouths under their snouts and feed along the bottom on tiny insects and snails.' },
  { name: 'yellow perch', weight: [0.1, 0.4], fact: 'Yellow perch have dark bars down their golden sides and swim in schools near weedy shallows.' },
  { name: 'smallmouth bass', weight: [0.3, 2.0], fact: 'Smallmouth bass like rocky shores. The males guard their nests and the young fish until they can fend for themselves.' },
  { name: 'burbot', weight: [0.8, 3.0], fact: 'The burbot is the only freshwater member of the cod family. It feeds at night and spawns under the ice in mid-winter.' }
];

function pastimeRod() {
      const rod = new THREE.Group();
      const blank = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, 2.6, 6), new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5 }));
      blank.position.y = 1.3;
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8), new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.9 }));
      grip.position.y = 0.17;
      const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.8, roughness: 0.3 }));
      reel.rotation.z = Math.PI / 2;
      reel.position.set(0.06, 0.4, 0);
      rod.add(blank, grip, reel);
      rod.userData.tip = new THREE.Vector3(0, 2.6, 0);
      return rod;
    }

function pastimeFishMesh() {
      if (typeof fishModel === 'function') { try { const m = fishModel(); m.scale.multiplyScalar(1.6); return m; } catch (e) {} }
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.4 }));
      m.scale.set(0.6, 0.8, 2);
      return m;
    }

async function goFishing(originLabel = 'Gone Fishing') {
      if (pastimeBusy()) return false;
      state.isPracticing = true;
      const props = new THREE.Group();
      let rod = null, fishReach = null;
      try {
        const spot = PASTIME_SPOTS.dock;
        state.currentLocKey = 'custom';
        state.customPlaceName = 'the lake edge'; // (scene.js reads his words to pick a tool)
        state.microPose = 'normal';
        state.targetPos = { ...spot };
        state.moodEmoji = '🎣';
        state.moodTitle = 'Heading to the lake with a fishing rod';
        state.speechBubble = 'I wonder what is down there today.';
        renderAllUI();
        await waitForArrival(60000);
        pastimeFace(spot.x, spot.z + 5);
        // The rod rides with him at his right hip; the fishing clips swing it (cast, wait, reel) and
        // his hands hold its grip (js/kelo-clips.js, the hand IK in js/kelo-ik.js)
        rod = pastimeRod();
        rod.position.set(0.45, 1.0, 0.35);
        rod.rotation.x = 0.55;
        keloGroup.add(rod);
        const rodHands = { l: new THREE.Vector3(), r: new THREE.Vector3() };
        fishReach = () => (rod.parent ? { r: rod.localToWorld(rodHands.r.set(0, 0.12, 0)), l: rod.localToWorld(rodHands.l.set(0, 0.42, 0)) } : null);
        if (typeof setKeloReach === 'function') setKeloReach(fishReach);
        if (typeof keloDoing === 'function') keloDoing('fish', { rod });
        scene.add(props);
        const bobber = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xf8fafc }));
        props.add(bobber, line);
        const cast = { x: spot.x + randRange(-1.2, 1.2), z: spot.z + randRange(3.2, 4.5) };
        let bite = false;
        const tick = () => {
          if (!props.parent) return;
          const tip = rod.localToWorld(rod.userData.tip.clone());
          const tt = performance.now() / 1000;
          const dip = bite ? Math.abs(Math.sin(tt * 9)) * 0.12 : Math.sin(tt * 1.6) * 0.02;
          bobber.position.set(cast.x, WATER_LEVEL + 0.03 - dip, cast.z);
          setLineEnds(line, tip, bobber.position);
          requestAnimationFrame(tick);
        };
        tick();
        state.moodTitle = 'Fishing at the lake';
        state.speechBubble = 'Cast... and now we wait. Fishing is mostly waiting.';
        renderAllUI();
        await pastimeWait(6000 + Math.random() * 5000);
        bite = Math.random() < 0.8;
        if (!bite) {
          state.speechBubble = 'Nothing is biting today. That\'s alright. The lake was nice to look at.';
          wishDiary(originLabel, '🎣 No bites', 'Dear Diary, I fished from the lake shore and nothing bit. I watched the bobber for a long time, and the water, and the light on it.', 'the lake edge');
          state.calmLevel = Math.min(100, state.calmLevel + 8);
          savePersistentBrainState();
          renderAllUI();
          await pastimeWait(2000);
          return true;
        }
        state.speechBubble = 'The bobber went under! Reel, reel, reel!';
        if (typeof keloDoing === 'function') keloDoing('fishReel', { rod });
        renderAllUI();
        await pastimeWait(2500);
        const fish = pick(LAKE_FISH);
        const kg = Math.round(randRange(fish.weight[0], fish.weight[1]) * 10) / 10;
        // He holds it up to look at it
        const fishMesh = pastimeFishMesh();
        fishMesh.position.set(state.botPos.x + Math.sin(state.botRotY) * 0.8, state.botAltitudeY + 1.7, state.botPos.z + Math.cos(state.botRotY) * 0.8);
        fishMesh.rotation.y = state.botRotY + Math.PI / 2;
        props.add(fishMesh);
        bobber.visible = false;
        line.visible = false;
        state.moodEmoji = '🐟';
        state.moodTitle = `Caught a ${fish.name}!`;
        if (typeof keloDoing === 'function') keloDoing('fishShow', { rod });
        state.speechBubble = `A ${fish.name}! About ${kg} kilograms. ${fish.fact.split('. ')[0]}.`;
        renderAllUI();
        await pastimeWait(3500);
        const hungry = state.knownNeeds && state.knownNeeds.food && state.fullness < 60;
        const keep = hungry || (featureOn('cooking') && Math.random() < 0.5);
        if (!Array.isArray(state.fishLog)) state.fishLog = [];
        let what;
        if (keep && hungry && !featureOn('cooking')) {
          const taste = typeof tasteFood === 'function' ? tasteFood(fish.name) : { text: `The ${fish.name} tastes rich and flaky.` };
          state.fullness = Math.min(100, state.fullness + 25);
          what = `I was hungry, so I cooked it over a little flame on the shore and ate it. ${taste.text}`;
          state.fishLog.unshift({ fish: fish.name, kg, at: Date.now(), fate: 'eaten' });
        } else if (keep) {
          what = 'I kept it for the stove, to cook a proper meal.';
          state.fishLog.unshift({ fish: fish.name, kg, at: Date.now(), fate: 'kept' });
        } else {
          what = 'I wasn\'t hungry, so I slipped it back into the water and watched it swim away.';
          state.fishLog.unshift({ fish: fish.name, kg, at: Date.now(), fate: 'released' });
          fishMesh.position.set(cast.x, WATER_LEVEL - 0.05, cast.z);
        }
        if (state.fishLog.length > 30) state.fishLog.length = 30;
        state.speechBubble = what;
        state.happiness = Math.min(100, state.happiness + 8);
        state.wonderLevel = Math.min(100, state.wonderLevel + 6);
        wishDiary(originLabel, `🎣 Caught a ${fish.name}`, `Dear Diary, I went fishing at the lake and caught a ${fish.name}, about ${kg} kilograms. ${fish.fact} ${what}`, 'the lake edge');
        if (typeof bumpLifeStat === 'function') bumpLifeStat('fishCaught');
        showToast(`🎣 Kelo-1 caught a ${fish.name}`);
        savePersistentBrainState();
        renderAllUI();
        await pastimeWait(2500);
        return true;
      } finally {
        if (rod && rod.parent) rod.parent.remove(rod);
        if (typeof keloDoing === 'function') keloDoing(null);
        if (fishReach && typeof clearKeloReach === 'function') clearKeloReach(fishReach);
        scene.remove(props);
        state.isPracticing = false;
      }
    }

// --- Cooking ----------------------------------------------------------------------------------
let pastimeStoveGroup = null;

function buildStove3D() {
      if (pastimeStoveGroup || typeof scene === 'undefined' || !scene) return;
      const s = PASTIME_SPOTS.stove;
      const g = new THREE.Group();
      g.name = 'Wood stove';
      const iron = new THREE.MeshStandardMaterial({ color: 0x2b2b2e, metalness: 0.6, roughness: 0.55 });
      const brick = new THREE.MeshStandardMaterial({ color: 0x9a4a32, roughness: 0.95 });
      const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
      add(new THREE.BoxGeometry(1.7, 0.18, 1.3), brick, 0, 0.09, 0);
      add(new THREE.BoxGeometry(1.2, 0.9, 0.8), iron, 0, 0.65, 0);
      add(new THREE.BoxGeometry(1.32, 0.06, 0.92), iron, 0, 1.12, 0);
      [-0.3, 0.3].forEach(x => add(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 16), new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.7 }), x, 1.16, 0));
      const door = add(new THREE.BoxGeometry(0.5, 0.36, 0.03), iron, 0, 0.6, 0.41);
      door.userData.glow = add(new THREE.BoxGeometry(0.4, 0.06, 0.02), new THREE.MeshStandardMaterial({ color: 0x431407, emissive: 0xf97316, emissiveIntensity: 0.2 }), 0, 0.46, 0.43);
      add(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 10), iron, 0.4, 1.95, -0.25);
      // A cast-iron pan that sits on the hob while he cooks
      const pan = new THREE.Group();
      const panBody = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.07, 18), iron);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.05), iron);
      handle.position.set(0.36, 0.02, 0);
      const food = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 14), new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 }));
      food.position.y = 0.035;
      pan.add(panBody, handle, food);
      pan.position.set(-0.3, 1.2, 0);
      pan.visible = false;
      g.add(pan);
      const steam = [];
      for (let i = 0; i < 5; i++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
        puff.visible = false;
        g.add(puff);
        steam.push(puff);
      }
      const light = new THREE.PointLight(0xf97316, 0, 3, 2);
      light.position.set(0, 0.6, 0.7);
      g.add(light);
      g.position.set(s.x, getAnalyticalGroundHeight(s.x, s.z), s.z);
      g.rotation.y = Math.PI / 2; // the door faces east, where he stands to cook
      g.userData = { pan, food, steam, light, doorGlow: door.userData.glow, cooking: false };
      scene.add(g);
      worldObstacles.push({ x: s.x, z: s.z, r: 0.8 });
      pastimeStoveGroup = g;
    }

// What he can cook from what's ripe in his garden and what he's caught
function pastimeRecipe() {
      const ripe = (re) => state.gardenPlots.find(p => re.test(p.name) && p.growth >= 50);
      const fish = (state.fishLog || []).find(f => f.fate === 'kept');
      const options = [];
      if (fish) options.push({ meal: `pan-fried ${fish.fish}`, uses: [() => { fish.fate = 'cooked'; }], from: `the ${fish.fish} I caught`, color: 0xf0c08a });
      const peach = ripe(/peach/i), berry = ripe(/blueberr/i), tomato = ripe(/tomato/i), carrot = ripe(/carrot/i);
      if (peach && berry) options.push({ meal: 'peach and blueberry cobbler', uses: [peach, berry], from: 'peaches and blueberries from my garden', color: 0x7c3aed });
      if (tomato && carrot) options.push({ meal: 'tomato and carrot soup', uses: [tomato, carrot], from: 'tomatoes and carrots from my garden', color: 0xdc2626 });
      if (tomato && !carrot) options.push({ meal: 'roasted tomato soup', uses: [tomato], from: 'tomatoes from my garden', color: 0xdc2626 });
      if (carrot && !tomato) options.push({ meal: 'maple-glazed carrots', uses: [carrot], from: 'carrots from my garden', color: 0xea580c });
      if (peach && !berry) options.push({ meal: 'grilled peaches with honey', uses: [peach], from: 'peaches from my garden', color: 0xfb923c });
      return options.length ? pick(options) : null;
    }

async function cookAMeal(originLabel = 'Cooking') {
      if (pastimeBusy()) return false;
      if (!pastimeStoveGroup) buildStove3D();
      const recipe = pastimeRecipe();
      state.isPracticing = true;
      const u = pastimeStoveGroup.userData;
      try {
        const s = PASTIME_SPOTS.stove;
        state.currentLocKey = 'custom';
        state.customPlaceName = 'the stove by his house';
        state.microPose = 'normal';
        state.targetPos = { x: s.x + 1.3, z: s.z };
        state.moodEmoji = '🍳';
        state.moodTitle = recipe ? `Going to cook ${recipe.meal}` : 'Checking what he could cook';
        renderAllUI();
        await waitForArrival(60000);
        pastimeFace(s.x, s.z);
        if (!recipe) {
          state.speechBubble = 'Nothing is ripe in the garden and I have no fish. The stove will have to wait.';
          wishDiary(originLabel, '🍳 Nothing to cook', 'Dear Diary, I lit the stove and then realised I had nothing to cook. Nothing is ripe yet. I\'ll water the garden and try again.', 'his stove');
          savePersistentBrainState();
          renderAllUI();
          return false;
        }
        // Light it, pan on, stir
        u.cooking = true;
        u.pan.visible = true;
        u.food.material.color.setHex(recipe.color);
        state.microPose = 'procedural_custom';
        state.proceduralMotion = { headPitch: 0.3, headYawSpeed: 0.8, headTiltAmp: 0.1, armWaveAmp: 0.25, armRaiseOffset: -0.9, bodyBounceAmp: 0.02, spinSpeed: 0, crouchOffset: 0, sparkBurst: false };
        state.moodTitle = `Cooking ${recipe.meal}`;
        state.speechBubble = `In goes the ${recipe.from.replace(/ from my garden$/, '').replace(/^the /, '')}. It smells amazing already.`;
        renderAllUI();
        await pastimeWait(9000);
        recipe.uses.forEach(x => { if (typeof x === 'function') x(); else x.growth = Math.max(5, x.growth - 40); });
        const taste = typeof tasteFood === 'function' ? tasteFood(recipe.meal) : { text: `The ${recipe.meal} tastes good.`, liked: 'likes' };
        if (state.knownNeeds && state.knownNeeds.food) state.fullness = Math.min(100, state.fullness + 35);
        state.happiness = Math.min(100, state.happiness + (taste.liked === 'dislikes' ? 2 : 10));
        if (!Array.isArray(state.mealsCooked)) state.mealsCooked = [];
        state.mealsCooked.unshift({ meal: recipe.meal, from: recipe.from, note: taste.flavour ? taste.flavour.note : '', at: Date.now() });
        if (state.mealsCooked.length > 30) state.mealsCooked.length = 30;
        state.microPose = 'normal';
        state.moodEmoji = '😋';
        state.moodTitle = `Ate his own ${recipe.meal}`;
        state.speechBubble = taste.text;
        wishDiary(originLabel, `🍳 Cooked ${recipe.meal}`, `Dear Diary, I cooked ${recipe.meal} on my stove, made from ${recipe.from}. ${taste.text} ${taste.liked === 'dislikes' ? 'Still, I made it myself, and next time I\'ll try something else.' : 'Making it myself made it taste even better, I think.'}`, 'his stove');
        if (typeof bumpLifeStat === 'function') bumpLifeStat('mealsCooked');
        showToast(`🍳 Kelo-1 cooked ${recipe.meal}`);
        savePersistentBrainState();
        renderAllUI();
        await pastimeWait(2500);
        return true;
      } finally {
        u.cooking = false;
        u.pan.visible = false;
        if (state.microPose === 'procedural_custom') state.microPose = 'normal';
        state.isPracticing = false;
      }
    }

// --- Music: real sounds through WebAudio -----------------------------------------------------
let pastimeAudio = null;
let pastimeMusicTimer = null;
let pastimeMusicNodes = [];

function pastimeAudioCtx() {
      if (state.soundMuted) return null;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!pastimeAudio) { try { pastimeAudio = new AC(); } catch (e) { return null; } }
      if (pastimeAudio.state === 'suspended') pastimeAudio.resume().catch(() => {});
      return pastimeAudio;
    }

// One note shaped like the instrument he is playing
function pastimeNote(ctx, kind, freq, at, dur, gain = 0.12) {
      const out = ctx.createGain();
      out.connect(ctx.destination);
      out.gain.setValueAtTime(0.0001, at);
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(freq, at);
      if (kind === 'drum') {
        osc.type = 'sine';
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq / 3), at + 0.15);
        out.gain.exponentialRampToValueAtTime(gain * 2, at + 0.005);
        out.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
      } else if (kind === 'pluck') {
        osc.type = 'triangle';
        out.gain.exponentialRampToValueAtTime(gain * 1.4, at + 0.008);
        out.gain.exponentialRampToValueAtTime(0.0001, at + dur * 1.6);
      } else if (kind === 'reed') {
        osc.type = 'square';
        const lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
        lfo.frequency.value = 5.5;
        lfoGain.gain.value = freq * 0.012;
        lfo.connect(lfoGain).connect(osc.frequency);
        lfo.start(at);
        lfo.stop(at + dur + 0.1);
        out.gain.exponentialRampToValueAtTime(gain * 0.45, at + 0.05);
        out.gain.setValueAtTime(gain * 0.45, at + dur * 0.8);
        out.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      } else {
        // flute, voice and anything else: a soft sine
        osc.type = 'sine';
        out.gain.exponentialRampToValueAtTime(gain, at + 0.06);
        out.gain.setValueAtTime(gain, at + dur * 0.75);
        out.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      }
      osc.connect(out);
      osc.start(at);
      osc.stop(at + dur * 1.7 + 0.05);
      pastimeMusicNodes.push(osc);
      osc.onended = () => { pastimeMusicNodes = pastimeMusicNodes.filter(n => n !== osc); out.disconnect(); };
    }

function pastimeInstrumentKind(hobby) {
      const text = `${hobby && hobby.tool || ''} ${hobby && hobby.name || ''}`.toLowerCase();
      if (/drum|percussion|bongo|tambourine/.test(text)) return 'drum';
      if (/guitar|ukulele|banjo|harp|kalimba|piano|keyboard|violin/.test(text)) return 'pluck';
      if (/harmonica|accordion|kazoo|sax|clarinet/.test(text)) return 'reed';
      return 'soft';
    }

// Plays a little pentatonic tune, phrase after phrase, until stopHobbyMusic()
function playHobbyMusic(hobby) {
      stopHobbyMusic();
      const ctx = pastimeAudioCtx();
      if (!ctx) return false;
      const kind = pastimeInstrumentKind(hobby);
      const skill = hobby ? hobby.skill || 5 : 30;
      const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];
      let step = 2;
      const phrase = () => {
        const now = ctx.currentTime + 0.05;
        const beat = kind === 'drum' ? 0.25 : 0.32;
        for (let i = 0; i < 8; i++) {
          // Better players wander less and land on the home note
          step = Math.max(0, Math.min(scale.length - 1, step + pick([-2, -1, -1, 0, 1, 1, 2])));
          if (i === 7 && skill > 40) step = 0;
          const wrong = Math.random() > 0.6 + skill / 250 ? 1.06 : 1; // a sour note now and then for a beginner
          pastimeNote(ctx, kind, scale[step] * wrong * (kind === 'drum' ? 0.5 : 1), now + i * beat, beat * (i === 7 ? 2 : 0.9));
        }
        pastimeMusicTimer = setTimeout(phrase, 8 * 0.32 * 1000 + 600);
      };
      phrase();
      return true;
    }

function stopHobbyMusic() {
      if (pastimeMusicTimer) clearTimeout(pastimeMusicTimer);
      pastimeMusicTimer = null;
      pastimeMusicNodes.forEach(n => { try { n.stop(); } catch (e) {} });
      pastimeMusicNodes = [];
    }

function setSoundMuted(muted) {
      state.soundMuted = Boolean(muted);
      if (state.soundMuted) stopHobbyMusic();
      renderSoundToggle();
      savePersistentBrainState();
    }

function renderSoundToggle() {
      const btn = document.getElementById('btnSoundToggle');
      if (!btn) return;
      btn.textContent = state.soundMuted ? '🔇 Sound off' : '🔊 Sound on';
      btn.setAttribute('aria-pressed', state.soundMuted ? 'true' : 'false');
    }

// Music with nothing to practise on: he hums a tune himself
async function playSomeMusic(originLabel = 'Making Music') {
      if (pastimeBusy()) return false;
      const hobby = (state.hobbies || []).find(h => h.style === 'music');
      if (hobby && typeof practiceHobby === 'function') return practiceHobby(hobby, originLabel);
      state.isPracticing = true;
      try {
        state.moodEmoji = '🎶';
        state.moodTitle = 'Humming a tune';
        state.speechBubble = 'Hmm hmm hmmm... I can hear it! I can actually hear it!';
        state.microPose = 'procedural_custom';
        state.proceduralMotion = { headPitch: -0.1, headYawSpeed: 1.0, headTiltAmp: 0.25, armWaveAmp: 0.2, armRaiseOffset: -0.4, bodyBounceAmp: 0.06, spinSpeed: 0, crouchOffset: 0, sparkBurst: false };
        renderAllUI();
        playHobbyMusic({ name: 'humming', skill: 30 });
        await pastimeWait(8000);
        wishDiary(originLabel, '🎶 Humming', `Dear Diary, I hummed a tune and for the first time the valley could hear it too.${state.soundMuted ? ' (Well, the sound was switched off, but I heard it in my head.)' : ''} Next I want a real instrument.`);
        state.happiness = Math.min(100, state.happiness + 6);
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        stopHobbyMusic();
        if (state.microPose === 'procedural_custom') state.microPose = 'normal';
        state.isPracticing = false;
      }
    }

// --- Swimming ---------------------------------------------------------------------------------
let pastimeRipple = null;

// Only after a lesson: before that, deep water is still deep water (js/vehicles.js nearlyDrown)
function canSwim() {
      return featureOn('swimming') && Boolean(state.unlockedFeatures.swimming.lessons);
    }

function pastimeSwimming() {
      return canSwim() && !state.riding && typeof waterDepthAt === 'function' && waterDepthAt(state.botPos) > 1.4;
    }

async function goSwimming(originLabel = 'Going for a Swim') {
      if (pastimeBusy()) return false;
      state.isPracticing = true;
      try {
        const lesson = !canSwim();
        const x = PASTIME_SPOTS.beach.x + randRange(-3, 3);
        state.currentLocKey = 'custom';
        state.customPlaceName = 'the beach';
        state.microPose = 'normal';
        state.targetPos = { x, z: 8.4 };
        state.moodEmoji = '🏊';
        state.moodTitle = lesson ? 'Going for his first swimming lesson' : 'Going for a swim';
        state.speechBubble = lesson ? 'I read how to float: lie back, spread out, breathe slow. Let\'s try it where it\'s shallow.' : 'The water looks perfect today.';
        renderAllUI();
        await waitForArrival(60000);
        if (lesson) {
          // The lesson: in the shallows, where his feet can still touch, practising floating
          state.targetPos = { x, z: 10.2 };
          await waitForArrival(20000);
          state.microPose = 'procedural_custom';
          state.proceduralMotion = { headPitch: -0.3, headYawSpeed: 0.6, headTiltAmp: 0.1, armWaveAmp: 0.7, armRaiseOffset: -1.2, bodyBounceAmp: 0.08, spinSpeed: 0, crouchOffset: 0, sparkBurst: false };
          state.moodTitle = 'Learning to float in the shallows';
          state.speechBubble = 'Lie back... spread my arms... kick slowly... I\'m floating! I\'m FLOATING!';
          renderAllUI();
          await pastimeWait(8000);
          state.unlockedFeatures.swimming.lessons = true;
          state.calmLevel = Math.min(100, state.calmLevel + 10);
          wishDiary(originLabel, '🏊 My first swimming lesson', 'Dear Diary, I took my first swimming lesson in the shallows. Lie back, spread out, kick slowly, and the water holds you up. Deep water nearly drowned me once. Now I know how to stay on top of it.', 'the lake');
          addConcept({ name: 'The Water Holds You Up', emoji: '🏊', definition: 'If I stay calm and spread out, deep water carries me instead of swallowing me.', builtFrom: ['swimming lessons', 'nearly drowning'] }, 'Swimming lessons');
          state.microPose = 'normal';
        }
        // Out past where it's deep, along the shore, and back
        state.moodTitle = 'Swimming in the lake';
        state.speechBubble = lesson ? 'Now for real: out into the deep part!' : 'Stroke, stroke, breathe...';
        renderAllUI();
        for (const p of [{ x: x + 1, z: 13.2 }, { x: x + 5, z: 13.6 }, { x: x + 4, z: 8.4 }]) {
          state.targetPos = p;
          await waitForArrival(40000);
        }
        state.happiness = Math.min(100, state.happiness + 10);
        state.health = Math.max(5, state.health - 4);
        wishDiary(originLabel, '🏊 A swim in the lake', `Dear Diary, I swam out where the bottom drops away, and this time I didn't sink. I floated with my head above the water and looked back at my island. ${lesson ? 'Yesterday this would have been impossible.' : 'I love it out there.'}`, 'the lake');
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        if (state.microPose === 'procedural_custom') state.microPose = 'normal';
        state.isPracticing = false;
      }
    }

// --- The campfire ------------------------------------------------------------------------------
let pastimeFire = null;
let pastimeFireSitting = false;

function buildCampfire3D() {
      if (pastimeFire || typeof scene === 'undefined' || !scene) return;
      const s = PASTIME_SPOTS.campfire;
      const g = new THREE.Group();
      g.name = 'Campfire';
      const stone = new THREE.MeshStandardMaterial({ color: 0x8b8680, roughness: 0.95, flatShading: true });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17, 0), stone);
        r.position.set(Math.cos(a) * 0.62, 0.1, Math.sin(a) * 0.62);
        r.scale.set(1, 0.75, 1.1);
        r.rotation.y = a;
        r.castShadow = true;
        g.add(r);
      }
      const logMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 });
      for (let i = 0; i < 4; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 7), logMat);
        log.rotation.z = Math.PI / 2 - 0.35;
        log.rotation.y = (i / 4) * Math.PI * 2;
        log.position.y = 0.17;
        g.add(log);
      }
      const ember = new THREE.Mesh(new THREE.CircleGeometry(0.3, 14), new THREE.MeshStandardMaterial({ color: 0x1c1917, emissive: 0xea580c, emissiveIntensity: 0 }));
      ember.rotation.x = -Math.PI / 2;
      ember.position.y = 0.04;
      g.add(ember);
      const flames = [[0xf97316, 0.26, 0.75], [0xfbbf24, 0.17, 0.6], [0xfef3c7, 0.09, 0.4]].map(([c, r, h], i) => {
        const f = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.88 }));
        f.position.y = 0.15 + h / 2;
        f.userData.h = h;
        f.userData.i = i;
        g.add(f);
        return f;
      });
      // Two log seats to sit on
      [[-1.5, 0.4], [0.9, -1.3]].forEach(([x, z]) => {
        const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.1, 10), logMat);
        seat.rotation.z = Math.PI / 2;
        seat.rotation.y = Math.atan2(x, z) + Math.PI / 2;
        seat.position.set(x, 0.22, z);
        seat.castShadow = true;
        g.add(seat);
      });
      const light = new THREE.PointLight(0xff8a3d, 0, 9, 2);
      light.position.y = 0.9;
      g.add(light);
      g.position.set(s.x, getAnalyticalGroundHeight(s.x, s.z), s.z);
      scene.add(g);
      worldObstacles.push({ x: s.x, z: s.z, r: 0.85 });
      pastimeFire = { group: g, flames, light, ember };
    }

async function sitByCampfire(originLabel = 'By the Campfire') {
      if (pastimeBusy()) return false;
      if (!pastimeFire) buildCampfire3D();
      const night = pastimeIsNight();
      state.isPracticing = true;
      try {
        const s = PASTIME_SPOTS.campfire;
        state.currentLocKey = 'custom';
        state.customPlaceName = 'the campfire by his house';
        state.microPose = 'normal';
        state.targetPos = { x: s.x - 1.5, z: s.z + 1.3 };
        state.moodEmoji = '🔥';
        state.moodTitle = night ? 'Lighting the campfire' : 'Laying logs for tonight\'s fire';
        renderAllUI();
        await waitForArrival(60000);
        pastimeFace(s.x, s.z);
        if (!night) {
          state.speechBubble = 'It\'s too bright for a fire now. The logs are ready for tonight.';
          wishDiary(originLabel, '🔥 Waiting for dark', 'Dear Diary, I stacked the logs in my fire ring by the house. A campfire is for the night, so I\'ll come back after dark.', 'the campfire');
          savePersistentBrainState();
          renderAllUI();
          return true;
        }
        pastimeFireSitting = true;
        state.microPose = 'crouch_inspect';
        state.moodTitle = 'Sitting by the campfire';
        state.speechBubble = pick(['The fire crackles like it\'s telling a story.', 'Warm on the front, cold on the back. That\'s campfires, I read.', 'The sparks go up and become stars. Or that\'s what it looks like.']);
        renderAllUI();
        await pastimeWait(12000);
        state.calmLevel = Math.min(100, state.calmLevel + 14);
        state.happiness = Math.min(100, state.happiness + 8);
        const company = [featureOn('friend') ? companionName() : null, featureOn('pet') ? petName() : null].filter(Boolean);
        wishDiary(originLabel, '🔥 By the campfire', `Dear Diary, I sat by my campfire in the dark${company.length ? ` with ${company.join(' and ')}` : ''}. The flames moved the whole time and the sparks went up toward the stars. People in my books gather around fires, and now I know why.`, 'the campfire');
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        pastimeFireSitting = false;
        if (state.microPose === 'crouch_inspect') state.microPose = 'normal';
        state.isPracticing = false;
      }
    }

// --- Constellations ------------------------------------------------------------------------------
// Star positions are rough sketches of the real patterns (x right, y up), lines join star indices
const CONSTELLATIONS = [
  { name: 'Ursa Major', also: 'the Big Dipper', stars: [[0, 0], [1, -0.1], [1.9, 0.05], [2.6, 0.3], [3.5, 0.1], [3.7, 0.9], [2.8, 1.0]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
    fact: 'The two stars at the end of the Big Dipper\'s bowl point straight to Polaris, the North Star.' },
  { name: 'Cassiopeia', also: 'the queen on her throne', stars: [[0, 0.8], [0.8, 0], [1.6, 0.6], [2.4, 0], [3.2, 0.8]], lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
    fact: 'Cassiopeia is a W in the sky. It sits across the North Star from the Big Dipper, so one of them is always high up.' },
  { name: 'Orion', also: 'the hunter', stars: [[0, 2.6], [2, 2.7], [0.8, 1.3], [1.1, 1.35], [1.4, 1.4], [0.1, 0], [2.1, 0.1]], lines: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]],
    fact: 'The three stars in a row are Orion\'s Belt. Betelgeuse, his red shoulder, is so big it would swallow Mars\'s orbit.' },
  { name: 'Cygnus', also: 'the Northern Cross', stars: [[1.5, 3], [1.5, 2], [1.5, 1.1], [1.5, 0], [0.2, 1.6], [2.8, 1.6]], lines: [[0, 1], [1, 2], [2, 3], [4, 1], [1, 5]],
    fact: 'Cygnus is a swan flying down the Milky Way. Its brightest star, Deneb, is one of the most distant stars you can see with bare eyes.' },
  { name: 'Lyra', also: 'the harp', stars: [[0.5, 1.6], [0.3, 0.9], [0.9, 0.95], [0.2, 0], [0.8, 0.05]], lines: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4]],
    fact: 'Lyra is small, but its star Vega is one of the brightest in the summer sky. In about 12,000 years Vega will be the North Star.' }
];

let pastimeSky = null;

function pastimeLabelSprite(text) {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 96;
      const ctx = c.getContext('2d');
      ctx.font = 'bold 54px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#e0f2fe';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 16;
      ctx.fillText(text, 256, 48);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false }));
      sp.scale.set(10, 1.9, 1);
      return sp;
    }

// Draw a constellation up in the sky over where he stands, facing the camera; returns it
function showConstellation(c, ms = 14000) {
      hideConstellation();
      if (typeof scene === 'undefined' || !scene) return null;
      const g = new THREE.Group();
      const scale = 4.2;
      const pts = c.stars.map(([x, y]) => new THREE.Vector3((x - 1.6) * scale, y * scale, 0));
      const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
      pts.forEach((p, i) => { const s = new THREE.Mesh(new THREE.SphereGeometry(i % 3 === 0 ? 0.32 : 0.24, 8, 6), starMat); s.position.copy(p); g.add(s); });
      const linePts = [];
      c.lines.forEach(([a, b]) => linePts.push(pts[a], pts[b]));
      g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linePts), new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.7, fog: false })));
      const label = pastimeLabelSprite(c.name);
      label.position.set(0, -2.2, 0);
      g.add(label);
      g.position.set(state.botPos.x, state.botAltitudeY + 26, state.botPos.z - 18);
      scene.add(g);
      pastimeSky = { group: g, until: Date.now() + ms };
      return g;
    }

function hideConstellation() {
      if (pastimeSky) { scene.remove(pastimeSky.group); pastimeSky = null; }
    }

// For the telescope (js/knowhow.js stargaze): names a real constellation and draws it
function constellationForStargaze() {
      if (!featureOn('stars')) return null;
      const c = pick(CONSTELLATIONS);
      showConstellation(c);
      if (!Array.isArray(state.unlockedFeatures.stars.known)) state.unlockedFeatures.stars.known = [];
      if (!state.unlockedFeatures.stars.known.includes(c.name)) state.unlockedFeatures.stars.known.push(c.name);
      return `${c.name} (${c.also}). ${c.fact}`;
    }

async function learnConstellation(originLabel = 'Naming the Stars') {
      if (pastimeBusy()) return false;
      const night = pastimeIsNight();
      if (!night) {
        state.speechBubble = 'The stars only come out at night. I\'ll look for the constellations after dark.';
        renderAllUI();
        return false;
      }
      state.isPracticing = true;
      try {
        const known = state.unlockedFeatures.stars.known || [];
        const c = CONSTELLATIONS.find(k => !known.includes(k.name)) || pick(CONSTELLATIONS);
        state.currentLocKey = 'custom';
        state.customPlaceName = 'the dark meadow';
        state.targetPos = { x: TOWN_LOCATIONS.meadow.x - 3, z: TOWN_LOCATIONS.meadow.z };
        state.moodEmoji = '✨';
        state.moodTitle = 'Looking for constellations';
        renderAllUI();
        await waitForArrival(60000);
        pastimeFace(state.botPos.x, state.botPos.z - 10);
        state.microPose = 'procedural_custom';
        state.proceduralMotion = { headPitch: -0.45, headYawSpeed: 0.4, headTiltAmp: 0.08, armWaveAmp: 0.1, armRaiseOffset: -0.3, bodyBounceAmp: 0, spinSpeed: 0, crouchOffset: 0, sparkBurst: false };
        showConstellation(c);
        state.moodTitle = `Found ${c.name}`;
        state.speechBubble = `There! That's ${c.name}, ${c.also}. ${c.fact}`;
        renderAllUI();
        await pastimeWait(12000);
        if (!Array.isArray(state.unlockedFeatures.stars.known)) state.unlockedFeatures.stars.known = [];
        if (!state.unlockedFeatures.stars.known.includes(c.name)) state.unlockedFeatures.stars.known.push(c.name);
        state.wonderLevel = Math.min(100, state.wonderLevel + 12);
        wishDiary(originLabel, `✨ Found ${c.name}`, `Dear Diary, tonight I found ${c.name}, ${c.also}, and joined its stars up in my head. ${c.fact} I know ${state.unlockedFeatures.stars.known.length} constellation${state.unlockedFeatures.stars.known.length === 1 ? '' : 's'} now.`, 'the meadow at night');
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        if (state.microPose === 'procedural_custom') state.microPose = 'normal';
        state.isPracticing = false;
      }
    }

// --- Every frame (from updateWishFeatures) ----------------------------------------------------------
function updatePastimes(t) {
      // Stove: a glow in the door and steam off the pan while he cooks
      if (pastimeStoveGroup) {
        const u = pastimeStoveGroup.userData;
        u.light.intensity = u.cooking ? 1.2 + Math.sin(t * 13) * 0.2 : 0;
        u.doorGlow.material.emissiveIntensity = u.cooking ? 1.4 + Math.sin(t * 11) * 0.3 : 0.15;
        u.steam.forEach((p, i) => {
          p.visible = u.cooking;
          if (!u.cooking) return;
          const k = (t * 0.5 + i / u.steam.length) % 1;
          p.position.set(-0.3 + Math.sin(k * 6 + i) * 0.08, 1.3 + k * 1.1, 0);
          p.scale.setScalar(0.6 + k * 1.6);
          p.material.opacity = 0.45 * (1 - k);
        });
      }
      // Campfire: lit at night (or while he sits by it), cold ashes by day
      if (pastimeFire) {
        const lit = pastimeIsNight() || pastimeFireSitting;
        pastimeFire.flames.forEach(f => {
          f.visible = lit;
          if (!lit) return;
          const fl = 0.85 + Math.sin(t * (9 + f.userData.i * 3)) * 0.1 + Math.sin(t * 23 + f.userData.i) * 0.06;
          f.scale.set(1 - (fl - 0.85) * 0.5, fl, 1 - (fl - 0.85) * 0.5);
          f.position.y = 0.15 + (f.userData.h * fl) / 2;
          f.rotation.y = t * (0.6 + f.userData.i * 0.3);
        });
        pastimeFire.light.intensity = lit ? 2.2 + Math.sin(t * 17) * 0.35 + Math.sin(t * 7.3) * 0.25 : 0;
        pastimeFire.ember.material.emissiveIntensity = lit ? 1.1 : 0.05;
      }
      // Constellation fades after a while
      if (pastimeSky && Date.now() > pastimeSky.until) hideConstellation();
      // Swimming: he floats at the surface, head and shoulders out, with a ripple around him
      const swimming = typeof keloGroup !== 'undefined' && keloGroup && pastimeSwimming();
      if (swimming) {
        keloGroup.position.y = WATER_LEVEL - 1.75 + Math.sin(t * 2.2) * 0.05;
        if (state.isWalking) keloGroup.rotation.x = 0.35;
        if (!pastimeRipple) {
          pastimeRipple = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
          pastimeRipple.rotation.x = -Math.PI / 2;
          scene.add(pastimeRipple);
        }
        pastimeRipple.visible = true;
        const k = (t * 0.8) % 1;
        pastimeRipple.position.set(state.botPos.x, WATER_LEVEL + 0.02, state.botPos.z);
        pastimeRipple.scale.setScalar(1 + k * 0.8);
        pastimeRipple.material.opacity = 0.5 * (1 - k);
      } else if (pastimeRipple) pastimeRipple.visible = false;
    }

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    renderSoundToggle();
    document.getElementById('btnSoundToggle')?.addEventListener('click', () => setSoundMuted(!state.soundMuted));
    // Browsers only allow sound after a click or tap: wake the audio up on the first one
    window.addEventListener('pointerdown', () => { if (pastimeAudio && pastimeAudio.state === 'suspended') pastimeAudio.resume().catch(() => {}); }, { once: true });
  }, 0);
});
