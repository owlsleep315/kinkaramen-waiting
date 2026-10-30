import { Clock3 } from 'lucide-react';
import type { RankMilestone } from '../models/simulation';
import { clock } from '../utils/time';

export function RankTimeline({rank, now, milestones}: {rank:number; now:number; milestones:RankMilestone[]}) {
  return <section className="card rank-timeline" aria-labelledby="rank-timeline-heading">
    <div className="chart-heading"><div><h2 id="rank-timeline-heading">앞 순서가 되는 예상시간</h2><p>현재 {rank}번째를 유지할 때 · 평균 기준</p></div><Clock3 size={19}/></div>
    {milestones.length > 0 ? <>
      <ol className="rank-timeline-list" aria-label="순서별 평균 도달시간" tabIndex={0}>
        {milestones.map(item => <li key={item.rank}>
          <span className="timeline-rank">{item.rank}<small>번째</small></span>
          <strong>{clock(item.mean)}</strong>
          <span className="timeline-wait">{item.mean === null ? '계산 범위 내 미도달 포함' : `약 ${Math.max(0,Math.round(item.mean-now))}분 후`}</span>
        </li>)}
      </ol>
      <p className="timeline-note">입장·취소·미루기를 반영한 예상이에요. 1번째가 된 뒤에도 호출을 기다릴 수 있어요.</p>
    </> : <p className="timeline-empty">이미 1번째예요. 다음 호출을 기다리는 중이며, 예상 호출시간은 위에서 확인할 수 있어요.</p>}
  </section>;
}
