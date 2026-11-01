// Kelo-bot-1 — js/storehouse.js
// Loaded after items3d.js. Kelo-1's Storehouse: a barn with an open front where everything he
// owns sits on shelves as its real 3D model (names appear on hover). After he picks up his mail
// he carries new things over and puts them away, and before digging or practising a hobby he
// stops by to grab the tool he needs.

const STOREHOUSE = { x: 5.5, z: -6.5, w: 5.2, d: 3.6, wallH: 2.6 };
const SHELF_SLOT = 0.68;
const ITEM_FIT = 0.62; // the most an item can measure and still fit on a shelf
// The stairwell down to the basements, in the middle of the floor (local to the Storehouse).
// The spiral stairs themselves and the rooms below are built in js/basements.js while he uses them.
const STOREHOUSE_HATCH_LOCAL = { x: 0, z: 0.55 };
const STAIRWELL_R = 0.8;          // the round hole in each floor the spiral stairs go down through
const BASEMENT_LEVEL_DEPTH = 3.4; // floor to floor, tall enough for him to stand up in

let storehouseGroup = null;
let shelfItemsGroup = null;
let overflowGroup = null;
let shelfSlots = [];
let shelfRenderKey = null;
let storeHoverTag = null;
let storeHovered = null;

// Everything he owns, oldest first, except things he hasn't put away yet
function storedItems() {
      const unstored = new Set(state.unstoredItems.map(n => n.toLowerCase()));
      const all = [
        ...state.toolInventory.map(name => ({ name, kind: 'tool' })),
        ...state.toys.map(t => ({ name: t.name, kind: 'toy' })),
        ...state.belongings.map(b => ({ name: b.name, kind: b.category || 'thing' }))
      ].reverse();
      // Vehicles are parked outside (js/vehicles.js), not kept on shelves
      // (and a 3D printer that's set up stands on its own bench, js/printer.js; wreck pieces lie where the balloon crashed)
      return all.filter(i => i.name && !unstored.has(i.name.toLowerCase()) && !(typeof vehicleTypeFor === 'function' && vehicleTypeFor(i.name))
        && !(typeof wreckPieceAtCrash === 'function' && wreckPieceAtCrash(i.name))
        && !(typeof isSetUpMachine === 'function' && isSetUpMachine(i.name)));
    }

function buildStorehouse3D() {
      const { x: cx, z: cz, w, d, wallH } = STOREHOUSE;
      const gy = getAnalyticalGroundHeight(cx, cz);
      storehouseGroup = new THREE.Group();
      storehouseGroup.position.set(cx, gy, cz);

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
      const levels = [0.35, 1.05, 1.75];
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
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.0, 0.07), shelfWood);
          post.position.set(along === 'x' ? x0 + end : x0, 1.0, along === 'x' ? z0 : z0 + end);
          storehouseGroup.add(post);
        });
      };
      addRack(0, -d / 2 + 0.35, 'x', w - 1.0, 0);
      addRack(-w / 2 + 0.35, -0.15, 'z', d - 1.3, Math.PI / 2);
      addRack(w / 2 - 0.35, -0.15, 'z', d - 1.3, -Math.PI / 2);

      storehouseGroup.add(buildBasementHatch(STOREHOUSE_HATCH_LOCAL, 0.15, Math.PI));
      shelfItemsGroup = new THREE.Group();
      overflowGroup = new THREE.Group();
      storehouseGroup.add(shelfItemsGroup, overflowGroup);
      scene.add(storehouseGroup);
      worldObstacles.push({ x: cx, z: cz, r: 3.0 });
      renderStorehouseShelves3D();
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
      return Math.max(0, Math.ceil(storedItems().length / Math.max(1, shelfSlots.length)) - 1);
    }

// Which floor an item is kept on: 0 is the shelves upstairs, 1 is basement B1, and so on
function storehouseLevelOf(name) {
      const i = storedItems().findIndex(it => it.name === name);
      return i < 0 || !shelfSlots.length ? 0 : Math.floor(i / shelfSlots.length);
    }

// Life size on the shelf (a screwdriver stays small, a toolbox big) unless it's too big to fit,
// then sit it on the plank
function fitOnShelf(model) {
      lifeSize(model, ITEM_FIT);
      const fitted = new THREE.Box3().setFromObject(model);
      model.position.y -= fitted.min.y;
      return model;
    }

function renderStorehouseShelves3D() {
      if (!shelfItemsGroup) return;
      const items = storedItems();
      const key = items.map(i => i.name).join('|');
      if (key === shelfRenderKey) return;
      shelfRenderKey = key;
      [shelfItemsGroup, overflowGroup].forEach(g => {
        while (g.children.length) {
          const old = g.children.pop();
          old.traverse(o => { if (o.geometry) o.geometry.dispose(); });
        }
      });
      items.slice(0, shelfSlots.length).forEach((item, i) => {
        const slot = shelfSlots[i];
        const holder = new THREE.Group();
        const model = fitOnShelf(buildItemModel3D(item.name, { label: false }));
        holder.add(model);
        holder.position.set(slot.x, slot.y, slot.z);
        holder.rotation.y = slot.rotY;
        holder.userData.itemName = item.name;
        shelfItemsGroup.add(holder);
      });
      // More than the shelves hold: the rest is down in the basements, one floor's worth each
      const levels = storehouseBasementLevels();
      if (levels > 0) {
        const sign = makeSignMesh(levels === 1 ? 'BASEMENT B1' : `BASEMENTS B1-B${levels}`, { bg: '#1e293b', fg: '#fbbf24', width: 1.3, height: 0.24 });
        sign.position.set(0, 2.3, -STOREHOUSE.d / 2 + 0.1);
        overflowGroup.add(sign);
      }
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
        stand: { x: slot.x + Math.sin(slot.rotY) * 0.72, z: slot.z + Math.cos(slot.rotY) * 0.72 }
      };
    }

