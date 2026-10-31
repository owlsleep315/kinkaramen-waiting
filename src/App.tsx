import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ArrowUpRight, ChartNoAxesCombined, Clock3, FlaskConical, Info, RotateCcw, Soup, Sparkles } from 'lucide-react';
import { WaitingInput } from './components/WaitingInput';
import { ObservationRecords } from './components/ObservationRecords';
import { PredictionSummary } from './components/PredictionSummary';
import { PredictionCoefficients } from './components/prediction-coefficients';
import { ProbabilityChart } from './components/ProbabilityChart';
import { CumulativeChart } from './components/CumulativeChart';
import { PositionRecommendation } from './components/PositionRecommendation';
import { ModelExplanation } from './components/ModelExplanation';
import { useWaitingPrediction } from './hooks/useWaitingPrediction';
import { clock, parseTime, seoulDate, seoulMinutes } from './utils/time';
import { percent } from './utils/probability';
import { appendPredictionRecord, defaultState, formError, loadState, saveState, type FormValues } from './state/storage';
import type { PredictionInput } from './models/simulation';
import { MODEL } from './models/modelConstants';
import { localModel } from './models/waitingModel';
const demoDefaults: FormValues = { rank: '4', target: '13:30', tolerance: 10 };
function restore() { try { return loadState(window.localStorage); } catch { return { state: defaultState(), writable: false, warning: '브라우저 저장소를 사용할 수 없어 이번 화면에서만 유지돼요.' }; } }
export default function App() {
  const [initial] = useState(restore), [saved, setSaved] = useState(initial.state), [writable, setWritable] = useState(initial.writable), [warning, setWarning] = useState(initial.warning);
  const [clockTick, setClockTick] = useState(() => new Date()), [demo, setDemo] = useState(false), [demoValues, setDemoValues] = useState(demoDefaults);
  const [selectedRank, setSelectedRank] = useState(4), [chart, setChart] = useState<'distribution' | 'cumulative'>('distribution');
  const { result, loading, progress, error, predict, clear: clearPrediction } = useWaitingPrediction();
  const [collectionNotice, setCollectionNotice] = useState('');
  function clear() { clearPrediction(); setCollectionNotice(''); }
  const reduceMotion = useReducedMotion(), chartRef = useRef<HTMLElement>(null);
  const tab = saved.tab, values = demo ? demoValues : saved[tab];
  const now = demo ? 786 : seoulMinutes(clockTick), date = demo ? '2026-10-29' : seoulDate(clockTick);
  const invalid = formError(values, now);
  useEffect(() => {
    const refresh = () => setClockTick(new Date());
    const interval = setInterval(refresh, 15_000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(interval); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  useEffect(() => {
    if (!writable) return;
    try { if (!saveState(window.localStorage, saved)) setWarning('저장 공간이 부족하거나 저장이 차단됐어요. 현재 변경 내용은 새로고침하면 사라질 수 있어요.'); else setWarning(''); }
    catch { setWarning('브라우저 저장소에 접근할 수 없어요. 현재 화면에서만 유지돼요.'); }
  }, [saved, writable]);
  useEffect(() => { if (result) setSelectedRank(result.recommendedRank ?? result.input.rank); }, [result]);
  const active = result;
  const dirty = !!active && (Number(values.rank) !== active.input.rank || parseTime(values.target) !== active.input.target || values.tolerance !== active.input.tolerance);
  const current = active?.positions.find(p => p.rank === active.input.rank);
  const selected = active?.positions.find(p => p.rank === selectedRank) ?? current;
  const setValues = (v: FormValues) => demo ? setDemoValues(v) : setSaved(s => ({ ...s, [tab]: v }));
  function run() {
    if (loading) return;
    const submittedAt = new Date();
    const submittedNow = demo ? 786 : seoulMinutes(submittedAt), submittedDate = demo ? '2026-10-29' : seoulDate(submittedAt);
    if (formError(values, submittedNow)) { setClockTick(submittedAt); return; }
    const records = tab === 'other' ? appendPredictionRecord(saved.records, submittedDate, submittedNow, Number(values.rank), crypto.randomUUID()) : undefined;
    const input: PredictionInput = { rank: Number(values.rank), target: parseTime(values.target), tolerance: values.tolerance, now: submittedNow, mode: tab, date: submittedDate, observations: records };
    setClockTick(submittedAt);
    setCollectionNotice('');
    if (records && localModel(records, submittedDate, submittedNow).needsObservation) {
      clear();
      setSaved(s => ({ ...s, records }));
      setCollectionNotice('순서 기록을 저장했어요. 오늘 기록은 2개 이상이지만 같은 분의 기록이나 미루기 구간만 있어 호출 속도를 계산할 수 없어요. 다음 분 이후 현재 순서로 다시 예측해 주세요. 킨카라멘 호출 속도로 보정하지 않아요.');
      return;
    }
    predict(input, () => { if (records) setSaved(s => ({ ...s, records })); });
  }
  function example() { clear(); setSaved(s => ({ ...s, tab: 'kinka' })); setDemoValues(demoDefaults); setDemo(true); }
  return <div className="app">
    <a href="#waiting-form" className="skip-link">웨이팅 입력으로 이동</a>
    <header className="site-header"><div className="header-inner"><a href="#" className="brand" aria-label="웨이팅 순서 예측 홈"><span className="brand-mark"><Soup size={24} strokeWidth={1.8}/></span><span>웨이팅 순서 예측</span></a><a className="header-link" href="#model">예측 모델 안내<ArrowUpRight size={15}/></a></div></header>
    <main className="page-container">
      <section className="page-intro"><div><div className="eyebrow"><span className="blue-dot"/>내 소중한 시간을 위한 작은 도우미</div><h1>기다림은 짧게,<br className="mobile-break"/> 내 시간은 길게.</h1><p>내 도착 시간에 딱 맞는 순서를 찾아보세요.</p></div><div className="live-clock"><span><Clock3 size={14}/>{demo ? '예시 기준시간' : '현재시간 · 서울'}</span><strong>{clock(now)}<span className="clock-dot"/></strong></div></section>
      <div className="store-tabs" role="tablist" aria-label="예측 매장"><button role="tab" id="kinka-tab" aria-selected={tab === 'kinka'} aria-controls="store-panel" className={tab === 'kinka' ? 'active' : ''} onClick={() => { clear(); setDemo(false); setSaved(s => ({ ...s, tab: 'kinka' })); }}>킨카라멘</button><button role="tab" id="other-tab" aria-selected={tab === 'other'} aria-controls="store-panel" className={tab === 'other' ? 'active' : ''} onClick={() => { clear(); setDemo(false); setSaved(s => ({ ...s, tab: 'other' })); }}>다른 매장</button></div>
      {warning && <p role="status" className="stale-banner">{warning}</p>}
      {demo ? <div className="mode-banner"><FlaskConical size={17}/><span><strong>실측 시점 예시</strong> · 13:06 기준 예시예요. <br />예측하기를 눌러 확인해 주세요.</span><button onClick={() => { clear(); setDemo(false); }}><RotateCcw size={13}/>실시간으로</button></div> : <div className="context-strip"><div><Info size={16}/><span>{tab === 'kinka' ? '호출 후 3분 안에 도착해야 입장할 수 있어요.' : '관측한 순서 변화로 지금 기다리는 곳의 속도를 반영해요.'}</span></div>{tab === 'kinka' && <button onClick={example}>실측 시점 예시 보기<ArrowRight size={14}/></button>}</div>}
      <div id="store-panel" role="tabpanel" aria-labelledby={`${tab}-tab`} className="workspace-grid">
        <aside className="input-column" id="waiting-form">
          <WaitingInput now={now} values={values} setValues={setValues} onPredict={run} loading={loading} progress={progress} demo={demo}/>
          {tab === 'other' && <ObservationRecords rows={saved.records} date={date} onChange={records => { clear(); setSaved(s => ({ ...s, records })); }}/>}
          <div className="side-note"><span className="small-icon"><ChartNoAxesCombined size={17}/></span><div><strong>평균만으로는 알 수 없으니까</strong><p>앞 팀의 취소와 순서 미루기까지 고려해<br/>10,000번의 가능한 상황을 계산해요.</p></div></div><div className="side-disclaimer">캐치테이블·킨카라멘의 공식 서비스가 아니에요.<br/>실제 웨이팅과 연동되지 않는 예측 도구예요.</div>
        </aside>
        <div className="result-column" aria-busy={loading}>
          <div role="status" className="sr-only">{loading ? `계산 중 ${Math.round(progress * 100)}%` : active ? '예측 계산이 완료되었어요.' : ''}</div>
          {error && <div className="error-banner" role="alert">{error}</div>}
          {collectionNotice && <div className="stale-banner" role="status">{collectionNotice}</div>}
          {loading && <div className="loading-banner"><span className="pulse-dot"/>가능한 입장 상황을 계산하고 있어요.<span>{Math.round(progress * 100)}%</span><div style={{ width: `${progress * 100}%` }}/></div>}
          {active && current && selected ? <motion.div initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} className="results">
            {dirty && <div className="stale-banner" role="status">입력값이 바뀌었어요. 아래는 이전 입력의 결과예요. 예측하기를 눌러 다시 계산해 주세요.</div>}
            {!demo && (date !== active.input.date || now - active.input.now >= 1) && <div className="stale-banner">{active.input.date} {clock(active.input.now)} 기준 결과예요. 현재 순서를 확인하고 예측하기를 눌러 주세요.</div>}
            {tab === 'other' && <div className="local-model-note">{active.modelInfo.intervals ? `오늘 ${active.modelInfo.minutes}분 동안 ${active.modelInfo.count}칸 감소한 이 매장 기록만으로 호출 속도를 추정했어요. 킨카라멘 호출 속도 반영은 0%예요.` : '오늘 기록이 1개 이하라 킨카라멘 기준으로 임시 예측해요.'}{active.modelInfo.excluded > 0 && <span> 직접 미루기·모호한 구간 {active.modelInfo.excluded}개 제외</span>}{active.modelInfo.otherDates > 0 && <span> · 지난 날짜 기록 제외</span>}{active.modelInfo.future > 0 && <span> · 미래 시각 기록 제외</span>}</div>}
            <PredictionSummary result={active}/>
            <PredictionCoefficients result={active} rank={selected.rank}/>
            <section className="card chart-card" ref={chartRef}>
              <div className="chart-heading"><div><h2>언제 호출될까요?</h2><p>도착 전 호출까지 포함한 전체 호출 분포</p></div><span className="soft-badge">{clock(active.input.now)} 기준</span></div>
              <div className="chart-tabs" role="tablist" aria-label="호출확률 차트 유형"><button id="distribution-tab" role="tab" aria-controls="chart-panel" aria-selected={chart === 'distribution'} onClick={() => setChart('distribution')} className={chart === 'distribution' ? 'active' : ''}>호출시간 분포</button><button id="cumulative-tab" role="tab" aria-controls="chart-panel" aria-selected={chart === 'cumulative'} onClick={() => setChart('cumulative')} className={chart === 'cumulative' ? 'active' : ''}>누적 호출확률</button></div>
              <div className="chart-legend"><span><i className={selected.rank === current.rank ? 'blue' : 'gray'}/>현재 {current.rank}번째</span>{selected.rank !== current.rank && <span><i className="blue"/>{selected.rank === active.recommendedRank ? '추천' : '선택'} {selected.rank}번째</span>}<span><i className="target"/>목표 시간대</span></div>
              <div id="chart-panel" role="tabpanel" aria-labelledby={`${chart}-tab`}>{chart === 'distribution' ? <ProbabilityChart current={current} selected={selected} target={active.input.target} tolerance={active.input.tolerance}/> : <CumulativeChart current={current} selected={selected} target={active.input.target} tolerance={active.input.tolerance}/>}</div>
              <div className="chart-insight"><span className="insight-icon"><Sparkles size={17}/></span><p><strong>{selected.rank}번째</strong>의 <strong>{clock(active.input.target - MODEL.graceMinutes)}~{clock(active.input.target + active.input.tolerance)}</strong> 호출 확률은 <strong className="blue-text">{percent(selected.success)}</strong>예요.</p></div>
              <div className="probability-split"><div><span>너무 이른 호출</span><strong>{percent(selected.missed)}</strong></div><div className="highlight"><span>목표 구간 안에</span><strong>{percent(selected.success)}</strong></div><div><span>목표 구간보다 늦게</span><strong>{percent(selected.afterWindow)}</strong></div></div>
              <p className="chart-note">계산 범위 내 미호출 {percent(selected.uncalled)} · 도착까지 호출 {percent(selected.callBeforeArrival)}<br/>도착까지 호출된 경우 중 유예 3분을 넘긴 호출은 입장할 수 없어요.</p>
              <details className="data-details"><summary>상세 수치와 차트 데이터 보기</summary><div className="detail-stats"><span>호출 중앙값 <b>{clock(selected.median)}</b></span><span>50% 구간 <b>{clock(selected.q25)}~{clock(selected.q75)}</b></span><span>80% 구간 <b>{clock(selected.callQ10)}~{clock(selected.callQ90)}</b></span><span>90% 구간 <b>{clock(selected.q05)}~{clock(selected.q95)}</b></span><span>도착 시 바로 입장 <b>{percent(selected.beforeTarget)}</b></span><span>도착 후 평균 대기 <b>{selected.expectedWait === null ? '계산 불가' : `${selected.expectedWait.toFixed(1)}분`}</b></span></div><p className="field-hint">평균 대기는 유예를 넘기지 않고 범위 내 호출된 경우 기준이에요. 계산 범위는 {clock(active.end)}까지예요.</p><div className="table-scroll"><table><caption>{selected.rank}번째 호출시간 분포 · 5분 구간</caption><thead><tr><th>호출시간</th><th>구간 확률</th><th>구간 끝까지 누적</th></tr></thead><tbody>{selected.bins.map(b => <tr key={b.time}><td>{clock(b.time)}~{clock(Math.min(b.time + 5, active.end))}</td><td>{percent(b.probability)}</td><td>{percent(b.cumulative)}</td></tr>)}</tbody></table></div></details>
            </section>
            <PositionRecommendation currentRank={current.rank} positions={active.positions} recommended={active.recommendedRank} selected={selectedRank} onSelect={rank => { setSelectedRank(rank); if (window.matchMedia('(max-width: 780px)').matches) chartRef.current?.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'start' }); }}/>
            <p className="result-footnote">{active.iterations.toLocaleString()}회 시뮬레이션 · 같은 입력, 같은 결과<br/>확률은 모델 가정에 따른 추정치예요. 실제 호출시간을 보장하지 않아요.</p>
          </motion.div> : !loading && <section className="card empty-state"><span className="empty-label">시간을 더 맛있게 쓰는 방법</span><Soup size={72} strokeWidth={1.1} className="empty-soup"/><h2>내 차례에 맞춰<br/>여유롭게 도착하세요.</h2><p>{invalid || '내 순서와 도착시간을 입력하고 예측하기를 눌러 주세요.'}</p>{tab === 'kinka' && <button className="example-button" onClick={example}>실측 시점으로 먼저 살펴보기<ArrowRight size={16}/></button>}</section>}
        </div>
      </div>
      <div id="model"><ModelExplanation/></div>
      <footer><span className="footer-brand"><Soup size={17}/>웨이팅 순서 예측</span><span>예측은 참고로, 맛있는 시간은 여유롭게.</span><small>기록은 브라우저에 저장되며 서버로 전송하지 않아요. 브라우저 데이터 삭제 시 사라질 수 있어요. <a href={`${import.meta.env.BASE_URL}kinkaramen-waiting-source.zip`} download>전체 소스코드 받기 ↗</a></small><button className="reset-records" onClick={() => { if (window.confirm('입력값과 이 앱의 모든 순서 기록을 초기화할까요?')) { clear(); setDemo(false); setSaved(defaultState()); setWritable(true); setWarning(''); } }}>입력값·기록 전체 초기화</button></footer>
    </main>
  </div>;
}
