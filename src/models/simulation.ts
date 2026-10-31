import { MODEL, KINKA_POSTERIOR } from './modelConstants';
import { localModel, rankRate, validateRank } from './waitingModel';
import { BEHAVIOR, sampleRate, type Posterior } from './intervalModel';
import type { Observation } from './observations';
import { randomFromSeed, empiricalQuantile } from '../utils/probability';
export interface SimulationInput {
  rank: number; now: number; mode?: 'kinka' | 'other'; date?: string;
  observations?: Observation[]; seed?: number; iterations?: number;
}
export interface ModelInfo {
  service: number; minutes: number; count: number; intervals: number; excluded: number; otherDates: number; future: number;
  cancellation: number; defer: number; crossing: number; stepMinutes: number[];
}
export interface CallSimulation {
  input: SimulationInput; iterations: number; calls: Float64Array[]; rankTimes: Float64Array[];
  end: number; censorReason: 'horizon'; posterior: Posterior; modelInfo: ModelInfo;
}
export interface RankMilestone { rank: number; mean: number | null }
export interface PredictionInput extends SimulationInput { target: number; tolerance: number }
export interface Bin { time: number; probability: number; cumulative: number }
export interface PositionResult {
  rank: number; callMean: number | null; median: number | null;
  q05: number | null; callQ10: number | null; q25: number | null; q75: number | null; callQ90: number | null; q95: number | null;
  bins: Bin[]; success: number; afterWindow: number; beforeTarget: number;
  callBeforeArrival: number; missed: number; uncalled: number; admitted: number; expectedWait: number | null;
}
export interface PredictionResult {
  input: PredictionInput; positions: PositionResult[]; rankTimeline: RankMilestone[];
  recommendedRank: number | null; iterations: number; end: number; censorReason: 'horizon'; modelInfo: ModelInfo;
}
export function createSimulation(input: SimulationInput): CallSimulation {
  const err = validateRank(input.rank);
  if (err) throw new Error(err);
  if (!Number.isFinite(input.now) || input.now < 0 || input.now >= 1440) throw new Error('현재시각을 확인해 주세요.');
  const iterations = input.iterations ?? MODEL.iterations;
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 100_000) throw new Error('Invalid simulation size');
  const local = input.mode === 'other' ? localModel(input.observations ?? [], input.date ?? '', input.now) : null;
  if (local?.needsObservation) throw new Error('기록은 2개 이상이지만 시간 차이가 있는 유효 구간이 없어요. 다음 분 이후 현재 순서로 다시 예측해 주세요.');
  const posterior = local?.posterior ?? KINKA_POSTERIOR;
  const modelInfo: ModelInfo = {
    service: posterior.mean, minutes: local?.minutes ?? 0, count: local?.count ?? 0, intervals: local?.intervals ?? 0,
    excluded: local?.excluded ?? 0, otherDates: local?.otherDates ?? 0, future: local?.future ?? 0,
    cancellation: BEHAVIOR.cancellation, defer: BEHAVIOR.defer, crossing: BEHAVIOR.crossing,
    stepMinutes: Array.from({ length: MODEL.maxRank }, (_, i) => posterior.rates.reduce((sum, rate, j) => sum + posterior.weights[j] / rankRate(i + 1, rate), 0)),
  };
  return {
    input: { ...input }, iterations, end: Math.min(1440, input.now + MODEL.horizonMinutes), censorReason: 'horizon', posterior, modelInfo,
    rankTimes: Array.from({ length: input.rank - 1 }, () => new Float64Array(iterations).fill(Infinity)),
    calls: Array.from({ length: MODEL.maxRank }, () => new Float64Array(iterations).fill(Infinity)),
  };
}
/** Shared positive holding times couple all theoretical ranks monotonically.
 * At rank 1 only service calls the user; others' cancellation/defer cannot call them.
 */
export function runScenarios(out: CallSimulation, from: number, to: number) {
  const start = out.input.mode === 'other' ? out.input.now : Math.max(660, out.input.now);
  for (let i = from; i < Math.min(to, out.iterations); i++) {
    const random = randomFromSeed(((out.input.seed ?? MODEL.seed) + Math.imul(i + 1, 0x9e3779b9)) >>> 0);
    const service = sampleRate(out.posterior, random());
    const waits: number[] = [];
    let time = start;
    for (let rank = 1; rank <= MODEL.maxRank; rank++) {
      const wait = -Math.log(random()) / rankRate(rank, service);
      waits.push(wait);
      time += wait;
      if (time < out.end) out.calls[rank - 1][i] = time;
    }
    time = start;
    for (let rank = out.input.rank; rank > 1; rank--) {
      time += waits[rank - 1];
      if (time < out.end) out.rankTimes[out.input.rank - rank][i] = time;
    }
  }
}
export function simulate(input: SimulationInput): CallSimulation {
  const out = createSimulation(input); runScenarios(out, 0, out.iterations); return out;
}
export function summarizeRankTimeline(out: CallSimulation): RankMilestone[] {
  return out.rankTimes.map((samples, index) => {
    const sum = samples.reduce((total, time) => total + time, 0);
    return { rank: out.input.rank - 1 - index, mean: Number.isFinite(sum) ? sum / out.iterations : null };
  });
}
export function summarize(out: CallSimulation, input: PredictionInput): PositionResult[] {
  if (!Number.isFinite(input.target) || input.target <= input.now || input.target >= 1440) throw new Error('도착시간은 현재보다 늦은 오늘 시간으로 선택해 주세요.');
  if (![5,10,15].includes(input.tolerance)) throw new Error('허용 대기는 5, 10, 15분 중 선택해 주세요.');
  const start = Math.floor(input.now / 5) * 5;
  return out.calls.map((samples, k) => {
    const calls = Array.from(samples).filter(Number.isFinite).sort((a,b) => a-b);
    const q = (p: number) => empiricalQuantile(calls, out.iterations, p);
    const bins: Bin[] = Array.from({ length: Math.max(1, Math.ceil((out.end - start) / 5)) }, (_, i) => ({ time: start + i * 5, probability: 0, cumulative: 0 }));
    let success = 0, afterWindow = 0, beforeTarget = 0, callBeforeArrival = 0, missed = 0, wait = 0, admitted = 0;
    for (const call of calls) {
      bins[Math.min(bins.length - 1, Math.floor((call - start) / 5))].probability++;
      if (call <= input.target) callBeforeArrival++;
      if (call < input.target - MODEL.graceMinutes) { missed++; continue; }
      admitted++; wait += Math.max(0, call - input.target);
      if (call <= input.target) beforeTarget++;
      if (call <= input.target + input.tolerance) success++; else afterWindow++;
    }
    let cumulative = 0;
    for (const bin of bins) { bin.probability /= out.iterations; cumulative += bin.probability; bin.cumulative = cumulative; }
    return {
      rank: k + 1, callMean: calls.length === out.iterations ? calls.reduce((s, t) => s+t, 0) / out.iterations : null,
      median: q(.5), q05: q(.05), callQ10: q(.1), q25: q(.25), q75: q(.75), callQ90: q(.9), q95: q(.95), bins,
      success: success / out.iterations, afterWindow: afterWindow / out.iterations, beforeTarget: beforeTarget / out.iterations,
      callBeforeArrival: callBeforeArrival / out.iterations, missed: missed / out.iterations,
      uncalled: 1 - calls.length / out.iterations, admitted: admitted / out.iterations, expectedWait: admitted ? wait / admitted : null,
    };
  });
}
