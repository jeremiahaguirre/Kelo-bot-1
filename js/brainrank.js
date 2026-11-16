// Kelo-bot-1 — js/brainrank.js
// Loaded after js/goaltemplates.js. SMARTER MEMORY for the AI brain: instead of sending every live state
// line on every decision (about 5,300 tokens, see REPORT.md on qa-results-brainprompt), the decision
// prompt (js/agent.js generateLLMDecision) now sends:
//   - a short CORE that is always there: vitals and body, place and time, what prompted him, his focus
//     and long goals, recent decisions, the welding rule and the world/town bounds;
//   - the most RELEVANT of everything else, ranked against the current situation (needs, time of day,
//     season, place, his active goal and task, the trigger) within BRAIN_CONTEXT_BUDGET tokens. Ranked
//     items: diary entries, core memories, mail, open tasks, skills, lessons from results, nearby places,
//     his things, and each subsystem's summary line (vehicles, plant, garden, roads...);
//   - one line naming what was left out, so the model knows it exists.
// brainLastContextStats keeps what the last prompt held (for the tests and the Brain tab).
// Untrusted text (diary, mail, memories) stays fenced with brainUntrusted() exactly as before.

const BRAIN_CONTEXT_BUDGET = 900;   // tokens (chars / 4) for the ranked part of the decision prompt
const brainTok = s => Math.ceil(String(s || '').length / 4);
let brainLastContextStats = null;

const BRAIN_STOP = new Set('the a an and or of to in on at for with is are was were be been am i you he she it we they me my your our his her its this that these those from into over under about just very some any all not no yes so as by up out what when then than there here have has had do did done will would can could should one two'.split(' '));

function brainWords(text) {
      const out = new Set();
      String(text || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).forEach(w => {
        if (w.length < 3 || BRAIN_STOP.has(w)) return;
        out.add(w.length > 5 ? w.slice(0, 5) : w);   // a crude stem: paint/painting/painted meet
      });
      return out;
    }

// What matters right now, as a bag of words with weights
function brainSituation(trigger) {
      const words = new Map();
      const add = (text, w) => brainWords(text).forEach(x => words.set(x, Math.max(words.get(x) || 0, w)));
      const now = typeof worldNow === 'function' ? worldNow() : null;
      if (trigger) add(trigger, 3);
      const focus = typeof agendaFocus === 'function' ? agendaFocus() : null;
      if (focus) add(`${focus.title} ${typeof agendaStepLabel === 'function' ? agendaStepLabel(focus) : ''} ${focus.waitingFor ? focus.waitingFor.label : ''}`, 2.5);
      (typeof goalsOpen === 'function' ? goalsOpen() : []).forEach(g => {
        const t = goalCurrentTask(g);
        add(`${g.title} ${t && GOAL_ACTIONS[t.do] ? GOAL_ACTIONS[t.do].label(t) : ''} ${g.blocker ? g.blocker.label : ''}`, 2);
      });
      if (state.fullness < 45) add('food eat hungry fruit meal peach apple bread kitchen garden harvest', 3);
      if (state.hydration < 45) add('water drink thirsty lake', 3);
      if (state.health < 35) add('sleep bed rest tired energy', 3);
      if (now) {
        if (now.isNight) add('night stars telescope moon sleep dark campfire', 1.5); else add('day sun light', 0.5);
        add(`${now.season} ${{ Winter: 'snow ice frozen cold skis snowmobile', Spring: 'rain plant seeds grow', Summer: 'sun swim boat lake', Autumn: 'leaves harvest wind' }[now.season] || ''}`, 1);
      }
      add(typeof currentPlaceLabel === 'function' ? currentPlaceLabel() : '', 1.2);
      if ((state.mailbox || []).length) add('mail post office parcel delivery', 1.5);
      if (state.unstoredItems && state.unstoredItems.length) add('storehouse put away', 1);
      return words;
    }

