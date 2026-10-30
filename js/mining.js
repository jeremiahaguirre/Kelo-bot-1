// Kelo-bot-1 — js/mining.js
// Loaded after hobbies.js. Kelo-1 can dig and mine anywhere on the island and the mountain,
// but only with the right equipment, which he has to ask visitors for:
//   - any digging needs a shovel or a pickaxe
//   - once a hole reaches bedrock he needs a jackhammer to keep going
//   - once the dirt pile gets big he needs a dump truck AND an excavator to haul it away
// Each session deepens a real hole in the terrain and grows the dirt pile beside it.
// Finds are hidden at fixed spots and depths in the mountain, waiting to be discovered.

const MAX_DIG_SITES = 6;
const ROCK_DEPTH = 1.6;        // below this he hits bedrock
const MAX_DEPTH = 6;
const PILE_LIMIT = 6;          // dirt pile size at which he needs a truck and excavator

const TOOL_NEEDS = {
  dig: { re: /shovel|spade|pick ?axe|mattock/i, ask: 'A sturdy shovel', why: 'I want to dig, but I have nothing to dig with.' },
  rock: { re: /jack ?hammer|rock breaker|demolition hammer/i, ask: 'A jackhammer', why: 'I hit solid rock. My shovel just bounces off it.' },
  truck: { re: /dump ?truck/i, ask: 'A dump truck', why: 'The dirt pile is taller than me. I need something to haul it away.' },
  excavator: { re: /excavator|digger|backhoe/i, ask: 'An excavator', why: 'The pile is too big to move by hand; an excavator could load it.' }
};

// Hidden in the ground, the same every time (seeded), never shown until dug up
const HIDDEN_FINDS = (() => {
  const rng = makeRng('kelo1-mountain-secrets');
  const kinds = [
    ['Amethyst geode', '💜'], ['Quartz crystal cluster', '💎'], ['Gold nugget', '🪙'], ['Ammonite fossil', '🐚'],
    ['Dinosaur rib bone', '🦴'], ['Old miner\'s lantern', '🏮'], ['Meteorite fragment', '☄️'], ['Jade pebble', '🟢'],
    ['Buried time capsule', '📦'], ['Silver coin from 1898', '🥈'], ['Trilobite fossil', '🪲'], ['Garnet vein sample', '🔴'],
    ['Petrified wood', '🪵'], ['Obsidian arrowhead', '🗿']
  ];
  return kinds.map(([name, emoji], i) => ({
    id: `find-${i}`,
    name,
    emoji,
    x: Math.round((-40 + rng() * 80) * 10) / 10,
    z: Math.round((i < 4 ? -8 - rng() * 8 : -16 - rng() * 22) * 10) / 10, // a few in the foothills, most in the mountain
    depth: Math.round((0.6 + rng() * (i % 3 === 0 ? 4.5 : 2.5)) * 10) / 10
  }));
})();

const dirtPileMeshes = {};
const equipmentMeshes = {};

function ownedItemNames() {
      return [...state.toolInventory, ...state.toys.map(t => t.name), ...state.belongings.map(b => b.name)];
    }

function hasEquipment(kind) {
      return ownedItemNames().some(n => TOOL_NEEDS[kind].re.test(n));
    }

// Depth of the ground lowered by all dig sites at a point (used by getAnalyticalGroundHeight)
function digDepressionAt(x, z) {
      let total = 0;
      for (const site of state.digSites) {
        if (!site.depth) continue;
        const radius = 1.1 + site.depth * 0.35;
        const d = Math.hypot(x - site.x, z - site.z);
        if (d < radius) total += site.depth * (1 - (d / radius) * (d / radius));
      }
      return total;
    }

function siteNear(x, z) {
      return state.digSites.find(s => Math.hypot(s.x - x, s.z - z) < 2.5) || null;
    }

function pileOffset(site) {
      return { x: site.x + 2.4, z: site.z + 0.6 };
    }

