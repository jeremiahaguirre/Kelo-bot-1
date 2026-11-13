# Open audit fixes (agent/openfixes)

The five issues left open by the Workshop/town/UI audit (`qa-results-audit-places`, REPORT.md, "Open (written up, not
changed)"). The owner approved all five. Branch `agent/openfixes` (pushed; latest `origin/main` merged, including kelo-handoff, refsources, photobrowse and skins). The tests are in `qa/openfix.js` on this branch:
`KELO_ROOT=<repo> PORT=<port> node qa/openfix.js [free,store,shelf,museum,notes,settings | all]`.

"main" in the before/after columns is `019c981`, the main these fixes started from. The bugs are in code that later main
commits didn't touch.

## 1. The when-free queue merged different jobs
**Change** (`js/agent.js` `doWhenFree`, plus every call site). Jobs used to merge on their key, and the default key was
`fn.toString()`, so two calls from the same line merged whatever their arguments were. Now a call without a key gets a
unique key (`anon:<n>`) and never merges. Every one of the 61 call sites passes an explicit key:
- Where merging isn't wanted, the key includes the argument (`land:chop::x,z`, `sell:<item>`, `machine:<shop>:<make>`,
  `dig:x,z`, `trip:<key>`, `build-project:<id>`, `wish:<key>`, `upgrade:<title>:<code>`...).
- Where merging is intended, the key is fixed (`putaway` for every `putAwayItems`, `eat`, `drink`, `repair-balloon`,
  `fly-plane`, `wade-lake`, `printer-setup`, `research-snow`, `research-ice`, `test-ice`, `walk-ice`, `ice-outing`).
- The scattered `putaway-made` / unkeyed `putAwayItems` calls are now one key, so there's one put-away job at a time.

A commit already on main (4dc1418a) had keyed about 18 sites. This branch keys the other 27 and changes the default.

Every call site and its key (as it stands after the merge):

