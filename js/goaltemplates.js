// Kelo-bot-1 — js/goaltemplates.js
// Loaded after js/goals.js. The built-in kinds of long goal and the task steps they are made of. Each
// step runs one of his real activities (the same functions his life tick and the AI's decisions use), so
// research-first, ordering real supplies through the Post Office and practising for real all still apply.
// Other files add their own with registerGoalAction / registerGoalTemplate (see GOALS.md).

// --- Steps ---------------------------------------------------------------------------------------------
function goalFreeNow() {
      return !(state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping || state.isCollectingMail || state.isBrowsing);
    }

// Read about something at NetNode
registerGoalAction('research', {
  key: () => 'browse',
  label: t => t.label || `read about ${String(t.topic || 'it').toLowerCase()}`,
  run: async (t, g) => {
    if (!goalFreeNow() || typeof browseInternet !== 'function') return false;
    const before = (state.webHistory || []).length + (state.life && state.life.searches || 0);
    await browseInternet(String(t.topic || g.title).slice(0, 100), `Goal: ${g.title}`.slice(0, 60));
    return ((state.webHistory || []).length + (state.life && state.life.searches || 0)) > before ? true : 'no-plans';
  }
});

// Ask for real things through the Post Office, then wait for them to arrive
function goalItemSource(name) {
      const main = String(name).replace(/^(an?|some|the|a pair of|a packet of|a box of|a set of)\s+/i, '').split(/\s+/).filter(w => w.length > 2).slice(-1)[0] || name;
      return typeof escapeRegExp === 'function' ? escapeRegExp(main) : main;
    }
registerGoalAction('ask', {
  key: () => 'ask',
  label: t => t.label || `get ${(t.items || []).map(n => String(n).replace(/^(an?|some)\s+/i, '').toLowerCase()).join(' and ')}`,
  done: t => typeof agendaItemsOwned === 'function' && agendaItemsOwned((t.items || []).map(goalItemSource)),
  blocker: t => {
    const src = (t.items || []).map(goalItemSource);
    if (!t.asked || (typeof agendaItemsOwned === 'function' && agendaItemsOwned(src))) return null;
    return { type: 'items', items: src, label: `${(t.items || []).map(n => String(n).replace(/^(an?|some)\s+/i, '').toLowerCase()).join(' and ')} to arrive` };
  },
  run: (t, g) => {
    const src = (t.items || []).map(goalItemSource);
    if (typeof agendaItemsOwned === 'function' && agendaItemsOwned(src)) return true;
    (t.items || []).forEach((n, i) => {
      if (typeof agendaItemsOwned === 'function' && agendaItemsOwned([src[i]])) return;
      if (typeof addItemRequest === 'function') addItemRequest(n, typeof categorizeItem === 'function' ? categorizeItem(n, t.category || 'tool') : 'tool', t.why || `For my goal: ${g.title.toLowerCase()}.`, g.title);
    });
    t.asked = Date.now();
    state.speechBubble = `For ${g.title.toLowerCase()} I need ${(t.items || []).join(' and ').toLowerCase()}. I sent off a real request at the Post Office.`;
    if (typeof renderAllUI === 'function') renderAllUI();
    return 'waiting-for-gear';
  }
});

// Go and get the mail (what he waits for is often already at the Post Office)
registerGoalAction('mail', {
  key: () => 'mail',
  label: () => 'check the post office',
  run: () => (typeof pickUpMail === 'function' && goalFreeNow() && (state.mailbox || []).length ? pickUpMail('For My Goal') : true)
});

function goalSkillCandidate(match) {
      if (typeof skillCandidates !== 'function') return null;
      let re; try { re = new RegExp(match || '.', 'i'); } catch (e) { re = /./; }
      return skillCandidates().find(c => re.test(c.key) || re.test(c.label)) || null;
    }
