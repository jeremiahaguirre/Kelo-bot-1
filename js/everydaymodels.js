// Kelo-bot-1 — js/everydaymodels.js
// Loaded after gearmodels.js. Food, toys, instruments and books, built at their real size in metres
// (items3d.js marks them realSize, so they show at life size next to Kelo-1). Uses the helpers from
// items3d.js (mesh, group) and gearmodels.js (at, rod, slab).

function lathe(profile, color, extra = {}, segments = 20) {
      return mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments), color, extra);
    }

// The same outline as lathe(), as bare geometry (for models that wear a painted surface)
function latheGeometry(profile, segments = 20) {
      return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);
    }

// --- Surfaces: small painted textures (colour plus a matching bump map) that give food and toys
// the look of the real thing: a baked crust, cheese holes, apple streaks, carrot rings...
const SURFACE_TEXTURES = {};

// The same painting every time (a seeded random), so a cookie looks the same on every visit
function seededRandom(seed) {
      let s = seed >>> 0;
      return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

// Painters draw the colour (c) and the bumps (b, grey: light is raised) on a size x size canvas
const SURFACE_PAINTERS = {
  crust(c, b, S, r) {
    c.fillStyle = '#9a5b27'; c.fillRect(0, 0, S, S);
    b.fillStyle = '#808080'; b.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) {
      const x = r() * S, y = r() * S, w = 1.5 + r() * 6, tone = r();
      c.fillStyle = tone < 0.5 ? `rgba(98,52,20,${0.1 + r() * 0.16})` : `rgba(204,150,86,${0.1 + r() * 0.16})`;
      c.beginPath(); c.ellipse(x, y, w, w * (0.4 + r() * 0.6), r() * 3, 0, 7); c.fill();
      b.fillStyle = tone < 0.5 ? 'rgba(40,40,40,0.25)' : 'rgba(220,220,220,0.25)';
      b.beginPath(); b.ellipse(x, y, w, w * 0.7, 0, 0, 7); b.fill();
    }
    // A dusting of flour
    for (let i = 0; i < 110; i++) {
      c.fillStyle = `rgba(246,238,222,${0.12 + r() * 0.3})`;
      c.beginPath(); c.arc(r() * S, r() * S, 3 + r() * 12, 0, 7); c.fill();
    }
  },
  cookie(c, b, S, r) {
    c.fillStyle = '#c99556'; c.fillRect(0, 0, S, S);
    b.fillStyle = '#808080'; b.fillRect(0, 0, S, S);
    for (let i = 0; i < 500; i++) {
      const x = r() * S, y = r() * S;
      c.fillStyle = r() < 0.5 ? 'rgba(150,96,44,0.25)' : 'rgba(232,190,128,0.25)';
      c.beginPath(); c.arc(x, y, 2 + r() * 6, 0, 7); c.fill();
    }
    // Cracks across the top
    for (let i = 0; i < 14; i++) {
      let x = r() * S, y = r() * S;
      c.strokeStyle = 'rgba(110,64,26,0.55)'; b.strokeStyle = 'rgba(20,20,20,0.7)';
      c.lineWidth = b.lineWidth = 1.5 + r() * 2;
      c.beginPath(); b.beginPath(); c.moveTo(x, y); b.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; c.lineTo(x, y); b.lineTo(x, y); }
      c.stroke(); b.stroke();
    }
    // Chocolate chips
    for (let i = 0; i < 22; i++) {
      const x = r() * S, y = r() * S, w = 8 + r() * 9;
      c.fillStyle = '#3b2312'; b.fillStyle = '#e8e8e8';
      [c, b].forEach(ctx => { ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28, rr = w * (0.6 + r() * 0.4); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.fill(); });
      c.fillStyle = 'rgba(120,80,50,0.5)'; c.beginPath(); c.arc(x - w * 0.25, y - w * 0.25, w * 0.25, 0, 7); c.fill();
    }
  },
  cheese(c, b, S, r) {
    c.fillStyle = '#f2c94c'; c.fillRect(0, 0, S, S);
    b.fillStyle = '#909090'; b.fillRect(0, 0, S, S);
    for (let i = 0; i < 400; i++) {
      c.fillStyle = r() < 0.5 ? 'rgba(230,180,50,0.2)' : 'rgba(255,226,130,0.2)';
      c.beginPath(); c.arc(r() * S, r() * S, 2 + r() * 8, 0, 7); c.fill();
    }
    for (let i = 0; i < 16; i++) {
      const x = r() * S, y = r() * S, w = 4 + r() * 13;
      const g = c.createRadialGradient(x - w * 0.3, y - w * 0.3, 1, x, y, w);
      g.addColorStop(0, '#b8860b'); g.addColorStop(1, '#dcaa2c');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, w, 0, 7); c.fill();
      b.fillStyle = '#101010'; b.beginPath(); b.arc(x, y, w, 0, 7); b.fill();
    }
  },
  pizza(c, b, S, r) {
    const m = S / 2;
    c.fillStyle = '#d9a35a'; c.fillRect(0, 0, S, S);
    b.fillStyle = '#808080'; b.fillRect(0, 0, S, S);
    c.fillStyle = '#b8321f'; c.beginPath(); c.arc(m, m, S * 0.45, 0, 7); c.fill();
    // Melted cheese in blotches, browned in spots
    for (let i = 0; i < 70; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * S * 0.4, x = m + Math.cos(a) * d, y = m + Math.sin(a) * d, w = 10 + r() * 22;
      c.fillStyle = `rgba(250,${214 + r() * 30},${120 + r() * 50},0.85)`;
      c.beginPath(); c.ellipse(x, y, w, w * (0.5 + r() * 0.5), r() * 3, 0, 7); c.fill();
      b.fillStyle = 'rgba(200,200,200,0.5)'; b.beginPath(); b.ellipse(x, y, w, w * 0.7, 0, 0, 7); b.fill();
    }
    for (let i = 0; i < 40; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * S * 0.42;
      c.fillStyle = 'rgba(170,100,40,0.45)'; c.beginPath(); c.arc(m + Math.cos(a) * d, m + Math.sin(a) * d, 2 + r() * 5, 0, 7); c.fill();
    }
    // Basil leaves
    for (let i = 0; i < 6; i++) {
      const a = r() * 6.28, d = r() * S * 0.33;
      c.fillStyle = '#2f6b1f'; c.beginPath(); c.ellipse(m + Math.cos(a) * d, m + Math.sin(a) * d, 9, 5, r() * 3, 0, 7); c.fill();
    }
  },
  pepperoni(c, b, S, r) {
    c.fillStyle = '#a3261b'; c.fillRect(0, 0, S, S);
    b.fillStyle = '#808080'; b.fillRect(0, 0, S, S);
    for (let i = 0; i < 160; i++) {
      c.fillStyle = r() < 0.6 ? 'rgba(235,170,150,0.55)' : 'rgba(90,20,14,0.5)';
      c.beginPath(); c.arc(r() * S, r() * S, 2 + r() * 6, 0, 7); c.fill();
    }
  },
  chocolate(c, b, S, r) {
    c.fillStyle = '#4a2a14'; c.fillRect(0, 0, S, S);
    b.fillStyle = '#808080'; b.fillRect(0, 0, S, S);
    for (let i = 0; i < 300; i++) {
      c.fillStyle = r() < 0.5 ? 'rgba(80,46,24,0.25)' : 'rgba(40,22,10,0.25)';
      c.beginPath(); c.arc(r() * S, r() * S, 3 + r() * 10, 0, 7); c.fill();
    }
  },
  foil(c, b, S, r) {
    c.fillStyle = '#d6d9de'; c.fillRect(0, 0, S, S);
    b.fillStyle = '#808080'; b.fillRect(0, 0, S, S);
    // Crinkles: sharp creases going every which way
    for (let i = 0; i < 90; i++) {
      const x = r() * S, y = r() * S, a = r() * 6.28, l = 20 + r() * 60;
      b.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
      b.lineWidth = 1 + r() * 2;
      b.beginPath(); b.moveTo(x, y); b.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); b.stroke();
      c.strokeStyle = 'rgba(160,166,176,0.35)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
    }
  },
  apple(c, b, S, r) {
    // Red with a yellow-green cheek on one side; fine streaks run stem to base (the canvas's y)
    const g = c.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#cfae45'); g.addColorStop(0.14, '#c8322a'); g.addColorStop(0.86, '#b92820'); g.addColorStop(1, '#d4b64c');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    b.fillStyle = '#808080'; b.fillRect(0, 0, S, S);
    const cheek = c.createRadialGradient(S * 0.75, S * 0.55, 4, S * 0.75, S * 0.55, S * 0.3);
    cheek.addColorStop(0, 'rgba(214,190,70,0.75)'); cheek.addColorStop(1, 'rgba(214,190,70,0)');
    c.fillStyle = cheek; c.fillRect(0, 0, S, S);
    for (let i = 0; i < 260; i++) {
      const x = r() * S;
      c.strokeStyle = r() < 0.7 ? `rgba(140,14,12,${0.08 + r() * 0.16})` : `rgba(240,200,80,${0.08 + r() * 0.14})`;
      c.lineWidth = 0.5 + r() * 1.5;
      c.beginPath(); c.moveTo(x, S * 0.1); c.bezierCurveTo(x + (r() - 0.5) * 12, S * 0.35, x + (r() - 0.5) * 12, S * 0.65, x + (r() - 0.5) * 8, S * 0.9); c.stroke();
    }
    for (let i = 0; i < 260; i++) {
      c.fillStyle = 'rgba(245,220,160,0.5)'; c.beginPath(); c.arc(r() * S, r() * S, 0.6 + r() * 1, 0, 7); c.fill();
    }
  },
  peach(c, b, S, r) {
    c.fillStyle = '#f2a35e'; c.fillRect(0, 0, S, S);
    b.fillStyle = '#808080'; b.fillRect(0, 0, S, S);
    // A red blush on one side
    const g = c.createRadialGradient(S * 0.3, S * 0.5, 4, S * 0.3, S * 0.5, S * 0.45);
    g.addColorStop(0, 'rgba(200,50,40,0.85)'); g.addColorStop(1, 'rgba(200,50,40,0)');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    for (let i = 0; i < 400; i++) { c.fillStyle = 'rgba(255,220,170,0.15)'; c.beginPath(); c.arc(r() * S, r() * S, 1 + r() * 3, 0, 7); c.fill(); }
  },
  carrot(c, b, S, r) {
    c.fillStyle = '#f07a1c'; c.fillRect(0, 0, S, S);
    b.fillStyle = '#909090'; b.fillRect(0, 0, S, S);
    // Rings around the root (the canvas's y runs along it), and little root hairs
    for (let i = 0; i < 46; i++) {
      const y = r() * S;
      c.strokeStyle = `rgba(170,80,14,${0.15 + r() * 0.25})`; b.strokeStyle = 'rgba(10,10,10,0.6)';
      c.lineWidth = b.lineWidth = 1 + r() * 2;
      const x0 = r() * S, len = 20 + r() * 90;
      [c, b].forEach(ctx => { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + len, y + (r() - 0.5) * 3); ctx.stroke(); });
    }
    for (let i = 0; i < 300; i++) { c.fillStyle = r() < 0.5 ? 'rgba(255,150,60,0.25)' : 'rgba(190,80,10,0.2)'; c.fillRect(r() * S, r() * S, 2 + r() * 6, 1); }
  },
  wicker(c, b, S, r) {
    // Over-and-under weave: canvas x runs round the basket, y up its side
    c.fillStyle = '#7a4a22'; c.fillRect(0, 0, S, S);
    b.fillStyle = '#202020'; b.fillRect(0, 0, S, S);
    const cols = 16, rows = 10, w = S / cols, h = S / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const over = (x + y) % 2 === 0;
      const g = c.createLinearGradient(0, y * h, 0, (y + 1) * h);
      g.addColorStop(0, '#9c6533'); g.addColorStop(0.5, over ? '#d39b5e' : '#b88048'); g.addColorStop(1, '#8a5428');
      c.fillStyle = g; c.fillRect(x * w + 1, y * h + 1, w - 2, h - 2);
      b.fillStyle = over ? '#e0e0e0' : '#909090'; b.fillRect(x * w + 1, y * h + 2, w - 2, h - 4);
    }
    for (let i = 0; i < 200; i++) { c.fillStyle = 'rgba(60,30,10,0.15)'; c.fillRect(r() * S, r() * S, 1 + r() * 8, 1); }
  },
  frosting(c, b, S, r) {
    c.fillStyle = '#fbeee6'; c.fillRect(0, 0, S, S);
    b.fillStyle = '#808080'; b.fillRect(0, 0, S, S);
    // Spatula swirls
    for (let i = 0; i < 60; i++) {
      const x = r() * S, y = r() * S, w = 10 + r() * 30;
      b.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)';
      b.lineWidth = 2 + r() * 3;
      b.beginPath(); b.arc(x, y, w, r() * 6, r() * 6 + 2); b.stroke();
      c.strokeStyle = 'rgba(235,215,205,0.35)'; c.lineWidth = 2;
      c.beginPath(); c.arc(x, y, w, r() * 6, r() * 6 + 2); c.stroke();
    }
  }
};

