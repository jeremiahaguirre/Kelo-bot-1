// ==========================================
// SCENE & 3D MESH GENERATION (scene.js)
// ==========================================

// Head & Glowing Eyes
keloHead = new THREE.Group();
keloHead.position.set(0, 2.35, 0);
const headMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.96, 0.74, 0.76),
  new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.35, roughness: 0.25 })
);
headMesh.castShadow = true;
keloHead.add(headMesh);

// Visor Faceplate
const visor = new THREE.Mesh(
  new THREE.BoxGeometry(0.82, 0.44, 0.08),
  new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 })
);
visor.position.set(0, 0.02, 0.36);
keloHead.add(visor);

// Expressive LED Eyes
const eyeGeo = new THREE.SphereGeometry(0.09, 12, 12);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
keloLeftEye = new THREE.Mesh(eyeGeo, eyeMat);
keloLeftEye.position.set(-0.2, 0.04, 0.41);
keloRightEye = new THREE.Mesh(eyeGeo, eyeMat);
keloRightEye.position.set(0.2, 0.04, 0.41);
keloHead.add(keloLeftEye, keloRightEye);

// Antenna on Top of Head
const antennaStem = new THREE.Mesh(
  new THREE.CylinderGeometry(0.03, 0.03, 0.38, 8),
  new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 })
);
antennaStem.position.set(0, 0.52, 0);
const antennaBulb = new THREE.Mesh(
  new THREE.SphereGeometry(0.09, 10, 10),
  new THREE.MeshBasicMaterial({ color: 0x34d399 })
);
antennaBulb.position.set(0, 0.72, 0);
keloHead.add(antennaStem, antennaBulb);
keloGroup.add(keloHead);

// Articulated Arms
const limbMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.35 });
const armGeo = new THREE.BoxGeometry(0.26, 0.85, 0.26);
keloLeftArm = new THREE.Mesh(armGeo, limbMat);
keloLeftArm.position.set(-0.7, 1.35, 0);
keloLeftArm.castShadow = true;

keloRightArm = new THREE.Mesh(armGeo, limbMat);
keloRightArm.position.set(0.7, 1.35, 0);
keloRightArm.castShadow = true;

// 1) 3D Pneumatic Mountain Core Drill & Soil Auger mounted to Kelo-1's Right Hand
keloDrillToolGroup = new THREE.Group();
keloDrillToolGroup.position.set(0, -0.45, 0.25);
const drillHousing = new THREE.Mesh(
  new THREE.BoxGeometry(0.34, 0.34, 0.58),
  new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.7, roughness: 0.25 })
);
keloDrillBitMesh = new THREE.Group();
const coneBit = new THREE.Mesh(
  new THREE.ConeGeometry(0.18, 0.78, 8),
  new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.92, roughness: 0.15 })
);
coneBit.rotation.x = Math.PI / 2;
coneBit.position.z = 0.62;
const spiralFlute = new THREE.Mesh(
  new THREE.TorusGeometry(0.13, 0.035, 8, 16),
  new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.95, roughness: 0.1 })
);
spiralFlute.position.z = 0.45;
keloDrillBitMesh.add(coneBit, spiralFlute);
keloDrillToolGroup.add(drillHousing, keloDrillBitMesh);
keloDrillToolGroup.visible = false;
keloRightArm.add(keloDrillToolGroup);

// 2) 3D TIG Welding Torch & Plasma Arc Lance mounted to Kelo-1's Right Hand
keloWeldTorchGroup = new THREE.Group();
keloWeldTorchGroup.position.set(0, -0.42, 0.24);
const torchHandle = new THREE.Mesh(
  new THREE.CylinderGeometry(0.07, 0.09, 0.52, 8),
  new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5, roughness: 0.3 })
);
torchHandle.rotation.x = Math.PI / 2;
const torchNozzle = new THREE.Mesh(
  new THREE.ConeGeometry(0.06, 0.28, 8),
  new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.2 })
);
torchNozzle.rotation.x = Math.PI / 2;
torchNozzle.position.z = 0.36;
keloWeldTipGlow = new THREE.Mesh(
  new THREE.SphereGeometry(0.11, 10, 10),
  new THREE.MeshBasicMaterial({ color: 0x7dd3fc })
);
keloWeldTipGlow.position.z = 0.5;
keloWeldTorchGroup.add(torchHandle, torchNozzle, keloWeldTipGlow);
keloWeldTorchGroup.visible = false;
keloRightArm.add(keloWeldTorchGroup);

keloGroup.add(keloLeftArm, keloRightArm);

// Articulated Legs
const legGeo = new THREE.BoxGeometry(0.32, 0.78, 0.36);
keloLeftLeg = new THREE.Mesh(legGeo, limbMat);
keloLeftLeg.position.set(-0.28, 0.4, 0);
keloLeftLeg.castShadow = true;

