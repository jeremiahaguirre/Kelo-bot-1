// Kelo-bot-1 — js/portal.js
// Loaded last. The "Send Kelo-1 Something" portal in the Requests tab: messages, small tools
// and toys (or anything you can name), and photos. Kelo-1 decides what to do with each.

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
const MAX_ALBUM = 12;
const ALBUM_STORAGE_KEY = 'kelo1_photo_album_v1';

let pendingPortalPhotos = [];

function portalVisitorName() {
      return (document.getElementById('visitorNameInput')?.value || 'curiousWanderer').trim().slice(0, 40) || 'curiousWanderer';
    }

// Small JPEG copy of a photo for the photo wall (keeps localStorage usage low)
function makeThumbnail(dataUrl, maxSize = 220) {
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
        const saved = JSON.parse(localStorage.getItem(ALBUM_STORAGE_KEY) || '[]');
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
          localStorage.setItem(ALBUM_STORAGE_KEY, JSON.stringify(state.photoAlbum.slice(0, keep)));
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

function renderPortal() {
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

async function sendPhotosToKelo(caption) {
      const photos = pendingPortalPhotos.splice(0, MAX_PHOTOS_PER_SEND);
      renderPhotoPreview();
      if (photos.length === 0) return;
      const from = portalVisitorName();
      const cleanCaption = String(caption || '').trim().slice(0, 200);
      const time = new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

      const albumEntries = photos.map(p => ({ thumb: p.thumb, caption: cleanCaption, from, palette: [p.analyzed.primaryHex, p.analyzed.secondaryHex], time, reaction: '' }));
      state.photoAlbum.unshift(...albumEntries);
      const logEntry = { type: 'photo', name: photos.length > 1 ? `${photos.length} photos` : 'A photo', category: 'photo', emoji: '📷', from, note: cleanCaption, time, reaction: '' };
      state.giftLog.unshift(logEntry);
      recordVisitorMemory(from, `Sent me ${logEntry.name.toLowerCase()}${cleanCaption ? ` ("${cleanCaption.slice(0, 60)}")` : ''}.`);
      state.chatLog.push({ sender: from, text: `📷 Sent Kelo-1 ${logEntry.name.toLowerCase()}${cleanCaption ? `: "${cleanCaption}"` : ''}`, time: 'Just now', isBot: false });
      savePhotoAlbum();
      renderAllUI();
      showToast(`📷 Sent ${logEntry.name.toLowerCase()} to Kelo-1`);

      // One decision for the batch; the AI brain (if any) sees the first photo itself
      const first = photos[0].analyzed;
      await decideNextAction(
        `${from} sent you ${logEntry.name.toLowerCase()}${cleanCaption ? ` captioned "${cleanCaption}"` : ''}. The main colors are ${first.primaryHex} and ${first.secondaryHex}. Look at it and decide for yourself what, if anything, it makes you want to do, build, ask, or think about.`,
        `Photo from ${from}`,
        { focus: cleanCaption || 'photo', image: first }
      );
      logEntry.reaction = state.speechBubble;
      albumEntries.forEach(e => { e.reaction = state.speechBubble; });
      state.chatLog.push({ sender: 'Kelo-1', text: state.speechBubble, time: 'Just now', isBot: true });
      savePhotoAlbum();
      savePersistentBrainState();
      renderAllUI();
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
    msgInput.value = '';
    msgCount.textContent = '0 / 500';
    handleVisitorChatMessage(text);
    showToast('✉️ Message delivered to Kelo-1');
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
    const emoji = chosenEmoji;
    giftName.value = '';
    giftNote.value = '';
    giftKind.value = '';
    chosenEmoji = null;
    catalog?.querySelectorAll('.gift-chip').forEach(c => c.classList.remove('border-amber-400'));
    showToast(`🎁 Sent "${name}" to Kelo-1`);
    await receiveItem(name, kind, portalVisitorName(), note, { type: 'gift', emoji: emoji || undefined });
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
    sendPhotosToKelo(caption);
  });

  renderPortal();
});
