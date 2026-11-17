// From the end of the season: a website sale (the owner marks it sold), the grain truck hauls it out,
// a few days of farm-stand customers, then screenshots and draw calls
module.exports = async (page, h) => {
  await h.wait(3000);
  await h.ev(() => { window.farmFastFactor = 3; state.fullness = 100; state.hydration = 100; state.health = 100; const w = worldNow(); farmFastForward(((12.5 - w.hour + 24) % 24) / 24); });
  const before = await h.ev(() => ({ bins: JSON.stringify(state.farm.bins), earn: state.farm.earnings, shop: ensureShop().earnings, listings: ensureShop().listings.filter(l => l.kind === 'farmgoods').map(l => l.id + ' ' + l.name) }));
  h.log('before', JSON.stringify(before));
  await h.ev(() => { const l = ensureShop().listings.find(l => l.kind === 'farmgoods' && l.farm && l.farm.crop === 'corn'); markListingSold(l.id); });
  // the haul runs when he is free (doWhenFree): run it directly here, watched
  await h.ev(() => { state.isCollectingMail = false; state.isPracticing = false; state.isBusy = false; });
  // he has never driven the grain truck: he learns it at NetNode first (the real rule)
  h.log('learn', await h.ev(async () => { const v = farmMachineOf('truck'); const ok = await learnToUse(v.name); state.isBusy = false; state.isPracticing = false; return ok + ' ' + Boolean(state.knowHow.graintruck); }));
  h.log('haul check', JSON.stringify(await h.ev(() => { const v = farmMachineOf('truck'); return { busy: farmBusy, fuel: fuelLeft(v), diesel: farmStock('diesel'), tank: (state.farm.buildings.fueltank || {}).stage, reqs: state.requestsToUser.filter(r => !r.fulfilled && /diesel/i.test(r.requestedGear || '')).length }; })));
  // the owner answers his diesel request (the fuel rule): a bulk load for the farm tank comes on the next list
  await h.ev(async () => { await farmFuelUp(farmMachineOf('truck')); const reqs = state.requestsToUser.filter(r => !r.fulfilled && r.isToolRequest && /diesel/i.test(r.requestedGear || '')); for (const r of reqs) { r.fulfilled = true; postMail({ kind: 'request', from: 'Jeremiah', name: r.requestedGear, category: 'fuel' }); } while (state.mailbox.length) await openParcel(state.mailbox.shift()); const can = fuelCanFor('diesel'); state.isBusy = false; state.isPracticing = false; if (can) await refuelWith(can); });
  h.log('after fuel', JSON.stringify(await h.ev(() => ({ fuel: fuelLeft(farmMachineOf('truck')), busy: farmBusy }))));
  const r = h.ev(async () => { await farmHaulSale('corn', 3); return true; });
  await h.wait(45000);
  const tr = await h.ev(() => { const v = farmMachineOf('truck'); return v ? { x: v.x, z: v.z, riding: state.riding, load: state.farm.truckT } : null; });
  h.log('truck', JSON.stringify(tr));
  const p = await h.ev(() => state.botPos);
  await h.look(p.x - 12, 9, p.z + 14, p.x, 2, p.z); await h.wait(2000); await h.shot('sell-truck');
  await r;
  await h.ev(() => farmFastForward(4));
  await h.ev(() => farmStandTick());
  const after = await h.ev(() => ({ bins: JSON.stringify(state.farm.bins), flour: state.farm.flour, earn: state.farm.earnings, standSales: state.farm.stand.sales, shop: ensureShop().earnings, sold: state.farm.sold, diary: state.diaryEntries.slice(0, 6).map(d => d.mood + ': ' + d.text.slice(0, 160)), kitchen: state.belongings.filter(b => /flour/.test(b.name)).length }));
  h.log('after', JSON.stringify(after, null, 1));
  const S = await h.ev(() => farmSite());
  const yard = await h.ev(() => farmBuildingRect('bins'));
  await h.look(yard.x - 50, 30, yard.z + 70, yard.x, 6, yard.z); await h.wait(3000);
  h.log('yard calls', JSON.stringify(await h.ev(() => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }))));
  await h.shot('sell-yard');
  const st = await h.ev(() => farmBuildingRect('stand'));
  await h.look(st.x + 12, 5, st.z + 14, st.x, 1.5, st.z); await h.wait(2500); await h.shot('sell-stand');
};
