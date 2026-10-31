// Kelo-bot-1 — js/gearmodels.js
// Loaded after items3d.js. Detailed models of vehicles and tools, used by the rules in items3d.js.
// Vehicles are built at their real size next to Kelo-1 (he is about 2.8 units tall and sits with his
// seat about 0.3 above his feet), then shrunk to a miniature for the Post Office counter.
// vehicles.js scales them back to full size and seats Kelo-1 at userData.seat.
// Tools are built in item units (about a metre each), like the other items.

const KELO_SIT_OFFSET = 0.3; // Kelo-1's seated bottom, above his feet

// --- Helpers ----------------------------------------------------------------------------------
function at(object3d, x, y, z) {
      object3d.position.set(x, y, z);
      return object3d;
    }

function glassMat() {
      return { transparent: true, opacity: 0.32, metalness: 0.1, roughness: 0.05 };
    }

function glass(geometry) {
      const m = mesh(geometry, 0xbfdbfe, glassMat());
      m.castShadow = false;
      return m;
    }

// A cylinder running from point a to point b
function rod(a, b, radius, color, extra = {}) {
      const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
      const dir = to.clone().sub(from);
      const m = mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), 10), color, extra);
      m.position.copy(from).add(to).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      return m;
    }

// A flat outline in the x-y plane, given thickness along z and centred on z = 0
function slab(points, depth, color, extra = {}, holes = []) {
      const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
      holes.forEach(h => shape.holes.push(h));
      const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 12 });
      geo.translate(0, 0, -depth / 2);
      return mesh(geo, color, extra);
    }

function circlePath(x, y, r) {
      const p = new THREE.Path();
      p.absarc(x, y, r, 0, Math.PI * 2, true);
      return p;
    }

// A tyre with a rim and hub, axle along z
function wheel(radius, width, rimColor = 0x94a3b8) {
      const tyre = mesh(new THREE.CylinderGeometry(radius, radius, width, 22), 0x16181d, { roughness: 0.95 });
      tyre.rotation.x = Math.PI / 2;
      const rim = mesh(new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width + 0.02, 16), rimColor, { metalness: 0.7, roughness: 0.35 });
      rim.rotation.x = Math.PI / 2;
      const hub = mesh(new THREE.CylinderGeometry(radius * 0.2, radius * 0.25, width + 0.08, 10), 0x334155, { metalness: 0.8 });
      hub.rotation.x = Math.PI / 2;
      const g = group(tyre, rim, hub);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const nut = mesh(new THREE.CylinderGeometry(0.03, 0.03, width + 0.06, 6), 0x1f2937);
        nut.rotation.x = Math.PI / 2;
        nut.position.set(Math.cos(a) * radius * 0.38, Math.sin(a) * radius * 0.38, 0);
        g.add(nut);
      }
      return g;
    }

// Shrink a full-size vehicle so its longest side is about 0.7 (a miniature on the counter);
// vehicles.js sets userData.mini back to scale 1 to park it full size.
function miniature(body, info) {
      const box = new THREE.Box3().setFromObject(body);
      const size = new THREE.Vector3();
      box.getSize(size);
      // The shrink lives one level down, so callers can still scale the miniature as they like
      const mini = group(body);
      mini.scale.setScalar(0.7 / Math.max(size.x, size.y, size.z));
      const wrap = group(mini);
      wrap.userData = { fullSize: true, mini, ...info };
      return wrap;
    }

