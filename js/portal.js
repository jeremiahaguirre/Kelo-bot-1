// Kelo-bot-1 — js/portal.js
// Loaded after main.js. The "Send Kelo-1 Something" portal in the Post Office tab: messages, small tools
// and toys (or anything you can name), and photos. Everything is mailed to the post office
// (js/postoffice.js); Kelo-1 picks it up when he chooses and decides what to do with each.

const GIFT_CATALOG = [
  { name: 'Magnifying glass', kind: 'tool', emoji: '🔍' },
  { name: 'Pocket compass', kind: 'tool', emoji: '🧭' },
  { name: 'Headlamp', kind: 'tool', emoji: '🔦' },
  { name: 'Multitool', kind: 'tool', emoji: '🛠️' },
  { name: 'Watercolor paint set', kind: 'tool', emoji: '🎨' },
  { name: 'Box kite', kind: 'toy', emoji: '🪁' },
  { name: 'Yo-yo', kind: 'toy', emoji: '🪀' },
  { name: 'Kaleidoscope', kind: 'toy', emoji: '🔭' },
  { name: 'Harmonica', kind: 'toy', emoji: '🎵' },
  { name: 'Rubber duck', kind: 'toy', emoji: '🦆' },
  { name: 'Spinning top', kind: 'toy', emoji: '🌀' },
  { name: 'Okanagan cherries', kind: 'food', emoji: '🍒' },
  { name: 'Cinnamon bun', kind: 'food', emoji: '🥐' }
];
const MAX_PHOTOS_PER_SEND = 4;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_ALBUM = keloStore.isDesktop ? 2000 : 12;
const ALBUM_STORAGE_KEY = 'kelo1_photo_album_v3';

let pendingPortalPhotos = [];

function portalVisitorName() {
      return (document.getElementById('visitorNameInput')?.value || 'curiousWanderer').trim().slice(0, 40) || 'curiousWanderer';
    }

// JPEG copy of a photo for the photo wall: small in the browser, larger in the desktop app
function makeThumbnail(dataUrl, maxSize = keloStore.isDesktop ? 640 : 220) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * scale));
          c.height = Math.max(1, Math.round(img.height * scale));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.72));
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
      });
    }

function loadPhotoAlbum() {
      try {
        const saved = JSON.parse(keloStore.getItem(ALBUM_STORAGE_KEY) || '[]');
        state.photoAlbum = Array.isArray(saved)
          ? saved.filter(p => p && typeof p.thumb === 'string' && p.thumb.startsWith('data:image/jpeg;base64,'))
          : [];
      } catch (e) {
        state.photoAlbum = [];
      }
    }

function savePhotoAlbum() {
      if (state.photoAlbum.length > MAX_ALBUM) state.photoAlbum.length = MAX_ALBUM;
      // If storage is full, drop the oldest photos until it fits
      for (let keep = state.photoAlbum.length; keep >= 0; keep--) {
        try {
          keloStore.setItem(ALBUM_STORAGE_KEY, JSON.stringify(state.photoAlbum.slice(0, keep)));
          return;
        } catch (e) {}
      }
    }

function setPortalMode(mode) {
      document.querySelectorAll('.portal-mode-btn').forEach(btn => {
        const active = btn.getAttribute('data-portal-mode') === mode;
        btn.className = 'portal-mode-btn ui-chip';
        btn.setAttribute('aria-selected', String(active));
      });
      document.querySelectorAll('.portal-pane').forEach(pane => {
        pane.classList.toggle('hidden', pane.getAttribute('data-portal-pane') !== mode);
      });
      try { localStorage.setItem('kelo1_portal_mode', mode); } catch (e) {}
    }

