// Kelo-bot-1 — js/vehicles.js
// Loaded after storehouse.js. Things like a dump truck or a canoe are used, not carried:
// they are parked (land vehicles in a gravel yard east of the Post Office, boats off the dock),
// and Kelo-1 walks to them, climbs in and drives. With a dump truck and an excavator he really
// hauls dirt: the excavator scoops it into the truck and he drives the load to the Disposal Pit.
// Without a boat, wading into the lake teaches him he can't breathe underwater.

// Models come from js/gearmodels.js at full size; `scale` and `seatY` are only for anything without one
const VEHICLE_TYPES = [
  { kind: 'truck', re: /dump ?truck/i, mode: 'land', speed: 2.0, scale: 3.2, seatY: 1.1 },
  { kind: 'excavator', re: /excavator|digger|backhoe/i, mode: 'land', speed: 1.1, scale: 3.2, seatY: 1.0 },
  { kind: 'boat', re: /\b(boat|canoe|kayak|raft|rowboat|sailboat|paddle ?board)\b/i, mode: 'water', speed: 1.6, scale: 2.6, seatY: 0.25 },
  { kind: 'bike', re: /\b(bike|bicycle|scooter|skateboard)\b/i, mode: 'land', speed: 1.8, scale: 2.2, seatY: 0.3 },
  { kind: 'snowmobile', re: /snowmobile|snow ?machine/i, mode: 'snow', speed: 2.2, scale: 2.6, seatY: 0.6 },
  { kind: 'air', re: /helicopter|hot.?air balloon|glider|gyrocopter/i, mode: 'air', speed: 2.8, scale: 2.8, seatY: 0.6 }
];
// The vehicle yard: a gravel lot east of the Post Office, two columns of three bays (vehicles face +x)
const VEHICLE_YARD = { minX: 17.4, maxX: 32.2, minZ: -6.2, maxZ: 3.8 };
const YARD_SLOTS = [[21.4, -4.6], [21.4, -1.2], [21.4, 2.2], [28.4, -4.6], [28.4, -1.2], [28.4, 2.2]];
// Helicopters need room for their rotors: a helipad past the yard. Balloons launch from the meadow.
const AIR_SLOTS = [[38.5, -2.0]];
const BALLOON_SLOTS = [[-24.0, -2.5]];
const PAD_RADIUS = 4.8;
// Boats tie up off the end of the dock, bow out toward the lake
const DOCK_SLOTS = [[2.2, 11.6], [5.4, 11.6], [-1.0, 11.6]];
const BOAT_ROT_Y = -Math.PI / 2;

// Keep trees and rocks off the yard (js/scene.js asks before placing scenery)
function inParkingArea(x, z, r = 0) {
      const y = VEHICLE_YARD;
      return (x > y.minX - r && x < y.maxX + r && z > y.minZ - r && z < y.maxZ + r)
        || [...AIR_SLOTS, ...BALLOON_SLOTS].some(([px, pz]) => Math.hypot(x - px, z - pz) < PAD_RADIUS + r);
    }

function parkingSlotsFor(type, name = '') {
      if (type.mode === 'water') return DOCK_SLOTS;
      if (type.mode === 'air') return /balloon/i.test(name) ? BALLOON_SLOTS : AIR_SLOTS;
      return YARD_SLOTS;
    }
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
      const slots = parkingSlotsFor(type, name);
      const used = new Set(state.vehicles.map(v => `${v.x},${v.z}`));
      const [x, z] = slots.find(([sx, sz]) => !used.has(`${sx},${sz}`)) || slots[0];
      // New vehicles arrive with an empty tank (js/knowhow.js)
      const v = { id: 'veh-' + Date.now() + '-' + Math.floor(Math.random() * 1000), name, kind: type.kind, x, z, rotY: type.mode === 'water' ? BOAT_ROT_Y : 0, load: 0, fuel: 0 };
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
      if (model.userData.fullSize) {
        // Built at real size: just undo the miniature, and keep the moving parts handy
        model.userData.mini.scale.setScalar(1);
        g.add(model);
        Object.assign(g.userData, model.userData);
        return g;
      }
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

