// Kelo-bot-1 — js/museum.js
// Loaded after storehouse.js. Kelo-1's Museum of Art & Ideas, west of town: a columned gallery
// where his welded sculptures stand on plinths and his paintings hang in frames. Art he makes
// for a spot in town comes here instead (the town itself is not his to build in).

const MUSEUM = { x: -40, z: -5, w: 12, d: 8, wallH: 3.8 };
const MUSEUM_DOOR = { x: MUSEUM.x, z: MUSEUM.z + MUSEUM.d / 2 + 1.6 };
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
      // Plinth base and floor, raised on steps
      const base = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.5, d + 1), stone);
      base.position.y = 0.25;
      base.receiveShadow = true;
      const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), floorMat);
      floor.position.y = 0.53;
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
      museumArtGroup = new THREE.Group();
      museumGroup.add(museumArtGroup);
      scene.add(museumGroup);
      worldObstacles.push({ x: cx, z: cz, r: Math.max(w, d) / 2 + 0.6 });
      renderMuseum3D();
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

function museumSculptures() {
      return state.inventedCreations.filter(c => c.inMuseum).slice(0, MUSEUM_PLINTHS.length);
    }

function museumPaintings() {
      return state.murals.slice(0, MUSEUM_FRAMES.length);
    }

function renderMuseum3D() {
      if (!museumArtGroup) return;
      const sculptures = museumSculptures(), paintings = museumPaintings();
      const key = sculptures.map(c => `${c.title}${c.createdTime}`).join('|') + '#' + paintings.map(m => m.seed).join('|');
      if (key === museumRenderKey) return;
      museumRenderKey = key;
      while (museumArtGroup.children.length) {
        const old = museumArtGroup.children.pop();
        old.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); });
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
        const frame = new THREE.Group();
        const border = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.2, 0.06), new THREE.MeshStandardMaterial({ color: 0xb8860b, metalness: 0.6, roughness: 0.35 }));
        const canvas = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.0), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(paintMuralCanvas(m)), roughness: 0.9 }));
        canvas.position.z = 0.035;
        frame.add(border, canvas);
        frame.position.set(slot.x, slot.y, slot.z);
        frame.rotation.y = slot.rotY;
        museumArtGroup.add(frame);
      });
    }

function museumSummaryForAI() {
      return `${museumSculptures().length} sculptures and ${museumPaintings().length} paintings on display`;
    }
