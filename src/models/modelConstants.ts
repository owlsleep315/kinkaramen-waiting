import fitted from '../data/fittedModel.json' with { type: 'json' };
export const MODEL = Object.freeze({
  graceMinutes: 3, horizonMinutes: 720, iterations: 6000, seed: 20261030,
  maxRank: 300, openingMinute: 660, registrationMinute: 630, registrationCap: 50,
  rates: fitted.rates, posteriorDraws: fitted.posteriorDraws,
  ...fitted.prior,
});
export const FIT = fitted;
