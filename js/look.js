// Kelo-bot-1 — js/look.js
// Loaded right after realism.js. The "richer stylized" look in one place:
//   - LOOK: every tunable number of the look (light, shadows, mist, grading, bloom, light shafts, cloud
//     shadows, ground blending, contact shadows, grass, life). Retune here; nothing else hard-codes them.
//   - the Graphics levels shown as Low / Medium / High (saved keys stay fast / balanced / high, so old
//     settings keep working), what each level turns on, and a quick benchmark that picks one the first
//     time the game runs on a device (saved on that device)
//   - height fog: low valley mist that thickens in the morning and evening (patched into three.js's
//     fog chunk, so every material gets it with no extra pass)
//   - the final picture pass (Medium and High): colour grading by time of day, gentle vignette, light
//     shafts from a low sun (High), and the bloom settings
//   - the ground: grass, dirt, rock and sand blended by slope, height and noise; wet sand at the
//     waterline; drifting cloud shadows
//   - softer shadows (blur radius per level) and a warmer golden hour
// Everything is drawing only: no gameplay state is read or written except what the look needs.

// --- 1. The look config ------------------------------------------------------------------------------
const LOOK = {
  // Sun colour when it is low: multiplied into the sun colour realism.js works out (golden hour)
  golden: { sun: [1.06, 0.9, 0.72], hemiWarm: [1.08, 0.96, 0.84], exposureLift: 0.14 },
  // Shadows: blur radius (PCF soft) per level, and how dark shade may get (the hemisphere light floor)
  // (three.js r128's PCF filter spreads its 9 taps by this radius; its 'PCF soft' filter ignores radius)
  shadow: { radius: { high: 2.6, balanced: 2.0, fast: 1 }, hemiFloor: 0.03 },
  // Valley mist: thicker low down. density is per unit of distance; falloff per unit of height above base
  mist: { base: -0.2, falloff: 0.42, day: 0.0015, dawn: 0.008, dusk: 0.0035, night: 0.004, rain: 0.006, max: 0.4 },
  // Colour grading (display space). Tints are multipliers; split toning adds to shadows/highlights.
  grade: {
    contrast: 1.06, saturation: 1.1, vignette: 0.2,
    day: { tint: [1.0, 1.0, 0.985], shadows: [-0.006, 0.0, 0.012], highlights: [0.012, 0.006, -0.008] },
    dusk: { tint: [1.1, 0.99, 0.84], shadows: [0.01, -0.004, 0.02], highlights: [0.03, 0.01, -0.02] },
    night: { tint: [0.9, 0.96, 1.1], shadows: [-0.004, 0.0, 0.018], highlights: [0.0, 0.0, 0.0] }
  },
  bloom: { strength: 0.26, radius: 0.5, threshold: 0.84, nightStrength: 0.42 },
  // Light shafts from the sun when it is low (High): screen-space rays from the bright sky
  shafts: { strength: 0.42, samples: 24, decay: 0.955, threshold: 0.62, length: 0.55 },
  // Shadows of the clouds drifting over the ground
  cloudShadow: { strength: 0.2, scale: 0.011, speed: 0.9 },
  // Ground blending
  ground: { noiseScale: 0.09, dirtPatches: 0.22, rockByHeight: [2.0, 4.5], shoreSand: 0.32, wetSand: 0.35 },
  // Contact shadows under buildings, trees, rocks and props
  contact: { strength: 0.5, treeR: 1.25, buildingPad: 0.7 },
  // Grass and flowers near the camera
  grass: { innerCell: 0.42, outerCell: 0.8, innerR: 9, flowerChance: 0.07 },
  // Particles in the air (dust, pollen, leaves, snowflakes are separate in weather.js)
  air: { radius: 22, height: 9 },
  // Town life
  life: { people: 5, carsParked: 3 }
};

// What each level turns on (merged into realism.js's GRAPHICS_LEVELS). Labels are what Settings shows.
(function lookLevels() {
      Object.assign(GRAPHICS_LEVELS.high, { label: 'High', grade: true, shafts: true, bloom: true, mist: true, cloudShadows: true, groundBlend: 2, contactShadows: true, grassRadius: 24, flowers: true, airParticles: 260, townLife: 2, smoke: true, flags: true, normalDetail: true });
      Object.assign(GRAPHICS_LEVELS.balanced, { label: 'Medium', grade: true, shafts: false, bloom: true, mist: true, cloudShadows: true, groundBlend: 1, contactShadows: true, grassRadius: 15, flowers: true, airParticles: 140, townLife: 2, smoke: true, flags: true, normalDetail: true });
      Object.assign(GRAPHICS_LEVELS.fast, { label: 'Low', grade: false, shafts: false, bloom: false, mist: true, cloudShadows: true, groundBlend: 0, contactShadows: true, grassRadius: 7, flowers: false, airParticles: 0, townLife: 1, smoke: true, flags: true, normalDetail: false });
    })();

