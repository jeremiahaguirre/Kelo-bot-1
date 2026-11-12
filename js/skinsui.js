// Kelo-bot-1 — js/skinsui.js
// The "Skins" section of the World tab: a card per skin with a small 3D picture of him in it, an
// Equipped chip, Equip for the ones he owns, and a lock, price and Buy for the rest. Tapping a card
// opens a big turning preview (try a look before buying). Buying goes through buySkin (js/skins.js).
//
// The pictures are drawn with the game's own renderer into an offscreen target (no second WebGL
// context): each skin once, then cached for the session.

const skinUI = { thumbs: new Map(), queue: [], drawing: false, preview: null, rt: null, scene: null, cam: null, lastFocus: null };

// --- A stand-alone Kelo-1 in a skin, for pictures (his live rig and globals are left alone) -------------
function buildKeloFigure(skinId) {
      const keep = {
        keloGroup, keloBody, keloHead, keloLeftArm, keloRightArm, keloLeftElbow, keloRightElbow, keloLeftHand, keloRightHand,
        keloLeftLeg, keloRightLeg, keloLeftKnee, keloRightKnee, keloLeftFoot, keloRightFoot, keloLeftEye, keloRightEye,
        keloMouth, keloCheeks, keloAntenna, keloDrillToolGroup, keloDrillBitMesh, keloWeldTorchGroup, keloWeldTipGlow, keloSkinBuilt, keloSkinRig
      };
      let fig;
      try {
        buildKelo1Character3D({ skin: skinId, detached: true });
        fig = { group: keloGroup, M: keloSkinBuilt.M, update: keloSkinBuilt.update, lArm: keloLeftArm, rArm: keloRightArm, lElbow: keloLeftElbow, rElbow: keloRightElbow, head: keloHead };
      } finally {
        ({ keloGroup, keloBody, keloHead, keloLeftArm, keloRightArm, keloLeftElbow, keloRightElbow, keloLeftHand, keloRightHand,
          keloLeftLeg, keloRightLeg, keloLeftKnee, keloRightKnee, keloLeftFoot, keloRightFoot, keloLeftEye, keloRightEye,
          keloMouth, keloCheeks, keloAntenna, keloDrillToolGroup, keloDrillBitMesh, keloWeldTorchGroup, keloWeldTipGlow, keloSkinBuilt, keloSkinRig } = keep);
      }
      // His standing pose: arms a little out, elbows soft
      fig.lArm.rotation.z = -0.12; fig.rArm.rotation.z = 0.12;
      fig.lElbow.rotation.x = -0.2; fig.rElbow.rotation.x = -0.2;
      return fig;
    }
function disposeKeloFigure(fig) {
      if (!fig) return;
      const keepGeo = new Set(typeof _keloHandParts !== 'undefined' && _keloHandParts ? Object.values(_keloHandParts) : []);
      const mats = keloDisposeTree(fig.group, keepGeo);
      mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      if (fig.group.parent) fig.group.parent.remove(fig.group);
    }

// The little photo studio: soft sky light, a key light and a rim light, the world's reflections
function skinStudio() {
      if (skinUI.scene) return skinUI;
      const s = new THREE.Scene();
      s.add(new THREE.HemisphereLight(0xdfeeff, 0x3a3f4a, 0.9));
      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(2.5, 4, 5);
      const rim = new THREE.DirectionalLight(0xbfd8ff, 1.2);
      rim.position.set(-3, 3, -4);
      s.add(key, rim, new THREE.AmbientLight(0xffffff, 0.25));
      skinUI.scene = s;
      skinUI.cam = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
      return skinUI;
    }

