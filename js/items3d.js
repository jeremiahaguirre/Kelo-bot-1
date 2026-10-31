// Kelo-bot-1 — js/items3d.js
// Loaded after scene.js. Turns an item's name ("A basket of Okanagan cherries", "A canoe",
// "A larger island to explore") into a small 3D model, so deliveries waiting at the post office
// and things Kelo-1 carries look like what they are. Unknown items become a labelled gift box.

const ITEM_MODEL_RULES = [
  // Workshop and supply items Kelo-1 often asks for
  [/spray ?paint|aerosol/, () => {
    const can = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.36, 14), 0xff3d7f, { metalness: 0.6 });
    can.position.y = 0.18;
    const cap = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.08, 12), 0xf8fafc);
    cap.position.y = 0.4;
    const can2 = can.clone();
    can2.material = can.material.clone();
    can2.material.color.setHex(0x3ddcff);
    can2.position.set(0.2, 0.18, 0.05);
    return group(can, cap, can2);
  }],
  [/crucible|cauldron|bucket|\bpot\b|kettle/, () => {
    const pot = mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.3, 16, 1, true), 0x57534e, { side: THREE.DoubleSide, metalness: 0.4 });
    pot.position.y = 0.15;
    const bottom = mesh(new THREE.CircleGeometry(0.16, 16), 0x44403c);
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.y = 0.01;
    const glow = mesh(new THREE.CircleGeometry(0.2, 16), 0xf97316, { emissive: 0xea580c, emissiveIntensity: 0.6 });
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.24;
    return group(pot, bottom, glow);
  }],
  [/flux|powder|sand|salt|flour|substrate|fertili[sz]er|soil|\bbag\b|sack/, () => {
    const sack = mesh(new THREE.SphereGeometry(0.2, 12, 10), 0xd6c7a1, { roughness: 1 });
    sack.scale.set(1, 1.3, 0.8);
    sack.position.y = 0.24;
    const tie = mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.08, 10), 0xa16207);
    tie.position.y = 0.5;
    return group(sack, tie);
  }],
  [/ingot|mold|mould/, () => {
    const g = group();
    for (let i = 0; i < 3; i++) {
      const bar = mesh(new THREE.BoxGeometry(0.3, 0.08, 0.12), i === 2 ? 0x1f2937 : 0xfacc15, { metalness: 0.85, roughness: 0.3 });
      bar.position.set(0, 0.04 + i * 0.08, (i % 2) * 0.04);
      g.add(bar);
    }
    return g;
  }],
  [/bar stock|steel bar|rods?\b|pipe|tubing|beam|rebar/, (lower) => {
    const g = group();
    const color = /copper/.test(lower) ? 0xb45309 : /titanium/.test(lower) ? 0xa5b4fc : 0x94a3b8;
    for (let i = 0; i < 5; i++) {
      const rod = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8), color, { metalness: 0.85, roughness: 0.25 });
      rod.rotation.z = Math.PI / 2;
      rod.position.set(0, 0.03 + (i % 2) * 0.05, (i - 2) * 0.055);
      g.add(rod);
    }
    return g;
  }],
  [/drill bits?|\bbits\b/, () => {
    const g = group();
    for (let i = 0; i < 4; i++) {
      const bit = mesh(new THREE.ConeGeometry(0.03, 0.3, 8), 0xe2e8f0, { metalness: 0.9 });
      bit.position.set((i - 1.5) * 0.08, 0.15, 0);
      g.add(bit);
    }
    return g;
  }],
  [/motor|engine|generator|turbine/, () => {
    const body = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.3, 16), 0x334155, { metalness: 0.6 });
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.16;
    const shaft = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8), 0xcbd5e1, { metalness: 0.9 });
    shaft.rotation.z = Math.PI / 2;
    shaft.position.set(0.24, 0.16, 0);
    return group(body, shaft);
  }],
  [/\blens\b|mirror|monocle/, () => {
    const lens = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 24), 0xbae6fd, { transparent: true, opacity: 0.7, metalness: 0.2 });
    lens.rotation.x = Math.PI / 2;
    lens.position.y = 0.19;
    const rim = mesh(new THREE.TorusGeometry(0.17, 0.02, 8, 24), 0x1f2937);
    rim.position.y = 0.19;
    return group(lens, rim);
  }],
  [/tank|canister|cylinder|bottle|jar|flask|gas refill|argon|propane|oxygen/, (lower) => {
    const color = /argon|gas|oxygen/.test(lower) ? 0x0d9488 : /glass|jar|bottle/.test(lower) ? 0xbae6fd : 0x64748b;
    const body = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.45, 14), color, { transparent: /glass|jar|bottle/.test(lower), opacity: 0.85, metalness: 0.4 });
    body.position.y = 0.23;
    const top = mesh(new THREE.SphereGeometry(0.11, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), color);
    top.position.y = 0.45;
    const valve = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8), 0x1f2937);
    valve.position.y = 0.58;
    return group(body, top, valve);
  }],
  [/capacitor|battery|power cell|power supply/, () => {
    const cell = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.32, 14), 0x22c55e);
    cell.position.y = 0.16;
    const cap = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 10), 0xcbd5e1, { metalness: 0.9 });
    cap.position.y = 0.34;
    return group(cell, cap);
  }],
  [/solar|panel/, () => {
    const panel = mesh(new THREE.BoxGeometry(0.5, 0.03, 0.34), 0x1e3a8a, { metalness: 0.5, roughness: 0.2 });
    panel.position.y = 0.2;
    panel.rotation.x = -0.4;
    const stand = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 6), 0x94a3b8);
    stand.position.y = 0.1;
    return group(panel, stand);
  }],
  [/seed packet|seeds?\b/, (lower) => realSize(seedPacketsModel())],
  [/book|novel|journal|notebook|manual/, (lower) => realSize(bookModel(lower))],
  [/guitar|ukulele|violin/, (lower) => realSize(guitarModel(lower))],
  // Digging equipment (checked first so "jackhammer" isn't mistaken for a plain hammer)
  [/jack ?hammer|rock breaker/, () => {
    // Motor body, T-handle grips, hose, and a long chisel bit
    const yellow = 0xfacc15;
    const motor = mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.42, 16), yellow, { metalness: 0.3 });
    motor.position.y = 0.62;
    const cap = mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.1, 16), 0x1f2937);
    cap.position.y = 0.88;
    const bar = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 10), 0x1f2937);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 0.94;
    const grips = [-0.3, 0.3].map(x => {
      const grip = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 10), 0x111827);
      grip.rotation.z = Math.PI / 2;
      grip.position.set(x, 0.94, 0);
      return grip;
    });
    const collar = mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.1, 12), 0x475569, { metalness: 0.8 });
    collar.position.y = 0.36;
    const shank = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 8), 0xcbd5e1, { metalness: 0.9, roughness: 0.25 });
    shank.position.y = 0.18;
    const chisel = mesh(new THREE.ConeGeometry(0.035, 0.08, 4), 0xcbd5e1, { metalness: 0.9 });
    chisel.rotation.x = Math.PI;
    chisel.position.y = 0.02;
    const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.8, -0.12), new THREE.Vector3(0.1, 0.55, -0.35), new THREE.Vector3(0.3, 0.1, -0.4)]), 16, 0.025, 6), new THREE.MeshStandardMaterial({ color: 0x111827 }));
    return realSize(group(motor, cap, bar, ...grips, collar, shank, chisel, hose));
  }],
  [/excavator|digger|backhoe/, () => excavatorModel()],
  [/dump ?truck|truck/, () => dumpTruckModel()],
  [/hot.?air balloon|balloon basket/, () => hotAirBalloonModel()],
  [/snowmobile|snow ?machine/, () => snowmobileModel()],
  [/helicopter|gyrocopter/, () => helicopterModel()],
  [/\bskis?\b/, () => realSize(skisModel())],
  [/snow ?shoes?/, () => realSize(snowshoesModel())],
  [/\bkeys?\b/, () => realSize(keysModel())],
  [/^(?!.*pick ?ax).*(\baxe\b|hatchet)/, () => realSize(axeModel())],
  [/shovel|spade/, () => {
    // D-grip, wooden shaft, metal collar, and a pointed, slightly dished blade
    const wood = 0xa16207;
    const shaft = mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.75, 10), wood);
    shaft.position.y = 0.6;
    const grip = mesh(new THREE.TorusGeometry(0.07, 0.016, 8, 16, Math.PI), 0x1f2937);
    grip.position.y = 1.0;
    const gripBar = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.14, 8), 0x1f2937);
    gripBar.rotation.z = Math.PI / 2;
    gripBar.position.y = 1.0;
    const collar = mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.1, 10), 0x64748b, { metalness: 0.8 });
    collar.position.y = 0.24;
    const outline = new THREE.Shape();
    outline.moveTo(-0.12, 0.2);
    outline.lineTo(0.12, 0.2);
    outline.quadraticCurveTo(0.14, 0.05, 0.0, -0.12);
    outline.quadraticCurveTo(-0.14, 0.05, -0.12, 0.2);
    const bladeGeo = new THREE.ExtrudeGeometry(outline, { depth: 0.012, bevelEnabled: false, curveSegments: 10 });
    // Dish the blade a little so it reads as a scoop rather than a flat plate
    const bp = bladeGeo.attributes.position;
    for (let i = 0; i < bp.count; i++) bp.setZ(i, bp.getZ(i) + Math.pow(bp.getX(i) / 0.12, 2) * 0.03);
    bladeGeo.computeVertexNormals();
    const blade = mesh(bladeGeo, 0x94a3b8, { metalness: 0.75, roughness: 0.35, side: THREE.DoubleSide });
    blade.position.y = 0.08;
    return realSize(group(shaft, grip, gripBar, collar, blade));
  }],
  [/pick ?ax(e)?|mattock/, () => {
    // Long wooden haft with a grip, and a curved steel head: a sharp pick on one side, a chisel on the other
    const haft = mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.85, 10), 0xa16207);
    haft.position.y = 0.43;
    const wrap = mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.18, 10), 0x1f2937);
    wrap.position.y = 0.12;
    const eye = mesh(new THREE.BoxGeometry(0.07, 0.09, 0.07), 0x475569, { metalness: 0.8 });
    eye.position.y = 0.86;
    const head = new THREE.Shape();
    // Crescent: the top edge arcs up, the underside curves, tapering to a point (left) and a flat chisel (right)
    head.moveTo(-0.34, 0.80);
    head.quadraticCurveTo(-0.15, 0.93, 0.0, 0.92);
    head.quadraticCurveTo(0.17, 0.93, 0.32, 0.84);
    head.lineTo(0.33, 0.80);
    head.quadraticCurveTo(0.16, 0.85, 0.0, 0.83);
    head.quadraticCurveTo(-0.16, 0.85, -0.34, 0.80);
    const headGeo = new THREE.ExtrudeGeometry(head, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 2, curveSegments: 12 });
    headGeo.translate(0, 0, -0.025);
    const steel = mesh(headGeo, 0x94a3b8, { metalness: 0.85, roughness: 0.3 });
    return realSize(group(haft, wrap, eye, steel));
  }],
  // Things he can dig up
  [/geode|amethyst|garnet/, () => {
    const rock = mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x78716c, { side: THREE.DoubleSide });
    rock.rotation.x = Math.PI / 2;
    rock.position.y = 0.2;
    const crystal = mesh(new THREE.IcosahedronGeometry(0.13, 0), 0xa855f7, { emissive: 0x7e22ce, emissiveIntensity: 0.4 });
    crystal.position.set(0, 0.2, 0.04);
    return group(rock, crystal);
  }],
  [/quartz|crystal|jade/, (lower) => {
    const g = group();
    for (let i = 0; i < 4; i++) {
      const c = mesh(new THREE.ConeGeometry(0.05, 0.3, 6), /jade/.test(lower) ? 0x22c55e : 0xe0f2fe, { transparent: true, opacity: 0.85, emissive: 0x38bdf8, emissiveIntensity: 0.2 });
      c.position.set((i - 1.5) * 0.06, 0.15, (i % 2) * 0.05);
      c.rotation.z = (i - 1.5) * 0.25;
      g.add(c);
    }
    return g;
  }],
  [/fossil|trilobite|ammonite|bone|petrified/, () => {
    const slab = mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.08, 14), 0xd6c7a1);
    slab.position.y = 0.04;
    const spiral = mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 16), 0x8b7355);
    spiral.rotation.x = Math.PI / 2;
    spiral.position.y = 0.1;
    return group(slab, spiral);
  }],
  [/coin|nugget/, (lower) => {
    const coin = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 18), /silver/.test(lower) ? 0xcbd5e1 : 0xfacc15, { metalness: 0.9, roughness: 0.25 });
    coin.position.y = 0.05;
    return group(coin);
  }],
  [/meteorite|obsidian|arrowhead/, () => {
    const m = mesh(new THREE.DodecahedronGeometry(0.16, 0), 0x1f2937, { metalness: 0.6, roughness: 0.4, flatShading: true });
    m.position.y = 0.14;
    return group(m);
  }],
  [/cherr/, () => fruitBasket(0xb91c1c, 0.013, 30)],
  [/apple/, () => fruitBasket(0xdc2626, 0.04, 9)],
  [/peach|apricot/, () => fruitBasket(0xffa36c, 0.038, 9)],
  [/blueberr|grape/, () => fruitBasket(0x3b4cca, 0.009, 60)],
  [/bread|loaf|sourdough|baguette|\bbun\b|croissant/, (lower) => realSize(loafModel(lower))],
  [/tart|pie|cobbler|cake|cookie/, (lower) => realSize(bakedModel(lower))],
  [/ramen|noodle|soup|stew|bowl/, (lower) => realSize(noodleBowlModel())],
  [/cheese|cheddar/, (lower) => realSize(cheeseModel())],
  [/pizza/, (lower) => realSize(pizzaModel())],
  [/fudge|chocolate|brownie/, (lower) => realSize(chocolateModel())],
  [/cocoa|coffee|\btea\b|thermos|juice|milk/, (lower) => realSize(drinkModel(lower))],
  [/salmon|fish|trout/, (lower) => realSize(fishModel())],
  [/carrot/, (lower) => realSize(carrotModel())],
  [/kite/, (lower) => realSize(kiteModel())],
  [/yo-?yo/, (lower) => realSize(yoyoModel())],
  [/telescope/, () => realSize(telescopeModel())],
  [/kaleidoscope|spyglass/, () => {
    const tube = mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.6, 12), 0xa855f7, { metalness: 0.5 });
    tube.rotation.z = Math.PI / 2.6;
    tube.position.y = 0.2;
    return group(tube);
  }],
  [/ball|juggl|marble/, (lower) => realSize(ballModel(lower))],
  [/duck/, (lower) => realSize(duckModel())],
  [/spinning top|\btop\b/, (lower) => realSize(spinningTopModel())],
  [/frog/, (lower) => realSize(frogModel())],
  [/puzzle|cube|block|lego/, (lower) => realSize(blocksModel())],
  [/harmonica/, (lower) => realSize(harmonicaModel())],
  [/drill/, () => realSize(cordlessDrillModel())],
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
  [/hammer|mallet/, () => realSize(clawHammerModel())],
  [/wrench|spanner/, () => realSize(wrenchModel())],
  [/pliers/, () => realSize(pliersModel())],
  [/screwdriver/, () => realSize(screwdriverModel())],
  [/knife/, () => realSize(knifeModel())],
  [/\bsaw\b|handsaw/, () => realSize(handSawModel())],
  [/multitool|iron|tool/, () => realSize(toolboxModel())],
  [/canoe|kayak|boat|raft|paddle ?board/, () => rowboatModel()],
  [/bike|bicycle|scooter/, () => bicycleModel()],
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
  [/dock|pier|plank|cedar|lumber|timber/, () => {
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

// Models marked realSize (the tools in this file and js/gearmodels.js) are built in metres.
// Kelo-1 is 2.8 units tall (about 1.75 m), so at life size they are scaled up by this much.
// Older models (food, toys...) were drawn at a display size and stay at scale 1.
const ITEM_LIFE_SCALE = 1.6;

function realSize(model) {
      model.userData.realSize = true;
      return model;
    }

// Largest side of an item model, ignoring its hover label
function itemModelSize(model) {
      model.updateMatrixWorld(true);
      const box = new THREE.Box3();
      model.traverse(o => { if (o.isMesh && !(o.userData && o.userData.isLabel)) box.expandByObject(o); });
      if (box.isEmpty()) return 1;
      const size = new THREE.Vector3();
      box.getSize(size);
      return Math.max(size.x, size.y, size.z) / (model.scale.x || 1) || 1;
    }

// Show an item at its real size next to Kelo-1, shrunk only if it won't fit in `maxSize`
function lifeSize(model, maxSize = Infinity) {
      const life = model.userData.realSize ? ITEM_LIFE_SCALE : 1;
      model.scale.setScalar(Math.min(life, maxSize / itemModelSize(model)));
      return model;
    }

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

// Real-size fruit heaped in a small woven basket (built in metres)
function fruitBasket(color, radius, count) {
      const wicker = mesh(new THREE.LatheGeometry([[0, 0], [0.09, 0], [0.13, 0.03], [0.15, 0.09], [0.145, 0.09], [0.125, 0.032], [0, 0.006]].map(([r, y]) => new THREE.Vector2(r, y)), 18), 0xb7793e, { roughness: 1, side: THREE.DoubleSide });
      const handle = mesh(new THREE.TorusGeometry(0.14, 0.008, 6, 20, Math.PI), 0x8a5a2b);
      handle.position.y = 0.09;
      const g = group(wicker, handle);
      for (let i = 0; i < count; i++) {
        const a = i * 2.4, ring = Math.sqrt(i / count) * (0.12 - radius);
        const fruit = mesh(new THREE.SphereGeometry(radius, 10, 8), color, { roughness: 0.4 });
        fruit.position.set(Math.cos(a) * ring, 0.07 + radius + (1 - i / count) * radius * 1.4, Math.sin(a) * ring);
        g.add(fruit);
      }
      return realSize(g);
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

// Colours and materials named in an item ("copper", "red", "glass", "wooden"...)
const COLOR_WORDS = [
  [/gold|golden|brass/, 0xfacc15, 0.85], [/silver|steel|iron|chrome|aluminum|aluminium|tin/, 0x94a3b8, 0.85],
  [/copper|bronze/, 0xb45309, 0.8], [/titanium/, 0xa5b4fc, 0.8], [/wood|wooden|cedar|oak|pine|bamboo/, 0xa16207, 0],
  [/glass|crystal/, 0xbae6fd, 0.2], [/stone|rock|granite|clay/, 0x78716c, 0], [/rubber|black/, 0x1f2937, 0],
  [/red/, 0xef4444, 0], [/orange/, 0xf97316, 0], [/yellow/, 0xfacc15, 0], [/green/, 0x22c55e, 0], [/blue/, 0x3b82f6, 0],
  [/purple|violet/, 0xa855f7, 0], [/pink/, 0xf472b6, 0], [/white/, 0xf8fafc, 0], [/brown/, 0x92400e, 0]
];

// For items with no specific model: build something from the shape and material words in the name
function inferredItemModel(lower) {
      const tone = COLOR_WORDS.find(([re]) => re.test(lower));
      const color = tone ? tone[1] : null;
      const opts = tone && tone[2] ? { metalness: tone[2], roughness: 0.3 } : {};
      const c = (fallback) => color ?? fallback;
      if (/plate|sheet|board|tile|slab|panel|pane/.test(lower)) {
        const g = group();
        for (let i = 0; i < 3; i++) {
          const sheet = mesh(new THREE.BoxGeometry(0.5, 0.02, 0.35), c(0x94a3b8), opts);
          sheet.position.set(0, 0.01 + i * 0.025, i * 0.01);
          g.add(sheet);
        }
        return g;
      }
      if (/ball|sphere|orb|globe|marble/.test(lower)) {
        const b = mesh(new THREE.SphereGeometry(0.18, 16, 12), c(0x3b82f6), opts);
        b.position.y = 0.18;
        return group(b);
      }
      if (/ring|hoop|loop|coil|wire|cable|hose/.test(lower)) {
        const r = mesh(new THREE.TorusGeometry(0.2, 0.04, 10, 24), c(0xb45309), opts);
        r.rotation.x = Math.PI / 2;
        r.position.y = 0.05;
        return group(r);
      }
      if (/wheel|tire|tyre|disc|disk|gear|cog/.test(lower)) {
        const w = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20), c(0x334155), opts);
        w.rotation.x = Math.PI / 2;
        w.position.y = 0.2;
        return group(w);
      }
      if (/stick|pole|rod|wand|staff|bar\b/.test(lower)) {
        const st = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8), c(0xa16207), opts);
        st.rotation.z = Math.PI / 2.4;
        st.position.y = 0.2;
        return group(st);
      }
      if (/box|kit|crate|case|chest|set\b|toolbox/.test(lower)) {
        const box = mesh(new THREE.BoxGeometry(0.42, 0.26, 0.3), c(0x92400e), opts);
        box.position.y = 0.13;
        const latch = mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), 0xcbd5e1, { metalness: 0.8 });
        latch.position.set(0, 0.2, 0.16);
        return group(box, latch);
      }
      if (/cube|block|brick/.test(lower)) {
        const b = mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), c(0xef4444), opts);
        b.position.y = 0.125;
        return group(b);
      }
      if (color !== null) {
        // We know what it's made of, if not its shape: a chunky object in that material
        const blob = mesh(new THREE.DodecahedronGeometry(0.2, 0), color, opts);
        blob.position.y = 0.2;
        return group(blob);
      }
      return null;
    }

