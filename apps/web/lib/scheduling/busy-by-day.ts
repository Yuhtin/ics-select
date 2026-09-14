import type { MinuteRange } from './day-free';

export type BusyBlockIso = { start: string; end: string };

/**
 * Compute the UTC milliseconds for a (year, month, day, hour, minute) tuple
 * interpreted in `tz`. Mirrors the backend `localMinuteToUtc` so frontend
 * day boundaries match what the scheduler uses. `day` may overflow the month;
 * Date.UTC normalizes it.
 */
export function localToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
): number {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(naiveUtc));
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
  const asUtcMs = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  const offsetMin = Math.round((asUtcMs - naiveUtc) / 60_000);
  return naiveUtc - offsetMin * 60_000;
}

/**
 * Split Calendar busy blocks into the seven member-local days of the week, in
 * local minutes. Each block is clipped to each day's local midnight bounds,
 * the same projection `buildEffectiveIntervals` does in the api.
 *
 * Bucketing by UTC day instead put a Sunday 21:00 BRT event (00:00 UTC Monday)
 * on Monday and dropped Monday-night events onto Tuesday.
 */
export function bucketBusyByLocalDay(
  busyBlocks: BusyBlockIso[],
  weekStartIso: string,
  timezone: string,
): MinuteRange[][] {
  const buckets: MinuteRange[][] = [[], [], [], [], [], [], []];
  const weekStart = new Date(weekStartIso);
  const y = weekStart.getUTCFullYear();
  const m = weekStart.getUTCMonth() + 1;
  const d = weekStart.getUTCDate();
  for (let idx = 0; idx < 7; idx++) {
    const dayStart = localToUtcMs(y, m, d + idx, 0, 0, timezone);
    const dayEnd = localToUtcMs(y, m, d + idx + 1, 0, 0, timezone);
    for (const b of busyBlocks) {
      const s = Math.max(new Date(b.start).getTime(), dayStart);
      const e = Math.min(new Date(b.end).getTime(), dayEnd);
      if (e <= s) continue;
      buckets[idx]!.push({
        startMinute: Math.floor((s - dayStart) / 60_000),
        endMinute: Math.ceil((e - dayStart) / 60_000),
      });
    }
    buckets[idx]!.sort((a, b) => a.startMinute - b.startMinute);
  }
  return buckets;
}
