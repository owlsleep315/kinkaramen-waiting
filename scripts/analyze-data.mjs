import { readFileSync } from 'node:fs';
const rows = readFileSync(new URL('../src/data/historicalWaiting.csv', import.meta.url), 'utf8').trim().split('\n').slice(1).map(line => { const [time,total,rank,...note]=line.split(','); const [h,m]=time.split(':').map(Number); return {time,t:60*h+m,total:+total,rank:rank ? +rank:null,note:note.join(',')}; });
const post = rows.filter(r => r.t >= 712);
let exposure=0;
for(let i=1;i<post.length;i++) exposure += (post[i].t-post[i-1].t)*(post[i].total+post[i-1].total-2)/2;
const pre=rows.filter(r=>r.t<712);
const positiveDeltas=pre.slice(1).reduce((s,r,i)=>s+Math.max(0,r.total-pre[i].total),0);
console.log(JSON.stringify({observations:rows.length,postClosure:{durationMinutes:86,netDecrease:25,netMinutesPerTeam:86/25,rankDecreaseBeforeOwnDefer:20,rankMinutesPerStep:74/20,otherTeamExposureMinutes:exposure,explicitCancellations:2,assumedCancellationHazard:2/exposure,assumedServiceRate:23/86},preClosure:{positiveObservedIncrements:positiveDeltas,observedMinutes:71,lowerBoundArrivalRate:positiveDeltas/71},note:'Counts do not identify latent events. Constants are fixed assumptions, not maximum likelihood estimates.'},null,2));
