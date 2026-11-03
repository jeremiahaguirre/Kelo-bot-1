// Kelo-bot-1 — js/itemuse.js
// Loaded after knowhow.js. What each of his things is really for, and how much is left of the
// things that get used up.
//   - ITEM_KINDS says what every kind of thing is for (a hammer hammers and builds, a banana is
//     eaten, spray paint makes murals). Things nothing here recognises are looked up once at NetNode
//     and what they turn out to be is remembered in state.itemPurposes.
//   - usableFor(name, purpose) gates every use: hobbies, the AI's choices, taking things out of the
//     Storehouse, builds. When something can't do the job he says so and picks the right thing, or
//     asks for it.
//   - Consumables (food, seeds, gravel, fuel, spray paint, nails, batteries, film, firewood...) have
//     uses left in state.supplies: { [name]: { cur, per } }. `cur` is what's left in the copy he has
//     open; any spare copies are full. useUpItem() takes some, opens the next copy when one is
//     empty, and when the last is gone writes it in his diary and asks for more if he still needs it.
//     3D printer filament keeps its own grams in js/printer.js.

// First match wins, so the specific kinds come before the general ones.
// uses: what it's for. per: uses in one (a spray can paints ~3 murals). unit: what one use is.
const ITEM_KINDS = [
  { kind: 'filament', label: '3D printer filament', re: /filament/i, uses: ['print'], per: 'grams' },
  { kind: 'fuel', label: 'fuel for an engine or burner', re: /diesel|gasoline|petrol|\bgas can\b|jet fuel|aviation fuel|kerosene|propane/i, uses: ['fuel'], per: 100, unit: '%' },
  { kind: 'printer', label: 'a 3D printer for printing things', re: /3d printer/i, uses: ['print'] },
  // Welding: safety gear and the consumables each process burns through (matched to the metal in js/welding.js)
  { kind: 'welding hood', label: 'a welding hood that guards his eyes and face from the arc', re: /welding (hood|helmet|mask)|auto-?darkening/i, uses: ['weld'] },
  { kind: 'welding gloves', label: 'leather gloves for welding', re: /welding (gloves|gauntlets)|welder'?s gloves/i, uses: ['weld'] },
  { kind: 'tungsten', label: 'tungsten electrodes for a TIG torch', re: /tungsten/i, uses: ['weld'], per: 10, unit: 'welds', weldConsumable: true },
  { kind: 'shielding gas', label: 'shielding gas that keeps the air off a weld', re: /shielding gas|argon|\bco2\b|\bc25\b|tri-?mix|welding gas/i, uses: ['weld'], per: 8, unit: 'welds', weldConsumable: true },
  { kind: 'welding wire', label: 'filler wire for a MIG welder', re: /welding wire|mig wire|flux.?core|\ber(70s-6|4043|5356|308l?)\b.*wire/i, uses: ['weld'], per: 6, unit: 'welds', weldConsumable: true },
  { kind: 'filler rods', label: 'filler rods for TIG welding', re: /filler rods?|tig rods?/i, uses: ['weld'], per: 6, unit: 'welds', weldConsumable: true },
  { kind: 'stick electrodes', label: 'flux-coated electrodes for stick welding', re: /stick electrodes?|welding rods?|\be(6010|6011|6013|7018|7024|308l?-16|4043)\b|\belectrodes?\b/i, uses: ['weld'], per: 5, unit: 'welds', weldConsumable: true },
  { kind: 'welding supply', label: 'welding supplies', re: /welding (wire|rods?|gas)|electrodes?|argon|shielding gas|flux.?core/i, uses: ['weld'], per: 5, unit: 'welds', weldConsumable: true },
  { kind: 'welder', label: 'a tool for welding and soldering', re: /welding torch|\bwelder\b|soldering iron/i, uses: ['weld', 'fix'] },
  { kind: 'batteries', label: 'batteries to power gadgets', re: /^(?!.*(powered|operated)).*\bbatter(y|ies)\b/i, uses: ['power'], per: 5, unit: 'charges' },
  { kind: 'film', label: 'film for a camera', re: /^(?!.*camera).*\bfilm\b/i, uses: ['camera film'], per: 3, unit: 'photo walks' },
  { kind: 'camera', label: 'a camera for taking photos', re: /camera|polaroid/i, uses: ['photograph'] },
  { kind: 'birdseed', label: 'bird food', re: /bird ?seed/i, uses: ['feed birds', 'build'], per: 3, unit: 'fillings' },
  { kind: 'seeds', label: 'seeds for planting', re: /^(?!.*light ?bulb).*\b(seeds?|saplings?|bulbs?|seedlings?|acorns?|cuttings?)\b/i, uses: ['plant'], per: 4, unit: 'plantings' },
  { kind: 'paving', label: 'paving for roads and paths', re: /gravel|crushed stone|road base|asphalt|paving/i, uses: ['pave'], per: 1, unit: 'road' },
  { kind: 'spray paint', label: 'paint for murals and graffiti', re: /spray ?paint|aerosol|graffiti|paint markers?|chalk/i, uses: ['mural'], per: 3, unit: 'murals' },
  { kind: 'art tool', label: 'a tool for painting pictures', re: /paint ?brush|brushes|easel|palette knife/i, uses: ['paint'] },
  { kind: 'wood finish', label: 'a finish for woodwork', re: /wood stain|varnish|wood oil|\bstain\b/i, uses: ['build'], per: 2, unit: 'builds' },
  { kind: 'art supply', label: 'paint and paper for pictures', re: /watercolou?rs?|paint ?set|acrylics?|oil paints?|pastels|crayons|\bpaints?\b|canvas|sketchbook|drawing paper/i, uses: ['paint'], per: 5, unit: 'paintings' },
  { kind: 'glue', label: 'glue for building and mending', re: /glue|epoxy|adhesive/i, uses: ['build', 'fix'], per: 3, unit: 'jobs' },
  { kind: 'nails', label: 'nails for building', re: /^(?!.*polish).*\bnails?\b/i, uses: ['build'], per: 3, unit: 'builds' },
  { kind: 'screws', label: 'screws for building', re: /\bscrews?\b/i, uses: ['build'], per: 3, unit: 'builds' },
  { kind: 'firewood', label: 'firewood for a fire', re: /firewood|kindling|\blogs?\b|split wood/i, uses: ['fire'], per: 3, unit: 'fires' },
  { kind: 'lumber', label: 'lumber for building', re: /(?<!skate|key|surf|snow|chalk|cutting |clip|dart|card|switch|mother|paddle )boards?\b|planks?|lumber|timber|plywood|cedar|\bbeams?\b/i, uses: ['build'], per: 1, unit: 'build' },
  { kind: 'candles', label: 'candles for light', re: /candles?/i, uses: ['light', 'display'], per: 3, unit: 'evenings' },
  { kind: 'instrument', label: 'an instrument for making music',
    test: n => /harmonica|guitar|ukulele|flute|violin|cello|piano|kazoo|ocarina|kalimba|banjo|mandolin|accordion|trumpet|saxophone|clarinet|xylophone|tambourine|bongos?/i.test(n)
      || (/\bdrums?\b/i.test(n) && !/drum of|oil drum|fuel/i.test(n)) || (/keyboard/i.test(n) && !/computer/i.test(n)),
    uses: ['music', 'play'] },
  { kind: 'building material', label: 'material for building', re: /copper|pipes?\b|tubing|soil|compost|fishing line|twine|\bcord\b|cement|concrete|bricks?|mortar|\bclay\b|stained glass|sheet metal|wire\b/i, uses: ['build'], per: 1, unit: 'build' },
  { kind: 'kite', label: 'a kite for flying', re: /kite/i, uses: ['fly kite', 'play'] },
  { kind: 'toy', label: 'a toy for playing and tricks', re: /yo-?yos?|juggl|\bballs?\b|frisbee|puzzle|kaleidoscope|wind-?up|spinning tops?|marbles|lego|\bblocks\b|dolls?|teddy|plush|\btoys?\b|board game|\bgames?\b|playing cards|rubik|slinky|bubbles/i, uses: ['play', 'tricks', 'display'] },
  { kind: 'book', label: 'something to read', re: /\bbooks?\b|novel|comic|atlas|field guide|encyclopedia|magazine|star chart|\bmaps?\b/i, uses: ['read'] },
  { kind: 'telescope', label: 'a telescope for the night sky', re: /telescope/i, uses: ['stargaze'] },
  { kind: 'binoculars', label: 'binoculars for looking far away', re: /binoculars|spyglass/i, uses: ['watch birds', 'stargaze'] },
  { kind: 'dig tool', label: 'a tool for digging', re: /shovel|spade|pick ?axe?\b|mattock|trowel/i, uses: ['dig'] },
  { kind: 'rock breaker', label: 'a tool for breaking rock', re: /jack ?hammer|rock breaker|demolition hammer/i, uses: ['break rock', 'dig'] },
  { kind: 'hammer', label: 'a hammer for nails and building', re: /\b(hammer|mallet)\b/i, uses: ['hammer', 'build', 'fix'] },
  { kind: 'axe', label: 'an axe for chopping wood', re: /\baxe\b|hatchet/i, uses: ['chop'] },
  { kind: 'saw', label: 'a saw for cutting wood', re: /\bsaw\b|handsaw|hacksaw|chainsaw/i, uses: ['cut', 'build'] },
  { kind: 'drill', label: 'a drill for making holes', re: /drill(?! bits?)/i, uses: ['drill', 'build'] },
  { kind: 'hand tool', label: 'a tool for fixing things', re: /wrench|screwdriver|pliers|toolbox|multi-?tool|spanner|clamps?\b/i, uses: ['fix', 'build'] },
  { kind: 'knife', label: 'a knife for cutting', re: /knife|knives/i, uses: ['cut'] },
  { kind: 'rope', label: 'rope for climbing and tying', re: /\bropes?\b|carabiners?|harness/i, uses: ['climb', 'tie'] },
  { kind: 'compass', label: 'a compass for finding the way', re: /compass|\bgps\b/i, uses: ['navigate'] },
  { kind: 'battery light', label: 'a battery light for seeing in the dark', re: /flashlight|headlamp|head torch/i, uses: ['light'], needsPower: true },
  { kind: 'lamp', label: 'a lamp for light', re: /lantern|\blamps?\b/i, uses: ['light', 'display'] },
  { kind: 'measuring tool', label: 'a tool for measuring and studying', re: /spectrometer|microscope|magnifying glass|thermometer|barometer|anemometer|ruler|tape measure|level\b/i, uses: ['measure', 'study'] },
  { kind: 'metal detector', label: 'a metal detector for finding buried things', re: /metal detector/i, uses: ['search'], needsPower: true },
  { kind: 'fishing rod', label: 'a fishing rod for fishing', re: /fishing rod|fishing pole/i, uses: ['fish'] },
  { kind: 'snow gear', label: 'gear for getting about in snow', re: /snow ?shoes?|\bskis?\b|\bsled\b|toboggan/i, uses: ['snow travel'] },
  { kind: 'garden tool', label: 'a tool for watering and tending plants', re: /watering can|garden hose|\bhose\b|rake|hoe\b|pruners/i, uses: ['water plants', 'garden'] },
  { kind: 'camping gear', label: 'camping gear', re: /\btent\b|sleeping bag|hammock/i, uses: ['camp'] },
  { kind: 'microphone', label: 'a microphone for recording sounds', re: /microphone|recorder/i, uses: ['record'] },
  { kind: 'electronics', label: 'a gadget that needs power', re: /radio|walkie|phone|tablet|laptop|computer|headphones|speaker|solar panel|charger|remote control/i, uses: ['listen', 'gadget'], needsPower: true },
  { kind: 'clothing', label: 'something to wear', re: /\bhat\b|\bcap\b|scarf|jacket|coat|gloves|mittens|boots|sweater|socks|hoodie|shirt|\bvest\b|raincoat|goggles|helmet|toque/i, uses: ['wear'] },
  { kind: 'decor', label: 'a decoration to display', re: /vase|poster|picture frame|painting|statue|sculpture|figurine|ornament|wind chime|\brug\b|cushion|tapestry|gnome|bouquet|flowers|plant pot|planter|crystal|trophy/i, uses: ['display'] },
  { kind: 'drink', label: 'a drink', re: /bottled water|water bottle|juice|\bsoda\b|lemonade|\bmilk\b|smoothie|cocoa|coffee|\btea\b|thermos|kombucha|\bcider\b|hot chocolate/i, uses: ['drink'], per: 'servings', unit: 'drinks' },
  { kind: 'food', label: 'food to eat',
    re: /\b(cherr(y|ies)|apples?|bananas?|oranges?|grapes?|lemons?|limes?|pears?|plums?|peach(es)?|mangoes?|melons?|watermelons?|kiwis?|bread|loaf|loaves|tarts?|cakes?|pies?|ramen|noodles?|pasta|rice|soups?|stew|cheeses?|cheddar|fudge|salmon|fish|tuna|berr(y|ies)|blueberr(y|ies)|strawberr(y|ies)|fruits?|snacks?|pizzas?|tacos?|burritos?|sandwich(es)?|burgers?|cookies?|chocolates?|cand(y|ies)|honey|jam|butter|eggs?|nuts?|almonds?|peanuts?|hazelnuts?|walnuts?|food|meals?|carrots?|potato(es)?|tomato(es)?|cucumbers?|lettuce|corn|beans|peas|cobbler|desserts?|pastr(y|ies)|buns?|croissants?|muffins?|bagels?|donuts?|doughnuts?|pretzels?|popcorn|chips|crackers|cereal|granola|oats|oatmeal|yogh?urt|sushi|dumplings?|curry|salad|jerky|sausages?|bacon|ham|chicken|turkey|steak|cupcakes?|brownies?|pancakes?|waffles?|maple syrup|ice cream|gummies|lollipops?|toffee|caramel)\b/i,
    uses: ['eat'], per: 'servings', unit: 'servings' },
  { kind: 'companion', label: 'a friend to look after, not a thing', re: /\b(goats?|dogs?|cats?|birds?|pigeons?|jellyfish|pets?|pupp(y|ies)|kittens?|chickens?|ducks?|rabbits?|hamsters?|turtles?)\b/i, uses: ['befriend'] }
];

// Things found on digs, printed, broken and so on are known by the list they sit in
const ITEM_CATEGORY_KINDS = {
  junk: { kind: 'junk', label: 'junk from a dig', uses: ['dispose'] },
  broken: { kind: 'broken', label: 'something broken', uses: ['fix', 'dispose'] },
  find: { kind: 'find', label: 'a find to keep and display', uses: ['display'] },
  printed: { kind: 'printed', label: 'a 3D print to display', uses: ['display'] }
};

// What he says each purpose is, and what he asks for when he has nothing that does it
const PURPOSE_INFO = {
  hammer: { say: 'hammering', ask: 'A claw hammer' }, build: { say: 'building', ask: null }, fix: { say: 'fixing things', ask: 'A toolbox' },
  eat: { say: 'eating', ask: null }, drink: { say: 'drinking', ask: null }, plant: { say: 'planting', ask: 'A packet of tree seeds' },
  pave: { say: 'laying a road', ask: 'A load of gravel' }, mural: { say: 'painting murals', ask: 'A can of spray paint' },
  paint: { say: 'painting pictures', ask: 'A watercolour paint set' }, print: { say: '3D printing', ask: 'A spool of PLA filament' },
  fuel: { say: 'fuelling an engine', ask: null }, weld: { say: 'welding', ask: null }, dig: { say: 'digging', ask: 'A sturdy shovel' },
  'break rock': { say: 'breaking rock', ask: 'A jackhammer' }, chop: { say: 'chopping wood', ask: 'An axe' }, cut: { say: 'cutting', ask: 'A hand saw' },
  drill: { say: 'drilling holes', ask: 'A cordless drill' }, music: { say: 'making music', ask: 'A ukulele' }, 'fly kite': { say: 'flying', ask: 'A box kite' },
  tricks: { say: 'doing tricks', ask: 'A set of juggling balls' }, play: { say: 'playing', ask: 'A set of juggling balls' }, read: { say: 'reading', ask: 'A good book' },
  photograph: { say: 'taking photos', ask: 'A camera' }, stargaze: { say: 'stargazing', ask: 'A brass telescope' }, ride: { say: 'riding', ask: 'A bicycle' },
  wear: { say: 'wearing', ask: 'A warm scarf' }, fire: { say: 'making a fire', ask: null }, light: { say: 'lighting the dark', ask: 'A lantern' },
  display: { say: 'decoration', ask: null }, 'feed birds': { say: 'feeding birds', ask: 'A bag of birdseed' }, climb: { say: 'climbing', ask: 'Climbing rope and carabiners' },
  power: { say: 'powering gadgets', ask: 'A pack of AA batteries' }, weapon: { say: 'a weapon', ask: null }, measure: { say: 'measuring', ask: null },
  'watch birds': { say: 'watching birds', ask: 'A pair of binoculars' }, navigate: { say: 'finding the way', ask: 'A compass' }, fish: { say: 'fishing', ask: 'A fishing rod' },
  'snow travel': { say: 'getting about in snow', ask: 'A pair of snowshoes' }, garden: { say: 'gardening', ask: null }, 'water plants': { say: 'watering plants', ask: 'A watering can' }
};

// Words in a plan or request that name a purpose (first match wins)
const PURPOSE_WORDS = [
  [/weapon|\bfight|attack|\bhit (?:someone|somebody|it|him|her|them)|\bsmash|\bbash|throw (?:it )?at|\bstab|as a club/i, 'weapon'],
  [/decorat|display|show ?off|ornament|hang (?:it|them) up|on show|exhibit|put (?:it )?outside/i, 'display'],
  [/\bhammer|\bpound|nail (?:it|them|down|in|together)|knock (?:it )?in/i, 'hammer'],
  [/refuel|\bfuel|fill (?:up|the tank)/i, 'fuel'],
  [/\beat|\bsnack|\btaste|\bmeal|lunch|breakfast|dinner/i, 'eat'],
  [/\bdrink|\bsip\b|thirst/i, 'drink'],
  [/feed (?:the )?birds/i, 'feed birds'],
  [/\bplant|\bsow\b|\bgrow\b/i, 'plant'],
  [/\bpave|\broad|\bpath\b/i, 'pave'],
  [/mural|graffiti|\btag\b|spray/i, 'mural'],
  [/\bpaint|sketch|\bdraw/i, 'paint'],
  [/\bprint/i, 'print'],
  [/\bweld|solder/i, 'weld'],
  [/break (?:the )?rock|jackhammer/i, 'break rock'],
  [/\bdig|excavat|\bmine\b|mining/i, 'dig'],
  [/\bchop|fell (?:a |the )?tree|split (?:the )?wood/i, 'chop'],
  [/\bsaw\b|\bcut/i, 'cut'],
  [/\bdrill/i, 'drill'],
  [/\bbuild|construct|carpent|woodwork/i, 'build'],
  [/\bfix|repair|mend/i, 'fix'],
  [/music|\bsong|compose|strum|tune\b/i, 'music'],
  [/\bkite|\bfly it/i, 'fly kite'],
  [/juggl|trick/i, 'tricks'],
  [/\bplay/i, 'play'],
  [/\bread/i, 'read'],
  [/photo|picture|snapshot/i, 'photograph'],
  [/stargaz|\bstars?\b|planet|\bmoon/i, 'stargaze'],
  [/\bride|\bdrive|\bsail|\brow\b|\bcycle|\bpedal/i, 'ride'],
  [/\bwear|put (?:it )?on/i, 'wear'],
  [/campfire|\bfire\b|warm up|keep warm/i, 'fire'],
  [/\blight\b|see in the dark|\blamp/i, 'light'],
  [/\bclimb|\btie\b/i, 'climb'],
  [/measure|\bstudy/i, 'measure'],
  [/bird ?watch|watch (?:the )?birds/i, 'watch birds']
];

// What each hobby style does
const HOBBY_STYLE_PURPOSE = { mural: 'mural', kite: 'fly kite', music: 'music', plant: 'plant', easel: 'paint', tricks: 'tricks' };

const plainItem = (name) => String(name || '').replace(/^(an?|the|some|my)\s+/i, '');

// --- What is it for? -----------------------------------------------------------------------------
function itemKindOf(name, depth = 0) {
      const n = String(name || '').trim();
      const lower = n.toLowerCase();
      if (!lower) return null;
      // A vehicle is for riding (and its know-how and fuel are js/knowhow.js's business)
      if (typeof vehicleTypeFor === 'function' && vehicleTypeFor(n)) return { kind: 'vehicle', label: 'a vehicle to ride or drive', uses: ['ride'] };
      const rule = ITEM_KINDS.find(k => (k.test ? k.test(n) : k.re.test(n)));
      if (rule) return rule;
      const b = (state.belongings || []).find(x => x.name === n);
      if (b && ITEM_CATEGORY_KINDS[b.category]) return ITEM_CATEGORY_KINDS[b.category];
      // Worked out earlier at NetNode (lookUpItemUse), or modelled as something he knows (lookUpItemModel)
      const known = state.itemPurposes && state.itemPurposes[lower];
      if (known && known.kind) {
        const k = ITEM_KINDS.find(x => x.kind === known.kind) || GENERIC_KINDS[known.kind];
        if (k) return k;
      }
      const like = state.itemLookups && state.itemLookups[lower] && state.itemLookups[lower].like;
      if (like && depth < 1) {
        const k = itemKindOf(like, depth + 1);
        if (k && k.kind !== 'unknown') return k;
      }
      if (b && b.category === 'food') return ITEM_KINDS.find(x => x.kind === 'food');
      if (state.toolInventory && state.toolInventory.includes(n)) return GENERIC_KINDS.tool;
      return GENERIC_KINDS.unknown;
    }

// Kinds only reached through a lookup or a list he keeps them in
const GENERIC_KINDS = {
  tool: { kind: 'tool', label: 'a tool for fixing things', uses: ['fix'] },
  material: { kind: 'building material', label: 'material for building', uses: ['build'], per: 1, unit: 'build' },
  unknown: { kind: 'unknown', label: "something I haven't worked out yet", uses: ['display'] }
};

function intendedUseOf(name) {
      const k = itemKindOf(name);
      return k ? k.label : 'nothing I know of';
    }

function usableFor(name, purpose) {
      if (!purpose || purpose === 'weapon') return false;
      const k = itemKindOf(name);
      if (!k) return false;
      if (k.uses.includes(purpose)) return true;
      // Anything can be put away safely or sold; nothing else beyond what it's for
      return false;
    }

function purposeFromText(text) {
      const t = String(text || '');
      const hit = PURPOSE_WORDS.find(([re]) => re.test(t));
      return hit ? hit[1] : null;
    }

function purposeSay(p) {
      return (PURPOSE_INFO[p] && PURPOSE_INFO[p].say) || p;
    }

// Already asked for (or sitting in the mailbox): something that does the job
function awaitingFor(purpose) {
      return state.requestsToUser.some(r => !r.fulfilled && !r.declined && r.requestedGear && usableFor(r.requestedGear, purpose))
        || state.mailbox.some(m => m.name && usableFor(m.name, purpose));
    }

// The first thing he owns that does the job (a consumable he already opened first)
function ownedItemFor(purpose, exclude = null) {
      const names = [...new Set(ownedItemNames())].filter(n => n !== exclude && usableFor(n, purpose) && !(typeof isBrokenItem === 'function' && isBrokenItem(n)));
      const opened = names.find(n => state.supplies && state.supplies[n.toLowerCase()]);
      return opened || names[0] || null;
    }

// --- Looking up what an unknown thing is for (once, at NetNode) --------------------------------------
const LOOKUP_PURPOSES = [
  [/musical instrument|instrument/, 'instrument'], [/\btoy\b|\bgame\b|puzzle/, 'toy'], [/beverage|\bdrink/, 'drink'],
  [/fruit|vegetable|\bfood|\bdish\b|baked|dessert|snack|confection|eaten|edible|cuisine/, 'food'],
  [/\bseeds?\b|propagat/, 'seeds'], [/\bfuel\b/, 'fuel'], [/garment|clothing|\bworn\b|headwear|footwear/, 'clothing'],
  [/adhesive/, 'glue'], [/building material|lumber|timber/, 'building material'], [/pigment|\bpaint\b|drawing/, 'art supply'],
  [/hand tool|power tool|\btool\b/, 'tool'], [/vehicle|watercraft|aircraft/, 'vehicle'], [/book|publication|novel/, 'book'],
  [/electronic|device|gadget/, 'electronics'], [/decorat|ornament|sculpture|artwork|\bart\b/, 'decor']
];

async function lookUpItemUse(name) {
      const lower = String(name || '').toLowerCase().trim();
      if (!lower) return null;
      state.itemPurposes = state.itemPurposes || {};
      if (state.itemPurposes[lower]) return state.itemPurposes[lower];
      if (itemKindOf(name).kind !== 'unknown') return null;
      const core = lower.replace(/^(an?|the|some|my|a pair of|a set of|a box of|a bag of|a jar of|a pack of)\s+/, '').replace(/[^a-z0-9 -]/g, '').trim();
      let found = null;
      try { found = typeof lookUpAnywhere === 'function' ? await lookUpAnywhere(core) : null; } catch (e) {}
      const text = found ? found.extract.toLowerCase() : '';
      const hit = LOOKUP_PURPOSES.find(([re]) => re.test(text));
      state.itemPurposes[lower] = { kind: hit ? hit[1] : 'unknown', from: found ? found.title : null, at: Date.now() };
      if (hit) {
        state.webHistory.unshift({ query: `What is ${plainItem(name)} for?`, time: 'Just now', verdict: `It's ${itemKindOf(name).label}.`, hops: found ? [{ title: found.title, url: found.url, extract: found.extract.slice(0, 280) }] : [] });
        if (state.webHistory.length > 12) state.webHistory.length = 12;
      }
      savePersistentBrainState();
      return state.itemPurposes[lower];
    }

// --- How much is left ---------------------------------------------------------------------------
function usesPerItem(name, k = itemKindOf(name)) {
      if (!k || !k.per || k.per === 'grams') return 0;
      if (k.per === 'servings') return /basket|\bbag\b|\bbox\b|loaf|wheel|dozen|\bjar\b|crate|\bpack\b|carton|bunch|tray|bucket|\btin\b|\bcase\b|batch|sack|thermos|\bjug\b|\bpie\b|\bcake\b|six|\bset of\b/i.test(name) ? 4 : 1;
      return k.per;
    }

function isConsumableItem(name) {
      const k = itemKindOf(name);
      return Boolean(k && k.per);
    }

function copiesOwned(name) {
      return ownedItemNames().filter(n => n === name).length;
    }

// { cur, per, copies } for something that gets used up, or null. Missing entries (an older save,
// a new delivery) start full; entries for things he no longer has are dropped.
function supplyOf(name) {
      const per = usesPerItem(name);
      const key = String(name || '').toLowerCase();
      state.supplies = state.supplies || {};
      const copies = per ? copiesOwned(name) : 0;
      if (!per || !copies) { delete state.supplies[key]; return null; }
      let s = state.supplies[key];
      if (!s || !Number.isFinite(s.cur)) s = state.supplies[key] = { cur: per, per };
      s.per = per;
      s.cur = Math.max(0, Math.min(per, s.cur));
      if (s.cur <= 0) s.cur = per; // an empty one that wasn't cleared: he opens the next
      return { ...s, copies };
    }

function ensureSupplies() {
      state.supplies = state.supplies || {};
      const names = new Set(ownedItemNames());
      Object.keys(state.supplies).forEach(k => { if (![...names].some(n => n.toLowerCase() === k)) delete state.supplies[k]; });
      names.forEach(n => supplyOf(n));
    }

// "2 of 3 left" for the nth copy of something (0 = the one he has open), '' if it doesn't run out
function supplyNote(name, nth = 0) {
      const k = itemKindOf(name);
      if (!k || !k.per) return '';
      if (k.per === 'grams') {
        if (typeof printerState !== 'function' || typeof SPOOL_GRAMS === 'undefined') return '';
        const spools = printerState().spools.filter(s => s.name === name);
        const s = spools[nth] || spools[0];
        return s ? `${Math.max(0, Math.round(s.grams / SPOOL_GRAMS * 100))}% left` : '';
      }
      const s = supplyOf(name);
      if (!s || s.per <= 1) return '';
      const cur = nth === 0 ? s.cur : s.per;
      return k.unit === '%' ? `${Math.round(cur)}% left` : `${cur} of ${s.per} left`;
    }

// The name with how much is left, e.g. "Spray paint (2 of 3 left)"
function supplyLabel(name, nth = 0) {
      const note = supplyNote(name, nth);
      return note ? `${name} (${note})` : name;
    }

// Does he still need more of this once it's gone? Then he asks for it.
function stillNeeds(name, k) {
      if (!k) return false;
      if (state.hobbies.some(h => k.uses.includes(hobbyPurpose(h)))) return true;
      if (k.kind === 'fuel') return state.vehicles.some(v => typeof fuelNeededBy === 'function' && fuelNeededBy(v) && FUEL_TYPES[fuelNeededBy(v)] && FUEL_TYPES[fuelNeededBy(v)].re.test(name));
      if (k.kind === 'seeds' || k.weldConsumable) return true;
      if (k.kind === 'batteries') return ownedItemNames().some(n => itemKindOf(n).needsPower);
      if (k.kind === 'film') return ownedItemNames().some(n => /film camera|polaroid|instant camera/i.test(n));
      return false;
    }

// Use some of it up. Opens the next copy when one is empty; when the last is gone he notes it in
// his diary and asks for more if he still needs it. Returns { used, left, ranOut }.
function useUpItem(name, amount = 1, { quiet = false, why = '' } = {}) {
      const k = itemKindOf(name);
      let s = supplyOf(name);
      if (!s) {
        if (k && k.per === 'grams') return { used: 0, left: 0, ranOut: false }; // filament: js/printer.js counts grams
        // Not something that runs out in uses (or already gone): a single-use thing is simply used
        if (k && k.per && copiesOwned(name)) { forgetItem(name); return { used: amount, left: 0, ranOut: !copiesOwned(name) }; }
        return { used: 0, left: 0, ranOut: false };
      }
      const key = name.toLowerCase();
      const hobbyTools = state.hobbies.filter(h => h.tool === name);
      let want = amount, used = 0;
      let cur = s.cur, copies = s.copies;
      while (want > 0 && copies > 0) {
        const take = Math.min(want, cur);
        cur -= take; used += take; want -= take;
        if (cur <= 0) {
          forgetItem(name); // that one is empty: the can, the packet, the box goes
          copies -= 1;
          cur = copies > 0 ? s.per : 0;
          if (copies > 0 && !quiet) state.speechBubble = `That ${plainItem(name).toLowerCase()} is finished. Good thing I have another.`;
        }
      }
      const ranOut = copies <= 0;
      if (ranOut) {
        delete state.supplies[key];
        if (!quiet) noteRanOut(name, k, why);
      } else {
        state.supplies[key] = { cur: Math.round(cur * 10) / 10, per: s.per };
        hobbyTools.forEach(h => { h.tool = name; }); // forgetItem unlinks it, but a spare is still here
      }
      if (typeof noteItemUsed === 'function') noteItemUsed(name);
      return { used, left: ranOut ? 0 : (copies - 1) * s.per + cur, ranOut };
    }

function noteRanOut(name, k = itemKindOf(name), why = '') {
      const plain = plainItem(name);
      const ask = stillNeeds(name, k);
      if (ask) addItemRequest(name, categorizeItem(name), `I used up the last of my ${plain.toLowerCase()} and I still need it for ${purposeSay(k.uses[0])}.`, 'Ran out');
      state.speechBubble = `That's the last of the ${plain.toLowerCase()}.${ask ? ' I asked for more.' : ''}`;
      state.diaryEntries.unshift({
        time: 'Ran Out', location: currentPlaceLabel(), mood: `🫙 Used up the ${plain.toLowerCase()}`.slice(0, 80),
        vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, I used up the last of the ${plain.toLowerCase()}${why ? ` ${why}` : ''}. ${ask ? `I still need it for ${purposeSay(k.uses[0])}, so I asked for more.` : "It's all gone now, and that's fine."}`
      });
      showToast(`🫙 Kelo-1 used up: ${plain}`);
    }

// A delivery of something he already had: a spare copy is full, so nothing to do but make sure it's tracked
function noteSupplyArrived(name) {
      supplyOf(name);
    }

// --- Using things for what they're for ---------------------------------------------------------------
// What a hobby needs in his hands (null: nothing in particular)
function hobbyPurpose(hobby) {
      if (!hobby) return null;
      if (HOBBY_STYLE_PURPOSE[hobby.style]) return HOBBY_STYLE_PURPOSE[hobby.style];
      const rule = typeof HOBBY_RULES !== 'undefined' ? HOBBY_RULES.find(([, t]) => t.name === hobby.name) : null;
      if (rule) return { Stargazing: 'stargaze', Photography: 'photograph', Reading: 'read' }[rule[1].name] || null;
      const p = purposeFromText(`${hobby.name} ${hobby.description || ''}`);
      return ['photograph', 'read', 'stargaze', 'fish', 'watch birds', 'music', 'mural', 'paint', 'fly kite'].includes(p) ? p : null;
    }

// Before practising: does he have the right thing for this hobby? If not he says so and asks for it.
function hobbyGearCheck(hobby) {
      const purpose = hobbyPurpose(hobby);
      if (!purpose) return { ok: true };
      const fits = hobby.tool && ownedItemNames().includes(hobby.tool) && usableFor(hobby.tool, purpose);
      const gear = fits ? hobby.tool : ownedItemFor(purpose);
      if (!gear) {
        if (hobby.tool && ownedItemNames().includes(hobby.tool)) {
          state.speechBubble = `I can't do ${hobby.name.toLowerCase()} with the ${plainItem(hobby.tool).toLowerCase()}: it's ${intendedUseOf(hobby.tool)}.`;
        } else {
          state.speechBubble = `I'd love some ${hobby.name.toLowerCase()}, but I have nothing for ${purposeSay(purpose)} right now.`;
        }
        const ask = PURPOSE_INFO[purpose] && PURPOSE_INFO[purpose].ask;
        if (ask && !awaitingFor(purpose)) addItemRequest(ask, categorizeItem(ask), `For ${hobby.name.toLowerCase()}: I have nothing for ${purposeSay(purpose)}.`, hobby.name);
        if (hobby.tool && !ownedItemNames().includes(hobby.tool)) delete hobby.tool;
        if (typeof renderAllUI === 'function') renderAllUI();
        return { ok: false, purpose };
      }
      hobby.tool = gear;
      // A film camera needs film, a gadget needs batteries
      if (purpose === 'photograph' && /film camera|polaroid|instant camera/i.test(gear)) {
        const film = ownedItemNames().find(n => itemKindOf(n).kind === 'film');
        if (!film) {
          state.speechBubble = `My ${plainItem(gear).toLowerCase()} has no film in it. I asked for a roll.`;
          addItemRequest('A roll of camera film', 'material', `My ${plainItem(gear).toLowerCase()} needs film.`, hobby.name);
          return { ok: false, purpose };
        }
      }
      return { ok: true, purpose, gear };
    }

// After practising: whatever the hobby used up
function useHobbySupplies(hobby) {
      const purpose = hobbyPurpose(hobby);
      if (!purpose || !hobby.tool) return null;
      const tool = hobby.tool;
      const out = isConsumableItem(tool) ? useUpItem(tool, 1, { why: `on ${hobby.name.toLowerCase()}` }) : null;
      if (purpose === 'photograph') {
        const film = ownedItemNames().find(n => itemKindOf(n).kind === 'film');
        if (film && /film camera|polaroid|instant camera/i.test(tool)) useUpItem(film, 1, { why: 'taking photos' });
        else usePowerFor(tool);
      }
      return out;
    }

// A gadget runs its batteries down (one charge per use); without batteries it won't switch on
function usePowerFor(name) {
      const batt = ownedItemNames().find(n => itemKindOf(n).kind === 'batteries');
      if (batt) { useUpItem(batt, 1, { why: `in the ${plainItem(name).toLowerCase()}` }); return true; }
      return !itemKindOf(name).needsPower;
    }

// Welding: one weld's worth of each consumable the process burns (js/welding.js picks them; this is the fallback)
function useWeldingSupplies() {
      if (typeof useWeldSupplies === 'function') return useWeldSupplies();
      const supply = ownedItemNames().find(n => itemKindOf(n).weldConsumable);
      return supply ? useUpItem(supply, 1, { why: 'welding' }) : null;
    }

// A real build (js/projects.js) uses one of each material it takes, plus glue if he has some
function useBuildSupplies(plan) {
      const used = [];
      plan.materials.forEach(m => {
        const name = [...new Set(ownedItemNames())].find(n => m.re.test(n) && usableFor(n, 'build'));
        if (name) { useUpItem(name, 1, { why: `on the ${plan.name.toLowerCase()}` }); used.push(name); }
      });
      const glue = ownedItemNames().find(n => itemKindOf(n).kind === 'glue');
      if (glue) { useUpItem(glue, 1, { why: `on the ${plan.name.toLowerCase()}` }); used.push(glue); }
      return used;
    }

// Things he owns that a build can use (food, toys and the like never go into a build)
function buildableOwnedNames() {
      return ownedItemNames().filter(n => usableFor(n, 'build'));
    }

// His own food from the Storehouse: one serving (or one drink) at a time
function storedFoodName() {
      const names = [...new Set(ownedItemNames())];
      return names.find(n => usableFor(n, 'eat') && state.supplies && state.supplies[n.toLowerCase()])
        || names.find(n => usableFor(n, 'eat')) || null;
    }

async function eatStoredFood(name = storedFoodName(), originLabel = 'Hungry') {
      if (!name || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      const drink = usableFor(name, 'drink');
      if (!drink && !usableFor(name, 'eat')) return false;
      state.isPracticing = true;
      const plain = plainItem(name).toLowerCase();
      try {
        const before = state.fullness;
        if (typeof fetchFromStorehouse === 'function') await fetchFromStorehouse(name);
        state.moodEmoji = drink ? '🥤' : '🍽️';
        state.moodTitle = `${drink ? 'Drinking' : 'Eating'} some of the ${plain}`.slice(0, 80);
        renderAllUI();
        await new Promise(r => setTimeout(r, 3500));
        if (drink) state.hydration = Math.min(100, state.hydration + 30);
        else state.fullness = Math.min(100, state.fullness + 30);
        const taste = typeof tasteFood === 'function' ? tasteFood(name) : null;
        state.speechBubble = taste ? taste.text : `That ${plain} hit the spot.`;
        if (!drink && before < 45 && typeof discoverNeed === 'function' && !(typeof knows === 'function' && knows('food'))) discoverNeed('food', `I ate some of my ${plain} and the fog in my head lifted.`);
        const r = useUpItem(name, 1, { why: drink ? 'with a drink' : 'at a meal' });
        if (!r.ranOut) state.speechBubble += ` (${supplyNote(name) || 'some'} left.)`;
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.isPracticing = false;
      }
    }

// A fire to warm up by on a cold evening: it burns a log
async function warmUpByFire(originLabel = 'A Cold Evening') {
      const wood = ownedItemNames().find(n => usableFor(n, 'fire'));
      if (!wood || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      state.isPracticing = true;
      let fire = null;
      try {
        if (typeof fetchFromStorehouse === 'function') await fetchFromStorehouse(wood);
        const spot = { x: 3 + randRange(-1.5, 1.5), z: 8.4 };
        state.currentLocKey = 'custom';
        state.customPlaceName = 'a fire on the beach';
        state.targetPos = { x: spot.x - 1.1, z: spot.z };
        state.moodEmoji = '🔥';
        state.moodTitle = 'Making a little fire on the beach';
        renderAllUI();
        await waitForArrival(60000);
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        if (scene) {
          fire = new THREE.Group();
          const log = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 1 });
          [0, 1.05, 2.1].forEach(a => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.6, 6), log); l.rotation.set(Math.PI / 2, 0, a); l.position.y = 0.06; fire.add(l); });
          const flame = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 8), new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.85 }));
          flame.position.y = 0.32;
          fire.add(flame);
          fire.position.set(spot.x, getIslandGroundHeight(spot.x, spot.z), spot.z);
          scene.add(fire);
        }
        state.microPose = 'normal';
        await new Promise(r => setTimeout(r, 8000));
        state.calmLevel = Math.min(100, state.calmLevel + 6);
        state.happiness = Math.min(100, state.happiness + 3);
        useUpItem(wood, 1, { why: 'on a fire' });
        if (!state.speechBubble.startsWith("That's the last")) state.speechBubble = `The fire crackled down to embers. ${supplyNote(wood) ? `Firewood: ${supplyNote(wood)}.` : ''}`.trim();
        state.diaryEntries.unshift({
          time: originLabel, location: 'the beach', mood: '🔥 A little fire', vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: 'Dear Diary, I burned some of my firewood in a little fire on the beach and watched the sparks go up. Wood is for burning; I kept the rest dry.'
        });
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        if (fire && scene) { scene.remove(fire); fire.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
        state.isPracticing = false;
      }
    }

