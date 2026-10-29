import { MODEL, type ModelRates } from './modelConstants';
export interface QueueState { total: number; rank: number; called: boolean }
export type QueueEvent = { type: 'service'; batch: number } | { type: 'cancel'; position: number } | { type: 'defer'; position: number; destination: number } | { type: 'arrival' } | { type: 'self-defer'; destination: number };
export function validateQueue(total: number, rank: number): string | null {
  if (!Number.isInteger(total) || total < 1 || total > MODEL.maxWaiting) return `전체 웨이팅은 1~${MODEL.maxWaiting}팀으로 입력해 주세요.`;
  if (!Number.isInteger(rank) || rank < 1 || rank > total) return '내 순서는 1 이상, 전체 웨이팅 수 이하로 입력해 주세요.';
  return null;
}
/** Pure, explicit transitions; own cancellation is outside this model. */
export function transition(s: QueueState, e: QueueEvent): QueueState {
  if (s.called) return s;
  switch (e.type) {
    case 'service': return { total: Math.max(0, s.total - e.batch), rank: Math.max(0, s.rank - e.batch), called: s.rank <= e.batch };
    case 'cancel':
      if (e.position < 1 || e.position > s.total || e.position === s.rank) throw new Error('Invalid cancellation');
      return { ...s, total: s.total - 1, rank: s.rank - Number(e.position < s.rank) };
    case 'defer':
      if (e.position < 1 || e.destination > s.total || e.destination <= e.position || e.position === s.rank) throw new Error('Invalid defer');
      return { ...s, rank: s.rank - Number(e.position < s.rank && e.destination >= s.rank) };
    case 'arrival': return { ...s, total: s.total + 1 };
    case 'self-defer':
      if (!Number.isInteger(e.destination) || e.destination < s.rank || e.destination > s.total) throw new Error('앞으로 이동할 수 없어요.');
      return { ...s, rank: e.destination };
  }
}
export function effectiveDeferRate(total: number, rank: number, d: number = MODEL.deferPerTeamMinute): number {
  let sum = 0;
  for (let j = 1; j < rank; j++) sum += (total - rank + 1) / (total - j);
  return d * sum;
}
export function ratesAt(_time: number, total: number, p: ModelRates = MODEL) {
  return {
    service: p.servicePerMinute / (1 + p.batchOfTwoProbability),
    cancel: Math.max(0, total - 1) * p.cancellationPerTeamMinute,
    defer: Math.max(0, total - 1) * p.deferPerTeamMinute,
    arrival: p.arrivalPerMinute,
  };
}
