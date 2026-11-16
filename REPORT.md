# REPORT: Kelo-1 brain 2 (branch `agent/brain2`)

Game branch: `agent/brain2`, merged with origin/main 5b0c4df. Tests are in `qa/` on this branch (`brain2.js`, `soak.js`, `sum.js`, plus the updated `brain.js`); the raw results are in `results/`.
Everything below was measured in Chromium (software GL) with Gemini mocked by a Playwright route. **No real model was called**, so "decision quality" is measured by a proxy: whether the fact that matters for the moment reaches the prompt (see 1).

## What was built
| File | What it does |
|---|---|
| `js/brainrank.js` | **Smarter memory.** The decision prompt sends a fixed core (vitals, place and time, focus, long goals, recent decisions, rules, trigger). Everything else is ranked against the moment (needs, night or day, season, place, focus and goal steps, the trigger) and sent within a 900-token budget, plus one line naming what was left out. Ranked items: each diary entry, core memory, letter, open task, skill, lesson, nearby place and thing he owns, and every feature's summary line. Untrusted text stays fenced. Optional reply fields are offered only when he can use them (no plant: no `runPlant`; the coding DSL about 30% of the time or when the moment is about code). |
| `js/goals.js`, `js/goaltemplates.js`, `GOALS.md` | **Long goals.** Each goal is goal -> stages -> tasks, with progress, blockers (`items`, `night`, `nextDay`, `season`, `skill`, `calm`, `ready`, `time`), steps spread over game days (`newDay`) and resume after reloads. Each goal is one agenda task of kind `goal`, so focus, pausing for sleep or a visitor, and resuming after a reload all reuse the agenda. He picks goals from his interests, the visitor's words and his NetNode reading (the source is recorded and shown in his diary). The AI sees his goals and up to 3 ideas, and can take one up with `"newGoal"`. 9 built-in templates. The API for the farm machine (`registerGoalTemplate`, `registerGoalAction`) is documented in GOALS.md. |
| `js/outcomes.js` | **Learns from results**, with deeper learning added at the owner's request ("super adaptable through real learning"). Every activity records: worked / blocked / failed, why, time taken, supplies used up and his mood change. Recent results count more than old ones (decay 0.93). He learns *when* things work (night or day, season, tired or rested, windy or calm), and *which fix* gets him past each kind of failure. He keeps a little pull towards things he has rarely tried. He notices what he likes and dislikes (chores excluded), and goes for a learned favourite when the moment suits it. He never retries the same failing plan while nothing has changed. A failing goal step gets its fix as a step first; a failed fix is set aside; after 3 tries the step is set aside. Diary lines include "Last time … so this time I'll …", "It worked this time!", "I've noticed a pattern: … goes wrong at night". Bounded in the save: 60 records, 40 activities, 20 lessons, measured at 24 KB worst case after 400 records. |
| `js/procbrain.js` | **Better without a key.** The no-key free decision picks its subject by relevance (season, night, nearby places, his concepts, his reading, his goals, his things). It weighs subjects by outcome learning and avoids his last decisions and diary. Diary lines are composed from 8 openers × 6 observations × several links (goal, lesson, concept, feeling) × closers, and re-rolled if over 75% similar to any of his last 40 entries. Multi-step work comes from the same long goals. |
| Small edits | `js/agent.js`: the ranked prompt, a `newGoal` field, `state.goals`/`state.outcomes`, `canTryKey` weighs outcomes, the favourite pick, `generateProceduralDecision` accepts a subject/verb. `js/loopguard.js`: records outcomes. `js/agenda.js`: a quiet wait writes no diary line. Repetition fixes in `js/agendalinks.js` (settled request), `js/postoffice.js` (mail run) and `js/tidyup.js` (keeps everything). `index.html`: two read-only Brain tab cards, "Long goals" and "What he learned from results". |

The charter, `brainUntrusted` fencing and the key-leak guard are unchanged. Old saves load: new fields default to empty, and `goalsAfterLoad`/`outcomeState` repair damaged entries.

## 1. Smarter memory: tokens and decision quality, same 5 fixtures (`qa/brain2.js memory`)
The fixtures share a busy life (25 diary entries, 10 core memories, 10+ things, 6 concepts). Each adds one fact that matters for the moment. The check: does that fact reach the prompt's state part?

