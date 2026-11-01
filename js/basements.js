// Kelo-bot-1 — js/basements.js
// Loaded after museum.js. Going inside the Storehouse and the Museum for real. When he puts
// something away or takes it out, he walks in through the door to the exact shelf, plinth or wall
// it belongs on, reaches up or crouches down to it, and the thing moves between his hands and its
// place. When it belongs on a lower floor he walks down the spiral stairs, step by step, and the
// earth in front of the building is cut away so you can watch him in the lit rooms below.
//
// How it fits together: goIndoors(site, jobs) walks him to the door the normal way (pathfinding)
// and only goes in once he is really there. Inside, he follows a scripted path: scene.js calls
// updateIndoorTrip() every frame and skips its own walking while that returns true. Nothing
// underground is shown or used unless he is on that path, inside the building, and the trip
// always ends (even after an error) with him back out at the door.
// The basement rooms, the stairs and the cutaway are only built while he is down there.

const BASEMENT_STEPS_PER_LEVEL = 16;
const SPIRAL_WALK_R = 0.42;   // where he walks on the spiral stairs
const SPIRAL_OUTER_R = 0.76;  // the outer edge of the treads
const INDOOR_WALK_SPEED = 1.8;
const STAIR_WALK_SPEED = 0.95;

// Everything about each building that the trips need, in the building's own coordinates
// (its group sits on the ground at the building's centre)
function basementSite(key) {
      if (key === 'museum') {
        if (typeof museumGroup === 'undefined' || !museumGroup) return null;
        const h = MUSEUM_HATCH_LOCAL;
        return {
          key, name: 'Museum', group: museumGroup, w: MUSEUM.w, d: MUSEUM.d, floorY: 0.56, hatch: h, entryAngle: Math.PI / 2,
          outside: { x: 0, z: 7.3 },
          // Up the front steps and in between the columns
          walkIn: [{ x: 0, z: 5.8, y: 0 }, { x: 0, z: 5.25, y: 0.17 }, { x: 0, z: 4.75, y: 0.34 }, { x: 0, z: 4.25, y: 0.51 }, { x: 0, z: 3.9, y: 0.56 }, { x: 0, z: 3.2, y: 0.56 }],
          nodes: [[0, 3.2], [0, 0.1], [2.8, 0.1], [-2.8, 0.1], [5.1, 0.1], [-5.1, 0.1], [2.8, 2.9], [-2.8, 2.9], [5.1, 2.9], [-5.1, 2.9],
            [2.8, -2.9], [-2.8, -2.9], [5.1, -2.9], [-5.1, -2.9], [1.2, -2.2], [-1.2, -2.2]].map(([x, z]) => ({ x, z })),
          obstacles: () => [...MUSEUM_PLINTHS.map(p => ({ x: p.x, z: p.z, r: 0.78 })), { x: h.x, z: h.z, r: 0.92 }],
          levels: () => museumBasementLevels(),
          camDist: 15, cutFlat: 9, roomColor: 0xe7e1d4, floorColor: 0xb9ad96
        };
      }
      if (typeof storehouseGroup === 'undefined' || !storehouseGroup) return null;
      const h = STOREHOUSE_HATCH_LOCAL;
      return {
        key: 'storehouse', name: 'Storehouse', group: storehouseGroup, w: STOREHOUSE.w, d: STOREHOUSE.d, floorY: 0.15, hatch: h, entryAngle: Math.PI,
        outside: { x: -0.75, z: 3.7 },
        walkIn: [{ x: -0.75, z: 2.0, y: 0 }, { x: -0.75, z: 1.7, y: 0.15 }, { x: -0.75, z: 1.25, y: 0.15 }],
        nodes: [[-0.75, 1.25], [1.0, 1.3], [-1.45, -0.72], [1.45, -0.72], [0, -0.78], [-1.5, 0.55], [1.5, 0.55]].map(([x, z]) => ({ x, z })),
        obstacles: () => [{ x: h.x, z: h.z, r: 0.92 }],
        levels: () => storehouseBasementLevels(),
        camDist: 7.5, cutFlat: 6, roomColor: 0x9a7b5a, floorColor: 0x6b4a2b
      };
    }

function levelFloorY(site, level) {
      return site.floorY - level * BASEMENT_LEVEL_DEPTH;
    }

// A point in the building's coordinates, as a world position
function siteToWorld(site, x, z, y) {
      const o = site.group.position;
      return { x: o.x + x, y: o.y + y, z: o.z + z };
    }

function stairEntry(site, r = 0.98) {
      return { x: site.hatch.x + Math.cos(site.entryAngle) * r, z: site.hatch.z + Math.sin(site.entryAngle) * r };
    }

// --- Finding his way around inside (a few known open spots, avoiding plinths and the stairwell)
function indoorSegmentClear(a, b, circles) {
      const dx = b.x - a.x, dz = b.z - a.z, len2 = dx * dx + dz * dz || 1e-9;
      return circles.every(c => {
        const u = Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.z - a.z) * dz) / len2));
        return Math.hypot(a.x + dx * u - c.x, a.z + dz * u - c.z) >= c.r - 1e-6;
      });
    }

