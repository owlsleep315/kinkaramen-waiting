import { describe, expect, it } from 'vitest';
import { simulate, summarize, createSimulation, runScenarios, summarizeRankTimeline, type PredictionInput } from '../models/simulation';
import { choosePosition } from '../models/optimizer';
import { MODEL } from '../models/modelConstants';
const input: PredictionInput = { mode: 'kinka', rank: 4, now: 786, target: 810, tolerance: 10, iterations: 1200, maxCandidate: 50 };
const out = simulate(input), positions = summarize(out, input);
describe('rank-only call prediction', () => {
  it('normalizes the complete call distribution including uncensored tail', () => {
    for (const p of positions) {
      expect(p.bins.reduce((s, b) => s + b.probability, 0) + p.uncalled).toBeCloseTo(1, 10);
      expect(p.missed + p.success + p.afterWindow + p.uncalled).toBeCloseTo(1, 10);
      expect(p.onArrival).toBeLessThanOrEqual(p.callBeforeArrival);
    }
  });
  it('produces nested 50/80/90 prediction intervals', () => {
    const p = positions[3];
    const qs = [p.q05, p.q10, p.q25, p.median, p.q75, p.q90, p.q95] as number[];
    expect(qs).toEqual([...qs].sort((a, b) => a - b));
  });
  it('never calls before opening; custom stores have no Kinka opening restriction', () => {
    const early = { ...input, now: 630, rank: 1, iterations: 200 };
    const kinka = simulate(early), custom = simulate({ ...early, mode: 'custom' });
    expect(Math.min(...kinka.calls[0])).toBeGreaterThanOrEqual(660);
    expect(Math.min(...custom.calls[0])).toBeLessThan(660);
  });
  it('separates first place and actual call, and has ordered rank milestones', () => {
    const milestones = summarizeRankTimeline(out);
    expect(milestones.map(r => r.rank)).toEqual([3, 2, 1]);
    for (let i = 0; i < out.iterations; i++) {
      expect(out.rankTimes[0][i]).toBeGreaterThan(input.now);
      expect(out.rankTimes[1][i]).toBeGreaterThan(out.rankTimes[0][i]);
      expect(out.calls[3][i]).toBeGreaterThan(out.rankTimes[2][i]);
    }
    expect(summarizeRankTimeline(simulate({ ...input, rank: 1 }))).toEqual([]);
  });
  it('uses common scenarios so moving later cannot cause an earlier call', () => {
    for (let r = 1; r < out.calls.length; r++) for (let i = 0; i < 50; i++) expect(out.calls[r][i]).toBeGreaterThanOrEqual(out.calls[r - 1][i]);
  });
  it('does not move the call distribution when only arrival changes', () => {
    const changed = summarize(out, { ...input, target: 820 });
    expect(changed[3].median).toBe(positions[3].median); expect(changed[3].bins).toEqual(positions[3].bins);
  });
  it('gives the same results in worker-sized chunks', () => {
    const split = createSimulation(input);
    runScenarios(split, 0, 500); runScenarios(split, 500, split.iterations);
    expect(split.calls).toEqual(out.calls);
  });
  it('preserves late-day tail instead of renormalizing or wrapping to the next day', () => {
    const late = { ...input, now: 1430, target: 1439, rank: 50 };
    const p = summarize(simulate(late), late)[49];
    expect(p.uncalled).toBeGreaterThan(.99); expect(p.median).toBeNull();
  });
  it('rejects invalid rank and past arrival', () => {
    expect(() => simulate({ ...input, rank: 0 })).toThrow();
    expect(() => simulate({ ...input, rank: MODEL.maxRank + 1 })).toThrow();
    expect(() => summarize(out, { ...input, target: 785 })).toThrow();
  });
  it('responds to local observations while leaving official coefficients unchanged', () => {
    const before = JSON.stringify(MODEL);
    const fast = simulate({ ...input, mode: 'custom', evidence: { count: 60, minutes: 30, priorMean: .3, intervals: 3, excluded: 0, weight: .5 } });
    expect(summarize(fast, input)[3].median).toBeLessThan(positions[3].median!);
    expect(JSON.stringify(MODEL)).toBe(before);
  });
});
describe('arrival-aware optimization', () => {
  it('recommends postponing for a sufficiently later arrival', () => { expect(choosePosition(positions)!).toBeGreaterThan(input.rank); });
  it('keeps the current rank when it is the optimal candidate', () => {
    const rank = choosePosition(positions)!;
    expect(choosePosition(positions, rank)).toBe(rank);
  });
  it('shows an earlier theoretical optimum but restricts actionable suggestions', () => {
    const soon = summarize(out, { ...input, target: 788 });
    expect(choosePosition(soon)!).toBeLessThan(20);
    expect(choosePosition(soon, 20)).toBeNull();
    const near = choosePosition(soon, 4);
    expect(near).not.toBeNull();
    expect(near!).toBeGreaterThanOrEqual(4);
  });
  it('respects exactly three minutes grace and computes waiting after arrival', () => {
    const sample = createSimulation({ ...input, rank: 1, iterations: 5, maxCandidate: 1 });
    sample.calls[0].set([806.999, 807, 810, 820, 821]);
    const p = summarize(sample, input)[0];
    expect(p.missed).toBe(.2); expect(p.success).toBe(.6); expect(p.onArrival).toBe(.4);
    expect(p.expectedWait).toBe(21 / 4);
  });
  it('handles rank one and zero-success distant candidates without fake certainty', () => {
    expect(positions[0].median).toBeGreaterThan(input.now);
    expect(choosePosition(positions.map(p => ({ ...p, success: 0 })))).toBeNull();
  });
});

describe('observed mid-visit regression cases', () => {
  it.each([
    { now: 712, rank: 24, end: 752, observedRank: 12 },
    { now: 730, rank: 18, end: 749, observedRank: 13 },
    { now: 766, rank: 13, end: 793, observedRank: 5 },
  ])('places observed progress at $end inside its 90% predictive count interval', test => {
    const scenario = simulate({ mode: 'kinka', now: test.now, rank: test.rank, iterations: 2000 });
    const counts = Array.from({ length: scenario.iterations }, (_, i) => scenario.rankTimes.reduce((s, times) => s + Number(times[i] <= test.end), 0)).sort((a, b) => a - b);
    const observed = test.rank - test.observedRank;
    expect(observed).toBeGreaterThanOrEqual(counts[99]);
    expect(observed).toBeLessThanOrEqual(counts[1899]);
  });
  it('accepts the declared maximum rank without exceeding candidate limits', () => {
    expect(createSimulation({ mode: 'kinka', now: 720, rank: 300, iterations: 1 }).calls).toHaveLength(300);
  });
});
