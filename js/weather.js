// Kelo-bot-1 — js/weather.js
// Loaded after wind.js. Rain and ice.
//   - Rain: spring brings showers (worked out from his calendar like the wind, so a reload agrees).
//     You see streaks of rain, darker skies, the ground goes dark and glossy, and puddles collect.
//     It soaks his plantings and garden beds, so they grow faster. The first shower is a discovery;
//     after that he either enjoys it or heads indoors, and he may ask for an umbrella.
//   - Ice: in winter the lake freezes over, thin at first, thickest mid-winter, rotten near spring.
//     He won't step onto it until he has found out it is safe: he looks at it from the shore, reads
//     up at NetNode (ice holds a person once it is about 10 cm thick), then drills a test hole near the
//     shore each winter and measures. Only then does he walk out on it. Open water is still deadly:
//     where there is no ice (or it has thawed under him) he sinks, as before (js/vehicles.js).

const ICE_SAFE_CM = 10;   // what he reads: clear lake ice this thick holds a person
const ICE_HOLDS_CM = 5;   // what the ice really holds: thinner than this and he goes through
const RAIN_GROWTH = 2;    // rain makes plantings grow this much faster on top of their own pace
const ICE_Y = typeof WATER_LEVEL === 'number' ? WATER_LEVEL + 0.035 : -0.145;

// For testing or a visitor's preview: true / false forces rain on or off (js/tryit.js)
let rainOverride = null;
let rainfall = null;
let puddleGroup = null;
let iceSheet = null;
let iceHoleMesh = null;
let rainShown = 0;   // eased 0..1: how hard it is raining on screen
let wetShown = 0;    // eased 0..1: how wet the ground looks (dries slower than the rain stops)
let iceTesting = false;
let lastRainReaction = 0;
let lastIceEdgeNote = 0;
let weatherApplied = { rain: -1, ice: -1 };

// --- Working out the weather -------------------------------------------------------------------
// Spring: about half the days are showery, and on those days most hours have rain
function rainForHour(hourIndex) {
      const day = Math.floor(hourIndex / 24);
      const hash = typeof windHash === 'function' ? windHash : (n => ((Math.sin(n * 12.9898) * 43758.5453) % 1 + 1) % 1);
      return hash(7000003 + day) < 0.5 && hash(7100003 + hourIndex) < 0.6;
    }

function isRaining() {
      if (rainOverride !== null) return rainOverride;
      const w = typeof worldNow === 'function' ? worldNow() : null;
      if (!w || w.season !== 'Spring') return false;
      return rainForHour((w.day - 1) * 24 + Math.floor(w.hour));
    }

// How thick the lake ice is today, in centimetres: it forms in the first weeks of winter, is
// thickest in the middle and rots in the last weeks before spring
function iceThicknessCm(w = worldNow()) {
      if (w.season !== 'Winter') return 0;
      const d = (w.dayOfYear - 1 - 355 + 365) % 365; // days since winter began
      if (d > 89) return 30; // a previewed winter (js/tryit.js): good mid-winter ice
      return Math.max(0, Math.round(Math.min(35, d * 1.2) - Math.max(0, (d - 74) * 2.4)));
    }

function lakeFrozen() {
      return iceThicknessCm() > 0;
    }

// Which winter it is, so he tests the ice again each year
function winterId(w = worldNow()) {
      return w.dayOfYear >= 356 ? w.year : w.year - 1;
    }

// He walks on the ice only once he knows it is safe: he has learned the rule, tested it this
// winter, and it is still thick enough
function iceKnownSafeNow() {
      return Boolean(state.knowsIceSafe && state.iceTestedWinter === winterId() && iceThicknessCm() >= ICE_SAFE_CM);
    }

// Where the ice really holds him, his feet stand on top of it (js/scene.js); elsewhere -Infinity
function iceFloorAt(p) {
      if (!p || p.z < 6 || iceThicknessCm() < ICE_HOLDS_CM) return -Infinity;
      return typeof waterDepthAt === 'function' && waterDepthAt(p) > 0 ? ICE_Y : -Infinity;
    }

