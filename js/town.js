// Kelo-bot-1 — js/town.js
// Loaded after projects.js. The town (TOWN in agent.js) isn't Kelo-1's to build in. When his memory
// loads, anything he added there earlier is tidied away: art goes to his Museum, builds move out west,
// plantings, hills and holes in town are cleared, and trees he chopped in town grow back.
// The beach is his to use, so nothing there is touched.

function tidyTown() {
      const moved = [];
      state.inventedCreations.forEach(c => {
        if (!c.inMuseum && inTown(Number(c.x), Number(c.z))) {
          c.inMuseum = true;
          moved.push(`"${c.title}" to the Museum`);
        }
      });
      const plantingsBefore = state.plantings.length;
      state.plantings = state.plantings.filter(p => !inTown(p.x, p.z));
      if (state.plantings.length < plantingsBefore) moved.push('my flowers out of the town garden');
      const editsBefore = state.worldEdits.length;
      state.worldEdits = state.worldEdits.filter(e => e.type === 'road' || !inTown(e.x, e.z));
      if (state.worldEdits.length < editsBefore) moved.push('my changes to the ground in town');
      let spot = 0;
      state.projects.forEach(p => {
        if (p.status === 'built' && inTown(p.x, p.z)) {
          // (out past the Museum, the far west of the valley)
          p.x = (typeof MUSEUM !== 'undefined' ? MUSEUM.x - MUSEUM.w / 2 : TOWN.minX) - 4 - (spot % 3) * 3;
          p.z = -6 + Math.floor(spot / 3) * 3.5;
          spot++;
          moved.push(`the ${(typeof planFor === 'function' && planFor(p.key)?.name.toLowerCase()) || 'build'} out west`);
        }
      });
      const digsBefore = state.digSites.length;
      state.digSites = state.digSites.filter(d => !inTown(d.x, d.z));
      if (state.digSites.length < digsBefore) moved.push('filled in the holes I dug in town');
      if (moved.length) {
        state.diaryEntries.unshift({
          time: 'Tidying the Town', location: 'town', mood: '🏘️ Giving the town back',
          vitals: typeof needsVitalsText === 'function' ? needsVitalsText() : '',
          text: `Dear Diary, I realised the town isn't mine to build in, so I moved ${moved.slice(0, 6).join(', ')}. Out past the edge of town, and on the beach, there's room for anything I want to make.`
        });
      }
      return moved.length;
    }

// The town building (its walls' box, with pad round it) that holds x, z, or null
function townBuildingAt(x, z, pad = 0) {
      if (typeof worldObstacles === 'undefined') return null;
      return worldObstacles.find(o => o.building && o.hw !== undefined && !o.interior
        && Math.abs(x - o.x) < o.hw + pad && Math.abs(z - o.z) < o.hd + pad) || null;
    }

// The town was rebuilt at real size: a memory saved with him standing where a bigger building now
// stands (or inside one mid-visit) puts him back out at that building's door
function townMoveOutOfBuildings() {
      const keys = ['storehouse', ...Object.keys(typeof TOWN_BUILDINGS === 'object' ? TOWN_BUILDINGS : {})];
      const p = state.botPos;
      if (!p || state.riding) return false;
      const o = worldObstacles.find(b => keys.includes(b.building) && b.hw !== undefined && b.door
        && Math.abs(p.x - b.x) < b.hw + 0.3 && Math.abs(p.z - b.z) < b.hd + 0.3);
      if (!o) return false;
      state.botPos = { x: o.door.x, z: o.door.z };
      state.targetPos = { x: o.door.x, z: o.door.z };
      return true;
    }

// The map's layout changed (2026-11, MAP_LAYOUT in agent.js): the north row moved onto the valley floor
// the mountain's foot made room for, and Main Street runs in front of it. What stands there now:
function mapLayoutCovers(x, z, pad = 0) {
      const W = MAP_LAYOUT.weld, boxes = [
        typeof HOUSE !== 'undefined' ? [HOUSE.x, HOUSE.z, HOUSE.w / 2 + 0.8, HOUSE.d / 2 + 0.8] : null,
        typeof MUSEUM !== 'undefined' ? [MUSEUM.x, MUSEUM.z, MUSEUM.w / 2 + 0.8, MUSEUM.d / 2 + 0.8] : null,
        typeof STOREHOUSE !== 'undefined' ? [STOREHOUSE.x, STOREHOUSE.z, STOREHOUSE.w / 2 + 0.8, STOREHOUSE.d / 2 + 0.8] : null,
        [W.x - 0.4, W.z + 0.3, 4.2, 2.6]                // the welding studio, the printer bench and the work bench
      ].filter(Boolean);
      return boxes.some(([bx, bz, hw, hd]) => Math.abs(x - bx) < hw + pad && Math.abs(z - bz) < hd + pad);
    }

// An older save: Kelo-1 standing where a north-row building now stands goes out onto Main Street in
// front of it; upgrades he set up on what is now town (the old mountain foot behind the north row) move
// to the nearest open ground outside it. (Vehicles: reparkOldVehicles, js/vehicles.js; plantings, digs,
// edits, art and builds in town: tidyTown above; holes and piles under buildings: tidyEarthworksInBuildings.)
function mapLayoutMigrate() {
      let moved = 0;
      const p = state.botPos;
      if (p && !state.riding && mapLayoutCovers(p.x, p.z, 0.3)) {
        const front = { x: p.x, z: (typeof MAIN_STREET !== 'undefined' ? MAIN_STREET.z : -7.4) - 1.6 };
        state.botPos = { ...front };
        state.targetPos = { ...front };
        moved++;
      }
      (state.worldUpgrades || []).forEach(u => {
        if (!Number.isFinite(u.x) || !Number.isFinite(u.z) || !(inTown(u.x, u.z) || mapLayoutCovers(u.x, u.z, 1))) return;
        const spot = typeof openGroundNear === 'function' ? openGroundNear({ x: u.x, z: Math.min(u.z, TOWN.minZ - 4) }, 2, { offLimits: true }) : null;
        if (spot) { u.x = spot.x; u.z = spot.z; moved++; }
      });
      return moved;
    }

window.addEventListener('DOMContentLoaded', () => {
  // (after scene.js has built the town)
  setTimeout(() => {
    try { townMoveOutOfBuildings(); } catch (e) { console.warn('town: move out', e); }
    try { mapLayoutMigrate(); } catch (e) { console.warn('town: map layout', e); }
  }, 0);
});
