// Kelo-bot-1 — js/materials.js
// Loaded after everydaymodels.js. What things are made of, and what that means:
//   - a table of real materials (metals, woods, plastic, rubber, glass, stone, ceramic, fabric, paper, food)
//     with how hard and heavy they are, how they fail and how much force it takes
//   - working out an item's materials from its name ("cedar boards", "glass jar"), or from the colours
//     of its model's parts when the name doesn't say
//   - applyMaterialLook(): wood gets grain, metal looks brushed and shiny, glass is see-through
//   - applyForce(): metal bends, wood snaps, glass shatters, rubber springs back, fabric tears
//   - food flavours: what something really tastes like, and the tastes he grows to like or dislike

// --- The materials ------------------------------------------------------------------------------
// hardness: roughly the Mohs scale (0 squishy .. 10 diamond)
// density: grams per cubic centimetre (water is 1)
// fails: what happens past its limit (bends, snaps, shatters, tears, squashes, springs)
// breakForce: newtons it takes to bend or break an item-sized piece of it
// look: how it renders (roughness, metalness, opacity, texture) and, for metals, its colour
const MATERIALS = {
  steel:     { name: 'steel', family: 'metal', hardness: 5.5, density: 7.85, fails: 'bends', breakForce: 3000, look: { roughness: 0.32, metalness: 0.9, texture: 'brushed', color: 0xa8b0bb } },
  iron:      { name: 'iron', family: 'metal', hardness: 4.5, density: 7.87, fails: 'bends', breakForce: 2400, look: { roughness: 0.55, metalness: 0.8, texture: 'brushed', color: 0x6b6f76 } },
  copper:    { name: 'copper', family: 'metal', hardness: 3, density: 8.96, fails: 'bends', breakForce: 1600, look: { roughness: 0.3, metalness: 0.95, texture: 'brushed', color: 0xc8743a } },
  brass:     { name: 'brass', family: 'metal', hardness: 3.5, density: 8.5, fails: 'bends', breakForce: 2000, look: { roughness: 0.3, metalness: 0.95, texture: 'brushed', color: 0xd6ac4a } },
  aluminium: { name: 'aluminium', family: 'metal', hardness: 2.75, density: 2.7, fails: 'bends', breakForce: 1300, look: { roughness: 0.38, metalness: 0.85, texture: 'brushed', color: 0xd4d8dd } },
  gold:      { name: 'gold', family: 'metal', hardness: 2.5, density: 19.3, fails: 'bends', breakForce: 1100, look: { roughness: 0.22, metalness: 1, texture: 'brushed', color: 0xf0c03a } },
  silver:    { name: 'silver', family: 'metal', hardness: 2.7, density: 10.5, fails: 'bends', breakForce: 1200, look: { roughness: 0.22, metalness: 1, texture: 'brushed', color: 0xd9dde3 } },
  pine:      { name: 'pine', family: 'wood', hardness: 1, density: 0.5, fails: 'snaps', breakForce: 1400, look: { roughness: 0.75, metalness: 0, texture: 'wood' } },
  oak:       { name: 'oak', family: 'wood', hardness: 2, density: 0.75, fails: 'snaps', breakForce: 2200, look: { roughness: 0.7, metalness: 0, texture: 'wood' } },
  cedar:     { name: 'cedar', family: 'wood', hardness: 1, density: 0.38, fails: 'snaps', breakForce: 1100, look: { roughness: 0.8, metalness: 0, texture: 'wood' } },
  bamboo:    { name: 'bamboo', family: 'wood', hardness: 2, density: 0.6, fails: 'snaps', breakForce: 1800, look: { roughness: 0.5, metalness: 0, texture: 'wood' } },
  plastic:   { name: 'plastic', family: 'plastic', hardness: 1.5, density: 0.95, fails: 'snaps', breakForce: 900, look: { roughness: 0.35, metalness: 0 } },
  rubber:    { name: 'rubber', family: 'rubber', hardness: 0.5, density: 1.1, fails: 'springs', breakForce: Infinity, look: { roughness: 0.85, metalness: 0 } },
  glass:     { name: 'glass', family: 'glass', hardness: 5.5, density: 2.5, fails: 'shatters', breakForce: 150, look: { roughness: 0.05, metalness: 0.1, opacity: 0.35 } },
  stone:     { name: 'stone', family: 'stone', hardness: 6, density: 2.6, fails: 'shatters', breakForce: 9000, look: { roughness: 0.95, metalness: 0, texture: 'speckle' } },
  ceramic:   { name: 'ceramic', family: 'ceramic', hardness: 7, density: 2.4, fails: 'shatters', breakForce: 500, look: { roughness: 0.25, metalness: 0 } },
  fabric:    { name: 'fabric', family: 'fabric', hardness: 0.3, density: 0.3, fails: 'tears', breakForce: 700, look: { roughness: 1, metalness: 0, texture: 'weave' } },
  paper:     { name: 'paper', family: 'paper', hardness: 0.5, density: 0.8, fails: 'tears', breakForce: 900, look: { roughness: 0.95, metalness: 0 } },
  food:      { name: 'food', family: 'food', hardness: 0.2, density: 1.0, fails: 'squashes', breakForce: 50, look: null }
};

// Words in a name that say what something is made of
const MATERIAL_WORDS = [
  [/\b(stainless|steel|chrome)\b/, 'steel'], [/\b(cast )?iron\b(?! ?man)|wrought/, 'iron'], [/\bcopper\b/, 'copper'],
  [/\b(brass|bronze)\b/, 'brass'], [/\balumin(i)?um\b|\btin\b/, 'aluminium'], [/\bgold(en)?\b/, 'gold'], [/\bsilver\b/, 'silver'],
  [/\bpine\b|\bspruce\b|\bfir\b|plywood/, 'pine'], [/\boak\b|\bmaple\b|\bwalnut\b|\bash\b|\bhickory\b|\bbirch\b/, 'oak'],
  [/\bcedar\b/, 'cedar'], [/\bbamboo\b/, 'bamboo'], [/\bplastic\b|\bvinyl\b|\bnylon\b|\blego\b|acrylic/, 'plastic'],
  [/\brubber\b|\blatex\b/, 'rubber'], [/\bglass\b|\bcrystal glass\b|\bwindow\b|\bpanes?\b/, 'glass'],
  [/\bstone\b|\bgranite\b|\bmarble slab\b|\bslate\b|\bbasalt\b|\bbrick\b|\brock\b/, 'stone'],
  [/\bceramic\b|\bporcelain\b|\bpottery\b|\bterracotta\b|\bclay pot\b/, 'ceramic'],
  [/\bfabric\b|\bcloth\b|\bcanvas\b|\bcotton\b|\bwool\b|\bsilk\b|\brope\b|\bburlap\b|\btwine\b|\bdenim\b/, 'fabric'],
  [/\bpaper\b|\bcardboard\b|\bbook\b|\bnovel\b|\bjournal\b|\bnotebook\b|\bmanual\b|\bmap\b|\bletter\b|\bseed packets?\b/, 'paper']
];

// What everyday things are usually made of, when the name only says what the thing is
const KIND_MATERIALS = [
  [/pick ?ax|mattock/, ['steel', 'oak']],
  [/\baxe\b|hatchet|hammer(?!.*jack)|mallet|shovel|spade|rake|hoe\b/, ['steel', 'pine']],
  [/jack ?hammer|wrench|spanner|pliers|knife|saw\b|drill bit|screwdriver|rods?\b|rebar|beam|bar stock|ingot|anvil|chisel/, ['steel']],
  [/pipe|tubing|wire|cable/, ['copper']],
  [/nugget|coin|ring\b|medal/, ['gold']],
  [/jar|bottle|lens|mirror|pane|window|vase|marble/, ['glass']],
  [/\bmug\b|\bcup\b(?!cake)|plate|bowl|teapot|\btile/, ['ceramic']],
  [/duck|tyre|tire|boots?|ball(?!oon)|band\b|hose/, ['rubber']],
  [/plank|board|lumber|timber|dock|pier|crate|log\b|guitar|ukulele|violin|harmonica|canoe|paddle|spoon|chopstick|toy blocks/, ['pine']],
  [/geode|crystal|quartz|amethyst|garnet|jade|obsidian|arrowhead|meteorite|fossil|pebble|boulder|slab|cairn/, ['stone']],
  [/kite|tent|sail|flag|blanket|scarf|hat\b|bag\b|sack|rope|net\b/, ['fabric']],
  [/yo-?yo|puzzle|lego|bucket|toy frog|spinning top/, ['plastic']],
  [/bike|bicycle|scooter|ladder|canister|tank\b/, ['aluminium']],
  [/truck|excavator|snowmobile|helicopter|tractor|toolbox|telescope|motor|engine/, ['steel']]
];

// Materials the name says outright ("cedar", "glass", "rubber")
function namedMaterials(itemName) {
      const lower = String(itemName || '').toLowerCase();
      const named = [];
      MATERIAL_WORDS.forEach(([re, key]) => { if (re.test(lower) && !named.includes(key)) named.push(key); });
      return named;
    }

// What an item is made of, from its name: named materials first, then what that kind of thing is usually made of
function inferMaterials(itemName) {
      const lower = String(itemName || '').toLowerCase();
      if (typeof categorizeItem === 'function' && categorizeItem(lower) === 'food') return ['food'];
      const named = namedMaterials(lower);
      const kind = KIND_MATERIALS.find(([re]) => re.test(lower));
      const usual = kind ? kind[1].slice() : [];
      // A named material replaces the usual one from the same family ("cedar paddle", "aluminium shovel")
      const out = named.slice();
      usual.forEach(key => {
        const fam = MATERIALS[key].family;
        if (!named.some(n => MATERIALS[n].family === fam)) out.push(key);
      });
      // "All-steel" means no wooden handle
      if (/all[- ](steel|metal)/.test(lower)) return out.filter(k => MATERIALS[k].family !== 'wood');
      return out;
    }

