// Kelo-bot-1 — js/workshop.js
// Loaded after postoffice.js. Kelo-1 can decide to build anything, but everything is made at
// the welding table: he walks to the bench, welds the piece (you can watch it take shape),
// carries the finished piece to the spot he chose, and sets it down there.

const buildQueue = [];
let workshopRunning = false;
let benchWorkpiece = null;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Queue a creation; he works through builds one at a time
function weldAndPlace(creation, placeLabel = state.customPlaceName) {
      buildQueue.push({ creation, placeLabel: placeLabel || `(${creation.x}, ${creation.z})` });
      if (!workshopRunning) runWorkshop();
    }

async function runWorkshop() {
      workshopRunning = true;
      try {
        while (buildQueue.length > 0) {
          const job = buildQueue.shift();
          await runWeldJob(job.creation, job.placeLabel);
        }
      } finally {
        workshopRunning = false;
      }
    }

function showBenchWorkpiece(creation) {
      clearBenchWorkpiece();
      if (typeof buildCreationGroup !== 'function' || !scene) return;
      benchWorkpiece = buildCreationGroup(creation);
      const bx = -1.2, bz = -8.2;
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

async function runWeldJob(creation, destLabel) {
      state.isBuilding = true;
      const title = creation.title || 'something new';
      const dest = { x: clampNumber(creation.x, -32, 32, 0), z: clampNumber(creation.z, -32, 10, 0) };
      const bench = TOWN_LOCATIONS.weld;
      try {
        // 1. Walk to the welding table
        state.currentLocKey = 'custom';
        state.customPlaceName = bench.building;
        state.targetPos = { x: bench.x, z: bench.z };
        state.microPose = 'normal';
        state.speechBubble = `Heading to the welding table to make "${title}".`;
        state.changedLatelySummary = `Going to the welding table to build "${title}"`;
        renderAllUI();
        await waitForArrival(45000);

        // 2. Weld it; the piece grows on the bench while the sparks fly
        state.currentLocKey = 'weld';
        state.moodEmoji = '👨‍🏭';
        state.moodTitle = `Welding: ${title}`.slice(0, 80);
        state.speechBubble = `Welding "${title}" together, piece by piece.`;
        renderAllUI();
        showBenchWorkpiece(creation);
        const parts = Array.isArray(creation.parts) ? creation.parts.length : 4;
        const weldMs = Math.min(9000, 3500 + parts * 300);
        const started = Date.now();
        while (Date.now() - started < weldMs) {
          if (benchWorkpiece) benchWorkpiece.scale.setScalar(0.02 + 0.33 * Math.min(1, (Date.now() - started) / weldMs));
          await sleep(100);
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

        // 4. Set it down just in front of him so he isn't standing inside it
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        creation.x = Math.round(clampNumber(state.botPos.x + Math.sin(state.botRotY) * 1.7, -33, 33, dest.x) * 10) / 10;
        creation.z = Math.round(clampNumber(state.botPos.z + Math.cos(state.botRotY) * 1.7, -33, 11, dest.z) * 10) / 10;
        creation.createdTime = 'Welded & placed';
        state.inventedCreations.unshift(creation);
        if (typeof bumpLifeStat === 'function') bumpLifeStat('builds');
        spawnEmergent3DObjectInWorld(creation, false);
        state.microPose = 'procedural_custom';
        state.moodTitle = `Placed ${title}`.slice(0, 80);
        state.speechBubble = `There. "${title}" is standing at ${destLabel} now.`;
        savePersistentBrainState();
        renderAllUI();
        showToast(`🏗️ Kelo-1 welded and placed "${title}"`);
      } catch (err) {
        console.warn('Workshop job failed:', err);
        clearBenchWorkpiece();
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
      } finally {
        state.isBuilding = false;
      }
    }
