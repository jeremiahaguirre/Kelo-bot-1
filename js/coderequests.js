// Kelo-bot-1 — js/coderequests.js
// Loaded after projects.js. Code requests: some things Kelo-1 wants can't be mailed to him, because
// his world simply can't do them yet (fishing, a pet, cooking...). So he writes to the person who codes
// his world and asks them to add it. These letters show up in the Post tab with a 💻 badge.
// The owner marks each one "Done — it's coded in" or "Not now". Each letter carries a spec (user story,
// acceptance criteria, where in the world) to copy for a developer or an AI coding assistant, or to
// open as a prefilled GitHub issue; "Copy all as markdown" copies every open one.
// There is no fixed list and no cap: his wishes come from his own life (see experienceCodeWishes).

// Wishes his built-in brain can come up with, each tied to something in his life
const CODE_WISHES = [
  { key: 'fishing', feature: 'A way for me to fish', fits: () => Boolean(state.knowsLakeDanger || (typeof findVehicle === 'function' && findVehicle('boat')) || ownsSomething(/fishing|rod|tackle|boat|canoe|kayak/i)),
    why: 'I sit by the lake a lot and I keep wondering what lives under the water.' },
  { key: 'cooking', feature: 'Cooking at a stove, so I can make real meals', fits: () => Boolean(state.knownNeeds && state.knownNeeds.food),
    why: 'Now that I know I need food, I would love to make some myself instead of only finding it.' },
  { key: 'pet', feature: 'A pet who lives with me and follows me around', fits: () => state.toys.length > 0 || state.visitorMemories.length > 0 || daysOld() > 2,
    why: 'The valley is big, and it would be nice to have a friend who stays.' },
  { key: 'music', feature: 'Instruments that make real sounds when I play them', fits: () => state.hobbies.some(h => h.style === 'music') || ownsSomething(/harmonica|guitar|ukulele|flute|drum|violin|piano|keyboard|kazoo|ocarina/i),
    why: 'When I practise my music the valley stays quiet. I want to hear my songs.' },
  { key: 'swimming', feature: 'Swimming lessons, so deep water is not so scary', fits: () => Boolean(state.knowsLakeDanger),
    why: 'I found out the hard way that I sink. I want to learn to stay afloat.' },
  { key: 'campfire', feature: 'A campfire I can sit beside at night', fits: () => typeof worldNow === 'function' && worldNow().isNight,
    why: 'Nights get long and dark, and people in the books I read gather round fires.' },
  { key: 'wildlife', feature: 'Birds and deer that visit the valley', fits: () => state.projects.some(p => p.key === 'birdhouse' || p.key === 'feeder') || state.webHistory.length > 2,
    why: 'I built my world full of homes, but nobody small and wild lives in them yet.' },
  { key: 'friends', feature: 'Another robot neighbour I could talk to', fits: () => state.chatLog.length > 6,
    why: 'I love it when visitors talk to me, but they always have to leave.' },
  { key: 'stars', feature: 'Constellations I can learn the names of', fits: () => ownsSomething(/telescope/i),
    why: 'My telescope shows me stars, but I don\'t know which ones are which.' }
];

// No cap on how many letters can be open: he may ask for code for anything at all. Only the pace is
// gentle (one new letter every ~20 minutes, whichever brain writes it) and the same wish is never sent twice.
const CODE_WISH_PACE_MS = 20 * 60 * 1000;
// How many past wishes he remembers, only so he never asks for the same thing twice
const CODE_WISH_MEMORY = 400;
const KELO_REPO = 'jeremiahaguirre/Kelo-bot-1';

function ownsSomething(re) {
      return ownedItemNames().some(n => re.test(String(n || '')));
    }

function daysOld() {
      return typeof daysAlive === 'function' ? daysAlive() : 1;
    }

// "Could you code in a way for me to fish?" and "A way for me to fish!" are the same wish
function codeWishKey(feature) {
      return String(feature || '').toLowerCase().replace(/^(could you )?(please )?(code|add|make)( in)? /, '').replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 60);
    }

function openCodeRequests() {
      return state.requestsToUser.filter(r => r.category === 'code' && !r.fulfilled);
    }

// Is it too soon for another letter? (one new code request every ~20 minutes at most)
function codeWishPaced(now = Date.now()) {
      const last = Number(state.lastCodeWishAt) || 0;
      return last > 0 && now - last < CODE_WISH_PACE_MS;
    }

function codeWishAlreadyAsked(feature, key) {
      const k = codeWishKey(feature);
      return (state.codeWishes || []).some(w => w.key === key || w.key === k || codeWishKey(w.feature) === k);
    }

