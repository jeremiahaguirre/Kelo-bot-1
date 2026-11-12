// Kelo-1's body: a small, friendly humanoid robot about 2.7 units tall (to the antenna tip), built
// from plain three.js shapes so there is no model file to license. Loaded just before scene.js,
// which calls buildKelo1Character3D() once the scene exists.
//
// He is drawn cute on purpose: a big round head with a dark glass face screen, large glowing eyes
// that blink and change with his mood, rosy cheek lights, headphone ears and a bouncy antenna, on a
// soft rounded teal body with short legs and small hands.
//
// The rig. Other files write these joints' rotations every frame (js/animations.js blends them):
//   keloGroup                 his whole body; feet on the ground at y = 0, facing +z
//   keloBody                  the upper body, hung from his hips at KELO_HIP_Y so it can lean and sway
//   keloHead                  turns at the top of his neck
//   keloLeftArm / Right       shoulder pivots, with keloLeftElbow / Right and keloLeftHand / Right (wrists) below
//   keloLeftLeg / Right       hip pivots, with keloLeftKnee / Right and keloLeftFoot / Right (ankles) below
// His fingers curl with setKeloGrip(hand, 0..1): 0 is an open hand, 1 a tight fist.
// The "left" limbs are on -x and the "right" ones on +x, as they always were (the emotes rely on it).
// updateKeloFace(t, dt, resting) runs every frame from animations.js: blinking, mood and the antenna.

let keloBody;
let keloLeftElbow, keloRightElbow, keloLeftHand, keloRightHand;
let keloLeftKnee, keloRightKnee, keloLeftFoot, keloRightFoot;
let keloMouth, keloCheeks = [], keloAntenna;
// Everything buildKelo1Character3D made (joints and the parts on them), so a skin change can tell his
// own parts from things other code hung on him (a carried box, a held item); and the materials it made
const keloBuiltParts = new WeakSet();
let keloSkinBuilt = null;
const KELO_HIP_Y = 1.06;                       // where his upper body hangs from, above his feet
const KELO_LEG_Y = 1.04;                       // his hip joints (the top of his legs)
const KELO_SHOULDER = { x: 0.33, y: 1.66 };    // shoulder joints, above his feet
const KELO_UPPER_ARM = 0.36, KELO_FOREARM = 0.32, KELO_THIGH = 0.44, KELO_SHIN = 0.45;
const KELO_PALM = 0.055;                       // wrist to the middle of his palm
const KELO_THIGH_R = 0.1;                      // thigh thickness, for sitting on things
const KELO_REST_GRIP = 0.3;                    // fingers loosely curled

// His ID, "K-1", as a small decal
function keloIdTexture(fill) {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 64;
      const g = c.getContext('2d');
      g.font = 'bold 46px Arial, Helvetica, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 6;
      g.strokeStyle = 'rgba(15,23,42,0.85)';
      g.strokeText('K-1', 64, 34);
      g.fillStyle = fill || '#ffb547';
      g.fillText('K-1', 64, 34);
      const tex = new THREE.CanvasTexture(c);
      tex.anisotropy = 4;
      return tex;
    }

// His palette, as material kinds and settings. A skin (js/skins.js) overrides any of these by name:
// { shell: { color: 0xf2f4f7, roughness: 0.3 } } keeps the kind and changes only those settings.
const KELO_MAT_DEFS = {
  // Teal painted metal under a glossy clear lacquer, like a well-kept toy robot
  shell: ['phys', { color: 0x2bb8ae, metalness: 0.18, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.09 }],
  // Cream enamel belly and face-frame panels
  cream: ['phys', { color: 0xf3eee2, metalness: 0.0, roughness: 0.46, clearcoat: 0.65, clearcoatRoughness: 0.18 }],
  // Soft slate-blue covers at the hands and ears
  cover: ['std', { color: 0x3a4a60, metalness: 0.15, roughness: 0.5 }],
  // Matte silicone rubber at his joints (shoulders, elbows, hips, knees, ankles)
  joint: ['std', { color: 0x45556b, metalness: 0, roughness: 0.68 }],
  rubber: ['std', { color: 0x232b38, metalness: 0, roughness: 0.85 }],
  // Hairline panel seams between the painted parts
  seam: ['std', { color: 0x0f1a20, metalness: 0.2, roughness: 0.6 }],
  frame: ['std', { color: 0x9aa7b5, metalness: 0.7, roughness: 0.35 }],
  amber: ['std', { color: 0xffb547, metalness: 0.2, roughness: 0.35, emissive: 0x4a2400, emissiveIntensity: 0.3 }],
  glass: ['phys', { color: 0x07101c, metalness: 0.2, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04 }],
  // A clear visor over the face screen: only its reflections show, the eyes glow through it
  visor: ['phys', { color: 0xbfe9ff, metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.16, depthWrite: false, envMapIntensity: 1.6 }],
  eye: ['basic', { color: 0x8ef6ff }],
  // A soft glow round each eye on the dark glass
  eyeGlow: ['basic', { color: 0x5fe8ff, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }],
  shine: ['basic', { color: 0xffffff }],
  cheek: ['basic', { color: 0xff7fa8, transparent: true, opacity: 0.5, depthWrite: false }],
  led: ['basic', { color: 0x5ef0b0 }],
  id: ['basic', { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }]
};
const KELO_MAT_KINDS = { phys: THREE.MeshPhysicalMaterial, std: THREE.MeshStandardMaterial, basic: THREE.MeshBasicMaterial };

// His materials for a skin (default: the one he wears). Every call makes new materials; the old
// set is disposed when he changes skin (equipKeloSkin, js/skins.js).
function keloMaterials(skinId) {
      const skin = typeof keloSkinDef === 'function' ? keloSkinDef(skinId === undefined ? keloEquippedSkinId() : skinId) : null;
      const pal = (skin && skin.palette) || {};
      const M = {};
      Object.keys(KELO_MAT_DEFS).forEach(k => {
        const [kind, base] = KELO_MAT_DEFS[k];
        const over = pal[k] || {};
        const Kind = KELO_MAT_KINDS[over.kind || kind] || THREE.MeshStandardMaterial;
        const params = Object.assign({}, base, over);
        delete params.kind;
        // settings a plainer material kind doesn't have are left out
        if (Kind !== THREE.MeshPhysicalMaterial) { delete params.clearcoat; delete params.clearcoatRoughness; }
        if (Kind === THREE.MeshBasicMaterial) { ['metalness', 'roughness', 'emissive', 'emissiveIntensity', 'envMapIntensity'].forEach(n => delete params[n]); }
        M[k] = new Kind(params);
      });
      M.id.map = keloIdTexture(skin && skin.idColor);
      return M;
    }

