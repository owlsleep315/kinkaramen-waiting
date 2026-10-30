import { MODEL } from '../models/modelConstants';
import { Bar, CartesianGrid, ComposedChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { clock } from '../utils/time';
import { percent } from '../utils/probability';
import type { PositionResult } from '../models/simulation';
export function ProbabilityChart({current,selected,target,tolerance}:{current:PositionResult;selected:PositionResult;target:number;tolerance:number}) {
  const data=current.bins.map((b,i)=>({time:b.time+2.5,current:b.probability,selected:selected.bins[i]?.probability??0,start:b.time}));
  const distinct=current.rank!==selected.rank;
  const meaningful=data.filter(d=>d.current>0||d.selected>0);
  const min=Math.min(meaningful[0]?.start??data[0].start,target-MODEL.graceMinutes)-2.5;
  const max=Math.max((meaningful.at(-1)?.start??data.at(-1)!.start)+5,target+tolerance)+2.5;
  const domain=[min,max];
  return <div className="chart-shell" role="img" aria-label={`5분 단위 호출확률. 현재 ${current.rank}번째와 선택 ${selected.rank}번째 비교. 상세 수치는 아래 표에서 확인할 수 있어요.`}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{top:24,right:10,left:-22,bottom:2}} barGap={1} barCategoryGap="16%"><CartesianGrid vertical={false} stroke="#edf0f4"/><XAxis type="number" dataKey="time" domain={domain} allowDataOverflow tickFormatter={clock} tick={{fontSize:11,fill:'#8b95a1'}} axisLine={false} tickLine={false} minTickGap={25}/><YAxis tickFormatter={v=>`${Math.round(v*100)}%`} tick={{fontSize:11,fill:'#8b95a1'}} axisLine={false} tickLine={false}/><ReferenceArea x1={target-MODEL.graceMinutes} x2={target+tolerance} fill="#3182f6" fillOpacity={.055}/><ReferenceLine x={target} stroke="#3182f6" strokeDasharray="4 4" label={{value:'도착',position:'top',fontSize:11,fill:'#3182f6'}}/><Tooltip cursor={{fill:'#f0f4fa',opacity:.6}} contentStyle={{border:0,borderRadius:12,boxShadow:'0 8px 30px #172b4d18',fontSize:12}} labelFormatter={v=>`${clock(Number(v)-2.5)}–${clock(Number(v)+2.5)}`} formatter={(v,name)=>[percent(Number(v)),name]}/><Bar name={`현재 ${current.rank}번째`} dataKey="current" fill={distinct?'#c9d2df':'#3182f6'} radius={[4,4,0,0]} maxBarSize={24} isAnimationActive={false}/>{distinct&&<Bar name={`선택 ${selected.rank}번째`} dataKey="selected" fill="#3182f6" radius={[4,4,0,0]} maxBarSize={24} isAnimationActive={false}/>}</ComposedChart></ResponsiveContainer></div>;
}
