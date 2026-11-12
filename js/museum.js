// Kelo-bot-1 — js/museum.js
// Loaded after storehouse.js. Kelo-1's Museum of Art & Ideas, west of town: a columned gallery
// where his welded sculptures stand on plinths and his paintings hang in frames. Art he makes
// for a spot in town comes here instead (the town itself is not his to build in).

const MUSEUM = { x: MAP_LAYOUT.museum.x, z: MAP_LAYOUT.museum.z, w: 12, d: 8, wallH: 3.8 };
const MUSEUM_DOOR = { x: MUSEUM.x, z: MUSEUM.z + MUSEUM.d / 2 + 1.6 };
const MUSEUM_HATCH_LOCAL = { x: 0, z: -2.6 }; // the elevator down to the lower galleries, between the back plinths
const MUSEUM_PLINTHS = [];   // filled by buildMuseum3D: where sculptures stand
const MUSEUM_FRAMES = [];    // where paintings hang
let museumGroup = null;
let museumArtGroup = null;
let museumRenderKey = null;

function buildMuseum3D() {
      const { x: cx, z: cz, w, d, wallH } = MUSEUM;
      const gy = getAnalyticalGroundHeight(cx, cz);
      museumGroup = new THREE.Group();
      museumGroup.position.set(cx, gy, cz);
      const marble = new THREE.MeshStandardMaterial({ color: 0xf5f1e8, roughness: 0.55 });
      const stone = new THREE.MeshStandardMaterial({ color: 0xd6d0c4, roughness: 0.8 });
      const floorMat = new THREE.MeshStandardMaterial({ color: 0xcbbfa8, roughness: 0.4 });
      // Real veined marble and cut stone (js/materials.js)
      if (typeof finishMaterial === 'function') { finishMaterial(marble, 'marble'); finishMaterial(stone, 'stone', { repeat: 3 }); finishMaterial(floorMat, 'marble', { repeat: 4 }); }
      // Plinth base and floor, raised on steps
      // (both with the round stairwell cut through them)
      const base = new THREE.Mesh(floorWithStairwell(w + 1, d + 1, 0.5, MUSEUM_HATCH_LOCAL), stone);
      base.receiveShadow = true;
      const floor = new THREE.Mesh(floorWithStairwell(w, d, 0.06, MUSEUM_HATCH_LOCAL), floorMat);
      floor.position.y = 0.5;
      floor.receiveShadow = true;
      for (let i = 0; i < 3; i++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(5 - i * 0.4, 0.17, 0.5), stone);
        step.position.set(0, 0.085 + i * 0.17, d / 2 + 1.25 - i * 0.5);
        museumGroup.add(step);
      }
      // Walls: back and sides solid, the front open behind a row of columns
      const back = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, 0.2), marble);
      back.position.set(0, 0.5 + wallH / 2, -d / 2);
      const left = new THREE.Mesh(new THREE.BoxGeometry(0.2, wallH, d), marble);
      left.position.set(-w / 2, 0.5 + wallH / 2, 0);
      const right = left.clone();
      right.position.x = w / 2;
      [back, left, right].forEach(m => { m.castShadow = true; m.receiveShadow = true; });
      museumGroup.add(base, floor, back, left, right);
      for (let i = 0; i < 6; i++) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, wallH, 16), marble);
        col.position.set(-w / 2 + 0.6 + i * ((w - 1.2) / 5), 0.5 + wallH / 2, d / 2 + 0.4);
        col.castShadow = true;
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.6), stone);
        cap.position.set(col.position.x, 0.5 + wallH + 0.08, col.position.z);
        museumGroup.add(col, cap);
      }
      // Entablature, a triangular pediment and a see-through roof (cutaway like the Storehouse)
      const beam = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, 0.9), stone);
      beam.position.set(0, 0.5 + wallH + 0.41, d / 2 + 0.4);
      const pedShape = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.3, 0), new THREE.Vector2(w / 2 + 0.3, 0), new THREE.Vector2(0, 1.5)]);
      const pediment = new THREE.Mesh(new THREE.ExtrudeGeometry(pedShape, { depth: 0.5, bevelEnabled: false }), marble);
      pediment.position.set(0, 0.5 + wallH + 0.66, d / 2 + 0.15);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x9a9184, roughness: 0.7, transparent: true, opacity: state.roofCutaway ? 0.18 : 0.95, side: THREE.DoubleSide });
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.25, d + 1.4), roofMat);
      roof.position.set(0, 0.5 + wallH + 0.3, 0.3);
      if (typeof cutawayRoofMeshes !== 'undefined') cutawayRoofMeshes.push(roof);
      const sign = makeSignMesh('KELO-1 MUSEUM OF ART & IDEAS', { bg: '#f5f1e8', fg: '#7c2d12', width: 4.6, height: 0.36 });
      sign.position.set(0, 0.5 + wallH + 0.41, d / 2 + 0.86);
      museumGroup.add(beam, pediment, roof, sign);
      // Plinths for sculptures: two rows of four
      MUSEUM_PLINTHS.length = 0;
      [-1.2, 1.4].forEach(pz => {
        for (let i = 0; i < 4; i++) {
          const px = -w / 2 + 1.8 + i * ((w - 3.6) / 3);
          const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.9), marble);
          plinth.position.set(px, 0.96, pz);
          plinth.castShadow = true;
          museumGroup.add(plinth);
          MUSEUM_PLINTHS.push({ x: px, y: 1.36, z: pz });
        }
      });
      // Frames for paintings: four on the back wall, two on each side wall
      MUSEUM_FRAMES.length = 0;
      for (let i = 0; i < 4; i++) MUSEUM_FRAMES.push({ x: -w / 2 + 1.6 + i * ((w - 3.2) / 3), y: 2.6, z: -d / 2 + 0.12, rotY: 0 });
      [-1, 1].forEach(s => [-1.6, 1.4].forEach(fz => MUSEUM_FRAMES.push({ x: s * (w / 2 - 0.12), y: 2.6, z: fz, rotY: -s * Math.PI / 2 })));
      const hatch = typeof buildBasementHatch === 'function' ? buildBasementHatch(MUSEUM_HATCH_LOCAL, 0.56, Math.PI / 2) : null;
      if (hatch) museumGroup.add(hatch);
      // Details (js/materials.js kit): column bases, a dentil course under the cornice, bronze lamps
      // on the side walls, stone urns either side of the steps, and a moulded base course
      if (typeof bldKit === 'function') {
        const K = bldKit();
        for (let i = 0; i < 6; i++) {
          const x = -w / 2 + 0.6 + i * ((w - 1.2) / 5);
          bldBox(museumGroup, 0.62, 0.14, 0.62, stone, x, 0.57, d / 2 + 0.4);
          bldBox(museumGroup, 0.52, 0.08, 0.52, marble, x, 0.68, d / 2 + 0.4);
        }
        for (let x = -w / 2 - 0.2; x <= w / 2 + 0.2; x += 0.32) bldBox(museumGroup, 0.14, 0.12, 0.1, marble, x, 0.5 + wallH + 0.12, d / 2 + 0.88);
        bldBox(museumGroup, w + 1.1, 0.12, d + 1.1, stone, 0, 0.44, 0);
        [-1, 1].forEach(sx => {
          const urnX = sx * 2.1, urnZ = d / 2 + 0.75;
          bldBox(museumGroup, 0.5, 0.3, 0.5, stone, urnX, 0.65, urnZ);
          const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.16, 0.4, 14), stone);
          urn.position.set(urnX, 1.0, urnZ);
          urn.castShadow = true;
          museumGroup.add(urn);
          const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 1), K.leaf);
          shrub.position.set(urnX, 1.32, urnZ);
          shrub.castShadow = true;
          museumGroup.add(shrub);
        });
        ['left', 'right'].forEach(side => { const f = bldFace(museumGroup, side, w, d); bldLamp(f, d / 2 - 0.6, 0.5 + 2.6); });
      }
      museumArtGroup = new THREE.Group();
      museumGroup.add(museumArtGroup);
      scene.add(museumGroup);
      if (typeof bldFinish === 'function') bldFinish(museumGroup, () => [museumArtGroup, roof, hatch, sign].filter(Boolean));
      // The stone base and walls, and the front steps (he climbs them only on a trip inside, js/basements.js)
      addObstacle(obstacleBox(cx, cz, (w + 1) / 2, (d + 1) / 2, { placeR: Math.max(w, d) / 2 + 0.6, building: 'museum', door: { x: cx, z: cz + 7.3 } }),
        obstacleBox(cx, cz + d / 2 + 1.0, 2.55, 0.55, { placeR: -Infinity, building: 'museum', door: { x: cx, z: cz + 7.3 } }));
      renderMuseum3D();
      if (typeof perfWatchBuilding === 'function') {
        perfWatchBuilding({
          key: 'museum', radius: 7,
          center: () => museumGroup.position.clone().setY(museumGroup.position.y + 2),
          forced: museumInUse, show: showMuseumModels, tick: museumModelsTick
        });
      } else showMuseumModels(true);
    }