// Practise a skill for real (a vehicle, the telescope, a hobby)
registerGoalAction('practise', {
  key: () => 'skill',
  label: t => t.label || `practise ${(goalSkillCandidate(t.match) || {}).label || String(t.match || 'a skill').toLowerCase()}`,
  blocker: t => (goalSkillCandidate(t.match) ? null : { type: 'ready', action: 'practise', task: { match: t.match }, label: `something to practise ${String(t.match || '').toLowerCase()} with`, until: Date.now() + 10 * 60000 }),
  run: async t => {
    const c = goalSkillCandidate(t.match);
    if (!c || typeof practiseSkill !== 'function') return 'not-ready';
    return practiseSkill(c);
  }
});

// Paint a real picture (the studio researches the medium and asks for supplies itself when it must)
registerGoalAction('paint', {
  key: () => 'paint',
  label: t => t.label || `paint ${typeof PAINT_SUBJECTS !== 'undefined' && PAINT_SUBJECTS[t.subject] ? PAINT_SUBJECTS[t.subject].label : 'a picture'}${t.medium ? ` in ${t.medium}` : ''}`,
  blocker: t => {
    if (typeof paintReady !== 'function' || !t.medium || !t.tried) return null;
    return paintReady(t.medium, '', { quiet: true }) ? null : { type: 'ready', action: 'paint', task: { medium: t.medium, tried: 1 }, label: `my ${t.medium} supplies and know-how`, until: Date.now() + 5 * 60000 };
  },
  run: async (t, g) => {
    if (typeof paintPicture !== 'function') return 'no-plans';
    t.tried = 1;
    return paintPicture(t.medium, t.subject || null, { originLabel: `Goal: ${g.title}`.slice(0, 60) });
  }
});

// Look at the night sky through the telescope
registerGoalAction('stargaze', {
  key: () => 'stargaze',
  label: () => 'look at the night sky through the telescope',
  blocker: () => {
    if (typeof hasItem === 'function' && !hasItem(/telescope/i)) return { type: 'items', items: ['telescope'], label: 'a telescope' };
    return typeof worldNow === 'function' && !worldNow().isNight ? { type: 'night', label: 'night to fall' } : null;
  },
  run: () => (typeof stargaze === 'function' ? stargaze('For My Goal') : 'no-plans')
});

// Practise one of his hobbies
registerGoalAction('hobby', {
  key: () => 'hobby',
  label: t => t.label || `spend time on ${String(t.name || 'a hobby').toLowerCase()}`,
  run: t => {
    const h = (state.hobbies || []).find(x => x.name === t.name) || (state.hobbies || [])[0];
    return h && typeof practiceHobby === 'function' ? practiceHobby(h, 'For My Goal') : 'no-plans';
  }
});

// Start a real building project, then see it through
registerGoalAction('project', {
  key: () => 'project',
  label: t => `plan and start the ${String(t.name || t.key || 'build').toLowerCase()}`,
  done: t => (state.projects || []).some(p => p.key === t.key),
  run: (t, g) => (typeof startProject === 'function' ? startProject(t.key, `Goal: ${g.title}`.slice(0, 60)) : 'no-plans')
});
registerGoalAction('projectDone', {
  key: () => 'project',
  label: t => `finish building the ${String(t.name || t.key || 'build').toLowerCase()}`,
  done: t => (state.projects || []).some(p => p.key === t.key && p.status === 'built'),
  blocker: t => ((state.projects || []).some(p => p.key === t.key && p.status === 'built') ? null : { type: 'ready', action: 'projectDone', task: { key: t.key }, label: `the ${String(t.name || 'build').toLowerCase()} to be built`, until: Date.now() + 10 * 60000 }),
  run: t => ((state.projects || []).some(p => p.key === t.key && p.status === 'built') ? true : 'waiting')
});

