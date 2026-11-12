// Kelo-bot-1 — js/workbench.js
// Loaded after welding.js. His work bench: a sturdy wooden fabrication bench beside the Welding Studio,
// separate from the steel welding table. Woodworking, assembly and other non-welded builds happen here
// (js/projects.js asks projectBenchFor(plan)); welded jobs stay on the welding table.
// The bench has a thick laminated top, a woodworker's face vise, a tool board with a saw, hammer,
// square and chisels, clamps, a shelf of offcuts, a pair of sawhorses and sawdust on the ground.
// WORK_BENCH is the one place to change to move it: `x`, `z` is where he stands, the top is
// `depth` in front of him (toward -z), `top` units up.

const WORK_BENCH = { x: MAP_LAYOUT.workBench.x, z: MAP_LAYOUT.workBench.z, depth: 1.4, top: 0.8, face: Math.PI, locKey: 'workbench', name: 'his work bench' };
let workBenchGroup = null;
let workBenchTool = null;

// Where a project is made: welded plans on the welding table, everything else on the work bench
function projectBenchFor(plan) {
      if (plan && plan.welded) return { ...TOWN_LOCATIONS.weld, locKey: 'weld' };
      return WORK_BENCH;
    }

function workBenchTopCenter(out = new THREE.Vector3()) {
      const x = WORK_BENCH.x, z = WORK_BENCH.z - WORK_BENCH.depth;
      return out.set(x, getAnalyticalGroundHeight(x, z) + WORK_BENCH.top, z);
    }

