// Kelo-bot-1 — js/landscape.js
// Loaded after seasons.js. Kelo-1 shapes the valley himself:
//   - chops trees with an axe (a stump stays, he keeps the firewood)
//   - plants seeds he asked for, which grow into saplings and young trees over his days
//   - lays gravel roads with a shovel and a load of gravel
//   - raises hills with a shovel
// He can undo anything he added (plantings, roads, hills). Buildings, the yard and the pit are off limits.
// Every change is kept in state.worldEdits and rebuilt when the page loads.

const HILL_RADIUS = 2.4, HILL_HEIGHT = 1.0;
const GROW_DAYS = 6; // world days for a seedling to grow to full size
const editMeshes = {};
let landscapeGroup = null;

function hasItem(re) {
      return [...state.toolInventory, ...state.toys.map(t => t.name), ...state.belongings.map(b => b.name)].find(n => re.test(n)) || null;
    }

// Hills he has raised lift the ground here (used by getAnalyticalGroundHeight)
function landscapeRaiseAt(x, z) {
      let h = 0;
      for (const e of state.worldEdits) {
        if (e.type !== 'hill') continue;
        const d = Math.hypot(x - e.x, z - e.z);
        if (d < e.r) {
          const t = 1 - (d / e.r) * (d / e.r);
          h += e.h * t * t;
        }
      }
      return h;
    }

// Buildings, the yard, the dock and the pit are never touched
function offLimits(x, z, pad = 0) {
      const building = Object.values(TOWN_LOCATIONS).find(l => !String(l.id).startsWith('dyn_') && Math.hypot(x - l.x, z - l.z) < 3.4 + pad);
      if (building) return building.name;
      if (Math.hypot(x - STOREHOUSE.x, z - STOREHOUSE.z) < 3.6 + pad) return 'the Storehouse';
      if (typeof MUSEUM !== 'undefined' && Math.abs(x - MUSEUM.x) < MUSEUM.w / 2 + 1 + pad && Math.abs(z - MUSEUM.z) < MUSEUM.d / 2 + 2.6 + pad) return 'the Museum';
      if (typeof inTown === 'function' && inTown(x, z)) return 'town';
      if (typeof BALLOON_SLOTS !== 'undefined' && BALLOON_SLOTS.some(([bx, bz]) => Math.hypot(x - bx, z - bz) < PAD_RADIUS + pad)) return 'the balloon field';
      if (typeof inParkingArea === 'function' && inParkingArea(x, z, pad)) return 'the vehicle yard';
      if (Math.hypot(x - DISPOSAL_PIT.x, z - DISPOSAL_PIT.z) < DISPOSAL_PIT.r + 1 + pad) return 'the Disposal Pit';
      if (z > 9.2) return 'the lake';
      return null;
    }

function newEditId(type) {
      return `${type}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
    }

function sayAndLog(title, emoji, speech, diaryText, originLabel) {
      state.moodEmoji = emoji;
      state.moodTitle = title.slice(0, 80);
      state.speechBubble = speech;
      state.changedLatelySummary = title;
      state.diaryEntries.unshift({
        time: originLabel, location: currentPlaceLabel(), mood: `${emoji} ${title}`.slice(0, 80),
        vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, ${diaryText}`
      });
      savePersistentBrainState();
      renderAllUI();
    }

// Start a physical job: refuses if he is busy, or if the spot is off limits
function startJob(x, z) {
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      const blocked = offLimits(x, z);
      if (blocked) {
        state.speechBubble = blocked === 'town' ? "That's in town. Town isn't mine to build in, so I'll find a spot outside it, or on the beach."
          : `That's right next to ${blocked}. I leave buildings and their grounds the way they are.`;
        renderAllUI();
        return false;
      }
      state.isPracticing = true;
      return true;
    }

// --- Meshes for each kind of change ----------------------------------------------------------------
function stumpMesh(e) {
      const g = new THREE.Group();
      const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 }));
      stump.position.y = 0.15;
      const rings = new THREE.Mesh(new THREE.CircleGeometry(0.19, 14), new THREE.MeshStandardMaterial({ color: 0xe0b77a }));
      rings.rotation.x = -Math.PI / 2;
      rings.position.y = 0.301;
      g.add(stump, rings);
      g.position.set(e.x, getIslandGroundHeight(e.x, e.z), e.z);
      return g;
    }

