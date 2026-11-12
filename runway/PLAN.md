# Map layout redesign: plan (agent/runway, after task 7b)

Sketches: `plan-before.png` (today) and `plan-after.png` (proposed), both top-down and labelled, north up. The yellow dashed arrows show what moves.

## What Kelo-1 actually does, and where (from the code)
The life tick runs every 30-55 s (agent.js). His needs tick every 10 s (needs.js).

| Trip | How often | From → to today |
|---|---|---|
| Random roaming, or a random pin | about 60% of open ticks | anywhere in the valley |
| Mail | 0.3 + 0.1 a parcel, each tick | → Post Office door (9.8, 7.1) |
| Reading up / browsing | 0.08-0.2, and before every project | → NetNode door (1.3, 6.4) |
| Putting away new items | after every gift | → Storehouse (7.6, -8.4) |
| Drinking | about every 3 h | → shoreline (4.2, 10.2) |
| Eating | about every 3 h | → garden (-10.3, 5) or Bean & Byte (-16.8, 5.5) |
| Sleeping | nightly | → bed in the house (-9.5, -8.7) |
| Projects | 0.03-0.07 | NetNode → work bench (-3.2, -3) or weld studio (-1.2, -8.2) → build land outside town |
| Tidy-up between basements | every 30 min, once the basements have 2 or more levels | Storehouse ↔ Museum (-40, -5): **48 units** |
| Workshop / print / plant runs | 0.1-0.2 / 0.06-0.2 / 0.035 (0.9 when a load is ready) | → Workshop (53.5, -7) and plant (72, 1.5), usually riding from the vehicle yard (17-32, -6..4) |
| Dig / dispose / haul | 0.05-0.16 / 0.06-0.15 | mountain ↔ Disposal Pit (20, -9) by excavator and dump truck |
| Boat / balloon | 0.1 / 0.06 | dock (2, 11.6) / balloon field (-28.8, 1.6) |
| Big builds | rare, long | hangar bays 1-4, the airfield land (-27, 11.6), the beach (-8.5, 8.3) |
| Garage, runway (future) | rare | garage hall and big hangar in the north yard, field over the pass |

## What is wrong with the layout today
1. **No street.** The north row (house, weld studio, printer, Storehouse; fronts at z ≈ -5.5) faces the **backs** of the shore row (cafe, NetNode, Post Office; backs at z ≈ -2.9) across a 2.6-unit gap. The town's busiest trips (bed, Storehouse, weld/bench ↔ mail, NetNode, cafe) squeeze through that gap or around the buildings. From above it reads as one block.
2. **The work bench stands in that gap** (-3.2, -3), and the campfire ring and the stove spot crowd it too.
3. **The Museum is isolated** 48 units west of the Storehouse, though the basement tidy-up runs between the two.
4. **No roads.** Trucks, the mixer, the pickup and its trailer cross the meadow and pick their way along the plant's pad to reach the Workshop lane and the new pass. Nothing shows where vehicles go.
5. The pass behind the Workshop is a 100-unit-deep slot through the ridge (task 7b). It works, but it is a canyon.

## What changes (everything stays data-driven)
A. **The mountain's foot moves north about 7 units across the town** (x -45 to 14, fading out by x 22, so the hangar, the Workshop and the pit keep their ground). This is a smooth change in `getAnalyticalGroundHeight`: a `VALLEY_FOOT` profile replaces the fixed z -12.

B. **The north row moves north onto the new flat ground (+6.5 units)**, keeping each building's order and facing (fronts stay +z, so interiors, basements and cutaways are untouched):
   - house: (-9.5, -8.7) → (-9.5, -15.2)
   - the maker corner (weld studio, printer and work bench together): weld (-1.2, -8.2) → (-1.2, -14.7). The work bench leaves the street for the corner beside the weld studio, next to the printer.
   - Storehouse: (7.6, -8.4) → (7.6, -14.9)
   - Museum: from the far west (-40, -5) into the west end of the north row at (-22, -15). Storehouse ↔ Museum goes from 48 to about 30 units, and the Museum joins the town.
   - Every literal copy of these positions becomes a reference to its constant: the weld studio in five places, the bed and couch, the printer, camera presets, Places, upgrade anchors, hobby, pastime and paint spots.

