const f=process.argv.slice(2);
for(const n of f){const r=require('./'+n);const P=r.per.filter(p=>p.day<2);
const s=k=>P.reduce((a,p)=>a+p[k],0);
console.log(n.padEnd(28),'days',P.length,'| acts/day',(s('activities')/P.length).toFixed(1),'| distinct kinds/day',(s('distinctActivities')/P.length).toFixed(1),'| longest same-activity run',Math.max(...P.map(p=>p.longestSameActivityRun)),
'| diary/day',(s('diary')/P.length).toFixed(1),'| distinct diary %',(100*s('distinctDiary')/s('diary')).toFixed(0),'| worst line repeats/day',Math.max(...P.map(p=>p.topDiaryRepeats)),
'| goals done',r.goals.history.filter(h=>h.status==='done').length,'open',r.goals.open.length,'| agenda done',r.agendaDone,'| errors',r.errors.length,'| ai calls',r.aiCalls);}