// A hairline seam round a lathe surface at height y (a dark ring sitting in the paint)
function keloSeamRing(profile, y, sx, sz, M, tube = 0.0042) {
      const ring = keloMesh(new THREE.TorusGeometry(keloProfileR(profile, y) + 0.0015, tube, 4, 40).rotateX(Math.PI / 2), M.seam, { pos: [0, y, 0], shadow: false });
      ring.scale.set(sx, 1, sz);
      return ring;
    }

// A rubber bellows at a joint: a few soft ribs round the limb axis
function keloBellows(parent, r, y0, n, step, M) {
      const geo = new THREE.TorusGeometry(r, r * 0.16, 6, 20).rotateX(Math.PI / 2);
      for (let i = 0; i < n; i++) parent.add(keloMesh(geo, M.joint, { pos: [0, y0 - i * step, 0], shadow: false }));
    }

// Fewer draw calls: the fixed parts hung directly on one joint are joined into one mesh per material.
// Only plain parts are joined: anything with userData, or listed in `keep` (the mouth, the cheeks),
// stays its own mesh, and child groups (fingers, eyes, tools, the antenna) are left as they are.
function keloJoinRigid(group, keep) {
      if (!group) return;
      const sets = new Map();
      group.children.forEach(o => {
        if (!o.isMesh || keep.has(o) || Object.keys(o.userData).length || !o.geometry.attributes.position) return;
        o.updateMatrix();
        if (o.matrix.determinant() < 0) return;
        const names = Object.keys(o.geometry.attributes).sort().join(',');
        const key = o.material.uuid + '|' + o.castShadow + '|' + names;
        if (!sets.has(key)) sets.set(key, []);
        sets.get(key).push(o);
      });
      sets.forEach(list => {
        if (list.length < 2) return;
        const parts = list.map(o => {
          const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
          return g.applyMatrix4(o.matrix);
        });
        const out = new THREE.BufferGeometry();
        Object.keys(parts[0].attributes).forEach(n => {
          const size = parts[0].attributes[n].itemSize;
          const arr = new Float32Array(parts.reduce((t, p) => t + p.attributes[n].array.length, 0));
          let off = 0;
          parts.forEach(p => { arr.set(p.attributes[n].array, off); off += p.attributes[n].array.length; });
          out.setAttribute(n, new THREE.BufferAttribute(arr, size));
        });
        parts.forEach(p => p.dispose());
        const m = keloMesh(out, list[0].material, { shadow: list[0].castShadow });
        list.forEach(o => group.remove(o));
        group.add(m);
      });
    }

// --- Shape helpers --------------------------------------------------------------------------

// A turned shape from [radius, y] pairs listed bottom to top; phi0/phiLen cut out a panel
// (phi 0 faces forward, +z). sx/sz squash it into an oval.
function keloLathe(profile, mat, o = {}) {
      const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r), y));
      const geo = new THREE.LatheGeometry(pts, o.seg || 18, o.phi0 || 0, o.phiLen || Math.PI * 2);
      return keloMesh(geo, mat, o);
    }

function keloMesh(geo, mat, o = {}) {
      const m = new THREE.Mesh(geo, mat);
      if (o.sx || o.sz) m.scale.set(o.sx || 1, 1, o.sz || 1);
      if (o.pos) m.position.set(...o.pos);
      if (o.rot) m.rotation.set(...o.rot);
      m.castShadow = o.shadow !== false;
      m.receiveShadow = true;
      return m;
    }

// A limb segment hanging down from y = 0 to y = -len: rounded ends, rTop at the top, rBot at the bottom
function keloCapsuleProfile(rTop, rBot, len, bulge = 0) {
      const p = [];
      for (let i = 0; i <= 3; i++) {
        const a = i / 3 * Math.PI / 2;
        p.push([rBot * Math.sin(a), -len - rBot * Math.cos(a) + rBot]);
      }
      // a slight swelling partway down, so limbs look soft rather than like tubes
      [0.35, 0.55, 0.75].forEach(f => {
        const r = rBot + (rTop - rBot) * f + bulge * Math.sin(Math.PI * f);
        p.push([r, -len + rBot + (len - rBot - rTop) * f]);
      });
      for (let i = 0; i <= 3; i++) {
        const a = i / 3 * Math.PI / 2;
        p.push([rTop * Math.cos(a), -rTop + rTop * Math.sin(a)]);
      }
      return p;
    }

// A box with rounded edges, centred on the origin
function keloRoundedBox(w, h, d, r, bevel = 0.012) {
      const s = new THREE.Shape();
      const x = -w / 2, y = -h / 2;
      s.moveTo(x + r, y);
      s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
      const geo = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - bevel * 2), bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 4 });
      geo.center();
      return geo;
    }

// Radius of a lathe profile at height y
function keloProfileR(profile, y) {
      for (let i = 1; i < profile.length; i++) {
        const [r0, y0] = profile[i - 1], [r1, y1] = profile[i];
        if (y <= y1) return r0 + (r1 - r0) * Math.max(0, Math.min(1, (y - y0) / ((y1 - y0) || 1)));
      }
      return profile[profile.length - 1][0];
    }

