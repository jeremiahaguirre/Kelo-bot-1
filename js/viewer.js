// Kelo-bot-1 — js/viewer.js
// Loaded after museum.js. Full-screen viewers the visitor opens by clicking:
//   - the Storehouse or the Museum: everything inside, 12 at a time on wooden shelves, floor by floor,
//     with arrows to page through and an EXIT sign to go back to the world
//   - a photo on the photo wall: the picture full size, with arrows to the next one
// Items are shown as small rendered pictures of their real 3D models.

const SHELF_PAGE = 12;
// Pictures are drawn only for the page being looked at, and only the most recent 120 are kept
const thumbCache = typeof perfLRU === 'function' ? perfLRU(120) : new Map();
let thumbRenderer = null, thumbScene = null, thumbCamera = null;
let viewerState = null;
let thumbRedrawTimer = null;

// Render a 3D model to a small picture (one shared offscreen renderer)
function modelThumbnail(key, buildModel) {
      if (thumbCache.has(key)) return thumbCache.get(key);
      if (!thumbRenderer) {
        thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        thumbRenderer.setSize(192, 192);
        if (typeof renderer !== 'undefined' && renderer) thumbRenderer.outputEncoding = renderer.outputEncoding;
        // Same filmic look as the world (js/realism.js), a little brighter for small pictures
        if (typeof renderer !== 'undefined' && renderer) { thumbRenderer.toneMapping = renderer.toneMapping; thumbRenderer.toneMappingExposure = 0.85; }
        thumbScene = new THREE.Scene();
        thumbScene.add(new THREE.HemisphereLight(0xffffff, 0x8a6a4a, 1.0));
        const sun = new THREE.DirectionalLight(0xffffff, 0.9);
        sun.position.set(2, 4, 3);
        thumbScene.add(sun);
        thumbCamera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
      }
      let url = '', waiting = null;
      try {
        const model = buildModel();
        // A real model still loading: draw what's there now, then redraw once it arrives
        waiting = typeof realModelsPending === 'function' ? realModelsPending(model) : null;
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3(), center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        const r = Math.max(size.x, size.y, size.z) || 1;
        model.position.sub(center);
        thumbScene.add(model);
        thumbCamera.position.set(r * 1.25, r * 0.9, r * 1.9);
        thumbCamera.lookAt(0, 0, 0);
        thumbRenderer.render(thumbScene, thumbCamera);
        url = thumbRenderer.domElement.toDataURL('image/png');
        thumbScene.remove(model);
        model.traverse(o => { if (o.geometry && !o.userData.sharedGeometry) o.geometry.dispose(); });
      } catch (e) {}
      thumbCache.set(key, url);
      if (waiting) {
        // Keep the drawn model's picture until the real one arrives, then redraw the shelves once
        waiting.then(() => {
          thumbCache.delete(key);
          clearTimeout(thumbRedrawTimer);
          thumbRedrawTimer = setTimeout(() => { if (viewerState && viewerState.kind === 'shelves') renderViewer(); }, 250);
        });
      }
      return url;
    }

function storehouseViewerItems() {
      const seen = {};
      return storedItems().map((it, i) => ({
        // How much is left of things that get used up: "Spray paint (2 of 3 left)" (js/itemuse.js)
        label: typeof supplyLabel === 'function' ? supplyLabel(it.name, seen[it.name] = (seen[it.name] ?? -1) + 1) : it.name, name: it.name, floor: shelfSlots.length ? Math.floor(i / shelfSlots.length) : 0,
        image: () => modelThumbnail('item:' + it.name, () => buildItemModel3D(it.name, { label: false }))
      }));
    }

