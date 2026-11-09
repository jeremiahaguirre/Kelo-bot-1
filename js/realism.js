// Kelo-bot-1 — js/realism.js
// Loaded after scene.js. Makes Kelo-1's valley look like real life:
//   - real colour handling: every colour in the code is an ordinary (sRGB) colour, lighting is done in
//     linear light, and filmic (ACES) tone mapping turns it into a picture
//   - a physically based sky (js/vendor/Sky.js) lit by the sun from his own clock, with haze that matches
//     it, soft clouds, stars and a moon
//   - image-based lighting from real outdoor HDR photos (assets/hdri), blended for day, sunset and night
//   - a lake with moving waves, sky reflections, a clear shallow edge and a line of foam
//   - textured ground: grass, dirt, rock, sand and snow, chosen from the ground's own colours, so dug
//     holes, the gravel yard, landfill sand and seasonal snow all keep working
//   - a Graphics setting (High / Balanced / Fast) saved on this device, which steps down by itself on
//     slow computers and phones

// --- 1. Colours: treat every colour as sRGB (what a colour picker shows) -------------------------
// three.js r128 treats colours as linear light. With sRGB output that washes everything out, so the
// built-in shaders are patched once here: material colours, vertex colours, emissive colours and colour
// textures are converted from sRGB to linear before lighting. A material can opt out of converting its
// colours (not its textures) with defines: { KELO_LINEAR_COLORS: '' } (glTF models store linear colours).
(function useRealColours() {
      const C = THREE.ShaderChunk;
      C.common += `
vec3 keloTexToLinear( vec3 c ) {
	return mix( c * 0.0773993808, pow( c * 0.9478672986 + 0.0521327014, vec3( 2.4 ) ), step( 0.04045, c ) );
}
vec3 keloToLinear( vec3 c ) {
	#ifdef KELO_LINEAR_COLORS
	return c;
	#else
	return keloTexToLinear( c );
	#endif
}`;
      const swaps = [
        ['vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( keloToLinear( diffuse ), opacity );'],
        ['vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = keloToLinear( emissive );'],
        ['texelColor = mapTexelToLinear( texelColor );', 'texelColor = vec4( keloTexToLinear( texelColor.rgb ), texelColor.a );'],
        ['diffuseColor *= mapTexelToLinear( mapTexel );', 'diffuseColor *= vec4( keloTexToLinear( mapTexel.rgb ), mapTexel.a );'],
        ['emissiveColor.rgb = emissiveMapTexelToLinear( emissiveColor ).rgb;', 'emissiveColor.rgb = keloTexToLinear( emissiveColor.rgb );'],
        ['#ifdef USE_COLOR\n\tvColor *= color;\n#endif', '#ifdef USE_COLOR\n\tvColor *= color;\n\tvColor.rgb = keloToLinear( vColor.rgb );\n#endif'],
        ['vColor.xyz *= instanceColor.xyz;', 'vColor.xyz *= keloToLinear( instanceColor.xyz );']
      ];
      const patch = (s) => swaps.reduce((out, [a, b]) => out.split(a).join(b), s);
      Object.keys(C).forEach(k => { if (k !== 'common' && typeof C[k] === 'string') C[k] = patch(C[k]); });
      Object.values(THREE.ShaderLib).forEach(lib => {
        lib.vertexShader = patch(lib.vertexShader);
        lib.fragmentShader = patch(lib.fragmentShader);
      });
    })();

// --- 2. Graphics quality ------------------------------------------------------------------------
const GRAPHICS_LEVELS = {
  high:     { label: 'High',     pixelRatio: 2,   shadowSize: 4096, shadowRange: 46, softShadows: true,  bloom: true,  terrainDetail: 2, castMin: 0.08, anisotropy: 8, clouds: 22, grassRadius: 17 },
  balanced: { label: 'Balanced', pixelRatio: 1.5, shadowSize: 2048, shadowRange: 40, softShadows: true,  bloom: false, terrainDetail: 1, castMin: 0.15, anisotropy: 4, clouds: 16, grassRadius: 11 },
  fast:     { label: 'Fast',     pixelRatio: 1,   shadowSize: 1024, shadowRange: 32, softShadows: false, bloom: false, terrainDetail: 0, castMin: 0.4,  anisotropy: 1, clouds: 9, grassRadius: 0 }
};
const GRAPHICS_KEY = 'kelo-graphics';
let graphicsLevel = 'balanced';
let graphicsChosen = false; // true once the visitor picked a level (then it never changes by itself)

function readGraphicsChoice() {
      try {
        const saved = localStorage.getItem(GRAPHICS_KEY);
        if (saved && GRAPHICS_LEVELS[saved]) { graphicsChosen = true; return saved; }
        const auto = localStorage.getItem(GRAPHICS_KEY + '-auto');
        if (auto && GRAPHICS_LEVELS[auto]) return auto;
      } catch (e) {}
      // Phones and tablets start on Fast; computers on Balanced
      const phone = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (window.matchMedia && matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820);
      return phone ? 'fast' : 'balanced';
    }

function graphics() {
      return GRAPHICS_LEVELS[graphicsLevel];
    }

// Switch level now. `byVisitor` saves it as their choice; otherwise it's remembered as an automatic pick.
function setGraphicsLevel(level, byVisitor) {
      if (!GRAPHICS_LEVELS[level]) return;
      graphicsLevel = level;
      if (byVisitor) graphicsChosen = true;
      try { localStorage.setItem(byVisitor ? GRAPHICS_KEY : GRAPHICS_KEY + '-auto', level); } catch (e) {}
      applyGraphicsLevel();
      const sel = document.getElementById('graphicsLevelSelect');
      if (sel) sel.value = level;
    }

function applyGraphicsLevel() {
      if (!renderer) return;
      const q = graphics();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
      renderer.shadowMap.type = q.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
      if (sunLight) {
        sunLight.shadow.mapSize.set(q.shadowSize, q.shadowSize);
        if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; }
        const cam = sunLight.shadow.camera;
        cam.left = cam.bottom = -q.shadowRange;
        cam.right = cam.top = q.shadowRange;
        cam.updateProjectionMatrix();
        sunLight.shadow.radius = q.softShadows ? 2 : 1;
      }
      if (terrainGroundMesh && terrainGroundMesh.material.userData.keloTerrain) {
        terrainGroundMesh.material.defines.KELO_DETAIL = q.terrainDetail;
        terrainGroundMesh.material.needsUpdate = true;
      }
      // A texture still loading gets its upload (with this anisotropy) when its image arrives
      Object.values(TERRAIN_TEXTURES).forEach(t => { if (t) { t.anisotropy = Math.min(q.anisotropy, renderer.capabilities.getMaxAnisotropy()); if (t.image) t.needsUpdate = true; } });
      if (cloudGroup) cloudGroup.children.forEach((c, i) => { c.visible = i < q.clouds; });
      shadowCastersChecked = new WeakSet();
      if (typeof setupPostProcessing === 'function') setupPostProcessing();
      // The renderer's own canvas size stays the same; only its pixel density changed
      const container = renderer.domElement.parentElement;
      if (container) renderer.setSize(container.clientWidth || 800, container.clientHeight || 520);
      if (typeof resizePostProcessing === 'function') resizePostProcessing();
    }

// --- 3. The renderer --------------------------------------------------------------------------------
let realisticEnvironmentOn = false;
let skyMesh = null, envSkyMesh = null, starField = null, moonSprite = null;
let pmremGenerator = null, envTarget = null, skyEnvTarget = null;
let envScene = null, envSphere = null, skyEnvScene = null;
let shadowCastersChecked = new WeakSet();
const SKY_STATE = {
  sunDir: new THREE.Vector3(0, 1, 0),    // towards the sun
  lightDir: new THREE.Vector3(0, 1, 0),  // towards whatever lights the world (the sun, or the moon at night)
  sinElev: 1,
  day: 1,          // 0 at night, 1 in full daylight
  dusk: 0,         // 1 in the golden hour around sunrise and sunset
  night: 0,        // 1 in full darkness
  envKey: '',
  skyKey: '',
  hour: 12
};

// Called by initDiorama3D right after the renderer is made
function setupRealisticRenderer() {
      graphicsLevel = readGraphicsChoice();
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.62;
      renderer.physicallyCorrectLights = true;
      renderer.shadowMap.enabled = true;
      scene.background = null;
      realisticEnvironmentOn = true;
      pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileCubemapShader();
      pmremGenerator.compileEquirectangularShader();
    }

// Called once the world is built (end of initDiorama3D)
function finishRealisticWorld() {
      scene.add(sunLight.target);
      sunLight.shadow.camera.near = 1;
      sunLight.shadow.camera.far = 320;
      sunLight.shadow.bias = -0.00025;
      sunLight.shadow.normalBias = 0.035;
      applyGraphicsLevel();
      // Sparks and flying grit are round, soft and glowing, not flat squares
      const dot = roundPointTexture();
      [weldingSparks, miningDebrisParticles].forEach(p => {
        if (!p) return;
        p.material.map = dot;
        p.material.transparent = true;
        p.material.depthWrite = false;
        p.material.needsUpdate = true;
      });
      if (miningDebrisParticles) { miningDebrisParticles.material.size = 0.09; miningDebrisParticles.material.color.setHex(0xa89474); }
      loadEnvironmentPhotos();
      watchFrameRate();
      // Things added later (items, vehicles, his builds) get shadows too
      setInterval(updateShadowCasters, 3000);
      setInterval(updateSmallCasters, 400);
      setTimeout(updateShadowCasters, 500);
    }

