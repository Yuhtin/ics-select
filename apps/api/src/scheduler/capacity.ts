import { buildEffectiveIntervals, localMinuteToUtc } from './intervals.js';
import type { AvailabilitySlotInput, BusyBlock } from './scheduler.types.js';

export type RemainingCapacityInput = {
  weekStart: Date; // Monday 00:00 UTC of the week being inspected
  slots: AvailabilitySlotInput[];
  /** length-7 array indexed by dayOfWeek (0=Mon..6=Sun); null = no cap. */
  caps: (number | null)[];
  busyBlocks: BusyBlock[];
  timezone: string;
  now: Date;
};

export type RemainingCapacityPerDay = {
  dayIdx: number; // 0=Mon..6=Sun
  /** Sum of slot windows on this day, post-busy and post-now clipping. */
  freeMinutesInWindows: number;
  /** Per-day cap from MemberAvailability; null = no cap (treated as freeMinutesInWindows). */
  capMinutes: number | null;
  /** min(freeMinutesInWindows, cap ?? freeMinutesInWindows). */
  remainingMinutes: number;
  isPast: boolean;
};

export type RemainingCapacityResult = {
  /** Sum of remainingMinutes across days from today through Sunday. */
  totalMinutes: number;
  /** Days from today through Sunday with remainingMinutes > 0. */
  daysRemaining: number;
  perDay: RemainingCapacityPerDay[];
};

/**
 * "How much more study time fits in the rest of this week?" — the answer
 * the admin needs when adding items to a published plan.
 *
 * Mirrors the scheduler's view of capacity:
 *   1. Build effective intervals (slot windows minus busy blocks, clipped to now)
 *      via the same `buildEffectiveIntervals` the scheduler uses, so this number
 *      and the actual placement engine agree on what's free.
 *   2. Sum interval minutes per day → freeMinutesInWindows.
 *   3. Apply the day cap from MemberAvailability: remaining = min(free, cap).
 *      A null cap means "no cap" (use full free window).
 *   4. Days fully in the past contribute zero.
 *
 * Why this beats `cap − totalBusyInDay`: it respects the actual study
 * windows. A member with cap=60 on Tuesday whose only window is 19-22h is
 * unaffected by a 9am meeting, but the naive subtract-everything formula
 * would penalize them.
 *
 * Because Google Calendar's getFreeBusy is the busy source, ICS events for
 * items the member completed early are already excluded (the outcome flow
 * moved/deleted them). So as soon as Maria does a Wed item on Mon, the
 * Wed slot reopens here and the admin can fill it.
 */
export function computeRemainingWeekCapacity(
  input: RemainingCapacityInput,
): RemainingCapacityResult {
  const intervals = buildEffectiveIntervals(
    input.slots,
    input.busyBlocks,
    input.weekStart,
    input.timezone,
    input.now,
  );

  // Aggregate interval minutes per dayIdx.
  const freePerDay = new Map<number, number>();
  for (const iv of intervals) {
    freePerDay.set(iv.dayIdx, (freePerDay.get(iv.dayIdx) ?? 0) + (iv.endMinute - iv.startMinute));
  }

  const perDay: RemainingCapacityPerDay[] = [];
  let totalMinutes = 0;
  let daysRemaining = 0;
  const nowMs = input.now.getTime();

  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    // "Day fully past" = next-day midnight (member-local) is <= now.
    const dayEndUtc = localMinuteToUtc(input.weekStart, dayIdx + 1, 0, input.timezone).getTime();
    const isPast = dayEndUtc <= nowMs;
    const free = freePerDay.get(dayIdx) ?? 0;
    const cap = input.caps[dayIdx] ?? null;
    const remainingMinutes = isPast ? 0 : cap === null ? free : Math.min(free, cap);

    perDay.push({
      dayIdx,
      freeMinutesInWindows: isPast ? 0 : free,
      capMinutes: cap,
      remainingMinutes,
      isPast,
    });

    totalMinutes += remainingMinutes;
    if (remainingMinutes > 0) daysRemaining += 1;
  }

  return { totalMinutes, daysRemaining, perDay };
}