// Fit a model inside a box of the given size and sit it on y = 0
function fitInside(model, maxSize) {
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      model.scale.multiplyScalar(maxSize / (Math.max(size.x, size.y, size.z) || 1));
      const fitted = new THREE.Box3().setFromObject(model);
      model.position.y -= fitted.min.y;
      return model;
    }

// Oldest first: the ground floor keeps the first pieces, newer ones go down to the lower galleries
function allMuseumSculptures() {
      return state.inventedCreations.filter(c => c.inMuseum).slice().reverse();
    }

function allMuseumPaintings() {
      return state.murals.slice().reverse();
    }

function museumSculptures() {
      return allMuseumSculptures().slice(0, MUSEUM_PLINTHS.length || 8);
    }

function museumPaintings() {
      return allMuseumPaintings().slice(0, MUSEUM_FRAMES.length || 8);
    }

// How many lower galleries there are (each holds a floor's worth of plinths and frames)
function museumBasementLevels() {
      const perFloor = MUSEUM_PLINTHS.length || 8;
      return Math.max(0, Math.ceil(allMuseumSculptures().length / perFloor) - 1, Math.ceil(allMuseumPaintings().length / (MUSEUM_FRAMES.length || 8)) - 1);
    }

// Like the Storehouse shelves, the art is only built while the camera can see it (js/perf.js):
// from far away each plinth holds a plain block and each frame a flat patch of the painting's colour.
let museumModelsWanted = false;

