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
      return ownedItemNames().find(n => re.test(n)) || null;
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
      if (Math.abs(x - STOREHOUSE.x) < STOREHOUSE.w / 2 + 1 + pad && Math.abs(z - STOREHOUSE.z) < STOREHOUSE.d / 2 + 2 + pad) return 'the Storehouse';
      const tb = typeof townBuildingAt === 'function' ? townBuildingAt(x, z, 1 + pad) : null;
      if (tb) return TOWN_LOCATIONS[tb.building] ? TOWN_LOCATIONS[tb.building].name : 'a building';
      if (typeof inWorkshopSite === 'function' && inWorkshopSite(x, z, pad)) return 'the Workshop';
      if (typeof HOUSE !== 'undefined' && Math.abs(x - HOUSE.x) < HOUSE.w / 2 + 1.5 + pad && Math.abs(z - HOUSE.z) < HOUSE.d / 2 + 2.5 + pad) return 'my house';
      if (typeof MUSEUM !== 'undefined' && Math.abs(x - MUSEUM.x) < MUSEUM.w / 2 + 1 + pad && Math.abs(z - MUSEUM.z) < MUSEUM.d / 2 + 2.6 + pad) return 'the Museum';
      if (typeof inTown === 'function' && inTown(x, z)) return 'town';
      if (typeof BALLOON_SLOTS !== 'undefined' && BALLOON_SLOTS.some(([bx, bz]) => Math.hypot(x - bx, z - bz) < PAD_RADIUS + pad)) return 'the balloon field';
      if (typeof inParkingArea === 'function' && inParkingArea(x, z, pad)) return 'the vehicle yard';
      if (Math.hypot(x - DISPOSAL_PIT.x, z - DISPOSAL_PIT.z) < DISPOSAL_PIT.r + 1 + pad) return 'the Disposal Pit';
      if (z > 9.2) return 'the lake';
      // His roads and paths stay clear (js/roads.js)
      if (typeof keloRoadAt === 'function') { const road = keloRoadAt(x, z, pad); if (road) return road.name; }
      // The runway field and its taxiway are kept for the runway (only a runway job may work on them)
      if (typeof onRunwayReserve === 'function' && onRunwayReserve(x, z, pad) && !runwayJobActive) return 'the runway field';
      return null;
    }
// Set by a runway job (future) while it works the field, so offLimits lets it clear, grade and pave
let runwayJobActive = false;

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
      // Bark round the sides and growth rings on the cut top (js/materials.js)
      const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.3, 14), new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.9 }));
      stump.position.y = 0.15;
      const rings = new THREE.Mesh(new THREE.CircleGeometry(0.19, 18), new THREE.MeshStandardMaterial({ color: 0xe0b77a }));
      rings.rotation.x = -Math.PI / 2;
      rings.position.y = 0.301;
      g.add(stump, rings);
      if (typeof finishMaterial === 'function') {
        finishMaterial(stump.material, 'bark');
        finishMaterial(rings.material, 'rings');
        // A few chips of fresh wood from the axe
        const chipMat = finishMaterial(new THREE.MeshStandardMaterial({ color: 0xe8c48c }), 'wood');
        const rng = makeRng(e.id || 'chips');
        const chips = [];
        for (let i = 0; i < 6; i++) {
          const chip = new THREE.Object3D();
          const a = rng() * Math.PI * 2, r = 0.32 + rng() * 0.3;
          chip.position.set(Math.cos(a) * r, 0.01, Math.sin(a) * r);
          chip.rotation.set(0, rng() * 3, (rng() - 0.5) * 0.4);
          chips.push(chip);
        }
        // All six chips in one draw call (js/perf.js)
        g.add(perfInstances(new THREE.BoxGeometry(0.07, 0.012, 0.04), chipMat, chips));
      }
      g.position.set(e.x, getIslandGroundHeight(e.x, e.z), e.z);
      return g;
    }

