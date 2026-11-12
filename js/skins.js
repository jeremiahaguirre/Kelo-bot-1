// Kelo-bot-1 — js/skins.js
// Loaded right after js/kelo-body.js. Kelo-1's skins: his Classic look plus five original designs.
// A skin only changes how he looks. His skeleton (keloGroup, keloBody, keloHead, the arm and leg
// joints) and every named part stay the same in every skin, so all animation code (js/animations.js,
// kelo-ik.js, kelo-mocap.js, kelo-clips.js, welding/workbench poses) works unchanged.
//
// A skin is { id, name, priceCents, currency, rarity, blurb, palette, shape, parts }:
//   palette      overrides for his materials by name (js/kelo-body.js KELO_MAT_DEFS: shell, cream,
//                cover, joint, rubber, seam, frame, amber, glass, visor, eye, eyeGlow, shine, cheek,
//                led, id), e.g. { shell: { color: 0xf2f4f7, roughness: 0.3 } }
//   parts(M, rig, add)  adds the skin's own meshes. add(bone, mesh) hangs a mesh in a "skin" group on
//                that bone (rig.head, rig.body, rig.lKnee, rig.lEye...), so it moves with him; the
//                groups are joined per material afterwards and hidden in the through-his-eyes view.
//   shape        his body's own shapes (js/kelo-body.js KELO_SHAPE_CLASSIC: head, face, eyes, ears,
//                torso, belly, pack, arm, leg, boot), so each skin is a differently built robot. The
//                bones are never moved or scaled: every skin moves exactly the same.
//
// Ownership lives in state.skins = { owned, equipped, purchases } (saved with everything else).
// Prices are placeholders for a future real store. Buying goes through one payment provider
// (skinPayment). Today that is mockPayment: a dev-mode free unlock that takes no money, and only
// while KELO_DEV_UNLOCK is on (Settings). See .claude/handoff.md for plugging in real payments.

const KELO_SKIN_RARITY = { standard: 'Standard', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };

// --- Small shape helpers for skin parts (built on the kelo-body.js helpers) -----------------------
// A cap: part of a sphere, its pole pointing along +z (rotate it to aim elsewhere)
function skinCapGeometry(r, theta, seg = 16) {
      return new THREE.SphereGeometry(r, seg, 8, 0, Math.PI * 2, 0, theta).rotateX(Math.PI / 2);
    }
// A ring standing round a limb at height y (the limb hangs along -y)
function skinLimbRing(r, tube, y, mat) {
      return keloMesh(new THREE.TorusGeometry(r, tube, 6, 24).rotateX(Math.PI / 2), mat, { pos: [0, y, 0], shadow: false });
    }
// A rounded tile stuck on a lathe surface (head or torso), facing out
function skinSurfaceTile(geo, mat, prof, sx, sz, y, phi, lift) {
      const at = keloOnSurface(keloProfileR(prof, y), y, phi, sx, sz, lift);
      const m = keloMesh(geo, mat, { shadow: false });
      m.position.copy(at.p);
      m.lookAt(at.p.clone().add(at.n));
      return m;
    }
const skinGlow = (color, opacity = 0.9) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });

