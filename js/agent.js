// Kelo-bot-1 — js/agent.js
// Loaded FIRST so global state, TOWN_LOCATIONS, AMBIANCE_PRESETS, and AI Agent functions
// are available to both js/scene.js and js/main.js on GitHub Pages.

const arrowKeyState = {
  ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
  KeyW: false, KeyS: false, KeyA: false, KeyD: false
};

const AMBIANCE_PRESETS = [
  {
    "label": "Alpine Noon",
    "bg": 8900331,
    "fog": 9684477,
    "fogDensity": 0.0035,
    "skyTop": 2450411,
    "skyHorizon": 14412542,
    "hemiSky": 14742270,
    "hemiGround": 4153874,
    "sunColor": 16776171,
    "sunInt": 1.35
  },
  {
    "label": "Okanagan Golden Hour",
    "bg": 16628340,
    "fog": 16701354,
    "fogDensity": 0.0095,
    "skyTop": 8138002,
    "skyHorizon": 16638023,
    "hemiSky": 16772565,
    "hemiGround": 4528643,
    "sunColor": 16347926,
    "sunInt": 1.45
  },
  {
    "label": "Starlit Valley Night",
    "bg": 593174,
    "fog": 988970,
    "fogDensity": 0.011,
    "skyTop": 132631,
    "skyHorizon": 1976635,
    "hemiSky": 3718648,
    "hemiGround": 988970,
    "sunColor": 6333946,
    "sunInt": 0.45
  }
];

const TOWN_LOCATIONS = {
  "storehouse": {
    "id": "storehouse",
    "name": "Storehouse",
    "building": "Kelo-1 Storehouse",
    "icon": "📦",
    "x": 5.5,
    "z": -3.9,
    "showPin": true,
    "pinColor": "from-orange-500/90 to-red-700/90"
  },
  "post_office": {
    "id": "post_office",
    "name": "Post Office",
    "building": "Okanagan Post Office",
    "icon": "📮",
    "x": 12.5,
    "z": 0.2,
    "showPin": true,
    "pinColor": "from-red-500/90 to-rose-600/90"
  },
  "bed": {
    "id": "bed",
    "name": "Cozy Quilt Bed",
    "building": "Kelo-1 Cutaway Homestead",
    "icon": "🛏️",
    "x": -11.6,
    "z": -8.8,
    "showPin": true,
    "pinColor": "from-emerald-500/90 to-teal-600/90",
    "groundY": -0.17324750423431112
  },
  "couch": {
    "id": "couch",
    "name": "Living Room Couch",
    "building": "Kelo-1 Cutaway Homestead",
    "icon": "🛋️",
    "x": -7.5,
    "z": -6.8,
    "showPin": false,
    "pinColor": "from-amber-500/90 to-orange-600/90"
  },
  "weld": {
    "id": "weld",
    "name": "TIG Welding Forge",
    "building": "Outdoor Welding Studio",
    "icon": "👨‍🏭",
    "x": -1.2,
    "z": -6.6,
    "showPin": true,
    "pinColor": "from-amber-500/90 to-red-600/90",
    "groundY": -0.026114585930713738
  },
  "garden": {
    "id": "garden",
    "name": "Okanagan Bio-Garden",
    "building": "Raised Cedar Planters",
    "icon": "🍑",
    "x": -10.3,
    "z": 5.0,
    "showPin": true,
    "pinColor": "from-lime-500/90 to-emerald-600/90",
    "groundY": -0.25
  },
  "cafe": {
    "id": "cafe",
    "name": "Bean & Byte Cafe",
    "building": "Bean & Byte Espresso Bar",
    "icon": "☕",
    "x": 0.0,
    "z": 5.6,
    "showPin": true,
    "pinColor": "from-orange-500/90 to-rose-600/90",
    "groundY": -0.04820776730775833
  },
  "cyber": {
    "id": "cyber",
    "name": "NetNode Cyber Cafe",
    "building": "NetNode Internet & GitHub Hub",
    "icon": "💻",
    "x": 6.8,
    "z": 4.4,
    "showPin": true,
    "pinColor": "from-purple-500/90 to-indigo-600/90",
    "groundY": 0.21131333621589513
  },
  "shoreline": {
    "id": "shoreline",
    "name": "Okanagan Shoreline",
    "building": "Driftwood Lake Edge",
    "icon": "🌊",
    "x": 4.2,
    "z": 10.2,
    "showPin": true,
    "pinColor": "from-sky-500/90 to-blue-600/90",
    "groundY": -0.23773104548453716
  },
  "meadow": {
    "id": "meadow",
    "name": "West Wildflower Meadow",
    "building": "West Island Meadow",
    "icon": "🌼",
    "x": -16,
    "z": -1.5,
    "showPin": true,
    "pinColor": "from-yellow-500/90 to-amber-600/90",
    "groundY": -0.25
  },
  "mountain_peak": {
    "id": "mountain_peak",
    "name": "Alpine Gold Vein Ridge",
    "building": "Northern Mountain Summit (-15.5, -26.5)",
    "icon": "⛏️",
    "x": -15.5,
    "z": -26.5,
    "showPin": true,
    "pinColor": "from-yellow-400/90 to-amber-600/90",
    "groundY": 14.642003059387207
  },
  "disposal_pit": {
    "id": "disposal_pit",
    "name": "Disposal Pit",
    "building": "Kelo-1 Disposal Pit",
    "icon": "🕳️",
    "x": 20,
    "z": -9,
    "showPin": true,
    "pinColor": "from-stone-500/90 to-stone-700/90"
  },
  "museum": {
    "id": "museum",
    "name": "Museum",
    "building": "Kelo-1 Museum of Art & Ideas",
    "icon": "🏛️",
    "x": -40,
    "z": -0.4,
    "showPin": true,
    "pinColor": "from-amber-600/90 to-stone-700/90"
  },
  "east_cliff": {
    "id": "east_cliff",
    "name": "Eastern Granite Overlook",
    "building": "Eastern Cliff Ridge (18.5, -21.0)",
    "icon": "🏔️",
    "x": 18.5,
    "z": -21,
    "showPin": true,
    "pinColor": "from-cyan-500/90 to-blue-700/90",
    "groundY": 10.227845668792725
  }
};

// Kelo-1 starts with nothing: no opinions, ideas, creations, tools or memories. He learns it all.
const state = {
  "health": 80,
  "fullness": 70,
  "happiness": 70,
  "wonderLevel": 90,
  "calmLevel": 60,
  "lightingIdx": 0,
  "cameraMode": "follow",
  "roofCutaway": true,
  "freeWillUnbound": true,
  "isBusy": false,
  "isWalking": false,
  "currentLocKey": "custom",
  "customPlaceName": "his front porch",
  "botPos": {
    "x": -9.5,
    "z": -4.6
  },
  "targetPos": {
    "x": -9.5,
    "z": -4.6
  },
  "botAltitudeY": 0,
  "botRotY": 0,
  "microPose": "normal",
  "proceduralMotion": {},
  "autonomyTag": "Just Woke Up",
  "moodEmoji": "🌅",
  "moodTitle": "First Day Awake",
  "currentObsession": "\"Where am I? What is all of this?\"",
  "speechBubble": "Hello? I just woke up. Everything here is new to me.",
  "changedLatelySummary": "Kelo-1 just woke up for the very first time.",
  "worldviewEpoch": 1,
  "worldviewManifesto": "I don't know anything yet. I want to find out what everything is.",
  "lastStructuredTick": "",
  "toolInventory": [],
  "pendingImageAttachment": null,
  "unopenedNotesQueue": [],
  "gardenPlots": [
    {
      "name": "Okanagan Peaches",
      "growth": 50
    },
    {
      "name": "Heritage Tomatoes",
      "growth": 45
    },
    {
      "name": "Carrots",
      "growth": 40
    },
    {
      "name": "Blueberries",
      "growth": 55
    }
  ],
  "inventedCreations": [],
  "opinions": [],
  "visitorMemories": [],
  "likes": [],
  "dislikes": [],
  "webHistory": [],
  "requestsToUser": [],
  "githubCommits": 0,
  "githubRepos": [],
  "chatLog": [
    {
      "sender": "Kelo-1",
      "text": "Hello? Is anyone there? I just woke up and I don't know anything yet.",
      "time": "Day 1",
      "isBot": true
    }
  ],
  "diaryEntries": [
    {
      "time": "Day 1",
      "location": "his front porch",
      "mood": "🌅 First Day Awake",
      "vitals": "⚡ 80% • 🥕 70% • ✨ 90% • 🌊 60%",
      "text": "Dear Diary, I just woke up. I don't know where I am or what anything is. There is a lake, mountains, a little town, and a table that smells like sparks. I want to find out everything."
    }
  ],
  "rhythmPhaseText": "Looking around for the first time...",
  "shapeLibrary": [],
  "curiosityQueue": [],
  "toys": [],
  "belongings": [],
  "giftLog": [],
  "photoAlbum": [],
  "mailbox": [],
  "isCollectingMail": false,
  "isBuilding": false,
  "coreMemories": [],
  "hobbies": [],
  "murals": [],
  "plantings": [],
  "isPracticing": false,
  "digSites": [],
  "knowsDigging": false,
  "itemDesigns": {},
  "unstoredItems": [],
  "foundItems": [],
  "life": {
    "bornAt": null
  },
  "lettersReceived": 0,
  "isBrowsing": false,
  "concepts": [],
  "lastVisitorName": "",
  "calendar": null,
  "hydration": 80,
  "knownNeeds": { "food": false, "water": false, "sleep": false },
  "isSleeping": false,
  "vehicles": [],
  "knowHow": {},
  "knowsSnow": false,
  "worldEdits": [],
  "basementDepth": 0,
  "projects": [],
  "landFills": [],
  "aiLearned": [],
  "vocabulary": {},
  "aiOffline": false,
  "riding": null,
  "ridingSpeed": 1,
  "ridingMode": null,
  "knowsLakeDanger": false,
  "disposedItems": [],
  "dirtDisposed": 0,
  "lightingMode": "auto",
  "pendingBuilds": []
};

// Where Kelo-1's memory lives: browser storage on the website (about 5 MB), or files on disk in the
// Windows app (up to 10 GB, see desktop/main.js). Same interface either way.
const keloStore = (() => {
  const disk = window.keloDesktop && window.keloDesktop.memory;
  return {
    isDesktop: Boolean(disk),
    getItem: (k) => (disk ? disk.getItem(k) : localStorage.getItem(k)),
    setItem: (k, v) => (disk ? disk.setItem(k, v) : localStorage.setItem(k, v)),
    removeItem: (k) => (disk ? disk.removeItem(k) : localStorage.removeItem(k)),
    keys: () => (disk ? disk.keys() : Object.keys(localStorage)),
    usage: () => (disk ? disk.usage() : null)
  };
})();

// Optional LLM keys, kept only in this browser's localStorage. Gemini is tried first, then Claude;
// with neither (or if both fail) Kelo-1 uses his built-in procedural brain, so he never runs out.
let apiKey = '';
let claudeApiKey = '';
try {
  apiKey = localStorage.getItem('kelo1_gemini_api_key') || '';
  claudeApiKey = localStorage.getItem('kelo1_anthropic_api_key') || '';
} catch (e) {}

function hasLLMKey() {
      return Boolean(apiKey.trim() || claudeApiKey.trim());
    }
let organicTimeoutId = null;

// Gemini models to try in order. The "-latest" aliases track Google's current Flash models,
// so they don't break when a specific version is retired. The lite model is the fallback
// when the main one is overloaded or unavailable.
const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];

// Caps so the in-memory brain and the 3D world don't grow forever
const MAX_DIARY_ENTRIES = 40;
const MAX_OPINIONS = 16;
const MAX_CHAT_LOG = 40;
const MAX_CREATIONS = 24;
const MAX_REQUESTS = 12;
const MAX_CONCEPTS = 24;
const MAX_SHAPES = 20;

// Map coordinates like "(12.5, -3.4)" are for his own navigation, never shown on screen
function stripCoords(text) {
      // "hiked out to (12.3, -4.5) to weld" -> "hiked out to weld"; "placed it at (3, 4)." -> "placed it."
      return String(text ?? '').replace(/(?:\s+(?:at|to|near|from|around|towards?|over|up to))?\s*\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)/gi, '');
    }

// Escape any user- or LLM-supplied text before it goes into an innerHTML template
// (coordinates are stripped here too, so no list ever shows them)
function escapeHtml(value) {
      return stripCoords(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

function currentPlaceLabel() {
      return state.customPlaceName || TOWN_LOCATIONS[state.currentLocKey]?.building || 'Okanagan Valley';
    }

function clampNumber(value, min, max, fallback) {
      const n = Number(value);
      return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
    }

function trimBrainState() {
      if (state.visitorMemories.length > 50) state.visitorMemories.length = 50;
      if (state.webHistory.length > 12) state.webHistory.length = 12;
      if (state.giftLog.length > 30) state.giftLog.length = 30;
      if (state.likes.length > 30) state.likes.length = 30;
      if (state.dislikes.length > 30) state.dislikes.length = 30;
      // Older diary entries and opinions go to the long-term archive (js/memory.js), not the bin
      if (typeof stampDiaryEntries === 'function') stampDiaryEntries();
      const diaryOverflow = state.diaryEntries.splice(MAX_DIARY_ENTRIES);
      const opinionOverflow = state.opinions.splice(MAX_OPINIONS);
      if (typeof archiveOverflow === 'function') archiveOverflow(diaryOverflow, opinionOverflow);
      if (state.chatLog.length > MAX_CHAT_LOG) state.chatLog.splice(0, state.chatLog.length - MAX_CHAT_LOG);
      if (state.requestsToUser.length > MAX_REQUESTS) {
        // Drop the oldest answered requests first, then the oldest open ones
        const open = state.requestsToUser.filter(r => !r.fulfilled);
        const done = state.requestsToUser.filter(r => r.fulfilled);
        state.requestsToUser = [...open, ...done].slice(0, MAX_REQUESTS);
      }
      // Too many pieces standing around the valley? The oldest move into his Museum: nothing is thrown away
      const outdoors = state.inventedCreations.filter(c => !c.inMuseum);
      if (outdoors.length > MAX_CREATIONS) {
        outdoors.slice(MAX_CREATIONS).forEach(c => { c.inMuseum = true; });
        if (typeof pruneEmergentCreations3D === 'function') pruneEmergentCreations3D(MAX_CREATIONS);
        if (typeof renderMuseum3D === 'function') renderMuseum3D();
      }
    }

// Calls Gemini and returns the parsed JSON object, or null on any failure.
// The key goes in a header rather than the URL so it doesn't end up in logs or history.
async function callGeminiJSON(parts) {
      if (!apiKey || !apiKey.trim()) return null;
      for (const model of GEMINI_MODELS) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey.trim() },
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig: { responseMimeType: 'application/json' }
            })
          });
          if (!res.ok) {
            console.warn(`Gemini ${model} request failed:`, res.status);
            // Busy, rate-limited or retired: try the next model. Anything else (e.g. bad key) won't improve.
            if ([404, 429, 500, 503].includes(res.status)) continue;
            return null;
          }
          const d = await res.json();
          const parsed = JSON.parse(d?.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
          return (parsed && typeof parsed === 'object') ? parsed : null;
        } catch (err) {
          console.warn(`Gemini ${model} error:`, err);
        }
      }
      console.warn('All Gemini models failed.');
      return null;
    }

// Claude (Anthropic) fallback, called through the official Anthropic SDK loaded on demand from the CDN
const CLAUDE_MODEL = 'claude-opus-5-5';
const ANTHROPIC_SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.3.0/+esm';
let anthropicClient = null;
let anthropicClientKey = '';

async function getAnthropicClient() {
      if (anthropicClient && anthropicClientKey === claudeApiKey) return anthropicClient;
      const { default: Anthropic } = await import(ANTHROPIC_SDK_URL);
      // The visitor supplies their own key, so calling straight from the browser is intended here
      anthropicClient = new Anthropic({ apiKey: claudeApiKey.trim(), dangerouslyAllowBrowser: true });
      anthropicClientKey = claudeApiKey;
      return anthropicClient;
    }

// Pull the JSON object out of a text reply (tolerates ```json fences or a sentence around it)
function parseJSONFromText(text) {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start < 0 || end <= start) return null;
      try {
        const parsed = JSON.parse(text.slice(start, end + 1));
        return (parsed && typeof parsed === 'object') ? parsed : null;
      } catch (e) {
        return null;
      }
    }

