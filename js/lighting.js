// Kelo-bot-1 — js/lighting.js
// Loaded first, straight after three.js (js/vendor/three/three-global.js). The ONE place that says how
// colour is handled and how the world is lit: every number realism.js and the lamps use to light the
// valley lives in KELO_LIGHTING below, so a new look is made here, not scattered through the code.
//
// --- Colour ------------------------------------------------------------------------------------------
// Every colour in the game's code is an ordinary sRGB colour, the numbers a colour picker shows:
// THREE.Color values, hex and CSS colours, vertex colours (the terrain's ground types, the roads, the
// grass) and instance colours. Game logic reads those numbers back as sRGB (which ground is grass, how
// saturated a part is, snow lines), so three.js's own colour conversion is switched off
// (ColorManagement.enabled = false: a Color keeps exactly the numbers it was given), and the shaders turn
// material, emissive, vertex and instance colours from sRGB into linear light before lighting
// (keloToLinear, patched into three's shader chunks below). A material whose colours are already linear
// (glTF models) opts out with defines: { KELO_LINEAR_COLORS: '' }.
// Pictures (textures used as colour maps: canvases, photos, glTF base colours) are sRGB too. How they are
// decoded is KELO_GPU_DECODES_PICTURES below: false (the default, as r128 did) keeps every picture texture
// stored as it is and the shaders decode it (map, emissive map, points); true marks them
// colorSpace = SRGBColorSpace and lets the GPU decode on sampling. The picture is the same either way;
// software GL (SwiftShader, which Chrome uses when there is no usable GPU) samples sRGB textures much
// slower (measured on the town view: 4.1 s vs 2.8 s a frame), so the default keeps the decode in the
// shader. Use keloPictureTexture(tex) on a picture you load, so it follows the switch. Data textures
// (normal, bump, depth, HDR) stay linear.
// Lighting happens in linear light, physically based (three's only mode since r155: light intensities
// in candela / lux-like units, point lights fade with decay 2 unless a light says otherwise), then the
// picture is tone mapped (ACES filmic) and written out as sRGB (renderer.outputColorSpace).
// Light colours are linear (as three.js always treats them). Fog is mixed into the finished sRGB picture,
// so the fog colour is an sRGB colour too (realism.js matches it to the sky behind it).

THREE.ColorManagement.enabled = false;
const KELO_GPU_DECODES_PICTURES = false;
const KELO_PICTURE_SPACE = KELO_GPU_DECODES_PICTURES ? THREE.SRGBColorSpace : THREE.NoColorSpace;

// Every canvas the game draws is a picture
THREE.CanvasTexture = class KeloCanvasTexture extends THREE.CanvasTexture {
  constructor(...args) {
    super(...args);
    this.colorSpace = KELO_PICTURE_SPACE;
  }
};

// Mark a texture as a picture (colour map) the way KELO_GPU_DECODES_PICTURES says; returns it
function keloPictureTexture(tex) {
      if (tex && tex.colorSpace !== KELO_PICTURE_SPACE) { tex.colorSpace = KELO_PICTURE_SPACE; tex.needsUpdate = true; }
      return tex;
    }

(function keloColourChunks() {
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
        ['#ifdef USE_COLOR_ALPHA\n\tvColor *= color;\n#elif defined( USE_COLOR )\n\tvColor.rgb *= color;\n#endif',
          '#ifdef USE_COLOR_ALPHA\n\tvColor *= color;\n\tvColor.rgb = keloToLinear( vColor.rgb );\n#elif defined( USE_COLOR )\n\tvColor.rgb *= color;\n\tvColor.rgb = keloToLinear( vColor.rgb );\n#endif'],
        ['vColor.rgb *= instanceColor.rgb;', 'vColor.rgb *= keloToLinear( instanceColor.rgb );']
      ];
      if (!KELO_GPU_DECODES_PICTURES) swaps.push(
        ['diffuseColor *= sampledDiffuseColor;', 'diffuseColor *= vec4( keloTexToLinear( sampledDiffuseColor.rgb ), sampledDiffuseColor.a );'],
        ['totalEmissiveRadiance *= emissiveColor.rgb;', 'totalEmissiveRadiance *= keloTexToLinear( emissiveColor.rgb );'],
        ['#ifdef USE_MAP\n\tdiffuseColor *= texture2D( map, uv );\n#endif', '#ifdef USE_MAP\n\tvec4 keloMapTexel = texture2D( map, uv );\n\tdiffuseColor *= vec4( keloTexToLinear( keloMapTexel.rgb ), keloMapTexel.a );\n#endif']
      );
      // Each swap must still find its place in this three.js version (a changed chunk fails loudly here)
      const all = Object.keys(C).filter(k => typeof C[k] === 'string').map(k => C[k]).join('\n') +
        Object.values(THREE.ShaderLib).map(l => l.vertexShader + l.fragmentShader).join('\n');
      swaps.forEach(([a]) => { if (!all.includes(a)) console.error('lighting.js: shader chunk changed, colour swap not applied:', a); });
      const patch = (s) => swaps.reduce((out, [a, b]) => out.split(a).join(b), s);
      Object.keys(C).forEach(k => { if (k !== 'common' && typeof C[k] === 'string') C[k] = patch(C[k]); });
      Object.values(THREE.ShaderLib).forEach(lib => {
        lib.vertexShader = patch(lib.vertexShader);
        lib.fragmentShader = patch(lib.fragmentShader);
      });
    })();