// --- The skins -------------------------------------------------------------------------------------
const KELO_SKINS = [
  {
    id: 'classic', name: 'Classic', priceCents: 0, currency: 'USD', rarity: 'standard',
    blurb: 'His own round teal body, cream panels and headphone ears.',
    palette: {}, shape: null, parts: null
  },
  {
    id: 'explorer', name: 'Explorer', priceCents: 99, currency: 'USD', rarity: 'standard',
    blurb: 'A rugged, boxy build: square helmet head, block chest, armoured limbs, big ear discs with cyan rings and chunky boots.',
    palette: {
      shell: { color: 0xeef1f4, metalness: 0.08, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.12 },
      cream: { color: 0x2b3036, roughness: 0.42, clearcoat: 0.4 },
      cover: { color: 0x2b3036, metalness: 0.25, roughness: 0.45 },
      joint: { color: 0x3a3f46 },
      rubber: { color: 0x1b1e22 },
      frame: { color: 0xb8c0c8 },
      amber: { color: 0x38d6f5, emissive: 0x0a3a44, emissiveIntensity: 0.5 },
      led: { color: 0x7af0ff },
      eye: { color: 0x9ff3ff }
    },
    idColor: '#38d6f5',
    shape: {
      head: { kind: 'box', w: 0.6, h: 0.56, d: 0.54, r: 0.13 },
      face: { yc: 0.3, w: 0.48, h: 0.3 },
      eyes: { y: 0.31, x: 0.11, r: 0.056 },
      ears: 'none',
      torso: { kind: 'box', w: 0.5, h: 0.62, d: 0.4, r: 0.11 },
      belly: { yc: 0.27, w: 0.3, h: 0.3 },
      arm: { kind: 'box', shoulder: 0.095, upper: [0.07, 0.065], elbow: 0.06, fore: [0.068, 0.06] },
      leg: { kind: 'box', hip: 0.1, thigh: [0.1, 0.095], knee: 0.08, shin: [0.095, 0.09] },
      boot: { kind: 'box', w: 0.12, h: 0.15, l: 0.2, toe: 0.05 }
    },
    parts(M, R, add) {
      const cyan = skinGlow(0x45e3ff, 1);
      // Big round ear discs, a cyan ring round each
      const disc = new THREE.CylinderGeometry(0.14, 0.14, 0.05, 28).rotateZ(Math.PI / 2);
      const face = new THREE.CylinderGeometry(0.1, 0.1, 0.012, 24).rotateZ(Math.PI / 2);
      const ring = new THREE.TorusGeometry(0.12, 0.012, 6, 30).rotateY(Math.PI / 2);
      [-1, 1].forEach(s => {
        add(R.head, keloMesh(disc, M.shell, { pos: [s * (R.earX + 0.02), 0.3, -0.01] }));
        add(R.head, keloMesh(face, M.cover, { pos: [s * (R.earX + 0.046), 0.3, -0.01], shadow: false }));
        add(R.head, keloMesh(ring, cyan, { pos: [s * (R.earX + 0.047), 0.3, -0.01] }));
      });
      // A brow ridge over the visor and a cyan strip across the top of the helmet
      add(R.head, keloMesh(keloRoundedBox(0.52, 0.05, 0.06, 0.02, 0.008), M.cover, { pos: [0, 0.49, 0.26] }));
      add(R.head, keloMesh(keloRoundedBox(0.08, 0.02, 0.46, 0.008, 0.004), cyan, { pos: [0, 0.565, 0], shadow: false }));
      // Knee caps and shin plates, elbow caps and forearm plates, shoulder pads
      const kneeCap = skinCapGeometry(0.1, 1.15);
      const shinPlate = keloRoundedBox(0.16, 0.22, 0.03, 0.035, 0.008);
      const elbowCap = skinCapGeometry(0.078, 1.2).rotateY(Math.PI);
      const forePlate = keloRoundedBox(0.11, 0.15, 0.025, 0.03, 0.006);
      ['lKnee', 'rKnee'].forEach(k => {
        add(R[k], keloMesh(kneeCap, M.shell, { pos: [0, -0.025, 0.035] }));
        add(R[k], keloMesh(shinPlate, M.cover, { pos: [0, -0.24, 0.092] }));
        add(R[k], skinLimbRing(0.1, 0.008, -0.38, cyan));
      });
      ['lElbow', 'rElbow'].forEach(k => {
        add(R[k], keloMesh(elbowCap, M.shell, { pos: [0, -0.01, -0.012] }));
        add(R[k], keloMesh(forePlate, M.cover, { pos: [0, -0.17, -0.068] }));
      });
      const pad = skinCapGeometry(0.13, 1.05).rotateX(-Math.PI / 2);
      ['lArm', 'rArm'].forEach(k => add(R[k], keloMesh(pad, M.cover, { pos: [0, 0.01, 0] })));
      // Chest vents
      const vent = keloRoundedBox(0.09, 0.014, 0.01, 0.006, 0.003);
      [-1, 1].forEach(s => [0, 1, 2].forEach(i => add(R.body, keloMesh(vent, M.cover, { pos: [s * 0.15, 0.13 + i * 0.03, 0.203], shadow: false }))));
    }
  },
  {
    id: 'kitbot', name: 'Kitbot', priceCents: 149, currency: 'USD', rarity: 'rare',
    blurb: 'A wide, cat-like head with ear fins, chunky headphones, a compact barrel body, round paw feet and a rainbow chest bar.',
    palette: {
      shell: { color: 0xf6f7fa, metalness: 0.06, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 },
      cream: { color: 0xe7e8ef },
      cover: { color: 0x2d2a38, roughness: 0.45 },
      joint: { color: 0x3b3647 },
      rubber: { color: 0x221f2a },
      frame: { color: 0xd0d3da },
      amber: { color: 0xe8268f, emissive: 0x3a0020, emissiveIntensity: 0.4 },
      eye: { color: 0xff9ce6 },
      eyeGlow: { color: 0xff6fd8 },
      led: { color: 0xff4fb3 },
      cheek: { color: 0xff6fae }
    },
    idColor: '#ff5cb0',
    shape: {
      head: { kind: 'lathe', profile: [[0, 0], [0.15, 0.01], [0.24, 0.05], [0.28, 0.12], [0.292, 0.22], [0.292, 0.36], [0.28, 0.45], [0.24, 0.52], [0.15, 0.565], [0, 0.575]], sx: 1.24, sz: 1.0 },
      face: { yc: 0.27, hy: 0.19, phi: 1.02 },
      eyes: { y: 0.29, phi: 0.36, r: 0.064 },
      ears: 'none',
      antenna: false,
      torso: { kind: 'lathe', profile: [[0, 0], [0.18, 0.02], [0.23, 0.08], [0.25, 0.2], [0.25, 0.36], [0.24, 0.46], [0.2, 0.54], [0.12, 0.6], [0, 0.62]], sx: 1.05, sz: 0.9 },
      belly: { yc: 0.25, hy: 0.15, phi: 0.66 },
      arm: { kind: 'capsule', shoulder: 0.09, upper: [0.068, 0.064], elbow: 0.06, fore: [0.066, 0.058] },
      leg: { kind: 'capsule', hip: 0.1, thigh: [0.104, 0.098], knee: 0.082, shin: [0.096, 0.086] },
      boot: { kind: 'ball', w: 0.13, h: 0.12, l: 0.165, toe: 0.04 }
    },
    parts(M, R, add) {
      // Cat-ear fins on top of his head, magenta inside
      const tri = (w, h) => {
        const s = new THREE.Shape();
        s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w * 0.1, h); s.lineTo(-w * 0.1, h); s.lineTo(-w / 2, 0);
        const g = new THREE.ExtrudeGeometry(s, { depth: 0.036, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1, curveSegments: 2 });
        g.translate(0, 0, -0.018);
        return g;
      };
      const fin = tri(0.2, 0.2), inner = tri(0.11, 0.12);
      [-1, 1].forEach(s => {
        const g = new THREE.Group();
        g.position.set(s * 0.2, 0.47, 0.05);
        g.rotation.set(-0.12, 0, -s * 0.32);
        g.add(keloMesh(fin, M.shell));
        g.add(keloMesh(inner, M.amber, { pos: [0, 0.04, 0.025], shadow: false }));
        add(R.head, g);
      });
      // Chunky headphones: big cups and a thick band, set behind the fins
      const cup = new THREE.CylinderGeometry(0.15, 0.15, 0.08, 28).rotateZ(Math.PI / 2);
      const pad = new THREE.TorusGeometry(0.12, 0.024, 8, 28).rotateY(Math.PI / 2);
      const cap = new THREE.CylinderGeometry(0.09, 0.09, 0.012, 24).rotateZ(Math.PI / 2);
      [-1, 1].forEach(s => {
        add(R.head, keloMesh(cup, M.shell, { pos: [s * (R.earX + 0.035), 0.28, -0.05] }));
        add(R.head, keloMesh(pad, M.cover, { pos: [s * (R.earX - 0.005), 0.28, -0.05] }));
        add(R.head, keloMesh(cap, M.amber, { pos: [s * (R.earX + 0.081), 0.28, -0.05], shadow: false }));
      });
      const band = keloMesh(new THREE.TorusGeometry(R.earX + 0.045, 0.036, 8, 30, Math.PI), M.amber, { pos: [0, 0.28, -0.1] });
      band.scale.set(1, 0.86, 1);
      add(R.head, band);
      // A little tail-light where a cat's tail would be
      add(R.body, keloMesh(new THREE.SphereGeometry(0.045, 14, 10), M.amber, { pos: [0, -0.08, -0.17] }));
      // A rainbow bar across his chest
      const seg = keloRoundedBox(0.034, 0.026, 0.012, 0.008, 0.003);
      [0xff5a5a, 0xffa23a, 0xffe14a, 0x5ee07a, 0x4fb3ff, 0xb07aff].forEach((c, i) => {
        add(R.body, skinSurfaceTile(seg, skinGlow(c, 1), R.torsoProfile, R.TSX, R.TSZ, 0.44, -0.28 + i * 0.112, 0.008));
      });
    }
  },
  {
    id: 'marshmallow', name: 'Marshmallow', priceCents: 149, currency: 'USD', rarity: 'rare',
    blurb: 'Soft-touch blush pink and all curves: a big round head, a plump body, thick stubby limbs and a warm amber chest button.',
    palette: {
      shell: { kind: 'std', color: 0xf4b9c6, metalness: 0, roughness: 0.88 },
      cream: { kind: 'std', color: 0xfff1e6, metalness: 0, roughness: 0.9 },
      cover: { color: 0xe79aae, metalness: 0, roughness: 0.85 },
      joint: { color: 0xf0c4cf, roughness: 0.9 },
      rubber: { color: 0xb06c80, roughness: 0.9 },
      seam: { color: 0xd58c9d, metalness: 0 },
      frame: { color: 0xf6d6dc, metalness: 0.1, roughness: 0.8 },
      amber: { color: 0xffb347, emissive: 0x7a3600, emissiveIntensity: 0.7 },
      glass: { color: 0x2a1418 },
      eye: { color: 0xffe0a8 },
      eyeGlow: { color: 0xffb070, opacity: 0.36 },
      led: { color: 0xffc070 },
      cheek: { color: 0xff8a8a },
      visor: { opacity: 0.1 }
    },
    idColor: '#ffb347',
    shape: {
      head: { kind: 'lathe', profile: [[0, 0], [0.14, 0.015], [0.24, 0.07], [0.3, 0.16], [0.328, 0.27], [0.324, 0.38], [0.295, 0.48], [0.225, 0.56], [0.12, 0.612], [0, 0.628]], sx: 1.06, sz: 1.0 },
      face: { yc: 0.29, hy: 0.19, phi: 0.98 },
      eyes: { y: 0.31, phi: 0.35, r: 0.062 },
      ears: 'none',
      torso: { kind: 'lathe', profile: [[0, -0.02], [0.2, 0.0], [0.27, 0.08], [0.305, 0.2], [0.305, 0.32], [0.285, 0.43], [0.235, 0.53], [0.15, 0.6], [0, 0.64]], sx: 0.9, sz: 0.95 },
      belly: { yc: 0.24, hy: 0.16, phi: 0.68 },
      pack: { w: 0.3, h: 0.3, d: 0.12 },
      arm: { kind: 'capsule', shoulder: 0.1, upper: [0.086, 0.08], elbow: 0.076, fore: [0.08, 0.07] },
      leg: { kind: 'capsule', hip: 0.11, thigh: [0.118, 0.108], knee: 0.098, shin: [0.106, 0.094] },
      boot: { kind: 'ball', w: 0.14, h: 0.12, l: 0.17, toe: 0.03 }
    },
    parts(M, R, add) {
      const warm = new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
      // A big amber chest button with a warm glow round it
      const at = keloOnSurface(keloProfileR(R.torsoProfile, 0.3), 0.3, 0, R.TSX, R.TSZ, 0.004);
      const btn = new THREE.Group();
      btn.position.copy(at.p);
      btn.lookAt(at.p.clone().add(at.n));
      btn.add(keloMesh(new THREE.CylinderGeometry(0.06, 0.064, 0.03, 24).rotateX(Math.PI / 2), M.amber, { pos: [0, 0, 0.012] }));
      btn.add(keloMesh(new THREE.TorusGeometry(0.066, 0.009, 6, 24), M.cream, { pos: [0, 0, 0.012], shadow: false }));
      const halo = keloMesh(new THREE.CircleGeometry(0.115, 24), warm, { pos: [0, 0, 0.002], shadow: false });
      halo.renderOrder = 1;
      btn.add(halo);
      add(R.body, btn);
      // Round puff ears
      [-1, 1].forEach(s => { const e = keloMesh(new THREE.SphereGeometry(0.085, 18, 12), M.cover, { pos: [s * (R.earX - 0.01), 0.33, -0.01] }); e.scale.set(0.7, 1, 1); add(R.head, e); });
      // Puffy round shoulders, wrists and ankles
      const puffShoulder = new THREE.SphereGeometry(0.118, 18, 12);
      ['lArm', 'rArm'].forEach(k => { const m = keloMesh(puffShoulder, M.shell, { pos: [0, 0.0, 0] }); m.scale.set(1.04, 0.9, 1.04); add(R[k], m); });
      const wristPuff = new THREE.TorusGeometry(0.076, 0.026, 8, 20).rotateX(Math.PI / 2);
      ['lElbow', 'rElbow'].forEach(k => add(R[k], keloMesh(wristPuff, M.cream, { pos: [0, -0.275, 0] })));
      const anklePuff = new THREE.TorusGeometry(0.098, 0.03, 8, 22).rotateX(Math.PI / 2);
      ['lKnee', 'rKnee'].forEach(k => add(R[k], keloMesh(anklePuff, M.cream, { pos: [0, -0.4, 0] })));
      // A soft warm pom on his antenna
      add(R.antenna, keloMesh(new THREE.SphereGeometry(0.062, 16, 12), M.amber, { pos: [0, 0.2, 0] }));
    }
  },
  {
    id: 'twirl', name: 'Twirl', priceCents: 199, currency: 'USD', rarity: 'epic',
    blurb: 'Slender and pearl-white: a tall egg head with two curled antenna pigtails, an hourglass waist, a flared skirt plate, big lashed eyes and pointed feet.',
    palette: {
      shell: { color: 0xf8f2ee, metalness: 0.1, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.04 },
      cream: { color: 0xffd9e8 },
      cover: { color: 0xd9cfe8, roughness: 0.4 },
      joint: { color: 0xc9bfd9 },
      rubber: { color: 0x5a4a6a },
      frame: { color: 0xe8d5f0, metalness: 0.6 },
      amber: { color: 0xff8fc8, emissive: 0x40102a, emissiveIntensity: 0.5 },
      eye: { color: 0xd2b4ff },
      eyeGlow: { color: 0xb68cff },
      led: { color: 0xff9be0 },
      cheek: { color: 0xff8fb8, opacity: 0.6 }
    },
    idColor: '#ff8fc8',
    shape: {
      head: { kind: 'lathe', profile: [[0, 0], [0.1, 0.01], [0.19, 0.06], [0.25, 0.15], [0.276, 0.27], [0.276, 0.38], [0.252, 0.49], [0.2, 0.575], [0.12, 0.635], [0, 0.66]], sx: 1.0, sz: 0.95 },
      face: { yc: 0.3, hy: 0.2, phi: 1.02 },
      eyes: { y: 0.32, phi: 0.38, r: 0.068 },
      ears: 'none',
      antenna: false,
      torso: { kind: 'lathe', profile: [[0, 0], [0.15, 0.02], [0.17, 0.1], [0.15, 0.21], [0.17, 0.33], [0.21, 0.45], [0.205, 0.53], [0.15, 0.6], [0.08, 0.645], [0, 0.66]], sx: 1.0, sz: 0.8 },
      belly: { yc: 0.36, hy: 0.12, phi: 0.6 },
      pack: { w: 0.22, h: 0.24, d: 0.08 },
      arm: { kind: 'capsule', shoulder: 0.072, upper: [0.055, 0.045], elbow: 0.046, fore: [0.05, 0.038] },
      leg: { kind: 'capsule', hip: 0.08, thigh: [0.08, 0.062], knee: 0.06, shin: [0.07, 0.05] },
      boot: { kind: 'dome', w: 0.085, h: 0.115, l: 0.205, toe: 0.065 }
    },
    parts(M, R, add) {
      const glow = skinGlow(0xff9be0, 1);
      const pearlPink = new THREE.MeshPhysicalMaterial({ color: 0xffc9df, metalness: 0.08, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide });
      // Two curled antenna pigtails, swept back from the top of his head, with glowing bands
      [-1, 1].forEach(s => {
        const pts = [[0.15, 0.55], [0.24, 0.63], [0.34, 0.68], [0.44, 0.64], [0.48, 0.55], [0.45, 0.47], [0.39, 0.48], [0.38, 0.54]]
          .map(([x, y], i) => new THREE.Vector3(s * x, y, -0.05 - i * 0.014));
        const curve = new THREE.CatmullRomCurve3(pts);
        add(R.head, keloMesh(new THREE.TubeGeometry(curve, 40, 0.021, 8, false), M.shell));
        [0.2, 0.4, 0.6].forEach(u => {
          const p = curve.getPointAt(u), tg = curve.getTangentAt(u);
          const band = keloMesh(new THREE.TorusGeometry(0.026, 0.008, 6, 16), glow, { shadow: false });
          band.position.copy(p);
          band.lookAt(p.clone().add(tg));
          add(R.head, band);
        });
        add(R.head, keloMesh(new THREE.SphereGeometry(0.034, 12, 8), M.led, { pos: pts[pts.length - 1].toArray() }));
      });
      // A tiara-like crest of three pearls over the screen
      [-0.08, 0, 0.08].forEach((x, i) => add(R.head, keloMesh(new THREE.SphereGeometry(i === 1 ? 0.026 : 0.019, 12, 8), M.amber, { pos: [x, 0.58 + (i === 1 ? 0.012 : 0), 0.17] })));
      // A flared skirt plate: the back and sides hang from his hips, the front panels ride on his
      // thighs (so they lift with his legs when he sits instead of cutting through them)
      const P = [[0.33, -0.13], [0.29, -0.075], [0.245, -0.015], [0.218, 0.04]].map(([r, y]) => new THREE.Vector2(r, y));
      const back = new THREE.LatheGeometry(P, 26, 1.85, Math.PI * 2 - 3.7);
      const skirt = keloMesh(back, pearlPink);
      skirt.scale.set(1.05, 1, 0.82);
      add(R.body, skirt);
      add(R.body, (() => { const t = keloMesh(new THREE.TorusGeometry(0.329, 0.009, 5, 26, Math.PI * 2 - 3.7).rotateX(Math.PI / 2).rotateY(1.85 - Math.PI / 2), glow, { pos: [0, -0.13, 0], shadow: false }); t.scale.set(1.05, 1, 0.82); return t; })());
      const front = [[0.15, -0.21], [0.128, -0.13], [0.105, -0.05], [0.094, -0.01]].map(([r, y]) => new THREE.Vector2(r, y));
      [['lLeg', -1], ['rLeg', 1]].forEach(([k, s]) => {
        const g = new THREE.LatheGeometry(front, 12, s > 0 ? -0.2 : -1.45, 1.65);
        add(R[k], keloMesh(g, pearlPink));
      });
      // Glowing lashes drawn on the screen over each eye
      const lash = new THREE.BoxGeometry(0.01, 0.038, 0.003);
      [R.lEye, R.rEye].forEach(eye => {
        const s = eye.userData.side;
        const open = eye.userData.open;
        (s > 0 ? [0.35, 0.75, 1.15] : [Math.PI - 0.35, Math.PI - 0.75, Math.PI - 1.15]).forEach(a => {
          const m = keloMesh(lash, M.eye, { shadow: false });
          m.position.set(Math.cos(a) * 0.086, Math.sin(a) * 0.086, 0.002);
          m.rotation.z = a - Math.PI / 2;
          add(open, m);
        });
      });
    }
  },
  {
    id: 'spark', name: 'Spark', priceCents: 299, currency: 'USD', rarity: 'legendary',
    blurb: 'Sleek brushed silver: a big wide head with a black visor, a V-shaped chest, thin limbs and pointed feet, blue glow rings and blush on his screen.',
    palette: {
      shell: { color: 0xc9ced6, metalness: 0.85, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.1 },
      cream: { color: 0x1a1d24, metalness: 0.3, roughness: 0.3, clearcoat: 0.8 },
      cover: { color: 0x2a2e36, metalness: 0.4 },
      joint: { color: 0x30343c },
      rubber: { color: 0x15171b },
      frame: { color: 0xdfe4ea, metalness: 0.9, roughness: 0.2 },
      amber: { color: 0x4fb3ff, emissive: 0x0a2a55, emissiveIntensity: 0.6 },
      visor: { color: 0x2a3442, opacity: 0.38 },
      eye: { color: 0x9fd8ff },
      eyeGlow: { color: 0x4fa8ff, opacity: 0.34 },
      led: { color: 0x6fc3ff },
      cheek: { color: 0xff6fa0, opacity: 0.7 }
    },
    idColor: '#6fc3ff',
    shape: {
      head: { kind: 'lathe', profile: [[0, 0], [0.13, 0.01], [0.23, 0.055], [0.3, 0.13], [0.327, 0.23], [0.335, 0.33], [0.326, 0.42], [0.294, 0.51], [0.232, 0.59], [0.135, 0.645], [0, 0.664]], sx: 1.16, sz: 0.98 },
      face: { yc: 0.31, hy: 0.24, phi: 1.16 },
      eyes: { y: 0.33, phi: 0.36, r: 0.064 },
      torso: { kind: 'lathe', profile: [[0, 0], [0.12, 0.02], [0.14, 0.1], [0.17, 0.22], [0.225, 0.36], [0.252, 0.46], [0.235, 0.54], [0.16, 0.61], [0.08, 0.645], [0, 0.66]], sx: 1.0, sz: 0.78 },
      belly: { yc: 0.4, hy: 0.12, phi: 0.62 },
      arm: { kind: 'capsule', shoulder: 0.075, upper: [0.055, 0.048], elbow: 0.05, fore: [0.052, 0.042] },
      leg: { kind: 'capsule', hip: 0.08, thigh: [0.075, 0.06], knee: 0.062, shin: [0.068, 0.05] },
      boot: { kind: 'dome', w: 0.1, h: 0.1, l: 0.215, toe: 0.07 }
    },
    parts(M, R, add) {
      const blue = skinGlow(0x5cc0ff, 1);
      const soft = new THREE.MeshBasicMaterial({ color: 0x3f9cff, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
      // Glow rings round his chest light
      const at = keloOnSurface(keloProfileR(R.torsoProfile, 0.3), 0.3, 0, R.TSX, R.TSZ, 0.01);
      const chest = new THREE.Group();
      chest.position.copy(at.p);
      chest.lookAt(at.p.clone().add(at.n));
      chest.add(keloMesh(new THREE.TorusGeometry(0.048, 0.008, 6, 28), blue, { shadow: false }));
      chest.add(keloMesh(new THREE.TorusGeometry(0.074, 0.004, 5, 32), blue, { shadow: false }));
      const halo = keloMesh(new THREE.RingGeometry(0.03, 0.09, 32), soft, { pos: [0, 0, -0.002], shadow: false });
      halo.renderOrder = 1;
      chest.add(halo);
      add(R.body, chest);
      // And at his joints: shoulders, elbows, hips, knees
      ['lArm', 'rArm'].forEach(k => add(R[k], skinLimbRing(0.062, 0.007, -0.085, blue)));
      ['lElbow', 'rElbow'].forEach(k => add(R[k], skinLimbRing(0.058, 0.006, -0.07, blue)));
      ['lLeg', 'rLeg'].forEach(k => add(R[k], skinLimbRing(0.082, 0.008, -0.12, blue)));
      ['lKnee', 'rKnee'].forEach(k => add(R[k], skinLimbRing(0.074, 0.007, -0.085, blue)));
      // Fins on the sides of his head, swept back
      const finS = new THREE.Shape();
      finS.moveTo(0, 0); finS.lineTo(-0.2, 0.05); finS.lineTo(-0.22, 0.13); finS.lineTo(-0.02, 0.1); finS.lineTo(0, 0);
      const finG = new THREE.ExtrudeGeometry(finS, { depth: 0.02, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1 });
      finG.rotateY(-Math.PI / 2);
      [-1, 1].forEach(s => add(R.head, keloMesh(finG, M.shell, { pos: [s * (R.earX + 0.05) - 0.01, 0.36, -0.05] })));
      // Blush strokes on his face screen, over the cheek lights
      const stroke = keloRoundedBox(0.008, 0.03, 0.003, 0.003, 0.001);
      const pink = skinGlow(0xff7fae, 1);
      [-1, 1].forEach(s => {
        [-0.07, 0, 0.07].forEach(d => {
          const m = skinSurfaceTile(stroke, pink, R.headProfile, R.HSX, R.HSZ, 0.235, s * (0.6 + d), 0.022);
          m.rotateZ(-s * 0.5);
          add(R.head, m);
        });
      });
    }
  }
];
const KELO_SKIN_BY_ID = Object.fromEntries(KELO_SKINS.map(s => [s.id, s]));

function keloSkinDef(id) { return KELO_SKIN_BY_ID[id] || KELO_SKIN_BY_ID.classic; }

// "$1.49" in the viewer's own number format
function formatSkinPrice(skin) {
      if (!skin || !skin.priceCents) return 'Free';
      try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: skin.currency || 'USD' }).format(skin.priceCents / 100); }
      catch (e) { return `$${(skin.priceCents / 100).toFixed(2)}`; }
    }

