# Engine work (branch agent/engine): report

## Commits on agent/engine (from main)

| Commit | What |
|---|---|
| 1c9a2e1 | Fixed-step simulation: walking, driving and flights run at 60 Hz with interpolated drawing; swept collision substeps; frame-driven tweens |
| 0bbd2d9 | Frame-rate independent motion: particles, easing (`1 - exp(-k dt)`), snowfall, door and wall fades, timer-stepped scripted motion moved onto frames |
| e044ade | World chunks: 32-unit grid registry; per-chunk view, draw-distance and shadow culling; merged per-material meshes for quiet chunks away from the camera |
| 932bed1 | Shatter: when the time runs out, run the remaining physics steps so shards always settle in the same place |
| 2b41e76 | Handoff notes |

All changed JS passes `node --check`, and the duplicate top-level name check prints nothing. Old saves load (the harness `reload` test passes). There are no gameplay changes and no new globals that clash.

## How chunks, culling and LOD work (js/chunks.js)

- **Registry, no reparenting.** About 2.5 s after start, and again every 2 s, static meshes are found in the scene and filed into a 32×32-unit grid by their world position.
  - Groups wider than 1.25 chunks are kept whole in a container entry.
  - Anything added later is picked up automatically, so new areas such as agent/runway's 3,200-unit strip need no code.
  - Dynamic things are never registered: Kelo, vehicles, aircraft, clouds, birds, wildlife, boats, carried items, sky, lights, points, lines, sprites, and anything with `frustumCulled = false`.
  - A root that moves more than 0.5 units from where it was registered is released.
  - `Object3D.remove` is wrapped so removed subtrees are untagged.
- **Culling without touching `.visible`.** Each registered mesh gets a `KeloChunkLayers` (a `THREE.Layers` subclass).
  - Three r128 calls `layers.test(camera.layers)` for both the main pass and the shadow pass. The override answers from the chunk's flags:
    - main pass: chunk in the camera frustum (with a 4-unit margin) and within draw distance;
    - shadow pass: chunk in the shadow camera's box (10-unit margin).
  - Draw distance is `min(preset drawDist, fog fade-out distance)`. New `drawDist` values: High 900, Balanced 600, Fast 440. Anything beyond them is already fully fogged, so nothing visible is lost.
  - Every other camera (minimap, Map tab, explore, eyes) uses its own layers object, so it sees everything as before.
  - Indoor trips leave the world as it is; the interior is just more registered or excluded meshes.
- **LOD by merging.** A chunk more than 24 units from the camera that has been quiet for 4 s gets a proxy: its opaque meshes merged per material and shadow flags into a few big meshes, built one every 3 frames, nearest first. While the proxy shows, its source meshes skip both passes.
  - A rolling signature check watches each source mesh: matrix, material, geometry, position version, visibility, layers and shadow flags. Any change drops the proxy and marks that mesh busy for 15 s, so animated meshes stay live.
  - Not merged:
    - transparent, instanced, skinned or morph meshes;
    - multi-material meshes;
    - meshes with custom shaders other than foliage sway (sway is kept through a per-vertex root attribute);
    - meshes with a non-zero render order or a custom draw range;
    - small casters (which get their own shadow treatment).
- `window.KELO_CHUNKS_OFF = true` turns it all off; `chunkStats()` reports counts and ms.

## What was converted to dt

- **Fixed-step physics (js/scene.js, motion.js, vehicles.js, assembly.js).**
  - The simulation runs on a 60 Hz accumulator, capped at 10 steps per frame; leftover time is dropped so a stall can't snowball.
  - It covers Kelo's walk and drive, flights (plane circuit, balloon and heli altitude), and any step hooks (`keloEveryStep`).
  - Drawing interpolates between the last two steps by `alpha`. State is swapped in for the frame and restored afterwards, unless game code wrote it during the frame (a teleport snaps).
  - Movement within a step is split into pieces of at most 0.12 units. Each piece is checked against obstacles (slide plus push-out), so a fast vehicle can't skip a thin wall.
