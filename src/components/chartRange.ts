import type { PositionResult } from '../models/simulation';
/** Visual zoom only: all probabilities and the accessible table retain the complete tail. */
export function chartEnd(current: PositionResult, selected: PositionResult, target: number, tolerance: number) {
  const end = (p: PositionResult) => (p.bins.find(b => b.cumulative >= .995) ?? p.bins.at(-1)!).time + 5;
  return Math.max(end(current), end(selected), target + tolerance);
}
