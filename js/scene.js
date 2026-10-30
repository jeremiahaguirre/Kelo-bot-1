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
// Solid things Kelo-1 should walk around: { x, z, r } circles on the ground
let worldObstacles = [];
// Cursor position over the 3D view, used to reveal names on hover
const hoverPointer = { x: 0, y: 0, active: false, touchUntil: 0 };
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

      hemiLight = new THREE.HemisphereLight(AMBIANCE_PRESETS[0].hemiSky, AMBIANCE_PRESETS[0].hemiGround, 0.8);
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
      sunLight.shadow.bias = -0.0006;
      sunLight.shadow.normalBias = 0.02;
      scene.add(sunLight);

      forgeArcLight = new THREE.PointLight(0x38bdf8, 0, 9);
      forgeArcLight.position.set(-1.2, 2.1, -8.2);
      scene.add(forgeArcLight);

      buildAlpineTerrainAndMountains3D();
      buildHomesteadAndBuildings3D();
      if (typeof renderPostOfficeParcels3D === 'function') renderPostOfficeParcels3D();
      // Scenery goes last so trees and rocks keep clear of every building
      buildValleyScenery3D();
      buildKelo1Character3D();
      initEmergentCreationsLayer3D();
      createPOILabelsDOM();

      // Click anywhere on the 3D terrain or mountains to send Kelo-1 exploring!
      // Track the cursor for hover-only name labels (touch: a tap shows names for a few seconds)
      const hoverRaycaster = new THREE.Raycaster();
      const updateHover = (e, isTouch) => {
        const rect = renderer.domElement.getBoundingClientRect();
        hoverPointer.x = e.clientX - rect.left;
        hoverPointer.y = e.clientY - rect.top;
        hoverPointer.active = true;
        hoverPointer.touchUntil = isTouch ? Date.now() + 3500 : 0;
        if (typeof setHoveredParcelLabel === 'function') {
          hoverRaycaster.setFromCamera(new THREE.Vector2((hoverPointer.x / rect.width) * 2 - 1, -(hoverPointer.y / rect.height) * 2 + 1), camera);
          setHoveredParcelLabel(hoverRaycaster);
        }
      };
      renderer.domElement.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') updateHover(e, false); });
      renderer.domElement.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hoverPointer.active = false; });

      let pointerDownPos = { x: 0, y: 0 };
      renderer.domElement.addEventListener('pointerdown', (e) => {
        pointerDownPos = { x: e.clientX, y: e.clientY };
        if (e.pointerType !== 'mouse') updateHover(e, true);
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

        // Stylized palette by altitude, with gentle variation so the ground doesn't look flat
        const c = new THREE.Color();
        const wobble = Math.sin(vx * 0.9) * Math.cos(vz * 0.7) * 0.5 + Math.sin(vx * 0.23 + vz * 0.31) * 0.5;
        if (vy > 8.5) c.setHex(0xf4f8ff); // Snow cap
        else if (vy > 2.6) c.setHex(0x6f7a8f).lerp(new THREE.Color(0x58627a), Math.max(0, wobble)); // Rocky ridge
        else if (vz > 8.2) c.setHex(0xf6e3a8); // Sandy beach
        else if (Math.abs(vx + 2) < 2.0 && vz > -10 && vz < 9) c.setHex(0xe9c98b); // Dirt trail
        else c.setHex(0x5ccf3e).lerp(new THREE.Color(0x3fae2e), Math.max(0, wobble)); // Bright meadow grass
        colors.push(c.r, c.g, c.b);
      }
      groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      groundGeo.computeVertexNormals();

      const groundMesh = new THREE.Mesh(
        groundGeo,
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })
      );
      groundMesh.receiveShadow = true;
      terrainSwapGroup.add(groundMesh);

      // Okanagan Lake Water Surface in the South
      const lakeMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(110, 40),
        new THREE.MeshStandardMaterial({ color: 0x1288c9, roughness: 0.15, metalness: 0.15, transparent: true, opacity: 0.94 })
      );
      lakeMesh.rotation.x = -Math.PI / 2;
      lakeMesh.position.set(0, -0.18, 26);
      scene.add(lakeMesh);

      // Conifer Forest (Douglas Firs around the foothills)
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 });
      const needleMat = new THREE.MeshStandardMaterial({ color: 0x1f9a4b, roughness: 0.75 });
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
        worldObstacles.push({ x: tx, z: tz, r: 0.6 });
      }

      buildSkyAndClouds3D();

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
      const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.3), new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.8, roughness: 0.3 }));
      anvil.position.set(-0.6, 1.08, 0);
      const forgeSign = makeSignMesh('WELDING STUDIO', { bg: '#0f172a', fg: '#38bdf8', width: 2.2, height: 0.4 });
      forgeSign.position.set(0, 1.9, -0.75);
      const signPost = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.08), new THREE.MeshStandardMaterial({ color: 0x475569 }));
      signPost.position.set(0, 1.0, -0.8);
      forgeGroup.add(bench, argonTank, anvil, signPost, forgeSign);
      scene.add(forgeGroup);
      worldObstacles.push({ x: -1.2, z: -8.2, r: 1.5 });

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

      // 3. 4 Raised Bio-Garden Planters, each growing a crop you can tell apart at a glance
      gardenCropGroups = [];
      const cropBuilders = [buildPeachTree3D, buildTomatoVines3D, buildCarrotRow3D, buildBlueberryBushes3D];
      const cropLabels = ['PEACHES', 'TOMATOES', 'CARROTS', 'BLUEBERRIES'];
      for (let p = 0; p < 4; p++) {
        const gx = -11.5 + (p % 2) * 2.4;
        const gz = 1.6 + Math.floor(p / 2) * 1.8;
        const gy = getAnalyticalGroundHeight(gx, gz);
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 1.2), new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.9 }));
        box.position.set(gx, gy + 0.22, gz);
        box.castShadow = true;
        const soil = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.05, 1.05), new THREE.MeshStandardMaterial({ color: 0x3f2a14, roughness: 1 }));
        soil.position.set(gx, gy + 0.46, gz);
        const label = makeSignMesh(cropLabels[p], { bg: '#fef3c7', fg: '#78350f', width: 0.9, height: 0.22 });
        label.position.set(gx, gy + 0.3, gz + 0.61);
        scene.add(box, soil, label);
        worldObstacles.push({ x: gx, z: gz, r: 1.0 });
        const cropCluster = cropBuilders[p]();
        cropCluster.position.set(gx, gy + 0.48, gz);
        scene.add(cropCluster);
        gardenCropGroups.push(cropCluster);
      }

      // 4. Bean & Byte Espresso Cafe & NetNode Internet Cafe
      buildCafe3D();
      buildNetNode3D();

      buildPostOffice3D();
    }

