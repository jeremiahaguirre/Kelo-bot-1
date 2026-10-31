// Kelo-bot-1 — js/wind.js
// Loaded after seasons.js. The valley has wind: calm, a breeze, windy or a gale, blowing from a
// direction that drifts over his days. It is worked out from his calendar (one value per world
// hour, from a seed kept in his saved calendar), so a reload always agrees on today's weather.
// You can see it: the trees lean and sway, the clouds hurry along, and a wind sock at the balloon
// field fills out. It matters too:
//   - a kite needs wind: in a calm it just flops behind him, a breeze flies it, a gale can snap it
//   - a hot-air balloon is at the wind's mercy: in strong wind it is blown off course and comes
//     down hard in pieces, which he can carry to the welding table and weld back together

const WIND_LEVELS = [
  { key: 'calm', label: 'Calm', emoji: '🍃', below: 0.3 },
  { key: 'breeze', label: 'Breezy', emoji: '💨', below: 0.62 },
  { key: 'windy', label: 'Windy', emoji: '💨', below: 0.82 },
  { key: 'gale', label: 'Gale', emoji: '🌪️', below: Infinity }
];
// Spring and autumn are windier, summer a little stiller
const SEASON_WIND = { Spring: 0.07, Summer: -0.06, Autumn: 0.06, Winter: 0.02 };
// Where the wind sock stands: at the edge of the balloon field, clear of the balloon itself
const WIND_SOCK_SPOT = { x: -19.6, z: -6.4 };
// The pieces a crashed balloon breaks into
const BALLOON_PIECES = [
  { name: 'Torn balloon envelope', emoji: '🎈' },
  { name: 'Bent burner frame', emoji: '🔥' },
  { name: 'Cracked wicker basket', emoji: '🧺' }
];
const BROKEN_KITE = 'Broken kite';
const WELD_BENCH_TOP = { x: -1.2, z: -8.2, y: 0.92 };

// For testing or a visitor's experiment: set to 'calm' / 'breeze' / 'windy' / 'gale' to force it
let windOverride = null;
let windSock = null;
let wreckPile = null;
let windShown = { s: 0.3, angle: 0 }; // what the world is showing, eased toward the real wind
let kiteSession = null;
let lastWindRefusal = 0;

// --- Working out the wind ------------------------------------------------------------------------
// A repeatable number in [0, 1) for any whole number n (same seed, same answer)
function windHash(n) {
      let h = (windSeed() ^ Math.imul(n | 0, 0x9e3779b1)) >>> 0;
      h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
      h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }

function windSeed() {
      const cal = typeof ensureCalendar === 'function' ? ensureCalendar() : null;
      return cal && Number.isFinite(cal.epoch) ? (cal.epoch % 2147483647) | 0 : 12345;
    }

function windLevelFor(strength) {
      return WIND_LEVELS.find(l => strength < l.below);
    }

// The wind for one world hour: a slow day-to-day mood plus an hour-by-hour gust
function windForHour(hourIndex, season) {
      const day = Math.floor(hourIndex / 24), f = (hourIndex % 24) / 24;
      const dayMood = windHash(1000003 + day) * (1 - f) + windHash(1000003 + day + 1) * f;
      const strength = Math.max(0, Math.min(1, 0.55 * dayMood + 0.45 * windHash(hourIndex) + (SEASON_WIND[season] || 0)));
      // Direction: mostly from the west (the valley's prevailing wind), wandering through the day
      const dayAngle = (windHash(2000003 + day) - 0.5) * 2.4 * (1 - f) + (windHash(2000003 + day + 1) - 0.5) * 2.4 * f;
      const angle = dayAngle + (windHash(3000017 + hourIndex) - 0.5) * 1.2; // 0 = blowing toward the east
      return { strength, angle };
    }

let windCache = { at: 0, value: null };
function windNow() {
      if (windCache.value && Date.now() - windCache.at < 1000 && windCache.override === windOverride) return windCache.value;
      const w = typeof worldNow === 'function' ? worldNow() : { day: 1, hour: 12, season: 'Summer' };
      const hourIndex = (w.day - 1) * 24 + Math.floor(w.hour);
      let { strength, angle } = windForHour(hourIndex, w.season);
      if (windOverride) {
        const i = WIND_LEVELS.findIndex(l => l.key === windOverride);
        if (i >= 0) strength = [0.12, 0.45, 0.72, 0.93][i];
      }
      const level = windLevelFor(strength);
      // The direction it blows toward: +x is east, +z is south (toward the lake)
      const dx = Math.cos(angle), dz = Math.sin(angle);
      const value = { ...level, strength, angle, dx, dz, from: compassFrom(dx, dz), hourIndex };
      windCache = { at: Date.now(), value, override: windOverride };
      return value;
    }

