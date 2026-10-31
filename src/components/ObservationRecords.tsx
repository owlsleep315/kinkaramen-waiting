import { RotateCcw, Trash2 } from 'lucide-react';
import { clock } from '../utils/time';
import { removeRecord } from '../state/storage';
import type { Observation } from '../models/observations';

export function ObservationRecords({ rows, date, onChange }: { rows: Observation[]; date: string; onChange: (rows: Observation[]) => void }) {
  return <section className="card records-card" aria-labelledby="records-heading">
    <div className="chart-heading"><div><h2 id="records-heading">내 순서 기록</h2><p>예측을 완료하면 자동으로 저장해요.</p></div><span className="soft-badge">{rows.length}개 기록</span></div>
    <ol className="records-guide">
      <li>현재 내 순서와 도착시간을 입력하고 <strong>예측하기</strong>를 눌러 주세요. 그때의 시각과 순서가 기록돼요.</li>
      <li>순서가 바뀌면 다시 예측해 주세요. 이전보다 숫자가 커지면 <strong>미루기로 판단</strong>해요. 예를 들어 4 → 6번째면 해당 구간은 속도 계산에서 제외해요.</li>
      <li>기록을 직접 추가하거나 수정할 수는 없어요. 잘못된 기록은 <strong>삭제</strong>하고 올바른 현재 순서로 다시 예측해 주세요.</li>
    </ol>
    <p className="field-hint">같은 분·같은 순서로 연속 예측하면 중복 저장하지 않아요. 같은 분의 순서 변화는 보관하지만, 시간이 흐른 구간부터 속도에 반영해요.</p>
    {rows.length ? <div className="table-scroll"><table><caption className="sr-only">예측으로 자동 저장된 순서 기록</caption><thead><tr><th>확인한 시각</th><th>내 순서</th><th>관리</th></tr></thead><tbody>{[...rows].reverse().map(row => <tr key={row.id}><td>{row.date !== date && <small>{row.date}<br/></small>}{clock(row.time)}{row.kind === 'self-defer' && <small className="defer-label">미루기로 판단</small>}</td><td>{row.rank}번째</td><td><button className="icon-button" aria-label={`${row.date} ${clock(row.time)} ${row.rank}번째 기록 삭제`} onClick={() => onChange(removeRecord(rows, row.id))}><Trash2 size={14}/></button></td></tr>)}</tbody></table></div> : <p className="records-empty">첫 예측은 킨카라멘 기준을 사용해요.<br/>시간 차이가 있는 유효 기록이 쌓이면 이곳의 속도를 반영해요.</p>}
    {rows.length > 0 && <button className="reset-records" onClick={() => { if (window.confirm('저장된 순서 기록을 모두 지우고 새 웨이팅을 시작할까요?')) onChange([]); }}><RotateCcw size={13}/>기록 초기화</button>}
    <p className="input-note">이 브라우저에 저장돼요. 다른 매장으로 옮기거나 새로 방문하면 기록을 초기화해 주세요. 지난 날짜 기록은 오늘 예측에 섞지 않아요. 삭제한 내용은 다음 예측부터 반영돼요.</p>
  </section>;
}
