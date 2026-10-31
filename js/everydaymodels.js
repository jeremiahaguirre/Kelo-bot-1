// Kelo-bot-1 — js/everydaymodels.js
// Loaded after gearmodels.js. Food, toys, instruments and books, built at their real size in metres
// (items3d.js marks them realSize, so they show at life size next to Kelo-1). Uses the helpers from
// items3d.js (mesh, group) and gearmodels.js (at, rod, slab).

function lathe(profile, color, extra = {}, segments = 20) {
      return mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments), color, extra);
    }

// --- Food ---------------------------------------------------------------------------------------
function loafModel(lower) {
      if (/baguette/.test(lower)) {
        // Long and round with tapered ends, lying on its side
        const stick = lathe([[0, -0.3], [0.018, -0.29], [0.033, -0.25], [0.036, 0], [0.033, 0.25], [0.018, 0.29], [0, 0.3]], 0xd6a35c, {}, 14);
        stick.rotation.z = Math.PI / 2;
        const g = group(at(stick, 0, 0.035, 0));
        [-0.18, -0.06, 0.06, 0.18].forEach(x => {
          const cut = at(mesh(new THREE.BoxGeometry(0.05, 0.006, 0.02), 0xf3d9a4), x, 0.068, 0);
          cut.rotation.y = 0.6;
          g.add(cut);
        });
        return g;
      }
      if (/croissant/.test(lower)) {
        const c = mesh(new THREE.TorusGeometry(0.06, 0.03, 10, 16, Math.PI * 1.2), 0xd99a4a);
        c.rotation.x = -Math.PI / 2;
        c.scale.set(1, 1, 0.7);
        return group(at(c, 0, 0.022, 0));
      }
      if (/\bbun\b/.test(lower)) return group(at(lathe([[0, 0], [0.05, 0], [0.055, 0.02], [0.04, 0.045], [0, 0.055]], 0xd6a35c), 0, 0, 0));
      // A sourdough loaf with a dusting of flour and slashes across the top
      const loaf = mesh(new THREE.SphereGeometry(0.1, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0xc98a46);
      loaf.scale.set(1.5, 0.95, 1.0);
      const base = mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.02, 18), 0xb07434);
      base.scale.set(1, 1, 0.67);
      const g = group(at(base, 0, 0.01, 0), at(loaf, 0, 0.015, 0));
      return g;
    }

function bakedModel(lower) {
      if (/cookie/.test(lower)) {
        const g = group();
        [[0, 0, 0], [0.09, 0.012, 0.02], [0.04, 0.024, -0.05]].forEach(([x, y, z]) => {
          const c = at(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 16), 0xc98a46), x, 0.006 + y, z);
          for (let i = 0; i < 5; i++) c.add(at(mesh(new THREE.BoxGeometry(0.008, 0.006, 0.008), 0x3f2a14), Math.cos(i * 1.3) * 0.022, 0.007, Math.sin(i * 1.3) * 0.022));
          g.add(c);
        });
        return g;
      }
      if (/cake/.test(lower)) {
        const g = group(
          at(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 24), 0xfbcfe8), 0, 0.035, 0),
          at(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 24), 0xfbcfe8), 0, 0.1, 0),
          at(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.008, 24), 0xf8fafc), 0, 0.0, 0)
        );
        for (let i = 0; i < 12; i++) g.add(at(mesh(new THREE.SphereGeometry(0.008, 6, 4), 0xf472b6), Math.cos(i / 12 * Math.PI * 2) * 0.108, 0.07, Math.sin(i / 12 * Math.PI * 2) * 0.108));
        g.add(at(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.04, 6), 0x60a5fa), 0, 0.15, 0));
        g.add(at(mesh(new THREE.ConeGeometry(0.005, 0.014, 6), 0xfbbf24, { emissive: 0xf59e0b, emissiveIntensity: 0.8 }), 0, 0.178, 0));
        return g;
      }
      // A pie or tart in its dish, with a lattice top
      const dish = lathe([[0, 0], [0.1, 0], [0.12, 0.035], [0.125, 0.035], [0, 0.03]], 0xe9b872);
      const filling = at(mesh(new THREE.CylinderGeometry(0.108, 0.108, 0.006, 22), /cherr|berr/.test(lower) ? 0x9f1239 : 0xb45309), 0, 0.03, 0);
      const g = group(dish, filling);
      [-0.06, -0.02, 0.02, 0.06].forEach(o => {
        g.add(at(mesh(new THREE.BoxGeometry(0.2, 0.006, 0.014), 0xf0c987), 0, 0.036, o));
        g.add(at(mesh(new THREE.BoxGeometry(0.014, 0.008, 0.2), 0xf0c987), o, 0.038, 0));
      });
      return g;
    }

