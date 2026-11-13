#!/bin/bash
cd /home/user/qa
export NODE_PATH=/opt/node-tools/node_modules KELO_ROOT=/home/user/Kelo-bot-1
L=/home/user/qa/ny/reg; mkdir -p $L
p=8930
for s in reload ui chat vehicle haul basement; do p=$((p+1)); PORT=$p timeout 1500 node harness.js $s > $L/$s.log 2>&1; echo "$s exit $?" >> $L/summary; done
p=$((p+1)); PORT=$p timeout 1500 node navtest.js > $L/navtest.log 2>&1; echo "navtest exit $?" >> $L/summary
p=$((p+1)); PORT=$p timeout 1500 node navfollow.js > $L/navfollow.log 2>&1; echo "navfollow exit $?" >> $L/summary
for s in hangar garage; do p=$((p+1)); PORT=$p timeout 5400 node ws.js $s > $L/ws-$s.log 2>&1; echo "ws $s exit $?" >> $L/summary; done
cd /home/user/qa/ny
p=$((p+1)); OUT=/home/user/qa/ny/out-final VW=480 VH=300 SPEEDUP=6 PORT=$p SHOTS=1 timeout 5400 node shoot.js routes.js > $L/routes.log 2>&1; echo "routes exit $?" >> $L/summary
p=$((p+1)); PORT=$p timeout 1200 node shoot.js perf.js > $L/perf.log 2>&1; echo "perf exit $?" >> $L/summary
p=$((p+1)); OUT=/home/user/qa/ny/after DSF=2 PORT=$p timeout 2400 node shoot.js views.js > $L/views.log 2>&1; echo "views exit $?" >> $L/summary
echo DONE >> $L/summary
