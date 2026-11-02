// Kelo-1's body: a humanoid robot about 2.8 units tall (1.75 m at the game's 1.6 units to the metre),
// built from plain three.js shapes so there is no model file to license. Loaded just before scene.js,
// which calls buildKelo1Character3D() once the scene exists.
//
// The rig. Other files write these joints' rotations every frame (js/animations.js blends them):
//   keloGroup                 his whole body; feet on the ground at y = 0, facing +z
//   keloBody                  the upper body, hung from his hips at KELO_HIP_Y so it can lean and sway
//   keloHead                  turns at the top of his neck
//   keloLeftArm / Right       shoulder pivots, with keloLeftElbow / Right and keloLeftHand / Right (wrists) below
//   keloLeftLeg / Right       hip pivots, with keloLeftKnee / Right and keloLeftFoot / Right (ankles) below
// His fingers curl with setKeloGrip(hand, 0..1): 0 is an open hand, 1 a tight fist.
// The "left" limbs are on -x and the "right" ones on +x, as they always were (the emotes rely on it).
//
// Looks: teal painted shell panels over a dark slate frame, brushed metal actuators, rubber joints,
// amber trim, and a dark glass face visor with two soft eye lights. Every part shares a handful of
// materials and the left and right limbs share their geometry.

let keloBody;
let keloLeftElbow, keloRightElbow, keloLeftHand, keloRightHand;
let keloLeftKnee, keloRightKnee, keloLeftFoot, keloRightFoot;
const KELO_HIP_Y = 1.44;                       // where his upper body hangs from, above his feet
const KELO_LEG_Y = 1.42;                       // his hip joints (the top of his legs)
const KELO_SHOULDER = { x: 0.35, y: 2.14 };    // shoulder joints, above his feet
const KELO_UPPER_ARM = 0.48, KELO_FOREARM = 0.4, KELO_THIGH = 0.64, KELO_SHIN = 0.65;
const KELO_PALM = 0.075;                       // wrist to the middle of his palm
const KELO_THIGH_R = 0.1;                      // thigh thickness, for sitting on things
const KELO_REST_GRIP = 0.3;                    // fingers loosely curled

// A faint brushed-metal grain, drawn once and shared
function keloBrushedTexture() {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#c8c8c8';
      g.fillRect(0, 0, 64, 256);
      for (let i = 0; i < 420; i++) {
        const v = 170 + Math.floor(Math.random() * 70);
        g.fillStyle = `rgba(${v},${v},${v},0.5)`;
        g.fillRect(0, Math.random() * 256, 64, 0.6 + Math.random() * 1.2);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      return tex;
    }

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
      g.fillStyle = '#fbbf24';
      g.fillText('K-1', 64, 34);
      const tex = new THREE.CanvasTexture(c);
      tex.anisotropy = 4;
      return tex;
    }

function keloMaterials() {
      const brushed = keloBrushedTexture();
      return {
        // Satin painted metal panels in his teal, with a light clear coat
        shell: new THREE.MeshPhysicalMaterial({ color: 0x1d8f8f, metalness: 0.3, roughness: 0.36, clearcoat: 0.55, clearcoatRoughness: 0.3 }),
        // Dark slate satin plastic covers under the panels
        cover: new THREE.MeshStandardMaterial({ color: 0x2a3644, metalness: 0.1, roughness: 0.55 }),
        // Brushed metal for the actuators and the frame
        frame: new THREE.MeshStandardMaterial({ color: 0x8b96a3, metalness: 0.75, roughness: 0.4, map: brushed, roughnessMap: brushed }),
        rubber: new THREE.MeshStandardMaterial({ color: 0x15191e, metalness: 0, roughness: 0.88 }),
        chrome: new THREE.MeshStandardMaterial({ color: 0xd4d9df, metalness: 0.9, roughness: 0.18 }),
        amber: new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.35, roughness: 0.35, emissive: 0x3a1d00, emissiveIntensity: 0.25 }),
        glass: new THREE.MeshPhysicalMaterial({ color: 0x05090f, metalness: 0.25, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.04 }),
        eye: new THREE.MeshBasicMaterial({ color: 0x7ee8fa }),
        led: new THREE.MeshBasicMaterial({ color: 0x34d399 }),
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
      // a slight swelling a third of the way down, like a muscle under the shell
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