// The model as it sits on a shelf, in its slot
function shelfHolderFor(name, slot) {
      const holder = new THREE.Group();
      holder.add(fitOnShelf(buildItemModel3D(name, { label: false })));
      holder.position.set(slot.x, slot.y, slot.z);
      holder.rotation.y = slot.rotY;
      holder.userData.itemName = name;
      return holder;
    }

// Carry new things to the Storehouse and put them on the shelves: he walks in, goes to each
// one's own shelf (down the stairs if it belongs in a basement) and sets it there
async function putAwayItems() {
      if (state.unstoredItems.length === 0 || state.isBusy || state.isBuilding || state.isPracticing) return false;
      state.isPracticing = true;
      try {
        const items = state.unstoredItems.slice();
        if (typeof setCarriedObject === 'function') setCarriedObject(buildItemModel3D(items[0], { label: false }));
        state.currentLocKey = 'custom';
        state.customPlaceName = 'his Storehouse';
        state.microPose = 'normal';
        state.moodEmoji = '📦';
        state.moodTitle = `Putting away ${items.length > 1 ? `${items.length} things` : items[0]}`.slice(0, 80);
        state.speechBubble = `Taking ${items.length > 1 ? 'my new things' : items[0]} to the Storehouse.`;
        renderAllUI();
        // Where each one will sit once they are all put away (in shelf order, so nothing shifts)
        const keep = state.unstoredItems;
        state.unstoredItems = keep.filter(n => !items.includes(n));
        const order = storedItems();
        state.unstoredItems = keep;
        const placed = items.map(name => ({ name, index: order.findIndex(it => it.name === name) }))
          .sort((p, q) => p.index - q.index)
          .map(p => ({ name: p.name, at: storehouseSlotFor(p.index) }));
        const shelve = name => () => {
          state.unstoredItems = state.unstoredItems.filter(n => n !== name);
          renderStorehouseShelves3D();
          return true;
        };
        // He walks each of the first few to its shelf; the rest go on the shelves next to them
        const jobs = placed.map(({ name, at }, k) => (at && k < 4 ? {
          mode: 'place', level: at.level, slot: at.slot, stand: at.stand, what: name,
          carry: () => buildItemModel3D(name, { label: false }),
          landing: () => shelfHolderFor(name, at.slot),
          onPlaced: shelve(name)
        } : { mode: 'bookkeeping', onPlaced: shelve(name) }));
        if (typeof goIndoors === 'function') await goIndoors('storehouse', jobs);
        state.unstoredItems = state.unstoredItems.filter(n => !items.includes(n));
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        renderStorehouseShelves3D();
        const listText = items.length > 3 ? `${items.slice(0, 3).join(', ')} and ${items.length - 3} more` : items.join(', ');
        state.speechBubble = `All put away: ${listText}. The shelves are filling up.`;
        state.diaryEntries.unshift({
          time: 'Tidying Up', location: 'his Storehouse', mood: '📦 Putting things away',
          vitals: `⚡ ${state.health}% • 🥕 ${state.fullness}% • ✨ ${state.wonderLevel}% • 🌊 ${state.calmLevel}%`,
          text: `Dear Diary, I put ${listText} on the Storehouse shelves. I like knowing where everything is.`
        });
        state.calmLevel = Math.min(100, state.calmLevel + 4);
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        state.isPracticing = false;
      }
    }

// Before a job that needs a tool, he walks over, goes in to its shelf and takes it down.
// Called from inside another activity, so it doesn't change the activity flags itself.
async function fetchFromStorehouse(matchName) {
      const list = storedItems();
      const index = list.findIndex(i => (matchName instanceof RegExp ? matchName.test(i.name) : i.name.toLowerCase() === String(matchName).toLowerCase()));
      if (index < 0) return null;
      const item = list[index];
      if (typeof noteItemUsed === 'function') noteItemUsed(item.name);
      const plain = item.name.replace(/^(an?|the)\s+/i, '');
      state.currentLocKey = 'custom';
      state.customPlaceName = 'his Storehouse';
      state.microPose = 'normal';
      state.moodEmoji = '📦';
      state.moodTitle = `Grabbing the ${plain} from the Storehouse`.slice(0, 80);
      renderAllUI();
      const at = storehouseSlotFor(index);
      const carry = () => buildItemModel3D(item.name, { label: false });
      if (typeof goIndoors === 'function' && at) {
        await goIndoors('storehouse', [{
          mode: 'take', level: at.level, slot: at.slot, stand: at.stand, what: `The ${plain}`,
          match: o => o.userData && o.userData.itemName === item.name, carried: carry
        }]);
      }
      if (typeof setCarriedObject === 'function' && (typeof carriedObject === 'undefined' || !carriedObject)) setCarriedObject(carry());
      return item;
    }

function storehouseSummaryForAI() {
      const items = storedItems().map(i => i.name);
      return items.length ? items.slice(-20).join(', ') : 'empty';
    }
