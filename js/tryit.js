// Kelo-bot-1 — js/tryit.js
// Loaded after minimap.js. The "Try it" panel in the menu's World tab, so you can see his world's
// features on demand instead of waiting for them:
//   - Season preview: make it winter, spring, summer or autumn right now (the colours, the snow on
//     the ground and the snow logic all follow it)
//   - Night or day preview
//   - Wind: calm, breezy, windy or a gale (js/wind.js windOverride)
//   - Rain: a spring shower or a dry spell (js/weather.js rainOverride)
//   - Sample gifts: real parcels posted to his Post Office, each with what it lets him do
// Previews are only for this visit: they are kept in this file, never in his saved state, so a
// reload (or "Back to his real calendar") returns his own calendar, clock and weather.
// The gifts are real: he picks them up and keeps them like any other gift.

let previewSeason = null;   // 'Winter' | 'Spring' | 'Summer' | 'Autumn' | null for his real season
let previewHour = null;     // an hour of his day (0-24), or null for his real clock

// The override hook: every part of the game asks worldNow() (js/worldclock.js) for the season and
// the hour, so this wraps it and swaps in the preview while one is on. Days still count normally.
const realWorldNow = worldNow;
worldNow = function (now) {
      const w = realWorldNow(now);
      if (!previewSeason && previewHour === null) return w;
      const out = { ...w, preview: true };
      if (previewSeason) out.season = previewSeason;
      if (previewHour !== null) {
        out.hour = previewHour;
        out.isNight = previewHour < 5.5 || previewHour >= 21;
      }
      return out;
    };

const TRY_SEASONS = [
  { key: 'Winter', emoji: '❄️', hint: 'Snow covers the valley and falls from the sky; he sinks in it without snowshoes. The lake freezes, and he only walks on it once he has tested the ice.' },
  { key: 'Spring', emoji: '🌸', hint: 'Fresh green leaves and spring showers; snow only high on the mountain.' },
  { key: 'Summer', emoji: '☀️', hint: 'Deep green, and the least snow on the peaks.' },
  { key: 'Autumn', emoji: '🍂', hint: 'Orange leaves and windier days.' }
];

const TRY_WIND = [
  { key: 'calm', label: 'Calm', emoji: '🍃' },
  { key: 'breeze', label: 'Breeze', emoji: '💨' },
  { key: 'windy', label: 'Windy', emoji: '🌬️' },
  { key: 'gale', label: 'Gale', emoji: '🌪️' }
];

// Sample gifts: each item is posted as its own parcel so he recognises every one
const TRY_GIFTS = [
  { emoji: '🪓', items: ['An axe'], kinds: ['tool'], unlocks: 'Lets him chop valley trees for firewood, once he has read how at NetNode.' },
  { emoji: '🌱', items: ['A packet of tree seeds'], kinds: ['material'], unlocks: 'He plants them and they grow into young trees over a few of his days.' },
  { emoji: '🛣️', items: ['A load of gravel', 'A sturdy shovel'], kinds: ['material', 'tool'], unlocks: 'The shovel lets him dig; with the gravel he can lay a road across the valley.' },
  { emoji: '🧺', items: ['Pine planks', 'A box of wood screws', 'A hand saw', 'A cordless drill'], kinds: ['material', 'material', 'tool', 'tool'], unlocks: 'Everything a real picnic table build needs: he will build one and place it.' },
  { emoji: '🐕', items: ['A bundle of asphalt roof shingles', 'A box of nails', 'A claw hammer', 'A hand saw'], kinds: ['material', 'material', 'tool', 'tool'], unlocks: 'A doghouse kit without the lumber: with logs from a tree he chopped, he saws his own boards for it.' },
  { emoji: '🥾', items: ['A pair of snowshoes'], kinds: ['tool'], unlocks: 'In winter he walks on top of the snow instead of sinking and getting stuck.' },
  { emoji: '🪁', items: ['A kite'], kinds: ['toy'], unlocks: 'Starts kite flying in the meadow whenever there is a breeze (try Wind: Breeze).' },
  { emoji: '🚚', items: ['A dump truck', 'A jerry can of diesel'], kinds: ['vehicle', 'fuel'], unlocks: 'He can haul dug dirt to the Disposal Pit or tip it in the lake to make new land; the diesel fills its tank.' },
  { emoji: '🧵', items: ['A spool of PLA filament'], kinds: ['material'], unlocks: 'Feeds his 3D printer, so he can print things for his shop and Museum.' }
];

function tryPreviewActive() {
      return Boolean(previewSeason || previewHour !== null || (typeof windOverride !== 'undefined' && windOverride) || (typeof rainOverride !== 'undefined' && rainOverride !== null));
    }