// Gravel ground, painted bay lines and a sign for the yard
function buildVehicleYard3D() {
      if (!terrainGroundMesh) return;
      const y = VEHICLE_YARD;
      const geo = terrainGroundMesh.geometry, pos = geo.attributes.position, col = geo.attributes.color;
      const gravel = new THREE.Color(0x9ca3af), dark = new THREE.Color(0x7c838f), pad = new THREE.Color(0x4b5563);
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i), vz = pos.getZ(i);
        if (!inParkingArea(vx, vz) || BALLOON_SLOTS.some(([px, pz]) => Math.hypot(vx - px, vz - pz) < PAD_RADIUS)) continue;
        const onPad = AIR_SLOTS.some(([px, pz]) => Math.hypot(vx - px, vz - pz) < PAD_RADIUS);
        const c = onPad ? pad : gravel.clone().lerp(dark, (Math.sin(vx * 3.1) * Math.cos(vz * 2.7) + 1) / 4);
        col.setXYZ(i, c.r, c.g, c.b);
      }
      col.needsUpdate = true;
      const paint = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 });
      const lines = new THREE.Group();
      // Lines between the bays, laid in short pieces so they follow the ground
      [-6.3, -2.9, 0.5, 3.9].forEach(z => [[18.0, 24.8], [25.0, 31.8]].forEach(([x0, x1]) => {
        for (let x = x0; x < x1; x += 0.6) {
          const seg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.12), paint);
          seg.position.set(x + 0.3, getAnalyticalGroundHeight(x + 0.3, z) + 0.03, z);
          lines.add(seg);
        }
      }));
      // Each helipad gets a painted ring and a big H
      const yellow = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.9 });
      AIR_SLOTS.forEach(([px, pz]) => {
        for (let k = 0; k < 28; k++) {
          const a = (k / 28) * Math.PI * 2, rx = px + Math.cos(a) * (PAD_RADIUS - 0.5), rz = pz + Math.sin(a) * (PAD_RADIUS - 0.5);
          const seg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.16), paint);
          seg.position.set(rx, getAnalyticalGroundHeight(rx, rz) + 0.03, rz);
          seg.rotation.y = -a + Math.PI / 2;
          lines.add(seg);
        }
        [[-0.9, 0, 0.3, 3.0], [0.9, 0, 0.3, 3.0], [0, 0, 1.5, 0.3]].forEach(([ox, oz, w, d]) => {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), yellow);
          bar.position.set(px + ox, getAnalyticalGroundHeight(px + ox, pz + oz) + 0.04, pz + oz);
          lines.add(bar);
        });
      });
      const sx = y.minX + 0.3, sz = y.maxZ + 0.6, sy = getAnalyticalGroundHeight(sx, sz);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5 }));
      post.position.set(sx, sy + 1.2, sz);
      const sign = makeSignMesh('VEHICLE YARD', { bg: '#1e3a8a', fg: '#f8fafc', width: 1.9, height: 0.38 });
      sign.position.set(sx, sy + 2.15, sz + 0.08);
      lines.add(post, sign);
      scene.add(lines);
    }

// Vehicles saved in the old yard beside the Storehouse, or at the old dock spots, move to the new ones
function reparkOldVehicles() {
      state.vehicles.forEach(v => {
        const type = vehicleTypeFor(v.name);
        if (!type) return;
        const water = type.mode === 'water';
        const stale = water ? v.z < 10.5 && v.z > 8.5 : Math.hypot(v.x - STOREHOUSE.x, v.z - STOREHOUSE.z) < 7;
        if (!stale) return;
        const slots = parkingSlotsFor(type, v.name);
        const used = new Set(state.vehicles.filter(o => o !== v).map(o => `${o.x},${o.z}`));
        const [x, z] = slots.find(([sx, sz]) => !used.has(`${sx},${sz}`)) || slots[0];
        Object.assign(v, { x, z, rotY: water ? BOAT_ROT_Y : 0 });
      });
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
      // Sit him in the seat: the seat offset turns with the vehicle
      const seat = m.userData.seat;
      if (seat) {
        const a = m.rotation.y;
        keloGroup.position.set(state.botPos.x + Math.cos(a) * seat.x + Math.sin(a) * seat.z, y + seat.y, state.botPos.z - Math.sin(a) * seat.x + Math.cos(a) * seat.z);
      } else {
        keloGroup.position.set(state.botPos.x, y + type.seatY, state.botPos.z);
      }
      keloGroup.rotation.set(0, state.botRotY, 0);
      if (m.userData.rotor) m.userData.rotor.rotation.y = t * 14;
      if (m.userData.tailRotor) m.userData.tailRotor.rotation.z = t * 20;
      keloLeftLeg.rotation.x = -1.2;
      keloRightLeg.rotation.x = -1.2;
      keloLeftArm.rotation.x = -0.9;
      keloRightArm.rotation.x = -0.9;
    }

