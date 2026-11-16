// Kelo-bot-1 — js/goals.js
// Loaded after js/outcomes.js. LONG GOALS: things he wants to achieve over several days, above the
// agenda (js/agenda.js). A goal has stages, each stage has tasks, and he keeps track of progress and of
// what blocks him (waiting for a delivery, a skill, the night, a season, the next day...).
//   goal -> stages -> tasks. Each task names an ACTION ("research", "ask", "paint", "practise"...) that
//   runs one of his real activities; a goal is one agenda task (kind 'goal'), so the agenda's focus,
//   pause-for-sleep-or-a-visitor and resume-after-reload all apply to it.
// He picks goals himself from his interests (hobbies, concepts, likes, skills), the visitor (what they
// say and ask) and what he reads at NetNode (js/netnode.js webHistory), scored by each template's
// keywords and by how similar goals went before (js/outcomes.js). Both brains use it: the AI sees his
// goals and a few goal ideas it may take up ("newGoal"); the no-key brain works through them directly.
// Saved in state.goals (bounded: GOALS_MAX_OPEN open, GOALS_MAX_HISTORY finished). Old saves start empty.
//
// API for other files (see GOALS.md):
//   registerGoalTemplate(id, spec)  add a kind of goal (e.g. the farm machine's "build a big farm")
//   registerGoalAction(name, spec)  add a kind of task step a template can use
//   goalStart(templateId, { source, sourceText, params })  start one now (returns the goal or null)
//   goalById(id), goalsOpen(), goalsSummaryForAI(), goalIdeasForAI()

const GOALS_MAX_OPEN = 2;            // goals he works on at once
const GOALS_MAX_HISTORY = 12;        // finished or dropped goals kept for the Brain tab and for learning
const GOAL_PICK_GAP_MS = 20 * 60000; // at least this long between taking on new goals
const GOAL_BREAK_MS = 8 * 60000;     // after a step he does other things for a while (variety)
const GOAL_STEP_TRIES = 3;           // a step that keeps failing is set aside (with a diary line)
const GOAL_MAX_BLOCKED_MS = 1.5 * (typeof WORLD_DAY_MS === 'number' ? WORLD_DAY_MS : 43200000); // then he drops it, saying why
const GOAL_TICK_MS = 20000;

const GOAL_TEMPLATES = {};
const GOAL_ACTIONS = {};
let goalTickTimer = null;
let goalRunning = null;              // id of the goal whose step is running (this session only)

// --- Registries -----------------------------------------------------------------------------------------
// spec: {
//   title: string | (params) => string, emoji, base (0..2, how appealing with no signals),
//   keywords: RegExp matched against his interests, the visitor's words and what he reads,
//   params(ctx) => object | null   (what this goal would be about right now; null: not possible now)
//   why(params, source) => string  (optional)
//   stages(params) => [{ name, tasks: [{ do: 'action', ...args, label?, newDay?, optional? }] }]
//   repeatAfterDays: days before the same template is picked again (default 2)
// }
function registerGoalTemplate(id, spec) {
      if (!id || !spec || typeof spec.stages !== 'function') return false;
      GOAL_TEMPLATES[String(id)] = Object.assign({ id: String(id), base: 0.5, emoji: '🎯', repeatAfterDays: 2 }, spec);
      return true;
    }

// spec: {
//   key(task) => activity key for the loop guard and outcome learning ('paint', 'skill', ...)
//   label(task) => short text for the Brain tab and diary
//   blocker(task, goal) => null | { type, label, ...data }   (checked before running; see goalBlockerOver)
//   run(task, goal) => like any activity: true/undefined done; a reason string: blocked; false: didn't start
//   done(task, goal) => true when the step's purpose is already met (optional; skips running it)
// }
function registerGoalAction(name, spec) {
      if (!name || !spec || typeof spec.run !== 'function') return false;
      GOAL_ACTIONS[String(name)] = Object.assign({ key: () => String(name), label: t => t.label || String(name) }, spec);
      return true;
    }

function goalsState() {
      if (!state.goals || typeof state.goals !== 'object' || Array.isArray(state.goals)) state.goals = { list: [], history: [], lastPickAt: 0 };
      const g = state.goals;
      if (!Array.isArray(g.list)) g.list = [];
      if (!Array.isArray(g.history)) g.history = [];
      if (!Number.isFinite(g.lastPickAt)) g.lastPickAt = 0;
      return g;
    }

function goalById(id) { return goalsState().list.find(g => g.id === id) || null; }
function goalsOpen() { return goalsState().list.filter(g => g.status === 'active' || g.status === 'waiting'); }
function goalDay() { return typeof worldNow === 'function' ? worldNow().day : Math.floor(Date.now() / 43200000); }
function goalTag(g) { return String(g.id).slice(-4); }

