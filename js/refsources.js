// Kelo-bot-1 — js/refsources.js
// Loaded before refpaint.js. Every place Kelo-1 can find photos at the NetNode cafe, behind one search layer.
//   - Each source is a small adapter: search(query, page) -> { items, more }. Every item is normalised to
//     { sourceId, source, title, author, licence, licenceLabel, licenceUrl, pageUrl, thumbUrl, imageUrl, text, lookOnly }.
//   - No key needed: DuckDuckGo (looking only), Wikimedia Commons, Openverse, The Met, Art Institute of
//     Chicago, Cleveland Museum of Art, NASA Image Library, Library of Congress (wherever it answers).
//   - With a free key the owner adds in Settings: Pexels, Unsplash, Pixabay, Flickr, Smithsonian Open
//     Access, Europeana, Rijksmuseum. Keys stay on the device (like the AI keys) and are never logged.
//   - The legal rules live here, in code:
//       refLicenceOk(item): only a known licence that allows modified commercial reuse (public domain /
//         PDM / CC0, CC BY, CC BY-SA, the Pexels / Unsplash / Pixabay licences). NC, ND, all rights
//         reserved, fair use, non-free, unknown: refused. DuckDuckGo results never pass: looking only.
//       refRiskOk(item): no identifiable person as the subject, no logos / brands / trademarks, no famous
//         characters or franchises, no photos of artworks unless a museum marks them public domain.
//   - Sources take turns (a rotating order, so browsing feels varied); one that fails or rate-limits is
//     rested for a while and the search carries on with the others.

