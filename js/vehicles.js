// Kelo-bot-1 — js/vehicles.js
// Loaded after storehouse.js. Things like a dump truck or a canoe are used, not carried:
// they are parked (land vehicles in a yard beside the Storehouse, boats at a dock on the shore),
// and Kelo-1 walks to them, climbs in and drives. With a dump truck and an excavator he really
// hauls dirt: the excavator scoops it into the truck and he drives the load to a spoil heap.
// Without a boat, wading into the lake teaches him he can't breathe underwater.

const VEHICLE_TYPES = [
  { kind: 'truck', re: /dump ?truck/i, mode: 'land', speed: 2.0, scale: 3.2, seatY: 1.1 },
  { kind: 'excavator', re: /excavator|digger|backhoe/i, mode: 'land', speed: 1.1, scale: 3.2, seatY: 1.0 },
  { kind: 'boat', re: /\b(boat|canoe|kayak|raft|rowboat|sailboat|paddle ?board)\b/i, mode: 'water', speed: 1.6, scale: 2.6, seatY: 0.25 },
  { kind: 'bike', re: /\b(bike|bicycle|scooter|skateboard)\b/i, mode: 'land', speed: 1.8, scale: 2.2, seatY: 0.3 },
  { kind: 'snowmobile', re: /snowmobile|snow ?machine/i, mode: 'snow', speed: 2.2, scale: 2.6, seatY: 0.6 },
  { kind: 'air', re: /helicopter|hot air balloon|glider|gyrocopter/i, mode: 'air', speed: 2.8, scale: 2.8, seatY: 0.6 }
];
const YARD_SLOTS = [[9.4, -5.4], [9.4, -8.2], [1.8, -5.2], [1.8, -8.4], [9.6, -10.6], [1.6, -10.8]];
const DOCK_SLOTS = [[2.2, 9.6], [5.6, 9.8], [-1.4, 9.4]];
const SPOIL_HEAP = { x: 20, z: -9 };
const WATER_LEVEL = -0.18;

const vehicleMeshes = {};
let dockGroup = null;

function vehicleTypeFor(name) {
      return VEHICLE_TYPES.find(v => v.re.test(String(name || ''))) || null;
    }

function findVehicle(kind) {
      return state.vehicles.find(v => v.kind === kind) || null;
    }

// A new vehicle arrives: give it a parking spot instead of a shelf
function registerVehicle(name) {
      const type = vehicleTypeFor(name);
      if (!type || state.vehicles.some(v => v.name === name)) return null;
      const slots = type.mode === 'water' ? DOCK_SLOTS : YARD_SLOTS;
      const used = new Set(state.vehicles.map(v => `${v.x},${v.z}`));
      const [x, z] = slots.find(([sx, sz]) => !used.has(`${sx},${sz}`)) || slots[0];
      const v = { id: 'veh-' + Date.now() + '-' + Math.floor(Math.random() * 1000), name, kind: type.kind, x, z, rotY: type.mode === 'water' ? Math.PI / 2 : 0, load: 0 };
      state.vehicles.push(v);
      state.unstoredItems = state.unstoredItems.filter(n => n !== name);
      renderVehicles3D();
      return v;
    }

function vehicleGroundY(v) {
      const type = vehicleTypeFor(v.name);
      const ground = getIslandGroundHeight(v.x, v.z);
      return type && type.mode === 'water' ? Math.max(ground, WATER_LEVEL) - 0.05 : ground;
    }

function buildVehicleMesh(v) {
      const type = vehicleTypeFor(v.name);
      const g = new THREE.Group();
      const model = buildItemModel3D(v.name, { label: false });
      model.scale.setScalar(type ? type.scale : 2.5);
      g.add(model);
      if (v.kind === 'truck') {
        // Dirt in the truck bed, shown when it is loaded
        const loadMesh = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x7a4b2a, roughness: 1, flatShading: true }));
        loadMesh.scale.set(1.3, 0.7, 1.0);
        loadMesh.position.set(-0.2, 0.75, 0);
        g.add(loadMesh);
        g.userData.loadMesh = loadMesh;
      }
      if (v.kind === 'excavator') g.userData.boom = model.children.find(c => c.geometry && c.geometry.type === 'BoxGeometry' && c.rotation.z < -0.3) || null;
      return g;
    }