// A soft round dot for particles
function roundPointTexture() {
      const c = document.createElement('canvas');
      c.width = c.height = 32;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 32, 32);
      return new THREE.CanvasTexture(c);
    }

// Solid things cast shadows; tiny ones (and glass, labels, effects) don't bother
function updateShadowCasters() {
      if (!scene) return;
      const min = graphics().castMin;
      scene.traverse(o => {
        if (!o.isMesh || shadowCastersChecked.has(o)) return;
        shadowCastersChecked.add(o);
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (!m || m.isMeshBasicMaterial || m.isShaderMaterial || (m.transparent && m.opacity < 0.9) || o.userData.noShadow) return;
        if (o === terrainGroundMesh || (o.geometry && o.geometry.parameters && o.geometry.parameters.width >= 300)) return;
        o.receiveShadow = true;
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        const s = o.geometry.boundingSphere ? o.geometry.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z) : 0;
        if (s >= min) o.castShadow = true;
        // Small casters (cups, tools, fingers, flowers...) only matter where the camera is looking
        if (o.castShadow && o.geometry.boundingSphere && o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() < SMALL_CASTER_SIZE) smallCasters.add(o);
      });
    }

// Half the frame's draw calls are the shadow pass, and a fifth of the casters are small things whose
// shadows are a few texels anywhere but close up. They cast only near where the camera looks.
const SMALL_CASTER_SIZE = 0.3, SMALL_CASTER_NEAR = 14;
const smallCasters = new Set();
function updateSmallCasters() {
      if (!scene || typeof controls === 'undefined' || !controls) return;
      const t = controls.target, near2 = SMALL_CASTER_NEAR * SMALL_CASTER_NEAR;
      smallCasters.forEach(o => {
        let root = o;
        while (root.parent) root = root.parent;
        if (root !== scene) { smallCasters.delete(o); return; } // gone from the world
        const e = o.matrixWorld.elements, dx = e[12] - t.x, dz = e[14] - t.z;
        o.castShadow = dx * dx + dz * dz < near2;
      });
    }

// --- 4. Sky, sun and moon -------------------------------------------------------------------------
// Kelowna is at 49.9° north. The sun's height and direction come from the real formulas for that
// latitude, using his own hour and day of the year: high summer noons, low winter days.
const KELOWNA_LAT = 49.9 * Math.PI / 180;
const MOON_DIR = new THREE.Vector3(0.42, 0.62, 0.66).normalize();

function sunDirection(hour, dayOfYear, out) {
      const decl = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (dayOfYear - 81) / 365);
      const h = (hour - 13) * 15 * Math.PI / 180; // solar noon around 1 pm (daylight time)
      const sinElev = Math.sin(KELOWNA_LAT) * Math.sin(decl) + Math.cos(KELOWNA_LAT) * Math.cos(decl) * Math.cos(h);
      const elev = Math.asin(Math.max(-1, Math.min(1, sinElev)));
      let cosAz = (Math.sin(decl) - sinElev * Math.sin(KELOWNA_LAT)) / (Math.max(1e-4, Math.cos(elev)) * Math.cos(KELOWNA_LAT));
      let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
      if (h > 0) az = 2 * Math.PI - az; // afternoon: the west side
      // North is -z (the mountains), east is +x, south is +z (the lake)
      return out.set(Math.cos(elev) * Math.sin(az), sinElev, -Math.cos(elev) * Math.cos(az));
    }

function buildRealisticSky() {
      skyMesh = new THREE.Sky();
      skyMesh.scale.setScalar(800);
      const u = skyMesh.material.uniforms;
      u.skyGain = { value: 1 };
      u.skyTint = { value: new THREE.Color(0, 0, 0) };
      u.skyGrey = { value: 0 };
      // A gain to balance the sky against the lit ground, and a faint blue for starlit nights
      skyMesh.material.fragmentShader = skyMesh.material.fragmentShader
        .replace('uniform vec3 up;', 'uniform vec3 up;\n\t\tuniform float skyGain;\n\t\tuniform vec3 skyTint;\n\t\tuniform float skyGrey;')
        // Overcast (rain, falling snow): the blue drains to a soft grey of about the same brightness
        .replace('gl_FragColor = vec4( retColor, 1.0 );', 'vec3 keloSky = retColor * skyGain;\n\t\tkeloSky = mix( keloSky, vec3( dot( keloSky, vec3( 0.3, 0.59, 0.11 ) ) * 0.92 ), skyGrey );\n\t\tgl_FragColor = vec4( keloSky + skyTint * ( 1.0 - 0.7 * max( direction.y, 0.0 ) ), 1.0 );');
      skyMesh.material.fog = false;
      skyMesh.renderOrder = -10;
      skyMesh.frustumCulled = false;
      scene.add(skyMesh);
      // The same sky in its own little scene: the lake reflects it
      envSkyMesh = new THREE.Sky();
      envSkyMesh.material.uniforms = u;
      envSkyMesh.material.fragmentShader = skyMesh.material.fragmentShader;
      envSkyMesh.scale.setScalar(100);
      skyEnvScene = new THREE.Scene();
      skyEnvScene.add(envSkyMesh);

      // Stars: fixed points far away, only seen in the dark
      const starCount = 1800, pts = new Float32Array(starCount * 3), cols = new Float32Array(starCount * 3);
      const rng = makeRng('kelo1-stars');
      for (let i = 0; i < starCount; i++) {
        const y = 0.04 + rng() * 0.96, a = rng() * Math.PI * 2, r = Math.sqrt(1 - y * y);
        pts.set([Math.cos(a) * r * 600, y * 600, Math.sin(a) * r * 600], i * 3);
        const b = 0.35 + Math.pow(rng(), 3) * 0.65, warm = rng();
        cols.set([b * (warm > 0.7 ? 1 : 0.85), b * 0.9, b * (warm < 0.3 ? 1 : 0.85)], i * 3);
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      sg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      starField = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false }));
      starField.frustumCulled = false;
      starField.renderOrder = -9;
      scene.add(starField);

      // The moon: a soft halo, a disc darkening toward its rim, grey seas and a few small craters
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const ctx = c.getContext('2d');
      const glow = ctx.createRadialGradient(128, 128, 40, 128, 128, 128);
      glow.addColorStop(0, 'rgba(210,222,255,0.32)');
      glow.addColorStop(0.45, 'rgba(210,222,255,0.08)');
      glow.addColorStop(1, 'rgba(210,222,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 256, 256);
      const disc = ctx.createRadialGradient(120, 120, 6, 128, 128, 48);
      disc.addColorStop(0, '#f4f5f2');
      disc.addColorStop(0.75, '#e2e4e2');
      disc.addColorStop(1, '#b9bcc0');
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.arc(128, 128, 48, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(128, 128, 47, 0, Math.PI * 2);
      ctx.clip();
      const mrng = makeRng('kelo1-moon');
      [[112, 110, 15], [140, 118, 11], [124, 146, 13], [150, 146, 7], [104, 134, 8], [134, 98, 6]].forEach(([x, y, r]) => {
        const g2 = ctx.createRadialGradient(x, y, 0, x, y, r);
        g2.addColorStop(0, 'rgba(128,134,148,0.6)');
        g2.addColorStop(1, 'rgba(128,134,148,0)');
        ctx.fillStyle = g2;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      });
      for (let i = 0; i < 14; i++) {
        const x = 90 + mrng() * 76, y = 90 + mrng() * 76, r = 1 + mrng() * 2.6;
        ctx.fillStyle = 'rgba(120,124,134,0.5)';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      const moonTex = new THREE.CanvasTexture(c);
      moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false }));
      moonSprite.scale.setScalar(60);
      moonSprite.renderOrder = -8;
      scene.add(moonSprite);
    }

// Equirectangular HDR photos mixed together, rendered into an environment for lighting and reflections
const ENV_PHOTOS = { day: 'assets/hdri/quarry_01_1k.hdr', dusk: 'assets/hdri/venice_sunset_1k.hdr', night: 'assets/hdri/moonless_golf_1k.hdr' };
const envPhotoTextures = { day: null, dusk: null, night: null };

function loadEnvironmentPhotos() {
      if (!THREE.RGBELoader) return;
      const loader = new THREE.RGBELoader().setDataType(THREE.UnsignedByteType);
      Object.entries(ENV_PHOTOS).forEach(([key, url]) => {
        loader.load(url, tex => {
          envPhotoTextures[key] = tex;
          // Once all three are in, rebuild the lighting with them
          if (Object.values(envPhotoTextures).every(Boolean)) { SKY_STATE.envKey = ''; updateEnvironment(); }
        }, undefined, () => { /* the sky alone still lights the world */ });
      });
    }

function buildEnvScene() {
      envScene = new THREE.Scene();
      const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 128]), 1, 1);
      blank.needsUpdate = true;
      envSphere = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          dayMap: { value: blank }, duskMap: { value: blank }, nightMap: { value: blank },
          weights: { value: new THREE.Vector3(1, 0, 0) },
          gains: { value: new THREE.Vector3(1, 1, 1) },
          spin: { value: 0 }
        },
        vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `
          #include <common>
          uniform sampler2D dayMap; uniform sampler2D duskMap; uniform sampler2D nightMap;
          uniform vec3 weights; uniform vec3 gains; uniform float spin;
          varying vec3 vDir;
          vec3 rgbe( vec4 t ) { return t.rgb * exp2( t.a * 255.0 - 128.0 ); }
          void main() {
            vec3 d = normalize( vDir );
            vec2 uv = vec2( atan( d.z, d.x ) * RECIPROCAL_PI2 + 0.5 + spin, asin( clamp( d.y, -1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5 );
            vec3 c = rgbe( texture2D( dayMap, uv ) ) * weights.x * gains.x
                   + rgbe( texture2D( duskMap, uv ) ) * weights.y * gains.y
                   + rgbe( texture2D( nightMap, uv ) ) * weights.z * gains.z;
            gl_FragColor = linearToOutputTexel( vec4( min( c, vec3( 60.0 ) ), 1.0 ) );
          }`
      }));
      envScene.add(envSphere);
    }

