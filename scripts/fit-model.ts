import { readFileSync, writeFileSync } from 'node:fs';
import { buildIntervals, type Observation } from '../src/models/observations.ts';
import { fitService, BEHAVIOR } from '../src/models/intervalModel.ts';
const rows = JSON.parse(readFileSync(new URL('../src/data/observations.json', import.meta.url), 'utf8')) as Observation[];
const { intervals, excluded, duplicates } = buildIntervals(rows);
const posterior = fitService(intervals);
const result = { dates: [...new Set(rows.map(r => r.date))], method: 'rank-dependent pure-death interval likelihood', behavior: BEHAVIOR, prior: { mean: 23 / 86, minutes: 30 }, intervals: intervals.length, minutes: intervals.reduce((s, v) => s + v.end - v.start, 0), decreases: intervals.reduce((s, v) => s + v.count, 0), excluded, duplicates, posterior };
writeFileSync(new URL('../src/data/fittedModel.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, posterior: { mean: posterior.mean, low: posterior.low, high: posterior.high } }, null, 2));
