# Open tasks (keep this list current)

Owner's rule: never drop a task. Every time work restarts (new session, a usage-limit reset or a container restart), read this file first.
Update it just before stopping, and whenever a task starts, finishes or changes.

Each helper agent works in its own git worktree at `/home/user/wt/<name>` on branch `agent/<name>`.
- Its unfinished work is committed there as "WIP" snapshots.
- If the worktree is gone, the branch may still exist locally; otherwise redo the task from this description.
- Merge each branch into `main`, run the regression tests (reload, chat, water, gear, haul, skills, printshop), look at the screenshots, then push.

## Done and pushed to main (2026-11-04)
- Task 1 Paintings, task 2 Accurate welding + work bench, task 3 Humanize/eye cam/fluid motion, task 4 Garden, task 6 Code anything + self-upgrades, task 10 phase 1 audit (plan in .claude/review.md).
- Task 11 Talk tab (pushed).
- Task 9 Smarter vehicles (pushed 2026-11-05).
- Task 7 Workshop (pushed 2026-11-05): floors 1 to 3, hangar, north wing, forklift and three-stop elevator. The bigger garage hall and two full-size build bays move to 7b.
- Task 8 Concrete and asphalt plant (pushed 2026-11-05): on `KELO_ADDED_LAND` beside the workshop. Smooth paved road (fixed in landscape.js roadMesh), pale cured concrete.
- Task 5 Build anything (pushed 2026-11-05): BOMs down to the screw, list cards, builds in hangar bays 1 and 2, and the plane flies after training. Name clashes fixed at merge (buildSiteToWorld, buildGuitarModel).
- Plant moved EAST of the workshop (pushed 2026-11-05): WORLD_MAX_X is now 86, `AGGREGATE_PLANT_SITE` x 62.5 to 81.5, and the old site is meadow.
- Task 12 play-through QA done: all 34 harness scenarios clean (landscape test updated for research-first).
- **Owner's order (2026-11-05):**
  1. Task 13 audit phase 2 (`.claude/review.md`) NOW.
  2. Then a full run-through of the game: Kelo-1, his tools, environment, machines and vehicles all work as intended. Fix what's found.
  3. Then 7b (runway field, map growth, bigger garage) and the quality upgrade.
  4. The workshop viewer (`agent/shopview`, paused WIP) is LAST.
- Pushed 2026-11-05:
  - Audit phase 2 (perf: JS 5.83 to 0.94 ms per frame).
  - Movement fixes: box obstacles, robust A*, stuck watch, balloon on open ground, plane circuit over max(ground, water), no digging in buildings, no floating trees.
  - Treehouse rope fix.
