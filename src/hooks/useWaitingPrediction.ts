import { useEffect, useRef, useState } from 'react';
import type { PredictionInput, PredictionResult } from '../models/simulation';
export function useWaitingPrediction() {
  const worker = useRef<Worker | null>(null), sequence = useRef(0);
  const [result,setResult]=useState<PredictionResult|null>(null),[loading,setLoading]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState('');
  useEffect(()=>()=>worker.current?.terminate(),[]);
  function predict(input:PredictionInput) {
    setError(''); setLoading(true); setProgress(0);
    try {
      if(!worker.current) worker.current=new Worker(new URL('../workers/simulation.worker.ts',import.meta.url),{type:'module'});
      const id=++sequence.current;
      worker.current.onmessage=(event)=>{ if(event.data.id!==sequence.current) return; if(event.data.progress!==undefined) setProgress(event.data.progress); if(event.data.result) {setResult(event.data.result);setLoading(false);} if(event.data.error){setError(event.data.error);setLoading(false);} };
      worker.current.onerror=()=>{setError('계산을 시작하지 못했어요. 페이지를 새로고침해 다시 시도해 주세요.');setLoading(false);worker.current?.terminate();worker.current=null;};
      worker.current.postMessage({id,input});
    } catch {setError('이 브라우저에서 계산 작업을 실행할 수 없어요. 최신 Safari 또는 Chrome을 사용해 주세요.');setLoading(false);}
  }
  function clear() {sequence.current++;worker.current?.terminate();worker.current=null;setResult(null);setLoading(false);setError('');}
  return {result,loading,progress,error,predict,clear};
}
