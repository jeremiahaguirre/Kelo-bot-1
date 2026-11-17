#!/bin/bash
cd /home/user/qa/qa
for s in reload ui chat vehicle haul basement; do echo "=== $s"; NODE_PATH=/opt/node-tools/node_modules KELO_ROOT=/home/user/Kelo-bot-1 PORT=8966 timeout 1500 node harness.js $s 2>&1 | grep -v "Failed to load resource" | tail -4; done
cd /home/user/qa/farm
echo "=== goals"; KELO_ROOT=/home/user/Kelo-bot-1 PORT=8999 NODE_PATH=/opt/node-tools/node_modules timeout 900 node run.js goaltest.js 2>&1 | grep -v "Failed to load" | tail -4
echo "=== oldsave"; PRESAVE=/tmp/claude-0/-home-user-Kelo-bot-1/eaed8b13-a9eb-5fc2-8b4a-12c80a545325/scratchpad/preold.js PORT=8955 NODE_PATH=/opt/node-tools/node_modules timeout 900 node run.js oldsave.js 2>&1 | grep -v "Failed to load"| tail -3
echo "=== perf"; for r in wt-main Kelo-bot-1; do LABEL=$r KELO_ROOT=/home/user/$r PORT=8988 NODE_PATH=/opt/node-tools/node_modules timeout 900 node run.js perf.js 2>&1 | grep -E "PERF"; done
echo "=== midsummer"; ./presave.sh snaps4/m-01-farmseason-5.json > /tmp/claude-0/-home-user-Kelo-bot-1/eaed8b13-a9eb-5fc2-8b4a-12c80a545325/scratchpad/pre-m.js; PRESAVE=/tmp/claude-0/-home-user-Kelo-bot-1/eaed8b13-a9eb-5fc2-8b4a-12c80a545325/scratchpad/pre-m.js OUT=/home/user/qa/farm/stageshots NAME=15-midsummer VIEWS=crops,crops2,crops3,fieldsover DSF=2 PORT=8933 NODE_PATH=/opt/node-tools/node_modules timeout 900 node run.js finalshots.js 2>&1 | grep -E "drawcalls|errors"
echo FINALCHECK DONE
