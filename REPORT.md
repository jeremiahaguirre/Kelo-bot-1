# Workshop visit (agent/shopview): finished against the current Workshop

## Commits on agent/shopview (this session)
- f5a0734 Merge origin/main into agent/shopview (handoff.md and style.css conflicts: both sides kept)
- 593fa97 Clear viewing spots with line of sight, obstacles and areas from the registries, floor hiding through wsSetDecksFor
- a229e8e Panel, buttons and filter match the menu redesign, grab handle on the phone sheet
- 00cb331 See overhead machines (fume hood) and the elevator shaft on your floor from their viewing spots
- 3faf20d Handoff: Workshop visit after the machine remodel
- 0349999 Try the farther rings before the close one (phone re-run: 4 targets clear, fails: none, page errors: none)

## What changed
- `svViewSpot(t)` finds the viewing spot: first a step back from where he stands to work the machine, then rings round it at growing distances. A spot counts only if a line-of-sight check (`svSeesFrom`) hits that machine first. `svGoToTarget` uses the spot and pitches the view toward the machine's height.
- Walk obstacles on every floor are now `wsObstacles(floor)`, the same list his own indoor routes use. That list includes the remodelled and moved machines and the car elevator's open edges. The floor-1 weld and bench stations are added on top.
- The viewer reads its geometry and targets from the registries again at each visit start. A machine's area comes from its position, and the chooser's notes come from WORKSHOP_MACHINES, WORKSHOP_STATIONS, WORKSHOP_HANGAR_BAYS and WS_WING.spots. Bays and machines added later (agent/runway) will show up on their own. A whole new hall still needs a walkable rectangle in svGeo and an SV_AREAS entry.
- Floor hiding goes through main's `wsSetDecksFor`, called only when the deck state differs, so `wsViewCull` hides the machines under your deck.
- The elevator target is the car, or the shaft on your floor while the car is on another floor.
- The viewer's own panels now follow the menu redesign: neutral borders, 12px-radius 36px buttons, and a menu-style search field. The phone sheet has a grab handle. The global HUD is not restyled.

## Tests (run one at a time, 1280x800, deviceScaleFactor 1)
- `harness.js reload ui`: exit 0, page errors: none
- `ws.js sla floor3`: exit 0, page errors: none
- `visit.js` (new, in this branch): exit 0, fails: none, page errors: none. It covers the chooser, all 5 areas with floor-hiding checks, and all 79 targets (each one has a clear viewing spot, its card opens and the target is in view). It also checks the machines list, stairs 1->2->1, elevator rides to 3 and 1 from the landing buttons, and that Exit restores the camera mode, fov, near plane, HUD, roofs and decks.
- Phone run (390x844, only the photographed targets): fails: none, page errors: none.
- Usage: `KELO_ROOT=... PORT=8900 node visit.js`. Optional: `VW=390 VH=844` for phone, `SHOTS=key,key` to photograph cards, `ONLY=1` to check only those, `DSF=2`. A full run at DSF=2 timed out after 78 of 79 targets (it is slow), so do full checks at DSF 1.

## Screenshots (shopview-shots/, deviceScaleFactor 2)
- Desktop 1280x800: each area (hangar, wing, f1, f2, f3), the machines list, after exit, and cards for taurus, haasvs1, pnp, lift2, fumehood, glassfurnace, tablesaw and elevator.
- Phone 390x844: each area, the list, after exit, and bottom-sheet cards for pnp and lift2.

## Left
- On a tall phone screen the viewing spot is sometimes close to big machines (the pick-and-place is seen from 1.25 units: its first-choice spot, a step back from his work spot, is free and clear, but its row's aisle has no room further back), so you see part of the machine. The spot is clear, and you can step back.
- New halls from agent/runway need their walkable rectangle and an SV_AREAS entry once that branch lands.