function museumViewerItems() {
      const perFloor = MUSEUM_PLINTHS.length || 8, perWall = MUSEUM_FRAMES.length || 8;
      const sculptures = allMuseumSculptures().map((c, i) => ({
        label: c.title || 'Untitled', name: c.title, floor: Math.floor(i / perFloor), sub: 'Sculpture',
        image: () => modelThumbnail('art:' + c.title + (c.createdTime || ''), () => buildCreationGroup(c))
      }));
      const paintings = allMuseumPaintings().map((m, i) => ({
        label: `"${m.text}"`, name: m.text, floor: Math.floor(i / perWall), sub: 'Painting', art: m.kind === 'art' ? m : null,
        image: () => {
          if (m.kind === 'art' && typeof paintingImageUrl === 'function') return paintingImageUrl(m, 'thumb');
          const key = 'paint:' + m.seed;
          if (!thumbCache.has(key)) thumbCache.set(key, paintMuralCanvas(m).toDataURL('image/jpeg', 0.85));
          return thumbCache.get(key);
        }
      }));
      // Floor by floor, sculptures then paintings
      return [...sculptures, ...paintings].sort((a, b) => a.floor - b.floor);
    }

// --- The shelf viewer -----------------------------------------------------------------------------
function openBuildingViewer(which) {
      const items = which === 'museum' ? museumViewerItems() : storehouseViewerItems();
      viewerState = { kind: 'shelves', which, items, page: 0 };
      renderViewer();
    }

function openPhotoViewer(index) {
      viewerState = { kind: 'photo', page: Math.max(0, Math.min(state.photoAlbum.length - 1, index)) };
      renderViewer();
    }

function closeViewer() {
      viewerState = null;
      const el = document.getElementById('keloViewer');
      if (el) el.remove();
    }

function viewerPages() {
      if (!viewerState) return 0;
      if (viewerState.kind === 'art') return 1;
      return viewerState.kind === 'photo' ? state.photoAlbum.length : Math.max(1, Math.ceil(viewerState.items.length / SHELF_PAGE));
    }

function turnViewerPage(step) {
      if (!viewerState) return;
      const pages = viewerPages();
      viewerState.page = (viewerState.page + step + pages) % pages;
      renderViewer();
    }

