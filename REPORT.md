# Owner gaps: six unfinished requests (branch `agent/gaps`)

Source: section 3 "Feature review" of REPORT.md on `qa-results-audit-cleanup`.
Code: `agent/gaps`, with origin/main merged in three times. The last merge was main at 7539b6b, which includes the pick-up/put-down hand-off, reference-photo paintings and the Workshop/town audit. The merges brought in the cleanup merge and js/braincharter.js:
- `makerEscape` is now `escapeRegExp`;
- the shop and food AI prompts wrap article and visitor text in `brainUntrusted`;
- main's catch on a throwing shop order is kept;
- paintstudio.js: the plan keeps its id (painted once) and now also carries main's `reference` photo through `paintPlanRun` and the getting-ready path.
Tests: `qa/gaps.js` + `qa/gaps-scenarios.js` (new, in this branch) with scenarios `weldroute nokeybuild food foundation supplies paintonce`; regressions with `qa/harness.js`. Run with
`NODE_PATH=/opt/node-tools/node_modules KELO_ROOT=<repo> PORT=<port> node qa/gaps.js <scenario>`.

All results below are from the final runs on the merged branch (headless Chromium, SwiftShader).

| Scenario | Checks | Result |
|---|---|---|
| weldroute (item 1) | 26 | all PASS, no page errors |
| nokeybuild (item 2) | 7 | all PASS, no page errors |
| food (item 3) | 7 | all PASS, no page errors |
| foundation (item 4) | 6 | all PASS, no page errors |
| supplies (item 5) | 6 | all PASS, no page errors |
| paintonce (item 6) | 1 | PASS, no page errors |

Earlier runs found and fixed:
- a trailer hitch was routed to the weld studio (now the garage);
- a jar or head ingredient was not used up;
- the pour walk spots were inside the footprint, so each step timed out (now outside the forms).

The test scripts also had races, and I fixed them: the scripts cleared his busy flags mid-job, and screenshots were taken by polling. Shots now use `window.__keloShotHold` hooks.

## 1. Routable shops (weld studio, batch plant, printers, EDM, garage)
**What changed** (js/shopmaker.js, js/machines.js, js/welding.js)
- `MAKER_CAPS` now has 24 shops, the 13 new ones: weldstudio, batchplant, sls, mjf, dmls, polyjet, binder, ded, ebm, lom, waterjet, edm, garage. Each has the materials and forms the real machine makes and `maxCm`, the largest thing it can make (from the build volume, bed, travel or swing: e.g. Formiga P 110 33 cm, Jet Fusion 5200 38 cm, M 290 32 cm, J850 49 cm, InnoventX 16 cm, Arcam Q10 20 cm, Mcor A4 stack 25 cm, wire EDM 40 cm, the weld table 300 cm). `makerSizeCm` sizes a thing by its head noun ("trailer hitch" is a hitch).
- The waterjet is the support-removal booth, so it has `forms: null` (it finishes PolyJet parts and makes nothing whole).
- Shops outside WORKSHOP_MACHINES are adapters in `MAKER_OUTSIDE_SHOPS`:
  - the Welding Studio runs `makerWeldRun`: the real `weldTheJob` at the table, and the piece grows on the table;
  - the batch plant runs `makerCastRun`: batch ready-mix, cast it in a form in the plant yard, and the form comes off a world day later (`state.makerCastings`). For a ready-mix line on a parts list it runs `makerBatchRun`.
- The garage's fabrication runs on its MIG/TIG welder (`run: 'migtig'`, a new plan: plasma-cut, then weld). The wire EDM also got a plan. Both are `noSolo`.
- Everything goes through `makerShopKnown / Missing / Ask / Run`, so orders, parts lists and supplies work the same for every shop.
- The existing per-machine `makes:` lists count as forms (`makerFormOk`). `workshopCanMake` / `workshopMakePart` had no callers and are removed.
- The AI's `wholeShop` answer is kept only if `makerShopCanWhole` agrees (one of that shop's forms, within its size, not too big). Otherwise the deterministic reading decides.
- "Make me a steel X": steel goes to the Welding Studio unless a shop has a more specific form (a gear to the EDM, a bottle opener to the Haas, a hitch to the garage). Any other steel thing that isn't too big also falls back to welding.
- Welding now uses real metal: `WELD_STOCK` (mild steel, aluminium and stainless bundles, 4 welded pieces each) is part of every weld plan, so it is asked for and used up.

