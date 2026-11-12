# Kelo-1 design system

Every piece of UI (the HUD over the world, the side menu and its tabs, dialogs, toasts, the
Storehouse/Museum viewer, his shop page) uses one set of tokens and a handful of components.

- **Tokens** live in `:root` at the top of `css/style.css` (all named `--hud-*`).
- **Tailwind** utilities are mapped onto the same tokens by `js/twtheme.js` (loaded right after the
  Tailwind CDN script in `index.html` and `shop.html`; `scripts/build-web.mjs` compiles the app's
  Tailwind with the same theme). So `bg-slate-800`, `text-amber-300`, `rounded-xl`, `shadow-xl`,
  `text-xs` all resolve to tokens. Use utilities for layout; use the components below for anything
  that looks like a button, card, chip, input, dialog or state.

## Tokens

| Group | Tokens | Notes |
| --- | --- | --- |
| Neutral ramp | `--hud-n-50` … `--hud-n-950` (RGB triplets) | Tailwind `slate`, and the decorative hues (`violet`, `purple`, `indigo`, `fuchsia`, `pink`, `teal`, `lime`, `stone`, `zinc`) all map here. |
| Accent | `--hud-a-50` … `--hud-a-950`; `--hud-accent`, `--hud-accent-hover`, `--hud-accent-text`, `--hud-accent-soft`, `--hud-accent-line`, `--hud-on-accent`, `--hud-focus` | Amber. **Only** for primary actions, the selected state and focus. Tailwind `amber`/`yellow`. |
| Status | `--hud-ok-*`, `--hud-bad-*`, `--hud-warn-*`, `--hud-info-*`; `--hud-ok`, `--hud-bad`, `--hud-warn`, `--hud-info` (+ `-soft`) | Only for real status: done, error/remove, waiting/blocked, lookups. Tailwind `emerald`/`green`, `rose`/`red`, `orange`, `sky`/`blue`/`cyan`. |
| Text | `--hud-text`, `--hud-text-2`, `--hud-muted`, `--hud-faint` (+ `-rgb`) | All at least 4.5:1 on `--hud-surface-2` and on the glass over a white snowfield. Tailwind `text-slate-300/400/500/600` resolve to these, so low steps never drop below AA. |
| Surfaces | `--hud-bg`, `--hud-bg-strong` (glass over the world, 86% / 95%), `--hud-surface-0…3`, `--hud-fill`, `--hud-fill-hover`, `--hud-scrim` | Menu and dialogs are solid `--hud-surface-1`; cards one step up (`-2`); hover `-3`; inputs `-0`. |
| Borders | `--hud-line`, `--hud-line-strong` | One hairline. Prefer spacing to lines. |
| Type | `--hud-font-sans` (Inter), `--hud-font-serif` (Newsreader: his own words only), `--hud-font-mono` (code only); `--hud-fs-3xs` 10 · `2xs` 11 · `xs` 12 · `sm` 13 · `base` 14 · `md` 16 · `lg` 18 · `xl` 20 · `2xl` 24 · `3xl` 30 · `4xl` 36; `--hud-fw-regular/medium/semibold/bold` (400–700) | Tailwind `text-3xs`, `text-2xs`, `text-xs`, `text-sm` (14), `text-base` (16)… |
| Spacing | `--hud-s-1` 4 · `-2` 8 · `-3` 12 · `-4` 16 · `-5` 20 · `-6` 24 · `-8` 32; `--hud-gap` | 4px grid. |
| Radii | `--hud-r-xs` 4 · `-sm` 8 · `-ctl` 10 · `-md` 12 · `--hud-r` 16 · `-lg` 20 · `-pill` | Tailwind `rounded` → xs, `lg` → sm, `xl` → md, `2xl` → r, `3xl` → lg. |
| Shadows | `--hud-shadow` (panels over the world), `--hud-shadow-pop` (menus, dialogs, toasts) | No glows. |
| Motion | `--hud-dur-fast` 120ms · `--hud-dur` 180ms · `--hud-dur-slow` 300ms; `--hud-ease`, `--hud-ease-in` | `prefers-reduced-motion` turns all of it off (one rule in style.css). |
| Layers | `--hud-z-labels` 15 · `-hud` 20 · `-pop` 30 · `-menu` 40 · `-dialog` 50 · `-toast` 60 | Tailwind `z-20…z-50` map here. |
| Safe areas | `--hud-st/sr/sb/sl` | `css/native.css` maps them to the phone's insets. |