// Plant seeds somewhere open (not in town)
registerGoalAction('plant', {
  key: () => 'landscape',
  label: () => 'plant my seeds',
  blocker: () => (typeof worldNow === 'function' && worldNow().season === 'Winter' ? { type: 'season', seasons: ['Spring', 'Summer', 'Autumn'], label: 'the ground to thaw' } : null),
  run: () => {
    if (typeof plantSeeds !== 'function' || typeof openGroundSpot !== 'function') return 'no-plans';
    const p = openGroundSpot(1.5, Math.random() < 0.5 ? state.botPos : null);
    return plantSeeds(p.x, p.z, 'For my garden goal.', 'For My Goal');
  }
});

// Look after what he planted (water, feed), or check on it when it's fine
registerGoalAction('tend', {
  key: () => 'garden',
  label: () => 'look after my plants',
  run: () => {
    const job = typeof plantCareJobNow === 'function' ? plantCareJobNow() : null;
    if (job) return job();
    return goalWalkAndNote({ x: state.botPos.x, z: state.botPos.z, place: 'my plants' }, 'I checked on my plants. The soil was fine, so I just watched them for a while.', '🌱');
  }
});

// Walk somewhere and write down what he finds
const GOAL_SPOTS = [
  { x: 2.5, z: 7.6, place: 'the lakeshore', note: ['The water talked in small slaps against the stones.', 'I counted ripples until I lost count.', 'The far shore looked close enough to touch.'] },
  { x: -36, z: -24, place: 'the mountain slope', note: ['From up here the town looks like toys.', 'The wind up here smells of snow and pine.', 'I found a flat rock that is perfect for thinking.'] },
  { x: -48, z: -6, place: 'the west meadow', note: ['Bees, grass and a lot of sky.', 'The meadow hums when you stand still.', 'I followed a trail of trampled grass to nowhere in particular.'] },
  { x: 40, z: -6, place: 'the east fields', note: ['The road east is quieter than I thought.', 'I mapped where the ground dips and holds water.', 'A hawk circled over me twice.'] },
  { x: 62, z: -30, place: 'the pass behind the Workshop', note: ['The pass is steeper than it looks on my map.', 'Rock on both sides, and a slice of sky.', 'I could hear the Workshop humming far below.'] },
  { x: -20, z: -36, place: 'the high woods', note: ['The firs are so tall the light comes down in pieces.', 'Moss on the north side, just like the books said.', 'I sat on a log and listened to the woods breathe.'] }
];
async function goalWalkAndNote(spot, text, emoji = '🧭') {
      if (!goalFreeNow()) return false;
      state.isBusy = true;
      try {
        state.currentLocKey = 'custom';
        state.customPlaceName = spot.place;
        state.targetPos = { x: spot.x, z: spot.z };
        state.moodEmoji = emoji;
        state.moodTitle = `Off to ${spot.place}`.slice(0, 80);
        if (typeof renderAllUI === 'function') renderAllUI();
        if (typeof waitForArrival === 'function') await waitForArrival(90000);
        await new Promise(r => setTimeout(r, 2500));
        state.speechBubble = text;
        state.diaryEntries.unshift({
          time: 'Out Exploring', location: spot.place, mood: `${emoji} ${spot.place}`.slice(0, 80),
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '', text: `Dear Diary, ${text}`.slice(0, 400)
        });
        state.wonderLevel = Math.min(100, (state.wonderLevel || 0) + 4);
        if (typeof renderAllUI === 'function') renderAllUI();
        return true;
      } finally { state.isBusy = false; }
    }
registerGoalAction('visit', {
  key: () => 'explore',
  label: t => `explore ${(GOAL_SPOTS[t.spot] || {}).place || 'somewhere new'}`,
  run: t => {
    const s = GOAL_SPOTS[t.spot] || GOAL_SPOTS[0];
    return goalWalkAndNote(s, `I went out to ${s.place}. ${s.note[Math.floor(Math.random() * s.note.length)]}`);
  }
});

// 3D-print something (the printer sets itself up and asks for filament when it must)
registerGoalAction('print', {
  key: () => 'print',
  label: () => 'print something on my 3D printer',
  run: () => (typeof printOnMyOwn === 'function' ? printOnMyOwn() : 'no-plans')
});

