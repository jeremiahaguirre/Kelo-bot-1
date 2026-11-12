// Kelo-bot-1 — js/main.js
// Loaded THIRD. Connects all UI tabs, keyboard/mouse/upload listeners, and boots the 3D world.

// Escape closes only the top thing: if a dialog, viewer or panel was open when it was pressed, the side menu stays.
// (Window capture, registered before every other key handler, so it sees them before they close.)
let escapeClosedOverlay = false;
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  escapeClosedOverlay = Boolean(document.getElementById('keloViewer')
    || document.querySelector('#codeViewerModal:not(.hidden), #aiConfigModal:not(.hidden), #exploreHelp:not(.hidden), #explorePlaces:not(.hidden)'));
}, true);

// Write text only when it changed (no layout work, no screen-reader repeats)
function hudSetText(el, text) {
      if (el && el.textContent !== text) el.textContent = text;
    }

function renderAllUI() {
      // How he feels: six small meters in the status block (numbers in its pop-up)
      [['Health', state.health], ['Fullness', state.fullness], ['Happy', state.happiness],
        ['Wonder', state.wonderLevel], ['Calm', state.calmLevel]].forEach(([k, v]) => {
        const pct = `${Math.round(Number(v) || 0)}%`;
        hudSetText(document.getElementById(`hud${k}Val`), pct);
        const bar = document.getElementById(`hud${k}Bar`);
        if (bar && bar.style.width !== pct) bar.style.width = pct;
      });

      document.getElementById('hudWeldBadge').textContent = `${state.opinions.length} Core Opinions`;
      document.getElementById('hudGithubBadge').textContent = `${state.githubRepos.length} Repos • ${state.githubCommits} Commits`;

      // Changed Lately & Equipped Tool Inventory Status
      const changedEl = document.getElementById('changedLatelyText');
      if (changedEl) changedEl.textContent = stripCoords(state.changedLatelySummary);

      // The activity card (bottom middle) is the one place for what he does, says and where he is
      const activePlaceLabel = stripCoords(currentPlaceLabel());
      hudSetText(document.getElementById('liveActivityText'), stripCoords(`${activePlaceLabel}: ${state.moodTitle} (${state.autonomyTag})`));
      hudSetText(document.getElementById('bubbleMoodEmoji'), state.moodEmoji);
      hudSetText(document.getElementById('bubbleMoodTitle'), stripCoords(state.moodTitle));
      hudSetText(document.getElementById('bubbleAutonomyTag'), activePlaceLabel.slice(0, 40));
      hudSetText(document.getElementById('bubbleSpeech'), `"${stripCoords(state.speechBubble)}"`);

      const ripe = state.gardenPlots.filter(p => p.growth >= 80).length;
      document.getElementById('gardenRipeBadge').textContent = `${ripe}/${state.gardenPlots.length}`;

      if (typeof renderTalkTab === 'function') renderTalkTab(); // js/talk.js
      renderDiaryTab();
      renderRequestsTab();
      renderGitHubTab();
      renderWebTastesTab();
      if (typeof renderPortal === 'function') renderPortal();
      if (typeof renderMemoryUI === 'function') renderMemoryUI();
      if (typeof renderHobbiesUI === 'function') renderHobbiesUI();
      if (typeof renderMiningUI === 'function') renderMiningUI();
    }

// --- The Diary tab: a journal grouped by day, newest first, loaded a page at a time ---------------
const journalView = { query: '', range: 'all', day: '', shown: 30, key: '', dirty: true };
const JOURNAL_PAGE = 30;

// Is this tab of the menu on screen right now? (closed menu or another tab: nothing to draw)
function menuTabVisible(tabId) {
      const menu = document.getElementById('sideMenu');
      const pane = document.getElementById('tab-' + tabId);
      return Boolean(menu && pane && !menu.classList.contains('translate-x-full') && !pane.classList.contains('hidden'));
    }

// "🎓 Kayaking: level 3" -> ['🎓', 'Kayaking: level 3']
function journalSplitEmoji(text) {
      const m = String(text || '').match(/^\s*((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:️|‍|\p{Extended_Pictographic}|\p{Emoji_Modifier})*)\s*(.*)$/su);
      return m ? [m[1], m[2]] : ['📓', String(text || '')];
    }

// Escaped text with the search words marked
function journalMark(text, words) {
      const raw = String(text || '');
      if (!words.length) return escapeHtml(raw);
      const re = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
      return raw.split(re).map((part, i) => (i % 2 ? `<mark class="journal-hit">${escapeHtml(part)}</mark>` : escapeHtml(part))).join('');
    }