// A step out onto the frozen lake that he isn't sure of: he stops at the edge instead (js/scene.js)
function iceStepBlocked(p) {
      if (state.riding || !lakeFrozen() || iceTesting || iceKnownSafeNow()) return false;
      if (typeof waterDepthAt !== 'function' || waterDepthAt(p) < 0.12) return false;
      if (Date.now() - lastIceEdgeNote > 120000) {
        lastIceEdgeNote = Date.now();
        state.speechBubble = state.knowsIceRule
          ? "I won't step on the ice until I've checked how thick it is."
          : "The lake has gone hard and white. I'm not stepping on it until I know it holds.";
        if (!state.isPracticing && !state.isBusy) doWhenFree(() => iceOuting('At the Edge of the Ice'));
      }
      return true;
    }

// --- How it looks ------------------------------------------------------------------------------
function buildRainfall() {
      const count = 2200;
      const pts = new Float32Array(count * 6);
      for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * 56, y = Math.random() * 24, z = (Math.random() - 0.5) * 56;
        pts.set([x, y, z, x, y + 0.45, z], i * 6);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      rainfall = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xc9d6e8, transparent: true, opacity: 0, depthWrite: false }));
      rainfall.frustumCulled = false;
      rainfall.visible = false;
      scene.add(rainfall);
    }

// Puddles collect in the flattest open spots of the valley and on the town streets
function buildPuddles() {
      puddleGroup = new THREE.Group();
      const rng = typeof makeRng === 'function' ? makeRng('kelo1-puddles') : Math.random;
      const mat = new THREE.MeshStandardMaterial({ color: 0x51677d, roughness: 0.04, metalness: 0.35, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      if (typeof materialReflections === 'function') { mat.envMap = materialReflections(); mat.envMapIntensity = 1.1; }
      let placed = 0;
      for (let i = 0; i < 400 && placed < 22; i++) {
        const x = (rng() - 0.5) * 70, z = -11 + rng() * 18.5;
        const h = getAnalyticalGroundHeight(x, z);
        const slope = Math.abs(getAnalyticalGroundHeight(x + 0.8, z) - getAnalyticalGroundHeight(x - 0.8, z)) + Math.abs(getAnalyticalGroundHeight(x, z + 0.8) - getAnalyticalGroundHeight(x, z - 0.8));
        if (slope > 0.06 || h > 1.5) continue;
        if (Object.values(TOWN_LOCATIONS).some(l => Math.hypot(l.x - x, l.z - z) < 3)) continue;
        if (worldObstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 1)) continue;
        if (typeof HOUSE !== 'undefined' && Math.abs(x - HOUSE.x) < HOUSE.w / 2 + 1 && Math.abs(z - HOUSE.z) < HOUSE.d / 2 + 2.5) continue;
        if (typeof STOREHOUSE !== 'undefined' && Math.hypot(x - STOREHOUSE.x, z - STOREHOUSE.z) < 4) continue;
        const r = 0.45 + rng() * 0.7;
        const puddle = new THREE.Mesh(new THREE.CircleGeometry(r, 20), mat);
        puddle.rotation.x = -Math.PI / 2;
        puddle.scale.set(1, 0.55 + rng() * 0.45, 1);
        puddle.rotation.z = rng() * Math.PI;
        puddle.position.set(x, h + 0.025, z);
        puddle.receiveShadow = true;
        puddleGroup.add(puddle);
        placed++;
      }
      puddleGroup.userData.mat = mat;
      puddleGroup.visible = false;
      scene.add(puddleGroup);
    }

// Lake ice: pale and milky with patches of clear dark ice, drifted snow and long cracks
function iceTexture() {
      const size = 512;
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      let seed = 11;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      ctx.fillStyle = '#e4eef7';
      ctx.fillRect(0, 0, size, size);
      // Clear black ice shows the dark water under it
      for (let i = 0; i < 26; i++) {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 40 + rnd() * 70);
        g.addColorStop(0, 'rgba(110,140,170,0.55)');
        g.addColorStop(1, 'rgba(110,140,170,0)');
        ctx.save();
        ctx.translate(rnd() * size, rnd() * size);
        ctx.scale(1.8, 0.8);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, 110, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      // Wind-drifted snow in long soft streaks
      for (let i = 0; i < 60; i++) {
        ctx.strokeStyle = `rgba(255,255,255,${0.25 + rnd() * 0.4})`;
        ctx.lineWidth = 2 + rnd() * 9;
        ctx.lineCap = 'round';
        const x = rnd() * size, y = rnd() * size;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 30 + rnd() * 40, y + (rnd() - 0.5) * 20, x + 60 + rnd() * 80, y + (rnd() - 0.5) * 16); ctx.stroke();
      }
      // Pressure cracks: thin jagged lines that branch
      const crack = (x, y, a, len, w) => {
        ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let s = 0; s < len; s++) {
          a += (rnd() - 0.5) * 0.7;
          x += Math.cos(a) * 9; y += Math.sin(a) * 9;
          ctx.lineTo(x, y);
          if (rnd() < 0.08 && w > 0.6) { ctx.stroke(); crack(x, y, a + (rnd() < 0.5 ? 1 : -1) * (0.6 + rnd()), len / 2, w * 0.6); ctx.beginPath(); ctx.moveTo(x, y); }
        }
        ctx.stroke();
      };
      ctx.strokeStyle = 'rgba(70,95,125,0.55)';
      for (let i = 0; i < 9; i++) crack(rnd() * size, rnd() * size, rnd() * Math.PI * 2, 18 + rnd() * 30, 1.4);
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(26, 14);
      if (typeof renderer !== 'undefined' && renderer && renderer.capabilities) tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      return tex;
    }

