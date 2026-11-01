// Kelo-bot-1 — js/realmodels.js
// Loaded after materials.js. Real 3D models of real things: glTF-Binary files in assets/models/
// (where each came from and its licence are in assets/LICENSES.md). When an item's name matches one,
// singleItemModel (items3d.js) hands back a wrapper with the drawn model in it straight away, and the
// real model takes its place as soon as the file has loaded. Each file loads once and is copied after that.

// name pattern -> file, and the real thing's longest side in metres (it is scaled to exactly that,
// then shown at life size by lifeSize like every other realSize model). `turn` spins it to face the viewer.
const REAL_MODELS = [
  { re: /chess/, file: 'chess-set.glb', metres: 0.5 },
  { re: /avocado/, file: 'avocado.glb', metres: 0.11 },
  { re: /olives?\b/, file: 'olive-dish.glb', metres: 0.3 },
  { re: /^(?!.*(food|bones|tank|rod|net|hook)).*(barramundi|salmon|\bfish\b|trout|\bcod\b)/, file: 'fish.glb', metres: 0.65, turn: Math.PI / 2 },
  { re: /teacup|tea ?cup|cup of tea|\bmug of tea\b/, file: 'teacup.glb', metres: 0.15 },
  { re: /water ?bottle|canteen/, file: 'water-bottle.glb', metres: 0.26 },
  { re: /boom ?box|\bradio\b|stereo|ghetto blaster|cassette player/, file: 'boombox.glb', metres: 0.5, turn: Math.PI },
  { re: /\bcamera\b/, file: 'antique-camera.glb', metres: 1.6 },
  { re: /toy car|model car|matchbox car|race car toy/, file: 'toy-car.glb', metres: 0.2 },
  { re: /^(?!.*\b(toy|model|cable|street|tram|rail|dump|keys?|battery|wash|seat|charger|wax|jack)\b).*\b(car|automobile|sedan)\b/, file: 'car.glb', metres: 4.5 },
  { re: /sunglasses|shades\b/, file: 'sunglasses.glb', metres: 0.145 },
  { re: /armchair|arm chair|wingback/, file: 'armchair.glb', metres: 0.83 },
  { re: /^(?!.*\b(arm|high|deck|lawn|camp)).*\bchairs?\b/, file: 'chair.glb', metres: 0.83 },
  { re: /leather (sofa|couch)|wooden (sofa|couch)/, file: 'leather-sofa.glb', metres: 2.2 },
  { re: /\bsofa\b|\bcouch\b|loveseat|settee/, file: 'velvet-sofa.glb', metres: 2.1 },
  { re: /\bpouf\b|ottoman|footstool|beanbag/, file: 'pouf.glb', metres: 0.55 },
  { re: /stained.?glass|tiffany lamp/, file: 'stained-glass-lamp.glb', metres: 0.6 },
  { re: /barn lamp|pendant lamp|hanging lamp|ceiling lamp/, file: 'barn-lamp.glb', metres: 0.36 },
  { re: /desk lamp|table lamp|reading lamp|floor lamp|\blamp\b(?!.*(post|head))/, file: 'table-lamp.glb', metres: 0.5 },
  { re: /lamp ?post|street ?lamp|street ?light|lantern post/, file: 'street-lantern.glb', metres: 2.6 },
  { re: /fridge|refrigerator|freezer|cooler cabinet/, file: 'fridge.glb', metres: 2.0 },
  { re: /house ?plant|potted plant|pot plant|plant pot|\bfern\b|indoor plant/, file: 'house-plant.glb', metres: 0.75 },
  { re: /^(?!.*(seed|bulb|press)).*(\bvase\b|bouquet|\bflowers?\b)/, file: 'vase-of-flowers.glb', metres: 0.35 },
  { re: /candle/, file: 'candle-holder.glb', metres: 0.32 },
  { re: /traffic cone|safety cone|\bpylons?\b/, file: 'traffic-cone.glb', metres: 0.7 },
  { re: /^(?!.*(snow|horse)).*(sneakers?|running shoes?|trainers\b|\bshoes?\b)/, file: 'sneaker.glb', metres: 0.3 },
  { re: /\bskull\b/, file: 'skull.glb', metres: 0.22 }
];
const REAL_MODEL_DIR = 'assets/models/';

const realModelFiles = new Map(); // file -> { scene, promise, failed }
let realModelLoader = null;

// Which real model, if any, is this item?
function realModelEntry(lower) {
      if (typeof vehicleTypeFor === 'function' && vehicleTypeFor(lower)) return null; // vehicles keep their seats and moving parts
      return REAL_MODELS.find(e => e.re.test(lower)) || null;
    }

// Load a model file once; later calls share the same promise
function loadRealModelFile(entry) {
      let rec = realModelFiles.get(entry.file);
      if (rec) return rec.promise;
      rec = { scene: null, failed: false, promise: null };
      realModelFiles.set(entry.file, rec);
      if (typeof THREE.GLTFLoader !== 'function') {
        rec.failed = true;
        rec.promise = Promise.resolve(null);
        return rec.promise;
      }
      if (!realModelLoader) realModelLoader = new THREE.GLTFLoader();
      rec.promise = new Promise(resolve => {
        realModelLoader.load(REAL_MODEL_DIR + entry.file, gltf => {
          rec.scene = normaliseRealModel(gltf.scene, entry);
          resolve(rec.scene);
          document.dispatchEvent(new CustomEvent('kelo-real-model', { detail: { file: entry.file } }));
        }, undefined, () => {
          // A missing or blocked file just means the drawn model stays
          rec.failed = true;
          resolve(null);
        });
      });
      return rec.promise;
    }