// --- Stylized sky, clouds, round trees, flowers and rocks ---------------------------------------
let skyDome = null;
let cloudGroup = null;

function buildSkyAndClouds3D() {
      const preset = AMBIANCE_PRESETS[state.lightingIdx] || AMBIANCE_PRESETS[0];
      skyDome = new THREE.Mesh(
        new THREE.SphereGeometry(180, 32, 16),
        new THREE.ShaderMaterial({
          side: THREE.BackSide,
          depthWrite: false,
          fog: false,
          uniforms: { topColor: { value: new THREE.Color(preset.skyTop) }, horizonColor: { value: new THREE.Color(preset.skyHorizon) } },
          vertexShader: 'varying vec3 vPos; void main() { vPos = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }',
          fragmentShader: 'uniform vec3 topColor; uniform vec3 horizonColor; varying vec3 vPos; void main() { float h = clamp(normalize(vPos).y * 1.6 + 0.08, 0.0, 1.0); gl_FragColor = vec4(mix(horizonColor, topColor, pow(h, 0.7)), 1.0); }'
        })
      );
      scene.add(skyDome);

      // Puffy cartoon clouds that drift slowly
      cloudGroup = new THREE.Group();
      const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.25 });
      for (let i = 0; i < 12; i++) {
        const cloud = new THREE.Group();
        const puffs = 3 + Math.floor(Math.random() * 3);
        for (let k = 0; k < puffs; k++) {
          const puff = new THREE.Mesh(new THREE.SphereGeometry(1.6 + Math.random() * 1.4, 14, 10), cloudMat);
          puff.position.set(k * 1.9 - puffs, Math.random() * 0.8, Math.random() * 1.2);
          puff.scale.y = 0.7;
          cloud.add(puff);
        }
        cloud.position.set((Math.random() - 0.5) * 140, 26 + Math.random() * 12, -70 + Math.random() * 90);
        cloud.userData.speed = 0.4 + Math.random() * 0.6;
        cloudGroup.add(cloud);
      }
      scene.add(cloudGroup);
    }

function updateClouds(dt) {
      if (!cloudGroup) return;
      cloudGroup.children.forEach(c => {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 80) c.position.x = -80;
      });
    }