// --- Ownership (state.skins) --------------------------------------------------------------------------
// Repairs whatever is there: old saves without it, unknown ids, an equipped skin he doesn't own.
function normalizeKeloSkins() {
      const s = state.skins && typeof state.skins === 'object' && !Array.isArray(state.skins) ? state.skins : {};
      const owned = ['classic'];
      (Array.isArray(s.owned) ? s.owned : []).forEach(id => { if (typeof id === 'string' && KELO_SKIN_BY_ID[id] && !owned.includes(id)) owned.push(id); });
      const equipped = typeof s.equipped === 'string' && owned.includes(s.equipped) ? s.equipped : 'classic';
      const purchases = (Array.isArray(s.purchases) ? s.purchases : [])
        .filter(p => p && typeof p === 'object' && KELO_SKIN_BY_ID[p.id])
        .slice(-50)
        .map(p => ({ id: p.id, at: Number(p.at) || 0, priceCents: Math.max(0, Math.round(Number(p.priceCents) || 0)), currency: typeof p.currency === 'string' ? p.currency.slice(0, 3) : 'USD', provider: typeof p.provider === 'string' ? p.provider.slice(0, 40) : 'unknown', mock: p.mock !== false }));
      state.skins = { owned, equipped, purchases };
      return state.skins;
    }
