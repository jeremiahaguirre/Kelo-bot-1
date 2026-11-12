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
// A head or body profile made bigger (k across, ky up)
const skinScaleProfile = (profile, k, ky = k) => profile.map(([r, y]) => [r * k, y * ky]);
const SKIN_ROUND_HEAD = [[0, 0], [0.12, 0.01], [0.215, 0.05], [0.278, 0.12], [0.303, 0.21], [0.31, 0.3], [0.302, 0.39], [0.272, 0.47], [0.215, 0.545], [0.125, 0.598], [0, 0.615]];

const KELO_SKINS = [
  {
    id: 'classic', name: 'Classic', priceCents: 0, currency: 'USD', rarity: 'standard',
    blurb: 'His own round teal body, cream panels and headphone ears.',
    palette: {}, shape: null, parts: null
  },
  {
    id: 'explorer', name: 'Explorer', priceCents: 99, currency: 'USD', rarity: 'standard',
    blurb: 'Heavy-duty field armour: a big rounded helmet, bulky gauntlets and shin guards over dark mechanical joints, ear discs with cyan rings and chunky boots.',
    palette: {
      shell: { color: 0xf1f3f5, metalness: 0.06, roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.14 },
      cream: { color: 0x2b3036, roughness: 0.42, clearcoat: 0.4 },
      cover: { color: 0x26292e, metalness: 0.35, roughness: 0.45 },
      joint: { color: 0x1f2226, metalness: 0.4, roughness: 0.5 },
      rubber: { color: 0x17191c },
      frame: { color: 0x9aa3ad },
      amber: { color: 0xff9d2e, emissive: 0x3a1800, emissiveIntensity: 0.4 },
      led: { color: 0x7af0ff },
      eye: { color: 0x7ff0ff },
      eyeGlow: { color: 0x3fdcff, opacity: 0.4 }
    },
    idColor: '#38d6f5',
    shape: {
      head: { kind: 'box', w: 0.76, h: 0.64, d: 0.66, r: 0.22 },
      face: { yc: 0.31, w: 0.5, h: 0.3 },
      eyes: { y: 0.32, x: 0.12, r: 0.072, mouthDy: 0.12, cheekDy: 0.07 },
      ears: 'none',
      torso: { kind: 'box', w: 0.52, h: 0.6, d: 0.42, r: 0.14 },
      belly: { yc: 0.29, w: 0.26, h: 0.2 },
      pack: { w: 0.3, h: 0.3, d: 0.12 },
      arm: { kind: 'box', shoulder: 0.11, upper: [0.07, 0.066], elbow: 0.07, fore: [0.1, 0.094] },
      leg: { kind: 'box', hip: 0.1, thigh: [0.09, 0.088], knee: 0.088, shin: [0.1, 0.104] },
      boot: { kind: 'box', w: 0.145, h: 0.17, l: 0.24, toe: 0.055 }
    },
    parts(M, R, add) {
      const cyan = skinGlow(0x45e3ff, 1);
      // Big round ear discs, a cyan ring round each
      const disc = new THREE.CylinderGeometry(0.18, 0.18, 0.07, 30).rotateZ(Math.PI / 2);
      const face = new THREE.CylinderGeometry(0.12, 0.12, 0.012, 24).rotateZ(Math.PI / 2);
      const ring = new THREE.TorusGeometry(0.145, 0.014, 6, 30).rotateY(Math.PI / 2);
      [-1, 1].forEach(s => {
        add(R.head, keloMesh(disc, M.shell, { pos: [s * (R.earX + 0.025), 0.33, -0.02] }));
        add(R.head, keloMesh(face, M.cover, { pos: [s * (R.earX + 0.062), 0.33, -0.02], shadow: false }));
        add(R.head, keloMesh(ring, cyan, { pos: [s * (R.earX + 0.064), 0.33, -0.02] }));
        // a short aerial off the back of each disc
        add(R.head, keloMesh(new THREE.CylinderGeometry(0.008, 0.01, 0.26, 6), M.frame, { pos: [s * (R.earX + 0.03), 0.58, -0.1], shadow: false }));
      });
      // A brow ridge over the visor, a crown plate and a cyan strip over the top
      add(R.head, keloMesh(keloRoundedBox(0.58, 0.06, 0.07, 0.025, 0.008), M.cover, { pos: [0, 0.5, 0.31] }));
      add(R.head, keloMesh(keloRoundedBox(0.4, 0.05, 0.44, 0.04, 0.01), M.shell, { pos: [0, 0.645, -0.02] }));
      add(R.head, keloMesh(keloRoundedBox(0.07, 0.02, 0.5, 0.008, 0.004), cyan, { pos: [0, 0.672, -0.02], shadow: false }));
      // Knee caps and shin guards (orange tags), elbow caps and gauntlet plates, shoulder pads
      const kneeCap = skinCapGeometry(0.11, 1.15);
      const shinPlate = keloRoundedBox(0.2, 0.24, 0.04, 0.05, 0.01);
      const tag = keloRoundedBox(0.05, 0.024, 0.012, 0.008, 0.003);
      const elbowCap = skinCapGeometry(0.085, 1.2).rotateY(Math.PI);
      const forePlate = keloRoundedBox(0.16, 0.18, 0.035, 0.04, 0.008);
      ['lKnee', 'rKnee'].forEach(k => {
        add(R[k], keloMesh(kneeCap, M.shell, { pos: [0, -0.025, 0.04] }));
        add(R[k], keloMesh(shinPlate, M.shell, { pos: [0, -0.25, 0.1] }));
        add(R[k], keloMesh(tag, M.amber, { pos: [0, -0.3, 0.123], shadow: false }));
      });
      ['lElbow', 'rElbow'].forEach(k => {
        add(R[k], keloMesh(elbowCap, M.shell, { pos: [0, -0.01, -0.015] }));
        add(R[k], keloMesh(forePlate, M.shell, { pos: [0, -0.15, -0.09] }));
      });
      const pad = skinCapGeometry(0.15, 1.1).rotateX(-Math.PI / 2);
      ['lArm', 'rArm'].forEach(k => add(R[k], keloMesh(pad, M.shell, { pos: [0, 0.02, 0] })));
      // Dark ribbed waist (exposed mechanics) and chest vents with a cyan light
      [0, 1, 2].forEach(i => add(R.body, keloMesh(new THREE.TorusGeometry(0.2, 0.018, 6, 26).rotateX(Math.PI / 2), M.joint, { pos: [0, 0.02 + i * 0.035, 0] })));
      add(R.body, keloMesh(keloRoundedBox(0.12, 0.03, 0.012, 0.012, 0.004), cyan, { pos: [0, 0.47, 0.212], shadow: false }));
      const vent = keloRoundedBox(0.09, 0.014, 0.01, 0.006, 0.003);
      [-1, 1].forEach(s => [0, 1, 2].forEach(i => add(R.body, keloMesh(vent, M.cover, { pos: [s * 0.16, 0.14 + i * 0.03, 0.213], shadow: false }))));
      // Orange toe caps on the boots
      ['lFoot', 'rFoot'].forEach(k => add(R[k], keloMesh(keloRoundedBox(0.2, 0.05, 0.03, 0.015, 0.005), M.amber, { pos: [0, -R.ankleY + 0.06, 0.29] })));
    }
  },
  {
    id: 'kitbot', name: 'Kitbot', priceCents: 149, currency: 'USD', rarity: 'rare',
    blurb: 'A big space-helmet head with a dark screen face, cat-ear fins and chunky magenta headphones, a puffy suit and a colour-bar chest panel.',
    palette: {
      shell: { color: 0xf8f8fb, metalness: 0.04, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 },
      cream: { color: 0xf8f8fb },
      cover: { color: 0x2a2440, roughness: 0.45 },
      joint: { color: 0xe8268f },
      rubber: { color: 0x2a2440 },
      frame: { color: 0xd0d3da },
      amber: { color: 0xe8268f, emissive: 0x3a0020, emissiveIntensity: 0.4 },
      glass: { color: 0x120d24 },
      eye: { color: 0x7ff3ff },
      eyeGlow: { color: 0x4fe3ff, opacity: 0.32 },
      led: { color: 0xff4fb3 },
      cheek: { color: 0xff6fae }
    },
    idColor: '#ff5cb0',
    shape: {
      head: { kind: 'lathe', profile: skinScaleProfile(SKIN_ROUND_HEAD, 1.34, 1.3), sx: 1.12, sz: 1.0 },
      face: { yc: 0.38, hy: 0.27, phi: 1.12 },
      eyes: { y: 0.41, phi: 0.33, r: 0.07, mouthDy: 0.11, cheekDy: 0.07 },
      ears: 'none',
      antenna: false,
      torso: { kind: 'lathe', profile: [[0, 0], [0.18, 0.02], [0.24, 0.08], [0.26, 0.2], [0.26, 0.36], [0.25, 0.46], [0.21, 0.54], [0.12, 0.6], [0, 0.62]], sx: 1.04, sz: 0.88 },
      belly: { yc: 0.28, hy: 0.13, phi: 0.5 },
      pack: { w: 0.38, h: 0.4, d: 0.14 },
      arm: { kind: 'capsule', shoulder: 0.095, upper: [0.08, 0.076], elbow: 0.065, fore: [0.082, 0.072] },
      leg: { kind: 'capsule', hip: 0.1, thigh: [0.104, 0.1], knee: 0.085, shin: [0.1, 0.094] },
      boot: { kind: 'ball', w: 0.14, h: 0.13, l: 0.18, toe: 0.045 }
    },
    parts(M, R, add) {
      // Cat-ear fins on top of the helmet, magenta inside
      const tri = (w, h) => {
        const s = new THREE.Shape();
        s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w * 0.08, h); s.lineTo(-w * 0.08, h); s.lineTo(-w / 2, 0);
        const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.014, bevelThickness: 0.014, bevelSegments: 2, curveSegments: 2 });
        g.translate(0, 0, -0.025);
        return g;
      };
      const fin = tri(0.25, 0.22), inner = tri(0.13, 0.13);
      [-1, 1].forEach(s => {
        const g = new THREE.Group();
        g.position.set(s * 0.25, 0.66, 0.04);
        g.rotation.set(-0.1, 0, -s * 0.42);
        g.add(keloMesh(fin, M.shell));
        g.add(keloMesh(inner, M.amber, { pos: [0, 0.045, 0.035], shadow: false }));
        add(R.head, g);
      });
      // Chunky headphones: big cups and a thick band, behind the fins
      const cup = new THREE.CylinderGeometry(0.17, 0.17, 0.1, 28).rotateZ(Math.PI / 2);
      const pad = new THREE.TorusGeometry(0.14, 0.03, 8, 28).rotateY(Math.PI / 2);
      const cap = new THREE.CylinderGeometry(0.1, 0.1, 0.014, 24).rotateZ(Math.PI / 2);
      [-1, 1].forEach(s => {
        add(R.head, keloMesh(cup, M.amber, { pos: [s * (R.earX + 0.04), 0.36, -0.03] }));
        add(R.head, keloMesh(pad, M.shell, { pos: [s * (R.earX - 0.005), 0.36, -0.03] }));
        add(R.head, keloMesh(cap, M.shell, { pos: [s * (R.earX + 0.098), 0.36, -0.03], shadow: false }));
      });
      const band = keloMesh(new THREE.TorusGeometry(R.earX + 0.05, 0.045, 8, 30, Math.PI), M.amber, { pos: [0, 0.36, -0.12] });
      band.scale.set(1, 1.0, 1);
      add(R.head, band);
      // Magenta shoulder caps, cuffs and boot tops
      const cap2 = skinCapGeometry(0.115, 1.2).rotateX(-Math.PI / 2);
      ['lArm', 'rArm'].forEach(k => add(R[k], keloMesh(cap2, M.amber, { pos: [0, 0.01, 0] })));
      const cuff = new THREE.TorusGeometry(0.08, 0.026, 8, 22).rotateX(Math.PI / 2);
      ['lElbow', 'rElbow'].forEach(k => add(R[k], keloMesh(cuff, M.amber, { pos: [0, -0.27, 0] })));
      const bootTop = new THREE.TorusGeometry(0.1, 0.03, 8, 22).rotateX(Math.PI / 2);
      ['lKnee', 'rKnee'].forEach(k => add(R[k], keloMesh(bootTop, M.amber, { pos: [0, -0.4, 0] })));
      // A dark chest panel with five glowing colour bars
      const at = keloOnSurface(keloProfileR(R.torsoProfile, 0.3), 0.3, 0, R.TSX, R.TSZ, 0.006);
      const panel = new THREE.Group();
      panel.position.copy(at.p); panel.lookAt(at.p.clone().add(at.n));
      panel.add(keloMesh(keloRoundedBox(0.2, 0.17, 0.02, 0.04, 0.006), M.cover, { shadow: false }));
      [0xff5a5a, 0xffc23a, 0x5ee07a, 0x4fb3ff, 0xb07aff].forEach((c, i) => panel.add(keloMesh(keloRoundedBox(0.024, 0.11, 0.01, 0.008, 0.003), skinGlow(c, 1), { pos: [-0.064 + i * 0.032, 0, 0.012], shadow: false })));
      add(R.body, panel);
    }
  },
  {
    id: 'marshmallow', name: 'Marshmallow', priceCents: 149, currency: 'USD', rarity: 'rare',
    blurb: 'Soft-touch blush pink and all curves: a big smooth round head with a little window face and amber side lenses, a cosy sweater body, wide sleeves and trousers, and big round shoes.',
    palette: {
      shell: { kind: 'std', color: 0xf6c4cc, metalness: 0, roughness: 0.86 },
      cream: { kind: 'std', color: 0xfdf3f0, metalness: 0, roughness: 0.6 },
      cover: { color: 0xf0b3bf, metalness: 0, roughness: 0.85 },
      joint: { color: 0xe8a9b6, roughness: 0.9 },
      rubber: { color: 0xd38f9f, roughness: 0.9 },
      seam: { color: 0xe3a2b0, metalness: 0 },
      frame: { color: 0xf6d6dc, metalness: 0.1, roughness: 0.8 },
      amber: { color: 0xffb02e, emissive: 0x8a4a00, emissiveIntensity: 0.8 },
      glass: { kind: 'std', color: 0xf7eef6, metalness: 0, roughness: 0.35 },
      eye: { color: 0x2c3a9e },
      eyeGlow: { color: 0x000000, opacity: 0 },
      shine: { color: 0xc9d3ff },
      led: { color: 0xffc070 },
      cheek: { color: 0xff9aa6, opacity: 0.55 },
      visor: { opacity: 0.08 }
    },
    idColor: '#ffb347',
    shape: {
      head: { kind: 'lathe', profile: [[0, 0], [0.16, 0.015], [0.28, 0.08], [0.36, 0.19], [0.405, 0.32], [0.415, 0.45], [0.395, 0.57], [0.34, 0.68], [0.24, 0.765], [0.12, 0.81], [0, 0.82]], sx: 1.0, sz: 0.98 },
      face: { yc: 0.45, hy: 0.15, phi: 0.72 },
      eyes: { y: 0.46, phi: 0.2, r: 0.045, mouthDy: 0.08, cheekDy: 0.055, cheek: 0.8 },
      ears: 'none',
      torso: { kind: 'lathe', profile: [[0, -0.06], [0.24, -0.05], [0.275, 0.03], [0.285, 0.2], [0.285, 0.42], [0.27, 0.52], [0.21, 0.6], [0.11, 0.645], [0, 0.655]], sx: 0.94, sz: 0.86 },
      belly: { yc: 0.3, hy: 0.16, phi: 0.36 },
      pack: { w: 0.28, h: 0.3, d: 0.1 },
      arm: { kind: 'capsule', shoulder: 0.1, upper: [0.092, 0.098], elbow: 0.08, fore: [0.1, 0.108] },
      leg: { kind: 'capsule', hip: 0.1, thigh: [0.108, 0.11], knee: 0.1, shin: [0.112, 0.118] },
      boot: { kind: 'ball', w: 0.155, h: 0.15, l: 0.21, toe: 0.06 }
    },
    parts(M, R, add) {
      const warm = new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
      const glowStrip = skinGlow(0xbfe9ff, 1);
      // A tall rounded chest plate with an amber button and two light strips
      const at = keloOnSurface(keloProfileR(R.torsoProfile, 0.3), 0.3, 0, R.TSX, R.TSZ, 0.01);
      const plate = new THREE.Group();
      plate.position.copy(at.p); plate.lookAt(at.p.clone().add(at.n));
      plate.add(keloMesh(keloRoundedBox(0.13, 0.3, 0.02, 0.06, 0.008), M.cream, { shadow: false }));
      plate.add(keloMesh(new THREE.CylinderGeometry(0.045, 0.048, 0.03, 24).rotateX(Math.PI / 2), M.amber, { pos: [0, -0.03, 0.014] }));
      const halo = keloMesh(new THREE.CircleGeometry(0.085, 24), warm, { pos: [0, -0.03, 0.012], shadow: false });
      halo.renderOrder = 1;
      plate.add(halo);
      [-0.03, 0.03].forEach(x => plate.add(keloMesh(keloRoundedBox(0.016, 0.06, 0.01, 0.006, 0.002), glowStrip, { pos: [x, 0.09, 0.012], shadow: false })));
      add(R.body, plate);
      // Amber lens on each side of the head, set in a soft ring
      [-1, 1].forEach(s => {
        const x = s * (R.earX - 0.01);
        add(R.head, keloMesh(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 24).rotateZ(Math.PI / 2), M.cover, { pos: [x, 0.42, 0.04] }));
        add(R.head, keloMesh(new THREE.SphereGeometry(0.058, 18, 12), M.amber, { pos: [x + s * 0.018, 0.42, 0.04] }));
      });
      // A sweater hem, wide sleeve cuffs with an amber band, trouser hems
      add(R.body, (() => { const m = keloMesh(new THREE.TorusGeometry(0.255, 0.03, 8, 30).rotateX(Math.PI / 2), M.cover, { pos: [0, -0.04, 0] }); m.scale.set(0.95, 1, 0.87); return m; })());
      const sleeve = new THREE.TorusGeometry(0.105, 0.022, 8, 22).rotateX(Math.PI / 2);
      ['lElbow', 'rElbow'].forEach(k => {
        add(R[k], keloMesh(sleeve, M.cover, { pos: [0, -0.275, 0] }));
        add(R[k], keloMesh(new THREE.TorusGeometry(0.106, 0.009, 6, 22).rotateX(Math.PI / 2), M.amber, { pos: [0, -0.24, 0], shadow: false }));
      });
      const hem = new THREE.TorusGeometry(0.118, 0.024, 8, 22).rotateX(Math.PI / 2);
      ['lKnee', 'rKnee'].forEach(k => add(R[k], keloMesh(hem, M.cover, { pos: [0, -0.39, 0] })));
      // A soft warm pom on his antenna
      add(R.antenna, keloMesh(new THREE.SphereGeometry(0.06, 16, 12), M.amber, { pos: [0, 0.2, 0] }));
    }
  },
  {
    id: 'twirl', name: 'Twirl', priceCents: 199, currency: 'USD', rarity: 'epic',
    blurb: 'A big glossy pearl head with huge lashed eyes and two curled pigtail horns, a tiny body in a flared dress, and thin dark limbs dotted with light.',
    palette: {
      shell: { color: 0xf3f4f7, metalness: 0.3, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.03 },
      cream: { color: 0xf3f4f7 },
      cover: { color: 0x1c2230, metalness: 0.35, roughness: 0.35 },
      joint: { color: 0x151a24, metalness: 0.3, roughness: 0.4 },
      rubber: { color: 0x151a24 },
      frame: { color: 0xdfe4ec, metalness: 0.7 },
      amber: { color: 0x37e0e8, emissive: 0x0a4a50, emissiveIntensity: 0.6 },
      eye: { color: 0x4fe8f2 },
      eyeGlow: { color: 0x1fb8d8, opacity: 0.5 },
      led: { color: 0x5ff0f5 },
      cheek: { color: 0xffb3d1, opacity: 0.5 }
    },
    idColor: '#37e0e8',
    shape: {
      head: { kind: 'lathe', profile: [[0, 0], [0.13, 0.012], [0.25, 0.07], [0.335, 0.17], [0.38, 0.3], [0.39, 0.42], [0.372, 0.54], [0.32, 0.65], [0.23, 0.735], [0.12, 0.78], [0, 0.79]], sx: 1.0, sz: 0.94 },
      face: null,
      eyes: { y: 0.33, phi: 0.43, r: 0.1, mouthDy: 0.16, cheekDy: 0.1 },
      ears: 'none',
      antenna: false,
      torso: { kind: 'lathe', profile: [[0, 0.05], [0.1, 0.06], [0.12, 0.15], [0.12, 0.26], [0.14, 0.38], [0.165, 0.47], [0.16, 0.54], [0.12, 0.6], [0.07, 0.645], [0, 0.66]], sx: 1.0, sz: 0.85 },
      belly: { yc: 0.42, hy: 0.06, phi: 0.3 },
      pack: { w: 0.16, h: 0.18, d: 0.06 },
      pelvis: { profile: [[0, -0.1], [0.07, -0.095], [0.11, -0.06], [0.13, 0.0], [0.13, 0.06], [0, 0.08]], sx: 1.0, sz: 0.85 },
      limbMat: 'cover',
      arm: { kind: 'capsule', shoulder: 0.058, upper: [0.042, 0.038], elbow: 0.04, fore: [0.04, 0.034] },
      leg: { kind: 'capsule', hip: 0.065, thigh: [0.055, 0.048], knee: 0.048, shin: [0.05, 0.042] },
      boot: { kind: 'dome', w: 0.095, h: 0.1, l: 0.18, toe: 0.06 }
    },
    parts(M, R, add) {
      const glow = skinGlow(0x5ff0f5, 1);
      const dress = new THREE.MeshPhysicalMaterial({ color: 0xf4f5f8, metalness: 0.15, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide });
      // Two curled pigtail horns, swept up and out from the top of the head, with glowing bands
      [-1, 1].forEach(s => {
        const pts = [[0.2, 0.66], [0.3, 0.74], [0.41, 0.8], [0.52, 0.78], [0.57, 0.69], [0.55, 0.6], [0.49, 0.58], [0.46, 0.63]]
          .map(([x, y], i) => new THREE.Vector3(s * x, y, -0.04 - i * 0.01));
        const curve = new THREE.CatmullRomCurve3(pts);
        const tube = new THREE.TubeGeometry(curve, 48, 1, 10, false);
        // thick at the root, thinning to the tip
        const pos = tube.attributes.position, n = 49, ring = 11;
        for (let i = 0; i < n; i++) {
          const c = curve.getPointAt(i / (n - 1)), rad = 0.055 * (1 - i / (n - 1)) + 0.016;
          for (let j = 0; j < ring; j++) {
            const k = i * ring + j, v = new THREE.Vector3(pos.getX(k), pos.getY(k), pos.getZ(k)).sub(c).multiplyScalar(rad).add(c);
            pos.setXYZ(k, v.x, v.y, v.z);
          }
        }
        tube.computeVertexNormals();
        add(R.head, keloMesh(tube, M.shell));
        [0.08, 0.13].forEach(u => {
          const p = curve.getPointAt(u), tg = curve.getTangentAt(u);
          const band = keloMesh(new THREE.TorusGeometry(0.06 * (1 - u) + 0.022, 0.012, 6, 18), u < 0.1 ? M.cover : glow, { shadow: false });
          band.position.copy(p); band.lookAt(p.clone().add(tg));
          add(R.head, band);
        });
      });
      // Soft swirls moulded on her crown
      [-0.12, 0, 0.12].forEach(x => {
        const sw = keloMesh(new THREE.TorusGeometry(0.045, 0.012, 6, 16, Math.PI * 1.5), M.shell, { pos: [x, 0.7, 0.2 - Math.abs(x) * 0.5] });
        sw.rotation.set(-0.9, 0, x * 3);
        add(R.head, sw);
      });
      // A flared dress: a bodice ring at the waist, the back and sides bell out from the hips, the
      // front panels ride on her thighs (they lift with her legs when she sits)
      add(R.body, keloLathe([[0.18, 0.0], [0.15, 0.1], [0.135, 0.2], [0.14, 0.26]], dress, { sx: 1, sz: 0.85, seg: 26 }));
      const bell = [[0.4, -0.25], [0.33, -0.16], [0.25, -0.07], [0.19, 0.0]].map(([r, y]) => new THREE.Vector2(r, y));
      const back = keloMesh(new THREE.LatheGeometry(bell, 28, 1.6, Math.PI * 2 - 3.2), dress);
      back.scale.set(1, 1, 0.85);
      add(R.body, back);
      const front = [[0.22, -0.23], [0.18, -0.14], [0.14, -0.05], [0.12, 0.02]].map(([r, y]) => new THREE.Vector2(r, y));
      [['lLeg', -1], ['rLeg', 1]].forEach(([k, s]) => add(R[k], keloMesh(new THREE.LatheGeometry(front, 14, s > 0 ? -0.55 : -1.6, 2.15), dress)));
      // Light dots on her dark arms and legs, and a glowing band at her chest
      const dot = new THREE.SphereGeometry(0.014, 8, 6);
      ['lArm', 'rArm'].forEach(k => add(R[k], keloMesh(dot, glow, { pos: [0, -0.18, 0.04], shadow: false })));
      ['lElbow', 'rElbow'].forEach(k => add(R[k], keloMesh(dot, glow, { pos: [0, -0.15, 0.038], shadow: false })));
      ['lKnee', 'rKnee'].forEach(k => { add(R[k], keloMesh(dot, glow, { pos: [0, -0.16, 0.048], shadow: false })); add(R[k], keloMesh(dot, glow, { pos: [0, -0.3, 0.044], shadow: false })); });
      add(R.body, (() => { const m = keloMesh(new THREE.TorusGeometry(0.155, 0.009, 6, 26).rotateX(Math.PI / 2), glow, { pos: [0, 0.47, 0], shadow: false }); m.scale.set(1.06, 1, 0.9); return m; })());
      // Deep dark sockets the big eyes glow out of
      [-1, 1].forEach(s => {
        const at = keloOnSurface(keloProfileR(R.headProfile, 0.33), 0.33, s * 0.43, R.HSX, R.HSZ, 0.005);
        const m = keloMesh(new THREE.CircleGeometry(0.135, 28), M.cover, { shadow: false });
        m.position.copy(at.p); m.lookAt(at.p.clone().add(at.n)); m.scale.set(0.95, 1.08, 1);
        add(R.head, m);
      });
      // Long glowing lashes drawn on the shell over each eye
      const lash = new THREE.BoxGeometry(0.014, 0.05, 0.004);
      [R.lEye, R.rEye].forEach(eye => {
        const s = eye.userData.side, open = eye.userData.open;
        (s > 0 ? [0.3, 0.7, 1.1] : [Math.PI - 0.3, Math.PI - 0.7, Math.PI - 1.1]).forEach(a => {
          const m = keloMesh(lash, M.cover, { shadow: false });
          m.position.set(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0.002);
          m.rotation.z = a - Math.PI / 2;
          add(open, m);
        });
      });
    }
  },
  {
    id: 'spark', name: 'Spark', priceCents: 299, currency: 'USD', rarity: 'legendary',
    blurb: 'Brushed silver with a big helmet head and a full black face screen, glowing ear spikes and crown light, blue glow rings at every joint and chunky boots.',
    palette: {
      shell: { color: 0xd3d8e0, metalness: 0.8, roughness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.08 },
      cream: { color: 0xd3d8e0, metalness: 0.8, roughness: 0.2, clearcoat: 0.8 },
      cover: { color: 0x15181e, metalness: 0.4, roughness: 0.25 },
      joint: { color: 0x2a2e36, metalness: 0.5 },
      rubber: { color: 0x15171b },
      frame: { color: 0xdfe4ea, metalness: 0.9, roughness: 0.2 },
      amber: { color: 0x4fc3ff, emissive: 0x0a3a66, emissiveIntensity: 0.8 },
      glass: { color: 0x05070c },
      visor: { color: 0x8fb8ff, opacity: 0.22 },
      eye: { color: 0x8fdcff },
      eyeGlow: { color: 0x3fa8ff, opacity: 0.45 },
      led: { color: 0x6fd0ff },
      cheek: { color: 0xff5c90, opacity: 0.75 }
    },
    idColor: '#6fc3ff',
    shape: {
      head: { kind: 'lathe', profile: skinScaleProfile(SKIN_ROUND_HEAD, 1.33, 1.25), sx: 1.13, sz: 1.0 },
      face: { yc: 0.37, hy: 0.27, phi: 1.2 },
      eyes: { y: 0.4, phi: 0.36, r: 0.09, mouthDy: 0.14, cheekDy: 0.1, cheek: 1.2 },
      ears: 'none',
      antenna: false,
      torso: { kind: 'lathe', profile: [[0, 0], [0.15, 0.02], [0.18, 0.1], [0.2, 0.22], [0.24, 0.36], [0.262, 0.46], [0.242, 0.54], [0.16, 0.61], [0.08, 0.645], [0, 0.66]], sx: 1.0, sz: 0.8 },
      belly: { yc: 0.15, hy: 0.12, phi: 0.75 },
      arm: { kind: 'capsule', shoulder: 0.1, upper: [0.075, 0.07], elbow: 0.062, fore: [0.086, 0.08] },
      leg: { kind: 'capsule', hip: 0.095, thigh: [0.098, 0.092], knee: 0.082, shin: [0.105, 0.1] },
      boot: { kind: 'dome', w: 0.14, h: 0.14, l: 0.205, toe: 0.05 }
    },
    parts(M, R, add) {
      const blue = skinGlow(0x5cc8ff, 1);
      const soft = new THREE.MeshBasicMaterial({ color: 0x3f9cff, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
      // The belly panel is black glass (the cream material is silver on Spark)
      // Glow rings round his chest light
      const at = keloOnSurface(keloProfileR(R.torsoProfile, 0.36), 0.36, 0, R.TSX, R.TSZ, 0.01);
      const chest = new THREE.Group();
      chest.position.copy(at.p); chest.lookAt(at.p.clone().add(at.n));
      chest.add(keloMesh(new THREE.CircleGeometry(0.06, 24), M.cover, { shadow: false }));
      chest.add(keloMesh(new THREE.TorusGeometry(0.06, 0.012, 6, 28), blue, { pos: [0, 0, 0.004], shadow: false }));
      chest.add(keloMesh(new THREE.CircleGeometry(0.03, 20), blue, { pos: [0, 0, 0.003], shadow: false }));
      const halo = keloMesh(new THREE.RingGeometry(0.05, 0.12, 32), soft, { pos: [0, 0, -0.002], shadow: false });
      halo.renderOrder = 1;
      chest.add(halo);
      add(R.body, chest);
      add(R.body, keloMesh(keloPatchGeometry(R.torsoProfile, R.TSX, R.TSZ, { yc: 0.13, hy: 0.12, phi: 0.95 }, 0.006, 0.1), M.cover, { shadow: false }));
      // Ear cups with glow rings and swept-up spikes, and a glowing disc on the crown
      const cup = new THREE.CylinderGeometry(0.15, 0.15, 0.09, 28).rotateZ(Math.PI / 2);
      const ring = new THREE.TorusGeometry(0.11, 0.016, 6, 28).rotateY(Math.PI / 2);
      [-1, 1].forEach(s => {
        add(R.head, keloMesh(cup, M.shell, { pos: [s * (R.earX + 0.02), 0.36, -0.02] }));
        add(R.head, keloMesh(ring, blue, { pos: [s * (R.earX + 0.067), 0.36, -0.02] }));
        const spike = keloMesh(new THREE.ConeGeometry(0.045, 0.22, 14), M.shell, { pos: [s * (R.earX + 0.03), 0.52, -0.04] });
        spike.rotation.z = -s * 0.25;
        add(R.head, spike);
        const tip = keloMesh(new THREE.ConeGeometry(0.03, 0.08, 12), blue, { pos: [s * (R.earX + 0.058), 0.64, -0.04], shadow: false });
        tip.rotation.z = -s * 0.25;
        add(R.head, tip);
      });
      add(R.head, keloMesh(new THREE.CylinderGeometry(0.1, 0.11, 0.025, 28), M.shell, { pos: [0, 0.762, 0] }));
      add(R.head, keloMesh(new THREE.TorusGeometry(0.08, 0.014, 6, 26).rotateX(Math.PI / 2), blue, { pos: [0, 0.777, 0], shadow: false }));
      // Blue glow rings at his joints: shoulders, elbows, wrists, hips, knees, ankles
      ['lArm', 'rArm'].forEach(k => add(R[k], skinLimbRing(0.082, 0.012, -0.08, blue)));
      ['lElbow', 'rElbow'].forEach(k => { add(R[k], skinLimbRing(0.07, 0.012, -0.03, blue)); add(R[k], skinLimbRing(0.084, 0.01, -0.27, blue)); });
      ['lLeg', 'rLeg'].forEach(k => add(R[k], skinLimbRing(0.104, 0.012, -0.12, blue)));
      ['lKnee', 'rKnee'].forEach(k => { add(R[k], skinLimbRing(0.094, 0.014, -0.02, blue)); add(R[k], skinLimbRing(0.108, 0.012, -0.38, blue)); });
      // Blush strokes on his face screen, by the cheek lights
      const stroke = keloRoundedBox(0.01, 0.036, 0.003, 0.004, 0.001);
      const pink = skinGlow(0xff7fae, 1);
      [-1, 1].forEach(s => [-0.06, 0, 0.06].forEach(d => {
        const m = skinSurfaceTile(stroke, pink, R.headProfile, R.HSX, R.HSZ, 0.3, s * (0.62 + d), 0.03);
        m.rotateZ(-s * 0.5);
        add(R.head, m);
      }));
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
