import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MODEL } from '../../scripts/legacy/modelConstants';
import { createSimulation, runScenarios, simulate, summarizeRankTimeline } from '../../scripts/legacy/simulation';

const config={total:12,rank:9,now:640,iterations:100};
const isolated={...MODEL,arrivalPerMinute:0,cancellationPerTeamMinute:0,deferPerTeamMinute:0};
describe('current rank timeline',()=>{
  it('preserves existing seeded calls exactly',()=>{
    const out=simulate(config);
    const hash=createHash('sha256').update(Buffer.concat(out.calls.map(a=>Buffer.from(a.buffer)))).digest('hex');
    expect(hash).toBe('8ccc150a276988120d1c9a6ee08caf2b8cdb97ecd9c941959a3e9fb73bfc40b9');
  });
  it('lists every earlier rank in order and reaches each no later than the call',()=>{
    const out=simulate(config);
    expect(summarizeRankTimeline(out).map(row=>row.rank)).toEqual([8,7,6,5,4,3,2,1]);
    for(let i=0;i<out.iterations;i++) {
      let previous=config.now;
      for(const samples of out.rankTimes) {
        expect(samples[i]).toBeGreaterThanOrEqual(previous);
        expect(samples[i]).toBeLessThanOrEqual(out.calls[0][i]);
        previous=samples[i];
      }
    }
  });
  it('distinguishes first place from the subsequent call',()=>{
    const out=simulate({...config,total:2,rank:2},{...isolated,batchOfTwoProbability:0});
    for(let i=0;i<out.iterations;i++) expect(out.rankTimes[0][i]).toBeLessThan(out.calls[0][i]);
  });
  it('records skipped ranks at the same batch event',()=>{
    const out=simulate({...config,total:3,rank:3},{...isolated,batchOfTwoProbability:1});
    expect(out.rankTimes[0]).toEqual(out.rankTimes[1]);
  });
  it.each(['cancellationPerTeamMinute','deferPerTeamMinute'] as const)('includes progression from %s without service',rate=>{
    const out=simulate({...config,total:2,rank:2},{...isolated,servicePerMinute:0,[rate]:1});
    expect(summarizeRankTimeline(out)[0].mean).not.toBeNull();
    expect(Array.from(out.calls[0]).every(t=>t===Infinity)).toBe(true);
  });
  it('handles rank one and unreachable milestones',()=>{
    expect(summarizeRankTimeline(simulate({...config,rank:1}))).toEqual([]);
    const out=simulate({...config,total:2,rank:2},{...isolated,servicePerMinute:0});
    expect(summarizeRankTimeline(out)).toEqual([{rank:1,mean:null}]);
  });
  it('matches worker-style chunked execution',()=>{
    const out=createSimulation(config);
    runScenarios(out,0,40);runScenarios(out,40,100);
    expect(out.rankTimes).toEqual(simulate(config).rankTimes);
  });
});