// "from the west": the opposite of where it is blowing
function compassFrom(dx, dz) {
      const names = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
      const a = Math.atan2(-dz, -dx); // where it comes from, with +z pointing south
      return names[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
    }

function windAtLeast(key) {
      return WIND_LEVELS.findIndex(l => l.key === windNow().key) >= WIND_LEVELS.findIndex(l => l.key === key);
    }

// The top status line (js/worldclock.js)
function windStatusText() {
      const w = windNow();
      return w.key === 'calm' ? `${w.emoji} Calm` : `${w.emoji} ${w.label} from the ${w.from}`;
    }

function windSummaryForAI() {
      const w = windNow();
      const notes = [];
      if (state.knowsKiteWind) notes.push('you know a kite needs wind but a gale can snap it');
      if (state.knowsWindDanger) notes.push(windAtLeast('windy') ? 'too windy to fly a hot-air balloon right now (you crashed one in strong wind)' : 'calm or breezy is safe for a hot-air balloon');
      if (state.balloonWreck) notes.push(`your hot-air balloon lies in pieces${state.balloonWreck.gathered ? ' in your Storehouse' : ' where it crashed'}; you could weld it back together at the welding table`);
      return `${w.key === 'calm' ? 'calm, not a breath of wind' : `${w.label.toLowerCase()}, blowing from the ${w.from}`}${notes.length ? ` (${notes.join('; ')})` : ''}`;
    }

// --- What it looks like --------------------------------------------------------------------------
function buildWindSock3D() {
      if (!scene || windSock) return;
      const { x, z } = WIND_SOCK_SPOT;
      const gy = getAnalyticalGroundHeight(x, z);
      windSock = new THREE.Group();
      windSock.position.set(x, gy, z);
      const pole = mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.8, 8), 0x94a3b8, { metalness: 0.6 });
      pole.position.y = 1.9;
      const cap = mesh(new THREE.SphereGeometry(0.09, 10, 8), 0xdc2626);
      cap.position.y = 3.85;
      windSock.add(pole, cap);
      // The sock hangs from a swivel at the top; its stripes taper toward the open end
      const swivel = new THREE.Group();
      swivel.position.y = 3.6;
      const ring = mesh(new THREE.TorusGeometry(0.26, 0.025, 6, 16), 0x475569, { metalness: 0.7 });
      ring.rotation.y = Math.PI / 2;
      ring.position.x = 0.08;
      swivel.add(ring);
      const segs = [];
      let r = 0.26, x0 = 0.08;
      for (let i = 0; i < 5; i++) {
        const len = 0.34, r2 = r * 0.86;
        const seg = new THREE.Group();
        const tube = mesh(new THREE.CylinderGeometry(r, r2, len, 14, 1, true), i % 2 ? 0xf8fafc : 0xf97316, { side: THREE.DoubleSide, roughness: 0.9 });
        tube.rotation.z = -Math.PI / 2; // lie along +x
        tube.position.x = len / 2;
        seg.add(tube);
        seg.position.x = i === 0 ? x0 : len;
        (i === 0 ? swivel : segs[i - 1]).add(seg);
        segs.push(seg);
        r = r2;
      }
      swivel.userData.segs = segs;
      windSock.add(swivel);
      windSock.userData.swivel = swivel;
      scene.add(windSock);
      if (typeof worldObstacles !== 'undefined') worldObstacles.push({ x, z, r: 0.3 });
    }

// Every frame: ease toward the real wind, then sway the trees, push the clouds and fill the sock
function updateWindLook(t, dt) {
      const w = windNow();
      windShown.s += (w.strength - windShown.s) * Math.min(1, dt * 0.5);
      let da = w.angle - windShown.angle;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      windShown.angle += da * Math.min(1, dt * 0.4);
      const s = windShown.s, dx = Math.cos(windShown.angle), dz = Math.sin(windShown.angle);
      // Trees: the leafy tops lean downwind and rock, more as the wind picks up
      if (typeof valleyTrees !== 'undefined') {
        const lean = s * s * 0.32, rock = 0.02 + s * 0.12, speed = 1.2 + s * 3.5;
        valleyTrees.forEach((tree, i) => {
          const g = tree.group;
          if (!g || !g.parent) return;
          const ry = g.rotation.y, cos = Math.cos(ry), sin = Math.sin(ry);
          const gust = lean + Math.sin(t * speed + i * 1.7) * rock;
          const lx = (dx * cos - dz * sin) * gust, lz = (dx * sin + dz * cos) * gust;
          g.children.forEach(c => {
            if (!c.geometry || c.geometry.type !== 'SphereGeometry') return;
            if (!c.userData.windBase) c.userData.windBase = c.position.clone();
            const b = c.userData.windBase, k = b.y / 1.9; // higher leaves move more
            c.position.set(b.x + lx * k, b.y - Math.abs(gust) * 0.05 * k, b.z + lz * k);
          });
        });
      }
      // Clouds: scene.js drifts them east slowly; the wind adds its own push
      if (typeof cloudGroup !== 'undefined' && cloudGroup) {
        const push = s * s * 7 * dt;
        cloudGroup.children.forEach(c => {
          c.position.x += dx * push;
          c.position.z += dz * push;
          if (c.position.x > 80) c.position.x = -80;
          if (c.position.x < -80) c.position.x = 80;
          if (c.position.z > 20) c.position.z = -70;
          if (c.position.z < -70) c.position.z = 20;
        });
      }
      // The wind sock turns downwind; it hangs limp in a calm and stands straight out in a gale
      if (windSock) {
        const sw = windSock.userData.swivel;
        sw.rotation.y = Math.atan2(-dz, dx) + Math.sin(t * (0.8 + s * 2)) * (0.05 + s * 0.12);
        sw.rotation.z = -1.42 * Math.pow(1 - Math.min(1, s * 1.1), 1.4) - 0.04;
        sw.userData.segs.forEach((seg, i) => {
          seg.rotation.z = (i ? -0.12 * (1 - s) : 0) + Math.sin(t * (3 + s * 9) + i) * (0.02 + s * 0.07);
          seg.rotation.y = Math.sin(t * (2.5 + s * 8) + i * 1.3) * (0.03 + s * 0.08);
        });
      }
    }