// AI-designed models for exact items, cached by name (see designItemModelWithAI)
function aiDesignedItemModel(lower) {
      const design = state.itemDesigns && state.itemDesigns[lower];
      if (!design || typeof buildCreationGroup !== 'function') return null;
      const g = buildCreationGroup({ parts: design.parts, colorHex: '#94a3b8', secondaryColorHex: '#475569' });
      g.scale.setScalar(0.28);
      return g;
    }

// The real thing, never left in its wrapping: a built-in model first (a dump truck is always a dump
// truck), then one the AI designed for things nobody has a model for, then a guess from the name's
// words and shapes he knows. A plain box only if all of that comes up empty.
function singleItemModel(lower) {
      const rule = ITEM_MODEL_RULES.find(([re]) => re.test(lower));
      if (rule) return rule[1](lower);
      const designed = aiDesignedItemModel(lower);
      if (designed) return designed;
      // He looked up what it is (lookUpItemModel): model it as the closest thing he knows
      const lookedUp = state.itemLookups && state.itemLookups[lower];
      const kindRule = lookedUp && lookedUp.like ? ITEM_MODEL_RULES.find(([re]) => re.test(lookedUp.like)) : null;
      if (kindRule) return kindRule[1](lookedUp.like);
      const inferred = inferredItemModel(lower);
      if (inferred) return inferred;
      const form = typeof formForText === 'function' ? formForText(lower) : null;
      if (form && form.parts && typeof buildCreationGroup === 'function') {
        const g = buildCreationGroup({ parts: form.parts, colorHex: '#94a3b8', secondaryColorHex: '#475569' });
        g.scale.setScalar(0.28);
        return g;
      }
      return categoryItemModel(lower);
    }