// A rounded patch laid over the front of a lathe surface, a touch proud of it: the face screen and
// the belly panel. v = { yc, hy, phi } is its centre height, half height and half width (an angle).
function keloPatchGeometry(profile, sx, sz, v, lift = 0.006, narrowBottom = 0.2) {
      const N = 20, Mv = 14, pos = [], idx = [];
      for (let j = 0; j <= Mv; j++) {
        for (let i = 0; i <= N; i++) {
          const u = -1 + 2 * i / N, w = -1 + 2 * j / Mv;
          // square grid to a disc, so the edge is smooth and round
          const du = u * Math.sqrt(1 - w * w / 2), dv = w * Math.sqrt(1 - u * u / 2);
          const phi = du * v.phi * (1 - narrowBottom + narrowBottom * dv);
          const y = v.yc + dv * v.hy;
          const r = keloProfileR(profile, y) + lift;
          pos.push(r * Math.sin(phi) * sx, y, r * Math.cos(phi) * sz);
        }
      }
      for (let j = 0; j < Mv; j++) {
        for (let i = 0; i < N; i++) {
          const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
          idx.push(a, b, d, a, d, c);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      return geo;
    }

// Where a point on a squashed lathe surface is, and which way it faces (for eyes and badges)
function keloOnSurface(r, y, phi, sx, sz, lift = 0) {
      const n = new THREE.Vector3(Math.sin(phi) / sx, 0, Math.cos(phi) / sz).normalize();
      const p = new THREE.Vector3(r * Math.sin(phi) * sx, y, r * Math.cos(phi) * sz).addScaledVector(n, lift);
      return { p, n };
    }

// Stick a part on a surface, facing out along n
function keloStick(obj, parent, p, n) {
      obj.position.copy(p);
      obj.lookAt(p.clone().add(n));
      parent.add(obj);
      return obj;
    }

// A cable run through the given points
function keloCable(points, radius, mat) {
      const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
      return keloMesh(new THREE.TubeGeometry(curve, 14, radius, 5, false), mat, { shadow: false });
    }

// --- The body -------------------------------------------------------------------------------

// The shapes of his parts. A skin (js/skins.js, `shape`) may replace any of these, so each skin can be a
// differently built robot; the skeleton (joint positions, bone lengths) never changes, so every pose,
// clip and IK target works the same in every skin.
//   head / torso: { kind: 'lathe', profile, sx, sz } (a turned shape, [radius, y] bottom to top) or
//                 { kind: 'box', w, h, d, r } (a rounded box standing on y = 0)
//   face: the screen on the head (lathe: { yc, hy, phi }; box: { yc, w, h }); eyes: { y, phi | x, r }
//   arm / leg: { kind: 'capsule' | 'box', upper/thigh [rTop, rBot], fore/shin [rTop, rBot], ball radii }
//   boot: { kind: 'dome' | 'box' | 'ball', w, h, l } (half width, height, half length)
const KELO_SHAPE_CLASSIC = {
  pelvis: { profile: [[0, -0.14], [0.09, -0.135], [0.16, -0.1], [0.2, -0.04], [0.21, 0.03], [0.2, 0.09], [0, 0.1]], sx: 1.05, sz: 0.82 },
  torso: { kind: 'lathe', profile: [[0, 0.0], [0.17, 0.02], [0.215, 0.08], [0.24, 0.18], [0.245, 0.3], [0.237, 0.42], [0.21, 0.52], [0.16, 0.6], [0.09, 0.645], [0, 0.66]], sx: 1.0, sz: 0.82 },
  belly: { yc: 0.26, hy: 0.19, phi: 0.78 },
  pack: { w: 0.28, h: 0.3, d: 0.1 },
  head: { kind: 'lathe', profile: [[0, 0.0], [0.12, 0.01], [0.215, 0.05], [0.278, 0.12], [0.303, 0.21], [0.31, 0.3], [0.302, 0.39], [0.272, 0.47], [0.215, 0.545], [0.125, 0.598], [0, 0.615]], sx: 1.1, sz: 0.98 },
  face: { yc: 0.275, hy: 0.215, phi: 1.12 },
  eyes: { y: 0.3, phi: 0.37, r: 0.058 },
  ears: 'phones',
  arm: { kind: 'capsule', shoulder: 0.088, upper: [0.07, 0.058], elbow: 0.056, fore: [0.064, 0.05] },
  leg: { kind: 'capsule', hip: 0.095, thigh: [0.1, 0.082], knee: 0.075, shin: [0.085, 0.07] },
  boot: { kind: 'dome', w: 0.115, h: 0.13, l: 0.19 }
};

// Where a point on a head or torso shape is (y up its front, phi round from the front), and which way it faces
function keloShapePoint(sh, y, phi, lift = 0) {
      if (sh.kind === 'box') {
        const hw = sh.w / 2, hd = sh.d / 2;
        if (Math.abs(phi) > 1.25) {
          const sgn = Math.sign(phi);
          return { p: new THREE.Vector3(sgn * (hw + lift), y, hd * Math.cos(phi) * 1.4), n: new THREE.Vector3(sgn, 0, 0) };
        }
        return { p: new THREE.Vector3(hw * Math.sin(phi) * 1.05, y, hd + lift), n: new THREE.Vector3(0, 0, 1) };
      }
      return keloOnSurface(keloProfileR(sh.profile, y), y, phi, sh.sx, sh.sz, lift);
    }
// Its half width at height y (where the ears go)
function keloShapeHalfWidth(sh, y) { return sh.kind === 'box' ? sh.w / 2 : keloProfileR(sh.profile, y) * sh.sx; }
function keloShapeTop(sh) { return sh.kind === 'box' ? sh.h : sh.profile[sh.profile.length - 1][1]; }
// The shell itself
function keloShapeMesh(sh, mat, seg) {
      if (sh.kind === 'box') return keloMesh(keloRoundedBox(sh.w, sh.h, sh.d, sh.r || 0.08, 0.02), mat, { pos: [0, sh.h / 2, 0] });
      return keloLathe(sh.profile, mat, { sx: sh.sx, sz: sh.sz, seg });
    }
// A panel on its front (face screen, belly): curved on a lathe, a flat rounded plate on a box
function keloShapePanel(sh, v, lift, mat, narrow) {
      if (sh.kind === 'box') {
        const w = v.w || sh.w * 0.75, h = v.h || v.hy * 2;
        return keloMesh(keloRoundedBox(w, h, 0.012, Math.min(w, h) * 0.22, 0.004), mat, { pos: [0, v.yc, sh.d / 2 + lift], shadow: false });
      }
      return keloMesh(keloPatchGeometry(sh.profile, sh.sx, sh.sz, v, lift, narrow), mat, { shadow: false });
    }
// A limb segment hanging from y = 0 down `len`: a soft capsule, or a rounded box section
function keloLimbGeometry(kind, rTop, rBot, len, bulge) {
      if (kind === 'box') {
        const r = (rTop + rBot) / 2;
        const g = keloRoundedBox(r * 2, len, r * 1.8, r * 0.45, 0.012);
        g.translate(0, -len / 2, 0);
        return g;
      }
      return new THREE.LatheGeometry(keloCapsuleProfile(rTop, rBot, len, bulge).map(([r, y]) => new THREE.Vector2(r, y)), 20);
    }
function keloSkinShape(skinId) {
      const skin = typeof keloSkinDef === 'function' ? keloSkinDef(skinId) : null;
      return Object.assign({}, KELO_SHAPE_CLASSIC, (skin && skin.shape) || {});
    }

// opts.skin: which skin to dress him in (default: the one he wears, js/skins.js). opts.detached: build
// the parts only, without putting him in the world (equipKeloSkin moves them onto his live rig).
function buildKelo1Character3D(opts = {}) {
      const skinId = opts.skin !== undefined ? opts.skin : (typeof keloEquippedSkinId === 'function' ? keloEquippedSkinId() : 'classic');
      const M = keloMaterials(skinId);
      const S = keloSkinShape(skinId);
      keloGroup = new THREE.Group();
      keloGroup.name = 'Kelo-1';
      keloBody = new THREE.Group();
      keloBody.position.set(0, KELO_HIP_Y, 0);
      keloGroup.add(keloBody);

      // Pelvis: a soft rounded cover with a belt line
      const P = S.pelvis;
      keloBody.add(keloLathe(P.profile, M.cover, { sx: P.sx, sz: P.sz, seg: 28 }));
      const belt = keloMesh(new THREE.TorusGeometry(keloProfileR(P.profile, 0.06), 0.012, 6, 28).rotateX(Math.PI / 2), M.amber, { pos: [0, 0.06, 0], shadow: false });
      belt.scale.set(P.sx, 1, P.sz);
      keloBody.add(belt);

      // Torso, with a belly panel, his K-1 badge and a little heart-light
      const T = S.torso;
      const torsoProfile = T.profile || KELO_SHAPE_CLASSIC.torso.profile, TSX = T.sx || 1, TSZ = T.sz || 1;
      keloBody.add(keloShapeMesh(T, M.shell, 32));
      if (T.kind !== 'box') keloBody.add(keloSeamRing(T.profile, 0.535, TSX, TSZ, M), keloSeamRing(T.profile, 0.075, TSX, TSZ, M));
      keloBody.add(keloShapePanel(T, S.belly, 0.004, M.cream, 0.1));
      const idAt = keloShapePoint(T, 0.5, 0.5, 0.008);
      keloStick(new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.075), M.id), keloBody, idAt.p, idAt.n);
      const heartAt = keloShapePoint(T, 0.3, 0.0, 0.008);
      keloStick(keloMesh(new THREE.CircleGeometry(0.022, 14), M.amber, { shadow: false }), keloBody, heartAt.p, heartAt.n);

      // A little backpack with a grab handle and a status light, on his back
      const backZ = T.kind === 'box' ? T.d / 2 : keloProfileR(T.profile, 0.34) * TSZ;
      const PK = S.pack;
      const pack = new THREE.Group();
      pack.position.set(0, 0.34, -(backZ + 0.0013));
      pack.add(keloMesh(keloRoundedBox(PK.w, PK.h, PK.d, 0.07, 0.025), M.cover));
      pack.add(keloMesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), M.amber, { pos: [0, PK.h / 2, -0.02] }));
      pack.add(keloMesh(new THREE.SphereGeometry(0.014, 8, 6), M.led, { pos: [0.08, 0.07, -PK.d / 2 - 0.002], shadow: false }));
      const slot = keloRoundedBox(0.11, 0.012, 0.01, 0.005, 0.003);
      [0.0, -0.026, -0.052].forEach(y => pack.add(keloMesh(slot, M.seam, { pos: [-0.04, y + 0.075, -PK.d / 2 - 0.001], shadow: false })));
      const backId = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.05), M.id);
      backId.position.set(0, -0.02, -PK.d / 2 - 0.002);
      backId.rotation.y = Math.PI;
      pack.add(backId);
      keloBody.add(pack);

      // Neck: short and soft
      keloBody.add(keloLathe([[0.09, 0.6], [0.078, 0.64], [0.075, 0.73]], M.rubber, { seg: 20 }));
      keloBellows(keloBody, 0.08, 0.69, 2, 0.03, M);

      // --- Head, with a face screen, ears and an antenna
      keloHead = new THREE.Group();
      keloHead.position.set(0, 0.71, 0);
      keloBody.add(keloHead);
      const Hd = S.head;
      const headProfile = Hd.profile || KELO_SHAPE_CLASSIC.head.profile, HSX = Hd.sx || 1, HSZ = Hd.sz || 1;
      const headTop = keloShapeTop(Hd);
      keloHead.add(keloShapeMesh(Hd, M.shell, 34));
      if (Hd.kind !== 'box') keloHead.add(keloSeamRing(Hd.profile, headTop * 0.862, HSX, HSZ, M), keloSeamRing(Hd.profile, 0.04, HSX, HSZ, M));
      // a frame around the screen, the dark glass screen, and a clear visor over it
      const F = S.face;
      const shrink = (v, k, dy) => Hd.kind === 'box' ? { yc: v.yc, w: v.w * k, h: v.h * k - dy } : { yc: v.yc, hy: v.hy - dy, phi: v.phi * k };
      keloHead.add(keloShapePanel(Hd, F, 0.004, M.cream, 0.25));
      keloHead.add(keloShapePanel(Hd, shrink(F, 0.89, 0.03), 0.008, M.glass, 0.25));
      const visor = keloShapePanel(Hd, shrink(F, 0.92, 0.025), Hd.kind === 'box' ? 0.016 : 0.02, M.visor, 0.25);
      visor.renderOrder = 2;
      keloHead.add(visor);

      // Big glowing eyes: an open oval with a sparkle, and a "^" arc for when he is happy
      const E = S.eyes, er = E.r || 0.058;
      const eyeOval = new THREE.CircleGeometry(er, 24);
      const eyeHalo = new THREE.CircleGeometry(er * 1.45, 24);
      const eyeArc = new THREE.TorusGeometry(er * 0.83, er * 0.24, 6, 16, Math.PI);
      const sparkle = new THREE.CircleGeometry(er * 0.28, 10);
      const eyeLift = Hd.kind === 'box' ? 0.016 : 0.011;
      const makeEye = s => {
        const eye = new THREE.Group();
        const open = new THREE.Group();
        const halo = new THREE.Mesh(eyeHalo, M.eyeGlow);
        halo.position.z = -0.001;
        open.add(halo, new THREE.Mesh(eyeOval, M.eye));
        const sp = new THREE.Mesh(sparkle, M.shine);
        sp.position.set(-er * 0.31, er * 0.45, 0.002);
        open.add(sp);
        const arc = new THREE.Mesh(eyeArc, M.eye);
        arc.position.y = -er * 0.35;
        arc.visible = false;
        eye.add(open, arc);
        eye.userData = { open, arc, sparkle: sp, side: s };
        const at = Hd.kind === 'box'
          ? { p: new THREE.Vector3(s * (E.x || 0.11), E.y, Hd.d / 2 + eyeLift), n: new THREE.Vector3(0, 0, 1) }
          : keloOnSurface(keloProfileR(Hd.profile, E.y), E.y, s * E.phi, HSX, HSZ, eyeLift);
        return keloStick(eye, keloHead, at.p, at.n);
      };
      keloLeftEye = makeEye(-1);
      keloRightEye = makeEye(1);
      // A small smile under the eyes (flipped into a frown when he is sad)
      keloMouth = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.009, 5, 14, Math.PI), M.eye);
      const mouthY = E.y - 0.13;
      const mouthAt = Hd.kind === 'box' ? { p: new THREE.Vector3(0, mouthY, Hd.d / 2 + eyeLift), n: new THREE.Vector3(0, 0, 1) } : keloOnSurface(keloProfileR(Hd.profile, mouthY) + 0.008, mouthY, 0, HSX, HSZ, 0.011);
      keloStick(keloMouth, keloHead, mouthAt.p, mouthAt.n);
      keloMouth.rotateZ(Math.PI);  // the arc's open side up: a smile
      // Rosy cheek lights
      keloCheeks = [-1, 1].map(s => {
        const c = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), M.cheek);
        const cy = E.y - 0.095;
        const at = Hd.kind === 'box' ? { p: new THREE.Vector3(s * ((E.x || 0.11) + 0.06), cy, Hd.d / 2 + eyeLift + 0.001), n: new THREE.Vector3(0, 0, 1) } : keloOnSurface(keloProfileR(Hd.profile, cy) + 0.0034, cy, s * (E.phi + 0.25), HSX, HSZ, 0.012);
        keloStick(c, keloHead, at.p, at.n);
        c.scale.set(1.35, 0.8, 1);
        return c;
      });

      // Headphone ears joined by a band over the top of his head
      const earY = 0.3, earX = keloShapeHalfWidth(Hd, earY);
      if (S.ears === 'phones') {
        const earCup = new THREE.LatheGeometry([[0, -0.045], [0.08, -0.045], [0.1, -0.03], [0.105, 0], [0.1, 0.03], [0.08, 0.045], [0, 0.045]].map(([r, y]) => new THREE.Vector2(r, y)), 22).rotateZ(Math.PI / 2);
        const earRing = new THREE.TorusGeometry(0.075, 0.012, 6, 22).rotateY(Math.PI / 2);
        [-1, 1].forEach(s => {
          keloHead.add(keloMesh(earCup, M.cover, { pos: [s * (earX + 0.004), earY, -0.01] }));
          keloHead.add(keloMesh(earRing, M.amber, { pos: [s * (earX + 0.049), earY, -0.01], shadow: false }));
          keloHead.add(keloMesh(new THREE.CircleGeometry(0.04, 14).rotateY(s * Math.PI / 2), M.shell, { pos: [s * (earX + 0.053), earY, -0.01], shadow: false }));
        });
        const band = keloMesh(new THREE.TorusGeometry(earX + 0.004, 0.024, 6, 26, Math.PI), M.cover, { pos: [0, earY, -0.03] });
        band.scale.set(1, Math.max(0.6, 0.97 * (headTop - earY + 0.03) / (earX + 0.004)), 1);
        keloHead.add(band);
      }

      // The antenna: a springy stalk with a glowing ball on top that bobs as he moves
      keloAntenna = new THREE.Group();
      keloAntenna.position.set(0.05, headTop - 0.015, -0.02);
      keloAntenna.rotation.z = -0.12;
      keloAntenna.add(keloMesh(new THREE.CylinderGeometry(0.009, 0.013, 0.17, 8), M.frame, { pos: [0, 0.085, 0], shadow: false }));
      keloAntenna.add(keloMesh(new THREE.SphereGeometry(0.038, 14, 10), M.led, { pos: [0, 0.19, 0] }));
      keloAntenna.userData = { rx: 0, rz: 0, vx: 0, vz: 0, last: null, lastV: null };
      if (S.antenna === false) keloAntenna.children.forEach(c => { c.visible = false; });
      keloHead.add(keloAntenna);

      // --- Arms: limbs with ball joints and small hands
      const A = S.arm;
      const shoulderBall = new THREE.SphereGeometry(A.shoulder, 24, 16);
      const upperArm = keloLimbGeometry(A.kind, A.upper[0], A.upper[1], KELO_UPPER_ARM - 0.03, 0.006);
      const elbowBall = new THREE.SphereGeometry(A.elbow, 14, 10);
      const forearm = keloLimbGeometry(A.kind, A.fore[0], A.fore[1], KELO_FOREARM - 0.05, 0.008);
      const cuff = new THREE.TorusGeometry(A.fore[1], 0.011, 6, 18).rotateX(Math.PI / 2);
      const wristBall = new THREE.SphereGeometry(0.034, 10, 8);

      const buildArm = s => {
        // s is -1 for his left arm (on -x) and +1 for his right
        const shoulder = new THREE.Group();
        shoulder.position.set(s * KELO_SHOULDER.x, KELO_SHOULDER.y - KELO_HIP_Y, 0);
        shoulder.add(keloMesh(shoulderBall, M.shell));
        shoulder.add(keloMesh(upperArm, M.shell, { pos: [0, -0.02, 0] }));
        const elbow = new THREE.Group();
        elbow.position.set(0, -KELO_UPPER_ARM, 0);
        shoulder.add(elbow);
        elbow.add(keloMesh(elbowBall, M.joint));
        keloBellows(elbow, A.elbow * 0.95, 0.026, 3, 0.026, M);
        elbow.add(keloMesh(forearm, M.shell, { pos: [0, -0.025, 0] }));
        if (A.kind !== 'box') elbow.add(keloMesh(cuff, M.amber, { pos: [0, -KELO_FOREARM + 0.04, 0], shadow: false }));
        const hand = new THREE.Group();
        hand.position.set(0, -KELO_FOREARM, 0);
        elbow.add(hand);
        hand.add(keloMesh(wristBall, M.joint));
        buildKeloHand(hand, s, M);
        return { shoulder, elbow, hand };
      };
      const L = buildArm(-1), R = buildArm(1);
      keloLeftArm = L.shoulder; keloLeftElbow = L.elbow; keloLeftHand = L.hand;
      keloRightArm = R.shoulder; keloRightElbow = R.elbow; keloRightHand = R.hand;
      keloBody.add(keloLeftArm, keloRightArm);

      // --- Legs, knees and boots
      const G = S.leg, B = S.boot;
      const hipBall = new THREE.SphereGeometry(G.hip, 16, 12);
      const thigh = keloLimbGeometry(G.kind, G.thigh[0], G.thigh[1], KELO_THIGH - 0.04, 0.01);
      const kneeBall = new THREE.SphereGeometry(G.knee, 14, 10);
      const shin = keloLimbGeometry(G.kind, G.shin[0], G.shin[1], KELO_SHIN - 0.08, 0.012);
      const ankleBall = new THREE.SphereGeometry(0.05, 12, 8);
      const ankleY = KELO_LEG_Y - KELO_THIGH - KELO_SHIN;   // how high his ankles are above the ground
      const sole = new THREE.CylinderGeometry(1, 1, 1, 24);
      const bootGeo = B.kind === 'box' ? keloRoundedBox(B.w * 2, B.h, B.l * 2, Math.min(B.w, B.h) * 0.45, 0.015)
        : B.kind === 'ball' ? new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.62)
        : new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);

      const buildLeg = s => {
        const hip = new THREE.Group();
        hip.position.set(s * 0.12, KELO_LEG_Y, 0);
        hip.add(keloMesh(hipBall, M.joint));
        hip.add(keloMesh(thigh, M.shell, { pos: [0, -0.02, 0] }));
        const knee = new THREE.Group();
        knee.position.set(0, -KELO_THIGH, 0);
        hip.add(knee);
        knee.add(keloMesh(kneeBall, M.joint));
        keloBellows(knee, G.knee * 0.96, 0.034, 3, 0.034, M);
        knee.add(keloMesh(shin, M.shell, { pos: [0, -0.04, 0] }));
        const ankle = new THREE.Group();
        ankle.position.set(0, -KELO_SHIN, 0);
        knee.add(ankle);
        ankle.add(keloMesh(ankleBall, M.joint));
        const toe = B.toe !== undefined ? B.toe : 0.05;
        if (B.kind === 'box') {
          ankle.add(keloMesh(bootGeo, M.shell, { pos: [0, -ankleY + 0.025 + B.h / 2, toe] }));
        } else {
          const b = keloMesh(bootGeo, M.shell, { pos: [0, -ankleY + 0.025, toe] });
          b.scale.set(B.w, B.h, B.l);
          ankle.add(b);
        }
        const so = keloMesh(sole, M.rubber, { pos: [0, -ankleY + 0.0125, toe] });
        so.scale.set(B.w + 0.005, 0.025, B.l + 0.005);
        ankle.add(so);
        keloGroup.add(hip);
        return { hip, knee, ankle };
      };
      const LL = buildLeg(-1), RL = buildLeg(1);
      keloLeftLeg = LL.hip; keloLeftKnee = LL.knee; keloLeftFoot = LL.ankle;
      keloRightLeg = RL.hip; keloRightKnee = RL.knee; keloRightFoot = RL.ankle;

      // One mesh per material on each joint (the seams, bellows and shells added above)
      const keep = new Set([keloMouth, ...keloCheeks]);
      [keloBody, keloHead, pack, L.shoulder, L.elbow, L.hand, R.shoulder, R.elbow, R.hand, LL.hip, LL.knee, LL.ankle, RL.hip, RL.knee, RL.ankle]
        .forEach(g => keloJoinRigid(g, keep));

      // His skin's own parts (js/skins.js), each in a "skin" group on the bone it rides on
      if (typeof keloDressSkin === 'function') {
        keloDressSkin(skinId, M, {
          group: keloGroup, body: keloBody, head: keloHead, pack,
          lArm: L.shoulder, rArm: R.shoulder, lElbow: L.elbow, rElbow: R.elbow, lHand: L.hand, rHand: R.hand,
          lLeg: LL.hip, rLeg: RL.hip, lKnee: LL.knee, rKnee: RL.knee, lFoot: LL.ankle, rFoot: RL.ankle,
          lEye: keloLeftEye, rEye: keloRightEye, antenna: keloAntenna, cheeks: keloCheeks,
          S, headProfile, HSX, HSZ, torsoProfile, TSX, TSZ, ankleY, earX, earY, headTop
        });
      }

      buildKeloHandTools(M);
      keloSkinBuilt = { skin: skinId, M };
      keloGroup.traverse(o => keloBuiltParts.add(o));
      if (opts.detached) return;

      const startGroundY = getIslandGroundHeight(state.botPos.x, state.botPos.z);
      state.botAltitudeY = startGroundY;
      keloGroup.position.set(state.botPos.x, startGroundY, state.botPos.z);
      scene.add(keloGroup);
    }

