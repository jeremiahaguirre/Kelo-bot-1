# HUD cleanup: report (branch `agent/hudux`)

Polish and reorganisation of the screen over the 3D world. No new features. The side-menu tab contents are untouched.

## Commits (agent/hudux)
- `bc18a86` HUD: one compact status block, one activity card, tidy camera control and controls
- `0a735da` HUD: time first in the clock line, Eyes note under the camera control on phones, activity chips wrap when narrow
- `d39e396` Handoff: HUD notes

Files: `index.html`, `css/style.css`, `css/native.css`, `js/hud.js` (new, loaded before menuui.js), small edits to `js/main.js`, `js/worldclock.js`, `js/eyecam.js` and `js/needs.js`. Not touched: explore.js internals, minimap.js drawing, Workshop code, animations.js, kelo-ik.js, kelo-mocap.js.

## What changed, per element
- **Status block (top left).** One line holds the avatar, "Kelo-1" and the clock: time first, then day, season, and the sky (rain or ice wins over wind, e.g. "Windy"). The full text is in its tooltip. Below that are six small colour meters (icon + bar). Tapping or hovering opens a pop-up with labels and numbers (Energy, Fullness, Water, Joy, Wonder, Calm). Escape or tapping elsewhere closes it. Removed from this block: the mood badge, the stale quote line and the rhythm line, which duplicated the activity card. The old NRG/FUL/H2O codes are now plain words.
- **Activity card (bottom middle).** It is now the single place for what he does and says: emoji + title, a place chip (pin icon) and a Follow chip, then the quote, clamped to two lines. The Follow chip is filled amber when the camera isn't following him and quiet when it is (`aria-pressed`). The chips wrap under the title when the card is narrow.
- **Camera control.** One segmented control (Follow / Explore / Eyes), a divider, then Places and Help. On phones Places is icon-only. With the menu open on a tablet the whole bar is icon-only. The Places panel uses the same glass and tokens.
- **Where is Kelo-1?** Shown only while exploring, or when following has lost him off screen. Never shown in Eyes.
- **Eyes HUD.** Now a small note: "Eyes · Looking at …" with Hide and ✕. "Thinking" was dropped because it is in the activity card. It sits above the activity card (under the camera control on phones, where the touch controls fill that space) and fades to 32% after 4 s unless hovered, focused or tapped. Its text is written only when it changes, so screen readers don't repeat it.
- **Movement.** On desktop the pad shows only in Explore (smaller, semi-transparent). In Follow and Eyes a small keys hint shows instead. On touch screens the joystick is 96 px and the buttons are a 2x2 grid of 44 px, both see-through. On tablets they sit at the bottom edge beside the card.
- **Minimap.** Only the frame changed: 144x90 (176x110 on large screens), a compact header with zoom and a fold button, and a 44 px map button when folded. Ids are kept and the drawing is unchanged.
- **Top right.** Settings and menu buttons use the same tokens, and the mail badge has a ring.
- **System.** Shared `--hud-*` tokens for glass, border, radius, shadow, spacing and control height (36 px with a mouse, 44 px on touch). Small buttons get 44 px touch areas. Safe-area insets are applied (`css/native.css` maps the app's insets onto the tokens). With the side menu open, panels shrink into the visible part of the world, and the map and pads hide when there isn't room. Transitions are off with reduced motion. HUD text and bar widths are written only when they change (`hudSetText`). HUD icons are Phosphor with emoji fallbacks if the font fails.
- **Ids.** Every id other code uses is kept. `headerEmotionBadge`, `headerObsessionText` and `rhythmStateBadge` were removed; only main.js and agent.js used them, and both are updated or null-safe. No qa script references them.

## Screenshots
`before/` (main) and `after/` (agent/hudux) at 1280x800, 1920x1080, 768x1024 and 390x844, each in follow, explore, eyes and menu (side menu open), at deviceScaleFactor 2. The 768 and 390 views are emulated touch devices.
Note: the "before" shots ran with the icon font stubbed, so the gear and menu icons show emoji. The "after" shots load the real Phosphor font as the live site does. The 3D scene and time of day differ slightly between runs.

## Tests (`qa/harness.js`, one at a time)
| scenario | result |
|---|---|
| reload | exit 0, page errors: none |
| chat | exit 0, page errors: none |
| ui | exit 0, page errors: none |
| skills | exit 0, page errors: none |

`node --check` passes on the changed JS, and the duplicate top-level name check prints nothing.

## Left / notes
- `exploreFitToPanel` (explore.js) still sets `--explore-top` and `--explore-above-panel` every 1.5 s. The HUD relies on it, and it wasn't changed.
- At 390 px the clock line truncates after the season ("7:01 AM · Day 1 · 🍂 Autu…"). The full text is in the tooltip.
- At 1920x1080 with the menu open, the map stays visible (there is room beyond 1500 px) and doesn't collide with the card (see `after/1920x1080-menu.png`).
