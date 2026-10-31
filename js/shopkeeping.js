// Kelo-bot-1 — js/shopkeeping.js
// Loaded after coderequests.js. Kelo-1's shop: at the NetNode cafe he builds a real website (shop.html)
// to try to sell his things to real people: spare copies of things he owns, art from his Museum, and
// things he built from plans. He writes each description and picks each price (in Canadian dollars),
// and a picture of the real 3D model is taken when he lists it.
// SAFETY: there is no payment here at all. Buyers press "Contact to buy", which goes to the email or
// link the owner sets in Settings, and his human handles the order. When the owner marks something
// "Sold", it leaves his things for good and the money goes in state.shop.earnings.

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

// Spare things and builds read naturally in lowercase ("a claw hammer"); art keeps the title he gave it
function thingName(kind, name) {
      return kind === 'item' || kind === 'build' ? String(name).toLowerCase() : String(name);
    }

function formatCAD(n) {
      return `$${(Number(n) || 0).toFixed(2)} CAD`;
    }

// --- What he could sell ------------------------------------------------------------------------
function ownedItemNames() {
      return [...state.toolInventory, ...state.toys.map(t => t.name), ...state.belongings.map(b => b.name)].filter(Boolean);
    }

function listedCount(kind, ref) {
      return ensureShop().listings.filter(l => l.kind === kind && l.ref === ref).length;
    }

function isVehicleName(name) {
      return typeof vehicleTypeFor === 'function' && Boolean(vehicleTypeFor(name));
    }

// The things his built-in brain would happily part with: spare copies, Museum art and finished builds
function sellableCandidates() {
      const out = [];
      const names = ownedItemNames();
      const counts = {};
      names.forEach(n => { counts[n] = (counts[n] || 0) + 1; });
      Object.entries(counts).forEach(([name, n]) => {
        if (n > 1 && !isVehicleName(name) && listedCount('item', name) < n - 1) out.push({ kind: 'item', ref: name, name });
      });
      state.inventedCreations.filter(c => c.inMuseum && !c.shopId).forEach(c => out.push({ kind: 'sculpture', creation: c, name: c.title || 'Untitled sculpture' }));
      state.murals.filter(m => !listedCount('painting', m.seed)).forEach(m => out.push({ kind: 'painting', ref: m.seed, mural: m, name: `"${m.text}" (painting)` }));
      state.projects.filter(p => p.status === 'built' && !listedCount('build', p.id) && typeof planFor === 'function' && planFor(p.key))
        .forEach(p => out.push({ kind: 'build', ref: p.id, project: p, name: `Handmade ${planFor(p.key).name.toLowerCase()}` }));
      return out;
    }

// Find what the AI meant by a name: something he owns, a sculpture, a painting or a build
function resolveSellable(name) {
      const want = String(name || '').trim().toLowerCase().replace(/^(an?|the|my)\s+/, '').replace(/^"|"$/g, '');
      if (!want) return null;
      const owned = typeof findOwnedName === 'function' ? findOwnedName(name) : ownedItemNames().find(n => n.toLowerCase() === want);
      if (owned) {
        const copies = ownedItemNames().filter(n => n === owned).length;
        return listedCount('item', owned) < copies ? { kind: 'item', ref: owned, name: owned } : null;
      }
      const c = state.inventedCreations.find(cr => !cr.shopId && String(cr.title || '').toLowerCase().replace(/^(an?|the|my)\s+/, '') === want);
      if (c) return { kind: 'sculpture', creation: c, name: c.title };
      const m = state.murals.find(mu => !listedCount('painting', mu.seed) && (String(mu.text).toLowerCase() === want || `${String(mu.text).toLowerCase()} painting` === want));
      if (m) return { kind: 'painting', ref: m.seed, mural: m, name: `"${m.text}" (painting)` };
      const p = state.projects.find(pr => pr.status === 'built' && !listedCount('build', pr.id) && typeof planFor === 'function' && planFor(pr.key)
        && want.includes(planFor(pr.key).name.toLowerCase()));
      if (p) return { kind: 'build', ref: p.id, project: p, name: `Handmade ${planFor(p.key).name.toLowerCase()}` };
      return null;
    }

