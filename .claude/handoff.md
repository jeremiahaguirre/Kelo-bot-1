# Kelo-bot-1 handoff

## Current goal
Kelo-1 is an autonomous robot who lives in a 3D low-poly Kelowna valley (static GitHub Pages site plus a Windows Electron app).
He must **discover** how his world works by himself. That covers:
- needs
- seasons
- tools
- vehicles

Everything he gets (tools, vehicles, seeds, materials) arrives **only** through his own requests at the Post Office, which the visitor gifts.
He may change the world freely. He can never move or change the buildings, and he can't build new ones.

## Recently shipped (on `main`, pushed)
- **Build anything from a bill of materials** (`js/bom.js`, `js/buildmodels.js`, `js/assembly.js`, branch `agent/assembly`).
  - `BOM_TEMPLATES` (bom.js): ultralight airplane, go-kart, cedar-strip canoe, garden shed, quadcopter drone, electric guitar, wooden sea kayak, tree fort. Each has sub-assemblies with lines `[name, qty, unit, kind 'p'|'f'|'c', step?]`, steps `[verb, tool key, text]`, tools, skills, tests (and `cg` weight-and-balance limits for the airplane). `bomFromAI(target)` asks the AI for strict JSON; `normalizeBom` validates and caps everything (`BOM_LIMITS`). `bomLineStep` decides which step uses a fastener or consumable up.
  - `researchBuild(target, why)` (NetNode, wikiSummary) creates `state.buildProjects[]` `{ id, status: gathering|testing|complete|finished, bom, site, tests, parcels, fuelGal }`. One big build at a time.
  - Lists: `askForLists(p)` keeps the tools list plus up to `ASSEMBLY_LIST_WINDOW` sub-assembly cards open in `state.requestsToUser` (`category: 'bomlist'`, `listProject`, `listSub`, `listRev`). main.js renders them with `bomListCardHtml` / `bindBomListButtons` (checkboxes, Send checked, Send all, Copy as text, Copy as Markdown, Not now). `sendBomList(reqId, lineIds|null, visitor)` posts one `kind: 'parts'` parcel; postoffice.js `openParcel` hands it to `openPartsParcel`, which counts `got` per line (tools go into toolInventory).
  - Building: `buildNextSubAssembly(id)` only when the sub's parts and tools are all here; each step holds the tool (`holdAssemblyTool`), poses (`assemblyPose`), reveals model parts (`applyBuildProgress`), counts fasteners down and uses consumables (`line.used`). `runBuildTests` (weight and balance, controls, engine run-up for the airplane), then `finishBuild` registers vehicles (`VEHICLE_TYPES` gets `plane` and `kart`), or adds the guitar/drone to his things. `ASSEMBLY_PACE` scales step timing.
  - Sites are constants (`ASSEMBLY_SITES`): the airfield strip south of the Museum (-31, 2), the beach (-8.5, 8.3) for boats, and the bench (`workbenchSpot()` / `WORKBENCH` from js/workbench.js if present, else beside the welding studio). Trees on the airfield footprint are cleared with a chainsaw or axe (real `chop` world edits).
  - Flying: `pilotTrained()` = ground school (`state.pilotTraining`, `knowHow.airplane`) + 3 taxi runs + `flying airplane` skill ≥ 1 (`learnToFly`). Only then is the airplane registered; `flyBuiltAirplane` uses `driveVehicle`, and vehicles.js calls `takeoffRunFor` / `planeAltitude` for a takeoff roll and glide-in.
  - Hooks: life tick `assemblyActivity()` (loopguard key `assembly`), AI prompt `assemblySummaryForAI()` and `buildAnythingPromptLine()`, `applyBuildAnythingDecision`, chat `parseBuildRequest` ("build an airplane", "what parts do you still need?", "fly your airplane"), Brain tab `#buildProjectsContainer`.
  agent → loopguard → memory → worldclock → needs → forms → netnode → conversation → postoffice → workshop → hobbies → mining → growth → kelo-body → scene → realism → weldstudio → house → animations → items3d → gearmodels → everydaymodels → materials → realmodels → perf → storehouse → museum → basements → viewer → takeout → tidyup → vehicles → landfill → disposal → knowhow → itemuse → seasons → wind → weather → landscape → groundwork → skills → projects → bom → buildmodels → assembly → town → coderequests → wishfeatures → wildlife → companions → pastimes → shopkeeping → printer → main → portal → explore → minimap → tryit.
