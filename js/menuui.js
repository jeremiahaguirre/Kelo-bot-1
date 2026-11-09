// Kelo-bot-1 — js/menuui.js
// Loaded LAST. The menu's Diary and Brain tabs: diary search/filter/paging controls, and the Brain
// dashboard (summary at the top, counts in section headings, search across every section, sections
// that remember being open or closed). Only draws what is on screen: nothing runs with the menu closed.

const BRAIN_SECTION_ORDER = ['projects', 'buildprojects', 'skills', 'built', 'workshop', 'plants', 'vehicles', 'hobbies', 'upgrades',
  'landscape', 'digging', 'memories', 'opinions', 'concepts', 'shapes', 'likes', 'dislikes', 'visitors', 'web'];
// How many things each section holds, straight from his state (sections not listed are counted from the page)
const BRAIN_SECTION_COUNTS = {
  projects: () => (state.projects || []).length,
  skills: () => Object.keys(state.skills || {}).length,
  vehicles: () => (state.vehicles || []).length,
  memories: () => (state.coreMemories || []).length,
  opinions: () => (state.opinions || []).length,
  visitors: () => (state.visitorMemories || []).length,
  likes: () => (state.likes || []).length,
  dislikes: () => (state.dislikes || []).length,
  web: () => (state.webHistory || []).length,
  built: () => (state.inventedCreations || []).length,
  concepts: () => (state.concepts || []).length,
  shapes: () => (state.shapeLibrary || []).length,
  hobbies: () => (state.hobbies || []).length
};
const brainDash = { key: '', dirty: true, queued: false };

