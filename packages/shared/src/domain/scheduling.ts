/**
 * Convert a library item's raw `estimatedMinutes` (the intrinsic length of
 * the material) into the calendar block actually reserved for it.
 *
 * Round UP to the nearest 15-minute slot with 3-min tolerance, minimum 15.
 * The tolerance lets items that just barely cross a slot boundary (16-18 min
 * → still 15 min) sit comfortably in the smaller slot — in practice the
 * member finishes within the slot or extends a touch.
 *
 * Used by the api scheduler AND the web budget badge so both surfaces show
 * the same number.
 *
 * Examples:
 *   2 min  → 15
 *   14 min → 15
 *   18 min → 15  (3-min tolerance over slot boundary)
 *   19 min → 30
 *   30 min → 30
 *   33 min → 30  (3-min tolerance)
 *   34 min → 45
 *   60 min → 60
 */
export function allocatedMinutes(estimated: number): number {
  const raw = Math.max(0, estimated);
  const rounded = Math.ceil((raw - 3) / 15) * 15;
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
