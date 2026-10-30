import { readFileSync } from 'node:fs';
import { expect,it } from 'vitest';
import { MODEL } from '../models/modelConstants';
import { simulate,summarize } from '../models/simulation';
import { choosePosition } from '../models/optimizer';
it('audits only the supplied historical observations and records development validation',()=>{
  const rows=readFileSync(new URL('../data/historicalWaiting.csv',import.meta.url),'utf8').trim().split('\n').slice(1).map(line=>{const [time,w,r]=line.split(',');const [h,m]=time.split(':').map(Number);return {time,t:h*60+m,w:+w,r:r?+r:null};});
  expect(rows).toHaveLength(54);
  const post=rows.filter(r=>r.t>=712);
  const exposure=post.slice(1).reduce((s,r,i)=>s+(r.t-post[i].t)*(r.w+post[i].w-2)/2,0);
  expect(exposure).toBe(1518);expect(post[0].w-post.at(-1)!.w).toBe(25);
  expect(rows.find(r=>r.t===788)?.r).toBe(6);expect(rows.find(r=>r.t===786)?.r).toBe(4);
  expect(MODEL.servicePerMinute).toBe(23/86);
  const scenarios=simulate({total:10,rank:4,now:786});
  const positions=summarize(scenarios,{total:10,rank:4,now:786,target:810,tolerance:10});
  const starting=simulate({total:32,rank:24,now:712});
  const beforeSelfDefer=Array.from(starting.calls[0]).filter(t=>t<786).length/starting.iterations;
  console.log('Development-only validation:',JSON.stringify({otherTeamExposure:exposure,meanFieldTotalAt1318:1+(31+MODEL.servicePerMinute/MODEL.cancellationPerTeamMinute)*Math.exp(-MODEL.cancellationPerTeamMinute*86)-MODEL.servicePerMinute/MODEL.cancellationPerTeamMinute,pCallBefore1306From1152:beforeSelfDefer,recommended:choosePosition(positions,4),comparison:positions.map(p=>({rank:p.rank,mean:p.mean,median:p.median,p10:p.q10,p90:p.q90,success:p.success}))}));
});
