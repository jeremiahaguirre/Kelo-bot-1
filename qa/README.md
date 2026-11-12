# QA tools for Kelo-1 (not part of the game)

Playwright test scripts used to check the game. Run from this folder with the game checkout as KELO_ROOT:

    NODE_PATH=<playwright node_modules> KELO_ROOT=/path/to/kelo-bot-1 PORT=8900 node harness.js reload

- harness.js: scenarios (reload chat ui water gear haul skills printshop basement vehicle snow landfill planitems ...)
- ws.js: Workshop machine jobs (sla fdm haas avid pcb garage forklift floor3 hangar wing exterior sizes perf gallery)
- itest.js: town interior visits (netnode cafe post paths)
- navtest.js / navfollow.js: camera panning and follow smoothness
- vendor/: local copies of three.js r128, OrbitControls and the Tailwind browser build the tests serve

Run tests one at a time; the cloud machines render without a GPU and are slow.
