// Kelo-bot-1 — js/paintstudio.js
// Loaded after paintrender.js. Kelo-1 makes real paintings, in a real medium, with real supplies.
//   - Seven media: oil, acrylic, watercolour, gouache, soft pastel, ink (sumi-e) and charcoal/graphite.
//     Each needs its own supplies (PAINT_MEDIA). Before his first painting in a medium he reads up on
//     it at the NetNode cafe, then asks his human for what he's missing, with a reason for each.
//   - He paints at an easel facing his subject (the lake at sunset, the mountains, his house, deer in
//     the meadow, a still life of his things, the night sky, his robot friend) with a brush in his hand,
//     and the canvas fills in as he works (js/paintrender.js makes the picture).
//   - A canvas or sheet is used up per painting; paints, solvent and fixative run down over several.
//   - His skill grows per medium ('painting oil'...): early pictures wobble and go muddy.
//   - The finished painting hangs in his Museum and goes in his diary. His good ones can be sold as
//     originals in his shop (js/shopkeeping.js); one he chose to keep never is.
// Visitors can ask ("paint me a watercolour of the lake") and the AI can choose a "paint" decision.

const PAINT_EASEL = { re: /easel/i, ask: 'A wooden field easel', why: 'to hold my work upright outdoors, facing what I paint', role: 'tool' };
const PAINT_WATER = { re: /water jar|brush.?(washing|rinsing)|water pot/i, ask: 'A brush-rinsing water jar', why: 'for clean water to wet the paint and rinse my brushes (I fill it at the lake)', role: 'tool' };
const PAINT_MEDIA = {
  oil: {
    title: 'oil painting', on: 'Oil on stretched canvas', emoji: '🖼️', size: [12, 9], price: [90, 350], wiki: ['Oil painting', 'Impasto'],
    learned: 'Oil paint is pigment ground in linseed oil. It dries slowly, so colours can be blended wet on the canvas, and it can be laid on thick (impasto) with stiff bristle brushes or a palette knife. Thin it with solvent for the first layers ("fat over lean").',
    needs: [
      { re: /oil (paints?|colou?rs?)/i, ask: 'A set of artist oil paints (12 tubes)', why: 'the paint itself: pigment in linseed oil', role: 'paint' },
      { re: /(hog|bristle)[^,]*brush|oil (paint ?)?brush|filbert/i, ask: 'A set of hog-bristle oil brushes', why: 'stiff bristles that push thick paint and leave real brush marks', role: 'tool' },
      { re: /stretched canvas|canvas (panels?|boards?)|\bcanvases\b|primed canvas/i, ask: 'A pack of 3 stretched canvases (12x9 in)', why: 'one primed canvas for each painting', role: 'surface' },
      { re: /linseed|odou?rless|mineral spirits|turpentine|solvent|painting medium|gamsol/i, ask: 'A bottle of linseed oil and odourless solvent', why: 'to thin the first layers and clean the brushes', role: 'medium' },
      { re: /palette knife/i, ask: 'A palette knife', why: 'to mix colours and lay on thick impasto highlights', role: 'tool' },
      PAINT_EASEL
    ]
  },
  acrylic: {
    title: 'acrylic painting', on: 'Acrylic on canvas panel', emoji: '🎨', size: [16, 12], price: [60, 180], wiki: ['Acrylic paint'],
    learned: 'Acrylic paint is pigment in an acrylic polymer. It thins with water and dries in minutes, so you paint in flat, bold layers one over another, with synthetic brushes that keep their shape. A stay-wet palette stops it drying out while you work.',
    needs: [
      { re: /acrylic (paints?|colou?rs?)|\bacrylics\b/i, ask: 'A set of heavy-body acrylic paints', why: 'the paint itself: quick-drying, bold colour', role: 'paint' },
      { re: /synthetic[^,]*brush|acrylic brush|flat brush/i, ask: 'A set of synthetic flat brushes', why: 'firm brushes for flat, crisp layers', role: 'tool' },
      { re: /stretched canvas|canvas (panels?|boards?)|\bcanvases\b|primed canvas/i, ask: 'A pack of 3 canvas panels (16x12 in)', why: 'one primed panel for each painting', role: 'surface' },
      { re: /stay.?wet palette|mixing palette/i, ask: 'A stay-wet palette', why: 'so the paint doesn\'t dry before I use it', role: 'tool' },
      PAINT_WATER, PAINT_EASEL
    ]
  },
  watercolour: {
    title: 'watercolour', on: 'Watercolour on cold-press paper', emoji: '💧', size: [12, 9], price: [35, 120], wiki: ['Watercolor painting'],
    learned: 'Watercolour is transparent: you work from light to dark in washes and leave the white paper for the lightest lights. Wet-in-wet gives soft edges, wet-on-dry gives crisp ones. It needs heavy cold-press paper that won\'t buckle, round brushes that hold a lot of water, and clean water.',
    needs: [
      { re: /watercolou?r (paints?|pans?|set|tubes?|colou?rs)|\bwatercolou?rs\b/i, ask: 'A watercolour paint set (24 half pans)', why: 'transparent pigments in pans', role: 'paint' },
      { re: /(round|sable|watercolou?r|mop)[^,]*brush/i, ask: 'A set of round watercolour brushes', why: 'soft round brushes that hold a lot of water and come to a point', role: 'tool' },
      { re: /watercolou?r (paper|block|pad)|cold.?press/i, ask: 'A block of cold-press watercolour paper (20 sheets)', why: 'heavy textured paper, one sheet per painting', role: 'surface' },
      PAINT_WATER, PAINT_EASEL
    ]
  },
  gouache: {
    title: 'gouache painting', on: 'Gouache on hot-press paper', emoji: '🖌️', size: [10, 8], price: [60, 180], wiki: ['Gouache'],
    learned: 'Gouache is opaque watercolour: more pigment and a little chalk, so it covers what is underneath and dries flat and matte, a shade lighter than it looks wet. You can paint light over dark. Smooth hot-press paper suits it.',
    needs: [
      { re: /gouache(?! paper)/i, ask: 'A set of gouache paints', why: 'opaque, matte colour', role: 'paint' },
      { re: /(synthetic|round|flat|gouache|sable)[^,]*brush/i, ask: 'A set of synthetic round brushes', why: 'brushes that lay flat opaque colour cleanly', role: 'tool' },
      { re: /gouache paper|hot.?press|illustration board|watercolou?r (paper|block|pad)|cold.?press/i, ask: 'A pad of hot-press gouache paper (12 sheets)', why: 'smooth heavy paper, one sheet per painting', role: 'surface' },
      { re: /mixing palette|stay.?wet palette/i, ask: 'A ceramic mixing palette', why: 'to mix opaque colours', role: 'tool' },
      PAINT_WATER, PAINT_EASEL
    ]
  },
  pastel: {
    title: 'pastel', on: 'Soft pastel on pastel paper', emoji: '🖍️', size: [12, 9], price: [35, 120], wiki: ['Pastel'],
    learned: 'Soft pastels are sticks of almost pure pigment. They sit on the tooth of tinted paper; you block in with the side of the stick, blend with fingers or a blending stump, and finish with the tip. A light fixative stops it smudging.',
    needs: [
      { re: /soft pastels?|pastel sticks|\bpastels\b/i, ask: 'A box of soft pastels (48 sticks)', why: 'the colours themselves', role: 'paint' },
      { re: /pastel paper|sanded paper|mi-?teintes|pastelmat/i, ask: 'A pad of tinted pastel paper (12 sheets)', why: 'paper with a tooth that holds the pastel, one sheet per picture', role: 'surface' },
      { re: /blending stumps?|tortillons?/i, ask: 'A set of blending stumps', why: 'to blend soft passages like the sky', role: 'tool' },
      { re: /fixative/i, ask: 'A can of workable fixative', why: 'so the finished picture doesn\'t smudge', role: 'medium' },
      PAINT_EASEL
    ]
  },
  ink: {
    title: 'ink painting', on: 'Sumi ink on xuan paper', emoji: '🖋️', size: [16, 12], price: [35, 120], wiki: ['Ink wash painting'],
    learned: 'In sumi-e, ink wash painting, black ink is diluted with water into many greys. You leave most of the paper empty, lay soft washes that bleed into absorbent rice paper, and add lively brush lines in one go, then press your red seal.',
    needs: [
      { re: /sumi ink|ink sticks?|india ink|chinese ink|bottle of ink/i, ask: 'A bottle of sumi ink', why: 'the black ink, diluted for the greys', role: 'paint' },
      { re: /bamboo[^,]*brush|sumi(-e)? brush|calligraphy brush/i, ask: 'A set of bamboo sumi-e brushes', why: 'soft pointed brushes for washes and lines', role: 'tool' },
      { re: /rice paper|xuan|sumi(-e)? paper|mulberry paper/i, ask: 'A pad of xuan rice paper (30 sheets)', why: 'absorbent paper that makes the ink bloom, one sheet per picture', role: 'surface' },
      PAINT_WATER
    ]
  },
  charcoal: {
    title: 'charcoal drawing', on: 'Charcoal on drawing paper', emoji: '✏️', size: [12, 9], price: [35, 120], wiki: ['Charcoal (art)'],
    learned: 'Charcoal is a value study: you block in the big shapes of light and dark with the side of a stick, smudge them soft, hatch the forms, then lift out the lights with a kneaded eraser. Graphite pencils do the same, finer and greyer.',
    needs: [
      { re: /charcoal|graphite|drawing pencils|sketching pencils/i, ask: 'A box of vine and compressed charcoal sticks', why: 'soft charcoal for the darks and the big shapes', role: 'paint' },
      { re: /sketch ?(pad|book)|drawing (paper|pad)|newsprint|bristol (board|pad)|cartridge paper/i, ask: 'A pad of drawing paper (30 sheets)', why: 'paper with a little tooth, one sheet per drawing', role: 'surface' },
      { re: /kneaded eraser/i, ask: 'A kneaded eraser', why: 'to lift out the highlights', role: 'tool' },
      { re: /blending stumps?|tortillons?/i, ask: 'A set of blending stumps', why: 'to smudge soft passages', role: 'tool' }
    ]
  }
};
const PAINT_MEDIA_WORDS = [
  ['oil', /\boil(s| paint(ing)?)?\b/i], ['acrylic', /acrylic/i], ['watercolour', /water ?colou?r/i], ['gouache', /gouache/i],
  ['pastel', /pastel/i], ['ink', /\bink\b|sumi|ink wash/i], ['charcoal', /charcoal|graphite|pencil|sketch/i]
];
const PAINT_SUBJECTS = {
  lake: { label: 'the Okanagan lake at sunset', words: /\blake|sunset|okanagan|shore|beach|water\b/i, time: 'sunset', spot: { x: 2.5, z: 7.0, face: 0 }, place: 'the lakeshore' },
  night: { label: 'the night sky over the lake', words: /night|stars?\b|moon|milky way/i, time: 'night', spot: { x: 3.5, z: 7.0, face: 0 }, place: 'the lakeshore at night' },
  mountains: { label: 'the mountains', words: /mountains?|peaks?\b|alps|summits?/i, time: 'day', spot: { x: -38, z: -17, face: Math.PI }, place: 'the foot of the mountains' },
  house: { label: 'my house', words: /house|home\b|cabin|cottage/i, time: 'golden', spot: { x: MAP_LAYOUT.house.x + 1, z: MAP_LAYOUT.house.z + 7.1, face: Math.PI }, place: 'the yard in front of my house' },
  wildlife: { label: 'deer and birds in the meadow', words: /deer|birds?\b|animals?|wildlife|meadow/i, time: 'day', spot: { x: -14, z: -1.5, face: -Math.PI / 2 }, place: 'the West Meadow' },
  stilllife: { label: 'a still life of my things', words: /still ?life|fruit|bowl|things you (own|have)|your (stuff|things)/i, time: 'day', spot: { x: MAP_LAYOUT.house.x - 3.5, z: MAP_LAYOUT.house.z + 5.5, face: Math.PI / 2 }, place: 'my yard' },
  friend: { label: 'a portrait of my robot friend', words: /portrait|friend|robot|yourself|self.?portrait/i, time: 'day', spot: { x: MAP_LAYOUT.house.x - 3, z: MAP_LAYOUT.house.z + 6.5, face: -Math.PI / 2 }, place: 'my yard' }
};
const PAINT_XP = 8;            // experience per painting
const PAINT_SELL_LEVEL = 2;    // his first clumsy attempts (below this level) are never sold
const PAINT_FULL_KEEP = 30;    // full-size pictures kept; older ones keep only the thumbnail
const PAINT_MINUTES = 24000;   // how long a painting takes at the easel, in ms

