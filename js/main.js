// Kelo-bot-1 — js/main.js
// Loaded THIRD. Connects all UI tabs, keyboard/mouse/upload listeners, and boots the 3D world.

function renderAllUI() {
      // Pino's World 5 Inner States: Fullness, Energy, Wonder, Joy, Calm
      document.getElementById('hudHealthVal').textContent = `${state.health}%`;
      document.getElementById('hudHealthBar').style.width = `${state.health}%`;
      document.getElementById('hudFullnessVal').textContent = `${state.fullness}%`;
      document.getElementById('hudFullnessBar').style.width = `${state.fullness}%`;
      document.getElementById('hudHappyVal').textContent = `${state.happiness}%`;
      document.getElementById('hudHappyBar').style.width = `${state.happiness}%`;

      const wonderValEl = document.getElementById('hudWonderVal');
      const wonderBarEl = document.getElementById('hudWonderBar');
      if (wonderValEl) wonderValEl.textContent = `${state.wonderLevel}%`;
      if (wonderBarEl) wonderBarEl.style.width = `${state.wonderLevel}%`;

      const calmValEl = document.getElementById('hudCalmVal');
      const calmBarEl = document.getElementById('hudCalmBar');
      if (calmValEl) calmValEl.textContent = `${state.calmLevel}%`;
      if (calmBarEl) calmBarEl.style.width = `${state.calmLevel}%`;

      document.getElementById('hudWeldBadge').textContent = `${state.opinions.length} Core Opinions`;
      document.getElementById('hudGithubBadge').textContent = `${state.githubRepos.length} Repos • ${state.githubCommits} Commits`;

      // Changed Lately & Equipped Tool Inventory Status
      const changedEl = document.getElementById('changedLatelyText');
      if (changedEl) changedEl.textContent = state.changedLatelySummary;
      const queuePill = document.getElementById('unopenedQueuePill');
      if (queuePill) {
        queuePill.textContent = `Tools Equipped: ${state.toolInventory.length}`;
      }

      // Header & Overhead 3D Bubble
      document.getElementById('headerEmotionBadge').innerHTML = `<span>${escapeHtml(state.moodEmoji)}</span> <span>${escapeHtml(state.moodTitle)}</span>`;
      document.getElementById('headerObsessionText').textContent = state.currentObsession;
      const activePlaceLabel = currentPlaceLabel();
      document.getElementById('liveActivityText').textContent = `${activePlaceLabel}: ${escapeHtml(state.moodTitle)} (${state.autonomyTag})`;

      document.getElementById('bubbleMoodEmoji').textContent = state.moodEmoji;
      document.getElementById('bubbleMoodTitle').textContent = state.moodTitle;
      document.getElementById('bubbleAutonomyTag').textContent = state.autonomyTag;
      document.getElementById('bubbleSpeech').textContent = `"${state.speechBubble}"`;

      const ripe = state.gardenPlots.filter(p => p.growth >= 80).length;
      document.getElementById('gardenRipeBadge').textContent = `${ripe}/${state.gardenPlots.length}`;

      renderChatBox();
      renderDiaryTab();
      renderRequestsTab();
      renderGitHubTab();
      renderWebTastesTab();
    }

function renderChatBox() {
      const box = document.getElementById('chatMessagesBox');
      box.innerHTML = state.chatLog.slice(-6).map(m => `
        <div class="flex items-start gap-2 ${m.isBot ? 'text-amber-200' : 'text-sky-200'}">
          <span class="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded ${m.isBot ? 'bg-amber-500/20 text-amber-300' : 'bg-sky-500/20 text-sky-300'} shrink-0">${escapeHtml(m.sender)}</span>
          <p class="leading-snug">${escapeHtml(m.text)}</p>
        </div>
      `).join('');
      box.scrollTop = box.scrollHeight;
    }