C. **Roads** (new data `KELO_ROADS`: polylines with width and surface, drawn as one ground-hugging mesh, on the minimap and Map tab, used by the trip planner as roads):
   - **Main Street**: gravel, about 4.5 units wide, at z ≈ -7.5 from the Museum to the vehicle yard. All north-row fronts and the shore row's backs face it.
   - **Shore Promenade**: a walking path at z ≈ 6.3 past the cafe, NetNode and Post Office doors, the garden and the dock.
   - Two cross lanes, west of the garden and east of the Post Office.
   - **Workshop Road**: from the vehicle yard past the helipad and the hangar apron to the Workshop lane and the plant. It continues as the **haul road** up the east road and through the pass to the north yard, garage hall and big hangar.
   - Paths prefer roads: A* steps on a road cost 0.75, so he and his vehicles use them where it makes sense.

D. **The pass becomes a col**: the ridge is lowered smoothly around x 50-75 from z -20 to -100, so the cut is a gentle valley, not a slot. The north yard, the runway field and its API (`RUNWAY_FIELD`, `onRunwayField`, `onRunwayReserve`, taxiway) are unchanged.

E. **Fitting in**: the wind sock and the campfire ring move off the street. The meadow pin, the balloon field and the airfield land stay. The dock and the boat launch stay: the lake and shore are already usable.

F. **Old saves**: one generic pass on load moves Kelo-1, vehicles, placed items, plantings, edits, holes and piles out of any building footprint, road or pad that is now there (to the nearest door or open ground), the same way the town-scale pass did. Holes and piles keep their positions on the mountain.

## Status: done and pushed (agent/runway 53dbfc9, 9a6a153; final results in REPORT.md)

Earlier status note:
- Built so far in a local worktree, not pushed yet: A (valley foot), B (the north row moved; the Museum joins it), C (roads), D (the col), E (the wind sock, stove, fire ring and garden tap moved off the routes), F (old-save moves).
- One addition from the first route probe: the Post Office moves 1.3 units east, so **NetNode Lane** (2.7 units) opens between it and NetNode. The shore row was an unbroken wall: the gap was 0.9 m, and the welding studio → NetNode walk took 47 units against 20 straight.
- The garden beds moved 0.8 east and the garden tap went behind them, so Garden Lane between the cafe and the garden is passable.

First route probe (A* path length in units, the same probe on both builds):

| Trip | Task 7b | Redesign |
|---|---|---|
| Storehouse → Museum | 76.4 | 31.5 |
| Welding studio → NetNode | 47.4 | 23.8 |
| Post Office → Storehouse | 30.6 | 25.3 |
| Cafe → Museum | 25.1 | 23.1 |
| Storehouse → Disposal Pit | 15.3 | 11.7 |
| Dump truck, yard → Museum | 70.6 (35 s) | 45.2 (23 s) |
| Dump truck, mountain dig (12, -14) → pit | blocked by the trip planner's slope rule | drivable |
| Trucks and bike, yard → garage hall / big hangar | the trip planner said no (it checked a straight line over the ridge) | drivable by the pass (178 / 219 units) |

- The bed → town walks were "partial" on 7b because the bed is inside the house. Now they leave by the front door onto Main Street: bed → garden 20, bed → cafe 25.
- No vehicle route fails in the redesign. The excavator keeps its short-hop rule (26 units) and the snowmobile its snow rule, as before.

## Checks after
- A **trip-route probe** runs his common trips before and after: on foot and for each vehicle type (A* path length, and trip-planner reachability for the dump truck, mixer, pickup with trailer, bike, excavator and snowmobile). It reports distances, estimated times, and any route that fails or is blocked.
- Screenshots: top-down before and after, the town from the default camera, Main Street, the north row, the haul road and pass, and a phone view.
- The full QA suite plus navtest/navfollow, an old-save load, and perf (town view not slower).
