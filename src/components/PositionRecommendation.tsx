import type { PositionResult } from '../models/simulation';
import { percent } from '../utils/probability';
export function PositionRecommendation({ positions, recommended, selected, onSelect }: { positions: PositionResult[]; recommended: number | null; selected: number; onSelect: (r: number) => void }) {
  return <section className="card positions-card"><h2>순서별 성공확률 비교</h2><p className="field-hint">앞 순서도 이론 비교로 표시해요. 막대를 누르면 호출 분포를 볼 수 있어요.</p><div className="position-bars">{positions.map(p => <button key={p.rank} className={`position-bar ${selected === p.rank ? 'selected' : ''}`} aria-pressed={selected === p.rank} aria-label={`${p.rank}번째 성공확률 ${percent(p.success)}`} onClick={() => onSelect(p.rank)}><span className="bar-percent">{percent(p.success)}</span><span className="bar-track"><i style={{ height: `${p.success * 100}%` }}/></span><span className="bar-rank">{p.rank}<small>{recommended === p.rank ? '최적' : '번째'}</small></span></button>)}</div></section>;
}
