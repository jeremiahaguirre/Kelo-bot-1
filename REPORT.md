# Performance audit (branch `agent/audit-perf`)

Base: `main` at `8850b18`. Six small commits on `agent/audit-perf` (listed under "Fixes"). Tools added to `qa/` on this branch: `perfaudit.js` (CDP profiler: load, per-frame, soak), `probe.js` (boot + run a snippet), `shots.js` (same seeded world in fixed views for pixel diffs); `boot.js` takes `life: true`; `perfviews.js` copied from `qa-results-engine`.

How it was measured (this machine renders with SwiftShader, so frame time is fill-bound and not used as a result):
- **JS per frame**: `renderer.render` stubbed, time inside `animateDiorama` (all frame hooks, his pose, the camera, the chunk system). Same seeded world.
- **CPU self time** by function: CDP `Profiler` (200 µs sampling). **Allocations**: CDP `HeapProfiler.startSampling`, plus a proxy that counts `new THREE.Vector3/Matrix4/...` from game code per frame with call sites (only constructor calls through `THREE.X`; `.clone()` is not counted).
- **Draw calls / triangles**: `renderer.info` over a full frame including the shadow pass (`perfviews.js`), and per object by wrapping `renderer.renderBufferDirect`.
- **Leaks**: 30-minute soak with his life running (AI mocked as failing) and the camera roaming between town, the high view and both ends of the valley; GPU geometries/textures, scene objects, DOM nodes, listeners, intervals, heap after a forced GC, localStorage size. Plus targeted enter/leave cycles (Workshop visit, interiors).
- "Before" numbers are from `main` (or `git stash` of the change in the same session, same seed).

## Summary

| | before | after |
|---|---|---|
| JS per frame, town view, life frozen | 1.93 ms | **1.66 ms** |
| JS per frame, follow camera, his life running | 2.19 ms | **1.75 ms** |
| three.js internal CPU in 20 s (town) | 493 ms | **189 ms** (no more `computeVertexNormals`/`computeBoundingSphere` every frame) |
| GC in 20 s (town) | 66 ms | **35 ms** |
| `new Vector3` per frame (follow + life) | 8 | **3.5** |
| sea dragon update | 0.23 ms | **0.12 ms** |
| chunk system per frame (60 fps) | 0.53 ms | **0.31 ms** |
| chunk box rebuilds per frame | 6.5 | **0.44** |
| arrival + walk goal + blocked check | 29 µs | **18 µs** |
| draw calls, town view (probe, 3 frames) | ~1500 | **~1390** |
| meshes / materials in the scene | 1653 / 599 | **1575 / 521** |
| memory archive written | every save that trims one diary entry (10 ms web; 68 ms at 20k entries, 345 ms at 100k on desktop) | **at most every 30 s**, and on hide/close |

No GPU or JS leak found: in 30 minutes geometries went 1306 → 1288, textures 43 → 43, heap +5.8 MB (diary/requests/agenda filling their caps). Five Workshop-visit cycles and repeated interior visits return to the same counts.

## Fixes (one commit each)

