# North yard fixes: owner's three arrows

Branch `agent/northyard` (3b79ef8, merged with origin/main at 416ca1e, skins). Screenshots are in `shots/` (before = main at 1eed4fe, after = this branch), taken at deviceScaleFactor 2 and noon from the same camera positions. QA scripts are in `qa/ny/`.

## What was wrong (one cause for all three arrows)
The far-lands mesh (`buildFarLands3D`, js/scene.js) has 60-unit cells and sat only 6 units below the finer meshes it hides under. Where a sunken vertex in the pass or the yard sat next to a high ridge vertex, the coarse triangle between them sloped up through the pass, the gap between the two buildings, and the garage hall's floor. Walking and driving used the analytic ground (flat), so trips "worked" through what looked like a solid mountain.

Ground-in-building probe on main (raycast every ground mesh on a 1-unit grid in each footprint):
- **Hall:** 313 of 832 samples above the floor, up to 16.5 units.
- **Hangar:** 622 of 1,792 samples above the floor, up to 11.4 units.

## Fixes
- **Arrow 2 (land inside the buildings):** `FAR_LANDS_SINK` = 80 wherever the outer lands, the north patch or the island cover the far lands. After: **0 samples above the floor in either building** (top 0.05, floor 0.17). `northYardGroundProbe()` (js/workshopnorth.js) runs this check in the game.
- **Arrow 1 (a way through for vehicles):** with the false mountain gone, the existing 22-unit pass cut is open and level at pad height, so the grade is flat the whole way. It is now the paved **Pass Road** (5.2 wide), with gravel shoulders, white edge lines and a dashed centre line, and `pathPassRoute` follows its centre line. The valley leg of the haul road stays gravel.
- **Arrow 3 (road between the buildings):** new paved roads in `KELO_ROADS`:
  - **Yard Street:** along the hall's doors and the hangar's back.
  - **Hangar Lane:** in the gap between the two buildings.
  - **North Apron:** past the hangar's door and the hall's back door to the taxiway's east edge.
- **Where they show up:** the new roads are drawn into the ground colours, on the minimap and on the Map tab's north sheet, and A* prefers them. One mesh, `buildRoadSurfaces3D` in js/roads.js, draws every paved road's surface.
- **Old saves:** `reparkOldVehicles` now moves land vehicles off any `through` road (it used to check only the haul road). The runway field and taxiway are untouched (`runwayKeepOff` points stay off the apron road).

## Screenshot pairs
| Arrow | Before | After |
|---|---|---|
| Owner's view (all three) | before-owner-view.jpg | after-owner-view.jpg |
| 1: from the valley up the route | before-valley-up-route.jpg, before-valley-high.jpg | after-valley-up-route.jpg, after-valley-high.jpg |
| 1: in the pass | before-pass-mid.jpg | after-pass-mid.jpg |
| 2: inside the hall | before-hall-inside.jpg, before-hall-inside-back.jpg | after-hall-inside.jpg, after-hall-inside-back.jpg |
| 2: inside the hangar | before-hangar-inside.jpg | after-hangar-inside.jpg |
| 3: between the buildings | before-between-buildings.jpg | after-between-buildings.jpg |
| 3: Yard Street, North Apron | before-yard-street.jpg, before-north-apron.jpg | after-yard-street.jpg, after-north-apron.jpg |
| Minimap / Map tab north sheet | before-minimap-north.jpg, before-maptab-north.jpg | after-minimap-north.jpg, after-maptab-north.jpg |

## Route probe (real trips, `qa/ny/routes.js`)
**Result: 40 of 40 legs arrived.** Run on the final merge, with all ten land vehicles parked at once.

Each vehicle drives four legs, from its valley slot:
1. Hall: the garage hall's bay-1 door, on Yard Street.
2. Hangar: the big hangar's apron.
3. Taxiway: its east edge.
4. Home: back to its slot.

**How it was run:**
- Vehicles drive at their real game speed.
- The game's arrival timeouts are stretched 8× to cover swiftshader's low frame rate.
- A leg counts as arrived when it ends within 3.5 units of the target.
- No position sample on any leg was inside a building footprint.
- The "road" share is from the A* path.

