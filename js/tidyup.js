// Kelo-bot-1 — js/tidyup.js
// Loaded after takeout.js. Tidy-up time: every half hour (real time, while the game is open) Kelo-1
// is reminded to go through his things and let go of what he
// doesn't want or need any more: junk, broken things, empty spools, spare copies, things he hasn't
// touched in ages, and, when the Museum is crowded, an old piece or two. He keeps his hobby tools, the
// gear he relies on, anything for sale in his shop, and whatever he used lately. With an AI brain, the
// AI makes the final call from the list; otherwise he goes by how unwanted each thing is.

const TIDY_EVERY_MS = 30 * 60 * 1000; // a tidy-up reminder every half hour
const UNTOUCHED_DAYS = 21;        // not used for this many of his days counts as "not needed"
const MAX_TOSSES_PER_TIDY = 3;
let tidyRunning = false;

function worldDayNow() {
      return typeof worldNow === 'function' ? worldNow().day : Math.floor(Date.now() / 43200000);
    }

// When he last used something (fetching it off a shelf counts), and when he first had it
function noteItemUsed(name) {
      if (!name) return;
      state.itemUse[String(name).toLowerCase()] = worldDayNow();
    }

function lastUsedDay(name) {
      const key = String(name).toLowerCase();
      if (state.itemUse[key] === undefined) state.itemUse[key] = worldDayNow(); // first noticed today
      return state.itemUse[key];
    }

function storageCrowded() {
      const store = typeof storehouseBasementLevels === 'function' ? storehouseBasementLevels() : 0;
      const museum = typeof museumBasementLevels === 'function' ? museumBasementLevels() : 0;
      return store >= 2 || museum >= 2;
    }

function tidyUpDue() {
      if (tidyRunning || state.isSleeping) return false;
      if (!state.lastTidyAt) { state.lastTidyAt = Date.now(); return false; } // start counting from now
      return Date.now() - state.lastTidyAt >= TIDY_EVERY_MS;
    }

// Things he relies on and keeps no matter what
function mustKeep(name) {
      const n = String(name);
      if (state.hobbies.some(h => h.tool === n)) return 'it\'s my hobby gear';
      if (typeof TOOL_NEEDS !== 'undefined' && Object.values(TOOL_NEEDS).some(t => t.re.test(n)) && !(typeof isBrokenItem === 'function' && isBrokenItem(n))) return 'I need it for digging';
      if (typeof vehicleTypeFor === 'function' && vehicleTypeFor(n)) return 'it gets me around';
      if (/telescope|3d printer|axe|snow ?shoes?|skis?\b|kite/i.test(n) && !(typeof isBrokenItem === 'function' && isBrokenItem(n))) return 'I still use it';
      if (state.shop && state.shop.listings && state.shop.listings.some(l => l.name === n || l.ref === n)) return 'it\'s for sale in my shop';
      return null;
    }

// Everything worth reconsidering, most unwanted first: { name, kind: 'item'|'sculpture'|'painting', score, reason }
function tidyCandidates() {
      const out = [];
      const names = typeof ownedItemNames === 'function' ? ownedItemNames() : [];
      const today = worldDayNow();
      const counted = {};
      names.forEach(n => { counted[n] = (counted[n] || 0) + 1; });
      [...new Set(names)].forEach(n => {
        if (mustKeep(n)) return;
        const b = state.belongings.find(x => x.name === n);
        const idle = today - lastUsedDay(n);
        let score = 0, reason = '';
        if (b && b.category === 'junk') { score = 9; reason = 'it\'s just junk from a dig'; }
        else if (typeof isBrokenItem === 'function' && isBrokenItem(n)) { score = 8; reason = 'it\'s broken'; }
        else if (typeof isPrinterSupply === 'function' && isPrinterSupply(n) && /empty/i.test(n)) { score = 8; reason = 'the spool is empty'; }
        else if (counted[n] > 1 && !(typeof isConsumableItem === 'function' && isConsumableItem(n))) { score = 6; reason = 'I have more than one'; }
        else if (idle >= UNTOUCHED_DAYS) { score = 3 + Math.min(3, Math.floor(idle / UNTOUCHED_DAYS)); reason = `I haven't touched it in ${idle} days`; }
        if (score) out.push({ name: n, kind: 'item', score, reason });
      });
      // A crowded Museum: the oldest pieces are up for reconsideration too
      if (typeof museumBasementLevels === 'function' && museumBasementLevels() >= 2) {
        allMuseumSculptures().slice(0, 4).forEach(c => out.push({ name: c.title, kind: 'sculpture', score: 2, reason: 'the Museum is crowded and it\'s one of my oldest pieces' }));
        allMuseumPaintings().filter(m => !m.keep && !(m.kind === 'art' && typeof ensureShop === 'function' && ensureShop().listings.some(l => l.painting && l.painting.id === m.id))).slice(0, 2).forEach(m => out.push({ name: m.text, kind: 'painting', score: 2, reason: 'the Museum is crowded and it\'s one of my first paintings' }));
      }
      return out.sort((a, b) => b.score - a.score);
    }

