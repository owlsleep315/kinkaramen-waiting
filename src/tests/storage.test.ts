import { describe, expect, it } from 'vitest';
import { defaultState, loadState, saveState, updateRecord, removeRecord, latestRecord, STORAGE_KEY, formError } from '../state/storage';
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
  it('edit/delete updates local evidence and latest rank', () => {
    const rows = updateRecord([row], { ...row, id: 'b', time: 740, rank: 16 });
    const edited = updateRecord(rows, { ...rows[1], rank: 12 });
    expect(localModel(edited, row.date, 750).count).toBe(8);
    expect(latestRecord(edited, row.date, 750)?.rank).toBe(12);
    expect(localModel(removeRecord(edited, 'b'), row.date, 750).intervals).toBe(0);
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
