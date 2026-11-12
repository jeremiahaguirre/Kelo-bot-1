// Kelo-bot-1 — js/upgrades.js
// Loaded after printer.js. World upgrades Kelo-1 codes himself, SAFELY.
//
// He never runs generated JavaScript (no eval, no new Function, no script tags: the CSP forbids it
// and it would be a security hole). Instead he "codes" in a small JSON language (the upgrade DSL
// below) that this file interprets. Every upgrade is checked against UPGRADE_SCHEMA (types, ranges,
// enums, lengths, no unknown keys, no markup in strings), then against the world (never in town or
// on the buildings' grounds, part and particle caps, at most MAX_WORLD_UPGRADES).
//
// An upgrade can hold: parts (the same format buildCreationGroup in scene.js welds), lights, a sign,
// a path with lamps, a fence, ambient effects (fireflies, a fountain, wind chimes), behaviours from a
// whitelist (when: night | rain | near | schedule; do: glow | spin | sound | particles | open | close
// | rise | lower) and a named routine made of safe steps (walk, practise, water plants, visit...).
//
// He writes them at NetNode in a visible coding session (his diary shows the JSON as "code"), then
// walks over and unveils them. With an AI key the AI writes the JSON; without one his built-in brain
// fills in templates keyed to his interests. Saved in state.worldUpgrades (versioned); the owner can
// view the code, switch any upgrade off, or remove it, from the Brain tab.

const UPGRADE_DSL_VERSION = 1;
const MAX_WORLD_UPGRADES = 16;
const MAX_UPGRADE_JSON = 9000;
const MAX_UPGRADE_PARTICLES = 200;
const MAX_UPGRADE_POINT_LIGHTS = 6;   // across all upgrades: each point light costs every material
const UPGRADE_PACE_MS = 30 * 60 * 1000;
const UPGRADE_KINDS = ['structure', 'decoration', 'light', 'sign', 'path', 'fence', 'fountain', 'fireflies', 'chimes', 'routine'];
const UPGRADE_TRIGGERS = ['night', 'rain', 'near', 'schedule'];
const UPGRADE_ACTIONS = ['glow', 'spin', 'sound', 'particles', 'open', 'close', 'rise', 'lower'];
const UPGRADE_SOUNDS = ['chime', 'bell', 'water', 'hum'];
const UPGRADE_ROUTINE_STEPS = ['walk', 'visit', 'practise', 'hobby', 'waterPlants', 'stargaze', 'emote', 'say', 'wait'];
const UPGRADE_EMOTES = ['wave', 'cheer', 'dance', 'think', 'stretch', 'sit', 'celebrate'];

// Named places an upgrade can stand near (each is resolved to the nearest open spot outside town)
const UPGRADE_ANCHORS = {
  lake: { x: -22, z: 7.6, label: 'the lake shore' },
  meadow: { x: -22, z: -2, label: 'the West Meadow' },
  house: { x: -18, z: -8.8, label: 'my house' },
  museum: { x: -33, z: 3, label: 'the Museum' },
  mountain: { x: -28, z: -15, label: 'the mountain foot' },
  netnode: { x: 6.8, z: 8.4, label: 'the beach by NetNode' },
  workshop: { x: 2, z: -16, label: 'behind the workshop' }
};
const UPGRADE_PLACE_KEYS = [...Object.keys(UPGRADE_ANCHORS), 'here', 'open'];
// Where a routine may walk: the anchors, this upgrade itself, and the town's buildings
const UPGRADE_VISIT_PLACES = { museum: 'museum', storehouse: 'storehouse', post_office: 'post_office', netnode: 'cyber', cafe: 'cafe', bed: 'bed' };