function plantingMesh(e) {
      const g = new THREE.Group();
      if (e.kind === 'tree') {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.4, 8), new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 }));
        trunk.position.y = 0.7;
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x4cc93b, roughness: 0.8 });
        leafMat.userData.seasonal = 'leaf';
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 12), leafMat);
        crown.position.y = 1.75;
        g.add(trunk, crown);
      } else {
        const colors = [0xff5d8f, 0xffd23f, 0xffffff, 0xa78bfa, 0xff8c42];
        for (let i = 0; i < 9; i++) {
          const a = i * 2.4, r = 0.15 + (i % 3) * 0.2;
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 4), new THREE.MeshStandardMaterial({ color: 0x2f9e44 }));
          stem.position.set(Math.cos(a) * r, 0.17, Math.sin(a) * r);
          const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: colors[i % colors.length], emissive: colors[i % colors.length], emissiveIntensity: 0.15 }));
          bloom.position.set(stem.position.x, 0.36, stem.position.z);
          g.add(stem, bloom);
        }
      }
      // A little ring of turned soil around it
      const soil = new THREE.Mesh(new THREE.CircleGeometry(e.kind === 'tree' ? 0.45 : 0.75, 16), new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 1 }));
      soil.rotation.x = -Math.PI / 2;
      soil.position.y = 0.02;
      g.add(soil);
      g.position.set(e.x, getIslandGroundHeight(e.x, e.z), e.z);
      g.userData.growing = true;
      return g;
    }

function growthOf(e) {
      const days = (Date.now() - e.at) / (typeof WORLD_DAY_MS === 'number' ? WORLD_DAY_MS : 43200000);
      return Math.min(1, 0.15 + days / GROW_DAYS);
    }

function roadMesh(e) {
      const g = new THREE.Group();
      const gravel = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 1 });
      const edge = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 1 });
      const len = Math.hypot(e.toX - e.x, e.toZ - e.z);
      const ang = Math.atan2(e.toX - e.x, e.toZ - e.z);
      for (let d = 0; d < len; d += 0.6) {
        const x = e.x + Math.sin(ang) * d, z = e.z + Math.cos(ang) * d;
        if (offLimits(x, z, -0.6)) continue; // the road stops short of buildings
        const y = getIslandGroundHeight(x, z) + 0.03;
        const slab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.64), gravel);
        slab.position.set(x, y, z);
        slab.rotation.y = ang;
        slab.receiveShadow = true;
        g.add(slab);
        [-0.8, 0.8].forEach(side => {
          const stone = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.6), edge);
          stone.position.set(x + Math.cos(ang) * side, y + 0.02, z - Math.sin(ang) * side);
          stone.rotation.y = ang;
          g.add(stone);
        });
      }
      return g;
    }

function hillMesh() {
      return null; // a hill is the ground itself (landscapeRaiseAt)
    }

function renderEdit(e) {
      if (!landscapeGroup || editMeshes[e.id]) return;
      const m = e.type === 'chop' ? stumpMesh(e) : e.type === 'plant' ? plantingMesh(e) : e.type === 'road' ? roadMesh(e) : hillMesh(e);
      if (!m) return;
      if (e.type === 'plant') m.scale.setScalar(growthOf(e));
      landscapeGroup.add(m);
      editMeshes[e.id] = m;
    }

function removeEditMesh(id) {
      const m = editMeshes[id];
      if (!m) return;
      landscapeGroup.remove(m);
      m.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      delete editMeshes[id];
    }

// A chopped tree is gone from the valley (and from the obstacles he walks around)
function removeValleyTree(treeId) {
      const tree = valleyTrees.find(t => t.id === treeId);
      if (!tree) return;
      scene.remove(tree.group);
      worldObstacles = worldObstacles.filter(o => o !== tree.obstacle);
      tree.removed = true;
    }

function hillTerrainRefresh(e) {
      if (typeof refreshTerrainAround === 'function') refreshTerrainAround(e.x, e.z, e.r + 0.6);
    }

// --- The jobs -----------------------------------------------------------------------------------
function nearestTree(x, z) {
      return valleyTrees.filter(t => !t.removed).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0] || null;
    }

