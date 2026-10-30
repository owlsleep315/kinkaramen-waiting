import type { Observation } from '../models/observations';
import { parseTime, seoulMinutes, timeValue } from '../utils/time';
export type Tab = 'kinka' | 'other';
export interface FormValues { rank: string; target: string; tolerance: number }
export interface SavedState { version: 1; tab: Tab; kinka: FormValues; other: FormValues; records: Observation[] }
export const STORAGE_KEY = 'waiting-order-simple';
export function defaultState(): SavedState {
  const form = { rank: '4', target: timeValue(Math.min(1439, seoulMinutes() + 30)), tolerance: 10 };
  return { version: 1, tab: 'kinka', kinka: { ...form }, other: { ...form }, records: [] };
}
const formValid = (f: FormValues) => f && typeof f.rank === 'string' && typeof f.target === 'string' && [5, 10, 15].includes(f.tolerance);
export function isRecord(r: Observation) {
  return r && typeof r.id === 'string' && typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isInteger(r.time) && r.time >= 0 && r.time < 1440 && Number.isInteger(r.rank) && r.rank! >= 1 && r.rank! <= 150 && ['observation', 'self-defer'].includes(r.kind);
}
export function loadState(storage: Pick<Storage, 'getItem'>) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { state: defaultState(), writable: true, warning: '' };
    const state = JSON.parse(raw) as SavedState;
    if (state.version !== 1 || !['kinka', 'other'].includes(state.tab) || !formValid(state.kinka) || !formValid(state.other) || !Array.isArray(state.records) || !state.records.every(isRecord) || new Set(state.records.map(r => r.id)).size !== state.records.length) throw new Error('invalid schema');
    return { state, writable: true, warning: '' };
  } catch {
    return { state: defaultState(), writable: false, warning: '저장된 내용을 읽지 못했어요. 기존 저장 내용은 덮어쓰지 않아요. 입력값 초기화 후 다시 저장할 수 있어요.' };
  }
}
export function saveState(storage: Pick<Storage, 'setItem'>, state: SavedState) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch { return false; }
}
export function updateRecord(rows: Observation[], row: Observation) {
  if (!isRecord(row)) throw new Error('관측 시각과 순서를 확인해 주세요.');
  return [...rows.filter(r => r.id !== row.id), row].sort((a, b) => a.date.localeCompare(b.date) || a.time - b.time);
}
export const removeRecord = (rows: Observation[], id: string) => rows.filter(r => r.id !== id);
export const latestRecord = (rows: Observation[], date: string, now: number) => rows.filter(r => r.date === date && r.time <= now).sort((a, b) => a.time - b.time).at(-1);
export const formError = (v: FormValues, now: number) => !Number.isInteger(Number(v.rank)) || Number(v.rank) < 1 || Number(v.rank) > 150 ? '내 순서는 1~150 사이의 정수로 입력해 주세요.' : !Number.isFinite(parseTime(v.target)) || parseTime(v.target) <= now ? '도착시간은 현재보다 늦은 오늘 시간으로 선택해 주세요.' : '';