// --- Models for the broken things ----------------------------------------------------------------
function crumpledFabric(radius, colors, seed) {
      const rng = makeRng(seed);
      const g = new THREE.Group();
      for (let i = 0; i < 7; i++) {
        const geo = new THREE.SphereGeometry(radius * (0.5 + rng() * 0.5), 8, 6);
        const p = geo.attributes.position;
        for (let k = 0; k < p.count; k++) p.setXYZ(k, p.getX(k) * (1 + (rng() - 0.5) * 0.5), p.getY(k) * (0.25 + rng() * 0.2), p.getZ(k) * (1 + (rng() - 0.5) * 0.5));
        geo.computeVertexNormals();
        const m = mesh(geo, colors[i % colors.length], { flatShading: true, roughness: 0.9 });
        m.position.set((rng() - 0.5) * radius * 2.2, radius * 0.15 + rng() * radius * 0.25, (rng() - 0.5) * radius * 2.2);
        m.rotation.y = rng() * Math.PI;
        g.add(m);
      }
      return g;
    }

function brokenEnvelopeModel() {
      const g = crumpledFabric(0.35, [0xdc2626, 0xfacc15], 'envelope');
      // A ripped flap sticking up
      const flap = slab([[0, 0], [0.4, 0.05], [0.25, 0.35], [0.05, 0.3]], 0.01, 0xdc2626, { side: THREE.DoubleSide });
      flap.position.set(0.1, 0.12, 0);
      flap.rotation.set(-0.6, 0.4, 0.2);
      g.add(flap);
      return g;
    }

function bentBurnerModel() {
      const steel = { metalness: 0.8, roughness: 0.35 };
      const g = new THREE.Group();
      // Four uprights, two of them buckled
      g.add(rod([-0.3, 0, -0.3], [-0.15, 0.55, -0.12], 0.02, 0x94a3b8, steel));
      g.add(rod([0.3, 0, -0.3], [0.32, 0.3, -0.2], 0.02, 0x94a3b8, steel), rod([0.32, 0.3, -0.2], [0.05, 0.45, 0.05], 0.02, 0x94a3b8, steel));
      g.add(rod([-0.3, 0, 0.3], [-0.5, 0.25, 0.5], 0.02, 0x94a3b8, steel));
      g.add(rod([0.3, 0, 0.3], [0.12, 0.5, 0.15], 0.02, 0x94a3b8, steel));
      const burner = mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.18, 12), 0x64748b, steel);
      burner.position.set(-0.02, 0.5, 0.0);
      burner.rotation.z = 0.7;
      const tank = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.42, 12), 0xe5e7eb, { metalness: 0.4 });
      tank.position.set(0.45, 0.11, -0.25);
      tank.rotation.z = Math.PI / 2;
      g.add(burner, tank);
      return g;
    }

function crackedBasketModel() {
      const g = new THREE.Group();
      const box = new THREE.Group();
      // Wicker sides, with one wall caved in
      [[0, 0.3, -0.35, 0.7, 0.6, 0.05, 0], [-0.35, 0.3, 0, 0.05, 0.6, 0.7, 0], [0.35, 0.3, 0, 0.05, 0.6, 0.7, 0], [0, 0.03, 0, 0.7, 0.05, 0.7, 0], [0.05, 0.22, 0.38, 0.7, 0.45, 0.05, 0.35]].forEach(([x, y, z, w, h, d, tilt]) => {
        const wall = mesh(new THREE.BoxGeometry(w, h, d), 0x9a6b3f, { roughness: 1 });
        wall.position.set(x, y, z);
        wall.rotation.x = tilt;
        box.add(wall);
      });
      for (let i = 0; i < 4; i++) box.add(at(mesh(new THREE.BoxGeometry(0.72, 0.02, 0.72), 0x7c5230), 0, 0.12 + i * 0.14, -0.01));
      // Snapped slats poking out
      [[0.2, 0.5, 0.38, 0.6], [-0.15, 0.45, 0.4, -0.5], [0.36, 0.55, 0.1, 0.9]].forEach(([x, y, z, rz]) => {
        const s = mesh(new THREE.BoxGeometry(0.03, 0.3, 0.03), 0xc8955a);
        s.position.set(x, y, z);
        s.rotation.set(0.5, 0, rz);
        box.add(s);
      });
      box.rotation.z = Math.PI / 2 * 0.92; // lying on its side
      box.position.set(0.3, 0.35, 0);
      g.add(box);
      return g;
    }

function brokenKiteModel() {
      const g = new THREE.Group();
      const sail = slab([[0, 0.4], [0.22, 0.05], [0.05, -0.35], [-0.2, 0.05]], 0.01, 0xef4444, { side: THREE.DoubleSide });
      sail.rotation.x = -Math.PI / 2 + 0.25;
      sail.position.y = 0.05;
      g.add(sail);
      g.add(rod([0, 0.06, -0.38], [0.02, 0.06, 0.1], 0.008, 0x8a5a2b), rod([0.02, 0.06, 0.1], [0.12, 0.15, 0.3], 0.008, 0x8a5a2b));
      g.add(rod([-0.2, 0.06, -0.05], [0.22, 0.06, -0.05], 0.008, 0x8a5a2b));
      // A loose tangle of string
      const pts = [];
      for (let i = 0; i < 30; i++) pts.push(new THREE.Vector3(Math.sin(i * 1.3) * 0.12 + 0.2, 0.02 + (i % 3) * 0.01, Math.cos(i * 1.1) * 0.1 + 0.3));
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffffff })));
      return g;
    }

