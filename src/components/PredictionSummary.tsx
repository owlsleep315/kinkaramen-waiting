import { ArrowRight, Check, Info, Sparkles, TriangleAlert } from 'lucide-react';
import { MODEL } from '../models/modelConstants';
import { clock } from '../utils/time';
import { percent } from '../utils/probability';
import type { PredictionResult } from '../models/simulation';
import { RankTimeline } from './rank-timeline';
export function PredictionSummary({ result }: { result: PredictionResult }) {
  const current = result.positions.find(p => p.rank === result.input.rank)!;
  const recommended = result.positions.find(p => p.rank === result.recommendedRank);
  const maintain = recommended?.rank === current.rank, ahead = recommended && recommended.rank < current.rank;
  const closeAlternative = recommended && result.positions.find(p => p.rank !== recommended.rank && recommended.success - p.success < .01);
  return <><section className="recommend-card" aria-labelledby="recommend-heading">
    <div className="recommend-top"><span className="recommend-eyebrow"><Sparkles size={16}/>시간에 맞춘 순서 추천</span><span className="target-badge">{clock(result.input.target - MODEL.graceMinutes)}~{clock(result.input.target + result.input.tolerance)} 호출</span></div>
    <h2 id="recommend-heading">{!recommended ? '목표시간에 맞추기 어려워요' : maintain ? '지금 순서를 유지하세요' : ahead ? `최적은 ${recommended.rank}번째예요` : `${recommended.rank}번째로 미루는 게 좋아요`}</h2>
    {recommended ? <>
      <div className="rank-change"><span className={maintain ? 'rank-large' : 'rank-old'}>{current.rank}<small>번째</small></span>{!maintain && <><ArrowRight className="rank-arrow" size={25}/><span className="rank-large">{recommended.rank}<small>번째</small></span></>}<span className="recommended-tag">{maintain ? '유지 추천' : ahead ? '이론상 최적' : `${recommended.rank - current.rank}칸 뒤로`}</span></div>
      <div className="recommend-comparison"><div><span>현재 순서 성공확률</span><strong>{percent(current.success)}</strong></div><ArrowRight size={20}/><div><span>최적 순서 성공확률</span><strong>{percent(recommended.success)}</strong></div></div>
      <p className="recommend-foot"><Check size={15}/>{recommended.callMean !== null ? `최적 순서 평균 호출 ${clock(recommended.callMean)}` : '호출이 계산 범위를 벗어날 수 있어요.'}{recommended.success < .2 ? ' · 성공확률이 낮아요' : ''}</p>
      <p className="near-tie-note">유예를 넘기는 조기 호출 위험 {percent(recommended.missed)}</p>
      {ahead && <p className="near-tie-note">앞으로 당길 수는 없어요. 현재 순서를 유지하는 편이 도착 후 대기를 줄여요.</p>}
      {recommended.rank === MODEL.maxRank && <p className="near-tie-note">계산 상한인 {MODEL.maxRank}번째예요. 더 뒤의 최적 순서는 확인하지 못했어요.</p>}
    </> : <p className="no-recommend">계산한 1~{MODEL.maxRank}번째에서 목표 구간에 호출된 경우가 없어요. 도착시간을 바꿔 확인해 주세요.</p>}
  </section>
  <div className="irreversible"><Info size={16}/><span>순서를 미루면 되돌릴 수 없어요. 예측 결과를 참고해 신중하게 결정해 주세요.</span></div>
  <section className="summary-card card" aria-label="현재 순서 예상 결과"><div className="summary-heading"><h3>현재 {current.rank}번째라면</h3><span>{clock(result.input.now)} 기준</span></div><div className="summary-grid"><div><span className="stat-label">예상 호출 · 평균</span><strong className="stat-value">{clock(current.callMean)}</strong><small>{current.callMean === null ? '계산 범위 밖 호출 포함' : `약 ${Math.max(0, Math.round(current.callMean - result.input.now))}분 후`}</small></div><div><span className="stat-label">호출 80% 구간</span><strong className="stat-range">{clock(current.callQ10)}<span> ~ </span>{clock(current.callQ90)}</strong><small>10~90% 분위수</small></div><div><span className="stat-label">시간 내 성공확률</span><strong className="stat-value blue-text">{percent(current.success)}</strong><small>도착 전 3분~도착 후 {result.input.tolerance}분</small></div></div>
    <p className="censor-note"><TriangleAlert size={14}/>현재 순서의 조기 호출 위험 {percent(current.missed)} · 도착 시 바로 입장 {percent(current.beforeTarget)}</p>
  </section><RankTimeline rank={result.input.rank} now={result.input.now} milestones={result.rankTimeline}/></>;
}