// Make everything that depends on the season, the hour or the wind catch up straight away
function tryRefreshWorld() {
      if (typeof applySeasonLook === 'function') applySeasonLook();
      if (typeof applyTimeOfDay === 'function') applyTimeOfDay();
      if (typeof renderClockUI === 'function') renderClockUI();
      if (typeof minimapBuildBase === 'function' && typeof minimap !== 'undefined' && minimap.canvas) minimapBuildBase();
      tryRenderPanel();
      tryRenderChip();
    }

function trySetSeason(season) {
      previewSeason = season;
      tryRefreshWorld();
      if (season) showToast(`${TRY_SEASONS.find(s => s.key === season).emoji} Preview: it is ${season.toLowerCase()} now`);
    }

function trySetHour(hour) {
      previewHour = hour;
      // Fixed lighting would hide the change, so go back to the automatic day-and-night light
      if (hour !== null && state.lightingMode === 'manual') {
        state.lightingMode = 'auto';
        if (typeof renderAllUI === 'function') renderAllUI();
      }
      tryRefreshWorld();
      if (hour !== null) showToast(hour >= 21 || hour < 5.5 ? '🌙 Preview: night' : '☀️ Preview: midday');
    }

function trySetWind(key) {
      if (typeof windOverride === 'undefined') return;
      windOverride = key;
      tryRefreshWorld();
      if (key) showToast(`${TRY_WIND.find(w => w.key === key).emoji} Preview wind: ${key}`);
    }

// Rain comes in spring, so a shower preview makes it spring too
function trySetRain(on) {
      if (typeof rainOverride === 'undefined') return;
      rainOverride = on;
      if (on && realWorldNow().season !== 'Spring' && !previewSeason) previewSeason = 'Spring';
      tryRefreshWorld();
      if (on !== null) showToast(on ? '🌧️ Preview: a spring shower' : '🌤️ Preview: a dry spell');
    }

function tryResetAll() {
      previewSeason = null;
      previewHour = null;
      if (typeof windOverride !== 'undefined') windOverride = null;
      if (typeof rainOverride !== 'undefined') rainOverride = null;
      tryRefreshWorld();
      showToast('📅 Back to his real calendar, clock and weather');
    }

function trySendGift(idx) {
      const g = TRY_GIFTS[idx];
      if (!g || typeof postMail !== 'function') return;
      if (state.mailbox.length + g.items.length > MAX_MAILBOX) {
        showToast('📮 The post office is too full for that. Kelo-1 needs to pick up his mail first.');
        return;
      }
      const from = typeof portalVisitorName === 'function' ? portalVisitorName() : 'a visitor';
      let sent = 0;
      g.items.forEach((name, i) => {
        // The same kind the Post tab's "What is it?" choice would give it
        const category = typeof categorizeItem === 'function' ? categorizeItem(name, g.kinds[i]) : g.kinds[i];
        const emoji = i === 0 ? g.emoji : ((typeof CATEGORY_ICONS !== 'undefined' && CATEGORY_ICONS[category]) || g.emoji);
        if (postMail({ kind: 'gift', from, name, category, emoji, note: '' })) sent++;
      });
      if (sent) showToast(`📮 ${g.items.join(' + ')} ${sent > 1 ? 'are' : 'is'} waiting at his post office`);
    }

// The little "Preview" chip under the camera bar, so a preview is never mistaken for the real thing
function tryRenderChip() {
      const chip = document.getElementById('explorePreviewChip');
      if (!chip) return;
      const parts = [];
      if (previewSeason) parts.push(`${TRY_SEASONS.find(s => s.key === previewSeason).emoji} ${previewSeason}`);
      if (previewHour !== null) parts.push(previewHour >= 21 || previewHour < 5.5 ? 'Night' : 'Day');
      if (typeof windOverride !== 'undefined' && windOverride) parts.push(`${TRY_WIND.find(w => w.key === windOverride).emoji} ${TRY_WIND.find(w => w.key === windOverride).label}`);
      if (typeof rainOverride !== 'undefined' && rainOverride !== null) parts.push(rainOverride ? '🌧️ Rain' : '🌤️ Dry');
      chip.classList.toggle('hidden', !parts.length);
      chip.innerHTML = parts.length ? `<span class="font-semibold text-white">Preview:</span> <span>${escapeHtml(parts.join(' · '))}</span>
        <button type="button" data-try="reset" class="ml-1 underline text-amber-300 hover:text-amber-200">Back to real</button>` : '';
    }