// The heap where the balloon came down: the envelope spread out, the basket on its side, the frame bent
function buildWreckPile() {
      const g = new THREE.Group();
      const envelope = crumpledFabric(1.6, [0xdc2626, 0xfacc15, 0xdc2626], 'wreck-envelope');
      envelope.position.set(-1.6, 0, 0.4);
      envelope.scale.set(1.4, 1, 1);
      const flap = slab([[0, 0], [1.6, 0.2], [1.1, 1.3], [0.2, 1.1]], 0.02, 0xfacc15, { side: THREE.DoubleSide });
      flap.position.set(-2.4, 0.4, -0.6);
      flap.rotation.set(-0.9, 0.5, 0.3);
      const basket = crackedBasketModel();
      basket.scale.setScalar(2.2);
      basket.position.set(0.9, 0, 0.2);
      basket.rotation.y = 0.4;
      const frame = bentBurnerModel();
      frame.scale.setScalar(2.4);
      frame.position.set(0.4, 0, -1.2);
      frame.rotation.y = -0.8;
      g.add(envelope, flap, basket, frame);
      // Ropes trailing from the basket to the envelope
      [[-0.2, 0.9], [0, -0.3]].forEach(([oz, ez]) => {
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.6, 0.8, oz), new THREE.Vector3(-0.3, 0.1, oz + 0.3), new THREE.Vector3(-1.2, 0.35, ez)]);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.025, 5), new THREE.MeshStandardMaterial({ color: 0x334155 })));
      });
      // Bits of wicker scattered about
      const rng = makeRng('wreck-bits');
      for (let i = 0; i < 12; i++) {
        const bit = mesh(new THREE.BoxGeometry(0.05, 0.05, 0.3 + rng() * 0.4), 0xc8955a);
        bit.position.set((rng() - 0.3) * 4, 0.03, (rng() - 0.5) * 3.5);
        bit.rotation.y = rng() * Math.PI;
        g.add(bit);
      }
      return g;
    }

function renderWreckPile3D() {
      if (!scene) return;
      if (wreckPile) {
        scene.remove(wreckPile);
        wreckPile = null;
      }
      const wreck = state.balloonWreck;
      if (!wreck || wreck.gathered) return;
      wreckPile = buildWreckPile();
      wreckPile.position.set(wreck.x, getAnalyticalGroundHeight(wreck.x, wreck.z), wreck.z);
      wreckPile.rotation.y = wreck.rotY || 0;
      scene.add(wreckPile);
    }

// While the pieces are still lying where it crashed, they aren't on the Storehouse shelves (js/storehouse.js)
function wreckPieceAtCrash(name) {
      const wreck = state.balloonWreck;
      return Boolean(wreck && !wreck.gathered && (wreck.pieces || []).includes(name));
    }

// --- Kite flying --------------------------------------------------------------------------------
function ownedNames() {
      return [...state.toolInventory, ...state.toys.map(t => t.name), ...state.belongings.map(b => b.name)];
    }

function workingKite() {
      return ownedNames().find(n => /kite/i.test(n) && !/broken|snapped|torn/i.test(n)) || null;
    }

// Before heading out with the kite: is there a kite, and (once he knows) is there any wind?
function kiteWontFlyToday(hobby) {
      if (!workingKite() && (hobby.tool || ownedNames().some(n => /broken kite/i.test(n)))) {
        state.speechBubble = 'My kite is broken: the gale snapped its string. I have asked for a new one.';
        addItemRequest('A new kite', 'toy', 'A gale snapped the string on my last kite and wrecked it.', 'Kite Flying');
        renderAllUI();
        return true;
      }
      if (state.knowsKiteWind && windNow().key === 'calm') {
        state.speechBubble = "Not a breath of wind today. A kite won't fly in a calm, so I'll try another day.";
        renderAllUI();
        return true;
      }
      if (state.knowsKiteWind && windNow().key === 'gale' && Math.random() < 0.7) {
        state.speechBubble = 'A gale out there. That would snap the kite string again, so not today.';
        renderAllUI();
        return true;
      }
      return false;
    }