| Fixture | Before (main) prompt / state tokens | After prompt / state tokens | Fact in the prompt, before / after |
|---|---|---|---|
| hungry, apples in the Storehouse | 5,240 / 2,492 | 3,931 / 1,509 | yes / yes |
| night, has a telescope | 5,430 / 2,624 | 3,615 / 1,546 | yes / yes |
| parcel waiting at the post office | 5,374 / 2,568 | 3,592 / 1,524 | yes / yes |
| paused task he must get back to | 5,388 / 2,582 | 3,615 / 1,547 | yes / yes |
| visitor asks about the frozen lake | 5,395 / 2,589 | 3,616 / 1,547 | yes / yes |

- The whole decision prompt dropped about 32% (5,365 → 3,674 tokens on average); the state part dropped about 40% (2,571 → 1,535).
- The relevant fact reached the prompt in 5 of 5 fixtures, before and after. Untrusted text was fenced in every prompt.
- What's left is mostly the reply format (about 2,000 tokens). I didn't touch it beyond gating the optional fields, because every caller parses it.
- `qa/brain.js` (the charter test) also measured the decision call: 3,535 tokens of context after, against 5,271 in the brainprompt report.
- Not measured: how a real model's choices change. No real key was available here.

## 2. Long goals (`qa/brain2.js goals`, 9/9 in the final run)
- He picked "Learn the night sky" from what the visitor said (source `visitor`).
- Goal -> 4 stages -> tasks, on the agenda as one task.
- He asked for a telescope through the Post Office and was blocked "waiting for telescope to arrive". It arrived, the blocker cleared and the step was done (33%).
- Planting was blocked in winter with a season blocker.
- A custom template and action made through `registerGoalTemplate`/`registerGoalAction` ("Build a big farm", 2 till steps + look back) ran to the end and went into history.
- The AI prompt line shows the goals.
- After a reload the goal was at the same stage (2) and progress (33%), and the agenda had it open again.

## 3. Learns from results (`qa/brain2.js learn`, 12/12, `results/brain2-learn.json`)
- A failure (`needs-tools`) becomes a lesson. The same plan is not retried while the world is unchanged, and is retried once he owns something new.
- Diary on the retry: "The last time I tried I didn't have the right tools, so this time I'll order the missing tool first and wait for it to arrive." Then "It worked this time! …".
- Prefers what worked: bias 1.80 for an activity that kept working, 0.30 for one that kept failing.
- Learns when: after 4 failures at night and 4 successes by day, the night factor was 0.41 and the day factor 1.78. Insight: `time:night`, goes wrong.
- Learns which fix works: after "order" failed twice and "mail" worked for `needs-tools`, it picks "mail" (`learned: true`).
- A failing goal step gets a fix step (research) first; after 3 tries it is set aside, not repeated.
- Bounded: 60 records / 40 activities / 20 lessons / 24,061 bytes after 400 records over 70 keys.

Bugs these tests found, now fixed:
- A failing goal step never got its fix: the same-plan guard ran first.
- A fix that failed kept being held back by that guard, so the goal stalled.

## 4. Better without a key
`qa/brain2.js nokey` (final run): 40 decisions in a row gave 37 distinct titles (16 verbs) and 40 distinct diary lines, never the same decision twice in a row. At night, night subjects came up ("Sit quietly with the stars over the valley", "Measure the moon on the lake").

### 2-game-day soak, no key, same seed (`qa/soak.js KEY=0 DAYS=2`, `results/soak-*-nokey.json`)
How it runs: Playwright's clock jumps 2 game days in 540 steps while the game runs for real. Math.random is seeded (42). A "visitor bot" delivers each request about a game hour after he asks.

| Per game day (days 0-1) | Before (main) | After (branch) |
|---|---|---|
| Activities | 50.5 | 67.5 |
| Distinct kinds of activity | 6.5 | 10.5 |
| Longest run of the same activity | 9 | 6 |
| Diary lines | 110.5 | 134.0 |
| Distinct diary lines | 76% | 74% |
| Most-repeated diary line (times in a day) | 11 ("that request was settled.") | 7 ("it was tidy-up time … still want it all") |
| Long goals finished / open at the end | 0 / 0 | 1 / 2 |
| Page errors | 0 | 0 |

