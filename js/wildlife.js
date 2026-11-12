// Kelo-bot-1 — js/wildlife.js
// Loaded after wishfeatures.js. The "wildlife" feature: small flocks of real Okanagan songbirds that
// fly together, perch on the valley trees and land to peck in the meadow, and a few mule deer that
// graze and wander in the West Meadow and the valley beyond, and bound away if Kelo-1 comes at them
// too fast. He can study them: walk out, creep up quietly, crouch, watch and take notes (facts from
// Wikipedia when the NetNode lookup is there, a built-in fact otherwise).
// Everything is low-poly and merged into a few meshes per animal. Far animals stop animating
// (LOD) and very far ones are hidden. It only uses the terrain helpers and worldObstacles.

const WILD_BIRD_SPECIES = [
  { name: 'American robin', wiki: 'American robin', back: 0x5d5752, belly: 0xd8662a, head: 0x2a2523, beak: 0xe3b23c, size: 1.0,
    fact: 'The American robin is a thrush, not a true robin: settlers named it after the orange-breasted European robin. It hunts earthworms by sight, tilting its head to look at the ground, and it is one of the first birds to sing at dawn.' },
  { name: 'Black-capped chickadee', wiki: 'Black-capped chickadee', back: 0x8e9295, belly: 0xefe8da, head: 0x151515, cheek: 0xffffff, beak: 0x2a2a2a, size: 0.75,
    fact: 'The black-capped chickadee is named for its "chick-a-dee-dee-dee" call, and it adds more "dee" notes when the danger is bigger. It hides seeds in thousands of places and remembers where they are.' },
  { name: "Steller's jay", wiki: "Steller's jay", back: 0x1f4f9e, belly: 0x2f63b8, head: 0x1b1c26, beak: 0x111111, crest: true, size: 1.15,
    fact: "Steller's jay is the crested blue jay of western mountain forests. It can imitate the scream of a red-tailed hawk, and it is named after Georg Steller, the naturalist who first described it in Alaska in 1741." },
  { name: 'Western meadowlark', wiki: 'Western meadowlark', back: 0x8a6b40, belly: 0xf1c418, head: 0x6a5434, beak: 0x9b9384, bib: true, size: 1.0,
    fact: 'The western meadowlark is not a lark at all but a member of the blackbird family. It has a bright yellow breast with a black V, and its flute-like song carries a long way over open grassland.' }
];
const WILD_DEER_INFO = { name: 'mule deer', wiki: 'Mule deer',
  fact: 'Mule deer are named for their big, mule-like ears, which turn separately to catch sounds. When startled they bound away with all four hooves leaving the ground at once, a gait called stotting. Only the bucks grow antlers, and they shed and regrow them every year.' };

// Where deer live: the West Meadow and the open valley beyond it, and the far east valley
const WILD_DEER_RANGES = [
  { minX: -31, maxX: -18, minZ: -9, maxZ: 6, label: 'the West Meadow' },
  { minX: 42, maxX: 55, minZ: -5, maxZ: 6, label: 'the east valley' }
];
const WILD_BIRD_SKY = { minX: -34, maxX: 30, minZ: -12, maxZ: 6 };
const WILD_HIDE_DIST = 85;   // further than this from the camera: not drawn at all
const WILD_LOD_DIST = 38;    // further than this: no legs or wings animated, only movement

let wildlifeGroup = null;
let wildBirdFlocks = [];
let wildDeerHerd = [];
let wildLastT = null;
let wildKeloPrev = null;
let wildKeloSpeed = 0;
let wildQuiet = false;      // he is creeping up to study them: they let him come closer
let wildStudyFace = null;   // the heading he keeps while crouched and watching
let wildVertexMat = null;
// A folded wing lies flat against the bird's flank: span swept back along the body, face outward
const wildFoldL = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -0.12, -1).normalize(), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0.12).normalize()));
const wildFoldR = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0.12, 1).normalize(), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, -1, 0.12).normalize()));
const wildTmpV = new THREE.Vector3();

// --- Geometry: many small parts merged into one mesh with vertex colours (few draw calls) ----
function wildMerge(parts) {
      const pos = [], nrm = [], col = [];
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
      parts.forEach(p => {
        const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
        e.set(...(p.rot || [0, 0, 0]));
        q.setFromEuler(e);
        m.compose(new THREE.Vector3(...(p.pos || [0, 0, 0])), q, new THREE.Vector3(...(p.scale || [1, 1, 1])));
        g.applyMatrix4(m);
        g.computeVertexNormals();
        const pa = g.attributes.position, na = g.attributes.normal;
        c.set(p.color);
        for (let i = 0; i < pa.count; i++) {
          pos.push(pa.getX(i), pa.getY(i), pa.getZ(i));
          nrm.push(na.getX(i), na.getY(i), na.getZ(i));
          col.push(c.r, c.g, c.b);
        }
        g.dispose();
      });
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      return out;
    }

function wildMesh(parts) {
      if (!wildVertexMat) wildVertexMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(wildMerge(parts), wildVertexMat);
      mesh.castShadow = true;
      return mesh;
    }

