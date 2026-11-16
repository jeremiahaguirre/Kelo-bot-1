# Graphics pass: "richer stylized" (branch `agent/graphics`)

Owner's ask: the game "still looks too raw", bring it to life in a richer stylized look; laptops first (website and Windows app), every effect behind a quality setting, a good frame rate. Gameplay, the HUD and the design system are unchanged.

Code: four new files after `realism.js` (`js/look.js`, `js/scatter.js`, `js/ambience.js`, `js/surfacedetail.js`), a 6-line change in `js/scene.js` (valley flowers handed to one instanced mesh), the Settings text and option labels in `index.html`, `CREDITS.md`. All look numbers live in one object, **`LOOK`** (`js/look.js`), so the Three.js upgrade can retune them. Details for maintainers are in `.claude/handoff.md` ("Graphics pass").

## What changed, by the owner's list

1. **Ground**: the terrain shader (realism.js already picks grass/dirt/rock/sand/snow from the ground's colour and slope) now also blends by noise and height: ragged dirt patches in the meadow, scree and rock taking over as the ground climbs, sand along the lake by height, darker wet sand at the waterline, warm rock strata and moss on rock ledges, and drifting cloud shadows. Grass near the camera: an inner ring (cell 0.42 units, 9 units) and a coarse outer ring (0.8) out to 24 / 15 / 7 units (High / Medium / Low; it was 17 / 11 / 0), thinning with distance and centred toward the camera so the foreground gets grass; flowers (one instanced mesh, six petal colours by patch, more in spring, none in winter) share the spots. Both sway with wind.js's wind on the GPU.
2. **Vegetation and props**: every tree is joined into one mesh per material (2 meshes per tree; a fir was 7, a broadleaf 10-13), and the broadleaf crowns now sway in the vertex shader like the firs, so wind.js no longer moves ~350 leaf meshes on the CPU each frame and the chunk system can merge them. Each tree has its own size (broadleaf 0.82-1.22, fir 0.9-1.12), proportions and a slight lean. The 70 valley flower patches (140 meshes, 140 materials) are one instanced mesh of 3-5-flower clumps. Tree ids, obstacles, spots, chopping and seasons are unchanged.
3. **Light**: wider PCF shadow filtering (radius 2.6 / 2.0 / 1 on High / Medium / Low), baked contact shadows (one instanced mesh of soft multiply quads under every building footprint, tree and rock, tilted to the slope), a warmer golden hour (sun and sky light tinted, exposure lift), colour grading by time of day (contrast, saturation, warm dusk / cool night split toning, gentle vignette) and bloom on Medium and High. SSAO was not used: it needs a normal/depth pass that would cost laptops more than the baked contact shadows.
4. **Atmosphere**: height fog (low valley mist, thickest in the morning, thin by day) patched into three.js's fog chunk so every material gets it with no extra pass; light shafts toward a low sun on High (screen-space, in the final pass); drifting pollen and dust by day, falling leaves in autumn, fireflies on summer nights (one shader-driven points mesh); the existing birds and drifting clouds kept. Lake: sun glitter on the ripples (strongest at golden hour) and a whiter foam band at the beach, on top of the existing ripples, rain rings, foam line and sky reflections.
5. **Life in town**: five original townspeople (simple figures, 5 instanced parts for all of them) walking set routes along Main Street and the shore; they wait when Kelo-1 is in their way, turn back at obstacles and the water, and half go home late at night. A car drives along Main Street now and then (Medium/High), waits for Kelo-1, and has lit headlamps after dusk; up to three parked cars stand on open ground off his roads, parking and pins (box obstacles, so he walks around them). Chimney smoke from the house (shader-driven, leans with the wind, thicker in winter and at dusk), waving pennants on three roofs, and warm lamplight pools on the ground in front of the buildings after dark (windows already glowed at dusk through the building kit).
6. **Materials**: every procedural finish texture used on buildings and props (lap siding, brick, stucco, roof shingles, standing-seam metal, panels, wood grain, bark, stone) gets a tangent-space normal map computed from its own canvas (Sobel), replacing the bump map on Medium and High. All original, made in code; credited in CREDITS.md.
7. **Graphics quality**: Settings → Graphics quality shows **Low / Medium / High** (stored keys stay `fast` / `balanced` / `high`, so saved choices keep working). The first time the game runs on a device with no saved or automatic choice, a quick benchmark times 70 frames on Medium 5 s after the world is ready, moves to High if the frame time is under 19 ms and High holds under 24 ms, or to Low over 30 ms, and saves the pick on that device (`kelo-graphics-auto`, `kelo-graphics-bench`). The visitor's own choice always wins; the existing frame-rate watcher still steps down.

| effect | Low | Medium | High |
|---|---|---|---|
| post: bloom, grading, vignette | off | on | on |
| light shafts | off | off | on |
| valley mist, cloud shadows | on | on | on |
| ground blending (noise, height, wet sand, strata, moss) | off | on | on (+ bump detail) |
| contact shadows | on | on | on |
| grass radius / flowers | 7 / off | 15 / on | 24 / on |
| air motes | off | 140 | 260 |
| townspeople / passing car | 3 / off | 5 / on | 5 / on |
| smoke, flags, lamplight pools | on | on | on |
| normal maps on finishes | off (bump) | on | on |
| shadow filter radius | 1 | 2.0 | 2.6 |

## Measurements

Machine: the cloud test container, Chromium headless with SwiftShader (software GL on 4 CPU cores, about 1 frame a second at 640×400). Draw calls, triangles and JavaScript time are real; **frame times are CPU rasterisation, not a laptop GPU, and are only a rough hint of fill cost.** "Before" is `main` at 0e90dc6 (the commit this branch started from); "after" is `agent/graphics` with `main` 5b0c4df merged (main's own changes in between were game logic, not drawing). Same seeded world, his life frozen, noon in summer, same camera per view, the game's automatic step-down disabled during measuring. Tools: `qa/gfxviews.js` (views, perf and screenshots), `qa/effects.js` (per-effect cost), on `qa-results-graphics`.

### Draw calls, triangles, JS per view and level (full frame incl. the shadow pass)

"Game JS outside render" is the time inside the frame loop minus the time inside `renderer.render`, averaged over ~6 frames: at 1 fps it is noisy (it swings 2-3× between runs of the same build), so use the per-effect timings below for the cost of the new code.

**Low** (`fast`)

| view | draw calls before → after | triangles before → after | game JS ms/frame outside render, before → after | frame ms (software GL) before → after |
|---|---|---|---|---|
| town | 1206 → **1049** (-13%) | 289k → 298k | 8.43 → 1.7 | 878 → 818 |
| mainstreet | 1248 → **1026** (-18%) | 259k → 267k | 2.72 → 1.33 | 879 → 834 |
| lakeshore | 1167 → **1104** (-5%) | 272k → 274k | 2.25 → 1.58 | 1072 → 932 |
| meadow | 1092 → **885** (-19%) | 251k → 261k | 1.87 → 1.43 | 822 → 884 |
| workshop | 1065 → **1005** (-6%) | 327k → 327k | 11.8 → 9.85 | 1348 → 1263 |
| northyard | 189 → **189** (+0%) | 208k → 209k | 2.55 → 8.02 | 657 → 686 |
| golden | 1361 → **1248** (-8%) | 343k → 346k | 1.73 → 2.47 | 810 → 799 |
| night | 1087 → **1124** (+3%) | 287k → 319k | 2.47 → 2.58 | 751 → 817 |
| all 8 views | 8415 → **7630** (-9%) | | | |

**Medium** (`balanced`)

| view | draw calls before → after | triangles before → after | game JS ms/frame outside render, before → after | frame ms (software GL) before → after |
|---|---|---|---|---|
| town | 1297 → **1134** (-13%) | 308k → 316k | 6.1 → 7.35 | 1204 → 1229 |
| mainstreet | 1342 → **1081** (-19%) | 274k → 278k | 5.73 → 5.28 | 1231 → 1332 |
| lakeshore | 1180 → **1128** (-4%) | 267k → 271k | 5.98 → 5.23 | 1564 → 1462 |
| meadow | 1093 → **891** (-18%) | 255k → 267k | 4.47 → 4.27 | 1321 → 1366 |
| workshop | 1203 → **1303** (+8%) | 369k → 378k | 14.63 → 11.07 | 2010 → 1830 |
| northyard | 208 → **241** (+16%) | 210k → 213k | 13.8 → 6.93 | 1302 → 1216 |
| golden | 1359 → **1127** (-17%) | 318k → 284k | 2.43 → 1.83 | 1108 → 1098 |
| night | 1085 → **1027** (-5%) | 269k → 277k | 3.73 → 2.25 | 1136 → 1102 |
| all 8 views | 8767 → **7932** (-10%) | | | |

**High** (`high`)

| view | draw calls before → after | triangles before → after | game JS ms/frame outside render, before → after | frame ms (software GL) before → after |
|---|---|---|---|---|
| town | 1399 → **1215** (-13%) | 325k → 330k | 8.28 → 7.68 | 1571 → 1330 |
| mainstreet | 1385 → **1106** (-20%) | 279k → 283k | 5.45 → 6.22 | 1692 → 1518 |
| lakeshore | 1233 → **1158** (-6%) | 273k → 275k | 6.55 → 4.98 | 1815 → 1845 |
| meadow | 1106 → **903** (-18%) | 260k → 268k | 4.53 → 4.23 | 1679 → 1667 |
| workshop | 1317 → **1317** (+0%) | 379k → 382k | 11 → 11.25 | 2308 → 2214 |
| northyard | 247 → **260** (+5%) | 211k → 214k | 8.73 → 11.03 | 1456 → 1610 |
| golden | 1411 → **1101** (-22%) | 289k → 291k | 2.55 → 1.88 | 1324 → 1287 |
| night | 1160 → **1066** (-8%) | 283k → 286k | 1.85 → 2.78 | 1339 → 1234 |
| all 8 views | 9258 → **8126** (-12%) | | | |

Where the calls went: the joined trees and the instanced valley flowers remove the most (Main Street, meadow, golden: -17 to -22%). New calls: the post passes on Medium (14 full-screen passes: bloom's mip chain and the final grade pass; Medium had no post-processing before), townspeople 5 + 5 shadow when in view, and 1 each for grass, flowers, contact shadows, air, smoke and lamplight pools. That is why the views without trees (workshop, north yard) went up on Medium (+8%, +16%); on High (which had bloom before) they are +0% and +5%.

### Frame cost of each effect

Draw calls of each effect's own objects, counted inside the renderer (`userData.fx` tags), and JavaScript of the new code, timed in the page:

| effect | draw calls (main + shadow) | JavaScript |
|---|---|---|
| post passes (bloom + grade + vignette; + shafts on High) | 14 full-screen passes (Medium and High) | none per frame beyond uniforms |
| townspeople | 5 + 5 (culled as one when out of view) | all ambience per frame (people, car, smoke, air, flags, pools): 0.021 ms (Medium, town), 0.031 ms (High, sunset) |
| grass / flowers | 1 / 1 | re-lay when the view moves: 1.6 ms (town, Medium), 4.0 ms (High, 204 tufts + 22 flowers in view); not per frame |
| valley flowers | 1 (was 140 meshes) | none |
| contact shadows | 1 (306 patches) | rebuild only when trees/buildings change: 4.7-5.8 ms; the 3 s check otherwise |
| air motes, chimney smoke, lamplight pools | 1 each | in the ambience number above |
| flags | 3 masts × 3 meshes (merged by the chunk system when far) | in the ambience number |
| mist, cloud shadows, ground blending, glitter, normal maps | 0 (in existing shaders) | look per frame (fog, grading, shafts, glitter uniforms): 0.004 ms (Medium), 0.009 ms (High) |
| joined trees | -5 to -11 meshes per tree (fir 7 → 2, broadleaf 10-13 → 2) | wind.js no longer moves leaf meshes on the CPU |

Frame time with each effect off and on, alternated twice (SwiftShader, so a fill hint only): every single effect was within this machine's noise, -4% to +7%, on both Medium (town) and High (sunset): bloom +1.5/+3.8%, grading -3.5/+3.1%, shafts +1.2%, mist -3.6/-4.4%, cloud shadows +2.2/+6.0%, ground blending +0.3/+6.6%, grass and flowers +3.9/-0.8%, contact shadows +1.6/+2.3%, air +0/+2.1%, town life +5.2/+4.8%. All views together, after vs before, ranged from -15% to +11% on this rasteriser. **Not verified: the frame rate on a real laptop GPU.** The first-run benchmark exists for exactly that: it picks the level on the device itself.

## Regressions

All on the merged branch, no page errors: `reload` (pit persists), `ui` (all menus, Settings shows Low / Medium / High), `chat`, `vehicle`, `haul` (4 loads tipped), `basement` (museum and storehouse). After merging `main` fa95c3f (the build step): `npm run build:site` passes (109 scripts bundled, the top-level name check passes with the four new files) and `reload` on the built `_site/` has no page errors. `navtest`: the same numbers as main's last recorded run, path for path (max jerk 0.044 to 6.697, no frames under ground or inside buildings).

## Screenshots

`graphics/shots/` holds every view before and after (taken at 2560×1600, deviceScaleFactor 2; saved as JPEG quality 88 to keep the branch small): town, Main Street, lake shore, meadow, workshop, north yard, golden hour, night on Medium; meadow, lake shore and sunset (facing the sun, light shafts) on High. `graphics/pairs/` puts each pair side by side. Best pairs: `pair-sunset-high`, `pair-mainstreet-medium`, `pair-meadow-medium`, `pair-night-medium`, `pair-town-medium`. (`after-balanced-sunset` has no before: the sunset view was added after the Medium before-run.) The toast card in the middle of every shot is the game's own story card, the same in both.

## Known limits and open items
- Frame time on real laptops is not measured here (no GPU in the container).
- Townspeople and the passing car are visual only: Kelo-1 doesn't know about them; they wait for him, never the other way round. They can pass close to the NetNode front and the garden beds.
- The height-fog patch replaces three.js r128's fog chunks and checks their text first; with a newer three.js it switches itself off (no error) until it is redone for `vFogDepth` (noted for the upgrade in the handoff).
- Normal maps are chosen when a material is finished; changing the level later doesn't swap them until the page is reloaded.
- The parked cars add box obstacles (he walks around them); they are placed only where nothing of his is (roads, parking, pins, slopes are checked).
- Soft faint streaks can still show on bright rock right next to a low sun on High (light shafts); the dotted streaks seen in the first High sunset shot were fixed (only pale bright sky feeds the shafts, with per-pixel jitter).
