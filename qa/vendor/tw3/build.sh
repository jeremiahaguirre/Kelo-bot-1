#!/bin/bash
# Usage: build.sh <repo root> <out.css>  — compiles Tailwind 3.4.17 like scripts/build-web.mjs (with js/twtheme.js when present)
R="$1"; OUT="$2"; D=$(dirname "$0")
THEME=""; [ -f "$R/js/twtheme.js" ] && THEME=", theme: { extend: require('$R/js/twtheme.js') }"
echo "module.exports = { content: ['$R/*.html', '$R/js/**/*.js']$THEME };" > "$D/cfg.cjs"
printf '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' > "$D/in.css"
"$D/node_modules/.bin/tailwindcss" -c "$D/cfg.cjs" -i "$D/in.css" -o "$OUT" --minify 2>&1 | tail -1
