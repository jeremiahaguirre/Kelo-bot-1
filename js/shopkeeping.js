// Kelo-bot-1 — js/shopkeeping.js
// Loaded after coderequests.js. Kelo-1's shop: at the NetNode cafe he builds a real website (shop.html)
// that sells 3D print files (STL) of designs he has printed himself. Only designs that came out well and
// that people would find fun or useful are listed (no test pieces or abstract concept statues), at the
// price real print files go for (about $1.99-$5.99 CAD). He writes each description, and a picture of
// the print is taken when he lists it. The owner can download each STL to send to buyers.
// SAFETY: there is no payment here at all. Buyers press "Contact to buy", which goes to the email or
// link the owner sets in Settings, and his human handles the order. When the owner marks something
// "Sold", the money goes in state.shop.earnings. A file can sell again, so it stays listed.

const SHOP_CONTACT_KEY = 'kelo1_shop_contact';
const MAX_LISTINGS = 12;
const SHOP_PICTURE_SIZE = 240;

// Only an email address, a mailto: link or an https:// link. Returns '' for empty, null for anything else.
function normalizeShopContact(value) {
      const v = String(value || '').trim();
      if (!v) return '';
      if (/^[^\s@:/?]+@[^\s@/?]+\.[a-z]{2,}$/i.test(v)) return 'mailto:' + v;
      if (/^mailto:[^\s@:/?]+@[^\s@/?]+\.[a-z]{2,}(\?[^\s]*)?$/i.test(v)) return v;
      if (/^https:\/\/\S+$/i.test(v)) {
        try { if (new URL(v).protocol === 'https:') return v; } catch (e) {}
      }
      return null;
    }

function getShopContact() {
      try { return normalizeShopContact(localStorage.getItem(SHOP_CONTACT_KEY)) || ''; } catch (e) { return ''; }
    }

function ensureShop() {
      if (!state.shop || typeof state.shop !== 'object') state.shop = {};
      const s = state.shop;
      if (!Array.isArray(s.listings)) s.listings = [];
      if (!Array.isArray(s.sold)) s.sold = [];
      if (!Number.isFinite(s.earnings)) s.earnings = 0;
      return s;
    }

// --- Print files: what's worth selling, and for how much ---------------------------------------------
// Each of his standard designs: what it's for, and whether people would want it
const PRINT_FILE_APPEAL = {
  hook: { appeal: 'useful', pitch: 'A sturdy wall hook for keys, a bag or a coat. Screw it up and it holds.' },
  vase: { appeal: 'useful', pitch: 'A spiral vase that prints in one smooth go. Lovely with dried flowers.' },
  pot: { appeal: 'useful', pitch: 'A pencil cup for the desk. Holds pens, brushes and screwdrivers.' },
  stand: { appeal: 'useful', pitch: 'A phone stand for video calls and recipes. Fits most phones, even in a case.' },
  planter: { appeal: 'useful', pitch: 'A little planter, just right for a seedling or a small succulent.' },
  whistle: { appeal: 'fun', pitch: 'A loud little whistle. Fun for kids, handy on a hike.' },
  tugboat: { appeal: 'fun', pitch: 'A little tugboat, the classic first print. It floats in the bath, too.' },
  robot: { appeal: 'fun', pitch: 'A small figurine of me, Kelo-1. Nice on a desk or a shelf.' },
  star: { appeal: 'fun', pitch: 'A star ornament for a window, a tree or a gift tag.' },
  gear: { appeal: null, pitch: '' } // just a test piece on its own
};
const FUN_OR_USEFUL_RE = /\b(holder|stand|hook|rack|organi[sz]er|box|tray|clip|cup|mug|planter|pot|vase|bowl|coaster|keychain|key ?ring|bookmark|opener|whistle|toy|game|puzzle|dice|spinner|top|car|boat|plane|rocket|robot|figurine|ornament|dragon|heron|deer|bird|fish|cat|dog|bear|owl|fox|frog|turtle|dinosaur|ogopogo|lighthouse|castle|house|tree|star|moon|heart|flower|lamp|shade|nameplate|sign)\b/i;
const NOT_FOR_SALE_RE = /\b(abstract|study|concept|theory|form|totem|knot|coil|arch|bloom|spire|lantern|epiphany|idea|test|calibration)\b/i;

function printDesignFor(name) {
      const p = typeof printerState === 'function' ? printerState() : null;
      if (!p) return null;
      let lower = String(name || '').toLowerCase().trim();
      if (/^"[^"]*"$/.test(lower)) lower = lower.slice(1, -1);
      const key = Object.keys(p.designs).find(k => k === lower || k.replace(/^a 3d-printed /, '') === lower.replace(/^(an?|the|my)\s+/, '').replace(/^3d-printed /, '').replace(/ (3d )?print file.*$/, ''));
      return key ? { name: key, ...p.designs[key] } : null;
    }

