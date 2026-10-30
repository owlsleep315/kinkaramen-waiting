import { readFileSync, writeFileSync } from 'node:fs';
import { buildIntervals, type Observation } from '../src/models/observations.ts';
import { fitService, decreaseDistribution } from '../src/models/intervalModel.ts';
import { simulate as baseline } from './baseline/simulation.ts';
const rows = JSON.parse(readFileSync(new URL('../src/data/observations.json', import.meta.url), 'utf8')) as Observation[];
const { intervals } = buildIntervals(rows);
const dates = [...new Set(rows.map(r => r.date))];
const metrics = (mass: number[], actual: number) => {
  const mean = mass.reduce((s, p, k) => s + p * k, 0);
  const q = (p: number) => { let c = 0; return mass.findIndex(w => (c += w) >= p); };
  const p2 = mass.slice(2).reduce((a, b) => a + b, 0);
  return { mean, ae: Math.abs(actual - mean), covered80: Number(actual >= q(.1) && actual <= q(.9)), covered90: Number(actual >= q(.05) && actual <= q(.95)), brier2: (p2 - Number(actual >= 2)) ** 2 };
};
const results = intervals.map(interval => {
  const posterior = fitService(intervals.filter(i => i.date !== interval.date));
  const newer = decreaseDistribution(interval.startRank, interval.end - interval.start, posterior);
  const old = baseline({ total: interval.total ?? interval.startRank, rank: interval.startRank, now: interval.start, iterations: 3000 });
  const oldMass = new Array(interval.startRank).fill(0);
  for (let i = 0; i < old.iterations; i++) {
    const decrease = old.rankTimes.filter(samples => samples[i] <= interval.end).length;
    oldMass[decrease] += 1 / old.iterations;
  }
  return { ...interval, previous: metrics(oldMass, interval.count), updated: metrics(newer, interval.count) };
});
function summarize(date?: string) {
  const selected = results.filter(r => !date || r.date === date);
  const avg = (model: 'previous' | 'updated', key: 'ae' | 'covered80' | 'covered90' | 'brier2') => selected.reduce((s, r) => s + r[model][key], 0) / selected.length;
  return { date: date ?? 'pooled', n: selected.length, previous: { mae: avg('previous', 'ae'), coverage80: avg('previous', 'covered80'), coverage90: avg('previous', 'covered90'), brier2: avg('previous', 'brier2') }, updated: { mae: avg('updated', 'ae'), coverage80: avg('updated', 'covered80'), coverage90: avg('updated', 'covered90'), brier2: avg('updated', 'brier2') } };
}
const report = { note: 'Leave-one-date-out rank decrease prediction. Original model was developed on A: baseline has leakage on A. Actual call times are unavailable. Intervals within a date are not independent.', summary: [...dates.map(d => summarize(d)), summarize()], results };
writeFileSync(new URL('../docs/validation-results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.summary, null, 2));