// The face visor: a rounded shield shape laid over the front of the helmet, a touch proud of it.
// `grow` widens it (a dark rim behind the glass), `lift` sets how far it stands off the helmet.
function keloVisorGeometry(profile, sx, sz, lift = 0.006, grow = 1) {
      const N = 18, Mv = 12, yc = 0.205, HY = 0.135 * grow, PHI = 1.0 * grow;
      const pos = [], idx = [];
      for (let j = 0; j <= Mv; j++) {
        for (let i = 0; i <= N; i++) {
          const u = -1 + 2 * i / N, v = -1 + 2 * j / Mv;
          // square grid to a disc, so the edge is smooth and round
          const du = u * Math.sqrt(1 - v * v / 2), dv = v * Math.sqrt(1 - u * u / 2);
          const phi = du * PHI * (0.8 + 0.2 * dv);   // narrower toward the chin
          const y = yc + dv * HY;
          const r = keloProfileR(profile, y) + lift / grow;
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

// Where a point on a squashed lathe surface is, and which way it faces (for bolts and badges)
function keloOnSurface(r, y, phi, sx, sz, lift = 0) {
      const n = new THREE.Vector3(Math.sin(phi) / sx, 0, Math.cos(phi) / sz).normalize();
      const p = new THREE.Vector3(r * Math.sin(phi) * sx, y, r * Math.cos(phi) * sz).addScaledVector(n, lift);
      return { p, n };
    }

// Stick a small part on a surface, facing out along n
function keloStick(mesh, parent, p, n) {
      mesh.position.copy(p);
      mesh.lookAt(p.clone().add(n));
      parent.add(mesh);
      return mesh;
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

      const boltGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.008, 6).rotateX(Math.PI / 2);
      const bolt = () => new THREE.Mesh(boltGeo, M.chrome);
      const seamGeo = (r) => new THREE.TorusGeometry(r, 0.0045, 4, 20).rotateX(Math.PI / 2);

      // Pelvis: a dark cover with a teal belt panel at the front and amber trim
      const PSX = 1.12, PSZ = 0.74;
      const pelvisProfile = [[0, -0.16], [0.08, -0.155], [0.15, -0.125], [0.195, -0.06], [0.208, 0.02], [0.2, 0.09], [0.17, 0.14], [0, 0.15]];
      keloBody.add(keloLathe(pelvisProfile, M.cover, { sx: PSX, sz: PSZ, seg: 20 }));
      keloBody.add(keloLathe([[0.17, -0.1], [0.2, -0.05], [0.213, 0.02], [0.205, 0.085]], M.shell, { sx: PSX, sz: PSZ, phi0: -1.05, phiLen: 2.1, seg: 12 }));
      keloBody.add(keloLathe([[0.17, -0.1], [0.2, -0.05], [0.213, 0.02], [0.205, 0.085]], M.shell, { sx: PSX, sz: PSZ, phi0: Math.PI - 0.9, phiLen: 1.8, seg: 10 }));
      const belt = keloMesh(seamGeo(0.207), M.amber, { pos: [0, 0.095, 0] });
      belt.scale.set(PSX, 1, PSZ);
      keloBody.add(belt);

      // Abdomen: rubber bellows that let him bend and twist
      const bellows = [];
      for (let i = 0; i <= 8; i++) bellows.push([i % 2 ? 0.168 : 0.152, 0.12 + i * 0.022]);
      keloBody.add(keloLathe(bellows, M.rubber, { sx: 1.05, sz: 0.74, seg: 18 }));

      // Chest: a dark core with teal panels over it. The gaps between the panels are his seams.
      const CSX = 1.0, CSZ = 0.66;
      const chestCore = [[0, 0.27], [0.15, 0.275], [0.185, 0.31], [0.22, 0.4], [0.248, 0.52], [0.262, 0.62], [0.26, 0.68], [0.245, 0.74], [0.2, 0.79], [0.12, 0.825], [0.06, 0.835], [0, 0.84]];
      keloBody.add(keloLathe(chestCore, M.cover, { sx: CSX, sz: CSZ, seg: 22 }));
      const upperPlate = [[0.236, 0.46], [0.258, 0.53], [0.273, 0.62], [0.271, 0.68], [0.257, 0.74], [0.222, 0.778]];
      const lowerPlate = [[0.192, 0.31], [0.212, 0.36], [0.23, 0.42], [0.238, 0.445]];
      keloBody.add(keloLathe(upperPlate, M.shell, { sx: CSX, sz: CSZ, phi0: -1.2, phiLen: 1.18, seg: 10 }));
      keloBody.add(keloLathe(upperPlate, M.shell, { sx: CSX, sz: CSZ, phi0: 0.02, phiLen: 1.18, seg: 10 }));
      keloBody.add(keloLathe(lowerPlate, M.shell, { sx: CSX, sz: CSZ, phi0: -0.95, phiLen: 1.9, seg: 10 }));
      keloBody.add(keloLathe(upperPlate.concat(), M.shell, { sx: CSX, sz: CSZ, phi0: Math.PI - 1.25, phiLen: 2.5, seg: 12 }));
      // An amber stripe across the top of the chest
      keloBody.add(keloLathe([[0.262, 0.7], [0.264, 0.706], [0.255, 0.74], [0.252, 0.746]], M.amber, { sx: CSX * 1.012, sz: CSZ * 1.012, phi0: -0.62, phiLen: 1.24, seg: 8 }));
      // Bolts at the corners of the chest panels
      [[0.26, 0.5, -1.05], [0.26, 0.5, 1.05], [0.262, 0.72, -1.0], [0.262, 0.72, 1.0], [0.21, 0.36, -0.8], [0.21, 0.36, 0.8]].forEach(([r, y, phi]) => {
        const s = keloOnSurface(r + 0.012, y, phi, CSX, CSZ, 0.002);
        keloStick(bolt(), keloBody, s.p, s.n);
      });
      // His ID on his chest
      const idGeo = new THREE.PlaneGeometry(0.1, 0.05);
      const chestId = keloOnSurface(0.272, 0.6, 0.55, CSX, CSZ, 0.004);
      keloStick(new THREE.Mesh(idGeo, M.id), keloBody, chestId.p, chestId.n);

      // Power pack on his back, with vents, an amber grab handle and his ID again
      const pack = new THREE.Group();
      pack.position.set(0, 0.56, -0.205);
      pack.add(keloMesh(keloRoundedBox(0.34, 0.4, 0.085, 0.05), M.cover));
      for (let i = 0; i < 4; i++) pack.add(keloMesh(new THREE.BoxGeometry(0.2, 0.012, 0.01), M.rubber, { pos: [0, -0.12 + i * 0.03, -0.043], shadow: false }));
      const handle = keloMesh(new THREE.TorusGeometry(0.06, 0.011, 6, 12, Math.PI), M.amber, { pos: [0, 0.2, -0.02], rot: [0, 0, 0] });
      pack.add(handle);
      [[-0.14, 0.17], [0.14, 0.17], [-0.14, -0.17], [0.14, -0.17]].forEach(([x, y]) => {
        const b = bolt(); b.position.set(x, y, -0.044); b.rotation.y = Math.PI; pack.add(b);
      });
      const backId = new THREE.Mesh(idGeo, M.id);
      backId.position.set(0, 0.07, -0.046);
      backId.rotation.y = Math.PI;
      pack.add(backId);
      pack.add(keloMesh(new THREE.SphereGeometry(0.011, 8, 6), M.led, { pos: [0.12, 0.07, -0.045], shadow: false }));
      keloBody.add(pack);

      // Cable bundles from the pack to his neck and shoulders
      keloBody.add(keloCable([[-0.06, 0.74, -0.2], [-0.05, 0.82, -0.16], [-0.035, 0.87, -0.07]], 0.013, M.rubber));
      keloBody.add(keloCable([[0.06, 0.74, -0.2], [0.05, 0.82, -0.16], [0.035, 0.87, -0.07]], 0.013, M.rubber));
      keloBody.add(keloCable([[-0.15, 0.73, -0.19], [-0.24, 0.73, -0.14], [-0.29, 0.7, -0.07]], 0.011, M.rubber));
      keloBody.add(keloCable([[0.15, 0.73, -0.19], [0.24, 0.73, -0.14], [0.29, 0.7, -0.07]], 0.011, M.rubber));

      // Neck: a brushed column with rubber rings and two little pistons in front
      // (a sloped collar of dark cover blends his shoulders into it, like trapezius muscles)
      keloBody.add(keloLathe([[0.2, 0.76], [0.15, 0.81], [0.1, 0.845], [0.08, 0.86]], M.cover, { sx: 1.25, sz: 0.62, seg: 18 }));
      keloBody.add(keloLathe([[0.08, 0.84], [0.074, 0.87], [0.072, 0.96]], M.frame, { seg: 16 }));
      [0.885, 0.925].forEach(y => keloBody.add(keloMesh(seamGeo(0.075), M.rubber, { pos: [0, y, 0], shadow: false })));
      [-1, 1].forEach(s => {
        const rod = keloMesh(new THREE.CylinderGeometry(0.009, 0.009, 0.13, 6), M.chrome, { pos: [s * 0.06, 0.9, 0.068], rot: [0.2, 0, -s * 0.12], shadow: false });
        keloBody.add(rod);
      });

      // --- Head
      keloHead = new THREE.Group();
      keloHead.position.set(0, 0.92, 0);
      keloBody.add(keloHead);
      const HSX = 0.94, HSZ = 1.08;
      const headProfile = [[0, 0.015], [0.06, 0.02], [0.11, 0.05], [0.145, 0.1], [0.161, 0.16], [0.166, 0.22], [0.163, 0.28], [0.152, 0.33], [0.13, 0.37], [0.095, 0.4], [0.05, 0.415], [0, 0.42]];
      keloHead.add(keloLathe(headProfile, M.shell, { sx: HSX, sz: HSZ, seg: 26 }));
      // The face: one rounded dark glass visor from brow to chin, set into the helmet
      keloHead.add(keloMesh(keloVisorGeometry(headProfile, HSX, HSZ), M.glass, { shadow: false }));
      keloHead.add(keloMesh(keloVisorGeometry(headProfile, HSX, HSZ, 0.004, 1.07), M.rubber, { shadow: false }));
      // A dark seam ringing the back of his head
      keloHead.add(keloLathe([[0.167, 0.215], [0.168, 0.225]], M.rubber, { sx: HSX * 1.004, sz: HSZ * 1.004, phi0: 1.1, phiLen: Math.PI * 2 - 2.2, seg: 16, shadow: false }));
      // Two soft eye lights behind the glass
      const eyeGeo = new THREE.SphereGeometry(0.024, 12, 6);
      const eyeAt = s => keloOnSurface(0.171, 0.228, s * 0.36, HSX, HSZ, 0.001);
      const makeEye = s => {
        const e = new THREE.Mesh(eyeGeo, M.eye);
        const { p, n } = eyeAt(s);
        keloStick(e, keloHead, p, n);
        e.scale.set(1.5, 0.5, 0.35);
        return e;
      };
      keloLeftEye = makeEye(-1);
      keloRightEye = makeEye(1);
      // Ear pods with amber rings, and a small sensor antenna on his right
      const earGeo = new THREE.CylinderGeometry(0.052, 0.058, 0.04, 16).rotateZ(Math.PI / 2);
      const earRing = new THREE.TorusGeometry(0.05, 0.006, 5, 18).rotateY(Math.PI / 2);
      [-1, 1].forEach(s => {
        keloHead.add(keloMesh(earGeo, M.frame, { pos: [s * 0.157, 0.215, -0.01] }));
        keloHead.add(keloMesh(earRing, M.amber, { pos: [s * 0.178, 0.215, -0.01], shadow: false }));
        keloHead.add(keloMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 10).rotateZ(Math.PI / 2), M.cover, { pos: [s * 0.18, 0.215, -0.01], shadow: false }));
      });
      keloHead.add(keloMesh(new THREE.CylinderGeometry(0.006, 0.008, 0.16, 6), M.frame, { pos: [0.17, 0.3, -0.03], rot: [0, 0, -0.12], shadow: false }));
      keloHead.add(keloMesh(new THREE.SphereGeometry(0.013, 8, 6), M.led, { pos: [0.18, 0.38, -0.03], shadow: false }));

      // --- Arms
      const shoulderHousing = new THREE.CylinderGeometry(0.085, 0.085, 0.09, 18).rotateZ(Math.PI / 2);
      const shoulderRing = new THREE.TorusGeometry(0.086, 0.008, 5, 20).rotateY(Math.PI / 2);
      const deltoid = new THREE.SphereGeometry(0.108, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.62);
      const upperArmCore = new THREE.LatheGeometry(keloCapsuleProfile(0.062, 0.05, KELO_UPPER_ARM).map(([r, y]) => new THREE.Vector2(r, y)), 14);
      const upperArmShell = new THREE.LatheGeometry([[0.07, -0.36], [0.079, -0.32], [0.084, -0.22], [0.083, -0.14], [0.077, -0.09]].map(([r, y]) => new THREE.Vector2(r, y)), 16);
      const elbowJoint = new THREE.CylinderGeometry(0.052, 0.052, 0.1, 14).rotateZ(Math.PI / 2);
      const elbowCap = new THREE.CylinderGeometry(0.056, 0.056, 0.012, 14).rotateZ(Math.PI / 2);
      const forearmShell = new THREE.LatheGeometry([[0.0, -0.37], [0.045, -0.37], [0.05, -0.34], [0.058, -0.24], [0.066, -0.12], [0.064, -0.06], [0.052, -0.03], [0, -0.025]].map(([r, y]) => new THREE.Vector2(r, y)), 16);
      const forearmStripe = new THREE.LatheGeometry([[0.06, -0.2], [0.0635, -0.16], [0.066, -0.12]].map(([r, y]) => new THREE.Vector2(r * 1.03, y)), 6, -0.35, 0.7);
      const wristJoint = new THREE.SphereGeometry(0.04, 12, 8);
      const cuff = seamGeo(0.047);

      const buildArm = (s, parentX) => {
        // s is -1 for his left arm (on -x) and +1 for his right
        const shoulder = new THREE.Group();
        shoulder.position.set(s * KELO_SHOULDER.x, KELO_SHOULDER.y - KELO_HIP_Y, 0);
        keloBody.add(keloMesh(shoulderHousing, M.frame, { pos: [s * 0.29, KELO_SHOULDER.y - KELO_HIP_Y, 0] }));
        keloBody.add(keloMesh(shoulderRing, M.amber, { pos: [s * 0.255, KELO_SHOULDER.y - KELO_HIP_Y, 0], shadow: false }));
        const cap = keloMesh(deltoid, M.shell, { pos: [s * 0.012, 0.0, 0] });
        cap.scale.set(1, 0.92, 1.0);
        shoulder.add(cap);
        shoulder.add(keloMesh(upperArmCore, M.cover));
        shoulder.add(keloMesh(upperArmShell, M.shell));
        shoulder.add(keloMesh(cuff, M.rubber, { pos: [0, -0.37, 0], shadow: false }));
        // Bicep piston on the inside of the arm
        shoulder.add(keloMesh(new THREE.CylinderGeometry(0.01, 0.01, 0.26, 6), M.chrome, { pos: [-s * 0.055, -0.27, 0.035], shadow: false }));

        const elbow = new THREE.Group();
        elbow.position.set(0, -KELO_UPPER_ARM, 0);
        shoulder.add(elbow);
        elbow.add(keloMesh(elbowJoint, M.rubber));
        [-1, 1].forEach(e => elbow.add(keloMesh(elbowCap, M.frame, { pos: [e * 0.05, 0, 0], shadow: false })));
        elbow.add(keloMesh(forearmShell, M.shell));
        const stripe = keloMesh(forearmStripe, M.amber, { shadow: false });
        stripe.rotation.y = s * Math.PI / 2;  // on the outside of the forearm
        elbow.add(stripe);
        elbow.add(keloMesh(cuff, M.rubber, { pos: [0, -0.365, 0], shadow: false }));

        const hand = new THREE.Group();
        hand.position.set(0, -KELO_FOREARM, 0);
        elbow.add(hand);
        hand.add(keloMesh(wristJoint, M.frame));
        buildKeloHand(hand, s, M);
        return { shoulder, elbow, hand };
      };
      const L = buildArm(-1), R = buildArm(1);
      keloLeftArm = L.shoulder; keloLeftElbow = L.elbow; keloLeftHand = L.hand;
      keloRightArm = R.shoulder; keloRightElbow = R.elbow; keloRightHand = R.hand;
      keloBody.add(keloLeftArm, keloRightArm);

      // --- Legs
      const hipHousing = new THREE.CylinderGeometry(0.09, 0.09, 0.12, 18).rotateZ(Math.PI / 2);
      const thighCore = new THREE.LatheGeometry(keloCapsuleProfile(0.09, 0.07, KELO_THIGH).map(([r, y]) => new THREE.Vector2(r, y)), 14);
      const thighShell = new THREE.LatheGeometry([[0.078, -0.55], [0.09, -0.5], [0.105, -0.36], [0.114, -0.22], [0.112, -0.12], [0.1, -0.06]].map(([r, y]) => new THREE.Vector2(r, y)), 18);
      const kneeJoint = new THREE.CylinderGeometry(0.058, 0.058, 0.13, 16).rotateZ(Math.PI / 2);
      const kneeCap = new THREE.SphereGeometry(0.066, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2);
      const shinShell = new THREE.LatheGeometry([[0.05, -0.55], [0.056, -0.5], [0.068, -0.36], [0.086, -0.2], [0.088, -0.13], [0.078, -0.06], [0.06, -0.03]].map(([r, y]) => new THREE.Vector2(r, y)), 16);
      const shinCore = new THREE.CylinderGeometry(0.045, 0.04, 0.6, 10);
      const shinGuard = new THREE.LatheGeometry([[0.06, -0.5], [0.075, -0.36], [0.092, -0.2], [0.094, -0.13], [0.085, -0.07]].map(([r, y]) => new THREE.Vector2(r, y)), 8, -0.55, 1.1);
      const ankleJoint = new THREE.SphereGeometry(0.052, 12, 8);
      const footGeo = keloFootGeometry(0.135);
      const toeCapGeo = keloToeCapGeometry(0.14);
      const soleGeo = keloSoleGeometry(0.14);
      const legCuff = seamGeo(0.064);

      const buildLeg = s => {
        const hip = new THREE.Group();
        hip.position.set(s * 0.15, KELO_LEG_Y, 0);
        hip.add(keloMesh(hipHousing, M.frame, { pos: [s * 0.01, 0, 0] }));
        hip.add(keloMesh(thighCore, M.cover));
        const shell = keloMesh(thighShell, M.shell);
        shell.scale.set(1, 1, 1.05);
        hip.add(shell);
        hip.add(keloMesh(seamGeo(0.1), M.amber, { pos: [0, -0.06, 0], shadow: false }));
        const knee = new THREE.Group();
        knee.position.set(0, -KELO_THIGH, 0);
        hip.add(knee);
        knee.add(keloMesh(kneeJoint, M.rubber));
        const cap = keloMesh(kneeCap, M.shell, { pos: [0, 0.015, 0.025] });
        cap.scale.set(1, 1.15, 0.8);
        knee.add(cap);
        knee.add(keloMesh(shinCore, M.cover, { pos: [0, -0.3, 0] }));
        knee.add(keloMesh(shinShell, M.shell));
        knee.add(keloMesh(shinGuard, M.cover, { shadow: false }));
        knee.add(keloMesh(legCuff, M.rubber, { pos: [0, -0.56, 0], shadow: false }));
        // Calf piston at the back
        knee.add(keloMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 6), M.chrome, { pos: [0, -0.33, -0.075], shadow: false }));
        const ankle = new THREE.Group();
        ankle.position.set(0, -KELO_SHIN, 0);
        knee.add(ankle);
        ankle.add(keloMesh(ankleJoint, M.frame));
        ankle.add(keloMesh(footGeo, M.cover));
        ankle.add(keloMesh(toeCapGeo, M.shell));
        ankle.add(keloMesh(soleGeo, M.rubber));
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