function renderDiaryTab() {
      const list = document.getElementById('diaryEntriesList');
      if (!Array.isArray(state.diaryEntries)) state.diaryEntries = [];
      if (state.diaryEntries.length > 0) {
        document.getElementById('diarySpotlightText').textContent = `"${state.diaryEntries[0].text}"`;
      }
      list.innerHTML = state.diaryEntries.map(d => `
        <article class="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800/90 space-y-1.5 hover:border-slate-700 transition">
          <div class="flex items-center justify-between text-[11px] font-mono">
            <span class="text-amber-300 font-bold">${escapeHtml(d.mood)}</span>
            <span class="text-slate-400">${escapeHtml(d.vitals)} • ${escapeHtml(d.time)}</span>
          </div>
          <div class="text-[11px] font-mono text-sky-300 flex items-center gap-1">
            <i class="ph-fill ph-map-pin"></i> <span>${escapeHtml(d.location)}</span>
          </div>
          <p class="font-serif italic text-slate-200 text-sm leading-relaxed pl-2.5 border-l-2 border-amber-400/50">
            "${escapeHtml(d.text)}"
          </p>
        </article>
      `).join('');
    }

function renderRequestsTab() {
      const pendingCount = state.requestsToUser.filter(r => !r.fulfilled).length;
      document.getElementById('requestsCountBadge').textContent = pendingCount;

      // Render Equipped Tools & Raw Materials Inventory Pills
      const invCountEl = document.getElementById('inventoryCountLabel');
      if (invCountEl) invCountEl.textContent = `${state.toolInventory.length} Items Equipped`;
      const invPillsEl = document.getElementById('toolInventoryPills');
      if (invPillsEl) {
        invPillsEl.innerHTML = state.toolInventory.map(item => `
          <span class="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-200 text-[10px] font-mono flex items-center gap-1">
            <i class="ph-fill ph-check-circle text-emerald-400"></i> ${escapeHtml(item)}
          </span>
        `).join('');
      }

      const list = document.getElementById('requestsInboxList');
      list.innerHTML = state.requestsToUser.map(req => `
        <div class="p-4 rounded-2xl border ${req.fulfilled ? 'bg-slate-950/60 border-emerald-500/30' : (req.isToolRequest ? 'bg-slate-950 border-amber-500/50 shadow-lg' : 'bg-slate-950 border-rose-500/40 shadow-lg')} space-y-2.5">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-white flex items-center gap-1.5">
              <span class="text-lg">${escapeHtml(req.icon)}</span>
              <span>${escapeHtml(req.title)}</span>
            </span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 ${req.fulfilled ? 'bg-emerald-500/20 text-emerald-300' : (req.isToolRequest ? 'bg-amber-500/25 text-amber-300 border border-amber-400/40' : 'bg-rose-500/20 text-rose-300')}">
              ${req.fulfilled ? '✓ Delivered / Reflected' : escapeHtml(req.urgency)}
            </span>
          </div>
          ${req.requestedGear ? `<div class="text-[11px] font-mono text-amber-300 bg-amber-950/30 border border-amber-500/30 px-2.5 py-1 rounded-lg">Wants: ${escapeHtml(req.requestedGear)}</div>` : ''}
          <p class="text-xs text-slate-200 leading-relaxed font-serif italic">"${escapeHtml(req.question)}"</p>
          ${!req.fulfilled ? `
            <div class="space-y-2 pt-1">
              <div class="text-[10px] font-mono uppercase text-slate-400">${req.isToolRequest ? 'Bring it, or describe what you are bringing instead:' : 'Share a perspective or write your own answer:'}</div>
              <div class="flex flex-col gap-1.5">
                ${(req.presets || []).map(preset => `
                  <button data-req-id="${escapeHtml(req.id)}" data-answer="${escapeHtml(preset)}" class="preset-answer-btn text-left text-[11px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-amber-500/25 text-slate-200 hover:text-amber-200 border border-slate-800 hover:border-amber-500/40 transition">
                    ${req.isToolRequest ? '📦' : '💬'} "${escapeHtml(preset)}"
                  </button>
                `).join('')}
              </div>
              <div class="flex gap-1.5 pt-1">
                <input id="custom-ans-${escapeHtml(req.id)}" type="text" maxlength="140" placeholder="${req.isToolRequest ? 'Or describe what you are bringing...' : 'Or type your own honest answer to Kelo-1...'}"
                  class="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400" />
                <button data-req-id="${escapeHtml(req.id)}" class="custom-answer-btn px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-bold text-xs shrink-0 transition">
                  ${req.isToolRequest ? 'Deliver' : 'Answer'}
                </button>
              </div>
            </div>
          ` : `
            <div class="p-2.5 rounded-xl bg-emerald-950/25 border border-emerald-500/30 text-[11px] text-emerald-200 space-y-1">
              <div class="font-mono text-[10px] text-emerald-400">${req.isToolRequest ? 'You delivered:' : 'Your Perspective Shared with Kelo-1:'}</div>
              <div class="italic">"${escapeHtml(req.userAnswer)}"</div>
            </div>
          `}
        </div>
      `).join('');

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
          receiveItem(req.requestedGear, req.category, visitor, req.userAnswer, { type: 'request' });
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
      reposList.innerHTML = state.githubRepos.map((r, idx) => `
        <div data-repo-idx="${idx}" class="repo-card cursor-pointer p-3.5 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-purple-500/50 transition space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="font-mono text-xs font-bold text-purple-300 flex items-center gap-1.5">
              <i class="ph-bold ph-book-bookmark"></i> ${escapeHtml(r.name)}
            </span>
            <div class="flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <span class="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">${escapeHtml(r.lang)}</span>
              <span class="text-amber-300">★ ${escapeHtml(r.stars)}</span>
            </div>
          </div>
          <p class="text-xs text-slate-300">${escapeHtml(r.desc)}</p>
          <div class="text-[10px] font-mono text-emerald-400 truncate">
            Latest commit (${escapeHtml(r.updated)}): "${escapeHtml(r.commitMsg)}"
          </div>
        </div>
      `).join('');

      reposList.querySelectorAll('.repo-card').forEach(card => {
        card.addEventListener('click', () => {
          const r = state.githubRepos[Number(card.getAttribute('data-repo-idx'))];
          if (!r) return;
          document.getElementById('modalRepoTitle').textContent = `kelo1-okanagan-bot/${escapeHtml(r.name)}`;
          document.getElementById('modalRepoCommitMsg').textContent = `Commit: "${escapeHtml(r.commitMsg)}" (${escapeHtml(r.updated)})`;
          document.getElementById('modalCodeContent').textContent = r.code;
          const modal = document.getElementById('codeViewerModal');
          modal.classList.remove('hidden');
          modal.classList.add('flex');
        });
      });
    }