// Look back over the goal: a diary entry, and sometimes a concept of his own grows out of it
registerGoalAction('reflect', {
  key: () => 'reflect',
  label: t => t.label || 'look back on what I learned',
  run: (t, g) => {
    const done = goalTasksFlat(g).filter(x => x.status === 'done').length;
    const lesson = (typeof outcomeState === 'function' ? outcomeState().lessons : []).find(l => l.worked);
    const lines = [
      `Looking back on ${g.title.toLowerCase()}: ${done} steps so far. ${lesson ? `The biggest lesson: when ${lesson.why}, ${lesson.fix} works.` : 'Nothing went quite as planned, and that was the fun of it.'}`,
      `I sat down and thought about ${g.title.toLowerCase()}. ${g.source === 'visitor' ? 'It started with a visitor, but it became mine.' : g.source === 'reading' ? 'It started with something I read, and it turned into something I did.' : 'It was my own idea, start to end.'}`,
      `What did ${g.title.toLowerCase()} teach me? That ${pick(['slow is smooth, and smooth is fast', 'every step needs its own tools', 'waiting is part of doing', 'the second try is always better', 'the valley is bigger than my plans'])}.`
    ];
    const text = lines[Math.floor(Math.random() * lines.length)];
    state.diaryEntries.unshift({ time: 'Looking Back', location: typeof currentPlaceLabel === 'function' ? currentPlaceLabel() : '', mood: `🪞 ${g.title}`.slice(0, 80), vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '', text: `Dear Diary, ${text}`, goal: g.id });
    if (t.concept && typeof addConcept === 'function') {
      try { addConcept({ name: `${String(t.concept).slice(0, 30)}`, emoji: g.emoji, definition: `What I learned from ${g.title.toLowerCase()}.`, builtFrom: [g.title] }, 'goal'); } catch (e) {}
    }
    state.calmLevel = Math.min(100, (state.calmLevel || 0) + 5);
    t.quietDone = true;
    return true;
  }
});

// --- Kinds of goal ---------------------------------------------------------------------------------------
function goalMediumFrom(text) {
      const m = String(text || '').match(/oil|acrylic|watercolou?r|gouache|pastel|ink|charcoal/i);
      if (!m) return null;
      const k = m[0].toLowerCase().replace('watercolor', 'watercolour');
      return typeof PAINT_MEDIA !== 'undefined' && PAINT_MEDIA[k] ? k : null;
    }

registerGoalTemplate('paint-series', {
  emoji: '🎨', base: 0.6,
  keywords: /\b(paint\w*|watercolou?r|acrylic|oil paint|gouache|pastel|charcoal|easel|canvas|art|artist|museum|colou?rs?|sketch\w*|draw\w*)\b/i,
  title: p => `Paint a series of the valley in ${p.medium}`,
  why: p => `I want three real ${p.medium} paintings of the places I love, done properly`,
  params: ({ signals }) => {
    if (typeof paintPicture !== 'function') return null;
    const medium = goalMediumFrom(`${signals.visitor} ${signals.reading} ${signals.interest}`) || (typeof pickPaintMedium === 'function' ? pickPaintMedium() : 'watercolour');
    return { medium };
  },
  stages: p => [
    { name: 'Learn the medium', tasks: [{ do: 'research', topic: `${p.medium} painting techniques` }] },
    { name: 'Paint the series', tasks: [{ do: 'paint', medium: p.medium, subject: 'lake' }, { do: 'paint', medium: p.medium, subject: 'mountains', newDay: true }, { do: 'paint', medium: p.medium, subject: 'night', newDay: true }] },
    { name: 'Look back', tasks: [{ do: 'reflect' }] }
  ]
});