- **Per-frame increments → time-based.**
  - Particles: mining debris, drill and weld sparks, CNC spray, additive puffs. Emission now uses accumulators.
  - Pan speed, antenna impulse, snowfall, wildlife speed, weld lean.
  - Door and front-wall fades.
  - Easing `Math.min(1, dt*k)` → `1 - exp(-k dt)` in wind, weather, companions, wildlife, plant care, upgrades and plant models.
- **setTimeout-stepped motion → frame-driven.** `keloNextFrame` and `keloTween` replace the timer steps in:
  - pit drop and truck tip; landfill tip and clump;
  - unboxing; tree topple;
  - trips, forklift, plane push/turn, weld walk.
  - Shatter shards use fixed 30 ms physics steps with interpolated drawing.
- **Explore camera follow spring.** Substeps interpolate the goal, so the camera lands in the same place at any frame rate.

## Numbers

Software-rendered (no GPU) cloud machine, seeded world, virtual clock, 5 measured frames per view.

- Frame ms is pixel-fill bound here, so the meaningful numbers are draw calls and triangles. On a real GPU, draw calls are the main CPU cost.
- JS ms is noisy over 5 frames. On these 1–2 s frames the fixed step runs its 10-step cap every frame, versus 1 step per frame at 60 fps.
- The chunk system itself costs 0.3–1.1 ms per frame (4.3 ms at worst, while building a proxy).

| Preset | View | Draw calls before → after | Triangles before → after | JS ms/frame before → after | Frame ms before → after |
|---|---|---|---|---|---|
| fast | town | 1775 → 1374 (-23%) | 292724 → 298551 (+2%) | 13.8 → 15.9 | 1235.5 → 1253.2 |
| fast | meadow | 1462 → 1351 (-8%) | 259604 → 261128 (+1%) | 10.3 → 12.6 | 1405.3 → 1400.5 |
| fast | mountain | 694 → 690 (-1%) | 211700 → 211376 (0%) | 9.2 → 7.1 | 897.7 → 880.3 |
| fast | high | 2362 → 1645 (-30%) | 330087 → 331863 (+1%) | 16.9 → 18.4 | 1356.3 → 1357 |
| fast | workshop | 1277 → 1277 (+0%) | 315328 → 315515 (+0%) | 13.7 → 19 | 2013.9 → 1974.7 |
| fast (phone 390×844) | town | 1248 → 1012 (-19%) | 260687 → 261527 (+0%) | 9.6 → 10.2 | 477.5 → 511.6 |
| fast (phone 390×844) | meadow | 699 → 698 (0%) | 216575 → 216241 (0%) | 7.2 → 6.7 | 442 → 440.5 |
| fast (phone 390×844) | mountain | 593 → 593 (+0%) | 200666 → 200296 (0%) | 6.8 → 7.8 | 333.5 → 315.9 |
| fast (phone 390×844) | high | 1862 → 1402 (-25%) | 295401 → 299599 (+1%) | 14.2 → 14.6 | 609.2 → 597.2 |
| balanced | town | 1910 → 1623 (-15%) | 312823 → 320834 (+3%) | 14 → 17.1 | 1651.3 → 1670.2 |
| balanced | meadow | 1470 → 1380 (-6%) | 265023 → 266032 (+0%) | 13.9 → 11.6 | 2050.5 → 1959.5 |
| balanced | mountain | 780 → 765 (-2%) | 225965 → 226447 (+0%) | 7.7 → 9 | 1506.8 → 1445 |
| balanced | high | 2521 → 1746 (-31%) | 339124 → 340481 (+0%) | 16.3 → 21.5 | 1996.7 → 1973.1 |
| balanced | workshop | 1221 → 1220 (0%) | 270148 → 270143 (0%) | 11.5 → 12 | 2403.6 → 2377.3 |
| balanced (phone 390×844) | town | 1386 → 1088 (-22%) | 281772 → 282396 (+0%) | 10.9 → 12.6 | 628.6 → 622.2 |
| balanced (phone 390×844) | meadow | 716 → 695 (-3%) | 222820 → 222641 (0%) | 8.4 → 9.9 | 617.4 → 618.7 |
| balanced (phone 390×844) | mountain | 685 → 684 (0%) | 215310 → 214760 (0%) | 6 → 7.5 | 487.2 → 504.3 |
| balanced (phone 390×844) | high | 1987 → 1564 (-21%) | 304128 → 309153 (+2%) | 12 → 15.4 | 808.6 → 805.7 |

