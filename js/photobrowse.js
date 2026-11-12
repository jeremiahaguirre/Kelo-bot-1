// Kelo-bot-1 — js/photobrowse.js
// Loaded after refpaint.js. A NetNode pastime: Kelo-1 sits at a cafe computer and pages through photos on a
// topic he is curious about (from his curiosities, his likes, his projects and the things he paints), for as
// long as he stays interested. Pages are fetched one at a time as he gets to them (nothing is preloaded),
// from every source in js/refsources.js in a rotating order. The cafe screen shows the photos he is looking at,
// his diary says what caught his eye, and the ones he loves go on his favourites board (the "Photos he liked"
// section of his Brain tab) with their credits. Free-to-use favourites can become paintings later; a
// DuckDuckGo favourite (licence unknown) is only an idea: he looks for a free photo of the same thing.
// Saves stay small: favourites keep a 96x72 thumbnail and the credit, at most PHOB_MAX_FAVS, and the oldest
// unpinned one goes when the board is full.

const PHOB_MAX_FAVS = 24;
const PHOB_THUMB_W = 96, PHOB_THUMB_H = 72;
const PHOB_CHANCE = 0.3;              // share of his NetNode visits spent browsing photos instead of articles
let phobScreenState = { photos: [], query: '', version: 0, at: 0 };

function phobFavourites() {
      if (!Array.isArray(state.photoFavourites)) state.photoFavourites = [];
      return state.photoFavourites;
    }

// What he feels like looking at: his own curiosities and interests first, then things worth painting
function phobPickTopic() {
      const projects = (state.projects || []).slice(0, 3).map(p => p && (p.name || p.title)).filter(Boolean);
      const pool = [
        ...(state.curiosityQueue || []).slice(0, 3),
        ...(state.likes || []).slice(0, 4).map(l => l.topic || l.item).filter(Boolean),
        ...projects,
        ...(state.webHistory || []).slice(0, 4).flatMap(w => (w.hops || []).slice(-1).map(h => h.title)),
        ...REFP_SUBJECTS, ...REFP_SETTINGS
      ];
      for (let i = 0; i < 6; i++) {
        const q = refpCleanQuery(pick(pool));
        if (q) return q;
      }
      return pick(REFP_SUBJECTS);
    }

// The cafe screen (js/interiors.js draws it): a grid of what he is looking at right now
async function phobShowOnScreen(items, query) {
      const photos = [];
      for (const it of (items || []).slice(0, 6)) {
        let c = it.canvas || null;
        if (!c) c = await refpLoadItem(it).catch(() => null);
        if (c) photos.push(c);
      }
      if (!photos.length) return 0;
      phobScreenState = { photos, query: String(query || '').slice(0, 60), version: phobScreenState.version + 1, at: Date.now() };
      return photos.length;
    }

// Draw the photo grid onto the cafe computer's screen canvas (called from interiorDrawScreen)
function phobDrawScreen(g, W, H) {
      const P = phobScreenState.photos;
      const cols = P.length > 4 ? 3 : 2, rows = Math.ceil(P.length / cols);
      const top = 82, gap = 4, cw = (W - 28 - gap * (cols - 1)) / cols, ch = Math.min(52, (H - top - 8 - gap * (rows - 1)) / rows);
      P.forEach((c, i) => {
        g.save();
        g.translate(14 + (i % cols) * (cw + gap), top + Math.floor(i / cols) * (ch + gap));
        g.beginPath(); g.rect(0, 0, cw, ch); g.clip();
        try { refpDrawCover(g, c, cw, ch, { x: 0.5, y: 0.5 }, 1); } catch (e) {}
        g.restore();
      });
    }

// A favourite: a small copy and its credit (never more than that)
function phobAddFavourite(item, canvas, why, query) {
      const favs = phobFavourites();
      const key = item.pageUrl || item.thumbUrl;
      if (!key || favs.some(f => (f.pageUrl || f.thumbUrl) === key)) return null;
      const t = artCanvas(PHOB_THUMB_W, PHOB_THUMB_H);
      refpDrawCover(t.getContext('2d'), canvas, PHOB_THUMB_W, PHOB_THUMB_H, { x: 0.5, y: 0.5 }, 1);
      const fav = {
        id: 'fav-' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36),
        title: String(item.title || '').slice(0, 140), author: String(item.author || '').slice(0, 80), source: String(item.source || '').slice(0, 60), sourceId: String(item.sourceId || '').slice(0, 20),
        licence: REFS_OK_LICENCES.includes(item.licence) ? item.licence : null, licenceLabel: String(item.licenceLabel || '').slice(0, 40), licenceUrl: refpSafeUrl(item.licenceUrl) || '',
        pageUrl: refpSafeUrl(item.pageUrl) || '', thumbUrl: refpSafeUrl(item.thumbUrl || item.imageUrl) || '', via: item.via === 'web' ? 'web' : String(item.via || 'web'),
        lookOnly: Boolean(item.lookOnly), paintable: refPaintable(item), query: String(query || '').slice(0, 60), why: String(why || '').slice(0, 160),
        thumb: t.toDataURL('image/jpeg', 0.7), at: Date.now(), pinned: false
      };
      favs.unshift(fav);
      // bounded: the oldest unpinned favourite goes when the board is full
      while (favs.length > PHOB_MAX_FAVS) {
        let k = -1;
        for (let i = favs.length - 1; i >= 0; i--) if (!favs[i].pinned) { k = i; break; }
        if (k < 0) { favs.pop(); continue; }
        favs.splice(k, 1);
      }
      return fav;
    }