// --- Where animals may stand -----------------------------------------------------------------
function wildSpotOk(x, z, pad = 0.9) {
      if (z > 7.0) return false; // the beach and the lake
      if (x > TOWN.minX - 1.5 && x < TOWN.maxX + 1.5 && z > TOWN.minZ - 1.5 && z < TOWN.maxZ + 1.5) return false; // town
      const gy = getAnalyticalGroundHeight(x, z);
      if (gy < -0.2 || gy > 3.5) return false; // water, or up the mountain
      if (typeof MUSEUM !== 'undefined' && Math.abs(x - MUSEUM.x) < MUSEUM.w / 2 + 3 && Math.abs(z - MUSEUM.z) < MUSEUM.d / 2 + 3) return false;
      if (typeof BALLOON_SLOTS !== 'undefined' && BALLOON_SLOTS.some(([bx, bz]) => Math.hypot(x - bx, z - bz) < 4)) return false;
      if (typeof inParkingArea === 'function' && inParkingArea(x, z, 1.5)) return false;
      if (typeof DISPOSAL_PIT !== 'undefined' && Math.hypot(x - DISPOSAL_PIT.x, z - DISPOSAL_PIT.z) < DISPOSAL_PIT.r + 2) return false;
      return !worldObstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.r + pad);
    }

function wildRandomSpot(range, near = null, radius = 6) {
      for (let i = 0; i < 40; i++) {
        const x = near ? near.x + randRange(-radius, radius) : randRange(range.minX, range.maxX);
        const z = near ? near.z + randRange(-radius, radius) : randRange(range.minZ, range.maxZ);
        if (x < range.minX || x > range.maxX || z < range.minZ || z > range.maxZ) continue;
        if (wildSpotOk(x, z)) return { x, z };
      }
      return { x: (range.minX + range.maxX) / 2, z: (range.minZ + range.maxZ) / 2 };
    }

// --- Birds ----------------------------------------------------------------------------------
function wildWingGeometry(side) {
      const pts = [[0, 0.05], [0.12, 0.07], [0.25, 0.035], [0.34, -0.015], [0.24, -0.05], [0.1, -0.09], [0, -0.075]];
      const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x * side, y)));
      const g = new THREE.ShapeGeometry(shape);
      g.rotateX(Math.PI / 2);
      return g;
    }

function buildWildBird(sp) {
      const bird = new THREE.Group();
      const s = sp.size;
      const body = [
        { geo: new THREE.IcosahedronGeometry(0.1, 1), color: sp.back, pos: [0, 0.16, -0.01], scale: [0.85, 0.8, 1.45] },
        { geo: new THREE.IcosahedronGeometry(0.085, 1), color: sp.belly, pos: [0, 0.135, 0.035], scale: [0.85, 0.85, 1.2] },
        // a fanned tail
        { geo: new THREE.ConeGeometry(0.06, 0.17, 4), color: sp.back, pos: [0, 0.165, -0.19], rot: [-Math.PI / 2 + 0.25, 0, 0], scale: [1, 1, 0.22] }
      ];
      if (sp.bib) body.push({ geo: new THREE.IcosahedronGeometry(0.035, 0), color: 0x111111, pos: [0, 0.165, 0.11], scale: [1.2, 0.6, 0.5] });
      bird.add(wildMesh(body));
      // Legs and feet, tucked away in flight
      const legs = wildMesh([
        { geo: new THREE.CylinderGeometry(0.006, 0.006, 0.09, 4), color: 0x5a4636, pos: [0.025, 0.055, 0.0] },
        { geo: new THREE.CylinderGeometry(0.006, 0.006, 0.09, 4), color: 0x5a4636, pos: [-0.025, 0.055, 0.0] },
        { geo: new THREE.BoxGeometry(0.02, 0.006, 0.05), color: 0x5a4636, pos: [0.025, 0.012, 0.01] },
        { geo: new THREE.BoxGeometry(0.02, 0.006, 0.05), color: 0x5a4636, pos: [-0.025, 0.012, 0.01] }
      ]);
      legs.castShadow = false;
      bird.add(legs);
      // The head on a neck pivot, so it can peck and look around
      const head = new THREE.Group();
      head.position.set(0, 0.2, 0.1);
      const headParts = [
        { geo: new THREE.IcosahedronGeometry(0.058, 1), color: sp.head, pos: [0, 0.02, 0.02] },
        { geo: new THREE.ConeGeometry(0.017, 0.065, 5), color: sp.beak, pos: [0, 0.012, 0.1], rot: [Math.PI / 2, 0, 0] },
        { geo: new THREE.SphereGeometry(0.011, 6, 4), color: 0x0a0a0a, pos: [0.045, 0.035, 0.045] },
        { geo: new THREE.SphereGeometry(0.011, 6, 4), color: 0x0a0a0a, pos: [-0.045, 0.035, 0.045] }
      ];
      if (sp.cheek) headParts.push({ geo: new THREE.SphereGeometry(0.03, 6, 4), color: sp.cheek, pos: [0.035, 0.0, 0.02], scale: [0.6, 0.7, 1] }, { geo: new THREE.SphereGeometry(0.03, 6, 4), color: sp.cheek, pos: [-0.035, 0.0, 0.02], scale: [0.6, 0.7, 1] });
      if (sp.crest) headParts.push({ geo: new THREE.ConeGeometry(0.03, 0.1, 4), color: sp.head, pos: [0, 0.09, -0.03], rot: [-0.6, 0, 0] });
      head.add(wildMesh(headParts));
      bird.add(head);
      const wings = [1, -1].map(side => {
        const pivot = new THREE.Group();
        pivot.position.set(0.07 * side, 0.2, 0.03);
        const w = new THREE.Mesh(wildWingGeometry(side), new THREE.MeshStandardMaterial({ color: sp.back, flatShading: true, roughness: 0.9, side: THREE.DoubleSide }));
        w.castShadow = true;
        pivot.add(w);
        bird.add(pivot);
        return pivot;
      });
      bird.scale.setScalar(1.35 * s);
      return { group: bird, head, legs, wingL: wings[0], wingR: wings[1], sp };
    }