// The foot, seen from the side: heel at the back, a rounded toe, sitting 0.13 below the ankle
function keloFootGeometry(width) {
      const s = new THREE.Shape();
      s.moveTo(-0.08, -0.112);
      s.lineTo(0.22, -0.112);
      s.quadraticCurveTo(0.275, -0.11, 0.27, -0.07);
      s.quadraticCurveTo(0.25, -0.035, 0.16, -0.02);
      s.quadraticCurveTo(0.08, -0.005, 0.055, 0.03);
      s.lineTo(-0.05, 0.03);
      s.quadraticCurveTo(-0.1, -0.01, -0.08, -0.112);
      const geo = new THREE.ExtrudeGeometry(s, { depth: width - 0.03, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 5 });
      geo.rotateY(-Math.PI / 2);
      geo.translate((width - 0.03) / 2, 0, 0);
      return geo;
    }

// A teal cap over the front of the foot
function keloToeCapGeometry(width) {
      const s = new THREE.Shape();
      s.moveTo(0.1, -0.1);
      s.lineTo(0.235, -0.1);
      s.quadraticCurveTo(0.29, -0.098, 0.283, -0.068);
      s.quadraticCurveTo(0.262, -0.03, 0.165, -0.013);
      s.lineTo(0.1, -0.006);
      s.lineTo(0.1, -0.1);
      const geo = new THREE.ExtrudeGeometry(s, { depth: width - 0.03, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 5 });
      geo.rotateY(-Math.PI / 2);
      geo.translate((width - 0.03) / 2, 0, 0);
      return geo;
    }