// Does this name already have a real model (rule, AI design, lookup, or a guess from its words)?
function hasRealItemModel(lower) {
      return ITEM_MODEL_RULES.some(([re]) => re.test(lower)) || Boolean(state.itemDesigns && state.itemDesigns[lower])
        || Boolean(state.itemLookups && state.itemLookups[lower] && state.itemLookups[lower].like)
        || Boolean(inferredItemModel(lower)) || Boolean(typeof formForText === 'function' && formForText(lower));
    }

// Last resort, by what kind of thing it is: still a thing, never a wrapped box
function categoryItemModel(lower) {
      const cat = typeof categorizeItem === 'function' ? categorizeItem(lower) : 'thing';
      const stand = { food: 'pie', toy: 'ball', tool: 'toolbox', vehicle: 'dump truck', place: 'cabin', companion: 'duck' }[cat];
      const rule = stand && ITEM_MODEL_RULES.find(([re]) => re.test(stand));
      if (rule) return rule[1](stand);
      // Anything else: a small object on a stand, in a colour from its name
      const tone = COLOR_WORDS.find(([re]) => re.test(lower));
      const color = tone ? tone[1] : 0x94a3b8;
      const body = mesh(new THREE.IcosahedronGeometry(0.16, 1), color, { flatShading: true, metalness: tone && tone[2] ? tone[2] : 0.2 });
      body.position.y = 0.3;
      const base = mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.12, 16), 0x475569);
      base.position.y = 0.06;
      return group(body, base);
    }