// --- 2. The quick benchmark: pick a level the first time on a device ------------------------------
// Runs once (no saved choice and no earlier automatic pick): times 70 frames on Medium a few seconds
// after the world is ready, steps to High if there is room and back if High is slow, or to Low.
const LOOK_BENCH_KEY = 'kelo-graphics-bench';
const lookBench = { running: false };
function lookShouldBenchmark() {
      if (typeof graphicsChosen !== 'undefined' && graphicsChosen) return false;
      try {
        if (localStorage.getItem(GRAPHICS_KEY) || localStorage.getItem(GRAPHICS_KEY + '-auto') || localStorage.getItem(LOOK_BENCH_KEY)) return false;
      } catch (e) { return false; }
      return true;
    }
function lookTimeFrames(n) {
      return new Promise(res => {
        const ts = [];
        let last = 0;
        const step = (t) => {
          if (document.hidden) { last = 0; requestAnimationFrame(step); return; }
          if (last) ts.push(t - last);
          last = t;
          if (ts.length >= n) { ts.sort((a, b) => a - b); res(ts[Math.floor(ts.length * 0.6)]); return; }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }
async function lookRunBenchmark() {
      if (lookBench.running || !lookShouldBenchmark()) return;
      lookBench.running = true;
      const phone = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      let pick = graphicsLevel;
      try {
        if (graphicsLevel !== 'balanced' && !phone) setGraphicsLevel('balanced', false);
        await lookTimeFrames(20); // the switch settles (shaders, shadow map)
        const med = await lookTimeFrames(70);
        lookBench.medium = med;
        if (med > 30) pick = 'fast';
        else if (med < 19 && !phone) {
          setGraphicsLevel('high', false);
          await lookTimeFrames(25);
          const hi = await lookTimeFrames(70);
          lookBench.high = hi;
          pick = hi < 24 ? 'high' : 'balanced';
        } else pick = phone ? graphicsLevel : 'balanced';
      } catch (e) { pick = graphicsLevel; }
      lookBench.running = false;
      lookBench.pick = pick;
      if (typeof graphicsChosen !== 'undefined' && graphicsChosen) return; // the visitor picked meanwhile
      setGraphicsLevel(pick, false);
      try { localStorage.setItem(LOOK_BENCH_KEY, JSON.stringify({ at: Date.now(), medium: lookBench.medium, high: lookBench.high || null, pick })); } catch (e) {}
    }
// Starts from the world's first frames (finishRealisticWorld runs at the end of initDiorama3D)
(function lookHookFinish() {
      const orig = finishRealisticWorld;
      finishRealisticWorld = function () {
        orig.apply(this, arguments);
        lookAfterWorldReady();
        if (lookShouldBenchmark()) setTimeout(lookRunBenchmark, 5000);
      };
    })();

// --- 3. Height fog: valley mist -----------------------------------------------------------------------
// three.js r128 only has distance fog. The fog chunks are replaced with ones that also know the height
// of each pixel (from mvPosition, so points and sprites work too) and add low mist. The mist's density
// travels in fogFar: scene.fog is flagged isFog as well as isFogExp2, so three.js uploads fogNear and
// fogFar; fogNear carries the usual density (lookSyncFog copies it each frame).
const LOOK_FOG_OK = (function lookPatchFog() {
      const C = THREE.ShaderChunk;
      if (!/fogDepth = - mvPosition\.z/.test(C.fog_vertex || '') || !/fogDensity \* fogDensity \* fogDepth/.test(C.fog_fragment || '')) return false;
      C.fog_pars_vertex = '#ifdef USE_FOG\n\tvarying float fogDepth;\n\tvarying float keloFogY;\n#endif';
      C.fog_vertex = '#ifdef USE_FOG\n\tfogDepth = - mvPosition.z;\n\tkeloFogY = ( ( mvPosition.xyz - viewMatrix[ 3 ].xyz ) * mat3( viewMatrix ) ).y;\n#endif';
      C.fog_pars_fragment = '#ifdef USE_FOG\n\tuniform vec3 fogColor;\n\tvarying float fogDepth;\n\tvarying float keloFogY;\n\tuniform float fogNear;\n\tuniform float fogFar;\n#endif';
      C.fog_fragment = `#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogNear * fogNear * fogDepth * fogDepth );
		// valley mist: thick near the lake and the valley floor, thinning with height
		float keloMistH = exp( - max( keloFogY - ${LOOK.mist.base.toFixed(3)}, 0.0 ) * ${LOOK.mist.falloff.toFixed(3)} );
		float keloMist = ( 1.0 - exp( - fogFar * fogDepth ) ) * keloMistH * ${LOOK.mist.max.toFixed(3)};
		fogFactor = 1.0 - ( 1.0 - fogFactor ) * ( 1.0 - keloMist );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, fogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;
      return true;
    })();
let lookMistShown = 0;
function lookSyncFog(dt) {
      const f = scene && scene.fog;
      if (!f || !LOOK_FOG_OK || !f.isFogExp2) return;
      f.isFog = true; // so three.js uploads near/far (see above)
      const s = SKY_STATE, M = LOOK.mist, q = graphics();
      let want = 0;
      if (q.mist) {
        // morning mist is the thickest; evening a little; a thin haze by day
        const morning = s.hour < 12 ? 1 : 0;
        want = M.day * s.day * (1 - s.dusk) + (morning ? M.dawn : M.dusk) * s.dusk + M.night * s.night + M.rain * (s.overcast || 0);
      }
      lookMistShown += (want - lookMistShown) * Math.min(1, (dt || 0.016) * 1.5);
      f.near = f.density;
      f.far = lookMistShown;
    }

// --- 4. Light: warmer golden hour, softer shadows -------------------------------------------------
(function lookHookSky() {
      const orig = applySkyForHour;
      applySkyForHour = function (hour, dayOfYear) {
        orig.apply(this, arguments);
        if (!sunLight || !hemiLight) return;
        const s = SKY_STATE, G = LOOK.golden, d = s.dusk * (1 - s.night);
        if (d > 0.001 && s.sinElev > -0.03) {
          sunLight.color.setRGB(sunLight.color.r * (1 + (G.sun[0] - 1) * d), sunLight.color.g * (1 + (G.sun[1] - 1) * d), sunLight.color.b * (1 + (G.sun[2] - 1) * d));
          hemiLight.color.setRGB(hemiLight.color.r * (1 + (G.hemiWarm[0] - 1) * d), hemiLight.color.g * (1 + (G.hemiWarm[1] - 1) * d), hemiLight.color.b * (1 + (G.hemiWarm[2] - 1) * d));
          renderer.toneMappingExposure += G.exposureLift * d;
        }
        hemiLight.intensity = Math.max(hemiLight.intensity, LOOK.shadow.hemiFloor);
      };
      const origApply = applyGraphicsLevel;
      applyGraphicsLevel = function () {
        origApply.apply(this, arguments);
        if (sunLight) sunLight.shadow.radius = LOOK.shadow.radius[graphicsLevel] || 1;
        // softer edges come from the widened PCF taps, so every level uses the PCF filter
        if (renderer.shadowMap.type !== THREE.PCFShadowMap) { renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.needsUpdate = true; }
        if (typeof lookApplyLevelExtras === 'function') lookApplyLevelExtras();
      };
    })();

// --- 5. The final picture: grading, vignette, light shafts, bloom ----------------------------------
const LOOK_FINAL_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    gradeTint: { value: new THREE.Vector3(1, 1, 1) },
    gradeShadows: { value: new THREE.Vector3() },
    gradeHighlights: { value: new THREE.Vector3() },
    gradeContrast: { value: 1 }, gradeSaturation: { value: 1 }, gradeVignette: { value: 0 },
    shaftSun: { value: new THREE.Vector2(0.5, 0.5) }, shaftAmount: { value: 0 }, shaftColor: { value: new THREE.Vector3(1, 0.8, 0.55) },
    aspect: { value: 1 }
  },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
uniform vec3 gradeTint; uniform vec3 gradeShadows; uniform vec3 gradeHighlights;
uniform float gradeContrast; uniform float gradeSaturation; uniform float gradeVignette;
uniform vec2 shaftSun; uniform float shaftAmount; uniform vec3 shaftColor; uniform float aspect;
vec3 keloSRGB( vec3 c ) { c = max( c, vec3( 0.0 ) ); return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) ); }
void main() {
	vec3 c = texture2D( tDiffuse, vUv ).rgb;
	#ifdef KELO_SHAFTS
	if ( shaftAmount > 0.002 ) {
		// march toward the sun on screen, adding up bright sky (geometry in between blocks it)
		vec2 dir = ( shaftSun - vUv ) * ( ${LOOK.shafts.length.toFixed(3)} / float( ${LOOK.shafts.samples} ) );
		vec2 p = vUv;
		float w = 1.0, acc = 0.0;
		for ( int i = 0; i < ${LOOK.shafts.samples}; i++ ) {
			p += dir;
			vec3 s = texture2D( tDiffuse, clamp( p, 0.001, 0.999 ) ).rgb;
			acc += smoothstep( ${LOOK.shafts.threshold.toFixed(3)}, 1.0, max( s.r, max( s.g, s.b ) ) ) * w;
			w *= ${LOOK.shafts.decay.toFixed(3)};
		}
		vec2 dd = ( vUv - shaftSun ) * vec2( aspect, 1.0 );
		float fall = 1.0 - smoothstep( 0.1, 1.1, length( dd ) );
		c += shaftColor * acc / float( ${LOOK.shafts.samples} ) * shaftAmount * fall;
	}
	#endif
	vec3 s = keloSRGB( c );
	#ifdef KELO_GRADE
	float l = dot( s, vec3( 0.2126, 0.7152, 0.0722 ) );
	s = mix( vec3( l ), s, gradeSaturation );
	s = ( s - 0.5 ) * gradeContrast + 0.5;
	s *= gradeTint;
	s += gradeShadows * ( 1.0 - smoothstep( 0.0, 0.55, l ) ) + gradeHighlights * smoothstep( 0.45, 1.0, l );
	vec2 v = ( vUv - 0.5 ) * vec2( aspect, 1.0 );
	s *= 1.0 - gradeVignette * smoothstep( 0.35, 1.05, length( v ) );
	#endif
	gl_FragColor = vec4( clamp( s, 0.0, 1.0 ), 1.0 );
}`
};
let lookFinalPass = null;
// Replaces realism.js's setupPostProcessing: the composer is used when any of bloom, grading or shafts is on
(function lookHookPost() {
      setupPostProcessing = function () {
        if (postComposer) {
          postComposer.renderTarget1.dispose();
          postComposer.renderTarget2.dispose();
          if (bloomPass) bloomPass.dispose();
          postComposer = bloomPass = lookFinalPass = null;
        }
        const q = graphics();
        if (!renderer || !(q.bloom || q.grade || q.shafts) || !THREE.EffectComposer || !THREE.ShaderPass) return;
        renderer.getDrawingBufferSize(postSize);
        const opts = { format: THREE.RGBAFormat, type: renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType };
        const target = renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget
          ? new THREE.WebGLMultisampleRenderTarget(postSize.x, postSize.y, opts)
          : new THREE.WebGLRenderTarget(postSize.x, postSize.y, opts);
        postComposer = new THREE.EffectComposer(renderer, target);
        postComposer.addPass(new THREE.RenderPass(scene, camera));
        if (q.bloom && THREE.UnrealBloomPass) {
          const B = LOOK.bloom;
          bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(postSize.x / 2, postSize.y / 2), B.strength, B.radius, B.threshold);
          postComposer.addPass(bloomPass);
        }
        const final = new THREE.ShaderPass(LOOK_FINAL_SHADER);
        final.material.defines = {};
        if (q.grade) final.material.defines.KELO_GRADE = '';
        if (q.shafts) final.material.defines.KELO_SHAFTS = '';
        final.material.needsUpdate = true;
        lookFinalPass = final;
        postComposer.addPass(final);
        resizePostProcessing();
      };
    })();

const lookSunScreen = new THREE.Vector3(), lookCamDir = new THREE.Vector3();
const lookMix3 = (out, a, b, t) => out.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
function lookUpdateFinal() {
      if (!lookFinalPass) return;
      const u = lookFinalPass.material.uniforms, s = SKY_STATE, G = LOOK.grade;
      const dusk = Math.min(1, s.dusk * 1.2), night = s.night;
      // day → dusk → night
      lookMix3(u.gradeTint.value, G.day.tint, G.dusk.tint, dusk);
      lookMix3(u.gradeShadows.value, G.day.shadows, G.dusk.shadows, dusk);
      lookMix3(u.gradeHighlights.value, G.day.highlights, G.dusk.highlights, dusk);
      if (night > 0) {
        u.gradeTint.value.lerp(lookSunScreen.set(G.night.tint[0], G.night.tint[1], G.night.tint[2]), night);
        u.gradeShadows.value.lerp(lookSunScreen.set(G.night.shadows[0], G.night.shadows[1], G.night.shadows[2]), night);
        u.gradeHighlights.value.lerp(lookSunScreen.set(0, 0, 0), night);
      }
      u.gradeContrast.value = G.contrast;
      u.gradeSaturation.value = G.saturation * (1 - 0.25 * (s.overcast || 0));
      u.gradeVignette.value = G.vignette;
      const el = renderer.domElement;
      u.aspect.value = (el.clientWidth || 1) / (el.clientHeight || 1);
      // Shafts: only with a low sun in front of the camera, fading out as it climbs
      let amt = 0;
      if (graphics().shafts && s.dusk > 0.02 && s.sinElev > -0.04) {
        camera.getWorldDirection(lookCamDir);
        const facing = lookCamDir.dot(s.sunDir);
        if (facing > 0.1) {
          lookSunScreen.copy(camera.position).addScaledVector(s.sunDir, 500).project(camera);
          u.shaftSun.value.set(lookSunScreen.x * 0.5 + 0.5, lookSunScreen.y * 0.5 + 0.5);
          amt = LOOK.shafts.strength * s.dusk * Math.min(1, (facing - 0.1) * 2.5) * (1 - (s.overcast || 0));
        }
      }
      u.shaftAmount.value = amt;
      u.shaftColor.value.set(sunLight.color.r, sunLight.color.g * 0.92, sunLight.color.b * 0.8);
      if (bloomPass) bloomPass.strength = LOOK.bloom.strength + (LOOK.bloom.nightStrength - LOOK.bloom.strength) * night;
    }

// --- 6. The ground: blended surfaces, wet sand, cloud shadows ------------------------------------
// Adds to realism.js's terrain shader (it already picks grass/dirt/rock/sand/snow from the ground's own
// colour and turns steep ground rocky). Here: noisy edges between surfaces, dirt patches in the meadow,
// scree and rock with height, sand along the lake by height, darker wet sand at the waterline, and
// soft shadows of the clouds drifting by.
const LOOK_GROUND_U = { keloTime: { value: 0 }, keloCloudAmt: { value: 0 }, keloWind: { value: new THREE.Vector2(1, 0.3) } };
(function lookHookTerrain() {
      if (typeof makeRealisticTerrainMaterial !== 'function') return;
      const orig = makeRealisticTerrainMaterial;
      makeRealisticTerrainMaterial = function () {
        const mat = orig.apply(this, arguments);
        const prev = mat.onBeforeCompile;
        mat.defines.KELO_BLEND = graphics().groundBlend || 0;
        mat.onBeforeCompile = (shader) => {
          prev(shader);
          Object.assign(shader.uniforms, LOOK_GROUND_U);
          const L = LOOK.ground, f = (v) => v.toFixed(3);
          shader.fragmentShader = shader.fragmentShader
            .replace('vec3 keloTex( sampler2D m, vec2 uv )', `uniform float keloTime; uniform float keloCloudAmt; uniform vec2 keloWind;
float keloHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float keloNoise( vec2 p ) {
	vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( keloHash( i ), keloHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( keloHash( i + vec2( 0.0, 1.0 ) ), keloHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
float keloFbm( vec2 p ) { return keloNoise( p ) * 0.55 + keloNoise( p * 2.07 + 3.1 ) * 0.3 + keloNoise( p * 4.3 + 7.7 ) * 0.15; }
vec3 keloTex( sampler2D m, vec2 uv )`)
            // after the surface weights are known (and before the textures are laid), move them about
            .replace('float kSum = wSnow + wGrass + wSand + wDirt + wRock;', `
	#if KELO_BLEND > 0
	{
		float kN = keloFbm( vKeloW.xz * ${f(L.noiseScale)} );
		float kN2 = keloNoise( vKeloW.xz * ${f(L.noiseScale * 4.0)} + 11.0 );
		// worn dirt patches in the meadow, with ragged edges
		float kPatch = smoothstep( 0.62, 0.74, kN + kN2 * 0.12 ) * ${f(L.dirtPatches)} * ( 1.0 - kSlope * 2.0 );
		kPatch = max( kPatch, 0.0 ) * wGrass;
		wGrass -= kPatch; wDirt += kPatch;
		// scree and rock taking over as the ground climbs (ragged by the noise)
		float kHigh = smoothstep( ${f(L.rockByHeight[0])}, ${f(L.rockByHeight[1])}, vKeloW.y + ( kN - 0.5 ) * 1.6 ) * ( 0.35 + kSlope ) * wGrass;
		kHigh = clamp( kHigh, 0.0, wGrass );
		wGrass -= kHigh; wRock += kHigh * 0.6; wDirt += kHigh * 0.4;
		// sand along the lake by height, with a wavy edge
		float kShore = ( 1.0 - smoothstep( 0.05, ${f(L.shoreSand)}, vKeloW.y + ( kN - 0.5 ) * 0.2 ) ) * ( 1.0 - wSnow ) * ( 1.0 - kSlope );
		kShore = clamp( kShore, 0.0, wGrass + wDirt );
		float kFromG = min( kShore, wGrass );
		wGrass -= kFromG; wDirt -= ( kShore - kFromG ); wSand += kShore;
		// a softer change between neighbouring surfaces: grass breaks into the dirt at the edges
		float kEdge = wGrass * wDirt * 4.0 * smoothstep( 0.4, 0.6, kN2 );
		wGrass += kEdge * 0.3; wDirt -= kEdge * 0.3;
		wDirt = max( wDirt, 0.0 );
	}
	#endif
	float kSum = wSnow + wGrass + wSand + wDirt + wRock;`)
            .replace('float kRough = (', `
	#if KELO_BLEND > 0
	// wet, darker sand where the lake laps
	float kWet = ( 1.0 - smoothstep( -0.2, 0.06, vKeloW.y ) ) * ( 1.0 - wSnow );
	diffuseColor.rgb *= 1.0 - ${f(L.wetSand)} * kWet;
	// rock: warm layered strata, and moss on the ledges facing the sky
	float kRockW = wRock / max( kSum, 0.001 );
	if ( kRockW > 0.01 ) {
		float kStrata = keloNoise( vec2( vKeloW.y * 1.1 + keloNoise( vKeloW.xz * 0.05 ) * 3.0, 0.5 ) );
		vec3 kRockTint = mix( vec3( 0.84, 0.78, 0.7 ), vec3( 1.1, 1.03, 0.94 ), kStrata );
		float kMoss = smoothstep( 0.5, 0.82, normalize( vKeloN ).y ) * smoothstep( 0.35, 0.7, keloFbm( vKeloW.xz * 0.2 ) ) * ( 1.0 - wSnow );
		diffuseColor.rgb *= mix( vec3( 1.0 ), kRockTint, kRockW );
		diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 0.72, 1.02, 0.5 ), kMoss * kRockW * 0.65 );
	}
	#endif
	// the shadows of the clouds drifting over
	if ( keloCloudAmt > 0.001 ) {
		vec2 kc = vKeloW.xz * ${f(LOOK.cloudShadow.scale)} - keloWind * keloTime * ${f(LOOK.cloudShadow.speed * 0.01)};
		float kCl = smoothstep( 0.5, 0.78, keloFbm( kc ) );
		diffuseColor.rgb *= 1.0 - keloCloudAmt * kCl;
	}
	float kRough = (`)
            .replace('roughnessFactor = kRough;', `roughnessFactor = kRough;
	#if KELO_BLEND > 0
	roughnessFactor = mix( roughnessFactor, 0.35, kWet * 0.8 );
	#endif`);
        };
        return mat;
      };
    })();

// --- 6b. The lake: sun glitter and a brighter shore line ------------------------------------------
// Adds to realism.js's water shader: sparkles where the moving ripples tilt toward the sun (strong at
// golden hour), and a wider, whiter band of foam where the water meets the beach.
const LOOK_WATER_U = { lookSunDir: { value: new THREE.Vector3(0, 1, 0) }, lookSunCol: { value: new THREE.Color(1, 1, 1) }, lookGlitter: { value: 0 } };
(function lookHookWater() {
      if (typeof makeRealisticWaterMaterial !== 'function') return;
      const orig = makeRealisticWaterMaterial;
      makeRealisticWaterMaterial = function () {
        const mat = orig.apply(this, arguments);
        const prev = mat.onBeforeCompile;
        mat.onBeforeCompile = (shader) => {
          prev(shader);
          Object.assign(shader.uniforms, LOOK_WATER_U);
          shader.fragmentShader = 'uniform vec3 lookSunDir; uniform vec3 lookSunCol; uniform float lookGlitter;\n' + shader.fragmentShader
            .replace('keloFoam = max( keloFoam, keloLap * 0.55 );', `keloFoam = max( keloFoam, keloLap * 0.55 );
	// a soft white band right at the beach
	keloFoam = max( keloFoam, ( 1.0 - smoothstep( 0.0, 0.05, keloDepth ) ) * 0.55 * smoothstep( 0.3, 0.6, keloRipple ) );`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	if ( lookGlitter > 0.001 ) {
		vec3 kV = normalize( cameraPosition - vKeloW );
		vec3 kGN = normalize( vec3( keloWave.x * 0.5, 1.0, keloWave.y * 0.5 ) );
		float kG = pow( max( dot( reflect( - kV, kGN ), lookSunDir ), 0.0 ), 900.0 );
		float kSp = step( 0.82, texture2D( waterNormals, vKeloW.xz * 0.6 + vec2( waterTime * 0.05, waterTime * 0.03 ) ).b );
		totalEmissiveRadiance += keloToLinear( lookSunCol ) * kG * kSp * lookGlitter * ( 1.0 - keloShallow ) * ( 1.0 - keloFoam );
	}`);
        };
        return mat;
      };
    })();

// --- 7. Each frame -----------------------------------------------------------------------------------
let lookTime = 0;
function lookFrame(now) {
      const dt = Math.min(0.1, lookFrame.last ? (now - lookFrame.last) / 1000 : 0.016);
      lookFrame.last = now;
      lookTime += dt;
      lookSyncFog(dt);
      lookUpdateFinal();
      const s = SKY_STATE, q = graphics();
      LOOK_GROUND_U.keloTime.value = lookTime;
      LOOK_WATER_U.lookSunDir.value.copy(s.sunDir);
      if (sunLight) LOOK_WATER_U.lookSunCol.value.copy(sunLight.color);
      LOOK_WATER_U.lookGlitter.value = s.sinElev > 0 ? (6 + 30 * s.dusk) * s.day * (1 - (s.overcast || 0)) * (q.groundBlend > 0 ? 1 : 0) : 0;
      LOOK_GROUND_U.keloCloudAmt.value = q.cloudShadows ? LOOK.cloudShadow.strength * s.day * (1 - 0.6 * s.dusk) * (1 - 0.7 * (s.overcast || 0)) : 0;
      if (typeof windShown !== 'undefined' && windShown) {
        const a = windShown.angle || 0, sp = 0.6 + (windShown.s || 0.3);
        LOOK_GROUND_U.keloWind.value.set(Math.cos(a) * sp, Math.sin(a) * sp);
      }
    }

function lookAfterWorldReady() {
      if (typeof keloEveryFrame === 'function') keloEveryFrame(lookFrame);
      lookApplyLevelExtras();
    }

// Things that follow the level but live outside realism.js
function lookApplyLevelExtras() {
      const q = graphics();
      if (typeof terrainGroundMesh !== 'undefined' && terrainGroundMesh && terrainGroundMesh.material.userData.keloTerrain) {
        const m = terrainGroundMesh.material;
        if (m.defines.KELO_BLEND !== (q.groundBlend || 0)) { m.defines.KELO_BLEND = q.groundBlend || 0; m.needsUpdate = true; }
      }
      if (typeof scatterApplyLevel === 'function') scatterApplyLevel();
      if (typeof ambApplyLevel === 'function') ambApplyLevel();
    }

// Settings: the picker's options read Low / Medium / High (values stay the same)
window.addEventListener('DOMContentLoaded', () => {
  const sel = document.getElementById('graphicsLevelSelect');
  if (!sel) return;
  Array.from(sel.options).forEach(o => { if (GRAPHICS_LEVELS[o.value]) o.textContent = GRAPHICS_LEVELS[o.value].label; });
});
