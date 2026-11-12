// Kelo-bot-1 — js/agendalinks.js
// Loaded just before menuui.js, after every job file. Ties his existing long-running jobs to his agenda
// (js/agenda.js) without changing how each job works:
//   - project:  a real thing from a plan (js/projects.js): read up -> gather -> build
//   - build:    a big build from a bill of materials (js/assembly.js): one task, a step per sub-assembly
//   - painting: a painting he planned (js/paintstudio.js) that waits on its medium's supplies
//   - make:     a whole-shop order (js/shopmaker.js) that waits on the shop's supplies
//   - delivery: something he asked his human for that no other task is waiting on
// It also wraps the interruptions (eating, drinking, sleeping, a visitor's letter or chat) so the task
// he was on is paused and resumed afterwards, and builds tasks from what older saves were in the middle of.

const agendaReSource = escapeRegExp;
function agendaPlainAsk(s) { return String(s || '').replace(/^(an?|some|the)\s+/i, '').toLowerCase(); }

// --- Interruptions -----------------------------------------------------------------------------------
function agendaWrapInterrupt(name, reason) {
      const orig = window[name];
      if (typeof orig !== 'function' || orig.agendaWrapped) return;
      const wrapped = async function (...args) {
        const t = agendaInterrupt(reason);
        try { return await orig.apply(this, args); }
        finally { if (t && !state.isSleeping) agendaResumeAfter(reason); }
      };
      wrapped.agendaWrapped = true;
      window[name] = wrapped;
    }
agendaWrapInterrupt('eatSomething', 'a bite to eat');
agendaWrapInterrupt('eatStoredFood', 'a bite to eat');
agendaWrapInterrupt('drinkFromLake', 'a drink');
agendaWrapInterrupt('goToSleep', 'sleep');
agendaWrapInterrupt('processNextUnopenedVisitorNote', "a visitor's letter");
agendaWrapInterrupt('handleVisitorChatMessage', 'a visitor');
agendaWrapInterrupt('warmUpByFire', 'warming up by the fire');

// --- project: a real thing from a plan --------------------------------------------------------------------
const AGENDA_PROJECT_STEPS = ['Read how it is built', 'Gather the materials and tools', 'Build it at the bench', 'Set it out'];
function agendaProjectWants(plan) {
      const miss = missingFor(plan);
      return [...miss.materials.map(m => ({ ask: m.ask, re: m.re })), ...miss.tools.map(k => ({ ask: BUILD_TOOLS[k].ask, re: BUILD_TOOLS[k].re }))];
    }
function agendaTrackProject(p, quiet = false) {
      const plan = p && planFor(p.key);
      if (!plan || p.status !== 'gathering') return null;
      const t = agendaAdd({ ref: 'project:' + p.id, kind: 'project', title: `Build a ${plan.name.toLowerCase()}`, emoji: plan.emoji,
        why: 'A real thing from a real plan', steps: AGENDA_PROJECT_STEPS, step: 1, priority: 3, data: { projectId: p.id }, quiet });
      const wants = agendaProjectWants(plan);
      if (wants.length) agendaWait(t.id, { type: 'delivery', label: wants.map(w => agendaPlainAsk(w.ask)).slice(0, 4).join(', '), items: wants.map(w => w.re.source) }, quiet ? 'Waiting for the last of it.' : '');
      else if (t.status === 'waiting') agendaReady(t.id);
      return t;
    }
