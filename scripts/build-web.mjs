// Builds www/, the copy of the game that goes inside the iOS and Android apps (Capacitor).
//
// The website (GitHub Pages) and the Windows app use the files in the repo root as they are, with
// three.js, Tailwind, Phosphor icons and the fonts coming from CDNs. A phone app has to work
// offline and pass store review, so this script:
//   1. copies the game's own files into www/,
//   2. puts local copies of three.js, OrbitControls, the Phosphor icons, the fonts and Capacitor's
//      own scripts in www/js/vendor and www/css/vendor (all from npm, see package.json),
//   3. compiles Tailwind into one static stylesheet (www/css/tailwind.css),
//   4. rewrites www/index.html and www/shop.html to use those local files, with a strict
//      Content-Security-Policy for the app (scripts only from the app itself, no CDNs).
//
// Usage: npm run build:web   (then npx cap sync, which copies www/ into android/ and ios/)

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'www');
const NM = join(ROOT, 'node_modules');
const require = createRequire(import.meta.url);

// The game's own files. Folders that don't exist (yet) are skipped.
const PAGES = ['index.html', 'shop.html', 'privacy.html'];
const FOLDERS = ['css', 'js', 'assets', 'brain', 'models', 'textures', 'sounds', 'audio', 'vendor'];
const OPTIONAL_FILES = ['shop-data.json', 'favicon.ico', 'favicon.png', 'manifest.json'];

// What the app is allowed to load and talk to. 'self' is the app itself (capacitor://localhost on
// iOS, https://localhost on Android). Network access is only for the AI and lookup services the game
// uses, plus the published brain/growth.json on GitHub Pages.
const APP_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  // blob: lets js/native.js read a file the game made (a brain backup) to save it to Documents
  "connect-src 'self' blob: https://generativelanguage.googleapis.com https://api.anthropic.com https://en.wikipedia.org https://en.wiktionary.org https://api.duckduckgo.com https://duckduckgo.com https://commons.wikimedia.org https://upload.wikimedia.org https://api.openverse.org https://collectionapi.metmuseum.org https://images.metmuseum.org https://api.artic.edu https://www.artic.edu https://openaccess-api.clevelandart.org https://openaccess-cdn.clevelandart.org https://images-api.nasa.gov https://images-assets.nasa.gov https://www.loc.gov https://tile.loc.gov https://api.pexels.com https://images.pexels.com https://api.unsplash.com https://images.unsplash.com https://pixabay.com https://cdn.pixabay.com https://api.flickr.com https://live.staticflickr.com https://api.si.edu https://ids.si.edu https://api.europeana.eu https://www.rijksmuseum.nl https://lh3.googleusercontent.com https://jeremiahaguirre.github.io",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
  "worker-src 'self' blob:"
].join('; ');

// The shop page only ever reads shop-data.json from next to itself
const SHOP_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-src 'none'";

const log = (msg) => console.log(`[build:web] ${msg}`);

function need(path, hint) {
  if (!existsSync(path)) throw new Error(`Missing ${relative(ROOT, path)}. ${hint || 'Run npm install first.'}`);
  return path;
}

function copy(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

// Replace one exact piece of a page, and stop the build if it isn't there (so a changed page is
// noticed instead of silently shipping CDN links inside the app)
function swap(html, find, replacement, page) {
  const hit = typeof find === 'string' ? html.includes(find) : find.test(html);
  if (!hit) throw new Error(`${page}: could not find ${find} to replace. Update scripts/build-web.mjs to match the page.`);
  return html.replace(find, replacement);
}

// --- 1. The game's own files -------------------------------------------------------------------
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const page of PAGES) if (existsSync(join(ROOT, page))) copy(join(ROOT, page), join(OUT, page));
for (const folder of FOLDERS) if (existsSync(join(ROOT, folder))) copy(join(ROOT, folder), join(OUT, folder));
for (const file of OPTIONAL_FILES) if (existsSync(join(ROOT, file))) copy(join(ROOT, file), join(OUT, file));
log('copied the game files');

// --- 2. Local copies of everything that came from a CDN -----------------------------------------
const VENDOR_JS = join(OUT, 'js', 'vendor');
const VENDOR_CSS = join(OUT, 'css', 'vendor');

