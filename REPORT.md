# Build step for laptop speed: report

Branch `agent/buildstep` (code), this branch `qa-results-buildstep` (tools, logs, evidence).
Everything below was run or measured in the cloud test container unless marked **unverified**.

## What changed

| Part | Before | After |
|---|---|---|
| Game scripts | 105 separate `<script>` files, 4.09 MB | one classic script `js/kelo.<hash>.js`, 2.53 MB (0.86 MB gzipped) + source map |
| Tailwind | CDN script compiling CSS in the browser on every visit | `css/tailwind.<hash>.css`, compiled at build time |
| Icons, fonts | Phosphor script loading 6 icon sheets from unpkg; Google Fonts via `@import` | local files: 4 icon weights, the 3 font families (woff2) |
| HDR skies | 3 x 1024x512, 4.34 MB | 3 x 512x256, 1.10 MB (built copy only) |
| CSP | allows tailwind CDN, unpkg, Google Fonts | those removed; nothing added; no `eval` |
| three.js | CDN tags in `<head>` | **untouched** (left to `agent/threejs`) |

- **Tool: esbuild** (0.25.10, exact pin). It minifies each file as a *classic script*, where it never
  renames top-level names, so every function/let/const/class stays a global exactly as with separate
  tags. Checked: `function topFn(a){let longName=a+1;return longName}` minifies to
  `function topFn(n){return n+1}`. It is one self-contained binary, fast (the whole build takes
  ~5 s), and with `target: es2020` its output for every game file was byte-identical to `esnext`,
  so it adds no newer syntax. The files are joined in index.html order into one script; the source
  map is an index map with one section per file (original files and code included).
- **Safety checks in the build:** the build stops if any top-level name is declared in two files
  (acorn parse of every file). In one bundle, a let/const/class clash would stop the whole game,
  not one file.
- **Hoisting:** in one script, every function declaration exists from the start, while with
  separate tags a later file's functions don't exist yet while earlier files load. `hoistcheck.js`
  parses all 105 files and finds every reference to a later file's function in code that runs at
  load time (outside function bodies, including `window.x`): **none**. So the bundle runs the
  same as the separate tags.
- **Dev mode is unchanged:** the repo root, `index.html` and `npm start` work as before. `_site/`
  is git-ignored and made fresh by `npm run build:site`.

### Where things are wired

- `scripts/build-lib.mjs`: the shared steps (bundle, Tailwind, icons/fonts, HDR shrink).
- `scripts/build-site.mjs` (`npm run build:site`): website + Windows app -> `_site/`.
- `scripts/build-web.mjs` (`npm run build:web`, phone apps): now uses the lib and bundles too
  (108 scripts incl. the Capacitor bridge and `native.js` in their place); `KELO_NO_BUNDLE=1` skips it.
