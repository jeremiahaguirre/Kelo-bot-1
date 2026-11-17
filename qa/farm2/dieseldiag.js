module.exports = async (page, h) => {
  await h.wait(4000);
  const dump = () => h.ev(() => ({ reqs: state.requestsToUser.filter(r => !r.fulfilled).map(r => [r.category, r.requestedGear, r.isToolRequest, r.title]).slice(0, 10), mail: state.mailbox.map(m => m.name),
    dozer: (rwGearOwned('dozer') || {}).fuel, can: (typeof fuelCanFor === 'function' && fuelCanFor('diesel')) || null, inv: state.toolInventory.filter(t => /diesel|fuel|jerry/i.test(t)), bel: state.belongings.filter(b => /diesel|fuel|jerry/i.test(b.name)).map(b => b.name),
    task: (agendaGet('farm:main') || {}).waitingFor, block: farmPlanBlocker(agendaGet('farm:main')) }));
  await h.ev(() => agendaTick()); h.log(JSON.stringify(await dump()));
  await h.ev(async () => { farmSendAllLists('J'); const reqs = state.requestsToUser.filter(r => !r.fulfilled && !r.declined && r.isToolRequest && r.requestedGear); for (const r of reqs) { r.fulfilled = true; postMail({ kind: 'request', from: 'J', name: r.requestedGear, category: r.category, emoji: r.icon }); } while (state.mailbox.length) await openParcel(state.mailbox.shift()); });
  h.log(JSON.stringify(await dump()));
  await h.ev(async () => { const can = fuelCanFor('diesel'); state.isPracticing = false; state.isBusy = false; if (can) { const r = await refuelWith(can); window.__rf = r; } });
  h.log('after refuel', JSON.stringify(await dump()), await h.ev(() => window.__rf));
};
