import { MODEL, KINKA_POSTERIOR } from './modelConstants';
import { behaviorRate, fitService } from './intervalModel';
import { buildIntervals, type Observation } from './observations';
export function validateRank(rank: number): string | null {
  return Number.isInteger(rank) && rank >= 1 && rank <= MODEL.maxRank ? null : `내 순서는 1~${MODEL.maxRank} 사이의 정수로 입력해 주세요.`;
}
export function localModel(rows: Observation[], date: string, now: number) {
  const eligible = rows.filter(r => r.date === date && r.time <= now);
  const { intervals, excluded } = buildIntervals(eligible);
  return {
    posterior: intervals.length ? fitService(intervals, MODEL.servicePerMinute, 30) : KINKA_POSTERIOR,
    intervals: intervals.length,
    minutes: intervals.reduce((s, v) => s + v.end - v.start, 0),
    count: intervals.reduce((s, v) => s + v.count, 0),
    excluded: excluded.length,
    otherDates: rows.filter(r => r.date !== date).length,
    future: rows.filter(r => r.date === date && r.time > now).length,
  };
}
export const rankRate = (rank: number, service = MODEL.servicePerMinute) => service + Math.max(0, rank - 1) * behaviorRate;