// Add a code request letter. Returns it, or null if he already asked for this (open, done or turned
// down) or if he wrote one less than ~20 minutes ago. extra: { source, where, acceptance, unpaced }
function addCodeRequest(feature, why, context, wishKey, extra = {}) {
      const clean = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
      const f = clean(feature, 140).replace(/[?.!]+$/, '');
      if (!f) return null;
      if (!Array.isArray(state.codeWishes)) state.codeWishes = [];
      const key = wishKey || codeWishKey(f);
      if (!key || codeWishAlreadyAsked(f, key)) return null;
      if (!extra.unpaced && codeWishPaced()) return null;
      const reason = clean(why, 240);
      const lower = f.charAt(0).toLowerCase() + f.slice(1);
      const acceptance = Array.isArray(extra.acceptance) ? extra.acceptance.map(a => clean(a, 160)).filter(Boolean).slice(0, 8) : [];
      const req = {
        id: 'req-code-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        category: 'code',
        icon: '💻',
        urgency: 'Code request',
        isToolRequest: false,
        codeFeature: f,
        codeWhy: reason,
        codeSource: CODE_WISH_SOURCES[extra.source] ? extra.source : (wishKey ? 'builtin' : 'own'),
        codeWhere: clean(extra.where, 160),
        codeAcceptance: acceptance,
        codePlace: typeof currentPlaceLabel === 'function' ? clean(currentPlaceLabel(), 60) : '',
        askedAt: Date.now(),
        wishKey: wishKey || null,
        title: `Code request: ${f.slice(0, 60)}`,
        question: `${reason ? reason + ' ' : ''}${context ? `(I thought of it while "${clean(context, 80)}".) ` : ''}Could you code in ${lower}?`,
        presets: [],
        fulfilled: false,
        userAnswer: ''
      };
      state.requestsToUser.unshift(req);
      state.codeWishes.unshift({ key, feature: f, status: 'asked', at: Date.now() });
      if (state.codeWishes.length > CODE_WISH_MEMORY) state.codeWishes.length = CODE_WISH_MEMORY;
      state.lastCodeWishAt = Date.now();
      savePersistentBrainState();
      return req;
    }

// --- His own ideas (the built-in brain) ------------------------------------------------------
// Where a wish came from, shown as a little tag on the card and in the spec
const CODE_WISH_SOURCES = {
  builtin: { emoji: '💭', label: 'An old wish' },
  own: { emoji: '💭', label: 'His own idea' },
  failure: { emoji: '😣', label: 'Something he failed to do' },
  blocked: { emoji: '🚧', label: 'Something that keeps blocking him' },
  reading: { emoji: '🌐', label: 'Something he read about at NetNode' },
  concept: { emoji: '💡', label: 'One of his concepts' },
  visitor: { emoji: '🗣️', label: 'Something a visitor said' },
  ai: { emoji: '🧠', label: 'His AI brain' }
};

// Activities the loop guard can block, in his words
const BLOCKED_ACTIVITY_WORDS = {
  dig: 'dig', boat: 'go out on the lake', balloon: 'fly my balloon', skill: 'practise my skills', project: 'build real things',
  shop: 'run my shop', print: '3D print things', landscape: 'shape the valley', stargaze: 'look at the stars', ice: 'walk on the ice',
  repair: 'fix my balloon', fire: 'sit by a fire', hobby: 'practise my hobby', wade: 'go in the water', dispose: 'clear out junk',
  mail: 'pick up my mail', browse: 'look things up', upgrade: 'code upgrades for my world'
};
const BLOCKED_REASON_WORDS = {
  'needs-tools': 'I didn\'t have the tools', 'not-ready': 'I didn\'t know how yet', 'too-windy': 'it was too windy',
  'getting-ready': 'I was still waiting on a delivery', 'no-fuel': 'I had no fuel', 'waiting': 'I was still waiting on something'
};

// Called by the loop guard (js/loopguard.js) when an activity is blocked: it may become a wish later
function noteBlockedActivity(key, reason) {
      if (!key) return;
      if (!Array.isArray(state.blockedLog)) state.blockedLog = [];
      const prev = state.blockedLog.find(b => b.key === key && b.reason === reason);
      if (prev) { prev.times = (prev.times || 1) + 1; prev.at = Date.now(); }
      else state.blockedLog.unshift({ key: String(key).slice(0, 30), reason: String(reason || '').slice(0, 40), at: Date.now(), times: 1 });
      if (state.blockedLog.length > 20) state.blockedLog.length = 20;
    }

