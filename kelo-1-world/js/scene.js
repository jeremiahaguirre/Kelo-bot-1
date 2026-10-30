// Kelo-bot-1 — js/scene.js
// Loaded SECOND. Uses state & TOWN_LOCATIONS from js/agent.js to render the 3D Kelowna world,
// continuous mountain/valley altitude raycasting, 3D mining/welding tools, and Bird's-Eye flight.

let scene, camera, renderer, controls, clock;
let hemiLight, sunLight, forgeArcLight, skyUniforms;
let terrainSwapGroup, keloGroup, keloHead, keloLeftEye, keloRightEye, keloLeftArm, keloRightArm, keloLeftLeg, keloRightLeg;
let keloDrillToolGroup, keloDrillBitMesh, keloWeldTorchGroup, keloWeldTipGlow;
let weldingSparks, miningDebrisParticles, emergentCreationsGroup;
let sailboatGroup, ogopogoGroup, birdFlockGroup;
let cutawayRoofMeshes = [], gardenCropGroups = [], pennantFlags = [];
let poiDomElements = {};
const downRaycaster = new THREE.Raycaster();

function getAnalyticalGroundHeight(x, z) {
      let h = Math.sin(x * 0.11) * Math.cos(z * 0.11) * 0.32;
      // Gently slope down toward Okanagan Lake shoreline in the south (z > 7)
      if (z > 7.5) {
        h -= (z - 7.5) * 0.12;
      }
      // Northern & Eastern Alpine Mountain Massif elevation (z < -12)
      if (z < -12) {
        const depthIntoMtn = Math.abs(z + 12);
        const ridgeWave = Math.cos(x * 0.16) * 2.2 + Math.sin(x * 0.08) * 3.0;
        const mtnRise = Math.pow(depthIntoMtn, 1.32) * 0.42 + Math.max(0, ridgeWave) * (depthIntoMtn * 0.12);
        h += mtnRise;
      }
      // Eastern cliff overlook rise
      if (x > 14 && z < -6) {
        h += (x - 14) * 0.28 * Math.max(0.2, Math.abs(z) / 14);
      }
      return Math.max(-0.25, h);
    }

function getIslandGroundHeight(x, z) {
      const analyticalY = getAnalyticalGroundHeight(x, z);
      if (terrainSwapGroup && terrainSwapGroup.children.length > 0) {
        downRaycaster.set(new THREE.Vector3(x, 65, z), new THREE.Vector3(0, -1, 0));
        const hits = downRaycaster.intersectObjects(terrainSwapGroup.children, true);
        if (hits.length > 0) {
          return Math.max(analyticalY, hits[0].point.y);
        }
      }
      return analyticalY;
    }

function initDiorama3D() {
      const container = document.getElementById('dioramaViewport');
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 520;

      scene = new THREE.Scene();
      scene.background = new THREE.Color(AMBIANCE_PRESETS[0].bg);
      scene.fog = new THREE.FogExp2(AMBIANCE_PRESETS[0].fog, AMBIANCE_PRESETS[0].fogDensity);

      camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 400);
      camera.position.set(0, 18, 24);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);

      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.maxPolarAngle = Math.PI / 2 - 0.03;
      controls.minDistance = 4;
      controls.maxDistance = 95;

      clock = new THREE.Clock();

      hemiLight = new THREE.HemisphereLight(AMBIANCE_PRESETS[0].hemiSky, AMBIANCE_PRESETS[0].hemiGround, 0.85);
      scene.add(hemiLight);

      sunLight = new THREE.DirectionalLight(AMBIANCE_PRESETS[0].sunColor, AMBIANCE_PRESETS[0].sunInt);
      sunLight.position.set(28, 46, 24);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 2048;
      sunLight.shadow.mapSize.height = 2048;
      sunLight.shadow.camera.left = -45;
      sunLight.shadow.camera.right = 45;
      sunLight.shadow.camera.top = 45;
      sunLight.shadow.camera.bottom = -45;
      scene.add(sunLight);

      forgeArcLight = new THREE.PointLight(0x38bdf8, 0, 9);
      forgeArcLight.position.set(-1.2, 2.1, -8.2);
      scene.add(forgeArcLight);

      buildAlpineTerrainAndMountains3D();
      buildHomesteadAndBuildings3D();
      buildKelo1Character3D();
      initEmergentCreationsLayer3D();
      createPOILabelsDOM();

      // Click anywhere on the 3D terrain or mountains to send Kelo-1 exploring!
      let pointerDownPos = { x: 0, y: 0 };
      renderer.domElement.addEventListener('pointerdown', (e) => {
        pointerDownPos = { x: e.clientX, y: e.clientY };
      });
      renderer.domElement.addEventListener('pointerup', (e) => {
        if (Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) > 6) return;
        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        if (keloGroup) {
          const hitBot = raycaster.intersectObjects(keloGroup.children, true);
          if (hitBot.length > 0) {
            petKelo1Interaction();
            return;
          }
        }
        if (terrainSwapGroup) {
          const hits = raycaster.intersectObjects(terrainSwapGroup.children, true);
          if (hits.length > 0) {
            const pt = hits[0].point;
            const rx = Math.round(pt.x * 10) / 10;
            const rz = Math.round(pt.z * 10) / 10;
            if (rz > 12) {
              splashOgopogo();
              return;
            }
            const isMountain = rz < -13 || pt.y > 2.2;
            synthesizeUnboundedExperience(
              isMountain
                ? `Hike up to mountain coordinate (${rx}, ${rz}) at +${pt.y.toFixed(1)}m altitude and core-drill for gold & minerals`
                : `Explore valley coordinate (${rx}, ${rz}) and weld an experimental 3D landmark`,
              isMountain ? 'Mountain Expedition' : 'Terrain Click',
              { x: rx, z: rz }
            );
          }
        }
      });

      window.addEventListener('resize', () => {
        if (!container) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
      });

      animateDiorama();
    }