- **Run-through in progress (`agent/runthrough`, 11 commits pushed):** paused by the weekly limit on 2026-11-05 and resumed on 2026-11-09. All 6 owner build rules are added; its final test pass is finishing. Then merge it, then 7b runway, then the quality upgrade, then the shopview viewer last.
- **Run-through spec (owner, 2026-11-05)** of Kelo-1, tools, environment, machines and vehicles. Fix what's found. Specific checks:
  - Every shop machine asks for its real supplies, waits, and uses them up.
  - Products land in his inventory as real items he can use for their real purpose.
  - When a build needs a part a machine can make, he makes it in the shop instead of asking.
  - Visitor asks are routed to the right machine or declined.
  - **Owner:** builds and machine jobs must NOT be limited to hard-coded lists. He also takes ideas from the real internet (his NetNode research, with or without an AI key, e.g. Wikipedia and the existing web search): reads about a real thing, works out which machine and materials it needs from what the article says and what his machines can do, then asks for supplies and builds it. Hard-coded plans stay as the fallback and the examples.
  - **Owner:** an internet-sourced build still goes through the parts-list flow (js/bom.js): he writes a real bill of materials (sub-assemblies, exact quantities and specs, fasteners, consumables, tools and machine time) and sends it to the owner as list cards in the Post tab (send all, send some, copy). He builds only with what arrives. Machine-made parts on the list are marked "I'll make this on the <machine>", and those machines' supplies go on the list too.
  - **Owner:** if the WHOLE thing can be made on one of his machines (a CNC router, mill or 3D printer job, e.g. a printed phone stand or a routed sign), there is no parts list to send. He only orders that machine's missing supplies (filament, resin, sheet stock, bar stock, bits, powder, gas, coolant and so on) through the Post Office like any other request, waits for them to arrive, then makes it. Supplies are always ordered and delivered through the Post Office, never assumed. The same goes for ANY of his shops and tools that can make the whole thing or a part: CNC, 3D printers, the electronics line, the glass studio, the woodshop, the garage, welding, the plant, etc. He uses the right one, orders only its missing supplies, and lists only what no shop of his can make.
  - **Owner:** things he builds or prints in the Workshop are real, usable items. A stool is something he sits on; a shelf holds things; a cup holds drinks, and so on. Anything practical goes to his **Storehouse** (with the item-use rules for what it is for), and he takes it out to use it. Only art or abstract pieces go to the **Museum**. **Not hard-coded:** what a thing is for, and how he uses it, also come from what he reads about it on the real internet (NetNode/Wikipedia). For a thing he learned about online, work out its kind and purposes (sit, store, hold drinks, play, ride, etc.) from the article, and register it with the item-use rules, so new kinds of things work without anyone adding them to a list.
- Kelo-1 notices the new Workshop and plant once (`state.placesNoticed`, plants.js), and the AI prompt now describes the workshop layout.
- **This week's plan is done.** Next, after the weekly reset: 7b runway field, map growth and bigger garage, then QA, audit phase 2, and the quality upgrade.
- Task 8 plant: built on agent/plant; sent back to keep Kelo-1 out of the lake beside it, then merge.

## In progress (helpers resumed 2026-11-04 14:20 UTC; if one stops, resume it). Still open: 5 build anything, 7 workshop, 8 plant, 9 vehicles, then 10 phase 2.
1. **Paintings** (`agent/paint`): real oil, acrylic, watercolour, gouache, pastel, ink and charcoal paintings.
   - He researches each medium, then requests its supplies. Supplies are used up.
   - He paints at an easel, the paintings hang in the Museum, and visitors can ask for one.
   - Good originals are sold on the website at about:
     - $35–$120 for watercolour, ink and pastel
     - $60–$180 for acrylic and gouache
     - $90–$350 for oil
   - An original leaves the Museum when it sells.
   - 7 commits so far; it was on shop.js / shop.html.
2. **Accurate welding** (`agent/weld`):
   - The right gas bottle, wire, electrodes and filler.
   - He attaches the gas hose, work clamp and torch lead, opens the valve and sets the regulator.
   - He puts on his welding hood. The arc is visible, and the bead glows and then cools.
   - A separate work bench is used for non-welded builds.
   - It was writing js/welding.js.
3. **Humanize, eye camera, fluid movement** (`agent/body`):
   - Human-like body language.
   - A "Through his eyes" first-person camera.
   - Acceleration, smooth turns, blended animations and a damped camera.
   - It was tuning braking and the follow camera's bob.
4. **Garden** (`agent/garden`):
   - A visible water stream from the watering can, and wet soil.
   - Plants grow in stages only with water and fertilizer. Fertilizer is used up.
   - Plants wilt and recover, and growth catches up offline.
   - It was running its feed test.
5. **Build anything** (`agent/assembly`):
   - Research produces a bill of materials accurate down to the screw, e.g. for an ultralight airplane, a go-kart, a canoe, a shed, a drone, a guitar, a kayak or a tree fort.
   - Parts are requested as one list card, with send-all/some and copy options.
   - He builds sub-assembly by sub-assembly with a progressing 3D model.
   - Then inspection, and he can fly the plane once he has learned to fly.
   - It was writing js/bom.js.
