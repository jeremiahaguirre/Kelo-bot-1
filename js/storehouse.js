// Kelo-bot-1 — js/storehouse.js
// Loaded after items3d.js. Kelo-1's Storehouse: a barn with an open front where everything he
// owns sits on shelves as its real 3D model (names appear on hover). After he picks up his mail
// he carries new things over and puts them away, and before digging or practising a hobby he
// stops by to grab the tool he needs.

// Modelled in its own units (STOREHOUSE_MODEL) and scaled up to real size: a doorway about 2.1 m high,
// walls about 2.6 m. x, z, w, d and wallH are in world units. Everything inside (shelf slots, the
// stairwell, the basements, his walk) is in the model's units, so it all scales with the group;
// the things on the shelves are shown at their own size (shelfHolderFor).
const STOREHOUSE_SCALE = 1.6;
const STOREHOUSE_MODEL = { w: 5.2, d: 3.6, wallH: 2.6 };
const STOREHOUSE = { x: MAP_LAYOUT.storehouse.x, z: MAP_LAYOUT.storehouse.z, w: 5.2 * STOREHOUSE_SCALE, d: 3.6 * STOREHOUSE_SCALE, wallH: 2.6 * STOREHOUSE_SCALE };
const SHELF_SLOT = 0.68;
// The room a thing has in its shelf slot (world units): the slot's width, the clear height under the
// next shelf and the plank's depth. A thing bigger than that is shown smaller; long things lie across.
const SHELF_FIT = { w: 1.0, h: 0.74, d: 0.72 };
// The stairwell down to the basements, in the middle of the floor (local to the Storehouse).
// The spiral stairs themselves and the rooms below are built in js/basements.js while he uses them.
const STOREHOUSE_HATCH_LOCAL = { x: 0, z: 0.55 };
const STOREHOUSE_OUTSIDE_Z = 2.75; // where he waits at the doorway (model units, in front of the open front)
const STAIRWELL_R = 0.8;          // the round shaft in each floor the glass elevator rides through
const BASEMENT_LEVEL_DEPTH = 3.4; // floor to floor, tall enough for him to stand up in

let storehouseGroup = null;
let shelfItemsGroup = null;
let overflowGroup = null;
let shelfSlots = [];
let shelfRenderKey = null;
let storeHoverTag = null;
let storeHovered = null;

// Everything he owns that belongs on a shelf, one entry per copy, oldest first (the old shelf order,
// used to lay out an older save's shelves exactly as they were)
function storeShelfOwned() {
      const all = [
        ...state.toolInventory.map(name => ({ name, kind: 'tool' })),
        ...state.toys.map(t => ({ name: t.name, kind: 'toy' })),
        ...state.belongings.map(b => ({ name: b.name, kind: b.category || 'thing' }))
      ].reverse();
      // Vehicles are parked outside (js/vehicles.js), not kept on shelves
      // (and a 3D printer that's set up stands on its own bench, js/printer.js; wreck pieces lie where the balloon crashed)
      return all.filter(i => i.name && typeof i.name === 'string' && !(typeof vehicleTypeFor === 'function' && vehicleTypeFor(i.name))
        && !(typeof wreckPieceAtCrash === 'function' && wreckPieceAtCrash(i.name))
        && !(typeof isSetUpMachine === 'function' && isSetUpMachine(i.name))
        && !(typeof keptAtWeldStudio === 'function' && keptAtWeldStudio(i.name)));
    }

// Each copy on the shelves has its own record: state.storeCopies = [{ id, name, slot, out }].
// slot counts across floors (shelfSlots.length per floor: 0 is the first slot upstairs, then B1...).
// out: he took that copy down to use it; its slot stays empty (and his) until he puts it back.
// Things he owns but hasn't put away yet (state.unstoredItems, one name per copy) have no record.
let storeCopyKinds = new Map();

function storeCopyNewId() {
      state.storeCopyNext = (Number(state.storeCopyNext) || 0) + 1;
      return 'sc' + state.storeCopyNext;
    }

function storeLowestFreeSlot(used) {
      let s = 0;
      while (used.has(s)) s++;
      return s;
    }

