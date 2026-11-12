# Audit: code cleanup and feature review (2026-11-12)

Branch with the changes: `agent/audit-cleanup`. It is `main` at `8850b18` plus 11 small commits. It is pushed and not merged.
Tests: `qa-tools` scripts, run one at a time. Every scenario ran twice: once on untouched `main` (baseline) and once on the cleanup branch (after).

## 1. Cleanup done

Result: net **−51 lines of JS** (26 added, 77 removed, across 25 files). Behaviour is unchanged except for the one labelled fix (469fc17).

Every JS change passed `node --check` and the duplicate-name check (it printed nothing). A reachability scan (acorn: top-level declarations, references from code, strings, index.html, shop.html and the desktop/build scripts) now finds only the names that are kept on purpose (listed below).

| Commit | Files | +/− | What |
|---|---|---|---|
| c149195 | 7 | +2 / −23 | Dead code: `agendaInProgress`, `removeObstacle` (scene.js), `LIFT2_CAR` (garage.js), the scratch vectors `_ikX1`, `_ikZ1` (kelo-ik.js) and `_weldPalm` (welding.js), the test-only global `window.__lastBomCopy` (assembly.js; no QA script reads it), and lookups of HUD elements that no longer exist (`#rhythmStateBadge`, `#attachedImagePreviewBar`). I checked every remote branch first: none of them uses these names. |
| b8b4aa2 | 11 | +13 / −14 | One `escapeRegExp` (agent.js, next to `escapeHtml`) replaces 5 identical copies: `makerEscape` and `agendaReSource` became aliases, and the inline copies in itemuse.js, bom.js and main.js call it. `pastimeWait`, `pcWait`, `tripSleep` and `weldWait` are now aliases of the shared `sleep` (workshop.js, loaded before all of them). `wsPick` is now an alias of `pick`. No call sites changed. |
| c75536e | 3 | +4 / −4 | The inline easeInOutCubic in eyecam.js and shopvisit.js (×2) now calls `exploreEase`. `artClamp01` is now an alias of `clamp01`. |
| fd350be | 1 | −11 | `workshopPartToAssembly` (machines.js) is removed. It only looked for 5 hook functions that exist on no branch, so it always returned false. shopmaker.js wraps `addMadeThing` to route made parts into builds. |
| 469fc17 | 1 | +1 / −1 | **Fix (small behaviour change):** chunks.js listed the pet as `petAnimal`, which exists nowhere. The pet is `companionPet`. Because of that, the pet's group was not on the "never chunk" list. It could be registered as static until it moved more than 0.5 units. |
| 425fb5f | 5 | +5 / −5 | Header comments that gave the wrong load position: "Loaded SECOND" (scene.js), "THIRD" (main.js), "last" (portal.js), and "right after scene.js" (house.js, animations.js). |
| 2d6963a | 3 | +2 / −20 | The `state.pendingImageAttachment` branch in `handleVisitorChatMessage` is removed; nothing ever set it, and photos go through talk.js. The state default and the transient key are removed with it. Also removed: the empty `bindCodeRequestButtons()` and its call. |
| 0e75fcb, 266f41d, 1d76d1c, f821c10 | docs | +24 / −9 | Handoff, review.md and tasks.md (see section 4). |

## 2. Cleanup left, with reasons

- **Unused APIs kept on purpose.** An earlier audit (review.md) chose to keep these, and the QA scripts use some of them.
  - `chunkStats`, `storehouseLevelOf`, `workshopAssemblyBays`, `workshopParkingSpots`: test hooks used by `qa/`.
  - `workshopStation`, `hasReadyMix`.
  - `workshopCanMake`/`workshopMakePart`: these are the only readers of the 28 per-machine `makes:` regexes. They are superseded by shopmaker's `MAKER_CAPS`. Either delete them together with the `makes:` data (about 30 lines across 6 machine files, so a conflict risk while other branches run), or feed `makes:` into `MAKER_CAPS` (see the feature review).
