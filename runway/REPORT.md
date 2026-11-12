# Task 7b: runway field, map growth, bigger Workshop (branch `agent/runway`)

The screenshots in this folder were taken at deviceScaleFactor 2. `before-*` shots are from `main`, `after-*` shots from `agent/runway` at commit c92b684.

## Update: map layout redesign, merges, final QA (agent/runway at a118573)

### Commits since the first report
- `53dbfc9` Map layout redesign (see `PLAN.md`): the mountain's foot moves back behind the town; the ridge over the pass becomes a col; the north row (Museum, house, welding studio, printer and work bench, Storehouse) moves onto the new level ground facing Main Street; roads and paths are data (`KELO_ROADS`, js/roads.js), drawn into the ground, kept clear, shown on the maps and preferred by A*; the Post Office moves 1.3 east for NetNode Lane; old saves move out of the new footprints.
- `9a6a153` Gentler pass sides and mouth, a wider col, softer shoulders, so the explore camera rises over them smoothly.
- `344caff`, `cfa6d53` Workshop viewer: the garage hall and big hangar are areas you can walk round (walkable rects, obstacles, start spots, see-through roofs).
- `23667a1`, `0ecce71`, `a118573` Merges of `main`: Workshop viewer and HUD; design system, agenda and roadworks with the runway job; then the world chunks, the fixed-step simulation and the runway-number fix (35/17).
- In the merges:
  - **Road machines park off the haul road.** The plant's west yard strip is now the haul road's first leg, the only way over the range. So `rwParkingSlots` parks the dozer, grader, rollers and paver in a row along the plant's east side, at x 83.1 and z -4..11.5. At edge + 1.0 they clipped the plant's hopper, so the row sits at edge + 1.6.
  - **Old saves.** `reparkOldVehicles` moves any land vehicle saved on the haul road to its slot.
  - **The Workshop's scripted moves use the frame clock.** The north buildings' drives, turns and lift go through `keloTween`.

### Route probe (A* path length in units; 7b = before the redesign, final = a118573)
Raw data: `routes-7b.json`, `routes-final.json`.

| Trip on foot | 7b | final |
|---|---|---|
| Storehouse → Museum | 76.4 | 31.5 |
| Welding studio → NetNode | 47.4 | 23.6 |
| Post Office → Storehouse | 30.6 | 25.0 |
| Cafe → Museum | 25.1 | 23.2 |
| Storehouse → Disposal Pit | 15.3 | 11.7 |
| Work bench → NetNode | no path (bench stood in the gap) | 21.7 |
| Bed → anywhere (post, cafe, garden, shore, Storehouse, meadow) | partial (inside the house) | complete, out of the front door onto Main Street (24-37) |

| By vehicle | 7b | final |
|---|---|---|
| Dump truck / pickup / mixer / bike, yard → Museum | 70.6 | 45.4 |
| Dump truck, pickup and bike: mountain dig (12, -14) → pit | refused by the trip planner (slope) | drivable |
| Dump truck, pickup and bike: yard → garage hall / big hangar apron | refused (straight line over the ridge) | drivable through the pass (177.6 / 219.3) |
| Excavator | short hops only (by design) | unchanged |
| Snowmobile | snow only (by design) | unchanged |

No vehicle route that worked before fails now.

### Perf on the final branch (swiftshader, 1280x800, 6 s average; calls and triangles are exact)
| View | main (first report) | 7b | final, with chunks |
|---|---|---|---|
| Town (default camera) | 1109-1152 calls, 232k tris | 1105 calls, 234k tris | 846 calls, 219k tris |
| North yard | n/a | 105 calls, 167k tris | 119 calls, 170k tris |
| Workshop looking up the pass | n/a | n/a | 72 calls, 170k tris |

The town view is cheaper than `main` was.

### Old save
The `main` save described above loads on the final branch with every vehicle on its saved x, z and heading (truck, excavator, bike, both aircraft, pickup). There were no page errors.

### Final tests (one at a time, KELO_ROOT = agent/runway at a118573)
Every run below exited 0 with "page errors: none".

| Script | Runs (seconds) |
|---|---|
| harness.js | reload 77, chat 334, ui 141, water 242, vehicle 59, snow 175, basement 132, haul 428, planitems 448, landfill 257 |
| ws.js | garage 2537, forklift 1265, hangar 156 |
| navtest.js | 36 |
| navfollow.js | 38 |
| itest.js | paths 41, netnode 278, cafe 229, post 285 |
| visit.js (`NORTH_AREAS=1`) | 79 targets, 0 missing |

