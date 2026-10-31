// Kelo-bot-1 — js/hobbies.js
// Loaded after workshop.js. Things people give Kelo-1 can spark lasting hobbies he practises on
// his own and gets better at over time. Spray paint becomes graffiti murals painted onto real
// walls; a kite gets flown; an instrument becomes music; seeds become new plants; a paint set
// becomes landscape paintings. With an AI brain he can invent a hobby for anything.

const MAX_HOBBIES = 12;
const MAX_PLANTINGS = 24;

// How each kind of hobby is practised in the world
const HOBBY_STYLES = ['mural', 'kite', 'music', 'plant', 'easel', 'tricks', 'other'];

const HOBBY_RULES = [
  [/spray ?paint|aerosol|graffiti|paint marker|chalk/, { name: 'Graffiti & Murals', emoji: '🎨', style: 'mural', description: 'Painting tags and murals on the island walls.' }],
  [/kite/, { name: 'Kite Flying', emoji: '🪁', style: 'kite', description: 'Reading the wind and flying kites over the meadow.' }],
  [/harmonica|guitar|ukulele|flute|drum|violin|piano|keyboard|instrument|kazoo|ocarina/, { name: 'Making Music', emoji: '🎵', style: 'music', description: 'Composing little songs about the valley.' }],
  [/seed|sapling|bulb|seedling|cutting/, { name: 'Gardening', emoji: '🌱', style: 'plant', description: 'Planting things and watching them grow.' }],
  [/watercolor|paint set|paintbrush|easel|canvas|sketchbook|pastels|crayons/, { name: 'Landscape Painting', emoji: '🖼️', style: 'easel', description: 'Painting the lake and mountains on an easel.' }],
  [/yo-?yo|juggl|ball|spinning top|skateboard|frisbee/, { name: 'Tricks', emoji: '🤹', style: 'tricks', description: 'Practising tricks until they look effortless.' }],
  [/telescope|binocular|star chart/, { name: 'Stargazing', emoji: '🔭', style: 'other', description: 'Naming his own constellations above the peaks.' }],
  [/camera/, { name: 'Photography', emoji: '📸', style: 'other', description: 'Framing the island from new angles.' }],
  [/book|novel|comic/, { name: 'Reading', emoji: '📚', style: 'other', description: 'Reading under a tree and arguing with the author.' }]
];

const muralMeshes = {};
let hobbyProps = null;   // temporary 3D props while practising (kite, notes, easel)
let hobbyPropUpdate = null;

function findHobby(name) {
      const key = String(name || '').trim().toLowerCase();
      return state.hobbies.find(h => h.name.toLowerCase() === key) || null;
    }

function hobbyForItem(itemName) {
      const lower = String(itemName || '').toLowerCase();
      const rule = HOBBY_RULES.find(([re]) => re.test(lower));
      return rule ? { ...rule[1] } : null;
    }

function addHobby(raw, sparkedBy) {
      if (!raw || typeof raw !== 'object') return null;
      const name = (typeof raw.name === 'string' ? raw.name.trim() : '').slice(0, 40);
      if (!name) return null;
      const existing = findHobby(name);
      if (existing) return existing;
      const hobby = {
        name,
        emoji: (typeof raw.emoji === 'string' && raw.emoji.trim()) ? raw.emoji.trim().slice(0, 8) : '✨',
        style: HOBBY_STYLES.includes(raw.style) ? raw.style : 'other',
        description: String(raw.description || '').slice(0, 200),
        sparkedBy: String(sparkedBy || '').slice(0, 80),
        startedAt: Date.now(),
        practiced: 0,
        skill: 5
      };
      state.hobbies.unshift(hobby);
      if (state.hobbies.length > MAX_HOBBIES) state.hobbies.length = MAX_HOBBIES;
      showToast(`${hobby.emoji} Kelo-1 picked up a new hobby: ${hobby.name}`);
      return hobby;
    }

