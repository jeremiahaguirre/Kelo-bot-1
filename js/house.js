// Kelo-bot-1 — js/house.js
// Loaded right after scene.js. Kelo-1's home: a cosy gabled cottage sized for a 2.8-unit robot
// (3.6 tall walls, a door taller than him). It has glass windows, a front door that swings open
// when he walks up, a porch with steps and a railing, a stone chimney, flower boxes and a stepping
// stone path. Inside are his bed and couch (at TOWN_LOCATIONS 'bed' and 'couch' in agent.js), a desk,
// lamps, a rug, a bookshelf and his charging dock. The lights come on at night (worldNow().isNight).
// The roof goes see-through with the "Roofs: Cutaway" toggle (cutawayRoofMeshes), and so does the
// front wall, so you can look in on him from the House camera.

// Centre of the house walls in world space; the house faces south (+z) toward town
const HOUSE = { x: -9.5, z: -8.7, w: 8.4, d: 6.3, wallH: 3.6, floorY: 0.02, doorW: 1.8, doorH: 3.1 };
let houseLights = null;

// A straight wall along local x, with rectangular holes cut for windows and doors.
// openings: [{ x, w, y0, y1 }] measured from the wall's centre and its foot.
function houseWallWithOpenings(len, h, t, openings, mat) {
      const wall = new THREE.Group();
      const piece = (x0, x1, y0, y1) => {
        if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return;
        const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, t), mat);
        m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
        m.castShadow = true;
        m.receiveShadow = true;
        wall.add(m);
      };
      const sorted = [...openings].sort((a, b) => a.x - b.x);
      let cursor = -len / 2;
      sorted.forEach(o => {
        piece(cursor, o.x - o.w / 2, 0, h);
        piece(o.x - o.w / 2, o.x + o.w / 2, 0, o.y0);
        piece(o.x - o.w / 2, o.x + o.w / 2, o.y1, h);
        cursor = o.x + o.w / 2;
      });
      piece(cursor, len / 2, 0, h);
      return wall;
    }

// A glazed window: frame, two panes with a cross bar, and a sill
function houseWindow(w, h, frameMat, glassMat) {
      const win = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), glassMat);
      win.add(glass);
      const bar = 0.09;
      [[0, h / 2, w + bar, bar], [0, -h / 2, w + bar, bar], [-w / 2, 0, bar, h], [w / 2, 0, bar, h], [0, 0, 0.06, h], [0, 0, w, 0.06]].forEach(([x, y, bw, bh]) => {
        const f = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.26), frameMat);
        f.position.set(x, y, 0);
        win.add(f);
      });
      const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.08, 0.42), frameMat);
      sill.position.set(0, -h / 2 - 0.06, 0.08);
      win.add(sill);
      return win;
    }

// A planter of little flowers to hang under a window
function houseFlowerBox(w, woodMat) {
      const box = new THREE.Group();
      const trough = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, 0.32), woodMat);
      trough.castShadow = true;
      const soil = new THREE.Mesh(new THREE.BoxGeometry(w - 0.08, 0.04, 0.24), new THREE.MeshStandardMaterial({ color: 0x4a2f1b }));
      soil.position.y = 0.14;
      box.add(trough, soil);
      const petals = [0xf472b6, 0xfacc15, 0xf87171, 0xc084fc, 0xfb923c];
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f9b46 });
      const n = Math.round(w / 0.22);
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + 0.14 + (i * (w - 0.28)) / Math.max(1, n - 1);
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), leafMat);
        leaf.position.set(x, 0.2, (i % 2 ? 0.05 : -0.05));
        const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), new THREE.MeshStandardMaterial({ color: petals[i % petals.length], roughness: 0.6 }));
        bloom.position.set(x, 0.32 + (i % 3) * 0.04, (i % 2 ? 0.05 : -0.05));
        box.add(leaf, bloom);
      }
      return box;
    }