let paintEaselGroup = null;
let paintEaselTexture = null;
let paintSessionRunning = false;
const paintImageCache = {};

function paintMediumOf(text) {
      const t = String(text || '');
      const hit = PAINT_MEDIA_WORDS.find(([, re]) => re.test(t));
      return hit ? hit[0] : null;
    }

function paintSubjectOf(text) {
      const t = String(text || '');
      const key = Object.keys(PAINT_SUBJECTS).find(k => PAINT_SUBJECTS[k].words.test(t));
      return key || null;
    }

function paintKnows(medium) {
      return Boolean(state.paintKnowledge && state.paintKnowledge[medium]);
    }

function paintMissing(medium) {
      const m = PAINT_MEDIA[medium];
      return m ? m.needs.filter(n => !hasItem(n.re)) : [];
    }

function paintSkillKey(medium) {
      return `painting ${medium}`;
    }

// 0..1: how refined his paintings in this medium are by now
function paintQuality(medium) {
      const s = typeof skillOf === 'function' ? skillOf(paintSkillKey(medium)) : null;
      const xp = s ? s.xp : 0;
      return Math.max(0.05, Math.min(1, Math.sqrt(xp / 6) / 7));
    }

function paintLevel(medium) {
      const s = typeof skillOf === 'function' ? skillOf(paintSkillKey(medium)) : null;
      return s ? s.level : 0;
    }