function routeInside(site, a, b) {
      const circles = site.obstacles().filter(c => Math.hypot(a.x - c.x, a.z - c.z) > c.r && Math.hypot(b.x - c.x, b.z - c.z) > c.r);
      if (indoorSegmentClear(a, b, circles)) return [b];
      const pts = [a, b, ...site.nodes.filter(n => circles.every(c => Math.hypot(n.x - c.x, n.z - c.z) > c.r))];
      const dist = pts.map(() => Infinity), prev = pts.map(() => -1), done = pts.map(() => false);
      dist[0] = 0;
      for (;;) {
        let u = -1;
        pts.forEach((_, i) => { if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i; });
        if (u < 0 || u === 1) break;
        done[u] = true;
        pts.forEach((p, v) => {
          if (done[v] || !indoorSegmentClear(pts[u], p, circles)) return;
          const nd = dist[u] + Math.hypot(p.x - pts[u].x, p.z - pts[u].z);
          if (nd < dist[v]) { dist[v] = nd; prev[v] = u; }
        });
      }
      if (prev[1] < 0) return [b];
      const out = [];
      for (let i = 1; i > 0; i = prev[i]) out.unshift(pts[i]);
      return out;
    }

// --- The scripted walk, driven by the animation loop -----------------------------------------
const indoorTrip = {
  active: false, site: null, pos: null, rotY: 0, path: null, speed: INDOOR_WALK_SPEED, resolve: null,
  pose: null, crouch: 0, crouchTarget: 0, lastT: null, walkStarted: 0, cutLevel: 0
};

// Called by scene.js every frame. Returns true while he is inside on a trip (scene.js then leaves
// his position alone).
function updateIndoorTrip(t) {
      const trip = indoorTrip;
      if (!trip.active || !trip.pos) return false;
      const dt = trip.lastT === null ? 0 : Math.max(0, Math.min(0.5, t - trip.lastT));
      trip.lastT = t;
      const pos = trip.pos;
      if (trip.path) {
        let move = trip.speed * dt;
        // A hidden tab can stall the frames: never leave a walk hanging for long
        if (Date.now() - trip.walkStarted > 90000) move = Infinity;
        while (move > 0 && trip.path.length) {
          const p = trip.path[0];
          const dx = p.x - pos.x, dz = p.z - pos.z, h = Math.hypot(dx, dz);
          if (h > 0.001) trip.rotY = Math.atan2(dx, dz);
          if (h <= move) {
            pos.x = p.x; pos.y = p.y; pos.z = p.z;
            move -= h;
            trip.path.shift();
          } else {
            pos.x += dx / h * move; pos.z += dz / h * move; pos.y += (p.y - pos.y) * (move / h);
            move = 0;
          }
        }
        if (!trip.path.length) {
          trip.path = null;
          const done = trip.resolve;
          trip.resolve = null;
          if (done) done();
        }
      }
      const walking = Boolean(trip.path);
      state.isWalking = walking;
      keloAnim.mode = walking ? 'walk' : trip.pose ? 'other' : 'idle';
      if (!walking && trip.pose) trip.pose(t);
      trip.crouch = dampTo(trip.crouch, walking ? 0 : trip.crouchTarget, 6, dt || 1 / 60);
      state.botPos.x = pos.x;
      state.botPos.z = pos.z;
      state.botRotY = trip.rotY;
      state.botAltitudeY = pos.y;
      keloGroup.position.set(pos.x, pos.y - trip.crouch, pos.z);
      keloGroup.rotation.set(0, trip.rotY, 0);
      // How far below the ground floor he is (shown in the panel; never moves him by itself)
      const site = trip.site;
      const below = site ? site.group.position.y - pos.y : 0;
      state.basementDepth = below > 0.5 ? below : 0;
      if (keloDrillToolGroup) keloDrillToolGroup.visible = false;
      if (keloWeldTorchGroup) keloWeldTorchGroup.visible = false;
      return true;
    }

function tripWalk(points, speed = INDOOR_WALK_SPEED) {
      return new Promise(resolve => {
        if (!points.length) return resolve();
        indoorTrip.pose = null;
        indoorTrip.crouchTarget = 0;
        indoorTrip.speed = speed;
        indoorTrip.walkStarted = Date.now();
        indoorTrip.path = points.map(p => ({ ...p }));
        indoorTrip.resolve = resolve;
      });
    }

const tripPause = ms => new Promise(r => setTimeout(r, ms));

// Turn to face a world point
function tripFace(p) {
      indoorTrip.rotY = Math.atan2(p.x - indoorTrip.pos.x, p.z - indoorTrip.pos.z);
    }

// Reaching for something h above his feet: arms up for a high shelf, a squat for a low one
function reachPose(h) {
      const crouch = h < 1.1 ? Math.min(0.6, 1.1 - h) : 0;
      indoorTrip.crouchTarget = crouch;
      const reach = KELO_UPPER_ARM + KELO_FOREARM + KELO_PALM;
      const rel = (KELO_SHOULDER.y - crouch - (h + 0.12)) / reach;
      const arm = -Math.acos(Math.max(-1, Math.min(1, rel)));
      keloLeftArm.rotation.set(arm, 0, 0.12);
      keloRightArm.rotation.set(arm, 0, -0.12);
      keloLeftElbow.rotation.x = keloRightElbow.rotation.x = 0.1;
      keloLeftHand.userData.grip = keloRightHand.userData.grip = 0.15;
      keloBody.rotation.x = crouch ? 0.35 : h > 1.6 ? -0.08 : 0.06;
      if (crouch) keloSquat(crouch);
      keloHead.rotation.x = Math.max(-0.5, Math.min(0.5, -(h - 2.3) * 0.35));
    }

