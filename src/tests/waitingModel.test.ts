import { describe,expect,it } from 'vitest';
import { MODEL } from '../../scripts/legacy/modelConstants';
import { effectiveDeferRate,ratesAt,transition,validateQueue } from '../../scripts/legacy/waitingModel';
describe('queue rules',()=>{
  it('rejects invalid ranks, fractional counts, and excessive queues',()=>{
    for(const [w,r] of [[10,11],[0,1],[10,0],[10,2.5],[151,1],[NaN,1]])expect(validateQueue(w,r)).not.toBeNull();
    expect(validateQueue(10,1)).toBeNull();expect(validateQueue(10,10)).toBeNull();
  });
  it('cancellation behind changes only total; ahead also advances rank',()=>{
    const s={total:10,rank:4,called:false};
    expect(transition(s,{type:'cancel',position:9})).toEqual({total:9,rank:4,called:false});
    expect(transition(s,{type:'cancel',position:2})).toEqual({total:9,rank:3,called:false});
  });
  it('only an ahead team deferring across the user advances the user',()=>{
    const s={total:10,rank:4,called:false};
    expect(transition(s,{type:'defer',position:1,destination:4})).toEqual({...s,rank:3});
    expect(transition(s,{type:'defer',position:1,destination:3})).toEqual(s);
    expect(transition(s,{type:'defer',position:6,destination:10})).toEqual(s);
    expect(s.rank).toBe(4);
  });
  it('own defer is not admission and cannot move forward',()=>{
    const s={total:10,rank:4,called:false};
    expect(transition(s,{type:'self-defer',destination:6})).toEqual({...s,rank:6});
    expect(()=>transition(s,{type:'self-defer',destination:3})).toThrow();
  });
  it('first rank is not called until a service event and batches are allowed',()=>{
    expect(transition({total:5,rank:1,called:false},{type:'arrival'}).called).toBe(false);
    expect(transition({total:5,rank:2,called:false},{type:'service',batch:2}).called).toBe(true);
  });
  it('follows exact uniform destination crossing probability',()=>{
    expect(effectiveDeferRate(5,3,1)).toBeCloseTo(3/4+3/3,12);
    expect(effectiveDeferRate(5,1,1)).toBe(0);
    expect(effectiveDeferRate(10,4)).toBeGreaterThan(effectiveDeferRate(4,4));
  });
  it('more teams ahead create more cancellation opportunities',()=>{
    const c=MODEL.cancellationPerTeamMinute;
    expect(19*c).toBeGreaterThan(2*c);
    expect(1-Math.exp(-19*c*10)).toBeGreaterThan(1-Math.exp(-2*c*10));
  });
  it('does not change service or registrations at former clock boundaries',()=>{
    for(const time of [600,629,630,659,660,711,712,869,870,900]) {
      expect(ratesAt(time,10)).toEqual(ratesAt(720,10));
      expect(ratesAt(time,10).service).toBeGreaterThan(0);
      expect(ratesAt(time,10).arrival).toBeGreaterThan(0);
    }
  });
  it('model constants are frozen and input cannot mutate them',()=>{
    const snapshot=JSON.stringify(MODEL);
    expect(Object.isFrozen(MODEL)).toBe(true);
    transition({total:32,rank:24,called:false},{type:'self-defer',destination:32});
    expect(JSON.stringify(MODEL)).toBe(snapshot);
  });
});