function buildWorkBench3D() {
      if (workBenchGroup || !scene) return;
      const c = workBenchTopCenter();
      const g = new THREE.Group();
      g.name = 'workBench';
      g.position.set(c.x, c.y - WORK_BENCH.top, c.z);
      const std = (color, roughness = 0.75, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
      const fin = (m, k) => { if (typeof finishMaterial === 'function') finishMaterial(m, k); return m; };
      const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = g) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        m.rotation.set(rx, ry, rz);
        m.castShadow = true;
        m.receiveShadow = true;
        parent.add(m);
        return m;
      };
      const box = (w, h, d, mat, x, y, z, rx, ry, rz, parent) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz, parent);
      const cyl = (r1, r2, h, mat, x, y, z, rx, ry, rz) => add(new THREE.CylinderGeometry(r1, r2, h, 10), mat, x, y, z, rx, ry, rz);
      const maple = fin(std(0xc89b62, 0.6), 'wood');
      const beech = fin(std(0xa8794a, 0.7), 'wood');
      const darkWood = fin(std(0x6b4a2b, 0.8), 'wood');
      const steel = std(0x5d6166, 0.4, 0.8);
      const T = WORK_BENCH.top;
      // Thick laminated top (strips) with a front apron
      for (let i = 0; i < 7; i++) box(2.2, 0.09, 0.115, i % 2 ? maple : beech, 0, T - 0.045, -0.35 + i * 0.117);
      box(2.2, 0.12, 0.05, beech, 0, T - 0.1, 0.43);
      // Bench-dog holes along the front
      for (let i = 0; i < 6; i++) add(new THREE.CircleGeometry(0.018, 10), std(0x2a1d10, 0.9), -0.8 + i * 0.3, T + 0.001, 0.33, -Math.PI / 2, 0, 0).castShadow = false;
      // Heavy legs with stretchers and a lower shelf
      [[-0.95, -0.32], [0.95, -0.32], [-0.95, 0.32], [0.95, 0.32]].forEach(([x, z]) => box(0.11, T - 0.09, 0.11, darkWood, x, (T - 0.09) / 2, z));
      [-0.95, 0.95].forEach(x => { box(0.08, 0.08, 0.66, darkWood, x, 0.16, 0); box(0.08, 0.08, 0.66, darkWood, x, T - 0.16, 0); });
      box(1.96, 0.04, 0.6, beech, 0, 0.22, 0);
      // Offcuts and a toolbox on the shelf
      [[-0.6, 0.27, 0.8], [-0.55, 0.3, 0.7], [-0.4, 0.27, 0.55]].forEach(([x, y, l], i) => box(l, 0.04, 0.09, i % 2 ? maple : beech, x, y + i * 0.01, -0.1 + i * 0.1, 0, 0.05 * i, 0));
      box(0.42, 0.18, 0.2, std(0xb91c1c, 0.45, 0.3), 0.5, 0.33, 0.05);
      // Woodworker's face vise on the front-left: wooden chop, steel screw, guide rods and the tommy bar
      const vise = new THREE.Group();
      box(0.42, 0.2, 0.06, beech, 0, -0.06, 0.07, 0, 0, 0, vise);
      [-0.13, 0.13].forEach(x => cyl(0.012, 0.012, 0.18, steel, x - 0.75, T - 0.1, 0.52, Math.PI / 2, 0, 0));
      cyl(0.02, 0.02, 0.2, steel, -0.75, T - 0.08, 0.53, Math.PI / 2, 0, 0);
      cyl(0.01, 0.01, 0.3, steel, -0.75, T - 0.08, 0.63, 0, 0, Math.PI / 2);
      [-0.15, 0.15].forEach(x => add(new THREE.SphereGeometry(0.02, 8, 6), darkWood, -0.75 + x, T - 0.08, 0.63));
      vise.position.set(-0.75, T - 0.04, 0.45);
      g.add(vise);
      // A board held in the vise
      box(0.5, 0.025, 0.12, maple, -0.75, T + 0.05, 0.47, 0, 0, 0);
      // Tool board at the back with a hand saw, claw hammer, try square, chisels and a mallet
      box(2.2, 0.75, 0.04, fin(std(0x8d6e4f, 0.85), 'wood'), 0, T + 0.42, -0.44);
      [-0.95, 0.95].forEach(x => box(0.07, 0.8, 0.07, darkWood, x, T + 0.4, -0.42));
      const saw = new THREE.Group();
      add(new THREE.BoxGeometry(0.45, 0.11, 0.004), std(0xc0c4c8, 0.3, 0.9), 0, 0, 0, 0, 0, 0, saw);
      add(new THREE.BoxGeometry(0.1, 0.1, 0.025), std(0x9a3412, 0.6), 0.26, 0.02, 0, 0, 0, 0, saw);
      saw.position.set(-0.55, T + 0.5, -0.41);
      g.add(saw);
      box(0.03, 0.26, 0.03, std(0x6e4b2a, 0.8), -0.1, T + 0.45, -0.41);
      box(0.12, 0.035, 0.035, steel, -0.1, T + 0.6, -0.41);
      box(0.22, 0.02, 0.01, steel, 0.2, T + 0.62, -0.41);
      box(0.02, 0.14, 0.012, darkWood, 0.11, T + 0.56, -0.41);
      [0.45, 0.52, 0.59, 0.66].forEach((x, i) => { box(0.02, 0.1, 0.02, std(0xd97706, 0.6), x, T + 0.55, -0.41); box(0.012, 0.08 + i * 0.01, 0.006, steel, x, T + 0.44 - i * 0.005, -0.41); });
      box(0.07, 0.07, 0.12, beech, 0.82, T + 0.62, -0.38);
      // Two bar clamps and a pencil on the top
      [-0.25, 0.1].forEach(x => {
        box(0.02, 0.02, 0.5, steel, x, T + 0.012, 0.02, 0, 0.3, 0);
        box(0.05, 0.07, 0.04, std(0x1d4ed8, 0.5, 0.3), x + 0.07, T + 0.04, -0.2, 0, 0.3, 0);
      });
      cyl(0.006, 0.006, 0.15, std(0xfacc15, 0.5), 0.6, T + 0.006, 0.2, 0, 0.4, Math.PI / 2);
      // A pair of sawhorses beside the bench and sawdust on the ground
      [1.55, 2.2].forEach(x => {
        box(0.08, 0.06, 0.9, darkWood, x, 0.62, 0.0);
        [-0.35, 0.35].forEach(z => [-1, 1].forEach(s => box(0.05, 0.66, 0.05, darkWood, x + s * 0.12, 0.31, z, 0, 0, s * 0.2)));
      });
      const dust = add(new THREE.CircleGeometry(0.9, 20), new THREE.MeshStandardMaterial({ color: 0xe4c896, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false }), 0.1, 0.012, 0.35, -Math.PI / 2, 0, 0);
      dust.scale.set(1.6, 0.8, 1);
      dust.castShadow = false;
      if (typeof makeSignMesh === 'function') {
        const sign = makeSignMesh('WORK BENCH', { bg: '#3f2a14', fg: '#fcd34d', width: 1.1, height: 0.22 });
        sign.position.set(0, T + 0.9, -0.41);
        g.add(sign);
      }
      scene.add(g);
      workBenchGroup = g;
      // Solid: the bench itself and the sawhorses (he stands at the front)
      [-0.6, 0.6].forEach(dx => worldObstacles.push({ x: c.x + dx, z: c.z - 0.05, r: 0.42 }));
      worldObstacles.push({ x: c.x + 1.9, z: c.z, r: 0.45 });
      return g;
    }

