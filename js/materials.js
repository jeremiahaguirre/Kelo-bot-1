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

function materialInfo(key) {
      return MATERIALS[key] || null;
    }

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

function materialsSummary(itemName) {
      const mats = inferMaterials(itemName);
      return mats.length ? mats.map(k => MATERIALS[k].name).join(' and ') : 'something I can\'t name';
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
        if (!o.isMesh || !o.material || !o.material.isMeshStandardMaterial || o.material.map || (o.userData && o.userData.isLabel)) return;
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
      let frame = 0;
      const step = () => {
        frame++;
        shards.forEach(s => {
          const v = s.userData.v;
          s.position.x += v.x; s.position.z += v.z; s.position.y = Math.max(floor - 0.05, s.position.y + v.y);
          v.y -= 0.012;
          v.x *= 0.9; v.z *= 0.9;
          if (s.position.y > floor - 0.05) { s.rotation.x += 0.3; s.rotation.y += 0.2; }
        });
        if (frame < 150) setTimeout(step, 30);
        else shards.forEach(s => { scene.remove(s); s.geometry.dispose(); s.material.dispose(); });
      };
      step();
      return shards;
    }

// Take something bent to the welding bench, heat it and hammer it straight again
async function straightenAtBench(name) {
      const bent = String(name || '');
      if (!/^bent\s+/i.test(bent)) return false;
      const owned = [...state.toolInventory, ...state.toys.map(t => t.name), ...state.belongings.map(b => b.name)];
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
