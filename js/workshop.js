// Kelo-bot-1 — js/workshop.js
// Loaded after postoffice.js. Kelo-1 can decide to build anything, but everything is made at
// the welding table: he walks to the bench, welds the piece (you can watch it take shape),
// carries the finished piece to the spot he chose, and sets it down there.

const buildQueue = [];
// The welding table top's centre (js/weldstudio.js builds the table around it)
const WELD_TABLE_TOP = { x: MAP_LAYOUT.weld.x, z: MAP_LAYOUT.weld.z };
let workshopRunning = false;
let benchWorkpiece = null;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Queue a creation; he works through builds one at a time
function weldAndPlace(creation, placeLabel = state.customPlaceName, resuming = false) {
      const job = { creation, placeLabel: placeLabel || `(${creation.x}, ${creation.z})` };
      buildQueue.push(job);
      // Remember unfinished builds so a page refresh doesn't lose them
      if (!resuming) state.pendingBuilds.push(job);
      if (!workshopRunning) runWorkshop();
    }

async function runWorkshop() {
      workshopRunning = true;
      try {
        while (buildQueue.length > 0) {
          const job = buildQueue.shift();
          // Still busy with something else after a long wait: try this one again later
          // Busy, or waiting for welding supplies he has asked for: try this one again later
          const done = await runWeldJob(job.creation, job.placeLabel);
          if (done !== true) {
            buildQueue.push(job);
            await sleep(done === 'waiting' ? 30000 : 15000);
          }
        }
      } finally {
        workshopRunning = false;
      }
    }

function showBenchWorkpiece(creation) {
      clearBenchWorkpiece();
      if (typeof buildCreationGroup !== 'function' || !scene) return;
      benchWorkpiece = buildCreationGroup(creation);
      const bx = WELD_TABLE_TOP.x, bz = WELD_TABLE_TOP.z - 0.3;
      benchWorkpiece.position.set(bx, getAnalyticalGroundHeight(bx, bz) + 0.92, bz);
      benchWorkpiece.scale.setScalar(0.02);
      scene.add(benchWorkpiece);
    }

function clearBenchWorkpiece() {
      if (benchWorkpiece && scene) {
        scene.remove(benchWorkpiece);
        benchWorkpiece.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      }
      benchWorkpiece = null;
    }