if (typeof planFor === 'function') {
  agendaRegisterKind('project', {
    label: 'a build from a plan',
    check: t => {
      const p = state.projects.find(q => q.id === t.data.projectId);
      if (!p || p.status !== 'gathering') return true;
      const wants = agendaProjectWants(planFor(p.key));
      return wants.length ? { waitingFor: { type: 'delivery', label: wants.map(w => agendaPlainAsk(w.ask)).slice(0, 4).join(', '), items: wants.map(w => w.re.source) } } : true;
    },
    resume: async t => {
      const p = state.projects.find(q => q.id === t.data.projectId);
      if (!p) { agendaAbandon(t.id, 'the plan is gone from my list of projects'); return true; }
      if (p.status === 'built') { agendaDone(t.id); return true; }
      const wants = agendaProjectWants(planFor(p.key));
      if (wants.length) { agendaTrackProject(p); return 'waiting'; }
      agendaStep(t.id, 2);
      const r = await buildProject(p.id, 'Back to My Project');
      return r === true ? true : r;
    },
    migrate: () => (state.projects || []).filter(p => p.status === 'gathering').forEach(p => agendaTrackProject(p, true))
  });
  const agendaOrigStartProject = startProject;
  startProject = async function (key, originLabel) {
      const r = await agendaOrigStartProject(key, originLabel);
      if (r === true) agendaTrackProject(activeProject());
      return r;
    };
  const agendaOrigBuildProject = buildProject;
  buildProject = async function (id, originLabel) {
      const t = agendaGet('project:' + id);
      if (t) agendaStep(t.id, 2);
      const r = await agendaOrigBuildProject(id, originLabel);
      const p = state.projects.find(q => q.id === id);
      if (t && p && p.status === 'built') { agendaStep(t.id, 3); agendaDone(t.id, `I built the ${planFor(p.key).name.toLowerCase()} and set it out. Every material on the list went into it.`); }
      return r;
    };
}

// --- build: a big build from a bill of materials ------------------------------------------------------------
function agendaTrackBuild(p, quiet = false) {
      if (!p || !p.bom || !['gathering', 'testing', 'complete'].includes(p.status)) return null;
      const steps = ['Research and write the parts list', ...p.bom.subs.map(s => `Build the ${String(s.name).toLowerCase()}`).slice(0, 14), 'Inspect and test it', 'Finish it'];
      const t = agendaAdd({ ref: 'build:' + p.id, kind: 'build', title: `Build a ${String(p.bom.name).toLowerCase()}`, emoji: p.bom.emoji || '🛠️',
        why: String(p.why || '').slice(0, 160), steps, step: 1, priority: 3, data: { buildId: p.id }, quiet });
      agendaSyncBuild(t, p);
      return t;
    }
function agendaSyncBuild(t, p) {
      const built = p.bom.subs.filter(s => s.built).length;
      const step = p.status === 'testing' ? t.steps.length - 2 : p.status === 'complete' ? t.steps.length - 1 : Math.min(t.steps.length - 3, 1 + built);
      if (step !== t.step) { t.step = step; t.updatedAt = Date.now(); }
    }
if (typeof activeBuild === 'function') {
  agendaRegisterKind('build', {
    label: 'a big build',
    check: t => {
      const p = buildProjectById(t.data.buildId);
      if (!p || p.status === 'done' || p.status === 'abandoned' || p.status === 'flown') return true;
      agendaSyncBuild(t, p);
      if (p.status !== 'gathering') return true;
      const sub = nextSubToBuild(p);
      if (!sub) return true;
      const rd = subReadiness(p, sub);
      return rd.ok ? true : { waitingFor: { type: 'delivery', label: `the parts for the ${String(sub.name).toLowerCase()} (my parts list)` } };
    },
    resume: async t => {
      const p = buildProjectById(t.data.buildId);
      if (!p || p.status === 'abandoned') { agendaAbandon(t.id, 'that build is no longer on my bench'); return true; }
      if (!['gathering', 'testing', 'complete'].includes(p.status)) { agendaDone(t.id, `The ${String(p.bom.name).toLowerCase()} is finished.`); return true; }
      if (activeBuild() !== p) return 'waiting';
      const work = assemblyWork();
      if (!work) { agendaWait(t.id, { type: 'delivery', label: 'the next parts kit from my list' }); return 'waiting'; }
      agendaSyncBuild(t, p);
      const r = await work();
      agendaSyncBuild(t, p);
      if (!['gathering', 'testing', 'complete'].includes(p.status)) agendaDone(t.id, `The ${String(p.bom.name).toLowerCase()} is finished: every sub-assembly built and every test passed.`);
      return r;
    },
    migrate: () => (state.buildProjects || []).forEach(p => agendaTrackBuild(p, true))
  });
  const agendaOrigResearchBuild = researchBuild;
  researchBuild = async function (...args) {
      const r = await agendaOrigResearchBuild.apply(this, args);
      const p = activeBuild();
      if (p) agendaTrackBuild(p);
      return r;
    };
}