- **Screenshot hooks** (`window.__wsHold`, `__makerHold`, `KELO_DEBUG` in perf.js) do nothing unless set. `__wsHold` is used by 7 QA scripts. The only `console.log` sits behind `KELO_DEBUG`, and there is no `debugger` statement.
- **Defensive `typeof fn === 'function'` guards.** There are 1,697 of them on names that exist. In 1,168 of those, the name is defined in a file that loads earlier, so the guard is always true. Some guard `let` values that can be null (`scene`, `controls`). Removing them would touch most files and conflict with every parallel branch. Do it after the runway and three.js work lands, file by file.
- **Clamp helpers.** `exploreClamp` and `pcClamp` are identical. There is no shared `clamp(v, a, b)`, and about 32 inline `Math.max(0, Math.min(1, …))` copies of `clamp01`. Adding one `clamp` to animations.js would be easy but touches many lines.
- **Damping.** `camEase(perFrame, dt)` (scene.js) and `dampTo(cur, target, rate, dt)` (animations.js) are both frame-rate independent but take different parameters. The engine doc makes inline `1 - Math.exp(-k*dt)` the convention, used in about 35 places. That is consistent; I left it.
- **Ground height.** There is one source, `getIslandGroundHeight`. `companionGroundY` falls back to the analytical version only if the grid one is missing, which is never true after scene.js loads, so that fallback can go. `vehicleGroundY`, `siteGroundY`, `exploreGroundAt` and `keloIkGroundAt` add real rules (water, tree houses, floors). These are fine.
- **HTML escaping.** There is one `escapeHtml` (agent.js) for the game. `shopEscape` (shop.js) exists because shop.html does not load agent.js. That is correct.
- **Giant functions** (lines): `buildKeloHouse3D` 511, `buildWorkshop3D` 393, `animateDiorama` 354, `finishKeloPose` 248, `synthesizeUnboundedExperience` 247, `buildWeldingStudio3D` 244, `finishTexture` 242, `applyDecision` 221. The model builders could be split per part mechanically, but each split rewrites hundreds of lines that the runway and anim3 branches also touch. Postponed. `agent.js` (2,749 lines) and `scene.js` (2,582 lines) share top-level state, so splitting them is not mechanical (as review.md already says).
- **Assets.** All 26 glTF models, 3 HDRIs and 6 textures are referenced. Nothing is unused. The 4 logo-bearing models are still waiting on the owner.
- **Files in the wrong place.** None found. `js/native.js` is injected only by the phone build, and `js/shop.js` is loaded only by shop.html. Both are intended.
- **DOM lookups.** Every other `getElementById` target exists in index.html or is created in JS.

## 3. Feature review

Source: **R** = I ran it here (the qa scenarios in section 5). **C** = I read the code only (file:line evidence is in the reviewer notes; the main lines are below). Impact and effort: H/M/L.

