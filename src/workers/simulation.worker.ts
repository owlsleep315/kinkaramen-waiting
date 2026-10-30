import { createSimulation, runScenarios, summarize, summarizeRankTimeline, type CallSimulation, type PredictionInput } from '../models/simulation';
import { choosePosition } from '../models/optimizer';
import { MODEL } from '../models/modelConstants';
const cache = new Map<string, CallSimulation>();
let latest = 0;
self.onmessage = async (event: MessageEvent<{ id: number; input: PredictionInput }>) => {
  const { id, input } = event.data; latest = id;
  try {
    const key = JSON.stringify([input.rank, input.now, input.mode, input.date, input.observations, input.seed ?? MODEL.seed, input.iterations ?? MODEL.iterations]);
    let simulation = cache.get(key);
    if (!simulation) {
      simulation = createSimulation(input);
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
    self.postMessage({ id, result: { input, positions, rankTimeline: summarizeRankTimeline(simulation), recommendedRank: choosePosition(positions), iterations: simulation.iterations, end: simulation.end, censorReason: simulation.censorReason, modelInfo: simulation.modelInfo } });
  } catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : '계산 중 오류가 발생했어요.' }); }
};