async function chopTree(x = state.botPos.x, z = state.botPos.z, why = '', originLabel = 'Shaping the Valley') {
      const axe = hasItem(/^(?!.*pick ?ax).*(\baxe\b|hatchet)/i);
      if (!axe) {
        addItemRequest('An axe', 'tool', 'I want to clear a tree, and I have nothing to cut it with.', 'Shaping the valley');
        state.speechBubble = 'I would need an axe to cut a tree down. I asked for one.';
        renderAllUI();
        return 'needs-axe';
      }
      if (typeof readyToOperate === 'function' && !readyToOperate(axe)) return 'learning';
      const tree = nearestTree(x, z);
      if (!tree || !startJob(tree.x, tree.z)) return false;
      try {
        if (typeof fetchFromStorehouse === 'function') await fetchFromStorehouse(axe);
        state.currentLocKey = 'custom';
        state.customPlaceName = 'a tree in the valley';
        state.targetPos = { x: tree.x - 1.2, z: tree.z };
        state.moodEmoji = '🪓';
        state.moodTitle = 'Walking over to chop a tree';
        renderAllUI();
        await waitForArrival(60000);
        state.botRotY = Math.atan2(tree.x - state.botPos.x, tree.z - state.botPos.z);
        state.moodTitle = 'Chopping down a tree';
        state.speechBubble = 'Thunk... thunk... thunk...';
        state.microPose = 'digging';
        renderAllUI();
        for (let i = 0; i < 5; i++) {
          tree.group.rotation.z = (i % 2 ? 0.03 : -0.03);
          await new Promise(r => setTimeout(r, 700));
        }
        state.microPose = 'normal';
        state.speechBubble = 'Timber!';
        renderAllUI();
        // It topples away from him
        for (let a = 0; a <= 16; a++) {
          tree.group.rotation.z = -(a / 16) * (Math.PI / 2) * (a / 16);
          await new Promise(r => setTimeout(r, 60));
        }
        await new Promise(r => setTimeout(r, 600));
        removeValleyTree(tree.id);
        const e = { id: newEditId('chop'), type: 'chop', treeId: tree.id, x: tree.x, z: tree.z, at: Date.now(), why: String(why).slice(0, 160) };
        state.worldEdits.push(e);
        renderEdit(e);
        state.belongings.unshift({ name: 'Firewood logs', category: 'material', emoji: '🪵', from: 'a tree I chopped' });
        state.unstoredItems.push('Firewood logs');
        state.fullness = Math.max(5, state.fullness - 4);
        sayAndLog('Chopped down a tree', '🪓', 'Down it came. I kept the logs, and the stump can stay as a seat.',
          `I chopped down a tree with my axe. ${why ? why + ' ' : ''}A stump is all that's left there now, and I stacked the logs to take home.`, originLabel);
        return true;
      } finally {
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.microPose = 'normal';
        state.isPracticing = false;
      }
    }

async function plantSeeds(x, z, why = '', originLabel = 'Shaping the Valley') {
      const seeds = hasItem(/^(?!.*bird ?seed).*(seed|sapling|bulb)/i);
      if (!seeds) {
        addItemRequest('A packet of tree seeds', 'material', 'I want to plant something and watch it grow, but I have no seeds.', 'Shaping the valley');
        state.speechBubble = "I'd love to plant something, but I have no seeds. I asked for some.";
        renderAllUI();
        return 'needs-seeds';
      }
      x = Math.round(clampNumber(x, WORLD_MIN_X + 2, WORLD_MAX_X - 2, state.botPos.x) * 10) / 10;
      z = Math.round(clampNumber(z, WORLD_MIN_Z + 2, 9, state.botPos.z) * 10) / 10;
      if (!startJob(x, z)) return false;
      try {
        state.currentLocKey = 'custom';
        state.customPlaceName = 'a patch of open ground';
        state.targetPos = { x: x - 0.9, z };
        state.moodEmoji = '🌱';
        state.moodTitle = `Planting ${seeds.replace(/^(an?|the|some)\s+/i, '')}`.slice(0, 80);
        renderAllUI();
        await waitForArrival(60000);
        state.microPose = 'digging';
        await new Promise(r => setTimeout(r, 2500));
        const kind = /flower|bulb|wildflower|sunflower|tulip|daisy/i.test(seeds) ? 'flowers' : 'tree';
        const e = { id: newEditId('plant'), type: 'plant', kind, seed: seeds, x, z, at: Date.now(), why: String(why).slice(0, 160) };
        state.worldEdits.push(e);
        renderEdit(e);
        if (typeof forgetItem === 'function') forgetItem(seeds);
        if (typeof seasonApplied !== 'undefined') seasonApplied = null; // let the new leaves match the season
        sayAndLog(`Planted ${kind === 'tree' ? 'a tree' : 'flowers'}`, '🌱', kind === 'tree' ? "A seedling! In a few days it'll be a young tree." : 'Flowers, right here. They should be up in no time.',
          `I planted the ${seeds.replace(/^(an?|the|some)\s+/i, '')} in the valley. ${why ? why + ' ' : ''}I'll watch it grow over the next few days.`, originLabel);
        return true;
      } finally {
        state.microPose = 'normal';
        state.isPracticing = false;
      }
    }

