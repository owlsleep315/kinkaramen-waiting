import { useEffect, useState } from 'react';
import { Plus, RotateCcw, Pencil, Trash2 } from 'lucide-react';
import { clock, parseTime, timeValue } from '../utils/time';
import { latestRecord, removeRecord, updateRecord } from '../state/storage';
import type { Observation } from '../models/observations';
import { validateRank } from '../models/waitingModel';
let nextId = 0;
export function ObservationRecords({ rows, now, date, rank, onChange }: { rows: Observation[]; now: number; date: string; rank: string; onChange: (rows: Observation[], rank?: string) => void }) {
  const [time, setTime] = useState(timeValue(now)), [value, setValue] = useState(rank), [kind, setKind] = useState<'observation' | 'self-defer'>('observation');
  const [editing, setEditing] = useState<Observation | null>(null), [error, setError] = useState(''), [manualTime, setManualTime] = useState(false);
  useEffect(() => { if (!editing && !manualTime) setTime(timeValue(now)); }, [now, editing, manualTime]);
  function reset() { setEditing(null); setTime(timeValue(now)); setKind('observation'); setManualTime(false); setError(''); }
  function change(next: Observation[]) { onChange(next, latestRecord(next, date, now)?.rank?.toString()); }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = parseTime(time), r = Number(value), day = editing?.date ?? date;
    const problem = validateRank(r);
    if (problem) return setError(problem);
    if (!Number.isFinite(t) || (day === date && t > now)) return setError('관측 시각은 현재까지 확인한 시간으로 입력해 주세요.');
    if (rows.some(row => row.id !== editing?.id && row.date === day && row.time === t)) return setError('같은 분의 기록이 있어요. 기존 기록을 수정하거나 다음 분에 추가해 주세요.');
    const row: Observation = { id: editing?.id ?? `observation-${Date.now()}-${++nextId}-${Math.random().toString(36).slice(2)}`, date: day, time: t, rank: r, kind };
    change(updateRecord(rows, row)); reset();
  }
  return <section className="card records-card" aria-labelledby="records-heading">
    <div className="chart-heading"><div><h2 id="records-heading">내 순서 기록</h2><p>순서가 바뀔 때마다 추가해 주세요.</p></div><span className="soft-badge">{rows.length}개 기록</span></div>
    <form onSubmit={submit} className="record-form">
      {editing && <p className="record-editing">{editing.date} 기록 수정 중</p>}
      <div className="two-fields"><label>관측 시각<input aria-label="관측 시각" type="time" required value={time} onChange={e => { setTime(e.target.value); setManualTime(true); }} onInput={e => { setTime(e.currentTarget.value); setManualTime(true); }}/></label><label>관측한 내 순서<input aria-label="관측한 내 순서" type="number" inputMode="numeric" min="1" max="150" required value={value} onChange={e => setValue(e.target.value)}/></label></div>
      <label className="defer-check"><input type="checkbox" checked={kind === 'self-defer'} onChange={e => setKind(e.target.checked ? 'self-defer' : 'observation')}/>내가 직접 순서를 미뤘어요</label>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="record-actions"><button className="record-add" type="submit"><Plus size={15}/>{editing ? '수정 저장' : '기록 추가'}</button>{editing && <button type="button" onClick={reset}>수정 취소</button>}</div>
    </form>
    <p className="field-hint">시각은 자동 입력돼요. 직접 미루기까지의 구간은 속도 계산에서 제외해요.</p>
    {rows.length ? <div className="table-scroll"><table><caption className="sr-only">저장된 순서 관측</caption><thead><tr><th>확인한 시각</th><th>내 순서</th><th>관리</th></tr></thead><tbody>{[...rows].reverse().map(row => <tr key={row.id}><td>{row.date !== date && <small>{row.date}<br/></small>}{clock(row.time)}{row.kind === 'self-defer' && <small className="defer-label">직접 미룸</small>}</td><td>{row.rank}번째</td><td><button className="icon-button" aria-label={`${row.date} ${clock(row.time)} 기록 수정`} onClick={() => { setEditing(row); setTime(timeValue(row.time)); setValue(String(row.rank)); setKind(row.kind === 'self-defer' ? 'self-defer' : 'observation'); setError(''); }}><Pencil size={14}/></button><button className="icon-button" aria-label={`${row.date} ${clock(row.time)} 기록 삭제`} onClick={() => { change(removeRecord(rows, row.id)); if (editing?.id === row.id) reset(); }}><Trash2 size={14}/></button></td></tr>)}</tbody></table></div> : <p className="records-empty">기록이 없어도 킨카라멘 기준으로 예측해요.<br/>두 번째 기록부터 이곳의 속도를 반영해요.</p>}
    {rows.length > 0 && <button className="reset-records" onClick={() => { if (window.confirm('저장된 순서 기록을 모두 지우고 새 웨이팅을 시작할까요?')) { onChange([]); reset(); } }}><RotateCcw size={13}/>기록 초기화</button>}
    <p className="input-note">이 브라우저에 저장돼요. 새 방문은 기록을 초기화해 주세요.<br/>지난 날짜의 기록은 보관만 하며 오늘 예측에는 섞지 않아요.</p>
  </section>;
}