// Re-render the lighting environment when the light has changed enough to notice
function updateEnvironment() {
      if (!pmremGenerator || !skyEnvScene) return;
      const s = SKY_STATE;
      const key = [s.day, s.dusk, s.night, s.sinElev].map(v => Math.round(v * 30)).join(',') + ',' + Math.round((s.overcast || 0) * 4) + '|' + Object.values(envPhotoTextures).every(Boolean);
      if (key === s.envKey) return;
      s.envKey = key;
      // The sky alone, for the lake's reflections (only when the light itself has changed)
      const skyKey = key.split('|')[0];
      if (skyKey !== s.skyKey || !skyEnvTarget) {
        s.skyKey = skyKey;
        const oldSky = skyEnvTarget;
        skyEnvTarget = pmremGenerator.fromScene(skyEnvScene, 0, 0.1, 200);
        if (oldSky) oldSky.dispose();
        if (seaMaterial) seaMaterial.envMap = skyEnvTarget.texture;
      }
      // The photos (blended) for everything else; until they load, the sky does the job
      const havePhotos = envPhotoTextures.day && envPhotoTextures.dusk && envPhotoTextures.night;
      if (havePhotos) {
        if (!envScene) buildEnvScene();
        const u = envSphere.material.uniforms;
        u.dayMap.value = envPhotoTextures.day;
        u.duskMap.value = envPhotoTextures.dusk;
        u.nightMap.value = envPhotoTextures.night;
        u.weights.value.set(s.day * (1 - s.dusk), s.dusk, s.night);
        // Measured: the photos' skies average about 1.16 (day), 0.82 (sunset) and 0.28 (night). These
        // gains make the sky light about a fifth of direct sun by day, and starlight dim at night.
        u.gains.value.set(0.55, 0.5, 0.12);
        const old = envTarget;
        envTarget = pmremGenerator.fromScene(envScene, 0, 0.1, 200);
        if (old) old.dispose();
        scene.environment = envTarget.texture;
      } else {
        scene.environment = skyEnvTarget.texture;
      }
    }

// How overcast it looks, 0..1: rain clouds over (js/weather.js), or the soft grey of falling snow in
// winter (js/seasons.js). The sky, haze, clouds, stars and the lake all follow it.
function skyOvercast() {
      const rain = typeof rainShown !== 'undefined' ? rainShown : 0;
      const snow = typeof snowfall !== 'undefined' && snowfall && snowfall.visible ? 0.4 : 0;
      return Math.max(rain, snow);
    }

// Light and sky for an hour of the day (used by the world clock, and by the fixed lighting presets)
function applySkyForHour(hour, dayOfYear) {
      if (!scene || !sunLight) return;
      if (!skyMesh) buildRealisticSky();
      const s = SKY_STATE;
      s.hour = hour;
      sunDirection(hour, dayOfYear, s.sunDir);
      s.sinElev = s.sunDir.y;
      const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
      s.day = sm(-0.06, 0.2, s.sinElev);
      s.dusk = sm(-0.12, 0.0, s.sinElev) * (1 - sm(0.08, 0.3, s.sinElev));
      s.night = 1 - sm(-0.2, -0.02, s.sinElev);

      // Sky shader: clearer air at noon, more haze and colour when the sun is low
      const u = skyMesh.material.uniforms;
      u.sunPosition.value.copy(s.sunDir);
      u.turbidity.value = 2.2 + 3.5 * s.dusk;
      u.rayleigh.value = 2.2 + 1.0 * s.dusk;
      u.mieCoefficient.value = 0.003 + 0.004 * s.dusk;
      u.mieDirectionalG.value = 0.82;
      u.skyGain.value = 0.75; // keeps the sky blue overhead instead of washing out to white
      u.skyTint.value.setRGB(0.004, 0.007, 0.018).multiplyScalar(s.night);
      s.overcast = skyOvercast();
      u.skyGrey.value = 0.85 * s.overcast;

      // The sun by day; the moon (cool and dim) at night. One light does both, so shadows always work.
      const sunUp = sm(-0.03, 0.05, s.sinElev);
      if (sunUp > 0.01) {
        s.lightDir.copy(s.sunDir);
        s.lightDir.y = Math.max(0.05, s.lightDir.y);
        s.lightDir.normalize();
        // Low sun shines through more air: warmer and weaker
        const high = sm(0.0, 0.5, s.sinElev);
        sunLight.color.setRGB(1.0, 0.62 + 0.34 * high, 0.36 + 0.55 * high);
        sunLight.intensity = 4.6 * sunUp * (0.3 + 0.7 * high);
      } else {
        s.lightDir.copy(MOON_DIR);
        sunLight.color.setRGB(0.55, 0.65, 0.95);
        sunLight.intensity = 0.36 * s.night; // moonlight: enough to read the shapes of the valley
      }
      // Sky light from above and bounce from the grass below (the HDR environment does most of this)
      hemiLight.color.setRGB(0.55, 0.68, 0.9);
      hemiLight.groundColor.setRGB(0.22, 0.2, 0.14);
      hemiLight.intensity = 0.02 + 0.12 * s.day + 0.035 * s.night;
      // Exposure: the eye adapts a little to the dark
      renderer.toneMappingExposure = 0.6 + 0.5 * s.night + 0.1 * s.dusk;

      // Haze: denser in the evening and at night
      scene.fog.density = 0.0042 + 0.0022 * s.dusk + 0.002 * s.night + 0.0045 * s.overcast;

      // Stars and the moon hide behind rain clouds and snow
      if (starField) starField.material.opacity = s.night * (1 - s.overcast);
      if (moonSprite) moonSprite.material.opacity = (0.15 + 0.85 * s.night) * (1 - 0.85 * s.overcast);
      updateCloudLight();
      updateEnvironment();
    }

// How dark it is outside (0 day, 1 night): used for lamps
function skyDarkness() {
      return Math.max(SKY_STATE.night, 1 - SKY_STATE.day);
    }

// --- 5. Haze that matches the sky ------------------------------------------------------------------
// The same sky model as the shader, worked out here for the horizon in the direction the camera looks,
// then tone mapped the same way, so distant hills fade into exactly the sky behind them.
const skyScratch = { r: 0, g: 0, b: 0 };
function skyColourToward(dx, dy, dz, out) {
      const u = skyMesh.material.uniforms, sun = SKY_STATE.sunDir;
      const EE = 1000, cutoff = 1.6110731556870734, steep = 1.5;
      const sunE = EE * Math.max(0, 1 - Math.exp(-((cutoff - Math.acos(Math.max(-1, Math.min(1, sun.y)))) / steep)));
      const rl = u.rayleigh.value;
      const bR = [5.804542996261093E-6 * rl, 1.3562911419845635E-5 * rl, 3.0265902468824876E-5 * rl];
      const cM = 0.2 * u.turbidity.value * 10E-18, mie = u.mieCoefficient.value;
      const bM = [0.434 * cM * 1.8399918514433978E14 * mie, 0.434 * cM * 2.7798023919660528E14 * mie, 0.434 * cM * 4.0790479543861094E14 * mie];
      const zen = Math.acos(Math.max(0, dy));
      const inv = 1 / (Math.cos(zen) + 0.15 * Math.pow(93.885 - zen * 180 / Math.PI, -1.253));
      const sR = 8.4E3 * inv, sM = 1.25E3 * inv;
      const cosT = dx * sun.x + dy * sun.y + dz * sun.z;
      const rPhase = 0.05968310365946075 * (1 + Math.pow(cosT * 0.5 + 0.5, 2));
      const g = u.mieDirectionalG.value, g2 = g * g;
      const mPhase = 0.07957747154594767 * (1 - g2) / Math.pow(1 - 2 * g * cosT + g2, 1.5);
      const low = Math.max(0, Math.min(1, Math.pow(1 - sun.y, 5)));
      const res = [0, 0, 0], add = [0, 0.0003, 0.00075], tint = u.skyTint.value, tints = [tint.r, tint.g, tint.b];
      for (let i = 0; i < 3; i++) {
        const fex = Math.exp(-(bR[i] * sR + bM[i] * sM));
        const ratio = (bR[i] * rPhase + bM[i] * mPhase) / (bR[i] + bM[i]);
        let lin = Math.pow(sunE * ratio * (1 - fex), 1.5);
        lin *= 1 + (Math.pow(sunE * ratio * fex, 0.5) - 1) * low;
        const tex = (lin + 0.1 * fex) * 0.04 + add[i];
        res[i] = Math.pow(tex, 1 / 2.4) * u.skyGain.value;
      }
      // the same overcast grey as the sky shader
      const grey = u.skyGrey ? u.skyGrey.value : 0, lum = (res[0] * 0.3 + res[1] * 0.59 + res[2] * 0.11) * 0.92;
      for (let i = 0; i < 3; i++) res[i] = res[i] + (lum - res[i]) * grey + tints[i] * (1 - 0.7 * Math.max(dy, 0));
      // ACES filmic, as three.js r128 does it, then sRGB
      const e = renderer.toneMappingExposure / 0.6;
      const r = res[0] * e, gg = res[1] * e, b = res[2] * e;
      const ir = 0.59719 * r + 0.35458 * gg + 0.04823 * b, ig = 0.07600 * r + 0.90834 * gg + 0.01566 * b, ib = 0.02840 * r + 0.13383 * gg + 0.83777 * b;
      const fit = v => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081);
      const fr = fit(ir), fg = fit(ig), fb = fit(ib);
      const or = 1.60475 * fr - 0.53108 * fg - 0.07367 * fb, og = -0.10208 * fr + 1.10813 * fg - 0.00605 * fb, ob = -0.00327 * fr - 0.07276 * fg + 1.07602 * fb;
      const enc = v => { v = Math.max(0, Math.min(1, v)); return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; };
      out.r = enc(or); out.g = enc(og); out.b = enc(ob);
      return out;
    }

