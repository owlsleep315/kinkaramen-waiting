import { createSimulation, runScenarios, summarize, summarizeRankTimeline, type CallSimulation, type PredictionInput } from '../models/simulation';
import { choosePosition } from '../models/optimizer';
import { MODEL } from '../models/modelConstants';
const cache = new Map<string, CallSimulation>();
let latest = 0;
self.onmessage = async (event: MessageEvent<{ id: number; input: PredictionInput }>) => {
  const { id, input } = event.data; latest = id;
  try {
    const maxCandidate = Math.min(MODEL.maxRank, Math.max(80, input.rank + 20, Math.ceil((input.target - input.now) * .9 + 30)));
    const key = JSON.stringify([input.rank, input.now, input.mode, input.evidence, input.seed, input.iterations, maxCandidate]);
    let simulation = cache.get(key);
    if (!simulation) {
      simulation = createSimulation({ ...input, maxCandidate });
      for (let i = 0; i < simulation.iterations; i += 200) {
        if (latest !== id) return;
        runScenarios(simulation, i, i + 200);
        self.postMessage({ id, progress: Math.min(1, (i + 200) / simulation.iterations) });
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (latest !== id) return;
      if (cache.size >= 2) cache.delete(cache.keys().next().value!);
      cache.set(key, simulation);
    }
    const positions = summarize(simulation, input);
    const recommendedRank = choosePosition(positions);
    self.postMessage({ id, result: { input, positions, rankTimeline: summarizeRankTimeline(simulation), recommendedRank,
      feasibleRank: choosePosition(positions, input.rank), iterations: simulation.iterations, end: simulation.end,
      searchLimited: recommendedRank === maxCandidate || input.target + input.tolerance >= simulation.end } });
  } catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : '계산 중 오류가 발생했어요.' }); }
};
