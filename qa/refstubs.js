// Stubbed photo sources for the refpaint and photobrowse scenarios (qa/harness.js). Every source answers in
// its documented shape with fixture metadata: for each query, one item that must be REFUSED (bad licence,
// a person, a brand...) and one that is fine, three pages deep. Pictures are the files in fixtures/refpaint.
const path = require('path'), fs = require('fs');
const FXD = path.join(__dirname, 'fixtures', 'refpaint');
const FX = { cat: 'chelsea.png', coffee: 'coffee.png', cup: 'coffee.png', rocket: 'rocket.jpg', venice: 'venice_sunset.jpg', harbour: 'venice_sunset.jpg', beach: 'quarry_01.jpg', quarry: 'quarry_01.jpg', field: 'moonless_golf.jpg', night: 'moonless_golf.jpg' };
const fileFor = q => { const k = Object.keys(FX).find(k => String(q).toLowerCase().includes(k)); return k ? FX[k] : 'quarry_01.jpg'; };
const IMAGE_HOSTS = ['upload.wikimedia.org', 'api.openverse.org/v1/images/', 'images.metmuseum.org', 'www.artic.edu/iiif', 'openaccess-cdn.clevelandart.org', 'images-assets.nasa.gov', 'tile.loc.gov', 'images.pexels.com', 'images.unsplash.com', 'cdn.pixabay.com', 'live.staticflickr.com', 'ids.si.edu', 'api.europeana.eu/thumbnail', 'lh3.googleusercontent.com', 'duckduckgo.com/i/'];
const PAGES = 3;
const log = [];