function noodleBowlModel() {
      const bowl = lathe([[0, 0], [0.04, 0], [0.04, 0.008], [0.085, 0.04], [0.1, 0.08], [0.095, 0.08], [0.08, 0.042], [0.035, 0.012], [0, 0.012]], 0xf8fafc, { side: THREE.DoubleSide });
      const broth = at(mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.004, 22), 0xe8a33d), 0, 0.068, 0);
      const g = group(bowl, broth);
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05;
        g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
          new THREE.Vector3(Math.cos(a) * 0.06, 0.07, Math.sin(a) * 0.06), new THREE.Vector3(0, 0.074, 0), new THREE.Vector3(Math.cos(a + 2.6) * 0.06, 0.07, Math.sin(a + 2.6) * 0.06)]), 10, 0.004, 4), new THREE.MeshStandardMaterial({ color: 0xfde68a })));
      }
      const egg = at(mesh(new THREE.SphereGeometry(0.022, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xf8fafc), 0.03, 0.068, 0.02);
      egg.add(at(mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.002, 10), 0xf59e0b), 0, 0.002, 0));
      g.add(egg, at(mesh(new THREE.BoxGeometry(0.03, 0.002, 0.04), 0x14532d), -0.03, 0.072, -0.02));
      [-0.008, 0.008].forEach(z => g.add(rod([-0.05, 0.085, z], [0.16, 0.11, z * 2.5], 0.003, 0xa16207)));
      return g;
    }

function cheeseModel() {
      const wedge = slab([[0, 0], [0.16, 0], [0, 0.09]], 0.09, 0xfacc15);
      wedge.rotation.x = -Math.PI / 2;
      const g = group(at(wedge, -0.05, 0.045, 0));
      [[0.02, 0.06, 0.046], [0.0, 0.03, -0.046], [-0.02, 0.07, 0.046]].forEach(([x, y, z]) => {
        const hole = mesh(new THREE.CircleGeometry(0.008, 10), 0xd4a20c);
        if (z < 0) hole.rotation.y = Math.PI;
        g.add(at(hole, x, y - 0.02, z));
      });
      return g;
    }

function pizzaModel() {
      const g = group(
        at(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.01, 28), 0xf2c46d), 0, 0.005, 0),
        at(mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.004, 28), 0xdc2626), 0, 0.011, 0),
        at(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.003, 28), 0xfde68a), 0, 0.014, 0)
      );
      const crust = mesh(new THREE.TorusGeometry(0.143, 0.012, 6, 28), 0xd99a4a);
      crust.rotation.x = Math.PI / 2;
      g.add(at(crust, 0, 0.012, 0));
      for (let i = 0; i < 9; i++) {
        const a = i * 2.39, r = 0.03 + (i % 3) * 0.035;
        g.add(at(mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.004, 12), 0xb91c1c), Math.cos(a) * r, 0.017, Math.sin(a) * r));
      }
      return g;
    }

