import { format } from 'date-fns';
export function seoulMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).formatToParts(date);
  return Number(parts.find(p=>p.type==='hour')!.value)*60+Number(parts.find(p=>p.type==='minute')!.value);
}
export function clock(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return '범위 밖';
  const rounded = Math.round(minutes);
  if (rounded >= 1440) return rounded === 1440 ? '24:00' : `다음날 ${clock(rounded - 1440)}`;
  return format(new Date(2000,0,1,Math.floor(rounded/60),rounded%60),'HH:mm');
}
export const parseTime = (value: string) => { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN; const [h,m]=value.split(':').map(Number); return h*60+m; };
export const seoulDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export const timeValue = (minutes: number) => `${Math.floor(minutes/60).toString().padStart(2,'0')}:${(minutes%60).toString().padStart(2,'0')}`;