function plantingMesh(e) {
      const g = new THREE.Group();
      const real = typeof finishMaterial === 'function';
      if (e.kind === 'tree' && typeof buildNaturalLeafyTree === 'function') {
        // The same kind of broadleaf tree as the valley's own (js/realism.js), shaped by its id
        g.add(buildNaturalLeafyTree(makeRng(e.id || 'planted-tree'), 2));
      } else if (e.kind === 'tree') {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.4, 10), new THREE.MeshStandardMaterial({ color: 0x7a5232, roughness: 0.9 }));
        trunk.position.y = 0.7;
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x4cc93b, roughness: 0.8 });
        leafMat.userData.seasonal = 'leaf';
        // A lumpy, leafy crown rather than a perfect ball
        const crownGeo = new THREE.SphereGeometry(0.85, 16, 12);
        if (real) roughenGeometry(crownGeo, 0.05, 3);
        const crown = new THREE.Mesh(crownGeo, leafMat);
        crown.position.y = 1.75;
        g.add(trunk, crown);
        [[0.45, 1.5, 0.2, 0.45], [-0.4, 1.6, -0.25, 0.5]].forEach(([x, y, z, r]) => {
          const clump = new THREE.Mesh(crownGeo, leafMat);
          clump.position.set(x, y, z);
          clump.scale.setScalar(r / 0.85);
          g.add(clump);
        });
        if (real) {
          finishMaterial(trunk.material, 'bark');
          finishMaterial(leafMat, 'leaf');
        }
      } else {
        const colors = [0xff5d8f, 0xffd23f, 0xffffff, 0xa78bfa, 0xff8c42];
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x2f9e44 });
        const heartMat = new THREE.MeshStandardMaterial({ color: 0xf2b705, roughness: 0.9 });
        if (real) { finishMaterial(stemMat, 'leaf'); finishMaterial(heartMat, 'seed'); }
        // Every stem, bloom, middle and leaf of the clump is drawn together, one draw call each (js/perf.js);
        // the blooms share one material and get their colours per flower
        const bloomMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x222222 });
        if (real) finishMaterial(bloomMat, 'petal');
        const stems = [], blooms = [], hearts = [], leaves = [], bloomColors = [];
        for (let i = 0; i < 9; i++) {
          const a = i * 2.4, r = 0.15 + (i % 3) * 0.2;
          const x = Math.cos(a) * r, z = Math.sin(a) * r;
          const stem = new THREE.Object3D();
          stem.position.set(x, 0.17, z);
          // An open flower: a flat ring of petals around a seed-heavy middle
          const bloom = new THREE.Object3D();
          bloom.scale.set(1, 0.35, 1);
          bloom.position.set(x, 0.36, z);
          const heart = new THREE.Object3D();
          heart.position.set(x, 0.375, z);
          const leaf = new THREE.Object3D();
          leaf.scale.set(1, 0.2, 0.4);
          leaf.position.set(x + 0.04, 0.1, z);
          leaf.rotation.z = 0.5;
          stems.push(stem); blooms.push(bloom); hearts.push(heart); leaves.push(leaf);
          bloomColors.push(colors[i % colors.length]);
        }
        g.add(
          perfInstances(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 4), stemMat, stems),
          perfInstances(new THREE.SphereGeometry(0.075, 10, 6), bloomMat, blooms, { colors: bloomColors }),
          perfInstances(new THREE.SphereGeometry(0.025, 6, 4), heartMat, hearts),
          perfInstances(new THREE.SphereGeometry(0.06, 8, 4), stemMat, leaves)
        );
      }
      // A little ring of turned soil around it
      const soil = new THREE.Mesh(new THREE.CircleGeometry(e.kind === 'tree' ? 0.45 : 0.75, 16), new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 1 }));
      if (real) finishMaterial(soil.material, 'soil');
      soil.rotation.x = -Math.PI / 2;
      soil.position.y = 0.02;
      g.add(soil);
      g.position.set(e.x, getIslandGroundHeight(e.x, e.z), e.z);
      g.userData.growing = true;
      return g;
    }

function growthOf(e) {
      // Water, nutrients and care decide it (js/plantcare.js)
      if (typeof plantGrowthOf === 'function') return plantGrowthOf(e);
      // Spring rain gives it a head start on top of its own days (js/weather.js)
      const days = (Date.now() - e.at + (e.rainMs || 0)) / (typeof WORLD_DAY_MS === 'number' ? WORLD_DAY_MS : 43200000);
      return Math.min(1, 0.15 + days / GROW_DAYS);
    }

