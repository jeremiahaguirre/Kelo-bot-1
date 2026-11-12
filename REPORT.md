# Audit: Workshop, town places and UI (branch `agent/audit-places`)

Scope: Workshop machines and jobs, the forklift, shop-maker orders, town interiors and visits, Storehouse/Museum
basements and the shelf viewer, the Post Office, NetNode, his shop page, and every part of the UI.
Method: three static read-throughs (every claim checked against callers before fixing), then Playwright tests.
All fixes are small, one commit each, on `agent/audit-places` (not merged). Tests live here in `qa/`.

## New tests (this branch)
- `qa/audit.js [all|maker,mail,keys,escape,museum,name,roof,hidden,settingsesc]`: one PASS/FAIL line per fixed bug
  (save/reload, mail run, stuck keys, Escape layering, Museum reload, visitor name, roof label, `.hidden`, dialog focus).
- `qa/uitest.js [desktop|phone|both]`: UI click-through. Opens every menu tab and presses every visible control
  (about 130 per device; it skips reset/delete/sell/import/export), then the HUD buttons, the settings dialog (close
  button, Escape, backdrop), the settings persisting across a reload, and typing in the chat box. It reports page errors
  per click, off-screen or overlapping HUD controls, horizontal scroll, and dialogs that stay open after Escape.
  Wikipedia is offline (network error) and AI is HTTP 500 during the run.
- `qa/ws.js glassonce | woodonce | garagebrakes`: each supply is used once per job, a brake job checks brake
  supplies, and a visitor's Workshop ask is kept while its supplies are missing.

## Bugs, ranked (F = fixed on agent/audit-places, O = open/written up)

### High
1. **F: Shop-maker orders, learned kinds and uses were lost on every reload.** `js/shopmaker.js:73` creates
   `state.makerKinds/makerThings/makerOrders/makerUses` lazily. The loader (`js/agent.js` loadPersistentBrainState) only
   restores keys that already exist in the `state` literal, so they were saved but never read back. Repro: start a
   shop order ("make me a stool"), reload, and the order is gone. Fix: the four keys are in the `state` literal now.
   Test: `audit.js maker` (FAIL on main, PASS on the branch).
2. **F: The glass studio and woodshop used up supplies on every animation frame.** `glassstudio.js:297,302` and
   `woodshop.js:345,361-363` called `useWorkshopSupply` inside the per-frame animation while `k < 0.05`. That is
   about 7-10 frames at 60 Hz and more on 120/144 Hz screens, and the colour frit call ran with n=0 on every frame.
   One vase used several bags of cullet, firings of gas, sheets of sandpaper and cans of finish, then asked again.
   Fix: each supply is taken once per job. Test: `ws.js glassonce`, `ws.js woodonce`.
3. **F: The Post Office lost parcels.** `postoffice.js pickUpMail` spliced up to 3 parcels out of `state.mailbox` and
   saved before opening any of them. If the page closed while he opened parcel 1 (the AI/unbox steps take seconds),
   parcels 2-3 were gone for good. A throw in `openParcel` also dropped the rest. Fix: each parcel leaves the mailbox
   only as he opens it, with a try/catch per parcel. Test: `audit.js mail`. On main it times out: parcel A throws, so
   B and C are never opened and are already gone from the mailbox.
4. **F: Pan keys could stick for good and the camera drifted forever.** The legacy `main.js` keydown pressed
   `arrowKeyState` for Ctrl/Cmd shortcuts and for keys typed in a `<select>`. explore.js stops the keyup, so the key
   was never released. Repro: Ctrl+S, Cmd+A, or ↓ in Settings' "Graphics quality". Fix: skip modifiers and
   select/contentEditable, release on keyup in the capture phase, clear all keys on blur. Test: `audit.js keys`.

### Medium
5. **F: Garage readiness always checked oil-change supplies.** `needsFor` used `GARAGE_SERVICES[job.service] || oil`,
   but AI/visitor jobs carry `service: "a brake job"` (not a key), and `plan()` then picks brakes. The job ran without
   pads and reset the wear anyway. Fix: one `garageServiceFor(job)` is shared by both. Test: `ws.js garagebrakes`.
6. **F: Visitor Workshop asks were dropped when supplies were missing.** `takeWorkshopAsk` shifted the ask off the
   queue and never put it back, though he had promised to make it. Fix: the ask is kept and retried every 5 min for
   about a day (quiet after the first supply request). Test: `ws.js garagebrakes` (askretry).