// A small hand at the wrist: a rounded palm, three two-jointed fingers and an opposable thumb.
// s is -1 for the left hand, +1 for the right; the palm faces his body (-s along x).
let _keloHandParts = null;
function buildKeloHand(hand, s, M) {
      if (!_keloHandParts) {
        const seg = (r, len) => new THREE.LatheGeometry(keloCapsuleProfile(r, r * 0.92, len).map(([a, b]) => new THREE.Vector2(a, b)), 8);
        _keloHandParts = {
          palm: keloRoundedBox(0.04, 0.07, 0.078, 0.018, 0.01),
          prox: seg(0.0145, 0.036),
          dist: seg(0.0135, 0.032),
          thumbA: seg(0.015, 0.03),
          thumbB: seg(0.014, 0.028)
        };
      }
      const P = _keloHandParts;
      hand.add(keloMesh(P.palm, M.cover, { pos: [0, -0.048, 0] }));
      const fingers = [];
      [0.024, 0, -0.024].forEach(z => {
        const base = new THREE.Group();
        base.position.set(-s * 0.003, -0.083, z);
        base.add(keloMesh(P.prox, M.cover, { shadow: false }));
        const tip = new THREE.Group();
        tip.position.y = -0.036;
        tip.add(keloMesh(P.dist, M.shell, { shadow: false }));
        base.add(tip);
        hand.add(base);
        fingers.push({ base, tip });
      });
      // the thumb sits at the front edge of the palm, toward the palm side
      const thumb = new THREE.Group();
      thumb.position.set(-s * 0.012, -0.035, 0.038);
      thumb.add(keloMesh(P.thumbA, M.cover, { shadow: false }));
      const thumbTip = new THREE.Group();
      thumbTip.position.y = -0.03;
      thumbTip.add(keloMesh(P.thumbB, M.shell, { shadow: false }));
      thumb.add(thumbTip);
      hand.add(thumb);
      hand.userData = { side: s, fingers, thumb, thumbTip, grip: KELO_REST_GRIP };
      setKeloGrip(hand, KELO_REST_GRIP);
    }