function roadMesh(e) {
      const g = new THREE.Group();
      const real = typeof finishMaterial === 'function';
      // Packed gravel (the texture carries the pebbles' colours) edged with rough fieldstones
      // Stages while he works: 'bed' dug-out soil, 'loose' heaped gravel, 'raked' even gravel, then packed.
      // Paved roads: 'hot' fresh dark asphalt, then rolled asphalt with a dashed centre line.
      const stage = e.stage || null;
      const asphalt = e.surface === 'asphalt' || stage === 'hot';
      const gravel = new THREE.MeshStandardMaterial({ color: asphalt ? (stage === 'hot' ? 0x161618 : 0x2a2a2d) : stage === 'bed' ? (real ? 0xffffff : 0x7a4b2a) : real ? 0xffffff : 0xa8a29e, roughness: asphalt ? (stage === 'hot' ? 0.55 : 0.92) : 1 });
      if (real && !asphalt) finishMaterial(gravel, stage === 'bed' ? 'soil' : 'gravel');
      const line = asphalt && stage !== 'hot' ? new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.7 }) : null;
      const edges = [0x8a8580, 0x78716c, 0x9c9488].map((c, i) => {
        const m = new THREE.MeshStandardMaterial({ color: c, roughness: 1 });
        return real ? finishMaterial(m, 'stone', { seed: i }) : m;
      });
      const stoneGeos = [1, 2, 3].map(k => {
        const geo = new THREE.DodecahedronGeometry(0.1, 0);
        return real ? roughenGeometry(geo, 0.25, k) : geo;
      });
      const len = Math.hypot(e.toX - e.x, e.toZ - e.z);
      const ang = Math.atan2(e.toX - e.x, e.toZ - e.z);
      const lift = stage === 'bed' ? 0.01 : asphalt ? 0.05 : 0.03;
      // The surface is one continuous ribbon that follows the ground (both edges sampled), broken only
      // where the road stops short of a building; the centre line is a dashed ribbon just above it
      const surface = roadRibbon(e, 1.5, d => lift + (stage === 'loose' ? 0.03 + Math.sin(d * 5) * 0.025 : 0), 0.3);
      if (surface) {
        const m = new THREE.Mesh(surface, gravel);
        m.receiveShadow = true;
        g.add(m);
      }
      if (line) {
        const dashes = roadRibbon(e, 0.07, () => lift + 0.012, 0.3, d => Math.floor(d / 0.6) % 2 === 0);
        if (dashes) g.add(new THREE.Mesh(dashes, line));
      }
      // Edge stones (once the road is finished), all of each shape in one draw call (js/perf.js)
      const stones = [[], [], []];
      let n = 0;
      if (!stage) for (let d = 0; d < len; d += 0.6) {
        const x = e.x + Math.sin(ang) * d, z = e.z + Math.cos(ang) * d;
        if (offLimits(x, z, -0.6)) continue;
        [-0.8, 0.8].forEach(side => {
          [-0.2, 0.05, 0.25].forEach(along => {
            n++;
            if ((n * 7) % 5 === 0) return;
            const stone = new THREE.Object3D();
            const s = 0.8 + ((n * 37) % 10) / 20;
            stone.scale.set(s * 1.2, s * 0.75, s);
            const sx = x + Math.cos(ang) * side + Math.sin(ang) * along, sz = z - Math.sin(ang) * side + Math.cos(ang) * along;
            stone.position.set(sx, getIslandGroundHeight(sx, sz) + 0.05, sz);
            stone.rotation.y = ang + n;
            stones[n % 3].push(stone);
          });
        });
      }
      stones.forEach((list, k) => {
        if (list.length) g.add(perfInstances(stoneGeos[k], edges[(k * 5) % 3], list, { castShadow: true }));
      });
      return g;
    }

