/** Fixed at development time. Never derive or mutate these values from user inputs. */
export const MODEL = Object.freeze({
  version: '1.0.0',
  servicePerMinute: 23 / 86,
  cancellationPerTeamMinute: 2 / 1518,
  deferPerTeamMinute: 0.0005,
  arrivalPerMinute: 34 / 71,
  batchOfTwoProbability: 0.15,
  registrationOpen: 10 * 60 + 30,
  serviceOpen: 11 * 60,
  registrationClose: 11 * 60 + 52,
  serviceClose: 14 * 60 + 30,
  graceMinutes: 3,
  horizonMinutes: 360,
  iterations: 10_000,
  seed: 20261029,
  maxWaiting: 150,
});
export type ModelParameters = typeof MODEL;
export type ModelRates = Pick<ModelParameters, 'servicePerMinute' | 'cancellationPerTeamMinute' | 'deferPerTeamMinute' | 'arrivalPerMinute' | 'batchOfTwoProbability'>;
