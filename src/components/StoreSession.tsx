import { newId } from '../utils/id';
import { useEffect, useState } from 'react';
import { Clock3, Plus, Pencil, Trash2 } from 'lucide-react';
import { clock, parseTime } from '../utils/time';
import { deleteRecord, putRecord, resetSession, type Session } from '../state/storage';
import { validateRank } from '../models/waitingModel';
export function StoreSession({ session, sessions, onChange, onSelect, onNew, now, date }: { session: Session; sessions: Session[]; onChange: (s: Session) => void; onSelect: (id: string) => void; onNew: () => void; now: number; date: string }) {
  const [time, setTime] = useState(clock(now)), [rank, setRank] = useState(''), [kind, setKind] = useState<'observation' | 'self-defer'>('observation'), [editing, setEditing] = useState<string | null>(null), [error, setError] = useState(''), [manualTime, setManualTime] = useState(false);
  useEffect(() => { if (!editing && !manualTime) setTime(clock(now)); }, [now, editing, manualTime]);
  function clear() { setEditing(null); setRank(''); setKind('observation'); setManualTime(false); setTime(clock(now)); setError(''); }
  function add() {
    const t = parseTime(time), r = Number(rank), invalid = validateRank(r);
    if (invalid || !Number.isFinite(t)) { setError(invalid ?? '관측 시각을 입력해 주세요.'); return; }
    if (session.date === date && t > now) { setError('미래 시각의 관측은 추가할 수 없어요.'); return; }
    if (session.date !== date && !editing) { setError('지난 방문 기록이에요. 새 웨이팅을 시작해 주세요.'); return; }
    onChange(putRecord(session, { id: editing ?? newId(), date: session.date, time: t, rank: r, kind })); clear();
  }
  return <section className="card session-card"><div className="section-head"><h2>실측 순서 기록</h2><button className="text-button" onClick={onNew}><Plus size={16}/>새 웨이팅</button></div>
    <label htmlFor="store-name">매장 이름 (선택)</label><input id="store-name" className="text-input" placeholder="예: 오늘의 라멘집" value={session.name} onChange={e => onChange({ ...session, name: e.target.value })}/>
    <label htmlFor="session-select">방문 기록</label><select id="session-select" value={session.id} onChange={e => onSelect(e.target.value)}>{sessions.map((s, i) => <option key={s.id} value={s.id}>{s.date} · {s.name || `웨이팅 ${i + 1}`} ({s.records.length}개)</option>)}</select>
    <p className="field-hint">방문마다 별도로 계산해요. 이전 기록은 삭제할 때까지 이 브라우저에 남아요.</p>
    <div className="record-form"><div className="two-fields"><label>관측 시각<input aria-label="관측 시각" type="time" value={time} onInput={e => { setTime(e.currentTarget.value); setManualTime(true); }} onChange={e => { setTime(e.target.value); setManualTime(true); }}/></label><label>관측한 내 순서<input aria-label="관측한 내 순서" type="number" min="1" max="300" inputMode="numeric" value={rank} onChange={e => setRank(e.target.value)}/></label></div>
      <button className="text-button" onClick={() => { setTime(clock(now)); setManualTime(false); }}><Clock3 size={14}/>현재 시각으로</button>
      <label htmlFor="record-kind">기록 종류</label><select id="record-kind" value={kind} onChange={e => setKind(e.target.value as typeof kind)}><option value="observation">일반 관측</option><option value="self-defer">내가 직접 순서를 미룸</option></select>
      <p className="field-hint">직접 미뤘다면 미룬 뒤 순서를 적어 주세요. 직전 기록부터 이 기록까지는 속도 추정에서 제외해요.</p>
      {error && <p role="alert" className="form-error">{error}</p>}
      <button className="primary-button" onClick={add}>{editing ? '기록 수정 완료' : '관측 기록 추가'}</button>{editing && <button className="text-button" onClick={clear}>수정 취소</button>}
    </div>
    <div className="table-scroll record-table"><table><caption>{session.date} · 관측 {session.records.length}개</caption><thead><tr><th>시각</th><th>순서</th><th>종류</th><th>편집</th></tr></thead><tbody>{session.records.map(r => <tr key={r.id}><td>{clock(r.time)}</td><td>{r.rank}번</td><td>{r.kind === 'self-defer' ? '직접 미룸' : '관측'}</td><td><button aria-label={`${clock(r.time)} ${r.rank}번 기록 수정`} className="icon-button" onClick={() => { setEditing(r.id); setTime(clock(r.time)); setRank(String(r.rank)); setKind(r.kind as typeof kind); setError(''); }}><Pencil size={15}/></button><button aria-label={`${clock(r.time)} ${r.rank}번 기록 삭제`} className="icon-button" onClick={() => { onChange(deleteRecord(session, r.id)); if (editing === r.id) clear(); }}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div>
    {!session.records.length && <p className="field-hint">기록이 없어도 현재 순서를 입력하면 킨카라멘 사전 모델로 예측해요.</p>}
    <button className="text-button danger" onClick={() => { if (window.confirm('현재 세션의 관측 기록을 모두 삭제할까요? 다른 세션은 유지돼요.')) { onChange(resetSession(session)); clear(); } }}>현재 세션 초기화</button>
  </section>;
}