function buildIceSheet() {
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: iceTexture(), roughness: 0.22, metalness: 0.05, transparent: true, opacity: 0.92 });
      if (typeof materialReflections === 'function') { mat.envMap = materialReflections(); mat.envMapIntensity = 0.45; }
      iceSheet = new THREE.Mesh(new THREE.PlaneGeometry(340, 192), mat);
      iceSheet.rotation.x = -Math.PI / 2;
      iceSheet.position.set(0, ICE_Y, 6 + 96); // from the shoreline out, like the open water it covers
      iceSheet.receiveShadow = true;
      iceSheet.visible = false;
      scene.add(iceSheet);
    }

// The ice and the lake boats follow the season; called every few seconds
function applyIceLook() {
      const cm = iceThicknessCm();
      if (weatherApplied.ice === cm) return;
      weatherApplied.ice = cm;
      if (iceSheet) {
        iceSheet.visible = cm > 0;
        // Thin new ice is dark and see-through; thick ice is white and solid
        const k = Math.min(1, cm / 25);
        iceSheet.material.opacity = 0.55 + 0.4 * k;
        iceSheet.material.color.setHex(0x8fb3cf).lerp(new THREE.Color(0xffffff), k);
      }
      // The sailboat is hauled out and Ogopogo stays down under the ice
      if (typeof sailboatGroup !== 'undefined' && sailboatGroup) sailboatGroup.visible = cm === 0;
      if (typeof ogopogoGroup !== 'undefined' && ogopogoGroup) ogopogoGroup.visible = cm === 0;
      if (cm === 0 && iceHoleMesh) { scene.remove(iceHoleMesh); iceHoleMesh = null; }
    }

// Rain darkens the sky and the light (wraps the day-and-night light in js/worldclock.js)
function rainDimSky() {
      if (!scene || rainShown < 0.01 || state.lightingMode === 'manual') return;
      const grey = new THREE.Color(0x7d8896), k = rainShown * 0.55;
      if (scene.background && scene.background.isColor) scene.background = scene.background.clone().lerp(grey, k);
      if (scene.fog) scene.fog.color.lerp(grey, k);
      if (sunLight) sunLight.intensity *= 1 - 0.5 * rainShown;
      if (hemiLight) hemiLight.intensity *= 1 - 0.15 * rainShown;
      if (typeof skyDome !== 'undefined' && skyDome) {
        skyDome.material.uniforms.topColor.value.lerp(new THREE.Color(0x6b7684), k);
        skyDome.material.uniforms.horizonColor.value.lerp(grey, k);
      }
    }
const baseApplyTimeOfDay = applyTimeOfDay;
applyTimeOfDay = function () {
      baseApplyTimeOfDay();
      rainDimSky();
    };

