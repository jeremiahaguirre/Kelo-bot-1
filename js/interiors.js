// Kelo-bot-1 — js/interiors.js
// Loaded after basements.js. Three town buildings have real rooms inside, and Kelo-1 uses them:
//  - NetNode Cyber Cafe: every trip there (searches, look-ups, research, coding) he walks in through
//    the glass door, sits at a computer whose screen lights up, types and reads, then gets up and leaves.
//  - Bean & Byte Cafe: he walks in, orders at the counter under the menu board, sits at the table and
//    eats what he ordered off a plate (a coffee beside it), then leaves.
//  - Post Office: he walks in to the wall of PO boxes, his own box door swings open and he takes his
//    mail out. (Waiting mail still shows on the pick-up table outside, js/items3d.js, as before.)
//
// How it fits together: scene.js builds the three buildings and hands their solid body, front and
// roof parts to interiorSetup(), which makes the walls hollow (same footprint, door and foundation)
// and registers the furniture as box obstacles. Nothing about WHY he goes there changes: the visit
// starts when he arrives at the building's pin (TOWN_LOCATIONS cafe / cyber / post_office) with that
// pin as his target, and waitForArrival() (wrapped below) only returns once he is seated or at his
// box, so the search, the meal or the mail happen inside. He leaves when the activity that brought
// him is over (its busy flags clear) or his target moves elsewhere. The walk inside reuses the
// indoor-trip machinery of js/basements.js (indoorTrip, tripWalk, the trip camera), so the roof and
// the front wall are hidden while he is in there. The furnished rooms are only built the first time
// he goes in and are hidden whenever he is not inside.

const INTERIOR_SPECS = {
  cafe: {
    name: 'Bean & Byte Cafe', w: 3.8, d: 2.8, H: 2.4, floor: 0.15, door: { x: 0.9, w: 0.8, h: 1.4 }, camDist: 6.5,
    walkIn: [{ x: 0.9, z: 2.0, ground: true }, { x: 0.9, z: 1.35 }, { x: 0.9, z: 0.75 }],
    // Furniture footprints (building-local x, z, half width, half depth)
    blocks: [['counter', 0.8, -1.01, 1.0, 0.29], ['table', -1.05, 0.55, 0.23, 0.23], ['chair', -1.05, 0.1, 0.14, 0.14],
      ['chair2', -0.6, 0.55, 0.14, 0.14], ['plant', -1.55, 1.05, 0.2, 0.2]],
    order: { x: 0.75, z: -0.5, face: { x: 0.75, z: -1.2 } },
    seat: { via: [{ x: -0.35, z: 0.1 }], x: -1.05, z: 0.1, rotY: 0, h: 0.46 },
    table: { x: -1.05, z: 0.55, h: 0.72 }
  },
  cyber: {
    name: 'NetNode Cyber Cafe', w: 4.2, d: 3.0, H: 2.5, floor: 0.15, door: { x: 1.3, w: 0.8, h: 1.5 }, noGap: true, roofSlab: true, camDist: 6.5,
    walkIn: [{ x: 1.3, z: 1.95, ground: true }, { x: 1.3, z: 1.35 }, { x: 1.2, z: 0.8 }],
    blocks: [['desk', -1.7, -0.75, 0.3, 0.5], ['desk2', -1.7, 0.55, 0.3, 0.5], ['chair', -1.18, -0.75, 0.15, 0.15], ['chair2', -1.18, 0.55, 0.15, 0.15],
      ['printer', 0.1, -1.19, 0.45, 0.21], ['rack', 1.05, -1.15, 0.3, 0.25], ['vending', 1.75, -0.3, 0.25, 0.35]],
    seat: { via: [{ x: -0.4, z: 0.55 }], x: -1.18, z: 0.55, rotY: -Math.PI / 2, h: 0.48 },
    screen: { x: -1.74, z: 0.55, y: 1.22 }
  },
  post_office: {
    name: 'Post Office', w: 4.2, d: 3.2, H: 2.6, floor: 0.25, door: { x: 0, w: 0.9, h: 1.5 }, camDist: 6.5,
    walkIn: [{ x: 0, z: 2.4, ground: true }, { x: 0, z: 1.95, y: 0.14 }, { x: 0, z: 1.45 }, { x: 0, z: 0.85 }],
    blocks: [['poboxes', -1.86, -0.3, 0.14, 1.1], ['counter', 0.775, -1.225, 1.175, 0.275], ['shelf', 1.85, 0.15, 0.15, 0.75]],
    box: { via: [{ x: -0.9, z: 0.3 }], x: -1.58, z: -0.12, y: 1.17, face: { x: -2.0, z: -0.12 } }
  }
};
// Sizes: the specs are in the building's own model units (its group is scaled up to real size,
// TOWN_BUILDINGS in js/agent.js), so walls, doors, the floor plan and every spot scale with it. The
// furniture is drawn in an inner group that is only squashed in height (and chairs, the table, the
// computers and what he eats off are kept in proportion), so chairs, desks and counters come out at
// TOWN_FURNITURE_SCALE: a seat and a desk at the height he sits and reaches at.
function interiorScale(key) {
      const room = interiorRooms[key];
      return room ? Math.abs(room.root.scale.x) || 1 : 1;
    }
function interiorFurnScale() {
      return typeof TOWN_FURNITURE_SCALE === 'number' ? TOWN_FURNITURE_SCALE : 1;
    }
// A furniture group in the squashed inner group, scaled back to the furniture's true proportions
function intUpright(parent, q, x, y, z) {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.scale.set(q, 1, q);
      parent.add(g);
      return g;
    }
const INTERIOR_BUSY_FLAGS = ['isBusy', 'isBrowsing', 'isPracticing', 'isCollectingMail', 'isBuilding'];
const interiorRooms = {};        // key -> { root, front, roof, inside, parts }
let interiorVisitNow = null;     // the visit in progress
let interiorLastExit = null;     // { x, z }: don't walk straight back in while the target is unchanged