// An older save has no records: its copies take the slots they were shown in (the old order, where every
// copy sharing a name with a thing still to put away was hidden), so the shelves look exactly as before
function storeMigrateCopies(owned) {
      const unstored = new Set(state.unstoredItems.map(n => String(n).toLowerCase()));
      state.storeCopies = owned.filter(i => !unstored.has(i.name.toLowerCase())).map((i, slot) => ({ id: storeCopyNewId(), name: i.name, slot, out: false }));
    }

// Brings the records in line with what he owns. Code all over the game adds, uses up, renames and throws
// out things straight in his lists, so this runs whenever the shelves are looked at: a copy that is gone
// loses its record (one he had taken out first, else the highest slot), and a copy with no record gets
// the slot just freed by the same change (a rename keeps its place) or the lowest empty one.
function syncStoreCopies() {
      const owned = storeShelfOwned();
      if (!Array.isArray(state.storeCopies)) storeMigrateCopies(owned);
      const want = new Map();
      storeCopyKinds = new Map();
      owned.forEach(i => {
        const k = i.name.toLowerCase();
        const w = want.get(k) || { name: i.name, n: 0 };
        w.n++;
        want.set(k, w);
        if (!storeCopyKinds.has(k)) storeCopyKinds.set(k, i.kind);
      });
      state.unstoredItems.forEach(n => { const w = want.get(String(n).toLowerCase()); if (w && w.n > 0) w.n--; });
      const have = new Map();
      state.storeCopies.forEach(c => { const k = c.name.toLowerCase(); if (!have.has(k)) have.set(k, []); have.get(k).push(c); });
      const freed = [], gone = new Set();
      have.forEach((list, k) => {
        const n = want.has(k) ? want.get(k).n : 0;
        while (list.length > n) {
          let victim = list.find(c => c.out);
          if (!victim) victim = list.reduce((a, b) => (b.slot > a.slot ? b : a));
          list.splice(list.indexOf(victim), 1);
          gone.add(victim);
          freed.push(victim.slot);
        }
      });
      if (gone.size) state.storeCopies = state.storeCopies.filter(c => !gone.has(c));
      const used = new Set(state.storeCopies.map(c => c.slot));
      freed.sort((a, b) => a - b);
      want.forEach((w, k) => {
        const list = have.get(k) || [];
        list.forEach(c => { if (c.name !== w.name && !owned.some(i => i.name === c.name)) c.name = w.name; });
        for (let n = list.length; n < w.n; n++) {
          let slot = freed.find(s => !used.has(s));
          if (slot === undefined) slot = storeLowestFreeSlot(used);
          used.add(slot);
          state.storeCopies.push({ id: storeCopyNewId(), name: w.name, slot, out: false });
        }
      });
      return state.storeCopies;
    }

// What is on the shelves right now, in slot order (a copy he has taken out is not: its slot shows empty)
function storedItems() {
      return syncStoreCopies().filter(c => !c.out).slice().sort((a, b) => a.slot - b.slot)
        .map(c => ({ name: c.name, kind: storeCopyKinds.get(c.name.toLowerCase()) || 'thing', id: c.id, slot: c.slot }));
    }

// Copies he has taken down to use and not yet put back
function storeCopiesOut() {
      return syncStoreCopies().filter(c => c.out);
    }

// The last slot in use (taken-out copies keep theirs), or -1 when the shelves are empty
function storeHighestSlot() {
      return syncStoreCopies().reduce((m, c) => Math.max(m, c.slot), -1);
    }

// Older or damaged saves: keep only well-formed records, one per slot
function cleanStoreCopies() {
      if (!Array.isArray(state.storeCopies)) { state.storeCopies = null; return; }
      const seenId = new Set(), seenSlot = new Set();
      let top = Number(state.storeCopyNext) || 0;
      state.storeCopies = state.storeCopies.filter(c => c && typeof c.name === 'string' && c.name && Number.isInteger(c.slot) && c.slot >= 0 && c.slot < 100000)
        .map(c => ({ id: typeof c.id === 'string' ? c.id.slice(0, 40) : '', name: c.name, slot: c.slot, out: c.out === true }));
      state.storeCopies.forEach(c => { const m = /^sc(\d+)$/.exec(c.id); if (m) top = Math.max(top, Number(m[1])); });
      state.storeCopyNext = top;
      state.storeCopies.forEach(c => {
        if (!c.id || seenId.has(c.id)) c.id = storeCopyNewId();
        seenId.add(c.id);
        if (seenSlot.has(c.slot)) c.slot = storeLowestFreeSlot(seenSlot);
        seenSlot.add(c.slot);
      });
    }