// The kite's flight (hobbies.js gives us the kite and its line): how it moves depends on the wind
function windKiteProps(kite, line) {
      const w = windNow();
      const spot = { ...state.botPos };
      kiteSession = { key: w.key, snapped: false, snapAt: w.key === 'gale' && Math.random() < 0.6 ? Date.now() + 5000 + Math.random() * 3000 : 0, flyAway: null };
      const session = kiteSession;
      const hand = () => new THREE.Vector3(state.botPos.x, state.botAltitudeY + 1.4, state.botPos.z);
      if (w.key === 'calm') {
        // He runs back and forth trying to get it up; it bounces along behind him and drops
        state.speechBubble = 'Come on, up you go! ...Why won\'t it fly?';
        renderAllUI();
        let leg = 0;
        const run = setInterval(() => {
          if (kiteSession !== session) return clearInterval(run);
          leg++;
          state.targetPos = { x: spot.x + (leg % 2 ? 6 : -1), z: spot.z + (leg % 2 ? 0.5 : -0.5) };
          if (leg === 2) { state.speechBubble = 'I run, it lifts... and flops right back down.'; renderAllUI(); }
        }, 2600);
        state.targetPos = { x: spot.x + 6, z: spot.z + 0.5 };
        return (t) => {
          const dirX = state.targetPos.x >= state.botPos.x ? 1 : -1;
          const hop = Math.max(0, Math.sin(t * 2.6)) * (state.isWalking ? 1.3 : 0.2);
          const kx = state.botPos.x - dirX * 2.6, kz = state.botPos.z + 0.4;
          const ky = getAnalyticalGroundHeight(kx, kz) + 0.25 + hop;
          kite.position.set(kx, ky, kz);
          kite.rotation.set(-1.2 + hop * 0.6, 0, Math.sin(t * 5) * 0.3);
          line.geometry.setFromPoints([hand(), new THREE.Vector3(kx, ky, kz)]);
        };
      }
      const strong = { breeze: 0, windy: 1, gale: 2 }[w.key];
      const out = 5 + strong * 1.5, up = 7 + strong * 1.8, wobble = 0.6 + strong * 0.9;
      return (t) => {
        if (session.snapAt && !session.snapped && Date.now() > session.snapAt) {
          session.snapped = true;
          session.flyAway = { x: kite.position.x, y: kite.position.y, z: kite.position.z, at: t };
          state.moodEmoji = '😱';
          state.speechBubble = 'SNAP! The string broke! There it goes!';
          renderAllUI();
        }
        if (session.flyAway) {
          // Torn loose: it tumbles away downwind and down into the grass
          const f = session.flyAway, k = Math.min(1, (t - f.at) / 3);
          const kx = f.x + w.dx * k * 14, kz = f.z + w.dz * k * 14;
          kite.position.set(kx, Math.max(getAnalyticalGroundHeight(kx, kz) + 0.2, f.y + Math.sin(k * Math.PI) * 2 - k * k * f.y), kz);
          kite.rotation.set(t * 6, t * 4, t * 5);
          line.geometry.setFromPoints([hand(), new THREE.Vector3(state.botPos.x + 0.3, state.botAltitudeY + 0.2, state.botPos.z)]);
          return;
        }
        const jerk = strong === 2 ? Math.sin(t * 7.3) * 1.2 + Math.sin(t * 11.1) * 0.6 : 0;
        const side = Math.sin(t * (0.7 + strong * 0.6)) * wobble;
        const kx = state.botPos.x + w.dx * out - w.dz * side + jerk * 0.3;
        const kz = state.botPos.z + w.dz * out + w.dx * side;
        const ky = state.botAltitudeY + up + Math.sin(t * 1.3 + strong) * (0.5 + strong * 0.5) + jerk * 0.4;
        kite.position.set(kx, ky, kz);
        kite.rotation.set(0, Math.atan2(w.dx, w.dz), Math.sin(t * (1.7 + strong * 2)) * (0.3 + strong * 0.25));
        line.geometry.setFromPoints([hand(), new THREE.Vector3(kx, ky, kz)]);
      };
    }

// After the session: what happened, depending on the wind (returns what he says)
function kiteSessionResult(hobby, skillBefore) {
      const session = kiteSession || { key: windNow().key, snapped: false };
      kiteSession = null;
      state.targetPos = { ...state.botPos };
      const firstLesson = !state.knowsKiteWind;
      if (session.key === 'calm') {
        hobby.skill = Math.min(100, skillBefore + 1);
        state.knowsKiteWind = true;
        state.happiness = Math.max(0, state.happiness - 6);
        if (firstLesson && typeof addConcept === 'function') {
          addConcept({ name: 'Kites Ride The Wind', emoji: '🪁', definition: 'A kite only flies when moving air pushes up on it; on a still day it just falls.', builtFrom: ['a kite that would not fly'] }, 'Learned the hard way');
        }
        return firstLesson
          ? "There was no wind at all. I ran and ran and the kite just flopped along behind me. So that's the secret: kites need wind. I'll wait for a breezy day."
          : 'Still no wind. I ran up and down the meadow, but a kite needs moving air.';
      }
      if (session.snapped) {
        breakKite(hobby);
        state.knowsKiteWind = true;
        state.happiness = Math.max(0, state.happiness - 10);
        if (typeof addConcept === 'function') addConcept({ name: 'Too Much Wind', emoji: '🌪️', definition: 'Wind lifts a kite, but a gale pulls harder than its string can hold.', builtFrom: ['a kite string snapping in a gale'] }, 'Learned the hard way');
        return 'A gale was blowing. The kite yanked so hard I could barely hold it, then the string snapped and it crashed into the grass, broken. Too much wind is as bad as none.';
      }
      if (session.key === 'gale') {
        state.knowsKiteWind = true;
        return "What a gale! The kite tugged and dived and I could barely hang on. I got it down in one piece, but it was close.";
      }
      if (session.key === 'windy') {
        hobby.skill = Math.min(100, hobby.skill + 2);
        return `A strong wind from the ${windNow().from}. The kite shot straight up and pulled hard on the string. Exciting!`;
      }
      state.knowsKiteWind = state.knowsKiteWind || hobby.skill > 30;
      return hobby.skill > 40
        ? `A steady breeze from the ${windNow().from}. The kite climbed and just hung there. I am learning to read the wind.`
        : 'A nice breeze. The kite wobbled, dipped twice, then climbed and flew. Worth it.';
    }