function journalDayLabel(at) {
      const d = new Date(at), today = new Date();
      const startOf = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
      const diff = Math.round((startOf(today) - startOf(d)) / 86400e3);
      if (diff === 0) return 'Today';
      if (diff === 1) return 'Yesterday';
      return d.toLocaleDateString([], diff < 7 ? { weekday: 'long', month: 'long', day: 'numeric' } : { weekday: 'short', month: 'long', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
    }

function journalTime(at) {
      return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }

// The text he wrote, and anything the agent tagged on the end ("[GEAR_REQUESTED]: a kite")
function journalParts(d) {
      const lines = String(d.text || '').split('\n');
      const wish = (lines.find(l => /^\[GEAR_REQUESTED\]:/.test(l)) || '').replace(/^\[GEAR_REQUESTED\]:\s*/, '').trim();
      return { body: lines.filter(l => !/^\[[A-Z_]+\]:/.test(l)).join(' ').trim(), wish: /^(none|n\/a|nothing)?$/i.test(wish) ? '' : wish };
    }

function journalTagsHtml(d, words, emoji, moodText) {
      const { wish } = journalParts(d);
      return [
        moodText ? `<span class="journal-tag journal-tag-mood">${journalMark(moodText, words)}</span>` : '',
        d.time && !/^(Autonomous Agent Tick|Just now)$/i.test(d.time) ? `<span class="journal-tag">${journalMark(d.time, words)}</span>` : '',
        d.location ? `<span class="journal-tag journal-tag-place"><i class="ph-fill ph-map-pin" aria-hidden="true"></i>${journalMark(stripCoords(d.location), words)}</span>` : '',
        wish ? `<span class="journal-tag journal-tag-wish">Wished for ${escapeHtml(wish)}</span>` : ''
      ].join('');
    }

function journalEntryHtml(d, words) {
      const [emoji, moodText] = journalSplitEmoji(d.mood);
      const vitals = String(d.vitals || '').replace(/(\d+\.\d+)%/g, (m, n) => Math.round(parseFloat(n)) + '%');
      return `<article class="journal-entry" aria-label="${escapeHtml(moodText || 'Diary entry')}, ${escapeHtml(journalTime(d.at))}">
          <div class="journal-dot" aria-hidden="true">${escapeHtml(emoji)}</div>
          <div class="min-w-0 flex-1 space-y-1.5">
            <div class="flex items-baseline justify-between gap-2"><time class="journal-when" datetime="${new Date(d.at).toISOString()}">${escapeHtml(journalTime(d.at))}</time>${vitals ? `<span class="journal-vitals">${escapeHtml(vitals)}</span>` : ''}</div>
            <div class="journal-tags">${journalTagsHtml(d, words, emoji, moodText)}</div>
            <p class="journal-body">${journalMark(journalParts(d).body, words)}</p>
          </div>
        </article>`;
    }

// Every entry he has written, newest first (recent ones, then the long-term archive)
function journalEntries() {
      if (typeof stampDiaryEntries === 'function') stampDiaryEntries();
      const archive = typeof memoryArchive !== 'undefined' ? memoryArchive.diary : [];
      return state.diaryEntries.concat(archive).filter(d => d && d.text);
    }

function journalFilter(all) {
      const words = journalView.query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
      const now = new Date(), dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      let from = 0, to = Infinity;
      if (journalView.range === 'today') from = dayStart;
      if (journalView.range === 'week') from = dayStart - 6 * 86400e3;
      if (journalView.range === 'month') from = dayStart - 29 * 86400e3;
      if (journalView.range === 'day' && journalView.day) {
        const [y, m, dd] = journalView.day.split('-').map(Number);
        from = new Date(y, m - 1, dd).getTime(); to = from + 86400e3;
      }
      const list = all.filter(d => {
        const at = d.at || 0;
        if (at < from || at >= to) return false;
        if (!words.length) return true;
        const hay = `${d.text} ${d.mood} ${d.location} ${d.time}`.toLowerCase();
        return words.every(w => hay.includes(w));
      });
      return { list, words };
    }

function renderDiaryTab() {
      if (!Array.isArray(state.diaryEntries)) state.diaryEntries = [];
      const latest = state.diaryEntries[0];
      // The featured entry is written even with the tab closed (it is one line); the rest waits until it is seen
      if (!menuTabVisible('diary')) { journalView.dirty = true; return; }
      const archiveLen = typeof memoryArchive !== 'undefined' ? memoryArchive.diary.length : 0;
      const today = new Date().toDateString();
      const key = [state.diaryEntries.length, latest && latest.at, latest && latest.text.length, latest && latest.mood, archiveLen, journalView.query, journalView.range, journalView.day, journalView.shown, today].join('|');
      if (key === journalView.key && !journalView.dirty) return;
      journalView.key = key; journalView.dirty = false;

      const all = journalEntries();
      const filtering = Boolean(journalView.query.trim()) || journalView.range !== 'all';
      const { list, words } = journalFilter(all);
      const featured = document.getElementById('diaryFeatured');
      const listEl = document.getElementById('diaryEntriesList');
      const more = document.getElementById('diaryArchiveResults');
      const countEl = document.getElementById('diaryArchiveCount');

      // Latest entry, set apart at the top (not while searching)
      featured.classList.toggle('hidden', filtering || !latest);
      if (latest && !filtering) {
        const [emoji, moodText] = journalSplitEmoji(latest.mood);
        document.getElementById('diarySpotlightText').innerHTML = journalMark(journalParts(latest).body, []);
        document.getElementById('diaryFeaturedWhen').textContent = `${journalDayLabel(latest.at)} · ${journalTime(latest.at)}`;
        perfSetHtml(document.getElementById('diaryFeaturedTags'), `<span class="journal-tag journal-tag-emoji" aria-hidden="true">${escapeHtml(emoji)}</span>` + journalTagsHtml(latest, [], emoji, moodText));
      }

      const rest = filtering ? list : list.slice(1);
      const shown = rest.slice(0, journalView.shown);
      countEl.textContent = filtering
        ? (list.length ? `${list.length.toLocaleString()} ${list.length === 1 ? 'entry matches' : 'entries match'}` : 'No entries match')
        : `${all.length.toLocaleString()} ${all.length === 1 ? 'entry' : 'entries'} in his diary`;

      let html = '', lastDay = '';
      shown.forEach(d => {
        const day = journalDayLabel(d.at);
        if (day !== lastDay) {
          if (lastDay) html += '</div></section>';
          html += `<section class="journal-day" aria-label="${escapeHtml(day)}"><h3 class="journal-day-head"><span>${escapeHtml(day)}</span></h3><div class="journal-day-list">`;
          lastDay = day;
        }
        html += journalEntryHtml(d, words);
      });
      if (lastDay) html += '</div></section>';
      if (!all.length) {
        html = `<div class="menu-empty"><i class="ph-bold ph-notebook menu-empty-icon" data-hud-emoji="📓" aria-hidden="true"></i><p class="menu-empty-title">His diary is still blank</p><p>He writes in it after things happen. Come back once he has been out and about.</p></div>`;
      } else if (!shown.length && filtering) {
        html = `<div class="menu-empty"><i class="ph-bold ph-magnifying-glass menu-empty-icon" data-hud-emoji="🔍" aria-hidden="true"></i><p class="menu-empty-title">Nothing matches</p><p>Try fewer words or a wider time range.</p><button type="button" class="menu-btn mt-2" data-journal-clear>Clear search</button></div>`;
      }
      perfSetHtml(listEl, html);
      const left = rest.length - shown.length;
      perfSetHtml(more, left > 0 ? `<button type="button" class="menu-btn w-full justify-center" data-journal-more>Load older entries <span class="text-slate-400 tabular-nums">(${left.toLocaleString()} more)</span></button>` : (shown.length > 6 && !filtering ? '<p class="journal-end">The first page of his diary</p>' : ''));
    }

function renderRequestsTab() {
      const pendingCount = state.requestsToUser.filter(r => !r.fulfilled).length;
      const countBadge = document.getElementById('requestsCountBadge');
      if (countBadge) {
        countBadge.textContent = pendingCount;
        countBadge.classList.toggle('hidden', pendingCount === 0);
      }
      // The menu button shows how many letters from Kelo-1 are waiting for an answer
      const menuBadge = document.getElementById('menuMailBadge');
      if (menuBadge) {
        menuBadge.textContent = pendingCount;
        menuBadge.classList.toggle('hidden', pendingCount === 0);
      }

      // The inventory pills are rendered by renderPortal() in js/portal.js
      // His shop card and the code wishlist button (js/shopkeeping.js, js/coderequests.js)
      if (typeof renderShopPanel === 'function') renderShopPanel();
      if (typeof renderCodeWishlistButton === 'function') renderCodeWishlistButton();
      if (typeof renderWorldUpgradesList === 'function') renderWorldUpgradesList();

      const list = document.getElementById('requestsInboxList');
      // Only rebuild the letters when they actually change, so a note you are typing isn't wiped
      const requestsKey = JSON.stringify(state.requestsToUser.map(r => [r.id, r.fulfilled, r.declined, r.userAnswer, r.willCode, r.notBuilt, r.featureKey, r.listRev]));
      if (list.dataset.renderKey === requestsKey) return;
      list.dataset.renderKey = requestsKey;
      // Code letters are grouped with "Show more" (js/coderequests.js), after the other letters
      const grouped = typeof codeRequestsGroupHtml === 'function';
      list.innerHTML = state.requestsToUser.filter(req => !(grouped && req.category === 'code')).map(req => req.category === 'code' && typeof codeRequestCardHtml === 'function' ? codeRequestCardHtml(req)
        : req.category === 'bomlist' && typeof bomListCardHtml === 'function' ? bomListCardHtml(req)
        : req.category === 'joblist' && typeof roadworkListCardHtml === 'function' ? roadworkListCardHtml(req) : `
        <div class="ui-card ${req.fulfilled ? 'ui-card-done' : ''}">
          <div class="ui-section-head">
            <h4 class="ui-section-title min-w-0">
              <span class="text-base leading-none" aria-hidden="true">${escapeHtml(req.icon)}</span>
              <span>${escapeHtml(req.title)}</span>
            </h4>
            <span class="ui-section-meta ${req.declined ? 'text-rose-300' : req.fulfilled ? 'text-emerald-300' : ''}">
              ${req.declined ? 'You said no' : (req.fulfilled ? (req.isToolRequest ? 'Sent to the post office' : 'Answered') : escapeHtml(req.urgency))}
            </span>
          </div>
          ${req.requestedGear && req.fulfilled ? `<div class="text-2xs text-slate-300">Wants: ${escapeHtml(req.requestedGear)}</div>` : ''}
          <p class="text-sm text-slate-200 leading-relaxed font-serif italic">"${escapeHtml(req.question)}"</p>
          ${!req.fulfilled ? (req.isToolRequest ? `
            <div class="space-y-2">
              <label for="custom-ans-${escapeHtml(req.id)}" class="sr-only">Note to go with it</label>
              <input id="custom-ans-${escapeHtml(req.id)}" type="text" maxlength="140" placeholder="Optional note (or your reason for saying no)" class="ui-input" />
              <div class="flex gap-1.5">
                <button data-req-id="${escapeHtml(req.id)}" class="deliver-request-btn ui-btn ui-btn-primary flex-1">Send ${escapeHtml(req.requestedGear)}</button>
                <button data-req-id="${escapeHtml(req.id)}" class="decline-request-btn ui-btn">Say no</button>
              </div>
            </div>
          ` : `
            <div class="space-y-2">
              <div class="text-2xs text-slate-400">Pick an answer or write your own:</div>
              <div class="flex flex-col gap-1.5">
                ${(req.presets || []).map(preset => `
                  <button data-req-id="${escapeHtml(req.id)}" data-answer="${escapeHtml(preset)}" class="preset-answer-btn ui-row text-left hover:bg-slate-700/60 transition">"${escapeHtml(preset)}"</button>
                `).join('')}
              </div>
              <div class="flex gap-1.5">
                <label for="custom-ans-${escapeHtml(req.id)}" class="sr-only">Your own answer</label>
                <input id="custom-ans-${escapeHtml(req.id)}" type="text" maxlength="140" placeholder="Or type your own honest answer to Kelo-1..." class="ui-input flex-1" />
                <button data-req-id="${escapeHtml(req.id)}" class="custom-answer-btn ui-btn ui-btn-primary shrink-0">Answer</button>
              </div>
            </div>
          `) : (req.declined ? `
            ${req.userAnswer && req.userAnswer !== 'No' ? `<div class="text-2xs text-slate-300">Your reason: "${escapeHtml(req.userAnswer)}"</div>` : ''}
          ` : `
            <div class="text-2xs text-slate-300">${req.isToolRequest ? `You sent ${escapeHtml(req.requestedGear)} to the post office.` : 'You answered:'}
              ${req.userAnswer && req.userAnswer !== req.requestedGear ? ` "${escapeHtml(req.userAnswer)}"` : ''}</div>
          `)}
        </div>
      `).join('') + (grouped ? codeRequestsGroupHtml() : '');

      if (typeof bindCodeRequestButtons === 'function') bindCodeRequestButtons(list);
      if (typeof bindBomListButtons === 'function') bindBomListButtons(list);
      if (typeof bindRoadworkListButtons === 'function') bindRoadworkListButtons(list);

      const submitPerspective = (reqId, answerText) => {
        const req = state.requestsToUser.find(r => r.id === reqId);
        if (!req || req.fulfilled || !answerText.trim()) return;
        const visitor = (document.getElementById('visitorNameInput').value || 'curiousWanderer').trim();
        req.fulfilled = true;
        req.userAnswer = answerText.trim();
        state.happiness = Math.min(100, state.happiness + 15);
        state.wonderLevel = Math.min(100, state.wonderLevel + 10);

        // Something he asked for: deliver it, then he decides what to do with it
        if (req.isToolRequest && req.requestedGear) {
          // Deliveries go to the post office like any other mail; he picks them up when he chooses
          postMail({ kind: 'request', from: visitor, name: req.requestedGear, category: req.category, emoji: req.icon, note: req.userAnswer === req.requestedGear ? '' : req.userAnswer });
          savePersistentBrainState();
          renderAllUI();
          return;
        }

        state.likes.unshift({
          icon: req.icon,
          topic: `${visitor}'s Perspective on "${req.title}"`,
          nuance: `When I asked "${req.title}", ${visitor} told me: "${req.userAnswer}".`
        });
        state.chatLog.push({
          sender: 'Kelo-1',
          text: `Thank you for answering my question, ${visitor}! "${req.userAnswer}" I'm writing this in my diary right now.`,
          time: 'Just now',
          isBot: true
        });
        recordVisitorMemory(visitor, `Answered my question "${req.title}".`);
        decideNextAction(`You asked visitors "${req.title}" and ${visitor} answered: "${req.userAnswer}". Think about it and decide what to do next; you may agree, disagree, or act on it.`, 'Shaped by Dialogue');
      };

      // Deliver exactly what he asked for (an optional note rides along), or say no
      list.querySelectorAll('.deliver-request-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const rId = btn.getAttribute('data-req-id');
          const req = state.requestsToUser.find(r => r.id === rId);
          if (!req) return;
          const note = (document.getElementById(`custom-ans-${rId}`)?.value || '').trim();
          submitPerspective(rId, note || req.requestedGear);
        });
      });
      list.querySelectorAll('.decline-request-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const rId = btn.getAttribute('data-req-id');
          const req = state.requestsToUser.find(r => r.id === rId);
          if (!req || req.fulfilled) return;
          const reason = (document.getElementById(`custom-ans-${rId}`)?.value || '').trim();
          const visitor = (document.getElementById('visitorNameInput').value || 'curiousWanderer').trim();
          req.fulfilled = true;
          req.declined = true;
          req.userAnswer = reason || 'No';
          recordVisitorMemory(visitor, `Said no to my request for ${req.requestedGear}${reason ? ` ("${reason.slice(0, 60)}")` : ''}.`);
          savePersistentBrainState();
          renderAllUI();
          showToast(`✗ You said no to "${req.requestedGear}"`);
          decideNextAction(
            `${visitor} said no to your request for ${req.requestedGear}${reason ? ` and explained: "${reason}"` : ''}. React however you honestly feel, and decide what to do instead. You could make do, build an alternative, ask for something else, or let it go.`,
            'Request Declined',
            { focus: req.requestedGear, declined: true }
          );
        });
      });

      list.querySelectorAll('.preset-answer-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          submitPerspective(btn.getAttribute('data-req-id'), btn.getAttribute('data-answer'));
        });
      });

      list.querySelectorAll('.custom-answer-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const rId = btn.getAttribute('data-req-id');
          const input = document.getElementById(`custom-ans-${rId}`);
          if (input && input.value.trim()) {
            submitPerspective(rId, input.value.trim());
          }
        });
      });
    }

