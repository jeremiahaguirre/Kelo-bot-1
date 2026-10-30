// Kelo-bot-1 — js/items3d.js
// Loaded after scene.js. Turns an item's name ("A basket of Okanagan cherries", "A canoe",
// "A larger island to explore") into a small 3D model, so deliveries waiting at the post office
// and things Kelo-1 carries look like what they are. Unknown items become a labelled gift box.

const ITEM_MODEL_RULES = [
  [/cherr/, () => fruitBunch(0xb91c1c, 0.12, 5)],
  [/apple/, () => fruitBunch(0xdc2626, 0.17, 3)],
  [/peach|apricot/, () => fruitBunch(0xffa36c, 0.17, 3)],
  [/blueberr|grape/, () => fruitBunch(0x3b4cca, 0.08, 9)],
  [/bread|loaf|sourdough|baguette|bun|croissant/, () => {
    const loaf = mesh(new THREE.SphereGeometry(0.3, 14, 10), 0xd6a35c);
    loaf.scale.set(1.5, 0.75, 0.9);
    loaf.position.y = 0.22;
    return group(loaf);
  }],
  [/tart|pie|cobbler|cake|cookie/, () => {
    const base = mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.16, 18), 0xe9b872);
    base.position.y = 0.08;
    const top = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 18), 0x9a3412);
    top.position.y = 0.17;
    return group(base, top);
  }],
  [/ramen|noodle|soup|stew|bowl/, () => {
    const bowl = mesh(new THREE.SphereGeometry(0.32, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0xf8fafc, { side: THREE.DoubleSide });
    bowl.position.y = 0.32;
    const broth = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 16), 0xf59e0b);
    broth.position.y = 0.3;
    const egg = mesh(new THREE.SphereGeometry(0.07, 8, 8), 0xfef08a);
    egg.position.set(0.1, 0.33, 0.05);
    return group(bowl, broth, egg);
  }],
  [/cheese|cheddar/, () => {
    const wedge = extruded([[0, 0], [0.6, 0], [0, 0.35]], 0.35, 0xfacc15);
    return group(wedge);
  }],
  [/pizza/, () => group(extruded([[0, 0], [0.6, 0.18], [0.6, -0.18]], 0.05, 0xf59e0b))],
  [/fudge|chocolate|brownie/, () => {
    const g = group();
    for (let i = 0; i < 4; i++) {
      const b = mesh(new THREE.BoxGeometry(0.18, 0.12, 0.18), 0x5b3a1e);
      b.position.set((i % 2) * 0.2 - 0.1, 0.06 + Math.floor(i / 2) * 0.12, 0);
      g.add(b);
    }
    return g;
  }],
  [/cocoa|coffee|tea|thermos|juice|milk/, () => {
    const cup = mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.4, 14), 0x0ea5e9);
    cup.position.y = 0.2;
    const lid = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 14), 0x1e293b);
    lid.position.y = 0.43;
    return group(cup, lid);
  }],
  [/salmon|fish/, () => {
    const body = mesh(new THREE.SphereGeometry(0.2, 14, 10), 0xfb7185);
    body.scale.set(2, 0.7, 0.6);
    body.position.y = 0.16;
    const tail = mesh(new THREE.ConeGeometry(0.14, 0.2, 4), 0xfb7185);
    tail.rotation.z = Math.PI / 2;
    tail.position.set(-0.46, 0.16, 0);
    return group(body, tail);
  }],
  [/carrot/, () => {
    const c = mesh(new THREE.ConeGeometry(0.08, 0.45, 8), 0xf97316);
    c.rotation.z = Math.PI / 2;
    c.position.y = 0.1;
    const leaf = mesh(new THREE.ConeGeometry(0.06, 0.2, 4), 0x4ade80);
    leaf.rotation.z = -Math.PI / 2;
    leaf.position.set(0.3, 0.1, 0);
    return group(c, leaf);
  }],
  [/kite/, () => {
    const sail = extruded([[0, 0.5], [0.3, 0], [0, -0.5], [-0.3, 0]], 0.02, 0xef4444);
    sail.rotation.x = -Math.PI / 2.4;
    sail.position.y = 0.45;
    const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.1, 0.15), new THREE.Vector3(0.15, 0.05, 0.35), new THREE.Vector3(-0.1, 0.02, 0.55)]), 12, 0.015, 5), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
    return group(sail, tail);
  }],
  [/yo-?yo/, () => {
    const a = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 18), 0x22c55e);
    a.rotation.x = Math.PI / 2;
    a.position.set(0, 0.17, 0.05);
    const b = a.clone();
    b.position.z = -0.05;
    return group(a, b);
  }],
  [/kaleidoscope|telescope|spyglass/, () => {
    const tube = mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.6, 12), 0xa855f7, { metalness: 0.5 });
    tube.rotation.z = Math.PI / 2.6;
    tube.position.y = 0.2;
    return group(tube);
  }],
  [/ball|juggl|marble/, () => fruitBunch(0xf43f5e, 0.1, 3, [0x22c55e, 0x3b82f6, 0xf43f5e])],
  [/duck/, () => {
    const body = mesh(new THREE.SphereGeometry(0.2, 12, 10), 0xfacc15);
    body.position.y = 0.18;
    const head = mesh(new THREE.SphereGeometry(0.12, 12, 10), 0xfacc15);
    head.position.set(0.15, 0.38, 0);
    const beak = mesh(new THREE.ConeGeometry(0.04, 0.1, 6), 0xf97316);
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.3, 0.37, 0);
    return group(body, head, beak);
  }],
  [/spinning top|\btop\b/, () => {
    const top = mesh(new THREE.ConeGeometry(0.2, 0.3, 14), 0x06b6d4);
    top.rotation.x = Math.PI;
    top.position.y = 0.2;
    return group(top);
  }],
  [/frog/, () => {
    const body = mesh(new THREE.SphereGeometry(0.18, 12, 10), 0x16a34a);
    body.scale.set(1.2, 0.8, 1);
    body.position.y = 0.14;
    const e1 = mesh(new THREE.SphereGeometry(0.06, 8, 8), 0x16a34a);
    e1.position.set(0.1, 0.27, 0.08);
    const e2 = e1.clone();
    e2.position.z = -0.08;
    return group(body, e1, e2);
  }],
  [/puzzle|cube|block|lego/, () => {
    const g = group();
    const colors = [0xef4444, 0x22c55e, 0x3b82f6, 0xfacc15];
    for (let i = 0; i < 8; i++) {
      const c = mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), colors[i % 4]);
      c.position.set((i % 2) * 0.15 - 0.075, 0.08 + Math.floor(i / 4) * 0.15, (Math.floor(i / 2) % 2) * 0.15 - 0.075);
      g.add(c);
    }
    return g;
  }],
  [/harmonica/, () => {
    const body = mesh(new THREE.BoxGeometry(0.45, 0.08, 0.12), 0xcbd5e1, { metalness: 0.8 });
    body.position.y = 0.05;
    return group(body);
  }],
  [/drill/, () => {
    const body = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.4, 12), 0xf59e0b);
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.3;
    const bit = mesh(new THREE.ConeGeometry(0.06, 0.3, 8), 0x94a3b8, { metalness: 0.8 });
    bit.rotation.z = -Math.PI / 2;
    bit.position.set(0.35, 0.3, 0);
    const grip = mesh(new THREE.BoxGeometry(0.1, 0.28, 0.1), 0x1f2937);
    grip.position.set(-0.05, 0.13, 0);
    return group(body, bit, grip);
  }],
  [/rope|cable|wire/, (lower) => {
    const coil = mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 24), /wire|copper/.test(lower) ? 0xb45309 : 0xd6a35c);
    coil.rotation.x = Math.PI / 2;
    coil.position.y = 0.06;
    const coil2 = coil.clone();
    coil2.position.y = 0.15;
    return group(coil, coil2);
  }],
  [/magnif/, () => {
    const ring = mesh(new THREE.TorusGeometry(0.15, 0.03, 8, 20), 0x1f2937);
    ring.position.y = 0.3;
    const lens = mesh(new THREE.CircleGeometry(0.14, 20), 0xbae6fd, { transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    lens.position.y = 0.3;
    const handle = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 8), 0x7c2d12);
    handle.position.y = 0.06;
    return group(ring, lens, handle);
  }],
  [/compass/, () => {
    const disc = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20), 0xb45309, { metalness: 0.6 });
    disc.position.y = 0.03;
    const needle = mesh(new THREE.BoxGeometry(0.3, 0.02, 0.04), 0xdc2626);
    needle.position.y = 0.07;
    return group(disc, needle);
  }],
  [/microphone|mic\b/, () => {
    const head = mesh(new THREE.SphereGeometry(0.1, 12, 10), 0x64748b, { metalness: 0.6 });
    head.position.y = 0.42;
    const stick = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.35, 10), 0x1f2937);
    stick.position.y = 0.18;
    return group(head, stick);
  }],
  [/paint|watercolor|brush/, () => {
    const box = mesh(new THREE.BoxGeometry(0.5, 0.06, 0.3), 0x1e293b);
    box.position.y = 0.03;
    const g = group(box);
    [0xef4444, 0xf59e0b, 0x22c55e, 0x3b82f6, 0xa855f7].forEach((c, i) => {
      const dot = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 10), c);
      dot.position.set(-0.18 + i * 0.09, 0.07, 0);
      g.add(dot);
    });
    return g;
  }],
  [/headlamp|lamp|lantern|flashlight/, () => {
    const lamp = mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.2, 12), 0x334155);
    lamp.position.y = 0.1;
    const glow = mesh(new THREE.SphereGeometry(0.09, 10, 8), 0xfef08a, { emissive: 0xfacc15, emissiveIntensity: 0.9 });
    glow.position.y = 0.24;
    return group(lamp, glow);
  }],
  [/hammer|wrench|multitool|pliers|knife|saw|iron|tool/, () => {
    const handle = mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), 0x7c2d12);
    handle.position.y = 0.2;
    const head = mesh(new THREE.BoxGeometry(0.25, 0.1, 0.1), 0x94a3b8, { metalness: 0.8 });
    head.position.y = 0.42;
    return group(handle, head);
  }],
  [/canoe|kayak|boat/, () => {
    const hull = mesh(new THREE.SphereGeometry(0.25, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0xb45309, { side: THREE.DoubleSide });
    hull.scale.set(3, 0.8, 0.9);
    hull.position.y = 0.2;
    return group(hull);
  }],
  [/balloon/, () => {
    const env = mesh(new THREE.SphereGeometry(0.3, 16, 12), 0xef4444);
    env.scale.y = 1.2;
    env.position.y = 0.7;
    const basket = mesh(new THREE.BoxGeometry(0.18, 0.14, 0.18), 0x92400e);
    basket.position.y = 0.1;
    return group(env, basket);
  }],
  [/bike|bicycle/, () => {
    const w1 = mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 20), 0x1f2937);
    w1.position.set(-0.22, 0.17, 0);
    const w2 = w1.clone();
    w2.position.x = 0.22;
    const frame = mesh(new THREE.BoxGeometry(0.44, 0.04, 0.04), 0x0ea5e9);
    frame.position.y = 0.3;
    return group(w1, w2, frame);
  }],
  [/submarine/, () => {
    const hull = mesh(new THREE.SphereGeometry(0.2, 14, 10), 0xfacc15);
    hull.scale.set(2.2, 1, 1);
    hull.position.y = 0.22;
    const tower = mesh(new THREE.BoxGeometry(0.14, 0.14, 0.1), 0xfacc15);
    tower.position.y = 0.44;
    return group(hull, tower);
  }],
  [/island|land|territory/, () => {
    const water = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 24), 0x0ea5e9);
    water.position.y = 0.02;
    const isle = mesh(new THREE.SphereGeometry(0.25, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x22c55e);
    isle.position.y = 0.04;
    const tree = mesh(new THREE.ConeGeometry(0.06, 0.2, 6), 0x166534);
    tree.position.y = 0.36;
    return group(water, isle, tree);
  }],
  [/treehouse|cabin|house|observatory|tower/, () => {
    const hut = mesh(new THREE.BoxGeometry(0.35, 0.3, 0.35), 0xa16207);
    hut.position.y = 0.15;
    const roof = mesh(new THREE.ConeGeometry(0.3, 0.22, 4), 0x7c2d12);
    roof.position.y = 0.41;
    roof.rotation.y = Math.PI / 4;
    return group(hut, roof);
  }],
  [/dock|pier|plank|cedar|wood|lumber/, () => {
    const g = group();
    for (let i = 0; i < 4; i++) {
      const plank = mesh(new THREE.BoxGeometry(0.6, 0.05, 0.12), 0xb7793e);
      plank.position.set(0, 0.03 + (i % 2) * 0.05, i * 0.13 - 0.2);
      g.add(plank);
    }
    return g;
  }],
  [/goat|sheep/, () => {
    const body = mesh(new THREE.BoxGeometry(0.4, 0.22, 0.2), 0xf1f5f9);
    body.position.y = 0.3;
    const head = mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), 0xf1f5f9);
    head.position.set(0.26, 0.42, 0);
    const g = group(body, head);
    [[-0.14, -0.07], [-0.14, 0.07], [0.14, -0.07], [0.14, 0.07]].forEach(([x, z]) => {
      const leg = mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), 0x64748b);
      leg.position.set(x, 0.1, z);
      g.add(leg);
    });
    return g;
  }],
  [/pigeon|bird/, () => {
    const body = mesh(new THREE.SphereGeometry(0.14, 12, 10), 0x94a3b8);
    body.scale.set(1.3, 1, 1);
    body.position.y = 0.16;
    const head = mesh(new THREE.SphereGeometry(0.07, 10, 8), 0x64748b);
    head.position.set(0.16, 0.28, 0);
    return group(body, head);
  }],
  [/jellyfish/, () => {
    const dome = mesh(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xf0abfc, { emissive: 0xc026d3, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 });
    dome.position.y = 0.3;
    return group(dome);
  }],
  [/glass/, () => {
    const g = group();
    [0xef4444, 0x3b82f6, 0x22c55e].forEach((c, i) => {
      const pane = mesh(new THREE.BoxGeometry(0.3, 0.4, 0.02), c, { transparent: true, opacity: 0.7 });
      pane.position.set(i * 0.08 - 0.08, 0.2, i * 0.05);
      g.add(pane);
    });
    return g;
  }],
  [/clay|mud/, () => {
    const blob = mesh(new THREE.DodecahedronGeometry(0.2, 1), 0x9a5b34, { flatShading: true });
    blob.scale.y = 0.6;
    blob.position.y = 0.12;
    return group(blob);
  }]
];