// One shared texture pair per kind of surface
function surfaceTexture(kind) {
      if (SURFACE_TEXTURES[kind]) return SURFACE_TEXTURES[kind];
      const S = 256;
      const make = () => { const cv = document.createElement('canvas'); cv.width = cv.height = S; return cv; };
      const colour = make(), bump = make();
      const seed = [...kind].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
      SURFACE_PAINTERS[kind](colour.getContext('2d'), bump.getContext('2d'), S, seededRandom(seed));
      const map = new THREE.CanvasTexture(colour);
      // Painted colours pass straight through, like the hex colours of every other model
      map.encoding = typeof renderer !== 'undefined' && renderer && renderer.outputEncoding === THREE.sRGBEncoding ? THREE.sRGBEncoding : THREE.LinearEncoding;
      const bumpMap = new THREE.CanvasTexture(bump);
      [map, bumpMap].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; });
      SURFACE_TEXTURES[kind] = { map, bumpMap };
      return SURFACE_TEXTURES[kind];
    }

// A mesh wearing one of those surfaces
function surfaced(geometry, kind, extra = {}) {
      const { map, bumpMap } = surfaceTexture(kind);
      const m = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 0.004, roughness: 0.7, ...extra }));
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    }

// Repeat a surface more times across a long or large model (a baguette, a basket)
function repeatUV(geometry, su, sv) {
      const uv = geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
      return geometry;
    }

