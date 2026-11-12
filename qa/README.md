# QA tools for Kelo-1 (not part of the game)

Playwright test scripts used to check the game. Run from this folder with the game checkout as KELO_ROOT:

    NODE_PATH=<playwright node_modules> KELO_ROOT=/path/to/kelo-bot-1 PORT=8900 node harness.js reload

- harness.js: scenarios (reload chat ui water gear haul skills printshop basement vehicle snow landfill planitems ...)
- ws.js: Workshop machine jobs (sla fdm haas avid pcb garage forklift floor3 hangar wing exterior sizes perf gallery)
- itest.js: town interior visits (netnode cafe post paths)
- navtest.js / navfollow.js: camera panning and follow smoothness
- vendor/: local copies of three.js r128, OrbitControls and the Tailwind browser build the tests serve

Run tests one at a time; the cloud machines render without a GPU and are slow.
- design.js: design-pass checks. `TAG=before|after VW=.. VH=.. [MENU=1] node design.js shots` (2x screenshots of the HUD, every menu tab, settings, a toast, loading/empty states) and `node design.js contrast` (WCAG contrast of every visible text/icon against its real background in day/night/snow, scrolling each menu tab). It serves the site's Tailwind 3.4.17 compiled from the checkout: run `vendor/tw3/build.sh <repo> vendor/tw3/<tag>.css` first (needs `npm i tailwindcss@3.4.17` in vendor/tw3), and local Phosphor/fonts from vendor/pkgs (`npm pack @phosphor-icons/web@2.1.1 @fontsource/inter @fontsource/newsreader @fontsource/jetbrains-mono`, unpacked there).
- results/design/: the design pass report, before/after screenshots and contrast reports.