// --- The shell: hollow walls with the same outside --------------------------------------------
// parts: { body (the old solid box), front: [...], roof: [...] }. Anything in the root tagged
// userData.interiorPart = 'front' / 'roof' (the kit's front face, a roof group) joins those too.
function interiorSetup(key, root, parts) {
      const S = INTERIOR_SPECS[key];
      if (!S || !root || !parts || !parts.body) return;
      const mat = parts.body.material, t = 0.12, H = S.H;
      root.remove(parts.body);
      const front = new THREE.Group(), roof = new THREE.Group();
      front.userData.interiorPart = 'frontGroup';
      roof.userData.interiorPart = 'roofGroup';
      root.add(front, roof);
      const wall = (w, h, d, x, y, z, parent = root) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z);
        m.castShadow = m.receiveShadow = true;
        parent.add(m);
        return m;
      };
      wall(S.w, H, t, 0, H / 2, -S.d / 2 + t / 2);
      wall(t, H, S.d - 2 * t, -S.w / 2 + t / 2, H / 2, 0);
      wall(t, H, S.d - 2 * t, S.w / 2 - t / 2, H / 2, 0);
      if (S.noGap || typeof houseWallWithOpenings !== 'function') wall(S.w, H, t, 0, H / 2, S.d / 2 - t / 2, front);
      else {
        const fw = houseWallWithOpenings(S.w, H, t, [{ x: S.door.x, w: S.door.w, y0: 0, y1: S.door.h }], mat);
        fw.position.z = S.d / 2 - t / 2;
        front.add(fw);
      }
      if (S.roofSlab) wall(S.w, 0.08, S.d, 0, H - 0.04, 0, roof);
      [...root.children].forEach(c => {
        if (c.userData && c.userData.interiorPart === 'front') front.add(c);
        if (c.userData && c.userData.interiorPart === 'roof') roof.add(c);
      });
      (parts.front || []).forEach(o => o && front.add(o));
      (parts.roof || []).forEach(o => o && roof.add(o));
      if (typeof mergeStaticMeshesSoon === 'function') { mergeStaticMeshesSoon(front); mergeStaticMeshesSoon(roof); }
      interiorRooms[key] = { key, root, front, roof, inside: null, parts: {} };
      // The furniture is solid (box obstacles, in world coordinates; the walls are the building's own box)
      if (typeof addObstacle === 'function' && typeof obstacleBox === 'function') {
        const o = root.position, k = Math.abs(root.scale.x) || 1;
        addObstacle(S.blocks.map(([name, x, z, hw, hd]) => obstacleBox(o.x + x * k, o.z + z * k, hw * k, hd * k, { interior: key, part: name })));
      }
    }

// --- The furnished rooms (built the first time he goes in) --------------------------------------
let interiorMats = null;
function interiorMaterials() {
      if (interiorMats) return interiorMats;
      const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
      const M = {
        oak: std(0x9a6a3e, { roughness: 0.7 }), walnut: std(0x4a2f1f, { roughness: 0.6 }), cream: std(0xf1e6cf, { roughness: 0.9 }),
        latte: std(0xc9a77c, { roughness: 0.85 }), slate: std(0x2a3340, { roughness: 0.8 }), vinyl: std(0x3b4350, { roughness: 0.7 }),
        sage: std(0xcfd8c8, { roughness: 0.9 }), tile: std(0xd8d2c4, { roughness: 0.5 }), steel: std(0xc7ccd1, { roughness: 0.3, metalness: 0.8 }),
        black: std(0x16181c, { roughness: 0.5 }), white: std(0xf8f8f4, { roughness: 0.35 }), red: std(0xb91c1c, { roughness: 0.5 }),
        kraft: std(0xb98a52, { roughness: 0.9 }), navy: std(0x1e3a8a, { roughness: 0.55 }), chalk: std(0x1f2a24, { roughness: 0.95 }),
        pastry: std(0xc98a3a, { roughness: 0.8 }), coffee: std(0x3b2414, { roughness: 0.3 }), fabric: std(0x334155, { roughness: 0.95 }),
        brassBox: std(0xb8934a, { roughness: 0.35, metalness: 0.85 }), cavity: std(0x0b0b0d, { roughness: 1 }),
        glassCase: new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false }),
        led: new THREE.MeshBasicMaterial({ color: 0x4ade80 }), ledBlue: new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
        screenOff: new THREE.MeshBasicMaterial({ color: 0x0b1626 }), glow: new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false })
      };
      if (typeof finishMaterial === 'function') {
        try { finishMaterial(M.oak, 'wood'); finishMaterial(M.walnut, 'wood'); finishMaterial(M.steel, 'brushed'); } catch (e) {}
      }
      interiorMats = M;
      return M;
    }

function intBox(parent, w, h, d, mat, x, y, z) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.receiveShadow = true;
      parent.add(m);
      return m;
    }

function intCyl(parent, rt, rb, h, mat, x, y, z, seg = 14) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
      m.position.set(x, y, z);
      m.receiveShadow = true;
      parent.add(m);
      return m;
    }

// A board with writing on it (menu, notices), drawn once on a canvas
function intBoard(parent, w, h, lines, opts = {}) {
      const c = document.createElement('canvas');
      c.width = 256; c.height = Math.round(256 * h / w);
      const g = c.getContext('2d');
      g.fillStyle = opts.bg || '#1f2a24';
      g.fillRect(0, 0, c.width, c.height);
      g.strokeStyle = opts.edge || '#8b5a2b';
      g.lineWidth = 8;
      g.strokeRect(4, 4, c.width - 8, c.height - 8);
      g.fillStyle = opts.fg || '#f8fafc';
      g.textBaseline = 'top';
      lines.forEach((l, i) => {
        g.font = i === 0 ? 'bold 22px sans-serif' : '15px sans-serif';
        if (i === 0) { g.textAlign = 'center'; g.fillText(l, c.width / 2, 12); } else {
          const [a, b] = String(l).split('|');
          g.textAlign = 'left'; g.fillText(a, 16, 30 + i * 20);
          if (b) { g.textAlign = 'right'; g.fillText(b, c.width - 16, 30 + i * 20); }
        }
      });
      const tex = new THREE.CanvasTexture(c);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: opts.glow || 0.15 }));
      m.userData.board = true;
      parent.add(m);
      return m;
    }

// Plain chair facing +z at (x, z) (rotY turns it), seat h above the floor
function intChair(parent, M, x, z, rotY, h, office, y = 0, q = 1) {
      const c = new THREE.Group();
      c.position.set(x, y, z);
      c.rotation.y = rotY;
      c.scale.set(q, 1, q);
      if (office) {
        intBox(c, 0.44, 0.07, 0.44, M.fabric, 0, h - 0.035, 0);
        intBox(c, 0.42, 0.5, 0.06, M.fabric, 0, h + 0.3, -0.22);
        intCyl(c, 0.03, 0.03, h - 0.1, M.black, 0, (h - 0.1) / 2 + 0.06, 0, 8);
        intBox(c, 0.5, 0.04, 0.06, M.black, 0, 0.05, 0);
        intBox(c, 0.06, 0.04, 0.5, M.black, 0, 0.05, 0);
      } else {
        intBox(c, 0.42, 0.04, 0.42, M.walnut, 0, h - 0.02, 0);
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => intBox(c, 0.035, h - 0.04, 0.035, M.walnut, a * 0.18, (h - 0.04) / 2, b * 0.18));
        intBox(c, 0.42, 0.45, 0.035, M.walnut, 0, h + 0.24, -0.19);
      }
      parent.add(c);
      return c;
    }

function intPlant(parent, M, x, z, F) {
      const K = typeof bldKit === 'function' ? bldKit() : null;
      intCyl(parent, 0.16, 0.12, 0.32, M.cream, x, F + 0.16, z, 12);
      for (let i = 0; i < 5; i++) {
        const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13 + (i % 2) * 0.04, 0), K ? K.leaf : M.oak);
        s.position.set(x + Math.cos(i * 1.3) * 0.09, F + 0.45 + i * 0.09, z + Math.sin(i * 1.3) * 0.09);
        parent.add(s);
      }
    }