// --- painting: a planned painting waiting on its supplies ----------------------------------------------------
function agendaTrackPainting(quiet = false) {
      const plan = state.paintPlan;
      if (!plan || typeof PAINT_MEDIA === 'undefined' || !PAINT_MEDIA[plan.medium]) return null;
      const t = agendaAdd({ ref: 'paint:' + (plan.at || 0), kind: 'painting', title: `Paint ${plan.subject ? `the ${plan.subject}` : 'a picture'} in ${plan.medium}`, emoji: '🎨',
        why: plan.for ? `${plan.for} asked for it` : 'A painting I planned', steps: ['Learn the medium', 'Get the supplies', 'Paint it'], step: paintKnows(plan.medium) ? 1 : 0, priority: plan.for ? 4 : 2, data: { at: plan.at }, quiet });
      return t;
    }
if (typeof paintPlanTick === 'function') {
  agendaRegisterKind('painting', {
    label: 'a planned painting',
    check: t => {
      const plan = state.paintPlan;
      if (!plan || plan.at !== t.data.at) return true;
      const miss = paintKnows(plan.medium) ? paintMissing(plan.medium) : [];
      return miss.length ? { waitingFor: { type: 'supply', label: miss.map(n => agendaPlainAsk(n.ask || n.label || 'paint supplies')).slice(0, 3).join(', '), items: miss.map(n => n.re.source) } } : true;
    },
    resume: async t => {
      const plan = state.paintPlan;
      if (!plan || plan.at !== t.data.at) {
        if (t.data.painted) agendaDone(t.id); else agendaAbandon(t.id, 'I waited two days for the paint supplies and let that painting go; I will paint something else');
        return true;
      }
      if (paintKnows(plan.medium) && paintMissing(plan.medium).length) return 'waiting';
      agendaStep(t.id, paintKnows(plan.medium) ? 2 : 0);
      return paintPlanTick();
    },
    migrate: () => agendaTrackPainting(true)
  });
  const agendaOrigPaintPicture = paintPicture;
  paintPicture = async function (...args) {
      const plan = state.paintPlan;
      const t = plan && agendaGet('paint:' + (plan.at || 0));
      const r = await agendaOrigPaintPicture.apply(this, args);
      if (t && r === true) { t.data.painted = true; agendaDone(t.id, `I painted it, start to finish, with real ${plan.medium} paint.`); }
      return r;
    };
  setInterval(() => { if (state.paintPlan && !agendaGet('paint:' + (state.paintPlan.at || 0))) agendaTrackPainting(); }, 15000);
}

// --- make: a whole-shop order waiting on supplies ------------------------------------------------------------
function agendaTrackMake(o, quiet = false) {
      if (!o || o.status === 'done') return null;
      return agendaAdd({ ref: 'make:' + o.id, kind: 'make', title: `Make ${typeof wsWhat === 'function' ? wsWhat(o.name) : o.name}`.slice(0, 80), emoji: '🛠️',
        why: o.visitor ? `${o.visitor} asked for it` : o.from ? `I read about ${o.from}` : 'Something to make in my Workshop',
        steps: ['Learn the shop', 'Get its supplies', 'Make it'], step: o.status === 'learning' ? 0 : o.status === 'ready' || o.status === 'making' ? 2 : 1, priority: o.visitor ? 4 : 3, data: { orderId: o.id }, quiet });
    }
if (typeof makerAdvance === 'function') {
  agendaRegisterKind('make', {
    label: 'a Workshop order',
    check: t => {
      const o = makerState().makerOrders.find(x => x.id === t.data.orderId);
      if (!o || o.status === 'done' || o.status === 'ready') return true;
      if (o.status === 'waiting' && (o.waitingFor || []).length) return { waitingFor: { type: 'supply', label: `supplies for my ${makerShopName(o.shop)}: ${o.waitingFor.slice(0, 3).join(', ')}` } };
      return o.status === 'learning' ? { waitingFor: { type: 'skill', label: `learning my ${makerShopName(o.shop)}` } } : true;
    },
    resume: async t => {
      const o = makerState().makerOrders.find(x => x.id === t.data.orderId);
      if (!o) { agendaAbandon(t.id, 'the order fell off my list'); return true; }
      if (o.status === 'done') { agendaDone(t.id); return true; }
      const st = makerAdvance(o);
      if (st !== 'ready') return 'waiting';
      agendaStep(t.id, 2);
      const r = await makerRunOrder(o.id);
      if (o.status === 'done') agendaDone(t.id, `I made ${wsWhat(o.name)} on my ${makerShopName(o.shop)}, using up its supplies.`);
      return r;
    },
    migrate: () => makerState().makerOrders.filter(o => o.status !== 'done').forEach(o => agendaTrackMake(o, true))
  });
  const agendaOrigMakerStartOrder = makerStartOrder;
  makerStartOrder = function (...args) {
      const o = agendaOrigMakerStartOrder.apply(this, args);
      if (o) agendaTrackMake(o);
      return o;
    };
}