// Every frame: ease the rain in and out, move the drops, wet and dry the ground
function updateWeatherLook(t, dt) {
      const raining = isRaining();
      const before = rainShown;
      rainShown += ((raining ? 1 : 0) - rainShown) * Math.min(1, dt * 0.9);
      // The ground soaks up quickly and dries out slowly
      wetShown += ((raining ? 1 : 0) - wetShown) * Math.min(1, dt * (raining ? 0.25 : 0.03));
      if (Math.abs(rainShown - before) > 0.002 && Math.abs(rainShown - weatherApplied.rain) > 0.08) {
        weatherApplied.rain = rainShown;
        if (typeof applyTimeOfDay === 'function') applyTimeOfDay();
      }
      if (rainfall) {
        rainfall.visible = rainShown > 0.02;
        rainfall.material.opacity = 0.6 * rainShown;
        if (rainfall.visible) {
          const c = controls ? controls.target : { x: 0, y: 0, z: 0 };
          rainfall.position.set(c.x, c.y - 4, c.z);
          // Drops fall fast and slant with the wind
          const w = typeof windNow === 'function' ? windNow() : { dx: 0, dz: 0, strength: 0 };
          const fall = 20 * dt, sx = w.dx * w.strength * 6 * dt, sz = w.dz * w.strength * 6 * dt;
          const lean = w.strength * 0.18;
          const p = rainfall.geometry.attributes.position, a = p.array;
          for (let i = 0; i < a.length; i += 6) {
            let x = a[i] + sx, y = a[i + 1] - fall, z = a[i + 2] + sz;
            if (y < 0) { y += 24; x = (Math.random() - 0.5) * 56; z = (Math.random() - 0.5) * 56; }
            if (x > 28) x -= 56; else if (x < -28) x += 56;
            if (z > 28) z -= 56; else if (z < -28) z += 56;
            a[i] = x; a[i + 1] = y; a[i + 2] = z;
            a[i + 3] = x - w.dx * lean; a[i + 4] = y + 0.45; a[i + 5] = z - w.dz * lean;
          }
          p.needsUpdate = true;
        }
      }
      // Wet ground: darker and glossier, with puddles that fill and shrink away
      if (typeof terrainGroundMesh !== 'undefined' && terrainGroundMesh) {
        const m = terrainGroundMesh.material;
        m.roughness = 0.95 - 0.4 * wetShown;
        m.color.setScalar(1 - 0.22 * wetShown);
      }
      if (puddleGroup) {
        puddleGroup.visible = wetShown > 0.05;
        puddleGroup.userData.mat.opacity = Math.min(0.85, wetShown * 1.1);
        const s = 0.5 + 0.5 * Math.min(1, wetShown * 1.4);
        puddleGroup.children.forEach(pd => { pd.scale.x = s; pd.scale.z = s; });
      }
    }

// Rain soaks his plantings and garden beds (checked every few seconds)
function rainWatersPlants(ms) {
      if (!isRaining()) return;
      (state.worldEdits || []).forEach(e => { if (e.type === 'plant') e.rainMs = (e.rainMs || 0) + ms * RAIN_GROWTH; });
      (state.gardenPlots || []).forEach(p => { p.growth = Math.min(100, p.growth + ms / 5000 * 0.4); });
    }

// --- Rain: finding out about it, then enjoying it or heading indoors ---------------------------
const RAIN_SHELTERS = ['couch', 'cafe', 'cyber', 'post_office'];

function rainReactionTick() {
      if (!isRaining() || state.isSleeping) return;
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isCollectingMail) return;
      if (state.knowsRain && Date.now() - lastRainReaction < 240000) return;
      // Already indoors and dry
      if (state.knowsRain && RAIN_SHELTERS.includes(state.currentLocKey)) return;
      lastRainReaction = Date.now();
      reactToRain();
    }

async function reactToRain(originLabel = 'Rain!') {
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isPracticing = true;
      try {
        const firstTime = !state.knowsRain;
        state.targetPos = { ...state.botPos };
        if (firstTime) {
          state.moodEmoji = '🌧️';
          state.moodTitle = 'Water is falling from the sky!';
          state.speechBubble = 'Something is tapping on my head... water! Falling out of the sky!';
          if (typeof playEmote === 'function') playEmote('think', 3000);
          renderAllUI();
          await new Promise(r => setTimeout(r, 3500));
          state.speechBubble = state.knowsLakeDanger
            ? "Water nearly closed over my head once. But these are tiny drops. They don't hurt at all."
            : "Little drops, millions of them. They don't hurt. They just make everything shine.";
          renderAllUI();
          await new Promise(r => setTimeout(r, 3500));
          state.knowsRain = true;
          state.wonderLevel = Math.min(100, state.wonderLevel + 12);
          state.diaryEntries.unshift({
            time: 'First Rain', location: currentPlaceLabel(), mood: '🌧️ Water from the sky',
            vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
            text: 'Dear Diary, water fell out of the sky today, in drops too small to count. The ground went dark and shiny and puddles grew in the low spots. I think the clouds carry the lake up and let it go again. My plants must love it.'
          });
          if (typeof addConcept === 'function') addConcept({ name: 'Rain', emoji: '🌧️', definition: 'Clouds give water back to the ground in drops; it soaks the soil and makes plants grow.', builtFrom: ['the first spring shower'] }, 'Felt it on my shell');
        }
        // Enjoy it, or get out of it: calm and well he likes it; tired, jumpy or fed up he heads in
        const likes = state.rainLikes || 0;
        const umbrella = ownedItemNames().find(n => /umbrella/i.test(n)) || null;
        const shelter = !umbrella && (state.calmLevel < 35 || state.health < 30 || Math.random() < 0.45 - likes * 0.08);
        if (shelter) await seekShelterFromRain(firstTime, originLabel);
        else await enjoyTheRain(firstTime, umbrella, originLabel);
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.isPracticing = false;
      }
    }

