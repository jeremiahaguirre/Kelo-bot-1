# Audit: Kelo-1's life and world — bugs, logic and functionality

Branch with the fixes: **`agent/audit-life`** (from `main` at 8850b18). Each fix is its own small commit.
Tools on this branch (`qa-results-audit-life`, from `qa-tools`): `qa/soak.js` (long soak on a fake clock) and
`qa/lifetests.js` (one regression check per fix).

Scope: his decisions and life (agent, loop guard, agenda, memory, needs, conversation, growth/dreams, projects,
BOMs, assembly, trips, vehicles, mining, landscape, groundwork, roadworks, plants/plant care, seasons, weather, wind,
hobbies, pastimes, painting, companions, wildlife, disposal/landfill, item use, know-how) and movement/world
(scene, motion, IK, mocap, chunks, cameras, minimap). Workshop machines, town and UI were left to the other audit.

## Fixed (most severe first)

| # | Severity | What was wrong (evidence) | Fix (commit) | Test |
|---|---|---|---|---|
| 1 | Save/load, data loss | `state.makerKinds / makerThings / makerOrders / makerUses` (js/shopmaker.js:73-78) are created lazily, after the save is loaded. `loadPersistentBrainState` (js/agent.js:1271) only restores keys that exist in the default `state`, so every reload dropped all Workshop maker orders and learned kinds, and agenda `make` tasks were then abandoned ("the order fell off my list", agendalinks.js:198). A scan of every `state.X =` in js/ against the defaults found these four as the only saved fields missing. | Listed in the default state (05605d8) | `makerReload` |
| 2 | Stuck/loop | A blocked agenda step waits with `waitingFor.until` (agenda.js:315), but `agendaWaitSatisfied` asked the kind's `check()` first and returned true, so the retry time was ignored: every ~6 s the task went waiting → ready → resume → blocked, writing two diary entries and a save each time, and most life ticks went to nothing (e.g. a painting plan during the `paint` cooldown). | `until` is checked first (ae4c819) | `agendaUntil` |
| 3 | Logic, long-lived | Core memories stopped forming for good once the diary archive hit its cap (1500 in the browser): `totalDiaryCount()` stops growing, so `total - lastDistilledAt` never reaches 8 again (memory.js:115). | New entries are counted by time (`life.lastDistilledTime`); old saves fall back to the old rule once (51bd2b1) | `coreMemoryCap` |
| 4 | Logic, interrupts | `synthesizeUnboundedExperience` (agent.js:921) only checked `isBusy`. A visitor's chat request (conversation.js:200), a photo, or a letter opened on a mail run made him walk off while asleep (`isSleeping`+`isPracticing`), mid-build or mid-job; that job's own `waitForArrival` then timed out at the wrong spot. When `isBusy` it was silently dropped. | Waits in the when-free queue (0f2a872) | `synthWhileAsleep` |
| 5 | Logic, lost jobs | `doWhenFree` de-duplicates jobs without a key by `fn.toString()` (agent.js:2220). Closures from one call site have the same text, so a second discard/use/take-out/dig/project from the AI, a second fuel refill (knowhow.js:103/182 — and `refuelsQueued` then blocked a retry for 4 min), a second tool to learn, machine/job/medium to research, painting, print or skill was silently dropped. | Keys at the 19 call sites whose arguments vary (4dc1418) | `queueKeys` |
| 6 | Logic, lost reactions | `decideNextAction` waited at most 90 s for him to be free and then returned, dropping a gift reaction or a visitor's answer (comment said the opposite). | Queued for when he is free when there is a trigger (0eae740) | (by reading; a 90 s wait) |
| 7 | Freeze risk | No timeout on the Gemini `fetch` or the Claude SDK call: a hung request keeps `isBusy` set (and the letter path awaits it in the life scheduler), so his life stops until the browser gives up. | 90 s / 3 min timeouts (c7c3a05) | soak (mocked AI: 503s and bad JSON) |
| 8 | Concurrency | `servicePlant` (plants.js:474) walks to the plant and fits a part with no busy flag, before `runBatchPlant/runAsphaltPlant` set `isPracticing`, and inside the roadworks window that clears it (`rwFreeFor`). The free queue / life tick could start another activity mid-walk; two coroutines then fought over `targetPos` and the plant run's `finally` cleared the other job's flag. | Busy for the service (1671827) | `plantServiceBusy` |
| 9 | Owner rule (no building in town) | `buildRoad` (landscape.js:429) checked only the start point; an AI `shape: road` from just outside town ran up to 8 units into town, into the lake, or across building grounds. | The road stops short of the first off-limits point (76b43ee) | `roadNotIntoTown` |
| 10 | Owner rules (real things, consumables, not in town) | The Gardening hobby (hobbies.js:369) added a decorative flower mesh that never grows and gets no plant care, at a spot partly inside town (x −22..−28 vs TOWN.minX −24.5), while `useHobbySupplies` used up a real seed. Also the plantings array was trimmed without removing its meshes. | Gardening plants real seeds via `plantSeeds` on open ground (620d3f4, 93070f9) | `gardeningHobby` |
| 11 | Owner rule (used as intended) | The Stargazing hobby was "practised" by day with no telescope use (generic path). | Routed to the real `stargaze()` (620d3f4) | by reading |
| 12 | Owner rule (consumables) | `useItemFor(fertilizer, 'fertilize')` fell into the catch-all, which used up a feeding with no plant fed. | `fertilize` case calls `feedPlants` (7e3ae4c) | `fertilizerNotWasted` |
| 13 | Save/load | `buildProject` used up the materials before the 60 s carry-out walk and set `status:'built'` after it; a reload in that window lost them and he asked for everything again. | Used up once it is set down (0b6b776) | by reading |
| 14 | Lost hobby | A new hobby's first try (`practiceWhenFree`) gave up after 3 minutes, so a hobby gift at night was never tried (the old retry loop `doWhenFree` replaced elsewhere). | Uses `doWhenFree` (1c6bc1a) | by reading |
| 15 | Lost visitor ask | Any painting in the same medium cleared `state.paintPlan` (paintstudio.js:557), wiping a visitor's waiting painting. | Only that painting clears it (9e0480c) | by reading |
| 16 | Hidden tab stall | `playFetch` waited on raw `requestAnimationFrame` (companions.js:563); in a hidden tab it never resolved and `isPracticing` stayed set. | `keloTween` (e015c10) | by reading |
| 17 | Clock edge | Offline catch-up with the clock set back: `sessions = -1`, toast "I came up with -1 new idea" (growth.js:66). `lastSeenAt` was only set on load/beforeunload, so a killed tab counted its whole visit as time away. | Clamped; refreshed every minute (235b48c) | `growthBackwards` |
| 18 | Clock edge | Loop-guard cooldowns are absolute times: after the clock is set back, an activity stayed blocked for hours. | Cooldowns over an hour away are ignored (9a63f77) | `cooldownClockBack` |
| 19 | Minor | Land fill diary "after NaN truckloads" when the first load finished a patch (`loads` never initialised). | 2ba528c | by reading |
| 20 | Minor | chunks.js named `petAnimal` (doesn't exist) instead of `companionPet`, so the pet and its ball could be merged into static scenery. | 70b0cbc | by reading |

## Open (written up, not changed: larger or changes intended behaviour)

- **Request backlog grows without bound with no AI and a slow visitor.** In the 2 h no-AI soak, open requests rose
  steadily (≈ 28 per hour; the soak visitor answered 4 every 20 minutes) and each one opened an agenda `delivery` task.
  Nothing froze, but the list and the agenda get long. Pacing requests is a design decision.
- **`useItemFor` catch-all** (itemuse.js:646): for purposes without their own activity it still uses up one unit and
  then lets the AI decide what to do. Fertilizer is fixed; batteries (`power`) and other purposes still work this way.
- **`goBoating` always takes the first boat** (vehicles.js:600). Only matters with two boats (the one-of-each rule
  normally prevents it).
- **GPU memory not disposed** for constellation labels/lines (pastimes.js:642), fishing gear (pastimes.js:163) and the
  placed telescope (knowhow.js:323): removed from the scene but geometries/textures never disposed. Grows slowly over
  many nights.
- **Dreams merged on a brand-new Kelo** include the newest published dreams dated before he was born (growth.js).
  Probably intended (shared cloud dreams); left as is.
- **`animateDiorama` has no try/catch** (scene.js:2185): any throw in per-frame code would spam every frame. No
  current trigger found.
- **Snow wading in summer**: the mountains keep deep snow, so without snowshoes he wades in again now and then
  ("Wading through snow again" 8× in 2 h). It is the designed lesson (he asks for snowshoes), not a freeze.

## Soak results

Tool: `qa/soak.js`. Playwright's fake clock drives Date, timers and animation frames (frames every 50 ms of game
time, rendering stubbed), randomness is seeded, and a scripted visitor answers up to 4 open requests through the Post
Office every 20 simulated minutes. Every simulated minute it samples position, busy flags, riding, agenda and needs,
and flags: a busy flag held > 45 min (building > 2 h, sleep > 10 h), not moving for 60 min while awake, a walk target
he never heads for, NaN positions, page errors.