// Where a flock can land: on top of a standing valley tree, or on open meadow grass
function wildPerchSpots(n) {
      const trees = valleyTrees.filter(t => !t.removed && t.group && t.group.parent && t.x > WILD_BIRD_SKY.minX && t.x < WILD_BIRD_SKY.maxX && !inTown(t.x, t.z));
      if (trees.length && Math.random() < 0.5) {
        const tree = pick(trees);
        const base = tree.group.position;
        return Array.from({ length: n }, () => {
          const th = Math.random() * Math.PI * 2, ph = Math.random() * 0.9;
          return { kind: 'tree', p: new THREE.Vector3(base.x + Math.sin(ph) * Math.cos(th) * 1.02, base.y + 1.9 + Math.cos(ph) * 1.02, base.z + Math.sin(ph) * Math.sin(th) * 1.02) };
        });
      }
      const c = wildRandomSpot(WILD_DEER_RANGES[0]);
      return Array.from({ length: n }, () => {
        let x = c.x + randRange(-1.8, 1.8), z = c.z + randRange(-1.8, 1.8);
        if (!wildSpotOk(x, z, 0.3)) { x = c.x; z = c.z; }
        return { kind: 'ground', p: new THREE.Vector3(x, getAnalyticalGroundHeight(x, z), z) };
      });
    }

function wildSkyWaypoint() {
      const x = randRange(WILD_BIRD_SKY.minX, WILD_BIRD_SKY.maxX), z = randRange(WILD_BIRD_SKY.minZ, WILD_BIRD_SKY.maxZ);
      return new THREE.Vector3(x, Math.max(0, getAnalyticalGroundHeight(x, z)) + randRange(6, 10), z);
    }

function buildWildFlock(sp, count, start) {
      const flock = { sp, birds: [], mode: 'fly', center: start.clone(), waypoint: wildSkyWaypoint(), legs: 2 + Math.floor(Math.random() * 3), timer: 0 };
      for (let i = 0; i < count; i++) {
        const b = buildWildBird(sp);
        b.offset = new THREE.Vector3(randRange(-1.6, 1.6), randRange(-0.6, 0.6), randRange(-1.6, 1.6));
        b.pos = start.clone().add(b.offset);
        b.phase = Math.random() * 10;
        b.mode = 'fly';
        b.heading = 0;
        b.peck = 0;
        b.hop = null;
        b.group.position.copy(b.pos);
        wildlifeGroup.add(b.group);
        flock.birds.push(b);
      }
      return flock;
    }

