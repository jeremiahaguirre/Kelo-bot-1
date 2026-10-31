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
          p.x = TOWN.minX - 5 - (spot % 3) * 3;
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