// The spiral stairs as a walking path, from one floor down (or up) to another
function spiralPath(site, fromLevel, toLevel) {
      const lo = Math.min(fromLevel, toLevel), hi = Math.max(fromLevel, toLevel);
      const N = BASEMENT_STEPS_PER_LEVEL, rise = BASEMENT_LEVEL_DEPTH / N, dth = Math.PI * 2 / N;
      const h = site.hatch, th0 = site.entryAngle;
      const at = (th, r, y) => siteToWorld(site, h.x + Math.cos(th) * r, h.z + Math.sin(th) * r, y);
      const pts = [at(th0, 0.98, levelFloorY(site, lo)), at(th0, SPIRAL_WALK_R, levelFloorY(site, lo))];
      for (let k = lo * N; k < hi * N; k++) {
        // Step down at the front of each tread, then walk across it
        const y = site.floorY - (k + 1) * rise, ths = th0 + k * dth;
        pts.push(at(ths + dth * 0.3, SPIRAL_WALK_R, y), at(ths + dth, SPIRAL_WALK_R, y));
      }
      pts.push(at(th0, 0.98, levelFloorY(site, hi)));
      return toLevel > fromLevel ? pts : pts.reverse();
    }

// --- What gets built while he is down there ---------------------------------------------------
let basementBuilt = null;   // { site, group, level }
let earthCut = null;        // { planes, materials, trench }

function disposeTree(obj) {
      obj.traverse(o => {
        if (o.userData && o.userData.sharedGeometry) return;
        if (o.geometry) o.geometry.dispose();
        if (o.material && o.material.map && !o.material.userData.keepMap) o.material.map.dispose();
      });
    }

function buildSpiralStairs(site, level) {
      const g = new THREE.Group();
      const N = BASEMENT_STEPS_PER_LEVEL, rise = BASEMENT_LEVEL_DEPTH / N, dth = Math.PI * 2 / N;
      const h = site.hatch, th0 = site.entryAngle;
      const tread = new THREE.MeshStandardMaterial({ color: site.key === 'museum' ? 0xd6d0c4 : 0x9a6a3a, roughness: 0.8 });
      const steel = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 });
      const treadGeo = new THREE.BoxGeometry(SPIRAL_OUTER_R - 0.06, 0.07, SPIRAL_OUTER_R * dth + 0.04);
      const postGeo = new THREE.BoxGeometry(0.04, 0.85, 0.04);
      const rail = [];
      const total = level * N;
      for (let k = 0; k < total; k++) {
        const th = th0 + (k + 0.5) * dth, y = site.floorY - (k + 1) * rise;
        const step = new THREE.Mesh(treadGeo, tread);
        step.position.set(h.x + Math.cos(th) * (SPIRAL_OUTER_R + 0.06) / 2, y - 0.035, h.z + Math.sin(th) * (SPIRAL_OUTER_R + 0.06) / 2);
        step.rotation.y = -th;
        step.userData.sharedGeometry = k > 0;
        g.add(step);
        if (k % 2 === 0) {
          const post = new THREE.Mesh(postGeo, steel);
          post.position.set(h.x + Math.cos(th) * (SPIRAL_OUTER_R - 0.03), y + 0.425, h.z + Math.sin(th) * (SPIRAL_OUTER_R - 0.03));
          post.userData.sharedGeometry = k > 0;
          g.add(post);
        }
        rail.push(new THREE.Vector3(h.x + Math.cos(th) * (SPIRAL_OUTER_R - 0.03), y + 0.86, h.z + Math.sin(th) * (SPIRAL_OUTER_R - 0.03)));
      }
      if (rail.length > 1) g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail), rail.length * 3, 0.03, 6, false), steel));
      const height = level * BASEMENT_LEVEL_DEPTH + 0.9;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, height, 10), steel);
      pole.position.set(h.x, site.floorY - level * BASEMENT_LEVEL_DEPTH + height / 2, h.z);
      g.add(pole);
      return g;
    }