// Returns false (without starting) if he is still busy with another job after waiting a while
async function runWeldJob(creation, destLabel) {
      // Let him finish a hobby, errand, sleep or mail run before heading to the bench. (isBusy alone
      // is fine: a build is queued from inside his own decision, which ends straight after.)
      const occupied = () => state.isPracticing || state.isSleeping || state.isCollectingMail || state.isBrowsing;
      for (let i = 0; i < 360 && occupied(); i++) await sleep(250);
      if (occupied()) return false;
      // Welding takes the know-how, the right gas, wire and safety gear (js/welding.js): until he has them,
      // he researches and asks, and the build waits
      if (typeof weldingReady === 'function' && !weldingReady(creation)) return 'waiting';
      state.isBuilding = true;
      const title = creation.title || 'something new';
      let dest = { x: clampNumber(creation.x, WORLD_MIN_X, WORLD_MAX_X, 0), z: clampNumber(creation.z, WORLD_VALLEY_MIN_Z, WORLD_MAX_Z, 0) };
      // His welded pieces and abstract ideas are art: they go on display in his Museum, not out on the
      // mountain or in town where they'd just be in the way (things he builds to use come from js/projects.js)
      if (typeof MUSEUM_DOOR !== 'undefined') {
        creation.inMuseum = true;
        dest = { ...MUSEUM_DOOR };
        destLabel = 'his Museum';
      }
      state.lastWeldAt = Date.now();
      const bench = TOWN_LOCATIONS.weld;
      try {
        // Sketch the design while walking: with an AI brain, design exactly what he means
        const designing = (!creation.parts && typeof designCreationWithAI === 'function') ? designCreationWithAI(title) : null;

        // 1. Walk to the welding table
        state.currentLocKey = 'custom';
        state.customPlaceName = bench.building;
        state.targetPos = { x: bench.x, z: bench.z };
        state.microPose = 'normal';
        state.speechBubble = `Heading to the welding table to make "${title}".`;
        state.changedLatelySummary = `Going to the welding table to build "${title}"`;
        renderAllUI();
        await waitForArrival(45000);
        if (designing) {
          const parts = await designing;
          if (parts) creation.parts = parts;
        }

        // 2. Weld it: hook up, hood on, then the arc and the bead (js/welding.js); the piece grows on the table
        state.moodEmoji = '👨‍🏭';
        state.moodTitle = `Welding: ${title}`.slice(0, 80);
        state.speechBubble = `Welding "${title}" together, piece by piece.`;
        renderAllUI();
        showBenchWorkpiece(creation);
        const grow = k => { if (benchWorkpiece) benchWorkpiece.scale.setScalar(0.02 + 0.33 * Math.min(1, k)); };
        if (typeof weldTheJob === 'function') {
          await weldTheJob(creation, grow);
        } else {
          state.currentLocKey = 'weld';
          const parts = Array.isArray(creation.parts) ? creation.parts.length : 4;
          const weldMs = Math.min(9000, 3500 + parts * 300);
          const started = Date.now();
          while (Date.now() - started < weldMs) { grow((Date.now() - started) / weldMs); await sleep(100); }
          if (typeof useWeldingSupplies === 'function') useWeldingSupplies();
        }
        clearBenchWorkpiece();

        // 3. Carry it to the spot he chose
        if (typeof setCarriedObject === 'function') {
          const carried = buildCreationGroup(creation);
          carried.scale.setScalar(0.32);
          setCarriedObject(carried);
        }
        state.currentLocKey = 'custom';
        state.customPlaceName = destLabel;
        state.targetPos = dest;
        state.microPose = 'normal';
        state.moodEmoji = creation.emoji || '✨';
        state.moodTitle = `Carrying ${title}`.slice(0, 80);
        state.speechBubble = `Done! Now carrying "${title}" to ${destLabel}.`;
        renderAllUI();
        await waitForArrival(60000);

        // Into the Museum and onto its plinth (down to a lower gallery if the floors above are full)
        if (creation.inMuseum && typeof carryIntoMuseum === 'function') await carryIntoMuseum('sculpture', creation, `"${title}"`);

        // 4. Set it down just in front of him so he isn't standing inside it
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        creation.x = Math.round(clampNumber(state.botPos.x + Math.sin(state.botRotY) * 1.7, WORLD_MIN_X, WORLD_MAX_X, dest.x) * 10) / 10;
        creation.z = Math.round(clampNumber(state.botPos.z + Math.cos(state.botRotY) * 1.7, WORLD_VALLEY_MIN_Z, WORLD_MAX_Z + 1, dest.z) * 10) / 10;
        creation.createdTime = creation.inMuseum ? 'On display in the Museum' : 'Welded & placed';
        state.pendingBuilds = state.pendingBuilds.filter(j => j.creation !== creation && j.creation.title !== creation.title);
        state.inventedCreations.unshift(creation);
        if (typeof bumpLifeStat === 'function') bumpLifeStat('builds');
        spawnEmergent3DObjectInWorld(creation, false);
        if (creation.inMuseum && typeof renderMuseum3D === 'function') renderMuseum3D();
        state.microPose = 'procedural_custom';
        state.moodTitle = `Placed ${title}`.slice(0, 80);
        state.speechBubble = `There. "${title}" is standing at ${destLabel} now.`;
        savePersistentBrainState();
        renderAllUI();
        showToast(`🏗️ Kelo-1 welded and placed "${title}"`);
        return true;
      } catch (err) {
        console.warn('Workshop job failed:', err);
        clearBenchWorkpiece();
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        // Dropped for good: off the pending list too, or every reload would run it (and fail) again
        state.pendingBuilds = (state.pendingBuilds || []).filter(j => j.creation !== creation);
        savePersistentBrainState();
        return true; // a failed job is dropped, not retried
      } finally {
        state.isBuilding = false;
      }
    }

window.addEventListener('DOMContentLoaded', () => {
  // After his state loads: pick up any builds he hadn't finished before the page closed
  setTimeout(() => {
    state.pendingBuilds = (state.pendingBuilds || []).filter(j => j && j.creation && j.creation.title).slice(0, 5);
    state.pendingBuilds.forEach(j => weldAndPlace(j.creation, j.placeLabel, true));
  }, 1500);
});
