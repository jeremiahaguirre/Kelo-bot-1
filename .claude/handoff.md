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
  agent → memory → worldclock → needs → forms → netnode → postoffice → workshop → hobbies → mining → growth → scene → items3d → storehouse → vehicles → main → portal.
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
  - The spoil heap is at (20, -9).
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
4. **#21 Seasons and snow.**
   - Show seasonal visuals, including snow cover in winter.
   - In snow he sinks and gets stuck, then works it out: research leads to a request, and the visitor gifts the solution (snowshoes, skis, snowmobile or helicopter).
5. **#23 Shape the world.**
   - Chop trees with an axe, plant seeds he has requested, build roads and terraform.
   - He can undo or remove anything he has added. Buildings stay untouchable.
6. **#24 Real builds.** He requests the materials needed to build real items he finds online.
7. **#25 Polish.** Improve the graphics and the UI/UX of interactions.
   - On mobile the vitals grid in the top-left card is cramped (labels overlap).

Make sure everything looks right when it is built, removed or invented. Check each change with a screenshot.