// Every frame before his pose is blended (scene.js): at the bench he faces it and works with his hands,
// sawing, hammering or sanding by what the build step says
function poseKeloAtWorkBench(t) {
      if (state.currentLocKey !== WORK_BENCH.locKey || state.isWalking || !keloBody) {
        if (workBenchTool) workBenchTool.visible = false;
        return;
      }
      const d = Math.hypot(state.botPos.x - WORK_BENCH.x, state.botPos.z - WORK_BENCH.z);
      if (d > 0.9) return;
      KELO_JOINTS.forEach(([, get]) => get().rotation.set(0, 0, 0));
      keloAnim.mode = 'other';
      state.botRotY = WORK_BENCH.face;
      keloGroup.rotation.set(0, WORK_BENCH.face, 0);
      const step = String(state.moodTitle || '');
      const kind = /saw/i.test(step) ? 'saw' : /drill/i.test(step) ? 'drill' : /together|assembl|fix/i.test(step) ? 'hammer' : 'sand';
      ensureWorkBenchTool(kind);
      // Hand-keyed strokes with a wind-up, the hit and the follow-through (js/kelo-clips.js)
      keloAction({ saw: 'saw', drill: 'drillBench', hammer: 'hammer', sand: 'sand' }[kind]);
    }

// A saw, hammer or sanding block in his right hand
function ensureWorkBenchTool(kind) {
      if (!keloRightHand) return;
      if (workBenchTool && workBenchTool.userData.kind !== kind) { keloRightHand.remove(workBenchTool); workBenchTool = null; }
      if (!workBenchTool) {
        const g = new THREE.Group();
        const m = (geo, color, x, y, z, metal = 0) => { const o = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: metal })); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
        if (kind === 'saw') { m(new THREE.BoxGeometry(0.03, 0.06, 0.1), 0x9a3412, 0, -0.06, 0); m(new THREE.BoxGeometry(0.004, 0.09, 0.4), 0xc0c4c8, 0, -0.08, 0.24, 0.9); }
        else if (kind === 'drill') { m(new THREE.BoxGeometry(0.05, 0.13, 0.12), 0x1d4ed8, 0, -0.07, 0.04); m(new THREE.CylinderGeometry(0.006, 0.006, 0.1, 6), 0xc0c4c8, 0, -0.16, 0.08, 0.9); }
        else if (kind === 'hammer') { m(new THREE.BoxGeometry(0.03, 0.03, 0.26), 0x6e4b2a, 0, -0.06, 0.08); m(new THREE.BoxGeometry(0.05, 0.12, 0.04), 0x4b5563, 0, -0.06, 0.22, 0.8); }
        else m(new THREE.BoxGeometry(0.09, 0.05, 0.14), 0xd6b88a, 0, -0.09, 0.02);
        g.userData.kind = kind;
        keloRightHand.add(g);
        workBenchTool = g;
      }
      workBenchTool.visible = true;
    }
