// Builds _site/, the published copy of the game for GitHub Pages and the Windows app.
//
// The repo root stays the plain-files dev version (open index.html, or serve the folder, exactly as
// before). This script makes a faster copy of it:
//   1. the ~100 game scripts at the end of index.html become one minified, hashed file
//      (js/kelo.<hash>.js) with a source map, still a plain classic script (see scripts/build-lib.mjs),
//   2. Tailwind is compiled once into css/tailwind.<hash>.css instead of the CDN script building it in
//      the browser on every visit,
//   3. the Phosphor icons and the fonts are local files instead of a script + Google Fonts,
//   4. the Content-Security-Policy drops the CDNs no longer used (nothing new is allowed).
// three.js and its add-ons in <head> are left exactly as index.html has them.
//
// Usage: npm run build:site   (then serve _site/, e.g. npx http-server _site)

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleGameScripts, compileTailwind, copy, dropGoogleFontsImport, shortHash, swap, vendorFonts, vendorPhosphor } from './build-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, process.env.KELO_SITE_DIR || '_site');
const NM = join(ROOT, 'node_modules');
const log = (msg) => console.log(`[build:site] ${msg}`);

const PAGES = ['index.html', 'shop.html', 'privacy.html'];
const FOLDERS = ['css', 'js', 'assets', 'brain', 'models', 'textures', 'sounds', 'audio', 'vendor'];
const OPTIONAL_FILES = ['shop-data.json', 'favicon.ico', 'favicon.png', 'manifest.json', 'README.md', 'CREDITS.md'];

// --- 1. The game's own files -------------------------------------------------------------------
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const page of PAGES) if (existsSync(join(ROOT, page))) copy(join(ROOT, page), join(OUT, page));
for (const folder of FOLDERS) if (existsSync(join(ROOT, folder))) copy(join(ROOT, folder), join(OUT, folder));
for (const file of OPTIONAL_FILES) if (existsSync(join(ROOT, file))) copy(join(ROOT, file), join(OUT, file));
// GitHub Pages: serve the files as they are (no Jekyll)
writeFileSync(join(OUT, '.nojekyll'), '');
log('copied the game files');

// --- 2. Styles: compiled Tailwind, local icons and fonts ----------------------------------------
const CSS = join(OUT, 'css');
compileTailwind(ROOT, join(CSS, 'tailwind.css'), OUT);
const twHashed = `tailwind.${shortHash(readFileSync(join(CSS, 'tailwind.css')))}.css`;
renameSync(join(CSS, 'tailwind.css'), join(CSS, twHashed));
vendorPhosphor(NM, join(CSS, 'vendor'), ROOT);
vendorFonts(NM, join(CSS, 'vendor'), ROOT);
dropGoogleFontsImport(join(CSS, 'style.css'));
log(`compiled css/${twHashed}, local Phosphor icons and fonts`);

// The CDN script's <style> lands at the end of <head>, after css/style.css; the compiled file goes in
// the same place so the two cascade the same way.
const styleLinks = [
  `<link rel="stylesheet" href="./css/vendor/fonts/fonts.css" />`,
  `<link rel="stylesheet" href="./css/vendor/phosphor/phosphor.css" />`,
  `<link rel="stylesheet" href="./css/${twHashed}" />`
];

// Remove one CDN from a CSP directive list without touching anything else in the policy
function cspDrop(html, sources) {
  return html.replace(/(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")/, (m, a, csp, b) => {
    const out = csp.split(';').map(d => d.trim().split(/\s+/).filter(tok => !sources.some(s => tok === s || tok.startsWith(s + '/'))).join(' ')).filter(Boolean).join('; ');
    return a + out + b;
  });
}
const NO_LONGER_USED = ['https://cdn.tailwindcss.com', 'https://unpkg.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

// --- 3. index.html: one bundle for the game scripts ---------------------------------------------
let bundledFiles = [];
{
  const page = 'index.html';
  let html = readFileSync(join(OUT, page), 'utf8');
  html = swap(html, /\s*<script src="https:\/\/cdn\.tailwindcss\.com\/[^"]*"><\/script>/, '', page);
  html = swap(html, /\s*<script src="\.\/js\/twtheme\.js"><\/script>/, '', page);
  html = swap(html, /\s*<script src="https:\/\/unpkg\.com\/@phosphor-icons\/web@[^"]*"><\/script>/, '', page);
  html = swap(html, '</head>', `  ${styleLinks.join('\n  ')}\n</head>`, page);
  html = cspDrop(html, NO_LONGER_USED);
  const b = await bundleGameScripts({ html, srcRoot: ROOT, outDir: OUT, page });
  html = b.html;
  bundledFiles = b.files;
  if (/cdn\.tailwindcss|unpkg\.com|fonts\.googleapis/.test(html)) throw new Error(`${page} still uses a CDN this build replaces`);
  writeFileSync(join(OUT, page), html);
  log(`bundled ${b.files.length} scripts (${(b.rawBytes / 1048576).toFixed(2)} MB) into js/${b.fileName} (${(b.bytes / 1048576).toFixed(2)} MB) + source map`);
}

// --- 4. shop.html: the same styles (its one script, js/shop.js, stays as it is) -----------------
if (existsSync(join(OUT, 'shop.html'))) {
  const page = 'shop.html';
  let html = readFileSync(join(OUT, page), 'utf8');
  html = swap(html, /\s*<script src="https:\/\/cdn\.tailwindcss\.com\/[^"]*"><\/script>/, '', page);
  html = swap(html, /\s*<script src="\.\/js\/twtheme\.js"><\/script>/, '', page);
  html = html.replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com" \/>/, '');
  html = swap(html, /\s*<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^"]*" \/>/, '', page);
  html = swap(html, '</head>', `  ${styleLinks.filter(l => !l.includes('phosphor')).join('\n  ')}\n</head>`, page);
  html = cspDrop(html, NO_LONGER_USED);
  writeFileSync(join(OUT, page), html);
}

// --- 5. Drop the separate copies of what is now in the bundle -----------------------------------
// (shop.js, twtheme.js, native.js and js/vendor stay: other pages and builds use them)
for (const f of bundledFiles) rmSync(join(OUT, f));

// --- Done ---------------------------------------------------------------------------------------
function folderSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    total += entry.isDirectory() ? folderSize(p) : statSync(p).size;
  }
  return total;
}
log(`${OUT.slice(ROOT.length + 1)}/ is ready (${(folderSize(OUT) / 1048576).toFixed(1)} MB)`);