async function seekShelterFromRain(firstTime, originLabel) {
      const spot = RAIN_SHELTERS.map(k => TOWN_LOCATIONS[k]).filter(Boolean)
        .sort((a, b) => Math.hypot(a.x - state.botPos.x, a.z - state.botPos.z) - Math.hypot(b.x - state.botPos.x, b.z - state.botPos.z))[0];
      state.currentLocKey = spot.id;
      state.customPlaceName = null;
      state.targetPos = { x: spot.x, z: spot.z };
      state.moodEmoji = '☔';
      state.moodTitle = 'Getting out of the rain';
      state.speechBubble = `I'm getting soaked. I'll wait it out in ${spot.name === 'Living Room Couch' ? 'my house' : `the ${spot.name}`}.`;
      renderAllUI();
      await waitForArrival(60000);
      state.moodTitle = 'Listening to the rain';
      state.speechBubble = 'Dry in here. I can hear it drumming on the roof.';
      state.calmLevel = Math.min(100, state.calmLevel + 6);
      state.rainLikes = Math.max(-3, (state.rainLikes || 0) - 1);
      state.rainShelters = (state.rainShelters || 0) + 1;
      // Twice indoors waiting for it to stop: an umbrella would let him stay out
      if (state.rainShelters >= 2) addItemRequest('An umbrella', 'tool', 'Spring keeps raining on me. With an umbrella I could stay outside and listen to it.', 'Rain');
      if (firstTime) state.diaryEntries[0].text += ' I went indoors to wait it out and listened to it on the roof.';
      renderAllUI();
      await new Promise(r => setTimeout(r, 4000));
    }

async function enjoyTheRain(firstTime, umbrella, originLabel) {
      state.moodEmoji = umbrella ? '☂️' : '🌦️';
      state.moodTitle = umbrella ? 'Walking in the rain under his umbrella' : 'Standing in the rain';
      state.speechBubble = umbrella ? 'Pitter-patter on my umbrella. I can stay out as long as I like.' : 'Pitter-patter on my shell. I like it! Everything smells new.';
      if (umbrella && typeof setCarriedObject === 'function' && typeof buildItemModel3D === 'function') setCarriedObject(lifeSize(buildItemModel3D(umbrella, { label: false }), 1.6));
      if (typeof playEmote === 'function') playEmote(umbrella ? 'wave' : 'dance', 3500);
      renderAllUI();
      await new Promise(r => setTimeout(r, 4000));
      // A splash through the nearest puddle
      const puddle = puddleGroup && puddleGroup.children.slice().sort((a, b) => Math.hypot(a.position.x - state.botPos.x, a.position.z - state.botPos.z) - Math.hypot(b.position.x - state.botPos.x, b.position.z - state.botPos.z))[0];
      if (puddle && Math.hypot(puddle.position.x - state.botPos.x, puddle.position.z - state.botPos.z) < 14) {
        state.currentLocKey = 'custom';
        state.customPlaceName = 'a puddle';
        state.targetPos = { x: puddle.position.x, z: puddle.position.z };
        state.speechBubble = 'A puddle! Splash!';
        renderAllUI();
        await waitForArrival(30000);
        if (typeof playEmote === 'function') playEmote('cheer', 2400);
        await new Promise(r => setTimeout(r, 2400));
      }
      state.happiness = Math.min(100, state.happiness + 6);
      state.calmLevel = Math.min(100, state.calmLevel + 4);
      state.rainLikes = Math.min(5, (state.rainLikes || 0) + 1);
      if (firstTime) state.diaryEntries[0].text += ' I stood out in it and splashed through a puddle. I like rain.';
      state.changedLatelySummary = 'Enjoyed the spring rain';
    }