// --- Vehicles (world units, +x is forward, the seat is where Kelo-1 sits) ----------------------
function dumpTruckModel() {
      const red = 0xc62828, yellow = 0xf4b400, dark = 0x1f2937, chrome = 0xcbd5e1;
      const b = group();
      // Frame, wheels and fenders
      [-0.55, 0.55].forEach(z => b.add(at(mesh(new THREE.BoxGeometry(6.6, 0.3, 0.28), dark), -0.1, 0.95, z)));
      [2.5, -1.6, -2.8].forEach(x => [-1.05, 1.05].forEach(z => b.add(at(wheel(0.62, 0.45), x, 0.62, z))));
      [-1.12, 1.12].forEach(z => {
        b.add(at(mesh(new THREE.BoxGeometry(2.7, 0.1, 0.55), dark), -2.2, 1.34, z));
        const arch = mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.5, 16, 1, true, -Math.PI / 2, Math.PI), red, { side: THREE.DoubleSide });
        arch.rotation.x = Math.PI / 2;
        b.add(at(arch, 2.5, 0.66, z));
      });
      // Cab: painted lower body, glass upper, pillars and a roof with marker lights
      b.add(at(mesh(new THREE.BoxGeometry(1.9, 1.25, 2.5), red), 2.5, 1.63, 0));
      b.add(at(mesh(new THREE.BoxGeometry(0.75, 0.95, 2.3), red), 3.8, 1.48, 0));
      b.add(at(mesh(new THREE.BoxGeometry(0.05, 0.75, 1.6), dark), 4.18, 1.48, 0));
      for (let i = 0; i < 5; i++) b.add(at(mesh(new THREE.BoxGeometry(0.06, 0.05, 1.5), chrome, { metalness: 0.9, roughness: 0.2 }), 4.2, 1.18 + i * 0.15, 0));
      [-0.85, 0.85].forEach(z => {
        const lamp = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 14), 0xfffbeb, { emissive: 0xfef3c7, emissiveIntensity: 0.6 });
        lamp.rotation.z = Math.PI / 2;
        b.add(at(lamp, 4.2, 1.7, z));
      });
      b.add(at(mesh(new THREE.BoxGeometry(0.28, 0.32, 2.7), dark), 4.25, 0.92, 0));
      b.add(at(glass(new THREE.BoxGeometry(1.8, 1.5, 2.4)), 2.5, 3.0, 0));
      [[1.6, -1.2], [1.6, 1.2], [3.4, -1.2], [3.4, 1.2]].forEach(([x, z]) => b.add(at(mesh(new THREE.BoxGeometry(0.12, 1.5, 0.12), red), x, 3.0, z)));
      b.add(at(mesh(new THREE.BoxGeometry(2.0, 0.16, 2.6), red), 2.5, 3.83, 0));
      [-0.6, 0, 0.6].forEach(z => b.add(at(mesh(new THREE.BoxGeometry(0.12, 0.1, 0.22), 0xf59e0b, { emissive: 0xf59e0b, emissiveIntensity: 0.4 }), 3.4, 3.95, z)));
      // Inside: a seat and a steering wheel
      b.add(at(mesh(new THREE.BoxGeometry(0.8, 0.22, 0.9), dark), 2.2, 1.14, -0.45));
      b.add(at(mesh(new THREE.BoxGeometry(0.2, 1.0, 0.9), dark), 1.8, 1.7, -0.45));
      const steer = mesh(new THREE.TorusGeometry(0.26, 0.04, 8, 20), dark);
      steer.rotation.y = Math.PI / 2;
      steer.rotation.x = 0.5;
      b.add(at(steer, 3.05, 2.15, -0.45));
      // Mirrors, steps, fuel tank and exhaust stack
      [-1, 1].forEach(s => {
        b.add(rod([3.3, 2.7, s * 1.25], [3.3, 2.7, s * 1.6], 0.03, dark));
        b.add(at(mesh(new THREE.BoxGeometry(0.08, 0.5, 0.26), dark), 3.3, 2.6, s * 1.62));
        b.add(at(mesh(new THREE.BoxGeometry(0.5, 0.06, 0.3), chrome, { metalness: 0.8 }), 2.0, 0.78, s * 1.3));
      });
      const tank = mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.0, 16), chrome, { metalness: 0.85, roughness: 0.25 });
      tank.rotation.z = Math.PI / 2;
      b.add(at(tank, 0.9, 1.0, -1.05));
      b.add(at(mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.4, 10), chrome, { metalness: 0.9, roughness: 0.2 }), 1.45, 2.6, 1.05));
      // The dump bed, hinged at the back so it can tip
      const bed = at(group(), -3.45, 1.15, 0);
      bed.add(at(mesh(new THREE.BoxGeometry(4.9, 0.15, 2.5), yellow), 2.45, 0.08, 0));
      [-1.2, 1.2].forEach(z => {
        bed.add(at(mesh(new THREE.BoxGeometry(4.9, 1.1, 0.12), yellow), 2.45, 0.7, z));
        [0.9, 1.9, 2.9, 3.9].forEach(x => bed.add(at(mesh(new THREE.BoxGeometry(0.12, 1.1, 0.08), 0xd99a00), x, 0.7, z * 1.06)));
        bed.add(at(mesh(new THREE.BoxGeometry(4.9, 0.12, 0.18), 0xd99a00), 2.45, 1.28, z));
      });
      bed.add(at(mesh(new THREE.BoxGeometry(0.15, 1.5, 2.5), yellow), 4.85, 0.9, 0));
      bed.add(at(mesh(new THREE.BoxGeometry(0.12, 1.1, 2.5), 0xd99a00), 0.06, 0.7, 0));
      bed.add(at(mesh(new THREE.BoxGeometry(0.9, 0.12, 2.5), yellow), 5.25, 1.62, 0));
      const load = mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0x7a4b2a, { roughness: 1, flatShading: true });
      load.scale.set(2.2, 0.6, 1.1);
      load.visible = false;
      bed.add(at(load, 2.45, 0.9, 0));
      b.add(bed);
      return miniature(b, { seat: { x: 2.2, y: 1.25 - KELO_SIT_OFFSET, z: -0.45 }, bed, loadMesh: load });
    }

