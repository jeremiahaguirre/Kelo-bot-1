// Makes the app icon and splash screen pictures from resources/icon.svg, then the sizes iOS and
// Android need. Only needed when the icon changes; the results are committed.
//
// Usage:
//   npm install --no-save sharp
//   node scripts/make-icons.mjs
//   npx @capacitor/assets generate --assetPath resources --iconBackgroundColor '#0b1026' --splashBackgroundColor '#020617'
//
// resources/ then holds:
//   icon-only.png        1024×1024, no transparency (what the App Store wants)
//   icon-foreground.png  Kelo-1's head only, for Android's adaptive icon (kept inside the safe circle)
//   icon-background.png  the sunset valley behind him
//   splash.png / splash-dark.png  2732×2732, the icon in the middle of the game's dark background

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch (e) {
  console.error('This needs sharp: run "npm install --no-save sharp" first.');
  process.exit(1);
}

const RES = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources');
const svg = readFileSync(join(RES, 'icon.svg'), 'utf8');
const head = svg.match(/<g id="kelo-head">[\s\S]*?\n  <\/g>/)[0];
const defs = svg.match(/<defs>[\s\S]*?<\/defs>/)[0];
const open = '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">';

const png = (source, size = 1024) => sharp(Buffer.from(source), { density: 72 * size / 1024 }).resize(size, size).png();

// The full icon, flattened onto the night sky colour (no transparency)
await png(svg).flatten({ background: '#0b1026' }).toFile(join(RES, 'icon-only.png'));
// Background: everything except his head
await png(svg.replace(head, '')).flatten({ background: '#0b1026' }).toFile(join(RES, 'icon-background.png'));
// Foreground: his head, centred (@capacitor/assets insets it again to keep it in Android's safe circle)
await png(`${open}${defs}<g transform="translate(512 512) scale(0.95) translate(-512 -455)">${head}</g></svg>`).toFile(join(RES, 'icon-foreground.png'));

// Splash: the icon with rounded corners, centred on the game's background colour
const SPLASH = 2732;
const tile = await png(`${open}<clipPath id="r"><rect width="1024" height="1024" rx="224"/></clipPath><g clip-path="url(#r)">${svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</g></svg>`, 640).toBuffer();
for (const name of ['splash.png', 'splash-dark.png']) {
  await sharp({ create: { width: SPLASH, height: SPLASH, channels: 3, background: '#020617' } })
    .composite([{ input: tile, gravity: 'center' }])
    .png()
    .toFile(join(RES, name));
}
console.log('Made icon-only, icon-foreground, icon-background, splash and splash-dark in resources/');