// What words in a description point to a kind of thing he has a model for
const LOOKUP_KINDS = [
  [/musical instrument|string instrument|stringed/, 'guitar'], [/wind instrument|flute|whistle|reed/, 'harmonica'], [/percussion|drum/, 'drum'],
  [/hand tool|cutting tool|blade/, 'knife'], [/power tool/, 'cordless drill'], [/striking tool|mallet|hammer/, 'hammer'],
  [/vehicle|automobile|truck|tractor|car\b/, 'dump truck'], [/watercraft|boat|ship|canoe/, 'boat'], [/aircraft|airplane|helicopter/, 'helicopter'], [/bicycle|cycle/, 'bike'],
  [/fruit|berry/, 'apples'], [/vegetable|root/, 'carrots'], [/bread|baked|pastry/, 'loaf'], [/dessert|cake|sweet/, 'cake'], [/cheese/, 'cheese'], [/drink|beverage|coffee|tea/, 'coffee'], [/dish|soup|noodle|food/, 'ramen'],
  [/\btoy\b|game|puzzle/, 'puzzle'], [/ball/, 'ball'], [/book|publication|novel/, 'book'], [/lamp|light/, 'lantern'], [/optical|telescope|lens/, 'telescope'],
  [/container|vessel|jar|bottle/, 'jar'], [/rope|cord|string/, 'rope'], [/plant|flower|seed/, 'seed packet'], [/mineral|crystal|gem|rock|stone/, 'quartz crystal'],
  [/bird/, 'bird'], [/animal|mammal|pet/, 'goat'], [/building|house|structure/, 'cabin']
];