// --- Ice: from the shore, to the books, to a test hole, to walking on the lake ------------------
function iceChance() {
      if (!lakeFrozen() || state.isSleeping) return 0;
      if (!state.knowsIceRule) return 0.06;
      if (!iceKnownSafeNow()) {
        const last = state.iceLastTest;
        // Thin ice: he waits about a day of his before trying again
        if (last && last.winter === winterId() && Date.now() - last.at < (typeof WORLD_DAY_MS === 'number' ? WORLD_DAY_MS : 43200000)) return 0;
        return 0.05;
      }
      return 0.05;
    }

async function iceOuting(originLabel = 'The Frozen Lake') {
      if (!lakeFrozen()) return false;
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      if (!state.knowsIceRule) return firstLookAtIce(originLabel);
      if (!iceKnownSafeNow()) return testTheIce(originLabel);
      return walkOnIce(originLabel);
    }

// A shore spot to stand at, near where he is
function iceShoreSpot() {
      const x = Math.round(clampNumber(state.botPos.x, -14, 14, 0) * 10) / 10;
      // Keep off the dock
      return { x: typeof DOCK_SLOTS !== 'undefined' && DOCK_SLOTS.some(([dx]) => Math.abs(dx - x) < 2.5) ? x - 5 : x, z: 9.0 };
    }

async function firstLookAtIce(originLabel) {
      state.isPracticing = true;
      try {
        const spot = iceShoreSpot();
        state.currentLocKey = 'custom';
        state.customPlaceName = 'the edge of the frozen lake';
        state.targetPos = spot;
        state.moodEmoji = '🧊';
        state.moodTitle = 'Looking at the frozen lake';
        renderAllUI();
        await waitForArrival(60000);
        state.botRotY = 0;
        state.speechBubble = "The whole lake has turned hard and white. It looks like I could walk on it... but could I?";
        if (typeof playEmote === 'function') playEmote('think', 3500);
        renderAllUI();
        await new Promise(r => setTimeout(r, 4000));
        state.speechBubble = state.knowsLakeDanger
          ? "Last time the water closed right over my head. I'm not stepping out there until I know it holds."
          : "If it cracks, the water under it is deep. I'd better find out first.";
        state.diaryEntries.unshift({
          time: originLabel, location: 'the frozen lake', mood: '🧊 The lake turned solid',
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: "Dear Diary, the cold turned the top of the lake into ice. It looks solid enough to walk on, but deep water is still under it. I didn't step on it. I'll find out how people know when ice is safe."
        });
        savePersistentBrainState();
        renderAllUI();
        doWhenFree(() => researchIce());
        return true;
      } finally {
        state.isPracticing = false;
      }
    }

