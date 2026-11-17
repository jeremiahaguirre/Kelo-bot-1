#!/bin/bash
# DSF 2 screenshots of each stage from the saved milestones
cd /home/user/qa/farm
mkdir -p stageshots
run() { # snapshot name views
  ./presave.sh "$1" > /tmp/claude-0/-home-user-Kelo-bot-1/eaed8b13-a9eb-5fc2-8b4a-12c80a545325/scratchpad/pre-stage.js
  PRESAVE=/tmp/claude-0/-home-user-Kelo-bot-1/eaed8b13-a9eb-5fc2-8b4a-12c80a545325/scratchpad/pre-stage.js OUT=/home/user/qa/farm/stageshots NAME="$2" VIEWS="$3" DSF=2 PORT=8933 NODE_PATH=/opt/node-tools/node_modules timeout 900 node run.js shots.js 2>&1 | grep -E "drawcalls|page errors|PAGEERROR|shot " 
}
run snaps/m-04-farm-3.json 01-surveyed over
run snaps/m-05-farm-4.json 02-cleared over
run snaps/m-06-farm-5.json 03-graded over,lane
run snaps/m-08-farm-7.json 04-fenced over
run snaps/m-09-farm-8.json 05-lane over,lane
run snaps/m-10-farm-9.json 06-shed-staked yard
run snaps/m-11-farm-10.json 07-shed-done yard
run snaps/m-14-farm-13.json 08-bins-dryer yard
run snaps/m-16-farm-15.json 09-house-barn yard
run snaps/m-20-farm-19.json 10-farm-built over,yard
run snaps2/m-02-farmseason-2.json 11-ploughed field
run snaps2/m-03-farmseason-3.json 12-disced field
run snaps2/m-04-farmseason-4.json 13-fertilized field,kelo
echo STAGES DONE
