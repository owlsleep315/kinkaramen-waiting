import type { PositionResult } from './simulation.ts';
/** Maximize P(A-3 <= C <= A+tolerance), then lower missed-call risk, then shorter wait. */
export function choosePosition(positions: PositionResult[], minimumRank = 1): number | null {
  const candidates = positions.filter(p => p.rank >= minimumRank && p.success > 0);
  candidates.sort((a, b) => b.success - a.success || a.missed - b.missed || (a.expectedWait ?? Infinity) - (b.expectedWait ?? Infinity) || a.rank - b.rank);
  return candidates[0]?.rank ?? null;
}
