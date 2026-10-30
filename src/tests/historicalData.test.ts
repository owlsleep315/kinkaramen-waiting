import { describe, expect, it } from 'vitest';
import observations from '../data/observations.json';
import fitted from '../data/fittedModel.json';
import { buildIntervals, type Observation } from '../models/observations';
import { fitService } from '../models/intervalModel';
const rows = observations as Observation[];
const observation = (id: string, time: number, rank: number, kind: Observation['kind'] = 'observation'): Observation => ({ id, date: '2026-10-30', time, rank, kind });
describe('interval observations', () => {
  it('fits the supplied two dates once and reproduces the fixed coefficients', () => {
    const { intervals } = buildIntervals(rows);
    expect(intervals).toHaveLength(47);
    expect(intervals.reduce((s, v) => s + v.end - v.start, 0)).toBe(223);
    expect(intervals.reduce((s, v) => s + v.count, 0)).toBe(72);
    const p = fitService(intervals);
    expect(p.mean).toBeCloseTo(fitted.posterior.mean, 12);
    p.weights.forEach((w, i) => expect(w).toBeCloseTo(fitted.posterior.weights[i], 12));
  });
  it('multiple decreases are one interval count with no event timestamps', () => {
    const { intervals } = buildIntervals([observation('a', 730, 18), observation('b', 737, 16)]);
    expect(intervals[0]).toMatchObject({ start: 730, end: 737, count: 2 });
    expect('eventTimes' in intervals[0]).toBe(false);
  });
  it('same-time ambiguity breaks the chain rather than inventing order', () => {
    const data = [observation('a', 730, 20), observation('b', 735, 18), observation('c', 735, 16), observation('d', 740, 14), observation('e', 745, 13)];
    expect(buildIntervals(data).intervals).toHaveLength(1);
    expect(buildIntervals(data).excluded).toHaveLength(2);
  });
  it('zero decreases and long intervals are valid exposure', () => {
    const { intervals } = buildIntervals([observation('a', 730, 20), observation('b', 760, 20), observation('c', 800, 15)]);
    expect(intervals.map(v => v.count)).toEqual([0, 5]);
    expect(intervals[1].end - intervals[1].start).toBe(40);
  });
  it('explicit ordered pre/post defer splits 11:22 correctly', () => {
    const { intervals } = buildIntervals(rows);
    expect(intervals.find(i => i.date === '2026-10-30' && i.start === 666)).toMatchObject({ end: 682, count: 11 });
    expect(intervals.find(i => i.date === '2026-10-30' && i.start === 682)).toMatchObject({ end: 688, startRank: 33, count: 1 });
  });
  it('mixed self-defer intervals are excluded, then resumed from the new rank', () => {
    const { intervals } = buildIntervals([observation('a', 730, 10), observation('b', 735, 20, 'self-defer'), observation('c', 740, 18)]);
    expect(intervals).toHaveLength(1); expect(intervals[0].startRank).toBe(20);
  });
  it('does not invent decreases for an unexplained increase', () => {
    const data = [observation('a', 730, 10), observation('b', 735, 20), observation('c', 740, 18)];
    expect(buildIntervals(data).intervals).toHaveLength(1);
  });
  it('deduplicates rows and isolates dates', () => {
    const data = [observation('a', 730, 10), observation('b', 735, 8)];
    expect(buildIntervals([...data, ...data]).intervals).toEqual(buildIntervals(data).intervals);
    expect(buildIntervals([data[0], { ...data[1], date: '2026-10-31' }]).intervals).toHaveLength(0);
  });
  it('preserves contradictory notes and reopening without a cutoff', () => {
    expect(rows.find(r => r.date === '2026-10-29' && r.time === 666)?.flags?.length).toBeGreaterThan(0);
    expect(rows.some(r => r.note?.includes('추가 오픈'))).toBe(true);
    expect(buildIntervals(rows).intervals.some(i => i.date === '2026-10-30' && i.start === 766 && i.end === 773)).toBe(true);
  });
});