function excavatorModel() {
      const yellow = 0xf4b400, dark = 0x1f2937, steel = 0x475569, chrome = 0xe2e8f0;
      const b = group();
      // Tracks: rounded ends, rollers and cleats
      [-1.05, 1.05].forEach(z => {
        b.add(at(mesh(new THREE.BoxGeometry(3.0, 0.7, 0.6), 0x111827, { roughness: 0.95 }), 0, 0.4, z));
        [-1.5, 1.5].forEach(x => {
          const end = mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 16), 0x111827, { roughness: 0.95 });
          end.rotation.x = Math.PI / 2;
          b.add(at(end, x, 0.4, z));
          const hub = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.64, 12), yellow);
          hub.rotation.x = Math.PI / 2;
          b.add(at(hub, x, 0.4, z));
        });
        for (let i = 0; i < 13; i++) b.add(at(mesh(new THREE.BoxGeometry(0.09, 0.06, 0.62), 0x374151), -1.45 + i * 0.24, 0.77, z));
        [-0.75, -0.25, 0.25, 0.75].forEach(x => {
          const roller = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.64, 10), steel);
          roller.rotation.x = Math.PI / 2;
          b.add(at(roller, x, 0.16, z));
        });
      });
      b.add(at(mesh(new THREE.BoxGeometry(1.6, 0.5, 1.5), dark), 0, 0.62, 0));
      b.add(at(mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.12, 24), dark), 0, 0.92, 0));
      // The upper house turns on the tracks
      const house = at(group(), 0, 0.98, 0);
      house.add(at(mesh(new THREE.BoxGeometry(1.8, 1.05, 2.4), yellow), -0.7, 0.55, 0));
      const counterweight = mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.05, 24), yellow);
      counterweight.scale.set(0.42, 1, 1);
      house.add(at(counterweight, -1.6, 0.55, 0));
      house.add(at(mesh(new THREE.BoxGeometry(0.9, 0.04, 0.9), dark), -0.9, 1.09, 0.6));
      house.add(at(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 8), chrome, { metalness: 0.9 }), -1.2, 1.35, 0.85));
      house.add(at(mesh(new THREE.BoxGeometry(1.4, 0.45, 1.15), yellow), 0.9, 0.3, 0.62));
      // Cab on the left with big windows and a roof
      house.add(at(mesh(new THREE.BoxGeometry(1.4, 0.3, 1.25), yellow), 0.9, 0.15, -0.62));
      house.add(at(glass(new THREE.BoxGeometry(1.4, 2.5, 1.25)), 0.9, 1.55, -0.62));
      [[0.2, -1.25], [0.2, 0], [1.6, -1.25], [1.6, 0]].forEach(([x, z]) => house.add(at(mesh(new THREE.BoxGeometry(0.1, 2.5, 0.1), dark), x, 1.55, z)));
      house.add(at(mesh(new THREE.BoxGeometry(1.55, 0.14, 1.4), yellow), 0.9, 2.87, -0.62));
      house.add(at(mesh(new THREE.BoxGeometry(0.6, 0.2, 0.7), dark), 0.75, 0.38, -0.62));
      house.add(at(mesh(new THREE.BoxGeometry(0.15, 0.8, 0.7), dark), 0.45, 0.8, -0.62));
      // Boom, stick and bucket, each on its own hinge, with chrome hydraulic rams
      const boom = at(group(), 1.1, 0.7, 0.62);
      boom.rotation.z = 0.75;
      boom.add(at(mesh(new THREE.BoxGeometry(3.2, 0.38, 0.32), yellow), 1.6, 0, 0));
      boom.add(rod([0.3, -0.35, 0], [2.2, -0.2, 0], 0.07, chrome, { metalness: 0.9, roughness: 0.2 }));
      boom.add(rod([0.3, -0.35, 0], [1.1, -0.29, 0], 0.11, steel));
      const stick = at(group(), 3.2, 0, 0);
      stick.rotation.z = -1.95;
      stick.add(at(mesh(new THREE.BoxGeometry(2.4, 0.3, 0.26), yellow), 1.2, 0, 0));
      stick.add(rod([0.1, 0.26, 0], [2.1, 0.22, 0], 0.06, chrome, { metalness: 0.9, roughness: 0.2 }));
      const bucket = at(group(), 2.4, 0, 0);
      bucket.rotation.z = 0.5;
      const scoop = slab([[0, 0.15], [0.55, 0.2], [0.85, -0.1], [0.75, -0.55], [0.35, -0.6], [0.05, -0.25]], 0.75, steel, { metalness: 0.5 });
      bucket.add(scoop);
      for (let i = 0; i < 4; i++) {
        const tooth = mesh(new THREE.ConeGeometry(0.06, 0.2, 4), 0x94a3b8, { metalness: 0.8 });
        tooth.rotation.z = Math.PI * 0.85;
        bucket.add(at(tooth, 0.8, -0.62, -0.28 + i * 0.19));
      }
      stick.add(bucket);
      boom.add(stick);
      house.add(boom);
      b.add(house);
      return miniature(b, { seat: { x: 0.75, y: 1.33 - KELO_SIT_OFFSET, z: -0.62 }, house, boom });
    }

// A rowboat hull lofted from U-shaped sections: pointed bow (+x), flat transom at the stern
function hullGeometry(len, beam, depth, sheer) {
      const nx = 24, nu = 12, pos = [], idx = [];
      for (let i = 0; i <= nx; i++) {
        const t = (i / nx) * 2 - 1;
        const x = (t * len) / 2;
        const taper = t > 0 ? Math.sqrt(Math.max(0, 1 - Math.pow(t, 1.8))) : Math.max(0.55, Math.sqrt(1 - Math.pow(-t, 3.5)));
        const w = Math.max(0.02, (beam / 2) * taper);
        const top = sheer * t * t;
        const d = depth * (1 - 0.35 * Math.pow(Math.abs(t), 3));
        for (let j = 0; j <= nu; j++) {
          const a = (Math.PI * j) / nu;
          pos.push(x, top - d * Math.sin(a), w * Math.cos(a));
        }
      }
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nu; j++) {
          const a = i * (nu + 1) + j, c = a + nu + 1;
          idx.push(a, a + 1, c, c, a + 1, c + 1);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      geo.userData = { nx, nu, pos };
      return geo;
    }

