import { ArrowRight, Check, Info, Sparkles, TriangleAlert } from 'lucide-react';
import { MODEL } from '../models/modelConstants';
import { clock } from '../utils/time';
import { percent } from '../utils/probability';
import type { PredictionResult } from '../models/simulation';
export function PredictionSummary({result}:{result:PredictionResult}) {
  const current=result.positions[0], recommended=result.positions.find(p=>p.rank===result.recommendedRank);
  const maintain=recommended?.rank===current.rank;
  const closeAlternative=recommended&&result.positions.find(p=>p.rank!==recommended.rank&&recommended.success-p.success<.01);
  return <><section className="recommend-card" aria-labelledby="recommend-heading"><div className="recommend-top"><span className="recommend-eyebrow"><Sparkles size={16}/>시간에 맞춘 순서 추천</span><span className="target-badge">{clock(result.input.target-MODEL.graceMinutes)}~{clock(result.input.target+result.input.tolerance)} 호출</span></div>
    <h2 id="recommend-heading">{!recommended?'목표시간에 맞추기 어려워요':maintain?'지금 순서를 유지하세요':'조금 미루면, 더 잘 맞아요'}</h2>
    {recommended?<><div className="rank-change"><span className={maintain?'rank-large':'rank-old'}>{current.rank}<small>번째</small></span>{!maintain&&<><ArrowRight className="rank-arrow" size={25}/><span className="rank-large">{recommended.rank}<small>번째</small></span></>}<span className="recommended-tag">{maintain?'유지 추천':`${recommended.rank-current.rank}칸 뒤로`}</span></div><div className="recommend-comparison"><div><span>현재 순서 성공확률</span><strong>{percent(current.success)}</strong></div><ArrowRight size={20}/><div><span>{maintain?'현재 순서 유지 시':'추천 순서 성공확률'}</span><strong>{percent(recommended.success)}</strong></div></div><p className="recommend-foot"><Check size={15}/>{recommended.mean!==null?`추천 순서 평균 입장 ${clock(recommended.mean)}`:'시간 범위 내 평균을 계산할 수 없어요'}{recommended.success<.2?' · 목표 구간 확률이 낮아요':''}</p>{<p className="near-tie-note">추천 순서 도착 전 호출 {percent(recommended.callBeforeArrival)} · 유예 초과 {percent(recommended.missed)}</p>}{closeAlternative&&<p className="near-tie-note">{closeAlternative.rank}번째도 확률이 비슷해요. 1%p 미만 차이는 시뮬레이션 오차 범위일 수 있어요.</p>}</>:<p className="no-recommend">현재부터 마지막 순서까지, 목표 구간에 성공한 시뮬레이션이 없어요. 목표시간을 바꿔 확인해 주세요.</p>}
  </section>
  <div className="irreversible"><Info size={16}/><span>순서를 미루면 다시 앞으로 당길 수 없어요. 실제 변경은 캐치테이블에서 직접 해 주세요.</span></div>
  <section className="summary-card card" aria-label="현재 순서 예상 결과"><div className="summary-heading"><h3>현재 {current.rank}번째라면</h3><span>{clock(result.input.now)} 기준</span></div><div className="summary-grid"><div><span className="stat-label">예상 입장 · 평균</span><strong className="stat-value">{clock(current.mean)}</strong><small>{current.mean===null?'범위 내 입장 없음':`약 ${Math.max(0,Math.round(current.mean-result.input.now))}분 후`}</small></div><div><span className="stat-label">80% 예측구간</span><strong className="stat-range">{clock(current.q10)}<span> ~ </span>{clock(current.q90)}</strong><small>10~90% 분위수</small></div><div><span className="stat-label">시간 내 성공확률</span><strong className="stat-value blue-text">{percent(current.success)}</strong><small>{clock(result.input.target-MODEL.graceMinutes)}~{clock(result.input.target+result.input.tolerance)}</small></div></div>
    {(current.uncalled>0||current.missed>0)&&<p className="censor-note"><TriangleAlert size={14}/>범위 내 입장 실패 {percent(1-current.admitted)} · 평균은 입장한 경우만 계산해요.</p>}
  </section></>;
}