**Evidence** (weldroute):
- Routing table: steel bench, table and coat rack go to weldstudio; nylon hinge to sls; nylon pedal to mjf; titanium implant to ebm; concrete planter and bird bath to batchplant; steel gear to edm; trailer hitch to garage; stainless impeller to dmls; stainless flange to ded; architectural model to lom; clear prototype to polyjet; a steel shed is declined.
- The AI says fdm for a table: rejected. weldstudio for a garden shed: rejected (too big). weldstudio for a bench: kept.
- A visitor's "make me a steel bench" becomes a Welding Studio order. It waits for the hood, gloves, gas, wire and **steel stock**, all asked at the Post Office. Once they come he welds it, and "A welded steel bench" is his, kind "learned steel bench" (sit), in his Storehouse. The steel stock went from 4/4 to 3/4.

**Left**
- The batch plant cast route and the garage and EDM plans are unit-checked through routing only. No end-to-end run casts a planter or EDMs a gear (the run path is the same `makerShopRun` the weld test covers).
- Cast items use the generic item model in grey concrete.

## 2. Big builds without an AI key, machine lines on big-build BOMs
**What changed** (js/shopmaker.js §12, js/assembly.js)
- When there is no key and no template, `researchBuild` no longer refuses. He reads at NetNode (wikiSummary, then lookUpAnywhere), and `bomFromReading` writes a real BOM:
  - the sub-assemblies come from `MAKER_FAMILIES` (structure, wheeled, boat, flying, device, generic thing), with quantities;
  - the frame is wood or steel depending on the article;
  - components and bought parts the article names are added.
- `makerMarkBomLines(bom)` runs on every big-build BOM (template, AI or article). A part line one of his shops can make whole is marked "I'll make this on the <machine>" (raw stock, fasteners and bought components never are), and that shop's missing supplies go on the list.
- `parseBuildRequest`: "build me a table" (or anything one shop can make whole and with no template) is left to the woodshop/maker path even with a key. "Build me a shed" is still a big build.

**Evidence** (nokeybuild):
- Template marks: ultralight "Flaperon frames (aluminium) -> Welding Studio", canoe "Ash cane seats -> woodshop", shed "Ready-mix concrete for 9 pier footings -> concrete batch plant".
- A no-key gazebo is planned from its article (4 sub-assemblies), and its footings are made on the batch plant.
- A no-key pedal car with no article gets Frame / Wheels and axles / Deck and handle.
- Screenshot: `shots/gaps-2-nokey-build-machine-lines.png`.

**Left**
- The family lists are generic for odd things (e.g. a "thing" gets a body plus fittings).
- With a key the AI BOM is marked the same way, but the AI is not asked to mark lines itself.

## 3. Food: "make me a sandwich"
**What changed** (js/shopmaker.js §13)
- Food and drink asks ("make/cook/bake/brew me …") are caught before the maker route (`makerIsFood` uses the itemuse.js food and drink rules).
- `answerFoodAsk` builds the ingredient list from `FOOD_RECIPES` (16 dishes and drinks). For anything else it asks the AI if there is a key, otherwise it reads the article's ingredients. The ingredients are asked for at the Post Office (category `ingredient`).
- Ingredients that arrive are kept for the order: they are not eaten on arrival (`receiveItem` wrapper) or as a snack (`storedFoodName` wrapper).
- `cookFoodOrder` cooks at his stove (pan on, steps per ingredient). It uses up a serving of each ingredient, or the whole jar or head when it has no serving count. "A freshly made sandwich for <visitor>" is a real food item (category food, kind food) in his things, and he tells the visitor.

**Evidence** (food): sandwich, lemonade and pancakes go to food, while a steel bench and a stool go to the maker. The sandwich asks for 5 ingredients, a delivered ingredient is kept, he cooks it, and each ingredient is used. Screenshot: `shots/gaps-3-sandwich-at-stove.png`.

**Left**
- There is no way to hand the food to the visitor (no outbox exists), so it waits in his Storehouse.
- The stove model shows a generic pan, not a sandwich.

## 4. Concrete for foundations
**What changed** (js/assembly.js, js/bom.js, js/shopmaker.js)
- A sub-assembly named foundation, footing, slab, pad or piers that has a concrete line (`foundationNeedsPour`) is poured for real:
  - The ready-mix line is a make-line on the batch plant. It is batched only when that sub-assembly is next and everything else for it is here, because concrete sets in the drum.
  - `pourFoundation` drives the mixer truck over, renders forms, the pour (4 steps) and the screed as a `state.concretePours` pad at the site, and uses the load (`useReadyMixFor`).
  - Nothing else is built until that pour is `cured` (the existing 7-day cure in plantTimeTick). `buildNextSubAssembly` returns `'curing'` until then.
  - A load that set or went missing is batched again.
- The shed template now pours 9 pier footings instead of sitting on deck blocks. Article-planned structures pour 6 pier footings.

**Evidence** (foundation): The shed's footing ready-mix line is made on the batch plant. He batched it at his own plant (1 batch) and poured it at the site (`shots/gaps-4-foundation-pour.png`), and the pour is curing with the load used. The floor returns `'curing'` while it cures. After 7 world days the pour is `cured`, and then the floor is built.