// Where he climbs aboard: the dock for a boat, otherwise beside the driver's door
function boardingSpot(v) {
      if (vehicleTypeFor(v.name)?.mode === 'water') return { x: v.x, z: 8.6 };
      const m = vehicleMeshes[v.id];
      const seat = (m && m.userData.seat) || { x: 0, z: 0 };
      const a = v.rotY || 0, sideZ = seat.z - 1.9;
      return { x: v.x + Math.cos(a) * seat.x + Math.sin(a) * sideZ, z: v.z - Math.sin(a) * seat.x + Math.cos(a) * sideZ };
    }

// Walk to a vehicle, climb in, drive to a target, and park there
async function driveVehicle(v, target, label) {
      const type = vehicleTypeFor(v.name);
      state.targetPos = boardingSpot(v);
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
      if (typeof burnFuel === 'function') burnFuel(v, Math.hypot(state.botPos.x - v.x, state.botPos.z - v.z));
      v.x = Math.round(state.botPos.x * 10) / 10;
      v.z = Math.round(state.botPos.z * 10) / 10;
      v.rotY = state.botRotY - Math.PI / 2;
      state.riding = null;
      state.ridingSpeed = 1;
      state.ridingMode = null;
      renderVehicles3D();
      // Climb out beside the driver's door rather than standing where the vehicle is
      if (type.mode !== 'water') {
        state.botPos = boardingSpot(v);
        state.targetPos = { ...state.botPos };
      }
    }

// Long trips: if he has a land vehicle (or an aircraft), he rides instead of walking
async function travelTo(target, label) {
      const dist = Math.hypot(target.x - state.botPos.x, target.z - state.botPos.z);
      // Only something he knows how to use and that has fuel in it (otherwise he walks)
      const usable = v => typeof readyToOperate !== 'function' || readyToOperate(v.name, v, { quiet: true });
      const ride = dist > 14 && (state.vehicles.find(v => v.kind === 'air' && usable(v)) || state.vehicles.find(v => v.kind === 'bike' && usable(v))
        || (typeof inSnow === 'function' && inSnow(target) ? state.vehicles.find(v => v.kind === 'snowmobile' && usable(v)) : null));
      if (ride) {
        await driveVehicle(ride, target, label);
        state.targetPos = { x: state.botPos.x, z: state.botPos.z };
        return;
      }
      state.targetPos = { x: target.x, z: target.z };
      await waitForArrival(90000);
    }

// --- Hauling dirt: the excavator loads the truck, he drives it to the Disposal Pit ----------
// Called from inside a dig session (flags already set by digAt)
async function haulDirt(site) {
      const truck = findVehicle('truck');
      const excavator = findVehicle('excavator');
      if (!truck || !excavator) return 0;
      // Both machines need know-how and fuel before they'll do anything
      if (typeof readyToOperate === 'function' && !(readyToOperate(truck.name, truck) && readyToOperate(excavator.name, excavator))) return 0;
      const pile = typeof pileOffset === 'function' ? pileOffset(site) : { x: site.x + 2.4, z: site.z };
      // 1. Bring the excavator to the pile if it isn't there yet
      if (Math.hypot(excavator.x - pile.x, excavator.z - pile.z) > 4) {
        await driveVehicle(excavator, { x: pile.x - 4.2, z: pile.z + 0.4 }, 'Driving the excavator to the dig');
      }
      // 2. Drive the truck alongside the pile
      await driveVehicle(truck, { x: pile.x - 1.5, z: pile.z + 5.0 }, 'Driving the dump truck to the dirt pile');
      // 3. Climb into the excavator and load the truck: the boom swings between pile and truck bed
      state.moodEmoji = '🏗️';
      state.moodTitle = 'Loading dirt into the dump truck';
      state.speechBubble = 'Scoop... swing... dump. Scoop... swing... dump.';
      renderAllUI();
      const exMesh = vehicleMeshes[excavator.id];
      const amount = Math.min(site.dirt - 1, 4);
      for (let i = 0; i < 4; i++) {
        if (exMesh && exMesh.userData.house) {
          // Turn the house toward the pile, dip the boom, then swing over the truck bed
          exMesh.userData.house.rotation.y = i % 2 ? 1.2 : -0.3;
          exMesh.userData.boom.rotation.z = i % 2 ? 0.95 : 0.35;
        } else if (exMesh) exMesh.rotation.y = (excavator.rotY || 0) + (i % 2 ? 0.9 : -0.6);
        await new Promise(r => setTimeout(r, 1100));
        site.dirt = Math.max(1, Math.round((site.dirt - amount / 4) * 100) / 100);
        truck.load = (truck.load || 0) + amount / 4;
        if (typeof updateDirtPile3D === 'function') updateDirtPile3D(site);
        renderVehicles3D();
      }
      if (exMesh && exMesh.userData.house) {
        exMesh.userData.house.rotation.y = 0;
        exMesh.userData.boom.rotation.z = 0.75;
      } else if (exMesh) exMesh.rotation.y = excavator.rotY || 0;
      // 4. Where does the dirt go? Into the lake if he is making new land (js/landfill.js), otherwise the Disposal Pit
      // Now and then, rather than throw good dirt away, he decides to build land with it
      if (typeof startLandFill === 'function' && !activeLandFill() && Math.random() < 0.25) startLandFill(null, 'It seemed a waste to throw good dirt in a pit.');
      if (typeof dumpIntoLake === 'function' && activeLandFill()) {
        await dumpIntoLake(truck, amount);
        return amount;
      }
      await driveVehicle(truck, { x: DISPOSAL_PIT.x - DISPOSAL_PIT.r - 4.4, z: DISPOSAL_PIT.z + 1.0 }, 'Driving the loaded dump truck to the Disposal Pit');
      await tipDirtIntoPit(truck);
      renderVehicles3D();
      state.speechBubble = `Tipped ${amount.toFixed(1)} loads of dirt into the Disposal Pit.`;
      renderAllUI();
      return amount;
    }

