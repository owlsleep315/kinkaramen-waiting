import { MODEL, type ModelRates } from './modelConstants.ts';
import { ratesAt, validateQueue } from './waitingModel.ts';
import { randomFromSeed, empiricalQuantile } from './probability.ts';
export interface SimulationInput { total: number; rank: number; now: number; seed?: number; iterations?: number }
export interface CallSimulation { input: SimulationInput; iterations: number; calls: Float64Array[]; rankTimes: Float64Array[]; end: number; censorReason: 'horizon' }
export interface RankMilestone { rank: number; mean: number | null }
export interface PredictionInput extends SimulationInput { target: number; tolerance: number }
export interface Bin { time: number; probability: number; cumulative: number }
export interface PositionResult {
  callMean: number | null; callQ10: number | null; callQ90: number | null;
  rank: number; mean: number | null; median: number | null; q10: number | null; q25: number | null; q75: number | null; q90: number | null;
  bins: Bin[]; success: number; beforeWindow: number; afterWindow: number; beforeTarget: number; callBeforeArrival: number; missed: number; uncalled: number; admitted: number;
}
export interface PredictionResult { input: PredictionInput; positions: PositionResult[]; rankTimeline: RankMilestone[]; recommendedRank: number | null; iterations: number; end: number; censorReason: CallSimulation['censorReason'] }
export function createSimulation(input: SimulationInput): CallSimulation {
  const err = validateQueue(input.total, input.rank);
  if (err) throw new Error(err);
  if (!Number.isFinite(input.now) || input.now < 0 || input.now >= 1440) throw new Error('현재시각은 오늘의 유효한 시간이어야 해요.');
  const iterations = input.iterations ?? MODEL.iterations;
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 100_000) throw new Error('Invalid simulation size');
  const end = input.now + MODEL.horizonMinutes;
  return { input: { ...input }, iterations, end, censorReason: 'horizon', rankTimes: Array.from({ length: input.rank - 1 }, () => new Float64Array(iterations).fill(Infinity)), calls: Array.from({ length: input.total - input.rank + 1 }, () => new Float64Array(iterations).fill(Infinity)) };
}
/**
 * Counterfactual ranks share the same arrival/cancellation/service trajectory.
 * Cancellation and defer marks choose uniformly among OTHER teams in each world.
 * Each marginal is the stated CTMC; no personal team cancels or defers itself.
 */
