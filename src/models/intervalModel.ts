import type { Interval } from './observations.ts';

// Only service is fitted: cancellation and defer remain fixed, weakly identified priors.
export const BEHAVIOR = Object.freeze({ cancellation: 2 / 1518, defer: 0.0005, crossing: 0.5 });
export const behaviorRate = BEHAVIOR.cancellation + BEHAVIOR.defer * BEHAVIOR.crossing;
export interface Posterior { rates: number[]; weights: number[]; mean: number; low: number; high: number }

/** Exact pure-death transition q(r,r-1)=mu+h(r-1), integrating all event times.
 * Multiple decreases are neither simultaneous batches nor endpoint events.
 */
export function logTransition(startRank: number, endRank: number, minutes: number, mu: number, h = behaviorRate) {
  if (endRank < 1 || endRank > startRank || minutes < 0) return -Infinity;
  const k = startRank - endRank;
  if (minutes === 0) return k === 0 ? 0 : -Infinity;
  const logExposure = Math.log(h === 0 ? minutes : Math.expm1(h * minutes) / h);
  let logP = -(mu + h * (startRank - 1)) * minutes;
  for (let j = 1; j <= k; j++) logP += Math.log(mu + h * (startRank - j)) + logExposure - Math.log(j);
  return logP;
}

/** Gamma prior + exact interval likelihood on a logarithmic rate grid.
 * Terms independent of mu cancel. No observed event timestamps are reconstructed.
 */
export function fitService(intervals: Interval[], priorMean = 23 / 86, priorMinutes = 30): Posterior {
  const exposure = intervals.reduce((s, v) => s + v.end - v.start, 0);
  const count = intervals.reduce((s, v) => s + v.count, 0);
  const upper = Math.max(3, exposure ? 4 * count / exposure + 1 : 3);
  const logStep = Math.log(upper / 0.0001) / 512;
  const rates = Array.from({ length: 512 }, (_, i) => 0.0001 * Math.exp((i + 0.5) * logStep));
  const offsets = intervals.flatMap(v => Array.from({ length: v.count }, (_, j) => behaviorRate * (v.startRank - 1 - j)));
  // dmu=mu*dlog(mu) adds one log(mu) to the Gamma density.
  const logs = rates.map(mu => priorMean * priorMinutes * Math.log(mu) - (priorMinutes + exposure) * mu + offsets.reduce((s, h) => s + Math.log(mu + h), 0));
  const peak = Math.max(...logs);
  const mass = logs.map(v => Math.exp(v - peak));
  const sum = mass.reduce((s, v) => s + v, 0);
  const weights = mass.map(v => v / sum);
  const quantile = (p: number) => { let c = 0; return rates[weights.findIndex(w => (c += w) >= p)] ?? rates.at(-1)!; };
  return { rates, weights, mean: rates.reduce((s, r, i) => s + r * weights[i], 0), low: quantile(.05), high: quantile(.95) };
}

export function sampleRate(posterior: Posterior, u: number) {
  let cumulative = 0;
  for (let i = 0; i < posterior.rates.length; i++) if ((cumulative += posterior.weights[i]) >= u) return posterior.rates[i];
  return posterior.rates.at(-1)!;
}

/** Counts capped at rank-1; actual calling is a separate absorbing state. */
export function decreaseDistribution(rank: number, minutes: number, posterior: Posterior) {
  const mass = Array.from({ length: rank }, () => 0);
  posterior.rates.forEach((mu, i) => {
    let remaining = 1;
    for (let k = 0; k < rank - 1; k++) {
      const p = Math.exp(logTransition(rank, rank - k, minutes, mu));
      mass[k] += posterior.weights[i] * p;
      remaining -= p;
    }
    mass[rank - 1] += posterior.weights[i] * Math.max(0, remaining);
  });
  return mass;
}