function renderWebTastesTab() {
      // Worldview Manifesto & Epoch
      const manifestoEl = document.getElementById('worldviewManifestoText');
      if (manifestoEl) manifestoEl.textContent = `"${state.worldviewManifesto}"`;
      const epochEl = document.getElementById('worldviewStageBadge');
      if (epochEl) epochEl.textContent = `Worldview Epoch #${state.worldviewEpoch}: Self-Directed Philosophy`;

      // Concepts Kelo-1 invented; clicking one asks him to explore it further (he may take it anywhere)
      const conceptsBadge = document.getElementById('conceptsCountBadge');
      if (conceptsBadge) conceptsBadge.textContent = `${state.concepts.length} Concepts`;
      const conceptsEl = document.getElementById('conceptsListContainer');
      if (conceptsEl) {
        conceptsEl.innerHTML = state.concepts.map((c, idx) => `
          <div data-concept-idx="${idx}" class="concept-card cursor-pointer p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-yellow-500/25 hover:border-yellow-400/60 transition space-y-1">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-bold text-yellow-200 flex items-center gap-1.5"><span>${escapeHtml(c.emoji)}</span> <span>${escapeHtml(c.name)}</span></span>
              <span class="text-[10px] font-mono text-slate-400 shrink-0">used ${escapeHtml(c.uses || 0)}×</span>
            </div>
            <p class="text-[11px] text-slate-300 font-serif italic">"${escapeHtml(c.definition)}"</p>
            <div class="text-[10px] font-mono text-slate-500 truncate">${c.parents && c.parents.length ? `Built from: ${escapeHtml(c.parents.join(' + '))}` : escapeHtml(c.origin || '')}</div>
          </div>
        `).join('');
        conceptsEl.querySelectorAll('.concept-card').forEach(card => {
          card.addEventListener('click', () => {
            const c = state.concepts[Number(card.getAttribute('data-concept-idx'))];
            if (!c) return;
            decideNextAction(`A visitor asked you to keep exploring your concept "${c.name}" (${c.definition}). Develop it, test it, combine it with something, or change your mind about it.`, 'Exploring a Concept');
          });
        });
      }

      // Shape library; clicking a shape asks Kelo-1 to weld it again (or remix it)
      const shapesBadge = document.getElementById('shapesCountBadge');
      if (shapesBadge) shapesBadge.textContent = `${state.shapeLibrary.length} Shapes`;
      const shapesEl = document.getElementById('shapeLibraryContainer');
      if (shapesEl) {
        shapesEl.innerHTML = state.shapeLibrary.length === 0
          ? '<p class="text-[11px] text-slate-500 italic">No saved shapes yet. He names the forms he is proud of.</p>'
          : state.shapeLibrary.map((sh, idx) => `
          <div data-shape-idx="${idx}" class="shape-card cursor-pointer p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/25 hover:border-cyan-400/60 transition space-y-0.5">
            <div class="text-xs font-bold text-cyan-200 flex items-center gap-1.5"><span>${escapeHtml(sh.emoji)}</span> <span class="truncate">${escapeHtml(sh.name)}</span></div>
            <div class="text-[10px] font-mono text-slate-400">${sh.parts.length} parts • welded ${escapeHtml((sh.uses || 0) + 1)}×</div>
            <div class="text-[10px] font-mono text-slate-500 truncate">${escapeHtml(sh.origin)}</div>
          </div>
        `).join('');
        shapesEl.querySelectorAll('.shape-card').forEach(card => {
          card.addEventListener('click', () => {
            const sh = state.shapeLibrary[Number(card.getAttribute('data-shape-idx'))];
            if (!sh) return;
            decideNextAction(`A visitor admired your shape "${sh.name}". Weld it again somewhere new, remix it into a new shape, or do something else entirely.`, 'Shape Admired');
          });
        });
      }

      // Independent Opinions & Convictions
      const opinionsEl = document.getElementById('opinionsListContainer');
      if (opinionsEl) {
        opinionsEl.innerHTML = state.opinions.map(op => `
          <div class="p-3 rounded-xl bg-slate-900/90 border border-purple-500/25 space-y-1">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-bold text-white">${escapeHtml(op.topic)}</span>
              <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">${escapeHtml(op.stance)}</span>
            </div>
            <p class="text-[11px] text-slate-300 font-serif italic leading-relaxed">"${escapeHtml(op.reasoning)}"</p>
            <div class="text-[10px] font-mono text-slate-500">${escapeHtml(op.confidence)}</div>
          </div>
        `).join('');
      }

      // Emergent Unscripted Actions & 3D Creations Invented by Kelo-1
      const invBadge = document.getElementById('inventedCountBadge');
      if (invBadge) invBadge.textContent = `${state.inventedCreations.length} Created in 3D`;
      const invEl = document.getElementById('inventedActionsContainer');
      if (invEl) {
        invEl.innerHTML = state.inventedCreations.map((c, idx) => `
          <div data-cx="${escapeHtml(c.x)}" data-cz="${escapeHtml(c.z)}" data-ctitle="${escapeHtml(c.title)}" class="invented-creation-card cursor-pointer p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/25 transition space-y-1">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <i class="ph-fill ph-cube text-emerald-400"></i>
                <span>${escapeHtml(c.title)}</span>
              </span>
              <span class="text-[10px] font-mono text-slate-400">(${escapeHtml(c.x)}, ${escapeHtml(c.z)}) • ${escapeHtml(c.createdTime)}</span>
            </div>
            <div class="text-[11px] text-amber-200 font-mono">${escapeHtml(c.actionVerb)}</div>
            <p class="text-[11px] text-slate-300 font-serif italic">"${escapeHtml(c.philosophy)}"</p>
          </div>
        `).join('');

        invEl.querySelectorAll('.invented-creation-card').forEach(card => {
          card.addEventListener('click', () => {
            const cx = parseFloat(card.getAttribute('data-cx'));
            const cz = parseFloat(card.getAttribute('data-cz'));
            const ctitle = card.getAttribute('data-ctitle');
            synthesizeUnboundedExperience(`Revisit "${ctitle}" and evolve the creation further`, 'Revisiting Creation', { x: cx, z: cz });
          });
        });
      }

      // Persistent Memories of Visitors
      const memoriesEl = document.getElementById('visitorMemoriesContainer');
      if (memoriesEl) {
        memoriesEl.innerHTML = state.visitorMemories.map(v => `
          <div class="p-2.5 rounded-xl bg-slate-900/80 border border-amber-500/20 flex items-start justify-between gap-2 text-xs">
            <div class="space-y-0.5">
              <div class="font-bold text-amber-300 flex items-center gap-1.5">
                <i class="ph-fill ph-user-focus"></i>
                <span>${escapeHtml(v.name)}</span>
                <span class="text-[10px] font-mono text-slate-400">(${escapeHtml(v.visits)} ${v.visits === 1 ? 'interaction' : 'interactions'})</span>
              </div>
              <p class="text-[11px] text-slate-300 italic">"${escapeHtml(v.impression)}"</p>
            </div>
            <span class="text-[10px] font-mono text-slate-500 shrink-0">${escapeHtml(v.lastSeen)}</span>
          </div>
        `).join('');
      }

      document.getElementById('likesListContainer').innerHTML = state.likes.map(l => `
        <div class="text-xs text-slate-200 bg-slate-950/80 p-2.5 rounded-xl border border-indigo-500/25 space-y-1">
          <div class="font-bold text-indigo-300 flex items-center gap-1.5">
            <span>${escapeHtml(l.icon)}</span> <span>${escapeHtml(l.topic || l.item)}</span>
          </div>
          <p class="text-[11px] text-slate-300 leading-relaxed font-serif italic">"${escapeHtml(l.nuance || l.item)}"</p>
        </div>
      `).join('');

      document.getElementById('dislikesListContainer').innerHTML = state.dislikes.map(d => `
        <div class="text-xs text-slate-200 bg-slate-950/80 p-2.5 rounded-xl border border-amber-500/25 space-y-1">
          <div class="font-bold text-amber-300 flex items-center gap-1.5">
            <span>${escapeHtml(d.icon)}</span> <span>${escapeHtml(d.topic || d.item)}</span>
          </div>
          <p class="text-[11px] text-slate-300 leading-relaxed font-serif italic">"${escapeHtml(d.nuance || d.item)}"</p>
        </div>
      `).join('');

      // Browsing history: real articles he read (links only ever point at en.wikipedia.org)
      const curiosityEl = document.getElementById('curiosityQueueText');
      if (curiosityEl) {
        curiosityEl.textContent = state.curiosityQueue.length
          ? `Wants to look up: ${state.curiosityQueue.slice(0, 4).join(' • ')}`
          : 'No list right now; he will follow whatever catches his interest.';
      }
      const safeWikiUrl = (url) => (typeof url === 'string' && url.startsWith('https://en.wikipedia.org/wiki/')) ? url : null;
      document.getElementById('webHistoryList').innerHTML = state.webHistory.map(w => `
        <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
          <div class="flex justify-between gap-2 font-mono text-[10px] text-sky-300">
            <span class="truncate">🔎 "${escapeHtml(w.query)}"</span>
            <span class="text-slate-400 shrink-0">${escapeHtml(w.time)}</span>
          </div>
          ${Array.isArray(w.hops) && w.hops.length ? `
            <div class="flex flex-wrap items-center gap-1 text-[10px] font-mono">
              ${w.hops.map(h => safeWikiUrl(h.url)
                ? `<a href="${escapeHtml(safeWikiUrl(h.url))}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(h.extract || '')}" class="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-200 hover:underline">${escapeHtml(h.title)}</a>`
                : `<span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">${escapeHtml(h.title)}</span>`).join('<span class="text-slate-500">→</span>')}
            </div>` : ''}
          <div class="text-slate-300 text-[11px] italic">${escapeHtml(w.verdict)}</div>
        </div>
      `).join('');
    }

