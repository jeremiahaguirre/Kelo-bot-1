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
const KELO_HIP_Y = 1.06;                       // where his upper body hangs from, above his feet
const KELO_LEG_Y = 1.04;                       // his hip joints (the top of his legs)
const KELO_SHOULDER = { x: 0.33, y: 1.66 };    // shoulder joints, above his feet
const KELO_UPPER_ARM = 0.36, KELO_FOREARM = 0.32, KELO_THIGH = 0.44, KELO_SHIN = 0.45;
const KELO_PALM = 0.055;                       // wrist to the middle of his palm
const KELO_THIGH_R = 0.1;                      // thigh thickness, for sitting on things
const KELO_REST_GRIP = 0.3;                    // fingers loosely curled

// His ID, "K-1", as a small decal
function keloIdTexture() {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 64;
      const g = c.getContext('2d');
      g.font = 'bold 46px Arial, Helvetica, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 6;
      g.strokeStyle = 'rgba(15,23,42,0.85)';
      g.strokeText('K-1', 64, 34);
      g.fillStyle = '#ffb547';
      g.fillText('K-1', 64, 34);
      const tex = new THREE.CanvasTexture(c);
      tex.anisotropy = 4;
      return tex;
    }

function keloMaterials() {
      return {
        // Glossy teal shell, like a soft painted toy
        shell: new THREE.MeshPhysicalMaterial({ color: 0x2bb8ae, metalness: 0.12, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
        // Cream belly and face-frame panels
        cream: new THREE.MeshPhysicalMaterial({ color: 0xf3eee2, metalness: 0.0, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.3 }),
        // Soft slate-blue covers at the joints and the hands
        cover: new THREE.MeshStandardMaterial({ color: 0x3a4a60, metalness: 0.15, roughness: 0.5 }),
        rubber: new THREE.MeshStandardMaterial({ color: 0x232b38, metalness: 0, roughness: 0.85 }),
        frame: new THREE.MeshStandardMaterial({ color: 0x9aa7b5, metalness: 0.7, roughness: 0.35 }),
        amber: new THREE.MeshStandardMaterial({ color: 0xffb547, metalness: 0.2, roughness: 0.35, emissive: 0x4a2400, emissiveIntensity: 0.3 }),
        glass: new THREE.MeshPhysicalMaterial({ color: 0x07101c, metalness: 0.2, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04 }),
        eye: new THREE.MeshBasicMaterial({ color: 0x8ef6ff }),
        shine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
        cheek: new THREE.MeshBasicMaterial({ color: 0xff7fa8, transparent: true, opacity: 0.5, depthWrite: false }),
        led: new THREE.MeshBasicMaterial({ color: 0x5ef0b0 }),
        id: new THREE.MeshBasicMaterial({ map: keloIdTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
      };
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

function buildKelo1Character3D() {
      const M = keloMaterials();
      keloGroup = new THREE.Group();
      keloGroup.name = 'Kelo-1';
      keloBody = new THREE.Group();
      keloBody.position.set(0, KELO_HIP_Y, 0);
      keloGroup.add(keloBody);

      // Pelvis: a soft rounded slate cover with an amber belt line
      const pelvisProfile = [[0, -0.14], [0.09, -0.135], [0.16, -0.1], [0.2, -0.04], [0.21, 0.03], [0.2, 0.09], [0, 0.1]];
      keloBody.add(keloLathe(pelvisProfile, M.cover, { sx: 1.05, sz: 0.82, seg: 20 }));
      const belt = keloMesh(new THREE.TorusGeometry(0.205, 0.012, 6, 28).rotateX(Math.PI / 2), M.amber, { pos: [0, 0.06, 0], shadow: false });
      belt.scale.set(1.05, 1, 0.82);
      keloBody.add(belt);

      // Torso: one round, egg-shaped teal shell with a cream belly panel and his K-1 badge
      const TSX = 1.0, TSZ = 0.82;
      const torsoProfile = [[0, 0.0], [0.17, 0.02], [0.215, 0.08], [0.24, 0.18], [0.245, 0.3], [0.237, 0.42], [0.21, 0.52], [0.16, 0.6], [0.09, 0.645], [0, 0.66]];
      keloBody.add(keloLathe(torsoProfile, M.shell, { sx: TSX, sz: TSZ, seg: 26 }));
      keloBody.add(keloMesh(keloPatchGeometry(torsoProfile, TSX, TSZ, { yc: 0.26, hy: 0.19, phi: 0.78 }, 0.004, 0.1), M.cream, { shadow: false }));
      const idAt = keloOnSurface(0.225, 0.5, 0.5, TSX, TSZ, 0.008);
      keloStick(new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.075), M.id), keloBody, idAt.p, idAt.n);
      // A tiny heart-light in the middle of his chest
      const heartAt = keloOnSurface(0.24, 0.3, 0.0, TSX, TSZ, 0.008);
      keloStick(keloMesh(new THREE.CircleGeometry(0.022, 14), M.amber, { shadow: false }), keloBody, heartAt.p, heartAt.n);

      // A little backpack with an amber grab handle and a status light
      const pack = new THREE.Group();
      pack.position.set(0, 0.34, -0.2);
      pack.add(keloMesh(keloRoundedBox(0.28, 0.3, 0.1, 0.07, 0.025), M.cover));
      pack.add(keloMesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), M.amber, { pos: [0, 0.15, -0.02] }));
      pack.add(keloMesh(new THREE.SphereGeometry(0.014, 8, 6), M.led, { pos: [0.08, 0.07, -0.052], shadow: false }));
      const backId = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.05), M.id);
      backId.position.set(0, -0.02, -0.052);
      backId.rotation.y = Math.PI;
      pack.add(backId);
      keloBody.add(pack);

      // Neck: short and soft
      keloBody.add(keloLathe([[0.09, 0.6], [0.078, 0.64], [0.075, 0.73]], M.rubber, { seg: 16 }));

      // --- Head: big and round, with a face screen, headphone ears and an antenna
      keloHead = new THREE.Group();
      keloHead.position.set(0, 0.71, 0);
      keloBody.add(keloHead);
      const HSX = 1.1, HSZ = 0.98;
      const headProfile = [[0, 0.0], [0.12, 0.01], [0.215, 0.05], [0.278, 0.12], [0.303, 0.21], [0.31, 0.3], [0.302, 0.39], [0.272, 0.47], [0.215, 0.545], [0.125, 0.598], [0, 0.615]];
      keloHead.add(keloLathe(headProfile, M.shell, { sx: HSX, sz: HSZ, seg: 30 }));
      // a cream frame around the screen, then the dark glass screen itself
      keloHead.add(keloMesh(keloPatchGeometry(headProfile, HSX, HSZ, { yc: 0.275, hy: 0.215, phi: 1.12 }, 0.004, 0.25), M.cream, { shadow: false }));
      keloHead.add(keloMesh(keloPatchGeometry(headProfile, HSX, HSZ, { yc: 0.275, hy: 0.185, phi: 1.0 }, 0.008, 0.25), M.glass, { shadow: false }));

      // Big glowing eyes: an open oval with a sparkle, and a "^" arc for when he is happy
      const eyeOval = new THREE.CircleGeometry(0.058, 24);
      const eyeArc = new THREE.TorusGeometry(0.048, 0.014, 6, 16, Math.PI);
      const sparkle = new THREE.CircleGeometry(0.016, 10);
      const makeEye = s => {
        const eye = new THREE.Group();
        const open = new THREE.Group();
        open.add(new THREE.Mesh(eyeOval, M.eye));
        const sp = new THREE.Mesh(sparkle, M.shine);
        sp.position.set(-0.018, 0.026, 0.002);
        open.add(sp);
        const arc = new THREE.Mesh(eyeArc, M.eye);
        arc.position.y = -0.02;
        arc.visible = false;
        eye.add(open, arc);
        eye.userData = { open, arc, side: s };
        const { p, n } = keloOnSurface(0.31, 0.3, s * 0.37, HSX, HSZ, 0.011);
        return keloStick(eye, keloHead, p, n);
      };
      keloLeftEye = makeEye(-1);
      keloRightEye = makeEye(1);
      // A small smile under the eyes (flipped into a frown when he is sad)
      keloMouth = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.009, 5, 14, Math.PI), M.eye);
      const mouthAt = keloOnSurface(0.3, 0.17, 0, HSX, HSZ, 0.011);
      keloStick(keloMouth, keloHead, mouthAt.p, mouthAt.n);
      keloMouth.rotateZ(Math.PI);  // the arc's open side up: a smile
      // Rosy cheek lights
      keloCheeks = [-1, 1].map(s => {
        const c = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), M.cheek);
        const { p, n } = keloOnSurface(0.305, 0.205, s * 0.62, HSX, HSZ, 0.012);
        keloStick(c, keloHead, p, n);
        c.scale.set(1.35, 0.8, 1);
        return c;
      });

      // Headphone ears joined by a band over the top of his head
      const earCup = new THREE.LatheGeometry([[0, -0.045], [0.08, -0.045], [0.1, -0.03], [0.105, 0], [0.1, 0.03], [0.08, 0.045], [0, 0.045]].map(([r, y]) => new THREE.Vector2(r, y)), 22).rotateZ(Math.PI / 2);
      const earRing = new THREE.TorusGeometry(0.075, 0.012, 6, 22).rotateY(Math.PI / 2);
      [-1, 1].forEach(s => {
        keloHead.add(keloMesh(earCup, M.cover, { pos: [s * 0.345, 0.3, -0.01] }));
        keloHead.add(keloMesh(earRing, M.amber, { pos: [s * 0.39, 0.3, -0.01], shadow: false }));
        keloHead.add(keloMesh(new THREE.CircleGeometry(0.04, 14).rotateY(s * Math.PI / 2), M.shell, { pos: [s * 0.394, 0.3, -0.01], shadow: false }));
      });
      const band = keloMesh(new THREE.TorusGeometry(0.345, 0.024, 6, 26, Math.PI), M.cover, { pos: [0, 0.3, -0.03] });
      band.scale.set(1, 0.97, 1);
      keloHead.add(band);

      // The antenna: a springy stalk with a glowing ball on top that bobs as he moves
      keloAntenna = new THREE.Group();
      keloAntenna.position.set(0.05, 0.6, -0.02);
      keloAntenna.rotation.z = -0.12;
      keloAntenna.add(keloMesh(new THREE.CylinderGeometry(0.009, 0.013, 0.17, 8), M.frame, { pos: [0, 0.085, 0], shadow: false }));
      keloAntenna.add(keloMesh(new THREE.SphereGeometry(0.038, 14, 10), M.led, { pos: [0, 0.19, 0] }));
      keloAntenna.userData = { rx: 0, rz: 0, vx: 0, vz: 0, last: null, lastV: null };
      keloHead.add(keloAntenna);

      // --- Arms: soft rounded capsules with ball joints and small hands
      const shoulderBall = new THREE.SphereGeometry(0.088, 18, 12);
      const upperArm = new THREE.LatheGeometry(keloCapsuleProfile(0.07, 0.058, KELO_UPPER_ARM - 0.03, 0.006).map(([r, y]) => new THREE.Vector2(r, y)), 16);
      const elbowBall = new THREE.SphereGeometry(0.056, 14, 10);
      const forearm = new THREE.LatheGeometry(keloCapsuleProfile(0.064, 0.05, KELO_FOREARM - 0.05, 0.008).map(([r, y]) => new THREE.Vector2(r, y)), 16);
      const cuff = new THREE.TorusGeometry(0.05, 0.011, 6, 18).rotateX(Math.PI / 2);
      const wristBall = new THREE.SphereGeometry(0.034, 10, 8);

      const buildArm = s => {
        // s is -1 for his left arm (on -x) and +1 for his right
        const shoulder = new THREE.Group();
        shoulder.position.set(s * KELO_SHOULDER.x, KELO_SHOULDER.y - KELO_HIP_Y, 0);
        shoulder.add(keloMesh(shoulderBall, M.shell));
        const up = keloMesh(upperArm, M.shell, { pos: [0, -0.02, 0] });
        shoulder.add(up);
        const elbow = new THREE.Group();
        elbow.position.set(0, -KELO_UPPER_ARM, 0);
        shoulder.add(elbow);
        elbow.add(keloMesh(elbowBall, M.cover));
        elbow.add(keloMesh(forearm, M.shell, { pos: [0, -0.025, 0] }));
        elbow.add(keloMesh(cuff, M.amber, { pos: [0, -KELO_FOREARM + 0.04, 0], shadow: false }));
        const hand = new THREE.Group();
        hand.position.set(0, -KELO_FOREARM, 0);
        elbow.add(hand);
        hand.add(keloMesh(wristBall, M.cover));
        buildKeloHand(hand, s, M);
        return { shoulder, elbow, hand };
      };
      const L = buildArm(-1), R = buildArm(1);
      keloLeftArm = L.shoulder; keloLeftElbow = L.elbow; keloLeftHand = L.hand;
      keloRightArm = R.shoulder; keloRightElbow = R.elbow; keloRightHand = R.hand;
      keloBody.add(keloLeftArm, keloRightArm);

      // --- Legs: short and sturdy, with round knees and chunky rounded boots
      const hipBall = new THREE.SphereGeometry(0.095, 16, 12);
      const thigh = new THREE.LatheGeometry(keloCapsuleProfile(0.1, 0.082, KELO_THIGH - 0.04, 0.01).map(([r, y]) => new THREE.Vector2(r, y)), 18);
      const kneeBall = new THREE.SphereGeometry(0.075, 14, 10);
      const shin = new THREE.LatheGeometry(keloCapsuleProfile(0.085, 0.07, KELO_SHIN - 0.08, 0.012).map(([r, y]) => new THREE.Vector2(r, y)), 18);
      const ankleBall = new THREE.SphereGeometry(0.05, 12, 8);
      const ankleY = KELO_LEG_Y - KELO_THIGH - KELO_SHIN;   // how high his ankles are above the ground
      // the boot: the top half of a squashed ball, long toward the toe, on a flat rubber sole
      const boot = new THREE.SphereGeometry(1, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      const sole = new THREE.CylinderGeometry(1, 1, 1, 22);

      const buildLeg = s => {
        const hip = new THREE.Group();
        hip.position.set(s * 0.12, KELO_LEG_Y, 0);
        hip.add(keloMesh(hipBall, M.cover));
        hip.add(keloMesh(thigh, M.shell, { pos: [0, -0.02, 0] }));
        const knee = new THREE.Group();
        knee.position.set(0, -KELO_THIGH, 0);
        hip.add(knee);
        knee.add(keloMesh(kneeBall, M.cover));
        knee.add(keloMesh(shin, M.shell, { pos: [0, -0.04, 0] }));
        const ankle = new THREE.Group();
        ankle.position.set(0, -KELO_SHIN, 0);
        knee.add(ankle);
        ankle.add(keloMesh(ankleBall, M.cover));
        const b = keloMesh(boot, M.shell, { pos: [0, -ankleY + 0.025, 0.05] });
        b.scale.set(0.115, 0.13, 0.19);
        ankle.add(b);
        const so = keloMesh(sole, M.rubber, { pos: [0, -ankleY + 0.0125, 0.05] });
        so.scale.set(0.12, 0.025, 0.195);
        ankle.add(so);
        keloGroup.add(hip);
        return { hip, knee, ankle };
      };
      const LL = buildLeg(-1), RL = buildLeg(1);
      keloLeftLeg = LL.hip; keloLeftKnee = LL.knee; keloLeftFoot = LL.ankle;
      keloRightLeg = RL.hip; keloRightKnee = RL.knee; keloRightFoot = RL.ankle;

      buildKeloHandTools(M);

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
        u.open.children[1].visible = shut < 0.5;
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
          a.vx += -fwd * 0.012 + ay * 0.006;   // a bounce up or down nods it too
          a.vz += side * 0.012;
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