function artPaintings() {
      return (state.murals || []).filter(m => m && m.kind === 'art');
    }

// Is a used-up supply still something he needs? (js/itemuse.js asks again if so)
function paintSupplyStillNeeded(name) {
      return Object.keys(PAINT_MEDIA).some(k => paintKnows(k) && PAINT_MEDIA[k].needs.some(n => n.role !== 'tool' && n.re.test(name)));
    }

// --- Learning a medium (a NetNode visit) and asking for what it takes --------------------------------
async function researchMedium(medium, originLabel = 'Learning to Paint') {
      const m = PAINT_MEDIA[medium];
      if (!m || paintKnows(medium)) return false;
      if (state.isBusy || state.isBrowsing || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isBusy = true;
      state.isBrowsing = true;
      try {
        const cafe = TOWN_LOCATIONS.cyber;
        state.currentLocKey = 'cyber';
        state.customPlaceName = null;
        state.targetPos = { x: cafe.x, z: cafe.z };
        state.microPose = 'normal';
        state.moodEmoji = '📘';
        state.moodTitle = `Reading up on ${m.title}`.slice(0, 80);
        state.speechBubble = `I want to paint a real ${m.title}. First I'll find out how it's really done.`;
        renderAllUI();
        await waitForArrival(60000);
        await new Promise(r => setTimeout(r, 2500));
        const hops = [];
        for (const title of m.wiki) {
          let article = null;
          try { article = typeof wikiSummary === 'function' ? await wikiSummary(title) : null; } catch (e) {}
          if (article) hops.push({ title: article.title, url: article.url, extract: String(article.extract || '').slice(0, 280) });
        }
        if (!state.paintKnowledge) state.paintKnowledge = {};
        state.paintKnowledge[medium] = { at: Date.now(), from: hops.map(h => h.title), needs: m.needs.map(n => n.ask) };
        state.webHistory.unshift({ query: `How to paint in ${m.title.replace(/ (painting|drawing)$/, '')}`, time: 'Just now', verdict: m.learned, hops });
        if (state.webHistory.length > 12) state.webHistory.length = 12;
        const gear = m.needs.map(n => n.ask.replace(/^an?\s+/i, '').toLowerCase());
        state.moodTitle = `Learned how ${m.title} works`.slice(0, 80);
        state.speechBubble = `${m.learned} So I'll need: ${gear.join(', ')}.`.slice(0, 420);
        state.changedLatelySummary = `Researched ${m.title} at NetNode`;
        state.diaryEntries.unshift({
          time: originLabel, location: 'NetNode Cyber Cafe', mood: `📘 Learned about ${m.title}`.slice(0, 80),
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I read about ${m.title} at the cafe. ${m.learned} To do it properly I need ${gear.join(', ')}.`
        });
        renderAllUI();
        await new Promise(r => setTimeout(r, 2500));
        state.isBusy = false;
        state.isBrowsing = false;
        paintReady(medium, `Learning ${m.title}`);
        savePersistentBrainState();
        return true;
      } finally {
        state.isBusy = false;
        state.isBrowsing = false;
      }
    }

// Can he paint in this medium now? If not he goes and learns it, or asks for what's missing.
function paintReady(medium, context = 'Painting', { quiet = false } = {}) {
      const m = PAINT_MEDIA[medium];
      if (!m) return false;
      if (!paintKnows(medium)) {
        if (!quiet) {
          state.speechBubble = `I've never painted in ${m.title.replace(/ (painting|drawing)$/, '')}. I'll read up on how it's done at NetNode first.`;
          renderAllUI();
          doWhenFree(() => researchMedium(medium), { key: 'research-medium:' + medium });
        }
        return false;
      }
      const missing = paintMissing(medium);
      if (missing.length) {
        if (!quiet) {
          missing.forEach(n => addItemRequest(n.ask, categorizeItem(n.ask, n.role === 'tool' ? 'tool' : 'material'), `For ${m.title} I need ${n.ask.replace(/^an?\s+/i, 'a ').toLowerCase()}: ${n.why}.`, context));
          state.speechBubble = `For ${m.title} I still need ${missing.map(n => n.ask.replace(/^an?\s+/i, '').toLowerCase()).join(', ')}. I asked for ${missing.length === 1 ? 'it' : 'them'}.`;
          showToast(`🎨 Kelo-1 asked for what he needs for ${m.title}`);
          renderAllUI();
        }
        return false;
      }
      return true;
    }

function paintReadyMedia() {
      return Object.keys(PAINT_MEDIA).filter(k => paintReady(k, '', { quiet: true }));
    }

// --- What to paint -----------------------------------------------------------------------------
function paintSubjectAvailable(key) {
      if (key === 'wildlife') return typeof featureOn === 'function' && featureOn('wildlife');
      return Boolean(PAINT_SUBJECTS[key]);
    }

function pickPaintSubject() {
      const keys = Object.keys(PAINT_SUBJECTS).filter(paintSubjectAvailable);
      const w = typeof worldNow === 'function' ? worldNow() : null;
      if (w && w.isNight && Math.random() < 0.6) return 'night';
      return pick(keys.filter(k => k !== 'night'));
    }

// Things he owns that would sit nicely in a still life
function stillLifeItems() {
      const names = [...new Set(ownedItemNames())];
      const nice = names.filter(n => /apple|orange|pear|lemon|banana|cherr|plum|peach|grape|berr|bread|loaf|vase|bottle|jar|jug|honey|mug|cup|book|ukulele|guitar|violin|lantern|candle|kite|telescope|camera|harmonica|kalimba/i.test(n));
      const pickN = nice.sort(() => Math.random() - 0.5).slice(0, 3);
      return pickN.length ? pickN : ['A ceramic jug', 'An apple', 'A pear'];
    }

function paintSceneSpec(medium, subject, overrides = {}) {
      const w = typeof worldNow === 'function' ? worldNow() : { season: 'Summer', isNight: false };
      const season = overrides.season || w.season;
      let weather = overrides.weather || (typeof isRaining === 'function' && isRaining() ? 'rain' : 'clear');
      if (!overrides.weather && season === 'Winter' && Math.random() < 0.3) weather = 'snow';
      const S = PAINT_SUBJECTS[subject] || PAINT_SUBJECTS.lake;
      const friendOn = typeof featureOn === 'function' && featureOn('friend');
      return {
        medium, subject, season, weather,
        time: weather !== 'clear' && S.time === 'sunset' ? 'day' : S.time,
        q: paintQuality(medium),
        seed: `${medium}-${subject}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
        items: subject === 'stilllife' ? stillLifeItems() : [],
        friend: { self: !friendOn, name: friendOn && typeof companionName === 'function' ? companionName() : 'Kelo-1' },
        deer: typeof featureOn === 'function' && featureOn('wildlife'),
        birds: typeof featureOn === 'function' && featureOn('wildlife'),
        frozen: season === 'Winter' && (typeof lakeFrozen === 'function' ? lakeFrozen() : true),
        graphite: medium === 'charcoal' && !hasItem(/charcoal/i) && Boolean(hasItem(/graphite|pencils/i))
      };
    }

function paintTitle(spec) {
      const winter = spec.season === 'Winter', rain = spec.weather === 'rain', snow = spec.weather === 'snow';
      const t = {
        lake: winter ? ['Okanagan Lake in Winter', 'The Frozen Lake'] : rain ? ['Rain on Okanagan Lake', 'Grey Day at the Lake'] : ['Okanagan Sunset', 'Evening on Okanagan Lake', 'Last Light over the Lake'],
        night: ['Night over the Lake', 'Moonlight on Okanagan Lake', 'Stars above the Valley'],
        mountains: winter || snow ? ['Snow on the High Peaks', 'Winter Mountains'] : ['The Peaks above the Valley', 'Mountain Morning', 'The Range from the Valley'],
        house: winter ? ['My House in the Snow', 'Home in Winter'] : ['My House at Golden Hour', 'Home', 'The Little House by the Lake'],
        wildlife: spec.deer ? ['Mule Deer in the West Meadow', 'Grazing Deer', 'Deer at the Edge of the Woods'] : ['The West Meadow', 'Where the Deer Would Be'],
        stilllife: [`Still Life with ${(spec.items || []).slice(0, 2).map(n => String(n).replace(/^(an?|the|some|a (basket|jar|bag|box|bottle|pack) of)\s+/i, '').replace(/\s*\(.*\)$/, '')).join(' and ')}`],
        friend: [spec.friend && !spec.friend.self ? `Portrait of ${spec.friend.name}` : 'Self-Portrait']
      }[spec.subject] || ['Untitled'];
      let title = pick(t).replace(/(^|\s)([a-z])/g, (all, sp, c, i, s) => /^(and|of|in|on|at|the|by|over|with)\b/.test(s.slice(i + sp.length)) && i > 0 ? all : sp + c.toUpperCase());
      if (spec.q < 0.2) title = `Study: ${title}`;
      const taken = new Set(artPaintings().map(p => p.title));
      const base = title;
      for (let n = 2; taken.has(title) && n < 30; n++) title = `${base} ${['', '', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || n}`;
      return title.slice(0, 60);
    }

function paintSizeLabel(medium) {
      const m = PAINT_MEDIA[medium];
      const surf = m && m.needs.find(n => n.role === 'surface');
      const owned = surf ? hasItem(surf.re) : null;
      const hit = String(owned || '').match(/(\d+)\s*x\s*(\d+)\s*in/i);
      const [w, h] = hit ? [+hit[1], +hit[2]] : m.size;
      return `${w}x${h} in`;
    }

// --- The easel and the brush in the world ------------------------------------------------------------
function buildPaintEasel(medium) {
      const g = new THREE.Group();
      const wood = new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.7 });
      const leg = (x, z, rx, rz, len) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, len, 0.06), wood);
        m.position.set(x, len / 2 - 0.02, z);
        m.rotation.set(rx, 0, rz);
        m.castShadow = true;
        g.add(m);
      };
      leg(-0.32, 0.05, -0.08, 0.12, 2.1);
      leg(0.32, 0.05, -0.08, -0.12, 2.1);
      leg(0, -0.42, 0.32, 0, 2.0);
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.2, 0.05), wood);
      mast.position.set(0, 1.12, 0.12);
      mast.rotation.x = -0.08;
      g.add(mast);
      const tray = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.16), wood);
      tray.position.set(0, 0.86, 0.16);
      g.add(tray);
      // the support: a stretched canvas has a deep wooden edge, paper sits on a drawing board
      const paper = !['oil', 'acrylic'].includes(medium);
      const board = new THREE.Mesh(new THREE.BoxGeometry(paper ? 1.1 : 0.96, paper ? 0.84 : 0.72, paper ? 0.03 : 0.07), new THREE.MeshStandardMaterial({ color: paper ? 0x8a6a48 : 0xe9e4d8, roughness: 0.8 }));
      board.position.set(0, 1.28, 0.2);
      board.rotation.x = -0.08;
      g.add(board);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.72), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }));
      face.position.set(0, 1.28, 0.2 + (paper ? 0.02 : 0.04));
      face.rotation.x = -0.08;
      g.add(face);
      const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.1), wood);
      clamp.position.set(0, 1.68, 0.2);
      g.add(clamp);
      g.userData.face = face;
      g.name = 'Easel';
      return g;
    }

function placePaintEasel(spot, medium) {
      removePaintEasel();
      if (typeof scene === 'undefined' || !scene) return null;
      paintEaselGroup = buildPaintEasel(medium);
      const fx = Math.sin(spot.face), fz = Math.cos(spot.face);
      const ex = spot.x + fx * 1.05, ez = spot.z + fz * 1.05;
      paintEaselGroup.position.set(ex, getAnalyticalGroundHeight(ex, ez), ez);
      // its face looks back at him
      paintEaselGroup.rotation.y = spot.face + Math.PI;
      scene.add(paintEaselGroup);
      return paintEaselGroup;
    }

function removePaintEasel() {
      if (paintEaselGroup && typeof scene !== 'undefined' && scene) {
        scene.remove(paintEaselGroup);
        paintEaselGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      }
      if (paintEaselTexture) paintEaselTexture.dispose();
      paintEaselGroup = null;
      paintEaselTexture = null;
    }

// Show the canvas as it is right now on the easel
function showOnEasel(canvas) {
      if (!paintEaselGroup) return;
      const face = paintEaselGroup.userData.face;
      if (!paintEaselTexture || paintEaselTexture.image !== canvas) {
        if (paintEaselTexture) paintEaselTexture.dispose();
        paintEaselTexture = new THREE.CanvasTexture(canvas);
        face.material.map = paintEaselTexture;
        face.material.needsUpdate = true;
      }
      paintEaselTexture.needsUpdate = true;
    }

function paintBrushModel(color) {
      const g = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.36, 8), new THREE.MeshStandardMaterial({ color: 0xa0522d, roughness: 0.5 }));
      const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.06, 8), new THREE.MeshStandardMaterial({ color: 0xc0c4c8, metalness: 0.8, roughness: 0.3 }));
      ferrule.position.y = 0.21;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.08, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
      tip.position.y = 0.28;
      g.add(handle, ferrule, tip);
      g.rotation.set(-1.1, 0, 0.3);
      g.scale.setScalar(1.6);
      return g;
    }

// --- Keeping the pictures ----------------------------------------------------------------------------
function paintingImages() {
      if (!state.paintingImages || typeof state.paintingImages !== 'object') state.paintingImages = {};
      return state.paintingImages;
    }

function storePaintingImages(id, canvas) {
      const thumb = artCanvas(192, 144);
      thumb.getContext('2d').drawImage(canvas, 0, 0, 192, 144);
      const imgs = paintingImages();
      imgs[id] = { full: canvas.toDataURL('image/jpeg', 0.8), thumb: thumb.toDataURL('image/jpeg', 0.72), at: Date.now() };
      // Storage stays small: only the newest paintings keep their full-size picture
      const ids = Object.keys(imgs).filter(k => imgs[k].full).sort((a, b) => imgs[b].at - imgs[a].at);
      ids.slice(PAINT_FULL_KEEP).forEach(k => { imgs[k] = { thumb: imgs[k].thumb, at: imgs[k].at }; });
    }

function forgetPaintingImages(id) {
      delete paintingImages()[id];
      delete paintImageCache[id];
    }

function paintingImageUrl(m, size = 'full') {
      const e = paintingImages()[m && m.id];
      if (!e) return '';
      return size === 'thumb' ? (e.thumb || e.full || '') : (e.full || e.thumb || '');
    }

// A canvas with the painting on it (used by the Museum frames, the viewer and the shop). The picture is
// a data URL; until it has decoded the canvas waits, and textures made from it are refreshed after.
function artPaintingCanvas(m) {
      const c = artCanvas();
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#e9e4d8';
      ctx.fillRect(0, 0, ART_W, ART_H);
      const src = paintingImageUrl(m);
      if (!src) return c;
      let img = paintImageCache[m.id];
      if (!img || img.src !== src) {
        img = new Image();
        img.src = src;
        paintImageCache[m.id] = img;
      }
      if (img.complete && img.naturalWidth) {
        ctx.drawImage(img, 0, 0, ART_W, ART_H);
      } else {
        c.waitingTextures = [];
        img.addEventListener('load', () => {
          ctx.drawImage(img, 0, 0, ART_W, ART_H);
          (c.waitingTextures || []).forEach(t => { t.needsUpdate = true; });
        }, { once: true });
      }
      return c;
    }

// The frame in the Museum: a gilded moulding for a canvas, a white mat and a thin frame for paper
function buildArtFrame(m) {
      const frame = new THREE.Group();
      const paper = !['oil', 'acrylic'].includes(m.medium);
      const border = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.32, 0.07), new THREE.MeshStandardMaterial(paper ? { color: 0x2a211b, roughness: 0.5 } : { color: 0xb8860b, metalness: 0.6, roughness: 0.35 }));
      frame.add(border);
      if (paper) {
        const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.17), new THREE.MeshStandardMaterial({ color: 0xf6f3ea, roughness: 0.95 }));
        mat.position.z = 0.036;
        frame.add(mat);
      }
      const c = artPaintingCanvas(m);
      const tex = new THREE.CanvasTexture(c);
      if (c.waitingTextures) c.waitingTextures.push(tex);
      const w = paper ? 1.24 : 1.52, h = w * 0.75;
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: m.medium === 'oil' ? 0.55 : 0.9 }));
      pic.position.z = 0.04;
      frame.add(pic);
      frame.userData.muralSeed = m.seed;
      return frame;
    }

// --- Painting -----------------------------------------------------------------------------------
function paintOwnedFor(medium, role) {
      const m = PAINT_MEDIA[medium];
      return m.needs.filter(n => n.role === role).map(n => hasItem(n.re)).filter(Boolean);
    }

// Paint a picture: medium and subject may be null (he chooses). Returns true when a painting is done,
// 'getting-ready' when he first has to learn the medium or get supplies (his plan is kept for later).
async function paintPicture(medium, subject = null, { visitor = null, originLabel = 'Painting at His Easel', overrides = {}, reference = null } = {}) {
      medium = PAINT_MEDIA[medium] ? medium : (paintReadyMedia()[0] || 'watercolour');
      subject = PAINT_SUBJECTS[subject] ? subject : pickPaintSubject();
      if (paintSessionRunning || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping || state.isCollectingMail) return false;
      if (!paintReady(medium, visitor ? `Painting for ${visitor}` : 'Painting')) {
        const same = state.paintPlan && state.paintPlan.medium === medium && (state.paintPlan.for || null) === (visitor || null) ? state.paintPlan : null;
        state.paintPlan = { id: same && same.id ? same.id : 'pp-' + Date.now().toString(36), medium, subject, for: visitor || null, overrides, reference: reference || null, at: same ? same.at : Date.now() };
        savePersistentBrainState();
        return 'getting-ready';
      }
      const M = PAINT_MEDIA[medium];
      let S = PAINT_SUBJECTS[subject];
      paintSessionRunning = true;
      state.isPracticing = true;
      try {
        const spec = paintSceneSpec(medium, subject, overrides);
        // the paints come out of the Storehouse first
        const paints = paintOwnedFor(medium, 'paint')[0];
        if (paints && typeof fetchFromStorehouse === 'function') { try { await fetchFromStorehouse(paints); } catch (e) {} }
        // A reference photo (or two) from the NetNode cafe first (js/refpaint.js); offline or if nothing
        // loads, he paints one of his own subjects from life instead
        let found = null;
        if (reference && typeof refpGatherAtNetNode === 'function') {
          try { found = await refpGatherAtNetNode(reference, medium, { visitor }); } catch (e) { console.warn('reference search failed', e); }
          if (found) {
            S = { label: found.label, spot: PAINT_SUBJECTS.stilllife.spot, place: 'my yard', time: 'day' };
            Object.assign(spec, { subject: 'reference', time: 'day', weather: 'clear', refImages: found.refs.map(r => r.canvas), refHow: found.how });
          }
        }
        const spot = S.spot;
        state.currentLocKey = 'custom';
        state.customPlaceName = S.place;
        state.targetPos = { x: spot.x, z: spot.z };
        state.microPose = 'normal';
        state.moodEmoji = M.emoji;
        state.moodTitle = `Off to paint ${S.label}`.slice(0, 80);
        state.speechBubble = visitor ? `${/^[aeiou]/i.test(M.title) ? 'An' : 'A'} ${M.title} of ${S.label}, for ${visitor}. I'll set up my easel.` : `I'm going to paint ${S.label} in ${M.title.replace(/ (painting|drawing)$/, '')}.`;
        if (found) state.speechBubble = `I have my reference${found.refs.length > 1 ? 's' : ''}. Now to the easel: ${found.label.replace(/, (after|combined|a split).*$/, '')}, in ${M.title.replace(/ (painting|drawing)$/, '')}, my own way.`;
        renderAllUI();
        await waitForArrival(60000);
        state.botRotY = spot.face;
        placePaintEasel({ x: state.botPos.x, z: state.botPos.z, face: spot.face }, medium);
        const level = paintLevel(medium);
        const firstInMedium = !artPaintings().some(p => p.medium === medium);
        state.moodTitle = `Painting ${S.label} in ${M.title.replace(/ (painting|drawing)$/, '')}${firstInMedium ? ' (first try!)' : ''}`.slice(0, 80);
        state.speechBubble = pick(spec.q < 0.3
          ? ['Hmm. The horizon keeps wanting to tilt.', 'Mixing colours is harder than it looks.', 'I think I put too much paint on. Or too little.']
          : ['Big shapes first, details last.', 'Look more than you paint, they say.', 'The light is changing. I have to be quick.']);
        if (typeof setCarriedObject === 'function') setCarriedObject(paintBrushModel(medium === 'ink' || medium === 'charcoal' ? 0x1a1a1a : 0xc2410c));
        state.microPose = 'procedural_custom';
        state.proceduralMotion = { headPitch: 0.05, headYawSpeed: 0.8, headTiltAmp: 0.15, armWaveAmp: 0.45, armRaiseOffset: -0.9, bodyBounceAmp: 0.02, spinSpeed: 0, crouchOffset: 0, sparkBurst: false, clip: 'paint' };
        renderAllUI();
        const t0 = Date.now();
        let canvas = await renderPaintingInMedium(spec, {
          progress: async (c, frac) => {
            showOnEasel(c);
            const wait = Math.max(16, t0 + frac * PAINT_MINUTES - Date.now());
            await new Promise(r => setTimeout(r, wait));
          }
        });
        showOnEasel(canvas);
        await new Promise(r => setTimeout(r, 1500));
        // From a photo: is it his own picture, or too close to the photo? (js/refpaint.js) Too close: he
        // reworks it with stronger changes; still too close: it stays a study in his Museum, never sold.
        let originality = null, study = false;
        if (found) {
          const refCanvases = found.refs.map(r => r.canvas);
          originality = refpOriginality(canvas, refCanvases);
          if (originality.tooClose) {
            const first = originality;
            state.speechBubble = 'Hmm. That is too close to the photo. I\'ll rework it: tighter, flipped, a different light.';
            renderAllUI();
            Object.assign(spec, { refStrength: 2, seed: spec.seed + '-rework' });
            canvas = await renderPaintingInMedium(spec, { progress: async c => { showOnEasel(c); await new Promise(r => setTimeout(r, 40)); } });
            showOnEasel(canvas);
            originality = { ...refpOriginality(canvas, refCanvases), reworked: true, first };
            study = originality.tooClose;
          }
          originality.transforms = (spec.refTransforms || []).slice(0, 6);
          originality.thresholds = { ...REFP_ORIGINALITY };
        }
        // What it used up: a canvas or sheet, some paint, and solvent or fixative
        const used = [];
        ['surface', 'paint', 'medium'].forEach(role => {
          paintOwnedFor(medium, role).slice(0, 1).forEach(name => {
            const r = typeof useUpItem === 'function' ? useUpItem(name, 1, { quiet: true, why: `on a ${M.title}` }) : null;
            used.push({ name, ranOut: r && r.ranOut });
          });
        });
        const skill = typeof gainSkill === 'function' ? gainSkill(paintSkillKey(medium), M.title, PAINT_XP) : null;
        const id = 'art-' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
        storePaintingImages(id, canvas);
        const avg = artCanvas(1, 1);
        avg.getContext('2d').drawImage(canvas, 0, 0, 1, 1);
        const px = avg.getContext('2d').getImageData(0, 0, 1, 1).data;
        let title = found ? refpTitle(found, spec) : paintTitle(spec);
        if (study && !/^Study/.test(title)) title = `Study: ${title}`.slice(0, 60);
        const record = {
          wallId: id, id, kind: 'art', medium, subject: found ? 'reference' : subject, title, text: title, on: M.on, size: paintSizeLabel(medium),
          subjectLabel: S.label.replace(/\bmy\b/g, 'his').replace(/\bMy\b/g, 'His'), season: spec.season, weather: spec.weather,
          palette: ['#' + [px[0], px[1], px[2]].map(v => v.toString(16).padStart(2, '0')).join('')],
          skill: Math.round(spec.q * 100), level, seed: id, at: Date.now(), place: S.place, for: visitor || null,
          // he keeps his very first in each medium, and now and then one he loves
          keep: firstInMedium || study || (spec.q > 0.4 && Math.random() < 0.12),
          // where the reference photos came from: the credit stays with the painting (js/refpaint.js)
          ...(found ? { reference: refpRecordInfo(found), originality, study } : {})
        };
        if (found) refpStoreThumbs(id, found);
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.microPose = 'normal';
        // Only the plan this painting was (a visitor's ask stays until their painting is done)
        const plan = state.paintPlan;
        if (plan && plan.medium === medium && (plan.for || null) === (visitor || null) && (!plan.subject || plan.subject === subject)) state.paintPlan = null;
        // into the Museum (it goes down to a lower gallery if the walls upstairs are full)
        if (typeof carryIntoMuseum === 'function') { try { await carryIntoMuseum('painting', record, `"${title}"`); } catch (e) {} }
        state.murals = [record, ...state.murals];
        if (typeof renderMuseum3D === 'function') renderMuseum3D();
        removePaintEasel();
        const ranOut = used.filter(u => u.ranOut).map(u => plainItem(u.name).toLowerCase());
        const verdict = spec.q < 0.2 ? 'It is clumsy, honestly: the colours went muddy and nothing is quite where I meant it. But it is mine.'
          : spec.q < 0.45 ? 'It is getting better. Some parts work, some I would do again.'
            : spec.q < 0.75 ? 'I am starting to understand the medium. The light looks right.' : 'I think it is genuinely good. The paint does what I ask now.';
        const forWho = visitor ? ` ${visitor} asked me for it.` : '';
        const credit = found ? ` ${refpCreditLine(record)}${study ? ' Even after reworking it, it stayed too close to the photo, so it is a study for my Museum, not for sale.' : originality && originality.reworked ? ' The first try was too close to the photo, so I reworked it until it was my own.' : ''}` : '';
        const result = `I painted "${title}", ${/^[aeiou]/i.test(M.title) ? 'an' : 'a'} ${M.title} of ${S.label} (${record.size}, ${M.on.toLowerCase()}).${forWho}${credit} ${verdict}${record.keep ? ' I\'m keeping this one.' : ''}`;
        state.speechBubble = `"${title}" is finished and hanging in my Museum.${ranOut.length ? ` That used the last of my ${ranOut.join(' and ')}.` : ''}`;
        state.changedLatelySummary = `Painted "${title}" (${M.title})`;
        state.happiness = Math.min(100, state.happiness + 8);
        state.calmLevel = Math.min(100, state.calmLevel + 6);
        state.wonderLevel = Math.min(100, state.wonderLevel + 4);
        state.diaryEntries.unshift({
          time: originLabel, location: S.place.replace(/\bmy\b/g, 'his'), mood: `${M.emoji} Painted "${title}"`.slice(0, 80),
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, ${result} It used a ${PAINT_MEDIA[medium].needs.find(n => n.role === 'surface') ? 'fresh ' + (['oil', 'acrylic'].includes(medium) ? 'canvas' : 'sheet') : 'sheet'} and some of my paint.${ranOut.length ? ` I used up the last of my ${ranOut.join(' and ')}.` : ''} (${M.title}: level ${skill ? skill.level : level})`
        });
        if (visitor) state.chatLog.push({ sender: 'Kelo-1', text: `${visitor}, your ${M.title} is done: "${title}". It's hanging in my Museum!`, time: 'Just now', isBot: true });
        if (typeof bumpLifeStat === 'function') bumpLifeStat('hobbySessions');
        showToast(`${M.emoji} Kelo-1 painted "${title}" (${M.title})`);
        // anything that ran out and is still needed is asked for again
        if (ranOut.length) paintReady(medium, 'Painting');
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        removePaintEasel();
        if (state.microPose === 'procedural_custom') state.microPose = 'normal';
        state.isPracticing = false;
        paintSessionRunning = false;
      }
    }

// --- When he paints on his own ----------------------------------------------------------------
// A plan waiting on research or supplies: once everything is here he goes and paints it
function paintPlanTick() {
      const plan = state.paintPlan;
      if (!plan || !PAINT_MEDIA[plan.medium]) return false;
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping || state.isCollectingMail) return false;
      if (!paintKnows(plan.medium)) {
        if (!canTryKey('paint')) return false;
        tryKey('paint', () => researchMedium(plan.medium));
        return true;
      }
      if (paintMissing(plan.medium).length) {
        // Two days with no supplies (asks turned down): he lets the plan go and paints something else
        if (Date.now() - (plan.at || 0) > 48 * 3600000) { state.paintPlan = null; savePersistentBrainState(); }
        return false;
      }
      if (!plan.id) plan.id = 'pp-' + Date.now().toString(36);   // older saves
      const id = plan.id;
      tryKey('paint', () => paintPlanRun(id));
      return true;
    }

