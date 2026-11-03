// Kelo-bot-1 — js/talk.js
// Loaded after portal.js. The Talk tab: a live chat with Kelo-1.
// - The thread: his and your bubbles with avatars, separators by his world day, the time on his
//   clock, a "Kelo-1 is thinking…" indicator, NetNode lookups as small cards, and status chips
//   (queued → doing → done) for the things he does because you asked.
// - One composer: a multiline box (Enter sends, Shift+Enter makes a new line), a send button and a
//   "+" menu to attach a photo or send a gift, tool or toy (the gift goes to the post office).
// - Suggested messages that fit what he has right now, and your name, saved on this device.
// Letters, the things he asks for and his questions stay in the Post tab.
// Everything shown goes through escapeHtml; the page's CSP forbids inline handlers, so all
// listeners are attached here.

const TALK_MAX_CHARS = 500;
const TALK_PAGE = 20;                 // messages shown at first; "Load earlier" adds this many more
const TALK_NAME_KEY = 'kelo1_visitor_name';
const TALK_THINK_LIMIT_MS = 45000;    // the thinking indicator never stays longer than this

const talkUi = {
  booted: false,
  key: '',
  stick: true,          // keep the thread pinned to the newest message
  unseen: 0,            // new messages that arrived while you were scrolled up
  lastCount: 0,
  lastAnnounced: null,
  thinking: false,      // waiting for his answer to your message
  thinkMark: null,      // the entry just before your message (replies come after it)
  holdUntil: 0,         // his reply is shown after a short, natural pause
  thinkTimer: null,
  holdTimer: null,
  attach: null,         // a photo waiting to be sent: { name, thumb, analyzed }
  suggestKey: '',
  statusText: ''
};

function talkEl(id) { return document.getElementById(id); }

function talkClip(text, max) {
      const s = String(text ?? '').replace(/\s+/g, ' ').trim();
      return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
    }

function talkCap(text) {
      const s = String(text ?? '');
      return s ? s[0].toUpperCase() + s.slice(1) : s;
    }

// --- Your name: saved on this device, edited in one place (the button at the top of the tab) ---
function talkSavedName() {
      try { return (localStorage.getItem(TALK_NAME_KEY) || '').slice(0, 40); } catch (e) { return ''; }
    }

function talkVisitorName() {
      return (talkEl('visitorNameInput')?.value || '').trim().slice(0, 40);
    }

function talkSaveName(name) {
      const clean = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      const before = talkSavedName();
      try { if (clean) localStorage.setItem(TALK_NAME_KEY, clean); else localStorage.removeItem(TALK_NAME_KEY); } catch (e) {}
      const input = talkEl('visitorNameInput');
      if (input) input.value = clean;
      if (clean && clean !== before && typeof recordVisitorMemory === 'function') recordVisitorMemory(clean, 'Visited Kelo-1 in his timeless Okanagan valley.');
      talkRenderName();
      talkUi.key = '';
      renderTalkTab();
    }

function talkRenderName() {
      const name = talkVisitorName();
      const label = talkEl('talkNameLabel');
      const initial = talkEl('talkNameInitial');
      if (label) label.textContent = name || 'Set your name';
      if (initial) initial.textContent = name ? name[0].toUpperCase() : '?';
    }

function talkToggleNameEditor(open) {
      const editor = talkEl('talkNameEditor');
      const btn = talkEl('talkNameBtn');
      if (!editor || !btn) return;
      const show = open ?? editor.classList.contains('hidden');
      editor.classList.toggle('hidden', !show);
      btn.setAttribute('aria-expanded', String(show));
      if (show) { const input = talkEl('visitorNameInput'); input.value = talkVisitorName(); input.focus(); input.select(); }
    }

// --- The chat log: every entry gets the real time it was said, so it can show his world day ---
function talkStampLog() {
      const log = state.chatLog;
      if (!Array.isArray(log)) return;
      if (!talkUi.booted) {
        talkUi.booted = true;
        // Entries from before this version have no time: they go under "Earlier". A brand-new
        // Kelo-1's first hello is stamped now. Jobs that were still running stopped with the page.
        const fresh = !log.some(m => !m.isBot);
        log.forEach(m => {
          if (typeof m.at !== 'number') m.at = fresh ? Date.now() : 0;
          if ((m.kind === 'action' || m.kind === 'lookup') && (m.status === 'queued' || m.status === 'doing')) m.status = 'stopped';
        });
        return;
      }
      for (let i = log.length - 1; i >= 0 && typeof log[i].at !== 'number'; i--) log[i].at = Date.now();
    }

