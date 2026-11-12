// Kelo-bot-1 — js/skills.js
// Loaded after groundwork.js. Real skills from real things. The vehicles, instruments and gear he asks
// for and his human gives him are things to get good at, not just to own. He practises with them on
// his own, especially new ones, and when a visitor asks ("try flying your helicopter!") he goes and
// does exactly that. Each session earns experience; levels 1-10 show how good he has become. Better
// pilots and drivers go on longer runs with more laps, and he writes about getting better.

const SKILL_WORDS = [
  { kind: 'air', re: /\b(helicopter|heli|chopper)\b/i, verb: 'flying', noun: 'helicopter' },
  { kind: 'balloon', re: /\b(hot.?air )?balloon\b/i, verb: 'flying', noun: 'hot-air balloon' },
  { kind: 'truck', re: /\b(dump ?truck|truck)\b/i, verb: 'driving', noun: 'dump truck' },
  { kind: 'excavator', re: /\b(excavator|digger|backhoe)\b/i, verb: 'operating', noun: 'excavator' },
  { kind: 'boat', re: /\b(boat|canoe|kayak|raft|rowboat|sailboat|paddle ?board)\b/i, verb: 'boating', noun: 'boat' },
  { kind: 'bike', re: /\b(bike|bicycle|scooter|skateboard)\b/i, verb: 'riding', noun: 'bike' },
  { kind: 'snowmobile', re: /\b(snowmobile|snow ?machine)\b/i, verb: 'riding', noun: 'snowmobile' },
  { kind: 'telescope', re: /\btelescope\b/i, verb: 'stargazing with', noun: 'telescope' }
];
const USE_VERBS = /\b(fly|flying|drive|driving|ride|riding|sail|row|paddle|take|try|use|using|go|practi[cs]e|play|operate|test|spin)\b/i;
let skillSessionRunning = false;
const skillAsks = []; // visitors' requests ("fly your helicopter!"), done first as soon as he's free

function skillLevelFor(xp) {
      return Math.min(10, Math.floor(Math.sqrt(Math.max(0, xp) / 6)));
    }

function skillOf(key) {
      return (state.skills && state.skills[key]) || null;
    }

