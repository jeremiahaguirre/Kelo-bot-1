// Builds js/vendor/three/three-global.js: three.js plus the add-ons the game uses, joined into ONE
// classic script that sets window.THREE. The entry is js/three-global.mjs (the one place that says
// what the game takes from three.js); the version is the one in package.json (devDependencies.three).
//
// Usage: npm install && npm run vendor:three
//
// No bundler is needed: three.js and its examples/jsm add-ons are ES modules that only use plain
// `import { a, b as c } from '...'`, `import * as X from '...'` and `export { ... } [from '...']`.
// This script follows those imports from the entry, puts each module in its own function scope (in
// dependency order), and passes the exports along as objects. Anything else (export default, export
// const, cyclic imports, dynamic import) stops the script with an error instead of guessing.
// The output is committed: the site, the Windows app and the phone apps all load it as a plain file.

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = join(ROOT, 'js', 'three-global.mjs');
const OUT = join(ROOT, 'js', 'vendor', 'three', 'three-global.js');
const THREE_DIR = join(ROOT, 'node_modules', 'three');

const pkgFile = join(THREE_DIR, 'package.json');
if (!existsSync(pkgFile)) throw new Error('node_modules/three is missing: run npm install first');
const want = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).devDependencies.three;
const have = JSON.parse(readFileSync(pkgFile, 'utf8')).version;
if (want !== have) throw new Error(`package.json wants three ${want} but ${have} is installed: run npm install`);

function resolveSpec(spec, from) {
  if (spec === 'three') return join(THREE_DIR, 'build', 'three.module.js');
  if (spec.startsWith('three/addons/')) return join(THREE_DIR, 'examples', 'jsm', spec.slice('three/addons/'.length));
  if (spec.startsWith('./') || spec.startsWith('../')) return resolve(dirname(from), spec);
  throw new Error(`${relative(ROOT, from)}: cannot resolve '${spec}'`);
}

// `a, b as c` -> [['a', 'a'], ['b', 'c']]  (imported/local name, exported/bound name)
const names = (list) => list.split(',').map(s => s.trim()).filter(Boolean).map(s => {
  const m = s.match(/^([\w$]+)(?:\s+as\s+([\w$]+))?$/);
  if (!m) throw new Error(`unexpected name list entry: ${s}`);
  return [m[1], m[2] || m[1]];
});

const modules = new Map(); // file -> { id, code }
const visiting = new Set();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  if (visiting.has(file)) throw new Error(`cyclic import at ${relative(ROOT, file)}`);
  visiting.add(file);
  let src = readFileSync(file, 'utf8');
  const head = [], exportsList = [];
  const dep = (spec) => load(resolveSpec(spec, file)).id;
  src = src.replace(/^import\s*\{([^}]*)\}\s*from\s*'([^']+)';?/gm, (m, list, spec) => {
    const id = dep(spec);
    head.push(`const { ${names(list).map(([a, b]) => (a === b ? a : `${a}: ${b}`)).join(', ')} } = __kelo3[${id}];`);
    return '';
  });
  src = src.replace(/^import\s*\*\s*as\s*([\w$]+)\s*from\s*'([^']+)';?/gm, (m, ns, spec) => {
    head.push(`const ${ns} = __kelo3[${dep(spec)}];`);
    return '';
  });
  src = src.replace(/^export\s*\{([^}]*)\}\s*from\s*'([^']+)';?/gm, (m, list, spec) => {
    const id = dep(spec);
    names(list).forEach(([a, b]) => exportsList.push(`${b}: __kelo3[${id}].${a}`));
    return '';
  });
  src = src.replace(/^export\s*\{([^}]*)\};?/gm, (m, list) => {
    names(list).forEach(([a, b]) => exportsList.push(a === b ? a : `${b}: ${a}`));
    return '';
  });
  const left = src.match(/^\s*(import|export)\b.*$/m);
  if (left || /\bimport\s*\(|import\.meta/.test(src)) throw new Error(`${relative(ROOT, file)}: unsupported module syntax: ${left ? left[0] : 'dynamic import / import.meta'}`);
  visiting.delete(file);
  const id = modules.size;
  const code = `// ${relative(THREE_DIR, file).startsWith('..') ? relative(ROOT, file) : relative(THREE_DIR, file)}\n` +
    `__kelo3[${id}] = (function () {\n'use strict';\n${head.join('\n')}\n${src}\nreturn { ${exportsList.join(', ')} };\n})();\n`;
  const rec = { id, code };
  modules.set(file, rec);
  return rec;
}

// A light trim (no minifier needed): drop whole-line // comments, /* ... */ blocks that start a line,
// leading indentation and blank lines. Inside GLSL template strings these are GLSL comments and
// whitespace, which the shader compiler ignores too. Nothing inside a line is touched.
function trim(code) {
  const out = [];
  let inBlock = false;
  for (const raw of code.split('\n')) {
    const line = raw.trim();
    if (inBlock) { if (line.includes('*/')) { inBlock = false; const rest = line.slice(line.indexOf('*/') + 2).trim(); if (rest) out.push(rest); } continue; }
    if (line.startsWith('/*') && !line.startsWith('/*@')) {
      const end = line.indexOf('*/', 2);
      if (end < 0) { inBlock = true; continue; }
      const rest = line.slice(end + 2).trim();
      if (rest) out.push(rest);
      continue;
    }
    if (!line || line.startsWith('//')) continue;
    out.push(line);
  }
  return out.join('\n');
}

load(ENTRY);
modules.forEach(m => { m.code = trim(m.code); });
const out =`/* three.js r${have.split('.')[1]} (${have}, MIT licence, https://threejs.org) with OrbitControls, GLTFLoader, HDRLoader,\n` +
  ` Sky, EffectComposer, RenderPass, ShaderPass, UnrealBloomPass and OutputPass from its examples/jsm.\n` +
  ` Built by scripts/vendor-three.mjs from js/three-global.mjs (it sets window.THREE). Do not edit. */\n` +
  `(function () {\nconst __kelo3 = [];\n${[...modules.values()].sort((a, b) => a.id - b.id).map(m => m.code).join('\n')}})();\n`;
if (/\beval\s*\(|new Function\s*\(/.test(out)) throw new Error('the bundle uses eval or new Function, which the CSP forbids');
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out);
console.log(`[vendor:three] ${relative(ROOT, OUT)}: ${modules.size} modules, ${(statSync(OUT).size / 1024).toFixed(0)} KB, three ${have}`);