function buildAlpineTerrainAndMountains3D() {
      terrainSwapGroup = new THREE.Group();
      scene.add(terrainSwapGroup);

      // Continuous Vertex-Displaced Valley + Alpine Mountain Mesh so Kelo-1 can walk seamlessly up the peaks!
      const groundGeo = new THREE.PlaneGeometry(96, 86, 96, 86);
      groundGeo.rotateX(-Math.PI / 2);
      const pos = groundGeo.attributes.position;
      const colors = [];

      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vz = pos.getZ(i);
        const vy = getAnalyticalGroundHeight(vx, vz);
        pos.setY(i, vy);

        // Color by altitude: Snow-capped peaks -> Slate granite cliffs -> Lush alpine meadow -> Shoreline gravel
        const c = new THREE.Color();
        if (vy > 7.2) c.setHex(0xf8fafc); // Snow cap
        else if (vy > 2.6) c.setHex(0x64748b); // Granite mountain ridge
        else if (vz > 8.2) c.setHex(0xd6d3d1); // Pebble shoreline
        else if (Math.abs(vx + 2) < 2.2 && vz > -10 && vz < 9) c.setHex(0x9ca3af); // Winding dirt trail
        else c.setHex(0x3f6212); // Okanagan valley meadow
        colors.push(c.r, c.g, c.b);
      }
      groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      groundGeo.computeVertexNormals();

      const groundMesh = new THREE.Mesh(
        groundGeo,
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, flatShading: true })
      );
      groundMesh.receiveShadow = true;
      terrainSwapGroup.add(groundMesh);

      // Okanagan Lake Water Surface in the South
      const lakeMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(110, 40),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.18, metalness: 0.35 })
      );
      lakeMesh.rotation.x = -Math.PI / 2;
      lakeMesh.position.set(0, -0.18, 26);
      scene.add(lakeMesh);

      // Conifer Forest (Douglas Firs around the foothills)
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
      const needleMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.8, flatShading: true });
      for (let i = 0; i < 38; i++) {
        const tx = (Math.random() - 0.5) * 68;
        const tz = -11 - Math.random() * 24;
        if (Math.hypot(tx - (-15.5), tz - (-26.5)) < 4.0) continue; // Keep gold vein clear
        const ty = getAnalyticalGroundHeight(tx, tz);
        if (ty > 9.5) continue;
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 1.2, 6), trunkMat);
        trunk.position.y = 0.6;
        const cone1 = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.4, 7), needleMat);
        cone1.position.y = 1.8;
        const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.0, 7), needleMat);
        cone2.position.y = 2.9;
        tree.add(trunk, cone1, cone2);
        tree.position.set(tx, ty, tz);
        scene.add(tree);
      }

      // Sailboat & Ogopogo on Okanagan Lake
      sailboatGroup = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.7), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
      const sail = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.9, 3), new THREE.MeshStandardMaterial({ color: 0xfef08a }));
      sail.position.y = 1.1;
      sailboatGroup.add(hull, sail);
      sailboatGroup.position.set(-8, -0.15, 15.5);
      scene.add(sailboatGroup);

      ogopogoGroup = new THREE.Group();
      for (let h = 0; h < 3; h++) {
        const hump = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 10), new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.4 }));
        hump.position.x = h * 0.85;
        ogopogoGroup.add(hump);
      }
      ogopogoGroup.position.set(6, -0.25, 16.5);
      scene.add(ogopogoGroup);

      // Soaring Alpine Bird Flock
      birdFlockGroup = new THREE.Group();
      birdFlockGroup.position.set(-20, 18, -30);
      const wingMat = new THREE.MeshBasicMaterial({ color: 0x1e293b, side: THREE.DoubleSide });
      for (let b = 0; b < 7; b++) {
        const bird = new THREE.Group();
        const lw = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.16), wingMat);
        lw.position.x = -0.22;
        const rw = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.16), wingMat);
        rw.position.x = 0.22;
        bird.add(lw, rw);
        bird.position.set((b - 3) * 1.4, (b % 2) * 0.6, (b % 3) * 0.9);
        bird.userData = { leftWing: lw, rightWing: rw, speed: 5 + b * 0.4, phase: b };
        birdFlockGroup.add(bird);
      }
      scene.add(birdFlockGroup);
    }