async function buildRoad(fromX, fromZ, toX, toZ, why = '', originLabel = 'Shaping the Valley') {
      const shovel = hasItem(/shovel|spade/i);
      const gravel = hasItem(/gravel|crushed stone|paving|road base/i);
      if (!shovel || !gravel) {
        if (!shovel) addItemRequest('A sturdy shovel', 'tool', 'To build a road I need a shovel to level the ground.', 'Shaping the valley');
        if (!gravel) addItemRequest('A load of gravel', 'material', 'A road needs gravel, or it turns to mud.', 'Shaping the valley');
        state.speechBubble = `To build a road I need ${!shovel ? 'a shovel' : ''}${!shovel && !gravel ? ' and ' : ''}${!gravel ? 'a load of gravel' : ''}. I asked for it.`;
        renderAllUI();
        return 'needs-materials';
      }
      if (typeof readyToOperate === 'function' && !readyToOperate(shovel)) return 'learning';
      const len = Math.hypot(toX - fromX, toZ - fromZ);
      if (len < 2) return false;
      // Long roads are built a stretch at a time
      if (len > 18) { toX = fromX + (toX - fromX) * 18 / len; toZ = fromZ + (toZ - fromZ) * 18 / len; }
      if (!startJob(fromX, fromZ)) return false;
      try {
        if (typeof fetchFromStorehouse === 'function') await fetchFromStorehouse(shovel);
        state.currentLocKey = 'custom';
        state.customPlaceName = 'his new road';
        state.moodEmoji = '🛤️';
        state.moodTitle = 'Laying a gravel road';
        state.speechBubble = 'Level the ground, spread the gravel, tamp it down. One stretch at a time.';
        state.targetPos = { x: fromX, z: fromZ };
        renderAllUI();
        await waitForArrival(60000);
        const e = { id: newEditId('road'), type: 'road', x: Math.round(fromX * 10) / 10, z: Math.round(fromZ * 10) / 10, toX: Math.round(toX * 10) / 10, toZ: Math.round(toZ * 10) / 10, at: Date.now(), why: String(why).slice(0, 160) };
        // Grow the road behind him as he walks along it
        const steps = 5;
        for (let i = 1; i <= steps; i++) {
          const part = { ...e, id: e.id + '-wip', toX: e.x + (e.toX - e.x) * i / steps, toZ: e.z + (e.toZ - e.z) * i / steps };
          removeEditMesh(part.id);
          renderEdit(part);
          state.targetPos = { x: part.toX, z: part.toZ };
          await waitForArrival(30000);
          await new Promise(r => setTimeout(r, 900));
        }
        removeEditMesh(e.id + '-wip');
        state.worldEdits.push(e);
        renderEdit(e);
        if (typeof forgetItem === 'function') forgetItem(gravel);
        sayAndLog('Built a gravel road', '🛤️', 'A real road! Now nobody has to walk through the mud here.',
          `I laid a gravel road about ${Math.round(Math.hypot(e.toX - e.x, e.toZ - e.z))} steps long. ${why ? why + ' ' : ''}It felt good to make something everyone can use.`, originLabel);
        return true;
      } finally {
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.isPracticing = false;
      }
    }