// Try a hobby as soon as he is free (he may be mid-build or mid-errand), giving up after ~3 minutes
function practiceWhenFree(hobby, originLabel, attempt = 0) {
      setTimeout(() => {
        if (state.isBusy || state.isBuilding || state.isPracticing || state.isCollectingMail) {
          if (attempt < 36) practiceWhenFree(hobby, originLabel, attempt + 1);
          return;
        }
        practiceHobby(hobby, originLabel);
      }, attempt === 0 ? 4000 : 5000);
    }

// Called after he receives an item: it may spark a hobby (he then tries it out soon)
function maybeStartHobbyFromItem(itemName, from) {
      const template = hobbyForItem(itemName);
      if (!template) return null;
      const isNew = !findHobby(template.name);
      const hobby = addHobby(template, `${itemName} from ${from}`);
      if (hobby && isNew) {
        hobby.tool = String(itemName).slice(0, 60);
        savePersistentBrainState();
        practiceWhenFree(hobby, 'Trying a New Hobby');
      }
      return hobby;
    }

// --- Mural painting: a procedural spray-paint texture that improves with skill ---------
function paintMuralCanvas({ text, palette, skill, seed }) {
      const rng = makeRng(`${seed}`);
      const r = (a, b) => a + rng() * (b - a);
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 352;
      const ctx = c.getContext('2d');
      const colors = (palette && palette.length ? palette : ['#ff3d7f', '#ffd23f', '#3ddcff', '#7cff6b']).slice(0, 5);
      const sprayDot = (x, y, radius, color, density) => {
        ctx.fillStyle = color;
        for (let i = 0; i < density; i++) {
          const a = rng() * Math.PI * 2, d = Math.pow(rng(), 0.6) * radius;
          ctx.globalAlpha = 0.25 + rng() * 0.6;
          ctx.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 2, 2);
        }
        ctx.globalAlpha = 1;
      };
      // Background shapes appear as he gets better
      if (skill > 25) {
        const bg = ctx.createLinearGradient(0, 0, 512, 352);
        bg.addColorStop(0, colors[2 % colors.length]);
        bg.addColorStop(1, colors[3 % colors.length]);
        ctx.globalAlpha = Math.min(0.85, 0.3 + skill / 140);
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.ellipse(256, 176, r(200, 250), r(120, 160), r(-0.2, 0.2), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (skill > 45) {
        // Motifs: mountains, a sun and lake waves
        ctx.fillStyle = colors[1 % colors.length];
        ctx.beginPath();
        ctx.arc(r(90, 420), r(70, 110), r(28, 44), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(30,30,60,0.75)';
        ctx.beginPath();
        ctx.moveTo(40, 300);
        for (let x = 40; x <= 472; x += 48) ctx.lineTo(x + 24, r(170, 230)), ctx.lineTo(x + 48, 300);
        ctx.closePath();
        ctx.fill();
      }
      // The tag itself, in outlined bubble letters; shakier and messier at low skill
      const shake = Math.max(1, 14 - skill / 8);
      ctx.save();
      ctx.translate(256, 190);
      ctx.rotate(r(-0.12, 0.08));
      ctx.font = `900 ${Math.round(84 + skill / 3)}px Impact, Arial Black, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const word = String(text || 'KELO').toUpperCase().slice(0, 10);
      ctx.lineJoin = 'round';
      ctx.lineWidth = 16;
      ctx.strokeStyle = '#111827';
      ctx.strokeText(word, r(-shake, shake), r(-shake, shake));
      const fill = ctx.createLinearGradient(0, -50, 0, 50);
      fill.addColorStop(0, colors[0]);
      fill.addColorStop(1, colors[1 % colors.length]);
      ctx.fillStyle = fill;
      ctx.fillText(word, 0, 0);
      if (skill > 35) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeText(word, -3, -3);
      }
      ctx.restore();
      // Drips and overspray
      for (let i = 0; i < 6 + Math.floor(skill / 10); i++) {
        const x = r(80, 430), y = r(200, 250);
        ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
        ctx.globalAlpha = 0.8;
        ctx.fillRect(x, y, 3, r(15, 70 - skill / 3));
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 18; i++) sprayDot(r(20, 492), r(20, 332), r(8, 30), colors[i % colors.length], 60);
      if (skill > 60) {
        // Signature and stars once he is confident
        ctx.font = 'bold 22px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('— K1', 440, 330);
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = colors[i % colors.length];
          ctx.font = `${Math.round(r(18, 34))}px Arial`;
          ctx.fillText('★', r(30, 480), r(30, 120));
        }
      }
      return c;
    }

// Paintings hang in the Museum (js/museum.js); the town's walls stay as they are
function placeMural3D() {
      if (typeof renderMuseum3D === 'function') renderMuseum3D();
    }

// --- Temporary props while practising -------------------------------------------------
function clearHobbyProps() {
      if (hobbyProps && scene) {
        scene.remove(hobbyProps);
        hobbyProps.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material && o.material.map) o.material.map.dispose();
        });
      }
      hobbyProps = null;
      hobbyPropUpdate = null;
    }

function noteSprite(symbol, color) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const ctx = c.getContext('2d');
      ctx.font = 'bold 52px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(symbol, 32, 34);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
      sprite.scale.set(0.5, 0.5, 0.5);
      return sprite;
    }

function startPracticeProps(hobby) {
      clearHobbyProps();
      if (!scene) return;
      hobbyProps = new THREE.Group();
      scene.add(hobbyProps);
      if (hobby.style === 'kite') {
        const kite = buildItemModel3D('kite', { label: false });
        kite.scale.setScalar(2.2);
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffffff }));
        hobbyProps.add(kite, line);
        hobbyPropUpdate = (t) => {
          const kx = state.botPos.x - 3 + Math.sin(t * 0.7) * 1.5, kz = state.botPos.z - 4 + Math.cos(t * 0.5);
          const ky = state.botAltitudeY + 7 + Math.sin(t * 1.3) * 0.8;
          kite.position.set(kx, ky, kz);
          kite.rotation.z = Math.sin(t * 1.7) * 0.4;
          line.geometry.setFromPoints([new THREE.Vector3(state.botPos.x, state.botAltitudeY + 1.4, state.botPos.z), new THREE.Vector3(kx, ky, kz)]);
        };
        // How it really flies depends on the wind (js/wind.js)
        if (typeof windKiteProps === 'function') hobbyPropUpdate = windKiteProps(kite, line);
      } else if (hobby.style === 'music') {
        const notes = [];
        for (let i = 0; i < 6; i++) {
          const n = noteSprite(i % 2 ? '♪' : '♫', ['#facc15', '#f472b6', '#38bdf8'][i % 3]);
          n.userData.phase = i / 6;
          notes.push(n);
          hobbyProps.add(n);
        }
        hobbyPropUpdate = (t) => notes.forEach(n => {
          const p = (t * 0.35 + n.userData.phase) % 1;
          n.position.set(state.botPos.x + Math.sin(p * 8 + n.userData.phase * 6) * 0.6, state.botAltitudeY + 2.6 + p * 2.5, state.botPos.z);
          n.material.opacity = 1 - p;
        });
      } else if (hobby.style === 'easel') {
        const easel = new THREE.Group();
        const legMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2b });
        [-0.35, 0.35].forEach(x => {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.06), legMat);
          leg.position.set(x, 0.8, 0);
          easel.add(leg);
        });
        const canvasMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.75), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        canvasMesh.position.set(0, 1.25, 0.05);
        easel.add(canvasMesh);
        const ex = state.botPos.x + Math.sin(state.botRotY) * 1.1, ez = state.botPos.z + Math.cos(state.botRotY) * 1.1;
        easel.position.set(ex, getIslandGroundHeight(ex, ez), ez);
        easel.rotation.y = state.botRotY + Math.PI;
        easel.userData.canvasMesh = canvasMesh;
        hobbyProps.add(easel);
        hobbyProps.userData.easel = easel;
      } else if (hobby.style === 'mural') {
        // A spray-paint can in his hand while he works
        const can = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0xff3d7f, metalness: 0.6 }));
        if (typeof setCarriedObject === 'function') setCarriedObject(can);
      }
    }

// A quick landscape painting for the easel and the photo wall
function paintLandscape(skill, seed) {
      const rng = makeRng(seed);
      const c = document.createElement('canvas');
      c.width = 220;
      c.height = 165;
      const ctx = c.getContext('2d');
      const sky = ctx.createLinearGradient(0, 0, 0, 100);
      sky.addColorStop(0, rng() < 0.5 ? '#7dd3fc' : '#fda4af');
      sky.addColorStop(1, '#fef3c7');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, 220, 165);
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(0, 110);
      for (let x = 0; x <= 220; x += 40) ctx.lineTo(x + 20, 40 + rng() * 40), ctx.lineTo(x + 40, 110);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(0, 110, 220, 55);
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(0, 105, 220, 10);
      // Brush texture: rougher when he is new to it
      for (let i = 0; i < Math.max(20, 120 - skill); i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.05 + rng() * 0.1})`;
        ctx.fillRect(rng() * 220, rng() * 165, 6 + rng() * 10, 2);
      }
      return c;
    }

// Kelo-1 practises a hobby: goes somewhere fitting, does it for a while, and gets a bit better
async function practiceHobby(hobby, originLabel = 'Practising a Hobby') {
      if (!hobby || state.isBusy || state.isBuilding || state.isPracticing) return false;
      // No kite, or (once he knows) no wind for it (js/wind.js)
      if (hobby.style === 'kite' && typeof kiteWontFlyToday === 'function' && kiteWontFlyToday(hobby)) return false;
      state.isPracticing = true;
      try {
        const skillBefore = hobby.skill;
        let spot = null, wall = null;
        if (hobby.style === 'mural') {
          // Prefer a wall he hasn't painted yet, otherwise repaint his oldest one
          // He paints on canvas and hangs it in his Museum: the town's walls aren't his to change
          wall = { id: 'canvas-' + Date.now().toString(36), label: 'a canvas for his Museum' };
          spot = { x: MUSEUM_DOOR.x + 1.5, z: MUSEUM_DOOR.z, label: 'his Museum' };
        } else if (hobby.style === 'kite') {
          spot = pick([{ x: -16, z: -1.5, label: 'the West Island Meadow' }, { x: 2, z: 8.6, label: 'the beach' }]);
        } else if (hobby.style === 'plant') {
          spot = { x: -22 - Math.random() * 6, z: 3 + Math.random() * 3, label: 'the wildflower patch west of town' };
        } else if (hobby.style === 'easel') {
          spot = pick([{ x: 3, z: 8.4, label: 'the lakeshore' }, { x: -20, z: -12, label: 'the foot of the mountains' }]);
        } else {
          spot = pick([{ x: -16, z: -1.5, label: 'the meadow' }, { x: 4.2, z: 9.6, label: 'the lake edge' }, { x: -4, z: -2, label: 'the valley' }]);
        }

        // Fetch the gear for this hobby (paint, kite, instrument...) from the Storehouse first
        if (hobby.tool && typeof fetchFromStorehouse === 'function') await fetchFromStorehouse(hobby.tool);
        state.currentLocKey = 'custom';
        state.customPlaceName = spot.label;
        state.targetPos = { x: spot.x, z: spot.z };
        state.microPose = 'normal';
        state.moodEmoji = hobby.emoji;
        state.moodTitle = `Heading off to practise ${hobby.name}`.slice(0, 80);
        state.speechBubble = `Time for some ${hobby.name.toLowerCase()} at ${spot.label}.`;
        renderAllUI();
        await waitForArrival(45000);

        // Face the wall when painting
        if (wall) state.botRotY = wall.rotY + Math.PI;
        state.microPose = 'procedural_custom';
        state.proceduralMotion = {
          headPitch: hobby.style === 'kite' ? -0.35 : 0.1, headYawSpeed: 1.2, headTiltAmp: 0.2,
          armWaveAmp: hobby.style === 'mural' ? 0.6 : 0.35, armRaiseOffset: hobby.style === 'kite' ? -1.3 : -0.8,
          bodyBounceAmp: hobby.style === 'music' || hobby.style === 'tricks' ? 0.1 : 0.03, spinSpeed: 0, crouchOffset: 0, sparkBurst: false
        };
        state.moodTitle = `${hobby.name}${hobby.practiced ? '' : ' (first try!)'}`.slice(0, 80);
        renderAllUI();
        startPracticeProps(hobby);
        await new Promise(r => setTimeout(r, 9000 + Math.random() * 5000));

        // Results of practice
        hobby.practiced += 1;
        hobby.skill = Math.min(100, hobby.skill + 6 + Math.floor(Math.random() * 6));
        hobby.lastPracticed = Date.now();
        let result = '';
        if (hobby.style === 'mural' && wall) {
          const palette = [randomHex(), randomHex(), randomHex(), randomHex()];
          const words = ['KELO', 'K1', 'OKANAGAN', 'HELLO', 'WONDER', 'SPARK', 'GROW', ...state.concepts.slice(0, 3).map(c => conceptKeyword(c.name))];
          const mural = { wallId: wall.id, text: pick(words), palette, skill: hobby.skill, seed: `${wall.id}-${Date.now()}`, at: Date.now() };
          const level = typeof museumLevelForNext === 'function' ? museumLevelForNext('painting') : 0;
          state.murals = [mural, ...state.murals]; // every painting is kept: the Museum has basements
          if (level > 0) await visitBasement(museumHatchWorld(), level, 'Wall space for this painting');
          placeMural3D(mural);
          result = `I painted "${mural.text}" on a canvas and hung it in my Museum. ${hobby.skill > 50 ? 'The letters finally look like mine.' : 'The drips got away from me, but I love it.'}`;
        } else if (hobby.style === 'plant') {
          const planting = { x: state.botPos.x + 0.6, z: state.botPos.z + 0.4, color: randomHex(), at: Date.now() };
          state.plantings.unshift(planting);
          if (state.plantings.length > MAX_PLANTINGS) state.plantings.length = MAX_PLANTINGS;
          placePlanting3D(planting);
          result = 'I planted something new in my wildflower patch west of town. I will check on it every day.';
        } else if (hobby.style === 'easel') {
          const painting = paintLandscape(hobby.skill, `${Date.now()}`);
          const easel = hobbyProps && hobbyProps.userData.easel;
          if (easel) easel.userData.canvasMesh.material = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(painting) });
          state.photoAlbum.unshift({ thumb: painting.toDataURL('image/jpeg', 0.8), caption: `Painted by Kelo-1 (${spot.label})`, from: 'Kelo-1', palette: [], time: 'Just now', reaction: '' });
          if (typeof savePhotoAlbum === 'function') savePhotoAlbum();
          result = `I painted ${spot.label}. It's on the photo wall now.`;
          await new Promise(r => setTimeout(r, 3000));
        } else if (hobby.style === 'music') {
          const title = `${pick(['Ballad', 'Song', 'Blues', 'Lullaby', 'Jig'])} for ${pick(['the Lake', 'Ogopogo', 'the Post Office', 'Rusty Servos', 'the Night Peaks', 'My Visitors'])}`;
          result = `I composed "${title}" on my ${hobby.tool || 'instrument'}.`;
        } else if (hobby.style === 'kite') {
          result = typeof kiteSessionResult === 'function' ? kiteSessionResult(hobby, skillBefore)
            : hobby.skill > 40 ? 'The kite held steady for ages. I am learning to read the wind.' : 'The kite crashed twice, then flew. Worth it.';
        } else {
          result = `I spent a while on ${hobby.name.toLowerCase()}. I'm getting better at it.`;
        }

        state.speechBubble = result;
        state.changedLatelySummary = `Practised ${hobby.name} (skill ${skillBefore} → ${hobby.skill})`;
        state.happiness = Math.min(100, state.happiness + 6);
        state.calmLevel = Math.min(100, state.calmLevel + 4);
        state.diaryEntries.unshift({
          time: originLabel,
          location: spot.label,
          mood: `${hobby.emoji} ${hobby.name}`,
          vitals: `⚡ ${state.health}% • 🥕 ${state.fullness}% • ✨ ${state.wonderLevel}% • 🌊 ${state.calmLevel}%`,
          text: `Dear Diary, ${result} (${hobby.name} skill: ${hobby.skill}/100)`
        });
        if (typeof bumpLifeStat === 'function') bumpLifeStat('hobbySessions');
        savePersistentBrainState();
        renderAllUI();
        showToast(`${hobby.emoji} ${hobby.name}: skill ${hobby.skill}/100`);
        return true;
      } finally {
        clearHobbyProps();
        if (typeof setCarriedObject === 'function' && hobby.style === 'mural') setCarriedObject(null);
        state.isPracticing = false;
      }
    }