**Left**
- The pour is drawn as one pad over the footprint, not as separate piers.
- The shed's site comes from the existing `openGroundSpot`. In the final run it landed right at the lake shore (see the screenshot), so a site rule that keeps builds back from the water would help.
- The 7-day cure uses world days (3.5 real days at the default clock), as asked.

## 5. Supplies rule: upgrades and photo welds
**What changed** (js/upgrades.js, js/welding.js, js/talk.js)
- `upgradeMaterialsFor(code)` gives every coded upgrade a real materials list (lumber or steel stock and screws for parts, lamp kits, sign board and paint, pavers and path lights, fence pickets/posts/nails, fountain pump and basin, fairy lights, chime tubes).
- `codeAnUpgrade` codes it, then asks for the missing materials at the Post Office and keeps it in `state.upgradePlans`. `upgradePlansTick` builds it (`buildPlannedUpgrade`) once they are here, using them up, and then unveils it. It works with templates, so it works offline and with no key.
- Photo welds go through `weldingReady`, which now includes the steel stock. The Talk chip stays "queued" with what he is waiting for, instead of "done".

**Evidence** (supplies): the Meadow Fountain is coded but not built, and its 5 materials are asked for. Once they come it is built and they are used (the box of screws loses a serving). Every built-in template needs materials. A photo weld without steel stock waits and asks for it. With stock it welds and uses 1 of 4.

**Left**
- Upgrades that already existed in old saves stay as they are.
- AI-written upgrades get the same derived list (the AI doesn't write its own materials).

## 6. Visitor paintings painted twice
**What changed** (js/paintstudio.js): `answerPaintRequest` gives the plan an id and queues `paintPlanRun(id)`. `paintPlanTick` runs the same function, so whichever comes first paints it, and the other finds the plan gone. On merge I took main's stricter clear (only the plan this painting was).

**Evidence** (paintonce): both paths fire, exactly 1 painting for the visitor, and the plan is cleared.

## Extra fix found on the way: instanced sets in the wrong chunk (js/perf.js)
While checking the foundation screenshot I found that a concrete pour away from the plant was **never drawn**. The data and the checks were right, but nothing showed on screen.

The cause:
- `perfInstances` widened only the geometry's bounding *sphere*;
- main's new chunk system (js/chunks.js) files objects with `Box3.setFromObject`, which reads the bounding *box*;
- that box still covered a single copy at the origin, so every instanced set inside a group (pours, and anything else built with `plantKit`/`perfInstances` inside a group) was filed in chunk (0,0) and drawn only when that chunk was on screen.

The fix: `perfInstances` sets the bounding box too. Scenario `pourchunk` checks it, with three boxes at a site far from the origin: plain mesh, instanced in the scene, instanced inside the pour group. Before the fix the third box was missing; after it, all three draw (`shots/gaps-pourchunk.png`), and the foundation pour shows in `shots/gaps-4-foundation-pour.png`.

## Regressions
Run on the merged branch with `qa/harness.js`. None had page errors.
- **reload**: the pit persists.
- **ui**: all tabs shot.
- **chat**: replies and vocab as before.
- **vehicle**: "vehicle disposed false". **origin/main gives the same output**, so it is not a regression.
- **haul**: 4 loads tipped.
- **printshop**: listing, sale and STL are fine. One earlier run failed with "list stand at $50: false". Rerun on main and on this branch, both pass, so it was a one-off timing issue (he was busy).
- **planitems**: no plan is missing anything, and the treehouse is built.

## Screenshots
All screenshots are in `qa/shots/`.
- `gaps-1-weld-studio-job.png`: the steel bench order at the Welding Studio, the bench welded on the table, Kelo-1 hanging up his hood.
- `gaps-2-nokey-build-machine-lines.png`: the no-key gazebo's Foundation list card, with "Ready-mix concrete for 6 pier footings — I'll make this on the concrete batch plant".
- `gaps-3-sandwich-at-stove.png`: "Cooking sandwich: whole-wheat sandwich bread" at his stove.
- `gaps-4-foundation-pour.png`: "Garden shed foundation: pouring the concrete" at the shed site.

Logs of the final runs are in `qa/logs/`.

To run the tests, copy `qa/gaps.js` and `qa/gaps-scenarios.js` into the `qa/` folder from `qa-tools` (they need its `vendor/`), then:
`NODE_PATH=/opt/node-tools/node_modules KELO_ROOT=<repo> PORT=<port> node qa/gaps.js <weldroute|nokeybuild|food|foundation|supplies|paintonce>`.

The scenarios use the test hooks `window.__keloShotHold = 'weld'|'cook'|'pour'`, which hold that moment until cleared, the same way `__makerHold` and `__wsHold` work.
