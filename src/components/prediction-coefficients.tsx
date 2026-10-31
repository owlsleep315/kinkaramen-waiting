import type { PredictionResult } from '../models/simulation';

export function PredictionCoefficients({ result, rank }: { result: PredictionResult; rank: number }) {
  const info = result.modelInfo;
  const localOnly = result.input.mode === 'other' && info.intervals > 0;
  const timeText = (minutes: number) => Number.isFinite(minutes) ? `${minutes.toFixed(2)}분` : '추정 불가';
  const probability = (rate: number) => `${(-Math.expm1(-10 * rate) * 100).toFixed(2)}%`;
  return <section className="card coefficients-card" aria-labelledby="coefficients-heading">
    <div className="chart-heading"><div><h2 id="coefficients-heading">이번 예측에 사용한 계수</h2><p>현재·추천 순서와 모든 차트에 같은 모델을 적용해요.</p></div></div>
    <dl className="coefficient-grid">
      <div><dt>{rank === 1 ? '1번째에서 다음 호출까지 평균' : '한 팀 줄어드는 평균 시간'}</dt><dd>{timeText(info.stepMinutes[rank - 1])}</dd><p>{rank === 1 ? '앞 팀이 없어 호출만 기다려요.' : `${rank} → ${rank - 1}번째 기준 · 호출·취소·미루기 반영`}</p></div>
      <div><dt>취소 확률</dt><dd>{probability(info.cancellation)}</dd><p>앞 팀 한 팀당 · 10분 내 · 고정 가정</p></div>
      <div><dt>미루기 확률</dt><dd>{probability(info.defer)}</dd><p>앞 팀 한 팀당 · 10분 내 · 고정 가정</p></div>
    </dl>
    <p className="coefficient-explanation">{localOnly ? '호출 속도는 이 매장 기록만 사용해요. 킨카라멘 호출 속도 반영은 0%예요.' : '킨카라멘 실측 기록으로 보정한 호출 속도를 사용했어요.'} 순서가 앞당겨질수록 취소·미루기로 줄어들 기회가 적어져 한 팀당 평균 시간도 달라져요. 위 시간은 비교 중인 {rank}번째의 평균이에요.</p>
    <p className="coefficient-explanation">기본 호출만으로 한 팀 줄어드는 평균: <strong>{timeText(info.stepMinutes[0])}</strong>. 취소·미루기 확률은 한 팀이 10분 동안 계속 기다린다는 조건이며, 내 전체 대기 중 발생 확률은 아니에요. 미룬 팀이 내 뒤로 넘어올 비율은 <strong>{(info.crossing * 100).toFixed(0)}%</strong>로 가정해요.</p>
    {localOnly && <p className="coefficient-explanation">호출 속도는 기록에서 추정한 값으로 고정하고, 호출·취소·미루기가 발생하는 시간의 변동을 계산해요. 기록이 적으면 추정값이 크게 달라질 수 있어요.{info.service === 0 && ' 현재 기록에서는 호출 속도가 0으로 추정돼 호출 시각을 계산할 수 없어요. 실제 영업 중단을 뜻하지 않으며, 시간이 지난 뒤 기록을 추가해 주세요.'}</p>}
    <details className="data-details"><summary>계수와 계산식 확인하기</summary><p>기본 호출률 μ{localOnly ? ' 추정값' : '의 평균'}: {info.service.toFixed(6)}팀/분 · 취소율 c: {info.cancellation.toFixed(6)}/분 · 미루기율 d: {info.defer.toFixed(6)}/분 · 내 뒤로 이동할 비율 q: {info.crossing}</p><p>순서 r의 감소율 = μ + (r − 1) × (c + d × q). {localOnly ? '평균 시간은 1 / 감소율이에요. μ는 이 매장의 관측 구간을 가장 잘 설명하는 값으로 추정해요.' : '평균 시간은 각 호출률에 따른 1 / 감소율을 추정 분포의 비중으로 평균해요.'} 확률은 1 − exp(−10 × 발생률)로 계산해요.</p><p>{!localOnly && '호출률을 여러 값으로 뽑아 계산하므로 평균 시간은 평균 호출률의 역수와 다를 수 있어요. '}1번째의 시간은 다음 호출 대기이며, 영업 시작 전 대기는 별도로 더해져요.</p></details>
  </section>;
}
