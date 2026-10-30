import { readFileSync, writeFileSync } from 'node:fs';
import { buildIntervals, exposures, type Observation, type Interval } from '../src/models/observations.ts';
import { fitRates, gamma, PRIOR } from '../src/models/fitting.ts';
import { nextProgress } from '../src/models/waitingModel.ts';
import { randomFromSeed } from '../src/utils/probability.ts';
import { createSimulation, runScenarios } from './legacy/simulation.ts';
const rows: Observation[] = JSON.parse(readFileSync('src/data/observations.json', 'utf8'));
const { intervals } = buildIntervals(rows);
const ITERATIONS = 6000;
function scores(interval: Interval, predictions: number[]) {
  const values = predictions.sort((a, b) => a - b), mean = values.reduce((a, b) => a + b, 0) / values.length;
  const q = (p: number) => values[Math.ceil(p * values.length) - 1];
  const probability = values.filter(n => n >= 2).length / values.length;
  return { date: interval.date, start: interval.start, end: interval.end, observed: interval.count, mean,
    absoluteError: Math.abs(interval.count - mean), coverage80: Number(interval.count >= q(.1) && interval.count <= q(.9)),
    coverage90: Number(interval.count >= q(.05) && interval.count <= q(.95)),
    pAtLeast2: probability, brier: (probability - Number(interval.count >= 2)) ** 2 };
}
function predictNew(interval: Interval, draws: number[][]) {
  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const random = randomFromSeed(1000 + i), day = gamma(PRIOR.dayShape, PRIOR.dayShape, random);
    const rates = draws[Math.floor(random() * draws.length)].map(r => r * day);
    let time = interval.start, count = 0;
    while (count < interval.startRank - 1) {
      time = nextProgress(time, -Math.log(random()), rates, interval.end);
      if (!Number.isFinite(time)) break;
      count++;
    }
    samples.push(count);
  }
  return scores(interval, samples);
}
function predictLegacy(interval: Interval) {
  const simulation = createSimulation({ total: interval.total!, rank: interval.startRank, now: interval.start, iterations: ITERATIONS });
  simulation.end = interval.end;
  runScenarios(simulation, 0, ITERATIONS);
  return scores(interval, Array.from({ length: ITERATIONS }, (_, i) => simulation.rankTimes.reduce((n, times) => n + Number(Number.isFinite(times[i])), 0)));
}
function aggregate(results: ReturnType<typeof scores>[]) {
  const avg = (key: 'absoluteError' | 'coverage80' | 'coverage90' | 'brier') => results.reduce((s, r) => s + r[key], 0) / results.length;
  return { n: results.length, maeRanks: avg('absoluteError'), coverage80: avg('coverage80'), coverage90: avg('coverage90'), brierAtLeast2: avg('brier'),
    calibration: [0, .25, .5, .75].map(low => { const items = results.filter(r => r.pAtLeast2 >= low && r.pAtLeast2 < low + .25 + (low === .75 ? 1e-9 : 0)); return { low, high: low + .25, n: items.length, predicted: items.length ? items.reduce((s, r) => s + r.pAtLeast2, 0) / items.length : null, observed: items.length ? items.filter(r => r.observed >= 2).length / items.length : null }; }) };
}
// All origins use only their current state; fit uses only the other date.
const folds = [...new Set(rows.map(r => r.date))].map(date => {
  const train = intervals.filter(i => i.date !== date), test = intervals.filter(i => i.date === date && i.total !== undefined);
  const fit = fitRates(train);
  const newer = test.map(i => predictNew(i, fit.posteriorDraws)), legacy = test.map(predictLegacy);
  // Predict 10–30 minute endpoints within contiguous no-self-defer segments.
  const extended: Interval[] = [];
  for (let i = 0; i < test.length; i++) {
    let count = 0, end = test[i].start;
    for (let j = i; j < test.length && test[j].start === end; j++) {
      count += test[j].count; end = test[j].end;
      if (end - test[i].start > 30) break;
      if (end - test[i].start >= 10) extended.push({ ...test[i], count, end });
    }
  }
  const multiNew = extended.map(i => predictNew(i, fit.posteriorDraws)), multiOld = extended.map(predictLegacy);
  return { heldOutDate: date, fittedRates: fit.rates, oneStep: { new: aggregate(newer), legacy: aggregate(legacy) }, multiStep10to30: { new: aggregate(multiNew), legacy: aggregate(multiOld) }, details: { new: newer, legacy, multiNew, multiOld } };
});
const pooled = { new: aggregate(folds.flatMap(f => f.details.new)), legacy: aggregate(folds.flatMap(f => f.details.legacy)) };
const full = fitRates(intervals);
const report = { methodology: 'Leave-one-date-out; observed rank decrease counts, censored at rank 1. Exact legacy simulation. Legacy fixed coefficients already use Oct 29; comparison on that fold has baseline training leakage. Multi-step windows overlap. Call-time accuracy unavailable.',
  coefficientSummary: { rawMinutesPerStep: full.minutesPerStep, rates: full.rates, prior: PRIOR, integratedExposures: intervals.map(i => exposures(i.start, i.end)) }, pooledOneStep: pooled, folds };
writeFileSync('docs/validation-results.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ pooled, folds: folds.map(({ details: _details, ...f }) => f) }, null, 2));