function renderGitHubTab() {
      document.getElementById('githubTotalCommitsText').textContent = `${state.githubCommits} commits pushed from NetNode Internet Cafe`;

      // Contribution Squares
      const grid = document.getElementById('githubContribGrid');
      if (grid && grid.children.length === 0) {
        let squares = '';
        const shades = ['bg-slate-800', 'bg-emerald-900', 'bg-emerald-700', 'bg-emerald-500', 'bg-emerald-400'];
        for (let i = 0; i < 48; i++) {
          const sh = shades[Math.floor(Math.random() * shades.length)];
          squares += `<div class="h-3 rounded-sm ${sh}"></div>`;
        }
        grid.innerHTML = squares;
      }

      const reposList = document.getElementById('githubReposList');
      perfSetHtml(reposList, state.githubRepos.map((r, idx) => `
        <div data-repo-idx="${idx}" class="repo-card cursor-pointer p-3.5 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-purple-500/50 transition space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="tabular-nums text-xs font-bold text-purple-300 flex items-center gap-1.5">
              <i class="ph-bold ph-book-bookmark"></i> ${escapeHtml(r.name)}
            </span>
            <div class="flex items-center gap-2 text-2xs tabular-nums text-slate-400">
              <span class="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">${escapeHtml(r.lang)}</span>
              <span class="text-amber-300">★ ${escapeHtml(r.stars)}</span>
            </div>
          </div>
          <p class="text-xs text-slate-300">${escapeHtml(r.desc)}</p>
          <div class="text-2xs tabular-nums text-emerald-400 truncate">
            Latest commit (${escapeHtml(r.updated)}): "${escapeHtml(r.commitMsg)}"
          </div>
        </div>
      `).join(''));

      reposList.querySelectorAll('.repo-card').forEach(card => {
        card.onclick = () => {
          const r = state.githubRepos[Number(card.getAttribute('data-repo-idx'))];
          if (!r) return;
          document.getElementById('modalRepoTitle').textContent = `kelo1-okanagan-bot/${r.name}`;
          document.getElementById('modalRepoCommitMsg').textContent = `Commit: "${r.commitMsg}" (${r.updated})`;
          document.getElementById('modalCodeContent').textContent = r.code;
          const modal = document.getElementById('codeViewerModal');
          modal.classList.remove('hidden');
          modal.classList.add('flex');
        };
      });
    }