## Rules

1. No decorative badges, pills or emoji next to titles. A chip either is a choice or carries a fact.
2. No label that repeats the value, icon or heading. Counts are bare numbers next to a specific title.
3. Italics only for his own words (speech, diary, his letters), set in the serif. `.italic` on anything
   else renders upright.
4. Monospace only for code (specs, JSON, repo names, API keys). Numbers that tick or line up use
   `tabular-nums` (or `.ui-num`) in the UI font.
5. One accent. Primary action per view = `.ui-btn-primary`. Selection = `aria-pressed`/`aria-selected`
   on a chip. Everything else neutral; status colours only for status.
6. Group with spacing. No borders inside cards, no boxes inside boxes.
7. Titles say what is there ("What he has opened", "Code letters ready to switch on"). Headings use
   `text-wrap: balance`; important titles wrap rather than truncate.
8. Icons: Phosphor only (`ph-bold` in controls, `ph-fill` in the HUD meters), 14–18px. In the game
   page give each icon a `data-hud-emoji` fallback (main.js swaps them in if the icon font fails).
   Emoji only as content: items, gifts, moods, places.
9. No decorative gradients, glows, double borders, sparkles. (Exceptions with a job: the Eyes visor
   vignette, the skeleton shimmer, the shelf wood in the Storehouse viewer.)
10. Motion only as feedback: press (`scale(0.97)`), tab switch, toast in/out, `uiFlash(el)` on
    sent/saved/copied, dialog open. Respect reduced motion.

## Components (css/style.css, "Components")

| Pattern | Markup | Notes |
| --- | --- | --- |
| Button | `button.ui-btn` (+ `.ui-btn-primary`, `.ui-btn-quiet`, `.ui-btn-danger`, `.ui-btn-sm`) | 36px (44px on touch). Leading `<i class="ph-bold …">` optional. |
| Icon button | `button.ui-icon-btn` with `aria-label` | Close buttons, pager. |
| Chip | `.ui-chip`; `button.ui-chip[aria-pressed]` for choices | Selected = accent soft. |
| Card | `.ui-card` (+ `.ui-card-done` for finished items, `.ui-card-inset`) | Grid with 12px gap; no border. |
| List row | `.ui-row` | 40px min, quiet fill. |
| Section header | `.ui-section-head` > `h3.ui-section-title` + `.ui-section-meta` | Meta = count or status in words. |
| Input | `.ui-input` (inputs, selects, text areas) + `label.ui-label` or `.sr-only` label | Accent focus ring. |
| Toggle | `input[type=checkbox][role=switch].ui-toggle` | |
| Toast | `showToast(msg)` → `.ui-toast` in `#toastContainer` | Leading emoji in the message is stripped; `role="status"`. |
| Dialog | `.ui-dialog.hidden` > `.ui-dialog-panel` > `.ui-dialog-head` (`.ui-dialog-title`, close `.ui-icon-btn`), `.ui-dialog-section`s, `.ui-dialog-foot` | Show by removing `.hidden`. |
| Empty state | `.ui-empty` > `i` + `.ui-empty-title` + `p` (the menu's own `.menu-empty` is the same pattern) | Say what will appear and how. |
| Loading | `.ui-loading` > `.ui-spinner` + text; `.ui-skeleton` bars for content that is coming | Always with words ("Loading his shop…", "Browsing…", "Kelo-1 is thinking…"). |
| Error | add `.ui-error` to an empty state | Say what failed and what to do. |
| Flash | `uiFlash(el)` (main.js) | A one-off accent outline on whatever was just sent/copied. |

The HUD keeps its own component classes (`.hud-panel`, `.hud-chip`, `.explore-mode-btn`, …) built from
the same tokens; the menu's Diary/Brain/Talk classes (`.journal-*`, `.brain-*`, `.talk-*`, `.menu-*`)
read the tokens through `--m-*` aliases on `#sideMenu`.
