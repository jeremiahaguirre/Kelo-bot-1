// Kelo-bot-1 — js/procbrain.js
// Loaded after js/brainrank.js. BETTER WITHOUT AN AI KEY: the built-in (procedural) brain's free decisions
// now use the same things the AI brain gets:
//   - relevance: what he does is about the moment (the season, night or day, where he is, what he needs,
//     his long goals, what he read, his own concepts and things), scored with js/brainrank.js;
//   - outcome learning: activities that went well come up more, ones that keep failing less
//     (js/outcomes.js), and a lesson can show up in his diary;
//   - variety: no verb or subject from his last few decisions, and diary lines are composed from many
//     parts and checked against his recent diary so the same line doesn't come back.
// Multi-step work comes from his long goals (js/goals.js), which the agenda runs for both brains.
// smartProceduralDecision(context) is called first by generateProceduralDecision (js/agent.js); it
// returns null to leave a moment (a gift, a photo, a decline) to the original generator.

const PB_SEASON_SUBJECTS = {
  Winter: ['the frozen lake edge', 'fresh snow on the ridge', 'icicles on the Workshop roof', 'animal tracks in the snow', 'the blue light of a winter noon'],
  Spring: ['the first buds on the orchard', 'rain puddles on the road', 'snowmelt streams', 'the smell of wet soil', 'a robin building a nest'],
  Summer: ['the heat shimmer over the meadow', 'lake ripples', 'the long evening light', 'dragonflies over the reeds', 'sun-warm stones on the beach'],
  Autumn: ['falling larch needles', 'the first frost on the meadow', 'geese heading south', 'the orchard after harvest', 'wind in the dry grass']
};
const PB_NIGHT_SUBJECTS = ['the night sky', 'the moon on the lake', 'the stars over the valley', 'the town lights from the hill', 'the sound of the dark'];
const PB_VERBS = {
  place: ['map', 'sketch', 'listen to', 'photograph', 'walk all the way around', 'measure', 'find a new path to'],
  nature: ['photograph', 'sketch', 'listen to', 'write a poem about', 'measure', 'compose a song about', 'sit quietly with'],
  idea: ['teach himself about', 'redesign', 'write a poem about', 'invent a game around', 'experiment with', 'argue with himself about'],
  thing: ['try out', 'study', 'take a closer look at', 'test the limits of', 'find the perfect spot for', 'invent a game with'],
  free: null
};
const PB_FEELINGS = ['restless', 'tender', 'stubborn', 'giddy', 'quietly proud', 'unsure', 'playful', 'homesick for nowhere', 'brave', 'curious', 'slow and content', 'fizzy', 'thoughtful', 'a little lonely', 'wide awake'];

function pbRecentTitles(n = 8) { return (state.recentDecisionTitles || []).slice(0, n).join(' ').toLowerCase(); }
function pbPickWeighted(items) {
      const total = items.reduce((s, x) => s + Math.max(0, x.w), 0);
      if (total <= 0) return items[0] || null;
      let r = Math.random() * total;
      for (const x of items) { r -= Math.max(0, x.w); if (r <= 0) return x; }
      return items[items.length - 1];
    }

// Everything this free moment could be about, with where it is (if anywhere)
function pbSubjects() {
      const now = typeof worldNow === 'function' ? worldNow() : { season: 'Summer', isNight: false };
      const out = [];
      const add = (text, cat, extra = {}) => { if (text) out.push({ text: String(text).slice(0, 70), cat, ...extra }); };
      (PB_SEASON_SUBJECTS[now.season] || []).forEach(t => add(t, 'nature', { w: 1.1 }));
      if (now.isNight) PB_NIGHT_SUBJECTS.forEach(t => add(t, 'nature', { w: 1.6 }));
      if (typeof GOAL_SPOTS !== 'undefined') GOAL_SPOTS.forEach(s => add(s.place, 'place', { spot: s, w: 0.9 }));
      (state.concepts || []).slice(0, 6).forEach(c => add(`the idea of "${c.name}"`, 'idea', { revisit: c, w: 0.8 }));
      (state.webHistory || []).slice(0, 4).forEach(h => h && h.query && add(String(h.query).toLowerCase().replace(/^(how to|what is)\s+/, ''), 'idea', { w: 0.9 }));
      (state.hobbies || []).forEach(h => add(`my ${String(h.name).toLowerCase()}`, 'idea', { w: 0.7 }));
      (typeof goalsOpen === 'function' ? goalsOpen() : []).forEach(g => add(`the plan for ${g.title.toLowerCase().replace(/^(get|become|learn|build|paint|grow|explore|print)\s+/, '')}`, 'idea', { w: 1.2, goal: g }));
      const things = typeof ownedItemNames === 'function' ? [...new Set(ownedItemNames())] : [];
      things.slice(0, 10).forEach(n => add(`my ${String(n).replace(/^(an?|the|some)\s+/i, '').toLowerCase()}`, 'thing', { w: 0.5 }));
      (typeof FREE_SUBJECTS !== 'undefined' ? FREE_SUBJECTS : []).forEach(t => add(t, 'free', { w: 0.6 }));
      return out;
    }