// --- Deer -----------------------------------------------------------------------------------
function buildWildDeer(buck, scale = 1) {
      const coat = 0x8b7058, belly = 0xd8c9b2, dark = 0x5e4a3a, white = 0xf2ede4;
      const deer = new THREE.Group();
      const torso = wildMesh([
        { geo: new THREE.IcosahedronGeometry(0.5, 1), color: coat, pos: [0, 1.32, -0.02], scale: [0.62, 0.66, 1.55] },
        { geo: new THREE.IcosahedronGeometry(0.4, 1), color: coat, pos: [0, 1.36, 0.5], scale: [0.72, 0.95, 0.9] },
        { geo: new THREE.IcosahedronGeometry(0.4, 1), color: belly, pos: [0, 1.15, 0.0], scale: [0.62, 0.45, 1.45] },
        { geo: new THREE.IcosahedronGeometry(0.25, 1), color: white, pos: [0, 1.36, -0.74], scale: [1.05, 1.05, 0.5] },
        { geo: new THREE.CylinderGeometry(0.05, 0.065, 0.24, 6), color: white, pos: [0, 1.36, -0.86], rot: [0.5, 0, 0] },
        { geo: new THREE.IcosahedronGeometry(0.05, 0), color: 0x111111, pos: [0, 1.25, -0.93] },
        { geo: new THREE.IcosahedronGeometry(0.22, 1), color: coat, pos: [0.13, 1.28, -0.55], scale: [0.6, 1.1, 1.1] },
        { geo: new THREE.IcosahedronGeometry(0.22, 1), color: coat, pos: [-0.13, 1.28, -0.55], scale: [0.6, 1.1, 1.1] }
      ]);
      deer.add(torso);
      // Neck and head on pivots, so he can graze, look up and turn his ears toward a sound
      const neck = new THREE.Group();
      neck.position.set(0, 1.5, 0.72);
      neck.add(wildMesh([
        { geo: new THREE.CylinderGeometry(0.11, 0.21, 0.88, 8), color: coat, pos: [0, 0.38, 0] },
        { geo: new THREE.CylinderGeometry(0.07, 0.1, 0.5, 6), color: white, pos: [0, 0.6, 0.075], scale: [1, 1, 0.7] }
      ]));
      const head = new THREE.Group();
      head.position.set(0, 0.82, 0.02);
      const headParts = [
        { geo: new THREE.IcosahedronGeometry(0.17, 1), color: 0x9a8066, pos: [0, 0, 0.02], scale: [0.85, 0.9, 1.05] },
        { geo: new THREE.IcosahedronGeometry(0.11, 1), color: white, pos: [0, -0.06, 0.22], scale: [0.78, 0.7, 1.55] },
        { geo: new THREE.IcosahedronGeometry(0.05, 0), color: 0x151515, pos: [0, -0.045, 0.39] },
        { geo: new THREE.SphereGeometry(0.03, 6, 4), color: 0x0d0d0d, pos: [0.115, 0.05, 0.1] },
        { geo: new THREE.SphereGeometry(0.03, 6, 4), color: 0x0d0d0d, pos: [-0.115, 0.05, 0.1] },
        { geo: new THREE.IcosahedronGeometry(0.06, 1), color: dark, pos: [0, 0.1, 0.12], scale: [1.2, 0.5, 1.6] },
        // The big mule ears
        { geo: new THREE.IcosahedronGeometry(0.13, 1), color: 0x9a8066, pos: [0.2, 0.14, -0.05], rot: [0, 0, -0.95], scale: [0.42, 1.15, 0.18] },
        { geo: new THREE.IcosahedronGeometry(0.13, 1), color: 0x9a8066, pos: [-0.2, 0.14, -0.05], rot: [0, 0, 0.95], scale: [0.42, 1.15, 0.18] },
        { geo: new THREE.IcosahedronGeometry(0.1, 1), color: 0xd9b8a8, pos: [0.205, 0.145, -0.03], rot: [0, 0, -0.95], scale: [0.3, 0.95, 0.08] },
        { geo: new THREE.IcosahedronGeometry(0.1, 1), color: 0xd9b8a8, pos: [-0.205, 0.145, -0.03], rot: [0, 0, 0.95], scale: [0.3, 0.95, 0.08] }
      ];
      if (buck) {
        // Mule deer antlers fork, and fork again
        const tine = (x, y, z, rx, rz, len) => ({ geo: new THREE.CylinderGeometry(0.014, 0.025, len, 5), color: 0xcbb89a, pos: [x, y, z], rot: [rx, 0, rz] });
        [1, -1].forEach(sd => {
          headParts.push(tine(0.08 * sd, 0.26, -0.04, -0.35, -0.5 * sd, 0.3));
          headParts.push(tine(0.19 * sd, 0.44, -0.02, 0.2, -0.25 * sd, 0.26));
          headParts.push(tine(0.26 * sd, 0.42, -0.14, -0.6, -0.7 * sd, 0.24));
          headParts.push(tine(0.21 * sd, 0.6, 0.04, 0.35, -0.1 * sd, 0.18));
        });
      }
      head.add(wildMesh(headParts));
      neck.add(head);
      deer.add(neck);
      // Four legs, each an upper and a lower segment, so they can stride and bound
      const legs = [[0.17, 1.12, 0.52, true], [-0.17, 1.12, 0.52, true], [0.16, 1.15, -0.56, false], [-0.16, 1.15, -0.56, false]].map(([x, y, z, front]) => {
        const hip = new THREE.Group();
        hip.position.set(x, y, z);
        const upperLen = front ? 0.56 : 0.6;
        hip.add(wildMesh([{ geo: new THREE.CylinderGeometry(front ? 0.075 : 0.1, 0.05, upperLen, 6), color: coat, pos: [0, -upperLen / 2, 0] }]));
        const knee = new THREE.Group();
        knee.position.set(0, -upperLen, 0);
        knee.add(wildMesh([
          { geo: new THREE.CylinderGeometry(0.042, 0.035, 0.52, 6), color: 0x7d6550, pos: [0, -0.26, 0] },
          { geo: new THREE.CylinderGeometry(0.042, 0.05, 0.07, 6), color: 0x262019, pos: [0, -0.54, 0.01] }
        ]));
        hip.add(knee);
        deer.add(hip);
        return { hip, knee, front, rest: front ? [0, 0] : [-0.28, 0.52] };
      });
      deer.scale.setScalar(scale);
      return { group: deer, neck, head, legs };
    }

function wildDeerAt(range, buck, scale) {
      const spot = wildRandomSpot(range);
      const d = buildWildDeer(buck, scale);
      Object.assign(d, { range, x: spot.x, z: spot.z, heading: Math.random() * Math.PI * 2, mode: 'graze', timer: randRange(3, 12), target: null,
        gait: Math.random() * 6, neckPitch: 2.2, headYaw: 0, bounce: 0, speed: 0 });
      d.group.position.set(d.x, getAnalyticalGroundHeight(d.x, d.z), d.z);
      wildlifeGroup.add(d.group);
      return d;
    }

// --- Building it all (called when the feature is switched on, and on every load) ------------
function buildWildlife3D() {
      if (wildlifeGroup || typeof scene === 'undefined' || !scene) return;
      wildlifeGroup = new THREE.Group();
      wildlifeGroup.name = 'Wildlife';
      scene.add(wildlifeGroup);
      // Two flocks of songbirds, and a small herd in the meadow plus a pair out east
      const species = [...WILD_BIRD_SPECIES].sort(() => Math.random() - 0.5);
      wildBirdFlocks = [
        buildWildFlock(species[0], 5, wildSkyWaypoint()),
        buildWildFlock(species[1], 4, wildSkyWaypoint())
      ];
      wildDeerHerd = [
        wildDeerAt(WILD_DEER_RANGES[0], true, 1.0),
        wildDeerAt(WILD_DEER_RANGES[0], false, 0.92),
        wildDeerAt(WILD_DEER_RANGES[0], false, 0.7),
        wildDeerAt(WILD_DEER_RANGES[1], false, 0.95)
      ];
    }

// --- Every frame ------------------------------------------------------------------------------
function updateWildlife(t) {
      if (!wildlifeGroup) return;
      const dt = wildLastT === null ? 0.016 : Math.min(0.1, Math.max(0.001, t - wildLastT));
      wildLastT = t;
      // How fast is Kelo-1 moving? Animals don't mind a slow, quiet walker
      const kp = state.botPos;
      if (wildKeloPrev) { const k = 1 - Math.exp(-9.75 * dt); wildKeloSpeed += ((Math.hypot(kp.x - wildKeloPrev.x, kp.z - wildKeloPrev.z) / dt) - wildKeloSpeed) * k; } // (0.15 a frame at 60 fps)
      wildKeloPrev = { x: kp.x, z: kp.z };
      const cam = typeof camera !== 'undefined' && camera ? camera.position : null;
      wildDeerHerd.forEach(d => updateWildDeer(d, t, dt, cam));
      wildBirdFlocks.forEach(f => updateWildFlock(f, t, dt, cam));
      // Crouched and watching: he keeps facing the animals
      if (wildStudyFace !== null && !state.isWalking && typeof keloGroup !== 'undefined' && keloGroup) keloGroup.rotation.y = wildStudyFace;
    }