function rowboatModel() {
      const len = 4.6, beam = 1.7, depth = 0.75, sheer = 0.25, lift = 0.35;
      const b = group();
      const geo = hullGeometry(len, beam, depth, sheer);
      b.add(at(mesh(geo, 0xf8fafc, { side: THREE.FrontSide }), 0, lift, 0));
      b.add(at(mesh(geo, 0xb7793e, { side: THREE.BackSide, roughness: 0.8 }), 0, lift, 0));
      // Teal stripe and wooden gunwales along the top edges
      const { nx, nu, pos } = geo.userData;
      [0, nu].forEach(j => {
        const pts = [], stripe = [];
        for (let i = 0; i <= nx; i++) {
          const k = (i * (nu + 1) + j) * 3;
          pts.push(new THREE.Vector3(pos[k], pos[k + 1] + lift, pos[k + 2]));
          stripe.push(new THREE.Vector3(pos[k], pos[k + 1] + lift - 0.18, pos[k + 2] * 0.97));
        }
        b.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.06, 6), new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.8 })));
        b.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stripe), 40, 0.035, 6), new THREE.MeshStandardMaterial({ color: 0x0d9488 })));
      });
      // Flat transom at the stern
      const stern = [];
      for (let j = 0; j <= nu; j++) stern.push(new THREE.Vector2(pos[j * 3 + 2], pos[j * 3 + 1]));
      const transom = mesh(new THREE.ShapeGeometry(new THREE.Shape(stern)), 0xf8fafc, { side: THREE.DoubleSide });
      transom.rotation.y = Math.PI / 2;
      b.add(at(transom, -len / 2, lift, 0));
      // Floorboards just above the waterline, cut to the hull's shape, so the lake doesn't show inside the boat
      // (the boat sits 0.05 below the water surface, so the surface is at y = 0.05 here)
      const floorY = 0.13, side = [];
      for (let i = 0; i <= nx; i++) {
        const t = (i / nx) * 2 - 1, k = (i * (nu + 1)) * 3;
        const top = pos[k + 1] + lift;                       // gunwale height at this station
        const halfBeam = Math.abs(pos[k + 2]);               // hull half-width at the gunwale
        const d = depth * (1 - 0.35 * Math.pow(Math.abs(t), 3));
        const below = (top - floorY) / d;                    // how far down the U the floor sits
        if (below >= 1) continue;
        side.push([(t * len) / 2, halfBeam * Math.sqrt(1 - below * below) * 0.97]);
      }
      if (side.length > 2) {
        const outline = new THREE.Shape([...side.map(([x, w]) => new THREE.Vector2(x, w)), ...side.slice().reverse().map(([x, w]) => new THREE.Vector2(x, -w))]);
        const floor = mesh(new THREE.ShapeGeometry(outline), 0x9a6b3f, { side: THREE.DoubleSide, roughness: 0.85 });
        floor.rotation.x = -Math.PI / 2;
        b.add(at(floor, 0, floorY, 0));
        for (let k = -2; k <= 2; k++) b.add(at(mesh(new THREE.BoxGeometry(len * 0.7, 0.012, 0.025), 0x7c5230), 0, floorY + 0.007, k * 0.12));
      }
      // Thwarts (seats), oarlocks and a pair of oars
      [[-0.9, 1.3], [0.5, 1.45]].forEach(([x, w]) => b.add(at(mesh(new THREE.BoxGeometry(0.32, 0.07, w), 0xa16207), x, 0.05 + lift * 0.2, 0)));
      [-1, 1].forEach(s => {
        b.add(rod([0.05, 0.52, s * 0.8], [-0.7, -0.05, s * 2.3], 0.04, 0xd6a35c));
        const blade = mesh(new THREE.BoxGeometry(0.55, 0.03, 0.2), 0xd6a35c);
        blade.rotation.y = Math.atan2(0.75, 1.5) * s + Math.PI / 2;
        blade.rotation.z = 0.3;
        b.add(at(blade, -0.82, -0.12, s * 2.55));
        b.add(at(mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 12), 0x64748b, { metalness: 0.8 }), 0.05, 0.6, s * 0.8));
      });
      return miniature(b, { seat: { x: -0.9, y: 0.13 - KELO_SIT_OFFSET, z: 0 } });
    }

