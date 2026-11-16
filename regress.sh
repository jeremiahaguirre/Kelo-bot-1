#!/bin/bash
# Runs the owner's regression scenarios against one copy of the game. Usage: regress.sh <root> <label> <port>
ROOT=$1; LABEL=$2; PORT=$3
cd /home/user/qa
mkdir -p /home/user/qares/logs
for s in reload ui chat vehicle haul basement; do
  start=$(date +%s)
  NODE_PATH=/opt/node-tools/node_modules KELO_ROOT=$ROOT PORT=$PORT timeout 1500 node harness.js $s > /home/user/qares/logs/$LABEL-$s.log 2>&1
  code=$?
  echo "$LABEL $s exit=$code $(( $(date +%s) - start ))s $(grep -h 'page errors' /home/user/qares/logs/$LABEL-$s.log | tail -1 | cut -c1-200)"
  mkdir -p /home/user/qares/shots/$LABEL; cp shots/*.png /home/user/qares/shots/$LABEL/ 2>/dev/null; rm -f shots/*.png
done