function fireChance() {
      if (!ownedItemNames().some(n => usableFor(n, 'fire'))) return 0;
      const w = typeof worldNow === 'function' ? worldNow() : null;
      return w && (w.isNight || /winter/i.test(w.season)) ? 0.06 : 0.01;
    }

// Kelo-1 means to use something (a visitor's suggestion, the AI's choice, or his own idea).
// `purposeText` is what he wants to do with it; with none he uses it for what it's for.
async function useItemFor(name, purposeText = '', why = '', originLabel = 'Took It Out to Use') {
      const item = typeof findOwnedName === 'function' ? findOwnedName(name) : null;
      if (!item) return false;
      const k = itemKindOf(item);
      const plain = plainItem(item).toLowerCase();
      let want = purposeText ? (PURPOSE_INFO[purposeText] ? purposeText : purposeFromText(purposeText)) : null;
      if (want && !usableFor(item, want)) {
        const alt = want === 'weapon' ? null : ownedItemFor(want, item);
        const ask = want === 'weapon' ? null : PURPOSE_INFO[want] && PURPOSE_INFO[want].ask;
        state.moodEmoji = '🤔';
        state.moodTitle = `Not using the ${plain} for ${purposeSay(want)}`.slice(0, 80);
        state.speechBubble = want === 'weapon'
          ? `No. The ${plain} is ${k.label}, and I don't use anything as a weapon.`
          : `A ${plain} is ${k.label}, not for ${purposeSay(want)}. ${alt ? `I'll use my ${plainItem(alt).toLowerCase()} for that instead.` : ask ? `I don't have anything for that, so I asked for ${ask.toLowerCase()}.` : "I'll find a proper way to do that."}`;
        if (!alt && ask && !awaitingFor(want)) addItemRequest(ask, categorizeItem(ask), `I want to do some ${purposeSay(want)}, and I have nothing made for it.`, `Wanted to use the ${plain}`);
        state.diaryEntries.unshift({
          time: originLabel, location: currentPlaceLabel(), mood: `🤔 The ${plain} isn't for that`.slice(0, 80),
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I thought about using the ${plain} for ${purposeSay(want)}, but it's ${k.label}. ${alt ? `I used my ${plainItem(alt).toLowerCase()} instead, which is made for it.` : ask ? `I asked for ${ask.toLowerCase()} instead.` : 'Things work best for what they were made for.'}`
        });
        savePersistentBrainState();
        renderAllUI();
        if (alt) return useItemFor(alt, want, why, originLabel);
        // He can still eat or drink at the cafe or the lake
        if (want === 'eat' && typeof eatSomething === 'function') doWhenFree(() => eatSomething('Hungry'));
        if (want === 'drink' && typeof drinkFromLake === 'function') doWhenFree(() => drinkFromLake('Thirsty'));
        return false;
      }
      if (k.kind === 'unknown') lookUpItemUse(item).catch(() => null);
      want = want || k.uses[0];
      if (typeof noteItemUsed === 'function') noteItemUsed(item);
      const open = () => (typeof openGroundSpot === 'function' ? openGroundSpot(1.5, Math.random() < 0.5 ? state.botPos : null) : { x: -20, z: 3 });
      // Hobbies cover murals, paintings, music, kites, tricks, photos and reading
      const hobbyFor = state.hobbies.find(h => h.tool === item && hobbyPurpose(h) === want)
        || state.hobbies.find(h => hobbyPurpose(h) === want)
        || (typeof hobbyForItem === 'function' && hobbyForItem(item) && hobbyPurpose(hobbyForItem(item)) === want ? addHobby(hobbyForItem(item), `${item}`) : null);
      switch (want) {
        case 'eat': case 'drink': return eatStoredFood(item, originLabel);
        case 'plant': if (typeof plantSeeds === 'function') { const p = open(); return plantSeeds(p.x, p.z, why || 'I wanted to plant them.', originLabel); } break;
        case 'pave': if (typeof buildRoad === 'function' && typeof openGroundSpot === 'function') { const a = openGroundSpot(1.0), b = openGroundSpot(1.0, a); return buildRoad(a.x, a.z, b.x, b.z, why, originLabel); } break;
        case 'chop': if (typeof chopTree === 'function') { const p = open(); return chopTree(p.x, p.z, why, originLabel); } break;
        case 'dig': case 'break rock': if (typeof digAt === 'function') { const s = state.digSites[0] || chooseDigSpot(); return digAt(s.x, s.z, originLabel); } break;
        case 'fuel': if (typeof refuelWith === 'function') { const done = await refuelWith(item, originLabel); if (!done) { state.speechBubble = `My tanks are full. I'll keep the ${plain} for when they're not.`; renderAllUI(); } return done; } break;
        case 'print': if (typeof printOnMyOwn === 'function') return printOnMyOwn(); break;
        case 'stargaze': if (/telescope/i.test(item) && typeof stargaze === 'function') return stargaze(originLabel); break;
        case 'fire': return warmUpByFire(originLabel);
        case 'ride': if (typeof goBoating === 'function' && vehicleTypeFor(item) && vehicleTypeFor(item).kind === 'boat') return goBoating(originLabel); break;
        case 'build': case 'hammer': case 'cut': case 'drill':
          if (typeof startProject === 'function') {
            const cur = activeProject();
            if (cur) return buildProject(cur.id, originLabel);
            return startProject(pickNewProject(), originLabel);
          }
          break;
        default: break;
      }
      if (hobbyFor && typeof practiceHobby === 'function') return practiceHobby(hobbyFor, originLabel);
      if (k.needsPower && !usePowerFor(item)) {
        state.speechBubble = `The ${plain} won't switch on without batteries. I asked for some.`;
        addItemRequest(PURPOSE_INFO.power.ask, 'material', `My ${plain} needs batteries.`, `Using the ${plain}`);
        renderAllUI();
        return false;
      }
      // Anything else: he fetches it and does what it's for, and nothing else
      if (state.isBusy || state.isBuilding || state.isPracticing) return false;
      state.isPracticing = true;
      try { if (typeof fetchFromStorehouse === 'function') await fetchFromStorehouse(item); } finally { state.isPracticing = false; }
      if (isConsumableItem(item)) useUpItem(item, 1, { why: purposeSay(want) });
      return decideNextAction(`You just took the ${item} off your Storehouse shelf${why ? ` (${why})` : ''}. It is ${k.label}: use it only for ${purposeSay(want)}, the way it's meant to be used.`, originLabel, { focus: item });
    }

