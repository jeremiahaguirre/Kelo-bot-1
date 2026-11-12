// Kelo-bot-1 — js/loopguard.js
// Loaded right after agent.js. Keeps Kelo-1 out of decision loops:
//   - He never picks the same kind of activity three times in a row.
//   - Something that can't happen yet (no tools, no fuel, still waiting on a delivery, too windy...)
//     gets a cooldown instead of being retried, and re-announced, on every tick.
//   - His recent decisions are remembered, so neither the AI nor his own brain repeats or rephrases
//     the same plan over and over, and replays of old AI ideas rotate instead of repeating.

const ACTIVITY_COOLDOWN_MS = 15 * 60 * 1000; // a job that's blocked waits this long before he tries again
const QUICK_COOLDOWN_MS = 4 * 60 * 1000;     // a job that just didn't start (busy, nothing to do)
const recentActivities = [];                 // this session only
let currentActivityKey = null;               // the activity running now (a walk that can't get there cools it down, js/scene.js)

function activityCoolingDown(key) {
      const until = state.activityCooldowns && state.activityCooldowns[key];
      // No cooldown is longer than half an hour: one ending later than an hour from now was saved under a
      // clock that has since been set back, and would block the activity until the clock caught up
      return Boolean(until && Date.now() < until && until - Date.now() < 60 * 60 * 1000);
    }

// May he try this kind of activity now?
function canTry(key) {
      if (activityCoolingDown(key)) return false;
      const lastTwo = recentActivities.slice(-2);
      return !(lastTwo.length === 2 && lastTwo.every(k => k === key));
    }

function coolDownActivity(key, ms = ACTIVITY_COOLDOWN_MS) {
      if (!state.activityCooldowns || typeof state.activityCooldowns !== 'object') state.activityCooldowns = {};
      state.activityCooldowns[key] = Date.now() + ms;
      // Old entries don't pile up
      Object.keys(state.activityCooldowns).forEach(k => { if (state.activityCooldowns[k] < Date.now()) delete state.activityCooldowns[k]; });
    }

// Run an activity and judge how it went: a reason string ('needs-tools', 'getting-ready'...) means it's
// blocked for a while; false/null means it simply didn't start, so a short pause.
function tryActivity(key, fn) {
      recentActivities.push(key);
      currentActivityKey = key;
      if (recentActivities.length > 12) recentActivities.shift();
      let result;
      try { result = fn(); } catch (e) { coolDownActivity(key, QUICK_COOLDOWN_MS); throw e; }
      Promise.resolve(result).finally(() => { if (currentActivityKey === key) currentActivityKey = null; }).catch(() => {});
      Promise.resolve(result).then(r => {
        if (typeof r === 'string') {
          coolDownActivity(key, ACTIVITY_COOLDOWN_MS);
          // Something that keeps stopping him can turn into a code request (js/coderequests.js)
          if (typeof noteBlockedActivity === 'function') noteBlockedActivity(key, r);
        }
        else if (r === false || r === null) coolDownActivity(key, QUICK_COOLDOWN_MS);
      }).catch(() => coolDownActivity(key, QUICK_COOLDOWN_MS));
      return result;
    }

// --- Decisions --------------------------------------------------------------------------------------
function decisionWords(title) {
      return new Set(String(title || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
        .filter(w => w.length > 2 && !['the', 'and', 'for', 'with', 'his', 'into', 'from', 'some', 'more'].includes(w)));
    }

function similarTitles(a, b) {
      const A = decisionWords(a), B = decisionWords(b);
      if (!A.size || !B.size) return false;
      let shared = 0;
      A.forEach(w => { if (B.has(w)) shared++; });
      return shared / Math.min(A.size, B.size) >= 0.6;
    }

function isRepeatDecision(decision) {
      const title = decision && decision.actionTitle;
      return Boolean(title) && (state.recentDecisionTitles || []).slice(0, 6).some(t => similarTitles(t, title));
    }

function noteDecision(title) {
      if (!title) return;
      if (!Array.isArray(state.recentDecisionTitles)) state.recentDecisionTitles = [];
      state.recentDecisionTitles = [String(title).slice(0, 80), ...state.recentDecisionTitles].slice(0, 10);
    }

function recentDecisionsForAI() {
      const list = (state.recentDecisionTitles || []).slice(0, 6);
      return list.length ? list.map(t => `"${t}"`).join(', ') : 'none yet';
    }