// Curl a hand's fingers: 0 open and spread, 1 a closed fist around a handle
function setKeloGrip(hand, grip) {
      const u = hand && hand.userData;
      if (!u || !u.fingers) return;
      const s = u.side, g = Math.max(0, Math.min(1, grip));
      u.fingers.forEach((f, i) => {
        f.base.rotation.set((1 - i) * 0.12 * (1 - g), 0, -s * (0.08 + g * 1.45));
        f.tip.rotation.z = -s * (0.1 + g * 1.55);
      });
      u.thumb.rotation.set(-0.5 + g * 0.75, 0, -s * (0.35 + g * 0.55));
      u.thumbTip.rotation.z = -s * (0.15 + g * 0.6);
    }

// The middle of a palm (or of a fist) in keloGroup's own coordinates, so carried things sit in his hands
const _keloPalmPoint = new THREE.Vector3();
function keloPalmLocal(hand, out) {
      const s = hand.userData.side || 1;
      out.copy(_keloPalmPoint.set(-s * 0.024, -KELO_PALM, 0.0));
      hand.localToWorld(out);
      return keloGroup.worldToLocal(out);
    }

// --- His face and antenna, every frame --------------------------------------------------------

const keloFace = { mood: 'neutral', w: { happy: 0, sad: 0, sleep: 0 }, blink: 0, nextBlinkAt: 0, blinkStart: -1 };
const _keloAntennaPos = new THREE.Vector3();