// Lay a texture flat over a model from above (cookies, cheese, a pizza top): uv from x and z, `size` across
function topDownUV(geometry, size) {
      const pos = geometry.attributes.position;
      const uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        uv[i * 2] = pos.getX(i) / size + 0.5;
        uv[i * 2 + 1] = pos.getZ(i) / size + 0.5;
      }
      geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      return geometry;
    }

// Wrap a texture around a model from all three sides (each face takes the view it faces most)
function boxUV(geometry, size) {
      const g = geometry.index ? geometry.toNonIndexed() : geometry;
      g.computeVertexNormals();
      const pos = g.attributes.position, nor = g.attributes.normal;
      const uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
        const [u, v] = ny >= nx && ny >= nz ? [pos.getX(i), pos.getZ(i)] : nx >= nz ? [pos.getZ(i), pos.getY(i)] : [pos.getX(i), pos.getY(i)];
        uv[i * 2] = u / size;
        uv[i * 2 + 1] = v / size;
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      return g;
    }

// --- Food ---------------------------------------------------------------------------------------
function loafModel(lower) {
      const crust = (geo, extra = {}) => surfaced(geo, 'crust', { roughness: 0.8, bumpScale: 0.006, ...extra });
      if (/baguette/.test(lower)) {
        // Long and round with tapered ends, lying on its side, with the slashes opened into pale "ears"
        const stick = crust(repeatUV(latheGeometry([[0, -0.3], [0.018, -0.29], [0.033, -0.25], [0.036, 0], [0.033, 0.25], [0.018, 0.29], [0, 0.3]], 16), 1, 3));
        stick.rotation.z = Math.PI / 2;
        stick.scale.set(1, 1, 0.85);
        const g = group(at(stick, 0, 0.031, 0));
        [-0.18, -0.06, 0.06, 0.18].forEach(x => {
          const cut = mesh(new THREE.SphereGeometry(0.02, 12, 8), 0xf0d29a, { roughness: 0.9 });
          cut.scale.set(1.6, 0.3, 0.45);
          cut.rotation.y = 0.6;
          g.add(at(cut, x, 0.059, 0));
        });
        return g;
      }
      if (/croissant/.test(lower)) {
        // Rolled layers: puffed segments along a crescent, biggest in the middle, glazed
        const g = group(), R = 0.07;
        for (let i = -3; i <= 3; i++) {
          const a = i * 0.3, s = 0.038 * (1 - Math.abs(i) * 0.2);
          const seg = crust(new THREE.SphereGeometry(1, 16, 12), { roughness: 0.45, color: 0xffe2b0 });
          seg.scale.set(s * 0.95, s * 0.72, s * 0.62);
          seg.rotation.y = a + Math.PI / 2;
          g.add(at(seg, Math.sin(a) * R, s * 0.7, Math.cos(a) * R - R));
        }
        // A rolled core under the layers, so they read as one pastry
        const core = crust(new THREE.TorusGeometry(R, 0.016, 10, 24, 1.9), { roughness: 0.45, color: 0xffd79a });
        core.rotation.set(Math.PI / 2, 0, Math.PI / 2 - 0.95);
        core.scale.set(1, 1, 0.8);
        g.add(at(core, 0, 0.016, -R));
        return g;
      }
      if (/\bbun\b/.test(lower)) {
        const bun = crust(latheGeometry([[0, 0], [0.05, 0], [0.055, 0.02], [0.04, 0.045], [0, 0.055]], 20), { roughness: 0.4, color: 0xffd9a0 });
        const g = group(bun);
        const rnd = seededRandom(11);
        for (let i = 0; i < 24; i++) {
          const a = rnd() * 6.28, d = rnd() * 0.035;
          const seed = at(mesh(new THREE.SphereGeometry(0.0025, 6, 4), 0xf5e6c4), Math.cos(a) * d, 0.053 - d * d * 6, Math.sin(a) * d);
          seed.scale.set(1.8, 0.6, 1);
          seed.rotation.y = rnd() * 3;
          g.add(seed);
        }
        return g;
      }
      // A round sourdough loaf, floured, with a cross scored and opened up in the bake
      const loaf = crust(new THREE.SphereGeometry(0.1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2));
      loaf.scale.set(1.3, 0.85, 1.2);
      const base = crust(new THREE.CylinderGeometry(0.128, 0.122, 0.022, 28));
      base.scale.set(1, 1, 0.92);
      const g = group(at(base, 0, 0.011, 0), at(loaf, 0, 0.018, 0));
      [0, Math.PI / 2].forEach(rot => {
        const score = mesh(new THREE.TorusGeometry(0.075, 0.006, 6, 20, Math.PI * 0.75), 0xe9c98c, { roughness: 0.95 });
        score.rotation.set(0, rot, 0);
        score.rotation.z = Math.PI * 0.125;
        score.scale.set(1.2, 0.95, 1);
        g.add(at(score, 0, 0.018, 0));
      });
      return g;
    }

