# Open tasks (keep this list current)

Owner's rule: never drop a task. Every time work restarts (new session, a usage-limit reset or a container restart), read this file first.
Update it just before stopping, and whenever a task starts, finishes or changes.

Each helper agent works in its own git worktree at `/home/user/wt/<name>` on branch `agent/<name>`.
- Its unfinished work is committed there as "WIP" snapshots.
- If the worktree is gone, the branch may still exist locally; otherwise redo the task from this description.
- Merge each branch into `main`, run the regression tests (reload, chat, water, gear, haul, skills, printshop), look at the screenshots, then push.

## In progress (helpers resumed 2026-11-03 17:17 UTC; if one stops, resume it)
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

## Started (helper running, branch `agent/workshop`)
7. **Big workshop building**, to the RIGHT of the helipad (AIR_SLOTS around x 38.5, z -2, in js/vehicles.js). Floor 1 is the main fabrication shop, holding all his 3D printers, work benches, welding and CNC machines. Each machine has full functionality and real requirements:
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

## Started (helper running, branch `agent/plant`)
8. **Concrete and asphalt plant** beside the big workshop (south of it, between the helipad and the lake; one constant, `AGGREGATE_PLANT_SITE` in js/plants.js, follows `WORKSHOP_SITE` if that exists).
   - Ready-mix concrete batch plant: cement silos with screw conveyors, sand and stone bins, weigh hopper, inclined belt, water tank, admixture totes, twin-shaft mixer, truck loading chute, control room. A drivable concrete mixer truck (vehicles.js type `mixer`).
   - Hot-mix asphalt plant: cold feed bins and feeder belts, inclined conveyor, drum dryer with burner flame, baghouse and stack, heated bitumen tank, pugmill, slat conveyor, hot storage silo, truck load-out, control house.
   - He researches each plant at NetNode, asks for the real materials (cement, sand, stone, admixture; aggregate, bitumen binder, burner fuel), follows a mix design (w/c ratio matters, binder ~5.5%), and his own dug rock and dirt can feed the bins.
   - Output: "A load of ready-mix concrete (2 m³)" and "A load of hot-mix asphalt (5 t)" (which satisfies groundwork paving). Hot asphalt cools and is wasted if not used in time; concrete is poured (formwork, pour, screed, cure over world days) as paths and pads, shown on the Map tab.
   - Wear and service (filters, burner, mixer paddles), loop-guarded autonomy, AI `runPlant` field, Brain tab section, hover labels on every part, lazy detail.
   - Status: starting.

## Owner notes to keep in mind
- Commits are authored as jeremiahaguirre <46036250+jeremiahaguirre@users.noreply.github.com>, with no AI attribution. Never commit API keys. Don't push tags or releases.
- "He can build anything", he can ask for lists of things, and code upgrades to his world.
- The shop sells only 3D print files plus his original paintings (once task 1 is merged).
- The 4 logo-bearing glTF models (car, sunglasses, candle holder, camera) are still waiting on the owner's decision.
