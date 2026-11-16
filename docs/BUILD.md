# Building and publishing Kelo-1 World

There are two ways to run the game, and they behave the same.

| | What it is | How to run it |
|---|---|---|
| **Dev mode** (plain files) | `index.html` loads the ~100 scripts in `js/` one by one, Tailwind and the icons from their CDNs. Edit a file, reload, done. | Open `index.html`, or serve the repo folder (`npx http-server .`), or `npm start` for the Windows app. |
| **Built** (`_site/`) | The published copy: one minified game script, compiled CSS, local fonts and icons, smaller sky photos. | `npm run build:site`, then serve `_site/` (`npx http-server _site`). |

Nothing in `_site/` is committed (it is in `.gitignore`); it is made fresh from the repo files each time.

## What the build does (scripts/build-site.mjs, scripts/build-lib.mjs)

1. **One game script.** The `<script src="./js/...">` tags at the end of `index.html` become one file,
   `js/kelo.<hash>.js`, plus `js/kelo.<hash>.js.map` for the browser's developer tools. Each file is
   minified by esbuild as a classic script (top-level names are never renamed), then the files are
   joined in page order. Every top-level name stays a global, exactly as with separate tags. The
   hash changes whenever the code does, so a browser never runs an old copy from its cache.
   - The build stops if two files declare the same top-level name (the owner's rule; in one bundle
     a clash would stop the whole game, not one file).
   - New script? Add its `<script>` tag with the others at the end of `index.html`; the build picks
     it up. Scripts in `<head>` (three.js and its add-ons) are left exactly as the page has them.
2. **Tailwind compiled** into `css/tailwind.<hash>.css` (same version and theme, `js/twtheme.js`),
   placed at the end of `<head>` where the CDN script puts its styles, so the cascade is the same.
3. **Phosphor icons and fonts** (Inter, Newsreader, JetBrains Mono) as local files from npm.
4. **Content-Security-Policy**: the CDNs no longer used are removed; nothing is added. No `eval`.
5. **HDR skies** (`assets/hdri`) shrunk from 1024x512 to 512x256 (4.3 MB to 1.1 MB). They only
   light the world; the total light and colour are kept (averaged in real light units).

The same steps run for the phone apps (`npm run build:web`, scripts/build-web.mjs), which also
bundle the Capacitor bridge in its place. `KELO_NO_BUNDLE=1 npm run build:web` keeps separate files
for debugging on a phone.

## Publishing

- **Website (GitHub Pages):** `.github/workflows/pages.yml` builds `_site/` and publishes it on every
  push to `main`, after each of Kelo-1's dreams, and from the Actions tab ("Publish website" -> Run
  workflow). **One-time switch:** repo Settings -> Pages -> Build and deployment -> Source:
  **GitHub Actions**. Until that is switched, Pages keeps serving the plain files from `main` as before.
- **Windows app:** `npm run dist:win` (and the "Build Windows app" workflow) builds `_site/` first and
  packs it as the app's pages (`package.json` -> `build.files`). `npm start` still runs the plain files.
- **Phone apps:** `npm run cap:sync` as before (it runs `build:web`).

## Checking a build

Serve `_site/` and open it; the browser console should show no errors. The QA harness runs against
it with `KELO_ROOT=<repo>/_site`.