| Feature (tasks.md / handoff) | Status | Src | Gaps / polish (impact, effort) |
|---|---|---|---|
| 1 Paintings | Complete | C | A visitor's painting can be painted **twice**. `answerPaintRequest` sets `state.paintPlan` and also queues `doWhenFree(paintPicture)` (paintstudio.js ~684), and `paintPlanTick` (agent.js ~2412) paints the same plan (M,S). `state.paintingsSold` is written but never read (L,S). |
| 2 Welding + work bench | Complete | C | The weld studio is still not a routable shop: there is no `MAKER_CAPS` entry, so "make me a steel X" can't route to welding (H,M; this is an open owner item in tasks.md). `weldingReady` checks consumables but not steel stock (M,M). `weldPlanFor` mutates the shared `GROUND_JOBS` (L,S). |
| 3 Humanize / eye cam / motion | Complete | C, R (reload, vehicle) | No dead entry points. |
| 4 Garden | Complete | C, R (water) | With no fertilizer he still grows at 15% speed until "starved"; the spec says growth needs fertilizer (L,S). |
| 5 Code anything + upgrades | Complete | C | **Rule conflict:** upgrade structures (fence, path, fountain, lamps) appear without ordering or using any materials. The owner's rule is that supplies always come through the Post Office (M,M). Upgrades are paced at 30 min, code letters at 20 (L). `extra.unpaced` is never passed (L,S). |
| 6 Talk tab | Complete | C, R (chat, ui) | The photo path works through talk.js (the dead agent.js path is removed). After `talkWaitUntilFree`, `synthesizeUnboundedExperience` can still return early while he is `isBusy` (agent.js ~920). The chip then shows "done" and the reply is his old speech bubble (M,S). A photo welds at once with no steel-stock check (M,M). |
| Build anything (5) | Complete for templates and AI | C, R (planitems) | **Without an AI key, a big internet-sourced build is refused** if no template matches (`researchBuild` "no-plans", assembly.js ~323), and `makerReadArticle` declines anything too big. That breaks "with or without an AI key" (H,L). Big-build BOMs (AI and templates) never mark "I'll make this on the <machine>"; only shopmaker's small lists do (H,M). His own big-build ideas come only from `BOM_TEMPLATES` (L,S). With a key, a visitor's "build me a table" goes to the big-build path, not the woodshop (M,S). |
| Owner rule: whole thing on one machine, supplies via the Post Office | Complete | C, R (printshop) | Only 11 shops are routable (`MAKER_CAPS`). Not routable: weld studio, concrete plant, SLS, MJF, DMLS, PolyJet, binder, DED, EBM, LOM, waterjet, EDM, garage (H,M). The AI's `wholeShop` answer is not checked against that shop's forms or the too-big rule (M,S). |
| Owner rule: made things are real items (Storehouse/Museum, purpose from the article) | Complete | C, R (planitems) | Purposes other than sit, store and hold (play, ride, light, music) have no real use action yet (M,M). |
| "Make me a sandwich" goes to shops (tasks.md open item) | **Still open** | C | It goes to `parseMakerAsk`, then Wikipedia "Sandwich", then a shop decline. Add a food/drink check (the itemuse.js food regex) before the maker route (M,S). |
| Stool at the fire ring (tasks.md open item) | Mostly fixed | C | `sitOnMadeSeat` tries spots around the campfire and falls back to open ground. The diary still says "fire ring" after the meadow fallback (L,S). |
| Smarter vehicles / trips (9) | Complete | C, R (vehicle, haul, snow) | Without a key, nothing but skill practice starts a trip (L,S). |
| Forklift | Mostly complete | C | The terrain rule is text only: `tripCanStep` has no forklift branch, so it can drive anywhere (M,S). `forkliftDeliverUpstairs` doesn't set `isBusy` (M,S). Set-down pallets are not restored after a reload, and the racking never empties (L,S). |
| Workshop floors 1–3, every machine (7) | Complete | C, R (ws sla, garage) | Every machine listed in tasks.md is registered. The woodshop is the main path only for shopmaker jobs; projects.js and assembly.js still use the outdoor work bench (M,S). |
| 7b bigger garage hall / hangar | **Open** (on `agent/runway`) | C | There is no 4+ bay hall. The dump and mixer trucks still don't fit. `RUNWAY_FIELD` is not on main, so `startRunwayJob` can't start yet (H,L). |
| Concrete + asphalt plant (8) | Mostly done | C | Wasting asphalt that cools, wasting mix that sets in the drum, and 7-day curing are all done. **Concrete for foundations is not wired**: `pourConcrete` does only paths and pads, `useReadyMixFor` is used only for culvert headwalls, and build footings are only drawn (M,M). |
| Town interiors (NetNode, cafe, Post Office) | Complete | C, R (itest post) | A visit starts only within 0.35 of the pin, so a NetNode trip to an offset spot silently skips the room (L,S). |
| Quality leftovers (grass in hangar, foot slide, rain rings, draw calls) | Fixed and merged | C | tasks.md said "IN PROGRESS"; updated. |
| `noticeNewPlaces` 150 s loop (review.md) | Fixed | C | review.md said "fix later"; updated. `noticeTries` never resets (L,S). |
| Agenda + roadworks | Merged | C, R (indirectly, reload/haul) | The handoff said "not merged yet"; fixed. Visitor Workshop asks (`workshopAsks`) are memory-only and lost on reload (M,S). |
| Three.js upgrade | Queued | – | Waits for anim3 and runway. |