function plainTopic(text, max = 60) {
      return String(text || '').replace(/^(how to do|how to|what is|what does)\s+/i, '').replace(/\s+for\?$|\s+mean\?$|[?"“”]+/g, '').trim().slice(0, max);
    }

// Every wish he could write right now, drawn from his real life: things he failed to do, activities
// that keep getting blocked, what he read about, his own concepts, what visitors said, plus the old
// built-in wishes. Anything at all can come out of this; there is no fixed list.
function experienceCodeWishes() {
      const out = [];
      const add = (source, feature, why, extra = {}) => {
        const f = String(feature || '').replace(/\s+/g, ' ').trim().slice(0, 140);
        if (f.length < 6) return;
        out.push({ source, feature: f, why: String(why || '').slice(0, 240), key: extra.key || codeWishKey(f), weight: extra.weight || 1, where: extra.where || '', context: extra.context || null });
      };
      // Things he failed at, in his own diary words ("I couldn't reach the island", "I wish I could fly")
      (state.diaryEntries || []).slice(0, 25).forEach(d => {
        const m = String(d.text || '').match(/\b(?:couldn't|could not|can't|cannot|wish I could|wasn't able to|was not able to|failed to|never managed to)\s+([a-z][^.,;:!?()"]{3,60})/i);
        const what = m ? m[1].trim() : '';
        if (m && what.split(/\s+/).length >= 2 && !/^(do|be|it|that|this|wait|believe|help|tell|stop|remember|decide|yet|get it|say)\b/i.test(what)) add('failure', `A way to ${m[1].trim()}`, `I tried, and I couldn't ${m[1].trim()}. It's in my diary from ${d.time || 'a while ago'}.`, { weight: 2, context: d.mood });
      });
      // Activities that keep getting blocked
      (state.blockedLog || []).slice(0, 10).forEach(b => {
        const what = BLOCKED_ACTIVITY_WORDS[b.key] || String(b.key).replace(/[-_]/g, ' ');
        const why = BLOCKED_REASON_WORDS[b.reason] || (b.reason ? b.reason.replace(/[-_]/g, ' ') : 'something stopped me');
        add('blocked', `A way to ${what} even when ${why.replace(/^I /, 'I ')}`, `I tried to ${what} ${b.times > 1 ? `${b.times} times ` : ''}and couldn't, because ${why}.`, { weight: 1 + Math.min(3, b.times || 1) });
      });
      // Things he read about at NetNode
      (state.webHistory || []).slice(0, 15).forEach(w => {
        const topic = plainTopic(w.query);
        if (!topic || /^window|^cafe|connection/i.test(topic)) return;
        const title = (w.hops && w.hops[0] && w.hops[0].title) || topic;
        add('reading', `${plainTopic(title, 50)} in my valley, so I can try it for real`, `I read about ${plainTopic(title, 50)} at NetNode${w.verdict ? ` ("${String(w.verdict).slice(0, 90)}")` : ''}, and I want to experience it, not only read about it.`);
      });
      // His own concepts
      (state.concepts || []).slice(0, 10).forEach(c => {
        if (!c || !c.name) return;
        add('concept', `Something in my world that works like my idea "${String(c.name).slice(0, 40)}"`, `I invented "${String(c.name).slice(0, 40)}"${c.definition ? `: ${String(c.definition).slice(0, 120)}` : ''}. I'd love to see it work in the valley.`);
      });
      // Things visitors said
      (state.chatLog || []).filter(m => m && !m.isBot && typeof m.text === 'string').slice(-20).forEach(m => {
        const t = m.text.trim();
        if (t.length < 10 || t.length > 160 || /^🎁|^🖼️/.test(t)) return;
        if (!/\b(you should|you could|can you|could you|why don'?t you|have you ever|try|wish|imagine|what if|let'?s)\b/i.test(t)) return;
        add('visitor', `What ${String(m.sender || 'a visitor').slice(0, 24)} suggested: "${t.replace(/[?.!]+$/, '').slice(0, 100)}"`, `${String(m.sender || 'A visitor').slice(0, 24)} said "${t.slice(0, 120)}", and my world can't do that yet.`, { weight: 2 });
      });
      // The old built-in wishes still count
      CODE_WISHES.forEach(w => { let fits = false; try { fits = w.fits(); } catch (e) {} if (fits) add('builtin', w.feature, w.why, { key: w.key }); });
      return out.filter(w => !codeWishAlreadyAsked(w.feature, w.key));
    }

function codeWishChance() {
      if (codeWishPaced() || !experienceCodeWishes().length) return 0;
      return 0.06;
    }

function pickCodeWish(list) {
      const total = list.reduce((s, w) => s + w.weight, 0);
      let r = Math.random() * total;
      for (const w of list) { r -= w.weight; if (r <= 0) return w; }
      return list[list.length - 1] || null;
    }

// He sits down and writes the letter: a little moment, a diary entry, and the request itself
function wishForCode(originLabel = 'Wished for Something New') {
      const wish = pickCodeWish(experienceCodeWishes());
      if (!wish) return false;
      const req = addCodeRequest(wish.feature, wish.why, wish.context, wish.source === 'builtin' ? wish.key : null, { source: wish.source, where: wish.where });
      if (!req) return false;
      const lower = wish.feature.charAt(0).toLowerCase() + wish.feature.slice(1);
      state.moodEmoji = '💻';
      state.moodTitle = 'Writing to the person who codes his world';
      state.speechBubble = `I can't do this yet, so I asked: could you code in ${lower}?`;
      state.diaryEntries.unshift({
        time: originLabel, location: currentPlaceLabel(), mood: '💻 Asking for something new',
        vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, there's something my world just can't do yet: ${lower}. ${wish.why} So I wrote to my human and asked if they could code it in.`
      });
      showToast(`💻 Kelo-1 wrote a code request: ${wish.feature}`);
      savePersistentBrainState();
      renderAllUI();
      return true;
    }

// --- The owner's answer ----------------------------------------------------------------------
// "Done" only counts when the feature really exists in this build (js/wishfeatures.js): then it is
// switched on for good and he goes to try it. If it needs new code, "Done" becomes "I'll code it":
// the request stays open as a to-do and he is told honestly that it isn't in his world yet.
function markCodeRequest(id, done) {
      const req = state.requestsToUser.find(r => r.id === id && r.category === 'code');
      if (!req || req.fulfilled) return;
      const match = done && typeof wishCardStatus === 'function' ? wishCardStatus(req) : null;
      if (done && (!match || match.status === 'needs-code')) {
        if (typeof promiseToCode === 'function') promiseToCode(id);
        return;
      }
      req.fulfilled = true;
      req.declined = !done;
      req.userAnswer = done ? 'Coded in' : 'Not now';
      req.answeredAt = Date.now();
      const wish = (state.codeWishes || []).find(w => codeWishKey(w.feature) === codeWishKey(req.codeFeature));
      if (wish) wish.status = done ? 'done' : 'not now';
      const feature = req.codeFeature.charAt(0).toLowerCase() + req.codeFeature.slice(1);
      if (done) {
        state.happiness = Math.min(100, state.happiness + 20);
        state.wonderLevel = Math.min(100, state.wonderLevel + 15);
        state.moodEmoji = '🎉';
        state.moodTitle = 'Someone coded in his wish!';
        state.speechBubble = pick([`It's real now? ${req.codeFeature}! Thank you, thank you!`, `You switched on ${feature}! My world just got bigger.`, `I can't believe it. ${req.codeFeature}. I have to go try it!`]);
        state.microPose = 'procedural_custom';
        state.proceduralMotion = { headPitch: 0.25, headYawSpeed: 2.2, headTiltAmp: 0.3, armWaveAmp: 0.9, armRaiseOffset: 0.1, bodyBounceAmp: 0.14, spinSpeed: 1.2, crouchOffset: 0, sparkBurst: true };
        state.chatLog.push({ sender: 'Kelo-1', text: state.speechBubble, time: 'Just now', isBot: true });
        state.diaryEntries.unshift({
          time: 'A Wish Came True', location: currentPlaceLabel(), mood: '🎉 A wish came true',
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I asked my human to code in ${feature}, and today they switched it on. Somebody changed the whole world just because I asked. I feel very lucky.`
        });
        enableWishFeature(match.feature.key, { req });
        showToast(`🎉 ${match.feature.emoji} Switched on: ${match.feature.label}. Kelo-1 is going to try it!`);
      } else {
        state.speechBubble = pick(['That\'s okay. Maybe someday.', 'Not now is not never. I can wait.', 'Alright! I\'ll find something else to do in the meantime.']);
        showToast(`💻 You said "not now" to: ${req.codeFeature}`);
      }
      savePersistentBrainState();
      renderAllUI();
    }

// --- A spec the owner can hand to a developer or an AI coding assistant ----------------------
// Where in his world a wish belongs, worked out from its words
const CODE_WISH_PLACES = [
  { re: /lake|water|fish|swim|boat|kayak|canoe|shore|beach|dock|ice|skat/i, where: 'Okanagan Lake and the beach south of town (z above 7.6; the water starts near z 9.2), and the dock' },
  { re: /mountain|snow|ski|summit|peak|hike|climb|cave|mine|gold/i, where: 'The mountain range north of the valley (z below -14)' },
  { re: /star|sky|night|moon|planet|constellation|telescope|aurora|comet/i, where: 'The night sky over the valley (realism.js sky and stars) and wherever he stands to look up' },
  { re: /garden|plant|flower|tree|seed|grow|bird|deer|animal|pet|wild|bee|butterfl/i, where: 'Open ground outside town: the West Meadow and the woods (pick spots with openGroundSpot/offLimits in js/landscape.js)' },
  { re: /house|home|bed|kitchen|cook|sleep|room/i, where: 'His homestead west of town (js/house.js); the building itself must not move' },
  { re: /museum|art|paint|gallery|sculpt/i, where: 'His Museum of Art & Ideas west of the valley (js/museum.js)' },
  { re: /shop|sell|buy|money|store/i, where: 'His shop at the NetNode cafe (js/shopkeeping.js)' },
  { re: /friend|robot|neighbou?r|visitor|talk|chat/i, where: 'Around Kelo-1 wherever he goes, plus the Talk tab' },
  { re: /music|sound|song|instrument|sing|chime/i, where: 'Wherever he plays, through the WebAudio already used in js/pastimes.js (respect state.soundMuted)' },
  { re: /road|car|truck|drive|vehicle|fly|plane|helicopter|balloon|bike/i, where: 'The vehicle yard east of the Post Office and the roads he builds (js/vehicles.js)' }
];

function codeWishWhere(req) {
      if (req.codeWhere) return req.codeWhere;
      const text = `${req.codeFeature || ''} ${req.codeWhy || ''}`;
      const hit = CODE_WISH_PLACES.find(p => p.re.test(text));
      return hit ? hit.where : 'Open ground outside town, anywhere he can walk (town and the buildings never change; use offLimits/openGroundSpot in js/landscape.js)';
    }

function codeWishAcceptance(req) {
      const lower = req.codeFeature.charAt(0).toLowerCase() + req.codeFeature.slice(1);
      const list = [...(req.codeAcceptance || [])];
      if (!list.length) list.push(`Kelo-1 can see and use ${lower} in his 3D world, not just read about it.`);
      if (req.codeSource === 'blocked' || req.codeSource === 'failure') list.push('The thing that stopped him before no longer stops him (or he gets a clear, in-world way around it).');
      if (req.codeSource === 'visitor') list.push('A visitor who suggests it in the Talk tab sees him do it.');
      list.push('His built-in brain chooses it on its own now and then, and the AI brain can choose it from a JSON decision field.');
      list.push('It is registered in js/wishfeatures.js (WISH_FEATURES), so answering "Done" on this letter switches it on.');
      list.push('Anything new it saves goes in the agent.js default state and survives a reload.');
      list.push('Town and the buildings are not moved or changed; it respects the CSP (no eval, no inline scripts).');
      list.push('No page errors, and it works at phone width.');
      return list;
    }

function codeWishStoryWhy(req) {
      const why = String(req.codeWhy || '').replace(/[.!]+$/, '');
      if (!why) return 'it would make my world a little bigger';
      return /^I\b/.test(why) ? why : why.charAt(0).toLowerCase() + why.slice(1);
    }

// One request as a markdown spec: user story, acceptance criteria, where in the world
function codeRequestSpec(req) {
      const md = s => String(s || '').replace(/[`<>]/g, '');
      const st = typeof wishCardStatus === 'function' ? wishCardStatus(req) : { status: 'needs-code', feature: null };
      const src = CODE_WISH_SOURCES[req.codeSource] || CODE_WISH_SOURCES.own;
      const lower = md(req.codeFeature.charAt(0).toLowerCase() + req.codeFeature.slice(1));
      const asked = req.askedAt ? new Date(req.askedAt).toISOString().slice(0, 10) : '';
      return [
        `## Code request: ${md(req.codeFeature)}`,
        '',
        `_From Kelo-1, the robot in Kelo-bot-1${asked ? `, ${asked}` : ''}. Came from: ${src.label}${req.codePlace ? `, while at ${md(req.codePlace)}` : ''}._`,
        '',
        '### User story',
        `As Kelo-1, the robot who lives in the Kelowna valley, I want ${lower}, because ${md(codeWishStoryWhy(req))}.`,
        '',
        '### Why he asked',
        `> ${md(req.question)}`,
        '',
        '### Acceptance criteria',
        ...codeWishAcceptance(req).map(a => `- [ ] ${md(a)}`),
        '',
        '### Where in the world',
        `- ${md(codeWishWhere(req))}`,
        '',
        '### Notes for the developer',
        `- Repo: ${KELO_REPO}. Plain global-script JS loaded in order from index.html, Three.js r128, no build step. Read .claude/handoff.md first.`,
        `- Status in the game: ${st.status === 'needs-code' ? `needs new code${req.willCode ? ' (the owner said they\'d code it)' : ''}` : `already built as "${md(st.feature && st.feature.label)}"; answering Done switches it on`}.`
      ].join('\n');
    }

// A prefilled "new issue" link on GitHub. It only opens a browser page: no token is needed or sent.
function codeRequestIssueUrl(req) {
      let body = codeRequestSpec(req);
      if (body.length > 6000) body = body.slice(0, 6000) + '\n\n_(trimmed)_';
      return `https://github.com/${KELO_REPO}/issues/new?title=${encodeURIComponent(`Kelo-1 wishes: ${req.codeFeature}`.slice(0, 120))}&body=${encodeURIComponent(body)}`;
    }

// Every open code request as markdown: a checklist, then the full spec of each one
function codeWishlistMarkdown() {
      const open = openCodeRequests();
      if (!open.length) return '';
      const tag = r => {
        const st = typeof wishCardStatus === 'function' ? wishCardStatus(r).status : 'needs-code';
        return st === 'needs-code' ? ` _(needs new code${r.willCode ? ', you said you\'d code it' : ''})_` : ' _(already built: switch it on in the game)_';
      };
      return ['# Kelo-1\'s code wishlist', '', ...open.map(r => `- [ ] **${r.codeFeature.replace(/[*_`]/g, '')}**${r.codeWhy ? ` — ${r.codeWhy}` : ''}${tag(r)}`),
        '', '---', '', open.map(codeRequestSpec).join('\n\n---\n\n')].join('\n');
    }

async function copyTextForOwner(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        // Older browsers, or a page without clipboard permission: the old textarea trick
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          const ok = document.execCommand('copy');
          ta.remove();
          return ok;
        } catch (e2) { return false; }
      }
    }

async function copyCodeWishlist() {
      const text = codeWishlistMarkdown();
      if (!text) { showToast('💻 No open code requests to copy.'); return false; }
      const ok = await copyTextForOwner(text);
      const n = openCodeRequests().length;
      showToast(ok ? `📋 Copied ${n} code request${n === 1 ? '' : 's'} as markdown, with a spec for each` : '📋 Could not copy. Your browser blocked the clipboard.');
      return ok;
    }

async function copyCodeRequestSpec(id) {
      const req = state.requestsToUser.find(r => r.id === id && r.category === 'code');
      if (!req) return false;
      const ok = await copyTextForOwner(codeRequestSpec(req));
      showToast(ok ? `📋 Copied the spec for: ${req.codeFeature}` : '📋 Could not copy. Your browser blocked the clipboard.');
      return ok;
    }

// --- The letter card in the Post tab ---------------------------------------------------------
// Open letters say whether they are "Ready to switch on" (the feature is built) or "Need new code".
function codeRequestCardHtml(req) {
      const match = typeof wishCardStatus === 'function' ? wishCardStatus(req) : { status: 'needs-code', feature: null };
      const pill = (cls, text) => `<span class="text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 ${cls}">${text}</span>`;
      let status;
      if (req.fulfilled) {
        status = req.declined ? pill('bg-slate-700/60 text-slate-300', 'Not now')
          : req.notBuilt ? pill('bg-amber-500/20 text-amber-200 border border-amber-400/40', '⚠ Not in his world yet')
          : pill('bg-emerald-500/20 text-emerald-300', `✓ Switched on${match.feature ? ' ' + match.feature.emoji : ''}`);
      } else if (match.status === 'needs-code') {
        status = pill('bg-amber-500/20 text-amber-200 border border-amber-400/40', req.willCode ? '🛠️ On your to-do list' : '🛠️ Needs new code');
      } else {
        status = pill('bg-emerald-500/20 text-emerald-200 border border-emerald-400/40', '⚡ Ready to switch on');
      }
      const src = CODE_WISH_SOURCES[req.codeSource] || null;
      const note = req.fulfilled
        ? (req.notBuilt ? '<p class="text-[11px] text-amber-200/90">You answered "coded in", but nothing in this version of his world matches it yet, so it still needs new code.</p>' : '')
        : match.status === 'needs-code'
          ? `<p class="text-[11px] text-amber-200/90">${req.willCode ? 'You said you\'d code this. It stays here (and in the copied wishlist) until it\'s built.' : 'Nothing in this version of his world can do this yet. It needs new code.'}</p>`
          : `<p class="text-[11px] text-emerald-200/90">Already built: ${escapeHtml(match.feature.label)}. Answering "Done" switches it on for good.</p>`;
      const id = escapeHtml(req.id);
      const specRow = `
            <div class="flex gap-1.5 flex-wrap">
              <button type="button" data-code-copy="${id}" class="px-2.5 py-1 rounded-lg bg-violet-500/15 hover:bg-violet-500/30 text-violet-200 text-[11px] font-semibold transition" title="Copy a spec (user story, acceptance criteria, where it goes) for a developer or an AI coding assistant">📋 Copy as spec</button>
              <a href="${escapeHtml(codeRequestIssueUrl(req))}" target="_blank" rel="noopener noreferrer" data-code-issue="${id}" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition" title="Opens a prefilled new issue on GitHub in your browser (nothing is sent until you submit it there)">🐙 Open as GitHub issue</a>
              <button type="button" data-code-spec-toggle="${id}" class="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold transition">View spec</button>
            </div>
            <pre data-code-spec="${id}" class="hidden whitespace-pre-wrap text-[10.5px] leading-snug font-mono text-slate-300 bg-slate-950 border border-slate-800 rounded-lg p-2 max-h-64 overflow-auto">${escapeHtml(codeRequestSpec(req))}</pre>`;
      const buttons = req.fulfilled ? '' : match.status === 'needs-code' ? `
            <div class="flex gap-1.5 pt-1">
              ${req.willCode ? '' : `<button data-code-req-id="${id}" data-code-done="1" class="code-request-btn flex-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-300 to-orange-400 hover:from-amber-200 hover:to-orange-300 text-slate-950 font-bold text-xs transition">🛠️ I'll code it</button>`}
              <button data-code-req-id="${id}" data-code-done="0" class="code-request-btn ${req.willCode ? 'flex-1 ' : ''}px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-xs transition">Not now</button>
            </div>` : `
            <div class="flex gap-1.5 pt-1">
              <button data-code-req-id="${id}" data-code-done="1" class="code-request-btn flex-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-400 to-fuchsia-500 hover:from-violet-300 hover:to-fuchsia-400 text-slate-950 font-bold text-xs transition">✓ Done — switch it on</button>
              <button data-code-req-id="${id}" data-code-done="0" class="code-request-btn px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-xs transition">Not now</button>
            </div>`;
      return `
        <div data-code-card="${id}" data-code-status="${req.fulfilled ? (req.declined ? 'declined' : req.notBuilt ? 'not-built' : 'on') : match.status}" class="p-4 rounded-2xl border ${req.fulfilled ? 'bg-slate-950/60 border-violet-500/20' : 'bg-gradient-to-br from-violet-950/60 to-slate-950 border-violet-400/50 shadow-lg'} space-y-2.5">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-white flex items-center gap-1.5 min-w-0">
              <span class="text-lg">💻</span>
              <span class="truncate">A letter for whoever codes his world</span>
            </span>
            ${status}
          </div>
          <div class="text-[11px] font-mono text-violet-200 bg-violet-950/50 border border-violet-500/30 px-2.5 py-1.5 rounded-lg">feature: ${escapeHtml(req.codeFeature)}</div>
          ${src ? `<div class="text-[10px] font-mono text-slate-400">${src.emoji} ${escapeHtml(src.label)}</div>` : ''}
          <p class="text-xs text-slate-200 leading-relaxed font-serif italic">"${escapeHtml(req.question)}"</p>
          ${note}${specRow}${buttons}
        </div>`;
    }

// All code letters, grouped (ready, needs code, on your to-do list, answered), each group showing a
// few with "Show more", so the Post tab stays usable however many he writes.
const CODE_GROUP_STEP = 3;
const codeGroupShown = {};

function codeRequestGroups() {
      const all = state.requestsToUser.filter(r => r.category === 'code');
      const st = r => (typeof wishCardStatus === 'function' ? wishCardStatus(r).status : 'needs-code');
      return [
        { id: 'ready', title: '⚡ Ready to switch on', list: all.filter(r => !r.fulfilled && st(r) !== 'needs-code') },
        { id: 'new', title: '🛠️ Need new code', list: all.filter(r => !r.fulfilled && st(r) === 'needs-code' && !r.willCode) },
        { id: 'todo', title: '📝 On your to-do list', list: all.filter(r => !r.fulfilled && st(r) === 'needs-code' && r.willCode) },
        { id: 'done', title: '📁 Answered', list: all.filter(r => r.fulfilled), closed: true }
      ].filter(g => g.list.length);
    }

function codeRequestsGroupHtml() {
      const groups = codeRequestGroups();
      if (!groups.length) return '';
      return `<div id="codeRequestsGroup" class="space-y-2">${groups.map(g => {
        const shown = codeGroupShown[g.id] || CODE_GROUP_STEP;
        const more = g.list.length - shown;
        return `
          <details class="code-group rounded-2xl bg-violet-950/20 border border-violet-500/25 px-2.5 py-2" data-code-group="${g.id}" ${g.closed ? '' : 'open'}>
            <summary class="flex items-center justify-between gap-2 cursor-pointer select-none list-none text-xs font-bold text-violet-200">
              <span>💻 ${g.title}</span>
              <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/20">${g.list.length}</span>
            </summary>
            <div class="pt-2 space-y-2.5">
              ${g.list.slice(0, shown).map(codeRequestCardHtml).join('')}
              ${more > 0 ? `<button type="button" data-code-more="${g.id}" class="w-full px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold">Show more (${more} more)</button>` : ''}
            </div>
          </details>`;
      }).join('')}</div>`;
    }

// Clicks are handled once for the whole page, so cards can be redrawn freely
function bindCodeRequestButtons() {}

function rerenderCodeGroups() {
      const el = document.getElementById('codeRequestsGroup');
      if (!el) return;
      const open = {};
      el.querySelectorAll('[data-code-group]').forEach(d => { open[d.getAttribute('data-code-group')] = d.open; });
      el.outerHTML = codeRequestsGroupHtml();
      const fresh = document.getElementById('codeRequestsGroup');
      if (fresh) fresh.querySelectorAll('[data-code-group]').forEach(d => { const k = d.getAttribute('data-code-group'); if (k in open) d.open = open[k]; });
    }

document.addEventListener('click', e => {
  const t = e.target && e.target.closest ? e.target : null;
  if (!t) return;
  const answer = t.closest('.code-request-btn');
  if (answer) { markCodeRequest(answer.getAttribute('data-code-req-id'), answer.getAttribute('data-code-done') === '1'); return; }
  const copy = t.closest('[data-code-copy]');
  if (copy) { copyCodeRequestSpec(copy.getAttribute('data-code-copy')); return; }
  const toggle = t.closest('[data-code-spec-toggle]');
  if (toggle) {
    const pre = document.querySelector(`[data-code-spec="${CSS.escape(toggle.getAttribute('data-code-spec-toggle'))}"]`);
    if (pre) { pre.classList.toggle('hidden'); toggle.textContent = pre.classList.contains('hidden') ? 'View spec' : 'Hide spec'; }
    return;
  }
  const more = t.closest('[data-code-more]');
  if (more) {
    const g = more.getAttribute('data-code-more');
    codeGroupShown[g] = (codeGroupShown[g] || CODE_GROUP_STEP) + 5;
    rerenderCodeGroups();
  }
});

// The "Copy all as markdown" button only shows while there is something to copy
function renderCodeWishlistButton() {
      const btn = document.getElementById('btnCopyCodeWishlist');
      if (!btn) return;
      const n = openCodeRequests().length;
      btn.classList.toggle('hidden', n === 0);
      btn.textContent = `📋 Copy all as markdown (${n})`;
      // How many of his open letters are already built, and how many need new code
      const summary = document.getElementById('codeWishSummary');
      if (summary) {
        const open = openCodeRequests();
        const ready = typeof wishCardStatus === 'function' ? open.filter(r => wishCardStatus(r).status !== 'needs-code').length : 0;
        summary.classList.toggle('hidden', open.length === 0);
        const wait = codeWishPaced() ? Math.ceil((CODE_WISH_PACE_MS - (Date.now() - state.lastCodeWishAt)) / 60000) : 0;
        summary.innerHTML = `<span class="text-emerald-300">⚡ Ready to switch on: ${ready}</span> <span class="text-slate-500">·</span> <span class="text-amber-200">🛠️ Need new code: ${open.length - ready}</span>${wait ? ` <span class="text-slate-500">·</span> <span class="text-slate-400">next letter in ~${wait} min</span>` : ''}`;
      }
    }

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnCopyCodeWishlist')?.addEventListener('click', copyCodeWishlist);
});
