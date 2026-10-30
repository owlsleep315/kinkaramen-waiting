import fitted from '../data/fittedModel.json';
import { BEHAVIOR } from './intervalModel';
export const MODEL = Object.freeze({
  servicePerMinute: fitted.posterior.mean,
  cancellationPerTeamMinute: BEHAVIOR.cancellation,
  deferPerTeamMinute: BEHAVIOR.defer,
  deferCrossingProbability: BEHAVIOR.crossing,
  graceMinutes: 3,
  horizonMinutes: 360,
  iterations: 10_000,
  seed: 20261030,
  maxRank: 150,
});
export const KINKA_POSTERIOR = fitted.posterior;
