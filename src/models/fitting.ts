import { exposures, type Interval } from './observations.ts';
import { randomFromSeed } from '../utils/probability.ts';

export const PRIOR = { mean: 0.30, minutes: 60, dayShape: 16, callRate: (23 / 86) / 1.15, callLogSigma: 0.35, customMinutes: 30 };
export function normal(random: () => number) {
  return Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
}
export function gamma(shape: number, rate: number, random: () => number): number {
  if (shape < 1) return gamma(shape + 1, rate, random) * random() ** (1 / shape);
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const x = normal(random), v = (1 + c * x) ** 3;
    if (v <= 0) continue;
    const u = random();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < x * x / 2 + d * (1 - v + Math.log(v))) return d * v / rate;
  }
}
/** Bayesian interval-count likelihood: k_i ~ Poisson(sum_b exposure_ib * lambda_b).
 * Gibbs allocations are latent counts, never asserted event times or saved as observations.
 * Weakly regularized 3-bin model; day variability is a stated predictive assumption.
 */
export function fitRates(intervals: Interval[], seed = 20261030) {
  const random = randomFromSeed(seed);
  const valid = intervals.filter(i => i.start >= 660 && i.end <= 1440);
  const xs = valid.map(i => exposures(i.start, i.end));
  const totalExposure = [0, 1, 2].map(b => xs.reduce((s, x) => s + x[b], 0));
  let rates = [PRIOR.mean, PRIOR.mean, PRIOR.mean];
  const draws: number[][] = [];
  for (let step = 0; step < 2400; step++) {
    const counts = [0, 0, 0];
    valid.forEach((interval, i) => {
      const weights = rates.map((r, b) => r * xs[i][b]);
      const sum = weights.reduce((a, b) => a + b, 0);
      for (let k = 0; k < interval.count; k++) {
        const u = random() * sum;
        counts[u < weights[0] ? 0 : u < weights[0] + weights[1] ? 1 : 2]++;
      }
    });
    rates = rates.map((_, b) => gamma(PRIOR.mean * PRIOR.minutes + counts[b], PRIOR.minutes + totalExposure[b], random));
    if (step >= 800 && step % 5 === 0) draws.push([...rates]);
  }
  const means = [0, 1, 2].map(b => draws.reduce((s, row) => s + row[b], 0) / draws.length);
  return { rates: means, posteriorDraws: draws, exposureMinutes: totalExposure,
    observedCount: valid.reduce((s, i) => s + i.count, 0), intervalCount: valid.length,
    minutesPerStep: valid.reduce((s, i) => s + i.end - i.start, 0) / valid.reduce((s, i) => s + i.count, 0) };
}