// What his face should show: asleep, happy (big ^ ^ eyes and a wide smile), sad (droopy eyes and a
// little frown) or his everyday look
function keloMoodNow(resting) {
      if (resting) return 'sleep';
      const emote = typeof keloEmote !== 'undefined' && keloEmote ? keloEmote.name : '';
      if (/^(wave|cheer|dance|celebrate)$/.test(emote)) return 'happy';
      if (emote === 'shiver') return 'sad';
      if (state.microPose === 'stumble' || (state.happiness ?? 70) < 35 || (state.health ?? 80) < 25) return 'sad';
      if ((state.happiness ?? 70) >= 80) return 'happy';
      return 'neutral';
    }

function updateKeloFace(t, dt, resting) {
      if (!keloLeftEye || !keloLeftEye.userData.open) return;
      const f = keloFace;
      f.mood = keloMoodNow(resting);
      ['happy', 'sad', 'sleep'].forEach(k => { f.w[k] = dampTo(f.w[k], f.mood === k ? 1 : 0, 8, dt); });
      // Blink every few seconds (a quick close and open), now and then twice in a row
      if (t >= f.nextBlinkAt) {
        f.blinkStart = t;
        f.nextBlinkAt = t + (Math.random() < 0.2 ? 0.35 : 2.2 + Math.random() * 3.5);
      }
      const b = t - f.blinkStart;
      const blink = b >= 0 && b < 0.16 ? Math.sin(b / 0.16 * Math.PI) : 0;
      const shut = Math.max(blink, f.w.sleep);
      const { happy, sad } = f.w;
      [keloLeftEye, keloRightEye].forEach(eye => {
        const u = eye.userData;
        // the open eye squashes for a blink or sleep, droops and tilts when sad, and gives way to the arc when happy
        const openK = 1 - happy;
        u.open.visible = openK > 0.05;
        u.arc.visible = happy > 0.05;
        u.open.scale.set(0.95 + 0.1 * sad, Math.max(0.06, (1.2 - 0.45 * sad) * (1 - 0.94 * shut)) * openK + 0.0001, 1);
        u.open.position.y = -0.012 * sad;
        u.open.rotation.z = u.side * 0.3 * sad;
        u.sparkle.visible = shut < 0.5;
        u.arc.scale.setScalar(Math.max(0.0001, happy));
      });
      // smile wide when happy, flip into a frown when sad
      keloMouth.scale.set(1 + 0.45 * happy - 0.2 * sad, (1 + 0.3 * happy) * (1 - 2 * sad), 1);
      // his mouth moves while he talks (js/humanize.js)
      if (typeof keloTalkMouth === 'function') keloMouth.scale.y *= keloTalkMouth(t);
      keloCheeks.forEach(c => { c.material.opacity = 0.35 + 0.45 * happy - 0.25 * sad; });

      // Antenna: a damped spring pushed by how his head speeds up and slows down
      const a = keloAntenna.userData;
      keloAntenna.getWorldPosition(_keloAntennaPos);
      if (dt > 0 && a.last) {
        const vx = (_keloAntennaPos.x - a.last.x) / dt, vy = (_keloAntennaPos.y - a.last.y) / dt, vz = (_keloAntennaPos.z - a.last.z) / dt;
        if (a.lastV && Math.abs(vx) + Math.abs(vy) + Math.abs(vz) < 60) {
          // how hard he accelerated, turned into his own left-right and front-back
          const ax = (vx - a.lastV.x) / dt, ay = (vy - a.lastV.y) / dt, az = (vz - a.lastV.z) / dt;
          const yaw = keloGroup.rotation.y;
          const side = ax * Math.cos(yaw) - az * Math.sin(yaw), fwd = ax * Math.sin(yaw) + az * Math.cos(yaw);
          // (an impulse tuned per 60 fps frame, so scaled by the frame time)
          a.vx += (-fwd * 0.012 + ay * 0.006) * dt * 60;   // a bounce up or down nods it too
          a.vz += side * 0.012 * dt * 60;
        }
        a.lastV = { x: vx, y: vy, z: vz };
        const k = 140, c = 7;
        a.vx += (-k * a.rx - c * a.vx) * dt;
        a.vz += (-k * a.rz - c * a.vz) * dt;
        a.rx = Math.max(-0.6, Math.min(0.6, a.rx + a.vx * dt));
        a.rz = Math.max(-0.6, Math.min(0.6, a.rz + a.vz * dt));
      }
      a.last = _keloAntennaPos.clone();
      keloAntenna.rotation.set(a.rx, 0, -0.12 + a.rz);
    }