| File:line | Job | Key |
|---|---|---|
| agent.js:1012 | `() => synthesizeUnboundedExperience(promptOrImpulse, originLabel, forc` | ``synth:${originLabel}:${String(promptOrImpulse \|\| '').slice(0, 120)}`` |
| agent.js:2089 | `() => wadeIntoLake('Wanted to Go Out on the Lake'), { key: 'wade-lake'` | `'wade-lake'` |
| agent.js:2241 | `() => digAt(Number(decision.dig.x), Number(decision.dig.z), 'Decided t` | ``dig:${decision.dig.x},${decision.dig.z}`` |
| agent.js:2250 | `() => takeOutOfMuseum(what, 'display', '', 'Decided to Rearrange'), {` | `'museum-out:' + what` |
| agent.js:2251 | `() => takeOutToUse(what, '', forWhat), { key: `take-out:${what}:${forW` | ``take-out:${what}:${forWhat}`` |
| agent.js:2255 | `() => useItemFor(str(ui.item, 120), str(ui.for, 120), '', 'Decided to` | ``use:${str(ui.item, 120)}:${str(ui.for, 120)}`` |
| agent.js:2261 | `() => startProject(decision.buildProject.toLowerCase().trim(), 'Decide` | `'project:' + decision.buildProject.toLowerCase().trim()` |
| agent.js:2266 | `() => repairBalloon('Decided to Fix the Balloon'), { key: 'repair-ball` | `'repair-balloon'` |
| agent.js:2270 | `() => disposeItem(dc.item, str(dc.why, 200), 'Decided to Throw Somethi` | `'dispose:' + dc.item` |
| agent.js:2449 | `() => digAt(spot.x, spot.z, `Back to Digging with the ${item}`), { key` | ``dig:${spot.x},${spot.z}`` |
| agent.js:2466 | `() => decideNextAction(trigger, originLabel, context), { key: `decide:` | ``decide:${originLabel}:${String(trigger).slice(0, 160)}`` |
| assembly.js:849 | `putAwayItems, { key: 'putaway' });` | `'putaway'` |
| assembly.js:1438 | `() => tryKey('assembly', () => researchBuild(target, why, 'Decided to` | ``build:${target}`` |
| assembly.js:1460 | `() => flyBuiltAirplane(`Asked by ${visitor}`), { key: 'fly-plane' });` | `'fly-plane'` |
| assembly.js:1473 | `() => researchBuild(ask.target, `${visitor} asked me to`, `Asked by ${` | ``build:${ask.target}`` |
| assembly.js:1531 | `async () => { try { await tryKey('assembly', work); } finally { assemb` | `'assembly-work:' + key` |
| conversation.js:171 | `() => decideNextAction(`${visitor} said: "${message}". You decided: ${` | ``talk:${visitor}:${message}`` |
| groundwork.js:81 | `() => researchJob(key), { key: 'research-job:' + key });` | `'research-job:' + key` |
| hobbies.js:64 | `() => practiceHobby(hobby, originLabel), { key: 'hobby:' + hobby.name,` | `'hobby:' + hobby.name` |
| itemuse.js:603 | `() => eatSomething('Hungry'), { key: 'eat' });` | `'eat'` |
| itemuse.js:604 | `() => drinkFromLake('Thirsty'), { key: 'drink' });` | `'drink'` |
| knowhow.js:65 | `() => learnToUse(name, 'Learning How Things Work'), { key: 'learn:' +` | `'learn:' + name` |
| knowhow.js:103 | `async () => {` | `'refuel:' + fuel` |
| knowhow.js:182 | `async () => {` | `'refuel:' + fuel` |
| landscape.js:673 | `run, { key: `land:${String(shape.action).toLowerCase()}:${shape.id \|\|` | ``land:${String(shape.action).toLowerCase()}:${shape.id \|\| ''}:${x},${z}`` |
| machines.js:183 | `() => researchMachine(key), { key: 'research-machine:' + key });` | `'research-machine:' + key` |
| machines.js:466 | `() => {` | ``machine:${def.key}:${job.make}`` |
| materials.js:376 | `() => straightenAtBench(result.newName), { key: 'straighten:' + result` | `'straighten:' + result.newName` |
| mining.js:373 | `putAwayItems, { key: 'putaway' });` | `'putaway'` |
| mining.js:486 | `() => digAt(near.x, near.z, 'Saw Something Glint'), { key: `dig:${near` | ``dig:${near.x},${near.z}`` |
| paintstudio.js:222 | `() => researchMedium(medium), { key: 'research-medium:' + medium });` | `'research-medium:' + medium` |
| paintstudio.js:686 | `() => paintPicture(medium, subject, { visitor, overrides: ask.override` | ``paint:${visitor}:${medium}:${subject}`` |
| paintstudio.js:695 | `() => paintPicture(medium, subject, { originLabel: 'Decided to Paint'` | ``paint:${medium}:${subject}`` |
| plantcare.js:1009 | `() => researchJob('plantcare', 'A Wilting Plant'), { key: 'research-jo` | `'research-job:plantcare'` |
| plants.js:1125 | `() => {` | ``plant:${kind}:${rp.pour === 'pad' ? 'pad' : 'path'}`` |
| postoffice.js:136 | `putAwayItems, { key: 'putaway' });` | `'putaway'` |
| printer.js:426 | `() => setUpPrinter('Setting Up the 3D Printer'), { key: 'printer-setup` | `'printer-setup'` |
| printer.js:841 | `() => printSomething(idea, 'Decided to Print Something'), { key: 'prin` | `'print:' + (idea.what \|\| pr.what \|\| '')` |
| projects.js:346 | `() => startProject(plan.key, 'Read About It Online'), { key: 'project:` | `'project:' + plan.key` |
| projects.js:720 | `async () => {` | `'build-project:' + p.id` |
| seasons.js:83 | `() => researchSnowTravel(), { key: 'research-snow' });` | `'research-snow'` |
| shopkeeping.js:368 | `() => listForSale(c, Number.isFinite(price) && price > 0 ? price : gue` | `'sell:' + String(si.item).slice(0, 120)` |
| shopmaker.js:344 | `() => researchMachine(o.shop, 'Learning a Shop for a Job'), { key: `le` | ``learn:${o.shop}`` |
| shopmaker.js:357 | `() => makerRunOrder(o.id), { key: `make:${o.id}` });` | ``make:${o.id}`` |
| shopmaker.js:506 | `putAwayItems, { key: 'putaway' });` | `'putaway'` |
| shopmaker.js:749 | `putAwayItems, { key: 'putaway' });` | `'putaway'` |
| shopmaker.js:794 | `putAwayItems, { key: 'putaway' });` | `'putaway'` |
| shopmaker.js:833 | `putAwayItems, { key: 'putaway' });` | `'putaway'` |
| shopmaker.js:1032 | `() => researchMachine(l.make, 'Learning a Shop for a Build'), { key: `` | ``learn:${l.make}`` |
| shopmaker.js:1033 | `() => makerMakeBuildPart(p.id, l.id), { key: `part:${p.id}:${l.id}` })` | ``part:${p.id}:${l.id}`` |
| skills.js:174 | `() => practiseSkill(c), { key: `skill:${c.kind}:${(c.vehicle && c.vehi` | ``skill:${c.kind}:${(c.vehicle && c.vehicle.name) \|\| (c.hobby && c.hobby.name) \|\| ''}`` |
| storehouse.js:593 | `putAwayItems, { key: 'putaway' });` | `'putaway'` |
| trips.js:1440 | `() => {` | `k` |
| upgrades.js:949 | `() => { Promise.resolve(codeAnUpgrade(title ? `Decided: ${String(title` | ``upgrade:${String(title \|\| '').slice(0, 40)}:${String(check.code).length}:${String(check.code).slice(0, 160)}`` |
| viewer.js:236 | `job, { key: `viewer-take:${what}:${name}` });` | ``viewer-take:${what}:${name}`` |
| weather.js:85 | `() => iceOuting('At the Edge of the Ice'), { key: 'ice-outing' });` | `'ice-outing'` |
| weather.js:450 | `() => researchIce(), { key: 'research-ice' });` | `'research-ice'` |
| weather.js:492 | `() => testTheIce(), { key: 'test-ice' });` | `'test-ice'` |
| weather.js:553 | `() => walkOnIce(firstTime ? 'First Steps on the Ice' : 'Out on the Ice` | `'walk-ice'` |
| wishfeatures.js:166 | `() => {` | `'wish-try:' + f.key` |
| wishfeatures.js:254 | `() => { try { Promise.resolve(f.run('Decided to ' + (f.aiHint.split('` | `'wish:' + f.key` |


**Evidence and tests** (`openfix.js free`, which calls the real decision functions while he is busy and counts `freeQueue`):

| Check | main | branch |
|---|---|---|
| two chop decisions at different places | FAIL (1 job) | PASS (2) |
| the same chop twice | PASS (1) | PASS (1) |
| selling two different things (`sellItemDecision`) | FAIL (1) | PASS (2) |
| two machine jobs, a stool then a shelf (`useMachineDecision`) | FAIL (1) | PASS (2) |
| eat twice / put away three times | PASS (1 each) | PASS (1 each) |
| two calls without a key | FAIL (1) | PASS (2) |

## 2. Duplicate names confused the Storehouse
**Change** (`js/storehouse.js`, `js/basements.js`, `js/viewer.js`, `js/portal.js`, `js/agent.js`).
- Each copy on the shelves now has its own record: `state.storeCopies = [{ id, name, slot, out }]`. `slot` counts
  across floors, 36 per floor.
- `syncStoreCopies()` keeps the records in line with his lists, because many files add, use up or rename things directly.
  A copy that is gone loses its record (one he has out goes first, otherwise the highest slot). A copy with no record
  gets the slot just freed (so a rename keeps its place) or the lowest empty one.
- `state.unstoredItems` is still one name per copy. A waiting copy now hides only itself, not every copy with that name.
- Put-away gives each new copy its own empty slot, worked out before he walks, instead of `findIndex` landing on the
  older copy's slot. It also removes only one waiting entry, where it used to remove all entries with that name.
- `storedItems()` returns the copies in slot order, each with `id` and `slot`. Every caller now uses `it.slot` instead
  of the list index: the shelves, the basement rooms, the viewer, the inventory floor labels, the fetch target and the
  basement level count.
- Old saves: with no `storeCopies`, the records are laid out exactly as the old code showed the shelves, in the old
  reversed order with the old name-based hiding. Copies the old code wrongly hid then get free slots after those. Load
  also forces this when an older save has no records, even if the shelves drew before the load. Damaged records are
  cleaned (`cleanStoreCopies`: one per slot, unique ids).

**Tests** (`openfix.js store`: an older save is simulated by removing `storeCopies` from every brain write, then reloading):

| Check | main | branch |
|---|---|---|
| an older save keeps its shelf layout (Pebble, Pebble, Yo-yo, Wrench, Hand saw in slots 0-4) | PASS* | PASS |
| the stored Claw hammer shows while a second copy is still waiting to be put away | FAIL (0 shown) | PASS (slot 5) |
| each copy has its own id and slot | FAIL | PASS |
| taking one of two Pebbles out hides only that copy | FAIL | PASS (slot 0 out, slot 1 still shown) |
| needing it again before putting it back takes no second copy | n/a | PASS |
| putting it back returns it to its own slot | PASS* | PASS (slots 0, 1) |
| the new Claw hammer gets its own slot; the older copy stays put | FAIL | PASS (5 → 5, 6) |
| records (ids, slots, a copy out) survive a reload | FAIL (none) | PASS (identical) |

\* main has no slot field, so these two checks pass on main without testing anything.

## 3. A shelf item taken out to use stayed hidden
**Owner's decision:** while he is using or holding the thing, its spot shows empty. It reappears on its slot when he puts
it back.

**Change:**
- `fetchFromStorehouse` marks the copy it took as `out` once it is in his hands. Its slot then shows empty upstairs, in
  the basement room (`fillStorehouseRoom` skips it) and in the 12-a-page viewer.
- The viewer now lays out one cell per slot, so its pages match the shelves. An empty slot is an empty cell, and a slot
  whose thing is out says "<name> is out".
- Fetching queues `putAwayItems` (key `putaway`), and the life tick also puts things back (`storehouseHasPutAway()`).
  Once he is free again he walks the copy back to its own slot, so the hidden model no longer gets stuck.
- The fetch now matches the model in the right slot and on the right floor (`slotIndex`, `storeLevel`), not just the
  first model with that name.
- Museum: a piece taken out (to the valley or the pit) leaves the collection, so the Museum, its basement galleries and
  the viewer all drop it together. That already worked; it is now tested, and needed no change.

**Tests** (`openfix.js shelf`, real indoor trips: the Hand saw upstairs, then one of two Claw hammers in basement B1;
`openfix.js museum`):

| Check | main | branch |
|---|---|---|
| Hand saw taken out: its slot is empty on the shelf, in the basement room and in the viewer | FAIL (on main it sat in B1: the basement room and viewer still show it) | PASS |
| Hand saw put back: shows on its own slot again | FAIL (no put-back: `putAwayItems` returns false) | PASS |
| Claw hammer (B1) taken out: its slot is empty everywhere; the other hammer is still shown | FAIL (the basement room and viewer still show it) | PASS |
| Claw hammer put back on its own B1 slot | FAIL | PASS |
| a Museum piece taken out is gone from the Museum, its basement and the viewer; the other 11 stay | PASS | PASS |

Screenshots (`shots/openfix-shelf-saw-out.png`, `shots/openfix-shelf-saw-back.png`) show the trip ("Grabbing the Hand saw", then "Putting the Hand saw back" / "The Hand saw is back on the shelf."). The shelf is too dark at that camera angle to see slot 0, so the evidence is the scene-graph checks above: which visible models sit in which slot, upstairs and in a freshly built basement room, plus the viewer's cells.

## 4. The letter queue was transient
**Change** (`js/agent.js`, `js/postoffice.js`):
- `unopenedNotesQueue` is no longer in `TRANSIENT_STATE_KEYS`, and holds at most 20 letters (the oldest unread one is
  dropped first).
- A letter stays in the queue until he has finished reading it. It is then removed and its id goes into
  `state.readNoteIds` (the last 100). `notesBeingRead` stops two life ticks reading the same letter at once.
- `queueVisitorNote` refuses a letter that is already waiting or already read, and the ids come from the parcel id. So
  a parcel opened again after a reload partway through a mail run isn't read twice.
- On load, `cleanNotesQueue` keeps only well-formed letters and drops ones already read or listed twice. Older saves
  load with an empty queue, the same as before.

**Tests** (`openfix.js notes`):

| Check | main | branch |
|---|---|---|
| a letter waiting to be read survives a reload (still waiting, or read since) | FAIL (lost) | PASS (read after the reload, "After Reading a Note" in the diary) |
| once read it leaves the queue, and the same letter opened again isn't read twice | FAIL (logged and read again) | PASS |
| after another reload nothing is waiting | PASS | PASS |
| the saved queue is bounded | FAIL (no bound) | PASS (20 of 30) |

## 5. Settings Save always started an AI decision
**Change** (`js/main.js`): `aiKeySetApplied` records the Gemini and Claude keys he is thinking with. It is set at
startup, when the secure store loads, on each re-check and on each Save. Save calls `switchToAIThinking()` only when the
set changed: a key added, removed or replaced. Otherwise it just shows "Settings saved". The merge kept main's
photo-source keys (`refsSetKeys`); they aren't AI keys and don't trigger a decision.

**Tests** (`openfix.js settings`, counting `decideNextAction` calls per Save):

| Save | main | branch |
|---|---|---|
| new key | 1 | 1 |
| same key, only the shop contact changed (twice) | 1, 1 (FAIL) | 0, 0 |
| key changed | 1 | 1 |
| no key | 0 | 0 |

## Regressions on the final branch (d493b6f: origin/main 416ca1e with skins, kelo-handoff and reference paintings merged; one at a time, software GL)
All exit 0 with "page errors: none" unless noted:
- `openfix.js all`: 27 PASS (753 s)
- `audit.js all`: 18 PASS and 1 FAIL, `museum` (see below)
- `harness.js` reload (71 s), ui (155 s), chat (322 s), vehicle (53 s), haul (336 s), basement (114 s)
- `uitest.js both`: desktop 151 and phone 148 controls pressed, 0 problems (1841 s)

After that, main gained only fba283a (`brain/growth.json`, data only). It was merged as the branch tip without another
rerun.

Earlier runs:
- On the branch before any merge, and after merging 7539b6b (4a34ffc): the same set, all PASS, with audit 19/19 at 4a34ffc.
- `openfix.js shelf` was rerun on 4a34ffc with the final test code: 4 PASS.

**`audit.js museum`** fails some runs on both main and the branch. After the reload he is correctly outside the Museum,
but his life ticks walk him away from the door before the check reads his position:
- main: failed 2 of 2 runs
- branch: failed 3 runs and passed 1

It is a timing race in that check, not a regression.

**`harness.js basement`** prints `put away: false` on both main and the branch: he is busy "Found a Workshop" at that
step. The real basement take-out and put-back are covered by `openfix.js shelf`.

Checks: `node --check` on every JS file; the top-level duplicate-name check prints nothing; no `doWhenFree` call without
a key; no remaining `storedItems()` index-as-slot use.
