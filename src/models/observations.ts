export interface Observation {
  id: string;
  date: string;
  time: number;
  rank?: number;
  total?: number;
  kind: 'observation' | 'self-defer' | 'registration';
  note?: string;
  flags?: string[];
  /** Only explicit before/after observations may share an ordered timestamp. */
  ordered?: boolean;
}
export interface Interval { date: string; start: number; end: number; count: number; startRank: number; total?: number }
export interface Exclusion { id: string; reason: string }

/** Counts are interval-censored. Never impute event timestamps or infer event types from Q. */
export function buildIntervals(rows: Observation[]) {
  const intervals: Interval[] = [], excluded: Exclusion[] = [];
  const unique = rows.filter((r, i) => rows.findIndex(x => x.date === r.date && x.time === r.time && x.rank === r.rank && x.total === r.total && x.kind === r.kind && x.note === r.note) === i);
  for (const date of [...new Set(unique.map(r => r.date))]) {
    const ranked = unique.filter(r => r.date === date && r.rank !== undefined).sort((a, b) => a.time - b.time);
    let previous: Observation | undefined;
    for (let i = 0; i < ranked.length;) {
      const group = ranked.filter(r => r.time === ranked[i].time);
      i += group.length;
      if (group.length > 1 && !group.every(r => r.ordered)) {
        group.forEach(r => excluded.push({ id: r.id, reason: '동일 시각의 순서가 불명확함' }));
        previous = undefined;
        continue;
      }
      for (const row of group) {
        if (!Number.isFinite(row.time) || row.time < 0 || row.time >= 1440 || !Number.isInteger(row.rank) || row.rank! < 1) {
          excluded.push({ id: row.id, reason: '유효하지 않은 관측' }); previous = undefined; continue;
        }
        if (previous) {
          const duration = row.time - previous.time;
          const count = previous.rank! - row.rank!;
          if (row.kind === 'self-defer') excluded.push({ id: row.id, reason: '직접 미루기까지의 혼합 구간 제외' });
          else if (duration <= 0) excluded.push({ id: row.id, reason: '노출 시간이 없는 구간' });
          else if (count < 0) excluded.push({ id: row.id, reason: '설명되지 않은 순서 증가; 구간 제외' });
          else intervals.push({ date, start: previous.time, end: row.time, count, startRank: previous.rank!, total: previous.total });
        }
        previous = row;
      }
    }
  }
  return { intervals, excluded, duplicates: rows.length - unique.length };
}