function updateDirtPile3D(site) {
      if (!scene) return;
      const old = dirtPileMeshes[site.id];
      if (old) {
        scene.remove(old);
        old.traverse(o => { if (o.geometry) o.geometry.dispose(); });
        worldObstacles = worldObstacles.filter(o => o !== old.userData.obstacle);
      }
      if (site.dirt <= 0) return;
      const { x, z } = pileOffset(site);
      const pile = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 1, flatShading: true });
      const size = 0.45 + Math.sqrt(site.dirt) * 0.45;
      const mound = new THREE.Mesh(new THREE.ConeGeometry(size, size * 0.9, 9), mat);
      mound.position.y = size * 0.42;
      mound.castShadow = true;
      pile.add(mound);
      // Clods and rocks on the pile; more as it grows
      const rng = makeRng(`${site.id}-${Math.floor(site.dirt)}`);
      for (let i = 0; i < Math.min(14, 3 + site.dirt * 2); i++) {
        const clod = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08 + rng() * 0.14, 0), rng() < 0.3 ? new THREE.MeshStandardMaterial({ color: 0x8a8f9c }) : mat);
        const a = rng() * Math.PI * 2, rr = rng() * size * 0.9;
        clod.position.set(Math.cos(a) * rr, 0.05 + rng() * 0.15, Math.sin(a) * rr);
        pile.add(clod);
      }
      pile.position.set(x, getAnalyticalGroundHeight(x, z), z);
      scene.add(pile);
      const obstacle = { x, z, r: size * 0.9 };
      worldObstacles.push(obstacle);
      pile.userData.obstacle = obstacle;
      dirtPileMeshes[site.id] = pile;
    }

// Park the dump truck and excavator at a site once he has them and uses them there
function showEquipmentAt(site) {
      if (!scene || typeof buildItemModel3D !== 'function') return;
      ['truck', 'excavator'].forEach((kind, i) => {
        if (!hasEquipment(kind)) return;
        let m = equipmentMeshes[kind];
        if (!m) {
          m = buildItemModel3D(kind === 'truck' ? 'dump truck' : 'excavator', { label: false });
          m.scale.setScalar(3.2);
          scene.add(m);
          equipmentMeshes[kind] = m;
        }
        const x = site.x - 2.6, z = site.z + (i ? 2.2 : -2.2);
        m.position.set(x, getAnalyticalGroundHeight(x, z), z);
      });
    }

// Ask for missing equipment once (no duplicate letters)
function requestEquipment(kind) {
      const need = TOOL_NEEDS[kind];
      const already = state.requestsToUser.some(r => !r.fulfilled && need.re.test(r.requestedGear || ''))
        || state.mailbox.some(m => need.re.test(m.name || ''));
      if (!already) addItemRequest(need.ask, kind === 'dig' || kind === 'rock' ? 'tool' : 'vehicle', need.why, 'Digging');
      return need;
    }

// What is stopping him from digging at this site right now, if anything
function missingEquipmentFor(site) {
      if (!hasEquipment('dig')) return 'dig';
      if (site && site.depth >= ROCK_DEPTH && !hasEquipment('rock')) return 'rock';
      if (site && site.dirt >= PILE_LIMIT) {
        if (!hasEquipment('truck')) return 'truck';
        if (!hasEquipment('excavator')) return 'excavator';
      }
      return null;
    }

function digToolModelName(site) {
      if (site.depth >= ROCK_DEPTH && hasEquipment('rock')) return 'jackhammer';
      return ownedItemNames().find(n => /pick ?axe/i.test(n)) ? 'pickaxe' : 'shovel';
    }

