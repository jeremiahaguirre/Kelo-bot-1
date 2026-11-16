// Kelo-bot-1 — js/ambience.js
// Loaded after scatter.js. Life in the air and in town, all drawing only (no gameplay):
//   - drifting motes in the air around the view: dust and pollen by day, falling leaves in autumn,
//     fireflies on summer nights (one points mesh, moved in its shader: no JavaScript per particle)
//   - smoke from the house chimney (one points mesh, shader-driven, leans with the wind)
//   - flags on the town's roofs that wave with the wind (vertex shader)
//   - a few townspeople (original simple figures) walking set routes along Main Street and the shore,
//     who stop and wait when Kelo-1 is in their way; a car that drives along Main Street now and then
//     and waits for him too; two cars parked off the streets
// Every part follows the Graphics level (graphics().airParticles, smoke, flags, townLife).

// --- 1. Shared bits ------------------------------------------------------------------------------
function ambSoftDot() {
      if (ambSoftDot.tex) return ambSoftDot.tex;
      const s = 32, cv = document.createElement('canvas');
      cv.width = cv.height = s;
      const ctx = cv.getContext('2d');
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
      ambSoftDot.tex = new THREE.CanvasTexture(cv);
      return ambSoftDot.tex;
    }
const AMB_U = {
  ambTime: { value: 0 },
  ambWind: { value: new THREE.Vector2(1, 0) },
  ambCentre: { value: new THREE.Vector3() },
  ambPixel: { value: 1 }
};