function json(route, body) { return route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' } }); }
function image(route, u) {
  const f = (u.match(/fx-([a-z_0-9]+\.(?:png|jpg))/) || [])[1] || 'quarry_01.jpg';
  return route.fulfill({ path: path.join(FXD, f), contentType: f.endsWith('.png') ? 'image/png' : 'image/jpeg', headers: { 'Access-Control-Allow-Origin': '*' } });
}

// Returns true if it handled the request
function handle(route, u) {
  if (process.env.REFP_OFFLINE && /duckduckgo|wikimedia|openverse|metmuseum|artic\.edu|clevelandart|nasa\.gov|loc\.gov|pexels|unsplash|pixabay|flickr|si\.edu|europeana|rijksmuseum|googleusercontent/.test(u)) { route.abort('internetdisconnected'); return true; }
  if (IMAGE_HOSTS.some(h => u.startsWith('https://' + h)) && !/\/v1\/images\/\?/.test(u)) { log.push(u); image(route, u); return true; }
  let U;
  try { U = new URL(u); } catch (e) { return false; }
  const P = U.searchParams;
  const q = P.get('q') || P.get('query') || P.get('text') || P.get('srsearch') || P.get('gsrsearch') || '';
  const f = fileFor(q);
  const say = (body) => { log.push(u); json(route, body); return true; };
  switch (U.hostname) {
    case 'api.duckduckgo.com':
      return say(/\bcat\b/i.test(q) ? { Heading: 'Cat', Image: `/i/fx-${f}`, AbstractURL: 'https://en.wikipedia.org/wiki/Cat', RelatedTopics: [] } : { Heading: '', Image: '', RelatedTopics: [] });
    case 'commons.wikimedia.org': {
      const page = Math.floor((+P.get('gsroffset') || 0) / 20) + 1;
      const ii = (title, lic, extra = {}) => ({ mime: 'image/jpeg', width: 1024, height: 680, thumburl: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/fx-${f}/640px-fx-${f}`, url: `https://upload.wikimedia.org/wikipedia/commons/a/ab/fx-${f}`,
        descriptionurl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title)}.jpg`, extmetadata: { LicenseShortName: { value: lic }, LicenseUrl: { value: lic.startsWith('CC BY-SA') ? 'https://creativecommons.org/licenses/by-sa/4.0' : '' }, Artist: { value: '<a href="javascript:alert(1)">Ann <script>x</script>Fixture</a>' }, ...extra } });
      return say({ continue: page < PAGES ? { gsroffset: page * 20 } : undefined, query: { pages: {
        1: { index: 1, title: `File:${q} nc ${page}.jpg`, imageinfo: [ii(`${q} nc ${page}`, 'CC BY-NC 2.0')] },
        2: { index: 2, title: `File:Portrait of a woman with ${q} ${page}.jpg`, imageinfo: [ii('portrait', 'CC0')] },
        3: { index: 3, title: `File:${q} restricted ${page}.jpg`, imageinfo: [ii('restricted', 'CC BY 4.0', { Restrictions: { value: 'trademarked' } })] },
        4: { index: 4, title: `File:${q} commons ${page}.jpg`, imageinfo: [ii(`${q} commons ${page}`, 'CC BY-SA 4.0')] } } } });
    }
    case 'api.openverse.org': {
      const page = +P.get('page') || 1;
      if (!/commercial/.test(P.get('license_type') || '') || !/modification/.test(P.get('license_type') || '')) return say({ results: [], page_count: 0, error: 'test: license_type missing' });
      return say({ page_count: PAGES, results: [
        { id: `ov-logo-${page}`, title: `Coca-Cola logo ${q}`, creator: 'X', license: 'cc0', license_url: 'https://creativecommons.org/publicdomain/zero/1.0/', foreign_landing_url: 'https://example.org/logo', tags: [{ name: 'logo' }] },
        { id: `ov-${page}-fx-${f}`, title: `${q} openverse ${page}`, creator: 'Olu Fixture', license: 'by', license_version: '2.0', license_url: 'https://creativecommons.org/licenses/by/2.0/', foreign_landing_url: `https://www.flickr.com/photos/x/${page}`, provider: 'flickr', tags: [{ name: q }] }
      ] });
    }
    case 'collectionapi.metmuseum.org':
      if (U.pathname.endsWith('/search')) return say({ total: PAGES * 8, objectIDs: Array.from({ length: PAGES * 8 }, (_, i) => i + 1) });
      { const id = +U.pathname.split('/').pop(); return say({ objectID: id, isPublicDomain: id % 2 === 0, primaryImageSmall: `https://images.metmuseum.org/CRDImages/fx-${f}`, title: `${q} met ${id}`, artistDisplayName: 'Unknown', objectURL: `https://www.metmuseum.org/art/collection/search/${id}`, classification: 'Photographs', tags: [{ term: q }] }); }
    case 'api.artic.edu': {
      const page = +P.get('page') || 1;
      return say({ pagination: { total_pages: PAGES }, config: { iiif_url: 'https://www.artic.edu/iiif/2' }, data: [
        { id: page * 10 + 1, title: `${q} aic not pd ${page}`, image_id: `fx-${f}`, is_public_domain: false, artist_display: 'Someone' },
        { id: page * 10 + 2, title: `${q} aic ${page}`, image_id: `fx-${f}`, is_public_domain: true, artist_display: 'Old Master\nDutch, 1600', classification_titles: ['print'] }
      ] });
    }
    case 'openaccess-api.clevelandart.org': {
      const skip = +P.get('skip') || 0;
      return say({ info: { total: PAGES * 20 }, data: [
        { id: skip + 1, title: `${q} cma copyrighted`, share_license_status: 'Copyrighted', images: { web: { url: `https://openaccess-cdn.clevelandart.org/x/fx-${f}` } }, url: 'https://clevelandart.org/art/1' },
        { id: skip + 2, title: `${q} cma ${skip / 20 + 1}`, share_license_status: 'CC0', creators: [{ description: 'Anonymous' }], images: { web: { url: `https://openaccess-cdn.clevelandart.org/y/fx-${f}` } }, url: `https://clevelandart.org/art/${skip + 2}`, type: 'Photograph' }
      ] });
    }
    case 'images-api.nasa.gov': {
      const page = +P.get('page') || 1;
      const it = (id, extra) => ({ data: [{ nasa_id: id, title: `${q} nasa ${id}`, description: 'A view.', center: 'KSC', keywords: [q], ...extra }], links: [{ href: `https://images-assets.nasa.gov/image/${id}/fx-${f}~thumb.jpg`.replace(`fx-${f}~thumb.jpg`, `fx-${f}`), render: 'image' }] });
      return say({ collection: { items: [it(`third${page}`, { secondary_creator: 'Jane Photographer', description: '© Jane Photographer' }), it(`own${page}`, { photographer: 'NASA/Kim Shiflett' })], links: page < PAGES ? [{ rel: 'next' }] : [] } });
    }
    case 'www.loc.gov': {
      const sp = +P.get('sp') || 1;
      return say({ pagination: { next: sp < PAGES ? 'more' : null }, results: [
        { title: `${q} loc unevaluated`, rights_advisory: 'Rights status not evaluated', image_url: [`https://tile.loc.gov/a/fx-${f}`], url: 'https://www.loc.gov/item/1/' },
        { title: `${q} loc ${sp}`, rights_advisory: 'No known restrictions on publication.', image_url: [`https://tile.loc.gov/b/fx-${f}`], url: `https://www.loc.gov/item/${sp + 1}/`, subject: [q] }
      ] });
    }
    case 'api.pexels.com': {
      if (!route.request().headers()['authorization']) return say({ photos: [] });
      const page = +P.get('page') || 1;
      return say({ next_page: page < PAGES ? 'x' : null, photos: [{ alt: `${q} pexels ${page}`, url: `https://www.pexels.com/photo/${page}/`, photographer: 'Pat Pexels', src: { medium: `https://images.pexels.com/p/fx-${f}` } }] });
    }
    case 'api.unsplash.com': {
      const page = +P.get('page') || 1;
      return say({ total_pages: PAGES, results: [{ alt_description: `${q} unsplash ${page}`, user: { name: 'Uma Unsplash' }, links: { html: `https://unsplash.com/photos/${page}` }, urls: { small: `https://images.unsplash.com/p/fx-${f}` } }] });
    }
    case 'pixabay.com': {
      const page = +P.get('page') || 1;
      return say({ totalHits: PAGES * 20, hits: [{ tags: `${q}, pixabay ${page}`, user: 'pix', pageURL: `https://pixabay.com/photos/${page}/`, webformatURL: `https://cdn.pixabay.com/photo/fx-${f}` }] });
    }
    case 'api.flickr.com': {
      const page = +P.get('page') || 1;
      if ((P.get('license') || '') !== '4,5,9,10') return say({ photos: { pages: 0, photo: [] } });
      return say({ photos: { pages: PAGES, photo: [
        { id: `nc${page}`, owner: 'o', title: `${q} flickr nc`, license: '1', ownername: 'N', url_m: `https://live.staticflickr.com/1/fx-${f}` },
        { id: `ok${page}`, owner: 'o', title: `${q} flickr ${page}`, license: '4', ownername: 'Flo Flickr', url_m: `https://live.staticflickr.com/2/fx-${f}` }] } });
    }
    case 'api.si.edu': {
      const start = +P.get('start') || 0;
      const row = (t, access) => ({ title: t, content: { descriptiveNonRepeating: { record_link: `https://collections.si.edu/${encodeURIComponent(t)}`, data_source: 'NASM', online_media: { media: [{ thumbnail: `https://ids.si.edu/ids/deliveryService?id=fx-${f}`, usage: { access } }] } } } });
      return say({ response: { rowCount: PAGES * 20, rows: [row(`${q} si restricted`, 'Usage conditions apply'), row(`${q} si ${start / 20 + 1}`, 'CC0')] } });
    }
    case 'api.europeana.eu': {
      const start = +P.get('start') || 1;
      return say({ totalResults: PAGES * 20, items: [
        { title: [`${q} europeana in copyright`], guid: 'https://www.europeana.eu/item/1', rights: ['http://rightsstatements.org/vocab/InC/1.0/'], edmPreview: [`https://api.europeana.eu/thumbnail/v2/url.json?uri=fx-${f}`] },
        { title: [`${q} europeana ${start}`], guid: `https://www.europeana.eu/item/${start}`, dcCreator: ['Eve'], rights: ['http://creativecommons.org/publicdomain/zero/1.0/'], edmPreview: [`https://api.europeana.eu/thumbnail/v2/url.json?uri=fx-${f}`] }] });
    }
    case 'www.rijksmuseum.nl': {
      const p = +P.get('p') || 1;
      return say({ count: PAGES * 20, artObjects: [
        { title: `${q} rijks no download`, principalOrFirstMaker: 'R', permitDownload: false, webImage: { url: `https://lh3.googleusercontent.com/fx-${f}` }, links: { web: 'https://www.rijksmuseum.nl/en/collection/1' } },
        { title: `${q} rijks ${p}`, principalOrFirstMaker: 'Rembrandt', permitDownload: true, webImage: { url: `https://lh3.googleusercontent.com/fx-${f}` }, links: { web: `https://www.rijksmuseum.nl/en/collection/${p}` } }] });
    }
  }
  return false;
}

module.exports = { handle, log };
