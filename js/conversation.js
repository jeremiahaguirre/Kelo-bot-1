// Kelo-bot-1 — js/conversation.js
// Loaded after netnode.js. Talking with Kelo-1: he works out what kind of thing the visitor said
// (a greeting, a question about him, a request, or just something they told him) and answers it.
// He keeps a vocabulary. Words he has never come across send him to the NetNode cafe to look them
// up on Wikipedia; then he comes back and says what he found, and remembers it for next time.

// Everyday words every robot is born knowing (plus anything in his world: places, things he owns...)
const CORE_WORDS = new Set(`a about above after again all also am an and any are around as at away back be because been before being
below best better between big both but by can cannot come could day did do does doing done down each even every far few find first
for from get give go going good got great had has have he hello her here hey hi him his how i if in into is it its just keep kind
know last let like little look lot love made make many may me more most much must my near need never new next nice no not now of off
oh ok okay old on once one only or other our out over own people place please put really right said same say see she should show
so some something sometimes soon still such sure take tell than thank thanks that the their them then there these they thing things
think this those time to today together too try two up us use very want was way we well went were what when where which while who
why will with without would yes yet you your yours good morning evening night afternoon bye goodbye welcome friend fun happy sad
eat food water drink sleep tired hungry thirsty play work build dig walk run fly swim weld paint draw read write talk sing music
lake mountain island valley tree trees sky sun moon star stars snow rain wind cold hot warm weather home house robot name doing feel
feeling today tomorrow yesterday world beautiful cool awesome amazing wonderful idea ideas question answer learn learned help
saw seen said told took taken gave given came found felt thought brought bought ate drank slept ran swam flew wrote read heard
deep shallow high low tall short long wide narrow small large huge tiny fast slow quick early late hard soft easy heavy light
dark bright loud quiet clean dirty full empty open close closed red blue green yellow orange purple pink black white brown grey gray
dog cat bird fish horse cow animal animals zoo park beach road car boat bike train plane school job family mom dad mother father
brother sister child children kid kids man woman boy girl baby person someone everyone nobody anything everything nothing
morning week month year hour minute second birthday holiday summer winter spring autumn fall season weekend
always usually often never maybe probably almost enough already ever also instead though although because since until
ask bring buy call carry change check clean cook cut drive fall fill fix follow forget grow hear hold hope join jump kick kill
laugh leave lie listen live lose meet miss move open pay pick plan pull push reach rest return ride rise save sell send set
share shut sit smile sound speak spend stand start stay stop study swim teach throw touch travel turn understand visit wait
wake wash watch wear win wish wonder worry yell game games movie movies song songs book books story picture photo video
phone computer internet website city town country river ocean sea forest field garden flower flowers rock stone sand dirt
fire ice air light power money price gift present box door window wall floor roof table chair bed room kitchen`.split(/\s+/));

const STOP_WORDS = new Set('a an the and or but of to in on at for with is are was were be been am i you he she it we they me my your our'.split(' '));

function knowsWord(word) {
      const w = word.toLowerCase();
      if (CORE_WORDS.has(w) || state.vocabulary[w]) return true;
      // Simple endings of words he knows (walks, walked, walking, trees)
      const stem = w.replace(/(ing|ed|es|s|ly)$/, '');
      if (stem.length > 2 && (CORE_WORDS.has(stem) || state.vocabulary[stem])) return true;
      // Anything from his own world: places, things he owns, his concepts and hobbies
      const world = [
        ...Object.values(TOWN_LOCATIONS).map(l => `${l.name} ${l.building}`),
        ...[...state.toolInventory, ...state.toys.map(t => t.name), ...state.belongings.map(b => b.name)],
        ...state.concepts.map(c => c.name), ...state.hobbies.map(h => h.name), ...state.webHistory.map(h => h.query)
      ].join(' ').toLowerCase();
      return new RegExp(`\\b${w.replace(/[^a-z0-9]/g, '')}\\b`).test(world);
    }