function renderVehicles3D() {
      if (!scene) return;
      Object.keys(vehicleMeshes).forEach(id => {
        if (!state.vehicles.some(v => v.id === id)) {
          scene.remove(vehicleMeshes[id]);
          delete vehicleMeshes[id];
        }
      });
      state.vehicles.forEach(v => {
        let m = vehicleMeshes[v.id];
        if (!m) {
          m = buildVehicleMesh(v);
          scene.add(m);
          vehicleMeshes[v.id] = m;
        }
        if (state.riding !== v.id) {
          m.position.set(v.x, vehicleGroundY(v), v.z);
          m.rotation.y = v.rotY || 0;
        }
        if (m.userData.loadMesh) m.userData.loadMesh.visible = (v.load || 0) > 0;
      });
      if (!dockGroup && state.vehicles.some(v => v.kind === 'boat')) buildDock3D();
    }

function buildDock3D() {
      dockGroup = new THREE.Group();
      const wood = new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.9 });
      const deck = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.15, 1.2), wood);
      deck.position.set(2.1, 0.15, 8.6);
      dockGroup.add(deck);
      for (let i = 0; i < 6; i++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 8), wood);
        post.position.set(-1.9 + i * 1.6, -0.2, 9.15);
        dockGroup.add(post);
      }
      scene.add(dockGroup);
    }

// Every frame: a vehicle he is riding moves with him, and he sits on it
function updateVehicles(t) {
      if (!state.riding) return;
      const v = state.vehicles.find(x => x.id === state.riding);
      const m = v && vehicleMeshes[v.id];
      if (!m) return;
      const type = vehicleTypeFor(v.name);
      let y = getIslandGroundHeight(state.botPos.x, state.botPos.z);
      if (type.mode === 'water') y = Math.max(y, WATER_LEVEL) + Math.sin(t * 2.2) * 0.04;
      if (type.mode === 'air') y += 6 + Math.sin(t * 1.3) * 0.3;
      m.position.set(state.botPos.x, y, state.botPos.z);
      m.rotation.y = state.botRotY - Math.PI / 2;
      keloGroup.position.set(state.botPos.x, y + type.seatY, state.botPos.z);
      keloGroup.rotation.set(0, state.botRotY, 0);
      keloLeftLeg.rotation.x = -1.2;
      keloRightLeg.rotation.x = -1.2;
      keloLeftArm.rotation.x = -0.9;
      keloRightArm.rotation.x = -0.9;
    }

// Walk to a vehicle, climb in, drive to a target, and park there
async function driveVehicle(v, target, label) {
      const type = vehicleTypeFor(v.name);
      state.targetPos = { x: v.x - 1.2, z: v.z };
      state.moodTitle = `Walking to the ${v.name.replace(/^(an?|the)\s+/i, '')}`;
      renderAllUI();
      await waitForArrival(60000);
      state.riding = v.id;
      state.ridingSpeed = type.speed;
      state.ridingMode = type.mode;
      state.botPos = { x: v.x, z: v.z };
      state.moodEmoji = type.kind === 'boat' ? '🛶' : type.kind === 'air' ? '🚁' : '🚚';
      state.moodTitle = label || `Driving the ${v.name.replace(/^(an?|the)\s+/i, '')}`;
      renderAllUI();
      state.targetPos = { x: target.x, z: target.z };
      await waitForArrival(90000);
      v.x = Math.round(state.botPos.x * 10) / 10;
      v.z = Math.round(state.botPos.z * 10) / 10;
      v.rotY = state.botRotY - Math.PI / 2;
      state.riding = null;
      state.ridingSpeed = 1;
      state.ridingMode = null;
      renderVehicles3D();
    }

// Long trips: if he has a land vehicle (or an aircraft), he rides instead of walking
async function travelTo(target, label) {
      const dist = Math.hypot(target.x - state.botPos.x, target.z - state.botPos.z);
      const ride = dist > 14 && (state.vehicles.find(v => v.kind === 'air') || state.vehicles.find(v => v.kind === 'bike')
        || (typeof inSnow === 'function' && inSnow(target) ? state.vehicles.find(v => v.kind === 'snowmobile') : null));
      if (ride) {
        await driveVehicle(ride, target, label);
        state.targetPos = { x: state.botPos.x, z: state.botPos.z };
        return;
      }
      state.targetPos = { x: target.x, z: target.z };
      await waitForArrival(90000);
    }