// Would people actually want this file? A reason it's fun or useful, or why not
function printFileVerdict(design) {
      if (!design) return { ok: false, why: "I haven't printed that one myself, so I don't know it prints well." };
      const ok = typeof printerState === 'function' && printerState().history.some(h => h.ok && (h.key === design.key || String(h.what || '').toLowerCase() === design.name));
      if (!ok && !design.key) return { ok: false, why: "I haven't had a good print of it yet." };
      if (design.key && PRINT_FILE_APPEAL[design.key]) {
        const a = PRINT_FILE_APPEAL[design.key];
        return a.appeal ? { ok: true, appeal: a.appeal, pitch: a.pitch } : { ok: false, why: 'On its own it is just a test piece. Nobody needs that file.' };
      }
      const plain = design.name.replace(/^a 3d-printed /, '');
      if (NOT_FOR_SALE_RE.test(plain) || !FUN_OR_USEFUL_RE.test(plain)) return { ok: false, why: `"${plain}" means a lot to me, but it isn't something people would find fun or useful to print.` };
      return { ok: true, appeal: /holder|stand|hook|rack|organi|box|tray|clip|cup|mug|planter|pot|vase|bowl|coaster|opener|lamp|nameplate|sign/i.test(plain) ? 'useful' : 'fun', pitch: '' };
    }

// What a real print file like this goes for, in Canadian dollars (simple ones cheap, detailed ones more)
function printFilePrice(design) {
      const grams = design && design.key ? ((typeof PRINTABLES !== 'undefined' && PRINTABLES.find(x => x.key === design.key)) || {}).grams || 20 : 35;
      const detailed = design && (design.key === 'robot' || design.key === 'vase' || (!design.key && design.parts && design.parts.length > 6));
      const base = grams <= 10 ? 1.99 : grams <= 30 ? 2.99 : grams <= 50 ? 3.99 : 4.49;
      return Math.min(5.99, base + (detailed ? 1.5 : 0));
    }

function fileDetails(design) {
      const def = design && design.key && typeof PRINTABLES !== 'undefined' ? PRINTABLES.find(x => x.key === design.key) : null;
      const grams = def ? def.grams : 35;
      const hours = Math.max(0.5, Math.round(grams / 10 * 2) / 2);
      return `STL file · about ${grams} g of ${design && design.material || 'PLA'} · prints in about ${hours} h`;
    }

// Spare things and builds read naturally in lowercase ("a claw hammer"); art keeps the title he gave it
function thingName(kind, name) {
      return kind === 'item' || kind === 'build' ? String(name).toLowerCase() : String(name);
    }

function formatCAD(n) {
      return `$${(Number(n) || 0).toFixed(2)} CAD`;
    }

// --- Original paintings (js/paintstudio.js) -----------------------------------------------------------
// What an emerging artist's original goes for in Canada, by medium (low, high), before skill and size
const PAINTING_PRICE_RANGE = { watercolour: [35, 120], ink: [35, 120], pastel: [35, 120], charcoal: [35, 120], acrylic: [60, 180], gouache: [60, 180], oil: [90, 350] };