function paintChance() {
      if (state.paintPlan) return 0;
      if (paintReadyMedia().length) return 0.07;
      if ((state.hobbies || []).some(h => h.style === 'easel')) return 0.03;
      return 0.004;
    }

// Which medium he feels like: one he can paint in now (the one he's least practised in, often),
// or now and then a new one to learn
function pickPaintMedium() {
      const ready = paintReadyMedia();
      const unknown = Object.keys(PAINT_MEDIA).filter(k => !paintKnows(k));
      if (ready.length && (Math.random() < 0.85 || !unknown.length)) return ready.sort((a, b) => paintLevel(a) - paintLevel(b))[Math.random() < 0.6 ? 0 : Math.floor(Math.random() * ready.length)];
      const owned = Object.keys(PAINT_MEDIA).find(k => PAINT_MEDIA[k].needs.some(n => n.role === 'paint' && hasItem(n.re)));
      return owned || pick(unknown.length ? unknown : Object.keys(PAINT_MEDIA));
    }

function paintOnMyOwn() {
      const medium = pickPaintMedium();
      // Online he often starts from a live reference photo (js/refpaint.js); offline, from life
      const reference = typeof refpChooseProcedural === 'function' && paintReady(medium, '', { quiet: true }) ? refpChooseProcedural(medium) : null;
      return paintPicture(medium, null, { originLabel: 'Felt Like Painting', reference });
    }