// Lining for the inside of the walls (back, left, right) and a floor
function intRoomShell(g, S, F, floorMat, wallMat, trimMat) {
      const iw = S.w - 0.24, id = S.d - 0.24, H = S.H;
      intBox(g, iw, 0.02, id, floorMat, 0, F - 0.01, 0);
      intBox(g, iw, H - F - 0.02, 0.01, wallMat, 0, F + (H - F) / 2, -id / 2 - 0.004);
      intBox(g, 0.01, H - F - 0.02, id, wallMat, -iw / 2 - 0.004, F + (H - F) / 2, 0);
      intBox(g, 0.01, H - F - 0.02, id, wallMat, iw / 2 + 0.004, F + (H - F) / 2, 0);
      // skirting
      intBox(g, iw, 0.1, 0.02, trimMat, 0, F + 0.05, -id / 2 + 0.01);
      intBox(g, 0.02, 0.1, id, trimMat, -iw / 2 + 0.01, F + 0.05, 0);
      intBox(g, 0.02, 0.1, id, trimMat, iw / 2 - 0.01, F + 0.05, 0);
    }

// A window seen from inside: glass with a frame (z along the wall for side walls)
function intWindow(g, M, side, S, along, y, w, h) {
      const K = typeof bldKit === 'function' ? bldKit() : null, glass = K ? K.litGlass : M.ledBlue;
      const inX = S.w / 2 - 0.125, inZ = S.d / 2 - 0.125;
      if (side === 'back') {
        intBox(g, w, h, 0.01, glass, along, y, -inZ + 0.012);
        intBox(g, w + 0.12, 0.06, 0.05, M.white, along, y - h / 2 - 0.03, -inZ + 0.03);
      } else {
        const sx = side === 'left' ? -1 : 1;
        intBox(g, 0.01, h, w, glass, sx * (inX - 0.012), y, along);
        intBox(g, 0.05, 0.06, w + 0.12, M.white, sx * (inX - 0.03), y - h / 2 - 0.03, along);
      }
    }

// sh: the room's lining (floor, walls, windows) at the building's scale; g: the furniture, squashed
// in height by q (see interiorScale)
function buildCafeInside(room, S, sh, q) {
      const M = interiorMaterials(), F = S.floor, g = new THREE.Group();
      intRoomShell(sh, S, F, M.oak, M.cream, M.walnut);
      // wainscot round the room
      const iw = S.w - 0.24, id = S.d - 0.24;
      intBox(sh, iw, 0.85, 0.015, M.latte, 0, F + 0.43, -id / 2 + 0.01);
      intBox(sh, 0.015, 0.85, id, M.latte, -iw / 2 + 0.01, F + 0.43, 0);
      intBox(sh, 0.015, 0.85, id, M.latte, iw / 2 - 0.01, F + 0.43, 0);
      intWindow(sh, M, 'left', S, 0, 1.3, 0.75, 0.75);
      intWindow(sh, M, 'right', S, 0, 1.3, 0.75, 0.75);
      intWindow(sh, M, 'back', S, -0.8, 1.35, 0.7, 0.6);
      // The counter along the back wall: panelled walnut, a stone top, the espresso machine, a pastry case
      intBox(g, 2.0, 0.9, 0.52, M.walnut, 0.8, F + 0.45, -1.02);
      intBox(g, 2.06, 0.05, 0.6, M.tile, 0.8, F + 0.93, -1.01);
      for (let i = 0; i < 5; i++) intBox(g, 0.34, 0.6, 0.02, M.oak, -0.05 + i * 0.4, F + 0.45, -0.75);
      const eX = 1.35, eZ = -1.1, top = F + 0.955;
      intBox(g, 0.46, 0.36, 0.3, M.steel, eX, top + 0.18, eZ);
      intBox(g, 0.48, 0.04, 0.32, M.black, eX, top + 0.38, eZ);
      [-0.1, 0.1].forEach(dx => { intCyl(g, 0.04, 0.04, 0.06, M.black, eX + dx, top + 0.14, eZ + 0.17, 10); intCyl(g, 0.03, 0.025, 0.05, M.white, eX + dx, top + 0.03, eZ + 0.2, 10); });
      intBox(g, 0.4, 0.02, 0.12, M.black, eX, top + 0.01, eZ + 0.2);
      for (let i = 0; i < 3; i++) intCyl(g, 0.045, 0.035, 0.08, M.white, 1.7, top + 0.04 + i * 0.08, -0.95, 10);
      // Register
      intBox(g, 0.22, 0.1, 0.18, M.black, 0.75, top + 0.05, -1.12);
      const reg = intBox(g, 0.2, 0.12, 0.02, M.slate, 0.75, top + 0.16, -1.18);
      reg.rotation.x = -0.4;
      // Pastry case with pastries
      intBox(g, 0.52, 0.02, 0.36, M.white, 0.15, top + 0.01, -1.0);
      for (let i = 0; i < 4; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), M.pastry);
        p.scale.set(1.4, 0.6, 1);
        p.position.set(-0.02 + i * 0.11, top + 0.05, -1.0 + (i % 2) * 0.06);
        g.add(p);
      }
      const glassCase = intBox(g, 0.52, 0.3, 0.36, M.glassCase, 0.15, top + 0.17, -1.0);
      glassCase.renderOrder = 2;
      // Menu board over the counter
      const menu = intBoard(g, 1.3, 0.62, ['MENU', 'Espresso|2.50', 'Latte|4.00', 'Hazelnut croissant|3.25', 'Toasted bagel|2.75', 'Soup of the day|5.00', 'Peach pie|4.50'], { glow: 0.25 });
      menu.position.set(0.8, F + 1.72, -S.d / 2 + 0.135);
      // A shelf of mugs on the right wall
      intBox(g, 0.18, 0.03, 0.8, M.oak, S.w / 2 - 0.22, F + 1.45, -0.1);
      for (let i = 0; i < 4; i++) intCyl(g, 0.045, 0.045, 0.09, i % 2 ? M.red : M.white, S.w / 2 - 0.22, F + 1.51, -0.4 + i * 0.2, 10);
      // The table (a round cafe table, kept round), his chair and a second chair
      const T = S.table, tg = intUpright(g, q, T.x, F, T.z);
      intCyl(tg, 0.36, 0.36, 0.04, M.oak, 0, T.h - 0.02, 0, 24);
      intCyl(tg, 0.035, 0.035, T.h - 0.04, M.black, 0, (T.h - 0.04) / 2, 0, 8);
      intCyl(tg, 0.2, 0.22, 0.03, M.black, 0, 0.015, 0, 16);
      room.parts.table = tg;
      intChair(g, M, S.seat.x, S.seat.z, 0, S.seat.h, false, F, q);
      intChair(g, M, -0.6, 0.55, -Math.PI / 2, S.seat.h, false, F, q);
      // A pendant lamp over the table (hung from the ceiling, its shade at the table's scale)
      const K = typeof bldKit === 'function' ? bldKit() : null;
      const lampY = F + 1.25 * q;
      intCyl(sh, 0.006, 0.006, S.H - lampY, M.black, T.x, lampY + (S.H - lampY) / 2, T.z, 4);
      const lamp = new THREE.Group();
      lamp.position.set(T.x, lampY, T.z);
      lamp.scale.setScalar(q);
      sh.add(lamp);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.16, 14, 1, true), M.walnut);
      shade.material.side = THREE.DoubleSide;
      lamp.add(shade);
      if (K) {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), K.bulb);
        bulb.position.y = -0.07;
        lamp.add(bulb);
      }
      intPlant(g, M, -1.55, 1.05, F);
      return g;
    }

