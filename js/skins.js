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

// A toothed gear, flat, facing +z
function skinGearGeometry(r, teeth, depth, hole = 0.3) {
      const sh = new THREE.Shape(), n = teeth * 4;
      for (let i = 0; i <= n; i++) {
        const a = i / n * Math.PI * 2, out = (i % 4 === 1 || i % 4 === 2) ? r : r * 0.82;
        if (i === 0) sh.moveTo(Math.cos(a) * out, Math.sin(a) * out); else sh.lineTo(Math.cos(a) * out, Math.sin(a) * out);
      }
      const h = new THREE.Path(); h.absarc(0, 0, r * hole, 0, Math.PI * 2, true); sh.holes.push(h);
      const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 4 });
      g.translate(0, 0, -depth / 2);
      return g;
    }
// A starfield with soft nebula clouds, drawn once per build (a fixed seed, so every build looks the same)
function skinStarTexture() {
      const c = document.createElement('canvas'); c.width = 512; c.height = 256;
      const g = c.getContext('2d');
      let seed = 1337; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const bg = g.createLinearGradient(0, 0, 512, 256); bg.addColorStop(0, '#120a2e'); bg.addColorStop(0.5, '#241052'); bg.addColorStop(1, '#0b1a3a');
      g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
      [['rgba(255,80,200,0.45)', 120, 90, 110], ['rgba(80,200,255,0.4)', 360, 150, 130], ['rgba(160,90,255,0.45)', 250, 60, 90], ['rgba(255,140,90,0.25)', 440, 70, 70]].forEach(([col, x, y, r]) => {
        const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg; g.fillRect(0, 0, 512, 256);
      });
      for (let i = 0; i < 420; i++) {
        const x = rnd() * 512, y = rnd() * 256, r = rnd() < 0.08 ? 1.6 : 0.7;
        g.fillStyle = `rgba(255,255,255,${0.5 + rnd() * 0.5})`;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.encoding = THREE.sRGBEncoding;
      return t;
    }
const skinNow = () => performance.now() / 1000;

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
  },
  {
    id: 'ember', name: 'Ember', priceCents: 399, currency: 'USD', rarity: 'legendary',
    blurb: 'A young dragon bot: emerald scales and a gold belly, a snout with ember eyes, swept-back horns and spines, bat wings that beat slowly, a swaying spade tail and a furnace glowing in his chest.',
    view: { yaw: 0.7, elev: 0.05 },
    palette: {
      shell: { color: 0x1f7a5a, metalness: 0.35, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.12 },
      cream: { color: 0xe2b85a, metalness: 0.7, roughness: 0.3, clearcoat: 0.6 },
      cover: { color: 0x163a2e, metalness: 0.2, roughness: 0.5 },
      joint: { color: 0x1a2f28, metalness: 0.3, roughness: 0.45 },
      rubber: { color: 0x0f1f1a },
      seam: { color: 0x0f3a2a },
      frame: { color: 0xe2b85a, metalness: 0.8 },
      amber: { color: 0xff7a1a, emissive: 0xff4a00, emissiveIntensity: 1.2 },
      glass: { color: 0x120804 },
      eye: { color: 0xffc04a },
      eyeGlow: { color: 0xff5a00, opacity: 0.6 },
      led: { color: 0xff8a2a }
    },
    idColor: '#ffb04a',
    shape: {
      head: { kind: 'lathe', profile: skinBallHead(0.42, 0.06, 0.9), sx: 1.08, sz: 1.05 },
      face: null, mouth: false, cheeks: false,
      eyes: { y: 0.42, phi: 0.42, r: 0.07, sx: 1.0, sy: 0.72, tilt: -0.35, lift: 0.025 },
      ears: 'none', antenna: false,
      torso: { kind: 'lathe', profile: [[0, 0], [0.18, 0.02], [0.24, 0.1], [0.27, 0.22], [0.27, 0.36], [0.25, 0.47], [0.2, 0.55], [0.12, 0.61], [0, 0.63]], sx: 1.05, sz: 0.9 },
      belly: { yc: 0.27, hy: 0.21, phi: 0.62 },
      pack: { w: 0.001, h: 0.001, d: 0.001 },
      arm: { kind: 'capsule', shoulder: 0.095, upper: [0.075, 0.07], elbow: 0.068, fore: [0.082, 0.072] },
      leg: { kind: 'capsule', hip: 0.1, thigh: [0.1, 0.095], knee: 0.088, shin: [0.096, 0.088] },
      boot: { kind: 'ball', w: 0.13, h: 0.11, l: 0.2, toe: 0.06 }
    },
    parts(M, R, add) {
      const H = R.headProfile, sx = R.HSX, sz = R.HSZ, gold = M.cream;
      const ember = skinGlow(0xffa040, 1);
      const memb = new THREE.MeshStandardMaterial({ color: 0x2f9a70, metalness: 0.1, roughness: 0.55, side: THREE.DoubleSide, emissive: 0x0a2a1a, emissiveIntensity: 0.4 });
      // the snout, with nostrils, a jaw line and two small fangs
      const snout = new THREE.Group(); snout.position.set(0, 0.22, 0.34);
      snout.add(keloMesh(keloRoundedBox(0.3, 0.18, 0.26, 0.08, 0.02), M.shell));
      [-1, 1].forEach(s => {
        snout.add(keloMesh(new THREE.CircleGeometry(0.022, 12), M.glass, { pos: [s * 0.06, 0.04, 0.131], shadow: false }));
        snout.add(keloMesh(new THREE.ConeGeometry(0.016, 0.05, 8).rotateX(Math.PI), M.frame, { pos: [s * 0.08, -0.105, 0.09], shadow: false }));
      });
      snout.add(keloMesh(keloRoundedBox(0.24, 0.012, 0.01, 0.005, 0.003), M.glass, { pos: [0, -0.05, 0.131], shadow: false }));
      add(R.head, snout);
      // dark slit pupils and heavy brows over the ember eyes
      [R.lEye, R.rEye].forEach(eye => add(eye.userData.open, keloMesh(new THREE.PlaneGeometry(0.018, 0.1), M.glass, { pos: [0, 0, 0.004], shadow: false })));
      [-1, 1].forEach(s => { const b = skinOnShape(keloMesh(keloRoundedBox(0.16, 0.04, 0.04, 0.015, 0.006), M.cover), H, sx, sz, 0.51, s * 0.42, 0.01); b.rotateZ(s * 0.35); add(R.head, b); });
      // swept-back gold horns, and spines down the back of the head and the spine
      [-1, 1].forEach(s => {
        const c = new THREE.CatmullRomCurve3([[0.2, 0.62, -0.02], [0.27, 0.74, -0.12], [0.3, 0.83, -0.28], [0.27, 0.86, -0.44]].map(([x, y, z]) => new THREE.Vector3(s * x, y, z)));
        add(R.head, keloMesh(skinTaperTube(c, 0.055, 0.008, 30, 10), gold));
      });
      const spine = new THREE.ConeGeometry(0.035, 0.1, 8);
      [[0.74, -0.1], [0.66, -0.28], [0.5, -0.38], [0.32, -0.42]].forEach(([y, z]) => { const m = keloMesh(spine, gold, { pos: [0, y, z] }); m.rotation.x = -0.6; add(R.head, m); });
      [[0.55, -0.2], [0.42, -0.24], [0.29, -0.25], [0.16, -0.24]].forEach(([y, z]) => { const m = keloMesh(spine, gold, { pos: [0, y, z] }); m.rotation.x = -1.2; add(R.body, m); });
      // scale rows across the gold belly, and the furnace heart above it
      [0.12, 0.2, 0.28, 0.36].forEach(y => add(R.body, keloSeamRing(R.torsoProfile, y, R.TSX, R.TSZ, M, 0.006)));
      const heart = skinOnShape(new THREE.Group(), R.torsoProfile, R.TSX, R.TSZ, 0.46, 0, 0.008);
      heart.add(keloMesh(new THREE.CircleGeometry(0.06, 24), M.amber, { shadow: false }));
      heart.add(keloMesh(new THREE.TorusGeometry(0.065, 0.012, 6, 24), gold, { pos: [0, 0, 0.004] }));
      const hglow = keloMesh(new THREE.CircleGeometry(0.12, 24), new THREE.MeshBasicMaterial({ color: 0xff6a10, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }), { pos: [0, 0, -0.002], shadow: false });
      hglow.renderOrder = 1; heart.add(hglow);
      add(R.body, heart);
      // bat wings from his shoulder blades: a gold bone along the top, a scalloped membrane
      const ws = new THREE.Shape();
      ws.moveTo(0, 0); ws.lineTo(0.12, 0.3); ws.lineTo(0.62, 0.5); ws.lineTo(0.7, 0.18);
      ws.quadraticCurveTo(0.6, 0.12, 0.52, 0.0); ws.quadraticCurveTo(0.42, 0.06, 0.34, -0.06); ws.quadraticCurveTo(0.22, 0.0, 0.12, -0.1); ws.lineTo(0, 0);
      const wGeo = new THREE.ShapeGeometry(ws, 8);
      R.wings = [-1, 1].map(s => {
        const pivot = new THREE.Group(); pivot.position.set(s * 0.1, 0.52, -0.2);
        const w = new THREE.Group(); w.rotation.y = s > 0 ? 0.64 : 2.5;
        const m = keloMesh(wGeo, memb); w.add(m);
        const bone = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.12, 0.3, 0), new THREE.Vector3(0.62, 0.5, 0), new THREE.Vector3(0.7, 0.18, 0)]);
        w.add(keloMesh(skinTaperTube(bone, 0.03, 0.01, 24, 8), gold));
        pivot.add(w); add(R.body, pivot);
        pivot.userData.side = s;
        return pivot;
      });
      // a tail of shrinking segments, curving down and back, with a spade tip
      let parent = new THREE.Group(); parent.position.set(0, -0.06, -0.2); parent.rotation.x = -0.9;
      add(R.body, parent);
      R.tail = [parent];
      for (let i = 0; i < 7; i++) {
        const r = 0.09 - i * 0.008;
        const seg = keloMesh(new THREE.SphereGeometry(r, 12, 8), M.shell, { pos: [0, 0, -0.045] });
        seg.scale.set(1, 0.9, 1.35);
        parent.add(seg);
        if (i % 2 === 0) { const sp = keloMesh(spine, gold, { pos: [0, r * 0.9, -0.06] }); sp.scale.setScalar(0.6); parent.add(sp); }
        const next = new THREE.Group(); next.position.set(0, 0, -0.085); next.rotation.x = 0.12;
        parent.add(next); R.tail.push(next); parent = next;
      }
      const tip = new THREE.Shape(); tip.moveTo(0, 0); tip.lineTo(0.09, -0.08); tip.lineTo(0, -0.2); tip.lineTo(-0.09, -0.08); tip.lineTo(0, 0);
      const spade = keloMesh(new THREE.ExtrudeGeometry(tip, { depth: 0.02, bevelEnabled: false }).rotateX(Math.PI / 2), gold, { pos: [0, 0, 0] });
      parent.add(spade);
      // claws on his feet
      ['lFoot', 'rFoot'].forEach(k => [-1, 0, 1].forEach(t => { const c = keloMesh(new THREE.ConeGeometry(0.022, 0.07, 8), gold, { pos: [t * 0.06, -R.ankleY + 0.04, 0.27] }); c.rotation.x = Math.PI / 2; add(R[k], c); }));
    },
    update(R) {
      const t = skinNow();
      const walk = R.lLeg ? Math.abs(R.lLeg.rotation.x - R.rLeg.rotation.x) : 0;
      (R.wings || []).forEach(w => { w.rotation.z = w.userData.side * (0.12 + Math.sin(t * 2.2) * (0.1 + walk * 0.15)); w.rotation.x = -0.1; });
      (R.tail || []).forEach((g, i) => { if (i) g.rotation.y = Math.sin(t * 1.6 - i * 0.6) * 0.14; });
    }
  },
  {
    id: 'aegis', name: 'Aegis', priceCents: 449, currency: 'USD', rarity: 'legendary',
    blurb: 'A knight in polished steel: a great helm with a glowing eye slit and a blue plume, layered pauldrons with gold trim, a sun emblem on his breastplate, and a royal-blue cape and tabard that swing as he strides.',
    view: { yaw: 0.45, elev: 0.0 },
    palette: {
      shell: { color: 0xcfd5de, metalness: 0.92, roughness: 0.18, clearcoat: 0.6, clearcoatRoughness: 0.08 },
      cream: { color: 0xd7a93a, metalness: 0.9, roughness: 0.25 },
      cover: { color: 0x1f3d94, metalness: 0.05, roughness: 0.75 },
      joint: { color: 0x3a404a, metalness: 0.8, roughness: 0.35 },
      rubber: { color: 0x22262c },
      seam: { color: 0x7a8290 },
      frame: { color: 0xd7a93a, metalness: 0.9 },
      amber: { color: 0xd7a93a, metalness: 0.9, roughness: 0.25 },
      glass: { color: 0x05070a },
      eye: { color: 0x9fe6ff },
      eyeGlow: { color: 0x4fc8ff, opacity: 0.7 },
      led: { color: 0x9fe6ff }
    },
    idColor: '#d7a93a',
    shape: {
      head: { kind: 'lathe', profile: [[0, -0.02], [0.25, -0.02], [0.3, 0.04], [0.31, 0.15], [0.31, 0.45], [0.3, 0.56], [0.26, 0.63], [0.14, 0.66], [0, 0.665]], sx: 1.0, sz: 1.0 },
      face: null, mouth: false, cheeks: false,
      eyes: { y: 0.39, phi: 0.2, r: 0.038, sx: 1.4, sy: 0.6, lift: 0.032 },
      ears: 'none', antenna: false,
      torso: { kind: 'lathe', profile: [[0, 0], [0.19, 0.02], [0.24, 0.1], [0.268, 0.25], [0.275, 0.4], [0.255, 0.5], [0.19, 0.57], [0.1, 0.62], [0, 0.63]], sx: 1.08, sz: 0.86 },
      belly: { yc: 0.3, hy: 0.001, phi: 0.01 },
      pack: { w: 0.001, h: 0.001, d: 0.001 },
      pelvisMat: 'joint',
      arm: { kind: 'capsule', shoulder: 0.09, upper: [0.072, 0.066], elbow: 0.072, fore: [0.086, 0.076] },
      leg: { kind: 'capsule', hip: 0.095, thigh: [0.096, 0.09], knee: 0.088, shin: [0.1, 0.088] },
      boot: { kind: 'dome', w: 0.12, h: 0.11, l: 0.235, toe: 0.075 }
    },
    parts(M, R, add) {
      const H = R.headProfile, gold = M.cream, cloth = new THREE.MeshStandardMaterial({ color: 0x1f3d94, roughness: 0.8, side: THREE.DoubleSide });
      // the eye slit and breathing holes, a gold strip down the face, gold rims
      add(R.head, skinOnShape(keloMesh(keloRoundedBox(0.42, 0.06, 0.03, 0.02, 0.006), M.glass, { shadow: false }), H, 1, 1, 0.39, 0, 0.012));
      add(R.head, skinOnShape(keloMesh(keloRoundedBox(0.05, 0.27, 0.025, 0.015, 0.005), gold), H, 1, 1, 0.21, 0, 0.012));
      [-1, 1].forEach(s => [0.13, 0.19, 0.25].forEach(y => [0.18, 0.26].forEach(ph => add(R.head, skinOnShape(keloMesh(new THREE.CircleGeometry(0.011, 8), M.glass, { shadow: false }), H, 1, 1, y, s * ph, 0.006)))));
      [0.02, 0.6].forEach(y => add(R.head, keloMesh(new THREE.TorusGeometry(keloProfileR(H, y) + 0.004, 0.016, 6, 34).rotateX(Math.PI / 2), gold, { pos: [0, y, 0] })));
      // a blue plume arching over the helm, front to back
      for (let i = 0; i < 9; i++) {
        const a = -0.9 + i * 0.22;
        const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.64, Math.sin(a) * 0.12), new THREE.Vector3(0, 0.8 + Math.cos(a) * 0.08, Math.sin(a) * 0.3), new THREE.Vector3(0, 0.78 + Math.cos(a) * 0.06 - i * 0.025, Math.sin(a) * 0.44 - 0.08)]);
        add(R.head, keloMesh(skinTaperTube(c, 0.065, 0.02, 16, 8), cloth));
      }
      add(R.head, keloMesh(new THREE.CylinderGeometry(0.05, 0.06, 0.05, 14), gold, { pos: [0, 0.665, 0] }));
      // a gold sun on the breastplate, and a gold belt
      const sun = skinOnShape(new THREE.Group(), R.torsoProfile, R.TSX, R.TSZ, 0.36, 0, 0.008);
      sun.add(keloMesh(new THREE.CircleGeometry(0.055, 24), gold, { shadow: false }));
      for (let i = 0; i < 12; i++) { const r = keloMesh(new THREE.ConeGeometry(0.016, 0.07, 4), gold, { pos: [Math.cos(i * Math.PI / 6) * 0.085, Math.sin(i * Math.PI / 6) * 0.085, 0], shadow: false }); r.rotation.z = i * Math.PI / 6 - Math.PI / 2; sun.add(r); }
      add(R.body, sun);
      add(R.body, (() => { const m = keloMesh(new THREE.TorusGeometry(0.255, 0.024, 6, 30).rotateX(Math.PI / 2), gold, { pos: [0, 0.05, 0] }); m.scale.set(1.08, 1, 0.86); return m; })());
      // layered pauldrons with gold rims
      ['lArm', 'rArm'].forEach(k => [0.16, 0.14, 0.12].forEach((r, i) => {
        add(R[k], keloMesh(skinCapGeometry(r, 1.15).rotateX(-Math.PI / 2), M.shell, { pos: [0, 0.02 - i * 0.06, 0] }));
        add(R[k], skinLimbRing(r * 0.9, 0.008, 0.02 - i * 0.06 - r * 0.38, gold));
      }));
      ['lElbow', 'rElbow'].forEach(k => { add(R[k], keloMesh(skinCapGeometry(0.085, 1.2).rotateY(Math.PI), M.shell, { pos: [0, -0.01, -0.015] })); add(R[k], skinLimbRing(0.088, 0.012, -0.27, gold)); });
      ['lKnee', 'rKnee'].forEach(k => { add(R[k], keloMesh(skinCapGeometry(0.1, 1.15), M.shell, { pos: [0, -0.02, 0.04] })); add(R[k], skinLimbRing(0.1, 0.01, -0.39, gold)); });
      // the tabard (front, hinged at the belt) and the cape (back, hinged at the shoulders)
      const tab = new THREE.Group(); tab.position.set(0, 0.05, 0.215);
      tab.add(keloMesh(keloRoundedBox(0.26, 0.42, 0.014, 0.03, 0.004), cloth, { pos: [0, -0.21, 0] }));
      tab.add(keloMesh(keloRoundedBox(0.26, 0.02, 0.016, 0.006, 0.003), gold, { pos: [0, -0.41, 0.002] }));
      add(R.body, tab); R.tabard = tab;
      const cape = new THREE.Group(); cape.position.set(0, 0.57, -0.19);
      const cg = new THREE.PlaneGeometry(0.62, 1.0, 1, 8); cg.translate(0, -0.5, 0);
      const pos = cg.attributes.position; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); pos.setX(i, pos.getX(i) * (1 + -y * 0.35)); pos.setZ(i, -Math.abs(pos.getX(i)) * 0.15); }
      cg.computeVertexNormals();
      cape.add(keloMesh(cg, cloth));
      [-1, 1].forEach(s => cape.add(keloMesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 16).rotateX(Math.PI / 2), gold, { pos: [s * 0.24, 0, 0.01] })));
      add(R.body, cape); R.cape = cape;
    },
    update(R) {
      if (!R.lLeg) return;
      const lx = R.lLeg.rotation.x, rx = R.rLeg.rotation.x, t = skinNow();
      if (R.tabard) R.tabard.rotation.x = Math.min(0, lx, rx) * 0.95;
      if (R.cape) R.cape.rotation.x = 0.06 + Math.max(0, lx, rx) * 0.9 + Math.abs(lx - rx) * 0.12 + Math.sin(t * 1.3) * 0.015;
    }
  },
  {
    id: 'nebula', name: 'Nebula', priceCents: 499, currency: 'USD', rarity: 'legendary',
    blurb: 'Made of night sky: a body full of stars and glowing nebula clouds, a dark visor with star-white eyes, violet light at every joint, a planet ring round his head, little moons in orbit and hover rings under his feet.',
    view: { yaw: 0.3, elev: 0.1 },
    palette: {
      shell: { color: 0xffffff, metalness: 0.2, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0xffffff, emissiveIntensity: 0.55 },
      cream: { color: 0x1a1240 },
      cover: { color: 0x150e33, metalness: 0.3, roughness: 0.3 },
      joint: { kind: 'basic', color: 0x9b7bff },
      rubber: { color: 0x120c2a },
      seam: { color: 0x7f6bff },
      frame: { color: 0xc8b8ff, metalness: 0.8 },
      amber: { kind: 'basic', color: 0xff5fd2 },
      glass: { color: 0x05030f, metalness: 0.4, roughness: 0.05 },
      visor: { color: 0xb08cff, opacity: 0.18 },
      eye: { color: 0xffffff },
      eyeGlow: { color: 0xc06bff, opacity: 0.6 },
      led: { color: 0xffe9a8 },
      cheek: { color: 0xff7ad8, opacity: 0.6 }
    },
    idColor: '#ff5fd2',
    shape: {
      head: { kind: 'lathe', profile: skinBallHead(0.4, 0.04, 1.0), sx: 1.0, sz: 0.98 },
      face: { yc: 0.36, hy: 0.21, phi: 1.0 }, faceFrame: 'amber',
      eyes: { y: 0.38, phi: 0.3, r: 0.075, mouthDy: 0.12 },
      ears: 'none',
      torso: { kind: 'lathe', profile: [[0, 0], [0.15, 0.02], [0.18, 0.1], [0.19, 0.22], [0.22, 0.36], [0.24, 0.46], [0.22, 0.54], [0.15, 0.6], [0.08, 0.635], [0, 0.645]], sx: 1.0, sz: 0.85 },
      belly: { yc: 0.3, hy: 0.001, phi: 0.01 },
      pack: { w: 0.001, h: 0.001, d: 0.001 },
      pelvisMat: 'shell',
      arm: { kind: 'capsule', shoulder: 0.07, upper: [0.064, 0.055], elbow: 0.055, fore: [0.06, 0.05] },
      leg: { kind: 'capsule', hip: 0.08, thigh: [0.086, 0.075], knee: 0.068, shin: [0.08, 0.065] },
      boot: { kind: 'dome', w: 0.1, h: 0.1, l: 0.19, toe: 0.06 }
    },
    parts(M, R, add) {
      const tex = skinStarTexture();
      M.shell.map = tex; M.shell.emissiveMap = tex; M.shell.needsUpdate = true;
      const violet = skinGlow(0xb48cff, 1), pink = skinGlow(0xff7ad8, 1);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xc8a8ff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      // a tilted planet ring round his head, with a bright inner edge
      const ring = new THREE.Group(); ring.position.set(0, 0.66, -0.02); ring.rotation.set(-0.22, 0, 0.18);
      ring.add(keloMesh(new THREE.RingGeometry(0.4, 0.58, 64).rotateX(-Math.PI / 2), ringMat, { shadow: false }));
      ring.add(keloMesh(new THREE.TorusGeometry(0.4, 0.01, 6, 64).rotateX(Math.PI / 2), violet, { shadow: false }));
      add(R.head, ring); R.ring = ring;
      // a star on his antenna
      add(R.antenna, keloMesh(new THREE.OctahedronGeometry(0.06, 0), skinGlow(0xffe9a8, 1), { pos: [0, 0.2, 0], shadow: false }));
      // a glowing star-gem on his chest
      const gem = skinOnShape(new THREE.Group(), R.torsoProfile, R.TSX, R.TSZ, 0.4, 0, 0.03);
      gem.add(keloMesh(new THREE.OctahedronGeometry(0.06, 0), pink, { shadow: false }));
      add(R.body, gem);
      // three little moons orbiting at different heights
      const orbit = new THREE.Group(); add(R.body, orbit); R.orbit = orbit;
      R.moons = [[0.62, 0.55, 0.04, 0xffe9a8], [0.55, 0.15, 0.03, 0x8fd8ff], [0.7, 0.85, 0.025, 0xff9ae0]].map(([r, y, s, c], i) => {
        const piv = new THREE.Group(); piv.rotation.y = i * 2.1; piv.position.y = y;
        piv.add(keloMesh(new THREE.SphereGeometry(s, 14, 10), skinGlow(c, 1), { pos: [r, 0, 0], shadow: false }));
        orbit.add(piv); return piv;
      });
      // hover rings under his feet
      const hover = new THREE.MeshBasicMaterial({ color: 0xb48cff, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
      ['lFoot', 'rFoot'].forEach(k => { add(R[k], keloMesh(new THREE.TorusGeometry(0.12, 0.012, 6, 28).rotateX(Math.PI / 2), hover, { pos: [0, -R.ankleY + 0.01, 0.06], shadow: false })); });
      // constellation sparkles on his shoulders and knees
      ['lArm', 'rArm', 'lKnee', 'rKnee'].forEach(k => add(R[k], keloMesh(new THREE.OctahedronGeometry(0.02, 0), skinGlow(0xffffff, 1), { pos: [0, -0.1, 0.075], shadow: false })));
    },
    update(R) {
      const t = skinNow();
      if (R.ring) R.ring.rotation.y = t * 0.25;
      if (R.moons) R.moons.forEach((m, i) => { m.rotation.y = i * 2.1 + t * (0.6 + i * 0.25); });
    }
  },
  {
    id: 'clockwork', name: 'Clockwork', priceCents: 349, currency: 'USD', rarity: 'legendary',
    blurb: 'A steam-age gentleman bot in brass and copper: a top hat with a gear band, brass lens eyes and a monocle chain, gauge ears, a boiler body with gears turning behind a glass chest window, and piston arms.',
    view: { yaw: 0.55, elev: 0.05 },
    palette: {
      shell: { color: 0xc9a04a, metalness: 0.9, roughness: 0.32, clearcoat: 0.3 },
      cream: { color: 0xb8683a, metalness: 0.9, roughness: 0.35, clearcoat: 0.2 },
      cover: { color: 0x3b2a1e, metalness: 0.1, roughness: 0.7 },
      joint: { color: 0x3a3836, metalness: 0.8, roughness: 0.4 },
      rubber: { color: 0x241a12 },
      seam: { color: 0x6a4a20 },
      frame: { color: 0xb8bcc2, metalness: 0.9, roughness: 0.25 },
      amber: { color: 0xffb347, emissive: 0xff7a10, emissiveIntensity: 0.9 },
      glass: { color: 0x120c06, metalness: 0.4, roughness: 0.08 },
      eye: { color: 0xffc66a },
      eyeGlow: { color: 0xff9a2a, opacity: 0.55 },
      led: { color: 0xffb347 }
    },
    idColor: '#ffb347',
    shape: {
      head: { kind: 'lathe', profile: [[0, -0.02], [0.24, -0.02], [0.27, 0.03], [0.28, 0.1], [0.28, 0.45], [0.27, 0.52], [0.24, 0.56], [0, 0.57]], sx: 1.05, sz: 1.0 },
      face: null, mouth: false, cheeks: false,
      eyes: { y: 0.35, phi: 0.32, r: 0.06, lift: 0.04 },
      ears: 'none', antenna: false,
      torso: { kind: 'lathe', profile: [[0, 0], [0.22, 0.01], [0.26, 0.06], [0.27, 0.15], [0.27, 0.45], [0.26, 0.53], [0.21, 0.59], [0.12, 0.63], [0, 0.64]], sx: 1.0, sz: 0.88 },
      belly: { yc: 0.3, hy: 0.001, phi: 0.01 },
      pack: { w: 0.001, h: 0.001, d: 0.001 },
      pelvisMat: 'cream',
      arm: { kind: 'capsule', shoulder: 0.095, upper: [0.065, 0.06], elbow: 0.068, fore: [0.072, 0.066] },
      leg: { kind: 'capsule', hip: 0.095, thigh: [0.09, 0.085], knee: 0.085, shin: [0.095, 0.09] },
      boot: { kind: 'box', w: 0.13, h: 0.13, l: 0.22, toe: 0.05, mat: 'cream' }
    },
    parts(M, R, add) {
      const H = R.headProfile, copper = M.cream, brass = M.shell;
      const winGlass = new THREE.MeshPhysicalMaterial({ color: 0xffe2b0, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.18, clearcoat: 1, depthWrite: false });
      const rivet = new THREE.SphereGeometry(0.012, 6, 4);
      // brass lens bezels round both eyes, a monocle chain on his right
      [-1, 1].forEach(s => {
        const b = skinOnShape(new THREE.Group(), H, 1.05, 1, 0.35, s * 0.32, 0.0);
        b.add(keloMesh(new THREE.CylinderGeometry(0.085, 0.09, 0.05, 24).rotateX(Math.PI / 2), M.glass, { pos: [0, 0, 0.012] }));
        b.add(keloMesh(new THREE.TorusGeometry(0.085, 0.018, 8, 26), s > 0 ? copper : brass, { pos: [0, 0, 0.038] }));
        add(R.head, b);
      });
      const chain = new THREE.CatmullRomCurve3([[0.17, 0.27, 0.27], [0.25, 0.14, 0.24], [0.3, 0.08, 0.16]].map(v => new THREE.Vector3(...v)));
      add(R.head, keloMesh(new THREE.TubeGeometry(chain, 16, 0.006, 5, false), M.frame, { shadow: false }));
      // a copper speaker grille for a mouth
      const grille = skinOnShape(new THREE.Group(), H, 1.05, 1, 0.15, 0, 0.0);
      grille.add(keloMesh(keloRoundedBox(0.22, 0.12, 0.03, 0.03, 0.008), copper));
      [-0.03, 0, 0.03].forEach(y => grille.add(keloMesh(keloRoundedBox(0.17, 0.012, 0.01, 0.005, 0.002), M.glass, { pos: [0, y, 0.016], shadow: false })));
      add(R.head, grille);
      // rivets round the head
      [0.06, 0.5].forEach(y => { for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; add(R.head, keloMesh(rivet, copper, { pos: [Math.sin(a) * 0.285 * 1.05, y, Math.cos(a) * 0.285], shadow: false })); } });
      // gauge ears: a brass dial with a cream face and a needle
      [-1, 1].forEach(s => {
        const g = new THREE.Group(); g.position.set(s * 0.3, 0.33, 0); g.rotation.y = s * Math.PI / 2;
        g.add(keloMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 24).rotateX(Math.PI / 2), brass));
        g.add(keloMesh(new THREE.CircleGeometry(0.08, 24), new THREE.MeshBasicMaterial({ color: 0xf3ead2 }), { pos: [0, 0, 0.026], shadow: false }));
        const needle = keloMesh(keloRoundedBox(0.008, 0.07, 0.004, 0.002, 0.001), new THREE.MeshBasicMaterial({ color: 0x8a1f10 }), { pos: [0, 0.02, 0.029], shadow: false });
        needle.rotation.z = -0.6; g.add(needle);
        add(R.head, g);
      });
      // the top hat: brim, crown, a copper band with a gear
      add(R.head, keloMesh(new THREE.CylinderGeometry(0.36, 0.36, 0.03, 32), M.cover, { pos: [0, 0.575, 0] }));
      add(R.head, keloMesh(new THREE.CylinderGeometry(0.22, 0.2, 0.34, 28), M.cover, { pos: [0, 0.76, 0] }));
      add(R.head, keloMesh(new THREE.CylinderGeometry(0.205, 0.205, 0.05, 28), copper, { pos: [0, 0.62, 0] }));
      const hatGear = keloMesh(skinGearGeometry(0.07, 10, 0.02), brass, { pos: [0.12, 0.65, 0.17] }); hatGear.rotation.y = 0.6; add(R.head, hatGear);
      // the chest window: gears turning behind glass, in a riveted bezel, and a pressure gauge
      const win = skinOnShape(new THREE.Group(), R.torsoProfile, R.TSX, R.TSZ, 0.33, 0, 0.0);
      win.add(keloMesh(new THREE.CircleGeometry(0.15, 32), M.glass, { pos: [0, 0, 0.004], shadow: false }));
      R.gears = [[0, 0, 0.09, 12, copper], [0.09, 0.07, 0.055, 9, brass], [-0.08, -0.07, 0.05, 8, brass]].map(([x, y, r, n, m], i) => {
        const g = keloMesh(skinGearGeometry(r, n, 0.015), m, { pos: [x, y, 0.016] });
        g.userData.spin = (i % 2 ? -1 : 1) * 0.9 * 0.09 / r;
        win.add(g); return g;
      });
      const glassD = keloMesh(new THREE.CircleGeometry(0.15, 32), winGlass, { pos: [0, 0, 0.034], shadow: false }); glassD.renderOrder = 2; win.add(glassD);
      win.add(keloMesh(new THREE.TorusGeometry(0.155, 0.022, 8, 32), brass, { pos: [0, 0, 0.028] }));
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; win.add(keloMesh(rivet, copper, { pos: [Math.cos(a) * 0.155, Math.sin(a) * 0.155, 0.05], shadow: false })); }
      add(R.body, win);
      // rivet rows on the boiler body
      [0.08, 0.52].forEach(y => { for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; add(R.body, keloMesh(rivet, copper, { pos: [Math.sin(a) * keloProfileR(R.torsoProfile, y) * R.TSX, y, Math.cos(a) * keloProfileR(R.torsoProfile, y) * R.TSZ], shadow: false })); } });
      // a boiler tank on his back, copper pipes to his shoulders, a little chimney
      add(R.body, keloMesh(new THREE.CylinderGeometry(0.14, 0.14, 0.4, 24), copper, { pos: [0, 0.35, -0.3] }));
      add(R.body, keloMesh(new THREE.SphereGeometry(0.14, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), copper, { pos: [0, 0.55, -0.3] }));
      [0.25, 0.45].forEach(y => add(R.body, keloMesh(new THREE.TorusGeometry(0.142, 0.012, 6, 24).rotateX(Math.PI / 2), brass, { pos: [0, y, -0.3] })));
      add(R.body, keloMesh(new THREE.CylinderGeometry(0.035, 0.04, 0.2, 12), M.joint, { pos: [0.08, 0.7, -0.32] }));
      [-1, 1].forEach(s => {
        const c = new THREE.CatmullRomCurve3([new THREE.Vector3(s * 0.1, 0.5, -0.28), new THREE.Vector3(s * 0.22, 0.62, -0.18), new THREE.Vector3(s * 0.3, 0.62, -0.06)]);
        add(R.body, keloMesh(new THREE.TubeGeometry(c, 12, 0.02, 8, false), copper));
      });
      // pistons along the outside of each upper arm, copper rings at elbows and knees
      ['lArm', 'rArm'].forEach((k, i) => {
        const s = i ? 1 : -1;
        add(R[k], keloMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 10), copper, { pos: [s * 0.075, -0.12, 0] }));
        add(R[k], keloMesh(new THREE.CylinderGeometry(0.01, 0.01, 0.18, 8), M.frame, { pos: [s * 0.075, -0.26, 0] }));
        add(R[k], keloMesh(skinCapGeometry(0.12, 1.2).rotateX(-Math.PI / 2), copper, { pos: [0, 0.01, 0] }));
      });
      ['lElbow', 'rElbow'].forEach(k => add(R[k], skinLimbRing(0.075, 0.014, -0.03, copper)));
      ['lKnee', 'rKnee'].forEach(k => { add(R[k], skinLimbRing(0.1, 0.016, -0.03, copper)); add(R[k], skinLimbRing(0.098, 0.012, -0.34, brass)); });
    },
    update(R) {
      const t = skinNow();
      (R.gears || []).forEach(g => { g.rotation.z = t * g.userData.spin; });
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
