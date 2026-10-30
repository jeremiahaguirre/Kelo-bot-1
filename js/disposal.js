// Kelo-bot-1 — js/disposal.js
// Loaded after vehicles.js. The Disposal Pit: a deep hole out east of the Storehouse where Kelo-1
// throws whatever he no longer wants, and where the dump truck tips the dirt from his digs.
// Anything that goes in is gone for good: off his shelves, out of his hands, out of the yard.

const DISPOSAL_PIT = { x: 20, z: -9, r: 2.3, depth: 2.6 };
const PIT_EDGE = { x: DISPOSAL_PIT.x - DISPOSAL_PIT.r - 0.9, z: DISPOSAL_PIT.z };
const JUNK_FINDS = ['an oddly round pebble', 'a rusty bolt', 'a smooth river stone', 'a chunk of mica that sparkles', 'an old bottle cap'];

let pitGroup = null;

// How far the pit lowers the ground at a point (used by getAnalyticalGroundHeight): steep walls, flat floor
function pitDepressionAt(x, z) {
      const d = Math.hypot(x - DISPOSAL_PIT.x, z - DISPOSAL_PIT.z);
      if (d >= DISPOSAL_PIT.r) return 0;
      const t = d / DISPOSAL_PIT.r;
      return DISPOSAL_PIT.depth * (1 - Math.pow(t, 4));
    }

function buildDisposalPit3D() {
      if (!scene || pitGroup) return;
      const { x, z, r } = DISPOSAL_PIT;
      refreshTerrainAround(x, z, r + 0.8);
      pitGroup = new THREE.Group();
      // A ring of boulders around the rim
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8b8f98, roughness: 0.95, flatShading: true });
      const stones = 16;
      for (let i = 0; i < stones; i++) {
        const a = (i / stones) * Math.PI * 2;
        const sx = x + Math.cos(a) * (r + 0.25), sz = z + Math.sin(a) * (r + 0.25);
        const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 + (i % 3) * 0.06, 0), stoneMat);
        s.position.set(sx, getAnalyticalGroundHeight(sx, sz) + 0.08, sz);
        s.rotation.set(i, i * 1.7, 0);
        s.castShadow = true;
        pitGroup.add(s);
      }
      // A warning sign on a post at the near edge
      const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 });
      const sx = x - r - 0.6, sz = z - 1.6;
      const sy = getAnalyticalGroundHeight(sx, sz);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), wood);
      post.position.set(sx, sy + 1.2, sz);
      const sign = makeSignMesh('DISPOSAL PIT', { bg: '#facc15', fg: '#1c1917', width: 1.8, height: 0.38 });
      sign.position.set(sx, sy + 2.15, sz + 0.08);
      sign.rotation.y = -0.5;
      pitGroup.add(post, sign);
      scene.add(pitGroup);
      worldObstacles.push({ x, z, r: r + 0.2 });
    }

// Everything he owns that could go in the pit (vehicles included)
function disposableNames() {
      return [...state.toolInventory, ...state.toys.map(t => t.name), ...state.belongings.map(b => b.name)].filter(Boolean);
    }

function findOwnedName(name) {
      const want = String(name || '').trim().toLowerCase().replace(/^(an?|the|my)\s+/, '');
      if (!want) return null;
      const names = disposableNames();
      return names.find(n => n.toLowerCase() === String(name).trim().toLowerCase())
        || names.find(n => n.toLowerCase().replace(/^(an?|the|my)\s+/, '') === want)
        || null;
    }

// Gone for good: one copy out of every list he keeps things in, its shelf spot and its parking spot
function forgetItem(name) {
      const drop = (arr, match) => {
        const i = arr.findIndex(match);
        if (i >= 0) arr.splice(i, 1);
        return i >= 0;
      };
      drop(state.toolInventory, n => n === name)
        || drop(state.toys, t => t.name === name)
        || drop(state.belongings, b => b.name === name);
      drop(state.unstoredItems, n => n === name);
      drop(state.vehicles, v => v.name === name);
      state.hobbies.forEach(h => { if (h.tool === name) delete h.tool; });
      if (typeof renderStorehouseShelves3D === 'function') renderStorehouseShelves3D();
      if (typeof renderVehicles3D === 'function') renderVehicles3D();
    }

// Something tumbles from (x, y, z) over the rim and down to the bottom, then vanishes
async function dropIntoPit(object3d, from) {
      const { x, z, depth } = DISPOSAL_PIT;
      const bottom = getAnalyticalGroundHeight(x, z) - depth + 0.2;
      const tx = x + randRange(-0.6, 0.6), tz = z + randRange(-0.6, 0.6);
      object3d.position.set(from.x, from.y, from.z);
      scene.add(object3d);
      const steps = 18;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        object3d.position.set(from.x + (tx - from.x) * t, from.y + (bottom - from.y) * t + Math.sin(t * Math.PI) * 1.2, from.z + (tz - from.z) * t);
        object3d.rotation.x += 0.35;
        object3d.rotation.z += 0.2;
        await new Promise(r => setTimeout(r, 55));
      }
      await new Promise(r => setTimeout(r, 400));
      scene.remove(object3d);
      object3d.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }

// A vehicle he no longer wants: he drives it to the edge and it rolls over the rim
async function sinkVehicleIntoPit(v) {
      await driveVehicle(v, { x: PIT_EDGE.x - 0.8, z: PIT_EDGE.z }, `Driving the ${v.name.replace(/^(an?|the)\s+/i, '')} to the Disposal Pit`);
      state.targetPos = { x: PIT_EDGE.x - 2.2, z: PIT_EDGE.z + 1.4 };
      await waitForArrival(20000);
      const m = vehicleMeshes[v.id];
      if (m) {
        scene.remove(m);
        delete vehicleMeshes[v.id];
        m.rotation.set(0, 0, 0);
        await dropIntoPit(m, { x: m.position.x, y: m.position.y + 0.3, z: m.position.z });
      }
    }

