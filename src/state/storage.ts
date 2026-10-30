import type { Observation } from '../models/observations';
import { MODEL } from '../models/modelConstants';
export const STORAGE_KEY = 'waiting-order-prediction';
export interface Values { rank: string; target: string; tolerance: number }
export interface Session { id: string; name: string; date: string; values: Values; records: Observation[] }
export interface AppState { schemaVersion: 1; tab: 'kinka' | 'custom'; kinka: Values; kinkaDate: string; sessions: Session[]; activeSessionId: string }
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export function freshValues(): Values { return { rank: '4', target: '13:30', tolerance: 10 }; }
export function makeSession(date: string, id: string): Session { return { id, name: '', date, values: { ...freshValues(), rank: '' }, records: [] }; }
export function initialState(date: string): AppState { return { schemaVersion: 1, tab: 'kinka', kinka: freshValues(), kinkaDate: date, sessions: [makeSession(date, 'initial')], activeSessionId: 'initial' }; }
const validValues = (v: unknown): v is Values => {
  const x = v as Values;
  return !!x && typeof x.rank === 'string' && typeof x.target === 'string' && [5, 10, 15].includes(x.tolerance);
};
export function validState(value: unknown): value is AppState {
  const s = value as AppState;
  return !!s && s.schemaVersion === 1 && ['kinka', 'custom'].includes(s.tab) && validValues(s.kinka) && typeof s.kinkaDate === 'string'
    && Array.isArray(s.sessions) && s.sessions.length > 0 && new Set(s.sessions.map(x => x.id)).size === s.sessions.length
    && s.sessions.some(x => x.id === s.activeSessionId)
    && s.sessions.every(x => typeof x.id === 'string' && typeof x.name === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && validValues(x.values)
      && Array.isArray(x.records) && new Set(x.records.map(r => r.id)).size === x.records.length
      && x.records.every(r => typeof r.id === 'string' && r.date === x.date && Number.isFinite(r.time) && r.time >= 0 && r.time < 1440
        && Number.isInteger(r.rank) && r.rank! >= 1 && r.rank! <= MODEL.maxRank && ['observation', 'self-defer'].includes(r.kind)));
}
export function loadState(storage: StorageLike, date: string) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { state: initialState(date), warning: '', writable: true };
    const parsed: unknown = JSON.parse(raw);
    if (!validState(parsed)) return { state: initialState(date), warning: '저장된 데이터 형식이 달라 복원하지 못했어요. 기존 데이터는 덮어쓰지 않았어요. 전체 초기화 후 저장할 수 있어요.', writable: false };
    return { state: parsed, warning: '', writable: true };
  } catch {
    return { state: initialState(date), warning: '브라우저 저장소에 접근하거나 기록을 읽지 못했어요. 현재 화면은 사용할 수 있지만 저장을 보장할 수 없어요.', writable: false };
  }
}
export function saveState(storage: StorageLike, state: AppState): string {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return ''; }
  catch { return '저장 공간이 부족하거나 저장이 차단됐어요. 현재 변경사항은 새로고침하면 사라질 수 있어요.'; }
}
export function putRecord(session: Session, record: Observation): Session {
  if (record.date !== session.date) throw new Error('새 방문일에는 새 웨이팅을 시작해 주세요.');
  const records = [...session.records.filter(r => r.id !== record.id), record].sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
  return { ...session, records, values: { ...session.values, rank: String(records.at(-1)!.rank) } };
}
export function deleteRecord(session: Session, id: string): Session {
  const records = session.records.filter(r => r.id !== id);
  return { ...session, records, values: { ...session.values, rank: records.length ? String(records.at(-1)!.rank) : '' } };
}
export function startSession(state: AppState, date: string, id: string): AppState {
  return { ...state, activeSessionId: id, sessions: [...state.sessions, makeSession(date, id)] };
}
export function resetSession(session: Session): Session { return { ...session, records: [], values: { ...session.values, rank: '' } }; }
