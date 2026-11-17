module.exports = async (page, h) => {
  page.setDefaultTimeout(0);
  h.log(JSON.stringify(await require('./farm1fast')(h)));
  await h.ev(() => { window.farmFastFactor = 6; farm2StartGoal('diag'); });
  for (let i = 0; i < 6; i++) {
    const r = await h.ev(async () => {
      const t = agendaGet('farm:mixed');
      const flags = { busy: state.isBusy, prac: state.isPracticing, build: state.isBuilding, sleep: state.isSleeping, mail: state.isCollectingMail, browse: state.isBrowsing, farmBusy };
      state.isCollectingMail = false; state.isBusy = false; state.isPracticing = false;
      const p = AGENDA_KINDS[t.kind].resume(t);
      const out = await Promise.race([p.then(v => 'done:' + v), new Promise(r => setTimeout(() => r('timeout'), 90000))]);
      return { out, flags, step: t.step, status: t.status, pos: state.botPos, target: state.targetPos, mood: state.moodTitle, known: jobKnown('mixedfarm') };
    });
    h.log(JSON.stringify(r));
  }
};