// --- 2. Motes in the air -------------------------------------------------------------------------
let ambAir = null;
const AMB_AIR_LOOKS = {
  dust: { color: [1.0, 0.93, 0.78], size: 0.06, opacity: 0.55, fall: 0.02, glow: 0 },
  pollen: { color: [1.0, 0.95, 0.6], size: 0.07, opacity: 0.6, fall: -0.01, glow: 0 },
  leaves: { color: [0.86, 0.46, 0.16], size: 0.2, opacity: 0.95, fall: 0.35, glow: 0 },
  fireflies: { color: [0.85, 1.0, 0.45], size: 0.09, opacity: 1.0, fall: 0.0, glow: 1 }
};
function ambBuildAir(n) {
      if (ambAir) { scene.remove(ambAir); ambAir.geometry.dispose(); ambAir.material.dispose(); ambAir = null; }
      if (!n) return;
      const seed = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { seed[i * 4] = Math.random(); seed[i * 4 + 1] = Math.random(); seed[i * 4 + 2] = Math.random(); seed[i * 4 + 3] = Math.random(); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
      const R = LOOK.air.radius, H = LOOK.air.height;
      const mat = new THREE.ShaderMaterial({
        uniforms: Object.assign({ airColor: { value: new THREE.Vector3(1, 1, 1) }, airSize: { value: 0.06 }, airOpacity: { value: 0 }, airFall: { value: 0 }, airGlow: { value: 0 }, airLight: { value: 1 }, map: { value: ambSoftDot() } }, AMB_U),
        vertexShader: `attribute vec4 seed;
uniform float ambTime; uniform vec2 ambWind; uniform vec3 ambCentre; uniform float ambPixel;
uniform float airSize; uniform float airFall; uniform float airGlow;
varying float vA;
void main() {
	vec3 box = vec3( ${(R * 2).toFixed(1)}, ${H.toFixed(1)}, ${(R * 2).toFixed(1)} );
	float t = ambTime;
	vec3 drift = vec3( ambWind.x, - airFall, ambWind.y ) * t * ( 0.6 + seed.w * 0.8 );
	// wandering paths
	drift += vec3( sin( t * 0.7 + seed.x * 40.0 ), sin( t * 0.9 + seed.y * 30.0 ) * 0.6, cos( t * 0.6 + seed.z * 50.0 ) ) * ( 0.4 + airGlow * 0.6 );
	vec3 p = mod( seed.xyz * box + drift - ambCentre + box * 0.5, box ) - box * 0.5 + ambCentre;
	p.y = ambCentre.y - 1.5 + mod( seed.y * box.y + drift.y, box.y );
	vec4 mv = modelViewMatrix * vec4( p, 1.0 );
	gl_Position = projectionMatrix * mv;
	float d = length( p.xz - ambCentre.xz ) / box.x * 2.0;
	vA = ( 1.0 - smoothstep( 0.7, 1.0, d ) ) * smoothstep( 0.3, 2.0, - mv.z );
	// fireflies blink
	vA *= mix( 1.0, smoothstep( 0.55, 1.0, sin( t * ( 1.5 + seed.w * 2.0 ) + seed.x * 60.0 ) ), airGlow );
	gl_PointSize = airSize * ( 0.6 + seed.w * 0.8 ) * ambPixel / max( - mv.z, 0.5 );
}`,
        fragmentShader: `uniform sampler2D map; uniform vec3 airColor; uniform float airOpacity; uniform float airLight;
varying float vA;
void main() {
	float a = texture2D( map, gl_PointCoord ).a * vA * airOpacity;
	if ( a < 0.01 ) discard;
	gl_FragColor = vec4( airColor * airLight, a );
}`,
        transparent: true, depthWrite: false
      });
      ambAir = new THREE.Points(geo, mat);
      ambAir.frustumCulled = false;
      ambAir.userData.noShadow = true;
      scene.add(ambAir);
    }
function ambAirLook() {
      const s = SKY_STATE, season = typeof seasonApplied !== 'undefined' ? seasonApplied : 'Summer';
      if ((s.overcast || 0) > 0.3 || season === 'Winter') return null; // rain and snow have their own
      if (s.night > 0.6) return season === 'Summer' ? 'fireflies' : null;
      if (season === 'Autumn') return 'leaves';
      return season === 'Spring' || season === 'Summer' ? (s.dusk > 0.2 ? 'dust' : 'pollen') : 'dust';
    }

// --- 3. Chimney smoke --------------------------------------------------------------------------
let ambSmoke = null;
function ambChimneys() {
      const out = [];
      if (typeof HOUSE !== 'undefined') out.push({ x: HOUSE.x - HOUSE.w / 2 - 0.45, y: HOUSE.floorY + HOUSE.wallH + 2.1 + 1.5, z: HOUSE.z - 1.6 });
      return out;
    }
function ambBuildSmoke() {
      if (ambSmoke) { scene.remove(ambSmoke); ambSmoke.geometry.dispose(); ambSmoke.material.dispose(); ambSmoke = null; }
      const ch = ambChimneys();
      if (!ch.length) return;
      const per = 36, n = per * ch.length;
      const pos = new Float32Array(n * 3), seed = new Float32Array(n);
      ch.forEach((c, j) => { for (let i = 0; i < per; i++) { const k = j * per + i; pos[k * 3] = c.x; pos[k * 3 + 1] = c.y; pos[k * 3 + 2] = c.z; seed[k] = i / per + Math.random() * 0.02; } });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(ch[0].x, ch[0].y + 4, ch[0].z), 12);
      const mat = new THREE.ShaderMaterial({
        uniforms: Object.assign({ smokeColor: { value: new THREE.Vector3(0.8, 0.8, 0.8) }, smokeAmt: { value: 0.5 }, map: { value: ambSoftDot() } }, AMB_U),
        vertexShader: `attribute float seed;
uniform float ambTime; uniform vec2 ambWind; uniform float ambPixel;
varying float vA;
void main() {
	float age = fract( ambTime * 0.09 + seed );
	vec3 p = position;
	float wob = sin( seed * 91.0 + ambTime * 0.8 ) * 0.25 * age;
	p += vec3( ambWind.x * age * age * 7.0 + wob, age * 5.5, ambWind.y * age * age * 7.0 + wob * 0.6 );
	vec4 mv = modelViewMatrix * vec4( p, 1.0 );
	gl_Position = projectionMatrix * mv;
	vA = smoothstep( 0.0, 0.08, age ) * ( 1.0 - smoothstep( 0.45, 1.0, age ) );
	gl_PointSize = ( 0.5 + age * 2.6 ) * ambPixel / max( - mv.z, 0.5 );
}`,
        fragmentShader: `uniform sampler2D map; uniform vec3 smokeColor; uniform float smokeAmt; varying float vA;
void main() {
	float a = texture2D( map, gl_PointCoord ).a * vA * smokeAmt;
	if ( a < 0.01 ) discard;
	gl_FragColor = vec4( smokeColor, a );
}`,
        transparent: true, depthWrite: false
      });
      ambSmoke = new THREE.Points(geo, mat);
      ambSmoke.userData.noShadow = true;
      scene.add(ambSmoke);
    }