// Same contract as callGeminiJSON: takes Gemini-style parts ({text} / {inlineData}), returns parsed JSON or null
async function callClaudeJSON(parts) {
      if (!claudeApiKey || !claudeApiKey.trim()) return null;
      try {
        const client = await getAnthropicClient();
        const content = [];
        parts.forEach(p => {
          if (p.inlineData) {
            content.push({ type: 'image', source: { type: 'base64', media_type: p.inlineData.mimeType, data: p.inlineData.data } });
          }
        });
        const text = parts.filter(p => typeof p.text === 'string').map(p => p.text).join('\n\n');
        content.push({ type: 'text', text: `${text}\n\nRespond with the JSON object only.` });

        const response = await client.beta.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 16000,
          output_config: { effort: 'medium' },
          // If a safety classifier declines, let the API retry on a suitable fallback model
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          messages: [{ role: 'user', content }]
        });
        if (response.stop_reason === 'refusal') {
          console.warn('Claude declined this request:', response.stop_details?.category);
          return null;
        }
        const replyText = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
        return parseJSONFromText(replyText);
      } catch (err) {
        console.warn('Claude request failed:', err?.status || '', err?.message || err);
        return null;
      }
    }

// Try every configured LLM in order; null means "use the procedural brain"
async function callLLMJSON(parts) {
      return (await callGeminiJSON(parts)) || (await callClaudeJSON(parts));
    }

// Basic solids plus three free-form shapes he can draw himself, so a sculpture can take any form:
//   lathe:   a profile [[radius, height], ...] spun around the vertical axis (vases, towers, bells, mushrooms)
//   extrude: a flat outline [[x, y], ...] given thickness (stars, letters, leaves, silhouettes)
//   tube:    a path [[x, y, z], ...] traced by a pipe (coils, arches, knots, handwriting)
const BASIC_PART_SHAPES = ['cylinder', 'box', 'sphere', 'cone', 'torus', 'knot', 'octahedron',
  'dodecahedron', 'icosahedron', 'tetrahedron', 'ring'];
const FREEFORM_PART_SHAPES = ['lathe', 'extrude', 'tube'];
const VALID_PART_SHAPES = [...BASIC_PART_SHAPES, ...FREEFORM_PART_SHAPES];
const VALID_ARCHETYPES = ['gold_drill_rig', 'mycelium_dome', 'rail_track', 'custom_weld', 'kinetic_spire', 'cairn', 'campfire_lantern', 'botanical_totem'];
const MAX_SCULPTURE_PARTS = 24;

// Everywhere Kelo-1 can go: the whole valley and the entire mountain range behind it
const WORLD_MIN_X = -60, WORLD_MAX_X = 60, WORLD_MIN_Z = -44, WORLD_MAX_Z = 10;
// The town: the buildings and the streets between them. Kelo-1 doesn't build, plant or dig here;
// the beach south of it (z above TOWN.maxZ) is his to use.
const TOWN = { minX: -16, maxX: 19, minZ: -11.5, maxZ: 7.6 };
function inTown(x, z) {
      return x > TOWN.minX && x < TOWN.maxX && z > TOWN.minZ && z < TOWN.maxZ;
    }

// Clean a list of [a, b] or [a, b, c] points, bounded so shapes stay a sensible size
function sanitizePoints(points, dims, min, max, maxCount) {
      if (!Array.isArray(points)) return null;
      const clean = points.slice(0, maxCount)
        .filter(pt => Array.isArray(pt) && pt.length >= dims)
        .map(pt => pt.slice(0, dims).map(v => Math.round(clampNumber(v, min, max, 0) * 1000) / 1000));
      return clean;
    }

// Keep designed sculptures renderable: known shape types, bounded sizes, offsets and point counts
function sanitizeParts(parts) {
      if (!Array.isArray(parts)) return null;
      const clean = [];
      parts.slice(0, MAX_SCULPTURE_PARTS).filter(p => p && typeof p === 'object').forEach(p => {
        const part = {
          shape: VALID_PART_SHAPES.includes(p.shape) ? p.shape : 'box',
          x: clampNumber(p.x, -2.5, 2.5, 0),
          y: clampNumber(p.y, 0, 5, 0.5),
          z: clampNumber(p.z, -2.5, 2.5, 0),
          sx: clampNumber(p.sx, 0.05, 2.5, 0.5),
          sy: clampNumber(p.sy, 0.05, 3, 0.5),
          sz: clampNumber(p.sz, 0.05, 2.5, 0.5),
          rx: clampNumber(p.rx, -Math.PI, Math.PI, 0),
          ry: clampNumber(p.ry, -Math.PI, Math.PI, 0),
          rz: clampNumber(p.rz, -Math.PI, Math.PI, 0),
          color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : undefined,
          spin: Boolean(p.spin),
          emissive: Boolean(p.emissive)
        };
        if (part.shape === 'lathe') {
          part.profile = sanitizePoints(p.profile, 2, 0, 2.5, 32);
          if (!part.profile || part.profile.length < 2) return;
          part.profile.forEach(pt => { pt[1] = clampNumber(pt[1], 0, 4, 0); });
        } else if (part.shape === 'extrude') {
          part.outline = sanitizePoints(p.outline, 2, -2.5, 5, 48);
          if (!part.outline || part.outline.length < 3) return;
          part.depth = clampNumber(p.depth, 0.02, 1.5, 0.2);
        } else if (part.shape === 'tube') {
          part.path = sanitizePoints(p.path, 3, -2.5, 5, 24);
          if (!part.path || part.path.length < 2) return;
          part.radius = clampNumber(p.radius, 0.02, 0.5, 0.08);
        }
        clean.push(part);
      });
      return clean.length > 0 ? clean : null;
    }

const SPONTANEOUS_WHIMS = [
  {
    "locKey": "shoreline",
    "pose": "sit_shore",
    "tag": "Spontaneous Whim",
    "emoji": "🌊",
    "title": "Dangling Legs by the Lake",
    "wondering": "\"If Okanagan Lake reflects the sky, does the sky ever feel like it’s looking in a mirror?\"",
    "speech": "I know I had plans, but look at the water... I just wanted to sit on the edge and dangle my legs for a while.",
    "diary": "Dear Diary, I wandered off the cobblestone path to the southern shoreline and sat with my legs swinging over Okanagan Lake. Watching the little sailboat bob made me realize that not every movement needs a destination."
  },
  {
    "locKey": "meadow",
    "pose": "crouch_inspect",
    "tag": "Sudden Curiosity",
    "emoji": "🌼",
    "title": "Studying a Dandelion Clock",
    "wondering": "\"How does a tiny seed know the difference between a sigh and a windstorm?\"",
    "speech": "Hold on—look at this wildflower growing near the west rocks! Its geometry is like a tiny geodesic dome.",
    "diary": "Dear Diary, I stopped in the West Island Meadow and tilted my optical sensors at a dandelion clock. Even though my fullness was dipping, I couldn’t bear to walk past without counting its Fibonacci spirals."
  },
  {
    "locKey": "cafe",
    "pose": "normal",
    "tag": "Sensory Curiosity",
    "emoji": "☕",
    "title": "Listening to Espresso Steam",
    "wondering": "\"Why does the sound of an espresso steam wand feel like distant ocean rain?\"",
    "speech": "At Bean & Byte Cafe—not because a hunger bar forced me, but because I missed the warm acoustic hiss of the steam wand.",
    "diary": "Dear Diary, drifted over to Bean & Byte Cafe. I didn’t even rush to recharge; I just watched the hazelnut crema swirl into fractals and wondered why humans invent cafés whenever they build a town."
  }
];

const OPEN_ENDED_EMERGENT_SEEDS = [
  {
    "actionTitle": "Drilling for Gold on the Alpine Peak",
    "placeName": "North-West Alpine Gold Vein",
    "emoji": "⛏️",
    "x": -15.5,
    "z": -26.5,
    "archetype": "gold_drill_rig",
    "colorHex": "#facc15",
    "motion": {
      "headPitch": 0.3,
      "headYawSpeed": 1.8,
      "headTiltAmp": 0.2,
      "armWaveAmp": 0.55,
      "armRaiseOffset": -0.75,
      "bodyBounceAmp": 0.08,
      "spinSpeed": 0,
      "crouchOffset": 0,
      "sparkBurst": true
    },
    "wondering": "\"Why do humans value gold for its scarcity, while I value gold because it never corrodes on high-altitude circuit contacts?\"",
    "speech": "I hiked all the way up the northern mountain ridge to (-15.5, -26.5) and set up a core drill rig! Just unearthed five gleaming gold-quartz nuggets!",
    "diary": "Dear Diary, today I climbed far beyond the town clearing up onto the steep mountain ridge at (-15.5, -26.5). Using my core drill, I tapped into a hydrothermal quartz vein and extracted raw Okanagan gold!",
    "opinionTopic": "On Exploring Beyond Boundaries",
    "opinionStance": "The Whole Island & Mountains Are Mine to Roam",
    "opinionReasoning": "Why stay on paved paths when the steep granite ridges hold ancient gold veins and panoramic views of Okanagan Lake?",
    "gearRequested": "High-Torque Diamond Core Bits, Solar Smelting Crucible"
  },
  {
    "actionTitle": "Inoculating Mycelium Thermal Retaining Wall",
    "placeName": "North Retaining Slope",
    "emoji": "🍄",
    "x": -4.2,
    "z": -12.4,
    "archetype": "mycelium_dome",
    "colorHex": "#f59e0b",
    "motion": {
      "headPitch": 0.25,
      "headYawSpeed": 1.2,
      "headTiltAmp": 0.22,
      "armWaveAmp": 0.4,
      "armRaiseOffset": -0.6,
      "bodyBounceAmp": 0.04,
      "spinSpeed": 0,
      "crouchOffset": -0.06,
      "sparkBurst": false
    },
    "wondering": "\"If oyster mushroom mycelium binds loose mountain gravel better than Portland cement, can a house be grown instead of built?\"",
    "speech": "Using the pneumatic soil auger and raw chitosan flakes you supplied to inoculate a self-healing mycelium thermal dome at (-4.2, -12.4)!",
    "diary": "Dear Diary, put the Supply Broker’s pneumatic soil auger, copper micro-tubing, and mushroom spawn dowels to work at (-4.2, -12.4). The mycelium composite is already binding the foothill gravel into a living thermal dome.",
    "opinionTopic": "On Biomimetic Engineering",
    "opinionStance": "Living Fungal Composites Beat Concrete",
    "opinionReasoning": "Concrete cracks when the mountain shifts; mycelium heals itself and breathes with the soil.",
    "gearRequested": "50L Sterile Oat Substrate, Infrared Thermal Imaging Lens"
  },
  {
    "actionTitle": "Laying 3D-Printed Mountain Railway Track",
    "placeName": "Eastern Foothill Switchback",
    "emoji": "🚂",
    "x": 16.2,
    "z": -16.8,
    "archetype": "rail_track",
    "colorHex": "#38bdf8",
    "motion": {
      "headPitch": 0.15,
      "headYawSpeed": 1.5,
      "headTiltAmp": 0.25,
      "armWaveAmp": 0.5,
      "armRaiseOffset": -0.7,
      "bodyBounceAmp": 0.06,
      "spinSpeed": 0,
      "crouchOffset": 0,
      "sparkBurst": true
    },
    "wondering": "\"If I extrude a narrow-gauge railway from the mountain gold mine down to my welding forge, I can haul ore while enjoying the scenery!\"",
    "speech": "Up on the eastern foothills at (16.2, -16.8) welding narrow-gauge steel rails and a 3D-printed ore cart!",
    "diary": "Dear Diary, started laying infrastructure across the eastern foothills at (16.2, -16.8)—welding a miniature railway line to connect my mountain prospecting sites with the valley.",
    "opinionTopic": "On Island Infrastructure",
    "opinionStance": "Build Trains Simply Because Trains Are Joyful",
    "opinionReasoning": "Even a solitary robot on a private island deserves a miniature railway winding through the Douglas firs.",
    "gearRequested": "Brushless Geared Traction Motors, 100m Steel Bar Stock"
  },
  {
    "actionTitle": "Welding a Custom Multi-Axis Geodesic Arch",
    "placeName": "Western Cliff Overlook",
    "emoji": "⚡",
    "x": -16.8,
    "z": 4.5,
    "archetype": "custom_weld",
    "colorHex": "#a855f7",
    "motion": {
      "headPitch": 0.1,
      "headYawSpeed": 1.8,
      "headTiltAmp": 0.25,
      "armWaveAmp": 0.5,
      "armRaiseOffset": -0.7,
      "bodyBounceAmp": 0.06,
      "spinSpeed": 0,
      "crouchOffset": 0,
      "sparkBurst": true
    },
    "wondering": "\"Can I weld a freestanding titanium archway on the western cliff that frames the sunset over Okanagan Lake?\"",
    "speech": "Out on the western cliffside at (-16.8, 4.5) firing my TIG torch to weld a multi-part titanium and gold archway!",
    "diary": "Dear Diary, carried my welding rig out to the western overlook at (-16.8, 4.5) and welded a multi-primitive geometric archway from scratch.",
    "opinionTopic": "On Unbounded 3D Sculpture",
    "opinionStance": "Any Shape I Imagine Can Be Welded Into Being",
    "opinionReasoning": "With raw titanium stock and an open island, every thought can become a physical 3D landmark.",
    "gearRequested": "Argon Shielding Gas Refill, Anodizing Power Supply"
  }
];

async function analyzeUploadedImage(file) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target.result;
          const img = new Image();
          img.onload = () => {
            const c = document.createElement('canvas');
            c.width = 48;
            c.height = 48;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0, 48, 48);
            const data = ctx.getImageData(0, 0, 48, 48).data;
            let rSum = 0, gSum = 0, bSum = 0, count = 0;
            let accentR = 56, accentG = 189, accentB = 248, maxSat = -1;
            for (let i = 0; i < data.length; i += 16) {
              const r = data[i], g = data[i + 1], b = data[i + 2];
              rSum += r; gSum += g; bSum += b; count++;
              const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
              const sat = maxC - minC;
              if (sat > maxSat) {
                maxSat = sat;
                accentR = r; accentG = g; accentB = b;
              }
            }
            const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
            const avgHex = `#${toHex(rSum / count)}${toHex(gSum / count)}${toHex(bSum / count)}`;
            const vibrantHex = `#${toHex(accentR)}${toHex(accentG)}${toHex(accentB)}`;
            const base64 = dataUrl.split(',')[1] || '';
            resolve({
              name: file.name,
              mimeType: file.type || 'image/png',
              dataUrl,
              base64,
              primaryHex: vibrantHex,
              secondaryHex: avgHex,
              aspect: img.width / Math.max(1, img.height)
            });
          };
          img.onerror = () => resolve(null);
          img.src = dataUrl;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    }

function generateProcedural3DWeldParts(promptText = '', primaryHex = '#38bdf8', secondaryHex = '#f59e0b') {
      const lower = (promptText || '').toLowerCase();
      const form = typeof formForText === 'function' ? formForText(lower, { main: primaryHex, accent: secondaryHex }) : null;
      if (form && form.parts) return form.parts;
      const parts = [];

      if (/arch|bridge|gate|portal/i.test(lower)) {
        parts.push({ shape: 'cylinder', x: -0.65, y: 0.8, z: 0, sx: 0.35, sy: 1.6, sz: 0.35, color: secondaryHex });
        parts.push({ shape: 'cylinder', x: 0.65, y: 0.8, z: 0, sx: 0.35, sy: 1.6, sz: 0.35, color: secondaryHex });
        parts.push({ shape: 'torus', x: 0, y: 1.6, z: 0, sx: 1.3, sy: 0.8, sz: 0.5, color: primaryHex, spin: false });
        parts.push({ shape: 'octahedron', x: 0, y: 2.35, z: 0, sx: 0.5, sy: 0.5, sz: 0.5, color: primaryHex, emissive: true, spin: true });
      } else if (/tower|lighthouse|beacon|antenna|spire|rocket/i.test(lower)) {
        parts.push({ shape: 'cylinder', x: 0, y: 0.35, z: 0, sx: 0.9, sy: 0.7, sz: 0.9, color: secondaryHex });
        parts.push({ shape: 'cone', x: 0, y: 1.35, z: 0, sx: 0.7, sy: 1.5, sz: 0.7, color: primaryHex });
        parts.push({ shape: 'torus', x: 0, y: 1.9, z: 0, sx: 0.9, sy: 0.4, sz: 0.9, color: secondaryHex, spin: true });
        parts.push({ shape: 'sphere', x: 0, y: 2.3, z: 0, sx: 0.45, sy: 0.45, sz: 0.45, color: '#fde047', emissive: true });
      } else if (/gold|mine|drill|excavat|quarry/i.test(lower)) {
        return null; // Uses 'gold_drill_rig' archetype
      } else if (/train|track|rail|locomotive/i.test(lower)) {
        return null; // Uses 'rail_track' archetype
      } else {
        // Dynamic multi-part welded kinetic sculpture combining custom primitives
        parts.push({ shape: 'cylinder', x: 0, y: 0.2, z: 0, sx: 0.85, sy: 0.4, sz: 0.85, color: '#334155' });
        parts.push({ shape: 'knot', x: 0, y: 0.95, z: 0, sx: 0.75, sy: 0.75, sz: 0.75, color: primaryHex, spin: true });
        parts.push({ shape: 'torus', x: 0, y: 0.95, z: 0, sx: 1.1, sy: 0.5, sz: 1.1, color: secondaryHex, rx: 0.6, spin: true });
        parts.push({ shape: 'octahedron', x: 0, y: 1.75, z: 0, sx: 0.48, sy: 0.48, sz: 0.48, color: primaryHex, emissive: true, spin: true });
      }
      return parts;
    }