// The kite he was flying becomes a broken one he carries home
function breakKite(hobby) {
      const name = hobby.tool && ownedNames().includes(hobby.tool) ? hobby.tool : workingKite();
      if (name) {
        const drop = (arr, match) => { const i = arr.findIndex(match); if (i >= 0) arr.splice(i, 1); return i >= 0; };
        drop(state.toolInventory, n => n === name) || drop(state.toys, t => t.name === name) || drop(state.belongings, b => b.name === name);
      }
      delete hobby.tool;
      state.belongings.unshift({ name: BROKEN_KITE, category: 'broken', emoji: '🪁', from: 'a gale snapped its string' });
      state.unstoredItems.push(BROKEN_KITE);
      showToast('🪁 The kite string snapped: the kite is broken');
    }

// --- Hot-air balloons and strong wind ------------------------------------------------------------
function isBalloon(v) {
      return Boolean(v && /hot.?air balloon/i.test(v.name));
    }

// Would a flight in this right now end badly?
function windWillCrash(v) {
      return isBalloon(v) && windAtLeast('windy');
    }

// For travelTo: once he has learned, he checks the wind before taking the balloon up
function safeToFly(v) {
      if (!isBalloon(v) || !state.knowsWindDanger || !windAtLeast('windy')) return true;
      if (Date.now() - lastWindRefusal > 60000) {
        lastWindRefusal = Date.now();
        state.speechBubble = `${windNow().label} today. I learned the hard way that the balloon can't fly in that, so I'll go another way.`;
      }
      return false;
    }

// Called by driveVehicle once he is in the basket: the wind takes over, blows him off course,
// and the balloon comes down hard in pieces
async function crashInWind(v, target) {
      const w = windNow();
      const type = vehicleTypeFor(v.name);
      const plain = v.name.replace(/^(an?|the)\s+/i, '');
      try {
        state.moodEmoji = '🎈';
        state.moodTitle = `Lifting off in the ${plain}`;
        state.speechBubble = 'Up we go... whoa. The wind is a lot stronger up here.';
        renderAllUI();
        // Blown downwind of where he meant to go, but kept over land (not the lake, not the high peaks)
        const blow = w.key === 'gale' ? 22 : 15;
        const mid = { x: (state.botPos.x + target.x) / 2, z: (state.botPos.z + target.z) / 2 };
        let bx = Math.max(WORLD_MIN_X + 6, Math.min(WORLD_MAX_X - 6, mid.x + w.dx * blow));
        let bz = Math.max(-11, Math.min(6, mid.z + w.dz * blow));
        if (typeof offLimits === 'function' && offLimits(bx, bz, 2)) {
          // Not on top of a building or the pit: a little further on
          for (let k = 1; k < 8 && offLimits(bx, bz, 2); k++) { bx += w.dx * 3 * (k % 2 ? 1 : -1) + 3; bz = Math.max(-11, Math.min(6, bz - 1.5)); }
        }
        state.ridingSpeed = type.speed * 1.7;
        state.targetPos = { x: bx, z: bz };
        const shout = setTimeout(() => {
          state.moodEmoji = '😨';
          state.moodTitle = `Blown off course in the ${plain}!`;
          state.speechBubble = `I can't steer it! The wind from the ${w.from} is pushing me sideways!`;
          renderAllUI();
        }, 2500);
        await waitForArrival(60000);
        clearTimeout(shout);
        // Down it comes: it drops fast and tips over as it hits the ground
        state.speechBubble = "I'm going down! Hold on!";
        renderAllUI();
        const m = vehicleMeshes[v.id];
        if (m) {
          const start = performance.now();
          await new Promise(resolve => {
            const step = () => {
              const k = Math.min(1, (performance.now() - start) / 1400);
              m.userData.lift = 1 - k * k;
              m.rotation.z = k * 0.9;
              if (k < 1) requestAnimationFrame(step); else resolve();
            };
            requestAnimationFrame(step);
          });
        }
      } finally {
        state.riding = null;
        state.ridingSpeed = 1;
        state.ridingMode = null;
      }
      wreckBalloon(v, w);
    }