function renderMuseum3D() {
      if (!museumArtGroup) return;
      const sculptures = museumSculptures(), paintings = museumPaintings();
      const levels = museumBasementLevels();
      const key = (museumModelsWanted ? 'art:' : 'blocks:') + sculptures.map(c => `${c.title}${c.createdTime}`).join('|') + '#' + paintings.map(m => m.seed).join('|') + '#' + levels;
      if (key === museumRenderKey) return;
      museumRenderKey = key;
      while (museumArtGroup.children.length) {
        const old = museumArtGroup.children.pop();
        if (old.userData.perfStandIn) { disposePerfStandIns(old); continue; }
        old.traverse(o => { if (o.geometry && !(o.userData && o.userData.sharedGeometry)) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); });
      }
      if (levels > 0) {
        const sign = makeSignMesh(levels === 1 ? 'GALLERY B1 BELOW' : `GALLERIES B1-B${levels} BELOW`, { bg: '#1c1917', fg: '#fbbf24', width: 1.7, height: 0.26 });
        sign.position.set(MUSEUM_HATCH_LOCAL.x, 3.4, -MUSEUM.d / 2 + 0.12);
        museumArtGroup.add(sign);
      }
      if (!museumModelsWanted) {
        // Stand-ins: a block on each filled plinth, a flat patch in each filled frame (one draw call each)
        const spots = sculptures.map((c, i) => ({ x: MUSEUM_PLINTHS[i].x, y: MUSEUM_PLINTHS[i].y, z: MUSEUM_PLINTHS[i].z, w: 0.5, h: 0.9, d: 0.5, color: new THREE.Color(c.colorHex || '#38bdf8').getHex() }));
        paintings.forEach((m, i) => {
          const f = MUSEUM_FRAMES[i];
          const flat = Math.abs(Math.sin(f.rotY)) > 0.5;
          spots.push({ x: f.x, y: f.y - 0.6, z: f.z, w: flat ? 0.06 : 1.75, h: 1.2, d: flat ? 1.75 : 0.06, color: new THREE.Color((m.palette && m.palette[0]) || '#b8860b').getHex() });
        });
        if (spots.length) museumArtGroup.add(perfStandIns(spots));
        return;
      }
      sculptures.forEach((c, i) => {
        if (typeof buildCreationGroup !== 'function') return;
        const slot = MUSEUM_PLINTHS[i];
        const holder = new THREE.Group();
        holder.add(fitInside(buildCreationGroup(c), 1.25));
        holder.position.set(slot.x, slot.y, slot.z);
        holder.userData.itemName = c.title;
        museumArtGroup.add(holder);
        const plaque = makeSignMesh(String(c.title || 'Untitled').slice(0, 24).toUpperCase(), { bg: '#1c1917', fg: '#fef3c7', width: 0.85, height: 0.16 });
        plaque.position.set(slot.x, 0.85, slot.z + 0.47);
        museumArtGroup.add(plaque);
      });
      paintings.forEach((m, i) => {
        if (typeof paintMuralCanvas !== 'function') return;
        const slot = MUSEUM_FRAMES[i];
        const frame = buildMuseumFrame(m);
        frame.position.set(slot.x, slot.y, slot.z);
        frame.rotation.y = slot.rotY;
        museumArtGroup.add(frame);
      });
      museumArtShadows = true;
      museumModelsTick(true);
    }