function renderMailbox() {
      const count = document.getElementById('mailboxCount');
      if (count) count.textContent = `${state.mailbox.length} waiting • ${state.lettersReceived || 0} picked up so far`;
      const list = document.getElementById('mailboxList');
      if (!list) return;
      perfSetHtml(list, state.mailbox.length === 0
        ? '<p class="text-2xs text-slate-500 italic">The post office is empty. Anything you send waits here until Kelo-1 decides to pick it up.</p>'
        : state.mailbox.map(m => `
          <div class="ui-row">
            ${m.thumbs && m.thumbs[0] ? `<img src="${escapeHtml(m.thumbs[0])}" alt="" class="w-8 h-8 rounded-lg object-cover shrink-0">` : `<span class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0" aria-hidden="true">${escapeHtml(m.emoji)}</span>`}
            <div class="min-w-0 flex-1">
              <div class="font-semibold text-white truncate">${escapeHtml(m.kind === 'message' ? 'Letter' : (m.name || m.kind))}</div>
              <div class="text-2xs tabular-nums text-slate-400 truncate">from ${escapeHtml(m.from)} • ${escapeHtml(m.time)}${m.note ? ` • "${escapeHtml(m.note.slice(0, 60))}"` : ''}</div>
            </div>
          </div>`).join(''));
    }

function renderPortal() {
      renderMailbox();
      if (typeof renderPostOfficeParcels3D === 'function') renderPostOfficeParcels3D();
      // Everything he owns
      const owned = [
        ...state.toolInventory.map(name => ({ name, emoji: '🛠️' })),
        ...state.toys.map(t => ({ name: t.name, emoji: t.emoji || '🪀' })),
        ...state.belongings.map(b => ({ name: b.name, emoji: b.emoji || '🎁' }))
      ];
      const countEl = document.getElementById('inventoryCountLabel');
      const lower = typeof storehouseBasementLevels === 'function' ? storehouseBasementLevels() : 0;
      if (countEl) countEl.textContent = `${owned.length} items${lower ? ` · ${lower + 1} floors` : ''}`;
      const pills = document.getElementById('toolInventoryPills');
      if (pills) {
        // Which floor each thing is on, worked out once (not once per pill), and a long list
        // shows the first PILLS_STEP with a "Show more" button (js/perf.js)
        const floorOf = new Map();
        if (typeof storedItems === 'function' && typeof shelfSlots !== 'undefined' && shelfSlots.length) {
          storedItems().forEach((it, i) => { if (!floorOf.has(it.name)) floorOf.set(it.name, Math.floor(i / shelfSlots.length)); });
        }
        // Things that get used up show how much is left: "Spray paint (2 of 3 left)" (js/itemuse.js)
        const seen = {};
        owned.forEach(o => { const nth = seen[o.name] = (seen[o.name] ?? -1) + 1; o.left = typeof supplyNote === 'function' ? supplyNote(o.name, nth) : ''; });
        const PILLS_STEP = 60;
        const shown = typeof perfListLimit === 'function' ? perfListLimit('toolInventoryPills', PILLS_STEP) : owned.length;
        const html = owned.slice(0, shown).map(o => `
          <span class="ui-chip">
            <span>${escapeHtml(o.emoji)}</span> ${escapeHtml(o.name)}${o.left ? ` <span class="text-emerald-300">(${escapeHtml(o.left)})</span>` : ''}${floorOf.get(o.name) > 0 ? ` <span class="text-slate-400">· B${floorOf.get(o.name)}</span>` : ''}
          </span>`).join('') + (typeof perfMoreButton === 'function' ? perfMoreButton('toolInventoryPills', shown, owned.length, PILLS_STEP) : '');
        if (typeof perfSetHtml === 'function') perfSetHtml(pills, html); else pills.innerHTML = html;
      }

      const logCount = document.getElementById('giftLogCount');
      if (logCount) logCount.textContent = `${state.giftLog.length} items`;
      const log = document.getElementById('giftLogList');
      if (log) {
        perfSetHtml(log, state.giftLog.length === 0
          ? '<p class="text-2xs text-slate-500 italic">Nothing yet. Gifts, deliveries and photos you send show up here with his reaction.</p>'
          : state.giftLog.map(g => `
          <div class="ui-row block space-y-0.5">
            <div class="flex items-center justify-between gap-2">
              <span class="font-semibold text-white truncate">${escapeHtml(g.emoji)} ${escapeHtml(g.name)} <span class="tabular-nums text-2xs text-slate-400">(${escapeHtml(g.type === 'request' ? 'requested ' : '')}${escapeHtml(g.category)})</span></span>
              <span class="text-2xs tabular-nums text-slate-400 shrink-0">${escapeHtml(g.time)}</span>
            </div>
            <div class="text-2xs tabular-nums text-slate-400">from ${escapeHtml(g.from)}${g.note ? ` • "${escapeHtml(g.note)}"` : ''}</div>
            ${g.reaction ? `<p class="text-2xs text-slate-300 font-serif italic">Kelo-1: "${escapeHtml(g.reaction)}"</p>` : '<p class="ui-loading text-2xs"><span class="ui-spinner" aria-hidden="true"></span>He is still thinking about it…</p>'}
          </div>`).join(''));
      }

      const wall = document.getElementById('photoWallGrid');
      // (only rebuilt, and its click handlers re-attached, when the photos change)
      if (wall && perfSetHtml(wall, state.photoAlbum.length === 0
          ? '<p class="col-span-full text-2xs text-slate-500 italic">No photos yet.</p>'
          : state.photoAlbum.map(ph => `
          <figure data-photo-idx="${state.photoAlbum.indexOf(ph)}" role="button" tabindex="0" aria-label="View photo" class="rounded-xl overflow-hidden border border-indigo-500/30 bg-slate-900 cursor-pointer hover:border-indigo-300 transition" title="${escapeHtml(ph.reaction || 'Click to view')}">
            <img src="${escapeHtml(ph.thumb)}" alt="${escapeHtml(ph.caption || 'Photo for Kelo-1')}" class="w-full h-20 object-cover">
            <figcaption class="px-1.5 py-1 text-2xs text-slate-300 truncate">${escapeHtml(ph.caption || `from ${ph.from}`)}</figcaption>
          </figure>`).join(''))) {
        wall.querySelectorAll('[data-photo-idx]').forEach(fig => {
          const open = () => typeof openPhotoViewer === 'function' && openPhotoViewer(Number(fig.getAttribute('data-photo-idx')));
          fig.addEventListener('click', open);
          fig.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
        });
      }
    }

function renderPhotoPreview() {
      const preview = document.getElementById('portalPhotoPreview');
      if (!preview) return;
      preview.innerHTML = pendingPortalPhotos.map((p, i) => `
        <div class="relative">
          <img src="${escapeHtml(p.thumb)}" alt="${escapeHtml(p.name)}" class="w-14 h-14 rounded-lg object-cover border border-sky-500/40">
          <button type="button" data-remove-photo="${i}" aria-label="Remove ${escapeHtml(p.name)}" class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-3xs text-white leading-none">✕</button>
        </div>`).join('');
      preview.querySelectorAll('[data-remove-photo]').forEach(btn => {
        btn.addEventListener('click', () => {
          pendingPortalPhotos.splice(Number(btn.getAttribute('data-remove-photo')), 1);
          renderPhotoPreview();
        });
      });
    }

function mailPendingPhotos(caption) {
      const photos = pendingPortalPhotos.splice(0, MAX_PHOTOS_PER_SEND);
      renderPhotoPreview();
      if (photos.length === 0) return;
      const first = photos[0].analyzed;
      postMail({
        kind: 'photo',
        from: portalVisitorName(),
        name: photos.length > 1 ? `${photos.length} photos` : 'A photo',
        note: String(caption || '').trim().slice(0, 200),
        thumbs: photos.map(p => p.thumb),
        palette: [first.primaryHex, first.secondaryHex],
        image: first
      });
    }

window.addEventListener('DOMContentLoaded', () => {
  loadPhotoAlbum();

  let mode = 'message';
  try { mode = localStorage.getItem('kelo1_portal_mode') || 'message'; } catch (e) {}
  setPortalMode(['message', 'gift', 'photo'].includes(mode) ? mode : 'message');
  document.querySelectorAll('.portal-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setPortalMode(btn.getAttribute('data-portal-mode')));
  });

  // Message
  const msgInput = document.getElementById('portalMessageInput');
  const msgCount = document.getElementById('portalMessageCount');
  msgInput?.addEventListener('input', () => { msgCount.textContent = `${msgInput.value.length} / 500`; });
  document.getElementById('portalMessageForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = msgInput.value.trim();
    if (!text) return;
    if (!postMail({ kind: 'message', from: portalVisitorName(), note: text })) return;
    msgInput.value = '';
    msgCount.textContent = '0 / 500';
    if (typeof uiFlash === 'function') uiFlash(e.submitter || e.target.querySelector('[type="submit"]'));
  });

  // Tools, toys, or anything else
  const catalog = document.getElementById('portalGiftCatalog');
  const giftName = document.getElementById('portalGiftName');
  const giftKind = document.getElementById('portalGiftKind');
  const giftNote = document.getElementById('portalGiftNote');
  let chosenEmoji = null;
  if (catalog) {
    catalog.innerHTML = GIFT_CATALOG.map((g, i) => `
      <button type="button" data-gift-idx="${i}" class="gift-chip ui-chip" aria-pressed="false">${escapeHtml(g.emoji)} ${escapeHtml(g.name)}</button>
    `).join('');
    catalog.querySelectorAll('.gift-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const g = GIFT_CATALOG[Number(chip.getAttribute('data-gift-idx'))];
        giftName.value = g.name;
        giftKind.value = g.kind;
        chosenEmoji = g.emoji;
        catalog.querySelectorAll('.gift-chip').forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
      });
    });
  }
  giftName?.addEventListener('input', () => { chosenEmoji = null; });
  document.getElementById('portalGiftForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = giftName.value.trim();
    if (!name) {
      showToast('Pick something from the list or type what you are sending.');
      return;
    }
    const kind = giftKind.value;
    const note = giftNote.value.trim();
    const category = categorizeItem(name, kind);
    const emoji = chosenEmoji || CATEGORY_ICONS[category] || '📦';
    if (!postMail({ kind: 'gift', from: portalVisitorName(), name, category, emoji, note })) return;
    giftName.value = '';
    giftNote.value = '';
    giftKind.value = '';
    chosenEmoji = null;
    catalog?.querySelectorAll('.gift-chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
    if (typeof uiFlash === 'function') uiFlash(e.submitter);
  });

  // Photos
  const photoInput = document.getElementById('portalPhotoInput');
  photoInput?.addEventListener('change', async () => {
    const files = Array.from(photoInput.files || []);
    photoInput.value = '';
    for (const file of files) {
      if (pendingPortalPhotos.length >= MAX_PHOTOS_PER_SEND) {
        showToast(`Up to ${MAX_PHOTOS_PER_SEND} photos at a time.`);
        break;
      }
      if (!file.type.startsWith('image/')) {
        showToast(`${file.name} is not an image.`);
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        showToast(`${file.name} is over 8 MB.`);
        continue;
      }
      const analyzed = await analyzeUploadedImage(file);
      const thumb = analyzed ? await makeThumbnail(analyzed.dataUrl) : null;
      if (!analyzed || !thumb) {
        showToast(`Could not read ${file.name}.`);
        continue;
      }
      pendingPortalPhotos.push({ name: file.name, analyzed, thumb });
    }
    renderPhotoPreview();
  });
  document.getElementById('portalPhotoForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (pendingPortalPhotos.length === 0) {
      showToast('Choose a photo first.');
      return;
    }
    const captionEl = document.getElementById('portalPhotoCaption');
    const caption = captionEl.value;
    captionEl.value = '';
    mailPendingPhotos(caption);
    if (typeof uiFlash === 'function') uiFlash(e.submitter);
  });

  document.getElementById('btnRingPostOfficeBell')?.addEventListener('click', () => ringPostOfficeBell());

  renderPortal();
});