function buildNetNodeInside(room, S, sh, q) {
      const M = interiorMaterials(), F = S.floor, g = new THREE.Group();
      intRoomShell(sh, S, F, M.vinyl, M.slate, M.black);
      intWindow(sh, M, 'left', S, 0, 1.45, 0.9, 0.45);
      intWindow(sh, M, 'right', S, 0.5, 1.45, 0.9, 0.45);
      intWindow(sh, M, 'back', S, -0.5, 1.45, 1.2, 0.45);
      // a cyan LED strip along the top of the walls
      intBox(sh, S.w - 0.3, 0.03, 0.03, M.ledBlue, 0, S.H - 0.25, -S.d / 2 + 0.15);
      intBox(sh, 0.03, 0.03, S.d - 0.3, M.ledBlue, -S.w / 2 + 0.15, S.H - 0.25, 0);
      room.parts.screens = [];
      // Two computer desks along the left wall, each with a monitor, keyboard, mouse and tower
      // (the computer itself is kept in proportion, set from x0 on the desk)
      const x0 = -1.55;
      [-0.75, 0.55].forEach((dz, i) => {
        intBox(g, 0.6, 0.04, 1.0, M.white, -1.7, F + 0.8, dz);
        [-0.48, 0.48].forEach(s => intBox(g, 0.56, 0.78, 0.03, M.black, -1.7, F + 0.39, dz + s));
        intBox(g, 0.03, 0.5, 0.94, M.black, -1.97, F + 0.53, dz);
        const pc = intUpright(g, q, x0, F, dz);
        intBox(pc, 0.12, 0.02, 0.22, M.black, -0.31, 0.83, 0);
        intBox(pc, 0.04, 0.3, 0.05, M.black, -0.33, 0.97, 0);
        intBox(pc, 0.04, 0.42, 0.68, M.black, -0.31, 1.2, 0);
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.37), M.screenOff);
        screen.rotation.y = Math.PI / 2;
        screen.position.set(-0.285, 1.21, 0);
        screen.userData.screen = i;
        pc.add(screen);
        room.parts.screens.push(screen);
        intBox(pc, 0.17, 0.02, 0.44, M.slate, 0.12, 0.83, 0);
        intBox(pc, 0.08, 0.02, 0.05, M.slate, 0.12, 0.83, 0.32);
        intBox(g, 0.42, 0.42, 0.2, M.slate, -1.75, F + 0.21, dz - 0.25);
        intBox(g, 0.01, 0.02, 0.02, M.led, -1.535, F + 0.36, dz - 0.25);
        intChair(g, M, S.seat.x, dz, Math.PI / 2, S.seat.h, true, F, q);
      });
      // A soft glow on the wall behind his screen (shown while it is on)
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), M.glow.clone());
      glow.rotation.y = Math.PI / 2;
      glow.position.set(-S.w / 2 + 0.135, F + 1.25, S.screen.z);
      glow.userData.glow = true;
      g.add(glow);
      room.parts.glow = glow;
      // Printer table, server rack with blinking lights, a vending machine
      intBox(g, 0.9, 0.04, 0.42, M.white, 0.1, F + 0.73, -1.19);
      [-0.3, 0.5].forEach(x => intBox(g, 0.04, 0.71, 0.04, M.black, x, F + 0.355, -1.19));
      intBox(g, 0.5, 0.24, 0.36, M.white, 0.1, F + 0.87, -1.2);
      intBox(g, 0.36, 0.02, 0.1, M.black, 0.1, F + 0.99, -1.07);
      intBox(g, 0.6, 1.9, 0.5, M.black, 1.05, F + 0.95, -1.15);
      const leds = new THREE.Group();
      leds.userData.leds = true;
      for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) intBox(leds, 0.03, 0.02, 0.01, (r + c) % 3 ? M.led : M.ledBlue, 0.85 + c * 0.1, F + 0.35 + r * 0.2, -0.895);
      g.add(leds);
      room.parts.leds = leds;
      intBox(g, 0.5, 1.9, 0.7, M.red, 1.75, F + 0.95, -0.3);
      intBox(g, 0.01, 1.1, 0.5, M.ledBlue, 1.495, F + 1.2, -0.35);
      for (let r = 0; r < 4; r++) intBox(g, 0.02, 0.02, 0.46, M.white, 1.49, F + 0.8 + r * 0.26, -0.35);
      intBox(g, 0.01, 0.3, 0.12, M.black, 1.495, F + 1.0, 0.0);
      // Wi-Fi notice on the back wall
      const notice = intBoard(g, 0.7, 0.4, ['FREE WI-FI', 'Network|NETNODE', 'Password|kelo1'], { bg: '#0f172a', fg: '#22d3ee', edge: '#22d3ee', glow: 0.5 });
      notice.position.set(-0.5, F + 1.95, -S.d / 2 + 0.135);
      return g;
    }

