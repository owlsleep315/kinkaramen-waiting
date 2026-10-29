import type { PositionResult } from './simulation';
/** Exact observed count ties: lower early-call risk, then smaller irreversible move. */
export function choosePosition(positions: PositionResult[], minimumRank: number): number | null {
  const eligible = positions.filter(p => p.rank >= minimumRank && p.success > 0);
  eligible.sort((a,b) => b.success-a.success || a.callBeforeArrival-b.callBeforeArrival || a.rank-b.rank);
  return eligible[0]?.rank ?? null;
}