// --- delivery: something he asked for that no other task covers ----------------------------------------------
function agendaTrackDelivery(req, quiet = false) {
      if (!req || req.fulfilled || req.category === 'bomlist' || req.category === 'joblist') return null;
      // A task he is working on already waits for it: it rides along with that one
      const focus = agendaFocus();
      if (focus && focus.kind !== 'delivery') {
        focus.data.reqIds = [...new Set([...(focus.data.reqIds || []), req.id])].slice(-30);
        return focus;
      }
      const what = req.requestedGear || req.title || 'something';
      return agendaAdd({ ref: 'req:' + req.id, kind: 'delivery', title: `Get ${agendaPlainAsk(what)}`.slice(0, 80), emoji: req.icon || '📮',
        why: String(req.question || '').replace(/Could you bring me.*$/i, '').trim().slice(0, 160), steps: ['Ask for it', 'Wait for it to arrive', 'Pick it up at the Post Office'], step: 1, priority: 2,
        waitingFor: { type: req.category === 'code' ? 'owner' : 'delivery', label: req.category === 'code' ? `my human to code "${String(req.title || what).slice(0, 50)}"` : `${agendaPlainAsk(what)} from my human`, reqIds: [req.id], items: req.requestedGear ? [agendaReSource(req.requestedGear)] : [] },
        data: { reqId: req.id }, quiet });
    }
agendaRegisterKind('delivery', {
  label: 'a delivery',
  check: t => {
    const req = (state.requestsToUser || []).find(r => r.id === t.data.reqId);
    if (!req) return true;
    if (req.declined) return true;
    if (!req.fulfilled) return false;
    if (!req.requestedGear) return true;
    return agendaItemsOwned([agendaReSource(req.requestedGear)]) || agendaItemsAtPostOffice([agendaReSource(req.requestedGear)]);
  },
  resume: async t => {
    const req = (state.requestsToUser || []).find(r => r.id === t.data.reqId);
    if (!req) { agendaDone(t.id, 'That request was settled.'); return true; }
    if (req.declined) { agendaAbandon(t.id, `my human said no to ${agendaPlainAsk(req.requestedGear || req.title)}, so I'll make do without it`); return true; }
    const src = req.requestedGear ? [agendaReSource(req.requestedGear)] : [];
    if (!req.requestedGear || agendaItemsOwned(src)) { agendaDone(t.id, `${req.requestedGear ? req.requestedGear.replace(/^./, c => c.toUpperCase()) : 'It'} arrived and is mine now.`); return true; }
    if (agendaItemsAtPostOffice(src) && typeof pickUpMail === 'function') { agendaStep(t.id, 2); return pickUpMail('Picking Up What I Asked For'); }
    agendaWait(t.id, { type: 'delivery', label: `${agendaPlainAsk(req.requestedGear)} from my human`, reqIds: [req.id], items: src });
    return 'waiting';
  },
  migrate: () => (state.requestsToUser || []).filter(r => !r.fulfilled && r.category !== 'bomlist' && r.category !== 'joblist' && r.category !== 'question').slice(0, 12).forEach(r => {
    if (r.isToolRequest || r.category === 'code') agendaTrackDelivery(r, true);
  })
});
{
  const agendaOrigAddItemRequest = addItemRequest;
  addItemRequest = function (item, category, why, context) {
      const before = state.requestsToUser[0];
      const r = agendaOrigAddItemRequest(item, category, why, context);
      const req = state.requestsToUser[0];
      if (req && req !== before && req.requestedGear === item) agendaTrackDelivery(req);
      return r;
    };
}