function talkWorldTime(at) {
      if (!at || typeof worldNow !== 'function') return null;
      const w = worldNow(at);
      return { day: w.day, season: w.season, clock: typeof clockLabel === 'function' ? clockLabel(w.hour) : '' };
    }

// A chip in the thread for something he started because you asked
function talkAddAction(label, status = 'queued', extra = {}) {
      const entry = Object.assign({ kind: 'action', sender: 'Kelo-1', isBot: true, text: talkClip(label, 90), status, time: 'Just now', at: Date.now() }, extra);
      state.chatLog.push(entry);
      renderTalkTab();
      return entry;
    }

function talkSetStatus(entry, status, note) {
      if (!entry) return;
      entry.status = status;
      if (note) entry.note = String(note).slice(0, 120);
      renderTalkTab();
    }

function talkLatestAction(key) {
      for (let i = state.chatLog.length - 1; i >= 0; i--) {
        const m = state.chatLog[i];
        if (m.kind === 'action' && m.key === key && m.status === 'queued') return m;
      }
      return null;
    }

async function talkWaitUntilFree(maxMs = 90000) {
      const busy = () => state.isBusy || state.isBuilding || state.isPracticing;
      for (let t = 0; t < maxMs && busy(); t += 250) await new Promise(r => setTimeout(r, 250));
      return !busy();
    }

// --- Watching what he does for you. These wrap the functions in skills.js, conversation.js and
// agent.js from the outside, so those files stay as they are. ---
function talkWatchActions() {
      if (typeof answerUseRequest === 'function') {
        const original = answerUseRequest;
        answerUseRequest = function (ask, visitor) {
          const result = original.apply(this, arguments);
          if (ask && ask.candidate && !ask.missing) talkAddAction(talkCap(ask.candidate.label), 'queued', { key: ask.candidate.key, for: visitor });
          return result;
        };
      }
      if (typeof practiseSkill === 'function') {
        const original = practiseSkill;
        practiseSkill = async function (c, visitor) {
          const chip = visitor && c ? talkLatestAction(c.key) : null;
          if (!chip) return original.apply(this, arguments);
          talkSetStatus(chip, 'doing');
          try {
            const result = await original.apply(this, arguments);
            if (result === 'not-ready') talkSetStatus(chip, 'blocked', 'He has to learn how, or fuel up, first');
            else if (result === 'too-windy') talkSetStatus(chip, 'blocked', 'Too windy to fly safely');
            else if (result === false) talkSetStatus(chip, 'stopped');
            else talkSetStatus(chip, 'done');
            return result;
          } catch (e) {
            talkSetStatus(chip, 'stopped');
            throw e;
          }
        };
      }
      if (typeof synthesizeUnboundedExperience === 'function') {
        const original = synthesizeUnboundedExperience;
        synthesizeUnboundedExperience = async function (prompt, origin) {
          if (!(typeof origin === 'string' && origin.startsWith('Asked by '))) return original.apply(this, arguments);
          const chip = talkAddAction(`Making “${talkClip(prompt, 48)}”`, 'queued');
          const args = arguments;
          if (!(await talkWaitUntilFree())) { talkSetStatus(chip, 'blocked', 'He was busy; ask again in a while'); return; }
          talkSetStatus(chip, 'doing');
          try {
            const result = await original.apply(this, args);
            talkSetStatus(chip, 'done');
            return result;
          } catch (e) {
            talkSetStatus(chip, 'stopped');
            throw e;
          }
        };
      }
      if (typeof decideNextAction === 'function') {
        const original = decideNextAction;
        decideNextAction = async function (trigger, origin) {
          if (!(typeof origin === 'string' && origin.startsWith('Talking with '))) return original.apply(this, arguments);
          const plan = (String(trigger || '').match(/You decided:\s*([\s\S]*)$/) || [])[1] || 'Something you talked about';
          const chip = talkAddAction(talkCap(talkClip(plan, 70)), 'doing');
          try {
            const result = await original.apply(this, arguments);
            talkSetStatus(chip, 'done');
            return result;
          } catch (e) {
            talkSetStatus(chip, 'stopped');
            throw e;
          }
        };
      }
      // Words he looks up at NetNode while talking with you show as small cards
      if (typeof lookUpWord === 'function') {
        const original = lookUpWord;
        lookUpWord = async function (word) {
          const w = talkClip(word, 40);
          const card = { kind: 'lookup', sender: 'Kelo-1', isBot: true, word: w, status: 'doing', text: `Looking up "${w}" at NetNode`, time: 'Just now', at: Date.now() };
          state.chatLog.push(card);
          renderTalkTab();
          try {
            const meaning = await original.apply(this, arguments);
            card.status = 'done';
            card.found = meaning ? talkClip(meaning, 200) : '';
            card.text = meaning ? `Looked up "${w}"` : `Couldn't find "${w}"`;
            return meaning;
          } catch (e) {
            card.status = 'stopped';
            throw e;
          } finally {
            renderTalkTab();
          }
        };
      }
    }