function goalTasksFlat(g) { return (g.stages || []).flatMap(s => s.tasks || []); }
function goalProgress(g) {
      const all = goalTasksFlat(g);
      return all.length ? all.filter(t => t.status === 'done' || t.status === 'skipped').length / all.length : 0;
    }
function goalCurrentTask(g) {
      const st = g.stages && g.stages[g.stage];
      return st ? (st.tasks || []).find(t => t.status === 'todo') || null : null;
    }

// --- What he is into right now: the signals goals are picked from ----------------------------------------
function goalSignals() {
      const txt = a => a.filter(Boolean).map(String).join(' | ').slice(0, 3000);
      const visitorWords = (state.chatLog || []).filter(m => m && !m.isBot && m.sender !== 'Kelo-1').slice(-12).map(m => m.text);
      return {
        interest: txt([...(state.hobbies || []).map(h => h.name), ...(state.concepts || []).slice(0, 8).map(c => `${c.name} ${c.definition || ''}`),
          ...(state.likes || []).slice(0, 6).map(l => l.topic || l.item), ...Object.values(state.skills || {}).map(s => s.label),
          ...(state.toys || []).slice(0, 4).map(t => t.name), state.currentObsession]),
        visitor: txt([...visitorWords, ...(state.visitorMemories || []).slice(0, 4).map(v => v.impression),
          ...(state.requestsToUser || []).filter(r => r.fulfilled && !r.declined && r.userAnswer).slice(0, 4).map(r => r.userAnswer)]),
        reading: txt([...(state.webHistory || []).slice(0, 8).map(w => `${w.query} ${w.verdict || ''}`), ...(state.curiosityQueue || []).slice(0, 6)])
      };
    }

function goalCountMatches(re, text) {
      if (!re || !text) return 0;
      const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
      return Math.min(6, (String(text).match(g) || []).length);
    }

// Every template he could take up now, scored: { id, params, score, source, sourceText }
function goalCandidates(signals = goalSignals()) {
      const gs = goalsState();
      const open = new Set(goalsOpen().map(g => g.template));
      const out = [];
      Object.values(GOAL_TEMPLATES).forEach(tp => {
        if (open.has(tp.id)) return;
        let params = {};
        try { params = typeof tp.params === 'function' ? tp.params({ signals }) : {}; } catch (e) { params = null; }
        if (params === null || params === false) return;
        const m = { interest: goalCountMatches(tp.keywords, signals.interest), visitor: goalCountMatches(tp.keywords, signals.visitor), reading: goalCountMatches(tp.keywords, signals.reading) };
        let score = (tp.base || 0.5) + m.interest * 0.6 + m.visitor * 0.9 + m.reading * 0.7 + (params && params.boost ? params.boost : 0);
        // How goals like this went before: a finished one is less urgent for a while (variety), a dropped one
        // is less tempting, one that worked and made him happy is a little more
        const past = gs.history.filter(h => h.template === tp.id);
        const last = past[0];
        if (last && last.status === 'done' && (goalDay() - (last.doneDay || 0)) < (tp.repeatAfterDays || 2)) score *= 0.15;
        if (last && last.status === 'abandoned') score *= 0.5;
        if (past.some(h => h.status === 'done' && (h.mood || 0) > 0)) score *= 1.15;
        if (typeof outcomeBias === 'function') score *= outcomeBias('goal:' + tp.id);
        const source = m.visitor && m.visitor * 0.9 >= Math.max(m.interest * 0.6, m.reading * 0.7) ? 'visitor'
          : m.reading && m.reading * 0.7 >= m.interest * 0.6 ? 'reading' : m.interest ? 'interest' : 'self';
        const srcText = source === 'self' ? '' : (String(signals[source]).match(new RegExp(`[^|]*(${tp.keywords.source})[^|]*`, tp.keywords.flags.replace('g', ''))) || [''])[0].trim().slice(0, 80);
        out.push({ id: tp.id, params: params || {}, score: Math.round(score * 100) / 100, source, sourceText: srcText });
      });
      return out.sort((a, b) => b.score - a.score);
    }

// One of the best few, weighted by score (so the same signals don't always give the same goal)
function goalChoose(cands) {
      const top = cands.slice(0, 3).filter(c => c.score > 0.05);
      if (!top.length) return null;
      let roll = Math.random() * top.reduce((s, c) => s + c.score, 0);
      for (const c of top) { roll -= c.score; if (roll <= 0) return c; }
      return top[0];
    }

