// Kelo-bot-1 — js/landfill.js
// Loaded after vehicles.js. Kelo-1 can make new land: instead of the Disposal Pit, he tips the dirt
// he digs into the lake off the beach. Dumped dirt settles on the lake bed as a mound with slopes at
// the angle loose soil rests at. It stays under water until enough has gone in to reach above the
// surface, so deep water takes many more truckloads than shallow water. Once a patch breaks the
// surface it is solid ground he can walk and drive on, and the next patch starts further out.

const FILL_RADIUS = 2.0;
const LAND_TOP = WATER_LEVEL + 0.3;        // finished land stands this high
const FILL_SLOPE = 1.0; // packed fill under water holds a 45° bank
const bedGrids = new Map(); // fill id -> sampled lake bed around it (sampled once)
const fillLevelCache = new Map();          // fill id + volume -> the height its top has reached

function activeLandFill() {
      return state.landFills.find(f => !f.done) || null;
    }

// The lake bed, ignoring every fill (sampled straight from the terrain function)
function bedWithoutFills(x, z) {
      const saved = state.landFills;
      state.landFills = [];
      const y = getAnalyticalGroundHeight(x, z);
      state.landFills = saved;
      return y;
    }

// The surface of a fill whose flat top is at height F: flat over the patch, sloping away beyond it
function fillSurface(f, F, x, z) {
      const d = Math.hypot(x - f.x, z - f.z);
      return d <= f.r ? F : F - (d - f.r) * FILL_SLOPE;
    }

// How much dirt it takes for the top to reach height F (summed over a grid of the lake bed)
function bedGrid(f) {
      if (bedGrids.has(f.id)) return bedGrids.get(f.id);
      const pts = [], reach = f.r + 6;
      for (let x = f.x - reach; x <= f.x + reach; x += 0.5) {
        for (let z = f.z - reach; z <= f.z + reach; z += 0.5) pts.push([x, z, bedWithoutFills(x, z)]);
      }
      bedGrids.set(f.id, pts);
      return pts;
    }

function volumeToLevel(f, F) {
      let v = 0;
      for (const [x, z, bed] of bedGrid(f)) {
        const s = fillSurface(f, F, x, z);
        if (s > bed) v += (s - bed) * 0.25;
      }
      return v;
    }

// The height the top of a fill has reached with the dirt dumped so far (cached; bisection on volume)
function fillLevel(f) {
      const key = `${f.id}:${f.volume.toFixed(2)}`;
      if (fillLevelCache.has(key)) return fillLevelCache.get(key);
      let lo = bedWithoutFills(f.x, f.z), hi = LAND_TOP;
      if (volumeToLevel(f, hi) <= f.volume) lo = hi;
      else for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        if (volumeToLevel(f, mid) < f.volume) lo = mid; else hi = mid;
      }
      fillLevelCache.set(key, lo);
      return lo;
    }

// How much the fills raise the ground at a point whose ground (without fills) is `ground`
function landFillRaiseAt(x, z, ground) {
      let raise = 0;
      for (const f of state.landFills) {
        if (!(f.volume > 0) || Math.hypot(x - f.x, z - f.z) > f.r + 6.5) continue;
        const s = fillSurface(f, fillLevel(f), x, z);
        if (s > ground + raise) raise = s - ground;
      }
      return raise;
    }

function totalVolumeNeeded(f) {
      if (!f.needed) f.needed = Math.round(volumeToLevel(f, LAND_TOP) * 10) / 10;
      return f.needed;
    }

// Start a new patch of land: next to the last finished one, or off the beach at x
function startLandFill(x = null, why = '') {
      if (activeLandFill()) return activeLandFill();
      const last = state.landFills[state.landFills.length - 1];
      let fx = x !== null && Number.isFinite(Number(x)) ? Number(x) : last ? last.x : pick([-24, -18, 24, 30]);
      // Keep clear of the dock and the swimming beach in front of town
      if (fx > -5 && fx < 10) fx = fx < 2.5 ? -6 : 11;
      fx = Math.round(clampNumber(fx, WORLD_MIN_X + 4, WORLD_MAX_X - 4, -18) * 10) / 10;
      const sameColumn = state.landFills.filter(f => f.done && Math.abs(f.x - fx) < 1);
      const fz = sameColumn.length ? Math.max(...sameColumn.map(f => f.z)) + FILL_RADIUS * 1.6 : 10.6;
      const f = { id: 'fill-' + Date.now().toString(36), x: fx, z: Math.round(fz * 10) / 10, r: FILL_RADIUS, volume: 0, done: false, startedAt: Date.now(), why: String(why).slice(0, 160) };
      state.landFills.push(f);
      totalVolumeNeeded(f);
      const depth = WATER_LEVEL - bedWithoutFills(f.x, f.z);
      state.diaryEntries.unshift({
        time: 'Making New Land', location: 'the lake shore', mood: '🏝️ Planning new land',
        vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
        text: `Dear Diary, instead of throwing my dirt away I'm going to fill in a patch of the lake and make new land. ${why ? why + ' ' : ''}The water there is about ${depth.toFixed(1)} deep, so it will take roughly ${Math.ceil(f.needed / (4 * PILE_FLUFF))} truckloads before it breaks the surface.`
      });
      savePersistentBrainState();
      return f;
    }