function buildPostOfficeInside(room, S, sh, q) {
      const M = interiorMaterials(), F = S.floor, g = new THREE.Group();
      // A checkerboard tile floor (one small canvas, repeated)
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const cg = c.getContext('2d');
      cg.fillStyle = '#e7e2d6'; cg.fillRect(0, 0, 64, 64);
      cg.fillStyle = '#3f4a5a'; cg.fillRect(0, 0, 32, 32); cg.fillRect(32, 32, 32, 32);
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(5, 4);
      const floorMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 });
      intRoomShell(sh, S, F, floorMat, M.sage, M.walnut);
      const iw = S.w - 0.24, id = S.d - 0.24;
      intBox(sh, iw, 0.8, 0.015, M.walnut, 0, F + 0.4, -id / 2 + 0.01);
      intBox(sh, 0.015, 0.8, id, M.walnut, iw / 2 - 0.01, F + 0.4, 0);
      intWindow(sh, M, 'right', S, -0.7, 1.45, 0.7, 0.8);
      intWindow(sh, M, 'right', S, 0.7, 1.45, 0.7, 0.8);
      intWindow(sh, M, 'back', S, 0, 1.6, 0.8, 0.6);
      // The wall of PO boxes (left wall): 6 across, 5 high, brass doors with little windows
      const B = S.box, cabX = -S.w / 2 + 0.12 + 0.14, z0 = -1.38, pitch = 0.36;
      intBox(g, 0.28, 2.02, 2.24, M.walnut, cabX, F + 1.01, -0.3);
      intBox(g, 0.32, 0.08, 2.3, M.walnut, cabX + 0.02, F + 2.06, -0.3);
      for (let r = 0; r < 5; r++) for (let col = 0; col < 6; col++) {
        const y = F + 0.48 + r * pitch, z = z0 + 0.18 + col * pitch;
        if (r === 2 && col === 3) continue; // his own box, made below so it can open
        intBox(g, 0.02, 0.3, 0.3, M.brassBox, cabX + 0.15, y, z);
        intBox(g, 0.01, 0.07, 0.15, M.cavity, cabX + 0.162, y + 0.06, z);
        intBox(g, 0.02, 0.03, 0.03, M.black, cabX + 0.17, y - 0.06, z + 0.09);
      }
      // His box: a dark opening behind a door that swings on its hinge
      const y = F + 0.48 + 2 * pitch, z = z0 + 0.18 + 3 * pitch;
      intBox(g, 0.01, 0.3, 0.3, M.cavity, cabX + 0.142, y, z);
      const hinge = new THREE.Group();
      hinge.position.set(cabX + 0.15, y, z + 0.15);
      hinge.userData.hinge = true;
      intBox(hinge, 0.02, 0.3, 0.3, M.brassBox, 0, 0, -0.15);
      intBox(hinge, 0.01, 0.07, 0.15, M.cavity, 0.012, 0.06, -0.15);
      intBox(hinge, 0.02, 0.03, 0.03, M.black, 0.02, -0.06, -0.24);
      g.add(hinge);
      const tag = intBoard(g, 0.26, 0.06, ['KELO-1'], { bg: '#f8fafc', fg: '#b91c1c', edge: '#b91c1c', glow: 0.2 });
      tag.rotation.y = Math.PI / 2;
      tag.position.set(cabX + 0.165, y + 0.2, z);
      room.parts.door = hinge;
      room.parts.boxAt = { x: cabX + 0.02, y, z };
      // The service counter along the back wall, with a scale, a bell and parcels behind it
      intBox(g, 2.35, 0.95, 0.5, M.walnut, 0.775, F + 0.475, -1.23);
      intBox(g, 2.4, 0.05, 0.56, M.tile, 0.775, F + 0.97, -1.22);
      intBox(g, 2.35, 0.08, 0.02, M.brassBox, 0.775, F + 0.8, -0.975);
      intBox(g, 0.3, 0.04, 0.24, M.steel, 0.1, F + 1.02, -1.2);
      intBox(g, 0.12, 0.08, 0.1, M.black, 0.1, F + 0.98, -1.06);
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.brassBox);
      bell.position.set(0.55, F + 0.995, -1.08);
      g.add(bell);
      [[1.2, 0.3], [1.5, 0.22], [1.75, 0.34]].forEach(([x, s]) => intBox(g, s, s * 0.8, s, M.kraft, x, F + 0.995 + s * 0.4, -1.25));
      const sign = intBoard(g, 1.1, 0.32, ['POSTAL SERVICE', 'Letters|Parcels'], { bg: '#f8fafc', fg: '#1e3a8a', edge: '#b91c1c', glow: 0.2 });
      sign.position.set(0.9, F + 2.0, -S.d / 2 + 0.135);
      // A parcel shelf on the right wall
      intBox(g, 0.3, 0.9, 1.5, M.oak, S.w / 2 - 0.27, F + 0.45, 0.15);
      [[-0.3, 0.26], [0.1, 0.2], [0.45, 0.3]].forEach(([dz, s]) => intBox(g, s, s * 0.7, s, M.kraft, S.w / 2 - 0.27, F + 0.9 + s * 0.35, 0.15 + dz));
      return g;
    }

function interiorBuildInside(key) {
      const room = interiorRooms[key], S = INTERIOR_SPECS[key];
      if (!room) return null;
      if (room.inside) return room.inside;
      const q = interiorFurnScale() / interiorScale(key);
      const sh = new THREE.Group();
      const f = key === 'cafe' ? buildCafeInside(room, S, sh, q) : key === 'cyber' ? buildNetNodeInside(room, S, sh, q) : buildPostOfficeInside(room, S, sh, q);
      // The furniture: squashed in height so it comes out at furniture size (the floor stays put)
      f.scale.set(1, q, 1);
      f.position.y = S.floor * (1 - q);
      f.children.forEach(o => { if (o.userData && o.userData.board) o.scale.y /= q; }); // signs keep their shape
      room.furniture = f;
      const g = new THREE.Group();
      g.add(sh, f);
      g.userData.interiorPart = 'inside';
      g.visible = false;
      room.root.add(g);
      // The fixed furniture becomes one mesh per material (screens, the box door and lights stay apart)
      try { if (typeof mergeStaticMeshes === 'function') mergeStaticMeshes(g); } catch (e) { console.warn('interior merge', e); }
      room.inside = g;
      return g;
    }

// Show the inside (front wall and roof hidden) or the closed building
function interiorShow(key, open) {
      const room = interiorRooms[key];
      if (!room) return;
      if (open) interiorBuildInside(key);
      if (room.inside) room.inside.visible = open;
      room.front.visible = !open;
      room.roof.visible = !open;
    }

// --- The NetNode screen: a search page he types into ------------------------------------------
function interiorScreen(room) {
      if (room.parts.screenOn) return room.parts.screenOn;
      const c = document.createElement('canvas');
      c.width = 320; c.height = 192;
      const tex = new THREE.CanvasTexture(c);
      const mat = new THREE.MeshBasicMaterial({ map: tex });
      room.parts.screenOn = { c, tex, mat, typed: 0, query: '', drawnAt: 0, lastKey: '' };
      return room.parts.screenOn;
    }

function interiorDrawScreen(scr, t) {
      const g = scr.c.getContext('2d'), W = scr.c.width, Hh = scr.c.height;
      const shown = scr.query.slice(0, scr.typed);
      const done = scr.typed >= scr.query.length;
      const key = shown + (done ? 'r' + Math.floor(t / 1.6) % 4 : '|' + (Math.floor(t * 2) % 2));
      if (key === scr.lastKey) return;
      scr.lastKey = key;
      g.fillStyle = '#f8fafc'; g.fillRect(0, 0, W, Hh);
      g.fillStyle = '#1e293b'; g.fillRect(0, 0, W, 18);
      ['#f87171', '#fbbf24', '#4ade80'].forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(10 + i * 12, 9, 4, 0, Math.PI * 2); g.fill(); });
      g.fillStyle = '#334155'; g.fillRect(52, 4, W - 60, 10);
      g.fillStyle = '#0891b2'; g.font = 'bold 18px sans-serif'; g.textBaseline = 'top';
      g.fillText('NetNode Search', 14, 26);
      g.strokeStyle = '#0891b2'; g.lineWidth = 2; g.strokeRect(14, 50, W - 28, 24);
      g.fillStyle = '#0f172a'; g.font = '14px sans-serif';
      let text = shown;
      while (g.measureText(text).width > W - 44 && text.length > 1) text = text.slice(1);
      g.fillText(text + (!done && Math.floor(t * 2) % 2 ? '|' : ''), 20, 55);
      if (done) {
        const n = 1 + Math.floor(t / 1.6) % 4;
        for (let i = 0; i < n; i++) {
          g.fillStyle = '#1d4ed8'; g.fillRect(14, 86 + i * 26, 120 + (i * 37) % 90, 7);
          g.fillStyle = '#94a3b8'; g.fillRect(14, 97 + i * 26, W - 40 - (i * 23) % 60, 5);
        }
      }
      scr.tex.needsUpdate = true;
    }

