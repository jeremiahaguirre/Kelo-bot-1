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
// A round head of radius r whose bottom dips `drop` below the neck joint (big chibi heads sit low)
function skinBallHead(r, drop = 0.05, squash = 1) {
      const p = [];
      for (let i = 0; i <= 12; i++) {
        const a = -Math.PI / 2 + Math.PI * i / 12;
        p.push([Math.max(0, Math.cos(a) * r), -drop + (Math.sin(a) + 1) * r * squash]);
      }
      p[0][0] = 0; p[12][0] = 0;
      return p;
    }
// A tube along a curve whose radius goes from r0 at the root to r1 at the tip
function skinTaperTube(curve, r0, r1, seg = 48, radial = 12) {
      const g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
      const pos = g.attributes.position, ring = radial + 1, v = new THREE.Vector3();
      for (let i = 0; i <= seg; i++) {
        const c = curve.getPointAt(i / seg), rad = r0 + (r1 - r0) * Math.pow(i / seg, 0.85);
        for (let j = 0; j < ring; j++) {
          const k = i * ring + j;
          v.set(pos.getX(k), pos.getY(k), pos.getZ(k)).sub(c).multiplyScalar(rad).add(c);
          pos.setXYZ(k, v.x, v.y, v.z);
        }
      }
      g.computeVertexNormals();
      return g;
    }
// Stick a mesh on a lathe shape at (y, phi), facing out
function skinOnShape(mesh, prof, sx, sz, y, phi, lift) {
      const at = keloOnSurface(keloProfileR(prof, y), y, phi, sx, sz, lift);
      mesh.position.copy(at.p);
      mesh.lookAt(at.p.clone().add(at.n));
      return mesh;
    }