// Drive the loaded truck to the edge of the water, back up, and tip the load in
async function dumpIntoLake(truck, amount) {
      const f = activeLandFill();
      if (!f) return false;
      const edgeZ = f.z - f.r - 3.2;
      await driveVehicle(truck, { x: f.x - 1.0, z: edgeZ }, 'Driving the dirt down to the lake to make new land');
      truck.rotY = Math.atan2(f.z - truck.z, -(f.x - truck.x));
      const tMesh = vehicleMeshes[truck.id];
      if (tMesh) tMesh.rotation.y = truck.rotY;
      const bed = tMesh && tMesh.userData.bed;
      const tip = (a) => { if (bed) bed.rotation.z = a; };
      for (let a = 0; a <= 12; a++) { tip(a * 0.07); await new Promise(r => setTimeout(r, 90)); }
      const load = truck.load || amount;
      truck.load = 0;
      renderVehicles3D();
      // A splash of dirt into the water, then the bed settles
      if (tMesh) {
        const clump = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), new THREE.MeshStandardMaterial({ color: 0x7a4b2a, roughness: 1, flatShading: true }));
        clump.scale.set(1.4, 0.7, 1.0);
        clump.position.set(tMesh.position.x - Math.cos(truck.rotY) * 3.6, tMesh.position.y + 1.4, tMesh.position.z + Math.sin(truck.rotY) * 3.6);
        scene.add(clump);
        for (let i = 0; i <= 14; i++) {
          clump.position.lerp(new THREE.Vector3(f.x, WATER_LEVEL - 0.8, f.z), 0.18);
          await new Promise(r => setTimeout(r, 50));
        }
        scene.remove(clump);
        clump.geometry.dispose();
      }
      f.volume = Math.round((f.volume + load * PILE_FLUFF) * 100) / 100;
      refreshTerrainAround(f.x, f.z, f.r + 7);
      if (typeof refreshTerrainColors === 'function') refreshTerrainColors(f);
      for (let a = 12; a >= 0; a--) { tip(a * 0.07); await new Promise(r => setTimeout(r, 60)); }
      const needed = totalVolumeNeeded(f);
      const pct = Math.min(100, Math.round(f.volume / needed * 100));
      if (f.volume >= needed) {
        f.done = true;
        f.doneAt = Date.now();
        state.moodEmoji = '🏝️';
        state.moodTitle = 'Made new land!';
        state.speechBubble = 'It broke the surface! There is solid ground where the lake used to be. I made land!';
        state.wonderLevel = Math.min(100, state.wonderLevel + 15);
        state.diaryEntries.unshift({
          time: 'Making New Land', location: 'the new land', mood: '🏝️ Made new land',
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, after ${f.loads + 1} truckloads the dirt finally rose above the water. I can stand where the lake used to be. Next time I'll keep going further out.`
        });
        showToast('🏝️ Kelo-1 made new land in the lake!');
      } else {
        const truckloads = Math.ceil((needed - f.volume) / (4 * PILE_FLUFF));
        state.speechBubble = `Splash! The dirt sinks under the water. That patch is ${pct}% filled: about ${truckloads} more truckload${truckloads === 1 ? '' : 's'} before it breaks the surface.`;
      }
      f.loads = (f.loads || 0) + 1;
      savePersistentBrainState();
      renderAllUI();
      return true;
    }

// Sand on the new land, darker wet mud where it is still under water
function refreshTerrainColors(f) {
      if (!terrainGroundMesh) return;
      const geo = terrainGroundMesh.geometry, pos = geo.attributes.position, col = geo.attributes.color;
      const sand = new THREE.Color(0xd9b97a), mud = new THREE.Color(0x5b4128);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        if (Math.hypot(x - f.x, z - f.z) > f.r + 7) continue;
        const ground = bedWithoutFills(x, z);
        if (landFillRaiseAt(x, z, ground) <= 0.02) continue;
        const c = pos.getY(i) > WATER_LEVEL + 0.05 ? sand : mud;
        col.setXYZ(i, c.r, c.g, c.b);
      }
      col.needsUpdate = true;
    }

function landFillSummaryForAI() {
      const f = activeLandFill();
      const done = state.landFills.filter(x => x.done).length;
      if (f) return `filling the lake at x ${f.x}: ${Math.round(f.volume / totalVolumeNeeded(f) * 100)}% of the way to new land${done ? `; ${done} patches already made` : ''}`;
      return done ? `${done} patches of new land made so far` : 'none yet (you could tip your dug dirt into the lake to make land instead of throwing it away)';
    }

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    state.landFills.forEach(f => { refreshTerrainAround(f.x, f.z, f.r + 7); refreshTerrainColors(f); });
  }, 200);
});