**Highest value next (owner requests that look unfinished):**
1. Weld studio and concrete plant as routable shops, plus the 10 unrouted printers and CNC machines.
2. Big builds without an AI key, and machine-made lines in big-build BOMs.
3. "Make me a sandwich" goes to food.
4. Concrete for foundations.
5. Upgrades and photo welds order their materials through the Post Office.
6. Visitor paintings painted twice.

## 4. Docs refreshed

- handoff.md:
  - "Agenda (not merged yet)" now says it is merged.
  - The three conflicting load-order lines are replaced by the real order from index.html.
  - New "File map and key APIs" section, checked against the code.
  - Testing now points at `qa-tools` (not a scratchpad harness).
  - "Next steps" now defers to tasks.md and lists which `agent/*` branches are merged (anim3 and runway are still open).
  - Removed the `workshopPartToAssembly` mention.
- review.md: the `noticeNewPlaces` "fix later" note is marked fixed.
- tasks.md: leftovers and the town at real size are marked merged. No task was dropped.
- The owner's rules are unchanged.

## 5. Test results

Each run was sequential, served from the qa-tools worktree (`../qa/qa`), with SwiftShader rendering and the CDNs and AI mocked.
Baseline = untouched `main` (8850b18) in a separate worktree. Post = `agent/audit-cleanup` (2d6963a).

| Test | Baseline rc | Baseline time | Post rc | Post time | Post page errors |
|---|---|---|---|---|---|
| `harness.js reload` | 0 | 67s | 0 | 59s | none |
| `harness.js chat` | 0 | 295s | 0 | 308s | none |
| `harness.js ui` | 0 | 111s | 0 | 123s | none |
| `harness.js water` | 0 | 192s | 0 | 194s | none |
| `harness.js gear` | 0 | 152s | 0 | 157s | none |
| `harness.js haul` | 0 | 314s | 0 | 397s | none |
| `harness.js skills` | 0 | 568s | 0 | 576s | none |
| `harness.js printshop` | 0 | 269s | 0 | 271s | none |
| `harness.js vehicle` | 0 | 49s | 0 | 59s | none |
| `harness.js snow` | 0 | 163s | 0 | 167s | none |
| `harness.js basement` | 0 | 113s | 0 | 110s | none |
| `harness.js landfill` | 0 | 197s | 0 | 198s | none |
| `harness.js planitems` | 0 | 426s | 0 | 140s | none |
| `ws.js sla` | 0 | 796s | 0 | 1969s | none |
| `ws.js garage` | 0 | 1259s | 0 | 1822s | none |
| `itest.js post` | 0 | 213s | 0 | 209s | none |

**Result: all 16 post-cleanup runs exited 0 with `page errors: none`, the same as the baseline.**

Notes:
- The post run was interrupted once by the runner's 30-minute background limit during `landfill`. The remaining five tests (landfill, planitems, sla, garage, post) were rerun from scratch, and those times are shown above.
- `ws.js sla` and `ws.js garage` ran slower in the post run (1969s vs 796s and 1822s vs 1259s). Both passed. The cause wasn't checked: these two scenarios are long and timing-sensitive under SwiftShader, and the cleanup changes don't add work to any loop. Rerunning them would confirm whether the slowdown is just machine-load noise.
- `harness.js planitems` took 140s post vs 426s baseline. The cause wasn't checked; the speed difference may be noise.
- `console.error` lines are all `Failed to load resource: 404` from mocked network requests. The counts per test match the baseline except `skills` (1 → 3) and `basement` (8 → 6). The cause wasn't checked. They may be timing noise: the cleanup removed no assets or URLs.
- `node --check` passes on every changed JS file. The duplicate-top-level-name check prints nothing.
