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

// --- What he could sell ------------------------------------------------------------------------
function listedCount(kind, ref) {
      return ensureShop().listings.filter(l => l.kind === kind && l.ref === ref).length;
    }

function isVehicleName(name) {
      return typeof vehicleTypeFor === 'function' && Boolean(vehicleTypeFor(name));
    }

// The print files he could list: designs he printed well, that people would want, not listed yet
function sellableCandidates() {
      const p = typeof printerState === 'function' ? printerState() : null;
      if (!p) return [];
      return Object.keys(p.designs).map(name => printDesignFor(name)).filter(Boolean)
        .filter(d => !listedCount('printfile', d.name) && printFileVerdict(d).ok)
        .map(d => ({ kind: 'printfile', ref: d.name, design: d, name: `${d.name.replace(/^a 3d-printed /, '').replace(/^./, ch => ch.toUpperCase())} (3D print file)` }));
    }

// Find what the AI meant by a name: only print files of his own designs. Anything else, he says why not.
function resolveSellable(name) {
      const d = printDesignFor(String(name || '').replace(/\s*\(3d print file\)$/i, ''));
      const verdict = printFileVerdict(d);
      if (!verdict.ok) {
        state.speechBubble = /^\s*$/.test(String(name || '')) ? state.speechBubble
          : `I only sell 3D print files in my shop, of things people would enjoy or use. ${verdict.why}`;
        return null;
      }
      if (listedCount('printfile', d.name)) return null;
      return { kind: 'printfile', ref: d.name, design: d, name: `${d.name.replace(/^a 3d-printed /, '').replace(/^./, ch => ch.toUpperCase())} (3D print file)` };
    }

// What a print file of it is worth
function guessPrice(c) {
      return printFilePrice(c && c.design);
    }

