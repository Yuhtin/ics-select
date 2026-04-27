/**
 * Convert a library item's raw `estimatedMinutes` (the intrinsic length of
 * the material) into the calendar block actually reserved for it.
 *
 * Round UP to the nearest 15-minute slot, minimum 15. No multiplicative
 * padding — earlier 2× rule blew short items into 30-min slots when a 2-min
 * Fireship video really only needs 15 min on the calendar.
 *
 * Used by the api scheduler AND the web budget badge so both surfaces show
 * the same number.
 *
 * Examples:
 *   2 min  → 15
 *   11 min → 15
 *   14 min → 15
 *   16 min → 30
 *   25 min → 30
 *   35 min → 45
 *   60 min → 60
 */
export function allocatedMinutes(estimated: number): number {
  const raw = Math.max(0, estimated);
  const rounded = Math.ceil(raw / 15) * 15;
  return Math.max(15, rounded);
}

/**
 * Sum the allocated minutes across a list of items. Items with `outcome ===
 * 'SKIPPED'` are excluded — when the member skips a foundations item the
 * Calendar event is deleted, so its slot is freed and shouldn't count
 * against the weekly budget when admin is adding replacement work.
 */
export function sumAllocatedMinutes(
  items: ReadonlyArray<{ estimatedMinutes: number; outcome?: string | null }>,
): number {
  let total = 0;
  for (const i of items) {
    if (i.outcome === 'SKIPPED') continue;
    total += allocatedMinutes(i.estimatedMinutes);
  }
  return total;
}
