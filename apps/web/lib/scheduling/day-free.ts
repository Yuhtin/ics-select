export type MinuteRange = { startMinute: number; endMinute: number };

export type DayFreeInput = {
  capMinutes: number;
  /** Slots whose end hasn't passed yet, in member-local minutes. */
  futureSlots: MinuteRange[];
  /** External Calendar busy blocks for the day, in member-local minutes. */
  busyBlocks: MinuteRange[];
  scheduledMinutes: number;
  itemCount: number;
};

const BUFFER_MINUTES = 10;

/**
 * "How many more minutes fit on this day?" as the scheduler sees it.
 *
 * The cap and the slot window are two independent limits, and the answer is
 * the smaller one (same as `computeRemainingWeekCapacity` in the api):
 *   - cap room    = cap − scheduled content. phase1 checks only content against
 *                   the cap; buffers don't count toward it.
 *   - window room = slot minutes − busy inside them − scheduled − buffer. The
 *                   10-min buffer between sessions does occupy the window.
 *
 * Subtracting busy straight from the cap is wrong: a 30m cap over an 08–22h
 * slot with 7h of meetings still has 30m free, not zero.
 */
export function computeDayFreeMinutes(input: DayFreeInput): number {
  const windowMinutes = input.futureSlots.reduce(
    (sum, s) => sum + (s.endMinute - s.startMinute),
    0,
  );
  const busyInSlots = input.futureSlots.reduce(
    (sum, s) => sum + busyMinutesInside(input.busyBlocks, s),
    0,
  );
  const bufferCost = input.itemCount > 0 ? BUFFER_MINUTES : 0;
  const capRoom = input.capMinutes - input.scheduledMinutes;
  const windowRoom = windowMinutes - busyInSlots - input.scheduledMinutes - bufferCost;
  return Math.max(0, Math.min(capRoom, windowRoom));
}

// Busy minutes inside one slot, with overlapping blocks merged so a meeting
// sitting inside a longer event isn't counted twice.
function busyMinutesInside(busy: MinuteRange[], slot: MinuteRange): number {
  const clipped = busy
    .map((b) => ({
      start: Math.max(b.startMinute, slot.startMinute),
      end: Math.min(b.endMinute, slot.endMinute),
    }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start);
  let total = 0;
  let cursor = slot.startMinute;
  for (const b of clipped) {
    const start = Math.max(b.start, cursor);
    if (b.end > start) {
      total += b.end - start;
      cursor = b.end;
    }
  }
  return total;
}
