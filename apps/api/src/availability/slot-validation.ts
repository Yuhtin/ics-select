import type { AvailabilitySlotInput } from './availability.types.js';

export type SlotViolationReason =
  | 'range'
  | 'granularity'
  | 'too_short'
  | 'overlap';

export class SlotValidationError extends Error {
  constructor(
    public readonly reason: SlotViolationReason,
    public readonly dayOfWeek: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'SlotValidationError';
  }
}

const MIN_SLOT_MINUTES = 30;
const GRANULARITY = 30;

export function validateSlots(slots: AvailabilitySlotInput[]): void {
  // 1) Per-slot checks
  for (const s of slots) {
    if (!Number.isInteger(s.dayOfWeek) || s.dayOfWeek < 0 || s.dayOfWeek > 6) {
      throw new SlotValidationError('range', null, `dayOfWeek out of 0..6: ${s.dayOfWeek}`);
    }
    if (s.startMinute < 0 || s.endMinute > 1440) {
      throw new SlotValidationError('range', s.dayOfWeek, `range: slot out of [0, 1440]`);
    }
    if (s.endMinute - s.startMinute < MIN_SLOT_MINUTES) {
      throw new SlotValidationError('too_short', s.dayOfWeek, `too_short: slot must be at least ${MIN_SLOT_MINUTES} minutes`);
    }
    if (s.startMinute % GRANULARITY !== 0 || s.endMinute % GRANULARITY !== 0) {
      throw new SlotValidationError('granularity', s.dayOfWeek, `granularity: slot not aligned to ${GRANULARITY}-minute granularity`);
    }
  }

  // 2) Overlap within the same day (touching boundary is allowed)
  const byDay = new Map<number, AvailabilitySlotInput[]>();
  for (const s of slots) {
    const list = byDay.get(s.dayOfWeek) ?? [];
    list.push(s);
    byDay.set(s.dayOfWeek, list);
  }
  for (const [day, list] of byDay) {
    const sorted = [...list].sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      if (curr.startMinute < prev.endMinute) {
        throw new SlotValidationError('overlap', day, `overlap: slots overlap on day ${day}`);
      }
    }
  }
}
