#!/bin/bash
# Orchard segments from the set-up snapshot (plan done, trees planted y2 doy 85)
cd /home/user/qa/farm2
P=/tmp/claude-0/-home-user-Kelo-bot-1/4ec02870-a618-53c4-ba24-0f0141e2d176/scratchpad/pre-y.js
for seg in "prune 5:62 prune" "cherry 5:189 pick" "apple 5:256 pick"; do
  set -- $seg
  echo "=== $1"
  PRESAVE=$P WARP=6 NORENDER=1 VW=800 VH=500 KELO_ROOT=/home/user/Kelo-bot-1 PORT=8939 SNAP=/home/user/qa/farm2/snaps-orch-$1 JUMP_TO=$2 STOPON=$3 STEPDAYS=0.5 FAST=6 LIMIT_MIN=45 NODE_PATH=/opt/node-tools/node_modules timeout 3000 node run.js cycle2.js 2>&1 | grep -vE "Failed to load"
done
echo ORCHARD DONE