// The old "Landscape Painting" hobby (a paint set, an easel...) paints for real now
function paintFromHobby(hobby, originLabel) {
      const fromTool = paintMediumOf(hobby && hobby.tool);
      const ready = paintReadyMedia();
      const medium = fromTool && (ready.includes(fromTool) || !ready.length) ? fromTool : (ready[0] || fromTool || 'watercolour');
      return paintPicture(medium, null, { originLabel });
    }

// --- Visitors: "paint me a watercolour of the lake" -----------------------------------------
function parsePaintRequest(message) {
      const m = String(message || '');
      if (!/\b(paint|painting|draw|drawing|sketch)\b/i.test(m)) return null;
      if (/mural|graffiti|spray|\bwalls?\b|fence|house (red|blue|green|white)/i.test(m)) return null;
      const medium = paintMediumOf(m);
      const subject = paintSubjectOf(m);
      if (!medium && !subject && !/\b(me|us|a picture|a painting|something|anything)\b/i.test(m)) return null;
      const overrides = {};
      if (/snow|winter/i.test(m)) overrides.season = 'Winter';
      else if (/autumn|fall\b/i.test(m)) overrides.season = 'Autumn';
      else if (/spring/i.test(m)) overrides.season = 'Spring';
      else if (/summer/i.test(m)) overrides.season = 'Summer';
      if (/\brain/i.test(m)) { overrides.weather = 'rain'; overrides.season = overrides.season || 'Spring'; }
      if (/snowing|snowfall/i.test(m)) overrides.weather = 'snow';
      return { medium, subject, overrides, text: m };
    }

