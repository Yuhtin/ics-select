const BRT_OFFSET_MINUTES = -3 * 60;

function brtDateKey(d: Date): string {
  const shifted = new Date(d.getTime() + BRT_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 10);
}

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
  while (days.has(cursor)) {
    streak += 1;
    const parts = cursor.split('-').map(Number);
    const y = parts[0]!;
    const m = parts[1]!;
    const d = parts[2]!;
    const prev = new Date(Date.UTC(y, m - 1, d - 1));
    cursor = prev.toISOString().slice(0, 10);
  }
  return streak;
}