function chocolateModel() {
      const g = group(at(mesh(new THREE.BoxGeometry(0.16, 0.012, 0.08), 0x5b3a1e), 0, 0.006, 0));
      for (let i = 0; i < 8; i++) g.add(at(mesh(new THREE.BoxGeometry(0.034, 0.006, 0.034), 0x4a2c17), -0.06 + (i % 4) * 0.04, 0.015, i < 4 ? -0.019 : 0.019));
      const wrapper = at(mesh(new THREE.BoxGeometry(0.06, 0.014, 0.084), 0xdc2626), 0.07, 0.007, 0);
      return group(...g.children, wrapper);
    }

function drinkModel(lower) {
      if (/thermos/.test(lower)) {
        return group(
          lathe([[0, 0], [0.037, 0], [0.037, 0.22], [0.03, 0.24], [0, 0.24]], 0x0ea5e9, { metalness: 0.15, roughness: 0.35 }),
          at(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 16), 0x1e293b), 0, 0.26, 0)
        );
      }
      if (/tea|cocoa|milk/.test(lower)) {
        const mug = lathe([[0, 0], [0.04, 0], [0.042, 0.09], [0.038, 0.09], [0.036, 0.006], [0, 0.006]], 0xf8fafc, { side: THREE.DoubleSide });
        const handle = mesh(new THREE.TorusGeometry(0.024, 0.006, 6, 14, Math.PI), 0xf8fafc);
        handle.rotation.z = -Math.PI / 2;
        const drink = at(mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.002, 16), /cocoa/.test(lower) ? 0x5b3a1e : /milk/.test(lower) ? 0xfefce8 : 0xb45309), 0, 0.078, 0);
        return group(mug, at(handle, 0.042, 0.045, 0), drink);
      }
      // A takeaway cup with a sleeve and lid
      return group(
        lathe([[0, 0], [0.028, 0], [0.042, 0.13], [0, 0.13]], 0xf8fafc),
        at(lathe([[0.034, 0], [0.039, 0.045], [0.0, 0.045]], 0x92400e), 0, 0.05, 0),
        at(lathe([[0, 0], [0.045, 0], [0.044, 0.012], [0.03, 0.02], [0, 0.02]], 0x1e293b), 0, 0.13, 0)
      );
    }

function fishModel() {
      const body = mesh(new THREE.SphereGeometry(0.05, 18, 12), 0xf48b8b, { roughness: 0.35, metalness: 0.2 });
      body.scale.set(4.4, 1.15, 0.7);
      const back = mesh(new THREE.SphereGeometry(0.05, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.6), 0x475569, { roughness: 0.4 });
      back.scale.set(4.3, 1.2, 0.72);
      const tail = slab([[0, 0], [-0.09, 0.06], [-0.07, 0], [-0.09, -0.06]], 0.006, 0x64748b);
      const dorsal = slab([[0, 0], [0.04, 0], [-0.02, 0.04]], 0.004, 0x64748b);
      const eye = mesh(new THREE.SphereGeometry(0.008, 8, 6), 0x111827);
      return group(at(body, 0, 0.06, 0), at(back, 0, 0.062, 0), at(tail, -0.2, 0.06, 0), at(dorsal, 0, 0.11, 0), at(eye, 0.17, 0.07, 0.025));
    }

function carrotModel() {
      const g = group();
      [[0, 0], [0.03, 0.05], [-0.02, -0.04]].forEach(([dz, dx], i) => {
        const root = lathe([[0, 0], [0.012, 0.03], [0.02, 0.12], [0.017, 0.17], [0, 0.175]], 0xf97316, {}, 12);
        root.rotation.z = -Math.PI / 2;
        g.add(at(root, 0.09 + dx, 0.02, dz));
        for (let k = 0; k < 3; k++) {
          const leaf = mesh(new THREE.ConeGeometry(0.008, 0.12, 4), 0x22c55e);
          leaf.rotation.z = Math.PI / 2 + (k - 1) * 0.35;
          g.add(at(leaf, -0.14 + dx, 0.03 + (k - 1) * 0.015, dz));
        }
      });
      return g;
    }

