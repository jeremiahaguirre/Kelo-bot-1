// Kelo-bot-1 — js/minimap.js
// Loaded after explore.js. A small map of the island in the bottom-left corner, drawn on a canvas
// from the real terrain heights: the lake, beach, meadow, mountains (and the snow on them), the
// buildings, the vehicle yard, helipad, balloon field and dock, his digs, roads, hills, plantings,
// new land and builds, his vehicles, Kelo-1 himself (an arrow pointing the way he faces) and a
// light patch showing what the camera can see. Click the map to fly there; + and − zoom the map.

const MINIMAP_W = 128, MINIMAP_H = 96;        // world size it covers (the whole island)
const MINIMAP_RES = 1.5;                      // terrain samples per world unit for the base picture
const minimap = { canvas: null, ctx: null, base: null, baseSig: '', zoom: 1, lastDraw: 0 };

// The buildings, as footprints (x, z = centre; w, d = size)
function minimapBuildings() {
      const b = [];
      if (typeof HOUSE !== 'undefined') b.push({ x: HOUSE.x, z: HOUSE.z, w: HOUSE.w, d: HOUSE.d, color: '#c08457', icon: '🏠' });
      if (typeof STOREHOUSE !== 'undefined') b.push({ x: STOREHOUSE.x, z: STOREHOUSE.z, w: STOREHOUSE.w, d: STOREHOUSE.d, color: '#b91c1c', icon: '📦' });
      if (typeof MUSEUM !== 'undefined') b.push({ x: MUSEUM.x, z: MUSEUM.z, w: MUSEUM.w, d: MUSEUM.d, color: '#e2e8f0', icon: '🏛️' });
      b.push({ x: 12.5, z: -3.0, w: 4.2, d: 3.2, color: '#dc2626', icon: '📮' });   // Post Office (js/scene.js)
      b.push({ x: 6.8, z: 2.2, w: 4.2, d: 3.0, color: '#312e81', icon: '💻' });     // NetNode
      b.push({ x: -1.5, z: 3.5, w: 3.6, d: 3.0, color: '#ea580c', icon: '☕' });    // Bean & Byte
      b.push({ x: -1.2, z: -8.2, w: 2.4, d: 1.6, color: '#334155', icon: '🔥' });   // welding studio
      return b;
    }

// Something that changes the ground: when it changes, the base picture is redrawn
function minimapSignature() {
      const digs = (state.digSites || []).map(d => `${d.x},${d.z},${d.depth.toFixed(1)}`).join(';');
      const edits = (state.worldEdits || []).map(e => e.id).join(';');
      const fills = (state.landFills || []).map(f => `${f.id || f.x},${Math.round(f.volume || 0)},${f.done ? 1 : 0}`).join(';');
      const season = typeof currentSeason === 'function' ? currentSeason() : '';
      return [digs, edits, fills, season].join('|');
    }