function placePlanting3D(planting) {
      if (!scene) return;
      const g = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x2f9e44 }));
      stem.position.y = 0.25;
      const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: planting.color, emissive: planting.color, emissiveIntensity: 0.15 }));
      bloom.position.y = 0.55;
      g.add(stem, bloom);
      g.position.set(planting.x, getAnalyticalGroundHeight(planting.x, planting.z), planting.z);
      scene.add(g);
    }

// Each animation frame: keep practice props (kite, notes) moving
function updateHobbyProps(t) {
      if (hobbyPropUpdate) hobbyPropUpdate(t);
    }

// How likely he is to practise a hobby on an autonomous tick
function hobbyPracticeChance() {
      return state.hobbies.length > 0 ? 0.22 : 0;
    }

function pickHobbyToPractise() {
      // Favour hobbies he hasn't done in a while
      const now = Date.now();
      const weighted = state.hobbies.map(h => ({ h, w: 1 + (now - (h.lastPracticed || h.startedAt)) / 3600000 }));
      let roll = Math.random() * weighted.reduce((s, x) => s + x.w, 0);
      for (const x of weighted) { roll -= x.w; if (roll <= 0) return x.h; }
      return state.hobbies[0];
    }

function renderHobbiesUI() {
      const el = document.getElementById('hobbiesContainer');
      if (!el) return;
      el.innerHTML = state.hobbies.length === 0
        ? '<p class="text-[11px] text-slate-500 italic">No hobbies yet. Some gifts (spray paint, a kite, an instrument, seeds, a paint set...) might spark one.</p>'
        : state.hobbies.map((h, i) => `
          <button data-hobby-idx="${i}" class="hobby-card w-full text-left p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-orange-500/25 hover:border-orange-400/60 transition space-y-1">
            <div class="flex items-center justify-between gap-2 text-xs">
              <span class="font-bold text-orange-200">${escapeHtml(h.emoji)} ${escapeHtml(h.name)}</span>
              <span class="text-[10px] font-mono text-slate-400">practised ${escapeHtml(h.practiced)}×</span>
            </div>
            <div class="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div class="h-full bg-orange-400" style="width:${Math.max(0, Math.min(100, Number(h.skill) || 0))}%"></div></div>
            <div class="text-[10px] font-mono text-slate-500 truncate">Skill ${escapeHtml(h.skill)}/100${h.sparkedBy ? ` • sparked by ${escapeHtml(h.sparkedBy)}` : ''}</div>
          </button>`).join('');
      el.querySelectorAll('.hobby-card').forEach(card => {
        card.addEventListener('click', () => {
          const h = state.hobbies[Number(card.getAttribute('data-hobby-idx'))];
          if (!h) return;
          if (state.isBusy || state.isBuilding || state.isPracticing) {
            showToast(`${h.emoji} Kelo-1 will get to ${h.name} when he's done with what he's doing.`);
            return;
          }
          practiceHobby(h, 'A Visitor Encouraged Him');
        });
      });
    }

window.addEventListener('DOMContentLoaded', () => {
  // This script loads before main.js, so wait until main.js has loaded his state and built the scene
  setTimeout(() => {
    state.murals.forEach(placeMural3D);
    state.plantings.forEach(placePlanting3D);
    renderHobbiesUI();
  }, 0);
});
