// Puts a finished stage-1 farm into the page directly (site, land, the 8 buildings, machines, fields, a grain
// season with grain in the bins), so stage 2 can be developed and tested without the 2.5 h stage-1 cycle.
// The real stage-1 saves from qa/farm/cycle.js are used for the save-compatibility checks.
module.exports = (h, opts = {}) => h.ev((o) => {
  const F = farmState();
  const results = FARM_SITE_CANDIDATES.map(farmSurveySite);
  const best = results.filter(r => !r.problems.length).sort((a, b) => b.score - a.score)[0];
  const R = FARM_SITE_CANDIDATES.find(c => c.id === best.id);
  F.site = { ...R, y: best.y, surveyedAt: Date.now(), survey: results };
  F.surveyed = true; F.startedAt = Date.now() - 3600000;
  Object.keys(F.land).forEach(k => { F.land[k] = 1; });
  FARM_BUILD_ORDER.forEach(k => { F.buildings[k] = { stage: 'done', prog: 0 }; });
  // the machines (stage 1 lists): registered and learned, tanks full
  ['tractor', 'combine', 'truck'].forEach(k => { const v = registerVehicle(FARM_MACHINES[k].ask); });
  Object.keys(RW_GEAR).filter(k => RW_GEAR[k].kind === 'vehicle').forEach(k => registerVehicle(RW_GEAR[k].ask));
  state.vehicles.forEach(v => { v.fuel = 100; const r = knowHowRule(v.name); if (r) state.knowHow[r.key] = { at: Date.now(), learned: true }; });
  Object.keys(FARM_IMPLEMENTS).filter(k => !FARM_IMPLEMENTS[k].stage2).forEach(k => { F.owned[k] = { at: Date.now() }; });
  state.toolInventory.unshift('A gas-powered fence post driver', 'A framing kit: nail gun, compressor hose, chalk line, laser level');
  farmAdd('diesel', 6000); farmAdd('propane', 2000); farmAdd('sacks', 50); farmAdd('herbicide', 50); farmAdd('insecticide', 10);
  farmMakeFields();
  // the farm plan done, a season with grain in the bins (as after the first harvest)
  const t = farmStartGoal('test');
  agendaDone(t.id, 'test: farm built');
  F.bins = { wheat: { t: o.wheat ?? 1.4, m: 14.5 }, corn: { t: o.corn ?? 3.8, m: 15.5 }, canola: { t: 1.0, m: 9 } };
  F.harvests.unshift({ field: 'South field', crop: 'wheat', t: 1.9, ha: 0.78, tPerHa: 2.4, moisture: 17.9, day: Math.floor(farmDayNow()), year: worldNow().year });
  farmStartSeason('test');
  if (typeof farmGoalAdopt === 'function') farmGoalAdopt();
  farmInit3D();
  savePersistentBrainStateNow();
  return { site: F.site.id, buildings: Object.keys(F.buildings).length, vehicles: state.vehicles.map(v => v.name), fields: F.fields.length };
}, opts);
