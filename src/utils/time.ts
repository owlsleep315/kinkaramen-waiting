export function seoulMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  return Number(parts.find(p => p.type === 'hour')!.value) * 60 + Number(parts.find(p => p.type === 'minute')!.value);
}
export function seoulDate(date = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
export function clock(minutes: number | null) {
  if (minutes === null || !Number.isFinite(minutes)) return '계산 범위 밖';
  const rounded = Math.round(minutes);
  if (rounded === 1440) return '24:00';
  return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
}
export const parseTime = (value: string) => {
  if (!/^\d{2}:\d{2}$/.test(value)) return NaN;
  const [h, m] = value.split(':').map(Number);
  return h >= 0 && h < 24 && m >= 0 && m < 60 ? h * 60 + m : NaN;
};
