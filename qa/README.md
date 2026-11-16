# QA tools for Kelo-1 (not part of the game)

Playwright test scripts used to check the game. Run from this folder with the game checkout as KELO_ROOT:

    NODE_PATH=<playwright node_modules> KELO_ROOT=/path/to/kelo-bot-1 PORT=8900 node harness.js reload

- harness.js: scenarios (reload chat ui water gear haul skills printshop basement vehicle snow landfill planitems ...)
- ws.js: Workshop machine jobs (sla fdm haas avid pcb garage forklift floor3 hangar wing exterior sizes perf gallery)
- itest.js: town interior visits (netnode cafe post paths)
- navtest.js / navfollow.js: camera panning and follow smoothness
- vendor/: the Tailwind browser build the tests serve for the CDN, plus three.js copies:
  - three-global-r187.js: the game's own js/vendor/three/three-global.js (three r187 + add-ons). From the r187 upgrade on, the game
    loads three.js from its own files, so the tests no longer route it; this copy is for tools that need three outside the game.
  - three.min.js + OrbitControls.js: r128, still answered for builds from before the upgrade (they load three from the CDN).
- threeviews.js: fixed views (town, lake, north yard, night, Workshop) on any build: perf (draw calls, JS ms/frame) or SHOTS=<dir>
- threesmoke.js: load once, list page errors, console errors and warnings (deduplicated)
- savecheck.js: MODE=dump a save from one build, MODE=load it in another
- skinanim.js, skincompare.js, skinlib.js, skinperf.js: the skins/animation check (from qa-results-skins); harness.js includes the skins scenario

Run tests one at a time; the cloud machines render without a GPU and are slow.
Animation JSONs in logs/anim are gzipped: gunzip them before animdiff.js.