function bakedModel(lower) {
      if (/cookie/.test(lower)) {
        const g = group();
        [[0, 0, 0, 0], [0.085, 0.012, 0.02, 0.15], [0.035, 0.024, -0.05, -0.1]].forEach(([x, y, z, tilt], i) => {
          const geo = topDownUV(latheGeometry([[0, 0], [0.037, 0], [0.041, 0.004], [0.04, 0.009], [0.032, 0.012], [0, 0.0125]], 28), 0.1);
          const c = surfaced(geo, 'cookie', { roughness: 0.85, bumpScale: 0.003 });
          c.rotation.set(tilt, i * 1.7, tilt * 0.5);
          g.add(at(c, x, y, z));
        });
        return g;
      }
      if (/cake/.test(lower)) {
        // A cream-covered layer cake on a stand, piped round the edge, strawberries and a candle on top
        const cream = (geo) => surfaced(geo, 'frosting', { roughness: 0.55, bumpScale: 0.002 });
        const stand = lathe([[0, 0], [0.05, 0], [0.02, 0.01], [0.015, 0.05], [0.14, 0.055], [0.14, 0.062], [0, 0.062]], 0xf8fafc, { roughness: 0.15 }, 32);
        const g = group(stand, at(cream(new THREE.CylinderGeometry(0.11, 0.11, 0.09, 40)), 0, 0.107, 0));
        for (let i = 0; i < 18; i++) {
          const a = i / 18 * Math.PI * 2;
          const swirl = mesh(new THREE.ConeGeometry(0.011, 0.018, 8), 0xf9d5e5, { roughness: 0.5 });
          g.add(at(swirl, Math.cos(a) * 0.098, 0.161, Math.sin(a) * 0.098));
          const bead = mesh(new THREE.SphereGeometry(0.008, 8, 6), 0xf9d5e5, { roughness: 0.5 });
          g.add(at(bead, Math.cos(a) * 0.111, 0.066, Math.sin(a) * 0.111));
        }
        for (let i = 0; i < 5; i++) {
          const a = i / 5 * Math.PI * 2 + 0.3;
          const berry = mesh(new THREE.ConeGeometry(0.014, 0.026, 10), 0xc8102e, { roughness: 0.3 });
          berry.rotation.z = Math.PI;
          berry.add(at(mesh(new THREE.ConeGeometry(0.01, 0.004, 6), 0x2f7d32), 0, 0.014, 0));
          g.add(at(berry, Math.cos(a) * 0.05, 0.168, Math.sin(a) * 0.05));
        }
        g.add(at(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 8), 0x60a5fa), 0, 0.177, 0));
        g.add(at(mesh(new THREE.ConeGeometry(0.005, 0.014, 6), 0xfbbf24, { emissive: 0xf59e0b, emissiveIntensity: 0.8 }), 0, 0.21, 0));
        return g;
      }
      // A pie or tart in its dish, with a golden lattice top
      const dish = lathe([[0, 0], [0.1, 0], [0.12, 0.035], [0.13, 0.037], [0.128, 0.04], [0.112, 0.036], [0, 0.03]], 0xf1f5f9, { roughness: 0.2 }, 32);
      const filling = at(mesh(new THREE.CylinderGeometry(0.108, 0.108, 0.008, 28), /cherr|berr/.test(lower) ? 0x7f1022 : 0x9a4a12, { roughness: 0.3 }), 0, 0.031, 0);
      const rim = surfaced(new THREE.TorusGeometry(0.111, 0.009, 8, 36), 'crust', { color: 0xffdca6, roughness: 0.6 });
      rim.rotation.x = Math.PI / 2;
      const g = group(dish, filling, at(rim, 0, 0.038, 0));
      [-0.06, -0.02, 0.02, 0.06].forEach(o => {
        const half = Math.sqrt(Math.max(0, 0.108 * 0.108 - o * o)) * 2;
        g.add(at(surfaced(new THREE.BoxGeometry(half, 0.006, 0.016), 'crust', { color: 0xffdca6 }), 0, 0.037, o));
        g.add(at(surfaced(new THREE.BoxGeometry(0.016, 0.007, half), 'crust', { color: 0xffdca6 }), o, 0.04, 0));
      });
      return g;
    }

