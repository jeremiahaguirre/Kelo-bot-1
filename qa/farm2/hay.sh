#!/bin/bash
cd /home/user/qa/farm2
for seg in "mow mow" "bale bale"; do set -- $seg; echo "=== $1"; PRESAVE=/tmp/claude-0/-home-user-Kelo-bot-1/4ec02870-a618-53c4-ba24-0f0141e2d176/scratchpad/pre-w.js WARP=6 NORENDER=1 VW=800 VH=500 KELO_ROOT=/home/user/Kelo-bot-1 PORT=8939 SNAP=/home/user/qa/farm2/snaps-hay-$1 STOPON=$2 STEPDAYS=0.4 FAST=6 LIMIT_MIN=60 NODE_PATH=/opt/node-tools/node_modules timeout 4000 node run.js cycle2.js 2>&1 | grep -E "STOPON|errors|last chore: (Mow|Ted|Rake|Bale|Haul)" ; done
echo HAY DONE
