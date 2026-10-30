import { MODEL } from './modelConstants.ts';
import { buildIntervals, type Observation } from './observations.ts';
export interface LocalEvidence { count: number; minutes: number; intervals: number; excluded: number; priorMean: number; weight: number }
export function validateRank(rank: number) {
  return Number.isInteger(rank) && rank >= 1 && rank <= MODEL.maxRank ? null : `내 순서는 1~${MODEL.maxRank} 사이의 정수로 입력해 주세요.`;
}
export function rateAt(time: number, rates: readonly number[] = MODEL.rates) {
  return rates[time < 720 ? 0 : time < 780 ? 1 : 2];
}
/** Invert the integrated piecewise hazard, with no invented observation-event times. */
export function nextProgress(time: number, hazard: number, rates: readonly number[], end: number): number {
  while (time < end) {
    const boundary = Math.min(time < 720 ? 720 : time < 780 ? 780 : end, end);
    const rate = rateAt(time, rates), mass = (boundary - time) * rate;
    if (rate > 0 && hazard < mass) return time + hazard / rate;
    hazard -= mass; time = boundary;
  }
  return Infinity;
}
export function localEvidence(rows: Observation[], now: number, date: string): LocalEvidence {
  const eligible = rows.filter(r => r.date === date && r.time <= now);
  const { intervals, excluded } = buildIntervals(eligible);
  const minutes = intervals.reduce((s, i) => s + i.end - i.start, 0);
  const count = intervals.reduce((s, i) => s + i.count, 0);
  // Keep the transfer prior fixed at the session's first observation, not at the live clock.
  const priorMean = rateAt(eligible.slice().sort((a, b) => a.time - b.time)[0]?.time ?? now);
  return { count, minutes, intervals: intervals.length, excluded: excluded.length, priorMean, weight: minutes / (MODEL.customMinutes + minutes) };
}
