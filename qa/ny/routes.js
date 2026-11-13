// Route probe: every land vehicle drives valley -> garage hall door -> hangar apron -> taxiway edge -> home
module.exports = async ({ ev, look, shot, page }) => {
  const names = (process.env.VEH || 'Dump truck|Pickup truck|Concrete mixer truck|Mountain bike|A crawler bulldozer with a six-way blade|A motor grader with a 14 ft moldboard|A single-drum vibratory soil compactor|A tandem vibratory asphalt roller|A tracked asphalt paver with a heated screed|Excavator').split('|');
  const speedup = +(process.env.SPEEDUP || 2.5);
  await ev(([names, speedup]) => {
    state.isPracticing = true; state.isBusy = true;
    state.knowHow = state.knowHow || {};
    names.forEach(n => { state.toolInventory.push(n); registerVehicle(n); });
    state.vehicles.forEach(v => { v.fuel = 100; v.wear = 0; });
    // know-how for each (readyToOperate is not used by driveVehicle, but keep it honest)
    window.__speedup = speedup;
    // Real speeds need more wall time under swiftshader (few frames a second): stretch the game's arrival timeouts instead
    if (+(window.__waitScale = speedup < 2 ? 8 : 1) > 1 && !window.__waitPatched) { const w = waitForArrival; window.__waitPatched = true; waitForArrival = t => w((t || 15000) * window.__waitScale); }
    VEHICLE_TYPES.forEach(t => { if (!t.__s) { t.__s = t.speed; t.speed *= speedup; } });
    if (typeof TRIP_TYPE_PICKUP !== 'undefined' && !TRIP_TYPE_PICKUP.__s) { TRIP_TYPE_PICKUP.__s = TRIP_TYPE_PICKUP.speed; TRIP_TYPE_PICKUP.speed *= speedup; }
  }, [names, speedup]);
  // keep frames cheap: the camera looks at the sky while he drives
  await ev(() => { state.cameraMode = 'none'; camera.position.set(60, 300, 60); if (controls) { controls.target.set(60, 600, 59); controls.update(); } });
  const vehicles = await ev(() => state.vehicles.map(v => ({ id: v.id, name: v.name, kind: v.kind, x: v.x, z: v.z, key: vehicleKindKey(v.name) })));
  console.log('vehicles', JSON.stringify(vehicles));
  const stops = await ev(() => {
    const hall = garageHallBays()[0].front, t = RUNWAY_FIELD.taxiway;
    return { hall: { x: hall.x, z: hall.z }, hangar: { x: 40, z: -147 }, taxiway: { x: t.maxX + 1, z: t.maxZ }, taxiIn: { x: 32, z: -165 } };
  });
  console.log('stops', JSON.stringify(stops));
  const results = [];
  for (const v of vehicles) {
    if (process.env.ONLYV && !new RegExp(process.env.ONLYV, 'i').test(v.name)) continue;
    const home = { x: v.x, z: v.z };
    const legs = [['hall', stops.hall], ['hangar', stops.hangar], ['taxiway', stops.taxiway], ['home', home]];
    const r = { name: v.name, key: v.key, legs: [] };
    // planner reachability and path stats for each leg, before driving
    for (const [label, to] of legs) {
      const from = r.legs.length ? legs[r.legs.length - 1][1] : home;
      const info = await ev(([id, from, to]) => {
        const veh = state.vehicles.find(x => x.id === id), save = { x: veh.x, z: veh.z };
        Object.assign(veh, from);
        const can = canDriveThere(veh, to), canTaxi = canDriveThere(veh, { x: 32, z: -165 });
        Object.assign(veh, save);
        const path = findPath(from, to), partial = currentPathPartial;
        let len = 0, onRoad = 0, prev = from, inBuilding = 0;
        const B = [GARAGE_HALL, NORTH_HANGAR];
        path.forEach(p => {
          const d = Math.hypot(p.x - prev.x, p.z - prev.z), n = Math.max(1, Math.ceil(d));
          for (let k = 1; k <= n; k++) {
            const x = prev.x + (p.x - prev.x) * k / n, z = prev.z + (p.z - prev.z) * k / n;
            if (onKeloRoad(x, z, 0.5)) onRoad += d / n;
            if (B.some(b => Math.abs(x - b.x) < b.w / 2 - 0.3 && Math.abs(z - b.z) < b.d / 2 - 0.3)) inBuilding++;
          }
          len += d; prev = p;
        });
        return { can, canTaxi, len: +len.toFixed(1), road: +(onRoad / Math.max(1, len)).toFixed(2), partial, inBuilding, pts: path.length };
      }, [v.id, from, to]);
      r.legs.push({ label, ...info });
    }
    // the real trips
    for (let i = 0; i < legs.length; i++) {
      const [label, to] = legs[i];
      const t0 = Date.now();
      const track = [];
      const iv = setInterval(async () => { try { track.push(await ev(() => ({ x: state.botPos.x, z: state.botPos.z, riding: state.riding }))); } catch (e) {} }, 700);
      await ev(id => { const veh = state.vehicles.find(x => x.id === id); veh.fuel = 100; veh.wear = 0; }, v.id);
      await ev(([id, to, label]) => { const veh = state.vehicles.find(x => x.id === id); const p = state.vehicles.find(x => x.id === id); state.botPos = state.botPos; return driveVehicle(veh, to, 'Probe: ' + label); }, [v.id, to, label]);
      clearInterval(iv);
      if (process.env.TRACK) console.log('track', label, JSON.stringify(track.map(p => [+p.x.toFixed(1), +p.z.toFixed(1), p.riding ? 1 : 0])), JSON.stringify(await ev(() => ({ mood: state.moodTitle, speech: state.speechBubble, target: state.targetPos }))));
      const end = await ev(id => { const veh = state.vehicles.find(x => x.id === id); return { x: veh.x, z: veh.z }; }, v.id);
      const want = await ev(to => runwayKeepOff(to), to);
      const miss = Math.hypot(end.x - want.x, end.z - want.z);
      const B = [[90, -127, 32, 26], [34, -128, 56, 32]];
      const inside = track.filter(p => p.riding && B.some(([bx, bz, bw, bd]) => Math.abs(p.x - bx) < bw / 2 - 0.5 && Math.abs(p.z - bz) < bd / 2 - 0.5)).length;
      const leg = r.legs[i];
      Object.assign(leg, { drove: { end, miss: +miss.toFixed(2), secs: Math.round((Date.now() - t0) / 1000), samples: track.length, insideBuilding: inside, arrived: miss < 3.5 } });
      console.log(v.name, label, JSON.stringify(leg));
      if (process.env.SHOTS && i === 0 && v.key === 'dump truck') { await look([end.x + 10, 8, end.z + 14], [end.x, 1, end.z]); await shot('route-truck-at-hall'); await ev(() => { camera.position.set(60, 300, 60); controls.target.set(60, 600, 59); controls.update(); }); }
    }
    results.push(r);
  }
  const fails = [];
  results.forEach(r => r.legs.forEach(l => { if (!(l.drove && l.drove.arrived) || l.inBuilding || (l.drove && l.drove.insideBuilding)) fails.push(`${r.name} ${l.label}`); if (!l.can && r.key !== 'excavator') fails.push(`${r.name} ${l.label} (planner says no)`); }));
  require('fs').writeFileSync(require('path').join(process.env.OUT || __dirname, 'routes.json'), JSON.stringify(results, null, 1));
  console.log('ROUTE FAILS', fails.length, JSON.stringify(fails));
};