// Draw a figure from angle `yaw` into a 2D canvas (rendered at 2x and scaled down for smooth edges)
const _skinPx = { buf: null, img: null, tmp: null };
function drawKeloFigure(fig, yaw, canvas, ss = 2, view = {}) {
      if (typeof renderer === 'undefined' || !renderer) return false;
      const S = skinStudio();
      const W = canvas.width, H = canvas.height, RW = Math.round(W * ss), RH = Math.round(H * ss);
      if (!S.rt || S.rt.width !== RW || S.rt.height !== RH) {
        if (S.rt) S.rt.dispose();
        S.rt = new THREE.WebGLRenderTarget(RW, RH, { depthBuffer: true });
        S.rt.texture.encoding = renderer.outputEncoding;
      }
      S.scene.environment = (typeof scene !== 'undefined' && scene && scene.environment) || null;
      if (fig.group.parent !== S.scene) S.scene.add(fig.group);
      fig.group.position.set(0, 0, 0);
      fig.group.rotation.set(0, yaw, 0);
      S.cam.aspect = W / H;
      // frame the whole figure (skins have different heights), seen from view.elev radians above level
      if (!fig.box) { fig.group.updateMatrixWorld(true); fig.box = new THREE.Box3().setFromObject(fig.group); }
      const bh = fig.box.max.y - Math.min(0, fig.box.min.y), cy = bh * 0.5;
      const half = Math.tan(THREE.MathUtils.degToRad(S.cam.fov / 2));
      const dist = Math.max(bh * 0.56 / half, (fig.box.max.x - fig.box.min.x) * 0.62 / (half * S.cam.aspect));
      const el = view.elev || 0.08;
      S.cam.position.set(0, cy + Math.sin(el) * dist, Math.cos(el) * dist);
      S.cam.lookAt(0, cy, 0);
      S.cam.updateProjectionMatrix();
      const prevTarget = renderer.getRenderTarget(), prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
      const prevShadow = renderer.shadowMap.autoUpdate;
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(S.rt);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, true);
      renderer.render(S.scene, S.cam);
      const n = RW * RH * 4;
      if (!_skinPx.buf || _skinPx.buf.length !== n) _skinPx.buf = new Uint8Array(n);
      renderer.readRenderTargetPixels(S.rt, 0, 0, RW, RH, _skinPx.buf);
      renderer.setRenderTarget(prevTarget);
      renderer.setClearColor(prevClear, prevAlpha);
      renderer.shadowMap.autoUpdate = prevShadow;
      // flip (GL rows run bottom-up) into a full-size canvas, then scale down
      if (!_skinPx.tmp) _skinPx.tmp = document.createElement('canvas');
      const tmp = _skinPx.tmp;
      if (tmp.width !== RW || tmp.height !== RH) { tmp.width = RW; tmp.height = RH; _skinPx.img = null; }
      const tctx = tmp.getContext('2d');
      if (!_skinPx.img) _skinPx.img = tctx.createImageData(RW, RH);
      const out = _skinPx.img.data, src = _skinPx.buf, row = RW * 4;
      for (let y = 0; y < RH; y++) out.set(src.subarray((RH - 1 - y) * row, (RH - y) * row), y * row);
      tctx.putImageData(_skinPx.img, 0, 0);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, W, H);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(tmp, 0, 0, W, H);
      return true;
    }