// Before a gift reaches him: if nothing models it yet, find out what it is so it can look like itself
async function lookUpItemModel(name) {
      const lower = String(name || '').toLowerCase().trim();
      if (!lower || hasRealItemModel(lower)) return;
      state.itemLookups = state.itemLookups || {};
      if (state.itemLookups[lower]) return;
      // With an AI key, the AI designs the exact thing
      if (typeof hasLLMKey === 'function' && hasLLMKey() && typeof designItemModelWithAI === 'function') {
        await designItemModelWithAI(name);
        if (state.itemDesigns && state.itemDesigns[lower]) return;
      }
      // Otherwise read about it (Wikipedia, then the dictionary and DuckDuckGo) and match its description
      const core = lower.replace(/^(an?|the|some|my|a pair of|a set of|a box of|a bag of)\s+/, '').replace(/[^a-z0-9 -]/g, '').trim();
      let found = null;
      try { found = typeof lookUpAnywhere === 'function' ? await lookUpAnywhere(core) : null; } catch (e) {}
      const text = found ? found.extract.toLowerCase() : '';
      const kind = LOOKUP_KINDS.find(([re]) => re.test(text));
      state.itemLookups[lower] = { like: kind ? kind[1] : null, from: found ? found.title : null, at: Date.now() };
      parcelDisplayKey = null; // redraw the post office counter with the new model
      if (typeof renderPostOfficeParcels3D === 'function') renderPostOfficeParcels3D();
      savePersistentBrainState();
    }