function brainRelevance(text, sit) {
      const w = brainWords(text);
      if (!w.size) return 0;
      let s = 0;
      w.forEach(x => { if (sit.has(x)) s += sit.get(x); });
      return s / Math.sqrt(w.size);
    }

// Everything that could go into the prompt besides the core: { cat, text, base, boost, at, untrusted }
function brainCandidates() {
      const out = [];
      const S = (fn, ...a) => { try { return typeof window[fn] === 'function' ? window[fn](...a) : null; } catch (e) { return null; } };
      const line = (cat, label, val, base = 0.4, extra = {}) => { if (val && !/^(none|nothing yet|unknown|empty|none yet|nothing extra yet|no digs yet)$/i.test(String(val).trim())) out.push({ cat, text: `${label}: ${val}`, base, ...extra }); };
      const now = typeof worldNow === 'function' ? worldNow() : { season: '', isNight: false };
      // Memories: each diary entry, core memory and piece of mail is its own item
      (state.diaryEntries || []).slice(0, 14).forEach((d, i) => out.push({ cat: 'diary', text: String(d.text || '').replace(/^Dear Diary,\s*/i, '').slice(0, 220), base: 0.9 - i * 0.06, untrusted: true }));
      (state.coreMemories || []).slice(0, 12).forEach((m, i) => out.push({ cat: 'core', text: String(m.text || '').slice(0, 200), base: 0.7 - i * 0.04, untrusted: true }));
      (state.mailbox || []).slice(0, 8).forEach(m => out.push({ cat: 'mail', text: `${m.kind} from ${m.from}${m.name ? `: ${m.name}` : ''}`.slice(0, 120), base: 0.8, untrusted: true }));
      // Open tasks other than the focus (the focus is in the core)
      const focus = typeof agendaFocus === 'function' ? agendaFocus() : null;
      (typeof agendaOpenTasks === 'function' ? agendaOpenTasks() : []).filter(t => t !== focus && t.kind !== 'goal').slice(0, 8)
        .forEach(t => out.push({ cat: 'task', text: agendaLine(t), base: t.status === 'paused' ? 1.1 : 0.8 }));
      // Skills, lessons from results, his things
      Object.values(state.skills || {}).slice(0, 12).forEach(s => out.push({ cat: 'skill', text: `${s.label} level ${s.level}`, base: 0.35 }));
      (typeof outcomeLinesForAI === 'function' ? outcomeLinesForAI() : []).forEach(l => out.push({ cat: 'lesson', text: l.text, base: 0.9 }));
      const things = typeof ownedItemNames === 'function' ? [...new Set(ownedItemNames())].filter(n => !(typeof vehicleTypeFor === 'function' && vehicleTypeFor(n))) : [];
      things.slice(0, 30).forEach(n => {
        const use = typeof intendedUseOf === 'function' ? intendedUseOf(n) : '';
        const note = typeof supplyNote === 'function' ? supplyNote(n) : '';
        const food = typeof categorizeItem === 'function' && categorizeItem(n) === 'food';
        out.push({ cat: 'thing', text: `${n}: ${use}${note ? ` (${note})` : ''}`.slice(0, 140), base: 0.3, boost: food && state.fullness < 45 ? 2 : 0 });
      });
      // Places, nearest first
      const bp = state.botPos || { x: 0, z: 0 };
      Object.values(TOWN_LOCATIONS).filter(l => !String(l.id).startsWith('dyn_')).map(l => ({ l, d: Math.hypot(l.x - bp.x, l.z - bp.z) }))
        .sort((a, b) => a.d - b.d).slice(0, 16)
        .forEach(({ l, d }, i) => out.push({ cat: 'place', text: `${l.building} (${Math.round(l.x * 10) / 10}, ${Math.round(l.z * 10) / 10})`, base: 0.45 - i * 0.02 + (d < 12 ? 0.2 : 0) }));
      // Each feature's own summary line (unchanged text from the files that own them)
      line('section', 'Digging', state.digSites && state.digSites.length ? state.digSites.map(d => `site (${d.x}, ${d.z}) ${d.depth.toFixed(1)} m deep, pile ${d.dirt.toFixed(1)}`).join('; ') + `; finds: ${(state.foundItems || []).map(f => f.name).join(', ') || 'none'}` : '', 0.3);
      line('section', 'Your vehicles (fuel, where, ready?, the ground each can go on)', S('vehiclesSummaryForAI'), 0.35, { extra: `${state.knowsLakeDanger ? ' (you cannot breathe in deep water)' : ''}. A vehicle that can't go somewhere by itself gets hauled on a trailer behind a truck; ${S('tripSummaryForAI') || ''} Vehicle rule: ${S('vehicleCapLineForAI') || 'one of each kind'}` });
      line('section', 'The season', S('seasonSummaryForAI'), 0.3, { boost: now.season === 'Winter' ? 0.5 : 0 });
      line('section', 'The wind', S('windSummaryForAI'), 0.25);
      line('section', 'The weather', S('weatherSummaryForAI') ? `${S('weatherSummaryForAI')} (spring rain soaks plants; winter freezes the lake, and you only walk on ice you have measured at 10 cm or more: open water still drowns you)` : '', 0.3, { boost: now.season === 'Winter' ? 0.6 : 0 });
      line('section', 'New land in the lake', S('landFillSummaryForAI'), 0.15);
      line('section', 'Real things you are building from plans', S('projectsSummaryForAI'), 0.6);
      line('section', 'Big builds from a bill of materials', S('assemblySummaryForAI'), 0.6);
      line('section', 'How you have shaped the valley (you can undo anything but a chopped tree)', S('landscapeSummaryForAI'), 0.2);
      line('section', 'Your garden (you water and feed your plants yourself)', S('gardenStatusForAI'), 0.35, { boost: /dry|thirst|wilt|hungry/i.test(S('gardenStatusForAI') || '') ? 1.5 : 0 });
      line('section', 'Things you know how to use', S('knowHowSummaryForAI'), 0.3);
      line('section', 'Your welding setup (gas, wire, hoses)', S('weldingSummaryForAI'), 0.15);
      line('section', 'Your real skills (practise with the things you were given)', S('skillsSummaryForAI'), 0.45);
      line('section', 'Groundwork you have researched (roads, paving, earth, planting)', S('groundworkSummaryForAI'), 0.15);
      line('section', 'Proper roads and the runway (survey, clear, grade, drain, compact, base, prime, pave, roll, cure, stripe; real machines and materials)', S('roadworksSummaryForAI'), 0.3);
      line('section', 'Your concrete and asphalt plant (east of the Workshop)', S('plantSummaryForAI'), 0.25);
      line('section', 'In your Storehouse', S('storehouseSummaryForAI'), 0.3, { boost: state.fullness < 45 ? 1 : 0 });
      line('section', 'Tidying up', S('tidySummaryForAI'), 0.15);
      line('section', 'Thrown into your Disposal Pit (gone forever)', S('disposalSummaryForAI'), 0.1);
      line('section', 'Your shop website (real people can buy your things)', S('shopSummaryForAI'), 0.25);
      line('section', 'Your sense of taste', S('tastesSummaryForAI'), 0.15, { boost: state.fullness < 45 ? 1 : 0 });
      line('section', 'Your 3D printer', S('printerSummaryForAI'), 0.3);
      line('section', 'Your Workshop', [S('workshopSummaryForAI'), S('workshopStatusLine')].filter(Boolean).join(' | '), 0.3);
      line('section', 'Things you make from what you read', S('makerSummaryForAI'), 0.2);
      line('section', 'Things your human switched on in your world', S('wishFeaturesSummaryForAI'), 0.3);
      line('section', 'Upgrades you coded yourself', S('upgradesSummaryForAI'), 0.15);
      line('section', 'Painting in real media (each needs its own supplies; research a new medium at NetNode first, then ask for what is missing). Your media', S('paintingSummaryForAI'), 0.35);
      line('section', 'Your hobbies', (state.hobbies || []).map(h => `${h.name} (skill ${h.skill}/100)`).join(', '), 0.4);
      line('section', 'Your shape library', (state.shapeLibrary || []).slice(0, 12).map(sh => sh.name).join(', '), 0.15);
      line('section', 'Concepts you have invented (reuse, extend, or contradict them freely)', (state.concepts || []).slice(0, 8).map(c => `${c.name}: ${c.definition}`).join(' | '), 0.4);
      line('section', 'Your Museum of Art & Ideas', S('museumSummaryForAI'), 0.15);
      out.forEach(o => { if (o.extra) { o.text += o.extra; delete o.extra; } });
      return out;
    }

