#!/bin/bash
cd /home/user/qa/qa
for s in reload ui chat vehicle haul basement; do echo "=== $s"; NODE_PATH=/opt/node-tools/node_modules KELO_ROOT=/home/user/Kelo-bot-1 PORT=8966 timeout 2400 node harness.js $s 2>&1 | grep -v "Failed to load resource" | tail -5; done
echo REGRESS DONE