Notes:
- **ws.js garage:** the first run passed the tyre job but was killed by my 2400 s wrapper during the oil change. Swiftshader is slow here, and the same test took 2044 s before the merges. Rerun with a 5000 s limit: the tyres and oil both finished, result `true`.
- **visit.js:** all 7 areas, including "Garage hall (north yard)" and "Big hangar (north yard)". Stairs and elevator worked, and the view restored on exit.
- **navtest:** 6 camera paths with 0 frames under ground and 0 inside buildings. The max jerk of 6.7 is on "low over hills": the camera lifts over the new col shoulder by design. It was the same before the engine merge.
- **forklift:** the "carrying" screenshot is still missed (`never saw carrying`), as in the first report. The job and the charging ran.
- **basement:** the put-away note in its log is not new; the same note appears on `main`.

### Screenshots (deviceScaleFactor 2, JPEG)
`redesign-before-*` is the build before the redesign (6678473); `redesign-after-*` is the final branch.
- **Views:** `town-top` (straight down on the town), `default` (the start camera), `mainstreet`, `northrow`, `garden`, `pass` (the col from above the plant), `haul` (Workshop, plant and the haul road into the pass), `whole` (the valley and the range from over the lake).
- **Clouds** are hidden for these shots only.
- **HUD:** the HUD looks different in the after shots because `main`'s design system came in with the merge.

## First report (task 7b, before the redesign)

## Commits (agent/runway)
- `4a6ee2b` Runway field, north land and bigger world: RUNWAY_FIELD, the Workshop's pass, east road and north yard, a 1.5-unit north patch and coarse far lands, the A* coarse layer, trip grid, explore bounds, minimap sheets, flight and parking checks.
- `cdee58b` Bigger Workshop in the north yard: the four-bay garage hall and the big hangar; garage trips and build-bay choice wired in; paths cross the range by the pass.
- `5e0779a` North yard cost: far boxes, sight-line hiding, insides only close up, coarser far lands.
- `c92b684` Handoff and tasks.
- `6678473` A*: the grid's cells stay on the old lattice. Growing the grid north had shifted them by 2/3 of a cell, so a walk to the Workshop from beside the garden failed with "no-path" and he stopped mid-way. The QA screenshots showed his "I can't find a way through there" line. Found by a 2-minute watch of his own life: before the fix he hit no-path repeatedly, after it 0 times; `main` 0 times.

