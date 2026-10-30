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
- Check that every test run finishes with no page errors.

## Exact next steps (open tasks)
1. **#27 Disposal pit.**
   - Add a pit where he throws unwanted items and dirt.
   - Anything thrown in is permanently gone: remove it from `inventory`, `storedItems` and vehicles.
   - Replace or merge it with the `SPOIL_HEAP` at (20, -9) and make `haulDirt` dump there.
   - Give it a visible 3D pit and add an agent action for it.
2. **#26 Tools work only as intended.**
   - Each tool or vehicle needs a "how to use it" note learned by researching at the NetNode before he can use it.
   - He must climb in and operate a vehicle before it does anything.
   - Add prerequisites:
     - telescope: stars only, and only at night
     - hot-air balloon: fill the propane tank first
     - vehicles: need fuel
3. **#21 Seasons and snow.**
   - Show seasonal visuals, including snow cover in winter.
   - In snow he sinks and gets stuck, then works it out: research leads to a request, and the visitor gifts the solution (snowshoes, skis, snowmobile or helicopter).
4. **#23 Shape the world.**
   - Chop trees with an axe, plant seeds he has requested, build roads and terraform.
   - He can undo or remove anything he has added. Buildings stay untouchable.
5. **#24 Real builds.** He requests the materials needed to build real items he finds online.
6. **#25 Polish.** Improve the graphics and the UI/UX of interactions.
   - On mobile the vitals grid in the top-left card is cramped (labels overlap).
7. **Cleanup.** Remove the dead `showEquipmentAt` function in `js/mining.js`.

Make sure everything looks right when it is built, removed or invented. Check each change with a screenshot.