function noodleBowlModel() {
      const bowl = lathe([[0, 0], [0.04, 0], [0.04, 0.008], [0.085, 0.04], [0.1, 0.08], [0.095, 0.08], [0.08, 0.042], [0.035, 0.012], [0, 0.012]], 0xf8fafc, { side: THREE.DoubleSide });
      const broth = at(mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.004, 22), 0xe8a33d), 0, 0.068, 0);
      const g = group(bowl, broth);
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05;
        g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
          new THREE.Vector3(Math.cos(a) * 0.06, 0.07, Math.sin(a) * 0.06), new THREE.Vector3(0, 0.074, 0), new THREE.Vector3(Math.cos(a + 2.6) * 0.06, 0.07, Math.sin(a + 2.6) * 0.06)]), 10, 0.004, 4), new THREE.MeshStandardMaterial({ color: 0xfde68a })));
      }
      const egg = at(mesh(new THREE.SphereGeometry(0.022, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xf8fafc), 0.03, 0.068, 0.02);
      egg.add(at(mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.002, 10), 0xf59e0b), 0, 0.002, 0));
      g.add(egg, at(mesh(new THREE.BoxGeometry(0.03, 0.002, 0.04), 0x14532d), -0.03, 0.072, -0.02));
      [-0.008, 0.008].forEach(z => g.add(rod([-0.05, 0.085, z], [0.16, 0.11, z * 2.5], 0.003, 0xa16207)));
      return g;
    }

function cheeseModel() {
      // A wedge cut from a round wheel: pale paste with holes, a waxed rind round the curved back
      const R = 0.14, angle = 0.62, h = 0.075;
      const sector = (r0, r1) => {
        const s = new THREE.Shape();
        s.moveTo(Math.cos(-angle / 2) * r0, Math.sin(-angle / 2) * r0);
        s.absarc(0, 0, r1, -angle / 2, angle / 2, false);
        if (r0 > 0) s.absarc(0, 0, r0, angle / 2, -angle / 2, true);
        else s.lineTo(0, 0);
        const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 16 });
        geo.rotateX(-Math.PI / 2);
        return geo;
      };
      const paste = surfaced(boxUV(sector(0, R - 0.006), 0.12), 'cheese', { roughness: 0.6, bumpScale: 0.005 });
      const rind = mesh(sector(R - 0.007, R), 0xb7791f, { roughness: 0.45 });
      const g = group(paste, rind);
      g.position.x = -R * 0.55;
      return group(g);
    }

function pizzaModel() {
      const top = new THREE.Mesh(new THREE.CircleGeometry(0.143, 40), new THREE.MeshStandardMaterial({ ...surfaceTexture('pizza'), bumpScale: 0.003, roughness: 0.55 }));
      top.rotation.x = -Math.PI / 2;
      top.receiveShadow = true;
      const crust = surfaced(new THREE.TorusGeometry(0.142, 0.013, 10, 48), 'crust', { color: 0xffe0b0, roughness: 0.75 });
      crust.rotation.x = Math.PI / 2;
      crust.scale.set(1, 1, 0.8);
      const g = group(
        at(mesh(new THREE.CylinderGeometry(0.15, 0.148, 0.01, 40), 0xe0b070, { roughness: 0.85 }), 0, 0.005, 0),
        at(top, 0, 0.0105, 0),
        at(crust, 0, 0.013, 0)
      );
      const rnd = seededRandom(5);
      for (let i = 0; i < 11; i++) {
        const a = i * 2.39, r = 0.025 + (i % 4) * 0.03;
        const slice = surfaced(new THREE.CylinderGeometry(0.017, 0.016, 0.003, 18), 'pepperoni', { roughness: 0.35, bumpScale: 0.001 });
        slice.rotation.set((rnd() - 0.5) * 0.2, 0, (rnd() - 0.5) * 0.2);
        g.add(at(slice, Math.cos(a) * r, 0.0135, Math.sin(a) * r));
      }
      return g;
    }

function chocolateModel() {
      // A bar half out of its wrapper: squares of chocolate, crinkled foil, a paper sleeve
      const choc = { roughness: 0.32, bumpScale: 0.0008 };
      const g = group(at(surfaced(new THREE.BoxGeometry(0.16, 0.007, 0.078), 'chocolate', choc), 0, 0.0035, 0));
      for (let i = 0; i < 8; i++) {
        const square = surfaced(new THREE.CylinderGeometry(0.019, 0.024, 0.006, 4, 1), 'chocolate', choc);
        square.rotation.y = Math.PI / 4;
        g.add(at(square, -0.06 + (i % 4) * 0.04, 0.01, i < 4 ? -0.019 : 0.019));
      }
      const foilTex = surfaceTexture('foil');
      const foil = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.084, 6, 2, 6), new THREE.MeshStandardMaterial({ map: foilTex.map, bumpMap: foilTex.bumpMap, bumpScale: 0.002, metalness: 1, roughness: 0.32, envMap: typeof materialReflections === 'function' ? materialReflections() : null }));
      // Crumple the foil a little
      const p = foil.geometry.attributes.position, rnd = seededRandom(3);
      for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + (rnd() - 0.5) * 0.003, p.getY(i) + (rnd() - 0.5) * 0.003, p.getZ(i) + (rnd() - 0.5) * 0.003);
      foil.geometry.computeVertexNormals();
      const sleeve = mesh(new THREE.BoxGeometry(0.062, 0.022, 0.088), 0x7a1020, { roughness: 0.6 });
      const band = mesh(new THREE.BoxGeometry(0.012, 0.0225, 0.0885), 0xd4a72c, { metalness: 0.7, roughness: 0.3 });
      return group(...g.children, at(foil, 0.055, 0.009, 0), at(sleeve, 0.07, 0.01, 0), at(band, 0.06, 0.01, 0));
    }

function drinkModel(lower) {
      if (/thermos/.test(lower)) {
        return group(
          lathe([[0, 0], [0.037, 0], [0.037, 0.22], [0.03, 0.24], [0, 0.24]], 0x0ea5e9, { metalness: 0.15, roughness: 0.35 }),
          at(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 16), 0x1e293b), 0, 0.26, 0)
        );
      }
      if (/tea|cocoa|milk/.test(lower)) {
        const mug = lathe([[0, 0], [0.04, 0], [0.042, 0.09], [0.038, 0.09], [0.036, 0.006], [0, 0.006]], 0xf8fafc, { side: THREE.DoubleSide });
        const handle = mesh(new THREE.TorusGeometry(0.024, 0.006, 6, 14, Math.PI), 0xf8fafc);
        handle.rotation.z = -Math.PI / 2;
        const drink = at(mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.002, 16), /cocoa/.test(lower) ? 0x5b3a1e : /milk/.test(lower) ? 0xfefce8 : 0xb45309), 0, 0.078, 0);
        return group(mug, at(handle, 0.042, 0.045, 0), drink);
      }
      // A takeaway cup with a sleeve and lid
      return group(
        lathe([[0, 0], [0.028, 0], [0.042, 0.13], [0, 0.13]], 0xf8fafc),
        at(lathe([[0.034, 0], [0.039, 0.045], [0.0, 0.045]], 0x92400e), 0, 0.05, 0),
        at(lathe([[0, 0], [0.045, 0], [0.044, 0.012], [0.03, 0.02], [0, 0.02]], 0x1e293b), 0, 0.13, 0)
      );
    }

