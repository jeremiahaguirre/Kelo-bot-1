#!/bin/bash
# The stage-2 plan from a scripted stage-1 farm, then one year of the mixed farm from its end snapshot
cd /home/user/qa/farm2
S=/tmp/claude-0/-home-user-Kelo-bot-1/4ec02870-a618-53c4-ba24-0f0141e2d176/scratchpad
rm -rf snaps-build snaps-year
WARP=6 NORENDER=1 VW=800 VH=500 KELO_ROOT=/home/user/Kelo-bot-1 PORT=8932 SNAP=/home/user/qa/farm2/snaps-build PHASE=build FAST=6 LIMIT_MIN=90 NODE_PATH=/opt/node-tools/node_modules node run.js cycle2.js > logs/build.log 2>&1
./presave.sh snaps-build/final.json > $S/pre-y2.js
WARP=6 PRESAVE=$S/pre-y2.js NORENDER=1 VW=800 VH=500 KELO_ROOT=/home/user/Kelo-bot-1 PORT=8936 SNAP=/home/user/qa/farm2/snaps-year YEARS=1 STEPDAYS=0.4 FAST=6 LIMIT_MIN=300 NODE_PATH=/opt/node-tools/node_modules node run.js cycle2.js > logs/year1.log 2>&1
echo BUILDYEAR DONE >> logs/year1.log
