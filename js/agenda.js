// Kelo-bot-1 — js/agenda.js
// Loaded right after loopguard.js. His agenda: ONE persistent list of the things he has started and
// means to finish, so he keeps his focus and never forgets an open task.
//   - Every long-running job (a build, a road, a painting he planned, a machine order, a delivery he is
//     waiting for...) has a task in state.agenda.tasks: what it is, why, its steps and the step he is on,
//     its status (open / active / waiting / paused / done / abandoned), what it waits on and which
//     resume function carries it on (AGENDA_KINDS[kind].resume, registered by the file that owns the job).
//   - Focus: once he has committed to a task, his free moments go to its current step before anything
//     else (js/agent.js runAutonomousLifeTick asks agendaLifeTick first). Only an urgent need, sleep or a
//     visitor interrupts; the task is paused and he picks it back up afterwards. At most
//     AGENDA_MAX_ACTIVE tasks are in progress at once; the rest wait their turn, so he doesn't ping-pong.
//   - Waiting: a task waiting on a delivery, a supply, a skill, the weather or the season is re-checked
//     every few seconds (agendaTick); when it can go on he says so and resumes it.
//   - A reload mid-step pauses the active task ('reload') and he carries on at the step he was on.
//   - He only drops a task on purpose (agendaAbandon), with a diary line saying why.
// The no-key brain and the AI brain both use it: agendaSummaryForAI() is a short line in the AI prompt.

const AGENDA_MAX_ACTIVE = 2;        // tasks in progress (active or paused) at once
const AGENDA_MAX_KEEP_DONE = 12;    // finished and dropped ones kept for the Brain tab
const AGENDA_TICK_MS = 6000;
const AGENDA_STATUSES = ['open', 'active', 'waiting', 'paused', 'done', 'abandoned'];
const AGENDA_ICONS = { open: '○', active: '▶', waiting: '⏳', paused: '⏸', done: '✓', abandoned: '✗' };
// kind -> { resume(task) => result like any activity, check(task) => true | {waitingFor} (optional), label }
const AGENDA_KINDS = {};
let agendaTickTimer = null;
let agendaWorking = null;           // id of the task whose step is running right now (this session only)

function agendaState() {
      if (!state.agenda || typeof state.agenda !== 'object' || Array.isArray(state.agenda)) state.agenda = { tasks: [], focusId: null };
      if (!Array.isArray(state.agenda.tasks)) state.agenda.tasks = [];
      return state.agenda;
    }

function agendaRegisterKind(kind, spec) {
      AGENDA_KINDS[kind] = Object.assign(AGENDA_KINDS[kind] || {}, spec);
    }

function agendaGet(refOrId) {
      if (!refOrId) return null;
      const a = agendaState();
      return a.tasks.find(t => t.id === refOrId) || a.tasks.find(t => t.ref === refOrId && !agendaClosed(t)) || null;
    }

function agendaClosed(t) { return !t || t.status === 'done' || t.status === 'abandoned'; }
function agendaOpenTasks() { return agendaState().tasks.filter(t => !agendaClosed(t)); }
function agendaFocus() { const a = agendaState(); const t = a.focusId && a.tasks.find(x => x.id === a.focusId); return t && !agendaClosed(t) ? t : null; }
function agendaInProgress() { return agendaOpenTasks().filter(t => t.status === 'active' || t.status === 'paused'); }

function agendaStepLabel(t) {
      if (!t || !Array.isArray(t.steps) || !t.steps.length) return '';
      const i = Math.max(0, Math.min(t.steps.length - 1, t.step || 0));
      return t.steps[i];
    }

function agendaWaitText(w) {
      if (!w) return '';
      return String(w.label || w.type || 'something').slice(0, 90);
    }