talkWatchActions();

// --- "Kelo-1 is thinking…" ---
function talkBeginThinking(text) {
      const log = state.chatLog;
      talkUi.thinking = true;
      talkUi.thinkMark = log.length ? log[log.length - 1] : null;
      // A short pause before his reply shows, like someone reading and thinking (an AI brain takes its own time)
      const pause = (typeof hasLLMKey === 'function' && hasLLMKey()) ? 300 : 700 + Math.min(900, String(text || '').length * 8);
      talkUi.holdUntil = Date.now() + pause;
      clearTimeout(talkUi.holdTimer);
      talkUi.holdTimer = setTimeout(renderTalkTab, pause + 30);
      clearTimeout(talkUi.thinkTimer);
      talkUi.thinkTimer = setTimeout(talkEndThinking, TALK_THINK_LIMIT_MS);
    }

function talkEndThinking() {
      talkUi.thinking = false;
      clearTimeout(talkUi.thinkTimer);
      renderTalkTab();
    }

// Where your message is in the log, and whether he has answered it yet
function talkThinkState() {
      const log = state.chatLog;
      if (!talkUi.thinking && Date.now() >= talkUi.holdUntil) return { typing: false, holdFrom: log.length };
      const markIdx = talkUi.thinkMark ? log.lastIndexOf(talkUi.thinkMark) : -1;
      let mine = -1;
      for (let i = markIdx + 1; i < log.length; i++) if (!log[i].isBot) { mine = i; break; }
      if (mine < 0) return { typing: talkUi.thinking, holdFrom: log.length };
      const holding = Date.now() < talkUi.holdUntil;
      const answered = log.slice(mine + 1).some(m => m.isBot && !m.kind);
      return { typing: holding || (talkUi.thinking && !answered), holdFrom: holding ? mine + 1 : log.length };
    }

// --- Rendering the thread (only when something in it changed) ---
const TALK_STATUS = {
  queued: ['⏳', 'Queued'],
  doing: ['▶', 'Doing'],
  done: ['✓', 'Done'],
  blocked: ['!', 'Not yet'],
  stopped: ['■', 'Stopped']
};

function talkKeloAvatar(extra = '') {
      return `<span class="talk-avatar talk-avatar-kelo ${extra}" aria-hidden="true"><span class="talk-face"><i></i><i></i></span></span>`;
    }

function talkYouAvatar(name) {
      return `<span class="talk-avatar talk-avatar-you" aria-hidden="true">${escapeHtml((String(name || '?').trim()[0] || '?').toUpperCase())}</span>`;
    }

function talkSafeImg(src) {
      return typeof src === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src) ? src : '';
    }

function talkEventHtml(m) {
      const [icon, word] = TALK_STATUS[m.status] || TALK_STATUS.stopped;
      if (m.kind === 'lookup') {
        const doing = m.status === 'doing';
        return `<div class="talk-event talk-lookup">
            <span aria-hidden="true">📘</span>
            <div class="min-w-0 flex-1">
              <div class="talk-event-title">${doing ? `Looking up ‘${escapeHtml(m.word)}’ at NetNode…` : m.found ? `Looked up ‘${escapeHtml(m.word)}’` : `Couldn’t find ‘${escapeHtml(m.word)}’`}</div>
              ${m.found ? `<div class="talk-event-note">${escapeHtml(m.found)}</div>` : ''}
            </div>
            ${doing ? '<span class="talk-status talk-status-doing"><span class="talk-pulse" aria-hidden="true"></span>Reading</span>' : ''}
          </div>`;
      }
      return `<div class="talk-event">
          <span class="talk-status talk-status-${escapeHtml(m.status)}">${m.status === 'doing' ? '<span class="talk-pulse" aria-hidden="true"></span>' : `<span aria-hidden="true">${icon}</span>`}${word}</span>
          <div class="min-w-0 flex-1">
            <div class="talk-event-title">${escapeHtml(m.text)}</div>
            ${m.note ? `<div class="talk-event-note">${escapeHtml(m.note)}</div>` : ''}
          </div>
        </div>`;
    }

