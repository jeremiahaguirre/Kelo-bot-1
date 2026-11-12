// Kelo-bot-1 — js/skins.js
// Loaded right after js/kelo-body.js. Kelo-1's skins: his Classic look plus five original designs.
// A skin only changes how he looks. His skeleton (keloGroup, keloBody, keloHead, the arm and leg
// joints) and every named part stay the same in every skin, so all animation code (js/animations.js,
// kelo-ik.js, kelo-mocap.js, kelo-clips.js, welding/workbench poses) works unchanged.
//
// A skin is { id, name, priceCents, currency, rarity, blurb, palette, parts, proportions }:
//   palette      overrides for his materials by name (js/kelo-body.js KELO_MAT_DEFS: shell, cream,
//                cover, joint, rubber, seam, frame, amber, glass, visor, eye, eyeGlow, shine, cheek,
//                led, id), e.g. { shell: { color: 0xf2f4f7, roughness: 0.3 } }
//   parts(M, rig, add)  adds the skin's own meshes. add(bone, mesh) hangs a mesh in a "skin" group on
//                that bone (rig.head, rig.body, rig.lKnee, rig.lEye...), so it moves with him; the
//                groups are joined per material afterwards and hidden in the through-his-eyes view.
//   proportions  small uniform scales of the parts on a bone: { head: 1.08, body: [1.06, 1, 1.08] }.
//                The bones themselves never scale.
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
    blurb: 'His own teal paint and cream panels.',
    palette: {}, parts: null, proportions: null
  },
  {
    id: 'explorer', name: 'Explorer', priceCents: 99, currency: 'USD', rarity: 'standard',
    blurb: 'White and graphite plates, big ear discs with cyan rings, and extra knee and elbow armour.',
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
    parts(M, R, add) {
      const cyan = skinGlow(0x45e3ff, 1);
      // Big round ear discs over his ears, a cyan ring round each
      const disc = new THREE.CylinderGeometry(0.135, 0.135, 0.04, 28).rotateZ(Math.PI / 2);
      const face = new THREE.CylinderGeometry(0.1, 0.1, 0.012, 24).rotateZ(Math.PI / 2);
      const ring = new THREE.TorusGeometry(0.117, 0.011, 6, 30).rotateY(Math.PI / 2);
      [-1, 1].forEach(s => {
        add(R.head, keloMesh(disc, M.shell, { pos: [s * 0.4, 0.3, -0.01] }));
        add(R.head, keloMesh(face, M.cover, { pos: [s * 0.423, 0.3, -0.01], shadow: false }));
        add(R.head, keloMesh(ring, cyan, { pos: [s * 0.424, 0.3, -0.01] }));
      });
      // Knee caps over the front of each knee, a guard down each shin
      const kneeCap = skinCapGeometry(0.098, 1.15);
      const shinGuard = new THREE.LatheGeometry([[0.084, -0.37], [0.096, -0.31], [0.1, -0.21], [0.098, -0.13]].map(([r, y]) => new THREE.Vector2(r, y)), 14, -0.95, 1.9);
      const elbowCap = skinCapGeometry(0.074, 1.2).rotateY(Math.PI);
      const forearmPlate = new THREE.LatheGeometry([[0.054, -0.25], [0.066, -0.2], [0.07, -0.13], [0.068, -0.08]].map(([r, y]) => new THREE.Vector2(r, y)), 12, Math.PI - 0.9, 1.8);
      ['lKnee', 'rKnee'].forEach(k => {
        add(R[k], keloMesh(kneeCap, M.shell, { pos: [0, -0.025, 0.03] }));
        add(R[k], skinLimbRing(0.088, 0.008, -0.11, cyan));
        add(R[k], keloMesh(shinGuard, M.cover, { pos: [0, 0, 0] }));
      });
      ['lElbow', 'rElbow'].forEach(k => {
        add(R[k], keloMesh(elbowCap, M.shell, { pos: [0, -0.01, -0.012] }));
        add(R[k], keloMesh(forearmPlate, M.cover));
      });
      // Shoulder plates
      const pad = skinCapGeometry(0.108, 1.0).rotateX(-Math.PI / 2);
      ['lArm', 'rArm'].forEach(k => add(R[k], keloMesh(pad, M.cover, { pos: [0, 0.008, 0] })));
    }
  },
  {
    id: 'kitbot', name: 'Kitbot', priceCents: 149, currency: 'USD', rarity: 'rare',
    blurb: 'White with magenta trim, cat-ear fins, chunky headphones and a rainbow chest bar.',
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
    parts(M, R, add) {
      // Cat-ear fins on top of his head, magenta inside
      const tri = (w, h) => {
        const s = new THREE.Shape();
        s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w * 0.12, h); s.lineTo(-w * 0.12, h); s.lineTo(-w / 2, 0);
        const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1, curveSegments: 2 });
        g.translate(0, 0, -0.015);
        return g;
      };
      const fin = tri(0.15, 0.15), inner = tri(0.085, 0.09);
      [-1, 1].forEach(s => {
        const g = new THREE.Group();
        g.position.set(s * 0.165, 0.53, 0.055);
        g.rotation.set(-0.15, 0, -s * 0.38);
        g.add(keloMesh(fin, M.shell));
        g.add(keloMesh(inner, M.amber, { pos: [0, 0.03, 0.021], shadow: false }));
        add(R.head, g);
      });
      // Chunky headphones: big cups and a thick band
      const cup = new THREE.CylinderGeometry(0.14, 0.14, 0.075, 28).rotateZ(Math.PI / 2);
      const pad = new THREE.TorusGeometry(0.112, 0.022, 8, 28).rotateY(Math.PI / 2);
      const cap = new THREE.CylinderGeometry(0.085, 0.085, 0.012, 24).rotateZ(Math.PI / 2);
      [-1, 1].forEach(s => {
        add(R.head, keloMesh(cup, M.shell, { pos: [s * 0.4, 0.3, -0.02] }));
        add(R.head, keloMesh(pad, M.cover, { pos: [s * 0.36, 0.3, -0.02] }));
        add(R.head, keloMesh(cap, M.amber, { pos: [s * 0.441, 0.3, -0.02], shadow: false }));
      });
      const band = keloMesh(new THREE.TorusGeometry(0.4, 0.034, 8, 30, Math.PI), M.amber, { pos: [0, 0.3, -0.035] });
      add(R.head, band);
      // A rainbow bar across his chest
      const seg = keloRoundedBox(0.034, 0.026, 0.012, 0.008, 0.003);
      [0xff5a5a, 0xffa23a, 0xffe14a, 0x5ee07a, 0x4fb3ff, 0xb07aff].forEach((c, i) => {
        add(R.body, skinSurfaceTile(seg, skinGlow(c, 1), R.torsoProfile, R.TSX, R.TSZ, 0.425, -0.28 + i * 0.112, 0.008));
      });
    }
  },
  {
    id: 'marshmallow', name: 'Marshmallow', priceCents: 149, currency: 'USD', rarity: 'rare',
    blurb: 'Soft-touch blush pink, round and puffy, with a warm amber chest button.',
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
    proportions: { body: [1.06, 1, 1.08], head: 1.04 },
    parts(M, R, add) {
      const warm = new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
      // A big amber chest button with a warm glow round it
      const at = keloOnSurface(keloProfileR(R.torsoProfile, 0.3), 0.3, 0, R.TSX, R.TSZ, 0.004);
      const btn = new THREE.Group();
      btn.position.copy(at.p);
      btn.lookAt(at.p.clone().add(at.n));
      btn.add(keloMesh(new THREE.CylinderGeometry(0.058, 0.062, 0.03, 24).rotateX(Math.PI / 2), M.amber, { pos: [0, 0, 0.012] }));
      btn.add(keloMesh(new THREE.TorusGeometry(0.064, 0.008, 6, 24), M.cream, { pos: [0, 0, 0.012], shadow: false }));
      const halo = keloMesh(new THREE.CircleGeometry(0.11, 24), warm, { pos: [0, 0, 0.002], shadow: false });
      halo.renderOrder = 1;
      btn.add(halo);
      add(R.body, btn);
      // Puffy round shoulders, wrists and ankles
      const puffShoulder = new THREE.SphereGeometry(0.104, 18, 12);
      ['lArm', 'rArm'].forEach(k => { const m = keloMesh(puffShoulder, M.shell, { pos: [0, 0.005, 0] }); m.scale.set(1.06, 0.92, 1.06); add(R[k], m); });
      const wristPuff = new THREE.TorusGeometry(0.058, 0.022, 8, 20).rotateX(Math.PI / 2);
      ['lElbow', 'rElbow'].forEach(k => add(R[k], keloMesh(wristPuff, M.cream, { pos: [0, -0.275, 0] })));
      const anklePuff = new THREE.TorusGeometry(0.074, 0.026, 8, 22).rotateX(Math.PI / 2);
      ['lKnee', 'rKnee'].forEach(k => add(R[k], keloMesh(anklePuff, M.cream, { pos: [0, -0.4, 0] })));
      // A soft warm pom on his antenna
      add(R.antenna, keloMesh(new THREE.SphereGeometry(0.058, 16, 12), M.amber, { pos: [0, 0.2, 0] }));
    }
  },
  {
    id: 'twirl', name: 'Twirl', priceCents: 199, currency: 'USD', rarity: 'epic',
    blurb: 'Pearl-white gloss, two curled antenna pigtails with glowing bands, a flared skirt plate and big lashed eyes.',
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
    parts(M, R, add) {
      const glow = skinGlow(0xff9be0, 1);
      const pearlPink = new THREE.MeshPhysicalMaterial({ color: 0xffc9df, metalness: 0.08, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide });
      // Two curled antenna pigtails, swept back from the top of his head, with glowing bands
      [-1, 1].forEach(s => {
        const pts = [[0.17, 0.5, -0.06], [0.26, 0.59, -0.09], [0.36, 0.63, -0.12], [0.45, 0.58, -0.15], [0.48, 0.49, -0.16], [0.44, 0.42, -0.16], [0.38, 0.44, -0.15], [0.37, 0.5, -0.14]]
          .map(([x, y, z]) => new THREE.Vector3(s * x, y, z));
        const curve = new THREE.CatmullRomCurve3(pts);
        add(R.head, keloMesh(new THREE.TubeGeometry(curve, 40, 0.019, 8, false), M.shell));
        [0.22, 0.42, 0.62].forEach(u => {
          const p = curve.getPointAt(u), tg = curve.getTangentAt(u);
          const band = keloMesh(new THREE.TorusGeometry(0.024, 0.007, 6, 16), glow, { shadow: false });
          band.position.copy(p);
          band.lookAt(p.clone().add(tg));
          add(R.head, band);
        });
        add(R.head, keloMesh(new THREE.SphereGeometry(0.03, 12, 8), M.led, { pos: pts[pts.length - 1].toArray() }));
      });
      // A flared skirt plate: the back and sides hang from his hips, the front panels ride on his
      // thighs (so they lift with his legs when he sits instead of cutting through them)
      const P = [[0.31, -0.11], [0.275, -0.065], [0.24, -0.015], [0.218, 0.035]].map(([r, y]) => new THREE.Vector2(r, y));
      const back = new THREE.LatheGeometry(P, 26, 1.85, Math.PI * 2 - 3.7);
      const skirt = keloMesh(back, pearlPink);
      skirt.scale.set(1.05, 1, 0.82);
      add(R.body, skirt);
      add(R.body, (() => { const t = keloMesh(new THREE.TorusGeometry(0.309, 0.009, 5, 26, Math.PI * 2 - 3.7).rotateX(Math.PI / 2).rotateY(1.85 - Math.PI / 2), glow, { pos: [0, -0.11, 0], shadow: false }); t.scale.set(1.05, 1, 0.82); return t; })());
      const front = [[0.15, -0.19], [0.132, -0.12], [0.116, -0.05], [0.108, -0.01]].map(([r, y]) => new THREE.Vector2(r, y));
      [['lLeg', -1], ['rLeg', 1]].forEach(([k, s]) => {
        const g = new THREE.LatheGeometry(front, 12, s > 0 ? -0.2 : -1.45, 1.65);
        add(R[k], keloMesh(g, pearlPink));
      });
      // Big eyes with glowing lashes drawn on the screen
      const lash = new THREE.BoxGeometry(0.009, 0.034, 0.003);
      [R.lEye, R.rEye].forEach(eye => {
        eye.scale.setScalar(1.14);
        const s = eye.userData.side;
        const open = eye.userData.open;
        (s > 0 ? [0.35, 0.75, 1.15] : [Math.PI - 0.35, Math.PI - 0.75, Math.PI - 1.15]).forEach(a => {
          const m = keloMesh(lash, M.eye, { shadow: false });
          m.position.set(Math.cos(a) * 0.072, Math.sin(a) * 0.072, 0.002);
          m.rotation.z = a - Math.PI / 2;
          add(open, m);
        });
      });
    }
  },
  {
    id: 'spark', name: 'Spark', priceCents: 299, currency: 'USD', rarity: 'legendary',
    blurb: 'Brushed silver with a black visor, a slightly bigger head, blue glow rings and blush on his screen.',
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
    proportions: { head: 1.08 },
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
      ['lArm', 'rArm'].forEach(k => add(R[k], skinLimbRing(0.078, 0.007, -0.085, blue)));
      ['lElbow', 'rElbow'].forEach(k => add(R[k], skinLimbRing(0.068, 0.006, -0.07, blue)));
      ['lLeg', 'rLeg'].forEach(k => add(R[k], skinLimbRing(0.106, 0.008, -0.12, blue)));
      ['lKnee', 'rKnee'].forEach(k => add(R[k], skinLimbRing(0.092, 0.007, -0.085, blue)));
      // Blush strokes on his face screen, over the cheek lights
      const stroke = keloRoundedBox(0.008, 0.03, 0.003, 0.003, 0.001);
      const pink = skinGlow(0xff7fae, 1);
      [-1, 1].forEach(s => {
        [-0.07, 0, 0.07].forEach(d => {
          const m = skinSurfaceTile(stroke, pink, R.headProfile, R.HSX, R.HSZ, 0.2, s * (0.5 + d), 0.016);
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
