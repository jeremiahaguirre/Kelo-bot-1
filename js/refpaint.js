// Kelo-bot-1 — js/refpaint.js
// Loaded after paintstudio.js. Kelo-1 paints from live reference photos he finds at the NetNode cafe,
// not only from the scenes he knows by heart.
//   - He goes to the cafe, sits at a computer and searches DuckDuckGo for pictures of what he wants to
//     paint. Where it is allowed he uses DuckDuckGo's image results: in the Windows app the main
//     process asks for them (desktop/imagesearch.js), in the phone apps Capacitor's native HTTP does.
//     On the website DuckDuckGo's image results can't be read (no CORS), so he uses what DuckDuckGo
//     does allow there, the Instant Answer API's picture fields. If DuckDuckGo has no usable picture he
//     looks on Wikimedia Commons (freely licensed photos), and says which it was. Offline, he paints
//     the scenes he knows (js/paintstudio.js) as before.
//   - Safe search is strict and every query is his own few plain words, filtered for all ages; nothing
//     about the player is ever sent.
//   - Two ways to use what he found: paint from one photo, or combine two different photos into one
//     original picture (the subject from one, the setting, palette and light from the other; or a planned
//     split composition with blended edges). The AI brain chooses when a key is connected (the "paint"
//     decision's "reference" field); without a key he makes a simple choice himself.
//   - The photo is only an underpainting source: js/paintrender.js gets a simplified value and colour
//     map of it (big shapes, a limited palette, his own crop) and paints it again with each medium's
//     own brushwork, so the result is a painting of the subject, not a filtered copy of the photo.
//   - Each painting keeps the query, the source, the page and picture addresses (the credit) and a tiny
//     copy of the reference, so his Museum and website show "after a reference photo" credits offline.
// Fetched pictures are data only: no fetched HTML is ever put into the page, and every title and
// address shown is escaped and checked to be https.

const REFP_MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const REFP_KEEP_THUMBS = 40;          // newest paintings that keep their small reference copies
const REFP_THUMB_W = 128, REFP_THUMB_H = 96;
const REFP_CHANCE = 0.7;              // how often, online, his own painting starts from a reference photo
const REFP_TIMEOUT_MS = 15000;
const REFP_DDG_HOST = 'duckduckgo.com';
const REFP_COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
// Hosts the web page itself may fetch pictures from (the same list as the CSP's connect-src)
const REFP_WEB_IMAGE_HOSTS = ['duckduckgo.com', 'upload.wikimedia.org'];
// The ages-all filter on the words he searches for (and on the titles of what comes back)
const REFP_UNSAFE = /\b(nude|nudity|naked|nsfw|porn\w*|sex\w*|erotic\w*|xxx|hentai|fetish\w*|lingerie|bikini|topless|gore|gory|blood\w*|corpse|dead body|kill\w*|murder\w*|suicide|self.?harm|weapon\w*|guns?|rifles?|pistols?|bombs?|drugs?|cocaine|heroin|meth|nazi\w*|swastika|terror\w*|beheading|torture)\b/i;

// Things that make good pictures: subjects to paint, and settings / light to put them in
const REFP_SUBJECTS = ['lighthouse', 'red fox', 'sailboat', 'hot air balloon', 'old stone bridge', 'heron', 'sunflowers', 'covered bridge',
  'steam locomotive', 'windmill', 'barn owl', 'orchard in bloom', 'harbour boats', 'mountain goat', 'tulip field', 'old pickup truck',
  'canoe on a lake', 'bison', 'koi pond', 'cathedral', 'teapot', 'lemons in a bowl', 'vintage bicycle', 'humpback whale', 'grizzly bear',
  'loon', 'vineyard', 'farmhouse', 'pelican', 'cherry blossom', 'old tractor', 'treehouse', 'hummingbird'];
const REFP_SETTINGS = ['northern lights', 'desert dunes', 'misty forest', 'autumn forest', 'snowy village', 'tropical beach', 'rainy city street at night',
  'lavender field', 'canyon at sunset', 'foggy harbour', 'starry night sky', 'golden wheat field', 'spring meadow', 'ocean waves',
  'bamboo forest', 'glacier lake', 'stormy sky', 'sunrise over hills'];

