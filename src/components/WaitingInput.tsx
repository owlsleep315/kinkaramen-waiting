import type { Values } from '../state/storage';
export function WaitingInput({ values, onChange }: { values: Values; onChange: (values: Values) => void }) {
  return <section className="card input-card"><h2>지금 몇 번째인가요?</h2>
    <label htmlFor="current-rank">현재 내 순서</label><div className="number-field"><input id="current-rank" type="number" inputMode="numeric" min="1" max="300" value={values.rank} onChange={e => onChange({ ...values, rank: e.target.value })}/><span>번째</span></div>
    <label className="time-label" htmlFor="arrival">언제 도착하나요?</label><div className="time-field"><input id="arrival" type="time" value={values.target} onInput={e => onChange({ ...values, target: e.currentTarget.value })} onChange={e => onChange({ ...values, target: e.target.value })}/></div>
    <fieldset className="tolerance-field"><legend>도착 후 이만큼은 기다릴 수 있어요</legend><div className="segmented">{[5, 10, 15].map(n => <button key={n} aria-pressed={values.tolerance === n} className={values.tolerance === n ? 'active' : ''} onClick={() => onChange({ ...values, tolerance: n })}>{n}분</button>)}</div></fieldset>
    <p className="field-hint">입력을 바꾸면 자동 계산해요. 실제 순서가 바뀌면 직접 갱신해 주세요.</p>
  </section>;
}
