const BRT_OFFSET_MINUTES = -3 * 60;

function brtDateKey(d: Date): string {
  const shifted = new Date(d.getTime() + BRT_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 10);
}

function isWeekend(dateKey: string): boolean {
  const parts = dateKey.split('-').map(Number);
  const y = parts[0]!;
  const m = parts[1]!;
  const d = parts[2]!;
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
}

function prevDayKey(dateKey: string): string {
  const parts = dateKey.split('-').map(Number);
  const y = parts[0]!;
  const m = parts[1]!;
  const d = parts[2]!;
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return prev.toISOString().slice(0, 10);
}

/**
 * Count consecutive BRT calendar days with at least one completed item,
 * ending at `asOf`. Weekends (Sat/Sun) are "free": a missing weekend doesn't
 * break the streak, but a weekend completion still counts when present.
 *
 * Examples (asOf = Mon):
 *   completions Mon, prev Fri/Thu/Wed   → streak 4 (Sat/Sun skipped)
 *   completions Mon, prev Sat (no Fri)  → streak 2 (Sat counts; Fri breaks)
 *   completions Mon only                → streak 1
 */
export function computeStreakDays(
  items: Array<{ completedAt: Date | null }>,
  asOf: Date,
): number {
  const asOfKey = brtDateKey(asOf);
  const days = new Set<string>();
  for (const it of items) {
    if (!it.completedAt) continue;
    const key = brtDateKey(it.completedAt);
    if (key > asOfKey) continue;
    days.add(key);
  }
  if (days.size === 0) return 0;

  let streak = 0;
  let cursor = asOfKey;
  // Safety bound: the cycle is at most ~365 days; the loop terminates as soon
  // as a weekday without a completion is hit, but the bound prevents any
  // pathological infinite walk on bad data.
  for (let guard = 0; guard < 400; guard += 1) {
    if (days.has(cursor)) {
      streak += 1;
    } else if (!isWeekend(cursor)) {
      break;
    }
    cursor = prevDayKey(cursor);
  }
  return streak;
}
