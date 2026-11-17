// The whole farm in fast time: goal -> research -> survey -> land -> buildings -> machines -> inputs
// -> plough -> disc -> fertilize -> seed -> spray -> grow -> harvest -> dry -> sell/mill.
// The test plays the owner (sends every list in full, answers fuel requests) and moves the calendar.
const fs = require('fs'), path = require('path');
module.exports = async (page, h) => {
  const LIMIT_MIN = +process.env.LIMIT_MIN || 150, t0 = Date.now();
  const SNAP = process.env.SNAP || path.join(__dirname, 'snaps');
  fs.mkdirSync(SNAP, { recursive: true });
  page.setDefaultTimeout(0);
  await h.ev((FAST) => {
    window.farmFastFactor = FAST;
    state.fullness = 100; state.hydration = 100; state.health = 100;
    if (typeof plantWorkableScale !== 'undefined') plantWorkableScale = 8;
    // tests: keep his needs topped up so the farm isn't interrupted by meals and sleep
    setInterval(() => { state.fullness = 100; state.hydration = 100; state.health = Math.max(state.health, 95); state.isSleeping = false; }, 2000);
    window.__farmLog = [];
    const log = console.log;
    window.__flog = (s) => { window.__farmLog.push(s); log('[farm] ' + s); };
  }, +process.env.FAST || 6);
  const snap = async (name) => {
    const data = await h.ev(() => { savePersistentBrainStateNow(); const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^kelo1/.test(k)) o[k] = localStorage.getItem(k); } return o; });
    fs.writeFileSync(path.join(SNAP, name + '.json'), JSON.stringify(data));
    h.log('snap', name);
  };
  // The owner: send every farm list, deliver item requests (diesel, a tractor...), open the parcels
  const owner = () => h.ev(async () => {
    farmSendAllLists('Jeremiah');
    const reqs = state.requestsToUser.filter(r => !r.fulfilled && !r.declined && r.isToolRequest && r.requestedGear);
    for (const r of reqs) { r.fulfilled = true; r.userAnswer = r.requestedGear; postMail({ kind: 'request', from: 'Jeremiah', name: r.requestedGear, category: r.category, emoji: r.icon }); }
    let n = 0;
    while (state.mailbox.length) {
      const p = state.mailbox.shift();
      await openParcel(p);
      n++;
    }
    // fuel cans he just got: fill up the machines from them (js/knowhow.js refuelWith)
    const can = typeof fuelCanFor === 'function' ? fuelCanFor('diesel') : null;
    if (can) { state.isPracticing = false; state.isBusy = false; await refuelWith(can); }
    return n;
  });
  const status = () => h.ev(() => {
    const t = agendaGet('farm:main') || agendaState().tasks.find(x => x.ref === 'farm:main');
    const s = agendaOpenTasks().find(x => x.kind === 'farmseason');
    const cur = s || t;
    return { kind: cur && cur.kind, step: cur && cur.step, label: cur && agendaStepLabel(cur), status: cur && cur.status, wait: cur && cur.waitingFor && cur.waitingFor.label, type: cur && cur.waitingFor && cur.waitingFor.type,
      day: Math.floor(farmDayNow()), doy: farmDayInfo(farmDayNow()).doy, done: Boolean(t && t.status === 'done'), seasonDone: agendaState().tasks.some(x => x.kind === 'farmseason' && x.status === 'done') };
  });
  const runStep = () => h.ev(async () => {
    const t = agendaNextTask() || agendaOpenTasks().find(x => x.kind === 'farmseason' || x.kind === 'farm');
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
  await h.ev(() => { const w = worldNow(); farmFastForward(((12 - w.hour + 24) % 24) / 24); farmStartGoal('Test: build the farm'); });
  const shotsAt = {};
  let last = '', same = 0, lastSnap = Date.now();
  while ((Date.now() - t0) / 60000 < LIMIT_MIN) {
    const s = await status();
    const key = `${s.kind}:${s.step}:${s.status}:${s.wait}`;
    if (key !== last) { h.log(`[${Math.round((Date.now() - t0) / 1000)}s] ${s.kind} step ${s.step} "${s.label}" ${s.status}${s.wait ? ' waiting: ' + s.wait : ''} (day ${s.day}, doy ${s.doy})`); last = key; same = 0; } else same++;
    // milestones -> save snapshots for the screenshot pass
    const mk = `${s.kind}:${s.step}`;
    if (!shotsAt[mk]) { shotsAt[mk] = 1; await snap(`m-${String(Object.keys(shotsAt).length).padStart(2, '0')}-${s.kind}-${s.step}`); }
    if (Date.now() - lastSnap > 8 * 60000) { lastSnap = Date.now(); await snap('latest'); }
    if (s.seasonDone) { h.log('SEASON DONE'); break; }
    if (s.status === 'waiting') {
      const n = await owner();
      // (main only: the plan's wait on diesel can stall with no request open; the owner offers a can)
      if (process.env.ASKDIESEL && /diesel/.test(s.wait || '')) await h.ev(() => { if (typeof requestFuel === 'function') requestFuel('diesel', 'test owner'); });
      if (s.type === 'skill') {
        await h.ev(async () => { const v = state.vehicles.find(v => knowHowRule(v.name) && !state.knowHow[knowHowRule(v.name).key]); state.isBusy = false; state.isPracticing = false; if (v) await learnToUse(v.name); });
      }
      if (s.type === 'time' || s.type === 'season' || s.type === 'plant' || s.type === 'weather') {
        // move the calendar: a day at a time (a week for the season), the concrete and waits with it
        await h.ev(type => farmFastForward(type === 'season' ? 7 : type === 'plant' ? 3 : 1), s.type);
      }
      await h.ev(() => { agendaTick(); });
      if (same > 400) { h.log('STUCK waiting', s.wait); break; }
      continue;
    }
    const r = await runStep();
    if (/blocked/.test(r)) { h.log('blocked', r); await owner(); await h.ev(() => farmFastForward(0.25)); }
    if (same > 60) { h.log('STUCK at', key); break; }
  }
  await snap('final');
  const end = await h.ev(() => ({ farm: farmSummaryForAI(), harvests: state.farm.harvests, bins: state.farm.bins, flour: state.farm.flour, earnings: state.farm.earnings,
    listings: ensureShop().listings.filter(l => l.kind === 'farmgoods').map(l => l.name + ' $' + l.price), log: state.farm.log.slice(0, 40).map(l => l.text),
    diary: state.diaryEntries.filter(d => d.location === 'his farm' || /farm/i.test(d.mood)).slice(0, 30).map(d => d.mood), lists: state.requestsToUser.filter(r => r.farm).map(r => `${r.title}: ${r.lines.length} lines`) }));
  h.log(JSON.stringify(end, null, 1));
  fs.writeFileSync(path.join(SNAP, 'result.json'), JSON.stringify(end, null, 1));
};
