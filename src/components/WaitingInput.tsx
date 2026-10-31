import { ArrowRight, Clock3, LoaderCircle, Users } from 'lucide-react';
import { MODEL } from '../models/modelConstants';
import { formError, type FormValues } from '../state/storage';
import { clock } from '../utils/time';
export type { FormValues } from '../state/storage';
export function WaitingInput({ now, values, setValues, onPredict, loading, progress, demo }: { now: number; values: FormValues; setValues: (v: FormValues) => void; onPredict: () => void; loading: boolean; progress: number; demo: boolean }) {
  const error = formError(values, now);
  const set = (key: keyof FormValues, value: string | number) => setValues({ ...values, [key]: value });
  return <section className="card input-card" aria-labelledby="input-heading"><div className="section-title"><span className="icon-box"><Users size={19}/></span><h2 id="input-heading">지금 내 순서는?</h2></div><form onSubmit={e => { e.preventDefault(); if (!error) onPredict(); }} noValidate>
    <label>내 순서<div className="number-field"><input id="rank" aria-label="내 순서" type="number" inputMode="numeric" min="1" max={MODEL.maxRank} value={values.rank} onChange={e => set('rank', e.target.value)}/><span>번째</span></div></label>
    <label className="time-label" htmlFor="target">언제 도착하나요?</label><div className="time-field"><Clock3 size={20}/><input id="target" aria-label="도착시간" type="time" required value={values.target} onChange={e => set('target', e.target.value)} onInput={e => set('target', e.currentTarget.value)}/></div>
    <fieldset className="tolerance-field"><legend>도착 후 이만큼 기다릴 수 있어요</legend><div className="segmented">{[5,10,15].map(v => <button type="button" key={v} aria-pressed={values.tolerance === v} className={values.tolerance === v ? 'active' : ''} onClick={() => set('tolerance', v)}>{v}분</button>)}</div></fieldset>
    <p className="field-hint">호출 후 유예는 3분이에요. 도착 3분 전부터 도착 후 {values.tolerance}분까지의 호출을 성공으로 계산해요.</p>
    {error && <p role="alert" className="form-error">{error}</p>}
    <button type="submit" className="primary-button" disabled={loading || !!error}>{loading ? <><LoaderCircle className="spin" size={18}/>계산 중 {Math.round(progress * 100)}%</> : <>예측하기<ArrowRight size={19}/></>}</button>
    <p className="input-note">{demo ? '실측 예시' : '현재'} {clock(now)} 기준 · 예측하기를 눌러야 계산해요.</p>
  </form><div className="privacy-note"><span className="status-dot"/>입력값은 이 브라우저에만 저장돼요.</div></section>;
}