function bicycleModel() {
      const frameColor = 0x0d9488, dark = 0x111827, silver = 0xcbd5e1;
      const b = group();
      [-0.85, 0.85].forEach(x => {
        const tyre = mesh(new THREE.TorusGeometry(0.52, 0.06, 10, 32), dark, { roughness: 0.95 });
        const rim = mesh(new THREE.TorusGeometry(0.46, 0.025, 6, 32), silver, { metalness: 0.8 });
        const w = group(tyre, rim);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI;
          w.add(rod([Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0], [-Math.cos(a) * 0.45, -Math.sin(a) * 0.45, 0], 0.008, silver));
        }
        const hub = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 10), silver, { metalness: 0.8 });
        hub.rotation.x = Math.PI / 2;
        w.add(hub);
        b.add(at(w, x, 0.58, 0));
      });
      const rear = [-0.85, 0.58], bb = [-0.05, 0.5], seatTop = [-0.3, 1.28], headTop = [0.62, 1.3], headLow = [0.68, 1.02], front = [0.85, 0.58];
      const tube = (a, c, r = 0.04, z = 0) => b.add(rod([a[0], a[1], z], [c[0], c[1], z], r, frameColor, { metalness: 0.4, roughness: 0.4 }));
      tube(seatTop, headTop);
      tube(headLow, bb, 0.05);
      tube(bb, seatTop);
      [-0.08, 0.08].forEach(z => {
        tube(bb, rear, 0.025, z);
        tube(seatTop, rear, 0.025, z);
        b.add(rod([headLow[0], headLow[1], z], [front[0], front[1], z], 0.025, silver, { metalness: 0.8 }));
      });
      tube(headLow, headTop, 0.045);
      // Stem, handlebar and grips; seatpost and saddle
      b.add(rod([0.62, 1.3, 0], [0.6, 1.5, 0], 0.035, silver, { metalness: 0.8 }));
      b.add(rod([0.6, 1.5, -0.38], [0.6, 1.5, 0.38], 0.03, silver, { metalness: 0.8 }));
      [-0.38, 0.38].forEach(z => b.add(rod([0.6, 1.5, z], [0.6, 1.5, z + Math.sign(z) * 0.12], 0.045, dark)));
      b.add(rod([-0.3, 1.28, 0], [-0.33, 1.42, 0], 0.03, silver, { metalness: 0.8 }));
      const saddle = slab([[-0.2, 0], [0.25, 0.01], [0.28, 0.05], [-0.18, 0.08], [-0.25, 0.05]], 0.2, dark);
      b.add(at(saddle, -0.33, 1.42, 0));
      // Crank, chainring and pedals
      const ring = mesh(new THREE.TorusGeometry(0.13, 0.02, 6, 20), silver, { metalness: 0.9 });
      b.add(at(ring, -0.05, 0.5, 0.11));
      b.add(rod([-0.05, 0.5, 0.13], [0.1, 0.3, 0.13], 0.025, silver));
      b.add(rod([-0.05, 0.5, -0.13], [-0.2, 0.7, -0.13], 0.025, silver));
      b.add(at(mesh(new THREE.BoxGeometry(0.16, 0.04, 0.14), dark), 0.1, 0.3, 0.22));
      b.add(at(mesh(new THREE.BoxGeometry(0.16, 0.04, 0.14), dark), -0.2, 0.7, -0.22));
      return miniature(b, { seat: { x: -0.35, y: 1.5 - KELO_SIT_OFFSET, z: 0 } });
    }

function snowmobileModel() {
      const red = 0xdc2626, dark = 0x111827, silver = 0x94a3b8;
      const b = group();
      // Skis with upturned tips, on struts
      [-0.6, 0.6].forEach(z => {
        b.add(at(mesh(new THREE.BoxGeometry(1.5, 0.05, 0.2), dark), 1.25, 0.05, z));
        const tip = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
          new THREE.Vector3(1.95, 0.05, z), new THREE.Vector3(2.15, 0.12, z), new THREE.Vector3(2.25, 0.3, z)]), 8, 0.05, 6), new THREE.MeshStandardMaterial({ color: dark }));
        b.add(tip);
        b.add(rod([1.2, 0.08, z], [1.0, 0.5, z * 0.7], 0.04, silver, { metalness: 0.8 }));
      });
      // Track under a tunnel
      b.add(at(mesh(new THREE.BoxGeometry(2.3, 0.35, 0.8), 0x0b0f17, { roughness: 1 }), -0.75, 0.2, 0));
      for (let i = 0; i < 10; i++) b.add(at(mesh(new THREE.BoxGeometry(0.06, 0.06, 0.82), 0x374151), -1.8 + i * 0.23, 0.02, 0));
      b.add(at(mesh(new THREE.BoxGeometry(2.4, 0.12, 1.0), dark), -0.75, 0.45, 0));
      // Hood, windshield, handlebar and a long padded seat
      const hood = slab([[-0.1, 0.4], [1.55, 0.45], [1.8, 0.68], [1.3, 1.02], [0.3, 1.08], [-0.1, 0.92]], 1.1, red, { metalness: 0.3 });
      b.add(hood);
      b.add(at(mesh(new THREE.BoxGeometry(0.4, 0.06, 1.12), 0xffffff), 1.0, 0.98, 0));
      const shield = glass(new THREE.BoxGeometry(0.04, 0.5, 0.9));
      shield.rotation.z = 0.6;
      b.add(at(shield, 0.42, 1.3, 0));
      b.add(rod([0.15, 1.2, -0.45], [0.15, 1.2, 0.45], 0.03, silver, { metalness: 0.8 }));
      b.add(at(mesh(new THREE.BoxGeometry(1.4, 0.26, 0.6), dark), -0.8, 0.98, 0));
      const light = mesh(new THREE.BoxGeometry(0.05, 0.12, 0.5), 0xef4444, { emissive: 0xef4444, emissiveIntensity: 0.5 });
      b.add(at(light, -1.96, 0.55, 0));
      return miniature(b, { seat: { x: -0.6, y: 1.11 - KELO_SIT_OFFSET, z: 0 } });
    }

