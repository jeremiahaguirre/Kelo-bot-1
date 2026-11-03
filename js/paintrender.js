// Kelo-bot-1 — js/paintrender.js
// Loaded after pastimes.js. How Kelo-1's real paintings are made, as pictures. Two steps:
//   1. paintingSceneRef() lays out the scene he is looking at with simple shapes: the Okanagan lake at
//      sunset, the mountains, his house, deer and birds in the meadow, a still life of things he owns,
//      the night sky or a portrait of his robot friend, in the season and weather of the day.
//   2. renderPaintingInMedium() paints that scene again in a real medium, the way the medium behaves:
//      oil (impasto bristle strokes that follow the forms, wet blending, canvas weave, raking light),
//      acrylic (flat bold layers), watercolour (transparent washes, wet edges, blooms, granulation and
//      white paper), gouache (matte opaque shapes, dry-brush edges), soft pastel (chalk caught on the
//      paper's tooth), ink (sumi-e washes and brush lines) and charcoal or graphite (smudged values).
// His skill (q, 0..1) changes everything: early pictures wobble, go muddy and lose detail.
// Nothing here touches his state; js/paintstudio.js decides what to paint and keeps the results.

const ART_W = 512, ART_H = 384;

function artCanvas(w = ART_W, h = ART_H) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    }

function artClamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function artSmooth(a, b, v) { const t = artClamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); }
function artMix(a, b, t) { return a + (b - a) * t; }

function artHexRgb(hex) {
      const h = String(hex).replace('#', '');
      const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

function artRgbCss(c, a = 1) {
      return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
    }

function artMixHex(a, b, t) {
      const A = artHexRgb(a), B = artHexRgb(b);
      return artRgbCss([0, 1, 2].map(i => artMix(A[i], B[i], t)));
    }

// --- Noise and pixel helpers -------------------------------------------------------------------------
function artValueNoise(w, h, cell, rng) {
      const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2;
      const g = new Float32Array(gw * gh);
      for (let i = 0; i < g.length; i++) g[i] = rng();
      const out = new Float32Array(w * h);
      for (let y = 0; y < h; y++) {
        const fy = y / cell, iy = fy | 0, ty = fy - iy, sy = ty * ty * (3 - 2 * ty);
        for (let x = 0; x < w; x++) {
          const fx = x / cell, ix = fx | 0, tx = fx - ix, sx = tx * tx * (3 - 2 * tx);
          const i0 = iy * gw + ix;
          const a = g[i0], b = g[i0 + 1], c = g[i0 + gw], d = g[i0 + gw + 1];
          out[y * w + x] = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
        }
      }
      return out;
    }

function artFbm(w, h, cell, octaves, rng) {
      const out = new Float32Array(w * h);
      let amp = 1, total = 0;
      for (let o = 0; o < octaves; o++) {
        const n = artValueNoise(w, h, Math.max(1, cell / Math.pow(2, o)), rng);
        for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
        total += amp;
        amp *= 0.5;
      }
      for (let i = 0; i < out.length; i++) out[i] /= total;
      return out;
    }

// Box blur (run twice it is close to a Gaussian) on one channel
function artBlur(src, w, h, r, passes = 2) {
      r = Math.max(0, Math.round(r));
      if (!r) return Float32Array.from(src);
      let a = Float32Array.from(src), b = new Float32Array(src.length);
      const norm = 1 / (2 * r + 1);
      for (let p = 0; p < passes; p++) {
        for (let y = 0; y < h; y++) {
          const row = y * w;
          let s = 0;
          for (let k = -r; k <= r; k++) s += a[row + Math.min(w - 1, Math.max(0, k))];
          for (let x = 0; x < w; x++) {
            b[row + x] = s * norm;
            s += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
          }
        }
        for (let x = 0; x < w; x++) {
          let s = 0;
          for (let k = -r; k <= r; k++) s += b[Math.min(h - 1, Math.max(0, k)) * w + x];
          for (let y = 0; y < h; y++) {
            a[y * w + x] = s * norm;
            s += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
          }
        }
      }
      return a;
    }

function artChannels(canvas) {
      const w = canvas.width, h = canvas.height;
      const d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
      const r = new Float32Array(w * h), g = new Float32Array(w * h), b = new Float32Array(w * h);
      for (let i = 0, j = 0; i < r.length; i++, j += 4) { r[i] = d[j] / 255; g[i] = d[j + 1] / 255; b[i] = d[j + 2] / 255; }
      return { r, g, b, w, h };
    }

function artBlurChannels(C, r) {
      return { r: artBlur(C.r, C.w, C.h, r), g: artBlur(C.g, C.w, C.h, r), b: artBlur(C.b, C.w, C.h, r), w: C.w, h: C.h };
    }

function artLum(C) {
      const L = new Float32Array(C.r.length);
      for (let i = 0; i < L.length; i++) L[i] = 0.299 * C.r[i] + 0.587 * C.g[i] + 0.114 * C.b[i];
      return L;
    }

function artPutChannels(canvas, r, g, b) {
      const ctx = canvas.getContext('2d');
      const img = ctx.createImageData(canvas.width, canvas.height);
      const d = img.data;
      for (let i = 0, j = 0; i < r.length; i++, j += 4) {
        d[j] = r[i] * 255; d[j + 1] = g[i] * 255; d[j + 2] = b[i] * 255; d[j + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }

// The way forms run: a smoothed structure tensor gives each pixel the direction along its edges
// (strokes follow mountain ridges, run flat across sky and water). Weak spots fall back to horizontal.
function artDirectionField(L, w, h, rng, smooth = 6) {
      const Lb = artBlur(L, w, h, 2);
      const j11 = new Float32Array(w * h), j12 = new Float32Array(w * h), j22 = new Float32Array(w * h);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          const gx = (Lb[i + 1] - Lb[i - 1]) * 0.5, gy = (Lb[i + w] - Lb[i - w]) * 0.5;
          j11[i] = gx * gx; j12[i] = gx * gy; j22[i] = gy * gy;
        }
      }
      const a = artBlur(j11, w, h, smooth), b = artBlur(j12, w, h, smooth), c = artBlur(j22, w, h, smooth);
      const ang = new Float32Array(w * h), mag = new Float32Array(w * h);
      const wander = artValueNoise(w, h, 48, rng);
      let maxM = 1e-9;
      for (let i = 0; i < ang.length; i++) {
        const m = Math.sqrt((a[i] - c[i]) * (a[i] - c[i]) + 4 * b[i] * b[i]);
        mag[i] = m;
        if (m > maxM) maxM = m;
      }
      for (let i = 0; i < ang.length; i++) {
        const along = 0.5 * Math.atan2(2 * b[i], a[i] - c[i]) + Math.PI / 2;
        const t = artSmooth(0.002, 0.03, mag[i] / maxM);
        const flat = (wander[i] - 0.5) * 0.5;
        // blend angles through their vectors (a stroke direction has no front or back: double angles)
        const vx = Math.cos(2 * along) * t + Math.cos(2 * flat) * (1 - t), vy = Math.sin(2 * along) * t + Math.sin(2 * flat) * (1 - t);
        ang[i] = 0.5 * Math.atan2(vy, vx);
        mag[i] = mag[i] / maxM;
      }
      return { ang, mag };
    }

function artSobelMag(L, w, h) {
      const m = new Float32Array(w * h);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          const gx = (L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1]) - (L[i - w - 1] + 2 * L[i - 1] + L[i + w - 1]);
          const gy = (L[i + w - 1] + 2 * L[i + w] + L[i + w + 1]) - (L[i - w - 1] + 2 * L[i - w] + L[i - w + 1]);
          m[i] = Math.sqrt(gx * gx + gy * gy);
        }
      }
      return m;
    }

// A few flat colours that stand for the whole picture (median cut on a sample of pixels)
function artPalette(C, k, rng) {
      const pts = [];
      for (let n = 0; n < 4000; n++) {
        const i = Math.floor(rng() * C.r.length);
        pts.push([C.r[i], C.g[i], C.b[i]]);
      }
      let boxes = [pts];
      while (boxes.length < k) {
        boxes.sort((a, b) => b.length - a.length);
        const box = boxes.shift();
        if (box.length < 2) { boxes.push(box); break; }
        const ranges = [0, 1, 2].map(ch => { let lo = 1, hi = 0; box.forEach(p => { lo = Math.min(lo, p[ch]); hi = Math.max(hi, p[ch]); }); return hi - lo; });
        const ch = ranges.indexOf(Math.max(...ranges));
        box.sort((a, b) => a[ch] - b[ch]);
        const mid = box.length >> 1;
        boxes.push(box.slice(0, mid), box.slice(mid));
      }
      return boxes.map(box => [0, 1, 2].map(ch => box.reduce((s, p) => s + p[ch], 0) / box.length));
    }

function artNearest(pal, r, g, b) {
      let best = 0, bd = 1e9;
      for (let k = 0; k < pal.length; k++) {
        const p = pal[k], d = (p[0] - r) * (p[0] - r) + (p[1] - g) * (p[1] - g) + (p[2] - b) * (p[2] - b);
        if (d < bd) { bd = d; best = k; }
      }
      return best;
    }

// ====================================================================================================
// 1. The scene, built from simple shapes
// ====================================================================================================
// spec: { subject, season, weather ('clear'|'rain'|'snow'), time ('sunset'|'day'|'golden'|'night'),
//         seed, q (skill 0..1), items: [names for a still life], friend: { name, self }, deer, birds, frozen }
const ART_SEASON_LOOK = {
  Spring: { grass: ['#86b45a', '#a8cf6e', '#5f8f3e'], leaf: ['#5d9a3e', '#7fb94f', '#f4b6c8'], snowline: 0.3, ground: '#7a9a4c' },
  Summer: { grass: ['#c8ae63', '#d9c27a', '#9a9a52'], leaf: ['#3f6f34', '#557f3b', '#6b8f45'], snowline: 0.12, ground: '#b89a5c' },
  Autumn: { grass: ['#b49a5a', '#c7a35c', '#8f7a45'], leaf: ['#d8862a', '#e8b93c', '#b4462a'], snowline: 0.4, ground: '#9c7f4a' },
  Winter: { grass: ['#eef3f7', '#dfe8f0', '#b9cbe0'], leaf: ['#2f4a3a', '#3b5646', '#e9eff5'], snowline: 1, ground: '#e8eef4' }
};

const ART_SKIES = {
  sunset: ['#2b3a78', '#6b5aa3', '#d7728a', '#f3a865', '#fde0a6'],
  day: ['#3f78bf', '#6e9fd6', '#a9c8e6', '#dce9f2', '#eef2ee'],
  golden: ['#5d8ccc', '#93b4d9', '#e9d3a8', '#f6c886', '#fbe3b4'],
  night: ['#03081a', '#0a1636', '#142a55', '#22406e', '#33557f'],
  rain: ['#525a66', '#6c737e', '#8a9099', '#a3a8ae', '#b4b8bb'],
  winter: ['#7fa6cf', '#a5c2de', '#cddcea', '#e6edf3', '#f2f4f5']
};

function artSkyFor(spec) {
      // sumi-e leaves the sky as bare paper, with a breath of grey at the horizon
      if (spec.medium === 'ink' && spec.season === 'Winter' && spec.time !== 'night') return ['#9c9c9c', '#a8a8a8', '#b4b4b4', '#bebebe', '#c8c8c8'];
      if (spec.medium === 'ink') return spec.time === 'night' ? ['#9a9a9a', '#b0b0b0', '#c4c4c4', '#d6d6d6', '#e4e4e4'] : ['#ffffff', '#ffffff', '#fbfbfb', '#efefef', '#e2e2e2'];
      if (spec.time === 'night') return ART_SKIES.night;
      if (spec.weather === 'rain' || spec.weather === 'snow') return spec.weather === 'snow' ? ['#8f99a6', '#a7afba', '#c0c6cd', '#d3d7db', '#dfe2e4'] : ART_SKIES.rain;
      if (spec.time === 'sunset') return ART_SKIES.sunset;
      if (spec.time === 'golden') return ART_SKIES.golden;
      return spec.season === 'Winter' ? ART_SKIES.winter : ART_SKIES.day;
    }

function artDrawSky(ctx, spec, top, bottom) {
      const stops = artSkyFor(spec);
      const g = ctx.createLinearGradient(0, top, 0, bottom);
      stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
      ctx.fillStyle = g;
      ctx.fillRect(0, top, ART_W, bottom - top);
    }

// A ridge line by midpoint displacement
function artRidge(rng, x0, x1, yBase, height, rough, wob) {
      let pts = [[x0, yBase - height * (0.3 + rng() * 0.4)], [x1, yBase - height * (0.3 + rng() * 0.4)]];
      let disp = height * 0.9;
      for (let level = 0; level < 6; level++) {
        const next = [pts[0]];
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i];
          const my = (a[1] + b[1]) / 2 + (rng() - 0.5) * disp;
          next.push([(a[0] + b[0]) / 2 + (rng() - 0.5) * wob, Math.max(yBase - height * 1.15, Math.min(yBase - 4, my))], b);
        }
        pts = next;
        disp *= rough;
      }
      return pts;
    }

// A mountain skyline: a few distinct peaks with their own slopes, roughened with small crags
function artPeaksRidge(rng, x0, x1, yBase, height) {
      const n = Math.max(2, Math.min(7, Math.round((x1 - x0) / (height * 1.5))));
      const peaks = [];
      for (let i = 0; i < n; i++) {
        peaks.push({ x: x0 + (i + 0.5 + (rng() - 0.5) * 0.7) * (x1 - x0) / n, h: height * (0.55 + rng() * 0.45), l: 0.55 + rng() * 0.7, r: 0.55 + rng() * 0.7 });
      }
      const waves = [0, 1, 2, 3].map(k => ({ f: 0.02 * Math.pow(2.1, k) * (0.8 + rng() * 0.4), p: rng() * 6.28, a: height * 0.05 / Math.pow(1.8, k) }));
      const pts = [];
      for (let x = x0; x <= x1 + 0.1; x += 4) {
        let h = height * 0.22;
        peaks.forEach(pk => { h = Math.max(h, pk.h - Math.abs(x - pk.x) * (x < pk.x ? pk.l : pk.r)); });
        waves.forEach(w => { h += Math.sin(x * w.f + w.p) * w.a; });
        pts.push([x, yBase - h + (rng() - 0.5) * 2]);
      }
      return pts;
    }