// --- 6. Soft clouds ---------------------------------------------------------------------------------
// Each cloud is a cluster of soft, noisy puffs (sprites) with lit tops and shaded bottoms
let cloudTopMat = null, cloudBaseMat = null;
const CLOUD_WHITE = new THREE.Color(1, 1, 1), CLOUD_SHADE = new THREE.Color(0.62, 0.68, 0.78);

function cloudPuffTexture() {
      const size = 128, c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      const rng = makeRng('kelo1-cloud-puff');
      // Many overlapping soft blobs make a billowy edge instead of a perfect circle
      for (let i = 0; i < 70; i++) {
        const a = rng() * Math.PI * 2, d = Math.pow(rng(), 0.7) * 34;
        const x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d * 0.8, r = 10 + rng() * 22;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.22)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      const tex = new THREE.CanvasTexture(c);
      return tex;
    }

function buildRealisticClouds() {
      cloudGroup = new THREE.Group();
      const tex = cloudPuffTexture();
      cloudTopMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.95 });
      cloudBaseMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.9 });
      const rng = makeRng('kelo1-clouds');
      for (let i = 0; i < 22; i++) {
        const cloud = new THREE.Group();
        const w = 14 + rng() * 22, puffs = 9 + Math.floor(rng() * 8);
        for (let k = 0; k < puffs; k++) {
          const t = k / puffs;
          const x = (rng() - 0.5) * w, z = (rng() - 0.5) * w * 0.5;
          // Taller in the middle, flat along the bottom
          const middle = 1 - Math.abs(x) / (w * 0.6);
          const y = rng() * 4 * Math.max(0.2, middle);
          const top = y > 1.4 || t > 0.6;
          const puff = new THREE.Sprite(top ? cloudTopMat : cloudBaseMat);
          const s = (7 + rng() * 9) * (0.6 + 0.5 * middle);
          puff.scale.set(s * 1.25, s, 1);
          puff.position.set(x, y, z);
          puff.userData.noShadow = true;
          cloud.add(puff);
        }
        cloud.position.set((rng() - 0.5) * 160, 38 + rng() * 16, -70 + rng() * 90);
        cloud.userData.speed = 0.4 + rng() * 0.6;
        cloudGroup.add(cloud);
      }
      scene.add(cloudGroup);
    }

// Clouds take the colour of the light: white at noon, peach at sunset, dark grey-blue at night (eased
// through dusk, never switched), and heavier and greyer when it is overcast
const CLOUD_NIGHT_TOP = new THREE.Color(0.16, 0.18, 0.24), CLOUD_NIGHT_BASE = new THREE.Color(0.1, 0.11, 0.15);
const CLOUD_RAIN = new THREE.Color(0.52, 0.56, 0.62);
function updateCloudLight() {
      if (!cloudTopMat || !sunLight) return;
      const s = SKY_STATE, oc = s.overcast || 0;
      const sun = sunLight.color;
      const lit = 0.35 + 0.75 * s.day;
      cloudTopMat.color.setRGB(Math.min(1, sun.r * lit + 0.08), Math.min(1, sun.g * lit + 0.1), Math.min(1, sun.b * lit + 0.14));
      cloudTopMat.color.lerp(CLOUD_WHITE, 0.35 * s.day * (1 - s.dusk));
      cloudTopMat.color.lerp(CLOUD_RAIN, 0.7 * oc * s.day);
      // Undersides take the blue-grey of the sky around them
      cloudBaseMat.color.copy(cloudTopMat.color).multiplyScalar(0.78 - 0.12 * oc).lerp(CLOUD_SHADE, 0.45 * s.day * (1 - oc));
      const n = Math.max(0, Math.min(1, (s.night - 0.3) / 0.5));
      cloudTopMat.color.lerp(CLOUD_NIGHT_TOP, n);
      cloudBaseMat.color.lerp(CLOUD_NIGHT_BASE, n);
      cloudTopMat.opacity = Math.min(1, 0.95 - 0.35 * s.night + 0.05 * oc);
      cloudBaseMat.opacity = Math.min(1, 0.9 - 0.35 * s.night + 0.1 * oc);
    }

// --- 7. Every frame ---------------------------------------------------------------------------------
const fogScratch = new THREE.Color();
const NIGHT_FOG = new THREE.Color(0x0d1422);
const camForward = new THREE.Vector3();
let frameCounter = 0;

function updateRealism(t, dt) {
      if (!skyMesh) return;
      frameCounter++;
      const cp = camera.position;
      skyMesh.position.copy(cp);
      if (starField) starField.position.copy(cp);
      if (moonSprite) moonSprite.position.copy(cp).addScaledVector(MOON_DIR, 580);
      // Haze colour from the sky straight ahead (every few frames is plenty)
      if (frameCounter % 4 === 1) {
        camera.getWorldDirection(camForward);
        camForward.y = 0;
        if (camForward.lengthSq() < 1e-6) camForward.set(0, 0, -1);
        camForward.normalize();
        skyColourToward(camForward.x * 0.995, 0.1, camForward.z * 0.995, skyScratch);
        fogScratch.setRGB(skyScratch.r, skyScratch.g, skyScratch.b);
        // With post-processing the haze is mixed before the final sRGB step
        // After dark the haze is a deep night blue, not the sky model's leftover glow
        if (SKY_STATE.night > 0) fogScratch.lerp(NIGHT_FOG, SKY_STATE.night);
        if (postComposer) fogScratch.convertSRGBToLinear();
        scene.fog.color.copy(fogScratch);
      }
      // Shadows follow what the camera looks at, snapped to whole shadow-map texels so they don't crawl.
      // The shadow box fits the view: close up it shrinks (crisp shadows), zoomed out it covers the
      // level's full range. It changes in steps, so the texels don't swim while the camera eases.
      const q = graphics();
      const range = shadowRangeFor(q, camera.position.distanceTo(controls.target));
      const scam = sunLight.shadow.camera;
      if (scam.right !== range) {
        scam.left = scam.bottom = -range;
        scam.right = scam.top = range;
        scam.updateProjectionMatrix();
        // Bias in texels: the same acne protection at every size
        sunLight.shadow.normalBias = 0.035 * range / 40;
      }
      const snap = (range * 2) / q.shadowSize;
      // Centred a little beyond the target, where more of the visible ground is (camForward is the
      // flat view direction worked out above every few frames)
      const ahead = range < q.shadowRange ? range * 0.3 : 0;
      const tx = Math.round((controls.target.x + camForward.x * ahead) / snap) * snap, tz = Math.round((controls.target.z + camForward.z * ahead) / snap) * snap;
      sunLight.target.position.set(tx, 0, tz);
      sunLight.position.set(tx, 0, tz).addScaledVector(SKY_STATE.lightDir, 150);
      updateGrassTufts();
      if (typeof updateRealisticWater === 'function') updateRealisticWater(t);
      if (typeof updateWeldingStudio === 'function') updateWeldingStudio(t);
      trackFrameRate(dt);
    }

// Half-width of the sun's shadow box for a camera this far from what it looks at (steps of 6 units)
function shadowRangeFor(q, dist) {
      const want = Math.max(24, Math.min(q.shadowRange, dist * 0.95 + 10));
      return want >= q.shadowRange ? q.shadowRange : Math.ceil(want / 6) * 6;
    }

// --- 8. Watching the frame rate: step down on slow computers -------------------------------------
const fpsWatch = { frames: 0, time: 0, startAt: 0, checks: 0 };
function watchFrameRate() {
      fpsWatch.startAt = performance.now() + 6000; // let everything settle first
    }

function trackFrameRate(dt) {
      // The one frame-rate watcher: Graphics steps down first, then Performance (Auto) goes to Low (js/perf.js)
      const perfCan = typeof perfCanAutoStep === 'function' && perfCanAutoStep();
      if ((graphicsChosen && !perfCan) || !fpsWatch.startAt || performance.now() < fpsWatch.startAt || document.hidden) return;
      fpsWatch.frames++;
      fpsWatch.time += dt;
      if (fpsWatch.time < 8) return;
      const fps = fpsWatch.frames / fpsWatch.time;
      fpsWatch.frames = 0;
      fpsWatch.time = 0;
      fpsWatch.checks++;
      if (fps < 32 && !graphicsChosen && graphicsLevel !== 'fast') {
        setGraphicsLevel(graphicsLevel === 'high' ? 'balanced' : 'fast', false);
        if (typeof showToast === 'function') showToast(`🖥️ Graphics set to ${graphics().label} to keep things smooth`);
        fpsWatch.startAt = performance.now() + 4000;
      } else if (fps < 32 && perfCan && perfAutoStepDown()) {
        if (typeof showToast === 'function') showToast('🖥️ Drawing less of the far valley to keep things smooth');
        fpsWatch.startAt = performance.now() + 4000;
      } else if (fpsWatch.checks >= 3 || fps < 32) {
        fpsWatch.startAt = 0; // it runs fine: stop watching
      }
    }