function museumInUse() {
      return typeof indoorTrip !== 'undefined' && indoorTrip.active && indoorTrip.site && indoorTrip.site.key === 'museum';
    }

function showMuseumModels(near) {
      museumModelsWanted = near;
      renderMuseum3D();
    }

// Sculptures cast shadows only while the camera is close enough to notice them
let museumArtShadows = true;
function museumModelsTick(near) {
      if (!museumGroup || !near) return;
      const close = camera.position.distanceTo(museumGroup.position) < 20;
      if (close === museumArtShadows) return;
      museumArtShadows = close;
      museumArtGroup.traverse(o => { if (o.isMesh && !o.userData.perfStandIn) o.castShadow = close; });
    }

// A painting in its gilded frame (the frame's back is at z = 0)
function buildMuseumFrame(m) {
      // A real painting (oil, watercolour...) hangs in a frame that suits its medium (js/paintstudio.js)
      if (m && m.kind === 'art' && typeof buildArtFrame === 'function') return buildArtFrame(m);
      const frame = new THREE.Group();
      const border = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.2, 0.06), new THREE.MeshStandardMaterial({ color: 0xb8860b, metalness: 0.6, roughness: 0.35 }));
      const canvas = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.0), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(paintMuralCanvas(m)), roughness: 0.9 }));
      canvas.position.z = 0.035;
      frame.add(border, canvas);
      frame.userData.muralSeed = m.seed;
      return frame;
    }

function museumSummaryForAI() {
      const levels = museumBasementLevels();
      return `${allMuseumSculptures().length} sculptures and ${allMuseumPaintings().length} paintings${levels ? `, over ${levels + 1} floors` : ''}`;
    }
