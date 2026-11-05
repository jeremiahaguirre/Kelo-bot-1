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
   - DONE: hangar and assembly high bay (`WORKSHOP_HANGAR`, `workshopAssemblyBay()`, painted ultralight footprint, 20 t crane, 18.4 x 8 door); wider car elevator, door 1 and two-post lift; `workshopFits` + `sizes` test; floor 3 with stairs and a three-stop car elevator (landing gates, call buttons, floor selector, `wsVehicleTour`); glass blowing studio (js/glassstudio.js) and woodshop (js/woodshop.js); electric forklift with charger and pallet racking (js/forklift.js); router, Haas, tire changer and pick-and-place accuracy passes; plain job titles; stand spots checked.
   - LEFT (big): (1) a much bigger building and site: CNC shop with forklift aisles, a floor-2 garage with at least 4 bays incl. a drive-through bay for a pickup + trailer and room for the dump and mixer trucks, a hangar for two builds plus 2-3 parked vehicles, open aprons; `workshopFits` for several items at once. (2) `RUNWAY_FIELD`: a full-size field (2,500 m x 45 m = 4,000 x 72 units at the game's 1.6 units per metre, plus a cleared strip) behind the Workshop, off limits except for runway jobs; this needs the map grown from 120 x 54 units to over 4,000 wide, with a coarse far-field terrain/LOD, A* and minimap changes, measured frame times, and a Map tab shot. (3) The woodshop as the main path for project builds (js/projects.js still builds at WORK_BENCH outdoors). (4) Forklift trips between the hangar and floors via the lane and the car elevator as one job; driving it out to the yard.
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

8. **Concrete and asphalt plant** (`agent/plant`, started), right beside the workshop. It positions itself from `WORKSHOP_SITE`.
   - **Ready-mix concrete batch plant:**
     - cement silos, aggregate bins, a weigh hopper, conveyor, water and admixture tanks, a twin-shaft mixer and a load-out
     - a concrete mixer truck he can drive
   - **Hot-mix asphalt plant:**
     - cold feed bins, a drum dryer with a burner, a baghouse and stack, a heated bitumen tank, a pugmill and a hot silo
   - He researches each plant, requests materials, and uses them up.
   - His own asphalt can be used for paving, and it is wasted if it cools.
   - Concrete is used to pour pads, paths and foundations, and it cures over days.

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

## Order of work (owner, 2026-11-05): one task at a time, in this order, to keep merge conflicts to a minimum
1. Task 7 workshop (only helper running). It exposes `WORKSHOP_SITE`, its land constant and `workshopAssemblyBay()`.
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