Draw calls fall 15–31% where many separate objects are in view: town, high, and town and high on phone.

- Meadow and mountain views are already dominated by terrain and a few big meshes, so they gain little.
- The Workshop interior sits within 24 units of the camera, so nothing there is merged. Culling is also unchanged, because the building fills the view.
- Triangles rise 0–3% because merged proxies include whole meshes that per-object culling would have trimmed at the edges.

Raw output is in before-*.txt and after-*.txt. Screenshots (deviceScaleFactor 2, Balanced) are in shots/ for town, meadow, mountain, high, Workshop and phone.

## Visual check (chunk-ab.txt): PASS

The same page and frame are rendered with chunks on and off. Clouds, birds, the lake creature, the boat, wildlife and the HUD are hidden so nothing moves between shots. Two "off" shots give the noise floor.

On Fast and Balanced, the on-vs-off difference stays within that floor for town, meadow, mountain and high. Mountain is 0% for both. The on and off pictures are in ab/.

## Frame rate test, 30 / 60 / 144 fps (framerate.js)

Walk with the follow camera, truck drive, balloon climb and plane circuit, each run on a virtual clock.

- **Before:** FAIL. Worst difference 0.40: the plane is off by 0.40 at 30 fps, balloon z by 0.139, walk heading by 0.02.
- **After:** PASS, worst 4.1e-3, in drawn camera values only. The simulated positions, headings, speeds and altitudes are identical (0) at 30, 60 and 144 fps.

## Tunnelling test (tunnel.js)

- **Before:** FAIL. At 30 fps the truck at 33.7 u/s (1.12 units per frame) went through a wall of 0.1-wide posts at z 25.81.
- **After:** PASS at 30, 60 and 144 fps:
  - **wall:** never crossed; stops 0.66 short;
  - **Post Office at speed:** closest 0.64, same stop at every rate;
  - **thrown or dropped shards:** lowest 0.0000 above the floor; end positions at 30 and 144 fps identical;
  - **plane landing on the real strip:** stops at the end of its path; 30 vs 144 fps stops are 7.3e-4 apart. Lowest point is 0.03 below the ground estimate during rollout, from the existing path's ground smoothing, inside the 0.05 tolerance.

## Regression suite (suite.txt): all exit 0, "page errors: none"

- `harness.js`: reload, chat, ui, water, gear, haul, vehicle, snow, basement, landfill, planitems.
- `ws.js`: sla, garage, forklift, floor3.
  - floor3 hit the suite's 2400 s per-test timeout mid-job on this slow machine, while still progressing.
  - Rerun alone it passed in 2661 s: exit 0, "page errors: none". log-ws.js_floor3.txt has per-line timestamps.
  - The waits are long game-time job steps on 1–2 s frames. They are not caused by the fixed step, which advances up to 0.167 s per frame against the old 0.1 s cap.
- `itest.js`: netnode, cafe, post.
- `navtest.js`, `navfollow.js`.

## Left for later

- Indoor trips still follow their paths per frame, as before, rather than on the fixed step. They are scripted and collision-free, so tunnelling can't happen there.
- The plane rollout runs about 3 cm below the ground estimate. This predates this work (path ground smoothing) and isn't visible.
- Some periodic checks still run every N frames rather than every N ms. They are cadences for work like rescans and UI refreshes, not motion, so they don't change how anything moves.
- The sky dome and water shader already ran on clock time and were left alone.
- Proxies are built only for opaque meshes. Glass and other transparent meshes are still drawn one by one.