function buildStorehouse3D() {
      const { x: cx, z: cz } = STOREHOUSE, { w, d, wallH } = STOREHOUSE_MODEL, S = STOREHOUSE_SCALE;
      const gy = getAnalyticalGroundHeight(cx, cz);
      storehouseGroup = new THREE.Group();
      storehouseGroup.position.set(cx, gy, cz);
      storehouseGroup.scale.setScalar(S);

      const barnRed = new THREE.MeshStandardMaterial({ color: 0xa63d2a, roughness: 0.85 });
      const trim = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 });
      const woodFloor = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 });
      const shelfWood = new THREE.MeshStandardMaterial({ color: 0xc8955a, roughness: 0.8 });

      const floor = new THREE.Mesh(floorWithStairwell(w, d, 0.15, STOREHOUSE_HATCH_LOCAL), woodFloor);
      floor.receiveShadow = true;
      const back = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, 0.15), barnRed);
      back.position.set(0, wallH / 2, -d / 2);
      const left = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, d), barnRed);
      left.position.set(-w / 2, wallH / 2, 0);
      const right = left.clone();
      right.position.x = w / 2;
      // Front: two short wall pieces and a header beam around a wide open doorway
      const frontPieceW = (w - 2.6) / 2;
      const frontL = new THREE.Mesh(new THREE.BoxGeometry(frontPieceW, wallH, 0.15), barnRed);
      frontL.position.set(-w / 2 + frontPieceW / 2, wallH / 2, d / 2);
      const frontR = frontL.clone();
      frontR.position.x = w / 2 - frontPieceW / 2;
      const header = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, 0.17), barnRed);
      header.position.set(0, wallH - 0.25, d / 2);
      // White X-braces on the front panels, classic barn style
      [frontL, frontR].forEach(panel => {
        [0.9, -0.9].forEach(rot => {
          const brace = new THREE.Mesh(new THREE.BoxGeometry(0.08, Math.hypot(frontPieceW, wallH - 0.6) * 0.9, 0.02), trim);
          brace.position.set(panel.position.x, (wallH - 0.5) / 2, d / 2 + 0.09);
          brace.rotation.z = rot * Math.atan2(frontPieceW, wallH - 0.6);
          storehouseGroup.add(brace);
        });
      });
      // Gambrel roof: steep lower slopes and a shallow top, see-through in cutaway mode
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7, transparent: true, opacity: state.roofCutaway ? 0.18 : 0.95, side: THREE.DoubleSide });
      const profile = new THREE.Shape([
        new THREE.Vector2(-w / 2 - 0.25, 0), new THREE.Vector2(-w / 2 + 0.55, 1.0), new THREE.Vector2(0, 1.55),
        new THREE.Vector2(w / 2 - 0.55, 1.0), new THREE.Vector2(w / 2 + 0.25, 0)
      ]);
      const roofGeo = new THREE.ExtrudeGeometry(profile, { depth: d + 0.5, bevelEnabled: false });
      roofGeo.translate(0, 0, -(d + 0.5) / 2);
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = wallH;
      cutawayRoofMeshes.push(roof);
      const sign = makeSignMesh('STOREHOUSE', { bg: '#f8fafc', fg: '#a63d2a', width: 2.2, height: 0.36 });
      sign.position.set(0, wallH - 0.25, d / 2 + 0.1);
      storehouseGroup.add(floor, back, left, right, frontL, frontR, header, roof, sign);

      // Shelving: one long rack on the back wall and one on each side wall, three shelves high
      shelfSlots = [];
      const levels = [0.3, 0.85, 1.4]; // (about 0.3, 0.85 and 1.4 m up: the top one at his reach)
      const addRack = (x0, z0, along, length, faceRotY) => {
        const slots = Math.floor(length / SHELF_SLOT);
        levels.forEach(y => {
          const plank = new THREE.Mesh(new THREE.BoxGeometry(along === 'x' ? length : 0.5, 0.06, along === 'x' ? 0.5 : length), shelfWood);
          plank.position.set(x0, y, z0);
          plank.castShadow = true;
          storehouseGroup.add(plank);
          for (let k = 0; k < slots; k++) {
            const offset = -length / 2 + SHELF_SLOT * (k + 0.5);
            shelfSlots.push({ x: along === 'x' ? x0 + offset : x0, y: y + 0.04, z: along === 'x' ? z0 : z0 + offset, rotY: faceRotY });
          }
        });
        [-length / 2, length / 2].forEach(end => {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.6, 0.07), shelfWood);
          post.position.set(along === 'x' ? x0 + end : x0, 0.8, along === 'x' ? z0 : z0 + end);
          storehouseGroup.add(post);
        });
      };
      addRack(0, -d / 2 + 0.35, 'x', w - 1.0, 0);
      addRack(-w / 2 + 0.35, -0.15, 'z', d - 1.3, Math.PI / 2);
      addRack(w / 2 - 0.35, -0.15, 'z', d - 1.3, -Math.PI / 2);

      // Details at the house's level (js/materials.js kit): a stone base, corner boards, a barn-door
      // track with its hangers, a lamp over the doorway, fascia and gutters, side windows
      if (typeof bldKit === 'function') {
        const K = bldKit();
        bldBase(storehouseGroup, w, d, wallH, { footMat: K.stone, cornerMat: trim });
        const front = bldFace(storehouseGroup, 'front', w, d);
        bldBox(front, w - 0.2, 0.08, 0.06, K.darkMetal, 0, wallH - 0.55, 0.14);
        [-1, 1].forEach(sx => {
          const x = sx * (1.3 + frontPieceW / 2 - 0.05);
          bldBox(front, frontPieceW - 0.1, 0.1, 0.06, trim, x, wallH - 0.72, 0.1);
          bldBox(front, frontPieceW - 0.1, 0.1, 0.06, trim, x, 0.12, 0.1);
          bldBox(front, 0.06, 0.06, 0.12, K.darkMetal, x - sx * (frontPieceW / 2 - 0.25), wallH - 0.5, 0.17);
        });
        bldLamp(front, 0, wallH - 0.85);
        bldBox(front, 2.6, 0.06, 0.08, trim, 0, 0.04, 0.02); // threshold
        ['left', 'right'].forEach(side => { const f = bldFace(storehouseGroup, side, w, d); bldWindow(f, 0, 2.05, 0.7, 0.45, { frame: trim }); });
        bldEaves(storehouseGroup, w, d, wallH - 0.05, { overhang: 0.22, fascia: trim, fasciaH: 0.12, gutterSides: [1, -1] });
      }
      const hatch = buildBasementHatch(STOREHOUSE_HATCH_LOCAL, 0.15, Math.PI);
      storehouseGroup.add(hatch);
      shelfItemsGroup = new THREE.Group();
      overflowGroup = new THREE.Group();
      storehouseGroup.add(shelfItemsGroup, overflowGroup);
      // Real board siding, painted trim and a steel roof (js/materials.js)
      if (typeof dressBuilding === 'function') dressBuilding(storehouseGroup, [[barnRed, 'siding', 2], [trim, 'paintedwood'], [roofMat, 'metalroof', 2], [woodFloor, 'wood']]);
      scene.add(storehouseGroup);
      // Static parts joined per material (the shelves' contents, the roof, the hatch and the sign stay apart)
      if (typeof bldFinish === 'function') bldFinish(storehouseGroup, () => [shelfItemsGroup, overflowGroup, roof, hatch, sign]);
      // Its walls (going in and out is the indoor trip's job, js/basements.js); he waits at the doorway
      addObstacle(obstacleBox(cx, cz, (w / 2 + 0.08) * S, (d / 2 + 0.08) * S, { placeR: 3.0 * S, building: 'storehouse', door: { x: cx - 0.75 * S, z: cz + STOREHOUSE_OUTSIDE_Z * S } }));
      renderStorehouseShelves3D();
      if (typeof perfWatchBuilding === 'function') {
        perfWatchBuilding({
          key: 'storehouse', radius: 4 * S,
          center: () => storehouseGroup.position.clone().setY(storehouseGroup.position.y + 1.2),
          forced: storehouseInUse,
          show: showStorehouseModels, tick: storehouseModelsTick
        });
      } else showStorehouseModels(true);
    }