// The built-in tools he holds in his right fist: a core drill / auger and a TIG welding torch.
// Their handles run front to back through his fist; the business end points on past his fingers,
// so they aim wherever his forearm points.
function buildKeloHandTools(M) {
      const yellow = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.5, roughness: 0.32 });
      const steel = new THREE.MeshStandardMaterial({ color: 0xb6c2cf, metalness: 0.92, roughness: 0.18 });
      const fist = new THREE.Vector3(-0.02, -0.075, 0);

      keloDrillToolGroup = new THREE.Group();
      keloDrillToolGroup.position.copy(fist);
      keloDrillToolGroup.add(keloMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.15, 10).rotateX(Math.PI / 2), M.rubber));
      keloDrillToolGroup.add(keloMesh(keloRoundedBox(0.09, 0.14, 0.11, 0.03), yellow, { pos: [0, -0.1, 0] }));
      keloDrillToolGroup.add(keloMesh(new THREE.CylinderGeometry(0.032, 0.032, 0.045, 12), M.frame, { pos: [0, -0.19, 0] }));
      // the spinning bit; scene.js turns keloDrillBitMesh about its own z axis, which points down the bit
      const bitHolder = new THREE.Group();
      bitHolder.position.set(0, -0.21, 0);
      bitHolder.rotation.x = Math.PI / 2;
      keloDrillBitMesh = new THREE.Group();
      const shaft = keloMesh(new THREE.CylinderGeometry(0.016, 0.016, 0.32, 8).rotateX(Math.PI / 2), steel, { pos: [0, 0, 0.16] });
      const point = keloMesh(new THREE.ConeGeometry(0.028, 0.07, 8).rotateX(Math.PI / 2), steel, { pos: [0, 0, 0.355] });
      keloDrillBitMesh.add(shaft, point);
      for (let i = 0; i < 5; i++) {
        const flute = keloMesh(new THREE.TorusGeometry(0.029, 0.007, 5, 12), steel, { pos: [0, 0, 0.07 + i * 0.053], shadow: false });
        flute.rotation.x = 0.35;
        flute.rotation.z = i * 1.2;
        keloDrillBitMesh.add(flute);
      }
      bitHolder.add(keloDrillBitMesh);
      keloDrillToolGroup.add(bitHolder);
      keloDrillToolGroup.visible = false;
      keloRightHand.add(keloDrillToolGroup);

      keloWeldTorchGroup = new THREE.Group();
      keloWeldTorchGroup.position.copy(fist);
      const red = new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.3, roughness: 0.45 });
      keloWeldTorchGroup.add(keloMesh(new THREE.CylinderGeometry(0.02, 0.024, 0.17, 10).rotateX(Math.PI / 2), red));
      keloWeldTorchGroup.add(keloCable([[0, 0, -0.08], [0, 0.03, -0.16], [0, 0.11, -0.22]], 0.011, M.rubber));
      // the neck bends from the front of the handle down past his fingers to the nozzle
      keloWeldTorchGroup.add(keloCable([[0, 0, 0.08], [0, -0.045, 0.115], [0, -0.125, 0.105]], 0.012, M.frame));
      keloWeldTorchGroup.add(keloMesh(new THREE.ConeGeometry(0.02, 0.065, 10).rotateX(Math.PI), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.2 }), { pos: [0, -0.155, 0.105] }));
      keloWeldTipGlow = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), new THREE.MeshBasicMaterial({ color: 0x7dd3fc }));
      keloWeldTipGlow.position.set(0, -0.195, 0.105);
      keloWeldTorchGroup.add(keloWeldTipGlow);
      keloWeldTorchGroup.visible = false;
      keloRightHand.add(keloWeldTorchGroup);
    }