function talkEmptyHtml() {
      const named = Boolean(talkVisitorName());
      return `<div class="talk-empty">
          ${talkKeloAvatar('talk-avatar-lg')}
          <h3 class="text-sm font-bold text-white">Say hello to Kelo-1</h3>
          <p>He just woke up in the valley and doesn’t know much yet. Ask him something, tell him about your world, or tap an idea below.</p>
          <div class="flex flex-wrap justify-center gap-2">
            ${named ? '' : '<button type="button" class="talk-link-btn" data-talk-name>Tell him your name</button>'}
            <button type="button" class="talk-link-btn" data-talk-open="requests">Letters and his requests are in Post</button>
          </div>
        </div>`;
    }

function talkThreadHtml(items, hiddenEarlier, typing, fresh) {
      const out = [];
      if (hiddenEarlier > 0) out.push(`<div class="talk-more"><button type="button" class="talk-link-btn" data-talk-more>Load earlier messages (${hiddenEarlier})</button></div>`);
      else if (state.chatLog.length >= MAX_CHAT_LOG) out.push(`<p class="talk-note">He keeps the last ${MAX_CHAT_LOG} messages of your chats.</p>`);
      if (fresh) out.push(talkEmptyHtml());
      const today = talkWorldTime(Date.now());
      const me = talkVisitorName();
      let lastDay, prevSide = null, prevSender = null, prevAt = 0;
      for (const m of items) {
        const w = talkWorldTime(m.at);
        const dayKey = w ? w.day : 'earlier';
        if (dayKey !== lastDay) {
          const label = w ? `Day ${w.day} · ${(typeof SEASON_EMOJI !== 'undefined' && SEASON_EMOJI[w.season]) || ''} ${w.season}${today && today.day === w.day ? ' · Today' : ''}` : 'Earlier';
          out.push(`<div class="talk-day" role="separator"><span>${escapeHtml(label)}</span></div>`);
          lastDay = dayKey;
          prevSide = null;
        }
        if (m.kind === 'action' || m.kind === 'lookup') {
          out.push(talkEventHtml(m));
          prevSide = null;
          continue;
        }
        const side = m.isBot ? 'kelo' : 'you';
        const sender = String(m.sender || (m.isBot ? 'Kelo-1' : 'You'));
        const newRun = side !== prevSide || sender !== prevSender || (m.at && prevAt && m.at - prevAt > 15 * 60 * 1000);
        prevSide = side; prevSender = sender; prevAt = m.at || prevAt;
        const who = m.isBot ? 'Kelo-1' : (sender === me || sender === 'curiousWanderer' ? 'You' : sender);
        const tag = m.time === 'Read in his own time' ? ' · ✉️ about your letter' : '';
        const img = talkSafeImg(m.img);
        const gift = m.kind === 'gift' ? `<div class="talk-gift"><span aria-hidden="true">${escapeHtml(m.emoji || '🎁')}</span><div class="min-w-0"><div class="font-semibold">${escapeHtml(m.name || 'A gift')}</div><div class="talk-gift-state">${state.mailbox.some(x => x.id === m.mailId) ? '📮 Waiting at the post office' : '📬 He picked it up'}</div></div></div>` : '';
        out.push(`<div class="talk-row talk-row-${side}${newRun ? ' talk-run' : ''}">
            ${newRun ? (m.isBot ? talkKeloAvatar() : talkYouAvatar(who === 'You' ? (me || '?') : sender)) : '<span class="talk-avatar-spacer" aria-hidden="true"></span>'}
            <div class="talk-col">
              ${newRun ? `<div class="talk-meta"><span class="font-semibold">${escapeHtml(who)}</span>${w ? ` · ${escapeHtml(w.clock)}` : ''}${escapeHtml(tag)}</div>` : `<span class="sr-only">${escapeHtml(who)}:</span>`}
              ${gift}
              ${img ? `<img class="talk-img" src="${escapeHtml(img)}" alt="${escapeHtml(m.imgName ? `Photo: ${m.imgName}` : 'Photo you sent')}">` : ''}
              ${m.text ? `<div class="talk-bubble">${escapeHtml(m.text)}</div>` : ''}
            </div>
          </div>`);
      }
      if (typing) {
        out.push(`<div class="talk-row talk-row-kelo${prevSide === 'kelo' ? '' : ' talk-run'}">
            ${prevSide === 'kelo' ? '<span class="talk-avatar-spacer" aria-hidden="true"></span>' : talkKeloAvatar()}
            <div class="talk-col"><div class="talk-bubble talk-typing"><span class="talk-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>Kelo-1 is thinking…</span></div></div>
          </div>`);
      }
      return out.join('');
    }