// A floor slab (sitting on y = 0, `thick` high) with the round stairwell hole cut through it
function floorWithStairwell(w, d, thick, hole) {
      const shape = new THREE.Shape([
        new THREE.Vector2(-w / 2, -d / 2), new THREE.Vector2(w / 2, -d / 2), new THREE.Vector2(w / 2, d / 2), new THREE.Vector2(-w / 2, d / 2)
      ]);
      const ring = new THREE.Path();
      ring.absarc(hole.x, -hole.z, STAIRWELL_R, 0, Math.PI * 2, true);
      shape.holes.push(ring);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 20 });
      geo.rotateX(-Math.PI / 2);
      return geo;
    }

// The top of the stairwell: a railing around the hole with a gap where he steps on (entryAngle,
// measured in the floor plane like Math.atan2(z, x)), and a dark floor down the hole while
// nobody is using it. Used by the Storehouse and the Museum.
function buildBasementHatch(at, floorY, entryAngle = 0) {
      const g = new THREE.Group();
      const dark = new THREE.Mesh(new THREE.CircleGeometry(STAIRWELL_R, 24), new THREE.MeshStandardMaterial({ color: 0x0b0f17 }));
      dark.rotation.x = -Math.PI / 2;
      dark.position.y = Math.max(0.02, floorY - 0.05);
      dark.userData.stairwellDark = true;
      g.add(dark);
      const steel = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.4 });
      const r = STAIRWELL_R + 0.06, gap = 0.55;
      const arc = [];
      for (let k = 0; k <= 24; k++) {
        const a = entryAngle + gap + (Math.PI * 2 - gap * 2) * (k / 24);
        arc.push(new THREE.Vector3(Math.cos(a) * r, floorY + 0.85, Math.sin(a) * r));
      }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc), 48, 0.03, 6, false), steel));
      for (let k = 0; k <= 6; k++) {
        const a = entryAngle + gap + (Math.PI * 2 - gap * 2) * (k / 6);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 0.05), steel);
        post.position.set(Math.cos(a) * r, floorY + 0.425, Math.sin(a) * r);
        g.add(post);
      }
      g.position.set(at.x, 0, at.z);
      return g;
    }