function fishModel() {
      const body = mesh(new THREE.SphereGeometry(0.05, 18, 12), 0xf48b8b, { roughness: 0.35, metalness: 0.2 });
      body.scale.set(4.4, 1.15, 0.7);
      const back = mesh(new THREE.SphereGeometry(0.05, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.6), 0x475569, { roughness: 0.4 });
      back.scale.set(4.3, 1.2, 0.72);
      const tail = slab([[0, 0], [-0.09, 0.06], [-0.07, 0], [-0.09, -0.06]], 0.006, 0x64748b);
      const dorsal = slab([[0, 0], [0.04, 0], [-0.02, 0.04]], 0.004, 0x64748b);
      const eye = mesh(new THREE.SphereGeometry(0.008, 8, 6), 0x111827);
      return group(at(body, 0, 0.06, 0), at(back, 0, 0.062, 0), at(tail, -0.2, 0.06, 0), at(dorsal, 0, 0.11, 0), at(eye, 0.17, 0.07, 0.025));
    }

function carrotModel() {
      // Three carrots: ringed, tapering roots with feathery green tops
      const g = group();
      [[0, 0, 0], [0.03, 0.05, 0.25], [-0.02, -0.04, -0.2]].forEach(([dz, dx, yaw], i) => {
        const one = group();
        const root = surfaced(latheGeometry([[0, 0], [0.004, 0.004], [0.011, 0.03], [0.017, 0.09], [0.02, 0.15], [0.018, 0.168], [0.01, 0.175], [0, 0.176]], 16), 'carrot', { roughness: 0.65, bumpScale: 0.0015 });
        root.rotation.z = -Math.PI / 2;
        one.add(at(root, 0.09, 0.02, 0));
        const rnd = seededRandom(20 + i);
        for (let k = 0; k < 7; k++) {
          const spread = (k - 3) * 0.12, len = 0.1 + rnd() * 0.06;
          const stem = rod([-0.085, 0.02, 0], [-0.085 - len, 0.02 + Math.sin(spread) * len * 0.6 + 0.015, Math.cos(k) * 0.02], 0.0018, 0x3f8f2a);
          one.add(stem);
          for (let f = 1; f <= 3; f++) {
            const t = f / 3.5;
            const leaf = mesh(new THREE.SphereGeometry(0.012, 6, 4), 0x4caf37, { roughness: 0.8, side: THREE.DoubleSide });
            leaf.scale.set(1, 0.18, 0.55);
            leaf.rotation.set(rnd() * 2, rnd() * 3, rnd() * 0.6);
            one.add(at(leaf, -0.085 - len * t, 0.02 + (Math.sin(spread) * len * 0.6 + 0.015) * t, Math.cos(k) * 0.02 * t));
          }
        }
        one.rotation.y = yaw;
        g.add(at(one, dx, 0, dz));
      });
      return g;
    }

// One piece of fruit at real size, standing on y = 0 (fruitBasket in items3d.js heaps them up)
function fruitPiece(kind, color, radius) {
      if (kind === 'apple') {
        const k = radius / 0.042;
        const body = surfaced(latheGeometry([[0, 0.007], [0.008, 0.003], [0.02, 0.003], [0.031, 0.009], [0.039, 0.02], [0.042, 0.034], [0.041, 0.047], [0.036, 0.06], [0.027, 0.068], [0.016, 0.07], [0.008, 0.065], [0, 0.061]].map(([r, y]) => [r * k, y * k]), 32), 'apple', { roughness: 0.35, bumpScale: 0.0005 });
        const stem = rod([0, 0.058 * k, 0], [0.004 * k, 0.078 * k, 0.002 * k], 0.0018 * k, 0x5b3a1e);
        return group(at(body, 0, -0.035 * k, 0), at(stem, 0, -0.035 * k, 0));
      }
      if (kind === 'peach') {
        const body = surfaced(new THREE.SphereGeometry(radius, 18, 14), 'peach', { roughness: 0.85 });
        body.scale.set(1, 0.95, 1.04);
        const crease = mesh(new THREE.TorusGeometry(radius * 0.98, radius * 0.04, 4, 20, Math.PI), 0xd9773a, { roughness: 0.9 });
        crease.rotation.y = Math.PI / 2;
        return group(body, crease);
      }
      if (kind === 'cherry') {
        const body = mesh(new THREE.SphereGeometry(radius, 14, 10), 0x7a0a12, { roughness: 0.18 });
        body.scale.set(1.05, 0.95, 1);
        const stem = rod([0, radius * 0.8, 0], [radius * 0.6, radius * 3.2, 0], 0.0009, 0x4d7c2a);
        return group(body, stem);
      }
      // Blueberries and grapes: a dusty bloom on the skin
      const berry = mesh(new THREE.SphereGeometry(radius, 12, 8), color, { roughness: 0.7 });
      if (radius < 0.012) berry.add(at(mesh(new THREE.CylinderGeometry(radius * 0.35, radius * 0.25, radius * 0.2, 5), 0x1e1b3a), 0, radius * 0.95, 0));
      return group(berry);
    }

