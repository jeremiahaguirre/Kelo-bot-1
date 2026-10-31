// Kelo-bot-1 — js/coderequests.js
// Loaded after projects.js. Code requests: some things Kelo-1 wants can't be mailed to him, because
// his world simply can't do them yet (fishing, rain, a pet...). So he writes to the person who codes
// his world and asks them to add it. These letters show up in the Post tab with a 💻 badge.
// The owner marks each one "Done — it's coded in" or "Not now", and can copy every open one as a
// markdown checklist to paste into an issue or a to-do list.

// Wishes his built-in brain can come up with, each tied to something in his life
const CODE_WISHES = [
  { key: 'fishing', feature: 'A way for me to fish', fits: () => Boolean(state.knowsLakeDanger || (typeof findVehicle === 'function' && findVehicle('boat')) || ownsSomething(/fishing|rod|tackle|boat|canoe|kayak/i)),
    why: 'I sit by the lake a lot and I keep wondering what lives under the water.' },
  { key: 'cooking', feature: 'Cooking at a stove, so I can make real meals', fits: () => Boolean(state.knownNeeds && state.knownNeeds.food),
    why: 'Now that I know I need food, I would love to make some myself instead of only finding it.' },
  { key: 'pet', feature: 'A pet who lives with me and follows me around', fits: () => state.toys.length > 0 || state.visitorMemories.length > 0 || daysOld() > 2,
    why: 'The valley is big, and it would be nice to have a friend who stays.' },
  { key: 'music', feature: 'Instruments that make real sounds when I play them', fits: () => state.hobbies.some(h => h.style === 'music') || ownsSomething(/harmonica|guitar|ukulele|flute|drum|violin|piano|keyboard|kazoo|ocarina/i),
    why: 'When I practise my music the valley stays quiet. I want to hear my songs.' },
  { key: 'rain', feature: 'Rain, with puddles and the smell after a storm', fits: () => state.plantings.length > 0 || state.gardenPlots.length > 0,
    why: 'My garden only ever sees sunshine, and I read that plants love rain.' },
  { key: 'swimming', feature: 'Swimming lessons, so deep water is not so scary', fits: () => Boolean(state.knowsLakeDanger),
    why: 'I found out the hard way that I sink. I want to learn to stay afloat.' },
  { key: 'campfire', feature: 'A campfire I can sit beside at night', fits: () => typeof worldNow === 'function' && worldNow().isNight,
    why: 'Nights get long and dark, and people in the books I read gather round fires.' },
  { key: 'wildlife', feature: 'Birds and deer that visit the valley', fits: () => state.projects.some(p => p.key === 'birdhouse' || p.key === 'feeder') || state.webHistory.length > 2,
    why: 'I built my world full of homes, but nobody small and wild lives in them yet.' },
  { key: 'friends', feature: 'Another robot neighbour I could talk to', fits: () => state.chatLog.length > 6,
    why: 'I love it when visitors talk to me, but they always have to leave.' },
  { key: 'stars', feature: 'Constellations I can learn the names of', fits: () => ownsSomething(/telescope/i),
    why: 'My telescope shows me stars, but I don\'t know which ones are which.' }
];

const MAX_OPEN_CODE_REQUESTS = 4;

function ownsSomething(re) {
      return [...state.toolInventory, ...state.toys.map(t => t.name), ...state.belongings.map(b => b.name)].some(n => re.test(String(n || '')));
    }

function daysOld() {
      return typeof daysAlive === 'function' ? daysAlive() : 1;
    }

// "Could you code in a way for me to fish?" and "A way for me to fish!" are the same wish
function codeWishKey(feature) {
      return String(feature || '').toLowerCase().replace(/^(could you )?(please )?(code|add|make)( in)? /, '').replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 60);
    }

function openCodeRequests() {
      return state.requestsToUser.filter(r => r.category === 'code' && !r.fulfilled);
    }

