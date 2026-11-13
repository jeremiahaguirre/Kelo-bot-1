# North yard fixes: owner's three arrows

Branch `agent/northyard` (merged with origin/main at 7539b6b). Screenshots are in `shots/` (before = main at 1eed4fe, after = this branch), taken at deviceScaleFactor 2 and noon from the same camera positions. QA scripts are in `qa/ny/`.

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
Each land vehicle drives four legs, from its valley slot:
1. Hall: the garage hall's bay-1 door, on Yard Street.
2. Hangar: the big hangar's apron.
3. Taxiway: its east edge.
4. Home: back to its slot.

**How it was run:** speeds are scaled 6× so each leg fits `driveVehicle`'s 90 s timeout under swiftshader, and a leg counts as arrived when it ends within 3.5 units of the target. No position sample on any leg was inside a building footprint. The "on road" share is from the A* path.

| Vehicle | Planner (`canDriveThere`) | Hall | Hangar | Taxiway | Home |
|---|---|---|---|---|---|
| Dump truck | yes | arrived (162 u, 77% on road) | arrived (67 u, 32% on road) | arrived (11 u, 42% on road) | arrived (204 u, 57% on road) |
| Pickup truck | yes | arrived (162 u, 74% on road) | arrived (67 u, 32% on road) | arrived (11 u, 42% on road) | arrived (202 u, 60% on road) |
| Concrete mixer truck | yes | arrived (128 u, 94% on road) | arrived (67 u, 32% on road) | arrived (11 u, 42% on road) | arrived (169 u, 71% on road) |
| Mountain bike | yes | arrived (161 u, 78% on road) | arrived (67 u, 32% on road) | arrived (11 u, 42% on road) | arrived (202 u, 62% on road) |
| A crawler bulldozer with a six-way blade | yes | arrived (130 u, 88% on road) | arrived (67 u, 32% on road) | arrived (11 u, 42% on road) | arrived (170 u, 67% on road) |
| A motor grader with a 14 ft moldboard | yes | arrived (132 u, 86% on road) | arrived (67 u, 32% on road) | arrived (11 u, 42% on road) | arrived (173 u, 65% on road) |
| A single-drum vibratory soil compactor | yes | arrived (136 u, 89% on road) | arrived (67 u, 32% on road) | arrived (11 u, 42% on road) | arrived (177 u, 68% on road) |
| A tandem vibratory asphalt roller | yes | **stopped** (139 u, 87% on road) | arrived (67 u, 32% on road) | arrived (11 u, 42% on road) | arrived (180 u, 67% on road) |
| A tracked asphalt paver with a heated screed | yes | arrived (143 u, 85% on road) | arrived (67 u, 32% on road) | arrived (11 u, 42% on road) | arrived (183 u, 66% on road) |
| Excavator | no (reach limit, by design) | arrived (156 u, 80% on road) | arrived (67 u, 32% on road) | arrived (11 u, 42% on road) | arrived (197 u, 60% on road) |

**The roller's stopped leg:** it said "coughed and stopped. Out of diesel" — a test-setup gap, not a route problem. The probe fuelled each machine only once; it now refuels before every leg, and the roller completes all four legs when run alone. Earlier, a bike leg also fell short once with ten vehicles crowding the valley yard, and passed on a rerun.

## Performance (draw calls, swiftshader 1280x800)
Comparison against main at 1eed4fe:

| View | Main (1eed4fe) | This branch |
|---|---|---|
| Owner's view | 1,484 | 1,465 |
| Between the buildings | 1,276 | 1,246 |
| Inside the hall | 61 | 62 |
| From the valley up the pass | 28 | 30 |

- **North yard views:** within +5%. The road surface is one mesh.
- **Valley view up the pass:** +2 calls. The hall and hangar far boxes now count as in sight because the pass really is open.
- **Merged build:** the run after merging main's perf work reads 1,371 / 1,183 / 62 / 29. A baseline on current main is still to run.

## Regression tests
**Run 1 (merged with main at 019c981), all with no page errors:**
- **Passed:**
  - reload, ui, chat, vehicle, haul, basement
  - navtest (framesUnderGround 0, framesInsideBuilding 0 on every path, including "workshop pass")
  - navfollow
  - ws hangar
- **Matches main:** "vehicle disposed false" also happens on main.
- **ws garage:** the tire job completed. The oil job was cut off by the test's own 40-minute limit (slow frames), not by a failure. Its rerun has a 90-minute limit.

**Run 2 (merged with main at 7539b6b):** in progress when this report was pushed. It will be updated with its results.