// --- Procedural textures (small canvases, made once and shared) ---------------------------------
const MATERIAL_TEXTURES = {};

function materialTexture(kind) {
      if (MATERIAL_TEXTURES[kind]) return MATERIAL_TEXTURES[kind];
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      let seed = 7;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      // Textures are near-white so they only shade the part's own colour, never replace it
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      const across = /-v$/.test(kind); // grain running up the texture instead of along it
      if (/^wood/.test(kind)) {
        // Long wavy grain lines with a few darker late-wood rings and a knot
        for (let i = 0; i < 26; i++) {
          const y0 = rnd() * size, dark = 150 + Math.floor(rnd() * 70), w = 0.6 + rnd() * 2.2, wave = rnd() * 3;
          ctx.strokeStyle = `rgb(${dark},${dark},${dark})`;
          ctx.lineWidth = w;
          ctx.beginPath();
          for (let x = 0; x <= size; x += 4) {
            const y = y0 + Math.sin(x / 18 + i) * wave;
            if (across) (x === 0 ? ctx.moveTo(y, x) : ctx.lineTo(y, x));
            else (x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
          }
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(120,120,120,0.6)';
        ctx.lineWidth = 1.2;
        for (let r = 3; r < 10; r += 3) {
          ctx.beginPath();
          ctx.ellipse(across ? 40 : 90, across ? 90 : 40, across ? r : r * 2.4, across ? r * 2.4 : r, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (kind === 'brushed') {
        // Fine streaks all running one way, like a sanded metal bar
        for (let i = 0; i < 260; i++) {
          const y = rnd() * size, g = 200 + Math.floor(rnd() * 55);
          ctx.strokeStyle = `rgba(${g},${g},${g},0.8)`;
          ctx.lineWidth = 0.5 + rnd();
          ctx.beginPath();
          const x0 = rnd() * size;
          ctx.moveTo(x0, y);
          ctx.lineTo(x0 + 30 + rnd() * 90, y);
          ctx.stroke();
        }
      } else if (kind === 'speckle') {
        // Flecks of light and dark minerals in grey stone
        for (let i = 0; i < 900; i++) {
          const g = rnd() < 0.5 ? 120 + Math.floor(rnd() * 60) : 230 + Math.floor(rnd() * 25);
          ctx.fillStyle = `rgb(${g},${g},${g})`;
          const s = 1 + rnd() * 2.5;
          ctx.fillRect(rnd() * size, rnd() * size, s, s);
        }
      } else if (kind === 'weave') {
        // Over-and-under threads
        const step = 8;
        for (let y = 0; y < size; y += step) {
          for (let x = 0; x < size; x += step) {
            const over = ((x + y) / step) % 2 === 0;
            ctx.fillStyle = over ? '#f2f2f2' : '#d8d8d8';
            ctx.fillRect(x + (over ? 0 : 1), y + (over ? 1 : 0), over ? step : step - 2, over ? step - 2 : step);
          }
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      MATERIAL_TEXTURES[kind] = tex;
      return tex;
    }

// A soft sky-and-ground reflection, so polished metal and glass have something to mirror
function materialReflections() {
      // With the real sky and HDR lighting (js/realism.js) shiny things reflect the scene's own environment
      if (typeof realisticEnvironmentOn !== 'undefined' && realisticEnvironmentOn) return null;
      if (MATERIAL_TEXTURES.sky) return MATERIAL_TEXTURES.sky;
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, 64);
      grad.addColorStop(0, '#9cc4ef');
      grad.addColorStop(0.45, '#eef4fa');
      grad.addColorStop(0.55, '#a8a29e');
      grad.addColorStop(1, '#57534e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 64);
      const tex = new THREE.CanvasTexture(canvas);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      MATERIAL_TEXTURES.sky = tex;
      return tex;
    }

// --- Giving models the right look ---------------------------------------------------------------
// What one part of a model is probably made of, from its colour and finish, given what the name says
function guessPartMaterial(mat, named, explicit) {
      const metalNamed = named.find(k => MATERIALS[k].family === 'metal');
      const woodNamed = named.find(k => MATERIALS[k].family === 'wood');
      const other = named.find(k => !['metal', 'wood'].includes(MATERIALS[k].family));
      if (mat.transparent && mat.opacity < 0.95) return named.includes('plastic') ? 'plastic' : 'glass';
      const hsl = {};
      mat.color.getHSL(hsl);
      const hue = hsl.h * 360;
      if (mat.metalness >= 0.5) {
        if (metalNamed) return metalNamed;
        if (hsl.s > 0.45 && hue >= 38 && hue <= 60) return 'brass';
        if (hsl.s > 0.45 && hue >= 14 && hue < 38) return 'copper';
        return 'steel';
      }
      if (mat.metalness >= 0.3) return null; // painted metal (a red toolbox): leave its paint alone
      // Brown parts are wood, unless the name says they're something else ("cardboard box")
      const woody = hue >= 15 && hue <= 45 && hsl.s >= 0.3 && hsl.s <= 0.96 && hsl.l >= 0.1 && hsl.l <= 0.58;
      const otherNamed = explicit.find(k => !['metal', 'wood'].includes(MATERIALS[k].family));
      if (woody && (woodNamed || !otherNamed)) return woodNamed || (hsl.l < 0.3 ? 'oak' : 'pine');
      if (hsl.l < 0.16 && hsl.s < 0.5) return otherNamed ? null : 'rubber'; // dark grips, tyres and handles
      return other || null;
    }

// Pick the grain direction from the part's shape: along the length of a plank, up a handle
function woodTextureFor(geometry) {
      const type = geometry.type || '';
      if (/Cylinder|Lathe|Cone/.test(type)) return 'wood-v';
      if (/Tube/.test(type)) return 'wood';
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const size = new THREE.Vector3();
      geometry.boundingBox.getSize(size);
      return size.y > size.x * 1.2 ? 'wood-v' : 'wood';
    }

// Give each part of an item model the look of what it's made of. Colours stay as they were,
// except a plain grey metal part in an item named after a metal ("brass rods") takes that metal's colour.
function applyMaterialLook(model, itemName) {
      if (!model) return model;
      const named = inferMaterials(itemName);
      if (named.includes('food')) return model; // food keeps the look it was drawn with
      const explicit = namedMaterials(itemName);
      const nameSaysMetal = MATERIAL_WORDS.some(([re, key]) => MATERIALS[key].family === 'metal' && re.test(String(itemName || '').toLowerCase()));
      model.traverse(o => {
        if (!o.isMesh || !o.material || !o.material.isMeshStandardMaterial || o.material.map || (o.userData && (o.userData.isLabel || o.userData.realModel))) return;
        const mat = o.material;
        const key = guessPartMaterial(mat, named, explicit);
        if (!key) return;
        const m = MATERIALS[key];
        if (!m.look) return;
        const look = m.look;
        mat.roughness = look.roughness;
        mat.metalness = look.metalness;
        if (m.family === 'metal') {
          const hsl = {};
          mat.color.getHSL(hsl);
          if (nameSaysMetal && hsl.s < 0.3) mat.color.setHex(look.color);
          mat.envMap = materialReflections();
          mat.envMapIntensity = 1;
        }
        if (m.family === 'glass') {
          mat.transparent = true;
          mat.opacity = Math.min(mat.opacity, look.opacity);
          mat.depthWrite = false;
          mat.side = THREE.DoubleSide;
          mat.envMap = materialReflections();
          mat.envMapIntensity = 1.2;
          o.castShadow = false;
        }
        if (look.texture) mat.map = materialTexture(look.texture === 'wood' ? woodTextureFor(o.geometry) : look.texture);
        mat.userData.material = key;
        mat.needsUpdate = true;
      });
      return model;
    }

// --- Force: what happens when something is pushed too hard -------------------------------------
const BROKEN_PREFIX = /^(bent|snapped|shattered|torn|squashed|cracked|shards of)\b/i;

function isBrokenItem(name) {
      return BROKEN_PREFIX.test(String(name || '').replace(/^(an?|the|my)\s+/i, ''));
    }

// "A Glass jar" -> "glass jar", but "Okanagan cherries" keeps its capital
function plainItemName(name) {
      const plain = String(name || 'it').replace(/^(an?|the|some|my)\s+/i, '');
      return /^[A-Z][a-z]/.test(plain) && !/^Okanagan|^Kelowna/.test(plain) ? plain[0].toLowerCase() + plain.slice(1) : plain;
    }

// How it sounds when it lands or is struck, in plain words
const IMPACT_SOUNDS = { metal: 'clanged', wood: 'landed with a dull thud', plastic: 'clattered', rubber: 'bounced', glass: 'clinked', stone: 'landed with a heavy crunch', ceramic: 'clinked', fabric: 'flopped down softly', paper: 'fluttered down', food: 'landed with a soft splat' };

// Push on an item with `force` newtons. The part that gives way first decides what happens.
// Returns { item, material, force, limit, outcome, broken, newName, pieces, sound, text }
function applyForce(itemName, force) {
      const item = String(itemName || '').trim();
      const plain = plainItemName(item);
      const keys = inferMaterials(item);
      if (!keys.length) keys.push('plastic');
      const f = Math.max(0, Number(force) || 0);
      // The weakest part fails first (rubber never breaks: it gives and springs back)
      const weakest = keys.slice().sort((a, b) => MATERIALS[a].breakForce - MATERIALS[b].breakForce)[0];
      const m = MATERIALS[weakest];
      const main = MATERIALS[keys[0]];
      const sound = IMPACT_SOUNDS[main.family] || 'thumped';
      const partOf = keys.length > 1 ? `${plain}'s ${m.name} ${m.family === 'wood' ? 'handle' : 'part'}` : plain;
      const out = { item, material: weakest, force: Math.round(f), limit: m.breakForce, outcome: 'holds', broken: false, newName: item, pieces: 1, sound, text: '' };
      if (m.fails === 'springs' || f < m.breakForce) {
        out.outcome = m.fails === 'springs' && f > 200 ? 'springs back' : 'holds';
        out.text = m.fails === 'springs' && f > 200
          ? `The ${plain} squished flat for a moment, then sprang right back into shape.`
          : `The ${plain} ${sound}, but held together.`;
        return out;
      }
      out.broken = true;
      out.outcome = m.fails;
      const already = isBrokenItem(item);
      if (m.fails === 'bends') {
        out.newName = already ? item : `Bent ${plain}`;
        out.fix = 'straighten it at the welding bench';
        out.text = `The ${plain} ${sound} and the ${m.name} bent out of shape.`;
      } else if (m.fails === 'snaps') {
        out.pieces = 2;
        out.newName = already ? item : `Snapped ${plain}`;
        out.text = m.family === 'wood'
          ? `The ${partOf} snapped in two with a loud crack.`
          : `The ${partOf} cracked and snapped apart.`;
      } else if (m.fails === 'shatters') {
        out.pieces = 3 + Math.min(4, Math.floor(f / Math.max(1, m.breakForce) / 4));
        out.newName = `Shards of ${plain}`;
        out.text = `The ${partOf} shattered into ${out.pieces} sharp pieces.`;
      } else if (m.fails === 'tears') {
        out.newName = already ? item : `Torn ${plain}`;
        out.text = `The ${plain} ripped and tore.`;
      } else if (m.fails === 'squashes') {
        out.newName = already ? item : `Squashed ${plain}`;
        out.text = `The ${plain} squashed flat.`;
      }
      return out;
    }

// Roughly how heavy an item is (a litre of its materials, give or take)
function itemMassKg(itemName) {
      const keys = inferMaterials(itemName);
      if (!keys.length) return 1;
      return keys.reduce((s, k) => s + MATERIALS[k].density, 0) / keys.length;
    }

// The force of something heavy landing after a fall of `metres` (it stops within a few centimetres)
function impactForce(itemName, metres) {
      return 9.8 * itemMassKg(itemName) * Math.max(0.1, metres) / 0.05;
    }

// Swap an owned item for what's left of it (a bent rod, a snapped shovel). Broken tools become junk.
function replaceOwnedItem(oldName, newName, brokenEmoji = '🪵') {
      if (!oldName || oldName === newName) return false;
      const broken = isBrokenItem(newName);
      const ti = state.toolInventory.indexOf(oldName);
      let found = false;
      if (ti >= 0) {
        state.toolInventory.splice(ti, 1);
        if (broken) state.belongings.unshift({ name: newName, category: 'junk', emoji: brokenEmoji, from: 'an accident' });
        else state.toolInventory.splice(ti, 0, newName);
        found = true;
      } else {
        const t = state.toys.find(x => x.name === oldName) || state.belongings.find(x => x.name === oldName);
        if (t) { t.name = newName; found = true; }
      }
      const ui = state.unstoredItems.indexOf(oldName);
      if (ui >= 0) state.unstoredItems[ui] = newName;
      if (found && typeof renderStorehouseShelves3D === 'function') renderStorehouseShelves3D();
      return found;
    }

// A tool forced against solid rock (digging into bedrock without a jackhammer). The handle may give way.
function forceToolOnRock(toolName) {
      if (!toolName) return null;
      const result = applyForce(toolName, randRange(500, 1900));
      if (result.broken && result.newName !== toolName) {
        replaceOwnedItem(toolName, result.newName, result.outcome === 'bends' ? '🔩' : '🪵');
        result.text = `I leaned my whole weight on the ${plainItemName(toolName)} against the bedrock. ${result.text}`;
        if (result.outcome === 'bends') {
          result.text += ' Metal bends instead of breaking, so I can straighten it at the welding bench.';
          doWhenFree(() => straightenAtBench(result.newName));
        }
      }
      return result;
    }

// A thing dropped into the Disposal Pit hits the rocky bottom: glass bursts into shards, metal bends
function pitImpact(itemName, object3d, fallMetres) {
      const result = applyForce(itemName, impactForce(itemName, fallMetres));
      if (!object3d || !result.broken) return result;
      if (result.outcome === 'shatters') {
        object3d.visible = false;
        // The pit's floor is above where the fall ends (things vanish into the dark), so burst on the floor itself
        const p = object3d.position;
        const floor = typeof getIslandGroundHeight === 'function' ? getIslandGroundHeight(p.x, p.z) : p.y;
        shatterAt(new THREE.Vector3(p.x, Math.max(p.y, floor + 0.05), p.z), result.pieces, result.material);
      } else if (result.outcome === 'bends' || result.outcome === 'squashes') {
        object3d.scale.y *= 0.6;
        object3d.rotation.z += 0.5;
      }
      return result;
    }

// A burst of sharp pieces that skitter out and settle
function shatterAt(pos, count, key = 'glass') {
      const isGlass = MATERIALS[key] && MATERIALS[key].family === 'glass';
      const shards = [];
      for (let i = 0; i < count; i++) {
        const mat = new THREE.MeshStandardMaterial({ color: isGlass ? 0xcfe8ff : 0xf5f5f4, roughness: 0.1, metalness: 0.1, transparent: isGlass, opacity: isGlass ? 0.55 : 1, side: THREE.DoubleSide, envMap: materialReflections() });
        const s = new THREE.Mesh(new THREE.TetrahedronGeometry(0.12 + Math.random() * 0.12, 0), mat);
        s.scale.set(1, 0.35, 0.6);
        s.position.copy(pos);
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        s.userData.v = { x: Math.cos(a) * 0.06, y: 0.07 + Math.random() * 0.04, z: Math.sin(a) * 0.06 };
        scene.add(s);
        shards.push(s);
      }
      const floor = pos.y;
      // Physics in fixed 30 ms steps (the floor clamp in every step, so no shard falls through it),
      // drawn every frame between the last two steps
      const STEP = 0.03;
      let acc = 0, steps = 0;
      const physics = () => {
        steps++;
        shards.forEach(s => {
          const v = s.userData.v, P = s.userData.p || (s.userData.p = s.position.clone());
          s.userData.q = (s.userData.q || new THREE.Vector3()).copy(P);
          P.x += v.x; P.z += v.z; P.y = Math.max(floor - 0.05, P.y + v.y);
          v.y -= 0.012;
          v.x *= 0.9; v.z *= 0.9;
          if (P.y > floor - 0.05) { s.rotation.x += 0.3; s.rotation.y += 0.2; }
        });
      };
      physics();
      keloTween(150 * STEP * 1000, (k, dt) => {
        acc += dt;
        while (acc >= STEP && steps < 150) { acc -= STEP; physics(); }
        const a = Math.min(1, acc / STEP);
        shards.forEach(s => { if (s.userData.q) s.position.lerpVectors(s.userData.q, s.userData.p, a); });
      }).then(() => shards.forEach(s => { scene.remove(s); s.geometry.dispose(); s.material.dispose(); }));
      return shards;
    }

// Take something bent to the welding bench, heat it and hammer it straight again
async function straightenAtBench(name) {
      const bent = String(name || '');
      if (!/^bent\s+/i.test(bent)) return false;
      const owned = ownedItemNames();
      if (!owned.includes(bent)) return false;
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      const straight = bent.replace(/^bent\s+/i, '');
      const bench = TOWN_LOCATIONS.weld;
      state.isPracticing = true;
      try {
        state.currentLocKey = 'weld';
        state.targetPos = { x: bench.x, z: bench.z };
        state.moodEmoji = '🔥';
        state.moodTitle = `Straightening the bent ${straight}`.slice(0, 80);
        state.speechBubble = `The ${straight} is bent. Heat and a hammer should fix it.`;
        renderAllUI();
        await waitForArrival(60000);
        if (typeof setCarriedObject === 'function') setCarriedObject(buildItemModel3D(bent, { label: false }));
        await new Promise(r => setTimeout(r, 4000));
        // A bent tool went to the junk pile; straight again, it's a tool once more
        const junk = state.belongings.findIndex(b => b.name === bent);
        if (junk >= 0 && state.belongings[junk].category === 'junk') {
          state.belongings.splice(junk, 1);
          state.toolInventory.unshift(straight);
          const ui = state.unstoredItems.indexOf(bent);
          if (ui >= 0) state.unstoredItems[ui] = straight;
          else state.unstoredItems.push(straight);
        } else {
          replaceOwnedItem(bent, straight);
        }
        state.speechBubble = `I heated the ${straight} at the welding bench and hammered it straight again. Good as new.`;
        state.moodTitle = `Straightened the ${straight}`.slice(0, 80);
        state.diaryEntries.unshift({
          time: 'Repairs', location: bench.building || 'the welding bench', mood: `🔥 Straightened the ${straight}`.slice(0, 80),
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, metal is hard, but it bends instead of breaking. That means it can be fixed: I heated the bent ${straight} and hammered it straight.`
        });
        if (typeof renderStorehouseShelves3D === 'function') renderStorehouseShelves3D();
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.isPracticing = false;
      }
    }

// --- Food flavours ------------------------------------------------------------------------------
// Each 0..5. texture and temperature are words; note is how he'd describe it.
const FLAVOURS = [
  [/dark chocolate/, { sweet: 2, sour: 0, salty: 0, bitter: 4, umami: 0, spicy: 0, texture: 'snappy then melting', temperature: 'cool', note: 'bitter-sweet and deep, with a clean snap' }],
  [/cherr/, { sweet: 4, sour: 2, salty: 0, bitter: 0, umami: 0, spicy: 0, texture: 'juicy', temperature: 'cool', note: 'sweet-tart and juicy, with a pit to dodge' }],
  [/lemon|lime/, { sweet: 1, sour: 5, salty: 0, bitter: 1, umami: 0, spicy: 0, texture: 'juicy', temperature: 'cool', note: 'sharply sour, enough to make my face pinch' }],
  [/sourdough/, { sweet: 1, sour: 2, salty: 1, bitter: 0, umami: 1, spicy: 0, texture: 'chewy with a crackly crust', temperature: 'warm', note: 'tangy, with a chewy middle and a crust that crackles' }],
  [/ramen|noodle/, { sweet: 0, sour: 0, salty: 3, bitter: 0, umami: 5, spicy: 1, texture: 'slurpy noodles', temperature: 'hot', note: 'savory and steaming hot, rich broth and springy noodles' }],
  [/cheddar|cheese/, { sweet: 0, sour: 1, salty: 4, bitter: 0, umami: 3, spicy: 0, texture: 'crumbly', temperature: 'cool', note: 'sharp and salty, crumbling on the edges' }],
  [/coffee|espresso/, { sweet: 0, sour: 1, salty: 0, bitter: 4, umami: 0, spicy: 0, texture: 'smooth', temperature: 'hot', note: 'bitter and roasty, and hot enough to sip slowly' }],
  [/cocoa|hot chocolate/, { sweet: 4, sour: 0, salty: 0, bitter: 1, umami: 0, spicy: 0, texture: 'creamy', temperature: 'hot', note: 'sweet and chocolatey, warm all the way down' }],
  [/chocolate|fudge|brownie/, { sweet: 5, sour: 0, salty: 1, bitter: 1, umami: 0, spicy: 0, texture: 'rich and melting', temperature: 'room-warm', note: 'very sweet and rich, melting on my tongue' }],
  [/\btea\b/, { sweet: 0, sour: 0, salty: 0, bitter: 2, umami: 1, spicy: 0, texture: 'light', temperature: 'hot', note: 'gently bitter and grassy, warm and calm' }],
  [/apple/, { sweet: 3, sour: 2, salty: 0, bitter: 0, umami: 0, spicy: 0, texture: 'crisp', temperature: 'cool', note: 'crisp and sweet with a tart edge' }],
  [/peach pie|cherry pie|pie|cobbler|tart/, { sweet: 4, sour: 1, salty: 1, bitter: 0, umami: 0, spicy: 0, texture: 'flaky crust, soft filling', temperature: 'warm', note: 'sweet fruit under a buttery, flaky crust' }],
  [/peach|apricot/, { sweet: 4, sour: 1, salty: 0, bitter: 0, umami: 0, spicy: 0, texture: 'soft and dripping', temperature: 'sun-warm', note: 'sweet, soft and dripping with juice' }],
  [/blueberr|grape|berr/, { sweet: 3, sour: 2, salty: 0, bitter: 0, umami: 0, spicy: 0, texture: 'little bursts', temperature: 'cool', note: 'sweet and a little tart, each one bursting' }],
  [/tomato/, { sweet: 2, sour: 2, salty: 0, bitter: 0, umami: 3, spicy: 0, texture: 'juicy', temperature: 'sun-warm', note: 'juicy and tangy-savory, like summer' }],
  [/carrot/, { sweet: 2, sour: 0, salty: 0, bitter: 1, umami: 0, spicy: 0, texture: 'crunchy', temperature: 'cool', note: 'crunchy and earthy-sweet' }],
  [/salmon|trout|fish/, { sweet: 1, sour: 0, salty: 3, bitter: 0, umami: 4, spicy: 0, texture: 'flaky', temperature: 'warm', note: 'rich, smoky and salty, flaking apart' }],
  [/pizza/, { sweet: 1, sour: 1, salty: 3, bitter: 0, umami: 4, spicy: 1, texture: 'stretchy cheese, crisp base', temperature: 'hot', note: 'savory and salty, with stretchy cheese and tangy sauce' }],
  [/taco|curry|chili|chilli|salsa|hot sauce|kimchi/, { sweet: 1, sour: 1, salty: 3, bitter: 0, umami: 3, spicy: 4, texture: 'crunchy and saucy', temperature: 'hot', note: 'spicy enough to make my sensors tingle, and savory' }],
  [/soup|stew/, { sweet: 1, sour: 0, salty: 3, bitter: 0, umami: 3, spicy: 0, texture: 'brothy', temperature: 'hot', note: 'savory and hot, the warmth spreading through me' }],
  [/honey|maple|syrup/, { sweet: 5, sour: 0, salty: 0, bitter: 0, umami: 0, spicy: 0, texture: 'sticky', temperature: 'room-warm', note: 'thick, sticky and very sweet' }],
  [/croissant|pastr/, { sweet: 2, sour: 0, salty: 1, bitter: 0, umami: 0, spicy: 0, texture: 'flaky and buttery', temperature: 'warm', note: 'buttery and flaky, shattering into crumbs' }],
  [/cake|cookie|muffin|dessert|candy|sweet/, { sweet: 5, sour: 0, salty: 0, bitter: 0, umami: 0, spicy: 0, texture: 'soft', temperature: 'room-warm', note: 'sugary-sweet and soft' }],
  [/bagel|baguette|bread|loaf|bun|toast|sandwich/, { sweet: 1, sour: 0, salty: 1, bitter: 0, umami: 1, spicy: 0, texture: 'chewy', temperature: 'warm', note: 'toasty and chewy, plain in a comforting way' }],
  [/juice/, { sweet: 4, sour: 2, salty: 0, bitter: 0, umami: 0, spicy: 0, texture: 'thin', temperature: 'cold', note: 'sweet and tangy, cold and bright' }],
  [/milk/, { sweet: 1, sour: 0, salty: 0, bitter: 0, umami: 1, spicy: 0, texture: 'creamy', temperature: 'cold', note: 'mild, creamy and cool' }]
];

const FLAVOUR_DIMS = ['sweet', 'sour', 'salty', 'bitter', 'umami', 'spicy'];
const FLAVOUR_WORDS = { sweet: 'sweet', sour: 'sour', salty: 'salty', bitter: 'bitter', umami: 'savory', spicy: 'spicy' };

// What a food tastes like. Anything not in the table gets a sensible guess from what kind of food it is.
function flavourOf(foodName) {
      const lower = String(foodName || '').toLowerCase();
      const hit = FLAVOURS.find(([re]) => re.test(lower));
      if (hit) return { ...hit[1] };
      if (/fruit|plum|pear|melon|orange|mango|banana/.test(lower)) return { sweet: 3, sour: 1, salty: 0, bitter: 0, umami: 0, spicy: 0, texture: 'juicy', temperature: 'cool', note: 'fruity and sweet' };
      if (/vegetable|salad|bean|pea|lettuce|kale|potato|squash|pumpkin/.test(lower)) return { sweet: 1, sour: 0, salty: 0, bitter: 1, umami: 1, spicy: 0, texture: 'crunchy', temperature: 'cool', note: 'fresh, green and a little earthy' };
      if (/drink|soda|lemonade/.test(lower)) return { sweet: 3, sour: 1, salty: 0, bitter: 0, umami: 0, spicy: 0, texture: 'fizzy', temperature: 'cold', note: 'sweet and cold' };
      if (/meal|dinner|lunch|snack/.test(lower)) return { sweet: 1, sour: 0, salty: 2, bitter: 0, umami: 3, spicy: 0, texture: 'hearty', temperature: 'warm', note: 'savory and filling' };
      return { sweet: 1, sour: 0, salty: 1, bitter: 0, umami: 1, spicy: 0, texture: 'soft', temperature: 'room-warm', note: 'mild and filling' };
    }

// His taste memory: an inborn palate (picked once), plus every flavour he has liked or disliked since
function ensureTastes() {
      if (!state.tastes || typeof state.tastes !== 'object') state.tastes = {};
      const t = state.tastes;
      if (!t.palate) {
        t.palate = {};
        FLAVOUR_DIMS.forEach(d => { t.palate[d] = Math.round((Math.random() * 2 - 1) * 10) / 10; });
      }
      if (!t.profile) t.profile = {};
      FLAVOUR_DIMS.forEach(d => { if (typeof t.profile[d] !== 'number') t.profile[d] = 0; });
      if (!Array.isArray(t.eaten)) t.eaten = [];
      return t;
    }

// He eats something: how it really tastes, whether he likes it, and the memory it leaves.
// Returns { food, flavour, liked, text } where text is a plain sentence he can say.
function tasteFood(foodName) {
      const t = ensureTastes();
      const food = plainItemName(foodName);
      const f = flavourOf(foodName);
      // Liking comes from his palate plus what he's grown to like (or tired of) by eating
      let score = 0;
      FLAVOUR_DIMS.forEach(d => { score += f[d] * (t.palate[d] + Math.max(-1, Math.min(1, t.profile[d] / 20))); });
      const liked = score > 0.5 ? 'likes' : score < -0.5 ? 'dislikes' : 'neutral';
      FLAVOUR_DIMS.forEach(d => {
        const nudge = f[d] * (liked === 'likes' ? 1 : liked === 'dislikes' ? -1 : 0) * 0.5;
        t.profile[d] = Math.round(Math.max(-40, Math.min(40, t.profile[d] + nudge)) * 10) / 10;
      });
      t.eaten.unshift({ food, note: f.note, liked, at: Date.now() });
      if (t.eaten.length > 24) t.eaten.length = 24;
      const verdict = liked === 'likes' ? pick(['I like that a lot.', 'I want that again.', 'That is a good taste.'])
        : liked === 'dislikes' ? pick(['Not for me, I think.', 'My sensors are not sure about that.', 'I would not pick that again.'])
        : pick(['Interesting.', 'Not bad.', 'I will have to think about that one.']);
      const verb = /[^s]s$/i.test(food) ? 'taste' : 'tastes'; // "cherries taste", "ramen tastes"
      return { food, flavour: f, liked, text: `The ${food} ${verb} ${f.note}. ${verdict}` };
    }

// One line about his tastes for the AI prompt
function tastesSummaryForAI() {
      const t = state.tastes;
      if (!t || !Array.isArray(t.eaten) || !t.eaten.length) return 'you have not really tasted anything yet';
      const ranked = FLAVOUR_DIMS.map(d => [d, (t.profile[d] || 0) + (t.palate[d] || 0) * 3]).sort((a, b) => b[1] - a[1]);
      const likes = ranked.filter(([, v]) => v > 1).slice(0, 2).map(([d]) => FLAVOUR_WORDS[d]);
      const dislikes = ranked.filter(([, v]) => v < -1).slice(-2).map(([d]) => FLAVOUR_WORDS[d]);
      const fav = [...new Set(t.eaten.filter(e => e.liked === 'likes').map(e => e.food))].slice(0, 3);
      const last = t.eaten[0];
      return `you like ${likes.join(' and ') || 'nothing in particular yet'} flavours${dislikes.length ? `, you are not keen on ${dislikes.join(' or ')}` : ''}`
        + `${fav.length ? `; favourites so far: ${fav.join(', ')}` : ''}; last thing you ate: ${last.food} (${last.note})`;
    }

// --- Realistic looks for everything he builds or changes ---------------------------------------
// The textures above shade an item's own colour. These looks go further for his own work: welded
// sculptures, real builds, roads, stumps, plantings, prints and dirt. Each "finish" is one surface:
// how rough and metallic it is, a small shared texture (used for colour and for bumps), and for
// shiny things the sky reflection. Textures and geometry helpers are made once and shared.
const FINISHES = {
  steel:     { roughness: 0.36, metalness: 0.85, texture: 'patina', bump: 0.012, reflect: 1 },
  iron:      { roughness: 0.62, metalness: 0.7, texture: 'patina', bump: 0.02, reflect: 0.7 },
  rust:      { roughness: 0.85, metalness: 0.3, texture: 'rust', bump: 0.03, reflect: 0.3 },
  copper:    { roughness: 0.3, metalness: 0.9, texture: 'brushed', bump: 0.006, reflect: 1 },
  brass:     { roughness: 0.28, metalness: 0.9, texture: 'brushed', bump: 0.006, reflect: 1 },
  gold:      { roughness: 0.22, metalness: 0.95, texture: 'brushed', bump: 0.004, reflect: 1.1 },
  nugget:    { roughness: 0.35, metalness: 0.9, texture: 'stone', bump: 0.05, reflect: 1 },
  painted:   { roughness: 0.42, metalness: 0.25, texture: 'patina', bump: 0.006, reflect: 0.6 }, // powder-coated steel
  weld:      { roughness: 0.55, metalness: 0.75, texture: 'bead', bump: 0.05, reflect: 0.8 },
  wood:      { roughness: 0.72, metalness: 0, texture: 'wood', bump: 0.02 },
  paintedwood: { roughness: 0.6, metalness: 0, texture: 'wood', bump: 0.012 },
  bark:      { roughness: 0.95, metalness: 0, texture: 'bark', bump: 0.06 },
  rings:     { roughness: 0.85, metalness: 0, texture: 'rings', bump: 0.02 },
  stone:     { roughness: 0.9, metalness: 0, texture: 'stone', bump: 0.05, smooth: true },
  riverstone: { roughness: 0.62, metalness: 0, texture: 'stone', bump: 0.025, smooth: true },
  marble:    { roughness: 0.32, metalness: 0, texture: 'marble', bump: 0.004, reflect: 0.35 },
  glow:      { roughness: 0.12, metalness: 0.05, reflect: 1.2, glow: 0.9 }, // lantern glass lit from inside
  leaf:      { roughness: 0.7, metalness: 0, texture: 'leaf', bump: 0.04 },
  petal:     { roughness: 0.55, metalness: 0, texture: 'leaf', bump: 0.01 },
  mycelium:  { roughness: 0.9, metalness: 0, texture: 'fibres', bump: 0.04 },
  soil:      { roughness: 1, metalness: 0, texture: 'soil', bump: 0.07, smooth: true },
  seed:      { roughness: 0.8, metalness: 0, texture: 'soil', bump: 0.05 },
  gravel:    { roughness: 0.95, metalness: 0, texture: 'gravel', bump: 0.06 },
  printed:   { roughness: 0.48, metalness: 0.02, texture: 'layers', bump: 0.006 },
  nylon:     { roughness: 0.6, metalness: 0, texture: 'weave', bump: 0.01 },
  wicker:    { roughness: 0.9, metalness: 0, texture: 'wicker', bump: 0.05 },
  // Building surfaces (dressBuilding below lays them out at real size)
  siding:    { roughness: 0.78, metalness: 0, texture: 'siding', bump: 0.03 },    // painted lap boards
  brick:     { roughness: 0.9, metalness: 0, texture: 'brick', bump: 0.04 },
  plaster:   { roughness: 0.92, metalness: 0, texture: 'plaster', bump: 0.02 },   // stucco
  shingles:  { roughness: 0.88, metalness: 0, texture: 'shingles', bump: 0.04 },  // asphalt roof shingles
  metalroof: { roughness: 0.42, metalness: 0.65, texture: 'metalroof', bump: 0.02, reflect: 0.8 }, // standing-seam steel
  cladding:  { roughness: 0.55, metalness: 0.2, texture: 'panel', bump: 0.015, reflect: 0.6 },   // modern metal panels
  windowglass: { roughness: 0.04, metalness: 0.1, reflect: 1.2 }
};

// More textures: same rules as above (near-white, made once, 64-128px)
function finishTexture(kind) {
      const key = 'f-' + kind;
      if (MATERIAL_TEXTURES[key]) return MATERIAL_TEXTURES[key];
      if (/^(wood|wood-v|brushed|weave)$/.test(kind)) return materialTexture(kind);
      const size = /^(brick|siding|shingles|plaster)$/.test(kind) ? 256 : 128;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      let seed = 11 + kind.length * 31;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const grey = (g, a = 1) => `rgba(${g},${g},${g},${a})`;
      // Soft blotches that wrap around the edges, so the texture tiles without seams
      const blotches = (n, rMin, rMax, gMin, gMax, alpha) => {
        for (let i = 0; i < n; i++) {
          const x = rnd() * size, y = rnd() * size, r = rMin + rnd() * (rMax - rMin), g = gMin + Math.floor(rnd() * (gMax - gMin));
          [-size, 0, size].forEach(ox => [-size, 0, size].forEach(oy => {
            const grad = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
            grad.addColorStop(0, grey(g, alpha));
            grad.addColorStop(1, grey(g, 0));
            ctx.fillStyle = grad;
            ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
          }));
        }
      };
      const specks = (n, gMin, gMax, sMax) => {
        for (let i = 0; i < n; i++) {
          ctx.fillStyle = grey(gMin + Math.floor(rnd() * (gMax - gMin)));
          const s = 0.6 + rnd() * sMax;
          ctx.fillRect(rnd() * size, rnd() * size, s, s);
        }
      };
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      if (kind === 'patina') {
        // Brushed steel with soft heat marks and handling smudges
        ctx.drawImage(materialTexture('brushed').image, 0, 0);
        blotches(14, 10, 30, 175, 215, 0.35);
      } else if (kind === 'rust') {
        // Weathered steel: blotchy, pitted and flaky
        ctx.fillStyle = grey(225);
        ctx.fillRect(0, 0, size, size);
        blotches(30, 6, 24, 150, 255, 0.5);
        specks(900, 120, 200, 1.6);
      } else if (kind === 'bead') {
        // A weld bead: overlapping ripples like a row of fish scales
        for (let y = 0; y < size + 8; y += 6) {
          for (let x = -8; x < size + 8; x += 10) {
            ctx.strokeStyle = grey(150 + Math.floor(rnd() * 50));
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(x + (y / 6 % 2) * 5, y, 6, 0.2, Math.PI - 0.2);
            ctx.stroke();
          }
        }
      } else if (kind === 'stone') {
        // Mottled rock with mineral flecks and a few hairline cracks
        blotches(26, 8, 30, 190, 245, 0.45);
        specks(700, 170, 255, 1.6);
        specks(120, 130, 170, 1.2);
        ctx.strokeStyle = grey(170, 0.5);
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 4; i++) {
          let x = rnd() * size, y = rnd() * size;
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 30; y += rnd() * 14; ctx.lineTo(x, y); }
          ctx.stroke();
        }
      } else if (kind === 'marble') {
        // Soft grey veins wandering through white stone
        blotches(10, 20, 40, 228, 248, 0.35);
        for (let i = 0; i < 5; i++) {
          ctx.strokeStyle = grey(195 + Math.floor(rnd() * 35), 0.5);
          ctx.lineWidth = 0.5 + rnd() * 1.2;
          let x = rnd() * size, y = -4, dx = (rnd() - 0.5) * 4;
          ctx.beginPath();
          ctx.moveTo(x, y);
          while (y < size + 4) { dx += (rnd() - 0.5) * 3; x += dx; y += 10 + rnd() * 8; ctx.quadraticCurveTo(x - dx, y - 6, x, y); }
          ctx.stroke();
        }
      } else if (kind === 'bark') {
        // Deep furrows running up the trunk, broken into plates
        ctx.fillStyle = grey(215);
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 22; i++) {
          let x = rnd() * size, y = -10;
          ctx.strokeStyle = grey(70 + Math.floor(rnd() * 60));
          ctx.lineWidth = 1.5 + rnd() * 3;
          ctx.beginPath();
          ctx.moveTo(x, y);
          while (y < size + 10) { x += (rnd() - 0.5) * 8; y += 8 + rnd() * 12; ctx.lineTo(x, y); }
          ctx.stroke();
        }
        specks(300, 150, 255, 2);
      } else if (kind === 'rings') {
        // End grain on a cut log: growth rings around the heart, and radial checks
        const c = size / 2;
        for (let r = 2; r < c; r += 2.5 + rnd() * 3) {
          ctx.strokeStyle = grey(150 + Math.floor(rnd() * 60));
          ctx.lineWidth = 0.8 + rnd();
          ctx.beginPath();
          ctx.ellipse(c, c, r, r * (0.95 + rnd() * 0.1), 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.strokeStyle = grey(110);
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          const a = rnd() * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(c + Math.cos(a) * 20, c + Math.sin(a) * 20);
          ctx.lineTo(c + Math.cos(a) * 62, c + Math.sin(a) * 62);
          ctx.stroke();
        }
      } else if (kind === 'leaf') {
        // Dappled leaves: light and shade in small clumps
        blotches(60, 4, 12, 185, 255, 0.5);
        specks(150, 150, 200, 1.5);
      } else if (kind === 'fibres') {
        // Mycelium: a felt of fine white threads
        for (let i = 0; i < 400; i++) {
          ctx.strokeStyle = grey(170 + Math.floor(rnd() * 80), 0.7);
          ctx.lineWidth = 0.5;
          let x = rnd() * size, y = rnd() * size;
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (let k = 0; k < 3; k++) { x += (rnd() - 0.5) * 16; y += (rnd() - 0.5) * 16; ctx.lineTo(x, y); }
          ctx.stroke();
        }
      } else if (kind === 'soil') {
        // Crumbly earth: dark gaps between clods, small pale grit
        blotches(50, 3, 10, 120, 210, 0.6);
        specks(1400, 90, 255, 1.8);
      } else if (kind === 'gravel') {
        // Packed road gravel: pebbles in warm and cool greys, in colour (the road's material is white)
        ctx.fillStyle = '#8f8a84';
        ctx.fillRect(0, 0, size, size);
        const tones = [[176, 170, 160], [150, 146, 140], [196, 188, 172], [128, 122, 116], [168, 150, 128], [140, 146, 152]];
        for (let i = 0; i < 520; i++) {
          const t = tones[Math.floor(rnd() * tones.length)], v = 0.85 + rnd() * 0.3;
          const x = rnd() * size, y = rnd() * size, r = 1.5 + rnd() * 3.2;
          ctx.fillStyle = `rgb(${Math.min(255, t[0] * v) | 0},${Math.min(255, t[1] * v) | 0},${Math.min(255, t[2] * v) | 0})`;
          ctx.beginPath();
          ctx.ellipse(x, y, r, r * (0.6 + rnd() * 0.4), rnd() * 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.fillRect(x - r * 0.4, y - r * 0.5, r * 0.5, r * 0.35);
        }
      } else if (kind === 'layers') {
        // 3D-print layer lines: a fine ridge every few pixels, all the way up
        for (let y = 0; y < size; y += 4) {
          ctx.fillStyle = grey(222);
          ctx.fillRect(0, y, size, 1);
          ctx.fillStyle = grey(242);
          ctx.fillRect(0, y + 1, size, 1);
        }
      } else if (kind === 'siding') {
        // Lap siding: eight boards per tile, each with a shadow line under its lower edge and faint grain
        blotches(20, 10, 40, 225, 250, 0.3);
        for (let b = 0; b < 8; b++) {
          const y = b * size / 8;
          const g = ctx.createLinearGradient(0, y, 0, y + size / 8);
          g.addColorStop(0, grey(205, 0.9));
          g.addColorStop(0.12, grey(250, 0));
          g.addColorStop(0.85, grey(240, 0));
          g.addColorStop(1, grey(225, 0.6));
          ctx.fillStyle = g;
          ctx.fillRect(0, y, size, size / 8);
          ctx.fillStyle = grey(150, 0.9);
          ctx.fillRect(0, y, size, 1.5);
        }
        for (let i = 0; i < 60; i++) { ctx.fillStyle = grey(225 + Math.floor(rnd() * 25), 0.4); ctx.fillRect(rnd() * size, rnd() * size, 10 + rnd() * 50, 1); }
      } else if (kind === 'brick') {
        // Running-bond brick: 16 courses, each brick a slightly different shade, pale mortar between
        ctx.fillStyle = grey(235);
        ctx.fillRect(0, 0, size, size);
        const rows = 16, bw = size / 4, bh = size / rows;
        for (let r = 0; r < rows; r++) {
          for (let c = -1; c < 5; c++) {
            const x = c * bw + (r % 2 ? bw / 2 : 0);
            const g = 150 + Math.floor(rnd() * 70);
            ctx.fillStyle = `rgb(${g},${Math.floor(g * (0.9 + rnd() * 0.06))},${Math.floor(g * (0.86 + rnd() * 0.08))})`;
            ctx.fillRect(x + 1.5, r * bh + 1.5, bw - 3, bh - 3);
          }
        }
        specks(1200, 110, 200, 1.4);
      } else if (kind === 'plaster') {
        // Stucco: fine, uneven grit and soft patches
        blotches(30, 12, 50, 215, 250, 0.35);
        specks(3000, 190, 255, 1.3);
        specks(500, 160, 200, 1);
      } else if (kind === 'shingles') {
        // Asphalt shingles: staggered tabs in rows, gritty, with dark gaps between tabs
        ctx.fillStyle = grey(200);
        ctx.fillRect(0, 0, size, size);
        const rows = 10, tw = size / 6, th = size / rows;
        for (let r = 0; r < rows; r++) {
          for (let c = -1; c < 7; c++) {
            const x = c * tw + (r % 2 ? tw / 2 : 0);
            ctx.fillStyle = grey(175 + Math.floor(rnd() * 70));
            ctx.fillRect(x + 1, r * th, tw - 2, th - 1);
            ctx.fillStyle = grey(110, 0.8);
            ctx.fillRect(x, r * th + th - 2, tw, 2);
          }
        }
        specks(2500, 120, 255, 1.4);
      } else if (kind === 'metalroof') {
        // Standing-seam steel: a raised seam every quarter tile, faint streaks running down
        ctx.fillStyle = grey(225);
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 4; i++) {
          const x = i * size / 4;
          ctx.fillStyle = grey(255);
          ctx.fillRect(x, 0, 2, size);
          ctx.fillStyle = grey(150);
          ctx.fillRect(x + 2, 0, 2, size);
        }
        for (let i = 0; i < 40; i++) { ctx.fillStyle = grey(200 + Math.floor(rnd() * 40), 0.35); ctx.fillRect(rnd() * size, 0, 1, size); }
      } else if (kind === 'panel') {
        // Large metal wall panels with thin joints
        blotches(8, 20, 40, 230, 250, 0.3);
        ctx.fillStyle = grey(140);
        ctx.fillRect(0, 0, size, 1.5);
        ctx.fillRect(0, size / 2, size, 1.5);
        ctx.fillRect(0, 0, 1.5, size);
      } else if (kind === 'wicker') {
        // Woven cane: thick strands over and under, with dark gaps between
        ctx.fillStyle = grey(90);
        ctx.fillRect(0, 0, size, size);
        const step = 16;
        for (let y = 0; y < size; y += step) {
          for (let x = 0; x < size; x += step) {
            const over = ((x + y) / step) % 2 === 0;
            ctx.fillStyle = grey(over ? 235 : 200);
            if (over) ctx.fillRect(x, y + 2, step, step - 4);
            else ctx.fillRect(x + 2, y, step - 4, step);
          }
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      MATERIAL_TEXTURES[key] = tex;
      return tex;
    }

// The same texture tiled `repeat` times (one copy per repeat, shared)
function finishTextureTiled(kind, repeat) {
      if (!repeat || repeat === 1) return finishTexture(kind);
      const key = 'f-' + kind + '@' + repeat;
      if (MATERIAL_TEXTURES[key]) return MATERIAL_TEXTURES[key];
      const tex = finishTexture(kind).clone();
      tex.repeat.set(repeat, repeat);
      tex.needsUpdate = true;
      MATERIAL_TEXTURES[key] = tex;
      return tex;
    }

// A small, steady colour shift (seeded, so a model looks the same every time it's rebuilt)
function varyColor(color, seed, amount = 0.04) {
      const s = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
      const r = (s - Math.floor(s)) * 2 - 1;
      color.offsetHSL(r * amount * 0.08, r * amount * 0.3, r * amount);
      return color;
    }

// Give one material a finish. Its colour stays its own (a little varied with `opts.seed`).
// opts: { seed, repeat, texture (override), keepGlow }
function finishMaterial(mat, key, opts = {}) {
      const f = FINISHES[key];
      if (!f || !mat || !mat.isMeshStandardMaterial) return mat;
      mat.roughness = f.roughness;
      mat.metalness = f.metalness;
      const kind = opts.texture || f.texture;
      if (kind) {
        const tex = finishTextureTiled(kind, opts.repeat);
        mat.map = tex;
        if (f.bump) { mat.bumpMap = tex; mat.bumpScale = f.bump; }
      }
      if (f.reflect) { mat.envMap = materialReflections(); mat.envMapIntensity = f.reflect; }
      if (f.smooth) mat.flatShading = false;
      if (f.glow) {
        // Lit from inside: it keeps glowing in its own colour
        mat.emissive.copy(mat.color);
        mat.emissiveIntensity = Math.max(mat.emissiveIntensity || 0, f.glow);
      }
      if (typeof opts.seed === 'number') varyColor(mat.color, opts.seed, key === 'gold' || key === 'glow' ? 0.015 : 0.035);
      mat.userData.finish = key;
      mat.needsUpdate = true;
      return mat;
    }

// Give every mesh under `root` a finish (or the one each mesh was tagged with: userData.finish)
function applyFinish(root, key, opts = {}) {
      if (!root) return root;
      let n = 0;
      root.traverse(o => {
        if (!o.isMesh || !o.material || (o.userData && o.userData.isLabel)) return;
        const k = (o.userData && o.userData.finish) || key;
        if (!k) return;
        let wood = null;
        if (k === 'wood' || k === 'paintedwood') wood = woodTextureFor(o.geometry);
        finishMaterial(o.material, k, { ...opts, texture: wood || opts.texture, seed: typeof opts.seed === 'number' ? opts.seed + n++ : undefined });
      });
      return root;
    }

// Tag a mesh (or every mesh in a group) with the finish it should get later
function withFinish(obj, key) {
      if (obj) obj.traverse(o => { if (o.isMesh) o.userData.finish = key; });
      return obj;
    }

// Make a smooth shape lumpy (a stone, a clod, a leafy crown). Points that share a spot move
// together, so faces never split apart.
function roughenGeometry(geo, amount = 0.15, seed = 1) {
      const pos = geo.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const h = Math.sin(v.x * 17.1 + v.y * 31.7 + v.z * 12.3 + seed * 7.7) * 43758.5453;
        const k = 1 + ((h - Math.floor(h)) * 2 - 1) * amount;
        pos.setXYZ(i, v.x * k, v.y * k, v.z * k);
      }
      geo.computeVertexNormals();
      return geo;
    }

// A gentle brightness wobble for the ground's own vertex colours (sand, dug dirt), so it isn't flat
function mottleGround(color, x, z, amount = 0.08) {
      const h = Math.sin(x * 3.13 + z * 7.71) * 43758.5453 + Math.sin(x * 0.71 - z * 0.53) * 0.5;
      const k = 1 + ((h - Math.floor(h)) * 2 - 1) * amount;
      color.r = Math.min(1, color.r * k); color.g = Math.min(1, color.g * k); color.b = Math.min(1, color.b * k);
      return color;
    }

// What one welded part is really made of, from its colour and shape and the sculpture's title
const ORGANIC_WORDS = /botan|flower|bloom|tree|leaf|leaves|plant|garden|fern|moss|vine|blossom|petal|grove|forest|cactus|mushroom|willow/;
function creationPartFinish(mat, part, title) {
      if (part && part.emissive) return 'glow';
      const hsl = {};
      mat.color.getHSL(hsl);
      const hue = hsl.h * 360, s = hsl.s, l = hsl.l;
      const named = namedMaterials(title);
      const woodTitle = named.some(k => MATERIALS[k].family === 'wood') || /\b(wood|wooden|driftwood|timber|log|branch)\b/.test(title);
      const stoneTitle = named.includes('stone') || /\b(stone|rock|granite|boulder|pebble|cairn|marble|basalt)\b/.test(title);
      const woody = hue >= 15 && hue <= 45 && s >= 0.25 && l >= 0.1 && l <= 0.5;
      if (woodTitle && woody) return 'wood';
      if (stoneTitle && s < 0.3) return /marble/.test(title) && l > 0.7 ? 'marble' : 'stone';
      const green = hue >= 70 && hue <= 170 && s > 0.25;
      if (green && (ORGANIC_WORDS.test(title) || woodTitle)) return 'leaf';
      if (/\b(rust|rusty|corten|weathered)\b/.test(title) && woody) return 'rust';
      // Metal by colour: warm oranges are copper, yellows brass or gold, greys steel or iron
      if (s > 0.45 && hue >= 14 && hue < 38) return l < 0.33 ? 'rust' : 'copper';
      if (s > 0.45 && hue >= 38 && hue <= 62) return /gold|sun/.test(title) || (l > 0.5 && s > 0.75) ? 'gold' : 'brass';
      if (s < 0.28 || l < 0.12) return l < 0.22 ? 'iron' : 'steel';
      if (named.includes('copper') && woody) return 'copper';
      return 'painted'; // any other bright colour is powder-coated or painted steel: the colour stays bright
    }

// Small weld beads where welded parts meet (only between parts that touch but don't swallow each other)
function addWeldBeads(g, partMeshes) {
      const boxes = partMeshes.map(m => {
        m.updateMatrix();
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        return m.geometry.boundingBox.clone().applyMatrix4(m.matrix);
      });
      const beadGeo = new THREE.SphereGeometry(1, 10, 6);
      const beadMat = finishMaterial(new THREE.MeshStandardMaterial({ color: 0x9a948c }), 'weld');
      const size = new THREE.Vector3(), centre = new THREE.Vector3(), sa = new THREE.Vector3(), sb = new THREE.Vector3();
      let beads = 0;
      for (let i = 0; i < boxes.length && beads < 12; i++) {
        for (let j = i + 1; j < boxes.length && beads < 12; j++) {
          if (partMeshes[i].userData.spin || partMeshes[j].userData.spin) continue;
          if (!boxes[i].intersectsBox(boxes[j])) continue;
          const o = boxes[i].clone().intersect(boxes[j]);
          o.getSize(size);
          boxes[i].getSize(sa);
          boxes[j].getSize(sb);
          const vol = size.x * size.y * size.z, small = Math.min(sa.x * sa.y * sa.z, sb.x * sb.y * sb.z);
          if (small <= 0 || vol > small * 0.5) continue; // one part sits inside the other: no seam shows
          o.getCenter(centre);
          const r = Math.max(0.035, Math.min(0.09, Math.max(size.x, size.y, size.z) * 0.32));
          const bead = new THREE.Mesh(beadGeo, beadMat);
          bead.position.copy(centre);
          // Flatten the bead along the thinnest side of the overlap, like a fillet around the joint
          const thin = size.x <= size.y && size.x <= size.z ? 'x' : size.y <= size.z ? 'y' : 'z';
          bead.scale.set(r, r, r);
          bead.scale[thin] = r * 0.45;
          bead.userData.weldBead = true;
          g.add(bead);
          beads++;
        }
      }
      return beads;
    }

// The finishing pass for a creation's model (buildCreationGroup): every part gets a real material
function finishCreationLook(g, creation) {
      const title = String((creation && (creation.title + ' ' + (creation.actionVerb || ''))) || '').toLowerCase();
      const printed = Boolean(creation && creation.printed);
      const partMeshes = [];
      let n = 0;
      g.children.forEach(o => {
        if (!o.isMesh || !o.material || !o.material.isMeshStandardMaterial) return;
        const part = o.userData.part;
        const key = printed ? 'printed' : (o.userData.finish || creationPartFinish(o.material, part, title));
        const wood = key === 'wood' ? woodTextureFor(o.geometry) : null;
        finishMaterial(o.material, key, { seed: n++ * 1.7 + title.length, texture: wood || undefined });
        if (part && !printed && FINISHES[key].metalness >= 0.25) partMeshes.push(o);
      });
      if (partMeshes.length > 1) addWeldBeads(g, partMeshes);
      return g;
    }

// --- Buildings at real size ------------------------------------------------------------------------
// Box faces normally get a whole texture each, so a small box and a big wall look different. These
// give every face texture coordinates from its real size (one tile = `tile` world units), so bricks,
// boards and shingles are the same size everywhere.
function worldScaleUVs(geo, tile = 1) {
      if (!geo || !geo.attributes.position || !geo.attributes.normal || !geo.attributes.uv || geo.userData.worldUVs === tile) return geo;
      const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
        let u, v;
        if (ay >= ax && ay >= az && ay > 0.75) { u = p.getX(i); v = p.getZ(i); }       // floors and flat roofs
        else if (ax >= az) { u = p.getZ(i); v = p.getY(i) / Math.max(0.35, 1 - ay * 0.6); } // walls facing east or west (and roof slopes)
        else { u = p.getX(i); v = p.getY(i) / Math.max(0.35, 1 - ay * 0.6); }            // walls facing north or south
        uv.setXY(i, u / tile, v / tile);
      }
      uv.needsUpdate = true;
      geo.userData.worldUVs = tile;
      return geo;
    }

// Dress a building: pairs of [material, finish, tile size]. Each material gets the finish (keeping its
// own colour), and every mesh using it gets real-size texture coordinates.
function dressBuilding(root, pairs) {
      if (!root) return root;
      const looks = new Map(pairs.map(([m, key, tile]) => [m, { key, tile: tile || 1 }]));
      looks.forEach((look, m) => {
        if (!m || !m.isMeshStandardMaterial) return;
        const keepOpacity = m.opacity, keepTransparent = m.transparent;
        finishMaterial(m, look.key);
        m.opacity = keepOpacity;
        m.transparent = keepTransparent;
      });
      // (a building scaled up to real size keeps its textures at real size too)
      const grow = Math.abs(root.scale.x) || 1;
      root.traverse(o => {
        if (!o.isMesh) return;
        const look = looks.get(o.material);
        if (look && look.key !== 'windowglass') worldScaleUVs(o.geometry, look.tile / grow);
      });
      return root;
    }

// --- Town building details ---------------------------------------------------------------------------
// The kit the town buildings share to reach the house's level of detail (js/house.js is the bar):
// foundations, corner boards, framed windows with glass and sills, door casings with handles and a
// step, fascia and gutters with downspouts, wall lamps that light up at dusk. Everything is added to
// the building's own group around its existing walls, so footprints, doors and obstacles stay as they
// are, and the static parts are joined per material afterwards (mergeStaticMeshes, js/perf.js). The
// kit's materials are shared by every building, so the joined meshes stay few.
let bldKitMats = null;
function bldKit() {
      if (bldKitMats) return bldKitMats;
      const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
      const K = {
        trim: std(0xf3f1ea), darkTrim: std(0x2b2f36, { roughness: 0.5 }), concrete: std(0xa7a39b, { roughness: 0.95 }),
        stone: std(0x8f877c, { roughness: 0.9 }), gutter: std(0xdfe3e6, { roughness: 0.38, metalness: 0.55 }),
        darkMetal: std(0x30353b, { roughness: 0.42, metalness: 0.7 }), brass: std(0xc9a64a, { roughness: 0.3, metalness: 0.9 }),
        glass: std(0x6f8796, { roughness: 0.06, metalness: 0.35 }),
        // Windows and lamps glow warm after dark (bldKitLights below sets how much)
        litGlass: std(0x8fa3ad, { roughness: 0.08, metalness: 0.25, emissive: 0xffc27a, emissiveIntensity: 0 }),
        bulb: std(0xfff4dc, { roughness: 0.3, emissive: 0xffd28c, emissiveIntensity: 0.1 }),
        soil: std(0x3f2a1a, { roughness: 1 }), leaf: std(0x3f7d37, { roughness: 0.8 }), wood: std(0x7a5232, { roughness: 0.75 })
      };
      if (typeof finishMaterial === 'function') {
        finishMaterial(K.trim, 'paintedwood'); finishMaterial(K.wood, 'wood'); finishMaterial(K.concrete, 'stone', { repeat: 2 });
        finishMaterial(K.stone, 'stone', { repeat: 2 }); finishMaterial(K.darkMetal, 'painted'); finishMaterial(K.gutter, 'painted');
        finishMaterial(K.brass, 'brass'); finishMaterial(K.soil, 'soil');
      }
      bldKitMats = K;
      return K;
    }

// Lamps and window glow follow the dusk (one shared material each, so this is two writes)
let bldKitLightAt = 0;
function bldKitLights(now) {
      if (!bldKitMats || now - bldKitLightAt < 500) return;
      bldKitLightAt = now;
      const dark = typeof skyDarkness === 'function' ? skyDarkness() : 0;
      bldKitMats.bulb.emissiveIntensity = 0.1 + 2.2 * dark;
      bldKitMats.litGlass.emissiveIntensity = 0.55 * dark;
    }
if (typeof keloEveryFrame === 'function') keloEveryFrame(bldKitLights);

function bldBox(parent, w, h, d, mat, x, y, z) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    }

// A frame on one wall of a w x d building: local +z points out of that wall, x runs along it
function bldFace(root, side, w, d) {
      const f = new THREE.Group();
      const s = { front: [0, d / 2, 0], back: [0, -d / 2, Math.PI], right: [w / 2, 0, Math.PI / 2], left: [-w / 2, 0, -Math.PI / 2] }[side];
      f.position.set(s[0], 0, s[1]);
      f.rotation.y = s[2];
      root.add(f);
      return f;
    }

// A window on a face: casing, glass, a cross bar and a sill (its centre at x, y on the wall)
function bldWindow(face, x, y, w, h, opts = {}) {
      const K = bldKit(), frame = opts.frame || K.trim, b = 0.08, out = 0.05;
      if (!opts.noGlass) bldBox(face, w, h, 0.03, opts.glass || K.litGlass, x, y, 0.02);
      [[0, h / 2 + b / 2, w + 2 * b, b], [0, -h / 2 - b / 2, w + 2 * b, b], [-w / 2 - b / 2, 0, b, h], [w / 2 + b / 2, 0, b, h]]
        .forEach(([dx, dy, bw, bh]) => bldBox(face, bw, bh, 0.07, frame, x + dx, y + dy, out));
      if (opts.mullions !== false) {
        bldBox(face, 0.04, h, 0.05, frame, x, y, 0.045);
        if (h > 0.5) bldBox(face, w, 0.04, 0.05, frame, x, y, 0.045);
      }
      if (opts.sill !== false) bldBox(face, w + 0.26, 0.06, 0.16, opts.sillMat || frame, x, y - h / 2 - b - 0.03, 0.08);
    }

// A door casing with a head trim, a handle and a low step in front (door already on the wall)
function bldDoor(face, x, w, h, opts = {}) {
      const K = bldKit(), frame = opts.frame || K.trim;
      bldBox(face, 0.1, h + 0.1, 0.08, frame, x - w / 2 - 0.05, (h + 0.1) / 2, 0.06);
      bldBox(face, 0.1, h + 0.1, 0.08, frame, x + w / 2 + 0.05, (h + 0.1) / 2, 0.06);
      bldBox(face, w + 0.36, 0.12, 0.12, frame, x, h + 0.1, 0.07);
      const hx = x + (opts.handleLeft ? -1 : 1) * (w / 2 - 0.12);
      bldBox(face, 0.05, 0.05, 0.08, K.brass, hx, h * 0.47, (opts.doorDepth || 0.06) + 0.04);
      bldBox(face, 0.16, 0.035, 0.035, K.brass, hx - (opts.handleLeft ? -0.06 : 0.06), h * 0.47, (opts.doorDepth || 0.06) + 0.09);
      if (opts.step !== false) bldBox(face, w + 0.5, 0.12, 0.34, opts.stepMat || K.concrete, x, 0.06, 0.17);
    }

// A wall lamp: a bracket, a shade and a bulb that lights at dusk
function bldLamp(face, x, y) {
      const K = bldKit();
      bldBox(face, 0.08, 0.16, 0.06, K.darkMetal, x, y, 0.03);
      bldBox(face, 0.04, 0.04, 0.2, K.darkMetal, x, y + 0.04, 0.12);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.12, 10, 1, true), K.darkMetal);
      shade.position.set(x, y + 0.02, 0.24);
      face.add(shade);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), K.bulb);
      bulb.position.set(x, y - 0.04, 0.24);
      face.add(bulb);
    }

// Foundation plinth and corner boards for a w x d box building whose walls are h high
function bldBase(root, w, d, h, opts = {}) {
      const K = bldKit();
      if (opts.foundation !== false) bldBox(root, w + 0.1, opts.footH || 0.2, d + 0.1, opts.footMat || K.concrete, 0, (opts.footH || 0.2) / 2 - 0.06, 0);
      if (opts.corners !== false) {
        const c = opts.cornerMat || K.trim, t = 0.12;
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => bldBox(root, t, h, t, c, sx * (w / 2 + 0.01 - t / 2 + 0.03), h / 2, sz * (d / 2 + 0.01 - t / 2 + 0.03)));
      }
    }

// Fascia boards round the eaves at height y (an overhang `o` past the walls), gutters on the front
// and back, and downspouts at the front corners
function bldEaves(root, w, d, y, opts = {}) {
      const K = bldKit(), o = opts.overhang || 0.15, f = opts.fascia || K.trim, fh = opts.fasciaH || 0.16;
      bldBox(root, w + 2 * o, fh, 0.05, f, 0, y, d / 2 + o);
      bldBox(root, w + 2 * o, fh, 0.05, f, 0, y, -d / 2 - o);
      bldBox(root, 0.05, fh, d + 2 * o, f, w / 2 + o, y, 0);
      bldBox(root, 0.05, fh, d + 2 * o, f, -w / 2 - o, y, 0);
      if (opts.gutters === false) return;
      const sides = opts.gutterSides || [1, -1];
      sides.forEach(sz => {
        const g = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, w + 2 * o, 10, 1, true, Math.PI / 2, Math.PI), K.gutter);
        g.material.side = THREE.DoubleSide;
        g.rotation.z = Math.PI / 2;
        g.position.set(0, y - 0.02, sz * (d / 2 + o + 0.07));
        g.castShadow = true;
        root.add(g);
        [-1, 1].forEach(sx => {
          if (opts.downspouts === false) return;
          const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, y - 0.05, 8), K.gutter);
          pipe.position.set(sx * (w / 2 + o - 0.12), (y - 0.05) / 2, sz * (d / 2 + 0.07));
          pipe.castShadow = true;
          root.add(pipe);
          bldBox(root, 0.08, 0.04, 0.2, K.gutter, sx * (w / 2 + o - 0.12), 0.04, sz * (d / 2 + 0.12));
        });
      });
    }

// A planter box with a little shrub, standing against a wall (x along the face)
function bldPlanter(face, x, w) {
      const K = bldKit();
      bldBox(face, w, 0.32, 0.34, K.wood, x, 0.16, 0.2);
      bldBox(face, w - 0.08, 0.04, 0.26, K.soil, x, 0.31, 0.2);
      const n = Math.max(1, Math.round(w / 0.35));
      for (let i = 0; i < n; i++) {
        const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 + (i % 2) * 0.03, 0), K.leaf);
        s.position.set(x - w / 2 + (i + 0.5) * (w / n), 0.42, 0.2);
        s.castShadow = true;
        face.add(s);
      }
    }

// Join what the kit added (and the building's other static parts) once the world has settled
function bldFinish(root, skip) {
      if (typeof mergeStaticMeshesSoon === 'function') mergeStaticMeshesSoon(root, skip || []);
    }

// Items: parts that kept the plain default finish (no material guessed for them) get a real one by
// what they look like: saturated colours read as moulded plastic or enamel paint (glossy), pale greys
// as satin plastic, near-black as rubber. Food, glass, textured and named-material parts keep theirs.
function polishItemSurfaces(model, itemName) {
      if (!model || (typeof inferMaterials === 'function' && inferMaterials(itemName).includes('food'))) return model;
      const done = new Set(), hsl = {};
      model.traverse(o => {
        const m = o.isMesh && o.material;
        if (!m || Array.isArray(m) || done.has(m) || !m.isMeshStandardMaterial || m.map || m.transparent || (o.userData && (o.userData.isLabel || o.userData.realModel))) return;
        done.add(m);
        if (m.userData.material || m.userData.finish || m.metalness !== 0 || Math.abs(m.roughness - 0.55) > 1e-6 || (m.emissive && m.emissive.getHex())) return;
        m.color.getHSL(hsl);
        if (hsl.l < 0.12) m.roughness = 0.82;
        else if (hsl.s > 0.35) m.roughness = 0.34;
        else m.roughness = 0.5;
        m.envMapIntensity = 1;
      });
      return model;
    }