// One lit room under the building: floor, three walls (the front is the cut-away side), ceiling
// lights, and whatever is kept on that floor
function buildBasementRoom(site, level) {
      const g = new THREE.Group();
      // The ceiling is the underside of the floor above (the building's own floor sits on y = 0)
      const fy = levelFloorY(site, level), top = level === 1 ? 0 : levelFloorY(site, level - 1) - 0.2;
      const hgt = top - fy;
      const wallMat = new THREE.MeshStandardMaterial({ color: site.roomColor, roughness: 0.85, emissive: 0x3a2c18, emissiveIntensity: 0.55 });
      const floorMat = new THREE.MeshStandardMaterial({ color: site.floorColor, roughness: 0.8, emissive: 0x24180c, emissiveIntensity: 0.5 });
      const { w, d } = site;
      const deeper = level < site.levels();
      const slab = new THREE.Mesh(deeper ? floorWithStairwell(w, d, 0.2, site.hatch) : new THREE.BoxGeometry(w, 0.2, d), floorMat);
      if (deeper) slab.position.y = fy - 0.2; else slab.position.y = fy - 0.1;
      const back = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, 0.15), wallMat);
      back.position.set(0, fy + hgt / 2, -d / 2 - 0.075);
      const left = new THREE.Mesh(new THREE.BoxGeometry(0.15, hgt, d), wallMat);
      left.position.set(-w / 2 - 0.075, fy + hgt / 2, 0);
      const right = left.clone();
      right.position.x = w / 2 + 0.075;
      g.add(slab, back, left, right);
      // Ceiling lights with a soft glow under each
      const lamp = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
      const glow = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending });
      const lampsX = site.key === 'museum' ? [-3.6, -1.2, 1.2, 3.6] : [-1.4, 1.4];
      lampsX.forEach(lx => {
        const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.22), lamp);
        fixture.position.set(lx, top - 0.05, -0.2);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1, hgt - 0.1, 16, 1, true), glow);
        cone.position.set(lx, top - 0.05 - (hgt - 0.1) / 2, -0.2);
        g.add(fixture, cone);
      });
      const sign = makeSignMesh(site.key === 'museum' ? `LOWER GALLERY B${level}` : `BASEMENT B${level}`, { bg: '#1e293b', fg: '#fbbf24', width: 1.5, height: 0.28 });
      sign.position.set(site.key === 'museum' ? -3.0 : -1.2, fy + Math.min(2.55, hgt - 0.3), -d / 2 + 0.02);
      g.add(sign);
      if (site.key === 'museum') fillMuseumRoom(g, level, fy);
      else fillStorehouseRoom(g, level, fy);
      return g;
    }

// Racks like the ones upstairs, with that floor's share of his things on them
function fillStorehouseRoom(g, level, fy) {
      const shift = fy - levelFloorY(basementSite('storehouse'), 0);
      const wood = new THREE.MeshStandardMaterial({ color: 0xc8955a, roughness: 0.8, emissive: 0x2a1a0a, emissiveIntensity: 0.4 });
      const plankGeo = new THREE.BoxGeometry(SHELF_SLOT + 0.01, 0.06, 0.5);
      shelfSlots.forEach(slot => {
        const plank = new THREE.Mesh(plankGeo, wood);
        plank.position.set(slot.x, slot.y + shift - 0.04, slot.z);
        plank.rotation.y = slot.rotY;
        plank.userData.sharedGeometry = true;
        g.add(plank);
      });
      [[-2.1, -1.45], [2.1, -1.45], [-2.25, -1.3], [-2.25, 1.0], [2.25, -1.3], [2.25, 1.0]].forEach(([x, z]) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.0, 0.07), wood);
        post.position.set(x, fy + 1.0, z);
        g.add(post);
      });
      const items = storedItems().slice(level * shelfSlots.length, (level + 1) * shelfSlots.length);
      items.forEach((item, i) => {
        const holder = shelfHolderFor(item.name, shelfSlots[i]);
        holder.position.y += shift;
        g.add(holder);
      });
    }

// A lower gallery: the same plinths and frames as upstairs, with that floor's pieces
function fillMuseumRoom(g, level, fy) {
      const shift = fy - 0.56;
      const marble = new THREE.MeshStandardMaterial({ color: 0xf5f1e8, roughness: 0.55, emissive: 0x2a2418, emissiveIntensity: 0.4 });
      const per = MUSEUM_PLINTHS.length || 8, perWall = MUSEUM_FRAMES.length || 8;
      MUSEUM_PLINTHS.forEach(p => {
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.9), marble);
        plinth.position.set(p.x, fy + 0.4, p.z);
        g.add(plinth);
      });
      allMuseumSculptures().slice(level * per, (level + 1) * per).forEach((c, i) => {
        g.add(museumSculptureHolder(c, MUSEUM_PLINTHS[i], shift));
      });
      allMuseumPaintings().slice(level * perWall, (level + 1) * perWall).forEach((m, i) => {
        if (typeof paintMuralCanvas !== 'function') return;
        const slot = MUSEUM_FRAMES[i];
        const frame = buildMuseumFrame(m);
        frame.position.set(slot.x, slot.y + shift, slot.z);
        frame.rotation.y = slot.rotY;
        g.add(frame);
      });
    }

function museumSculptureHolder(c, slot, shift = 0) {
      const holder = new THREE.Group();
      if (typeof buildCreationGroup === 'function') holder.add(fitInside(buildCreationGroup(c), 1.25));
      holder.position.set(slot.x, slot.y + shift, slot.z);
      holder.userData.itemName = c.title;
      return holder;
    }

function buildBasements(site, level) {
      clearBasements();
      const group = new THREE.Group();
      group.add(buildSpiralStairs(site, level));
      for (let l = 1; l <= level; l++) group.add(buildBasementRoom(site, l));
      site.group.add(group);
      site.group.traverse(o => { if (o.userData && o.userData.stairwellDark) o.visible = false; });
      basementBuilt = { site, group, level };
    }

function clearBasements() {
      if (!basementBuilt) return;
      const { site, group } = basementBuilt;
      site.group.remove(group);
      disposeTree(group);
      site.group.traverse(o => { if (o.userData && o.userData.stairwellDark) o.visible = true; });
      basementBuilt = null;
    }