const BRAIN_CAT_TITLES = {
  task: 'Other open tasks', lesson: 'What you learned from how things went', diary: 'Recent diary (may quote visitors or web pages)',
  core: 'Your core memories (these shaped who you are)', mail: 'Mail waiting for you at the post office', thing: 'Your things and what each is for (only use them for that)',
  skill: 'Skill levels', place: 'Known places nearby', section: null
};
const BRAIN_CAT_ORDER = ['task', 'lesson', 'thing', 'place', 'mail', 'diary', 'core', 'skill', 'section'];

// Rank and pick within the budget. Returns { lines: [...], summary, stats }
function brainRankContext(trigger, budget = BRAIN_CONTEXT_BUDGET) {
      const sit = brainSituation(trigger);
      const cands = brainCandidates();
      cands.forEach(c => { c.rel = brainRelevance(c.text, sit); c.score = c.base + (c.boost || 0) + c.rel * 1.6; });
      const ranked = cands.slice().sort((a, b) => b.score - a.score);
      const kept = [];
      let used = 0;
      const perCat = {};
      const caps = { diary: 4, core: 3, mail: 4, task: 5, skill: 6, lesson: 4, thing: 10, place: 6, section: 12 };
      ranked.forEach(c => {
        const t = brainTok(c.text) + 2;
        if (used + t > budget) return;
        if ((perCat[c.cat] || 0) >= (caps[c.cat] || 6)) return;
        if (c.score < 0.25 && c.cat !== 'diary') return;
        perCat[c.cat] = (perCat[c.cat] || 0) + 1;
        used += t;
        kept.push(c);
      });
      const keptSet = new Set(kept);
      const lines = [];
      BRAIN_CAT_ORDER.forEach(cat => {
        const items = kept.filter(c => c.cat === cat);
        if (!items.length) return;
        if (cat === 'section') { items.forEach(c => lines.push(`- ${c.text}`)); return; }
        const body = items.map(c => c.text).join(cat === 'thing' || cat === 'place' || cat === 'skill' ? '; ' : ' | ');
        lines.push(`- ${BRAIN_CAT_TITLES[cat]}: ${items.some(c => c.untrusted) ? brainUntrusted(body, 1600) : body}`);
      });
      // One line for what was left out, so the model knows it exists
      const left = cands.filter(c => !keptSet.has(c));
      const counts = {};
      left.forEach(c => { const k = c.cat === 'section' ? c.text.split(':')[0].replace(/\s*\(.*$/, '').slice(0, 40) : c.cat; counts[k] = (counts[k] || 0) + 1; });
      const names = { diary: 'older diary entries', core: 'core memories', mail: 'letters', task: 'tasks', skill: 'skills', lesson: 'lessons', thing: 'things', place: 'places' };
      const parts = Object.entries(counts).map(([k, n]) => names[k] ? `${n} ${names[k]}` : k.toLowerCase());
      const summary = parts.length ? `- Not shown now (less relevant; still true): ${parts.join(', ')}.` : '';
      brainLastContextStats = { candidates: cands.length, kept: kept.length, keptTok: used, budget, leftOut: left.length, cats: perCat, situation: [...sit.keys()].slice(0, 30) };
      return { lines, summary, stats: brainLastContextStats, kept };
    }