// --- Toys ---------------------------------------------------------------------------------------
function kiteModel() {
      const sail = slab([[0, 0.45], [0.27, 0.08], [0, -0.3], [-0.27, 0.08]], 0.004, 0xef4444, { side: THREE.DoubleSide });
      const panel = slab([[0, 0.45], [0.27, 0.08], [0, 0.08]], 0.005, 0xfacc15, { side: THREE.DoubleSide });
      const spars = [rod([0, 0.45, 0.01], [0, -0.3, 0.01], 0.004, 0x8a5a2b), rod([-0.27, 0.08, 0.01], [0.27, 0.08, 0.01], 0.004, 0x8a5a2b)];
      const kite = group(sail, panel, ...spars);
      const pts = [];
      for (let i = 0; i <= 8; i++) pts.push(new THREE.Vector3(Math.sin(i * 0.9) * 0.04, -0.3 - i * 0.06, 0));
      kite.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.003, 4), new THREE.MeshStandardMaterial({ color: 0x334155 })));
      [2, 4, 6].forEach(i => kite.add(at(mesh(new THREE.ConeGeometry(0.02, 0.03, 4), i % 4 ? 0x3b82f6 : 0x22c55e), pts[i].x, pts[i].y, 0)));
      kite.rotation.x = -1.2;
      kite.position.y = 0.06;
      return group(kite);
    }

function yoyoModel() {
      const half = (z) => {
        const h = lathe([[0.004, 0], [0.028, 0], [0.03, 0.012], [0.026, 0.02], [0.004, 0.02]], 0x22c55e, { metalness: 0.2 });
        h.rotation.x = z > 0 ? -Math.PI / 2 : Math.PI / 2;
        return at(h, 0, 0.03, z * 0.004);
      };
      const string = rod([0, 0.03, 0], [0.0, 0.2, 0], 0.0015, 0xf8fafc);
      const loop = at(mesh(new THREE.TorusGeometry(0.01, 0.002, 4, 10), 0xf8fafc), 0, 0.21, 0);
      return group(half(1), half(-1), string, loop);
    }

function ballModel(lower) {
      if (/juggl|marble/.test(lower)) {
        const size = /marble/.test(lower) ? 0.008 : 0.035;
        return group(...[0xef4444, 0x22c55e, 0x3b82f6].map((c, i) => at(mesh(new THREE.SphereGeometry(size, 14, 10), c), (i - 1) * size * 2.3, size, 0)));
      }
      if (/beach/.test(lower)) {
        const g = group();
        [0xef4444, 0xf8fafc, 0x3b82f6, 0xfacc15, 0xf8fafc, 0x22c55e].forEach((c, i) => {
          g.add(at(mesh(new THREE.SphereGeometry(0.14, 12, 12, (i / 6) * Math.PI * 2, Math.PI / 3), c), 0, 0.14, 0));
        });
        return g;
      }
      // A football: white with dark patches
      const ball = at(mesh(new THREE.IcosahedronGeometry(0.11, 1), 0xf8fafc, { flatShading: true }), 0, 0.11, 0);
      const pos = ball.geometry.attributes.position;
      const g = group(ball);
      for (let i = 0; i < pos.count; i += 21) {
        const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
        const patch = mesh(new THREE.CircleGeometry(0.025, 5), 0x111827);
        patch.position.copy(v.clone().multiplyScalar(0.1105)).add(new THREE.Vector3(0, 0.11, 0));
        patch.lookAt(v.clone().multiplyScalar(1).add(new THREE.Vector3(0, 0.11, 0)).add(v));
        g.add(patch);
      }
      return g;
    }