const REFS_TIMEOUT_MS = 15000;
// Licences he may paint from (and sell paintings after): normalised ids
const REFS_OK_LICENCES = ['pd', 'pdm', 'cc0', 'by', 'by-sa', 'pexels', 'unsplash', 'pixabay'];
const REFS_LICENCE_LABEL = { pd: 'Public domain', pdm: 'Public Domain Mark', cc0: 'CC0', by: 'CC BY', 'by-sa': 'CC BY-SA', pexels: 'Pexels License', unsplash: 'Unsplash License', pixabay: 'Pixabay Content License' };
// Words that mean the photo is about a person, a brand or a character (checked on title, tags, description)
const REFS_PEOPLE = /\b(portrait|person|people|persons|man|men|woman|women|girl|boy|child|children|kids?|baby|babies|selfie|headshot|face|faces|crowd|model|actor|actress|celebrit\w*|singer|politician|president|king|queen|prince|princess|bride|groom|wedding|family|couple|teen\w*|student|worker|soldier|player|athlete|mr|mrs|ms|dr|human|humans|someone|somebody|myself|yourself|self.?portrait|mom|mum|mother|dad|father|grand(?:ma|pa|mother|father)|sister|brother|son|daughter|wife|husband|boyfriend|girlfriend|uncle|aunt|cousin|neighbou?r)\b/i;
const REFS_BRANDS = /\b(logo|logos|brand\w*|trademark\w*|advert\w*|billboard|poster|packaging|label|coca.?cola|pepsi|nike|adidas|apple inc|iphone|samsung|google|microsoft|mcdonald'?s|starbucks|ikea|tesla|ferrari|lamborghini|toyota|ford mustang|lego|barbie|nintendo|playstation|xbox)\b/i;
const REFS_CHARACTERS = /\b(disney|pixar|marvel|dc comics|mickey|minnie|donald duck|pokemon|pok[eé]mon|pikachu|batman|superman|spider.?man|iron man|avengers|star wars|darth|yoda|harry potter|hogwarts|simpsons|hello kitty|mario|luigi|sonic|shrek|frozen|elsa|minions?|spongebob|peppa|paw patrol|transformers|godzilla|anime|manga|cosplay|mascot)\b/i;
const REFS_ARTWORK = /\b(painting|paintings|artwork|mural|graffiti|street art|sculpture|statue|installation|illustration|comic|poster art|exhibit\w*|gallery)\b/i;
const REFS_MUSEUM_PD = ['met', 'aic', 'cma', 'smithsonian', 'rijks', 'europeana'];
// Optional keys (names as stored); each is only ever sent to its own source's host
const REFS_KEY_NAMES = ['pexels', 'unsplash', 'pixabay', 'flickr', 'smithsonian', 'europeana', 'rijksmuseum'];
let refsKeys = {};
try { REFS_KEY_NAMES.forEach(k => { const v = localStorage.getItem(`kelo1_${k}_api_key`); if (v) refsKeys[k] = v; }); } catch (e) {}
const refsRestUntil = {};      // sourceId -> time it may be asked again (after a failure or a rate limit)
let refsTurn = 0;

function refsKey(name) {
      return typeof refsKeys[name] === 'string' ? refsKeys[name].trim() : '';
    }

// --- Licences ---------------------------------------------------------------------------------------------
// Turn whatever a source says into one of our ids, or null if it is unknown or not allowed
function refsNormaliseLicence(text, url = '') {
      const t = `${text || ''} ${url || ''}`.toLowerCase();
      if (!t.trim()) return null;
      if (/\b(nc|nd)\b|noncommercial|non-commercial|noderiv|no-deriv|by-nc|by-nd|all rights reserved|fair use|non-free|copyrighted|©/.test(t)) return null;
      if (/publicdomain\/zero|\bcc0\b|cc-zero|cc zero/.test(t)) return 'cc0';
      if (/publicdomain\/mark|\bpdm\b|public domain mark/.test(t)) return 'pdm';
      if (/public.?domain|\bpd\b|pd-|no known (copyright )?restrictions|pd-usgov|pd-old|pd-art/.test(t)) return 'pd';
      if (/by-sa|by sa|attribution.?share.?alike/.test(t)) return 'by-sa';
      if (/licenses\/by\/|\bcc[ -]by\b|cc-by-\d|attribution \d|^by$/.test(t.trim()) || /\bcc by \d/.test(t) || /\bcc-by\b/.test(t)) return 'by';
      if (/pexels/.test(t)) return 'pexels';
      if (/unsplash/.test(t)) return 'unsplash';
      if (/pixabay/.test(t)) return 'pixabay';
      return null;
    }

// THE licence gate: may this picture be used to make a painting that is sold?
function refLicenceOk(item) {
      if (!item || item.lookOnly) return false;
      if (!REFS_OK_LICENCES.includes(item.licence)) return false;
      // attribution licences need someone to credit (or at least the source page)
      if ((item.licence === 'by' || item.licence === 'by-sa') && !item.author && !item.pageUrl) return false;
      return Boolean(item.pageUrl);
    }

// Risky content, even with a good licence. Returns { ok, why }.
function refRiskOk(item) {
      if (!item) return { ok: false, why: 'nothing there' };
      const text = `${item.title || ''} ${item.text || ''}`;
      if (item.restricted) return { ok: false, why: 'the source marks it as restricted (personality or trademark rights)' };
      if (REFS_PEOPLE.test(text)) return { ok: false, why: 'a person seems to be the subject' };
      if (REFS_BRANDS.test(text)) return { ok: false, why: 'it shows a brand or logo' };
      if (REFS_CHARACTERS.test(text)) return { ok: false, why: 'it shows a famous character' };
      if (REFS_ARTWORK.test(text) && !(REFS_MUSEUM_PD.includes(item.sourceId) && ['pd', 'pdm', 'cc0'].includes(item.licence))) return { ok: false, why: 'it is a photo of someone else\'s artwork' };
      if (typeof REFP_UNSAFE !== 'undefined' && REFP_UNSAFE.test(text)) return { ok: false, why: 'not for all ages' };
      return { ok: true, why: '' };
    }

// Both gates at once: may he paint from it?
function refPaintable(item) {
      return refLicenceOk(item) && refRiskOk(item).ok;
    }

// --- Small helpers ----------------------------------------------------------------------------------------
function refsUrl(u, hosts = null, base = undefined) {
      return typeof refpSafeUrl === 'function' ? refpSafeUrl(u, hosts, base) : null;
    }

function refsText(v, max = 160) {
      if (Array.isArray(v)) v = v.filter(x => typeof x === 'string').join(', ');
      return typeof refpPlain === 'function' ? refpPlain(v, max) : String(v || '').slice(0, max);
    }

async function refsJSON(url, opts = {}) {
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctl ? setTimeout(() => ctl.abort(), REFS_TIMEOUT_MS) : null;
      try {
        const res = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', ...opts, signal: ctl ? ctl.signal : undefined });
        if (res.status === 429 || res.status === 403) { const e = new Error('rate-limited'); e.rest = res.status === 429 ? 10 * 60000 : 30 * 60000; throw e; }
        if (!res.ok) throw new Error(`status ${res.status}`);
        return await res.json();
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

function refsItem(o) {
      const item = {
        sourceId: o.sourceId, source: o.source, title: refsText(o.title, 140) || 'Untitled', author: refsText(o.author, 80),
        licence: o.licence || null, licenceLabel: '', licenceUrl: refsUrl(o.licenceUrl) || '', pageUrl: refsUrl(o.pageUrl) || '',
        thumbUrl: refsUrl(o.thumbUrl, o.hosts) || '', imageUrl: refsUrl(o.imageUrl, o.hosts) || '', text: refsText(o.text, 400),
        lookOnly: Boolean(o.lookOnly), restricted: Boolean(o.restricted), via: o.via || 'web',
        downloadLocation: refsUrl(o.downloadLocation, ['api.unsplash.com']) || ''
      };
      item.licenceLabel = o.licenceLabel ? refsText(o.licenceLabel, 40) : (REFS_LICENCE_LABEL[item.licence] || (item.lookOnly ? 'licence unknown (looking only)' : 'unknown'));
      return item;
    }

// --- The adapters -------------------------------------------------------------------------------------------
const REFS_SOURCES = [
  {
    id: 'ddg', name: 'DuckDuckGo', imageHosts: ['duckduckgo.com'], lookOnly: true,
    async search(q, page) {
      // Image results where the platform allows them (desktop / phone), Instant Answer pictures elsewhere.
      // Their licence is unknown: he only looks at these, and never paints from their pixels.
      let list = [];
      const plat = typeof refpPlatform === 'function' ? refpPlatform() : 'web';
      if (plat === 'desktop') list = await refpSearchDesktop(q);
      else if (plat === 'native') list = await refpSearchNative(q);
      if (!list.length && page === 1) list = await refpSearchInstant(q);
      return { items: list.map(c => refsItem({ sourceId: 'ddg', source: c.source || 'DuckDuckGo', title: c.title, pageUrl: c.pageUrl, thumbUrl: c.thumbUrl || c.imageUrl, imageUrl: c.imageUrl, lookOnly: true, via: c.via, text: c.title })), more: false };
    }
  },
  {
    id: 'commons', name: 'Wikimedia Commons', imageHosts: ['upload.wikimedia.org'],
    async search(q, page) {
      const off = (page - 1) * 20;
      const params = `action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=20&gsroffset=${off}&gsrsearch=${encodeURIComponent(q + ' filetype:bitmap')}`
        + '&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=640&iiextmetadatafilter=LicenseShortName|License|LicenseUrl|UsageTerms|Artist|Credit|AttributionRequired|Restrictions|ObjectName|Categories|ImageDescription|NonFree|Copyrighted';
      const d = await refsJSON(`https://commons.wikimedia.org/w/api.php?${params}`);
      const pages = Object.values((d && d.query && d.query.pages) || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
      const items = [];
      pages.forEach(p => {
        const ii = p && Array.isArray(p.imageinfo) ? p.imageinfo[0] : null;
        if (!ii || !/^image\/(jpeg|png|webp)$/i.test(String(ii.mime || '')) || (ii.width || 0) < 300) return;
        const meta = ii.extmetadata || {};
        const val = k => refsText(meta[k] && meta[k].value, 300);
        const nonFree = /true/i.test(val('NonFree'));
        items.push(refsItem({
          sourceId: 'commons', source: 'Wikimedia Commons', hosts: ['upload.wikimedia.org'],
          title: String(p.title || '').replace(/^File:/i, '').replace(/\.(jpe?g|png|webp|tiff?)$/i, '').replace(/_/g, ' '),
          author: val('Artist') || val('Credit'), licence: nonFree ? null : refsNormaliseLicence(`${val('LicenseShortName')} ${val('License')}`, val('LicenseUrl')),
          licenceLabel: val('LicenseShortName'), licenceUrl: val('LicenseUrl'),
          pageUrl: refsUrl(ii.descriptionurl, ['commons.wikimedia.org']), thumbUrl: ii.thumburl, imageUrl: ii.url,
          text: `${val('Categories')} ${val('ImageDescription')} ${val('ObjectName')}`, restricted: Boolean(val('Restrictions'))
        }));
      });
      return { items, more: Boolean(d && d.continue) };
    }
  },
  {
    id: 'openverse', name: 'Openverse', imageHosts: ['api.openverse.org'],
    async search(q, page) {
      // Only licences that allow commercial use and changes; anonymous use is rate limited (we back off on 429)
      const d = await refsJSON(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license_type=commercial,modification&mature=false&page_size=20&page=${page}`);
      const items = (d && Array.isArray(d.results) ? d.results : []).filter(r => !r.mature).map(r => refsItem({
        sourceId: 'openverse', source: `Openverse${r.provider ? ` (${refsText(r.provider, 30)})` : ''}`, hosts: ['api.openverse.org'],
        title: r.title, author: r.creator, licence: refsNormaliseLicence(r.license === 'pdm' ? 'pdm' : r.license === 'cc0' ? 'cc0' : r.license, r.license_url),
        licenceLabel: r.license === 'cc0' ? 'CC0' : r.license === 'pdm' ? 'Public Domain Mark' : `CC ${String(r.license || '').toUpperCase()} ${r.license_version || ''}`.trim(), licenceUrl: r.license_url,
        pageUrl: r.foreign_landing_url, thumbUrl: r.id ? `https://api.openverse.org/v1/images/${encodeURIComponent(r.id)}/thumb/` : '', imageUrl: '',
        text: (Array.isArray(r.tags) ? r.tags.map(t => t && t.name).filter(Boolean).join(' ') : '')
      }));
      return { items, more: Boolean(d && d.page_count > page) };
    }
  },
  {
    id: 'met', name: 'The Met', imageHosts: ['images.metmuseum.org'],
    idCache: {},
    async search(q, page) {
      // The search gives object ids; each object is read only as its page comes up (nothing preloaded)
      let ids = this.idCache[q];
      if (!ids) {
        const d = await refsJSON(`https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(q)}`);
        ids = this.idCache[q] = (d && Array.isArray(d.objectIDs) ? d.objectIDs : []).slice(0, 400);
      }
      const slice = ids.slice((page - 1) * 8, page * 8);
      const objs = await Promise.all(slice.map(id => refsJSON(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${Number(id)}`).catch(() => null)));
      const items = objs.filter(o => o && o.isPublicDomain === true && o.primaryImageSmall).map(o => refsItem({
        sourceId: 'met', source: 'The Met', hosts: ['images.metmuseum.org'], title: o.title, author: o.artistDisplayName || o.culture || '',
        licence: 'cc0', licenceLabel: 'CC0 (Met Open Access)', licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
        pageUrl: o.objectURL, thumbUrl: o.primaryImageSmall, imageUrl: o.primaryImageSmall,
        text: `${o.classification || ''} ${o.objectName || ''} ${(Array.isArray(o.tags) ? o.tags.map(t => t && t.term).join(' ') : '')}`
      }));
      return { items, more: ids.length > page * 8 };
    }
  },
  {
    id: 'aic', name: 'Art Institute of Chicago', imageHosts: ['www.artic.edu'],
    async search(q, page) {
      const fields = 'id,title,artist_display,image_id,is_public_domain,term_titles,classification_titles,subject_titles';
      const d = await refsJSON(`https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(q)}&query[term][is_public_domain]=true&fields=${fields}&limit=20&page=${page}`);
      const iiif = refsUrl(d && d.config && d.config.iiif_url, ['www.artic.edu']) || 'https://www.artic.edu/iiif/2';
      const items = (d && Array.isArray(d.data) ? d.data : []).filter(a => a && a.is_public_domain === true && a.image_id).map(a => refsItem({
        sourceId: 'aic', source: 'Art Institute of Chicago', hosts: ['www.artic.edu'], title: a.title, author: String(a.artist_display || '').split('\n')[0],
        licence: 'cc0', licenceLabel: 'CC0 (AIC public domain)', licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
        pageUrl: `https://www.artic.edu/artworks/${Number(a.id)}`, thumbUrl: `${iiif}/${encodeURIComponent(a.image_id)}/full/843,/0/default.jpg`,
        text: `${(a.classification_titles || []).join(' ')} ${(a.term_titles || []).join(' ')} ${(a.subject_titles || []).join(' ')}`
      }));
      const pg = d && d.pagination;
      return { items, more: Boolean(pg && pg.total_pages > page) };
    }
  },
  {
    id: 'cma', name: 'Cleveland Museum of Art', imageHosts: ['openaccess-cdn.clevelandart.org'],
    async search(q, page) {
      const d = await refsJSON(`https://openaccess-api.clevelandart.org/api/artworks/?q=${encodeURIComponent(q)}&cc0=1&has_image=1&limit=20&skip=${(page - 1) * 20}`);
      const items = (d && Array.isArray(d.data) ? d.data : []).filter(a => a && String(a.share_license_status || '').toUpperCase() === 'CC0').map(a => {
        const img = a.images && (a.images.web || a.images.print);
        return refsItem({
          sourceId: 'cma', source: 'Cleveland Museum of Art', hosts: ['openaccess-cdn.clevelandart.org'], title: a.title,
          author: Array.isArray(a.creators) && a.creators[0] ? a.creators[0].description : '', licence: 'cc0', licenceLabel: 'CC0',
          licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', pageUrl: a.url, thumbUrl: img && img.url, imageUrl: img && img.url,
          text: `${a.type || ''} ${a.technique || ''} ${(a.description || '').slice(0, 200)}`
        });
      });
      const total = d && d.info && d.info.total;
      return { items, more: Boolean(total && total > page * 20) };
    }
  },
  {
    id: 'nasa', name: 'NASA Image Library', imageHosts: ['images-assets.nasa.gov'],
    async search(q, page) {
      const d = await refsJSON(`https://images-api.nasa.gov/search?q=${encodeURIComponent(q)}&media_type=image&page=${page}`);
      const list = d && d.collection && Array.isArray(d.collection.items) ? d.collection.items : [];
      const items = [];
      list.forEach(it => {
        const m = Array.isArray(it.data) ? it.data[0] : null;
        const link = Array.isArray(it.links) ? it.links.find(l => l && l.render === 'image') || it.links[0] : null;
        if (!m || !link) return;
        // NASA's own work is public domain; a third party's photographer or credit is not
        const credit = `${m.photographer || ''} ${m.secondary_creator || ''}`;
        const desc = `${m.description || ''}`;
        const thirdParty = (credit.trim() && !/\bnasa\b|jpl|goddard|johnson space|kennedy space|marshall|ames|glenn|langley|armstrong|stennis/i.test(credit))
          || /©|copyright|courtesy of|credit:\s*(?!nasa)/i.test(desc);
        items.push(refsItem({
          sourceId: 'nasa', source: 'NASA Image Library', hosts: ['images-assets.nasa.gov'], title: m.title, author: m.photographer || m.center || 'NASA',
          licence: thirdParty ? null : 'pd', licenceLabel: thirdParty ? 'third-party credit' : 'Public domain (NASA)', licenceUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
          pageUrl: m.nasa_id ? `https://images.nasa.gov/details/${encodeURIComponent(m.nasa_id)}` : '', thumbUrl: String(link.href || '').replace(/~thumb\.jpg$/, '~medium.jpg'),
          text: `${(m.keywords || []).join(' ')} ${desc.slice(0, 300)}`
        }));
      });
      const next = d && d.collection && Array.isArray(d.collection.links) && d.collection.links.some(l => l && l.rel === 'next');
      return { items, more: Boolean(next) };
    }
  },
  {
    id: 'loc', name: 'Library of Congress', imageHosts: ['tile.loc.gov'],
    async search(q, page) {
      // Only if loc.gov answers this page (CORS); if it doesn't, the fetch fails and the source is rested
      const d = await refsJSON(`https://www.loc.gov/photos/?q=${encodeURIComponent(q)}&fo=json&c=20&sp=${page}`);
      const items = (d && Array.isArray(d.results) ? d.results : []).map(r => {
        const rights = `${r.rights_advisory || ''} ${r.rights || ''} ${(r.item && r.item.rights_advisory) || ''}`;
        const img = Array.isArray(r.image_url) ? r.image_url.find(u => /tile\.loc\.gov/.test(u)) : '';
        return refsItem({
          sourceId: 'loc', source: 'Library of Congress', hosts: ['tile.loc.gov'], title: r.title, author: Array.isArray(r.contributor) ? r.contributor[0] : '',
          licence: /no known restrictions|public domain/i.test(rights) ? 'pd' : null, licenceLabel: /no known restrictions/i.test(rights) ? 'No known restrictions' : refsText(rights, 40),
          pageUrl: r.url || r.id, thumbUrl: img, imageUrl: img, text: `${(r.subject || []).join(' ')} ${(r.description || []).join(' ')}`
        });
      });
      const pg = d && d.pagination;
      return { items, more: Boolean(pg && pg.next) };
    }
  },
  // --- With a key the owner added in Settings ---
  {
    id: 'pexels', name: 'Pexels', key: 'pexels', imageHosts: ['images.pexels.com'],
    async search(q, page) {
      const d = await refsJSON(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=20&page=${page}`, { headers: { Authorization: refsKey('pexels') } });
      const items = (d && Array.isArray(d.photos) ? d.photos : []).map(p => refsItem({
        sourceId: 'pexels', source: 'Pexels', hosts: ['images.pexels.com'], title: p.alt, author: p.photographer, licence: 'pexels',
        licenceUrl: 'https://www.pexels.com/license/', pageUrl: p.url, thumbUrl: p.src && p.src.medium, imageUrl: p.src && p.src.large, text: p.alt
      }));
      return { items, more: Boolean(d && d.next_page) };
    }
  },
  {
    id: 'unsplash', name: 'Unsplash', key: 'unsplash', imageHosts: ['images.unsplash.com'],
    async search(q, page) {
      const d = await refsJSON(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=20&page=${page}&content_filter=high`, { headers: { Authorization: `Client-ID ${refsKey('unsplash')}`, 'Accept-Version': 'v1' } });
      const items = (d && Array.isArray(d.results) ? d.results : []).map(p => refsItem({
        sourceId: 'unsplash', source: 'Unsplash', hosts: ['images.unsplash.com'], title: p.alt_description || p.description, author: p.user && p.user.name,
        licence: 'unsplash', licenceUrl: 'https://unsplash.com/license', pageUrl: p.links && p.links.html, downloadLocation: p.links && p.links.download_location, thumbUrl: p.urls && p.urls.small, imageUrl: p.urls && p.urls.regular,
        text: `${(Array.isArray(p.tags) ? p.tags.map(t => t && t.title).join(' ') : '')} ${p.description || ''}`
      }));
      return { items, more: Boolean(d && d.total_pages > page) };
    }
  },
  {
    id: 'pixabay', name: 'Pixabay', key: 'pixabay', imageHosts: ['pixabay.com', 'cdn.pixabay.com'],
    async search(q, page) {
      const d = await refsJSON(`https://pixabay.com/api/?key=${encodeURIComponent(refsKey('pixabay'))}&q=${encodeURIComponent(q.slice(0, 90))}&image_type=photo&safesearch=true&per_page=20&page=${page}`);
      const items = (d && Array.isArray(d.hits) ? d.hits : []).map(h => refsItem({
        sourceId: 'pixabay', source: 'Pixabay', hosts: ['pixabay.com', 'cdn.pixabay.com'], title: h.tags, author: h.user, licence: 'pixabay',
        licenceUrl: 'https://pixabay.com/service/license-summary/', pageUrl: h.pageURL, thumbUrl: h.webformatURL, imageUrl: h.webformatURL, text: h.tags
      }));
      return { items, more: Boolean(d && d.totalHits > page * 20) };
    }
  },
  {
    id: 'flickr', name: 'Flickr', key: 'flickr', imageHosts: ['live.staticflickr.com'],
    async search(q, page) {
      // Licence ids: 4 CC BY, 5 CC BY-SA, 9 CC0, 10 Public Domain Mark (nothing else)
      const d = await refsJSON(`https://api.flickr.com/services/rest/?method=flickr.photos.search&api_key=${encodeURIComponent(refsKey('flickr'))}&text=${encodeURIComponent(q)}&license=4,5,9,10&safe_search=1&content_type=1&media=photos&extras=license,owner_name,url_m,tags,description&per_page=20&page=${page}&format=json&nojsoncallback=1`);
      const ids = { 4: 'by', 5: 'by-sa', 9: 'cc0', 10: 'pdm' };
      const ph = d && d.photos;
      const items = (ph && Array.isArray(ph.photo) ? ph.photo : []).map(p => refsItem({
        sourceId: 'flickr', source: 'Flickr', hosts: ['live.staticflickr.com'], title: p.title, author: p.ownername, licence: ids[Number(p.license)] || null,
        pageUrl: p.owner && p.id ? `https://www.flickr.com/photos/${encodeURIComponent(p.owner)}/${encodeURIComponent(p.id)}` : '', thumbUrl: p.url_m, imageUrl: p.url_m,
        text: `${p.tags || ''} ${(p.description && p.description._content) || ''}`
      }));
      return { items, more: Boolean(ph && ph.pages > page) };
    }
  },
  {
    id: 'smithsonian', name: 'Smithsonian Open Access', key: 'smithsonian', imageHosts: ['ids.si.edu'],
    async search(q, page) {
      const d = await refsJSON(`https://api.si.edu/openaccess/api/v1.0/search?q=${encodeURIComponent(q + ' AND online_media_type:"Images"')}&rows=20&start=${(page - 1) * 20}&api_key=${encodeURIComponent(refsKey('smithsonian'))}`);
      const rows = d && d.response && Array.isArray(d.response.rows) ? d.response.rows : [];
      const items = [];
      rows.forEach(r => {
        const c = r.content || {}, dn = c.descriptiveNonRepeating || {};
        const media = dn.online_media && Array.isArray(dn.online_media.media) ? dn.online_media.media.find(m => m && m.usage && m.usage.access === 'CC0') : null;
        if (!media) return;
        items.push(refsItem({
          sourceId: 'smithsonian', source: 'Smithsonian Open Access', hosts: ['ids.si.edu'], title: r.title, author: dn.data_source || '',
          licence: 'cc0', licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', pageUrl: dn.record_link || dn.guid, thumbUrl: media.thumbnail, imageUrl: media.thumbnail,
          text: JSON.stringify(c.indexedStructured && c.indexedStructured.topic || '')
        }));
      });
      return { items, more: Boolean(d && d.response && d.response.rowCount > page * 20) };
    }
  },
  {
    id: 'europeana', name: 'Europeana', key: 'europeana', imageHosts: ['api.europeana.eu'],
    async search(q, page) {
      const d = await refsJSON(`https://api.europeana.eu/record/v2/search.json?wskey=${encodeURIComponent(refsKey('europeana'))}&query=${encodeURIComponent(q)}&reusability=open&media=true&qf=TYPE:IMAGE&rows=20&start=${(page - 1) * 20 + 1}`);
      const items = (d && Array.isArray(d.items) ? d.items : []).map(it => {
        const rights = Array.isArray(it.rights) ? it.rights[0] : '';
        return refsItem({
          sourceId: 'europeana', source: `Europeana${it.dataProvider ? ` (${refsText(it.dataProvider, 40)})` : ''}`, hosts: ['api.europeana.eu'], title: Array.isArray(it.title) ? it.title[0] : it.title,
          author: Array.isArray(it.dcCreator) ? it.dcCreator[0] : '', licence: refsNormaliseLicence('', rights), licenceUrl: rights,
          pageUrl: it.guid, thumbUrl: Array.isArray(it.edmPreview) ? it.edmPreview[0] : '', text: `${(it.dcSubjectLangAware && JSON.stringify(it.dcSubjectLangAware)) || ''}`
        });
      });
      return { items, more: Boolean(d && d.totalResults > page * 20) };
    }
  },
  {
    id: 'rijks', name: 'Rijksmuseum', key: 'rijksmuseum', imageHosts: ['lh3.googleusercontent.com'],
    async search(q, page) {
      const d = await refsJSON(`https://www.rijksmuseum.nl/api/en/collection?key=${encodeURIComponent(refsKey('rijksmuseum'))}&q=${encodeURIComponent(q)}&imgonly=true&ps=20&p=${page}`);
      // permitDownload is set only for the public-domain images
      const items = (d && Array.isArray(d.artObjects) ? d.artObjects : []).filter(a => a && a.permitDownload === true && a.webImage).map(a => refsItem({
        sourceId: 'rijks', source: 'Rijksmuseum', hosts: ['lh3.googleusercontent.com'], title: a.title, author: a.principalOrFirstMaker, licence: 'pd', licenceLabel: 'Public domain (Rijksmuseum)',
        pageUrl: a.links && a.links.web, thumbUrl: a.webImage.url ? `${a.webImage.url.replace(/=s\d+$/, '')}=s640` : '', text: a.longTitle || ''
      }));
      return { items, more: Boolean(d && d.count > page * 20) };
    }
  }
];

// The image hosts the web page may fetch pictures from (the same exact hosts as the CSP connect-src)
function refsImageHosts() {
      return [...new Set(REFS_SOURCES.flatMap(s => s.imageHosts || []))];
    }

function refsAvailable({ paintableOnly = false } = {}) {
      const now = Date.now();
      return REFS_SOURCES.filter(s => (!s.key || refsKey(s.key)) && !(refsRestUntil[s.id] > now) && !(paintableOnly && s.lookOnly));
    }

// One page of one source, safely: a failure or a rate limit rests that source and returns nothing
async function refsSearchSource(src, query, page) {
      try {
        const r = await src.search(query, page);
        return { items: (r.items || []).filter(i => i.thumbUrl || i.imageUrl), more: Boolean(r.more) };
      } catch (e) {
        refsRestUntil[src.id] = Date.now() + (e && e.rest ? e.rest : 3 * 60000);
        return { items: [], more: false, error: e && e.message === 'rate-limited' ? 'rate-limited' : 'failed' };
      }
    }

// A browsing cursor: pages through every source in a rotating order, one page at a time, without end
// (until every source runs dry). next() -> { items, source } or null when there is nothing more.
function refsCursor(query, { paintableOnly = false, exclude = [] } = {}) {
      const order = refsAvailable({ paintableOnly }).filter(s => !exclude.includes(s.id));
      // rotate the starting source between searches so browsing feels varied (DuckDuckGo stays first where usable)
      const ddg = order.filter(s => s.id === 'ddg'), rest = order.filter(s => s.id !== 'ddg');
      const start = rest.length ? refsTurn++ % rest.length : 0;
      const rotated = [...ddg, ...rest.slice(start), ...rest.slice(0, start)];
      const state = rotated.map(s => ({ src: s, page: 1, done: false }));
      let i = 0;
      return {
        sources: rotated.map(s => s.name),
        async next() {
          for (let tries = 0; tries < state.length * 2; tries++) {
            const live = state.filter(x => !x.done);
            if (!live.length) return null;
            const cur = live[i++ % live.length];
            if (refsRestUntil[cur.src.id] > Date.now()) { cur.done = true; continue; }
            const r = await refsSearchSource(cur.src, query, cur.page);
            cur.page++;
            if (!r.more || cur.page > 200) cur.done = true;
            const items = paintableOnly ? r.items.filter(refPaintable) : r.items;
            if (items.length) return { items, source: cur.src.name, sourceId: cur.src.id, page: cur.page - 1 };
          }
          return null;
        }
      };
    }

// Optional keys: called by the settings code (js/main.js) when keys load or change
function refsSetKeys(keys) {
      const next = {};
      REFS_KEY_NAMES.forEach(k => { if (keys && typeof keys[k] === 'string' && keys[k].trim()) next[k] = keys[k].trim().slice(0, 300); });
      refsKeys = next;
    }

// Unsplash asks that a photo actually used is reported to its download endpoint (no picture is sent)
function refsReportUse(item) {
      if (!item || item.sourceId !== 'unsplash' || !refsKey('unsplash') || !item.downloadLocation) return;
      const u = refsUrl(item.downloadLocation, ['api.unsplash.com']);
      if (u) fetch(u, { headers: { Authorization: `Client-ID ${refsKey('unsplash')}` }, credentials: 'omit' }).catch(() => {});
    }