// A favourite as a painting reference: its own picture when it is free to use, otherwise null (he then
// searches the licence-checked sources for the same thing)
async function phobFavouriteToRef(favOrId, query) {
      const fav = typeof favOrId === 'string' ? phobFavourites().find(f => f.id === favOrId) : favOrId;
      if (!fav || fav.lookOnly || !refPaintable({ ...fav, text: '' })) return null;
      const canvas = await refpLoadItem({ thumbUrl: fav.thumbUrl, via: fav.via === 'desktop' || fav.via === 'native' ? fav.via : 'web' });
      if (!canvas) return null;
      return { ...fav, query: query || fav.query, usedUrl: fav.thumbUrl, host: refpHostOf(fav.pageUrl), imageHost: refpHostOf(fav.thumbUrl), canvas, thumb: refpThumb(canvas) };
    }

// What caught his eye, in his words
function phobReaction(item, query) {
      const t = item.title && item.title !== 'Untitled' ? `"${item.title}"` : `a picture of ${query}`;
      return pick([
        `${t} from ${item.source} caught my eye: the shapes are simple and strong.`,
        `I kept coming back to ${t} (${item.source}). The light in it!`,
        `${t} on ${item.source} would make a good painting someday.`,
        `I liked ${t} from ${item.source}: the colours sit so well together.`
      ]);
    }

// The pastime itself. Returns the number of pages he looked at.
async function photoBrowse(topic = null, originLabel = 'Browsing Photos') {
      if (state.isBusy || state.isBrowsing || state.isBuilding || state.isPracticing || state.isSleeping) return 0;
      if (!refpOnline()) return 0;
      let query = refpCleanQuery(topic) || phobPickTopic();
      const cafe = TOWN_LOCATIONS.cyber;
      state.isBusy = true;
      state.isBrowsing = true;
      let pages = 0, seen = 0;
      const lines = [], favsAdded = [];
      try {
        state.currentLocKey = 'cyber';
        state.customPlaceName = null;
        state.targetPos = { x: cafe.x, z: cafe.z };
        state.microPose = 'normal';
        state.moodEmoji = '🖼️';
        state.moodTitle = `Looking up ${query} photos`.slice(0, 80);
        state.speechBubble = `I'm going to look at photos of "${query}" at NetNode for a while.`;
        renderAllUI();
        if (typeof waitForArrival === 'function') await waitForArrival(90000);
        await new Promise(r => setTimeout(r, 2000));
        let cursor = refsCursor(query);
        let keepGoing = true;
        while (keepGoing) {
          const page = await cursor.next();
          if (!page) break;
          pages++;
          seen += page.items.length;
          await phobShowOnScreen(page.items, query);
          state.moodTitle = `Looking up ${query} photos (${page.source}, page ${page.page})`.slice(0, 80);
          state.speechBubble = `Page ${page.page} of "${query}" on ${page.source}...`;
          renderAllUI();
          // what caught his eye on this page, and maybe a favourite
          const eye = pick(page.items.filter(i => refRiskOk(i).ok)) || null;
          if (eye) {
            const line = phobReaction(eye, query);
            lines.push(line);
            if (Math.random() < 0.4) {
              const canvas = await refpLoadItem(eye);
              const fav = canvas && phobAddFavourite(eye, canvas, line, query);
              if (fav) favsAdded.push(fav);
            }
          }
          if (typeof bumpLifeStat === 'function') bumpLifeStat('searches');
          await new Promise(r => setTimeout(r, 2500));
          // he keeps paging while he's interested; now and then a new topic grabs him
          const interest = 0.62 + (state.wonderLevel || 0) / 400 - pages * 0.03;
          keepGoing = Math.random() < interest && pages < 200;
          if (keepGoing && Math.random() < 0.15) {
            query = phobPickTopic();
            cursor = refsCursor(query);
            lines.push(`Then I wandered off to "${query}".`);
          }
        }
        state.webHistory.unshift({ query: `photos: ${query}`, time: 'Just now', verdict: pages ? `Looked through ${pages} page${pages === 1 ? '' : 's'} of photos (${seen} pictures).${favsAdded.length ? ` Saved ${favsAdded.length} to my favourites.` : ''}` : 'No photos would load.', hops: favsAdded.map(f => ({ title: f.title, url: f.pageUrl, extract: `${f.source} · ${f.licenceLabel || (f.lookOnly ? 'looking only' : '')}` })) });
        if (state.webHistory.length > MAX_WEB_HISTORY) state.webHistory.length = MAX_WEB_HISTORY;
        if (pages) {
          state.diaryEntries.unshift({
            time: originLabel, location: 'NetNode Cyber Cafe', mood: `🖼️ Browsed photos of "${query}"`.slice(0, 80), vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
            text: `Dear Diary, I spent a while at the NetNode cafe paging through photos (${pages} page${pages === 1 ? '' : 's'}, ${seen} pictures). ${lines.slice(0, 5).join(' ')}${favsAdded.length ? ` I pinned ${favsAdded.length === 1 ? 'one' : favsAdded.length} to my favourites board${favsAdded.some(f => f.paintable) ? ', and the free-to-use ones I might paint someday' : ''}.` : ''}`
          });
          state.wonderLevel = Math.min(100, (state.wonderLevel || 0) + 4);
          state.changedLatelySummary = `Browsed ${pages} pages of photos at NetNode`;
          showToast(`🖼️ Kelo-1 browsed ${pages} page${pages === 1 ? '' : 's'} of photos${favsAdded.length ? ` and saved ${favsAdded.length}` : ''}`);
        }
        savePersistentBrainState();
        renderAllUI();
        phobRenderBoard();
        return pages;
      } finally {
        state.isBusy = false;
        state.isBrowsing = false;
      }
    }