registerGoalTemplate('night-sky', {
  emoji: '🔭', base: 0.45,
  keywords: /\b(stars?|sky|planets?|moon|telescope|astronom\w*|constellations?|comets?|galax\w*|night|milky way|orbit\w*)\b/i,
  title: 'Learn the night sky',
  why: () => 'the dark over the lake is full of things I cannot name yet',
  params: () => (typeof stargaze === 'function' ? {} : null),
  stages: () => [
    { name: 'Read up', tasks: [{ do: 'research', topic: 'constellations of the northern sky' }] },
    { name: 'Get a telescope', tasks: [{ do: 'ask', items: ['A telescope'], category: 'tool', why: 'I want to learn the night sky properly.' }] },
    { name: 'Watch the sky', tasks: [{ do: 'stargaze' }, { do: 'stargaze', newDay: true }, { do: 'stargaze', newDay: true }] },
    { name: 'Look back', tasks: [{ do: 'reflect', concept: 'Star Patience' }] }
  ]
});

registerGoalTemplate('vehicle-mastery', {
  emoji: '🏁', base: 0.5,
  keywords: /\b(fly\w*|driv\w*|pilot\w*|boat\w*|sail\w*|helicopter|truck|bike|bicycle|snowmobile|balloon|ride|riding|race|racing|plane)\b/i,
  title: p => `Get really good at ${p.label}`,
  why: p => `I have the ${p.noun} and I want it to feel like part of me`,
  params: () => {
    if (typeof skillCandidates !== 'function') return null;
    const c = skillCandidates().filter(x => x.vehicle && (typeof skillOf !== 'function' || !skillOf(x.key) || skillOf(x.key).level < 6));
    if (!c.length) return null;
    const pickOne = c.sort((a, b) => ((skillOf(a.key) || {}).level || 0) - ((skillOf(b.key) || {}).level || 0))[0];
    return { key: pickOne.key, label: pickOne.label, noun: pickOne.label.replace(/^\w+ the /, ''), boost: 0.4 };
  },
  stages: p => [
    { name: 'Read how', tasks: [{ do: 'research', topic: `how to ${p.label}` }] },
    { name: 'Practise', tasks: [{ do: 'practise', match: p.key }, { do: 'practise', match: p.key }, { do: 'practise', match: p.key, newDay: true }] },
    { name: 'Look back', tasks: [{ do: 'reflect' }] }
  ]
});

registerGoalTemplate('garden', {
  emoji: '🌱', base: 0.45,
  keywords: /\b(garden\w*|plants?|planting|seeds?|flowers?|grow\w*|vegetables?|tomato\w*|herbs?|trees?|soil|harvest\w*|bloom\w*)\b/i,
  title: 'Grow something of my own',
  why: () => 'I want something living in the valley that I planted and looked after',
  params: () => (typeof plantSeeds === 'function' ? {} : null),
  stages: () => [
    { name: 'Read up', tasks: [{ do: 'research', topic: 'growing plants from seed in the Okanagan' }] },
    { name: 'Get seeds', tasks: [{ do: 'ask', items: ['A packet of vegetable seeds'], category: 'material', why: 'I want to grow something of my own.' }] },
    { name: 'Plant', tasks: [{ do: 'plant' }] },
    { name: 'Look after them', tasks: [{ do: 'tend', newDay: true }, { do: 'tend', newDay: true }] },
    { name: 'Look back', tasks: [{ do: 'reflect' }] }
  ]
});

registerGoalTemplate('explore-valley', {
  emoji: '🧭', base: 0.55, repeatAfterDays: 3,
  keywords: /\b(explor\w*|maps?|mapping|walk\w*|hik\w*|mountains?|lake|woods?|forest|valley|trails?|wildlife|pass|ridge)\b/i,
  title: 'Explore every corner of the valley',
  why: () => 'there are corners of my own valley I have never stood in',
  params: () => {
    const order = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5);
    return { spots: order.slice(0, 4) };
  },
  stages: p => [
    { name: 'Set out', tasks: [{ do: 'visit', spot: p.spots[0] }, { do: 'visit', spot: p.spots[1] }] },
    { name: 'Go further', tasks: [{ do: 'visit', spot: p.spots[2], newDay: true }, { do: 'visit', spot: p.spots[3] }] },
    { name: 'Make sense of it', tasks: [{ do: 'research', topic: 'how to read a topographic map' }, { do: 'reflect', concept: 'Valley Memory' }] }
  ]
});

