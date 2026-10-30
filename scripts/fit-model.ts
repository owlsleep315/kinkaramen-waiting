import { readFileSync, writeFileSync } from 'node:fs';
import { buildIntervals, type Observation } from '../src/models/observations.ts';
import { fitRates, PRIOR } from '../src/models/fitting.ts';
const rows: Observation[] = JSON.parse(readFileSync('src/data/observations.json', 'utf8'));
const processed = buildIntervals(rows);
const fit = fitRates(processed.intervals);
const output = { schemaVersion: 1, sourceDates: [...new Set(rows.map(r => r.date))], prior: PRIOR, ...fit,
  exclusions: processed.excluded, legacyDeduplicatedRows: 54, notes: 'Legacy CSV is the same Oct 29 visit. Canonical observations replace it; no Q-only or event-note counts are fitted.' };
writeFileSync('src/data/fittedModel.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ ...output, posteriorDraws: `${fit.posteriorDraws.length} joint rate draws` }, null, 2));