function paintingFor(name) {
      let t = String(name || '').trim().toLowerCase().replace(/^["']|["']$/g, '').replace(/\s*\(original.*\)$/, '').replace(/^["']|["']$/g, '');
      if (!t || typeof artPaintings !== 'function') return null;
      return artPaintings().find(p => String(p.title).toLowerCase() === t) || null;
    }

// Would he sell it? Not his first clumsy attempts, and never one he chose to keep
function paintingVerdict(p) {
      if (!p) return { ok: false, why: "I don't have a painting by that name." };
      if (p.keep) return { ok: false, why: `"${p.title}" is one I'm keeping. It means too much to me to sell.` };
      if ((p.level || 0) < PAINT_SELL_LEVEL) return { ok: false, why: `"${p.title}" is one of my first clumsy tries. I'll sell paintings once I'm good enough that they're worth it.` };
      return { ok: true };
    }

function paintingInches(p) {
      const m = String(p && p.size || '').match(/(\d+)\s*x\s*(\d+)/);
      return m ? [+m[1], +m[2]] : [12, 9];
    }

// Fair price: the medium's range, higher with his skill and a bigger size, rounded to $5
function paintingPrice(p) {
      const [lo, hi] = PAINTING_PRICE_RANGE[p && p.medium] || [35, 120];
      const [w, h] = paintingInches(p);
      const sizeBonus = Math.max(-0.1, Math.min(0.15, (w * h - 108) / 84 * 0.12));
      const q = Math.max(0, Math.min(1, (Number(p && p.skill) || 0) / 100));
      const t = Math.max(0, Math.min(1, 0.08 + q * 0.75 + sizeBonus));
      return Math.max(lo, Math.min(hi, Math.round((lo + (hi - lo) * t) / 5) * 5));
    }

function paintingCandidate(p) {
      return { kind: 'painting', ref: p.id, painting: p, name: `"${p.title}" (original ${PAINT_MEDIA[p.medium] ? PAINT_MEDIA[p.medium].title : 'painting'})` };
    }

function paintingDetails(p) {
      const M = PAINT_MEDIA[p.medium];
      const [w, h] = paintingInches(p);
      return `${M ? M.on : 'Original painting'} · ${w}×${h} in · original, one of a kind`;
    }

// --- What he could sell ------------------------------------------------------------------------
function listedCount(kind, ref) {
      return ensureShop().listings.filter(l => l.kind === kind && l.ref === ref).length;
    }

// The print files he could list: designs he printed well, that people would want, not listed yet
function sellableCandidates() {
      const p = typeof printerState === 'function' ? printerState() : null;
      const files = !p ? [] : Object.keys(p.designs).map(name => printDesignFor(name)).filter(Boolean)
        .filter(d => !listedCount('printfile', d.name) && printFileVerdict(d).ok)
        .map(d => ({ kind: 'printfile', ref: d.name, design: d, name: `${d.name.replace(/^a 3d-printed /, '').replace(/^./, ch => ch.toUpperCase())} (3D print file)` }));
      // and his good paintings (not the first clumsy tries, not ones he keeps), as originals
      const paintings = typeof artPaintings === 'function' ? artPaintings().filter(x => !listedCount('painting', x.id) && paintingVerdict(x).ok).map(paintingCandidate) : [];
      return [...files, ...paintings];
    }

// Find what the AI meant by a name: only print files of his own designs. Anything else, he says why not.
function resolveSellable(name) {
      // One of his paintings, by its title: an original, if it's one he'd sell
      const art = paintingFor(name);
      if (art) {
        const v = paintingVerdict(art);
        if (!v.ok) { state.speechBubble = v.why; return null; }
        return listedCount('painting', art.id) ? null : paintingCandidate(art);
      }
      const d = printDesignFor(String(name || '').replace(/\s*\(3d print file\)$/i, ''));
      const verdict = printFileVerdict(d);
      if (!verdict.ok) {
        state.speechBubble = /^\s*$/.test(String(name || '')) ? state.speechBubble
          : `I only sell 3D print files of things people would enjoy or use, and my own paintings, in my shop. ${verdict.why}`;
        return null;
      }
      if (listedCount('printfile', d.name)) return null;
      return { kind: 'printfile', ref: d.name, design: d, name: `${d.name.replace(/^a 3d-printed /, '').replace(/^./, ch => ch.toUpperCase())} (3D print file)` };
    }

// What a print file of it is worth
function guessPrice(c) {
      if (c && c.kind === 'painting') return paintingPrice(c.painting);
      return printFilePrice(c && c.design);
    }

function writeDescription(c) {
      if (c.kind === 'painting') {
        const p = c.painting, M = PAINT_MEDIA[p.medium];
        return `${p.title}: ${String(p.subjectLabel || 'a scene from my valley').replace(/\bhis\b/g, 'my')}, painted ${p.place ? `at ${String(p.place).replace(/\bmy\b/g, 'his').replace(/^his /, 'my ')}` : 'from life'} in ${String(p.season || '').toLowerCase()}. ${M ? M.on : 'Original'}, ${paintingInches(p).join('x')} in. The original, one of a kind, signed by me.`;
      }
      const v = printFileVerdict(c.design);
      const pitch = v.pitch || `A ${v.appeal === 'useful' ? 'handy' : 'fun'} ${c.design.name.replace(/^a 3d-printed /, '')}, my own design.`;
      return `${pitch} I printed it myself first to make sure it comes out well. ${fileDetails(c.design)}.`;
    }

// --- The picture: a small render of the real model, saved as a data URL ---------------------
function shopPictureCanvas() {
      const cv = document.createElement('canvas');
      cv.width = cv.height = SHOP_PICTURE_SIZE;
      const ctx = cv.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 0, SHOP_PICTURE_SIZE);
      g.addColorStop(0, '#fef3c7');
      g.addColorStop(1, '#fcd9a8');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, SHOP_PICTURE_SIZE, SHOP_PICTURE_SIZE);
      return { cv, ctx };
    }