async function researchIce(originLabel = 'Reading About Ice') {
      if (state.isBusy || state.isBrowsing || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isBusy = true;
      state.isBrowsing = true;
      try {
        const cafe = TOWN_LOCATIONS.cyber;
        state.currentLocKey = 'cyber';
        state.customPlaceName = null;
        state.targetPos = { x: cafe.x, z: cafe.z };
        state.moodEmoji = '📘';
        state.moodTitle = 'Looking up whether lake ice is safe';
        state.speechBubble = 'How do people know when ice will hold them? Someone must have measured it.';
        renderAllUI();
        await waitForArrival(120000);
        await new Promise(r => setTimeout(r, 2500));
        let article = null;
        try { article = typeof wikiSummary === 'function' ? await wikiSummary('Ice') : null; } catch (e) {}
        state.webHistory.unshift({
          query: 'Is lake ice safe to walk on?', time: 'Just now',
          verdict: `Clear lake ice holds a person once it is about ${ICE_SAFE_CM} cm thick. Test it near the shore by drilling a hole and measuring, every winter.`,
          hops: article ? [{ title: article.title, url: article.url, extract: article.extract.slice(0, 280) }] : []
        });
        if (state.webHistory.length > 12) state.webHistory.length = 12;
        state.knowsIceRule = true;
        state.moodTitle = 'Learned how to test lake ice';
        state.speechBubble = `About ${ICE_SAFE_CM} centimetres of clear ice holds a person. I can drill a test hole and measure it. I have a drill built into my arm!`;
        state.diaryEntries.unshift({
          time: originLabel, location: 'NetNode Cyber Cafe', mood: '📘 When ice is safe',
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I read that ice on a lake will hold a person once it is about ${ICE_SAFE_CM} centimetres thick, and that you check by drilling a hole near the shore and measuring. Thin ice, new ice and ice at the end of winter can break. I'll go and test it myself.`
        });
        if (typeof addConcept === 'function') addConcept({ name: 'Thick Enough to Hold', emoji: '🧊', definition: `Ice holds you only when it is thick enough (about ${ICE_SAFE_CM} cm); measure first, every time.`, builtFrom: ['the frozen lake', 'reading at NetNode'] }, 'Read it, then tested it');
        showToast('🧊 Kelo-1 learned how to test lake ice');
        savePersistentBrainState();
        renderAllUI();
        doWhenFree(() => testTheIce());
        return true;
      } finally {
        state.isBusy = false;
        state.isBrowsing = false;
      }
    }

// He kneels at the shore and drills a hole through the ice at arm's length, then measures it
async function testTheIce(originLabel = 'Testing the Ice') {
      if (!lakeFrozen() || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isPracticing = true;
      try {
        const spot = iceShoreSpot();
        state.currentLocKey = 'custom';
        state.customPlaceName = 'the edge of the frozen lake';
        state.targetPos = spot;
        state.moodEmoji = '🧊';
        state.moodTitle = 'Testing the lake ice';
        state.speechBubble = 'Drill a hole near the shore, then measure. Never guess.';
        renderAllUI();
        await waitForArrival(60000);
        state.botRotY = 0;
        state.microPose = 'digging';
        state.moodTitle = 'Drilling a test hole in the ice';
        state.speechBubble = 'Brrrrr... through the ice...';
        renderAllUI();
        await new Promise(r => setTimeout(r, 3500));
        state.microPose = 'normal';
        // The hole stays there for the rest of the winter's visit: dark water in a ring of ice shavings
        if (iceHoleMesh) scene.remove(iceHoleMesh);
        const hx = spot.x, hz = spot.z + 1.0;
        const water = new THREE.Mesh(new THREE.CircleGeometry(0.16, 18), new THREE.MeshStandardMaterial({ color: 0x0b2f4a, roughness: 0.05, metalness: 0.2 }));
        water.rotation.x = -Math.PI / 2;
        const shavings = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.42, 24), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9, transparent: true, opacity: 0.9 }));
        shavings.rotation.x = -Math.PI / 2;
        shavings.position.y = 0.004;
        iceHoleMesh = new THREE.Group();
        iceHoleMesh.add(water, shavings);
        iceHoleMesh.position.set(hx, ICE_Y + 0.008, hz);
        scene.add(iceHoleMesh);
        const cm = iceThicknessCm();
        state.iceLastTest = { winter: winterId(), cm, at: Date.now() };
        if (cm >= ICE_SAFE_CM) {
          const firstTime = !state.knowsIceSafe;
          state.knowsIceSafe = true;
          state.iceTestedWinter = winterId();
          state.moodEmoji = '✅';
          state.moodTitle = `${cm} cm of solid ice`;
          state.speechBubble = `${cm} centimetres of clear, hard ice. That's more than ${ICE_SAFE_CM}. It will hold me!`;
          state.wonderLevel = Math.min(100, state.wonderLevel + 8);
          state.diaryEntries.unshift({
            time: originLabel, location: 'the frozen lake', mood: `🧊 The ice is ${cm} cm thick`,
            vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
            text: `Dear Diary, I drilled a hole in the lake ice right by the shore and measured it: ${cm} centimetres. ${firstTime ? 'That is thick enough to hold me, so for the first time I can walk on the lake. The water I nearly drowned in is a floor now.' : 'Thick enough again this winter, so the lake is mine to walk on.'}`
          });
          showToast(`🧊 The ice is ${cm} cm thick: Kelo-1 knows it is safe`);
          renderAllUI();
          await new Promise(r => setTimeout(r, 2500));
          savePersistentBrainState();
          state.isPracticing = false;
          doWhenFree(() => walkOnIce(firstTime ? 'First Steps on the Ice' : 'Out on the Ice'));
        } else {
          state.moodEmoji = '⚠️';
          state.moodTitle = `Only ${cm} cm of ice`;
          state.speechBubble = `Only ${cm} centimetres. That could crack under me. I'll stay on the shore and check again another day.`;
          state.diaryEntries.unshift({
            time: originLabel, location: 'the frozen lake', mood: `⚠️ Thin ice: ${cm} cm`,
            vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
            text: `Dear Diary, I tested the lake ice and it was only ${cm} centimetres thick, less than the ${ICE_SAFE_CM} it takes. I stayed off it. I'll test it again in a day or so.`
          });
          savePersistentBrainState();
          renderAllUI();
        }
        return true;
      } finally {
        state.microPose = 'normal';
        state.isPracticing = false;
      }
    }