const KELO_SKINS = [
  {
    id: 'classic', name: 'Classic', priceCents: 0, currency: 'USD', rarity: 'standard',
    blurb: 'His own round teal body, cream panels and headphone ears.',
    palette: {}, shape: null, parts: null, view: { yaw: 0.35, elev: 0.08 }
  },
  {
    id: 'explorer', name: 'Explorer', priceCents: 99, currency: 'USD', rarity: 'standard',
    blurb: 'Heavy field armour: a huge dome helmet with stacked ear modules and twin aerials, big shoulder pads and gauntlets, a wide hip plate on wheel joints and big shin shells.',
    view: { yaw: 0.12, elev: -0.05 },
    palette: {
      shell: { color: 0xf3f4f5, metalness: 0.05, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.2 },
      cream: { color: 0xe9ebee, roughness: 0.45 },
      cover: { color: 0x2c2f34, metalness: 0.4, roughness: 0.5 },
      joint: { color: 0x2a2d32, metalness: 0.45, roughness: 0.45 },
      rubber: { color: 0x1a1c1f },
      seam: { color: 0x9aa1a8 },
      frame: { color: 0x8c949c, metalness: 0.7 },
      amber: { color: 0xf09a2a, emissive: 0x3a1800, emissiveIntensity: 0.3 },
      glass: { color: 0x12161c },
      eye: { color: 0x6ff4ff },
      eyeGlow: { color: 0x2fd8ff, opacity: 0.55 },
      led: { color: 0x6ff4ff }
    },
    idColor: '#38d6f5',
    shape: {
      head: { kind: 'lathe', profile: [[0, -0.06], [0.22, -0.05], [0.36, 0.03], [0.45, 0.16], [0.49, 0.31], [0.5, 0.44], [0.48, 0.57], [0.42, 0.68], [0.32, 0.76], [0.17, 0.81], [0, 0.825]], sx: 1.1, sz: 1.0 },
      face: null, mouth: true, cheeks: false,
      eyes: { y: 0.24, phi: 0.27, r: 0.075, mouthDy: 0.13, lift: 0.03 },
      ears: 'none', antenna: false, neck: false,
      torso: { kind: 'lathe', profile: [[0, 0.16], [0.2, 0.17], [0.255, 0.24], [0.275, 0.35], [0.275, 0.46], [0.25, 0.54], [0.18, 0.6], [0.09, 0.635], [0, 0.645]], sx: 1.12, sz: 0.88 },
      belly: { yc: 0.4, hy: 0.04, phi: 0.2 },
      pack: { w: 0.3, h: 0.28, d: 0.1 },
      pelvis: { profile: [[0, -0.2], [0.14, -0.195], [0.25, -0.15], [0.285, -0.07], [0.28, 0.01], [0.22, 0.06], [0, 0.07]], sx: 1.14, sz: 0.9 },
      pelvisMat: 'shell',
      arm: { kind: 'capsule', shoulder: 0.07, upper: [0.05, 0.047], upperMat: 'joint', elbow: 0.06, fore: [0.112, 0.1] },
      leg: { kind: 'capsule', hip: 0.08, thigh: [0.07, 0.065], thighMat: 'joint', knee: 0.075, shin: [0.13, 0.112] },
      boot: { kind: 'box', w: 0.14, h: 0.1, l: 0.25, toe: 0.06, sole: 0.03 }
    },
    parts(M, R, add) {
      const cyan = skinGlow(0x5ff0ff, 1), dark = M.joint;
      const H = R.headProfile, sx = R.HSX, sz = R.HSZ;
      // the face: a slightly raised plate low on the dome, with deep dark sockets for the eyes
      add(R.head, keloMesh(keloPatchGeometry(H, sx, sz, { yc: 0.21, hy: 0.17, phi: 0.78 }, 0.006, 0.15), M.cream, { shadow: false }));
      [-1, 1].forEach(s => add(R.head, skinOnShape(keloMesh(new THREE.CircleGeometry(0.105, 28), M.glass, { shadow: false }), H, sx, sz, 0.24, s * 0.27, 0.022)));
      // a sensor bar on the forehead (cyan behind dark glass) and panel seams over the dome
      const bar = skinOnShape(new THREE.Group(), H, sx, sz, 0.5, 0, 0.004);
      bar.add(keloMesh(keloRoundedBox(0.2, 0.07, 0.03, 0.03, 0.008), dark, { shadow: false }));
      bar.add(keloMesh(keloRoundedBox(0.15, 0.03, 0.012, 0.012, 0.004), cyan, { pos: [0, 0, 0.016], shadow: false }));
      add(R.head, bar);
      [0.38, 0.62].forEach(y => add(R.head, keloSeamRing(H, y, sx, sz, M, 0.005)));
      [[-0.55, 0.62], [0.55, 0.62], [-0.9, 0.42], [0.9, 0.42]].forEach(([ph, y]) => add(R.head, skinOnShape(keloMesh(new THREE.CircleGeometry(0.022, 12), ph > 0 ? M.amber : M.frame, { shadow: false }), H, sx, sz, y, ph, 0.006)));
      // stacked ear modules: a grey drum, a white ring, a dark lens with a cyan centre
      [-1, 1].forEach(s => {
        const x = s * R.earX;
        add(R.head, keloMesh(new THREE.CylinderGeometry(0.22, 0.22, 0.09, 32).rotateZ(Math.PI / 2), dark, { pos: [x + s * 0.0, 0.33, -0.02] }));
        add(R.head, keloMesh(new THREE.CylinderGeometry(0.18, 0.2, 0.08, 32).rotateZ(Math.PI / 2), M.shell, { pos: [x + s * 0.075, 0.33, -0.02] }));
        add(R.head, keloMesh(new THREE.CylinderGeometry(0.115, 0.115, 0.06, 28).rotateZ(Math.PI / 2), dark, { pos: [x + s * 0.12, 0.33, -0.02] }));
        add(R.head, keloMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 24).rotateZ(Math.PI / 2), cyan, { pos: [x + s * 0.152, 0.33, -0.02], shadow: false }));
        // a thin aerial from each upper corner
        const ae = keloMesh(new THREE.CylinderGeometry(0.009, 0.012, 0.42, 6), M.frame, { pos: [s * 0.36, 0.86, -0.08], shadow: false });
        ae.rotation.z = -s * 0.12;
        add(R.head, ae);
      });
      // dark mechanical neck and waist: stacked rings
      [0.62, 0.66, 0.7].forEach(y => add(R.body, keloMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16), dark, { pos: [0, y, 0] })));
      [0.08, 0.12, 0.16].forEach((y, i) => add(R.body, (() => { const m = keloMesh(new THREE.CylinderGeometry(0.19 - i * 0.01, 0.19 - i * 0.01, 0.035, 22), dark, { pos: [0, y, 0] }); m.scale.set(1.1, 1, 0.85); return m; })()));
      // chest: a cyan light slot and two bolts
      add(R.body, skinOnShape(keloMesh(keloRoundedBox(0.12, 0.035, 0.014, 0.016, 0.004), cyan, { shadow: false }), R.torsoProfile, R.TSX, R.TSZ, 0.47, 0, 0.006));
      [-1, 1].forEach(s => add(R.body, skinOnShape(keloMesh(new THREE.CircleGeometry(0.02, 12), dark, { shadow: false }), R.torsoProfile, R.TSX, R.TSZ, 0.52, s * 0.6, 0.005)));
      // big rounded shoulder pads
      const pad = skinCapGeometry(0.16, 1.25).rotateX(-Math.PI / 2);
      ['lArm', 'rArm'].forEach(k => { const m = keloMesh(pad, M.shell, { pos: [0, 0.01, 0] }); m.scale.set(1, 0.95, 1.05); add(R[k], m); });
      // gauntlet cuffs and a dark wrist
      ['lElbow', 'rElbow'].forEach(k => {
        add(R[k], skinLimbRing(0.1, 0.012, -0.05, M.seam));
        add(R[k], keloMesh(new THREE.CylinderGeometry(0.075, 0.09, 0.05, 18), dark, { pos: [0, -0.285, 0] }));
      });
      // dark wheels at the hips
      ['lLeg', 'rLeg'].forEach((k, i) => {
        const s = i ? 1 : -1;
        add(R[k], keloMesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 26).rotateZ(Math.PI / 2), dark, { pos: [s * 0.15, -0.02, 0] }));
        add(R[k], keloMesh(new THREE.CylinderGeometry(0.05, 0.05, 0.075, 16).rotateZ(Math.PI / 2), M.frame, { pos: [s * 0.152, -0.02, 0] }));
      });
      // shin shells: a seam, a hatch and an orange tag on each
      ['lKnee', 'rKnee'].forEach(k => {
        add(R[k], skinLimbRing(0.128, 0.008, -0.12, M.seam));
        add(R[k], keloMesh(keloRoundedBox(0.06, 0.03, 0.012, 0.01, 0.003), M.amber, { pos: [0.03, -0.3, 0.118], shadow: false }));
      });
      // feet: two toe blocks on each, with orange tips
      ['lFoot', 'rFoot'].forEach(k => [-1, 1].forEach(t => {
        add(R[k], keloMesh(keloRoundedBox(0.11, 0.08, 0.1, 0.03, 0.01), M.shell, { pos: [t * 0.068, -R.ankleY + 0.07, 0.34] }));
        add(R[k], keloMesh(keloRoundedBox(0.09, 0.03, 0.02, 0.01, 0.004), M.amber, { pos: [t * 0.068, -R.ankleY + 0.05, 0.395], shadow: false }));
      }));
    }
  },
  {
    id: 'twirl', name: 'Twirl', priceCents: 199, currency: 'USD', rarity: 'epic',
    blurb: 'A giant glossy pearl head with swirls on the crown, two thick curled horns and huge glowing almond eyes, on a tiny dark body in a flared white dress, with thin glowing limbs and white shoes.',
    view: { yaw: -0.35, elev: 0.0 },
    palette: {
      shell: { color: 0xf2f3f6, metalness: 0.35, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03 },
      cream: { color: 0xf4f5f8, metalness: 0.2, roughness: 0.2, clearcoat: 1 },
      cover: { color: 0x1b2230, metalness: 0.4, roughness: 0.3, clearcoat: 0.6 },
      joint: { color: 0x141a25, metalness: 0.3, roughness: 0.35 },
      rubber: { color: 0x141a25 },
      frame: { color: 0xdfe4ec, metalness: 0.7 },
      amber: { color: 0x2fe0ea, emissive: 0x0a4a50, emissiveIntensity: 0.7 },
      glass: { color: 0x0a1018 },
      eye: { color: 0x3fe6f5 },
      eyeGlow: { color: 0x1fb8e0, opacity: 0.55 },
      led: { color: 0x5ff0f5 }
    },
    idColor: '#37e0e8',
    shape: {
      head: { kind: 'lathe', profile: skinBallHead(0.56, 0.1, 0.96), sx: 1.0, sz: 0.94 },
      face: null, mouth: false, cheeks: false,
      eyes: { y: 0.36, phi: 0.36, r: 0.13, sx: 0.78, sy: 1.12, tilt: -0.45 },
      ears: 'none', antenna: false, neck: false,
      torso: { kind: 'lathe', profile: [[0, 0.12], [0.09, 0.13], [0.11, 0.2], [0.12, 0.3], [0.14, 0.4], [0.15, 0.47], [0.13, 0.53], [0.08, 0.56], [0, 0.57]], sx: 1.0, sz: 0.85 },
      torsoMat: 'cover',
      belly: { yc: 0.43, hy: 0.075, phi: 0.95 },
      pack: { w: 0.001, h: 0.001, d: 0.001 },
      pelvis: { profile: [[0, 0.0], [0.06, 0.0], [0.09, 0.05], [0.1, 0.12], [0, 0.14]], sx: 1.0, sz: 0.85 },
      pelvisMat: 'cover',
      limbMat: 'cover',
      arm: { kind: 'capsule', shoulder: 0.05, upper: [0.04, 0.036], elbow: 0.038, fore: [0.038, 0.032] },
      leg: { kind: 'capsule', hip: 0.06, thigh: [0.05, 0.045], knee: 0.045, shin: [0.048, 0.04] },
      boot: { kind: 'ball', w: 0.1, h: 0.1, l: 0.16, toe: 0.05, mat: 'cream' }
    },
    parts(M, R, add) {
      const glow = skinGlow(0x4ff0f8, 1);
      const dress = new THREE.MeshPhysicalMaterial({ color: 0xf6f7fa, metalness: 0.12, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide });
      const H = R.headProfile, sx = R.HSX, sz = R.HSZ;
      // deep dark almond sockets the eyes glow out of, with lashes
      [-1, 1].forEach(s => {
        const sock = skinOnShape(keloMesh(new THREE.CircleGeometry(0.16, 32), M.glass, { shadow: false }), H, sx, sz, 0.36, s * 0.36, 0.006);
        sock.rotateZ(s * -0.45); sock.scale.set(0.82, 1.1, 1);
        add(R.head, sock);
      });
      const lash = new THREE.BoxGeometry(0.014, 0.06, 0.004);
      [R.lEye, R.rEye].forEach(eye => {
        const s = eye.userData.side, open = eye.userData.open;
        (s > 0 ? [0.25, 0.65, 1.05] : [Math.PI - 0.25, Math.PI - 0.65, Math.PI - 1.05]).forEach(a => {
          const m = keloMesh(lash, M.glass, { shadow: false });
          m.position.set(Math.cos(a) * 0.165, Math.sin(a) * 0.165, 0.003);
          m.rotation.z = a - Math.PI / 2;
          add(open, m);
        });
      });
      // soft swirls moulded across the crown
      [-0.27, -0.13, 0.0, 0.13, 0.27].forEach(ph => {
        const sw = skinOnShape(keloMesh(new THREE.TorusGeometry(0.06, 0.016, 8, 18, Math.PI * 1.4), M.shell), H, sx, sz, 0.84 - Math.abs(ph) * 0.15, ph, 0.004);
        sw.rotateZ(Math.PI * 0.8);
        add(R.head, sw);
      });
      // two thick horns curling up and out from the top of the head, banded at the root
      [-1, 1].forEach(s => {
        const pts = [[0.3, 0.86], [0.42, 0.98], [0.56, 1.04], [0.69, 1.0], [0.75, 0.88], [0.72, 0.77], [0.65, 0.74]].map(([x, y]) => new THREE.Vector3(s * x, y, -0.05));
        const curve = new THREE.CatmullRomCurve3(pts);
        add(R.head, keloMesh(skinTaperTube(curve, 0.1, 0.035), M.shell));
        [[0.06, M.cover, 0.1], [0.1, glow, 0.093], [0.14, M.cover, 0.088]].forEach(([u, m, r]) => {
          const p = curve.getPointAt(u), tg = curve.getTangentAt(u);
          const band = keloMesh(new THREE.TorusGeometry(r, 0.016, 8, 22), m, { shadow: false });
          band.position.copy(p); band.lookAt(p.clone().add(tg));
          add(R.head, band);
        });
      });
      // a little dark neck
      add(R.body, keloMesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 12), M.cover, { pos: [0, 0.6, 0] }));
      // glowing dots on her dark body and limbs
      const dot = new THREE.SphereGeometry(0.013, 8, 6);
      [[0.5, 0.4], [0.5, -0.4], [0.3, 0.9], [0.3, -0.9]].forEach(([y, ph]) => add(R.body, skinOnShape(keloMesh(dot, glow, { shadow: false }), R.torsoProfile, R.TSX, R.TSZ, y, ph, 0.004)));
      ['lArm', 'rArm'].forEach(k => add(R[k], keloMesh(dot, glow, { pos: [0, -0.16, 0.038], shadow: false })));
      ['lElbow', 'rElbow'].forEach(k => add(R[k], keloMesh(dot, glow, { pos: [0, -0.14, 0.036], shadow: false })));
      ['lKnee', 'rKnee'].forEach(k => { add(R[k], keloMesh(dot, glow, { pos: [0, -0.15, 0.045], shadow: false })); add(R[k], keloMesh(dot, glow, { pos: [0.02, -0.3, 0.04], shadow: false })); });
      // the dress: a bodice with two straps, and a flared skirt. The back half hangs from her waist;
      // the front half is hinged at the waist and lifts with her knees (update below)
      add(R.body, keloLathe([[0.17, 0.22], [0.15, 0.3], [0.145, 0.36], [0.155, 0.45]], dress, { sx: 1, sz: 0.85, seg: 26 }));
      [-1, 1].forEach(s => { const st = keloMesh(new THREE.TorusGeometry(0.11, 0.014, 6, 14, Math.PI * 0.75), dress, { pos: [s * 0.07, 0.43, 0] }); st.rotation.set(0, Math.PI / 2, Math.PI * 0.12); add(R.body, st); });
      const bell = [[0.47, -0.36], [0.4, -0.22], [0.31, -0.06], [0.23, 0.08], [0.175, 0.22]].map(([r, y]) => new THREE.Vector2(r, y));
      const back = keloMesh(new THREE.LatheGeometry(bell, 28, Math.PI / 2, Math.PI), dress);
      back.scale.set(1, 1, 0.88);
      add(R.body, back);
      const hemB = keloMesh(new THREE.TorusGeometry(0.47, 0.012, 6, 28, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI), dress, { pos: [0, -0.36, 0] });
      hemB.scale.set(1, 1, 0.88); add(R.body, hemB);
      const front = new THREE.Group();
      front.name = 'skirtFront';
      front.position.set(0, 0.22, 0);
      const fm = keloMesh(new THREE.LatheGeometry(bell.map(v => new THREE.Vector2(v.x, v.y - 0.22)), 28, -Math.PI / 2, Math.PI), dress);
      fm.scale.set(1, 1, 0.88);
      front.add(fm);
      const hemF = keloMesh(new THREE.TorusGeometry(0.47, 0.012, 6, 28, Math.PI).rotateX(Math.PI / 2), dress, { pos: [0, -0.58, 0] });
      hemF.scale.set(1, 1, 0.88); front.add(hemF);
      front.userData.skinPart = 'skirtFront';
      add(R.body, front);
      R.skirtFront = front;
    },
    // her skirt's front lifts over her knees when she sits or kneels, and swings a little as she walks
    update(R) {
      const f = R.skirtFront;
      if (!f || !R.lLeg) return;
      const lx = R.lLeg.rotation.x, rx = R.rLeg.rotation.x;
      const lift = Math.min(0, Math.min(lx, rx));          // the leg furthest forward
      f.rotation.x = lift * 0.95;
    }
  },
  {
    id: 'kitbot', name: 'Kitbot', priceCents: 149, currency: 'USD', rarity: 'rare',
    blurb: 'A chibi space cat: a huge white helmet with a magenta rim round a dark screen face, cat ears and magenta headphones, on a short stubby suit with a colour-bar chest panel.',
    view: { yaw: 0.15, elev: 0.05 },
    palette: {
      shell: { color: 0xf9f9fb, metalness: 0.03, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 },
      cream: { color: 0xf9f9fb },
      cover: { color: 0xe8268f, metalness: 0.05, roughness: 0.38, clearcoat: 0.6 },
      joint: { color: 0xd9dbe2 },
      rubber: { color: 0x2a2440 },
      frame: { color: 0xd0d3da },
      amber: { color: 0xe8268f, emissive: 0x3a0020, emissiveIntensity: 0.4 },
      glass: { color: 0x1a1430, metalness: 0.2, roughness: 0.08 },
      eye: { color: 0x7ff3ff },
      eyeGlow: { color: 0x4fe3ff, opacity: 0.3 },
      led: { color: 0xff4fb3 },
      cheek: { color: 0xff8fc0, opacity: 0.5 }
    },
    idColor: '#ff5cb0',
    shape: {
      head: { kind: 'lathe', profile: skinBallHead(0.53, 0.14, 0.93), sx: 1.1, sz: 0.97 },
      face: { yc: 0.34, hy: 0.27, phi: 1.08 }, faceFrame: 'amber',
      eyes: { y: 0.37, phi: 0.27, r: 0.072, mouthDy: 0.11, cheekDy: 0.07 },
      ears: 'none', antenna: false, neck: false,
      torso: { kind: 'lathe', profile: [[0, 0.1], [0.2, 0.11], [0.25, 0.18], [0.27, 0.3], [0.27, 0.42], [0.25, 0.5], [0.19, 0.56], [0.1, 0.59], [0, 0.6]], sx: 1.05, sz: 0.88 },
      belly: { yc: 0.32, hy: 0.001, phi: 0.01 },
      pack: { w: 0.4, h: 0.38, d: 0.14 },
      pelvis: { profile: [[0, -0.14], [0.12, -0.135], [0.2, -0.09], [0.24, -0.02], [0.25, 0.06], [0.22, 0.12], [0, 0.13]], sx: 1.05, sz: 0.86 },
      pelvisMat: 'shell',
      arm: { kind: 'capsule', shoulder: 0.1, upper: [0.09, 0.088], elbow: 0.08, fore: [0.092, 0.088] },
      leg: { kind: 'capsule', hip: 0.1, thigh: [0.11, 0.108], knee: 0.1, shin: [0.112, 0.108] },
      boot: { kind: 'ball', w: 0.14, h: 0.14, l: 0.18, toe: 0.04 }
    },
    parts(M, R, add) {
      const H = R.headProfile, sx = R.HSX, sz = R.HSZ;
      // a magenta band right round the helmet at the screen's middle, behind the face
      const band = keloMesh(new THREE.TorusGeometry(keloProfileR(H, 0.34), 0.03, 8, 40, Math.PI * 1.25).rotateX(Math.PI / 2).rotateY(Math.PI * 1.125), M.amber, { pos: [0, 0.34, 0] });
      band.scale.set(sx, 1, sz); add(R.head, band);
      // cat ears: white outside, magenta and lilac inside
      const tri = (w, h, d) => {
        const sh = new THREE.Shape();
        sh.moveTo(-w / 2, 0); sh.quadraticCurveTo(-w * 0.2, h * 0.7, 0, h); sh.quadraticCurveTo(w * 0.2, h * 0.7, w / 2, 0); sh.lineTo(-w / 2, 0);
        const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 6 });
        g.translate(0, 0, -d / 2);
        return g;
      };
      const lilac = new THREE.MeshStandardMaterial({ color: 0xb48cff, roughness: 0.5 });
      [-1, 1].forEach(s => {
        const g = new THREE.Group();
        g.position.set(s * 0.3, 0.74, 0.0);
        g.rotation.set(-0.1, 0, -s * 0.5);
        g.add(keloMesh(tri(0.28, 0.26, 0.06), M.shell));
        g.add(keloMesh(tri(0.17, 0.16, 0.02), M.amber, { pos: [0, 0.03, 0.045], shadow: false }));
        g.add(keloMesh(tri(0.09, 0.09, 0.01), lilac, { pos: [0, 0.05, 0.058], shadow: false }));
        add(R.head, g);
      });
      // magenta headphones on the sides
      [-1, 1].forEach(s => {
        const x = s * R.earX;
        add(R.head, keloMesh(new THREE.CylinderGeometry(0.19, 0.19, 0.11, 30).rotateZ(Math.PI / 2), M.amber, { pos: [x + s * 0.02, 0.36, -0.02] }));
        add(R.head, keloMesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 26).rotateZ(Math.PI / 2), M.shell, { pos: [x + s * 0.08, 0.36, -0.02], shadow: false }));
      });
      // magenta shoulder caps, cuffs, gloves' rims, knee bands and boot tops
      const cap = skinCapGeometry(0.13, 1.3).rotateX(-Math.PI / 2);
      ['lArm', 'rArm'].forEach(k => add(R[k], keloMesh(cap, M.amber, { pos: [0, 0.01, 0] })));
      ['lElbow', 'rElbow'].forEach(k => add(R[k], keloMesh(new THREE.TorusGeometry(0.095, 0.028, 8, 22).rotateX(Math.PI / 2), M.amber, { pos: [0, -0.26, 0] })));
      ['lKnee', 'rKnee'].forEach(k => {
        add(R[k], keloMesh(new THREE.TorusGeometry(0.115, 0.026, 8, 22).rotateX(Math.PI / 2), M.amber, { pos: [0, -0.04, 0] }));
        add(R[k], keloMesh(new THREE.TorusGeometry(0.12, 0.03, 8, 22).rotateX(Math.PI / 2), M.amber, { pos: [0, -0.37, 0] }));
      });
      // the chest panel: a white frame, dark inset, four glowing upright colour bars
      const panel = skinOnShape(new THREE.Group(), R.torsoProfile, R.TSX, R.TSZ, 0.33, 0, 0.004);
      panel.add(keloMesh(keloRoundedBox(0.2, 0.19, 0.03, 0.045, 0.008), M.shell, { shadow: false }));
      panel.add(keloMesh(keloRoundedBox(0.16, 0.15, 0.01, 0.035, 0.003), M.glass, { pos: [0, 0, 0.016], shadow: false }));
      [0x3fe07a, 0xffd23a, 0xff5a5a, 0x4fb3ff].forEach((c, i) => panel.add(keloMesh(keloRoundedBox(0.026, 0.1, 0.01, 0.01, 0.003), skinGlow(c, 1), { pos: [-0.05 + i * 0.034, 0, 0.023], shadow: false })));
      add(R.body, panel);
    }
  },
  {
    id: 'marshmallow', name: 'Marshmallow', priceCents: 149, currency: 'USD', rarity: 'rare',
    blurb: 'Soft-touch pastel pink: a smooth round head with a little window face and a gold side lens, a loose sweater with a light-up chest panel, wide sleeves and trousers, and chunky round shoes.',
    view: { yaw: 0.6, elev: -0.2 },
    palette: {
      shell: { kind: 'std', color: 0xf7d0d2, metalness: 0, roughness: 0.82 },
      cream: { kind: 'std', color: 0xe9b7bf, metalness: 0, roughness: 0.6 },
      cover: { color: 0xf2c3c8, metalness: 0, roughness: 0.82 },
      joint: { color: 0xeab8be, roughness: 0.85 },
      rubber: { color: 0xe5aeb6, roughness: 0.85 },
      seam: { color: 0xe8b5bb, metalness: 0 },
      frame: { color: 0xf6d6dc, metalness: 0.1, roughness: 0.8 },
      amber: { color: 0xffb02e, metalness: 0.5, roughness: 0.3, emissive: 0x8a4a00, emissiveIntensity: 0.6 },
      glass: { kind: 'std', color: 0xfff8fa, metalness: 0, roughness: 0.25 },
      eye: { color: 0x2c3a9e },
      eyeGlow: { color: 0x000000, opacity: 0 },
      shine: { color: 0xdfe6ff },
      led: { color: 0xffc070 },
      visor: { opacity: 0.06 }
    },
    idColor: '#ffb347',
    shape: {
      head: { kind: 'lathe', profile: skinBallHead(0.39, 0.02, 1.0), sx: 1.0, sz: 0.97 },
      face: { yc: 0.43, hy: 0.16, phi: 0.78 },
      eyes: { y: 0.44, phi: 0.2, r: 0.048, lift: 0.02 },
      mouth: false, cheeks: false,
      ears: 'none', antenna: false,
      torso: { kind: 'lathe', profile: [[0, -0.22], [0.27, -0.22], [0.3, -0.17], [0.295, 0.0], [0.29, 0.2], [0.29, 0.42], [0.27, 0.52], [0.21, 0.59], [0.1, 0.625], [0, 0.635]], sx: 1.0, sz: 0.8 },
      belly: { yc: 0.3, hy: 0.001, phi: 0.01 },
      pack: { w: 0.001, h: 0.001, d: 0.001 },
      arm: { kind: 'capsule', shoulder: 0.1, upper: [0.098, 0.104], elbow: 0.09, fore: [0.106, 0.114] },
      leg: { kind: 'capsule', hip: 0.1, thigh: [0.115, 0.115], knee: 0.11, shin: [0.118, 0.128] },
      boot: { kind: 'ball', w: 0.165, h: 0.15, l: 0.235, toe: 0.07, sole: 0.06, mat: 'cream' }
    },
    parts(M, R, add) {
      const warm = new THREE.MeshBasicMaterial({ color: 0xffc060, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending });
      const blue = skinGlow(0x9fd8ff, 1);
      // a gold side lens set in a soft ring, on her left
      const H = R.headProfile;
      const lens = skinOnShape(new THREE.Group(), H, R.HSX, R.HSZ, 0.37, -1.25, 0.0);
      lens.add(keloMesh(new THREE.CylinderGeometry(0.09, 0.095, 0.05, 28).rotateX(Math.PI / 2), M.cream));
      lens.add(keloMesh(new THREE.SphereGeometry(0.07, 20, 14), M.amber, { pos: [0, 0, 0.02] }));
      add(R.head, lens);
      // a thin gold ring round the neck
      add(R.body, keloMesh(new THREE.TorusGeometry(0.085, 0.014, 8, 24).rotateX(Math.PI / 2), M.amber, { pos: [0, 0.69, 0] }));
      // the chest panel: a tall rounded plate with two blue light bars, a wide bar and a gold button
      const panel = skinOnShape(new THREE.Group(), R.torsoProfile, R.TSX, R.TSZ, 0.33, 0, 0.006);
      panel.add(keloMesh(keloRoundedBox(0.15, 0.36, 0.025, 0.07, 0.008), M.cream, { shadow: false }));
      [-0.032, 0.032].forEach(x => panel.add(keloMesh(keloRoundedBox(0.018, 0.07, 0.01, 0.007, 0.002), blue, { pos: [x, 0.1, 0.016], shadow: false })));
      panel.add(keloMesh(keloRoundedBox(0.07, 0.022, 0.01, 0.009, 0.002), blue, { pos: [0, 0.035, 0.016], shadow: false }));
      panel.add(keloMesh(new THREE.CylinderGeometry(0.04, 0.042, 0.03, 24).rotateX(Math.PI / 2), M.amber, { pos: [0, -0.05, 0.018] }));
      const halo = keloMesh(new THREE.CircleGeometry(0.075, 24), warm, { pos: [0, -0.05, 0.016], shadow: false });
      halo.renderOrder = 1; panel.add(halo);
      panel.add(keloMesh(keloRoundedBox(0.04, 0.012, 0.01, 0.005, 0.002), blue, { pos: [0, -0.13, 0.016], shadow: false }));
      add(R.body, panel);
      // sweater hem, sleeve cuffs with a gold band, trouser hems
      add(R.body, (() => { const m = keloMesh(new THREE.TorusGeometry(0.285, 0.03, 8, 32).rotateX(Math.PI / 2), M.cover, { pos: [0, -0.2, 0] }); m.scale.set(1, 1, 0.82); return m; })());
      ['lElbow', 'rElbow'].forEach(k => {
        add(R[k], keloMesh(new THREE.TorusGeometry(0.11, 0.022, 8, 22).rotateX(Math.PI / 2), M.cover, { pos: [0, -0.285, 0] }));
        add(R[k], keloMesh(new THREE.TorusGeometry(0.112, 0.01, 6, 22).rotateX(Math.PI / 2), M.amber, { pos: [0, -0.245, 0], shadow: false }));
      });
      ['lKnee', 'rKnee'].forEach(k => add(R[k], keloMesh(new THREE.TorusGeometry(0.126, 0.024, 8, 22).rotateX(Math.PI / 2), M.cover, { pos: [0, -0.38, 0] })));
    }
  },
  {
    id: 'spark', name: 'Spark', priceCents: 299, currency: 'USD', rarity: 'legendary',
    blurb: 'A chibi silver bot: a huge helmet with a big black visor face, sparkling eyes and a smile, glowing ear spikes and crown light, a small body with a blue core, and stubby glowing limbs on chunky boots.',
    view: { yaw: 0.25, elev: 0.15 },
    palette: {
      shell: { color: 0xd5dae2, metalness: 0.75, roughness: 0.18, clearcoat: 0.9, clearcoatRoughness: 0.06 },
      cream: { color: 0xd5dae2, metalness: 0.75, roughness: 0.18, clearcoat: 0.9 },
      cover: { color: 0xc5cbd4, metalness: 0.75, roughness: 0.22 },
      joint: { color: 0x22262e, metalness: 0.5 },
      rubber: { color: 0x15171b },
      frame: { color: 0xdfe4ea, metalness: 0.9, roughness: 0.2 },
      amber: { color: 0x4fc3ff, emissive: 0x0a3a66, emissiveIntensity: 0.8 },
      glass: { color: 0x05070c, metalness: 0.3, roughness: 0.05 },
      visor: { color: 0x8fb8ff, opacity: 0.2 },
      eye: { color: 0x6fd0ff },
      eyeGlow: { color: 0x2f8fff, opacity: 0.45 },
      led: { color: 0x6fd0ff },
      cheek: { color: 0xff5c90, opacity: 0.8 }
    },
    idColor: '#6fc3ff',
    shape: {
      head: { kind: 'lathe', profile: skinBallHead(0.54, 0.14, 0.92), sx: 1.07, sz: 0.98 },
      face: { yc: 0.33, hy: 0.3, phi: 1.2 },
      eyes: { y: 0.38, phi: 0.3, r: 0.1, mouthDy: 0.17, cheekDy: 0.1, cheek: 1.3 },
      ears: 'none', antenna: false, neck: false,
      torso: { kind: 'lathe', profile: [[0, 0.08], [0.16, 0.09], [0.2, 0.16], [0.22, 0.27], [0.245, 0.38], [0.25, 0.46], [0.22, 0.53], [0.14, 0.58], [0, 0.6]], sx: 1.02, sz: 0.85 },
      belly: { yc: 0.33, hy: 0.001, phi: 0.01 },
      pack: { w: 0.26, h: 0.26, d: 0.1 },
      pelvis: { profile: [[0, -0.12], [0.12, -0.115], [0.19, -0.07], [0.22, 0.0], [0.22, 0.08], [0.18, 0.12], [0, 0.13]], sx: 1.05, sz: 0.86 },
      pelvisMat: 'joint',
      arm: { kind: 'capsule', shoulder: 0.1, upper: [0.085, 0.08], elbow: 0.07, fore: [0.092, 0.088] },
      leg: { kind: 'capsule', hip: 0.095, thigh: [0.104, 0.1], knee: 0.09, shin: [0.112, 0.108] },
      boot: { kind: 'dome', w: 0.15, h: 0.16, l: 0.21, toe: 0.04 }
    },
    parts(M, R, add) {
      const blue = skinGlow(0x5cc8ff, 1);
      const soft = new THREE.MeshBasicMaterial({ color: 0x3f9cff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
      const H = R.headProfile;
      // a black belly and a glowing blue core on his chest
      add(R.body, keloMesh(keloPatchGeometry(R.torsoProfile, R.TSX, R.TSZ, { yc: 0.17, hy: 0.1, phi: 1.1 }, 0.004, 0.0), M.joint, { shadow: false }));
      const core = skinOnShape(new THREE.Group(), R.torsoProfile, R.TSX, R.TSZ, 0.38, 0, 0.008);
      core.add(keloMesh(new THREE.CylinderGeometry(0.075, 0.08, 0.03, 28).rotateX(Math.PI / 2), M.shell));
      core.add(keloMesh(new THREE.TorusGeometry(0.06, 0.012, 6, 28), blue, { pos: [0, 0, 0.017], shadow: false }));
      core.add(keloMesh(new THREE.CircleGeometry(0.04, 24), blue, { pos: [0, 0, 0.016], shadow: false }));
      const halo = keloMesh(new THREE.RingGeometry(0.06, 0.13, 32), soft, { pos: [0, 0, 0.004], shadow: false });
      halo.renderOrder = 1; core.add(halo);
      add(R.body, core);
      // the crown light: a silver cap with a glowing blue disc
      add(R.head, keloMesh(new THREE.CylinderGeometry(0.13, 0.15, 0.04, 30), M.shell, { pos: [0, keloShapeTop(R.S.head) - 0.005, 0] }));
      add(R.head, keloMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 28), blue, { pos: [0, keloShapeTop(R.S.head) + 0.018, 0], shadow: false }));
      // ear cups with a glow ring, and a spike with a blue tip rising from each
      [-1, 1].forEach(s => {
        const x = s * R.earX;
        add(R.head, keloMesh(new THREE.CylinderGeometry(0.16, 0.17, 0.1, 30).rotateZ(Math.PI / 2), M.shell, { pos: [x + s * 0.01, 0.34, -0.02] }));
        add(R.head, keloMesh(new THREE.TorusGeometry(0.12, 0.018, 6, 28).rotateY(Math.PI / 2), blue, { pos: [x + s * 0.062, 0.34, -0.02] }));
        add(R.head, keloMesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 22).rotateZ(Math.PI / 2), M.joint, { pos: [x + s * 0.062, 0.34, -0.02], shadow: false }));
        const spike = new THREE.Group();
        spike.position.set(x + s * 0.0, 0.48, -0.03);
        spike.rotation.z = -s * 0.22;
        spike.add(keloMesh(new THREE.CylinderGeometry(0.035, 0.06, 0.2, 16), M.shell, { pos: [0, 0.1, 0] }));
        spike.add(keloMesh(new THREE.ConeGeometry(0.036, 0.13, 16), blue, { pos: [0, 0.265, 0], shadow: false }));
        add(R.head, spike);
      });
      // blush strokes on the visor
      const stroke = keloRoundedBox(0.012, 0.04, 0.003, 0.005, 0.001);
      const pink = skinGlow(0xff7fae, 1);
      [-1, 1].forEach(s => [-0.05, 0, 0.05].forEach(d => {
        const m = skinOnShape(keloMesh(stroke, pink, { shadow: false }), H, R.HSX, R.HSZ, 0.27, s * (0.55 + d), 0.03);
        m.rotateZ(-s * 0.5);
        add(R.head, m);
      }));
      // glow rings: shoulders, elbows, wrists, knees, ankles
      ['lArm', 'rArm'].forEach(k => add(R[k], skinLimbRing(0.09, 0.013, -0.08, blue)));
      ['lElbow', 'rElbow'].forEach(k => { add(R[k], skinLimbRing(0.084, 0.016, -0.03, blue)); add(R[k], skinLimbRing(0.094, 0.014, -0.27, blue)); });
      ['lKnee', 'rKnee'].forEach(k => { add(R[k], skinLimbRing(0.112, 0.018, -0.02, blue)); add(R[k], skinLimbRing(0.118, 0.015, -0.36, blue)); });
      // big silver shoulder caps
      const cap = skinCapGeometry(0.12, 1.25).rotateX(-Math.PI / 2);
      ['lArm', 'rArm'].forEach(k => add(R[k], keloMesh(cap, M.shell, { pos: [0, 0.01, 0] })));
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
      // The skin's own rig (for moving parts) now points at the live joints
      if (keloSkinRig) Object.keys(neu).forEach(k => { if (keloSkinRig[k] === neu[k]) keloSkinRig[k] = old[k]; });
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