7. **F: A visitor's Workshop ask could start during a mail run, and the forklift's upstairs tour set no busy flag.**
   `takeWorkshopAsk` (on a timer) ignored `isCollectingMail` and redirected his mail walk. `forkliftDeliverUpstairs`
   never set `isPracticing`, so his life tick started other things mid-tour. Both fixed. (A guard in `runMachineJob`
   itself was tried and reverted: the QA harness and possibly other callers use `isCollectingMail` to hold his life.)
8. **F: Museum viewer "Throw out" could throw out a Storehouse item instead.** `viewer.js` called `disposeItem(name)`,
   which prefers an owned item with the same name (case-insensitive, ignoring a/an/the). Repro: a sculpture "Kite"
   and an owned "Kite" both exist. Also, `doWhenFree(job)` dedups by the closure's source text, so a second
   suggestion (another item) was silently dropped. Fix: Museum pieces go through `takeOutOfMuseum`, and each
   suggestion has its own key.
9. **F: `.hidden` didn't hide components in the app builds.** scripts/build-web.mjs puts tailwind.css before
   style.css, so `.ui-btn`, `.ui-row`, `.ui-empty`, `.journal-featured`, `.ui-card` and others kept their display.
   That shows "Copy all as markdown (0)", the featured diary card during search, and "Nothing for sale" next to
   listings. Fix: `.hidden` is `display:none !important`, except on elements with a responsive override
   (`hidden sm:grid`). Test: `audit.js hidden`.
10. **F: Escape closed the side menu together with a dialog or viewer.** Fix: a first capture listener notes whether
    an overlay was open, and the menu only closes when none was. Escape also closes the help card when its checkbox
    has focus. Test: `audit.js escape`.
11. **F: Settings didn't close on Escape when focus was in a Talk sheet.** Found by `uitest.js`: the gift sheet stops
    Escape, and the dialog never took focus. Fix: the settings and code dialogs focus their first control on open, and
    settings gives focus back on close. Test: `audit.js settingsesc`.
    The click-through then found a second cause: "Visit the Workshop" opens the Workshop chooser, whose document-level
    Escape handler (`shopvisit.js` ~1133) closed the chooser and stopped the event, so Settings opened on top stayed
    open. The same happened during a visit (explore.js passed Escape to `shopVisitKey` first). Fix: a dialog on top
    gets Escape first. Test: `audit.js visitesc`.
12. **F: Network calls had no timeout.** NetNode's Wikipedia, Wiktionary and DuckDuckGo calls, Gemini, and Claude
    (SDK default 10 min × 3 tries) could keep him busy at a computer for a long time on a stalled connection.
    Fix: 15 s for NetNode, 90 s for AI (one retry for Claude). A later NetNode hop that fails keeps the articles
    already read (it used to drop all of them).
13. **F: A failed weld build was re-run (and failed) on every reload.** The `catch` in `workshop.js weldAndPlace` said
    "dropped" but left the job in `state.pendingBuilds`. Fixed.
14. **F: A shop order stayed "making" for the session if its machine job threw.** No catch in `makerRunOrder`.
    Fixed (the order falls back to waiting).

### Low
15. **F: Reload mid-Museum trip left him inside the Museum.** `town.js townMoveOutOfBuildings` didn't include the
    Museum, so `pushOutOfObstacles` popped him out through a wall. Test: `audit.js museum`.
16. **F: A cleared visitor name came back after a reload** (`lastVisitorName` was only written when non-empty).
    Test: `audit.js name`.
17. **F: The roof button said "Cutaway" after a reload with solid roofs.** Test: `audit.js roof`.
18. **F: The gift-log spinner "still thinking" spun forever after a reload mid-opening.** It now shows only while
    he is collecting mail.
19. **F: An invalid shop contact in Settings closed the dialog and discarded the input.** The dialog now stays open.
20. **F: The Android back button minimised the app** with How-to-explore, Places, the Workshop chooser or a Workshop
    visit open. It closes those first now.
21. **F: His shop page kept listings he had taken down** when an older published `shop-data.json` still had them.
    `shop.removed` ids are filtered out like sold ones.
22. **F: Small leaks.** A turned-away photo parcel kept its image in memory, a thrown-out painting kept its saved
    images, and forklift pallets piled up in the scene (the last 6 are kept). Each machine's "research it first"
    request is queued separately (`doWhenFree` merged them).

