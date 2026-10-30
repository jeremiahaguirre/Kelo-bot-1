// Kelo-bot-1 — js/portal.js
// Loaded last. The "Send Kelo-1 Something" portal in the Post Office tab: messages, small tools
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
const ALBUM_STORAGE_KEY = 'kelo1_photo_album_v2';

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
        btn.className = `portal-mode-btn px-2.5 py-1 rounded-lg transition ${active ? 'bg-sky-500/30 text-sky-100' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`;
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
      list.innerHTML = state.mailbox.length === 0
        ? '<p class="text-[11px] text-slate-500 italic">The post office is empty. Anything you send waits here until Kelo-1 decides to pick it up.</p>'
        : state.mailbox.map(m => `
          <div class="flex items-center gap-2 p-2 rounded-xl bg-slate-900/80 border border-red-500/25 text-xs">
            ${m.thumbs && m.thumbs[0] ? `<img src="${escapeHtml(m.thumbs[0])}" alt="" class="w-8 h-8 rounded-lg object-cover shrink-0">` : `<span class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">${escapeHtml(m.emoji)}</span>`}
            <div class="min-w-0 flex-1">
              <div class="font-semibold text-red-100 truncate">${escapeHtml(m.kind === 'message' ? 'Letter' : (m.name || m.kind))}</div>
              <div class="text-[10px] font-mono text-slate-400 truncate">from ${escapeHtml(m.from)} • ${escapeHtml(m.time)}${m.note ? ` • "${escapeHtml(m.note.slice(0, 60))}"` : ''}</div>
            </div>
          </div>`).join('');
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
      if (countEl) countEl.textContent = `${owned.length} Items`;
      const pills = document.getElementById('toolInventoryPills');
      if (pills) {
        pills.innerHTML = owned.map(o => `
          <span class="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-200 text-[10px] font-mono flex items-center gap-1">
            <span>${escapeHtml(o.emoji)}</span> ${escapeHtml(o.name)}
          </span>`).join('');
      }

      const logCount = document.getElementById('giftLogCount');
      if (logCount) logCount.textContent = `${state.giftLog.length} items`;
      const log = document.getElementById('giftLogList');
      if (log) {
        log.innerHTML = state.giftLog.length === 0
          ? '<p class="text-[11px] text-slate-500 italic">Nothing yet. Gifts, deliveries and photos you send show up here with his reaction.</p>'
          : state.giftLog.map(g => `
          <div class="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-0.5">
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-rose-200 truncate">${escapeHtml(g.emoji)} ${escapeHtml(g.name)} <span class="font-mono text-[10px] text-slate-400">(${escapeHtml(g.type === 'request' ? 'requested ' : '')}${escapeHtml(g.category)})</span></span>
              <span class="text-[10px] font-mono text-slate-500 shrink-0">${escapeHtml(g.time)}</span>
            </div>
            <div class="text-[10px] font-mono text-slate-400">from ${escapeHtml(g.from)}${g.note ? ` • "${escapeHtml(g.note)}"` : ''}</div>
            ${g.reaction ? `<p class="text-[11px] text-slate-300 font-serif italic">Kelo-1: "${escapeHtml(g.reaction)}"</p>` : '<p class="text-[11px] text-slate-500 italic">Thinking about it...</p>'}
          </div>`).join('');
      }

      const wall = document.getElementById('photoWallGrid');
      if (wall) {
        wall.innerHTML = state.photoAlbum.length === 0
          ? '<p class="col-span-full text-[11px] text-slate-500 italic">No photos yet.</p>'
          : state.photoAlbum.map(ph => `
          <figure class="rounded-xl overflow-hidden border border-indigo-500/30 bg-slate-900" title="${escapeHtml(ph.reaction || '')}">
            <img src="${escapeHtml(ph.thumb)}" alt="${escapeHtml(ph.caption || 'Photo for Kelo-1')}" class="w-full h-20 object-cover">
            <figcaption class="px-1.5 py-1 text-[10px] text-slate-300 truncate">${escapeHtml(ph.caption || `from ${ph.from}`)}</figcaption>
          </figure>`).join('');
      }
    }

function renderPhotoPreview() {
      const preview = document.getElementById('portalPhotoPreview');
      if (!preview) return;
      preview.innerHTML = pendingPortalPhotos.map((p, i) => `
        <div class="relative">
          <img src="${escapeHtml(p.thumb)}" alt="${escapeHtml(p.name)}" class="w-14 h-14 rounded-lg object-cover border border-sky-500/40">
          <button type="button" data-remove-photo="${i}" aria-label="Remove ${escapeHtml(p.name)}" class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[9px] text-white leading-none">✕</button>
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
  });

  // Tools, toys, or anything else
  const catalog = document.getElementById('portalGiftCatalog');
  const giftName = document.getElementById('portalGiftName');
  const giftKind = document.getElementById('portalGiftKind');
  const giftNote = document.getElementById('portalGiftNote');
  let chosenEmoji = null;
  if (catalog) {
    catalog.innerHTML = GIFT_CATALOG.map((g, i) => `
      <button type="button" data-gift-idx="${i}" class="gift-chip px-2 py-1 rounded-xl bg-slate-950 hover:bg-amber-500/20 border border-slate-800 hover:border-amber-400/40 text-[11px] text-slate-200 transition">${escapeHtml(g.emoji)} ${escapeHtml(g.name)}</button>
    `).join('');
    catalog.querySelectorAll('.gift-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const g = GIFT_CATALOG[Number(chip.getAttribute('data-gift-idx'))];
        giftName.value = g.name;
        giftKind.value = g.kind;
        chosenEmoji = g.emoji;
        catalog.querySelectorAll('.gift-chip').forEach(c => c.classList.toggle('border-amber-400', c === chip));
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
    catalog?.querySelectorAll('.gift-chip').forEach(c => c.classList.remove('border-amber-400'));
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
  });

  document.getElementById('btnRingPostOfficeBell')?.addEventListener('click', () => ringPostOfficeBell());

  renderPortal();
});
