// Kelo-bot-1 — js/memory.js
// Loaded after agent.js. Keeps Kelo-1's diary and memories as he develops:
// - Older diary entries and opinions move into a long-term archive instead of being deleted.
// - Every few experiences he distills a "core memory" (with the AI brain if available),
//   and his core memories feed back into how he decides things.
// - Life stats track how long he has existed and what he has done.
// - His whole brain can be exported to a file and imported again (API keys are never included).

const ARCHIVE_KEY = 'kelo1_memory_archive_v2';
// The desktop app has a 10 GB budget on disk, so it keeps (practically) everything
const MAX_ARCHIVED_DIARY = keloStore.isDesktop ? 250000 : 1500;
const MAX_ARCHIVED_OPINIONS = keloStore.isDesktop ? 50000 : 300;
const MAX_CORE_MEMORIES = 40;
const ENTRIES_PER_CORE_MEMORY = 8;

let memoryArchive = { diary: [], opinions: [] };
let distilling = false;

function loadMemoryArchive() {
      try {
        const saved = JSON.parse(keloStore.getItem(ARCHIVE_KEY) || 'null');
        if (saved && typeof saved === 'object') {
          memoryArchive.diary = Array.isArray(saved.diary) ? saved.diary : [];
          memoryArchive.opinions = Array.isArray(saved.opinions) ? saved.opinions : [];
        }
      } catch (e) {}
    }

function saveMemoryArchive() {
      if (memoryArchive.diary.length > MAX_ARCHIVED_DIARY) memoryArchive.diary.length = MAX_ARCHIVED_DIARY;
      if (memoryArchive.opinions.length > MAX_ARCHIVED_OPINIONS) memoryArchive.opinions.length = MAX_ARCHIVED_OPINIONS;
      // If storage is full, let go of the very oldest archived entries until it fits
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          keloStore.setItem(ARCHIVE_KEY, JSON.stringify(memoryArchive));
          return;
        } catch (e) {
          memoryArchive.diary.length = Math.floor(memoryArchive.diary.length * 0.8);
        }
      }
    }

// Give every diary entry a real timestamp the first time we see it
function stampDiaryEntries() {
      const now = Date.now();
      state.diaryEntries.forEach(d => { if (!d.at) d.at = now; });
    }

// Called from trimBrainState(): move overflow into the archive instead of discarding it
function archiveOverflow(diaryOverflow, opinionOverflow) {
      if (diaryOverflow.length === 0 && opinionOverflow.length === 0) return;
      memoryArchive.diary.unshift(...diaryOverflow);
      memoryArchive.opinions.unshift(...opinionOverflow);
      saveMemoryArchive();
    }

function totalDiaryCount() {
      return state.diaryEntries.length + memoryArchive.diary.length;
    }

// --- Life stats ----------------------------------------------------------------
function bumpLifeStat(key, by = 1) {
      state.life[key] = (state.life[key] || 0) + by;
    }

function daysAlive() {
      return Math.max(1, Math.floor((Date.now() - (state.life.bornAt || Date.now())) / 86400000) + 1);
    }

// --- Core memories ---------------------------------------------------------------
const SIGNIFICANT = [
  [/gave me|gift|delivered|picked up/i, 3],
  [/said no|declined/i, 3],
  [/concept|invented|idea/i, 2],
  [/read about|netnode|online/i, 2],
  [/weld|built|placed|sculpture/i, 2],
  [/note|letter|asked|question/i, 2],
  [/first|never|realized|changed/i, 2]
];