function helicopterModel() {
      const body = 0x2563eb, dark = 0x1f2937, silver = 0xcbd5e1;
      const b = group();
      // Skids on struts
      [-0.95, 0.95].forEach(z => {
        b.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
          new THREE.Vector3(-1.6, 0.12, z), new THREE.Vector3(1.6, 0.12, z), new THREE.Vector3(1.95, 0.35, z)]), 16, 0.06, 6), new THREE.MeshStandardMaterial({ color: silver, metalness: 0.8 })));
        [-0.9, 0.9].forEach(x => b.add(rod([x, 0.12, z], [x * 0.8, 0.9, z * 0.6], 0.05, silver, { metalness: 0.8 })));
      });
      // Cabin: painted belly and a glass bubble big enough for Kelo-1
      const belly = mesh(new THREE.SphereGeometry(1.6, 24, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), body, { metalness: 0.3 });
      belly.scale.set(1.25, 0.6, 0.85);
      b.add(at(belly, 0, 1.6, 0));
      const bubble = glass(new THREE.SphereGeometry(1.6, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2));
      bubble.scale.set(1.25, 1.45, 0.85);
      b.add(at(bubble, 0, 1.6, 0));
      b.add(at(mesh(new THREE.BoxGeometry(1.4, 1.0, 1.6), body), -1.3, 2.2, 0));
      b.add(at(mesh(new THREE.BoxGeometry(0.7, 0.22, 1.0), dark), -0.2, 1.38, 0));
      // Tail boom, fin and tail rotor
      b.add(rod([-1.8, 2.4, 0], [-5.6, 2.7, 0], 0.16, body, { metalness: 0.3 }));
      const fin = slab([[-5.9, 2.4], [-5.4, 2.6], [-5.6, 3.6], [-6.0, 3.6]], 0.08, body);
      b.add(fin);
      b.add(at(mesh(new THREE.BoxGeometry(0.8, 0.06, 1.3), body), -5.4, 2.7, 0));
      const tailRotor = at(group(), -5.75, 2.9, 0.12);
      [0, Math.PI / 2].forEach(a => {
        const blade = mesh(new THREE.BoxGeometry(1.1, 0.12, 0.03), dark);
        blade.rotation.z = a;
        tailRotor.add(blade);
      });
      b.add(tailRotor);
      // Mast and the main rotor
      b.add(at(mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 10), silver, { metalness: 0.8 }), -0.6, 3.55, 0));
      const rotor = at(group(), -0.6, 4.05, 0);
      rotor.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.15, 12), dark));
      [0, Math.PI].forEach(a => {
        const blade = at(mesh(new THREE.BoxGeometry(5.0, 0.05, 0.32), dark), Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6);
        blade.rotation.y = a;
        rotor.add(blade);
      });
      b.add(rotor);
      return miniature(b, { seat: { x: 0.0, y: 1.58 - KELO_SIT_OFFSET, z: 0 }, rotor, tailRotor });
    }

function hotAirBalloonModel() {
      const b = group();
      // Wicker basket with a padded rim
      b.add(at(mesh(new THREE.BoxGeometry(1.7, 1.15, 1.7), 0x9a6b3f, { roughness: 1 }), 0, 0.58, 0));
      for (let i = 0; i < 6; i++) b.add(at(mesh(new THREE.BoxGeometry(1.72, 0.04, 1.72), 0x7c5230), 0, 0.15 + i * 0.18, 0));
      const rim = mesh(new THREE.TorusGeometry(1.2, 0.08, 6, 4), 0x5b3a1e);
      rim.rotation.set(Math.PI / 2, 0, Math.PI / 4);
      b.add(at(rim, 0, 1.17, 0));
      // Burner frame, burner, and cables up to the envelope
      [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].forEach(([x, z]) => {
        b.add(rod([x, 1.15, z], [x * 0.45, 3.4, z * 0.45], 0.025, 0x94a3b8, { metalness: 0.8 }));
        b.add(rod([x * 0.45, 3.4, z * 0.45], [x * 0.9, 4.1, z * 0.9], 0.015, 0x334155));
      });
      b.add(at(mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.4, 14), 0x94a3b8, { metalness: 0.9, roughness: 0.25 }), 0, 3.45, 0));
      const flame = mesh(new THREE.ConeGeometry(0.16, 0.5, 10), 0xfb923c, { emissive: 0xf97316, emissiveIntensity: 0.9 });
      b.add(at(flame, 0, 3.85, 0));
      // Envelope: alternating coloured gores spun from one profile
      const profile = [[0.75, 0], [1.4, 0.7], [2.8, 2.4], [3.5, 4.3], [3.6, 5.6], [3.3, 7.0], [2.5, 8.2], [1.2, 8.9], [0.01, 9.05]].map(([r, y]) => new THREE.Vector2(r, y));
      const gores = 12;
      for (let i = 0; i < gores; i++) {
        const geo = new THREE.LatheGeometry(profile, 3, (i / gores) * Math.PI * 2, (Math.PI * 2) / gores);
        b.add(at(mesh(geo, i % 2 ? 0xfacc15 : 0xdc2626, { side: THREE.DoubleSide }), 0, 4.1, 0));
      }
      return miniature(b, { seat: { x: 0, y: 0.75 - KELO_SIT_OFFSET, z: 0 }, flame });
    }

// A ring of keys: what Kelo-1 carries home when a vehicle arrives
function keysModel() {
      const ring = mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 20), 0xcbd5e1, { metalness: 0.9 });
      ring.rotation.x = Math.PI / 2;
      const key = slab([[0, -0.03], [0.22, -0.03], [0.22, 0.0], [0.26, 0.0], [0.26, -0.02], [0.3, -0.02], [0.3, 0.02], [0.08, 0.02], [0.08, 0.05], [0, 0.05]], 0.012, 0xfacc15, { metalness: 0.85, roughness: 0.3 });
      key.rotation.x = -Math.PI / 2;
      const fob = mesh(new THREE.BoxGeometry(0.1, 0.03, 0.16), 0x111827);
      return group(at(ring, 0, 0.02, 0), at(key, 0.06, 0.02, 0), at(fob, -0.12, 0.02, 0));
    }

