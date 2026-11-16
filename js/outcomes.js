// Kelo-bot-1 — js/outcomes.js
// Loaded after agendalinks.js. He LEARNS FROM RESULTS: every activity he tries leaves a short record of
// how it went (worked / blocked / failed, why, how long it took, what it used up, how he felt after),
// and he uses those records:
//   - prefer what worked: outcomeBias(key) nudges how often an activity comes up (js/agent.js life tick,
//     js/procbrain.js, js/goals.js);
//   - never the same failing plan twice: if an activity failed for the same reason and nothing has
//     changed since (same things owned, same season and weather, same skills), outcomeCanTry() says no;
//   - retry differently: a failure's reason maps to a fix (order the missing tool, read up and practise,
//     wait for calmer weather...). The goal planner (js/goals.js) inserts that fix as a step;
//   - his diary says so: "Last time the print came loose from the bed, so I'll level the bed first."
// Bounded in the save: state.outcomes keeps OUTCOME_MAX_LOG records, OUTCOME_MAX_KEYS activity stats and
// OUTCOME_MAX_LESSONS lessons (a few KB at most). Old saves have none and start empty.
// Hooked in from js/loopguard.js (tryActivity), js/agenda.js (agendaWorkOn) and js/goals.js.

const OUTCOME_MAX_LOG = 60;
const OUTCOME_MAX_KEYS = 40;
const OUTCOME_MAX_LESSONS = 20;

// What a blocked activity's reason means, and the different way he tries next time
const OUTCOME_REASONS = {
  'needs-tools': { why: "I didn't have the right tools", fix: 'order the missing tool first and wait for it to arrive', fixKind: 'order' },
  'needs-materials': { why: 'I ran out of materials', fix: 'order the missing materials first', fixKind: 'order' },
  'waiting-for-gear': { why: 'my gear had not come yet', fix: 'check the post office before trying again', fixKind: 'mail' },
  'getting-ready': { why: 'I was not ready: supplies or know-how were missing', fix: 'read up and get the supplies first', fixKind: 'prepare' },
  'learning': { why: 'I still had to learn how', fix: 'read up at NetNode and practise first', fixKind: 'learn' },
  'not-ready': { why: 'I did not know how yet, or it needed fuel', fix: 'read up and practise first', fixKind: 'learn' },
  'too-windy': { why: 'it was too windy', fix: 'wait for a calm day', fixKind: 'weather' },
  'turned-back': { why: 'I had to turn back', fix: 'pick a shorter route and set out earlier', fixKind: 'retry' },
  'test-failed': { why: 'the test failed', fix: 'check each part before testing again', fixKind: 'practise' },
  'needs-service': { why: 'it needed servicing', fix: 'service it in the Workshop first', fixKind: 'prepare' },
  'charging': { why: 'it was still charging', fix: 'let it charge first', fixKind: 'wait' },
  'busy-with-build': { why: 'I was in the middle of a build', fix: 'finish the build first', fixKind: 'wait' },
  'no-plans': { why: 'I had no plans for it', fix: 'look up how it is done first', fixKind: 'learn' },
  'blocked': { why: 'something was in the way', fix: 'try another spot', fixKind: 'retry' },
  'error': { why: 'something went wrong part-way', fix: 'go slower and check each step', fixKind: 'retry' },
  'waiting': { why: 'I was still waiting on something', fix: 'wait until it comes', fixKind: 'wait' }
};

// Different ways to get past each kind of failure, tried in turn; the one that has worked best for that
// reason is chosen first (outcomeFixFor), so he learns which fix really works
const OUTCOME_FIX_ALTS = {
  order: ['order', 'mail', 'wait'], mail: ['mail', 'wait', 'order'], prepare: ['prepare', 'learn', 'wait'], learn: ['learn', 'practise', 'wait'],
  practise: ['practise', 'learn', 'retry'], weather: ['weather', 'wait'], retry: ['retry', 'learn', 'wait'], wait: ['wait', 'retry']
};
const OUTCOME_FIX_WORDS = {
  order: 'order what is missing first', mail: 'check the post office first', prepare: 'get everything ready first', learn: 'read up on it first',
  practise: 'practise first', weather: 'wait for better weather', retry: 'try it a different way', wait: 'give it some time first'
};
const OUTCOME_DECAY = 0.93;          // older results count a little less each time (he adapts when things change)

