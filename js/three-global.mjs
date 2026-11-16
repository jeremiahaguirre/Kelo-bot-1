// Kelo-bot-1 — js/three-global.mjs
// THE one place three.js comes into the game. Every game script is a plain (classic) script that uses
// the global `THREE`, so this module gathers three.js and the add-ons the game uses into one object and
// publishes it as window.THREE.
//
// The page does not load this file directly. scripts/vendor-three.mjs bundles it (with three.js and the
// add-ons from npm, version pinned in package.json) into js/vendor/three/three-global.js: one classic
// script, no eval, no import map, no network, so it runs the same on GitHub Pages, from file:// in the
// Windows (Electron) app and inside the Capacitor phone apps, and it has run before the next <script>
// tag starts. A build step that bundles the game's own scripts can import this module instead of
// loading the vendored file (it only needs window.THREE set before the game's code runs).
//
// To change the three.js version: edit "three" in package.json, then `npm run vendor:three`.

import * as THREE_NS from 'three';
import { FileLoader } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import { LuminosityHighPassShader } from 'three/addons/shaders/LuminosityHighPassShader.js';

// A module namespace is read-only; the game's scripts expect an ordinary object, as with r128's
// three.min.js (they never add to it, but old saves' code paths and the add-ons' r128 names live here).
const THREE = Object.assign({}, THREE_NS, {
  OrbitControls, GLTFLoader, HDRLoader, Sky,
  EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, OutputPass,
  CopyShader, LuminosityHighPassShader
});

// The Windows app opens the game from file:// (Electron's loadFile). Since r155 three's FileLoader
// (used by GLTFLoader and HDRLoader) reads files with fetch(), which Chromium refuses for file: URLs;
// r128 used XMLHttpRequest, which works there. So for file: URLs only, read with XMLHttpRequest again.
const fetchLoad = FileLoader.prototype.load;
FileLoader.prototype.load = function keloFileLoad(url, onLoad, onProgress, onError) {
  const full = new URL((this.path || '') + url, document.baseURI).href;
  if (!full.startsWith('file:')) return fetchLoad.call(this, url, onLoad, onProgress, onError);
  const resolved = this.manager.resolveURL(full);
  const manager = this.manager;
  manager.itemStart(resolved);
  const xhr = new XMLHttpRequest();
  xhr.open('GET', resolved, true);
  xhr.responseType = this.responseType === 'arraybuffer' || this.responseType === 'blob' || this.responseType === 'document' ? this.responseType : 'text';
  if (this.mimeType && xhr.overrideMimeType) xhr.overrideMimeType(this.mimeType);
  xhr.onprogress = e => { if (onProgress) onProgress(e); };
  xhr.onload = () => {
    // file: answers with status 0 when it worked
    if (xhr.status !== 0 && (xhr.status < 200 || xhr.status >= 300)) { xhr.onerror(); return; }
    let data = xhr.response;
    if (this.responseType === 'json') { try { data = JSON.parse(data); } catch (e) { if (onError) onError(e); manager.itemError(resolved); manager.itemEnd(resolved); return; } }
    if (onLoad) onLoad(data);
    manager.itemEnd(resolved);
  };
  xhr.onerror = () => {
    if (onError) onError(new Error(`FileLoader: could not read ${resolved}`));
    manager.itemError(resolved);
    manager.itemEnd(resolved);
  };
  xhr.send(null);
};

window.THREE = THREE;