function duckModel() {
      const body = mesh(new THREE.SphereGeometry(0.045, 16, 12), 0xfacc15);
      body.scale.set(1.3, 0.85, 1);
      const head = mesh(new THREE.SphereGeometry(0.028, 14, 10), 0xfacc15);
      const beak = mesh(new THREE.SphereGeometry(0.014, 10, 6), 0xf97316);
      beak.scale.set(1.5, 0.5, 1.1);
      const tail = mesh(new THREE.ConeGeometry(0.015, 0.03, 8), 0xfacc15);
      tail.rotation.z = Math.PI / 1.6;
      const eyes = [-1, 1].map(s => at(mesh(new THREE.SphereGeometry(0.005, 6, 6), 0x111827), 0.04, 0.096, s * 0.016));
      return group(at(body, 0, 0.04, 0), at(head, 0.03, 0.088, 0), at(beak, 0.06, 0.083, 0), at(tail, -0.06, 0.06, 0), ...eyes);
    }

function spinningTopModel() {
      const body = lathe([[0, 0], [0.012, 0.01], [0.045, 0.04], [0.05, 0.05], [0.03, 0.06], [0, 0.062]], 0x06b6d4, { metalness: 0.3 });
      const band = at(mesh(new THREE.TorusGeometry(0.048, 0.004, 6, 24), 0xf472b6), 0, 0.046, 0);
      band.rotation.x = Math.PI / 2;
      return group(body, band, at(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 8), 0x1f2937), 0, 0.075, 0));
    }

function frogModel() {
      const body = mesh(new THREE.SphereGeometry(0.04, 14, 10), 0x16a34a);
      body.scale.set(1.3, 0.75, 1.05);
      const belly = mesh(new THREE.SphereGeometry(0.038, 14, 10), 0xbef264);
      belly.scale.set(1.2, 0.5, 0.95);
      const eyes = [-1, 1].map(s => group(at(mesh(new THREE.SphereGeometry(0.014, 10, 8), 0x16a34a), 0, 0, 0), at(mesh(new THREE.SphereGeometry(0.007, 8, 6), 0x111827), 0.008, 0.004, 0)));
      eyes[0].position.set(0.03, 0.06, -0.02);
      eyes[1].position.set(0.03, 0.06, 0.02);
      const legs = [-1, 1].map(s => at(mesh(new THREE.SphereGeometry(0.018, 10, 8), 0x15803d), -0.03, 0.015, s * 0.035));
      return group(at(body, 0, 0.032, 0), at(belly, 0.005, 0.022, 0), ...eyes, ...legs);
    }

function blocksModel() {
      const g = group();
      const colors = [0xef4444, 0x22c55e, 0x3b82f6, 0xfacc15];
      [[0, 0, 0, 0.064, 0.032], [0.034, 0.02, 0.0, 0.064, 0.032], [-0.02, 0.04, 0.0, 0.032, 0.032], [0.05, 0, 0.05, 0.032, 0.032]].forEach(([x, y, z, w, d], i) => {
        const brick = at(mesh(new THREE.BoxGeometry(w, 0.02, d), colors[i % 4], { roughness: 0.3 }), x, y + 0.01, z);
        for (let sx = 0; sx < w / 0.016; sx++) for (let sz = 0; sz < d / 0.016; sz++) {
          brick.add(at(mesh(new THREE.CylinderGeometry(0.0048, 0.0048, 0.004, 10), colors[i % 4]), -w / 2 + 0.008 + sx * 0.016, 0.012, -d / 2 + 0.008 + sz * 0.016));
        }
        g.add(brick);
      });
      return g;
    }

