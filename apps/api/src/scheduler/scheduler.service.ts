import { Injectable } from '@nestjs/common';

export type ItemInput = { id: string; estimatedMinutes: number };

export type BusyBlock = { startMinute: number; endMinute: number };

export type SchedulerInput = {
  weekStart: Date;
  availability: {
    mondayMinutes: number;
    tuesdayMinutes: number;
    wednesdayMinutes: number;
    thursdayMinutes: number;
    fridayMinutes: number;
    saturdayMinutes: number;
    sundayMinutes: number;
    preferredSessionMinutes: number;
    timezone: string;
  };
  // Key: day index 0..6 (0=Mon); value: busy blocks in minutes-of-day
  busyByDay: Record<number, BusyBlock[]>;
  items: ItemInput[];
  // Current time, used to skip past days and start today at/after "now".
  // Defaults to new Date() for safety; tests override this.
  now?: Date;
};

export type PlannedSession = {
  itemId: string;
  scheduledAt: Date;
  durationMinutes: number;
};

export type OverflowChunk = { itemId: string; minutesRequired: number };

export type SchedulerOutput = {
  sessions: PlannedSession[];
  overflow: OverflowChunk[];
};

const DAY_MINUTES_KEYS: (keyof SchedulerInput['availability'])[] = [
  'mondayMinutes',
  'tuesdayMinutes',
  'wednesdayMinutes',
  'thursdayMinutes',
  'fridayMinutes',
  'saturdayMinutes',
  'sundayMinutes',
];

const DAY_START_MINUTE = 8 * 60; // 08:00 local
const DAY_END_MINUTE = 22 * 60; // 22:00 local — don't schedule into the night
const BUFFER_MINUTES = 10;
const ROUND_TO_MINUTES = 15;

@Injectable()
export class SchedulerService {
  plan(input: SchedulerInput): SchedulerOutput {
    const pref = input.availability.preferredSessionMinutes;
    const tz = input.availability.timezone;
    const now = input.now ?? new Date();

    // 1. Chunk items
    const chunks: Array<{ itemId: string; minutes: number }> = [];
    for (const item of input.items) {
      let remaining = item.estimatedMinutes;
      while (remaining > 0) {
        const size = Math.min(remaining, pref);
        chunks.push({ itemId: item.id, minutes: size });
        remaining -= size;
      }
    }

    // 2. For each day 0..6, determine the effective start/end minute-of-day,
    //    subtract busy blocks and declared budget, and derive a window that
    //    respects "now" for partial days.
    const windows: Array<{
      startMinute: number;
      endMinute: number;
      remaining: number;
    }> = DAY_MINUTES_KEYS.map((key, idx) => {
      const declared = input.availability[key] as number;
      if (declared <= 0) {
        return { startMinute: DAY_START_MINUTE, endMinute: DAY_START_MINUTE, remaining: 0 };
      }

      // Local calendar date for this day: local Monday + idx.
      const y = input.weekStart.getUTCFullYear();
      const m = input.weekStart.getUTCMonth() + 1;
      const d = input.weekStart.getUTCDate() + idx;

      const dayStartUtc = localToUtc(y, m, d, 0, 0, tz);
      const dayEndUtc = localToUtc(y, m, d + 1, 0, 0, tz);

      // Fully past day → no capacity.
      if (dayEndUtc.getTime() <= now.getTime()) {
        return { startMinute: DAY_START_MINUTE, endMinute: DAY_START_MINUTE, remaining: 0 };
      }

      let startMinute = DAY_START_MINUTE;

      // Today (partial): bump start to ceil(now + small buffer) in local minutes.
      if (dayStartUtc.getTime() <= now.getTime() && now.getTime() < dayEndUtc.getTime()) {
        const elapsed = Math.round((now.getTime() - dayStartUtc.getTime()) / 60000);
        const rounded =
          Math.ceil(elapsed / ROUND_TO_MINUTES) * ROUND_TO_MINUTES;
        startMinute = Math.max(startMinute, rounded);
      }

      if (startMinute >= DAY_END_MINUTE) {
        return { startMinute, endMinute: startMinute, remaining: 0 };
      }

      const endMinute = DAY_END_MINUTE;
      const busy = (input.busyByDay[idx] ?? [])
        .filter((b) => b.endMinute > startMinute && b.startMinute < endMinute)
        .reduce(
          (sum, b) =>
            sum +
            Math.max(
              0,
              Math.min(b.endMinute, endMinute) - Math.max(b.startMinute, startMinute),
            ),
          0,
        );

      const remaining = Math.max(0, declared - busy);
      return { startMinute, endMinute, remaining };
    });

    // 3. Pack chunks into days
    const sessions: PlannedSession[] = [];
    const overflow: OverflowChunk[] = [];
    let dayIdx = 0;
    let cursorMinute = windows[0]!.startMinute;

    for (const chunk of chunks) {
      while (dayIdx < 7) {
        const w = windows[dayIdx]!;
        const wallRemaining = w.endMinute - cursorMinute;
        const available = Math.min(w.remaining, wallRemaining);
        if (available >= chunk.minutes) break;
        dayIdx += 1;
        if (dayIdx < 7) cursorMinute = windows[dayIdx]!.startMinute;
      }
      if (dayIdx >= 7) {
        overflow.push({ itemId: chunk.itemId, minutesRequired: chunk.minutes });
        continue;
      }
      const w = windows[dayIdx]!;
      const scheduledAt = localMinuteToUtc(
        input.weekStart,
        dayIdx,
        cursorMinute,
        tz,
      );
      sessions.push({
        itemId: chunk.itemId,
        scheduledAt,
        durationMinutes: chunk.minutes,
      });
      w.remaining -= chunk.minutes;
      cursorMinute += chunk.minutes + BUFFER_MINUTES;
    }

    return { sessions, overflow };
  }
}

function localMinuteToUtc(
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

/**
 * Convert wall-clock components in the given IANA timezone to a UTC Date.
 * Uses Intl.DateTimeFormat to resolve the tz offset at that instant, handling
 * DST correctly. Ambiguous times at DST transitions fall back to the first
 * matching instant.
 */
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