// three.js r128 and its OrbitControls (the same versions the website loads)
copy(need(join(NM, 'three', 'build', 'three.min.js')), join(VENDOR_JS, 'three.min.js'));
copy(need(join(NM, 'three', 'examples', 'js', 'controls', 'OrbitControls.js')), join(VENDOR_JS, 'OrbitControls.js'));
const threeVersion = JSON.parse(readFileSync(join(NM, 'three', 'package.json'), 'utf8')).version;
if (threeVersion !== '0.128.0') throw new Error(`three ${threeVersion} is installed, but the game needs 0.128.0`);

// Capacitor's bridge and the secure key storage plugin (plain scripts, no bundler needed)
copy(need(join(NM, '@capacitor', 'core', 'dist', 'capacitor.js')), join(VENDOR_JS, 'capacitor', 'capacitor.js'));
copy(need(join(NM, '@aparajita', 'capacitor-secure-storage', 'dist', 'plugin.js')), join(VENDOR_JS, 'capacitor', 'secure-storage.js'));

// Phosphor icons: only the weights the game uses, woff2 only (every phone web view reads woff2)
const PHOSPHOR_WEIGHTS = { regular: 'Phosphor', bold: 'Phosphor-Bold', fill: 'Phosphor-Fill', light: 'Phosphor-Light' };
let phosphorCss = '';
for (const [weight, font] of Object.entries(PHOSPHOR_WEIGHTS)) {
  const dir = need(join(NM, '@phosphor-icons', 'web', 'src', weight));
  copy(join(dir, `${font}.woff2`), join(VENDOR_CSS, 'phosphor', `${font}.woff2`));
  const css = readFileSync(join(dir, 'style.css'), 'utf8')
    .replace(/src:\s*url\("\.\/([^"]+\.woff2)"\) format\("woff2"\),[^;]*;/, 'src: url("./$1") format("woff2");');
  if (!css.includes(`url("./${font}.woff2") format("woff2");`)) throw new Error(`Unexpected Phosphor ${weight} stylesheet`);
  phosphorCss += `/* Phosphor ${weight} */\n${css}\n`;
}
writeFileSync(join(VENDOR_CSS, 'phosphor', 'phosphor.css'), phosphorCss);

// Fonts: Inter, Newsreader and JetBrains Mono in the weights the site asks Google Fonts for
const FONTS = [
  ['inter', ['400', '500', '600', '700', '800']],
  ['newsreader', ['400', '600', '400-italic']],
  ['jetbrains-mono', ['400', '500', '700']]
];
let fontsCss = '/* Local copies of the Google Fonts the game uses (from @fontsource on npm) */\n';
for (const [family, styles] of FONTS) {
  const dir = need(join(NM, '@fontsource', family));
  for (const style of styles) {
    const css = readFileSync(join(dir, `${style}.css`), 'utf8')
      // Keep the woff2 file only and point it at the copy next to fonts.css
      .replace(/src: url\(\.\/files\/([^)]+\.woff2)\) format\('woff2'\)(?:, url\([^)]+\) format\('woff'\))?;/g, (m, file) => {
        copy(join(dir, 'files', file), join(VENDOR_CSS, 'fonts', file));
        return `src: url(./${file}) format('woff2');`;
      });
    if (css.includes('./files/')) throw new Error(`Unexpected @fontsource/${family} ${style} stylesheet`);
    fontsCss += css + '\n';
  }
}
writeFileSync(join(VENDOR_CSS, 'fonts', 'fonts.css'), fontsCss);
log('vendored three.js, Capacitor, Phosphor icons and fonts');

