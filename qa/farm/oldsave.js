// Load an old (pre-farm) save on the farm branch: no errors, his things kept, an empty farm
module.exports = async (page, h) => {
  await h.wait(5000);
  h.log(JSON.stringify(await h.ev(() => ({ farm: Object.keys(farmState()), started: state.farm.startedAt, site: state.farm.site, diary: state.diaryEntries.length, vehicles: state.vehicles.length,
    panel: (document.getElementById('farmBadge') || {}).textContent, offFarm: offLimits(300, -300), offTown: offLimits(0, 0) }))));
  await h.ev(() => farmStartGoal('old save test'));
  await h.wait(2000);
  h.log(JSON.stringify(await h.ev(() => ({ task: (agendaGet('farm:main') || {}).title, steps: (agendaGet('farm:main') || {}).steps.length }))));
};