function buildKeloHouse3D() {
      const { w, d, wallH, floorY, doorW, doorH } = HOUSE;
      const house = new THREE.Group();
      house.position.set(HOUSE.x, 0, HOUSE.z);
      house.name = 'Kelo-1 House';
      // Local helpers: (x, z) inside the house -> world space
      const wx = x => HOUSE.x + x, wz = z => HOUSE.z + z;
      const mesh = (geo, mat, x, y, z, parent = house) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        m.castShadow = true;
        m.receiveShadow = true;
        parent.add(m);
        return m;
      };
      const box = (bw, bh, bd, mat, x, y, z, parent) => mesh(new THREE.BoxGeometry(bw, bh, bd), mat, x, y, z, parent);

      // Palette: warm white walls, oak trim, slate-teal roof
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xf5ead6, roughness: 0.85 });
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.7 });
      const darkWood = new THREE.MeshStandardMaterial({ color: 0x5b3a22, roughness: 0.75 });
      const lightWood = new THREE.MeshStandardMaterial({ color: 0xc89462, roughness: 0.7 });
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9a948c, roughness: 0.95 });
      const glassMat = new THREE.MeshStandardMaterial({ color: 0xbfe3f2, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.38, emissive: 0xffb45c, emissiveIntensity: 0 });
      const fabricMat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.95 });

      // --- Floor: a stone plinth with a plank floor on top. The floor and porch are added to the
      // terrain group so getIslandGroundHeight() puts his feet on the boards instead of in them.
      const ground = new THREE.Group();
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.5, d + 0.2), stoneMat);
      plinth.position.set(wx(0), floorY - 0.31, wz(0));
      plinth.receiveShadow = true;
      const boards = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 0.12, d - 0.1), lightWood);
      boards.position.set(wx(0), floorY - 0.06, wz(0));
      boards.receiveShadow = true;
      ground.add(plinth, boards);
      // Plank seams so the floor reads as boards
      for (let i = -3; i <= 3; i++) {
        const seam = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.005, 0.025), darkWood);
        seam.position.set(0, floorY + 0.003, i * 0.85);
        house.add(seam);
      }

      // --- Walls (thickness 0.2) with window and door openings
      const t = 0.2;
      const sill = 1.05, head = 2.75;
      const frontOpenings = [{ x: 0, w: doorW, y0: 0, y1: doorH }, { x: -2.85, w: 1.6, y0: sill, y1: head }, { x: 2.85, w: 1.6, y0: sill, y1: head }];
      const backOpenings = [{ x: -2.1, w: 1.3, y0: 1.75, y1: 2.95 }, { x: 3.1, w: 1.0, y0: 2.0, y1: 2.95 }];
      const sideOpenings = { west: [{ x: 1.2, w: 1.4, y0: sill, y1: head }], east: [{ x: -1.6, w: 1.4, y0: sill, y1: head }] };
      // The front wall fades with the roof in cutaway mode so the House camera can see in
      const frontWallMat = new THREE.MeshStandardMaterial({ color: 0xf5ead6, roughness: 0.85, transparent: true, opacity: 1 });
      const front = houseWallWithOpenings(w, wallH, t, frontOpenings, frontWallMat);
      front.position.set(0, floorY, d / 2 - t / 2);
      const back = houseWallWithOpenings(w, wallH, t, backOpenings, wallMat);
      back.position.set(0, floorY, -d / 2 + t / 2);
      // Side walls run along z: after the turn, local x points to +z on the west wall and -z on the east
      const west = houseWallWithOpenings(d - 2 * t, wallH, t, sideOpenings.west, wallMat);
      west.rotation.y = -Math.PI / 2;
      west.position.set(-w / 2 + t / 2, floorY, 0);
      const east = houseWallWithOpenings(d - 2 * t, wallH, t, sideOpenings.east, wallMat);
      east.rotation.y = Math.PI / 2;
      east.position.set(w / 2 - t / 2, floorY, 0);
      house.add(front, back, west, east);
      // Skirting board along the back wall
      box(w - 2 * t, 0.12, 0.02, trimMat, 0, floorY + 0.06, -d / 2 + t + 0.01);
      // Corner boards and a band of trim under the eaves
      [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => box(0.26, wallH, 0.26, trimMat, sx * (w / 2), floorY + wallH / 2, sz * (d / 2)));
      box(w + 0.1, 0.18, 0.06, trimMat, 0, floorY + wallH - 0.09, -d / 2 - 0.03);
      const frontBand = box(w + 0.1, 0.18, 0.06, frontWallMat, 0, floorY + wallH - 0.09, d / 2 + 0.03);

      // Windows (glass that glows warm at night). Side windows sit in walls turned 90 degrees.
      const addWindow = (wWin, hWin, x, y, z, rotY) => {
        const win = houseWindow(wWin, hWin, trimMat, glassMat);
        win.position.set(x, floorY + y, z);
        win.rotation.y = rotY;
        house.add(win);
        return win;
      };
      addWindow(1.6, head - sill, -2.85, (sill + head) / 2, d / 2 - t / 2, 0);
      addWindow(1.6, head - sill, 2.85, (sill + head) / 2, d / 2 - t / 2, 0);
      addWindow(1.3, 1.2, -2.1, 2.35, -d / 2 + t / 2, Math.PI);
      addWindow(1.0, 0.95, 3.1, 2.475, -d / 2 + t / 2, Math.PI);
      addWindow(1.4, head - sill, -w / 2 + t / 2, (sill + head) / 2, 1.2, -Math.PI / 2);
      addWindow(1.4, head - sill, w / 2 - t / 2, (sill + head) / 2, 1.6, Math.PI / 2);

      // Flower boxes under the front and side windows
      [[-2.85, d / 2 + 0.2, 0, 1.6], [2.85, d / 2 + 0.2, 0, 1.6]].forEach(([x, z, r, bw]) => {
        const fb = houseFlowerBox(bw, trimMat);
        fb.position.set(x, floorY + sill - 0.3, z);
        fb.rotation.y = r;
        house.add(fb);
      });
      const fbWest = houseFlowerBox(1.4, trimMat);
      fbWest.position.set(-w / 2 - 0.2, floorY + sill - 0.3, 1.2);
      fbWest.rotation.y = -Math.PI / 2;
      const fbEast = houseFlowerBox(1.4, trimMat);
      fbEast.position.set(w / 2 + 0.2, floorY + sill - 0.3, 1.6);
      fbEast.rotation.y = Math.PI / 2;
      house.add(fbWest, fbEast);

      // --- Front door: a frame and two teal panels with glass strips and brass pulls. They slide apart
      // into pockets in the wall when he comes near, so nothing swings into his way.
      const doorFrame = new THREE.Group();
      box(0.14, doorH + 0.07, 0.3, trimMat, -doorW / 2 - 0.07, floorY + (doorH + 0.07) / 2, d / 2 - t / 2, doorFrame);
      box(0.14, doorH + 0.07, 0.3, trimMat, doorW / 2 + 0.07, floorY + (doorH + 0.07) / 2, d / 2 - t / 2, doorFrame);
      box(doorW + 0.42, 0.16, 0.34, trimMat, 0, floorY + doorH + 0.08, d / 2 - t / 2, doorFrame);
      box(doorW, 0.03, 0.3, darkWood, 0, floorY + 0.015, d / 2 - t / 2, doorFrame);
      house.add(doorFrame);
      const doorMat = new THREE.MeshStandardMaterial({ color: 0x2f6f73, roughness: 0.6 });
      const panelMat = new THREE.MeshStandardMaterial({ color: 0x285f63, roughness: 0.6 });
      const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4a73a, metalness: 0.8, roughness: 0.3 });
      const leafW = doorW / 2;
      const leaves = [-1, 1].map(side => {
        const leaf = new THREE.Group();
        leaf.userData.side = side;
        box(leafW - 0.02, doorH - 0.04, 0.08, doorMat, 0, (doorH - 0.04) / 2, 0, leaf);
        [-1, 1].forEach(face => {
          box(leafW - 0.3, 0.8, 0.02, panelMat, 0, 0.7, face * 0.045, leaf);
          box(0.26, 1.3, 0.02, glassMat, -side * 0.12, 2.05, face * 0.045, leaf).castShadow = false;
          box(0.05, 0.5, 0.05, brassMat, -side * (leafW / 2 - 0.12), 1.45, face * 0.07, leaf).castShadow = false;
        });
        leaf.position.set(side * leafW / 2, floorY, d / 2 - t / 2);
        house.add(leaf);
        return leaf;
      });
      // Open while he is close by (and not asleep), eased each time the door is drawn
      let doorOpen = 0;
      leaves[0].children[0].onBeforeRender = () => {
        const p = state.botPos || { x: 999, z: 999 };
        const near = Math.hypot(p.x - wx(0), p.z - wz(d / 2)) < 2.8 && state.currentLocKey !== 'bed';
        doorOpen += ((near ? 1 : 0) - doorOpen) * 0.08;
        leaves.forEach(l => { l.position.x = l.userData.side * (leafW / 2 + doorOpen * (leafW - 0.06)); });
      };

      // --- Gabled roof with a deep overhang, see-through in cutaway mode
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x3e5c66, roughness: 0.75, transparent: true, opacity: state.roofCutaway ? 0.18 : 0.95, side: THREE.DoubleSide });
      const roofTrim = new THREE.MeshStandardMaterial({ color: 0xece2cf, roughness: 0.7, transparent: true, opacity: state.roofCutaway ? 0.18 : 0.95, side: THREE.DoubleSide });
      const rise = 2.1, overhang = 0.6, sideHang = 0.45;
      const pitch = Math.atan2(rise, d / 2);
      const run = d / 2 + overhang;
      const slopeLen = run / Math.cos(pitch);
      const ridgeY = floorY + wallH + rise;
      const roofParts = [];
      [1, -1].forEach(side => {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 2 * sideHang, 0.16, slopeLen), roofMat);
        // Midway down the slope, lifted half a thickness so it sits on the walls
        slab.position.set(0, ridgeY - (run / 2) * Math.tan(pitch) + 0.08, side * run / 2);
        slab.rotation.x = side * pitch;
        roofParts.push(slab);
        // Shingle courses: thin battens across the slope
        for (let k = 1; k < 6; k++) {
          const along = (k / 6) * run;
          const course = new THREE.Mesh(new THREE.BoxGeometry(w + 2 * sideHang, 0.05, 0.08), roofMat);
          course.position.set(0, ridgeY - along * Math.tan(pitch) + 0.18, side * along);
          course.rotation.x = side * pitch;
          roofParts.push(course);
        }
        // Fascia board along the eave
        const fascia = new THREE.Mesh(new THREE.BoxGeometry(w + 2 * sideHang, 0.2, 0.08), roofTrim);
        fascia.position.set(0, ridgeY - run * Math.tan(pitch) + 0.02, side * (run + 0.02));
        roofParts.push(fascia);
      });
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(w + 2 * sideHang + 0.1, 0.18, 0.3), roofTrim);
      ridge.position.set(0, ridgeY + 0.15, 0);
      roofParts.push(ridge);
      roofParts.forEach(r => { r.castShadow = false; house.add(r); cutawayRoofMeshes.push(r); });

      // Gable ends: wall-coloured triangles above the side walls, with a round attic vent
      const gableShape = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, rise)]);
      const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: t, bevelEnabled: false });
      [-1, 1].forEach(side => {
        const gable = new THREE.Mesh(gableGeo, wallMat);
        gable.rotation.y = Math.PI / 2;
        gable.position.set(side > 0 ? w / 2 - t : -w / 2, floorY + wallH, 0);
        gable.castShadow = true;
        house.add(gable);
        const vent = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 18), trimMat, side * (w / 2 + 0.02), floorY + wallH + rise * 0.42, 0);
        vent.rotation.z = Math.PI / 2;
      });

      // --- Stone chimney on the west end, rising past the ridge
      const chimX = -w / 2 - 0.45, chimZ = -1.6;
      box(0.9, ridgeY + 0.9 - floorY + 0.3, 1.0, stoneMat, chimX, (ridgeY + 0.9 + floorY - 0.3) / 2, chimZ);
      box(1.05, 0.16, 1.15, new THREE.MeshStandardMaterial({ color: 0x6d6760, roughness: 0.9 }), chimX, ridgeY + 0.98, chimZ);
      // Stone courses so it reads as stacked rock
      for (let y = 0.6; y < ridgeY + 0.6; y += 0.6) box(0.94, 0.05, 1.04, new THREE.MeshStandardMaterial({ color: 0x847d74 }), chimX, floorY + y, chimZ);

      // --- Porch: deck, two steps, posts and a railing with an opening for the steps
      const porchD = 1.6, porchW = 4.2;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(porchW, 0.3, porchD), lightWood);
      deck.position.set(wx(0), floorY - 0.15, wz(d / 2 + porchD / 2));
      deck.receiveShadow = true;
      deck.castShadow = true;
      const step1 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 0.4), lightWood);
      step1.position.set(wx(0), floorY - 0.18, wz(d / 2 + porchD + 0.2));
      const step2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.4), lightWood);
      step2.position.set(wx(0), floorY - 0.2, wz(d / 2 + porchD + 0.6));
      [step1, step2].forEach(s => { s.receiveShadow = true; s.castShadow = true; });
      ground.add(deck, step1, step2);
      for (let i = -2; i <= 2; i++) box(porchW - 0.1, 0.005, 0.02, darkWood, i * 0.42, floorY + 0.003, d / 2 + porchD / 2).castShadow = false;
      const railH = 1.05, pz0 = d / 2, pz1 = d / 2 + porchD - 0.06;
      const postAt = (x, z) => box(0.14, railH + 0.1, 0.14, trimMat, x, floorY + (railH + 0.1) / 2, z);
      const railRun = (x0, z0, x1, z1) => {
        const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
        const top = box(0.1, 0.08, len, trimMat, (x0 + x1) / 2, floorY + railH, (z0 + z1) / 2);
        top.rotation.y = ang;
        const n = Math.max(2, Math.round(len / 0.22));
        for (let i = 1; i < n; i++) box(0.05, railH - 0.1, 0.05, wallMat, x0 + ((x1 - x0) * i) / n, floorY + railH / 2, z0 + ((z1 - z0) * i) / n);
      };
      const half = porchW / 2 - 0.07, gap = 0.95;
      [[-half, pz0 + 0.07], [-half, pz1], [-gap, pz1], [gap, pz1], [half, pz1], [half, pz0 + 0.07]].forEach(([x, z]) => postAt(x, z));
      railRun(-half, pz0 + 0.07, -half, pz1);
      railRun(half, pz0 + 0.07, half, pz1);
      railRun(-half, pz1, -gap, pz1);
      railRun(gap, pz1, half, pz1);
      // A small bench and a doormat on the porch
      box(1.0, 0.08, 0.4, lightWood, -1.45, floorY + 0.5, d / 2 + 0.35);
      [-1.85, -1.05].forEach(x => box(0.08, 0.5, 0.36, trimMat, x, floorY + 0.25, d / 2 + 0.35));
      box(1.3, 0.02, 0.6, fabricMat(0xa0522d), 0, floorY + 0.01, d / 2 + 0.45).castShadow = false;
      // Porch lantern beside the door
      const lanternGlow = new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffb347, emissiveIntensity: 0.1 });
      box(0.08, 0.3, 0.12, darkWood, doorW / 2 + 0.45, floorY + 2.35, d / 2 + 0.08);
      box(0.22, 0.3, 0.22, lanternGlow, doorW / 2 + 0.45, floorY + 2.2, d / 2 + 0.2).castShadow = false;
      box(0.28, 0.06, 0.28, darkWood, doorW / 2 + 0.45, floorY + 2.38, d / 2 + 0.2);

      // --- Inside ---------------------------------------------------------------------------
      // Bed: Kelo-1 lies at (-11.6, 0.95, -8.8) with his head toward the back wall
      const bedX = -11.6 - HOUSE.x, bedFoot = -8.4 - HOUSE.z, bedHead = -d / 2 + t + 0.06;
      const bedLen = bedFoot - bedHead, bedMid = (bedFoot + bedHead) / 2, bedW = 1.8;
      box(bedW + 0.1, 0.3, bedLen, darkWood, bedX, floorY + 0.3, bedMid);
      [[-1, bedHead + 0.1], [1, bedHead + 0.1], [-1, bedFoot - 0.1], [1, bedFoot - 0.1]].forEach(([s, z]) => box(0.12, 0.2, 0.12, darkWood, bedX + s * (bedW / 2 - 0.02), floorY + 0.1, z));
      box(bedW - 0.06, 0.18, bedLen - 0.1, fabricMat(0xf8fafc), bedX, floorY + 0.54, bedMid);
      // Quilt over the lower two thirds, folded back at the top
      const quiltLen = bedLen * 0.66;
      box(bedW + 0.02, 0.06, quiltLen, fabricMat(0x10b981), bedX, floorY + 0.65, bedFoot - quiltLen / 2 + 0.02);
      box(bedW + 0.02, 0.07, 0.22, fabricMat(0xd1fae5), bedX, floorY + 0.67, bedFoot - quiltLen + 0.1);
      for (let i = 1; i < 4; i++) box(bedW + 0.03, 0.065, 0.04, fabricMat(0x0e9f6e), bedX, floorY + 0.652, bedFoot - (i * quiltLen) / 4);
      box(1.2, 0.2, 0.45, fabricMat(0xfff7ed), bedX, floorY + 0.72, bedHead + 0.35);
      // Headboard with a rounded top rail
      box(bedW + 0.2, 1.3, 0.1, darkWood, bedX, floorY + 0.65, bedHead - 0.02);
      const headRail = mesh(new THREE.CylinderGeometry(0.08, 0.08, bedW + 0.24, 12), lightWood, bedX, floorY + 1.32, bedHead - 0.02);
      headRail.rotation.z = Math.PI / 2;
      box(bedW + 0.1, 0.55, 0.08, darkWood, bedX, floorY + 0.55, bedFoot + 0.02);

      // Nightstand with a little lamp
      const nsX = -w / 2 + t + 0.4, nsZ = bedHead + 0.45;
      box(0.62, 0.62, 0.56, lightWood, nsX, floorY + 0.31, nsZ);
      box(0.5, 0.02, 0.02, darkWood, nsX, floorY + 0.42, nsZ + 0.29);
      box(0.14, 0.04, 0.14, darkWood, nsX, floorY + 0.64, nsZ);
      box(0.04, 0.32, 0.04, darkWood, nsX, floorY + 0.8, nsZ);
      const shadeMat = new THREE.MeshStandardMaterial({ color: 0xfde7b0, emissive: 0xffb04a, emissiveIntensity: 0.05, side: THREE.DoubleSide });
      mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.24, 14, 1, true), shadeMat, nsX, floorY + 1.02, nsZ).castShadow = false;
      // A stack of books on the nightstand
      [0x2563eb, 0xdc2626].forEach((c, i) => box(0.3, 0.05, 0.22, fabricMat(c), nsX + 0.1, floorY + 0.65 + i * 0.05, nsZ + 0.12));

      // Bookshelf against the back wall
      const bsX = 0.35, bsZ = -d / 2 + t + 0.22, bsW = 1.6, bsH = 2.7;
      box(bsW, bsH, 0.06, darkWood, bsX, floorY + bsH / 2, bsZ - 0.18);
      [-1, 1].forEach(s => box(0.08, bsH, 0.44, darkWood, bsX + s * (bsW / 2 - 0.04), floorY + bsH / 2, bsZ));
      const bookColors = [0xef4444, 0xf59e0b, 0x10b981, 0x3b82f6, 0x8b5cf6, 0xec4899, 0x14b8a6, 0xfacc15, 0x64748b];
      for (let s = 0; s < 5; s++) {
        const y = 0.06 + s * 0.62;
        box(bsW - 0.12, 0.05, 0.42, darkWood, bsX, floorY + y, bsZ);
        if (s === 4) break;
        let x = bsX - bsW / 2 + 0.12;
        let k = s * 3;
        while (x < bsX + bsW / 2 - 0.2) {
          const bw = 0.07 + ((k * 7) % 5) * 0.015, bh = 0.34 + ((k * 5) % 4) * 0.04;
          if ((k + s) % 9 === 4) { x += 0.12; k++; continue; } // a gap now and then
          const book = box(bw, bh, 0.3, fabricMat(bookColors[k % bookColors.length]), x + bw / 2, floorY + y + 0.025 + bh / 2, bsZ + 0.02);
          if ((k + s) % 11 === 6) book.rotation.z = 0.2;
          x += bw + 0.01;
          k++;
        }
      }
      // A little potted plant on top of the shelf
      mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.22, 12), new THREE.MeshStandardMaterial({ color: 0xc2410c }), bsX + 0.45, floorY + bsH + 0.11, bsZ);
      mesh(new THREE.IcosahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: 0x3f9b46, flatShading: true }), bsX + 0.45, floorY + bsH + 0.36, bsZ);

      // Desk in the back-right corner with a monitor, keyboard, desk lamp and a stool
      const dkX = 2.85, dkZ = -d / 2 + t + 0.42, dkW = 1.9;
      box(dkW, 0.08, 0.8, lightWood, dkX, floorY + 1.0, dkZ);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => box(0.07, 0.96, 0.07, darkWood, dkX + sx * (dkW / 2 - 0.08), floorY + 0.48, dkZ + sz * 0.32));
      box(0.5, 0.5, 0.7, lightWood, dkX + dkW / 2 - 0.3, floorY + 0.7, dkZ);
      const screenMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x38bdf8, emissiveIntensity: 0.35 });
      box(0.9, 0.55, 0.05, new THREE.MeshStandardMaterial({ color: 0x1f2937 }), dkX - 0.2, floorY + 1.45, dkZ - 0.22);
      box(0.82, 0.47, 0.01, screenMat, dkX - 0.2, floorY + 1.45, dkZ - 0.19).castShadow = false;
      box(0.08, 0.3, 0.08, new THREE.MeshStandardMaterial({ color: 0x1f2937 }), dkX - 0.2, floorY + 1.15, dkZ - 0.25);
      box(0.6, 0.03, 0.2, new THREE.MeshStandardMaterial({ color: 0xe5e7eb }), dkX - 0.2, floorY + 1.055, dkZ + 0.12);
      box(0.06, 0.4, 0.06, darkWood, dkX + 0.65, floorY + 1.24, dkZ - 0.15);
      mesh(new THREE.ConeGeometry(0.16, 0.2, 12, 1, true), shadeMat, dkX + 0.65, floorY + 1.5, dkZ - 0.15).castShadow = false;
      mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16), fabricMat(0xf97316), dkX - 0.2, floorY + 0.72, dkZ + 0.75);
      mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.68, 8), darkWood, dkX - 0.2, floorY + 0.34, dkZ + 0.75);
      // A framed mountain picture between the back window and the bookshelf
      const art = new THREE.Group();
      box(0.95, 0.7, 0.04, trimMat, 0, 0, 0, art);
      box(0.8, 0.55, 0.02, new THREE.MeshStandardMaterial({ color: 0x93c5fd }), 0, 0, 0.02, art);
      const peak = mesh(new THREE.ConeGeometry(0.22, 0.3, 3), new THREE.MeshStandardMaterial({ color: 0x475569 }), -0.12, -0.1, 0.03, art);
      peak.scale.z = 0.1;
      const peak2 = mesh(new THREE.ConeGeometry(0.18, 0.24, 3), new THREE.MeshStandardMaterial({ color: 0x64748b }), 0.16, -0.13, 0.03, art);
      peak2.scale.z = 0.1;
      art.position.set(-0.85 - 0.1, floorY + 2.2, -d / 2 + t + 0.03);
      house.add(art);

      // Robot charging dock on the east wall: a glowing pad on the floor and a wall unit with a cable
      const dockX = w / 2 - t - 0.6, dockZ = -0.75;
      const dockGlow = new THREE.MeshStandardMaterial({ color: 0x5eead4, emissive: 0x2dd4bf, emissiveIntensity: 0.8 });
      const dockBody = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.4 });
      mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.08, 28), dockBody, dockX - 0.1, floorY + 0.04, dockZ);
      const ring = mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 32), dockGlow, dockX - 0.1, floorY + 0.09, dockZ);
      ring.rotation.x = Math.PI / 2;
      ring.castShadow = false;
      box(0.18, 2.0, 0.9, dockBody, w / 2 - t - 0.09, floorY + 1.0, dockZ);
      box(0.02, 1.6, 0.1, dockGlow, w / 2 - t - 0.19, floorY + 1.0, dockZ - 0.25).castShadow = false;
      box(0.02, 1.6, 0.1, dockGlow, w / 2 - t - 0.19, floorY + 1.0, dockZ + 0.25).castShadow = false;
      // Lightning bolt badge
      const bolt = new THREE.Shape([new THREE.Vector2(0.05, 0.2), new THREE.Vector2(-0.08, -0.02), new THREE.Vector2(0.0, -0.02), new THREE.Vector2(-0.05, -0.2), new THREE.Vector2(0.09, 0.04), new THREE.Vector2(0.01, 0.04)]);
      const boltMesh = new THREE.Mesh(new THREE.ShapeGeometry(bolt), new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xfacc15, emissiveIntensity: 0.9, side: THREE.DoubleSide }));
      boltMesh.position.set(w / 2 - t - 0.19, floorY + 1.55, dockZ);
      boltMesh.rotation.y = -Math.PI / 2;
      boltMesh.scale.setScalar(1.3);
      house.add(boltMesh);
      const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(w / 2 - t - 0.2, floorY + 0.7, dockZ + 0.1), new THREE.Vector3(w / 2 - t - 0.5, floorY + 0.45, dockZ + 0.3),
        new THREE.Vector3(w / 2 - t - 0.75, floorY + 0.75, dockZ + 0.45), new THREE.Vector3(w / 2 - t - 0.45, floorY + 0.95, dockZ + 0.15)
      ]), 24, 0.03, 6), new THREE.MeshStandardMaterial({ color: 0x111827 }));
      house.add(cable);
      box(0.12, 0.2, 0.1, dockGlow, w / 2 - t - 0.45, floorY + 1.0, dockZ + 0.15).castShadow = false;
      // The ring breathes slowly, brighter while he is at home
      ring.onBeforeRender = () => {
        const home = state.currentLocKey === 'bed' || state.currentLocKey === 'couch';
        dockGlow.emissiveIntensity = (home ? 0.9 : 0.55) + Math.sin(performance.now() / 600) * 0.3;
      };

      // Couch: he stands at (-7.5, -6.8), just in front of the seat, looking out the front windows
      const cX = -7.5 - HOUSE.x, cZ = -7.8 - HOUSE.z, cW = 2.4;
      const couchMat = fabricMat(0xf59e0b), cushionMat = fabricMat(0xfbbf24);
      box(cW, 0.42, 0.95, couchMat, cX, floorY + 0.33, cZ);
      box(cW, 0.75, 0.25, couchMat, cX, floorY + 0.8, cZ - 0.37);
      [-1, 1].forEach(s => box(0.24, 0.65, 0.95, couchMat, cX + s * (cW / 2 - 0.12), floorY + 0.45, cZ));
      [-1, 1].forEach(s => box(cW / 2 - 0.26, 0.14, 0.7, cushionMat, cX + s * (cW / 4 - 0.06), floorY + 0.6, cZ + 0.08));
      [-1, 1].forEach(s => box(cW / 2 - 0.3, 0.5, 0.14, cushionMat, cX + s * (cW / 4 - 0.06), floorY + 0.9, cZ - 0.2));
      const pillow = box(0.38, 0.32, 0.12, fabricMat(0x0ea5e9), cX - cW / 2 + 0.45, floorY + 0.85, cZ - 0.08);
      pillow.rotation.z = 0.25;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => box(0.08, 0.12, 0.08, darkWood, cX + sx * (cW / 2 - 0.1), floorY + 0.06, cZ + sz * 0.38));
      // Rug in front of the couch, where he stands
      box(3.0, 0.02, 1.7, fabricMat(0xb45309), cX, floorY + 0.01, cZ + 1.1).castShadow = false;
      box(2.6, 0.022, 1.3, fabricMat(0xfcd34d), cX, floorY + 0.012, cZ + 1.1).castShadow = false;
      box(2.2, 0.024, 0.9, fabricMat(0xb45309), cX, floorY + 0.014, cZ + 1.1).castShadow = false;
      // Side table with a mug, and a floor lamp at the other end
      const stX = cX - cW / 2 - 0.4;
      mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 18), lightWood, stX, floorY + 0.62, cZ);
      mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), darkWood, stX, floorY + 0.3, cZ);
      mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.13, 12), new THREE.MeshStandardMaterial({ color: 0xffffff }), stX + 0.08, floorY + 0.71, cZ + 0.05);
      const flX = cX + cW / 2 + 0.45, flZ = cZ + 0.1;
      mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.05, 16), darkWood, flX, floorY + 0.03, flZ);
      mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 8), darkWood, flX, floorY + 0.98, flZ);
      mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.4, 16, 1, true), shadeMat, flX, floorY + 2.05, flZ).castShadow = false;

      // A round rug by the bed and a tall plant in the front-left corner
      const roundRug = mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.02, 28), fabricMat(0x60a5fa), bedX + 1.0, floorY + 0.01, bedFoot + 0.9);
      roundRug.castShadow = false;
      mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.45, 12), new THREE.MeshStandardMaterial({ color: 0xe7e5e4 }), -w / 2 + t + 0.4, floorY + 0.23, d / 2 - t - 0.4);
      [0.75, 1.05, 1.3].forEach((y, i) => mesh(new THREE.IcosahedronGeometry(0.34 - i * 0.07, 0), new THREE.MeshStandardMaterial({ color: 0x2f8f46, flatShading: true }), -w / 2 + t + 0.4, floorY + y, d / 2 - t - 0.4));

      // Ceiling lamp: a pendant hanging from the ridge over the middle of the room
      box(0.03, 1.1, 0.03, darkWood, 0, floorY + wallH + 0.5, 0);
      mesh(new THREE.ConeGeometry(0.36, 0.3, 18, 1, true), shadeMat, 0, floorY + wallH - 0.1, 0).castShadow = false;
      const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff7e0, emissive: 0xffc46b, emissiveIntensity: 0.1 });
      mesh(new THREE.SphereGeometry(0.11, 12, 10), bulbMat, 0, floorY + wallH - 0.22, 0).castShadow = false;

      scene.add(house);
      terrainSwapGroup.add(ground);
      // The foothill firs (scattered at random from z -11 northward) mustn't grow through the back
      // wall: any that landed on the house or tight behind it are moved back a little
      const backZ = HOUSE.z - d / 2 - 1.5;
      scene.children.forEach(o => {
        const isFir = o.isGroup && o.children.some(c => c.material && c.material.userData && c.material.userData.seasonal === 'needle');
        if (!isFir || Math.abs(o.position.x - HOUSE.x) > w / 2 + 1.3 || o.position.z < backZ) return;
        const obstacle = worldObstacles.find(ob => ob.x === o.position.x && ob.z === o.position.z);
        o.position.z = backZ - Math.random() * 1.5;
        o.position.y = getAnalyticalGroundHeight(o.position.x, o.position.z);
        if (obstacle) obstacle.z = o.position.z;
      });

      // --- Warm lights for the evening: one over the room, one at the porch
      const roomLight = new THREE.PointLight(0xffb866, 0, 11, 1.6);
      roomLight.position.set(wx(0), floorY + 2.9, wz(-0.3));
      const porchLight = new THREE.PointLight(0xffb347, 0, 6, 1.8);
      porchLight.position.set(wx(doorW / 2 + 0.45), floorY + 2.1, wz(d / 2 + 0.6));
      scene.add(roomLight, porchLight);
      houseLights = { roomLight, porchLight, glassMat, shadeMat, lanternGlow, bulbMat, level: 0 };

      // Front wall (and porch details on it) fade along with the roof in cutaway mode
      const fadeFront = () => {
        const target = state.roofCutaway ? 0.22 : 1;
        frontWallMat.opacity += (target - frontWallMat.opacity) * 0.15;
        frontWallMat.depthWrite = frontWallMat.opacity > 0.9;
      };
      front.children.forEach(m => { m.onBeforeRender = fadeFront; });
      frontBand.onBeforeRender = fadeFront;

      // --- Stepping-stone path from the porch steps down to the lane by the welding studio
      const pathMat = new THREE.MeshStandardMaterial({ color: 0xc9bfae, roughness: 0.95 });
      const pathPts = new THREE.CatmullRomCurve3([
        new THREE.Vector3(wx(0), 0, wz(d / 2 + porchD + 1.1)), new THREE.Vector3(wx(0.3), 0, wz(d / 2 + porchD + 2.6)),
        new THREE.Vector3(wx(2.0), 0, wz(d / 2 + porchD + 3.6)), new THREE.Vector3(wx(4.2), 0, wz(d / 2 + porchD + 4.1)),
        new THREE.Vector3(-3.6, 0, wz(d / 2 + porchD + 4.4))
      ]);
      const stones = 14;
      for (let i = 0; i <= stones; i++) {
        const p = pathPts.getPoint(i / stones);
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.36 + (i % 3) * 0.04, 0.4, 0.08, 7), pathMat);
        s.position.set(p.x + ((i * 37) % 5 - 2) * 0.04, getAnalyticalGroundHeight(p.x, p.z) + 0.02, p.z);
        s.rotation.y = i * 1.3;
        s.receiveShadow = true;
        scene.add(s);
      }

      // --- Where he can't walk: posts along the walls (with a gap for the door) and the porch rails.
      // Circles must leave at least two path cells (0.75 apart) free through the doorway and steps.
      const walls = [];
      for (let x = -w / 2; x <= w / 2 + 0.01; x += 0.84) {
        walls.push([x, -d / 2]);
        if (Math.abs(x) > doorW / 2 + 0.5) walls.push([x, d / 2]);
      }
      for (let z = -d / 2 + 0.9; z < d / 2 - 0.1; z += 0.9) walls.push([-w / 2, z], [w / 2, z]);
      walls.push([chimX, chimZ]);
      [[-half, pz0 + 0.65], [-half, pz1], [half, pz0 + 0.65], [half, pz1], [-gap - 0.6, pz1], [gap + 0.6, pz1]].forEach(p => walls.push(p));
      const furniture = [[0.35, -d / 2 + 0.45, 0.45], [2.85, -d / 2 + 0.6, 0.5], [3.4, -d / 2 + 0.6, 0.45], [nsX, nsZ, 0.3]];
      HOUSE.obstacles = walls.map(([x, z]) => ({ x: wx(x), z: wz(z), r: 0.32 }))
        .concat(furniture.map(([x, z, r]) => ({ x: wx(x), z: wz(z), r })));
      // Added once the rest of the scene is built, so the seeded valley trees keep their old spots and ids
      queueMicrotask(() => worldObstacles.push(...HOUSE.obstacles));

      updateHouseLights(true);
      setInterval(() => updateHouseLights(false), 500);
    }

// Lamps on after dark: the room light, window glow, lamp shades and the porch lantern ease up and down
function updateHouseLights(instant) {
      if (!houseLights) return;
      const night = typeof worldNow === 'function' && worldNow().isNight;
      const L = houseLights;
      const target = night ? 1 : 0;
      L.level = instant ? target : L.level + (target - L.level) * 0.35;
      if (Math.abs(L.level - target) < 0.02) L.level = target;
      L.roomLight.intensity = 1.5 * L.level;
      L.porchLight.intensity = 1.1 * L.level;
      L.glassMat.emissiveIntensity = 0.75 * L.level;
      L.shadeMat.emissiveIntensity = 0.05 + 0.9 * L.level;
      L.lanternGlow.emissiveIntensity = 0.1 + 1.4 * L.level;
      L.bulbMat.emissiveIntensity = 0.1 + 1.6 * L.level;
    }