function mesh(geometry, color, extra = {}) {
      const m = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra }));
      m.castShadow = true;
      return m;
    }

function group(...children) {
      const g = new THREE.Group();
      children.forEach(c => g.add(c));
      return g;
    }

function extruded(points, depth, color) {
      const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
      const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
      geo.translate(0, 0, -depth / 2);
      const m = mesh(geo, color);
      m.rotation.x = -Math.PI / 2;
      m.position.y = depth / 2;
      return m;
    }

function fruitBunch(color, radius, count, palette = null) {
      const g = group();
      for (let i = 0; i < count; i++) {
        const fruit = mesh(new THREE.SphereGeometry(radius, 12, 10), palette ? palette[i % palette.length] : color);
        const a = (i / count) * Math.PI * 2;
        const ring = count > 3 ? radius * 1.6 : radius * 1.1;
        fruit.position.set(Math.cos(a) * ring, radius + (i % 2) * radius * 0.6, Math.sin(a) * ring);
        g.add(fruit);
      }
      if (!palette) {
        const stem = mesh(new THREE.CylinderGeometry(0.01, 0.01, radius * 1.4, 4), 0x3f6212);
        stem.position.y = radius * 2.4;
        g.add(stem);
      }
      return g;
    }

function giftBox() {
      const box = mesh(new THREE.BoxGeometry(0.4, 0.32, 0.4), 0xa855f7);
      box.position.y = 0.16;
      const ribbonA = mesh(new THREE.BoxGeometry(0.42, 0.33, 0.06), 0xfacc15);
      ribbonA.position.y = 0.16;
      const ribbonB = mesh(new THREE.BoxGeometry(0.06, 0.33, 0.42), 0xfacc15);
      ribbonB.position.y = 0.16;
      const bow = mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 12), 0xfacc15);
      bow.position.y = 0.36;
      return group(box, ribbonA, ribbonB, bow);
    }