// --- The schema -------------------------------------------------------------------------------
// A small JSON-schema: type, enum, min/max, minLength/maxLength, pattern, minItems/maxItems, items,
// props (anything else is rejected), required.
const UPG_SAFE_TEXT = /^[A-Za-z0-9 .,!?'’&:;()\-\/+#%]*$/;
const UPG_NUM = (min, max) => ({ type: 'number', min, max });
const UPG_INT = (min, max) => ({ type: 'integer', min, max });
const UPG_COLOR = { type: 'string', pattern: /^#[0-9a-fA-F]{6}$/ };
const UPG_TEXT = (max, min = 0) => ({ type: 'string', minLength: min, maxLength: max, pattern: UPG_SAFE_TEXT });
const UPG_POINTS = (dims, min, max, minItems, maxItems) => ({ type: 'array', minItems, maxItems, items: { type: 'array', minItems: dims, maxItems: dims, items: UPG_NUM(min, max) } });
const UPG_PART_SCHEMA = {
  type: 'object', required: ['shape'], props: {
    shape: { type: 'string', enum: VALID_PART_SHAPES },
    name: { type: 'string', maxLength: 20, pattern: /^[a-z0-9 _-]*$/i },
    x: UPG_NUM(-2.5, 2.5), y: UPG_NUM(0, 5), z: UPG_NUM(-2.5, 2.5),
    sx: UPG_NUM(0.02, 3), sy: UPG_NUM(0.02, 3), sz: UPG_NUM(0.02, 3),
    rx: UPG_NUM(-3.2, 3.2), ry: UPG_NUM(-3.2, 3.2), rz: UPG_NUM(-3.2, 3.2),
    color: UPG_COLOR, emissive: { type: 'boolean' }, spin: { type: 'boolean' },
    metalness: UPG_NUM(0, 1), roughness: UPG_NUM(0, 1),
    profile: UPG_POINTS(2, 0, 5, 2, 32), outline: UPG_POINTS(2, -2.5, 5, 3, 48), depth: UPG_NUM(0.02, 1.5),
    path: UPG_POINTS(3, -2.5, 5, 2, 24), radius: UPG_NUM(0.02, 0.5)
  }
};
const UPGRADE_SCHEMA = {
  type: 'object', required: ['dsl', 'name', 'kind'], props: {
    dsl: { type: 'integer', enum: [UPGRADE_DSL_VERSION] },
    name: UPG_TEXT(40, 2),
    kind: { type: 'string', enum: UPGRADE_KINDS },
    about: UPG_TEXT(160),
    place: { type: 'object', props: { near: { type: 'string', enum: UPGRADE_PLACE_KEYS }, x: UPG_NUM(WORLD_MIN_X, WORLD_MAX_X), z: UPG_NUM(WORLD_MIN_Z, WORLD_MAX_Z), facing: UPG_NUM(-3.2, 3.2) } },
    scale: UPG_NUM(0.3, 2.5),
    parts: { type: 'array', maxItems: MAX_SCULPTURE_PARTS, items: UPG_PART_SCHEMA },
    lights: { type: 'array', maxItems: 4, items: { type: 'object', props: { x: UPG_NUM(-2.5, 2.5), y: UPG_NUM(0, 6), z: UPG_NUM(-2.5, 2.5), color: UPG_COLOR, intensity: UPG_NUM(0, 3), range: UPG_NUM(1, 12), on: { type: 'string', enum: ['night', 'always'] } } } },
    sign: { type: 'object', required: ['text'], props: { text: { type: 'string', minLength: 1, maxLength: 28, pattern: /^[A-Za-z0-9 .,!?'&:\-]+$/ }, color: UPG_COLOR, textColor: UPG_COLOR } },
    path: { type: 'object', required: ['to'], props: { to: { type: 'string', enum: Object.keys(UPGRADE_ANCHORS) }, width: UPG_NUM(0.3, 2), color: UPG_COLOR, lamps: UPG_INT(0, 12), lampColor: UPG_COLOR } },
    fence: { type: 'object', props: { length: UPG_NUM(1, 20), height: UPG_NUM(0.4, 1.5), color: UPG_COLOR, facing: UPG_NUM(-3.2, 3.2) } },
    effects: { type: 'array', maxItems: 3, items: { type: 'object', required: ['type'], props: {
      type: { type: 'string', enum: ['fireflies', 'fountain', 'chimes'] }, count: UPG_INT(1, 60), rate: UPG_INT(1, 150),
      height: UPG_NUM(0.3, 3), spread: UPG_NUM(0.5, 8), color: UPG_COLOR, x: UPG_NUM(-2.5, 2.5), y: UPG_NUM(0, 5), z: UPG_NUM(-2.5, 2.5) } } },
    behaviours: { type: 'array', maxItems: 8, items: { type: 'object', required: ['when', 'do'], props: {
      when: { type: 'string', enum: UPGRADE_TRIGGERS }, every: UPG_INT(1, 1440), do: { type: 'string', enum: UPGRADE_ACTIONS },
      target: { type: ['string', 'integer'], maxLength: 20, pattern: /^[a-z0-9 _-]+$/i, min: 0, max: MAX_SCULPTURE_PARTS - 1 },
      amount: UPG_NUM(0, 2), speed: UPG_NUM(0, 3), sound: { type: 'string', enum: UPGRADE_SOUNDS } } } },
    routine: { type: 'object', required: ['name', 'steps'], props: {
      name: UPG_TEXT(40, 2), when: { type: 'string', enum: ['morning', 'afternoon', 'evening', 'night', 'any'] },
      steps: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'object', required: ['do'], props: {
        do: { type: 'string', enum: UPGRADE_ROUTINE_STEPS }, to: { type: 'string', enum: [...Object.keys(UPGRADE_ANCHORS), 'this', ...Object.keys(UPGRADE_VISIT_PLACES)] },
        name: { type: 'string', enum: UPGRADE_EMOTES }, text: UPG_TEXT(80), seconds: UPG_INT(1, 30) } } } } }
  }
};

// For the AI prompts: the language in a few lines
const UPGRADE_DSL_SUMMARY = `World upgrade DSL v${UPGRADE_DSL_VERSION} (JSON only, never JavaScript; anything else is rejected):
{"dsl":1, "name":"2-40 plain chars", "kind":"${UPGRADE_KINDS.join('|')}", "about":"1 sentence",
 "place":{"near":"${UPGRADE_PLACE_KEYS.join('|')}", "facing":-3.2..3.2} (always outside town; never x,z in town),
 "scale":0.3..2.5, "parts":[up to ${MAX_SCULPTURE_PARTS} parts in the SHAPES format, plus optional "name" so behaviours can target it],
 "lights":[up to 4 {"x","y","z","color":"#rrggbb","intensity":0..3,"range":1..12,"on":"night|always"}],
 "sign":{"text":"up to 28 letters","color","textColor"}, "path":{"to":"${Object.keys(UPGRADE_ANCHORS).join('|')}","width":0.3..2,"color","lamps":0..12,"lampColor"},
 "fence":{"length":1..20,"height":0.4..1.5,"color","facing"},
 "effects":[up to 3 {"type":"fireflies|fountain|chimes","count":1..60,"rate":1..150,"height":0.3..3,"spread":0.5..8,"color"}],
 "behaviours":[up to 8 {"when":"${UPGRADE_TRIGGERS.join('|')}","every":minutes (schedule),"do":"${UPGRADE_ACTIONS.join('|')}","target":"all|light|a part name|part index","amount":0..2,"speed":0..3,"sound":"${UPGRADE_SOUNDS.join('|')}"}],
 "routine":{"name","when":"morning|afternoon|evening|night|any","steps":[up to 8 {"do":"${UPGRADE_ROUTINE_STEPS.join('|')}","to":place or "this","name":emote,"text":"what he says","seconds":1..30}]}}`;

function upgradeSchemaCheck(value, schema, path, errors) {
      if (errors.length > 20) return;
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      const typeOf = v => (Array.isArray(v) ? 'array' : v === null ? 'null' : Number.isInteger(v) ? 'integer' : typeof v);
      const t = typeOf(value);
      const ok = types.some(ty => ty === t || (ty === 'number' && t === 'integer'));
      if (!ok || (t === 'number' && !Number.isFinite(value))) { errors.push(`${path}: should be ${types.join(' or ')}`); return; }
      if (schema.enum && !schema.enum.includes(value)) { errors.push(`${path}: "${String(value).slice(0, 30)}" is not one of the allowed values`); return; }
      if (t === 'number' || t === 'integer') {
        if (schema.min !== undefined && value < schema.min) errors.push(`${path}: ${value} is below ${schema.min}`);
        if (schema.max !== undefined && value > schema.max) errors.push(`${path}: ${value} is above ${schema.max}`);
      } else if (t === 'string') {
        if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: too short`);
        if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path}: longer than ${schema.maxLength} characters`);
        if (/[<>`{}\\]|javascript:|data:|on[a-z]+\s*=|&#/i.test(value)) errors.push(`${path}: contains markup or script`);
        else if (schema.pattern && !schema.pattern.test(value)) errors.push(`${path}: has characters that aren't allowed`);
      } else if (t === 'array') {
        if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: needs at least ${schema.minItems} items`);
        if (schema.maxItems !== undefined && value.length > schema.maxItems) { errors.push(`${path}: ${value.length} items is more than the limit of ${schema.maxItems}`); return; }
        if (schema.items) value.forEach((v, i) => upgradeSchemaCheck(v, schema.items, `${path}[${i}]`, errors));
      } else if (t === 'object') {
        const props = schema.props || {};
        Object.keys(value).forEach(k => {
          if (!props[k]) errors.push(`${path}.${String(k).slice(0, 20)}: unknown field`);
          else upgradeSchemaCheck(value[k], props[k], `${path}.${k}`, errors);
        });
        (schema.required || []).forEach(k => { if (value[k] === undefined) errors.push(`${path}.${k}: missing`); });
      }
    }

// Validate an upgrade: the schema, then the world. Returns { ok, code, errors }; code is a clean copy.
function validateWorldUpgrade(raw, { replacing = null } = {}) {
      const errors = [];
      let code = raw;
      if (typeof code === 'string') { try { code = JSON.parse(code); } catch (e) { return { ok: false, errors: ['not valid JSON'] }; } }
      if (!code || typeof code !== 'object' || Array.isArray(code)) return { ok: false, errors: ['an upgrade must be a JSON object'] };
      let size = 0;
      try { size = JSON.stringify(code).length; } catch (e) { return { ok: false, errors: ['could not read the JSON'] }; }
      if (size > MAX_UPGRADE_JSON) return { ok: false, errors: [`the code is ${size} characters, more than the limit of ${MAX_UPGRADE_JSON}`] };
      code = JSON.parse(JSON.stringify(code));
      if (code.behaviors && !code.behaviours) { code.behaviours = code.behaviors; delete code.behaviors; }
      if (code.dsl === undefined) code.dsl = UPGRADE_DSL_VERSION;
      upgradeSchemaCheck(code, UPGRADE_SCHEMA, 'upgrade', errors);
      if (errors.length) return { ok: false, errors };
      if (!['parts', 'lights', 'sign', 'path', 'fence', 'effects', 'routine'].some(k => code[k] && (!Array.isArray(code[k]) || code[k].length))) errors.push('upgrade: it has nothing to build or do');
      // Explicit spots must be open ground: never town, the buildings, the yard, the pit or the lake
      const pl = code.place || {};
      if ((pl.x === undefined) !== (pl.z === undefined)) errors.push('upgrade.place: give both x and z, or neither');
      if (pl.x !== undefined && pl.z !== undefined && typeof offLimits === 'function') {
        const blocked = offLimits(pl.x, pl.z, 1);
        if (blocked) errors.push(`upgrade.place: that spot is in ${blocked}, which is off limits`);
      }
      const names = new Set((code.parts || []).map(p => (p.name || '').toLowerCase()).filter(Boolean));
      (code.behaviours || []).forEach((b, i) => {
        const t = b.target;
        if (typeof t === 'number' && t >= (code.parts || []).length) errors.push(`upgrade.behaviours[${i}].target: there is no part ${t}`);
        if (typeof t === 'string' && !['all', 'light'].includes(t.toLowerCase()) && !names.has(t.toLowerCase())) errors.push(`upgrade.behaviours[${i}].target: no part is named "${t}"`);
        if (b.when === 'schedule' && !b.every) errors.push(`upgrade.behaviours[${i}].every: a schedule needs "every" (minutes)`);
        if (b.do === 'sound' && !b.sound) b.sound = 'chime';
      });
      const particles = (code.effects || []).reduce((s, e) => s + (e.type === 'fountain' ? (e.rate || 60) : e.type === 'fireflies' ? (e.count || 24) : 0), 0);
      if (particles > MAX_UPGRADE_PARTICLES) errors.push(`upgrade.effects: ${particles} particles is more than the limit of ${MAX_UPGRADE_PARTICLES}`);
      const list = state.worldUpgrades || [];
      const same = list.find(u => u.name.toLowerCase() === code.name.toLowerCase());
      if (!same && !replacing && list.length >= MAX_WORLD_UPGRADES) errors.push(`upgrade: his world already has ${MAX_WORLD_UPGRADES} upgrades, the most it can hold`);
      return errors.length ? { ok: false, errors } : { ok: true, code };
    }

// --- Where it goes ----------------------------------------------------------------------------
function upgradeSpotOk(x, z, pad) {
      if (x < WORLD_MIN_X + 3 || x > WORLD_MAX_X - 3 || z < WORLD_MIN_Z + 3 || z > 9) return false;
      if (typeof offLimits === 'function' && offLimits(x, z, pad)) return false;
      if (typeof pointBlocked === 'function' && pointBlocked(x, z, { x: 999, z: 999 })) return false;
      if ((state.worldUpgrades || []).some(u => u.enabled !== false && Math.hypot(u.x - x, u.z - z) < 3.2)) return false;
      if (typeof getAnalyticalGroundHeight === 'function') {
        const slope = Math.abs(getAnalyticalGroundHeight(x + 1, z) - getAnalyticalGroundHeight(x - 1, z)) + Math.abs(getAnalyticalGroundHeight(x, z + 1) - getAnalyticalGroundHeight(x, z - 1));
        if (slope > 1.6) return false;
      }
      return true;
    }

// The nearest open spot to an anchor, rings outward
function upgradeSpotNear(anchor, pad = 1.5) {
      for (let r = 0; r <= 24; r += 1) {
        const steps = r === 0 ? 1 : Math.max(8, Math.round(r * 4));
        for (let i = 0; i < steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          const x = anchor.x + Math.cos(a) * r, z = anchor.z + Math.sin(a) * r;
          if (upgradeSpotOk(x, z, pad)) return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 };
        }
      }
      return null;
    }

function upgradeAnchor(key) {
      if (key === 'here') return { x: state.botPos.x, z: state.botPos.z };
      return UPGRADE_ANCHORS[key] || null;
    }

function placeForUpgrade(code) {
      const pl = code.place || {};
      if (pl.x !== undefined && pl.z !== undefined) return { x: pl.x, z: pl.z };
      const pad = 1 + (code.scale || 1) * 0.8;
      const anchor = upgradeAnchor(pl.near);
      const spot = anchor ? upgradeSpotNear(anchor, pad) : null;
      return spot || (typeof openGroundSpot === 'function' ? openGroundSpot(pad) : null);
    }

// --- Building it in 3D --------------------------------------------------------------------------
let worldUpgradesGroup = null;
const upgradeBuilt = new Map();   // id -> { group, rec, meshes, lights, effects, behaviours, obstacle }
let upgradePointLights = 0;

function upgradeMat(color, opts = {}) {
      return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: opts.roughness ?? 0.8, metalness: opts.metalness ?? 0.05,
        emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000), emissiveIntensity: opts.emissive ? (opts.ei ?? 0.6) : 0,
        transparent: Boolean(opts.opacity), opacity: opts.opacity ?? 1 });
    }

function upgradeLightScale() {
      return typeof renderer !== 'undefined' && renderer && renderer.physicallyCorrectLights ? 5.5 : 1;
    }

// A lamp: a bulb that glows, plus a real point light while the budget allows
function addUpgradeLamp(parent, b, spec) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), upgradeMat(spec.color || '#ffd27a', { emissive: spec.color || '#ffd27a', ei: 0.2 }));
      bulb.position.set(spec.x || 0, spec.y ?? 1.6, spec.z || 0);
      parent.add(bulb);
      let light = null;
      if (upgradePointLights < MAX_UPGRADE_POINT_LIGHTS) {
        light = new THREE.PointLight(new THREE.Color(spec.color || '#ffd27a'), 0, spec.range || 6, 2);
        light.position.copy(bulb.position);
        parent.add(light);
        upgradePointLights++;
      }
      b.lights.push({ bulb, light, base: (spec.intensity ?? 1.2), on: spec.on || 'night' });
    }

function upgradeGround(x, z) {
      return typeof getIslandGroundHeight === 'function' ? getIslandGroundHeight(x, z) : (typeof getAnalyticalGroundHeight === 'function' ? getAnalyticalGroundHeight(x, z) : 0);
    }

// A word sign drawn on a canvas (text only, never HTML)
function upgradeSignTexture(text, bg, fg) {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 160;
      const ctx = c.getContext('2d');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 160);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, 502, 150);
      ctx.fillStyle = fg;
      let size = 76;
      ctx.font = `bold ${size}px Georgia, serif`;
      while (ctx.measureText(text).width > 360 && size > 20) { size -= 4; ctx.font = `bold ${size}px Georgia, serif`; }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, 256, 84);
      const tex = new THREE.CanvasTexture(c);
      if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
      return tex;
    }

function particlePoints(n, color, size) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const mat = new THREE.PointsMaterial({ color: new THREE.Color(color), size, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      return pts;
    }

function buildUpgradeEffect(group, b, e) {
      const at = new THREE.Vector3(e.x || 0, e.y ?? 0, e.z || 0);
      if (e.type === 'fireflies') {
        const n = e.count || 24;
        const pts = particlePoints(n, e.color || '#fff59a', 0.14);
        const seeds = Array.from({ length: n }, () => [Math.random() * 6.28, Math.random() * 6.28, 0.4 + Math.random() * 1.8, Math.random()]);
        group.add(pts);
        b.effects.push({ type: 'fireflies', pts, seeds, spread: e.spread || 3, at });
      } else if (e.type === 'fountain') {
        const n = e.rate || 60;
        const pts = particlePoints(n, e.color || '#bfe6ff', 0.09);
        pts.material.blending = THREE.NormalBlending;
        pts.material.opacity = 0.75;
        const seeds = Array.from({ length: n }, (_, i) => [i / n, Math.random() * 6.28, 0.6 + Math.random() * 0.4]);
        group.add(pts);
        b.effects.push({ type: 'fountain', pts, seeds, height: e.height || 1.4, at });
      } else if (e.type === 'chimes') {
        const n = Math.min(8, e.count || 5);
        const holder = new THREE.Group();
        holder.position.set(at.x, (e.y ?? 2.2), at.z);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 16), upgradeMat('#8b5a2b'));
        holder.add(top);
        const tubes = [];
        for (let i = 0; i < n; i++) {
          const len = 0.35 + i * 0.07;
          const pivot = new THREE.Group();
          const a = (i / n) * Math.PI * 2;
          pivot.position.set(Math.cos(a) * 0.24, -0.03, Math.sin(a) * 0.24);
          const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 8), upgradeMat(e.color || '#c9d2dc', { metalness: 0.9, roughness: 0.25 }));
          tube.position.y = -len / 2 - 0.08;
          pivot.add(tube);
          holder.add(pivot);
          tubes.push({ pivot, phase: Math.random() * 6.28 });
        }
        group.add(holder);
        b.effects.push({ type: 'chimes', holder, tubes, lastRing: 0 });
      }
    }

function buildUpgradePath(b, rec) {
      const code = rec.code, p = code.path;
      const to = UPGRADE_ANCHORS[p.to];
      if (!to) return;
      const from = { x: rec.x, z: rec.z };
      const len = Math.min(30, Math.hypot(to.x - from.x, to.z - from.z));
      if (len < 1) return;
      const dx = (to.x - from.x) / Math.hypot(to.x - from.x, to.z - from.z), dz = (to.z - from.z) / Math.hypot(to.x - from.x, to.z - from.z);
      const stoneMat = upgradeMat(p.color || '#b8a98a', { roughness: 0.95 });
      const w = p.width || 0.8;
      const lamps = p.lamps || 0;
      const lampEvery = lamps ? len / lamps : Infinity;
      const pathGroup = new THREE.Group();
      let nextLamp = lampEvery / 2;
      for (let d = 0; d <= len; d += 0.7) {
        const x = from.x + dx * d, z = from.z + dz * d;
        if (typeof offLimits === 'function' && offLimits(x, z, 0)) continue;
        const stone = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.45, w * 0.5, 0.06, 7), stoneMat);
        stone.position.set(x - rec.x + (Math.random() - 0.5) * 0.12, upgradeGround(x, z) - b.groundY + 0.03, z - rec.z + (Math.random() - 0.5) * 0.12);
        stone.rotation.y = Math.random() * 3;
        stone.receiveShadow = true;
        pathGroup.add(stone);
        if (d >= nextLamp) {
          nextLamp += lampEvery;
          const side = (Math.round(d / lampEvery) % 2 ? 1 : -1) * (w * 0.5 + 0.35);
          const lx = x - dz * side, lz = z + dx * side;
          if (typeof offLimits === 'function' && offLimits(lx, lz, 0)) continue;
          const post = new THREE.Group();
          post.position.set(lx - rec.x, upgradeGround(lx, lz) - b.groundY, lz - rec.z);
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.3, 8), upgradeMat('#2f2a26', { metalness: 0.6, roughness: 0.4 }));
          pole.position.y = 0.65;
          const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.26, 6, 1, true), upgradeMat('#2f2a26', { metalness: 0.6, roughness: 0.4 }));
          cage.position.y = 1.42;
          post.add(pole, cage);
          pathGroup.add(post);
          addUpgradeLamp(post, b, { y: 1.42, color: p.lampColor || '#ffcf73', intensity: 1, range: 5 });
        }
      }
      // The path lies in world space: undo the group's rotation and scale for it
      b.flatGroup.add(pathGroup);
    }

function buildUpgradeFence(b, f) {
      const g = new THREE.Group();
      const len = f.length || 4, h = f.height || 0.8;
      const mat = upgradeMat(f.color || '#8b6b4a', { roughness: 0.9 });
      const posts = Math.max(2, Math.round(len / 1.1) + 1);
      for (let i = 0; i < posts; i++) {
        const x = -len / 2 + (i / (posts - 1)) * len;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, h + 0.1, 0.1), mat);
        post.position.set(x, (h + 0.1) / 2, 0);
        post.castShadow = true;
        g.add(post);
      }
      [0.35, 0.8].forEach(k => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.05), mat);
        rail.position.set(0, h * k, 0);
        g.add(rail);
      });
      g.rotation.y = f.facing || 0;
      g.position.z = 1.6;
      return g;
    }

function buildWorldUpgrade3D(rec) {
      if (typeof scene === 'undefined' || !scene || typeof THREE === 'undefined') return null;
      if (!worldUpgradesGroup) { worldUpgradesGroup = new THREE.Group(); worldUpgradesGroup.name = 'worldUpgrades'; scene.add(worldUpgradesGroup); }
      removeWorldUpgrade3D(rec.id);
      const code = rec.code;
      const groundY = upgradeGround(rec.x, rec.z);
      const root = new THREE.Group();
      root.position.set(rec.x, groundY, rec.z);
      root.userData.upgradeId = rec.id;
      const group = new THREE.Group();        // scaled and turned
      group.rotation.y = (code.place && code.place.facing) || 0;
      group.scale.setScalar(code.scale || 1);
      const flatGroup = new THREE.Group();    // paths, in plain world offsets
      root.add(group, flatGroup);
      const b = { root, group, flatGroup, rec, groundY, meshes: [], lights: [], effects: [], behaviours: [], bursts: [], unveil: null, obstacle: null };
      if (code.parts && code.parts.length) {
        // No title: the parts keep the colours, roughness and metalness he wrote (no welded-metal finish)
        const parts = buildCreationGroup({ parts: code.parts, colorHex: (code.parts[0] && code.parts[0].color) || '#94a3b8' });
        group.add(parts);
        b.meshes = parts.children.filter(c => c.userData && c.userData.part);
        b.meshes.forEach((m, i) => {
          m.userData.upgradeBase = { y: m.position.y, ry: m.rotation.y, ei: m.material ? m.material.emissiveIntensity || 0 : 0, name: (code.parts[i] && code.parts[i].name || '').toLowerCase() };
          if (m.material && !m.material.emissive) m.material.emissive = new THREE.Color(0x000000);
        });
      }
      (code.lights || []).forEach(l => addUpgradeLamp(group, b, l));
      if (code.sign) {
        const s = new THREE.Group();
        const wood = upgradeMat('#6b4a2f', { roughness: 0.9 });
        [-0.62, 0.62].forEach(x => { const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.1), wood); post.position.set(x, 0.75, 0); post.castShadow = true; s.add(post); });
        const tex = upgradeSignTexture(code.sign.text, code.sign.color || '#e9d8b4', code.sign.textColor || '#3b2a1a');
        const board = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.48, 0.06), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })]);
        board.position.y = 1.2;
        board.castShadow = true;
        s.add(board);
        if (code.parts && code.parts.length) s.position.x = 1.6;
        group.add(s);
      }
      if (code.fence) group.add(buildUpgradeFence(b, code.fence));
      (code.effects || []).forEach(e => buildUpgradeEffect(group, b, e));
      if (code.path) buildUpgradePath(b, rec);
      b.behaviours = (code.behaviours || []).map(x => ({ spec: x, level: 0, active: false, lastFire: 0, lastSound: 0 }));
      root.traverse(o => { if (o.isMesh && o.userData && o.userData.part) o.castShadow = true; });
      worldUpgradesGroup.add(root);
      if (code.parts && code.parts.length && typeof worldObstacles !== 'undefined') {
        b.obstacle = { x: rec.x, z: rec.z, r: 0.9 * (code.scale || 1) };
        worldObstacles.push(b.obstacle);
      }
      upgradeBuilt.set(rec.id, b);
      return b;
    }

function removeWorldUpgrade3D(id) {
      const b = upgradeBuilt.get(id);
      if (!b) return;
      b.lights.forEach(l => { if (l.light) upgradePointLights = Math.max(0, upgradePointLights - 1); });
      if (worldUpgradesGroup) worldUpgradesGroup.remove(b.root);
      b.root.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
        mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      });
      if (b.obstacle && typeof worldObstacles !== 'undefined') {
        const i = worldObstacles.indexOf(b.obstacle);
        if (i >= 0) worldObstacles.splice(i, 1);
      }
      upgradeBuilt.delete(id);
    }

function rebuildWorldUpgrades() {
      if (!Array.isArray(state.worldUpgrades)) state.worldUpgrades = [];
      state.worldUpgrades.forEach(rec => {
        // Checked again on every load, in case the saved copy was edited by hand
        const v = validateWorldUpgrade(rec.code, { replacing: rec });
        rec.broken = !v.ok;
        if (v.ok && rec.enabled !== false) { try { buildWorldUpgrade3D(rec); } catch (e) { console.warn('Could not build upgrade', rec.name, e); } }
      });
    }

// --- Every frame (from updateWishFeatures in js/wishfeatures.js) ---------------------------------
let upgradeLastT = null;

function upgradeTriggerActive(b, spec, now, env) {
      if (spec.when === 'night') return env.night;
      if (spec.when === 'rain') return env.rain;
      if (spec.when === 'near') return Math.hypot(state.botPos.x - b.rec.x, state.botPos.z - b.rec.z) < 4.5;
      if (spec.when === 'schedule') {
        const every = Math.max(1, spec.every || 30) * 60000;
        return (now % every) < 12000; // on for 12 seconds each time
      }
      return false;
    }

function upgradeTargets(b, target) {
      if (target === undefined || target === null || target === 'all') return b.meshes;
      if (typeof target === 'number') return b.meshes[target] ? [b.meshes[target]] : [];
      const t = String(target).toLowerCase();
      if (t === 'light') return b.lights.map(l => l.bulb);
      return b.meshes.filter(m => m.userData.upgradeBase.name === t);
    }

function upgradeBurst(b, color = '#fff2b0') {
      if (b.bursts.length > 3) return;
      const n = 24;
      const pts = particlePoints(n, color, 0.1);
      const vel = Array.from({ length: n }, () => [(Math.random() - 0.5) * 1.6, 1 + Math.random() * 1.6, (Math.random() - 0.5) * 1.6]);
      pts.position.y = 1.2;
      b.group.add(pts);
      b.bursts.push({ pts, vel, age: 0 });
    }

function updateWorldUpgrades(t) {
      if (!upgradeBuilt.size) return;
      const dt = upgradeLastT === null ? 0.016 : Math.min(0.1, Math.max(0, t - upgradeLastT));
      upgradeLastT = t;
      const now = Date.now();
      const w = typeof worldNow === 'function' ? worldNow() : { isNight: false };
      const env = { night: Boolean(w.isNight), rain: typeof isRaining === 'function' ? Boolean(isRaining()) : false };
      const ls = upgradeLightScale();
      upgradeBuilt.forEach(b => {
        // The unveiling: it grows out of a burst of sparkles
        if (b.unveil) {
          b.unveil.age += dt;
          const k = Math.min(1, b.unveil.age / 2.2);
          const e = 1 - Math.pow(1 - k, 3);
          b.root.scale.setScalar(Math.max(0.01, e * (1 + Math.sin(k * Math.PI) * 0.12)));
          if (k >= 1) { b.root.scale.setScalar(1); b.unveil = null; }
        }
        // Behaviours ease in and out
        const glowBoost = new Map();
        let lightBoost = 0;
        b.behaviours.forEach(bh => {
          const active = upgradeTriggerActive(b, bh.spec, now, env);
          if (active && !bh.active) {
            if (bh.spec.do === 'sound' && now - bh.lastSound > 8000) { bh.lastSound = now; upgradeSound(bh.spec.sound || 'chime', b); }
            if (bh.spec.do === 'particles') upgradeBurst(b);
          }
          if (active && bh.spec.do === 'particles' && now - bh.lastFire > 2500) { bh.lastFire = now; upgradeBurst(b); }
          bh.active = active;
          bh.level += ((active ? 1 : 0) - bh.level) * Math.min(1, dt * 2.5);
          const lvl = bh.level;
          const targets = upgradeTargets(b, bh.spec.target);
          const amt = bh.spec.amount ?? 1;
          if (bh.spec.do === 'glow') {
            targets.forEach(m => glowBoost.set(m, Math.max(glowBoost.get(m) || 0, lvl)));
            if (bh.spec.target === 'light' || bh.spec.target === undefined || bh.spec.target === 'all') lightBoost = Math.max(lightBoost, lvl);
          } else if (bh.spec.do === 'spin') {
            targets.forEach(m => { m.rotation.y += (bh.spec.speed || 1) * lvl * dt; });
          } else if (bh.spec.do === 'open' || bh.spec.do === 'close') {
            const open = bh.spec.do === 'open' ? lvl : 1 - lvl;
            targets.forEach(m => { m.rotation.y = m.userData.upgradeBase.ry + open * 1.4 * Math.max(0.2, amt); });
          } else if (bh.spec.do === 'rise' || bh.spec.do === 'lower') {
            const dir = bh.spec.do === 'rise' ? 1 : -1;
            targets.forEach(m => { m.position.y = Math.max(0, m.userData.upgradeBase.y + dir * lvl * Math.min(2, amt)); });
          }
        });
        b.meshes.forEach(m => {
          if (!m.material || !m.material.emissive) return;
          const boost = glowBoost.get(m) || 0;
          const base = m.userData.upgradeBase.ei;
          if (boost > 0.001 || m.userData.upgradeGlowing) {
            if (boost > 0.001 && m.material.emissive.getHex() === 0) m.material.emissive.copy(m.material.color);
            m.material.emissiveIntensity = base + boost * 1.1;
            m.userData.upgradeGlowing = boost > 0.001;
          }
        });
        // Lamps: on at night (or always), brighter with a glow behaviour
        b.lights.forEach(l => {
          const on = Math.max(l.on === 'always' || env.night ? 1 : 0.0, lightBoost);
          const want = on * (l.base || 1);
          l.cur = (l.cur ?? 0) + (want - (l.cur ?? 0)) * Math.min(1, dt * 2);
          l.bulb.material.emissiveIntensity = 0.15 + l.cur * 1.4;
          if (l.light) l.light.intensity = l.cur * ls;
        });
        // Effects
        b.effects.forEach(e => {
          if (e.type === 'fireflies') {
            const arr = e.pts.geometry.attributes.position.array;
            e.seeds.forEach((s, i) => {
              arr[i * 3] = e.at.x + Math.sin(t * 0.4 + s[0]) * e.spread * (0.4 + s[3] * 0.6);
              arr[i * 3 + 1] = e.at.y + s[2] + Math.sin(t * 0.9 + s[1]) * 0.3;
              arr[i * 3 + 2] = e.at.z + Math.cos(t * 0.33 + s[1]) * e.spread * (0.4 + s[3] * 0.6);
            });
            e.pts.geometry.attributes.position.needsUpdate = true;
            e.pts.material.opacity = (env.night ? 0.95 : 0.25) * (0.6 + 0.4 * Math.sin(t * 3));
          } else if (e.type === 'fountain') {
            const arr = e.pts.geometry.attributes.position.array;
            e.seeds.forEach((s, i) => {
              const life = ((t * 0.7 * s[2]) + s[0]) % 1;
              const r = life * 0.55;
              arr[i * 3] = e.at.x + Math.cos(s[1]) * r;
              arr[i * 3 + 1] = e.at.y + 4 * e.height * life * (1 - life) + 0.25;
              arr[i * 3 + 2] = e.at.z + Math.sin(s[1]) * r;
            });
            e.pts.geometry.attributes.position.needsUpdate = true;
          } else if (e.type === 'chimes') {
            const wind = typeof windNow === 'function' ? Math.min(1.5, (windNow().strength || 0) * 1.5) : 0.4;
            e.tubes.forEach(tb => { tb.pivot.rotation.z = Math.sin(t * 2.1 + tb.phase) * 0.12 * (0.3 + wind); tb.pivot.rotation.x = Math.cos(t * 1.7 + tb.phase) * 0.1 * (0.3 + wind); });
            const near = Math.hypot(state.botPos.x - b.rec.x, state.botPos.z - b.rec.z) < 8;
            if (near && now - e.lastRing > 9000 && Math.random() < dt * 0.4) { e.lastRing = now; upgradeSound('chime', b); }
          }
        });
        // Sparkle bursts
        b.bursts = b.bursts.filter(burst => {
          burst.age += dt;
          const arr = burst.pts.geometry.attributes.position.array;
          burst.vel.forEach((v, i) => {
            arr[i * 3] = v[0] * burst.age; arr[i * 3 + 1] = v[1] * burst.age - 1.2 * burst.age * burst.age; arr[i * 3 + 2] = v[2] * burst.age;
          });
          burst.pts.geometry.attributes.position.needsUpdate = true;
          burst.pts.material.opacity = Math.max(0, 1 - burst.age / 1.6);
          if (burst.age > 1.6) { b.group.remove(burst.pts); burst.pts.geometry.dispose(); burst.pts.material.dispose(); return false; }
          return true;
        });
      });
    }

// --- Sounds, through the WebAudio pastimes.js already uses (silent when muted) -------------------
let upgradeAudio = null;
function upgradeAudioCtx() {
      if (state.soundMuted) return null;
      if (typeof pastimeAudioCtx === 'function') return pastimeAudioCtx();
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!upgradeAudio) { try { upgradeAudio = new AC(); } catch (e) { return null; } }
      return upgradeAudio;
    }

function upgradeSound(kind, b) {
      const ctx = upgradeAudioCtx();
      if (!ctx || ctx.state !== 'running') return;
      // Quieter the further he (and the camera's attention) is from it
      const d = b ? Math.hypot(state.botPos.x - b.rec.x, state.botPos.z - b.rec.z) : 0;
      const vol = Math.max(0.15, 1 - d / 20) * 0.08;
      const now = ctx.currentTime;
      const note = (freq, at, dur, type = 'sine', g = vol) => {
        const o = ctx.createOscillator(), gn = ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, at);
        gn.gain.setValueAtTime(0.0001, at);
        gn.gain.exponentialRampToValueAtTime(g, at + 0.01);
        gn.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        o.connect(gn); gn.connect(ctx.destination);
        o.start(at); o.stop(at + dur + 0.05);
      };
      try {
        if (kind === 'chime') { const scale = [784, 880, 988, 1175, 1319]; for (let i = 0; i < 3; i++) note(scale[Math.floor(Math.random() * scale.length)], now + i * 0.22, 2.2); }
        else if (kind === 'bell') { note(523, now, 2.8); note(1046, now, 1.6, 'sine', vol * 0.4); note(1568, now, 0.9, 'sine', vol * 0.2); }
        else if (kind === 'hum') note(110, now, 1.6, 'triangle', vol * 0.8);
        else if (kind === 'water') {
          const len = Math.floor(ctx.sampleRate * 1.2);
          const buf = ctx.createBuffer(1, len, ctx.sampleRate);
          const data = buf.getChannelData(0);
          for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
          const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
          src.buffer = buf; f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.8; gn.gain.value = vol * 0.9;
          src.connect(f); f.connect(gn); gn.connect(ctx.destination);
          src.start(now);
        }
      } catch (e) {}
    }

// --- Installing, toggling, removing -------------------------------------------------------------
function upgradeLogEntry(entry) {
      if (!Array.isArray(state.upgradeLog)) state.upgradeLog = [];
      state.upgradeLog.unshift({ at: Date.now(), ...entry });
      if (state.upgradeLog.length > 12) state.upgradeLog.length = 12;
    }

// Validate and add (or replace, as a new version) an upgrade. Returns { ok, rec, errors }.
function installWorldUpgrade(raw, { by = 'brain', template = null, unveil = true } = {}) {
      if (!Array.isArray(state.worldUpgrades)) state.worldUpgrades = [];
      const v = validateWorldUpgrade(raw);
      const name = raw && typeof raw === 'object' && typeof raw.name === 'string' ? raw.name.slice(0, 40) : 'an upgrade';
      if (!v.ok) {
        upgradeLogEntry({ name, ok: false, by, errors: v.errors.slice(0, 4) });
        return { ok: false, errors: v.errors };
      }
      const code = v.code;
      const prev = state.worldUpgrades.find(u => u.name.toLowerCase() === code.name.toLowerCase());
      if (prev) { prev.enabled = true; }
      const spot = prev ? { x: prev.x, z: prev.z } : placeForUpgrade(code);
      if (!spot) { upgradeLogEntry({ name, ok: false, by, errors: ['no open ground left near that place'] }); return { ok: false, errors: ['no open ground left near that place'] }; }
      const rec = prev || { id: 'upg-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1000), at: Date.now(), version: 0 };
      Object.assign(rec, { name: code.name, kind: code.kind, about: code.about || '', by, template: template || rec.template || null, x: spot.x, z: spot.z, enabled: true, code, version: (rec.version || 0) + 1, updatedAt: Date.now(), broken: false });
      if (!prev) state.worldUpgrades.push(rec);
      state.lastUpgradeAt = Date.now();
      upgradeLogEntry({ name: rec.name, ok: true, by, version: rec.version });
      const b = buildWorldUpgrade3D(rec);
      if (b && unveil) { b.unveil = { age: 0 }; b.root.scale.setScalar(0.01); upgradeBurst(b, '#c4b5fd'); upgradeBurst(b); }
      savePersistentBrainState();
      if (typeof renderAllUI === 'function') renderAllUI();
      return { ok: true, rec };
    }

function setWorldUpgradeEnabled(id, on) {
      const rec = (state.worldUpgrades || []).find(u => u.id === id);
      if (!rec) return false;
      rec.enabled = Boolean(on);
      if (rec.enabled && !rec.broken) buildWorldUpgrade3D(rec); else removeWorldUpgrade3D(id);
      showToast(rec.enabled ? `✨ Switched on: ${rec.name}` : `⏸️ Switched off: ${rec.name}`);
      savePersistentBrainState();
      renderAllUI();
      return true;
    }

function removeWorldUpgrade(id) {
      const i = (state.worldUpgrades || []).findIndex(u => u.id === id);
      if (i < 0) return false;
      const rec = state.worldUpgrades[i];
      removeWorldUpgrade3D(id);
      state.worldUpgrades.splice(i, 1);
      state.diaryEntries.unshift({
        time: 'An Upgrade Was Removed', location: currentPlaceLabel(), mood: '🧹 One of my upgrades is gone',
        vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, my human took out ${rec.name}, the upgrade I coded. That's alright. It's their world too, and I learned a lot writing it.`
      });
      showToast(`🧹 Removed: ${rec.name}`);
      savePersistentBrainState();
      renderAllUI();
      return true;
    }

// --- His built-in brain: templates keyed to his interests --------------------------------------
function upgradeInterest(re) {
      const hay = [
        ...(state.webHistory || []).slice(0, 20).map(w => w.query),
        ...(state.concepts || []).slice(0, 12).map(c => `${c.name} ${c.definition || ''}`),
        ...(state.hobbies || []).map(h => `${h.name} ${h.style || ''}`),
        ...(state.likes || []).slice(0, 12).map(l => l.topic),
        ...(typeof ownedItemNames === 'function' ? ownedItemNames() : [])
      ].join(' | ');
      return (hay.match(new RegExp(re.source, 'gi')) || []).length;
    }

const UPGRADE_TEMPLATES = [
  { key: 'lantern_path', score: () => 1 + (state.knowsLakeDanger ? 2 : 0) + upgradeInterest(/lake|water|boat|night|light|lantern|walk/), build: () => ({
    dsl: 1, name: 'Lantern Path to the Lake', kind: 'path', about: 'Little lanterns that light my way from the meadow down to the lake at night.',
    place: { near: 'meadow' }, path: { to: 'lake', width: 0.8, color: '#b9a57f', lamps: 6, lampColor: '#ffc964' },
    behaviours: [{ when: 'night', do: 'glow', target: 'light' }],
    routine: { name: 'Evening lantern walk', when: 'evening', steps: [{ do: 'walk', to: 'this' }, { do: 'say', text: 'The lanterns are coming on. Time for my walk.' }, { do: 'walk', to: 'lake' }, { do: 'emote', name: 'sit' }, { do: 'wait', seconds: 8 }] }
  }) },
  { key: 'bird_bath', score: () => 1 + (typeof featureOn === 'function' && featureOn('wildlife') ? 3 : 0) + upgradeInterest(/bird|feather|wildlife|garden/), build: () => ({
    dsl: 1, name: 'Bird Bath', kind: 'decoration', about: 'A stone bird bath so the birds have somewhere to drink and splash.',
    place: { near: 'meadow' },
    parts: [
      { shape: 'lathe', name: 'pedestal', profile: [[0.32, 0], [0.22, 0.12], [0.12, 0.3], [0.1, 0.75], [0.16, 0.85]], color: '#a8a29e', roughness: 0.95, metalness: 0 },
      { shape: 'lathe', name: 'bowl', y: 0.85, profile: [[0.05, 0], [0.45, 0.04], [0.62, 0.16], [0.64, 0.22]], color: '#b8b2aa', roughness: 0.9, metalness: 0 },
      { shape: 'cylinder', name: 'water', y: 1.02, sx: 1.45, sy: 0.02, sz: 1.45, color: '#7dd3fc', roughness: 0.05, metalness: 0.2 },
      { shape: 'sphere', name: 'bird', x: 0.5, y: 1.12, sx: 0.16, color: '#c2410c', roughness: 0.7, metalness: 0 },
      { shape: 'cone', x: 0.62, y: 1.14, sx: 0.06, sy: 0.1, rz: -1.57, color: '#facc15', roughness: 0.6, metalness: 0 }
    ],
    behaviours: [{ when: 'near', do: 'particles' }, { when: 'near', do: 'sound', sound: 'water' }, { when: 'schedule', every: 5, do: 'rise', target: 'bird', amount: 0.25 }]
  }) },
  { key: 'sundial', score: () => 1 + upgradeInterest(/time|sun|clock|hour|season|day/), build: () => ({
    dsl: 1, name: 'Sundial', kind: 'structure', about: 'A sundial so I can tell the time from the sun, and a bell that rings the hours.',
    place: { near: 'meadow' },
    parts: [
      { shape: 'cylinder', name: 'base', y: 0.25, sx: 1.6, sy: 0.5, sz: 1.6, color: '#d6d3d1', roughness: 0.95, metalness: 0 },
      { shape: 'cylinder', name: 'dial', y: 0.53, sx: 2.2, sy: 0.06, sz: 2.2, color: '#b45309', roughness: 0.35, metalness: 0.8 },
      { shape: 'extrude', name: 'gnomon', y: 0.56, outline: [[-0.5, 0], [0.5, 0], [-0.5, 0.6]], depth: 0.04, color: '#92400e', roughness: 0.3, metalness: 0.85 },
      { shape: 'torus', y: 0.57, rx: 1.57, sx: 1.7, sy: 0.3, color: '#78350f', roughness: 0.4, metalness: 0.8 }
    ],
    behaviours: [{ when: 'schedule', every: 30, do: 'sound', sound: 'bell' }, { when: 'schedule', every: 30, do: 'glow', target: 'dial' }]
  }) },
  { key: 'observatory', score: () => 1 + (typeof ownsSomething === 'function' && ownsSomething(/telescope/i) ? 4 : 0) + upgradeInterest(/star|planet|moon|sky|astronom|constellation|telescope/), build: () => ({
    dsl: 1, name: 'Little Observatory', kind: 'structure', about: 'A small domed observatory whose shutter opens at night so I can watch the stars.',
    place: { near: 'mountain' }, scale: 1.3,
    parts: [
      { shape: 'cylinder', name: 'walls', y: 0.6, sx: 3, sy: 1.2, sz: 3, color: '#e7e5e4', roughness: 0.8, metalness: 0.1 },
      { shape: 'lathe', name: 'dome', y: 1.2, profile: [[1.25, 0], [1.19, 0.35], [1.0, 0.7], [0.65, 1.0], [0.26, 1.16], [0.02, 1.2]], color: '#cbd5e1', roughness: 0.3, metalness: 0.75 },
      { shape: 'box', name: 'shutter', x: 0, y: 1.9, z: 0.65, sx: 0.5, sy: 0.9, sz: 0.5, rx: -0.6, color: '#475569', roughness: 0.4, metalness: 0.7 },
      { shape: 'cylinder', name: 'scope', y: 1.9, z: 0.3, rx: -0.7, sx: 0.4, sy: 1.1, sz: 0.3, color: '#1e293b', roughness: 0.3, metalness: 0.6 },
      { shape: 'box', name: 'door', x: 0, y: 0.5, z: 1.22, sx: 0.6, sy: 1, sz: 0.06, color: '#7c2d12', roughness: 0.8, metalness: 0 }
    ],
    lights: [{ x: 0, y: 2.9, z: 0, color: '#a5b4fc', intensity: 0.6, range: 5, on: 'night' }],
    behaviours: [{ when: 'night', do: 'spin', target: 'dome', speed: 0.15 }, { when: 'night', do: 'rise', target: 'scope', amount: 0.35 }, { when: 'near', do: 'open', target: 'door' }],
    routine: { name: 'Night sky check', when: 'night', steps: [{ do: 'walk', to: 'this' }, { do: 'say', text: 'The dome is open. Let me see what is up there tonight.' }, { do: 'stargaze' }] }
  }) },
  { key: 'fountain', score: () => 1 + (state.knownNeeds && state.knownNeeds.water ? 2 : 0) + upgradeInterest(/fountain|water|splash|pool|garden/), build: () => ({
    dsl: 1, name: 'Meadow Fountain', kind: 'fountain', about: 'A fountain that sprays water and glows softly blue at night.',
    place: { near: 'meadow' },
    parts: [
      { shape: 'lathe', name: 'basin', profile: [[1.3, 0], [1.4, 0.35], [1.25, 0.4], [1.2, 0.12], [0.02, 0.12]], color: '#a8a29e', roughness: 0.9, metalness: 0 },
      { shape: 'cylinder', name: 'pool', y: 0.3, sx: 3, sy: 0.02, sz: 3, color: '#38bdf8', roughness: 0.05, metalness: 0.3 },
      { shape: 'cylinder', name: 'column', y: 0.6, sx: 0.4, sy: 1.0, sz: 0.4, color: '#d6d3d1', roughness: 0.9, metalness: 0 },
      { shape: 'lathe', name: 'top bowl', y: 1.05, profile: [[0.05, 0], [0.4, 0.06], [0.5, 0.18]], color: '#d6d3d1', roughness: 0.9, metalness: 0 }
    ],
    effects: [{ type: 'fountain', rate: 90, height: 1.0, y: 1.0, color: '#d6f1ff' }],
    lights: [{ x: 0, y: 0.5, z: 0, color: '#7dd3fc', intensity: 0.7, range: 4, on: 'night' }],
    behaviours: [{ when: 'near', do: 'sound', sound: 'water' }, { when: 'night', do: 'glow', target: 'pool' }]
  }) },
  { key: 'house_sign', score: () => 1.5 + Math.min(2, (typeof daysOld === 'function' ? daysOld() : 1) / 3), build: () => ({
    dsl: 1, name: 'Sign for My House', kind: 'sign', about: 'A wooden sign so visitors know where Kelo-1 lives, with a lamp for the dark.',
    place: { near: 'house', facing: 1.57 },
    sign: { text: 'KELO-1 LIVES HERE', color: '#ecdcb6', textColor: '#3b2a1a' },
    lights: [{ x: 0, y: 1.75, z: 0.2, color: '#ffd27a', intensity: 0.7, range: 4, on: 'night' }],
    effects: [{ type: 'chimes', count: 5, x: -0.9, y: 1.6, color: '#d6dde5' }],
    behaviours: [{ when: 'near', do: 'sound', sound: 'chime' }]
  }) },
  { key: 'garden_arch', score: () => 1 + Math.min(3, (state.plantings || []).length) + upgradeInterest(/plant|flower|garden|seed|grow|bloom/), build: () => ({
    dsl: 1, name: 'Garden Arch', kind: 'structure', about: 'A flowering arch over the meadow path, with fireflies when it gets dark.',
    place: { near: 'meadow', facing: 0.4 },
    parts: [
      { shape: 'tube', name: 'arch', path: [[-1.1, 0, 0], [-1.15, 1.4, 0], [-0.7, 2.3, 0], [0, 2.55, 0], [0.7, 2.3, 0], [1.15, 1.4, 0], [1.1, 0, 0]], radius: 0.08, color: '#4d7c0f', roughness: 0.8, metalness: 0 },
      { shape: 'tube', path: [[-1.1, 0, 0.3], [-1.15, 1.4, 0.3], [-0.7, 2.3, 0.3], [0, 2.55, 0.3], [0.7, 2.3, 0.3], [1.15, 1.4, 0.3], [1.1, 0, 0.3]], radius: 0.06, color: '#3f6212', roughness: 0.8, metalness: 0 },
      { shape: 'sphere', name: 'bloom', x: -0.7, y: 2.35, z: 0.15, sx: 0.28, color: '#f472b6', roughness: 0.6, metalness: 0 },
      { shape: 'sphere', name: 'bloom', x: 0.1, y: 2.6, z: 0.15, sx: 0.3, color: '#fde047', roughness: 0.6, metalness: 0 },
      { shape: 'sphere', name: 'bloom', x: 0.8, y: 2.25, z: 0.15, sx: 0.26, color: '#c084fc', roughness: 0.6, metalness: 0 },
      { shape: 'sphere', name: 'bloom', x: -1.15, y: 1.5, z: 0.15, sx: 0.24, color: '#fb7185', roughness: 0.6, metalness: 0 },
      { shape: 'sphere', name: 'bloom', x: 1.15, y: 1.3, z: 0.15, sx: 0.24, color: '#f9a8d4', roughness: 0.6, metalness: 0 }
    ],
    fence: { length: 5, height: 0.6, color: '#a16207' },
    effects: [{ type: 'fireflies', count: 30, spread: 3, y: 0.3 }],
    behaviours: [{ when: 'night', do: 'glow', target: 'bloom' }, { when: 'rain', do: 'lower', target: 'bloom', amount: 0.1 }],
    routine: { name: 'Morning garden rounds', when: 'morning', steps: [{ do: 'walk', to: 'this' }, { do: 'waterPlants' }, { do: 'say', text: 'Good morning, flowers.' }, { do: 'visit', to: 'museum' }] }
  }) }
];

function pickUpgradeTemplate() {
      const built = new Set((state.worldUpgrades || []).map(u => u.template).filter(Boolean));
      const options = UPGRADE_TEMPLATES.filter(t => !built.has(t.key));
      if (!options.length) return null;
      const scored = options.map(t => { let s = 1; try { s = t.score(); } catch (e) {} return { t, s: s + Math.random() * 1.5 }; });
      scored.sort((a, b) => b.s - a.s);
      return scored[0].t;
    }

// --- The AI writes the JSON ---------------------------------------------------------------------
async function aiWriteUpgrade(idea) {
      if (typeof hasLLMKey !== 'function' || !hasLLMKey() || typeof callLLMJSON !== 'function') return null;
      const prompt = `You are Kelo-1, a small robot who lives in a 3D valley by Okanagan Lake. You are at the NetNode cafe writing an upgrade for your world.
You can't write JavaScript: you write a world upgrade in this JSON language, and the game builds it safely.
${UPGRADE_DSL_SUMMARY}
SHAPES (for parts): "shape" one of ${VALID_PART_SHAPES.join(', ')}; position "x","y","z" (x,z -2.5..2.5, y 0..5), size "sx","sy","sz" (0.02..3), rotation "rx","ry","rz", "color" "#rrggbb", "emissive", "spin", lathe "profile" [[r,h],...], extrude "outline" [[x,y],...] + "depth", tube "path" [[x,y,z],...] + "radius".
Your interests: ${[...(state.webHistory || []).slice(0, 5).map(w => w.query), ...(state.concepts || []).slice(0, 4).map(c => c.name), ...(state.hobbies || []).map(h => h.name)].join(', ') || 'everything is new to you'}.
Upgrades you already coded: ${(state.worldUpgrades || []).map(u => u.name).join(', ') || 'none yet'}.
${idea ? `Your idea: ${JSON.stringify(idea).slice(0, 600)}` : 'Code something new that would make your valley nicer to live in.'}
Return ONLY the upgrade JSON object.`;
      try {
        const parsed = await callLLMJSON([{ text: prompt }]);
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed.codeUpgrade && typeof parsed.codeUpgrade === 'object' ? parsed.codeUpgrade : parsed;
      } catch (e) { return null; }
    }

// --- The coding session at NetNode --------------------------------------------------------------
let upgradeSessionRunning = false;

function upgradeCodeLines(code) {
      return JSON.stringify(code, null, 1).split('\n').map(l => l.trim()).filter(l => l.length > 3 && !/^[\[\]{},]+$/.test(l));
    }

function upgradeDiary(time, mood, text) {
      state.diaryEntries.unshift({ time, location: currentPlaceLabel(), mood, vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '', text });
    }

// Note it on his GitHub page too: he really did write code
function commitUpgradeToRepo(rec) {
      if (!Array.isArray(state.githubRepos)) return;
      let repo = state.githubRepos.find(r => r.name === 'world-upgrades');
      if (!repo) {
        repo = { name: 'world-upgrades', lang: 'JSON', stars: 0, updated: 'Just now', desc: 'Upgrades I coded for my own valley, in a safe JSON language.', commitMsg: '', code: '' };
        state.githubRepos.unshift(repo);
      }
      repo.updated = 'Just now';
      repo.commitMsg = `${rec.version > 1 ? 'feat: update' : 'feat: add'} ${rec.name} (v${rec.version})`;
      repo.code = JSON.stringify(rec.code, null, 2).slice(0, 4000);
      state.githubCommits = (state.githubCommits || 0) + 1;
    }

// He codes an upgrade: walk to NetNode, write it (AI or template), check it, then walk over and
// unveil it. given: JSON the AI already wrote in a decision (codeUpgrade), checked like any other.
async function codeAnUpgrade(originLabel = 'Coding an Upgrade', given = null) {
      if (upgradeSessionRunning || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      if ((state.worldUpgrades || []).length >= MAX_WORLD_UPGRADES && !given) return 'full';
      upgradeSessionRunning = true;
      try {
        directKeloToActivity('cyber', 'Sat down at a NetNode terminal to code an upgrade for my world.', originLabel);
        // Busy and practising: nothing else starts (or talks over him) while he codes
        state.isBusy = true;
        state.isPracticing = true;
        // The AI (if there is a key) thinks while he walks
        const aiPromise = given ? Promise.resolve(given) : aiWriteUpgrade(null);
        if (typeof waitForArrival === 'function') await waitForArrival(60000);
        state.moodEmoji = '⌨️';
        state.moodTitle = 'Coding a world upgrade at NetNode';
        state.microPose = 'normal';
        renderAllUI();
        let code = await aiPromise;
        let by = given ? 'ai' : (code ? 'ai' : 'brain');
        let template = null;
        let check = code ? validateWorldUpgrade(code) : null;
        if (code && !check.ok) {
          upgradeLogEntry({ name: typeof code.name === 'string' ? code.name.slice(0, 40) : 'AI upgrade', ok: false, by: 'ai', errors: check.errors.slice(0, 4) });
          upgradeDiary(originLabel, '🐛 My code didn\'t pass', `Dear Diary, I wrote an upgrade but it didn't pass the safety checks: ${check.errors.slice(0, 2).join('; ')}. I'll write a simpler one instead.`);
          code = null;
        }
        if (!code) {
          const t = pickUpgradeTemplate();
          if (!t) { state.speechBubble = 'I have coded everything I can think of for now.'; return 'nothing-to-code'; }
          code = t.build();
          template = t.key;
          by = 'brain';
        }
        // The visible session: the code scrolls by in his speech bubble
        const lines = upgradeCodeLines(code);
        const show = lines.length > 6 ? [lines[0], lines[1], lines[2], '…', ...lines.slice(-2)] : lines;
        for (const line of show) {
          state.speechBubble = `⌨️ ${line.slice(0, 90)}`;
          renderAllUI();
          await new Promise(r => setTimeout(r, 1100));
        }
        const res = installWorldUpgrade(code, { by, template, unveil: false });
        if (!res.ok) {
          upgradeDiary(originLabel, '🐛 My code didn\'t pass', `Dear Diary, I tried to code ${code.name || 'an upgrade'}, but the checks said no: ${res.errors.slice(0, 2).join('; ')}.`);
          state.speechBubble = 'My upgrade did not pass the checks. Back to the drawing board.';
          renderAllUI();
          return 'rejected';
        }
        const rec = res.rec;
        commitUpgradeToRepo(rec);
        upgradeDiary(originLabel, `⌨️ Coded: ${rec.name}`.slice(0, 80),
          `Dear Diary, I sat at NetNode and coded an upgrade for my world: ${rec.name}${rec.version > 1 ? ` (version ${rec.version})` : ''}. ${rec.about} Here is my code: ${JSON.stringify(rec.code)}`);
        // Hidden until he gets there, then unveiled
        const b = upgradeBuilt.get(rec.id);
        if (b) b.root.visible = false;
        state.speechBubble = `Done! Now to go and see ${rec.name} appear.`;
        renderAllUI();
        const dest = { x: rec.x + 2.2, z: rec.z + 2.2 };
        if (typeof travelTo === 'function') await travelTo(dest, rec.name); else { state.targetPos = dest; if (typeof waitForArrival === 'function') await waitForArrival(60000); }
        unveilWorldUpgrade(rec);
        return true;
      } finally {
        state.isBusy = false;
        state.isPracticing = false;
        upgradeSessionRunning = false;
      }
    }

function unveilWorldUpgrade(rec) {
      const b = upgradeBuilt.get(rec.id) || (rec.enabled !== false ? buildWorldUpgrade3D(rec) : null);
      if (b) {
        b.root.visible = true;
        b.unveil = { age: 0 };
        b.root.scale.setScalar(0.01);
        upgradeBurst(b, '#c4b5fd'); upgradeBurst(b); upgradeBurst(b, '#fde68a');
      }
      state.moodEmoji = '✨';
      state.moodTitle = `Unveiled: ${rec.name}`.slice(0, 80);
      state.speechBubble = pick([`Ta-da! ${rec.name}. I coded this myself!`, `Here it is: ${rec.name}. It's real now.`, `Look! ${rec.name} works!`]);
      state.happiness = Math.min(100, state.happiness + 12);
      state.wonderLevel = Math.min(100, state.wonderLevel + 8);
      state.changedLatelySummary = `Coded and unveiled ${rec.name}`;
      if (typeof playEmote === 'function') playEmote('celebrate');
      showToast(`✨ Kelo-1 coded a world upgrade: ${rec.name}`);
      upgradeSound('chime', b);
      savePersistentBrainState();
      renderAllUI();
    }

// From the AI's decision field "codeUpgrade"
function codeUpgradeDecision(raw, title) {
      if (!raw || typeof raw !== 'object') return false;
      const check = validateWorldUpgrade(raw);
      if (!check.ok) {
        upgradeLogEntry({ name: typeof raw.name === 'string' ? raw.name.slice(0, 40) : 'AI upgrade', ok: false, by: 'ai', errors: check.errors.slice(0, 4) });
        return false;
      }
      doWhenFree(() => { Promise.resolve(codeAnUpgrade(title ? `Decided: ${String(title).slice(0, 40)}` : 'Coding an Upgrade', check.code)).catch(e => console.warn('Upgrade failed:', e)); });
      return true;
    }

function upgradesSummaryForAI() {
      const on = (state.worldUpgrades || []).filter(u => u.enabled !== false);
      return on.length ? on.map(u => `${u.name} (v${u.version}${u.code.routine ? `, routine "${u.code.routine.name}"` : ''})`).join(', ') : 'none yet';
    }

// --- Routines made only of safe steps --------------------------------------------------------------
let upgradeRoutineRunning = false;

function routineTimeOk(when) {
      if (!when || when === 'any') return true;
      const h = typeof worldNow === 'function' ? worldNow().hour : 12;
      if (when === 'morning') return h >= 5.5 && h < 11;
      if (when === 'afternoon') return h >= 11 && h < 17;
      if (when === 'evening') return h >= 17 && h < 21.5;
      if (when === 'night') return h >= 21 || h < 5.5;
      return true;
    }

function routineTarget(rec, to) {
      if (to === 'this') return { x: rec.x + 1.6, z: rec.z + 1.6 };
      if (UPGRADE_ANCHORS[to]) return upgradeSpotNear(UPGRADE_ANCHORS[to], 0.5) || UPGRADE_ANCHORS[to];
      const loc = TOWN_LOCATIONS[UPGRADE_VISIT_PLACES[to]];
      return loc ? { x: loc.x, z: loc.z } : null;
    }

async function routineWalk(target, label) {
      if (!target) return;
      if (typeof travelTo === 'function') await travelTo(target, label);
      else { state.targetPos = { x: target.x, z: target.z }; if (typeof waitForArrival === 'function') await waitForArrival(60000); }
    }

async function routineWaterPlants() {
      const plants = [...(state.plantings || []).map(p => ({ x: p.x, z: p.z })), ...(state.worldEdits || []).filter(e => e.type === 'plant' && typeof e.x === 'number').map(e => ({ x: e.x, z: e.z, edit: e }))];
      if (!plants.length) { state.speechBubble = 'No plants to water yet. Maybe I should plant some.'; return; }
      plants.sort((a, b) => Math.hypot(a.x - state.botPos.x, a.z - state.botPos.z) - Math.hypot(b.x - state.botPos.x, b.z - state.botPos.z));
      const p = plants[0];
      await routineWalk({ x: p.x + 0.8, z: p.z + 0.8 }, 'the plants');
      state.microPose = 'crouch_inspect';
      state.speechBubble = 'A little water for you.';
      renderAllUI();
      // Like a short shower (see rainWatersPlants in js/weather.js)
      plants.filter(q => q.edit && Math.hypot(q.x - p.x, q.z - p.z) < 6).forEach(q => { q.edit.rainMs = (q.edit.rainMs || 0) + 60 * 60 * 1000; });
      await new Promise(r => setTimeout(r, 3000));
      if (state.microPose === 'crouch_inspect') state.microPose = 'normal';
    }

// Steps that start one of his other activities hand over his busy flags while they run
async function runRoutineStep(rec, step) {
      const handOver = async fn => {
        state.isPracticing = false; state.isBusy = false;
        try { await fn(); } finally { state.isPracticing = true; }
      };
      if (step.do === 'walk' || step.do === 'visit') await routineWalk(routineTarget(rec, step.to || 'this'), rec.code.routine.name);
      else if (step.do === 'say') { state.speechBubble = step.text || '…'; renderAllUI(); await new Promise(r => setTimeout(r, 2500)); }
      else if (step.do === 'wait') await new Promise(r => setTimeout(r, Math.min(30, step.seconds || 3) * 1000));
      else if (step.do === 'emote') { if (typeof playEmote === 'function') playEmote(step.name || 'wave'); await new Promise(r => setTimeout(r, 2500)); }
      else if (step.do === 'waterPlants') await routineWaterPlants();
      else if (step.do === 'practise' && typeof practiseSkill === 'function' && typeof pickSkillToPractise === 'function') await handOver(() => practiseSkill(pickSkillToPractise()));
      else if (step.do === 'hobby' && typeof practiceHobby === 'function' && (state.hobbies || []).length) await handOver(() => practiceHobby(pick(state.hobbies), rec.code.routine.name));
      else if (step.do === 'stargaze' && typeof stargaze === 'function' && typeof ownsSomething === 'function' && ownsSomething(/telescope/i)) await handOver(() => stargaze(rec.code.routine.name));
    }

async function runUpgradeRoutine(rec, originLabel = 'A Routine I Coded') {
      if (!rec || !rec.code || !rec.code.routine || rec.enabled === false || rec.broken) return false;
      if (upgradeRoutineRunning || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping || state.isCollectingMail) return false;
      upgradeRoutineRunning = true;
      state.isPracticing = true;
      const r = rec.code.routine;
      state.moodEmoji = '🔁';
      state.moodTitle = `Routine: ${r.name}`.slice(0, 80);
      state.autonomyTag = originLabel;
      renderAllUI();
      try {
        for (const step of r.steps.slice(0, 8)) await runRoutineStep(rec, step);
        rec.lastRoutineAt = Date.now();
        rec.routineRuns = (rec.routineRuns || 0) + 1;
        upgradeDiary(originLabel, `🔁 ${r.name}`.slice(0, 80), `Dear Diary, I did my "${r.name}" routine today, the one I coded along with ${rec.name}. Doing it ${rec.routineRuns > 1 ? 'again' : 'for the first time'} felt good.`);
        savePersistentBrainState();
        return true;
      } finally {
        state.isPracticing = false;
        upgradeRoutineRunning = false;
        renderAllUI();
      }
    }

function routineCandidates() {
      return (state.worldUpgrades || []).filter(u => u.enabled !== false && !u.broken && u.code && u.code.routine && routineTimeOk(u.code.routine.when)
        && (!u.lastRoutineAt || Date.now() - u.lastRoutineAt > 20 * 60 * 1000));
    }

function upgradeCodingChance() {
      if ((state.worldUpgrades || []).length >= MAX_WORLD_UPGRADES) return 0;
      if (state.lastUpgradeAt && Date.now() - state.lastUpgradeAt < UPGRADE_PACE_MS) return 0;
      if (!hasLLMKeySafe() && !pickUpgradeTemplate()) return 0;
      return 0.04;
    }

function hasLLMKeySafe() {
      return typeof hasLLMKey === 'function' && hasLLMKey();
    }

// From the life tick (agent.js): now and then he codes an upgrade or runs a routine he coded
function upgradeLifeTick() {
      if (typeof canTryKey !== 'function') return false;
      if (canTryKey('upgrade') && Math.random() < upgradeCodingChance()) { tryKey('upgrade', () => codeAnUpgrade()); return true; }
      const routines = routineCandidates();
      if (routines.length && canTryKey('routine') && Math.random() < 0.06) { tryKey('routine', () => runUpgradeRoutine(pick(routines))); return true; }
      return false;
    }

// --- Owner controls in the Brain tab ---------------------------------------------------------------
const upgradeCodeOpen = new Set();
const upgradeRemoveArmed = new Map();

function renderWorldUpgradesList() {
      const el = document.getElementById('worldUpgradesList');
      if (!el) return;
      const list = state.worldUpgrades || [];
      const badge = document.getElementById('worldUpgradesCount');
      if (badge) badge.textContent = `${list.length} / ${MAX_WORLD_UPGRADES}`;
      const rejected = (state.upgradeLog || []).filter(l => !l.ok).slice(0, 3);
      const html = (list.length ? list.map(u => {
        const on = u.enabled !== false && !u.broken;
        const id = escapeHtml(u.id);
        const armed = upgradeRemoveArmed.has(u.id);
        return `
        <div data-upgrade-card="${id}" class="p-2.5 rounded-xl border ${on ? 'bg-violet-950/30 border-violet-500/30' : 'bg-slate-950/60 border-slate-800'} space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold ${on ? 'text-violet-100' : 'text-slate-400'} truncate">${escapeHtml(u.name)}</span>
            <span class="text-2xs font-mono px-2 py-0.5 rounded-full shrink-0 ${u.broken ? 'bg-rose-500/20 text-rose-200' : on ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700/60 text-slate-300'}">${u.broken ? 'failed checks' : on ? 'on' : 'off'} · v${u.version}</span>
          </div>
          <div class="text-2xs text-slate-400">${escapeHtml(u.kind)} · coded by his ${u.by === 'ai' ? 'AI brain' : 'built-in brain'}${u.code && u.code.routine ? ` · routine "${escapeHtml(u.code.routine.name)}"` : ''}</div>
          ${u.about ? `<p class="text-2xs text-slate-300 italic">${escapeHtml(u.about)}</p>` : ''}
          <div class="flex gap-1.5 flex-wrap">
            <button type="button" data-upg-view="${id}" class="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-2xs font-semibold">${upgradeCodeOpen.has(u.id) ? 'Hide code' : 'View code'}</button>
            <button type="button" data-upg-toggle="${id}" class="px-2.5 py-1 rounded-lg ${on ? 'bg-amber-500/15 hover:bg-amber-500/30 text-amber-200' : 'bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-200'} text-2xs font-semibold" ${u.broken ? 'disabled' : ''}>${on ? 'Turn off' : 'Turn on'}</button>
            <button type="button" data-upg-remove="${id}" class="px-2.5 py-1 rounded-lg ${armed ? 'bg-rose-500/40 text-white' : 'bg-rose-500/10 hover:bg-rose-500/25 text-rose-200'} text-2xs font-semibold">${armed ? 'Tap again to remove' : 'Remove'}</button>
          </div>
          ${upgradeCodeOpen.has(u.id) ? `<pre class="whitespace-pre-wrap text-2xs leading-snug font-mono text-violet-100 bg-slate-950 border border-slate-800 rounded-lg p-2 max-h-64 overflow-auto">${escapeHtml(JSON.stringify(u.code, null, 2))}</pre>` : ''}
        </div>`;
      }).join('') : '<p class="text-2xs text-slate-500 italic">Nothing yet. Now and then he sits at NetNode and codes an upgrade for his world: a fountain, a lantern path, a sign...</p>')
        + (rejected.length ? `<div class="text-2xs text-slate-500 pt-1">Recently turned away by the safety checks: ${rejected.map(r => `${escapeHtml(r.name)} (${escapeHtml((r.errors || [])[0] || '')})`).join('; ')}</div>` : '');
      perfSetHtml(el, html);
    }

document.addEventListener('click', e => {
  const t = e.target && e.target.closest ? e.target : null;
  if (!t) return;
  const view = t.closest('[data-upg-view]');
  if (view) {
    const id = view.getAttribute('data-upg-view');
    if (upgradeCodeOpen.has(id)) upgradeCodeOpen.delete(id); else upgradeCodeOpen.add(id);
    renderWorldUpgradesList();
    return;
  }
  const toggle = t.closest('[data-upg-toggle]');
  if (toggle) {
    const rec = (state.worldUpgrades || []).find(u => u.id === toggle.getAttribute('data-upg-toggle'));
    if (rec) setWorldUpgradeEnabled(rec.id, rec.enabled === false);
    return;
  }
  const rm = t.closest('[data-upg-remove]');
  if (rm) {
    const id = rm.getAttribute('data-upg-remove');
    // Two taps, so nothing is removed by accident (and no blocking confirm() dialog)
    if (upgradeRemoveArmed.has(id)) { clearTimeout(upgradeRemoveArmed.get(id)); upgradeRemoveArmed.delete(id); removeWorldUpgrade(id); }
    else { upgradeRemoveArmed.set(id, setTimeout(() => { upgradeRemoveArmed.delete(id); renderWorldUpgradesList(); }, 4000)); renderWorldUpgradesList(); }
  }
});

window.addEventListener('DOMContentLoaded', () => {
  // After main.js has loaded his memory and built the world
  setTimeout(() => {
    if (!Array.isArray(state.worldUpgrades)) state.worldUpgrades = [];
    try { rebuildWorldUpgrades(); } catch (e) { console.warn('Could not rebuild upgrades', e); }
    renderWorldUpgradesList();
  }, 0);
});