function keloEquippedSkinId() {
      const s = state.skins;
      return s && typeof s.equipped === 'string' && KELO_SKIN_BY_ID[s.equipped] && Array.isArray(s.owned) && s.owned.includes(s.equipped) ? s.equipped : 'classic';
    }
function keloOwnsSkin(id) { return id === 'classic' || Boolean(state.skins && Array.isArray(state.skins.owned) && state.skins.owned.includes(id)); }

// --- Dressing him: called by buildKelo1Character3D (js/kelo-body.js) ------------------------------------
function keloDressSkin(id, M, rig) {
      const skin = keloSkinDef(id);
      const groups = new Map();
      const add = (bone, obj) => {
        if (!bone || !obj) return obj;
        let g = groups.get(bone);
        if (!g) {
          g = new THREE.Group();
          g.name = 'keloSkin';
          g.userData.keloSkin = skin.id;
          bone.add(g);
          groups.set(bone, g);
        }
        g.add(obj);
        return obj;
      };
      if (typeof skin.parts === 'function') skin.parts(M, rig, add);
      // One mesh per material in each skin group
      groups.forEach(g => keloJoinRigid(g, new Set()));
      // Small proportion changes: scale the parts hung on a bone (never the bone, never another bone)
      const P = skin.proportions || {};
      const bones = new Set(['body', 'head', 'lArm', 'rArm', 'lElbow', 'rElbow', 'lHand', 'rHand', 'lLeg', 'rLeg', 'lKnee', 'rKnee', 'lFoot', 'rFoot'].map(k => rig[k]));
      Object.keys(P).forEach(k => {
        const bone = rig[k];
        if (!bone) return;
        const v = Array.isArray(P[k]) ? P[k] : [P[k], P[k], P[k]];
        const sc = new THREE.Vector3(...v.map(x => Math.max(0.9, Math.min(1.12, Number(x) || 1))));
        bone.children.forEach(c => {
          if (bones.has(c) || c === rig.pack) return;
          c.position.multiply(sc);
          c.scale.multiply(sc);
        });
        // his backpack stays on his back: it moves out with the torso but keeps its size
        if (k === 'body' && rig.pack) rig.pack.position.z *= sc.z;
      });
    }

