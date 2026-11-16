// Kelo-bot-1 — js/surfacedetail.js
// Loaded after ambience.js. Surface detail on buildings and props: every procedural finish texture in
// materials.js (lap siding, brick, stucco, roof shingles, standing-seam metal, panels, wood grain,
// bark, stone) is also turned into a tangent-space normal map (Sobel of the texture's own brightness),
// so mortar joints, board laps, shingle rows, seams and grain catch the light from every side instead
// of the flatter bump look. All textures are drawn by the game itself (no outside images).
// Medium and High (graphics().normalDetail) when a material is finished; Low keeps the bump maps.
const SURF_NORMAL_KINDS = { siding: 1.0, brick: 1.1, plaster: 0.45, shingles: 1.1, metalroof: 0.8, cladding: 0.6, wood: 0.55, paintedwood: 0.45, bark: 1.0, stone: 0.7, riverstone: 0.4, rings: 0.4 };
const surfNormalByImage = new WeakMap();
const surfNormalByTexture = new Map();

// A normal map canvas from a texture's image (brightness = height)
function surfNormalCanvas(img, strength) {
      const w = img.width, h = img.height;
      const src = document.createElement('canvas');
      src.width = w; src.height = h;
      const sctx = src.getContext('2d');
      sctx.drawImage(img, 0, 0);
      const d = sctx.getImageData(0, 0, w, h).data;
      const H = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) H[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
      const out = sctx.createImageData(w, h), o = out.data;
      const at = (x, y) => H[((y + h) % h) * w + ((x + w) % w)]; // wraps: the texture tiles
      const k = strength * 4.0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
        const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
        let nx = -dx * k, ny = dy * k, nz = 1;
        const l = Math.hypot(nx, ny, nz);
        const i = (y * w + x) * 4;
        o[i] = Math.round((nx / l * 0.5 + 0.5) * 255);
        o[i + 1] = Math.round((ny / l * 0.5 + 0.5) * 255);
        o[i + 2] = Math.round((nz / l * 0.5 + 0.5) * 255);
        o[i + 3] = 255;
      }
      sctx.putImageData(out, 0, 0);
      return src;
    }

function surfNormalFor(tex) {
      if (!tex || !tex.image || !tex.image.width) return null;
      if (surfNormalByTexture.has(tex)) return surfNormalByTexture.get(tex);
      let canvas = surfNormalByImage.get(tex.image);
      if (!canvas) { canvas = surfNormalCanvas(tex.image, 1); surfNormalByImage.set(tex.image, canvas); }
      const n = new THREE.CanvasTexture(canvas);
      n.wrapS = tex.wrapS; n.wrapT = tex.wrapT;
      n.repeat.copy(tex.repeat); n.offset.copy(tex.offset);
      n.anisotropy = Math.min(4, (typeof renderer !== 'undefined' && renderer) ? renderer.capabilities.getMaxAnisotropy() : 1);
      surfNormalByTexture.set(tex, n);
      return n;
    }

// Turn a finished material's bump into a normal map
function surfDetailMaterial(mat, key) {
      const s = SURF_NORMAL_KINDS[key];
      if (!s || !mat || !mat.bumpMap || mat.userData.surfNormal) return mat;
      if (typeof graphics === 'function' && !graphics().normalDetail) return mat;
      const n = surfNormalFor(mat.bumpMap);
      if (!n) return mat;
      mat.normalMap = n;
      mat.normalScale.set(s, s);
      mat.bumpMap = null;
      mat.userData.surfNormal = true;
      mat.needsUpdate = true;
      return mat;
    }

// materials.js loads after this file: wrap finishMaterial once every script is in
window.addEventListener('DOMContentLoaded', () => {
  if (typeof finishMaterial !== 'function') return;
  const orig = finishMaterial;
  finishMaterial = function (mat, key, opts) {
    const m = orig.apply(this, arguments);
    try { surfDetailMaterial(m, (opts && opts.texture && SURF_NORMAL_KINDS[opts.texture] ? opts.texture : key)); } catch (e) {}
    return m;
  };
});
