import { describe, expect, it } from 'vitest';
import { simulate, summarize } from '../models/simulation';
import { choosePosition } from '../models/optimizer';
const input = { rank: 1, now: 786, iterations: 2000 }, out = simulate(input);
const positions = (target: number) => summarize(out, { ...input, target, tolerance: 5 });
describe('theoretical optimal rank', () => {
  it('keeps the current first rank for imminent arrival', () => expect(choosePosition(positions(788))).toBe(1));
  it('suggests a later rank for later arrival', () => expect(choosePosition(positions(810))).toBeGreaterThan(1));
  it('shows an earlier optimum even if the user is currently 30th', () => {
    const rows = summarize(out, { ...input, rank: 30, target: 800, tolerance: 5 });
    expect(choosePosition(rows)).toBeLessThan(30);
    expect(rows.find(r => r.rank === choosePosition(rows))!.success).toBe(Math.max(...rows.map(r => r.success)));
  });
  it('ties prefer less missed-call risk, then smaller rank', () => {
    const base = positions(810)[0];
    expect(choosePosition([{ ...base, rank: 4, success: .4, missed: .2 }, { ...base, rank: 5, success: .4, missed: .1 }, { ...base, rank: 6, success: .4, missed: .1 }])).toBe(5);
  });
  it('does not invent a recommendation past the calculation horizon', () => expect(choosePosition(positions(1200))).toBeNull());
});