function wildDampAngle(cur, target, rate, dt) {
      let d = target - cur;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return cur + d * (1 - Math.exp(-rate * dt));
    }

function wildFlee(d) {
      if (d.mode === 'flee') return;
      // Away from Kelo-1, as far as the range allows
      const ax = d.x - state.botPos.x, az = d.z - state.botPos.z, len = Math.hypot(ax, az) || 1;
      let best = null;
      for (let i = 0; i < 12; i++) {
        const ang = Math.atan2(ax / len, az / len) + randRange(-0.8, 0.8);
        const dist = randRange(11, 17);
        const x = d.x + Math.sin(ang) * dist, z = d.z + Math.cos(ang) * dist;
        if (x > d.range.minX - 3 && x < d.range.maxX + 3 && z > d.range.minZ - 3 && z < d.range.maxZ + 1 && wildSpotOk(x, z)) { best = { x, z }; break; }
      }
      if (!best) best = wildRandomSpot(d.range);
      d.mode = 'flee';
      d.target = best;
      d.timer = 9;
      // The rest of the herd nearby goes too
      wildDeerHerd.forEach(o => { if (o !== d && o.mode !== 'flee' && Math.hypot(o.x - d.x, o.z - d.z) < 9) setTimeout(() => wildFlee(o), 150 + Math.random() * 400); });
    }

function updateWildDeer(d, t, dt, cam) {
      const camDist = cam ? Math.hypot(cam.x - d.x, cam.z - d.z) : 0;
      d.group.visible = camDist < WILD_HIDE_DIST;
      const kd = Math.hypot(state.botPos.x - d.x, state.botPos.z - d.z);
      // Too close, or coming in too fast: off they bound
      if (d.mode !== 'flee' && !state.isSleeping) {
        if (kd < (wildQuiet ? 2.4 : 3.2) || (kd < 8 && wildKeloSpeed > (wildQuiet ? 3.2 : 2.4))) wildFlee(d);
        else if (kd < 10 && d.mode !== 'alert' && d.mode !== 'watch') { d.mode = wildQuiet ? 'watch' : 'alert'; d.timer = wildQuiet ? 12 : randRange(2.5, 4.5); }
      }
      d.timer -= dt;
      let speed = 0, neckGoal = 0.7, headYawGoal = 0;
      const faceKelo = Math.atan2(state.botPos.x - d.x, state.botPos.z - d.z);
      if (d.mode === 'graze') {
        neckGoal = Math.sin(t * 0.7 + d.gait) > 0.85 ? 0.6 : 2.8; // now and then the head comes up to chew and look
        if (d.timer <= 0) {
          if (Math.random() < 0.6) { d.mode = 'walk'; d.target = wildRandomSpot(d.range, { x: d.x, z: d.z }, 7); }
          d.timer = randRange(8, 18);
        }
      } else if (d.mode === 'walk') {
        speed = 0.85;
        neckGoal = 0.85;
        if (!d.target || Math.hypot(d.target.x - d.x, d.target.z - d.z) < 0.4 || d.timer <= 0) { d.mode = 'graze'; d.timer = randRange(8, 20); }
      } else if (d.mode === 'alert' || d.mode === 'watch') {
        neckGoal = d.mode === 'watch' && Math.sin(t * 0.5 + d.gait) > 0.2 ? 2.8 : 0.55;
        headYawGoal = Math.max(-1, Math.min(1, wildDampAngle(0, faceKelo - d.heading, 100, 1)));
        if (d.mode === 'alert') d.heading = wildDampAngle(d.heading, faceKelo, 1.2, dt);
        if (d.timer <= 0 || kd > 13) { d.mode = 'graze'; d.timer = randRange(6, 14); }
      } else if (d.mode === 'flee') {
        speed = 5.5;
        neckGoal = 0.6;
        if (!d.target || Math.hypot(d.target.x - d.x, d.target.z - d.z) < 0.8 || d.timer <= 0) { d.mode = 'alert'; d.timer = randRange(3, 5); d.target = null; }
      }
      // Move toward the target, turning gradually and stepping around trees and rocks
      if (speed > 0 && d.target) {
        const want = Math.atan2(d.target.x - d.x, d.target.z - d.z);
        d.heading = wildDampAngle(d.heading, want, d.mode === 'flee' ? 5 : 2, dt);
        const nx = d.x + Math.sin(d.heading) * speed * dt, nz = d.z + Math.cos(d.heading) * speed * dt;
        if (wildStepOk(nx, nz)) { d.x = nx; d.z = nz; } else { d.target = wildRandomSpot(d.range); d.heading += 0.6; }
      }
      d.speed = d.speed + (speed - d.speed) * (1 - Math.exp(-4 * dt));
      d.neckPitch = d.neckPitch + (neckGoal - d.neckPitch) * (1 - Math.exp(-2.2 * dt));
      d.headYaw = d.headYaw + (headYawGoal - d.headYaw) * (1 - Math.exp(-3 * dt));
      const gy = getAnalyticalGroundHeight(d.x, d.z);
      d.group.position.set(d.x, gy, d.z);
      d.group.rotation.y = d.heading;
      if (!d.group.visible || camDist > WILD_LOD_DIST) return;
      // Legs: a walk is a four-beat stride; fleeing mule deer stot, all four hooves together
      const stot = d.mode === 'flee' && d.speed > 2.5;
      d.gait += dt * (stot ? 7 : 2.4 + d.speed * 4.2);
      const walkAmt = Math.min(1, d.speed / 0.8);
      let lift = 0;
      d.legs.forEach((leg, i) => {
        let up = leg.rest[0], kn = leg.rest[1];
        if (stot) {
          const s = Math.sin(d.gait);
          up += (leg.front ? -0.35 : 0.3) * s;
          kn += Math.max(0, s) * (leg.front ? 0.9 : 0.5);
        } else if (walkAmt > 0.02) {
          const p = d.gait + [0, Math.PI, Math.PI * 0.5, Math.PI * 1.5][i];
          up += -Math.sin(p) * 0.42 * walkAmt;
          kn += Math.max(0, Math.cos(p)) * (leg.front ? 0.8 : 0.45) * walkAmt;
        }
        leg.hip.rotation.x = up;
        leg.knee.rotation.x = kn;
      });
      if (stot) lift = Math.max(0, Math.sin(d.gait)) * 0.55;
      d.group.position.y = gy + lift + (walkAmt > 0.02 && !stot ? Math.abs(Math.sin(d.gait)) * 0.03 : 0);
      // Grazing, the front end dips so the muzzle reaches the grass
      d.group.rotation.x = stot ? Math.cos(d.gait) * 0.08 : Math.max(0, d.neckPitch - 1.5) * 0.11;
      d.neck.rotation.x = d.neckPitch;
      d.neck.rotation.y = d.headYaw * 0.5;
      // The head stays level (or nose-down when grazing) whatever the neck does
      d.head.rotation.x = (d.neckPitch > 1.5 ? 1.45 : 0.35) - d.neckPitch;
      d.head.rotation.y = d.headYaw * 0.5;
    }