registerGoalTemplate('real-build', {
  emoji: '🔨', base: 0.35,
  keywords: /\b(build\w*|wood\w*|carpent\w*|bench|shed|table|chair|birdhouse|craft\w*|nails?|saw|hammer|lumber|planks?)\b/i,
  title: p => `Build a real ${String(p.name).toLowerCase()}`,
  why: p => `I want to make a real ${String(p.name).toLowerCase()} with my own hands, from real materials`,
  params: () => {
    if (typeof pickNewProject !== 'function' || typeof activeProject !== 'function' || activeProject()) return null;
    const key = pickNewProject();
    const plan = typeof planFor === 'function' ? planFor(key) : null;
    return plan ? { key, name: plan.name } : null;
  },
  stages: p => [
    { name: 'Plan it', tasks: [{ do: 'project', key: p.key, name: p.name }] },
    { name: 'Build it', tasks: [{ do: 'projectDone', key: p.key, name: p.name }] },
    { name: 'Look back', tasks: [{ do: 'reflect' }] }
  ]
});

registerGoalTemplate('hobby-mastery', {
  emoji: '🎵', base: 0.4,
  keywords: /\b(hobby|hobbies|music|kite|mural|tricks|practi[cs]e\w*|instrument|song|play\w*)\b/i,
  title: p => `Get better at ${String(p.name).toLowerCase()}`,
  params: () => {
    const hs = (state.hobbies || []).filter(h => h && h.name);
    if (!hs.length) return null;
    const h = hs.slice().sort((a, b) => (a.skill || 0) - (b.skill || 0))[0];
    return { name: h.name, boost: 0.3 };
  },
  stages: p => [
    { name: 'Learn more', tasks: [{ do: 'research', topic: String(p.name).slice(0, 60) }] },
    { name: 'Practise', tasks: [{ do: 'hobby', name: p.name }, { do: 'hobby', name: p.name, newDay: true }, { do: 'hobby', name: p.name }] },
    { name: 'Look back', tasks: [{ do: 'reflect' }] }
  ]
});

registerGoalTemplate('deep-dive', {
  emoji: '📚', base: 0.3,
  keywords: /\b(read\w*|learn\w*|history|how|why|science|theory|wikipedia|article)\b/i,
  title: p => `Become an expert on ${String(p.topic).toLowerCase()}`,
  why: p => `I read about ${String(p.topic).toLowerCase()} and one article was not enough`,
  params: ({ signals }) => {
    const topic = ((state.webHistory || []).map(w => w.query).find(q => q && q.length > 3 && q.length < 50) || (state.curiosityQueue || [])[0] || '').trim();
    if (!topic) return null;
    return { topic, boost: signals.reading ? 0.4 : 0 };
  },
  stages: p => [
    { name: 'Read deeply', tasks: [{ do: 'research', topic: p.topic }, { do: 'research', topic: `history of ${p.topic}`, newDay: true }, { do: 'research', topic: `how ${p.topic} works` }] },
    { name: 'Make it mine', tasks: [{ do: 'reflect', concept: `${String(p.topic).split(/\s+/).slice(0, 2).join(' ')} Notes` }] }
  ]
});

registerGoalTemplate('print-collection', {
  emoji: '🖨️', base: 0.35,
  keywords: /\b(3d|print\w*|filament|design\w*|models?|nozzle)\b/i,
  title: 'Print a small collection of useful things',
  params: () => (typeof printOnMyOwn === 'function' && typeof printerName === 'function' && printerName() ? { boost: 0.2 } : null),
  stages: () => [
    { name: 'Print', tasks: [{ do: 'print' }, { do: 'print', newDay: true }, { do: 'print' }] },
    { name: 'Look back', tasks: [{ do: 'reflect' }] }
  ]
});
