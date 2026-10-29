import { MODEL, type ModelRates } from './modelConstants';
import { nextBoundary, ratesAt, validateQueue } from './waitingModel';
import { randomFromSeed, empiricalQuantile } from '../utils/probability';
export interface SimulationInput { total: number; rank: number; now: number; seed?: number; iterations?: number }
export interface CallSimulation { input: SimulationInput; iterations: number; calls: Float64Array[]; end: number; censorReason: 'closing' | 'horizon' }
export interface PredictionInput extends SimulationInput { target: number; tolerance: number; arrival?: number }
export interface Bin { time: number; probability: number; cumulative: number }
export interface PositionResult {
  rank: number; mean: number | null; median: number | null; q10: number | null; q25: number | null; q75: number | null; q90: number | null;
  bins: Bin[]; success: number; beforeWindow: number; afterWindow: number; beforeTarget: number; callBeforeArrival: number; missed: number; uncalled: number; admitted: number;
}
export interface PredictionResult { input: PredictionInput; positions: PositionResult[]; recommendedRank: number | null; iterations: number; end: number; censorReason: CallSimulation['censorReason']; modelVersion: string }
export function createSimulation(input: SimulationInput): CallSimulation {
  const err = validateQueue(input.total, input.rank);
  if (err) throw new Error(err);
  if (!Number.isFinite(input.now) || input.now < MODEL.registrationOpen) throw new Error('웨이팅 등록은 10:30부터 시작해요. 등록 후 예측해 주세요.');
  if (input.now >= MODEL.serviceClose) throw new Error('모델의 점심 영업시간(11:00~14:30)이 끝났어요.');
  const iterations = input.iterations ?? MODEL.iterations;
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 100_000) throw new Error('Invalid simulation size');
  const end = Math.min(MODEL.serviceClose, input.now + MODEL.horizonMinutes);
  return { input: { ...input }, iterations, end, censorReason: end === MODEL.serviceClose ? 'closing' : 'horizon', calls: Array.from({ length: input.total - input.rank + 1 }, () => new Float64Array(iterations).fill(Infinity)) };
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
      const boundary = nextBoundary(time, end);
      const dt = sum > 0 ? -Math.log(random()) / sum : Infinity;
      if (time + dt >= boundary) { time = boundary; continue; }
      time += dt;
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
    }
  }
}
export function simulate(input: SimulationInput, p: ModelRates = MODEL): CallSimulation {
  const out = createSimulation(input); runScenarios(out, 0, out.iterations, p); return out;
}
export function summarize(out: CallSimulation, input: PredictionInput): PositionResult[] {
  if (!Number.isFinite(input.target) || input.target <= input.now || input.target >= 1440) throw new Error('목표시간은 현재보다 늦은 오늘 시간으로 선택해 주세요.');
  if (![5,10,15].includes(input.tolerance)) throw new Error('허용 오차는 5, 10, 15분 중 선택해 주세요.');
  if (input.arrival !== undefined && (!Number.isFinite(input.arrival) || input.arrival < input.now || input.arrival >= 1440)) throw new Error('도착 예정시간은 현재 이후의 오늘 시간으로 입력해 주세요.');
  const start = Math.floor(input.now / 5) * 5;
  return out.calls.map((samples, k) => {
    const bins: Bin[] = Array.from({ length: Math.max(1, Math.ceil((out.end - start) / 5)) }, (_, i) => ({ time: start + i * 5, probability: 0, cumulative: 0 }));
    const admitted: number[] = [];
    let success=0, beforeWindow=0, afterWindow=0, beforeTarget=0, callBeforeArrival=0, missed=0, uncalled=0;
    for (const call of samples) {
      if (!Number.isFinite(call)) { uncalled++; continue; }
      if (input.arrival !== undefined && call < input.arrival) callBeforeArrival++;
      if (input.arrival !== undefined && input.arrival > call + MODEL.graceMinutes) { missed++; continue; }
      const entry = Math.max(call, input.arrival ?? call);
      if (entry >= out.end) { uncalled++; continue; }
      admitted.push(entry);
      bins[Math.min(bins.length-1, Math.floor((entry-start)/5))].probability++;
      if (entry < input.target - input.tolerance) beforeWindow++;
      else if (entry <= input.target + input.tolerance) success++;
      else afterWindow++;
      if (entry <= input.target) beforeTarget++;
    }
    admitted.sort((a,b)=>a-b);
    let cumulative = 0;
    for (const bin of bins) { bin.probability /= out.iterations; cumulative += bin.probability; bin.cumulative=cumulative; }
    const q = (p: number) => empiricalQuantile(admitted, out.iterations, p);
    return { rank: input.rank + k, mean: admitted.length ? admitted.reduce((a,b)=>a+b,0)/admitted.length:null, median:q(.5),q10:q(.1),q25:q(.25),q75:q(.75),q90:q(.9),bins,success:success/out.iterations,beforeWindow:beforeWindow/out.iterations,afterWindow:afterWindow/out.iterations,beforeTarget:beforeTarget/out.iterations,callBeforeArrival:callBeforeArrival/out.iterations,missed:missed/out.iterations,uncalled:uncalled/out.iterations,admitted:admitted.length/out.iterations };
  });
}