function proceduralCoreMemory(entries) {
      const score = (e) => SIGNIFICANT.reduce((sum, [re, w]) => sum + (re.test(e.text) ? w : 0), 0) + Math.random();
      const best = entries.reduce((a, b) => (score(b) > score(a) ? b : a));
      const firstSentence = String(best.text || '').replace(/^Dear Diary,\s*/i, '').match(/^[^.!?]+[.!?]?/);
      const gist = (firstSentence ? firstSentence[0] : best.text || '').trim().slice(0, 180);
      return {
        text: `I remember: ${gist}${/[.!?]$/.test(gist) ? '' : '.'} ${pick(['It still shapes how I see the island.', 'I think that was when something changed in me.', 'I keep coming back to that.', 'It taught me something about wanting things.'])}`,
        emoji: (String(best.mood || '').match(/\p{Extended_Pictographic}/u) || ['🧠'])[0]
      };
    }

async function distillCoreMemory(entries) {
      if (hasLLMKey()) {
        const prompt = `You are Kelo-1, an autonomous robot on an island near Kelowna, BC. Here are some of your recent diary entries (oldest last):

${entries.map((e, i) => `${i + 1}. ${String(e.text).slice(0, 400)}`).join('\n')}

Your existing core memories: ${state.coreMemories.slice(0, 6).map(m => m.text).join(' | ') || 'none yet'}

Distill ONE new core memory: what from these days actually mattered to you and how it changed you. Return ONLY JSON:
{"text": "1-2 sentences in first person", "emoji": "one emoji"}`;
        const parsed = await callLLMJSON([{ text: prompt }]);
        if (parsed && typeof parsed.text === 'string' && parsed.text.trim()) {
          return { text: parsed.text.trim().slice(0, 300), emoji: typeof parsed.emoji === 'string' ? parsed.emoji.slice(0, 8) : '🧠' };
        }
      }
      return proceduralCoreMemory(entries);
    }

// Every ENTRIES_PER_CORE_MEMORY new diary entries, he reflects and keeps one core memory
async function maybeDistillCoreMemory() {
      if (distilling) return;
      const total = totalDiaryCount();
      if (total - (state.life.lastDistilledAt || 0) < ENTRIES_PER_CORE_MEMORY) return;
      distilling = true;
      try {
        const recent = state.diaryEntries.slice(0, ENTRIES_PER_CORE_MEMORY).filter(e => e && e.text);
        if (recent.length === 0) return;
        const memory = await distillCoreMemory(recent);
        state.coreMemories.unshift({ ...memory, at: Date.now(), day: daysAlive() });
        if (state.coreMemories.length > MAX_CORE_MEMORIES) state.coreMemories.length = MAX_CORE_MEMORIES;
        state.life.lastDistilledAt = total;
        savePersistentBrainState();
        renderAllUI();
        showToast(`${memory.emoji} Kelo-1 formed a core memory`);
      } finally {
        distilling = false;
      }
    }

// --- Backup: export / import his whole brain -----------------------------------------
function isSecretKey(name) {
      return /api_key|token|secret/i.test(name);
    }

function exportBrain() {
      savePersistentBrainState();
      saveMemoryArchive();
      const data = {};
      try {
        keloStore.keys().forEach(k => {
          if (k && k.startsWith('kelo1_') && !isSecretKey(k)) data[k] = keloStore.getItem(k);
        });
      } catch (e) {}
      const file = { format: 'kelo1-brain', version: 1, exportedAt: new Date().toISOString(), data };
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kelo1-brain-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('💾 Saved a backup of Kelo-1\'s brain (no API keys included)');
    }

async function importBrain(file) {
      try {
        if (!file || file.size > 15 * 1024 * 1024) throw new Error('File is missing or too large');
        const parsed = JSON.parse(await file.text());
        if (!parsed || parsed.format !== 'kelo1-brain' || typeof parsed.data !== 'object') throw new Error('Not a Kelo-1 brain backup');
        const entries = Object.entries(parsed.data).filter(([k, v]) => k.startsWith('kelo1_') && !isSecretKey(k) && typeof v === 'string');
        if (entries.length === 0) throw new Error('The backup is empty');
        if (!window.confirm(`Replace Kelo-1's current memories with this backup from ${parsed.exportedAt || 'an unknown date'}? Your API keys stay as they are.`)) return;
        entries.forEach(([k, v]) => keloStore.setItem(k, v));
        showToast('🧠 Backup restored. Reloading...');
        setTimeout(() => window.location.reload(), 600);
      } catch (err) {
        showToast(`Could not import: ${err.message}`);
      }
    }