// --- Toys ---------------------------------------------------------------------------------------
function kiteModel() {
      const sail = slab([[0, 0.45], [0.27, 0.08], [0, -0.3], [-0.27, 0.08]], 0.004, 0xef4444, { side: THREE.DoubleSide });
      const panel = slab([[0, 0.45], [0.27, 0.08], [0, 0.08]], 0.005, 0xfacc15, { side: THREE.DoubleSide });
      const spars = [rod([0, 0.45, 0.01], [0, -0.3, 0.01], 0.004, 0x8a5a2b), rod([-0.27, 0.08, 0.01], [0.27, 0.08, 0.01], 0.004, 0x8a5a2b)];
      const kite = group(sail, panel, ...spars);
      const pts = [];
      for (let i = 0; i <= 8; i++) pts.push(new THREE.Vector3(Math.sin(i * 0.9) * 0.04, -0.3 - i * 0.06, 0));
      kite.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.003, 4), new THREE.MeshStandardMaterial({ color: 0x334155 })));
      [2, 4, 6].forEach(i => kite.add(at(mesh(new THREE.ConeGeometry(0.02, 0.03, 4), i % 4 ? 0x3b82f6 : 0x22c55e), pts[i].x, pts[i].y, 0)));
      kite.rotation.x = -1.2;
      kite.position.y = 0.06;
      return group(kite);
    }

function yoyoModel() {
      const half = (z) => {
        const h = lathe([[0.004, 0], [0.028, 0], [0.03, 0.012], [0.026, 0.02], [0.004, 0.02]], 0x22c55e, { metalness: 0.2 });
        h.rotation.x = z > 0 ? -Math.PI / 2 : Math.PI / 2;
        return at(h, 0, 0.03, z * 0.004);
      };
      const string = rod([0, 0.03, 0], [0.0, 0.2, 0], 0.0015, 0xf8fafc);
      const loop = at(mesh(new THREE.TorusGeometry(0.01, 0.002, 4, 10), 0xf8fafc), 0, 0.21, 0);
      return group(half(1), half(-1), string, loop);
    }

function ballModel(lower) {
      if (/juggl|marble/.test(lower)) {
        const size = /marble/.test(lower) ? 0.008 : 0.035;
        return group(...[0xef4444, 0x22c55e, 0x3b82f6].map((c, i) => at(mesh(new THREE.SphereGeometry(size, 14, 10), c), (i - 1) * size * 2.3, size, 0)));
      }
      if (/beach/.test(lower)) {
        const g = group();
        [0xef4444, 0xf8fafc, 0x3b82f6, 0xfacc15, 0xf8fafc, 0x22c55e].forEach((c, i) => {
          g.add(at(mesh(new THREE.SphereGeometry(0.14, 12, 12, (i / 6) * Math.PI * 2, Math.PI / 3), c), 0, 0.14, 0));
        });
        return g;
      }
      // A football: 12 black pentagons and 20 white hexagons, with the stitched seams between them
      return group(at(mesh(footballGeometry(0.11), 0xffffff, { vertexColors: true, roughness: 0.45 }), 0, 0.11, 0));
    }

// Colour a sphere's vertices by the panel they fall in: the nearest of the icosahedron's 12 corners
// (black pentagons) and 20 face centres (white hexagons); close to a border it is a grey seam
function footballGeometry(radius) {
      const geo = new THREE.SphereGeometry(radius, 96, 64);
      const ico = new THREE.IcosahedronGeometry(1, 0);
      const ip = ico.attributes.position;
      const corners = [], faces = [];
      for (let i = 0; i < ip.count; i += 3) {
        const tri = [0, 1, 2].map(k => new THREE.Vector3(ip.getX(i + k), ip.getY(i + k), ip.getZ(i + k)));
        faces.push(tri[0].clone().add(tri[1]).add(tri[2]).normalize());
        tri.forEach(v => { if (!corners.some(c => c.distanceTo(v) < 1e-3)) corners.push(v.clone().normalize()); });
      }
      const centres = [...corners.map(v => ({ v, black: true })), ...faces.map(v => ({ v, black: false }))];
      const pos = geo.attributes.position, colours = new Float32Array(pos.count * 3), n = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        n.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
        let best = -2, second = -2, black = false;
        centres.forEach(c => {
          // Pentagons are a little smaller than hexagons on a real ball
          const d = n.dot(c.v) - (c.black ? 0.018 : 0);
          if (d > best) { second = best; best = d; black = c.black; } else if (d > second) second = d;
        });
        const tone = best - second < 0.01 ? 0.45 : black ? 0.06 : 0.95;
        colours.set([tone, tone, tone], i * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
      return geo;
    }

function duckModel() {
      const body = mesh(new THREE.SphereGeometry(0.045, 16, 12), 0xfacc15);
      body.scale.set(1.3, 0.85, 1);
      const head = mesh(new THREE.SphereGeometry(0.028, 14, 10), 0xfacc15);
      const beak = mesh(new THREE.SphereGeometry(0.014, 10, 6), 0xf97316);
      beak.scale.set(1.5, 0.5, 1.1);
      const tail = mesh(new THREE.ConeGeometry(0.015, 0.03, 8), 0xfacc15);
      tail.rotation.z = Math.PI / 1.6;
      const eyes = [-1, 1].map(s => at(mesh(new THREE.SphereGeometry(0.005, 6, 6), 0x111827), 0.04, 0.096, s * 0.016));
      return group(at(body, 0, 0.04, 0), at(head, 0.03, 0.088, 0), at(beak, 0.06, 0.083, 0), at(tail, -0.06, 0.06, 0), ...eyes);
    }

function spinningTopModel() {
      const body = lathe([[0, 0], [0.012, 0.01], [0.045, 0.04], [0.05, 0.05], [0.03, 0.06], [0, 0.062]], 0x06b6d4, { metalness: 0.3 });
      const band = at(mesh(new THREE.TorusGeometry(0.048, 0.004, 6, 24), 0xf472b6), 0, 0.046, 0);
      band.rotation.x = Math.PI / 2;
      return group(body, band, at(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 8), 0x1f2937), 0, 0.075, 0));
    }