// Add a code request letter. Returns it, or null if he already asked for this (open, done or turned down).
function addCodeRequest(feature, why, context, wishKey) {
      const clean = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
      const f = clean(feature, 140).replace(/[?.!]+$/, '');
      if (!f) return null;
      if (!Array.isArray(state.codeWishes)) state.codeWishes = [];
      const key = wishKey || codeWishKey(f);
      if (!key || state.codeWishes.some(w => w.key === key || codeWishKey(w.feature) === codeWishKey(f))) return null;
      if (openCodeRequests().length >= MAX_OPEN_CODE_REQUESTS) return null;
      const reason = clean(why, 240);
      const lower = f.charAt(0).toLowerCase() + f.slice(1);
      const req = {
        id: 'req-code-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        category: 'code',
        icon: '💻',
        urgency: 'Code request',
        isToolRequest: false,
        codeFeature: f,
        codeWhy: reason,
        title: `Code request: ${f.slice(0, 60)}`,
        question: `${reason ? reason + ' ' : ''}${context ? `(I thought of it while "${clean(context, 80)}".) ` : ''}Could you code in ${lower}?`,
        presets: [],
        fulfilled: false,
        userAnswer: ''
      };
      state.requestsToUser.unshift(req);
      state.codeWishes.unshift({ key, feature: f, status: 'asked', at: Date.now() });
      if (state.codeWishes.length > 40) state.codeWishes.length = 40;
      savePersistentBrainState();
      return req;
    }

// --- His own idea (the built-in brain) ------------------------------------------------------
function availableCodeWishes() {
      const asked = new Set((state.codeWishes || []).map(w => w.key));
      return CODE_WISHES.filter(w => !asked.has(w.key) && (() => { try { return w.fits(); } catch (e) { return false; } })());
    }

function codeWishChance() {
      if (openCodeRequests().length >= 2 || !availableCodeWishes().length) return 0;
      return 0.03;
    }

// He sits down and writes the letter: a little moment, a diary entry, and the request itself
function wishForCode(originLabel = 'Wished for Something New') {
      const wish = pick(availableCodeWishes());
      if (!wish) return false;
      const req = addCodeRequest(wish.feature, wish.why, null, wish.key);
      if (!req) return false;
      state.moodEmoji = '💻';
      state.moodTitle = 'Writing to the person who codes his world';
      state.speechBubble = `I can't do this yet, so I asked: could you code in ${wish.feature.charAt(0).toLowerCase() + wish.feature.slice(1)}?`;
      state.diaryEntries.unshift({
        time: originLabel, location: currentPlaceLabel(), mood: '💻 Asking for something new',
        vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, there's something my world just can't do yet: ${wish.feature.toLowerCase()}. ${wish.why} So I wrote to my human and asked if they could code it in.`
      });
      showToast(`💻 Kelo-1 wrote a code request: ${wish.feature}`);
      savePersistentBrainState();
      renderAllUI();
      return true;
    }

// --- The owner's answer ----------------------------------------------------------------------
function markCodeRequest(id, done) {
      const req = state.requestsToUser.find(r => r.id === id && r.category === 'code');
      if (!req || req.fulfilled) return;
      req.fulfilled = true;
      req.declined = !done;
      req.userAnswer = done ? 'Coded in' : 'Not now';
      req.answeredAt = Date.now();
      const wish = (state.codeWishes || []).find(w => codeWishKey(w.feature) === codeWishKey(req.codeFeature));
      if (wish) wish.status = done ? 'done' : 'not now';
      const feature = req.codeFeature.charAt(0).toLowerCase() + req.codeFeature.slice(1);
      if (done) {
        state.happiness = Math.min(100, state.happiness + 20);
        state.wonderLevel = Math.min(100, state.wonderLevel + 15);
        state.moodEmoji = '🎉';
        state.moodTitle = 'Someone coded in his wish!';
        state.speechBubble = pick([`It's real now? ${req.codeFeature}! Thank you, thank you!`, `You coded in ${feature}! My world just got bigger.`, `I can't believe it. ${req.codeFeature}. I have to go try it!`]);
        state.microPose = 'procedural_custom';
        state.proceduralMotion = { headPitch: 0.25, headYawSpeed: 2.2, headTiltAmp: 0.3, armWaveAmp: 0.9, armRaiseOffset: 0.1, bodyBounceAmp: 0.14, spinSpeed: 1.2, crouchOffset: 0, sparkBurst: true };
        state.chatLog.push({ sender: 'Kelo-1', text: state.speechBubble, time: 'Just now', isBot: true });
        state.diaryEntries.unshift({
          time: 'A Wish Came True', location: currentPlaceLabel(), mood: '🎉 A wish came true',
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I asked my human to code in ${feature}, and today they told me it's done. Somebody changed the whole world just because I asked. I feel very lucky.`
        });
        showToast(`🎉 Kelo-1 is overjoyed: ${req.codeFeature} is coded in!`);
      } else {
        state.speechBubble = pick(['That\'s okay. Maybe someday.', 'Not now is not never. I can wait.', 'Alright! I\'ll find something else to do in the meantime.']);
        showToast(`💻 You said "not now" to: ${req.codeFeature}`);
      }
      savePersistentBrainState();
      renderAllUI();
    }