// Opening a parcel: the wrapped box he carries pops its lid and the real item rises out of it
async function unboxInHands(itemModel) {
      if (typeof setCarriedObject !== 'function') return;
      const wrapper = new THREE.Group();
      const box = giftBox();
      wrapper.add(box);
      setCarriedObject(wrapper);
      wrapper.scale.setScalar(1); // only the box is scaled up, so the item keeps its own life size
      box.scale.setScalar(1.4);
      await new Promise(r => setTimeout(r, 900));
      itemModel.userData.unboxBase = itemModel.scale.x;
      itemModel.scale.setScalar(itemModel.userData.unboxBase * 0.01);
      wrapper.add(itemModel);
      for (let i = 1; i <= 12; i++) {
        const t = i / 12;
        box.scale.setScalar(Math.max(0.01, 1.4 * (1 - t)));
        box.position.y = -t * 0.3;
        box.rotation.z = t * 0.6;
        itemModel.scale.setScalar(itemModel.userData.unboxBase * (0.01 + 0.99 * t));
        itemModel.position.y = 0.25 * Math.sin(t * Math.PI);
        await new Promise(r => setTimeout(r, 45));
      }
      wrapper.remove(box);
    }

// "A crucible, borax flux & a graphite mold" -> three separate things side by side
function splitItemList(name) {
      const parts = String(name || '').split(/\s*(?:,|&|\+|\band\b)\s*/i).map(p => p.trim()).filter(p => p.length > 2);
      return parts.length > 1 && parts.length <= 5 ? parts : null;
    }