function talkStatusLine() {
      const place = typeof currentPlaceLabel === 'function' ? stripCoords(currentPlaceLabel()) : '';
      const mood = `${state.moodEmoji || ''} ${stripCoords(state.moodTitle || '')}`.trim();
      return state.isSleeping ? `💤 Asleep${place ? ` · ${place}` : ''}` : `${mood}${place ? ` · ${place}` : ''}`;
    }

function renderTalkTab() {
      const box = talkEl('chatMessagesBox');
      if (!box || !Array.isArray(state.chatLog)) return;
      talkStampLog();
      const log = state.chatLog;

      const status = talkStatusLine();
      if (status !== talkUi.statusText) {
        talkUi.statusText = status;
        const el = talkEl('talkStatus');
        if (el) { el.textContent = status; el.title = status; }
      }

      const { typing, holdFrom } = talkThinkState();
      const visible = log.slice(0, holdFrom);
      const shown = typeof perfListLimit === 'function' ? perfListLimit('chatMessagesBox', TALK_PAGE) : TALK_PAGE;
      const items = visible.slice(-shown);
      const fresh = !log.some(m => !m.isBot);
      // A cheap fingerprint of what is on screen: the thread is only rebuilt when it changes
      let sig = '';
      for (const m of items) {
        if (m.kind) sig += `${m.kind[0]}${m.status || ''}${m.kind === 'gift' && state.mailbox.some(x => x.id === m.mailId) ? 'w' : ''}|`;
      }
      const last = items[items.length - 1];
      const today = talkWorldTime(Date.now());
      const key = [log.length, visible.length, items.length, last && last.at, last && String(last.text).length, sig, typing, fresh, talkVisitorName(), today && today.day].join('~');
      if (key !== talkUi.key) {
        talkUi.key = key;
        const preserve = talkUi.preserveScroll;
        talkUi.preserveScroll = null;
        if (perfSetHtml(box, talkThreadHtml(items, visible.length - items.length, typing, fresh))) {
          if (preserve) box.scrollTop = box.scrollHeight - preserve.height + preserve.top;
          else if (talkUi.stick) box.scrollTop = box.scrollHeight;
        }
        // New messages: announce his newest line to screen readers, and count them if you're scrolled up
        const added = visible.length - talkUi.lastCount;
        if (added > 0 && talkUi.lastCount > 0) {
          if (!talkUi.stick && !preserve) talkUi.unseen += added;
          const newest = visible[visible.length - 1];
          if (newest && newest !== talkUi.lastAnnounced && newest.isBot) {
            talkUi.lastAnnounced = newest;
            const ann = talkEl('talkAnnouncer');
            if (ann) ann.textContent = newest.kind ? `${newest.text}${newest.status ? ` (${(TALK_STATUS[newest.status] || [])[1] || ''})` : ''}` : `Kelo-1 says: ${stripCoords(newest.text)}`;
          }
        } else if (typing && !talkUi.wasTyping) {
          const ann = talkEl('talkAnnouncer');
          if (ann) ann.textContent = 'Kelo-1 is thinking…';
        }
        talkUi.wasTyping = typing;
        talkUi.lastCount = visible.length;
        talkRenderJump();
      }
      talkRenderSuggestions();
      talkUpdateComposer();
    }

function talkRenderJump() {
      const btn = talkEl('talkJumpLatest');
      if (!btn) return;
      btn.classList.toggle('hidden', talkUi.stick);
      const count = talkEl('talkJumpCount');
      if (count) {
        count.textContent = talkUi.unseen > 0 ? String(Math.min(99, talkUi.unseen)) : '';
        count.classList.toggle('hidden', talkUi.unseen <= 0);
      }
      btn.setAttribute('aria-label', talkUi.unseen > 0 ? `Jump to latest, ${talkUi.unseen} new` : 'Jump to latest');
    }