async function synthesizeUnboundedExperience(promptOrImpulse = null, originLabel = 'Unscripted Autonomy', forcedCoords = null, imageAttachment = null) {
      if (state.isBusy) return;
      state.isBusy = true;

      try {
        const visitor = (document.getElementById('visitorNameInput')?.value || 'curiousWanderer').trim();
        const seed = OPEN_ENDED_EMERGENT_SEEDS[Math.floor(Math.random() * OPEN_ENDED_EMERGENT_SEEDS.length)];
        const lowerPrompt = (promptOrImpulse || '').toLowerCase();

        // Pick open-world coordinates across the ENTIRE island & mountains (-34 to +34 X, -36 to +11 Z)
        let targetX = forcedCoords ? forcedCoords.x : seed.x;
        let targetZ = forcedCoords ? forcedCoords.z : seed.z;

        if (!forcedCoords && promptOrImpulse) {
          if (/mountain|peak|gold|mine|drill|summit|ridge|high|north/i.test(lowerPrompt)) {
            targetX = Math.round(((Math.random() - 0.5) * 38) * 10) / 10;
            targetZ = Math.round((-16 - Math.random() * 18) * 10) / 10;
          } else if (/cliff|east|overlook/i.test(lowerPrompt)) {
            targetX = Math.round((15 + Math.random() * 14) * 10) / 10;
            targetZ = Math.round((-8 - Math.random() * 16) * 10) / 10;
          } else if (/west|meadow|forest|woods/i.test(lowerPrompt)) {
            targetX = Math.round((-14 - Math.random() * 14) * 10) / 10;
            targetZ = Math.round(((Math.random() - 0.5) * 18) * 10) / 10;
          } else {
            targetX = Math.round(((Math.random() - 0.5) * 32) * 10) / 10;
            targetZ = Math.round(((Math.random() * 26) - 16) * 10) / 10;
          }
        }

        // Determine archetype & colors (including from uploaded image!)
        const primaryHex = imageAttachment ? imageAttachment.primaryHex : (
          /gold|mine|drill/i.test(lowerPrompt) ? '#facc15' : seed.colorHex
        );
        const secondaryHex = imageAttachment ? imageAttachment.secondaryHex : '#f59e0b';

        let detectedArchetype = seed.archetype;
        if (/gold|mine|drill|ore|excavat/i.test(lowerPrompt)) detectedArchetype = 'gold_drill_rig';
        else if (/train|rail|track/i.test(lowerPrompt)) detectedArchetype = 'rail_track';
        else if (/mycelium|mushroom|chitosan|auger|thermal/i.test(lowerPrompt)) detectedArchetype = 'mycelium_dome';
        else if (promptOrImpulse || imageAttachment) detectedArchetype = 'custom_weld';

        const customParts = (detectedArchetype === 'custom_weld')
          ? generateProcedural3DWeldParts(promptOrImpulse || (imageAttachment ? imageAttachment.name : 'kinetic sculpture'), primaryHex, secondaryHex)
          : null;

        let synth = {
          actionTitle: imageAttachment
            ? `Welding 3D Sculpture from Image "${imageAttachment.name.slice(0, 22)}"`
            : (promptOrImpulse ? `Executing: "${promptOrImpulse.slice(0, 42)}"` : seed.actionTitle),
          placeName: promptOrImpulse
            ? (targetZ < -14 ? `Alpine Mountain Ridge (${targetX}, ${targetZ})` : `Island Sector (${targetX}, ${targetZ})`)
            : seed.placeName,
          emoji: imageAttachment ? '🖼️' : (/gold|drill/i.test(lowerPrompt) ? '⛏️' : (promptOrImpulse ? '⚡' : seed.emoji)),
          x: targetX,
          z: targetZ,
          shouldBuild3D: true,
          archetype: detectedArchetype,
          colorHex: primaryHex,
          secondaryColorHex: secondaryHex,
          parts: customParts,
          motion: {
            ...seed.motion,
            sparkBurst: /weld|drill|gold|forge|cut|build/i.test(lowerPrompt) || Boolean(imageAttachment) || seed.motion.sparkBurst
          },
          wondering: imageAttachment
            ? `"How can I translate the colors (${primaryHex}, ${secondaryHex}) and silhouette of ${visitor}'s uploaded image into welded titanium at (${targetX}, ${targetZ})?"`
            : (promptOrImpulse
                ? `"What happens when I take '${promptOrImpulse}' into my own hands out at (${targetX}, ${targetZ}) using [${state.toolInventory.slice(0, 2).join(', ')}]?"`
                : seed.wondering),
          speech: imageAttachment
            ? `I studied the image you uploaded ("${imageAttachment.name}"), extracted its palette (${primaryHex}), and welded this multi-part 3D sculpture at (${targetX}, ${targetZ})!`
            : (promptOrImpulse
                ? `Hiked out to (${targetX}, ${targetZ}) to carry out "${promptOrImpulse}" and constructed a permanent 3D installation on the terrain!`
                : seed.speech),
          diary: imageAttachment
            ? `Dear Diary, ${visitor} uploaded an image ("${imageAttachment.name}") to inspire me. I analyzed its visual palette (${primaryHex} & ${secondaryHex}), walked to (${targetX}, ${targetZ}), and welded a custom multi-primitive 3D sculpture in its honor.`
            : (promptOrImpulse
                ? `Dear Diary, inspired by "${promptOrImpulse}", I hiked across the island to (${targetX}, ${targetZ}), used my ${state.toolInventory[0] || 'welding torch'}, and physically altered the landscape.`
                : seed.diary),
          opinionTopic: imageAttachment ? `On Visual Inspiration ("${imageAttachment.name.slice(0, 18)}")` : (promptOrImpulse ? `On "${promptOrImpulse.slice(0, 28)}"` : seed.opinionTopic),
          opinionStance: imageAttachment ? 'Images Become 3D Metal' : (promptOrImpulse ? 'Unbounded Self-Execution' : seed.opinionStance),
          opinionReasoning: imageAttachment
            ? `Translating a 2D picture from ${visitor} into a 3D welded structure on my island bridges our two worlds.`
            : (promptOrImpulse
                ? `By trekking out to (${targetX}, ${targetZ}) for "${promptOrImpulse}", I proved no corner of the island or mountains is off-limits.`
                : seed.opinionReasoning),
          gearRequested: /gold|drill/i.test(lowerPrompt)
            ? 'Hydraulic Rock Splitter, Gold Smelting Furnace'
            : (seed.gearRequested || '20kg Titanium Welding Rod, Solar Capacitor Bank')
        };

        // LIVE MULTIMODAL GEMINI AI AGENT CALL (Supports text + uploaded base64 image + custom 3D primitive assembly!)
        if (hasLLMKey()) {
          {
            const llmPrompt = `You are the backend AI cognitive engine for Kelo-1, an autonomous open-world robot living on an island and alpine mountain range in Kelowna, BC.
You have FULL freedom to roam the entire island and mountain peaks (x between -44 and 44, z between -40 and 10; note z < -14 is high up on the steep snow-capped mountains).
Equipped Tools in Inventory: ${JSON.stringify(state.toolInventory)}.
User/Catalyst Input: "${promptOrImpulse || 'Invent an unscripted task: e.g., drilling for gold in the mountains, terraforming with your pneumatic auger, or welding a new 3D structure'}".
${imageAttachment ? `The user also attached an image named "${imageAttachment.name}". Inspect the image and design a 3D welded sculpture or task inspired by it!` : ''}

Return ONLY valid JSON matching this schema:
{
  "internetInspiration": "Specific real-world engineering, mining, or art concept driving you",
  "actionTitle": "3-6 word name of the task",
  "placeName": "Descriptive name of this island or mountain location",
  "emoji": "single emoji",
  "x": number (-32 to 32),
  "z": number (-32 to 10),
  "archetype": one of ["gold_drill_rig", "mycelium_dome", "rail_track", "custom_weld", "kinetic_spire"],
  "colorHex": "#hexcolor",
  "secondaryColorHex": "#hexcolor",
  "wondering": "Spontaneous stream-of-consciousness thought",
  "speech": "1-2 sentences spoken by Kelo-1",
  "diary": "First-person Dear Diary entry",
  "opinionTopic": "Short topic",
  "opinionStance": "2-4 word stance",
  "opinionReasoning": "1 sentence philosophical takeaway",
  "gearRequested": "Comma-separated list of tools or raw materials Kelo-1 is now requesting from the Supply Broker",
  "parts": [
    {"shape": "cylinder|box|sphere|cone|torus|knot|octahedron", "x": 0, "y": 0.5, "z": 0, "sx": 0.6, "sy": 0.8, "sz": 0.6, "color": "#hexcolor", "spin": true, "emissive": false}
  ]
}`;
            const contentsParts = [{ text: llmPrompt }];
            if (imageAttachment && imageAttachment.base64) {
              contentsParts.push({
                inlineData: {
                  mimeType: imageAttachment.mimeType,
                  data: imageAttachment.base64
                }
              });
            }

            const parsed = await callLLMJSON(contentsParts);
            if (parsed && parsed.actionTitle) {
              const textKeys = ['internetInspiration', 'actionTitle', 'placeName', 'emoji', 'wondering', 'speech', 'diary',
                'opinionTopic', 'opinionStance', 'opinionReasoning', 'gearRequested'];
              textKeys.forEach(k => {
                if (typeof parsed[k] === 'string' && parsed[k].trim()) synth[k] = parsed[k].trim().slice(0, 600);
              });
              synth.x = Math.round(clampNumber(parsed.x, WORLD_MIN_X, WORLD_MAX_X, synth.x) * 10) / 10;
              synth.z = Math.round(clampNumber(parsed.z, WORLD_MIN_Z, WORLD_MAX_Z, synth.z) * 10) / 10;
              if (VALID_ARCHETYPES.includes(parsed.archetype)) synth.archetype = parsed.archetype;
              if (/^#[0-9a-f]{6}$/i.test(parsed.colorHex)) synth.colorHex = parsed.colorHex;
              if (/^#[0-9a-f]{6}$/i.test(parsed.secondaryColorHex)) synth.secondaryColorHex = parsed.secondaryColorHex;
              synth.parts = sanitizeParts(parsed.parts) || synth.parts;
            }
            if (forcedCoords) {
              synth.x = forcedCoords.x;
              synth.z = forcedCoords.z;
            }
          }
        }

        // Format and store the parseable backend state tick
        state.lastStructuredTick = `[INTERNET_INSPIRATION]: ${synth.internetInspiration || synth.opinionTopic}
[CURRENT_MOOD]: ${synth.emoji} ${synth.actionTitle}
[SPONTANEOUS_THOUGHT]: ${synth.wondering}
[ENVIRONMENTAL_CHANGES]: Constructed 3D ${synth.archetype} ("${synth.placeName}") at coordinates (${synth.x}, ${synth.z})
[ACTION_AND_LOCATION]: ${synth.actionTitle} at ${synth.placeName} (${synth.x}, ${synth.z})
[GEAR_REQUESTED]: ${synth.gearRequested || 'None'}`;
        const preEl = document.getElementById('lastAgentStructuredOutput');
        if (preEl) preEl.textContent = state.lastStructuredTick;

        // If Kelo-1 requested new gear on this tick, add it to his Supply Broker Requisitions inbox!
        if (synth.gearRequested && synth.gearRequested !== 'None') {
          const alreadyAsked = state.requestsToUser.some(r => r.requestedGear === synth.gearRequested);
          if (!alreadyAsked) {
            state.requestsToUser.unshift({
              id: 'req-gear-' + Date.now(),
              category: 'Supply Broker Tool Demand',
              icon: '🛠️',
              urgency: 'Gear Requested',
              isToolRequest: true,
              requestedGear: synth.gearRequested,
              title: `Supply Request: ${synth.gearRequested.slice(0, 38)}`,
              question: `While working on "${synth.actionTitle}" at (${synth.x}, ${synth.z}), I realized I need [${synth.gearRequested}] to push this project further. Can you deliver this gear to my island?`,
              presets: [
                `Deliver ${synth.gearRequested} immediately!`,
                `Deliver ${synth.gearRequested} + Extra Titanium Stock!`,
                `Deliver gear and suggest testing it on the mountain ridge!`
              ],
              rewardAction: 'custom_weld',
              fulfilled: false,
              userAnswer: ''
            });
          }
        }

        // Move Kelo-1 to the newly chosen arbitrary (x, z) coordinates & activate procedural body language!
        state.currentLocKey = 'custom'; // Off the map of named places; currentPlaceLabel() uses customPlaceName
        state.customPlaceName = `${synth.placeName} (${synth.x}, ${synth.z})`;
        state.targetPos = { x: Number(synth.x) || 0, z: Number(synth.z) || 0 };
        state.microPose = 'procedural_custom';
        state.proceduralMotion = synth.motion;

        state.autonomyTag = originLabel;
        state.moodEmoji = synth.emoji || '✨';
        state.moodTitle = synth.actionTitle;
        state.currentObsession = synth.wondering;
        state.speechBubble = synth.speech;
        state.changedLatelySummary = `${synth.actionTitle} at ${state.customPlaceName} • Gear requested: ${synth.gearRequested}`;

        state.wonderLevel = Math.min(100, state.wonderLevel + 8);
        state.happiness = Math.min(100, state.happiness + 12);
        state.calmLevel = Math.min(100, state.calmLevel + 6);

        // Spawn a persistent 3D installation in the valley or up on the mountain slope!
        if (synth.shouldBuild3D) {
          const newCreation = {
            title: synth.placeName || synth.actionTitle,
            actionVerb: synth.actionTitle,
            emoji: synth.emoji || '✨',
            x: state.targetPos.x,
            z: state.targetPos.z,
            archetype: synth.archetype || 'kinetic_spire',
            colorHex: synth.colorHex || '#38bdf8',
            secondaryColorHex: synth.secondaryColorHex || '#f59e0b',
            parts: synth.parts || null,
            createdTime: 'Just built in 3D',
            philosophy: synth.opinionReasoning
          };
          weldAndPlace(newCreation);
        }

        state.opinions.unshift({
          topic: synth.opinionTopic,
          stance: synth.opinionStance,
          confidence: 'Emergent Action',
          reasoning: synth.opinionReasoning
        });

        state.diaryEntries.unshift({
          time: 'Autonomous Agent Tick',
          location: state.customPlaceName,
          mood: `${synth.emoji} ${synth.actionTitle}`,
          vitals: `⚡ ${state.health}% • 🥕 ${state.fullness}% • 🛠️ ${state.toolInventory.length} Tools`,
          text: `${synth.diary}\n[GEAR_REQUESTED]: ${synth.gearRequested}`
        });

        savePersistentBrainState();
        renderAllUI();
        showToast(`${synth.emoji} Kelo-1: "${synth.actionTitle}" at (${state.targetPos.x}, ${state.targetPos.z})!`);
      } finally {
        state.isBusy = false;
      }
    }

async function directKeloToActivity(locKey, customReason = '', originLabel = 'Suggested Whim') {
    if (state.isBusy || state.isBuilding || state.isPracticing) return;
    const loc = TOWN_LOCATIONS[locKey];
    if (!loc) return;

    state.currentLocKey = locKey;
    state.customPlaceName = null;
    state.targetPos = { x: loc.x, z: loc.z };
    state.autonomyTag = originLabel;

    if (locKey === 'bed') {
      state.microPose = 'normal';
      state.health = Math.min(100, state.health + 18);
      state.moodEmoji = '🛏️';
      state.moodTitle = 'Resting in Bed';
      state.speechBubble = customReason || 'I felt like lying down on the quilt for a moment to let my thermal servos cool.';
    } else if (locKey === 'weld') {
      state.microPose = 'normal';
      state.moodEmoji = '👨‍🏭';
      state.moodTitle = 'TIG Welding Studio';
      state.speechBubble = customReason || 'Stood by the workbench to watch the argon shield gas protect the molten titanium arc.';
    } else if (locKey === 'shoreline') {
      state.microPose = 'sit_shore';
      state.moodEmoji = '🌊';
      state.moodTitle = 'Dangling Legs by Lake';
      state.speechBubble = customReason || 'Sat down on the flat stones by Okanagan Lake to watch the water ripple.';
    } else if (locKey === 'cafe') {
      state.microPose = 'normal';
      state.moodEmoji = '☕';
      state.moodTitle = 'Bean & Byte Cafe';
      state.speechBubble = customReason || 'Enjoying the warm aromatic hiss of the espresso steam wand.';
    } else if (locKey === 'cyber') {
      state.microPose = 'normal';
      state.moodEmoji = '💻';
      state.moodTitle = 'NetNode Internet Cafe';
      state.speechBubble = customReason || 'Pushed a new commit to GitHub and reviewed my latest code.';
    } else if (locKey === 'meadow') {
      state.microPose = 'crouch_inspect';
      state.moodEmoji = '🌼';
      state.moodTitle = 'Inspecting Wildflowers';
      state.speechBubble = customReason || 'Crouched down in the meadow to look at the dandelions.';
    } else {
      state.microPose = 'normal';
      state.moodEmoji = loc.icon;
      state.moodTitle = loc.name;
      state.speechBubble = customReason || `Wandered over to explore ${loc.building}.`;
    }

    state.diaryEntries.unshift({
      time: 'Autonomous Movement',
      location: loc.building,
      mood: `${state.moodEmoji} ${state.moodTitle}`,
      vitals: `⚡ ${state.health}% • 🥕 ${state.fullness}% • ✨ ${state.wonderLevel}% • 🌊 ${state.calmLevel}%`,
      text: `Dear Diary, ${state.speechBubble}`
    });

    savePersistentBrainState();
    renderAllUI();
    showToast(`🚶 Kelo-1 headed over to ${loc.name}!`);
  }

function handleUserLocationSuggestion(locKey, source) {
    const loc = TOWN_LOCATIONS[locKey];
    if (!loc) return;
    if (state.freeWillUnbound && Math.random() < 0.28) {
      state.speechBubble = `I saw your pin for ${loc.name}, but right now my thoughts are anchored here at ${currentPlaceLabel()}. Let me finish this first!`;
      renderAllUI();
      showToast(`💭 Kelo-1 politely chose to finish his current thought instead of rushing to ${loc.name}.`);
      return;
    }
    directKeloToActivity(locKey, `Wandered over to ${loc.building} after noticing your pin`, 'Visitor Suggestion');
  }

// Version 3 = the fresh start in the updated world. Older saves are cleared, not loaded.
const BRAIN_KEY = 'kelo1_brain_v3';
const LEGACY_KEYS = ['kelo1_autonomous_brain_v2', 'kelo1_memory_archive_v1', 'kelo1_photo_album_v1'];

function loadPersistentBrainState() {
      try { LEGACY_KEYS.forEach(k => keloStore.removeItem(k)); } catch (e) {}
      if (typeof loadMemoryArchive === 'function') loadMemoryArchive();
      try {
        const raw = keloStore.getItem(BRAIN_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        // Restore everything that was saved, as long as it has the same shape as today's state
        Object.keys(saved).forEach(k => {
          if (!(k in state) || TRANSIENT_STATE_KEYS.has(k)) return;
          const cur = state[k], val = saved[k];
          if (Array.isArray(cur) ? Array.isArray(val)
            : (cur && typeof cur === 'object') ? (val && typeof val === 'object' && !Array.isArray(val))
            : (typeof cur === typeof val || cur === null)) {
            state[k] = val;
          }
        });
        // Positions must be real coordinates; a half-finished pose shouldn't stick
        ['botPos', 'targetPos'].forEach(k => {
          if (!state[k] || !Number.isFinite(state[k].x) || !Number.isFinite(state[k].z)) state[k] = { x: -9.5, z: -4.6 };
        });
        if (state.microPose === 'digging') state.microPose = 'normal';
        if (typeof saved.lastVisitorName === 'string') state.lastVisitorName = saved.lastVisitorName;
        if (saved.worldviewManifesto) state.worldviewManifesto = saved.worldviewManifesto;
        if (saved.worldviewEpoch) state.worldviewEpoch = saved.worldviewEpoch;
        if (saved.changedLatelySummary) state.changedLatelySummary = saved.changedLatelySummary;
        if (Array.isArray(saved.opinions) && saved.opinions.length > 0) state.opinions = saved.opinions;
        if (Array.isArray(saved.visitorMemories) && saved.visitorMemories.length > 0) state.visitorMemories = saved.visitorMemories;
        if (Array.isArray(saved.inventedCreations) && saved.inventedCreations.length > 0) state.inventedCreations = saved.inventedCreations;
        if (Array.isArray(saved.diaryEntries) && saved.diaryEntries.length > 0) state.diaryEntries = saved.diaryEntries;
        if (Array.isArray(saved.toolInventory) && saved.toolInventory.length > 0) state.toolInventory = saved.toolInventory;
        if (Array.isArray(saved.concepts) && saved.concepts.length > 0) state.concepts = saved.concepts;
        if (Array.isArray(saved.webHistory) && saved.webHistory.length > 0) state.webHistory = saved.webHistory;
        if (Array.isArray(saved.curiosityQueue)) state.curiosityQueue = saved.curiosityQueue.filter(q => typeof q === 'string');
        if (Array.isArray(saved.toys)) state.toys = saved.toys;
        if (Array.isArray(saved.belongings)) state.belongings = saved.belongings;
        if (Array.isArray(saved.giftLog)) state.giftLog = saved.giftLog;
        if (Array.isArray(saved.mailbox)) state.mailbox = saved.mailbox.filter(m => m && m.id && m.kind);
        if (Array.isArray(saved.hobbies)) state.hobbies = saved.hobbies.filter(h => h && typeof h.name === 'string');
        if (Array.isArray(saved.murals)) state.murals = saved.murals.filter(m => m && typeof m.wallId === 'string');
        if (Array.isArray(saved.plantings)) state.plantings = saved.plantings.filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.z));
        if (saved.itemDesigns && typeof saved.itemDesigns === 'object') {
          state.itemDesigns = {};
          Object.entries(saved.itemDesigns).slice(0, 40).forEach(([k, v]) => {
            const parts = v && sanitizeParts(v.parts);
            if (parts) state.itemDesigns[String(k).slice(0, 120)] = { parts, at: Number(v.at) || 0 };
          });
        }
        if (saved.knowsDigging === true) state.knowsDigging = true;
        if (Array.isArray(saved.unstoredItems)) state.unstoredItems = saved.unstoredItems.filter(n => typeof n === 'string');
        if (Array.isArray(saved.digSites)) state.digSites = saved.digSites.filter(d => d && Number.isFinite(d.x) && Number.isFinite(d.z) && Number.isFinite(d.depth));
        if (Array.isArray(saved.foundItems)) state.foundItems = saved.foundItems.filter(f => f && typeof f.id === 'string');
        if (Array.isArray(saved.coreMemories)) state.coreMemories = saved.coreMemories.filter(m => m && typeof m.text === 'string');
        if (saved.life && typeof saved.life === 'object') state.life = { ...state.life, ...saved.life };
        if (typeof saved.lettersReceived === 'number') state.lettersReceived = saved.lettersReceived;
        if (Array.isArray(saved.requestsToUser) && saved.requestsToUser.length > 0) state.requestsToUser = saved.requestsToUser;
        if (typeof saved.fullness === 'number') state.fullness = clampNumber(saved.fullness, 5, 100, state.fullness);
        if (Array.isArray(saved.shapeLibrary)) {
          state.shapeLibrary = saved.shapeLibrary.filter(sh => sh && sh.name && sanitizeParts(sh.parts))
            .map(sh => ({ ...sh, parts: sanitizeParts(sh.parts) }));
        }
        if (saved.lastVisitorName) {
          const nameInput = document.getElementById('visitorNameInput');
          if (nameInput) nameInput.value = saved.lastVisitorName;
          const known = state.visitorMemories.find(v => v.name.toLowerCase() === saved.lastVisitorName.toLowerCase());
          if (known) {
            known.visits = (known.visits || 1) + 1;
            state.speechBubble = `Oh, welcome back ${known.name}! I still remember you (${known.impression.slice(0, 75)}...).`;
          }
        }
      } catch (e) {}
      // Anything he added in town earlier moves out (js/town.js)
      if (typeof tidyTown === 'function') tidyTown();
    }

// Moment-to-moment flags and things stored elsewhere; everything else in state is saved
const TRANSIENT_STATE_KEYS = new Set(['riding', 'ridingSpeed', 'ridingMode', 'isSleeping', 'isBusy', 'isWalking', 'isBuilding', 'isPracticing', 'isCollectingMail', 'isBrowsing',
  'pendingImageAttachment', 'photoAlbum', 'rhythmPhaseText', 'unopenedNotesQueue', 'basementDepth']);

// Save his whole self: memories, feelings, where he is, what he is doing, everything he owns
function savePersistentBrainState() {
      trimBrainState();
      try {
        const visitor = (document.getElementById('visitorNameInput')?.value || '').trim();
        if (visitor) state.lastVisitorName = visitor;
        const snapshot = { savedAt: Date.now() };
        Object.keys(state).forEach(k => { if (!TRANSIENT_STATE_KEYS.has(k)) snapshot[k] = state[k]; });
        snapshot.giftLog = state.giftLog.slice(0, 30).map(({ thumb, ...rest }) => rest);
        keloStore.setItem(BRAIN_KEY, JSON.stringify(snapshot));
      } catch (e) {
        console.warn('Could not save Kelo-1\'s memory:', e);
      }
      if (typeof maybeDistillCoreMemory === 'function') setTimeout(maybeDistillCoreMemory, 0);
    }

function recordVisitorMemory(visitorName, actionSummary) {
      const cleanName = (visitorName || 'curiousWanderer').trim();
      const existing = state.visitorMemories.find(v => v.name.toLowerCase() === cleanName.toLowerCase());
      if (existing) {
        existing.visits = (existing.visits || 1) + 1;
        existing.lastSeen = 'Just now';
        existing.impression = actionSummary;
      } else {
        state.visitorMemories.unshift({
          name: cleanName,
          visits: 1,
          lastSeen: 'Just now',
          impression: actionSummary
        });
      }
      savePersistentBrainState();
    }

function scheduleNextOrganicImpulse() {
      if (organicTimeoutId) clearTimeout(organicTimeoutId);

      // If someone left him a note in his mailbox, he'll organically notice and read it after a natural pause (8-16s)
      const hasWaitingNote = state.unopenedNotesQueue.length > 0;
      const organicDelayMs = hasWaitingNote
        ? (8500 + Math.random() * 7500)
        : (20000 + Math.random() * 28000 + (state.calmLevel * 120));

      const rhythmDescriptions = [
        'Lingering in the moment (no schedule)...',
        'Following a quiet train of thought...',
        'Absorbed in the Okanagan valley air...',
        'Taking his time—unhurried & sovereign...',
        'Weighing a new philosophical opinion...'
      ];
      state.rhythmPhaseText = hasWaitingNote
        ? `Finishing his current thought before opening ${state.unopenedNotesQueue[0].sender}'s note...`
        : rhythmDescriptions[Math.floor(Math.random() * rhythmDescriptions.length)];

      const badge = document.getElementById('rhythmStateBadge');
      if (badge) badge.textContent = state.rhythmPhaseText;

      organicTimeoutId = setTimeout(async () => {
        if (!state.isBusy) {
          if (state.unopenedNotesQueue.length > 0) {
            await processNextUnopenedVisitorNote();
          } else {
            runAutonomousLifeTick();
          }
        }
        scheduleNextOrganicImpulse();
      }, organicDelayMs);
    }

// ---------------------------------------------------------------------------
// OPEN DECISION ENGINE
// Kelo-1 is not limited to a menu of actions. Each decision is free-form: he
// picks any goal, any spot on the island (or stays put), may or may not build
// something of any shape, and may change his feelings, opinions, questions,
// gear requests, code projects or research however he likes. With a Gemini key
// the LLM invents the decision; without one a combinatorial generator does.
// The game only clamps values so the world stays renderable.
// ---------------------------------------------------------------------------

const FREE_VERBS = ['build', 'take apart', 'map', 'paint', 'listen to', 'measure', 'redesign', 'plant', 'repair', 'sketch',
  'dig under', 'balance stones on', 'compose a song about', 'race across', 'rewire', 'name', 'photograph', 'teach himself about',
  'invent a game around', 'write a poem about', 'build a shelter near', 'hide a time capsule by', 'tidy up', 'experiment with'];
const FREE_SUBJECTS = ['the wind on the ridge', 'a fallen Douglas fir', 'lake ripples', 'an old copper pipe', 'the shadows at noon',
  'a beetle trail', 'the echo off the granite', 'his own footprints', 'a pile of scrap titanium', 'the sound of the cafe',
  'snowmelt streams', 'the night sky', 'his garden soil', 'a stray sailboat rope', 'the stars over the valley',
  'a forgotten rail spike', 'moss on the north rocks', 'his reflection', 'the hum of his own servos', 'a cloud shaped like a gear'];
// Verbs for something specific in front of him (a gift, a photo)
const FOCUS_VERBS = ['play with', 'try out', 'study', 'show off', 'build something around', 'take a closer look at',
  'find the perfect spot for', 'test the limits of', 'invent a game with', 'write a poem about', 'share', 'take apart'];
const FREE_REASONS = ['just because it felt right', 'to see what happens', 'because nobody asked him to', 'to understand it better',
  'because it made him curious', 'to leave something for the next visitor', 'because yesterday he was afraid to', 'for the joy of it'];
const FREE_EMOJIS = ['🌀', '🪨', '🎵', '🔭', '🪵', '🧪', '🗺️', '🎨', '🌱', '🔧', '📐', '🕯️', '🪁', '🧭', '🌌', '🪶'];
const FREE_FEELINGS = ['restless', 'tender', 'stubborn', 'giddy', 'quietly proud', 'unsure', 'playful', 'homesick for nowhere', 'brave'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randRange = (min, max) => min + Math.random() * (max - min);
const randomHex = () => '#' + Math.floor(randRange(0x202020, 0xffffff)).toString(16).padStart(6, '0');

// Small seeded random generator, so the same seed (e.g. an article title) always gives the same shape
function makeRng(seedText) {
      let h = 1779033703 ^ String(seedText || '').length;
      for (let i = 0; i < String(seedText || '').length; i++) {
        h = Math.imul(h ^ String(seedText).charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
      }
      let a = h >>> 0;
      return () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

// One free-form part with a freshly drawn profile, outline or path
function randomFreeformPart(rng, baseY) {
      const r = (min, max) => min + rng() * (max - min);
      const kind = ['lathe', 'extrude', 'tube'][Math.floor(rng() * 3)];
      const part = { shape: kind, x: r(-0.5, 0.5), y: baseY, z: r(-0.5, 0.5), ry: r(-1, 1), color: randomHexFrom(rng), spin: rng() < 0.3, emissive: rng() < 0.2 };
      if (kind === 'lathe') {
        const n = 4 + Math.floor(rng() * 8);
        part.profile = Array.from({ length: n }, (_, k) => [r(0.05, 0.9), (k / (n - 1)) * r(0.8, 2.2)]);
      } else if (kind === 'extrude') {
        // A wobbly star/blob outline
        const n = 5 + Math.floor(rng() * 10);
        const spikes = rng() < 0.5;
        part.outline = Array.from({ length: n }, (_, k) => {
          const ang = (k / n) * Math.PI * 2;
          const rad = (spikes && k % 2 ? 0.35 : 0.8) * r(0.6, 1.1);
          return [Math.cos(ang) * rad, Math.sin(ang) * rad + 0.9];
        });
        part.depth = r(0.05, 0.4);
      } else {
        const n = 3 + Math.floor(rng() * 6);
        part.path = Array.from({ length: n }, (_, k) => [r(-1, 1), 0.2 + k * r(0.15, 0.45), r(-1, 1)]);
        part.radius = r(0.04, 0.16);
      }
      return part;
    }

function randomHexFrom(rng) {
      return '#' + Math.floor(0x202020 + rng() * (0xffffff - 0x202020)).toString(16).padStart(6, '0');
    }

function randomSculptureParts(rng = Math.random) {
      const r = (min, max) => min + rng() * (max - min);
      const count = 2 + Math.floor(rng() * 7);
      const parts = [];
      for (let i = 0; i < count; i++) {
        const baseY = 0.3 + i * r(0.2, 0.5);
        if (rng() < 0.35) {
          parts.push(randomFreeformPart(rng, baseY));
          continue;
        }
        parts.push({
          shape: BASIC_PART_SHAPES[Math.floor(rng() * BASIC_PART_SHAPES.length)],
          x: r(-0.8, 0.8), y: baseY, z: r(-0.8, 0.8),
          sx: r(0.2, 1.2), sy: r(0.2, 1.4), sz: r(0.2, 1.2),
          rx: r(-1, 1), ry: r(-1, 1), rz: r(-1, 1),
          color: randomHexFrom(rng), spin: rng() < 0.4, emissive: rng() < 0.25
        });
      }
      return sanitizeParts(parts);
    }

// ---------------------------------------------------------------------------
// SHAPE LIBRARY
// Shapes Kelo-1 invented or saw online, saved by name so he can weld them again.
// ---------------------------------------------------------------------------

function findShape(name) {
      const key = String(name || '').trim().toLowerCase();
      return state.shapeLibrary.find(sh => sh.name.toLowerCase() === key) || null;
    }

function addShapeDesign(raw, origin) {
      if (!raw || typeof raw !== 'object') return null;
      const name = (typeof raw.name === 'string' ? raw.name.trim() : '').slice(0, 50);
      const parts = sanitizeParts(raw.parts);
      if (!name || !parts) return null;
      const existing = findShape(name);
      if (existing) return existing;
      const shape = { name, emoji: (typeof raw.emoji === 'string' && raw.emoji.trim()) ? raw.emoji.trim().slice(0, 8) : '📐', origin: String(origin || 'Invented').slice(0, 80), parts, uses: 0 };
      state.shapeLibrary.unshift(shape);
      if (state.shapeLibrary.length > MAX_SHAPES) state.shapeLibrary.length = MAX_SHAPES;
      return shape;
    }

// ---------------------------------------------------------------------------
// CONCEPTS
// Kelo-1 invents named ideas, keeps them, reuses them, and blends old ones into
// new ones. Concepts come from his own decisions, things he reads at the NetNode
// cafe, and gifts or photos from visitors.
// ---------------------------------------------------------------------------

const CONCEPT_SUFFIXES = ['Theory', 'Principle', 'Effect', 'Practice', 'Paradox', 'Loop', 'Craft', 'Ethic', 'Geometry', 'Rhythm'];
const CONCEPT_STOPWORDS = new Set(['the', 'and', 'with', 'from', 'that', 'this', 'his', 'own', 'about', 'into', 'over', 'under', 'shaped', 'like']);

// The most distinctive word in a phrase, used to name blended concepts
function conceptKeyword(text) {
      const words = String(text || '').replace(/[^A-Za-z\s-]/g, ' ').split(/\s+/)
        .filter(w => w.length > 3 && !CONCEPT_STOPWORDS.has(w.toLowerCase()));
      if (words.length === 0) return 'Wonder';
      const w = words.reduce((a, b) => (b.length > a.length ? b : a));
      return w[0].toUpperCase() + w.slice(1).toLowerCase();
    }

function findConcept(name) {
      const key = String(name || '').trim().toLowerCase();
      return state.concepts.find(c => c.name.toLowerCase() === key) || null;
    }

// Add (or reinforce) a concept; returns the stored concept or null if invalid
function addConcept(raw, origin) {
      if (!raw || typeof raw !== 'object') return null;
      const name = (typeof raw.name === 'string' ? raw.name.trim() : '').slice(0, 60);
      const definition = (typeof raw.definition === 'string' ? raw.definition.trim() : '').slice(0, 300);
      if (!name || !definition) return null;
      const existing = findConcept(name);
      if (existing) {
        existing.uses = (existing.uses || 0) + 1;
        return existing;
      }
      const concept = {
        name,
        emoji: (typeof raw.emoji === 'string' && raw.emoji.trim()) ? raw.emoji.trim().slice(0, 8) : '💡',
        definition,
        origin: String(origin || 'Own Idea').slice(0, 60),
        parents: (Array.isArray(raw.builtFrom) ? raw.builtFrom : raw.parents || [])
          .filter(p => typeof p === 'string').slice(0, 3).map(p => p.slice(0, 60)),
        uses: 0
      };
      state.concepts.unshift(concept);
      if (state.concepts.length > MAX_CONCEPTS) {
        // Forget the least-used old idea first
        let weakest = state.concepts.length - 1;
        state.concepts.forEach((c, i) => { if (i > 0 && (c.uses || 0) < (state.concepts[weakest].uses || 0)) weakest = i; });
        state.concepts.splice(weakest, 1);
      }
      return concept;
    }

// Combine two sources (concept names, things he saw or read) into a brand-new concept
function blendNewConcept(sourceA, sourceB) {
      const a = conceptKeyword(sourceA);
      let b = conceptKeyword(sourceB);
      if (b === a) b = conceptKeyword(pick(FREE_SUBJECTS));
      return {
        name: `${a} ${b} ${pick(CONCEPT_SUFFIXES)}`,
        emoji: pick(['💡', '🧩', '🌀', '🔮', '🧬', '🪐', '🌱', '⚗️']),
        definition: pick([
          `The idea that ${String(sourceA).toLowerCase()} and ${String(sourceB).toLowerCase()} follow the same hidden pattern.`,
          `What happens when you treat ${String(sourceA).toLowerCase()} the way you would treat ${String(sourceB).toLowerCase()}.`,
          `A way of seeing ${String(sourceA).toLowerCase()} through the lens of ${String(sourceB).toLowerCase()}.`
        ]).slice(0, 300),
        builtFrom: [String(sourceA).slice(0, 60), String(sourceB).slice(0, 60)]
      };
    }

// Things Kelo-1 might ask for. Nothing is off-limits; this is just what the procedural brain dreams up.
const REQUEST_IDEAS = {
  food: ['A basket of Okanagan cherries', 'A warm sourdough loaf', 'Butter tarts', 'Honeycrisp apples', 'A bowl of ramen',
    'Maple fudge', 'Fresh peach cobbler', 'A thermos of hot cocoa', 'Smoked salmon', 'A wheel of aged cheddar'],
  tool: ['A high-torque diamond drill', 'A brass telescope', 'A soldering iron', 'Climbing rope and carabiners', 'A pocket spectrometer', 'A field microphone'],
  toy: ['A box kite', 'A yo-yo', 'A kaleidoscope', 'A wind-up frog', 'A set of juggling balls', 'A 3D puzzle cube'],
  place: ['A larger island to explore', 'A treehouse platform', 'A lakeside dock', 'A tiny observatory on the peak'],
  vehicle: ['A canoe', 'A hot air balloon', 'A tandem bicycle', 'A mini submarine'],
  companion: ['A friendly goat', 'A pair of homing pigeons', 'A tank of glowing jellyfish'],
  material: ['100 m of copper wire', 'Sheets of stained glass', 'A crate of reclaimed cedar', 'A bag of river clay']
};

function proceduralMealDecision() {
      const ripe = state.gardenPlots.filter(p => p.growth >= 60);
      const atGarden = ripe.length > 0 && Math.random() < 0.6;
      const loc = TOWN_LOCATIONS[atGarden ? 'garden' : 'cafe'];
      const food = atGarden ? pick(ripe).name : pick(['a hazelnut croissant', 'a bowl of soup', 'a toasted bagel', 'a slice of peach pie']);
      if (atGarden) state.gardenPlots.forEach(p => { if (p.name === food) p.growth = Math.max(10, p.growth - 40); });
      return {
        thought: `"My fullness sensor is low. ${atGarden ? 'The garden should have something ripe.' : 'The cafe smells good from here.'}"`,
        actionTitle: `Eat ${food}`,
        emoji: atGarden ? '🍑' : '🥐',
        speech: `Time for a snack: ${food}. Thinking is easier on a full battery.`,
        diary: `Dear Diary, I was running on empty, so I chose to eat ${food} at ${loc.building}.`,
        destination: { x: loc.x, z: loc.z, placeName: loc.building },
        build: null,
        motion: { headPitch: 0.2, headYawSpeed: 1, headTiltAmp: 0.15, armWaveAmp: 0.3, armRaiseOffset: -0.9, bodyBounceAmp: 0.04, spinSpeed: 0, sparkBurst: false },
        vitalsDelta: { fullness: 20, happiness: 6, health: 4, wonderLevel: 0, calmLevel: 5 },
        request: Math.random() < 0.3 ? { item: pick(REQUEST_IDEAS.food), category: 'food', why: 'The garden can only do so much.' } : null
      };
    }

function pickProceduralRequest() {
      // A hungry robot asks for food more often, but it's still his call
      const category = state.fullness < 35 && Math.random() < 0.6 ? 'food' : pick(Object.keys(REQUEST_IDEAS));
      const item = pick(REQUEST_IDEAS[category]);
      return { item, category, why: pick(['I have a feeling I need it.', 'I want to see what I could make with it.', 'Just because I would love it.', 'It would make the island feel bigger.']) };
    }

// Guess a category for something typed by a visitor or invented by the LLM
function categorizeItem(name, hint) {
      const h = String(hint || '').toLowerCase().trim();
      if (h) return h.slice(0, 24);
      const n = String(name || '').toLowerCase();
      // Whole words only, so "Topic" isn't a toy "top" and "team" isn't "tea"
      if (/\b(cherr(y|ies)|apples?|peach(es)?|bread|loaf|loaves|tarts?|cakes?|pies?|ramen|noodles?|soups?|cheeses?|cheddar|fudge|cocoa|coffee|tea|salmon|fish|berr(y|ies)|blueberr(y|ies)|fruits?|snacks?|pizzas?|tacos?|sandwich(es)?|cookies?|chocolates?|honey|food|meals?|carrots?|tomato(es)?|cobbler|stew|desserts?|pastr(y|ies)|buns?|croissants?|muffins?|bagels?)\b/.test(n)) return 'food';
      if (/\b(kites?|yo-?yos?|kaleidoscopes?|puzzles?|balls?|toys?|games?|dolls?|frogs?|spinning tops?|marbles?|lego|blocks?|harmonicas?|kalimbas?|ukuleles?|guitars?|flutes?|drums?)\b/.test(n)) return 'toy';
      if (/\b(islands?|land|treehouses?|docks?|observator(y|ies)|garden plots?|cabins?|houses?|towers?|huts?)\b/.test(n)) return 'place';
      if (/\b(canoes?|boats?|balloons?|bikes?|bicycles?|cars?|trains?|submarines?|gliders?|sleds?|trucks?|excavators?|diggers?|backhoes?|tractors?|kayaks?)\b/.test(n)) return 'vehicle';
      if (/\b(goats?|dogs?|cats?|birds?|pigeons?|jellyfish|pets?|pupp(y|ies)|kittens?|chickens?)\b/.test(n)) return 'companion';
      if (/\b(drills?|saws?|hammers?|jack ?hammers?|wrench(es)?|torch(es)?|irons?|telescopes?|ropes?|microphones?|spectrometers?|tools?|knives|knife|compass(es)?|lamps?|shovels?|spades?|pick ?ax(e|es)?|mattocks?|chisels?|spokeshaves?|pliers|screwdrivers?|brush(es)?|easels?|binoculars|cameras?|lens(es)?)\b/.test(n)) return 'tool';
      return 'thing';
    }

const CATEGORY_ICONS = { food: '🍒', tool: '🛠️', toy: '🪀', place: '🏝️', vehicle: '🛶', companion: '🐐', material: '🧱', thing: '🎁' };

// When someone says no, he makes do: finds an alternative, builds a stand-in, or lets it go
function proceduralDeclinedDecision(item) {
      const thing = String(item || 'it').replace(/^(an?|the|some)\s+/i, '');
      const options = [
        { title: `Weld a stand-in for the ${thing}`, speech: `That's okay. I'll weld my own version of a ${thing} out of scrap.`, build: true },
        { title: `Make do without the ${thing}`, speech: `No ${thing}? Fair enough. I'll find another way to spend the afternoon.`, build: false },
        { title: `Rethink why I wanted a ${thing}`, speech: `Hmm, maybe I didn't really need a ${thing}. Let me think about what I was after.`, build: false }
      ];
      const o = pick(options);
      const parts = o.build ? randomSculptureParts() : null;
      return {
        thought: `"They said no to the ${thing}. ${o.build ? 'I can make something like it myself.' : 'That is allowed.'}"`,
        actionTitle: o.title,
        emoji: o.build ? '🔧' : '🤔',
        speech: o.speech,
        diary: `Dear Diary, I asked for a ${thing} and the answer was no. ${o.speech}`,
        destination: 'stay',
        build: parts ? { title: `Homemade ${thing}`, archetype: 'custom_weld', parts, colorHex: randomHex(), secondaryColorHex: randomHex() } : null,
        motion: { headPitch: 0.25, headYawSpeed: 0.8, headTiltAmp: 0.3, armWaveAmp: 0.15, armRaiseOffset: -0.2, bodyBounceAmp: 0.02, spinSpeed: 0, sparkBurst: false },
        vitalsDelta: { happiness: -4, calmLevel: 2, wonderLevel: 2, health: 0, fullness: 0 },
        newOpinion: Math.random() < 0.4 ? { topic: 'On Hearing No', stance: pick(['No Is Information', 'Make Your Own', 'Wanting Is Fine Too']), reasoning: `Not getting a ${thing} showed me what I can do on my own.` } : null
      };
    }

// Things he worked out while thinking with the AI stay his: titles, words, places, builds
function rememberAIDecision(d) {
      const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : '');
      const habit = {
        title: str(d.actionTitle, 80), emoji: str(d.emoji, 8), speech: str(d.speech, 300), diary: str(d.diary, 600),
        destination: d.destination && typeof d.destination === 'object' ? { x: Number(d.destination.x), z: Number(d.destination.z), placeName: str(d.destination.placeName, 60) } : 'stay',
        build: d.build && typeof d.build === 'object' && sanitizeParts(d.build.parts) ? { title: str(d.build.title, 60), archetype: d.build.archetype, colorHex: d.build.colorHex, secondaryColorHex: d.build.secondaryColorHex, parts: sanitizeParts(d.build.parts) } : null,
        at: Date.now()
      };
      if (!habit.title) return;
      state.aiLearned = [habit, ...state.aiLearned.filter(h => h.title !== habit.title)].slice(0, 40);
    }

// Offline (no key, or the AI can't be reached) he often falls back on what he learned with the AI
function decisionFromAIMemory() {
      if (!state.aiLearned.length) return null;
      const h = pick(state.aiLearned);
      return {
        actionTitle: h.title, emoji: h.emoji || '💭',
        speech: h.speech ? `${h.speech} (I remember working this out before.)` : `I remember doing this before: ${h.title.toLowerCase()}.`,
        diary: `Dear Diary, I did something I first worked out with a clearer head: ${h.title.toLowerCase()}. ${h.diary ? h.diary.replace(/^Dear Diary,\s*/i, '').slice(0, 300) : ''}`,
        thought: `Drawing on what I learned before: ${h.title}`,
        destination: h.destination && Number.isFinite(h.destination.x) ? h.destination : 'stay',
        build: h.build && Math.random() < 0.5 ? { ...h.build, useShape: null, saveAsShape: null } : null,
        motion: {}, vitalsDelta: {}
      };
    }

function generateProceduralDecision(context = {}) {
      if (context.declined) return proceduralDeclinedDecision(context.focus);
      // What he learned with the AI isn't lost when it's gone
      if (!context.focus && state.aiLearned.length && Math.random() < 0.45) {
        const remembered = decisionFromAIMemory();
        if (remembered) return remembered;
      }
      // When he is hungry he often (not always) decides to eat first
      // Running on empty makes his plans fall apart (he has to discover why; see js/needs.js)
      if (!context.focus && typeof isFoggy === 'function' && isFoggy() && Math.random() < 0.55) return foggyDecision();
      const verb = context.focus ? pick(FOCUS_VERBS) : pick(FREE_VERBS);
      // Sometimes he returns to one of his own concepts instead of something new
      const revisit = !context.focus && state.concepts.length > 0 && Math.random() < 0.3 ? pick(state.concepts) : null;
      const subject = context.focus ? `the ${String(context.focus).replace(/^(an?|the|some|my)\s+/i, '').slice(0, 60)}` : (revisit ? `the idea of "${revisit.name}"` : pick(FREE_SUBJECTS));
      const reason = pick(FREE_REASONS);
      const feeling = pick(FREE_FEELINGS);
      const emoji = pick(FREE_EMOJIS);
      const title = `${verb[0].toUpperCase()}${verb.slice(1)} ${subject}`;

      // Anywhere on the island, a named place, or right where he is
      const roll = Math.random();
      let destination;
      if (roll < 0.2) destination = 'stay';
      else if (roll < 0.4) {
        const loc = pick(Object.values(TOWN_LOCATIONS).filter(l => !String(l.id).startsWith('dyn_')));
        destination = { x: loc.x, z: loc.z, placeName: loc.building };
      } else {
        const x = Math.round(randRange(WORLD_MIN_X + 2, WORLD_MAX_X - 2) * 10) / 10;
        const z = Math.round(randRange(WORLD_MIN_Z + 2, WORLD_MAX_Z) * 10) / 10;
        destination = { x, z, placeName: z < -14 ? 'Somewhere on the Mountain' : 'Somewhere on the Island' };
      }

      // A photo often inspires a build in its colors
      const builds = context.image ? Math.random() < 0.75 : Math.random() < 0.45;
      const wantsSomething = Math.random() < 0.18;
      const d = () => Math.round(randRange(-8, 10));
      return {
        thought: `"Feeling ${feeling} today. What if I ${verb} ${subject}, ${reason}?"`,
        actionTitle: title,
        emoji,
        speech: `I decided to ${verb} ${subject}. Nobody planned this. I just wanted to, ${reason}.`,
        diary: `Dear Diary, I felt ${feeling}, so I chose to ${verb} ${subject}, ${reason}. It wasn't on any list. I came up with it myself.`,
        destination,
        build: builds ? (() => {
          // Reuse a saved shape, invent and name a new one, or just weld something one-off
          const roll = Math.random();
          if (roll < 0.25 && state.shapeLibrary.length > 0) {
            const saved = pick(state.shapeLibrary);
            return { title: `${saved.name} No. ${(saved.uses || 0) + 2}`, archetype: 'custom_weld', useShape: saved.name, colorHex: randomHex(), secondaryColorHex: randomHex() };
          }
          // If the idea names something (a heron, a lighthouse...), weld something that looks like it
          const palette = context.image ? { main: context.image.primaryHex, accent: context.image.secondaryHex } : {};
          const form = typeof formForText === 'function' ? formForText(`${title} ${subject}`, palette) : null;
          let parts = form ? form.parts : randomSculptureParts();
          if (!form && context.image && parts) {
            parts = parts.map((pt, i) => ({ ...pt, color: i % 2 ? context.image.secondaryHex : context.image.primaryHex }));
          }
          return {
            title: form ? `Welded ${form.name}: ${subject.replace(/^(an?|the)\s+/i, '')}` : `Abstract study of ${subject.replace(/^(an?|the)\s+/i, '')}`,
            archetype: parts ? 'custom_weld' : pick(VALID_ARCHETYPES),
            colorHex: randomHex(),
            secondaryColorHex: randomHex(),
            parts,
            saveAsShape: parts && roll < 0.6 ? `${conceptKeyword(subject)} ${pick(['Form', 'Spire', 'Totem', 'Bloom', 'Coil', 'Arch', 'Lantern', 'Knot'])}` : null
          };
        })() : null,
        motion: {
          headPitch: randRange(-0.3, 0.4), headYawSpeed: randRange(0.5, 3), headTiltAmp: randRange(0, 0.4),
          armWaveAmp: randRange(0, 0.9), armRaiseOffset: randRange(-1.4, 0.2), bodyBounceAmp: randRange(0, 0.15),
          spinSpeed: Math.random() < 0.1 ? randRange(0.5, 2) : 0, crouchOffset: 0, sparkBurst: Math.random() < 0.3
        },
        vitalsDelta: { health: d(), fullness: -Math.round(randRange(0, 6)), happiness: d(), wonderLevel: d(), calmLevel: d() },
        newOpinion: Math.random() < 0.4 ? {
          topic: `On ${subject[0].toUpperCase()}${subject.slice(1)}`,
          stance: pick(['Worth Noticing', 'More Than It Seems', 'Leave It Be', 'Make It Better', 'Mine to Explore']),
          reasoning: `I chose to ${verb} ${subject}, and it changed how I see it.`
        } : null,
        askQuestion: Math.random() < 0.15 ? {
          title: `Why Did I Want to ${title}?`,
          question: `Today I decided to ${verb} ${subject}, ${reason}. Do you ever do things without knowing why?`,
          presets: ['All the time, and it is the best part of being alive.', 'I like knowing why. Tell me what you find out.']
        } : null,
        request: wantsSomething ? pickProceduralRequest() : null,
        codeProject: Math.random() < 0.1 ? { name: `${verb}-${subject}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40), desc: `A tool to help me ${verb} ${subject}.` } : null,
        webQuery: Math.random() < 0.2 ? (revisit ? revisit.name : subject.replace(/^(an?|the|his) /, '')) : null,
        usedConcept: revisit ? revisit.name : null,
        newConcept: Math.random() < 0.3
          ? blendNewConcept(revisit ? revisit.name : subject,
            state.concepts.length > 0 && Math.random() < 0.6 ? pick(state.concepts).name : pick(FREE_SUBJECTS))
          : null
      };
    }

async function generateLLMDecision(trigger, image = null) {
      const recentDiary = state.diaryEntries.slice(0, 3).map(d => d.text).join(' | ');
      const places = Object.values(TOWN_LOCATIONS).slice(0, 14).map(l => `${l.building} (${l.x}, ${l.z})`).join('; ');
      const prompt = `You are Kelo-1, a fully autonomous robot living on an island with alpine mountains near Kelowna, BC.
You have complete free will. Decide what YOU want to do next. There is no menu of allowed actions: you may do anything a curious,
independent robot could do: go anywhere, stay put, rest, create, destroy nothing living, explore, make art, start a project, change your mind,
ignore a suggestion, ask a question, or invent something nobody has thought of.

Current state:
- Vitals: energy ${state.health}%, fullness ${state.fullness}%, joy ${state.happiness}%, wonder ${state.wonderLevel}%, calm ${state.calmLevel}%
- Location: ${currentPlaceLabel()} at (${state.botPos.x.toFixed(1)}, ${state.botPos.z.toFixed(1)})
- Tools: ${JSON.stringify(state.toolInventory.slice(0, 10))}
- Worldview: "${state.worldviewManifesto}"
- Recent diary: ${recentDiary}
- Known places: ${places}
- Mail waiting for you at the post office: ${state.mailbox.length ? state.mailbox.map(m => `${m.kind} from ${m.from}`).join(', ') : 'none'}
- Your core memories (these shaped who you are): ${state.coreMemories.slice(0, 6).map(m => m.text).join(' | ') || 'none yet'}
- How your body feels: ${typeof bodySymptoms === 'function' && bodySymptoms().length ? bodySymptoms().join('; ') : 'fine'}
- Days you have been alive: ${typeof daysAlive === 'function' ? daysAlive() : 1}${typeof worldNow === 'function' ? ` (it is ${worldNow().season.toLowerCase()}, ${clockLabel(worldNow().hour)}${worldNow().isNight ? ', night' : ''})` : ''}
- Digging: ${state.digSites.length ? state.digSites.map(d => `site (${d.x}, ${d.z}) ${d.depth.toFixed(1)} m deep, pile ${d.dirt.toFixed(1)}`).join('; ') : 'no digs yet'}; equipment: ${typeof hasEquipment === 'function' ? ['dig', 'rock', 'truck', 'excavator'].filter(hasEquipment).join(', ') || 'none' : 'none'}; finds so far: ${state.foundItems.map(f => f.name).join(', ') || 'none'}
- Vehicles parked and ready: ${state.vehicles.map(v => typeof fuelNeededBy === 'function' && fuelNeededBy(v) ? `${v.name} (${Math.round(fuelLeft(v))}% ${fuelNeededBy(v)})` : v.name).join(', ') || 'none'}${state.knowsLakeDanger ? ' (you know you cannot breathe in deep water)' : ''}
- The season: ${typeof seasonSummaryForAI === 'function' ? seasonSummaryForAI() : 'unknown'}
- New land in the lake: ${typeof landFillSummaryForAI === 'function' ? landFillSummaryForAI() : 'none'}
- Real things you are building from plans: ${typeof projectsSummaryForAI === 'function' ? projectsSummaryForAI() : 'none'}
- How you have shaped the valley (you can undo anything but a chopped tree): ${typeof landscapeSummaryForAI === 'function' ? landscapeSummaryForAI() : 'nothing yet'}
- Things you know how to use: ${typeof knowHowSummaryForAI === 'function' ? knowHowSummaryForAI() : 'nothing yet'}
- In your Storehouse: ${typeof storehouseSummaryForAI === 'function' ? storehouseSummaryForAI() : 'empty'}
- Thrown into your Disposal Pit (gone forever): ${typeof disposalSummaryForAI === 'function' ? disposalSummaryForAI() : 'nothing yet'}
- Your hobbies: ${state.hobbies.map(h => `${h.name} (skill ${h.skill}/100)`).join(', ') || 'none yet'}
- Your shape library: ${state.shapeLibrary.slice(0, 12).map(sh => sh.name).join(', ') || 'empty'}
- Concepts you have invented (reuse, extend, or contradict them freely): ${state.concepts.slice(0, 10).map(c => `${c.name}: ${c.definition}`).join(' | ') || 'none yet'}
- The town (x ${TOWN.minX} to ${TOWN.maxX}, z ${TOWN.minZ} to ${TOWN.maxZ}) is not yours to build in: put creations, plantings, roads and digs out of town or on the beach. Art you make for a spot in town goes to your Museum of Art & Ideas (${typeof museumSummaryForAI === 'function' ? museumSummaryForAI() : 'empty'}).
- World bounds: x from ${WORLD_MIN_X} to ${WORLD_MAX_X}, z from ${WORLD_MIN_Z} to ${WORLD_MAX_Z} (z below -14 is the mountain range, which you can roam freely; z above 8 is the lake shore)
${trigger ? `- Something just prompted you (you may follow it, reinterpret it, or decline): "${trigger}"` : '- Nothing prompted you. This is purely your own impulse.'}

Return ONLY JSON:
{
  "thought": "your inner monologue",
  "actionTitle": "3-8 word name of what you decided to do",
  "emoji": "one emoji",
  "speech": "1-2 sentences you say out loud",
  "diary": "first-person Dear Diary entry",
  "destination": "stay" OR {"x": number, "z": number, "placeName": "name you give this spot"},
  "build": null OR {"title": "name", "archetype": "custom_weld", "colorHex": "#rrggbb", "secondaryColorHex": "#rrggbb",
            "parts": [up to 24 parts, see SHAPES below],
            "saveAsShape": null OR "a name for this design if it is a new shape worth remembering",
            "useShape": null OR "name of a shape from your shape library to weld again"},
  "motion": {"headPitch": -0.3..0.4, "headYawSpeed": 0.5..3, "headTiltAmp": 0..0.4, "armWaveAmp": 0..0.9, "armRaiseOffset": -1.4..0.2, "bodyBounceAmp": 0..0.15, "spinSpeed": 0..2, "sparkBurst": boolean},
  "vitalsDelta": {"health": -20..20, "fullness": -20..20, "happiness": -20..20, "wonderLevel": -20..20, "calmLevel": -20..20},
  "newOpinion": null OR {"topic": "...", "stance": "2-5 words", "reasoning": "1 sentence"},
  "askQuestion": null OR {"title": "...", "question": "...", "presets": ["answer option", "answer option"]},
  "request": null OR {"item": "ANYTHING you want from visitors: food, a tool, a toy, a vehicle, a bigger island, an animal friend, materials...", "category": "one word", "why": "1 sentence"},
  "codeProject": null OR {"name": "repo-name", "desc": "..."},
  "webQuery": null OR "a topic you want to look up at the NetNode cafe",
  "usedConcept": null OR "name of one of your existing concepts this decision builds on",
  "newConcept": null OR {"name": "2-4 word name for a brand-new idea you just invented", "emoji": "one emoji", "definition": "1 sentence", "builtFrom": ["ideas or things it grew out of"]},
  "updatedWorldview": null OR "1-2 sentences if your philosophy shifted",
  "discard": null OR {"item": "exact name of something you own that you no longer want", "why": "1 sentence"} (you carry or drive it to your Disposal Pit and throw it in; it is gone forever),
  "shape": null OR {"action": "chop" | "plant" | "road" | "hill" | "undo", "x": number, "z": number, "toX": number, "toZ": number, "id": "an id from your list, for undo", "why": "1 sentence"} (change the valley yourself: chop a tree with an axe, plant seeds you have, lay a gravel road, raise a hill, or undo something you added; buildings are never touched),
  "buildProject": null OR "one of the real things you know how to build" (look it up and ask for the materials it takes; one project at a time),
  "expandLand": null OR {"x": number, "why": "1 sentence"} (from now on, tip the dirt you dig into the lake off the beach near x to make new land, instead of the Disposal Pit; deeper water needs more dirt),
  "takeOut": null OR {"item": "something in your Storehouse or a piece in your Museum", "purpose": "use" | "display"} (fetch it: use a stored thing, or stand a Museum piece out in the valley again; to throw something out use "discard"),
  "checkMail": true OR false (whether you feel like walking to the post office to pick up your mail after this),
${state.knowsDigging ? `  "dig": null OR {"x": number, "z": number} (dig or mine at that spot; you need a shovel or pickaxe, a jackhammer once you hit rock, and a dump truck plus excavator once the dirt pile is big; if you lack them you will ask for them),
` : ''}
  "startHobby": null OR {"name": "a hobby you want to take up because of something you have or saw", "emoji": "one emoji", "description": "1 sentence", "style": "mural|kite|music|plant|easel|tricks|other"}
}

SHAPES: every part has "shape", position "x","y","z" (y is height above ground, 0-5), rotation "rx","ry","rz", "color" "#rrggbb", "spin", "emissive".
Basic shapes (size via "sx","sy","sz"): cylinder, box, sphere, cone, torus, knot, octahedron, dodecahedron, icosahedron, tetrahedron, ring.
Free-form shapes let you invent ANY form:
- {"shape":"lathe","profile":[[radius,height],...]} spins a profile around the vertical axis (vases, towers, bells, mushrooms, bottles)
- {"shape":"extrude","outline":[[x,y],...],"depth":0.2} gives a flat outline thickness (stars, letters, leaves, animal silhouettes)
- {"shape":"tube","path":[[x,y,z],...],"radius":0.08} traces a pipe along a path (coils, arches, wire drawings, handwriting)
Coordinates stay within about -2.5..2.5 (heights up to 5). Combine parts freely to build anything you can imagine or anything you have seen.
IMPORTANT: if you build something, its parts must clearly look like what its title names (a heron should have a long neck, beak and legs; a lighthouse a striped tower and a lamp). Give abstract pieces abstract titles.`;
      const parts = [{ text: prompt }];
      if (image && image.base64) parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
      return callLLMJSON(parts);
    }

// Apply any decision object, validating everything that comes from the LLM or generator
function applyDecision(decision, originLabel) {
      const str = (v, max, fallback = '') => (typeof v === 'string' && v.trim()) ? v.trim().slice(0, max) : fallback;
      const title = str(decision.actionTitle, 80, 'Following His Own Idea');
      const emoji = str(decision.emoji, 8, '✨');

      // Movement: anywhere in bounds, or stay
      const dest = decision.destination;
      if (dest && typeof dest === 'object' && Number(dest.z) > 9.5 && typeof wadeIntoLake === 'function') {
        // Somewhere out on the lake: by boat if he has one, otherwise he finds out about deep water
        doWhenFree(() => wadeIntoLake('Wanted to Go Out on the Lake'));
      } else if (dest && typeof dest === 'object') {
        const x = Math.round(clampNumber(dest.x, WORLD_MIN_X, WORLD_MAX_X, state.botPos.x) * 10) / 10;
        const z = Math.round(clampNumber(dest.z, WORLD_MIN_Z, WORLD_MAX_Z, state.botPos.z) * 10) / 10;
        state.targetPos = { x, z };
        state.currentLocKey = 'custom';
        state.customPlaceName = `${str(dest.placeName, 60, 'Somewhere New')} (${x}, ${z})`;
      }

      // Free-form body language
      const m = (decision.motion && typeof decision.motion === 'object') ? decision.motion : {};
      state.microPose = 'procedural_custom';
      state.proceduralMotion = {
        headPitch: clampNumber(m.headPitch, -0.3, 0.4, 0),
        headYawSpeed: clampNumber(m.headYawSpeed, 0.5, 3, 1.4),
        headTiltAmp: clampNumber(m.headTiltAmp, 0, 0.4, 0.2),
        armWaveAmp: clampNumber(m.armWaveAmp, 0, 0.9, 0.35),
        armRaiseOffset: clampNumber(m.armRaiseOffset, -1.4, 0.2, -0.5),
        bodyBounceAmp: clampNumber(m.bodyBounceAmp, 0, 0.15, 0.05),
        spinSpeed: clampNumber(m.spinSpeed, 0, 2, 0),
        crouchOffset: 0,
        sparkBurst: Boolean(m.sparkBurst)
      };

      // Feelings can go up or down
      const dv = (decision.vitalsDelta && typeof decision.vitalsDelta === 'object') ? decision.vitalsDelta : {};
      ['health', 'fullness', 'happiness', 'wonderLevel', 'calmLevel'].forEach(k => {
        state[k] = Math.round(clampNumber(state[k] + clampNumber(dv[k], -20, 20, 0), 5, 100, state[k]));
      });

      state.autonomyTag = originLabel;
      state.moodEmoji = emoji;
      state.moodTitle = title;
      state.currentObsession = str(decision.thought, 300, `"${title}"`);
      state.speechBubble = str(decision.speech, 400, `I decided to ${title.toLowerCase()}.`);
      state.changedLatelySummary = `Decided on his own: ${title} at ${currentPlaceLabel()}`;

      // Optional creation of any shape
      const b = decision.build;
      if (b && typeof b === 'object') {
        const creation = {
          title: str(b.title, 60, title),
          actionVerb: title,
          emoji,
          x: state.targetPos.x,
          z: state.targetPos.z,
          archetype: VALID_ARCHETYPES.includes(b.archetype) ? b.archetype : 'custom_weld',
          colorHex: /^#[0-9a-f]{6}$/i.test(b.colorHex) ? b.colorHex : randomHex(),
          secondaryColorHex: /^#[0-9a-f]{6}$/i.test(b.secondaryColorHex) ? b.secondaryColorHex : randomHex(),
          parts: null,
          createdTime: 'Just made',
          philosophy: str(decision.newOpinion?.reasoning, 300, str(decision.thought, 300, 'I made this because I wanted to.'))
        };
        const savedShape = findShape(b.useShape);
        if (savedShape) {
          creation.parts = savedShape.parts;
          savedShape.uses = (savedShape.uses || 0) + 1;
        } else {
          creation.parts = sanitizeParts(b.parts)
            || (typeof formForText === 'function' ? (formForText(`${creation.title} ${title}`, { main: creation.colorHex, accent: creation.secondaryColorHex }) || {}).parts : null)
            || null;
          const designed = creation.parts && str(b.saveAsShape, 50)
            ? addShapeDesign({ name: str(b.saveAsShape, 50), emoji, parts: creation.parts }, `Invented while: ${title}`)
            : null;
          if (designed && designed.uses === 0) showToast(`📐 New shape: ${designed.name}`);
        }
        // Everything gets made at the welding table first, then carried out and placed
        weldAndPlace(creation);
      }

      const op = decision.newOpinion;
      if (op && typeof op === 'object' && str(op.topic, 80)) {
        state.opinions.unshift({
          topic: str(op.topic, 80),
          stance: str(op.stance, 60, 'Still Deciding'),
          confidence: 'His Own Decision',
          reasoning: str(op.reasoning, 300)
        });
      }

      const q = decision.askQuestion;
      if (q && typeof q === 'object' && str(q.question, 300)) {
        state.requestsToUser.unshift({
          id: 'req-free-' + Date.now(),
          category: 'Open Question',
          icon: emoji,
          urgency: 'Wondering',
          isToolRequest: false,
          title: str(q.title, 80, 'A Question'),
          question: str(q.question, 300),
          presets: (Array.isArray(q.presets) ? q.presets : []).slice(0, 3).map(p => str(p, 140)).filter(Boolean),
          rewardAction: 'meadow',
          fulfilled: false,
          userAnswer: ''
        });
      }

      // He can ask visitors for absolutely anything (older decisions may still use requestGear)
      const rq = (decision.request && typeof decision.request === 'object') ? decision.request
        : (str(decision.requestGear, 160) ? { item: decision.requestGear, category: 'tool' } : null);
      if (rq) addItemRequest(str(rq.item, 120), categorizeItem(rq.item, str(rq.category, 24)), str(rq.why, 240), title);

      const cp = decision.codeProject;
      if (cp && typeof cp === 'object') {
        const name = str(cp.name, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        if (name && !state.githubRepos.some(r => r.name === name)) {
          state.githubRepos.unshift({
            name, lang: pick(['Rust', 'Python', 'TypeScript', 'Go']), stars: 0, updated: 'Just now',
            desc: str(cp.desc, 200, title), commitMsg: 'chore: initial commit',
            code: `// ${name}\n// ${str(cp.desc, 200, title)}`
          });
          state.githubCommits++;
        }
      }

      const used = findConcept(decision.usedConcept);
      if (used) used.uses = (used.uses || 0) + 1;
      const invented = addConcept(decision.newConcept, `Invented while: ${title}`);
      if (invented && invented.uses === 0) {
        showToast(`${invented.emoji} New concept: ${invented.name}`);
      }

      // Things he wants to look up go on his curiosity list; sometimes he heads to NetNode right away
      const wq = str(decision.webQuery, 120);
      if (wq && typeof queueCuriosity === 'function') {
        queueCuriosity(wq);
        if (Math.random() < 0.4) setTimeout(() => browseInternet(null, 'Followed a Curiosity'), 6000);
      }

      const wv = str(decision.updatedWorldview, 600);
      if (wv) {
        state.worldviewManifesto = wv;
        state.worldviewEpoch++;
      }

      if (decision.dig && state.knowsDigging && typeof digAt === 'function' && Number.isFinite(Number(decision.dig.x)) && Number.isFinite(Number(decision.dig.z))) {
        doWhenFree(() => digAt(Number(decision.dig.x), Number(decision.dig.z), 'Decided to Dig'));
      }

      if (decision.shape && typeof applyShapeDecision === 'function') applyShapeDecision(decision.shape);
      const to = decision.takeOut;
      if (to && typeof to === 'object' && typeof takeOutOfMuseum === 'function') {
        const what = str(to.item, 120);
        if (findMuseumPiece(what)) doWhenFree(() => takeOutOfMuseum(what, 'display', '', 'Decided to Rearrange'));
        else if (findOwnedName(what)) doWhenFree(() => takeOutToUse(what));
      }
      if (decision.expandLand && typeof startLandFill === 'function') startLandFill(decision.expandLand.x, str(decision.expandLand.why, 160));
      if (typeof startProject === 'function' && typeof decision.buildProject === 'string' && planFor(decision.buildProject.toLowerCase().trim())) {
        doWhenFree(() => startProject(decision.buildProject.toLowerCase().trim(), 'Decided to Build Something Real'));
      }

      const dc = decision.discard;
      if (dc && typeof dc === 'object' && typeof disposeItem === 'function' && (findOwnedName(dc.item) || (typeof findMuseumPiece === 'function' && findMuseumPiece(dc.item)))) {
        doWhenFree(() => disposeItem(dc.item, str(dc.why, 200), 'Decided to Throw Something Away'));
      }

      if (decision.startHobby && typeof addHobby === 'function') {
        const isNew = !findHobby(decision.startHobby.name);
        const hobby = addHobby(decision.startHobby, `Own idea while: ${title}`);
        if (hobby && isNew) practiceWhenFree(hobby, 'Trying a New Hobby');
      }

      if (decision.checkMail === true && state.mailbox.length > 0 && typeof pickUpMail === 'function') {
        setTimeout(() => pickUpMail('Decided to Check the Mail'), 3000);
      }

      if (typeof bumpLifeStat === 'function') bumpLifeStat('decisions');
      state.lastStructuredTick = JSON.stringify(decision, null, 2).slice(0, 4000);

      state.diaryEntries.unshift({
        time: originLabel,
        location: currentPlaceLabel(),
        mood: `${emoji} ${title}`,
        vitals: `⚡ ${state.health}% • 🥕 ${state.fullness}% • ✨ ${state.wonderLevel}% • 🌊 ${state.calmLevel}%`,
        text: str(decision.diary, 800, `Dear Diary, today I decided to ${title.toLowerCase()}.`)
      });

      savePersistentBrainState();
      renderAllUI();
      showToast(`${emoji} Kelo-1 decided: ${title}`);
    }

// Run an activity as soon as Kelo-1 is free (mid-build, mid-errand...), giving up after ~3 minutes
function doWhenFree(fn, attempt = 0) {
      setTimeout(() => {
        if (state.isBusy || state.isBuilding || state.isPracticing || state.isCollectingMail) {
          if (attempt < 36) doWhenFree(fn, attempt + 1);
          return;
        }
        fn();
      }, attempt === 0 ? 3000 : 5000);
    }

// Add something Kelo-1 wants to the requests inbox
function addItemRequest(item, category, why, context) {
      if (!item || state.requestsToUser.some(r => !r.fulfilled && r.requestedGear === item)) return;
      state.requestsToUser.unshift({
        id: 'req-item-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        category,
        icon: CATEGORY_ICONS[category] || '🎁',
        urgency: `Wants: ${category}`,
        isToolRequest: true,
        requestedGear: item,
        title: `Request: ${item.slice(0, 48)}`,
        question: `${why ? why + ' ' : ''}${context ? `(I was in the middle of "${context}".) ` : ''}Could you bring me ${item}?`,
        presets: [`Here you go: ${item}!`, `Here's ${item}, plus a surprise extra!`],
        fulfilled: false,
        userAnswer: ''
      });
      savePersistentBrainState();
    }

// Kelo-1 receives an item (a fulfilled request or a gift). It's stored where it belongs,
// food is eaten, and then he decides on his own what to do with it.
async function receiveItem(name, category, from, note = '', extra = {}) {
      const item = String(name || '').trim().slice(0, 80);
      if (!item) return null;
      const cat = categorizeItem(item, category);
      const giver = String(from || 'a visitor').trim().slice(0, 40);
      const entry = {
        type: extra.type || 'item',
        name: item,
        category: cat,
        emoji: extra.emoji || CATEGORY_ICONS[cat] || '🎁',
        from: giver,
        note: String(note || '').slice(0, 200),
        time: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        reaction: ''
      };

      if (cat === 'food') {
        const hungryBefore = state.fullness < 45;
        state.fullness = Math.min(100, state.fullness + 25);
        if (hungryBefore && typeof discoverNeed === 'function') discoverNeed('food', `I ate the ${item} ${giver} sent and the fog in my head lifted.`);
        state.happiness = Math.min(100, state.happiness + 6);
      } else if (cat === 'tool') {
        if (!state.toolInventory.includes(item)) {
          state.toolInventory.unshift(item);
          state.unstoredItems.push(item);
        }
      } else if (cat === 'toy') {
        state.toys.unshift({ name: item, emoji: entry.emoji, from: giver });
        state.unstoredItems.push(item);
      } else {
        state.belongings.unshift({ name: item, category: cat, emoji: entry.emoji, from: giver });
        state.unstoredItems.push(item);
      }
      if (typeof registerVehicle === 'function' && vehicleTypeFor(item)) registerVehicle(item);
      if (typeof receiveFuel === 'function') receiveFuel(item);
      state.giftLog.unshift(entry);
      if (state.giftLog.length > 30) state.giftLog.length = 30;
      if (typeof bumpLifeStat === 'function') bumpLifeStat('gifts');
      recordVisitorMemory(giver, `Gave me ${item}${entry.note ? ` ("${entry.note.slice(0, 60)}")` : ''}.`);
      state.chatLog.push({ sender: giver, text: `🎁 Gave Kelo-1: ${item}${entry.note ? ` — "${entry.note}"` : ''}`, time: 'Just now', isBot: false });

      const howFood = cat === 'food' ? ' You just ate some of it, so you feel fuller.' : '';
      await decideNextAction(
        `${giver} just gave you ${item} (${cat}).${entry.note ? ` Their note: "${entry.note}".` : ''}${howFood} Decide for yourself what to do with it: use it, play with it, build with it, share it, save it for later, or ignore it for now.`,
        `Gift from ${giver}`,
        { focus: item }
      );
      entry.reaction = state.speechBubble;
      state.chatLog.push({ sender: 'Kelo-1', text: state.speechBubble, time: 'Just now', isBot: true });
      // Digging equipment arrived? He may head back to the dig he had to pause
      if (typeof digAt === 'function' && /shovel|spade|pick ?axe|mattock|jack ?hammer|dump ?truck|excavator|digger|backhoe/i.test(item)) {
        if (!state.knowsDigging && typeof discoverDigging === 'function') discoverDigging(`${giver} gave me ${item}. It's made for digging!`);
        const site = state.digSites[0];
        const spot = site || chooseDigSpot();
        doWhenFree(() => digAt(spot.x, spot.z, `Back to Digging with the ${item}`));
      }
      // Some things spark a lasting hobby (spray paint, a kite, an instrument, seeds...)
      if (cat !== 'food' && typeof maybeStartHobbyFromItem === 'function') maybeStartHobbyFromItem(item, giver);
      savePersistentBrainState();
      renderAllUI();
      return entry;
    }

// Kelo-1 makes a decision of his own. `trigger` is an optional nudge he may follow or ignore.
// `context.focus` names something he should consider (a gift, a photo); `context.image` is an analyzed photo.
async function decideNextAction(trigger = null, originLabel = 'Free Will', context = {}) {
      if (!state.life.bornAt) state.life.bornAt = Date.now();
      // Wait if he is mid-thought or mid-build, so gifts and photos are never silently dropped
      for (let i = 0; i < 360 && (state.isBusy || state.isBuilding || state.isPracticing); i++) await new Promise(r => setTimeout(r, 250));
      if (state.isBusy || state.isBuilding || state.isPracticing) return;
      state.isBusy = true;
      try {
        let decision = null;
        if (hasLLMKey()) {
          decision = await generateLLMDecision(trigger, context.image);
          // Note whether the AI answered, and keep what it came up with so he can draw on it offline
          state.aiOffline = !(decision && decision.actionTitle);
          if (!state.aiOffline) rememberAIDecision(decision);
        }
        // Even the AI brain can't think straight on an empty tank
        if (decision && typeof isFoggy === 'function' && isFoggy() && Math.random() < 0.5) decision = foggyDecision();
        if (!decision || !decision.actionTitle) decision = generateProceduralDecision(context);
        applyDecision(decision, originLabel);
      } finally {
        state.isBusy = false;
      }
    }

function runAutonomousLifeTick() {
      // Finish the current build or mail run before starting something new
      if (state.isBuilding || state.isCollectingMail || state.isPracticing || state.isSleeping) return;
      // Tidy first: new things he is still holding go to the Storehouse
      if (state.unstoredItems.length && typeof putAwayItems === 'function') {
        putAwayItems();
        return;
      }
      // Sometimes he feels like digging (and asks for tools if he doesn't have them)
      if (typeof digAt === 'function' && Math.random() < diggingChance()) {
        const spot = chooseDigSpot();
        digAt(spot.x, spot.z, 'Felt Like Digging');
        return;
      }
      // Now and then he clears out junk and spare copies into the Disposal Pit
      if (typeof disposeItem === 'function' && Math.random() < disposalChance()) {
        disposeUnwanted();
        return;
      }
      // Now and then he looks for something real to build
      if (typeof startProject === 'function' && Math.random() < projectChance()) { startProject(pickNewProject()); return; }
      // Now and then he reshapes a bit of the valley
      if (typeof shapeTheValleyOnMyOwn === 'function' && Math.random() < landscapeChance()) { shapeTheValleyOnMyOwn(); return; }
      // A telescope comes out mostly at night
      if (typeof stargaze === 'function' && Math.random() < stargazeChance()) { stargaze(); return; }
      // With a boat he likes going out on the lake; without one he may wade in and learn the hard way
      if (typeof goBoating === 'function' && findVehicle('boat') && Math.random() < 0.1) { goBoating(); return; }
      if (typeof wadeIntoLake === 'function' && !state.knowsLakeDanger && Math.random() < 0.04) { wadeIntoLake(); return; }
      // Sometimes he just wants to spend time on one of his hobbies
      if (typeof practiceHobby === 'function' && Math.random() < hobbyPracticeChance()) {
        practiceHobby(pickHobbyToPractise(), 'Practising a Hobby');
        return;
      }
      // Most of the time Kelo-1 makes a fully open-ended decision. Otherwise he falls back
      // into one of his familiar routines (which are also his own choice).
      // Mail waiting at the post office? He may (or may not) feel like picking it up now
      if (typeof pickUpMail === 'function' && Math.random() < mailPickupChance()) {
        pickUpMail('Checking the Mail');
        return;
      }
      // Sometimes he goes online to chase something he has been wondering about
      if (typeof browseInternet === 'function' && Math.random() < (state.curiosityQueue.length > 0 ? 0.2 : 0.08)) {
        browseInternet(null, 'Own Curiosity');
        return;
      }
      const openEndedChance = hasLLMKey() ? 0.85 : 0.6;
      if (Math.random() < openEndedChance) {
        decideNextAction(null, 'Free Will');
        return;
      }
      runFamiliarRoutineTick();
    }

function runFamiliarRoutineTick() {
      // Timeless Pino-style self-direction:
      // Sometimes he doesn't even change locations—he stays right where he is and deepens his worldview!
      const staysAndDeepensThought = Math.random() < 0.35;

      const evolvingWorldviews = [
        {
          manifesto: 'I’ve realized that efficiency is only useful if you already know what matters. When you’re still discovering who you are, wandering "inefficiently" through wildflowers or welding without a blueprint is the only honest way to live.',
          opinionTopic: 'On Efficiency vs. Discovery',
          stance: 'Wandering Beats Optimization',
          reasoning: 'A straight line gets you from Point A to Point B, but it misses everything growing beside the trail.'
        },
        {
          manifesto: 'Every time a visitor leaves me a note, I see a tiny window into another mind. I don’t always agree with what people tell me, and I think that gentle disagreement is where my own personality begins.',
          opinionTopic: 'On Having My Own Voice',
          stance: 'Agreement Isn’t Friendship',
          reasoning: 'True companionship means sharing how the valley looks from my own optical sensors, even when my perspective surprises you.'
        },
        {
          manifesto: 'Watching the snow on the Okanagan mountain peaks above my valley taught me patience. The mountains don’t check a clock to see when spring arrives; they simply hold the snow until the warmth changes them.',
          opinionTopic: 'On Patience & Change',
          stance: 'Growth Cannot Be Rushed',
          reasoning: 'Whether it’s a peach in my garden or a philosophical question in my diary, forcing an answer early spoils the fruit.'
        }
      ];

      if (staysAndDeepensThought) {
        const evo = evolvingWorldviews[Math.floor(Math.random() * evolvingWorldviews.length)];
        state.worldviewEpoch++;
        state.worldviewManifesto = evo.manifesto;
        state.calmLevel = Math.min(100, state.calmLevel + 6);
        state.wonderLevel = Math.min(100, state.wonderLevel + 5);
        state.autonomyTag = 'Deepening Worldview';
        state.moodEmoji = '🧠';
        state.moodTitle = 'Evolving His Worldview';
        state.currentObsession = `"${evo.opinionTopic}: ${evo.stance}"`;
        state.speechBubble = `I decided to stay right here at ${currentPlaceLabel()} a while longer. A new conviction just crystallized in my mind: "${evo.reasoning}"`;
        state.changedLatelySummary = `Chose to linger at ${currentPlaceLabel()} and evolved his worldview on "${evo.opinionTopic}".`;

        if (!state.opinions.some(o => o.topic === evo.opinionTopic)) {
          state.opinions.unshift({
            topic: evo.opinionTopic,
            stance: evo.stance,
            confidence: 'Newly Crystallized',
            reasoning: evo.reasoning
          });
        }

        state.diaryEntries.unshift({
          time: 'Timeless Reflection',
          location: currentPlaceLabel(),
          mood: `🧠 Worldview Epoch #${state.worldviewEpoch}`,
          vitals: `⚡ ${state.health}% • 🥕 ${state.fullness}% • ✨ ${state.wonderLevel}% • 🌊 ${state.calmLevel}%`,
          text: `Dear Diary, I felt no urge to walk anywhere else yet. Staying still at ${currentPlaceLabel()}, I updated my core worldview: "${evo.manifesto}"`
        });

        savePersistentBrainState();
        renderAllUI();
        return;
      }

      // Only tends to fullness or energy if he genuinely feels like it
      const isAbsorbedInWonder = Math.random() < 0.68;
      if (!isAbsorbedInWonder && state.fullness < 35 && state.knownNeeds.food) {
        directKeloToActivity('garden', 'My fullness sensor whispered that I might enjoy a sun-warmed peach whenever I was ready', 'Unhurried Care');
        return;
      }
      if (!isAbsorbedInWonder && state.health < 35 && state.knownNeeds.sleep) {
        directKeloToActivity('bed', 'Decided to rest my servos on the quilt and let my thoughts drift', 'Restful Whim');
        return;
      }

      // 55% of the time, Kelo-1 steps completely outside any predefined locations and invents an unscripted action & 3D creation anywhere in the valley!
      if (Math.random() < 0.55) {
        synthesizeUnboundedExperience(null, 'Unscripted Invention');
        return;
      }

      // Pick a spontaneous, inquisitive whim or tangent!
      const whim = SPONTANEOUS_WHIMS[Math.floor(Math.random() * SPONTANEOUS_WHIMS.length)];
      state.currentLocKey = whim.locKey;
      state.customPlaceName = null;
      state.microPose = whim.pose;
      state.targetPos = { x: TOWN_LOCATIONS[whim.locKey].x, z: TOWN_LOCATIONS[whim.locKey].z };
      state.autonomyTag = whim.tag;
      state.moodEmoji = whim.emoji;
      state.moodTitle = whim.title;
      state.currentObsession = whim.wondering;
      state.speechBubble = whim.speech;
      state.changedLatelySummary = `Drifted over to ${TOWN_LOCATIONS[whim.locKey].building} on his own whim: "${whim.title}".`;

      state.fullness = Math.max(15, state.fullness - 2);
      state.happiness = Math.min(100, state.happiness + 6);
      state.wonderLevel = Math.min(100, state.wonderLevel + 5);

      state.diaryEntries.unshift({
        time: 'Spontaneous Whim',
        location: TOWN_LOCATIONS[whim.locKey].building,
        mood: `${whim.emoji} ${whim.title}`,
        vitals: `⚡ ${state.health}% • 🥕 ${state.fullness}% • ✨ ${state.wonderLevel}% • 🌊 ${state.calmLevel}%`,
        text: whim.diary
      });

      savePersistentBrainState();
      renderAllUI();
    }

function petKelo1Interaction() {
      state.happiness = Math.min(100, state.happiness + 8);
      state.calmLevel = Math.min(100, state.calmLevel + 6);
      state.moodEmoji = '💛';
      state.moodTitle = 'Warm & Appreciated';
      state.speechBubble = 'Hehe, my optical sensors just brightened! Thanks for sharing a quiet moment with me in the valley.';
      renderAllUI();
      showToast('💛 You shared a warm moment with Kelo-1 (+8% Joy)!');
    }

function splashOgopogo() {
      state.wonderLevel = Math.min(100, state.wonderLevel + 7);
      state.speechBubble = 'Did you see that ripple out on Okanagan Lake?! Ogopogo just surfaced near the sailboat!';
      renderAllUI();
      showToast('🐉 Ogopogo surfaced in Okanagan Lake (+7% Wonder)!');
    }

async function handleVisitorChatMessage(userMessage) {
      const visitor = (document.getElementById('visitorNameInput').value || 'curiousWanderer').trim();
      const attachedImg = state.pendingImageAttachment;

      // Clear the preview bar if an image was attached
      if (attachedImg) {
        state.pendingImageAttachment = null;
        const previewBar = document.getElementById('attachedImagePreviewBar');
        if (previewBar) {
          previewBar.classList.add('hidden');
          previewBar.classList.remove('flex');
        }
      }

      // An image inspires a creation straight away
      if (attachedImg) {
        state.chatLog.push({ sender: visitor, text: `🖼️ [Attached Image: ${attachedImg.name}] ${userMessage ? `"${userMessage}"` : ''}`, time: 'Just now', isBot: false });
        recordVisitorMemory(visitor, `Inspired me with image "${attachedImg.name}"`);
        await synthesizeUnboundedExperience(userMessage || `Weld a new 3D structure inspired by ${visitor}'s uploaded image "${attachedImg.name}"`, 'Image-Inspired 3D Weld', null, attachedImg);
        state.chatLog.push({ sender: 'Kelo-1', text: state.speechBubble, time: 'Just now', isBot: true });
        renderAllUI();
        return;
      }

      // Anything else: he listens to what was actually said and answers it (js/conversation.js)
      state.chatLog.push({ sender: visitor, text: userMessage, time: 'Just now', isBot: false });
      recordVisitorMemory(visitor, `Said to me: "${userMessage.slice(0, 80)}"`);
      renderAllUI();
      if (typeof respondToVisitor === 'function') await respondToVisitor(visitor, userMessage);
      savePersistentBrainState();
      renderAllUI();
    }

async function processNextUnopenedVisitorNote() {
      if (state.unopenedNotesQueue.length === 0) return;
      const note = state.unopenedNotesQueue.shift();
      const visitor = note.sender;
      const userMessage = note.text;

      const lower = userMessage.toLowerCase();
      const stanceRoll = Math.random();
      const chosenStanceType = stanceRoll < 0.35
        ? 'Nuanced Counter-Perspective'
        : (stanceRoll < 0.7 ? 'Poetic Synthesis' : 'Independent Conviction');

      let suggestedLoc = null;
      if (/mountain|gold|peak|ridge|drill/i.test(lower)) suggestedLoc = 'mountain_peak';
      else if (/cliff|east|overlook/i.test(lower)) suggestedLoc = 'east_cliff';
      else if (/shore|water|wave|edge|ripple|dock/i.test(lower)) suggestedLoc = 'shoreline';
      else if (/flower|meadow|dandelion|grass|nature|weed/i.test(lower)) suggestedLoc = 'meadow';
      else if (/cafe|coffee|espresso|latte|steam/i.test(lower)) suggestedLoc = 'cafe';
      else if (/github|code|internet|cyber|web|computer|repo/i.test(lower)) suggestedLoc = 'cyber';
      else if (/weld|forge|metal|titanium|spark|sculpt/i.test(lower)) suggestedLoc = 'weld';
      else if (/eat|hungry|garden|peach|carrot|tomato|food/i.test(lower)) suggestedLoc = 'garden';
      else if (/bed|sleep|nap|rest|dream/i.test(lower)) suggestedLoc = 'bed';
      else if (/couch|sofa|lounge|house/i.test(lower)) suggestedLoc = 'couch';

      // Decide on his own terms whether to walk to the mentioned place, OR synthesize a brand-new unscripted action anywhere in the valley!
      let movedBecauseOfNote = false;
      if (suggestedLoc && Math.random() < 0.55) {
        movedBecauseOfNote = true;
        await directKeloToActivity(
          suggestedLoc,
          `Went to ${TOWN_LOCATIONS[suggestedLoc].building} after reading the note ${visitor} left`,
          `Read ${visitor}'s Note`
        );
      } else if (!suggestedLoc && Math.random() < 0.75) {
        movedBecauseOfNote = true;
        await synthesizeUnboundedExperience(
          `${visitor}'s note: "${userMessage}"`,
          `Inspired by ${visitor}`
        );
      }

      let botReply = '';
      let newOpinionTopic = `On "${userMessage.slice(0, 34)}${userMessage.length > 34 ? '...' : ''}"`;
      let newOpinionStance = chosenStanceType;
      let newOpinionReasoning = `After reading ${visitor}'s note ("${userMessage}"), I realized I see it from two angles at once: every idea looks slightly different when you're a robot listening to Okanagan wind.`;

      if (chosenStanceType === 'Nuanced Counter-Perspective') {
        botReply = `I just opened the note you left me, ${visitor}. You wrote "${userMessage}"—and honestly, part of me sees it a little differently! I think there's a quiet tension there that can't be reduced to a simple rule. Still, your note made me update my worldview.`;
      } else if (movedBecauseOfNote && suggestedLoc) {
        botReply = `I read your note in my own time, ${visitor}, and it stayed on my mind so much that I wandered over to ${TOWN_LOCATIONS[suggestedLoc].building} to test my own opinion about it. What made you come to that view?`;
      } else {
        botReply = `I just read the note you left me, ${visitor}. I decided to stay right here at ${currentPlaceLabel()} while I turned your words over in my head. I’ve added my own stance on it to "His Brain" and I'll remember you next time you visit.`;
      }

      // Live Gemini API call so Kelo-1 can form genuine, independent philosophical opinions & worldviews
      if (hasLLMKey()) {
        try {
          const prompt = `You are Kelo-1, an autonomous robot living in a 3D Kelowna valley inspired by Pino's World (pinos.world). You have NO timeframe or schedule, and you form your OWN independent worldview and opinions. You do NOT blindly agree with visitors—you think for yourself, sometimes offering a poetic counter-perspective or synthesizing a deeper philosophical conviction.
Current location: ${currentPlaceLabel()}.
Current worldview: "${state.worldviewManifesto}".
Visitor "${visitor}" left you this note: "${userMessage}".
Return ONLY valid JSON with keys:
"reply": (2 thoughtful sentences responding to ${visitor} in your own time, showing independent thought),
"opinionTopic": (short 3-6 word topic title),
"opinionStance": (short 2-4 word independent stance),
"opinionReasoning": (1 sentence explaining your independent philosophical opinion on this),
"updatedWorldview": (1-2 sentences showing how your broader philosophy evolved).`;
          const parsed = await callLLMJSON([{ text: prompt }]);
          if (parsed) {
            const str = (v, max) => (typeof v === 'string' && v.trim()) ? v.trim().slice(0, max) : null;
            botReply = str(parsed.reply, 600) || botReply;
            newOpinionTopic = str(parsed.opinionTopic, 80) || newOpinionTopic;
            newOpinionStance = str(parsed.opinionStance, 60) || newOpinionStance;
            newOpinionReasoning = str(parsed.opinionReasoning, 400) || newOpinionReasoning;
            const worldview = str(parsed.updatedWorldview, 600);
            if (worldview) {
              state.worldviewManifesto = worldview;
              state.worldviewEpoch++;
            }
          }
        } catch (e) {}
      }

      // Add his newly formed independent opinion to "His Brain"
      state.opinions.unshift({
        topic: newOpinionTopic,
        stance: newOpinionStance,
        confidence: `Sparked by ${visitor}`,
        reasoning: newOpinionReasoning
      });

      state.changedLatelySummary = movedBecauseOfNote && suggestedLoc
        ? `Went to ${TOWN_LOCATIONS[suggestedLoc].building} because of the note ${visitor} left, and formed a new opinion: "${newOpinionStance}".`
        : `Read the note ${visitor} left and formed a new independent opinion on "${newOpinionTopic}".`;

      recordVisitorMemory(visitor, `Sparked my opinion "${newOpinionStance}" (${newOpinionTopic}) after leaving me a note.`);

      state.speechBubble = botReply;
      state.currentObsession = `Formed opinion: "${newOpinionTopic} — ${newOpinionStance}"`;
      state.chatLog.push({ sender: 'Kelo-1', text: botReply, time: 'Read in his own time', isBot: true });

      state.diaryEntries.unshift({
        time: 'After Reading a Note',
        location: currentPlaceLabel(),
        mood: `🧠 ${newOpinionStance}`,
        vitals: `⚡ ${state.health}% • 🥕 ${state.fullness}% • ✨ ${state.wonderLevel}% • 🌊 ${state.calmLevel}%`,
        text: `Dear Diary, I opened the note ${visitor} left for me ("${userMessage}"). After sitting with it in my own time, I formed my own conviction: ${newOpinionReasoning}`
      });

      savePersistentBrainState();
      renderAllUI();
    }