// An older save (pre-farm, or a stage-1 farm) on the stage-2 code: no errors, his things kept, the mixed farm
// state filled in, and (for a stage-1 farm whose plan is done) the mixed-farm goal can start and take a step.
module.exports = async (page, h) => {
  await h.wait(7000);
  h.log('LOADED', JSON.stringify(await h.ev(() => ({ diary: state.diaryEntries.length, vehicles: state.vehicles.length, farmStarted: Boolean(state.farm.startedAt), farmKeys: Object.keys(state.farm).length,
    mixedKeys: Object.keys(farm2State()).length, mixedStarted: farm2Started(), ready: farm2Ready(), farmPlan: (agendaState().tasks.find(t => t.ref === 'farm:main') || {}).status || 'none',
    season: (agendaOpenTasks().find(t => t.kind === 'farmseason') || {}).title || null, fields: state.farm.fields.length, bins: farmBinSummary(),
    panel: (document.getElementById('farmBadge') || {}).textContent, panel2: (document.getElementById('farm2Panel') || {}).textContent.slice(0, 80), summary: farmSummaryForAI().slice(0, 200) }))));
  if (process.env.START2) {
    const t = await h.ev(() => { const t = farm2StartGoal('old save test'); return t && { title: t.title, steps: t.steps.length, goals: typeof goalsOpen === 'function' ? goalsOpen().map(g => g.title) : [] }; });
    h.log('START2', JSON.stringify(t));
    for (let i = 0; i < 12; i++) {
      const r = await h.ev(async () => { const t = agendaGet('farm:mixed'); const why = { farmBusy, busy: state.isBusy, prac: state.isPracticing, sleep: state.isSleeping }; state.isCollectingMail = false; state.isBusy = false; state.isPracticing = false; state.isSleeping = false; const out = await AGENDA_KINDS.farm2.resume(t); return { step: t.step, status: t.status, wait: t.waitingFor && t.waitingFor.label, out, why }; });
      h.log('STEP', JSON.stringify(r));
      if (r.step >= 2) break;
      await h.wait(8000);
    }
  }
  await h.ev(() => savePersistentBrainStateNow());
  await h.wait(5000);
};
