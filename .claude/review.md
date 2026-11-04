# Kelo-bot-1 review: performance, bugs and cleanup (2026-11-03)

This review was done on branch `agent/review`, a copy of `main` at `9e25e49`. It is a plan, not a rewrite. Nine helper branches are changing many files right now, so the only code change here is one tiny fix (see "Fixed now"). Everything else is listed with:
- where it is
- how it was measured or reproduced
- the fix
- whether it is **safe now** or must **wait** until the nine branches are merged

## How it was measured

The tools live in the scratchpad (`/tmp/claude-0/-home-user/11ef1b8d-4709-5592-8d3c-d96184b34ee6/scratchpad/review/`):
- `prof.js` drives the page through Playwright and the Chrome DevTools Protocol. It records:
  - the CPU profile (self time by function) and sampled heap allocations
  - GC events from tracing
  - `Performance.getMetrics`
  - long tasks
  - rAF callbacks, timers, listeners and localStorage writes (from hooks installed at page start)
  - THREE constructor counts per frame, with call sites
  - ground raycasts per frame
  - draw calls, triangles and shadow casters
- `NORENDER=1` swaps the WebGL draw for a no-op, so the JS cost of a frame can be seen apart from SwiftShader's software GPU. Rendering one frame in SwiftShader takes about 1 s, which would bury everything else.
- `STRESS=1` seeds the perf agent's stress save (`perf/stress.json`): 400 items, 174 creations, 80 world edits, 40 projects, 1500 words.
- `boot.js` plus `t_*.js` are small scenario files. They cover phone UI, leaks, storage writes, the texture warning and a scene probe.

All runs share the machine with the other helpers' browsers. Absolute milliseconds are therefore inflated; the ratios and counts are what matter.

> Note for tooling: `renderer.info` only reports the *last* render pass. On the High graphics level (`postComposer`, bloom) it reads `calls 1, tris 12`. Harnesses that compare draw calls must set `renderer.info.autoReset = false` and reset it once per frame. Game code doesn't read it.

## Headline numbers

| | default state | stress save |
|---|---|---|
| animate JS per frame (render stubbed) | **7.5 ms** | 8.0 ms (steady) |
| ...of which `getIslandGroundHeight` raycast | **6.2 ms (83 %)**, 1 call/frame | 6.6 ms; at boot bursts average 13.5 calls/frame (~90 ms/frame) |
| `new THREE.Vector3` per frame | **410** | 437 |
| minor GCs in 20 s (render stubbed) | 2146 (2.5 s total) | 698 |
| draw calls / triangles (Balanced) | 1194 / 204 k | 1651 / 296 k |
| meshes / visible shadow casters | 1760 / **1513** | 4609 / **3595** |
| materials (exact duplicates) | 381 (161) | 2632 |
| geometries (duplicate primitive parameters) | 1724 (687) | 2333 |
| rAF loops running | **5** (scene, perf, seasons, wind, weather) | 5 |
| main save key written | each save is about 8 KB | each save is about 300 KB of `JSON.stringify` (every 1 to 4 s while active, and every 20 s) |

## Top 15 performance hotspots (ranked)