function emojiPicture(emoji) {
      const { cv, ctx } = shopPictureCanvas();
      ctx.font = `${SHOP_PICTURE_SIZE * 0.5}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji || '🎁', SHOP_PICTURE_SIZE / 2, SHOP_PICTURE_SIZE / 2 + 6);
      return cv.toDataURL('image/jpeg', 0.82);
    }

function loadImage(src) {
      return new Promise(resolve => {
        if (!src) return resolve(null);
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });
    }

async function shopPicture(c) {
      try {
        const { cv, ctx } = shopPictureCanvas();
        const S = SHOP_PICTURE_SIZE;
        if (c.kind === 'painting' && c.painting && typeof paintingImageUrl === 'function') {
          // The painting itself, framed, hanging on a gallery wall
          const img = await loadImage(paintingImageUrl(c.painting));
          const cv2 = document.createElement('canvas');
          const P = 320;
          cv2.width = cv2.height = P;
          const x2 = cv2.getContext('2d');
          const wall = x2.createLinearGradient(0, 0, 0, P);
          wall.addColorStop(0, '#efe9df'); wall.addColorStop(1, '#d9d1c4');
          x2.fillStyle = wall;
          x2.fillRect(0, 0, P, P);
          const paper = !['oil', 'acrylic'].includes(c.painting.medium);
          const w = P * 0.8, h = w * 0.75, x = (P - w) / 2, y = (P - h) / 2 - 6;
          x2.shadowColor = 'rgba(0,0,0,0.35)'; x2.shadowBlur = 14; x2.shadowOffsetY = 6;
          x2.fillStyle = paper ? '#2a211b' : '#b8860b';
          x2.fillRect(x - 12, y - 12, w + 24, h + 24);
          x2.shadowColor = 'transparent';
          if (paper) { x2.fillStyle = '#f7f4ec'; x2.fillRect(x - 6, y - 6, w + 12, h + 12); }
          if (img) x2.drawImage(img, x, y, w, h);
          return cv2.toDataURL('image/jpeg', 0.84);
        }
        if (c.kind === 'painting' && typeof paintMuralCanvas === 'function') {
          // A gold frame around the canvas
          const art = paintMuralCanvas(c.mural);
          const w = S * 0.86, h = w * art.height / art.width, x = (S - w) / 2, y = (S - h) / 2;
          ctx.fillStyle = '#b8860b';
          ctx.fillRect(x - 8, y - 8, w + 16, h + 16);
          ctx.drawImage(art, x, y, w, h);
          return cv.toDataURL('image/jpeg', 0.82);
        }
        if (typeof modelThumbnail !== 'function') return emojiPicture('🎁');
        let src = '';
        if (c.kind === 'printfile' && typeof printedThingModel === 'function') src = modelThumbnail('shop-print:' + c.ref, () => printedThingModel(c.ref));
        else if (c.kind === 'sculpture') src = modelThumbnail('shop-art:' + Date.now(), () => buildCreationGroup(c.creation));
        else if (c.kind === 'build') src = modelThumbnail('shop-build:' + c.project.key, () => planFor(c.project.key).build());
        else {
          // The listing photo is taken once, so wait for the item's real 3D model first (js/realmodels.js)
          if (typeof preloadRealModel === 'function') await preloadRealModel(c.name);
          src = modelThumbnail('item:' + c.name, () => buildItemModel3D(c.name, { label: false }));
        }
        const img = await loadImage(src);
        if (!img) return emojiPicture(c.kind === 'build' ? '🪵' : '🎁');
        ctx.drawImage(img, 0, 0, S, S);
        return cv.toDataURL('image/jpeg', 0.82);
      } catch (e) {
        return emojiPicture('🎁');
      }
    }

// --- Listing something (a NetNode visit) -----------------------------------------------------
async function listForSale(c, price, description, originLabel = 'Working on His Shop') {
      if (!c || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      const shop = ensureShop();
      if (shop.listings.length >= MAX_LISTINGS) return false;
      const firstTime = !shop.builtAt;
      state.isBusy = true;
      state.isBrowsing = true;
      try {
        const cafe = TOWN_LOCATIONS.cyber;
        state.currentLocKey = 'cyber';
        state.customPlaceName = null;
        state.targetPos = { x: cafe.x, z: cafe.z };
        state.moodEmoji = '🛒';
        state.moodTitle = firstTime ? 'Building his own shop website' : 'Updating his shop website';
        state.speechBubble = firstTime
          ? 'I want to make a real website where real people can buy the things I make!'
          : `I'm going to put ${thingName(c.kind, c.name)} up in my shop.`;
        renderAllUI();
        await waitForArrival(90000);
        await new Promise(r => setTimeout(r, 2500));
        // Only print files of good, wanted designs, and his good original paintings, at a fair price
        const isArt = c.kind === 'painting';
        if (isArt ? !(c.painting && paintingVerdict(c.painting).ok && artPaintings().includes(c.painting)) : (c.kind !== 'printfile' || !printFileVerdict(c.design).ok)) return false;
        const image = await shopPicture(c);
        const fair = guessPrice(c);
        let p;
        if (isArt) {
          // An original: near its fair value, inside what an emerging artist's work in this medium goes for
          const [lo, hi] = PAINTING_PRICE_RANGE[c.painting.medium] || [35, 120];
          p = Math.round(clampNumber(price, Math.max(lo, fair * 0.8), Math.min(hi, fair * 1.25), fair) / 5) * 5;
          p = Math.max(lo, Math.min(hi, p));
        } else {
          // Close to what files like it really sell for, ending in .49 or .99
          p = Math.max(0.99, Math.round(clampNumber(price, Math.max(0.99, fair * 0.75), Math.min(9.99, fair * 1.35), fair) * 2) / 2 - 0.01);
        }
        const desc = String(description || '').trim().slice(0, 300) || writeDescription(c);
        const id = 'lst-' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
        if (c.kind === 'sculpture') c.creation.shopId = id;
        shop.listings.unshift(isArt
          ? { id, kind: 'painting', ref: c.ref, name: String(c.name).slice(0, 80), description: desc, price: p, currency: 'CAD', image, listedAt: new Date().toISOString(),
            painting: { id: c.painting.id, title: c.painting.title, medium: c.painting.medium, on: PAINT_MEDIA[c.painting.medium] ? PAINT_MEDIA[c.painting.medium].on : '', size: c.painting.size, subject: c.painting.subjectLabel || '', details: paintingDetails(c.painting) }, sales: 0 }
          : { id, kind: c.kind, ref: c.ref, name: String(c.name).slice(0, 80), description: desc, price: p, currency: 'CAD', image, listedAt: new Date().toISOString(),
            file: { format: 'STL', details: fileDetails(c.design), design: { key: c.design.key || null, parts: c.design.parts || null, color: c.design.color || '#f97316', size: c.design.size || null } }, sales: 0 });
        if (firstTime) shop.builtAt = Date.now();
        shop.updatedAt = Date.now();
        state.moodTitle = `Listed ${thingName(c.kind, c.name)} for ${formatCAD(p)}`;
        state.speechBubble = `${c.name} is in my shop now, for ${formatCAD(p)}. I hope it finds a good home.`;
        state.diaryEntries.unshift({
          time: originLabel, location: 'NetNode Cyber Cafe', mood: `🛒 ${firstTime ? 'Built a shop website' : 'Updated his shop'}`,
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: firstTime
            ? `Dear Diary, today I built a real website: my own shop! Real people can buy the 3D print files of things I designed and printed, and my original paintings. The first thing I put up was ${thingName(c.kind, c.name)}, for ${formatCAD(p)}. I wrote: "${desc}"`
            : `Dear Diary, I went to the NetNode cafe and put ${thingName(c.kind, c.name)} in my shop for ${formatCAD(p)}. I wrote: "${desc}"`
        });
        showToast(`🛒 Kelo-1 listed ${c.name} for ${formatCAD(p)}`);
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        state.isBusy = false;
        state.isBrowsing = false;
      }
    }