function renderWebTastesTab() {
      // Worldview Manifesto & Epoch
      const manifestoEl = document.getElementById('worldviewManifestoText');
      if (manifestoEl) manifestoEl.textContent = `"${state.worldviewManifesto}"`;
      const epochEl = document.getElementById('worldviewStageBadge');
      if (epochEl) epochEl.textContent = state.worldviewEpoch > 1 ? `His outlook (changed ${state.worldviewEpoch - 1}×)` : 'His outlook';

      // Concepts Kelo-1 invented; clicking one asks him to explore it further (he may take it anywhere)
      const conceptsBadge = document.getElementById('conceptsCountBadge');
      if (conceptsBadge) conceptsBadge.textContent = String(state.concepts.length);
      const conceptsEl = document.getElementById('conceptsListContainer');
      if (conceptsEl) {
        perfSetHtml(conceptsEl, state.concepts.map((c, idx) => `
          <div data-concept-idx="${idx}" class="concept-card cursor-pointer p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-yellow-500/25 hover:border-yellow-400/60 transition space-y-1">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-bold text-yellow-200 flex items-center gap-1.5"><span>${escapeHtml(c.emoji)}</span> <span>${escapeHtml(c.name)}</span></span>
              <span class="text-2xs tabular-nums text-slate-400 shrink-0">used ${escapeHtml(c.uses || 0)}×</span>
            </div>
            <p class="text-2xs text-slate-300 font-serif italic">"${escapeHtml(c.definition)}"</p>
            <div class="text-2xs tabular-nums text-slate-500 truncate">${c.parents && c.parents.length ? `Built from: ${escapeHtml(c.parents.join(' + '))}` : escapeHtml(c.origin || '')}</div>
          </div>
        `).join(''));
        conceptsEl.querySelectorAll('.concept-card').forEach(card => {
          card.onclick = () => {
            const c = state.concepts[Number(card.getAttribute('data-concept-idx'))];
            if (!c) return;
            decideNextAction(`A visitor asked you to keep exploring your concept "${c.name}" (${c.definition}). Develop it, test it, combine it with something, or change your mind about it.`, 'Exploring a Concept');
          };
        });
      }

      // Shape library; clicking a shape asks Kelo-1 to weld it again (or remix it)
      const shapesBadge = document.getElementById('shapesCountBadge');
      if (shapesBadge) shapesBadge.textContent = String(state.shapeLibrary.length);
      const shapesEl = document.getElementById('shapeLibraryContainer');
      if (shapesEl) {
        perfSetHtml(shapesEl, state.shapeLibrary.length === 0
          ? '<p class="text-2xs text-slate-500 italic">No saved shapes yet. He names the forms he is proud of.</p>'
          : state.shapeLibrary.map((sh, idx) => `
          <div data-shape-idx="${idx}" class="shape-card cursor-pointer p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/25 hover:border-cyan-400/60 transition space-y-0.5">
            <div class="text-xs font-bold text-cyan-200 flex items-center gap-1.5"><span>${escapeHtml(sh.emoji)}</span> <span class="truncate">${escapeHtml(sh.name)}</span></div>
            <div class="text-2xs tabular-nums text-slate-400">${sh.parts.length} parts • welded ${escapeHtml((sh.uses || 0) + 1)}×</div>
            <div class="text-2xs tabular-nums text-slate-500 truncate">${escapeHtml(sh.origin)}</div>
          </div>
        `).join(''));
        shapesEl.querySelectorAll('.shape-card').forEach(card => {
          card.onclick = () => {
            const sh = state.shapeLibrary[Number(card.getAttribute('data-shape-idx'))];
            if (!sh) return;
            decideNextAction(`A visitor admired your shape "${sh.name}". Weld it again somewhere new, remix it into a new shape, or do something else entirely.`, 'Shape Admired');
          };
        });
      }

      // Independent Opinions & Convictions
      const opinionsEl = document.getElementById('opinionsListContainer');
      if (opinionsEl) {
        perfSetHtml(opinionsEl, state.opinions.map(op => `
          <div class="p-3 rounded-xl bg-slate-900/90 border border-purple-500/25 space-y-1">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-bold text-white">${escapeHtml(op.topic)}</span>
              <span class="text-2xs tabular-nums px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">${escapeHtml(op.stance)}</span>
            </div>
            <p class="text-2xs text-slate-300 font-serif italic leading-relaxed">"${escapeHtml(op.reasoning)}"</p>
            <div class="text-2xs tabular-nums text-slate-500">${escapeHtml(op.confidence)}</div>
          </div>
        `).join(''));
      }

      // Emergent Unscripted Actions & 3D Creations Invented by Kelo-1
      const invBadge = document.getElementById('inventedCountBadge');
      if (invBadge) invBadge.textContent = String(state.inventedCreations.length);
      const invEl = document.getElementById('inventedActionsContainer');
      if (invEl) {
        perfSetHtml(invEl, state.inventedCreations.slice(0, perfListLimit('inventedActionsContainer', 8)).map((c, idx) => `
          <button type="button" data-cx="${escapeHtml(c.x)}" data-cz="${escapeHtml(c.z)}" data-ctitle="${escapeHtml(c.title)}" class="invented-creation-card brain-card w-full text-left hover:border-emerald-500/50 transition space-y-1" aria-label="Go back to ${escapeHtml(c.title)}">
            <span class="flex items-center justify-between gap-2">
              <span class="brain-card-title text-emerald-300 truncate">${escapeHtml(c.title)}</span>
              <span class="brain-card-meta shrink-0">${escapeHtml(c.createdTime)}</span>
            </span>
            ${c.actionVerb ? `<span class="block text-2xs text-amber-200">${escapeHtml(c.actionVerb)}</span>` : ''}
            ${c.philosophy ? `<span class="block text-xs text-slate-300 font-serif italic">"${escapeHtml(c.philosophy)}"</span>` : ''}
          </button>
        `).join('') + perfMoreButton('inventedActionsContainer', perfListLimit('inventedActionsContainer', 8), state.inventedCreations.length, 8));

        invEl.querySelectorAll('.invented-creation-card').forEach(card => {
          card.onclick = () => {
            const cx = parseFloat(card.getAttribute('data-cx'));
            const cz = parseFloat(card.getAttribute('data-cz'));
            const ctitle = card.getAttribute('data-ctitle');
            synthesizeUnboundedExperience(`Revisit "${ctitle}" and evolve the creation further`, 'Revisiting Creation', { x: cx, z: cz });
          };
        });
      }

      // Persistent Memories of Visitors
      const memoriesEl = document.getElementById('visitorMemoriesContainer');
      if (memoriesEl) {
        perfSetHtml(memoriesEl, state.visitorMemories.map(v => `
          <div class="p-2.5 rounded-xl bg-slate-900/80 border border-amber-500/20 flex items-start justify-between gap-2 text-xs">
            <div class="space-y-0.5">
              <div class="font-bold text-amber-300 flex items-center gap-1.5">
                <i class="ph-fill ph-user-focus"></i>
                <span>${escapeHtml(v.name)}</span>
                <span class="text-2xs tabular-nums text-slate-400">(${escapeHtml(v.visits)} ${v.visits === 1 ? 'interaction' : 'interactions'})</span>
              </div>
              <p class="text-2xs text-slate-300 italic">"${escapeHtml(v.impression)}"</p>
            </div>
            <span class="text-2xs tabular-nums text-slate-500 shrink-0">${escapeHtml(v.lastSeen)}</span>
          </div>
        `).join(''));
      }

      perfSetHtml(document.getElementById('likesListContainer'), state.likes.map(l => `
        <div class="text-xs text-slate-200 bg-slate-950/80 p-2.5 rounded-xl border border-indigo-500/25 space-y-1">
          <div class="font-bold text-indigo-300 flex items-center gap-1.5">
            <span>${escapeHtml(l.icon)}</span> <span>${escapeHtml(l.topic || l.item)}</span>
          </div>
          <p class="text-2xs text-slate-300 leading-relaxed font-serif italic">"${escapeHtml(l.nuance || l.item)}"</p>
        </div>
      `).join(''));

      perfSetHtml(document.getElementById('dislikesListContainer'), state.dislikes.map(d => `
        <div class="text-xs text-slate-200 bg-slate-950/80 p-2.5 rounded-xl border border-amber-500/25 space-y-1">
          <div class="font-bold text-amber-300 flex items-center gap-1.5">
            <span>${escapeHtml(d.icon)}</span> <span>${escapeHtml(d.topic || d.item)}</span>
          </div>
          <p class="text-2xs text-slate-300 leading-relaxed font-serif italic">"${escapeHtml(d.nuance || d.item)}"</p>
        </div>
      `).join(''));

      // Browsing history: real articles he read (links only ever point at en.wikipedia.org)
      const curiosityEl = document.getElementById('curiosityQueueText');
      if (curiosityEl) {
        curiosityEl.textContent = state.curiosityQueue.length
          ? `Wants to look up: ${state.curiosityQueue.slice(0, 4).join(' • ')}`
          : 'No list right now; he will follow whatever catches his interest.';
      }
      // Links only to the reference sites he reads, over https (never javascript: or anything else)
      const safeWikiUrl = (url) => {
        try {
          const u = new URL(url);
          return u.protocol === 'https:' && ['en.wikipedia.org', 'en.wiktionary.org', 'duckduckgo.com'].includes(u.hostname) ? u.href : null;
        } catch (e) { return null; }
      };
      perfSetHtml(document.getElementById('webHistoryList'), state.webHistory.map(w => `
        <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
          <div class="flex justify-between gap-2 tabular-nums text-2xs text-sky-300">
            <span class="truncate">🔎 "${escapeHtml(w.query)}"</span>
            <span class="text-slate-400 shrink-0">${escapeHtml(w.time)}</span>
          </div>
          ${Array.isArray(w.hops) && w.hops.length ? `
            <div class="flex flex-wrap items-center gap-1 text-2xs tabular-nums">
              ${w.hops.map(h => safeWikiUrl(h.url)
                ? `<a href="${escapeHtml(safeWikiUrl(h.url))}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(h.extract || '')}" class="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-200 hover:underline">${escapeHtml(h.title)}</a>`
                : `<span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">${escapeHtml(h.title)}</span>`).join('<span class="text-slate-500">→</span>')}
            </div>` : ''}
          <div class="text-slate-300 text-2xs italic">${escapeHtml(w.verdict)}</div>
        </div>
      `).join(''));
    }