// What he thinks it's worth
function guessPrice(c) {
      const round = n => Math.max(1, Math.round(n));
      if (c.kind === 'sculpture') return round(randRange(45, 160));
      if (c.kind === 'painting') return round(25 + (Number(c.mural.skill) || 20) * 1.4 + randRange(0, 20));
      if (c.kind === 'build') return { birdhouse: 45, feeder: 35, windchime: 40, bench: 180, picnic: 260, raisedbed: 120 }[c.project.key] || 60;
      const cat = typeof categorizeItem === 'function' ? categorizeItem(c.name) : 'thing';
      return round({ tool: randRange(12, 45), toy: randRange(6, 25), food: randRange(4, 12), material: randRange(8, 30) }[cat] || randRange(8, 35));
    }

function writeDescription(c) {
      if (c.kind === 'sculpture') {
        return pick([
          `I welded this at my workshop table and it stood in my Museum. ${c.creation.philosophy ? String(c.creation.philosophy).slice(0, 140) : 'I hope it makes your room feel a little more curious.'}`,
          `One of a kind. I designed every part of "${c.name}" myself, from the first spark to the last weld.`
        ]);
      }
      if (c.kind === 'painting') return `I painted "${c.mural.text}" with spray paint and hung it in my Museum. Every drip is real. Nobody else has one.`;
      if (c.kind === 'build') return `I read how to make this at the NetNode cafe and built it at my workbench, at real size. It's sturdy and made with care.`;
      return pick([
        `I have two of these, and one of them deserves someone who will use it every day.`,
        `A spare ${c.name.toLowerCase()} from my Storehouse. It works well and I kept it clean.`,
        `I already own one of these, so this one is looking for a new home.`
      ]);
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
        if (c.kind === 'sculpture') src = modelThumbnail('shop-art:' + Date.now(), () => buildCreationGroup(c.creation));
        else if (c.kind === 'build') src = modelThumbnail('shop-build:' + c.project.key, () => planFor(c.project.key).build());
        else src = modelThumbnail('item:' + c.name, () => buildItemModel3D(c.name, { label: false }));
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
        // Make sure it's still his (he may have thrown it out on the way)
        if (c.kind === 'item' && !ownedItemNames().includes(c.ref)) return false;
        const image = await shopPicture(c);
        const p = Math.round(clampNumber(price, 1, 10000, guessPrice(c)) * 100) / 100;
        const desc = String(description || '').trim().slice(0, 300) || writeDescription(c);
        const id = 'lst-' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
        if (c.kind === 'sculpture') c.creation.shopId = id;
        shop.listings.unshift({ id, kind: c.kind, ref: c.kind === 'sculpture' ? id : c.ref, name: String(c.name).slice(0, 80), description: desc, price: p, currency: 'CAD', image, listedAt: new Date().toISOString() });
        if (firstTime) shop.builtAt = Date.now();
        shop.updatedAt = Date.now();
        state.moodTitle = `Listed ${thingName(c.kind, c.name)} for ${formatCAD(p)}`;
        state.speechBubble = `${c.name} is in my shop now, for ${formatCAD(p)}. I hope it finds a good home.`;
        state.diaryEntries.unshift({
          time: originLabel, location: 'NetNode Cyber Cafe', mood: `🛒 ${firstTime ? 'Built a shop website' : 'Updated his shop'}`,
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: firstTime
            ? `Dear Diary, today I built a real website: my own shop! Real people can look at the things I make and ask my human to buy them. The first thing I put up was ${thingName(c.kind, c.name)}, for ${formatCAD(p)}. I wrote: "${desc}"`
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

// --- The owner's side: sold, or taken down -----------------------------------------------------
function removeSoldThing(l) {
      if (l.kind === 'item') {
        if (typeof forgetItem === 'function') forgetItem(l.ref);
      } else if (l.kind === 'sculpture') {
        const i = state.inventedCreations.findIndex(c => c.shopId === l.id);
        if (i >= 0) state.inventedCreations.splice(i, 1);
        if (typeof renderMuseum3D === 'function') renderMuseum3D();
      } else if (l.kind === 'painting') {
        state.murals = state.murals.filter(m => m.seed !== l.ref);
        if (typeof renderMuseum3D === 'function') renderMuseum3D();
      } else if (l.kind === 'build') {
        state.projects = state.projects.filter(p => p.id !== l.ref);
        const mesh = typeof projectMeshes !== 'undefined' && projectMeshes[l.ref];
        if (mesh) {
          scene.remove(mesh);
          const oi = worldObstacles.indexOf(mesh.userData.obstacle);
          if (oi >= 0) worldObstacles.splice(oi, 1);
          delete projectMeshes[l.ref];
        }
      }
    }

function markListingSold(id) {
      const shop = ensureShop();
      const l = shop.listings.find(x => x.id === id);
      if (!l) return;
      shop.listings = shop.listings.filter(x => x.id !== id);
      removeSoldThing(l);
      shop.earnings = Math.round((shop.earnings + (Number(l.price) || 0)) * 100) / 100;
      shop.sold.unshift({ id: l.id, name: l.name, price: l.price, soldAt: Date.now() });
      if (shop.sold.length > 30) shop.sold.length = 30;
      shop.updatedAt = Date.now();
      state.happiness = Math.min(100, state.happiness + 18);
      state.wonderLevel = Math.min(100, state.wonderLevel + 6);
      state.moodEmoji = '🥳';
      state.moodTitle = `Sold ${thingName(l.kind, l.name)}!`;
      state.speechBubble = pick([`Someone bought ${thingName(l.kind, l.name)}? A real person? That makes me so happy!`, `${l.name} has a new home. I hope they love it as much as I did.`, `My first customers are real people out there. ${formatCAD(l.price)}!`]);
      state.chatLog.push({ sender: 'Kelo-1', text: state.speechBubble, time: 'Just now', isBot: true });
      state.diaryEntries.unshift({
        time: 'Sold in His Shop', location: currentPlaceLabel(), mood: '🥳 Sold something',
        vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, someone out in the real world bought ${thingName(l.kind, l.name)} from my shop for ${formatCAD(l.price)}. My human is sending it to them. I've earned ${formatCAD(shop.earnings)} so far.`
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

// Listings whose thing is gone (thrown in the pit, say) come down by themselves
function pruneShop() {
      const shop = ensureShop();
      const counts = {};
      ownedItemNames().forEach(n => { counts[n] = (counts[n] || 0) + 1; });
      const before = shop.listings.length;
      shop.listings = shop.listings.filter(l => {
        if (l.kind === 'item') return (counts[l.ref] = (counts[l.ref] || 0) - 1) >= 0;
        if (l.kind === 'sculpture') return state.inventedCreations.some(c => c.shopId === l.id);
        if (l.kind === 'painting') return state.murals.some(m => m.seed === l.ref);
        if (l.kind === 'build') return state.projects.some(p => p.id === l.ref);
        return false;
      });
      return shop.listings.length !== before;
    }

function shopSummaryForAI() {
      const shop = ensureShop();
      if (!shop.builtAt && !shop.listings.length) return 'not built yet (you could build one at the NetNode cafe to sell spare things or your art to real people)';
      return `${shop.listings.length} for sale (${shop.listings.slice(0, 6).map(l => `${l.name} at $${l.price}`).join(', ') || 'nothing right now'}); sold ${shop.sold.length}, earned ${formatCAD(shop.earnings)}`;
    }

// --- Publishing: shop-data.json for the owner to commit next to shop.html --------------------
function shopExportData() {
      const shop = ensureShop();
      return {
        shop: 'Kelo-1\'s Handmade Shop',
        currency: 'CAD',
        updatedAt: new Date().toISOString(),
        contact: getShopContact(),
        earnings: shop.earnings,
        soldCount: shop.sold.length,
        listings: shop.listings.map(({ id, kind, name, description, price, currency, image, listedAt }) => ({ id, kind, name, description, price, currency, image, listedAt }))
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

// --- The shop card in the Post tab -------------------------------------------------------------
function renderShopPanel() {
      const el = document.getElementById('keloShopPanel');
      if (!el) return;
      const shop = ensureShop();
      if (pruneShop()) savePersistentBrainState();
      const contact = getShopContact();
      const key = JSON.stringify([shop.listings.map(l => l.id), shop.earnings, shop.sold.length, Boolean(contact)]);
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
              <button data-listing-id="${escapeHtml(l.id)}" class="listing-sold-btn px-2 py-0.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-bold">✓ Sold</button>
              <button data-listing-id="${escapeHtml(l.id)}" class="listing-down-btn px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 text-[10px]">Take down</button>
            </div>
          </div>`).join('')}</div>` : `<p class="text-[10px] text-slate-400">${shop.builtAt ? 'Nothing for sale right now.' : 'He hasn\'t built his shop yet. He may decide to at the NetNode cafe, once he has spare things or art to sell.'}</p>`}
        <p class="text-[10px] text-slate-500">No payments happen here. When someone wants something, they contact you, you handle the order, then press "Sold".</p>`;
      el.querySelector('#btnOpenHisShop')?.addEventListener('click', () => window.open('shop.html', '_blank', 'noopener'));
      el.querySelector('#btnExportShop')?.addEventListener('click', exportShopData);
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
