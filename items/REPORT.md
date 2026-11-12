# Kelo-1 item models: catalogue, judgement and fixes (branch `agent/items`)

Every item that can sit in the Storehouse, the Museum, his hands, the Post Office pick-up table or a parcel is built by `buildItemModel3D(name)` (js/items3d.js). This pass catalogued every name the game can produce, rendered each one, judged it, and fixed the wrong ones in the shared name→model path.

## Catalogue
- **993 names from the code** (`catalogue.json`, with the file and constant each comes from): request lists, gift catalogue, Workshop supplies and machine orders, everything each machine makes, BOM tools, parts-kit and tool crates, roadworks and runway kits, plant supplies, vehicles and trailers, welding and paint supplies, paintings, built projects, food, seeds and plants, mining finds, disposal junk, fish, broken items, the starting Storehouse contents.
- **135 AI-style names** (`ai-names.json`): kitchenware, electronics, sports gear, building materials, toys, instruments, books, clothes and household things, the kind of name the AI invents.
- `classify.js` sorts the code names by where they end up: **582 are shelved** (Storehouse, hands, Post Office). **323 are BOM part lines** that only travel inside a parts-kit crate and are never modelled alone. **50 are BOM sub-assemblies** and **15 are built in place** (shed, tree fort, picnic table…). **23 are painting titles** that hang in the Museum as pictures.
- Old saves: no code renames items. Old saves hold the same names, plus AI-designed or looked-up models (`state.itemDesigns`, `state.itemLookups`), which still take priority as before.

## How it was judged
`itemsheet.js` loads the game, then for each name renders:
- the **shelf view**: exactly as `shelfHolderFor` places it, in a 1.09 m-wide slot with 10 cm ticks;
- a **close-up** at life size.

Under each image it prints the real size in metres (world units ÷ 1.6) and the model route (which rule, glTF, or generic fallback it took). It also records floating or sunk models, visible labels and the scale used on the shelf (`*.json`). Each sheet was then looked at item by item, checking: right object, real size, materials, sitting on the shelf, no placeholder.

Sheets (JPEG, deviceScaleFactor 1):
- `before/cat-*.jpg`: all 993 code names, before.
- `before/ai-*.jpg`: the 135 AI names, before.
- `after/shelf-*.jpg`: the 582 shelved names, after.
- `after/ai-*.jpg`: the 135 AI names, after.

## Results (shelved + AI names: 712)
| | before | after |
|---|---|---|
| generic fallback (orb on a stand, stacked plates, random sculpture, wrong category stand-in) | 258 | 0 |
| given a different model or rule after judging (wrong object, or a crude model replaced) (e.g. "Baseball bat" was a soccer ball, "Remote control car" a 4.5 m car, "Multitool" a 52 cm toolbox, "Flute" an asphalt rake, "Aircraft weighing scales" a canoe) | 191 | 0 known |
| floating or sunk (min y off the shelf) | 124 | 0 (all grounded) |
| still not right, listed below | | 16 |


## What was fixed (game branch `agent/items`, no gameplay changes)
- **New `js/itemmodels.js`**: about 130 shared, real-size category models, built in metres, standing on y = 0 and facing +z. They cover:
  - kitchenware: pans, pots, kettles, boards, utensils, cutlery, mugs, plates, bowls, appliances
  - electronics: laptop, phone and tablet, headphones, speakers, keyboard, mouse, dev boards, multimeter, soldering station, cables and chargers, fan, clocks, cameras, gamepad, radios, screens, bulbs, watch
  - sports: rackets, bats, glove, balls by sport, sticks and clubs, boards, fishing rod, tackle box, mats and sleeping bags, weights, tent, backpack, life jacket, helmets, skates, sleds, umbrella
  - building materials and supplies: sacks, fastener boxes, hardware bags, brackets and hinges, sheet goods, lumber, paint cans and pails, tape, bricks, shingles, pipes, spools, bottles, jugs and tubes
  - workshop: power tools, bench machines (welders, bandsaws, compressor, vise, drill press, table, chop and mitre saws), hand-tool sets, PPE, cutters, blades, jack stands, tyres, gauges, mechanical parts, fuel drums and jerry cans, bulk loads sized by tonnage
  - art supplies: easels, canvases, pads, pastels, palettes, brushes, paint sets, aerosols
  - household: clothes laid out flat, textiles, furniture, frames, mirror, extinguisher, first aid, binoculars, globe, hourglass, bird feeder, pots, buckets, brooms
  - toys and instruments: plush, doll, train, cards, games, cube puzzle, robot, brass, woodwinds, drums, tambourine, keyboard piano, kalimba
  - finds, lights and containers: coins, nuggets, fossils, bones, arrowheads, petrified wood, aquariums, lanterns, headlamps, flashlights, jars and powder flasks, metal stock
  - made parts: rings, hinges, enclosures, cabinet doors, baffles, panels, racks, fire pit, phone stand and more
- **Performance**:
  - each model shares one material per colour and finish (`imKit`);
  - repeated small parts (keys, strings, bricks, sockets) are merged into one geometry;
  - shelf models are still built only while the camera is near (perf.js), with shadows off on the shelves.
- **Matching**: the name→model path was improved instead of adding hundreds of one-offs.
  - Rule order and word collisions fixed: "piece" matched pie, "aircraft" matched raft, "propeller" matched rope, "baghouse" matched house, "block of steel" matched Lego, "flute" matched lute, "jigsaw puzzle" matched the power jigsaw, "jump rope" matched rope, "fabric iron" matched the toolbox rule, "coat rack" matched coat, "bottle cap" matched cap, "model cartridge" matched the model-car glTF, "trailer hitch for the pickup" matched the pickup, "tools for the canoe" matched the canoe, the drum of asphalt emulsion matched the asphalt heap and the 5-gallon pail.
  - `splitItemList` keeps kits, sets, bracketed specs, sizes, dishes and names with an unmodelled piece whole.
  - glTF matches tightened: camera, car, vase, pouf, lamp, stained glass. Fish species added.
- **Sizes**:
  - `imTrueSize` scales the older display-size models (gems, coins, crucible, ingots, lamps, motors, tanks…) to the real thing's size.
  - `imGround` stands every item on y = 0, which fixes the 124 floating or sunk models on shelves, in his hands and on the Post Office table.
  - The Storehouse shelf now fits each thing per axis to its real slot (`SHELF_FIT` 1.0 × 0.74 × 0.72 world units) instead of capping the longest side at 0.39 m, and turns long things to lie along the shelf. A hammer, a laptop or a pan now shows at true size; only things longer than the slot are shrunk.
- **Materials**: parts modelled with their own finish keep it (`keepLook`), so name words no longer turn a bag of glass beads or a parts kit "…and window" see-through. Modelled metal gets reflections. Kit crates skip name-based looks.
- **Makers**:
  - A 3D print with no saved design is modelled as the named thing in print plastic, not the default robot.
  - `madePartModel` asks `imMadeShapeModel` first, for products that had all been one generic block.
  - Bronze and brass castings are metal.

## Still not right
Listed in the table as LEFT:
- Painting titles that reach the item path fall back to a sculpture form. They are Museum pictures, never shelf items.
- Broken variants ("Snapped sturdy shovel") show the intact model.
- Wishes for places (island, dock, observatory) are small token models.
- Companions (goat, pigeons) keep simple block models.
- The circular saw is rough.
- Vehicles (canoe, rowboat) sit 3 cm low on the pick-up table; they keep their vehicle models on purpose.
- BOM part lines are only modelled as their parts-kit crate (by design), and every kit uses the same crate.
- Metal looks depend on the HDR sky; in the test page without it, some steel reads dark grey.

## Check your own save
Two read-only ways:
1. **In the game:** click the Storehouse (or the Museum). The full-screen viewer shows every stored thing as a rendered picture of its model, 12 a shelf, floor by floor. That is the same `buildItemModel3D` path the shelves use.
2. **Offline contact sheet:** in the game menu, Diary tab → "His memory" → **Back up his brain** saves `kelo1-brain-YYYY-MM-DD.json`. It contains no API keys. Then, from this folder:
   `BACKUP=kelo1-brain-YYYY-MM-DD.json KELO_ROOT=/path/to/kelo-bot-1 node itemsheet.js - out mysave`
   This loads your save in a throwaway browser profile and writes `out/mysave-*.jpg` with every Storehouse item, toy, belonging and mailbox parcel, each with its size and model route. Nothing is written back to the game.

## Tests
- `harness.js` reload, ui, gear, printshop, basement and planitems, then `itest.js post`: all exit 0 with "page errors: none".
- The basement scenario prints "put away: false, deepest went 0.0" and takes a dark storehouse screenshot. Unmodified main prints exactly the same (`basement-main.log`), so it is pre-existing and not from this change.
- The `node --check` and duplicate top-level name checks are clean.

## Files
- `itemsheet.js`, `classify.js`, `report.js`: the tools.
- `catalogue.json`, `classes.json`, `ai-names.json`, `shelf.json`, `left.json`: the inputs.
- `before/`, `after/`: the sheets and the per-item measurements (`*.json`).
- `logs/`: the regression logs.

## Judged table
Before: `generic fallback` = no model of its own; `wrong object/route` = judged wrong and given a different model or rule; `floating`/`sunk` = off the shelf by that much. After: `ok`, `LEFT: …`, or `not shelved (…)`.