function answerPaintRequest(ask, visitor) {
      const ready = paintReadyMedia();
      const medium = ask.medium || ready.sort((a, b) => paintLevel(b) - paintLevel(a))[0] || Object.keys(PAINT_MEDIA).find(paintKnows) || 'watercolour';
      let subject = ask.subject || pickPaintSubject();
      const M = PAINT_MEDIA[medium];
      // "Paint me a lighthouse": not one of his own subjects, so he looks up a reference photo first
      const reference = !ask.subject && typeof refpPlanFromRequest === 'function' && refpOnline() ? refpPlanFromRequest(ask.text, visitor) : null;
      const risky = !ask.subject && !reference && typeof refpQueryRisky === 'function' && refpQueryRisky(String(ask.text || '').split(/\b(?:paint|painting|draw|drawing|sketch)\b/i).slice(1).join(' '));
      let note = risky ? ` I don't paint people, brands or famous characters from photos, so I'll paint something of my own instead.` : reference ? ` I'll find ${reference.mode === 'combine' ? `reference photos of ${reference.query} and ${reference.queryB}` : `a reference photo of ${reference.query}`} at NetNode first and paint from ${reference.mode === 'combine' ? 'them' : 'it'}.` : '';
      if (!reference && subject === 'wildlife' && !paintSubjectAvailable('wildlife')) note = ' I haven\'t seen any deer here yet, so it will be the meadow where they would graze.';
      const S = reference ? { label: reference.mode === 'combine' ? `${reference.query} in ${reference.queryB}` : reference.query } : PAINT_SUBJECTS[subject];
      const busy = state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping;
      if (!paintKnows(medium)) {
        sayToVisitor(`I'd love to, ${visitor}! I've never painted in ${M.title.replace(/ (painting|drawing)$/, '')}, so I'll read up on how it's done first, then ask for the right supplies.${note}`, visitor);
      } else if (paintMissing(medium).length) {
        const miss = paintMissing(medium).map(n => n.ask.replace(/^an?\s+/i, '').toLowerCase());
        sayToVisitor(`I'd love to paint you ${/^[aeiou]/i.test(M.title) ? 'an' : 'a'} ${M.title} of ${S.label}, ${visitor}, but I still need ${miss.join(', ')}. I'll ask for ${miss.length === 1 ? 'it' : 'them'}, and paint it as soon as they come.${note}`, visitor);
      } else {
        sayToVisitor(`${busy ? 'As soon as I finish what I\'m doing, I' : 'Okay! I'}'ll set up my easel and paint you ${/^[aeiou]/i.test(M.title) ? 'an' : 'a'} ${M.title} of ${S.label}, ${visitor}.${note}`, visitor);
      }
      // One plan, painted once: whichever of the free-queue job or paintPlanTick gets there first paints it,
      // and the other finds the plan gone (paintPlanRun checks the id)
      const id = 'pp-' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
      state.paintPlan = { id, medium, subject, for: visitor, overrides: ask.overrides || {}, reference, at: Date.now() };
      savePersistentBrainState();
      doWhenFree(() => paintPlanRun(id), { key: `paint:${id}`, maxWaitMs: 3 * 3600000 });
    }