// A deer's next step must stay on open ground
function wildStepOk(x, z) {
      return wildSpotOk(x, z, 0.5);
    }

function updateWildFlock(f, t, dt, cam) {
      const near = f.birds.reduce((m, b) => Math.min(m, Math.hypot(state.botPos.x - b.pos.x, state.botPos.z - b.pos.z)), Infinity);
      f.timer -= dt;
      if (f.mode === 'fly') {
        // The flock glides from waypoint to waypoint over the valley, then picks somewhere to land
        const to = wildTmpV.copy(f.waypoint).sub(f.center);
        const dist = to.length();
        if (dist < 1.5) {
          if (--f.legs <= 0) {
            f.mode = 'land';
            f.spots = wildPerchSpots(f.birds.length);
            f.birds.forEach((b, i) => { b.mode = 'land'; b.land = f.spots[i]; });
            f.timer = 12;
          } else f.waypoint = wildSkyWaypoint();
        } else f.center.addScaledVector(to.normalize(), Math.min(dist, 4.5 * dt));
      } else if (f.mode === 'land') {
        if (f.birds.every(b => b.mode === 'down') || f.timer <= 0) { f.mode = 'down'; f.timer = randRange(14, 30); f.birds.forEach(b => { b.mode = 'down'; }); }
      } else if (f.mode === 'down') {
        // Startled by a fast or close robot, or simply done here: up they go together
        const spooked = !state.isSleeping && (near < (wildQuiet ? 1.6 : 2.6) || (near < 6 && wildKeloSpeed > (wildQuiet ? 3.2 : 2.2)));
        if (spooked || f.timer <= 0) {
          f.mode = 'fly';
          f.center.set(0, 0, 0);
          f.birds.forEach(b => { f.center.add(b.pos); b.mode = 'fly'; });
          f.center.divideScalar(f.birds.length);
          f.waypoint = wildSkyWaypoint();
          f.legs = 2 + Math.floor(Math.random() * 3);
        }
      }
      const camDist = cam ? cam.distanceTo(f.birds[0].pos) : 0;
      const animate = camDist < WILD_LOD_DIST;
      f.birds.forEach(b => {
        b.group.visible = camDist < WILD_HIDE_DIST;
        const prevX = b.pos.x, prevZ = b.pos.z, prevY = b.pos.y;
        if (b.mode === 'fly') {
          const ang = t * 0.35 + b.phase;
          wildTmpV.set(b.offset.x * Math.cos(ang) - b.offset.z * Math.sin(ang), b.offset.y + Math.sin(t * 1.3 + b.phase) * 0.35, b.offset.x * Math.sin(ang) + b.offset.z * Math.cos(ang)).add(f.center);
          b.pos.lerp(wildTmpV, (1 - Math.exp(-2.2 * dt)));
        } else if (b.mode === 'land') {
          // Swoop down, slowing as it arrives
          const to = wildTmpV.copy(b.land.p).sub(b.pos);
          const dist = to.length();
          if (dist < 0.06) { b.pos.copy(b.land.p); b.mode = 'down'; }
          else b.pos.addScaledVector(to.normalize(), Math.min(dist, Math.max(1.2, dist * 1.4) * dt));
        } else if (b.mode === 'down' && b.land && b.land.kind === 'ground') {
          // Hop, hop, peck
          if (!b.hop && Math.random() < dt * 0.35) {
            const a = Math.random() * Math.PI * 2;
            const hx = b.pos.x + Math.sin(a) * 0.25, hz = b.pos.z + Math.cos(a) * 0.25;
            if (wildSpotOk(hx, hz, 0.2)) b.hop = { from: b.pos.clone(), to: new THREE.Vector3(hx, getAnalyticalGroundHeight(hx, hz), hz), t: 0 };
          }
          if (b.hop) {
            b.hop.t = Math.min(1, b.hop.t + dt * 4);
            b.pos.lerpVectors(b.hop.from, b.hop.to, b.hop.t);
            b.pos.y += Math.sin(b.hop.t * Math.PI) * 0.08;
            if (b.hop.t >= 1) b.hop = null;
          }
        }
        b.group.position.copy(b.pos);
        const mx = b.pos.x - prevX, mz = b.pos.z - prevZ;
        if (mx * mx + mz * mz > 1e-6) b.heading = wildDampAngle(b.heading, Math.atan2(mx, mz), 6, dt);
        else if (b.mode === 'down' && Math.random() < dt * 0.2) b.heading += randRange(-1.2, 1.2);
        b.group.rotation.y = b.heading;
        b.group.rotation.x = b.mode === 'fly' || b.mode === 'land' ? Math.max(-0.4, Math.min(0.4, -(b.pos.y - prevY) / Math.max(dt, 0.001) * 0.08)) : 0;
        if (!animate) return;
        if (b.mode === 'down') {
          // Wings folded along its back; pecking at the grass or looking around from the branch
          b.wingL.quaternion.copy(wildFoldL);
          b.wingR.quaternion.copy(wildFoldR);
          b.wingL.scale.setScalar(0.72);
          b.wingR.scale.setScalar(0.72);
          b.legs.visible = true;
          if (b.land && b.land.kind === 'ground') {
            const pk = Math.max(0, Math.sin(t * 2.2 + b.phase * 3));
            b.head.rotation.set(Math.pow(pk, 3) * 1.1, 0, 0);
          } else {
            b.head.rotation.set(-0.1, Math.sin(t * 0.9 + b.phase) * 0.9, 0);
          }
        } else {
          // Flap, with short glides now and then
          const glide = b.mode === 'fly' && Math.sin(t * 0.6 + b.phase) > 0.6;
          const flap = glide ? 0.15 : Math.sin(t * 22 + b.phase) * 0.8;
          b.wingL.rotation.set(0, 0, flap);
          b.wingR.rotation.set(0, 0, -flap);
          b.wingL.scale.setScalar(1);
          b.wingR.scale.setScalar(1);
          b.legs.visible = b.mode === 'land' && b.pos.distanceTo(b.land.p) < 1.2;
          b.head.rotation.set(0, 0, 0);
        }
      });
    }