// --- The cutaway: the earth in front of and under the building is cut out (the ground's own
// materials get clipping planes) and the cut faces show the layers of soil and rock
function earthClipMaterials() {
      const mats = new Set();
      if (typeof terrainGroundMesh !== 'undefined' && terrainGroundMesh) mats.add(terrainGroundMesh.material);
      scene.children.forEach(o => {
        const p = o.isMesh && o.geometry && o.geometry.parameters;
        if (p && p.width >= 300) mats.add(o.material);   // the outer lands and the sea
      });
      return [...mats];
    }

function setEarthCut(site, level) {
      if (!earthCut && (!site || !level)) return;
      if (!earthCut) {
        renderer.localClippingEnabled = true;
        earthCut = { planes: [0, 1, 2, 3, 4].map(() => new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1e6)), trench: null, materials: [] };
      }
      const planes = earthCut.planes;
      if (earthCut.trench) {
        scene.remove(earthCut.trench);
        disposeTree(earthCut.trench);
        earthCut.trench = null;
      }
      (earthCut.hidden || []).forEach(m => { m.visible = true; });
      earthCut.hidden = [];
      if (!site || !level) {
        planes[0].set(new THREE.Vector3(-1, 0, 0), 1e6);   // an empty cut: nothing is clipped
        indoorTrip.cutLevel = 0;
        return;
      }
      earthCut.materials = earthClipMaterials();
      earthCut.materials.forEach(m => {
        if (m.clippingPlanes !== planes) { m.clippingPlanes = planes; m.clipIntersection = true; m.needsUpdate = true; }
      });
      const o = site.group.position;
      const minX = o.x - site.w / 2 - 0.45, maxX = o.x + site.w / 2 + 0.45;
      // A pit open in front of the building, flat-floored for cutFlat (where the camera goes),
      // then a steep bank back up to the ground
      const backZ = o.z - site.d / 2 - 0.4, frontZ = o.z + site.d / 2 + site.cutFlat;
      const bottom = o.y + levelFloorY(site, level) - 0.45;
      const s = 2.0;
      planes[0].set(new THREE.Vector3(-1, 0, 0), minX);
      planes[1].set(new THREE.Vector3(1, 0, 0), -maxX);
      planes[2].set(new THREE.Vector3(0, 0, -1), backZ);
      planes[3].set(new THREE.Vector3(0, -1, 0), bottom);
      const n = Math.hypot(1, s);
      planes[4].set(new THREE.Vector3(0, -1 / n, s / n), (bottom - s * frontZ) / n);
      earthCut.trench = buildTrench({ minX, maxX, backZ, frontZ, bottom, s });
      scene.add(earthCut.trench);
      // Small things standing on the ground that was cut away (flowers, rocks) are hidden meanwhile
      earthCut.hidden = [];
      const lower = z => Math.max(bottom, bottom + s * (z - frontZ));
      const p = new THREE.Vector3();
      scene.traverse(m => {
        if (!m.isMesh || !m.visible || m === earthCut.trench) return;
        for (let a = m; a; a = a.parent) if (a === site.group || a === keloGroup) return;
        if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
        if (m.geometry.boundingSphere.radius > 4) return;
        m.getWorldPosition(p);
        if (p.x < minX || p.x > maxX || p.z < backZ || p.y < bottom - 1) return;
        if (lower(p.z) < getIslandGroundHeight(p.x, p.z) - 0.05) { m.visible = false; earthCut.hidden.push(m); }
      });
      indoorTrip.cutLevel = level;
      indoorTrip.cutBottom = bottom;
    }

// The soil faces of the cut, coloured by depth: dark topsoil, clay, sand and gravel, then rock
function buildTrench(cut) {
      const { minX, maxX, backZ, frontZ, bottom, s } = cut;
      const ground = (x, z) => getIslandGroundHeight(x, z) + 0.02;
      const lower = z => Math.max(bottom, bottom + s * (z - frontZ));
      const zs = [];
      for (let z = backZ; z < frontZ + 40; z += 0.4) {
        zs.push(z);
        if (lower(z) > Math.max(ground(minX, z), ground(maxX, z), ground((minX + maxX) / 2, z)) + 0.3) break;
      }
      const xs = [];
      for (let x = minX; x < maxX; x += 0.5) xs.push(x);
      xs.push(maxX);
      const positions = [], colors = [], index = [];
      const soil = [[0, 0x4a2f17], [0.45, 0x6b4423], [1.6, 0x8a6a45], [3.2, 0x7d7464], [5.5, 0x5b5f66]];
      const col = new THREE.Color(), colB = new THREE.Color();
      const colourAt = depth => {
        let i = 0;
        while (i < soil.length - 1 && depth > soil[i + 1][0]) i++;
        const [d0, c0] = soil[i], [d1, c1] = soil[Math.min(soil.length - 1, i + 1)];
        const k = d1 > d0 ? Math.max(0, Math.min(1, (depth - d0) / (d1 - d0))) : 0;
        return col.setHex(c0).lerp(colB.setHex(c1), k);
      };
      // A grid face: rows go from fn(i, 0) to fn(i, 1), split so the colour bands show
      const face = (cols, fn) => {
        const rows = 8, start = positions.length / 3;
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j <= rows; j++) {
            const p = fn(i, j / rows);
            positions.push(p.x, p.y, p.z);
            const c = colourAt(Math.max(0, ground(p.x, p.z) - p.y) + Math.sin(p.x * 3.1 + p.z * 2.3) * 0.08);
            colors.push(c.r, c.g, c.b);
          }
        }
        for (let i = 0; i < cols - 1; i++) {
          for (let j = 0; j < rows; j++) {
            const a = start + i * (rows + 1) + j, b = a + rows + 1;
            index.push(a, b, a + 1, b, b + 1, a + 1);
          }
        }
      };
      const vert = (x, z, k) => { const lo = lower(z), hi = Math.max(lo, ground(x, z)); return { x, z, y: lo + (hi - lo) * k }; };
      face(zs.length, (i, k) => vert(minX, zs[i], k));
      face(zs.length, (i, k) => vert(maxX, zs[i], k));
      face(xs.length, (i, k) => vert(xs[i], backZ, k));
      // The floor of the cut, across from side to side
      face(zs.length, (i, k) => { const x = minX + (maxX - minX) * k, z = zs[i]; return { x, z, y: Math.min(lower(z), ground(x, z)) }; });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geo.setIndex(index);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      mesh.userData.basementTrench = true;
      return mesh;
    }

