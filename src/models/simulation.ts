import { MODEL } from './modelConstants.ts';
import { nextProgress, validateRank, type LocalEvidence } from './waitingModel.ts';
import { gamma, normal } from './fitting.ts';
import { randomFromSeed, empiricalQuantile } from '../utils/probability.ts';
export interface SimulationInput { rank: number; now: number; mode: 'kinka' | 'custom'; evidence?: LocalEvidence; seed?: number; iterations?: number; maxCandidate?: number }
export interface PredictionInput extends SimulationInput { target: number; tolerance: number }
export interface CallSimulation { input: SimulationInput; iterations: number; calls: Float64Array[]; rankTimes: Float64Array[]; end: number }
export interface RankMilestone { rank: number; mean: number | null }
export interface Bin { time: number; probability: number; cumulative: number }
export interface PositionResult {
  rank: number; mean: number | null; median: number | null;
  q05: number | null; q10: number | null; q25: number | null; q75: number | null; q90: number | null; q95: number | null;
  bins: Bin[]; success: number; onArrival: number; callBeforeArrival: number; missed: number; afterWindow: number; uncalled: number;
  expectedWait: number | null;
}
export interface PredictionResult { input: PredictionInput; positions: PositionResult[]; rankTimeline: RankMilestone[]; recommendedRank: number | null; feasibleRank: number | null; iterations: number; end: number; searchLimited: boolean }
export function createSimulation(input: SimulationInput): CallSimulation {
  const error = validateRank(input.rank);
  if (error) throw new Error(error);
  if (!Number.isFinite(input.now) || input.now < 0 || input.now >= 1440) throw new Error('현재 시각이 올바르지 않아요.');
  const iterations = input.iterations ?? MODEL.iterations;
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 100000) throw new Error('Invalid simulation size');
  const count = input.maxCandidate ?? Math.min(MODEL.maxRank, Math.max(80, input.rank + 20));
  if (!Number.isInteger(count) || count < input.rank || count > MODEL.maxRank) throw new Error('Invalid candidate range');
  return { input, iterations, end: Math.min(1440, input.now + MODEL.horizonMinutes),
    calls: Array.from({ length: count }, () => new Float64Array(iterations).fill(Infinity)),
    rankTimes: Array.from({ length: input.rank - 1 }, () => new Float64Array(iterations).fill(Infinity)) };
}
export function runScenarios(out: CallSimulation, from: number, to: number) {
  const { input, iterations, calls, end } = out;
  for (let i = from; i < Math.min(to, iterations); i++) {
    const random = randomFromSeed(((input.seed ?? MODEL.seed) + Math.imul(i + 1, 0x9e3779b9)) >>> 0);
    let rates = [...MODEL.posteriorDraws[Math.floor(random() * MODEL.posteriorDraws.length)]];
    let callScale = 1;
    const evidence = input.evidence;
    if (input.mode === 'custom' && evidence && evidence.intervals > 0) {
      const lambda = gamma(evidence.priorMean * MODEL.customMinutes + evidence.count, MODEL.customMinutes + evidence.minutes, random);
      rates = [lambda, lambda, lambda];
      callScale = lambda / evidence.priorMean;
    }
    // Day-to-day heterogeneity and final-call uncertainty are explicit priors, not measured precision.
    const day = gamma(MODEL.dayShape, MODEL.dayShape, random);
    rates = rates.map(r => r * day);
    const callRate = MODEL.callRate * callScale * day * Math.exp(MODEL.callLogSigma * normal(random) - MODEL.callLogSigma ** 2 / 2);
    const finalWait = -Math.log(random()) / callRate;
    let time = input.mode === 'kinka' ? Math.max(input.now, MODEL.openingMinute) : input.now;
    for (let rank = 1; rank <= calls.length; rank++) {
      if (rank > 1) time = nextProgress(time, -Math.log(random()), rates, end);
      const call = time + finalWait;
      if (call < end) calls[rank - 1][i] = call;
      // r-1 natural decreases reach rank 1; a distinct service wait then triggers the call.
      if (rank >= 2 && rank <= input.rank) out.rankTimes[rank - 2][i] = time;
    }
  }
}
export function simulate(input: SimulationInput) {
  const out = createSimulation(input); runScenarios(out, 0, out.iterations); return out;
}
export function summarizeRankTimeline(out: CallSimulation): RankMilestone[] {
  return out.rankTimes.map((values, index) => {
    const sum = values.reduce((s, t) => s + t, 0);
    return { rank: out.input.rank - 1 - index, mean: Number.isFinite(sum) ? sum / out.iterations : null };
  });
}
export function summarize(out: CallSimulation, input: PredictionInput): PositionResult[] {
  if (!Number.isFinite(input.target) || input.target <= input.now || input.target >= 1440) throw new Error('도착시간은 현재보다 늦은 오늘 시간으로 선택해 주세요.');
  if (![5, 10, 15].includes(input.tolerance)) throw new Error('허용 대기는 5, 10, 15분 중 선택해 주세요.');
  const start = Math.floor(input.now / 5) * 5;
  return out.calls.map((samples, index) => {
    const finite = Array.from(samples).filter(Number.isFinite).sort((a, b) => a - b);
    const q = (p: number) => empiricalQuantile(finite, out.iterations, p);
    const bins: Bin[] = Array.from({ length: Math.ceil((out.end - start) / 5) }, (_, i) => ({ time: start + i * 5, probability: 0, cumulative: 0 }));
    let success = 0, onArrival = 0, callBeforeArrival = 0, missed = 0, afterWindow = 0, uncalled = 0, wait = 0;
    for (const call of samples) {
      if (!Number.isFinite(call)) { uncalled++; continue; }
      bins[Math.min(bins.length - 1, Math.floor((call - start) / 5))].probability++;
      if (call <= input.target) callBeforeArrival++;
      if (call < input.target - MODEL.graceMinutes) { missed++; continue; }
      if (call <= input.target) onArrival++;
      if (call <= input.target + input.tolerance) success++; else afterWindow++;
      wait += Math.max(0, call - input.target);
    }
    let cumulative = 0;
    for (const bin of bins) { bin.probability /= out.iterations; cumulative += bin.probability; bin.cumulative = cumulative; }
    return { rank: index + 1, mean: finite.length === out.iterations ? finite.reduce((s, t) => s + t, 0) / out.iterations : null,
      median: q(.5), q05: q(.05), q10: q(.1), q25: q(.25), q75: q(.75), q90: q(.9), q95: q(.95), bins,
      success: success / out.iterations, onArrival: onArrival / out.iterations, callBeforeArrival: callBeforeArrival / out.iterations,
      missed: missed / out.iterations, afterWindow: afterWindow / out.iterations, uncalled: uncalled / out.iterations,
      expectedWait: out.iterations - missed - uncalled > 0 ? wait / (out.iterations - missed - uncalled) : null };
  });
}
