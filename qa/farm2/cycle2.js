// Stage 2 in fast time: a built stage-1 farm (farm1fast.js, or PRESAVE of a real stage-1 save) ->
// "Grow a mixed farm" plan (research, layout, buildings, pasture, machines, orchard, seed, animals) ->
// the mixed-farm year task, where he picks each chore himself. The test plays the owner (sends every list in
// full, delivers item requests, opens parcels) and moves the calendar when he waits. It never does his chores.
// PHASE=build|year|all; YEARS: how many calendar years of the year task to run before stopping.
const fs = require('fs'), path = require('path');
module.exports = async (page, h) => {
  const LIMIT_MIN = +process.env.LIMIT_MIN || 240, t0 = Date.now();
  const SNAP = process.env.SNAP || path.join(__dirname, 'snaps');
  fs.mkdirSync(SNAP, { recursive: true });
  page.setDefaultTimeout(0);
  await h.ev((FAST) => {
    window.farmFastFactor = FAST;
    state.fullness = 100; state.hydration = 100; state.health = 100;
    setInterval(() => { state.fullness = 100; state.hydration = 100; state.health = Math.max(state.health, 95); state.isSleeping = false; }, 2000);
  }, +process.env.FAST || 6);
  if (!process.env.PRESAVE) h.log('farm1', JSON.stringify(await require('./farm1fast')(h)));
  const snap = async (name) => {
    const data = await h.ev(() => { savePersistentBrainStateNow(); const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^kelo1/.test(k)) o[k] = localStorage.getItem(k); } return o; });
    fs.writeFileSync(path.join(SNAP, name + '.json'), JSON.stringify(data));
    h.log('snap', name);
  };
  const owner = () => h.ev(async () => {
    farmSendAllLists('Jeremiah');
    const reqs = state.requestsToUser.filter(r => !r.fulfilled && !r.declined && r.isToolRequest && r.requestedGear);
    for (const r of reqs) { r.fulfilled = true; r.userAnswer = r.requestedGear; postMail({ kind: 'request', from: 'Jeremiah', name: r.requestedGear, category: r.category, emoji: r.icon }); }
    let n = 0;
    while (state.mailbox.length) { const p = state.mailbox.shift(); await openParcel(p); n++; }
    const can = typeof fuelCanFor === 'function' ? fuelCanFor('diesel') : null;
    if (can) { state.isPracticing = false; state.isBusy = false; await refuelWith(can); }
    return n;
  });
  const status = () => h.ev(() => {
    const plan = agendaGet('farm:mixed') || agendaState().tasks.find(x => x.ref === 'farm:mixed');
    const yr = agendaOpenTasks().find(x => x.kind === 'farmmixed');
    const cur = yr || plan;
    const X = farm2State();
    return { kind: cur && cur.kind, step: cur && cur.step, label: cur && agendaStepLabel(cur), status: cur && cur.status, wait: cur && cur.waitingFor && cur.waitingFor.label, type: cur && cur.waitingFor && cur.waitingFor.type,
      day: Math.floor(farmDayNow()), doy: farmDayInfo(farmDayNow()).doy, year: worldNow().year, planDone: Boolean(plan && plan.status === 'done'), yearTask: yr && yr.title, chore: X.lastChore && X.lastChore.key, choreLabel: X.lastChore && X.lastChore.label };
  });
  const runStep = () => h.ev(async () => {
    const t = agendaOpenTasks().find(x => x.kind === 'farmmixed') || agendaGet('farm:mixed');
    if (!t) return 'none';
    if (t.status === 'waiting') return 'waiting';
    state.isCollectingMail = false; state.isBusy = false; state.isPracticing = false; state.isBuilding = false;
    if (t.status !== 'active') { t.status = 'active'; agendaState().focusId = t.id; }
    const p = AGENDA_KINDS[t.kind].resume(t);
    state.isCollectingMail = true;
    const r = await p;
    if ((r === false || r === null || typeof r === 'string') && t.status === 'active' && r !== 'waiting') return 'blocked:' + r;
    return String(r);
  });
  await h.ev(() => { const w = worldNow(); farmFastForward(((12 - w.hour + 24) % 24) / 24); farm2StartGoal('Test: grow a mixed farm'); });
  // JUMP_TO=year:doy skips ahead in 10-day chunks (for the orchard's bearing years). While skipped, the TEST
  // (not Kelo-1) keeps the bunk and the hen feeder filled and empties the tank and nest boxes, so the animals
  // live through it; produce made in the skipped days is thrown away. Logged as such.
  if (process.env.JUMP_TO) {
    const [ty, td] = process.env.JUMP_TO.split(':').map(Number);
    const r = await h.ev(([ty, td]) => {
      let n = 0;
      while ((worldNow().year < ty || (worldNow().year === ty && farmDayInfo(farmDayNow()).doy < td)) && n < 200) {
        const X = farm2State(), dem = farm2CattleDemand();
        X.bunk = dem.tmr * 11; X.feeder = X.flock.n * FARM_ANIMALS.hen.feedKg * 11; X.tankL = 0; X.tankDays = 0; X.flock.nestEggs = 0;
        X.herd.forEach(a => { if (a.sick) { a.sick = null; } });
        farmFastForward(10); n++;
      }
      const X = farm2State(); X.lastSell = Math.floor(farmDayNow());
      return { n, year: worldNow().year, doy: farmDayInfo(farmDayNow()).doy, herd: X.herd.length, hens: X.flock.n, age: farm2TreeAge('apple'), bearing: [farm2Bearing('apple'), farm2Bearing('cherry')] };
    }, [ty, td]);
    h.log('JUMPED (test fed the animals while skipping)', JSON.stringify(r));
  }
  const STEPDAYS = +process.env.STEPDAYS || 0.35;
  const STOPON = (process.env.STOPON || '').split(',').filter(Boolean);
  const seen = {}, chores = {};
  let last = '', same = 0, lastSnap = Date.now(), startYear = null;
  const YEARS = +process.env.YEARS || 1;
  while ((Date.now() - t0) / 60000 < LIMIT_MIN) {
    const s = await status();
    if (s.yearTask && startYear == null) startYear = s.year;
    const key = `${s.kind}:${s.step}:${s.status}:${s.wait}:${s.chore}`;
    if (key !== last) { h.log(`[${Math.round((Date.now() - t0) / 1000)}s] ${s.kind} step ${s.step} "${s.label}" ${s.status}${s.wait ? ' waiting: ' + s.wait : ''}${s.chore ? ' | last chore: ' + s.choreLabel : ''} (day ${s.day}, doy ${s.doy}, y${s.year})`); last = key; same = 0; } else same++;
    if (s.chore) { const ck = s.chore.split(':')[0]; if (!seen[s.chore + s.day]) chores[s.chore] = (chores[s.chore] || 0) + 1; chores[ck] = (chores[ck] || 0) + (seen[s.chore + s.day] ? 0 : 1); seen[s.chore + s.day] = 1; if (!seen['snap:' + ck]) { seen['snap:' + ck] = 1; await snap(`c-${String(Object.keys(chores).length).padStart(2, '0')}-${ck}`); } }
    const mk = `${s.kind}:${s.step}`;
    if (!seen[mk]) { seen[mk] = 1; await snap(`m-${String(Object.keys(seen).filter(k => k.includes(':') && !/\d$/.test(k) || /^farm/.test(k)).length).padStart(2, '0')}-${s.kind}-${s.step}`); }
    if (Date.now() - lastSnap > 8 * 60000) { lastSnap = Date.now(); await snap('latest'); }
    if (process.env.PHASE === 'build' && s.planDone) { h.log('PLAN DONE'); break; }
    if (startYear != null && s.year >= startYear + YEARS && s.doy > 300) { h.log('YEARS DONE'); break; }
    if (s.status === 'waiting') {
      await owner();
      if (s.type === 'skill') await h.ev(async () => { const v = state.vehicles.find(v => knowHowRule(v.name) && !state.knowHow[knowHowRule(v.name).key]); state.isBusy = false; state.isPracticing = false; if (v) await learnToUse(v.name); });
      if (['time', 'season', 'plant', 'weather'].includes(s.type)) await h.ev(type => farmFastForward(type === 'season' ? 5 : type === 'time' ? 0.5 : 1), s.type);
      await h.ev(() => { agendaTick(); });
      if (same > 500) { h.log('STUCK waiting', s.wait); break; }
      continue;
    }
    const r = await runStep();
    if (/blocked/.test(r)) { h.log('blocked', r); await owner(); await h.ev(() => farmFastForward(0.25)); }
    // between chores half a day passes (he would be doing many small things we don't drive here)
    if (s.yearTask) await h.ev(d => farmFastForward(d), STEPDAYS);
    if (STOPON.length && STOPON.every(k => chores[k])) { h.log('STOPON reached'); break; }
    if (same > 80) { h.log('STUCK at', key); break; }
  }
  await snap('final');
  const end = await h.ev(() => ({ status: farm2Status(), chores: null, log: farm2State().decisions.slice(0, 30).map(d => `d${d.day} ${d.text}`), farmlog: state.farm.log.slice(0, 40).map(l => l.text),
    diary: state.diaryEntries.filter(d => d.location === 'his farm').slice(0, 40).map(d => d.mood), lists: state.requestsToUser.filter(r => r.farm && /^mixed/.test(r.farmList || '')).map(r => `${r.title}: ${r.lines.length} lines`), summary: farm2SummaryForAI(),
    listings: ensureShop().listings.filter(l => l.kind === 'farmgoods').map(l => l.name + ' $' + l.price), earnings: state.farm.earnings }));
  end.chores = chores;
  h.log(JSON.stringify(end, null, 1));
  fs.writeFileSync(path.join(SNAP, 'result.json'), JSON.stringify(end, null, 1));
};
