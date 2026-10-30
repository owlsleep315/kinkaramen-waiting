import { describe,expect,it } from 'vitest';
import { simulate,summarize } from '../../scripts/legacy/simulation';
import { choosePosition } from '../../scripts/legacy/optimizer';
const input={total:10,rank:4,now:786,iterations:10_000,seed:20261029};
const calls=simulate(input);
const rows=summarize(calls,{...input,target:810,tolerance:10});
describe('recommendation',()=>{
  it('never suggests moving forward and maximizes success',()=>{
    const rank=choosePosition(rows,4)!;
    expect(rank).toBeGreaterThanOrEqual(4);expect(rank).toBeLessThanOrEqual(10);
    expect(rows.find(p=>p.rank===rank)!.success).toBe(Math.max(...rows.map(p=>p.success)));
  });
  it('a later target can select a later rank',()=>{
    const early=choosePosition(summarize(calls,{...input,target:800,tolerance:5}),4)!;
    const late=choosePosition(summarize(calls,{...input,target:820,tolerance:5}),4)!;
    expect(late).toBeGreaterThan(early);
  });
  it('ties prefer less early-call risk, then less movement',()=>{
    const base=rows[0];
    expect(choosePosition([{...base,rank:4,success:.4,callBeforeArrival:.2},{...base,rank:5,success:.4,callBeforeArrival:.1},{...base,rank:6,success:.4,callBeforeArrival:.1}],4)).toBe(5);
  });
  it('recommends maintaining the rank when it is best',()=>{
    expect(choosePosition(summarize(calls,{...input,target:793,tolerance:5}),4)).toBe(4);
  });
  it('does not force an impossible recommendation beyond the calculation horizon',()=>{
    const impossible=summarize(calls,{...input,target:1200,tolerance:5});
    expect(choosePosition(impossible,4)).toBeNull();
  });
});