// A skin's card picture (once per session), drawn one per frame so opening the tab never stalls
function keloSkinThumb(id) { return skinUI.thumbs.get(id) || null; }
function queueSkinThumbs() {
      KELO_SKINS.forEach(s => { if (!skinUI.thumbs.has(s.id) && !skinUI.queue.includes(s.id)) skinUI.queue.push(s.id); });
      if (skinUI.drawing || !skinUI.queue.length) return;
      skinUI.drawing = true;
      const step = () => {
        const id = skinUI.queue.shift();
        if (!id) { skinUI.drawing = false; return; }
        let fig = null;
        try {
          fig = buildKeloFigure(id);
          const c = document.createElement('canvas');
          c.width = 240; c.height = 240;
          if (drawKeloFigure(fig, 0.42, c)) {
            skinUI.thumbs.set(id, c.toDataURL('image/png'));
            document.querySelectorAll(`img[data-skin-thumb="${id}"]`).forEach(img => { img.src = skinUI.thumbs.get(id); img.classList.remove('opacity-0'); });
          }
        } catch (e) { console.warn('Skin picture failed', id, e); }
        finally { disposeKeloFigure(fig); }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

// --- The section --------------------------------------------------------------------------------------
function skinCardHtml(s) {
      const owned = keloOwnsSkin(s.id), on = keloEquippedSkinId() === s.id;
      const name = escapeHtml(s.name), rarity = escapeHtml(KELO_SKIN_RARITY[s.rarity] || s.rarity);
      const thumb = keloSkinThumb(s.id);
      const img = `<img data-skin-thumb="${escapeHtml(s.id)}" alt="" class="skin-thumb${thumb ? '' : ' opacity-0'}" ${thumb ? `src="${thumb}"` : ''} width="120" height="120">`;
      let action;
      if (on) action = `<span class="ui-chip skin-equipped"><i class="ph-bold ph-check" data-hud-emoji="✓" aria-hidden="true"></i>Equipped</span>`;
      else if (owned) action = `<button type="button" class="ui-btn ui-btn-sm" data-skin-equip="${escapeHtml(s.id)}" aria-label="Equip ${name}">Equip</button>`;
      else action = `<button type="button" class="ui-btn ui-btn-sm" data-skin-buy="${escapeHtml(s.id)}" aria-label="Buy ${name} for ${escapeHtml(formatSkinPrice(s))}">Buy</button>`;
      return `<li class="skin-card${owned ? '' : ' skin-locked'}${on ? ' skin-on' : ''}" data-skin="${escapeHtml(s.id)}">
        <button type="button" class="skin-face" data-skin-preview="${escapeHtml(s.id)}" aria-label="Preview ${name}${owned ? '' : ', locked'}">
          <span class="skin-pic">${img}${owned ? '' : '<i class="ph-bold ph-lock-simple skin-lock" data-hud-emoji="🔒" aria-hidden="true"></i>'}</span>
          <span class="skin-name">${name}</span>
          <span class="skin-sub">${owned ? rarity : `${escapeHtml(formatSkinPrice(s))} · ${rarity}`}</span>
        </button>
        <div class="skin-act">${action}</div>
      </li>`;
    }

function renderKeloSkinsPanel() {
      const grid = document.getElementById('skinsGrid');
      if (!grid || typeof KELO_SKINS === 'undefined') return;
      normalizeKeloSkins();
      grid.innerHTML = KELO_SKINS.map(skinCardHtml).join('');
      const meta = document.getElementById('skinsMeta');
      if (meta) meta.textContent = `${state.skins.owned.length}/${KELO_SKINS.length}`;
      const note = document.getElementById('skinsNote');
      if (note) note.textContent = KELO_DEV_UNLOCK
        ? 'Dev mode: Buy unlocks a look for free. No payment is taken.'
        : 'Payments coming soon. Looks he already has stay his.';
      if (skinUI.preview) skinPreviewActions();
      const pane = document.getElementById('tab-world');
      if (pane && !pane.classList.contains('hidden')) queueSkinThumbs();
    }

// --- Big turning preview ------------------------------------------------------------------------------------
function openSkinPreview(id) {
      const skin = KELO_SKIN_BY_ID[id];
      const dlg = document.getElementById('skinPreviewDialog');
      if (!skin || !dlg) return;
      closeSkinPreview(true);
      skinUI.lastFocus = document.activeElement;
      document.getElementById('skinPreviewTitle').textContent = skin.name;
      document.getElementById('skinPreviewBlurb').textContent = skin.blurb;
      document.getElementById('skinPreviewRarity').textContent = `${KELO_SKIN_RARITY[skin.rarity] || skin.rarity} · ${formatSkinPrice(skin)}`;
      const canvas = document.getElementById('skinPreviewCanvas');
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const css = Math.min(320, Math.max(200, (dlg.clientWidth || 360) - 80));
      canvas.style.width = canvas.style.height = `${css}px`;
      canvas.width = canvas.height = Math.round(css * dpr);
      skinUI.preview = { id, fig: buildKeloFigure(id), yaw: 0.4, spin: 0.6, drag: null, raf: 0, last: 0 };
      skinPreviewActions();
      dlg.classList.remove('hidden');
      const tick = now => {
        const P = skinUI.preview;
        if (!P) return;
        // about 20 pictures a second is plenty for a turntable, and leaves the game its frames
        if (P.last && now - P.last < 48) { P.raf = requestAnimationFrame(tick); return; }
        const dt = P.last ? Math.min(0.1, (now - P.last) / 1000) : 0;
        P.last = now;
        if (!P.drag) P.yaw += P.spin * dt;
        // he turns his head a little and bobs his antenna while you look
        P.fig.head.rotation.y = Math.sin(now / 1400) * 0.18;
        try { drawKeloFigure(P.fig, P.yaw, canvas, 1.25); } catch (e) {}
        P.raf = requestAnimationFrame(tick);
      };
      skinUI.preview.raf = requestAnimationFrame(tick);
      (document.querySelector('#skinPreviewActions .ui-btn-primary') || document.getElementById('btnCloseSkinPreview')).focus();
    }

function skinPreviewActions() {
      const P = skinUI.preview, box = document.getElementById('skinPreviewActions');
      if (!P || !box) return;
      const s = KELO_SKIN_BY_ID[P.id], owned = keloOwnsSkin(P.id), on = keloEquippedSkinId() === P.id;
      let html = '';
      if (on) html = '<span class="ui-chip"><i class="ph-bold ph-check" data-hud-emoji="✓" aria-hidden="true"></i>Equipped</span>';
      else if (owned) html = `<button type="button" class="ui-btn ui-btn-primary" data-skin-equip="${escapeHtml(s.id)}"><i class="ph-bold ph-t-shirt" data-hud-emoji="👕" aria-hidden="true"></i>Equip</button>`;
      else html = `<button type="button" class="ui-btn ui-btn-primary" data-skin-buy="${escapeHtml(s.id)}"><i class="ph-bold ph-lock-simple-open" data-hud-emoji="🔓" aria-hidden="true"></i>Buy for ${escapeHtml(formatSkinPrice(s))}</button>`;
      box.innerHTML = html;
    }

function closeSkinPreview(silent) {
      const P = skinUI.preview;
      if (P) { cancelAnimationFrame(P.raf); disposeKeloFigure(P.fig); }
      skinUI.preview = null;
      const dlg = document.getElementById('skinPreviewDialog');
      if (dlg) dlg.classList.add('hidden');
      if (!silent && skinUI.lastFocus && skinUI.lastFocus.focus) { try { skinUI.lastFocus.focus(); } catch (e) {} }
    }

// --- The mock payment's confirm sheet ---------------------------------------------------------------------
function skinConfirmSheet(skin) {
      return new Promise(resolve => {
        const dlg = document.getElementById('skinBuyDialog');
        if (!dlg) return resolve(false);
        const back = document.activeElement;
        document.getElementById('skinBuyTitle').textContent = `Unlock ${skin.name}?`;
        document.getElementById('skinBuyPrice').textContent = formatSkinPrice(skin);
        dlg.classList.remove('hidden');
        const yes = document.getElementById('btnSkinBuyYes'), no = document.getElementById('btnSkinBuyNo');
        const done = v => {
          dlg.classList.add('hidden');
          yes.removeEventListener('click', onYes); no.removeEventListener('click', onNo); dlg.removeEventListener('keydown', onKey);
          try { if (back && back.focus && document.contains(back)) back.focus(); } catch (e) {}
          resolve(v);
        };
        const onYes = () => done(true), onNo = () => done(false);
        const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } else skinTrapTab(e, dlg); };
        yes.addEventListener('click', onYes); no.addEventListener('click', onNo); dlg.addEventListener('keydown', onKey);
        yes.focus();
      });
    }