// Scale the loaded model so its longest side is the real thing's size in metres,
// stand it on y = 0 and centre it, so it sits where the drawn model sat.
function normaliseRealModel(root, entry) {
      if (entry.turn) root.rotation.y = entry.turn;
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3(), centre = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(centre);
      const s = entry.metres / (Math.max(size.x, size.y, size.z) || 1);
      const holder = new THREE.Group();
      root.position.set(-centre.x, -box.min.y, -centre.z).add(root.position);
      holder.add(root);
      holder.scale.setScalar(s);
      const out = new THREE.Group();
      out.add(holder);
      out.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        o.userData.realModel = true; // applyMaterialLook leaves these alone
        o.userData.sharedGeometry = true; // every copy shares it, so it is never thrown away
      });
      return out;
    }

// Colour textures should be decoded the way the main renderer outputs colour, so the real models
// sit naturally beside the drawn ones whether the renderer works in linear or sRGB.
function matchRendererEncoding(material) {
      const want = typeof renderer !== 'undefined' && renderer && renderer.outputEncoding === THREE.sRGBEncoding ? THREE.sRGBEncoding : THREE.LinearEncoding;
      // glTF colours are linear; a renderer that writes linear colour shows them as if they were sRGB, too dark
      if (want === THREE.LinearEncoding) {
        if (material.color) material.color.convertLinearToSRGB();
        if (material.emissive) material.emissive.convertLinearToSRGB();
      } else if (typeof realisticEnvironmentOn !== 'undefined' && realisticEnvironmentOn) {
        // js/realism.js reads every colour as sRGB; glTF colours are already linear, so they opt out
        material.defines = Object.assign({}, material.defines, { KELO_LINEAR_COLORS: '' });
        material.needsUpdate = true;
      }
      ['map', 'emissiveMap'].forEach(k => {
        const tex = material[k];
        if (tex && tex.encoding !== want) {
          tex.encoding = want;
          tex.needsUpdate = true;
          material.needsUpdate = true;
        }
      });
    }

// A copy of a loaded model with its own materials (so fading or tinting one copy leaves the rest alone)
function copyRealModel(scene) {
      const copy = scene.clone(true);
      copy.traverse(o => {
        if (!o.isMesh) return;
        o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
          matchRendererEncoding(m);
          // Polished metal needs something to reflect, or it renders nearly black
          if (m.metalness > 0.3 && !m.envMap && typeof materialReflections === 'function') {
            m.envMap = materialReflections();
            m.envMapIntensity = 1;
          }
        });
      });
      copy.userData.realModel = true;
      return copy;
    }

// Swap the drawn model inside a wrapper for the real one
function putRealModelIn(wrapper, scene) {
      const drawn = wrapper.userData.drawnModel;
      if (drawn && drawn.parent === wrapper) {
        wrapper.remove(drawn);
        drawn.traverse(o => { if (o.geometry && !o.userData.sharedGeometry) o.geometry.dispose(); });
      }
      wrapper.userData.drawnModel = null;
      wrapper.add(copyRealModel(scene));
      wrapper.userData.realModelPending = null;
    }

// Called by singleItemModel with the drawn model. Returns the drawn model untouched when there is
// no real one; otherwise a realSize wrapper that holds the drawn model now and the real one once loaded.
function withRealModel(lower, drawn) {
      const entry = realModelEntry(lower);
      if (!entry) return drawn;
      const rec = realModelFiles.get(entry.file);
      if (rec && rec.failed) return drawn;
      const wrapper = realSize(new THREE.Group());
      wrapper.userData.realModelFile = entry.file;
      if (rec && rec.scene) {
        putRealModelIn(wrapper, rec.scene);
        return wrapper;
      }
      // Until it loads, the drawn model stands in at the same real size
      const box = new THREE.Box3().setFromObject(drawn);
      const size = new THREE.Vector3();
      box.getSize(size);
      const longest = Math.max(size.x, size.y, size.z);
      if (longest > 0) drawn.scale.multiplyScalar(entry.metres / longest);
      wrapper.userData.drawnModel = drawn;
      wrapper.add(drawn);
      wrapper.userData.realModelPending = loadRealModelFile(entry).then(scene => {
        if (scene) putRealModelIn(wrapper, scene);
        else wrapper.userData.realModelPending = null;
        return scene;
      });
      return wrapper;
    }

// Is anything inside this model still waiting for its real model? (thumbnails wait and redraw)
function realModelsPending(model) {
      const waits = [];
      model.traverse(o => { if (o.userData && o.userData.realModelPending) waits.push(o.userData.realModelPending); });
      return waits.length ? Promise.all(waits) : null;
    }

// Load an item's real model ahead of time (for pictures taken once, like a shop listing's photo)
function preloadRealModel(name) {
      const entry = realModelEntry(String(name || '').toLowerCase());
      return entry ? loadRealModelFile(entry) : Promise.resolve(null);
    }