// --- UI ----------------------------------------------------------------------------------
function renderMemoryUI() {
      const stats = document.getElementById('lifeStatsText');
      if (stats) {
        stats.textContent = `Day ${daysAlive()} of his life • ${state.life.decisions || 0} decisions • ${state.life.builds || 0} builds • ${state.life.gifts || 0} gifts opened • ${state.life.articles || 0} articles read • ${totalDiaryCount()} diary entries`;
      }
      const core = document.getElementById('coreMemoriesContainer');
      if (core) {
        core.innerHTML = state.coreMemories.length === 0
          ? `<p class="text-[11px] text-slate-500 italic">No core memories yet. He forms one after every ${ENTRIES_PER_CORE_MEMORY} diary entries.</p>`
          : state.coreMemories.map(m => `
          <div class="p-2.5 rounded-xl bg-slate-900/90 border border-pink-500/25 text-xs space-y-0.5">
            <div class="flex items-center justify-between gap-2 text-[10px] font-mono text-pink-300">
              <span>${escapeHtml(m.emoji)} Day ${escapeHtml(m.day || '?')}</span>
              <span class="text-slate-500">${escapeHtml(new Date(m.at).toLocaleDateString())}</span>
            </div>
            <p class="text-[11px] text-slate-200 font-serif italic">"${escapeHtml(m.text)}"</p>
          </div>`).join('');
      }
      const archiveCount = document.getElementById('diaryArchiveCount');
      if (archiveCount) archiveCount.textContent = `${memoryArchive.diary.length} older entries archived`;
      const usageEl = document.getElementById('memoryUsageText');
      const usage = keloStore.usage();
      if (usageEl) {
        usageEl.textContent = usage
          ? `Memory on this computer: ${(usage.used / 1048576).toFixed(1)} MB of ${(usage.quota / 1073741824).toFixed(0)} GB`
          : 'Memory is kept in this browser (about 5 MB). The Windows app can keep up to 10 GB.';
      }
    }

function renderArchiveSearch(query) {
      const results = document.getElementById('diaryArchiveResults');
      if (!results) return;
      const q = String(query || '').trim().toLowerCase();
      const all = [...state.diaryEntries, ...memoryArchive.diary];
      const matches = (q ? all.filter(d => `${d.text} ${d.mood} ${d.location}`.toLowerCase().includes(q)) : memoryArchive.diary).slice(0, 30);
      results.innerHTML = matches.length === 0
        ? `<p class="text-[11px] text-slate-500 italic">${q ? 'No entries match.' : 'Nothing archived yet. Older entries move here as his diary grows.'}</p>`
        : matches.map(d => `
          <article class="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-0.5">
            <div class="flex items-center justify-between gap-2 text-[10px] font-mono">
              <span class="text-amber-300 truncate">${escapeHtml(d.mood)}</span>
              <span class="text-slate-500 shrink-0">${d.at ? escapeHtml(new Date(d.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })) : escapeHtml(d.time)}</span>
            </div>
            <p class="text-[11px] text-slate-300 font-serif italic">"${escapeHtml(d.text)}"</p>
          </article>`).join('');
    }

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnExportBrain')?.addEventListener('click', exportBrain);
  const importInput = document.getElementById('importBrainInput');
  importInput?.addEventListener('change', () => {
    const file = importInput.files && importInput.files[0];
    importInput.value = '';
    importBrain(file);
  });
  const search = document.getElementById('diaryArchiveSearch');
  search?.addEventListener('input', () => renderArchiveSearch(search.value));
  // Render after main.js has loaded his saved state
  setTimeout(() => {
    renderArchiveSearch('');
    renderMemoryUI();
  }, 0);
});