// Keep Tab inside an open dialog
function skinTrapTab(e, dlg) {
      if (e.key !== 'Tab') return;
      const f = [...dlg.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled && el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

async function skinBuyClicked(id) {
      const r = await buySkin(id);
      if (r && r.ok && !r.already) {
        renderKeloSkinsPanel();
        const card = document.querySelector(`[data-skin-equip="${id}"]`);
        if (card && typeof uiFlash === 'function') uiFlash(card);
      }
      return r;
    }

// --- Wiring --------------------------------------------------------------------------------------------------
function initKeloSkinsUI() {
      const grid = document.getElementById('skinsGrid');
      const dlg = document.getElementById('skinPreviewDialog');
      if (!grid) return;
      const onClick = e => {
        const t = e.target.closest('[data-skin-equip], [data-skin-buy], [data-skin-preview]');
        if (!t) return;
        if (t.dataset.skinEquip) { equipKeloSkin(t.dataset.skinEquip); renderKeloSkinsPanel(); const b = document.querySelector(`[data-skin-preview="${t.dataset.skinEquip}"]`); if (b && !skinUI.preview) b.focus(); }
        else if (t.dataset.skinBuy) skinBuyClicked(t.dataset.skinBuy);
        else if (t.dataset.skinPreview) openSkinPreview(t.dataset.skinPreview);
      };
      grid.addEventListener('click', onClick);
      if (dlg) {
        dlg.addEventListener('click', e => { if (e.target === dlg) closeSkinPreview(); else onClick(e); });
        dlg.addEventListener('keydown', e => {
          const P = skinUI.preview;
          if (e.key === 'Escape') { e.stopPropagation(); closeSkinPreview(); return; }
          if (P && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target.id === 'skinPreviewCanvas') { e.preventDefault(); P.spin = 0; P.yaw += e.key === 'ArrowLeft' ? -0.3 : 0.3; }
          skinTrapTab(e, dlg);
        });
        document.getElementById('btnCloseSkinPreview')?.addEventListener('click', () => closeSkinPreview());
        const cv = document.getElementById('skinPreviewCanvas');
        cv.addEventListener('pointerdown', e => { const P = skinUI.preview; if (!P) return; P.drag = { x: e.clientX, yaw: P.yaw }; P.spin = 0; cv.setPointerCapture(e.pointerId); });
        cv.addEventListener('pointermove', e => { const P = skinUI.preview; if (P && P.drag) P.yaw = P.drag.yaw + (e.clientX - P.drag.x) * 0.012; });
        const up = () => { const P = skinUI.preview; if (P) P.drag = null; };
        cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      }
      const dev = document.getElementById('devUnlockToggle');
      if (dev) {
        dev.checked = KELO_DEV_UNLOCK;
        dev.addEventListener('change', () => setKeloDevUnlock(dev.checked));
      }
      document.addEventListener('kelo-menu-shown', e => { if (e.detail && e.detail.tab === 'world') { renderKeloSkinsPanel(); queueSkinThumbs(); } });
      renderKeloSkinsPanel();
    }
window.addEventListener('DOMContentLoaded', () => setTimeout(initKeloSkinsUI, 0));
