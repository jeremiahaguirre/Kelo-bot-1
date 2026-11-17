module.exports = async (page, h) => {
  await h.wait(6000);
  h.log(JSON.stringify(await h.ev(() => ({ mixed: Object.keys(farm2State()), ready: farm2Ready(), started: farm2Started(), tpl: typeof GOAL_TEMPLATES !== 'undefined' && Boolean(GOAL_TEMPLATES.farm2), kinds: ['farm2', 'farmmixed'].map(k => Boolean(AGENDA_KINDS[k])), crops: Object.keys(FARM_CROPS).length, impl: Object.keys(FARM_IMPLEMENTS).length, m1lines: (function () { try { return farmMachineListLines().length; } catch (e) { return 'n/a ' + e.message; } })() }))));
};