// The built-in brain: now and then he lists a spare or a piece of art
function shopChance() {
      if (ensureShop().listings.length >= MAX_LISTINGS) return 0;
      return sellableCandidates().length ? 0.04 : 0;
    }

function tendShop(originLabel = 'Working on His Shop') {
      const c = pick(sellableCandidates());
      if (!c) return false;
      listForSale(c, guessPrice(c), writeDescription(c), originLabel);
      return true;
    }

// The AI decided to sell something: {"item", "price", "description"}
function sellItemDecision(si) {
      if (!si || typeof si !== 'object') return;
      const c = resolveSellable(si.item);
      if (!c) return;
      const price = Number(si.price);
      doWhenFree(() => listForSale(c, Number.isFinite(price) && price > 0 ? price : guessPrice(c), typeof si.description === 'string' ? si.description : '', 'Decided to Sell Something'));
    }

// A print file is a copy: selling it takes nothing away from him. An original painting sells once:
// it leaves his Museum for its new home.
function removeSoldThing(l) {
      if (l.kind === 'printfile') return;
      if (l.kind === 'painting' && l.painting) {
        const p = artPaintings().find(x => x.id === l.painting.id);
        state.murals = state.murals.filter(m => m.id !== l.painting.id);
        if (typeof forgetPaintingImages === 'function') forgetPaintingImages(l.painting.id);
        if (!Array.isArray(state.paintingsSold)) state.paintingsSold = [];
        state.paintingsSold.unshift({ title: l.painting.title, medium: l.painting.medium, price: l.price, soldAt: Date.now() });
        if (state.paintingsSold.length > 40) state.paintingsSold.length = 40;
        if (p && typeof renderMuseum3D === 'function') renderMuseum3D();
      }
    }