function artFillRidge(ctx, pts, yBottom, fill) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], yBottom);
      pts.forEach(p => ctx.lineTo(p[0], p[1]));
      ctx.lineTo(pts[pts.length - 1][0], yBottom);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }

// A mountain range with a lit side, a shadow side and snow above the snowline
function artMountains(ctx, rng, spec, { yBase, height, color, shade, snow, snowFrac, rough = 0.55, x0 = -20, x1 = ART_W + 20 }) {
      const pts = artPeaksRidge(rng, x0, x1, yBase, height);
      artFillRidge(ctx, pts, yBase + 2, color);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0][0], yBase + 2);
      pts.forEach(p => ctx.lineTo(p[0], p[1]));
      ctx.lineTo(pts[pts.length - 1][0], yBase + 2);
      ctx.closePath();
      ctx.clip();
      // Shadow sides: from each main peak, the slope down to the next valley is in shade, and the shade
      // runs down the mountain from there along a gully (so faces follow the real ridge line)
      const shadeFaces = [];
      for (let i = 2; i < pts.length - 2; i++) {
        const p = pts[i];
        if (!(p[1] <= pts[i - 1][1] && p[1] <= pts[i + 1][1] && p[1] <= pts[Math.max(0, i - 4)][1] && p[1] <= pts[Math.min(pts.length - 1, i + 4)][1] && p[1] < yBase - height * 0.3)) continue;
        let j = i + 1;
        while (j < pts.length - 1 && pts[j + 1][1] >= pts[j][1] - 0.5) j++;
        const drop = pts[j][1] - p[1];
        if (drop < height * 0.08) continue;
        const poly = pts.slice(i, j + 1).map(q => [q[0], q[1]]);
        // the shaded flank reaches down to the foot of the mountain under the valley
        poly.push([pts[j][0], yBase + 2], [p[0] + (pts[j][0] - p[0]) * 0.1, yBase + 2]);
        shadeFaces.push(poly);
        ctx.beginPath();
        poly.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
        ctx.closePath();
        ctx.fillStyle = shade;
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (snow && snowFrac > 0) {
        const line = yBase - height * (1 - snowFrac * 0.65);
        const noise = artRidge(rng, x0, x1, line + 6, 10, 0.7, 3);
        ctx.beginPath();
        ctx.moveTo(x0, -10);
        noise.forEach(p => ctx.lineTo(p[0], p[1] + (rng() - 0.5) * 6));
        ctx.lineTo(x1, -10);
        ctx.closePath();
        ctx.fillStyle = snow;
        ctx.fill();
        // and the snow on the shadow sides is blue
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x0, -10);
        noise.forEach(p => ctx.lineTo(p[0], p[1]));
        ctx.lineTo(x1, -10);
        ctx.closePath();
        ctx.clip();
        shadeFaces.forEach(poly => {
          ctx.beginPath();
          poly.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
          ctx.closePath();
          ctx.fillStyle = 'rgba(120,140,185,0.55)';
          ctx.fill();
        });
        ctx.restore();
      }
      ctx.restore();
      return pts;
    }

