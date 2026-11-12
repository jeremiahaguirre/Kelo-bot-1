// Kelo-bot-1 — js/minimap.js
// Loaded after explore.js. A small map of the island in the bottom-left corner, drawn on a canvas
// from the real terrain heights: the lake, beach, meadow, mountains (and the snow on them), the
// buildings, the vehicle yard, helipad, balloon field and dock, his digs, roads, hills, plantings,
// new land and builds, his vehicles, Kelo-1 himself (an arrow pointing the way he faces) and a
// light patch showing what the camera can see. Click the map to fly there; + and − zoom the map.
// The menu's Map tab draws the same terrain bigger, marking everything he has changed in the world
// (chopped trees, plantings, roads, hills, holes, dirt piles, new land and builds) with a legend and
// a list; tap a mark or a row to fly there.

// The world boxes it covers ("sheets"), all the same shape: the valley (the whole island: js/scene.js
// ISLAND_MIN_X/MAX_X, ISLAND_HALF_Z), and since task 7b the north sheet: the Workshop's pass, its north
// yard and the south end of the runway field (the field runs on north off the sheet). The corner map
// shows the sheet the camera looks at; the Map tab has a button for each.
const MINIMAP_SHEETS = {
  valley: { x0: ISLAND_MIN_X, z0: -ISLAND_HALF_Z, w: ISLAND_MAX_X - ISLAND_MIN_X, h: ISLAND_HALF_Z * 2, res: 1.5, label: 'Valley' },
  north: { x0: -125, z0: -232, w: 270, h: 270 * (ISLAND_HALF_Z * 2) / (ISLAND_MAX_X - ISLAND_MIN_X), res: 0.9, label: 'North yard & runway field' }
};
// (the current sheet's box: minimapUseSheet sets these)
let MINIMAP_X0 = MINIMAP_SHEETS.valley.x0, MINIMAP_Z0 = MINIMAP_SHEETS.valley.z0;
let MINIMAP_W = MINIMAP_SHEETS.valley.w, MINIMAP_H = MINIMAP_SHEETS.valley.h;
let MINIMAP_RES = 1.5;                        // terrain samples per world unit for the base picture
const minimap = { canvas: null, ctx: null, base: null, baseSig: '', zoom: 1, lastDraw: 0, sheet: 'valley', bases: {} };

// Switch the map to a sheet (its terrain picture is kept per sheet and built when first needed)
function minimapUseSheet(key) {
      if (!MINIMAP_SHEETS[key]) key = 'valley';
      if (key !== minimap.sheet) {
        minimap.bases[minimap.sheet] = { base: minimap.base, sig: minimap.baseSig };
        const S = MINIMAP_SHEETS[key];
        MINIMAP_X0 = S.x0; MINIMAP_Z0 = S.z0; MINIMAP_W = S.w; MINIMAP_H = S.h; MINIMAP_RES = S.res;
        minimap.sheet = key;
        const kept = minimap.bases[key] || {};
        minimap.base = kept.base || null;
        minimap.baseSig = kept.sig || '';
      }
      if (!minimap.base || minimap.baseSig !== minimapSignature()) minimapBuildBase();
    }

// The sheet the camera is over (north of the range's crest: the north sheet)
function minimapSheetFor(z) {
      return z < -60 ? 'north' : 'valley';
    }

