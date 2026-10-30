import { newId } from './utils/id';
import { useEffect, useMemo, useState } from 'react';
import { ChartNoAxesCombined, Clock3, RotateCcw } from 'lucide-react';
import { WaitingInput } from './components/WaitingInput';
import { StoreSession } from './components/StoreSession';
import { PredictionSummary } from './components/PredictionSummary';
import { ProbabilityChart } from './components/ProbabilityChart';
import { CumulativeChart } from './components/CumulativeChart';
import { PositionRecommendation } from './components/PositionRecommendation';
import { ModelExplanation } from './components/ModelExplanation';
import { useWaitingPrediction } from './hooks/useWaitingPrediction';
import { localEvidence, validateRank } from './models/waitingModel';
import type { PredictionInput } from './models/simulation';
import { MODEL } from './models/modelConstants';
import { clock, parseTime, seoulMinutes, seoulDate } from './utils/time';
import { percent } from './utils/probability';
import { initialState, loadState, saveState, startSession, STORAGE_KEY, type Session, type Values } from './state/storage';

export default function App() {
  const [live, setLive] = useState(() => ({ now: seoulMinutes(), date: seoulDate() }));
  const [loaded] = useState(() => { try { return loadState(window.localStorage, seoulDate()); } catch { return { state: initialState(seoulDate()), warning: '저장소 접근이 차단됐어요. 현재 입력은 저장되지 않을 수 있어요.', writable: false }; } });
  const [state, setState] = useState(loaded.state), [writable, setWritable] = useState(loaded.writable), [storageWarning, setStorageWarning] = useState(loaded.warning);
  const [demo, setDemo] = useState(false), [selectedRank, setSelectedRank] = useState<number | null>(null), [chart, setChart] = useState<'distribution' | 'cumulative'>('distribution');
  useEffect(() => { const tick = () => setLive({ now: seoulMinutes(), date: seoulDate() }); const timer = setInterval(tick, 15000); window.addEventListener('focus', tick); document.addEventListener('visibilitychange', tick); return () => { clearInterval(timer); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick); }; }, []);
  useEffect(() => { if (!writable) return; try { setStorageWarning(saveState(window.localStorage, state)); } catch { setStorageWarning('저장소 접근이 차단됐어요. 변경사항이 저장되지 않았어요.'); } }, [state, writable]);
  const session = state.sessions.find(s => s.id === state.activeSessionId)!;
  const custom = state.tab === 'custom', now = demo && !custom ? 786 : live.now;
  const values = custom ? session.values : state.kinka;
  const evidence = useMemo(() => localEvidence(session.records, now, live.date), [session.records, now, live.date]);
  const rank = Number(values.rank), target = parseTime(values.target);
  const inputError = validateRank(rank) ?? (!Number.isFinite(target) ? '도착시간을 선택해 주세요.' : target <= now ? '도착시간이 현재보다 이르거나 같아요. 오늘의 미래 시각을 선택해 주세요.' : '');
  const input: PredictionInput | null = inputError ? null : { rank, now, target, tolerance: values.tolerance, mode: custom ? 'custom' : 'kinka', ...(custom ? { evidence } : {}) };
  const { result, loading, progress, error } = useWaitingPrediction(input);
  const current = result?.positions[rank - 1];
  const selected = result?.positions[(selectedRank ?? rank) - 1] ?? current;
  function updateSession(next: Session) { setState(s => ({ ...s, sessions: s.sessions.map(x => x.id === next.id ? next : x) })); }
  function updateValues(next: Values) { setSelectedRank(null); if (custom) updateSession({ ...session, values: next }); else setState(s => ({ ...s, kinka: next, kinkaDate: live.date })); }
  function resetAll() { if (!window.confirm('모든 매장의 관측 기록과 설정을 삭제할까요?')) return; try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* Continue in memory when storage is unavailable. */ } setState(initialState(live.date)); setWritable(true); setDemo(false); setSelectedRank(null); }
  return <div className="app"><a href="#waiting-form" className="skip-link">웨이팅 입력으로 이동</a><header className="site-header"><div className="header-inner"><a href="#" className="brand"><span className="brand-mark"><ChartNoAxesCombined size={23}/></span>웨이팅 순서 예측</a><a className="header-link" href="#model">예측 근거</a></div></header>
    <main className="page-container"><section className="page-intro"><div><div className="eyebrow">내 차례에 맞추는 시간</div><h1>몇 번째로 기다릴까요?</h1><p>내 순서와 도착시간으로 호출 가능성을 확인해요.</p></div><div className="live-clock"><span><Clock3 size={14}/>{demo && !custom ? '예시 기준' : '현재 · 서울'}</span><strong>{clock(now)}</strong></div></section>
      <div className="store-tabs" role="tablist" aria-label="매장 선택">{(['kinka', 'custom'] as const).map(tab => <button id={`${tab}-tab`} role="tab" aria-selected={state.tab === tab} aria-controls="store-panel" tabIndex={state.tab === tab ? 0 : -1} key={tab} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 'kinka' : e.key === 'End' ? 'custom' : tab === 'kinka' ? 'custom' : 'kinka'; setState(s => ({ ...s, tab: next })); setSelectedRank(null); document.getElementById(`${next}-tab`)?.focus(); } }} onClick={() => { setState(s => ({ ...s, tab })); setSelectedRank(null); }} className={state.tab === tab ? 'active' : ''}>{tab === 'kinka' ? '킨카라멘' : '다른 매장'}</button>)}</div>
      {storageWarning && <div className="notice" role="status">{storageWarning}</div>}
      <div className="context-strip"><span>{custom ? '매장의 호출 유예를 확인해 주세요. 여기서는 3분을 가정해요.' : '호출 후 3분 안에 도착해야 해요. 입장 가능 시각은 11:00부터예요.'}</span>{!custom && <button onClick={() => { setDemo(!demo); setSelectedRank(null); if (!demo) setState(s => ({ ...s, kinka: { rank: '4', target: '13:30', tolerance: 10 } })); }}>{demo ? <><RotateCcw size={14}/>실시간으로</> : '13:06 실측 예시 보기'}</button>}</div>
      {demo && !custom && <div className="notice">예시 모드 · 10/29 13:06의 4번째 순서를 기준으로 계산해요.</div>}
      {!demo && !custom && state.kinkaDate !== live.date && <div className="notice">지난 날짜의 입력값이에요. 오늘의 현재 순서를 확인하고 다시 입력해 주세요.</div>}
      {custom && session.date !== live.date && <div className="notice">지난 방문의 기록을 보고 있어요. 오늘의 예측에는 과거 기록을 섞지 않아요. 새 웨이팅을 시작해 주세요.</div>}
      <div id="store-panel" role="tabpanel" aria-labelledby={`${state.tab}-tab`} className="workspace-grid"><aside className="input-column" id="waiting-form"><WaitingInput values={values} onChange={updateValues}/>
        {custom && <StoreSession key={session.id} session={session} sessions={state.sessions} onChange={updateSession} onSelect={id => { setState(s => ({ ...s, activeSessionId: id })); setSelectedRank(null); }} onNew={() => { setState(s => startSession(s, live.date, newId())); setSelectedRank(null); }} now={now} date={live.date}/>}
        {custom && <div className="side-info"><strong>{evidence.intervals ? `실측 ${evidence.minutes}분 · ${evidence.count}칸 감소` : '킨카라멘 사전 모델 사용 중'}</strong><p>매장 실측 가중치 {percent(evidence.weight)}{evidence.excluded > 0 ? ` · 모호하거나 직접 미룬 ${evidence.excluded}구간 제외` : ''}</p><p>기록 0~1개로는 매장 속도를 알 수 없어요. 새로운 관측을 추가하면 자동 반영돼요.</p></div>}
        <p className="side-info">실제 웨이팅과 자동 연동되지 않아요. 현재 순서를 그대로 둔 채 현재 시각만 갱신하면 예측도 뒤로 이동해요.</p>
      </aside><div className="result-column" aria-busy={loading}>
        {inputError && <div className="notice" role="status">{inputError}</div>}{error && <div className="error-banner" role="alert">{error}</div>}
        {loading && <div className="loading-banner" role="status">확률을 계산하고 있어요 · {Math.round(progress * 100)}%</div>}
        {result && current && selected && <div className="results"><PredictionSummary result={result}/>
          <section className="card chart-card"><div className="chart-heading"><div><h2>입장 호출 시각 분포</h2><p>도착시간과 무관한 실제 호출 예측 · 현재 {rank}번째 / 선택 {selected.rank}번째</p></div></div>
            <div className="chart-tabs"><button aria-pressed={chart === 'distribution'} className={chart === 'distribution' ? 'active' : ''} onClick={() => setChart('distribution')}>시간별 확률</button><button aria-pressed={chart === 'cumulative'} className={chart === 'cumulative' ? 'active' : ''} onClick={() => setChart('cumulative')}>누적 확률</button></div>
            <div className="chart-legend"><span><i className={current.rank === selected.rank ? 'blue' : 'gray'}/>현재 {current.rank}번째</span>{current.rank !== selected.rank && <span><i className="blue"/>선택 {selected.rank}번째</span>}<span><i className="target"/>목표 호출 구간</span></div>
            {chart === 'distribution' ? <ProbabilityChart current={current} selected={selected} target={target} tolerance={values.tolerance}/> : <CumulativeChart current={current} selected={selected} target={target} tolerance={values.tolerance}/>}
            <div className="chart-insight"><p><strong>{selected.rank}번째</strong>의 목표 호출 구간은 <strong>{clock(target - MODEL.graceMinutes)}~{clock(target + values.tolerance)}</strong>, 성공확률은 <strong>{percent(selected.success)}</strong>예요.</p></div>
            <div className="probability-split"><div><span>너무 이른 호출</span><strong>{percent(selected.missed)}</strong></div><div><span>목표 구간 호출</span><strong>{percent(selected.success)}</strong></div><div><span>목표 구간 이후 호출</span><strong>{percent(selected.afterWindow)}</strong></div></div>
            <p className="chart-note">{clock(result.end)}까지 미호출 {percent(selected.uncalled)} · 이를 합하면 전체 100%예요.<br/>그래프는 주요 확률 구간을 확대해요. 전체 꼬리 확률은 아래 표에 포함돼요.<br/>호출을 놓치지 않고 계산 범위 안에 호출된 경우, 도착 후 평균 대기 {selected.expectedWait === null ? '계산 불가' : `${selected.expectedWait.toFixed(1)}분`}이에요.</p>
            <details className="data-details"><summary>선택 순서의 상세 수치</summary><p>호출 중앙값 {clock(selected.median)} · 평균 {clock(selected.mean)}</p><p>50% {clock(selected.q25)}~{clock(selected.q75)} / 80% {clock(selected.q10)}~{clock(selected.q90)} / 90% {clock(selected.q05)}~{clock(selected.q95)}</p><div className="table-scroll"><table><caption>{selected.rank}번째 호출 확률 · 구간 끝까지 누적</caption><thead><tr><th>시각</th><th>확률</th><th>누적</th></tr></thead><tbody>{selected.bins.map(b => <tr key={b.time}><td>{clock(b.time)}~{clock(Math.min(b.time + 5, result.end))}</td><td>{percent(b.probability)}</td><td>{percent(b.cumulative)}</td></tr>)}</tbody></table></div></details>
          </section>
          <PositionRecommendation positions={result.positions} recommended={result.recommendedRank} selected={selected.rank} onSelect={setSelectedRank}/>
          <details className="card milestone-card"><summary>앞 순서가 되는 예상시간</summary><p className="field-hint">현재 순서를 유지할 때의 평균이에요. 1번째 도달과 실제 호출은 달라요.</p>{result.rankTimeline.length ? <div className="interval-list">{result.rankTimeline.map(row => <div key={row.rank}><span>{row.rank}번째 도달</span><b>{clock(row.mean)}</b></div>)}</div> : <p>이미 1번째예요. 다음 실제 호출을 기다리는 상태예요.</p>}</details>
          <p className="notice">두 날짜의 제한된 기록으로 계산한 모델 확률이에요. 실제 호출 완료 데이터가 없어 입장 확률은 검증되지 않았어요.{(!custom && (now >= 798 || target > 798)) ? ' 13:18 이후는 관측 범위 밖의 예측이에요.' : ''}</p>
        </div>}
      </div></div><ModelExplanation/><footer><span>웨이팅 순서 예측 · 비공식 예측 도구</span><button className="text-button" onClick={resetAll}>저장 데이터 전체 초기화</button><small>이 브라우저에만 저장되며 영구 보관은 보장되지 않아요. <a href={`${import.meta.env.BASE_URL}kinkaramen-waiting-source.zip`} download>전체 소스코드 받기 ↗</a></small></footer>
    </main></div>;
}