// The balloon is gone: in its place, a heap of pieces he owns and has to deal with
function wreckBalloon(v, w = windNow()) {
      const x = Math.round(state.botPos.x * 10) / 10, z = Math.round(state.botPos.z * 10) / 10;
      const plain = v.name.replace(/^(an?|the)\s+/i, '');
      // Off the list of vehicles and out of everything he owns (or vehicles.js would park it again)
      state.vehicles = state.vehicles.filter(o => o.id !== v.id);
      let list = 'belongings';
      const drop = (arr, match) => { const i = arr.findIndex(match); if (i >= 0) arr.splice(i, 1); return i >= 0; };
      if (drop(state.toolInventory, n => n === v.name)) list = 'toolInventory';
      else if (drop(state.toys, t => t.name === v.name)) list = 'toys';
      else drop(state.belongings, b => b.name === v.name);
      state.unstoredItems = state.unstoredItems.filter(n => n !== v.name);
      renderVehicles3D();
      const pieces = BALLOON_PIECES.map(p => p.name);
      BALLOON_PIECES.forEach(p => state.belongings.unshift({ name: p.name, category: 'broken', emoji: p.emoji, from: `my ${plain}, wrecked in a ${w.label.toLowerCase()}` }));
      state.balloonWreck = { name: v.name, list, x, z, rotY: Math.atan2(-w.dz, w.dx), pieces, fuel: typeof v.fuel === 'number' ? v.fuel : 100, at: Date.now(), wind: w.key, gathered: false };
      renderWreckPile3D();
      // He climbs out beside the heap, shaken
      state.botPos = { x: x + 2.6, z: z + 1.8 };
      state.targetPos = { ...state.botPos };
      state.currentLocKey = 'custom';
      state.customPlaceName = 'where my balloon crashed';
      state.moodEmoji = '😵';
      state.moodTitle = `Crashed the ${plain}`;
      state.health = Math.max(5, state.health - 12);
      state.calmLevel = Math.max(5, state.calmLevel - 25);
      state.happiness = Math.max(0, state.happiness - 12);
      const firstTime = !state.knowsWindDanger;
      state.knowsWindDanger = true;
      state.speechBubble = firstTime
        ? `Ow. The ${plain} is in pieces: the envelope is torn, the burner frame is bent and the basket cracked. A balloon can't fight the wind. I'll check the wind before I fly again.`
        : `I flew in the wind again and it threw me down again. The ${plain} is in pieces.`;
      state.diaryEntries.unshift({
        time: 'Balloon Crash', location: 'where my balloon came down', mood: `😵 Crashed in a ${w.label.toLowerCase()}`,
        vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, I took the ${plain} up while it was ${w.label.toLowerCase()} from the ${w.from}. A balloon has no steering: it goes wherever the wind goes. It blew me right off course and brought me down hard. Now it is a torn envelope, a bent burner frame and a cracked basket. I think I can weld it back together at the welding table. From now on I check the wind first: calm or a light breeze only.`
      });
      if (firstTime && typeof addConcept === 'function') {
        addConcept({ name: 'The Wind Steers Balloons', emoji: '🎈', definition: 'A hot-air balloon drifts with the wind; in strong wind it cannot be controlled, so fly only when it is calm or breezy.', builtFrom: ['crashing my balloon'] }, 'Learned the hard way');
      }
      if (typeof bumpLifeStat === 'function') bumpLifeStat('crashes');
      showToast(`💥 The ${plain} crashed in the wind and broke into pieces`);
      savePersistentBrainState();
      renderAllUI();
    }

// A flight just for the view: up from the balloon field, across the valley and back (if the wind allows)
function balloonFlightChance() {
      return state.vehicles.some(isBalloon) ? 0.06 : 0;
    }

async function flyBalloon(originLabel = 'Up in the Balloon') {
      const v = state.vehicles.find(isBalloon);
      if (!v || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      // Says why not (and sets about fixing it) if he doesn't know how yet or the propane is empty
      if (typeof readyToOperate === 'function' && !readyToOperate(v.name, v)) return false;
      if (!safeToFly(v)) { renderAllUI(); return false; }
      state.isPracticing = true;
      const plain = v.name.replace(/^(an?|the)\s+/i, '');
      try {
        const home = { x: v.x, z: v.z };
        const over = pick([{ x: 6, z: -2, label: 'over the town' }, { x: -8, z: 4, label: 'over the beach' }, { x: 14, z: -8, label: 'over the valley' }]);
        state.currentLocKey = 'custom';
        state.customPlaceName = 'the balloon field';
        await driveVehicle(v, over, `Flying the ${plain} ${over.label}`);
        if (!state.vehicles.includes(v)) return true; // the wind brought it down (js/wind.js)
        state.speechBubble = pick(['The whole valley is laid out below me like a map.', 'So quiet up here, just the burner and the wind.', 'I can see the lake, the town and the mountains all at once!']);
        renderAllUI();
        await new Promise(r => setTimeout(r, 1500));
        await driveVehicle(v, home, `Flying the ${plain} home to the balloon field`);
        if (!state.vehicles.includes(v)) return true;
        Object.assign(v, { x: home.x, z: home.z, rotY: 0 });
        renderVehicles3D();
        state.happiness = Math.min(100, state.happiness + 10);
        state.wonderLevel = Math.min(100, state.wonderLevel + 6);
        state.diaryEntries.unshift({
          time: originLabel, location: 'the sky above the valley', mood: `🎈 Flew the ${plain}`,
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I lit the burner and the ${plain} lifted me high above the trees. I drifted ${over.label} on a ${windNow().label.toLowerCase()} day and came gently back down on the balloon field.`
        });
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        state.isPracticing = false;
      }
    }

// --- Welding it back together ---------------------------------------------------------------------
function repairChance() {
      return state.balloonWreck ? 0.08 : 0;
    }