| Run | Sim time | Result |
|---|---|---|
| No AI key, seed 7 (fixed branch) | 2 h (28.6 min real) | 0 detections, 0 page errors. Kept moving all run (meadow, lake, NetNode, mountains, plant, workshop); agenda tasks completed as deliveries arrived (`delivery` tasks moved to done); he researched machines, planned a quadcopter BOM (27 lines), set up the 3D printer, ate, put things away, tidied. Hydration fell 77 → 39 % and he drinks below 35 % (by design). |
| Mocked Gemini, seed 11, reload at 60 min | 2 h (30.6 min real) | 0 detections, 0 page errors, 511 AI calls (every 11th a 503, every 13th not JSON; decisions include out-of-range/`NaN` coordinates, a far-off destination, a lake trip, a misuse "shovel as a hat", trips, painting, BOM builds). Every failure fell back to his own decisions; the reload restored state and he carried on. |
| No AI, seed 1 (first try, before fixes) | 15 min | 0 detections, 0 page errors. |

Observations (not freezes): with no AI and a slow visitor the open-request list grows (≈ 28/hour) — see Open; the
AI-added "Whittling" hobby came up 18 times in 2 h (hobby chance 0.22 per free tick, the loop guard stops three in a
row); "Needs sturdy shovel to keep digging" recurs while the shovel request waits (15-minute cooldown each time).
A container restart killed the first 2 h baseline run on `main` at 11 minutes (no findings by then).

## Test results

All on `agent/audit-life` at 93070f9.

- **harness.js** `reload chat ui water gear haul skills vehicle snow basement landfill planitems`: all 12 exit 0 with
  "page errors: none" (the only console errors are 404s for external URLs the harness blocks).
- **lifetests.js** (11 checks, one per fix that can be checked in a page): all PASS, page errors none.
  Two failed on the first run and were useful: the gardening fix's first spot west of town lay beside the balloon field,
  so `plantSeeds` refused it every time; fixed in 93070f9 by using `openGroundSpot`, as itemuse.js does.
- `node --check` on every changed file: OK. Duplicate top-level name check: prints nothing.
- Checked by reading only (no page test): #6 (it needs a 90 s busy wait), #11, #13–#16, #19, #20.

How to rerun: `KELO_ROOT=<game checkout> PORT=8904 node lifetests.js`, and
`KELO_ROOT=<game checkout> PORT=8901 MODE=noai|ai HOURS=2 [RELOAD=1] SEED=7 node soak.js` (about 15 s of real time
per simulated minute here).
