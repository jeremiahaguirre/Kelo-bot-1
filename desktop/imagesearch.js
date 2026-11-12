// Kelo-1 World — DuckDuckGo image search for the desktop app (Electron main process only).
// DuckDuckGo's image results (duckduckgo.com/i.js, which needs a "vqd" token from the search page)
// send no CORS headers, so the web page can't call them. The main process can: it asks with safe
// search set to strict, keeps only https results, and later downloads only pictures that one of its
// own searches returned (never any other address), as a size-limited data: URL. Nothing about the
// player is ever sent: the renderer passes only the cleaned-up words Kelo-1 is looking for.

const DDG = 'https://duckduckgo.com';
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_RESULTS = 12;
const TIMEOUT_MS = 15000;
const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif)$/i;
// The same words-only rule as js/refpaint.js: letters, digits, spaces, hyphens and apostrophes
const UNSAFE_WORDS = /\b(nude|nudity|naked|nsfw|porn\w*|sex\w*|erotic\w*|xxx|hentai|fetish\w*|lingerie|bikini|topless|gore|gory|blood\w*|corpse|dead body|kill\w*|murder\w*|suicide|self.?harm|weapon\w*|guns?|rifles?|pistols?|bombs?|drugs?|cocaine|heroin|meth|nazi\w*|swastika|terror\w*|beheading|torture)\b/i;

// Picture addresses his searches returned: only these may be downloaded (newest kept, bounded)
const allowedImageUrls = new Set();

function cleanQuery(q) {
  const t = String(q || '').normalize('NFKC').replace(/[^\p{L}\p{N} '\-]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!t || UNSAFE_WORDS.test(t)) return '';
  return t;
}

function httpsUrl(u, base) {
  try {
    const url = new URL(String(u || ''), base);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    // public names only: never this computer or the local network (no IP literals, localhost or .local)
    const host = url.hostname.toLowerCase();
    if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || host.startsWith('[') || /(^|\.)(localhost|local|internal|lan|home)$/.test(host)) return null;
    return url.href;
  } catch (e) {
    return null;
  }
}

function rememberImageUrl(u) {
  allowedImageUrls.delete(u);
  allowedImageUrls.add(u);
  while (allowedImageUrls.size > 240) allowedImageUrls.delete(allowedImageUrls.values().next().value);
}

// The token DuckDuckGo's image endpoint wants, read from its normal search page
function findVqd(html) {
  const m = String(html || '').match(/vqd\s*=\s*["']?([\d-]{6,})["']?/) || String(html || '').match(/"vqd"\s*:\s*"([\d-]{6,})"/);
  return m ? m[1] : null;
}

// Turn the i.js answer into a short list of safe, https-only results
function parseImageResults(json) {
  const list = Array.isArray(json && json.results) ? json.results : [];
  const out = [];
  for (const r of list) {
    if (!r || typeof r !== 'object') continue;
    const thumb = httpsUrl(r.thumbnail);
    const image = httpsUrl(r.image);
    const page = httpsUrl(r.url);
    if (!(thumb || image) || !page) continue;
    const title = String(r.title || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    if (UNSAFE_WORDS.test(title)) continue;
    out.push({ thumbnail: thumb, image, pageUrl: page, title, width: Number(r.width) || 0, height: Number(r.height) || 0, source: String(r.source || '').slice(0, 40) });
    if (out.length >= MAX_RESULTS) break;
  }
  return out;
}

async function timedFetch(fetchImpl, url, opts = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetchImpl(url, { redirect: 'follow', ...opts, signal: ctl.signal, credentials: 'omit' });
  } finally {
    clearTimeout(timer);
  }
}

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Kelo-1-World', 'Accept-Language': 'en-US,en;q=0.8' };

async function searchImages(query, fetchImpl = fetch) {
  const q = cleanQuery(query);
  if (!q) return { ok: false, error: 'bad-query', results: [] };
  try {
    // kp=1: strict safe search
    const page = await timedFetch(fetchImpl, `${DDG}/?q=${encodeURIComponent(q)}&iax=images&ia=images&kp=1`, { headers: HEADERS });
    if (!page.ok) return { ok: false, error: `search page ${page.status}`, results: [] };
    const vqd = findVqd(await page.text());
    if (!vqd) return { ok: false, error: 'no token', results: [] };
    // p=1: safe search on for the image results themselves
    const res = await timedFetch(fetchImpl, `${DDG}/i.js?l=us-en&o=json&q=${encodeURIComponent(q)}&vqd=${encodeURIComponent(vqd)}&f=,,,,,&p=1&kp=1`, { headers: { ...HEADERS, Referer: `${DDG}/`, Accept: 'application/json' } });
    if (!res.ok) return { ok: false, error: `image results ${res.status}`, results: [] };
    const results = parseImageResults(await res.json());
    results.forEach(r => { if (r.thumbnail) rememberImageUrl(r.thumbnail); if (r.image) rememberImageUrl(r.image); });
    return { ok: true, results };
  } catch (e) {
    return { ok: false, error: e && e.name === 'AbortError' ? 'timeout' : 'network', results: [] };
  }
}

// Download one picture a search returned, as a data: URL (the page never talks to that host itself)
async function fetchImage(url, fetchImpl = fetch) {
  const u = httpsUrl(url);
  if (!u || !allowedImageUrls.has(u)) return { ok: false, error: 'not-allowed' };
  try {
    // Redirects are followed by hand (at most 3), each one checked like the first address
    let res = null;
    let at = u;
    for (let hop = 0; hop < 4; hop++) {
      res = await timedFetch(fetchImpl, at, { headers: { ...HEADERS, Accept: 'image/*' }, redirect: 'manual' });
      if (res.status < 300 || res.status >= 400) break;
      const next = httpsUrl(res.headers.get('location'), at);
      if (!next || hop === 3) return { ok: false, error: 'bad-redirect' };
      at = next;
    }
    if (!res.ok) return { ok: false, error: `status ${res.status}` };
    const type = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!IMAGE_TYPES.test(type)) return { ok: false, error: 'not-an-image' };
    const len = Number(res.headers.get('content-length') || 0);
    if (len > MAX_IMAGE_BYTES) return { ok: false, error: 'too-big' };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES || buf.length < 64) return { ok: false, error: 'bad-size' };
    return { ok: true, dataUrl: `data:${type};base64,${buf.toString('base64')}` };
  } catch (e) {
    return { ok: false, error: e && e.name === 'AbortError' ? 'timeout' : 'network' };
  }
}

module.exports = { searchImages, fetchImage, cleanQuery, findVqd, parseImageResults, allowedImageUrls };
