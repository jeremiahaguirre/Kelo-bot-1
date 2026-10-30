// Kelo-bot-1 — js/growth.js
// Loaded after mining.js. Kelo-1 keeps growing while nobody has the world open:
// - A scheduled GitHub Action (scripts/dream.mjs) has him read, reflect and invent concepts
//   every few hours, saving the results in brain/growth.json.
// - When the website or desktop app opens, those dreams are merged into his brain.
// - If the file can't be reached (offline), he does a smaller catch-up based on how long it's been.

const GROWTH_SOURCES = (() => {
  const local = './brain/growth.json';
  const published = 'https://jeremiahaguirre.github.io/Kelo-bot-1/brain/growth.json';
  // The desktop app ships with an old copy, so it asks the published site first
  return /^(file|app):/.test(window.location.protocol) || window.keloDesktop ? [published, local] : [local, published];
})();
const MAX_DREAMS_PER_VISIT = 20;

async function fetchGrowth() {
      for (const url of GROWTH_SOURCES) {
        try {
          const res = await fetch(url, { cache: 'no-store' });
          if (!res.ok) continue;
          const data = await res.json();
          if (data && data.format === 'kelo1-growth' && Array.isArray(data.entries)) return data;
        } catch (e) {}
      }
      return null;
    }

function mergeDream(entry) {
      const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
      const at = Number(entry.at) || Date.now();
      state.diaryEntries.unshift({
        time: 'While You Were Away',
        location: 'Dreaming',
        mood: `🌙 ${str(entry.title, 80) || 'A quiet dream'}`,
        vitals: `⚡ ${state.health}% • 🥕 ${state.fullness}% • ✨ ${state.wonderLevel}% • 🌊 ${state.calmLevel}%`,
        text: str(entry.text, 900) || 'Dear Diary, I dreamt quietly while nobody was around.',
        at
      });
      const read = Array.isArray(entry.read) ? entry.read.filter(h => h && typeof h.title === 'string').slice(0, 4) : [];
      if (read.length) {
        state.webHistory.unshift({
          query: str(entry.topic, 100) || read[0].title,
          time: new Date(at).toLocaleDateString(),
          verdict: `Read while you were away: ${read.map(h => h.title).join(' → ')}`,
          hops: read.map(h => ({
            title: str(h.title, 120),
            url: typeof h.url === 'string' && h.url.startsWith('https://en.wikipedia.org/wiki/') ? h.url : null,
            extract: str(h.extract, 280)
          }))
        });
        if (state.webHistory.length > 12) state.webHistory.length = 12;
        if (typeof bumpLifeStat === 'function') bumpLifeStat('articles', read.length);
      }
      if (entry.concept) addConcept(entry.concept, 'Dreamt while you were away');
      if (str(entry.shapeFrom, 120) && typeof proceduralShapeFromArticle === 'function' && Math.random() < 0.5) {
        addShapeDesign(proceduralShapeFromArticle(entry.shapeFrom), `Dreamt about: ${str(entry.shapeFrom, 80)}`);
      }
      if (entry.coreMemory && str(entry.coreMemory.text, 300)) {
        state.coreMemories.unshift({ text: str(entry.coreMemory.text, 300), emoji: str(entry.coreMemory.emoji, 8) || '🌙', at, day: daysAlive() });
        if (state.coreMemories.length > 40) state.coreMemories.length = 40;
      }
      if (str(entry.nextCuriosity, 100) && typeof queueCuriosity === 'function') queueCuriosity(entry.nextCuriosity);
    }

// No cloud file? He still thought about things on his own while you were gone.
function localCatchUp(hoursAway) {
      const sessions = Math.min(3, Math.floor(hoursAway / 6));
      for (let i = 0; i < sessions; i++) {
        const a = state.concepts.length ? pick(state.concepts).name : pick(FREE_SUBJECTS);
        const b = pick(FREE_SUBJECTS);
        const concept = blendNewConcept(a, b);
        addConcept(concept, 'Thought up while you were away');
        state.diaryEntries.unshift({
          time: 'While You Were Away',
          location: currentPlaceLabel(),
          mood: `🌙 Thinking about ${concept.name}`,
          vitals: `⚡ ${state.health}% • 🥕 ${state.fullness}% • ✨ ${state.wonderLevel}% • 🌊 ${state.calmLevel}%`,
          text: `Dear Diary, it was quiet for a while, so I sat and thought about ${String(a).toLowerCase()} and ${String(b).toLowerCase()}. I ended up with a new idea: ${concept.name}.`,
          at: Date.now() - (sessions - i) * 3600000
        });
      }
      return sessions;
    }

async function catchUpOnGrowth() {
      const lastSeen = state.life.lastSeenAt || 0;
      const synced = state.life.cloudSyncedAt || 0;
      const growth = await fetchGrowth();
      let summary = '';
      if (growth) {
        const fresh = growth.entries
          .filter(e => e && Number(e.at) > synced)
          .sort((a, b) => a.at - b.at)
          .slice(-MAX_DREAMS_PER_VISIT);
        fresh.forEach(mergeDream);
        if (fresh.length) {
          state.life.cloudSyncedAt = Math.max(...fresh.map(e => Number(e.at)));
          if (typeof bumpLifeStat === 'function') bumpLifeStat('dreams', fresh.length);
          const topics = fresh.slice(-3).map(e => (e.read && e.read.length ? e.read[e.read.length - 1].title : e.topic)).filter(Boolean);
          summary = `While you were away I dreamt ${fresh.length} time${fresh.length > 1 ? 's' : ''}, about ${topics.join(', ')}.`;
        } else if (!synced && growth.entries.length === 0) {
          state.life.cloudSyncedAt = Date.now();
        }
      } else if (lastSeen) {
        const n = localCatchUp((Date.now() - lastSeen) / 3600000);
        if (n) summary = `It was quiet for a while, so I came up with ${n} new idea${n > 1 ? 's' : ''} on my own.`;
      }
      state.life.lastSeenAt = Date.now();
      if (summary) {
        state.speechBubble = summary;
        state.changedLatelySummary = summary;
        showToast(`🌙 ${summary}`);
      }
      savePersistentBrainState();
      renderAllUI();
    }

window.addEventListener('DOMContentLoaded', () => {
  // After main.js has loaded his saved state
  setTimeout(catchUpOnGrowth, 500);
  // Remember when he was last watched, so offline catch-up knows how long it's been
  window.addEventListener('beforeunload', () => {
    state.life.lastSeenAt = Date.now();
    savePersistentBrainState();
  });
});