// --- The camera: while he is inside and the camera is following him, it moves round to look in
// (and down into the cutaway), then goes back to where it was
const tripCam = { on: false, offset: null, releaseUntil: 0, lastMs: 0 };

function basementCameraUpdate() {
      if (state.cameraMode !== 'follow' || !keloGroup) { tripCam.on = false; return false; }
      // Eased by time, so it moves at the same pace however fast the frames come
      const now = performance.now();
      const dt = tripCam.lastMs ? Math.min(0.5, (now - tripCam.lastMs) / 1000) : 1 / 60;
      tripCam.lastMs = now;
      const ease = rate => 1 - Math.exp(-rate * dt);
      const trip = indoorTrip;
      if (trip.active && trip.site) {
        if (!tripCam.on) { tripCam.on = true; tripCam.offset = camera.position.clone().sub(controls.target); }
        const o = trip.site.group.position, k = keloGroup.position;
        let target, pos;
        if (trip.cutLevel) {
          // Down in the pit in front of the building, looking straight into the cut-open floors
          const site = trip.site;
          target = new THREE.Vector3(k.x * 0.5 + o.x * 0.5, k.y + 1.3, o.z);
          pos = new THREE.Vector3(o.x + site.w * 0.08, Math.max(k.y + 2.0, trip.cutBottom + 1.4), o.z + site.d / 2 + site.cutFlat * 0.9);
        } else {
          const dist = trip.site.camDist;
          target = new THREE.Vector3(k.x * 0.6 + o.x * 0.4, k.y + 1.2, k.z * 0.6 + o.z * 0.4);
          pos = target.clone().add(new THREE.Vector3(dist * 0.16, dist * 0.7, dist));
        }
        controls.target.lerp(target, ease(4));
        camera.position.lerp(pos, ease(2.2));
        return true;
      }
      if (tripCam.on) { tripCam.on = false; tripCam.releaseUntil = Date.now() + 2500; }
      if (Date.now() < tripCam.releaseUntil && tripCam.offset) {
        const target = new THREE.Vector3(keloGroup.position.x, keloGroup.position.y + 1.6, keloGroup.position.z);
        controls.target.lerp(target, ease(4));
        camera.position.lerp(target.clone().add(tripCam.offset), ease(2.5));
        return true;
      }
      return false;
    }

// --- Moving a thing between his hands and its place ------------------------------------------
function handsWorldPosition() {
      keloGroup.updateMatrixWorld(true);
      // halfway between his palms
      const l = keloPalmLocal(keloLeftHand, new THREE.Vector3()), r = keloPalmLocal(keloRightHand, new THREE.Vector3());
      return keloGroup.localToWorld(l.add(r).multiplyScalar(0.5));
    }

// Fly an object (already in the building's group) from one local position to another over ms,
// growing or shrinking from scale0 to scale1
async function flyObject(obj, from, to, scale0, scale1, ms = 650) {
      const start = Date.now();
      for (;;) {
        const k = smoothstep(Math.min(1, (Date.now() - start) / ms));
        obj.position.set(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k + Math.sin(Math.PI * k) * 0.12, from.z + (to.z - from.z) * k);
        obj.scale.setScalar(scale0 + (scale1 - scale0) * k);
        if (k >= 1) return;
        await tripPause(30);
      }
    }

function maxSizeOf(obj) {
      const size = new THREE.Vector3();
      new THREE.Box3().setFromObject(obj).getSize(size);
      return Math.max(size.x, size.y, size.z) || 1;
    }