// --- Changing skin in place -------------------------------------------------------------------------------
// The joints he has now, by name
function keloRigJoints() {
      return { group: keloGroup, body: keloBody, head: keloHead, lArm: keloLeftArm, rArm: keloRightArm, lElbow: keloLeftElbow, rElbow: keloRightElbow,
        lHand: keloLeftHand, rHand: keloRightHand, lLeg: keloLeftLeg, rLeg: keloRightLeg, lKnee: keloLeftKnee, rKnee: keloRightKnee, lFoot: keloLeftFoot, rFoot: keloRightFoot };
    }

// Free the GPU side of everything under obj (geometries, materials, their textures). The hand parts
// shared by every build (_keloHandParts) are kept.
function keloDisposeTree(obj, keepGeo) {
      const mats = new Set();
      obj.traverse(o => {
        if (typeof smallCasters !== 'undefined') smallCasters.delete(o);
        if (o.geometry && !keepGeo.has(o.geometry)) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => mats.add(m));
      });
      return mats;
    }

// Rebuild his look in place: the same joint objects stay where they are (position, rotation, pose,
// clip, IK, whatever he carries or holds), only the parts hung on them change.
function equipKeloSkinLook(id) {
      if (!keloGroup || !keloBody) return false;
      const skinId = keloSkinDef(id).id;
      const old = keloRigJoints();
      const oldBuilt = keloSkinBuilt;
      const oldEyes = [keloLeftEye, keloRightEye], oldAntenna = keloAntenna;
      const tools = { drill: keloDrillToolGroup && keloDrillToolGroup.visible, weld: keloWeldTorchGroup && keloWeldTorchGroup.visible, bit: keloDrillBitMesh ? keloDrillBitMesh.rotation.z : 0, tip: keloWeldTipGlow ? keloWeldTipGlow.visible : true };
      const eyesOn = typeof eyeCamHidden !== 'undefined' && eyeCamHidden.size > 0;
      if (eyesOn) eyeCamHideBody(false);

      buildKelo1Character3D({ skin: skinId, detached: true });   // sets the globals to the new parts
      const neu = keloRigJoints();
      // His joints stay the old objects
      keloGroup = old.group; keloBody = old.body; keloHead = old.head;
      keloLeftArm = old.lArm; keloRightArm = old.rArm; keloLeftElbow = old.lElbow; keloRightElbow = old.rElbow;
      keloLeftHand = old.lHand; keloRightHand = old.rHand; keloLeftLeg = old.lLeg; keloRightLeg = old.rLeg;
      keloLeftKnee = old.lKnee; keloRightKnee = old.rKnee; keloLeftFoot = old.lFoot; keloRightFoot = old.rFoot;

      const oldJoints = new Set(Object.values(old)), newJoints = new Set(Object.values(neu));
      const keepGeo = new Set(typeof _keloHandParts !== 'undefined' && _keloHandParts ? Object.values(_keloHandParts) : []);
      const mats = new Set();
      Object.keys(old).forEach(k => {
        const O = old[k], N = neu[k];
        // take his old parts off (only the ones the builder made: a carried box or held item stays)
        O.children.slice().forEach(c => {
          if (oldJoints.has(c) || !keloBuiltParts.has(c)) return;
          O.remove(c);
          keloDisposeTree(c, keepGeo).forEach(m => mats.add(m));
        });
        // and put the new ones on, in the same places
        N.children.slice().forEach(c => {
          if (newJoints.has(c)) return;
          N.remove(c);
          O.add(c);
        });
      });
      // The hands' finger rig moves over with the grip they had
      ['lHand', 'rHand'].forEach(k => {
        const grip = old[k].userData.grip;
        Object.assign(old[k].userData, { side: neu[k].userData.side, fingers: neu[k].userData.fingers, thumb: neu[k].userData.thumb, thumbTip: neu[k].userData.thumbTip, grip });
        setKeloGrip(old[k], grip);
      });
      // The antenna keeps its bounce; the tools stay out if they were out
      if (oldAntenna && keloAntenna) ['rx', 'rz', 'vx', 'vz', 'last', 'lastV'].forEach(n => { keloAntenna.userData[n] = oldAntenna.userData[n]; });
      if (keloAntenna && oldAntenna) keloAntenna.rotation.copy(oldAntenna.rotation);
      if (keloDrillToolGroup) keloDrillToolGroup.visible = Boolean(tools.drill);
      if (keloWeldTorchGroup) keloWeldTorchGroup.visible = Boolean(tools.weld);
      if (keloDrillBitMesh) keloDrillBitMesh.rotation.z = tools.bit;
      if (keloWeldTipGlow) keloWeldTipGlow.visible = tools.tip;
      // Free the old materials (and any the old parts used that the new ones don't)
      if (oldBuilt && oldBuilt.M) Object.values(oldBuilt.M).forEach(m => mats.add(m));
      const live = new Set();
      keloGroup.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => live.add(m)); });
      mats.forEach(m => {
        if (live.has(m)) return;
        ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'alphaMap'].forEach(t => { if (m[t] && m[t].dispose) m[t].dispose(); });
        m.dispose();
      });
      void oldEyes;
      keloGroup.updateMatrixWorld(true);
      if (eyesOn) eyeCamHideBody(true);
      if (typeof keloFace !== 'undefined') keloFace.blinkStart = -1;
      return true;
    }

