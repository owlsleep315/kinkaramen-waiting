import { describe,expect,it } from 'vitest';
import { MODEL } from '../../scripts/legacy/modelConstants';
import { createSimulation,simulate,summarize } from '../../scripts/legacy/simulation';
const input={total:10,rank:4,now:786,iterations:10_000,seed:20261029};
const baseline=simulate(input);
const summary=summarize(baseline,{...input,target:810,tolerance:10});
describe('fixed seeded event simulation',()=>{
  it('keeps the expected call near 10:30 for rank 8 even with an 11:30 arrival',()=>{
    const config={total:8,rank:8,now:600};
    const x=simulate(config);
    const early=summarize(x,{...config,target:630,tolerance:10})[0];
    const late=summarize(x,{...config,target:690,tolerance:10})[0];
    expect(late.callMean).toBeGreaterThan(628);
    expect(late.callMean).toBeLessThan(632);
    expect(late.callMean).toBe(early.callMean);
    expect(late.callQ10).toBe(early.callQ10);
    expect(late.callQ90).toBe(early.callQ90);
    expect(late.missed).toBeGreaterThan(.99);
    expect(late.mean).toBeGreaterThan(690);
  });
  it('retains uncalled probability in call statistics',()=>{
    const x=createSimulation({...input,iterations:4});
    x.calls=x.calls.map(()=>new Float64Array([800,807,809,Infinity]));
    const row=summarize(x,{...input,target:810,tolerance:10})[0];
    expect(row.callMean).toBeNull();
    expect(row.callQ10).toBe(800);
    expect(row.callQ90).toBeNull();
  });
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
  it('preserves mass including horizon censoring and arrival misses',()=>{
    for(const row of [...summary,...summarize(baseline,{...input,target:810,tolerance:10}),...summarize(simulate({...input,now:865}),{...input,now:865,target:880,tolerance:5})]){
      expect(row.bins.reduce((s,b)=>s+b.probability,0)+row.missed+row.uncalled).toBeCloseTo(1,12);
      expect(row.beforeWindow+row.success+row.afterWindow+row.missed+row.uncalled).toBeCloseTo(1,12);
      expect(row.callBeforeArrival).toBeGreaterThanOrEqual(row.missed);
    }
  });
  it('CDF never decreases and does not normalize away missed entries',()=>{
    const row=summarize(baseline,{...input,target:810,tolerance:10})[0];
    let prev=0;for(const bin of row.bins){expect(bin.cumulative).toBeGreaterThanOrEqual(prev);prev=bin.cumulative;}
    expect(prev).toBeCloseTo(row.admitted,12);expect(prev).toBeLessThan(1);
  });
  it('allows calls outside former operating hours',()=>{
    for(const now of [600,870,900]) {
      const x=simulate({total:1,rank:1,now,iterations:200});
      expect(x.end).toBe(now+MODEL.horizonMinutes);
      expect(Array.from(x.calls[0]).some(t=>t<now+10)).toBe(true);
    }
  });
  it('rank 1 has a nonzero call wait matching the service event rate',()=>{
    const x=simulate({total:1,rank:1,now:712,iterations:10_000});
    const mean=Array.from(x.calls[0]).reduce((s,t)=>s+t-712,0)/x.iterations;
    expect(mean).toBeGreaterThan(3.8);expect(mean).toBeLessThan(4.8);
  });
  it('rejects invalid current times, past arrivals and invalid tolerances',()=>{
    for(const now of [-1,1440,NaN,Infinity]) expect(()=>createSimulation({...input,now})).toThrow();
    for(const target of [780,786,1440,NaN]) expect(()=>summarize(baseline,{...input,target,tolerance:10})).toThrow();
    expect(()=>summarize(baseline,{...input,target:810,tolerance:0})).toThrow();
  });
  it.each([5,10,15])('uses inclusive -3 to +%i call boundaries',tolerance=>{
    const x=createSimulation({...input,iterations:8});
    x.calls=x.calls.map(()=>new Float64Array([806.999,807,809,810,810+tolerance,810+tolerance+.001,Infinity,800]));
    const row=summarize(x,{...input,target:810,tolerance})[0];
    expect(row.success).toBe(4/8);
    expect(row.missed).toBe(2/8);
    expect(row.afterWindow).toBe(1/8);
    expect(row.uncalled).toBe(1/8);
    expect(row.beforeWindow).toBe(0);
    expect(row.success+row.missed+row.afterWindow+row.uncalled).toBe(1);
  });
  it('handles a grace boundary, arrival waiting, and unconditional quantiles exactly',()=>{
    const x=createSimulation({...input,iterations:4});
    x.calls=x.calls.map(()=>new Float64Array([800,807,809,Infinity]));
    const row=summarize(x,{...input,target:810,tolerance:5})[0];
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