// Put down what he carries at the job's slot (on the floor he is on)
async function placeJob(site, job, temps) {
      const shift = -job.level * BASEMENT_LEVEL_DEPTH;
      const slotW = siteToWorld(site, job.slot.x, job.slot.z, job.slot.y + shift);
      tripFace(slotW);
      indoorTrip.pose = () => reachPose(slotW.y - indoorTrip.pos.y);
      await tripPause(750);
      const landed = job.landing ? job.landing() : null;
      if (landed) {
        const parent = basementBuilt && job.level > 0 ? basementBuilt.group : site.group;
        const to = { x: job.slot.x, y: job.slot.y + shift, z: job.slot.z };
        const hand = site.group.worldToLocal(handsWorldPosition());
        const carriedSize = typeof carriedObject !== 'undefined' && carriedObject ? maxSizeOf(carriedObject) : null;
        parent.add(landed);
        const finalSize = maxSizeOf(landed);
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        await flyObject(landed, hand, to, carriedSize ? carriedSize / finalSize : 1, 1);
        if (parent === site.group) temps.push(landed);
      } else if (typeof setCarriedObject === 'function') {
        setCarriedObject(null);
      }
      job.done = true;
      // The real thing takes over from the stand-in once it is on the books
      if (job.onPlaced && job.onPlaced() && landed && landed.parent === site.group) {
        site.group.remove(landed);
        disposeTree(landed);
        temps.splice(temps.indexOf(landed), 1);
      }
      await tripPause(400);
      indoorTrip.pose = null;
    }

// Take a thing from its slot into his hands
async function takeJob(site, job) {
      const shift = -job.level * BASEMENT_LEVEL_DEPTH;
      const slotW = siteToWorld(site, job.slot.x, job.slot.z, job.slot.y + shift);
      tripFace(slotW);
      indoorTrip.pose = () => reachPose(slotW.y - indoorTrip.pos.y);
      await tripPause(750);
      let real = null;
      site.group.traverse(o => { if (!real && o.visible && job.match && job.match(o)) real = o; });
      if (real) {
        const copy = real.clone();
        copy.userData = {};
        copy.traverse(c => { c.userData = { ...c.userData, sharedGeometry: true }; });
        const at = site.group.worldToLocal(real.getWorldPosition(new THREE.Vector3()));
        copy.position.copy(at);
        copy.quaternion.copy(real.quaternion);
        real.visible = false;
        site.group.add(copy);
        await flyObject(copy, at, site.group.worldToLocal(handsWorldPosition()), copy.scale.x, copy.scale.x * 0.9, 600);
        site.group.remove(copy);
      }
      if (job.carried && typeof setCarriedObject === 'function') setCarriedObject(job.carried());
      job.done = true;
      indoorTrip.pose = null;
      await tripPause(300);
    }

function tripMood(title, speech) {
      state.moodTitle = String(title).slice(0, 80);
      if (speech) state.speechBubble = speech;
      if (typeof renderAllUI === 'function') renderAllUI();
    }

// --- The trip itself ---------------------------------------------------------------------------
// jobs: [{ mode: 'place' | 'take' | 'look' | 'bookkeeping', level, slot, stand, what, carry,
//          landing, onPlaced, match, carried }]. One trip at a time; a second one waits its turn.
let indoorQueue = Promise.resolve();

function goIndoors(siteKey, jobs) {
      const run = indoorQueue.then(() => runIndoorTrip(siteKey, jobs));
      indoorQueue = run.catch(() => {});
      return run;
    }

// Does anything that was skipped (he never got there, or something went wrong), so his
// belongings still end up where they belong
function finishSkippedJobs(jobs) {
      jobs.forEach(job => {
        if (job.done) return;
        job.done = true;
        if (job.onPlaced) job.onPlaced();
        if (job.mode === 'take' && job.carried && typeof setCarriedObject === 'function') setCarriedObject(job.carried());
      });
    }

