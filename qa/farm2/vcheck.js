module.exports = async (page, h) => {
  await h.wait(4000);
  h.log(JSON.stringify(await h.ev(() => {
    const names = [...Object.values(FARM_IMPLEMENTS).filter(I => I.stage2).map(I => I.ask), ...farm2MachineListLines().filter(l => l.fk === 'tool').map(l => l.name), ...farm2BuildListLines().filter(l => l.fk === 'tool').map(l => l.name), ...Object.values(FARM_ANIMALS).map(a => a.ask), FARM_MACHINES.compact.ask];
    return names.map(n => [n.slice(0, 50), (vehicleTypeFor(n) || {}).kind || null, (knowHowRule(n) || {}).key || null]);
  })));
};