// Kelo-1 goes to a spot and digs. Returns what happened.
async function digAt(x, z, originLabel = 'Digging') {
      if (state.isBusy || state.isBuilding || state.isPracticing) return 'busy';
      x = Math.round(clampNumber(x, WORLD_MIN_X + 1, WORLD_MAX_X - 1, 0) * 10) / 10;
      z = Math.round(clampNumber(z, WORLD_MIN_Z + 1, 7, -20) * 10) / 10;
      // Not inside buildings or on top of other things
      if (typeof pointBlocked === 'function' && pointBlocked(x, z, { x: 999, z: 999 })) {
        state.speechBubble = 'Something is already standing there. I will dig somewhere else.';
        renderAllUI();
        return 'blocked';
      }
      let site = siteNear(x, z);

      const missing = missingEquipmentFor(site);
      if (missing) {
        const need = requestEquipment(missing);
        state.moodEmoji = '📝';
        state.moodTitle = `Needs ${need.ask.replace(/^an? /i, '').toLowerCase()} to keep digging`;
        state.speechBubble = `${need.why} I wrote a letter asking for ${need.ask.toLowerCase()}.`;
        state.diaryEntries.unshift({
          time: originLabel, location: currentPlaceLabel(), mood: '📝 Waiting for equipment',
          vitals: `⚡ ${state.health}% • 🥕 ${state.fullness}% • ✨ ${state.wonderLevel}% • 🌊 ${state.calmLevel}%`,
          text: `Dear Diary, ${need.why} So I asked for ${need.ask.toLowerCase()}. Until it arrives, the digging waits.`
        });
        savePersistentBrainState();
        renderAllUI();
        showToast(`✉️ Kelo-1 needs ${need.ask.toLowerCase()} to dig`);
        return 'needs-' + missing;
      }

      state.isPracticing = true; // a physical activity: nothing else interrupts it
      try {
        if (!site) {
          site = { id: 'dig-' + Date.now(), x, z, depth: 0, dirt: 0, finds: [], startedAt: Date.now() };
          state.digSites.unshift(site);
          if (state.digSites.length > MAX_DIG_SITES) state.digSites.length = MAX_DIG_SITES;
        }
        const placeLabel = site.z < -14 ? `the mountain dig (${site.x}, ${site.z})` : `the dig site (${site.x}, ${site.z})`;
        state.currentLocKey = 'custom';
        state.customPlaceName = placeLabel;
        state.targetPos = { x: site.x - 0.9, z: site.z };
        state.microPose = 'normal';
        state.moodEmoji = '⛏️';
        state.moodTitle = 'Heading out to dig';
        state.speechBubble = `Grabbing my ${digToolModelName(site)} and heading to ${placeLabel}.`;
        renderAllUI();
        await waitForArrival(60000);

        // Dig: tool in hand, debris flying, hole deepening in steps
        if (typeof setCarriedObject === 'function') {
          const tool = buildItemModel3D(digToolModelName(site), { label: false });
          tool.scale.setScalar(1.6);
          setCarriedObject(tool);
        }
        state.botRotY = Math.atan2(site.x - state.botPos.x, site.z - state.botPos.z);
        state.moodTitle = site.depth >= ROCK_DEPTH ? 'Jackhammering through rock' : 'Digging into the mountain';
        state.microPose = 'digging';
        renderAllUI();
        showEquipmentAt(site);

        const machines = hasEquipment('excavator');
        const stepDepth = (site.depth >= ROCK_DEPTH ? 0.12 : 0.2) * (machines ? 1.6 : 1);
        const steps = 5;
        for (let i = 0; i < steps && site.depth < MAX_DEPTH; i++) {
          await new Promise(r => setTimeout(r, 1800));
          site.depth = Math.round(Math.min(MAX_DEPTH, site.depth + stepDepth) * 100) / 100;
          site.dirt = Math.round((site.dirt + stepDepth * 1.6) * 100) / 100;
          refreshTerrainAround(site.x, site.z, 1.6 + site.depth * 0.45);
          updateDirtPile3D(site);
          // Stand in the hole as it deepens
          state.botAltitudeY = getIslandGroundHeight(state.botPos.x, state.botPos.z);
          if (site.depth >= ROCK_DEPTH && !hasEquipment('rock')) break;
        }

        // Haul the pile away if he has both machines
        let hauled = 0;
        if (site.dirt >= PILE_LIMIT * 0.7 && hasEquipment('truck') && hasEquipment('excavator')) {
          hauled = Math.min(site.dirt - 1, 4);
          site.dirt = Math.round((site.dirt - hauled) * 100) / 100;
          updateDirtPile3D(site);
        }

        // Anything buried here at this depth?
        const found = HIDDEN_FINDS.filter(f => !state.foundItems.some(g => g.id === f.id)
          && Math.hypot(f.x - site.x, f.z - site.z) < 3.2 && site.depth >= f.depth);
        found.forEach(f => {
          state.foundItems.unshift({ id: f.id, name: f.name, emoji: f.emoji, at: Date.now(), siteId: site.id, depth: site.depth });
          state.belongings.unshift({ name: f.name, category: 'find', emoji: f.emoji, from: 'the mountain' });
          site.finds.push(f.id);
        });
        // Small everyday finds keep it rewarding
        const pebble = found.length === 0 && Math.random() < 0.3
          ? pick(['an oddly round pebble', 'a rusty bolt', 'a smooth river stone', 'a chunk of mica that sparkles', 'an old bottle cap'])
          : null;

        site.sessions = (site.sessions || 0) + 1;
        if (typeof bumpLifeStat === 'function') bumpLifeStat('digSessions');
        const layer = site.depth >= ROCK_DEPTH ? 'bedrock' : 'soil';
        let result = `Dug down to ${site.depth.toFixed(1)} m (${layer}). The dirt pile is ${site.dirt.toFixed(1)} high.`;
        if (hauled) result += ` The excavator loaded ${hauled.toFixed(1)} into the dump truck and I hauled it off.`;
        if (found.length) result += ` I FOUND ${found.map(f => `${f.emoji} ${f.name}`).join(' and ')}!`;
        else if (pebble) result += ` Only found ${pebble}, but I kept it.`;
        const next = missingEquipmentFor(site);
        if (next) {
          const need = requestEquipment(next);
          result += ` ${need.why} I asked for ${need.ask.toLowerCase()}.`;
        }

        state.moodEmoji = found.length ? found[0].emoji : '⛏️';
        state.moodTitle = found.length ? `Found ${found[0].name}!` : `Digging at ${placeLabel}`.slice(0, 80);
        state.speechBubble = result;
        state.changedLatelySummary = result.slice(0, 200);
        state.wonderLevel = Math.min(100, state.wonderLevel + (found.length ? 15 : 3));
        state.fullness = Math.max(5, state.fullness - 4);
        state.health = Math.max(5, state.health - 3);
        state.diaryEntries.unshift({
          time: originLabel, location: placeLabel, mood: `${state.moodEmoji} ${state.moodTitle}`,
          vitals: `⚡ ${state.health}% • 🥕 ${state.fullness}% • ✨ ${state.wonderLevel}% • 🌊 ${state.calmLevel}%`,
          text: `Dear Diary, ${result}`
        });
        if (found.length) {
          found.forEach(f => showToast(`${f.emoji} Kelo-1 dug up: ${f.name}!`));
          if (Math.random() < 0.7) addConcept(blendNewConcept(found[0].name, pick(state.concepts)?.name || 'the mountain'), `Dug up: ${found[0].name}`);
        }
        savePersistentBrainState();
        renderAllUI();
        return found.length ? 'found' : 'dug';
      } finally {
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.microPose = 'normal';
        state.isPracticing = false;
      }
    }