// --- Tools (item units: about a metre) ---------------------------------------------------------
function clawHammerModel() {
      const handle = mesh(new THREE.LatheGeometry([[0.0, 0], [0.022, 0.0], [0.025, 0.05], [0.02, 0.2], [0.016, 0.3], [0.0, 0.31]].map(([r, y]) => new THREE.Vector2(r, y)), 14), 0xa16207);
      const grip = mesh(new THREE.CylinderGeometry(0.027, 0.026, 0.12, 14), 0x111827, { roughness: 0.9 });
      const steel = { metalness: 0.85, roughness: 0.3 };
      const face = mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.07, 14), 0x94a3b8, steel);
      face.rotation.z = Math.PI / 2;
      const neck = mesh(new THREE.BoxGeometry(0.07, 0.05, 0.035), 0x94a3b8, steel);
      const claw = slab([[0, 0.025], [-0.05, 0.03], [-0.1, 0.0], [-0.13, -0.05], [-0.1, -0.035], [-0.06, -0.01], [0, -0.02]], 0.03, 0x94a3b8, steel);
      return group(handle, at(grip, 0, 0.07, 0), at(face, 0.06, 0.32, 0), at(neck, 0.0, 0.32, 0), at(claw, -0.03, 0.32, 0));
    }

function wrenchModel() {
      const steel = { metalness: 0.9, roughness: 0.25 };
      const outline = [[-0.13, -0.012], [0.1, -0.012], [0.12, -0.03], [0.17, -0.03], [0.19, -0.012], [0.155, -0.008], [0.155, 0.008], [0.19, 0.012], [0.17, 0.03], [0.12, 0.03], [0.1, 0.012], [-0.13, 0.012]];
      const body = slab(outline, 0.012, 0xcbd5e1, steel);
      const ringEnd = mesh(new THREE.TorusGeometry(0.026, 0.01, 8, 18), 0xcbd5e1, steel);
      const w = group(body, at(ringEnd, -0.15, 0, 0));
      w.rotation.x = -Math.PI / 2;
      w.position.y = 0.01;
      return group(w);
    }

function handSawModel() {
      const teeth = [];
      for (let x = 0.55; x >= 0.0; x -= 0.025) teeth.push([x, -0.06 + (Math.round(x / 0.025) % 2 ? -0.012 : 0)]);
      const blade = slab([[0, 0.06], [0.55, 0.02], ...teeth], 0.004, 0xcbd5e1, { metalness: 0.9, roughness: 0.2 });
      const handle = slab([[-0.17, 0.08], [0.02, 0.08], [0.02, -0.07], [-0.1, -0.07], [-0.19, -0.02]], 0.035, 0xa16207, {}, [circlePath(-0.08, 0.01, 0.035)]);
      const g = group(blade, handle);
      g.rotation.z = Math.PI / 2;
      g.position.set(0, 0.2, 0);
      return group(g);
    }

function axeModel() {
      const haft = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.03, 0.25, 0), new THREE.Vector3(-0.01, 0.5, 0), new THREE.Vector3(0.0, 0.72, 0)]), 16, 0.022, 8), new THREE.MeshStandardMaterial({ color: 0xc8955a, roughness: 0.7 }));
      haft.castShadow = true;
      const head = slab([[-0.04, 0.035], [0.05, 0.03], [0.17, 0.09], [0.19, 0.0], [0.17, -0.09], [0.05, -0.04], [-0.04, -0.035]], 0.035, 0x475569, { metalness: 0.8, roughness: 0.35 });
      const edge = slab([[0.15, 0.085], [0.19, 0.0], [0.15, -0.085], [0.165, 0.0]], 0.036, 0xe2e8f0, { metalness: 0.95, roughness: 0.15 });
      return group(haft, at(head, 0, 0.66, 0), at(edge, 0, 0.66, 0));
    }

function pliersModel() {
      const steel = { metalness: 0.85, roughness: 0.3 };
      const half = (s) => {
        const jaw = slab([[0, 0], [0.08, s * 0.012], [0.1, s * 0.004], [0, -s * 0.01]], 0.014, 0x94a3b8, steel);
        const arm = rod([0, 0, 0], [-0.17, s * 0.045, 0], 0.01, 0x94a3b8, steel);
        const grip = rod([-0.06, s * 0.016, 0], [-0.19, s * 0.05, 0], 0.016, 0xdc2626, { roughness: 0.8 });
        return group(jaw, arm, grip);
      };
      const g = group(half(1), half(-1), mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 10), 0x64748b));
      g.children[2].rotation.x = Math.PI / 2;
      g.rotation.x = -Math.PI / 2;
      g.position.y = 0.02;
      return group(g);
    }

function screwdriverModel() {
      const handle = mesh(new THREE.LatheGeometry([[0, 0], [0.018, 0.0], [0.024, 0.02], [0.024, 0.09], [0.016, 0.11], [0.008, 0.115], [0, 0.115]].map(([r, y]) => new THREE.Vector2(r, y)), 12), 0xf59e0b, { transparent: true, opacity: 0.9 });
      const shaft = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.13, 8), 0xcbd5e1, { metalness: 0.9 });
      const tip = mesh(new THREE.BoxGeometry(0.012, 0.015, 0.002), 0xcbd5e1, { metalness: 0.9 });
      return group(handle, at(shaft, 0, 0.18, 0), at(tip, 0, 0.25, 0));
    }

