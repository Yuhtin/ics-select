import type { AvailabilitySlotInput } from './scheduler.types.js';

export type SchedulerAvailability = {
  slots: AvailabilitySlotInput[];
  caps: (number | null)[];
  preferredSessionMinutes: number;
  timezone: string;
};

export const DEFAULT_PREFERRED_SESSION_MINUTES = 60;
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

// If a member has no availability row at all, treat the week as unavailable.
// Legacy members have been backfilled (08:00-22:00 slots per day with minutes >
// 0) in the p_availability_slots migration, so reaching here means a fresh
// user who has not yet declared slots.
export const EMPTY_CAPS: (number | null)[] = [null, null, null, null, null, null, null];

// When the admin force-publishes (or force-reschedules) over an overflow,
// the scheduler runs against this wide-open availability instead of the
// member's declared slots. busyBlocks from Google Calendar still apply, so
// real commitments are respected — we just stop honoring the self-declared
// study window. Items that don't fit even in this window stay overflow and
// surface in the member's "Unscheduled" section.
export const FORCE_FALLBACK_SLOTS: AvailabilitySlotInput[] = Array.from(
  { length: 7 },
  (_, dayOfWeek) => ({
    dayOfWeek,
    startMinute: 8 * 60,
    endMinute: 22 * 60,
  }),
);
export const FORCE_FALLBACK_CAPS: (number | null)[] = [null, null, null, null, null, null, null];

export async function loadSchedulerAvailability(
  prisma: { memberAvailability: any; availabilitySlot: any },
  userId: string,
  options: { force?: boolean } = {},
): Promise<SchedulerAvailability> {
  const row = await prisma.memberAvailability.findUnique({ where: { userId } });
  if (options.force) {
    return {
      slots: FORCE_FALLBACK_SLOTS,
      caps: FORCE_FALLBACK_CAPS,
      preferredSessionMinutes: row?.preferredSessionMinutes ?? DEFAULT_PREFERRED_SESSION_MINUTES,
      timezone: row?.timezone ?? DEFAULT_TIMEZONE,
    };
  }
  const slotRows = await prisma.availabilitySlot.findMany({ where: { userId } });
  const caps: (number | null)[] = row
    ? [
        row.mondayMinutes ?? null,
        row.tuesdayMinutes ?? null,
        row.wednesdayMinutes ?? null,
        row.thursdayMinutes ?? null,
        row.fridayMinutes ?? null,
        row.saturdayMinutes ?? null,
        row.sundayMinutes ?? null,
      ]
    : EMPTY_CAPS;
  return {
    slots: slotRows.map((s: any) => ({
      dayOfWeek: s.dayOfWeek,
      startMinute: s.startMinute,
      endMinute: s.endMinute,
    })),
    caps,
    preferredSessionMinutes: row?.preferredSessionMinutes ?? DEFAULT_PREFERRED_SESSION_MINUTES,
    timezone: row?.timezone ?? DEFAULT_TIMEZONE,
  };
}