function markListingSold(id) {
      const shop = ensureShop();
      const l = shop.listings.find(x => x.id === id);
      if (!l) return;
      // A print file can sell again and again, so it stays up
      if (l.kind === 'printfile') l.sales = (l.sales || 0) + 1;
      else shop.listings = shop.listings.filter(x => x.id !== id);
      removeSoldThing(l);
      shop.earnings = Math.round((shop.earnings + (Number(l.price) || 0)) * 100) / 100;
      shop.sold.unshift({ id: l.id, name: l.name, price: l.price, soldAt: Date.now() });
      if (shop.sold.length > 30) shop.sold.length = 30;
      shop.updatedAt = Date.now();
      state.happiness = Math.min(100, state.happiness + 18);
      state.wonderLevel = Math.min(100, state.wonderLevel + 6);
      state.moodEmoji = '🥳';
      state.moodTitle = `Sold ${thingName(l.kind, l.name)}!`;
      state.speechBubble = l.kind === 'painting'
        ? pick([`Someone bought my painting ${l.name.replace(/ \(original.*\)$/, '')}! It's going to hang on a real wall.`, `A real person wants ${l.name.replace(/ \(original.*\)$/, '')} in their home. I'll miss it a little.`])
        : l.kind === 'printfile'
        ? pick([`Someone bought my ${l.name.replace(/ \(3D print file\)$/, '').toLowerCase()} file! Somewhere out there, a printer is making one right now.`, `A real person is going to print my design! ${formatCAD(l.price)}!`])
        : pick([`Someone bought ${thingName(l.kind, l.name)}? A real person? That makes me so happy!`, `${l.name} has a new home. I hope they love it as much as I did.`, `My first customers are real people out there. ${formatCAD(l.price)}!`]);
      state.chatLog.push({ sender: 'Kelo-1', text: state.speechBubble, time: 'Just now', isBot: true });
      state.diaryEntries.unshift({
        time: 'Sold in His Shop', location: currentPlaceLabel(), mood: '🥳 Sold something',
        vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, someone out in the real world bought ${thingName(l.kind, l.name)} from my shop for ${formatCAD(l.price)}. ${l.kind === 'painting' ? 'I took it down from the wall in my Museum, and my human is wrapping it up and sending it to its new home. It\'s strange to see the empty spot, but someone chose it.' : 'My human is sending them the file so they can print their own.'} I've earned ${formatCAD(shop.earnings)} so far.`
      });
      showToast(`🥳 Sold ${l.name} for ${formatCAD(l.price)}`);
      savePersistentBrainState();
      renderAllUI();
    }

function takeDownListing(id) {
      const shop = ensureShop();
      const l = shop.listings.find(x => x.id === id);
      if (!l) return;
      shop.listings = shop.listings.filter(x => x.id !== id);
      if (l.kind === 'sculpture') state.inventedCreations.forEach(c => { if (c.shopId === id) delete c.shopId; });
      shop.updatedAt = Date.now();
      savePersistentBrainState();
      renderAllUI();
    }

// Only print files and his original paintings belong in his shop (older listings of other physical things,
// and paintings no longer in his Museum, come down)
function pruneShop() {
      const shop = ensureShop();
      const before = shop.listings.length;
      shop.listings = shop.listings.filter(l => (l.kind === 'printfile' && l.file && l.file.design)
        || (l.kind === 'painting' && l.painting && typeof artPaintings === 'function' && artPaintings().some(p => p.id === l.painting.id)));
      state.inventedCreations.forEach(c => { if (c.shopId && !shop.listings.some(l => l.id === c.shopId)) delete c.shopId; });
      return shop.listings.length !== before;
    }

