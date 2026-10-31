// Kelo-bot-1 — js/seasons.js
// Loaded after knowhow.js. The valley changes with Kelo-1's seasons (js/worldclock.js): fresh green
// in spring, deep green in summer, orange in autumn, and in winter snow covers the ground, frosts
// the trees and falls from the sky. High on the mountain there is snow for most of the year.
// Without gear he sinks into deep snow and gets stuck; he works out why, reads up at NetNode and
// asks for snowshoes, skis or a snowmobile. With them he gets around again.

const SNOW_LINE = { Winter: -10, Spring: 6.5, Summer: 11, Autumn: 7.5 }; // ground height above which snow lies
const SNOW_SINK = 0.45;

const SEASON_LEAF = { Spring: 0x86efac, Summer: null, Autumn: 0xf59e0b, Winter: 0xe2e8f0 };
const SNOW_COLOR = new THREE.Color(0xf1f5fb);

let seasonApplied = null;
let terrainBaseColors = null;
let snowfall = null;
let lastStuckAt = 0;

function currentSeason() {
      return typeof worldNow === 'function' ? worldNow().season : 'Summer';
    }

// Snow on the ground here? (not on the beach or in the lake)
function inSnow(p) {
      if (!p || p.z > 7.8) return false;
      return getAnalyticalGroundHeight(p.x, p.z) > SNOW_LINE[currentSeason()];
    }

function ownsGear(re) {
      return [...state.toolInventory, ...state.toys.map(t => t.name), ...state.belongings.map(b => b.name)].some(n => re.test(n));
    }

function snowGear() {
      if (ownsGear(/\bskis?\b/i)) return 'skis';
      if (ownsGear(/snow ?shoes?/i)) return 'snowshoes';
      return null;
    }

// Multiplies his walking step: crawling through deep snow, steady on snowshoes, gliding on skis
function snowWalkFactor(p) {
      if (state.riding || !inSnow(p)) return 1;
      const gear = snowGear();
      return gear === 'skis' ? 1.15 : gear === 'snowshoes' ? 0.8 : 0.28;
    }

function snowSink(p) {
      if (state.riding || !inSnow(p) || snowGear()) return 0;
      return SNOW_SINK;
    }

// --- Getting stuck, and working out what to do about it ------------------------------------------
function checkSnowStuck() {
      if (!state.isWalking || state.riding || state.isSleeping || snowGear() || !inSnow(state.botPos)) return;
      if (Date.now() - lastStuckAt < 90000) return;
      lastStuckAt = Date.now();
      getStuckInSnow();
    }

async function getStuckInSnow() {
      const firstTime = !state.knowsSnow;
      const wasGoing = { ...state.targetPos };
      // He stops dead, up to his knees
      state.targetPos = { ...state.botPos };
      state.moodEmoji = '🥶';
      state.moodTitle = firstTime ? 'Stuck in deep snow!' : 'Wading through snow again';
      state.speechBubble = firstTime
        ? "My legs sink right in! Every step I take, I go deeper. I'm stuck!"
        : "Snow again. Without snowshoes I'm just wading in up to my knees.";
      state.calmLevel = Math.max(5, state.calmLevel - (firstTime ? 15 : 5));
      if (typeof playEmote === 'function') playEmote('shiver', 3500);
      renderAllUI();
      await new Promise(r => setTimeout(r, 3500));
      if (firstTime) {
        state.knowsSnow = true;
        state.speechBubble = "I'll dig my way back out. Snow is soft, so my feet push straight through it. I need something wider to stand on.";
        state.diaryEntries.unshift({
          time: 'Stuck in the Snow', location: currentPlaceLabel(), mood: '🥶 Stuck in deep snow',
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: 'Dear Diary, I walked into deep snow and sank up to my knees. The more I pushed, the deeper I went. My feet are too small for snow: I need to find out how people get around on it.'
        });
        if (typeof addConcept === 'function') addConcept({ name: 'Weight Over Width', emoji: '❄️', definition: 'Soft snow holds you up only if your weight is spread out wide.', builtFrom: ['getting stuck in snow'] }, 'Learned the hard way');
        savePersistentBrainState();
        doWhenFree(() => researchSnowTravel());
      } else {
        askForSnowGear();
      }
      // Turn back the way he came, slowly
      state.targetPos = { x: state.botPos.x - (wasGoing.x - state.botPos.x) * 0.2, z: Math.min(7, state.botPos.z - (wasGoing.z - state.botPos.z) * 0.2) };
      renderAllUI();
    }

function askForSnowGear() {
      if (snowGear()) return;
      addItemRequest('A pair of snowshoes', 'tool', 'I keep sinking into the snow. Snowshoes would spread my weight so I can walk on top.', 'Snow');
      addItemRequest('A pair of cross-country skis', 'tool', 'Skis would let me glide over the snow instead of wading through it.', 'Snow');
      if (!state.vehicles.some(v => v.kind === 'snowmobile')) addItemRequest('A snowmobile', 'vehicle', 'For long trips up the snowy mountain, something with a motor and a track.', 'Snow');
    }