Reading the numbers:
- Variety of *activities* is up: 6.5 → 10.5 kinds a day, and the longest same-activity run went from 9 to 6.
- The share of distinct diary lines did **not** improve (76% → 74%). Most repeats come from other features' fixed lines (the agenda, the Post Office, tidy-up), which fire many times a day when deliveries are frequent.
- I varied the worst three. The "after" column already includes the first two (settled request, mail run). The tidy-up fix (`f9cc851`) came after this soak and is **not measured** here.
- The first "after" run, before those fixes, had the settled-request line 20 times in one day (`results/soak-after-nokey-v1.json`).
- Goal completion without a key: 1 goal finished ("Become an expert on barnard's express", from his reading) and 2 in progress (71% and 0%).

### 2-game-day soak with a mocked key
`qa/soak.js KEY=1 DAYS=2 REAL_MIN=25`, same seed. The "before" is main 5b0c4df (without this work); the "after" is agent/brain2 with origin/main fa95c3f merged. The mocked model answers decisions from a fixed pool of 30 ideas and takes up the first goal idea it is offered every third decision. So these numbers measure the brain *around* the model (context, goals, outcomes), not a real model's taste. Both runs really used the key: 29 and 22 decision calls, no failed calls (`results/soak-*-key.json`, `llm`).

| Per game day (days 0-1) | Before (main) | After (branch) |
|---|---|---|
| Activities | 41.5 | 65.0 |
| Distinct kinds of activity | 12.0 | 12.5 |
| Longest run of the same activity | 6 | 3 |
| Diary lines | 87.0 | 83.5 |
| Distinct diary lines | 84% | 92% |
| Most-repeated diary line (times in a day) | 10 (tidy-up "still want it all") | 4 (the same line) |
| Long goals finished / open at the end | 0 / 0 | 3 / 2 |
| Average tokens per AI request (all kinds of calls) | 1,910 | 1,175 |
| Page errors | 0 | 0 |

- Goals finished with a key: "Explore every corner of the valley" (from his reading), "Build a real treehouse platform" (from a visitor) and "Build a real doghouse" (from his reading). Still open: a print collection at 0% and a reading deep-dive at 25%.
- Learning was used in the run: on day 2 the diary has "It worked this time! Last time I didn't have the right tools, so I made sure to …".
- The tidy-up line still repeats 4 times a day. My fix varies it only when he looked at things he could toss; with nothing to consider, the old line stays. That's a small follow-up, not done.

## Regressions and the charter test (branch, after merging origin/main 5b0c4df)
- `qa/brain.js`: **122/122**, no page errors (`results/brain-js.log`). The decision call is 3,535 tokens of context; the charter is unchanged at 786.
  - Note: on today's main the old version of this test fails 3 checks (the unscripted-experience call). Main now waits until he is free before that call (commit 0f2a872), and the test kept him busy. The test now frees him for that call; nothing in the game changed for it.
- harness `reload`, `ui`, `chat`, `vehicle`, `haul`, `basement`: all exit 0, **page errors: none** (`results/reg-*.log`). The only console errors are the harness's own 404s for outside URLs.
- `node --check` passes on every js file, and the duplicate top-level-name check prints nothing.
- No API key is committed. The tests use fake `TESTKEY-…` keys.

## Notes and open items
- **Final run on the final code** (agent/brain2 with origin/main fa95c3f merged): `qa/brain2.js all` **36/36**, no page errors (`results/brain2-all.log`). Memory fixtures in that run: 3,596-4,003 tokens, fact included 5/5. The table in section 1 is the earlier side-by-side run. The fa95c3f merge changed no game file (only the build step, workflows and notes), so the earlier regression and brain.js results apply to the same game code.
- `npm run build:site` on the final code bundles 110 scripts, including the five new brain files.
- origin/main fa95c3f does not contain this work yet (no `js/goals.js` there). The later fixes f587d55, 092c2e2 and f9cc851 are on agent/brain2 only.
- The soak's game days are compressed (fast-forwarded clock), so walking takes less game time than in real play. Counts are comparable only between runs of the same harness.
- "Decision quality" with a real model is unverified. Only prompt contents and the built-in brain's behaviour were measured.
- The first key soaks were invalid and are discarded. The game re-reads keys from localStorage (`recheckKeys`, js/main.js), and the test only set the in-memory key, so both ran without a key. `qa/soak.js` now stores the fake key.