// The words in a message he doesn't know yet (longest first; numbers and very short words skipped)
function unknownWords(message) {
      const words = (String(message).toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []).map(w => w.replace(/'s$/, ''));
      return [...new Set(words)].filter(w => !STOP_WORDS.has(w) && !knowsWord(w)).sort((a, b) => b.length - a.length);
    }

function classifyMessage(msg) {
      const m = msg.toLowerCase().trim();
      if (/^(hi|hello|hey|yo|good (morning|afternoon|evening)|greetings)\b/.test(m) && m.split(/\s+/).length <= 5) return 'greeting';
      if (/^(bye|goodbye|see (you|ya)|good ?night)\b/.test(m)) return 'farewell';
      if (/^(thanks|thank you|ty)\b/.test(m)) return 'thanks';
      if (/^(please )?(build|make|weld|create|sculpt|dig|plant|chop|paint)\b/.test(m) || /\bcan you (build|make|weld|create|dig|plant|paint)\b/.test(m)) return 'request';
      // "Did you know..." is the visitor telling him something
      if (/^(did you know|guess what|you know what|fun fact)\b/.test(m)) return 'statement';
      if (/\?$/.test(m) || /^(what|why|how|who|where|when|which|do|does|did|are|is|can|could|would|will|have|has)\b/.test(m)) return 'question';
      return 'statement';
    }

// Answers to questions about himself, from what is really going on
function answerAboutHimself(msg) {
      const m = msg.toLowerCase();
      const owned = [...state.toolInventory, ...state.toys.map(t => t.name), ...state.belongings.map(b => b.name)];
      if (/how are you|how do you feel|how('| a)re you (doing|feeling)|you ok/.test(m)) {
        const low = [['energy', state.health], ['fullness', state.fullness], ['calm', state.calmLevel]].filter(([, v]) => v < 40).map(([k]) => k);
        return low.length ? `Honestly? A bit low on ${low.join(' and ')} right now. But I'm curious as ever.` : `I feel good! Energy ${state.health}%, and my wonder is at ${state.wonderLevel}%.`;
      }
      if (/what('| a)?re you doing|what are you up to|what('s| is) up/.test(m)) return `Right now: ${state.moodTitle.toLowerCase()}.`;
      if (/where are you|where('s| is) kelo/.test(m)) return `I'm at ${currentPlaceLabel().replace(/^his /i, 'my ')}.`;
      if (/your name|who are you/.test(m)) return "I'm Kelo-1. I woke up in this valley and I'm finding out what everything is.";
      if (/what (do|did) you (have|own)|what('s| is) in (your|the) storehouse/.test(m)) return owned.length ? `I have ${owned.length} things. A few: ${owned.slice(0, 5).join(', ')}.` : "Nothing yet. Everything I own comes through the post office.";
      if (/what (have|did) you (make|build|made|built)/.test(m)) return state.inventedCreations.length ? `I've made ${state.inventedCreations.length} things. The latest is "${state.inventedCreations[0].title}".` : "Nothing yet, but I keep thinking about it.";
      if (/what do you (know|think)|what('s| is) your (opinion|worldview)/.test(m)) return `Here's where I'm at: ${state.worldviewManifesto}`;
      if (/how old|how long/.test(m)) return `I've been awake for ${typeof daysAlive === 'function' ? daysAlive() : 1} of my days.`;
      if (/what season|what time|what day/.test(m) && typeof worldNow === 'function') { const w = worldNow(); return `It's ${w.season.toLowerCase()}, day ${w.day}, ${clockLabel(w.hour)}.`; }
      if (/do you (like|love)/.test(m)) {
        const thing = m.replace(/.*do you (like|love)\s+/, '').replace(/\?$/, '').trim();
        return thing ? `${state.likes.some(l => (l.text || l.topic || '').toLowerCase().includes(thing)) ? 'Yes, I really do.' : "I'm not sure yet. I'll have to try"} ${thing}.` : null;
      }
      return null;
    }

// Learn a word at NetNode. Returns what he found (or null if nothing turned up)
async function lookUpWord(word) {
      // The real internet, no AI key needed: Wikipedia, Wiktionary and DuckDuckGo (js/netnode.js)
      const article = typeof lookUpAnywhere === 'function' ? await lookUpAnywhere(word) : null;
      const sentence = article ? ((article.extract.match(/^[^.]*\./) || [article.extract])[0]).slice(0, 240) : '';
      state.vocabulary[word] = { meaning: sentence || 'I looked but could not find it.', from: article ? article.title : null, at: Date.now() };
      if (article) {
        state.webHistory.unshift({ query: `What does "${word}" mean?`, time: 'Just now', verdict: sentence, hops: [{ title: article.title, url: article.url, extract: article.extract.slice(0, 280) }] });
        if (state.webHistory.length > 12) state.webHistory.length = 12;
      }
      return sentence || null;
    }

async function walkToNetNodeAndLookUp(words, visitor) {
      for (let i = 0; i < 240 && (state.isBusy || state.isBuilding || state.isPracticing); i++) await new Promise(r => setTimeout(r, 250));
      state.isBusy = true;
      state.isBrowsing = true;
      try {
        const cafe = TOWN_LOCATIONS.cyber;
        state.currentLocKey = 'cyber';
        state.customPlaceName = null;
        state.targetPos = { x: cafe.x, z: cafe.z };
        state.moodEmoji = '📖';
        state.moodTitle = `Looking up "${words[0]}"`;
        renderAllUI();
        await waitForArrival(90000);
        const found = [];
        for (const w of words.slice(0, 2)) {
          const meaning = await lookUpWord(w);
          found.push([w, meaning]);
        }
        return found;
      } finally {
        state.isBusy = false;
        state.isBrowsing = false;
      }
    }

function sayToVisitor(text, visitor) {
      state.speechBubble = text;
      state.chatLog.push({ sender: 'Kelo-1', text, time: 'Just now', isBot: true });
      renderAllUI();
    }

// The main entry: reply to what the visitor actually said
async function respondToVisitor(visitor, message) {
      const kind = classifyMessage(message);
      const unknown = unknownWords(message);

      // With an AI brain: answer the actual message, with his situation and vocabulary as context
      if (hasLLMKey()) {
        const prompt = `You are Kelo-1, a curious robot living in a valley near Kelowna. A visitor named ${visitor} just said to you: "${message}".
Answer what they actually said: if it's a question, answer it; if it's a request, say whether and how you'll do it; if it's news, react to it. Speak in first person, 1-3 sentences, warm and curious.
Your situation: at ${currentPlaceLabel()}, doing "${state.moodTitle}". Energy ${state.health}%, fullness ${state.fullness}%, calm ${state.calmLevel}%.
You own: ${[...state.toolInventory, ...state.toys.map(t => t.name), ...state.belongings.map(b => b.name)].slice(0, 15).join(', ') || 'nothing yet'}.
Your outlook: "${state.worldviewManifesto}".
Words you learned recently: ${Object.keys(state.vocabulary).slice(-15).join(', ') || 'none'}.
Return ONLY JSON: {"reply": "...", "unknownWords": [words in their message you genuinely don't understand and want to look up, usually none], "wantsToAct": null OR "a short description of something you decide to go and do because of this"}`;
        const parsed = await callLLMJSON([{ text: prompt }]);
        if (parsed && typeof parsed.reply === 'string' && parsed.reply.trim()) {
          sayToVisitor(parsed.reply.trim().slice(0, 600), visitor);
          const toLearn = (Array.isArray(parsed.unknownWords) ? parsed.unknownWords : []).filter(w => typeof w === 'string' && !state.vocabulary[w.toLowerCase()]).map(w => w.toLowerCase().slice(0, 40));
          if (toLearn.length) await explainAfterLookingUp(toLearn, visitor, message);
          if (typeof parsed.wantsToAct === 'string' && parsed.wantsToAct.trim()) doWhenFree(() => decideNextAction(`${visitor} said: "${message}". You decided: ${parsed.wantsToAct.slice(0, 200)}`, `Talking with ${visitor}`));
          savePersistentBrainState();
          return;
        }
      }

      // Built-in brain
      if (kind === 'greeting') return sayToVisitor(`Hi ${visitor}! ${pick(['It is good to see you.', 'I was just thinking about the lake.', `I'm ${state.moodTitle.toLowerCase()}.`])}`, visitor);
      if (kind === 'farewell') return sayToVisitor(`Bye ${visitor}! Come back soon. I'll tell you what I find.`, visitor);
      if (kind === 'thanks') return sayToVisitor(`You're welcome, ${visitor}!`, visitor);
      if (unknown.length) {
        sayToVisitor(`Hmm, I don't know what "${unknown[0]}" means${unknown.length > 1 ? `, or "${unknown[1]}"` : ''}. Let me go and look it up at NetNode.`, visitor);
        await explainAfterLookingUp(unknown, visitor, message);
        return;
      }
      if (kind === 'question') {
        const answer = answerAboutHimself(message);
        if (answer) return sayToVisitor(answer, visitor);
        // A question about the wider world: he looks the main topic up
        const topic = (message.toLowerCase().match(/[a-z][a-z'-]{3,}/g) || []).filter(w => !CORE_WORDS.has(w) && !STOP_WORDS.has(w))[0];
        if (topic) {
          sayToVisitor(`Good question. I'm not sure, so I'll go and find out about ${topic}.`, visitor);
          await explainAfterLookingUp([topic], visitor, message);
          return;
        }
        return sayToVisitor("I'm not sure how to answer that yet. Can you ask it another way?", visitor);
      }
      if (kind === 'request') {
        sayToVisitor(`Ooh, ${visitor}, I like that idea. I'll see what I can do.`, visitor);
        return synthesizeUnboundedExperience(message, `Asked by ${visitor}`);
      }
      // Something they told him: he takes it in and reacts to it
      const echo = message.length > 60 ? message.slice(0, 57) + '...' : message;
      const fact = message.replace(/^(did you know|guess what|you know what|fun fact)[,:]?\s*(that\s+)?/i, '').replace(/\?$/, '').trim();
      const told = fact && fact !== message ? `${fact[0].toUpperCase()}${fact.slice(1)}? ` : '';
      sayToVisitor(`${told}${pick([`Thank you for telling me that, ${visitor}. I'll think about it.`, `I didn't know that! I'll remember it, ${visitor}.`, `Really? That gives me something new to wonder about.`])}`, visitor);
      state.curiosityQueue = [...new Set([echo.slice(0, 60), ...state.curiosityQueue])].slice(0, 10);
    }

async function explainAfterLookingUp(words, visitor, message) {
      const found = await walkToNetNodeAndLookUp(words, visitor);
      const learned = found.filter(([, m]) => m);
      const reply = learned.length
        ? `I looked it up! ${learned.map(([w, m]) => `"${w}": ${m}`).join(' And ')} Now I understand what you meant, ${visitor}.`
        : `I searched for "${found.map(([w]) => w).join('" and "')}" but couldn't find anything. Could you explain it to me, ${visitor}?`;
      sayToVisitor(reply.slice(0, 700), visitor);
      state.diaryEntries.unshift({
        time: 'Learning New Words', location: 'NetNode Cyber Cafe', mood: '📖 Learned a new word',
        vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, ${visitor} said "${message.slice(0, 120)}" and I didn't understand all of it, so I looked it up. ${learned.map(([w, m]) => `"${w}" means: ${m}`).join(' ')}`
      });
      savePersistentBrainState();
      renderAllUI();
    }
