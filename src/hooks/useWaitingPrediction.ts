import { useEffect, useRef, useState } from 'react';
import type { PredictionInput, PredictionResult } from '../models/simulation';
export function useWaitingPrediction(input: PredictionInput | null) {
  const worker = useRef<Worker | null>(null), sequence = useRef(0);
  const [result, setResult] = useState<PredictionResult | null>(null), [loading, setLoading] = useState(false), [progress, setProgress] = useState(0), [error, setError] = useState('');
  const key = JSON.stringify(input);
  useEffect(() => {
    const id = ++sequence.current;
    setResult(null); setError(''); setProgress(0);
    if (key === 'null') { setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(() => {
      try {
        if (!worker.current) worker.current = new Worker(new URL('../workers/simulation.worker.ts', import.meta.url), { type: 'module' });
        worker.current.onmessage = event => {
          if (event.data.id !== sequence.current) return;
          if (event.data.progress !== undefined) setProgress(event.data.progress);
          if (event.data.result) { setResult(event.data.result); setLoading(false); }
          if (event.data.error) { setError(event.data.error); setLoading(false); }
        };
        worker.current.onerror = () => { if (id !== sequence.current) return; setError('계산 작업을 실행하지 못했어요. 페이지를 새로고침해 주세요.'); setLoading(false); worker.current?.terminate(); worker.current = null; };
        worker.current.postMessage({ id, input: JSON.parse(key) });
      } catch { setError('이 브라우저에서 계산 작업을 실행할 수 없어요.'); setLoading(false); }
    }, 180);
    return () => { clearTimeout(timer); sequence.current++; };
  }, [key]);
  useEffect(() => () => worker.current?.terminate(), []);
  return { result: result && JSON.stringify(result.input) === key ? result : null, loading, progress, error };
}