// --- Poses (run every frame by updateIndoorTrip while he isn't walking) -------------------------
function interiorSitLegs() {
      keloSitPose(0, 1.35);
      keloBody.rotation.x = 0.06;
    }

function interiorTypingPose(t) {
      interiorSitLegs();
      const burst = Math.sin(t * 1.3) > -0.3;
      keloLeftArm.rotation.set(-0.75 + (burst ? Math.sin(t * 15) * 0.05 : 0), 0, 0.1);
      keloRightArm.rotation.set(burst ? -0.75 + Math.cos(t * 15) * 0.05 : -0.6, 0, -0.1);
      keloLeftElbow.rotation.x = burst ? -0.85 : -0.7;
      keloRightElbow.rotation.x = burst ? -0.85 : -1.9;
      keloLeftHand.userData.grip = burst ? 0.2 + 0.25 * Math.max(0, Math.sin(t * 22)) : 0.4;
      keloRightHand.userData.grip = burst ? 0.2 + 0.25 * Math.max(0, Math.cos(t * 22)) : 0.6;
      keloHead.rotation.x = 0.05;
      keloHead.rotation.y = Math.sin(t * 0.7) * 0.12;
    }

function interiorEatPose(t) {
      interiorSitLegs();
      const k = 0.5 - 0.5 * Math.cos(t * 2.6); // hand up to his mouth and back down to the plate
      keloRightArm.rotation.set(-0.55 - 0.55 * k, 0, -0.15 - 0.25 * k);
      keloRightElbow.rotation.x = -0.6 - 1.4 * k;
      keloRightHand.userData.grip = 0.7;
      keloLeftArm.rotation.set(-0.5, 0, 0.12);
      keloLeftElbow.rotation.x = -0.9;
      keloHead.rotation.x = 0.18 - 0.2 * k;
    }

function interiorRestSitPose(t) {
      interiorSitLegs();
      keloLeftArm.rotation.set(-0.5, 0, 0.12);
      keloRightArm.rotation.set(-0.5, 0, -0.12);
      keloLeftElbow.rotation.x = keloRightElbow.rotation.x = -0.9;
      keloHead.rotation.y = Math.sin(t * 0.4) * 0.35;
    }

function interiorWavePose(t) {
      keloRightArm.rotation.set(-2.5, 0, -0.2);
      keloRightElbow.rotation.x = -0.3 + Math.sin(t * 9) * 0.25;
      keloHead.rotation.x = -0.15;
    }

// --- Where things are -------------------------------------------------------------------------
function interiorKeyForTarget(p) {
      if (!p) return null;
      for (const key of Object.keys(INTERIOR_SPECS)) {
        const pin = TOWN_LOCATIONS[key];
        if (pin && interiorRooms[key] && Math.hypot(p.x - pin.x, p.z - pin.z) < 0.35) return key;
      }
      return null;
    }

function interiorSite(key) {
      const room = interiorRooms[key], S = INTERIOR_SPECS[key];
      return { key: 'interior-' + key, name: S.name, group: room.root, w: S.w, d: S.d, camDist: S.camDist * Math.max(1, interiorScale(key) * 0.75), cutFlat: 4, floorY: S.floor };
    }

// A building-local point as a world point (on the floor unless y is given)
function interiorPoint(key, p) {
      const room = interiorRooms[key], S = INTERIOR_SPECS[key], o = room.root.position, k = interiorScale(key);
      const x = o.x + p.x * k, z = o.z + p.z * k;
      const y = p.ground ? getIslandGroundHeight(x, z) : o.y + (p.y !== undefined ? p.y : S.floor) * k;
      return { x, y, z };
    }

// A height in the furniture's coordinates (floor plus y) as a world height
function interiorFurnY(key, y) {
      const room = interiorRooms[key], S = INTERIOR_SPECS[key];
      return room.root.position.y + S.floor * interiorScale(key) + (y - S.floor) * interiorFurnScale();
    }

function interiorAnyBusy(flags) {
      return flags.some(f => state[f]);
    }

// --- The visit ---------------------------------------------------------------------------------
function interiorCanStart(key) {
      const pin = TOWN_LOCATIONS[key];
      if (!interiorRooms[key] || !pin || !keloGroup || typeof indoorTrip === 'undefined') return false;
      if (indoorTrip.active || state.riding || state.isSleeping || state.basementDepth) return false;
      return Math.hypot(state.botPos.x - pin.x, state.botPos.z - pin.z) < 1.6;
    }

// The visit at this building (started now if he is at its door), or null
function interiorEnsureVisit(key) {
      const v = interiorVisitNow;
      if (v) return v.key === key && !v.leaving ? v : null;
      if (!interiorCanStart(key)) return null;
      return interiorStartVisit(key);
    }

function interiorStartVisit(key) {
      let ready;
      const v = { key, startedAt: Date.now(), readyAt: 0, leaving: false, flags: INTERIOR_BUSY_FLAGS.filter(f => state[f]), freeSince: 0, temps: [] };
      v.ready = new Promise(r => { ready = r; });
      v.setReady = ok => { if (ready) { ready(ok); ready = null; } };
      interiorVisitNow = v;
      v.done = interiorRunVisit(v).catch(e => console.warn('interior visit', e));
      return v;
    }

function interiorAwaitReady(v, ms = 120000) {
      return Promise.race([v.ready, new Promise(r => setTimeout(() => r(false), ms))]);
    }

function interiorShouldLeave(v) {
      const pin = TOWN_LOCATIONS[v.key], tp = state.targetPos;
      if (!tp || Math.hypot(tp.x - pin.x, tp.z - pin.z) > 0.35) return true;
      if (state.riding || state.isSleeping) return true;
      if (Date.now() - v.startedAt > 25 * 60000) return true;
      // Anything that keeps him busy while he is in here is what he came for
      INTERIOR_BUSY_FLAGS.forEach(f => { if (state[f] && !v.flags.includes(f)) v.flags.push(f); });
      if (v.flags.length) {
        if (interiorAnyBusy(v.flags)) { v.freeSince = 0; return false; }
        if (!v.freeSince) v.freeSince = Date.now();
        return Date.now() - v.freeSince > 1500;
      }
      return Date.now() - v.readyAt > 30000;
    }

// Sit down on a seat {x, z, rotY, h} (building-local)
function interiorSit(key, seat, pose) {
      const p = interiorPoint(key, seat);
      indoorTrip.pos.x = p.x;
      indoorTrip.pos.z = p.z;
      indoorTrip.pos.y = p.y + seat.h * interiorFurnScale() - (KELO_LEG_Y - KELO_THIGH_R);
      indoorTrip.rotY = seat.rotY;
      indoorTrip.crouchTarget = 0;
      indoorTrip.pose = pose;
    }

function interiorStand(key, at) {
      const p = interiorPoint(key, at);
      indoorTrip.pose = null;
      indoorTrip.pos.x = p.x;
      indoorTrip.pos.y = p.y;
      indoorTrip.pos.z = p.z;
    }

