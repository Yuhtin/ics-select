import type {
  AvailabilitySlotInput,
  BusyBlock,
  Chunk,
  EffectiveInterval,
  ItemInput,
} from './scheduler.types.js';

const ROUND_TO_MINUTES = 15;

export function chunkItems(items: ItemInput[], pref: number): Chunk[] {
  const chunks: Chunk[] = [];
  for (const item of items) {
    let remaining = item.estimatedMinutes;
    while (remaining > 0) {
      const size = Math.min(remaining, pref);
      chunks.push({
        itemId: item.id,
        order: item.order,
        minutes: size,
        isResidue: size < pref,
      });
      remaining -= size;
    }
  }
  return chunks;
}

export function buildEffectiveIntervals(
  slots: AvailabilitySlotInput[],
  busyBlocks: BusyBlock[],
  weekStart: Date,
  timezone: string,
  now: Date,
): EffectiveInterval[] {
  const out: EffectiveInterval[] = [];
  for (const slot of slots) {
    const dayStartUtc = localMinuteToUtc(weekStart, slot.dayOfWeek, 0, timezone);
    const dayEndUtc = localMinuteToUtc(weekStart, slot.dayOfWeek + 1, 0, timezone);
    const slotStartUtc = localMinuteToUtc(weekStart, slot.dayOfWeek, slot.startMinute, timezone);
    const slotEndUtc = localMinuteToUtc(weekStart, slot.dayOfWeek, slot.endMinute, timezone);

    // Skip if the slot is entirely in the past.
    if (slotEndUtc.getTime() <= now.getTime()) continue;

    // Clip slot to [ceil(now, 15min), slotEnd] if today is current.
    let startMin = slot.startMinute;
    if (slotStartUtc.getTime() <= now.getTime() && now.getTime() < slotEndUtc.getTime()) {
      const elapsed = Math.round((now.getTime() - dayStartUtc.getTime()) / 60_000);
      const rounded = Math.ceil(elapsed / ROUND_TO_MINUTES) * ROUND_TO_MINUTES;
      startMin = Math.max(startMin, rounded);
    }
    if (startMin >= slot.endMinute) continue;

    // Project busy blocks into [startMin, slot.endMinute] in this day's local minutes.
    const busyInSlot: Array<{ start: number; end: number }> = [];
    for (const b of busyBlocks) {
      const bs = Math.max(b.start.getTime(), dayStartUtc.getTime());
      const be = Math.min(b.end.getTime(), dayEndUtc.getTime());
      if (be <= bs) continue;
      const sMin = Math.floor((bs - dayStartUtc.getTime()) / 60_000);
      const eMin = Math.ceil((be - dayStartUtc.getTime()) / 60_000);
      const clampedStart = Math.max(sMin, startMin);
      const clampedEnd = Math.min(eMin, slot.endMinute);
      if (clampedEnd > clampedStart) busyInSlot.push({ start: clampedStart, end: clampedEnd });
    }

    // Merge overlapping busy blocks
    busyInSlot.sort((a, b) => a.start - b.start);
    const merged: Array<{ start: number; end: number }> = [];
    for (const b of busyInSlot) {
      const last = merged[merged.length - 1];
      if (last && b.start <= last.end) last.end = Math.max(last.end, b.end);
      else merged.push({ ...b });
    }

    // Subtract merged busy from [startMin, slot.endMinute]
    let cursor = startMin;
    const slotSize = slot.endMinute - slot.startMinute;
    for (const b of merged) {
      if (b.start > cursor) {
        out.push({
          dayIdx: slot.dayOfWeek,
          startMinute: cursor,
          endMinute: b.start,
          slotSize,
        });
      }
      cursor = Math.max(cursor, b.end);
    }
    if (cursor < slot.endMinute) {
      out.push({
        dayIdx: slot.dayOfWeek,
        startMinute: cursor,
        endMinute: slot.endMinute,
        slotSize,
      });
    }
  }

  // Sort by (day, start) so downstream iteration is deterministic.
  out.sort((a, b) => a.dayIdx - b.dayIdx || a.startMinute - b.startMinute);
  return out;
}

export function localMinuteToUtc(
  weekStart: Date,
  dayIdx: number,
  minuteOfDay: number,
  tz: string,
): Date {
  const y = weekStart.getUTCFullYear();
  const m = weekStart.getUTCMonth() + 1;
  const d = weekStart.getUTCDate() + dayIdx;
  const hh = Math.floor(minuteOfDay / 60);
  const mm = minuteOfDay % 60;
  return localToUtc(y, m, d, hh, mm, tz);
}

function localToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
): Date {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute);
  const offsetMin = getTzOffsetMinutes(new Date(naiveUtc), tz);
  return new Date(naiveUtc - offsetMin * 60_000);
}

function getTzOffsetMinutes(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
  const asUtcMs = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return Math.round((asUtcMs - date.getTime()) / 60_000);
}