function buildHomesteadAndBuildings3D() {
      // 1. Kelo-1 Cutaway House (with 3D Bed & Couch)
      const houseGroup = new THREE.Group();
      const hy = getAnalyticalGroundHeight(-9.5, -7.8);
      houseGroup.position.set(-9.5, hy, -7.8);
      const floor = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.25, 5.2), new THREE.MeshStandardMaterial({ color: 0x78350f }));
      const backWall = new THREE.Mesh(new THREE.BoxGeometry(6.4, 2.8, 0.25), new THREE.MeshStandardMaterial({ color: 0xfef3c7 }));
      backWall.position.set(0, 1.4, -2.5);
      // 3D Bed
      const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.45, 1.5), new THREE.MeshStandardMaterial({ color: 0x10b981 }));
      bedFrame.position.set(-1.8, 0.35, -1.2);
      // 3D Couch
      const couchMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.65, 1.1), new THREE.MeshStandardMaterial({ color: 0xf59e0b }));
      couchMesh.position.set(1.5, 0.45, 0.8);
      // Cutaway Roof
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(4.8, 2.0, 4),
        new THREE.MeshStandardMaterial({ color: 0xb45309, transparent: true, opacity: 0.18 })
      );
      roof.position.set(0, 3.6, 0);
      roof.rotation.y = Math.PI / 4;
      cutawayRoofMeshes.push(roof);
      houseGroup.add(floor, backWall, bedFrame, couchMesh, roof);
      scene.add(houseGroup);

      // 2. Outdoor TIG Welding Forge + Spark & Mining Debris Particle Systems
      const forgeGroup = new THREE.Group();
      const fy = getAnalyticalGroundHeight(-1.2, -8.2);
      forgeGroup.position.set(-1.2, fy, -8.2);
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 1.4), new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 }));
      bench.position.y = 0.45;
      const argonTank = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.6, 12), new THREE.MeshStandardMaterial({ color: 0x0d9488, metalness: 0.6 }));
      argonTank.position.set(1.4, 0.8, 0);
      forgeGroup.add(bench, argonTank);
      scene.add(forgeGroup);

      // Welding Sparks Particle System
      const sparkGeo = new THREE.BufferGeometry();
      const sparkCount = 45;
      const sparkPos = new Float32Array(sparkCount * 3);
      const sparkVels = [];
      for (let i = 0; i < sparkCount; i++) {
        sparkPos[i * 3] = -1.2;
        sparkPos[i * 3 + 1] = 1.3;
        sparkPos[i * 3 + 2] = -8.2;
        sparkVels.push({
          vx: (Math.random() - 0.5) * 0.16,
          vy: 0.08 + Math.random() * 0.14,
          vz: (Math.random() - 0.5) * 0.16,
          life: Math.random()
        });
      }
      sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
      weldingSparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0x38bdf8, size: 0.18 }));
      weldingSparks.userData.vels = sparkVels;
      weldingSparks.visible = false;
      scene.add(weldingSparks);

      // Flying Rock & Gold Ore Debris Particle System when Drilling/Mining
      const debrisGeo = new THREE.BufferGeometry();
      const debrisCount = 36;
      const debrisPos = new Float32Array(debrisCount * 3);
      const debrisVels = [];
      for (let i = 0; i < debrisCount; i++) {
        debrisPos[i * 3] = 0;
        debrisPos[i * 3 + 1] = 0;
        debrisPos[i * 3 + 2] = 0;
        debrisVels.push({
          vx: (Math.random() - 0.5) * 0.22,
          vy: 0.12 + Math.random() * 0.18,
          vz: (Math.random() - 0.5) * 0.22,
          life: Math.random()
        });
      }
      debrisGeo.setAttribute('position', new THREE.BufferAttribute(debrisPos, 3));
      miningDebrisParticles = new THREE.Points(debrisGeo, new THREE.PointsMaterial({ color: 0xfacc15, size: 0.24 }));
      miningDebrisParticles.userData.vels = debrisVels;
      miningDebrisParticles.visible = false;
      scene.add(miningDebrisParticles);

      // 3. 4 Raised Bio-Garden Planters
      gardenCropGroups = [];
      for (let p = 0; p < 4; p++) {
        const gx = -11.5 + (p % 2) * 2.4;
        const gz = 1.6 + Math.floor(p / 2) * 1.8;
        const gy = getAnalyticalGroundHeight(gx, gz);
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 1.2), new THREE.MeshStandardMaterial({ color: 0x92400e }));
        box.position.set(gx, gy + 0.22, gz);
        scene.add(box);
        const cropCluster = new THREE.Group();
        cropCluster.position.set(gx, gy + 0.5, gz);
        const fruitMat = new THREE.MeshStandardMaterial({ color: p % 2 === 0 ? 0xf97316 : 0xef4444 });
        for (let c = -1; c <= 1; c++) {
          const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), fruitMat);
          orb.position.x = c * 0.45;
          cropCluster.add(orb);
        }
        scene.add(cropCluster);
        gardenCropGroups.push(cropCluster);
      }

      // 4. Bean & Byte Espresso Cafe & NetNode Internet Cafe
      const cafeY = getAnalyticalGroundHeight(-1.5, 3.5);
      const cafeMesh = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.4, 2.8), new THREE.MeshStandardMaterial({ color: 0xea580c }));
      cafeMesh.position.set(-1.5, cafeY + 1.2, 3.5);
      scene.add(cafeMesh);

      const cyberY = getAnalyticalGroundHeight(6.8, 2.2);
      const cyberMesh = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.5, 3.0), new THREE.MeshStandardMaterial({ color: 0x4f46e5 }));
      cyberMesh.position.set(6.8, cyberY + 1.25, 2.2);
      scene.add(cyberMesh);
    }