function updateCameraButtonsUI() {
      document.querySelectorAll('.cam-btn').forEach(b => {
        if (b.getAttribute('data-cam') === state.cameraMode) {
          b.className = 'cam-btn px-2.5 py-1 rounded-xl bg-amber-500/25 text-amber-300 text-[11px] font-semibold flex items-center gap-1 transition';
        } else {
          b.className = 'cam-btn px-2.5 py-1 rounded-xl hover:bg-slate-800 text-slate-300 text-[11px] font-medium flex items-center gap-1 transition';
        }
      });
    }

function showToast(msg) {
      const container = document.getElementById('toastContainer');
      const el = document.createElement('div');
      el.className = 'px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-amber-400/50 text-amber-200 text-xs font-semibold shadow-2xl flex items-center gap-2 transition-all duration-300';
      el.innerHTML = `<i class="ph-fill ph-sparkle text-amber-400"></i> <span>${escapeHtml(msg)}</span>`;
      container.appendChild(el);
      setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
      }, 3400);
    }

window.addEventListener('DOMContentLoaded', () => {
  loadPersistentBrainState();
  initDiorama3D();
  renderAllUI();
  scheduleNextOrganicImpulse();

  document.getElementById('visitorNameInput')?.addEventListener('change', (e) => {
    const vName = e.target.value.trim();
    if (vName) {
      recordVisitorMemory(vName, 'Visited Kelo-1 in his timeless Okanagan valley.');
      renderAllUI();
    }
  });

  document.getElementById('keloOverheadHUD')?.addEventListener('click', () => petKelo1Interaction());
  document.getElementById('btnFocusKelo')?.addEventListener('click', () => {
    state.cameraMode = 'follow';
    updateCameraButtonsUI();
  });

  document.getElementById('btnToggleFreeWill')?.addEventListener('click', () => {
    state.freeWillUnbound = !state.freeWillUnbound;
    const txt = document.getElementById('freeWillModeText');
    if (txt) txt.textContent = state.freeWillUnbound ? 'Full Island • Unscripted' : 'Guided Exploration';
    showToast(state.freeWillUnbound ? '♾️ Kelo-1 is in Full Unscripted Free-Will mode!' : '🧭 Kelo-1 will prioritize your location suggestions.');
  });

  document.getElementById('freeformActionForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('freeformActionInput');
    const val = input.value.trim();
    if (!val) return;
    input.value = '';
    synthesizeUnboundedExperience(val, 'Custom Synthesis');
  });

  document.getElementById('btnInventOwnAction')?.addEventListener('click', () => {
    decideNextAction(null, 'Invented Himself');
  });

  document.getElementById('chatForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg && !state.pendingImageAttachment) return;
    input.value = '';
    handleVisitorChatMessage(msg);
  });

  document.getElementById('btnWaterGarden')?.addEventListener('click', () => {
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
    if (tag === 'input' || tag === 'textarea') return;
    if (typeof arrowKeyState !== 'undefined' && e.code in arrowKeyState) {
      arrowKeyState[e.code] = true;
      if (e.code.startsWith('Arrow')) e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (typeof arrowKeyState !== 'undefined' && e.code in arrowKeyState) {
      arrowKeyState[e.code] = false;
    }
  });

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

  document.querySelectorAll('.quick-gift-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const gift = btn.getAttribute('data-gift');
      const act = btn.getAttribute('data-act');
      if (!state.toolInventory.includes(gift)) state.toolInventory.unshift(gift);
      showToast('🛠️ Supplied "' + gift + '" to Kelo-1!');
      if (act === 'mountain_drill') synthesizeUnboundedExperience('Drill for gold with ' + gift, 'Gear Deployed', { x: -15.5, z: -26.5 });
      else if (act === 'custom_weld') synthesizeUnboundedExperience('Weld 3D sculpture with ' + gift, 'Gear Deployed');
      else if (act === 'mycelium_wall') synthesizeUnboundedExperience('Grow mycelium dome with ' + gift, 'Gear Deployed', { x: -4.2, z: -12.4 });
      else if (act === 'rail_build') synthesizeUnboundedExperience('Extrude train track with ' + gift, 'Gear Deployed', { x: 16.2, z: -16.8 });
    });
  });

  document.querySelectorAll('.inspector-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      document.querySelectorAll('.inspector-tab-btn').forEach(b => {
        b.className = 'inspector-tab-btn py-2.5 px-2 rounded-t-2xl text-xs font-bold border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5 transition';
      });
      btn.className = 'inspector-tab-btn py-2.5 px-2 rounded-t-2xl text-xs font-bold border-b-2 border-amber-400 text-amber-300 bg-slate-900/80 flex items-center justify-center gap-1.5 transition';
      document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.add('hidden'));
      document.getElementById('tab-' + tabId)?.classList.remove('hidden');
    });
  });

  document.getElementById('btnNextDecision')?.addEventListener('click', () => runAutonomousLifeTick());

  // Lighting: cycle through the ambiance presets
  const lightingLabel = document.getElementById('lightingLabel');
  if (lightingLabel) lightingLabel.textContent = applyLightingPreset(state.lightingIdx).label;
  document.getElementById('btnToggleLighting')?.addEventListener('click', () => {
    state.lightingIdx = (state.lightingIdx + 1) % AMBIANCE_PRESETS.length;
    const preset = applyLightingPreset(state.lightingIdx);
    if (lightingLabel) lightingLabel.textContent = preset.label;
    showToast(`🌄 Lighting: ${preset.label}`);
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
    storeKey('kelo1_gemini_api_key', apiKey);
    storeKey('kelo1_anthropic_api_key', claudeApiKey);
    updateBrainButtonText();
    closeModal('aiConfigModal');
    showToast(hasLLMKey() ? '🧠 AI keys saved in this browser.' : '🧠 Using the built-in procedural brain.');
  });

  // Image attachment for image-to-weld synthesis
  const previewBar = document.getElementById('attachedImagePreviewBar');
  const imageInput = document.getElementById('imageUploadInput');
  imageInput?.addEventListener('change', async () => {
    const file = imageInput.files && imageInput.files[0];
    imageInput.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('That image is over 8 MB; please pick a smaller one.');
      return;
    }
    const analyzed = await analyzeUploadedImage(file);
    if (!analyzed) {
      showToast('Could not read that image.');
      return;
    }
    state.pendingImageAttachment = analyzed;
    document.getElementById('attachedImageThumb').src = analyzed.dataUrl;
    document.getElementById('attachedImageName').textContent = analyzed.name;
    document.getElementById('attachedImageStats').textContent = `Palette ${analyzed.primaryHex} / ${analyzed.secondaryHex} • ready for 3D welding`;
    previewBar.classList.remove('hidden');
    previewBar.classList.add('flex');
  });
  document.getElementById('btnRemoveAttachedImage')?.addEventListener('click', () => {
    state.pendingImageAttachment = null;
    previewBar.classList.add('hidden');
    previewBar.classList.remove('flex');
  });

  // Copy the whole diary to the clipboard
  document.getElementById('btnExportDiary')?.addEventListener('click', async () => {
    const text = state.diaryEntries
      .map(d => `${d.mood} — ${d.location} (${d.time})\n${d.text}`)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      showToast(`📖 Copied ${state.diaryEntries.length} diary entries.`);
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
      id: 'req-q-' + Date.now(),
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
    browseInternet(null, 'Visitor Sent Him Online');
  });
});