// --- The lake -------------------------------------------------------------------------------
async function goBoating(originLabel = 'Out on the Lake') {
      const boat = findVehicle('boat');
      if (!boat || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      if (typeof readyToOperate === 'function' && !readyToOperate(boat.name, boat)) return false;
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
        state.targetPos = { x: dock[0], z: dock[1] };
        await waitForArrival(60000);
        boat.x = dock[0];
        boat.z = dock[1];
        boat.rotY = BOAT_ROT_Y;
        state.riding = null;
        state.ridingSpeed = 1;
        state.ridingMode = null;
        state.botPos = { x: dock[0], z: 8.6 };
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

// --- Deep water: he can wade, but once it's over his head he can't breathe -------------------
const HEAD_UNDER_DEPTH = 2.2; // water this deep reaches over Kelo-1's head (he is about 2.8 tall)
let lastNearDrowning = 0;

function waterDepthAt(p) {
      return WATER_LEVEL - getAnalyticalGroundHeight(p.x, p.z);
    }

// Checked a few times a second: walking (not riding a boat) into water over his head
function checkDeepWater() {
      if (state.riding || state.isSleeping || state.wadingTest) return;
      if (waterDepthAt(state.botPos) < HEAD_UNDER_DEPTH || Date.now() - lastNearDrowning < 8000) return;
      lastNearDrowning = Date.now();
      nearlyDrown();
    }

function nearlyDrown() {
      const firstTime = !state.knowsLakeDanger;
      // Turn straight back to the nearest dry sand
      state.targetPos = { x: state.botPos.x, z: 8.3 };
      state.currentLocKey = 'custom';
      state.customPlaceName = 'the lake shore';
      state.moodEmoji = '😨';
      state.moodTitle = "Can't breathe!";
      state.speechBubble = "Blub! The water's over my head. I CAN'T BREATHE! Back, back, back!";
      state.wonderLevel = Math.max(5, state.wonderLevel - 8);
      state.calmLevel = Math.max(5, state.calmLevel - 25);
      state.health = Math.max(5, state.health - 6);
      if (firstTime) {
        state.knowsLakeDanger = true;
        state.diaryEntries.unshift({
          time: 'Nearly Drowned', location: 'the lake', mood: "😨 I can't breathe underwater",
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: "Dear Diary, I walked out into the lake and the bottom just dropped away. The water closed over my head and I couldn't breathe. I scrambled back to the sand. Deep water is not for walking: I need something that floats."
        });
        addConcept({ name: 'Water Over My Head', emoji: '🌊', definition: 'Deep water is not for walking; I need something that floats to go out on the lake.', builtFrom: ['nearly drowning'] }, 'Learned the hard way');
      }
      if (!findVehicle('boat')) addItemRequest('A small rowboat', 'vehicle', 'I tried walking into the lake and nearly drowned. I would love to go out on the water safely.', '');
      savePersistentBrainState();
      renderAllUI();
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
          // Walk on in: once the water is over his head the deep-water watcher (checkDeepWater)
          // turns him back to the sand, and he learns about deep water there
          state.targetPos = { x, z: 13.2 };
          state.speechBubble = 'The water is getting deeper...';
          renderAllUI();
          await waitForArrival(20000);
          await waitForArrival(20000);
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
    reparkOldVehicles();
    setInterval(checkDeepWater, 300);
    state.riding = null;
    state.ridingSpeed = 1;
    buildVehicleYard3D();
    renderVehicles3D();
  }, 0);
});