function envelopeModel() {
      const env = mesh(new THREE.BoxGeometry(0.42, 0.03, 0.28), 0xf8fafc);
      env.position.y = 0.02;
      const stamp = mesh(new THREE.BoxGeometry(0.07, 0.01, 0.07), 0xdc2626);
      stamp.position.set(0.15, 0.04, -0.08);
      return group(env, stamp);
    }

function photoFrameModel(thumbDataUrl) {
      const frame = mesh(new THREE.BoxGeometry(0.42, 0.34, 0.04), 0x78350f);
      frame.position.y = 0.2;
      const g = group(frame);
      if (thumbDataUrl) {
        const tex = new THREE.TextureLoader().load(thumbDataUrl);
        const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.28), new THREE.MeshBasicMaterial({ map: tex }));
        pic.position.set(0, 0.2, 0.025);
        g.add(pic);
      }
      return g;
    }

// A model for any named item, with its name on a small label above it
function buildItemModel3D(name, { kind = 'gift', thumb = null, label = true } = {}) {
      let model;
      if (kind === 'message') model = envelopeModel();
      else if (kind === 'photo') model = photoFrameModel(thumb);
      else {
        const lower = String(name || '').toLowerCase();
        const rule = ITEM_MODEL_RULES.find(([re]) => re.test(lower));
        model = rule ? rule[1](lower) : giftBox();
      }
      if (label && name) {
        const text = String(name).replace(/^(an?|the|some)\s+/i, '').slice(0, 22).toUpperCase();
        const tag = makeSignMesh(text, { bg: '#fff7ed', fg: '#7c2d12', width: 0.75, height: 0.16 });
        tag.position.y = 0.8;
        tag.userData.isLabel = true;
        model.add(tag);
      }
      return model;
    }