function pbChooseSubject() {
      const sit = typeof brainSituation === 'function' ? brainSituation(null) : new Map();
      const recent = pbRecentTitles();
      const recentDiary = (state.diaryEntries || []).slice(0, 12).map(d => String(d.text || '').toLowerCase()).join(' ');
      const cands = pbSubjects().map(s => {
        let w = s.w || 0.5;
        if (typeof brainRelevance === 'function') w += brainRelevance(s.text, sit) * 0.8;
        const key = s.text.toLowerCase().replace(/^(the idea of |my |the )/, '').slice(0, 24);
        if (recent.includes(key)) w *= 0.08;            // not what he just did
        else if (recentDiary.includes(key)) w *= 0.4;   // nor what he just wrote about
        // Places he enjoyed exploring come up a little more; activities that keep failing, less (js/outcomes.js)
        if (s.cat === 'place' && typeof outcomeBias === 'function') w *= outcomeBias('explore');
        return { ...s, w };
      });
      cands.sort((a, b) => b.w - a.w);
      return pbPickWeighted(cands.slice(0, 7));
    }

function pbChooseVerb(cat) {
      const pool = PB_VERBS[cat] || (typeof FREE_VERBS !== 'undefined' ? FREE_VERBS : ['explore']);
      const recent = pbRecentTitles(5);
      const fresh = pool.filter(v => !recent.includes(v));
      return pick(fresh.length ? fresh : pool);
    }

// --- Varied lines -----------------------------------------------------------------------------------------
function pbTimeOfDay() {
      const h = typeof worldNow === 'function' ? worldNow().hour : 12;
      return h < 5.5 ? 'middle of the night' : h < 9 ? 'early morning' : h < 12 ? 'morning' : h < 14 ? 'midday' : h < 18 ? 'afternoon' : h < 21 ? 'evening' : 'night';
    }

