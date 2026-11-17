#!/bin/bash
cd /home/user/qa/farm
run() { ./presave.sh "$1" > /tmp/claude-0/-home-user-Kelo-bot-1/eaed8b13-a9eb-5fc2-8b4a-12c80a545325/scratchpad/pre-f.js; PRESAVE=/tmp/claude-0/-home-user-Kelo-bot-1/eaed8b13-a9eb-5fc2-8b4a-12c80a545325/scratchpad/pre-f.js OUT=/home/user/qa/farm/stageshots NAME="$2" VIEWS="$3" DSF=2 PORT=8933 NODE_PATH=/opt/node-tools/node_modules timeout 900 node run.js finalshots.js 2>&1 | grep -E "drawcalls|page errors|PAGEERROR|\[\{"; }
run snaps2/m-04-farmseason-4.json 13-fertilized crops
run snaps3/m-04-farmseason-6.json 14-young-crops crops,crops2,crops3
run snaps4/m-01-farmseason-5.json 15-midsummer crops,crops2,crops3,fieldsover
run snaps4/m-03-farmseason-7.json 16-ripe crops,crops2,crops3,fieldsover
run snaps4/final.json 17-after-harvest fieldsover,yard,stand
echo FINAL DONE