function writeDescription(c) {
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
        // Only print files of good, wanted designs, at a fair price for a file
        if (c.kind !== 'printfile' || !printFileVerdict(c.design).ok) return false;
        const image = await shopPicture(c);
        const fair = guessPrice(c);
        // Close to what files like it really sell for, ending in .49 or .99
        const p = Math.max(0.99, Math.round(clampNumber(price, Math.max(0.99, fair * 0.75), Math.min(9.99, fair * 1.35), fair) * 2) / 2 - 0.01);
        const desc = String(description || '').trim().slice(0, 300) || writeDescription(c);
        const id = 'lst-' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
        if (c.kind === 'sculpture') c.creation.shopId = id;
        shop.listings.unshift({ id, kind: c.kind, ref: c.ref, name: String(c.name).slice(0, 80), description: desc, price: p, currency: 'CAD', image, listedAt: new Date().toISOString(),
          file: { format: 'STL', details: fileDetails(c.design), design: { key: c.design.key || null, parts: c.design.parts || null, color: c.design.color || '#f97316', size: c.design.size || null } }, sales: 0 });
        if (firstTime) shop.builtAt = Date.now();
        shop.updatedAt = Date.now();
        state.moodTitle = `Listed ${thingName(c.kind, c.name)} for ${formatCAD(p)}`;
        state.speechBubble = `${c.name} is in my shop now, for ${formatCAD(p)}. I hope it finds a good home.`;
        state.diaryEntries.unshift({
          time: originLabel, location: 'NetNode Cyber Cafe', mood: `🛒 ${firstTime ? 'Built a shop website' : 'Updated his shop'}`,
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: firstTime
            ? `Dear Diary, today I built a real website: my own shop! Real people can buy the 3D print files of things I designed and printed, and print their own. The first thing I put up was ${thingName(c.kind, c.name)}, for ${formatCAD(p)}. I wrote: "${desc}"`
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

// A print file is a copy: selling it takes nothing away from him
function removeSoldThing(l) {
      if (l.kind === 'printfile') return;
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
      state.speechBubble = l.kind === 'printfile'
        ? pick([`Someone bought my ${l.name.replace(/ \(3D print file\)$/, '').toLowerCase()} file! Somewhere out there, a printer is making one right now.`, `A real person is going to print my design! ${formatCAD(l.price)}!`])
        : pick([`Someone bought ${thingName(l.kind, l.name)}? A real person? That makes me so happy!`, `${l.name} has a new home. I hope they love it as much as I did.`, `My first customers are real people out there. ${formatCAD(l.price)}!`]);
      state.chatLog.push({ sender: 'Kelo-1', text: state.speechBubble, time: 'Just now', isBot: true });
      state.diaryEntries.unshift({
        time: 'Sold in His Shop', location: currentPlaceLabel(), mood: '🥳 Sold something',
        vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, someone out in the real world bought ${thingName(l.kind, l.name)} from my shop for ${formatCAD(l.price)}. My human is sending them the file so they can print their own. I've earned ${formatCAD(shop.earnings)} so far.`
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

// Only print files belong in his shop (older listings of physical things come down)
function pruneShop() {
      const shop = ensureShop();
      const before = shop.listings.length;
      shop.listings = shop.listings.filter(l => l.kind === 'printfile' && l.file && l.file.design);
      state.inventedCreations.forEach(c => { if (c.shopId && !shop.listings.some(l => l.id === c.shopId)) delete c.shopId; });
      return shop.listings.length !== before;
    }

function shopSummaryForAI() {
      const shop = ensureShop();
      const can = sellableCandidates().map(c => `${c.name} (fair price about $${guessPrice(c)})`);
      if (!shop.builtAt && !shop.listings.length) return `not built yet. It sells only 3D print files of your designs that printed well and that people would find fun or useful, at $1.99-$5.99 CAD. ${can.length ? 'Ready to list: ' + can.join(', ') : 'Nothing good enough to list yet.'}`;
      return `${shop.listings.length} print files for sale (${shop.listings.slice(0, 6).map(l => `${l.name} at $${l.price}`).join(', ') || 'nothing right now'}); sold ${shop.sold.length}, earned ${formatCAD(shop.earnings)}.${can.length ? ' Ready to list: ' + can.join(', ') : ''}`;
    }

// --- Publishing: shop-data.json for the owner to commit next to shop.html --------------------
function shopExportData() {
      const shop = ensureShop();
      return {
        shop: 'Kelo-1\'s 3D Print Files',
        currency: 'CAD',
        updatedAt: new Date().toISOString(),
        contact: getShopContact(),
        earnings: shop.earnings,
        soldCount: shop.sold.length,
        listings: shop.listings.map(({ id, kind, name, description, price, currency, image, listedAt, file }) => ({ id, kind, name, description, price, currency, image, listedAt, format: file ? file.format : null, details: file ? file.details : null }))
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
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="min-w-0">
            <div class="text-xs font-bold text-emerald-200 flex items-center gap-1.5">🛒 Kelo-1's Shop</div>
            <div class="text-[10px] font-mono text-slate-400">${shop.listings.length} for sale · ${shop.sold.length} sold · earned <span class="text-emerald-300 font-bold">${escapeHtml(formatCAD(shop.earnings))}</span></div>
          </div>
          <div class="flex gap-1.5">
            <button id="btnOpenHisShop" class="px-2.5 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[11px] font-semibold transition">🛒 His shop</button>
            <button id="btnExportShop" class="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold transition" title="Download shop-data.json to commit next to shop.html, so everyone sees his shop">⬇️ Export shop</button>
          </div>
        </div>
        ${contact ? '' : '<p class="text-[10px] text-amber-300/90">Buyers can\'t contact you yet: add a shop contact (email or https link) in ⚙️ Settings.</p>'}
        ${shop.listings.length ? `<div class="space-y-1.5">${shop.listings.map(l => `
          <div class="flex gap-2 items-center p-1.5 rounded-xl bg-slate-950/70 border border-slate-800">
            ${/^data:image\//.test(l.image || '') ? `<img src="${escapeHtml(l.image)}" alt="" class="w-12 h-12 rounded-lg object-cover shrink-0 bg-amber-100">` : '<div class="w-12 h-12 rounded-lg bg-slate-800 shrink-0"></div>'}
            <div class="min-w-0 flex-1">
              <div class="text-[11px] font-semibold text-white truncate">${escapeHtml(l.name)} <span class="text-emerald-300 font-mono">${escapeHtml(formatCAD(l.price))}</span></div>
              <div class="text-[10px] text-slate-400 line-clamp-2">${escapeHtml(l.description)}</div>
            </div>
            <div class="flex flex-col gap-1 shrink-0">
              <button data-listing-id="${escapeHtml(l.id)}" class="listing-stl-btn px-2 py-0.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 text-[10px] font-bold" title="Download the STL file to send to a buyer">⬇️ STL</button>
              <button data-listing-id="${escapeHtml(l.id)}" class="listing-sold-btn px-2 py-0.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-bold">✓ Sold${l.sales ? ` (${l.sales})` : ''}</button>
              <button data-listing-id="${escapeHtml(l.id)}" class="listing-down-btn px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 text-[10px]">Take down</button>
            </div>
          </div>`).join('')}</div>` : `<p class="text-[10px] text-slate-400">${shop.builtAt ? 'Nothing for sale right now.' : 'He hasn\'t built his shop yet. Once he has printed something fun or useful, he may put its 3D print file up for sale.'}</p>`}
        <p class="text-[10px] text-slate-500">He sells 3D print files only. No payments happen here: when someone wants a file, they contact you, you send them the STL (⬇️ STL), then press "Sold".</p>`;
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
