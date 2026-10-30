// Kelo-bot-1 — js/storehouse.js
// Loaded after items3d.js. Kelo-1's Storehouse: a barn with an open front where everything he
// owns sits on shelves as its real 3D model (names appear on hover). After he picks up his mail
// he carries new things over and puts them away, and before digging or practising a hobby he
// stops by to grab the tool he needs.

const STOREHOUSE = { x: 5.5, z: -6.5, w: 5.2, d: 3.6, wallH: 2.6 };
const SHELF_SLOT = 0.68;
const ITEM_FIT = 0.5; // largest dimension of an item on a shelf

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
      return all.filter(i => i.name && !unstored.has(i.name.toLowerCase()));
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

      const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, d), woodFloor);
      floor.position.y = 0.075;
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

      shelfItemsGroup = new THREE.Group();
      overflowGroup = new THREE.Group();
      storehouseGroup.add(shelfItemsGroup, overflowGroup);
      scene.add(storehouseGroup);
      worldObstacles.push({ x: cx, z: cz, r: 3.0 });
      renderStorehouseShelves3D();
    }

// Scale a model so its largest side fits on a shelf, and sit it on the plank
function fitOnShelf(model) {
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const biggest = Math.max(size.x, size.y, size.z) || 1;
      model.scale.multiplyScalar(ITEM_FIT / biggest);
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
      // More than the shelves hold: stacked crates by the door with a count
      const extra = items.length - shelfSlots.length;
      if (extra > 0) {
        const crateMat = new THREE.MeshStandardMaterial({ color: 0xb7793e, roughness: 0.9 });
        for (let i = 0; i < Math.min(6, Math.ceil(extra / 4)); i++) {
          const crate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.55), crateMat);
          crate.position.set(STOREHOUSE.w / 2 - 0.6 - (i % 2) * 0.6, 0.38 + Math.floor(i / 2) * 0.46, STOREHOUSE.d / 2 - 0.6);
          crate.castShadow = true;
          crate.userData.itemName = `${extra} more things in crates`;
          overflowGroup.add(crate);
        }
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
function storehouseDoor() {
      return { x: TOWN_LOCATIONS.storehouse.x, z: TOWN_LOCATIONS.storehouse.z };
    }

// Carry new things to the Storehouse and put them on the shelves
async function putAwayItems() {
      if (state.unstoredItems.length === 0 || state.isBusy || state.isBuilding || state.isPracticing) return false;
      state.isPracticing = true;
      try {
        const items = state.unstoredItems.slice();
        if (typeof setCarriedObject === 'function') setCarriedObject(buildItemModel3D(items[0], { label: false }));
        state.currentLocKey = 'custom';
        state.customPlaceName = 'his Storehouse';
        state.targetPos = storehouseDoor();
        state.microPose = 'normal';
        state.moodEmoji = '📦';
        state.moodTitle = `Putting away ${items.length > 1 ? `${items.length} things` : items[0]}`.slice(0, 80);
        state.speechBubble = `Taking ${items.length > 1 ? 'my new things' : items[0]} to the Storehouse.`;
        renderAllUI();
        await waitForArrival(60000);
        await new Promise(r => setTimeout(r, Math.min(6000, 1500 + items.length * 900)));
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

// Before a job that needs a tool, he walks over and takes it off the shelf.
// Called from inside another activity, so it doesn't change the activity flags itself.
async function fetchFromStorehouse(matchName) {
      const item = storedItems().find(i => (matchName instanceof RegExp ? matchName.test(i.name) : i.name.toLowerCase() === String(matchName).toLowerCase()));
      if (!item) return null;
      state.currentLocKey = 'custom';
      state.customPlaceName = 'his Storehouse';
      state.targetPos = storehouseDoor();
      state.microPose = 'normal';
      state.moodEmoji = '📦';
      state.moodTitle = `Grabbing the ${item.name.replace(/^(an?|the)\s+/i, '')} from the Storehouse`.slice(0, 80);
      renderAllUI();
      await waitForArrival(60000);
      await new Promise(r => setTimeout(r, 1200));
      if (typeof setCarriedObject === 'function') {
        const tool = buildItemModel3D(item.name, { label: false });
        tool.scale.setScalar(1.6);
        setCarriedObject(tool);
      }
      return item;
    }

function storehouseSummaryForAI() {
      const items = storedItems().map(i => i.name);
      return items.length ? items.slice(-20).join(', ') : 'empty';
    }
