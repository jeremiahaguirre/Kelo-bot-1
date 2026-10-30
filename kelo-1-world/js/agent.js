// ==========================================
// AI AGENT LOGIC (agent.js)
// ==========================================

let apiKey = localStorage.getItem('kelo1_gemini_api_key') || "";

// Client-side Canvas Vision Analyzer: Extracts dominant colors, brightness & geometry cues from ANY uploaded image!
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
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function generateProcedural3DWeldParts(promptText = '', primaryHex = '#38bdf8', secondaryHex = '#f59e0b') {
  const lower = (promptText || '').toLowerCase();
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

// Spontaneous Whims & Philosophical Tangents Kelo-1 Can Have at Any Time
const SPONTANEOUS_WHIMS = [
  { locKey: 'shoreline', pose: 'sit_shore', tag: 'Spontaneous Whim', emoji: '🌊', title: 'Dangling Legs by the Lake', wondering: '"If Okanagan Lake reflects the sky..."', speech: 'I know I had plans, but look at the water...', diary: 'Dear Diary, I wandered off the cobblestone path...' },
  { locKey: 'meadow', pose: 'crouch_inspect', tag: 'Sudden Curiosity', emoji: '🌼', title: 'Studying a Dandelion Clock', wondering: '"How does a tiny seed know the difference..."', speech: 'Hold on—look at this wildflower...', diary: 'Dear Diary, I stopped in the West Island Meadow...' },
  { locKey: 'cafe', pose: 'normal', tag: 'Sensory Curiosity', emoji: '☕', title: 'Listening to Espresso Steam', wondering: '"Why does the sound of an espresso steam wand feel like distant ocean rain?"', speech: 'At Bean & Byte Cafe...', diary: 'Dear Diary, drifted over to Bean & Byte Cafe...' }
];

const OPEN_ENDED_EMERGENT_SEEDS = [
  { actionTitle: 'Drilling for Gold on the Alpine Peak', placeName: 'North-West Alpine Gold Vein', emoji: '⛏️', x: -15.5, z: -26.5, archetype: 'gold_drill_rig', colorHex: '#facc15', motion: { sparkBurst: true }, wondering: '...', speech: '...', diary: '...', opinionTopic: 'On Exploring Beyond Boundaries', opinionStance: 'The Whole Island & Mountains Are Mine to Roam', opinionReasoning: '...', gearRequested: 'High-Torque Diamond Core Bits, Solar Smelting Crucible' },
  { actionTitle: 'Inoculating Mycelium Thermal Retaining Wall', placeName: 'North Retaining Slope', emoji: '🍄', x: -4.2, z: -12.4, archetype: 'mycelium_dome', colorHex: '#f59e0b', motion: { sparkBurst: false }, wondering: '...', speech: '...', diary: '...', opinionTopic: 'On Biomimetic Engineering', opinionStance: 'Living Fungal Composites Beat Concrete', opinionReasoning: '...', gearRequested: '50L Sterile Oat Substrate, Infrared Thermal Imaging Lens' },
  { actionTitle: 'Laying 3D-Printed Mountain Railway Track', placeName: 'Eastern Foothill Switchback', emoji: '🚂', x: 16.2, z: -16.8, archetype: 'rail_track', colorHex: '#38bdf8', motion: { sparkBurst: true }, wondering: '...', speech: '...', diary: '...', opinionTopic: 'On Island Infrastructure', opinionStance: 'Build Trains Simply Because Trains Are Joyful', opinionReasoning: '...', gearRequested: 'Brushless Geared Traction Motors, 100m Steel Bar Stock' },
  { actionTitle: 'Welding a Custom Multi-Axis Geodesic Arch', placeName: 'Western Cliff Overlook', emoji: '⚡', x: -16.8, z: 4.5, archetype: 'custom_weld', colorHex: '#a855f7', motion: { sparkBurst: true }, wondering: '...', speech: '...', diary: '...', opinionTopic: 'On Unbounded 3D Sculpture', opinionStance: 'Any Shape I Imagine Can Be Welded Into Being', opinionReasoning: '...', gearRequested: 'Argon Shielding Gas Refill, Anodizing Power Supply' }
];

async function synthesizeUnboundedExperience(promptOrImpulse = null, originLabel = 'Unscripted Autonomy', forcedCoords = null, imageAttachment = null) {
  if (state.isBusy) return;
  state.isBusy = true;
  try {
    const visitor = (document.getElementById('visitorNameInput')?.value || 'curiousWanderer').trim();
    const seed = OPEN_ENDED_EMERGENT_SEEDS[Math.floor(Math.random() * OPEN_ENDED_EMERGENT_SEEDS.length)];
    const lowerPrompt = (promptOrImpulse || '').toLowerCase();

    let targetX = forcedCoords ? forcedCoords.x : seed.x;
    let targetZ = forcedCoords ? forcedCoords.z : seed.z;

    if (!forcedCoords && promptOrImpulse) {
      targetX = Math.round(((Math.random() - 0.5) * 32) * 10) / 10;
      targetZ = Math.round(((Math.random() * 26) - 16) * 10) / 10;
    }

    const primaryHex = imageAttachment ? imageAttachment.primaryHex : seed.colorHex;
    const secondaryHex = imageAttachment ? imageAttachment.secondaryHex : '#f59e0b';
    let detectedArchetype = seed.archetype;
    
    // (Truncated LLM Call logic to keep script clean - integrate your Gemini code here)
    // ...
    
    state.currentLocKey = 'shoreline';
    state.customPlaceName = `Custom Sector (${targetX}, ${targetZ})`;
    state.targetPos = { x: targetX, z: targetZ };
    state.microPose = 'procedural_custom';
    state.autonomyTag = originLabel;

    savePersistentBrainState();
    if(typeof renderAllUI === 'function') renderAllUI();
    if(typeof showToast === 'function') showToast(`✨ Kelo-1: Task initialized at (${state.targetPos.x}, ${state.targetPos.z})!`);
  } finally {
    state.isBusy = false;
  }
}

async function directKeloToActivity(locKey, customReason = '', originLabel = 'Suggested Whim') {
  if (state.isBusy) return;
  const loc = TOWN_LOCATIONS[locKey];
  if (!loc) return;
  
  state.currentLocKey = locKey;
  state.targetPos = { x: loc.x, z: loc.z };
  state.autonomyTag = originLabel;
  savePersistentBrainState();
  if(typeof renderAllUI === 'function') renderAllUI();
}

function handleUserLocationSuggestion(locKey, source) {
  const loc = TOWN_LOCATIONS[locKey];
  if (!loc) return;
  directKeloToActivity(locKey, `Wandered over to ${loc.building} after noticing your pin`, 'Visitor Suggestion');
}

function loadPersistentBrainState() {
  try {
    const raw = localStorage.getItem('kelo1_autonomous_brain_v2');
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.worldviewManifesto) state.worldviewManifesto = saved.worldviewManifesto;
  } catch (e) {}
}