async function runIndoorTrip(siteKey, jobs) {
      const site = basementSite(siteKey);
      const walked = jobs.filter(j => j.mode !== 'bookkeeping');
      if (!site || !walked.length || !keloGroup) { finishSkippedJobs(jobs); return false; }
      // First the ordinary walk to the door
      const outside = siteToWorld(site, site.outside.x, site.outside.z, 0);
      outside.y = getIslandGroundHeight(outside.x, outside.z);
      state.targetPos = { x: outside.x, z: outside.z };
      const far = Math.hypot(state.botPos.x - outside.x, state.botPos.z - outside.z);
      await waitForArrival(Math.min(150000, 15000 + far * 1500));
      if (Math.hypot(state.botPos.x - outside.x, state.botPos.z - outside.z) > 1.6 || state.riding) {
        // He never made it to the door, so he doesn't go in (and nothing happens underground)
        finishSkippedJobs(jobs);
        return false;
      }
      const roofs = typeof cutawayRoofMeshes !== 'undefined' ? cutawayRoofMeshes.filter(r => r.parent === site.group) : [];
      const temps = [];
      const atFloor = (p, level) => siteToWorld(site, p.x, p.z, levelFloorY(site, level));
      try {
        Object.assign(indoorTrip, {
          active: true, site, pos: { x: state.botPos.x, y: getIslandGroundHeight(state.botPos.x, state.botPos.z), z: state.botPos.z },
          rotY: state.botRotY, path: null, pose: null, crouch: 0, crouchTarget: 0, lastT: null
        });
        roofs.forEach(r => { r.material.opacity = 0.12; });
        await tripWalk([outside, ...site.walkIn.map(p => siteToWorld(site, p.x, p.z, p.y))]);
        const hub = site.walkIn[site.walkIn.length - 1];
        let cur = { x: hub.x, z: hub.z }, level = 0;
        const deepest = Math.max(0, ...walked.map(j => j.level || 0));
        const sorted = walked.slice().sort((a, b) => (a.level || 0) - (b.level || 0));
        for (const job of sorted) {
          const want = job.level || 0;
          if (job.mode === 'place' && job.carry && typeof setCarriedObject === 'function') setCarriedObject(job.carry());
          if (want !== level) {
            const entry = stairEntry(site);
            await tripWalk(routeInside(site, cur, entry).map(p => atFloor(p, level)));
            if (!basementBuilt) {
              // (whatever he brings down isn't on the books yet, so its place is still empty)
              buildBasements(site, deepest);
              setEarthCut(site, deepest);
            }
            tripMood(`Going down to ${site.key === 'museum' ? 'the lower gallery' : 'basement'} B${want}`, `${job.what || 'It'} ${job.mode === 'take' ? 'is down' : 'goes'} on B${want}. Down the stairs I go.`);
            await tripWalk(spiralPath(site, level, want), STAIR_WALK_SPEED);
            level = want;
            cur = entry;
            tripMood(`Down on B${want} of the ${site.name}`);
          }
          if (job.stand) await tripWalk(routeInside(site, cur, job.stand).map(p => atFloor(p, level)));
          if (job.stand) cur = job.stand;
          if (job.mode === 'place' && job.slot) await placeJob(site, job, temps);
          else if (job.mode === 'take' && job.slot) await takeJob(site, job);
          else { await tripPause(1200); job.done = true; }
        }
        if (level > 0) {
          const entry = stairEntry(site);
          await tripWalk(routeInside(site, cur, entry).map(p => atFloor(p, level)));
          tripMood('Climbing back up the stairs');
          await tripWalk(spiralPath(site, level, 0), STAIR_WALK_SPEED);
          setEarthCut(null);
          clearBasements();
          cur = entry;
          level = 0;
        }
        const back = routeInside(site, cur, hub).map(p => atFloor(p, 0));
        await tripWalk([...back, ...site.walkIn.slice().reverse().map(p => siteToWorld(site, p.x, p.z, p.y)), outside]);
        return true;
      } finally {
        // However the trip ended, he is back up at the door and nothing underground is left showing
        finishSkippedJobs(jobs);
        indoorTrip.path = null;
        const hold = indoorTrip.resolve;
        indoorTrip.resolve = null;
        if (hold) hold();
        indoorTrip.active = false;
        indoorTrip.site = null;
        indoorTrip.pose = null;
        indoorTrip.crouch = 0;
        state.basementDepth = 0;
        state.botPos = { x: outside.x, z: outside.z };
        setEarthCut(null);
        clearBasements();
        temps.forEach(t => { if (t.parent) t.parent.remove(t); disposeTree(t); });
        roofs.forEach(r => { r.material.opacity = state.roofCutaway ? 0.18 : 0.95; });
      }
    }

// --- Museum errands ----------------------------------------------------------------------------
// Where a sculpture or painting with this place in its list goes, and where he stands to reach it
function museumSlotFor(kind, index) {
      if (kind === 'painting') {
        const per = MUSEUM_FRAMES.length || 8, slot = MUSEUM_FRAMES[index % per];
        return { level: Math.floor(index / per), slot, stand: { x: slot.x + Math.sin(slot.rotY) * 1.15, z: slot.z + Math.cos(slot.rotY) * 1.15 } };
      }
      const per = MUSEUM_PLINTHS.length || 8, p = MUSEUM_PLINTHS[index % per];
      return { level: Math.floor(index / per), slot: { x: p.x, y: p.y, z: p.z, rotY: 0 }, stand: { x: p.x, z: p.z + 1.0 } };
    }

// Carry a new sculpture or painting into the Museum and set it in its place (on a lower floor if
// the ones above are full). Call it before the piece is added to the Museum's lists.
async function carryIntoMuseum(kind, piece, label) {
      if (!MUSEUM_PLINTHS.length) return false;
      const index = kind === 'painting' ? allMuseumPaintings().length : allMuseumSculptures().length;
      const at = museumSlotFor(kind, index);
      const landing = () => {
        if (kind === 'painting') {
          const frame = buildMuseumFrame(piece);
          frame.position.set(at.slot.x, at.slot.y, at.slot.z);
          frame.rotation.y = at.slot.rotY;
          return frame;
        }
        return museumSculptureHolder(piece, at.slot);
      };
      const carry = kind === 'painting' ? () => { const f = buildMuseumFrame(piece); f.scale.setScalar(0.55); return f; } : null;
      tripMood(`Taking ${label} into the Museum`);
      return goIndoors('museum', [{ mode: 'place', level: at.level, slot: at.slot, stand: at.stand, what: piece.title || piece.text, carry, landing }]);
    }

// Go in and take a piece down from its plinth or wall (found by findMuseumPiece in js/takeout.js)
async function takeFromMuseum(found, carried) {
      const list = found.kind === 'sculpture' ? allMuseumSculptures() : allMuseumPaintings();
      const at = museumSlotFor(found.kind, list.indexOf(found.piece));
      const match = found.kind === 'sculpture'
        ? o => o.userData && o.userData.itemName === found.piece.title && o.children.length > 0
        : o => o.userData && o.userData.muralSeed === found.piece.seed;
      return goIndoors('museum', [{ mode: 'take', level: at.level, slot: at.slot, stand: at.stand, what: found.label, match, carried }]);
    }
