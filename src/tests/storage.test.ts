import { describe, expect, it } from 'vitest';
import { appendPredictionRecord, defaultState, loadState, saveState, removeRecord, latestRecord, STORAGE_KEY, formError } from '../state/storage';
import { localModel } from '../models/waitingModel';
import type { Observation } from '../models/observations';
import { clock, parseTime, seoulDate, seoulMinutes } from '../utils/time';
const row: Observation = { id: 'a', date: '2026-10-30', time: 730, rank: 20, kind: 'observation' };
describe('browser records', () => {
  it('roundtrips tab, both forms, and records after reload', () => {
    const data = new Map<string, string>(); const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
    const state = { ...defaultState(), tab: 'other' as const, records: [row] };
    expect(saveState(storage, state)).toBe(true); expect(loadState(storage).state).toEqual(state); expect(data.has(STORAGE_KEY)).toBe(true);
  });
  it('appends predictions without modifying previous records and supports deletion', () => {
    const rows = appendPredictionRecord([row], row.date, 740, 16, 'b');
    expect(rows[0]).toEqual(row);
    expect(localModel(rows, row.date, 750).count).toBe(4);
    expect(latestRecord(rows, row.date, 750)?.rank).toBe(16);
    expect(localModel(removeRecord(rows, 'b'), row.date, 750).intervals).toBe(0);
    expect(() => appendPredictionRecord(rows, row.date, 750, 12, 'b')).toThrow();
  });
  it('classifies increases as deferral, excludes the mixed interval, then resumes learning', () => {
    const deferred = appendPredictionRecord([row], row.date, 740, 24, 'b');
    expect(deferred[1].kind).toBe('self-defer');
    expect(localModel(deferred, row.date, 750).intervals).toBe(0);
    expect(localModel(deferred, row.date, 750).posterior).toBeNull();
    const rows = appendPredictionRecord(deferred, row.date, 750, 21, 'c');
    expect(localModel(rows, row.date, 750)).toMatchObject({ intervals: 1, count: 3, minutes: 10, excluded: 1 });
    expect(localModel(rows, row.date, 750).needsObservation).toBe(false);
  });
  it('deduplicates consecutive identical observations, preserves ordered same-minute changes', () => {
    const first = appendPredictionRecord([], row.date, 730, 4, 'a');
    expect(appendPredictionRecord(first, row.date, 730, 4, 'b')).toBe(first);
    const deferred = appendPredictionRecord(first, row.date, 730, 6, 'c');
    const back = appendPredictionRecord(deferred, row.date, 730, 4, 'd');
    expect(back.map(r => r.rank)).toEqual([4, 6, 4]);
    expect(back[1].kind).toBe('self-defer');
    expect(localModel(back, row.date, 730).intervals).toBe(0);
    const later = appendPredictionRecord(back, row.date, 735, 3, 'e');
    expect(localModel(later, row.date, 735)).toMatchObject({ count: 1, minutes: 5, intervals: 1 });
  });
  it('records unchanged ranks after time passes and ignores previous dates/future rows for deferral', () => {
    const unchanged = appendPredictionRecord([row], row.date, 740, 20, 'b');
    expect(localModel(unchanged, row.date, 740)).toMatchObject({ count: 0, minutes: 10, intervals: 1 });
    expect(appendPredictionRecord([row], '2026-10-31', 740, 30, 'b').at(-1)?.kind).toBe('observation');
    expect(appendPredictionRecord([row], row.date, 720, 30, 'b')[0].kind).toBe('observation');
  });
  it('rejects invalid prediction records', () => {
    for (const rank of [0, 151, NaN, 1.5]) expect(() => appendPredictionRecord([], row.date, 730, rank, 'a')).toThrow();
    for (const time of [-1, 1440, NaN]) expect(() => appendPredictionRecord([], row.date, time, 4, 'a')).toThrow();
  });
  it('new waiting reset has no old data and Kinka inputs stay separate', () => {
    const state = defaultState(); state.kinka.rank = '33'; state.records = [row];
    expect(state.other.rank).toBe('4'); expect(defaultState().records).toEqual([]);
  });
  it('storage denial/quota errors are recoverable', () => {
    expect(saveState({ setItem() { throw new Error('quota'); } }, defaultState())).toBe(false);
    expect(loadState({ getItem() { throw new Error('denied'); } }).writable).toBe(false);
  });
  it.each(['{', '{"version":999}', JSON.stringify({ ...defaultState(), records: [{ ...row, rank: -2 }] })])('preserves malformed/unknown versions instead of overwriting', raw => expect(loadState({ getItem: () => raw }).writable).toBe(false));
  it('validates time strings and handles Seoul date rollover', () => {
    expect(parseTime('24:00')).toBeNaN(); expect(parseTime('12:60')).toBeNaN(); expect(parseTime('')).toBeNaN();
    expect(seoulDate(new Date('2026-10-30T15:01:00Z'))).toBe('2026-10-31'); expect(seoulMinutes(new Date('2026-10-30T15:01:00Z'))).toBe(1);
    expect(clock(1440)).toBe('24:00'); expect(formError({ rank: '2', target: '12:00', tolerance: 10 }, 721)).toContain('현재보다');
  });
});
