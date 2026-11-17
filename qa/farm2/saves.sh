#!/bin/bash
cd /home/user/qa/farm2
for p in pre-save-prefarm-true pre-save-prefarm pre-s1 pre-s1f; do echo "=== $p"; PRESAVE=/tmp/claude-0/-home-user-Kelo-bot-1/4ec02870-a618-53c4-ba24-0f0141e2d176/scratchpad/$p.js START2=$([ $p = pre-s1f -o $p = pre-s1 ] && echo 1) WARP=6 NORENDER=1 KELO_ROOT=/home/user/Kelo-bot-1 PORT=8941 NODE_PATH=/opt/node-tools/node_modules timeout 900 node run.js oldsave2.js 2>&1 | grep -E "LOADED|START2|STEP|errors|PAGEERROR" | cut -c1-700; done
echo SAVES DONE