function talkScrollToLatest(smooth) {
      const box = talkEl('chatMessagesBox');
      if (!box) return;
      talkUi.stick = true;
      talkUi.unseen = 0;
      box.scrollTo({ top: box.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
      talkRenderJump();
    }

// --- Suggested messages that fit what is going on ---
function talkSuggestionList() {
      const fresh = !state.chatLog.some(m => !m.isBot);
      const has = kind => typeof skillCandidates === 'function' && skillCandidates().some(c => c.kind === kind || (kind === 'telescope' && c.telescope));
      if (state.isSleeping) return ['How did you sleep?', 'What are you dreaming about?'];
      const list = fresh ? ['Hi Kelo-1! 👋', 'What are you doing?', 'How are you feeling?', 'Paint me something'] : ['What are you doing?'];
      if (!fresh) {
        if (has('air')) list.push('Try flying your helicopter');
        list.push('Paint me something', 'How are you feeling?');
        if (has('balloon')) list.push('Take your balloon up');
        if (has('boat')) list.push('Take your boat out');
        if (has('bike')) list.push('Go for a bike ride');
        if (has('telescope') && typeof worldNow === 'function' && worldNow().isNight) list.push('Use your telescope');
      }
      return list.slice(0, 5);
    }

function talkRenderSuggestions() {
      const el = talkEl('talkSuggestions');
      if (!el) return;
      const typingText = Boolean((talkEl('chatInput')?.value || '').trim());
      const sheetOpen = !talkEl('talkGiftSheet')?.classList.contains('hidden');
      const list = typingText || sheetOpen ? [] : talkSuggestionList();
      const key = list.join('|');
      if (key === talkUi.suggestKey) return;
      talkUi.suggestKey = key;
      el.innerHTML = list.map(s => `<button type="button" class="talk-chip" data-talk-say="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('');
    }

// --- The composer ---
function talkUpdateComposer() {
      const input = talkEl('chatInput');
      const send = talkEl('talkSendBtn');
      const count = talkEl('talkCount');
      if (!input || !send) return;
      const len = input.value.length;
      const waiting = talkThinkState().typing;
      const empty = !input.value.trim() && !talkUi.attach;
      send.disabled = empty || waiting;
      send.setAttribute('aria-busy', String(waiting));
      send.setAttribute('aria-label', waiting ? 'Kelo-1 is answering…' : 'Send');
      send.title = waiting ? 'Kelo-1 is answering…' : empty ? 'Type a message first' : 'Send (Enter)';
      if (count) {
        count.textContent = `${len} / ${TALK_MAX_CHARS}`;
        count.classList.toggle('text-amber-300', len >= TALK_MAX_CHARS * 0.9 && len < TALK_MAX_CHARS);
        count.classList.toggle('text-rose-400', len >= TALK_MAX_CHARS);
      }
    }

function talkAutosize() {
      const input = talkEl('chatInput');
      if (!input) return;
      input.style.height = 'auto';
      input.style.height = `${Math.min(140, input.scrollHeight + 2)}px`;
    }

async function talkSend(raw) {
      const text = String(raw ?? '').replace(/\r/g, '').trim().slice(0, TALK_MAX_CHARS);
      const attach = talkUi.attach;
      if ((!text && !attach) || talkThinkState().typing) return;
      const input = talkEl('chatInput');
      if (input && raw === input.value) { input.value = ''; talkAutosize(); }
      talkUi.stick = true;
      talkUi.unseen = 0;
      if (attach) {
        talkClearAttach();
        await talkSendPhoto(text, attach);
        return;
      }
      talkBeginThinking(text);
      try {
        await handleVisitorChatMessage(text);
      } catch (e) {
        console.warn('Talk: could not send', e);
      } finally {
        talkEndThinking();
      }
    }

// A photo: he makes something inspired by it, straight away or as soon as he is free
async function talkSendPhoto(text, attach) {
      const visitor = talkVisitorName() || 'curiousWanderer';
      state.chatLog.push({ sender: visitor, text, time: 'Just now', isBot: false, at: Date.now(), img: attach.thumb, imgName: talkClip(attach.name, 60) });
      if (typeof recordVisitorMemory === 'function') recordVisitorMemory(visitor, `Inspired me with image "${attach.name}"`);
      const chip = talkAddAction('Making something inspired by your photo', 'queued');
      renderAllUI();
      if (!(await talkWaitUntilFree())) { talkSetStatus(chip, 'blocked', 'He was busy; try again in a while'); return; }
      talkSetStatus(chip, 'doing');
      try {
        await synthesizeUnboundedExperience(text || `Weld a new 3D structure inspired by ${visitor}'s uploaded image "${attach.name}"`, 'Image-Inspired 3D Weld', null, attach.analyzed);
        state.chatLog.push({ sender: 'Kelo-1', text: state.speechBubble, time: 'Just now', isBot: true, at: Date.now() });
        talkSetStatus(chip, 'done');
      } catch (e) {
        talkSetStatus(chip, 'stopped');
      }
      savePersistentBrainState();
      renderAllUI();
    }

function talkClearAttach() {
      talkUi.attach = null;
      talkEl('talkAttachPreview')?.classList.add('hidden');
      const thumb = talkEl('talkAttachThumb');
      if (thumb) thumb.removeAttribute('src');
      talkUpdateComposer();
    }

async function talkPickPhoto(file) {
      if (!file) return;
      if (!file.type.startsWith('image/')) { showToast('Please choose an image file.'); return; }
      if (file.size > 8 * 1024 * 1024) { showToast('That image is over 8 MB; please pick a smaller one.'); return; }
      const analyzed = await analyzeUploadedImage(file);
      const thumb = analyzed && typeof makeThumbnail === 'function' ? await makeThumbnail(analyzed.dataUrl, 200) : null;
      if (!analyzed || !thumb) { showToast('Could not read that image.'); return; }
      talkUi.attach = { name: file.name, thumb, analyzed };
      talkEl('talkAttachThumb').src = thumb;
      talkEl('talkAttachThumb').alt = `Photo: ${file.name}`;
      talkEl('talkAttachName').textContent = file.name;
      talkEl('talkAttachPreview').classList.remove('hidden');
      talkUpdateComposer();
      talkEl('chatInput')?.focus();
    }

// --- The "+" menu and the gift sheet ---
function talkToggleMenu(open) {
      const menu = talkEl('talkPlusMenu');
      const btn = talkEl('talkPlusBtn');
      if (!menu || !btn) return;
      const show = open ?? menu.classList.contains('hidden');
      menu.classList.toggle('hidden', !show);
      btn.setAttribute('aria-expanded', String(show));
      if (show) menu.querySelector('[role="menuitem"]')?.focus();
    }

function talkToggleGiftSheet(open) {
      const sheet = talkEl('talkGiftSheet');
      if (!sheet) return;
      sheet.classList.toggle('hidden', !open);
      talkRenderSuggestions();
      if (open) talkEl('talkGiftName')?.focus();
      else talkEl('talkPlusBtn')?.focus();
    }

let talkGiftEmoji = null;

function talkSendGift() {
      const nameEl = talkEl('talkGiftName');
      const kindEl = talkEl('talkGiftKind');
      const noteEl = talkEl('talkGiftNote');
      const name = (nameEl.value || '').trim().slice(0, 80);
      if (!name) { showToast('Pick something from the list or type what you are sending.'); nameEl.focus(); return; }
      const note = (noteEl.value || '').trim().slice(0, 200);
      const category = typeof categorizeItem === 'function' ? categorizeItem(name, kindEl.value) : (kindEl.value || 'thing');
      const emoji = talkGiftEmoji || (typeof CATEGORY_ICONS !== 'undefined' && CATEGORY_ICONS[category]) || '🎁';
      const visitor = talkVisitorName() || 'curiousWanderer';
      const mail = postMail({ kind: 'gift', from: visitor, name, category, emoji, note });
      if (!mail) return;
      state.chatLog.push({ kind: 'gift', sender: visitor, isBot: false, name, emoji, mailId: mail.id, text: note, time: 'Just now', at: Date.now() });
      nameEl.value = ''; noteEl.value = ''; kindEl.value = ''; talkGiftEmoji = null;
      talkEl('talkGiftCatalog')?.querySelectorAll('[data-gift-idx]').forEach(c => c.setAttribute('aria-pressed', 'false'));
      talkUi.stick = true;
      savePersistentBrainState();
      talkToggleGiftSheet(false);
      renderAllUI();
    }

function talkInit() {
      const input = talkEl('chatInput');
      const box = talkEl('chatMessagesBox');
      if (!input || !box) return;

      // Your name, from this device
      const nameInput = talkEl('visitorNameInput');
      if (nameInput && !nameInput.value) nameInput.value = talkSavedName();
      talkRenderName();
      talkEl('talkNameBtn')?.addEventListener('click', () => talkToggleNameEditor());
      talkEl('talkNameEditor')?.addEventListener('submit', (e) => {
        e.preventDefault();
        talkSaveName(nameInput.value);
        talkToggleNameEditor(false);
        talkEl('talkNameBtn')?.focus();
        showToast(talkVisitorName() ? `Kelo-1 will call you ${talkVisitorName()}.` : 'Name cleared.');
      });
      talkEl('talkNameEditor')?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); nameInput.value = talkSavedName(); talkToggleNameEditor(false); talkEl('talkNameBtn')?.focus(); }
      });

      // Typing: Enter sends, Shift+Enter makes a new line
      input.addEventListener('input', () => { talkAutosize(); talkUpdateComposer(); talkRenderSuggestions(); });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
          e.preventDefault();
          talkSend(input.value);
        }
      });
      talkEl('chatForm')?.addEventListener('submit', (e) => { e.preventDefault(); talkSend(input.value); });

      // Scrolling: pinned to the newest message unless you scroll up
      box.addEventListener('scroll', () => {
        const near = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
        if (near !== talkUi.stick) {
          talkUi.stick = near;
          if (near) talkUi.unseen = 0;
          talkRenderJump();
        }
      }, { passive: true });
      talkEl('talkJumpLatest')?.addEventListener('click', () => { talkScrollToLatest(false); input.focus({ preventScroll: true }); });

      // Buttons inside the thread (it is rebuilt, so one listener on the box)
      box.addEventListener('click', (e) => {
        const t = e.target.closest ? e.target.closest('button') : null;
        if (!t) return;
        if (t.hasAttribute('data-talk-more')) {
          talkUi.preserveScroll = { height: box.scrollHeight, top: box.scrollTop };
          if (typeof perfListShown !== 'undefined') perfListShown.chatMessagesBox = perfListLimit('chatMessagesBox', TALK_PAGE) + TALK_PAGE;
          talkUi.key = '';
          renderTalkTab();
        } else if (t.hasAttribute('data-talk-name')) {
          talkToggleNameEditor(true);
        } else if (t.hasAttribute('data-talk-open') && typeof window.openKeloMenu === 'function') {
          window.openKeloMenu(t.getAttribute('data-talk-open'));
        }
      });

      // Suggested messages send straight away
      talkEl('talkSuggestions')?.addEventListener('click', (e) => {
        const chip = e.target.closest && e.target.closest('[data-talk-say]');
        if (chip) talkSend(chip.getAttribute('data-talk-say'));
      });

      // The "+" menu: arrow keys move, Esc closes, a click outside closes
      const plusBtn = talkEl('talkPlusBtn');
      const menu = talkEl('talkPlusMenu');
      plusBtn?.addEventListener('click', () => talkToggleMenu());
      menu?.addEventListener('keydown', (e) => {
        const items = [...menu.querySelectorAll('[role="menuitem"]')];
        const i = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
        else if (e.key === 'Escape' || e.key === 'Tab') { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); plusBtn.focus(); } talkToggleMenu(false); }
      });
      document.addEventListener('click', (e) => {
        if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target) && !plusBtn.contains(e.target)) talkToggleMenu(false);
      });
      const fileInput = talkEl('imageUploadInput');
      menu?.addEventListener('click', (e) => {
        const item = e.target.closest && e.target.closest('[data-talk-plus]');
        if (!item) return;
        talkToggleMenu(false);
        if (item.getAttribute('data-talk-plus') === 'photo') fileInput?.click();
        else talkToggleGiftSheet(true);
      });
      fileInput?.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        talkPickPhoto(file);
      });
      talkEl('talkAttachRemove')?.addEventListener('click', () => { talkClearAttach(); input.focus(); });

      // The gift sheet: the same ideas as the Post tab, or anything you can name
      const catalog = talkEl('talkGiftCatalog');
      if (catalog && typeof GIFT_CATALOG !== 'undefined') {
        catalog.innerHTML = GIFT_CATALOG.map((g, i) => `<button type="button" data-gift-idx="${i}" aria-pressed="false" class="talk-gift-chip">${escapeHtml(g.emoji)} ${escapeHtml(g.name)}</button>`).join('');
        catalog.addEventListener('click', (e) => {
          const chip = e.target.closest && e.target.closest('[data-gift-idx]');
          if (!chip) return;
          const g = GIFT_CATALOG[Number(chip.getAttribute('data-gift-idx'))];
          talkEl('talkGiftName').value = g.name;
          talkEl('talkGiftKind').value = g.kind;
          talkGiftEmoji = g.emoji;
          catalog.querySelectorAll('[data-gift-idx]').forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
        });
      }
      talkEl('talkGiftName')?.addEventListener('input', () => { talkGiftEmoji = null; catalog?.querySelectorAll('[data-gift-idx]').forEach(c => c.setAttribute('aria-pressed', 'false')); });
      talkEl('talkGiftSheet')?.addEventListener('submit', (e) => { e.preventDefault(); talkSendGift(); });
      talkEl('talkGiftClose')?.addEventListener('click', () => talkToggleGiftSheet(false));
      talkEl('talkGiftSheet')?.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); talkToggleGiftSheet(false); } });

      // Opening the tab (or the menu) shows the newest messages
      const pane = talkEl('tab-talk');
      const side = talkEl('sideMenu');
      const onShow = () => {
        if (pane && !pane.classList.contains('hidden') && side && !side.classList.contains('translate-x-full')) {
          talkUi.key = '';
          renderTalkTab();
          if (talkUi.stick) box.scrollTop = box.scrollHeight;
        }
      };
      const watch = new MutationObserver(onShow);
      if (pane) watch.observe(pane, { attributes: true, attributeFilter: ['class'] });
      if (side) watch.observe(side, { attributes: true, attributeFilter: ['class'] });

      talkAutosize();
      renderTalkTab();
    }

window.addEventListener('DOMContentLoaded', talkInit);