// Round, bright deciduous trees, flowers and boulders around the valley (kept off paths and buildings)
function buildValleyScenery3D() {
      const leafColors = [0x4cc93b, 0x7ad94a, 0x36b37e, 0xf2a93b];
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 });
      const clearOf = (x, z, r) => !worldObstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.r + r)
        && !Object.values(TOWN_LOCATIONS).some(l => Math.hypot(x - l.x, z - l.z) < r + 2.2)
        && Math.abs(x + 2) > 3 && z < 7.5;
      let placed = 0;
      for (let i = 0; i < 140 && placed < 26; i++) {
        const x = (Math.random() - 0.5) * 64;
        const z = -11 + Math.random() * 18;
        if (!clearOf(x, z, 1.4) || Math.hypot(x + 9.5, z + 7.8) < 5) continue;
        const gy = getAnalyticalGroundHeight(x, z);
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.4, 8), trunkMat);
        trunk.position.y = 0.7;
        trunk.castShadow = true;
        tree.add(trunk);
        const leafMat = new THREE.MeshStandardMaterial({ color: leafColors[placed % leafColors.length], roughness: 0.8 });
        [[0, 1.9, 0, 1.05], [0.55, 1.6, 0.2, 0.7], [-0.5, 1.65, -0.15, 0.75]].forEach(([lx, ly, lz, r]) => {
          const blob = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), leafMat);
          blob.position.set(lx, ly, lz);
          blob.castShadow = true;
          tree.add(blob);
        });
        tree.position.set(x, gy, z);
        tree.rotation.y = Math.random() * Math.PI;
        scene.add(tree);
        worldObstacles.push({ x, z, r: 0.75 });
        placed++;
      }

      // Little flower patches and smooth boulders (decor only, small enough to walk past)
      const petalColors = [0xff5d8f, 0xffd23f, 0xffffff, 0xa78bfa, 0xff8c42];
      for (let i = 0; i < 70; i++) {
        const x = (Math.random() - 0.5) * 60;
        const z = -10 + Math.random() * 17;
        if (!clearOf(x, z, 0.4)) continue;
        const gy = getAnalyticalGroundHeight(x, z);
        const flower = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 4), new THREE.MeshStandardMaterial({ color: 0x2f9e44 }));
        stem.position.y = 0.15;
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshStandardMaterial({ color: petalColors[i % petalColors.length], emissive: petalColors[i % petalColors.length], emissiveIntensity: 0.15 }));
        bloom.position.y = 0.32;
        flower.add(stem, bloom);
        flower.position.set(x, gy, z);
        scene.add(flower);
      }
      const rockMat = new THREE.MeshStandardMaterial({ color: 0xa3a9b8, roughness: 0.85 });
      for (let i = 0; i < 14; i++) {
        const x = (Math.random() - 0.5) * 60;
        const z = -10 + Math.random() * 17;
        if (!clearOf(x, z, 1.0)) continue;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.4, 1), rockMat);
        rock.scale.y = 0.6;
        rock.position.set(x, getAnalyticalGroundHeight(x, z) + 0.15, z);
        rock.castShadow = true;
        scene.add(rock);
        worldObstacles.push({ x, z, r: 0.6 });
      }
    }

