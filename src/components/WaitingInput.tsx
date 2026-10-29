import { useEffect, useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ArrowRight, ChevronDown, Clock3, LoaderCircle, SlidersHorizontal, Users, Footprints } from 'lucide-react';
import { MODEL } from '../models/modelConstants';
import { validateQueue } from '../models/waitingModel';
import type { PredictionInput } from '../models/simulation';
import { clock, parseTime } from '../utils/time';
export interface FormValues { total:string; rank:string; target:string; tolerance:number; arrival:string }
export function WaitingInput({now,values,setValues,onPredict,loading,progress,demo}:{now:number;values:FormValues;setValues:(v:FormValues)=>void;onPredict:(v:PredictionInput)=>void;loading:boolean;progress:number;demo:boolean}) {
  const [advanced,setAdvanced]=useState(false),[error,setError]=useState('');
  useEffect(()=>setError(''),[values]);
  const set=(key:keyof FormValues,value:string|number)=>{setError('');setValues({...values,[key]:value});};
  function submit(event:React.FormEvent) {
    event.preventDefault();
    const total=Number(values.total),rank=Number(values.rank),target=parseTime(values.target),arrival=values.arrival?parseTime(values.arrival):undefined;
    const queueError=validateQueue(total,rank);
    if(queueError) return setError(queueError);
    if(now<MODEL.registrationOpen) return setError('10:30 웨이팅 등록 시작 후 예측할 수 있어요. 지금은 실측 시점 예시를 확인해 보세요.');
    if(now>=MODEL.serviceClose) return setError('모델의 점심 영업시간이 끝났어요. 실측 시점 예시로 기능을 확인할 수 있어요.');
    if(!Number.isFinite(target)||target<=now) return setError('원하는 입장시간은 현재보다 늦은 오늘 시간으로 선택해 주세요.');
    if(arrival!==undefined&&(!Number.isFinite(arrival)||arrival<now)) return setError('도착 예정시간은 현재 이후로 입력해 주세요.');
    setError('');onPredict({total,rank,now,target,tolerance:values.tolerance,arrival});
  }
  return <section className="card input-card" aria-labelledby="input-heading"><div className="section-title"><span className="icon-box"><Users size={19}/></span><h2 id="input-heading">지금 웨이팅은?</h2></div><form onSubmit={submit} noValidate>
    <div className="two-fields"><label>전체 웨이팅 수<div className="number-field"><input id="total" aria-label="전체 웨이팅 수" type="number" inputMode="numeric" min="1" max={MODEL.maxWaiting} value={values.total} onChange={e=>set('total',e.target.value)}/><span>팀</span></div></label><label>내 순서<div className="number-field"><input id="rank" aria-label="내 순서" type="number" inputMode="numeric" min="1" max={Number(values.total)||1} value={values.rank} onChange={e=>set('rank',e.target.value)}/><span>번째</span></div></label></div>
    <p className="field-hint">전체 웨이팅 수에 내 팀도 포함해 주세요.</p>
    <label className="time-label" htmlFor="target">언제 입장하고 싶나요?</label><div className="time-field"><Clock3 size={20}/><input id="target" aria-label="원하는 입장시간" type="time" required value={values.target} onChange={e=>set('target',e.target.value)}/></div>
    <fieldset className="tolerance-field"><legend>이 정도 차이는 괜찮아요</legend><div className="segmented">{[5,10,15].map(v=><button type="button" key={v} aria-pressed={values.tolerance===v} className={values.tolerance===v?'active':''} onClick={()=>set('tolerance',v)}>±{v}분</button>)}</div></fieldset>
    <Collapsible.Root open={advanced} onOpenChange={setAdvanced} className="advanced"><Collapsible.Trigger className="disclosure"><span><SlidersHorizontal size={16}/>도착 예정시간 설정</span><ChevronDown size={17} className={advanced?'rotate':''}/></Collapsible.Trigger><Collapsible.Content><label className="arrival-label" htmlFor="arrival">식당 도착 예정시간 <span>선택</span></label><div className="time-field small"><Footprints size={18}/><input id="arrival" aria-label="식당 도착 예정시간" type="time" value={values.arrival} onChange={e=>set('arrival',e.target.value)}/>{values.arrival&&<button type="button" onClick={()=>set('arrival','')} className="clear-time">해제</button>}</div><p className="field-hint">호출 후 3분 유예를 가정해요. 실제 매장 규정은 다를 수 있어요.</p></Collapsible.Content></Collapsible.Root>
    {error&&<p role="alert" className="form-error">{error}</p>}
    <button type="submit" className="primary-button" disabled={loading}>{loading?<><LoaderCircle className="spin" size={18}/>계산 중 {Math.round(progress*100)}%</>:<>입장시간 예측하기<ArrowRight size={19}/></>}</button>
    <p className="input-note">{demo?'실측 예시':'예측 시점'} {clock(now)} 기준 · {demo?'고정된 예시 시간':'기기 시간 자동 반영'}</p>
  </form><div className="privacy-note"><span className="status-dot"/>입력값은 이 브라우저 안에서만 계산해요.</div></section>;
}