// Failures some activities keep their own count of (the result alone says "it ran"): a rise in the
// counter means it failed, and the latest lesson says why and what he does differently
const OUTCOME_PROBES = [
  {
    key: 'print',
    count: () => (state.printer && state.printer.fails) || 0,
    lesson: () => {
      const l = state.printer && state.printer.lessons ? Object.entries(state.printer.lessons).sort((a, b) => (b[1].at || 0) - (a[1].at || 0))[0] : null;
      if (!l || typeof PRINT_FAILURES === 'undefined' || !PRINT_FAILURES[l[0]]) return { why: 'the print failed', fix: 'check the printer before the next one' };
      return { why: `the print ${PRINT_FAILURES[l[0]].what.split('.')[0]}`, fix: PRINT_FAILURES[l[0]].lesson };
    }
  }
];

function outcomeState() {
      if (!state.outcomes || typeof state.outcomes !== 'object' || Array.isArray(state.outcomes)) state.outcomes = { log: [], stats: {}, lessons: [] };
      const o = state.outcomes;
      if (!Array.isArray(o.log)) o.log = [];
      if (!o.stats || typeof o.stats !== 'object' || Array.isArray(o.stats)) o.stats = {};
      if (!Array.isArray(o.lessons)) o.lessons = [];
      ['ctx', 'fixes', 'prefs'].forEach(k => { if (!o[k] || typeof o[k] !== 'object' || Array.isArray(o[k])) o[k] = {}; });
      return o;
    }

// A small fingerprint of what could make a retry go differently: what he owns, the season and
// weather, his skills and what is waiting at the post office
function outcomeWorldSig() {
      const owned = typeof ownedItemNames === 'function' ? ownedItemNames().length : 0;
      const skills = Object.values(state.skills || {}).reduce((n, s) => n + (s.level || 0), 0);
      const w = typeof worldNow === 'function' ? worldNow() : { season: '', isNight: false };
      const windy = typeof windSummaryForAI === 'function' ? /strong|gust|gale|storm/i.test(windSummaryForAI()) : false;
      const knows = Object.keys(state.knowHow || {}).length;
      return [owned, skills, knows, (state.mailbox || []).length, w.season, w.isNight ? 'n' : 'd', windy ? 'w' : 'c'].join('|');
    }

// The circumstances an attempt happened in: he learns what works WHEN (night or day, the season, tired
// or rested, windy or calm), not just what works
function outcomeContext() {
      const w = typeof worldNow === 'function' ? worldNow() : { season: '', isNight: false };
      const windy = typeof windSummaryForAI === 'function' ? /strong|gust|gale|storm/i.test(windSummaryForAI()) : false;
      return { season: w.season || '?', time: w.isNight ? 'night' : 'day', energy: (state.health || 0) < 40 || (state.fullness || 0) < 35 ? 'tired' : 'rested', wind: windy ? 'windy' : 'calm' };
    }
const OUTCOME_CTX_WORDS = { night: 'at night', day: 'in the daytime', tired: 'when I am tired or hungry', rested: 'when I am rested', windy: 'in the wind', calm: 'on calm days', Winter: 'in winter', Spring: 'in spring', Summer: 'in summer', Autumn: 'in autumn' };

function outcomeSuppliesTotal() {
      let n = 0;
      Object.values(state.supplies || {}).forEach(s => { if (s && Number.isFinite(s.cur)) n += s.cur; });
      return n;
    }

// Taken just before an activity starts
function outcomeSnapshot(key) {
      return {
        key, at: Date.now(), mood: state.happiness, ctx: outcomeContext(), owned: typeof ownedItemNames === 'function' ? ownedItemNames().length : 0,
        supplies: outcomeSuppliesTotal(), probes: OUTCOME_PROBES.filter(p => p.key === key).map(p => p.count())
      };
    }