// Ask the AI which to let go of (if there is one); otherwise the most unwanted few
async function chooseWhatToToss(candidates) {
      if (!candidates.length) return [];
      if (typeof hasLLMKey === 'function' && hasLLMKey()) {
        const prompt = `You are Kelo-1, tidying your Storehouse and Museum. These are things you might not want or need any more:
${candidates.slice(0, 15).map((c, i) => `${i + 1}. ${c.name} (${c.kind}) - ${c.reason}`).join('\n')}
Pick up to ${MAX_TOSSES_PER_TIDY} to throw into your Disposal Pit (they're gone forever). Keep anything you still value.
Return ONLY JSON: {"toss": [{"number": n, "why": "1 short sentence"}], "keep": "1 sentence about what you decided to keep and why"}`;
        const parsed = await callLLMJSON([{ text: prompt }]).catch(() => null);
        if (parsed && Array.isArray(parsed.toss)) {
          const picks = parsed.toss.slice(0, MAX_TOSSES_PER_TIDY)
            .map(t => ({ ...candidates[Number(t.number) - 1], why: String(t.why || '').slice(0, 160) }))
            .filter(c => c && c.name);
          picks.keepNote = typeof parsed.keep === 'string' ? parsed.keep.slice(0, 240) : '';
          return picks;
        }
      }
      // Built-in brain: definitely the junk and broken things, then at most one he's merely not using
      const sure = candidates.filter(c => c.score >= 6).slice(0, MAX_TOSSES_PER_TIDY);
      const maybe = candidates.filter(c => c.score < 6 && Math.random() < 0.5).slice(0, Math.max(0, Math.min(1, MAX_TOSSES_PER_TIDY - sure.length)));
      return [...sure, ...maybe].map(c => ({ ...c, why: `${c.reason[0].toUpperCase()}${c.reason.slice(1)}.` }));
    }

async function waitUntilFree(maxMs = 180000) {
      const start = Date.now();
      while (Date.now() - start < maxMs) {
        if (!(state.isBusy || state.isBuilding || state.isPracticing || state.isCollectingMail || state.isSleeping)) return true;
        await new Promise(r => setTimeout(r, 1000));
      }
      return false;
    }

// The reminder, the look through his things, and the trips to the Disposal Pit
async function startTidyUp(originLabel = 'Tidy-Up Time') {
      if (tidyRunning) return false;
      tidyRunning = true;
      state.lastTidyAt = Date.now();
      try {
        const crowded = storageCrowded();
        showToast(`🧹 Reminder: time for Kelo-1 to tidy up${crowded ? ' (his storage is getting crowded)' : ''}`);
        state.moodEmoji = '🧹';
        state.moodTitle = 'Tidy-up time: going through his things';
        state.speechBubble = crowded ? 'My Storehouse and Museum are spilling into the basements. Time to let some things go.'
          : "Tidy-up time. Let's see what I don't need any more.";
        renderAllUI();
        const candidates = tidyCandidates();
        const picks = await chooseWhatToToss(candidates);
        const kept = candidates.filter(c => !picks.some(p => p.name === c.name)).slice(0, 3).map(c => c.name);
        state.diaryEntries.unshift({
          time: originLabel, location: 'his Storehouse', mood: '🧹 Tidy-up time',
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: picks.length
            ? `Dear Diary, it was tidy-up time. I decided to let go of ${picks.map(p => p.name).join(', ')}.${picks.keepNote ? ' ' + picks.keepNote : kept.length ? ` I thought about ${kept.join(', ')} too, but I'm keeping them for now.` : ''}`
            : 'Dear Diary, it was tidy-up time. I went through everything and I still want it all. Everything has its place.'
        });
        savePersistentBrainState();
        renderAllUI();
        // One trip to the pit per thing, each when he's free (disposeItem fetches it from whichever floor it's on)
        let tossed = 0;
        for (const p of picks) {
          if (!(await waitUntilFree())) break;
          const done = p.kind === 'item' ? await disposeItem(p.name, p.why, originLabel)
            : await takeOutOfMuseum(p.name, 'dispose', p.why, originLabel);
          if (done) tossed++;
        }
        if (tossed) {
          state.calmLevel = Math.min(100, state.calmLevel + 6);
          state.speechBubble = `All tidied up: ${tossed} thing${tossed === 1 ? '' : 's'} gone. There's more room to breathe.`;
          renderAllUI();
        }
        return true;
      } finally {
        tidyRunning = false;
      }
    }

function tidySummaryForAI() {
      const mins = state.lastTidyAt ? Math.max(0, Math.round((TIDY_EVERY_MS - (Date.now() - state.lastTidyAt)) / 60000)) : 30;
      const c = tidyCandidates();
      return `${c.length ? `things you might not need: ${c.slice(0, 5).map(x => x.name).join(', ')}` : 'nothing obviously unneeded'}; next tidy-up in ${mins} minutes${storageCrowded() ? ' (your storage is crowded)' : ''}`;
    }