// A strip `width` wide along a road, its vertices on the ground (plus lift(d)) every `step`, shared
// between neighbouring pieces so the surface is continuous. keep(d) can leave gaps (dashes); the strip
// also breaks where the road stops short of a building. Returns a BufferGeometry, or null.
function roadRibbon(e, width, lift, step = 0.3, keep = null) {
      const len = Math.hypot(e.toX - e.x, e.toZ - e.z);
      if (len < 0.05) return null;
      const dx = (e.toX - e.x) / len, dz = (e.toZ - e.z) / len;
      const px = dz, pz = -dx; // across the road
      const pos = [], uv = [], idx = [];
      let prev = -1;
      for (let d = 0; d <= len + 1e-6; d += step) {
        const dd = Math.min(d, len);
        const cx = e.x + dx * dd, cz = e.z + dz * dd;
        const on = !offLimits(cx, cz, -0.6) && (!keep || keep(dd));
        if (!on) { prev = -1; continue; }
        const base = pos.length / 3;
        [-1, 1].forEach(sd => {
          const x = cx + px * sd * width / 2, z = cz + pz * sd * width / 2;
          pos.push(x, getIslandGroundHeight(x, z) + lift(dd), z);
          uv.push(sd < 0 ? 0 : 1, dd / 1.5);
        });
        if (prev >= 0) idx.push(prev, prev + 1, base, prev + 1, base + 1, base);
        prev = base;
      }
      if (!idx.length) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      // Make sure it faces up
      if (geo.attributes.normal.getY(0) < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } geo.setIndex(idx); geo.computeVertexNormals(); }
      return geo;
    }

function hillMesh() {
      return null; // a hill is the ground itself (landscapeRaiseAt)
    }

function renderEdit(e) {
      if (!landscapeGroup || editMeshes[e.id]) return;
      const m = e.type === 'chop' ? stumpMesh(e) : e.type === 'plant' ? plantingMesh(e) : e.type === 'road' ? roadMesh(e) : hillMesh(e);
      if (!m) return;
      if (e.type === 'plant') (typeof plantcareLook === 'function' ? plantcareLook(e, m) : m.scale.setScalar(growthOf(e)));
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
function removeValleyTree(treeId, x, z) {
      // (by where it stood when he chopped it, if that is known: the seeded trees' order can change when
      // the map's layout does, so an id alone may name a different tree in an older save)
      const at = Number.isFinite(x) && Number.isFinite(z) ? valleyTrees.find(t => !t.removed && Math.hypot(t.x - x, t.z - z) < 0.4) : null;
      const tree = at || (Number.isFinite(x) ? null : valleyTrees.find(t => t.id === treeId));
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
      // A tree with his treehouse in it is never chopped (js/projects.js)
      return valleyTrees.filter(t => !t.removed && !t.hosting).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0] || null;
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
        await keloTween(1020, k => { tree.group.rotation.z = -k * (Math.PI / 2) * k; });
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
      if (typeof groundworkReady === 'function' && !groundworkReady('planting', 'Planting')) return 'getting-ready';
      x = Math.round(clampNumber(x, WORLD_MIN_X + 2, WORLD_MAX_X - 2, state.botPos.x) * 10) / 10;
      z = Math.round(clampNumber(z, WORLD_VALLEY_MIN_Z + 2, 9, state.botPos.z) * 10) / 10;
      if (!startJob(x, z)) return false;
      try {
        state.currentLocKey = 'custom';
        state.customPlaceName = 'a patch of open ground';
        state.targetPos = { x: x - 0.9, z };
        state.moodEmoji = '🌱';
        state.moodTitle = `Planting ${seeds.replace(/^(an?|the|some)\s+/i, '')}`.slice(0, 80);
        renderAllUI();
        await waitForArrival(60000);
        // Dig the hole with the trowel or shovel, set the seed in, then water it in
        if (typeof holdJobTool === 'function') holdJobTool(/trowel|shovel|spade/i, 'digging'); else state.microPose = 'digging';
        state.speechBubble = 'A hole about twice as wide as the roots...';
        renderAllUI();
        await new Promise(r => setTimeout(r, 2500));
        if (typeof holdJobTool === 'function' && hasItem(/watering can|garden hose|\bhose\b/i)) {
          holdJobTool(/watering can|garden hose|\bhose\b/i, 'normal');
          state.speechBubble = 'And a good long drink to settle it in.';
          renderAllUI();
          if (typeof waterInPlanting === 'function') await waterInPlanting(x, z); else await new Promise(r => setTimeout(r, 2200));
        }
        const kind = /flower|bulb|wildflower|sunflower|tulip|daisy/i.test(seeds) ? 'flowers' : 'tree';
        const e = { id: newEditId('plant'), type: 'plant', kind, seed: seeds, x, z, at: Date.now(), why: String(why).slice(0, 160) };
        state.worldEdits.push(e);
        renderEdit(e);
        if (typeof useUpItem === 'function') useUpItem(seeds, 1, { why: 'planting' }); else if (typeof forgetItem === 'function') forgetItem(seeds);
        if (typeof seasonApplied !== 'undefined') seasonApplied = null; // let the new leaves match the season
        sayAndLog(`Planted ${kind === 'tree' ? 'a tree' : 'flowers'}`, '🌱', kind === 'tree' ? "A seedling! In a few days it'll be a young tree." : 'Flowers, right here. They should be up in no time.',
          `I planted the ${seeds.replace(/^(an?|the|some)\s+/i, '')} in the valley, then watered it in. ${why ? why + ' ' : ''}I'll watch it grow over the next few days.`, originLabel);
        return true;
      } finally {
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.microPose = 'normal';
        state.isPracticing = false;
      }
    }