## Layout (world units, 1.6 units = 1 m; x east, z south)
| Thing | Where |
|---|---|
| `RUNWAY_FIELD` | x -110..130, z -3372..-172 (3,200 x 240 units = 2,000 x 150 m), heading north-south, centre line x 10, `developed: false`, `y` 0.05 |
| Taxiway (reserved) | x 14..50, z -172..-150, from the big hangar's apron onto the field |
| East road | x 62.6..68.4, z -26..-8 (from the plant pad's north-west corner) |
| Pass | x 51..73, z -101..-23.6 (a cut through the range behind the Workshop) |
| North yard | x 0..118, z -173..-100 |
| Garage hall | centre (90, -127), 32 x 26, eave 9.6. Four bays with doors south: g1 drive-through (back door north), g2 service pit, g3 heavy column lift (4 x 7.5 t), g4 wash |
| Big hangar | centre (34, -128), 56 x 32, eave 12.5. Door 50 x 10 facing north onto the apron and taxiway. Build bays 3 and 4 (22 x 16 each), parking 3-5 (12 x 5.6), 20 t crane |

Helpers:
- **Field and taxiway:** `onRunwayField`, `onRunwayReserve`, `runwayFieldPoint`, `runwayKeepOff`.
- **Runway jobs:** `runwayJobActive` (js/landscape.js) is the switch a runway job sets to work the reserved land.
- **Bays:** `garageHallBays()`, `northHangarBays()`, `workshopAssemblyBay(3|4)`, plus `workshopFits()` with its new fields.
- Everything is documented in `.claude/handoff.md` under "On branch agent/runway".

## How the map grew, and what is coarse
- **World bounds:** `WORLD_MIN_Z` -44 → -172 (x stays -60..86). `WORLD_EXTENT` is the whole world including the field; the explore camera and the Map use it. Random picks, creations, digs, upgrades and landscaping stay in the valley (`WORLD_VALLEY_MIN_Z` -44).
- **Island mesh:** unchanged (0.6-unit cells). `ISLAND_MIN_X/MAX_X` are now fixed numbers.
- **North patch:** the pass and the yard, 1.5-unit cells, about 7.7k vertices. It is hidden whenever the range blocks every sight line to the yard.
- **Far lands:** the field and the hills either side of it, out to x ±620 and z -3440, on a coarse grid. Lines are 60 units apart, closing to 6 units only where the field's edges blend into the hills, on the outer lands' seams, and along the coast. About 2.5k vertices.
- **Old outer lands:** unchanged; they sink under the patch. The sea was widened to the far lands.
- **Ground heights:** `getAnalyticalGroundHeight` now returns the drawn backdrop shape north of the island and east and west of it, so flights, the camera and walking stand on what is drawn.
- **Fog and sky:** unchanged. The haze closes in about 500 units out and the sky dome follows the camera, so the far end of the field is never an edge.
- **A\* grid:** about 50k cells of 0.75 units, buffers reused between searches. Past it (the field) is the coarse layer: straight legs to and from the grid's edge, since nothing is built there. `pathPassRoute` sends any trip between the valley and the north up the east road and through the pass, because A* sees obstacles, not slopes. `TRIP_GRID` covers z -172..12.
- **Minimap and Map tab:**
  - Two sheets. The corner map switches to the north sheet when the camera looks past z -60: the field, mown and labelled, its taxiway, the pass, the yard and both buildings.
  - The valley sheet is unchanged, so the town stays readable, plus a pointer at the pass.
  - The Map tab has a button for each sheet.
- **Flight and parking:**
  - Helicopter and balloon landings fall back to open ground in the valley, never the yard or the field.
  - Nothing parks on the field or the taxiway.
  - Planes, helicopters and the camera use the drawn ground beyond the island.

## Old saves
- An old save exported from `main` (vehicles in the yard, at the helipad and on the balloon field, Kelo-1 in the south meadow) loads on `agent/runway` with every vehicle at exactly the same x, z and heading.
- Kelo-1 drifts about 3 units in the first seconds after loading. `main` shows the same drift, because he simply starts walking.
- Nothing that existed before moved. The only new restriction is `offLimits` on the field and taxiway.

## Perf
Measured in swiftshader with no GPU, 1280x800, a 6 s average. The frame times are noisy on this machine; the draw calls and triangles are exact.

| View | main | agent/runway |
|---|---|---|
| Town (default lake-side camera) | 1109-1152 calls, 232k tris | 1105 calls, 234k tris |
| Workshop | 310-322 calls, 166k tris | 316 calls, 181k tris (the north patch shows through the pass) |
| North yard (new) | n/a | 105 calls, 167k tris |
| Inside the garage hall (new) | n/a | 90 calls, 85k tris |

What keeps the new buildings cheap:
- Each building is a 2-call box past 110 units.
- Its shell is drawn only while some sight line reaches it.
- Labels and equipment show only close up, joined per material.
- The wall facing the camera has its own material, so it can fade while he is inside.

## Tests
Run one at a time on `agent/runway` (KELO_ROOT = the branch). Every one exited 0 with "page errors: none":
- **harness.js:** reload (68 s), chat, ui, water, vehicle, snow, basement, haul (654 s), landfill (2115 s), planitems.
- **ws.js:** garage (2044 s; tires and oil through the car elevator still work), forklift (1324 s), hangar.
- **navtest.js:** 6 camera paths, including "workshop pass", with 0 frames under ground and 0 inside buildings.
- **navfollow.js:** 1309 frames, max jerk 5.0.

Notes:
- forklift: the "carrying" screenshot was missed (`never saw carrying`). The run still finished: the pallet job and charging went through, with no page errors.
- The first batch hit the 2-hour background limit during forklift, so forklift, hangar, navtest and navfollow were run again.

Extra checks:
- **Mixer truck in the garage hall:** the full job ran (drive in, column lifts, three tyre steps, lower, reverse out, drive home), result `true`, with tires reset to 0.
- **Route from the valley to the hall:** A* goes through the pass.

## Screenshots (deviceScaleFactor 2, JPEG)
- **Whole map:** `before-map-top` (main) and `after-map-top`; `after-map-north` (the north land from high up); `after-field-far` (the field running north into the haze).
- **The field:** `after-field-from-workshop` (over the Workshop through the pass) and `after-field-from-hangar` (from the big hangar's apron).
- **North yard:** `after-yard`.
- **Garage hall:** `after-hall-out` and `after-hall-in` (pickup in the drive-through bay, dump truck at the pit, mixer on the column lifts).
- **Big hangar:** `after-hangar-out` and `after-hangar-in` (excavator and a second pickup in parking).
- **Maps:** `after-minimap-north`, `after-maptab-valley`, `after-maptab-north`.
- **Phone (390x844):** `after-phone` and `after-phone-yard`.

## Left / notes
- The runway itself is not built (by design). The `agent/agenda` session is writing the runway job against `RUNWAY_FIELD` and `runwayJobActive`.
- In winter the north patch keeps the outer lands' colours: snow only on the peaks, as the backdrop does today.
- The airplane keeps build bay 1, because its flights start at the first hangar's door. Bays 3 and 4 take other big builds, such as boats, when bay 2 is too small or taken.
- The map layout redesign (owner, later) continues on this branch. See `PLAN.md`.