// The terrain picture: colour by height, with soft hill shading
function minimapBuildBase() {
      const cw = Math.round(MINIMAP_W * MINIMAP_RES), ch = Math.round(MINIMAP_H * MINIMAP_RES);
      const off = document.createElement('canvas');
      off.width = cw; off.height = ch;
      const ctx = off.getContext('2d');
      const img = ctx.createImageData(cw, ch);
      const water = typeof WATER_LEVEL === 'number' ? WATER_LEVEL : -0.18;
      const season = typeof currentSeason === 'function' ? currentSeason() : 'Summer';
      const snowLine = typeof SNOW_LINE !== 'undefined' ? SNOW_LINE[season] : 99;
      const hs = new Float32Array(cw * ch);
      for (let j = 0; j < ch; j++) {
        for (let i = 0; i < cw; i++) {
          const x = -MINIMAP_W / 2 + (i + 0.5) / MINIMAP_RES, z = -MINIMAP_H / 2 + (j + 0.5) / MINIMAP_RES;
          hs[j * cw + i] = getAnalyticalGroundHeight(x, z);
        }
      }
      const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * Math.max(0, Math.min(1, t)));
      for (let j = 0; j < ch; j++) {
        for (let i = 0; i < cw; i++) {
          const x = -MINIMAP_W / 2 + (i + 0.5) / MINIMAP_RES, z = -MINIMAP_H / 2 + (j + 0.5) / MINIMAP_RES;
          const h = hs[j * cw + i];
          let c;
          if (z > 7.5 && h < water) c = mix([120, 190, 222], [24, 70, 120], (water - h) / 5);
          else if (z < 7.8 && h > snowLine) c = [238, 243, 250];
          else if (typeof groundDugAt === 'function' && groundDugAt(x, z) > 0.05) c = [122, 75, 42];
          else if (h > 8.5) c = [236, 241, 250];
          else if (h > 2.6) c = mix([128, 136, 152], [92, 99, 118], (h - 2.6) / 6);
          else if (z > 8.2) c = [236, 217, 160];
          else c = mix([96, 196, 70], [60, 150, 50], (h + 0.3) / 2.6);
          // Light from the north-west: slopes facing it are brighter
          const hl = hs[j * cw + Math.max(0, i - 1)], hu = hs[Math.max(0, j - 1) * cw + i];
          const shade = Math.max(0.65, Math.min(1.3, 1 + ((hl - h) + (hu - h)) * -0.35));
          const k = (j * cw + i) * 4;
          img.data[k] = Math.min(255, c[0] * shade);
          img.data[k + 1] = Math.min(255, c[1] * shade);
          img.data[k + 2] = Math.min(255, c[2] * shade);
          img.data[k + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      minimap.base = off;
      minimap.baseSig = minimapSignature();
    }

// What part of the world the map shows: all of it, or a closer look around the camera
function minimapView() {
      const w = MINIMAP_W / minimap.zoom, h = MINIMAP_H / minimap.zoom;
      const t = controls ? controls.target : { x: 0, z: 0 };
      const cx = Math.max(-MINIMAP_W / 2 + w / 2, Math.min(MINIMAP_W / 2 - w / 2, t.x));
      const cz = Math.max(-MINIMAP_H / 2 + h / 2, Math.min(MINIMAP_H / 2 - h / 2, t.z));
      return { x0: cx - w / 2, z0: cz - h / 2, w, h };
    }

function minimapDraw() {
      const cv = minimap.canvas, ctx = minimap.ctx;
      if (!cv || !ctx || !minimap.base) return;
      const W = cv.width, H = cv.height, v = minimapView();
      const sx = W / v.w, sz = H / v.h;
      const px = x => (x - v.x0) * sx, pz = z => (z - v.z0) * sz;
      const dpr = W / (cv.clientWidth || W);
      ctx.save();
      ctx.clearRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(minimap.base, (v.x0 + MINIMAP_W / 2) * MINIMAP_RES, (v.z0 + MINIMAP_H / 2) * MINIMAP_RES, v.w * MINIMAP_RES, v.h * MINIMAP_RES, 0, 0, W, H);

      // Paved yard, helipad, balloon field, dock and the Disposal Pit
      ctx.lineWidth = 1 * dpr;
      if (typeof VEHICLE_YARD !== 'undefined') {
        ctx.fillStyle = 'rgba(148,163,184,0.75)';
        ctx.fillRect(px(VEHICLE_YARD.minX), pz(VEHICLE_YARD.minZ), (VEHICLE_YARD.maxX - VEHICLE_YARD.minX) * sx, (VEHICLE_YARD.maxZ - VEHICLE_YARD.minZ) * sz);
      }
      const pad = typeof PAD_RADIUS === 'number' ? PAD_RADIUS : 4.8;
      const ring = (x, z, r, fill, stroke) => { ctx.beginPath(); ctx.arc(px(x), pz(z), Math.max(2, r * sx), 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } };
      if (typeof AIR_SLOTS !== 'undefined') AIR_SLOTS.forEach(([x, z]) => ring(x, z, pad * 0.7, 'rgba(100,116,139,0.85)', '#facc15'));
      if (typeof BALLOON_SLOTS !== 'undefined') BALLOON_SLOTS.forEach(([x, z]) => ring(x, z, pad * 0.7, null, 'rgba(255,255,255,0.7)'));
      if (typeof DOCK_SLOTS !== 'undefined') {
        ctx.fillStyle = '#8b5a2b';
        const xs = DOCK_SLOTS.map(d => d[0]);
        ctx.fillRect(px(Math.min(...xs) - 1), pz(9.6), (Math.max(...xs) - Math.min(...xs) + 2) * sx, 0.9 * sz);
      }
      if (typeof DISPOSAL_PIT !== 'undefined') ring(DISPOSAL_PIT.x, DISPOSAL_PIT.z, DISPOSAL_PIT.r, '#3f2a1d', '#a8a29e');

      // His changes to the land
      (state.worldEdits || []).forEach(e => {
        if (e.type === 'road' && Number.isFinite(e.toX)) {
          ctx.strokeStyle = '#d6c7a1'; ctx.lineWidth = Math.max(2, 1.6 * sx);
          ctx.beginPath(); ctx.moveTo(px(e.x), pz(e.z)); ctx.lineTo(px(e.toX), pz(e.toZ)); ctx.stroke();
        } else if (e.type === 'hill') ring(e.x, e.z, e.r || 2.5, 'rgba(120,90,50,0.45)', null);
        else if (e.type === 'plant') ring(e.x, e.z, 0.6, '#14532d', '#86efac');
        else if (e.type === 'chop') ring(e.x, e.z, 0.4, '#78350f', null);
      });
      ctx.lineWidth = 1 * dpr;
      (state.landFills || []).forEach(f => ring(f.x, f.z, f.r || 2, f.done ? 'rgba(214,190,130,0.9)' : 'rgba(214,190,130,0.45)', '#fde68a'));
      (state.digSites || []).forEach(d => ring(d.x, d.z, 1.1, '#4a2c17', '#f59e0b'));

      // Buildings
      minimapBuildings().forEach(b => {
        ctx.fillStyle = b.color;
        ctx.strokeStyle = 'rgba(15,23,42,0.8)';
        ctx.fillRect(px(b.x - b.w / 2), pz(b.z - b.d / 2), b.w * sx, b.d * sz);
        ctx.strokeRect(px(b.x - b.w / 2), pz(b.z - b.d / 2), b.w * sx, b.d * sz);
      });
      (state.projects || []).filter(p => Number.isFinite(p.x)).forEach(p => ring(p.x, p.z, 0.8, '#f59e0b', '#fff7ed'));

      // Small emoji labels once zoomed in enough to have room
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `${Math.round(9 * dpr)}px sans-serif`;
      if (minimap.zoom >= 2) minimapBuildings().forEach(b => ctx.fillText(b.icon, px(b.x), pz(b.z)));

      // His vehicles
      (state.vehicles || []).forEach(veh => {
        ctx.fillStyle = '#facc15'; ctx.strokeStyle = '#0f172a';
        const s = 3 * dpr;
        ctx.fillRect(px(veh.x) - s, pz(veh.z) - s, s * 2, s * 2);
        ctx.strokeRect(px(veh.x) - s, pz(veh.z) - s, s * 2, s * 2);
      });

      // What the camera sees: where the corners of the view meet the ground
      if (camera) {
        const y = controls ? controls.target.y : 0;
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([nx, ny]) => {
          const ray = new THREE.Raycaster();
          ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
          const d = ray.ray.direction, o = ray.ray.origin;
          let t = d.y < -0.01 ? (y - o.y) / d.y : 160;
          t = Math.min(Math.max(t, 0), 160);
          return [o.x + d.x * t, o.z + d.z * t];
        });
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        corners.forEach(([x, z], i) => (i ? ctx.lineTo(px(x), pz(z)) : ctx.moveTo(px(x), pz(z))));
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath(); ctx.arc(px(camera.position.x), pz(camera.position.z), 2.5 * dpr, 0, Math.PI * 2); ctx.fill();
      }

      // Kelo-1: an arrow pointing the way he faces
      const kx = keloGroup ? keloGroup.position.x : state.botPos.x, kz = keloGroup ? keloGroup.position.z : state.botPos.z;
      const r = state.botRotY || 0, fx = Math.sin(r), fz = Math.cos(r);
      const s = 7 * dpr, X = px(kx), Z = pz(kz);
      ctx.fillStyle = '#f59e0b'; ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.moveTo(X + fx * s, Z + fz * s);
      ctx.lineTo(X - fx * s * 0.6 + fz * s * 0.6, Z - fz * s * 0.6 - fx * s * 0.6);
      ctx.lineTo(X - fx * s * 0.25, Z - fz * s * 0.25);
      ctx.lineTo(X - fx * s * 0.6 - fz * s * 0.6, Z - fz * s * 0.6 + fx * s * 0.6);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      // North marker
      ctx.fillStyle = 'rgba(15,23,42,0.75)';
      ctx.fillRect(W - 15 * dpr, 3 * dpr, 12 * dpr, 12 * dpr);
      ctx.fillStyle = '#f8fafc'; ctx.font = `bold ${Math.round(9 * dpr)}px sans-serif`;
      ctx.fillText('N', W - 9 * dpr, 9.5 * dpr);
      ctx.restore();
    }

function minimapResize() {
      const cv = minimap.canvas;
      if (!cv) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth || 176, h = cv.clientHeight || 132;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
    }

function minimapSetOpen(open) {
      const wrap = document.getElementById('exploreMinimapWrap');
      const btn = document.getElementById('btnShowMinimap');
      if (!wrap) return;
      wrap.classList.toggle('hidden', !open);
      btn?.classList.toggle('hidden', open);
      if (typeof exploreCam !== 'undefined') { exploreCam.prefs.mapOpen = open; exploreSavePrefs(); }
      if (open) { minimapResize(); minimapDraw(); }
    }

function initExploreMinimap() {
      const cv = document.getElementById('exploreMinimap');
      if (!cv) return;
      minimap.canvas = cv;
      minimap.ctx = cv.getContext('2d');
      // Phones start with the map folded away; it remembers what you chose
      const pref = typeof exploreCam !== 'undefined' ? exploreCam.prefs.mapOpen : null;
      minimapSetOpen(pref === null || pref === undefined ? !window.matchMedia('(max-width: 639px)').matches : pref);
      minimapResize();
      minimapBuildBase();

      cv.addEventListener('click', (e) => {
        const r = cv.getBoundingClientRect(), v = minimapView();
        const x = v.x0 + ((e.clientX - r.left) / r.width) * v.w;
        const z = v.z0 + ((e.clientY - r.top) / r.height) * v.h;
        if (typeof exploreFlyTo === 'function') exploreFlyTo({ x, z, dist: exploreClamp(exploreCam.cur ? exploreCam.cur.dist : 30, 18, 40) });
      });
      document.querySelectorAll('[data-minimap-zoom]').forEach(b => b.addEventListener('click', () => {
        const step = Number(b.getAttribute('data-minimap-zoom'));
        minimap.zoom = Math.max(1, Math.min(4, minimap.zoom * (step > 0 ? 2 : 0.5)));
        minimapDraw();
      }));
      document.getElementById('btnHideMinimap')?.addEventListener('click', () => minimapSetOpen(false));
      document.getElementById('btnShowMinimap')?.addEventListener('click', () => minimapSetOpen(true));
      window.addEventListener('resize', minimapResize);

      // Redraw about eight times a second, and the terrain picture when the land changes
      setInterval(() => {
        if (!cv.offsetParent) return;
        minimapDraw();
      }, 125);
      setInterval(() => {
        if (minimapSignature() !== minimap.baseSig) minimapBuildBase();
      }, 4000);
    }