- **Realistic rendering** (`js/realism.js`, branch `agent/render`).
  - Colours: the built-in shaders are patched so every hex colour, vertex colour and colour texture is read as sRGB; output is sRGB with ACES filmic tone mapping and `physicallyCorrectLights` (point lights are scaled up to match). glTF materials can opt out with `defines: { KELO_LINEAR_COLORS: '' }`.
  - Sky: `THREE.Sky` (js/vendor) driven by `applySkyForHour(hour, dayOfYear)`, with the real sun position for Kelowna (49.9° N). `applyTimeOfDay` and `applyLightingPreset` both go through it. Fog colour is the sky's own horizon colour, worked out in JS each few frames. Stars, a moon and sprite clouds.
  - Lighting: three CC0 HDR photos (`assets/hdri`) blended by time of day and rendered to `scene.environment` with PMREM (re-rendered only when the light changes). `materialReflections()` now returns null so shiny things use it.
  - Water: the sea keeps its plane at -0.18; its material has moving ripples, sky reflections, a baked depth map (`bakeSeaDepth`, re-baked when landfill changes) for clear shallows and foam.
  - Ground: the terrain and outer lands share one textured material that reads the vertex colours to choose grass, dirt, rock, sand or snow textures (`assets/textures/terrain`, made by `scripts/terrain-textures.py`). Keep using natural colours when recolouring the ground.
  - Trees: `buildNaturalFir`, `buildNaturalLeafyTree` (same ids and spots; leaves drop in winter), an instanced forest on the far hills. Buildings get real-size siding, brick, shingles, stucco and steel via `dressBuilding` in materials.js.
  - Settings → Graphics (High / Balanced / Fast) in localStorage `kelo-graphics`; it steps down by itself if the frame rate stays under ~32. High adds bloom.
  - Welding Studio (`js/weldstudio.js`): a real fab shop around the old table spot (top still at -1.2, -8.2, 0.92; he still stands at -1.2, -6.6). `updateWeldingStudio` runs from `updateRealism`; the arc flare shows whenever `forgeArcLight` is on.
- **Cute Kelo-1** (`js/kelo-body.js`). A small, friendly humanoid robot about 2.6 units tall to the antenna tip (head top about 2.4): a big round teal head with a dark face screen, glowing eyes that blink and show happy (^ ^), sad (droopy, frown) or sleeping looks from `keloMoodNow()`, pink cheek lights, headphone ears and a spring antenna. About 18k triangles.
  - Rig names are unchanged (`keloBody` at `KELO_HIP_Y` = 1.06, legs at `KELO_LEG_Y` = 1.04, elbows, wrists, knees, ankles, `setKeloGrip`, `keloPalmLocal`). Other files read the limb lengths from the `KELO_*` constants, so changing them resizes poses, seats, squats and shelf reaches.
  - `updateKeloFace(t, dt, resting)` runs at the end of `finishKeloPose`. `keloSitKnee(a, hipH)` in animations.js bends his knees so his feet rest on the ground when he sits.
- **Code requests that really switch things on** (branch `agent/wishes`).
  - `js/wishfeatures.js`: `WISH_FEATURES` (key, `words` regexes, `ready()`, `build()`, `run()`, `chance()`, an AI `pastime` name). `wishFeatureFor(req)` maps built-in `CODE_WISHES` by key (`friends` → `friend`) and free-form requests by their feature text first, then the reason.
  - `markCodeRequest` (coderequests.js) only says "Done" for a ready feature: `enableWishFeature()` saves it in `state.unlockedFeatures`, builds it, and he goes to try it. Otherwise the card says "Needs new code" with "I'll code it" (`promiseToCode`, stays open as a to-do) and "Not now". `migrateCodedInWishes()` runs on load and switches on old "Coded in" answers that match.
  - Features: `wildlife` (wildlife.js: birds that flock, perch and peck; mule deer that graze and stot away; `studyWildlife()` with a Wikipedia fact), `friend` and `pet` (companions.js: they follow his trail and only read `keloGroup` position/rotation), `fishing`, `cooking`, `music` (WebAudio, `state.soundMuted`, `#btnSoundToggle`), `swimming` (`canSwim()` skips `checkDeepWater` after a lesson), `campfire`, `stars` (pastimes.js). `rain` is ready only once a rain function exists (`rainHook()` looks for `startRain` and similar from the weather branch).
  - Hooks: scene.js calls `updateWishFeatures(t)` after `finishKeloPose`; the life tick calls `wishFeatureActivity()`; the AI prompt gets `codeRequestHintForAI()`, `wishFeaturesPromptLines()` (a `pastime` field) and `applyWishFeatureDecision()`.
