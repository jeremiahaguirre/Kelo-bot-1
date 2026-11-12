// Tailwind theme for the game and his shop page: every Tailwind colour, text size, radius and shadow
// points at the design tokens in css/style.css (:root --hud-*, see DESIGN.md), so a utility class
// and a hand-written rule always agree. Loaded right after the Tailwind CDN script (index.html,
// shop.html); scripts/build-web.mjs requires the same object when it compiles Tailwind for the apps.
//   slate (and the decorative hues) -> the neutral ramp; amber/yellow -> the accent;
//   emerald/green, rose/red, orange, sky/blue/cyan -> the status colours (only for real status).
var KELO_TW_THEME = (function () {
  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  const ramp = name => Object.fromEntries(steps.map(s => [s, `rgb(var(--hud-${name}-${s}) / <alpha-value>)`]));
  const n = ramp('n'), a = ramp('a'), ok = ramp('ok'), bad = ramp('bad'), warn = ramp('warn'), info = ramp('info');
  // Text on the dark panels: the low steps of the neutral ramp are raised to the readable text tokens
  const tx = v => `rgb(var(${v}) / <alpha-value>)`;
  const nText = { ...n, 300: tx('--hud-text-2-rgb'), 400: tx('--hud-muted-rgb'), 500: tx('--hud-faint-rgb'), 600: tx('--hud-faint-rgb'), 700: tx('--hud-faint-rgb') };
  const colors = {
    slate: n, gray: n, zinc: n, neutral: n, stone: n,
    violet: n, purple: n, indigo: n, fuchsia: n, pink: n, teal: n, lime: n,
    amber: a, yellow: a,
    emerald: ok, green: ok,
    rose: bad, red: bad,
    orange: warn,
    sky: info, blue: info, cyan: info
  };
  const textColors = { ...colors, slate: nText, gray: nText, zinc: nText, neutral: nText, stone: nText,
    violet: nText, purple: nText, indigo: nText, fuchsia: nText, pink: nText, teal: nText, lime: nText };
  return {
    colors,
    textColor: textColors,
    placeholderColor: textColors,
    fontFamily: { sans: ['var(--hud-font-sans)'], serif: ['var(--hud-font-serif)'], mono: ['var(--hud-font-mono)'] },
    fontSize: {
      '3xs': ['var(--hud-fs-3xs)', { lineHeight: '1.35' }],
      '2xs': ['var(--hud-fs-2xs)', { lineHeight: '1.4' }],
      xs: ['var(--hud-fs-xs)', { lineHeight: '1.45' }],
      sm: ['var(--hud-fs-base)', { lineHeight: '1.45' }],
      base: ['var(--hud-fs-md)', { lineHeight: '1.5' }],
      lg: ['var(--hud-fs-lg)', { lineHeight: '1.4' }],
      xl: ['var(--hud-fs-xl)', { lineHeight: '1.3' }],
      '2xl': ['var(--hud-fs-2xl)', { lineHeight: '1.25' }],
      '3xl': ['var(--hud-fs-3xl)', { lineHeight: '1.2' }],
      '4xl': ['var(--hud-fs-4xl)', { lineHeight: '1.15' }]
    },
    fontWeight: { normal: 'var(--hud-fw-regular)', medium: 'var(--hud-fw-medium)', semibold: 'var(--hud-fw-semibold)', bold: 'var(--hud-fw-bold)', extrabold: 'var(--hud-fw-bold)', black: 'var(--hud-fw-bold)' },
    borderRadius: { sm: 'var(--hud-r-xs)', DEFAULT: 'var(--hud-r-xs)', md: 'var(--hud-r-sm)', lg: 'var(--hud-r-sm)', xl: 'var(--hud-r-md)', '2xl': 'var(--hud-r)', '3xl': 'var(--hud-r-lg)' },
    boxShadow: { sm: 'none', DEFAULT: 'var(--hud-shadow)', md: 'var(--hud-shadow)', lg: 'var(--hud-shadow)', xl: 'var(--hud-shadow-pop)', '2xl': 'var(--hud-shadow-pop)' },
    transitionDuration: { DEFAULT: 'var(--hud-dur)', 150: 'var(--hud-dur-fast)', 200: 'var(--hud-dur)', 300: 'var(--hud-dur-slow)' },
    transitionTimingFunction: { DEFAULT: 'var(--hud-ease)' },
    zIndex: { 20: 'var(--hud-z-hud)', 30: 'var(--hud-z-pop)', 40: 'var(--hud-z-menu)', 50: 'var(--hud-z-dialog)' }
  };
})();
if (typeof tailwind !== 'undefined') tailwind.config = { theme: { extend: KELO_TW_THEME } };
if (typeof module !== 'undefined' && module.exports) module.exports = KELO_TW_THEME;