// A flat sign with text drawn on a canvas, readable from the front
function makeSignMesh(text, { bg = '#1e293b', fg = '#f8fafc', width = 2.4, height = 0.5 } = {}) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = Math.round(512 * (height / width));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = fg;
      ctx.font = `bold ${Math.round(canvas.height * 0.58)}px Inter, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2, canvas.width - 24);
      const texture = new THREE.CanvasTexture(canvas);
      texture.anisotropy = 4;
      return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture }));
    }

// --- Garden crops: each looks like what it is ---------------------------------
function buildPeachTree3D() {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0x5b3a1e }));
      trunk.position.y = 0.35;
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), new THREE.MeshStandardMaterial({ color: 0x3f7d2c, roughness: 0.8 }));
      canopy.position.y = 0.95;
      canopy.scale.set(1.2, 0.85, 0.9);
      g.add(trunk, canopy);
      const peachMat = new THREE.MeshStandardMaterial({ color: 0xffa36c, emissive: 0x7c2d12, emissiveIntensity: 0.12, roughness: 0.6 });
      for (let i = 0; i < 6; i++) {
        const peach = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), peachMat);
        const a = (i / 6) * Math.PI * 2;
        peach.position.set(Math.cos(a) * 0.55, 0.8 + (i % 2) * 0.18, Math.sin(a) * 0.4);
        g.add(peach);
      }
      return g;
    }

function buildTomatoVines3D() {
      const g = new THREE.Group();
      const stakeMat = new THREE.MeshStandardMaterial({ color: 0xc8a165 });
      const vineMat = new THREE.MeshStandardMaterial({ color: 0x2f7d32, roughness: 0.8 });
      const tomatoMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.05 });
      [-0.5, 0, 0.5].forEach((x, i) => {
        const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 6), stakeMat);
        stake.position.set(x, 0.55, 0);
        const vine = new THREE.Mesh(new THREE.TorusKnotGeometry(0.1, 0.03, 40, 6, 2, 5), vineMat);
        vine.position.set(x, 0.55, 0);
        vine.scale.set(1, 3.2, 1);
        g.add(stake, vine);
        for (let t = 0; t < 3; t++) {
          const tomato = new THREE.Mesh(new THREE.SphereGeometry(0.1 + (t % 2) * 0.03, 10, 8), tomatoMat);
          tomato.position.set(x + (t % 2 ? 0.13 : -0.12), 0.3 + t * 0.25 + i * 0.03, 0.08);
          tomato.scale.y = 0.85;
          g.add(tomato);
        }
      });
      return g;
    }

function buildCarrotRow3D() {
      const g = new THREE.Group();
      const carrotMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.6 });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.8 });
      for (let i = 0; i < 6; i++) {
        const x = -0.6 + (i % 3) * 0.6;
        const z = i < 3 ? -0.25 : 0.25;
        // Orange shoulder poking out of the soil, with a feathery green top
        const carrot = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.32, 8), carrotMat);
        carrot.rotation.x = Math.PI;
        carrot.position.set(x, 0.05, z);
        g.add(carrot);
        for (let l = 0; l < 3; l++) {
          const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.42, 4), leafMat);
          leaf.position.set(x + (l - 1) * 0.05, 0.38, z);
          leaf.rotation.z = (l - 1) * 0.35;
          g.add(leaf);
        }
      }
      return g;
    }

function buildBlueberryBushes3D() {
      const g = new THREE.Group();
      const bushMat = new THREE.MeshStandardMaterial({ color: 0x1f5135, roughness: 0.85, flatShading: true });
      const berryMat = new THREE.MeshStandardMaterial({ color: 0x3b4cca, roughness: 0.3, emissive: 0x111a55, emissiveIntensity: 0.2 });
      [-0.4, 0.4].forEach(x => {
        const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38, 1), bushMat);
        bush.position.set(x, 0.32, 0);
        bush.scale.y = 0.8;
        g.add(bush);
        for (let b = 0; b < 9; b++) {
          const berry = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), berryMat);
          const a = b * 2.4;
          berry.position.set(x + Math.cos(a) * 0.33, 0.2 + (b % 3) * 0.14, Math.sin(a) * 0.3);
          g.add(berry);
        }
      });
      return g;
    }

// --- Buildings ------------------------------------------------------------------
function buildCafe3D() {
      const cx = -1.5, cz = 3.5;
      const gy = getAnalyticalGroundHeight(cx, cz);
      const cafe = new THREE.Group();
      cafe.position.set(cx, gy, cz);
      const walls = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.4, 2.8), new THREE.MeshStandardMaterial({ color: 0xfde7c8, roughness: 0.8 }));
      walls.position.y = 1.2;
      walls.castShadow = true;
      walls.receiveShadow = true;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.25, 3.1), new THREE.MeshStandardMaterial({ color: 0x7c2d12 }));
      roof.position.y = 2.52;
      // Striped awning over the front
      const awning = new THREE.Group();
      for (let i = 0; i < 7; i++) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.05, 0.9), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xf8fafc : 0xea580c }));
        stripe.position.set(-1.62 + i * 0.54, 0, 0);
        awning.add(stripe);
      }
      awning.position.set(0, 1.95, 1.75);
      awning.rotation.x = 0.35;
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.06), new THREE.MeshStandardMaterial({ color: 0x7c2d12 }));
      door.position.set(0.9, 0.7, 1.42);
      const windowMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 0.35 });
      const shopWindow = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.06), windowMat);
      shopWindow.position.set(-0.7, 1.05, 1.42);
      const sign = makeSignMesh('BEAN & BYTE CAFE', { bg: '#7c2d12', fg: '#fde68a', width: 2.8, height: 0.42 });
      sign.position.set(0, 2.2, 1.43);
      // Giant coffee cup on the roof so it reads from far away
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.6, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      cup.position.set(-1.1, 2.95, 0);
      const coffee = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.02, 16), new THREE.MeshStandardMaterial({ color: 0x4a2c17 }));
      coffee.position.set(-1.1, 3.24, 0);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 8, 16), cup.material);
      handle.position.set(-0.6, 2.95, 0);
      // Patio table with an umbrella
      const table = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 16), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
      table.position.set(-1.3, 0.75, 2.5);
      const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 6), new THREE.MeshStandardMaterial({ color: 0x334155 }));
      tableLeg.position.set(-1.3, 0.37, 2.5);
      const umbrella = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.35, 8), new THREE.MeshStandardMaterial({ color: 0xea580c }));
      umbrella.position.set(-1.3, 1.85, 2.5);
      const umbrellaPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), tableLeg.material);
      umbrellaPole.position.set(-1.3, 1.3, 2.5);
      cafe.add(walls, roof, awning, door, shopWindow, sign, cup, coffee, handle, table, tableLeg, umbrella, umbrellaPole);
      scene.add(cafe);
      worldObstacles.push({ x: cx, z: cz, r: 2.3 }, { x: cx - 1.3, z: cz + 2.5, r: 0.6 });
    }

function buildNetNode3D() {
      const cx = 6.8, cz = 2.2;
      const gy = getAnalyticalGroundHeight(cx, cz);
      const net = new THREE.Group();
      net.position.set(cx, gy, cz);
      const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.5, 3.0), new THREE.MeshStandardMaterial({ color: 0x1e1b4b, metalness: 0.4, roughness: 0.4 }));
      body.position.y = 1.25;
      body.castShadow = true;
      body.receiveShadow = true;
      // Glowing glass front with screens behind it
      const glass = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.3, 0.05), new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x0891b2, emissiveIntensity: 0.55, transparent: true, opacity: 0.85 }));
      glass.position.set(0, 1.25, 1.52);
      const screenMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
      [-1.1, 0, 1.1].forEach(x => {
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), screenMat);
        screen.position.set(x, 1.15, 1.56);
        net.add(screen);
      });
      const sign = makeSignMesh('NETNODE CYBER CAFE', { bg: '#0f172a', fg: '#22d3ee', width: 3.2, height: 0.42 });
      sign.position.set(0, 2.25, 1.53);
      // Satellite dish and antenna on the roof
      const dish = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, side: THREE.DoubleSide, metalness: 0.5 }));
      dish.position.set(1.2, 2.75, -0.5);
      dish.rotation.x = -0.9;
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
      antenna.position.set(-1.4, 3.2, -0.6);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshBasicMaterial({ color: 0xf43f5e }));
      beacon.position.set(-1.4, 3.92, -0.6);
      net.add(body, glass, sign, dish, antenna, beacon);
      scene.add(net);
      worldObstacles.push({ x: cx, z: cz, r: 2.5 });
    }

// The Okanagan Post Office, where mail for Kelo-1 waits and his letters go out
function buildPostOffice3D() {
      const cx = 12.5, cz = -3.0;
      const gy = getAnalyticalGroundHeight(cx, cz);
      const po = new THREE.Group();
      po.position.set(cx, gy, cz);

      const brick = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.85 });
      const trim = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
      const slate = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });

      const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.6, 3.2), brick);
      body.position.y = 1.3;
      body.castShadow = true;
      body.receiveShadow = true;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.3, 1.4, 4), slate);
      roof.position.y = 3.3;
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(1, 1, 0.78);
      roof.castShadow = true;
      const cornice = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.18, 3.4), trim);
      cornice.position.y = 2.62;
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.08), new THREE.MeshStandardMaterial({ color: 0x1e3a8a }));
      door.position.set(0, 0.75, 1.62);
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 0.6), trim);
      step.position.set(0, 0.07, 1.85);
      [-1.35, 1.35].forEach(wx => {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.06), new THREE.MeshStandardMaterial({ color: 0xbfdbfe, emissive: 0x1e3a8a, emissiveIntensity: 0.2 }));
        win.position.set(wx, 1.5, 1.62);
        po.add(win);
      });
      const sign = makeSignMesh('POST OFFICE', { bg: '#f8fafc', fg: '#b91c1c', width: 2.6, height: 0.45 });
      sign.position.set(0, 2.25, 1.63);

      // Flagpole and a red street mailbox out front
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 4.2, 8), trim);
      pole.position.set(2.5, 2.1, 1.6);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshStandardMaterial({ color: 0xdc2626, side: THREE.DoubleSide }));
      flag.position.set(2.95, 3.85, 1.6);
      flag.userData = { baseRotZ: 0, phase: 1.3 };
      pennantFlags.push(flag);
      const mailbox = new THREE.Group();
      const boxBody = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.5), new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.3, roughness: 0.5 }));
      boxBody.position.y = 0.75;
      const boxTop = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.55, 12, 1, false, 0, Math.PI), boxBody.material);
      boxTop.rotation.z = Math.PI / 2;
      boxTop.position.y = 1.12;
      const boxLeg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.12), slate);
      boxLeg.position.y = 0.2;
      mailbox.add(boxBody, boxTop, boxLeg);
      mailbox.position.set(-1.9, 0, 2.1);

      po.add(body, roof, cornice, door, step, sign, pole, flag, mailbox);
      scene.add(po);
      worldObstacles.push({ x: cx, z: cz, r: 2.5 }, { x: cx - 1.9, z: cz + 2.1, r: 0.4 });
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
      // Instantiate any previously invented creations, oldest first so the newest end up last in the group
      state.inventedCreations.slice().reverse().forEach((item, revIdx) => {
        spawnEmergent3DObjectInWorld(item, revIdx === state.inventedCreations.length - 1);
      });
    }

// Remove the oldest 3D creations (and their map pins) once there are more than maxCount
function pruneEmergentCreations3D(maxCount) {
      if (!emergentCreationsGroup) return;
      let removedPin = false;
      while (emergentCreationsGroup.children.length > maxCount) {
        const oldest = emergentCreationsGroup.children[0];
        emergentCreationsGroup.remove(oldest);
        worldObstacles = worldObstacles.filter(o => o !== oldest.userData.obstacle);
        oldest.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        });
        if (oldest.userData.pinId && TOWN_LOCATIONS[oldest.userData.pinId]) {
          delete TOWN_LOCATIONS[oldest.userData.pinId];
          removedPin = true;
        }
      }
      if (removedPin) createPOILabelsDOM();
    }

function applyLightingPreset(idx) {
      const preset = AMBIANCE_PRESETS[idx] || AMBIANCE_PRESETS[0];
      scene.background = new THREE.Color(preset.bg);
      scene.fog.color.setHex(preset.fog);
      scene.fog.density = preset.fogDensity;
      hemiLight.color.setHex(preset.hemiSky);
      hemiLight.groundColor.setHex(preset.hemiGround);
      sunLight.color.setHex(preset.sunColor);
      sunLight.intensity = preset.sunInt;
      if (skyDome) {
        skyDome.material.uniforms.topColor.value.setHex(preset.skyTop);
        skyDome.material.uniforms.horizonColor.value.setHex(preset.skyHorizon);
      }
      return preset;
    }

// The 3D model of a creation (used when welding it, carrying it, and placing it in the world)
function buildCreationGroup(creation) {
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
          else if (p.shape === 'dodecahedron') geo = new THREE.DodecahedronGeometry(sx * 0.55, 0);
          else if (p.shape === 'icosahedron') geo = new THREE.IcosahedronGeometry(sx * 0.55, 0);
          else if (p.shape === 'tetrahedron') geo = new THREE.TetrahedronGeometry(sx * 0.6, 0);
          else if (p.shape === 'ring') geo = new THREE.RingGeometry(sx * 0.25, sx * 0.55, 24);
          else if (p.shape === 'lathe' && Array.isArray(p.profile)) {
            geo = new THREE.LatheGeometry(p.profile.map(([r, y]) => new THREE.Vector2(r, y)), 24);
          } else if (p.shape === 'extrude' && Array.isArray(p.outline)) {
            const outline = new THREE.Shape(p.outline.map(([x, y]) => new THREE.Vector2(x, y)));
            geo = new THREE.ExtrudeGeometry(outline, { depth: p.depth || 0.2, bevelEnabled: false });
            geo.translate(0, 0, -(p.depth || 0.2) / 2);
          } else if (p.shape === 'tube' && Array.isArray(p.path)) {
            const curve = new THREE.CatmullRomCurve3(p.path.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
            geo = new THREE.TubeGeometry(curve, Math.max(16, p.path.length * 8), p.radius || 0.08, 8, false);
          }
          else geo = new THREE.BoxGeometry(sx, sy, sz);

          const mat = new THREE.MeshStandardMaterial({
            color: pCol,
            metalness: p.metalness ?? 0.78,
            roughness: p.roughness ?? 0.22,
            emissive: p.emissive ? pCol : new THREE.Color(0x000000),
            emissiveIntensity: p.emissive ? 0.45 : 0,
            // Open shapes (lathe profiles, rings) need both faces so they don't vanish from behind
            side: (p.shape === 'lathe' || p.shape === 'ring') ? THREE.DoubleSide : THREE.FrontSide
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

      return g;
    }

function spawnEmergent3DObjectInWorld(creation, skipPin = false) {
      if (!emergentCreationsGroup) return;
      const g = buildCreationGroup(creation);
      const groundY = getIslandGroundHeight(creation.x, creation.z);
      g.position.set(creation.x, groundY, creation.z);
      emergentCreationsGroup.add(g);
      const obstacle = { x: creation.x, z: creation.z, r: 1.0 };
      worldObstacles.push(obstacle);
      g.userData.obstacle = obstacle;

      // Also register a dynamic clickable 3D landmark pin if it's a newly discovered spot!
      const dynId = 'dyn_' + Math.round(creation.x * 10) + '_' + Math.round(creation.z * 10);
      if (!TOWN_LOCATIONS[dynId] && !skipPin) {
        g.userData.pinId = dynId;
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
            <span>${escapeHtml(loc.icon)}</span>
            <span>${escapeHtml(loc.name)}</span>
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

// --- Walking around obstacles ----------------------------------------------------
const KELO_RADIUS = 0.55;

// Obstacles that contain the target (e.g. he is walking up to a building) don't block the approach
function obstacleHoldsTarget(o, target) {
      return Math.hypot(target.x - o.x, target.z - o.z) < o.r + KELO_RADIUS;
    }

// He has arrived when he is next to the target, or as close as a solid object allows
function arrivalRadius(target) {
      let r = 0.16;
      for (const o of worldObstacles) {
        if (obstacleHoldsTarget(o, target)) {
          r = Math.max(r, o.r + KELO_RADIUS + 0.1 - Math.hypot(target.x - o.x, target.z - o.z));
        }
      }
      return r;
    }

// --- Pathfinding: A* over a coarse grid, so he routes around buildings instead of getting stuck
const PATH_CELL = 0.75;
const PATH_MIN_X = -36, PATH_MAX_X = 36, PATH_MIN_Z = -36, PATH_MAX_Z = 14;
const PATH_COLS = Math.ceil((PATH_MAX_X - PATH_MIN_X) / PATH_CELL);
const PATH_ROWS = Math.ceil((PATH_MAX_Z - PATH_MIN_Z) / PATH_CELL);
let currentPath = [];
let currentPathKey = '';

function pointBlocked(x, z, target) {
      for (const o of worldObstacles) {
        if (obstacleHoldsTarget(o, target)) continue;
        if (Math.hypot(x - o.x, z - o.z) < o.r + KELO_RADIUS) return true;
      }
      return false;
    }

function segmentClear(ax, az, bx, bz, target) {
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.3);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        if (pointBlocked(ax + (bx - ax) * t, az + (bz - az) * t, target)) return false;
      }
      return true;
    }

function findPath(from, to) {
      if (segmentClear(from.x, from.z, to.x, to.z, to)) return [{ x: to.x, z: to.z }];
      const col = x => Math.max(0, Math.min(PATH_COLS - 1, Math.floor((x - PATH_MIN_X) / PATH_CELL)));
      const row = z => Math.max(0, Math.min(PATH_ROWS - 1, Math.floor((z - PATH_MIN_Z) / PATH_CELL)));
      const cx = c => PATH_MIN_X + (c + 0.5) * PATH_CELL;
      const cz = r => PATH_MIN_Z + (r + 0.5) * PATH_CELL;
      const start = row(from.z) * PATH_COLS + col(from.x);
      const goal = row(to.z) * PATH_COLS + col(to.x);
      const blocked = new Uint8Array(PATH_COLS * PATH_ROWS);
      for (let r = 0; r < PATH_ROWS; r++) {
        for (let c = 0; c < PATH_COLS; c++) {
          if (pointBlocked(cx(c), cz(r), to)) blocked[r * PATH_COLS + c] = 1;
        }
      }
      blocked[start] = 0;
      blocked[goal] = 0;
      const g = new Float32Array(PATH_COLS * PATH_ROWS).fill(Infinity);
      const came = new Int32Array(PATH_COLS * PATH_ROWS).fill(-1);
      const open = [start];
      const inOpen = new Uint8Array(PATH_COLS * PATH_ROWS);
      g[start] = 0;
      inOpen[start] = 1;
      const h = i => Math.hypot(cx(i % PATH_COLS) - to.x, cz(Math.floor(i / PATH_COLS)) - to.z);
      let found = false;
      for (let iter = 0; open.length > 0 && iter < 20000; iter++) {
        let bi = 0;
        for (let k = 1; k < open.length; k++) if (g[open[k]] + h(open[k]) < g[open[bi]] + h(open[bi])) bi = k;
        const cur = open.splice(bi, 1)[0];
        inOpen[cur] = 0;
        if (cur === goal) { found = true; break; }
        const cc = cur % PATH_COLS, cr = Math.floor(cur / PATH_COLS);
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const nc = cc + dc, nr = cr + dr;
            if (nc < 0 || nr < 0 || nc >= PATH_COLS || nr >= PATH_ROWS) continue;
            const n = nr * PATH_COLS + nc;
            if (blocked[n]) continue;
            // No cutting corners between two blocked cells
            if (dr && dc && (blocked[cr * PATH_COLS + nc] || blocked[nr * PATH_COLS + cc])) continue;
            const cost = g[cur] + (dr && dc ? 1.414 : 1) * PATH_CELL;
            if (cost < g[n]) {
              g[n] = cost;
              came[n] = cur;
              if (!inOpen[n]) { open.push(n); inOpen[n] = 1; }
            }
          }
        }
      }
      if (!found) return [{ x: to.x, z: to.z }];
      const cells = [];
      for (let c = goal; c !== -1 && c !== start; c = came[c]) cells.push({ x: cx(c % PATH_COLS), z: cz(Math.floor(c / PATH_COLS)) });
      cells.reverse();
      cells[cells.length - 1] = { x: to.x, z: to.z };
      // Smooth the path: skip waypoints he can walk straight past
      const smooth = [];
      let anchor = { x: from.x, z: from.z };
      for (let k = 0; k < cells.length; k++) {
        const next = cells[k + 1];
        if (next && segmentClear(anchor.x, anchor.z, next.x, next.z, to)) continue;
        smooth.push(cells[k]);
        anchor = cells[k];
      }
      return smooth;
    }

// Direction toward the next waypoint, recomputing the path when the target or the world changes
function nextPathDirection(px, pz, target) {
      const key = `${target.x.toFixed(2)},${target.z.toFixed(2)},${worldObstacles.length}`;
      if (key !== currentPathKey) {
        currentPath = findPath({ x: px, z: pz }, target);
        currentPathKey = key;
      }
      while (currentPath.length > 1 && Math.hypot(currentPath[0].x - px, currentPath[0].z - pz) < 0.45) currentPath.shift();
      const wp = currentPath[0] || target;
      const dx = wp.x - px, dz = wp.z - pz;
      const len = Math.hypot(dx, dz) || 1;
      return [dx / len, dz / len];
    }

// Hard guarantee: never end a step inside something solid
function pushOutOfObstacles(pos, target) {
      for (const o of worldObstacles) {
        if (obstacleHoldsTarget(o, target)) {
          // Still keep him out of the building's footprint itself
          const minD = o.r * 0.75;
          const d = Math.hypot(pos.x - o.x, pos.z - o.z);
          if (d < minD && d > 0) { pos.x = o.x + ((pos.x - o.x) / d) * minD; pos.z = o.z + ((pos.z - o.z) / d) * minD; }
          continue;
        }
        const minD = o.r + KELO_RADIUS;
        const d = Math.hypot(pos.x - o.x, pos.z - o.z);
        if (d < minD) {
          const nx = d > 0 ? (pos.x - o.x) / d : 1, nz = d > 0 ? (pos.z - o.z) / d : 0;
          pos.x = o.x + nx * minD;
          pos.z = o.z + nz * minD;
        }
      }
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

      if (dist > arrivalRadius(state.targetPos)) {
        state.isWalking = true;
        const step = dist > 14 ? 0.14 : 0.082;
        const [sx, sz] = nextPathDirection(state.botPos.x, state.botPos.z, state.targetPos);
        state.botPos.x += sx * step;
        state.botPos.z += sz * step;
        pushOutOfObstacles(state.botPos, state.targetPos);
        state.botRotY = Math.atan2(sx, sz);

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
          keloGroup.position.set(state.botPos.x, Math.max(groundY, 0.2), state.botPos.z);
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

      if (typeof updateCarriedObject === 'function') updateCarriedObject(t);
      updateClouds(1 / 60);

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
      // Names only appear when the cursor is near the place (or it was just tapped)
      const pointerLive = hoverPointer.active && (hoverPointer.touchUntil === 0 || Date.now() < hoverPointer.touchUntil);
      Object.values(TOWN_LOCATIONS).forEach(loc => {
        const el = poiDomElements[loc.id];
        if (!el) return;
        const pinBaseY = (typeof loc.groundY === 'number') ? loc.groundY : getIslandGroundHeight(loc.x, loc.z);
        const v = new THREE.Vector3(loc.x, pinBaseY + 3.6, loc.z);
        v.project(camera);
        const ground = new THREE.Vector3(loc.x, pinBaseY + 1.0, loc.z).project(camera);
        const lx = (v.x * 0.5 + 0.5) * w, ly = (-(v.y * 0.5) + 0.5) * h;
        const gx = (ground.x * 0.5 + 0.5) * w, gy = (-(ground.y * 0.5) + 0.5) * h;
        const near = pointerLive && v.z <= 1 && (
          Math.hypot(hoverPointer.x - gx, hoverPointer.y - gy) < 70 ||
          Math.hypot(hoverPointer.x - lx, hoverPointer.y - ly) < 45 ||
          (Math.abs(hoverPointer.x - gx) < 40 && hoverPointer.y > ly && hoverPointer.y < gy));
        el.style.opacity = near ? '1' : '0';
        el.style.pointerEvents = near ? 'auto' : 'none';
        if (v.z <= 1) {
          el.style.left = `${lx}px`;
          el.style.top = `${ly}px`;
        }
      });
    }