// Wear a skin he owns: saved, rebuilt in place, and a line in his diary
function equipKeloSkin(id, { quiet = false } = {}) {
      normalizeKeloSkins();
      const skin = KELO_SKIN_BY_ID[id];
      if (!skin || !keloOwnsSkin(id)) return false;
      if (state.skins.equipped === id && keloSkinBuilt && keloSkinBuilt.skin === id) return true;
      state.skins.equipped = id;
      equipKeloSkinLook(id);
      if (!quiet && Array.isArray(state.diaryEntries)) {
        state.diaryEntries.unshift({
          time: 'A New Look', location: typeof currentPlaceLabel === 'function' ? currentPlaceLabel() : '',
          mood: `✨ Wearing ${skin.name}`,
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: id === 'classic'
            ? 'Dear Diary, I put my own teal paint back on today. It feels like coming home.'
            : `Dear Diary, I am wearing my ${skin.name} look today. ${skin.blurb} I keep catching my reflection in the lake.`
        });
      }
      if (typeof savePersistentBrainState === 'function') savePersistentBrainState();
      if (typeof renderKeloSkinsPanel === 'function') renderKeloSkinsPanel();
      return true;
    }

// --- Payments ---------------------------------------------------------------------------------------------
// One provider interface: { name, purchase(skin) -> Promise<{ ok, receipt?, reason? }> }. Ownership is
// granted only from an ok result with a receipt. A real provider must verify its receipt on a server
// before saying ok (see .claude/handoff.md).
const KELO_DEV_UNLOCK_KEY = 'kelo1_dev_unlock';
let KELO_DEV_UNLOCK = (() => { try { return localStorage.getItem(KELO_DEV_UNLOCK_KEY) !== 'off'; } catch (e) { return true; } })();
function setKeloDevUnlock(on) {
      KELO_DEV_UNLOCK = Boolean(on);
      try { localStorage.setItem(KELO_DEV_UNLOCK_KEY, KELO_DEV_UNLOCK ? 'on' : 'off'); } catch (e) {}
      if (typeof renderKeloSkinsPanel === 'function') renderKeloSkinsPanel();
    }