- `.github/workflows/pages.yml`: builds and publishes Pages on push to `main`, after each
  "Kelo-1 dreams" run (its commits can't trigger workflows), and by hand.
- `package.json`: `dist:win` runs `build:site` first; `build.files` packs `_site/` as the app root.
  Checked by packing the Linux variant (`electron-builder --linux dir`) and listing `app.asar`:
  `index.html`, `js/kelo.<hash>.js`, compiled CSS, shrunk skies, `desktop/`; no `.map` files.
  The Windows installer itself was **not** built here (no Windows runner).
- `docs/BUILD.md`: how dev mode, the build and publishing work.

## How Jeremiah publishes

1. Merge `agent/buildstep` into `main`.
2. **One time:** GitHub repo -> Settings -> Pages -> Build and deployment -> Source: **GitHub Actions**.
   (Until you switch it, Pages keeps serving the plain files from `main`, exactly as now.)
3. From then on every push to `main` publishes the built site ("Publish website" in the Actions
   tab; it can also be run by hand there). Windows app and phone apps: same buttons as before.

Not verified here: the Pages workflow has not run on GitHub (it needs the merge and the switch).

## Measurements

Setting ("laptop-like"): Chromium headless, CPU slowed 2x (CDP), network 40 Mbit/s shared +
20 ms per request with gzip for text (like Pages), cold cache each load, 1366x768, software GL
(SwiftShader, the container has no GPU). The CDN files (three, OrbitControls, Tailwind 3.4.x Play
CDN, Phosphor) are served through the same throttled link from local copies. Google Fonts can't
be reached from the container, so the *before* page got empty font CSS (its real cost is higher
than measured). Before = `origin/main` fbf8f72 as plain files; after = the build of the same code.
"World ready" = the first rendered frame of the 3D world.

Medians (before: 7 loads, after: 10 loads):

| | Before | After | Change |
|---|---:|---:|---:|
| First paint | 1.28 s | 0.78 s | -39% |
| DOMContentLoaded | 5.03 s | 1.00 s | -80% |
| World ready | 8.22 s | 3.46 s | -58% |
| JS evaluate (all scripts) | 300 ms | 99 ms | -67% |
| JS compile, main thread | 12 ms | 1.5 ms | |
| JS parse, background threads | 219 ms | 130 ms | -41% |
| Script time to world ready | 7.68 s | 6.20 s | -19% |
| Downloaded by ready + 3 s | 7.47 MB | 3.60 MB | -52% |
| Requests | 140 | 34 | |
| JS heap after 5 min (after GC) | 30.1 MB | 25.2 MB | |

Bytes by type (after vs before): JS 1.07 vs 1.60 MB, HDR 1.15 vs 4.55 MB, CSS 74 vs 104 KB,
fonts 526 vs 429 KB (after includes the real text fonts; before had none, see above).
The Tailwind CDN script alone took 143 ms of evaluation in the *before* page, more than the whole
minified game bundle (42-112 ms) in the *after* page.

Raw data: `measure-*.json`, `m-*.log`; script: `measure.js`.

### Open item: occasional slow first frame in the test container

3 of the 10 built loads took 23-27 s to first paint (DOMContentLoaded was still ~1 s); 0 of 7
plain-file loads did. CPU profiles of slow loads put the time in WebGL calls inside three.js:
context creation (`getContext`, ~2 s) and shader compiling (`WebGLProgram`, 2.6-3.5 s), plus
~20 s spent waiting on the software GPU process. It is not the smaller skies: a build with the
original full-size skies also had slow first frames (3.2, 4.1 and 6.4 s in 10 loads). My reading
is that the build now asks for all GPU work within the first second, and the software renderer
in this container sometimes chokes on that. **Unverified on a real laptop GPU**, where those calls
normally take milliseconds. Worth one look on your laptop: open the built site a few times
(DevTools -> Performance) and see whether the first frame is ever slow.

## Faster loading: what was and wasn't done

- **Done:** the bundle is preloaded from `<head>` (`<link rel=preload>`), so it downloads while
  three.js and the stylesheets load; everything render-blocking is now local except three.js.
  (Not measured separately from the rest of the build.)
- **HDR skies:** halved to 512x256 in the build output (same names and format, so any three.js
  version reads them). Each new pixel averages four in real light units: mean light per sky changes
  by under 0.15% (e.g. day 0.5405,0.4845,0.3777 -> 0.5406,0.4848,0.3782). Screenshots at noon,
  sunset and night, plain vs built (`evidence/cmp-*.png`): mean image colour within ~1 of 255 in
  all views; by eye the lighting is the same. The repo keeps the 1k originals.
- **glTF models: no change.** All 27 already use webp textures and `KHR_mesh_quantization`
  (`gltf-transform quantize` + `dedup` saved 0-8%). Draco and meshopt need WebAssembly decoders,
  which the strict CSP blocks (it would need `'wasm-unsafe-eval'`). They also load only when an
  item needs one, never for the first view.
- **Lazy-loading code: not done, on purpose.** Measured, the whole minified bundle evaluates in
  42-112 ms; the candidates are a small part of it. They are also not separable without changing
  how the game works: the paint renderer's `artCanvas` is called synchronously by
  refpaint/photobrowse/paintstudio; `interiors.js` is called by scene.js while the world is built
  and registers its own DOMContentLoaded handler; the skins UI starts on DOMContentLoaded; the
  mocap data (18 KB) drives his first walk; `viewer.js` is called from scene.js clicks and
  shopkeeping. Making any of them async would change behaviour for a few milliseconds' gain.

## CSS check (compiled Tailwind vs the CDN)

`cascade.js` loads the plain page (with the real Tailwind 3.4 Play CDN, a byte copy from npm
`tailwindcss-cdn`) and the built page, opens every menu tab and Settings, and compares 37
computed properties of every element and pseudo-element.
- The CDN puts its `<style>` at the end of `<head>`, after style.css and the icon sheets; the
  build puts the compiled file in the same place. (Compiled-first gave 637 differences vs 354.)
- With the same fonts on both sides: 22,837 element states, **0 differences in colour, font,
  spacing, borders, shadows or position**; 307 differ only in width/height of boxes whose
  text differs between the two runs (clock time, weather word, need bars, toast text).
  Log: `evidence/cascade-dev-vs-built.log`.

## Regressions

Harness scenarios from `qa-tools` (`harness.js`), run on the merged code, built (`_site/`) and in
dev mode (plain repo files). Exit code 0 and **no page errors in all 12 runs**.

| Scenario | Built | Dev |
|---|---|---|
| reload | pass, `{"d":1,"pin":true,"ground":"-1.38","rim":"0.20"}` | pass, identical |
| ui | pass (all menu tabs + settings shots) | pass |
| chat | pass | pass |
| vehicle | pass | pass |
| haul | pass: 4.0 loads into the Disposal Pit | pass: dirt into the lake (land fill) |
| basement | pass: duck put away (B1) | pass: `put away: false` |

The haul and basement outcomes differed, so I checked that it is not the build:
- haul: `js/vehicles.js` picks the lake with `Math.random() < 0.25` per trip; basement:
  `putAwayItems` returns false straight away while he is still busy (`state.isBusy`).
- A copy of the harness that waits until his opening activity is over before the scripted part
  (`qa-idle`, ~205-240 s in both copies) gives **the same result in both**: haul 4.0 loads into
  the Disposal Pit (dev and built), basement duck put away on B1 (dev and built), no page errors.
- At the harness's normal start (load + 4 s) both copies were in the same state
  (`busy: true`, "Found a Workshop", no land fill), so the difference is only timing.
- Dev-mode game files are byte-identical to `origin/main` (`git diff` on js, css, html, assets
  is empty), so dev behaves exactly as main does today.

After merging the latest `origin/main` (5b0c4df, 23 game files changed) into `agent/buildstep`:
the build still passes its checks (105 scripts, no duplicate top-level names), `hoistcheck.js`
still finds no load-time references to later functions, the phone build bundles (108 scripts), and
all six scenarios pass again on the new build with no page errors (`evidence/regress-final.txt`).

Other checks:
- **GitHub Pages-like serve:** `python3 -m http.server` with the build at `/Kelo-bot-1/`, opened by
  the directory URL: no page errors, no CSP violations, no failed requests, every request under
  `/Kelo-bot-1/`, Phosphor-Bold icons, Inter text and Tailwind styles applied (`evidence/pages-subpath.png`).
- **Phone build (`www/`):** `npm run build:web` (108 scripts bundled, 2.55 MB) opened in Chromium the
  same way: no page errors, no CSP violations, no failed requests (`evidence/www-browser.png`).
  Not run on a phone or in Android Studio/Xcode (**unverified**).
- **Desktop app:** packed with `electron-builder --linux dir` and started under Xvfb: it loads
  `app.asar/index.html`, runs `kelo.<hash>.js`, renders, no page errors (`evidence/electron-app.png`;
  three.js was served from the local copy, the container can't reach the CDN). The Windows
  installer itself was not built here.

## Notes for the other machines

- `agent/threejs`: the build leaves every `<head>` script alone and bundles only the game scripts
  at the end of `<body>`; however three is provided, the bundle runs after it. `build-web.mjs`
  still copies three r128 from npm and checks its version; that part is yours.
- New game script: add its tag with the others at the end of `<body>`; keep names unique.