// --- Post office pickup counter: deliveries wait here as their real models ------------------
let parcelDisplayGroup = null;
let parcelDisplayKey = null;

function renderPostOfficeParcels3D() {
      if (!scene) return;
      if (!parcelDisplayGroup) {
        const cx = 16.2, cz = 0.4;
        const gy = getAnalyticalGroundHeight(cx, cz);
        const counter = new THREE.Group();
        counter.position.set(cx, gy, cz);
        const top = mesh(new THREE.BoxGeometry(2.6, 0.1, 1.0), 0xf8fafc);
        top.position.y = 0.8;
        const base = mesh(new THREE.BoxGeometry(2.5, 0.75, 0.9), 0xb91c1c);
        base.position.y = 0.38;
        const sign = makeSignMesh('PICK-UP', { bg: '#b91c1c', fg: '#ffffff', width: 1.0, height: 0.22 });
        sign.position.set(0, 0.45, 0.46);
        counter.add(top, base, sign);
        scene.add(counter);
        worldObstacles.push({ x: cx, z: cz, r: 1.4 });
        parcelDisplayGroup = new THREE.Group();
        parcelDisplayGroup.position.set(cx, gy + 0.85, cz);
        scene.add(parcelDisplayGroup);
      }
      // Only rebuild when the mail actually changed
      const key = state.mailbox.slice(0, 6).map(m => m.id).join('|');
      if (key === parcelDisplayKey) return;
      parcelDisplayKey = key;
      while (parcelDisplayGroup.children.length) {
        const old = parcelDisplayGroup.children.pop();
        old.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      }
      state.mailbox.slice(0, 6).forEach((m, i) => {
        const model = buildItemModel3D(m.kind === 'message' ? 'Letter' : m.name, { kind: m.kind, thumb: m.thumbs && m.thumbs[0] });
        model.position.set(-0.9 + (i % 3) * 0.9, 0, i < 3 ? 0.15 : -0.3);
        model.scale.setScalar(0.85);
        parcelDisplayGroup.add(model);
      });
    }

// --- Carrying: Kelo-1 holds an item in front of him ------------------------------------------
let carriedObject = null;
let carriedUntil = 0;

function setCarriedObject(object3d, holdMs = 0) {
      if (carriedObject && keloGroup) {
        keloGroup.remove(carriedObject);
        carriedObject.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      }
      carriedObject = object3d || null;
      carriedUntil = holdMs > 0 ? Date.now() + holdMs : 0;
      if (carriedObject && keloGroup) {
        carriedObject.traverse(o => { if (o.userData && o.userData.isLabel) o.visible = false; });
        carriedObject.position.set(0, 1.05, 0.62);
        keloGroup.add(carriedObject);
      }
    }

// Called every frame from the animation loop: drop timed carries, keep the item bobbing with his steps
function updateCarriedObject(t) {
      if (!carriedObject) return;
      if (carriedUntil && Date.now() > carriedUntil) {
        setCarriedObject(null);
        return;
      }
      carriedObject.position.y = 1.05 + (state.isWalking ? Math.abs(Math.sin(t * 9.5)) * 0.05 : 0);
    }