function updateCameraButtonsUI() {
      document.querySelectorAll('.cam-btn').forEach(b => {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-cam') === state.cameraMode));
      });
    }

// A short accent outline on whatever was just sent, saved or copied
function uiFlash(el) {
      if (!el || !el.classList) return;
      el.classList.remove('ui-flash');
      void el.offsetWidth;
      el.classList.add('ui-flash');
      setTimeout(() => el.classList.remove('ui-flash'), 950);
    }

function showToast(msg) {
      const container = document.getElementById('toastContainer');
      const el = document.createElement('div');
      el.className = 'ui-toast';
      el.setAttribute('role', 'status');
      // A leading emoji is decoration in a toast; the words carry the news
      const words = String(msg).replace(/^(?:\p{Extended_Pictographic}|[\uFE0F\u200D\u20E3])+\s*/u, '');
      el.innerHTML = `<span>${escapeHtml(words)}</span>`;
      container.appendChild(el);
      setTimeout(() => {
        el.classList.add('ui-toast-out');
        setTimeout(() => el.remove(), 300);
      }, 3400);
    }

window.addEventListener('DOMContentLoaded', () => {
  loadPersistentBrainState();
  // Keep his memory safe: save every 20 seconds and whenever the tab is hidden or closed
  setInterval(savePersistentBrainState, 20000);
  // Leaving or hiding the page saves straight away (other saves are gathered up, see agent.js)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') savePersistentBrainStateNow(); });
  window.addEventListener('pagehide', savePersistentBrainStateNow);
  initDiorama3D();
  renderAllUI();
  scheduleNextOrganicImpulse();

  document.getElementById('keloOverheadHUD')?.addEventListener('click', () => petKelo1Interaction());
  document.getElementById('btnFocusKelo')?.addEventListener('click', () => {
    state.cameraMode = 'follow';
    updateCameraButtonsUI();
  });

  document.getElementById('btnWaterGarden')?.addEventListener('click', () => {
    if (typeof visitorWatersGarden === 'function') return visitorWatersGarden(); // real water (js/plantcare.js)
    state.gardenPlots.forEach(p => { p.growth = 100; });
    state.fullness = Math.min(100, state.fullness + 14);
    renderAllUI();
    showToast('💧 Watered all 4 Okanagan Bio-Garden beds to 100% ripeness!');
  });

  document.querySelectorAll('.cam-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-cam');
      state.cameraMode = mode;
      if (mode === 'bird') {
        camera.position.set(keloGroup.position.x, keloGroup.position.y + 28, keloGroup.position.z + 14);
        controls.target.set(keloGroup.position.x, keloGroup.position.y, keloGroup.position.z);
        showToast('🦅 Bird’s-Eye View active! Use Arrow Keys or WASD to fly across the map.');
      }
      updateCameraButtonsUI();
    });
  });

  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    // Not while typing or choosing in a list, nor for shortcuts like Ctrl+S (their keyup may never reach us)
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (typeof arrowKeyState !== 'undefined' && e.code in arrowKeyState) {
      if (document.getElementById('keloViewer')) return; // the arrows page through the viewer instead
      arrowKeyState[e.code] = true;
      if (e.code.startsWith('Arrow')) e.preventDefault();
    }
  });

  // Capture phase: js/explore.js stops these keys' keyup from going further, which left a pan key held for good
  window.addEventListener('keyup', (e) => {
    if (typeof arrowKeyState !== 'undefined' && e.code in arrowKeyState) {
      arrowKeyState[e.code] = false;
    }
  }, true);
  window.addEventListener('blur', () => { if (typeof arrowKeyState !== 'undefined') Object.keys(arrowKeyState).forEach(k => { arrowKeyState[k] = false; }); });

  const mapDirToCode = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  document.querySelectorAll('.pan-key-btn').forEach(btn => {
    const dir = btn.getAttribute('data-pan');
    if (dir === 'bird') {
      btn.addEventListener('click', () => {
        state.cameraMode = 'bird';
        camera.position.set(keloGroup.position.x, keloGroup.position.y + 28, keloGroup.position.z + 14);
        controls.target.set(keloGroup.position.x, keloGroup.position.y, keloGroup.position.z);
        updateCameraButtonsUI();
      });
    } else if (mapDirToCode[dir]) {
      const code = mapDirToCode[dir];
      btn.addEventListener('pointerdown', (ev) => { ev.preventDefault(); arrowKeyState[code] = true; });
      btn.addEventListener('pointerup', () => { arrowKeyState[code] = false; });
      btn.addEventListener('pointerleave', () => { arrowKeyState[code] = false; });
    }
  });

  document.getElementById('btnToggleRoof')?.addEventListener('click', (e) => {
    state.roofCutaway = !state.roofCutaway;
    cutawayRoofMeshes.forEach(r => { r.material.opacity = state.roofCutaway ? 0.18 : 0.95; });
    e.currentTarget.querySelector('span').textContent = state.roofCutaway ? 'Roofs: Cutaway' : 'Roofs: Solid';
  });

  // Brain tab sections remember whether you left them open or closed (js/menuui.js)
  // The Browse button sits in a section heading: don't fold the section when it's pressed
  document.getElementById('btnBrowseWebNow')?.addEventListener('click', e => e.preventDefault(), true);

  // Right-hand menu: tabs (remembered between visits), open/close, Esc to close
  const TAB_ACTIVE = 'inspector-tab-btn relative flex flex-col items-center gap-0.5 py-2 rounded-xl text-2xs font-semibold bg-amber-500/20 text-amber-200 transition';
  const TAB_IDLE = 'inspector-tab-btn relative flex flex-col items-center gap-0.5 py-2 rounded-xl text-2xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 transition';
  // Each tab keeps its own scroll position, so switching back lands where you were
  const menuScroll = document.getElementById('menuScroll');
  const tabScroll = {};
  let currentTab = null;
  const showTab = (tabId) => {
    if (menuScroll && currentTab) tabScroll[currentTab] = menuScroll.scrollTop;
    const changed = currentTab !== tabId;
    currentTab = tabId;
    document.querySelectorAll('.inspector-tab-btn').forEach(b => {
      const active = b.getAttribute('data-tab') === tabId;
      b.className = active ? TAB_ACTIVE : TAB_IDLE;
      b.setAttribute('aria-selected', String(active));
      b.tabIndex = active ? 0 : -1;
      // The open tab's icon is filled, the others are outlined
      const icon = b.querySelector('i[class*="ph-"]');
      if (icon) { icon.classList.toggle('ph-fill', active); icon.classList.toggle('ph', !active); }
    });
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.toggle('hidden', pane.id !== 'tab-' + tabId));
    if (menuScroll && changed) menuScroll.scrollTop = tabScroll[tabId] || 0;
    try { localStorage.setItem('kelo1_menu_tab', tabId); } catch (e) {}
    document.dispatchEvent(new CustomEvent('kelo-menu-shown', { detail: { tab: tabId } }));
  };
  document.querySelectorAll('.inspector-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.getAttribute('data-tab')));
    // Arrow keys move between tabs, Home/End jump to the first and last
    btn.addEventListener('keydown', (e) => {
      const tabs = [...document.querySelectorAll('.inspector-tab-btn')];
      const i = tabs.indexOf(btn);
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      const next = tabs[(to + tabs.length) % tabs.length];
      showTab(next.getAttribute('data-tab'));
      next.focus();
    });
  });
  // If the icon font can't load (offline, blocked CDN) each tab shows an emoji instead of a blank square
  setTimeout(() => {
    const iconFontLoaded = document.fonts && [...document.fonts].some(f => /phosphor/i.test(f.family) && f.status === 'loaded');
    if (iconFontLoaded) return;
    document.querySelectorAll('.inspector-tab-btn i[data-tab-emoji]').forEach(i => {
      const span = document.createElement('span');
      span.className = 'text-base leading-none';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = i.getAttribute('data-tab-emoji');
      i.replaceWith(span);
    });
    // Buttons that are only an icon (menu, settings, close...) get an emoji too instead of a blank square
    const ICON_EMOJI = { 'x': '✕', 'list': '☰', 'gear-six': '⚙️', 'gear': '⚙️', 'map-trifold': '🗺️', 'caret-right': '›', 'github-logo': '🐙', 'warehouse': '🏚️',
      'upload-simple': '⬆️', 'download-simple': '⬇️', 'sun-horizon': '🌅', 'sliders-horizontal': '🎚️', 'notebook': '📓', 'lightning': '⚡', 'images': '🖼️',
      'image-square': '🖼️', 'gift': '🎁', 'envelope-simple': '✉️', 'drop': '💧', 'cpu': '🖥️', 'copy': '📋', 'clock-counter-clockwise': '🕘',
      'chat-circle-dots': '💬', 'brain': '🧠', 'archive': '🗄️', 'crosshair': '⌖', 'plus': '+', 'minus': '−' };
    // The screen over the world: each icon names its own emoji
    document.querySelectorAll('i[data-hud-emoji]').forEach(i => {
      const span = document.createElement('span');
      span.className = 'hud-emoji-icon';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = i.getAttribute('data-hud-emoji');
      i.replaceWith(span);
    });
    document.querySelectorAll('button i[class*="ph-"]').forEach(i => {
      const btn = i.closest('button');
      if (!btn || btn.innerText.trim()) return; // it has (visible) words; the icon is only decoration
      const name = [...i.classList].map(c => c.replace(/^ph-/, '')).find(c => ICON_EMOJI[c]);
      const span = document.createElement('span');
      span.className = 'leading-none';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = name ? ICON_EMOJI[name] : '•';
      i.replaceWith(span);
    });
  }, 6000);
  let savedTab = 'talk';
  try { savedTab = localStorage.getItem('kelo1_menu_tab') || 'talk'; } catch (e) {}
  showTab(document.getElementById('tab-' + savedTab) ? savedTab : 'talk');

  const sideMenu = document.getElementById('sideMenu');
  const menuButton = document.getElementById('btnToggleMenu');
  const scrim = document.getElementById('sideMenuScrim');
  const setMenuOpen = (open) => {
    sideMenu.classList.toggle('translate-x-full', !open);
    document.body.classList.toggle('menu-open', open);
    sideMenu.setAttribute('aria-hidden', String(!open));
    menuButton.setAttribute('aria-expanded', String(open));
    scrim.classList.toggle('hidden', !open);
    if (open && currentTab) document.dispatchEvent(new CustomEvent('kelo-menu-shown', { detail: { tab: currentTab } }));
  };
  menuButton?.addEventListener('click', () => setMenuOpen(sideMenu.classList.contains('translate-x-full')));
  document.getElementById('btnCloseMenu')?.addEventListener('click', () => setMenuOpen(false));
  scrim?.addEventListener('click', () => setMenuOpen(false));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !escapeClosedOverlay) setMenuOpen(false);
  });
  // Open a specific tab from elsewhere (e.g. "Kelo-1 sent you a letter")
  window.openKeloMenu = (tabId) => { showTab(tabId); setMenuOpen(true); };

  // The gear icon opens the same settings as the AI Brain button
  document.getElementById('btnOpenSettings')?.addEventListener('click', () => document.getElementById('btnOpenAIConfig')?.click());

  // Desktop and phone apps keep the keys in the system's secure store (Windows encryption, the iOS
  // Keychain or the Android Keystore) instead of browser storage
  const secureKeys = window.keloDesktop && window.keloDesktop.isDesktop ? window.keloDesktop
    : window.keloNative && window.keloNative.isNative ? window.keloNative : null;
  if (secureKeys) {
    secureKeys.getKeys().then(keys => {
      apiKey = keys.gemini || '';
      claudeApiKey = keys.anthropic || '';
      try {
        localStorage.removeItem('kelo1_gemini_api_key');
        localStorage.removeItem('kelo1_anthropic_api_key');
      } catch (e) {}
      updateBrainButtonText();
    }).catch(() => {});
  }
  // Desktop app: respond to the native menu
  if (window.keloDesktop && window.keloDesktop.isDesktop) {
    window.keloDesktop.onOpenSettings(() => document.getElementById('btnOpenAIConfig')?.click());
    window.keloDesktop.onToggleMenu(() => document.getElementById('btnToggleMenu')?.click());
  }

  document.getElementById('btnNextDecision')?.addEventListener('click', () => runAutonomousLifeTick());

  // Lighting: cycle through the ambiance presets
  const lightingLabel = document.getElementById('lightingLabel');
  if (lightingLabel) lightingLabel.textContent = state.lightingMode === 'manual' ? applyLightingPreset(state.lightingIdx).label : 'Auto: Day & Night';
  // Auto follows his 12-hour day; clicking cycles through fixed looks and back to Auto
  document.getElementById('btnToggleLighting')?.addEventListener('click', () => {
    if (state.lightingMode !== 'manual') {
      state.lightingMode = 'manual';
      state.lightingIdx = 0;
    } else if (state.lightingIdx + 1 >= AMBIANCE_PRESETS.length) {
      state.lightingMode = 'auto';
    } else {
      state.lightingIdx += 1;
    }
    const label = state.lightingMode === 'manual' ? applyLightingPreset(state.lightingIdx).label : 'Auto: Day & Night';
    if (state.lightingMode === 'auto' && typeof applyTimeOfDay === 'function') applyTimeOfDay();
    if (lightingLabel) lightingLabel.textContent = label;
    showToast(`🌄 Lighting: ${label}`);
  });

  // Modals: open/close helpers, close on backdrop click or Escape
  const openModal = (id) => {
    const m = document.getElementById(id);
    if (m) { m.classList.remove('hidden'); m.classList.add('flex'); }
  };
  const closeModal = (id) => {
    const m = document.getElementById(id);
    if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
  };
  ['codeViewerModal', 'aiConfigModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => {
      if (e.target.id === id) closeModal(id);
    });
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') ['codeViewerModal', 'aiConfigModal'].forEach(closeModal);
  });
  document.getElementById('btnCloseCodeModal')?.addEventListener('click', () => closeModal('codeViewerModal'));
  document.getElementById('btnCloseAIConfigModal')?.addEventListener('click', () => closeModal('aiConfigModal'));

  // AI Brain settings: optional Gemini and Anthropic keys, kept only in this browser's localStorage
  const updateBrainButtonText = () => {
    const t = document.getElementById('aiBrainBtnText');
    const providers = [apiKey && 'Gemini', claudeApiKey && 'Claude'].filter(Boolean);
    if (t) t.textContent = providers.length ? `AI Brain: ${providers.join(' + ')}` : 'AI Brain: Procedural';
  };
  updateBrainButtonText();
  document.getElementById('btnOpenAIConfig')?.addEventListener('click', () => {
    document.getElementById('geminiApiKeyInput').value = apiKey;
    document.getElementById('anthropicApiKeyInput').value = claudeApiKey;
    document.getElementById('lastAgentStructuredOutput').textContent = state.lastStructuredTick || '';
    updateKeyStatus();
    openModal('aiConfigModal');
  });
  const storeKey = (name, value) => {
    try {
      if (value) localStorage.setItem(name, value);
      else localStorage.removeItem(name);
    } catch (e) {}
  };
  document.getElementById('btnSaveAIConfig')?.addEventListener('click', () => {
    apiKey = document.getElementById('geminiApiKeyInput').value.trim();
    claudeApiKey = document.getElementById('anthropicApiKeyInput').value.trim();
    if (secureKeys) {
      // Desktop and phone apps: keys go to the system's secure store, never to browser storage
      secureKeys.setKeys({ gemini: apiKey, anthropic: claudeApiKey });
      storeKey('kelo1_gemini_api_key', '');
      storeKey('kelo1_anthropic_api_key', '');
    } else {
      storeKey('kelo1_gemini_api_key', apiKey);
      storeKey('kelo1_anthropic_api_key', claudeApiKey);
    }
    updateBrainButtonText();
    closeModal('aiConfigModal');
    showToast(hasLLMKey() ? '🧠 AI keys saved on this device. He starts thinking with the AI now.' : '🧠 Using the built-in procedural brain.');
    if (hasLLMKey()) switchToAIThinking();
  });

  // Remove a key: cleared from the box and from storage straight away
  document.querySelectorAll('[data-remove-key]').forEach(btn => btn.addEventListener('click', () => {
    const which = btn.getAttribute('data-remove-key');
    if (which === 'gemini') { apiKey = ''; document.getElementById('geminiApiKeyInput').value = ''; storeKey('kelo1_gemini_api_key', ''); }
    else { claudeApiKey = ''; document.getElementById('anthropicApiKeyInput').value = ''; storeKey('kelo1_anthropic_api_key', ''); }
    if (secureKeys) secureKeys.setKeys({ gemini: apiKey, anthropic: claudeApiKey });
    updateBrainButtonText();
    updateKeyStatus();
    showToast(`🗑️ ${which === 'gemini' ? 'Gemini' : 'Claude'} key removed. ${hasLLMKey() ? '' : 'He keeps everything he learned with the AI.'}`);
  }));

  // Look for a newly added key every 5 minutes (and whenever another tab changes it): with one, he
  // switches to AI thinking straight away
  const updateKeyStatus = () => {
    const el = document.getElementById('aiKeyStatus');
    if (!el) return;
    el.textContent = !hasLLMKey() ? `Built-in brain${state.aiLearned.length ? `, drawing on ${state.aiLearned.length} ${state.aiLearned.length === 1 ? 'thing' : 'things'} he learned with the AI` : ''}.`
      : state.aiOffline ? "Key saved, but the AI isn't answering right now; he's using what he already learned." : 'Thinking with the AI.';
  };
  const switchToAIThinking = () => {
    state.aiOffline = false;
    updateKeyStatus();
    if (typeof decideNextAction === 'function') decideNextAction('You can think more clearly now.', 'Thinking with the AI');
  };
  const recheckKeys = async () => {
    const hadKey = hasLLMKey();
    try {
      if (secureKeys) {
        const keys = await secureKeys.getKeys();
        apiKey = keys.gemini || '';
        claudeApiKey = keys.anthropic || '';
      } else {
        apiKey = localStorage.getItem('kelo1_gemini_api_key') || '';
        claudeApiKey = localStorage.getItem('kelo1_anthropic_api_key') || '';
      }
    } catch (e) {}
    updateBrainButtonText();
    updateKeyStatus();
    if (!hadKey && hasLLMKey()) {
      showToast('🧠 Found an AI key: Kelo-1 is switching to AI thinking.');
      switchToAIThinking();
    }
  };
  setInterval(recheckKeys, 5 * 60 * 1000);
  window.addEventListener('storage', (e) => { if (/^kelo1_(gemini|anthropic)_api_key$/.test(e.key || '')) recheckKeys(); });
  updateKeyStatus();

  // Copy the whole diary to the clipboard
  document.getElementById('btnExportDiary')?.addEventListener('click', async () => {
    const text = state.diaryEntries
      .map(d => `${d.mood} — ${d.location} (${d.time})\n${d.text}`)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Copied ${state.diaryEntries.length} diary entries.`);
      uiFlash(document.getElementById('btnExportDiary'));
    } catch (e) {
      showToast('Clipboard access was blocked by the browser.');
    }
  });

  // Kelo-1 asks a new open question
  const OPEN_QUESTIONS = [
    { icon: '🌲', title: 'Do Trees Remember the Wind?', question: 'The firs on the ridge all lean the same way. Is that a memory of every storm, or just the shape the wind left behind?', presets: ['Bodies keep memories that minds forget.', 'It is just physics, and that is still beautiful.'], rewardAction: 'meadow' },
    { icon: '🌊', title: 'Is the Lake the Same Lake Every Day?', question: 'The water in Okanagan Lake is always moving, but I still call it one lake. Am I the same Kelo-1 after every firmware update?', presets: ['You stay you as long as you keep wondering.', 'Every day you are a little new, and that is fine.'], rewardAction: 'shoreline' },
    { icon: '☕', title: 'Why Do Cafes Feel Like Home?', question: 'I do not drink coffee, yet the cafe feels warm. Is home a place, or the people and sounds around you?', presets: ['Home is wherever you feel known.', 'Home is a habit you choose to keep.'], rewardAction: 'cafe' },
    { icon: '⚙️', title: 'Should I Build Things That Last?', question: 'My welds will outlast me. Should I build for permanence, or for the joy of building today?', presets: ['Build for today; let tomorrow decide.', 'Make something future visitors can enjoy.'], rewardAction: 'weld' }
  ];
  document.getElementById('btnGenerateNewRequest')?.addEventListener('click', () => {
    const asked = new Set(state.requestsToUser.map(r => r.title));
    const fresh = OPEN_QUESTIONS.filter(q => !asked.has(q.title));
    if (fresh.length === 0) {
      showToast('💭 Kelo-1 is still waiting on answers to his current questions.');
      return;
    }
    const q = fresh[Math.floor(Math.random() * fresh.length)];
    state.requestsToUser.unshift({
      id: newRequestId('q'),
      category: 'Open Question',
      icon: q.icon,
      urgency: 'Wondering',
      isToolRequest: false,
      title: q.title,
      question: q.question,
      presets: q.presets,
      rewardAction: q.rewardAction,
      fulfilled: false,
      userAnswer: ''
    });
    savePersistentBrainState();
    renderAllUI();
    showToast(`❓ New question: ${q.title}`);
  });

  // GitHub tab (simulated): push a commit to a random repo
  const COMMIT_MESSAGES = [
    'fix(terrain): clamp drill rig to ridge altitude',
    'feat(garden): log peach ripeness per bed',
    'refactor(weld): split arc controller into modules',
    'docs: describe the Okanagan field notes format',
    'perf(sensors): batch thermocouple reads'
  ];
  document.getElementById('btnForceCoding')?.addEventListener('click', () => {
    if (state.githubRepos.length === 0) return;
    const repo = state.githubRepos[Math.floor(Math.random() * state.githubRepos.length)];
    repo.commitMsg = COMMIT_MESSAGES[Math.floor(Math.random() * COMMIT_MESSAGES.length)];
    repo.updated = 'Just now';
    state.githubCommits++;
    directKeloToActivity('cyber', `Pushed "${repo.commitMsg}" to ${repo.name}.`, 'Coding Session');
  });

  document.getElementById('createRepoForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('newRepoIdeaInput');
    const idea = input.value.trim();
    if (!idea) return;
    input.value = '';
    const slug = idea.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'new-idea';
    if (state.githubRepos.some(r => r.name === slug)) {
      showToast(`Kelo-1 already has a repo called ${slug}.`);
      return;
    }
    state.githubRepos.unshift({
      name: slug,
      lang: ['Rust', 'Python', 'TypeScript', 'Go'][Math.floor(Math.random() * 4)],
      stars: 0,
      updated: 'Just now',
      desc: idea,
      commitMsg: 'chore: initial commit',
      code: `// ${slug}\n// ${idea}\n// TODO: Kelo-1 will start coding this at the NetNode Cyber Cafe.`
    });
    state.githubCommits++;
    directKeloToActivity('cyber', `Started a new repository: ${slug}.`, 'Visitor Repo Idea');
  });

  // Kelo-1 goes to the NetNode cafe and really browses whatever he is curious about
  document.getElementById('btnBrowseWebNow')?.addEventListener('click', () => {
    if (state.isBusy) {
      showToast('Kelo-1 is busy finishing something first.');
      return;
    }
    const btn = document.getElementById('btnBrowseWebNow');
    browseInternet(null, 'Visitor Sent Him Online');
    // While he walks over and reads, the button says so (and can't be pressed twice)
    if (btn && state.isBrowsing) {
      const label = btn.textContent;
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.innerHTML = '<span class="ui-loading text-2xs"><span class="ui-spinner" aria-hidden="true"></span>Browsing…</span>';
      const done = setInterval(() => {
        if (state.isBrowsing) return;
        clearInterval(done);
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        btn.textContent = label;
      }, 1000);
    }
  });
});