async function raiseHill(x, z, why = '', originLabel = 'Shaping the Valley') {
      const shovel = hasItem(/shovel|spade/i);
      if (!shovel) {
        addItemRequest('A sturdy shovel', 'tool', 'I want to shape the land into a little hill.', 'Shaping the valley');
        return 'needs-shovel';
      }
      if (typeof readyToOperate === 'function' && !readyToOperate(shovel)) return 'learning';
      x = Math.round(clampNumber(x, WORLD_MIN_X + 3, WORLD_MAX_X - 3, state.botPos.x) * 10) / 10;
      z = Math.round(clampNumber(z, -12, 6, state.botPos.z) * 10) / 10;
      if (offLimits(x, z, HILL_RADIUS) || !startJob(x, z)) {
        if (offLimits(x, z, HILL_RADIUS)) { state.speechBubble = `A hill there would spill onto ${offLimits(x, z, HILL_RADIUS)}. I'll leave it.`; renderAllUI(); }
        return false;
      }
      try {
        if (typeof fetchFromStorehouse === 'function') await fetchFromStorehouse(shovel);
        state.currentLocKey = 'custom';
        state.customPlaceName = 'a spot he is reshaping';
        state.targetPos = { x: x - HILL_RADIUS - 0.4, z };
        state.moodEmoji = '⛰️';
        state.moodTitle = 'Shaping a little hill';
        renderAllUI();
        await waitForArrival(60000);
        state.microPose = 'digging';
        const e = { id: newEditId('hill'), type: 'hill', x, z, r: HILL_RADIUS, h: 0, at: Date.now(), why: String(why).slice(0, 160) };
        state.worldEdits.push(e);
        for (let i = 1; i <= 5; i++) {
          await new Promise(r => setTimeout(r, 1200));
          e.h = Math.round(HILL_HEIGHT * i / 5 * 100) / 100;
          hillTerrainRefresh(e);
        }
        sayAndLog('Raised a little hill', '⛰️', 'A hill of my own. I can see a bit further from the top.',
          `I shovelled the earth into a small hill. ${why ? why + ' ' : ''}If I change my mind I can always flatten it again.`, originLabel);
        return true;
      } finally {
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.microPose = 'normal';
        state.isPracticing = false;
      }
    }

// Undo something he added: dig up a planting, pick up a road, flatten a hill.
// A chopped tree can't be un-chopped, but he can plant a new one.
async function undoEdit(id, why = '', originLabel = 'Changing His Mind') {
      const e = state.worldEdits.find(w => w.id === id) || (id === 'last' ? [...state.worldEdits].reverse().find(w => w.type !== 'chop') : null);
      if (!e || e.type === 'chop') return false;
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isPracticing = true;
      try {
        state.currentLocKey = 'custom';
        state.customPlaceName = 'something he made';
        state.targetPos = { x: e.x - (e.type === 'hill' ? e.r + 0.4 : 1.0), z: e.z };
        state.moodEmoji = '↩️';
        state.moodTitle = `Undoing his ${e.type === 'plant' ? 'planting' : e.type}`;
        renderAllUI();
        await waitForArrival(60000);
        state.microPose = 'digging';
        if (e.type === 'hill') {
          for (let i = 4; i >= 0; i--) {
            await new Promise(r => setTimeout(r, 900));
            e.h = Math.round(HILL_HEIGHT * i / 5 * 100) / 100;
            hillTerrainRefresh(e);
          }
        } else {
          await new Promise(r => setTimeout(r, 2500));
        }
        state.worldEdits = state.worldEdits.filter(w => w !== e);
        removeEditMesh(e.id);
        if (e.type === 'hill') hillTerrainRefresh(e);
        const what = e.type === 'plant' ? (e.kind === 'tree' ? 'the tree I planted' : 'the flowers I planted') : e.type === 'road' ? 'my road' : 'my hill';
        sayAndLog(`Took away ${what}`, '↩️', `There. ${what[0].toUpperCase() + what.slice(1)} is gone, and the ground is the way it was.`,
          `I changed my mind and took away ${what}. ${why ? why + ' ' : ''}It's good to know nothing I make has to be forever.`, originLabel);
        return true;
      } finally {
        state.microPose = 'normal';
        state.isPracticing = false;
      }
    }

// --- How he decides to shape things on his own -----------------------------------------------------
function landscapeChance() {
      if (hasItem(/^(?!.*bird ?seed).*(seed|sapling|bulb)/i)) return 0.12;
      if (hasItem(/gravel|crushed stone|paving/i) && hasItem(/shovel|spade/i)) return 0.08;
      if (hasItem(/^(?!.*pick ?ax).*(\baxe\b|hatchet)/i)) return 0.04;
      return 0.01;
    }