// --- 9. Settings: the Graphics picker --------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  const sel = document.getElementById('graphicsLevelSelect');
  if (!sel) return;
  sel.value = graphicsLevel = readGraphicsChoice();
  sel.addEventListener('change', () => {
    setGraphicsLevel(sel.value, true);
    if (typeof showToast === 'function') showToast(`🖥️ Graphics: ${graphics().label}`);
  });
});

// --- 10. The lake ------------------------------------------------------------------------------------
// One flat sheet at the water line (WATER_LEVEL, -0.18), as before, so boats, wading and landfill are
// unchanged. Its look: three layers of moving ripples (assets/textures/waternormals.jpg), reflections of
// the real sky, see-through shallows over the sand, deep blue-green further out, and foam at the edge.
// How deep the water is comes from a small depth map baked from the lake bed.
let seaMaterial = null, seaDepthTexture = null, seaDepthSig = '';
const SEA_DEPTH_BOX = { x: -100, z: 6, w: 200, d: 36, cols: 320, rows: 96 };

function makeRealisticWaterMaterial() {
      const loader = new THREE.TextureLoader();
      const normals = loader.load('assets/textures/waternormals.jpg');
      normals.wrapS = normals.wrapT = THREE.RepeatWrapping;
      seaDepthTexture = new THREE.DataTexture(new Uint8Array(SEA_DEPTH_BOX.cols * SEA_DEPTH_BOX.rows * 4), SEA_DEPTH_BOX.cols, SEA_DEPTH_BOX.rows, THREE.RGBAFormat);
      seaDepthTexture.magFilter = seaDepthTexture.minFilter = THREE.LinearFilter;
      bakeSeaDepth();
      const mat = new THREE.MeshStandardMaterial({ color: 0x0e3b48, roughness: 0.05, metalness: 0, transparent: true, envMapIntensity: 1.0 });
      const uniforms = {
        waterNormals: { value: normals },
        depthMap: { value: seaDepthTexture },
        depthBox: { value: new THREE.Vector4(SEA_DEPTH_BOX.x, SEA_DEPTH_BOX.z, SEA_DEPTH_BOX.w, SEA_DEPTH_BOX.d) },
        shallowColor: { value: new THREE.Color(0x5f9c94) },
        deepColor: { value: new THREE.Color(0x06222c) },
        waterTime: { value: 0 },
        waterRain: { value: 0 }
      };
      mat.userData.uniforms = uniforms;
      mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = 'varying vec3 vKeloW;\n' + shader.vertexShader.replace('#include <project_vertex>',
          '#include <project_vertex>\n\tvKeloW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
        shader.fragmentShader = `varying vec3 vKeloW;
uniform sampler2D waterNormals; uniform sampler2D depthMap; uniform vec4 depthBox;
uniform vec3 shallowColor; uniform vec3 deepColor; uniform float waterTime; uniform float waterRain;
` + shader.fragmentShader
          .replace('#include <color_fragment>', `#include <color_fragment>
	vec2 keloDuv = ( vKeloW.xz - depthBox.xy ) / depthBox.zw;
	float keloInside = step( 0.0, keloDuv.x ) * step( keloDuv.x, 1.0 ) * step( 0.0, keloDuv.y ) * step( keloDuv.y, 1.0 );
	float keloDepth = mix( 8.0, texture2D( depthMap, clamp( keloDuv, 0.0, 1.0 ) ).r * 8.0, keloInside );
	float keloShallow = 1.0 - smoothstep( 0.0, 1.6, keloDepth );
	diffuseColor.rgb = mix( diffuseColor.rgb, keloToLinear( shallowColor ), keloShallow );
	// darker with depth, out past the shelf
	diffuseColor.rgb = mix( diffuseColor.rgb, keloToLinear( deepColor ), 0.7 * smoothstep( 2.0, 7.5, keloDepth ) );
	float keloRipple = texture2D( waterNormals, vKeloW.xz * 0.21 + vec2( waterTime * 0.021, - waterTime * 0.017 ) ).g;
	float keloFoam = ( 1.0 - smoothstep( 0.0, 0.08 + 0.06 * keloRipple, keloDepth ) ) * smoothstep( 0.5, 0.7, keloRipple + 0.2 * sin( waterTime * 0.9 + vKeloW.x * 0.35 ) );
	// a second, fainter line of foam that laps in and out a little way off the beach
	float keloLap = ( 1.0 - smoothstep( 0.06, 0.4, keloDepth ) ) * smoothstep( 0.82, 1.0, sin( keloDepth * 16.0 - waterTime * 1.4 + keloRipple * 2.0 ) ) * smoothstep( 0.35, 0.6, keloRipple );
	keloFoam = max( keloFoam, keloLap * 0.55 );
	diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.8, 0.84, 0.84 ), keloFoam * 0.6 );
	// Fresnel: clear looking down into the shallows, a solid mirror toward the horizon
	float keloGraze = pow( 1.0 - clamp( normalize( cameraPosition - vKeloW ).y, 0.0, 1.0 ), 4.0 );
	diffuseColor.a = clamp( mix( mix( 0.93, 0.32, keloShallow ), 1.0, keloGraze * 0.75 ) + keloFoam * 0.6, 0.0, 1.0 );`)
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = mix( roughnessFactor + 0.16 * waterRain, 0.8, keloFoam );')
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
	vec2 keloW2 = vKeloW.xz;
	vec3 keloN1 = texture2D( waterNormals, keloW2 * 0.035 + vec2( waterTime * 0.010, waterTime * 0.006 ) ).xyz * 2.0 - 1.0;
	vec3 keloN2 = texture2D( waterNormals, keloW2 * 0.09 - vec2( waterTime * 0.014, - waterTime * 0.009 ) ).xyz * 2.0 - 1.0;
	vec3 keloN3 = texture2D( waterNormals, keloW2 * 0.27 + vec2( - waterTime * 0.026, waterTime * 0.022 ) ).xyz * 2.0 - 1.0;
	vec2 keloWave = keloN1.xy + keloN2.xy * 0.6 + keloN3.xy * ( 0.3 + 0.9 * waterRain );
	float keloFar = smoothstep( 30.0, 170.0, length( vKeloW - cameraPosition ) );
	vec3 keloWorldN = normalize( vec3( keloWave.x * 0.16, 1.0, keloWave.y * 0.16 ) );
	keloWorldN = normalize( mix( keloWorldN, vec3( 0.0, 1.0, 0.0 ), keloFar * 0.6 + keloShallow * 0.3 ) );
	normal = normalize( ( viewMatrix * vec4( keloWorldN, 0.0 ) ).xyz );`);
      };
      seaMaterial = mat;
      // The lake bed changes when he tips dirt in (js/landfill.js): re-bake now and then
      setInterval(() => {
        const sig = (state.landFills || []).map(f => `${f.x},${f.z},${Math.round(f.volume || 0)}`).join(';');
        if (sig !== seaDepthSig) bakeSeaDepth();
      }, 4000);
      return mat;
    }

function bakeSeaDepth() {
      if (!seaDepthTexture) return;
      const b = SEA_DEPTH_BOX, data = seaDepthTexture.image.data;
      seaDepthSig = (state.landFills || []).map(f => `${f.x},${f.z},${Math.round(f.volume || 0)}`).join(';');
      for (let j = 0; j < b.rows; j++) {
        const z = b.z + (j + 0.5) / b.rows * b.d;
        for (let i = 0; i < b.cols; i++) {
          const x = b.x + (i + 0.5) / b.cols * b.w;
          const inside = islandContains(x, z);
          const bed = inside ? getAnalyticalGroundHeight(x, z) : outerTerrainHeight(x, z);
          const depth = Math.max(0, Math.min(8, -0.18 - bed));
          data[(j * b.cols + i) * 4] = Math.round(depth / 8 * 255);
        }
      }
      seaDepthTexture.needsUpdate = true;
    }

function updateRealisticWater(t) {
      if (!seaMaterial) return;
      const u = seaMaterial.userData.uniforms;
      u.waterTime.value = t;
      // Rain roughens the surface: choppier small ripples and a duller reflection
      u.waterRain.value = typeof rainShown !== 'undefined' ? rainShown : 0;
    }

// --- 11. The ground ----------------------------------------------------------------------------------
// The terrain keeps its vertex colours (they say what each spot is: meadow, dug dirt, gravel, sand,
// snow). The shader reads that colour, works out which real surface it is, and lays that surface's
// photo texture over it, tinted to the colour. Steep slopes turn rocky. Bumps come from the textures.
const TERRAIN_TEXTURE_FILES = {
  grass: 'assets/textures/terrain/grass.jpg',
  dirt: 'assets/textures/terrain/dirt.jpg',
  rock: 'assets/textures/terrain/rock.jpg',
  sand: 'assets/textures/terrain/sand.jpg',
  snow: 'assets/textures/terrain/snow.jpg'
};
// Average colour of each texture (sRGB), so a texture only adds detail and keeps the ground's own colour
const TERRAIN_TEXTURE_MEANS = { grass: [0.275, 0.344, 0.146], dirt: [0.477, 0.379, 0.28], rock: [0.45, 0.431, 0.396], sand: [0.778, 0.702, 0.546], snow: [0.912, 0.929, 0.953] };
const TERRAIN_TEXTURES = { grass: null, dirt: null, rock: null, sand: null, snow: null };

function makeRealisticTerrainMaterial() {
      const loader = new THREE.TextureLoader();
      const uniforms = {};
      Object.entries(TERRAIN_TEXTURE_FILES).forEach(([k, url]) => {
        const tex = loader.load(url);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        TERRAIN_TEXTURES[k] = tex;
        uniforms[k + 'Map'] = { value: tex };
        const m = TERRAIN_TEXTURE_MEANS[k];
        uniforms[k + 'Mean'] = { value: new THREE.Color(m[0], m[1], m[2]).convertSRGBToLinear() };
      });
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
      mat.defines = { KELO_DETAIL: graphics().terrainDetail };
      mat.extensions = { derivatives: true };
      mat.userData.keloTerrain = true;
      mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = 'varying vec3 vKeloW;\nvarying vec3 vKeloN;\nvarying vec3 vKeloRaw;\n' + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
	vKeloW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
	vKeloN = normalize( mat3( modelMatrix ) * objectNormal );
	vKeloRaw = color.rgb;`);
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vKeloW;
varying vec3 vKeloN;
varying vec3 vKeloRaw;
uniform sampler2D grassMap; uniform sampler2D dirtMap; uniform sampler2D rockMap; uniform sampler2D sandMap; uniform sampler2D snowMap;
uniform vec3 grassMean; uniform vec3 dirtMean; uniform vec3 rockMean; uniform vec3 sandMean; uniform vec3 snowMean;
vec3 keloTex( sampler2D m, vec2 uv ) { return keloTexToLinear( texture2D( m, uv ).rgb ); }
// A texture at two scales (turned against each other), so the repeat doesn't show
vec3 keloTex2( sampler2D m, vec2 uv ) {
	vec3 a = keloTex( m, uv );
	#if KELO_DETAIL > 0
	vec2 uv2 = mat2( 0.8, 0.6, -0.6, 0.8 ) * uv * 0.27 + 0.37;
	a = mix( a, keloTex( m, uv2 ), 0.45 );
	#endif
	return a;
}
vec3 keloBump( vec3 surfPos, vec3 surfNorm, vec2 dHdxy ) {
	vec3 sx = dFdx( surfPos ), sy = dFdy( surfPos );
	vec3 r1 = cross( sy, surfNorm ), r2 = cross( surfNorm, sx );
	float det = dot( sx, r1 );
	vec3 grad = sign( det ) * ( dHdxy.x * r1 + dHdxy.y * r2 );
	return normalize( abs( det ) * surfNorm - grad );
}`)
          .replace('#include <color_fragment>', `#include <color_fragment>
	vec3 kRaw = vKeloRaw;
	float kMax = max( kRaw.r, max( kRaw.g, kRaw.b ) ), kMin = min( kRaw.r, min( kRaw.g, kRaw.b ) );
	float kSat = ( kMax - kMin ) / max( kMax, 0.001 );
	float kLum = dot( kRaw, vec3( 0.3, 0.59, 0.11 ) );
	float kSlope = 1.0 - clamp( normalize( vKeloN ).y, 0.0, 1.0 );
	// Which surface this colour means
	float wSnow = smoothstep( 0.74, 0.88, kLum ) * ( 1.0 - smoothstep( 0.12, 0.3, kSat ) );
	float wGrass = smoothstep( 0.0, 0.08, kRaw.g - max( kRaw.r, kRaw.b ) * 0.95 ) * ( 1.0 - wSnow );
	float wSand = smoothstep( 0.5, 0.64, kLum ) * smoothstep( 0.1, 0.22, kRaw.r - kRaw.b ) * ( 1.0 - wGrass ) * ( 1.0 - wSnow );
	float wDirt = smoothstep( 0.05, 0.14, kRaw.r - kRaw.b ) * ( 1.0 - wSand ) * ( 1.0 - wGrass ) * ( 1.0 - wSnow );
	float wRock = max( 0.0, 1.0 - wSnow - wGrass - wSand - wDirt );
	// Steep grassy ground shows bare rock
	float kCliff = smoothstep( 0.42, 0.7, kSlope ) * wGrass;
	wGrass -= kCliff; wRock += kCliff;
	// Snow doesn't stay on cliff faces: they show bare rock
	float kBare = smoothstep( 0.34, 0.52, kSlope ) * wSnow;
	wSnow -= kBare; wRock += kBare;
	float kSum = wSnow + wGrass + wSand + wDirt + wRock;
	vec2 kUv = vKeloW.xz;
	vec3 kDetail = vec3( 0.0 );
	float kHeight = 0.0;
	vec3 t;
	// (every layer is always sampled: skipping some in branches makes seams between them)
	kDetail += keloTex2( grassMap, kUv * 0.21 ) / grassMean * wGrass;
	kDetail += keloTex2( dirtMap, kUv * 0.24 ) / dirtMean * wDirt;
	kDetail += keloTex2( sandMap, kUv * 0.3 ) / sandMean * wSand;
	kDetail += keloTex2( snowMap, kUv * 0.16 ) / snowMean * wSnow;
	// Rock wraps cliffs from three sides so it never smears down a slope
	vec3 bw = pow( abs( normalize( vKeloN ) ), vec3( 4.0 ) ); bw /= ( bw.x + bw.y + bw.z );
	t = ( keloTex( rockMap, vKeloW.zy * 0.12 ) * bw.x + keloTex2( rockMap, vKeloW.xz * 0.12 ) * bw.y + keloTex( rockMap, vKeloW.xy * 0.12 ) * bw.z ) / rockMean;
	kDetail += t * wRock;
	kDetail = clamp( kDetail / max( kSum, 0.001 ), 0.25, 2.2 );
	// Cliffs take on the colour of rock
	diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.16, 0.15, 0.135 ), min( 1.0, kCliff * 0.85 + kBare * 0.9 ) );
	diffuseColor.rgb *= kDetail;
	kHeight = dot( kDetail, vec3( 0.3, 0.59, 0.11 ) );
	// Wide patches of lighter and darker ground, as real meadows have
	float kMacro = keloTex( grassMap, kUv * 0.013 ).g / grassMean.g;
	diffuseColor.rgb *= mix( 1.0, clamp( kMacro, 0.75, 1.25 ), 0.6 );
	float kRough = ( wGrass * 0.92 + wDirt * 0.96 + wSand * 0.88 + wSnow * 0.55 + wRock * 0.8 ) / max( kSum, 0.001 );`)
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = kRough;')
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
	#if KELO_DETAIL > 1
	normal = keloBump( - vViewPosition, normal, vec2( dFdx( kHeight ), dFdy( kHeight ) ) * ( 0.06 - 0.04 * wSnow ) );
	#endif`);
      };
      return mat;
    }

