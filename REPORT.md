# Farm stage 2: orchard, vegetables, livestock, hay and feed

Branch: `agent/farm2`, with origin/main merged up to 9c17ca6 before the final tests. This branch (`qa-results-farm2`) holds results only: this report, screenshots (`shots/`, DSF 2, JPEG), and the test scripts, logs and result summaries (`qa/farm2/`).

Everything under "Verified" was run, measured or seen in a screenshot. Anything else is listed under "Not verified / open items".

## What was built

| File | Contents |
|---|---|
| js/farmdata.js (end) | Stage-2 registries in stage 1's format:<br>• Crops: apple and cherry (orchard; years to bear, bloom, picking window, keep days, pests), potato, carrot, squash and bean (vegetable), hay (perennial: regrowth, 3 cuts, mow and bale moisture).<br>• `FARM_FIELD_USES` for orchard, vegetable, hay and pasture.<br>• `FARM_ANIMALS`: Jersey dairy, Angus beef, ISA Brown hen (rations, gestation, milk, laying).<br>• `FARM_FEED` (TMR, layer mash).<br>• 6 buildings with parts lists: well, packing shed and cooler, hay shed, coop, barn stalls, milk house with a milking robot.<br>• A compact tractor, 13 implements and 10 field operations.<br>• Supplies and retail prices.<br>• `FARM2_LAYOUT` (the empty north-west of the steading; the north field becomes hay). |
| js/farmlife.js | `state.farm.mixed` (filled in for older saves). A one-day simulation of:<br>• the orchard (age, bloom frost, fruit set, pests, ripening, drop);<br>• the plots (stage 1's field model, plus vegetable water use and drip);<br>• the hay stand (regrowth, swath drying, rain damage);<br>• the pasture;<br>• the animals (rations, condition, illness, calving, re-breeding, milk curve, laying);<br>• the store (spoilage, cooler).<br>Also the feed budget and the grain reserve. |
| js/farm2models.js | Original models made in code:<br>• the 6 buildings, staged frame → walls → roof → fit;<br>• the compact tractor with loader;<br>• the 13 implements;<br>• vegetable and hay clumps;<br>• instanced trees (trunk, canopy, blossom, fruit);<br>• instanced animals with separate heads (so a cow can lower her head to graze);<br>• bales, swaths and windrows;<br>• post-and-wire fences. |
| js/farm2.js | The long plan "Grow a mixed farm" (17 steps, agenda kind `farm2`): research, layout, building list, 6 buildings, pasture fence, machines list, orchard list, planting the orchard, seed list, animal list, animals arriving, then the first year. Animal lines on the Post Office list cards. |
| js/farm2year.js | The yearly task (kind `farmmixed`, one per year, steps = the four seasons). Each time it comes up he scores every possible chore and does the most urgent one:<br>• feed, hens, sick animals, calving, new calves, milk, eggs;<br>• herd out to pasture or in to the barn, health walk;<br>• hay: sow, mow, ted, rake, bale (round or square), haul;<br>• plots: till, plant, drip on/off, cultivate, harvest + wash/pack;<br>• orchard: prune, spray, pick;<br>• selling: stand and website;<br>• the autumn feed budget (buy hay, sell a cow, hold grain back from sale, order layer ration);<br>• seed orders, calves and steers, surplus over 12 stalls, learning a machine he can't drive yet. |
| js/farm2view.js | 3D refresh (orchard by season, hay, fences, animals walking, grazing and pecking), the Brain-tab panel `#farm2Panel`, the AI summary, the goal template `farm2`, the idea to start it, and hooks into stage 1. |
| js/farm.js, js/farmland.js, index.html | Small edits:<br>• the compact tractor is chosen for `machine: 'compact'` operations;<br>• operation speech comes from `O.say`;<br>• fit-out inside the barn is walked from outside;<br>• **stage-1 fix**: `farmVehicleBlock` asks for diesel again (see below);<br>• no stage-2 stakes before the layout step;<br>• 5 script tags and the panel. |

## Verified

**Stage-2 plan, end to end** (fast time; `qa/farm2/cycle2.js`, PHASE=build; log `logs/build.log`; final run on the final code):
- He ran all 17 steps on a stage-1 farm in about 4.5 minutes of test time, with no page errors. Order: research → layout → building list → well → packing shed → hay shed → coop → stalls → milk house → pasture fence → machines → trees → orchard planted (waited for spring) → seed → animals → year.
- 5 lists went through the Post Office: buildings and fence (50 lines), compact tractor and implements (17), trees (6), seed (6), animals (12).
- Result: 242 apple and 30 cherry trees planted, 3 Jersey + 3 Angus cows, 30 hens.

**One year and a half of the mixed farm** (`logs/year1.log`, `results/snaps-year`; set-up → year 2 spring → year 3 day 220, where a worker restart stopped the run). Logged chores, by kind:

| Chores | Count |
|---|---|
| Health walk | 267 |
| Bottle milk | 265 |
| Eggs | 219 |
| Stock the stand / website | 212 |
| Mix and feed the TMR | 201 |
| Layer mash | 55 |
| Plant / till / harvest plots | 12 / 10 / 8 |
| Drip opened | 8 |
| Cultivate | 6 |
| Mow / ted / rake / bale / haul hay | 7 / 5 / 5 / 5 / 5 |
| Calving pen / calf checks | 10 / 8 |
| Animals treated | 7 |
| Animals sold | 7 |
| Feed budgets | 6 |
| Herd out / in | 2 / 2 |
| Learned the compact tractor | yes |
| Hay sown | 1 |
| Pruning (year 3) | 1 each crop |

- Year 2 ended and a new year task started: `farm:mixedyear:2` done, `farm:mixedyear:3` active.
- Harvests:
  - beans 201 kg and 150 kg;
  - squash 538 kg (15.4 t/ha);
  - potatoes 228 kg (6.6 t/ha);
  - carrots 866 kg (24.9 t/ha).
- Hay: 5 balings, round and small square, at 10–16% moisture. One cut was rained on: quality 31%.
- 11 calves born. Dairy bull calves were sold at a week.
- Feed decisions, as logged: "sell Midnight … rather than buy 51 bales; buy 43 round bales; keep all the corn and wheat for feed; order mineral".
- Mixed-farm earnings: $10,334. Stand sales: 995. Website listings were made for squash, potatoes, hay, beans, carrots, milk and eggs.

**Bug found by this run and fixed**:
- **What happened:** all 30 hens starved over the year-2 winter. The cattle ration used up the corn and wheat, and the hen chore only waited for grain.
- **Fix:** he now orders a bought layer ration when the bins can't make mash, and the autumn budget orders it ahead.
- **Re-test** (`logs/hens.log`) from the same winter snapshot (19 hens, empty bins): he waited for the ration, it came through the Post Office, and he fed them 13 times over ~140 game days. 18 hens alive, 104 dozen eggs packed, no page errors.

**Orchard bearing years** (`logs/orchard.log`, `logs/orchard-apple.log`): years 2 → 5 were skipped in 10-day chunks. During the skip the **test** (not Kelo-1) kept the bunk and feeder filled, emptied the tank and nest boxes, and cleared sickness. Then he worked normally:
- pruned the apple trees in year 5 early spring;
- picked the cherries in July;
- picked the apples in September: **1,230 kg into the cooler from 242 trees**. That is below a full crop because he could not prune or spray during the skip.

**Hay segments** (`logs/hay.log`): from a summer snapshot, mow → ted → rake → bale in sequence; shots 03/04.

**Stage 1 still works**: `qa/farm/cycle.js` from qa-results-farm, unmodified, run on this branch after the main merge (`logs/stage1-branch-cycle-final.log`, `results/stage1-branch-result.json`):
- Whole farm built, SEASON DONE, no page errors.
- Machine list still 11 lines (stage-2 implements are kept off it).
- **Stage-1 deadlock found and fixed:** on unchanged main the same cycle stalls for good at "diesel for the crawler bulldozer". The plan waits on diesel but nothing asks for diesel again once the first can is used. Reproduced twice (`logs/stage1-main-cycle.log` is the run with a test-side workaround).
- With the fix, all four diesel waits clear on their own.

**Re-checked on the final code commit (f64380d)**: the harness regressions (reload, ui, chat, vehicle, haul, basement) all report "page errors: none" (`logs/regress-final.log`). The stage-1 `qa/farm/cycle.js` reaches SEASON DONE with no page errors (`logs/stage1-branch-cycle-f64380d.log`). `npm run build:site` passes. The save checks, the 1.5-year run and the perf numbers below are from 4679886/7faadd9; the only later code changes are the plot soil tint and the hens' bought layer ration.

**Saves** (`logs/saves.log`, final code), all with no page errors:
- Pre-farm save (made on main before the farm merge, d9492f8): loads, all 26 diary entries kept, empty farm and mixed-farm state, panel "not started".
- Main save with an unstarted stage-1 farm: loads, 29 entries kept.
- Real stage-1 save made by unchanged main mid-season (`m-22-farmseason-1`), and the post-harvest save (`final`):
  - load with 10 vehicles, 40 diary entries, plan done, the season task and bins intact;
  - the panel offers the mixed farm;
  - `farm2StartGoal` makes the 17-step task, and he does research and then layout.

**Regressions** (harness on the merged code, `logs/regress.log`): reload, ui, chat, vehicle, haul and basement all report "page errors: none". `npm run build:site` passes (123 scripts, duplicate-name check clean).

**Performance**: draw calls and triangles per frame, all passes, swiftshader (`logs/perf-setup.log`, run console).

Stage 2 not started, same real stage-1 save, main vs branch:

| View | Low | Medium | High |
|---|---|---|---|
| Town | 2047 vs 2056 | 1872 vs 1949 | 2294 vs 2168 |
| Farm yard | 621 vs 618 | 694 vs 691 | 712 vs 712 |

These differences are within run-to-run noise.

Stage 2 set up (`setup` snapshot):

| View | Low | Medium | High |
|---|---|---|---|
| Yard | 876 (952 on a rerun) | 1313 | 1350 |
| Orchard | 174 | 380 | 451 |
| Animal pen | 1103 | 1184 | 1262 |
| Overview | 287 | 347 | 362 |

- The pen view looks across the valley, so most of its calls are the town.
- Repeated things are one InstancedMesh per kind:
  - 272 trees = 4 meshes plus the trellis;
  - each animal kind = body + head;
  - bales, swaths and fences are instanced.
- Mesh census: stage-2 implements are joined per material (rake 108 → 20 meshes, tedder 62 → 22).

What follows the graphics level (js/look.js setting), in `FARM2_LEVELS`:

| Setting | Low | Medium | High |
|---|---|---|---|
| Animal update rate | 8 Hz | 24 Hz | 45 Hz |
| Head motion | none | yes | yes |
| Walking bob | no | no | yes |
| Hens shown | 12 | 40 | 60 |
| Blossom | off | on | on |
| Tree shadows | off | off | on |

**Screenshots** (`shots/`, DSF 2, each looked at):

| Shots | What they show |
|---|---|
| 01 | Set-up: overview, yard, orchard rows, the pen with Jerseys and Angus grazing heads-down, coop and run |
| 02 | Summer plots (potatoes in flower, carrots, squash, beans) and the pasture |
| 03 | The north field just mown |
| 04 | Small squares on the field and the hay shed |
| 05 | Year-5 cherries ripe |
| 06 | Year-5 apples |

Problems found from screenshots and fixed:
- the chunk system culled the instanced groups;
- canopies drew white (a shared shader without instance colours);
- stage 1's soil tint turned flowering potatoes canola-yellow;
- fruit was oversized;
- the barnyard pen had no fence.

## Not verified / open items

- **Real hardware**: nothing was run on a real GPU, laptop or phone. Swiftshader in this container ran at ~1 fps (0.6 on unchanged main).
- **QA-only switches in `qa/farm2/run.js`** (the game is unchanged): long cycles used `NORENDER=1` (drawing skipped) and `WARP=6` (Kelo-1's walk/drive simulation fed 6× the elapsed time, like `farmFastFactor` for pauses). Screenshots and draw-call counts were taken with drawing on and no warp.
- **Year run stopped early**: the full year run stopped at year 3, day 220 when the session worker restarted. Year-3 apples and cherries (trees too young: no crop yet) and a second full winter on the final code were not covered there; the orchard segments and the hen re-test cover those parts separately.
- **Not seen in the logged runs**: the beef path ("steer goes for beef", quarters listed) needs a steer about 540 days old. It was not reached in a run. The orchard spray chore (a pest on fruit) was not seen either.
- **Old screenshots and runs**: the set-up screenshots (01) and the orchard segments were taken on code before the canopy-colour, pen-fence and water-use fixes (01 is still correct for what it shows). The cherry and apple shots were retaken after.
- **Long-run behaviour that is open**:
  - Many small one-line supply lists accumulate over years (`results/snaps-hens`: ~30 "supplies for the animals" cards); they could be bundled.
  - A lot of produce spoils (3.7 t in the year run): he grows more than the stand sells, and website listings sell only when the owner marks them sold.
  - When the test drives tasks directly, the goal system's diary repeats "Picked back up Grow a mixed farm…".
- **Long goals**: with two long goals already open (the goal system's cap), the mixed farm joins his long goals only when a slot frees (retried every few minutes). The agenda task runs either way.
- **Simplifications**: animals are not obstacles. Cows walk straight to the pasture (no lane). The milk house robot is not animated. There is no manure handling.