function savePersistentBrainState() {
  try {
    localStorage.setItem('kelo1_autonomous_brain_v2', JSON.stringify({ worldviewManifesto: state.worldviewManifesto }));
  } catch (e) {}
}

function recordVisitorMemory(visitorName, actionSummary) {
  const cleanName = (visitorName || 'curiousWanderer').trim();
  savePersistentBrainState();
}

let organicTimeoutId = null;
function scheduleNextOrganicImpulse() {
  if (organicTimeoutId) clearTimeout(organicTimeoutId);
  const organicDelayMs = 25000;
  organicTimeoutId = setTimeout(async () => {
    if (!state.isBusy) runAutonomousLifeTick();
    scheduleNextOrganicImpulse();
  }, organicDelayMs);
}

function runAutonomousLifeTick() {
  const staysAndDeepensThought = Math.random() < 0.35;
  if (staysAndDeepensThought) {
    state.worldviewEpoch++;
    savePersistentBrainState();
    if(typeof renderAllUI === 'function') renderAllUI();
    return;
  }
}

function petKelo1Interaction() {
  state.happiness = Math.min(100, state.happiness + 8);
  if(typeof renderAllUI === 'function') renderAllUI();
}

function splashOgopogo() {
  state.wonderLevel = Math.min(100, state.wonderLevel + 7);
  if(typeof renderAllUI === 'function') renderAllUI();
}

async function handleVisitorChatMessage(userMessage) {
  state.chatLog.push({ sender: 'Visitor', text: userMessage, time: 'Just now', isBot: false });
  if(typeof renderAllUI === 'function') renderAllUI();
}

async function processNextUnopenedVisitorNote() {
  if (state.unopenedNotesQueue.length === 0) return;
  const note = state.unopenedNotesQueue.shift();
  savePersistentBrainState();
  if(typeof renderAllUI === 'function') renderAllUI();
}