function renderViewer() {
      let el = document.getElementById('keloViewer');
      if (!el) {
        el = document.createElement('div');
        el.id = 'keloViewer';
        el.className = 'fixed inset-0 z-[60] flex flex-col bg-slate-950/95 backdrop-blur-sm';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        document.body.appendChild(el);
      }
      const pages = viewerPages();
      const nav = `
        <div class="shrink-0 flex items-center justify-center gap-3 p-3 border-t border-slate-800 bg-slate-950">
          <button data-viewer="prev" class="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xl font-bold" aria-label="Previous" ${pages < 2 ? 'disabled style="opacity:.35"' : ''}>◀</button>
          <span class="min-w-[7rem] text-center text-xs font-mono text-slate-300">${pages ? `${viewerState.page + 1} / ${pages}` : ''}</span>
          <button data-viewer="next" class="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xl font-bold" aria-label="Next" ${pages < 2 ? 'disabled style="opacity:.35"' : ''}>▶</button>
          <button data-viewer="exit" class="ml-4 px-4 h-12 rounded-lg bg-red-700 hover:bg-red-600 border-2 border-red-300 text-white font-bold tracking-widest text-sm flex items-center gap-2 shadow-lg" aria-label="Exit to the world"><span class="text-lg">🚪</span> EXIT</button>
        </div>`;
      if (viewerState.kind === 'art') {
        const m = viewerState.art;
        el.innerHTML = `
          <div class="shrink-0 px-4 py-3 text-sm font-bold text-white">🏛️ Museum of Art & Ideas</div>
          <div class="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 p-4">
            <img src="${escapeHtml(paintingImageUrl(m))}" alt="${escapeHtml(m.title)}" class="max-w-full max-h-[62vh] object-contain shadow-2xl ${['oil', 'acrylic'].includes(m.medium) ? 'border-[10px] border-amber-600' : 'border-[18px] border-stone-50 outline outline-[6px] outline-stone-800'}">
            <div class="text-center space-y-1 max-w-xl">
              <div class="text-base font-serif italic text-amber-100">"${escapeHtml(m.title)}"</div>
              <div class="text-2xs font-mono text-slate-300">${escapeHtml(m.on || m.medium)} · ${escapeHtml(m.size || '')} · ${escapeHtml(m.subjectLabel || '')}</div>
              <div class="text-2xs font-mono text-slate-500">Kelo-1, ${escapeHtml(m.season || '')} · skill ${escapeHtml(m.skill)}/100${m.keep ? ' · he is keeping this one' : ''}${m.for ? ` · painted for ${escapeHtml(m.for)}` : ''}</div>
            </div>
          </div>
          <div class="shrink-0 flex items-center justify-center gap-3 p-3 border-t border-slate-800 bg-slate-950">
            <button data-viewer="back" class="px-4 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-sm font-bold">◀ Back to the Museum</button>
            <button data-viewer="exit" class="ml-4 px-4 h-12 rounded-lg bg-red-700 hover:bg-red-600 border-2 border-red-300 text-white font-bold tracking-widest text-sm flex items-center gap-2 shadow-lg" aria-label="Exit to the world"><span class="text-lg">🚪</span> EXIT</button>
          </div>`;
        el.querySelector('[data-viewer="back"]').onclick = () => { viewerState = viewerState.back; renderViewer(); };
        el.querySelector('[data-viewer="exit"]').onclick = closeViewer;
        return;
      }
      if (viewerState.kind === 'photo') {
        const ph = state.photoAlbum[viewerState.page];
        el.innerHTML = `
          <div class="shrink-0 px-4 py-3 text-sm font-bold text-white">📷 Photo wall</div>
          <div class="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 p-4">
            ${ph ? `<img src="${escapeHtml(ph.thumb)}" alt="${escapeHtml(ph.caption || 'Photo')}" class="max-w-full max-h-[65vh] rounded-2xl border border-slate-700 object-contain shadow-2xl">
            <div class="text-center space-y-1 max-w-xl">
              <div class="text-sm text-slate-100">${escapeHtml(ph.caption || '')}</div>
              <div class="text-2xs font-mono text-slate-400">from ${escapeHtml(ph.from || '')}${ph.time ? ` • ${escapeHtml(ph.time)}` : ''}</div>
              ${ph.reaction ? `<p class="text-xs text-amber-200 italic font-serif">Kelo-1: "${escapeHtml(ph.reaction)}"</p>` : ''}
            </div>` : '<p class="text-slate-400">No photos yet.</p>'}
          </div>${nav}`;
      } else {
        const { which, items, page } = viewerState;
        const slice = items.slice(page * SHELF_PAGE, page * SHELF_PAGE + SHELF_PAGE);
        const floors = [...new Set(slice.map(i => i.floor))];
        const floorLabel = floors.map(f => (f === 0 ? 'Ground floor' : `Basement B${f}`)).join(' & ');
        const cell = (it) => it ? `
          <figure class="flex flex-col items-center justify-end gap-1 min-w-0">
            ${it.art ? `<button data-art="${escapeHtml(it.art.id)}" class="w-full max-w-[110px] aspect-square flex items-center" title="See it full size"><img src="${escapeHtml(it.image())}" alt="${escapeHtml(it.label)}" class="w-full object-contain drop-shadow-lg border-[3px] ${['oil', 'acrylic'].includes(it.art.medium) ? 'border-amber-600' : 'border-stone-800 bg-white p-1'}"></button>`
              : `<img src="${escapeHtml(it.image())}" alt="" class="w-full max-w-[110px] aspect-square object-contain drop-shadow-lg">`}
            <figcaption class="w-full text-center text-2xs leading-tight text-amber-50 bg-black/40 rounded px-1 py-0.5 truncate" title="${escapeHtml(it.label)}">${escapeHtml(it.label)}${it.sub ? ` <span class="text-amber-300/80">· ${escapeHtml(it.sub)}</span>` : ''}</figcaption>
            <div class="flex gap-1">
              ${it.sub === 'Painting' ? '' : `<button data-take="${which === 'museum' ? 'display' : 'use'}" data-name="${escapeHtml(it.name || '')}" class="px-1.5 py-0.5 rounded bg-emerald-700/80 hover:bg-emerald-600 text-3xs text-white">${which === 'museum' ? 'Put outside' : 'Use it'}</button>`}
              <button data-take="dispose" data-name="${escapeHtml(it.name || '')}" class="px-1.5 py-0.5 rounded bg-rose-800/80 hover:bg-rose-700 text-3xs text-white">Throw out</button>
            </div>
          </figure>` : '<div></div>';
        const rows = [0, 1, 2].map(r => `
          <div class="relative grid grid-cols-4 gap-2 px-3 pt-3 pb-4">
            ${[0, 1, 2, 3].map(c => cell(slice[r * 4 + c])).join('')}
            <div class="absolute inset-x-0 bottom-0 h-3 rounded-sm" style="background:linear-gradient(#c8955a,#8a5a2b);box-shadow:0 4px 6px rgba(0,0,0,.45)"></div>
          </div>`).join('');
        el.innerHTML = `
          <div class="shrink-0 px-4 py-3 flex items-center justify-between gap-2">
            <div class="text-sm font-bold text-white">${which === 'museum' ? '🏛️ Museum of Art & Ideas' : '📦 Storehouse'}</div>
            <div class="text-2xs font-mono text-slate-400">${items.length} ${which === 'museum' ? 'pieces' : 'items'}${items.length ? ` • ${escapeHtml(floorLabel)}` : ''}</div>
          </div>
          <div class="flex-1 min-h-0 overflow-auto p-3 flex justify-center">
            <div class="w-full max-w-3xl rounded-2xl p-2 space-y-1" style="background:${which === 'museum' ? 'linear-gradient(#f5f1e8,#d6d0c4)' : 'linear-gradient(#6b3a1f,#4a2810)'}">
              ${items.length ? rows : `<p class="p-8 text-center ${which === 'museum' ? 'text-stone-600' : 'text-amber-100'}">${which === 'museum' ? 'Nothing on display yet.' : 'The shelves are empty.'}</p>`}
            </div>
          </div>${nav}`;
      }
      el.querySelector('[data-viewer="prev"]').onclick = () => turnViewerPage(-1);
      el.querySelector('[data-viewer="next"]').onclick = () => turnViewerPage(1);
      el.querySelector('[data-viewer="exit"]').onclick = closeViewer;
      // A painting at full size
      el.querySelectorAll('[data-art]').forEach(btn => btn.addEventListener('click', () => {
        const m = allMuseumPaintings().find(p => p.id === btn.getAttribute('data-art'));
        if (m) { viewerState = { kind: 'art', art: m, back: viewerState }; renderViewer(); }
      }));
      // Suggest he takes something out: he does it as soon as he's free (js/takeout.js)
      el.querySelectorAll('[data-take]').forEach(btn => btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-name'), what = btn.getAttribute('data-take');
        const job = what === 'dispose' ? () => disposeItem(name, 'A visitor suggested it.', 'A Visitor Suggested It')
          : what === 'display' ? () => takeOutOfMuseum(name, 'display', 'A visitor suggested it.', 'A Visitor Suggested It')
          : () => takeOutToUse(name, 'a visitor suggested it');
        doWhenFree(job);
        showToast(what === 'dispose' ? `🗑️ Kelo-1 will throw out ${name} when he's free.` : `👍 Kelo-1 will take ${name} out when he's free.`);
        btn.disabled = true;
        btn.textContent = 'Asked ✓';
      }));
    }

// Clicking a building in the world (called from scene.js before the click is treated as ground)
function buildingAtClick(raycaster) {
      const hit = (group) => group && raycaster.intersectObject(group, true).length > 0;
      if (hit(typeof museumGroup !== 'undefined' ? museumGroup : null)) return 'museum';
      if (hit(typeof storehouseGroup !== 'undefined' ? storehouseGroup : null)) return 'storehouse';
      return null;
    }

window.addEventListener('keydown', (e) => {
  if (!viewerState) return;
  if (e.key === 'Escape') closeViewer();
  else if (e.key === 'ArrowLeft') turnViewerPage(-1);
  else if (e.key === 'ArrowRight') turnViewerPage(1);
});