// Kelo-1 decides something has to go. `why` is his own reason, in his words.
async function disposeItem(name, why = '', originLabel = 'Clearing Things Out') {
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      const item = findOwnedName(name);
      if (!item) return false;
      state.isPracticing = true;
      const plain = item.replace(/^(an?|the)\s+/i, '');
      try {
        state.currentLocKey = 'custom';
        state.customPlaceName = 'the Disposal Pit';
        state.microPose = 'normal';
        state.moodEmoji = '🗑️';
        state.moodTitle = `Taking the ${plain} to the Disposal Pit`.slice(0, 80);
        state.speechBubble = why || `I don't need the ${plain} any more.`;
        renderAllUI();
        const vehicle = state.vehicles.find(v => v.name === item);
        if (vehicle) {
          await sinkVehicleIntoPit(vehicle);
        } else {
          // Off the shelf if it's put away, otherwise it's already in his hands
          const shelved = typeof storedItems === 'function' && storedItems().some(i => i.name === item);
          if (shelved && typeof fetchFromStorehouse === 'function') await fetchFromStorehouse(item);
          else if (typeof setCarriedObject === 'function') setCarriedObject(buildItemModel3D(item, { label: false }));
          state.moodEmoji = '🗑️';
          state.moodTitle = `Taking the ${plain} to the Disposal Pit`.slice(0, 80);
          renderAllUI();
          await travelTo(PIT_EDGE, `Riding out to the Disposal Pit`);
          state.botRotY = Math.atan2(DISPOSAL_PIT.x - state.botPos.x, DISPOSAL_PIT.z - state.botPos.z);
          state.moodTitle = `Throwing the ${plain} into the pit`.slice(0, 80);
          renderAllUI();
          if (typeof setCarriedObject === 'function') setCarriedObject(null);
          const thrown = buildItemModel3D(item, { label: false });
          thrown.scale.setScalar(1.6);
          await dropIntoPit(thrown, { x: state.botPos.x + Math.sin(state.botRotY) * 0.6, y: getIslandGroundHeight(state.botPos.x, state.botPos.z) + 1.1, z: state.botPos.z + Math.cos(state.botRotY) * 0.6 });
        }
        forgetItem(item);
        state.disposedItems.unshift({ name: item, at: Date.now(), why: String(why || '').slice(0, 160) });
        state.speechBubble = pick([`Down it goes. Goodbye, ${plain}.`, `The ${plain} is gone for good. That feels lighter.`, `No more ${plain}. There's room for something new.`]);
        state.moodTitle = `Threw away the ${plain}`.slice(0, 80);
        state.changedLatelySummary = `Threw the ${plain} into the Disposal Pit.`;
        state.calmLevel = Math.min(100, state.calmLevel + 5);
        state.diaryEntries.unshift({
          time: originLabel, location: 'the Disposal Pit', mood: `🗑️ Let go of the ${plain}`.slice(0, 80),
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I threw the ${plain} into the Disposal Pit. ${why ? why + ' ' : ''}Once something goes down there, it never comes back.`
        });
        showToast(`🗑️ Kelo-1 threw away: ${plain}`);
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.isPracticing = false;
      }
    }

// The dump truck tips its load over the rim: the dirt is gone, the pit stays a pit
async function tipDirtIntoPit(truck) {
      const tMesh = vehicleMeshes[truck.id];
      if (tMesh) {
        for (let a = 0; a <= 10; a++) { tMesh.rotation.z = -a * 0.04; await new Promise(r => setTimeout(r, 80)); }
      }
      const load = truck.load || 0;
      truck.load = 0;
      renderVehicles3D();
      if (tMesh) {
        const clump = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), new THREE.MeshStandardMaterial({ color: 0x7a4b2a, roughness: 1, flatShading: true }));
        await dropIntoPit(clump, { x: tMesh.position.x + 0.8, y: tMesh.position.y + 1.0, z: tMesh.position.z });
        tMesh.rotation.z = 0;
      }
      state.dirtDisposed = Math.round(((state.dirtDisposed || 0) + load) * 10) / 10;
      return load;
    }

// Things he'd happily part with: junk from digging, and second copies of the same thing
function unwantedItem() {
      const names = disposableNames();
      const junk = state.belongings.find(b => b.category === 'junk');
      if (junk) return junk.name;
      const dupe = names.find((n, i) => names.indexOf(n) !== i && !vehicleTypeFor(n));
      return dupe || null;
    }

function disposeUnwanted() {
      const name = unwantedItem();
      if (!name) return false;
      const isJunk = state.belongings.some(b => b.name === name && b.category === 'junk');
      return disposeItem(name, isJunk ? pick(['It was just cluttering up my shelves.', 'I kept it, but I have no use for it.']) : 'I already have one of these.');
    }

function disposalChance() {
      if (!unwantedItem()) return 0;
      // A cluttered Storehouse makes him keener to clear out
      const crowded = typeof shelfSlots !== 'undefined' && typeof storedItems === 'function' && storedItems().length > shelfSlots.length * 0.8;
      return crowded ? 0.15 : 0.06;
    }

function disposalSummaryForAI() {
      return state.disposedItems.length ? state.disposedItems.slice(0, 6).map(d => d.name).join(', ') : 'nothing yet';
    }

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(buildDisposalPit3D, 0);
});