export function runScenarios(out: CallSimulation, from: number, to: number, p: ModelRates = MODEL) {
  const { input, end, calls } = out;
  const ranks = new Int32Array(calls.length);
  for (let i = from; i < Math.min(to, out.iterations); i++) {
    const random = randomFromSeed(((input.seed ?? MODEL.seed) + Math.imul(i + 1, 0x9e3779b9)) >>> 0);
    let time = input.now, total = input.total, alive = ranks.length;
    for (let k = 0; k < ranks.length; k++) ranks[k] = input.rank + k;
    while (alive > 0 && time < end) {
      const rates = ratesAt(time, total, p);
      const sum = rates.service + rates.cancel + rates.defer + rates.arrival;
      const boundary = end;
      const dt = sum > 0 ? -Math.log(random()) / sum : Infinity;
      if (time + dt >= boundary) { time = boundary; continue; }
      time += dt;
      const previousRank = ranks[0];
      const event = random() * sum;
      if (event < rates.service) {
        const batch = random() < p.batchOfTwoProbability ? 2 : 1;
        for (let k = 0; k < ranks.length; k++) if (ranks[k] > 0) {
          if (ranks[k] <= batch) { calls[k][i] = time; ranks[k] = 0; alive--; }
          else ranks[k] -= batch;
        }
        total = Math.max(0, total - batch);
      } else if (event < rates.service + rates.cancel) {
        const otherIndex = Math.floor(random() * (total - 1)) + 1;
        for (let k = 0; k < ranks.length; k++) if (ranks[k] > otherIndex) ranks[k]--;
        total--;
      } else if (event < rates.service + rates.cancel + rates.defer) {
        const otherIndex = Math.floor(random() * (total - 1)) + 1;
        const destinationMark = random();
        for (let k = 0; k < ranks.length; k++) if (ranks[k] > 0) {
          const j = otherIndex >= ranks[k] ? otherIndex + 1 : otherIndex;
          if (j < ranks[k]) {
            const destination = j + 1 + Math.floor(destinationMark * (total - j));
            if (destination >= ranks[k]) ranks[k]--;
          }
        }
      } else total++;
      // Observe the unchanged current-rank path; record thresholds skipped by a batch too.
      for (let rank = previousRank - 1; rank >= Math.max(1, ranks[0]); rank--) {
        out.rankTimes[input.rank - 1 - rank][i] = time;
      }
    }
  }
}
export function simulate(input: SimulationInput, p: ModelRates = MODEL): CallSimulation {
  const out = createSimulation(input); runScenarios(out, 0, out.iterations, p); return out;
}
export function summarizeRankTimeline(out: CallSimulation): RankMilestone[] {
  return out.rankTimes.map((samples, index) => {
    const sum = samples.reduce((total, time) => total + time, 0);
    return { rank: out.input.rank - 1 - index, mean: Number.isFinite(sum) ? sum / out.iterations : null };
  });
}
export function summarize(out: CallSimulation, input: PredictionInput): PositionResult[] {
  if (!Number.isFinite(input.target) || input.target <= input.now || input.target >= 1440) throw new Error('도착시간은 현재보다 늦은 오늘 시간으로 선택해 주세요.');
  if (![5,10,15].includes(input.tolerance)) throw new Error('도착 후 허용 대기시간은 5, 10, 15분 중 선택해 주세요.');
  const start = Math.floor(input.now / 5) * 5;
  return out.calls.map((samples, k) => {
    const calls = Array.from(samples).filter(Number.isFinite).sort((a,b)=>a-b);
    const callMean = calls.length === out.iterations ? calls.reduce((sum,t)=>sum+t,0)/out.iterations : null;
    const callQ10 = empiricalQuantile(calls, out.iterations, .1);
    const callQ90 = empiricalQuantile(calls, out.iterations, .9);
    const bins: Bin[] = Array.from({ length: Math.max(1, Math.ceil((out.end - start) / 5)) }, (_, i) => ({ time: start + i * 5, probability: 0, cumulative: 0 }));
    const admitted: number[] = [];
    let success=0, beforeWindow=0, afterWindow=0, beforeTarget=0, callBeforeArrival=0, missed=0, uncalled=0;
    for (const call of samples) {
      if (!Number.isFinite(call)) { uncalled++; continue; }
      if (call < input.target) callBeforeArrival++;
      if (call < input.target - MODEL.graceMinutes) { missed++; continue; }
      const entry = Math.max(call, input.target);
      if (entry >= out.end) { uncalled++; continue; }
      admitted.push(entry);
      bins[Math.min(bins.length-1, Math.floor((entry-start)/5))].probability++;
      if (call <= input.target + input.tolerance) success++;
      else afterWindow++;
      if (entry <= input.target) beforeTarget++;
    }
    admitted.sort((a,b)=>a-b);
    let cumulative = 0;
    for (const bin of bins) { bin.probability /= out.iterations; cumulative += bin.probability; bin.cumulative=cumulative; }
    const q = (p: number) => empiricalQuantile(admitted, out.iterations, p);
    return { callMean, callQ10, callQ90, rank: input.rank + k, mean: admitted.length ? admitted.reduce((a,b)=>a+b,0)/admitted.length:null, median:q(.5),q10:q(.1),q25:q(.25),q75:q(.75),q90:q(.9),bins,success:success/out.iterations,beforeWindow:beforeWindow/out.iterations,afterWindow:afterWindow/out.iterations,beforeTarget:beforeTarget/out.iterations,callBeforeArrival:callBeforeArrival/out.iterations,missed:missed/out.iterations,uncalled:uncalled/out.iterations,admitted:admitted.length/out.iterations };
  });
}
