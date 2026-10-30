import type { PredictionResult } from '../models/simulation';
import { clock } from '../utils/time';
import { percent } from '../utils/probability';
export function PredictionSummary({ result }: { result: PredictionResult }) {
  const current = result.positions[result.input.rank - 1];
  const best = result.recommendedRank ? result.positions[result.recommendedRank - 1] : null;
  const actionable = result.feasibleRank ? result.positions[result.feasibleRank - 1] : null;
  const ahead = best && best.rank < current.rank;
  return <><section className="card summary-card"><span className="eyebrow">현재 {current.rank}번째를 유지하면</span><h2>예상 입장 호출 <strong>{clock(current.median)}</strong></h2><p className="field-hint">중앙값 · 실제 입장은 도착 후 가능하며, 호출 3분 안에 도착해야 해요.</p>
    <div className="metric-grid"><div><span>도착할 때 바로 입장 가능</span><strong>{percent(current.onArrival)}</strong><small>도착 3분 전~도착 시각 호출</small></div><div><span>도착까지 호출될 확률</span><strong>{percent(current.callBeforeArrival)}</strong><small>놓친 호출도 포함</small></div><div><span>너무 이른 호출 위험</span><strong className="risk-text">{percent(current.missed)}</strong><small>도착 3분 전보다 이른 호출</small></div></div>
    <div className="interval-list">{[['50%', current.q25, current.q75], ['80%', current.q10, current.q90], ['90%', current.q05, current.q95]].map(([label, left, right]) => <div key={String(label)}><span>{label} 예측구간</span><b>{clock(left as number | null)} ~ {clock(right as number | null)}</b></div>)}</div>
  </section><section className="recommend-card"><div className="eyebrow">도착 {clock(result.input.target)} · 도착 후 {result.input.tolerance}분까지 허용</div>
    <h2>{best ? <>이론상 최적은 <strong>{best.rank}번째</strong>예요</> : '목표 시간대에 맞는 순서를 찾지 못했어요'}</h2>
    {best && <><p className="recommend-action">{ahead ? `앞으로 당길 수는 없어요. 지금 가능한 범위에서는 ${actionable?.rank === current.rank ? '현재 순서를 유지하세요.' : actionable ? `${actionable.rank}번째가 가장 좋아요.` : '추천이 어려워요.'}` : best.rank === current.rank ? '지금 순서를 유지하세요.' : `${best.rank}번째가 선택 가능하면 뒤로 미루는 편이 좋아요.`}</p>
      <div className="recommend-comparison"><div><span>현재 순서 성공확률</span><strong>{percent(current.success)}</strong></div><div><span>이론상 최적 성공확률</span><strong>{percent(best.success)}</strong></div></div>
      {ahead && actionable && <p>앞으로 이동하지 않는 후보의 최적 성공확률은 {percent(actionable.success)}예요.</p>}
      <p className="recommend-foot">도착 3분 전부터 도착 후 {result.input.tolerance}분까지 호출될 확률이 가장 높은 순서를 골라요. 너무 이른 호출은 실패로 계산해요.</p>
      <p className="recommend-foot">실제 선택 가능한 마지막 순서는 캐치테이블에서 확인해 주세요. 이 앱은 순서를 변경하지 않아요.</p>
      {best.success < .3 && <p className="notice">가장 좋은 후보도 성공확률이 낮아요. 추천을 확정적인 지시로 보지 마세요.</p>}
      {Math.abs(best.success - current.success) < .015 && best.rank !== current.rank && <p className="notice">현재 순서와 차이가 1.5%p 미만이에요. 미세한 차이로 순서를 변경하지 않는 편이 나을 수 있어요.</p>}
    </>}{result.searchLimited && <p className="notice">도착시간 또는 최적 후보가 계산 범위의 끝에 있어요. 이 추천은 범위 안에서의 비교이며 신뢰하기 어려워요.</p>}
  </section></>;
}