function interiorWalk(key, pts) {
      return tripWalk(pts.map(p => interiorPoint(key, p)));
    }

async function interiorRunVisit(v) {
      const key = v.key, S = INTERIOR_SPECS[key], room = interiorRooms[key], pin = TOWN_LOCATIONS[key];
      const outside = { x: pin.x, y: getIslandGroundHeight(pin.x, pin.z), z: pin.z };
      const hub = S.walkIn[S.walkIn.length - 1];
      let back = [];
      try {
        Object.assign(indoorTrip, {
          active: true, site: interiorSite(key), pos: { x: state.botPos.x, y: getIslandGroundHeight(state.botPos.x, state.botPos.z), z: state.botPos.z },
          rotY: state.botRotY, path: null, pose: null, crouch: 0, crouchTarget: 0, lastT: null, cutLevel: 0
        });
        interiorShow(key, true);
        await interiorWalk(key, S.walkIn);
        if (key === 'cyber') back = await interiorAtComputer(v, S, room);
        else if (key === 'cafe') back = await interiorAtCafe(v, S, room);
        else back = await interiorAtMailbox(v, S, room);
        v.readyAt = Date.now();
        v.setReady(true);
        while (!interiorShouldLeave(v)) {
          await tripPause(150);
          if (v.tick) v.tick(performance.now() / 1000);
        }
        v.leaving = true;
        if (v.finish) await v.finish();
        await interiorWalk(key, [...back, hub, ...S.walkIn.slice(0, -1).reverse()]);
        await tripWalk([outside]);
      } finally {
        v.leaving = true;
        v.setReady(false);
        try { if (v.cleanup) v.cleanup(); } catch (e) { console.warn('interior cleanup', e); }
        v.temps.forEach(o => { if (o.parent) o.parent.remove(o); if (typeof disposeTree === "function") disposeTree(o); });
        indoorTrip.path = null;
        const hold = indoorTrip.resolve;
        indoorTrip.resolve = null;
        if (hold) hold();
        indoorTrip.active = false;
        indoorTrip.site = null;
        indoorTrip.pose = null;
        indoorTrip.crouch = 0;
        state.basementDepth = 0;
        state.botPos = { x: outside.x, z: outside.z };
        interiorShow(key, false);
        interiorLastExit = { x: state.targetPos.x, z: state.targetPos.z };
        interiorVisitNow = null;
      }
    }

// NetNode: sit at the computer, the screen comes on and he types what he is looking up
async function interiorAtComputer(v, S, room) {
      const seat = S.seat;
      await interiorWalk('cyber', seat.via);
      interiorSit('cyber', seat, t => interiorTypingPose(t));
      const scr = interiorScreen(room);
      const screen = room.parts.screens[1];
      screen.material = scr.mat;
      room.parts.glow.material.opacity = 0.22;
      const queryNow = () => {
        const quoted = String(state.speechBubble || '').match(/"([^"]{2,60})"/);
        const title = String(state.moodTitle || '');
        if (/^(Looking up|Reading about|Researching|Reading how to)/i.test(title) || !quoted) return title.replace(/^(Looking up|Reading about|Researching|Reading how to)[:\s]*/i, '').slice(0, 60);
        return quoted[1];
      };
      scr.query = queryNow(); scr.typed = 0;
      let lastType = 0;
      v.tick = t => {
        const q = queryNow();
        if (q !== scr.query) { scr.query = q; scr.typed = 0; }
        if (scr.typed < scr.query.length && t - lastType > 0.12) { scr.typed++; lastType = t; }
        interiorDrawScreen(scr, t);
        if (room.parts.leds) room.parts.leds.visible = Math.floor(t * 3) % 4 !== 0;
      };
      v.tick(performance.now() / 1000);
      await tripPause(700);
      v.finish = async () => {
        indoorTrip.pose = t => interiorRestSitPose(t);
        await tripPause(400);
        screen.material = interiorMaterials().screenOff;
        room.parts.glow.material.opacity = 0;
        interiorStand('cyber', seat.via[seat.via.length - 1]);
      };
      v.cleanup = () => {
        screen.material = interiorMaterials().screenOff;
        room.parts.glow.material.opacity = 0;
        if (room.parts.leds) room.parts.leds.visible = true;
      };
      return seat.via.slice().reverse();
    }

// The cafe: order at the counter (when he came to eat), then sit at the table
async function interiorAtCafe(v, S, room) {
      const eating = state.customPlaceName === TOWN_LOCATIONS.cafe.building && interiorAnyBusy(['isPracticing']);
      const food = eating ? String(state.moodTitle || '').replace(/^(Eating|Curious about)\s+/i, '').trim() : '';
      if (eating) {
        await interiorWalk('cafe', [S.order]);
        tripFace(interiorPoint('cafe', S.order.face));
        const pretty = food ? food.replace(/^an? /i, '') : 'something good';
        tripMood(`Ordering ${pretty}`.slice(0, 80), `Hi! Could I have ${food || 'something to eat'}, please? And a coffee.`);
        indoorTrip.pose = t => interiorWavePose(t);
        await tripPause(1400);
        indoorTrip.pose = null;
        await tripPause(900);
      }
      const seat = S.seat;
      await interiorWalk('cafe', seat.via);
      interiorSit('cafe', seat, t => (v.food ? interiorEatPose(t) : interiorRestSitPose(t)));
      if (eating) {
        // A plate and a cup of coffee on the table in front of him
        const M = interiorMaterials(), T = S.table, top = T.h;
        const set = new THREE.Group();
        set.userData.tableSet = true;
        intCyl(set, 0.15, 0.12, 0.02, M.white, 0, top + 0.01, -0.12, 20);
        intCyl(set, 0.09, 0.09, 0.012, M.white, 0.2, top + 0.006, 0.05, 16);
        intCyl(set, 0.05, 0.04, 0.1, M.white, 0.2, top + 0.06, 0.05, 14);
        intCyl(set, 0.045, 0.045, 0.004, M.coffee, 0.2, top + 0.108, 0.05, 14);
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12), M.white);
        handle.position.set(0.26, top + 0.06, 0.05);
        set.add(handle);
        // (set on the table's own group, which is at furniture size)
        const table = room.parts.table || room.root;
        table.add(set);
        v.temps.push(set);
        table.updateMatrixWorld(true);
        v.plateTop = table.localToWorld(new THREE.Vector3(0, top + 0.03, -0.12));
      }
      // What he ordered arrives in his hands (js/needs.js eatSomething): it goes on the plate and he eats it
      // (setCarriedObject is wrapped below to hand it here)
      v.serve = f => {
          if (f.parent) f.parent.remove(f);
          if (f.scale.x === 1 && typeof lifeSize === 'function') lifeSize(f, 1.4);
          f.traverse(o => { if (o.userData && o.userData.isLabel) o.visible = false; });
          const size = typeof maxSizeOf === 'function' ? maxSizeOf(f) : 0.3;
          f.scale.multiplyScalar(Math.min(1, 0.3 / size));
          f.position.set(v.plateTop.x, v.plateTop.y, v.plateTop.z);
          f.rotation.set(0, 0, 0);
          scene.add(f); // (in the world, at its own size)
          v.temps.push(f);
          v.food = f;
          v.foodScale = f.scale.x;
          v.bites = 0;
          v.lastBite = performance.now();
      };
      v.tick = () => {
        if (v.food && performance.now() - v.lastBite > 1300 && v.bites < 5) {
          v.bites++;
          v.lastBite = performance.now();
          v.food.scale.setScalar(v.foodScale * (1 - v.bites * 0.15));
        }
      };
      await tripPause(500);
      v.finish = async () => {
        if (v.food) v.food.visible = false;
        indoorTrip.pose = t => interiorRestSitPose(t);
        await tripPause(500);
        interiorStand('cafe', seat.via[seat.via.length - 1]);
      };
      return seat.via.slice().reverse();
    }

