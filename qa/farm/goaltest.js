module.exports = async (page, h) => {
  await h.wait(3000);
  h.log(JSON.stringify(await h.ev(() => ({ tpl: Boolean(GOAL_TEMPLATES.farm), act: Boolean(GOAL_ACTIONS.farmplan), stages: GOAL_TEMPLATES.farm && GOAL_TEMPLATES.farm.stages({}).map(s => s.name) }))));
  const g = await h.ev(() => { const g = goalStart('farm', { source: 'test' }); return g && { id: g.id, title: g.title, agendaId: g.agendaId }; });
  h.log('goal', JSON.stringify(g));
  // one step of the goal: it should start the farm plan (and its research step)
  await h.ev(async () => { state.isCollectingMail = false; state.isPracticing = false; const gg = goalById(window.__gid || goalsOpen()[0].id); const p = goalStep(gg); return p; });
  await h.wait(5000);
  h.log(JSON.stringify(await h.ev(() => ({ farmTask: (agendaGet('farm:main') || {}).title, step: (agendaGet('farm:main') || {}).step, goals: goalsOpen().map(g => [g.title, g.status, g.stage]), adoptDup: goalsOpen().filter(g => g.template === 'farm').length }))));
};
