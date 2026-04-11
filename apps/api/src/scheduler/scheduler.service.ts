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
const BUFFER_MINUTES = 10;

@Injectable()
export class SchedulerService {
  plan(input: SchedulerInput): SchedulerOutput {
    const pref = input.availability.preferredSessionMinutes;

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

    // 2. Compute effective daily budgets after subtracting busy time
    const budgets: number[] = DAY_MINUTES_KEYS.map((key, idx) => {
      const declared = input.availability[key] as number;
      const busy = (input.busyByDay[idx] ?? []).reduce(
        (sum, b) => sum + Math.max(0, b.endMinute - b.startMinute),
        0,
      );
      return Math.max(0, declared - busy);
    });

    // 3. Pack chunks into days
    const sessions: PlannedSession[] = [];
    const overflow: OverflowChunk[] = [];
    let dayIdx = 0;
    let minuteIntoDay = 0;

    for (const chunk of chunks) {
      while (dayIdx < 7 && budgets[dayIdx]! - minuteIntoDay < chunk.minutes) {
        dayIdx += 1;
        minuteIntoDay = 0;
      }
      if (dayIdx >= 7) {
        overflow.push({ itemId: chunk.itemId, minutesRequired: chunk.minutes });
        continue;
      }
      const scheduledAt = addMinutesToMonday(input.weekStart, dayIdx, DAY_START_MINUTE + minuteIntoDay);
      sessions.push({
        itemId: chunk.itemId,
        scheduledAt,
        durationMinutes: chunk.minutes,
      });
      minuteIntoDay += chunk.minutes + BUFFER_MINUTES;
    }

    return { sessions, overflow };
  }
}

function addMinutesToMonday(weekStart: Date, dayIdx: number, minuteOfDay: number): Date {
  const d = new Date(weekStart.getTime());
  d.setUTCDate(d.getUTCDate() + dayIdx);
  d.setUTCMinutes(d.getUTCMinutes() + minuteOfDay);
  return d;
}