// The Post Office: open his own box and take out what is in it
async function interiorAtMailbox(v, S, room) {
      const B = S.box, door = room.parts.door, at = room.parts.boxAt;
      await interiorWalk('post_office', [...B.via, B]);
      tripFace(interiorPoint('post_office', B.face));
      const swing = async (to, ms) => {
        const from = door.rotation.y, start = Date.now();
        for (;;) {
          const k = smoothstep(Math.min(1, (Date.now() - start) / ms));
          door.rotation.y = from + (to - from) * k;
          if (k >= 1) return;
          await tripPause(30);
        }
      };
      const boxY = interiorFurnY('post_office', at.y);
      indoorTrip.pose = () => reachPose(boxY - indoorTrip.pos.y);
      await tripPause(500);
      await swing(-1.75, 650);
      const mail = (state.mailbox || [])[0];
      if (mail) {
        // A letter or a little parcel waiting in the box (the real thing is on the pick-up table outside)
        const M = interiorMaterials();
        const fg = room.furniture || room.root;
        const item = mail.kind === 'message' ? intBox(fg, 0.02, 0.14, 0.2, M.white, at.x, at.y, at.z) : intBox(fg, 0.16, 0.13, 0.18, M.kraft, at.x, at.y - 0.06, at.z);
        v.temps.push(item);
        await tripPause(500);
        if (typeof handsWorldPosition === 'function') {
          const from = item.position.clone(), to = (room.furniture || room.root).worldToLocal(handsWorldPosition());
          const start = Date.now();
          for (;;) {
            const k = smoothstep(Math.min(1, (Date.now() - start) / 600));
            item.position.lerpVectors(from, to, k);
            if (k >= 1) break;
            await tripPause(30);
          }
        }
        item.visible = false;
      } else {
        tripMood('Checking my PO box', 'Nothing in my box right now.');
        await tripPause(900);
      }
      indoorTrip.pose = null;
      v.finish = async () => {
        tripFace(interiorPoint('post_office', B.face));
        indoorTrip.pose = () => reachPose(boxY - indoorTrip.pos.y);
        await tripPause(300);
        await swing(0, 450);
        indoorTrip.pose = null;
      };
      v.cleanup = () => { door.rotation.y = 0; };
      return [B, ...B.via.slice().reverse()];
    }

// --- Hooks into the existing trips ---------------------------------------------------------------
// Arriving at one of these doors means going in: the wait ends once he is seated (or at his box),
// so whatever the trip does next happens inside
const interiorBaseWait = typeof waitForArrival === 'function' ? waitForArrival : null;
if (interiorBaseWait) {
  waitForArrival = async function (timeoutMs = 15000) {
    const key = interiorKeyForTarget(state.targetPos);
    if (!key) return interiorBaseWait(timeoutMs);
    interiorLastExit = null;
    try {
      let v = interiorVisitNow;
      if (v && v.key === key && !v.leaving) { await interiorAwaitReady(v); return; }
      if (v && v.leaving) await Promise.race([v.done, tripPause(20000)]);
      // (his mail run used to give up after 15 s on the way; he finishes the walk and goes in)
      const ms = key === 'post_office' ? Math.max(timeoutMs, 45000) : timeoutMs, until = Date.now() + ms;
      await interiorBaseWait(ms);
      // (arriving counts at the edge of the pin; he goes in once he is at the door)
      while (!(v = interiorEnsureVisit(key)) && Date.now() < until && interiorKeyForTarget(state.targetPos) === key) await tripPause(250);
      if (v) await interiorAwaitReady(v);
    } catch (e) {
      console.warn('interior wait', e);
    }
  };
}

// While he sits at the cafe table, food handed to him goes onto his plate instead of into his hands
const interiorBaseCarry = typeof setCarriedObject === 'function' ? setCarriedObject : null;
if (interiorBaseCarry) {
  setCarriedObject = function (object3d, holdMs) {
    const v = interiorVisitNow;
    if (object3d && v && v.serve && v.plateTop && !v.food && !v.leaving && v.readyAt) {
      try { v.serve(object3d); return; } catch (e) { console.warn('interior serve', e); }
    }
    return interiorBaseCarry(object3d, holdMs);
  };
}

const interiorBaseDirect = typeof directKeloToActivity === 'function' ? directKeloToActivity : null;
if (interiorBaseDirect) {
  directKeloToActivity = function (locKey, ...rest) {
    if (INTERIOR_SPECS[locKey]) interiorLastExit = null;
    return interiorBaseDirect(locKey, ...rest);
  };
}

// Every quarter second: he has walked up to one of these doors with it as his target, so he goes in
function interiorWatch() {
      try {
        if (interiorVisitNow || !keloGroup) return;
        const key = interiorKeyForTarget(state.targetPos);
        if (!key) { interiorLastExit = null; return; }
        if (interiorLastExit && Math.hypot(interiorLastExit.x - state.targetPos.x, interiorLastExit.z - state.targetPos.z) < 0.05) return;
        if (interiorCanStart(key)) interiorStartVisit(key);
      } catch (e) { console.warn('interior watch', e); }
    }

// After a reload mid-visit he is back out at the door (never stuck inside the walls), and he only
// goes in again when something sends him there
function interiorAfterLoad() {
      Object.keys(INTERIOR_SPECS).forEach(key => {
        const room = interiorRooms[key], S = INTERIOR_SPECS[key], pin = TOWN_LOCATIONS[key];
        if (!room || !pin || !state.botPos) return;
        const o = room.root.position, k = interiorScale(key);
        if (Math.abs(state.botPos.x - o.x) < S.w * k / 2 + 0.1 && Math.abs(state.botPos.z - o.z) < S.d * k / 2 + 0.1) {
          state.botPos = { x: pin.x, z: pin.z };
          state.targetPos = { x: pin.x, z: pin.z };
        }
      });
      if (state.targetPos) interiorLastExit = { x: state.targetPos.x, z: state.targetPos.z };
    }

window.addEventListener('DOMContentLoaded', () => {
  // After scene.js has built the town (its own DOMContentLoaded handler runs first)
  setTimeout(() => {
    try { interiorAfterLoad(); } catch (e) { console.warn('interior load', e); }
    setInterval(interiorWatch, 250);
  }, 0);
});