async function buildRoad(fromX, fromZ, toX, toZ, why = '', originLabel = 'Shaping the Valley') {
      if (typeof groundworkReady === 'function' && !groundworkReady('road', 'Building a road')) return 'getting-ready';
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
      // The whole line must stay out of town, buildings and the lake: it stops short of the first spot that isn't
      const segLen = Math.min(len, 18);
      let clear = segLen, blockedBy = null;
      for (let d = 0.5; d <= segLen; d += 0.5) {
        const b = offLimits(fromX + (toX - fromX) * d / segLen, fromZ + (toZ - fromZ) * d / segLen);
        if (b) { clear = d - 0.5; blockedBy = b; break; }
      }
      if (blockedBy && clear >= 2) { toX = fromX + (toX - fromX) * clear / segLen; toZ = fromZ + (toZ - fromZ) * clear / segLen; }
      else if (blockedBy && !offLimits(fromX, fromZ)) {
        state.speechBubble = blockedBy === 'town' ? "That road would run into town. Town isn't mine to build in, so I'll lay it somewhere else."
          : `That road would run into ${blockedBy}. I'll lay it somewhere else.`;
        renderAllUI();
        return false;
      }
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
        const e = { id: newEditId('road'), type: 'road', surface: 'gravel', x: Math.round(fromX * 10) / 10, z: Math.round(fromZ * 10) / 10, toX: Math.round(toX * 10) / 10, toZ: Math.round(toZ * 10) / 10, at: Date.now(), why: String(why).slice(0, 160) };
        // The real steps, each with its own tool, the road growing behind him as he works along it
        const stages = [
          { stage: 'bed', tool: /shovel|spade/i, pose: 'digging', say: 'First dig out the roadbed and level it.' },
          { stage: 'loose', tool: /wheelbarrow/i, pose: 'normal', say: 'Now wheel the gravel in, load by load.' },
          { stage: 'raked', tool: /\brake\b|lute/i, pose: 'digging', say: 'Rake it out nice and even.' },
          { stage: null, tool: /plate compactor|compactor|tamper|road roller/i, pose: 'normal', say: 'And pack it down hard so it never ruts.' }
        ];
        const steps = 4;
        for (const st of stages) {
          if (typeof holdJobTool === 'function') holdJobTool(st.tool, st.pose); else state.microPose = 'digging';
          state.moodTitle = `Building a road: ${st.say.replace(/^(First|Now|And) /, '').replace(/\.$/, '')}`.slice(0, 80);
          state.speechBubble = st.say;
          renderAllUI();
          state.targetPos = { x: e.x, z: e.z };
          await waitForArrival(30000);
          for (let i = 1; i <= steps; i++) {
            const part = { ...e, id: e.id + '-wip', stage: st.stage, toX: e.x + (e.toX - e.x) * i / steps, toZ: e.z + (e.toZ - e.z) * i / steps };
            const done = { ...e, id: e.id + '-wip0', stage: stages[stages.indexOf(st) - 1] ? stages[stages.indexOf(st) - 1].stage : 'none' };
            removeEditMesh(part.id);
            renderEdit(part);
            if (i === 1) { removeEditMesh(done.id); if (done.stage !== 'none') renderEdit(done); }
            state.targetPos = { x: part.toX, z: part.toZ };
            await waitForArrival(30000);
            await new Promise(r => setTimeout(r, 700));
          }
          removeEditMesh(e.id + '-wip0');
          removeEditMesh(e.id + '-wip');
          if (st.stage) renderEdit({ ...e, id: e.id + '-wip0', stage: st.stage });
        }
        removeEditMesh(e.id + '-wip0');
        removeEditMesh(e.id + '-wip');
        state.worldEdits.push(e);
        renderEdit(e);
        if (typeof useUpItem === 'function') useUpItem(gravel, 1, { why: 'on a road' }); else if (typeof forgetItem === 'function') forgetItem(gravel);
        sayAndLog('Built a gravel road', '🛤️', 'A real road! Now nobody has to walk through the mud here.',
          `I built a gravel road about ${Math.round(Math.hypot(e.toX - e.x, e.toZ - e.z))} steps long, the proper way: dug out the bed, wheeled in the gravel, raked it even and packed it down. ${why ? why + ' ' : ''}It felt good to make something everyone can use.`, originLabel);
        return true;
      } finally {
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.isPracticing = false;
      }
    }