1. `4d31684` **Sea dragon normals** (scene.js). `updateSeaDragon` re-shaped 949 vertices and then ran `computeVertexNormals()` + `computeBoundingSphere()` every frame it was on screen (≈0.35 ms/frame in the town view, 17 % of the frame's JS). The ring direction it already computes *is* the surface normal, so it is written straight into a normal attribute, and the bounding sphere is a fixed one that holds every pose. Checked against `computeVertexNormals`: mean dot 0.991, min 0.94 (only at the tail tip and the seam, where the computed normals were the approximate ones). 0.23 → 0.12 ms per update.
2. `2fe951f` **Chunk rolling check** (chunks.js). It looked at 320 meshes *a frame*, so it cost twice as much at 120 Hz as at 60 Hz (46k meshes/s at 144 Hz). Now 9600 meshes/s (64–320 a frame): a full pass over ~1500–2100 meshes takes ~0.15–0.2 s at any refresh rate. Also, the valley trees' leaf tops are moved on the CPU every frame (wind.js), so each check of a tree re-measured its whole box (`Box3.setFromObject` + `chunkRefreshBox`): 6.5 times a frame. A mesh with `userData.windBase` is still marked busy (kept out of merges, as before) but no longer re-measures the box; the sway is a few tenths of a unit, inside `CHUNK_MARGIN`. Chunk frame 0.53 → 0.31 ms; merged proxies and parts identical (5 / 383 in the same view).
3. `a79ee2c` **Obstacle queries** (scene.js). `arrivalRadius`, `walkGoalFor` and `pushOutOfObstacles` run several times a frame over ~300 obstacles; `walkGoalFor` built a string key (`toFixed` of the target and of the obstacle signature) on every call (6 signatures a frame). The cache is now compared as numbers (same rounding), `obstacleHoldsTarget` compares squared distances, `obstacleProbe` uses `sqrt` instead of `Math.hypot`. Same results (checksum over 20 000 calls identical), 29 → 18 µs per arrival + goal + blocked check.
4. `38cd28e` **Static merge joins identical one-off materials** (perf.js `mergeStaticMeshes`). Many buildings make a new material per part (`box(..., new THREE.MeshStandardMaterial({ color: 0x847d74 }))`, e.g. the house's chimney courses, books, desk), so the per-material merge could not join them: the house still drew 175 calls from 108 plain meshes with 88 distinct materials. A material now counts as "the same" as another when it is a plain `MeshStandardMaterial` used by **only that one mesh in the whole scene**, opaque, opacity 1, no textures of any kind, no emissive colour, no `userData`, no custom shader hook or defines, and every drawn property is equal. Anything that might be changed later keeps its own material: lamps and glass (emissive/transparent), seasonal leaves (userData), dressed walls (maps), and any material shared with another mesh (likely held in a variable). The stand-in materials are disposed. House children 145 → 102; scene meshes 1653 → 1575, materials 599 → 521; town draw calls ~1500 → ~1390. Pixel diff of 8 fixed views (same seed): the only differences are tree sway and the HUD's weather word, which are not seeded; the house, storehouse and Workshop are unchanged.
   - Risk to note: code that keeps a reference to an *unshared, plain* material and changes its colour after the merge (1.5 s after build) would no longer see the change. I checked the mutators (`updateHouseLights` = emissive only, seasons = userData.seasonal only, `dressBuilding` runs before the merge and adds maps); none touch such a material.
5. `adc21a4` **Memory archive writes** (memory.js). Once the diary has 40 entries, every brain save that trims one entry called `saveMemoryArchive()`, which stringifies and writes the *whole* archive: 10 ms on the website (1500-entry cap); on desktop (250 000-entry cap) 68 ms at 20k entries and 345 ms at 100k, once per new diary entry. Overflow now goes into the archive in memory at once and the archive is written at most every 30 s (`ARCHIVE_SAVE_MS`), immediately on `visibilitychange: hidden` and `pagehide` (same events as the brain save), and never while a backup is being restored (`brainSavesBlocked`). Export still writes it first. Tested: 50 overflowed entries are not written until `pagehide` (then 31 → in storage), later ones arrive after 30 s.
   - Trade-off: on a hard crash (no pagehide) up to 30 s of overflowed diary entries could be missing from the archive.
6. `40a8a16` **Scratch vectors on the follow camera** (explore.js, hud.js, welding.js). `exploreOffset` and `exploreKeloSpot` take an optional `out` vector; the per-frame callers (camera goal, follow target, HUD projection, weld bead) pass one. `new Vector3` per frame 8 → 3.5 with his life running.

## Measurements by area

### Startup
- First paint 384 ms; DOMContentLoaded 2.9 s; world ready (renderer + Kelo-1) 23.9 s under SwiftShader.
- 104 game scripts (3.6 MB JS), all synchronous in `<head>`/body order; 9.0 MB fetched in total, of which the three HDR photos are 4.4 MB (all three are needed for the day/dusk/night blend; loaded async, not blocking).
- CPU during load: 28.2 s total, of which 21.6 s is `(program)` (shader compile/link in SwiftShader) and 3.7 s three.js; game code is ~1 s (scene.js 247 ms: `makeSignMesh` 65 ms, `obstacleProbe` 48 ms; workshopbuilding 89 ms; minimap base 18 ms). 44 shader programs at rest.
- On a real GPU the shader compile shrinks a lot; the game's own startup JS is small. No change made.

### Per frame (render stubbed)
Town view after the fixes, top self time in 20 s: `updateSeaDragon` 146 ms, chunk check callback 124 ms, `finishKeloPose` 83 ms, `obstacleProbe` 76 ms, `arrivalRadius` 56 ms, `keloLocomote` 43 ms, `traverseVisible` 42 ms, GC 35 ms. Nothing dominates.

Workshop (he inside, follow camera): 1.47 ms/frame before; the chunk check was the top item (0.25 ms/frame), fixed by #2.

Workshop visit (first-person), per area after the fixes: JS 0.95–1.25 ms/frame; draw calls f1 1179, f2 1002, f3 771, hangar 1435, wing 982 (triangles 238k–305k).

### Draw calls (full frame incl. shadow pass)
`perfviews.js`, balanced preset, desktop — before #4 → after #4:
| view | draw calls | triangles |
|---|---|---|
| town | 1622 → **1502** (−7 %) | 320.8k → 320.8k |
| meadow | 1347 → **1266** (−6 %) | 262.8k → 265.9k |
| mountain | 763 → **740** (−3 %) | 222.8k → 222.8k |
| high | 1762 → **1738** (−1 %) | 339.4k → 340.9k |
| workshop (he inside) | 1221 → **1220** | 270.3k → 270.3k |

(Triangle changes are the random wildlife/birds; JS and frame ms from these runs are not compared: the "after" run shared the CPU with the test suite.)

Phone 390×844, fast preset (after all fixes) vs. the last recorded numbers in `qa-results-engine`: town 1012 → **910**, meadow 698 → **669**, mountain 593 → **581**, high 1402 → **1337**.

Where the calls go in the town view (main + shadow, before #4): an unnamed 77-child group at (-1, -8) 225, the house 287 (175 of them from the unmerged plain parts), the workbench 132, Kelo-1 118 (59 meshes × 2), the welding rig 60.

### UI / DOM
- `renderAllUI` runs ~0.1 times a second: 1–2 ms per call, 6 ms with the Diary open (≤0.5 ms per second). Layout 10 ms and style 25 ms in 20 s; ~5 DOM mutations a second (HUD text). No layout thrash found.
- `projectLabelsToScreen` / `getBoundingClientRect` ≈0.02–0.04 ms a frame.

### Long frames
- Chunk merges (`chunkBuildProxy`) cost 1–5 ms per chunk warm, up to 23 ms the first time (cold JIT), one merge every few frames at most.
- Workshop floor builds (`perfWatchBuilding` show) 10 ms.
- The 90–110 ms "max frame" seen in the profiler runs comes from the constructor-counting proxy (a stack capture per `new Vector3` while a model is built); without it the worst frame over 3 minutes of roaming was 43 ms.

### Leaks and growth (30-minute soak, his life running, camera roaming)
| | start | 30 min |
|---|---|---|
| GPU geometries / textures | 1306 / 43 | 1288 / 43 |
| scene objects | 2287 | 2407 |
| heap after GC (after-fix soak, CDP `Runtime.getHeapUsage`) | 20.4 MB | 24.4 MB (23.0 at 5 min, then +0.3 MB per 5 min) |
| DOM elements | 2022 | 3894 |
| net listeners added | 377 | 1563 |
| setInterval alive | 33 | 32 |
| localStorage (all keys) | 47 KB | 192 KB |

- **DOM growth** is the Requests inbox (0 → 442 nodes), the agenda list (1 → 430), the Brain tab sections (core memories, opinions, skills) filling up to their caps. **Listener growth** is the rebuilt request/agenda cards (`main.js:312/321` add a click per card on each rebuild; the old cards and their listeners are dropped with the old DOM), not a leak.
- **localStorage growth**: `kelo1_brain_v4` 46 → 104 KB (agenda 0.2 → 29 KB, requestsToUser 0 → 19 KB, diary 10 → 18 KB), `kelo1_memory_archive_v3` 0 → 24 KB (capped at 1500 entries on the web). Brain save takes 0.34 ms.
- The same soak after the fixes: geometries 1204 → 1186, textures 44 → 44, DOM 2014 → 3272, localStorage 45 → 153 KB, brain save 2–6 ms (incl. the archive check), page errors none.
- Workshop visits (f2, f3, hangar, then leave) × 5: geometries 1218 → 1477 after the first visit (built once and kept), then 1477, 1477, 1477, 1461, 1477; scene objects back to 2208 each time. Town interiors are built once and hidden after (`interiorBuildInside` caches `room.inside`); visit temporaries go through `disposeTree`.

## Not fixed: write-ups

1. **Agenda delivery tasks and awaited requests grow while nobody visits** (agendalinks.js, agent.js `trimBrainState`). Every request for an item adds a `delivery` task that waits for it, and an open request a task waits on is never trimmed. Unattended for 10 minutes he had 23 waiting delivery tasks (~0.9 KB each in the save, ~13 DOM nodes each in the Brain tab) plus their requests (inbox 442 nodes). It is bounded by how many different things he can want, but that is a few hundred. Suggest: stop asking for new deliveries while N (say 8) are already waiting, or let the oldest waiting delivery lapse with a diary line. This is a gameplay rule, so it was left for the owner / logic audits.
2. **Valley trees sway on the CPU** (wind.js `updateWindLook` moves each leafy sphere every frame). That keeps every valley tree permanently "busy", so their chunks can never merge them (each tree stays 2–3 draw calls, ×2 with shadows) and their positions are rewritten every frame. Moving this sway to the vertex shader like the firs (`foliageSwayShader`, `keloRoot`) would let the chunk merge take them. Visual must match; a medium change.
3. **Colour-baked merges.** With the material colour copied into a vertex colour attribute, the house's plain parts would fall from 40 sets to 13 (fewer draw calls again). Needs `vertexColors` on the merged material and care with shared materials; a larger change than #4.
4. **Tailwind Play CDN at runtime** (`cdn.tailwindcss.com`): it compiles CSS in the page and watches every DOM mutation (158 ms at load, ~10–16 ms per 20 s afterwards here). A pre-generated stylesheet committed to the repo (regenerated by a script when classes change) would remove both. Needs a generation step, so not done here.
5. **Chunk merge in one frame**: `chunkBuildProxy` builds all of a chunk's merged meshes at once (up to 27k vertices, 1–5 ms warm, ~23 ms cold). Could be split per material across frames, and the per-vertex `Vector3.applyMatrix4` loop inlined.
6. **Land fills replay at startup**: every entry in `state.landFills` re-runs `refreshTerrainAround` + `refreshTerrainColors` on load, and the list only grows with play. Worth merging finished fills into one stored height patch once there are many.
7. **Sea dragon**: still ~0.12 ms a frame while on screen; it could re-shape every other frame when far from the camera (a visual trade-off, so not done).

## Test results
All run one at a time from the qa-tools worktree against `agent/audit-perf` (KELO_ROOT=/home/user/kelo-bot-1).

| Test | Exit | Page errors |
|---|---|---|
| harness.js reload | 0 | none |
| harness.js chat | 0 | none |
| harness.js ui | 0 | none |
| harness.js water | 0 | none |
| harness.js vehicle | 0 | none |
| harness.js snow | 0 | none |
| harness.js basement | 0 | none |
| harness.js haul | 0 | none |
| ws.js sla | 0 | none |
| ws.js floor3 | 0 | none |
| navtest.js | 0 | none |

Note: an earlier combined `ws.js sla floor3` run hit the 60-minute `timeout` (exit 124) while the 30-minute soak was sharing the CPU; it had reached the floor3 glass shots with no errors. Rerun separately (no other load, 90-minute limit) both passed as above.

Other checks: `node --check` on every changed JS file passes; the duplicate top-level name check prints nothing.