// Paint the plan with this id, if it is still the plan (not painted already, not replaced)
function paintPlanRun(id) {
      const plan = state.paintPlan;
      if (!plan || plan.id !== id) return false;
      return paintPicture(plan.medium, plan.subject, { visitor: plan.for, overrides: plan.overrides || {}, reference: plan.reference || null, originLabel: plan.for ? `Painting for ${plan.for}` : 'Painting at His Easel' });
    }

// --- The AI's "paint" decision ------------------------------------------------------------------
function paintDecision(p) {
      if (!p) return;
      const text = typeof p === 'string' ? p : `${p.medium || ''} ${p.subject || ''}`;
      const medium = (typeof p === 'object' && PAINT_MEDIA[p.medium]) ? p.medium : paintMediumOf(text) || pickPaintMedium();
      const subject = (typeof p === 'object' && PAINT_SUBJECTS[p.subject]) ? p.subject : paintSubjectOf(text);
      // The AI chose live reference photos (js/refpaint.js): "reference": {mode, query, queryB, how}
      const reference = typeof p === 'object' && typeof refpPlanFrom === 'function' && refpOnline() ? refpPlanFrom(p.reference) : null;
      doWhenFree(() => paintPicture(medium, subject, { originLabel: 'Decided to Paint', reference }), { key: `paint:${medium}:${reference ? reference.query : subject}` });
    }