async function raiseHill(x, z, why = '', originLabel = 'Shaping the Valley', lower = false) {
      if (typeof groundworkReady === 'function' && !groundworkReady('earthwork', 'Shaping the land')) return 'getting-ready';
      const shovel = hasItem(/shovel|spade/i);
      if (!shovel) {
        addItemRequest('A sturdy shovel', 'tool', `I want to shape the land into a little ${lower ? 'hollow' : 'hill'}.`, 'Shaping the valley');
        return 'needs-shovel';
      }
      if (typeof readyToOperate === 'function' && !readyToOperate(shovel)) return 'learning';
      x = Math.round(clampNumber(x, WORLD_MIN_X + 3, WORLD_MAX_X - 3, state.botPos.x) * 10) / 10;
      z = Math.round(clampNumber(z, WORLD_VALLEY_MIN_Z + 3, 8.5, state.botPos.z) * 10) / 10;
      const full = lower ? -HILL_HEIGHT * 0.7 : HILL_HEIGHT;
      if (offLimits(x, z, HILL_RADIUS) || !startJob(x, z)) {
        if (offLimits(x, z, HILL_RADIUS)) { state.speechBubble = `${lower ? 'A hollow' : 'A hill'} there would spill onto ${offLimits(x, z, HILL_RADIUS)}. I'll leave it.`; renderAllUI(); }
        return false;
      }
      try {
        if (typeof fetchFromStorehouse === 'function') await fetchFromStorehouse(shovel);
        state.currentLocKey = 'custom';
        state.customPlaceName = 'a spot he is reshaping';
        state.targetPos = { x: x - HILL_RADIUS - 0.4, z };
        state.moodEmoji = lower ? '🕳️' : '⛰️';
        state.moodTitle = lower ? 'Digging out a little hollow' : 'Shaping a little hill';
        renderAllUI();
        await waitForArrival(60000);
        state.microPose = 'digging';
        const e = { id: newEditId('hill'), type: 'hill', x, z, r: HILL_RADIUS, h: 0, at: Date.now(), why: String(why).slice(0, 160) };
        state.worldEdits.push(e);
        for (let i = 1; i <= 5; i++) {
          // Dig a load, then wheel it to (or away from) the spot
          if (typeof holdJobTool === 'function') holdJobTool(i % 2 ? /shovel|spade/i : /wheelbarrow/i, i % 2 ? 'digging' : 'normal');
          if (i % 2 === 0) { state.targetPos = { x: x - HILL_RADIUS - 0.4 + (Math.random() - 0.5) * 2, z: z + (Math.random() - 0.5) * 2 }; }
          await new Promise(r => setTimeout(r, 1200));
          e.h = Math.round(full * i / 5 * 100) / 100;
          hillTerrainRefresh(e);
        }
        if (lower) sayAndLog('Dug out a little hollow', '🕳️', 'A soft hollow in the ground. It feels sheltered down here.',
          `I dug the ground out into a gentle hollow. ${why ? why + ' ' : ''}If I change my mind I can always fill it back in.`, originLabel);
        else sayAndLog('Raised a little hill', '⛰️', 'A hill of my own. I can see a bit further from the top.',
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
      const e = state.worldEdits.find(w => w.id === id) || (id === 'last' ? [...state.worldEdits].reverse().find(w => w.type !== 'chop' && !w.pro) : null);
      // A proper road (js/roadworks.js) is a job on his agenda: he finishes it or drops it on purpose, never undoes it on a whim
      if (!e || e.type === 'chop' || e.pro) return false;
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
          const full = e.h;
          for (let i = 4; i >= 0; i--) {
            await new Promise(r => setTimeout(r, 900));
            e.h = Math.round(full * i / 5 * 100) / 100;
            hillTerrainRefresh(e);
          }
        } else {
          await new Promise(r => setTimeout(r, 2500));
        }
        state.worldEdits = state.worldEdits.filter(w => w !== e);
        removeEditMesh(e.id);
        if (e.type === 'hill') hillTerrainRefresh(e);
        const what = e.type === 'plant' ? (e.kind === 'tree' ? 'the tree I planted' : 'the flowers I planted') : e.type === 'road' ? 'my road' : e.h < 0 ? 'my hollow' : 'my hill';
        sayAndLog(`Took away ${what}`, '↩️', `There. ${what[0].toUpperCase() + what.slice(1)} is gone, and the ground is the way it was.`,
          `I changed my mind and took away ${what}. ${why ? why + ' ' : ''}It's good to know nothing I make has to be forever.`, originLabel);
        return true;
      } finally {
        state.microPose = 'normal';
        state.isPracticing = false;
      }
    }