1. **Ground height by raycasting the whole terrain** (`js/scene.js:56` `getIslandGroundHeight`).
   - Measured: one call takes 6–8 ms (40 ms under load). It is 83 % of all per-frame JS. It also creates 2 `Vector3`s per call.
   - Every road slab, creation, pin and vehicle placement also calls it. With the stress save, boot does thousands of these (13.5 per frame averaged over a 15 s window).
   - The ground mesh is a 214×160 grid (68 k triangles), and three r128 tests every triangle once the bounding sphere is hit.
   - Fix:
     - Read the height straight from `terrainGroundMesh.geometry`'s position array by grid cell, with bilinear interpolation. The vertices are already `getAnalyticalGroundHeight` plus the edits, and `refreshTerrainAround` keeps them current.
     - Raycast only the other children of `terrainSwapGroup` (the house floor from `house.js:451`), using a cached `Vector3`, `ray.set` and `far`.
     - Expected: about 6 ms down to under 0.05 ms per call. **Wait** (scene.js is the movement/camera branch's file).
2. **Ogopogo rebuilt every frame, even off-screen** (`js/scene.js:551` `updateSeaDragon`).
   - Measured: **about 380 of the 410 `Vector3`/frame**. `dragonSpine` returns a new vector 3× per ring, plus 2 cross-product vectors per ring and 14 for the spines. Then `computeVertexNormals` and `computeBoundingSphere` run on 949 vertices every frame. It is the second-largest JS self time after the raycast.
   - Fix:
     - Write `dragonSpine(u, t, out)` into scratch vectors.
     - Skip the update when `ogopogoGroup` is outside the camera frustum or farther than about 80 units.
     - Recompute normals every 2nd–3rd frame.
     - This removes most per-frame garbage, which drives the 2146 minor GCs in 20 s. **Wait** (scene.js).
3. **Shadow casters: 1513 of 1760 meshes cast shadows** (`js/realism.js:187` `updateShadowCasters`, `castMin` 0.15 on Balanced). The shadow pass re-draws every caster, so draw calls roughly double. Fix:
   - Raise `castMin` (Balanced 0.3, Fast 0.6).
   - Skip casters outside `shadowRange` of the camera target (perf.js already does this for creations).
   - Check how many of the house's 288 casters sit inside its walls; those need not cast.
   - **Wait** (realism.js and perf.js are shared).
4. **The house is 367 meshes with 366 unique geometries and 138 materials** (scene probe, `Kelo-1 House`; `js/house.js`).
   - The anonymous groups #153 (129 meshes, 4 materials) and #51 (118 meshes, 44 materials) are next.
   - Fix: merge static parts by material with a `joinGeometries`-style merge (one already exists in `realism.js`), or `InstancedMesh` for repeated boards. This should cut draw calls by several hundred. **Wait** (house.js and materials.js, workshop branch nearby).
5. **Valley trees: about 13 meshes each, every mesh a shadow caster** (`js/realism.js` `buildNaturalFir`/`buildNaturalLeafyTree`; 13-mesh groups #78–#123 in the probe).
   - Each tree draws once per mesh and again in the shadow pass.
   - wind.js moves each leaf clump separately (`js/wind.js:162–173`), so merging must keep clumps swayable. Options:
     - merge trunk and branches into one mesh, and the clumps into one mesh, and sway that mesh with a vertex-shader bend
     - or instance the clumps
   - **Wait** (realism.js, wind.js, garden branch).
6. **Material and geometry duplication**: 161 of 381 materials are exact duplicates, and 687 of 1724 geometries repeat the same primitive parameters. Each duplicate material costs a state change and a program-cache lookup; each duplicate geometry is its own GPU buffer. Fix:
   - Add a `sharedMaterial(params)` / `sharedGeometry(type, params)` cache in materials.js and use it in the builders.
   - The `userData.sharedGeometry` flag already exists in realmodels.js to protect shared ones from disposal.
   - **Wait**.
7. **Five separate rAF loops** (`js/perf.js:210`, `js/seasons.js:223`, `js/wind.js:771`, `js/weather.js:647`, plus `animateDiorama`).
   - Measured: 4 extra callbacks per frame. They run *after* the frame is drawn, so wind, rain and snow lag one frame.
   - Fix: register per-frame updaters with one `onFrame(fn)` list that `animateDiorama` calls before `renderWorld()`. **Wait** (touches 5 files).
8. **Big-save persistence** (`js/agent.js:1322` `savePersistentBrainStateNow`).
   - Measured with the stress save:
     - The top allocator is 584 KB plus 466 KB per sampled window.
     - Each save `JSON.stringify`s the whole 290–320 KB main brain, even when only a vital changed. It is written about every 60–130 s in steady state.
     - The 466 KB lore key is rewritten after boot.
     - One profiling window recorded the lore key written 7× in 20 s, 4.4 MB in total. That repeated burst did not reproduce in a 60 s steady-state run, so it is probably boot-time lookups.
   - Fix:
     - Split the frequently changing fields (vitals, position, mood, chat) from the slow ones into their own key.
     - Give `vocabulary`, `itemLookups` and `itemPurposes` a size cap or LRU. They grow without bound: one entry per unknown word or item.
   - **Wait** (agent.js).
9. **Per-frame `new THREE.Vector3` in the camera modes** (`js/scene.js:1538–1546` pan, `1858`, `1864–1874` mode lerps) and **2 `Vector3` per pin per frame** (`js/scene.js:1903–1905`, `projectLabelsToScreen`; about 26 per frame).
   - Fix: module-level scratch vectors.
   - `projectLabelsToScreen` also reads `viewport.clientWidth` and writes 2–4 style properties per pin every frame. Cache the size on `resize` and write only on change. **Wait** (scene.js).
10. **Text and regex work every frame** (`js/scene.js:1569`): a template string, `toLowerCase` and 2 regex tests over mood, speech and place to choose drill or torch. Fix: compute it once whenever `moodTitle`, `speechBubble` or `customPlaceName` change (they change a few times a minute). **Wait**.
11. **Nested traversal of creations every frame** for `userData.spin` (`js/scene.js:1822`) and the garden scale loop (`1812`). Fix: keep a `spinners` array filled when creations are built. **Wait**.
12. **Kite and fishing lines call `setFromPoints` every frame** (`js/wind.js:398,417,427`, `js/hobbies.js:230`, `js/pastimes.js:96`). Each call allocates a new `Float32BufferAttribute` and 2 `Vector3`s, and the GPU buffer is re-created. Fix: give the line a 2-point position attribute once and update it with `setXYZ`. **Safe now**? It is a 3-line change per site, but wind and pastimes may be in flight, so this can wait.
13. **Minimap redrawn 8× a second while visible** (`js/minimap.js:245`), even when nothing moved. It was a top-5 JS allocator in the default render run (46 KB sampled). Fix: redraw when the camera, Kelo-1 or a vehicle moved more than half a map pixel, or every 1 s. **Wait** (explore/minimap belong to the movement branch).
14. **`exploreFitToPanel` every 1.5 s** (`js/explore.js:801`): forced layout from `getBoundingClientRect` on two elements, plus 2 root `setProperty` calls. Fix: a `ResizeObserver` on the HUD and the status card. **Wait** (movement branch).
15. **Clouds move per frame, not per second** (`js/scene.js:1808` `updateClouds(1 / 60)`). They drift at a speed that depends on the frame rate: half speed at 30 fps, while wind.js pushes them by real `dt`. Fix: pass the real `dt`. One-liner, **wait** (scene.js).

Lower priority:
- `house.js:515` runs `updateHouseLights` every 500 ms, writing 6 light and material values even when nothing changed. Skip when `L.level === target`.
- `realism.js:665` builds a landfill signature string every 4 s.
- `landscape.js:647` re-renders the list every 5 s.
- `projects.js:671` re-renders the projects list every 8 s.

These are cheap, but each could early-out when its panel is hidden.

## Bugs (verified)

| # | Sev | Where | What / repro | Fix | When |
|---|---|---|---|---|---|
| B1 | Low (fixed) | `js/realism.js:104` | `applyGraphicsLevel()` runs at startup right after the 5 terrain textures are created. It set `needsUpdate` before their JPEGs loaded, so three.js logged *"Texture marked for update but image is undefined"* 5× per frame until they arrived. Measured: 40 warnings in the first 10 s, every boot. | Only flag textures that have an image; the loader uploads the rest with the chosen anisotropy. Verified: 0 warnings, all 5 textures loaded at anisotropy 4, and switching to Fast still re-uploads them (version 1→2, anisotropy 1). | **Done** (`4cc947c`) |
| B2 | Medium | `js/agent.js:2122` `doWhenFree` | Gives up silently after 36 tries (3 s + 35×5 s ≈ 3 min). Sleep holds `isPracticing` until morning, which is up to about 4.25 real hours (night is 8.5 of his 24 world hours over a 12 h real day; `needs.js:127`). Builds and museum carries took 3–4 min in the watch (bld=1 from 372 s to about 600 s). So follow-ups queued during them are dropped. That is about 35 call sites, e.g. `agent.js:2226` "Back to Digging with the shovel" after a gift, and `mining.js:409` "Saw Something Glint". | Retry without a cap at a slower pace (e.g. 30 s after 3 min), and drop the action only if it no longer makes sense; or keep a `state.pendingFollowUps` queue that the life tick drains. | Wait (agent.js) |
| B3 | Low | `js/mining.js:399–404` `checkForGlints` → `discoverDigging` | Runs every frame regardless of what he's doing. In the 10-min watch it replaced the mood and speech bubble *while he was carrying a sculpture* (`[492s] Discovered something under the ground ... bld=1`). The carry text was lost and the bubble stayed stale. | Skip the discovery while `isBuilding` or `isPracticing` (queue it), or don't overwrite `moodTitle` there. | Wait |
| B4 | Low | `js/agent.js:1032`, `2003` | Request ids are `'req-gear-' + Date.now()` and `'req-free-' + Date.now()`, so two requests made in the same millisecond share an id, and `find(r => r.id === rId)` answers the wrong one. `addItemRequest` (`2136`) already adds a random suffix. | Add the same random suffix. | Safe, but agent.js is busy: wait |
| B5 | Low | `js/agent.js:1029` vs `2134` | Inconsistent de-duplication. Gear asked through the structured tick is never asked again once *fulfilled* (it checks all requests). `addItemRequest` only checks open ones. AI `askQuestion` (`2001`) has no de-duplication at all, so the AI can ask the same question repeatedly. | Use one `hasOpenRequest(key)` helper. | Wait |
| B6 | Low (UI) | `index.html` header buttons, `#btnCloseMenu` | When the Phosphor icon font can't load (offline web, blocked CDN, the test harness), the settings, menu and close-menu buttons are blank squares. Only the tab icons have the emoji fallback (`main.js:638–648`). Seen at 390×844 (`shots/phone-main.png`, `phone-tab-*.png`). | Extend the `data-tab-emoji` fallback to every icon-only button (`data-icon-emoji`). | Wait (index.html and main.js are shared) |
| B7 | Low (UI) | `#btnFocusKelo` ("Follow" in the bottom panel) | The tap target is 52×19 px on a phone (WCAG/Apple minimum is 44×44, Material 48×48). | `min-h-[32px]` plus padding, or make the whole panel header the button. | Wait (index.html) |
| B8 | Info | `js/agent.js:1188–1194` | `BRAIN_KEY` is now `kelo1_brain_v4`, and `kelo1_brain_v3*` keys are **deleted** on load. The perf agent's `stress.js` still seeds `kelo1_brain_v3`, so its "stress" numbers since the v4 change are for a *fresh* state. My `prof.js` and `boot.js` seed v4. | Update `perf/stress.js` (scratchpad only). | Now (tooling) |
| B9 | Low (fixed) | `js/conversation.js:74`, `155` | "How are you?" answered *"I feel good! Energy 79.07176697530865%"*. The vitals are floats, and the AI prompt got the same unrounded numbers (chat scenario, before the fix). | `Math.round` on energy, wonder, fullness and calm in the reply and the prompt. Neither paint nor assembly touches these lines (their edits are at line 146). | **Done** |
| B10 | Info | chat scenario timing | Each chat reply took 40–50 s in the harness. That is not a game delay: the built-in brain answers synchronously, and the time is `page.evaluate` queuing behind multi-second SwiftShader frames on a host shared with about 10 browsers. Under that load, `page.goto(…, 180000)` and Playwright's default 30 s screenshot also time out. The harness now retries a goto timeout and gives screenshots 240 s. | — | Tooling |

Checked and clean:
- **Busy flags:** all 57 places that set `isBusy`, `isBuilding`, `isPracticing`, `isBrowsing` or `isCollectingMail` in an async function reset them in a `finally` (acorn walk, `lint/flags2.js`). No flag stayed stuck in the 10-min watch.
- **No duplicate top-level names** across the 58 page scripts (`lint/collect.js`).
- **No `typeof X === 'function'` guard names a function that doesn't exist** (`lint/typeofs.js`).
- **ESLint** (`no-undef`, `no-dupe-keys`, `no-unreachable` and others): clean apart from 6 comma-expression `no-unused-expressions`, all intended.
- **No CSP violations and no page errors** in the profiling, phone-UI, watch and scenario runs. The only console errors are harness 404s for Google Fonts.
- **No setInterval pile-up:** 16 intervals, each created once. **Listeners:** renders that bind clicks re-create their nodes with `innerHTML`, or use `perfSetHtml` + `onclick`, so none double up. 6–44 listeners were added in 20 s, all on fresh nodes.
- **Save growth:** almost every array in `state` is capped in `trimBrainState` or by game rules. The uncapped ones are:
  - the object maps `vocabulary`, `itemLookups`, `itemPurposes` and `knowHow`
  - `landFills`
  - `projects` (bounded in practice)

  See hotspot 8.

**10-minute autonomous watch** (`runs`/`watch2.log`): he did 12 different activities: ideas, NetNode, welding, carrying to the Museum, the glint discovery and unpacking a 3D printer. `busy` released after the NetNode visit. Page errors: none.

**Phone width 390×844:**
- no horizontal page overflow
- the menu is exactly 390 wide in all 6 tabs, with nothing sticking out
- the settings modal fits (16–374 × 42–802)

Only B6 and B7 above were found.

## Code quality

### Dead code (never referenced anywhere in js/, html or scripts)
| Function | Where | Note |
|---|---|---|
| `useBuildSupplies` | `js/itemuse.js:446` | superseded by `projects.js:271–278`, which does the same inline |
| `jobGear` | `js/groundwork.js:73` | |
| `isVehicleName` | `js/shopkeeping.js:109` | |
| `exploreIsTouch` | `js/explore.js:53` | |
| `keloCapsule` | `js/kelo-body.js:108` | |
| `perfLevel` | `js/perf.js:36` | |
| `storehouseLevelOf` | `js/storehouse.js:180` | used only by the perf agent's stress harness; keep it, or move it into the harness |

All are **wait** (the files are in flight); each is a pure deletion.

### Duplicated helpers that should be shared
- **Sleep:**
  - 77 inline `new Promise(r => setTimeout(r, ms))` across 26 files
  - `pastimeWait` (pastimes.js:18)
  - Add one `sleepMs(ms)` in agent.js.
- **Seeded random:** `makeRng` (agent.js:1457), `seededRandom` (everydaymodels.js:20) and `windHash` (wind.js:40), plus inline LCGs in realism.js, landscape.js and the projects code.
- **Clamp:** `clampNumber` (agent.js:436), `exploreClamp` (explore.js:40), plus many inline `Math.max(a, Math.min(b, v))`.
- **"Is he free?":** `state.isBusy || state.isBuilding || state.isPracticing || state.isCollectingMail` is spelled out in dozens of places with different subsets. Some include `isSleeping` or `isBrowsing` and some don't. Add one `keloIsFree({ allowMail })`.
- **Two auto quality systems** that both watch the frame rate and step down by themselves, with separate settings and storage keys:
  - realism.js `trackFrameRate` → Graphics (`kelo-graphics`)
  - perf.js `perfWatchFrames` → Performance (`kelo1_perf_level`)

  Merge them into one quality level.
- **Ground height:** `getIslandGroundHeight`, `getAnalyticalGroundHeight` and `companionGroundY` (companions.js:59) are called directly in different places. The analytical height already includes digs, hills, dirt piles and landfill; only the house floor differs. Use one `groundAt(x, z)` once hotspot 1 makes it cheap.

### Files too big (by bytes)
- **`agent.js` (143 KB).** Split it into:
  - `state.js` (defaults, persistence, trimming)
  - `llm.js` (Gemini, Claude, prompts)
  - `decide.js` (procedural brain, `applyDecision`)
  - `requests.js`
- **`scene.js` (99 KB).** Split it into:
  - `terrain.js` (ground, outer lands, height)
  - `sea.js` (Ogopogo, lake)
  - `pathing.js` (A*, obstacles)
  - `labels.js` (POI DOM)
  - `scene.js` keeps init and `animateDiorama`
- **`materials.js` (62 KB), `realism.js` (54 KB) and `main.js` (53 KB):** split by section. Each already has numbered sections.

All of these must **wait** until the nine branches are merged, or they will conflict with everything.

### Inconsistent patterns
- Some UI lists use `perfSetHtml` and some raw `innerHTML` (hobbies.js:450, main.js:117, minimap.js:375, shopkeeping.js). Raw `innerHTML` makes the browser rebuild the list on every `renderAllUI()`.
- Per-frame work is spread over 5 rAF loops (hotspot 7) and about 16 intervals of 0.125–10 s.
- Async jobs report outcomes differently (`true`/`false`, a string status, or nothing).

### Stale comments
- `js/scene.js:2` says "Loaded SECOND"; it is the 15th script.
- `js/main.js:2` says "Loaded THIRD"; it is 53rd.
- `js/portal.js` says "Loaded last"; explore, minimap and tryit come after it.
- `js/house.js` says "Loaded right after scene"; realism and weldstudio sit between them.
- `js/scene.js:3` mentions "continuous mountain/valley altitude raycasting", which hotspot 1 should replace.

**Wait** (header lines in files others edit).

## Plan

**Safe now (done or tooling):**
- B1: fixed.
- B9: fixed.
- B8: the perf harness seeds the wrong key (scratchpad only).

**Right after the nine branches merge, in this order** (each step is small and has a measurable result):
1. Hotspot 1: ground height from the grid. Expect animate JS 7.5 → about 1.5 ms per frame, and much faster boot with big saves.
2. Hotspot 2: Ogopogo scratch vectors plus a frustum skip. Expect `Vector3`/frame 410 → under 30, and far fewer minor GCs.
3. Hotspots 9, 10, 11 and 15: scratch vectors and cached strings in `animateDiorama`, all in scene.js, as one PR.
4. Hotspot 3: shadow-caster budget, then hotspots 4 and 5 (merging the house and trees) and 6 (shared materials and geometries). Measure draw calls with `renderer.info.autoReset = false`. The target on Balanced is under 500 calls.
5. Hotspot 7: one frame-update list instead of 5 rAF loops.
6. B2 (`doWhenFree`), B3, B4, B5, B6 and B7.
7. Hotspot 8: split the save and cap the lookup maps.
8. Cleanup: delete the dead code, add shared helpers (`sleepMs`, `keloIsFree`, `groundAt`), merge the two quality systems, then split agent.js and scene.js last.

Regression after each step: the harness scenarios reload, chat and haul (plus water, gear, skills and printshop), checking "page errors: none", and a screenshot of the area changed.
