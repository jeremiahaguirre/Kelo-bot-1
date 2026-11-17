#!/bin/bash
# presave.sh <snap.json> -> writes an init script that puts the snapshot into localStorage before load
node -e '
const d = require(require("path").resolve(process.argv[1]));
process.stdout.write("(() => { if (sessionStorage.getItem(\"__farmSnapDone\")) return; const d = " + JSON.stringify(d) + "; Object.keys(d).forEach(k => localStorage.setItem(k, d[k])); sessionStorage.setItem(\"__farmSnapDone\", \"1\"); })();");
' "$1"