// His favourites board (Brain tab): small copies, credits, a pin. Everything escaped, links https only.
function phobRenderBoard() {
      const el = document.getElementById('photoFavouritesBoard');
      if (!el) return;
      const favs = phobFavourites();
      el.innerHTML = favs.length ? favs.map(f => {
        const thumb = /^data:image\/jpeg;base64,[a-z0-9+/=]+$/i.test(String(f.thumb || '')) ? `<img src="${escapeHtml(f.thumb)}" alt="${escapeHtml(f.title)}" class="w-full aspect-[4/3] object-cover rounded">` : '';
        const page = refpSafeUrl(f.pageUrl);
        const title = page ? `<a href="${escapeHtml(page)}" target="_blank" rel="noopener noreferrer" class="text-sky-300 hover:underline">${escapeHtml(f.title)}</a>` : escapeHtml(f.title);
        return `<div class="ui-card p-1.5 space-y-1 text-2xs">${thumb}<div class="truncate">${title}</div>
          <div class="text-slate-400 truncate">${escapeHtml([f.author, f.source].filter(Boolean).join(' · '))}</div>
          <div class="flex items-center justify-between gap-1"><span class="${f.paintable ? 'text-emerald-300' : 'text-slate-400'}">${escapeHtml(f.paintable ? (f.licenceLabel || 'free to use') : 'looking only')}</span>
          <button type="button" class="ui-btn ui-btn-sm" data-fav-pin="${escapeHtml(f.id)}" aria-pressed="${f.pinned ? 'true' : 'false'}">${f.pinned ? 'Pinned' : 'Pin'}</button></div></div>`;
      }).join('') : '<p class="ui-note col-span-2">No favourites yet. He saves photos he loves while browsing at NetNode.</p>';
      el.querySelectorAll('[data-fav-pin]').forEach(b => {
        b.onclick = () => {
          const f = phobFavourites().find(x => x.id === b.getAttribute('data-fav-pin'));
          if (!f) return;
          f.pinned = !f.pinned;
          savePersistentBrainState();
          phobRenderBoard();
        };
      });
    }

// Painting from his favourites board (js/refpaint.js asks this when he picks what to paint)
function phobPlanFromFavourite() {
      const favs = phobFavourites();
      if (!favs.length) return null;
      const f = pick(favs.filter(x => x.paintable).concat(favs.filter(x => x.pinned)));
      if (!f) return null;
      const query = refpCleanQuery(f.query || f.title) || 'landscape';
      return f.paintable
        ? { mode: 'single', query, favourite: f.id, why: `I saved "${f.title}" to my favourites and wanted to paint it.` }
        : { mode: 'single', query, why: `I liked a picture of ${query} I saw on ${f.source}, so I found a free one to paint from.` };
    }

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    phobFavourites();
    phobRenderBoard();
    document.getElementById('btnBrowsePhotosNow')?.addEventListener('click', e => {
      e.preventDefault();
      if (typeof doWhenFree === 'function') doWhenFree(() => photoBrowse(null, 'A Visitor Suggested It'), { key: 'photo-browse' });
      else photoBrowse(null, 'A Visitor Suggested It');
    });
  }, 0);
});