function outcomeLabel(key) {
      const labels = {
        skill: 'practising a skill', dig: 'digging', garden: 'tending the garden', project: 'a building project', assembly: 'a big build',
        plant: 'running the plant', shop: 'my shop', print: '3D printing', workshop: 'the Workshop', shopmaker: 'making something I read about',
        gadget: 'a gadget', paint: 'painting', codewish: 'a wish for my world', landscape: 'shaping the valley', stargaze: 'stargazing',
        boat: 'boating', wade: 'wading in the lake', ice: 'the frozen lake', repair: 'repairing the balloon', balloon: 'a balloon flight',
        fire: 'a campfire', hobby: 'a hobby', mail: 'the mail', browse: 'reading at NetNode', dispose: 'clearing out junk'
      };
      if (labels[key]) return labels[key];
      return String(key || 'something').replace(/^(goal|agenda):/, '').replace(/[-_]/g, ' ');
    }

// Judge how it went and keep the record. `result` is what the activity returned (true/undefined: it
// ran; a string: blocked for that reason; false/null: it didn't start); `error` if it threw.
function outcomeRecord(snap, result, error = null, extra = {}) {
      if (!snap || !snap.key) return null;
      const o = outcomeState();
      const key = String(snap.key).slice(0, 40);
      let ok = true, reason = '', why = '', fix = '';
      if (error) { ok = false; reason = 'error'; }
      else if (typeof result === 'string') { ok = false; reason = result.slice(0, 30); }
      else if (result === false || result === null) { ok = null; reason = 'did-not-start'; }
      // An activity that ran but counts its own failures (a print that came loose)
      OUTCOME_PROBES.filter(p => p.key === key).forEach((p, i) => {
        if (ok === false) return;
        const before = snap.probes[i];
        if (Number.isFinite(before) && p.count() > before) { ok = false; reason = 'probe'; const l = p.lesson(); why = l.why; fix = l.fix; }
      });
      if (ok === false && !why) { const r = OUTCOME_REASONS[reason] || {}; why = r.why || `it didn't work out (${reason.replace(/-/g, ' ')})`; fix = r.fix || 'try it a different way'; }
      const rec = {
        key, ok, reason, at: Date.now(), ms: Math.max(0, Date.now() - snap.at),
        spent: Math.max(0, Math.round((snap.supplies - outcomeSuppliesTotal()) * 10) / 10),
        lost: Math.max(0, snap.owned - (typeof ownedItemNames === 'function' ? ownedItemNames().length : 0)),
        mood: Math.round((state.happiness || 0) - (snap.mood || 0)), goal: extra.goal || null, sig: outcomeWorldSig()
      };
      if (why) rec.why = why.slice(0, 120);
      if (fix) rec.fix = fix.slice(0, 140);
      o.log.unshift(rec);
      if (o.log.length > OUTCOME_MAX_LOG) o.log.length = OUTCOME_MAX_LOG;
      // Per-activity tallies (a "did not start" counts as neither)
      const s = o.stats[key] || (o.stats[key] = { n: 0, ok: 0, fail: 0, streak: 0, ms: 0, mood: 0 });
      if (ok !== null) {
        // Recent results weigh more than old ones, so when his world changes he changes his mind
        s.n = s.n * OUTCOME_DECAY + 1;
        s.ok = s.ok * OUTCOME_DECAY + (ok ? 1 : 0);
        s.fail = s.fail * OUTCOME_DECAY + (ok ? 0 : 1);
        s.tries = (s.tries || 0) + 1;
        if (ok) { s.streak = 0; s.lastOkAt = rec.at; }
        else { s.streak = (s.lastReason === reason ? s.streak : 0) + 1; s.lastReason = reason; s.lastFailAt = rec.at; s.failSig = rec.sig; s.why = rec.why; s.fix = rec.fix; }
        s.ms = Math.round(s.ms ? s.ms * 0.7 + rec.ms * 0.3 : rec.ms);
        s.mood = Math.round((s.mood * 0.7 + rec.mood * 0.3) * 10) / 10;
      }
      s.lastAt = rec.at;
      if (ok !== null) { outcomeLearnContext(key, snap.ctx || outcomeContext(), ok); outcomeNoticePreference(key, s); }
      const keys = Object.keys(o.stats);
      if (keys.length > OUTCOME_MAX_KEYS) keys.sort((a, b) => (o.stats[a].lastAt || 0) - (o.stats[b].lastAt || 0)).slice(0, keys.length - OUTCOME_MAX_KEYS).forEach(k => delete o.stats[k]);
      // A failure becomes a lesson he can quote; a success after a failure confirms the fix worked
      if (ok === false) outcomeAddLesson({ key, why: rec.why, fix: rec.fix, reason, at: rec.at });
      if (ok === true) {
        const l = o.lessons.find(x => x.key === key && !x.worked);
        if (l) { l.worked = rec.at; outcomeDiary(`It worked this time! Last time ${l.why}, so I made sure to ${l.fix}, and ${outcomeLabel(key)} went fine.`, '✅ It worked this time'); }
      }
      return rec;
    }