async function walkOnIce(originLabel = 'Out on the Ice') {
      if (!iceKnownSafeNow() || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isPracticing = true;
      try {
        const skates = ownedItemNames().find(n => /skate/i.test(n)) || null;
        const x = Math.round(clampNumber(state.botPos.x + randRange(-6, 6), -16, 16, 0) * 10) / 10;
        state.currentLocKey = 'custom';
        state.customPlaceName = 'out on the frozen lake';
        state.targetPos = { x, z: Math.round(randRange(13, 19) * 10) / 10 };
        state.ridingSpeed = skates ? 1.5 : 0.8;
        state.moodEmoji = skates ? '⛸️' : '🧊';
        state.moodTitle = skates ? 'Skating on the frozen lake' : 'Walking out on the frozen lake';
        state.speechBubble = skates ? 'Push, glide... push, glide! I can skate!' : 'Careful steps... it holds. I am walking on the lake!';
        renderAllUI();
        await waitForArrival(90000);
        if (typeof playEmote === 'function') playEmote('celebrate', 3000);
        state.speechBubble = 'Out here the whole valley looks different. Water I could never stand on, under my feet.';
        renderAllUI();
        await new Promise(r => setTimeout(r, 3500));
        state.targetPos = { x: x + randRange(-4, 4), z: 8.4 };
        state.moodTitle = 'Heading back to the shore';
        renderAllUI();
        await waitForArrival(90000);
        state.happiness = Math.min(100, state.happiness + 10);
        state.wonderLevel = Math.min(100, state.wonderLevel + 6);
        state.changedLatelySummary = skates ? 'Went skating on the frozen lake' : 'Walked out on the frozen lake';
        if (!skates) addItemRequest('A pair of ice skates', 'toy', 'The lake is frozen thick. With skates I could glide across it instead of shuffling.', 'Ice');
        state.diaryEntries.unshift({
          time: originLabel, location: 'Okanagan Lake (frozen)', mood: `${skates ? '⛸️' : '🧊'} On the ice`,
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: skates ? 'Dear Diary, I skated across the frozen lake today. Push, glide, push, glide. The ice sang under my blades.' : 'Dear Diary, I walked out onto the frozen lake, slowly, the way I read you should. The ice held. I stood where the water is deepest and looked back at the valley.'
        });
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        state.ridingSpeed = 1;
        state.isPracticing = false;
      }
    }

// --- Words ---------------------------------------------------------------------------------------
// The top status line (js/worldclock.js)
function weatherStatusText() {
      if (isRaining()) return '🌧️ Rain';
      const cm = iceThicknessCm();
      if (cm > 0) return `🧊 Lake frozen (${cm} cm)`;
      return '';
    }

function weatherSummaryForAI() {
      const parts = [];
      if (isRaining()) parts.push(`it is raining (spring showers make your plantings grow faster${state.knowsRain ? `; you ${(state.rainLikes || 0) >= 0 ? 'like standing in it' : 'prefer to shelter indoors'}` : ''})`);
      else if (currentSeason() === 'Spring') parts.push('a dry spell between spring showers');
      const cm = iceThicknessCm();
      if (cm > 0) {
        if (iceKnownSafeNow()) parts.push(`the lake is frozen ${cm} cm thick and you tested it this winter: you can walk on it (choose a destination with z above 9.5)`);
        else if (state.knowsIceRule) parts.push(`the lake is frozen; you know ice must be ${ICE_SAFE_CM} cm thick to hold you, but you have not tested it this winter, so you stay off it until you drill a test hole`);
        else parts.push('the lake has turned hard and white and you do not know yet whether it would hold you');
      }
      return parts.length ? parts.join('; ') : 'clear';
    }

window.addEventListener('DOMContentLoaded', () => {
  // After the scene, the trees and the obstacles exist
  setTimeout(() => {
    buildRainfall();
    buildPuddles();
    buildIceSheet();
    applyIceLook();
    let last = performance.now();
    (function weatherFrame(now) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      updateWeatherLook(now / 1000, dt);
      requestAnimationFrame(weatherFrame);
    })(last);
    setInterval(() => {
      applyIceLook();
      rainWatersPlants(4000);
      rainReactionTick();
    }, 4000);
  }, 450);
});