function artFir(ctx, x, y, hgt, color, snow, rng, wob = 0) {
      const tiers = 4 + Math.floor(rng() * 2);
      const lean = (rng() - 0.5) * wob * 0.3;
      ctx.fillStyle = '#3a2a1e';
      ctx.fillRect(x - hgt * 0.025, y - hgt * 0.12, hgt * 0.05, hgt * 0.14);
      for (let t = 0; t < tiers; t++) {
        const ty = y - hgt * 0.1 - t * hgt * 0.2, tw = hgt * (0.34 - t * 0.06);
        ctx.beginPath();
        ctx.moveTo(x - tw + lean * t, ty);
        ctx.lineTo(x + lean * (t + 2) + (rng() - 0.5) * wob, ty - hgt * 0.32);
        ctx.lineTo(x + tw + lean * t, ty);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        // lit side
        ctx.beginPath();
        ctx.moveTo(x - tw + lean * t, ty);
        ctx.lineTo(x + lean * (t + 2), ty - hgt * 0.32);
        ctx.lineTo(x - tw * 0.2 + lean * t, ty);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,240,200,0.10)';
        ctx.fill();
        if (snow) {
          ctx.fillStyle = snow;
          ctx.beginPath();
          ctx.ellipse(x - tw * 0.3 + lean * t, ty - hgt * 0.03, tw * 0.45, hgt * 0.025, -0.25, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

function artLeafyTree(ctx, x, y, hgt, colors, rng, bare = false) {
      ctx.strokeStyle = '#4a3527';
      ctx.lineWidth = Math.max(2, hgt * 0.06);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rng() - 0.5) * 4, y - hgt * 0.55);
      ctx.stroke();
      if (bare) {
        ctx.lineWidth = Math.max(1, hgt * 0.02);
        for (let i = 0; i < 9; i++) {
          const a = -Math.PI / 2 + (rng() - 0.5) * 2.2, l = hgt * (0.2 + rng() * 0.3), sy = y - hgt * (0.3 + rng() * 0.3);
          ctx.beginPath();
          ctx.moveTo(x, sy);
          ctx.lineTo(x + Math.cos(a) * l, sy + Math.sin(a) * l);
          ctx.stroke();
        }
        return;
      }
      for (let i = 0; i < 9; i++) {
        const bx = x + (rng() - 0.5) * hgt * 0.55, by = y - hgt * (0.55 + rng() * 0.35), r = hgt * (0.13 + rng() * 0.12);
        const c = colors[Math.floor(rng() * colors.length)];
        const g = ctx.createRadialGradient(bx - r * 0.4, by - r * 0.4, r * 0.1, bx, by, r);
        g.addColorStop(0, artMixHex(c, '#fff6d8', 0.25));
        g.addColorStop(1, artMixHex(c, '#1c2a1a', 0.35));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

function artClouds(ctx, rng, spec, yMax, count) {
      if (spec.medium === 'ink') return;
      const lit = spec.time === 'sunset' ? '#ffd2b0' : spec.time === 'golden' ? '#fff0d0' : '#ffffff';
      const dark = spec.time === 'sunset' ? '#9a6a96' : spec.weather === 'rain' ? '#6b717a' : '#b9c6d6';
      for (let c = 0; c < count; c++) {
        const cx = rng() * ART_W, cy = 20 + rng() * (yMax - 40), wdt = 60 + rng() * 110, flat = spec.time === 'sunset' ? 0.25 : 0.45;
        for (let i = 0; i < 9; i++) {
          const bx = cx + (rng() - 0.5) * wdt, by = cy + (rng() - 0.5) * wdt * flat * 0.4, r = wdt * (0.12 + rng() * 0.14);
          const g = ctx.createLinearGradient(0, by - r, 0, by + r);
          g.addColorStop(0, lit);
          g.addColorStop(1, dark);
          ctx.fillStyle = g;
          ctx.globalAlpha = spec.time === 'sunset' ? 0.55 : 0.85;
          ctx.beginPath();
          ctx.ellipse(bx, by, r * (spec.time === 'sunset' ? 2.2 : 1.2), r * (spec.time === 'sunset' ? 0.35 : 0.8), 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

function artWater(ctx, rng, spec, top, sun, reflect = null) {
      const sky = artSkyFor(spec);
      const frozen = spec.frozen;
      const g = ctx.createLinearGradient(0, top, 0, ART_H);
      if (frozen) {
        g.addColorStop(0, '#d7e3ec');
        g.addColorStop(1, '#aac2d6');
      } else {
        g.addColorStop(0, sky[sky.length - 1]);
        g.addColorStop(0.25, sky[sky.length - 2]);
        g.addColorStop(1, artMixHex(sky[1], '#0d2238', 0.45));
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, top, ART_W, ART_H - top);
      if (reflect) reflect();
      if (frozen) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 14; i++) {
          let x = rng() * ART_W, y = top + rng() * (ART_H - top);
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (let k = 0; k < 4; k++) { x += (rng() - 0.3) * 40; y += (rng() - 0.5) * 8; ctx.lineTo(x, y); }
          ctx.stroke();
        }
        return;
      }
      // Ripples: light and dark horizontal dashes, wider nearer the viewer
      for (let i = 0; i < 260; i++) {
        const y = top + Math.pow(rng(), 1.4) * (ART_H - top);
        const near = (y - top) / (ART_H - top);
        const len = 6 + near * 40 * rng();
        ctx.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(10,25,45,0.12)';
        ctx.fillRect(rng() * ART_W, y, len, 1 + near * 2);
      }
      if (sun) {
        // The sun's path of light across the water
        for (let i = 0; i < 140; i++) {
          const near = Math.pow(rng(), 0.8);
          const y = top + 2 + near * (ART_H - top);
          const spread = 6 + near * 55;
          const x = sun.x + (rng() - 0.5) * 2 * spread * (0.4 + rng() * 0.6);
          ctx.fillStyle = spec.time === 'night' ? `rgba(230,236,255,${0.35 + rng() * 0.4})` : `rgba(255,236,170,${0.45 + rng() * 0.5})`;
          ctx.fillRect(x, y, 3 + near * 16 * rng(), 1 + near * 2.5);
        }
      }
      if (spec.weather === 'rain') {
        ctx.strokeStyle = 'rgba(220,230,240,0.35)';
        for (let i = 0; i < 40; i++) {
          const x = rng() * ART_W, y = top + rng() * (ART_H - top), r = 2 + rng() * 8;
          ctx.beginPath();
          ctx.ellipse(x, y, r * 2, r * 0.5, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

function artRainAndSnow(ctx, rng, spec) {
      if (spec.weather === 'rain') {
        ctx.strokeStyle = 'rgba(225,232,240,0.28)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 220; i++) {
          const x = rng() * ART_W, y = rng() * ART_H, l = 10 + rng() * 18;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - l * 0.25, y + l);
          ctx.stroke();
        }
      } else if (spec.weather === 'snow') {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (let i = 0; i < 260; i++) {
          ctx.beginPath();
          ctx.arc(rng() * ART_W, rng() * ART_H, 0.8 + rng() * 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

function artSunDisk(ctx, x, y, r, warm) {
      const glow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 7);
      glow.addColorStop(0, warm ? 'rgba(255,230,170,0.85)' : 'rgba(255,255,240,0.7)');
      glow.addColorStop(1, 'rgba(255,200,140,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);
      ctx.fillStyle = warm ? '#fff3cf' : '#fffdf2';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

function artMeadow(ctx, rng, spec, top, look) {
      const g = ctx.createLinearGradient(0, top, 0, ART_H);
      g.addColorStop(0, look.grass[1]);
      g.addColorStop(0.5, look.grass[0]);
      g.addColorStop(1, look.grass[2]);
      ctx.fillStyle = g;
      ctx.fillRect(0, top, ART_W, ART_H - top);
      // Tufts and texture, bigger towards the viewer
      for (let i = 0; i < 420; i++) {
        const y = top + Math.pow(rng(), 0.7) * (ART_H - top), near = (y - top) / (ART_H - top);
        ctx.fillStyle = rng() < 0.5 ? artMixHex(look.grass[2], '#2a2a18', 0.3) : artMixHex(look.grass[1], '#fff8e0', 0.25);
        ctx.globalAlpha = 0.35;
        ctx.fillRect(rng() * ART_W, y, 2 + near * 14, 1 + near * 3);
      }
      ctx.globalAlpha = 1;
      if (spec.season === 'Spring' || spec.season === 'Summer') {
        const flowers = spec.season === 'Spring' ? ['#f9d24a', '#f4f1f8', '#c991e0'] : ['#f2c84b', '#e9e3d0'];
        for (let i = 0; i < 70; i++) {
          const y = top + 10 + rng() * (ART_H - top - 10), near = (y - top) / (ART_H - top);
          ctx.fillStyle = flowers[Math.floor(rng() * flowers.length)];
          ctx.beginPath();
          ctx.arc(rng() * ART_W, y, 1 + near * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

function artShadowSnowTint(spec) {
      return spec.season === 'Winter' ? '#eef3f8' : null;
    }

// Mule deer: big ears, a grey-brown coat, a white rump with a black-tipped tail
function artDeer(ctx, x, y, s, facing, grazing, rng, wob = 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(facing, 1);
      const coat = '#8a7058', dark = '#4a3a2c', belly = '#d8c7ad';
      ctx.strokeStyle = dark;
      ctx.lineCap = 'round';
      // legs
      ctx.lineWidth = s * 0.05;
      [[-0.32, 0.02], [-0.22, -0.03], [0.22, 0.03], [0.32, -0.02]].forEach(([lx, sw]) => {
        ctx.beginPath();
        ctx.moveTo(lx * s, -s * 0.42);
        ctx.lineTo((lx + sw + (Math.random() - 0.5) * wob * 0.04) * s, 0);
        ctx.stroke();
      });
      // body
      const g = ctx.createLinearGradient(0, -s * 0.75, 0, -s * 0.35);
      g.addColorStop(0, artMixHex(coat, '#f0dcc0', 0.2));
      g.addColorStop(1, artMixHex(coat, '#3a2a20', 0.25));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.56, s * 0.42, s * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = belly;
      ctx.beginPath();
      ctx.ellipse(-s * 0.4, -s * 0.6, s * 0.08, s * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1d1712';
      ctx.beginPath();
      ctx.ellipse(-s * 0.46, -s * 0.62, s * 0.03, s * 0.05, 0.3, 0, Math.PI * 2);
      ctx.fill();
      // neck and head
      const hx = grazing ? s * 0.55 : s * 0.5, hy = grazing ? -s * 0.12 : -s * 0.98;
      ctx.strokeStyle = coat;
      ctx.lineWidth = s * 0.13;
      ctx.beginPath();
      ctx.moveTo(s * 0.32, -s * 0.62);
      ctx.lineTo(hx - s * 0.04, hy + s * 0.06);
      ctx.stroke();
      ctx.fillStyle = coat;
      ctx.beginPath();
      ctx.ellipse(hx, hy, s * 0.11, s * 0.07, grazing ? 1.2 : 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = artMixHex(coat, '#c9b496', 0.4);
      [-1, 1].forEach(e => {
        ctx.beginPath();
        ctx.ellipse(hx - s * 0.06 + e * s * 0.03, hy - s * 0.1, s * 0.035, s * 0.09, e * 0.6 - 0.3, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = '#1b1410';
      ctx.beginPath();
      ctx.arc(hx + s * 0.1, hy + (grazing ? s * 0.06 : s * 0.02), s * 0.022, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

function artBirds(ctx, rng, n, x0, y0, spread, color) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const x = x0 + (rng() - 0.5) * spread, y = y0 + (rng() - 0.5) * spread * 0.4, s = 4 + rng() * 5;
        ctx.beginPath();
        ctx.moveTo(x - s, y - s * 0.3);
        ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.6, x, y);
        ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.6, x + s, y - s * 0.3);
        ctx.stroke();
      }
    }

// His house: cream walls, a slate-blue gable roof, a teal door, a stone chimney
function artHouse(ctx, x, y, s, spec, rng, wob = 0) {
      const lean = (rng() - 0.5) * wob * 0.12;
      const w = s, h = s * 0.55, roofH = s * 0.42;
      const night = spec.time === 'night' || spec.time === 'sunset' || spec.time === 'golden';
      ctx.save();
      ctx.translate(x, y);
      ctx.transform(1, 0, lean, 1, 0, 0);
      // side wall in shade
      ctx.fillStyle = '#cdbfa6';
      ctx.beginPath();
      ctx.moveTo(w * 0.5, 0); ctx.lineTo(w * 0.78, -h * 0.12); ctx.lineTo(w * 0.78, -h * 1.06); ctx.lineTo(w * 0.5, -h);
      ctx.closePath(); ctx.fill();
      // front wall
      const wall = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      wall.addColorStop(0, '#fbf2e0'); wall.addColorStop(1, '#e8dcc4');
      ctx.fillStyle = wall;
      ctx.fillRect(-w / 2, -h, w, h);
      // chimney
      ctx.fillStyle = '#8f8a82';
      ctx.fillRect(w * 0.22, -h - roofH * 0.95, w * 0.12, roofH * 0.7);
      ctx.fillStyle = '#6d6760';
      ctx.fillRect(w * 0.2, -h - roofH * 0.98, w * 0.16, roofH * 0.08);
      // roof (gable to the front) and the side roof
      ctx.fillStyle = '#34505a';
      ctx.beginPath();
      ctx.moveTo(w * 0.5, -h); ctx.lineTo(w * 0.82, -h * 1.1); ctx.lineTo(w * 0.32, -h - roofH * 1.05); ctx.lineTo(0, -h - roofH);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4a6b76';
      ctx.beginPath();
      ctx.moveTo(-w / 2 - w * 0.05, -h + 2); ctx.lineTo(0, -h - roofH); ctx.lineTo(w / 2 + w * 0.05, -h + 2);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ece2cf';
      ctx.lineWidth = s * 0.02;
      ctx.stroke();
      if (spec.season === 'Winter') {
        ctx.fillStyle = '#f4f8fb';
        ctx.beginPath();
        ctx.moveTo(-w / 2 - w * 0.04, -h + 1); ctx.lineTo(0, -h - roofH - 3); ctx.lineTo(w / 2 + w * 0.04, -h + 1);
        ctx.lineTo(w * 0.3, -h - roofH * 0.25); ctx.lineTo(0, -h - roofH * 0.8); ctx.lineTo(-w * 0.3, -h - roofH * 0.25);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(w * 0.5, -h - 2); ctx.lineTo(w * 0.82, -h * 1.12); ctx.lineTo(w * 0.32, -h - roofH * 1.08); ctx.lineTo(0, -h - roofH - 3);
        ctx.closePath(); ctx.fill();
      }
      // door and windows
      ctx.fillStyle = '#2f6f73';
      ctx.fillRect(-w * 0.08, -h * 0.62, w * 0.16, h * 0.62);
      ctx.fillStyle = '#d4a73a';
      ctx.fillRect(w * 0.04, -h * 0.32, w * 0.02, w * 0.02);
      const glass = night ? '#ffcf7a' : '#9cc6dc';
      [[-0.34, -0.72], [0.2, -0.72]].forEach(([wx, wy]) => {
        ctx.fillStyle = '#8a5a34';
        ctx.fillRect(w * wx - 2, h * wy - 2, w * 0.16 + 4, h * 0.34 + 4);
        ctx.fillStyle = glass;
        ctx.fillRect(w * wx, h * wy, w * 0.16, h * 0.34);
        ctx.fillStyle = '#8a5a34';
        ctx.fillRect(w * wx + w * 0.075, h * wy, w * 0.012, h * 0.34);
        ctx.fillRect(w * wx, h * wy + h * 0.16, w * 0.16, h * 0.02);
      });
      ctx.restore();
      // smoke from the chimney on cool days
      if (spec.season !== 'Summer') {
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle = `rgba(230,230,235,${0.35 - i * 0.035})`;
          ctx.beginPath();
          ctx.arc(x + w * 0.28 + i * 4 + Math.sin(i) * 3, y - h - roofH * 1.0 - i * 9, 4 + i * 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

// A robot bust in three-quarter light: his friend (cream and orange, dark visor, one wheel) or himself
function artRobotPortrait(ctx, cx, cy, s, who) {
      const self = who === 'self';
      const shell = self ? '#3fb7b0' : '#efe9dd', shellDark = self ? '#1d6f73' : '#a99f8c', accent = self ? '#f472b6' : '#f97316';
      // body
      const bg = ctx.createRadialGradient(cx - s * 0.3, cy + s * 0.55, s * 0.1, cx, cy + s * 0.75, s * 0.9);
      bg.addColorStop(0, artMixHex(shell, '#ffffff', 0.35)); bg.addColorStop(1, shellDark);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.ellipse(cx, cy + s * 0.95, s * 0.72, s * 0.55, 0, Math.PI, 0);
      ctx.lineTo(cx + s * 0.72, ART_H + 10);
      ctx.lineTo(cx - s * 0.72, ART_H + 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.ellipse(cx + s * 0.05, cy + s * 0.9, s * 0.2, s * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.arc(cx + s * 0.05, cy + s * 0.9, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
      // neck
      ctx.fillStyle = '#3b4252';
      ctx.fillRect(cx - s * 0.12, cy + s * 0.35, s * 0.24, s * 0.22);
      // head
      const hg = ctx.createRadialGradient(cx - s * 0.25, cy - s * 0.3, s * 0.08, cx, cy, s * 0.62);
      hg.addColorStop(0, artMixHex(shell, '#ffffff', 0.55)); hg.addColorStop(0.6, shell); hg.addColorStop(1, shellDark);
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 0.58, s * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // face screen / visor
      ctx.fillStyle = '#141b2b';
      ctx.beginPath();
      if (self) ctx.ellipse(cx + s * 0.06, cy + s * 0.04, s * 0.4, s * 0.3, 0, 0, Math.PI * 2);
      else ctx.ellipse(cx + s * 0.06, cy - s * 0.02, s * 0.44, s * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.ellipse(cx - s * 0.12, cy - s * 0.08, s * 0.14, s * 0.05, -0.3, 0, Math.PI * 2);
      ctx.fill();
      // glowing eyes
      const eye = self ? '#a5f3fc' : '#67e8f9';
      [-0.12, 0.22].forEach(ex => {
        const eg = ctx.createRadialGradient(cx + s * ex, cy + s * 0.02, 0, cx + s * ex, cy + s * 0.02, s * 0.12);
        eg.addColorStop(0, '#ffffff'); eg.addColorStop(0.35, eye); eg.addColorStop(1, 'rgba(34,211,238,0)');
        ctx.fillStyle = eg;
        ctx.fillRect(cx + s * ex - s * 0.12, cy - s * 0.1, s * 0.24, s * 0.24);
      });
      if (self) {
        ctx.fillStyle = 'rgba(244,114,182,0.75)';
        [-0.24, 0.36].forEach(ex => { ctx.beginPath(); ctx.ellipse(cx + s * ex, cy + s * 0.18, s * 0.06, s * 0.035, 0, 0, Math.PI * 2); ctx.fill(); });
        // headphone ears
        ctx.fillStyle = '#e2e8f0';
        [-1, 1].forEach(e => { ctx.beginPath(); ctx.ellipse(cx + e * s * 0.58, cy, s * 0.1, s * 0.16, 0, 0, Math.PI * 2); ctx.fill(); });
      }
      // antenna
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = s * 0.03;
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.05, cy - s * 0.48);
      ctx.quadraticCurveTo(cx + s * 0.12, cy - s * 0.7, cx + s * 0.08, cy - s * 0.82);
      ctx.stroke();
      const tg = ctx.createRadialGradient(cx + s * 0.08, cy - s * 0.85, 0, cx + s * 0.08, cy - s * 0.85, s * 0.1);
      tg.addColorStop(0, '#fffbe6'); tg.addColorStop(0.5, '#fbbf24'); tg.addColorStop(1, 'rgba(251,191,36,0)');
      ctx.fillStyle = tg;
      ctx.fillRect(cx - s * 0.05, cy - s * 0.98, s * 0.26, s * 0.26);
      // rim light from the right
      ctx.strokeStyle = 'rgba(255,240,210,0.55)';
      ctx.lineWidth = s * 0.025;
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 0.57, s * 0.49, 0, -0.9, 0.5);
      ctx.stroke();
    }

// What a still-life object looks like, from its name
function artStillLifeShape(name) {
      const n = String(name || '').toLowerCase();
      const fruit = [[/apple|cherr/, '#b8332a'], [/orange|peach|apricot/, '#e3842a'], [/lemon|banana/, '#e8c840'], [/pear/, '#b5c04a'], [/plum|grape|berr/, '#5b3a78'], [/lime/, '#79a83a']];
      const f = fruit.find(([re]) => re.test(n));
      if (f) return { kind: /banana/.test(n) ? 'banana' : 'fruit', color: f[1], label: name };
      if (/vase|bottle|jar|jug|honey|syrup|milk|water|oil|vinegar|wine|cider|juice/.test(n)) return { kind: 'vase', color: /honey|syrup/.test(n) ? '#c98a2a' : /bottle|wine|cider/.test(n) ? '#3f6b4a' : '#5a7fa8', label: name };
      if (/mug|cup|coffee|tea|cocoa|thermos/.test(n)) return { kind: 'mug', color: '#d9d2c3', label: name };
      if (/book|novel|atlas|guide|comic|journal/.test(n)) return { kind: 'book', color: '#7a2f2f', label: name };
      if (/ukulele|guitar|violin|banjo|mandolin/.test(n)) return { kind: 'uke', color: '#b0763b', label: name };
      if (/hammer|wrench|screwdriver|pliers|knife|chisel|brush|trowel/.test(n)) return { kind: 'tool', color: '#8a8f98', label: name };
      if (/bread|loaf|bun|croissant|muffin|cake|pie|tart/.test(n)) return { kind: 'loaf', color: '#c08a4a', label: name };
      if (/kite|yo-?yo|ball|toy|top|harmonica|kalimba|telescope|camera|lantern|candle/.test(n)) return { kind: 'box', color: /lantern|candle/.test(n) ? '#c9a24a' : '#3d6fa8', label: name };
      return { kind: 'vase', color: '#a8673f', label: name };
    }

function artShaded(ctx, x, y, rx, ry, color) {
      const g = ctx.createRadialGradient(x - rx * 0.4, y - ry * 0.45, Math.min(rx, ry) * 0.08, x, y, Math.max(rx, ry) * 1.05);
      g.addColorStop(0, artMixHex(color, '#fffaf0', 0.55));
      g.addColorStop(0.45, color);
      g.addColorStop(1, artMixHex(color, '#120c08', 0.6));
      return g;
    }

function artStillLife(ctx, rng, spec) {
      // wall, lit from the left
      const wall = ctx.createLinearGradient(0, 0, ART_W, 0);
      wall.addColorStop(0, '#6b5844'); wall.addColorStop(1, '#2e241c');
      ctx.fillStyle = wall;
      ctx.fillRect(0, 0, ART_W, ART_H);
      const lightPool = ctx.createRadialGradient(ART_W * 0.25, ART_H * 0.3, 10, ART_W * 0.25, ART_H * 0.3, ART_W * 0.6);
      lightPool.addColorStop(0, 'rgba(255,225,170,0.35)'); lightPool.addColorStop(1, 'rgba(255,225,170,0)');
      ctx.fillStyle = lightPool;
      ctx.fillRect(0, 0, ART_W, ART_H);
      // table
      const tableY = ART_H * 0.62;
      const tg = ctx.createLinearGradient(0, tableY, 0, ART_H);
      tg.addColorStop(0, '#8a5a34'); tg.addColorStop(1, '#4a2c18');
      ctx.fillStyle = tg;
      ctx.fillRect(0, tableY, ART_W, ART_H - tableY);
      ctx.fillStyle = 'rgba(255,220,170,0.25)';
      ctx.fillRect(0, tableY, ART_W, 3);
      // a cloth draped over the front
      ctx.fillStyle = '#e9e4d8';
      ctx.beginPath();
      ctx.moveTo(ART_W * 0.08, tableY + 4);
      ctx.quadraticCurveTo(ART_W * 0.3, tableY - 6, ART_W * 0.55, tableY + 6);
      ctx.lineTo(ART_W * 0.62, ART_H);
      ctx.lineTo(ART_W * 0.02, ART_H);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,110,95,0.45)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(ART_W * (0.14 + i * 0.11), tableY + 8);
        ctx.quadraticCurveTo(ART_W * (0.12 + i * 0.12), ART_H * 0.85, ART_W * (0.1 + i * 0.13), ART_H);
        ctx.stroke();
      }
      const items = (spec.items && spec.items.length ? spec.items : ['A ceramic jug', 'An apple', 'An orange']).slice(0, 4).map(artStillLifeShape);
      if (items.length < 3) items.push(artStillLifeShape('a pear'));
      const slots = [[0.36, 0.74, 1.0], [0.58, 0.7, 1.15], [0.76, 0.78, 0.95], [0.2, 0.86, 0.85]];
      items.sort((a, b) => (b.kind === 'vase' || b.kind === 'uke') - (a.kind === 'vase' || a.kind === 'uke'));
      items.forEach((it, i) => {
        const [fx, fy, sc] = slots[i % slots.length];
        const x = ART_W * fx + (rng() - 0.5) * 10, y = ART_H * fy, s = 82 * sc;
        // cast shadow to the right
        ctx.fillStyle = 'rgba(25,15,8,0.45)';
        ctx.beginPath();
        ctx.ellipse(x + s * 0.55, y + 2, s * 0.8, s * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        if (it.kind === 'fruit') {
          ctx.fillStyle = artShaded(ctx, x, y - s * 0.32, s * 0.36, s * 0.34, it.color);
          ctx.beginPath(); ctx.arc(x, y - s * 0.32, s * 0.35, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x, y - s * 0.64); ctx.lineTo(x + 3, y - s * 0.78); ctx.stroke();
        } else if (it.kind === 'banana') {
          ctx.fillStyle = artShaded(ctx, x, y - s * 0.2, s * 0.6, s * 0.2, it.color);
          ctx.beginPath(); ctx.moveTo(x - s * 0.6, y - s * 0.35); ctx.quadraticCurveTo(x, y + s * 0.05, x + s * 0.6, y - s * 0.35);
          ctx.quadraticCurveTo(x, y - s * 0.12, x - s * 0.6, y - s * 0.35); ctx.fill();
        } else if (it.kind === 'vase') {
          ctx.fillStyle = artShaded(ctx, x, y - s * 0.9, s * 0.45, s * 0.9, it.color);
          ctx.beginPath();
          ctx.moveTo(x - s * 0.18, y - s * 1.8); ctx.lineTo(x + s * 0.18, y - s * 1.8);
          ctx.bezierCurveTo(x + s * 0.12, y - s * 1.3, x + s * 0.55, y - s * 1.0, x + s * 0.4, y - s * 0.15);
          ctx.quadraticCurveTo(x, y + s * 0.05, x - s * 0.4, y - s * 0.15);
          ctx.bezierCurveTo(x - s * 0.55, y - s * 1.0, x - s * 0.12, y - s * 1.3, x - s * 0.18, y - s * 1.8);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,250,235,0.55)';
          ctx.beginPath(); ctx.ellipse(x - s * 0.2, y - s * 0.75, s * 0.05, s * 0.22, 0.1, 0, Math.PI * 2); ctx.fill();
        } else if (it.kind === 'mug') {
          ctx.strokeStyle = artMixHex(it.color, '#3a3026', 0.4); ctx.lineWidth = s * 0.08;
          ctx.beginPath(); ctx.ellipse(x + s * 0.38, y - s * 0.4, s * 0.15, s * 0.18, 0, -1.3, 1.3); ctx.stroke();
          const mg = ctx.createLinearGradient(x - s * 0.35, 0, x + s * 0.35, 0);
          mg.addColorStop(0, artMixHex(it.color, '#ffffff', 0.4)); mg.addColorStop(1, artMixHex(it.color, '#2a2018', 0.55));
          ctx.fillStyle = mg; ctx.fillRect(x - s * 0.35, y - s * 0.75, s * 0.7, s * 0.72);
          ctx.fillStyle = '#3a2516'; ctx.beginPath(); ctx.ellipse(x, y - s * 0.75, s * 0.35, s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
        } else if (it.kind === 'book') {
          ctx.fillStyle = '#efe6d2'; ctx.fillRect(x - s * 0.7, y - s * 0.3, s * 1.4, s * 0.25);
          ctx.fillStyle = it.color; ctx.fillRect(x - s * 0.72, y - s * 0.36, s * 1.44, s * 0.08); ctx.fillRect(x - s * 0.72, y - s * 0.07, s * 1.44, s * 0.07);
        } else if (it.kind === 'uke') {
          ctx.save(); ctx.translate(x, y - s * 0.9); ctx.rotate(-0.25);
          ctx.fillStyle = artShaded(ctx, 0, s * 0.3, s * 0.5, s * 0.7, it.color);
          ctx.beginPath(); ctx.ellipse(0, s * 0.45, s * 0.42, s * 0.38, 0, 0, Math.PI * 2); ctx.ellipse(0, -s * 0.05, s * 0.32, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.arc(0, s * 0.2, s * 0.1, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#5a3a20'; ctx.fillRect(-s * 0.06, -s * 1.1, s * 0.12, s * 0.9);
          ctx.restore();
        } else if (it.kind === 'tool') {
          ctx.save(); ctx.translate(x, y - s * 0.1); ctx.rotate(0.15);
          ctx.fillStyle = '#7a4a26'; ctx.fillRect(-s * 0.7, -s * 0.06, s * 0.9, s * 0.12);
          ctx.fillStyle = artShaded(ctx, s * 0.3, 0, s * 0.2, s * 0.2, it.color); ctx.fillRect(s * 0.2, -s * 0.2, s * 0.22, s * 0.4);
          ctx.restore();
        } else if (it.kind === 'loaf') {
          ctx.fillStyle = artShaded(ctx, x, y - s * 0.3, s * 0.6, s * 0.35, it.color);
          ctx.beginPath(); ctx.ellipse(x, y - s * 0.28, s * 0.6, s * 0.3, 0, Math.PI, 0); ctx.lineTo(x + s * 0.6, y); ctx.lineTo(x - s * 0.6, y); ctx.fill();
        } else {
          const bg = ctx.createLinearGradient(x - s * 0.4, 0, x + s * 0.4, 0);
          bg.addColorStop(0, artMixHex(it.color, '#ffffff', 0.35)); bg.addColorStop(1, artMixHex(it.color, '#101010', 0.5));
          ctx.fillStyle = bg; ctx.fillRect(x - s * 0.4, y - s * 0.6, s * 0.8, s * 0.6);
        }
      });
    }

// The whole scene, as a plain picture to paint from. Returns { ref, horizon, sun }.
function paintingSceneRef(spec) {
      const rng = makeRng(`scene:${spec.seed}`);
      const q = artClamp01(spec.q == null ? 0.5 : spec.q);
      const wob = (1 - q) * 14;
      const ref = artCanvas();
      const ctx = ref.getContext('2d');
      const look = ART_SEASON_LOOK[spec.season] || ART_SEASON_LOOK.Summer;
      ctx.save();
      // A beginner's horizon tilts a little
      const tilt = (rng() - 0.5) * 0.14 * Math.pow(1 - q, 1.5);
      ctx.translate(ART_W / 2, ART_H / 2);
      ctx.rotate(tilt);
      ctx.scale(1 + Math.abs(tilt) * 1.6, 1 + Math.abs(tilt) * 1.6);
      ctx.translate(-ART_W / 2, -ART_H / 2);
      let horizon = ART_H * 0.55, sun = null;
      const subject = spec.subject;
      const snowy = spec.season === 'Winter';
      const farMtn = spec.time === 'sunset' ? ['#8f7aa6', '#6e5c8c'] : spec.time === 'night' ? ['#1b2747', '#121c36'] : spec.weather === 'rain' ? ['#7d858f', '#666e78'] : ['#8b9bc0', '#6a7aa0'];
      const midMtn = spec.time === 'sunset' ? ['#5a4a72', '#3d3256'] : spec.time === 'night' ? ['#0f1830', '#0a1124'] : spec.weather === 'rain' ? ['#5c636c', '#4b5159'] : ['#5f7590', '#475a73'];
      const snowCol = spec.time === 'sunset' ? '#f6d2c8' : spec.time === 'night' ? '#6f7fa6' : '#f4f7fb';
      if (subject === 'lake' || subject === 'night') {
        horizon = ART_H * (0.52 + (rng() - 0.5) * 0.04);
        artDrawSky(ctx, spec, -20, horizon + 2);
        if (spec.time === 'night') {
          // stars, the Milky Way and the moon
          const band = artValueNoise(ART_W, ART_H, 30, rng);
          for (let i = 0; i < 520; i++) {
            const x = rng() * ART_W, y = rng() * horizon;
            const inBand = band[(y | 0) * ART_W + (x | 0)] * (1 - Math.abs((y - (horizon * 0.9 - x * 0.45)) / 140));
            if (rng() > 0.45 + inBand) continue;
            const b = rng();
            ctx.fillStyle = `rgba(255,${240 + b * 15},${220 + b * 35},${0.4 + b * 0.6})`;
            ctx.fillRect(x, y, b > 0.93 ? 2.2 : 1.1, b > 0.93 ? 2.2 : 1.1);
          }
          const mw = ctx.createLinearGradient(0, horizon, ART_W, 0);
          mw.addColorStop(0.2, 'rgba(160,170,220,0)'); mw.addColorStop(0.5, 'rgba(170,180,230,0.16)'); mw.addColorStop(0.8, 'rgba(160,170,220,0)');
          ctx.fillStyle = mw;
          ctx.fillRect(0, 0, ART_W, horizon);
          const mx = ART_W * (0.68 + (rng() - 0.5) * 0.15), my = horizon * 0.3;
          const halo = ctx.createRadialGradient(mx, my, 8, mx, my, 70);
          halo.addColorStop(0, 'rgba(220,230,255,0.45)'); halo.addColorStop(1, 'rgba(200,210,255,0)');
          ctx.fillStyle = halo; ctx.fillRect(mx - 70, my - 70, 140, 140);
          ctx.fillStyle = '#f2efe0'; ctx.beginPath(); ctx.arc(mx, my, 15, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(180,180,170,0.35)'; ctx.beginPath(); ctx.arc(mx - 4, my - 3, 4, 0, Math.PI * 2); ctx.arc(mx + 5, my + 4, 3, 0, Math.PI * 2); ctx.fill();
          sun = { x: mx, y: my };
        } else if (spec.time === 'sunset' && spec.weather === 'clear') {
          sun = { x: ART_W * (0.55 + (rng() - 0.5) * 0.2), y: horizon - 112 };
          artClouds(ctx, rng, spec, horizon * 0.7, 4);
          artSunDisk(ctx, sun.x, sun.y, 13, true);
        } else {
          artClouds(ctx, rng, spec, horizon * 0.8, spec.weather === 'clear' ? 4 : 9);
        }
        artMountains(ctx, rng, spec, { yBase: horizon, height: 95, color: farMtn[0], shade: farMtn[1], snow: snowCol, snowFrac: Math.min(0.6, look.snowline), rough: 0.55 });
        artMountains(ctx, rng, spec, { yBase: horizon, height: 48, color: midMtn[0], shade: midMtn[1], snow: snowy ? snowCol : null, snowFrac: snowy ? 0.5 : 0, rough: 0.5 });
        // the far shore's hills, with a line of trees
        ctx.fillStyle = spec.time === 'night' ? '#0a1020' : artMixHex(midMtn[1], '#203018', 0.35);
        ctx.fillRect(0, horizon - 4, ART_W, 6);
        // the water mirrors the sky and mountains above it (a copy of what's painted so far, flipped)
        const above = artCanvas();
        above.getContext('2d').drawImage(ctx.canvas, 0, 0);
        artWater(ctx, rng, spec, horizon + 2, sun, () => {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.beginPath();
          ctx.rect(0, horizon + 1, ART_W, ART_H - horizon);
          ctx.clip();
          ctx.globalAlpha = spec.frozen ? 0.18 : 0.42;
          ctx.filter = 'blur(1.5px)';
          ctx.translate(0, horizon * 2 + 2);
          ctx.scale(1, -1);
          ctx.drawImage(above, 0, 0);
          ctx.restore();
        });
        // a near shore with firs at one side, and a rocky beach
        const side = rng() < 0.5 ? -1 : 1;
        const shoreY = ART_H * 0.86;
        ctx.fillStyle = spec.time === 'night' ? '#05080f' : snowy ? '#dfe7ef' : spec.time === 'sunset' ? '#2c2232' : '#6b5a3e';
        ctx.beginPath();
        if (side < 0) { ctx.moveTo(-10, ART_H * 0.62); ctx.quadraticCurveTo(ART_W * 0.25, shoreY - 20, ART_W * 0.45, ART_H + 5); ctx.lineTo(-10, ART_H + 5); }
        else { ctx.moveTo(ART_W + 10, ART_H * 0.62); ctx.quadraticCurveTo(ART_W * 0.75, shoreY - 20, ART_W * 0.55, ART_H + 5); ctx.lineTo(ART_W + 10, ART_H + 5); }
        ctx.closePath();
        ctx.fill();
        const firCol = spec.time === 'night' ? '#03060c' : spec.time === 'sunset' ? '#1c1626' : '#24402e';
        for (let i = 0; i < 4 + Math.round(q * 3); i++) {
          const fx = side < 0 ? 10 + i * 26 + rng() * 14 : ART_W - 10 - i * 26 - rng() * 14;
          artFir(ctx, fx, ART_H * 0.66 + i * 9 + rng() * 6, 120 - i * 10 + rng() * 20, firCol, snowy ? '#e8eef6' : null, rng, wob);
        }
        if (spec.birds) artBirds(ctx, rng, 3 + Math.floor(rng() * 4), ART_W * 0.35, horizon * 0.45, 120, spec.time === 'sunset' ? '#2a1e30' : '#1f2937');
      } else if (subject === 'mountains' || subject === 'wildlife') {
        horizon = ART_H * (subject === 'wildlife' ? 0.5 : 0.6);
        artDrawSky(ctx, spec, -20, horizon + 2);
        artClouds(ctx, rng, spec, horizon * 0.32, spec.weather === 'clear' ? 3 : 8);
        artMountains(ctx, rng, spec, { yBase: horizon, height: subject === 'wildlife' ? 110 : 190, color: farMtn[0], shade: farMtn[1], snow: snowCol, snowFrac: Math.max(0.35, Math.min(1, look.snowline + 0.25)), rough: 0.58 });
        artMountains(ctx, rng, spec, { yBase: horizon + 8, height: 70, color: artMixHex(midMtn[0], '#2f4a35', 0.45), shade: artMixHex(midMtn[1], '#1d3024', 0.5), snow: snowy ? snowCol : null, snowFrac: snowy ? 0.9 : 0, rough: 0.5 });
        // forested slopes
        for (let i = 0; i < 40; i++) artFir(ctx, rng() * ART_W, horizon + 6 + rng() * 10, 16 + rng() * 14, snowy ? '#2f4436' : '#2a4a33', snowy ? '#eef3f8' : null, rng, wob);
        artMeadow(ctx, rng, spec, horizon + 12, look);
        if (subject === 'mountains') {
          // a winding path into the valley
          ctx.strokeStyle = snowy ? '#cfdae6' : '#b9a27a';
          ctx.lineWidth = 14;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(ART_W * 0.62, ART_H + 6);
          ctx.quadraticCurveTo(ART_W * 0.4, ART_H * 0.82, ART_W * 0.5, horizon + 26);
          ctx.stroke();
        }
        const leafy = spec.season === 'Autumn' || spec.season === 'Spring';
        for (let i = 0; i < 3 + Math.round(q * 2); i++) {
          const left = i % 2 === 0, fx = left ? rng() * 90 : ART_W - rng() * 90;
          if (leafy && i % 3 === 1) artLeafyTree(ctx, fx, ART_H * 0.92, 130 + rng() * 40, look.leaf, rng);
          else artFir(ctx, fx, ART_H * (0.86 + rng() * 0.1), 150 + rng() * 60, '#22402c', snowy ? '#eef3f8' : null, rng, wob);
        }
        if (subject === 'wildlife') {
          if (spec.deer !== false) {
            const n = 1 + Math.floor(rng() * 3);
            for (let i = 0; i < n; i++) artDeer(ctx, ART_W * (0.3 + i * 0.22 + (rng() - 0.5) * 0.08), ART_H * (0.8 + i * 0.05), 120 - i * 12, rng() < 0.5 ? 1 : -1, i === 1 || rng() < 0.3, rng, wob);
          }
          if (spec.birds !== false) artBirds(ctx, rng, 5 + Math.floor(rng() * 4), ART_W * 0.6, horizon * 0.35, 150, '#1f2937');
        }
      } else if (subject === 'house') {
        horizon = ART_H * 0.56;
        artDrawSky(ctx, spec, -20, horizon + 2);
        if (spec.time === 'golden') { sun = { x: ART_W * 0.15, y: horizon * 0.45 }; artSunDisk(ctx, sun.x, sun.y, 10, true); }
        artClouds(ctx, rng, spec, horizon * 0.6, spec.weather === 'clear' ? 3 : 8);
        artMountains(ctx, rng, spec, { yBase: horizon, height: 120, color: farMtn[0], shade: farMtn[1], snow: snowCol, snowFrac: Math.max(0.3, look.snowline), rough: 0.55 });
        for (let i = 0; i < 26; i++) artFir(ctx, rng() * ART_W, horizon + 2 + rng() * 8, 40 + rng() * 30, snowy ? '#2c4434' : '#25432e', snowy ? '#eef3f8' : null, rng, wob);
        artMeadow(ctx, rng, spec, horizon + 4, look);
        // path to the door
        ctx.fillStyle = snowy ? '#d6e0ea' : '#b8a27c';
        ctx.beginPath();
        ctx.moveTo(ART_W * 0.43, ART_H * 0.8); ctx.lineTo(ART_W * 0.49, ART_H * 0.8); ctx.lineTo(ART_W * 0.62, ART_H + 4); ctx.lineTo(ART_W * 0.38, ART_H + 4);
        ctx.closePath(); ctx.fill();
        artHouse(ctx, ART_W * 0.46, ART_H * 0.8, 190, spec, rng, wob);
        artFir(ctx, ART_W * 0.83, ART_H * 0.84, 210, '#21402b', snowy ? '#eef3f8' : null, rng, wob);
        if (spec.season === 'Autumn' || spec.season === 'Spring' || spec.season === 'Summer') artLeafyTree(ctx, ART_W * 0.12, ART_H * 0.9, 170, look.leaf, rng);
        else artLeafyTree(ctx, ART_W * 0.12, ART_H * 0.9, 170, look.leaf, rng, true);
      } else if (subject === 'stilllife') {
        horizon = ART_H * 0.62;
        artStillLife(ctx, rng, spec);
      } else if (subject === 'friend') {
        horizon = ART_H;
        const bg = ctx.createRadialGradient(ART_W * 0.4, ART_H * 0.35, 20, ART_W * 0.5, ART_H * 0.5, ART_W * 0.7);
        bg.addColorStop(0, spec.friend && spec.friend.self ? '#e7d9c3' : '#9db6b8');
        bg.addColorStop(1, spec.friend && spec.friend.self ? '#6b5a48' : '#2f4650');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, ART_W, ART_H);
        artRobotPortrait(ctx, ART_W * (0.5 + (rng() - 0.5) * 0.06), ART_H * 0.42, 150, spec.friend && spec.friend.self ? 'self' : 'friend');
      }
      if (subject !== 'stilllife' && subject !== 'friend') artRainAndSnow(ctx, rng, spec);
      ctx.restore();
      return { ref, horizon, sun };
    }

// ====================================================================================================
// 2. Painting it in a medium
// ====================================================================================================
// A painting in progress: everything is drawn in stages, and `progress(canvas, fraction)` is awaited
// between them, so the easel in the world can show the canvas filling in.
async function renderPaintingInMedium(spec, { progress = null } = {}) {
      const scene = paintingSceneRef(spec);
      // A beginner can't see or place detail yet: everything comes out vaguer and a little lopsided
      const qq = artClamp01(spec.q == null ? 0.5 : spec.q);
      if (qq < 0.5) {
        const soft = artCanvas();
        const sx = soft.getContext('2d');
        sx.filter = `blur(${((0.5 - qq) * 9).toFixed(1)}px)`;
        sx.drawImage(scene.ref, 0, 0);
        scene.ref = soft;
      }
      const rng = makeRng(`paint:${spec.seed}:${spec.medium}`);
      const q = artClamp01(spec.q == null ? 0.5 : spec.q);
      const step = progress || (async () => {});
      const fn = { oil: artOilPainting, acrylic: artAcrylicPainting, watercolour: artWatercolourPainting, gouache: artGouachePainting, pastel: artPastelPainting, ink: artInkPainting, charcoal: artCharcoalPainting }[spec.medium] || artWatercolourPainting;
      const out = await fn(scene, spec, rng, q, step);
      artSignature(out, spec, q);
      await step(out, 1);
      return out;
    }

function artSignature(canvas, spec, q) {
      const ctx = canvas.getContext('2d');
      const ink = { oil: '#3b1f12', acrylic: '#1f1a17', watercolour: 'rgba(80,70,60,0.75)', gouache: '#2d2620', pastel: '#f3ead8', ink: null, charcoal: 'rgba(30,28,26,0.8)' }[spec.medium];
      if (!ink) return;
      ctx.save();
      ctx.font = `italic ${q > 0.5 ? 600 : 700} ${q > 0.5 ? 13 : 16}px Georgia, serif`;
      ctx.fillStyle = spec.medium === 'pastel' && spec.time !== 'night' ? '#3a2e26' : ink;
      ctx.textAlign = 'right';
      ctx.fillText(q > 0.35 ? 'Kelo-1' : 'K1', ART_W - 16, ART_H - 14);
      ctx.restore();
    }

// --- Stroke painting (oil and acrylic) ---------------------------------------------------------------
function artWeave(x, y) {
      const tx = (x / 3) | 0, ty = (y / 3) | 0;
      const over = (tx + ty) & 1;
      const fx = (x % 3) / 3, fy = (y % 3) / 3;
      const thread = over ? Math.sin(fx * Math.PI) : Math.sin(fy * Math.PI);
      return 0.55 + 0.45 * thread;
    }

// One loaded brush stroke: a body, then bristle streaks of lighter and darker paint that run out
// towards the tail (dry brush), and on the height map the ridges and the paint piled at the end.
function artBristleStroke(ctx, hx, pts, width, c0, c1, o, rng) {
      if (pts.length < 2) return;
      const n = pts.length;
      const nx = [], ny = [];
      for (let i = 0; i < n; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
        let dx = b[0] - a[0], dy = b[1] - a[1];
        const l = Math.hypot(dx, dy) || 1;
        nx.push(-dy / l); ny.push(dx / l);
      }
      const css = (c, k = 0) => artRgbCss([c[0] * (1 + k), c[1] * (1 + k), c[2] * (1 + k)].map(v => Math.max(0, Math.min(255, v))));
      // body
      const grad = ctx.createLinearGradient(pts[0][0], pts[0][1], pts[n - 1][0], pts[n - 1][1]);
      grad.addColorStop(0, css(c0));
      grad.addColorStop(1, css(c1));
      ctx.lineCap = o.butt ? 'butt' : 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = o.bodyAlpha;
      ctx.strokeStyle = grad;
      ctx.lineWidth = width * 0.82;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
      if (hx) {
        hx.lineCap = ctx.lineCap;
        hx.lineJoin = 'round';
        hx.globalAlpha = 0.75;
        hx.strokeStyle = `rgb(${o.thick},${o.thick},${o.thick})`;
        hx.lineWidth = width * 0.82;
        hx.beginPath();
        hx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < n; i++) hx.lineTo(pts[i][0], pts[i][1]);
        hx.stroke();
      }
      // bristles
      const count = Math.max(3, Math.min(o.maxBristles, Math.round(width / 1.7)));
      for (let b = 0; b < count; b++) {
        const off = (b / Math.max(1, count - 1) - 0.5) * width * 0.92;
        const reach = Math.max(2, Math.round(n * (o.dryTail ? 0.55 + rng() * 0.45 : 1)));
        const k = (rng() - 0.5) * o.streak;
        const mixT = rng();
        const col = [0, 1, 2].map(i => artMix(c0[i], c1[i], mixT * 0.5));
        ctx.globalAlpha = o.bristleAlpha * (0.6 + rng() * 0.4);
        ctx.strokeStyle = css(col, k);
        ctx.lineWidth = Math.max(0.7, width / count * (0.9 + rng() * 0.9));
        ctx.beginPath();
        for (let i = 0; i < reach; i++) {
          const x = pts[i][0] + nx[i] * off, y = pts[i][1] + ny[i] * off;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        if (hx && (b % 2 === 0)) {
          const v = Math.min(255, o.thick + o.ridge * (0.5 + rng()));
          hx.globalAlpha = 0.6;
          hx.strokeStyle = `rgb(${v},${v},${v})`;
          hx.lineWidth = Math.max(0.6, width / count * 0.7);
          hx.beginPath();
          for (let i = 0; i < reach; i++) {
            const x = pts[i][0] + nx[i] * off, y = pts[i][1] + ny[i] * off;
            if (i === 0) hx.moveTo(x, y); else hx.lineTo(x, y);
          }
          hx.stroke();
        }
      }
      // paint piled up where the brush lifted off
      if (hx && o.pile) {
        const e = pts[Math.max(0, n - 2)];
        const v = Math.min(255, o.thick + o.pile);
        hx.globalAlpha = 0.7;
        hx.fillStyle = `rgb(${v},${v},${v})`;
        hx.beginPath();
        hx.ellipse(e[0], e[1], width * 0.45, width * 0.3, Math.atan2(ny[n - 1], nx[n - 1]), 0, Math.PI * 2);
        hx.fill();
      }
      ctx.globalAlpha = 1;
      if (hx) hx.globalAlpha = 1;
    }

// Hertzmann-style painterly layers: big brushes first, then smaller ones only where the picture
// still differs from the scene. Strokes curve along the direction field.
async function artStrokeLayers(out, hc, src, dir, o, rng, step, from, to) {
      const W = ART_W, H = ART_H;
      const ctx = out.getContext('2d'), hx = hc ? hc.getContext('2d') : null;
      const radii = o.radii;
      for (let li = 0; li < radii.length; li++) {
        const r = radii[li];
        const R = artBlurChannels(src, Math.max(1, Math.round(r * o.blurK)));
        const cur = ctx.getImageData(0, 0, W, H).data;
        const grid = Math.max(2, Math.round(r * o.gridK));
        const strokes = [];
        for (let gy = 0; gy < H; gy += grid) {
          for (let gx = 0; gx < W; gx += grid) {
            let err = 0, best = -1, bx = gx, by = gy, cnt = 0;
            for (let y = gy; y < Math.min(H, gy + grid); y += 2) {
              for (let x = gx; x < Math.min(W, gx + grid); x += 2) {
                const i = y * W + x, j = i * 4;
                const d = Math.hypot(R.r[i] - cur[j] / 255, R.g[i] - cur[j + 1] / 255, R.b[i] - cur[j + 2] / 255);
                err += d; cnt++;
                if (d > best) { best = d; bx = x; by = y; }
              }
            }
            if (li === 0 || err / cnt > o.threshold) strokes.push([bx + (rng() - 0.5) * grid * 0.5, by + (rng() - 0.5) * grid * 0.5]);
          }
        }
        for (let i = strokes.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [strokes[i], strokes[j]] = [strokes[j], strokes[i]]; }
        const chunk = Math.max(200, Math.ceil(strokes.length / 4));
        for (let s = 0; s < strokes.length; s++) {
          const [sx, sy] = strokes[s];
          const xi = Math.max(0, Math.min(W - 1, sx | 0)), yi = Math.max(0, Math.min(H - 1, sy | 0));
          const i0 = yi * W + xi;
          let col = [R.r[i0], R.g[i0], R.b[i0]];
          if (o.colorize) col = o.colorize(col, rng);
          // follow the forms
          const pts = [[sx, sy]];
          let x = sx, y = sy, pdx = 0, pdy = 0;
          const maxSteps = Math.round(o.lenMin + rng() * (o.lenMax - o.lenMin));
          for (let k = 0; k < maxSteps; k++) {
            const ix = Math.max(0, Math.min(W - 1, x | 0)), iy = Math.max(0, Math.min(H - 1, y | 0));
            const ii = iy * W + ix;
            let a = dir.ang[ii] + (rng() - 0.5) * o.jitter;
            let dx = Math.cos(a), dy = Math.sin(a);
            if (k === 0 && rng() < 0.5) { dx = -dx; dy = -dy; }
            if (k > 0 && dx * pdx + dy * pdy < 0) { dx = -dx; dy = -dy; }
            if (k > 0) { dx = pdx * o.stiff + dx * (1 - o.stiff); dy = pdy * o.stiff + dy * (1 - o.stiff); const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; }
            x += dx * r * o.stepK; y += dy * r * o.stepK;
            if (x < -r || y < -r || x > W + r || y > H + r) break;
            pts.push([x, y]);
            pdx = dx; pdy = dy;
            if (k >= 1) {
              const jx = Math.max(0, Math.min(W - 1, x | 0)), jy = Math.max(0, Math.min(H - 1, y | 0)), jj = jy * W + jx;
              const dRef = Math.hypot(R.r[jj] - col[0], R.g[jj] - col[1], R.b[jj] - col[2]);
              if (dRef > o.stopDiff) break;
            }
          }
          if (pts.length < 2) pts.push([sx + Math.cos(dir.ang[i0]) * r, sy + Math.sin(dir.ang[i0]) * r]);
          // wet into wet: the brush picks up some of the paint already there
          const j0 = i0 * 4;
          const under = [cur[j0] / 255, cur[j0 + 1] / 255, cur[j0 + 2] / 255];
          const wet = li === 0 ? 0 : o.wetMix * rng();
          const c0 = col.map((v, ch) => artMix(v, under[ch], wet * 0.5) * 255);
          const end = pts[pts.length - 1];
          const ej = (Math.max(0, Math.min(H - 1, end[1] | 0)) * W + Math.max(0, Math.min(W - 1, end[0] | 0))) * 4;
          const c1 = col.map((v, ch) => artMix(v, cur[ej + ch] / 255, wet) * 255);
          const width = r * 2 * (0.8 + rng() * 0.4);
          artBristleStroke(ctx, hx, pts, width, c0, c1, { ...o, thick: o.thick + li * 10 }, rng);
          if ((s + 1) % chunk === 0) await step(out, from + (to - from) * ((li + (s + 1) / strokes.length) / radii.length));
        }
        await step(out, from + (to - from) * ((li + 1) / radii.length));
      }
    }

// The finished paint surface under a raking light: ridges catch light, troughs fall in shadow, a
// little gloss on oil, and the canvas weave where the paint is thin
function artLightSurface(out, hc, o) {
      const W = ART_W, H = ART_H;
      const ctx = out.getContext('2d');
      const img = ctx.getImageData(0, 0, W, H), d = img.data;
      const hd = hc.getContext('2d').getImageData(0, 0, W, H).data;
      const hgt = new Float32Array(W * H);
      for (let i = 0; i < hgt.length; i++) hgt[i] = hd[i * 4] / 255;
      const hb = artBlur(hgt, W, H, 1, 1);
      const lx = -0.55, ly = -0.65, lz = 0.52;
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const i = y * W + x, j = i * 4;
          const dx = (hb[i + 1] - hb[i - 1]) * o.relief, dy = (hb[i + W] - hb[i - W]) * o.relief;
          const nl = Math.hypot(dx, dy, 1);
          const diff = (-dx * lx - dy * ly + lz) / nl;
          let shade = 1 + (diff - lz) * o.light;
          const spec = o.gloss ? Math.pow(Math.max(0, diff), 30) * o.gloss : 0;
          const thin = 1 - artSmooth(0.15, 0.55, hb[i]);
          const weave = 1 - o.weave * (0.35 + thin) * (1 - artWeave(x, y));
          shade *= weave;
          d[j] = Math.min(255, d[j] * shade + spec * 255);
          d[j + 1] = Math.min(255, d[j + 1] * shade + spec * 250);
          d[j + 2] = Math.min(255, d[j + 2] * shade + spec * 235);
        }
      }
      ctx.putImageData(img, 0, 0);
    }

function artToneGround(out, color, weaveAmt, rng) {
      const ctx = out.getContext('2d');
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, ART_W, ART_H);
      const img = ctx.getImageData(0, 0, ART_W, ART_H), d = img.data;
      const n = artValueNoise(ART_W, ART_H, 40, rng);
      for (let y = 0; y < ART_H; y++) for (let x = 0; x < ART_W; x++) {
        const i = y * ART_W + x, j = i * 4, k = (1 - weaveAmt * (1 - artWeave(x, y))) * (0.9 + n[i] * 0.2);
        d[j] *= k; d[j + 1] *= k; d[j + 2] *= k;
      }
      ctx.putImageData(img, 0, 0);
    }

// Beginners overmix: colours drift towards mud and lose their punch
function artMuddy(col, q, rng, amount = 0.35) {
      const m = (1 - q) * amount * (0.5 + rng() * 0.5);
      const grey = (col[0] + col[1] + col[2]) / 3;
      const mud = [0.42, 0.36, 0.28];
      return col.map((v, i) => artClamp01(artMix(artMix(v, grey, m), mud[i], m * 0.5)));
    }

function artSaturate(col, k, lift = 0) {
      const grey = (col[0] + col[1] + col[2]) / 3;
      return col.map(v => artClamp01(grey + (v - grey) * k + lift));
    }

async function artOilPainting(scene, spec, rng, q, step) {
      const out = artCanvas(), hc = artCanvas();
      const hx = hc.getContext('2d');
      hx.fillStyle = 'rgb(20,20,20)';
      hx.fillRect(0, 0, ART_W, ART_H);
      // A canvas toned with a warm imprimatura of burnt sienna, as oil painters do
      artToneGround(out, '#a8673f', 0.35, rng);
      await step(out, 0.02);
      const src = artChannels(scene.ref);
      const dir = artDirectionField(artLum(src), ART_W, ART_H, rng, 5);
      const radii = q > 0.65 ? [13, 8, 4.5, 2.6] : q > 0.35 ? [14, 8, 4.5] : [16, 10];
      await artStrokeLayers(out, hc, src, dir, {
        radii, blurK: 0.6, gridK: 0.95, threshold: 0.09 - q * 0.04, lenMin: 2 + q * 2, lenMax: 5 + q * 6, stepK: 0.9, stiff: 0.55, jitter: 0.25 + (1 - q) * 0.6, stopDiff: 0.16,
        wetMix: 0.45, maxBristles: 12, streak: 0.4, bodyAlpha: 0.92, bristleAlpha: 0.9, dryTail: true, thick: 110, ridge: 70, pile: 90,
        colorize: (c, r) => artSaturate(artMuddy(c, q, r, 0.4), 1.12)
      }, rng, step, 0.05, 0.92);
      // Thick palette-knife highlights where the light is brightest (snow, the sun, its path on the water)
      if (q > 0.3) {
        const ctx = out.getContext('2d');
        const L = artLum(src);
        for (let n = 0; n < 160; n++) {
          const x = rng() * ART_W, y = rng() * ART_H, i = (y | 0) * ART_W + (x | 0);
          if (L[i] < 0.86) continue;
          const c = [src.r[i] * 255, src.g[i] * 255, src.b[i] * 255].map(v => Math.min(255, v * 1.04 + 6));
          const a = dir.ang[i];
          artBristleStroke(ctx, hx, [[x, y], [x + Math.cos(a) * 9, y + Math.sin(a) * 9]], 5 + rng() * 4, c, c, { maxBristles: 4, streak: 0.06, bodyAlpha: 1, bristleAlpha: 0.7, thick: 210, ridge: 40, pile: 45, butt: true }, rng);
        }
      }
      artLightSurface(out, hc, { relief: 2.4, light: 0.55, gloss: 0.16, weave: 0.16 });
      return out;
    }

async function artAcrylicPainting(scene, spec, rng, q, step) {
      const out = artCanvas(), hc = artCanvas();
      const hx = hc.getContext('2d');
      hx.fillStyle = 'rgb(10,10,10)';
      hx.fillRect(0, 0, ART_W, ART_H);
      artToneGround(out, '#f1ede4', 0.45, rng);
      await step(out, 0.02);
      // Flat bold colour: the scene simplified to a few saturated colours, painted in layers
      const raw = artChannels(scene.ref);
      const blurred = artBlurChannels(raw, 2);
      const pal = artPalette(blurred, Math.round(10 + q * 8), rng).map(c => artSaturate(c, 1.15));
      const flat = { r: new Float32Array(raw.r.length), g: new Float32Array(raw.r.length), b: new Float32Array(raw.r.length), w: ART_W, h: ART_H };
      for (let i = 0; i < flat.r.length; i++) {
        const k = artNearest(pal, blurred.r[i], blurred.g[i], blurred.b[i]);
        flat.r[i] = pal[k][0]; flat.g[i] = pal[k][1]; flat.b[i] = pal[k][2];
      }
      const dir = artDirectionField(artLum(raw), ART_W, ART_H, rng, 8);
      await artStrokeLayers(out, hc, flat, dir, {
        radii: q > 0.5 ? [16, 9, 4.5, 2.2] : [18, 10, 5], blurK: 0.15, gridK: 0.9, threshold: 0.06, lenMin: 2, lenMax: 4 + q * 4, stepK: 1.0, stiff: 0.8, jitter: 0.15 + (1 - q) * 0.4, stopDiff: 0.08,
        wetMix: 0, maxBristles: 6, streak: 0.08, bodyAlpha: 1, bristleAlpha: 0.5, dryTail: false, butt: true, thick: 70, ridge: 25, pile: 0,
        colorize: (c, r) => artMuddy(c, q, r, 0.25)
      }, rng, step, 0.05, 0.94);
      artLightSurface(out, hc, { relief: 3, light: 0.55, gloss: 0.05, weave: 0.3 });
      return out;
    }

// --- Paper media (watercolour, gouache, pastel, ink, charcoal) ------------------------------------------
function artPaper(rng, base, roughCell = 5) {
      const coarse = artFbm(ART_W, ART_H, roughCell * 3, 3, rng), fine = artValueNoise(ART_W, ART_H, 1.4, rng);
      const tooth = new Float32Array(ART_W * ART_H);
      for (let i = 0; i < tooth.length; i++) tooth[i] = 0.6 * coarse[i] + 0.4 * fine[i];
      return { tooth, base: artHexRgb(base).map(v => v / 255) };
    }

// A hand-torn masking-tape edge: the white margin left around a painting on paper
function artTapeMask(rng, inset = 10) {
      const m = new Float32Array(ART_W * ART_H);
      const n = artValueNoise(ART_W, ART_H, 6, rng);
      for (let y = 0; y < ART_H; y++) for (let x = 0; x < ART_W; x++) {
        const i = y * ART_W + x;
        const e = Math.min(x, y, ART_W - 1 - x, ART_H - 1 - y) - inset + (n[i] - 0.5) * 1.6;
        m[i] = artClamp01(e + 0.5);
      }
      return m;
    }

// Warped threshold: edges that wander like real wash edges
function artWarp(arr, rng, amp, cell) {
      const wx = artFbm(ART_W, ART_H, cell, 2, rng), wy = artFbm(ART_W, ART_H, cell, 2, rng);
      const out = new Float32Array(arr.length);
      for (let y = 0; y < ART_H; y++) for (let x = 0; x < ART_W; x++) {
        const i = y * ART_W + x;
        const sx = Math.max(0, Math.min(ART_W - 1, Math.round(x + (wx[i] - 0.5) * 2 * amp))), sy = Math.max(0, Math.min(ART_H - 1, Math.round(y + (wy[i] - 0.5) * 2 * amp)));
        out[i] = arr[sy * ART_W + sx];
      }
      return out;
    }

async function artWatercolourPainting(scene, spec, rng, q, step) {
      const W = ART_W, H = ART_H, N = W * H;
      const out = artCanvas();
      const paper = artPaper(rng, '#fbf8f1', 4);
      const tape = artTapeMask(rng, 9);
      const src = artBlurChannels(artChannels(scene.ref), 1);
      // Absorbance (how much light each pigment layer takes away): layers of transparent paint add up
      const Ar = new Float32Array(N), Ag = new Float32Array(N), Ab = new Float32Array(N), Av = new Float32Array(N);
      const pr = paper.base;
      for (let i = 0; i < N; i++) {
        Ar[i] = -Math.log(Math.max(0.03, Math.min(1, src.r[i] / pr[0])));
        Ag[i] = -Math.log(Math.max(0.03, Math.min(1, src.g[i] / pr[1])));
        Ab[i] = -Math.log(Math.max(0.03, Math.min(1, src.b[i] / pr[2])));
        Av[i] = (Ar[i] + Ag[i] + Ab[i]) / 3;
      }
      const accR = new Float32Array(N), accG = new Float32Array(N), accB = new Float32Array(N);
      const show = async (frac) => {
        const r = new Float32Array(N), g = new Float32Array(N), b = new Float32Array(N);
        for (let i = 0; i < N; i++) {
          const p = 0.95 + 0.05 * paper.tooth[i];
          r[i] = pr[0] * p * Math.exp(-accR[i] * tape[i]); g[i] = pr[1] * p * Math.exp(-accG[i] * tape[i]); b[i] = pr[2] * p * Math.exp(-accB[i] * tape[i]);
        }
        artPutChannels(out, r, g, b);
        await step(out, frac);
      };
      // a faint pencil drawing underneath, showing through the light washes
      const mag = artSobelMag(artLum(src), W, H);
      for (let i = 0; i < N; i++) {
        const p = artSmooth(0.35, 0.9, mag[i]) * (paper.tooth[i] > 0.45 ? 1 : 0.4) * 0.09;
        accR[i] += p; accG[i] += p; accB[i] += p * 0.95;
      }
      await show(0.05);
      const gran = artFbm(W, H, 3, 2, rng);
      // light wet-in-wet wash, a wet-on-dry mid layer, then the darks; a beginner's go muddy and bleed
      const layers = [
        { thr: 0.07, soft: q > 0.4 ? 6 : 3, colBlur: 9, weight: 0.42, edge: 0.15, warp: 7 },
        { thr: 0.38, soft: 1, colBlur: 4, weight: 0.26, edge: 0.75, warp: 4 },
        { thr: 0.85, soft: 1, colBlur: 2, weight: 0.2, edge: 0.5, warp: 2 }
      ];
      if (q > 0.6) layers.push({ thr: 1.4, soft: 0, colBlur: 1, weight: 0.18, edge: 0.3, warp: 1 });
      for (let li = 0; li < layers.length; li++) {
        const L = layers[li];
        const v = artWarp(Av, rng, L.warp + (1 - q) * 3, 22);
        let m = new Float32Array(N);
        for (let i = 0; i < N; i++) m[i] = v[i] > L.thr ? 1 : 0;
        if (L.soft) m = artBlur(m, W, H, L.soft);
        const mb = artBlur(m, W, H, 3);
        const cR = artBlur(Ar, W, H, L.colBlur), cG = artBlur(Ag, W, H, L.colBlur), cB = artBlur(Ab, W, H, L.colBlur);
        const shift = Math.round((1 - q) * 3 * li);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const i = y * W + x;
          const mi = m[i];
          if (mi <= 0.001) continue;
          const si = Math.min(H - 1, y + shift) * W + Math.min(W - 1, x + shift);
          // pigment piles up at the edge of a wash as it dries
          const edge = Math.max(0, mi - mb[i]) * 2.2 * L.edge;
          // and settles into the paper's dips (blue and earth pigments most)
          const blue = artClamp01((cR[si] - cB[si]) * 1.4 + 0.3);
          const g = 1 + (gran[i] - 0.5) * (0.2 + blue * 0.35) + (paper.tooth[i] - 0.5) * 0.3;
          const k = L.weight * mi * (1 + edge) * g;
          accR[i] += cR[si] * k; accG[i] += cG[si] * k; accB[i] += cB[si] * k;
        }
        await show(0.15 + 0.6 * (li + 1) / layers.length);
      }
      // blooms (cauliflowers): water run back into a drying wash pushes the pigment out to a hard rim
      const blooms = 1 + Math.round((1 - q) * 4 + rng() * 1.5);
      for (let n = 0; n < blooms; n++) {
        const cx = 30 + rng() * (W - 60), cy = 30 + rng() * (H - 60), rad = 12 + rng() * 22;
        const ci = (cy | 0) * W + (cx | 0);
        if (Av[ci] < 0.15) continue;
        for (let y = Math.max(0, cy - rad * 1.3 | 0); y < Math.min(H, cy + rad * 1.3); y++) for (let x = Math.max(0, cx - rad * 1.3 | 0); x < Math.min(W, cx + rad * 1.3); x++) {
          const i = y * W + x;
          const a = Math.atan2(y - cy, x - cx);
          const rr = rad * (0.85 + 0.12 * Math.sin(a * 3 + n * 1.7) + 0.08 * Math.sin(a * 7 + n) + 0.35 * (gran[i] - 0.5));
          const d = Math.hypot(x - cx, y - cy);
          if (d < rr) { const k = 0.6 + 0.4 * (d / rr); accR[i] *= k; accG[i] *= k; accB[i] *= k; }
          else if (d < rr + 2.2) { const k = 1.25; accR[i] *= k; accG[i] *= k; accB[i] *= k; }
        }
      }
      // beginners overwork it into mud
      if (q < 0.5) {
        const mud = (0.5 - q) * 0.75;
        for (let i = 0; i < N; i++) if (Av[i] > 0.1) { accR[i] += mud * 0.5; accG[i] += mud * 0.6; accB[i] += mud * 0.85; }
      }
      // sparkle: dry brush skipping over the paper's tooth (on water and in the grass)
      for (let i = 0; i < N; i++) if (paper.tooth[i] > 0.86 && Av[i] < 0.8 && Av[i] > 0.1) { const k = 0.45; accR[i] *= k; accG[i] *= k; accB[i] *= k; }
      await show(0.98);
      return out;
    }

async function artGouachePainting(scene, spec, rng, q, step) {
      const W = ART_W, H = ART_H, N = W * H;
      const out = artCanvas();
      const paper = artPaper(rng, '#f7f4ec', 3);
      const tape = artTapeMask(rng, 9);
      const src = artBlurChannels(artChannels(scene.ref), 2);
      // Opaque, matte and a touch chalky: gouache dries a little lighter than it goes on
      const pal = artPalette(src, Math.round(7 + q * 7), rng).map(c => artSaturate(c, 0.9, 0.04).map(v => artMix(v, 0.97, 0.06)));
      let idx = new Uint8Array(N);
      // a little low-frequency wobble so smooth gradients break into painted patches, not even rings
      const wob = artFbm(W, H, 26, 2, rng);
      for (let i = 0; i < N; i++) { const n = (wob[i] - 0.5) * 0.045; idx[i] = artNearest(pal, src.r[i] + n, src.g[i] + n, src.b[i] + n); }
      // simplify the shapes (a mode filter), as a painter blocks in flat areas
      const rad = q > 0.5 ? 2 : 3;
      const simp = new Uint8Array(N);
      const counts = new Uint16Array(pal.length);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        counts.fill(0);
        for (let dy = -rad; dy <= rad; dy += 1) for (let dx = -rad; dx <= rad; dx += 2) {
          const yy = Math.max(0, Math.min(H - 1, y + dy)), xx = Math.max(0, Math.min(W - 1, x + dx));
          counts[idx[yy * W + xx]]++;
        }
        let best = 0;
        for (let k = 1; k < pal.length; k++) if (counts[k] > counts[best]) best = k;
        simp[y * W + x] = best;
      }
      idx = simp;
      // Paint back to front: the lightest (furthest) shapes first, then darker ones over them
      const order = pal.map((c, k) => ({ k, l: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2] })).sort((a, b) => b.l - a.l);
      const r = new Float32Array(N), g = new Float32Array(N), b = new Float32Array(N);
      for (let i = 0; i < N; i++) { const p = 0.96 + 0.04 * paper.tooth[i]; r[i] = paper.base[0] * p; g[i] = paper.base[1] * p; b[i] = paper.base[2] * p; }
      const dir = artDirectionField(artLum(src), W, H, rng, 8);
      const streakN = artValueNoise(W, H, 2.5, rng);
      const warpX = artFbm(W, H, 10, 2, rng);
      for (let o = 0; o < order.length; o++) {
        const k = order[o].k, c = pal[k];
        let mask = new Float32Array(N);
        for (let i = 0; i < N; i++) mask[i] = idx[i] === k ? 1 : 0;
        // each shape is painted a little bigger than itself, so it overlaps the one behind
        mask = artBlur(mask, W, H, 1, 1);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const i = y * W + x;
          let m = mask[i];
          if (m <= 0.02) continue;
          // dry-brush at the soft edge of a shape: the paint catches the paper's tooth
          if (m < 0.9) m = artSmooth(0.25, 0.7, m + (paper.tooth[i] - 0.5) * 0.9 + (warpX[i] - 0.5) * 0.3);
          // flat but not dead: faint streaks along the brush direction
          const a = dir.ang[i];
          const u = Math.abs(Math.round(x * -Math.sin(a) + y * Math.cos(a))) % W;
          const streak = 1 + (streakN[(y % H) * W + u] - 0.5) * 0.06 + (paper.tooth[i] - 0.5) * 0.03;
          r[i] = artMix(r[i], c[0] * streak, m); g[i] = artMix(g[i], c[1] * streak, m); b[i] = artMix(b[i], c[2] * streak, m);
        }
        if (o % 3 === 2) { artPutChannels(out, r, g, b); await step(out, 0.1 + 0.75 * o / order.length); }
      }
      // matte chalky surface, slightly lighter where the paint was thin; the tape margin stays white
      for (let i = 0; i < N; i++) {
        const t = tape[i], p = 0.96 + 0.04 * paper.tooth[i];
        const chalk = 1 + (paper.tooth[i] - 0.5) * 0.05;
        r[i] = artMix(paper.base[0] * p, Math.min(1, r[i] * chalk), t);
        g[i] = artMix(paper.base[1] * p, Math.min(1, g[i] * chalk), t);
        b[i] = artMix(paper.base[2] * p, Math.min(1, b[i] * chalk), t);
      }
      artPutChannels(out, r, g, b);
      // a few crisp opaque details on top: light over dark, which only opaque paint can do
      const ctx = out.getContext('2d');
      const L = artLum(src);
      const full = artChannels(scene.ref);
      for (let n = 0; n < 220 * q + 40; n++) {
        const x = 12 + rng() * (W - 24), y = 12 + rng() * (H - 24), i = (y | 0) * W + (x | 0);
        const lf = 0.3 * full.r[i] + 0.59 * full.g[i] + 0.11 * full.b[i];
        if (Math.abs(lf - L[i]) < 0.12) continue;
        ctx.fillStyle = artRgbCss([full.r[i] * 255, full.g[i] * 255, full.b[i] * 255].map(v => Math.min(255, v * 1.02 + 4)));
        const a = dir.ang[i];
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.fillRect(-3, -1.2, 6 + rng() * 4, 2.4);
        ctx.restore();
      }
      return out;
    }

async function artPastelPainting(scene, spec, rng, q, step) {
      const W = ART_W, H = ART_H, N = W * H;
      const out = artCanvas();
      const src = artChannels(scene.ref);
      const L0 = artLum(src);
      let mean = 0;
      for (let i = 0; i < N; i += 7) mean += L0[i];
      mean /= N / 7;
      // A tinted pastel paper with a strong tooth: mid grey-blue, warm tan, or dark for night
      const paperHex = mean < 0.25 ? '#3d4452' : mean > 0.6 ? '#a39684' : '#8b929b';
      const paper = artPaper(rng, paperHex, 2);
      // the paper's honeycomb tooth
      const honey = artValueNoise(W, H, 2.2, rng);
      for (let i = 0; i < N; i++) paper.tooth[i] = 0.55 * paper.tooth[i] + 0.45 * honey[i];
      const dir = artDirectionField(L0, W, H, rng, 6);
      const r = new Float32Array(N), g = new Float32Array(N), b = new Float32Array(N);
      for (let i = 0; i < N; i++) { const p = 0.93 + 0.1 * paper.tooth[i]; r[i] = paper.base[0] * p; g[i] = paper.base[1] * p; b[i] = paper.base[2] * p; }
      artPutChannels(out, r, g, b);
      await step(out, 0.03);
      // Two passes of strokes drawn onto a clear layer, then pressed into the paper's tooth
      const pass = async (radius, len, count, alpha, pressure, blend, from, to) => {
        const layer = artCanvas();
        const lc = layer.getContext('2d');
        const B = artBlurChannels(src, Math.max(1, Math.round(radius * 0.5)));
        lc.lineCap = 'round';
        for (let n = 0; n < count; n++) {
          const x = rng() * W, y = rng() * H, i = (y | 0) * W + (x | 0);
          let col = artSaturate([B.r[i], B.g[i], B.b[i]], 1.15, 0.02);
          col = artMuddy(col, q, rng, 0.2).map(v => artClamp01(v + (rng() - 0.5) * 0.08));
          const a = dir.ang[i] + (rng() < 0.3 ? 0.7 : 0) + (rng() - 0.5) * 0.4;
          const l = len * (0.6 + rng() * 0.8);
          lc.strokeStyle = artRgbCss(col.map(v => v * 255), alpha);
          lc.lineWidth = radius * (0.6 + rng() * 0.6);
          lc.beginPath();
          lc.moveTo(x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2);
          lc.lineTo(x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2);
          lc.stroke();
        }
        const C = artChannels(layer);
        const A = new Float32Array(N);
        const ld = lc.getImageData(0, 0, W, H).data;
        for (let i = 0; i < N; i++) A[i] = ld[i * 4 + 3] / 255;
        let Cb = C, Ab = A;
        if (blend) {
          // blur premultiplied colour, so bare paper doesn't smear in as black
          const P = { r: C.r.map((v, i) => v * A[i]), g: C.g.map((v, i) => v * A[i]), b: C.b.map((v, i) => v * A[i]), w: W, h: H };
          const Pb = artBlurChannels(P, blend);
          Ab = artBlur(A, W, H, blend);
          Cb = { r: Pb.r.map((v, i) => v / Math.max(0.02, Ab[i])), g: Pb.g.map((v, i) => v / Math.max(0.02, Ab[i])), b: Pb.b.map((v, i) => v / Math.max(0.02, Ab[i])) };
        }
        const mag = dir.mag;
        for (let i = 0; i < N; i++) {
          // finger-blended in the soft areas (sky, water); left crisp at edges
          const soft = blend ? 1 - artSmooth(0.05, 0.25, mag[i]) : 0;
          const a = artMix(A[i], Ab[i], soft);
          if (a <= 0.01) continue;
          const cr = artMix(C.r[i], Cb.r[i], soft), cg = artMix(C.g[i], Cb.g[i], soft), cb = artMix(C.b[i], Cb.b[i], soft);
          // pigment only sits on the peaks of the paper unless pressed hard
          const cover = a * artSmooth(0.62 - pressure - soft * 0.3, 0.9 - pressure, paper.tooth[i] + a * 0.25);
          r[i] = artMix(r[i], cr, cover);
          g[i] = artMix(g[i], cg, cover);
          b[i] = artMix(b[i], cb, cover);
        }
        artPutChannels(out, r, g, b);
        await step(out, to);
      };
      await pass(14, 28, 2600, 0.55, 0.0, 3, 0.05, 0.45);
      await pass(8, 16, 4200, 0.75, 0.12, q > 0.4 ? 2 : 0, 0.45, 0.75);
      await pass(q > 0.5 ? 3.2 : 4.5, 10, Math.round(3000 + 4000 * q), 0.9, 0.22, 0, 0.75, 0.95);
      // pastel dust
      const ctx = out.getContext('2d');
      for (let n = 0; n < 400; n++) {
        const x = rng() * W, y = rng() * H, i = (y | 0) * W + (x | 0);
        ctx.fillStyle = artRgbCss([src.r[i] * 255, src.g[i] * 255, src.b[i] * 255], 0.5);
        ctx.fillRect(x, y, 1.2, 1.2);
      }
      return out;
    }

async function artInkPainting(scene, spec, rng, q, step) {
      const W = ART_W, H = ART_H, N = W * H;
      const out = artCanvas();
      const ctx = out.getContext('2d');
      // Xuan (rice) paper: warm white with fibres
      const paper = artPaper(rng, '#f4eedf', 3);
      const fib = artCanvas();
      const fc = fib.getContext('2d');
      fc.lineWidth = 0.6;
      for (let n = 0; n < 900; n++) {
        let x = rng() * W, y = rng() * H;
        fc.strokeStyle = rng() < 0.5 ? 'rgba(255,253,245,0.55)' : 'rgba(190,175,150,0.22)';
        fc.beginPath(); fc.moveTo(x, y);
        for (let k = 0; k < 3; k++) { x += (rng() - 0.5) * 14; y += (rng() - 0.5) * 14; fc.lineTo(x, y); }
        fc.stroke();
      }
      const src = artBlurChannels(artChannels(scene.ref), 1);
      const L = artLum(src);
      // ink density from darkness, with lots left empty (the sky, the light)
      let lo = 1, hi = 0;
      for (let i = 0; i < N; i += 5) { lo = Math.min(lo, L[i]); hi = Math.max(hi, L[i]); }
      const D = new Float32Array(N);
      for (let i = 0; i < N; i++) D[i] = artClamp01((hi - L[i]) / Math.max(0.1, hi - lo));
      const ink = new Float32Array(N);
      const paint = async (frac) => {
        const r = new Float32Array(N), g = new Float32Array(N), b = new Float32Array(N);
        const fd = fc.getImageData(0, 0, W, H).data;
        for (let i = 0; i < N; i++) {
          const p = 0.96 + 0.04 * paper.tooth[i];
          const fa = fd[i * 4 + 3] / 255;
          const base = [0, 1, 2].map(ch => artMix(paper.base[ch] * p, fd[i * 4 + ch] / 255, fa));
          const t = Math.exp(-ink[i] * 3.2);
          r[i] = base[0] * t + 0.02 * (1 - t); g[i] = base[1] * t + 0.02 * (1 - t); b[i] = base[2] * t + 0.03 * (1 - t);
        }
        artPutChannels(out, r, g, b);
        await step(out, frac);
      };
      // three washes of diluted ink, bleeding softly into the paper's fibres
      const fibreN = artValueNoise(W, H, 1.8, rng);
      const washes = [{ thr: 0.28, dens: 0.09, bleed: 3 }, { thr: 0.5, dens: 0.16, bleed: 2 }, { thr: 0.74, dens: 0.3, bleed: 1 }];
      for (let wi = 0; wi < washes.length; wi++) {
        const w = washes[wi];
        const v = artWarp(D, rng, 3 + (1 - q) * 4, 16);
        let m = new Float32Array(N);
        // mist: the lower slopes of far hills fade out, as in a sumi-e landscape
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const i = y * W + x;
          const mist = spec.subject === 'stilllife' || spec.subject === 'friend' ? 0 : Math.max(0, 1 - Math.abs(y - scene.horizon) / 30) * 0.25;
          m[i] = v[i] - mist > w.thr ? 1 : 0;
        }
        const mb = artBlur(m, W, H, w.bleed);
        for (let i = 0; i < N; i++) {
          const spread = artSmooth(0.15, 0.55, mb[i] + (fibreN[i] - 0.5) * 0.35);
          // ink gathers a little at the drying edge of a wash
          const rim = Math.max(0, m[i] - mb[i]) * 0.6;
          ink[i] += spread * w.dens * (0.85 + 0.3 * paper.tooth[i] + rim);
        }
        await paint(0.12 + 0.22 * (wi + 1));
      }
      // calligraphic brush lines along the strongest edges, thick to thin, some with "flying white"
      const mag = artSobelMag(artBlur(L, W, H, 1), W, H);
      const dir = artDirectionField(L, W, H, rng, 3);
      let maxM = 0;
      for (let i = 0; i < N; i++) if (mag[i] > maxM) maxM = mag[i];
      const used = new Uint8Array(N);
      ctx.lineCap = 'round';
      const lineCanvas = artCanvas();
      const lx = lineCanvas.getContext('2d');
      lx.lineCap = 'round';
      const lines = [];
      for (let n = 0; n < 2600; n++) {
        const x0 = 4 + rng() * (W - 8), y0 = 4 + rng() * (H - 8), i0 = (y0 | 0) * W + (x0 | 0);
        if (used[i0] || mag[i0] < maxM * (0.34 - q * 0.06)) continue;
        const pts = [[x0, y0]];
        let x = x0, y = y0, pdx = 0, pdy = 0;
        for (let k = 0; k < 60; k++) {
          const ii = (Math.max(0, Math.min(H - 1, y | 0))) * W + Math.max(0, Math.min(W - 1, x | 0));
          let dx = Math.cos(dir.ang[ii]), dy = Math.sin(dir.ang[ii]);
          if (k && dx * pdx + dy * pdy < 0) { dx = -dx; dy = -dy; }
          x += dx * 2.5; y += dy * 2.5;
          const jj = (Math.max(0, Math.min(H - 1, y | 0))) * W + Math.max(0, Math.min(W - 1, x | 0));
          if (mag[jj] < maxM * 0.14 || used[jj]) break;
          pts.push([x, y]);
          pdx = dx; pdy = dy;
        }
        if (pts.length < 9) continue;
        pts.forEach(([px, py]) => {
          for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
            const yy = (py | 0) + dy, xx = (px | 0) + dx;
            if (yy >= 0 && yy < H && xx >= 0 && xx < W) used[yy * W + xx] = 1;
          }
        });
        lines.push(pts);
      }
      lines.forEach(pts => {
        const wMax = (1.6 + rng() * 2.2) * (q > 0.4 ? 1 : 1.4);
        const dry = rng() < 0.3;
        const tremble = (1 - q) * 1.4;
        for (let i = 1; i < pts.length; i++) {
          const t = i / pts.length;
          const wdt = wMax * (0.35 + Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.6));
          if (dry && t > 0.5) {
            lx.globalAlpha = 0.75;
            lx.lineWidth = wdt * 0.3;
            for (let s = -1; s <= 1; s++) {
              if (rng() < 0.35) continue;
              lx.beginPath();
              lx.moveTo(pts[i - 1][0] + s * wdt * 0.35, pts[i - 1][1] + s * wdt * 0.2);
              lx.lineTo(pts[i][0] + s * wdt * 0.35, pts[i][1] + s * wdt * 0.2);
              lx.strokeStyle = '#141212';
              lx.stroke();
            }
            continue;
          }
          lx.globalAlpha = 0.88;
          lx.strokeStyle = '#141212';
          lx.lineWidth = wdt;
          lx.beginPath();
          lx.moveTo(pts[i - 1][0] + (rng() - 0.5) * tremble, pts[i - 1][1] + (rng() - 0.5) * tremble);
          lx.lineTo(pts[i][0], pts[i][1]);
          lx.stroke();
        }
      });
      // the line ink feathers a little into the paper too
      const ld = lx.getImageData(0, 0, W, H).data;
      const la = new Float32Array(N);
      for (let i = 0; i < N; i++) la[i] = ld[i * 4 + 3] / 255;
      const lb = artBlur(la, W, H, 1, 1);
      for (let i = 0; i < N; i++) ink[i] += Math.max(la[i], lb[i] * 0.8) * 0.9;
      await paint(0.92);
      // the red seal: a chop with his initials carved out
      const sx = W - 46, sy = H - 58, s = 26;
      ctx.save();
      ctx.fillStyle = '#b3342b';
      ctx.globalAlpha = 0.9;
      ctx.fillRect(sx, sy, s, s * 1.3);
      ctx.globalCompositeOperation = 'destination-out';
      for (let n = 0; n < 60; n++) ctx.fillRect(sx + rng() * s, sy + rng() * s * 1.3, 1.5, 1.5);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#f4eedf';
      ctx.font = 'bold 13px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('K', sx + s / 2, sy + 15);
      ctx.fillText('1', sx + s / 2, sy + 29);
      ctx.restore();
      return out;
    }

async function artCharcoalPainting(scene, spec, rng, q, step) {
      const W = ART_W, H = ART_H, N = W * H;
      const out = artCanvas();
      const graphite = spec.graphite;
      const paper = artPaper(rng, '#f2eee5', 2.5);
      const src = artChannels(scene.ref);
      let L = artBlur(artLum(src), W, H, 1);
      // A value study: push the contrast, as he squints at the scene
      let lo = 1, hi = 0;
      for (let i = 0; i < N; i += 5) { lo = Math.min(lo, L[i]); hi = Math.max(hi, L[i]); }
      const T = new Float32Array(N);
      for (let i = 0; i < N; i++) T[i] = Math.pow(artClamp01((hi - L[i]) / Math.max(0.1, hi - lo)), 1.45);
      const maxDark = graphite ? 0.72 : 0.94;
      const D = new Float32Array(N);
      const draw = async (frac) => {
        const r = new Float32Array(N), g = new Float32Array(N), b = new Float32Array(N);
        for (let i = 0; i < N; i++) {
          const p = 0.95 + 0.05 * paper.tooth[i];
          const k = 1 - D[i] * maxDark;
          const tint = graphite ? [0.94, 0.96, 1.0] : [1, 0.98, 0.95];
          r[i] = paper.base[0] * p * k * (D[i] > 0.01 ? tint[0] : 1); g[i] = paper.base[1] * p * k * (D[i] > 0.01 ? tint[1] : 1); b[i] = paper.base[2] * p * k * (D[i] > 0.01 ? tint[2] : 1);
        }
        artPutChannels(out, r, g, b);
        await step(out, frac);
      };
      // 1. the broad tone, rubbed in with the side of the stick: it catches the paper's tooth
      const base = artBlur(T, W, H, 7);
      for (let i = 0; i < N; i++) D[i] = base[i] * 0.5 * artSmooth(0.2, 0.75, paper.tooth[i] + base[i] * 0.5);
      await draw(0.15);
      // 2. hatching along the forms, cross-hatched in the darks
      const dir = artDirectionField(L, W, H, rng, 6);
      const hatch = artCanvas();
      const hc = hatch.getContext('2d');
      hc.lineCap = 'round';
      hc.strokeStyle = '#000';
      const count = Math.round(6000 + q * 5000);
      for (let n = 0; n < count; n++) {
        const x = rng() * W, y = rng() * H, i = (y | 0) * W + (x | 0);
        const t = T[i];
        if (rng() > t * 1.1 + 0.05) continue;
        const a = dir.ang[i] + (t > 0.55 && rng() < 0.5 ? 0.75 : 0) + (rng() - 0.5) * (0.25 + (1 - q) * 0.5);
        const l = (graphite ? 8 : 12) + rng() * 16;
        hc.globalAlpha = 0.08 + t * 0.22;
        hc.lineWidth = graphite ? 0.9 : 1.4 + rng() * 1.2;
        hc.beginPath();
        hc.moveTo(x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2);
        hc.lineTo(x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2);
        hc.stroke();
      }
      const hd = hc.getImageData(0, 0, W, H).data;
      for (let i = 0; i < N; i++) {
        const a = hd[i * 4 + 3] / 255 * artSmooth(0.15, 0.65, paper.tooth[i] + 0.25);
        D[i] = 1 - (1 - D[i]) * (1 - a);
      }
      await draw(0.5);
      // 3. smudged with a finger and blending stump in the soft passages (sky, water, distance)
      const Db = artBlur(D, W, H, 4);
      for (let i = 0; i < N; i++) {
        const soft = (1 - artSmooth(0.04, 0.2, dir.mag[i])) * (0.6 + q * 0.3);
        D[i] = artMix(D[i], Math.max(Db[i], D[i] * 0.85), soft);
      }
      await draw(0.7);
      // 4. the darkest accents in compressed charcoal, and highlights lifted with a kneaded eraser
      for (let i = 0; i < N; i++) {
        if (T[i] > 0.86) D[i] = Math.max(D[i], 0.78 + 0.2 * artSmooth(0.3, 0.7, paper.tooth[i]));
        if (L[i] > hi - (hi - lo) * 0.1) D[i] *= 0.15 + (1 - q) * 0.3;
      }
      const ctx = out.getContext('2d');
      await draw(0.85);
      // eraser strokes through the lightest bits
      ctx.globalCompositeOperation = 'lighter';
      for (let n = 0; n < 30 + 40 * q; n++) {
        const x = rng() * W, y = rng() * H, i = (y | 0) * W + (x | 0);
        if (T[i] > 0.15) continue;
        ctx.strokeStyle = 'rgba(40,40,38,0.35)';
        ctx.lineWidth = 3 + rng() * 3;
        ctx.lineCap = 'round';
        const a = dir.ang[i];
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      // smudgy fingerprints at the edges of a beginner's sheet
      if (q < 0.45) {
        for (let n = 0; n < 3; n++) {
          const x = rng() < 0.5 ? 20 + rng() * 40 : W - 60 + rng() * 40, y = 20 + rng() * (H - 40);
          const gr = ctx.createRadialGradient(x, y, 2, x, y, 18);
          gr.addColorStop(0, 'rgba(30,28,26,0.18)'); gr.addColorStop(1, 'rgba(30,28,26,0)');
          ctx.fillStyle = gr; ctx.fillRect(x - 18, y - 18, 36, 36);
        }
      }
      return out;
    }
