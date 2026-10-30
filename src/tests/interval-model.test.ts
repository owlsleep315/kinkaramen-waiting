import { describe, it, expect } from 'vitest';
import raw from '../data/observations.json';
import fitted from '../data/fittedModel.json';
import { buildIntervals, exposures, type Observation } from '../models/observations';
import { fitRates } from '../models/fitting';
import { rateAt, nextProgress, localEvidence } from '../models/waitingModel';
import { MODEL } from '../models/modelConstants';
const row = (time: number, rank: number, kind: Observation['kind'] = 'observation', extra = {}): Observation => ({ id: `${time}-${rank}`, date: '2026-10-30', time, rank, kind, ...extra });
describe('interval-censored data', () => {
  it('uses multi-event counts over elapsed exposure without event timestamps', () => {
    const data = buildIntervals([row(730, 18), row(737, 16)]);
    expect(data.intervals).toEqual([{ date: '2026-10-30', start: 730, end: 737, count: 2, startRank: 18, total: undefined }]);
  });
  it('preserves zero decrease intervals and long exposures', () => {
    expect(buildIntervals([row(720, 20), row(750, 20)]).intervals[0]).toMatchObject({ count: 0, start: 720, end: 750 });
    expect(buildIntervals([row(720, 20), row(780, 10)]).intervals[0].count).toBe(10);
  });
  it('excludes ambiguous same-minute states and does not bridge across them', () => {
    const result = buildIntervals([row(720, 20), row(725, 18), row(725, 17), row(730, 16), row(735, 14)]);
    expect(result.intervals).toHaveLength(1); expect(result.excluded).toHaveLength(2);
  });
  it('splits an explicitly ordered pre/post self-defer observation', () => {
    const result = buildIntervals([row(666, 33), row(682, 22, 'observation', { ordered: true }), row(682, 33, 'self-defer', { ordered: true }), row(688, 32)]);
    expect(result.intervals.map(x => x.count)).toEqual([11, 1]);
  });
  it('excludes mixed self-defer intervals and unmarked increases', () => {
    const result = buildIntervals([row(720, 6), row(725, 13, 'self-defer'), row(730, 12), row(735, 15), row(740, 14)]);
    expect(result.intervals.map(i => i.count)).toEqual([1, 1]); expect(result.excluded).toHaveLength(2);
  });
  it('does not use Q or memos as event labels and does not stop at closure/reopening', () => {
    const rows = [row(720, 10, 'observation', { total: 14 }), row(730, 8, 'observation', { total: 14, note: 'registration closed' }), row(740, 6, 'observation', { total: 25, note: 'reopened' })];
    expect(buildIntervals(rows).intervals.map(i => i.count)).toEqual([2, 2]);
  });
  it('deduplicates identical observations and isolates dates', () => {
    const a = row(720, 10);
    expect(buildIntervals([a, a, row(730, 8)]).duplicates).toBe(1);
    expect(buildIntervals([a, row(730, 8, 'observation', { date: '2026-10-31' })]).intervals).toEqual([]);
  });
  it('retains raw contradictory records and matches canonical training totals', () => {
    const data = buildIntervals(raw as Observation[]);
    expect(data.intervals).toHaveLength(47);
    expect(data.intervals.reduce((s, i) => s + i.count, 0)).toBe(72);
    expect(data.intervals.reduce((s, i) => s + i.end - i.start, 0)).toBe(223);
    expect(raw.find(r => r.date === '2026-10-29' && r.time === 666)?.flags?.length).toBeGreaterThan(0);
    expect(fitted.legacyDeduplicatedRows).toBe(54);
  });
  it('fits deterministic posterior coefficients including boundary-crossing exposure', () => {
    expect(exposures(718, 721)).toEqual([2, 1, 0]);
    const refit = fitRates(buildIntervals(raw as Observation[]).intervals);
    // V8/libm can differ by ~1e-16 across Node 22/24; preserve all 960 draw checks.
    refit.rates.forEach((rate, i) => expect(rate).toBeCloseTo(fitted.rates[i], 12));
    expect(refit.posteriorDraws).toHaveLength(fitted.posteriorDraws.length);
    refit.posteriorDraws.forEach((draw, i) => draw.forEach((rate, b) => expect(rate).toBeCloseTo(fitted.posteriorDraws[i][b], 12)));
  });
  it('falls back to the prior with insufficient data and no infinite fitted rates', () => {
    fitRates([]).rates.forEach(r => expect(r).toBeCloseTo(.3, 1));
  });
  it('applies each time band and integrates hazard across boundaries', () => {
    expect([rateAt(719), rateAt(720), rateAt(780)]).toEqual(MODEL.rates);
    expect(nextProgress(719, 2, [1, .5, .2], 900)).toBe(722);
    expect(nextProgress(719, 2, [0, 0, 0], 900)).toBe(Infinity);
  });
});
describe('local Bayesian evidence', () => {
  it('uses the Kinka prior for zero or one record', () => {
    expect(localEvidence([], 780, '2026-10-30').weight).toBe(0);
    expect(localEvidence([row(750, 20)], 780, '2026-10-30').intervals).toBe(0);
  });
  it('combines two records with 30 minutes of prior evidence', () => {
    const evidence = localEvidence([row(730, 20), row(740, 16)], 780, '2026-10-30');
    expect(evidence).toMatchObject({ count: 4, minutes: 10, weight: .25 });
  });
  it('weights longer observation more without double-counting cancellations', () => {
    const evidence = localEvidence([row(720, 40), row(780, 20)], 800, '2026-10-30');
    expect(evidence.weight).toBeCloseTo(2 / 3); expect(evidence.count).toBe(20);
  });
  it('ignores future and different-day records and own deferral', () => {
    const evidence = localEvidence([row(720, 20), row(730, 30, 'self-defer'), row(740, 28), row(790, 1), row(741, 27, 'observation', { date: '2026-10-29' })], 780, '2026-10-30');
    expect(evidence.count).toBe(2); expect(evidence.minutes).toBe(10);
  });
});
