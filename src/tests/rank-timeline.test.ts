import { describe, expect, it } from 'vitest';
import { createSimulation, runScenarios, simulate, summarizeRankTimeline } from '../models/simulation';
const input = { rank: 9, now: 720, iterations: 100 };
describe('current rank timeline', () => {
  it('records each earlier rank in order before actual calling', () => {
    const x = simulate(input);
    expect(summarizeRankTimeline(x).map(r => r.rank)).toEqual([8,7,6,5,4,3,2,1]);
    for (let i = 0; i < x.iterations; i++) {
      let previous = input.now;
      for (const samples of x.rankTimes) { expect(samples[i]).toBeGreaterThan(previous); expect(samples[i]).toBeLessThan(x.calls[input.rank - 1][i]); previous = samples[i]; }
    }
  });
  it('first rank has no prior milestones', () => expect(summarizeRankTimeline(simulate({ ...input, rank: 1 }))).toEqual([]));
  it('worker chunks produce identical trajectories', () => {
    const x = createSimulation(input); runScenarios(x, 0, 40); runScenarios(x, 40, 100);
    const y = simulate(input); expect(x.calls).toEqual(y.calls); expect(x.rankTimes).toEqual(y.rankTimes);
  });
  it('does not hide unreached milestones near midnight', () => {
    const x = simulate({ ...input, now: 1439 }); expect(summarizeRankTimeline(x).at(-1)!.mean).toBeNull();
  });
});