// The rubber sole under the foot, with a little toe spring
function keloSoleGeometry(width) {
      const s = new THREE.Shape();
      s.moveTo(-0.095, -0.13);
      s.lineTo(0.24, -0.13);
      s.quadraticCurveTo(0.295, -0.125, 0.285, -0.1);
      s.lineTo(0.27, -0.1);
      s.lineTo(-0.1, -0.1);
      s.lineTo(-0.105, -0.115);
      s.quadraticCurveTo(-0.105, -0.13, -0.095, -0.13);
      const geo = new THREE.ExtrudeGeometry(s, { depth: width - 0.01, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.005, bevelSegments: 1, curveSegments: 3 });
      geo.rotateY(-Math.PI / 2);
      geo.translate((width - 0.01) / 2, 0, 0);
      return geo;
    }

// A hand at the wrist: palm, back plate, four two-jointed fingers and an opposable thumb.
// s is -1 for the left hand, +1 for the right; the palm faces his body (-s along x).
let _keloHandParts = null;
function buildKeloHand(hand, s, M) {
      if (!_keloHandParts) {
        const seg = (r, len) => new THREE.LatheGeometry(keloCapsuleProfile(r, r * 0.9, len).map(([a, b]) => new THREE.Vector2(a, b)), 7);
        _keloHandParts = {
          palm: keloRoundedBox(0.04, 0.095, 0.1, 0.012, 0.008),
          back: keloRoundedBox(0.012, 0.075, 0.085, 0.004, 0.004),
          knuckle: new THREE.CylinderGeometry(0.012, 0.012, 0.095, 8).rotateX(Math.PI / 2),
          prox: [seg(0.0135, 0.048), seg(0.014, 0.052), seg(0.0135, 0.048), seg(0.012, 0.04)],
          dist: [seg(0.012, 0.042), seg(0.0125, 0.045), seg(0.012, 0.042), seg(0.011, 0.034)],
          thumbA: seg(0.015, 0.04),
          thumbB: seg(0.013, 0.038)
        };
      }
      const P = _keloHandParts;
      // the palm block: 0.1 across (front to back) and 0.04 thick
      hand.add(keloMesh(P.palm, M.cover, { pos: [0, -0.065, 0] }));
      hand.add(keloMesh(P.back, M.shell, { pos: [s * 0.021, -0.062, 0], shadow: false }));
      hand.add(keloMesh(P.knuckle, M.frame, { pos: [0, -0.112, 0], shadow: false }));
      const fingers = [];
      [0.036, 0.012, -0.012, -0.036].forEach((z, i) => {
        const base = new THREE.Group();
        base.position.set(-s * 0.004, -0.115, z);
        base.add(keloMesh(P.prox[i], M.rubber, { shadow: false }));
        const tip = new THREE.Group();
        tip.position.y = -(i === 3 ? 0.04 : i === 1 ? 0.052 : 0.048);
        tip.add(keloMesh(P.dist[i], M.cover, { shadow: false }));
        base.add(tip);
        hand.add(base);
        fingers.push({ base, tip });
      });
      // the thumb sits at the front edge of the palm, toward the palm side
      const thumb = new THREE.Group();
      thumb.position.set(-s * 0.016, -0.04, 0.05);
      thumb.add(keloMesh(P.thumbA, M.rubber, { shadow: false }));
      const thumbTip = new THREE.Group();
      thumbTip.position.y = -0.04;
      thumbTip.add(keloMesh(P.thumbB, M.cover, { shadow: false }));
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
        f.base.rotation.set((1.5 - i) * 0.07 * (1 - g), 0, -s * (0.08 + g * 1.45));
        f.tip.rotation.z = -s * (0.1 + g * 1.55);
      });
      u.thumb.rotation.set(-0.5 + g * 0.75, 0, -s * (0.35 + g * 0.55));
      u.thumbTip.rotation.z = -s * (0.15 + g * 0.6);
    }

