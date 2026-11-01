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
- **Easier exploring** (`js/explore.js`, `js/minimap.js`, `js/tryit.js`).
  - The camera is driven by `exploreCameraUpdate()` (hooked first in the animate loop's camera chain). `state.cameraMode` is `'follow'` or `'explore'`; other values (`'none'` in tests, the old presets) leave it alone. OrbitControls stays only to aim the camera: `controls.enabled = false`.
  - `exploreFlyTo({ x, z, dist, pitch, yaw, follow })` flies smoothly; `explorePlaces()` lists every place with its framing. The old `data-cam` buttons and the HUD Follow button are intercepted and fly instead. WASD/arrows are caught in the capture phase, so `arrowKeyState` stays false.
  - A ground click calls `showExploreSpotMenu` (Fly here / Send Kelo-1 here / What's this?) instead of sending him; `exploreSwallowClick` ignores clicks that end a drag or pinch.
  - Try it: `tryit.js` wraps `worldNow()` to apply `previewSeason`/`previewHour` (module variables, never saved) and sets `windOverride`. Sample gifts are real `postMail` parcels.
  - The help card is skipped when `navigator.webdriver` is set, so test clicks aren't covered.
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
  agent → memory → worldclock → needs → forms → netnode → conversation → postoffice → workshop → hobbies → mining → growth → scene → house → animations → items3d → gearmodels → everydaymodels → materials → realmodels → storehouse → museum → basements → viewer → takeout → tidyup → vehicles → landfill → disposal → knowhow → seasons → wind → landscape → projects → town → coderequests → shopkeeping → printer → main → portal → explore → minimap → tryit.
  (`js/shop.js` is loaded only by `shop.html`.) A later file silently replaces a same-named function from an earlier one, so keep top-level names unique.
  Three.js r128, Tailwind and Phosphor all load from CDN. Other languages are allowed if they help.
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
All the planned tasks (#21 to #27) are done. Ideas for what could come next:
1. More `BUILD_PLANS` (a doghouse, a kayak rack, a treehouse platform), and letting him use firewood logs from chopping as lumber.
2. Rain in spring, and ice on the lake in winter (he could walk on it once he has learned it is safe).
3. More polish (#25 is ongoing): icons for the tabs, and a way for the visitor to see a map of everything he has changed.

Make sure everything looks right when it is built, removed or invented. Check each change with a screenshot.