// Dev mode: a confirm sheet, then a free unlock. No money moves.
const mockPayment = {
  name: 'mock',
  async purchase(skin) {
    if (!KELO_DEV_UNLOCK) return { ok: false, reason: 'unavailable' };
    const yes = typeof skinConfirmSheet === 'function' ? await skinConfirmSheet(skin) : true;
    if (!yes) return { ok: false, reason: 'cancelled' };
    return { ok: true, receipt: { provider: 'mock', id: `mock-${skin.id}-${Date.now().toString(36)}`, mock: true } };
  }
};
let skinPayment = mockPayment;

// Buy a skin through the payment provider. Never grants anything unless the provider says ok.
let skinBuying = false;
async function buySkin(id) {
      normalizeKeloSkins();
      const skin = KELO_SKIN_BY_ID[id];
      if (!skin) return { ok: false, reason: 'unknown' };
      if (keloOwnsSkin(id)) return { ok: true, already: true };
      if (skinPayment === mockPayment && !KELO_DEV_UNLOCK) {
        if (typeof showToast === 'function') showToast('Payments coming soon');
        return { ok: false, reason: 'unavailable' };
      }
      if (skinBuying) return { ok: false, reason: 'busy' };
      skinBuying = true;
      let res;
      try { res = await skinPayment.purchase(skin); } catch (e) { res = { ok: false, reason: 'error' }; }
      finally { skinBuying = false; }
      if (!res || !res.ok || !res.receipt) return { ok: false, reason: (res && res.reason) || 'declined' };
      normalizeKeloSkins();
      if (!state.skins.owned.includes(id)) state.skins.owned.push(id);
      state.skins.purchases.push({ id, at: Date.now(), priceCents: skin.priceCents, currency: skin.currency, provider: skinPayment.name, mock: Boolean(res.receipt.mock) });
      if (typeof savePersistentBrainState === 'function') savePersistentBrainState();
      if (typeof showToast === 'function') showToast(`${skin.name} unlocked`);
      if (typeof renderKeloSkinsPanel === 'function') renderKeloSkinsPanel();
      return { ok: true, receipt: res.receipt };
    }
