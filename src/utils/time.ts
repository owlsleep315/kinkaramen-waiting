import { format } from 'date-fns';
export function seoulMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).formatToParts(date);
  return Number(parts.find(p=>p.type==='hour')!.value)*60+Number(parts.find(p=>p.type==='minute')!.value);
}
export function clock(minutes: number | null) {
  if (minutes === null || !Number.isFinite(minutes)) return '범위 밖';
  const rounded = Math.round(minutes);
  return format(new Date(2000,0,1,Math.floor(rounded/60),rounded%60),'HH:mm');
}
export const parseTime = (value: string) => { const [h,m]=value.split(':').map(Number); return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:NaN; };
