import type { PositionResult } from './simulation';
/** The theoretical optimum includes ranks ahead of the current rank. */
export function choosePosition(positions: PositionResult[]): number | null {
  return positions.filter(p => p.success > 0).sort((a, b) => b.success - a.success || a.missed - b.missed || a.rank - b.rank)[0]?.rank ?? null;
}
