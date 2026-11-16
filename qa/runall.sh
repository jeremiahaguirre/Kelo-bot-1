#!/bin/bash
cd /home/user/qa
export NODE_PATH=/opt/node-tools/node_modules
for side in before after; do
  root=/home/user/base; [ $side = after ] && root=/home/user/Kelo-bot-1
  for g in balanced high fast; do
    KELO_ROOT=$root PORT=8901 MODE=perf GFX=$g TAG=$side OUT=/home/user/qa/perf timeout 2400 node gfxviews.js > logs/perf-$side-$g.log 2>&1
    echo "perf $side $g exit $?"
  done
done
for side in before after; do
  root=/home/user/base; [ $side = after ] && root=/home/user/Kelo-bot-1
  KELO_ROOT=$root PORT=8901 MODE=shots GFX=balanced TAG=$side OUT=/home/user/qa/out timeout 3000 node gfxviews.js > logs/shots-$side.log 2>&1
  echo "shots $side exit $?"
done
echo ALLDONE