function storehouseBasementLevels() {
      return Math.max(0, Math.ceil((storeHighestSlot() + 1) / Math.max(1, shelfSlots.length)) - 1);
    }

// Which floor an item is kept on: 0 is the shelves upstairs, 1 is basement B1, and so on
function storehouseLevelOf(name) {
      const it = storedItems().find(i => i.name === name);
      return !it || !shelfSlots.length ? 0 : Math.floor(it.slot / shelfSlots.length);
    }

// Life size on the shelf (a screwdriver stays small, a toolbox big) unless it's too big to fit,
// then sit it on the plank
function fitOnShelf(model) {
      lifeSize(model);
      const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
      // Deeper than the plank but narrow: turn it to lie along the shelf
      if (size.z > SHELF_FIT.d && size.z > size.x) {
        model.rotation.y += Math.PI / 2;
        [size.x, size.z] = [size.z, size.x];
      }
      const k = Math.min(1, SHELF_FIT.w / size.x, SHELF_FIT.h / size.y, SHELF_FIT.d / size.z);
      if (k < 1) model.scale.multiplyScalar(k);
      const fitted = new THREE.Box3().setFromObject(model);
      model.position.y -= fitted.min.y;
      return model;
    }

// The shelves fill in only while the camera can see them (js/perf.js watches): far away each thing
// is a small coloured box, and its real model is built a few at a time as the camera comes close.
let shelfModelsWanted = false;
let shelfStandIns = null;
let shelfBuildQueue = [];

