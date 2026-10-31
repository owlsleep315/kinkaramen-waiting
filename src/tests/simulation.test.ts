import { describe, expect, it } from 'vitest';
import { createSimulation, simulate, summarize } from '../models/simulation';
import { KINKA_POSTERIOR } from '../models/modelConstants';
import { BEHAVIOR } from '../models/intervalModel';
const input = { rank: 4, now: 786, iterations: 2000 };
const out = simulate(input), rows = summarize(out, { ...input, target: 810, tolerance: 10 });
describe('rank-only forecast', () => {
  it('rejects insufficient local intervals instead of silently using Kinka', () => {
    expect(() => createSimulation({ ...input, mode: 'other', date: '2026-10-31', observations: [
      { id: 'a', date: '2026-10-31', time: 780, rank: 20, kind: 'observation', ordered: true },
      { id: 'b', date: '2026-10-31', time: 780, rank: 19, kind: 'observation', ordered: true },
    ] })).toThrow('유효 구간');
  });
  it('zero local service preserves fixed behavior and never invents a call', () => {
    const input = { rank: 2, now: 740, mode: 'other' as const, date: '2026-10-31', iterations: 20, observations: [
      { id: 'a', date: '2026-10-31', time: 720, rank: 2, kind: 'observation' as const },
      { id: 'b', date: '2026-10-31', time: 740, rank: 2, kind: 'observation' as const },
    ] };
    const local = simulate(input);
    expect(local.modelInfo).toMatchObject({ service: 0, cancellation: BEHAVIOR.cancellation, defer: BEHAVIOR.defer, crossing: BEHAVIOR.crossing });
    expect(local.modelInfo.stepMinutes[0]).toBe(Infinity);
    expect(Number.isFinite(local.modelInfo.stepMinutes[1])).toBe(true);
    expect(summarize(local, { ...input, target: 770, tolerance: 10 })[1]).toMatchObject({ uncalled: 1, callMean: null, success: 0 });
  });
  it('reports the exact posterior mixture waiting time and fixed behavior coefficients', () => {
    const info = out.modelInfo;
    expect(info).toMatchObject({ cancellation: BEHAVIOR.cancellation, defer: BEHAVIOR.defer, crossing: BEHAVIOR.crossing });
    expect(info.service).toBe(KINKA_POSTERIOR.mean);
    for (const rank of [1, 4, 150]) {
      const expected = KINKA_POSTERIOR.rates.reduce((sum, rate, i) => sum + KINKA_POSTERIOR.weights[i] / (rate + (rank - 1) * (BEHAVIOR.cancellation + BEHAVIOR.defer * BEHAVIOR.crossing)), 0);
      expect(info.stepMinutes[rank - 1]).toBeCloseTo(expected, 12);
    }
    expect(info.stepMinutes[0]).toBeGreaterThan(info.stepMinutes[3]);
    expect(info.stepMinutes[0]).toBeGreaterThan(1 / info.service);
  });
  it('reports locally adapted coefficients instead of Kinka defaults', () => {
    const local = createSimulation({ ...input, mode: 'other', date: '2026-10-31', observations: [
      { id: 'a', date: '2026-10-31', time: 720, rank: 20, kind: 'observation' },
      { id: 'b', date: '2026-10-31', time: 780, rank: 19, kind: 'observation' },
    ] });
    expect(local.modelInfo.service).toBe(local.posterior.mean);
    expect(local.modelInfo.service).toBeLessThan(out.modelInfo.service);
    expect(local.modelInfo.stepMinutes[3]).toBeGreaterThan(out.modelInfo.stepMinutes[3]);
  });
  it('is reproducible without total or target in the call process', () => {
    const early = summarize(out, { ...input, target: 800, tolerance: 5 });
    expect(early[3].callMean).toBe(rows[3].callMean); expect(early[3].bins).toEqual(rows[3].bins);
    expect(simulate({ ...input, iterations: 10 }).calls).toEqual(simulate({ ...input, iterations: 10 }).calls);
  });
  it('moving back never advances the call in a common scenario', () => {
    let violations = 0;
    for (let k = 1; k < out.calls.length; k++) for (let i = 0; i < out.iterations; i++) if (out.calls[k][i] < out.calls[k - 1][i]) violations++;
    expect(violations).toBe(0);
  });
  it('preserves complete distribution mass, early failures and censoring', () => {
    for (const row of rows) {
      expect(row.bins.reduce((s, b) => s + b.probability, 0) + row.uncalled).toBeCloseTo(1, 10);
      expect(row.success + row.missed + row.afterWindow + row.uncalled).toBeCloseTo(1, 10);
      expect(row.bins.at(-1)!.cumulative).toBeCloseTo(1 - row.uncalled, 10);
    }
  });
  it('first rank waits for service and matches its posterior mixture mean', () => {
    const x = simulate({ rank: 1, now: 720, iterations: 10000 });
    const actual = Array.from(x.calls[0]).reduce((s, t) => s + t - 720, 0) / x.iterations;
    const expected = KINKA_POSTERIOR.rates.reduce((s, r, i) => s + KINKA_POSTERIOR.weights[i] / r, 0);
    expect(Math.abs(actual - expected)).toBeLessThan(.15);
  });
  it('respects 11am for Kinka but not other stores', () => {
    const a = simulate({ ...input, now: 630, rank: 1, iterations: 100 });
    const b = simulate({ ...input, now: 630, rank: 1, iterations: 100, mode: 'other' });
    expect(Math.min(...a.calls[0])).toBeGreaterThan(660);
    expect(Math.min(...b.calls[0])).toBeLessThan(640);
  });
  it.each([5, 10, 15])('honors 3min grace and +%imin inclusive bounds', tolerance => {
    const x = createSimulation({ ...input, iterations: 7 });
    x.calls = [new Float64Array([806.99, 807, 810, 810 + tolerance, 810 + tolerance + .01, Infinity, 800])];
    const p = summarize(x, { ...input, target: 810, tolerance })[0];
    expect(p.missed).toBe(2 / 7); expect(p.success).toBe(3 / 7); expect(p.beforeTarget).toBe(2 / 7);
    expect(p.callBeforeArrival).toBe(4 / 7); expect(p.expectedWait).toBeCloseTo((2 * tolerance + .01) / 4);
  });
  it('keeps out-of-horizon quantiles instead of renormalizing', () => {
    const x = createSimulation({ ...input, iterations: 4 }); x.calls = [new Float64Array([800, 805, 810, Infinity])];
    const p = summarize(x, { ...input, target: 810, tolerance: 10 })[0];
    expect(p.callMean).toBeNull(); expect(p.median).toBe(805); expect(p.q25).toBe(800); expect(p.callQ90).toBeNull();
  });
  it('rejects invalid times, ranks and targets; caps at midnight', () => {
    for (const now of [-1, 1440, NaN]) expect(() => createSimulation({ ...input, now })).toThrow();
    for (const target of [786, 780, 1440, NaN]) expect(() => summarize(out, { ...input, target, tolerance: 10 })).toThrow();
    expect(createSimulation({ ...input, now: 1400 }).end).toBe(1440);
  });
});