// The fixed looks from the World tab's lighting button: noon, the golden hour, and night
function applySkyPreset(idx) {
      const doy = typeof worldNow === 'function' ? worldNow().dayOfYear : 200;
      let hour = 12.5;
      if (idx === 2) hour = 1;
      else if (idx === 1) {
        // The evening moment the sun is about four degrees up
        const v = new THREE.Vector3();
        for (hour = 13; hour < 23; hour += 0.05) if (sunDirection(hour, doy, v).y < 0.07) break;
      }
      applySkyForHour(hour, doy);
    }

// --- 12. Post-processing (High only): a soft glow around bright lights -----------------------------
// The scene is drawn into an off-screen picture (already tone mapped, still linear), bloom is added,
// and a last pass turns it into sRGB for the screen. On Balanced and Fast it's drawn straight out.
let postComposer = null, bloomPass = null;
const postSize = new THREE.Vector2();
const SRGB_OUT_SHADER = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() {
      vec4 c = texture2D( tDiffuse, vUv );
      vec3 s = mix( c.rgb * 12.92, 1.055 * pow( max( c.rgb, vec3( 0.0 ) ), vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c.rgb ) );
      gl_FragColor = vec4( s, 1.0 );
    }`
};

function setupPostProcessing() {
      if (postComposer) {
        postComposer.renderTarget1.dispose();
        postComposer.renderTarget2.dispose();
        if (bloomPass) bloomPass.dispose();
        postComposer = bloomPass = null;
      }
      if (!renderer || !graphics().bloom || !THREE.EffectComposer || !THREE.UnrealBloomPass) return;
      renderer.getDrawingBufferSize(postSize);
      const opts = { format: THREE.RGBAFormat, type: renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType };
      const target = renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget
        ? new THREE.WebGLMultisampleRenderTarget(postSize.x, postSize.y, opts)
        : new THREE.WebGLRenderTarget(postSize.x, postSize.y, opts);
      postComposer = new THREE.EffectComposer(renderer, target);
      postComposer.addPass(new THREE.RenderPass(scene, camera));
      bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(postSize.x / 2, postSize.y / 2), 0.22, 0.55, 0.88);
      postComposer.addPass(bloomPass);
      postComposer.addPass(new THREE.ShaderPass(SRGB_OUT_SHADER));
      resizePostProcessing();
    }

function resizePostProcessing() {
      if (!postComposer) return;
      const container = renderer.domElement.parentElement;
      postComposer.setPixelRatio(renderer.getPixelRatio());
      postComposer.setSize(container ? container.clientWidth : 800, container ? container.clientHeight : 520);
    }

function renderWorld() {
      if (postComposer) postComposer.render();
      else renderer.render(scene, camera);
    }

// --- 13. Trees that look like trees ------------------------------------------------------------------
// Douglas firs: a straight trunk and ragged, drooping tiers of needles. Broadleaf trees: a trunk that
// forks into branches and a crown of lumpy leaf clumps. Shared materials, so the seasons can turn them.
let treeMats = null;

function naturalTreeMaterials() {
      if (treeMats) return treeMats;
      const tex = (k) => (typeof finishTexture === 'function' ? finishTexture(k) : null);
      const bark = new THREE.MeshStandardMaterial({ color: 0x5b4a3a, roughness: 0.95 });
      const firBark = new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 0.95 });
      [bark, firBark].forEach(m => { const t = tex('bark'); if (t) { m.map = t; m.bumpMap = t; m.bumpScale = 0.05; } });
      const leafTex = tex('leaf');
      const leaves = [0x4a6b2a, 0x56782f, 0x3f5f27, 0x67792f, 0x4d6e35, 0x5c7a2c].map((c, i) => {
        const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.82 });
        if (leafTex) { m.map = leafTex; m.bumpMap = leafTex; m.bumpScale = 0.04; }
        m.userData.seasonal = 'leaf'; // js/seasons.js turns it with the seasons
        m.userData.autumn = [0xd9a33a, 0xc8642a, 0xa8432a, 0xe0b84a, 0xcf8a2e, 0xb85a28][i];
        return m;
      });
      const needles = [0x2b4426, 0x304a2a, 0x263d22, 0x37502e].map(c => {
        const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.88 });
        if (leafTex) { m.map = leafTex; m.bumpMap = leafTex; m.bumpScale = 0.05; }
        m.userData.seasonal = 'needle'; // frosted in winter
        m.onBeforeCompile = foliageSwayShader; // the boughs sway in the wind, on the GPU
        return m;
      });
      treeMats = { bark, firBark, leaves, needles };
      return treeMats;
    }

// Wind in the firs, done in the vertex shader so it costs no JavaScript per tree. Each fir's needle
// geometry carries `keloSway` (0 at the foot, 1 at the tip, squared); js/wind.js sets the uniforms
// from the wind it shows. Geometry without the attribute reads 0 and stays still.
const FOLIAGE_WIND = { keloWindTime: { value: 0 }, keloWindDir: { value: new THREE.Vector2(1, 0) }, keloWindLean: { value: 0 }, keloWindRock: { value: 0.03 }, keloWindSpeed: { value: 1.2 } };
function foliageSwayShader(shader) {
      Object.assign(shader.uniforms, FOLIAGE_WIND);
      shader.vertexShader = `attribute float keloSway;
