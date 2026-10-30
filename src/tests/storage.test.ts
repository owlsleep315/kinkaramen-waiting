import { describe, expect, it } from 'vitest';
import { loadState, saveState, initialState, putRecord, deleteRecord, startSession, resetSession, STORAGE_KEY } from '../state/storage';
import { parseTime, clock, seoulMinutes, seoulDate } from '../utils/time';
const date = '2026-10-30';
function memory() { const values = new Map<string, string>(); return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } }; }
describe('local session persistence', () => {
  it('restores tabs, inputs and records after a reload', () => {
    const storage = memory(), state = initialState(date);
    state.tab = 'custom'; state.sessions[0] = putRecord(state.sessions[0], { id: '1', date, time: 720, rank: 20, kind: 'observation' });
    expect(saveState(storage, state)).toBe(''); expect(loadState(storage, date).state).toEqual(state);
  });
  it('supports adding, editing, deleting and resetting observations', () => {
    let session = initialState(date).sessions[0];
    session = putRecord(session, { id: '1', date, time: 720, rank: 20, kind: 'observation' });
    session = putRecord(session, { id: '2', date, time: 730, rank: 16, kind: 'observation' });
    session = putRecord(session, { id: '2', date, time: 731, rank: 24, kind: 'self-defer' });
    expect(session.records).toHaveLength(2); expect(session.values.rank).toBe('24');
    expect(deleteRecord(session, '2').values.rank).toBe('20');
    expect(resetSession(session).records).toEqual([]);
  });
  it('preserves old sessions without combining visits', () => {
    const original = initialState(date), next = startSession(original, '2026-10-31', 'next');
    expect(next.sessions).toHaveLength(2); expect(next.sessions[0]).toEqual(original.sessions[0]);
    expect(next.activeSessionId).toBe('next');
    expect(() => putRecord(next.sessions[1], { id: 'x', date, time: 720, rank: 20, kind: 'observation' })).toThrow();
  });
  it('keeps unknown versions and malformed data from being overwritten', () => {
    const storage = memory(); storage.setItem(STORAGE_KEY, '{broken');
    expect(loadState(storage, date).writable).toBe(false); expect(storage.getItem(STORAGE_KEY)).toBe('{broken');
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...initialState(date), schemaVersion: 99 }));
    expect(loadState(storage, date).writable).toBe(false);
  });
  it('survives denied access and quota failures', () => {
    const storage = { getItem() { throw new Error(); }, setItem() { throw new Error(); }, removeItem() { throw new Error(); } };
    expect(loadState(storage, date).state.schemaVersion).toBe(1);
    expect(saveState(storage, initialState(date))).not.toBe('');
  });
  it('supports Seoul time, invalid input, and day end without silent wraparound', () => {
    expect(seoulMinutes(new Date('2026-10-30T04:06:00Z'))).toBe(786);
    expect(seoulDate(new Date('2026-10-30T16:06:00Z'))).toBe('2026-10-31');
    expect(clock(1440)).toBe('24:00'); expect(parseTime('24:00')).toBeNaN(); expect(parseTime('13:70')).toBeNaN();
  });
});