// --- Studying them ------------------------------------------------------------------------------
function wildStudySubject() {
      const kp = state.botPos;
      const deer = wildDeerHerd.filter(d => d.mode !== 'flee').map(d => ({ kind: 'deer', d, x: d.x, z: d.z, dist: Math.hypot(d.x - kp.x, d.z - kp.z) }));
      const birds = wildBirdFlocks.filter(f => f.mode === 'down').map(f => {
        const b = f.birds[0];
        return { kind: 'bird', f, x: b.pos.x, z: b.pos.z, dist: Math.hypot(b.pos.x - kp.x, b.pos.z - kp.z), onTree: b.land && b.land.kind === 'tree' };
      });
      const all = [...deer, ...birds].sort((a, b) => a.dist - b.dist);
      if (!all.length) return null;
      // Mostly the nearest, sometimes something he has not studied lately
      const seen = new Set((state.wildlifeNotes || []).slice(0, 3).map(n => n.species));
      return all.find(s => !seen.has(s.kind === 'deer' ? WILD_DEER_INFO.name : s.f.sp.name)) || all[0];
    }

function wildSubjectPos(s) {
      if (s.kind === 'deer') return { x: s.d.x, z: s.d.z };
      const b = s.f.birds[0];
      return { x: b.pos.x, z: b.pos.z };
    }

// A real fact about it: the Wikipedia summary through NetNode's lookup if it answers, else a built-in one
async function wildFactAbout(info) {
      if (typeof lookUpAnywhere === 'function') {
        try {
          const found = await Promise.race([lookUpAnywhere(info.wiki), new Promise(r => setTimeout(() => r(null), 6000))]);
          if (found && found.extract && found.extract.length > 60) {
            const sentences = found.extract.replace(/\s*\([^)]*\)/g, '').match(/[^.!?]+[.!?]+/g) || [found.extract];
            return { text: sentences.slice(0, 2).join(' ').trim(), source: 'wikipedia', title: found.title, url: found.url };
          }
        } catch (e) {}
      }
      return { text: info.fact, source: 'memory' };
    }

function wildNotebook() {
      const g = new THREE.Group();
      const cover = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.3), new THREE.MeshStandardMaterial({ color: 0x2f6b4f, roughness: 0.8 }));
      const pages = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.28), new THREE.MeshStandardMaterial({ color: 0xf8f4e8 }));
      pages.position.y = 0.025;
      g.add(cover, pages);
      g.rotation.x = -0.6;
      g.scale.setScalar(1.6);
      return g;
    }