uniform float keloWindTime; uniform vec2 keloWindDir; uniform float keloWindLean; uniform float keloWindRock; uniform float keloWindSpeed;
` + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
	{
		mat4 kM = modelMatrix;
		#ifdef USE_INSTANCING
		kM = modelMatrix * instanceMatrix;
		#endif
		vec3 kRoot = kM[3].xyz;
		float kPh = keloWindTime * keloWindSpeed + kRoot.x * 0.37 + kRoot.z * 0.29;
		float kAmt = ( keloWindLean + sin( kPh ) * keloWindRock + sin( kPh * 2.3 + 1.7 ) * keloWindRock * 0.35 ) * keloSway;
		vec3 kW = vec3( keloWindDir.x, 0.0, keloWindDir.y ) * kAmt;
		// world push into the mesh's own frame (rotation and uniform scale only)
		vec3 kL = vec3( dot( kM[0].xyz, kW ), dot( kM[1].xyz, kW ), dot( kM[2].xyz, kW ) ) / max( dot( kM[0].xyz, kM[0].xyz ), 1e-4 );
		transformed += kL;
	}`);
    }

// Mark how far up a tree each vertex is (for foliageSwayShader): `base` is the geometry's own height
// above the tree's foot, `height` the whole tree's
function markSway(geo, base, height, scale = 1) {
      const p = geo.attributes.position, a = new Float32Array(p.count);
      for (let i = 0; i < p.count; i++) { const u = Math.max(0, Math.min(1, (base + p.getY(i)) / height)); a[i] = u * u * scale; }
      geo.setAttribute('keloSway', new THREE.BufferAttribute(a, 1));
      return geo;
    }

function roughen(geo, amount, seed) {
      return typeof roughenGeometry === 'function' ? roughenGeometry(geo, amount, seed) : geo;
    }

// A Douglas fir about `height` tall
function buildNaturalFir(rng, height = 4) {
      const M = naturalTreeMaterials();
      const tree = new THREE.Group();
      const trunkH = height * 0.32;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(height * 0.025, height * 0.05, trunkH + height * 0.5, 7), M.firBark);
      trunk.position.y = (trunkH + height * 0.5) / 2;
      trunk.castShadow = true;
      tree.add(trunk);
      const mat = M.needles[Math.floor(rng() * M.needles.length)];
      const tiers = 6;
      for (let i = 0; i < tiers; i++) {
        const t = i / (tiers - 1);
        const r = height * (0.3 - 0.22 * t) * (0.9 + rng() * 0.2);
        const h = height * (0.3 - 0.1 * t);
        const coneY = trunkH + t * (height - trunkH - h * 0.5) + h * 0.2;
        const cone = new THREE.Mesh(markSway(roughen(new THREE.ConeGeometry(r, h, 9, 2), 0.16, rng() * 100), coneY, height), mat);
        cone.position.y = coneY;
        cone.rotation.y = rng() * Math.PI;
        cone.rotation.z = (rng() - 0.5) * 0.08;
        cone.castShadow = true;
        tree.add(cone);
      }
      return tree;
    }

// A broadleaf tree (about 3.2 tall): trunk, forked branches and a crown of leaf clumps. The clumps
// are spheres made lumpy, so js/wind.js still finds and sways them.
function buildNaturalLeafyTree(rng, variant = 0) {
      const M = naturalTreeMaterials();
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.2, 1.7, 8), M.bark);
      trunk.position.y = 0.85;
      trunk.castShadow = true;
      tree.add(trunk);
      // Branches reaching up and out from the top of the trunk (seen bare in winter)
      const branches = 3 + Math.floor(rng() * 2);
      for (let b = 0; b < branches; b++) {
        const a = (b / branches) * Math.PI * 2 + rng() * 0.6;
        const len = 0.9 + rng() * 0.5, tilt = 0.5 + rng() * 0.35;
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.08, len, 6), M.bark);
        branch.position.set(Math.cos(a) * Math.sin(tilt) * len / 2, 1.6 + Math.cos(tilt) * len / 2, Math.sin(a) * Math.sin(tilt) * len / 2);
        branch.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
        branch.castShadow = true;
        tree.add(branch);
      }
      const leaf = M.leaves[(variant + Math.floor(rng() * 2)) % M.leaves.length];
      const clumps = 6 + Math.floor(rng() * 3);
      for (let k = 0; k < clumps; k++) {
        const a = rng() * Math.PI * 2, d = k === 0 ? 0 : 0.45 + rng() * 0.45;
        const r = k === 0 ? 0.95 : 0.5 + rng() * 0.35;
        const blob = new THREE.Mesh(roughen(new THREE.SphereGeometry(r, 12, 9), 0.2, rng() * 100), leaf);
        blob.position.set(Math.cos(a) * d, (k === 0 ? 2.35 : 1.85 + rng() * 0.9), Math.sin(a) * d);
        blob.scale.y = 0.82;
        blob.castShadow = true;
        tree.add(blob);
      }
      return tree;
    }

// Join simple geometries into one (for instanced forests)
function joinGeometries(geos) {
      const parts = geos.map(g => (g.index ? g.toNonIndexed() : g));
      let n = 0;
      parts.forEach(g => { n += g.attributes.position.count; });
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
      let o = 0;
      parts.forEach(g => {
        pos.set(g.attributes.position.array, o * 3);
        nor.set(g.attributes.normal.array, o * 3);
        o += g.attributes.position.count;
      });
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      return out;
    }