function frogModel() {
      const body = mesh(new THREE.SphereGeometry(0.04, 14, 10), 0x16a34a);
      body.scale.set(1.3, 0.75, 1.05);
      const belly = mesh(new THREE.SphereGeometry(0.038, 14, 10), 0xbef264);
      belly.scale.set(1.2, 0.5, 0.95);
      const eyes = [-1, 1].map(s => group(at(mesh(new THREE.SphereGeometry(0.014, 10, 8), 0x16a34a), 0, 0, 0), at(mesh(new THREE.SphereGeometry(0.007, 8, 6), 0x111827), 0.008, 0.004, 0)));
      eyes[0].position.set(0.03, 0.06, -0.02);
      eyes[1].position.set(0.03, 0.06, 0.02);
      const legs = [-1, 1].map(s => at(mesh(new THREE.SphereGeometry(0.018, 10, 8), 0x15803d), -0.03, 0.015, s * 0.035));
      return group(at(body, 0, 0.032, 0), at(belly, 0.005, 0.022, 0), ...eyes, ...legs);
    }

function blocksModel() {
      const g = group();
      const colors = [0xef4444, 0x22c55e, 0x3b82f6, 0xfacc15];
      [[0, 0, 0, 0.064, 0.032], [0.034, 0.02, 0.0, 0.064, 0.032], [-0.02, 0.04, 0.0, 0.032, 0.032], [0.05, 0, 0.05, 0.032, 0.032]].forEach(([x, y, z, w, d], i) => {
        const brick = at(mesh(new THREE.BoxGeometry(w, 0.02, d), colors[i % 4], { roughness: 0.3 }), x, y + 0.01, z);
        for (let sx = 0; sx < w / 0.016; sx++) for (let sz = 0; sz < d / 0.016; sz++) {
          brick.add(at(mesh(new THREE.CylinderGeometry(0.0048, 0.0048, 0.004, 10), colors[i % 4]), -w / 2 + 0.008 + sx * 0.016, 0.012, -d / 2 + 0.008 + sz * 0.016));
        }
        g.add(brick);
      });
      return g;
    }

// --- Instruments and books ---------------------------------------------------------------------
function guitarModel(lower) {
      const scale = /ukulele/.test(lower) ? 0.55 : /violin/.test(lower) ? 0.6 : 1;
      const wood = /violin/.test(lower) ? 0x9a3412 : 0xc8955a;
      // Figure-of-eight body outline
      const shape = new THREE.Shape();
      shape.moveTo(0, -0.25);
      shape.bezierCurveTo(0.2, -0.25, 0.2, 0.0, 0.12, 0.04);
      shape.bezierCurveTo(0.16, 0.1, 0.15, 0.22, 0, 0.22);
      shape.bezierCurveTo(-0.15, 0.22, -0.16, 0.1, -0.12, 0.04);
      shape.bezierCurveTo(-0.2, 0.0, -0.2, -0.25, 0, -0.25);
      if (!/violin/.test(lower)) shape.holes.push(circlePath(0, 0.06, 0.045));
      const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 16 });
      bodyGeo.translate(0, 0, -0.045);
      const body = mesh(bodyGeo, wood, { roughness: 0.5 });
      const neck = at(mesh(new THREE.BoxGeometry(0.05, 0.44, 0.025), 0x5b3a1e), 0, 0.44, 0.03);
      const head = at(mesh(new THREE.BoxGeometry(0.075, 0.13, 0.02), 0x3f2a14), 0, 0.72, 0.03);
      const bridge = at(mesh(new THREE.BoxGeometry(0.1, 0.012, 0.012), 0x3f2a14), 0, -0.13, 0.05);
      const g = group(body, neck, head, bridge);
      for (let i = 0; i < (/ukulele|violin/.test(lower) ? 4 : 6); i++) {
        const x = -0.015 + i * 0.006;
        g.add(rod([x, -0.13, 0.055], [x * 0.8, 0.66, 0.045], 0.0012, 0xe2e8f0, { metalness: 0.9 }));
      }
      // Stands on its end, leaning slightly back
      g.rotation.x = -0.12;
      g.position.y = 0.26;
      // Shrink one level down, so lifeSize() scaling the result doesn't undo it
      const sized = group(g);
      sized.scale.setScalar(scale);
      return group(sized);
    }

function harmonicaModel() {
      const g = group(
        at(mesh(new THREE.BoxGeometry(0.1, 0.02, 0.026), 0x92400e), 0, 0.013, 0),
        at(mesh(new THREE.BoxGeometry(0.104, 0.008, 0.028), 0xcbd5e1, { metalness: 0.9, roughness: 0.2 }), 0, 0.027, 0),
        at(mesh(new THREE.BoxGeometry(0.104, 0.008, 0.028), 0xcbd5e1, { metalness: 0.9, roughness: 0.2 }), 0, 0.002, 0)
      );
      for (let i = 0; i < 10; i++) g.add(at(mesh(new THREE.BoxGeometry(0.005, 0.008, 0.002), 0x1f2937), -0.045 + i * 0.01, 0.013, 0.014));
      return g;
    }

function bookModel(lower) {
      const cover = /journal|notebook/.test(lower) ? 0x1e3a8a : /manual/.test(lower) ? 0x0f766e : 0x7c3aed;
      return group(
        at(mesh(new THREE.BoxGeometry(0.17, 0.004, 0.24), cover), 0, 0.002, 0),
        at(mesh(new THREE.BoxGeometry(0.162, 0.024, 0.232), 0xfef3c7), 0.003, 0.016, 0),
        at(mesh(new THREE.BoxGeometry(0.17, 0.004, 0.24), cover), 0, 0.03, 0),
        at(mesh(new THREE.BoxGeometry(0.006, 0.032, 0.24), cover), -0.085, 0.016, 0),
        at(mesh(new THREE.BoxGeometry(0.1, 0.001, 0.03), 0xfacc15), 0.0, 0.0325, -0.06)
      );
    }

function seedPacketsModel() {
      const g = group();
      [0xf472b6, 0x4ade80, 0xfacc15].forEach((c, i) => {
        const packet = at(mesh(new THREE.BoxGeometry(0.08, 0.12, 0.004), 0xf8fafc), (i - 1) * 0.06, 0.06, i * 0.012);
        packet.add(at(mesh(new THREE.BoxGeometry(0.066, 0.06, 0.001), c), 0, 0.012, 0.003));
        packet.rotation.y = (i - 1) * 0.25;
        packet.rotation.x = -0.15;
        g.add(packet);
      });
      return g;
    }