// --- Safe words and safe addresses -----------------------------------------------------------------------
// His search words: a few plain words, no names, addresses, numbers or anything not fit for all ages
function refpCleanQuery(text, avoid = []) {
      let t = String(text || '').normalize('NFKC');
      t = t.replace(/<[^>]*>/g, ' ').replace(/https?:\/\/\S+|www\.\S+/gi, ' ').replace(/\S+@\S+/g, ' ').replace(/\d{4,}/g, ' ');
      const names = [...avoid, typeof companionName === 'function' ? companionName() : '', state && state.ownerName, state && state.visitorName]
        .map(n => String(n || '').trim()).filter(n => n.length > 1);
      names.forEach(n => { t = t.split(new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')).join(' '); });
      t = t.replace(/[^\p{L}\p{N} '\-]+/gu, ' ').replace(/\b(me|my|mine|i|you|your|yours|us|our|we|please|pls|thanks?)\b/gi, ' ');
      t = t.replace(/\s+/g, ' ').trim().toLowerCase().split(' ').slice(0, 6).join(' ').slice(0, 60).trim();
      if (t.length < 2 || REFP_UNSAFE.test(t)) return null;
      return t;
    }

// An https address (optionally only on the given hosts), or null. Same rule as the links he shows elsewhere.
function refpSafeUrl(url, hosts = null, base = undefined) {
      try {
        const u = new URL(String(url || ''), base);
        if (u.protocol !== 'https:' || u.username || u.password) return null;
        if (hosts && !hosts.includes(u.hostname)) return null;
        return u.href;
      } catch (e) {
        return null;
      }
    }

function refpHostOf(url) {
      try { return new URL(url).hostname; } catch (e) { return ''; }
    }

function refpOnline() {
      return typeof navigator === 'undefined' || navigator.onLine !== false;
    }

function refpPlatform() {
      if (window.keloDesktop && typeof window.keloDesktop.imageSearch === 'function') return 'desktop';
      const Cap = window.Capacitor;
      if (Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform() && Cap.Plugins && Cap.Plugins.CapacitorHttp) return 'native';
      return 'web';
    }

function refpPlain(text, max = 140) {
      // Titles can carry a little HTML (Commons artist fields): keep just the words, never the markup
      let s = String(text || '');
      if (/[<&]/.test(s) && typeof DOMParser !== 'undefined') s = new DOMParser().parseFromString(s, 'text/html').body.textContent || '';
      return s.replace(/\s+/g, ' ').trim().slice(0, max);
    }

async function refpFetch(url, opts = {}) {
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctl ? setTimeout(() => ctl.abort(), REFP_TIMEOUT_MS) : null;
      try {
        return await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', ...opts, signal: ctl ? ctl.signal : undefined });
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

// --- Where pictures come from ------------------------------------------------------------------------------
// A candidate: { thumbUrl, imageUrl, pageUrl, title, source, via: 'desktop'|'native'|'web', license, artist }

// DuckDuckGo image results through the Windows app's main process
async function refpSearchDesktop(q) {
      const r = await window.keloDesktop.imageSearch(q);
      if (!r || !r.ok || !Array.isArray(r.results)) return [];
      return r.results.map(x => ({
        thumbUrl: refpSafeUrl(x.thumbnail), imageUrl: refpSafeUrl(x.image), pageUrl: refpSafeUrl(x.pageUrl),
        title: refpPlain(x.title), source: 'DuckDuckGo Images', via: 'desktop'
      })).filter(c => (c.thumbUrl || c.imageUrl) && c.pageUrl);
    }

// DuckDuckGo image results through Capacitor's built-in native HTTP (phone apps: no CORS there)
const refpNativeAllowed = new Set();
async function refpSearchNative(q) {
      const H = window.Capacitor.Plugins.CapacitorHttp;
      const headers = { 'Accept-Language': 'en-US,en;q=0.8' };
      const page = await H.get({ url: `https://${REFP_DDG_HOST}/?q=${encodeURIComponent(q)}&iax=images&ia=images&kp=1`, headers, responseType: 'text', connectTimeout: REFP_TIMEOUT_MS, readTimeout: REFP_TIMEOUT_MS });
      const html = String(page && page.data || '');
      const m = html.match(/vqd\s*=\s*["']?([\d-]{6,})["']?/) || html.match(/"vqd"\s*:\s*"([\d-]{6,})"/);
      if (!m) return [];
      const res = await H.get({ url: `https://${REFP_DDG_HOST}/i.js?l=us-en&o=json&q=${encodeURIComponent(q)}&vqd=${encodeURIComponent(m[1])}&f=,,,,,&p=1&kp=1`, headers: { ...headers, Referer: `https://${REFP_DDG_HOST}/`, Accept: 'application/json' }, responseType: 'json', connectTimeout: REFP_TIMEOUT_MS, readTimeout: REFP_TIMEOUT_MS });
      let d = res && res.data;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
      const list = (d && Array.isArray(d.results) ? d.results : []).slice(0, 12).map(x => ({
        thumbUrl: refpSafeUrl(x.thumbnail), imageUrl: refpSafeUrl(x.image), pageUrl: refpSafeUrl(x.url),
        title: refpPlain(x.title), source: 'DuckDuckGo Images', via: 'native'
      })).filter(c => (c.thumbUrl || c.imageUrl) && c.pageUrl && !REFP_UNSAFE.test(c.title));
      list.forEach(c => { if (c.thumbUrl) refpNativeAllowed.add(c.thumbUrl); if (c.imageUrl) refpNativeAllowed.add(c.imageUrl); });
      return list;
    }

// What DuckDuckGo allows a web page: the Instant Answer API (CORS-enabled) and its picture fields
function refpParseInstantAnswer(d, q) {
      if (!d || typeof d !== 'object') return [];
      const out = [];
      const add = (img, page, title) => {
        const u = refpSafeUrl(img, [REFP_DDG_HOST], `https://${REFP_DDG_HOST}`);
        if (!u || out.some(c => c.imageUrl === u)) return;
        out.push({ thumbUrl: null, imageUrl: u, pageUrl: refpSafeUrl(page) || `https://${REFP_DDG_HOST}/?q=${encodeURIComponent(q)}&kp=1`, title: refpPlain(title || q), source: 'DuckDuckGo', via: 'web' });
      };
      if (d.Image) add(d.Image, d.AbstractURL, d.Heading);
      const topics = [];
      (Array.isArray(d.RelatedTopics) ? d.RelatedTopics : []).forEach(t => { if (t && Array.isArray(t.Topics)) topics.push(...t.Topics); else if (t) topics.push(t); });
      topics.slice(0, 20).forEach(t => { if (t.Icon && t.Icon.URL) add(t.Icon.URL, t.FirstURL, String(t.Text || '').split(' - ')[0]); });
      return out.filter(c => !REFP_UNSAFE.test(c.title));
    }

async function refpSearchInstant(q) {
      const res = await refpFetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1&kp=1`);
      if (!res.ok) return [];
      return refpParseInstantAnswer(await res.json(), q);
    }

// Every other source (Wikimedia Commons, Openverse, the museums, NASA, the keyed photo sites) is an
// adapter in js/refsources.js, behind the licence gate refLicenceOk() and the risk check refRiskOk().

// --- Loading a picture as data ------------------------------------------------------------------------------
async function refpDecode(src) {
      // src: a Blob or a data: URL. Decoded into pixels only; nothing fetched is ever put into the page.
      if (src instanceof Blob) {
        if (typeof createImageBitmap === 'function') return createImageBitmap(src);
        src = URL.createObjectURL(src);
      }
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('could not decode the picture'));
        img.src = src;
      });
    }

async function refpFetchImageData(url, via) {
      if (via === 'desktop') {
        const r = await window.keloDesktop.fetchImage(url);
        if (!r || !r.ok || !/^data:image\/(jpeg|png|webp|gif);base64,/i.test(String(r.dataUrl || ''))) return null;
        return refpDecode(r.dataUrl);
      }
      if (via === 'native') {
        if (!refpNativeAllowed.has(url)) return null;
        const r = await window.Capacitor.Plugins.CapacitorHttp.get({ url, responseType: 'blob', connectTimeout: REFP_TIMEOUT_MS, readTimeout: REFP_TIMEOUT_MS });
        const type = String((r && r.headers && (r.headers['Content-Type'] || r.headers['content-type'])) || '').split(';')[0].trim().toLowerCase();
        const b64 = String(r && r.data || '');
        if (!/^image\/(jpeg|png|webp|gif)$/.test(type) || !/^[A-Za-z0-9+/=\s]+$/.test(b64) || b64.length * 0.75 > REFP_MAX_IMAGE_BYTES) return null;
        return refpDecode(`data:${type};base64,${b64.replace(/\s+/g, '')}`);
      }
      // The web page: only the hosts in the CSP, CORS mode, no cookies, checked type and size
      const safe = refpSafeUrl(url, typeof refsImageHosts === 'function' ? refsImageHosts() : REFP_WEB_IMAGE_HOSTS);
      if (!safe) return null;
      const res = await refpFetch(safe, { mode: 'cors', cache: 'force-cache' });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!/^image\/(jpeg|png|webp|gif)$/i.test(blob.type) || blob.size > REFP_MAX_IMAGE_BYTES || blob.size < 64) return null;
      return refpDecode(blob);
    }

// A decoded picture, downsized to at most 640 px, on a canvas of its own
function refpToCanvas(img, maxSide = 640) {
      const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
      if (!w0 || !h0) return null;
      const k = Math.min(1, maxSide / Math.max(w0, h0));
      const c = artCanvas(Math.max(1, Math.round(w0 * k)), Math.max(1, Math.round(h0 * k)));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      if (img.close) try { img.close(); } catch (e) {}
      return c;
    }

// A tiny copy for his records (a JPEG data URL of a few KB): enough for the Museum label and the website
function refpThumb(canvas) {
      const t = artCanvas(REFP_THUMB_W, REFP_THUMB_H);
      refpDrawCover(t.getContext('2d'), canvas, REFP_THUMB_W, REFP_THUMB_H, { x: 0.5, y: 0.5 }, 1);
      return t.toDataURL('image/jpeg', 0.7);
    }

// Load one search result as a picture he can paint from (or null if it won't load)
async function refpLoadItem(item) {
      const url = item.thumbUrl || item.imageUrl;
      if (!url) return null;
      try {
        const img = await refpFetchImageData(url, item.via);
        const canvas = img && refpToCanvas(img);
        if (!canvas || Math.min(canvas.width, canvas.height) < 96) return null;
        return canvas;
      } catch (e) {
        return null;
      }
    }

// Search for `query` across the licence-checked sources (a rotating order) and bring back the first picture
// that passes the licence gate and the risk check and really loads. `excludeSources`: source ids already
// used (a combined painting takes its two photos from two different sources). `avoid`: picture addresses.
async function refpFindReference(query, { avoid = [], excludeSources = [], maxPages = 6 } = {}) {
      const cur = refsCursor(query, { paintableOnly: true, exclude: excludeSources });
      const skipped = [];
      for (let n = 0; n < maxPages; n++) {
        const page = await cur.next();
        if (!page) break;
        for (const it of page.items.slice(0, 8)) {
          if (!refPaintable(it)) { skipped.push(refRiskOk(it).why || 'licence'); continue; }
          const url = it.thumbUrl || it.imageUrl;
          if (avoid.includes(url)) continue;
          const canvas = await refpLoadItem(it);
          if (!canvas) continue;
          return { ...it, query, usedUrl: url, host: refpHostOf(it.pageUrl), imageHost: refpHostOf(url), canvas, thumb: refpThumb(canvas), skipped };
        }
      }
      return null;
    }

// DuckDuckGo first, where usable, but only to look: its licences are unknown, so he never paints its
// pixels. Returns a few results to show on the cafe screen and mention in the diary.
async function refpLookOnDuckDuckGo(query) {
      const ddg = REFS_SOURCES.find(s => s.id === 'ddg');
      if (!ddg || refsRestUntil.ddg > Date.now()) return [];
      const r = await refsSearchSource(ddg, query, 1);
      return r.items.slice(0, 6);
    }

// --- Turning a photo into an underpainting ------------------------------------------------------------------
function refpDrawCover(ctx, img, w, h, focus, zoom) {
      const iw = img.width, ih = img.height;
      const s = Math.max(w / iw, h / ih) * zoom;
      const vw = w / s, vh = h / s;
      const sx = Math.max(0, Math.min(iw - vw, focus.x * iw - vw / 2));
      const sy = Math.max(0, Math.min(ih - vh, focus.y * ih - vh / 2));
      ctx.drawImage(img, sx, sy, vw, vh, 0, 0, w, h);
    }

// Where the eye goes in a photo: edges and colours unlike its borders, weighted to the middle
function refpSaliency(C) {
      const { w, h } = C;
      const L = artLum(C);
      const E = artBlur(artSobelMag(L, w, h), w, h, Math.max(2, Math.round(w / 40)));
      let br = 0, bg = 0, bb = 0, n = 0;
      for (let x = 0; x < w; x++) for (const y of [0, 1, h - 2, h - 1]) { const i = y * w + x; br += C.r[i]; bg += C.g[i]; bb += C.b[i]; n++; }
      for (let y = 0; y < h; y++) for (const x of [0, 1, w - 2, w - 1]) { const i = y * w + x; br += C.r[i]; bg += C.g[i]; bb += C.b[i]; n++; }
      br /= n; bg /= n; bb /= n;
      const Cb = artBlurChannels(C, Math.max(2, Math.round(w / 60)));
      const S = new Float32Array(w * h);
      let eMax = 1e-6, dMax = 1e-6;
      for (let i = 0; i < S.length; i++) { if (E[i] > eMax) eMax = E[i]; const d = Math.hypot(Cb.r[i] - br, Cb.g[i] - bg, Cb.b[i] - bb); if (d > dMax) dMax = d; }
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const cx = (x / w - 0.5) * 2, cy = (y / h - 0.5) * 2;
          const centre = Math.max(0, 1 - 0.55 * (cx * cx + cy * cy));
          const d = Math.hypot(Cb.r[i] - br, Cb.g[i] - bg, Cb.b[i] - bb) / dMax;
          S[i] = (0.45 * E[i] / eMax + 0.55 * d) * (0.35 + 0.65 * centre);
        }
      }
      return S;
    }

// The weighted middle of the salient part of a picture, 0..1 each way (kept off the edges)
function refpFocus(img) {
      const c = artCanvas(64, 48);
      c.getContext('2d').drawImage(img, 0, 0, 64, 48);
      const S = refpSaliency(artChannels(c));
      let sx = 0, sy = 0, sw = 0;
      const sorted = Array.from(S).sort((a, b) => b - a), cut = sorted[Math.floor(sorted.length * 0.2)];
      for (let y = 0; y < 48; y++) for (let x = 0; x < 64; x++) { const v = S[y * 64 + x]; if (v >= cut) { sx += x * v; sy += y * v; sw += v; } }
      if (!sw) return { x: 0.5, y: 0.5 };
      return { x: Math.max(0.3, Math.min(0.7, sx / sw / 64)), y: Math.max(0.3, Math.min(0.7, sy / sw / 48)) };
    }

// His own crop of a photo onto the painting's shape, nudged so the subject sits off-centre a little
function refpCompose(img, rng, zoomMax = 1.18, { minZoom = 1.06, mirror = false } = {}) {
      const c = artCanvas();
      const f = refpFocus(img);
      // always at least a little reframed (his own crop), more when he reworks a painting
      const zoom = minZoom + rng() * Math.max(0, zoomMax - minZoom);
      // a third of the way in, toward the side the subject already leans to
      const fx = f.x + (f.x < 0.5 ? 0.06 : -0.06) * (zoom - 1) * 5;
      const ctx = c.getContext('2d');
      if (mirror) { ctx.translate(ART_W, 0); ctx.scale(-1, 1); }
      refpDrawCover(ctx, img, ART_W, ART_H, { x: fx, y: f.y }, zoom);
      return c;
    }

// His own light, season or time of day over the photo's (one of these on every painting)
const REFP_LIGHTS = ['golden hour', 'dusk', 'winter', 'morning mist', 'summer noon'];
function refpGrade(C, kind, amount = 1) {
      const { w, h } = C;
      for (let y = 0; y < h; y++) {
        const up = 1 - y / h;
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          let r = C.r[i], g = C.g[i], b = C.b[i];
          const v = 0.299 * r + 0.587 * g + 0.114 * b;
          let nr = r, ng = g, nb = b;
          if (kind === 'golden hour') { nr = r * 1.1 + 0.05; ng = g * 1.0 + 0.025; nb = b * 0.8; }
          else if (kind === 'dusk') { nr = r * 0.86 + 0.04; ng = g * 0.76; nb = b * 0.98 + 0.07; }
          else if (kind === 'winter') { nr = artMix(r, v, 0.45) + 0.03; ng = artMix(g, v, 0.45) + 0.05; nb = artMix(b, v, 0.45) + 0.1; }
          else if (kind === 'morning mist') { const m = 0.18 + 0.32 * up; nr = artMix(r, 0.84, m); ng = artMix(g, 0.86, m); nb = artMix(b, 0.9, m); }
          else { nr = r * 1.04 + 0.02; ng = g * 1.03 + 0.02; nb = b * 0.96; const sat = 1.15; nr = v + (nr - v) * sat; ng = v + (ng - v) * sat; nb = v + (nb - v) * sat; }
          C.r[i] = artClamp01(artMix(r, nr, amount)); C.g[i] = artClamp01(artMix(g, ng, amount)); C.b[i] = artClamp01(artMix(b, nb, amount));
        }
      }
      return C;
    }

// A palette ramp from dark to light: colour for any value
function refpRamp(pal) {
      const lum = p => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
      const s = pal.slice().sort((a, b) => lum(a) - lum(b));
      const ls = s.map(lum);
      return v => {
        if (v <= ls[0]) return s[0];
        for (let k = 1; k < s.length; k++) {
          if (v <= ls[k]) { const t = (v - ls[k - 1]) / Math.max(1e-6, ls[k] - ls[k - 1]); return [0, 1, 2].map(ch => artMix(s[k - 1][ch], s[k][ch], t)); }
        }
        return s[s.length - 1];
      };
    }

function refpMean(C) {
      let r = 0, g = 0, b = 0;
      const n = C.r.length, step = Math.max(1, Math.floor(n / 6000));
      let m = 0;
      for (let i = 0; i < n; i += step) { r += C.r[i]; g += C.g[i]; b += C.b[i]; m++; }
      return [r / m, g / m, b / m];
    }

// Recolour C into another picture's palette and light: its values onto their colour ramp, keeping some
// of its own hue, then shifted toward their overall colour of light
function refpTransfer(C, pal, mean, keep = 0.4) {
      const ramp = refpRamp(pal);
      const own = refpMean(C);
      const out = { r: new Float32Array(C.r.length), g: new Float32Array(C.r.length), b: new Float32Array(C.r.length), w: C.w, h: C.h };
      const light = [0, 1, 2].map(ch => Math.sqrt(Math.max(0.05, mean[ch]) / Math.max(0.05, own[ch])));
      for (let i = 0; i < out.r.length; i++) {
        const v = 0.299 * C.r[i] + 0.587 * C.g[i] + 0.114 * C.b[i];
        const t = ramp(v);
        out.r[i] = artClamp01(artMix(t[0], C.r[i] * light[0], keep));
        out.g[i] = artClamp01(artMix(t[1], C.g[i] * light[1], keep));
        out.b[i] = artClamp01(artMix(t[2], C.b[i] * light[2], keep));
      }
      return out;
    }

// The painter's simplification: soften detail, reduce to a limited palette of flat shapes (small islands
// merged away), keep a little of the gradients, then a painter's colour: warm lights, cool shadows.
function refpSimplify(C, q, rng) {
      const { w, h } = C;
      const Cb = artBlurChannels(C, q < 0.4 ? 3 : 2);
      // Key the values like a painter: a dark night photo or a hazy one is stretched part of the way
      // toward a full range of darks and lights (half strength, so night stays night)
      {
        const L = artLum(Cb);
        const sorted = Array.from(L).filter((v, i) => i % 11 === 0).sort((x, y) => x - y);
        const lo = sorted[Math.floor(sorted.length * 0.02)], hi = sorted[Math.floor(sorted.length * 0.98)];
        const span = Math.max(0.05, hi - lo);
        for (let i = 0; i < L.length; i++) {
          const v = L[i], target = artMix(v, 0.06 + 0.88 * artClamp01((v - lo) / span), 0.5);
          const k2 = v > 0.01 ? target / v : 1;
          Cb.r[i] = artClamp01(Cb.r[i] * k2); Cb.g[i] = artClamp01(Cb.g[i] * k2); Cb.b[i] = artClamp01(Cb.b[i] * k2);
        }
      }
      const k = Math.round(7 + q * 9);
      const pal = artPalette(Cb, k, rng);
      const flat = (src) => {
        const o = { r: new Float32Array(w * h), g: new Float32Array(w * h), b: new Float32Array(w * h), w, h };
        for (let i = 0; i < o.r.length; i++) { const p = pal[artNearest(pal, src.r[i], src.g[i], src.b[i])]; o.r[i] = p[0]; o.g[i] = p[1]; o.b[i] = p[2]; }
        return o;
      };
      // posterize, blur the shapes together, posterize again: specks and thin slivers disappear
      let P = flat(Cb);
      P = flat(artBlurChannels(P, 3));
      const keepGrad = 0.22 + 0.22 * q;
      const out = { r: new Float32Array(w * h), g: new Float32Array(w * h), b: new Float32Array(w * h), w, h };
      for (let i = 0; i < out.r.length; i++) {
        let r = artMix(P.r[i], Cb.r[i], keepGrad), g = artMix(P.g[i], Cb.g[i], keepGrad), b = artMix(P.b[i], Cb.b[i], keepGrad);
        const v = 0.299 * r + 0.587 * g + 0.114 * b;
        // a touch more colour than a photo, and the light warm / the shadows cool
        const sat = 1.12;
        r = v + (r - v) * sat + 0.035 * v - 0.012 * (1 - v);
        g = v + (g - v) * sat + 0.012 * v;
        b = v + (b - v) * sat - 0.03 * v + 0.03 * (1 - v);
        out.r[i] = artClamp01(r); out.g[i] = artClamp01(g); out.b[i] = artClamp01(b);
      }
      return out;
    }

// A soft mask (0..1) around the subject of a picture: a small two-colour-model cut. The background
// model is a few colours from the border; the subject model is a few colours from the middle, sampled
// where the eye goes (edges, colours unlike the border); each pixel goes to whichever it is closer to,
// helped by a soft oval prior around the middle (so a close-up, whose border is the subject too, still
// keeps its middle), then cleaned up into one soft-edged shape.
function refpSubjectMask(C) {
      const { w, h } = C;
      const rng = makeRng('mask');
      const S = refpSaliency(C);
      let sMax = 1e-6;
      for (let i = 0; i < S.length; i++) if (S[i] > sMax) sMax = S[i];
      const Cb = artBlurChannels(C, 2);
      const sample = (accept) => {
        const r = [], g = [], b = [];
        for (let n = 0; n < 40000 && r.length < 3000; n++) {
          const x = Math.floor(rng() * w), y = Math.floor(rng() * h), i = y * w + x;
          if (!accept(x, y, i)) continue;
          r.push(Cb.r[i]); g.push(Cb.g[i]); b.push(Cb.b[i]);
        }
        return r.length > 20 ? artPalette({ r: Float32Array.from(r), g: Float32Array.from(g), b: Float32Array.from(b) }, 6, rng) : [[0.5, 0.5, 0.5]];
      };
      const ovalD = (x, y) => Math.hypot((x / w - 0.5) / 0.36, (y / h - 0.52) / 0.42);
      const edge = Math.max(4, Math.round(Math.min(w, h) * 0.05));
      const bgPal = sample((x, y) => x < edge || y < edge || x >= w - edge || y >= h - edge);
      const fgPal = sample((x, y, i) => ovalD(x, y) < 0.8 && rng() < Math.pow(S[i] / sMax, 2.2));
      const near = (pal, i) => { let best = 9; for (const p of pal) best = Math.min(best, Math.hypot(Cb.r[i] - p[0], Cb.g[i] - p[1], Cb.b[i] - p[2])); return best; };
      const M = new Float32Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x, d = ovalD(x, y);
          const like = near(bgPal, i) - near(fgPal, i);     // > 0: looks like the subject
          const score = like * 8 + (0.8 - d) * 1.1 + (S[i] / sMax - 0.3) * 0.8;
          M[i] = artSmooth(-0.25, 0.35, score) * artSmooth(1.45, 0.95, d);
        }
      }
      // close small holes and drop specks: blur, re-threshold, then feather the edge
      const Mb = artBlur(M, w, h, 5, 2);
      for (let i = 0; i < M.length; i++) M[i] = artSmooth(0.3, 0.6, Mb[i]);
      // fill holes inside the subject (a cup's coffee, an eye): background not reachable from the border
      const outside = new Uint8Array(w * h), stack = [];
      for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
      for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
      while (stack.length) {
        const i = stack.pop();
        if (outside[i] || M[i] >= 0.5) continue;
        outside[i] = 1;
        const x = i % w;
        if (x > 0) stack.push(i - 1);
        if (x < w - 1) stack.push(i + 1);
        if (i >= w) stack.push(i - w);
        if (i < w * (h - 1)) stack.push(i + w);
      }
      for (let i = 0; i < M.length; i++) if (!outside[i] && M[i] < 0.5) M[i] = 1;
      return artBlur(M, w, h, 3);
    }

// The scene for js/paintrender.js, from one or two reference photos. Returns { ref, horizon, sun } like
// paintingSceneRef(). spec.refImages: [canvas] or [canvasA, canvasB]; spec.refHow: 'subject-setting' | 'split'.
function refpSceneFromReference(spec) {
      const rng = makeRng(`ref:${spec.seed}`);
      const q = artClamp01(spec.q == null ? 0.5 : spec.q);
      const [A, B] = spec.refImages || [];
      // A rework (spec.refStrength 2) changes more: a tighter, mirrored crop, stronger light, fewer colours
      const strong = (spec.refStrength || 1) > 1;
      const light = spec.refLight || REFP_LIGHTS[Math.floor(rng() * REFP_LIGHTS.length)];
      const transforms = [strong ? 'his own tighter, mirrored crop' : 'his own crop', 'his own limited palette', `${light} light`, `${spec.medium} brushwork`];
      let C;
      if (!B) {
        C = artChannels(refpCompose(A, rng, strong ? 1.5 : 1.22, { minZoom: strong ? 1.3 : 1.06, mirror: strong }));
      } else if (spec.refHow === 'split') {
        // A planned split: one photo each side (or sky and land), harmonised into one palette, with a
        // wide, wavering blended seam
        const ca = artChannels(refpCompose(A, rng, 1.1)), cb = artChannels(refpCompose(B, rng, 1.1));
        const joint = { r: new Float32Array(ca.r.length), g: new Float32Array(ca.r.length), b: new Float32Array(ca.r.length), w: ca.w, h: ca.h };
        for (let i = 0; i < joint.r.length; i++) { const s = i & 1 ? ca : cb; joint.r[i] = s.r[i]; joint.g[i] = s.g[i]; joint.b[i] = s.b[i]; }
        const pal = artPalette(joint, 10, rng), mean = refpMean(joint);
        const ha = refpTransfer(ca, pal, mean, 0.72), hb = refpTransfer(cb, pal, mean, 0.72);
        const vertical = rng() < 0.6;
        const wav = artValueNoise(ART_W, ART_H, 70, rng);
        C = { r: new Float32Array(ha.r.length), g: new Float32Array(ha.r.length), b: new Float32Array(ha.r.length), w: ART_W, h: ART_H };
        const seam = vertical ? ART_W * (0.42 + rng() * 0.16) : ART_H * (0.45 + rng() * 0.12);
        const width = vertical ? 70 : 55;
        for (let y = 0; y < ART_H; y++) {
          for (let x = 0; x < ART_W; x++) {
            const i = y * ART_W + x;
            const along = vertical ? x : y;
            const t = artSmooth(seam - width, seam + width, along + (wav[i] - 0.5) * 90);
            C.r[i] = artMix(ha.r[i], hb.r[i], t); C.g[i] = artMix(ha.g[i], hb.g[i], t); C.b[i] = artMix(ha.b[i], hb.b[i], t);
          }
        }
      } else {
        // The subject from A, set into B's place, palette and light
        const bg = artChannels(refpCompose(B, rng, 1.08));
        const fa = refpFocus(A);
        const aCan = artCanvas();
        refpDrawCover(aCan.getContext('2d'), A, ART_W, ART_H, fa, 1.0);
        const ca = artChannels(aCan);
        const mask = refpSubjectMask(ca);
        const pal = artPalette(bg, 9, rng);
        const sub = refpTransfer(ca, pal, refpMean(bg), 0.5);
        // place the subject on a third, a little smaller, standing low in the frame
        const scale = 0.72 + rng() * 0.12;
        const tx = (rng() < 0.5 ? 1 / 3 : 2 / 3) * ART_W, ty = 0.58 * ART_H;
        C = { r: Float32Array.from(bg.r), g: Float32Array.from(bg.g), b: Float32Array.from(bg.b), w: ART_W, h: ART_H };
        const cx = ART_W / 2, cy = ART_H / 2;
        for (let y = 0; y < ART_H; y++) {
          for (let x = 0; x < ART_W; x++) {
            const sx = Math.round((x - tx) / scale + cx), sy = Math.round((y - ty) / scale + cy);
            if (sx < 0 || sy < 0 || sx >= ART_W || sy >= ART_H) continue;
            const j = sy * ART_W + sx, a = mask[j];
            if (a <= 0.01) continue;
            const i = y * ART_W + x;
            C.r[i] = artMix(C.r[i], sub.r[j], a); C.g[i] = artMix(C.g[i], sub.g[j], a); C.b[i] = artMix(C.b[i], sub.b[j], a);
          }
        }
      }
      refpGrade(C, light, strong ? 1 : 0.6);
      if (B) transforms.push(spec.refHow === 'split' ? 'two photos joined in a split composition' : 'the subject set into another photo\'s place and light');
      spec.refTransforms = transforms;
      const S = refpSimplify(C, strong ? q * 0.4 : q, rng);
      const ref = artCanvas();
      artPutChannels(ref, S.r, S.g, S.b);
      // The horizon: the row with the strongest change in value through the middle band (ink mist sits there)
      const L = artLum(S);
      let best = ART_H * 0.55, bestV = -1;
      for (let y = Math.round(ART_H * 0.25); y < ART_H * 0.75; y += 2) {
        let v = 0;
        for (let x = 0; x < ART_W; x += 4) v += Math.abs(L[(y + 2) * ART_W + x] - L[(y - 2) * ART_W + x]);
        if (v > bestV) { bestV = v; best = y; }
      }
      return { ref, horizon: best, sun: null };
    }

// --- Originality, measured -----------------------------------------------------------------------------------
// The thresholds: a painting this close to its reference is reworked, and if it is still this close it
// stays a study (never sold). corr: correlation of the 32x24 value maps (also against the mirrored photo);
// palette: mean distance between their 6-colour palettes (RGB 0..1).
const REFP_ORIGINALITY = { maxCorr: 0.9, nearCorr: 0.8, minPalette: 0.07 };

function refpValueMap(img, mirror = false) {
      const c = artCanvas(32, 24);
      const ctx = c.getContext('2d');
      if (mirror) { ctx.translate(32, 0); ctx.scale(-1, 1); }
      refpDrawCover(ctx, img, 32, 24, { x: 0.5, y: 0.5 }, 1);
      return artLum(artChannels(c));
    }

function refpCorr(a, b) {
      const n = a.length;
      let ma = 0, mb = 0;
      for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
      ma /= n; mb /= n;
      let sab = 0, saa = 0, sbb = 0;
      for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; saa += x * x; sbb += y * y; }
      return saa > 1e-9 && sbb > 1e-9 ? sab / Math.sqrt(saa * sbb) : 0;
    }

function refpPaletteDistance(imgA, imgB) {
      const pal = img => { const c = artCanvas(64, 48); refpDrawCover(c.getContext('2d'), img, 64, 48, { x: 0.5, y: 0.5 }, 1); return artPalette(artChannels(c), 6, makeRng('pal')); };
      const pa = pal(imgA), pb = pal(imgB);
      const near = (p, set) => Math.min(...set.map(q => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])));
      return (pa.reduce((s, p) => s + near(p, pb), 0) / pa.length + pb.reduce((s, p) => s + near(p, pa), 0) / pb.length) / 2;
    }

// How close is the painting to its reference photo(s)? The closest one counts.
function refpOriginality(canvas, refCanvases) {
      const pv = refpValueMap(canvas);
      let corr = -1, palette = 9;
      (refCanvases || []).forEach(rc => {
        corr = Math.max(corr, refpCorr(pv, refpValueMap(rc)), refpCorr(pv, refpValueMap(rc, true)));
        palette = Math.min(palette, refpPaletteDistance(canvas, rc));
      });
      const T = REFP_ORIGINALITY;
      const tooClose = corr >= T.maxCorr || (corr >= T.nearCorr && palette < T.minPalette);
      return { corr: Math.round(corr * 1000) / 1000, palette: Math.round(palette * 1000) / 1000, tooClose };
    }

// --- What he looks for -------------------------------------------------------------------------------------
function refpTitleCase(s) {
      return String(s || '').replace(/(^|\s)([a-z])/g, (all, sp, c, i, str) => /^(and|of|in|on|at|the|by|over|with|a|an|under)\b/.test(str.slice(i + sp.length)) && i > 0 ? all : sp + c.toUpperCase());
    }

// Without an AI key: his own simple choice. Online, most of his paintings start from a photo; the more
// practised he is, the more often he dares to combine two.
function refpChooseProcedural(medium) {
      if (!refpOnline() || Math.random() > REFP_CHANCE) return null;
      // sometimes one of the photos on his favourites board (js/photobrowse.js)
      if (typeof phobPlanFromFavourite === 'function' && Math.random() < 0.35) { const f = phobPlanFromFavourite(); if (f) return f; }
      const q = typeof paintQuality === 'function' ? paintQuality(medium) : 0.3;
      const read = (state.webHistory || []).slice(0, 6).flatMap(w => (w.hops || []).map(h => h.title)).filter(Boolean);
      const likes = (state.likes || []).slice(0, 4).map(l => l.topic || l.item).filter(Boolean);
      const pool = [...REFP_SUBJECTS, ...REFP_SUBJECTS, ...read.slice(0, 4), ...likes];
      const subject = refpCleanQuery(pick(pool)) || pick(REFP_SUBJECTS);
      if (Math.random() < 0.25 + q * 0.3) {
        const setting = refpCleanQuery(pick(REFP_SETTINGS)) || 'misty forest';
        return { mode: 'combine', query: subject, queryB: setting, how: Math.random() < 0.65 ? 'subject-setting' : 'split', why: `I want to see what ${subject} looks like in ${setting}.` };
      }
      return { mode: 'single', query: subject, why: read.includes(subject) ? `I read about ${subject} and want to paint it.` : `I have never painted ${/^[aeiou]/i.test(subject) ? 'an' : 'a'} ${subject}.` };
    }

// The AI's choice (the paint decision's "reference" field), cleaned up and kept safe
// Things he never paints from photos (people, brands, characters): the words alone are enough to say no
function refpQueryRisky(q) {
      return typeof REFS_PEOPLE !== 'undefined' && [REFS_PEOPLE, REFS_BRANDS, REFS_CHARACTERS].some(re => re.test(String(q || '')));
    }

function refpPlanFrom(r, avoid = []) {
      if (!r || typeof r !== 'object') return null;
      const query = refpCleanQuery(r.query, avoid);
      if (!query || refpQueryRisky(query) || refpQueryRisky(r.queryB)) return null;
      const combine = /^comb/i.test(String(r.mode || '')) || Boolean(r.queryB);
      const queryB = combine ? refpCleanQuery(r.queryB, avoid) : null;
      const why = typeof r.why === 'string' ? r.why.trim().slice(0, 200) : '';
      if (combine && queryB && queryB !== query) return { mode: 'combine', query, queryB, how: r.how === 'split' ? 'split' : 'subject-setting', why };
      const favourite = typeof r.favourite === 'string' && /^fav-[a-z0-9]+$/.test(r.favourite) ? r.favourite : undefined;
      return { mode: 'single', query, why, ...(favourite ? { favourite } : {}) };
    }

// A visitor's "paint me a lighthouse" / "paint a fox in the desert": what to look up (only the things
// to paint, never who asked)
function refpPlanFromRequest(message, visitor) {
      const m = String(message || '');
      const after = m.split(/\b(?:paint|painting|draw|drawing|sketch)\b/i).slice(1).join(' ');
      if (!after || refpQueryRisky(after)) return null;
      let t = after.replace(/\b(an?|the|some|me|us|please|picture|painting|portrait|image|study|of|for|in (?:oils?|watercolou?rs?|acrylics?|gouache|pastels?|ink|charcoal|graphite|pencil))\b/gi, ' ');
      t = t.replace(/\b(oil|oils|acrylic|watercolou?r|gouache|pastel|ink|sumi|charcoal|graphite|pencil|sketch)\b/gi, ' ').replace(/[?!.]+$/, '').trim();
      t = t.replace(/\b(something|anything|whatever|nice|pretty|beautiful|cool|new|lovely|you like|your choice|one)\b/gi, ' ').replace(/\s+/g, ' ').trim();
      if (!t || t.length < 3) return null;
      const parts = t.split(/\s+(?:in|on|at|under|with|and|by|against|inside|over)\s+/i).map(s => refpCleanQuery(s, [visitor])).filter(Boolean);
      if (!parts.length || parts.some(refpQueryRisky)) return null;
      if (parts.length > 1 && parts[0] !== parts[1]) return { mode: 'combine', query: parts[0], queryB: parts[1], how: 'subject-setting', why: `${visitor || 'A visitor'} asked for it.` };
      return { mode: 'single', query: parts[0], why: `${visitor || 'A visitor'} asked for it.` };
    }

// --- At the NetNode cafe ------------------------------------------------------------------------------------
// He walks over, sits at a computer and looks. Returns { mode, how, refs: [ref, ref?], label } or null.
async function refpGatherAtNetNode(plan, medium, { visitor = null } = {}) {
      if (!plan || !refpOnline()) return null;
      const M = PAINT_MEDIA[medium];
      const cafe = TOWN_LOCATIONS.cyber;
      const wasBrowsing = state.isBrowsing;
      state.isBrowsing = true;
      try {
        state.currentLocKey = 'cyber';
        state.customPlaceName = null;
        state.targetPos = { x: cafe.x, z: cafe.z };
        state.microPose = 'normal';
        state.moodEmoji = '🔎';
        state.moodTitle = `Looking up ${plan.query} photos`.slice(0, 80);
        state.speechBubble = plan.mode === 'combine'
          ? `I'm off to NetNode to find two reference photos: "${plan.query}" and "${plan.queryB}". I'll combine them into one ${M.title}.`
          : `I'm off to NetNode to find a reference photo of "${plan.query}" for my next ${M.title}.`;
        renderAllUI();
        await waitForArrival(90000);
        await new Promise(r => setTimeout(r, 2500));
        // 1. A look at DuckDuckGo for ideas (looking only: its pictures' licences are unknown)
        let looked = [];
        try { looked = await refpLookOnDuckDuckGo(plan.query); } catch (e) {}
        if (looked.length && typeof phobShowOnScreen === 'function') phobShowOnScreen(looked, plan.query);
        // 2. The photo he paints from: a favourite he saved, or the licence-checked sources
        let a = null;
        if (plan.favourite && typeof phobFavouriteToRef === 'function') a = await phobFavouriteToRef(plan.favourite, plan.query);
        if (!a) a = await refpFindReference(plan.query);
        let b = null;
        if (a && plan.mode === 'combine') {
          state.moodTitle = `Looking up ${plan.queryB} photos`.slice(0, 80);
          state.speechBubble = `Found "${a.title || plan.query}" on ${a.source}. Now "${plan.queryB}", from a different source...`;
          renderAllUI();
          await new Promise(r => setTimeout(r, 2000));
          // the setting comes from a different source than the subject
          b = await refpFindReference(plan.queryB, { avoid: [a.usedUrl], excludeSources: [a.sourceId] });
        }
        const refs = [a, b].filter(Boolean);
        refs.forEach(r => { if (typeof refsReportUse === 'function') refsReportUse(r); });
        if (refs.length && typeof phobShowOnScreen === 'function') phobShowOnScreen(refs.map(r => ({ ...r, canvas: r.canvas })), plan.query);
        const mode = refs.length === 2 ? 'combine' : 'single';
        const why = plan.why || (visitor ? `${visitor} asked for it.` : '');
        const srcText = r => `"${r.title || r.query}"${r.author ? ` by ${r.author}` : ''} (${r.source}, ${r.licenceLabel})`;
        state.webHistory.unshift({
          query: plan.mode === 'combine' ? `photos: ${plan.query} + ${plan.queryB}` : `photos: ${plan.query}`,
          time: 'Just now',
          verdict: refs.length ? `Found reference ${refs.length === 2 ? 'photos' : 'a photo'} I may paint from for a ${M.title}: ${refs.map(srcText).join(' and ')}.` : 'No freely licensed picture would load, so I will paint from life instead.',
          hops: refs.map(r => ({ title: r.title || r.query, url: r.pageUrl, extract: `${r.source} · ${r.licenceLabel}${r.author ? ` · ${r.author}` : ''}` }))
        });
        if (state.webHistory.length > MAX_WEB_HISTORY) state.webHistory.length = MAX_WEB_HISTORY;
        if (typeof bumpLifeStat === 'function') bumpLifeStat('searches', plan.mode === 'combine' ? 2 : 1);
        const lookLine = looked.length ? ` I looked at DuckDuckGo's pictures for ideas first, but nobody knows their licences, so I don't paint from those.` : '';
        const diary = !refs.length
          ? `Dear Diary, I went to the NetNode cafe to find a reference photo of "${plan.query}" for a ${M.title}${why ? ` (${why.replace(/\.$/, '')})` : ''}, but no freely licensed picture would load.${lookLine} I'll paint something I can see instead.`
          : `Dear Diary, at the NetNode cafe I searched for ${mode === 'combine' ? `"${plan.query}" and "${plan.queryB}"` : `"${plan.query}"`} to paint from${why ? `, because ${why.replace(/^\w/, c => c.toLowerCase()).replace(/\.$/, '')}` : ''}.${lookLine} `
            + `I found ${refs.map(srcText).join(' and ')}: free to use, so a painting after ${refs.length > 1 ? 'them' : 'it'} can be sold with the credit. `
            + (mode === 'combine' ? `I'll combine them into one picture of my own: ${plan.how === 'split' ? 'a split composition with the edges blended' : `the ${plan.query} from one, in the light and colours of the other`}.` : 'I\'ll paint it in my own way: my own crop, my own colours and light, not a copy.')
            + (plan.mode === 'combine' && mode === 'single' && refs.length ? ` The second search ("${plan.queryB}") found nothing usable from another source, so it will be just the one.` : '');
        state.diaryEntries.unshift({
          time: visitor ? `Reference for ${visitor}` : 'Finding a Reference', location: 'NetNode Cyber Cafe', mood: `🔎 Looked up "${plan.query}"${mode === 'combine' ? ` + "${plan.queryB}"` : ''}`.slice(0, 80),
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '', text: diary
        });
        savePersistentBrainState();
        renderAllUI();
        if (!refs.length) return null;
        showToast(`🔎 Kelo-1 found ${refs.length === 2 ? 'two reference photos' : 'a reference photo'} (${[...new Set(refs.map(r => r.source))].join(', ')})`);
        // "a cat", "sunflowers", "the northern lights": a noun phrase for his label and diary
        const np = t => /^(a|an|the)\s/i.test(t) || /s$/i.test(t) && !/ss$/i.test(t) ? t : `${/^[aeiou]/i.test(t) ? 'an' : 'a'} ${t}`;
        const label = mode === 'combine'
          ? (plan.how === 'split' ? `${np(plan.query)} and ${np(plan.queryB)}, a split composition from two reference photos` : `${np(plan.query)} in ${np(plan.queryB)}, combined from two reference photos`)
          : `${np(plan.query)}, after a reference photo`;
        return { mode, how: mode === 'combine' ? (plan.how === 'split' ? 'split' : 'subject-setting') : null, refs, label, query: plan.query, queryB: mode === 'combine' ? plan.queryB : null };
      } finally {
        state.isBrowsing = wasBrowsing;
      }
    }

// --- Keeping the credit with the painting ------------------------------------------------------------------
function refpTitle(found, spec) {
      const a = refpTitleCase(found.query), b = refpTitleCase(found.queryB || '');
      const options = found.mode !== 'combine' ? [a, `${a}, after a Photograph`, `Study of ${/^[aeiou]/i.test(a) ? 'an' : 'a'} ${a}`]
        : found.how === 'split' ? [`${a} / ${b}`, `Diptych: ${a} and ${b}`] : [`${a} in ${b}`, `${a} and the ${b}`, `Dream of ${a} in ${b}`];
      let title = pick(options);
      if (spec.q < 0.2) title = `Study: ${title.replace(/^Study of an? /, '')}`;
      const taken = new Set(artPaintings().map(p => p.title));
      const base = title;
      for (let n = 2; taken.has(title) && n < 30; n++) title = `${base} ${['', '', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || n}`;
      return title.slice(0, 60);
    }

// What the painting record keeps (plain strings only; the pictures themselves stay in paintingImages)
function refpRecordInfo(found) {
      return {
        mode: found.mode === 'combine' ? 'combined' : 'single',
        how: found.how || null,
        sources: found.refs.map(r => ({
          query: String(r.query || '').slice(0, 60), source: String(r.source || '').slice(0, 60), sourceId: String(r.sourceId || '').slice(0, 20),
          host: String(r.host || '').slice(0, 80), pageUrl: refpSafeUrl(r.pageUrl) || '', imageUrl: refpSafeUrl(r.imageUrl || r.usedUrl) || '',
          title: String(r.title || '').slice(0, 140), author: String(r.author || '').slice(0, 80),
          licence: REFS_OK_LICENCES.includes(r.licence) ? r.licence : null, licenceLabel: String(r.licenceLabel || '').slice(0, 40), licenceUrl: refpSafeUrl(r.licenceUrl) || ''
        }))
      };
    }

// Does one recorded source pass the licence gate today? (old records without licence data never do)
function refpSourceOk(src) {
      return Boolean(src && typeof refLicenceOk === 'function' && refLicenceOk({ licence: src.licence, author: src.author, pageUrl: src.pageUrl }));
    }

function refpPublicDomain(src) {
      return ['pd', 'pdm', 'cc0'].includes(src && src.licence);
    }

// One source's credit: after "Title" by Author, CC BY 4.0, https://… / based on a public-domain image …
function refpCreditPart(s) {
      const name = `"${s.title || s.query}"${s.author ? ` by ${s.author}` : ''}`;
      if (refpPublicDomain(s)) return `based on a public-domain image, ${name} (${s.source}${s.licenceLabel ? `, ${s.licenceLabel}` : ''}, ${s.pageUrl})`;
      return `after ${name}, ${s.licenceLabel || (REFS_LICENCE_LABEL[s.licence] || 'licence unknown')}, ${s.pageUrl} (${s.source})`;
    }

// A CC BY-SA reference means the painting itself is shared under CC BY-SA 4.0
function refpShareAlike(m) {
      return Boolean(m && m.reference && Array.isArray(m.reference.sources) && m.reference.sources.some(s => s.licence === 'by-sa'));
    }

// The credit line (plain text): Museum label, website listing, diary
function refpCreditLine(m) {
      const ref = m && m.reference;
      if (!ref || !Array.isArray(ref.sources) || !ref.sources.length) return '';
      let line = `${ref.sources.length > 1 ? 'Painted from two reference photos' : 'Painted from a reference photo'}: ${ref.sources.map(refpCreditPart).join('; and ')}.`;
      if (refpShareAlike(m)) line += ' This painting is shared under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).';
      if (m.study) line += ' A study, not for sale.';
      return line.slice(0, 600);
    }

// The same credit as HTML for the Museum viewer: everything escaped, links only to checked https pages
function refpCreditHtml(m) {
      const ref = m && m.reference;
      if (!ref || !Array.isArray(ref.sources) || !ref.sources.length) return '';
      const thumbs = (paintingImages()[m.id] && paintingImages()[m.id].refs) || [];
      const link = (href, text) => { const u = refpSafeUrl(href); return u ? `<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer" class="text-sky-300 hover:underline">${escapeHtml(text)}</a>` : escapeHtml(text); };
      const items = ref.sources.map((s, i) => {
        const thumb = /^data:image\/jpeg;base64,[a-z0-9+/=]+$/i.test(String(thumbs[i] || '')) ? `<img src="${escapeHtml(thumbs[i])}" alt="Reference photo ${i + 1}" class="w-16 h-12 object-cover rounded border border-slate-700">` : '';
        const lic = s.licenceUrl ? link(s.licenceUrl, s.licenceLabel || s.licence || '') : escapeHtml(s.licenceLabel || s.licence || 'licence unknown');
        const pre = refpPublicDomain(s) ? 'based on a public-domain image,' : 'after';
        return `<span class="inline-flex items-center gap-1.5">${thumb}<span>${pre} ${link(s.pageUrl, `"${s.title || s.query}"`)}${s.author ? ` by ${escapeHtml(s.author)}` : ''}, ${lic} <span class="text-slate-400">(${escapeHtml(s.source)})</span></span></span>`;
      });
      const o = m.originality;
      const score = o && Number.isFinite(o.corr) ? ` · similarity ${escapeHtml(o.corr.toFixed(2))}, palette distance ${escapeHtml((o.palette || 0).toFixed(2))}` : '';
      return `<div class="text-2xs text-slate-300 flex flex-wrap items-center justify-center gap-2">${ref.sources.length > 1 ? 'Painted from two reference photos' : 'Painted from a reference photo'}${ref.mode === 'combined' ? (ref.how === 'split' ? ' (split composition)' : ' (subject from one, setting from the other)') : ''}: ${items.join(' <span class="text-slate-500">+</span> ')}</div>`
        + (refpShareAlike(m) ? `<div class="text-2xs text-slate-300">This painting is shared under ${link('https://creativecommons.org/licenses/by-sa/4.0/', 'CC BY-SA 4.0')}.</div>` : '')
        + `<div class="text-2xs text-slate-400">${m.study ? 'A study, not for sale (too close to its reference).' : 'His own composition'}${score}</div>`;
    }

// The website gate: may this painting be sold? Paintings from life (no reference) always may; one from a
// reference only if it is not a study and every source has licence data that passes the gate today.
function refpSellable(m) {
      if (!m) return { ok: false, why: 'no painting' };
      if (m.study) return { ok: false, why: `"${m.title}" is a study that stayed too close to its reference photo. It stays in my Museum, not for sale.` };
      const fromRef = m.subject === 'reference' || Boolean(m.reference);
      if (!fromRef) return { ok: true, why: '' };
      const srcs = m.reference && Array.isArray(m.reference.sources) ? m.reference.sources : [];
      if (!srcs.length || !srcs.every(refpSourceOk)) return { ok: false, why: `I don't have clear licence details for the photo behind "${m.title}", so I won't sell it.` };
      return { ok: true, why: '' };
    }

// The tiny copies of the reference photos, kept with the painting's pictures (newest REFP_KEEP_THUMBS only)
function refpStoreThumbs(id, found) {
      const imgs = paintingImages();
      if (!imgs[id]) return;
      imgs[id].refs = found.refs.map(r => r.thumb).filter(t => typeof t === 'string' && t.length < 40000);
      const withRefs = Object.keys(imgs).filter(k => imgs[k] && imgs[k].refs).sort((a, b) => (imgs[b].at || 0) - (imgs[a].at || 0));
      withRefs.slice(REFP_KEEP_THUMBS).forEach(k => { delete imgs[k].refs; });
    }

// The paint decision's line in the AI prompt (js/agent.js)
function refpPromptHint() {
      const favs = typeof phobFavourites === 'function' ? phobFavourites().filter(f => f.paintable).slice(0, 5) : [];
      const favLine = favs.length ? ` Free-to-use photos on your favourites board you could paint from (put the id in "favourite"): ${favs.map(f => `${f.id} "${f.title.slice(0, 50)}"`).join('; ')}.` : '';
      return `"reference": null OR {"mode": "single|combine", "query": "2-5 plain words to search for a photo of what to paint, e.g. lighthouse in fog (never anything about a visitor)", "queryB": "combine only: a second, different search for the setting, light or palette", "how": "subject-setting|split", "favourite": null OR "a favourite's id", "why": "1 sentence"} (online you can look up live reference photos at the NetNode cafe: paint from one, or combine two into one original picture; null paints one of your subjects from life; you only paint from photos whose licence allows it, never of people, brands or famous characters, and always change them into your own picture)${favLine}`;
    }