// Forests on the far hills: hundreds of firs, drawn as one instanced mesh
function buildDistantForest(spots) {
      const M = naturalTreeMaterials();
      const tiers = [];
      for (let i = 0; i < 4; i++) {
        const t = i / 3;
        const g = roughen(new THREE.ConeGeometry(1.25 - 0.85 * t, 1.9 - 0.4 * t, 8, 1), 0.12, i * 7 + 1);
        g.translate(0, 1.1 + t * 2.4, 0);
        tiers.push(g);
      }
      const trunk = new THREE.CylinderGeometry(0.1, 0.18, 1.4, 5);
      trunk.translate(0, 0.7, 0);
      const crown = markSway(joinGeometries(tiers), 0, 4.6, 0.7);
      const foliage = new THREE.InstancedMesh(crown, M.needles[0], spots.length);
      const trunks = new THREE.InstancedMesh(trunk, M.firBark, spots.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
      const c = new THREE.Color();
      spots.forEach(([x, y, z, k, turn, shade], i) => {
        q.setFromAxisAngle(up, turn);
        m.compose(p.set(x, y, z), q, s.set(k, k * (0.9 + shade * 0.3), k));
        foliage.setMatrixAt(i, m);
        trunks.setMatrixAt(i, m);
        c.setRGB(0.85 + shade * 0.3, 0.9 + shade * 0.2, 0.85 + shade * 0.25);
        foliage.setColorAt(i, c);
      });
      foliage.castShadow = trunks.castShadow = false;
      foliage.receiveShadow = true;
      scene.add(foliage, trunks);
      return foliage;
    }

// --- 14. Grass near the camera ------------------------------------------------------------------------
// Short tufts of blades on the meadow around where the camera looks (High and Balanced), one instanced
// mesh, coloured from the ground under each tuft so they match it in every season (snow and dug or
// paved ground get none). They are laid out on a fixed jittered grid, so moving the camera never
// makes them swim, and rebuilt only after the view has moved a little. They sway with the firs.
const GRASS_CELL = 0.5;
let grassTufts = null;
const grassState = { x: 1e9, z: 1e9, key: '', near: [], at: 0 };

function grassTuftGeometry() {
      const pos = [], col = [], sway = [], nor = [];
      const blades = 6;
      for (let b = 0; b < blades; b++) {
        const a = (b / blades) * Math.PI * 2 + b * 0.7, lean = 0.12 + (b % 3) * 0.06;
        const ox = Math.cos(a) * 0.05, oz = Math.sin(a) * 0.05, w = 0.028;
        const px = -Math.sin(a) * w, pz = Math.cos(a) * w, h = 0.75 + (b % 2) * 0.25;
        pos.push(ox - px, 0, oz - pz, ox + px, 0, oz + pz, ox + Math.cos(a) * lean, h, oz + Math.sin(a) * lean);
        col.push(0.62, 0.62, 0.62, 0.62, 0.62, 0.62, 1.08, 1.08, 1.0);
        sway.push(0, 0, 0.9);
        nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute('keloSway', new THREE.Float32BufferAttribute(sway, 1));
      return g;
    }

function grassHash(i, j, k) {
      const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
      return s - Math.floor(s);
    }

// The terrain's own colour at a spot (nearest grid vertex), or null off the island
function grassGroundColour(x, z, out) {
      const mesh = terrainGroundMesh;
      if (!mesh || typeof terrainGrid === 'undefined' || !terrainGrid || terrainGrid.geo !== mesh.geometry) return null;
      const g = terrainGrid, col = mesh.geometry.attributes.color, nrm = mesh.geometry.attributes.normal;
      const ix = Math.round((x - mesh.position.x - g.x0) / g.dx), iz = Math.round((z - mesh.position.z - g.z0) / g.dz);
      if (ix < 0 || iz < 0 || ix >= g.cols || iz >= g.rows) return null;
      const i = ix + g.cols * iz;
      if (nrm && nrm.getY(i) < 0.8) return null;
      return out.setRGB(col.getX(i), col.getY(i), col.getZ(i));
    }

// Floors and paving the grass must stay under: the buildings' footprints (the same list the map
// draws, so a building added there is covered), the Workshop's pad, lane and hangar with its apron,
// the plant's yard. Obstacles, the vehicle yard, the pads and his roads are checked as well.
function grassFloorRects() {
      const out = [];
      if (typeof minimapBuildings === 'function') minimapBuildings().forEach(b => out.push({ minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2 }));
      if (typeof WORKSHOP_LAND !== 'undefined') [WORKSHOP_LAND.pad, WORKSHOP_LAND.lane, WORKSHOP_LAND.hangar].forEach(r => r && out.push(r));
      if (typeof aggregatePlantSite === 'function') {
        const S = aggregatePlantSite();
        out.push({ minX: S.x - S.w / 2, maxX: S.x + S.w / 2, minZ: S.z - S.d / 2, maxZ: S.z + S.d / 2 });
      }
      return out;
    }

function grassBlockedAt(x, z) {
      if (typeof inParkingArea === 'function' && inParkingArea(x, z, 0.3)) return true;
      const floors = grassState.floors || [];
      for (let i = 0; i < floors.length; i++) {
        const r = floors[i];
        if (x > r.minX - 0.3 && x < r.maxX + 0.3 && z > r.minZ - 0.3 && z < r.maxZ + 0.3) return true;
      }
      const near = grassState.near;
      for (let i = 0; i < near.length; i++) {
        const o = near[i];
        if (o.hw !== undefined) {
          const cs = Math.cos(o.rot || 0), sn = Math.sin(o.rot || 0), lx = x - o.x, lz = z - o.z;
          if (Math.abs(lx * cs - lz * sn) < o.hw + 0.3 && Math.abs(lx * sn + lz * cs) < o.hd + 0.3) return true;
        } else if (o.road) {
          const ax = o.x, az = o.z, bx = o.toX - ax, bz = o.toZ - az, L = bx * bx + bz * bz || 1;
          const u = Math.max(0, Math.min(1, ((x - ax) * bx + (z - az) * bz) / L));
          if (Math.hypot(x - ax - bx * u, z - az - bz * u) < (o.hw || 1.3)) return true;
        } else if ((x - o.x) * (x - o.x) + (z - o.z) * (z - o.z) < o.r * o.r * 0.5) return true;
      }
      return false;
    }

function updateGrassTufts() {
      const R = graphics().grassRadius || 0;
      if (!R || !terrainGroundMesh || typeof controls === 'undefined' || !controls) { if (grassTufts) grassTufts.visible = false; return; }
      const cell = GRASS_CELL, n = Math.ceil(R / cell);
      if (!grassTufts || grassTufts.userData.cap < (2 * n + 1) * (2 * n + 1)) {
        if (grassTufts) { scene.remove(grassTufts); grassTufts.dispose && grassTufts.dispose(); }
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
        mat.onBeforeCompile = foliageSwayShader;
        const cap = (2 * n + 1) * (2 * n + 1);
        grassTufts = new THREE.InstancedMesh(grassTuftGeometry(), mat, cap);
        grassTufts.userData = { cap, noShadow: true };
        grassTufts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        // Colours from the start, so the shader is built with them even if the first pass finds no grass
        grassTufts.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
        grassTufts.frustumCulled = false;
        grassTufts.castShadow = false;
        grassTufts.receiveShadow = true;
        grassTufts.count = 0;
        scene.add(grassTufts);
        grassState.x = 1e9;
      }
      grassTufts.visible = true;
      // Below the camera's own height the view hardly changes; well above the meadow tufts are too small to see
      const tg = controls.target, cam = camera.position;
      const far = cam.y - getAnalyticalGroundHeight(cam.x, cam.z) > 45;
      grassTufts.visible = !far;
      const col = terrainGroundMesh.geometry.attributes.color;
      const key = `${R}|${col.version}|${typeof seasonApplied !== 'undefined' ? seasonApplied : ''}|${typeof obstacleVersion !== 'undefined' ? obstacleVersion : 0}|${(state.worldEdits || []).length}|${(state.concretePours || []).length}`;
      const moved = Math.hypot(tg.x - grassState.x, tg.z - grassState.z) >= R * 0.14;
      // Ground that keeps changing (a fill or a dig being animated) re-lays the grass at most every 1.5 s
      const now = performance.now();
      if (far || (!moved && (key === grassState.key || now - grassState.at < 1500))) return;
      grassState.x = tg.x; grassState.z = tg.z; grassState.key = key; grassState.at = now;
      const cx = Math.round(tg.x / cell), cz = Math.round(tg.z / cell);
      grassState.near = [];
      grassState.floors = grassFloorRects().filter(r => r.maxX > tg.x - R - 1 && r.minX < tg.x + R + 1 && r.maxZ > tg.z - R - 1 && r.minZ < tg.z + R + 1);
      (typeof worldObstacles !== 'undefined' ? worldObstacles : []).forEach(o => { if (Math.hypot(o.x - tg.x, o.z - tg.z) < R + (o.r || 1) + 1) grassState.near.push(o); });
      (state.worldEdits || []).forEach(e => { if (e.type === 'road' && Number.isFinite(e.toX)) grassState.near.push({ road: true, x: e.x, z: e.z, toX: e.toX, toZ: e.toZ }); });
      // His concrete paths and pads (js/plants.js)
      (state.concretePours || []).forEach(p => { if (Number.isFinite(p.toX)) grassState.near.push({ road: true, x: p.x, z: p.z, toX: p.toX, toZ: p.toZ, hw: (p.w || 1.2) / 2 + 0.3 }); });
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
      let k = 0;
      for (let j = -n; j <= n; j++) {
        for (let i = -n; i <= n; i++) {
          const gi = cx + i, gj = cz + j;
          const h0 = grassHash(gi, gj, 1);
          if (h0 > 0.9) continue;
          const x = gi * cell + (grassHash(gi, gj, 2) - 0.5) * cell * 0.9, z = gj * cell + (grassHash(gi, gj, 3) - 0.5) * cell * 0.9;
          const d = Math.hypot(x - tg.x, z - tg.z);
          if (d > R) continue;
          if (!grassGroundColour(x, z, c)) continue;
          // Only on meadow green (not dirt, sand, rock, gravel, snow or dug ground)
          if (!(c.g > c.r * 0.97 && c.g > c.b * 1.25)) continue;
          const ym = typeof terrainMeshHeightAt === 'function' ? terrainMeshHeightAt(x, z) : null;
          const y = ym === null ? getAnalyticalGroundHeight(x, z) : ym;
          if (y < 0.02 || y > 3.2) continue;
          if (grassBlockedAt(x, z)) continue;
          // Smaller toward the edge, so there is no ring where the grass ends
          const fade = Math.min(1, (R - d) / (R * 0.3));
          const s = (0.24 + grassHash(gi, gj, 4) * 0.24) * (0.35 + 0.65 * fade);
          q.setFromAxisAngle(up, grassHash(gi, gj, 5) * Math.PI * 2);
          m.compose(p.set(x, y - 0.01, z), q, sc.set(s * 1.4, s, s * 1.4));
          grassTufts.setMatrixAt(k, m);
          c.multiplyScalar(0.85 + grassHash(gi, gj, 6) * 0.35);
          grassTufts.setColorAt(k, c);
          k++;
        }
      }
      grassTufts.count = k;
      grassTufts.instanceMatrix.needsUpdate = true;
      if (grassTufts.instanceColor) grassTufts.instanceColor.needsUpdate = true;
    }