// The north sheet's own marks: the runway field (mown, its centre line dashed, labelled and running on
// north off the sheet), its reserved taxiway, the Workshop's pass and yard
function minimapNorthMarks(ctx, px, pz, sx, sz, dpr, big = false) {
      if (typeof RUNWAY_FIELD === 'undefined') return;
      const F = RUNWAY_FIELD, T = F.taxiway;
      ctx.save();
      ctx.fillStyle = 'rgba(190,242,100,0.22)';
      ctx.fillRect(px(F.minX), pz(F.minZ), (F.maxX - F.minX) * sx, (F.maxZ - F.minZ) * sz);
      // mowing stripes along it
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      for (let x = F.minX; x < F.maxX; x += 30) ctx.fillRect(px(x), pz(F.minZ), 15 * sx, (F.maxZ - F.minZ) * sz);
      ctx.strokeStyle = 'rgba(236,252,203,0.85)'; ctx.lineWidth = 1.2 * dpr;
      ctx.strokeRect(px(F.minX), pz(F.minZ), (F.maxX - F.minX) * sx, (F.maxZ - F.minZ) * sz);
      ctx.setLineDash([6 * dpr, 5 * dpr]);
      ctx.beginPath(); ctx.moveTo(px(F.centerX), pz(F.maxZ)); ctx.lineTo(px(F.centerX), pz(F.minZ)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(148,163,184,0.55)';
      ctx.fillRect(px(T.minX), pz(T.minZ), (T.maxX - T.minX) * sx, (T.maxZ - T.minZ) * sz);
      if (typeof WORKSHOP_LAND !== 'undefined' && WORKSHOP_LAND.yard) [WORKSHOP_LAND.pass, WORKSHOP_LAND.eastRoad, WORKSHOP_LAND.yard].forEach(r => {
        ctx.fillStyle = 'rgba(168,162,158,0.55)';
        ctx.fillRect(px(r.minX), pz(r.minZ), (r.maxX - r.minX) * sx, (r.maxZ - r.minZ) * sz);
      });
      const top = Math.max(pz(F.minZ), 0);
      ctx.fillStyle = '#ecfccb'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.font = `bold ${Math.round((big ? 12 : 8) * dpr)}px sans-serif`;
      ctx.fillText(`\u25B2 RUNWAY FIELD ${F.metres.length.toLocaleString('en')} m`, px(F.centerX), top + 4 * dpr);
      ctx.font = `${Math.round((big ? 10 : 7) * dpr)}px sans-serif`;
      ctx.fillText(F.developed ? 'runway' : 'kept clear for his runway', px(F.centerX), top + (big ? 19 : 13) * dpr);
      ctx.restore();
    }

// On the valley sheet: where the pass leads (up off the top of the map)
function minimapValleyPointer(ctx, px, pz, dpr) {
      if (typeof WORKSHOP_LAND === 'undefined' || !WORKSHOP_LAND.pass) return;
      const P = WORKSHOP_LAND.pass, x = px((P.minX + P.maxX) / 2), z = Math.max(pz(P.maxZ) - 2 * dpr, 10 * dpr);
      ctx.save();
      ctx.fillStyle = 'rgba(15,23,42,0.75)'; ctx.strokeStyle = '#ecfccb'; ctx.lineWidth = 1 * dpr;
      ctx.beginPath(); ctx.moveTo(x, z - 8 * dpr); ctx.lineTo(x + 5 * dpr, z); ctx.lineTo(x - 5 * dpr, z); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

// The buildings, as footprints (x, z = centre; w, d = size)
function minimapBuildings() {
      const b = [];
      if (typeof HOUSE !== 'undefined') b.push({ x: HOUSE.x, z: HOUSE.z, w: HOUSE.w, d: HOUSE.d, color: '#c08457', icon: '🏠' });
      if (typeof STOREHOUSE !== 'undefined') b.push({ x: STOREHOUSE.x, z: STOREHOUSE.z, w: STOREHOUSE.w, d: STOREHOUSE.d, color: '#b91c1c', icon: '📦' });
      if (typeof MUSEUM !== 'undefined') b.push({ x: MUSEUM.x, z: MUSEUM.z, w: MUSEUM.w, d: MUSEUM.d, color: '#e2e8f0', icon: '🏛️' });
      // The town buildings (js/scene.js builds them from TOWN_BUILDINGS)
      [['post_office', '#dc2626', '📮'], ['cyber', '#312e81', '💻'], ['cafe', '#ea580c', '☕']].forEach(([k, color, icon]) => {
        const t = TOWN_BUILDINGS[k];
        b.push({ x: t.x, z: t.z, w: t.w, d: t.d, color, icon });
      });
      b.push({ x: -1.2, z: -8.2, w: 2.4, d: 1.6, color: '#334155', icon: '🔥' });   // welding studio
      return b;
    }

// Something that changes the ground: when it changes, the base picture is redrawn
function minimapSignature() {
      const digs = (state.digSites || []).map(d => `${d.x},${d.z},${d.depth.toFixed(1)}`).join(';');
      const edits = (state.worldEdits || []).map(e => e.id).join(';');
      const fills = (state.landFills || []).map(f => `${f.id || f.x},${Math.round(f.volume || 0)},${f.done ? 1 : 0}`).join(';');
      const season = typeof currentSeason === 'function' ? currentSeason() : '';
      const frozen = typeof lakeFrozen === 'function' && lakeFrozen() ? 'ice' : '';
      return [digs, edits, fills, season, frozen].join('|');
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
      const frozen = typeof lakeFrozen === 'function' && lakeFrozen();
      const hs = new Float32Array(cw * ch);
      for (let j = 0; j < ch; j++) {
        for (let i = 0; i < cw; i++) {
          const x = MINIMAP_X0 + (i + 0.5) / MINIMAP_RES, z = MINIMAP_Z0 + (j + 0.5) / MINIMAP_RES;
          hs[j * cw + i] = getAnalyticalGroundHeight(x, z);
        }
      }
      const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * Math.max(0, Math.min(1, t)));
      for (let j = 0; j < ch; j++) {
        for (let i = 0; i < cw; i++) {
          const x = MINIMAP_X0 + (i + 0.5) / MINIMAP_RES, z = MINIMAP_Z0 + (j + 0.5) / MINIMAP_RES;
          const h = hs[j * cw + i];
          let c;
          // Snow lies on gentle ground only; cliff faces show as rock, as they do in 3D (snowHoldsOn, scene.js)
          const gx = (hs[j * cw + Math.min(cw - 1, i + 1)] - hs[j * cw + Math.max(0, i - 1)]) * MINIMAP_RES / 2;
          const gz = (hs[Math.min(ch - 1, j + 1) * cw + i] - hs[Math.max(0, j - 1) * cw + i]) * MINIMAP_RES / 2;
          const snowy = typeof snowHoldsOn === 'function' ? snowHoldsOn(1 / Math.sqrt(1 + gx * gx + gz * gz)) > 0.5 : true;
          if (z > 7.5 && h < water) c = frozen ? mix([228, 238, 247], [176, 200, 222], (water - h) / 6) : mix([120, 190, 222], [24, 70, 120], (water - h) / 5);
          else if (z < 7.8 && h > snowLine && snowy) c = [238, 243, 250];
          else if (typeof groundDugAt === 'function' && groundDugAt(x, z) > 0.05) c = [122, 75, 42];
          else if (h > 8.5 && snowy && (z > -ISLAND_HALF_Z || h > 26)) c = [236, 241, 250];
          // (past the range the hills are forest up to the bare tops, as drawn in 3D)
          else if (z < -ISLAND_HALF_Z && h > 2.6 && h < 22) c = mix([62, 112, 52], [96, 104, 92], (h - 8) / 14);
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
      const cx = Math.max(MINIMAP_X0 + w / 2, Math.min(MINIMAP_X0 + MINIMAP_W - w / 2, t.x));
      const cz = Math.max(MINIMAP_Z0 + h / 2, Math.min(MINIMAP_Z0 + MINIMAP_H - h / 2, t.z));
      return { x0: cx - w / 2, z0: cz - h / 2, w, h };
    }

const minimapRay = new THREE.Raycaster(), minimapNdc = new THREE.Vector2();
// Redraw only when something on it moved by half a map pixel or more (or once a second)
let minimapDrawKey = '', minimapDrawnAt = 0;
function minimapNeedsDraw() {
      const cv = minimap.canvas;
      if (!cv) return false;
      const q = Math.max(0.05, (MINIMAP_W / minimap.zoom) / Math.max(1, cv.width) * 0.5);
      const r = v => Math.round(v / q);
      const t = controls ? controls.target : { x: 0, z: 0 }, cp = camera ? camera.position : t;
      const k = keloGroup ? keloGroup.position : state.botPos;
      let key = `${minimapSheetFor(t.z)}|${minimap.zoom}|${cv.width}|${r(t.x)},${r(t.z)}|${r(cp.x)},${r(cp.y)},${r(cp.z)}|${r(k.x)},${r(k.z)},${Math.round((state.botRotY || 0) * 20)}`;
      (state.vehicles || []).forEach(v => { key += `|${r(v.x)},${r(v.z)}`; });
      const now = performance.now();
      if (key === minimapDrawKey && now - minimapDrawnAt < 1000) return false;
      minimapDrawKey = key;
      minimapDrawnAt = now;
      return true;
    }

function minimapDraw() {
      const cv = minimap.canvas, ctx = minimap.ctx;
      if (!cv || !ctx) return;
      minimapUseSheet(minimapSheetFor(controls ? controls.target.z : state.botPos.z));
      if (!minimap.base) return;
      const W = cv.width, H = cv.height, v = minimapView();
      const sx = W / v.w, sz = H / v.h;
      const px = x => (x - v.x0) * sx, pz = z => (z - v.z0) * sz;
      const dpr = W / (cv.clientWidth || W);
      ctx.save();
      ctx.clearRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(minimap.base, (v.x0 - MINIMAP_X0) * MINIMAP_RES, (v.z0 - MINIMAP_Z0) * MINIMAP_RES, v.w * MINIMAP_RES, v.h * MINIMAP_RES, 0, 0, W, H);

      if (minimap.sheet === 'north') minimapNorthMarks(ctx, px, pz, sx, sz, dpr);
      else minimapValleyPointer(ctx, px, pz, dpr);
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
        const ray = minimapRay, ndc = minimapNdc;
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([nx, ny]) => {
          ray.setFromCamera(ndc.set(nx, ny), camera);
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

      // Check eight times a second (redrawing only when something moved), and the terrain picture when the land changes
      setInterval(() => {
        if (!cv.offsetParent || !minimapNeedsDraw()) return;
        minimapDraw();
      }, 125);
      setInterval(() => {
        if (minimapSignature() !== minimap.baseSig) minimapBuildBase();
      }, 4000);
      initChangesMap();
    }


// --- The Map tab: everything he has changed ---------------------------------------------------------
const CHANGE_KINDS = [
  { key: 'chop', label: 'Trees chopped', emoji: '🪓', color: '#d97706' },
  { key: 'plant', label: 'Plantings', emoji: '🌱', color: '#4ade80' },
  { key: 'road', label: 'Roads', emoji: '🛤️', color: '#f5e6b8' },
  { key: 'hill', label: 'Hills and hollows', emoji: '⛰️', color: '#a16207' },
  { key: 'hole', label: 'Holes', emoji: '🕳️', color: '#1c1917' },
  { key: 'pile', label: 'Dirt piles', emoji: '🟫', color: '#92400e' },
  { key: 'land', label: 'New land', emoji: '🏝️', color: '#fde047' },
  { key: 'build', label: 'Builds', emoji: '🔨', color: '#f472b6' }
];
const changesMap = { canvas: null, hidden: new Set(), hits: [], sig: '', sheet: 'valley' };

// One entry per change, newest first: { kind, label, x, z, at, ... }
function worldChangesList() {
      const out = [];
      (state.worldEdits || []).forEach(e => {
        if (e.type === 'chop') out.push({ kind: 'chop', label: 'Chopped down a tree', x: e.x, z: e.z, at: e.at, why: e.why });
        else if (e.type === 'plant') out.push({ kind: 'plant', label: `Planted ${e.kind === 'tree' ? 'a tree' : 'flowers'}${typeof growthOf === 'function' ? ` (${Math.round(growthOf(e) * 100)}% grown)` : ''}`, x: e.x, z: e.z, at: e.at, why: e.why });
        else if (e.type === 'road' && Number.isFinite(e.toX)) out.push({ kind: 'road', label: `Gravel road, ${Math.round(Math.hypot(e.toX - e.x, e.toZ - e.z))} m long`, x: (e.x + e.toX) / 2, z: (e.z + e.toZ) / 2, x1: e.x, z1: e.z, x2: e.toX, z2: e.toZ, at: e.at, why: e.why });
        else if (e.type === 'hill') out.push({ kind: 'hill', label: e.h < 0 ? `Dug a hollow, ${Math.abs(e.h).toFixed(1)} m deep` : `Raised a hill${e.h ? `, ${e.h.toFixed(1)} m high` : ''}`, emoji: e.h < 0 ? '🕳️' : null, x: e.x, z: e.z, r: e.r, at: e.at, why: e.why });
      });
      (state.digSites || []).forEach(d => {
        out.push({ kind: 'hole', label: `${d.z < -14 ? 'Mountain' : 'Valley'} dig, ${d.depth.toFixed(1)} m deep`, x: d.x, z: d.z, at: d.startedAt });
        if (d.dirt > 0 && typeof pileOffset === 'function') {
          const p = pileOffset(d);
          out.push({ kind: 'pile', label: 'Dirt pile from his dig', x: p.x, z: p.z, r: typeof pileShape === 'function' ? pileShape(d).r : 1, at: d.startedAt });
        }
      });
      (state.landFills || []).forEach(f => out.push({ kind: 'land', label: f.done ? 'New land in the lake' : 'New land (still filling)', x: f.x, z: f.z, r: f.r, at: f.startedAt, why: f.why }));
      (state.projects || []).filter(p => p.status === 'built' && Number.isFinite(p.x)).forEach(p => {
        const plan = typeof planFor === 'function' ? planFor(p.key) : null;
        out.push({ kind: 'build', label: `Built a ${plan ? plan.name.toLowerCase() : p.key}${p.fromLogs ? ' from his own logs' : ''}`, emoji: plan && plan.emoji, x: p.x, z: p.z, at: p.builtAt });
      });
      return out.sort((a, b) => (b.at || 0) - (a.at || 0));
    }

// The whole island, with every change marked in its own colour and shape
function changesMapDraw() {
      const cv = changesMap.canvas;
      if (!cv || !cv.offsetParent) return;
      // (drawn from its own sheet; the corner map's sheet is put back after)
      const was = minimap.sheet;
      minimapUseSheet(changesMap.sheet);
      try { changesMapDrawSheet(cv); } finally { minimapUseSheet(was); }
    }

function changesMapDrawSheet(cv) {
      if (!minimap.base) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth || 400, h = cv.clientHeight || 300;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const ctx = cv.getContext('2d');
      const W = cv.width, H = cv.height, sx = W / MINIMAP_W, sz = H / MINIMAP_H;
      const px = x => (x - MINIMAP_X0) * sx, pz = z => (z - MINIMAP_Z0) * sz;
      ctx.save();
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(minimap.base, 0, 0, W, H);
      // Dim the land a little so the marks stand out
      ctx.fillStyle = 'rgba(15,23,42,0.18)';
      ctx.fillRect(0, 0, W, H);
      if (changesMap.sheet === 'north') minimapNorthMarks(ctx, px, pz, sx, sz, dpr, true);
      minimapBuildings().forEach(b => {
        ctx.fillStyle = 'rgba(226,232,240,0.55)';
        ctx.fillRect(px(b.x - b.w / 2), pz(b.z - b.d / 2), b.w * sx, b.d * sz);
      });
      const color = k => CHANGE_KINDS.find(c => c.key === k).color;
      const list = worldChangesList().filter(c => !changesMap.hidden.has(c.kind));
      changesMap.hits = [];
      // Areas first (hills, land, piles, roads), then point marks on top
      list.forEach(c => {
        ctx.strokeStyle = 'rgba(15,23,42,0.9)';
        ctx.lineWidth = 1.2 * dpr;
        if (c.kind === 'road') {
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(15,23,42,0.9)'; ctx.lineWidth = Math.max(5 * dpr, 2.2 * sx);
          ctx.beginPath(); ctx.moveTo(px(c.x1), pz(c.z1)); ctx.lineTo(px(c.x2), pz(c.z2)); ctx.stroke();
          ctx.strokeStyle = color('road'); ctx.lineWidth = Math.max(3 * dpr, 1.6 * sx);
          ctx.stroke();
        } else if (c.kind === 'hill' || c.kind === 'land' || c.kind === 'pile') {
          ctx.globalAlpha = 0.75;
          ctx.fillStyle = color(c.kind);
          ctx.beginPath(); ctx.arc(px(c.x), pz(c.z), Math.max(4 * dpr, (c.r || 1.5) * sx), 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.stroke();
        }
      });
      list.forEach(c => {
        const X = px(c.x), Z = pz(c.z), r = 4.5 * dpr;
        ctx.fillStyle = color(c.kind);
        ctx.strokeStyle = c.kind === 'hole' ? '#f59e0b' : 'rgba(15,23,42,0.95)';
        ctx.lineWidth = 1.4 * dpr;
        ctx.beginPath();
        if (c.kind === 'chop') { ctx.moveTo(X, Z - r); ctx.lineTo(X + r, Z + r * 0.8); ctx.lineTo(X - r, Z + r * 0.8); ctx.closePath(); }       // a triangle: a felled tree
        else if (c.kind === 'build') { ctx.rect(X - r, Z - r, r * 2, r * 2); }                                                                // a square: something built
        else if (c.kind === 'plant') { ctx.arc(X, Z, r, 0, Math.PI * 2); }                                                                     // a dot: something growing
        else if (c.kind === 'hole') { ctx.arc(X, Z, r * 0.9, 0, Math.PI * 2); }
        else if (c.kind === 'road') { ctx.moveTo(X, Z - r); ctx.lineTo(X + r, Z); ctx.lineTo(X, Z + r); ctx.lineTo(X - r, Z); ctx.closePath(); } // a diamond mid-road
        else { ctx.arc(X, Z, r * 0.7, 0, Math.PI * 2); }
        ctx.fill(); ctx.stroke();
        changesMap.hits.push({ X, Z, c });
      });
      // Where he is right now
      const kx = keloGroup ? keloGroup.position.x : state.botPos.x, kz = keloGroup ? keloGroup.position.z : state.botPos.z;
      ctx.fillStyle = '#f59e0b'; ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.arc(px(kx), pz(kz), 5 * dpr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(15,23,42,0.75)';
      ctx.fillRect(W - 17 * dpr, 4 * dpr, 13 * dpr, 13 * dpr);
      ctx.fillStyle = '#f8fafc'; ctx.font = `bold ${Math.round(10 * dpr)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('N', W - 10.5 * dpr, 10.5 * dpr);
      ctx.restore();
    }

// Legend chips (tap to hide or show a kind) and the list of changes
function renderChangesMapPanel() {
      const legend = document.getElementById('changesMapLegend'), listEl = document.getElementById('changesMapList'), count = document.getElementById('changesMapCount');
      if (!legend || !listEl) return;
      const all = worldChangesList();
      const sig = JSON.stringify([all.map(c => c.kind + c.label + c.x), [...changesMap.hidden]]);
      if (count) count.textContent = `${all.length} change${all.length === 1 ? '' : 's'}`;
      if (sig === changesMap.sig) return;
      changesMap.sig = sig;
      legend.innerHTML = CHANGE_KINDS.map(k => {
        const n = all.filter(c => c.kind === k.key).length, off = changesMap.hidden.has(k.key);
        return `<button type="button" data-change-kind="${k.key}" aria-pressed="${!off}" class="px-2 py-1 rounded-lg text-[11px] border flex items-center gap-1.5 transition ${off ? 'border-slate-800 text-slate-500' : 'border-slate-700 bg-slate-900 text-slate-200'}${n ? '' : ' opacity-50'}">
          <span class="inline-block w-2.5 h-2.5 rounded-sm border border-slate-950" style="background:${k.color}"></span>${escapeHtml(k.emoji)} ${escapeHtml(k.label)} <span class="font-mono text-slate-400">${n}</span></button>`;
      }).join('');
      const shown = all.filter(c => !changesMap.hidden.has(c.kind));
      listEl.innerHTML = shown.length ? shown.slice(0, 40).map((c, i) => {
        const k = CHANGE_KINDS.find(x => x.key === c.kind);
        return `<button type="button" data-change-row="${i}" class="w-full text-left px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-200 flex items-start gap-2">
          <span class="mt-0.5 inline-block w-2.5 h-2.5 rounded-sm shrink-0 border border-slate-950" style="background:${k.color}"></span>
          <span class="min-w-0"><span class="block">${escapeHtml(c.emoji || k.emoji)} ${escapeHtml(c.label)}</span>${c.why ? `<span class="block text-slate-400 italic">${escapeHtml(c.why)}</span>` : ''}</span>
          <i class="ph ph-crosshair ml-auto text-slate-500" aria-hidden="true"></i></button>`;
      }).join('') : `<p class="text-[11px] text-slate-500 italic">${all.length ? 'Nothing of those kinds is showing.' : "He hasn't changed anything in the world yet. Give him an axe, seeds, a shovel or some lumber and see what he does."}</p>`;
      listEl.querySelectorAll('[data-change-row]').forEach(b => b.addEventListener('click', () => changesMapFlyTo(shown[Number(b.getAttribute('data-change-row'))])));
    }

function changesMapFlyTo(c) {
      if (!c || typeof exploreFlyTo !== 'function') return;
      exploreFlyTo({ x: c.x, z: c.z, dist: 18 });
      // On a phone the menu covers the world: close it so you can see the spot
      if (window.matchMedia('(max-width: 639px)').matches) document.getElementById('btnCloseMenu')?.click();
    }

function initChangesMap() {
      const cv = document.getElementById('changesMap');
      if (!cv) return;
      changesMap.canvas = cv;
      cv.style.aspectRatio = `${MINIMAP_W} / ${MINIMAP_H}`; // the island's own shape
      cv.addEventListener('click', (e) => {
        const r = cv.getBoundingClientRect(), dpr = cv.width / (r.width || 1);
        const X = (e.clientX - r.left) * dpr, Z = (e.clientY - r.top) * dpr;
        const near = changesMap.hits.map(h => ({ h, d: Math.hypot(h.X - X, h.Z - Z) })).sort((a, b) => a.d - b.d)[0];
        if (near && near.d < 14 * dpr) return changesMapFlyTo(near.h.c);
        // Anywhere else: fly to that spot of the sheet
        const S = MINIMAP_SHEETS[changesMap.sheet];
        if (typeof exploreFlyTo === 'function') exploreFlyTo({ x: S.x0 + X / cv.width * S.w, z: S.z0 + Z / cv.height * S.h, dist: changesMap.sheet === 'north' ? 60 : 24 });
      });
      // A button for each sheet, above the map (the valley first: the town and everything he changes)
      const bar = document.createElement('div');
      bar.className = 'flex gap-1.5';
      bar.setAttribute('role', 'group');
      bar.setAttribute('aria-label', 'Which part of the world');
      const paint = () => bar.querySelectorAll('button').forEach(b => {
        const on = b.getAttribute('data-map-sheet') === changesMap.sheet;
        b.setAttribute('aria-pressed', String(on));
        b.className = `px-2.5 py-1 rounded-lg text-[11px] border transition ${on ? 'border-amber-500 bg-amber-500/15 text-amber-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}`;
      });
      Object.entries(MINIMAP_SHEETS).forEach(([key, S]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('data-map-sheet', key);
        b.textContent = (key === 'north' ? '\u2708\uFE0F ' : '\uD83C\uDFD8\uFE0F ') + S.label;
        b.addEventListener('click', () => { changesMap.sheet = key; paint(); changesMapDraw(); });
        bar.appendChild(b);
      });
      paint();
      cv.parentNode.insertBefore(bar, cv);
      document.getElementById('btnOpenChangesMap')?.addEventListener('click', () => { if (typeof window.openKeloMenu === 'function') window.openKeloMenu('map'); });
      document.getElementById('changesMapLegend')?.addEventListener('click', (e) => {
        const b = e.target.closest('[data-change-kind]');
        if (!b) return;
        const k = b.getAttribute('data-change-kind');
        if (changesMap.hidden.has(k)) changesMap.hidden.delete(k); else changesMap.hidden.add(k);
        renderChangesMapPanel();
        changesMapDraw();
      });
      setInterval(() => {
        if (!cv.offsetParent) return;
        renderChangesMapPanel();
        changesMapDraw();
      }, 500);
    }