// Experience for doing something for real; a level-up is a little moment
function gainSkill(key, label, amount = 6) {
      if (!key) return null;
      if (!state.skills) state.skills = {};
      const s = state.skills[key] || (state.skills[key] = { label, xp: 0, level: 0, sessions: 0, firstAt: Date.now() });
      s.label = label || s.label;
      const before = s.level;
      s.xp = Math.round((s.xp + amount) * 10) / 10;
      s.sessions += 1;
      s.lastAt = Date.now();
      s.level = skillLevelFor(s.xp);
      if (s.level > before) {
        showToast(`🎓 Kelo-1 got better at ${s.label}: level ${s.level}`);
        state.diaryEntries.unshift({
          time: 'Getting Better', location: currentPlaceLabel(), mood: `🎓 ${s.label}: level ${s.level}`.slice(0, 80),
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I can feel myself getting better at ${s.label}. ${s.level <= 2 ? 'I still wobble and second-guess every move, but it is starting to make sense.' : s.level <= 5 ? 'It is starting to feel natural, and I can go further without thinking about every control.' : s.level <= 8 ? "I'm actually good at this now. I can do it smoothly, and I try harder routes on purpose." : 'I think I have mastered it. It feels like a part of me.'}`
        });
        state.happiness = Math.min(100, state.happiness + 5);
      }
      return s;
    }

// What he could practise right now: vehicles he has, the telescope at night, his hobbies
function skillCandidates() {
      const out = [];
      (state.vehicles || []).forEach(v => {
        const w = SKILL_WORDS.find(s => s.re.test(v.name)) || null;
        const kind = /balloon/i.test(v.name) ? 'balloon' : v.kind;
        const word = SKILL_WORDS.find(s => s.kind === kind) || w;
        if (!word || v.kind === 'trailer') return; // a trailer is towed, not practised
        // A snowmobile only counts when there's snow it can get to, by itself or on its trailer (js/trips.js)
        if (kind === 'snowmobile' && !(typeof snowmobileHasSnow === 'function' ? snowmobileHasSnow(v) : /winter/i.test(typeof currentSeason === 'function' ? currentSeason() : ''))) return;
        out.push({ key: `${word.verb} ${word.noun}`, label: `${word.verb} the ${word.noun}`, vehicle: v, kind });
      });
      const scope = typeof hasItem === 'function' ? hasItem(/telescope/i) : null;
      if (scope && typeof stargaze === 'function') out.push({ key: 'stargazing', label: 'stargazing with the telescope', telescope: scope });
      (state.hobbies || []).forEach(h => out.push({ key: `hobby ${h.name}`, label: String(h.name).toLowerCase(), hobby: h }));
      return out;
    }

// New gifts and low skills come first
function pickSkillToPractise() {
      const c = skillCandidates();
      if (!c.length) return null;
      const weighted = c.map(x => {
        const s = skillOf(x.key);
        const level = s ? s.level : 0;
        const fresh = !s ? 4 : 1;
        return { x, w: fresh * (11 - level) * (x.vehicle ? 1.6 : 1) };
      });
      let roll = Math.random() * weighted.reduce((sum, y) => sum + y.w, 0);
      for (const y of weighted) { roll -= y.w; if (roll <= 0) return y.x; }
      return weighted[0].x;
    }

function skillPracticeChance() {
      const c = skillCandidates();
      if (!c.length || skillSessionRunning) return 0;
      // Something he was given and has never really tried: he's eager to
      return c.some(x => !skillOf(x.key)) ? 0.45 : 0.22;
    }

// Somewhere to fly or drive to on a practice run: further and harder as he improves
function practiceWaypoint(v, kind, level, i) {
      const reach = 10 + level * 3 + i * 2;
      for (let n = 0; n < 30; n++) {
        const a = Math.random() * Math.PI * 2;
        const x = v.x + Math.cos(a) * reach, z = v.z + Math.sin(a) * reach;
        if (x < WORLD_MIN_X + 3 || x > WORLD_MAX_X - 3 || z < WORLD_MIN_Z + 3) continue;
        if (kind === 'boat') { if (z > 11 && z < WORLD_MAX_Z + 30) return { x, z: Math.max(12, z) }; continue; }
        if (z > 8.6) continue; // land and air practice stays over land
        if (kind !== 'air' && kind !== 'balloon' && typeof inTown === 'function' && inTown(x, z)) continue;
        if (kind !== 'air' && kind !== 'balloon' && z < -14) continue; // wheels stay off the steep mountain
        return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 };
      }
      return { x: v.x + 8, z: v.z };
    }

// One real practice session
async function practiseSkill(c, visitor = null) {
      if (!c || skillSessionRunning) return false;
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      const before = skillOf(c.key);
      const level = before ? before.level : 0;
      const who = visitor ? ` ${visitor} asked me to, and` : '';
      // Hobbies and the telescope have their own sessions
      if (c.hobby) { const ok = await practiceHobby(c.hobby, visitor ? `Asked by ${visitor}` : 'Practising a Skill'); if (ok !== false) gainSkill(c.key, c.label, 5); return ok; }
      if (c.telescope) { const ok = await stargaze(visitor ? `Asked by ${visitor}` : 'Practising a Skill'); if (ok !== false) gainSkill(c.key, c.label, 5); return ok; }
      const v = c.vehicle;
      if (!v) return false;
      if (typeof readyToOperate === 'function' && !readyToOperate(v.name, v)) return 'not-ready'; // learns first, or asks for fuel
      if (typeof safeToFly === 'function' && !safeToFly(v)) { renderAllUI(); return 'too-windy'; }
      // Somewhere it can't get to on its own ground (a snowmobile with no snow under it, a boat on its trailer):
      // the trip planner works out how to haul it there (js/trips.js)
      if (typeof takeTrip === 'function' && ((c.kind === 'snowmobile' && !(typeof inSnow === 'function' && inSnow(v) && !tripLoadOf(v))) || (c.kind === 'boat' && boatOnLand(v)))) {
        const ok = await takeTrip(v, c.kind === 'boat' ? 'lake' : 'mountain', visitor ? `${visitor} asked me to.` : 'I wanted the practice.', visitor ? `Asked by ${visitor}` : 'Practising a Skill');
        return ok;
      }
      if (c.kind === 'balloon' && typeof flyBalloon === 'function') { const ok = await flyBalloon(visitor ? `Asked by ${visitor}` : 'Practising a Skill'); if (ok) gainSkill(c.key, c.label, 8); return ok; }
      if (c.kind === 'boat' && typeof goBoating === 'function') { const ok = await goBoating(visitor ? `Asked by ${visitor}` : 'Practising a Skill'); if (ok) gainSkill(c.key, c.label, 8); return ok; }
      skillSessionRunning = true;
      state.isPracticing = true;
      const home = { x: v.x, z: v.z };
      const laps = 1 + Math.min(3, Math.floor(level / 3));
      try {
        state.currentLocKey = 'custom';
        state.customPlaceName = `a practice run in the ${c.label.replace(/^\w+ the /, '')}`;
        state.moodEmoji = c.kind === 'air' ? '🚁' : '🏁';
        state.moodTitle = `Practising ${c.label}`.slice(0, 80);
        state.speechBubble = level === 0 ? `Time to really learn ${c.label}.${who} I'll take it slow and get a feel for the controls.`
          : level < 5 ? `More practice ${c.label}.${who} I want to go a little further this time.` : `Let's see how smoothly I can do this now.${who}`;
        renderAllUI();
        for (let i = 0; i < laps; i++) {
          const wp = practiceWaypoint(v, c.kind, level, i);
          await driveVehicle(v, wp, `Practising ${c.label} (run ${i + 1} of ${laps + 1})`);
          if (typeof fuelLeft === 'function' && typeof fuelNeededBy === 'function' && fuelNeededBy(v) && fuelLeft(v) <= 0) break;
        }
        // And back to where it lives
        if (!(typeof fuelNeededBy === 'function' && fuelNeededBy(v) && fuelLeft(v) <= 0)) await driveVehicle(v, home, `Bringing the ${c.label.replace(/^\w+ the /, '')} home`);
        if (Math.hypot(v.x - home.x, v.z - home.z) < 1.5) { v.x = home.x; v.z = home.z; if (typeof renderVehicles3D === 'function') renderVehicles3D(); }
        const s = gainSkill(c.key, c.label, 6 + laps * 2);
        state.speechBubble = s.level <= 1 ? `That was hard, but I did it! ${c.label[0].toUpperCase() + c.label.slice(1)} is a real skill.`
          : `That went well. I'm at level ${s.level} at ${c.label} now.`;
        state.diaryEntries.unshift({
          time: visitor ? `Asked by ${visitor}` : 'Practising a Skill', location: currentPlaceLabel(), mood: `${state.moodEmoji} Practised ${c.label}`.slice(0, 80),
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I spent time practising ${c.label}${visitor ? ` because ${visitor} asked me to` : ''}: ${laps} run${laps === 1 ? '' : 's'} out and back. ${s.level <= 2 ? 'I am still clumsy at it.' : s.level <= 6 ? 'I am getting the hang of it.' : 'It feels easy now.'}`
        });
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        state.isPracticing = false;
        state.microPose = 'normal';
        skillSessionRunning = false;
      }
    }

// From an AI decision: "practise": "the helicopter" (or any item or hobby name)
function practiseNamed(text) {
      const t = String(text || '').toLowerCase();
      const c = skillCandidates().find(x => (x.vehicle && (t.includes(x.vehicle.name.toLowerCase().replace(/^(an?|the)\s+/, '')) || SKILL_WORDS.some(w => w.kind === x.kind && w.re.test(t))))
        || (x.hobby && t.includes(String(x.hobby.name).toLowerCase())) || (x.telescope && /telescope|star/.test(t)));
      if (c) doWhenFree(() => practiseSkill(c));
      return Boolean(c);
    }

// "Try flying your helicopter!" -> { candidate } if he has it, { missing: 'helicopter' } if not
function parseUseRequest(message) {
      const m = String(message || '');
      if (!USE_VERBS.test(m)) return null;
      const word = SKILL_WORDS.find(w => w.re.test(m));
      if (word) {
        const c = skillCandidates().find(x => x.kind === word.kind || (word.kind === 'telescope' && x.telescope));
        return c ? { candidate: c, word } : { missing: word.noun, word };
      }
      const hobby = (state.hobbies || []).find(h => new RegExp(`\\b${String(h.name).split(/\s+/)[0].replace(/[^a-z]/gi, '')}`, 'i').test(m));
      if (hobby) return { candidate: skillCandidates().find(x => x.hobby === hobby) };
      return null;
    }

function answerUseRequest(ask, visitor) {
      if (ask.missing) {
        const season = ask.word && ask.word.kind === 'snowmobile' && typeof currentSeason === 'function' && !/winter/i.test(currentSeason());
        sayToVisitor(season ? `I'd love to, ${visitor}, but there's no snow for the snowmobile right now.`
          : (state.vehicles || []).some(v => SKILL_WORDS.find(w => w.noun === ask.missing && w.re.test(v.name)))
            ? `I can't right now, ${visitor}, but I will soon.`
            : `I don't have a ${ask.missing} yet, ${visitor}. If you sent me one, I'd learn to use it properly.`, visitor);
        return;
      }
      const c = ask.candidate;
      if (!c) return;
      const busy = state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping;
      sayToVisitor(busy ? `Okay ${visitor}! As soon as I finish what I'm doing, I'll go and practise ${c.label}.` : `Okay ${visitor}! I'll go and practise ${c.label} right now.`, visitor);
      skillAsks.push({ c, visitor });
      setTimeout(takeSkillAsk, 1500);
    }

// Called first thing on each life tick (js/agent.js): a visitor's request beats his own plans
function takeSkillAsk() {
      if (!skillAsks.length || skillSessionRunning) return false;
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      const ask = skillAsks.shift();
      practiseSkill(ask.c, ask.visitor);
      return true;
    }

function skillsSummaryForAI() {
      const list = Object.values(state.skills || {}).sort((a, b) => b.level - a.level).slice(0, 8).map(s => `${s.label} level ${s.level}`);
      const untried = skillCandidates().filter(c => !skillOf(c.key)).map(c => c.label);
      return `${list.length ? list.join(', ') : 'no practised skills yet'}${untried.length ? `; given to you but never really practised: ${untried.join(', ')}` : ''}`;
    }

// How far he is from his current level to the next one (0..1); level 10 is the top
function skillProgress(s) {
      if (s.level >= 10) return 1;
      return Math.max(0, Math.min(1, (s.xp - 6 * s.level * s.level) / Math.max(1, 6 * ((s.level + 1) ** 2 - s.level ** 2))));
    }

function skillAgo(at) {
      if (!at) return '';
      const m = Math.round((Date.now() - at) / 60000);
      return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
    }

// Each skill: its level, a bar to the next level and when he last practised it
function renderSkillsList() {
      const el = document.getElementById('skillsListContainer');
      if (!el) return;
      const list = Object.values(state.skills || {}).sort((a, b) => b.level - a.level || b.xp - a.xp);
      perfSetHtml(el, list.length ? list.map(s => {
        const pct = Math.round(skillProgress(s) * 100);
        const ago = skillAgo(s.lastAt);
        return `
        <div class="brain-card brain-skill">
          <div class="brain-skill-lv" aria-hidden="true"><small>Lv</small>${s.level}</div>
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-baseline justify-between gap-2">
              <span class="brain-card-title truncate">${escapeHtml(String(s.label || '').replace(/^./, ch => ch.toUpperCase()))}</span>
              <span class="brain-card-meta shrink-0">${s.level >= 10 ? 'Mastered' : `${pct}% to Lv ${s.level + 1}`}</span>
            </div>
            <div class="brain-bar" role="progressbar" aria-label="${escapeHtml(s.label)}: level ${s.level}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
            <div class="brain-card-meta">${s.sessions || 0} ${s.sessions === 1 ? 'session' : 'sessions'}${ago ? ` · last ${ago}` : ''}</div>
          </div>
        </div>`;
      }).join('') : '<p class="brain-empty">No skills practised yet. Give him something to learn!</p>');
    }