// A model for any named item, with its name on a small label above it
function buildItemModel3D(name, { kind = 'gift', thumb = null, label = true } = {}) {
      let model;
      if (kind === 'message') model = envelopeModel();
      else if (kind === 'photo') model = photoFrameModel(thumb);
      else {
        const lower = String(name || '').toLowerCase();
        const list = aiDesignedItemModel(lower) ? null : splitItemList(lower);
        if (list) {
          model = group();
          list.forEach((piece, i) => {
            const sub = singleItemModel(piece);
            sub.scale.multiplyScalar(0.8);
            sub.position.x = (i - (list.length - 1) / 2) * 0.45;
            model.add(sub);
          });
        } else {
          model = singleItemModel(lower);
        }
      }
      if (label && name) {
        const text = String(name).replace(/^(an?|the|some)\s+/i, '').slice(0, 22).toUpperCase();
        const tag = makeSignMesh(text, { bg: '#fff7ed', fg: '#7c2d12', width: 0.75, height: 0.16 });
        tag.position.y = 0.8;
        tag.userData.isLabel = true;
        tag.visible = false; // shown only while the cursor is over the item
        model.add(tag);
      }
      return model;
    }

// With an AI key, ask the AI to design a small 3D model of an item nobody has a model for.
// Designs are cached by item name so each item is only designed once.
async function designItemModelWithAI(name) {
      const lower = String(name || '').toLowerCase().trim();
      if (!lower || !hasLLMKey() || (state.itemDesigns && state.itemDesigns[lower])) return;
      if (ITEM_MODEL_RULES.some(([re]) => re.test(lower))) return;
      const prompt = `Design a small, recognizable 3D model of this real object for a stylized game: "${name}".
Use 2 to 14 parts. Return ONLY JSON: {"parts": [ ... ]}
Each part: "shape" (cylinder, box, sphere, cone, torus, knot, octahedron, dodecahedron, icosahedron, tetrahedron, ring, lathe, extrude, tube),
"x","y","z" (y is height, object sits on y=0, keep within -2..2 and 0..3), "rx","ry","rz", "color" "#rrggbb" (realistic colours),
sizes "sx","sy","sz" for basic shapes; lathe uses "profile":[[radius,height],...]; extrude uses "outline":[[x,y],...] and "depth"; tube uses "path":[[x,y,z],...] and "radius".
Make it look like the actual object (proportions, colours, distinctive features).`;
      const parsed = await callLLMJSON([{ text: prompt }]);
      const parts = parsed ? sanitizeParts(parsed.parts) : null;
      if (!parts) return;
      state.itemDesigns = state.itemDesigns || {};
      state.itemDesigns[lower] = { parts, at: Date.now() };
      const keys = Object.keys(state.itemDesigns);
      if (keys.length > 40) delete state.itemDesigns[keys.sort((a, b) => state.itemDesigns[a].at - state.itemDesigns[b].at)[0]];
      parcelDisplayKey = null; // rebuild the counter with the new model
      savePersistentBrainState();
      renderAllUI();
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
        lifeSize(model, 0.8);
        parcelDisplayGroup.add(model);
      });
    }

