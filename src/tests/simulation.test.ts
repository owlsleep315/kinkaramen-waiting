import { describe,expect,it } from 'vitest';
import { MODEL } from '../models/modelConstants';
import { createSimulation,simulate,summarize } from '../models/simulation';
const input={total:10,rank:4,now:786,iterations:10_000,seed:20261029};
const baseline=simulate(input);
const summary=summarize(baseline,{...input,target:810,tolerance:10});
describe('fixed seeded event simulation',()=>{
  it('is reproducible',()=>expect(simulate({...input,iterations:150}).calls).toEqual(simulate({...input,iterations:150}).calls));
  it('uses common scenarios and moving back never advances call time',()=>{
    for(let k=1;k<baseline.calls.length;k++)for(let i=0;i<baseline.iterations;i++)expect(baseline.calls[k][i]).toBeGreaterThanOrEqual(baseline.calls[k-1][i]);
    expect(summary.at(-1)!.mean).toBeGreaterThan(summary[0].mean!);
  });
  it('increased cancellation hazard speeds up calls',()=>{
    const config={...input,total:30,rank:20,now:720,iterations:3000};
    const fast=simulate(config,{...MODEL,cancellationPerTeamMinute:.02});
    const slow=simulate(config,{...MODEL,cancellationPerTeamMinute:0});
    const avg=(x:Float64Array)=>Array.from(x).reduce((s,v)=>s+Math.min(v,870),0)/x.length;
    expect(avg(fast.calls[0])).toBeLessThan(avg(slow.calls[0])-5);
  });
  it('preserves mass including closing censoring and arrival misses',()=>{
    for(const row of [...summary,...summarize(baseline,{...input,target:810,tolerance:10,arrival:810}),...summarize(simulate({...input,now:865}),{...input,now:865,target:880,tolerance:5})]){
      expect(row.bins.reduce((s,b)=>s+b.probability,0)+row.missed+row.uncalled).toBeCloseTo(1,12);
      expect(row.beforeWindow+row.success+row.afterWindow+row.missed+row.uncalled).toBeCloseTo(1,12);
      expect(row.callBeforeArrival).toBeGreaterThanOrEqual(row.missed);
    }
  });
  it('CDF never decreases and does not normalize away missed entries',()=>{
    const row=summarize(baseline,{...input,target:810,tolerance:10,arrival:810})[0];
    let prev=0;for(const bin of row.bins){expect(bin.cumulative).toBeGreaterThanOrEqual(prev);prev=bin.cumulative;}
    expect(prev).toBeCloseTo(row.admitted,12);expect(prev).toBeLessThan(1);
  });
  it('makes no calls before opening, including rank 1',()=>{
    const x=simulate({total:5,rank:1,now:640,iterations:2000});
    for(const calls of x.calls)for(const t of calls)expect(t).toBeGreaterThanOrEqual(660);
  });
  it('rank 1 has a nonzero call wait matching the service event rate',()=>{
    const x=simulate({total:1,rank:1,now:712,iterations:10_000});
    const mean=Array.from(x.calls[0]).reduce((s,t)=>s+t-712,0)/x.iterations;
    expect(mean).toBeGreaterThan(3.8);expect(mean).toBeLessThan(4.8);
  });
  it('rejects closed, pre-registration and past-target inputs',()=>{
    expect(()=>createSimulation({...input,now:629})).toThrow();
    expect(()=>createSimulation({...input,now:870})).toThrow();
    expect(()=>summarize(baseline,{...input,target:780,tolerance:10})).toThrow();
    expect(()=>summarize(baseline,{...input,target:810,tolerance:10,arrival:780})).toThrow();
  });
  it('handles a grace boundary, arrival waiting, and unconditional quantiles exactly',()=>{
    const x=createSimulation({...input,iterations:4});
    x.calls=x.calls.map(()=>new Float64Array([800,807,809,Infinity]));
    const row=summarize(x,{...input,target:810,tolerance:5,arrival:810})[0];
    expect(row.missed).toBe(.25);expect(row.uncalled).toBe(.25);expect(row.success).toBe(.5);
    expect(row.mean).toBe(810);expect(row.median).toBe(810);expect(row.q90).toBeNull();
    expect(row.callBeforeArrival).toBe(.75);
  });
  it('historical full-period reduction is consistent with fixed service/cancel means',()=>{
    // Mean-field W at 13:18, starting at observed W=32 at 11:52, no new registrations.
    const mu=MODEL.servicePerMinute,c=MODEL.cancellationPerTeamMinute;
    const expected=1+(31+mu/c)*Math.exp(-c*86)-mu/c;
    expect(Math.abs(expected-7)).toBeLessThan(1);
  });
});
