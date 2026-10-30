import { describe, expect, it } from 'vitest';
import { validateRank, localModel, rankRate } from '../models/waitingModel';
import { MODEL, KINKA_POSTERIOR } from '../models/modelConstants';
import { behaviorRate, decreaseDistribution, fitService, logTransition } from '../models/intervalModel';
import type { Observation } from '../models/observations';
const rows: Observation[] = [{ id: '1', date: '2026-10-30', time: 720, rank: 20, kind: 'observation' }, { id: '2', date: '2026-10-30', time: 730, rank: 16, kind: 'observation' }];
describe('rank-only model and local updates', () => {
  it('validates ranks without a total', () => { for (const r of [0, -1, 151, 2.5, NaN]) expect(validateRank(r)).not.toBeNull(); expect(validateRank(1)).toBeNull(); expect(validateRank(150)).toBeNull(); });
  it('more teams ahead add cancellation and effective defer, not final call hazards', () => { expect(rankRate(1)).toBe(MODEL.servicePerMinute); expect(rankRate(30) - rankRate(1)).toBeCloseTo(29 * behaviorRate); });
  it.each([{ records: [] }, { records: [rows[0]] }])('uses the Kinka posterior with fewer than two records', ({ records }) => { expect(localModel(records, '2026-10-30', 740).posterior).toBe(KINKA_POSTERIOR); });
  it('shrinks new speed toward Kinka and never adds observed decreases twice', () => {
    const info = localModel(rows, '2026-10-30', 740);
    expect(info.minutes).toBe(10); expect(info.count).toBe(4);
    expect(info.posterior.mean).toBeGreaterThan(MODEL.servicePerMinute);
    expect(info.posterior.mean).toBeLessThan(.4);
  });
  it('longer zero-decrease observations slow the estimate', () => {
    const fast = localModel(rows, '2026-10-30', 780).posterior.mean;
    const slow = localModel([...rows, { ...rows[1], id: '3', time: 780 }], '2026-10-30', 780);
    expect(slow.posterior.mean).toBeLessThan(fast / 2);
  });
  it('self-defer affects state but contributes no speed information', () => {
    const info = localModel([...rows, { ...rows[1], id: '3', time: 735, rank: 30, kind: 'self-defer' }], '2026-10-30', 740);
    expect(info.posterior).toEqual(localModel(rows, '2026-10-30', 740).posterior);
    expect(info.excluded).toBe(1);
  });
  it('does not merge yesterday or future records', () => {
    expect(localModel(rows, '2026-10-31', 740).intervals).toBe(0);
    expect(localModel(rows, '2026-10-30', 725).intervals).toBe(0);
  });
  it('zero data Gamma integration recovers the prior mean', () => { expect(fitService([]).mean).toBeCloseTo(23 / 86, 6); });
  it('matches Poisson counts when behavior hazards vanish', () => {
    expect(Math.exp(logTransition(10, 8, 7, .3, 0))).toBeCloseTo(Math.exp(-2.1) * 2.1 ** 2 / 2, 12);
    expect(Math.exp(logTransition(10, 10, 7, .3, 0))).toBeCloseTo(Math.exp(-2.1), 12);
  });
  it('exact interval formula agrees with independent CTMC uniformization', () => {
    const rank = 20, t = 17, mu = .29, q = rankRate(rank, mu);
    let vector = new Array(rank + 1).fill(0); vector[rank] = 1;
    const result = new Array(rank + 1).fill(0);
    let weight = Math.exp(-q * t);
    for (let n = 0; n < 160; n++) {
      for (let r = 0; r <= rank; r++) result[r] += weight * vector[r];
      const next = new Array(rank + 1).fill(0); next[0] = vector[0];
      for (let r = 1; r <= rank; r++) { const p = rankRate(r, mu) / q; next[r] += vector[r] * (1 - p); next[r - 1] += vector[r] * p; }
      vector = next; weight *= q * t / (n + 1);
    }
    for (let r = 1; r <= rank; r++) expect(Math.exp(logTransition(rank, r, t, mu))).toBeCloseTo(result[r], 12);
    expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });
  it('long interval count forecasts keep all probability including rank-one saturation', () => {
    const p = decreaseDistribution(3, 600, KINKA_POSTERIOR);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10); expect(p[2]).toBeGreaterThan(.999);
  });
});