// --- Light, sky, haze and tone mapping ----------------------------------------------------------------
// realism.js reads these every time the hour, the weather or the season changes. `s` there is the sky
// state: s.day 0..1, s.dusk 0..1 (golden hour), s.night 0..1, s.overcast 0..1.
const KELO_LIGHTING = {
  toneMapping: 'ACESFilmicToneMapping',
  // Exposure: base + night * the dark adaptation + dusk * a touch for the golden hour
  exposure: { base: 0.6, night: 0.5, dusk: 0.1, start: 0.62 },
  // The sky shader (three's Sky, Preetham model), with the old r128 look kept: its gamma lift, a gain,
  // a faint blue at night, a grey drain when overcast. Sky clouds are off: the game draws its own.
  sky: {
    turbidity: [2.2, 3.5],      // [noon, + extra at dusk]
    rayleigh: [2.2, 1.0],
    mie: [0.003, 0.004],
    mieDirectionalG: 0.82,
    gain: 0.75,                 // keeps the sky blue overhead instead of washing out to white
    nightTint: [0.004, 0.007, 0.018],
    overcastGrey: 0.85
  },
  // The sun (one shadow-casting directional light that is the moon at night)
  sun: { intensity: 4.6, lowColour: [1.0, 0.62, 0.36], highColour: [1.0, 0.96, 0.91] },
  moon: { intensity: 0.36, colour: [0.55, 0.65, 0.95] },
  // Sky light from above and bounce from the grass below (the HDR environment does most of this)
  hemi: { sky: [0.55, 0.68, 0.9], ground: [0.22, 0.2, 0.14], base: 0.02, day: 0.12, night: 0.035 },
  // Image-based light from the HDR photos (assets/hdri): day, sunset and night gains
  envGains: [0.55, 0.5, 0.12],
  // Haze: exponential fog density
  fog: { base: 0.0042, dusk: 0.0022, night: 0.002, overcast: 0.0045, nightColour: 0x0d1422 },
  // Sun shadows
  shadow: { bias: -0.00025, normalBias: 0.035 },
  // Glow around bright lights (High only). The threshold is in linear light before tone mapping
  // (three r187's post-processing tone maps at the end, in OutputPass). 3.2 here is where ACES at the
  // day exposure reaches 0.88, r128's threshold on the tone-mapped picture, so the same things glow.
  bloom: { strength: 0.22, radius: 0.55, threshold: 3.2 },
  // Lamps (point lights). Intensities are candela; decay 2 is physically correct.
  lamps: {
    streetLamp: { intensity: 5, distance: 6, decay: 1 },
    forgeArc: { intensity: 6, decay: 1 },     // multiplies the arc's flicker (welding.js, scene.js)
    houseRoom: 10.5, housePorch: 7.7,          // his house's room lamp and porch lantern at full (house.js)
    upgradeScale: 5.5,                         // multiplies the strength of lamps he adds (upgrades.js)
    weldShop: 5                                // multiplies the weld studio's shop light (weldstudio.js)
  }
};

// The tone mapping constant for KELO_LIGHTING.toneMapping
function keloToneMapping() {
      return THREE[KELO_LIGHTING.toneMapping] !== undefined ? THREE[KELO_LIGHTING.toneMapping] : THREE.ACESFilmicToneMapping;
    }