// Reveal the name tag of the parcel under the cursor, hide the rest
function setHoveredParcelLabel(raycaster) {
      if (!parcelDisplayGroup) return;
      const hits = raycaster.intersectObjects(parcelDisplayGroup.children, true);
      let hovered = null;
      if (hits.length > 0) {
        hovered = hits[0].object;
        while (hovered && hovered.parent !== parcelDisplayGroup) hovered = hovered.parent;
      }
      parcelDisplayGroup.children.forEach(model => {
        model.traverse(o => { if (o.userData && o.userData.isLabel) o.visible = model === hovered; });
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
      // Anything not already sized is held at life size, up to an armful
      if (carriedObject && carriedObject.scale.x === 1) lifeSize(carriedObject, 1.4);
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

// When the page opens: anything he owns or that waits at the post office with no model yet gets looked up,
// one at a time so the reference sites aren't flooded
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(async () => {
    const names = [...state.toolInventory, ...state.toys.map(t => t.name), ...state.belongings.map(b => b.name), ...state.mailbox.filter(m => m.kind === 'gift').map(m => m.name)];
    for (const n of [...new Set(names)]) {
      if (hasRealItemModel(String(n).toLowerCase())) continue;
      await lookUpItemModel(n);
      await new Promise(r => setTimeout(r, 1500));
    }
  }, 4000);
});