| Vehicle | Planner (`canDriveThere`) | Hall | Hangar | Taxiway | Home |
|---|---|---|---|---|---|
| Dump truck | yes | arrived (162 u, 77% road) | arrived (67 u, 32% road) | arrived (11 u, 42% road) | arrived (204 u, 57% road) |
| Pickup truck | yes | arrived (162 u, 74% road) | arrived (67 u, 32% road) | arrived (11 u, 42% road) | arrived (202 u, 60% road) |
| Concrete mixer truck | yes | arrived (128 u, 94% road) | arrived (67 u, 32% road) | arrived (11 u, 42% road) | arrived (169 u, 71% road) |
| Mountain bike | yes | arrived (161 u, 78% road) | arrived (67 u, 32% road) | arrived (11 u, 42% road) | arrived (202 u, 62% road) |
| A crawler bulldozer with a six-way blade | yes | arrived (130 u, 88% road) | arrived (67 u, 32% road) | arrived (11 u, 42% road) | arrived (170 u, 67% road) |
| A motor grader with a 14 ft moldboard | yes | arrived (132 u, 86% road) | arrived (67 u, 32% road) | arrived (11 u, 42% road) | arrived (173 u, 65% road) |
| A single-drum vibratory soil compactor | yes | arrived (136 u, 89% road) | arrived (67 u, 32% road) | arrived (11 u, 42% road) | arrived (177 u, 68% road) |
| A tandem vibratory asphalt roller | yes | arrived (139 u, 87% road) | arrived (67 u, 32% road) | arrived (11 u, 42% road) | arrived (180 u, 67% road) |
| A tracked asphalt paver with a heated screed | yes | arrived (143 u, 85% road) | arrived (67 u, 32% road) | arrived (11 u, 42% road) | arrived (183 u, 66% road) |
| Excavator | no (reach limit, by design) | arrived (156 u, 80% road) | arrived (67 u, 32% road) | arrived (11 u, 42% road) | arrived (197 u, 60% road) |

**Why an earlier version of this probe reported failures:**
- **What it did:** vehicles were sped up 6× instead of stretching the timeouts.
- **What went wrong:** the turn rate is capped (2.1 rad/s), so at 6× the turning radius is about 20 units. Leaving the north end of its row by the plant, the tandem roller swung wide into the plant's loading-bay posts and stalled. The same happened on main.
- **At real speed:** the turning radius is about 3.6 units, and every vehicle stays in the clear lane.
- **Fixes tried:** a lane waypoint was tried and reverted, because it changed nothing at real speed.
- **Recommendation:** use real speeds for future route probes.

## Performance (draw calls, swiftshader 1280x800, mean of 3 runs each)
Both sides at the same merge base (main 7539b6b):

| View | Main | This branch | Change |
|---|---|---|---|
| Owner's view | 1,410 | 1,472 | +4.4% |
| Between the buildings | 1,261 | 1,272 | +0.9% |
| Inside the hall | 61 | 62 | +1 |
| From the valley up the pass | 29 | 30 | +1 |

- **Budget:** every north-yard view is within the +5% budget. Single runs vary by ±4%: see logs/perf-repeat.log and logs/perf-main-7539.log.
- **What adds calls:** the road surface is one mesh. The rest comes from the hall and hangar, plus what lies beyond them, being genuinely in view now that the pass is open.

## Regression tests
**Run 3, on the final merge with main at 416ca1e (skins; logs/run3/):**
- **Passed, no page errors:**
  - reload, ui, chat, vehicle, haul, basement
  - navtest: framesUnderGround 0 and framesInsideBuilding 0 on every path
  - navfollow
- **Probes:**
  - Route probe at real speed: 40 of 40 legs arrived (logs/routes-real-speed-416ca1e.json).
  - Ground-in-building probe: 0 samples above the floor in either building.
- **Draw calls:** owner's view 1,377, between the buildings 1,181, inside the hall 62, valley up the pass 30. All inside the range measured above.
- **After shots:** the owner's view, between-buildings and hall-inside-back shots were retaken on this build.
- **Not rerun:** ws hangar and ws garage. Skins change only js/skins.js, js/skinsui.js, kelo-body.js, eyecam.js, agent.js, index.html and css, none of them Workshop code. Both passed in run 2.

**Run 2, on the final merge with main at 7539b6b (logs/run2/):**
- **Passed, no page errors:**
  - reload, ui, chat, vehicle, haul, basement
  - navtest: framesUnderGround 0 and framesInsideBuilding 0 on every path, including "workshop pass"
  - navfollow
  - ws hangar
  - ws garage: tire and oil jobs both completed
- **Probes:**
  - Route probe: 40 of 40 legs, as above.
  - Ground-in-building probe: 0 samples above the floor in either building.

**Run 1, on the earlier merge with main at 019c981 (logs/run1/):**
- **Same results**, except ws garage: its oil job hit the test's own 40-minute limit (slow frames). Its run-2 rerun with a 90-minute limit passed.
- **Matches main:** "vehicle disposed false" in the vehicle scenario also happens on main.