- **Load on demand** (`js/perf.js`, loaded after realmodels.js).
  - `perfWatchBuilding({ center, radius, forced, show, tick })`: a watcher on its own rAF calls `show(true)` when the camera is near and looking (distance `nearBuild` + frustum, with slack), `show(false)` after `PERF_FORGET_MS` away. The Storehouse ground-floor shelves and the Museum ground-floor art use it; far away they are `perfStandIns` (one InstancedMesh of coloured boxes). Shelf models build ~8 ms per frame; during an indoor trip (`indoorTrip.site`) they build at once. Shelf items never cast shadows.
  - Outdoor creations, `projectMeshes` and `editMeshes` are hidden beyond `viewDist` and stop casting shadows beyond `shadowDist`; their child meshes get `matrixAutoUpdate = false` (except `userData.spin`).
  - Settings → Performance (Auto/High/Low, `localStorage` `kelo1_perf_level`). `perfSettings()` and the `kelo-perf` event on `document` are for the renderer; `applyPerfToRenderer()` only caps pixel ratio and shadow map size on Low.
  - realmodels.js loads at most 2 glTF files at once and keeps 14 (`trimRealModelCache` never drops one still in the scene). viewer.js thumbnails are an LRU of 120.
  - Saving: `savePersistentBrainState()` now gathers asks (saves ~1 s after the last, at most 4 s after the first); `savePersistentBrainStateNow()` on pagehide/hidden/app pause/backup. `vocabulary`/`itemLookups`/`aiLearned` live in `kelo1_brain_v3_lore`, `itemDesigns` in `kelo1_brain_v3_designs`, listing pictures in `kelo1_brain_v3_shop_pictures` (shop.js merges them); old single-key saves still load. Unchanged keys are not rewritten. Restoring a backup blocks saves until the reload.
  - UI lists go through `perfSetHtml(el, html)` (rewrites only on change; card clicks use `onclick` so they aren't doubled). Long lists (inventory pills, invented creations, core memories) show a page with `perfMoreButton`.
  agent → loopguard → memory → worldclock → needs → forms → netnode → conversation → postoffice → workshop → hobbies → mining → growth → kelo-body → scene → realism → weldstudio → house → animations → items3d → gearmodels → everydaymodels → materials → realmodels → perf → storehouse → museum → basements → viewer → takeout → tidyup → vehicles → landfill → disposal → knowhow → itemuse → seasons → wind → weather → landscape → groundwork → skills → projects → bom → buildmodels → assembly → town → coderequests → wishfeatures → wildlife → companions → pastimes → shopkeeping → printer → main → portal → explore → minimap → tryit.
- **Cute Kelo-1** (`js/kelo-body.js`). A small, friendly humanoid robot about 2.6 units tall to the antenna tip (head top about 2.4): a big round teal head with a dark face screen, glowing eyes that blink and show happy (^ ^), sad (droopy, frown) or sleeping looks from `keloMoodNow()`, pink cheek lights, headphone ears and a spring antenna. About 18k triangles.
  - Rig names are unchanged (`keloBody` at `KELO_HIP_Y` = 1.06, legs at `KELO_LEG_Y` = 1.04, elbows, wrists, knees, ankles, `setKeloGrip`, `keloPalmLocal`). Other files read the limb lengths from the `KELO_*` constants, so changing them resizes poses, seats, squats and shelf reaches.
  - `updateKeloFace(t, dt, resting)` runs at the end of `finishKeloPose`. `keloSitKnee(a, hipH)` in animations.js bends his knees so his feet rest on the ground when he sits.
- **Rain, lake ice, more builds and the Map tab.**
  - `js/weather.js` (after wind.js). Spring rain comes from `rainForHour` (seeded like the wind; `rainOverride` forces it). It draws streaks (`rainfall`), darkens the sky by wrapping `applyTimeOfDay`, makes the ground darker and glossier, and fills puddles. `rainWatersPlants` adds `e.rainMs` to plantings (read by `growthOf`) and raises garden plot growth. `reactToRain` is the first-rain discovery (`state.knowsRain`, concept "Rain"); after that he enjoys it or shelters (`rainLikes`, `rainShelters`) and may ask for an umbrella.
  - Lake ice: `iceThicknessCm()` grows through winter and rots before spring; `iceSheet` covers the open water. `iceFloorAt(p)` lifts his feet onto ice that holds (5 cm or more), and `checkDeepWater` skips him there. `iceStepBlocked(p)` stops him at the edge until `iceKnownSafeNow()`: he looks (`firstLookAtIce`), reads at NetNode (`researchIce`, `state.knowsIceRule`), drills a test hole each winter (`testTheIce`, `knowsIceSafe`, `iceTestedWinter`, `iceLastTest`), then walks out (`walkOnIce`, asks for skates). With no ice the old drowning rule still applies; boats stay docked while it is frozen. Try it has a Rain row.
  - `js/projects.js`: doghouse, kayak rack (always on the beach) and treehouse platform (`inTree`: goes round a standing valley tree, which is scaled up by `TREEHOUSE_TREE_SCALE` and marked `hosting` so it is never chopped). `allocateMaterials(plan)` uses each owned thing once; with a saw, "Firewood logs" stand in for any `lumber: true` material (an extra "Sawing logs into rough boards" step, rough-sawn finish, `p.fromLogs`). `isLumberStock` keeps spare logs out of disposal. `firewoodModel()` is the log stack model (items3d rule).
  - Map tab (`#tab-map`, `worldChangesList`/`changesMapDraw` in minimap.js): every chop, planting, road, hill or hollow, hole, dirt pile, new land and build on the island map, with legend toggles and a list; tap to fly there. Also opened from the World tab. Tab icons are outlined when idle and filled when open; they fall back to emoji if the Phosphor font can't load.
- **#21 Seasons and snow** (`js/seasons.js`).
  - `inSnow(p)` uses `SNOW_LINE` per season (all land in winter, the high mountain otherwise). `snowWalkFactor`/`snowSink` slow him and sink him in `scene.js`.
  - `checkSnowStuck` → `getStuckInSnow` → `researchSnowTravel` asks for snowshoes, skis and a snowmobile.
  - `applySeasonLook()` recolours the terrain from saved base colours, recolours leaves and needles (materials tagged `userData.seasonal`), and switches the winter snowfall on and off.
- **#23 Shape the world** (`js/landscape.js`).
  - The jobs: `chopTree` (needs an axe and its know-how), `plantSeeds` (grows over `GROW_DAYS`), `buildRoad` (a shovel plus gravel), `raiseHill` (`landscapeRaiseAt` feeds `getAnalyticalGroundHeight`) and `undoEdit` (anything except a chop).
  - Changes are saved in `state.worldEdits`; `offLimits()` protects the buildings, the yard, the balloon field, the pit and the shore.
  - Valley trees are now seeded (`valleyTrees` with ids).
- **#24 Real builds** (`js/projects.js`).
  - `BUILD_PLANS` (6 real items, each with its materials, tools and a real-size model). `startProject` is a NetNode visit followed by requests.
  - An 8-second check calls `buildProject` once everything has arrived: it builds at the bench, uses up the materials, and places the item (`state.projects`).
  - Reading at NetNode can spark a project (`maybeProjectFromReading`), and the AI can choose one with `buildProject`.
- **Things are used only as intended, and expendables run out** (`js/itemuse.js`, after knowhow.js).
  - `ITEM_KINDS` says what every kind of thing is for (`itemKindOf`, `intendedUseOf`, `usableFor(name, purpose)`). Unknown things are looked up once at NetNode (`lookUpItemUse`, cached in `state.itemPurposes`).
  - `useItemFor(name, purpose)` is the one way to "use" a stored thing (takeOutToUse, the AI's `useItem` and `takeOut.for`): the wrong purpose and he says so, then picks the right thing or asks for it. `vetDecisionItemUse` catches AI plans like "hammer with the banana". `hobbyGearCheck` gates hobbies; `buildableOwnedNames` gates builds.
  - Consumables keep uses in `state.supplies[name] = { cur, per }` (the open copy; spare copies are full). `useUpItem(name, n)` opens the next copy, and when the last is gone writes a diary line and asks again if he still needs it. Shown as "Spray paint (2 of 3 left)" in the inventory pills and Storehouse viewer. Filament keeps its grams in printer.js. Old saves start full (`ensureSupplies` on load).
- **#26 Tools work only as intended** (`js/knowhow.js`).
  - `GEAR_KNOWHOW` lists each tool and vehicle with its Wikipedia page, a how-to line and its fuel. `state.knowHow[key]` is set by `learnToUse()` (a NetNode trip).
  - `readyToOperate(name, v)` gates digging, hauling, boating and long rides; `{ quiet: true }` checks without fixing anything.
  - Fuel: new vehicles have `fuel: 0` (older saves count as full), `burnFuel()` runs after each drive, `requestFuel()` asks for the right kind, and `receiveFuel()`/`refuelWith()` handle a delivery.
  - Telescope: `stargaze()` shows stars only at night.
- **#25 graphics and UI/UX, rounds 2 and 3.** Collapsible Brain tab sections, plainer labels, and real-size food, toys and instruments (`js/everydaymodels.js`).
- **Detailed vehicles and tools** (`js/gearmodels.js`).
  - Vehicles are built at real size around Kelo-1 (about 2.8 units tall, sitting 0.3 above his feet). `miniature()` wraps them for the counter, and vehicles.js sets `userData.mini` back to scale 1.
  - `userData.seat` is where he sits, `boardingSpot()` is the driver's door, and the truck's `bed` tips. The excavator's `house` and `boom` swing, and the helicopter `rotor` spins.
  - Parking: the gravel yard east of the Post Office (`VEHICLE_YARD`, `YARD_SLOTS`), a helipad (`AIR_SLOTS`), the balloon field in the West Meadow (`BALLOON_SLOTS`), and the dock (`DOCK_SLOTS`, bow out). `reparkOldVehicles` migrates old saves.
- **Proportions.** `lifeSize(model, maxSize)` in items3d.js shows `realSize` models (built in metres) at 1.6× and older display-size models at 1×. Carrying, the shelves and the counter all use it.
- **UI pass (#25, first round).** Mobile vitals grid, the header badge hidden on phones, plain wording in the Talk tab, quick gifts removed, the place shown in the bottom panel (which shifts when the menu opens), and empty states in the Brain tab.
- **Disposal Pit (#27).** `js/disposal.js`, loaded after vehicles.js. It replaces the spoil heap.
  - The pit is a real terrain hole at (20, -9) (`pitDepressionAt`, summed with dig holes in `groundDugAt` in scene.js), with a stone rim, a sign and a pin (`TOWN_LOCATIONS.disposal_pit`).
  - `disposeItem(name, why)` carries the item (or drives the vehicle) there and drops it in. `forgetItem` removes one copy from toolInventory, toys, belongings, unstoredItems and vehicles.
  - `haulDirt` tips the truck load into the pit via `tipDirtIntoPit`.
  - The life tick calls `disposeUnwanted()`, which clears dig junk (now kept as `category: 'junk'`) and duplicate items. The LLM has a `discard` field.
  - State: `disposedItems`, `dirtDisposed`. The old `spoilHeap` key was dropped.
  - The outer-lands backdrop mesh now drops 8 units below the island interior, so holes are no longer covered by it.
- **Removed** the dead `showEquipmentAt` from mining.js.
- **Bottom-center activity panel.** `#keloOverheadHUD` in `index.html` is now a docked panel at the bottom middle. It is no longer projected over his head, and the projection was removed from `js/scene.js`.
- **Bottom-left bar removed.** The old activity bar is gone. The water-garden button moved to the menu's World tab, the camera bar moved to `top-44 left-3`, and the d-pad is bottom-right on desktop only.
- **Settings modal rewritten.** It has an AI keys section, and the raw tick output now sits in a collapsed `<details>`. The element IDs are unchanged.
- **No coordinates on screen.** `stripCoords()` in `js/agent.js` removes `(x, z)` along with the preposition in front of it. `escapeHtml()` calls it, and the main.js `textContent` setters are wrapped in it. Dig sites are now labelled "Mountain dig" or "Valley dig".
- **Earlier work, also shipped:**
  - storehouse (`js/storehouse.js`)
  - full-state persistence (generic snapshot minus `TRANSIENT_STATE_KEYS` in `agent.js`)
  - 12h-day / 365-day calendar and seasons (`js/worldclock.js`)
  - hidden needs (food, water, sleep) with discovery and stumbling (`js/needs.js`)
  - drivable vehicles, wading, boating and dirt hauling (`js/vehicles.js`)
  - 3D outer lands with a camera-following sky dome (`js/scene.js`)

## Architecture decisions
- **No build step.** The page uses plain global-script JS loaded in order from `index.html`:
  agent → loopguard → memory → worldclock → needs → forms → netnode → conversation → postoffice → workshop → hobbies → mining → growth → kelo-body → scene → realism → weldstudio → house → animations → items3d → gearmodels → everydaymodels → materials → realmodels → perf → storehouse → museum → basements → viewer → takeout → tidyup → vehicles → landfill → disposal → knowhow → itemuse → seasons → wind → weather → landscape → groundwork → skills → projects → bom → buildmodels → assembly → town → coderequests → wishfeatures → wildlife → companions → pastimes → shopkeeping → printer → main → portal → explore → minimap → tryit.
  (`js/shop.js` is loaded only by `shop.html`.) A later file silently replaces a same-named function from an earlier one, so keep top-level names unique.
  Three.js r128, Tailwind and Phosphor all load from CDN; three.js add-ons are vendored in `js/vendor` and assets live in `assets/` (served from 'self'). Other languages are allowed if they help.
- **State and persistence.**
  - One global `state` object.
  - `keloStore` wraps localStorage on the web and a 10 GB disk store in Electron (`desktop/`).
  - Autosave runs every 20s, on visibility change and on pagehide.
  - New fields persist automatically unless they are listed in `TRANSIENT_STATE_KEYS`.
- **Thinking.** The AI order is Gemini, then Claude, then a built-in brain. Keys live only on the device. **Never commit API keys.**
- **Movement.**
  - A* pathfinding avoids `worldObstacles` circles.
  - `ridingSpeed` scales the walk step.
  - Paths over water and through the air are straight lines.
- **Vehicles.**
  - `VEHICLE_TYPES` covers truck, excavator, boat, bike, snowmobile and air.
  - Vehicles park in `YARD_SLOTS` or `DOCK_SLOTS` and are excluded from the storehouse shelves.
  - The Disposal Pit (which replaced the spoil heap) is at (20, -9).
- **Phone apps (Capacitor 8).** `npm run cap:sync` builds `www/` (git-ignored) with `scripts/build-web.mjs`: local three/Phosphor/fonts, compiled Tailwind, an app-only CSP, and `js/native.js` + `css/native.css` injected before agent.js. `native.js` exposes `window.keloNative` (memory files loaded into a cache before any DOMContentLoaded handler runs, write-through saves; Keychain/Keystore keys with the same getKeys/setKeys shape as `keloDesktop`). Native projects in `android/` and `ios/`; CI in `mobile.yml`; owner guide in `docs/MOBILE.md`. If you add a CDN script to index.html, add its local copy to build-web.mjs (the build fails loudly otherwise).
- **Cloud dreams.** `.github/workflows/dream.yml` runs every 6h and writes `brain/growth.json`. `desktop.yml` builds the Windows app.
- **Commits.**
  - Author every commit as `jeremiahaguirre <46036250+jeremiahaguirre@users.noreply.github.com>`.
  - Add no Claude attribution.
  - Keep commits small.
  - Don't push tags or Releases. That was denied before, so the user does it.

## Testing
- Serve the site with `python3 -m http.server 8765` from the repo root.
- The Playwright harness is at `<scratchpad>/harness.js`, and the scratchpad does not survive the session. It routes three, tailwind and phosphor to local copies and mocks the Gemini and Wikipedia calls.
  - CDNs are blocked by the proxy, but npm works. Get three from `npm pack three@0.128.0` (build/three.min.js and examples/js/controls/OrbitControls.js). Get tailwind from `npm pack @tailwindcss/browser@4.0.0` (dist/index.mjs), wrapped in an IIFE so its globals don't clash with the page's.
  - Set `state.cameraMode = 'none'` before positioning the camera, or follow mode overrides it.
- Check that every test run finishes with no page errors.

## Exact next steps (open tasks)
Rain, lake ice, the three new builds, sawing logs into lumber and the Map tab are done. Ideas for what could come next:
1. Ice skating as a hobby once skates arrive, and ice fishing through his test hole.
2. Puddles that splash under his feet and a rainbow after a shower.
3. A kayak that actually sits on the kayak rack when he owns one, and a dog for the doghouse (a code wish).

Make sure everything looks right when it is built, removed or invented. Check each change with a screenshot.