async function researchSnowTravel(originLabel = 'Reading About Snow') {
      if (state.isBusy || state.isBrowsing || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isBusy = true;
      state.isBrowsing = true;
      try {
        const cafe = TOWN_LOCATIONS.cyber;
        state.currentLocKey = 'cyber';
        state.customPlaceName = null;
        state.targetPos = { x: cafe.x, z: cafe.z };
        state.moodEmoji = '📘';
        state.moodTitle = 'Looking up how to travel on snow';
        state.speechBubble = 'There must be a way to walk on snow without sinking. Someone has figured this out.';
        renderAllUI();
        await waitForArrival(120000);
        await new Promise(r => setTimeout(r, 2500));
        let article = null;
        try { article = typeof wikiSummary === 'function' ? await wikiSummary('Snowshoe') : null; } catch (e) {}
        state.webHistory.unshift({
          query: 'How to walk on snow', time: 'Just now',
          verdict: 'Snowshoes spread your weight over a wide frame; skis let you glide; a snowmobile rides on a track.',
          hops: article ? [{ title: article.title, url: article.url, extract: article.extract.slice(0, 280) }] : []
        });
        if (state.webHistory.length > 12) state.webHistory.length = 12;
        askForSnowGear();
        state.moodTitle = 'Learned how to travel on snow';
        state.speechBubble = "Snowshoes! Wide frames that spread your weight so you stay on top of the snow. Or skis to glide. I've asked for some.";
        state.diaryEntries.unshift({
          time: originLabel, location: 'NetNode Cyber Cafe', mood: '📘 How to walk on snow',
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: "Dear Diary, I read that people strap wide frames called snowshoes to their feet so they don't sink, or glide on skis. For long trips there are snowmobiles, or you can fly over it all in a helicopter. I wrote letters asking for snowshoes and skis."
        });
        showToast('❄️ Kelo-1 asked for snow gear');
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        state.isBusy = false;
        state.isBrowsing = false;
      }
    }

// --- How the valley looks in each season ---------------------------------------------------------
function applySeasonLook(season = currentSeason()) {
      if (!scene || !terrainGroundMesh) return;
      const geo = terrainGroundMesh.geometry, pos = geo.attributes.position, col = geo.attributes.color;
      if (!terrainBaseColors) terrainBaseColors = Float32Array.from(col.array);
      const line = SNOW_LINE[season];
      const c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        // Leave dug holes and the paved yard and helipad as they are (the balloon field is just grass)
        const paved = typeof inParkingArea === 'function' && inParkingArea(x, z) && !BALLOON_SLOTS.some(([bx, bz]) => Math.hypot(x - bx, z - bz) < PAD_RADIUS);
        if ((typeof groundDugAt === 'function' && groundDugAt(x, z) > 0.05) || (typeof dirtPileRaiseAt === 'function' && dirtPileRaiseAt(x, z) > 0.03) || paved) continue;
        c.setRGB(terrainBaseColors[i * 3], terrainBaseColors[i * 3 + 1], terrainBaseColors[i * 3 + 2]);
        if (z < 7.8 && y > line) {
          // A soft edge where the snow thins out
          c.lerp(SNOW_COLOR, Math.min(1, (y - line) / 0.6 + 0.35));
        } else if (season === 'Spring') c.lerp(new THREE.Color(0x6ee75a), 0.25);
        else if (season === 'Autumn' && c.g > c.r) c.lerp(new THREE.Color(0xb5a642), 0.3);
        col.setXYZ(i, c.r, c.g, c.b);
      }
      col.needsUpdate = true;
      // Leaves and needles
      scene.traverse(o => {
        const m = o.material;
        if (!m || !m.userData || !m.userData.seasonal) return;
        if (!m.userData.baseColor) m.userData.baseColor = m.color.getHex();
        const base = new THREE.Color(m.userData.baseColor);
        if (m.userData.seasonal === 'needle') m.color.copy(season === 'Winter' ? base.lerp(SNOW_COLOR, 0.45) : base);
        else m.color.copy(SEASON_LEAF[season] ? base.lerp(new THREE.Color(SEASON_LEAF[season]), season === 'Winter' ? 0.7 : 0.55) : base);
      });
      // Snow falls in winter
      if (snowfall) snowfall.visible = season === 'Winter';
      seasonApplied = season;
    }

function buildSnowfall() {
      const count = 1400;
      const pts = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pts[i * 3] = (Math.random() - 0.5) * 60;
        pts[i * 3 + 1] = Math.random() * 25;
        pts[i * 3 + 2] = (Math.random() - 0.5) * 60;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      snowfall = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.14, transparent: true, opacity: 0.85, depthWrite: false }));
      snowfall.visible = false;
      scene.add(snowfall);
    }

// Every frame: flakes drift down around wherever the camera is looking
function updateSnowfall(t) {
      if (!snowfall || !snowfall.visible) return;
      const c = controls ? controls.target : { x: 0, y: 0, z: 0 };
      snowfall.position.set(c.x, c.y - 3, c.z);
      const p = snowfall.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) - 0.045;
        if (y < 0) y += 25;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(t + i) * 0.004);
      }
      p.needsUpdate = true;
    }

function seasonSummaryForAI() {
      const s = currentSeason();
      const gear = snowGear();
      if (s === 'Winter') return `winter: snow covers the whole valley${state.knowsSnow ? (gear ? `, and you have ${gear}` : ', and you sink in it without snowshoes or skis') : ''}`;
      return `${s.toLowerCase()}: snow only high on the mountain`;
    }

window.addEventListener('DOMContentLoaded', () => {
  // After the yard, pit and dig holes have coloured the ground
  setTimeout(() => {
    buildSnowfall();
    applySeasonLook();
    (function frame(t) {
      updateSnowfall(t / 1000);
      requestAnimationFrame(frame);
    })(0);
    setInterval(() => {
      if (currentSeason() !== seasonApplied) applySeasonLook();
      checkSnowStuck();
    }, 2000);
  }, 400);
});
