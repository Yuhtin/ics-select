/**
 * Convert a library item's raw `estimatedMinutes` (the intrinsic length of
 * the material) into the calendar block actually reserved for it.
 *
 * Videos get a 2x multiplier first — a 13-min video isn't 13 min of work, it's
 * pause-take-notes-rewind time, so we reserve double the raw length before
 * snapping to a slot. Other formats keep their raw length.
 *
 * Then round UP to the nearest 15-minute slot with 3-min tolerance, minimum 15.
 * The tolerance lets items that just barely cross a slot boundary (16-18 min
 * → still 15 min) sit comfortably in the smaller slot.
 *
 * Used by the api scheduler AND the web budget badge so both surfaces show
 * the same number.
 *
 * Examples (non-video):
 *   2 min  → 15
 *   18 min → 15  (tolerance)
 *   19 min → 30
 *   33 min → 30  (tolerance)
 *   34 min → 45
 *
 * Examples (VIDEO, raw → ×2 → slot):
 *   13 min → 26 → 30
 *   8 min  → 16 → 15  (tolerance)
 *   20 min → 40 → 45
 *   30 min → 60 → 60
 */
export function allocatedMinutes(
  estimated: number,
  format?: string | null,
): number {
  const raw = Math.max(0, estimated);
  const effective = format === 'VIDEO' ? raw * 2 : raw;
  const rounded = Math.ceil((effective - 3) / 15) * 15;
  return Math.max(15, rounded);
}

/**
 * Sum the allocated minutes across a list of items. Items with `outcome ===
 * 'SKIPPED'` are excluded — when the member skips a foundations item the
 * Calendar event is deleted, so its slot is freed and shouldn't count
 * against the weekly budget when admin is adding replacement work.
 */
export function sumAllocatedMinutes(
  items: ReadonlyArray<{
    estimatedMinutes: number;
    format?: string | null;
    outcome?: string | null;
  }>,
): number {
  let total = 0;
  for (const i of items) {
    if (i.outcome === 'SKIPPED') continue;
    total += allocatedMinutes(i.estimatedMinutes, i.format);
  }
  return total;
}

/**
 * Real time the member has burned this week — sum of `actualMinutes` (when
 * the member logged it) or `allocatedMinutes(...)` as a fallback, across
 * items with a positive outcome other than SKIPPED.
 *
 * SKIPPED is excluded even though it's a positive outcome: skipping means
 * "I already knew this, didn't study", so no time was spent. DOUBTS counts
 * — the study itself was done.
 *
 * Used by the budget badge to show "X min real / Y min planned" and by the
 * remaining-capacity calculation so admins can keep adding work when a
 * member finishes faster than expected.
 */
export function sumConsumedMinutes(
  items: ReadonlyArray<{
    estimatedMinutes: number;
    format?: string | null;
    actualMinutes?: number | null;
    outcome?: string | null;
  }>,
): number {
  let total = 0;
  for (const i of items) {
    const o = i.outcome;
    if (o !== 'DONE_EASY' && o !== 'DONE_HARD' && o !== 'DOUBTS') continue;
    const minutes =
      typeof i.actualMinutes === 'number' && i.actualMinutes > 0
        ? i.actualMinutes
        : allocatedMinutes(i.estimatedMinutes, i.format);
    total += minutes;
  }
  return total;
}