// --- Hauling dirt: the excavator loads the truck, he drives it to the spoil heap -----------
let spoilHeapMesh = null;

function renderSpoilHeap() {
      if (!scene) return;
      if (spoilHeapMesh) scene.remove(spoilHeapMesh);
      if (!state.spoilHeap) return;
      const size = 0.6 + Math.sqrt(state.spoilHeap) * 0.5;
      spoilHeapMesh = new THREE.Mesh(new THREE.ConeGeometry(size, size * 0.8, 10), new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 1, flatShading: true }));
      spoilHeapMesh.position.set(SPOIL_HEAP.x, getAnalyticalGroundHeight(SPOIL_HEAP.x, SPOIL_HEAP.z) + size * 0.4, SPOIL_HEAP.z);
      spoilHeapMesh.castShadow = true;
      scene.add(spoilHeapMesh);
    }

// Called from inside a dig session (flags already set by digAt)
async function haulDirt(site) {
      const truck = findVehicle('truck');
      const excavator = findVehicle('excavator');
      if (!truck || !excavator) return 0;
      const pile = typeof pileOffset === 'function' ? pileOffset(site) : { x: site.x + 2.4, z: site.z };
      // 1. Bring the excavator to the pile if it isn't there yet
      if (Math.hypot(excavator.x - pile.x, excavator.z - pile.z) > 4) {
        await driveVehicle(excavator, { x: pile.x - 2.4, z: pile.z + 1.6 }, 'Driving the excavator to the dig');
      }
      // 2. Drive the truck alongside the pile
      await driveVehicle(truck, { x: pile.x + 0.5, z: pile.z + 2.6 }, 'Driving the dump truck to the dirt pile');
      // 3. Climb into the excavator and load the truck: the boom swings between pile and truck bed
      state.moodEmoji = '🏗️';
      state.moodTitle = 'Loading dirt into the dump truck';
      state.speechBubble = 'Scoop... swing... dump. Scoop... swing... dump.';
      renderAllUI();
      const exMesh = vehicleMeshes[excavator.id];
      const amount = Math.min(site.dirt - 1, 4);
      for (let i = 0; i < 4; i++) {
        if (exMesh) exMesh.rotation.y = (excavator.rotY || 0) + (i % 2 ? 0.9 : -0.6);
        await new Promise(r => setTimeout(r, 1100));
        site.dirt = Math.max(1, Math.round((site.dirt - amount / 4) * 100) / 100);
        truck.load = (truck.load || 0) + amount / 4;
        if (typeof updateDirtPile3D === 'function') updateDirtPile3D(site);
        renderVehicles3D();
      }
      if (exMesh) exMesh.rotation.y = excavator.rotY || 0;
      // 4. Drive the full truck to the spoil heap and dump it
      await driveVehicle(truck, { x: SPOIL_HEAP.x - 2.5, z: SPOIL_HEAP.z + 1.5 }, 'Driving the loaded dump truck to the spoil heap');
      const tMesh = vehicleMeshes[truck.id];
      if (tMesh) {
        for (let a = 0; a <= 10; a++) { tMesh.rotation.z = -a * 0.04; await new Promise(r => setTimeout(r, 80)); }
      }
      state.spoilHeap = (state.spoilHeap || 0) + (truck.load || 0);
      truck.load = 0;
      renderSpoilHeap();
      if (tMesh) tMesh.rotation.z = 0;
      renderVehicles3D();
      state.speechBubble = `Dumped ${amount.toFixed(1)} loads of dirt at the spoil heap.`;
      renderAllUI();
      return amount;
    }