// Somewhere open anywhere in his world except town and the buildings' grounds: meadows, woods,
// the mountain, the beach, and land he has made. Too-steep slopes are skipped.
function openGroundSpot(pad = 1.5, near = null) {
      for (let i = 0; i < 60; i++) {
        const x = near && i < 30 ? near.x + randRange(-18, 18) : randRange(WORLD_MIN_X + 4, WORLD_MAX_X - 4);
        const z = near && i < 30 ? near.z + randRange(-18, 18) : randRange(WORLD_VALLEY_MIN_Z + 4, 8.8);
        if (x < WORLD_MIN_X + 3 || x > WORLD_MAX_X - 3 || z < WORLD_VALLEY_MIN_Z + 3 || z > 8.8) continue;
        if (offLimits(x, z, pad) || pointBlocked(x, z, { x: 999, z: 999 })) continue;
        if (typeof getAnalyticalGroundHeight === 'function') {
          const slope = Math.abs(getAnalyticalGroundHeight(x + 1, z) - getAnalyticalGroundHeight(x - 1, z)) + Math.abs(getAnalyticalGroundHeight(x, z + 1) - getAnalyticalGroundHeight(x, z - 1));
          if (slope > 1.6) continue;
        }
        return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 };
      }
      return { x: TOWN.minX - 6, z: 2 };
    }

// --- How he decides to shape things on his own -----------------------------------------------------
function landscapeChance() {
      if (hasItem(/^(?!.*bird ?seed).*(seed|sapling|bulb)/i)) return 0.12;
      if (hasItem(/gravel|crushed stone|paving/i) && hasItem(/shovel|spade/i)) return 0.08;
      if (hasItem(/^(?!.*pick ?ax).*(\baxe\b|hatchet)/i)) return 0.06;
      if (hasItem(/shovel|spade/i)) return 0.06;
      return 0.025;
    }