function knifeModel() {
      const blade = slab([[0, 0.012], [0.12, 0.012], [0.17, 0.0], [0.14, -0.012], [0, -0.014]], 0.003, 0xe2e8f0, { metalness: 0.95, roughness: 0.15 });
      const handle = slab([[-0.11, 0.013], [0, 0.015], [0, -0.016], [-0.11, -0.012], [-0.12, 0]], 0.02, 0x3f2a14);
      const g = group(blade, handle);
      g.rotation.x = -Math.PI / 2;
      g.position.y = 0.01;
      return group(g);
    }

function cordlessDrillModel() {
      const body = slab([[-0.09, 0.0], [0.08, 0.0], [0.1, 0.03], [0.1, 0.06], [-0.09, 0.07], [-0.11, 0.035]], 0.06, 0xf59e0b);
      const grip = slab([[-0.04, 0], [0.01, 0], [0.0, -0.13], [-0.05, -0.13]], 0.045, 0x111827, { roughness: 0.85 });
      const battery = at(mesh(new THREE.BoxGeometry(0.1, 0.045, 0.075), 0x111827), -0.025, -0.155, 0);
      const chuck = mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.05, 12), 0x1f2937, { metalness: 0.6 });
      chuck.rotation.z = -Math.PI / 2;
      const bit = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 8), 0xcbd5e1, { metalness: 0.9 });
      bit.rotation.z = -Math.PI / 2;
      const trigger = at(mesh(new THREE.BoxGeometry(0.012, 0.03, 0.02), 0xdc2626), 0.012, -0.025, 0);
      const g = group(body, grip, battery, at(chuck, 0.125, 0.035, 0), at(bit, 0.19, 0.035, 0), trigger);
      g.position.y = 0.18;
      return group(g);
    }

function toolboxModel() {
      const red = 0xdc2626;
      const box = at(mesh(new THREE.BoxGeometry(0.5, 0.22, 0.24), red, { metalness: 0.4 }), 0, 0.11, 0);
      const lid = at(mesh(new THREE.BoxGeometry(0.52, 0.05, 0.26), 0xb91c1c, { metalness: 0.4 }), 0, 0.245, 0);
      const handle = rod([-0.12, 0.3, 0], [0.12, 0.3, 0], 0.012, 0x111827);
      const posts = [-0.12, 0.12].map(x => rod([x, 0.27, 0], [x, 0.31, 0], 0.01, 0x111827));
      const latches = [-0.17, 0.17].map(x => at(mesh(new THREE.BoxGeometry(0.04, 0.05, 0.01), 0xcbd5e1, { metalness: 0.9 }), x, 0.21, 0.125));
      return group(box, lid, handle, ...posts, ...latches);
    }

function telescopeModel() {
      const g = group();
      // Tripod and mount
      [0, 2.1, 4.2].forEach(a => g.add(rod([0, 0.75, 0], [Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32], 0.018, 0x334155, { metalness: 0.6 })));
      g.add(at(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 12), 0x1f2937), 0, 0.8, 0));
      // Tube with dew shield, focuser, eyepiece and a little finder scope
      const tube = group(
        at(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.8, 18), 0xf8fafc, { metalness: 0.2 }), 0, 0, 0),
        at(mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.18, 18), 0x111827), 0, 0.46, 0),
        at(mesh(new THREE.CircleGeometry(0.07, 18), 0x60a5fa, { metalness: 0.5, roughness: 0.05 }), 0, 0.42, 0),
        at(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 10), 0x1f2937), 0, -0.45, 0),
        at(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.07, 10), 0x111827), 0, -0.54, 0),
        at(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 10), 0x1f2937), 0.1, 0.1, 0)
      );
      tube.children[2].rotation.x = -Math.PI / 2;
      tube.rotation.z = -1.0;
      tube.position.set(0, 0.92, 0);
      g.add(tube);
      return g;
    }

function skisModel() {
      const g = group();
      [-0.06, 0.06].forEach(z => {
        const geo = new THREE.BoxGeometry(1.6, 0.02, 0.09, 24, 1, 1);
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i);
          if (x > 0.62) p.setY(i, p.getY(i) + Math.pow((x - 0.62) / 0.18, 2) * 0.05);
        }
        geo.computeVertexNormals();
        g.add(at(mesh(geo, 0x2563eb), 0, 0.02, z));
        g.add(at(mesh(new THREE.BoxGeometry(0.2, 0.06, 0.1), 0x111827), -0.05, 0.06, z));
      });
      [-0.2, 0.2].forEach(z => g.add(rod([-0.4, 0.04, z], [0.6, 0.12, z], 0.01, 0x94a3b8, { metalness: 0.8 })));
      return g;
    }

function snowshoesModel() {
      const g = group();
      [-0.16, 0.16].forEach(z => {
        const frame = mesh(new THREE.TorusGeometry(0.14, 0.012, 6, 24), 0x334155, { metalness: 0.6 });
        frame.scale.set(1.9, 1, 1);
        frame.rotation.x = Math.PI / 2;
        const deck = mesh(new THREE.CircleGeometry(0.14, 24), 0x1d4ed8, { side: THREE.DoubleSide });
        deck.scale.set(1.9, 1, 1);
        deck.rotation.x = -Math.PI / 2;
        const binding = mesh(new THREE.BoxGeometry(0.12, 0.05, 0.1), 0x111827);
        g.add(at(frame, 0, 0.015, z), at(deck, 0, 0.012, z), at(binding, 0.03, 0.04, z));
      });
      return g;
    }