// A diary line (and a short history on the task) for each turn it takes
function agendaNote(t, what, text, { diary = true } = {}) {
      if (!t) return;
      if (!Array.isArray(t.history)) t.history = [];
      t.history.unshift({ at: Date.now(), what, text: String(text).slice(0, 160) });
      if (t.history.length > 16) t.history.length = 16;
      if (!diary || !Array.isArray(state.diaryEntries)) return;
      const moods = { start: 'Took on', pause: 'Paused', resume: 'Back to', wait: 'Waiting on', ready: 'Picked back up', done: 'Finished', abandon: 'Dropped', step: 'Working on' };
      state.diaryEntries.unshift({
        time: 'My Open Tasks', location: typeof currentPlaceLabel === 'function' ? currentPlaceLabel() : '',
        mood: `${t.emoji || '📋'} ${moods[what] || 'Working on'} ${t.title}`.slice(0, 80),
        vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, ${text}`.slice(0, 400), agenda: t.id
      });
    }

function agendaTouch(t) {
      t.updatedAt = Date.now();
      if (typeof savePersistentBrainState === 'function') savePersistentBrainState();
      agendaRenderSoon();
    }

// Add a task (or return the open one for the same thing). spec: { ref, kind, title, why, emoji, steps,
// step, priority (1 low .. 5 urgent), data, waitingFor, quiet }
function agendaAdd(spec = {}) {
      const a = agendaState();
      const existing = spec.ref ? a.tasks.find(t => t.ref === spec.ref && !agendaClosed(t)) : null;
      if (existing) {
        if (spec.why && !existing.why) existing.why = String(spec.why).slice(0, 200);
        if (Array.isArray(spec.steps) && spec.steps.length && !(existing.steps || []).length) existing.steps = spec.steps.slice(0, 20);
        return existing;
      }
      const now = Date.now();
      const t = {
        id: 'task-' + now.toString(36) + '-' + Math.floor(Math.random() * 1296).toString(36),
        ref: spec.ref || null, kind: String(spec.kind || 'misc'), title: String(spec.title || 'Something to finish').slice(0, 80),
        why: String(spec.why || '').slice(0, 200), emoji: spec.emoji || '📋',
        steps: Array.isArray(spec.steps) ? spec.steps.map(s => String(s).slice(0, 70)).slice(0, 20) : [],
        step: Number.isFinite(spec.step) ? spec.step : 0,
        status: spec.waitingFor ? 'waiting' : 'open', priority: Math.max(1, Math.min(5, Number(spec.priority) || 3)),
        waitingFor: spec.waitingFor || null, pausedBy: null,
        createdAt: now, updatedAt: now, data: spec.data && typeof spec.data === 'object' ? spec.data : {}, history: []
      };
      a.tasks.unshift(t);
      if (!spec.quiet) agendaNote(t, 'start', `I put "${t.title}" on my list${t.why ? ` (${t.why.replace(/\.$/, '')})` : ''}.${t.steps.length ? ` It has ${t.steps.length} steps, starting with ${t.steps[0].toLowerCase()}.` : ''} I won't forget it.`);
      else agendaNote(t, 'start', 'On my list.', { diary: false });
      agendaTrim();
      agendaTouch(t);
      return t;
    }

function agendaTrim() {
      const a = agendaState();
      const closed = a.tasks.filter(agendaClosed).sort((x, y) => (y.updatedAt || 0) - (x.updatedAt || 0));
      if (closed.length > AGENDA_MAX_KEEP_DONE) {
        const drop = new Set(closed.slice(AGENDA_MAX_KEEP_DONE));
        a.tasks = a.tasks.filter(t => !drop.has(t));
      }
    }

// He is working on this step now: it becomes his focus
function agendaStep(refOrId, step, note = '') {
      const t = agendaGet(refOrId);
      if (!t) return null;
      let i = typeof step === 'number' ? step : (t.steps || []).findIndex(s => s.toLowerCase() === String(step).toLowerCase());
      if (i < 0) i = t.step || 0;
      const moved = i !== t.step;
      t.step = Math.max(0, Math.min(Math.max(0, (t.steps || []).length - 1), i));
      const wasWaiting = t.status === 'waiting';
      t.status = 'active';
      t.waitingFor = null;
      t.pausedBy = null;
      agendaState().focusId = t.id;
      if (moved || wasWaiting) agendaNote(t, 'step', note || `On to the next step of ${t.title.toLowerCase()}: ${agendaStepLabel(t).toLowerCase()}.`, { diary: Boolean(note) });
      agendaTouch(t);
      return t;
    }

// Can't go on until something arrives or changes. waitingFor: { type: 'delivery'|'supply'|'skill'|
// 'machine'|'weather'|'season'|'owner'|'plant'|'time', label, items: [regex source], reqIds, until }
function agendaWait(refOrId, waitingFor, note = '') {
      const t = agendaGet(refOrId);
      if (!t) return null;
      const w = Object.assign({ type: 'owner', label: 'something' }, waitingFor || {});
      const same = t.status === 'waiting' && t.waitingFor && t.waitingFor.label === w.label;
      t.status = 'waiting';
      t.waitingFor = { ...w, since: same ? t.waitingFor.since : Date.now() };
      t.pausedBy = null;
      if (agendaState().focusId === t.id) agendaState().focusId = null;
      if (!same) agendaNote(t, 'wait', note || `"${t.title}" has to wait at ${agendaStepLabel(t).toLowerCase() || 'this step'}: I'm waiting for ${agendaWaitText(w)}. I'll pick it up as soon as it's here.`);
      agendaTouch(t);
      return t;
    }

// What it waited for is here: back on the list as ready to go (and it keeps its step)
function agendaReady(refOrId, note = '') {
      const t = agendaGet(refOrId);
      if (!t || t.status !== 'waiting') return t;
      const w = t.waitingFor;
      t.status = 'open';
      t.waitingFor = null;
      agendaNote(t, 'ready', note || `${w ? agendaWaitText(w).replace(/^./, c => c.toUpperCase()) : 'What I was waiting for'} came through, so "${t.title}" is back on: next is ${agendaStepLabel(t).toLowerCase() || 'the next step'}.`);
      agendaTouch(t);
      return t;
    }

function agendaDone(refOrId, note = '') {
      const t = agendaGet(refOrId);
      if (!t || agendaClosed(t)) return t;
      t.status = 'done';
      t.step = Math.max(0, (t.steps || []).length - 1);
      t.waitingFor = null;
      t.doneAt = Date.now();
      if (agendaState().focusId === t.id) agendaState().focusId = null;
      agendaNote(t, 'done', note || `I finished "${t.title}". Crossed it off my list.`);
      agendaTouch(t);
      return t;
    }

// Only on purpose, and he says why
function agendaAbandon(refOrId, why = '') {
      const t = agendaGet(refOrId);
      if (!t || agendaClosed(t)) return t;
      t.status = 'abandoned';
      t.waitingFor = null;
      t.droppedWhy = String(why || 'I changed my mind').slice(0, 200);
      if (agendaState().focusId === t.id) agendaState().focusId = null;
      agendaNote(t, 'abandon', `I decided to drop "${t.title}": ${t.droppedWhy.replace(/\.$/, '')}.`);
      agendaTouch(t);
      return t;
    }

// Something urgent (eating, sleep, a visitor) takes him away: the task he was on is paused
function agendaInterrupt(reason) {
      const t = agendaFocus();
      if (!t || t.status !== 'active') return null;
      t.status = 'paused';
      t.pausedBy = String(reason || 'something else');
      t.pausedAt = Date.now();
      agendaNote(t, 'pause', `I put "${t.title}" down at ${agendaStepLabel(t).toLowerCase() || 'this step'} for ${t.pausedBy}. I'll come right back to it.`);
      agendaTouch(t);
      return t;
    }

// ...and afterwards he goes back to it
function agendaResumeAfter(reason) {
      const t = agendaOpenTasks().find(x => x.status === 'paused' && (!reason || x.pausedBy === reason));
      if (!t) return null;
      t.status = 'active';
      t.pausedBy = null;
      agendaState().focusId = t.id;
      agendaNote(t, 'resume', `Back to "${t.title}", right where I left off: ${agendaStepLabel(t).toLowerCase() || 'the next step'}.`);
      agendaTouch(t);
      return t;
    }

// --- Waiting: is it here yet? ----------------------------------------------------------------------------
function agendaItemsOwned(sources) {
      const owned = typeof ownedItemNames === 'function' ? ownedItemNames() : [];
      return (sources || []).every(src => { try { const re = new RegExp(src, 'i'); return owned.some(n => re.test(n)); } catch (e) { return true; } });
    }

function agendaItemsAtPostOffice(sources) {
      const mail = state.mailbox || [];
      return (sources || []).some(src => { try { const re = new RegExp(src, 'i'); return mail.some(m => re.test(m.name || '') || re.test(m.note || '')); } catch (e) { return false; } });
    }

function agendaWaitSatisfied(t) {
      // A "not before" time is kept even when the kind's own check says the step could go now: a step that
      // was blocked would otherwise be retried (and logged as waiting, then ready) every few seconds
      if (t.waitingFor && Number.isFinite(t.waitingFor.until) && Date.now() < t.waitingFor.until) return false;
      const kind = AGENDA_KINDS[t.kind];
      if (kind && typeof kind.check === 'function') {
        try {
          const r = kind.check(t);
          if (r === true) return true;
          if (r && typeof r === 'object' && r.waitingFor) {
            // Still waiting, maybe on something else now
            if (!t.waitingFor || r.waitingFor.label !== t.waitingFor.label) t.waitingFor = { ...r.waitingFor, since: Date.now() };
            return false;
          }
          if (r === false) return false;
        } catch (e) { return false; }
      }
      const w = t.waitingFor;
      if (!w) return true;
      if (Number.isFinite(w.until) && Date.now() < w.until) return false;
      if (Array.isArray(w.items) && w.items.length && !agendaItemsOwned(w.items)) return false;
      if (Array.isArray(w.reqIds) && w.reqIds.length) {
        const reqs = (state.requestsToUser || []).filter(r => w.reqIds.includes(r.id));
        if (reqs.some(r => !r.fulfilled)) return false;
        if (reqs.length && reqs.every(r => r.declined) && !(w.items || []).length) return false;
      }
      if (typeof w.test === 'string' && typeof window[w.test] === 'function') { try { if (!window[w.test](t)) return false; } catch (e) { return false; } }
      return Boolean(Number.isFinite(w.until) || (w.items && w.items.length) || (w.reqIds && w.reqIds.length) || w.test);
    }

// The things he is waiting for are at the Post Office: that makes going for the mail more urgent
function agendaMailWaiting() {
      const mail = state.mailbox || [];
      return agendaOpenTasks().some(t => t.status === 'waiting' && t.waitingFor && (agendaItemsAtPostOffice(t.waitingFor.items)
        // a kit sent from one of this task's own parts lists
        || mail.some(m => m.jobKit && ((t.data && t.data.reqIds) || []).includes(m.jobKit.reqId))));
    }

function agendaTick() {
      const open = agendaOpenTasks();
      open.forEach(t => {
        if (t.status === 'waiting' && agendaWaitSatisfied(t)) agendaReady(t.id);
      });
      // A pause that outlived its reason (he woke up, the visitor left) goes back to active
      const free = typeof keloIsFree === 'function' ? keloIsFree() : true;
      if (free && !state.isSleeping) {
        open.filter(t => t.status === 'paused' && t.pausedBy && t.pausedBy !== 'reload' && Date.now() - (t.pausedAt || 0) > 90000)
          .forEach(t => { if (!agendaFocus() || agendaFocus() === t) agendaResumeAfter(t.pausedBy); });
      }
    }

// --- Choosing what to work on ---------------------------------------------------------------------------
function agendaRank(t) {
      const age = (Date.now() - (t.createdAt || 0)) / 3600000;
      return (t.status === 'active' ? 100 : t.status === 'paused' ? 80 : 0) + t.priority * 10 + Math.min(10, age) + ((t.steps || []).length ? (t.step || 0) / t.steps.length * 5 : 0);
    }

// The task his next free moment goes to (null: nothing he must get back to, so he's free to follow a whim)
function agendaNextTask() {
      const focus = agendaFocus();
      if (focus && (focus.status === 'active' || (focus.status === 'paused' && !focus.pausedBy))) return focus;
      const open = agendaOpenTasks().filter(t => AGENDA_KINDS[t.kind] && typeof AGENDA_KINDS[t.kind].resume === 'function');
      const inProgress = open.filter(t => t.status === 'active' || t.status === 'paused');
      const paused = inProgress.filter(t => t.status === 'paused' && (t.pausedBy === 'reload' || !t.pausedBy)).sort((a, b) => agendaRank(b) - agendaRank(a));
      if (paused.length) return paused[0];
      const ready = open.filter(t => t.status === 'open').sort((a, b) => agendaRank(b) - agendaRank(a));
      if (!ready.length) return null;
      // A cap on how much is on the go at once: something new waits until one of those is finished
      if (inProgress.length >= AGENDA_MAX_ACTIVE && !inProgress.includes(ready[0])) return null;
      return ready[0];
    }

// Run the next step of a task (the resume function of its kind). True when he started on it.
function agendaWorkOn(t) {
      const kind = t && AGENDA_KINDS[t.kind];
      if (!kind || typeof kind.resume !== 'function' || agendaWorking) return false;
      if (t.status !== 'active') {
        const back = t.status === 'paused';
        t.status = 'active';
        t.pausedBy = null;
        agendaState().focusId = t.id;
        if (back) agendaNote(t, 'resume', `Picking "${t.title}" back up where I left it: ${agendaStepLabel(t).toLowerCase() || 'the next step'}.`);
        agendaTouch(t);
      }
      agendaWorking = t.id;
      let result;
      try { result = kind.resume(t); } catch (e) { agendaWorking = null; console.warn('Agenda step failed:', e); return false; }
      Promise.resolve(result).then(r => {
        // A step that couldn't start (blocked) without saying why it waits: it waits on a short timer, so the
        // next free moment can go elsewhere instead of retrying it over and over
        if ((r === false || r === null || typeof r === 'string') && t.status === 'active') {
          agendaWait(t.id, { type: 'time', label: typeof r === 'string' ? `a moment (${r.replace(/-/g, ' ')})` : 'a better moment', until: Date.now() + (typeof r === 'string' ? 6 : 3) * 60000 }, '');
        }
      }).catch(e => {
        console.warn('Agenda step failed:', e);
        // A step that broke waits a while instead of being retried on every free tick
        if (t.status === 'active') agendaWait(t.id, { type: 'time', label: 'a second try after something went wrong', until: Date.now() + 5 * 60000 }, '');
      }).finally(() => { agendaWorking = null; agendaRenderSoon(); });
      return true;
    }

// Called first thing on each free tick: his focus comes before any whim
function agendaLifeTick() {
      if (agendaWorking) return false;
      const t = agendaNextTask();
      if (!t) return false;
      // Committed work always comes first; a task not started yet is usually taken up, now and then a whim wins
      if (t.status === 'open' && !agendaFocus() && Math.random() < 0.25) return false;
      return agendaWorkOn(t);
    }

// --- For the brains ---------------------------------------------------------------------------------------
function agendaLine(t) {
      const n = (t.steps || []).length;
      const step = n ? ` step ${Math.min(n, (t.step || 0) + 1)}/${n} ${agendaStepLabel(t)}` : '';
      const wait = t.status === 'waiting' && t.waitingFor ? `, waiting for ${agendaWaitText(t.waitingFor)}` : t.status === 'paused' && t.pausedBy ? `, paused for ${t.pausedBy}` : '';
      return `[${t.id.slice(-4)}] ${t.title} (${t.status}${step}${wait})`;
    }

// Kept short: the AI prompt carries at most five open tasks
function agendaSummaryForAI() {
      const open = agendaOpenTasks().sort((a, b) => agendaRank(b) - agendaRank(a)).slice(0, 5);
      if (!open.length) return 'none';
      const f = agendaFocus();
      return (f ? `FOCUS: ${agendaLine(f)}. ` : '') + open.filter(t => t !== f).map(agendaLine).join('; ');
    }

// The AI may decide about a task: {"agenda": {"task": "<last 4 of id>", "do": "resume" | "drop", "why": "..."}}
function applyAgendaDecision(decision) {
      const ad = decision && decision.agenda;
      if (!ad || typeof ad !== 'object') return;
      const tag = String(ad.task || '').trim().toLowerCase();
      const t = agendaOpenTasks().find(x => tag && (x.id.endsWith(tag) || x.title.toLowerCase() === tag));
      if (!t) return;
      if (/drop|abandon|give up/i.test(String(ad.do || ''))) {
        const why = String(ad.why || '').trim();
        // Dropping has to be deliberate: a reason, and not the step he only just started
        if (why.length >= 8) agendaAbandon(t.id, why);
        return;
      }
      if (/resume|continue|focus|back/i.test(String(ad.do || '')) && t.status !== 'waiting') {
        agendaState().focusId = t.id;
        if (t.status === 'open' || t.status === 'paused') { t.status = 'active'; t.pausedBy = null; agendaTouch(t); }
      }
    }

// --- Old saves and reloads --------------------------------------------------------------------------------
// After a reload the step that was running stopped half-way: the task is paused and resumes at that step
function agendaAfterLoad() {
      const a = agendaState();
      a.tasks = a.tasks.filter(t => t && typeof t === 'object' && t.id && AGENDA_STATUSES.includes(t.status));
      a.tasks.forEach(t => {
        if (!Array.isArray(t.steps)) t.steps = [];
        if (!t.data || typeof t.data !== 'object') t.data = {};
        if (t.status === 'active') {
          t.status = 'paused';
          t.pausedBy = 'reload';
          t.pausedAt = Date.now();
          agendaNote(t, 'pause', `Everything went dark for a moment in the middle of "${t.title}". I remember exactly where I was: ${agendaStepLabel(t).toLowerCase() || 'the next step'}. I'll carry on from there.`);
        }
      });
      if (a.focusId && !a.tasks.some(t => t.id === a.focusId)) a.focusId = null;
    }

// Build tasks from what an older save was already in the middle of. Each kind's file adds its own
// migrations (AGENDA_KINDS[kind].migrate); this runs them once per save.
function agendaMigrate() {
      const a = agendaState();
      a.migrated = a.migrated && typeof a.migrated === 'object' ? a.migrated : {};
      Object.entries(AGENDA_KINDS).forEach(([kind, spec]) => {
        if (typeof spec.migrate !== 'function' || a.migrated[kind]) return;
        try { spec.migrate(); a.migrated[kind] = Date.now(); } catch (e) { console.warn('Agenda migration failed for', kind, e); }
      });
    }

// --- The Brain tab: "Open tasks" (read-only) ------------------------------------------------------------
let agendaRenderQueued = false;
function agendaRenderSoon() {
      if (agendaRenderQueued) return;
      agendaRenderQueued = true;
      setTimeout(() => { agendaRenderQueued = false; renderAgendaList(); }, 400);
    }

function agendaAgo(at) {
      const m = Math.round((Date.now() - (at || Date.now())) / 60000);
      return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
    }

function renderAgendaList() {
      const el = document.getElementById('agendaListContainer');
      if (!el) return;
      const badge = document.getElementById('agendaBadge');
      const open = agendaOpenTasks().sort((a, b) => agendaRank(b) - agendaRank(a));
      const closed = agendaState().tasks.filter(agendaClosed).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 4);
      if (badge) badge.textContent = open.length ? `${open.length} open` : 'none';
      const pill = { active: 'brain-pill-active', waiting: '', paused: '', open: '', done: 'brain-pill-done', abandoned: '' };
      const statusWord = { active: 'Working on it', waiting: 'Waiting', paused: 'Paused', open: 'Up next', done: 'Done', abandoned: 'Dropped' };
      const card = t => {
        const n = (t.steps || []).length, i = Math.min(n, (t.step || 0) + (t.status === 'done' ? 1 : 0));
        const pct = n ? Math.round(i / n * 100) : (t.status === 'done' ? 100 : 0);
        const focus = agendaState().focusId === t.id;
        const sub = t.status === 'waiting' && t.waitingFor ? `Waiting for ${escapeHtml(agendaWaitText(t.waitingFor))}`
          : t.status === 'paused' ? `Paused${t.pausedBy ? ` for ${escapeHtml(t.pausedBy)}` : ''}; he'll come back to it`
          : t.status === 'abandoned' ? `Dropped: ${escapeHtml(t.droppedWhy || '')}`
          : t.status === 'done' ? `Finished ${escapeHtml(agendaAgo(t.doneAt || t.updatedAt))}`
          : t.why ? escapeHtml(t.why) : '';
        return `<div class="brain-card space-y-1.5" data-agenda-id="${escapeHtml(t.id)}">
          <div class="flex items-center gap-2"><span class="brain-card-icon" aria-hidden="true">${escapeHtml(t.emoji || '📋')}</span><span class="brain-card-title flex-1 truncate">${escapeHtml(t.title)}</span><span class="brain-pill ${pill[t.status] || ''}">${focus ? '★ ' : ''}${AGENDA_ICONS[t.status] || ''} ${statusWord[t.status] || t.status}</span></div>
          ${n && !agendaClosed(t) ? `<div class="brain-bar brain-bar-orange" role="progressbar" aria-label="${escapeHtml(t.title)}: step ${Math.min(n, (t.step || 0) + 1)} of ${n}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
          <div class="brain-card-meta">Step ${Math.min(n, (t.step || 0) + 1)} of ${n}: ${escapeHtml(agendaStepLabel(t))}</div>` : ''}
          ${sub ? `<div class="brain-card-meta">${sub}</div>` : ''}
          ${n > 1 && !agendaClosed(t) ? `<div class="flex flex-wrap gap-1">${t.steps.map((s, k) => `<span class="brain-chip ${k < (t.step || 0) ? 'brain-chip-ok' : ''}">${k < (t.step || 0) ? '✓' : k === (t.step || 0) ? '▶' : '○'} ${escapeHtml(s)}</span>`).join('')}</div>` : ''}
        </div>`;
      };
      const html = open.length || closed.length
        ? open.map(card).join('') + (closed.length ? `<div class="brain-card-meta pt-1">Recently crossed off</div>` + closed.map(card).join('') : '')
        : '<div class="brain-empty text-xs text-slate-500 italic">Nothing on his list right now.</div>';
      if (typeof perfSetHtml === 'function') perfSetHtml(el, html); else el.innerHTML = html;
    }

window.addEventListener('DOMContentLoaded', () => {
  // After every file has registered its kinds and the save has loaded
  setTimeout(() => {
    agendaAfterLoad();
    agendaMigrate();
    renderAgendaList();
    if (!agendaTickTimer) agendaTickTimer = setInterval(() => { try { agendaTick(); } catch (e) { console.warn('Agenda tick failed:', e); } }, AGENDA_TICK_MS);
  }, 900);
});

// Requests one of his open tasks is waiting on (js/agent.js never trims these)
function agendaAwaitedRequestIds() {
      const ids = [];
      agendaOpenTasks().forEach(t => {
        if (t.waitingFor && Array.isArray(t.waitingFor.reqIds)) ids.push(...t.waitingFor.reqIds);
        if (t.data && Array.isArray(t.data.reqIds)) ids.push(...t.data.reqIds);
      });
      return ids;
    }
