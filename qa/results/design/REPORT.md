# Design pass (branch `agent/design`): report

Polish only, no new features. Every element id that other code or tests use is unchanged.

## Commits (agent/design, on top of main)

- `7b5068a` Design tokens: one --hud-* token set, Tailwind theme mapped onto it, shared components; Post/GitHub/World/Map tabs and dialogs use them
- `b7553f8` HUD and menu polish: no filler avatar/labels, Eyes note folds instead of fading, neutral section headings, counts as numbers, spacing instead of borders, italics only for his words
- `9624596` Cards and feedback: request and parts-list cards on the shared components, tabular figures instead of monospace, no decorative gradients, toasts without ornament emoji, a short flash on sent/copied
- `333e1fc` His shop page: tokens and components, no gradients or shouting badges, a loading skeleton and an offline error state
- `2042506` Loading and empty states: NetNode browse button shows it is busy, Phosphor icons in empty states and talk events, Talk gift sheet without emoji UI icons
- `02ff002` Phone settings use the toggle component; privacy page uses the token values
- `bf370f4` Code letters and the Storehouse/Museum viewer on the shared components; status in words, no shouting EXIT or emoji controls
- `64292fa` Places list and spot menu: Phosphor icons, neutral rows, names wrap instead of truncating
- `0f487ab` World tab preview panel: a specific title, words instead of emoji on its chips
- `a1cdeb9` Brain summary: no emoji tile icons, mood title and project lines wrap (CSS only)
- `90e248d` Headlines wrap (activity title, Brain section titles), optical alignment for icons and figures, activity title neutral
- `90586f6` DESIGN.md: the token set, rules and component patterns
- `a711653` Handoff: design pass notes
- `0670bec` Post tab lists: mail, gifts and storehouse items as rows and chips; 'thinking about it' shows as loading
- `4b3bbcb` His shop card in the Post tab on the shared components
- `9942aa8` Cards: grid children may shrink (long mail notes truncate inside the card)
- `fd70846` Preview panel: the reset button is a normal button, disabled when nothing is previewed
- `2a99489` Disabled buttons stay readable (faint text, no fill) instead of half opacity

## The token set

All in `:root` at the top of `css/style.css`, named `--hud-*` (the existing HUD tokens, extended; no parallel set).
Full table, rules and component patterns: `DESIGN.md` in the game repo.