async function studyWildlife(originLabel = 'Studying Wildlife') {
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping || state.isCollectingMail) return false;
      if (!wildlifeGroup) buildWildlife3D();
      let subject = wildStudySubject();
      if (!subject) return false;
      state.isPracticing = true;
      try {
        const info = subject.kind === 'deer' ? WILD_DEER_INFO : subject.f.sp;
        const where = subject.kind === 'deer' ? subject.d.range.label : (subject.onTree ? 'a tree in the valley' : 'the meadow grass');
        const factPromise = wildFactAbout(info);
        // Walk out normally until he is a little way off...
        let p = wildSubjectPos(subject);
        const awayX = state.botPos.x - p.x, awayZ = state.botPos.z - p.z, len = Math.hypot(awayX, awayZ) || 1;
        state.currentLocKey = 'custom';
        state.customPlaceName = where;
        state.microPose = 'normal';
        state.moodEmoji = subject.kind === 'deer' ? '🦌' : '🐦';
        state.moodTitle = `Going to watch the ${info.name.toLowerCase().replace(/^american |^western /, '')}${subject.kind === 'bird' ? 's' : ''}`;
        state.speechBubble = subject.kind === 'deer' ? 'There are deer out in the meadow. I want to see them up close, without scaring them.' : `Birds! I want to know what kind they are.`;
        renderAllUI();
        if (len > 13) {
          state.targetPos = { x: p.x + (awayX / len) * 12, z: p.z + (awayZ / len) * 12 };
          await waitForArrival(60000);
        }
        // ...then creep in slowly and quietly
        wildQuiet = true;
        state.ridingSpeed = 0.3;
        state.moodTitle = 'Creeping up quietly';
        state.speechBubble = '(whispering) Slow steps. Slow steps. Don\'t scare them.';
        renderAllUI();
        p = wildSubjectPos(subject);
        const ax = state.botPos.x - p.x, az = state.botPos.z - p.z, al = Math.hypot(ax, az) || 1;
        const stop = subject.kind === 'deer' ? 5.5 : 3.6;
        if (al > stop + 0.5) {
          state.targetPos = { x: p.x + (ax / al) * stop, z: p.z + (az / al) * stop };
          await waitForArrival(30000);
        }
        state.ridingSpeed = 1;
        // Did they stay?
        const stillThere = subject.kind === 'deer' ? subject.d.mode !== 'flee' : subject.f.mode === 'down';
        p = wildSubjectPos(subject);
        wildStudyFace = Math.atan2(p.x - state.botPos.x, p.z - state.botPos.z);
        state.botRotY = wildStudyFace;
        state.targetPos = { x: state.botPos.x, z: state.botPos.z };
        state.microPose = 'crouch_inspect';
        if (typeof setCarriedObject === 'function') setCarriedObject(wildNotebook());
        state.moodEmoji = '📝';
        state.moodTitle = stillThere ? `Watching and taking notes` : 'They ran off... taking notes anyway';
        state.speechBubble = stillThere
          ? (subject.kind === 'deer' ? '(whispering) Look at those ears. They turn on their own, like little satellite dishes.' : '(whispering) It tilts its head before it pecks. Is it listening for worms?')
          : 'I came in too fast and they bolted. Next time, slower.';
        renderAllUI();
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 1000));
          p = wildSubjectPos(subject);
          wildStudyFace = Math.atan2(p.x - state.botPos.x, p.z - state.botPos.z);
        }
        const fact = await factPromise;
        // His notes go in his diary and his field notebook, and the reading in his web history
        if (!Array.isArray(state.wildlifeNotes)) state.wildlifeNotes = [];
        state.wildlifeNotes.unshift({ species: info.name, fact: fact.text.slice(0, 400), where, at: Date.now(), source: fact.source });
        if (state.wildlifeNotes.length > 30) state.wildlifeNotes.length = 30;
        if (fact.source === 'wikipedia' && Array.isArray(state.webHistory)) {
          state.webHistory.unshift({ query: `What is a ${info.name}?`, time: 'Just now', verdict: fact.text.slice(0, 200), hops: [{ title: fact.title, url: fact.url, extract: fact.text.slice(0, 280) }] });
          if (state.webHistory.length > 12) state.webHistory.length = 12;
        }
        const observed = subject.kind === 'deer'
          ? (stillThere ? pick(['It kept grazing, but its ears never stopped turning toward me.', 'It lifted its head, looked right at me, chewed, and went back to the grass.', 'There was a little one, and the big one stayed between us the whole time.'])
            : 'I came in too fast and they bounded away with all four hooves in the air at once.')
          : (stillThere ? pick(['It hopped three times, stopped, tilted its head, and pecked.', 'They kept calling to each other in short little notes.', 'One sat on a branch and watched me watch it.'])
            : 'They all took off together the moment I got close, like one animal.');
        state.wonderLevel = Math.min(100, state.wonderLevel + 12);
        state.happiness = Math.min(100, state.happiness + 8);
        state.calmLevel = Math.min(100, state.calmLevel + (stillThere ? 6 : 0));
        state.microPose = 'normal';
        state.moodEmoji = '✨';
        state.moodTitle = `Learned about the ${info.name.toLowerCase()}`;
        state.speechBubble = `I studied a ${info.name.toLowerCase()}. ${fact.text.split(/(?<=[.!?])\s/)[0]}`;
        state.changedLatelySummary = `Studied a ${info.name.toLowerCase()} in ${where} and wrote notes about it.`;
        wishDiary(originLabel, `${subject.kind === 'deer' ? '🦌' : '🐦'} Studying a ${info.name.toLowerCase()}`,
          `Dear Diary, I crept up on a ${info.name.toLowerCase()} in ${where} and watched for a while. ${observed} My notes say: ${fact.text}${fact.source === 'wikipedia' ? ' (I checked it on Wikipedia.)' : ''}`, where);
        if (typeof bumpLifeStat === 'function') bumpLifeStat('wildlifeStudied');
        showToast(`📝 Kelo-1 studied a ${info.name.toLowerCase()}`);
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        wildQuiet = false;
        wildStudyFace = null;
        state.ridingSpeed = 1;
        if (state.microPose === 'crouch_inspect') state.microPose = 'normal';
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.isPracticing = false;
      }
    }
