module.exports = async (page, h) => {
  await h.wait(6000);
  h.log(JSON.stringify(await h.ev(() => {
    const out = { started: farm2Started(), group: Boolean(farm2Group), inFarm: farm2Group && farm2Group.parent === farmGroup, planted: farm2State().orchard.planted, fenced: farm2State().pasture.fenced };
    try { farm2V.orchardSig = ''; farm2BuildOrchard(); out.orch = farm2V.orchard && farm2V.orchard.children.map(c => c.name + ':' + (c.count ?? c.children.length)); } catch (e) { out.err = e.message + ' ' + e.stack.split('\n')[1]; }
    try { farm2V.fenceSig = ''; farm2BuildFences(); out.fence = farm2V.fences && farm2V.fences.children.length; } catch (e) { out.err2 = e.message + ' ' + e.stack.split('\n')[1]; }
    try { farm2V.haySig = ''; farm2BuildHay(); } catch (e) { out.err3 = e.message; }
    out.anim = farm2V.anim && Object.fromEntries(Object.entries(farm2V.anim).map(([k, v]) => [k, v.body.count]));
    return out;
  })));
};
