// Kelo-bot-1 — js/takeout.js
// Loaded after viewer.js. Things don't have to stay put away: Kelo-1 can take a sculpture or a
// painting back out of his Museum, either to stand it out in the valley again or to throw it in the
// Disposal Pit, and take anything off his Storehouse shelves to use it or throw it out (the
// Storehouse side uses fetchFromStorehouse and disposeItem, which already go down to the basements).
// The visitor can suggest either from the shelf viewer; he does it when he's free.

// A sculpture or painting in the Museum, matched by its title or painted words
function findMuseumPiece(name) {
      const want = String(name || '').trim().toLowerCase().replace(/^["']|["']$/g, '');
      if (!want) return null;
      const sculpture = allMuseumSculptures().find(c => String(c.title || '').toLowerCase() === want);
      if (sculpture) return { kind: 'sculpture', piece: sculpture, label: sculpture.title };
      const painting = allMuseumPaintings().find(m => String(m.text || '').toLowerCase() === want);
      if (painting) return { kind: 'painting', piece: painting, label: `"${painting.text}" painting` };
      return null;
    }

// Which floor of the Museum a piece is on (0 is the ground floor)
function museumFloorOf(found) {
      const list = found.kind === 'sculpture' ? allMuseumSculptures() : allMuseumPaintings();
      const per = (found.kind === 'sculpture' ? MUSEUM_PLINTHS.length : MUSEUM_FRAMES.length) || 8;
      return Math.floor(list.indexOf(found.piece) / per);
    }

// purpose: 'display' (stand it out in the valley again) or 'dispose' (throw it in the pit)
async function takeOutOfMuseum(name, purpose = 'display', why = '', originLabel = 'Rearranging the Museum') {
      const found = findMuseumPiece(name);
      if (!found || state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      if (purpose === 'display' && found.kind === 'painting') purpose = 'dispose'; // paintings only hang indoors
      state.isPracticing = true;
      try {
        state.currentLocKey = 'museum';
        state.customPlaceName = null;
        state.targetPos = { ...MUSEUM_DOOR };
        state.moodEmoji = '🏛️';
        state.moodTitle = `Fetching ${found.label} from the Museum`.slice(0, 80);
        renderAllUI();
        await waitForArrival(90000);
        const floor = museumFloorOf(found);
        if (floor > 0) await visitBasement(museumHatchWorld(), floor, found.label);
        // Off its plinth or wall and into his arms
        const carried = found.kind === 'sculpture' ? buildCreationGroup(found.piece) : null;
        if (found.kind === 'sculpture') {
          state.inventedCreations = state.inventedCreations.filter(c => c !== found.piece);
        } else {
          state.murals = state.murals.filter(m => m !== found.piece);
        }
        renderMuseum3D();
        if (carried && typeof setCarriedObject === 'function') setCarriedObject(lifeSize(carried, 1.4));
        if (purpose === 'dispose') {
          state.moodTitle = `Taking ${found.label} to the Disposal Pit`.slice(0, 80);
          renderAllUI();
          await travelTo(PIT_EDGE, 'Taking it out to the Disposal Pit');
          if (typeof setCarriedObject === 'function') setCarriedObject(null);
          const thrown = found.kind === 'sculpture' ? lifeSize(buildCreationGroup(found.piece), 1.4) : new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.06), new THREE.MeshStandardMaterial({ color: 0xb8860b }));
          await dropIntoPit(thrown, { x: state.botPos.x, y: getIslandGroundHeight(state.botPos.x, state.botPos.z) + 1.1, z: state.botPos.z });
          state.disposedItems.unshift({ name: found.label, at: Date.now(), why: String(why).slice(0, 160) });
          state.speechBubble = `I let ${found.label} go. Making it was the important part.`;
        } else {
          // Out past the edge of town, where it can stand in the open again
          const spot = typeof buildSpot === 'function' ? buildSpot() : { x: TOWN.minX - 6, z: 0 };
          state.targetPos = { x: spot.x - 1.6, z: spot.z };
          state.moodTitle = `Carrying ${found.label} out into the valley`.slice(0, 80);
          renderAllUI();
          await waitForArrival(90000);
          if (typeof setCarriedObject === 'function') setCarriedObject(null);
          Object.assign(found.piece, { inMuseum: false, x: spot.x, z: spot.z, createdTime: 'Back out in the valley' });
          state.inventedCreations.unshift(found.piece);
          spawnEmergent3DObjectInWorld(found.piece, false);
          state.speechBubble = `${found.label} gets some fresh air out here. It looks different in the open.`;
        }
        state.diaryEntries.unshift({
          time: originLabel, location: purpose === 'dispose' ? 'the Disposal Pit' : 'the valley', mood: purpose === 'dispose' ? `🗑️ Let go of ${found.label}` : `🏛️ Took ${found.label} out`,
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I took ${found.label} out of my Museum ${purpose === 'dispose' ? 'and threw it in the Disposal Pit' : 'and stood it out in the valley again'}. ${why}`.trim()
        });
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        if (typeof setCarriedObject === 'function') setCarriedObject(null);
        state.isPracticing = false;
      }
    }

// Take something off the Storehouse shelves to use it: he fetches it and does what fits
async function takeOutToUse(name, why = '') {
      const item = findOwnedName(name);
      if (!item) return false;
      const hobby = state.hobbies.find(h => h.tool === item) || (typeof hobbyForItem === 'function' && hobbyForItem(item) ? findHobby(hobbyForItem(item).name) : null);
      if (hobby && typeof practiceHobby === 'function') return practiceHobby(hobby, 'Took It Out to Use');
      const telescope = /telescope/i.test(item) && typeof stargaze === 'function';
      if (telescope) return stargaze('Took It Out to Use');
      // Otherwise he fetches it and decides for himself what to do with it
      if (state.isBusy || state.isBuilding || state.isPracticing) return false;
      state.isPracticing = true;
      try { if (typeof fetchFromStorehouse === 'function') await fetchFromStorehouse(item); } finally { state.isPracticing = false; }
      return decideNextAction(`You just took the ${item} off your Storehouse shelf${why ? ` (${why})` : ''}. Use it however you like.`, 'Took Something Out', { focus: item });
    }