function shopSummaryForAI() {
      const shop = ensureShop();
      const can = sellableCandidates().map(c => `${c.name} (fair price about $${guessPrice(c)})`);
      if (!shop.builtAt && !shop.listings.length) return `not built yet. It sells only 3D print files of your designs that printed well and that people would find fun or useful, at $1.99-$5.99 CAD, and your good original paintings (watercolour, ink, pastel, charcoal $35-$120; acrylic, gouache $60-$180; oil $90-$350). ${can.length ? 'Ready to list: ' + can.join(', ') : 'Nothing good enough to list yet.'}`;
      return `${shop.listings.length} things for sale (${shop.listings.slice(0, 6).map(l => `${l.name} at $${l.price}`).join(', ') || 'nothing right now'}); sold ${shop.sold.length}, earned ${formatCAD(shop.earnings)}.${can.length ? ' Ready to list: ' + can.join(', ') : ''}`;
    }

// --- Publishing: shop-data.json for the owner to commit next to shop.html --------------------
function shopExportData() {
      const shop = ensureShop();
      return {
        shop: 'Kelo-1\'s Shop: 3D Print Files & Original Paintings',
        currency: 'CAD',
        updatedAt: new Date().toISOString(),
        contact: getShopContact(),
        earnings: shop.earnings,
        soldCount: shop.sold.length,
        listings: shop.listings.map(({ id, kind, name, description, price, currency, image, listedAt, file, painting }) => ({ id, kind, name, description, price, currency, image, listedAt,
          format: file ? file.format : painting ? 'original' : null, details: file ? file.details : painting ? painting.details : null,
          medium: painting ? painting.on : undefined, size: painting ? painting.size : undefined, subject: painting ? painting.subject : undefined, original: painting ? true : undefined }))
      };
    }