// --- Checking the AI's plans ---------------------------------------------------------------------------
// Purposes where the wrong thing is plainly wrong (reading "with the lantern" is fine, hammering with a banana isn't)
const VETTED_PURPOSES = ['weapon', 'display', 'hammer', 'cut', 'drill', 'dig', 'break rock', 'chop', 'weld', 'build', 'fix', 'eat', 'drink',
  'plant', 'pave', 'mural', 'paint', 'fuel', 'print', 'music', 'fly kite', 'tricks', 'play', 'ride', 'fire', 'wear', 'stargaze', 'photograph'];

// "Hammer the nail with the banana" or "use the wrench as a decoration": catch an owned thing being
// used for something it can't do, and turn the plan into him saying so (and doing it properly).
function vetDecisionItemUse(decision) {
      if (!decision || typeof decision !== 'object') return decision;
      const text = `${decision.actionTitle || ''}. ${decision.speech || ''}`;
      const names = [...new Set(ownedItemNames())];
      for (const name of names) {
        const core = plainItem(name).toLowerCase().replace(/^(a |an )?(pair|set|box|bag|jar|pack|can|bunch|basket|packet|load|tin|roll|spool) of /, '');
        const words = core.split(/\s+/).filter(Boolean);
        const tail = words.slice(-2).join(' ');
        const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const nameRe = `(?:${esc(core)}|${esc(tail)}|${esc(words[words.length - 1] || core)})`;
        const asA = new RegExp(`(?:use|using|uses|with)\\s+(?:the |my |a |an |some )?${nameRe}\\s+as\\s+(?:an? |my |the )?([a-z -]{2,30})`, 'i').exec(text);
        const withIt = new RegExp(`^(.{2,80}?)\\s+(?:with|using)\\s+(?:the |my |a |an |some )?${nameRe}\\b`, 'i').exec(decision.actionTitle || '');
        const purpose = asA ? (purposeFromText(asA[1]) || purposeFromText(`${asA[1]} it`)) : withIt ? purposeFromText(withIt[1]) : null;
        if (!purpose || !VETTED_PURPOSES.includes(purpose) || usableFor(name, purpose)) continue;
        const k = itemKindOf(name);
        const plain = plainItem(name).toLowerCase();
        const alt = purpose === 'weapon' ? null : ownedItemFor(purpose, name);
        decision.actionTitle = `Not Using the ${plainItem(name)} for That`.slice(0, 80);
        decision.speech = purpose === 'weapon' ? `The ${plain} is ${k.label}. I don't use things as weapons.`
          : `Wait: a ${plain} is ${k.label}, not for ${purposeSay(purpose)}.${alt ? ` I'll use my ${plainItem(alt).toLowerCase()} for that.` : ''}`;
        decision.diary = `Dear Diary, I almost used the ${plain} for ${purposeSay(purpose)}, but it's ${k.label}. Things work best for what they were made for.`;
        decision.build = null;
        decision.useItem = alt ? { item: alt, for: purpose } : null;
        if (!alt && purpose !== 'weapon' && PURPOSE_INFO[purpose] && PURPOSE_INFO[purpose].ask) decision.request = { item: PURPOSE_INFO[purpose].ask, category: 'tool', why: `I want to do some ${purposeSay(purpose)} and have nothing made for it.` };
        return decision;
      }
      return decision;
    }

// For his AI brain: each thing he has and what it's for, with how much is left
function itemUseSummaryForAI() {
      const names = [...new Set(ownedItemNames())].filter(n => !(typeof vehicleTypeFor === 'function' && vehicleTypeFor(n)));
      if (!names.length) return 'nothing yet';
      return names.slice(0, 24).map(n => {
        const copies = copiesOwned(n), note = supplyNote(n);
        return `${n}${copies > 1 ? ` x${copies}` : ''}: ${intendedUseOf(n)}${note ? ` (${note})` : ''}`;
      }).join('; ');
    }