function tryRenderPanel() {
      const root = document.getElementById('tryItPanel');
      if (!root) return;
      const btn = (attr, label, on, title = '') => `<button type="button" ${attr} title="${escapeHtml(title)}" class="try-btn${on ? ' try-btn-on' : ''}" aria-pressed="${on}">${label}</button>`;
      const realSeason = realWorldNow().season;
      const wind = typeof windOverride !== 'undefined' ? windOverride : null;
      root.innerHTML = `
        <div class="ui-section-head">
          <h3 class="ui-section-title">Preview a season, time or weather</h3>
          <span class="ui-section-meta">Not saved</span>
        </div>
        <p class="text-2xs text-slate-400">See his world's features now instead of waiting for them. Previews last until you reload or press "Back to his real calendar". His real season is ${escapeHtml(realSeason.toLowerCase())}.</p>
        <div class="space-y-1">
          <div class="try-label">Season</div>
          <div class="flex flex-wrap gap-1.5">${TRY_SEASONS.map(s => btn(`data-try-season="${s.key}"`, s.key, previewSeason === s.key, s.hint)).join('')}</div>
          ${previewSeason ? `<p class="text-2xs text-slate-400">${escapeHtml(TRY_SEASONS.find(s => s.key === previewSeason).hint)}</p>` : ''}
        </div>
        <div class="space-y-1">
          <div class="try-label">Time of day</div>
          <div class="flex flex-wrap gap-1.5">
            ${btn('data-try-hour="12"', 'Day', previewHour === 12, 'Midday light')}
            ${btn('data-try-hour="23"', 'Night', previewHour === 23, 'Night: the house lights come on and he can stargaze with a telescope')}
          </div>
        </div>
        <div class="space-y-1">
          <div class="try-label">Wind</div>
          <div class="flex flex-wrap gap-1.5">${TRY_WIND.map(w => btn(`data-try-wind="${w.key}"`, w.label, wind === w.key, w.key === 'gale' ? 'A gale can crash his hot air balloon' : w.key === 'calm' ? 'Too still for a kite' : 'Good for a kite')).join('')}</div>
        </div>
        ${typeof rainOverride !== 'undefined' ? `<div class="space-y-1">
          <div class="try-label">Rain</div>
          <div class="flex flex-wrap gap-1.5">
            ${btn('data-try-rain="1"', 'Spring shower', rainOverride === true, 'Rain falls, the ground gets wet, puddles form and his plantings grow faster. He enjoys it or heads indoors.')}
            ${btn('data-try-rain="0"', 'Dry spell', rainOverride === false, 'No rain, even in spring')}
          </div>
        </div>` : ''}
        <button type="button" data-try="reset" class="ui-btn w-full" ${tryPreviewActive() ? '' : 'disabled'}>Back to his real calendar</button>
        <div class="space-y-1 pt-1 border-t border-slate-800">
          <div class="try-label">Send him a sample gift <span class="normal-case font-normal text-slate-500">(real parcels at his Post Office)</span></div>
          <div class="space-y-1.5">${TRY_GIFTS.map((g, i) => `
            <button type="button" data-try-gift="${i}" class="try-gift">
              <span class="text-base leading-none" aria-hidden="true">${g.emoji}</span>
              <span class="min-w-0"><span class="block text-2xs font-semibold text-amber-100">${escapeHtml(g.items.join(' + '))}</span>
              <span class="block text-2xs text-slate-400 leading-snug">${escapeHtml(g.unlocks)}</span></span>
            </button>`).join('')}</div>
        </div>`;
    }

window.addEventListener('DOMContentLoaded', () => {
  tryRenderPanel();
  tryRenderChip();
  const onClick = (e) => {
    const b = e.target.closest && e.target.closest('[data-try-season], [data-try-hour], [data-try-wind], [data-try-rain], [data-try], [data-try-gift]');
    if (!b) return;
    if (b.hasAttribute('data-try-season')) { const s = b.getAttribute('data-try-season'); trySetSeason(previewSeason === s ? null : s); }
    else if (b.hasAttribute('data-try-hour')) { const h = Number(b.getAttribute('data-try-hour')); trySetHour(previewHour === h ? null : h); }
    else if (b.hasAttribute('data-try-wind')) { const w = b.getAttribute('data-try-wind'); trySetWind(windOverride === w ? null : w); }
    else if (b.hasAttribute('data-try-rain')) { const on = b.getAttribute('data-try-rain') === '1'; trySetRain(rainOverride === on ? null : on); }
    else if (b.getAttribute('data-try') === 'reset') tryResetAll();
    else if (b.hasAttribute('data-try-gift')) trySendGift(Number(b.getAttribute('data-try-gift')));
  };
  document.getElementById('tryItPanel')?.addEventListener('click', onClick);
  document.getElementById('explorePreviewChip')?.addEventListener('click', onClick);
});
