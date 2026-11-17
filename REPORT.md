# Farm stage 1: land, buildings, grain

Branch: `agent/farm` (merged with origin/main up to 5c4d90c). This branch (`qa-results-farm`) holds only results: this report, the stage screenshots (`shots/`, DSF 2, JPEG) and the test scripts and logs (`qa/farm/`).

Everything below was run, measured or seen in a screenshot. Anything not verified is listed under "Not verified / open items".

## What was built

| File | Contents |
|---|---|
| js/farmdata.js | Registries stage 2 can extend: `FARM_CROPS` (wheat, canola, corn), `FARM_ROTATION`, `FARM_FIELD_USES`, `FARM_ANIMALS` (empty, for stage 2), `FARM_BUILDINGS` with parts lists, `FARM_MACHINES`, `FARM_IMPLEMENTS`, `FARM_OPS`, `FARM_SUPPLIES`. Also `state.farm` (created before the save loads), the ledger, season and weather by day, and the crop simulation (moisture, fertility, weeds, pests, heat-driven growth, stress, yield, dry-down, drying shrink, bins). |
| js/farmland.js | Site survey (east and west candidates, rejected if in town, in water, on the runway reserve, on the workshop site, or off limits), grading to the site's mean level with cut and fill, ditches, fence with gate, farm lane joined to the road, farm pathing, and the 3D ground, wild trees and stones that are cleared. |
| js/farmmodels.js | Original models: row-crop tractor, 4WD tractor, combine with header, grain truck, plough, disc, seed drill with air cart, sprayer, spreader, grain cart, mill. Buildings in stages (foundation, frame, walls, roof, fit): farmhouse, barn, machine shed with workshop corner, 3 grain bins, dryer, fuel tank, farm stand. Instanced crop clumps with growth stages. |
| js/farm.js | The long goal "Build a big mechanized farm" (20 plan steps over 4 stages, registered with `registerGoalTemplate` / `registerGoalAction` from js/goals.js); supply lists through the roadworks/Post Office joblist path; concrete pours that cure; staged building; machines with know-how and fuel; hitching and field passes; harvest, cart, dryer, bins; mill to flour (bread recipe); sales at the stand, on his website, and grain truck haul; diary lines; a Farm panel on the Brain tab. |
| index.html, js/shop.js, js/shopkeeping.js | 4 script tags; Farm panel; website keeps `farmgoods` listings ("From his farm"). |

## Whole cycle in fast time (qa/farm/cycle.js, FAST=6)

The test played the owner: it sent lists, delivered parcels, opened kits and refuelled. Kelo-1 did the rest himself through the goal and agenda.

Build phase, from `qa/farm/cycle-build.log`. Times are test seconds at which each step started.

| Step | s | Step | s |
|---|---|---|---|
| survey | 115 | building list | 4429 |
| clear | 353 | shed | 4434 |
| grade | 1431 | fuel tank | 5531 |
| drain | 2380 | bins | 5872 |
| fence | 3007 | dryer | 6461 |
| lane | 3630 | barn | 6805 |
| | | farmhouse | 7441 |
| | | workshop corner | 7868 |
| | | stand | 8113 |
| | | machines list | 8323 |
| | | inputs list | 8392 |
| | | first season | 8459 |

Season, from `qa/farm/cycle-season.log` and `season-result.json`: plough, disc, fertilize, seed, spray, grow, and harvest of all 3 fields, then dry, store, mill, list on the website, and year 2 starts. No page errors.

| Crop | Harvested | Yield | Moisture at harvest | Stored after dryer |
|---|---|---|---|---|
| Wheat | 1.88 t | 2.41 t/ha | 17.9% | 1.41 t @ 14.5% |
| Canola | 1.09 t | 1.40 t/ha | 11.9% | 1.05 t @ 9% |
| Corn | 4.27 t | 5.48 t/ha | 25% | 3.79 t @ 15.5% |

- Flour milled: 380 kg.
- Website listings: corn 3 t $735, wheat 1 t $310, canola 0.5 t $345, flour bag $24.
- Sale (qa/farm/sell.js): the corn listing sold. He first had to learn the grain truck (the game requires the know-how). He then drove the load down the lane and the diary reads "Delivered a load of grain". Farm earnings came to $851, stand sales included.
- Yields are below the registry figures because the summer was dry. That is the simulation working: drought costs yield.

## Saves and regressions (final run on merged code: qa/farm/finalcheck.log, regress.log)

- Old save: a pre-farm save from main loaded. The farm defaults were present, all 24 diary entries were kept, and the panel showed "not started". The farm goal could be started (20 steps). No errors.
- Mid-farm saves: the season was resumed from snapshots taken during the farm run several times, and each reload continued.
- Goals: the template and action were registered, the goal started, the farm task was created at step 0, no duplicate goal was made, and there were no page errors.
- Harness scenarios reload, ui, chat, vehicle, haul and basement: all reported "page errors: none".
- `npm run build:site` passes: 114 scripts, and the duplicate-name check is clean. It was re-run after merging 5c4d90c, which changed only brain/growth.json.

## Performance (swiftshader, so call and triangle counts matter; frame times do not)

Draw calls, single final run:

| View | main | farm branch |
|---|---|---|
| Town | 833 | 809 |
| Workshop | 382 | 441 |
| North yard | 83 | 74 |

The Workshop view is noisy between runs: 239–382 on main and 318–343 on farm in earlier runs. The farm is hidden beyond 420 units.

Farm views:

| View | Draw calls | Triangles |
|---|---|---|
| Graded land | 13 | 125k |
| Built overview | 64 | 218k |
| Built yard | 307 | 249k |
| Field views with crops | 40–52 | 199–268k |
| Yard after harvest | 66–89 | ~190k |

Field views were up to 657k triangles before I lightened the crop clumps and set a 40-unit near radius. Crops are InstancedMesh with near and mid density by camera distance.

## Screenshots (shots/, DSF 2, each one looked at)

| Stage | Files |
|---|---|
| Land | 01-surveyed-over, 02-cleared-over, 03-graded-over/lane, 04-fenced-over, 05-lane-over/lane |
| Buildings | 06-shed-staked-yard, 07-shed-done-yard, 08-bins-dryer-yard, 09-house-barn-yard, 10-farm-built-over/yard |
| Field work | 11-ploughed-field, 12-disced-field |
| Crops | 14-young-crops ×3, 15-midsummer ×3 plus fields overview, 16-ripe ×3 plus fields overview |
| After harvest and selling | 17-after-harvest fieldsover/stand/yard, sell-yard |

I left out three shots because the camera was wrong: the fertilize shot stayed on town, and the stand and truck sell shots were underground.

## Not verified / open items

- Not tested on a real GPU, laptop or phone. All numbers are from swiftshader.
- In fast mode he drives only every Nth strip of a field. At normal speed he drives every strip, but a full pass at normal speed was not timed.
- The big tractor is only requested in year 2. It was not exercised.
- The lane is its own mesh plus a `farmOnRoad` check, not an entry in KELO_ROADS.
- Concrete is ordered as ready-mix, not batched on his plant. There is no crane or telehandler for building.
- The buyer meets the truck at Yard Street; there is no buyer vehicle.
- The stand sign has no text, and the farm has no minimap pins.
- Some repeated "Waiting on…" diary lines remain.
- Stage 2 (orchard, vegetables, livestock, hay, feed) is not started. `FARM_ANIMALS`, `FARM_FIELD_USES` and `FARM_BUILDINGS` are ready for it, and handoff notes are in `.claude/handoff.md` ("Farm stage 1").