// The middle of a palm (or of a fist) in keloGroup's own coordinates, so carried things sit in his hands
const _keloPalmPoint = new THREE.Vector3();
function keloPalmLocal(hand, out) {
      const s = hand.userData.side || 1;
      out.copy(_keloPalmPoint.set(-s * 0.03, -KELO_PALM, 0.0));
      hand.localToWorld(out);
      return keloGroup.worldToLocal(out);
    }

// The built-in tools he holds in his right fist: a core drill / auger and a TIG welding torch.
// Their handles run front to back through his fist; the business end points on past his fingers,
// so they aim wherever his forearm points.
function buildKeloHandTools(M) {
      const yellow = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.5, roughness: 0.32 });
      const steel = new THREE.MeshStandardMaterial({ color: 0xb6c2cf, metalness: 0.92, roughness: 0.18 });
      const fist = new THREE.Vector3(-0.025, -0.1, 0);

      keloDrillToolGroup = new THREE.Group();
      keloDrillToolGroup.position.copy(fist);
      keloDrillToolGroup.add(keloMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.17, 10).rotateX(Math.PI / 2), M.rubber));
      keloDrillToolGroup.add(keloMesh(keloRoundedBox(0.1, 0.16, 0.12, 0.03), yellow, { pos: [0, -0.1, 0] }));
      keloDrillToolGroup.add(keloMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 12), M.frame, { pos: [0, -0.2, 0] }));
      // the spinning bit; scene.js turns keloDrillBitMesh about its own z axis, which points down the bit
      const bitHolder = new THREE.Group();
      bitHolder.position.set(0, -0.22, 0);
      bitHolder.rotation.x = Math.PI / 2;
      keloDrillBitMesh = new THREE.Group();
      const shaft = keloMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.36, 8).rotateX(Math.PI / 2), steel, { pos: [0, 0, 0.18] });
      const point = keloMesh(new THREE.ConeGeometry(0.03, 0.08, 8).rotateX(Math.PI / 2), steel, { pos: [0, 0, 0.4] });
      keloDrillBitMesh.add(shaft, point);
      for (let i = 0; i < 5; i++) {
        const flute = keloMesh(new THREE.TorusGeometry(0.032, 0.008, 5, 12), steel, { pos: [0, 0, 0.08 + i * 0.06], shadow: false });
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
      keloWeldTorchGroup.add(keloMesh(new THREE.CylinderGeometry(0.022, 0.026, 0.19, 10).rotateX(Math.PI / 2), red));
      keloWeldTorchGroup.add(keloCable([[0, 0, -0.09], [0, 0.03, -0.18], [0, 0.12, -0.24]], 0.012, M.rubber));
      // the neck bends from the front of the handle down past his fingers to the nozzle
      keloWeldTorchGroup.add(keloCable([[0, 0, 0.09], [0, -0.05, 0.13], [0, -0.14, 0.12]], 0.013, M.frame));
      keloWeldTorchGroup.add(keloMesh(new THREE.ConeGeometry(0.022, 0.07, 10).rotateX(Math.PI), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.2 }), { pos: [0, -0.17, 0.12] }));
      keloWeldTipGlow = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: 0x7dd3fc }));
      keloWeldTipGlow.position.set(0, -0.215, 0.12);
      keloWeldTorchGroup.add(keloWeldTipGlow);
      keloWeldTorchGroup.visible = false;
      keloRightHand.add(keloWeldTorchGroup);
    }
