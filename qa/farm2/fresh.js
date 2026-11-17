// A stage-2 save made before the fresh-world reset: loads, the reset runs once, the farm (stage 1 and 2) comes back clean
module.exports = async (page, h) => {
  await h.wait(8000);
  h.log('AFTER', JSON.stringify(await h.ev(() => ({ stamp: localStorage.getItem('kelo1_fresh_world_2026_11_17'), farmStarted: Boolean(state.farm.startedAt), fields: state.farm.fields.length, mixedStarted: farm2Started(), mixed: { plots: farm2State().plots.length, herd: farm2State().herd.length, hens: farm2State().flock.n, planted: farm2State().orchard.planted },
    farmTasks: agendaState().tasks.filter(t => /^farm/.test(t.ref || '') || /^farm/.test(t.kind || '')).length, goals: (state.goals && state.goals.list || []).map(g => g.template), panel2: (document.getElementById('farm2Panel') || {}).textContent.slice(0, 60), vehicles: state.vehicles.length }))));
  await h.ev(() => farmStartGoal('fresh test'));
  await h.wait(2000);
  h.log('RESTART', JSON.stringify(await h.ev(() => ({ task: (agendaGet('farm:main') || {}).title, steps: ((agendaGet('farm:main') || {}).steps || []).length }))));
};