// --- 3. Tailwind, compiled once instead of generated in the browser -----------------------------
// Same Tailwind version and theme as the website's CDN script, scanning every
// page and script for class names.
const twConfig = join(OUT, '.tailwind.config.cjs');
const twInput = join(OUT, '.tailwind.input.css');
// The theme maps Tailwind's colours, sizes, radii and shadows onto the design tokens (js/twtheme.js)
writeFileSync(twConfig, `module.exports = { content: ${JSON.stringify([join(ROOT, '*.html'), join(ROOT, 'js', '**', '*.js')].map(p => p.replace(/\\/g, '/')))}, theme: { extend: require(${JSON.stringify(join(ROOT, 'js', 'twtheme.js').replace(/\\/g, '/'))}) } };\n`);
writeFileSync(twInput, '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
execFileSync(process.execPath, [require.resolve('tailwindcss/lib/cli.js'), '-c', twConfig, '-i', twInput, '-o', join(OUT, 'css', 'tailwind.css'), '--minify'], { stdio: 'inherit' });
rmSync(twConfig);
rmSync(twInput);
log('compiled css/tailwind.css');

// The game's stylesheet imports Google Fonts; the app uses the local copies instead
const styleFile = join(OUT, 'css', 'style.css');
writeFileSync(styleFile, swap(readFileSync(styleFile, 'utf8'), /@import url\('https:\/\/fonts\.googleapis\.com[^']*'\);\n?/, '', 'css/style.css'));

// --- 4. Point the pages at the local files ------------------------------------------------------
const cspMeta = (csp) => `<meta http-equiv="Content-Security-Policy" content="${csp}" />`;
const appStyles = [
  '<link rel="stylesheet" href="./css/tailwind.css" />',
  '<link rel="stylesheet" href="./css/vendor/fonts/fonts.css" />'
];

{
  const page = 'index.html';
  let html = readFileSync(join(OUT, page), 'utf8');
  html = swap(html, /<meta http-equiv="Content-Security-Policy" content="[^"]*" \/>/, cspMeta(APP_CSP), page);
  // Let the 3D world fill the whole screen, under the notch; css/native.css keeps the UI clear of it
  html = swap(html, '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />', page);
  html = swap(html, /<script src="https:\/\/cdn\.tailwindcss\.com\/[^"]*"><\/script>/, appStyles.join('\n  '), page);
  html = swap(html, /<script src="https:\/\/unpkg\.com\/@phosphor-icons\/web@[^"]*"><\/script>/, '<link rel="stylesheet" href="./css/vendor/phosphor/phosphor.css" />', page);
  html = swap(html, /<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.min\.js"><\/script>/, '<script src="./js/vendor/three.min.js"></script>', page);
  html = swap(html, /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/examples\/js\/controls\/OrbitControls\.js"><\/script>/, '<script src="./js/vendor/OrbitControls.js"></script>', page);
  html = swap(html, '<link rel="stylesheet" href="./css/style.css" />', '<link rel="stylesheet" href="./css/style.css" />\n  <link rel="stylesheet" href="./css/native.css" />', page);
  // The phone bridge (js/native.js) runs before the game's first script, so his memory is loaded
  // from the device before anything reads it
  html = swap(html, '<script src="./js/agent.js"></script>', [
    '<script src="./js/vendor/capacitor/capacitor.js"></script>',
    '<script src="./js/vendor/capacitor/secure-storage.js"></script>',
    '<script src="./js/native.js"></script>',
    '<script src="./js/agent.js"></script>'
  ].join('\n  '), page);
  if (/https:\/\/(cdn\.|unpkg\.|cdnjs\.|fonts\.)/.test(html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, ''))) {
    throw new Error('index.html still loads something from a CDN; add it to scripts/build-web.mjs');
  }
  writeFileSync(join(OUT, page), html);
}

if (existsSync(join(OUT, 'shop.html'))) {
  const page = 'shop.html';
  let html = readFileSync(join(OUT, page), 'utf8');
  html = swap(html, /<meta http-equiv="Content-Security-Policy" content="[^"]*" \/>/, cspMeta(SHOP_CSP), page);
  html = swap(html, /<script src="https:\/\/cdn\.tailwindcss\.com\/[^"]*"><\/script>/, appStyles.join('\n  '), page);
  html = html.replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com" \/>/, '');
  html = swap(html, /\s*<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^"]*" \/>/, '', page);
  writeFileSync(join(OUT, page), html);
}

// privacy.html needs no changes: it loads nothing from anywhere else

// --- Done ---------------------------------------------------------------------------------------
function folderSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    total += entry.isDirectory() ? folderSize(p) : readFileSync(p).length;
  }
  return total;
}
log(`www/ is ready (${(folderSize(OUT) / 1048576).toFixed(1)} MB). Next: npx cap sync`);