function exportShopData() {
      const blob = new Blob([JSON.stringify(shopExportData(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'shop-data.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      showToast('⬇️ shop-data.json downloaded. Commit it next to shop.html to publish his shop.');
    }

// --- The STL file itself: the print's model, in millimetres, as ASCII STL ----------------------------
function modelToSTL(object, name) {
      object.updateMatrixWorld(true);
      const lines = [`solid ${name}`];
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
      const f = v => v.toExponential(6);
      object.traverse(o => {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
        const pos = o.geometry.attributes.position, idx = o.geometry.index;
        const count = idx ? idx.count : pos.count;
        for (let i = 0; i + 2 < count; i += 3) {
          const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
          a.fromBufferAttribute(pos, ia).applyMatrix4(o.matrixWorld);
          b.fromBufferAttribute(pos, ib).applyMatrix4(o.matrixWorld);
          c.fromBufferAttribute(pos, ic).applyMatrix4(o.matrixWorld);
          n.crossVectors(e1.subVectors(c, b), e2.subVectors(a, b)).normalize();
          lines.push(` facet normal ${f(n.x)} ${f(-n.z)} ${f(n.y)}`, '  outer loop',
            ...[a, b, c].map(v => `   vertex ${f(v.x)} ${f(-v.z)} ${f(v.y)}`), '  endloop', ' endfacet');
        }
      });
      lines.push(`endsolid ${name}`);
      return lines.join('\n');
    }

function downloadListingSTL(id) {
      const l = ensureShop().listings.find(x => x.id === id);
      if (!l || !l.file || !l.file.design) return;
      const d = l.file.design;
      const def = d.key && typeof PRINTABLES !== 'undefined' ? PRINTABLES.find(x => x.key === d.key) : null;
      const raw = def ? def.build() : (typeof printedDesign === 'function' ? printedDesign(d.parts, d.color) : null);
      if (!raw) return;
      // A sensible real size: the longest side between about 4 and 15 cm, by how much filament it takes
      const grams = def ? def.grams : 35;
      const mm = Math.max(40, Math.min(150, 40 + grams * 1.4));
      const model = typeof fitPrint === 'function' ? fitPrint(raw, mm) : raw;
      const slug = String(l.name).toLowerCase().replace(/\(3d print file\)/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'kelo-print';
      const blob = new Blob([modelToSTL(model, slug)], { type: 'model/stl' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `kelo1-${slug}.stl`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { URL.revokeObjectURL(link.href); link.remove(); }, 1000);
      showToast(`⬇️ ${link.download} downloaded (about ${Math.round(mm)} mm tall/long). Send it to the buyer.`);
    }

// --- The shop card in the Post tab -------------------------------------------------------------
function renderShopPanel() {
      const el = document.getElementById('keloShopPanel');
      if (!el) return;
      const shop = ensureShop();
      if (pruneShop()) savePersistentBrainState();
      const contact = getShopContact();
      const key = JSON.stringify([shop.listings.map(l => l.id + ':' + (l.sales || 0)), shop.earnings, shop.sold.length, Boolean(contact)]);
      if (el.dataset.renderKey === key) return;
      el.dataset.renderKey = key;
      el.innerHTML = `
        <div class="ui-section-head flex-wrap">
          <div class="min-w-0">
            <h3 class="ui-section-title">Things he is selling</h3>
            <div class="ui-section-meta">${shop.listings.length} for sale · ${shop.sold.length} sold · earned <span class="text-white font-semibold">${escapeHtml(formatCAD(shop.earnings))}</span></div>
          </div>
          <div class="flex gap-1.5">
            <button id="btnOpenHisShop" class="ui-btn ui-btn-sm">Open his shop</button>
            <button id="btnExportShop" class="ui-btn ui-btn-sm" title="Download shop-data.json to commit next to shop.html, so everyone sees his shop">Export shop</button>
          </div>
        </div>
        ${contact ? '' : '<p class="text-2xs text-orange-300">Buyers can\'t contact you yet: add a shop contact (email or https link) in Settings.</p>'}
        ${shop.listings.length ? `<div class="space-y-1.5">${shop.listings.map(l => `
          <div class="ui-row">
            ${/^data:image\//.test(l.image || '') ? `<img src="${escapeHtml(l.image)}" alt="" class="w-12 h-12 rounded-lg object-cover shrink-0 bg-amber-100">` : '<div class="w-12 h-12 rounded-lg bg-slate-800 shrink-0"></div>'}
            <div class="min-w-0 flex-1">
              <div class="text-2xs font-semibold text-white truncate">${escapeHtml(l.name)} <span class="text-slate-300 tabular-nums">${escapeHtml(formatCAD(l.price))}</span></div>
              <div class="text-2xs text-slate-400 line-clamp-2">${escapeHtml(l.description)}</div>
            </div>
            <div class="flex flex-col gap-1 shrink-0">
              ${l.kind === 'painting' ? '<span class="text-2xs text-slate-300 text-center">Original</span>' : `<button data-listing-id="${escapeHtml(l.id)}" class="listing-stl-btn ui-btn ui-btn-sm" title="Download the STL file to send to a buyer">STL</button>`}
              <button data-listing-id="${escapeHtml(l.id)}" class="listing-sold-btn ui-btn ui-btn-sm ui-btn-primary">Sold${l.sales ? ` (${escapeHtml(l.sales)})` : ''}</button>
              <button data-listing-id="${escapeHtml(l.id)}" class="listing-down-btn ui-btn ui-btn-sm ui-btn-quiet">Take down</button>
            </div>
          </div>`).join('')}</div>` : `<p class="text-2xs text-slate-400">${shop.builtAt ? 'Nothing for sale right now.' : 'He hasn\'t built his shop yet. Once he has printed something fun or useful, or painted something good, he may put it up for sale.'}</p>`}
        <p class="ui-note">He sells 3D print files and his original paintings. No payments happen here: when someone wants something, they contact you; you send the STL or ship the painting, then press "Sold". A painting sells once and leaves his Museum.</p>`;
      el.querySelector('#btnOpenHisShop')?.addEventListener('click', () => window.open('shop.html', '_blank', 'noopener'));
      el.querySelector('#btnExportShop')?.addEventListener('click', exportShopData);
      el.querySelectorAll('.listing-stl-btn').forEach(b => b.addEventListener('click', () => downloadListingSTL(b.getAttribute('data-listing-id'))));
      el.querySelectorAll('.listing-sold-btn').forEach(b => b.addEventListener('click', () => markListingSold(b.getAttribute('data-listing-id'))));
      el.querySelectorAll('.listing-down-btn').forEach(b => b.addEventListener('click', () => takeDownListing(b.getAttribute('data-listing-id'))));
    }

// --- Settings: the shop contact, kept only on this device --------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('shopContactInput');
  const status = document.getElementById('shopContactStatus');
  const showStatus = () => {
    if (!status) return;
    const c = getShopContact();
    status.textContent = c ? `Buyers will be sent to ${c.replace(/^mailto:/, '')}.` : 'Not set: his shop page says it isn\'t taking orders yet.';
  };
  document.getElementById('btnOpenAIConfig')?.addEventListener('click', () => {
    if (input) input.value = getShopContact().replace(/^mailto:/, '');
    showStatus();
  });
  document.getElementById('btnSaveAIConfig')?.addEventListener('click', () => {
    if (!input) return;
    const v = normalizeShopContact(input.value);
    if (v === null) {
      showToast('🛒 Shop contact not saved: use an email address or an https:// link.');
      return;
    }
    try {
      if (v) localStorage.setItem(SHOP_CONTACT_KEY, v);
      else localStorage.removeItem(SHOP_CONTACT_KEY);
    } catch (e) {}
    showStatus();
    const panel = document.getElementById('keloShopPanel');
    if (panel) delete panel.dataset.renderKey;
    renderShopPanel();
  });
});