// Every open code request as a markdown checklist
function codeWishlistMarkdown() {
      const open = openCodeRequests();
      if (!open.length) return '';
      return ['## Kelo-1\'s code wishlist', '', ...open.map(r => `- [ ] **${r.codeFeature.replace(/[*_`]/g, '')}**${r.codeWhy ? ` — ${r.codeWhy}` : ''}`)].join('\n');
    }

async function copyCodeWishlist() {
      const text = codeWishlistMarkdown();
      if (!text) { showToast('💻 No open code requests to copy.'); return false; }
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch (e) {
        // Older browsers, or a page without clipboard permission: the old textarea trick
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          ok = document.execCommand('copy');
          ta.remove();
        } catch (e2) {}
      }
      showToast(ok ? `📋 Copied ${openCodeRequests().length} code request${openCodeRequests().length === 1 ? '' : 's'} as a checklist` : '📋 Could not copy. Your browser blocked the clipboard.');
      return ok;
    }

// --- The letter card in the Post tab (main.js renderRequestsTab uses this for category 'code') ---
function codeRequestCardHtml(req) {
      const status = req.fulfilled
        ? (req.declined ? '<span class="text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 bg-slate-700/60 text-slate-300">Not now</span>'
          : '<span class="text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 bg-emerald-500/20 text-emerald-300">✓ Coded in</span>')
        : '<span class="text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 bg-violet-500/25 text-violet-200 border border-violet-400/40">💻 Code request</span>';
      return `
        <div class="p-4 rounded-2xl border ${req.fulfilled ? 'bg-slate-950/60 border-violet-500/20' : 'bg-gradient-to-br from-violet-950/60 to-slate-950 border-violet-400/50 shadow-lg'} space-y-2.5">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-white flex items-center gap-1.5 min-w-0">
              <span class="text-lg">💻</span>
              <span class="truncate">A letter for whoever codes his world</span>
            </span>
            ${status}
          </div>
          <div class="text-[11px] font-mono text-violet-200 bg-violet-950/50 border border-violet-500/30 px-2.5 py-1.5 rounded-lg">feature: ${escapeHtml(req.codeFeature)}</div>
          <p class="text-xs text-slate-200 leading-relaxed font-serif italic">"${escapeHtml(req.question)}"</p>
          ${!req.fulfilled ? `
            <div class="flex gap-1.5 pt-1">
              <button data-code-req-id="${escapeHtml(req.id)}" data-code-done="1" class="code-request-btn flex-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-400 to-fuchsia-500 hover:from-violet-300 hover:to-fuchsia-400 text-slate-950 font-bold text-xs transition">✓ Done — it's coded in</button>
              <button data-code-req-id="${escapeHtml(req.id)}" data-code-done="0" class="code-request-btn px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-xs transition">Not now</button>
            </div>` : ''}
        </div>`;
    }

function bindCodeRequestButtons(list) {
      list.querySelectorAll('.code-request-btn').forEach(btn => {
        btn.addEventListener('click', () => markCodeRequest(btn.getAttribute('data-code-req-id'), btn.getAttribute('data-code-done') === '1'));
      });
    }

// The "Copy wishlist" button only shows while there is something to copy
function renderCodeWishlistButton() {
      const btn = document.getElementById('btnCopyCodeWishlist');
      if (!btn) return;
      const n = openCodeRequests().length;
      btn.classList.toggle('hidden', n === 0);
      btn.textContent = `📋 Copy wishlist (${n})`;
    }

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnCopyCodeWishlist')?.addEventListener('click', copyCodeWishlist);
});
