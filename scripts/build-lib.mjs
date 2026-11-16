// Shared build steps for the website / Windows app (scripts/build-site.mjs) and the phone apps
// (scripts/build-web.mjs). Plain Node plus three npm tools: esbuild (minify), acorn (a name check)
// and tailwindcss (the stylesheet).
//
// The game is ~100 classic <script> files that share one global scope (every top-level name is a
// global, and later files call earlier ones). bundleGameScripts() keeps that exactly: each file is
// minified on its own as a classic script (esbuild never renames top-level names in that mode), then
// the files are joined in index.html order into ONE classic script. Nothing is wrapped in a function
// or turned into a module, there is no eval, and the page's Content-Security-Policy does not change.

import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export function need(path, root, hint) {
  if (!existsSync(path)) throw new Error(`Missing ${relative(root, path)}. ${hint || 'Run npm install first.'}`);
  return path;
}

export function copy(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

// Replace one exact piece of a page, and stop the build if it isn't there (so a changed page is
// noticed instead of silently shipping the old thing)
export function swap(html, find, replacement, page) {
  const hit = typeof find === 'string' ? html.includes(find) : find.test(html);
  if (!hit) throw new Error(`${page}: could not find ${find} to replace. Update the build script to match the page.`);
  return html.replace(find, replacement);
}

export const shortHash = (data) => createHash('sha256').update(data).digest('hex').slice(0, 10);

// --- The game's scripts, as one file ------------------------------------------------------------

// Top-level names a classic script declares (function, class, var, let, const)
function topLevelNames(code, file) {
  const acorn = require('acorn');
  let ast;
  try { ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script' }); } catch (e) { throw new Error(`${file}: ${e.message}`); }
  const out = [];
  const pattern = (p, kind) => {
    if (!p) return;
    if (p.type === 'Identifier') out.push([p.name, kind]);
    else if (p.type === 'ObjectPattern') p.properties.forEach(q => pattern(q.type === 'RestElement' ? q.argument : q.value, kind));
    else if (p.type === 'ArrayPattern') p.elements.forEach(q => pattern(q && q.type === 'RestElement' ? q.argument : q, kind));
    else if (p.type === 'AssignmentPattern') pattern(p.left, kind);
  };
  for (const n of ast.body) {
    if (n.type === 'FunctionDeclaration') out.push([n.id.name, 'function']);
    else if (n.type === 'ClassDeclaration') out.push([n.id.name, 'class']);
    else if (n.type === 'VariableDeclaration') n.declarations.forEach(d => pattern(d.id, n.kind));
  }
  return out;
}

// One bundle for a run of <script src="./js/..."> tags that follow each other in the page.
//   html:    the page text; srcRoot: where ./js/... resolve; outDir: where the page is written.
// Returns the page with that run replaced by one <script> for js/<name>.<hash>.js (+ .map), and the
// list of files that went in. Only tags after </head> are bundled: the <head> scripts (three.js and
// its add-ons) are left exactly as the page has them.
export async function bundleGameScripts({ html, srcRoot, outDir, page = 'index.html', name = 'kelo', sourcemap = true, preload = true }) {
  const esbuild = require('esbuild');
  const headEnd = html.indexOf('</head>');
  if (headEnd < 0) throw new Error(`${page}: no </head>`);
  const body = html.slice(headEnd);
  // The longest run of local script tags, with only whitespace and comments between them
  const runRe = /(?:[ \t]*<script src="\.\/(js\/[^"]+\.js)"><\/script>\s*(?:<!--[\s\S]*?-->\s*)*)+/g;
  let best = null;
  for (const m of body.matchAll(runRe)) if (!best || m[0].length > best[0].length) best = m;
  if (!best) throw new Error(`${page}: found no ./js/ script tags to bundle`);
  const files = [...best[0].matchAll(/<script src="\.\/(js\/[^"]+\.js)"><\/script>/g)].map(m => m[1]);
  if (files.length < 2) throw new Error(`${page}: only ${files.length} script found in a row; the page has changed, check scripts/build-lib.mjs`);
  const elsewhere = [...body.slice(0, best.index).matchAll(/<script src="\.\/js\//g), ...body.slice(best.index + best[0].length).matchAll(/<script src="\.\/js\//g)];
  if (elsewhere.length) throw new Error(`${page}: some ./js/ scripts sit apart from the others; keep the game scripts together at the end of <body>`);

  // Every top-level name must be unique across the files (owner's rule). With separate tags a
  // clash breaks one file; in one bundle a let/const/class clash would stop the whole game, so the
  // build refuses it.
  const seen = new Map();
  const problems = [];
  const parts = [];
  for (const file of files) {
    const code = readFileSync(join(srcRoot, file), 'utf8');
    for (const [nm, kind] of topLevelNames(code, file)) {
      const prev = seen.get(nm);
      if (prev && (kind !== 'var' || prev.kind !== 'var')) {
        problems.push(`${nm}: ${prev.kind} in ${prev.file} and ${kind} in ${file}`);
      }
      if (!prev) seen.set(nm, { kind, file });
    }
    const r = await esbuild.transform(code, {
      loader: 'js',
      minify: true,
      // No newer syntax than the game's own (es2020: ?. and ??); esbuild changes nothing it doesn't have to
      target: 'es2020',
      charset: 'utf8',
      legalComments: 'none',
      sourcemap: sourcemap ? 'external' : false,
      sourcefile: file,
      sourcesContent: true
    });
    let out = r.code.trimEnd();
    if (out && !out.endsWith(';') && !out.endsWith('}')) out += ';';
    parts.push({ file, code: out, map: r.map ? JSON.parse(r.map) : null });
  }
  if (problems.length) throw new Error(`Top-level names used twice (they must be unique across js/*.js):\n  ${problems.join('\n  ')}`);

  // Join in page order. Each file starts on a fresh line so the source map can say where it begins.
  let code = '';
  let line = 0;
  const sections = [];
  for (const p of parts) {
    if (p.map) sections.push({ offset: { line, column: 0 }, map: p.map });
    code += p.code + '\n';
    line += p.code.split('\n').length;
  }
  const hash = shortHash(code);
  const fileName = `${name}.${hash}.js`;
  mkdirSync(join(outDir, 'js'), { recursive: true });
  const finalCode = sourcemap ? `${code}//# sourceMappingURL=${fileName}.map\n` : code;
  writeFileSync(join(outDir, 'js', fileName), finalCode);
  if (sourcemap) writeFileSync(join(outDir, 'js', `${fileName}.map`), JSON.stringify({ version: 3, file: fileName, sections }));

  const indent = (best[0].match(/^[ \t]*/) || [''])[0];
  const before = html.slice(0, headEnd) + body.slice(0, best.index);
  const after = body.slice(best.index + best[0].length);
  let out = `${before}${indent}<script src="./js/${fileName}"></script>\n${after}`;
  // Start downloading it while the <head> is still busy (it sits at the end of <body>)
  if (preload) out = swap(out, '</head>', `  <link rel="preload" href="./js/${fileName}" as="script" />\n</head>`, page);
  const rawBytes = files.reduce((n, f) => n + readFileSync(join(srcRoot, f)).length, 0);
  return { html: out, files, fileName, bytes: Buffer.byteLength(finalCode), rawBytes };
}

// --- Phosphor icons and fonts, local copies from npm --------------------------------------------

// Phosphor icons: only the weights the game uses, woff2 only (every current browser reads woff2)
export function vendorPhosphor(nm, outCssDir, root) {
  const PHOSPHOR_WEIGHTS = { regular: 'Phosphor', bold: 'Phosphor-Bold', fill: 'Phosphor-Fill', light: 'Phosphor-Light' };
  let phosphorCss = '';
  for (const [weight, font] of Object.entries(PHOSPHOR_WEIGHTS)) {
    const dir = need(join(nm, '@phosphor-icons', 'web', 'src', weight), root);
    copy(join(dir, `${font}.woff2`), join(outCssDir, 'phosphor', `${font}.woff2`));
    const css = readFileSync(join(dir, 'style.css'), 'utf8')
      .replace(/src:\s*url\("\.\/([^"]+\.woff2)"\) format\("woff2"\),[^;]*;/, 'src: url("./$1") format("woff2");');
    if (!css.includes(`url("./${font}.woff2") format("woff2");`)) throw new Error(`Unexpected Phosphor ${weight} stylesheet`);
    phosphorCss += `/* Phosphor ${weight} */\n${css}\n`;
  }
  writeFileSync(join(outCssDir, 'phosphor', 'phosphor.css'), phosphorCss);
}

// Fonts: Inter, Newsreader and JetBrains Mono in the weights the site asks Google Fonts for
export function vendorFonts(nm, outCssDir, root) {
  const FONTS = [
    ['inter', ['400', '500', '600', '700', '800']],
    ['newsreader', ['400', '600', '400-italic']],
    ['jetbrains-mono', ['400', '500', '700']]
  ];
  let fontsCss = '/* Local copies of the Google Fonts the game uses (from @fontsource on npm) */\n';
  for (const [family, styles] of FONTS) {
    const dir = need(join(nm, '@fontsource', family), root);
    for (const style of styles) {
      const css = readFileSync(join(dir, `${style}.css`), 'utf8')
        // Keep the woff2 file only and point it at the copy next to fonts.css
        .replace(/src: url\(\.\/files\/([^)]+\.woff2)\) format\('woff2'\)(?:, url\([^)]+\) format\('woff'\))?;/g, (m, file) => {
          copy(join(dir, 'files', file), join(outCssDir, 'fonts', file));
          return `src: url(./${file}) format('woff2');`;
        });
      if (css.includes('./files/')) throw new Error(`Unexpected @fontsource/${family} ${style} stylesheet`);
      fontsCss += css + '\n';
    }
  }
  writeFileSync(join(outCssDir, 'fonts', 'fonts.css'), fontsCss);
}

// --- Tailwind, compiled once instead of generated in the browser by the CDN script --------------
// Same Tailwind version and theme (js/twtheme.js) as the CDN script, scanning every page and script
// in srcRoot for class names.
export function compileTailwind(srcRoot, outFile, scratchDir) {
  mkdirSync(scratchDir, { recursive: true });
  const twConfig = join(scratchDir, '.tailwind.config.cjs');
  const twInput = join(scratchDir, '.tailwind.input.css');
  const fwd = p => p.replace(/\\/g, '/');
  writeFileSync(twConfig, `module.exports = { content: ${JSON.stringify([join(srcRoot, '*.html'), join(srcRoot, 'js', '**', '*.js')].map(fwd))}, theme: { extend: require(${JSON.stringify(fwd(join(srcRoot, 'js', 'twtheme.js')))}) } };\n`);
  writeFileSync(twInput, '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
  execFileSync(process.execPath, [require.resolve('tailwindcss/lib/cli.js'), '-c', twConfig, '-i', twInput, '-o', outFile, '--minify'], { stdio: ['ignore', 'ignore', 'inherit'] });
  rmSync(twConfig);
  rmSync(twInput);
}

// The game's stylesheet imports Google Fonts; a build with local fonts drops that line
export function dropGoogleFontsImport(styleFile) {
  writeFileSync(styleFile, swap(readFileSync(styleFile, 'utf8'), /@import url\('https:\/\/fonts\.googleapis\.com[^']*'\);\n?/, '', 'css/style.css'));
}