// --- Instruments and books ---------------------------------------------------------------------
function guitarModel(lower) {
      const scale = /ukulele/.test(lower) ? 0.55 : /violin/.test(lower) ? 0.6 : 1;
      const wood = /violin/.test(lower) ? 0x9a3412 : 0xc8955a;
      // Figure-of-eight body outline
      const shape = new THREE.Shape();
      shape.moveTo(0, -0.25);
      shape.bezierCurveTo(0.2, -0.25, 0.2, 0.0, 0.12, 0.04);
      shape.bezierCurveTo(0.16, 0.1, 0.15, 0.22, 0, 0.22);
      shape.bezierCurveTo(-0.15, 0.22, -0.16, 0.1, -0.12, 0.04);
      shape.bezierCurveTo(-0.2, 0.0, -0.2, -0.25, 0, -0.25);
      if (!/violin/.test(lower)) shape.holes.push(circlePath(0, 0.06, 0.045));
      const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 16 });
      bodyGeo.translate(0, 0, -0.045);
      const body = mesh(bodyGeo, wood, { roughness: 0.5 });
      const neck = at(mesh(new THREE.BoxGeometry(0.05, 0.44, 0.025), 0x5b3a1e), 0, 0.44, 0.03);
      const head = at(mesh(new THREE.BoxGeometry(0.075, 0.13, 0.02), 0x3f2a14), 0, 0.72, 0.03);
      const bridge = at(mesh(new THREE.BoxGeometry(0.1, 0.012, 0.012), 0x3f2a14), 0, -0.13, 0.05);
      const g = group(body, neck, head, bridge);
      for (let i = 0; i < (/ukulele|violin/.test(lower) ? 4 : 6); i++) {
        const x = -0.015 + i * 0.006;
        g.add(rod([x, -0.13, 0.055], [x * 0.8, 0.66, 0.045], 0.0012, 0xe2e8f0, { metalness: 0.9 }));
      }
      // Stands on its end, leaning slightly back
      g.rotation.x = -0.12;
      g.position.y = 0.26;
      // Shrink one level down, so lifeSize() scaling the result doesn't undo it
      const sized = group(g);
      sized.scale.setScalar(scale);
      return group(sized);
    }

function harmonicaModel() {
      const g = group(
        at(mesh(new THREE.BoxGeometry(0.1, 0.02, 0.026), 0x92400e), 0, 0.013, 0),
        at(mesh(new THREE.BoxGeometry(0.104, 0.008, 0.028), 0xcbd5e1, { metalness: 0.9, roughness: 0.2 }), 0, 0.027, 0),
        at(mesh(new THREE.BoxGeometry(0.104, 0.008, 0.028), 0xcbd5e1, { metalness: 0.9, roughness: 0.2 }), 0, 0.002, 0)
      );
      for (let i = 0; i < 10; i++) g.add(at(mesh(new THREE.BoxGeometry(0.005, 0.008, 0.002), 0x1f2937), -0.045 + i * 0.01, 0.013, 0.014));
      return g;
    }

function bookModel(lower) {
      const cover = /journal|notebook/.test(lower) ? 0x1e3a8a : /manual/.test(lower) ? 0x0f766e : 0x7c3aed;
      return group(
        at(mesh(new THREE.BoxGeometry(0.17, 0.004, 0.24), cover), 0, 0.002, 0),
        at(mesh(new THREE.BoxGeometry(0.162, 0.024, 0.232), 0xfef3c7), 0.003, 0.016, 0),
        at(mesh(new THREE.BoxGeometry(0.17, 0.004, 0.24), cover), 0, 0.03, 0),
        at(mesh(new THREE.BoxGeometry(0.006, 0.032, 0.24), cover), -0.085, 0.016, 0),
        at(mesh(new THREE.BoxGeometry(0.1, 0.001, 0.03), 0xfacc15), 0.0, 0.0325, -0.06)
      );
    }

function seedPacketsModel() {
      const g = group();
      [0xf472b6, 0x4ade80, 0xfacc15].forEach((c, i) => {
        const packet = at(mesh(new THREE.BoxGeometry(0.08, 0.12, 0.004), 0xf8fafc), (i - 1) * 0.06, 0.06, i * 0.012);
        packet.add(at(mesh(new THREE.BoxGeometry(0.066, 0.06, 0.001), c), 0, 0.012, 0.003));
        packet.rotation.y = (i - 1) * 0.25;
        packet.rotation.x = -0.15;
        g.add(packet);
      });
      return g;
    }