- Colour: neutral ramp `--hud-n-50…950`, accent ramp `--hud-a-*` (amber), status ramps `--hud-ok-*`, `--hud-bad-*`, `--hud-warn-*`, `--hud-info-*` (RGB triplets, so Tailwind's `/opacity` works); roles `--hud-text`, `--hud-text-2`, `--hud-muted`, `--hud-faint`, `--hud-accent(-hover/-text/-soft/-line)`, `--hud-on-accent`, `--hud-focus`, `--hud-ok/bad/warn/info(-soft)`.
- Surfaces: `--hud-bg` (glass over the world, raised 74% → 86%), `--hud-bg-strong` (95%), `--hud-surface-0…3`, `--hud-fill(-hover)`, `--hud-scrim`. Borders `--hud-line`, `--hud-line-strong`.
- Type: `--hud-font-sans/serif/mono`, sizes `--hud-fs-3xs` 10 … `--hud-fs-4xl` 36, weights 400/500/600/700.
- Spacing `--hud-s-1…8` (4px grid), radii `--hud-r-xs…pill`, shadows `--hud-shadow`, `--hud-shadow-pop`, motion `--hud-dur-fast/dur/dur-slow`, `--hud-ease(-in)`, layers `--hud-z-labels…toast`.
- `js/twtheme.js` maps Tailwind onto them (palette, text sizes, weights, radii, shadows, durations, z-index). Decorative hues (violet, purple, indigo, fuchsia, pink, teal, lime, stone, zinc) map to the neutral ramp; `text-slate-400/500/600` map to readable text tokens. `scripts/build-web.mjs` compiles the phone apps' Tailwind with the same theme (checked: the same config compiles with tailwindcss 3.4.17, `qa/vendor/tw3/build.sh`).
- Components: `.ui-btn` (+primary/quiet/danger/sm), `.ui-icon-btn`, `.ui-chip`, `.ui-card`, `.ui-row`, `.ui-section-head/-title/-meta`, `.ui-note`, `.ui-label`, `.ui-input`, `.ui-toggle`, `.ui-toast`, `.ui-dialog`, `.ui-empty`, `.ui-loading`/`.ui-spinner`, `.ui-skeleton`, `.ui-error`, `uiFlash(el)`.

## What changed, per item of the brief

1. **Filler badges**: removed the "K1" avatar (repeats the name), the "Eyes" word tag in the Eyes note (the camera control already says Eyes), the Map label over the minimap, "LIVE-style" emoji status pills on letters/parts lists/code letters (now status in words), the shouting "🖼️ ORIGINAL PAINTING / 🖨️ 3D PRINT FILE" pills and "● Taking orders" pill on his shop, the "preview only · not saved" pill, emoji tile icons in the Brain summary.
2. **Redundant labels**: Brain counts are bare numbers ("0 built", "0 Concepts", "none" → "0"); "His last decision (details)" → "His last decision"; two selects both labelled "Graphics" in Settings → "Graphics quality" and "How far he draws the world"; tab icons kept with their single label.
3. **Italics**: `body .italic:not(.font-serif)` renders upright, and the hand-written italics (typing indicator, empty notes, "the first page of his diary") are gone. Italic stays only for his own words in the serif (speech in the activity card, diary, his letters, his outlook, his reactions).
4. **Monospace**: `font-mono` is now only on code (code viewer, upgrade JSON, specs, the repo name, API key fields, feature keys). Counts, times, prices, sizes, "0 / 500" use the UI font with tabular figures (79 → 8 uses).
5. **Design system**: see above. style.css hex colours → tokens (property-aware script), every font size/weight/radius/duration in style.css on the scale, `text-[9-12px]` one-offs (206) → `text-3xs/2xs/xs`, `font-black/extrabold` → bold, Tailwind palette/size/radius/shadow mapped. DESIGN.md documents tokens and the 13 component patterns.
8. **Group with spacing**: Post/GitHub/World/Map tabs rebuilt as cards and sections separated by space (no gradient boxes, no borders inside cards); settings, help and code dialogs are one panel with spaced sections (no boxes inside the box); Talk header/composer, diary entries, Brain sections/pills/counts, help cards and the places footer lost their divider lines and hairlines.
9. **Specific headlines**: "Okanagan Post Office" → "Waiting at the Post Office", "Picked Up & Opened" → "What he has opened", "Kelo-1's Photo Wall" → "Photos on his wall", "✉️ Letters From Kelo-1: Things He Wants & Questions" → "His letters: things he wants and questions", "World" → "His brain, the light and the camera", "🧪 Try it" → "Preview a season, time or weather", "🛒 Kelo-1's Shop" → "Things he is selling", code-letter groups → "Code letters ready to switch on" etc., Brain sections in sentence case without emoji, the viewer "📦 Storehouse" → "In his Storehouse".
11. **One accent**: amber kept (contrast fine on the dark UI). Primary buttons that were sky, indigo, purple, emerald or amber→orange gradients are now `.ui-btn-primary`; selection (camera presets, portal modes, gift ideas, preview chips) uses `aria-pressed` + accent; section titles, activity title, kickers and skill levels are neutral; rainbow Brain headings neutral; status colours only on status (sent/answered/declined, needs code, lookups).
12. **Icons**: Phosphor everywhere controls had emoji (camera presets, spot menu, Talk + menu, gift sheet close, viewer pager/exit, empty states, code letters, places shortcuts), each with a `data-hud-emoji` fallback for the existing font-failure swap. Emoji remain only as content (items, gifts, moods, places, his mood in the Brain). Toasts drop a leading ornament emoji automatically.
13. **Embellishments**: 14 gradients removed (cards, buttons, avatar, Talk empty state, journal hero, Brain hero/bars, shop header and cards, POI pins), glows (Kelo's eye glow, mail badge ring kept as a cut-out), heavy `shadow-2xl/xl/lg` mapped to two token shadows, red "🚪 EXIT" button → "Back to the world".
15. **Contrast**: glass 74% → 86%; low text steps raised (`--hud-muted` #a3b0c2, `--hud-faint` #8a99ae); the Eyes note folds to icon + close instead of fading to 32% opacity; mail badge rose-500 → rose-600; disabled buttons use faint text instead of half opacity; empty Brain sections use muted text instead of 60% opacity. Results below.
16. **Wrapping**: `text-wrap: balance` on headings and `pretty` on paragraphs; the activity title, Brain section titles, his mood title, project lines and place names wrap instead of truncating; shop text at a readable measure.
17. **Optical alignment**: icons in buttons/chips/titles nudged onto the text's centre line with `line-height: 1`; counts, times and meters use tabular figures; meta sits on the title baseline (`.ui-section-head` aligns baselines); square icon buttons have no padding so glyphs centre.
19. **Loading, empty, error**: his shop page shows a skeleton grid + "Loading his shop…" and an offline error state; "Browse now" (NetNode) shows a spinner "Browsing…" and is disabled while he reads; gift reactions show "He is still thinking about it…" with a spinner; existing states kept and restyled (Talk "Kelo-1 is thinking…", lookup "Reading", diary/brain empty and no-match states with Phosphor icons, photo viewer "No photos yet").
20. **Motion**: a press (`scale(0.97)`) on buttons, toast in/out, dialog open, tab switch (existing), `uiFlash` on sent message/gift/photos and on copied diary/lists; one global `prefers-reduced-motion` rule turns all animation and transitions off.
- **Phones/tablets/desktop and wrappers**: shots below at 390x844, 768x1024, 1280x800, 1920x1080. Phone app: `css/native.css` unchanged (it maps safe areas onto `--hud-s*`); the phone-only settings use the toggle component; build-web compiles with the theme. Windows app loads index.html as is. Privacy page uses the token values inline (its CSP allows no stylesheet).

## Contrast report

`qa/design.js contrast`: every visible text element, input placeholder and Phosphor icon, against its real background (element background stack composited over the 3D world under it, the lightest and darkest tenth of the world pixels as worst cases; gradients by their worst stop). Each menu tab is scrolled through. Scenes: day (12:00), night (23:30), snow (winter). Needs 4.5:1 (3:1 for large text and icons). Tailwind served as the site's 3.4.17, compiled from each checkout.

| Size | Before (day / night / snow) | After |
| --- | --- | --- |
| 1280x800 | 35 / 35 / 35 = **105** | 1 / 1 / 1 = **3** |
| 390x844 | 29 / 29 / 29 = **87** | 1 / 1 / 1 = **3** |

After the last fix (disabled buttons), a final run at 1280x800 on the finished branch: **0 failures** in day, night and snow (`contrast-after-final-1280x800.json`).

Before, by view (1280): Brain 66, Post 12, Diary 12, Talk 9, World 6. Typical failures: `text-slate-500` notes at 3.3–4.2:1, placeholders 4.24:1, diary vitals 3.78:1, Workshop group labels 4.05:1. An earlier baseline run (no scrolling, a different random scene) also caught the Eyes note at 1.7–2.6:1 in daylight and the mail badge at 3.67:1; both fixed. The 3 "after" failures were the disabled "Back to his real calendar" button (exempt in WCAG, 4.48:1); disabled buttons were then changed to faint text without opacity.

Files: `contrast-{before,after}-{1280x800,390x844}.json`.

## Screenshots (deviceScaleFactor 2, JPEG)

`before/` and `after/`, named `<size>-<view>.jpg`:
- HUD: `hud-follow`, `hud-explore`, `hud-places`, `hud-eyes` at 390x844, 768x1024, 1280x800, 1920x1080
- menu tabs: `tab-talk`, `tab-requests` (Post), `tab-diary`, `tab-brain`, `tab-github`, `tab-world`, `tab-map` at 390x844 and 1280x800
- `dialog-settings`, `toast`, `loading-talk` (Kelo-1 is thinking…), `empty-diary-search` at 390x844 and 1280x800

Shots use the game's Fast graphics level (software GL renders a 2x page very slowly); the UI is identical at every level. Note: the older harness served Tailwind v4's browser build, which ignores a v3 config; design.js now serves Tailwind 3.4.17 compiled from the checkout like the real site. The "before" shots were taken with the v4 build (default theme, so they look like the site did).

## Tests

`KELO_ROOT=<game> PORT=8900 node harness.js <scenario>`, one at a time, on the final agent/design:

| Scenario | Exit | Page errors |
| --- | --- | --- |
| reload | 0 | none |
| chat | 0 | none |
| ui | 0 | none |
| skills | 0 | none |
| printshop | 0 | none |
| planitems | 0 | none (treehouse built) |

`reload` also logs two `console.error` 404s for resources the harness does not serve (blocked CDN/font hosts); they are not page errors and appear on main too.
`node --check` passes on every changed JS file; the duplicate top-level name check prints nothing.

## Left / notes

- menuui.js was not touched (agent/agenda works there): the Brain summary is restyled from CSS only, and its empty-placeholder detection still keys on `.italic` (rendered upright).
- js/shopvisit.js (agent/shopview) not touched.
- Many smaller card templates in main.js, hobbies.js, mining.js, memory.js, machines.js (Brain tab cards) only got the systematic changes (token palette, sizes, no mono, no italics); their markup was not rebuilt on the components.
- POI pin labels and place lists keep their place emoji (they act as map symbols).
- The minimap header keeps its three small buttons right-aligned with the "Map" label screen-reader only.
