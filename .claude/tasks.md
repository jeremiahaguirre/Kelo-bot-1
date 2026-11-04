# Open tasks (keep this list current)

Owner's rule: never drop a task. Every time work restarts (new session, a usage-limit reset or a container restart), read this file first.
Update it just before stopping, and whenever a task starts, finishes or changes.

Each helper agent works in its own git worktree at `/home/user/wt/<name>` on branch `agent/<name>`.
- Its unfinished work is committed there as "WIP" snapshots.
- If the worktree is gone, the branch may still exist locally; otherwise redo the task from this description.
- Merge each branch into `main`, run the regression tests (reload, chat, water, gear, haul, skills, printshop), look at the screenshots, then push.

## Merged into main locally (2026-11-04, waiting on the regression run before push)
- Task 1 Paintings (agent/paint), task 2 Accurate welding + work bench (agent/weld), task 3 Humanize/eye cam/fluid motion (agent/body), task 4 Garden (agent/garden), task 6 Code anything + self-upgrades (agent/upgrades), task 10 phase 1 audit (agent/review; plan in .claude/review.md, phase 2 still to do after the rest merge).

## In progress (helpers resumed 2026-11-04 03:12 UTC; if one stops, resume it)
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
   - Status: built and tested on `agent/vehicles` (js/trips.js plus small hooks in vehicles.js, knowhow.js, itemuse.js, skills.js, agent.js, index.html). Refuel loop root cause: AI-named fuel ("Gasoline for the snowmobile") was classed as a vehicle (0 uses, phantom vehicle), and every empty can asked for another. Waiting to be merged into `main`.

10. **Performance, game quality, bug hunt and clean code** (`agent/review`, started):
    - **Phase 1, now:** measure, find and verify bugs, perf hotspots and cleanup items, and write `.claude/review.md` (tiny safe fixes only).
    - **Phase 2, after tasks 1-9 are merged:** apply the plan across the merged code, re-profile, and fix new bugs from the merges.

11. **Talk tab clean-up and improvement** (`agent/talk`, started):
    - A modern chat thread with bubbles, avatars, a typing indicator, auto-scroll, jump-to-latest, lookup cards and status chips for actions you asked for.
    - One composer with a + menu for photos and gifts.
    - Suggested reply chips that fit his current situation.
    - An empty state, "load earlier", and accessibility.
    - Obsolete controls removed.

## Owner notes to keep in mind
- Commits are authored as jeremiahaguirre <46036250+jeremiahaguirre@users.noreply.github.com>, with no AI attribution. Never commit API keys. Don't push tags or releases.
- "He can build anything", he can ask for lists of things, and code upgrades to his world.
- The shop sells only 3D print files plus his original paintings (once task 1 is merged).
- The 4 logo-bearing glTF models (car, sunglasses, candle holder, camera) are still waiting on the owner's decision.