// Where he feels like digging: an existing site, near a hunch, or somewhere new on the mountain
function chooseDigSpot() {
      const unfinished = state.digSites.filter(s => s.depth < MAX_DEPTH);
      if (unfinished.length && Math.random() < 0.6) return pick(unfinished);
      const x = Math.round(randRange(-38, 38) * 10) / 10;
      const z = Math.round(randRange(-36, -10) * 10) / 10;
      return { x, z };
    }

function diggingChance() {
      // He has to discover that digging is a thing first
      if (!state.knowsDigging) return 0;
      // More likely once he owns digging tools; occasionally he wants to dig (and will ask) anyway
      return hasEquipment('dig') ? 0.16 : 0.05;
    }

// --- Discovering digging --------------------------------------------------------------------
// Kelo-1 starts out not knowing he can dig. He finds out by noticing something glint in the
// ground while exploring, by reading about mining/gems/fossils, or by being given a shovel.
let glintSprite = null;
let lastGlintCheck = 0;
let glintCooldownUntil = 0;

function discoverDigging(how) {
      if (state.knowsDigging) return;
      state.knowsDigging = true;
      state.moodEmoji = '✨';
      state.moodTitle = 'Discovered something under the ground';
      state.speechBubble = `${how} I think things are buried in this island. I could dig for them!`;
      state.diaryEntries.unshift({
        time: 'A Discovery', location: currentPlaceLabel(), mood: '✨ Things are buried here',
        vitals: `⚡ ${state.health}% • 🥕 ${state.fullness}% • ✨ ${state.wonderLevel}% • 🌊 ${state.calmLevel}%`,
        text: `Dear Diary, ${how} So the ground isn't just ground; there are things hidden in it. I want to dig. ${hasEquipment('dig') ? 'Good thing I have something to dig with.' : 'I will need something to dig with, so I am writing a letter.'}`
      });
      addConcept({ name: 'Buried Treasure Theory', emoji: '⛏️', definition: 'The island keeps secrets under its surface, and patience with a shovel reveals them.', builtFrom: [how.slice(0, 50)] }, 'Discovered digging');
      queueCuriosity('Geology');
      if (!hasEquipment('dig')) requestEquipment('dig');
      state.wonderLevel = Math.min(100, state.wonderLevel + 10);
      savePersistentBrainState();
      renderAllUI();
      showToast('✨ Kelo-1 discovered that things are buried on the island');
    }

// Article titles or text about mining or the underground can teach him about digging
const DIG_TOPICS = /\b(mining|mine|miner|quarry|excavation|archaeolog|geode|gemstone|gem|fossil|ore|prospect|gold rush|geology|mineral|spelunk|cave|bedrock|tunnel)/i;

function noticeDiggingInReading(hops) {
      if (state.knowsDigging || !Array.isArray(hops)) return;
      const hit = hops.find(h => DIG_TOPICS.test(h.title) || DIG_TOPICS.test(h.extract));
      if (hit) discoverDigging(`I read about ${hit.title} at the NetNode cafe and realised people dig into the ground to find things.`);
    }

