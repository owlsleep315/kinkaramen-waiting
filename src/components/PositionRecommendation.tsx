import { useEffect, useRef } from 'react';
import { ChevronRight, MousePointer2 } from 'lucide-react';
import type { PositionResult } from '../models/simulation';
import { percent } from '../utils/probability';
export function PositionRecommendation({currentRank,positions,recommended,selected,onSelect}:{currentRank:number;positions:PositionResult[];recommended:number|null;selected:number;onSelect:(rank:number)=>void}) {
  const bars = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = bars.current?.querySelector<HTMLElement>('.selected'); if (el && bars.current) bars.current.scrollLeft = el.offsetLeft - bars.current.offsetLeft - bars.current.clientWidth / 2 + el.clientWidth / 2; }, [selected]);
  const max=Math.max(.01,...positions.map(p=>p.success));
  return <section className="card positions-card"><div className="chart-heading"><div><h2>몇 번째가 가장 좋을까요?</h2><p>각 순서의 목표 구간 입장확률을 비교해요.</p></div><span className="soft-badge">{positions.length}개 순서 비교</span></div><div className="position-bars" ref={bars} role="group" aria-label="비교할 순서 선택">{positions.map(p=><button type="button" key={p.rank} aria-pressed={selected===p.rank} aria-label={`${p.rank}번째, 성공확률 ${percent(p.success)}${recommended===p.rank?', 추천':''}`} className={`position-bar ${selected===p.rank?'selected':''} ${recommended===p.rank?'best':''}`} onClick={()=>onSelect(p.rank)}><span className="bar-percent">{percent(p.success)}</span><span className="bar-track"><span style={{height:`${Math.max(2,p.success/max*100)}%`}}/></span><span className="bar-rank">{p.rank}<small>번째</small></span><span className="bar-badge">{p.rank===recommended?'추천':p.rank===currentRank?'현재':' '}</span></button>)}</div><div className="position-hint"><MousePointer2 size={14}/><span>옆으로 넘겨 순서를 누르면 차트에서 비교해요.</span><ChevronRight size={14}/></div></section>;
}