function outcomeAddLesson(l) {
      const o = outcomeState();
      const same = o.lessons.find(x => x.key === l.key && x.why === l.why);
      if (same) { same.at = l.at; same.times = (same.times || 1) + 1; same.worked = null; return same; }
      o.lessons.unshift({ key: l.key, why: String(l.why || '').slice(0, 120), fix: String(l.fix || '').slice(0, 140), reason: l.reason, at: l.at, times: 1, worked: null });
      if (o.lessons.length > OUTCOME_MAX_LESSONS) o.lessons.length = OUTCOME_MAX_LESSONS;
      return o.lessons[0];
    }

function outcomeDiary(text, mood) {
      if (!Array.isArray(state.diaryEntries)) return;
      state.diaryEntries.unshift({
        time: 'Learning From It', location: typeof currentPlaceLabel === 'function' ? currentPlaceLabel() : '',
        mood: String(mood || '🧠 What I learned').slice(0, 80), vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, ${text}`.slice(0, 400), lesson: true
      });
    }

// Per circumstance tallies for each activity (one tally per feature value, so a few tries are enough
// to see a pattern): o.ctx[key][feature:value] = { n, ok }
function outcomeLearnContext(key, ctx, ok) {
      const o = outcomeState();
      const c = o.ctx[key] || (o.ctx[key] = {});
      Object.entries(ctx || {}).forEach(([f, v]) => {
        const k = `${f}:${v}`;
        const t = c[k] || (c[k] = { n: 0, ok: 0 });
        t.n = Math.round((t.n * OUTCOME_DECAY + 1) * 100) / 100;
        t.ok = Math.round((t.ok * OUTCOME_DECAY + (ok ? 1 : 0)) * 100) / 100;
      });
      // A pattern he hasn't noticed before becomes a diary line ("painting goes badly at night")
      const insight = outcomeContextInsight(key);
      if (insight && !(o.prefs[`ctx:${key}:${insight.k}`])) {
        o.prefs[`ctx:${key}:${insight.k}`] = Date.now();
        outcomeDiary(`I've noticed a pattern: ${outcomeLabel(key)} ${insight.good ? 'goes well' : 'tends to go wrong'} ${OUTCOME_CTX_WORDS[insight.v] || insight.v}. ${insight.good ? "I'll lean into that." : "I'll pick a better moment for it."}`, `🧠 Learned when ${outcomeLabel(key)} works`);
      }
      const ks = Object.keys(o.ctx);
      if (ks.length > OUTCOME_MAX_KEYS) ks.filter(k => !o.stats[k]).forEach(k => delete o.ctx[k]);
    }

// The strongest circumstance effect for an activity: { k, v, good, lift } or null
function outcomeContextInsight(key) {
      const s = outcomeState().stats[key], c = outcomeState().ctx[key];
      if (!s || !c || s.n < 3) return null;
      const base = (s.ok + 1) / (s.n + 2);
      let best = null;
      Object.entries(c).forEach(([k, t]) => {
        if (t.n < 2.5) return;
        const rate = (t.ok + 0.5) / (t.n + 1);
        const lift = rate - base;
        if (Math.abs(lift) >= 0.3 && (!best || Math.abs(lift) > Math.abs(best.lift))) best = { k, v: k.split(':')[1], good: lift > 0, lift };
      });
      return best;
    }

// How the current circumstances change his odds, from what he has seen: a factor around 1
function outcomeContextFactor(key, ctx = outcomeContext()) {
      const s = outcomeState().stats[key], c = outcomeState().ctx[key];
      if (!s || !c || s.n < 2) return 1;
      const base = (s.ok + 1) / (s.n + 2);
      let f = 1;
      Object.entries(ctx).forEach(([feat, v]) => {
        const t = c[`${feat}:${v}`];
        if (!t || t.n < 1.5) return;
        const rate = (t.ok + base) / (t.n + 1);   // shrunk towards his overall rate
        f *= Math.max(0.4, Math.min(1.8, rate / Math.max(0.05, base)));
      });
      return Math.max(0.3, Math.min(2, f));
    }

// He notices what he enjoys and what he doesn't (once each), and it shapes what he picks
function outcomeNoticePreference(key, s) {
      const o = outcomeState();
      // (chores like the mail or tidying are just chores: no likes or dislikes)
      if (s.n < 4 || o.prefs[key] || ['mail', 'garden', 'dispose', 'ask', 'reflect', 'tidy'].includes(key)) return;
      const rate = s.ok / s.n;
      if (s.mood >= 3 && rate >= 0.6) { o.prefs[key] = 'likes'; outcomeDiary(`I've noticed something about myself: I really enjoy ${outcomeLabel(key)}. It usually works out and it lifts my mood.`, `💛 I like ${outcomeLabel(key)}`); }
      else if (s.mood <= -3 || rate <= 0.25) { o.prefs[key] = 'dislikes'; outcomeDiary(`Honestly, ${outcomeLabel(key)} rarely goes well for me${s.mood <= -3 ? ' and leaves me grumpy' : ''}. I'll do it less, or find a better way.`, `🌧️ Not my favourite: ${outcomeLabel(key)}`); }
    }

// Which fix got him past this kind of failure before: o.fixes[reason][kind] = { n, ok }
function outcomeFixResult(reason, kind, ok) {
      if (!reason || !kind) return;
      const o = outcomeState();
      const r = o.fixes[reason] || (o.fixes[reason] = {});
      const t = r[kind] || (r[kind] = { n: 0, ok: 0 });
      t.n++; if (ok) t.ok++;
      if (Object.keys(o.fixes).length > 24) delete o.fixes[Object.keys(o.fixes)[0]];
    }

// --- Using what he learned ------------------------------------------------------------------------------
// Never the same failing plan twice: it failed (twice in a row for the same reason, or once for a reason
// nothing has fixed yet) and his world hasn't changed since. A blocked-and-waiting reason is left to
// the loop guard's cooldown.
function outcomeCanTry(key) {
      const s = outcomeState().stats[key];
      if (!s || !s.fail || !s.lastFailAt || (s.lastOkAt || 0) > s.lastFailAt) return true;
      if (Date.now() - s.lastFailAt > 3 * 3600000) return true;   // a few hours on, worth another look
      const sameWorld = s.failSig === outcomeWorldSig();
      const needsChange = ['needs-tools', 'needs-materials', 'too-windy', 'no-plans', 'not-ready', 'learning'].includes(s.lastReason);
      return !(sameWorld && (needsChange || s.streak >= 2));
    }

// How much he leans towards an activity from how it went before: 0.35 (keeps failing) .. 1.6 (works
// and he enjoys it). 1 when he has never tried it.
function outcomeBias(key) {
      const o = outcomeState();
      const s = o.stats[key];
      if (!s || !s.n) return 1.15;              // never tried: a little pull to find out
      const rate = (s.ok + 1) / (s.n + 2);
      let b = 0.5 + rate;                       // 0.5 .. 1.5
      if (s.mood > 2) b += 0.1; else if (s.mood < -2) b -= 0.1;
      if (o.prefs[key] === 'likes') b += 0.15; else if (o.prefs[key] === 'dislikes') b -= 0.15;
      b *= outcomeContextFactor(key);           // what works WHEN: night, season, tired, wind
      b += 0.25 / Math.sqrt((s.tries || s.n) + 1);   // keep exploring what he has rarely tried
      if (s.streak >= 2) b *= 0.6;
      return Math.max(0.3, Math.min(1.8, b));
    }

// Before he tries something that went wrong last time: a diary line saying what he'll do differently.
// Once per lesson per few hours, so the diary isn't the same note again and again.
function outcomeBeforeTry(key) {
      const l = outcomeState().lessons.find(x => x.key === key && !x.worked);
      if (!l || (l.saidAt && Date.now() - l.saidAt < 2 * 3600000)) return null;
      l.saidAt = Date.now();
      const openers = ['Last time', 'The last time I tried', 'Before,', 'When I tried this before,'];
      const opener = openers[(l.times || 1) % openers.length];
      outcomeDiary(`${opener} ${l.why}, so this time I'll ${l.fix}.`, `🔁 Trying ${outcomeLabel(key)} differently`);
      return l;
    }

// The fix for the latest failure of this activity, for the goal planner: { kind, fix, why } or null
function outcomeFixFor(key) {
      const s = outcomeState().stats[key];
      if (!s || !s.fail || (s.lastOkAt || 0) > (s.lastFailAt || 0)) return null;
      const r = OUTCOME_REASONS[s.lastReason] || {};
      const first = r.fixKind || 'retry';
      // The fix that has worked best for this kind of failure (an untried one gets a fair chance)
      const tried = outcomeState().fixes[s.lastReason] || {};
      const alts = OUTCOME_FIX_ALTS[first] || [first];
      const score = k => { const t = tried[k]; return t ? (t.ok + 1) / (t.n + 2) : (k === first ? 0.6 : 0.5); };
      const kind = alts.slice().sort((a, b) => score(b) - score(a))[0];
      const fix = kind === first ? (s.fix || r.fix || OUTCOME_FIX_WORDS[kind]) : OUTCOME_FIX_WORDS[kind];
      return { kind, fix: fix || 'try it differently', why: s.why || r.why || 'it did not work', reason: s.lastReason, learned: kind !== first };
    }

// Things he can simply go and do (the same calls his life tick makes), for picking a learned favourite
const OUTCOME_RUNNERS = {
  paint: () => typeof paintOnMyOwn === 'function' && paintOnMyOwn(),
  print: () => typeof printOnMyOwn === 'function' && printOnMyOwn(),
  stargaze: () => typeof stargaze === 'function' && stargaze('A Favourite'),
  hobby: () => typeof practiceHobby === 'function' && (state.hobbies || []).length && practiceHobby(pickHobbyToPractise(), 'A Favourite'),
  skill: () => typeof practiseSkill === 'function' && typeof pickSkillToPractise === 'function' && practiseSkill(pickSkillToPractise()),
  browse: () => typeof browseInternet === 'function' && browseInternet(null, 'A Favourite'),
  landscape: () => typeof shapeTheValleyOnMyOwn === 'function' && shapeTheValleyOnMyOwn(),
  workshop: () => typeof workshopOnMyOwn === 'function' && workshopOnMyOwn(),
  boat: () => typeof goBoating === 'function' && typeof findVehicle === 'function' && findVehicle('boat') && goBoating('A Favourite')
};

// Now and then he goes for what he has LEARNED suits this moment: an activity that works well in these
// circumstances (night, season, rested, calm) and that he enjoys. Null when nothing stands out.
function outcomeFavouriteNow() {
      const o = outcomeState();
      const cands = Object.keys(OUTCOME_RUNNERS).map(k => {
        const s = o.stats[k];
        if (!s || s.n < 2.5 || o.prefs[k] === 'dislikes') return null;
        if (typeof canTry === 'function' && !canTry(k)) return null;
        const b = outcomeBias(k) * (o.prefs[k] === 'likes' ? 1.2 : 1);
        return b >= 1.3 ? { key: k, w: b, run: OUTCOME_RUNNERS[k] } : null;
      }).filter(Boolean);
      if (!cands.length || Math.random() > 0.25) return null;
      let r = Math.random() * cands.reduce((t, c) => t + c.w, 0);
      for (const c of cands) { r -= c.w; if (r <= 0) return c; }
      return cands[0];
    }

// For the AI prompt and the relevance ranker (js/brainrank.js): one line per lesson or habit
function outcomeLinesForAI() {
      const o = outcomeState();
      const lines = [];
      o.lessons.slice(0, 8).forEach(l => lines.push({ key: l.key, text: `${outcomeLabel(l.key)}: last time ${l.why}${l.worked ? `; ${l.fix} worked` : `; next time ${l.fix}`}`, at: l.at }));
      Object.keys(o.stats).forEach(k => { const i = outcomeContextInsight(k); if (i) lines.push({ key: k, text: `${outcomeLabel(k)} ${i.good ? 'goes well' : 'tends to go wrong'} ${OUTCOME_CTX_WORDS[i.v] || i.v}`, at: o.stats[k].lastAt }); });
      Object.entries(o.prefs).filter(([k, v]) => v === 'likes' || v === 'dislikes').slice(0, 4).forEach(([k, v]) => lines.push({ key: k, text: `you ${v === 'likes' ? 'enjoy' : 'do not much enjoy'} ${outcomeLabel(k)}`, at: 0 }));
      Object.entries(o.stats).filter(([, s]) => s.n >= 2 && s.ok / s.n >= 0.7).slice(0, 6)
        .forEach(([k, s]) => lines.push({ key: k, text: `${outcomeLabel(k)} usually goes well (${Math.round(s.ok / s.n * 100)}%)${s.mood > 2 ? ' and makes you happy' : ''}`, at: s.lastAt }));
      return lines;
    }

function outcomeSummaryForAI() {
      const lines = outcomeLinesForAI();
      return lines.length ? lines.map(l => l.text).join('; ') : 'nothing yet';
    }

// The Brain tab card: what he learned from results (read-only)
function renderOutcomesList() {
      const el = document.getElementById('outcomesListContainer');
      if (!el) return;
      const o = outcomeState();
      const badge = document.getElementById('outcomesBadge');
      if (badge) badge.textContent = String(o.lessons.length);
      const stats = Object.entries(o.stats).filter(([, s]) => s.n).sort((a, b) => (b[1].lastAt || 0) - (a[1].lastAt || 0)).slice(0, 8);
      const html = (o.lessons.length ? o.lessons.slice(0, 6).map(l => `<div class="brain-card space-y-1"><div class="brain-card-title">${l.worked ? '✅' : '🔁'} ${escapeHtml(outcomeLabel(l.key))}</div><div class="brain-card-meta">Last time ${escapeHtml(l.why)}; ${l.worked ? 'what worked' : 'next time'}: ${escapeHtml(l.fix)}${(l.times || 1) > 1 ? ` (${l.times}×)` : ''}</div></div>`).join('') : '')
        + (stats.length ? `<div class="brain-card-meta pt-1">How things have gone</div>` + stats.map(([k, s]) => `<div class="brain-card-meta">${escapeHtml(outcomeLabel(k))}: ${Math.round(s.ok / s.n * 100)}% went well recently${o.prefs[k] === 'likes' ? ' 💛' : ''}</div>`).join('') : '');
      const out = html || '<div class="brain-empty text-xs text-slate-500 italic">Nothing learned from results yet.</div>';
      if (typeof perfSetHtml === 'function') perfSetHtml(el, out); else el.innerHTML = out;
    }

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { try { outcomeState(); renderOutcomesList(); } catch (e) {} }, 1200);
  setInterval(() => { try { renderOutcomesList(); } catch (e) {} }, 15000);
});