6. **Code anything and self-upgrades** (`agent/upgrades`):
   - No cap on code requests; he asks for anything, paced about one every 20 minutes.
   - Each request is a spec, with copy and GitHub-issue links.
   - He builds safe declarative world upgrades (JSON, never eval), which the owner can view, toggle and remove.
   - It was writing js/upgrades.js.

## In progress (helper running, branch `agent/workshop`)
7. **Big workshop building** (worktree /home/user/wt/workshop).
   OWNER'S LATER REQUIREMENTS (2026-11-04/05), status:
   - DONE: hangar and assembly high bay (`WORKSHOP_HANGAR`, `workshopAssemblyBay()`, painted ultralight footprint, 20 t crane, 18.4 x 8 door); wider car elevator, door 1 and two-post lift; `workshopFits` + `sizes` test; floor 3 with stairs and a three-stop car elevator (landing gates, call buttons, floor selector, `wsVehicleTour`); glass blowing studio (js/glassstudio.js) and woodshop (js/woodshop.js); electric forklift with charger and pallet racking (js/forklift.js); router, Haas, tire changer and pick-and-place accuracy passes; plain job titles; stand spots checked. North wing CNC hall (`WS_WING`: Haas mills, pallet racking, forklift charger, east-west forklift aisle); drive-through hangar door -> wing -> door 4 -> east aisle over the car elevator -> door 1, pickup with a towed trailer (`wsDriveThrough`); hangar laid out from `WORKSHOP_HANGAR_BAYS` (build bays 1 and 2, two parking bays, the lane); multi-item `workshopFits([...])`; woodshop as the main path for wooden project builds; forklift trips via the car elevator and back to its charger; tire changer rebuilt (rim-clamp turntable, tilt-back column, bead breaker); Haas door windows, coolant streams and chips.
   - LEFT for 7b (needs the map to grow; the north edge z -22.9 is the only free land): a full 4+ bay garage hall with a straight drive-through for the pickup + trailer, the dump truck and the mixer truck (too tall for door 1 and the car elevator today), and a hangar with room for two full-size builds plus 2-3 parked vehicles. Bays are data (`WORKSHOP_HANGAR_BAYS`, `WS_WING`); see the handoff for what moves. `RUNWAY_FIELD` is task 7b.
   DONE SO FAR: PROGRESS: building + car elevator (js/workshopbuilding.js), models (js/machinemodels.js), machine framework (js/machines.js), printers (js/additive.js), CNC (js/cnc.js), electronics (js/electronics.js), garage + vehicle wear (js/garage.js) are written, wired in and tested job by job; final screenshot and regression passes in progress. `WORKSHOP_SITE = { x: 53.5, z: -7.1, w: 16, d: 15 }` (north of the plant's pad), `WORKSHOP_LAND` for the land it adds. The original brief: to the RIGHT of the helipad (AIR_SLOTS around x 38.5, z -2, in js/vehicles.js). Floor 1 is the main fabrication shop, holding all his 3D printers, work benches, welding and CNC machines. Each machine has full functionality and real requirements:
   - **3D printers**, every type: FDM/FFF, SLA, DLP, MSLA/LCD, SLS, DMLS/SLM, MJF, PolyJet material jetting, binder jetting, DED, EBM and LOM. Each has its real materials (filament, resin, nylon powder, metal powder, binder, wire feedstock, paper or laminate), post-processing (washing and UV curing for resin, depowdering, sintering, heat treating, support removal) and safety needs (gloves, ventilation, inert gas).
   - **CNC machines**:
     - Avid CNC PRO4896 / PRO60120: large-format modular routers for wood and plastics.
     - Sienci AltMill 4x8: a 4x8 production router.
     - ShopSaber IS 510: a heavy-duty steel-welded sheet router.
     - Laguna SmartShop: an industrial router for cabinets and signs.
     - Haas VS-1 / VS-3: large vertical machining centres for metal.
     - Waldrich Coburg Taurus: a giant gantry mill for marine and aerospace parts.
     Each needs its real tooling (bits and end mills), stock, workholding (clamps, vacuum table, vise or fixtures), dust collection or coolant, CAM/G-code, and power.
   - Things he makes in the workshop are usable for their intended purpose.
   - **Floor 2**, reached by a CAR ELEVATOR, has two areas:
     - **Computer manufacturing and electronics workshop**:
       - pick-and-place machine
       - reflow oven
       - wave soldering
       - PCB CNC mill
       - solder paste printer
       - laser marker/cutter
       - FDM and SLA printers for enclosures
       - AOI inspection machine
     - **Car garage and automotive workshop**:
       - two-post and four-post lifts
       - tire changer
       - wheel balancer
       - brake lathe
       - engine hoist
       - hydraulic shop press
       - MIG/TIG welder
       - air compressor system
       - CNC plasma cutter
       - parts washer

   - **Owner (2026-11-04):** the workshop must be big enough for his projects (the airplane being built) and vehicles (pickup and trailer, dump truck, mixer truck, cars on the lifts) to fit inside, with doors, bays and the car elevator sized to match. Every 3D printer, CNC machine and floor-2 machine must be visually, mechanically and functionally accurate: real layouts, motion that moves the right way during a job, real steps, materials and post-processing. Assembly builds move into the workshop's assembly bay (`workshopAssemblyBay`).

   - **Owner (2026-11-05):**
     - **Space:** a ton of space. The CNC shop must fit several big jobs at once with forklift aisles. The garage needs 4+ vehicle bays, including a drive-through bay for the pickup and trailer. The hangar needs room for 2+ builds plus vehicle parking.
     - **New FLOOR 3:**
       - **Glass blowing studio:** furnace with crucible, glory hole, annealer, marver, bench, blowpipes and punties, jacks, shears, blocks, frit and colour, fume hood, safety gear and gas. The real gather → blow → reheat → shape → punty → anneal process, with supplies used up.
       - **Woodworking shop:** table saw, jointer, planer, bandsaw, drill press, router table, mitre saw, lathe, sanders, dust collection, benches, clamps, hand tools, finishing booth and a lumber rack. Real milling, joinery, glue-up, sanding and finishing, with supplies used up. It becomes the main path, ahead of the outdoor `WORK_BENCH`.
     - **Large site:** a big yard and aprons around the building.
     - **Runway field:** moved to its own task, 7b, after the workshop merge (2,000 m). Exposed as `RUNWAY_FIELD`, `developed: false`. It is reserved: off limits except for future runway jobs. The map size may grow if needed (owner): extend from the WORLD_* constants, keep existing content in place, keep old saves working and check frame time. He develops it later (clear, grade, compact, base, asphalt from his plant, markings, lights).
     - **Car elevator:** serves every level (1, 2 and 3), with landing doors and call buttons on each floor.
     - **Electric forklift with charging station:** the battery drains and he recharges it. It has pallets and racking, uses the car elevator between floors, follows the vehicle and one-of-each rules, and needs training know-how first.

8. **Concrete and asphalt plant** (`agent/plant`, started), right beside the workshop. It positions itself from `WORKSHOP_SITE`.
   - **Ready-mix concrete batch plant:**
     - cement silos, aggregate bins, a weigh hopper, conveyor, water and admixture tanks, a twin-shaft mixer and a load-out
     - a concrete mixer truck he can drive
   - **Hot-mix asphalt plant:**
     - cold feed bins, a drum dryer with a burner, a baghouse and stack, a heated bitumen tank, a pugmill and a hot silo
   - He researches each plant, requests materials, and uses them up.
   - His own asphalt can be used for paving, and it is wasted if it cools.
   - Concrete is used to pour pads, paths and foundations, and it cures over days.
   - Status: done and tested on the merged main (with the Workshop): plantflow, reload, chat, haul pass with no page errors. The plant sits west of the Workshop's lane on added land (`KELO_ADDED_LAND`) with a dry walkway; roads are a continuous ribbon; cured concrete is pale with forms off.

9. **Smarter vehicles** (`agent/vehicles`, started 2026-11-03):
   - Fix the refuel loop (he fills the snowmobile again and again and the tank stays empty), for every fuel type.
   - Terrain rules per vehicle (snowmobile on snow only, boats on water, bikes on roads/gentle ground, trucks off deep snow and steep slopes unless chained, excavator short hops, helicopter anywhere with fuel and a landing spot, balloon by the wind) and fuel range.
   - A trip planner (`js/trips.js`): picks vehicles per leg, plans truck + trailer transport for ones that can't get there by themselves, checks fuel, know-how and gear (straps, trailer, hitch), explains once and requests exactly what is missing. He researches at NetNode first ("how to transport a snowmobile").
   - Trailers (snowmobile trailer, boat trailer, lowboy) with models that hitch behind the truck; loading, strapping, hauling and unloading are visible.
   - Everything is still requested. AI prompt lists his vehicles and a `takeTrip` decision field; the Brain/World tab gets a "His vehicles" list.
   - One of each vehicle kind (trailers included) until he has a friend or pet (`friend`/`pet` unlocked), then two. Owned + open requests + mailbox count; owner gifts always accepted.
   - Status: done on `agent/vehicles`, origin/main merged in (js/trips.js plus small hooks in vehicles.js, knowhow.js, itemuse.js, skills.js, agent.js, index.html, and a frame-rate fix in motion.js). Refuel loop root cause: AI-named fuel ("Gasoline for the snowmobile") was classed as a vehicle (0 uses, a phantom vehicle with an empty tank), and every empty can asked for another. Ready to merge into `main`.

10. **Performance, game quality, bug hunt and clean code** (`agent/review`, started):
    - **Phase 1, now:** measure, find and verify bugs, perf hotspots and cleanup items, and write `.claude/review.md` (tiny safe fixes only).
    - **Phase 2, after tasks 1-9 are merged:** apply the plan across the merged code, re-profile, and fix new bugs from the merges.

11. **Talk tab redesign** (`agent/talk`, started): "Clean up and improve the Talk tab of my interaction with him."
    - A clean chat thread: his and your bubbles with avatars, world day/time separators, a "Kelo-1 is thinking…" indicator, auto-scroll with "Jump to latest", NetNode lookups as inline cards, and status chips (queued → doing → done) for things he does because you asked.
    - One composer: multiline (Enter sends, Shift+Enter new line), send button, a "+" menu with Attach photo and Send a gift/tool/toy, character count, disabled and sending states.
    - Suggested reply chips that fit his context (the helicopter one only if he has one); your name saved on the device and edited in one place; an empty state for a fresh Kelo-1; "Load earlier" within MAX_CHAT_LOG.
    - Accessible (labels, focus, aria-live), re-render only on change, escapeHtml everywhere, no inline handlers (CSP).
    - New code in `js/talk.js` (after portal.js). Status: done on `agent/talk`, ready to merge. Talk tests pass on desktop (1024x720) and phone (390x844): empty state, saved name, Enter/Shift+Enter, thinking indicator, lookup cards, helicopter chip queued → doing → done (and no chip without one), photo and gift from +, load earlier, jump to latest, reload. Regressions reload, chat and skills: page errors none. Harness note: on a loaded machine use DOM clicks (`el.click()`) rather than `page.click`.

## Usage budget (2026-11-05): the owner is at 76% of weekly usage
- This week: merge the workshop, then finish the concrete and asphalt plant (task 8), then build anything (task 5). Both are nearly done.
- After the weekly reset: 7b runway field, map growth and the bigger garage, then the full play-through QA, audit phase 2, and the quality upgrade.
- Keep helper runs lean: one helper at a time, a final test pass only, and few re-shoots.

## Order of work (owner, 2026-11-05): one task at a time, in this order, to keep merge conflicts to a minimum
1. Task 7 workshop (only helper running). It exposes `WORKSHOP_SITE`, its land constant and `workshopAssemblyBay()`. Merge as soon as it is done.
1b. **Task 7b: runway field and map growth** (owner, 2026-11-05). This comes after the workshop merge. A 2,000 m undeveloped field (about 3,200 units at 1.6 units per metre, plus a cleared strip) behind the workshop, exposed as `RUNWAY_FIELD` with `developed: false`, off limits except for runway jobs. Grow the map from the WORLD_* constants: keep content in place, use a coarse far-field terrain or LOD, update A* and the minimap and Map tab, keep old saves working, and measure frame time. **Then expand the workshop on the new land:** a full 4+ bay garage hall (drive-through bay for the pickup and trailer, room for the dump and mixer trucks) and room for two full-size builds. The current site (x 24 to 62, z -22.9 to -6.8) is full, so these could not fit before.
2. Task 8 plant: resume `agent/plant`, rebase onto main after the workshop merge, join its site and land to the workshop's, then finish the road and concrete fixes.
3. Task 5 build anything: resume `agent/assembly`, rebase, move the build into `workshopAssemblyBay()`, then finish the label, site, grammar and flight-shot fixes.
4. Task 12 full play-through QA, done directly on main.
5. Task 13 audit phase 2 (from `.claude/review.md`), directly on main.
6. Task 14 quality upgrade, no new features.
Each step merges, passes the regression tests and is pushed before the next starts.

## Final steps (owner, 2026-11-04), in this order, after tasks 5, 7, 8 and 9 are merged
12. **Full play-through QA.** Run through the entire game and make sure everything works as intended and smoothly, without bugs:
    - every tab and panel
    - every building, including the workshop on both floors, the plant, the Museum and the Storehouse
    - every vehicle and trip
    - every hobby and skill: paintings, welding, garden, builds and upgrades
    - requests, the Post tab, the shop website, reload and offline catch-up
    - phone and desktop layouts
    Fix what is found.
13. **Task 10 phase 2:** apply the `.claude/review.md` plan across the merged code, re-profile and fix new bugs.
14. **Quality upgrade, no new features** (owner, 2026-11-04; after 12 and 13): raise every existing aspect to the polish level of a modern commercial farming and vehicle simulator (the owner's reference: Farming Simulator 25/26). Use it as a quality bar only: no copying its assets, models, UI or look.
    - Rendering: lighting, shadows, terrain texturing and blending, vegetation, water, sky and weather, post-processing.
    - Models: vehicles, machines, buildings, Kelo-1 and items, with detail, proper materials and scale.
    - Animation: vehicles and machines with suspension, wheels, hydraulics and moving parts, plus Kelo-1's motion.
    - Camera feel, audio polish, UI/HUD clarity and consistency, transitions, loading.
    - Steady frame rate on desktop and phone, with quality presets.
    - Polish and fix only what already exists. Add nothing new.

## Owner notes to keep in mind
- Owner (2026-11-04): helpers may add as much land as needed for machines, workshops and plants (natural shoreline, walkable, clear of town, one shared land constant/helper). Kelo-1 must never end up standing in water.
- Commits are authored as jeremiahaguirre <46036250+jeremiahaguirre@users.noreply.github.com>, with no AI attribution. Never commit API keys. Don't push tags or releases.
- "He can build anything", he can ask for lists of things, and code upgrades to his world.
- The shop sells only 3D print files plus his original paintings (once task 1 is merged).
- The 4 logo-bearing glTF models (car, sunglasses, candle holder, camera) are still waiting on the owner's decision.