function showGlint(find) {
      if (!scene) return;
      if (!glintSprite) {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.3, 'rgba(255,236,150,0.9)');
        g.addColorStop(1, 'rgba(255,220,100,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(32, 4); ctx.lineTo(32, 60); ctx.moveTo(4, 32); ctx.lineTo(60, 32); ctx.stroke();
        glintSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
        scene.add(glintSprite);
      }
      glintSprite.position.set(find.x, getAnalyticalGroundHeight(find.x, find.z) + 0.35, find.z);
      glintSprite.userData.until = Date.now() + 6000;
      glintSprite.visible = true;
    }

// Checked about once a second: is he near something buried that he hasn't found yet?
function checkForGlints() {
      const now = Date.now();
      if (glintSprite && glintSprite.visible) {
        const left = glintSprite.userData.until - now;
        glintSprite.visible = left > 0;
        const pulse = 0.6 + Math.abs(Math.sin(now / 180)) * 0.7;
        glintSprite.scale.set(pulse, pulse, pulse);
      }
      if (now - lastGlintCheck < 1000 || now < glintCooldownUntil) return;
      lastGlintCheck = now;
      const near = HIDDEN_FINDS.find(f => !state.foundItems.some(g => g.id === f.id)
        && Math.hypot(f.x - state.botPos.x, f.z - state.botPos.z) < 7);
      if (!near || Math.random() > 0.35) return;
      glintCooldownUntil = now + 45000;
      showGlint(near);
      if (!state.knowsDigging) {
        discoverDigging('While I was exploring, something glinted between the rocks and then disappeared.');
      } else if (!state.isBusy && !state.isBuilding && !state.isPracticing && Math.random() < 0.5) {
        state.speechBubble = 'Did something just glint over there? I want to dig and see.';
        renderAllUI();
        doWhenFree(() => digAt(near.x, near.z, 'Saw Something Glint'));
      }
    }

function renderMiningUI() {
      const el = document.getElementById('digSitesContainer');
      if (!el) return;
      if (!state.knowsDigging) {
        el.innerHTML = '<p class="text-[11px] text-slate-500 italic">He hasn\'t discovered that things are buried here yet. Exploring the mountain, reading at NetNode, or a shovel might teach him.</p>';
        return;
      }
      const sites = state.digSites.map(s => {
        const missing = missingEquipmentFor(s);
        return `
          <div class="p-2.5 rounded-xl bg-slate-900/90 border border-amber-700/40 text-xs space-y-1">
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-amber-200">⛏️ (${escapeHtml(s.x)}, ${escapeHtml(s.z)})</span>
              <span class="text-[10px] font-mono text-slate-400">${escapeHtml(s.sessions || 0)} sessions</span>
            </div>
            <div class="text-[10px] font-mono text-slate-300">Depth ${escapeHtml(s.depth.toFixed(1))} m (${s.depth >= ROCK_DEPTH ? 'bedrock' : 'soil'}) • Dirt pile ${escapeHtml(s.dirt.toFixed(1))}/${PILE_LIMIT}</div>
            ${missing ? `<div class="text-[10px] text-rose-300">Needs ${escapeHtml(TOOL_NEEDS[missing].ask.toLowerCase())} to continue</div>` : ''}
          </div>`;
      }).join('');
      const finds = state.foundItems.map(f => `<span class="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-100 text-[10px]">${escapeHtml(f.emoji)} ${escapeHtml(f.name)}</span>`).join('');
      const gear = ['dig', 'rock', 'truck', 'excavator'].map(k => `<span class="px-2 py-0.5 rounded-lg text-[10px] font-mono ${hasEquipment(k) ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-800 text-slate-500'}">${hasEquipment(k) ? '✓' : '✗'} ${escapeHtml(TOOL_NEEDS[k].ask.replace(/^an? (sturdy )?/i, ''))}</span>`).join('');
      el.innerHTML = `
        <div class="flex flex-wrap gap-1">${gear}</div>
        ${sites || '<p class="text-[11px] text-slate-500 italic">No digs yet.</p>'}
        <div class="text-[11px] font-bold text-amber-300 pt-1">Finds (${state.foundItems.length} of ${HIDDEN_FINDS.length} hidden treasures)</div>
        <div class="flex flex-wrap gap-1">${finds || '<span class="text-[11px] text-slate-500 italic">Nothing found yet. Things are buried all over the mountain.</span>'}</div>`;
    }

window.addEventListener('DOMContentLoaded', () => {
  // After main.js has loaded his state and built the terrain: restore holes and dirt piles
  setTimeout(() => {
    state.digSites.forEach(site => {
      refreshTerrainAround(site.x, site.z, 1.6 + site.depth * 0.45);
      updateDirtPile3D(site);
    });
    renderMiningUI();
  }, 0);
});