function shapeTheValleyOnMyOwn() {
      const open = () => {
        for (let i = 0; i < 20; i++) {
          const x = randRange(-1, 1) < 0 ? randRange(WORLD_MIN_X + 4, TOWN.minX - 2) : randRange(TOWN.maxX + 16, WORLD_MAX_X - 4), z = randRange(-11, 6);
          if (!offLimits(x, z, 1.5) && !pointBlocked(x, z, { x: 999, z: 999 })) return { x, z };
        }
        return { x: -14, z: 2 };
      };
      if (hasItem(/^(?!.*bird ?seed).*(seed|sapling|bulb)/i)) { const p = open(); return plantSeeds(p.x, p.z, 'I wanted something living that I put there myself.', 'Felt Like Planting'); }
      if (hasItem(/gravel|crushed stone|paving/i) && hasItem(/shovel|spade/i)) {
        // A road out west, from the edge of town toward the Museum and the woods
        return buildRoad(TOWN.minX - 1, -2, MUSEUM_DOOR.x + 6, MUSEUM_DOOR.z + 1, 'My feet keep wearing a muddy track out here.', 'Felt Like Building');
      }
      if (hasItem(/^(?!.*pick ?ax).*(\baxe\b|hatchet)/i) && Math.random() < 0.5) { const p = open(); return chopTree(p.x, p.z, 'I wanted to open up a clearing.', 'Felt Like Chopping'); }
      if (Math.random() < 0.3 && state.worldEdits.some(e => e.type !== 'chop')) return undoEdit('last', 'It looked better before.');
      if (hasItem(/shovel|spade/i)) { const p = open(); return raiseHill(p.x, p.z, 'I wanted a little lookout.', 'Felt Like Shaping'); }
      return addItemRequest('A packet of tree seeds', 'material', 'I want to plant a tree of my own somewhere in the valley.', 'Shaping the valley');
    }

// From an AI decision: {"action": "chop"|"plant"|"road"|"hill"|"undo", "x", "z", "toX", "toZ", "id", "why"}
function applyShapeDecision(shape) {
      if (!shape || typeof shape !== 'object') return;
      const n = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
      const x = n(shape.x, state.botPos.x), z = n(shape.z, state.botPos.z), why = String(shape.why || '').slice(0, 160);
      const run = {
        chop: () => chopTree(x, z, why, 'Decided to Chop'),
        plant: () => plantSeeds(x, z, why, 'Decided to Plant'),
        road: () => buildRoad(x, z, n(shape.toX, x + 8), n(shape.toZ, z), why, 'Decided to Build a Road'),
        hill: () => raiseHill(x, z, why, 'Decided to Shape the Land'),
        undo: () => undoEdit(String(shape.id || 'last'), why, 'Changed His Mind')
      }[String(shape.action || '').toLowerCase()];
      if (run) doWhenFree(run);
    }

function landscapeSummaryForAI() {
      const edits = state.worldEdits.slice(-8).map(e => e.type === 'road' ? `${e.id}: road (${e.x}, ${e.z}) to (${e.toX}, ${e.toZ})`
        : e.type === 'plant' ? `${e.id}: ${e.kind} planted at (${e.x}, ${e.z})` : e.type === 'hill' ? `${e.id}: hill at (${e.x}, ${e.z})` : `${e.id}: stump at (${e.x}, ${e.z})`);
      return edits.length ? edits.join('; ') : 'nothing yet';
    }

// --- Brain tab list ----------------------------------------------------------------------------------
function renderLandscapeList() {
      const el = document.getElementById('landscapeListContainer');
      if (!el) return;
      const label = { chop: '🪓 Chopped a tree', plant: '🌱 Planted', road: '🛤️ Built a road', hill: '⛰️ Raised a hill' };
      el.innerHTML = state.worldEdits.slice().reverse().slice(0, 12).map(e => `
        <div class="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-200">
          ${escapeHtml(label[e.type] || e.type)}${e.type === 'plant' ? ` ${escapeHtml(e.kind === 'tree' ? 'a tree' : 'flowers')} <span class="text-slate-500">(${Math.round(growthOf(e) * 100)}% grown)</span>` : ''}
          ${e.why ? `<div class="text-slate-400 italic">${escapeHtml(e.why)}</div>` : ''}
        </div>`).join('');
    }

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    landscapeGroup = new THREE.Group();
    scene.add(landscapeGroup);
    state.worldEdits.forEach(e => {
      if (e.type === 'chop') removeValleyTree(e.treeId);
      renderEdit(e);
    });
    if (state.worldEdits.some(e => e.type === 'hill')) state.worldEdits.filter(e => e.type === 'hill').forEach(hillTerrainRefresh);
    renderLandscapeList();
    // Plantings grow as his days pass
    setInterval(() => {
      state.worldEdits.forEach(e => { if (e.type === 'plant' && editMeshes[e.id]) editMeshes[e.id].scale.setScalar(growthOf(e)); });
      renderLandscapeList();
    }, 5000);
  }, 300);
});