async function repairBalloon(originLabel = 'Fixing the Balloon') {
      const wreck = state.balloonWreck;
      if (!wreck || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isBuilding = true;
      const plain = wreck.name.replace(/^(an?|the)\s+/i, '');
      const piecesModel = () => {
        const g = new THREE.Group();
        const env = brokenEnvelopeModel(), frame = bentBurnerModel(), basket = crackedBasketModel();
        env.position.set(0, 0.55, 0);
        frame.position.set(0.1, 0.4, 0);
        g.add(basket, frame, env);
        g.scale.setScalar(0.55);
        return g;
      };
      try {
        // 1. Gather the pieces: from the crash site, or off the Storehouse shelves
        if (!wreck.gathered) {
          state.currentLocKey = 'custom';
          state.customPlaceName = 'where my balloon crashed';
          state.microPose = 'normal';
          state.moodEmoji = '🧺';
          state.moodTitle = `Gathering up the pieces of the ${plain}`;
          state.speechBubble = `Time to fix the ${plain}. First I need all the pieces.`;
          renderAllUI();
          if (typeof travelTo === 'function') await travelTo({ x: wreck.x + 2.2, z: wreck.z + 1.5 }, `Heading to the ${plain} wreck`);
          else { state.targetPos = { x: wreck.x + 2.2, z: wreck.z + 1.5 }; await waitForArrival(90000); }
          state.microPose = 'digging';
          state.speechBubble = 'Folding the envelope, untangling the ropes, picking up every bit of wicker.';
          renderAllUI();
          await new Promise(r => setTimeout(r, 2500));
          wreck.gathered = true;
          renderWreckPile3D();
        } else if (typeof fetchFromStorehouse === 'function') {
          await fetchFromStorehouse(BALLOON_PIECES[0].name);
        }
        if (typeof setCarriedObject === 'function') setCarriedObject(piecesModel());

        // 2. Carry them to the welding table
        const bench = TOWN_LOCATIONS.weld;
        state.currentLocKey = 'custom';
        state.customPlaceName = bench.building;
        state.microPose = 'normal';
        state.moodTitle = `Carrying the ${plain} pieces to the welding table`;
        state.speechBubble = 'Off to the welding table with all of it.';
        renderAllUI();
        state.targetPos = { x: bench.x, z: bench.z };
        await waitForArrival(90000);
        if (typeof setCarriedObject === 'function') setCarriedObject(null);

        // 3. Weld and patch: the pieces sit on the bench while the sparks fly
        const onBench = piecesModel();
        onBench.scale.setScalar(0.4);
        onBench.position.set(WELD_BENCH_TOP.x, getAnalyticalGroundHeight(WELD_BENCH_TOP.x, WELD_BENCH_TOP.z) + WELD_BENCH_TOP.y, WELD_BENCH_TOP.z);
        scene.add(onBench);
        state.currentLocKey = 'weld';
        state.microPose = 'procedural_custom';
        state.proceduralMotion = { headPitch: 0.25, headYawSpeed: 1, headTiltAmp: 0.1, armWaveAmp: 0.4, armRaiseOffset: -0.9, bodyBounceAmp: 0.02, spinSpeed: 0, crouchOffset: 0, sparkBurst: true };
        state.moodEmoji = '👨‍🏭';
        state.moodTitle = `Repairing the ${plain}`;
        const steps = ['Welding the burner frame straight again...', 'Patching the torn envelope, gore by gore...', 'Lacing new wicker into the cracked basket...'];
        for (const step of steps) {
          state.speechBubble = step;
          renderAllUI();
          await new Promise(r => setTimeout(r, 2600));
        }
        scene.remove(onBench);

        // 4. Good as new: the pieces are used up and the balloon is back at the balloon field
        wreck.pieces.forEach(p => { if (typeof forgetItem === 'function') forgetItem(p); });
        const entry = { name: wreck.name, category: 'vehicle', emoji: '🎈', from: 'welded back together' };
        if (wreck.list === 'toolInventory') state.toolInventory.push(wreck.name);
        else if (wreck.list === 'toys') state.toys.push({ name: wreck.name });
        else state.belongings.unshift(entry);
        state.balloonWreck = null;
        renderWreckPile3D();
        const v = registerVehicle(wreck.name);
        if (v) v.fuel = wreck.fuel;
        state.proceduralMotion = { ...state.proceduralMotion, sparkBurst: false };
        state.currentLocKey = 'custom';
        state.moodEmoji = '🎈';
        state.moodTitle = `Fixed the ${plain}`;
        state.speechBubble = `The ${plain} is whole again and back on the balloon field. Next time I check the wind before I go up.`;
        state.happiness = Math.min(100, state.happiness + 12);
        state.wonderLevel = Math.min(100, state.wonderLevel + 5);
        state.diaryEntries.unshift({
          time: originLabel, location: 'Outdoor Welding Studio', mood: `👨‍🏭 Repaired the ${plain}`,
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I carried the pieces of my ${plain} to the welding table. I welded the burner frame straight, patched the envelope and laced new wicker into the basket. It's back on the balloon field. Calm or breezy days only from now on.`
        });
        showToast(`🎈 Kelo-1 welded the ${plain} back together`);
        savePersistentBrainState();
        renderAllUI();
        return true;
      } catch (err) {
        console.warn('Balloon repair failed:', err);
        return false;
      } finally {
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.isBuilding = false;
      }
    }

// The broken things have their own models on the shelves and in his arms
ITEM_MODEL_RULES.unshift(
  [/torn balloon envelope/, () => realSize(brokenEnvelopeModel())],
  [/bent burner frame/, () => realSize(bentBurnerModel())],
  [/cracked wicker basket/, () => realSize(crackedBasketModel())],
  [/broken kite/, () => realSize(brokenKiteModel())]
);

window.addEventListener('DOMContentLoaded', () => {
  // After main.js has loaded his state and built the scene
  setTimeout(() => {
    buildWindSock3D();
    renderWreckPile3D();
    const w = windNow();
    windShown = { s: w.strength, angle: w.angle };
    let last = performance.now();
    (function frame(now) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      updateWindLook(now / 1000, dt);
      requestAnimationFrame(frame);
    })(last);
  }, 400);
});
