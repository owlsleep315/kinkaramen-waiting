import { useEffect, useState } from 'react';
import { ArrowRight, Clock3, LoaderCircle, Users } from 'lucide-react';
import { MODEL } from '../models/modelConstants';
import { validateQueue } from '../models/waitingModel';
import type { PredictionInput } from '../models/simulation';
import { clock, parseTime } from '../utils/time';
export interface FormValues { total:string; rank:string; target:string; tolerance:number }
export function WaitingInput({now,values,setValues,onPredict,loading,progress,demo}:{now:number;values:FormValues;setValues:(v:FormValues)=>void;onPredict:(v:PredictionInput)=>void;loading:boolean;progress:number;demo:boolean}) {
  const [error,setError]=useState('');
  useEffect(()=>setError(''),[values]);
  const set=(key:keyof FormValues,value:string|number)=>{setError('');setValues({...values,[key]:value});};
  function submit(event:React.FormEvent) {
    event.preventDefault();
    const total=Number(values.total),rank=Number(values.rank),target=parseTime(values.target);
    const queueError=validateQueue(total,rank);
    if(queueError) return setError(queueError);
    if(!Number.isFinite(target)||target<=now||target>=1440) return setError('도착시간은 현재보다 늦은 오늘 시간으로 선택해 주세요.');
    setError('');onPredict({total,rank,now,target,tolerance:values.tolerance});
  }
  return <section className="card input-card" aria-labelledby="input-heading"><div className="section-title"><span className="icon-box"><Users size={19}/></span><h2 id="input-heading">지금 웨이팅은?</h2></div><form onSubmit={submit} noValidate>
    <div className="two-fields"><label>전체 웨이팅 수<div className="number-field"><input id="total" aria-label="전체 웨이팅 수" type="number" inputMode="numeric" min="1" max={MODEL.maxWaiting} value={values.total} onChange={e=>set('total',e.target.value)}/><span>팀</span></div></label><label>내 순서<div className="number-field"><input id="rank" aria-label="내 순서" type="number" inputMode="numeric" min="1" max={Number(values.total)||1} value={values.rank} onChange={e=>set('rank',e.target.value)}/><span>번째</span></div></label></div>
    <p className="field-hint">전체 웨이팅 수에 내 팀도 포함해 주세요.</p>
    <label className="time-label" htmlFor="target">언제 도착하나요?</label><div className="time-field"><Clock3 size={20}/><input id="target" aria-label="도착시간" type="time" required value={values.target} onChange={e=>set('target',e.target.value)}/></div>
    <fieldset className="tolerance-field"><legend>도착 후 이만큼 기다릴 수 있어요</legend><div className="segmented">{[5,10,15].map(v=><button type="button" key={v} aria-pressed={values.tolerance===v} className={values.tolerance===v?'active':''} onClick={()=>set('tolerance',v)}>{v}분</button>)}</div></fieldset>
    <p className="field-hint">호출 후 유예는 3분이에요. 도착 3분 전부터 도착 후 {values.tolerance}분까지의 호출을 성공으로 계산해요.</p>
    {error&&<p role="alert" className="form-error">{error}</p>}
    <button type="submit" className="primary-button" disabled={loading}>{loading?<><LoaderCircle className="spin" size={18}/>계산 중 {Math.round(progress*100)}%</>:<>입장시간 예측하기<ArrowRight size={19}/></>}</button>
    <p className="input-note">{demo?'실측 예시':'예측 시점'} {clock(now)} 기준 · {demo?'고정된 예시 시간':'기기 시간 자동 반영'}</p>
  </form><div className="privacy-note"><span className="status-dot"/>입력값은 이 브라우저 안에서만 계산해요.</div></section>;
}