### Open (written up, not changed)
- **O: `doWhenFree` merges every closure with the same source text** (`agent.js:2225`, key = `fn.toString()`).
  Around 40 call sites pass `() => something(arg)` without a key, e.g. `agent.js:2159-2179` (take out, use, dispose
  decisions), `printer.js:833`, `paintstudio.js:693`. A second decision with a different argument is dropped while
  the first waits. Some merging may be intended (one dig at a time), so this is the decisions session's call. A key
  per argument, or including the argument in the default key, would fix it.
- **O: Duplicate item names confuse the Storehouse** (`storehouse.js:30` `storedItems()` hides every stored copy whose
  name is in `unstoredItems`; put-away uses `findIndex` and walks to the older copy's slot). It needs per-copy
  counting: a behaviour change in the inventory model.
- **O: A shelf item stays hidden after he takes it out to use** (`basements.js:708` sets `real.visible = false`; the
  render key doesn't change while he still owns it). Whether a used item should show on the shelf while it's in his
  hands is a design choice.
- **O: `unopenedNotesQueue` is transient**, so a letter queued for reading but not yet read is lost on reload
  (`agent.js` TRANSIENT_STATE_KEYS). Making it persistent touches the decisions loop.
- **O: Settings Save fires an extra `switchToAIThinking()` decision on every save with a key**, even if only the shop
  contact changed (main.js Save handler). Harmless but wasteful.

## Test results

### Before/after (the same checks against `main` and against `agent/audit-places`)
| Check | main | branch |
|---|---|---|
| `audit.js maker`: shop-maker orders survive a reload | FAIL (order and thing gone) | PASS |
| `audit.js mail`: a failing parcel, then a reload mid-run | FAIL (times out: B and C never opened, already gone from the mailbox) | PASS (C still waiting) |
| `audit.js frames`: supplies per job when a step draws 5 early frames | FAIL (every supply taken 5×) | PASS (1× each) |
| `ws.js garagebrakes`: a brake job checks brake supplies | FAIL (needs = oil only, ready = true) | PASS |
| `ws.js garagebrakes`: a visitor ask waits for supplies | FAIL (ask dropped) | PASS |
| `audit.js keys`: Ctrl+S / ↓ in a list box | FAIL (KeyS / ArrowDown stuck) | PASS |
| `audit.js escape`: Escape on the code dialog | FAIL (menu closed too) | PASS |
| `audit.js museum`: reload inside the Museum | FAIL (pushed out through a wall at -32.4, 5.1) | PASS (at the door) |
| `audit.js name`: cleared visitor name after reload | FAIL ("Ann" back) | PASS |
| `audit.js roof`: roof label after reload | FAIL ("Cutaway" with solid roofs) | PASS |
| `audit.js hidden`: `.hidden` elements | FAIL (on the web build too: `btnCopyCodeWishlist`, `codeWishSummary` show) | PASS |
| `audit.js settingsesc`: focus in the Talk gift sheet | FAIL | PASS |
| `audit.js visitesc`: Settings over the Workshop chooser | FAIL | PASS |

(`ws.js woodonce` / `glassonce` pass on both: this machine renders without a GPU, so a step's first 5% spans only
one frame. `audit.js frames` drives the frames directly to show the bug.)

### Regressions on the final branch (one at a time, software GL)
All exit 0 with "page errors: none":
- harness.js reload (47 s), chat (147 s), ui (94 s), skills (520 s), printshop (251 s), basement (197 s)
- itest.js netnode (129 s), cafe (116 s), post (153 s)
- ws.js sla (1941 s), haas (836 s), pcb (2550 s), garage (1765 s; tires and oil jobs done, wear reset), forklift (1131 s)
- visit.js, the Workshop viewer, desktop + phone (1115 s)
- ws.js glassonce (job done; furnaceGas, glassBatch, colourFrit 1× each), woodonce (1× each), garagebrakes
- audit.js all: 18 PASS
- uitest.js both: desktop 127 controls, phone 128 controls pressed, 0 problems (no off-screen or overlapping HUD
  controls, no horizontal scroll, every dialog closes on Escape, Graphics and Draw-distance settings persist across a
  reload, typing in the chat box holds no camera key). The first run found the Settings/Escape layering bug (#11),
  since fixed.

Checks: `node --check` on every changed JS file; the duplicate-name check prints nothing.