function shapeTheValleyOnMyOwn() {
      // Anywhere but town: half the time somewhere near where he already is
      const open = () => openGroundSpot(1.5, Math.random() < 0.5 ? state.botPos : null);
      if (hasItem(/^(?!.*bird ?seed).*(seed|sapling|bulb)/i)) { const p = open(); return plantSeeds(p.x, p.z, 'I wanted something living that I put there myself.', 'Felt Like Planting'); }
      // A gravel road he's had a while: he may want it paved, which means learning how and asking for asphalt
      const gravelRoad = state.worldEdits.find(e => e.type === 'road' && !e.pro && e.surface !== 'asphalt');
      if (gravelRoad && typeof paveRoad === 'function' && Math.random() < 0.3) return paveRoad(gravelRoad.id, 'The gravel keeps washing out, and asphalt would last for years.', 'Felt Like Paving');
      if (Math.random() < 0.35 || (hasItem(/gravel|crushed stone|paving/i) && hasItem(/shovel|spade/i))) {
        // The first road runs out west from the edge of town toward the Museum; later ones join places he likes
        if (!state.worldEdits.some(e => e.type === 'road')) return buildRoad(TOWN.minX - 1, -2, MUSEUM_DOOR.x + 6, MUSEUM_DOOR.z + 1, 'My feet keep wearing a muddy track out here.', 'Felt Like Building');
        const a = openGroundSpot(1.0), b = openGroundSpot(1.0, a);
        return buildRoad(a.x, a.z, b.x, b.z, 'I keep walking this way, so I gave it a proper path.', 'Felt Like Building');
      }
      if (hasItem(/^(?!.*pick ?ax).*(\baxe\b|hatchet)/i) && Math.random() < 0.5) { const p = open(); return chopTree(p.x, p.z, 'I wanted to open up a clearing.', 'Felt Like Chopping'); }
      if (Math.random() < 0.3 && state.worldEdits.some(e => e.type !== 'chop')) return undoEdit('last', 'It looked better before.');
      if (hasItem(/shovel|spade/i)) {
        const p = open();
        return Math.random() < 0.35 ? raiseHill(p.x, p.z, 'I wanted a sheltered spot to sit.', 'Felt Like Shaping', true)
          : raiseHill(p.x, p.z, 'I wanted a little lookout.', 'Felt Like Shaping');
      }
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
        pave: () => (typeof paveRoad === 'function' ? paveRoad(String(shape.id || 'any'), why, 'Decided to Pave a Road') : false),
        hill: () => raiseHill(x, z, why, 'Decided to Shape the Land'),
        hollow: () => raiseHill(x, z, why, 'Decided to Shape the Land', true),
        undo: () => undoEdit(String(shape.id || 'last'), why, 'Changed His Mind')
      }[String(shape.action || '').toLowerCase()];
      if (run) doWhenFree(run, { key: `land:${String(shape.action).toLowerCase()}:${shape.id || ''}:${x},${z}` });
    }

function landscapeSummaryForAI() {
      const edits = state.worldEdits.slice(-8).map(e => e.type === 'road' ? `${e.id}: ${e.surface === 'asphalt' ? 'asphalt' : 'gravel'} road (${e.x}, ${e.z}) to (${e.toX}, ${e.toZ})`
        : e.type === 'plant' ? `${e.id}: ${e.kind} planted at (${e.x}, ${e.z})` : e.type === 'hill' ? `${e.id}: ${e.h < 0 ? 'hollow' : 'hill'} at (${e.x}, ${e.z})` : `${e.id}: stump at (${e.x}, ${e.z})`);
      return edits.length ? edits.join('; ') : 'nothing yet';
    }

// --- Brain tab list ----------------------------------------------------------------------------------
function renderLandscapeList() {
      const el = document.getElementById('landscapeListContainer');
      if (!el) return;
      const label = { chop: '🪓 Chopped a tree', plant: '🌱 Planted', road: '🛤️ Built a road', hill: '⛰️ Raised a hill' };
      el.innerHTML = state.worldEdits.slice().reverse().slice(0, 12).map(e => `
        <div class="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-2xs text-slate-200">
          ${escapeHtml(e.type === 'hill' && e.h < 0 ? '🕳️ Dug a hollow' : (label[e.type] || e.type))}${e.type === 'plant' ? ` ${escapeHtml(e.kind === 'tree' ? 'a tree' : 'flowers')} <span class="text-slate-500">(${typeof plantStageOf === 'function' ? escapeHtml(plantStageOf(e)) + ', ' : ''}${Math.round(growthOf(e) * 100)}% grown)</span>` : ''}
          ${e.why ? `<div class="text-slate-400 italic">${escapeHtml(e.why)}</div>` : ''}
        </div>`).join('');
    }

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    landscapeGroup = new THREE.Group();
    scene.add(landscapeGroup);
    state.worldEdits.forEach(e => {
      if (e.type === 'chop') removeValleyTree(e.treeId, e.x, e.z);
      renderEdit(e);
    });
    if (state.worldEdits.some(e => e.type === 'hill')) state.worldEdits.filter(e => e.type === 'hill').forEach(hillTerrainRefresh);
    renderLandscapeList();
    // Plantings grow as his days pass
    setInterval(() => {
      state.worldEdits.forEach(e => { if (e.type === 'plant' && editMeshes[e.id]) (typeof plantcareLook === 'function' ? plantcareLook(e, editMeshes[e.id]) : editMeshes[e.id].scale.setScalar(growthOf(e))); });
      renderLandscapeList();
      if (typeof renderSkillsList === 'function') renderSkillsList();
    }, 5000);
  }, 300);
});