function renderStorehouseShelves3D() {
      if (!shelfItemsGroup) return;
      // Each slot upstairs and what is in it (an empty slot, a copy taken out included, shows the bare plank)
      const onShelf = [];
      storedItems().forEach(it => { if (it.slot < shelfSlots.length) onShelf[it.slot] = it; });
      const key = (shelfModelsWanted ? 'models:' : 'boxes:') + onShelf.map((i, k) => (i ? `${k}=${i.id}:${i.name}` : '')).filter(Boolean).join('|') + '#' + storehouseBasementLevels();
      if (key === shelfRenderKey) return;
      shelfRenderKey = key;
      // Models already on the right shelf with the right thing stay where they are
      const keep = new Map();
      while (shelfItemsGroup.children.length) {
        const old = shelfItemsGroup.children.pop();
        const k = `${old.userData.slotIndex}:${old.userData.itemName}`;
        if (shelfModelsWanted && onShelf[old.userData.slotIndex] && onShelf[old.userData.slotIndex].name === old.userData.itemName && !keep.has(k)) {
          old.visible = true; // (a model he took down during a trip is shown again)
          keep.set(k, old);
        } else disposeShelfHolder(old);
      }
      while (overflowGroup.children.length) disposeShelfHolder(overflowGroup.children.pop());
      disposePerfStandIns(shelfStandIns);
      shelfStandIns = null;
      shelfBuildQueue = [];
      // Stand-ins everywhere a model isn't built yet
      const spots = [];
      onShelf.forEach((item, i) => {
        if (!item) return;
        const held = keep.get(`${i}:${item.name}`);
        if (held) { shelfItemsGroup.add(held); return; }
        const slot = shelfSlots[i];
        spots.push({ x: slot.x, y: slot.y, z: slot.z, w: 0.34 / STOREHOUSE_SCALE, h: 0.3 / STOREHOUSE_SCALE, d: 0.3 / STOREHOUSE_SCALE, rotY: slot.rotY, color: perfColorFor(item.name), index: i });
        if (shelfModelsWanted) shelfBuildQueue.push({ name: item.name, index: i, spot: spots.length - 1 });
      });
      if (spots.length) {
        shelfStandIns = perfStandIns(spots);
        overflowGroup.add(shelfStandIns);
      }
      // More than the shelves hold: the rest is down in the basements, one floor's worth each
      const levels = storehouseBasementLevels();
      if (levels > 0) {
        const sign = makeSignMesh(levels === 1 ? 'BASEMENT B1' : `BASEMENTS B1-B${levels}`, { bg: '#1e293b', fg: '#fbbf24', width: 1.3, height: 0.24 });
        sign.position.set(0, 2.3, -STOREHOUSE_MODEL.d / 2 + 0.1);
        overflowGroup.add(sign);
      }
      // While he is in there putting things away, they appear on the shelf straight away
      if (shelfModelsWanted && storehouseInUse()) buildQueuedShelfModels(Infinity);
    }

function disposeShelfHolder(obj) {
      obj.traverse(o => { if (o.geometry && !(o.userData && o.userData.sharedGeometry)) o.geometry.dispose(); });
    }

function storehouseInUse() {
      return typeof indoorTrip !== 'undefined' && indoorTrip.active && indoorTrip.site && indoorTrip.site.key === 'storehouse';
    }

// Build waiting shelf models: up to `count`, and for no more than about 8 ms per frame,
// so coming close never stalls the game
function buildQueuedShelfModels(count) {
      let built = 0;
      const until = performance.now() + 8;
      while (shelfBuildQueue.length && built < count && (count === Infinity || !built || performance.now() < until)) {
        const job = shelfBuildQueue.shift();
        const holder = shelfHolderFor(job.name, shelfSlots[job.index]);
        holder.userData.slotIndex = job.index;
        holder.userData.storeLevel = 0;
        // Under the barn roof their own shadows hardly show, and real models would double their cost
        holder.traverse(o => { if (o.isMesh) o.castShadow = false; });
        shelfItemsGroup.add(holder);
        if (shelfStandIns) {
          shelfStandIns.setMatrixAt(job.spot, new THREE.Matrix4().makeScale(0, 0, 0));
          shelfStandIns.instanceMatrix.needsUpdate = true;
        }
        built++;
      }
    }

// Called by the perf watcher: near is true while the camera can see in (or he is inside)
function showStorehouseModels(near) {
      shelfModelsWanted = near;
      renderStorehouseShelves3D();
    }

// Every frame while it is watched: build a few more
function storehouseModelsTick(near) {
      if (near && shelfBuildQueue.length) buildQueuedShelfModels(12);
    }