keloRightLeg = new THREE.Mesh(legGeo, limbMat);
keloRightLeg.position.set(0.28, 0.4, 0);
keloRightLeg.castShadow = true;
keloGroup.add(keloLeftLeg, keloRightLeg);

const startGroundY = getIslandGroundHeight(state.botPos.x, state.botPos.z);
state.botAltitudeY = startGroundY;
keloGroup.position.set(state.botPos.x, startGroundY, state.botPos.z);
scene.add(keloGroup);


// 3H-2. DYNAMIC 3D WORLD-BUILDER FOR KELO-1'S UNSCRIPTED CREATIONS & LANDMARKS
function initEmergentCreationsLayer3D() {
  emergentCreationsGroup = new THREE.Group();
  scene.add(emergentCreationsGroup);
  // Instantiate any previously invented creations
  state.inventedCreations.forEach((item, idx) => {
    spawnEmergent3DObjectInWorld(item, idx === 0);
  });
}

function spawnEmergent3DObjectInWorld(creation, skipPin = false) {
  if (!emergentCreationsGroup) return;
  const g = new THREE.Group();
  const col = new THREE.Color(creation.colorHex || '#38bdf8');
  const secCol = new THREE.Color(creation.secondaryColorHex || '#f59e0b');
  const archetype = creation.archetype || 'kinetic_spire';

  // Support custom multi-part 3D primitive assemblies synthesized by the AI Agent or Image-to-Weld Engine!
  if (Array.isArray(creation.parts) && creation.parts.length > 0) {
    creation.parts.forEach((p, idx) => {
      const pCol = new THREE.Color(p.color || creation.colorHex || '#38bdf8');
      const sx = p.sx || 0.5, sy = p.sy || 0.5, sz = p.sz || 0.5;
      let geo;
      if (p.shape === 'sphere') geo = new THREE.SphereGeometry(sx * 0.6, 14, 14);
      else if (p.shape === 'cylinder') geo = new THREE.CylinderGeometry(sx * 0.4, sz * 0.4, sy, 12);
      else if (p.shape === 'cone') geo = new THREE.ConeGeometry(sx * 0.55, sy, 10);
      else if (p.shape === 'torus') geo = new THREE.TorusGeometry(sx * 0.5, Math.max(0.06, sy * 0.15), 12, 24);
      else if (p.shape === 'knot') geo = new THREE.TorusKnotGeometry(sx * 0.4, 0.07, 48, 8);
      else if (p.shape === 'octahedron') geo = new THREE.OctahedronGeometry(sx * 0.55, 0);
      else geo = new THREE.BoxGeometry(sx, sy, sz);

      const mat = new THREE.MeshStandardMaterial({
        color: pCol,
        metalness: p.metalness ?? 0.78,
        roughness: p.roughness ?? 0.22,
        emissive: p.emissive ? pCol : new THREE.Color(0x000000),
        emissiveIntensity: p.emissive ? 0.45 : 0
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(p.x || 0, p.y ?? (0.3 + idx * 0.35), p.z || 0);
      m.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0);
      m.castShadow = true;
      if (p.spin) m.userData.spin = true;
      g.add(m);
    });
  } else if (archetype === 'gold_drill_rig') {
    // Autonomous Mountain Gold Drilling Derrick & Extracted Gold Nuggets!
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.75, roughness: 0.28 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.2 });
    const derrick = new THREE.Mesh(new THREE.ConeGeometry(0.65, 2.2, 4), frameMat);
    derrick.position.y = 1.1;
    const drillBit = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.03, 1.9, 8), steelMat);
    drillBit.position.y = 0.95;
    drillBit.userData.spin = true;
    g.add(derrick, drillBit);
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.95, roughness: 0.12, emissive: 0xca8a04, emissiveIntensity: 0.25 });
    for (let n = 0; n < 5; n++) {
      const nugget = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18 + (n % 2) * 0.07, 0), goldMat);
      const ang = (n / 5) * Math.PI * 2;
      nugget.position.set(Math.cos(ang) * 0.72, 0.16, Math.sin(ang) * 0.72);
      nugget.castShadow = true;
      g.add(nugget);
    }
  } else if (archetype === 'rail_track') {
    // 3D-Printed Narrow-Gauge Train Track Segment & Autonomous Ore Cart
    const tieMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.2 });
    for (let t = -3; t <= 3; t++) {
      const tie = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.18), tieMat);
      tie.position.set(0, 0.05, t * 0.36);
      g.add(tie);
    }
    const railL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 2.6), railMat);
    railL.position.set(-0.36, 0.12, 0);
    const railR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 2.6), railMat);
    railR.position.set(0.36, 0.12, 0);
    const cart = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.45, 0.85), new THREE.MeshStandardMaterial({ color: col, metalness: 0.6 }));
    cart.position.set(0, 0.42, 0);
    g.add(railL, railR, cart);
  } else if (archetype === 'mycelium_dome') {
    // Self-healing fungal mycelium & copper thermal chamber
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.85 })
    );
    dome.position.y = 0.05;
    const copperCoil = new THREE.Mesh(
      new THREE.TorusGeometry(0.65, 0.06, 10, 24),
      new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.88, roughness: 0.2 })
    );
    copperCoil.rotation.x = Math.PI / 2;
    copperCoil.position.y = 0.45;
    g.add(dome, copperCoil);
  } else if (archetype === 'cairn') {
    // Stacked balanced river stones
    for (let i = 0; i < 4; i++) {
      const stone = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.36 - i * 0.06, 1),
        new THREE.MeshStandardMaterial({ color: i === 3 ? col : 0x94a3b8, roughness: 0.75, flatShading: true })
      );
      stone.position.y = 0.2 + i * 0.34;
      stone.scale.set(1.2, 0.65, 1.0);
      stone.castShadow = true;
      g.add(stone);
    }
  } else if (archetype === 'campfire_lantern') {
    // Warm glowing ember ring or lantern beacon
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.58, 0.18, 8),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 })
    );
    base.position.y = 0.1;
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.32, 0),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.65, roughness: 0.2 })
    );
    crystal.position.y = 0.65;
    crystal.userData.spin = true;
    const light = new THREE.PointLight(col, 0.9, 6);
    light.position.y = 0.8;
    g.add(base, crystal, light);
  } else if (archetype === 'botanical_totem') {
    // Living wood & flower arch
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.14, 1.4, 7),
      new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 })
    );
    stem.position.y = 0.7;
    const bloom = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.26, 0.07, 36, 8),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 })
    );
    bloom.position.y = 1.5;
    bloom.userData.spin = true;
    g.add(stem, bloom);
  } else {
    // 'kinetic_spire' — improvised titanium/scrap sculpture that catches the wind
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.42, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 })
    );
    pedestal.position.y = 0.15;
    const spire = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.28, 0.06, 48, 8, 2, 3),
      new THREE.MeshStandardMaterial({ color: col, metalness: 0.85, roughness: 0.18 })
    );
    spire.position.y = 0.95;
    spire.userData.spin = true;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.04, 10, 24),
      new THREE.MeshStandardMaterial({ color: secCol, metalness: 0.9, roughness: 0.15 })
    );
    ring.position.y = 0.95;
    ring.userData.spin = true;
    g.add(pedestal, spire, ring);
  }

  const groundY = getIslandGroundHeight(creation.x, creation.z);
  g.position.set(creation.x, groundY, creation.z);
  emergentCreationsGroup.add(g);

  // Also register a dynamic clickable 3D landmark pin if it's a newly discovered spot!
  const dynId = 'dyn_' + Math.abs(Math.round(creation.x * 10)) + '_' + Math.abs(Math.round(creation.z * 10));
  if (!TOWN_LOCATIONS[dynId] && !skipPin) {
    TOWN_LOCATIONS[dynId] = {
      id: dynId,
      name: creation.title.slice(0, 24),
      building: creation.title,
      icon: creation.emoji || '✨',
      x: creation.x,
      z: creation.z,
      labelY: groundY + 3.2,
      showPin: true,
      pinColor: 'from-fuchsia-500/90 to-indigo-600/90'
    };
    createPOILabelsDOM();
  }
}

// 3I. FLOATING 3D BUILDING PINS IN THE VIEWPORT
function createPOILabelsDOM() {
  const container = document.getElementById('poiLabelsContainer');
  if(!container) return;
  container.innerHTML = '';
  poiDomElements = {};

  Object.values(TOWN_LOCATIONS).forEach(loc => {
    if (!loc.showPin) return;
    // Dynamically compute pin height above exact ground elevation so mountain pins sit above the peaks!
    loc.groundY = getIslandGroundHeight(loc.x, loc.z);
    const el = document.createElement('div');
    el.className = 'poi-label';
    el.innerHTML = `
      <div class="px-2.5 py-1 rounded-full bg-gradient-to-r ${loc.pinColor} text-white text-[11px] font-bold shadow-lg border border-white/25 flex items-center gap-1 whitespace-nowrap">
        <span>${loc.icon}</span>
        <span>${loc.name}</span>
      </div>
    `;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      handleUserLocationSuggestion(loc.id, 'pin');
    });
    container.appendChild(el);
    poiDomElements[loc.id] = el;
  });
}