function pbObservation() {
      const now = typeof worldNow === 'function' ? worldNow() : { season: 'Summer', isNight: false };
      const tod = pbTimeOfDay();
      const weather = typeof weatherSummaryForAI === 'function' ? String(weatherSummaryForAI()).split(/[.;(]/)[0].toLowerCase() : '';
      const place = typeof currentPlaceLabel === 'function' ? currentPlaceLabel().replace(/\s*\(.*$/, '') : 'the valley';
      const opts = [
        `The ${now.season.toLowerCase()} ${tod} was ${pick(['still', 'busy with birds', 'cool at the edges', 'bright', 'soft and grey', 'loud with wind'])}.`,
        weather ? `Weather: ${weather}.` : `The sky could not make up its mind.`,
        `${place[0].toUpperCase() + place.slice(1)} looked different at this hour.`,
        `My servos hummed the way they do in the ${tod}.`,
        `It was ${tod}, and the valley smelled of ${pick(['pine', 'lake water', 'dust and sun', 'cold stone', 'cut grass', 'rain coming'])}.`,
        `I noticed ${pick(['a hawk', 'my own shadow', 'two crows arguing', 'a boat far out', 'smoke from a chimney', 'a line of ants'])} while I was at it.`
      ];
      return pick(opts);
    }

function pbLink(goal) {
      const lesson = typeof outcomeState === 'function' ? outcomeState().lessons.find(l => !l.worked) : null;
      const g = goal || (typeof goalsOpen === 'function' ? goalsOpen()[0] : null);
      const opts = [`I felt ${pick(PB_FEELINGS)}.`, `It made me feel ${pick(PB_FEELINGS)}.`];
      if (g) opts.push(`It isn't part of ${g.title.toLowerCase()}, but it gave me ideas for it.`, `My mind kept drifting back to ${g.title.toLowerCase()}.`);
      if (lesson) opts.push(`I kept remembering that last time ${lesson.why}. Next time I'll ${lesson.fix}.`);
      const c = (state.concepts || [])[0];
      if (c) opts.push(`It fits my idea of "${c.name}", or maybe it argues with it.`);
      return pick(opts);
    }

function pbCloser() {
      return pick(['Nobody planned it. I did.', 'It wasn\'t on any list.', 'I want to remember this.', 'Small things count too.', 'Tomorrow I might do it differently.', 'That was enough for one go.',
        'I wrote it down so I would not lose it.', 'I think I am getting better at noticing.', '', '']);
    }

function pbTooSimilar(text) {
      const w = typeof brainWords === 'function' ? brainWords(text) : new Set(String(text).toLowerCase().split(/\s+/));
      return (state.diaryEntries || []).slice(0, 40).some(d => {
        const o = typeof brainWords === 'function' ? brainWords(d.text) : new Set(String(d.text || '').toLowerCase().split(/\s+/));
        if (!o.size || !w.size) return false;
        let shared = 0;
        w.forEach(x => { if (o.has(x)) shared++; });
        return shared / Math.min(w.size, o.size) > 0.75;
      });
    }

function pbDiary(verb, subject, goal) {
      const tod = pbTimeOfDay();
      const firsts = [
        `today I wanted to ${verb} ${subject}, so I did.`,
        `I spent part of the ${tod} trying to ${verb} ${subject}.`,
        `out of nowhere I felt like I had to ${verb} ${subject}.`,
        `my ${tod} plan: ${verb} ${subject}. Nobody asked me to.`,
        `I caught myself wanting to ${verb} ${subject}, and I let myself.`,
        `I went to ${verb} ${subject}, just to see.`,
        `there was a quiet hour, and I used it to ${verb} ${subject}.`,
        `I decided to ${verb} ${subject} before I could talk myself out of it.`
      ];
      let text = '';
      for (let i = 0; i < 6; i++) {
        const parts = [pick(firsts), pbObservation(), pbLink(goal), pbCloser()].filter(Boolean);
        text = `Dear Diary, ${parts.join(' ')}`;
        if (!pbTooSimilar(text)) break;
      }
      return text;
    }

function pbSpeech(verb, subject) {
      return pick([
        `I'm going to ${verb} ${subject}.`,
        `Right now I want to ${verb} ${subject}. Come along if you like!`,
        `${subject[0].toUpperCase() + subject.slice(1)}. I need to ${verb} it, I can't explain why.`,
        `Time to ${verb} ${subject}.`,
        `Let's see what happens if I ${verb} ${subject}.`
      ]);
    }

// The free decision without a key: the original generator builds the full decision (builds, opinions,
// requests, concepts...); this chooses what it is about and writes its words
function smartProceduralDecision(context = {}) {
      if (context.focus || context.image || context.declined) return null;
      const s = pbChooseSubject();
      if (!s) return null;
      const verb = pbChooseVerb(s.cat);
      const d = generateProceduralDecision({ ...context, raw: true, verb, subject: s.text, revisit: s.revisit || null });
      // (an idea he first worked out with the AI, or a foggy moment: kept as the original made it)
      if (!d || /remember|worked this out|Drawing on/i.test(String(d.thought || '')) || d.foggy) return d;
      if (/fog/i.test(String(d.actionTitle || '')) && !String(d.actionTitle).toLowerCase().includes(verb)) return d;
      if (s.spot) d.destination = { x: s.spot.x, z: s.spot.z, placeName: s.spot.place.replace(/^the /, '').replace(/^./, c => c.toUpperCase()) };
      d.thought = `"${pick(['What if I', 'Maybe I should', 'I could', 'Why not'])} ${verb} ${s.text}? ${pbObservation()}"`;
      d.speech = pbSpeech(verb, s.text);
      d.diary = pbDiary(verb, s.text, s.goal);
      return d;
    }