// --- Starting, stepping, finishing ---------------------------------------------------------------------
function goalWhyText(tp, params, source, sourceText) {
      if (typeof tp.why === 'function') { try { const w = tp.why(params, source); if (w) return String(w).slice(0, 200); } catch (e) {} }
      const by = { visitor: 'a visitor got me thinking about it', reading: 'something I read at NetNode stayed with me', interest: "it's what I'm into lately", self: 'I just want to', ai: 'I decided it myself' };
      return by[source] || by.self;
    }

function goalStart(templateId, opts = {}) {
      const tp = GOAL_TEMPLATES[templateId];
      if (!tp) return null;
      const gs = goalsState();
      if (goalsOpen().length >= GOALS_MAX_OPEN && !opts.force) return null;
      if (goalsOpen().some(g => g.template === templateId)) return null;
      let params = opts.params;
      if (!params) { try { params = typeof tp.params === 'function' ? tp.params({ signals: goalSignals() }) : {}; } catch (e) { params = null; } }
      if (params === null || params === false) return null;
      let stages;
      try { stages = tp.stages(params) || []; } catch (e) { console.warn('Goal template failed:', templateId, e); return null; }
      stages = stages.filter(s => s && Array.isArray(s.tasks) && s.tasks.length).slice(0, 8).map(s => ({
        name: String(s.name || 'Next').slice(0, 50),
        tasks: s.tasks.slice(0, 8).filter(t => t && GOAL_ACTIONS[t.do]).map(t => ({ ...t, status: 'todo', tries: 0 }))
      })).filter(s => s.tasks.length);
      if (!stages.length) return null;
      const title = String(typeof tp.title === 'function' ? tp.title(params) : tp.title || 'A long goal').slice(0, 80);
      const source = opts.source || 'self';
      const now = Date.now();
      const g = {
        id: 'goal-' + now.toString(36) + '-' + Math.floor(Math.random() * 1296).toString(36),
        template: tp.id, title, emoji: tp.emoji || '🎯', params, source, sourceText: String(opts.sourceText || '').slice(0, 80),
        why: goalWhyText(tp, params, source, opts.sourceText), stages, stage: 0, status: 'active', blocker: null,
        createdAt: now, startDay: goalDay(), updatedAt: now, lastWorkDay: null, lastWorkAt: 0, workDays: [], moodStart: state.happiness, log: []
      };
      gs.list.unshift(g);
      gs.lastPickAt = now;
      // On his agenda, so focus, interruptions and reloads work the same as for every other open task
      if (typeof agendaAdd === 'function') {
        const t = agendaAdd({ ref: 'goal:' + g.id, kind: 'goal', title: g.title, why: g.why, emoji: g.emoji, steps: stages.map(s => s.name), priority: 2, data: { goalId: g.id }, quiet: true });
        g.agendaId = t && t.id;
      }
      const intro = {
        visitor: `${g.sourceText ? `"${g.sourceText.replace(/"/g, '')}". ` : ''}A visitor got me thinking, and now I have a real goal: ${title.toLowerCase()}.`,
        reading: `I keep thinking about what I read${g.sourceText ? ` (${g.sourceText.replace(/"/g, '').slice(0, 50)})` : ''}. So here's a goal for the next few days: ${title.toLowerCase()}.`,
        interest: `I've decided on something bigger than one afternoon: ${title.toLowerCase()}, because ${g.why.replace(/\.$/, '')}.`,
        self: `A new long goal, all my own: ${title.toLowerCase()}.`,
        ai: `I set myself a goal: ${title.toLowerCase()}. ${g.why}`
      };
      goalDiary(g, `${intro[source] || intro.self} ${stages.length} stages: ${stages.map(s => s.name.toLowerCase()).join(', then ')}.`, '🎯 A new goal');
      goalTouch(g);
      if (typeof showToast === 'function') showToast(`🎯 Kelo-1 set himself a goal: ${title}`);
      return g;
    }

function goalTouch(g) {
      g.updatedAt = Date.now();
      const t = g.agendaId && typeof agendaGet === 'function' ? agendaGet(g.agendaId) : null;
      if (t && !agendaClosed(t)) { t.step = Math.min(g.stage, Math.max(0, (t.steps || []).length - 1)); t.updatedAt = g.updatedAt; }
      if (typeof savePersistentBrainState === 'function') savePersistentBrainState();
      goalsRenderSoon();
    }

function goalLog(g, text) {
      if (!Array.isArray(g.log)) g.log = [];
      g.log.unshift({ at: Date.now(), text: String(text).slice(0, 140) });
      if (g.log.length > 12) g.log.length = 12;
    }

function goalDiary(g, text, mood) {
      goalLog(g, text);
      if (!Array.isArray(state.diaryEntries)) return;
      state.diaryEntries.unshift({
        time: 'My Long Goals', location: typeof currentPlaceLabel === 'function' ? currentPlaceLabel() : '',
        mood: String(mood || `${g.emoji} ${g.title}`).slice(0, 80), vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, ${text}`.slice(0, 420), goal: g.id
      });
    }

// Varied lines for a step that went well (never the same opener twice in a row)
const GOAL_STEP_LINES = [
  (g, t, p) => `Another step towards ${g.title.toLowerCase()}: ${t}. ${p}`,
  (g, t, p) => `Today I got through "${t}" for my goal. ${p}`,
  (g, t, p) => `${t[0].toUpperCase() + t.slice(1)}: done. ${g.title} is ${p.toLowerCase()}`,
  (g, t, p) => `Little by little. I finished ${t} today, part of ${g.title.toLowerCase()}. ${p}`,
  (g, t, p) => `It felt good to make real progress on ${g.title.toLowerCase()} (${t}). ${p}`,
  (g, t, p) => `One more piece of the bigger plan: ${t}. ${p}`
];
let goalLineLast = -1;
function goalStepLine(g, label) {
      const pct = Math.round(goalProgress(g) * 100);
      const st = g.stages[g.stage];
      const p = pct >= 100 ? 'That was the last step!' : `About ${pct}% of the way there${st ? `, still on "${st.name.toLowerCase()}"` : ''}.`;
      let i = Math.floor(Math.random() * GOAL_STEP_LINES.length);
      if (i === goalLineLast) i = (i + 1) % GOAL_STEP_LINES.length;
      goalLineLast = i;
      return GOAL_STEP_LINES[i](g, label, p);
    }

function goalAdvance(g) {
      while (g.stages[g.stage] && !(g.stages[g.stage].tasks || []).some(t => t.status === 'todo')) {
        const st = g.stages[g.stage];
        g.stage++;
        if (g.stages[g.stage]) goalLog(g, `Finished the stage "${st.name}"`);
      }
      if (!g.stages[g.stage]) { goalFinish(g); return false; }
      return true;
    }

function goalFinish(g) {
      if (g.status === 'done') return;
      g.status = 'done';
      g.doneAt = Date.now();
      g.blocker = null;
      g.stage = Math.max(0, g.stages.length - 1);
      const days = Math.max(1, goalDay() - (g.startDay || goalDay()) + 1);
      const mood = Math.round((state.happiness || 0) - (g.moodStart || 0));
      const skipped = goalTasksFlat(g).filter(t => t.status === 'skipped').length;
      goalDiary(g, `I did it: ${g.title.toLowerCase()}. It took ${days} day${days === 1 ? '' : 's'}${skipped ? ` and I had to leave ${skipped} step${skipped === 1 ? '' : 's'} out` : ''}. ${mood > 3 ? 'I feel proud and a bit taller.' : mood < -3 ? 'I am tired, but it was worth it.' : 'It feels quietly good to finish something I set out to do.'}`, `🏁 Goal reached: ${g.title}`);
      state.happiness = Math.min(100, (state.happiness || 0) + 8);
      if (typeof outcomeRecord === 'function') outcomeRecord({ key: 'goal:' + g.template, at: g.createdAt, mood: g.moodStart, owned: 0, supplies: 0, probes: [] }, true);
      if (g.agendaId && typeof agendaDone === 'function') agendaDone(g.agendaId, `Crossed off my long goal "${g.title}".`);
      if (typeof bumpLifeStat === 'function') bumpLifeStat('goals');
      goalArchive(g, mood);
      if (typeof showToast === 'function') showToast(`🏁 Kelo-1 reached his goal: ${g.title}`);
    }

function goalAbandon(g, why) {
      if (!g || g.status === 'done' || g.status === 'abandoned') return;
      g.status = 'abandoned';
      g.droppedWhy = String(why || 'I changed my mind').slice(0, 200);
      goalDiary(g, `I'm letting go of ${g.title.toLowerCase()} for now: ${g.droppedWhy.replace(/\.$/, '')}. Maybe another time.`, `🍂 Set aside: ${g.title}`);
      if (typeof outcomeRecord === 'function') outcomeRecord({ key: 'goal:' + g.template, at: g.createdAt, mood: g.moodStart, owned: 0, supplies: 0, probes: [] }, 'abandoned');
      if (g.agendaId && typeof agendaAbandon === 'function') agendaAbandon(g.agendaId, g.droppedWhy);
      goalArchive(g, Math.round((state.happiness || 0) - (g.moodStart || 0)));
    }

function goalArchive(g, mood) {
      const gs = goalsState();
      gs.list = gs.list.filter(x => x !== g);
      gs.history.unshift({ id: g.id, template: g.template, title: g.title, emoji: g.emoji, status: g.status, source: g.source, startDay: g.startDay, doneDay: goalDay(), at: Date.now(), mood, why: g.droppedWhy || null, steps: goalTasksFlat(g).length, skipped: goalTasksFlat(g).filter(t => t.status === 'skipped').length });
      if (gs.history.length > GOALS_MAX_HISTORY) gs.history.length = GOALS_MAX_HISTORY;
      goalTouch(g);
    }

// --- Blockers: what he is waiting for -------------------------------------------------------------------
// { type: 'night' | 'day' | 'nextDay' | 'season' | 'items' | 'skill' | 'calm' | 'ready' | 'time', label, ... }
function goalBlockerOver(b) {
      if (!b) return true;
      const now = typeof worldNow === 'function' ? worldNow() : { isNight: false, season: '', day: 0 };
      if (Number.isFinite(b.until) && Date.now() < b.until) return false;
      switch (b.type) {
        case 'night': return now.isNight;
        case 'day': return !now.isNight;
        case 'nextDay': return goalDay() > (b.day || 0);
        case 'season': return (b.seasons || []).includes(now.season);
        case 'items': return typeof agendaItemsOwned === 'function' ? agendaItemsOwned(b.items || []) : true;
        case 'skill': { const s = typeof skillOf === 'function' ? skillOf(b.skill) : null; return Boolean(s && s.level >= (b.level || 1)); }
        case 'calm': return !(typeof windSummaryForAI === 'function' && /strong|gust|gale|storm/i.test(windSummaryForAI()));
        case 'ready': { const a = GOAL_ACTIONS[b.action]; try { return !a || !a.blocker || !a.blocker(b.task || {}, null); } catch (e) { return true; } }
        default: return true;
      }
    }

// The agenda's check for a waiting goal: called every few seconds (js/agenda.js agendaWaitSatisfied)
function goalAgendaCheck(t) {
      const g = goalById(t.data && t.data.goalId);
      if (!g) return true;
      if (!g.blocker) return true;
      if (g.blocker.since && Date.now() - g.blocker.since > GOAL_MAX_BLOCKED_MS && g.blocker.type !== 'season') {
        goalAbandon(g, `I waited a long time for ${g.blocker.label} and it never came together`);
        return true;
      }
      if (goalBlockerOver(g.blocker)) { g.blocker = null; g.status = 'active'; return true; }
      return { waitingFor: { type: g.blocker.type, label: g.blocker.label } };
    }

function goalBlock(g, b, { quiet = false, note = '' } = {}) {
      const same = g.blocker && g.blocker.label === b.label;
      g.blocker = { ...b, since: same ? g.blocker.since : Date.now() };
      g.status = 'waiting';
      const t = g.agendaId && typeof agendaGet === 'function' ? agendaGet(g.agendaId) : null;
      if (t && !agendaClosed(t)) {
        // Quietly on the agenda (the goal writes its own, less repetitive diary lines)
        t.status = 'waiting';
        t.waitingFor = { type: b.type, label: b.label, since: g.blocker.since, until: b.until, quiet };
        t.pausedBy = null;
        if (agendaState().focusId === t.id) agendaState().focusId = null;
      }
      if (!quiet && !same) goalDiary(g, note || `${g.title} has to wait: ${b.label}. I'll get back to it when it's possible.`, `⏳ ${g.title}: waiting`);
      goalTouch(g);
    }

// --- Doing the next step (the agenda's resume function for kind 'goal') -----------------------------------
function goalStep(g) {
      if (!g || (g.status !== 'active' && g.status !== 'waiting')) return false;
      if (goalRunning) { goalBlock(g, { type: 'time', label: 'a free moment', until: Date.now() + 60000 }, { quiet: true }); return 'waiting'; }
      if (g.blocker && !goalBlockerOver(g.blocker)) { goalBlock(g, g.blocker, { quiet: true }); return 'waiting'; }
      g.blocker = null;
      g.status = 'active';
      if (!goalAdvance(g)) return true;
      const task = goalCurrentTask(g);
      const action = task && GOAL_ACTIONS[task.do];
      if (!action) { if (task) task.status = 'skipped'; goalTouch(g); return true; }
      const label = action.label(task);
      // Already met (he got the telescope some other way, say): crossed off without doing it again
      try { if (typeof action.done === 'function' && action.done(task, g)) { task.status = 'done'; goalLog(g, `Already done: ${label}`); goalAdvance(g); goalTouch(g); return true; } } catch (e) {}
      // Some steps belong on another day: a series of paintings, a garden that needs time
      if (task.newDay && g.lastWorkDay === goalDay() && goalTasksFlat(g).some(x => x.status === 'done')) { goalBlock(g, { type: 'nextDay', day: goalDay(), label: `a new day for ${label}` }, { quiet: true }); return 'waiting'; }
      let b = null;
      try { b = typeof action.blocker === 'function' ? action.blocker(task, g) : null; } catch (e) { b = null; }
      if (b) { goalBlock(g, b); return 'waiting'; }
      const key = action.key(task);
      // What went wrong last time changes how he does it now (js/outcomes.js): the fix becomes a step first
      if (task.tries > 0 && !task.fixed && typeof outcomeFixFor === 'function') {
        const fix = outcomeFixFor(key);
        const extra = fix && goalFixTask(fix, task, g);
        if (extra) {
          task.fixed = true;
          task.appliedFix = { reason: fix.reason, kind: fix.kind };
          const st = g.stages[g.stage];
          st.tasks.splice(st.tasks.indexOf(task), 0, { ...extra, status: 'todo', tries: 0, isFix: true, fixFor: task.do });
          goalDiary(g, fix.learned ? `Last time ${fix.why} when I tried ${label}. What I tried before that didn't help much, so this time I'll ${fix.fix}.` : `Last time ${fix.why} when I tried ${label}, so this time I'll ${fix.fix} first.`, `🔁 ${g.title}: trying it differently`);
          goalTouch(g);
          return goalStep(g);
        }
      }
      // The loop guard says not now (it just failed the same way and nothing changed): a short wait instead.
      // Once a fix step has been done, something HAS changed, so he tries again
      const fixDone = task.fixed && g.stages[g.stage].tasks.some(x => x.isFix && x.fixFor === task.do && x.status !== 'todo');
      if (typeof canTry === 'function' && !canTry(key) && task.tries > 0 && !(fixDone && !(typeof activityCoolingDown === 'function' && activityCoolingDown(key)))) { goalBlock(g, { type: 'time', label: `a better moment for ${label}`, until: Date.now() + 6 * 60000 }, { quiet: true }); return 'waiting'; }
      goalRunning = g.id;
      task.tries++;
      g.lastWorkAt = Date.now();
      const run = () => action.run(task, g);
      let result;
      try { result = typeof tryActivity === 'function' ? tryActivity(key, run) : run(); }
      catch (e) { goalRunning = null; console.warn('Goal step failed:', e); goalAfterStep(g, task, label, 'error'); return 'error'; }
      return Promise.resolve(result).then(r => { goalAfterStep(g, task, label, r); return r === false || r === null ? false : (typeof r === 'string' ? 'waiting' : true); },
        e => { console.warn('Goal step failed:', e); goalAfterStep(g, task, label, 'error'); return 'error'; })
        .finally(() => { goalRunning = null; goalsRenderSoon(); });
    }

// A failure's fix as a goal step (or null when there's nothing different to do)
function goalFixTask(fix, task, g) {
      const topic = task.topic || task.label || (GOAL_ACTIONS[task.do] && GOAL_ACTIONS[task.do].label(task)) || g.title;
      if (fix.kind === 'learn' || fix.kind === 'prepare') return { do: 'research', topic: `how to ${String(topic).replace(/^(how to|learn to)\s+/i, '')}`.slice(0, 80), label: `read up on ${String(topic).toLowerCase()}` };
      if (fix.kind === 'practise' && task.do !== 'practise' && task.skill) return { do: 'practise', match: task.skill };
      if (fix.kind === 'mail') return { do: 'mail' };
      if (fix.kind === 'order') return Array.isArray(task.items) && task.items.length ? { do: 'ask', items: task.items } : { do: 'mail' };
      if (fix.kind === 'weather') return { do: 'waitfor', cond: 'calm', label: 'wait for calmer weather' };
      if (fix.kind === 'wait') return { do: 'waitfor', cond: 'time', until: Date.now() + 25 * 60000, label: 'give it some time' };
      return null;
    }

function goalAfterStep(g, task, label, r) {
      if (g.status === 'done' || g.status === 'abandoned') return;
      const ok = !(r === false || r === null || typeof r === 'string');
      // Did the fix he chose get him past it? He remembers, so next time he picks the fix that works
      if (task.appliedFix && !task.fixJudged && (ok || typeof r === 'string') && typeof outcomeFixResult === 'function') { task.fixJudged = true; outcomeFixResult(task.appliedFix.reason, task.appliedFix.kind, ok); }
      if (ok) {
        task.status = 'done';
        task.doneAt = Date.now();
        g.lastWorkDay = goalDay();
        if (!g.workDays.includes(g.lastWorkDay)) { g.workDays.push(g.lastWorkDay); if (g.workDays.length > 30) g.workDays.shift(); }
        if (!task.isFix && !task.quietDone) goalDiary(g, goalStepLine(g, label), `${g.emoji} ${g.title}`);
        if (goalAdvance(g)) {
          // Something else for a while: a goal is a thread through his days, not all he does
          goalBlock(g, { type: 'time', label: 'a breather before the next step', until: Date.now() + GOAL_BREAK_MS * (0.7 + Math.random() * 0.6) }, { quiet: true });
        }
        goalTouch(g);
        return;
      }
      // Didn't start (busy, nothing to do): try again a little later without counting it against him
      if (r === false || r === null) { task.tries = Math.max(0, task.tries - 1); goalBlock(g, { type: 'time', label: `another go at ${label}`, until: Date.now() + 4 * 60000 }, { quiet: true }); return; }
      task.lastResult = String(r).slice(0, 30);
      if (task.tries >= GOAL_STEP_TRIES) {
        const why = (typeof OUTCOME_REASONS !== 'undefined' && OUTCOME_REASONS[r] && OUTCOME_REASONS[r].why) || `it kept not working (${String(r).replace(/-/g, ' ')})`;
        task.status = 'skipped';
        goalDiary(g, `I tried ${label} ${task.tries} times for ${g.title.toLowerCase()}, but ${why}. I'm leaving that step out and carrying on with the rest instead of trying the same thing again.`, `↪️ ${g.title}: a different way`);
        if (!goalAdvance(g)) return;
        goalTouch(g);
        return;
      }
      // Blocked for a reason: wait for what would change it (the delivery, the know-how...) or a while
      const action = GOAL_ACTIONS[task.do];
      let b = null;
      try { b = action && typeof action.blocker === 'function' ? action.blocker(task, g) : null; } catch (e) {}
      goalBlock(g, b || { type: 'time', label: `another try at ${label}`, until: Date.now() + 12 * 60000 }, { quiet: !b });
    }

// --- Picking and ticking --------------------------------------------------------------------------------
function goalsMaybePick() {
      const gs = goalsState();
      if (goalsOpen().length >= GOALS_MAX_OPEN) return null;
      if (gs.lastPickAt && Date.now() - gs.lastPickAt < GOAL_PICK_GAP_MS * (goalsOpen().length ? 1.5 : 1)) return null;
      if (state.isSleeping) return null;
      const c = goalChoose(goalCandidates());
      if (!c) { gs.lastPickAt = Date.now(); return null; }
      return goalStart(c.id, { params: c.params, source: c.source, sourceText: c.sourceText });
    }

function goalsTick() {
      // Clean up a goal whose agenda task was dropped from outside (the AI's "agenda: drop")
      goalsOpen().forEach(g => {
        const t = g.agendaId && typeof agendaGet === 'function' ? agendaState().tasks.find(x => x.id === g.agendaId) : null;
        if (t && t.status === 'abandoned') goalAbandon(g, t.droppedWhy || 'I changed my mind');
        if (!t && typeof agendaAdd === 'function') {
          const nt = agendaAdd({ ref: 'goal:' + g.id, kind: 'goal', title: g.title, why: g.why, emoji: g.emoji, steps: g.stages.map(s => s.name), priority: 2, data: { goalId: g.id }, quiet: true });
          g.agendaId = nt && nt.id;
        }
      });
      goalsMaybePick();
    }

// --- For the brains -------------------------------------------------------------------------------------
function goalLine(g) {
      const st = g.stages[g.stage];
      const task = goalCurrentTask(g);
      const next = task && GOAL_ACTIONS[task.do] ? GOAL_ACTIONS[task.do].label(task) : '';
      return `[${goalTag(g)}] ${g.title} (${Math.round(goalProgress(g) * 100)}%, stage ${Math.min(g.stages.length, g.stage + 1)}/${g.stages.length} ${st ? st.name : ''}${next ? `, next: ${next}` : ''}${g.blocker ? `, waiting for ${g.blocker.label}` : ''})`;
    }

function goalsSummaryForAI() {
      const open = goalsOpen();
      return open.length ? open.map(goalLine).join('; ') : 'none';
    }

function goalIdeasForAI() {
      return goalCandidates().slice(0, 3).map(c => {
        const tp = GOAL_TEMPLATES[c.id];
        return `"${c.id}": ${typeof tp.title === 'function' ? tp.title(c.params) : tp.title}`;
      }).join('; ') || 'none';
    }

// The AI's "newGoal": "<template id>" (only from the ideas it was shown, and only if he has room)
function applyGoalDecision(decision) {
      const id = decision && typeof decision.newGoal === 'string' ? decision.newGoal.trim().replace(/^"|"$/g, '') : '';
      if (!id || !GOAL_TEMPLATES[id]) return null;
      const c = goalCandidates().find(x => x.id === id);
      if (!c) return null;
      return goalStart(id, { params: c.params, source: 'ai', sourceText: '' });
    }

// --- Old saves and reloads ------------------------------------------------------------------------------
function goalsAfterLoad() {
      const gs = goalsState();
      gs.list = gs.list.filter(g => g && typeof g === 'object' && g.id && Array.isArray(g.stages) && (g.status === 'active' || g.status === 'waiting'));
      gs.list.forEach(g => {
        if (!Array.isArray(g.workDays)) g.workDays = [];
        if (!Array.isArray(g.log)) g.log = [];
        if (!Number.isFinite(g.stage)) g.stage = 0;
        g.stages.forEach(s => (s.tasks || []).forEach(t => { if (!['todo', 'done', 'skipped'].includes(t.status)) t.status = 'todo'; }));
        // A step that was running when everything went dark: he picks it up again
        if (g.blocker && g.blocker.type === 'time') { g.blocker = null; g.status = 'active'; }
      });
      gs.history = gs.history.filter(h => h && h.template).slice(0, GOALS_MAX_HISTORY);
    }

// --- The Brain tab: "Long goals" (read-only) ------------------------------------------------------------
let goalsRenderQueued = false;
function goalsRenderSoon() {
      if (goalsRenderQueued) return;
      goalsRenderQueued = true;
      setTimeout(() => { goalsRenderQueued = false; renderGoalsList(); }, 400);
    }

function renderGoalsList() {
      const el = document.getElementById('goalsListContainer');
      if (!el) return;
      const gs = goalsState();
      const badge = document.getElementById('goalsBadge');
      const open = goalsOpen();
      if (badge) badge.textContent = open.length ? `${open.length} open` : 'none';
      const src = { visitor: 'from a visitor', reading: 'from his reading', interest: 'from his interests', self: 'his own idea', ai: 'his own idea' };
      const card = g => {
        const pct = Math.round(goalProgress(g) * 100);
        const task = goalCurrentTask(g);
        const next = task && GOAL_ACTIONS[task.do] ? GOAL_ACTIONS[task.do].label(task) : '';
        return `<div class="brain-card space-y-1.5" data-goal-id="${escapeHtml(g.id)}">
          <div class="flex items-center gap-2"><span class="brain-card-icon" aria-hidden="true">${escapeHtml(g.emoji || '🎯')}</span><span class="brain-card-title flex-1 truncate">${escapeHtml(g.title)}</span><span class="brain-pill ${g.status === 'active' ? 'brain-pill-active' : ''}">${g.status === 'waiting' ? '⏳ Waiting' : '▶ Working on it'}</span></div>
          <div class="brain-bar brain-bar-orange" role="progressbar" aria-label="${escapeHtml(g.title)}: ${pct}%" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
          <div class="brain-card-meta">Stage ${Math.min(g.stages.length, g.stage + 1)} of ${g.stages.length}: ${escapeHtml(g.stages[g.stage] ? g.stages[g.stage].name : '')}${next ? ` · next: ${escapeHtml(next)}` : ''}</div>
          ${g.blocker ? `<div class="brain-card-meta">Waiting for ${escapeHtml(g.blocker.label)}</div>` : ''}
          <div class="brain-card-meta">${escapeHtml(src[g.source] || '')}${g.why ? `: ${escapeHtml(g.why)}` : ''}</div>
        </div>`;
      };
      const hist = gs.history.slice(0, 4).map(h => `<div class="brain-card-meta">${h.status === 'done' ? '🏁' : '🍂'} ${escapeHtml(h.title)}${h.status === 'done' ? '' : ` (set aside: ${escapeHtml(h.why || '')})`}</div>`).join('');
      const html = open.length || hist ? open.map(card).join('') + (hist ? `<div class="brain-card-meta pt-1">Earlier goals</div>${hist}` : '') : '<div class="brain-empty text-xs text-slate-500 italic">No long goals yet.</div>';
      if (typeof perfSetHtml === 'function') perfSetHtml(el, html); else el.innerHTML = html;
    }

if (typeof agendaRegisterKind === 'function') {
  agendaRegisterKind('goal', {
    label: 'Long goal',
    resume: t => goalStep(goalById(t.data && t.data.goalId)),
    check: t => goalAgendaCheck(t)
  });
}

window.addEventListener('DOMContentLoaded', () => {
  // After the save has loaded and the agenda has settled (js/agenda.js runs at 900 ms)
  setTimeout(() => {
    try { goalsAfterLoad(); renderGoalsList(); } catch (e) { console.warn('Goals failed to load:', e); }
    if (!goalTickTimer) goalTickTimer = setInterval(() => { try { goalsTick(); } catch (e) { console.warn('Goal tick failed:', e); } }, GOAL_TICK_MS);
  }, 1300);
});