// --- 4. Flags ------------------------------------------------------------------------------------
// Original pennants in the town's colours on short masts on the roofs (no obstacles needed up there)
let ambFlags = null;
function ambFlagTexture() {
      const cv = document.createElement('canvas');
      cv.width = 128; cv.height = 64;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#1d6f8f'; ctx.fillRect(0, 0, 128, 64);
      ctx.fillStyle = '#f2c14e'; ctx.fillRect(0, 22, 128, 20);
      ctx.fillStyle = '#f7f3e8';
      ctx.beginPath(); ctx.arc(40, 32, 9, 0, Math.PI * 2); ctx.fill();
      const t = new THREE.CanvasTexture(cv);
      return t;
    }
function ambRoofTop(x, z, top) {
      // highest surface of the scene's static things here (a ray straight down)
      const rc = new THREE.Raycaster(new THREE.Vector3(x, top, z), new THREE.Vector3(0, -1, 0), 0, top);
      rc.camera = camera; // sprites (clouds) need it
      const hits = rc.intersectObjects(scene.children, true).filter(h => h.object.isMesh && h.object.visible && h.object !== terrainGroundMesh && !(h.object.userData && h.object.userData.isLabel));
      return hits.length ? hits[0].point.y : null;
    }
function ambBuildFlags() {
      if (ambFlags) { scene.remove(ambFlags); ambFlags.traverse(o => { if (o.geometry) o.geometry.dispose(); }); ambFlags = null; }
      if (typeof TOWN_BUILDINGS === 'undefined') return;
      const spots = [TOWN_BUILDINGS.post_office, TOWN_BUILDINGS.cafe].filter(Boolean).map(b => ({ x: b.x + b.w * 0.3, z: b.z - b.d * 0.25 }));
      if (typeof STOREHOUSE !== 'undefined') spots.push({ x: STOREHOUSE.x - STOREHOUSE.w * 0.3, z: STOREHOUSE.z });
      ambFlags = new THREE.Group();
      const clothGeo = new THREE.PlaneGeometry(1.5, 0.8, 12, 4);
      clothGeo.translate(0.75, 0, 0);
      const clothMat = new THREE.MeshStandardMaterial({ map: ambFlagTexture(), roughness: 0.85, side: THREE.DoubleSide });
      clothMat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, FOLIAGE_WIND);
        sh.vertexShader = 'uniform float keloWindTime; uniform float keloWindLean; uniform float keloWindSpeed;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
	{
		float u = position.x / 1.5;
		float k = 0.25 + keloWindLean * 3.0;
		transformed.z += sin( position.x * 3.2 - keloWindTime * ( 2.0 + keloWindSpeed ) ) * 0.14 * u * ( 0.5 + k );
		transformed.y -= u * u * 0.25 * ( 1.0 - min( 1.0, k ) );
	}`);
      };
      const poleMat = new THREE.MeshStandardMaterial({ color: 0xd9dde0, roughness: 0.35, metalness: 0.7 });
      spots.forEach(s => {
        const roof = ambRoofTop(s.x, s.z, 30);
        if (roof === null) return;
        const mast = new THREE.Group();
        mast.position.set(s.x, roof, s.z);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 2.6, 6), poleMat);
        pole.position.y = 1.3;
        pole.castShadow = true;
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), poleMat);
        knob.position.y = 2.62;
        const cloth = new THREE.Mesh(clothGeo, clothMat);
        cloth.position.y = 2.15;
        cloth.castShadow = true;
        cloth.userData.ambFlag = true;
        mast.add(pole, knob, cloth);
        ambFlags.add(mast);
      });
      if (typeof chunkDynamic !== 'undefined' && chunkDynamic.add) ambFlags.traverse(o => chunkDynamic.add(o));
      scene.add(ambFlags);
    }
// The flags turn to stream downwind
function ambUpdateFlags() {
      if (!ambFlags || typeof windShown === 'undefined') return;
      const a = -(windShown.angle || 0);
      ambFlags.children.forEach(m => { const c = m.children[2]; if (c) c.rotation.y = a + Math.sin(AMB_U.ambTime.value * 0.7) * 0.15; });
    }

// --- 5. Townspeople and cars ------------------------------------------------------------------
// Each person is four instanced parts shared by all of them (torso, head, legs, arms): 4 draw calls.
const AMB_PEOPLE_LOOKS = [
  { shirt: 0xc4553b, pants: 0x34405a, skin: 0xe0b48f, hat: 0x2f3b2c },
  { shirt: 0x3e8a7a, pants: 0x4d3b2e, skin: 0x9a6a46, hat: 0xe9d9b0 },
  { shirt: 0xe3b23c, pants: 0x2b3442, skin: 0xc58c64, hat: 0x7a3b2f },
  { shirt: 0x6b5ca5, pants: 0x585f66, skin: 0xf0c7a4, hat: 0x2b2b30 },
  { shirt: 0xf2efe6, pants: 0x30495f, skin: 0x6e4a34, hat: 0xb04a3a },
  { shirt: 0x4f7bbf, pants: 0x3a3a3a, skin: 0xd9a77e, hat: 0xd8c46a }
];
const ambPeople = [];
let ambPeopleMesh = null, ambCar = null, ambParked = [];
// Routes: back and forth along a line (both ends inside town, on open ground beside the streets)
function ambRoutes() {
      const z = typeof MAIN_STREET !== 'undefined' ? MAIN_STREET.z : -7.4, hw = typeof MAIN_STREET !== 'undefined' ? MAIN_STREET.w / 2 : 2.2;
      return [
        [[-30, z - hw - 0.7], [12, z - hw - 0.7]],
        [[10, z + hw + 0.7], [-28, z + hw + 0.7]],
        [[-26, 5.4], [7, 5.4]],
        [[-16, z + hw + 0.9], [6, z + hw + 0.9]],
        [[4, 5.8], [-22, 5.8]],
        [[-6, z - hw - 1.0], [-32, z - hw - 1.0]]
      ];
    }
function ambBuildPeople(n) {
      if (ambPeopleMesh) { ambPeopleMesh.forEach(m => { scene.remove(m); m.geometry.dispose(); m.dispose && m.dispose(); }); ambPeopleMesh = null; }
      ambPeople.length = 0;
      if (!n) return;
      const H = 2.5; // about 1.6 m (1 unit = 62.5 cm)
      const torso = new THREE.CylinderGeometry(0.2, 0.24, H * 0.36, 8); torso.translate(0, H * 0.5 + H * 0.18, 0);
      const head = new THREE.SphereGeometry(0.2, 10, 8); head.translate(0, H * 0.92, 0);
      const brim = new THREE.CylinderGeometry(0.27, 0.27, 0.03, 10); brim.translate(0, H * 0.98, 0);
      const crown = new THREE.CylinderGeometry(0.17, 0.19, 0.16, 10); crown.translate(0, H * 1.04, 0);
      const leg = new THREE.CylinderGeometry(0.075, 0.07, H * 0.5, 6); leg.translate(0, -H * 0.25, 0);
      const arm = new THREE.CylinderGeometry(0.055, 0.05, H * 0.34, 6); arm.translate(0, -H * 0.17, 0);
      const hat = joinGeometries([brim, crown]);
      const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ color: 0xffffff, roughness: 0.75 }, o));
      const parts = [
        new THREE.InstancedMesh(torso, std({}), n),
        new THREE.InstancedMesh(head, std({ roughness: 0.6 }), n),
        new THREE.InstancedMesh(hat, std({}), n),
        new THREE.InstancedMesh(leg, std({}), n * 2),
        new THREE.InstancedMesh(arm, std({}), n * 2)
      ];
      const routes = ambRoutes(), c = new THREE.Color();
      for (let i = 0; i < n; i++) {
        const L = AMB_PEOPLE_LOOKS[i % AMB_PEOPLE_LOOKS.length], r = routes[i % routes.length];
        parts[0].setColorAt(i, c.setHex(L.shirt));
        parts[1].setColorAt(i, c.setHex(L.skin));
        parts[2].setColorAt(i, c.setHex(L.hat));
        parts[3].setColorAt(i * 2, c.setHex(L.pants)); parts[3].setColorAt(i * 2 + 1, c.setHex(L.pants));
        parts[4].setColorAt(i * 2, c.setHex(L.shirt)); parts[4].setColorAt(i * 2 + 1, c.setHex(L.shirt));
        ambPeople.push({ route: r, u: (i * 0.37) % 1, dir: i % 2 ? -1 : 1, speed: 1.0 + (i % 3) * 0.18, phase: i * 1.3, wait: 0, H });
      }
      parts.forEach(m => {
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        m.castShadow = true; m.receiveShadow = true;
        m.frustumCulled = false;
        if (typeof chunkDynamic !== 'undefined' && chunkDynamic.add) chunkDynamic.add(m);
        scene.add(m);
      });
      ambPeopleMesh = parts;
    }
const ambM = new THREE.Matrix4(), ambQ = new THREE.Quaternion(), ambE = new THREE.Euler(), ambP = new THREE.Vector3(), ambS = new THREE.Vector3(1, 1, 1), ambP2 = new THREE.Vector3();
function ambSomeoneInTheWay(x, z, hx, hz, near) {
      // Kelo-1 (and whatever he drives) a little ahead
      const b = state.botPos;
      if (!b) return false;
      const dx = b.x - x, dz = b.z - z, d = Math.hypot(dx, dz);
      return d < near && (dx * hx + dz * hz) > -0.3;
    }
function ambUpdatePeople(dt) {
      if (!ambPeopleMesh) return;
      const [torso, head, hat, legs, arms] = ambPeopleMesh;
      const night = SKY_STATE.night;
      ambPeople.forEach((p, i) => {
        const [a, b] = p.route, len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        let hx = (b[0] - a[0]) / len * p.dir, hz = (b[1] - a[1]) / len * p.dir;
        let x = a[0] + (b[0] - a[0]) * p.u, z = a[1] + (b[1] - a[1]) * p.u;
        let walking = true;
        if (p.wait > 0) { p.wait -= dt; walking = false; }
        else if (ambSomeoneInTheWay(x, z, hx, hz, 1.6)) walking = false;
        else if (typeof obstacleClearAt === 'function' && !obstacleClearAt(x + hx * 0.5, z + hz * 0.5, 0.2)) { p.dir *= -1; p.wait = 1 + (i % 2); walking = false; }
        else {
          p.u += p.dir * p.speed * dt / len;
          if (p.u > 1 || p.u < 0) { p.u = Math.max(0, Math.min(1, p.u)); p.dir *= -1; p.wait = 1.5 + (i % 3); }
        }
        const y = getIslandGroundHeight(x, z);
        if (y < 0.06 && walking) { p.dir *= -1; p.wait = 1; }
        p.walkT = (p.walkT || 0) + (walking ? dt * p.speed * 5.2 : 0);
        const sw = walking ? Math.sin(p.walkT) : 0;
        const yaw = Math.atan2(hx, hz) + (p.wait > 0 ? Math.sin(AMB_U.ambTime.value * 0.4 + i) * 0.6 : 0);
        const hide = night > 0.85 && i % 2 === 1; // fewer people out late at night
        ambS.setScalar(hide ? 0.0001 : 1);
        const bob = Math.abs(sw) * 0.04;
        ambQ.setFromEuler(ambE.set(0, yaw, 0));
        ambM.compose(ambP.set(x, y + bob, z), ambQ, ambS);
        torso.setMatrixAt(i, ambM); head.setMatrixAt(i, ambM); hat.setMatrixAt(i, ambM);
        const H = p.H, cs = Math.cos(yaw), sn = Math.sin(yaw);
        [-1, 1].forEach((side, k) => {
          // hips and shoulders, in the person's own frame turned to the world
          const ox = side * 0.11;
          ambQ.setFromEuler(ambE.set(sw * 0.55 * side, yaw, 0, 'YXZ'));
          ambM.compose(ambP.set(x + ox * cs, y + bob + H * 0.5, z - ox * sn), ambQ, ambS);
          legs.setMatrixAt(i * 2 + k, ambM);
          const ax = side * 0.28;
          ambQ.setFromEuler(ambE.set(-sw * 0.45 * side, yaw, side * 0.08, 'YXZ'));
          ambM.compose(ambP.set(x + ax * cs, y + bob + H * 0.84, z - ax * sn), ambQ, ambS);
          arms.setMatrixAt(i * 2 + k, ambM);
        });
      });
      ambPeopleMesh.forEach(m => { m.instanceMatrix.needsUpdate = true; });
    }

// A small rounded car (original design), body colour per car
function ambCarModel(color) {
      const g = new THREE.Group();
      const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.4 });
      const glass = new THREE.MeshStandardMaterial({ color: 0x2c3a44, roughness: 0.1, metalness: 0.5 });
      const tyre = new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.9 });
      const body = new THREE.Mesh(typeof mmBevelGeo === 'function' ? mmBevelGeo(3.6, 0.8, 1.7, 0.18) : new THREE.BoxGeometry(3.6, 0.8, 1.7), paint);
      body.position.y = 0.75;
      const cab = new THREE.Mesh(typeof mmBevelGeo === 'function' ? mmBevelGeo(2.0, 0.7, 1.5, 0.2) : new THREE.BoxGeometry(2.0, 0.7, 1.5), glass);
      cab.position.set(-0.2, 1.45, 0);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 1.4), paint);
      roof.position.set(-0.2, 1.82, 0);
      g.add(body, cab, roof);
      const wheels = [];
      [[1.15, 0.85], [1.15, -0.85], [-1.15, 0.85], [-1.15, -0.85]].forEach(([x, z]) => {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14), tyre);
        w.rotation.x = Math.PI / 2;
        w.position.set(x, 0.36, z);
        g.add(w); wheels.push(w);
      });
      const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xffe2a0, emissiveIntensity: 0 });
      [0.5, -0.5].forEach(z => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.34), lampMat); l.position.set(1.81, 0.85, z); g.add(l); });
      g.userData.ambWheels = wheels;
      g.userData.ambLamp = lampMat;
      g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      return g;
    }
function ambBuildCars(level) {
      if (ambCar) { scene.remove(ambCar.model); ambCar = null; }
      ambParked.forEach(p => { scene.remove(p.model); if (p.obstacle && typeof removeObstacle === 'function') removeObstacle(p.obstacle); });
      ambParked = [];
      if (!level) return;
      // passing car on Main Street (south lane), only on Medium and High
      if (level >= 2 && typeof MAIN_STREET !== 'undefined') {
        const model = ambCarModel(0x2f6f9f);
        model.scale.setScalar(0.62);
        if (typeof chunkDynamic !== 'undefined' && chunkDynamic.add) model.traverse(o => chunkDynamic.add(o));
        scene.add(model);
        ambCar = { model, x: MAIN_STREET.x0, dir: 1, wait: 8, lane: 1.05 };
      }
      // parked cars: on open ground beside the streets, kept out of everything he uses
      const tries = [[-26.5, -3.3, 0], [4.8, -3.6, 0], [-13.5, -3.4, 0], [14.5, -10.6, Math.PI / 2]];
      const colours = [0xb5473a, 0xe8e4da, 0x4a6b3d];
      for (const [x, z, rot] of tries) {
        if (ambParked.length >= LOOK.life.carsParked) break;
        const okHere = (typeof obstacleClearAt !== 'function' || obstacleClearAt(x, z, 1.6))
          && !(typeof onKeloRoad === 'function' && onKeloRoad(x, z, 1.3))
          && !(typeof inParkingArea === 'function' && inParkingArea(x, z, 1.5))
          && !Object.values(TOWN_LOCATIONS).some(l => Math.hypot(x - l.x, z - l.z) < 3.2)
          && !(typeof groundTooSteep === 'function' && groundTooSteep(x, z, 0.5));
        if (!okHere) continue;
        const model = ambCarModel(colours[ambParked.length % colours.length]);
        model.scale.setScalar(0.62);
        model.position.set(x, getIslandGroundHeight(x, z), z);
        model.rotation.y = rot;
        scene.add(model);
        const obstacle = typeof obstacleBox === 'function' ? obstacleBox(x, z, rot ? 0.6 : 1.2, rot ? 1.2 : 0.6, { ambCar: true }) : null;
        if (obstacle && typeof addObstacle === 'function') addObstacle(obstacle);
        ambParked.push({ model, obstacle });
      }
    }
function ambUpdateCar(dt) {
      if (!ambCar) return;
      const c = ambCar, m = c.model, S = MAIN_STREET;
      const lit = SKY_STATE.night > 0.3 || SKY_STATE.dusk > 0.6;
      m.userData.ambLamp.emissiveIntensity = lit ? 2.2 : 0;
      if (c.wait > 0) { c.wait -= dt; m.visible = false; return; }
      m.visible = true;
      const z = S.z + c.lane * c.dir;
      // waits for Kelo-1 (or anything he's driving) in front
      const blocked = ambSomeoneInTheWay(c.x, z, c.dir, 0, 3.4);
      if (!blocked) c.x += c.dir * 3.2 * dt;
      if (c.x > S.x1 || c.x < S.x0) { c.dir *= -1; c.x = Math.max(S.x0, Math.min(S.x1, c.x)); c.wait = 20 + Math.random() * 25; m.visible = false; return; }
      m.position.set(c.x, getIslandGroundHeight(c.x, z) + 0.02, z);
      m.rotation.y = c.dir > 0 ? 0 : Math.PI;
      if (!blocked) m.userData.ambWheels.forEach(w => { w.rotation.y -= 3.2 * dt / (0.36 * 0.62); });
    }

// --- 5b. Warm pools of lamplight in front of the buildings after dark ---------------------------
// The wall lamps (bldKit bulbs) glow; this lays their light on the ground: one instanced mesh of soft
// additive patches, faded in with the dark (no real lights, so it costs no shading).
let ambPools = null;
function ambBuildPools() {
      if (ambPools) { scene.remove(ambPools); ambPools.geometry.dispose(); ambPools = null; }
      const spots = [];
      if (typeof TOWN_BUILDINGS !== 'undefined') Object.values(TOWN_BUILDINGS).forEach(b => spots.push([b.x, b.z + b.d / 2 + 1.3, 3.4]));
      if (typeof HOUSE !== 'undefined') spots.push([HOUSE.x, HOUSE.z + HOUSE.d / 2 + 2.4, 3.6]);
      if (typeof STOREHOUSE !== 'undefined') spots.push([STOREHOUSE.x, STOREHOUSE.z + STOREHOUSE.d / 2 + 1.4, 3.4]);
      if (typeof MUSEUM !== 'undefined') spots.push([MUSEUM.x, MUSEUM.z + MUSEUM.d / 2 + 1.6, 3.8]);
      if (!spots.length) return;
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const ctx = cv.getContext('2d'), g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,190,110,1)'); g.addColorStop(0.5, 'rgba(255,170,90,0.35)'); g.addColorStop(1, 'rgba(255,160,80,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
      const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      ambPools = new THREE.InstancedMesh(geo, mat, spots.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
      spots.forEach(([x, z, r], i) => { m.compose(p.set(x, getIslandGroundHeight(x, z) + 0.04, z), q, s.set(r * 2, 1, r * 1.5)); ambPools.setMatrixAt(i, m); });
      ambPools.userData.noShadow = true;
      ambPools.castShadow = ambPools.receiveShadow = false;
      ambPools.visible = false;
      if (typeof chunkDynamic !== 'undefined' && chunkDynamic.add) chunkDynamic.add(ambPools);
      scene.add(ambPools);
    }
function ambUpdatePools() {
      if (!ambPools) return;
      const dark = typeof skyDarkness === 'function' ? skyDarkness() : 0;
      ambPools.material.opacity = 0.32 * Math.max(0, dark - 0.25) / 0.75;
      ambPools.visible = ambPools.material.opacity > 0.01;
    }

// --- 6. Each frame and the level ---------------------------------------------------------------
const ambWant = { air: -1, life: -1, smoke: null, flags: null };
function ambApplyLevel() {
      if (typeof scene === 'undefined' || !scene || !terrainGroundMesh) return;
      const q = graphics();
      if (ambWant.air !== q.airParticles) { ambWant.air = q.airParticles; ambBuildAir(q.airParticles || 0); }
      if (ambWant.smoke !== Boolean(q.smoke)) { ambWant.smoke = Boolean(q.smoke); if (q.smoke) ambBuildSmoke(); else if (ambSmoke) ambSmoke.visible = false; }
      if (ambWant.flags !== Boolean(q.flags)) { ambWant.flags = Boolean(q.flags); if (q.flags) ambBuildFlags(); else if (ambFlags) { scene.remove(ambFlags); ambFlags = null; } }
      if (!ambPools) ambBuildPools();
      if (ambWant.life !== (q.townLife || 0)) {
        ambWant.life = q.townLife || 0;
        ambBuildPeople(ambWant.life ? (ambWant.life >= 2 ? LOOK.life.people : 3) : 0);
        ambBuildCars(ambWant.life);
      }
    }
let ambLast = 0;
function ambFrame(now) {
      const dt = Math.min(0.1, ambLast ? (now - ambLast) / 1000 : 0.016);
      ambLast = now;
      AMB_U.ambTime.value += dt;
      if (typeof windShown !== 'undefined' && windShown) {
        const sp = 0.25 + (windShown.s || 0.3) * 1.4;
        AMB_U.ambWind.value.set(Math.cos(windShown.angle || 0) * sp, Math.sin(windShown.angle || 0) * sp);
      }
      AMB_U.ambPixel.value = renderer.getPixelRatio() * (renderer.domElement.clientHeight || 600) * 0.6;
      const s = SKY_STATE;
      if (ambAir) {
        const look = ambAirLook(), u = ambAir.material.uniforms;
        if (!look) { u.airOpacity.value += (0 - u.airOpacity.value) * Math.min(1, dt); ambAir.visible = u.airOpacity.value > 0.01; }
        else {
          const L = AMB_AIR_LOOKS[look];
          ambAir.visible = true;
          u.airColor.value.set(L.color[0], L.color[1], L.color[2]);
          u.airSize.value = L.size; u.airFall.value = L.fall; u.airGlow.value = L.glow;
          u.airOpacity.value += (L.opacity - u.airOpacity.value) * Math.min(1, dt);
          // lit by the sun (fireflies make their own light)
          u.airLight.value = L.glow ? 1.6 : (0.25 + 0.75 * s.day) * (1 + 0.3 * s.dusk);
        }
        if (controls && controls.target) u.ambCentre.value.copy(controls.target);
      }
      if (ambSmoke) {
        const u = ambSmoke.material.uniforms, k = 0.3 + 0.7 * s.day;
        u.smokeColor.value.set(0.78 * k + 0.05, 0.78 * k + 0.05, 0.8 * k + 0.07);
        // a thicker plume on cold days, mornings and evenings
        const season = typeof seasonApplied !== 'undefined' ? seasonApplied : 'Summer';
        u.smokeAmt.value = (season === 'Winter' ? 0.6 : season === 'Summer' ? 0.22 : 0.4) + 0.2 * Math.max(s.dusk, s.night);
      }
      ambUpdateFlags();
      ambUpdatePools();
      ambUpdatePeople(dt);
      ambUpdateCar(dt);
    }
(function ambHook() {
      const orig = finishRealisticWorld;
      finishRealisticWorld = function () {
        orig.apply(this, arguments);
        if (typeof keloEveryFrame === 'function') keloEveryFrame(ambFrame);
        // the town is built by now; flags look for the roofs a moment later
        setTimeout(ambApplyLevel, 1500);
      };
    })();