// Name tag for whatever shelf item the cursor is over
function setHoveredStoreLabel(raycaster) {
      if (!shelfItemsGroup) return;
      const hits = raycaster.intersectObjects([...shelfItemsGroup.children, ...overflowGroup.children], true);
      let target = null;
      if (hits.length) {
        target = hits[0].object;
        while (target && !(target.userData && target.userData.itemName)) target = target.parent;
      }
      if (target === storeHovered) return;
      storeHovered = target;
      if (storeHoverTag) {
        scene.remove(storeHoverTag);
        storeHoverTag.material.map.dispose();
        storeHoverTag = null;
      }
      if (!target) return;
      storeHoverTag = makeSignMesh(String(target.userData.itemName).slice(0, 26).toUpperCase(), { bg: '#fff7ed', fg: '#7c2d12', width: 1.1, height: 0.22 });
      const p = new THREE.Vector3();
      target.getWorldPosition(p);
      storeHoverTag.position.set(p.x, p.y + 0.62, p.z);
      storeHoverTag.quaternion.copy(camera.quaternion);
      scene.add(storeHoverTag);
    }

// --- Errands ---------------------------------------------------------------------------------
// Where a thing goes: its floor, its shelf slot (local to the Storehouse, as on the ground floor)
// and where he stands to reach it. index is its place in storedItems().
function storehouseSlotFor(index) {
      if (index < 0 || !shelfSlots.length) return null;
      const slot = shelfSlots[index % shelfSlots.length];
      return {
        level: Math.floor(index / shelfSlots.length), slot,
        stand: { x: slot.x + Math.sin(slot.rotY) * 0.6, z: slot.z + Math.cos(slot.rotY) * 0.6 }
      };
    }

// The model as it sits on a shelf, in its slot
function shelfHolderFor(name, slot) {
      const holder = new THREE.Group();
      holder.add(fitOnShelf(buildItemModel3D(name, { label: false })));
      holder.position.set(slot.x, slot.y, slot.z);
      holder.scale.setScalar(1 / STOREHOUSE_SCALE); // (the building is scaled up; the thing keeps its own size)
      holder.rotation.y = slot.rotY;
      holder.userData.itemName = name;
      return holder;
    }

// Anything waiting to go on a shelf: new things, or a copy he took down and is done with
function storehouseHasPutAway() {
      return state.unstoredItems.length > 0 || storeCopiesOut().length > 0;
    }

// Put one new copy of `name` on the shelves at `slot` (or the lowest empty one if that was taken meanwhile)
function storePlaceNewCopy(name, slot) {
      const i = state.unstoredItems.indexOf(name);
      if (i < 0) return false;
      const copies = syncStoreCopies();
      const used = new Set(copies.map(c => c.slot));
      state.unstoredItems.splice(i, 1);
      copies.push({ id: storeCopyNewId(), name, slot: Number.isInteger(slot) && !used.has(slot) ? slot : storeLowestFreeSlot(used), out: false });
      return true;
    }