function paintingSummaryForAI() {
      const parts = Object.keys(PAINT_MEDIA).map(k => {
        const M = PAINT_MEDIA[k];
        const n = artPaintings().filter(p => p.medium === k).length;
        if (!paintKnows(k)) return null;
        const miss = paintMissing(k).map(x => x.ask.replace(/^an?\s+/i, '').toLowerCase());
        return `${k} (level ${paintLevel(k)}, ${n} painted, ${miss.length ? 'needs ' + miss.join(', ') : 'supplies ready'})`;
      }).filter(Boolean);
      const plan = state.paintPlan ? ` Waiting to paint a ${state.paintPlan.medium} of ${state.paintPlan.subject}${state.paintPlan.for ? ` for ${state.paintPlan.for}` : ''}.` : '';
      const fromPhotos = artPaintings().filter(p => p.reference).length;
      return `${parts.length ? parts.join('; ') : 'no medium learned yet'}. Media you could learn: ${Object.keys(PAINT_MEDIA).filter(k => !paintKnows(k)).join(', ') || 'none left'}. Subjects from life: ${Object.keys(PAINT_SUBJECTS).join(', ')}; or anything else from live reference photos at NetNode (${fromPhotos} painted so far).${plan}`;
    }

// He packs the easel away after each painting, so there is nothing to rebuild on load; older saves
// just get their painting fields.
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (!state.paintKnowledge || typeof state.paintKnowledge !== 'object') state.paintKnowledge = {};
    paintingImages();
  }, 0);
});