| Item | Source | Before | After | Real size (after) | Model route (after) |
|---|---|---|---|---|---|
| A basket of Okanagan cherries | agent.js | ok | ok | 31 cm × 24 cm × 31 cm | rule /^(?!.*(pie\|tart\|cobbler\|cake\|jam\|muffi/ |
| A warm sourdough loaf | agent.js | oksunk -1 cm | ok | 26 cm × 14 cm × 24 cm | rule /bread\|loaf\|sourdough\|baguette\|\bbun\b\|/ |
| Butter tarts | agent.js | wrong object/route | ok | 26 cm × 5 cm × 26 cm | rule /tart\|\bpies?\b\|cobbler\|cake\|cookie/ |
| Honeycrisp apples | agent.js | ok | ok | 31 cm × 24 cm × 31 cm | rule /^(?!.*(pie\|tart\|cobbler\|cake\|crumble\|j/ |
| A bowl of ramen | agent.js | ok | ok | 26 cm × 11 cm × 20 cm | rule /ramen\|noodle\|soup\|stew\|bowl/ |
| Maple fudge | agent.js | ok | ok | 20 cm × 2 cm × 11 cm | rule /fudge\|chocolate\|brownie/ |
| Fresh peach cobbler | agent.js | wrong object/route | ok | 26 cm × 5 cm × 26 cm | rule /tart\|\bpies?\b\|cobbler\|cake\|cookie/ |
| A thermos of hot cocoa | agent.js | ok | ok | 7 cm × 28 cm × 7 cm | rule /cocoa\|coffee\|\btea\b\|thermos\|juice\|mil/ |
| Smoked salmon | agent.js | ok | ok | 65 cm × 29 cm × 14 cm | glb fish.glb \| rule /salmon\|fish\|trout/ |
| A wheel of aged cheddar | agent.js | ok | ok | 14 cm × 8 cm × 9 cm | rule /cheese\|cheddar/ |
| A high-torque diamond drill | agent.js | ok | ok | 34 cm × 25 cm × 8 cm | rule /drill/ |
| A brass telescope | agent.js | oksunk -1 cm | ok | 1.00 m × 1.30 m × 60 cm | rule /telescope/ |
| A soldering iron | agent.js | wrong object/route | ok | 28 cm × 12 cm × 13 cm | rule /soldering (iron\|station)/ |
| Climbing rope and carabiners | agent.js | generic fallback | ok | 36 cm × 12 cm × 39 cm | rule /^(?!.*(jump\|skipping\|power\|extension\|e/ |
| A pocket spectrometer | agent.js | generic fallback | ok | 12 cm × 3 cm × 3 cm | rule /infrared thermometer\|ir thermometer\|sl/ |
| A field microphone | agent.js | ok | ok | 8 cm × 20 cm × 8 cm | rule /microphone\|mic\b/ |
| A box kite | agent.js | oksunk -23 cm | ok | 54 cm × 46 cm × 1.15 m | rule /kite/ |
| A yo-yo | agent.js | ok | ok | 6 cm × 22 cm × 3 cm | rule /yo-?yo/ |
| A kaleidoscope | agent.js | ok | ok | 25 cm × 16 cm × 8 cm | rule /kaleidoscope\|spyglass/ |
| A wind-up frog | agent.js | ok | ok | 10 cm × 8 cm × 10 cm | rule /frog/ |
| A set of juggling balls | agent.js | ok | ok | 23 cm × 7 cm × 7 cm | rule /ball\|juggl\|marble/ |
| A 3D puzzle cube | agent.js | wrong object/route | ok | 6 cm × 6 cm × 6 cm | rule /rubik\|puzzle cube\|speed cube\|magic cub/ |
| A larger island to explore | agent.js | ok | LEFT: a wish for a place, shown as a small token model, not a real object | 50 cm × 29 cm × 50 cm | rule /island\|land\|territory/ |
| A treehouse platform | agent.js | wrong object/route | LEFT: a wish for a place, shown as a small token model, not a real object | 53 cm × 33 cm × 53 cm | rule /treehouse\|cabin\|\bhouse\b\|observatory\|/ |
| A lakeside dock | agent.js | ok | LEFT: a wish for a place, shown as a small token model, not a real object | 38 cm × 6 cm × 32 cm | rule /dock\|pier\|plank\|cedar\|lumber\|timber/ |
| A tiny observatory on the peak | agent.js | wrong object/route | LEFT: a wish for a place, shown as a small token model, not a real object | 53 cm × 33 cm × 53 cm | rule /treehouse\|cabin\|\bhouse\b\|observatory\|/ |
| A canoe | agent.js | wrong object/route; sunk -3 cm | ok | 36 cm × 8 cm × 44 cm | rule /canoe\|kayak\|boat\|\braft\b\|paddle ?boar/ |
| A hot air balloon | agent.js | ok | ok | 24 cm × 44 cm × 24 cm | rule /hot.?air balloon\|balloon basket/ |
| A tandem bicycle | agent.js | ok | ok | 44 cm × 24 cm × 15 cm | rule /bike\|bicycle\|scooter/ |
| A mini submarine | agent.js | okfloating 1 cm | LEFT: toy-like yellow blob (the wish has no real-size meaning) | 55 cm × 31 cm × 24 cm | rule /submarine/ |
| A friendly goat | agent.js | ok | LEFT: a companion, not stored; simple block model kept | 33 cm × 31 cm × 13 cm | rule /goat\|sheep/ |
| A pair of homing pigeons | agent.js | okfloating 1 cm | LEFT: a companion, not stored; simple block model kept | 26 cm × 21 cm × 18 cm | rule /pigeon\|bird/ |
| A tank of glowing jellyfish | agent.js | wrong object/route | ok | 62 cm × 39 cm × 32 cm | rule /aquarium\|fish ?tank\|tank of .*(fish\|je/ |
| 100 m of copper wire | agent.js | wrong object/route; floating 1 cm | ok | 8 cm × 15 cm × 15 cm | rule /spool\|reel of\|\bwire\b(?!.*(stripper\|b/ |
| Sheets of stained glass | agent.js | wrong object/route | ok | 40 cm × 35 cm × 10 cm | rule /glass/ |
| A crate of reclaimed cedar | agent.js | ok | ok | 38 cm × 6 cm × 32 cm | rule /dock\|pier\|plank\|cedar\|lumber\|timber/ |
| A bag of river clay | agent.js | wrong object/route; sunk -1 cm | ok | 45 cm × 10 cm × 30 cm | rule /^(?!.*\b(bolts\|nuts\|screws\|washers\|nai/ |
| High-Torque Diamond Core Bits, Solar Smelting Crucible | agent.js | ok | ok | 35 cm × 15 cm × 16 cm | LIST[rule /drill bits?\|\bbits\b/ ; rule /crucible\|cauldron |
| 50L Sterile Oat Substrate, Infrared Thermal Imaging Lens | agent.js | oksunk -1 cm | ok | 37 cm × 35 cm × 20 cm | LIST[rule /flux\|powder\|sand\|salt\|flour\|substrate\|/ ; r |
| Brushless Geared Traction Motors, 100m Steel Bar Stock | agent.js | wrong object/route | ok | 65 cm × 19 cm × 19 cm | LIST[rule /motor\|engine\|generator\|turbine/ ; rule /(block |
| Argon Shielding Gas Refill, Anodizing Power Supply | agent.js | ok | ok | 28 cm × 85 cm × 14 cm | LIST[rule /shielding gas\|gas cylinder\|argon\|\bco2/ ; rule |
| Hydraulic Rock Splitter, Gold Smelting Furnace | agent.js | generic fallback; floating 1 cm | ok | 1.34 m × 99 cm × 62 cm | LIST[rule /rock splitter\|plug and feathers\|feathe/ ; rule  |
| 20kg Titanium Welding Rod, Solar Capacitor Bank | agent.js | ok | ok | 18 cm × 5 cm × 45 cm | LIST[rule /tungsten\|filler rods?\|tig rods?\|electr/ ; rule |
| Okanagan Peaches | agent.js | ok | ok | 31 cm × 24 cm × 31 cm | rule /^(?!.*(pie\|tart\|cobbler\|cake\|jam)).*(p/ |
| Heritage Tomatoes | agent.js | generic fallback | ok | 31 cm × 24 cm × 31 cm | rule /\b(pears?\|tomato(es)?\|oranges?\|lemons?/ |
| Carrots | agent.js | ok | ok | 58 cm × 8 cm × 20 cm | rule /carrot/ |
| Blueberries | agent.js | ok | ok | 31 cm × 24 cm × 31 cm | rule /^(?!.*(pie\|tart\|cobbler\|cake\|jam\|muffi/ |
| Magnifying glass | portal.js | oksunk -4 cm | ok | 14 cm × 22 cm × 2 cm | rule /magnif/ |
| Pocket compass | portal.js | ok | ok | 7 cm × 1 cm × 7 cm | rule /compass/ |
| Headlamp | portal.js | wrong object/route | ok | 18 cm × 6 cm × 21 cm | rule /^(?!.*(weld\|plasma\|propane\|blow ?torch/ |
| Multitool | portal.js | wrong object/route | ok | 17 cm × 3 cm × 2 cm | rule /multi-?tool\|leatherman\|swiss army knif/ |
| Watercolor paint set | portal.js | wrong object/route | ok | 20 cm × 2 cm × 10 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| Box kite | portal.js | oksunk -23 cm | ok | 54 cm × 46 cm × 1.15 m | rule /kite/ |
| Yo-yo | portal.js | ok | ok | 6 cm × 22 cm × 3 cm | rule /yo-?yo/ |
| Kaleidoscope | portal.js | ok | ok | 25 cm × 16 cm × 8 cm | rule /kaleidoscope\|spyglass/ |
| Harmonica | portal.js | ok | ok | 10 cm × 3 cm × 3 cm | rule /harmonica/ |
| Rubber duck | portal.js | ok | ok | 16 cm × 11 cm × 9 cm | rule /duck/ |
| Spinning top | portal.js | ok | ok | 10 cm × 9 cm × 10 cm | rule /spinning top\|\btop\b/ |
| Okanagan cherries | portal.js | ok | ok | 31 cm × 24 cm × 31 cm | rule /^(?!.*(pie\|tart\|cobbler\|cake\|jam\|muffi/ |
| Cinnamon bun | portal.js | ok | ok | 11 cm × 6 cm × 11 cm | rule /bread\|loaf\|sourdough\|baguette\|\bbun\b\|/ |
| A photo | portal.js | generic fallback | ok | 20 cm × 25 cm × 11 cm | rule /picture frame\|photo frame\|\bphotos?\b\|/ |
| 3 photos | portal.js | generic fallback | ok | 20 cm × 25 cm × 11 cm | rule /picture frame\|photo frame\|\bphotos?\b\|/ |
| An axe | tryit.js | ok | ok | 23 cm × 75 cm × 4 cm | rule /^(?!.*pick ?ax).*(\baxe\b\|hatchet)/ |
| A packet of tree seeds | tryit.js | wrong object/route | ok | 20 cm × 10 cm × 14 cm | rule /\b(box\|carton\|case\|pack\|packet) of\b/ |
| A load of gravel | tryit.js | generic fallback | ok | 3.24 m × 1.14 m × 3.24 m | rule /(\d+(\.\d+)?\s*t\b.*\bload\b\|\bload of/ |
| A sturdy shovel | tryit.js | oksunk -4 cm | ok | 25 cm × 1.13 m × 8 cm | rule /shovel\|spade/ |
| Pine planks | tryit.js | wrong object/route | ok | 2.44 m × 4 cm × 28 cm | rule /\b(2x4\|2x6\|2x8\|2 ?× ?4\|1x\d\|4x4\|6x6)\b/ |
| A box of wood screws | tryit.js | generic fallback | ok | 12 cm × 7 cm × 15 cm | rule /\bbox(es)? of (\w+ )?(screws\|nails\|bol/ |
| A hand saw | tryit.js | okfloating 1 cm | ok | 15 cm × 74 cm × 4 cm | rule /\bsaw\b\|handsaw/ |
| A cordless drill | tryit.js | ok | ok | 34 cm × 25 cm × 8 cm | rule /drill/ |
| A bundle of asphalt roof shingles | tryit.js | wrong object/route; sunk -2 cm | ok | 93 cm × 7 cm × 32 cm | rule /shingles\|roofing felt\|tar paper/ |
| A box of nails | tryit.js | generic fallback | ok | 12 cm × 7 cm × 15 cm | rule /\bbox(es)? of (\w+ )?(screws\|nails\|bol/ |
| A claw hammer | tryit.js | ok | ok | 26 cm × 35 cm × 5 cm | rule /hammer\|mallet/ |
| A pair of snowshoes | tryit.js | ok | ok | 58 cm × 6 cm × 62 cm | rule /snow ?shoes?/ |
| A kite | tryit.js | oksunk -23 cm | ok | 54 cm × 46 cm × 1.15 m | rule /kite/ |
| A dump truck | tryit.js | ok | ok | 44 cm × 22 cm × 19 cm | rule /dump ?truck\|truck/ |
| A jerry can of diesel | tryit.js | generic fallback | ok | 34 cm × 51 cm × 17 cm | rule /(drum\|barrel) of\|jerry ?can\|gas can\|fu/ |
| A spool of PLA filament | tryit.js | ok | ok | 7 cm × 20 cm × 20 cm | rule /filament/ |
| A 50 lb bag of clear glass cullet | glassstudio.js | wrong object/route; sunk -1 cm | ok | 68 cm × 12 cm × 42 cm | rule /^(?!.*\b(bolts\|nuts\|screws\|washers\|nai/ |
| A jar of coloured glass frit and colour rod | glassstudio.js | wrong object/route | ok | 1.03 m × 14 cm × 35 cm | LIST[rule /^(an? )?(jar\|bottle\|flask\|tub\|tin\|vial/ ; ru |
| A month of furnace gas on the gas meter | glassstudio.js | generic fallback | ok | 24 cm × 33 cm × 16 cm | rule /infrared thermometer\|ir thermometer\|sl/ |
| A pair of didymium safety glasses | glassstudio.js | wrong object/route | ok | 15 cm × 5 cm × 13 cm | rule /respirator\|gas mask\|dust mask\|ear (def/ |
| A pair of Kevlar heat gloves | glassstudio.js | generic fallback | ok | 25 cm × 6 cm × 24 cm | rule /respirator\|gas mask\|dust mask\|ear (def/ |
| A wheelbarrow | groundwork.js | oksunk -2 cm | ok | 89 cm × 40 cm × 99 cm | rule /wheelbarrow/ |
| A landscape rake | groundwork.js | wrong object/route | ok | 26 cm × 91 cm × 4 cm | rule /asphalt rake\|\blute\b\|\brake\b/ |
| A plate compactor | groundwork.js | ok | ok | 31 cm × 51 cm × 64 cm | rule /plate compactor\|compactor\|tamper/ |
| A load of crushed gravel | groundwork.js | generic fallback | ok | 3.24 m × 1.14 m × 3.24 m | rule /(\d+(\.\d+)?\s*t\b.*\bload\b\|\bload of/ |
| An asphalt rake | groundwork.js | wrong object/route; floating 2 cm | ok | 31 cm × 89 cm × 2 cm | rule /asphalt rake\|\blute\b\|\brake\b/ |
| A walk-behind road roller | groundwork.js | ok | ok | 38 cm × 58 cm × 66 cm | rule /road roller/ |
| A load of hot-mix asphalt | groundwork.js | wrong object/route; sunk -2 cm | ok | 47 cm × 14 cm × 48 cm | rule /^(?!.*(shingle\|roof\|drum\|emulsion\|tank/ |
| A garden trowel | groundwork.js | ok | ok | 6 cm × 18 cm × 3 cm | rule /trowel/ |
| A watering can | groundwork.js | ok | ok | 34 cm × 25 cm × 19 cm | rule /watering can/ |
| A toolbox | itemuse.js | ok | ok | 52 cm × 31 cm × 26 cm | rule /multitool\|iron\|tool/ |
| A can of spray paint | itemuse.js | wrong object/route | ok | 7 cm × 27 cm × 7 cm | rule /spray ?paint\|aerosol\|brake cleaner\|fix/ |
| A watercolour paint set | itemuse.js | wrong object/route | ok | 20 cm × 2 cm × 10 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A jackhammer | itemuse.js | oksunk -2 cm | ok | 72 cm × 99 cm × 55 cm | rule /jack ?hammer\|rock breaker/ |
| A ukulele | itemuse.js | ok | ok | 19 cm × 57 cm × 9 cm | rule /guitar\|ukulele\|violin/ |
| A good book | itemuse.js | ok | ok | 17 cm × 3 cm × 24 cm | rule /book\|novel\|journal\|notebook\|manual/ |
| A camera | itemuse.js | ok | ok | 58 cm × 1.60 m × 75 cm | glb antique-camera.glb \| CATEGORY:tool |
| A bicycle | itemuse.js | ok | ok | 44 cm × 24 cm × 15 cm | rule /bike\|bicycle\|scooter/ |
| A warm scarf | itemuse.js | generic fallback | ok | 18 cm × 5 cm × 50 cm | rule /scarf\|toque\|beanie\|knit hat\|winter hat/ |
| A lantern | itemuse.js | wrong object/route | ok | 15 cm × 30 cm × 15 cm | rule /^(?!.*(weld\|plasma\|propane\|blow ?torch/ |
| A bag of birdseed | itemuse.js | wrong object/route; sunk -1 cm | ok | 32 cm × 9 cm × 20 cm | rule /^(?!.*\b(bolts\|nuts\|screws\|washers\|nai/ |
| A pack of AA batteries | itemuse.js | generic fallback | ok | 7 cm × 2 cm × 7 cm | rule /^(?!.*charger).*(\b(aa\|aaa\|9 ?v\|c\|d)( / |
| A pair of binoculars | itemuse.js | generic fallback | ok | 14 cm × 7 cm × 16 cm | rule /binoculars\|opera glasses\|field glasses/ |
| A compass | itemuse.js | ok | ok | 7 cm × 1 cm × 7 cm | rule /compass/ |
| A fishing rod | itemuse.js | wrong object/route | ok | 1.96 m × 8 cm × 3 cm | rule /fishing (rod\|pole)/ |
| A bag of all-purpose fertilizer | itemuse.js | ok | ok | 19 cm × 30 cm × 10 cm | rule /fertili[sz]er\|compost\|bone ?meal\|blood/ |
| A can of gasoline | knowhow.js | generic fallback | ok | 34 cm × 51 cm × 17 cm | rule /(drum\|barrel) of\|jerry ?can\|gas can\|fu/ |
| A drum of jet fuel | knowhow.js | generic fallback | ok | 60 cm × 89 cm × 60 cm | rule /(drum\|barrel) of\|jerry ?can\|gas can\|fu/ |
| A full propane tank | knowhow.js | wrong object/route | ok | 31 cm × 55 cm × 31 cm | rule /(drum\|barrel) of\|jerry ?can\|gas can\|fu/ |
| A 1 L bottle of grey photopolymer resin | machines.js | wrong object/route | ok | 17 cm × 30 cm × 11 cm | rule /\bglue\b\|epoxy\|caulk\|silicone\|sealant\|/ |
| A 4 L jug of 99% isopropyl alcohol (IPA) | machines.js | generic fallback | ok | 17 cm × 30 cm × 11 cm | rule /\bglue\b\|epoxy\|caulk\|silicone\|sealant\|/ |
| A box of nitrile gloves | machines.js | generic fallback | ok | 24 cm × 7 cm × 12 cm | rule /respirator\|gas mask\|dust mask\|ear (def/ |
| A 10 kg bag of PA12 nylon powder | machines.js | wrong object/route; sunk -1 cm | ok | 45 cm × 10 cm × 30 cm | rule /^(?!.*\b(bolts\|nuts\|screws\|washers\|nai/ |
| A 10 kg flask of 316L stainless steel powder | machines.js | wrong object/route; sunk -1 cm | ok | 14 cm × 27 cm × 14 cm | rule /(flask\|tub\|jar\|bottle\|canister\|can\|dru/ |
| A cylinder of high-purity argon | machines.js | ok | ok | 14 cm × 85 cm × 14 cm | rule /shielding gas\|gas cylinder\|argon\|\bco2/ |
| A P100 half-face respirator | machines.js | generic fallback | ok | 20 cm × 12 cm × 20 cm | rule /respirator\|gas mask\|dust mask\|ear (def/ |
| A spool of brass EDM wire | machines.js | wrong object/route; floating 1 cm | ok | 8 cm × 15 cm × 15 cm | rule /spool\|reel of\|\bwire\b(?!.*(stripper\|b/ |
| A bi-metal bandsaw blade | machines.js | generic fallback | ok | 38 cm × 2 cm × 36 cm | rule /bandsaw blade\|band saw blade\|saw blade/ |
| An HP 3D600 fusing agent cartridge | machines.js | generic fallback | ok | 32 cm × 12 cm × 9 cm | rule /cartridge/ |
| An HP 3D600 detailing agent cartridge | machines.js | generic fallback | ok | 32 cm × 12 cm × 9 cm | rule /cartridge/ |
| A PolyJet VeroWhite model cartridge | machines.js | wrong object/route | ok | 32 cm × 12 cm × 9 cm | rule /cartridge/ |
| A PolyJet SUP706 support cartridge | machines.js | generic fallback | ok | 32 cm × 12 cm × 9 cm | rule /cartridge/ |
| A 5 kg tub of 17-4PH binder-jet powder | machines.js | wrong object/route; sunk -1 cm | ok | 22 cm × 25 cm × 22 cm | rule /(flask\|tub\|jar\|bottle\|canister\|can\|dru/ |
| A jug of binder-jet liquid binder | machines.js | generic fallback | ok | 17 cm × 30 cm × 11 cm | rule /\bglue\b\|epoxy\|caulk\|silicone\|sealant\|/ |
| A spool of 316L stainless welding wire | machines.js | okfloating 7 cm | ok | 18 cm × 6 cm × 18 cm | rule /welding wire\|mig wire\|er70s-6\|er4043.*/ |
| A cylinder of argon shielding gas | machines.js | ok | ok | 14 cm × 85 cm × 14 cm | rule /shielding gas\|gas cylinder\|argon\|\bco2/ |
| An auto-darkening welding helmet | machines.js | okfloating 4 cm | ok | 42 cm × 27 cm × 21 cm | rule /welding (hood\|helmet\|mask)\|auto-?darke/ |
| A 10 kg flask of Ti-6Al-4V titanium powder | machines.js | wrong object/route; sunk -1 cm | ok | 14 cm × 27 cm × 14 cm | rule /(flask\|tub\|jar\|bottle\|canister\|can\|dru/ |
| A ream of LOM paper sheets | machines.js | generic fallback | ok | 28 cm × 5 cm × 22 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A bottle of LOM adhesive | machines.js | wrong object/route | ok | 7 cm × 19 cm × 7 cm | rule /^(an? )?(jar\|bottle\|flask\|tub\|tin\|vial/ |
| A pack of LOM knife blades | machines.js | wrong object/route | ok | 10 cm × 1 cm × 3 cm | rule /knife blades\|blade pack\|utility blades/ |
| A bag of glass bead blasting media | machines.js | wrong object/route; sunk -1 cm | ok | 45 cm × 10 cm × 30 cm | rule /^(?!.*\b(bolts\|nuts\|screws\|washers\|nai/ |
| A set of carbide end mills | machines.js | generic fallback | ok | 20 cm × 9 cm × 6 cm | rule /end ?mills?\|router bits?\|milling bits?/ |
| A 60-degree V-bit | machines.js | generic fallback | ok | 1 cm × 6 cm × 1 cm | rule /end ?mills?\|router bits?\|milling bits?/ |
| A 1/4 inch compression bit | machines.js | generic fallback | ok | 1 cm × 7 cm × 1 cm | rule /end ?mills?\|router bits?\|milling bits?/ |
| A 3 inch face mill with carbide inserts | machines.js | generic fallback | ok | 8 cm × 8 cm × 8 cm | rule /end ?mills?\|router bits?\|milling bits?/ |
| A 4x8 sheet of Baltic birch plywood | machines.js | generic fallback | ok | 1.22 m × 3 cm × 61 cm | rule /plywood\|\bmdf\b\|\bosb\b\|drywall sheet\|/ |
| A 4x8 sheet of MDF | machines.js | generic fallback | ok | 1.22 m × 4 cm × 61 cm | rule /plywood\|\bmdf\b\|\bosb\b\|drywall sheet\|/ |
| A block of 6061 aluminium | machines.js | wrong object/route | ok | 15 cm × 5 cm × 10 cm | rule /(block\|billet\|bar\|slab\|chunk) of .*(al/ |
| A block of 1018 steel | machines.js | wrong object/route | ok | 15 cm × 5 cm × 10 cm | rule /(block\|billet\|bar\|slab\|chunk) of .*(al/ |
| A large bronze propeller casting | machines.js | wrong object/route; floating 1 cm | ok | 34 cm × 7 cm × 39 cm | rule /propeller\|impeller/ |
| A set of hold-down clamps | machines.js | wrong object/route | ok | 45 cm × 3 cm × 21 cm | rule /\bclamps?\b\|chisels?\|gouges\|\bfiles?\b/ |
| A sacrificial MDF spoilboard | machines.js | generic fallback | ok | 1.22 m × 4 cm × 61 cm | rule /plywood\|\bmdf\b\|\bosb\b\|drywall sheet\|/ |
| A vacuum table pump | machines.js | generic fallback | ok | 52 cm × 43 cm × 29 cm | rule /vacuum (table )?pump/ |
| A 6 inch Kurt machining vise | machines.js | generic fallback | ok | 18 cm × 17 cm × 35 cm | rule /bandsaw(?! blade)\|band saw(?! blade)\|\/ |
| A modular fixture plate set | machines.js | generic fallback | ok | 1.22 m × 3 cm × 61 cm | rule /plywood\|\bmdf\b\|\bosb\b\|drywall sheet\|/ |
| A 4 inch dust collection hose | machines.js | generic fallback; floating 1 cm | ok | 70 cm × 28 cm × 70 cm | rule /garden hose\|water hose\|\bhose\b(?!.*(c/ |
| A 5 gal pail of water-soluble coolant | machines.js | generic fallback; floating 9 cm | ok | 31 cm × 51 cm × 31 cm | rule /\b(5 ?gal(lon)?\|pail\|bucket) of\b/ |
| A pair of safety glasses | machines.js | wrong object/route | ok | 15 cm × 5 cm × 13 cm | rule /respirator\|gas mask\|dust mask\|ear (def/ |
| A pair of ear defenders | machines.js | generic fallback | ok | 21 cm × 17 cm × 8 cm | rule /respirator\|gas mask\|dust mask\|ear (def/ |
| A jar of SAC305 solder paste | machines.js | wrong object/route | ok | 6 cm × 5 cm × 6 cm | rule /^(an? )?(jar\|bottle\|flask\|tub\|tin\|vial/ |
| A laser-cut stainless stencil | machines.js | generic fallback | ok | 1.22 m × 3 cm × 61 cm | rule /plywood\|\bmdf\b\|\bosb\b\|drywall sheet\|/ |
| A kit of SMD component reels | machines.js | generic fallback | ok | 20 cm × 4 cm × 18 cm | rule /component reels\|smd reels\|reels? of (s/ |
| A pack of bare FR-4 circuit boards | machines.js | generic fallback | ok | 17 cm × 1 cm × 11 cm | rule /raspberry ?pi\|arduino\|esp32\|esp8266\|mi/ |
| A bottle of no-clean flux | machines.js | wrong object/route; sunk -1 cm | ok | 9 cm × 13 cm × 9 cm | rule /^(an? )?(jar\|bottle\|flask\|tub\|tin\|vial/ |
| A bar of SAC305 wave solder | machines.js | generic fallback; floating 4 cm | ok | 20 cm × 16 cm × 11 cm | rule /bar of .*solder\|solder bar/ |
| A sheet of clear acrylic | machines.js | generic fallback | ok | 1.22 m × 1 cm × 61 cm | rule /plywood\|\bmdf\b\|\bosb\b\|drywall sheet\|/ |
| A set of PCB milling bits | machines.js | wrong object/route | ok | 20 cm × 9 cm × 6 cm | rule /end ?mills?\|router bits?\|milling bits?/ |
| An ESD wrist strap | machines.js | generic fallback | ok | 25 cm × 2 cm × 10 cm | rule /respirator\|gas mask\|dust mask\|ear (def/ |
| A 5 L jug of 5W-30 engine oil | machines.js | wrong object/route; floating 1 cm | ok | 17 cm × 30 cm × 11 cm | rule /\bglue\b\|epoxy\|caulk\|silicone\|sealant\|/ |
| An oil filter | machines.js | generic fallback | ok | 8 cm × 9 cm × 8 cm | rule /sprocket\|roller chain\|\bchain\b(?!saw\|/ |
| A set of brake pads | machines.js | generic fallback | ok | 25 cm × 2 cm × 5 cm | rule /sprocket\|roller chain\|\bchain\b(?!saw\|/ |
| A set of four truck tires | machines.js | wrong object/route | ok | 44 cm × 66 cm × 66 cm | rule /\btyres?\b\|\btires?\b(?! chains)\|caste/ |
| A box of wheel weights | machines.js | generic fallback | ok | 20 cm × 10 cm × 14 cm | rule /\b(box\|carton\|case\|pack\|packet) of\b/ |
| A can of brake cleaner | machines.js | generic fallback | ok | 7 cm × 27 cm × 7 cm | rule /spray ?paint\|aerosol\|brake cleaner\|fix/ |
| A drum of parts washer solvent | machines.js | generic fallback | ok | 60 cm × 89 cm × 60 cm | rule /(drum\|barrel) of\|jerry ?can\|gas can\|fu/ |
| An engine gasket set | machines.js | wrong object/route; floating 1 cm | ok | 18 cm × 1 cm × 24 cm | rule /gaskets?\|o-rings?/ |
| A plasma torch consumables kit | machines.js | generic fallback | ok | 16 cm × 7 cm × 11 cm | rule /consumables kit\|rusty bolt\|\ba bolt\b/ |
| A sheet of 10-gauge steel plate | machines.js | generic fallback | ok | 1.22 m × 3 cm × 61 cm | rule /plywood\|\bmdf\b\|\bosb\b\|drywall sheet\|/ |
| A spool of ER70S-6 welding wire | machines.js | okfloating 7 cm | ok | 18 cm × 6 cm × 18 cm | rule /welding wire\|mig wire\|er70s-6\|er4043.*/ |
| A bottle of air tool oil | machines.js | wrong object/route | ok | 17 cm × 30 cm × 11 cm | rule /^(an? )?(jar\|bottle\|flask\|tub\|tin\|vial/ |
| A pair of jack stands | machines.js | generic fallback | ok | 51 cm × 49 cm × 19 cm | rule /jack stands?\|floor jack\|trolley jack/ |
| An excavator | mining.js | ok | ok | 44 cm × 24 cm × 17 cm | rule /excavator\|digger\|backhoe/ |
| A wooden field easel | paintstudio.js | generic fallback; floating 1 cm | ok | 67 cm × 1.61 m × 66 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A brush-rinsing water jar | paintstudio.js | ok | ok | 5 cm × 15 cm × 5 cm | rule /tank\|canister\|cylinder\|bottle\|jar\|flas/ |
| A set of artist oil paints (12 tubes) | paintstudio.js | wrong object/route | ok | 20 cm × 5 cm × 14 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A set of hog-bristle oil brushes | paintstudio.js | wrong object/route | ok | 10 cm × 27 cm × 10 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A pack of 3 stretched canvases (12x9 in) | paintstudio.js | generic fallback | ok | 33 cm × 23 cm × 9 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A bottle of linseed oil and odourless solvent | paintstudio.js | generic fallback | ok | 37 cm × 30 cm × 11 cm | LIST[rule /^(an? )?(jar\|bottle\|flask\|tub\|tin\|vial/ ; ru |
| A palette knife | paintstudio.js | wrong object/route | ok | 33 cm × 1 cm × 24 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A set of heavy-body acrylic paints | paintstudio.js | wrong object/route | ok | 20 cm × 5 cm × 14 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A set of synthetic flat brushes | paintstudio.js | wrong object/route | ok | 10 cm × 27 cm × 10 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A pack of 3 canvas panels (16x12 in) | paintstudio.js | wrong object/route | ok | 43 cm × 31 cm × 10 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A stay-wet palette | paintstudio.js | generic fallback | ok | 30 cm × 3 cm × 22 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A watercolour paint set (24 half pans) | paintstudio.js | wrong object/route | ok | 20 cm × 2 cm × 10 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A set of round watercolour brushes | paintstudio.js | wrong object/route | ok | 10 cm × 27 cm × 10 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A block of cold-press watercolour paper (20 sheets) | paintstudio.js | wrong object/route | ok | 30 cm × 1 cm × 23 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A set of gouache paints | paintstudio.js | wrong object/route | ok | 20 cm × 5 cm × 14 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A set of synthetic round brushes | paintstudio.js | wrong object/route | ok | 10 cm × 27 cm × 10 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A pad of hot-press gouache paper (12 sheets) | paintstudio.js | generic fallback | ok | 30 cm × 1 cm × 23 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A ceramic mixing palette | paintstudio.js | wrong object/route | ok | 33 cm × 1 cm × 24 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A box of soft pastels (48 sticks) | paintstudio.js | generic fallback; floating 4 cm | ok | 22 cm × 3 cm × 13 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A pad of tinted pastel paper (12 sheets) | paintstudio.js | generic fallback | ok | 30 cm × 1 cm × 23 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A set of blending stumps | paintstudio.js | generic fallback | ok | 5 cm × 2 cm × 13 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A can of workable fixative | paintstudio.js | generic fallback | ok | 7 cm × 27 cm × 7 cm | rule /spray ?paint\|aerosol\|brake cleaner\|fix/ |
| A bottle of sumi ink | paintstudio.js | wrong object/route | ok | 5 cm × 10 cm × 5 cm | rule /^(an? )?(jar\|bottle\|flask\|tub\|tin\|vial/ |
| A set of bamboo sumi-e brushes | paintstudio.js | wrong object/route | ok | 10 cm × 27 cm × 10 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A pad of xuan rice paper (30 sheets) | paintstudio.js | generic fallback | ok | 30 cm × 1 cm × 23 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A box of vine and compressed charcoal sticks | paintstudio.js | generic fallback | ok | 22 cm × 3 cm × 13 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A pad of drawing paper (30 sheets) | paintstudio.js | generic fallback | ok | 30 cm × 1 cm × 23 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A kneaded eraser | paintstudio.js | generic fallback | ok | 7 cm × 3 cm × 5 cm | rule /easel\|stretched canvas\|canvas(es\| pane/ |
| A slump cone test kit | plants.js | generic fallback | ok | 60 cm × 30 cm × 50 cm | rule /infrared thermometer\|ir thermometer\|sl/ |
| An infrared thermometer | plants.js | generic fallback; floating 1 cm | ok | 5 cm × 16 cm × 14 cm | rule /infrared thermometer\|ir thermometer\|sl/ |
| A set of concrete form boards and stakes | plants.js | generic fallback | ok | 2.44 m × 4 cm × 28 cm | rule /\b(2x4\|2x6\|2x8\|2 ?× ?4\|1x\d\|4x4\|6x6)\b/ |
| A concrete screed board and bull float | plants.js | generic fallback | ok | 3.34 m × 14 cm × 1.40 m | LIST[rule /screed\|bull float\|darby\|concrete float/ ; rule |
| A load of portland cement (5 t) | plants.js | wrong object/route | ok | 68 cm × 12 cm × 42 cm | rule /^(?!.*\b(bolts\|nuts\|screws\|washers\|nai/ |
| A load of washed concrete sand (10 t) | plants.js | wrong object/route; sunk -1 cm | ok | 4.09 m × 1.43 m × 4.09 m | rule /(\d+(\.\d+)?\s*t\b.*\bload\b\|\bload of/ |
| A load of 20 mm concrete stone (10 t) | plants.js | generic fallback; floating 1 cm | ok | 4.09 m × 1.43 m × 4.09 m | rule /(\d+(\.\d+)?\s*t\b.*\bload\b\|\bload of/ |
| A drum of water-reducing admixture (200 L) | plants.js | generic fallback; floating 1 cm | ok | 60 cm × 89 cm × 60 cm | rule /(drum\|barrel) of\|jerry ?can\|gas can\|fu/ |
| A load of 19 mm crushed asphalt aggregate (10 t) | plants.js | wrong object/route; sunk -2 cm | ok | 47 cm × 14 cm × 48 cm | rule /^(?!.*(shingle\|roof\|drum\|emulsion\|tank/ |
| A load of manufactured sand screenings (10 t) | plants.js | wrong object/route; sunk -1 cm | ok | 4.09 m × 1.43 m × 4.09 m | rule /(\d+(\.\d+)?\s*t\b.*\bload\b\|\bload of/ |
| A tanker of bitumen binder (PG 58-28, 10 t) | plants.js | generic fallback | ok | 34 cm × 51 cm × 17 cm | rule /(drum\|barrel) of\|jerry ?can\|gas can\|fu/ |
| A drum of burner diesel (200 L) | plants.js | generic fallback | ok | 60 cm × 89 cm × 60 cm | rule /(drum\|barrel) of\|jerry ?can\|gas can\|fu/ |
| A set of silo dust-collector filter cartridges | plants.js | generic fallback | ok | 25 cm × 9 cm × 8 cm | rule /sprocket\|roller chain\|\bchain\b(?!saw\|/ |
| A set of twin-shaft mixer paddles and liners | plants.js | generic fallback | ok | 90 cm × 2 cm × 2 cm | rule /sprocket\|roller chain\|\bchain\b(?!saw\|/ |
| A set of baghouse filter bags | plants.js | wrong object/route | ok | 1.20 m × 28 cm × 38 cm | rule /filter bags?\|baghouse/ |
| A burner service kit (nozzle, igniter and fuel filter) | plants.js | generic fallback | ok | 16 cm × 7 cm × 11 cm | rule /service kit\|repair kit\|tune.?up kit\|re/ |
| Cedar boards | projects.js | wrong object/route | ok | 2.44 m × 4 cm × 28 cm | rule /\b(2x4\|2x6\|2x8\|2 ?× ?4\|1x\d\|4x4\|6x6)\b/ |
| Oak planks | projects.js | wrong object/route | ok | 2.44 m × 4 cm × 28 cm | rule /\b(2x4\|2x6\|2x8\|2 ?× ?4\|1x\d\|4x4\|6x6)\b/ |
| A tin of wood stain | projects.js | generic fallback; floating 1 cm | ok | 9 cm × 13 cm × 9 cm | rule /^(an? )?(jar\|bottle\|flask\|tub\|tin\|vial/ |
| Bags of garden soil | projects.js | wrong object/route; sunk -1 cm | ok | 68 cm × 12 cm × 42 cm | rule /^(?!.*\b(bolts\|nuts\|screws\|washers\|nai/ |
| Copper pipes | projects.js | wrong object/route | ok | 1.20 m × 4 cm × 7 cm | rule /^(?!.*(paint\|glue\|caulk\|cream\|notcher)/ |
| A spool of fishing line | projects.js | wrong object/route | ok | 8 cm × 15 cm × 15 cm | rule /spool\|reel of\|\bwire\b(?!.*(stripper\|b/ |
| Pressure-treated 4x4 posts | projects.js | generic fallback | ok | 2.44 m × 9 cm × 18 cm | rule /\b(2x4\|2x6\|2x8\|2 ?× ?4\|1x\d\|4x4\|6x6)\b/ |
| A bag of carriage bolts | projects.js | wrong object/route; sunk -1 cm | ok | 12 cm × 3 cm × 16 cm | rule /\b(bolts?\|nuts\|nylock\|washers\|cotter p/ |
| A length of foam pipe insulation | projects.js | ok | ok | 44 cm × 6 cm × 17 cm | rule /bar stock\|steel bar\|rods?\b\|pipe\|tubin/ |
| Pressure-treated 2x8 joists | projects.js | generic fallback | ok | 2.44 m × 8 cm × 37 cm | rule /\b(2x4\|2x6\|2x8\|2 ?× ?4\|1x\d\|4x4\|6x6)\b/ |
| Cedar decking boards | projects.js | wrong object/route | ok | 2.44 m × 4 cm × 28 cm | rule /\b(2x4\|2x6\|2x8\|2 ?× ?4\|1x\d\|4x4\|6x6)\b/ |
| A box of structural lag screws | projects.js | generic fallback | ok | 12 cm × 7 cm × 15 cm | rule /\bbox(es)? of (\w+ )?(screws\|nails\|bol/ |
| A coil of rope | projects.js | wrong object/route; floating 1 cm | ok | 36 cm × 11 cm × 36 cm | rule /^(?!.*(jump\|skipping\|power\|extension\|e/ |
| A survey kit: total station, tripod and prism pole | roadworks.js | generic fallback | ok | 53 cm × 1.05 m × 40 cm | rule /total station\|survey(ing)? kit/ |
| A crawler bulldozer with a six-way blade | roadworks.js | ok | ok | 44 cm × 26 cm × 27 cm | rule /bull ?dozer\|crawler dozer/ |
| A motor grader with a 14 ft moldboard | roadworks.js | ok | ok | 44 cm × 17 cm × 20 cm | rule /motor grader\|road grader/ |
| A single-drum vibratory soil compactor | roadworks.js | ok | ok | 44 cm × 26 cm × 21 cm | rule /single.?drum\|soil compactor\|vibratory / |
| A tandem vibratory asphalt roller | roadworks.js | ok | ok | 44 cm × 30 cm × 17 cm | rule /tandem (vibratory )?(asphalt )?roller/ |
| A tracked asphalt paver with a heated screed | roadworks.js | ok | ok | 44 cm × 27 cm × 31 cm | rule /asphalt paver\|paving machine\|road pave/ |
| An asphalt distributor (emulsion sprayer cart) | roadworks.js | ok | ok | 89 cm × 65 cm × 63 cm | rule /asphalt distributor\|emulsion sprayer\|t/ |
| A walk-behind line striper (airless) | roadworks.js | ok | ok | 35 cm × 35 cm × 21 cm | rule /line striper\|striping machine\|line mar/ |
| A bundle of 100 wooden grade stakes and lath | roadworks.js | generic fallback | ok | 2.44 m × 8 cm × 18 cm | rule /\b(2x4\|2x6\|2x8\|2 ?× ?4\|1x\d\|4x4\|6x6)\b/ |
| A case of 12 cans of inverted marking paint | roadworks.js | wrong object/route | ok | 7 cm × 27 cm × 7 cm | rule /(case\|box\|pack) of .*(spray\|marking\|in/ |
| A corrugated HDPE culvert pipe, 450 mm × 6 m | roadworks.js | generic fallback | ok | 1.60 m × 51 cm × 51 cm | rule /culvert/ |
| A dump-truck load of crushed aggregate base course, 3/4 in. minus (15 t) | roadworks.js | generic fallback | ok | 4.68 m × 1.64 m × 4.68 m | rule /(\d+(\.\d+)?\s*t\b.*\bload\b\|\bload of/ |
| A 205 L drum of asphalt prime emulsion (MS-2 / SS-1h) | roadworks.js | wrong object/route | ok | 60 cm × 89 cm × 60 cm | rule /(drum\|barrel) of\|jerry ?can\|gas can\|fu/ |
| A 5 gal pail of yellow traffic paint | roadworks.js | ok | ok | 19 cm × 24 cm × 19 cm | rule /yellow traffic paint/ |
| A 5 gal pail of white traffic paint | roadworks.js | wrong object/route | ok | 19 cm × 24 cm × 19 cm | rule /^(?!.*drum).*(white traffic paint\|prim/ |
| A 30 t load of runway-mix coarse aggregate | roadworks.js | generic fallback | ok | 5.89 m × 2.06 m × 5.89 m | rule /(\d+(\.\d+)?\s*t\b.*\bload\b\|\bload of/ |
| A 30 t load of runway-mix fine aggregate (crusher dust) | roadworks.js | generic fallback | ok | 5.89 m × 2.06 m × 5.89 m | rule /(\d+(\.\d+)?\s*t\b.*\bload\b\|\bload of/ |
| A 30 t tanker of polymer-modified runway binder | roadworks.js | wrong object/route | ok | 34 cm × 51 cm × 17 cm | rule /(drum\|barrel) of\|jerry ?can\|gas can\|fu/ |
| An elevated LED runway edge light (white) | roadworks.js | generic fallback; floating 1 cm | ok | 14 cm × 41 cm × 14 cm | rule /runway (edge \|threshold )?light\|thresh/ |
| A runway threshold and end light (green / red) | roadworks.js | generic fallback | ok | 14 cm × 41 cm × 14 cm | rule /runway (edge \|threshold )?light\|thresh/ |
| A lighted runway designation sign | roadworks.js | generic fallback | ok | 1.20 m × 78 cm × 20 cm | rule /runway (edge \|threshold )?light\|thresh/ |
| A lit windsock on an 18 ft mast | roadworks.js | generic fallback | ok | 1.61 m × 5.98 m × 46 cm | rule /runway (edge \|threshold )?light\|thresh/ |
| A 50 lb bag of reflective glass beads | roadworks.js | wrong object/route; sunk -1 cm | ok | 68 cm × 12 cm × 42 cm | rule /^(?!.*\b(bolts\|nuts\|screws\|washers\|nai/ |
| A snowmobile trailer with a tilt deck | trips.js | ok | ok | 44 cm × 17 cm × 18 cm | rule /^(?!.*hitch).*(trailer\|low-?boy\|low-?b/ |
| A boat trailer | trips.js | ok | ok | 44 cm × 16 cm × 16 cm | rule /^(?!.*hitch).*(trailer\|low-?boy\|low-?b/ |
| A lowboy trailer for hauling the excavator | trips.js | ok | ok | 44 cm × 12 cm × 15 cm | rule /^(?!.*hitch).*(trailer\|low-?boy\|low-?b/ |
| A welding hood with an auto-darkening lens | welding.js | okfloating 4 cm | ok | 42 cm × 27 cm × 21 cm | rule /welding (hood\|helmet\|mask)\|auto-?darke/ |
| A pair of leather welding gloves | welding.js | ok | ok | 31 cm × 3 cm × 28 cm | rule /welding (gloves\|gauntlets)\|welder'?s g/ |
| A 75/25 argon-CO2 shielding gas cylinder | welding.js | ok | ok | 14 cm × 85 cm × 14 cm | rule /shielding gas\|gas cylinder\|argon\|\bco2/ |
| A spool of ER70S-6 MIG wire (0.030 inch) | welding.js | okfloating 7 cm | ok | 18 cm × 6 cm × 18 cm | rule /welding wire\|mig wire\|er70s-6\|er4043.*/ |
| A 100% argon shielding gas cylinder | welding.js | ok | ok | 14 cm × 85 cm × 14 cm | rule /shielding gas\|gas cylinder\|argon\|\bco2/ |
| A spool of ER4043 aluminium MIG wire | welding.js | okfloating 7 cm | ok | 18 cm × 6 cm × 18 cm | rule /welding wire\|mig wire\|er70s-6\|er4043.*/ |
| A tri-mix (helium-argon-CO2) shielding gas cylinder | welding.js | ok | ok | 14 cm × 85 cm × 14 cm | rule /shielding gas\|gas cylinder\|argon\|\bco2/ |
| A spool of ER308L stainless MIG wire | welding.js | okfloating 7 cm | ok | 18 cm × 6 cm × 18 cm | rule /welding wire\|mig wire\|er70s-6\|er4043.*/ |
| A pack of 2% lanthanated tungsten electrodes | welding.js | ok | ok | 7 cm × 5 cm × 21 cm | rule /tungsten\|filler rods?\|tig rods?\|electr/ |
| A tube of ER70S-2 TIG filler rods | welding.js | ok | ok | 12 cm × 5 cm × 45 cm | rule /tungsten\|filler rods?\|tig rods?\|electr/ |
| A tube of ER4043 aluminium TIG filler rods | welding.js | ok | ok | 12 cm × 5 cm × 45 cm | rule /tungsten\|filler rods?\|tig rods?\|electr/ |
| A tube of ER308L stainless TIG filler rods | welding.js | ok | ok | 12 cm × 5 cm × 45 cm | rule /tungsten\|filler rods?\|tig rods?\|electr/ |
| A box of E7018 stick electrodes | welding.js | ok | ok | 12 cm × 5 cm × 45 cm | rule /tungsten\|filler rods?\|tig rods?\|electr/ |
| A box of aluminium stick electrodes (E4043) | welding.js | ok | ok | 12 cm × 5 cm × 45 cm | rule /tungsten\|filler rods?\|tig rods?\|electr/ |
| A box of E308L-16 stainless electrodes | welding.js | ok | ok | 12 cm × 5 cm × 45 cm | rule /tungsten\|filler rods?\|tig rods?\|electr/ |
| A stack of rough-sawn maple lumber | woodshop.js | wrong object/route | ok | 2.44 m × 8 cm × 18 cm | rule /\b(2x4\|2x6\|2x8\|2 ?× ?4\|1x\d\|4x4\|6x6)\b/ |
| A bottle of wood glue | woodshop.js | wrong object/route | ok | 7 cm × 19 cm × 7 cm | rule /^(an? )?(jar\|bottle\|flask\|tub\|tin\|vial/ |
| A pack of sandpaper (80 to 220 grit) | woodshop.js | wrong object/route; sunk -1 cm | ok | 26 cm × 3 cm × 31 cm | rule /sandpaper\|sanding (sheets\|discs\|paper)/ |
| A can of wipe-on polyurethane | woodshop.js | generic fallback | ok | 17 cm × 28 cm × 17 cm | rule /(cans?\|tins?\|gallons?\|quarts?\|pails?\|b/ |
| A set of push sticks and a push block | woodshop.js | generic fallback | ok | 32 cm × 11 cm × 19 cm | rule /push sticks?\|push block/ |
| A cherry bowl blank | woodshop.js | wrong object/route | ok | 25 cm × 8 cm × 26 cm | rule /bowl blank\|turning blank\|pen blanks?\|\/ |
| A set of turning gouges | woodshop.js | generic fallback | ok | 32 cm × 3 cm × 16 cm | rule /\bclamps?\b\|chisels?\|gouges\|\bfiles?\b/ |
| A full face shield | woodshop.js | generic fallback | ok | 22 cm × 23 cm × 22 cm | rule /respirator\|gas mask\|dust mask\|ear (def/ |
| A roll of camera film | itemuse.js | wrong object/route | ok | 11 cm × 6 cm × 5 cm | rule /camera film\|roll of film\|film roll\|\b3/ |
| A spool of PETG filament | printer.js | ok | ok | 7 cm × 20 cm × 20 cm | rule /filament/ |
| A spool of TPU filament | printer.js | ok | ok | 7 cm × 20 cm × 20 cm | rule /filament/ |
| A spool of ABS filament | printer.js | ok | ok | 7 cm × 20 cm × 20 cm | rule /filament/ |
| A 3D printer | printer.js | ok | ok | 43 cm × 56 cm × 44 cm | rule /\b3-?d printer\b/ |
| A 3D-printed little tugboat | printer.js | ok | ok | 8 cm × 6 cm × 3 cm | rule /3-?d-printed/ |
| A 3D-printed wall hook | printer.js | ok | ok | 3 cm × 6 cm × 4 cm | rule /3-?d-printed/ |
| A 3D-printed spiral vase | printer.js | wrong object/route | ok | 10 cm × 12 cm × 10 cm | rule /3-?d-printed/ |
| A 3D-printed gear | printer.js | ok | ok | 8 cm × 1 cm × 8 cm | rule /3-?d-printed/ |
| A 3D-printed figurine of himself | printer.js | ok | ok | 5 cm × 11 cm × 3 cm | rule /3-?d-printed/ |
| A 3D-printed pencil cup | printer.js | ok | ok | 7 cm × 9 cm × 7 cm | rule /3-?d-printed/ |
| A 3D-printed star ornament | printer.js | ok | ok | 7 cm × 1 cm × 6 cm | rule /3-?d-printed/ |
| A 3D-printed phone stand | printer.js | ok | ok | 7 cm × 8 cm × 6 cm | rule /3-?d-printed/ |
| A 3D-printed whistle | printer.js | ok | ok | 7 cm × 2 cm × 2 cm | rule /3-?d-printed/ |
| A 3D-printed planter for a seedling | printer.js | ok | ok | 9 cm × 8 cm × 10 cm | rule /3-?d-printed/ |
| A bag of garden compost | plantcare.js | ok | ok | 19 cm × 30 cm × 10 cm | rule /fertili[sz]er\|compost\|bone ?meal\|blood/ |
| A box of bone meal | plantcare.js | ok | ok | 16 cm × 25 cm × 8 cm | rule /fertili[sz]er\|compost\|bone ?meal\|blood/ |
| A load of ready-mix concrete (2 m³) | plants.js | oksunk -2 cm | ok | 47 cm × 13 cm × 48 cm | rule /ready.?mix\|load of (fresh \|wet )?concr/ |
| A load of hot-mix asphalt (5 t) | plants.js | wrong object/route; sunk -2 cm | ok | 47 cm × 14 cm × 48 cm | rule /^(?!.*(shingle\|roof\|drum\|emulsion\|tank/ |
| A concrete mixer truck | plants.js | ok | ok | 44 cm × 17 cm × 16 cm | rule /concrete mixer truck\|cement mixer truc/ |
| Firewood logs | landscape.js | oksunk -2 cm | ok | 45 cm × 36 cm × 40 cm | rule /firewood\|\blogs?\b/ |
| A pair of cross-country skis | seasons.js | okfloating 1 cm | ok | 1.60 m × 12 cm × 42 cm | rule /\bskis?\b/ |
| A snowmobile | seasons.js | ok | ok | 44 cm × 16 cm × 14 cm | rule /snowmobile\|snow ?machine/ |
| An umbrella | weather.js | generic fallback | ok | 98 cm × 13 cm × 8 cm | rule /umbrella\|parasol/ |
| A pair of ice skates | weather.js | generic fallback | ok | 23 cm × 28 cm × 30 cm | rule /ice skates\|roller skates\|inline skates/ |
| A small rowboat | vehicles.js | wrong object/route; sunk -3 cm | ok | 36 cm × 8 cm × 44 cm | rule /canoe\|kayak\|boat\|\braft\b\|paddle ?boar/ |
| An electric workshop forklift | forklift.js | ok | ok | 44 cm × 35 cm × 18 cm | rule /fork ?lift\|lift truck/ |
| A new kite | wind.js | oksunk -23 cm | ok | 54 cm × 46 cm × 1.15 m | rule /kite/ |
| Broken kite | wind.js | oksunk -4 cm | ok | 42 cm × 20 cm × 73 cm | rule /broken kite/ |
| Torn balloon envelope | wind.js | oksunk -4 cm | ok | 1.21 m × 46 cm × 1.53 m | rule /torn balloon envelope/ |
| Bent burner frame | wind.js | oksunk -2 cm | ok | 1.18 m × 67 cm × 88 cm | rule /bent burner frame/ |
| Cracked wicker basket | wind.js | oksunk -2 cm | ok | 69 cm × 92 cm × 86 cm | rule /cracked wicker basket/ |
| A set of tire chains | trips.js | okfloating 1 cm | ok | 1.16 m × 11 cm × 66 cm | rule /tire chains\|tyre chains\|snow chains\|lo/ |
| A pickup truck with a tow hitch | trips.js | wrong object/route | ok | 44 cm × 18 cm × 17 cm | rule /^(?!.*\bhitch(es)? for\b).*(\bpick-?up/ |
| A trailer hitch for the pickup truck | trips.js | wrong object/route | ok | 40 cm × 15 cm × 10 cm | rule /trailer hitch\|tow hitch\|hitch ball\|bal/ |
| A trailer hitch for the dump truck | trips.js | wrong object/route | ok | 40 cm × 15 cm × 10 cm | rule /trailer hitch\|tow hitch\|hitch ball\|bal/ |
| A set of chains and load binders | trips.js | generic fallback | ok | 1.16 m × 11 cm × 66 cm | rule /tire chains\|tyre chains\|snow chains\|lo/ |
| A set of ratchet straps | trips.js | ok | ok | 78 cm × 28 cm × 14 cm | rule /ratchet straps?\|tie-?down straps?\|carg/ |
| Amethyst geode | mining.js | ok | ok | 12 cm × 12 cm × 8 cm | rule /geode\|amethyst\|garnet/ |
| Quartz crystal cluster | mining.js | ok | ok | 8 cm × 7 cm × 3 cm | rule /quartz\|crystal\|jade/ |
| Gold nugget | mining.js | wrong object/route; floating 2 cm | ok | 3 cm × 1 cm × 2 cm | rule /fossil\|trilobite\|ammonite\|petrified\|di/ |
| Ammonite fossil | mining.js | wrong object/route | ok | 19 cm × 5 cm × 16 cm | rule /fossil\|trilobite\|ammonite\|petrified\|di/ |
| Dinosaur rib bone | mining.js | wrong object/route | ok | 62 cm × 8 cm × 12 cm | rule /fossil\|trilobite\|ammonite\|petrified\|di/ |
| Old miner's lantern | mining.js | wrong object/route | ok | 15 cm × 30 cm × 15 cm | rule /^(?!.*(weld\|plasma\|propane\|blow ?torch/ |
| Meteorite fragment | mining.js | wrong object/route; sunk -1 cm | ok | 10 cm × 6 cm × 8 cm | rule /fossil\|trilobite\|ammonite\|petrified\|di/ |
| Jade pebble | mining.js | wrong object/route | ok | 5 cm × 2 cm × 4 cm | rule /mica\|river stone\|pebble\|\bstone\b(?!.*/ |
| Buried time capsule | mining.js | generic fallback | ok | 34 cm × 17 cm × 17 cm | rule /time capsule/ |
| Silver coin from 1898 | mining.js | wrong object/route; floating 2 cm | ok | 3 cm × 0 cm × 3 cm | rule /fossil\|trilobite\|ammonite\|petrified\|di/ |
| Trilobite fossil | mining.js | wrong object/route | ok | 19 cm × 5 cm × 16 cm | rule /fossil\|trilobite\|ammonite\|petrified\|di/ |
| Garnet vein sample | mining.js | ok | ok | 6 cm × 6 cm × 4 cm | rule /geode\|amethyst\|garnet/ |
| Petrified wood | mining.js | wrong object/route | ok | 20 cm × 16 cm × 16 cm | rule /fossil\|trilobite\|ammonite\|petrified\|di/ |
| Obsidian arrowhead | mining.js | wrong object/route; sunk -1 cm | ok | 4 cm × 1 cm × 6 cm | rule /fossil\|trilobite\|ammonite\|petrified\|di/ |
| an oddly round pebble | disposal.js | generic fallback | ok | 5 cm × 2 cm × 4 cm | rule /mica\|river stone\|pebble\|\bstone\b(?!.*/ |
| a rusty bolt | disposal.js | generic fallback | ok | 8 cm × 2 cm × 2 cm | rule /consumables kit\|rusty bolt\|\ba bolt\b/ |
| a smooth river stone | disposal.js | generic fallback; floating 1 cm | ok | 13 cm × 6 cm × 10 cm | rule /mica\|river stone\|pebble\|\bstone\b(?!.*/ |
| a chunk of mica that sparkles | disposal.js | generic fallback | ok | 9 cm × 5 cm × 7 cm | rule /mica\|river stone\|pebble\|\bstone\b(?!.*/ |
| an old bottle cap | disposal.js | wrong object/route | ok | 3 cm × 1 cm × 3 cm | rule /bottle caps?\|crown caps?/ |
| A cracked glass piece | glassstudio.js | wrong object/route | ok | 17 cm × 0 cm × 12 cm | rule /shards of\|broken glass\|cracked glass\|g/ |
| Snapped sturdy shovel | materials.js | oksunk -4 cm | LEFT: shown intact: broken variants keep the whole model | 25 cm × 1.13 m × 8 cm | rule /shovel\|spade/ |
| Bent sturdy shovel | materials.js | oksunk -4 cm | LEFT: shown intact: broken variants keep the whole model | 25 cm × 1.13 m × 8 cm | rule /shovel\|spade/ |
| Snapped claw hammer | materials.js | ok | LEFT: shown intact: broken variants keep the whole model | 26 cm × 35 cm × 5 cm | rule /hammer\|mallet/ |
| Shards of hand-blown glass vase | materials.js | wrong object/route | ok | 17 cm × 0 cm × 12 cm | rule /shards of\|broken glass\|cracked glass\|g/ |
| sturdy shovel | materials.js | oksunk -4 cm | ok | 25 cm × 1.13 m × 8 cm | rule /shovel\|spade/ |
| An FDM-printed PETG bracket | additive.js | oksunk -1 cm | ok | 13 cm × 11 cm × 6 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| An FDM-printed cable clip set | additive.js | ok | ok | 8 cm × 2 cm × 1 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| An FDM-printed go-kart dash mount | additive.js | ok | ok | 8 cm × 6 cm × 5 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| An SLA-printed resin miniature figure | additive.js | ok | ok | 6 cm × 8 cm × 6 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| An SLA-printed resin gear | additive.js | ok | ok | 15 cm × 2 cm × 15 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| An SLA-printed resin jewellery master | additive.js | ok | ok | 2 cm × 3 cm × 1 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A DLP-printed resin ring | additive.js | ok | ok | 2 cm × 3 cm × 1 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A DLP-printed resin micro gear | additive.js | ok | ok | 15 cm × 2 cm × 15 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| An MSLA-printed tabletop miniature | additive.js | ok | ok | 6 cm × 8 cm × 6 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| An MSLA-printed resin enclosure | additive.js | ok | ok | 12 cm × 4 cm × 8 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| An SLS-printed nylon hinge | additive.js | ok | ok | 8 cm × 1 cm × 3 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| An SLS-printed nylon drone arm | additive.js | ok | ok | 17 cm × 0 cm × 3 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| An SLS-printed nylon go-kart duct | additive.js | ok | ok | 18 cm × 10 cm × 10 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A DMLS-printed stainless steel bracket | additive.js | oksunk -1 cm | ok | 13 cm × 11 cm × 6 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A DMLS-printed stainless rocket nozzle | additive.js | ok | ok | 16 cm × 11 cm × 6 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A DMLS-printed stainless manifold | additive.js | ok | ok | 16 cm × 11 cm × 6 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| An MJF-printed nylon go-kart pedal | additive.js | ok | ok | 10 cm × 4 cm × 26 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| An MJF-printed nylon gear set | additive.js | ok | ok | 15 cm × 2 cm × 15 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| An MJF-printed nylon lattice insole | additive.js | ok | ok | 9 cm × 1 cm × 26 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A PolyJet-printed multi-colour prototype | additive.js | ok | ok | 12 cm × 4 cm × 8 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A PolyJet-printed clear enclosure | additive.js | ok | ok | 12 cm × 4 cm × 8 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A binder-jetted stainless impeller | additive.js | generic fallback | ok | 34 cm × 7 cm × 39 cm | rule /binder-jetted\|-printed\b\|-sintered\|-ma/ |
| A binder-jetted stainless gear | additive.js | generic fallback | ok | 15 cm × 2 cm × 15 cm | rule /binder-jetted\|-printed\b\|-sintered\|-ma/ |
| A DED-built stainless turbine blade | additive.js | ok | ok | 16 cm × 11 cm × 6 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A DED-built stainless flange | additive.js | ok | ok | 10 cm × 4 cm × 8 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| An EBM-printed titanium lattice bracket | additive.js | oksunk -1 cm | ok | 13 cm × 11 cm × 6 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| An EBM-printed titanium implant cup | additive.js | ok | ok | 5 cm × 3 cm × 5 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A LOM-built paper architectural model | additive.js | ok | ok | 30 cm × 13 cm × 20 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A LOM-built laminated mold pattern | additive.js | ok | ok | 20 cm × 4 cm × 15 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| An Avid-routed plywood sign | cnc.js | ok | ok | 60 cm × 2 cm × 30 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| An Avid-routed plywood go-kart seat back | cnc.js | ok | ok | 40 cm × 45 cm × 8 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| An Avid-routed plywood workbench top | cnc.js | ok | ok | 1.50 m × 8 cm × 70 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| An Avid-routed plywood kayak rack | cnc.js | ok | ok | 90 cm × 1.20 m × 58 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| An AltMill-routed MDF cabinet door | cnc.js | ok | ok | 40 cm × 60 cm × 4 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| An AltMill-routed MDF speaker baffle | cnc.js | ok | ok | 24 cm × 36 cm × 2 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A ShopSaber-routed plywood shelving set | cnc.js | ok | ok | 80 cm × 1.80 m × 30 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A ShopSaber-routed plywood go-kart floor pan | cnc.js | ok | ok | 60 cm × 1 cm × 50 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A Laguna-routed plywood cabinet carcass | cnc.js | ok | ok | 62 cm × 70 cm × 50 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A Laguna-routed plywood shop sign | cnc.js | ok | ok | 60 cm × 2 cm × 30 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A Haas-machined aluminium bracket | cnc.js | oksunk -1 cm | ok | 13 cm × 11 cm × 6 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A Haas-machined aluminium go-kart pedal | cnc.js | ok | ok | 10 cm × 4 cm × 26 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A Haas-machined steel go-kart spindle | cnc.js | ok | ok | 10 cm × 4 cm × 26 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A Haas-machined aluminium mold plate | cnc.js | ok | ok | 20 cm × 4 cm × 15 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A Haas-machined aluminium drone frame plate | cnc.js | ok | ok | 17 cm × 0 cm × 15 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A Taurus-machined bronze ship propeller | cnc.js | ok | ok | 34 cm × 7 cm × 39 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A Taurus-machined aluminium wing spar | cnc.js | ok | ok | 16 cm × 11 cm × 6 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A PCB-milled prototype board | electronics.js | ok | ok | 10 cm × 1 cm × 7 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A laser-cut acrylic sign | electronics.js | generic fallback | ok | 40 cm × 21 cm × 6 cm | rule /(acrylic\|wooden\|routed\|laser-cut\|metal/ |
| A laser-cut acrylic front panel | electronics.js | wrong object/route | ok | 30 cm × 12 cm × 1 cm | rule /binder-jetted\|-printed\b\|-sintered\|-ma/ |
| A homemade weather station | electronics.js | ok | ok | 14 cm × 54 cm × 14 cm | rule /homemade (weather station\|fm radio\|rad/ |
| A homemade FM radio | electronics.js | okfloating 24 cm | ok | 49 cm × 49 cm × 50 cm | glb boombox.glb \| rule /homemade (weather station\|fm radio |
| A homemade robot-friend controller | electronics.js | ok | ok | 12 cm × 6 cm × 8 cm | rule /homemade (weather station\|fm radio\|rad/ |
| A homemade game console | electronics.js | ok | ok | 18 cm × 4 cm × 8 cm | rule /homemade (weather station\|fm radio\|rad/ |
| A plasma-cut steel bracket | garage.js | oksunk -1 cm | ok | 13 cm × 11 cm × 6 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A plasma-cut steel go-kart frame gusset | garage.js | ok | ok | 10 cm × 1 cm × 10 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A handmade maple side table | woodshop.js | generic fallback | ok | 50 cm × 60 cm × 45 cm | rule /book ?(case\|shelf)\|bookshelves\|shelvin/ |
| A dovetailed walnut box | woodshop.js | generic fallback | ok | 26 cm × 13 cm × 17 cm | rule /dovetail(ed)?.*\bbox\b\|wooden box\|keep/ |
| A handmade cherry wall shelf | woodshop.js | ok | ok | 60 cm × 17 cm × 19 cm | rule /\b(handmade\|wooden\|floating\|wall) (woo/ |
| A turned cherry bowl | woodshop.js | wrong object/route | ok | 24 cm × 7 cm × 24 cm | rule /\b(turned\|carved\|wooden\|walnut\|cherry\|/ |
| A hand-blown glass vase | glassstudio.js | wrong object/route | ok | 14 cm × 28 cm × 14 cm | rule /^(?!.*shards).*(\bglass vase\b\|hand-?b/ |
| A hand-blown glass bowl | glassstudio.js | ok | ok | 22 cm × 7 cm × 22 cm | rule /\bglass bowl\b\|hand-?blown (glass )?bo/ |
| A hand-blown glass ornament | glassstudio.js | ok | ok | 10 cm × 11 cm × 10 cm | rule /\bglass ornament\b\|hand-?blown (glass / |
| A hand-blown glass cup | glassstudio.js | ok | ok | 9 cm × 10 cm × 9 cm | rule /\bglass (cup\|tumbler\|mug)\b\|hand-?blow/ |
| A handmade maple stool | shopmaker.js | ok | ok | 38 cm × 48 cm × 38 cm | rule /\b(stool\|chair)\b(?!.*(seat back\|lift)/ |
| A handmade oak bookcase | shopmaker.js | wrong object/route | ok | 80 cm × 1.80 m × 30 cm | rule /book ?(case\|shelf)\|bookshelves\|shelvin/ |
| A handmade pine birdhouse | shopmaker.js | wrong object/route | ok | 26 cm × 21 cm × 18 cm | rule /pigeon\|bird/ |
| A turned cherry mug | shopmaker.js | wrong object/route | ok | 13 cm × 10 cm × 9 cm | rule /\bmugs?\b\|coffee cup\|\b(ceramic\|camp\|e/ |
| A hand-blown glass mug | shopmaker.js | ok | ok | 9 cm × 10 cm × 9 cm | rule /\bglass (cup\|tumbler\|mug)\b\|hand-?blow/ |
| A turned maple spinning top | shopmaker.js | ok | ok | 10 cm × 9 cm × 10 cm | rule /spinning top\|\btop\b/ |
| A handmade oak coat rack | shopmaker.js | generic fallback; floating 1 cm | ok | 44 cm × 1.77 m × 50 cm | rule /book ?(case\|shelf)\|bookshelves\|shelvin/ |
| A home-built table lamp | shopmaker.js | ok | ok | 31 cm × 50 cm × 32 cm | glb table-lamp.glb \| rule /\b(table\|desk\|bedside\|handmad |
| A hand-blown glass paperweight | shopmaker.js | wrong object/route | ok | 8 cm × 3 cm × 8 cm | rule /paperweight/ |
| An Avid-routed plywood coaster | shopmaker.js | ok | ok | 11 cm × 2 cm × 10 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A laser-cut acrylic coaster | shopmaker.js | generic fallback | ok | 11 cm × 2 cm × 10 cm | rule /coaster/ |
| A home-built bird feeder | shopmaker.js | wrong object/route; floating 1 cm | ok | 14 cm × 34 cm × 14 cm | rule /bird ?feeder/ |
| A handmade maple wall shelf | shopmaker.js | ok | ok | 60 cm × 17 cm × 19 cm | rule /\b(handmade\|wooden\|floating\|wall) (woo/ |
| A handmade walnut footstool | shopmaker.js | wrong object/route | ok | 38 cm × 48 cm × 38 cm | rule /footstool\|foot stool\|step stool(?!.*la/ |
| An FDM-printed PLA phone stand | shopmaker.js | ok | ok | 8 cm × 10 cm × 7 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| An SLA-printed resin figurine | shopmaker.js | ok | ok | 6 cm × 8 cm × 6 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A plasma-cut steel fire pit | shopmaker.js | ok | ok | 76 cm × 32 cm × 76 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| A PCB-milled controller | shopmaker.js | ok | ok | 10 cm × 1 cm × 7 cm | rule /\b(fdm\|sla\|dlp\|msla\|sls\|dmls\|mjf\|polyj/ |
| #8 x 3/4 in. wood screws | shopmaker.js | generic fallback; floating 1 cm | ok | 12 cm × 7 cm × 15 cm | rule /\bbox(es)? of (\w+ )?(screws\|nails\|bol/ |
| Two-part epoxy | shopmaker.js | generic fallback | ok | 8 cm × 1 cm × 30 cm | rule /\bglue\b\|epoxy\|caulk\|silicone\|sealant\|/ |
| A screwdriver | shopmaker.js | ok | ok | 5 cm × 26 cm × 5 cm | rule /screwdriver/ |
| Wire strippers | shopmaker.js | wrong object/route; floating 1 cm | ok | 29 cm × 3 cm × 13 cm | rule /pliers\|wire strippers\|wire cutters\|sid/ |
| light bulb | shopmaker.js | generic fallback | ok | 6 cm × 11 cm × 6 cm | rule /light ?bulbs?\|led bulbs?\|edison bulbs?/ |
| lamp socket | shopmaker.js | wrong object/route | ok | 12 cm × 8 cm × 5 cm | rule /^(?!.*(weld\|plasma\|propane\|blow ?torch/ |
| power cord with plug | shopmaker.js | generic fallback | ok | 17 cm × 2 cm × 12 cm | rule /\b(usb\|hdmi\|ethernet\|charging\|aux\|audi/ |
| inline switch | shopmaker.js | generic fallback | ok | 10 cm × 4 cm × 13 cm | rule /speaker driver\|potentiometers?\|pickups/ |
| AA batteries | shopmaker.js | generic fallback | ok | 7 cm × 2 cm × 7 cm | rule /^(?!.*charger).*(\b(aa\|aaa\|9 ?v\|c\|d)( / |
| small DC motor | shopmaker.js | okfloating 1 cm | ok | 30 cm × 18 cm × 18 cm | rule /motor\|engine\|generator\|turbine/ |
| speaker driver | shopmaker.js | generic fallback | ok | 17 cm × 6 cm × 17 cm | rule /speaker driver\|potentiometers?\|pickups/ |
| caster wheels | shopmaker.js | generic fallback | ok | 10 cm × 10 cm × 8 cm | rule /\btyres?\b\|\btires?\b(?! chains)\|caste/ |
| brass hinges | shopmaker.js | generic fallback; floating 1 cm | ok | 12 cm × 1 cm × 14 cm | rule /hinges?\b\|joist hangers?\|hurricane tie/ |
| magnets | shopmaker.js | generic fallback | ok | 2 cm × 2 cm × 2 cm | rule /sprocket\|roller chain\|\bchain\b(?!saw\|/ |
| springs | shopmaker.js | generic fallback; floating 1 cm | ok | 3 cm × 3 cm × 8 cm | rule /sprocket\|roller chain\|\bchain\b(?!saw\|/ |
| clock movement | shopmaker.js | generic fallback | ok | 6 cm × 4 cm × 9 cm | rule /speaker driver\|potentiometers?\|pickups/ |
| seat cushion fabric | shopmaker.js | generic fallback | ok | 1.12 m × 10 cm × 10 cm | rule /pillow\|cushion\|blanket\|quilt\|throw\b\|t/ |
| mirror glass | shopmaker.js | wrong object/route | ok | 50 cm × 70 cm × 10 cm | rule /^(?!.*(rear\|side\|telescope\|hand)).*\bm/ |
| guitar strings | shopmaker.js | wrong object/route | ok | 10 cm × 1 cm × 13 cm | rule /speaker driver\|potentiometers?\|pickups/ |
| Birdhouse | projects.js | ok | not shelved (build) | 53 cm × 33 cm × 53 cm | rule /treehouse\|cabin\|house\|observatory\|towe/ |
| Picnic table | projects.js | generic fallback | not shelved (build) | 1.13 m × 60 cm × 69 cm | FORM |
| Garden bench | projects.js | generic fallback | not shelved (build) | 1.38 m × 82 cm × 39 cm | FORM |
| Raised garden bed | projects.js | generic fallback | not shelved (build) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Bird feeder | projects.js | wrong object/route; floating 1 cm | not shelved (build) | 14 cm × 34 cm × 14 cm | rule /bird ?feeder/ |
| Wind chime | projects.js | generic fallback | not shelved (build) | 1.34 m × 2.66 m × 44 cm | FORM |
| Doghouse | projects.js | ok | not shelved (build) | 53 cm × 33 cm × 53 cm | rule /treehouse\|cabin\|house\|observatory\|towe/ |
| Kayak rack | projects.js | oksunk -3 cm | not shelved (build) | 36 cm × 8 cm × 44 cm | rule /canoe\|kayak\|boat\|raft\|paddle ?board/ |
| Treehouse platform | projects.js | ok | not shelved (build) | 53 cm × 33 cm × 53 cm | rule /treehouse\|cabin\|house\|observatory\|towe/ |
| Home-built ultralight airplane | bom.js | ok | not shelved (build) | 29 cm × 9 cm × 44 cm | rule /home-built ultralight airplane/ |
| Home-built go-kart | bom.js | ok | not shelved (build) | 44 cm × 15 cm × 39 cm | rule /home-built go-kart/ |
| Cedar-strip canoe | bom.js | okfloating 1 cm | not shelved (build) | 44 cm × 4 cm × 8 cm | rule /cedar-strip canoe/ |
| Garden shed | bom.js | generic fallback | not shelved (build) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Home-built FPV quadcopter | bom.js | wrong object/route; floating 2 cm | ok | 27 cm × 7 cm × 26 cm | rule /^(?!(parts kit\|tools for)).*home-built/ |
| Home-built electric guitar | bom.js | wrong object/route | ok | 1.19 m × 7 cm × 33 cm | rule /^(?!(parts kit\|tools for)).*home-built/ |
| Wooden sea kayak | bom.js | ok | not shelved (build) | 44 cm × 10 cm × 9 cm | rule /wooden sea kayak/ |
| Tree fort | bom.js | generic fallback | not shelved (build) | 1.18 m × 2.69 m × 1.24 m | FORM |
| TIG welder (AC/DC, 200 A) | bom.js | generic fallback | ok | 47 cm × 34 cm × 57 cm | rule /bandsaw(?! blade)\|band saw(?! blade)\|\/ |
| Metal-cutting bandsaw | bom.js | generic fallback; floating 1 cm | ok | 61 cm × 38 cm × 35 cm | rule /bandsaw(?! blade)\|band saw(?! blade)\|\/ |
| Tube notcher (hole-saw type) | bom.js | wrong object/route; floating 1 cm | ok | 18 cm × 17 cm × 35 cm | rule /tube notcher\|pipe notcher/ |
| Drill press | bom.js | wrong object/route | ok | 30 cm × 80 cm × 53 cm | rule /drill press/ |
| Pneumatic pop-rivet gun | bom.js | generic fallback | ok | 26 cm × 18 cm × 4 cm | rule /angle grinder\|jig ?saw(?! puzzle)\|circ/ |
| Cleco fasteners 1/8 in. (100) with cleco pliers | bom.js | wrong object/route | ok | 29 cm × 3 cm × 13 cm | rule /pliers\|wire strippers\|wire cutters\|sid/ |
| Torque wrench (inch-pounds) | bom.js | ok | ok | 38 cm × 2 cm × 7 cm | rule /wrench\|spanner/ |
| Combination wrench set (3/8–3/4 in.) | bom.js | wrong object/route | ok | 36 cm × 9 cm × 22 cm | rule /socket (and wrench )?set\|wrench set\|sp/ |
| Nicopress swaging tool | bom.js | wrong object/route | ok | 29 cm × 3 cm × 13 cm | rule /pliers\|wire strippers\|wire cutters\|sid/ |
| Safety-wire pliers | bom.js | wrong object/route; floating 1 cm | ok | 29 cm × 3 cm × 13 cm | rule /pliers\|wire strippers\|wire cutters\|sid/ |
| Calibrated fabric iron | bom.js | wrong object/route | ok | 26 cm × 15 cm × 10 cm | rule /fabric iron\|clothes iron\|steam iron\|^(/ |
| HVLP spray gun | bom.js | generic fallback | ok | 17 cm × 25 cm × 8 cm | rule /angle grinder\|jig ?saw(?! puzzle)\|circ/ |
| Ratcheting wire crimper | bom.js | wrong object/route; floating 1 cm | ok | 29 cm × 3 cm × 13 cm | rule /pliers\|wire strippers\|wire cutters\|sid/ |
| Digital multimeter | bom.js | generic fallback | ok | 14 cm × 4 cm × 21 cm | rule /multimeter\|voltmeter/ |
| Screwdriver set | bom.js | wrong object/route | ok | 36 cm × 9 cm × 22 cm | rule /socket (and wrench )?set\|wrench set\|sp/ |
| Aircraft weighing scales (3-pad) | bom.js | wrong object/route; sunk -3 cm | ok | 1.43 m × 8 cm × 90 cm | rule /weighing scales?\|\bscales\b(?! (model\|/ |
| MIG welder (140 A) | bom.js | generic fallback | ok | 47 cm × 34 cm × 57 cm | rule /bandsaw(?! blade)\|band saw(?! blade)\|\/ |
| Abrasive chop saw | bom.js | wrong object/route; floating 1 cm | ok | 45 cm × 47 cm × 37 cm | rule /table saw\|chop saw\|mitre saw\|miter saw/ |
| Angle grinder | bom.js | generic fallback | ok | 35 cm × 16 cm × 8 cm | rule /angle grinder\|jig ?saw(?! puzzle)\|circ/ |
| Cordless drill | bom.js | ok | ok | 34 cm × 25 cm × 8 cm | rule /drill/ |
| Socket and wrench set | bom.js | generic fallback | ok | 36 cm × 9 cm × 22 cm | rule /socket (and wrench )?set\|wrench set\|sp/ |
| Tape measure | bom.js | generic fallback | ok | 13 cm × 4 cm × 7 cm | rule /tape measure\|measuring tape/ |
| Table saw (for ripping strips) | bom.js | wrong object/route; floating 1 cm | ok | 65 cm × 39 cm × 55 cm | rule /table saw\|chop saw\|mitre saw\|miter saw/ |
| Jigsaw | bom.js | generic fallback | ok | 22 cm × 23 cm × 8 cm | rule /angle grinder\|jig ?saw(?! puzzle)\|circ/ |
| Block plane | bom.js | wrong object/route | ok | 16 cm × 7 cm × 5 cm | rule /(block\|hand\|jack\|smoothing\|bench\|rabbe/ |
| Staple gun | bom.js | generic fallback | ok | 20 cm × 22 cm × 4 cm | rule /angle grinder\|jig ?saw(?! puzzle)\|circ/ |
| Random-orbit sander | bom.js | wrong object/route; sunk -1 cm | ok | 14 cm × 13 cm × 23 cm | rule /angle grinder\|jig ?saw(?! puzzle)\|circ/ |
| Epoxy squeegees and roller | bom.js | generic fallback | ok | 8 cm × 1 cm × 30 cm | rule /\bglue\b\|epoxy\|caulk\|silicone\|sealant\|/ |
| Spring clamps (24) | bom.js | wrong object/route | ok | 45 cm × 3 cm × 21 cm | rule /\bclamps?\b\|chisels?\|gouges\|\bfiles?\b/ |
| Circular saw | bom.js | wrong object/route; floating 1 cm | LEFT: recognisable but rough (guard and motor read as one dark mass) | 30 cm × 24 cm × 20 cm | rule /angle grinder\|jig ?saw(?! puzzle)\|circ/ |
| Framing hammer | bom.js | ok | ok | 26 cm × 35 cm × 5 cm | rule /hammer\|mallet/ |
| 4 ft level | bom.js | generic fallback | ok | 1.20 m × 6 cm × 3 cm | rule /spirit level\|\blevel\b(?!.*(up\|meter))/ |
| Shovel | bom.js | oksunk -4 cm | ok | 25 cm × 1.13 m × 8 cm | rule /shovel\|spade/ |
| Hammer stapler | bom.js | ok | ok | 26 cm × 35 cm × 5 cm | rule /hammer\|mallet/ |
| Temperature-controlled soldering iron (60 W) | bom.js | wrong object/route | ok | 28 cm × 12 cm × 13 cm | rule /soldering (iron\|station)/ |
| Hex drivers 1.5, 2, 2.5 mm | bom.js | generic fallback | ok | 36 cm × 9 cm × 22 cm | rule /socket (and wrench )?set\|wrench set\|sp/ |
| Prop wrench | bom.js | ok | ok | 38 cm × 2 cm × 7 cm | rule /wrench\|spanner/ |
| LiPo balance charger | bom.js | generic fallback | ok | 17 cm × 3 cm × 12 cm | rule /\b(usb\|hdmi\|ethernet\|charging\|aux\|audi/ |
| Bandsaw | bom.js | generic fallback | ok | 43 cm × 80 cm × 30 cm | rule /bandsaw(?! blade)\|band saw(?! blade)\|\/ |
| Router with flush-trim bit | bom.js | generic fallback | ok | 22 cm × 23 cm × 15 cm | rule /angle grinder\|jig ?saw(?! puzzle)\|circ/ |
| Clamps (6) | bom.js | wrong object/route | ok | 45 cm × 3 cm × 21 cm | rule /\bclamps?\b\|chisels?\|gouges\|\bfiles?\b/ |
| Fret press or fret hammer | bom.js | ok | ok | 26 cm × 35 cm × 5 cm | rule /hammer\|mallet/ |
| Fret crowning file | bom.js | generic fallback | ok | 29 cm × 3 cm × 3 cm | rule /\bclamps?\b\|chisels?\|gouges\|\bfiles?\b/ |
| Soldering iron | bom.js | wrong object/route | ok | 28 cm × 12 cm × 13 cm | rule /soldering (iron\|station)/ |
| Strobe or clip-on tuner | bom.js | generic fallback | ok | 10 cm × 2 cm × 13 cm | rule /clip-?on tuner\|strobe (or clip-on )?tu/ |
| Pliers and wire cutters | bom.js | wrong object/route | ok | 63 cm × 3 cm × 13 cm | LIST[rule /pliers\|wire strippers\|wire cutters\|sid/ ; rule |
| Clamps (12) | bom.js | wrong object/route | ok | 45 cm × 3 cm × 21 cm | rule /\bclamps?\b\|chisels?\|gouges\|\bfiles?\b/ |
| Impact driver | bom.js | generic fallback | ok | 20 cm × 23 cm × 8 cm | rule /angle grinder\|jig ?saw(?! puzzle)\|circ/ |
| Drill with a 1-1/4 in. auger bit | bom.js | ok | ok | 34 cm × 25 cm × 8 cm | rule /drill/ |
| Socket wrench with 3/4 in. socket | bom.js | ok | ok | 38 cm × 2 cm × 7 cm | rule /wrench\|spanner/ |
| Fall-arrest harness and rope | bom.js | generic fallback | ok | 36 cm × 11 cm × 36 cm | rule /^(?!.*(jump\|skipping\|power\|extension\|e/ |
| 4130 chromoly tube 1 in. × 0.035 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| 4130 chromoly tube 7/8 in. × 0.035 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| 4130 chromoly tube 3/4 in. × 0.035 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| 4130 chromoly tube 5/8 in. × 0.035 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| 4130 steel sheet 0.063 in. (gussets and tabs) | bom.js | generic fallback | not shelved (parts-line) | 49 cm × 23 cm × 19 cm | LIST[INFERRED ; CATEGORY:thing] |
| 4130 wing-attach fittings (machined) | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| Aluminium firewall 0.025 in. | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| AN3-5A bolts | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| AN365-1032 nylock nuts | bom.js | generic fallback | not shelved (parts-line) | 26 cm × 5 cm × 26 cm | CATEGORY:food |
| AN960-10 washers | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| ER70S-2 TIG filler rod 1/16 in. | bom.js | ok | not shelved (parts-line) | 12 cm × 5 cm × 45 cm | rule /tungsten\|filler rods?\|tig rods?\|electr/ |
| Argon shielding gas (80 cu ft cylinder) | bom.js | ok | not shelved (parts-line) | 14 cm × 85 cm × 14 cm | rule /shielding gas\|gas cylinder\|argon\|\bco2/ |
| Linseed oil (inside the tubes) | bom.js | ok | not shelved (parts-line) | 20 cm × 12 cm × 7 cm | rule /seed packet\|seeds?\b/ |
| Epoxy primer for steel tube | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| Main gear legs, 4130 welded | bom.js | generic fallback | not shelved (parts-line) | 47 cm × 23 cm × 17 cm | LIST[INFERRED ; CATEGORY:thing] |
| Axles 3/4 in. 4130 | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Main wheels 6 in. with drum brakes | bom.js | generic fallback | not shelved (parts-line) | 25 cm × 25 cm × 4 cm | INFERRED |
| Tyres 15 × 6.00-6 with tubes | bom.js | generic fallback | not shelved (parts-line) | 25 cm × 25 cm × 4 cm | INFERRED |
| Bungee shock cord 5/8 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Steerable tailwheel assembly 6 in. | bom.js | generic fallback | not shelved (parts-line) | 25 cm × 25 cm × 4 cm | INFERRED |
| Tailwheel leaf spring | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 30 cm × 5 cm × 30 cm | INFERRED |
| Brake master cylinders | bom.js | ok | not shelved (parts-line) | 14 cm × 38 cm × 14 cm | rule /tank\|canister\|cylinder\|bottle\|jar\|flas/ |
| Nylon brake line 3/16 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| AN5-24A bolts (gear legs) | bom.js | generic fallback | not shelved (parts-line) | 25 cm × 25 cm × 4 cm | INFERRED |
| AN365-524 nylock nuts | bom.js | generic fallback | not shelved (parts-line) | 26 cm × 5 cm × 26 cm | CATEGORY:food |
| AN3-7A bolts | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| MS24665-132 cotter pins | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Brake fluid MIL-H-5606 | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Wheel-bearing grease | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 30 cm × 5 cm × 30 cm | INFERRED |
| 4130 chromoly tube 1/2 in. × 0.028 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Hinge fittings 4130 | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| Tail brace wires 1/8 in. with fork ends | bom.js | okfloating 1 cm | not shelved (parts-line) | 34 cm × 12 cm × 34 cm | rule /rope\|cable\|wire/ |
| AN155-8S turnbuckles | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| AN3-6A bolts | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Safety wire 0.032 in. | bom.js | okfloating 1 cm | not shelved (parts-line) | 34 cm × 12 cm × 34 cm | rule /rope\|cable\|wire/ |
| 6061-T6 aluminium spar tube 2 in. × 0.058 in. | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| Pre-formed 6061-T6 wing ribs | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| 2024-T3 aluminium sheet 0.016 in., 4 × 12 ft (leading edges) | bom.js | generic fallback | not shelved (parts-line) | 49 cm × 23 cm × 19 cm | LIST[INFERRED ; CATEGORY:thing] |
| Aluminium compression struts 3/4 in. | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| Drag and anti-drag wires 1/8 in. with fittings | bom.js | generic fallback | not shelved (parts-line) | 50 cm × 23 cm × 27 cm | LIST[CATEGORY:thing ; rule /rope\|cable\|wire/] |
| Wing-tip bows | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Flaperon frames (aluminium) | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| Streamlined 6061 lift struts | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Jury struts | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| 1/8 in. aluminium pop rivets | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| AN365-1032 nylock nuts (rib fittings and struts) | bom.js | generic fallback | not shelved (parts-line) | 46 cm × 23 cm × 19 cm | LIST[INFERRED ; CATEGORY:thing] |
| AN4-11A bolts (spar attach) | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| AN365-428 nylock nuts | bom.js | generic fallback | not shelved (parts-line) | 26 cm × 5 cm × 26 cm | CATEGORY:food |
| AN3-12A bolts (strut fittings) | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| AN960-416 washers | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Zinc-chromate primer (aerosol) | bom.js | ok | not shelved (parts-line) | 24 cm × 28 cm × 14 cm | rule /spray ?paint\|aerosol/ |
| Control stick (4130, with grip) | bom.js | generic fallback | not shelved (parts-line) | 56 cm × 23 cm × 17 cm | LIST[INFERRED ; CATEGORY:thing] |
| Torque tube 1-1/8 in. 4130 | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Rudder pedals | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Flaperon push-pull tubes 6061 3/4 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Rod-end bearings 3/8 in. (HM-6) | bom.js | ok | not shelved (parts-line) | 44 cm × 6 cm × 17 cm | rule /bar stock\|steel bar\|rods?\b\|pipe\|tubin/ |
| 7×19 galvanised control cable 1/8 in. | bom.js | okfloating 1 cm | not shelved (parts-line) | 34 cm × 12 cm × 34 cm | rule /rope\|cable\|wire/ |
| AN210-2A pulleys | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Throttle lever and cable | bom.js | generic fallback | not shelved (parts-line) | 50 cm × 23 cm × 27 cm | LIST[CATEGORY:thing ; rule /rope\|cable\|wire/] |
| Seat sling and 4-point harness | bom.js | generic fallback | not shelved (parts-line) | 52 cm × 23 cm × 17 cm | LIST[FORM ; CATEGORY:thing] |
| Nicopress sleeves 1/8 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| AN100-4 thimbles | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| AN3-10A bolts | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Ceconite 102 fabric | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Poly-Fiber finishing tape 2 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Rib-lacing cord | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Inspection rings | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 30 cm × 5 cm × 30 cm | INFERRED |
| Drain grommets | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Lexan windshield and windows 0.060 in. | bom.js | generic fallback | not shelved (parts-line) | 45 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:thing] |
| Poly-Tak fabric cement | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Poly-Brush sealer | bom.js | ok | not shelved (parts-line) | 31 cm × 5 cm × 19 cm | rule /paint\|watercolor\|brush/ |
| Poly-Spray UV block (silver) | bom.js | ok | not shelved (parts-line) | 10 cm × 6 cm × 8 cm | rule /puzzle\|cube\|block\|lego/ |
| Poly-Tone topcoat (Cub yellow) | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| MEK reducer | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| Rotax 582 engine (dual CDI, B gearbox 2.58:1) | bom.js | generic fallback | not shelved (parts-line) | 46 cm × 20 cm × 15 cm | LIST[rule /motor\|engine\|generator\|turbine/ ; INFERRED] |
| Engine mount, 4130 welded | bom.js | generic fallback | not shelved (parts-line) | 44 cm × 23 cm × 17 cm | LIST[rule /motor\|engine\|generator\|turbine/ ; CATEGORY:thi |
| Lord rubber mount isolators | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| 68 in. two-blade propeller | bom.js | okfloating 1 cm | not shelved (parts-line) | 34 cm × 12 cm × 34 cm | rule /rope\|cable\|wire/ |
| Propeller spinner 9 in. | bom.js | okfloating 1 cm | not shelved (parts-line) | 34 cm × 12 cm × 34 cm | rule /rope\|cable\|wire/ |
| Radiator (twin core) | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Coolant hose 1 in. | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 30 cm × 5 cm × 30 cm | INFERRED |
| Tuned exhaust with muffler | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Spark plugs NGK BR8ECS | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| M8 propeller bolts with lock nuts | bom.js | okfloating 1 cm | not shelved (parts-line) | 34 cm × 12 cm × 34 cm | rule /rope\|cable\|wire/ |
| AN5-14A bolts (engine mount) | bom.js | okfloating 1 cm | not shelved (parts-line) | 31 cm × 19 cm × 19 cm | rule /motor\|engine\|generator\|turbine/ |
| Worm-drive hose clamps | bom.js | ok | not shelved (parts-line) | 15 cm × 21 cm × 15 cm | rule /headlamp\|lamp\|lantern\|flashlight/ |
| Exhaust springs | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 30 cm × 5 cm × 30 cm | INFERRED |
| Engine coolant 50/50 | bom.js | okfloating 1 cm | not shelved (parts-line) | 31 cm × 19 cm × 19 cm | rule /motor\|engine\|generator\|turbine/ |
| Two-stroke injection oil | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Gearbox oil | bom.js | generic fallback | not shelved (parts-line) | 25 cm × 25 cm × 4 cm | INFERRED |
| Aluminium wing-root fuel tanks, 5 gal | bom.js | generic fallback | not shelved (parts-line) | 42 cm × 31 cm × 17 cm | LIST[rule /tank\|canister\|cylinder\|bottle\|jar\|flas/ ; CA |
| SAE J30R7 fuel hose 1/4 in. | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 30 cm × 5 cm × 30 cm | INFERRED |
| Fuel shutoff valve | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Gascolator (fuel filter) | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Mikuni pulse fuel pump | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Primer bulb | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Fuel sight gauges | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Fuel-hose clamps | bom.js | ok | not shelved (parts-line) | 15 cm × 21 cm × 15 cm | rule /headlamp\|lamp\|lantern\|flashlight/ |
| Premium unleaded fuel (91 octane) | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Airspeed indicator 0–100 mph, 2-1/4 in. | bom.js | generic fallback | not shelved (parts-line) | 45 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:thing] |
| Altimeter 2-1/4 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Tachometer (Rotax) | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Dual EGT gauge with probes | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Coolant-temperature gauge | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Compass | bom.js | ok | not shelved (parts-line) | 25 cm × 5 cm × 25 cm | rule /compass/ |
| Slip indicator | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Pitot tube | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Pitot-static tubing 3/16 in. | bom.js | ok | not shelved (parts-line) | 44 cm × 6 cm × 17 cm | rule /bar stock\|steel bar\|rods?\b\|pipe\|tubin/ |
| Instrument panel, 6061 0.063 in. | bom.js | generic fallback | not shelved (parts-line) | 49 cm × 23 cm × 17 cm | LIST[rule /solar\|panel/ ; CATEGORY:thing] |
| #6-32 panel screws | bom.js | ok | not shelved (parts-line) | 31 cm × 18 cm × 20 cm | rule /solar\|panel/ |
| #6-32 nylock nuts | bom.js | generic fallback | not shelved (parts-line) | 26 cm × 5 cm × 26 cm | CATEGORY:food |
| 12 V AGM battery, 9 Ah | bom.js | generic fallback | not shelved (parts-line) | 41 cm × 23 cm × 17 cm | LIST[rule /capacitor\|battery\|power cell\|power sup/ ; CATE |
| Battery master switch | bom.js | ok | not shelved (parts-line) | 11 cm × 23 cm × 11 cm | rule /capacitor\|battery\|power cell\|power sup/ |
| Ignition kill switches | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Starter solenoid | bom.js | ok | not shelved (parts-line) | 26 cm × 5 cm × 26 cm | rule /tart\|pie\|cobbler\|cake\|cookie/ |
| Rotax voltage regulator | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| 6-way blade fuse block | bom.js | ok | not shelved (parts-line) | 10 cm × 6 cm × 8 cm | rule /puzzle\|cube\|block\|lego/ |
| LED nav and strobe light set | bom.js | generic fallback | not shelved (parts-line) | 47 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; INFERRED] |
| Tefzel wire 18 AWG | bom.js | okfloating 1 cm | not shelved (parts-line) | 34 cm × 12 cm × 34 cm | rule /rope\|cable\|wire/ |
| Wire 10 AWG | bom.js | okfloating 1 cm | not shelved (parts-line) | 34 cm × 12 cm × 34 cm | rule /rope\|cable\|wire/ |
| Battery cable 4 AWG | bom.js | ok | not shelved (parts-line) | 11 cm × 23 cm × 11 cm | rule /capacitor\|battery\|power cell\|power sup/ |
| Crimp ring terminals | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 30 cm × 5 cm × 30 cm | INFERRED |
| Nylon cable ties | bom.js | okfloating 1 cm | not shelved (parts-line) | 34 cm × 12 cm × 34 cm | rule /rope\|cable\|wire/ |
| Heat-shrink tubing | bom.js | ok | not shelved (parts-line) | 44 cm × 6 cm × 17 cm | rule /bar stock\|steel bar\|rods?\b\|pipe\|tubin/ |
| DOM mild-steel tube 1 in. × 0.065 in. | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| DOM mild-steel tube 3/4 in. × 0.065 in. | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| Steel plate 3/16 in. (mounts) | bom.js | generic fallback | not shelved (parts-line) | 31 cm × 4 cm × 23 cm | INFERRED |
| 16-gauge steel floor pan | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| ER70S-6 MIG wire 0.030 in. | bom.js | okfloating 7 cm | not shelved (parts-line) | 18 cm × 6 cm × 18 cm | rule /welding wire\|mig wire\|er70s-6\|er4043.*/ |
| 75/25 argon-CO2 gas (40 cu ft) | bom.js | ok | not shelved (parts-line) | 14 cm × 85 cm × 14 cm | rule /shielding gas\|gas cylinder\|argon\|\bco2/ |
| Cut-off and flap discs | bom.js | generic fallback | not shelved (parts-line) | 47 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; INFERRED] |
| Rattle-can primer and enamel | bom.js | generic fallback | not shelved (parts-line) | 45 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:thing] |
| Steering wheel 11 in. with hub | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 30 cm × 5 cm × 30 cm | INFERRED |
| Steering shaft 3/4 in. | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 30 cm × 5 cm × 30 cm | INFERRED |
| Steering-shaft flange bearings | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 30 cm × 5 cm × 30 cm | INFERRED |
| Kingpin spindles (pair) | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Tie rods 5/16 in. | bom.js | ok | not shelved (parts-line) | 44 cm × 6 cm × 17 cm | rule /bar stock\|steel bar\|rods?\b\|pipe\|tubin/ |
| Heim joints 5/16 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Grade 8 bolts 5/16-18 | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Nylock nuts 5/16-18 | bom.js | generic fallback | not shelved (parts-line) | 26 cm × 5 cm × 26 cm | CATEGORY:food |
| Keyed live axle 1 in. × 36 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Pillow-block bearings 1 in. | bom.js | ok | not shelved (parts-line) | 10 cm × 6 cm × 8 cm | rule /puzzle\|cube\|block\|lego/ |
| Brake disc 6 in. with hub | bom.js | generic fallback | not shelved (parts-line) | 25 cm × 25 cm × 4 cm | INFERRED |
| Mechanical disc-brake caliper | bom.js | generic fallback | not shelved (parts-line) | 25 cm × 25 cm × 4 cm | INFERRED |
| Brake pedal and cable | bom.js | generic fallback | not shelved (parts-line) | 50 cm × 23 cm × 27 cm | LIST[CATEGORY:thing ; rule /rope\|cable\|wire/] |
| #35 sprocket 60-tooth with hub | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| Keyed wheel hubs 1 in. | bom.js | generic fallback | not shelved (parts-line) | 25 cm × 25 cm × 4 cm | INFERRED |
| Set screws 5/16 in. | bom.js | generic fallback | not shelved (parts-line) | 26 cm × 16 cm × 20 cm | INFERRED |
| Grade 8 bolts 3/8-16 | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Nylock nuts 3/8-16 | bom.js | generic fallback | not shelved (parts-line) | 26 cm × 5 cm × 26 cm | CATEGORY:food |
| Front tyres 10 × 4.50-5 on rims | bom.js | generic fallback | not shelved (parts-line) | 25 cm × 25 cm × 4 cm | INFERRED |
| Rear tyres 11 × 7.10-5 on rims | bom.js | generic fallback | not shelved (parts-line) | 25 cm × 25 cm × 4 cm | INFERRED |
| Front wheel bearings 5/8 in. | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 30 cm × 5 cm × 30 cm | INFERRED |
| Lug bolts 5/16 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Axle nuts and cotter pins | bom.js | generic fallback | not shelved (parts-line) | 43 cm × 23 cm × 17 cm | LIST[CATEGORY:food ; CATEGORY:thing] |
| 212 cc (6.5 hp) OHV engine | bom.js | okfloating 1 cm | not shelved (parts-line) | 31 cm × 19 cm × 19 cm | rule /motor\|engine\|generator\|turbine/ |
| Centrifugal clutch 3/4 in., 12-tooth #35 | bom.js | generic fallback | not shelved (parts-line) | 45 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:thing] |
| #35 roller chain | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Engine mount plate | bom.js | okfloating 1 cm | not shelved (parts-line) | 31 cm × 19 cm × 19 cm | rule /motor\|engine\|generator\|turbine/ |
| Throttle pedal and cable | bom.js | generic fallback | not shelved (parts-line) | 50 cm × 23 cm × 27 cm | LIST[CATEGORY:thing ; rule /rope\|cable\|wire/] |
| Chain guard | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Kill switch | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Grade 8 bolts 3/8-16 (engine) | bom.js | okfloating 1 cm | not shelved (parts-line) | 31 cm × 19 cm × 19 cm | rule /motor\|engine\|generator\|turbine/ |
| Engine oil 10W-30 | bom.js | okfloating 1 cm | not shelved (parts-line) | 31 cm × 19 cm × 19 cm | rule /motor\|engine\|generator\|turbine/ |
| Regular gasoline | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Moulded kart seat | bom.js | ok | not shelved (parts-line) | 19 cm × 15 cm × 10 cm | rule /ingot\|mold\|mould/ |
| Seat struts | bom.js | generic fallback | not shelved (parts-line) | 1.38 m × 82 cm × 39 cm | FORM |
| Front bumper and nerf bars | bom.js | generic fallback | not shelved (parts-line) | 45 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:thing] |
| M8 bolts with nylock nuts (seat) | bom.js | generic fallback | not shelved (parts-line) | 1.38 m × 82 cm × 39 cm | FORM |
| 3/4 in. plywood 4 × 8 ft (strongback) | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| 1/2 in. particleboard 4 × 8 ft (station molds) | bom.js | ok | not shelved (parts-line) | 19 cm × 15 cm × 10 cm | rule /ingot\|mold\|mould/ |
| 2 × 4 lumber 8 ft | bom.js | ok | not shelved (parts-line) | 38 cm × 6 cm × 32 cm | rule /dock\|pier\|plank\|cedar\|lumber\|timber/ |
| Drywall screws 1-5/8 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Packing tape (mold edges) | bom.js | ok | not shelved (parts-line) | 19 cm × 15 cm × 10 cm | rule /ingot\|mold\|mould/ |
| Western red cedar strips 1/4 × 3/4 in. bead-and-cove, 17 ft | bom.js | generic fallback | not shelved (parts-line) | 80 cm × 23 cm × 26 cm | LIST[rule /dock\|pier\|plank\|cedar\|lumber\|timber/ ; CATEG |
| Ash inner and outer stems | bom.js | generic fallback | not shelved (parts-line) | 45 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:thing] |
| Staples 9/16 in. (pulled later) | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Titebond III wood glue | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| 6 oz E-glass cloth 50 in. wide | bom.js | ok | not shelved (parts-line) | 29 cm × 25 cm × 8 cm | rule /glass/ |
| Fibreglass bias tape 3 in. | bom.js | ok | not shelved (parts-line) | 29 cm × 25 cm × 8 cm | rule /glass/ |
| Epoxy resin and hardener | bom.js | generic fallback | not shelved (parts-line) | 45 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:thing] |
| Sandpaper 80, 120 and 220 grit | bom.js | generic fallback; sunk -1 cm | not shelved (parts-line) | 75 cm × 28 cm × 17 cm | LIST[rule /flux\|powder\|sand\|salt\|flour\|substrate\|/ ; C |
| Ash gunwale strips 3/4 × 1 in., 17 ft | bom.js | generic fallback | not shelved (parts-line) | 45 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:thing] |
| Ash cane seats | bom.js | generic fallback | not shelved (parts-line) | 1.38 m × 82 cm × 39 cm | FORM |
| Ash carry yoke | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Ash thwarts | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Cherry deck plates | bom.js | ok | not shelved (parts-line) | 31 cm × 24 cm × 31 cm | rule /^(?!.*(pie\|tart\|cobbler\|cake\|jam\|muffi/ |
| Brass stem bands 3/8 in. | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| Silicon-bronze screws #8 × 1-1/4 in. | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| Stainless carriage bolts 3/16 in. with nuts | bom.js | generic fallback | not shelved (parts-line) | 26 cm × 5 cm × 26 cm | CATEGORY:food |
| Spar varnish (UV) | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Foam brushes | bom.js | ok | not shelved (parts-line) | 31 cm × 5 cm × 19 cm | rule /paint\|watercolor\|brush/ |
| Concrete deck blocks | bom.js | ok | not shelved (parts-line) | 10 cm × 6 cm × 8 cm | rule /puzzle\|cube\|block\|lego/ |
| Pressure-treated 4 × 4 skids, 10 ft | bom.js | generic fallback | not shelved (parts-line) | 45 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:thing] |
| 3/4 in. crushed gravel | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Pressure-treated 2 × 6 joists, 8 ft | bom.js | generic fallback | not shelved (parts-line) | 45 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:thing] |
| Pressure-treated 2 × 6 rim joists, 10 ft | bom.js | generic fallback | not shelved (parts-line) | 45 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:thing] |
| 3/4 in. tongue-and-groove plywood 4 × 8 | bom.js | generic fallback | not shelved (parts-line) | 46 cm × 23 cm × 19 cm | LIST[CATEGORY:thing ; INFERRED] |
| 16d galvanised framing nails | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Deck screws 1-5/8 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| 2 × 4 studs, 8 ft | bom.js | generic fallback | not shelved (parts-line) | 45 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:thing] |
| 2 × 4 plates, 10 ft | bom.js | generic fallback | not shelved (parts-line) | 49 cm × 23 cm × 19 cm | LIST[INFERRED ; CATEGORY:thing] |
| 2 × 6 door and window headers, 8 ft | bom.js | generic fallback | not shelved (parts-line) | 73 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:thing ; CATEGORY:thing] |
| 16d framing nails | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| 2 × 4 rafters, 8 ft | bom.js | generic fallback; sunk -2 cm | not shelved (parts-line) | 51 cm × 26 cm × 35 cm | LIST[rule /canoe\|kayak\|boat\|raft\|paddle ?board/ ; CATEGO |
| 2 × 6 ridge board, 10 ft | bom.js | generic fallback | not shelved (parts-line) | 49 cm × 23 cm × 19 cm | LIST[INFERRED ; CATEGORY:thing] |
| Hurricane ties | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Connector nails 1-1/2 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| 7/16 in. OSB sheathing 4 × 8 | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| #15 roofing felt | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Drip edge, 10 ft | bom.js | generic fallback | not shelved (parts-line) | 45 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:thing] |
| Asphalt shingles (bundles) | bom.js | oksunk -2 cm | not shelved (parts-line) | 47 cm × 14 cm × 48 cm | rule /asphalt\|blacktop\|tarmac/ |
| Ridge-cap shingles (bundle) | bom.js | generic fallback | not shelved (parts-line) | 1.80 m × 1.27 m × 1.65 m | FORM |
| Roofing nails 1-1/4 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| 8d sheathing nails | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| T1-11 siding panels 4 × 8 | bom.js | ok | not shelved (parts-line) | 31 cm × 18 cm × 20 cm | rule /solar\|panel/ |
| House wrap | bom.js | ok | not shelved (parts-line) | 53 cm × 33 cm × 53 cm | rule /treehouse\|cabin\|house\|observatory\|towe/ |
| 1 × 4 trim boards, 8 ft | bom.js | generic fallback | not shelved (parts-line) | 49 cm × 23 cm × 19 cm | LIST[INFERRED ; CATEGORY:thing] |
| Window 24 × 36 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Strap hinges 8 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Hasp and padlock | bom.js | generic fallback | not shelved (parts-line) | 45 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:thing] |
| 8d galvanised siding nails | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Exterior caulk | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Exterior primer | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Exterior paint (barn green) | bom.js | ok | not shelved (parts-line) | 31 cm × 5 cm × 19 cm | rule /paint\|watercolor\|brush/ |
| Trim paint (white) | bom.js | ok | not shelved (parts-line) | 31 cm × 5 cm × 19 cm | rule /paint\|watercolor\|brush/ |
| 5 in. carbon-fibre frame kit (220 mm) | bom.js | generic fallback | not shelved (parts-line) | 26 cm × 16 cm × 20 cm | INFERRED |
| M3 standoffs | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| M3 × 8 mm frame screws | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| M3 nylock nuts | bom.js | generic fallback | not shelved (parts-line) | 26 cm × 5 cm × 26 cm | CATEGORY:food |
| 2306 2450 KV brushless motors | bom.js | okfloating 1 cm | not shelved (parts-line) | 31 cm × 19 cm × 19 cm | rule /motor\|engine\|generator\|turbine/ |
| 4-in-1 45 A BLHeli_32 ESC | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| XT60 battery lead | bom.js | ok | not shelved (parts-line) | 11 cm × 23 cm × 11 cm | rule /capacitor\|battery\|power cell\|power sup/ |
| Low-ESR capacitor 35 V 1,000 µF | bom.js | generic fallback | not shelved (parts-line) | 41 cm × 23 cm × 17 cm | LIST[rule /capacitor\|battery\|power cell\|power sup/ ; CATE |
| 12 AWG silicone wire | bom.js | okfloating 1 cm | not shelved (parts-line) | 34 cm × 12 cm × 34 cm | rule /rope\|cable\|wire/ |
| M3 × 6 mm motor screws | bom.js | okfloating 1 cm | not shelved (parts-line) | 31 cm × 19 cm × 19 cm | rule /motor\|engine\|generator\|turbine/ |
| 60/40 rosin-core solder | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Flux pen | bom.js | oksunk -1 cm | not shelved (parts-line) | 25 cm × 35 cm × 20 cm | rule /flux\|powder\|sand\|salt\|flour\|substrate\|/ |
| F7 flight controller (30 × 30) | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Rubber soft-mount grommets | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| M3 nylon nuts | bom.js | generic fallback | not shelved (parts-line) | 26 cm × 5 cm × 26 cm | CATEGORY:food |
| ELRS 2.4 GHz receiver | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| ELRS radio transmitter | bom.js | okfloating 24 cm | not shelved (parts-line) | 49 cm × 49 cm × 50 cm | glb boombox.glb \| CATEGORY:thing |
| FPV camera (micro, 1200TVL) | bom.js | generic fallback | not shelved (parts-line) | 47 cm × 80 cm × 38 cm | LIST[glb antique-camera.glb \| CATEGORY:tool ; CATEGORY:thin |
| 5.8 GHz video transmitter 25–800 mW | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| RHCP antenna | bom.js | generic fallback | not shelved (parts-line) | 80 cm × 2.74 m × 80 cm | FORM |
| FPV goggles | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Zip ties | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| 4S LiPo 1,500 mAh 100C | bom.js | generic fallback | not shelved (parts-line) | 45 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:thing] |
| 5 × 4.3 × 3 tri-blade propellers | bom.js | okfloating 1 cm | not shelved (parts-line) | 34 cm × 12 cm × 34 cm | rule /rope\|cable\|wire/ |
| Battery straps | bom.js | ok | not shelved (parts-line) | 11 cm × 23 cm × 11 cm | rule /capacitor\|battery\|power cell\|power sup/ |
| M5 prop nuts | bom.js | generic fallback | not shelved (parts-line) | 26 cm × 5 cm × 26 cm | CATEGORY:food |
| Alder body blank 14 × 20 × 1-3/4 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| MDF body and routing templates | bom.js | generic fallback | not shelved (parts-line) | 49 cm × 23 cm × 19 cm | LIST[CATEGORY:thing ; INFERRED] |
| Double-sided tape | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Hard maple neck blank 1 × 3-1/2 × 26 in. | bom.js | generic fallback | not shelved (parts-line) | 1.18 m × 2.69 m × 1.24 m | FORM |
| Rosewood fingerboard, slotted 25.5 in., 9.5 in. radius | bom.js | generic fallback | not shelved (parts-line) | 77 cm × 23 cm × 19 cm | LIST[INFERRED ; CATEGORY:thing ; CATEGORY:thing] |
| Dual-action truss rod 18 in. | bom.js | ok | not shelved (parts-line) | 44 cm × 6 cm × 17 cm | rule /bar stock\|steel bar\|rods?\b\|pipe\|tubin/ |
| Pearl dot inlays 1/4 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Titebond wood glue | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| Medium-jumbo fret wire | bom.js | okfloating 1 cm | not shelved (parts-line) | 34 cm × 12 cm × 34 cm | rule /rope\|cable\|wire/ |
| Bone nut | bom.js | ok | not shelved (parts-line) | 33 cm × 8 cm × 34 cm | rule /fossil\|trilobite\|ammonite\|bone\|petrifi/ |
| Fret-end files and crowning (sandpaper 400–1,000) | bom.js | generic fallback; sunk -1 cm | not shelved (parts-line) | 73 cm × 28 cm × 17 cm | LIST[CATEGORY:thing ; rule /flux\|powder\|sand\|salt\|flour\ |
| Grain filler | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Sanding sealer (aerosol) | bom.js | ok | not shelved (parts-line) | 24 cm × 28 cm × 14 cm | rule /spray ?paint\|aerosol/ |
| Nitrocellulose lacquer, red (aerosol) | bom.js | generic fallback | not shelved (parts-line) | 51 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; rule /spray ?paint\|aerosol/] |
| Clear nitro lacquer (aerosol) | bom.js | ok | not shelved (parts-line) | 24 cm × 28 cm × 14 cm | rule /spray ?paint\|aerosol/ |
| Tru-Oil (neck) | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Sandpaper 320–2,000 grit | bom.js | generic fallback; sunk -1 cm | not shelved (parts-line) | 47 cm × 28 cm × 17 cm | LIST[rule /flux\|powder\|sand\|salt\|flour\|substrate\|/ ; C |
| Vintage tremolo bridge (6-screw) | bom.js | generic fallback | not shelved (parts-line) | 1.51 m × 2.14 m × 28 cm | FORM |
| Tuners (set of 6) | bom.js | generic fallback | not shelved (parts-line) | 26 cm × 16 cm × 20 cm | INFERRED |
| String trees | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 30 cm × 5 cm × 30 cm | INFERRED |
| Strap buttons | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Neck plate | bom.js | generic fallback | not shelved (parts-line) | 31 cm × 4 cm × 23 cm | INFERRED |
| Tremolo springs and claw | bom.js | generic fallback | not shelved (parts-line) | 49 cm × 23 cm × 24 cm | LIST[INFERRED ; CATEGORY:thing] |
| Neck bolts #8 × 2 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Bridge screws | bom.js | generic fallback | not shelved (parts-line) | 1.51 m × 2.14 m × 28 cm | FORM |
| Pickguard screws | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Single-coil pickups | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 30 cm × 5 cm × 30 cm | INFERRED |
| 5-way blade switch | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| 250 kΩ potentiometers | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| 0.022 µF tone capacitor | bom.js | ok | not shelved (parts-line) | 11 cm × 23 cm × 11 cm | rule /capacitor\|battery\|power cell\|power sup/ |
| Output jack and plate | bom.js | generic fallback | not shelved (parts-line) | 49 cm × 23 cm × 19 cm | LIST[CATEGORY:thing ; INFERRED] |
| Three-ply pickguard | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Cloth push-back wire 22 AWG | bom.js | okfloating 1 cm | not shelved (parts-line) | 34 cm × 12 cm × 34 cm | rule /rope\|cable\|wire/ |
| Copper shielding tape | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| Nickel strings 10–46 | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 30 cm × 5 cm × 30 cm | INFERRED |
| 4 mm okoume marine plywood 4 × 8 ft (BS1088) | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| Wood flour | bom.js | oksunk -1 cm | not shelved (parts-line) | 25 cm × 35 cm × 20 cm | rule /flux\|powder\|sand\|salt\|flour\|substrate\|/ |
| Copper stitching wire 18 AWG | bom.js | okfloating 1 cm | not shelved (parts-line) | 34 cm × 12 cm × 34 cm | rule /rope\|cable\|wire/ |
| Wire stitches (twisted) | bom.js | okfloating 1 cm | not shelved (parts-line) | 34 cm × 12 cm × 34 cm | rule /rope\|cable\|wire/ |
| 6 oz fibreglass cloth 50 in. | bom.js | ok | not shelved (parts-line) | 29 cm × 25 cm × 8 cm | rule /glass/ |
| Sandpaper 80–220 grit | bom.js | oksunk -1 cm | not shelved (parts-line) | 25 cm × 35 cm × 20 cm | rule /flux\|powder\|sand\|salt\|flour\|substrate\|/ |
| 3 mm okoume plywood 4 × 8 ft | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 23 cm × 23 cm × 23 cm | INFERRED |
| Deck beams 3/4 × 1-1/2 in. | bom.js | ok | not shelved (parts-line) | 44 cm × 6 cm × 17 cm | rule /bar stock\|steel bar\|rods?\b\|pipe\|tubin/ |
| Laminated cockpit coaming rings | bom.js | generic fallback; floating 1 cm | not shelved (parts-line) | 30 cm × 5 cm × 30 cm | INFERRED |
| 6 mm okoume bulkheads | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Hatch lids with lips | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Hatch straps | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Bungee cord 1/4 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Padeyes | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Foam seat and backband | bom.js | generic fallback | not shelved (parts-line) | 52 cm × 23 cm × 17 cm | LIST[FORM ; CATEGORY:thing] |
| Adjustable foot braces | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Carry toggles | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Stainless #8 screws | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Treehouse attachment bolts (TAB) 1-1/4 × 8 in. | bom.js | ok | not shelved (parts-line) | 53 cm × 33 cm × 53 cm | rule /treehouse\|cabin\|house\|observatory\|towe/ |
| Pressure-treated 4 × 4 knee braces, 8 ft | bom.js | generic fallback | not shelved (parts-line) | 45 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:thing] |
| Galvanised lag screws 1/2 × 6 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Pressure-treated 2 × 8 beams, 10 ft | bom.js | generic fallback | not shelved (parts-line) | 54 cm × 23 cm × 17 cm | LIST[rule /bar stock\|steel bar\|rods?\b\|pipe\|tubin/ ; CAT |
| Joist hangers 2 × 6 | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Joist-hanger nails | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Carriage bolts 1/2 × 6 in. with nuts and washers | bom.js | generic fallback | not shelved (parts-line) | 43 cm × 23 cm × 17 cm | LIST[CATEGORY:food ; CATEGORY:thing] |
| 5/4 × 6 cedar decking, 8 ft | bom.js | generic fallback | not shelved (parts-line) | 52 cm × 23 cm × 26 cm | LIST[rule /dock\|pier\|plank\|cedar\|lumber\|timber/ ; CATEG |
| Deck screws 2-1/2 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| 2 × 4 posts and rails, 8 ft | bom.js | generic fallback | not shelved (parts-line) | 73 cm × 25 cm × 17 cm | LIST[CATEGORY:thing ; FORM ; CATEGORY:thing] |
| Cedar fence boards 1 × 6 × 6 ft | bom.js | ok | not shelved (parts-line) | 38 cm × 6 cm × 32 cm | rule /dock\|pier\|plank\|cedar\|lumber\|timber/ |
| Deck screws 2 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Corrugated metal roofing 26 in. × 8 ft | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Roofing screws with neoprene washers | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Pressure-treated 2 × 6 ladder rails, 12 ft | bom.js | generic fallback | not shelved (parts-line) | 53 cm × 25 cm × 17 cm | LIST[FORM ; CATEGORY:thing] |
| 2 × 4 rungs | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Trap-door hinges | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Structural screws 3 in. | bom.js | generic fallback | not shelved (parts-line) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Fuselage frame | bom.js | generic fallback | not shelved (sub-assembly) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Landing gear | bom.js | ok | not shelved (sub-assembly) | 50 cm × 29 cm × 50 cm | rule /island\|land\|territory/ |
| Tail surfaces | bom.js | generic fallback | not shelved (sub-assembly) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Wings (pair) | bom.js | generic fallback | not shelved (sub-assembly) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Flight controls | bom.js | generic fallback | not shelved (sub-assembly) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Fabric covering | bom.js | generic fallback; floating 1 cm | not shelved (sub-assembly) | 30 cm × 5 cm × 30 cm | INFERRED |
| Engine and propeller | bom.js | ok | not shelved (sub-assembly) | 49 cm × 15 cm × 27 cm | LIST[rule /motor\|engine\|generator\|turbine/ ; rule /rope\| |
| Fuel system | bom.js | generic fallback | not shelved (sub-assembly) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Instruments | bom.js | generic fallback | not shelved (sub-assembly) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Electrical system | bom.js | generic fallback | not shelved (sub-assembly) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Frame | bom.js | generic fallback | not shelved (sub-assembly) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Steering | bom.js | generic fallback; floating 1 cm | not shelved (sub-assembly) | 30 cm × 5 cm × 30 cm | INFERRED |
| Rear axle and brake | bom.js | generic fallback | not shelved (sub-assembly) | 45 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:thing] |
| Wheels and tyres | bom.js | generic fallback | not shelved (sub-assembly) | 48 cm × 20 cm × 3 cm | LIST[INFERRED ; INFERRED] |
| Engine and drive | bom.js | generic fallback | not shelved (sub-assembly) | 44 cm × 23 cm × 17 cm | LIST[rule /motor\|engine\|generator\|turbine/ ; CATEGORY:thi |
| Seat and body | bom.js | generic fallback | not shelved (sub-assembly) | 52 cm × 23 cm × 17 cm | LIST[FORM ; CATEGORY:thing] |
| Strongback and forms | bom.js | generic fallback | not shelved (sub-assembly) | 45 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:thing] |
| Hull stripping | bom.js | generic fallback | not shelved (sub-assembly) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Fibreglass and epoxy | bom.js | generic fallback | not shelved (sub-assembly) | 48 cm × 23 cm × 17 cm | LIST[rule /glass/ ; CATEGORY:thing] |
| Gunwales, seats and yoke | bom.js | generic fallback | not shelved (sub-assembly) | 73 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; FORM ; CATEGORY:thing] |
| Varnish | bom.js | generic fallback | not shelved (sub-assembly) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Foundation | bom.js | generic fallback | not shelved (sub-assembly) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Floor | bom.js | generic fallback | not shelved (sub-assembly) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Wall framing | bom.js | generic fallback | not shelved (sub-assembly) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Roof framing | bom.js | generic fallback | not shelved (sub-assembly) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Roofing | bom.js | generic fallback | not shelved (sub-assembly) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Siding, door and window | bom.js | generic fallback | not shelved (sub-assembly) | 73 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:thing ; CATEGORY:thing] |
| Paint | bom.js | ok | not shelved (sub-assembly) | 31 cm × 5 cm × 19 cm | rule /paint\|watercolor\|brush/ |
| Motors and ESC | bom.js | generic fallback | not shelved (sub-assembly) | 44 cm × 23 cm × 17 cm | LIST[rule /motor\|engine\|generator\|turbine/ ; CATEGORY:thi |
| Flight controller | bom.js | generic fallback | not shelved (sub-assembly) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Radio and video | bom.js | generic fallback | not shelved (sub-assembly) | 49 cm × 36 cm × 25 cm | LIST[glb boombox.glb \| CATEGORY:thing ; CATEGORY:thing] |
| Battery and props | bom.js | generic fallback | not shelved (sub-assembly) | 41 cm × 23 cm × 17 cm | LIST[rule /capacitor\|battery\|power cell\|power sup/ ; CATE |
| Body | bom.js | generic fallback | not shelved (sub-assembly) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Neck and fingerboard | bom.js | generic fallback | not shelved (sub-assembly) | 49 cm × 23 cm × 19 cm | LIST[CATEGORY:thing ; INFERRED] |
| Frets and nut | bom.js | generic fallback | not shelved (sub-assembly) | 43 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:food] |
| Finish | bom.js | generic fallback | not shelved (sub-assembly) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Hardware | bom.js | generic fallback | not shelved (sub-assembly) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Electronics | bom.js | generic fallback | not shelved (sub-assembly) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Strings and setup | bom.js | generic fallback | not shelved (sub-assembly) | 49 cm × 23 cm × 24 cm | LIST[INFERRED ; CATEGORY:thing] |
| Hull panels | bom.js | ok | not shelved (sub-assembly) | 31 cm × 18 cm × 20 cm | rule /solar\|panel/ |
| Stitching | bom.js | generic fallback | not shelved (sub-assembly) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Fillets and fibreglass | bom.js | generic fallback | not shelved (sub-assembly) | 48 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; rule /glass/] |
| Deck and cockpit | bom.js | generic fallback | not shelved (sub-assembly) | 45 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:thing] |
| Hatches and outfitting | bom.js | generic fallback | not shelved (sub-assembly) | 46 cm × 23 cm × 19 cm | LIST[CATEGORY:thing ; INFERRED] |
| Tree supports | bom.js | generic fallback | not shelved (sub-assembly) | 1.18 m × 2.69 m × 1.24 m | FORM |
| Beams and joists | bom.js | generic fallback | not shelved (sub-assembly) | 54 cm × 23 cm × 17 cm | LIST[rule /bar stock\|steel bar\|rods?\b\|pipe\|tubin/ ; CAT |
| Decking | bom.js | generic fallback | not shelved (sub-assembly) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Walls and railing | bom.js | generic fallback | not shelved (sub-assembly) | 45 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:thing] |
| Roof | bom.js | generic fallback | not shelved (sub-assembly) | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Ladder and trap door | bom.js | generic fallback | not shelved (sub-assembly) | 45 cm × 23 cm × 17 cm | LIST[CATEGORY:thing ; CATEGORY:thing] |
| Tools for the ultralight airplane (16) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Fuselage frame (14 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Landing gear (16 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Tail surfaces (11 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Wings (pair) (17 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Flight controls (15 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Fabric covering (11 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Engine and propeller (17 lines) | assembly.js | wrong object/route | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Fuel system (9 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Instruments (12 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Electrical system (13 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Tools for the go-kart (6) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Frame (8 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Steering (8 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Rear axle and brake (10 lines) | assembly.js | generic fallback | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Wheels and tyres (5 lines) | assembly.js | generic fallback | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Engine and drive (10 lines) | assembly.js | generic fallback | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Seat and body (4 lines) | assembly.js | generic fallback | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Tools for the cedar-strip canoe (8) | assembly.js | wrong object/route; floating 1 cm | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Strongback and forms (5 lines) | assembly.js | generic fallback | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Hull stripping (4 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Fibreglass and epoxy (4 lines) | assembly.js | generic fallback | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Gunwales, seats and yoke (8 lines) | assembly.js | generic fallback | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Varnish (2 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Tools for the garden shed (7) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Foundation (3 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Floor (5 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Wall framing (4 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Roof framing (5 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Roofing (7 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Siding, door and window (8 lines) | assembly.js | generic fallback | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Paint (3 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Tools for the quadcopter drone (5) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Frame (4 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Motors and ESC (8 lines) | assembly.js | generic fallback | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Flight controller (3 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Radio and video (8 lines) | assembly.js | generic fallback | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Battery and props (4 lines) | assembly.js | generic fallback | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Tools for the electric guitar (10) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Body (3 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Neck and fingerboard (5 lines) | assembly.js | generic fallback | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Frets and nut (3 lines) | assembly.js | generic fallback | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Finish (6 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Hardware (9 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Electronics (9 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Strings and setup (1 line) | assembly.js | generic fallback | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Tools for the wooden sea kayak (6) | assembly.js | wrong object/route | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Hull panels (3 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Stitching (2 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Fillets and fibreglass (3 lines) | assembly.js | wrong object/route | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Deck and cockpit (4 lines) | assembly.js | generic fallback | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Hatches and outfitting (9 lines) | assembly.js | generic fallback | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Tools for the tree fort (7) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Tree supports (3 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Beams and joists (5 lines) | assembly.js | generic fallback | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Decking (2 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Walls and railing (3 lines) | assembly.js | generic fallback | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Roof (3 lines) | assembly.js | ok | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Parts kit: Ladder and trap door (4 lines) | assembly.js | generic fallback | ok | 33 cm × 20 cm × 24 cm | rule /^parts (kit\|crate)\|^tools for / |
| Roadwork kit (12 lines) | roadworks.js | generic fallback | ok | 82 cm × 51 cm × 62 cm | rule /^roadwork kit\|^runway kit\|parts crate\|/ |
| Runway kit (14 lines) | roadworks.js | generic fallback | ok | 82 cm × 51 cm × 62 cm | rule /^roadwork kit\|^runway kit\|parts crate\|/ |
| a hazelnut croissant | needs.js | ok | ok | 14 cm × 6 cm × 14 cm | rule /bread\|loaf\|sourdough\|baguette\|\bbun\b\|/ |
| a bowl of soup | needs.js | ok | ok | 26 cm × 11 cm × 20 cm | rule /ramen\|noodle\|soup\|stew\|bowl/ |
| a toasted bagel | needs.js | generic fallback | ok | 16 cm × 5 cm × 16 cm | rule /bagel\|doughnut\|\bdonut\b/ |
| a slice of peach pie | needs.js | wrong object/route | ok | 26 cm × 5 cm × 26 cm | rule /tart\|\bpies?\b\|cobbler\|cake\|cookie/ |
| rainbow trout | pastimes.js | ok | ok | 65 cm × 29 cm × 14 cm | glb fish.glb \| rule /salmon\|fish\|trout/ |
| kokanee salmon | pastimes.js | ok | ok | 65 cm × 29 cm × 14 cm | glb fish.glb \| rule /salmon\|fish\|trout/ |
| lake whitefish | pastimes.js | wrong object/route | ok | 65 cm × 29 cm × 14 cm | glb fish.glb \| rule /salmon\|fish\|trout/ |
| yellow perch | pastimes.js | generic fallback; floating 1 cm | ok | 65 cm × 29 cm × 14 cm | glb fish.glb \| INFERRED |
| smallmouth bass | pastimes.js | generic fallback | ok | 65 cm × 29 cm × 14 cm | glb fish.glb \| CATEGORY:thing |
| burbot | pastimes.js | generic fallback | ok | 65 cm × 29 cm × 14 cm | glb fish.glb \| CATEGORY:thing |
| pan-fried rainbow trout | pastimes.js | ok | ok | 65 cm × 29 cm × 14 cm | glb fish.glb \| rule /salmon\|fish\|trout/ |
| peach and blueberry cobbler | pastimes.js | wrong object/route | ok | 26 cm × 5 cm × 26 cm | rule /tart\|\bpies?\b\|cobbler\|cake\|cookie/ |
| tomato and carrot soup | pastimes.js | generic fallback | ok | 26 cm × 11 cm × 20 cm | rule /ramen\|noodle\|soup\|stew\|bowl/ |
| roasted tomato soup | pastimes.js | ok | ok | 26 cm × 11 cm × 20 cm | rule /ramen\|noodle\|soup\|stew\|bowl/ |
| maple-glazed carrots | pastimes.js | ok | ok | 58 cm × 8 cm × 20 cm | rule /carrot/ |
| grilled peaches with honey | pastimes.js | ok | ok | 31 cm × 24 cm × 31 cm | rule /^(?!.*(pie\|tart\|cobbler\|cake\|jam)).*(p/ |
| A ceramic jug | paintstudio.js | wrong object/route | ok | 23 cm × 24 cm × 15 cm | rule /\bglue\b\|epoxy\|caulk\|silicone\|sealant\|/ |
| An apple | paintstudio.js | ok | ok | 31 cm × 24 cm × 31 cm | rule /^(?!.*(pie\|tart\|cobbler\|cake\|crumble\|j/ |
| A pear | paintstudio.js | generic fallback | ok | 7 cm × 12 cm × 7 cm | rule /\b(pears?\|tomato(es)?\|oranges?\|lemons?/ |
| Okanagan Lake in Winter | paintstudio.js | generic fallback; floating 9 cm | not shelved (painting) | 2.50 m × 1.27 m × 56 cm | FORM |
| The Frozen Lake | paintstudio.js | generic fallback; floating 9 cm | LEFT: painting title (a Museum picture, not a shelf item); a name-only fallback is a sculpture form | 2.50 m × 1.27 m × 56 cm | FORM |
| Rain on Okanagan Lake | paintstudio.js | generic fallback; floating 9 cm | not shelved (painting) | 2.50 m × 1.27 m × 56 cm | FORM |
| Grey Day at the Lake | paintstudio.js | generic fallback; floating 9 cm | not shelved (painting) | 2.50 m × 1.27 m × 56 cm | FORM |
| Okanagan Sunset | paintstudio.js | generic fallback | not shelved (painting) | 26 cm × 16 cm × 20 cm | INFERRED |
| Evening on Okanagan Lake | paintstudio.js | generic fallback; floating 9 cm | not shelved (painting) | 2.50 m × 1.27 m × 56 cm | FORM |
| Last Light over the Lake | paintstudio.js | generic fallback; floating 9 cm | not shelved (painting) | 2.50 m × 1.27 m × 56 cm | FORM |
| Night over the Lake | paintstudio.js | generic fallback; floating 9 cm | not shelved (painting) | 2.50 m × 1.27 m × 56 cm | FORM |
| Moonlight on Okanagan Lake | paintstudio.js | generic fallback; floating 9 cm | not shelved (painting) | 2.50 m × 1.27 m × 56 cm | FORM |
| Stars above the Valley | paintstudio.js | generic fallback | not shelved (painting) | 1.19 m × 2.13 m × 13 cm | FORM |
| Snow on the High Peaks | paintstudio.js | generic fallback | not shelved (painting) | 1.80 m × 1.27 m × 1.65 m | FORM |
| Winter Mountains | paintstudio.js | generic fallback | not shelved (painting) | 1.80 m × 1.27 m × 1.65 m | FORM |
| The Peaks above the Valley | paintstudio.js | generic fallback | LEFT: painting title (a Museum picture, not a shelf item); a name-only fallback is a sculpture form | 1.80 m × 1.27 m × 1.65 m | FORM |
| Mountain Morning | paintstudio.js | generic fallback | not shelved (painting) | 1.80 m × 1.27 m × 1.65 m | FORM |
| The Range from the Valley | paintstudio.js | generic fallback | LEFT: painting title (a Museum picture, not a shelf item); a name-only fallback is a sculpture form | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| My House in the Snow | paintstudio.js | ok | not shelved (painting) | 53 cm × 33 cm × 53 cm | rule /treehouse\|cabin\|house\|observatory\|towe/ |
| Home in Winter | paintstudio.js | generic fallback | not shelved (painting) | 1.52 m × 1.50 m × 1.52 m | FORM |
| My House at Golden Hour | paintstudio.js | ok | not shelved (painting) | 53 cm × 33 cm × 53 cm | rule /treehouse\|cabin\|house\|observatory\|towe/ |
| Home | paintstudio.js | generic fallback | not shelved (painting) | 1.52 m × 1.50 m × 1.52 m | FORM |
| The Little House by the Lake | paintstudio.js | wrong object/route | LEFT: painting title (a Museum picture, not a shelf item); a name-only fallback is a sculpture form | 53 cm × 33 cm × 53 cm | rule /treehouse\|cabin\|\bhouse\b\|observatory\|/ |
| Mule Deer in the West Meadow | paintstudio.js | generic fallback | not shelved (painting) | 1.27 m × 1.28 m × 44 cm | FORM |
| Grazing Deer | paintstudio.js | generic fallback | not shelved (painting) | 1.27 m × 1.28 m × 44 cm | FORM |
| Deer at the Edge of the Woods | paintstudio.js | generic fallback; floating 1 cm | not shelved (painting) | 23 cm × 23 cm × 23 cm | INFERRED |
| The West Meadow | paintstudio.js | generic fallback | LEFT: painting title (a Museum picture, not a shelf item); a name-only fallback is a sculpture form | 21 cm × 29 cm × 21 cm | CATEGORY:thing |
| Where the Deer Would Be | paintstudio.js | generic fallback | not shelved (painting) | 1.27 m × 1.28 m × 44 cm | FORM |
| Still Life with Ceramic Jug and Apple | paintstudio.js | ok | not shelved (painting) | 41 cm × 26 cm × 16 cm | LIST[rule /microphone\|mic\b/ ; rule /^(?!.*(pie\|tart\|cobb |
| Self-Portrait | paintstudio.js | generic fallback | not shelved (painting) | 90 cm × 1.93 m × 46 cm | FORM |
| Study: Okanagan Sunset | paintstudio.js | generic fallback | not shelved (painting) | 26 cm × 16 cm × 20 cm | INFERRED |
| Cast iron skillet | AI sample | wrong object/route | ok | 45 cm × 6 cm × 26 cm | rule /\b(skillet\|frying pan\|fry ?pan\|saut[eé/ |
| Stainless steel saucepan | AI sample | generic fallback; floating 1 cm | ok | 35 cm × 14 cm × 18 cm | rule /sauce ?pan\|stock ?pot\|dutch oven\|casse/ |
| Wooden cutting board | AI sample | generic fallback | ok | 38 cm × 2 cm × 25 cm | rule /cutting board\|chopping board\|bread boa/ |
| Chef's knife | AI sample | ok | ok | 29 cm × 2 cm × 3 cm | rule /knife/ |
| Whisk | AI sample | generic fallback | ok | 27 cm × 6 cm × 6 cm | rule /\bwhisk\b\|spatula\|\bturner\b\|\bladle\b/ |
| Rolling pin | AI sample | generic fallback | ok | 48 cm × 6 cm × 6 cm | rule /rolling pin/ |
| Ceramic coffee mug | AI sample | wrong object/route | ok | 12 cm × 10 cm × 8 cm | rule /\bmugs?\b\|coffee cup\|\b(ceramic\|camp\|e/ |
| French press | AI sample | generic fallback | ok | 16 cm × 28 cm × 11 cm | rule /french press\|cafeti[eè]re\|coffee press/ |
| Toaster | AI sample | generic fallback | ok | 30 cm × 19 cm × 17 cm | rule /toaster\|blender\|food processor\|stand m/ |
| Blender | AI sample | generic fallback | ok | 19 cm × 40 cm × 18 cm | rule /toaster\|blender\|food processor\|stand m/ |
| Electric kettle | AI sample | wrong object/route | ok | 24 cm × 24 cm × 18 cm | rule /\bkettle\b/ |
| Mixing bowl set | AI sample | wrong object/route | ok | 28 cm × 11 cm × 28 cm | rule /mixing bowls?\|salad bowl\|serving bowl\|/ |
| Spatula | AI sample | generic fallback | ok | 30 cm × 1 cm × 8 cm | rule /\bwhisk\b\|spatula\|\bturner\b\|\bladle\b/ |
| Measuring cups | AI sample | generic fallback; floating 1 cm | ok | 26 cm × 5 cm × 16 cm | rule /measuring (cups\|spoons)/ |
| Dinner plates | AI sample | generic fallback | ok | 27 cm × 7 cm × 27 cm | rule /\b(dinner\|side\|salad\|ceramic\|china\|pap/ |
| Laptop | AI sample | generic fallback | ok | 32 cm × 22 cm × 28 cm | rule /laptop\|notebook computer\|macbook\|chrom/ |
| Smartphone | AI sample | generic fallback | ok | 7 cm × 1 cm × 15 cm | rule /smart ?phone\|cell ?phone\|mobile phone\|/ |
| Tablet | AI sample | generic fallback | ok | 17 cm × 1 cm × 25 cm | rule /smart ?phone\|cell ?phone\|mobile phone\|/ |
| Wireless headphones | AI sample | wrong object/route; floating 1 cm | ok | 21 cm × 18 cm × 9 cm | rule /head ?phones\|headset\|ear ?buds\|earphon/ |
| Bluetooth speaker | AI sample | generic fallback; floating 1 cm | ok | 20 cm × 9 cm × 8 cm | rule /\bspeakers?\b(?! (driver\|wire))/ |
| Mechanical keyboard | AI sample | generic fallback | ok | 44 cm × 3 cm × 16 cm | rule /keyboard/ |
| Computer mouse | AI sample | generic fallback | ok | 6 cm × 5 cm × 12 cm | rule /computer mouse\|(wireless\|gaming\|optica/ |
| Raspberry Pi 4 | AI sample | generic fallback | ok | 9 cm × 2 cm × 6 cm | rule /raspberry ?pi\|arduino\|esp32\|esp8266\|mi/ |
| Arduino Uno | AI sample | generic fallback | ok | 7 cm × 2 cm × 5 cm | rule /raspberry ?pi\|arduino\|esp32\|esp8266\|mi/ |
| Multimeter | AI sample | generic fallback | ok | 14 cm × 4 cm × 21 cm | rule /multimeter\|voltmeter/ |
| USB cable | AI sample | wrong object/route; floating 1 cm | ok | 17 cm × 2 cm × 12 cm | rule /\b(usb\|hdmi\|ethernet\|charging\|aux\|audi/ |
| Desk fan | AI sample | generic fallback | ok | 31 cm × 44 cm × 23 cm | rule /desk fan\|table fan\|electric fan\|box fa/ |
| Alarm clock | AI sample | generic fallback | ok | 13 cm × 15 cm × 5 cm | rule /\bclock\b(?! movement)/ |
| Digital camera | AI sample | wrong object/route | ok | 10 cm × 7 cm × 5 cm | rule /digital camera\|dslr\|\bslr\b\|mirrorless/ |
| Game controller | AI sample | generic fallback | ok | 15 cm × 5 cm × 10 cm | rule /game ?(controller\|pad)\|gamepad\|joystic/ |
| Walkie-talkies | AI sample | generic fallback | ok | 13 cm × 21 cm × 4 cm | rule /walkie.?talkies?\|two-way radios?\|handh/ |
| Power bank | AI sample | generic fallback | ok | 7 cm × 2 cm × 14 cm | rule /power ?bank\|portable charger/ |
| Tennis racket | AI sample | generic fallback | ok | 23 cm × 3 cm × 67 cm | rule /racket\|racquet\|pickleball paddle\|ping / |
| Baseball bat | AI sample | wrong object/route | ok | 85 cm × 7 cm × 7 cm | rule /baseball bat\|cricket bat\|softball bat\|/ |
| Baseball glove | AI sample | wrong object/route | ok | 26 cm × 10 cm × 33 cm | rule /baseball glove\|catcher'?s mitt\|fieldin/ |
| Soccer ball | AI sample | ok | ok | 22 cm × 22 cm × 22 cm | rule /ball\|juggl\|marble/ |
| Basketball | AI sample | wrong object/route | ok | 25 cm × 25 cm × 25 cm | rule /basketball\|tennis ball\|baseball(?! (ba/ |
| Hockey stick | AI sample | generic fallback; floating 4 cm | ok | 1.73 m × 3 cm × 9 cm | rule /hockey stick\|field hockey\|lacrosse sti/ |
| Skateboard | AI sample | generic fallback | ok | 76 cm × 12 cm × 20 cm | rule /skate ?board\|longboard\|snowboard\|surf / |
| Fishing rod | AI sample | wrong object/route | ok | 1.96 m × 8 cm × 3 cm | rule /fishing (rod\|pole)/ |
| Tackle box | AI sample | generic fallback | ok | 37 cm × 21 cm × 21 cm | rule /tackle box\|fishing box/ |
| Yoga mat | AI sample | generic fallback | ok | 61 cm × 14 cm × 14 cm | rule /yoga mat\|exercise mat\|sleeping bag\|bed/ |
| Dumbbells | AI sample | generic fallback | ok | 30 cm × 11 cm × 29 cm | rule /dumbbells?\|kettlebell\|hand weights\|fre/ |
| Jump rope | AI sample | wrong object/route; floating 1 cm | ok | 31 cm × 3 cm × 38 cm | rule /jump ?rope\|skipping rope/ |
| Frisbee | AI sample | generic fallback | ok | 27 cm × 3 cm × 27 cm | rule /frisbee\|flying disc/ |
| Golf club | AI sample | generic fallback | ok | 96 cm × 4 cm × 9 cm | rule /hockey stick\|field hockey\|lacrosse sti/ |
| Camping tent | AI sample | generic fallback | ok | 2.10 m × 1.07 m × 1.44 m | rule /\btent\b/ |
| Sleeping bag | AI sample | wrong object/route; sunk -1 cm | ok | 42 cm × 28 cm × 28 cm | rule /yoga mat\|exercise mat\|sleeping bag\|bed/ |
| Backpack | AI sample | generic fallback | ok | 30 cm × 53 cm × 28 cm | rule /backpack\|rucksack\|day ?pack\|knapsack/ |
| Life jacket | AI sample | generic fallback | ok | 44 cm × 50 cm × 17 cm | rule /life ?jacket\|life vest\|\bpfd\b\|buoyanc/ |
| Bike helmet | AI sample | wrong object/route | ok | 21 cm × 23 cm × 26 cm | rule /^(?!.*weld).*(helmet\|hard ?hat)/ |
| Climbing rope | AI sample | wrong object/route; floating 1 cm | ok | 36 cm × 11 cm × 36 cm | rule /^(?!.*(jump\|skipping\|power\|extension\|e/ |
| Bag of cement | AI sample | wrong object/route; sunk -1 cm | ok | 68 cm × 12 cm × 42 cm | rule /^(?!.*\b(bolts\|nuts\|screws\|washers\|nai/ |
| Box of drywall screws | AI sample | generic fallback | ok | 12 cm × 7 cm × 15 cm | rule /\bbox(es)? of (\w+ )?(screws\|nails\|bol/ |
| Sheet of plywood | AI sample | generic fallback | ok | 1.22 m × 3 cm × 61 cm | rule /plywood\|\bmdf\b\|\bosb\b\|drywall sheet\|/ |
| 2x4 lumber | AI sample | wrong object/route | ok | 2.44 m × 8 cm × 18 cm | rule /\b(2x4\|2x6\|2x8\|2 ?× ?4\|1x\d\|4x4\|6x6)\b/ |
| Bucket of paint | AI sample | wrong object/route | ok | 31 cm × 51 cm × 31 cm | rule /\b(5 ?gal(lon)?\|pail\|bucket) of\b/ |
| Roll of duct tape | AI sample | generic fallback | ok | 11 cm × 5 cm × 11 cm | rule /\btape\b(?! measure)/ |
| Galvanized nails | AI sample | generic fallback | ok | 12 cm × 7 cm × 15 cm | rule /\bbox(es)? of (\w+ )?(screws\|nails\|bol/ |
| Bricks | AI sample | generic fallback | ok | 63 cm × 18 cm × 9 cm | rule /bricks?\b\|cinder blocks?\|concrete bloc/ |
| Roof shingles | AI sample | generic fallback | ok | 93 cm × 7 cm × 32 cm | rule /shingles\|roofing felt\|tar paper/ |
| PVC pipe | AI sample | wrong object/route | ok | 1.50 m × 9 cm × 14 cm | rule /^(?!.*(paint\|glue\|caulk\|cream\|notcher)/ |
| Copper wire spool | AI sample | wrong object/route; floating 1 cm | ok | 8 cm × 15 cm × 15 cm | rule /spool\|reel of\|\bwire\b(?!.*(stripper\|b/ |
| Sandpaper | AI sample | wrong object/route; sunk -1 cm | ok | 26 cm × 3 cm × 31 cm | rule /sandpaper\|sanding (sheets\|discs\|paper)/ |
| Wood glue | AI sample | generic fallback; floating 1 cm | ok | 7 cm × 19 cm × 7 cm | rule /\bglue\b\|epoxy\|caulk\|silicone\|sealant\|/ |
| Caulking gun | AI sample | generic fallback | ok | 29 cm × 5 cm × 5 cm | rule /\bglue\b\|epoxy\|caulk\|silicone\|sealant\|/ |
| Spirit level | AI sample | generic fallback | ok | 60 cm × 6 cm × 3 cm | rule /spirit level\|\blevel\b(?!.*(up\|meter))/ |
| Utility knife | AI sample | wrong object/route | ok | 18 cm × 2 cm × 2 cm | rule /utility knife\|box cutter\|craft knife/ |
| Ladder | AI sample | generic fallback | ok | 52 cm × 1.84 m × 61 cm | rule /ladder\|step stool/ |
| Wheelbarrow | AI sample | oksunk -2 cm | ok | 89 cm × 40 cm × 99 cm | rule /wheelbarrow/ |
| Garden hose | AI sample | generic fallback; floating 1 cm | ok | 43 cm × 8 cm × 42 cm | rule /garden hose\|water hose\|\bhose\b(?!.*(c/ |
| Rake | AI sample | wrong object/route | ok | 26 cm × 91 cm × 4 cm | rule /asphalt rake\|\blute\b\|\brake\b/ |
| Pruning shears | AI sample | generic fallback | ok | 21 cm × 2 cm × 6 cm | rule /pruning shears\|secateurs\|pruners\|hedge/ |
| Watering can | AI sample | ok | ok | 34 cm × 25 cm × 19 cm | rule /watering can/ |
| Leaf blower | AI sample | generic fallback | ok | 83 cm × 29 cm × 14 cm | rule /chainsaw\|leaf blower\|lawn ?mower\|strin/ |
| Chainsaw | AI sample | generic fallback | ok | 80 cm × 29 cm × 18 cm | rule /chainsaw\|leaf blower\|lawn ?mower\|strin/ |
| Lawn mower | AI sample | generic fallback | ok | 56 cm × 96 cm × 1.05 m | rule /chainsaw\|leaf blower\|lawn ?mower\|strin/ |
| Teddy bear | AI sample | generic fallback | ok | 27 cm × 33 cm × 19 cm | rule /teddy\|plush\|stuffed (animal\|toy\|bear\|d/ |
| Toy train set | AI sample | generic fallback | ok | 50 cm × 12 cm × 7 cm | rule /toy train\|train set\|wooden train/ |
| Doll | AI sample | generic fallback | ok | 14 cm × 31 cm × 14 cm | rule /\bdoll\b(?!.*house)/ |
| Kite | AI sample | oksunk -23 cm | ok | 54 cm × 46 cm × 1.15 m | rule /kite/ |
| Building blocks | AI sample | wrong object/route | ok | 10 cm × 6 cm × 8 cm | rule /puzzle\|cube\|\bblocks?\b\|lego/ |
| Jigsaw puzzle | AI sample | wrong object/route | ok | 33 cm × 7 cm × 23 cm | rule /board game\|jigsaw\|^(an? )?game$\|monopo/ |
| Board game | AI sample | generic fallback | ok | 40 cm × 7 cm × 27 cm | rule /board game\|jigsaw\|^(an? )?game$\|monopo/ |
| Deck of playing cards | AI sample | generic fallback | ok | 12 cm × 2 cm × 10 cm | rule /playing cards\|deck of cards\|card deck\|/ |
| Rubik's cube | AI sample | wrong object/route | ok | 6 cm × 6 cm × 6 cm | rule /rubik\|puzzle cube\|speed cube\|magic cub/ |
| Toy robot | AI sample | generic fallback | ok | 14 cm × 27 cm × 6 cm | rule /toy robot\|robot toy\|wind-?up robot\|rob/ |
| Remote control car | AI sample | wrong object/route; floating 130 cm | ok | 10 cm × 6 cm × 20 cm | glb toy-car.glb \| CATEGORY:vehicle |
| Plush dinosaur | AI sample | generic fallback | ok | 52 cm × 27 cm × 18 cm | rule /teddy\|plush\|stuffed (animal\|toy\|bear\|d/ |
| Acoustic guitar | AI sample | ok | ok | 35 cm × 1.04 m × 16 cm | rule /guitar\|ukulele\|violin/ |
| Violin | AI sample | ok | ok | 21 cm × 63 cm × 10 cm | rule /guitar\|ukulele\|violin/ |
| Ukulele | AI sample | ok | ok | 19 cm × 57 cm × 9 cm | rule /guitar\|ukulele\|violin/ |
| Drum set | AI sample | generic fallback | ok | 1.24 m × 1.00 m × 64 cm | rule /drum (set\|kit)\|drum ?kit\|drumset\|bongo/ |
| Flute | AI sample | wrong object/route; floating 2 cm | ok | 67 cm × 2 cm × 2 cm | rule /\bflute\b\|piccolo\|clarinet\|\boboe\b\|re/ |
| Trumpet | AI sample | generic fallback | ok | 64 cm × 12 cm × 15 cm | rule /saxophone\|\bsax\b\|trumpet\|cornet\|tromb/ |
| Keyboard piano | AI sample | generic fallback | ok | 1.30 m × 11 cm × 30 cm | rule /keyboard piano\|piano keyboard\|electric/ |
| Tambourine | AI sample | generic fallback | ok | 27 cm × 5 cm × 25 cm | rule /tambourine/ |
| Saxophone | AI sample | generic fallback | ok | 72 cm × 28 cm × 15 cm | rule /saxophone\|\bsax\b\|trumpet\|cornet\|tromb/ |
| Field guide to birds | AI sample | wrong object/route; floating 1 cm | ok | 17 cm × 3 cm × 24 cm | rule /\b(atlas\|dictionary\|encyclopa?edia\|alm/ |
| Cookbook | AI sample | wrong object/route | ok | 17 cm × 3 cm × 24 cm | rule /\b(atlas\|dictionary\|encyclopa?edia\|alm/ |
| Atlas | AI sample | generic fallback | ok | 17 cm × 3 cm × 24 cm | rule /\b(atlas\|dictionary\|encyclopa?edia\|alm/ |
| Dictionary | AI sample | generic fallback | ok | 17 cm × 3 cm × 24 cm | rule /\b(atlas\|dictionary\|encyclopa?edia\|alm/ |
| Comic book | AI sample | wrong object/route | ok | 17 cm × 3 cm × 24 cm | rule /\b(atlas\|dictionary\|encyclopa?edia\|alm/ |
| Sketchbook | AI sample | ok | ok | 17 cm × 3 cm × 24 cm | rule /book\|novel\|journal\|notebook\|manual/ |
| Hardcover novel | AI sample | wrong object/route | ok | 17 cm × 3 cm × 24 cm | rule /\b(atlas\|dictionary\|encyclopa?edia\|alm/ |
| Umbrella | AI sample | generic fallback | ok | 98 cm × 13 cm × 8 cm | rule /umbrella\|parasol/ |
| Wristwatch | AI sample | generic fallback | ok | 4 cm × 8 cm × 4 cm | rule /wrist ?watch\|smart ?watch\|stopwatch\|po/ |
| Sunglasses | AI sample | ok | ok | 14 cm × 5 cm × 14 cm | glb sunglasses.glb \| rule /glass/ |
| Wool sweater | AI sample | generic fallback | ok | 1.68 m × 4 cm × 73 cm | rule /scarf\|toque\|beanie\|knit hat\|winter hat/ |
| Rain boots | AI sample | generic fallback | ok | 22 cm × 39 cm × 28 cm | rule /scarf\|toque\|beanie\|knit hat\|winter hat/ |
| Winter jacket | AI sample | generic fallback | ok | 1.74 m × 6 cm × 79 cm | rule /scarf\|toque\|beanie\|knit hat\|winter hat/ |
| Baseball cap | AI sample | wrong object/route | ok | 19 cm × 9 cm × 26 cm | rule /scarf\|toque\|beanie\|knit hat\|winter hat/ |
| Scarf | AI sample | generic fallback | ok | 18 cm × 5 cm × 50 cm | rule /scarf\|toque\|beanie\|knit hat\|winter hat/ |
| Wall clock | AI sample | generic fallback | ok | 30 cm × 30 cm × 5 cm | rule /\bclock\b(?! movement)/ |
| Picture frame | AI sample | generic fallback | ok | 20 cm × 25 cm × 11 cm | rule /picture frame\|photo frame\|\bphotos?\b\|/ |
| Pillow | AI sample | generic fallback | ok | 50 cm × 14 cm × 34 cm | rule /pillow\|cushion\|blanket\|quilt\|throw\b\|t/ |
| Blanket | AI sample | generic fallback | ok | 45 cm × 12 cm × 35 cm | rule /pillow\|cushion\|blanket\|quilt\|throw\b\|t/ |
| Rug | AI sample | generic fallback | ok | 1.22 m × 18 cm × 18 cm | rule /yoga mat\|exercise mat\|sleeping bag\|bed/ |
| Bookshelf | AI sample | wrong object/route | ok | 80 cm × 1.80 m × 30 cm | rule /book ?(case\|shelf)\|bookshelves\|shelvin/ |
| Desk | AI sample | generic fallback | ok | 1.20 m × 75 cm × 60 cm | rule /book ?(case\|shelf)\|bookshelves\|shelvin/ |
| Mirror | AI sample | wrong object/route | ok | 50 cm × 70 cm × 10 cm | rule /^(?!.*(rear\|side\|telescope\|hand)).*\bm/ |
| Fire extinguisher | AI sample | generic fallback; floating 1 cm | ok | 15 cm × 48 cm × 14 cm | rule /fire extinguisher/ |
| First aid kit | AI sample | generic fallback | ok | 26 cm × 11 cm × 17 cm | rule /first.?aid/ |
| Binoculars | AI sample | generic fallback | ok | 14 cm × 7 cm × 16 cm | rule /binoculars\|opera glasses\|field glasses/ |
| Globe | AI sample | generic fallback | ok | 39 cm × 44 cm × 35 cm | rule /\bglobe\b/ |
| Hourglass | AI sample | wrong object/route | ok | 12 cm × 26 cm × 12 cm | rule /hourglass\|sand timer\|egg timer/ |
| Flower pot | AI sample | wrong object/route | ok | 17 cm × 12 cm × 17 cm | rule /flower ?pot\|plant pot\|terracotta pot\|c/ |
| Snow shovel | AI sample | wrong object/route; sunk -4 cm | ok | 1.64 m × 12 cm × 52 cm | rule /snow shovel/ |
| Ice skates | AI sample | generic fallback | ok | 23 cm × 28 cm × 30 cm | rule /ice skates\|roller skates\|inline skates/ |
| Sled | AI sample | generic fallback | ok | 1.03 m × 21 cm × 38 cm | rule /\bsled\b\|sledge\|toboggan\|snow saucer/ |