// --- The lake -------------------------------------------------------------------------------
async function goBoating(originLabel = 'Out on the Lake') {
      const boat = findVehicle('boat');
      if (!boat || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isPracticing = true;
      try {
        const spots = Array.from({ length: 3 }, () => ({ x: randRange(-20, 20), z: randRange(14, 32) }));
        await driveVehicle(boat, spots[0], `Rowing the ${boat.name.replace(/^(an?|the)\s+/i, '')} out onto the lake`);
        for (const s of spots.slice(1)) {
          state.riding = boat.id;
          state.ridingSpeed = 1.6;
          state.ridingMode = 'water';
          state.targetPos = s;
          await waitForArrival(60000);
        }
        state.speechBubble = pick(['The island looks so small from out here.', 'I can see Ogopogo\'s ripples!', 'The water is so calm today.']);
        renderAllUI();
        const dock = DOCK_SLOTS[0];
        state.targetPos = { x: dock[0], z: dock[1] + 0.6 };
        await waitForArrival(60000);
        boat.x = dock[0];
        boat.z = dock[1];
        boat.rotY = Math.PI / 2;
        state.riding = null;
        state.ridingSpeed = 1;
        state.ridingMode = null;
        state.botPos = { x: dock[0], z: dock[1] - 1.3 };
        state.targetPos = { ...state.botPos };
        renderVehicles3D();
        state.diaryEntries.unshift({
          time: originLabel, location: 'Okanagan Lake', mood: '🛶 Out on the lake',
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I took the ${boat.name.replace(/^(an?|the)\s+/i, '')} out on the lake. ${state.speechBubble}`
        });
        state.happiness = Math.min(100, state.happiness + 8);
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        state.riding = null;
        state.ridingSpeed = 1;
        state.ridingMode = null;
        state.isPracticing = false;
      }
    }

// Without a boat he wades in... and finds out the hard way that he can't breathe underwater
async function wadeIntoLake(originLabel = 'Curious About the Water') {
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      if (findVehicle('boat')) return goBoating(originLabel);
      state.isPracticing = true;
      try {
        const x = Math.round(randRange(-10, 12) * 10) / 10;
        state.currentLocKey = 'custom';
        state.customPlaceName = 'the edge of the lake';
        state.targetPos = { x, z: 9.4 };
        state.moodEmoji = '🌊';
        state.moodTitle = state.knowsLakeDanger ? 'Looking at the deep water' : 'Wading into the lake';
        renderAllUI();
        await waitForArrival(60000);
        if (state.knowsLakeDanger) {
          state.speechBubble = 'I know better than to go in deeper. I need a boat.';
        } else {
          state.targetPos = { x, z: 13.2 };
          state.speechBubble = 'The water is getting deeper...';
          renderAllUI();
          await waitForArrival(20000);
          state.moodEmoji = '😨';
          state.moodTitle = "Can't breathe!";
          state.speechBubble = "Blub! I CAN'T BREATHE! Back, back, back!";
          state.wonderLevel = Math.max(0, state.wonderLevel - 10);
          state.calmLevel = Math.max(0, state.calmLevel - 25);
          renderAllUI();
          await new Promise(r => setTimeout(r, 1200));
          state.targetPos = { x, z: 8.4 };
          await waitForArrival(20000);
          state.knowsLakeDanger = true;
          state.diaryEntries.unshift({
            time: originLabel, location: 'the lake shore', mood: "😨 I can't breathe underwater",
            vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
            text: "Dear Diary, I walked into the lake to see what was out there. The water closed over my head and I couldn't breathe. I scrambled back out. If I want to go out on the water I need something that floats."
          });
          addConcept({ name: 'Water Over My Head', emoji: '🌊', definition: 'Deep water is not for walking; I need something that floats to go out on the lake.', builtFrom: ['nearly drowning'] }, 'Learned the hard way');
          addItemRequest('A small rowboat', 'vehicle', 'I tried walking into the lake and nearly drowned. I would love to go out on the water safely.', '');
        }
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        state.isPracticing = false;
      }
    }

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    // Anything vehicle-like he already owns gets a parking spot
    [...state.toolInventory, ...state.toys.map(t => t.name), ...state.belongings.map(b => b.name)]
      .filter(n => vehicleTypeFor(n) && !state.vehicles.some(v => v.name === n))
      .forEach(registerVehicle);
    state.riding = null;
    state.ridingSpeed = 1;
    renderVehicles3D();
    renderSpoilHeap();
  }, 0);
});