function menuUiReducedMotion() {
      return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

function brainDashSearchText() {
      const input = document.getElementById('brainSearch');
      return input ? input.value.trim().toLowerCase() : '';
    }

// The lists inside a section, and the "cards" in them (the rows a search can hide)
function brainSectionCards(sec) {
      const body = sec.querySelector('.brain-body');
      if (!body) return [];
      const out = [];
      body.querySelectorAll('[id]').forEach(list => {
        if (list.closest('.brain-body') !== body || list.tagName === 'P' || list.tagName === 'SPAN' || list.tagName === 'BUTTON') return;
        [...list.children].forEach(c => { if (!c.matches('[data-perf-more], .brain-empty, p.italic, div.italic') && !c.querySelector('[id]')) out.push(c); });
      });
      return out;
    }

function brainSectionCount(sec) {
      const f = BRAIN_SECTION_COUNTS[sec.dataset.section];
      if (f) { try { return f(); } catch (e) { /* fall through to the page */ } }
      return null;
    }

function brainSectionEmpty(sec) {
      const n = brainSectionCount(sec);
      if (n !== null) return n === 0;
      const body = sec.querySelector('.brain-body');
      if (!body) return true;
      const text = [...body.querySelectorAll('[id]')].map(el => (el.querySelector('.italic') && el.children.length <= 1 ? '' : el.textContent)).join('').trim();
      return !text;
    }

// Count badges in every heading that doesn't already have its own
function brainDashCounts() {
      document.querySelectorAll('#tab-brain .brain-section').forEach(sec => {
        const head = sec.querySelector('summary');
        if (!head) return;
        let badge = head.querySelector('.brain-count');
        const n = brainSectionCount(sec);
        if (!badge && n !== null) {
          badge = document.createElement('span');
          badge.className = 'brain-count';
          badge.dataset.auto = '1';
          head.appendChild(badge);
        }
        if (badge && badge.dataset.auto && badge.textContent !== String(n)) badge.textContent = String(n);
        sec.classList.toggle('brain-section-empty', brainSectionEmpty(sec));
      });
    }

// Most useful first: what he's working on, then what he has done; empty sections sink to the bottom.
// Only reordered when the tab is opened, so nothing jumps while you read.
function brainDashOrder() {
      const holder = document.getElementById('brainSections');
      if (!holder) return;
      const secs = [...holder.querySelectorAll(':scope > .brain-section')];
      const rank = s => { const i = BRAIN_SECTION_ORDER.indexOf(s.dataset.section); return (brainSectionEmpty(s) ? 100 : 0) + (i < 0 ? 50 : i); };
      const sorted = secs.slice().sort((a, b) => rank(a) - rank(b));
      if (sorted.every((s, i) => s === secs[i])) return;
      sorted.forEach(s => holder.appendChild(s));
    }

// Sections remember being open or closed (not while a search has opened them)
function brainDashRemember() {
      document.querySelectorAll('#tab-brain .brain-section').forEach(sec => {
        if (sec.dataset.remembered) return;
        sec.dataset.remembered = '1';
        const key = 'kelo1_brain_section_' + sec.dataset.section;
        try {
          const saved = localStorage.getItem(key);
          if (saved !== null) sec.open = saved === '1';
        } catch (e) {}
        sec.addEventListener('toggle', () => {
          if (brainDashSearchText()) return;
          try { localStorage.setItem(key, sec.open ? '1' : '0'); } catch (e) {}
        });
      });
    }

// Search: hides the cards (and whole sections) that don't match, and opens the ones that do
function brainDashFilter() {
      const q = brainDashSearchText();
      const words = q.split(/\s+/).filter(Boolean);
      const holder = document.getElementById('brainSections');
      if (!holder) return;
      holder.classList.toggle('brain-searching', Boolean(q));
      let sections = 0, cards = 0;
      document.querySelectorAll('#tab-brain .brain-section').forEach(sec => {
        const list = brainSectionCards(sec);
        if (!q) {
          list.forEach(c => c.classList.remove('brain-miss'));
          sec.classList.remove('hidden');
          if (sec.dataset.wasOpen !== undefined) { sec.open = sec.dataset.wasOpen === '1'; delete sec.dataset.wasOpen; }
          return;
        }
        const titleHit = words.every(w => (sec.querySelector('summary')?.textContent || '').toLowerCase().includes(w));
        let hits = 0;
        list.forEach(c => {
          const hit = titleHit || words.every(w => c.textContent.toLowerCase().includes(w));
          c.classList.toggle('brain-miss', !hit);
          if (hit) hits++;
        });
        const show = titleHit || hits > 0;
        sec.classList.toggle('hidden', !show);
        if (show) {
          if (sec.dataset.wasOpen === undefined) sec.dataset.wasOpen = sec.open ? '1' : '0';
          sec.open = true;
          sections++; cards += hits;
        }
      });
      const note = document.getElementById('brainSearchNote');
      if (note) {
        note.classList.toggle('hidden', !q);
        note.textContent = q ? (sections ? `${cards} ${cards === 1 ? 'match' : 'matches'} in ${sections} ${sections === 1 ? 'section' : 'sections'}` : 'No matches') : '';
      }
      document.getElementById('brainNoMatch')?.classList.toggle('hidden', !q || sections > 0);
    }

// The summary at the top: what he's doing, what he's aiming for, and his numbers
function brainDashSummaryHtml() {
      const day = typeof daysAlive === 'function' ? daysAlive() : 1;
      const skills = Object.values(state.skills || {}).sort((a, b) => b.level - a.level || b.xp - a.xp);
      const builtProjects = (state.projects || []).filter(p => p.status === 'built').length;
      const built = (state.inventedCreations || []).length + builtProjects;
      const life = state.life || {};
      const tile = (section, value, label, icon) => `<button type="button" class="brain-stat" data-brain-jump="${section}"><span class="brain-stat-icon" aria-hidden="true">${icon}</span><span class="brain-stat-num">${escapeHtml(value)}</span><span class="brain-stat-label">${escapeHtml(label)}</span></button>`;
      let project = '';
      const cur = typeof activeProject === 'function' ? activeProject() : null;
      const plan = cur && typeof planFor === 'function' ? planFor(cur.key) : null;
      if (plan) {
        let total = plan.materials.length + plan.tools.length, missing = [];
        try { const miss = missingFor(plan); missing = [...miss.materials.map(m => m.ask), ...miss.tools.map(t => BUILD_TOOLS[t].ask)]; } catch (e) {}
        const pct = total ? Math.round((total - missing.length) / total * 100) : 0;
        project = `<button type="button" class="brain-focus" data-brain-jump="projects">
            <span class="brain-card-icon" aria-hidden="true">${escapeHtml(plan.emoji)}</span>
            <span class="min-w-0 flex-1 text-left space-y-1">
              <span class="flex items-baseline justify-between gap-2"><span class="brain-card-title truncate">Building a ${escapeHtml(plan.name.toLowerCase())}</span><span class="brain-card-meta shrink-0">${pct}%</span></span>
              <span class="brain-bar brain-bar-orange block" aria-hidden="true"><span style="width:${pct}%"></span></span>
              <span class="brain-card-meta block truncate">${missing.length ? `Waiting for ${escapeHtml(missing.slice(0, 3).join(', '))}${missing.length > 3 ? ` +${missing.length - 3}` : ''}` : 'Has everything he needs'}</span>
            </span>
          </button>`;
      }
      const best = skills[0];
      return `<div class="brain-hero">
          <div class="brain-hero-mood" aria-hidden="true">${escapeHtml(state.moodEmoji || '🤖')}</div>
          <div class="min-w-0 flex-1">
            <div class="journal-kicker">Day ${escapeHtml(day)} of his life</div>
            <div class="brain-hero-title truncate">${escapeHtml(stripCoords(state.moodTitle || 'Thinking'))}</div>
            ${state.currentObsession ? `<div class="brain-hero-goal"><span class="text-amber-300 font-semibold">Goal</span> ${escapeHtml(stripCoords(state.currentObsession))}</div>` : ''}
          </div>
        </div>
        ${project}
        <div class="brain-stats">
          ${tile('built', built, built === 1 ? 'thing built' : 'things built', '🏗️')}
          ${tile('skills', best ? `Lv ${best.level}` : '0', best ? `best: ${best.label}` : 'skills', '🎓')}
          ${tile('memories', (state.coreMemories || []).length, 'core memories', '💭')}
          ${tile('web', life.articles || (state.webHistory || []).length, 'articles read', '📚')}
        </div>`;
    }

function renderBrainDashboard(force) {
      if (!menuTabVisible('brain')) { brainDash.dirty = true; return; }
      const el = document.getElementById('brainSummary');
      if (!el) return;
      const skills = state.skills || {};
      const key = [state.moodEmoji, state.moodTitle, state.currentObsession, (state.inventedCreations || []).length, (state.projects || []).map(p => p.key + p.status).join(),
        Object.values(skills).map(s => s.level).join(), (state.coreMemories || []).length, (state.life || {}).articles, (state.webHistory || []).length,
        (state.belongings || []).length, (state.toolInventory || []).length, typeof daysAlive === 'function' ? daysAlive() : 0].join('|');
      if (force || brainDash.dirty || key !== brainDash.key) {
        brainDash.key = key;
        perfSetHtml(el, brainDashSummaryHtml());
      }
      if (force || brainDash.dirty) { brainDashRemember(); brainDashCounts(); brainDashOrder(); brainDashFilter(); }
      brainDash.dirty = false;
    }

// A section changed (one of the many renderers rewrote its list): recount and re-apply the search, once per frame
function brainDashQueue() {
      if (brainDash.queued) return;
      if (!menuTabVisible('brain')) { brainDash.dirty = true; return; }
      brainDash.queued = true;
      requestAnimationFrame(() => {
        brainDash.queued = false;
        brainDashRemember();
        brainDashCounts();
        brainDashFilter();
      });
    }

function brainDashJump(section) {
      const sec = document.querySelector(`#tab-brain .brain-section[data-section="${section}"]`);
      if (!sec) return;
      sec.open = true;
      sec.scrollIntoView({ behavior: menuUiReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      sec.querySelector('summary')?.focus({ preventScroll: true });
    }

window.addEventListener('DOMContentLoaded', () => {
  // --- Diary: search box (memory.js), date range, paging -------------------------------------------
  const range = document.getElementById('diaryDateFilter');
  const dayPick = document.getElementById('diaryDayPick');
  const dayWrap = document.getElementById('diaryDayPickWrap');
  const refreshDiary = () => { journalView.shown = JOURNAL_PAGE; journalView.dirty = true; renderDiaryTab(); };
  range?.addEventListener('change', () => {
    journalView.range = range.value;
    dayWrap?.classList.toggle('hidden', range.value !== 'day');
    if (range.value === 'day' && dayPick && !dayPick.value) dayPick.value = new Date().toLocaleDateString('en-CA');
    journalView.day = dayPick ? dayPick.value : '';
    refreshDiary();
  });
  dayPick?.addEventListener('change', () => { journalView.day = dayPick.value; refreshDiary(); });
  const loadMore = () => { journalView.shown += JOURNAL_PAGE; journalView.dirty = true; renderDiaryTab(); };
  document.getElementById('tab-diary')?.addEventListener('click', e => {
    if (e.target.closest('[data-journal-more]')) loadMore();
    if (e.target.closest('[data-journal-clear]')) {
      const search = document.getElementById('diaryArchiveSearch');
      if (search) search.value = '';
      if (range) range.value = 'all';
      dayWrap?.classList.add('hidden');
      journalView.query = ''; journalView.range = 'all';
      refreshDiary();
      search?.focus();
    }
  });
  // Older pages load by themselves as you scroll near the end
  const more = document.getElementById('diaryArchiveResults');
  if (more && 'IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      if (entries.some(en => en.isIntersecting) && more.querySelector('[data-journal-more]') && menuTabVisible('diary')) loadMore();
    }, { root: document.getElementById('menuScroll'), rootMargin: '0px 0px 300px 0px' }).observe(more);
  }
  // The "Restore from backup" label works from the keyboard too
  const restore = document.getElementById('importBrainInput')?.closest('label');
  restore?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('importBrainInput').click(); } });

  // --- Brain ---------------------------------------------------------------------------------------
  let brainSearchTimer = 0;
  document.getElementById('brainSearch')?.addEventListener('input', () => { clearTimeout(brainSearchTimer); brainSearchTimer = setTimeout(brainDashFilter, 120); });
  document.getElementById('brainExpandAll')?.addEventListener('click', () => document.querySelectorAll('#tab-brain .brain-section:not(.hidden)').forEach(s => { s.open = true; }));
  document.getElementById('brainCollapseAll')?.addEventListener('click', () => document.querySelectorAll('#tab-brain .brain-section').forEach(s => { s.open = false; }));
  document.getElementById('brainSummary')?.addEventListener('click', e => {
    const b = e.target.closest('[data-brain-jump]');
    if (b) brainDashJump(b.getAttribute('data-brain-jump'));
  });
  const sections = document.getElementById('brainSections');
  if (sections) new MutationObserver(brainDashQueue).observe(sections, { childList: true, subtree: true, characterData: true });
  setTimeout(brainDashRemember, 0);

  // A tab coming into view draws itself fresh
  document.addEventListener('kelo-menu-shown', e => {
    const tab = e.detail && e.detail.tab;
    if (tab === 'diary') { journalView.dirty = true; renderDiaryTab(); }
    if (tab === 'brain') {
      ['renderSkillsList', 'renderProjectsList'].forEach(f => { if (typeof window[f] === 'function') window[f](); });
      renderBrainDashboard(true);
    }
  });
  // The summary follows his mood and goal while the Brain tab is open (cheap: compares a key first)
  setInterval(() => renderBrainDashboard(false), 2000);
});
