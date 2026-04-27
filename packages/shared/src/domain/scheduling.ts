/**
 * Convert a library item's raw `estimatedMinutes` (the intrinsic length of
 * the material) into the calendar block actually reserved for it.
 *
 *   1. 2× padding — pause, take notes, re-watch confusing parts.
 *   2. Round UP to the nearest 15 minutes, minimum 15.
 *
 * Used by the api scheduler AND the web budget badge so both surfaces show
 * the same number. Mirrored on the api side as `allocatedMinutes` in
 * publication.service.ts (kept identical — change here, change there).
 */
export function allocatedMinutes(estimated: number): number {
  const padded = Math.max(0, estimated) * 2;
  const rounded = Math.ceil(padded / 15) * 15;
  return Math.max(15, rounded);
}

/** Sum the allocated minutes across a list of items. */
export function sumAllocatedMinutes(
  items: ReadonlyArray<{ estimatedMinutes: number }>,
): number {
  let total = 0;
  for (const i of items) total += allocatedMinutes(i.estimatedMinutes);
  return total;
}