// Carry new things to the Storehouse and put them on the shelves, and put back what he took down to use:
// he walks in, goes to each one's own shelf (down the stairs if it belongs in a basement) and sets it there.
// A copy he took out goes back to its own slot; each new copy gets an empty slot of its own.
async function putAwayItems() {
      if (!storehouseHasPutAway() || state.isBusy || state.isBuilding || state.isPracticing) return false;
      state.isPracticing = true;
      try {
        const items = state.unstoredItems.slice();
        const returns = storeCopiesOut().slice();
        const names = [...items, ...returns.map(c => c.name)];
        if (typeof setCarriedObject === 'function') setCarriedObject(buildItemModel3D(names[0], { label: false }));
        state.currentLocKey = 'custom';
        state.customPlaceName = 'his Storehouse';
        state.microPose = 'normal';
        state.moodEmoji = '📦';
        state.moodTitle = (items.length ? `Putting away ${names.length > 1 ? `${names.length} things` : names[0]}` : `Putting the ${names[0]} back`).slice(0, 80);
        state.speechBubble = items.length ? `Taking ${names.length > 1 ? 'my new things' : names[0]} to the Storehouse.` : `Putting ${names.length > 1 ? 'my things' : `the ${names[0]}`} back where ${names.length > 1 ? 'they go' : 'it goes'}.`;
        renderAllUI();
        // Where each one will sit (worked out now, so nothing shifts while he walks): a copy he took out
        // goes back to its own slot, each new one to the lowest empty slot
        const used = new Set(syncStoreCopies().map(c => c.slot));
        const placed = [
          ...returns.map(c => ({ name: c.name, slot: c.slot, copy: c })),
          ...items.map(name => { const slot = storeLowestFreeSlot(used); used.add(slot); return { name, slot, copy: null }; })
        ].sort((p, q) => p.slot - q.slot).map(p => ({ ...p, at: storehouseSlotFor(p.slot), done: false }));
        const shelve = p => () => {
          if (p.done) return true;
          p.done = true;
          if (p.copy) p.copy.out = false;
          else storePlaceNewCopy(p.name, p.slot);
          renderStorehouseShelves3D();
          return true;
        };
        // He walks each of the first few to its shelf; the rest go on the shelves next to them
        const jobs = placed.map((p, k) => (p.at && k < 4 ? {
          mode: 'place', level: p.at.level, slot: p.at.slot, stand: p.at.stand, what: p.name,
          carry: () => buildItemModel3D(p.name, { label: false }),
          landing: () => shelfHolderFor(p.name, p.at.slot),
          onPlaced: shelve(p)
        } : { mode: 'bookkeeping', onPlaced: shelve(p) }));
        if (typeof goIndoors === 'function') await goIndoors('storehouse', jobs);
        placed.forEach(p => shelve(p)());
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        renderStorehouseShelves3D();
        if (items.length) {
          const listText = items.length > 3 ? `${items.slice(0, 3).join(', ')} and ${items.length - 3} more` : items.join(', ');
          state.speechBubble = `All put away: ${listText}. The shelves are filling up.`;
          state.diaryEntries.unshift({
            time: 'Tidying Up', location: 'his Storehouse', mood: '📦 Putting things away',
            vitals: `⚡ ${state.health}% • 🥕 ${state.fullness}% • ✨ ${state.wonderLevel}% • 🌊 ${state.calmLevel}%`,
            text: `Dear Diary, I put ${listText} on the Storehouse shelves. I like knowing where everything is.`
          });
          state.calmLevel = Math.min(100, state.calmLevel + 4);
        } else {
          state.speechBubble = `The ${returns[0].name.replace(/^(an?|the)\s+/i, '')}${returns.length > 1 ? ` and ${returns.length - 1} more` : ''} ${returns.length > 1 ? 'are' : 'is'} back on the shelf.`;
        }
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        state.isPracticing = false;
      }
    }

// Before a job that needs a tool, he walks over, goes in to its shelf and takes it down.
// Called from inside another activity, so it doesn't change the activity flags itself.
// That copy is out (its slot shows empty) until he puts it back once he is free again.
async function fetchFromStorehouse(matchName) {
      const list = storedItems();
      const item = list.find(i => (matchName instanceof RegExp ? matchName.test(i.name) : i.name.toLowerCase() === String(matchName).toLowerCase()));
      if (!item) return null;
      if (typeof noteItemUsed === 'function') noteItemUsed(item.name);
      const plain = item.name.replace(/^(an?|the)\s+/i, '');
      state.currentLocKey = 'custom';
      state.customPlaceName = 'his Storehouse';
      state.microPose = 'normal';
      state.moodEmoji = '📦';
      state.moodTitle = `Grabbing the ${plain} from the Storehouse`.slice(0, 80);
      renderAllUI();
      const at = storehouseSlotFor(item.slot);
      const carry = () => buildItemModel3D(item.name, { label: false });
      if (typeof goIndoors === 'function' && at) {
        await goIndoors('storehouse', [{
          mode: 'take', level: at.level, slot: at.slot, stand: at.stand, what: `The ${plain}`,
          match: o => o.userData && o.userData.itemName === item.name && o.userData.slotIndex === item.slot % Math.max(1, shelfSlots.length) && (o.userData.storeLevel || 0) === at.level, carried: carry
        }]);
      }
      // That copy is in his hands now: its slot stays empty until he puts it back
      const copy = (state.storeCopies || []).find(c => c.id === item.id);
      if (copy) copy.out = true;
      renderStorehouseShelves3D();
      if (typeof doWhenFree === 'function') doWhenFree(putAwayItems, { key: 'putaway' });
      if (typeof setCarriedObject === 'function' && (typeof carriedObject === 'undefined' || !carriedObject)) setCarriedObject(carry());
      return item;
    }

function storehouseSummaryForAI() {
      const items = storedItems().map(i => i.name);
      return items.length ? items.slice(-20).join(', ') : 'empty';
    }