function buildKelo1Character3D() {
      keloGroup = new THREE.Group();

      // Chassis & Supply Backpack with Argon Cylinder & Gold Ore Pouch
      const torso = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 1.15, 0.78),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.45, roughness: 0.28 })
      );
      torso.position.set(0, 1.32, 0);
      torso.castShadow = true;
      keloGroup.add(torso);

      const backpack = new THREE.Mesh(
        new THREE.BoxGeometry(0.82, 0.85, 0.42),
        new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 })
      );
      backpack.position.set(0, 1.36, -0.55);
      keloGroup.add(backpack);

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
    }

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
        // Gleaming gold ore nuggets unearthed around the drill hole
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

function createPOILabelsDOM() {
      const container = document.getElementById('poiLabelsContainer');
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

function animateDiorama() {
      requestAnimationFrame(animateDiorama);
      const t = clock.getElapsedTime();

      // 0. Bird's-Eye View Arrow-Key / WASD Map Panning
      const panLeft = arrowKeyState.ArrowLeft || arrowKeyState.KeyA;
      const panRight = arrowKeyState.ArrowRight || arrowKeyState.KeyD;
      const panUp = arrowKeyState.ArrowUp || arrowKeyState.KeyW;
      const panDown = arrowKeyState.ArrowDown || arrowKeyState.KeyS;

      if (panLeft || panRight || panUp || panDown) {
        if (state.cameraMode !== 'bird') {
          state.cameraMode = 'bird';
          updateCameraButtonsUI();
          // Elevate camera smoothly into a high bird's-eye angle if it was low
          if (camera.position.y < 22) {
            camera.position.y = 28;
          }
        }
        const panSpeed = 0.52;
        // Pan relative to camera horizontal heading so arrow keys always feel natural
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        const moveDelta = new THREE.Vector3();
        if (panUp) moveDelta.addScaledVector(forward, panSpeed);
        if (panDown) moveDelta.addScaledVector(forward, -panSpeed);
        if (panRight) moveDelta.addScaledVector(right, panSpeed);
        if (panLeft) moveDelta.addScaledVector(right, -panSpeed);

        controls.target.add(moveDelta);
        camera.position.add(moveDelta);

        // Keep bird's-eye camera within island & mountain bounds
        controls.target.x = Math.max(-48, Math.min(48, controls.target.x));
        controls.target.z = Math.max(-52, Math.min(28, controls.target.z));
      }

      // 1. Walk Kelo-1 smoothly to Target Location while clamping strictly ON TOP of any terrain altitude!
      const dx = state.targetPos.x - state.botPos.x;
      const dz = state.targetPos.z - state.botPos.z;
      const dist = Math.hypot(dx, dz);

      // Determine which 3D hand tool Kelo-1 is actively holding
      const textContext = `${state.moodTitle} ${state.speechBubble} ${state.customPlaceName || ''}`.toLowerCase();
      const isMiningOrDrilling = state.currentLocKey === 'mountain_peak' || /drill|gold|mine|auger|ore|quarry|excavat|mycelium/i.test(textContext);
      const isWeldingOrBuilding = state.currentLocKey === 'weld' || Boolean(state.proceduralMotion?.sparkBurst) || /weld|forge|titanium|track|rail|sculpt|arch|spire/i.test(textContext);

      if (keloDrillToolGroup && keloWeldTorchGroup) {
        keloDrillToolGroup.visible = isMiningOrDrilling;
        keloWeldTorchGroup.visible = !isMiningOrDrilling && isWeldingOrBuilding;
      }

      if (dist > 0.16) {
        state.isWalking = true;
        const step = dist > 14 ? 0.14 : 0.082;
        state.botPos.x += (dx / dist) * step;
        state.botPos.z += (dz / dist) * step;
        state.botRotY = Math.atan2(dx, dz);

        const groundY = getIslandGroundHeight(state.botPos.x, state.botPos.z);
        state.botAltitudeY = groundY;
        // Always stay strictly >= groundY (never sink below the mountain or valley floor!)
        const strideHop = Math.abs(Math.sin(t * 9.5)) * 0.12;
        keloGroup.position.set(state.botPos.x, groundY + strideHop, state.botPos.z);
        keloGroup.rotation.set(0, state.botRotY, 0);
        keloLeftLeg.rotation.x = Math.sin(t * 9.5) * 0.5;
        keloRightLeg.rotation.x = -Math.sin(t * 9.5) * 0.5;
        keloLeftArm.rotation.x = -Math.sin(t * 9.5) * 0.4;
        keloRightArm.rotation.x = (isMiningOrDrilling || isWeldingOrBuilding) ? -0.65 : Math.sin(t * 9.5) * 0.4;

        if (keloDrillBitMesh && isMiningOrDrilling) keloDrillBitMesh.rotation.z = t * 18;
        keloHead.rotation.y = Math.sin(t * 2.2) * 0.28;
        keloHead.rotation.z = Math.sin(t * 1.7) * 0.12;
        keloHead.rotation.x = 0;
        weldingSparks.visible = false;
        if (miningDebrisParticles) miningDebrisParticles.visible = false;
        forgeArcLight.intensity = 0;
      } else {
        state.isWalking = false;
        const groundY = getIslandGroundHeight(state.botPos.x, state.botPos.z);
        state.botAltitudeY = groundY;
        keloLeftLeg.rotation.x = 0;
        keloRightLeg.rotation.x = 0;
        keloLeftArm.rotation.x = 0;
        keloRightArm.rotation.x = 0;

        if (state.currentLocKey === 'bed') {
          keloGroup.position.set(-11.6, Math.max(groundY, 0.95), -8.8);
          keloGroup.rotation.set(-Math.PI / 2, 0, 0);
          keloHead.rotation.set(0, 0, 0);
          weldingSparks.visible = false;
          if (miningDebrisParticles) miningDebrisParticles.visible = false;
          forgeArcLight.intensity = 0;
        } else if (isMiningOrDrilling) {
          // ACTIVE 3D MOUNTAIN GOLD DRILLING / AUGERING POSE WITH SPINNING BIT & FLYING ROCK/GOLD DEBRIS!
          const drillVibration = Math.abs(Math.sin(t * 28)) * 0.05;
          keloGroup.position.set(state.botPos.x, groundY + drillVibration, state.botPos.z);
          keloGroup.rotation.set(0, state.botRotY, 0);
          keloRightArm.rotation.x = -Math.PI / 2.6 + Math.sin(t * 24) * 0.08;
          keloLeftArm.rotation.x = -0.55;
          keloHead.rotation.x = 0.28;
          keloHead.rotation.z = Math.sin(t * 4) * 0.1;
          if (keloDrillBitMesh) keloDrillBitMesh.rotation.z = t * 28;

          weldingSparks.visible = true;
          if (miningDebrisParticles) {
            miningDebrisParticles.visible = true;
            const mAttr = miningDebrisParticles.geometry.attributes.position;
            const mVels = miningDebrisParticles.userData.vels;
            const drillTipX = state.botPos.x + Math.sin(state.botRotY) * 0.85;
            const drillTipZ = state.botPos.z + Math.cos(state.botRotY) * 0.85;
            for (let i = 0; i < mVels.length; i++) {
              mVels[i].life += 0.055;
              if (mVels[i].life >= 1) {
                mAttr.setXYZ(i, drillTipX, groundY + 0.35, drillTipZ);
                mVels[i].life = 0;
              } else {
                mAttr.setXYZ(
                  i,
                  mAttr.getX(i) + mVels[i].vx,
                  Math.max(groundY + 0.05, mAttr.getY(i) + mVels[i].vy - mVels[i].life * 0.14),
                  mAttr.getZ(i) + mVels[i].vz
                );
              }
            }
            mAttr.needsUpdate = true;
          }
          // Also burst bright sparks at the drill bit contact point
          const posAttr = weldingSparks.geometry.attributes.position;
          const vels = weldingSparks.userData.vels;
          for (let i = 0; i < vels.length; i++) {
            vels[i].life += 0.07;
            if (vels[i].life >= 1) {
              posAttr.setXYZ(i, state.botPos.x, groundY + 0.9, state.botPos.z);
              vels[i].life = 0;
            } else {
              posAttr.setXYZ(
                i,
                posAttr.getX(i) + vels[i].vx,
                Math.max(groundY + 0.1, posAttr.getY(i) + vels[i].vy - vels[i].life * 0.08),
                posAttr.getZ(i) + vels[i].vz
              );
            }
          }
          posAttr.needsUpdate = true;
        } else if (state.currentLocKey === 'weld' || isWeldingOrBuilding) {
          keloGroup.position.set(state.botPos.x, groundY, state.botPos.z);
          keloGroup.rotation.set(0, state.currentLocKey === 'weld' ? Math.PI : state.botRotY, 0);
          keloRightArm.rotation.x = -Math.PI / 2.4 + Math.sin(t * 16) * 0.12;
          keloHead.rotation.z = 0.18 * Math.sin(t * 1.5);
          keloHead.rotation.x = 0.22;
          weldingSparks.visible = true;
          if (miningDebrisParticles) miningDebrisParticles.visible = false;
          forgeArcLight.intensity = 1.5 + Math.random() * 2.0;

          const sparkOriginX = state.currentLocKey === 'weld' ? -1.2 : state.botPos.x;
          const sparkOriginZ = state.currentLocKey === 'weld' ? -8.2 : state.botPos.z;
          const sparkOriginY = groundY + 1.35;

          const posAttr = weldingSparks.geometry.attributes.position;
          const vels = weldingSparks.userData.vels;
          for (let i = 0; i < vels.length; i++) {
            vels[i].life += 0.06;
            if (vels[i].life >= 1) {
              posAttr.setXYZ(i, sparkOriginX, sparkOriginY, sparkOriginZ);
              vels[i].life = 0;
            } else {
              posAttr.setXYZ(
                i,
                posAttr.getX(i) + vels[i].vx,
                Math.max(groundY + 0.05, posAttr.getY(i) + vels[i].vy - vels[i].life * 0.08),
                posAttr.getZ(i) + vels[i].vz
              );
            }
          }
          posAttr.needsUpdate = true;
        } else if (state.currentLocKey === 'cyber') {
          keloGroup.position.set(6.8, Math.max(groundY, 0.2), 2.2);
          keloGroup.rotation.set(0, Math.PI, 0);
          const typingBurst = Math.sin(t * 1.5) > -0.2;
          keloLeftArm.rotation.x = typingBurst ? -0.8 + Math.sin(t * 16) * 0.14 : -0.4;
          keloRightArm.rotation.x = typingBurst ? -0.8 + Math.cos(t * 16) * 0.14 : -1.1;
          keloHead.rotation.z = typingBurst ? 0.05 : 0.24;
          keloHead.rotation.y = Math.sin(t * 0.9) * 0.2;
          weldingSparks.visible = false;
          if (miningDebrisParticles) miningDebrisParticles.visible = false;
          forgeArcLight.intensity = 0;
        } else if (state.currentLocKey === 'shoreline' && Math.hypot(state.botPos.x - 4.2, state.botPos.z - 10.2) < 2.2) {
          // Sitting right on the flat shoreline stones above the water surface
          keloGroup.position.set(state.botPos.x, Math.max(groundY, 0.05), state.botPos.z);
          keloGroup.rotation.set(0, 0, 0);
          keloLeftLeg.rotation.x = -Math.PI / 2.3 + Math.sin(t * 2.4) * 0.18;
          keloRightLeg.rotation.x = -Math.PI / 2.3 - Math.sin(t * 2.4) * 0.18;
          keloHead.rotation.z = Math.sin(t * 1.1) * 0.22;
          keloHead.rotation.x = -0.1 + Math.sin(t * 0.8) * 0.1;
          weldingSparks.visible = false;
          if (miningDebrisParticles) miningDebrisParticles.visible = false;
          forgeArcLight.intensity = 0;
        } else if (state.currentLocKey === 'meadow' || state.microPose === 'crouch_inspect') {
          // Crouching on top of the terrain without sinking below groundY!
          keloGroup.position.set(state.botPos.x, groundY + Math.abs(Math.sin(t * 2)) * 0.03, state.botPos.z);
          keloLeftLeg.rotation.x = 0.35;
          keloRightLeg.rotation.x = 0.35;
          keloRightArm.rotation.x = -0.75 + Math.sin(t * 3) * 0.1;
          keloHead.rotation.x = 0.35;
          keloHead.rotation.z = 0.28 * Math.sin(t * 1.3);
          weldingSparks.visible = false;
          if (miningDebrisParticles) miningDebrisParticles.visible = false;
          forgeArcLight.intensity = 0;
        } else if (state.microPose === 'procedural_custom') {
          // UNBOUNDED PROCEDURAL POSE: Clamped strictly >= groundY so he never sinks into mountains!
          const pm = state.proceduralMotion || {};
          const bounce = Math.abs(Math.sin(t * 3.2)) * (pm.bodyBounceAmp ?? 0.06);
          const safeOffset = Math.max(0, pm.crouchOffset ?? 0);
          keloGroup.position.set(state.botPos.x, groundY + safeOffset + bounce, state.botPos.z);
          if (pm.spinSpeed) {
            keloGroup.rotation.y += pm.spinSpeed * 0.02;
          } else {
            keloGroup.rotation.set(0, state.botRotY, 0);
          }
          keloLeftArm.rotation.x = (pm.armRaiseOffset ?? -0.5) + Math.sin(t * 4.5) * (pm.armWaveAmp ?? 0.35);
          keloRightArm.rotation.x = (pm.armRaiseOffset ?? -0.5) + Math.cos(t * 4.5) * (pm.armWaveAmp ?? 0.35);
          keloHead.rotation.x = (pm.headPitch ?? -0.15) + Math.sin(t * 1.6) * 0.12;
          keloHead.rotation.y = Math.sin(t * (pm.headYawSpeed ?? 1.4)) * 0.38;
          keloHead.rotation.z = Math.sin(t * 1.9) * (pm.headTiltAmp ?? 0.24);
          if (miningDebrisParticles) miningDebrisParticles.visible = false;
        } else {
          // Expressive curious idle: always stays on top of groundY
          keloGroup.position.set(state.botPos.x, groundY + Math.abs(Math.sin(t * 2.5)) * 0.04, state.botPos.z);
          keloGroup.rotation.set(0, state.botRotY, 0);
          keloHead.rotation.y = Math.sin(t * 1.1) * 0.32;
          keloHead.rotation.z = Math.sin(t * 0.8) * 0.15;
          keloHead.rotation.x = Math.sin(t * 0.6) * 0.08;
          weldingSparks.visible = false;
          if (miningDebrisParticles) miningDebrisParticles.visible = false;
          forgeArcLight.intensity = 0;
        }
      }

      // Update live altitude & tool readout in the Bird's-Eye HUD
      const altReadout = document.getElementById('keloAltitudeReadout');
      if (altReadout) {
        const activeToolLabel = isMiningOrDrilling ? '⛏️ Core Drill' : (isWeldingOrBuilding ? '⚡ TIG Welder' : '🎒 Explorer Pack');
        altReadout.textContent = `Alt: +${state.botAltitudeY.toFixed(1)}m • ${activeToolLabel}`;
      }

      // 2. Scale Garden Crops smoothly based on ripeness
      state.gardenPlots.forEach((plot, idx) => {
        const cluster = gardenCropGroups[idx];
        if (cluster) {
          const s = 0.35 + (plot.growth / 100) * 0.75;
          cluster.scale.set(s, s, s);
        }
      });

      // 3. Bob Sailboat, Ogopogo, Soaring Alpine Birds & Wind-Swept Conifers/Pennants
      if (emergentCreationsGroup) {
        emergentCreationsGroup.children.forEach(group => {
          group.children.forEach(mesh => {
            if (mesh.userData && mesh.userData.spin) {
              mesh.rotation.y = t * 0.85;
            }
          });
        });
      }
      if (sailboatGroup) {
        sailboatGroup.position.y = -0.22 + Math.sin(t * 2.2) * 0.07;
        sailboatGroup.rotation.z = Math.sin(t * 1.8) * 0.05;
      }
      if (ogopogoGroup) {
        ogopogoGroup.position.y = -0.3 + Math.sin(t * 3.0) * 0.12;
        ogopogoGroup.position.x = 6 + Math.sin(t * 0.45) * 4.5;
      }
      if (birdFlockGroup) {
        birdFlockGroup.position.x = -20 + Math.sin(t * 0.18) * 12;
        birdFlockGroup.position.z = -32 + Math.cos(t * 0.18) * 5;
        birdFlockGroup.children.forEach(bird => {
          const flap = Math.sin(t * bird.userData.speed + bird.userData.phase) * 0.45;
          bird.userData.leftWing.rotation.z = flap;
          bird.userData.rightWing.rotation.z = -flap;
        });
      }
      pennantFlags.forEach(flag => {
        flag.rotation.z = flag.userData.baseRotZ + Math.sin(t * 4.2 + flag.userData.phase) * 0.18;
      });

      // 4. Camera Follow & Bird's-Eye Modes
      if (state.cameraMode === 'follow') {
        controls.target.lerp(new THREE.Vector3(keloGroup.position.x, keloGroup.position.y + 1.6, keloGroup.position.z), 0.08);
      } else if (state.cameraMode === 'bird') {
        // Keep target clamped to terrain elevation while allowing free Arrow-Key / WASD exploration
        const targetGroundY = getIslandGroundHeight(controls.target.x, controls.target.z);
        controls.target.y = THREE.MathUtils.lerp(controls.target.y, targetGroundY + 1.0, 0.1);
      } else if (state.cameraMode === 'overview') {
        controls.target.lerp(new THREE.Vector3(0, 0.5, -1), 0.08);
        camera.position.lerp(new THREE.Vector3(0, 22, 27), 0.05);
      } else if (state.cameraMode === 'house') {
        controls.target.lerp(new THREE.Vector3(-9.2, 1.4, -8.0), 0.08);
        camera.position.lerp(new THREE.Vector3(-9.2, 9.5, 0.5), 0.05);
      } else if (state.cameraMode === 'cafes') {
        controls.target.lerp(new THREE.Vector3(0, 1.5, 3.2), 0.08);
        camera.position.lerp(new THREE.Vector3(0, 11.5, 15.5), 0.05);
      }

      controls.update();
      renderer.render(scene, camera);

      // 5. Project 3D Labels & Kelo-1 Speech Bubble to 2D Screen
      projectLabelsToScreen();
    }

function projectLabelsToScreen() {
      const viewport = document.getElementById('dioramaViewport');
      if (!viewport || !keloGroup) return;
      const w = viewport.clientWidth;
      const h = viewport.clientHeight;

      // Project Kelo-1 Overhead Bubble
      const keloHud = document.getElementById('keloOverheadHUD');
      const headVec = new THREE.Vector3(keloGroup.position.x, keloGroup.position.y + 3.45, keloGroup.position.z);
      headVec.project(camera);
      if (headVec.z > 1) {
        keloHud.style.opacity = '0';
      } else {
        keloHud.style.opacity = '1';
        keloHud.style.left = `${(headVec.x * 0.5 + 0.5) * w}px`;
        keloHud.style.top = `${(-(headVec.y * 0.5) + 0.5) * h}px`;
      }

      // Project Building & Mountain Pins (anchored above exact terrain elevation!)
      Object.values(TOWN_LOCATIONS).forEach(loc => {
        const el = poiDomElements[loc.id];
        if (!el) return;
        const pinBaseY = (typeof loc.groundY === 'number') ? loc.groundY : getIslandGroundHeight(loc.x, loc.z);
        const v = new THREE.Vector3(loc.x, pinBaseY + 3.6, loc.z);
        v.project(camera);
        if (v.z > 1) {
          el.style.opacity = '0';
        } else {
          el.style.opacity = '1';
          el.style.left = `${(v.x * 0.5 + 0.5) * w}px`;
          el.style.top = `${(-(v.y * 0.5) + 0.5) * h}px`;
        }
      });
    }